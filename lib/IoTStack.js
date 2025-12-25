"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IoTStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const iot = __importStar(require("aws-cdk-lib/aws-iot"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const aws_lambda_nodejs_1 = require("aws-cdk-lib/aws-lambda-nodejs");
const path = __importStar(require("path"));
class IoTStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const { dbStack, wsStack } = props;
        // Ensure DBStack and WebSocketStack are created before IoTStack
        this.addDependency(dbStack);
        this.addDependency(wsStack);
        // ────────────────────────────────
        // 0) Device list (3 devices × 2 sensors)
        // ────────────────────────────────
        const devices = [
            {
                name: "pi3-01",
                sensors: ["temp_c", "humidity"],
            },
            {
                name: "pico-01",
                sensors: ["temp_c", "humidity"],
            },
            {
                name: "pico-02",
                sensors: ["temp_c", "humidity"],
            },
        ];
        // ────────────────────────────────
        // 1) IoT Things (one per device)
        // ────────────────────────────────
        const thingMap = {};
        for (const device of devices) {
            const thing = new iot.CfnThing(this, `Thing-${device.name}`, {
                thingName: device.name,
            });
            thingMap[device.name] = thing;
        }
        // ────────────────────────────────
        // 2) Shared IoT Policy for all devices
        // ────────────────────────────────
        const iotPolicy = new iot.CfnPolicy(this, "DeviceTelemetryPolicy", {
            policyName: "DeviceTelemetryPolicy",
            policyDocument: {
                Version: "2012-10-17",
                Statement: [
                    {
                        Effect: "Allow",
                        Action: ["iot:Connect"],
                        Resource: [
                            `arn:aws:iot:${this.region}:${this.account}:client/\${iot:ClientId}`,
                        ],
                    },
                    {
                        Effect: "Allow",
                        Action: ["iot:Publish", "iot:Receive"],
                        Resource: [
                            `arn:aws:iot:${this.region}:${this.account}:topic/devices/\${iot:ClientId}/*`,
                        ],
                    },
                    {
                        Effect: "Allow",
                        Action: ["iot:Subscribe"],
                        Resource: [
                            `arn:aws:iot:${this.region}:${this.account}:topicfilter/devices/\${iot:ClientId}/*`,
                        ],
                    },
                ],
            },
        });
        new cdk.CfnOutput(this, "IoTPolicyName", {
            value: iotPolicy.policyName,
            description: "Shared IoT policy for all devices",
        });
        // ────────────────────────────────
        // 3) Use telemetry table from DBStack
        // ────────────────────────────────
        const telemetryTable = dbStack.iotTelemetryTable;
        // ────────────────────────────────
        // 4) Lambda: ingest telemetry from IoT Core → DynamoDB + WebSocket broadcast
        // ────────────────────────────────
        const telemetryIngestFn = new aws_lambda_nodejs_1.NodejsFunction(this, "TelemetryIngestHandler", {
            runtime: lambda.Runtime.NODEJS_18_X,
            entry: path.join(__dirname, "../lambda/telemetry-ingest.ts"),
            handler: "handler",
            bundling: {
                target: "node18",
                minify: true,
                sourceMap: false,
            },
            environment: {
                TELEMETRY_TABLE: telemetryTable.tableName,
                WS_CONNECTIONS_TABLE: wsStack.connectionsTable.tableName,
                WS_MANAGEMENT_ENDPOINT: wsStack.managementEndpoint,
            },
        });
        telemetryTable.grantWriteData(telemetryIngestFn);
        wsStack.connectionsTable.grantReadData(telemetryIngestFn);
        // Allow managing WebSocket connections
        telemetryIngestFn.addToRolePolicy(new iam.PolicyStatement({
            actions: ["execute-api:ManageConnections"],
            resources: [
                `arn:aws:execute-api:${this.region}:${this.account}:` +
                    `${wsStack.webSocketApi.apiId}/${wsStack.stage.stageName}/*/@connections/*`,
            ],
        }));
        // Allow IoT to invoke this Lambda (rule-restricted below)
        telemetryIngestFn.addPermission("AllowIotInvoke", {
            principal: new iam.ServicePrincipal("iot.amazonaws.com"),
            action: "lambda:InvokeFunction",
            sourceAccount: this.account,
        });
        // ────────────────────────────────
        // 5) IoT Rule: trigger telemetryIngestFn on telemetry topics
        // ────────────────────────────────
        const telemetryRule = new iot.CfnTopicRule(this, "DeviceTelemetryRule", {
            topicRulePayload: {
                sql: "SELECT * FROM 'devices/+/telemetry'",
                actions: [
                    {
                        lambda: {
                            functionArn: telemetryIngestFn.functionArn,
                        },
                    },
                ],
                ruleDisabled: false,
                awsIotSqlVersion: "2016-03-23",
            },
        });
        telemetryIngestFn.addPermission("AllowIotInvokeFromRule", {
            principal: new iam.ServicePrincipal("iot.amazonaws.com"),
            action: "lambda:InvokeFunction",
            sourceArn: telemetryRule.attrArn,
        });
        // ────────────────────────────────
        // 6) Outputs for devices (things)
        // ────────────────────────────────
        devices.forEach((device) => {
            new cdk.CfnOutput(this, `ThingName-${device.name}`, {
                value: device.name,
                description: `IoT Thing for device ${device.name}`,
            });
        });
    }
}
exports.IoTStack = IoTStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSW9UU3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJJb1RTdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUVuQyx5REFBMkM7QUFFM0MsK0RBQWlEO0FBQ2pELHlEQUEyQztBQUMzQyxxRUFBK0Q7QUFDL0QsMkNBQTZCO0FBYzdCLE1BQWEsUUFBUyxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3JDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBb0I7UUFDNUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsR0FBRyxLQUFLLENBQUM7UUFFbkMsZ0VBQWdFO1FBQ2hFLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDNUIsSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUU1QixtQ0FBbUM7UUFDbkMseUNBQXlDO1FBQ3pDLG1DQUFtQztRQUNuQyxNQUFNLE9BQU8sR0FBbUI7WUFDOUI7Z0JBQ0UsSUFBSSxFQUFFLFFBQVE7Z0JBQ2QsT0FBTyxFQUFFLENBQUMsUUFBUSxFQUFFLFVBQVUsQ0FBQzthQUNoQztZQUNEO2dCQUNFLElBQUksRUFBRSxTQUFTO2dCQUNmLE9BQU8sRUFBRSxDQUFDLFFBQVEsRUFBRSxVQUFVLENBQUM7YUFDaEM7WUFDRDtnQkFDRSxJQUFJLEVBQUUsU0FBUztnQkFDZixPQUFPLEVBQUUsQ0FBQyxRQUFRLEVBQUUsVUFBVSxDQUFDO2FBQ2hDO1NBQ0YsQ0FBQztRQUVGLG1DQUFtQztRQUNuQyxpQ0FBaUM7UUFDakMsbUNBQW1DO1FBQ25DLE1BQU0sUUFBUSxHQUFpQyxFQUFFLENBQUM7UUFFbEQsS0FBSyxNQUFNLE1BQU0sSUFBSSxPQUFPLEVBQUUsQ0FBQztZQUM3QixNQUFNLEtBQUssR0FBRyxJQUFJ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QyxJQUFJLEVBQUU7YUFDbkQsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUE3SkQsNEJBNkpDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gXCJhd3MtY2RrLWxpYlwiO1xyXG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tIFwiY29uc3RydWN0c1wiO1xyXG5pbXBvcnQgKiBhcyBpb3QgZnJvbSBcImF3cy1jZGstbGliL2F3cy1pb3RcIjtcclxuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSBcImF3cy1jZGstbGliL2F3cy1keW5hbW9kYlwiO1xyXG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSBcImF3cy1jZGstbGliL2F3cy1sYW1iZGFcIjtcclxuaW1wb3J0ICogYXMgaWFtIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtaWFtXCI7XHJcbmltcG9ydCB7IE5vZGVqc0Z1bmN0aW9uIH0gZnJvbSBcImF3cy1jZGstbGliL2F3cy1sYW1iZGEtbm9kZWpzXCI7XHJcbmltcG9ydCAqIGFzIHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IHsgREJTdGFjayB9IGZyb20gXCIuL0RCc3RhY2tcIjtcclxuaW1wb3J0IHsgVW5pdHlXZWJTb2NrZXRTdGFjayB9IGZyb20gXCIuL3VuaXR5LXdlYnNvY2tldC1zdGFja1wiO1xyXG5cclxuaW50ZXJmYWNlIElvVFN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XHJcbiAgZGJTdGFjazogREJTdGFjaztcclxuICB3c1N0YWNrOiBVbml0eVdlYlNvY2tldFN0YWNrO1xyXG59XHJcblxyXG5pbnRlcmZhY2UgRGV2aWNlQ29uZmlnIHtcclxuICBuYW1lOiBzdHJpbmc7XHJcbiAgc2Vuc29yczogc3RyaW5nW107XHJcbn1cclxuXHJcbmV4cG9ydCBjbGFzcyBJb1RTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XHJcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IElvVFN0YWNrUHJvcHMpIHtcclxuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xyXG5cclxuICAgIGNvbnN0IHsgZGJTdGFjaywgd3NTdGFjayB9ID0gcHJvcHM7XHJcblxyXG4gICAgLy8gRW5zdXJlIERCU3RhY2sgYW5kIFdlYlNvY2tldFN0YWNrIGFyZSBjcmVhdGVkIGJlZm9yZSBJb1RTdGFja1xyXG4gICAgdGhpcy5hZGREZXBlbmRlbmN5KGRiU3RhY2spO1xyXG4gICAgdGhpcy5hZGREZXBlbmRlbmN5KHdzU3RhY2spO1xyXG5cclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgLy8gMCkgRGV2aWNlIGxpc3QgKDMgZGV2aWNlcyDDlyAyIHNlbnNvcnMpXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIGNvbnN0IGRldmljZXM6IERldmljZUNvbmZpZ1tdID0gW1xyXG4gICAgICB7XHJcbiAgICAgICAgbmFtZTogXCJwaTMtMDFcIixcclxuICAgICAgICBzZW5zb3JzOiBbXCJ0ZW1wX2NcIiwgXCJodW1pZGl0eVwiXSxcclxuICAgICAgfSxcclxuICAgICAge1xyXG4gICAgICAgIG5hbWU6IFwicGljby0wMVwiLFxyXG4gICAgICAgIHNlbnNvcnM6IFtcInRlbXBfY1wiLCBcImh1bWlkaXR5XCJdLFxyXG4gICAgICB9LFxyXG4gICAgICB7XHJcbiAgICAgICAgbmFtZTogXCJwaWNvLTAyXCIsXHJcbiAgICAgICAgc2Vuc29yczogW1widGVtcF9jXCIsIFwiaHVtaWRpdHlcIl0sXHJcbiAgICAgIH0sXHJcbiAgICBdO1xyXG5cclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgLy8gMSkgSW9UIFRoaW5ncyAob25lIHBlciBkZXZpY2UpXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIGNvbnN0IHRoaW5nTWFwOiBSZWNvcmQ8c3RyaW5nLCBpb3QuQ2ZuVGhpbmc+ID0ge307XHJcblxyXG4gICAgZm9yIChjb25zdCBkZXZpY2Ugb2YgZGV2aWNlcykge1xyXG4gICAgICBjb25zdCB0aGluZyA9IG5ldyBpb3QuQ2ZuVGhpbmcodGhpcywgYFRoaW5nLSR7ZGV2aWNlLm5hbWV9YCwge1xyXG4gICAgICAgIHRoaW5nTmFtZTogZGV2aWNlLm5hbWUsXHJcbiAgICAgIH0pO1xyXG4gICAgICB0aGluZ01hcFtkZXZpY2UubmFtZV0gPSB0aGluZztcclxuICAgIH1cclxuXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIC8vIDIpIFNoYXJlZCBJb1QgUG9saWN5IGZvciBhbGwgZGV2aWNlc1xyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICBjb25zdCBpb3RQb2xpY3kgPSBuZXcgaW90LkNmblBvbGljeSh0aGlzLCBcIkRldmljZVRlbGVtZXRyeVBvbGljeVwiLCB7XHJcbiAgICAgIHBvbGljeU5hbWU6IFwiRGV2aWNlVGVsZW1ldHJ5UG9saWN5XCIsXHJcbiAgICAgIHBvbGljeURvY3VtZW50OiB7XHJcbiAgICAgICAgVmVyc2lvbjogXCIyMDEyLTEwLTE3XCIsXHJcbiAgICAgICAgU3RhdGVtZW50OiBbXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIEVmZmVjdDogXCJBbGxvd1wiLFxyXG4gICAgICAgICAgICBBY3Rpb246IFtcImlvdDpDb25uZWN0XCJdLFxyXG4gICAgICAgICAgICBSZXNvdXJjZTogW1xyXG4gICAgICAgICAgICAgIGBhcm46YXdzOmlvdDoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06Y2xpZW50L1xcJHtpb3Q6Q2xpZW50SWR9YCxcclxuICAgICAgICAgICAgXSxcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIEVmZmVjdDogXCJBbGxvd1wiLFxyXG4gICAgICAgICAgICBBY3Rpb246IFtcImlvdDpQdWJsaXNoXCIsIFwiaW90OlJlY2VpdmVcIl0sXHJcbiAgICAgICAgICAgIFJlc291cmNlOiBbXHJcbiAgICAgICAgICAgICAgYGFybjphd3M6aW90OiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTp0b3BpYy9kZXZpY2VzL1xcJHtpb3Q6Q2xpZW50SWR9LypgLFxyXG4gICAgICAgICAgICBdLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgRWZmZWN0OiBcIkFsbG93XCIsXHJcbiAgICAgICAgICAgIEFjdGlvbjogW1wiaW90OlN1YnNjcmliZVwiXSxcclxuICAgICAgICAgICAgUmVzb3VyY2U6IFtcclxuICAgICAgICAgICAgICBgYXJuOmF3czppb3Q6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OnRvcGljZmlsdGVyL2RldmljZXMvXFwke2lvdDpDbGllbnRJZH0vKmAsXHJcbiAgICAgICAgICAgIF0sXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgIF0sXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIklvVFBvbGljeU5hbWVcIiwge1xyXG4gICAgICB2YWx1ZTogaW90UG9saWN5LnBvbGljeU5hbWUhLFxyXG4gICAgICBkZXNjcmlwdGlvbjogXCJTaGFyZWQgSW9UIHBvbGljeSBmb3IgYWxsIGRldmljZXNcIixcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgLy8gMykgVXNlIHRlbGVtZXRyeSB0YWJsZSBmcm9tIERCU3RhY2tcclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgY29uc3QgdGVsZW1ldHJ5VGFibGU6IGR5bmFtb2RiLlRhYmxlID0gZGJTdGFjay5pb3RUZWxlbWV0cnlUYWJsZTtcclxuXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIC8vIDQpIExhbWJkYTogaW5nZXN0IHRlbGVtZXRyeSBmcm9tIElvVCBDb3JlIOKGkiBEeW5hbW9EQiArIFdlYlNvY2tldCBicm9hZGNhc3RcclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgY29uc3QgdGVsZW1ldHJ5SW5nZXN0Rm4gPSBuZXcgTm9kZWpzRnVuY3Rpb24odGhpcywgXCJUZWxlbWV0cnlJbmdlc3RIYW5kbGVyXCIsIHtcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXHJcbiAgICAgIGVudHJ5OiBwYXRoLmpvaW4oX19kaXJuYW1lLCBcIi4uL2xhbWJkYS90ZWxlbWV0cnktaW5nZXN0LnRzXCIpLFxyXG4gICAgICBoYW5kbGVyOiBcImhhbmRsZXJcIixcclxuICAgICAgYnVuZGxpbmc6IHtcclxuICAgICAgICB0YXJnZXQ6IFwibm9kZTE4XCIsXHJcbiAgICAgICAgbWluaWZ5OiB0cnVlLFxyXG4gICAgICAgIHNvdXJjZU1hcDogZmFsc2UsXHJcbiAgICAgIH0sXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgVEVMRU1FVFJZX1RBQkxFOiB0ZWxlbWV0cnlUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgICAgV1NfQ09OTkVDVElPTlNfVEFCTEU6IHdzU3RhY2suY29ubmVjdGlvbnNUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgICAgV1NfTUFOQUdFTUVOVF9FTkRQT0lOVDogd3NTdGFjay5tYW5hZ2VtZW50RW5kcG9pbnQsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICB0ZWxlbWV0cnlUYWJsZS5ncmFudFdyaXRlRGF0YSh0ZWxlbWV0cnlJbmdlc3RGbik7XHJcbiAgICB3c1N0YWNrLmNvbm5lY3Rpb25zVGFibGUuZ3JhbnRSZWFkRGF0YSh0ZWxlbWV0cnlJbmdlc3RGbik7XHJcblxyXG4gICAgLy8gQWxsb3cgbWFuYWdpbmcgV2ViU29ja2V0IGNvbm5lY3Rpb25zXHJcbiAgICB0ZWxlbWV0cnlJbmdlc3RGbi5hZGRUb1JvbGVQb2xpY3koXHJcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgICBhY3Rpb25zOiBbXCJleGVjdXRlLWFwaTpNYW5hZ2VDb25uZWN0aW9uc1wiXSxcclxuICAgICAgICByZXNvdXJjZXM6IFtcclxuICAgICAgICAgIGBhcm46YXdzOmV4ZWN1dGUtYXBpOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTpgICtcclxuICAgICAgICAgICAgYCR7d3NTdGFjay53ZWJTb2NrZXRBcGkuYXBpSWR9LyR7d3NTdGFjay5zdGFnZS5zdGFnZU5hbWV9LyovQGNvbm5lY3Rpb25zLypgLFxyXG4gICAgICAgIF0sXHJcbiAgICAgIH0pXHJcbiAgICApO1xyXG5cclxuICAgIC8vIEFsbG93IElvVCB0byBpbnZva2UgdGhpcyBMYW1iZGEgKHJ1bGUtcmVzdHJpY3RlZCBiZWxvdylcclxuICAgIHRlbGVtZXRyeUluZ2VzdEZuLmFkZFBlcm1pc3Npb24oXCJBbGxvd0lvdEludm9rZVwiLCB7XHJcbiAgICAgIHByaW5jaXBhbDogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKFwiaW90LmFtYXpvbmF3cy5jb21cIiksXHJcbiAgICAgIGFjdGlvbjogXCJsYW1iZGE6SW52b2tlRnVuY3Rpb25cIixcclxuICAgICAgc291cmNlQWNjb3VudDogdGhpcy5hY2NvdW50LFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICAvLyA1KSBJb1QgUnVsZTogdHJpZ2dlciB0ZWxlbWV0cnlJbmdlc3RGbiBvbiB0ZWxlbWV0cnkgdG9waWNzXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIGNvbnN0IHRlbGVtZXRyeVJ1bGUgPSBuZXcgaW90LkNmblRvcGljUnVsZSh0aGlzLCBcIkRldmljZVRlbGVtZXRyeVJ1bGVcIiwge1xyXG4gICAgICB0b3BpY1J1bGVQYXlsb2FkOiB7XHJcbiAgICAgICAgc3FsOiBcIlNFTEVDVCAqIEZST00gJ2RldmljZXMvKy90ZWxlbWV0cnknXCIsXHJcbiAgICAgICAgYWN0aW9uczogW1xyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICBsYW1iZGE6IHtcclxuICAgICAgICAgICAgICBmdW5jdGlvbkFybjogdGVsZW1ldHJ5SW5nZXN0Rm4uZnVuY3Rpb25Bcm4sXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgcnVsZURpc2FibGVkOiBmYWxzZSxcclxuICAgICAgICBhd3NJb3RTcWxWZXJzaW9uOiBcIjIwMTYtMDMtMjNcIixcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIHRlbGVtZXRyeUluZ2VzdEZuLmFkZFBlcm1pc3Npb24oXCJBbGxvd0lvdEludm9rZUZyb21SdWxlXCIsIHtcclxuICAgICAgcHJpbmNpcGFsOiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoXCJpb3QuYW1hem9uYXdzLmNvbVwiKSxcclxuICAgICAgYWN0aW9uOiBcImxhbWJkYTpJbnZva2VGdW5jdGlvblwiLFxyXG4gICAgICBzb3VyY2VBcm46IHRlbGVtZXRyeVJ1bGUuYXR0ckFybixcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgLy8gNikgT3V0cHV0cyBmb3IgZGV2aWNlcyAodGhpbmdzKVxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICBkZXZpY2VzLmZvckVhY2goKGRldmljZSkgPT4ge1xyXG4gICAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBgVGhpbmdOYW1lLSR7ZGV2aWNlLm5hbWV9YCwge1xyXG4gICAgICAgIHZhbHVlOiBkZXZpY2UubmFtZSxcclxuICAgICAgICBkZXNjcmlwdGlvbjogYElvVCBUaGluZyBmb3IgZGV2aWNlICR7ZGV2aWNlLm5hbWV9YCxcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcbn1cclxuIl19