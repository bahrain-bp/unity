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
        const prefixname = this.stackName.split('-')[0].toLowerCase(); // ✅ Add this
        const { dbStack, wsStack } = props;
        // Ensure DBStack and WebSocketStack are created before IoTStack
        this.addDependency(dbStack);
        this.addDependency(wsStack);
        // ────────────────────────────────
        //  X-RAY HELPER
        // ────────────────────────────────
        const enableXRay = (fn) => {
            fn.role?.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("AWSXRayDaemonWriteAccess"));
        };
        // ────────────────────────────────
        // 0) Device list
        // ────────────────────────────────
        const devices = [
            { name: "pi3-01", sensors: ["temp_c", "humidity"] },
            { name: "pico-01", sensors: ["distance_cm"] },
            { name: "pico-02", sensors: ["distance_cm"] },
            { name: "esp32-01", sensors: ["distance_cm"] },
            { name: "esp32-02", sensors: ["status"] }, // pir sensor
        ];
        // ────────────────────────────────
        // 1) IoT Things
        // ────────────────────────────────
        const thingMap = {};
        for (const device of devices) {
            const thing = new iot.CfnThing(this, `Thing-${device.name}`, {
                thingName: `${prefixname}-${device.name}`,
            });
            thingMap[device.name] = thing;
        }
        // ────────────────────────────────
        // 2) Shared IoT Policy
        // ────────────────────────────────
        const iotPolicy = new iot.CfnPolicy(this, "DeviceTelemetryPolicy", {
            policyName: `${prefixname}-DeviceTelemetryPolicy`,
            policyDocument: {
                Version: "2012-10-17",
                Statement: [
                    {
                        Effect: "Allow",
                        Action: ["iot:Connect"],
                        Resource: [`arn:aws:iot:${this.region}:${this.account}:client/\${iot:ClientId}`],
                    },
                    {
                        Effect: "Allow",
                        Action: ["iot:Publish", "iot:Receive"],
                        Resource: [`arn:aws:iot:${this.region}:${this.account}:topic/devices/\${iot:ClientId}/*`],
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
            // ✅ X-Ray: enable tracing for this lambda
            tracing: lambda.Tracing.ACTIVE,
        });
        // ✅ X-Ray: allow publishing traces
        enableXRay(telemetryIngestFn);
        telemetryTable.grantReadWriteData(telemetryIngestFn);
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
            new cdk.CfnOutput(this, `${prefixname}-ThingName-${device.name}`, {
                value: `${prefixname}-${device.name}`,
                description: `IoT Thing for device ${device.name}`,
            });
        });
    }
}
exports.IoTStack = IoTStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSW9UU3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJJb1RTdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUVuQyx5REFBMkM7QUFFM0MsK0RBQWlEO0FBQ2pELHlEQUEyQztBQUMzQyxxRUFBK0Q7QUFDL0QsMkNBQTZCO0FBYzdCLE1BQWEsUUFBUyxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3JDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBb0I7UUFDNUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBRSxhQUFhO1FBRTdFLE1BQU0sRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLEdBQUcsS0FBSyxDQUFDO1FBRW5DLGdFQUFnRTtRQUNoRSxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQzVCLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFNUIsbUNBQW1DO1FBQ25DLGdCQUFnQjtRQUNoQixtQ0FBbUM7UUFDbkMsTUFBTSxVQUFVLEdBQUcsQ0FBQyxFQUFtQixFQUFFLEVBQUU7WUFDekMsRUFBRSxDQUFDLElBQUksRUFBRSxnQkFBZ0IsQ0FDdkIsR0FBRyxDQUFDLGFBQWEsQ0FBQyx3QkFBd0IsQ0FBQywwQkFBMEIsQ0FBQyxDQUN2RSxDQUFDO1FBQ0osQ0FBQyxDQUFDO1FBRUYsbUNBQW1DO1FBQ25DLGlCQUFpQjtRQUNqQixtQ0FBbUM7UUFDbkMsTUFBTSxPQUFPLEdBQW1CO1lBQzlCLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsQ0FBQyxRQUFRLEVBQUUsVUFBVSxDQUFDLEVBQUU7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LEVBQUU7b0JBQ1A7d0JBQ0UsTUFBTSxFQUFFOzRCQUNOLFdBQVcsRUFBRSxpQkFBaUIsQ0FBQyxXQUFXO3lCQUMzQztxQkFDRjtpQkFDRjtnQkFDRCxZQUFZLEVBQUUsS0FBSztnQkFDbkIsZ0JBQWdCLEVBQUUsWUFBWTthQUMvQjtTQUNGLENBQUMsQ0FBQztRQUVILGlCQUFpQixDQUFDLGFBQWEsQ0FBQyx3QkFBd0IsRUFBRTtZQUN4RCxTQUFTLEVBQUUsSUFBSSxHQUFHLENBQUMsZ0JBQWdCLENBQUMsbUJBQW1CLENBQUM7WUFDeEQsTUFBTSxFQUFFLHVCQUF1QjtZQUMvQixTQUFTLEVBQUUsYUFBYSxDQUFDLE9BQU87U0FDakMsQ0FBQyxDQUFDO1FBRUgsbUNBQW1DO1FBQ25DLGtDQUFrQztRQUNsQyxtQ0FBbUM7UUFDbkMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFO1lBQ3pCLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsR0FBRyxVQUFVLGNBQWMsTUFBTSxDQUFDLElBQUksRUFBRSxFQUFFO2dCQUNoRSxLQUFLLEVBQUUsR0FBRyxVQUFVLElBQUksTUFBTSxDQUFDLElBQUksRUFBRTtnQkFDckMsV0FBVyxFQUFFLHdCQUF3QixNQUFNLENBQUMsSUFBSSxFQUFFO2FBQ25ELENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBbEtELDRCQWtLQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tIFwiYXdzLWNkay1saWJcIjtcclxuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSBcImNvbnN0cnVjdHNcIjtcclxuaW1wb3J0ICogYXMgaW90IGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtaW90XCI7XHJcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGJcIjtcclxuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtbGFtYmRhXCI7XHJcbmltcG9ydCAqIGFzIGlhbSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWlhbVwiO1xyXG5pbXBvcnQgeyBOb2RlanNGdW5jdGlvbiB9IGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtbGFtYmRhLW5vZGVqc1wiO1xyXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gXCJwYXRoXCI7XHJcbmltcG9ydCB7IERCU3RhY2sgfSBmcm9tIFwiLi9EQnN0YWNrXCI7XHJcbmltcG9ydCB7IFVuaXR5V2ViU29ja2V0U3RhY2sgfSBmcm9tIFwiLi91bml0eS13ZWJzb2NrZXQtc3RhY2tcIjtcclxuXHJcbmludGVyZmFjZSBJb1RTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xyXG4gIGRiU3RhY2s6IERCU3RhY2s7XHJcbiAgd3NTdGFjazogVW5pdHlXZWJTb2NrZXRTdGFjaztcclxufVxyXG5cclxuaW50ZXJmYWNlIERldmljZUNvbmZpZyB7XHJcbiAgbmFtZTogc3RyaW5nO1xyXG4gIHNlbnNvcnM6IHN0cmluZ1tdO1xyXG59XHJcblxyXG5leHBvcnQgY2xhc3MgSW9UU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xyXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBJb1RTdGFja1Byb3BzKSB7XHJcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcclxuXHJcbiAgICBjb25zdCBwcmVmaXhuYW1lID0gdGhpcy5zdGFja05hbWUuc3BsaXQoJy0nKVswXS50b0xvd2VyQ2FzZSgpOyAgLy8g4pyFIEFkZCB0aGlzXHJcblxyXG4gICAgY29uc3QgeyBkYlN0YWNrLCB3c1N0YWNrIH0gPSBwcm9wcztcclxuXHJcbiAgICAvLyBFbnN1cmUgREJTdGFjayBhbmQgV2ViU29ja2V0U3RhY2sgYXJlIGNyZWF0ZWQgYmVmb3JlIElvVFN0YWNrXHJcbiAgICB0aGlzLmFkZERlcGVuZGVuY3koZGJTdGFjayk7XHJcbiAgICB0aGlzLmFkZERlcGVuZGVuY3kod3NTdGFjayk7XHJcblxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICAvLyAgWC1SQVkgSEVMUEVSXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIGNvbnN0IGVuYWJsZVhSYXkgPSAoZm46IGxhbWJkYS5GdW5jdGlvbikgPT4ge1xyXG4gICAgICBmbi5yb2xlPy5hZGRNYW5hZ2VkUG9saWN5KFxyXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZShcIkFXU1hSYXlEYWVtb25Xcml0ZUFjY2Vzc1wiKVxyXG4gICAgICApO1xyXG4gICAgfTtcclxuXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIC8vIDApIERldmljZSBsaXN0XHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIGNvbnN0IGRldmljZXM6IERldmljZUNvbmZpZ1tdID0gW1xyXG4gICAgICB7IG5hbWU6IFwicGkzLTAxXCIsIHNlbnNvcnM6IFtcInRlbXBfY1wiLCBcImh1bWlkaXR5XCJdIH0sXHJcbiAgICAgIHsgbmFtZTogXCJwaWNvLTAxXCIsIHNlbnNvcnM6IFtcImRpc3RhbmNlX2NtXCJdIH0sXHJcbiAgICAgIHsgbmFtZTogXCJwaWNvLTAyXCIsIHNlbnNvcnM6IFtcImRpc3RhbmNlX2NtXCJdIH0sXHJcbiAgICAgIHsgbmFtZTogXCJlc3AzMi0wMVwiLCBzZW5zb3JzOiBbXCJkaXN0YW5jZV9jbVwiXSB9LFxyXG4gICAgICB7IG5hbWU6IFwiZXNwMzItMDJcIiwgc2Vuc29yczogW1wic3RhdHVzXCJdIH0sIC8vIHBpciBzZW5zb3JcclxuICAgIF07XHJcblxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICAvLyAxKSBJb1QgVGhpbmdzXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIGNvbnN0IHRoaW5nTWFwOiBSZWNvcmQ8c3RyaW5nLCBpb3QuQ2ZuVGhpbmc+ID0ge307XHJcblxyXG4gICAgZm9yIChjb25zdCBkZXZpY2Ugb2YgZGV2aWNlcykge1xyXG4gICAgICBjb25zdCB0aGluZyA9IG5ldyBpb3QuQ2ZuVGhpbmcodGhpcywgYFRoaW5nLSR7ZGV2aWNlLm5hbWV9YCwge1xyXG4gICAgICAgIHRoaW5nTmFtZTogYCR7cHJlZml4bmFtZX0tJHtkZXZpY2UubmFtZX1gLFxyXG4gICAgICB9KTtcclxuICAgICAgdGhpbmdNYXBbZGV2aWNlLm5hbWVdID0gdGhpbmc7XHJcbiAgICB9XHJcblxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICAvLyAyKSBTaGFyZWQgSW9UIFBvbGljeVxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICBjb25zdCBpb3RQb2xpY3kgPSBuZXcgaW90LkNmblBvbGljeSh0aGlzLCBcIkRldmljZVRlbGVtZXRyeVBvbGljeVwiLCB7XHJcbiAgICAgIHBvbGljeU5hbWU6IGAke3ByZWZpeG5hbWV9LURldmljZVRlbGVtZXRyeVBvbGljeWAsXHJcbiAgICAgIHBvbGljeURvY3VtZW50OiB7XHJcbiAgICAgICAgVmVyc2lvbjogXCIyMDEyLTEwLTE3XCIsXHJcbiAgICAgICAgU3RhdGVtZW50OiBbXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIEVmZmVjdDogXCJBbGxvd1wiLFxyXG4gICAgICAgICAgICBBY3Rpb246IFtcImlvdDpDb25uZWN0XCJdLFxyXG4gICAgICAgICAgICBSZXNvdXJjZTogW2Bhcm46YXdzOmlvdDoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06Y2xpZW50L1xcJHtpb3Q6Q2xpZW50SWR9YF0sXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICBFZmZlY3Q6IFwiQWxsb3dcIixcclxuICAgICAgICAgICAgQWN0aW9uOiBbXCJpb3Q6UHVibGlzaFwiLCBcImlvdDpSZWNlaXZlXCJdLFxyXG4gICAgICAgICAgICBSZXNvdXJjZTogW2Bhcm46YXdzOmlvdDoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06dG9waWMvZGV2aWNlcy9cXCR7aW90OkNsaWVudElkfS8qYF0sXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICBFZmZlY3Q6IFwiQWxsb3dcIixcclxuICAgICAgICAgICAgQWN0aW9uOiBbXCJpb3Q6U3Vic2NyaWJlXCJdLFxyXG4gICAgICAgICAgICBSZXNvdXJjZTogW1xyXG4gICAgICAgICAgICAgIGBhcm46YXdzOmlvdDoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06dG9waWNmaWx0ZXIvZGV2aWNlcy9cXCR7aW90OkNsaWVudElkfS8qYCxcclxuICAgICAgICAgICAgXSxcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgXSxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiSW9UUG9saWN5TmFtZVwiLCB7XHJcbiAgICAgIHZhbHVlOiBpb3RQb2xpY3kucG9saWN5TmFtZSEsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlNoYXJlZCBJb1QgcG9saWN5IGZvciBhbGwgZGV2aWNlc1wiLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICAvLyAzKSBVc2UgdGVsZW1ldHJ5IHRhYmxlIGZyb20gREJTdGFja1xyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICBjb25zdCB0ZWxlbWV0cnlUYWJsZTogZHluYW1vZGIuVGFibGUgPSBkYlN0YWNrLmlvdFRlbGVtZXRyeVRhYmxlO1xyXG5cclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgLy8gNCkgTGFtYmRhOiBpbmdlc3QgdGVsZW1ldHJ5IGZyb20gSW9UIENvcmUg4oaSIER5bmFtb0RCICsgV2ViU29ja2V0IGJyb2FkY2FzdFxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICBjb25zdCB0ZWxlbWV0cnlJbmdlc3RGbiA9IG5ldyBOb2RlanNGdW5jdGlvbih0aGlzLCBcIlRlbGVtZXRyeUluZ2VzdEhhbmRsZXJcIiwge1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICAgICAgZW50cnk6IHBhdGguam9pbihfX2Rpcm5hbWUsIFwiLi4vbGFtYmRhL3RlbGVtZXRyeS1pbmdlc3QudHNcIiksXHJcbiAgICAgIGhhbmRsZXI6IFwiaGFuZGxlclwiLFxyXG4gICAgICBidW5kbGluZzoge1xyXG4gICAgICAgIHRhcmdldDogXCJub2RlMThcIixcclxuICAgICAgICBtaW5pZnk6IHRydWUsXHJcbiAgICAgICAgc291cmNlTWFwOiBmYWxzZSxcclxuICAgICAgfSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICBURUxFTUVUUllfVEFCTEU6IHRlbGVtZXRyeVRhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgICBXU19DT05ORUNUSU9OU19UQUJMRTogd3NTdGFjay5jb25uZWN0aW9uc1RhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgICBXU19NQU5BR0VNRU5UX0VORFBPSU5UOiB3c1N0YWNrLm1hbmFnZW1lbnRFbmRwb2ludCxcclxuICAgICAgfSxcclxuICAgICAgLy8g4pyFIFgtUmF5OiBlbmFibGUgdHJhY2luZyBmb3IgdGhpcyBsYW1iZGFcclxuICAgICAgdHJhY2luZzogbGFtYmRhLlRyYWNpbmcuQUNUSVZFLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8g4pyFIFgtUmF5OiBhbGxvdyBwdWJsaXNoaW5nIHRyYWNlc1xyXG4gICAgZW5hYmxlWFJheSh0ZWxlbWV0cnlJbmdlc3RGbik7XHJcblxyXG4gICAgdGVsZW1ldHJ5VGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHRlbGVtZXRyeUluZ2VzdEZuKTtcclxuICAgIHdzU3RhY2suY29ubmVjdGlvbnNUYWJsZS5ncmFudFJlYWREYXRhKHRlbGVtZXRyeUluZ2VzdEZuKTtcclxuXHJcbiAgICAvLyBBbGxvdyBtYW5hZ2luZyBXZWJTb2NrZXQgY29ubmVjdGlvbnNcclxuICAgIHRlbGVtZXRyeUluZ2VzdEZuLmFkZFRvUm9sZVBvbGljeShcclxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICAgIGFjdGlvbnM6IFtcImV4ZWN1dGUtYXBpOk1hbmFnZUNvbm5lY3Rpb25zXCJdLFxyXG4gICAgICAgIHJlc291cmNlczogW1xyXG4gICAgICAgICAgYGFybjphd3M6ZXhlY3V0ZS1hcGk6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OmAgK1xyXG4gICAgICAgICAgICBgJHt3c1N0YWNrLndlYlNvY2tldEFwaS5hcGlJZH0vJHt3c1N0YWNrLnN0YWdlLnN0YWdlTmFtZX0vKi9AY29ubmVjdGlvbnMvKmAsXHJcbiAgICAgICAgXSxcclxuICAgICAgfSlcclxuICAgICk7XHJcblxyXG4gICAgLy8gQWxsb3cgSW9UIHRvIGludm9rZSB0aGlzIExhbWJkYSAocnVsZS1yZXN0cmljdGVkIGJlbG93KVxyXG4gICAgdGVsZW1ldHJ5SW5nZXN0Rm4uYWRkUGVybWlzc2lvbihcIkFsbG93SW90SW52b2tlXCIsIHtcclxuICAgICAgcHJpbmNpcGFsOiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoXCJpb3QuYW1hem9uYXdzLmNvbVwiKSxcclxuICAgICAgYWN0aW9uOiBcImxhbWJkYTpJbnZva2VGdW5jdGlvblwiLFxyXG4gICAgICBzb3VyY2VBY2NvdW50OiB0aGlzLmFjY291bnQsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIC8vIDUpIElvVCBSdWxlOiB0cmlnZ2VyIHRlbGVtZXRyeUluZ2VzdEZuIG9uIHRlbGVtZXRyeSB0b3BpY3NcclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgY29uc3QgdGVsZW1ldHJ5UnVsZSA9IG5ldyBpb3QuQ2ZuVG9waWNSdWxlKHRoaXMsIFwiRGV2aWNlVGVsZW1ldHJ5UnVsZVwiLCB7XHJcbiAgICAgIHRvcGljUnVsZVBheWxvYWQ6IHtcclxuICAgICAgICBzcWw6IFwiU0VMRUNUICogRlJPTSAnZGV2aWNlcy8rL3RlbGVtZXRyeSdcIixcclxuICAgICAgICBhY3Rpb25zOiBbXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIGxhbWJkYToge1xyXG4gICAgICAgICAgICAgIGZ1bmN0aW9uQXJuOiB0ZWxlbWV0cnlJbmdlc3RGbi5mdW5jdGlvbkFybixcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgXSxcclxuICAgICAgICBydWxlRGlzYWJsZWQ6IGZhbHNlLFxyXG4gICAgICAgIGF3c0lvdFNxbFZlcnNpb246IFwiMjAxNi0wMy0yM1wiLFxyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgdGVsZW1ldHJ5SW5nZXN0Rm4uYWRkUGVybWlzc2lvbihcIkFsbG93SW90SW52b2tlRnJvbVJ1bGVcIiwge1xyXG4gICAgICBwcmluY2lwYWw6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbChcImlvdC5hbWF6b25hd3MuY29tXCIpLFxyXG4gICAgICBhY3Rpb246IFwibGFtYmRhOkludm9rZUZ1bmN0aW9uXCIsXHJcbiAgICAgIHNvdXJjZUFybjogdGVsZW1ldHJ5UnVsZS5hdHRyQXJuLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICAvLyA2KSBPdXRwdXRzIGZvciBkZXZpY2VzICh0aGluZ3MpXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIGRldmljZXMuZm9yRWFjaCgoZGV2aWNlKSA9PiB7XHJcbiAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIGAke3ByZWZpeG5hbWV9LVRoaW5nTmFtZS0ke2RldmljZS5uYW1lfWAsIHtcclxuICAgICAgICB2YWx1ZTogYCR7cHJlZml4bmFtZX0tJHtkZXZpY2UubmFtZX1gLFxyXG4gICAgICAgIGRlc2NyaXB0aW9uOiBgSW9UIFRoaW5nIGZvciBkZXZpY2UgJHtkZXZpY2UubmFtZX1gLFxyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxufVxyXG4iXX0=