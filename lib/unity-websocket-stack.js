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
exports.UnityWebSocketStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const aws_lambda_nodejs_1 = require("aws-cdk-lib/aws-lambda-nodejs");
const path = __importStar(require("path"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
// WebSocket API v2 (alpha module)
const apigwv2 = __importStar(require("@aws-cdk/aws-apigatewayv2-alpha"));
const integrations = __importStar(require("@aws-cdk/aws-apigatewayv2-integrations-alpha"));
class UnityWebSocketStack extends cdk.Stack {
    connectionsTable;
    webSocketApi;
    stage;
    // Convenience: HTTPS management endpoint for other Lambdas
    managementEndpoint;
    constructor(scope, id, props) {
        super(scope, id, props);
        // 1) Connections table
        this.connectionsTable = new dynamodb.Table(this, "WsConnectionsTable", {
            partitionKey: { name: "connectionId", type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY, // change to RETAIN in prod
        });
        // 2) Lambda: $connect
        const connectFn = new aws_lambda_nodejs_1.NodejsFunction(this, "WsConnectHandler", {
            runtime: lambda.Runtime.NODEJS_18_X,
            entry: path.join(__dirname, "../lambda/ws-connect.ts"),
            handler: "handler",
            bundling: { target: "node18", minify: true, sourceMap: false },
            environment: {
                CONNECTIONS_TABLE: this.connectionsTable.tableName,
            },
        });
        // 3) Lambda: $disconnect
        const disconnectFn = new aws_lambda_nodejs_1.NodejsFunction(this, "WsDisconnectHandler", {
            runtime: lambda.Runtime.NODEJS_18_X,
            entry: path.join(__dirname, "../lambda/ws-disconnect.ts"),
            handler: "handler",
            bundling: { target: "node18", minify: true, sourceMap: false },
            environment: {
                CONNECTIONS_TABLE: this.connectionsTable.tableName,
            },
        });
        // 4) Lambda: default route (optional, for messages from clients)
        const defaultFn = new aws_lambda_nodejs_1.NodejsFunction(this, "WsDefaultHandler", {
            runtime: lambda.Runtime.NODEJS_18_X,
            entry: path.join(__dirname, "../lambda/ws-default.ts"),
            handler: "handler",
            bundling: { target: "node18", minify: true, sourceMap: false },
            environment: {
                CONNECTIONS_TABLE: this.connectionsTable.tableName,
            },
        });
        this.connectionsTable.grantReadWriteData(connectFn);
        this.connectionsTable.grantReadWriteData(disconnectFn);
        this.connectionsTable.grantReadWriteData(defaultFn);
        // 5) WebSocket API
        this.webSocketApi = new apigwv2.WebSocketApi(this, "UnityWebSocketApi", {
            apiName: "unity-realtime-api",
            connectRouteOptions: {
                integration: new integrations.WebSocketLambdaIntegration("ConnectIntegration", connectFn),
            },
            disconnectRouteOptions: {
                integration: new integrations.WebSocketLambdaIntegration("DisconnectIntegration", disconnectFn),
            },
            defaultRouteOptions: {
                integration: new integrations.WebSocketLambdaIntegration("DefaultIntegration", defaultFn),
            },
        });
        // 6) Stage
        this.stage = new apigwv2.WebSocketStage(this, "UnityWsStage", {
            webSocketApi: this.webSocketApi,
            stageName: "dev",
            autoDeploy: true,
        });
        // Management endpoint used by other Lambdas (HTTPS, not wss)
        this.managementEndpoint = `https://${this.webSocketApi.apiId}.execute-api.${this.region}.amazonaws.com/${this.stage.stageName}`;
        new cdk.CfnOutput(this, "UnityWebSocketWssUrl", {
            value: this.stage.url, // wss://.../dev
            description: "WebSocket URL for frontend / Unity",
        });
        new cdk.CfnOutput(this, "UnityWebSocketManagementEndpoint", {
            value: this.managementEndpoint,
            description: "HTTPS endpoint for ApiGatewayManagementApi client",
        });
        // 7) Allow broadcasting Lambdas (later) to use the management API
        const mgmtPolicy = new iam.PolicyStatement({
            actions: ["execute-api:ManageConnections"],
            resources: [
                `arn:aws:execute-api:${this.region}:${this.account}:${this.webSocketApi.apiId}/${this.stage.stageName}/*/@connections/*`,
            ],
        });
        connectFn.addToRolePolicy(mgmtPolicy);
        disconnectFn.addToRolePolicy(mgmtPolicy);
        defaultFn.addToRolePolicy(mgmtPolicy);
    }
}
exports.UnityWebSocketStack = UnityWebSocketStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidW5pdHktd2Vic29ja2V0LXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidW5pdHktd2Vic29ja2V0LXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBRW5DLG1FQUFxRDtBQUNyRCwrREFBaUQ7QUFDakQscUVBQStEO0FBQy9ELDJDQUE2QjtBQUM3Qix5REFBMkM7QUFFM0Msa0NBQWtDO0FBQ2xDLHlFQUEyRDtBQUMzRCwyRkFBNkU7QUFFN0UsTUFBYSxtQkFBb0IsU0FBUSxHQUFHLENBQUMsS0FBSztJQUNoQyxnQkFBZ0IsQ0FBaUI7SUFDakMsWUFBWSxDQUF1QjtJQUNuQyxLQUFLLENBQXlCO0lBRTlDLDJEQUEyRDtJQUMzQyxrQkFBa0IsQ0FBUztJQUUzQyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXNCO1FBQzlELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLHVCQUF1QjtRQUN2QixJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxvQkFBb0IsRUFBRTtZQUNyRSxZQUFZLEVBQUUsRUFBRSxJQUFJLEVBQUUsY0FBYyxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtZQUMzRSxXQUFXLEVBQUUsUUFBUSxDQUFDLFdBQVcsQ0FBQyxlQUFlO1lBQ2pELGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU8sRUFBRSwyQkFBMkI7U0FDdEUsQ0FBQyxDQUFDO1FBRUgsc0JBQXNCO1FBQ3RCLE1BQU0sU0FBUyxHQUFHLElBQUksa0NBQWMsQ0FBQyxJQUFJLEVBQUUsa0JBQWtCLEVBQUU7WUFDN0QsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNuQyxLQUFLLEVBQUUsSUFBSSxDQUFDLElBQUks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QyxTQUFTLENBQUMsSUFBSSxFQUFFLHNCQUFzQixFQUFFO1lBQzlDLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxnQkFBZ0I7WUFDdkMsV0FBVyxFQUFFLG9DQUFvQztTQUNsRCxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGtDQUFrQyxFQUFFO1lBQzFELEtBQUssRUFBRSxJQUFJLENBQUMsa0JBQWtCO1lBQzlCLFdBQVcsRUFBRSxtREFBbUQ7U0FDakUsQ0FBQyxDQUFDO1FBRUgsa0VBQWtFO1FBQ2xFLE1BQU0sVUFBVSxHQUFHLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztZQUN6QyxPQUFPLEVBQUUsQ0FBQywrQkFBK0IsQ0FBQztZQUMxQyxTQUFTLEVBQUU7Z0JBQ1QsdUJBQXVCLElBQUksQ0FBQyxNQUFNLElBQUksSUFBSSxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsbUJBQW1CO2FBQ3pIO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsU0FBUyxDQUFDLGVBQWUsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUN0QyxZQUFZLENBQUMsZUFBZSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3pDLFNBQVMsQ0FBQyxlQUFlLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDeEMsQ0FBQztDQUNGO0FBOUdELGtEQThHQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tIFwiYXdzLWNkay1saWJcIjtcclxuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSBcImNvbnN0cnVjdHNcIjtcclxuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSBcImF3cy1jZGstbGliL2F3cy1keW5hbW9kYlwiO1xyXG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSBcImF3cy1jZGstbGliL2F3cy1sYW1iZGFcIjtcclxuaW1wb3J0IHsgTm9kZWpzRnVuY3Rpb24gfSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWxhbWJkYS1ub2RlanNcIjtcclxuaW1wb3J0ICogYXMgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5pbXBvcnQgKiBhcyBpYW0gZnJvbSBcImF3cy1jZGstbGliL2F3cy1pYW1cIjtcclxuXHJcbi8vIFdlYlNvY2tldCBBUEkgdjIgKGFscGhhIG1vZHVsZSlcclxuaW1wb3J0ICogYXMgYXBpZ3d2MiBmcm9tIFwiQGF3cy1jZGsvYXdzLWFwaWdhdGV3YXl2Mi1hbHBoYVwiO1xyXG5pbXBvcnQgKiBhcyBpbnRlZ3JhdGlvbnMgZnJvbSBcIkBhd3MtY2RrL2F3cy1hcGlnYXRld2F5djItaW50ZWdyYXRpb25zLWFscGhhXCI7XHJcblxyXG5leHBvcnQgY2xhc3MgVW5pdHlXZWJTb2NrZXRTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XHJcbiAgcHVibGljIHJlYWRvbmx5IGNvbm5lY3Rpb25zVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xyXG4gIHB1YmxpYyByZWFkb25seSB3ZWJTb2NrZXRBcGk6IGFwaWd3djIuV2ViU29ja2V0QXBpO1xyXG4gIHB1YmxpYyByZWFkb25seSBzdGFnZTogYXBpZ3d2Mi5XZWJTb2NrZXRTdGFnZTtcclxuXHJcbiAgLy8gQ29udmVuaWVuY2U6IEhUVFBTIG1hbmFnZW1lbnQgZW5kcG9pbnQgZm9yIG90aGVyIExhbWJkYXNcclxuICBwdWJsaWMgcmVhZG9ubHkgbWFuYWdlbWVudEVuZHBvaW50OiBzdHJpbmc7XHJcblxyXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcclxuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xyXG5cclxuICAgIC8vIDEpIENvbm5lY3Rpb25zIHRhYmxlXHJcbiAgICB0aGlzLmNvbm5lY3Rpb25zVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgXCJXc0Nvbm5lY3Rpb25zVGFibGVcIiwge1xyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogXCJjb25uZWN0aW9uSWRcIiwgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSwgLy8gY2hhbmdlIHRvIFJFVEFJTiBpbiBwcm9kXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyAyKSBMYW1iZGE6ICRjb25uZWN0XHJcbiAgICBjb25zdCBjb25uZWN0Rm4gPSBuZXcgTm9kZWpzRnVuY3Rpb24odGhpcywgXCJXc0Nvbm5lY3RIYW5kbGVyXCIsIHtcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXHJcbiAgICAgIGVudHJ5OiBwYXRoLmpvaW4oX19kaXJuYW1lLCBcIi4uL2xhbWJkYS93cy1jb25uZWN0LnRzXCIpLFxyXG4gICAgICBoYW5kbGVyOiBcImhhbmRsZXJcIixcclxuICAgICAgYnVuZGxpbmc6IHsgdGFyZ2V0OiBcIm5vZGUxOFwiLCBtaW5pZnk6IHRydWUsIHNvdXJjZU1hcDogZmFsc2UgfSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICBDT05ORUNUSU9OU19UQUJMRTogdGhpcy5jb25uZWN0aW9uc1RhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIDMpIExhbWJkYTogJGRpc2Nvbm5lY3RcclxuICAgIGNvbnN0IGRpc2Nvbm5lY3RGbiA9IG5ldyBOb2RlanNGdW5jdGlvbih0aGlzLCBcIldzRGlzY29ubmVjdEhhbmRsZXJcIiwge1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICAgICAgZW50cnk6IHBhdGguam9pbihfX2Rpcm5hbWUsIFwiLi4vbGFtYmRhL3dzLWRpc2Nvbm5lY3QudHNcIiksXHJcbiAgICAgIGhhbmRsZXI6IFwiaGFuZGxlclwiLFxyXG4gICAgICBidW5kbGluZzogeyB0YXJnZXQ6IFwibm9kZTE4XCIsIG1pbmlmeTogdHJ1ZSwgc291cmNlTWFwOiBmYWxzZSB9LFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIENPTk5FQ1RJT05TX1RBQkxFOiB0aGlzLmNvbm5lY3Rpb25zVGFibGUudGFibGVOYW1lLFxyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gNCkgTGFtYmRhOiBkZWZhdWx0IHJvdXRlIChvcHRpb25hbCwgZm9yIG1lc3NhZ2VzIGZyb20gY2xpZW50cylcclxuICAgIGNvbnN0IGRlZmF1bHRGbiA9IG5ldyBOb2RlanNGdW5jdGlvbih0aGlzLCBcIldzRGVmYXVsdEhhbmRsZXJcIiwge1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICAgICAgZW50cnk6IHBhdGguam9pbihfX2Rpcm5hbWUsIFwiLi4vbGFtYmRhL3dzLWRlZmF1bHQudHNcIiksXHJcbiAgICAgIGhhbmRsZXI6IFwiaGFuZGxlclwiLFxyXG4gICAgICBidW5kbGluZzogeyB0YXJnZXQ6IFwibm9kZTE4XCIsIG1pbmlmeTogdHJ1ZSwgc291cmNlTWFwOiBmYWxzZSB9LFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIENPTk5FQ1RJT05TX1RBQkxFOiB0aGlzLmNvbm5lY3Rpb25zVGFibGUudGFibGVOYW1lLFxyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5jb25uZWN0aW9uc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShjb25uZWN0Rm4pO1xyXG4gICAgdGhpcy5jb25uZWN0aW9uc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShkaXNjb25uZWN0Rm4pO1xyXG4gICAgdGhpcy5jb25uZWN0aW9uc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShkZWZhdWx0Rm4pO1xyXG5cclxuICAgIC8vIDUpIFdlYlNvY2tldCBBUElcclxuICAgIHRoaXMud2ViU29ja2V0QXBpID0gbmV3IGFwaWd3djIuV2ViU29ja2V0QXBpKHRoaXMsIFwiVW5pdHlXZWJTb2NrZXRBcGlcIiwge1xyXG4gICAgICBhcGlOYW1lOiBcInVuaXR5LXJlYWx0aW1lLWFwaVwiLFxyXG4gICAgICBjb25uZWN0Um91dGVPcHRpb25zOiB7XHJcbiAgICAgICAgaW50ZWdyYXRpb246IG5ldyBpbnRlZ3JhdGlvbnMuV2ViU29ja2V0TGFtYmRhSW50ZWdyYXRpb24oXHJcbiAgICAgICAgICBcIkNvbm5lY3RJbnRlZ3JhdGlvblwiLFxyXG4gICAgICAgICAgY29ubmVjdEZuXHJcbiAgICAgICAgKSxcclxuICAgICAgfSxcclxuICAgICAgZGlzY29ubmVjdFJvdXRlT3B0aW9uczoge1xyXG4gICAgICAgIGludGVncmF0aW9uOiBuZXcgaW50ZWdyYXRpb25zLldlYlNvY2tldExhbWJkYUludGVncmF0aW9uKFxyXG4gICAgICAgICAgXCJEaXNjb25uZWN0SW50ZWdyYXRpb25cIixcclxuICAgICAgICAgIGRpc2Nvbm5lY3RGblxyXG4gICAgICAgICksXHJcbiAgICAgIH0sXHJcbiAgICAgIGRlZmF1bHRSb3V0ZU9wdGlvbnM6IHtcclxuICAgICAgICBpbnRlZ3JhdGlvbjogbmV3IGludGVncmF0aW9ucy5XZWJTb2NrZXRMYW1iZGFJbnRlZ3JhdGlvbihcclxuICAgICAgICAgIFwiRGVmYXVsdEludGVncmF0aW9uXCIsXHJcbiAgICAgICAgICBkZWZhdWx0Rm5cclxuICAgICAgICApLFxyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gNikgU3RhZ2VcclxuICAgIHRoaXMuc3RhZ2UgPSBuZXcgYXBpZ3d2Mi5XZWJTb2NrZXRTdGFnZSh0aGlzLCBcIlVuaXR5V3NTdGFnZVwiLCB7XHJcbiAgICAgIHdlYlNvY2tldEFwaTogdGhpcy53ZWJTb2NrZXRBcGksXHJcbiAgICAgIHN0YWdlTmFtZTogXCJkZXZcIixcclxuICAgICAgYXV0b0RlcGxveTogdHJ1ZSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIE1hbmFnZW1lbnQgZW5kcG9pbnQgdXNlZCBieSBvdGhlciBMYW1iZGFzIChIVFRQUywgbm90IHdzcylcclxuICAgIHRoaXMubWFuYWdlbWVudEVuZHBvaW50ID0gYGh0dHBzOi8vJHt0aGlzLndlYlNvY2tldEFwaS5hcGlJZH0uZXhlY3V0ZS1hcGkuJHt0aGlzLnJlZ2lvbn0uYW1hem9uYXdzLmNvbS8ke3RoaXMuc3RhZ2Uuc3RhZ2VOYW1lfWA7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJVbml0eVdlYlNvY2tldFdzc1VybFwiLCB7XHJcbiAgICAgIHZhbHVlOiB0aGlzLnN0YWdlLnVybCwgLy8gd3NzOi8vLi4uL2RldlxyXG4gICAgICBkZXNjcmlwdGlvbjogXCJXZWJTb2NrZXQgVVJMIGZvciBmcm9udGVuZCAvIFVuaXR5XCIsXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIlVuaXR5V2ViU29ja2V0TWFuYWdlbWVudEVuZHBvaW50XCIsIHtcclxuICAgICAgdmFsdWU6IHRoaXMubWFuYWdlbWVudEVuZHBvaW50LFxyXG4gICAgICBkZXNjcmlwdGlvbjogXCJIVFRQUyBlbmRwb2ludCBmb3IgQXBpR2F0ZXdheU1hbmFnZW1lbnRBcGkgY2xpZW50XCIsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA3KSBBbGxvdyBicm9hZGNhc3RpbmcgTGFtYmRhcyAobGF0ZXIpIHRvIHVzZSB0aGUgbWFuYWdlbWVudCBBUElcclxuICAgIGNvbnN0IG1nbXRQb2xpY3kgPSBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgIGFjdGlvbnM6IFtcImV4ZWN1dGUtYXBpOk1hbmFnZUNvbm5lY3Rpb25zXCJdLFxyXG4gICAgICByZXNvdXJjZXM6IFtcclxuICAgICAgICBgYXJuOmF3czpleGVjdXRlLWFwaToke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06JHt0aGlzLndlYlNvY2tldEFwaS5hcGlJZH0vJHt0aGlzLnN0YWdlLnN0YWdlTmFtZX0vKi9AY29ubmVjdGlvbnMvKmAsXHJcbiAgICAgIF0sXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25uZWN0Rm4uYWRkVG9Sb2xlUG9saWN5KG1nbXRQb2xpY3kpO1xyXG4gICAgZGlzY29ubmVjdEZuLmFkZFRvUm9sZVBvbGljeShtZ210UG9saWN5KTtcclxuICAgIGRlZmF1bHRGbi5hZGRUb1JvbGVQb2xpY3kobWdtdFBvbGljeSk7XHJcbiAgfVxyXG59XHJcbiJdfQ==