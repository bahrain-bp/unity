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
        const prefixname = this.stackName.split('-')[0].toLowerCase();
        const plugActionsTable = props.dbStack.plugActionsTable;
        // ────────────────────────────────
        // ✅ X-RAY HELPER
        // ────────────────────────────────
        const enableXRay = (fn) => {
            fn.role?.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("AWSXRayDaemonWriteAccess"));
        };
        // 1) Connections table
        this.connectionsTable = new dynamodb.Table(this, "WsConnectionsTable", {
            partitionKey: { name: "connectionId", type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY, // change to RETAIN in prod
        });
        // 2) Lambda: $connect  (ONLY save connection)
        const connectFn = new aws_lambda_nodejs_1.NodejsFunction(this, "WsConnectHandler", {
            runtime: lambda.Runtime.NODEJS_18_X,
            entry: path.join(__dirname, "../lambda/ws-connect.ts"),
            handler: "handler",
            bundling: { target: "node18", minify: true, sourceMap: false },
            environment: {
                CONNECTIONS_TABLE: this.connectionsTable.tableName,
            },
            // ✅ X-Ray
            tracing: lambda.Tracing.ACTIVE,
        });
        enableXRay(connectFn);
        // 3) Lambda: $disconnect
        const disconnectFn = new aws_lambda_nodejs_1.NodejsFunction(this, "WsDisconnectHandler", {
            runtime: lambda.Runtime.NODEJS_18_X,
            entry: path.join(__dirname, "../lambda/ws-disconnect.ts"),
            handler: "handler",
            bundling: { target: "node18", minify: true, sourceMap: false },
            environment: {
                CONNECTIONS_TABLE: this.connectionsTable.tableName,
            },
            // ✅ X-Ray
            tracing: lambda.Tracing.ACTIVE,
        });
        enableXRay(disconnectFn);
        // 4) Lambda: $default (handles hello/requestSnapshot -> sends plug_snapshot)
        const defaultFn = new aws_lambda_nodejs_1.NodejsFunction(this, "WsDefaultHandler", {
            runtime: lambda.Runtime.NODEJS_18_X,
            entry: path.join(__dirname, "../lambda/ws-default.ts"),
            handler: "handler",
            bundling: { target: "node18", minify: true, sourceMap: false },
            environment: {
                CONNECTIONS_TABLE: this.connectionsTable.tableName,
                // snapshot inputs (used by ws-default.ts)
                PLUG_ACTIONS_TABLE: plugActionsTable.tableName,
                PLUG_INDEX_NAME: "plug_id-ts-index",
                PLUG_IDS: JSON.stringify(["plug1", "plug2"]),
            },
            // ✅ X-Ray
            tracing: lambda.Tracing.ACTIVE,
        });
        enableXRay(defaultFn);
        // Permissions for connections table
        this.connectionsTable.grantReadWriteData(connectFn);
        this.connectionsTable.grantReadWriteData(disconnectFn);
        this.connectionsTable.grantReadWriteData(defaultFn);
        // defaultFn needs to read PlugActions to compute snapshot
        plugActionsTable.grantReadData(defaultFn);
        // 5) WebSocket API
        this.webSocketApi = new apigwv2.WebSocketApi(this, "UnityWebSocketApi", {
            apiName: `${prefixname}-unity-realtime-api`,
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
            stageName: `${prefixname}-dev`,
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
        // 7) Allow lambdas to use the management API (postToConnection)
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidW5pdHktd2Vic29ja2V0LXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidW5pdHktd2Vic29ja2V0LXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBRW5DLG1FQUFxRDtBQUNyRCwrREFBaUQ7QUFDakQscUVBQStEO0FBQy9ELDJDQUE2QjtBQUM3Qix5REFBMkM7QUFFM0Msa0NBQWtDO0FBQ2xDLHlFQUEyRDtBQUMzRCwyRkFBNkU7QUFTN0UsTUFBYSxtQkFBb0IsU0FBUSxHQUFHLENBQUMsS0FBSztJQUNoQyxnQkFBZ0IsQ0FBaUI7SUFDakMsWUFBWSxDQUF1QjtJQUNuQyxLQUFLLENBQXlCO0lBRTlDLDJEQUEyRDtJQUMzQyxrQkFBa0IsQ0FBUztJQUUzQyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQStCO1FBQ3ZFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQzlELE1BQU0sZ0JBQWdCLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQztRQUV4RCxtQ0FBbUM7UUFDbkMsaUJBQWlCO1FBQ2pCLG1DQUFtQztRQUNuQyxNQUFNLFVBQVUsR0FBRyxDQUFDLEVBQW1CLEVBQUUsRUFBRTtZQUN6QyxFQUFFLENBQUMsSUFBSSxFQUFFLGdCQUFnQixDQUN2QixHQUFHLENBQUMsYUFBYSxDQUFDLHdCQUF3QixDQUFDLDBCQUEwQixDQUFDLENBQ3ZFLENBQUM7UUFDSixDQUFDLENBQUM7UUFFRix1QkFBdUI7UUFDdkIsSUFBSSxDQUFDLGdCQUFnQixHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsb0JBQW9C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Z0I7WUFDdkMsV0FBVyxFQUFFLG9DQUFvQztTQUNsRCxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGtDQUFrQyxFQUFFO1lBQzFELEtBQUssRUFBRSxJQUFJLENBQUMsa0JBQWtCO1lBQzlCLFdBQVcsRUFBRSxtREFBbUQ7U0FDakUsQ0FBQyxDQUFDO1FBRUgsZ0VBQWdFO1FBQ2hFLE1BQU0sVUFBVSxHQUFHLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztZQUN6QyxPQUFPLEVBQUUsQ0FBQywrQkFBK0IsQ0FBQztZQUMxQyxTQUFTLEVBQUU7Z0JBQ1QsdUJBQXVCLElBQUksQ0FBQyxNQUFNLElBQUksSUFBSSxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsbUJBQW1CO2FBQ3pIO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsU0FBUyxDQUFDLGVBQWUsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUN0QyxZQUFZLENBQUMsZUFBZSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3pDLFNBQVMsQ0FBQyxlQUFlLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDeEMsQ0FBQztDQUNGO0FBNUlELGtEQTRJQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tIFwiYXdzLWNkay1saWJcIjtcclxuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSBcImNvbnN0cnVjdHNcIjtcclxuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSBcImF3cy1jZGstbGliL2F3cy1keW5hbW9kYlwiO1xyXG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSBcImF3cy1jZGstbGliL2F3cy1sYW1iZGFcIjtcclxuaW1wb3J0IHsgTm9kZWpzRnVuY3Rpb24gfSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWxhbWJkYS1ub2RlanNcIjtcclxuaW1wb3J0ICogYXMgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5pbXBvcnQgKiBhcyBpYW0gZnJvbSBcImF3cy1jZGstbGliL2F3cy1pYW1cIjtcclxuXHJcbi8vIFdlYlNvY2tldCBBUEkgdjIgKGFscGhhIG1vZHVsZSlcclxuaW1wb3J0ICogYXMgYXBpZ3d2MiBmcm9tIFwiQGF3cy1jZGsvYXdzLWFwaWdhdGV3YXl2Mi1hbHBoYVwiO1xyXG5pbXBvcnQgKiBhcyBpbnRlZ3JhdGlvbnMgZnJvbSBcIkBhd3MtY2RrL2F3cy1hcGlnYXRld2F5djItaW50ZWdyYXRpb25zLWFscGhhXCI7XHJcblxyXG4vLyBpbXBvcnQgREJTdGFjayB0byBjYW4gcGFzcyBpdCBpblxyXG5pbXBvcnQgeyBEQlN0YWNrIH0gZnJvbSBcIi4vREJzdGFja1wiO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBVbml0eVdlYlNvY2tldFN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XHJcbiAgZGJTdGFjazogREJTdGFjaztcclxufVxyXG5cclxuZXhwb3J0IGNsYXNzIFVuaXR5V2ViU29ja2V0U3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xyXG4gIHB1YmxpYyByZWFkb25seSBjb25uZWN0aW9uc1RhYmxlOiBkeW5hbW9kYi5UYWJsZTtcclxuICBwdWJsaWMgcmVhZG9ubHkgd2ViU29ja2V0QXBpOiBhcGlnd3YyLldlYlNvY2tldEFwaTtcclxuICBwdWJsaWMgcmVhZG9ubHkgc3RhZ2U6IGFwaWd3djIuV2ViU29ja2V0U3RhZ2U7XHJcblxyXG4gIC8vIENvbnZlbmllbmNlOiBIVFRQUyBtYW5hZ2VtZW50IGVuZHBvaW50IGZvciBvdGhlciBMYW1iZGFzXHJcbiAgcHVibGljIHJlYWRvbmx5IG1hbmFnZW1lbnRFbmRwb2ludDogc3RyaW5nO1xyXG5cclxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogVW5pdHlXZWJTb2NrZXRTdGFja1Byb3BzKSB7XHJcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcclxuXHJcbiAgICBjb25zdCBwcmVmaXhuYW1lID0gdGhpcy5zdGFja05hbWUuc3BsaXQoJy0nKVswXS50b0xvd2VyQ2FzZSgpO1xyXG4gICAgY29uc3QgcGx1Z0FjdGlvbnNUYWJsZSA9IHByb3BzLmRiU3RhY2sucGx1Z0FjdGlvbnNUYWJsZTtcclxuXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIC8vIOKchSBYLVJBWSBIRUxQRVJcclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgY29uc3QgZW5hYmxlWFJheSA9IChmbjogbGFtYmRhLkZ1bmN0aW9uKSA9PiB7XHJcbiAgICAgIGZuLnJvbGU/LmFkZE1hbmFnZWRQb2xpY3koXHJcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKFwiQVdTWFJheURhZW1vbldyaXRlQWNjZXNzXCIpXHJcbiAgICAgICk7XHJcbiAgICB9O1xyXG5cclxuICAgIC8vIDEpIENvbm5lY3Rpb25zIHRhYmxlXHJcbiAgICB0aGlzLmNvbm5lY3Rpb25zVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgXCJXc0Nvbm5lY3Rpb25zVGFibGVcIiwge1xyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogXCJjb25uZWN0aW9uSWRcIiwgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSwgLy8gY2hhbmdlIHRvIFJFVEFJTiBpbiBwcm9kXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyAyKSBMYW1iZGE6ICRjb25uZWN0ICAoT05MWSBzYXZlIGNvbm5lY3Rpb24pXHJcbiAgICBjb25zdCBjb25uZWN0Rm4gPSBuZXcgTm9kZWpzRnVuY3Rpb24odGhpcywgXCJXc0Nvbm5lY3RIYW5kbGVyXCIsIHtcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXHJcbiAgICAgIGVudHJ5OiBwYXRoLmpvaW4oX19kaXJuYW1lLCBcIi4uL2xhbWJkYS93cy1jb25uZWN0LnRzXCIpLFxyXG4gICAgICBoYW5kbGVyOiBcImhhbmRsZXJcIixcclxuICAgICAgYnVuZGxpbmc6IHsgdGFyZ2V0OiBcIm5vZGUxOFwiLCBtaW5pZnk6IHRydWUsIHNvdXJjZU1hcDogZmFsc2UgfSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICBDT05ORUNUSU9OU19UQUJMRTogdGhpcy5jb25uZWN0aW9uc1RhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgfSxcclxuICAgICAgLy8g4pyFIFgtUmF5XHJcbiAgICAgIHRyYWNpbmc6IGxhbWJkYS5UcmFjaW5nLkFDVElWRSxcclxuICAgIH0pO1xyXG4gICAgZW5hYmxlWFJheShjb25uZWN0Rm4pO1xyXG5cclxuICAgIC8vIDMpIExhbWJkYTogJGRpc2Nvbm5lY3RcclxuICAgIGNvbnN0IGRpc2Nvbm5lY3RGbiA9IG5ldyBOb2RlanNGdW5jdGlvbih0aGlzLCBcIldzRGlzY29ubmVjdEhhbmRsZXJcIiwge1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICAgICAgZW50cnk6IHBhdGguam9pbihfX2Rpcm5hbWUsIFwiLi4vbGFtYmRhL3dzLWRpc2Nvbm5lY3QudHNcIiksXHJcbiAgICAgIGhhbmRsZXI6IFwiaGFuZGxlclwiLFxyXG4gICAgICBidW5kbGluZzogeyB0YXJnZXQ6IFwibm9kZTE4XCIsIG1pbmlmeTogdHJ1ZSwgc291cmNlTWFwOiBmYWxzZSB9LFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIENPTk5FQ1RJT05TX1RBQkxFOiB0aGlzLmNvbm5lY3Rpb25zVGFibGUudGFibGVOYW1lLFxyXG4gICAgICB9LFxyXG4gICAgICAvLyDinIUgWC1SYXlcclxuICAgICAgdHJhY2luZzogbGFtYmRhLlRyYWNpbmcuQUNUSVZFLFxyXG4gICAgfSk7XHJcbiAgICBlbmFibGVYUmF5KGRpc2Nvbm5lY3RGbik7XHJcblxyXG4gICAgLy8gNCkgTGFtYmRhOiAkZGVmYXVsdCAoaGFuZGxlcyBoZWxsby9yZXF1ZXN0U25hcHNob3QgLT4gc2VuZHMgcGx1Z19zbmFwc2hvdClcclxuICAgIGNvbnN0IGRlZmF1bHRGbiA9IG5ldyBOb2RlanNGdW5jdGlvbih0aGlzLCBcIldzRGVmYXVsdEhhbmRsZXJcIiwge1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICAgICAgZW50cnk6IHBhdGguam9pbihfX2Rpcm5hbWUsIFwiLi4vbGFtYmRhL3dzLWRlZmF1bHQudHNcIiksXHJcbiAgICAgIGhhbmRsZXI6IFwiaGFuZGxlclwiLFxyXG4gICAgICBidW5kbGluZzogeyB0YXJnZXQ6IFwibm9kZTE4XCIsIG1pbmlmeTogdHJ1ZSwgc291cmNlTWFwOiBmYWxzZSB9LFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIENPTk5FQ1RJT05TX1RBQkxFOiB0aGlzLmNvbm5lY3Rpb25zVGFibGUudGFibGVOYW1lLFxyXG5cclxuICAgICAgICAvLyBzbmFwc2hvdCBpbnB1dHMgKHVzZWQgYnkgd3MtZGVmYXVsdC50cylcclxuICAgICAgICBQTFVHX0FDVElPTlNfVEFCTEU6IHBsdWdBY3Rpb25zVGFibGUudGFibGVOYW1lLFxyXG4gICAgICAgIFBMVUdfSU5ERVhfTkFNRTogXCJwbHVnX2lkLXRzLWluZGV4XCIsXHJcbiAgICAgICAgUExVR19JRFM6IEpTT04uc3RyaW5naWZ5KFtcInBsdWcxXCIsIFwicGx1ZzJcIl0pLFxyXG4gICAgICB9LFxyXG4gICAgICAvLyDinIUgWC1SYXlcclxuICAgICAgdHJhY2luZzogbGFtYmRhLlRyYWNpbmcuQUNUSVZFLFxyXG4gICAgfSk7XHJcbiAgICBlbmFibGVYUmF5KGRlZmF1bHRGbik7XHJcblxyXG4gICAgLy8gUGVybWlzc2lvbnMgZm9yIGNvbm5lY3Rpb25zIHRhYmxlXHJcbiAgICB0aGlzLmNvbm5lY3Rpb25zVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGNvbm5lY3RGbik7XHJcbiAgICB0aGlzLmNvbm5lY3Rpb25zVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGRpc2Nvbm5lY3RGbik7XHJcbiAgICB0aGlzLmNvbm5lY3Rpb25zVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGRlZmF1bHRGbik7XHJcblxyXG4gICAgLy8gZGVmYXVsdEZuIG5lZWRzIHRvIHJlYWQgUGx1Z0FjdGlvbnMgdG8gY29tcHV0ZSBzbmFwc2hvdFxyXG4gICAgcGx1Z0FjdGlvbnNUYWJsZS5ncmFudFJlYWREYXRhKGRlZmF1bHRGbik7XHJcblxyXG4gICAgLy8gNSkgV2ViU29ja2V0IEFQSVxyXG4gICAgdGhpcy53ZWJTb2NrZXRBcGkgPSBuZXcgYXBpZ3d2Mi5XZWJTb2NrZXRBcGkodGhpcywgXCJVbml0eVdlYlNvY2tldEFwaVwiLCB7XHJcbiAgICAgIGFwaU5hbWU6IGAke3ByZWZpeG5hbWV9LXVuaXR5LXJlYWx0aW1lLWFwaWAsXHJcbiAgICAgIGNvbm5lY3RSb3V0ZU9wdGlvbnM6IHtcclxuICAgICAgICBpbnRlZ3JhdGlvbjogbmV3IGludGVncmF0aW9ucy5XZWJTb2NrZXRMYW1iZGFJbnRlZ3JhdGlvbihcclxuICAgICAgICAgIFwiQ29ubmVjdEludGVncmF0aW9uXCIsXHJcbiAgICAgICAgICBjb25uZWN0Rm5cclxuICAgICAgICApLFxyXG4gICAgICB9LFxyXG4gICAgICBkaXNjb25uZWN0Um91dGVPcHRpb25zOiB7XHJcbiAgICAgICAgaW50ZWdyYXRpb246IG5ldyBpbnRlZ3JhdGlvbnMuV2ViU29ja2V0TGFtYmRhSW50ZWdyYXRpb24oXHJcbiAgICAgICAgICBcIkRpc2Nvbm5lY3RJbnRlZ3JhdGlvblwiLFxyXG4gICAgICAgICAgZGlzY29ubmVjdEZuXHJcbiAgICAgICAgKSxcclxuICAgICAgfSxcclxuICAgICAgZGVmYXVsdFJvdXRlT3B0aW9uczoge1xyXG4gICAgICAgIGludGVncmF0aW9uOiBuZXcgaW50ZWdyYXRpb25zLldlYlNvY2tldExhbWJkYUludGVncmF0aW9uKFxyXG4gICAgICAgICAgXCJEZWZhdWx0SW50ZWdyYXRpb25cIixcclxuICAgICAgICAgIGRlZmF1bHRGblxyXG4gICAgICAgICksXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA2KSBTdGFnZVxyXG4gICAgdGhpcy5zdGFnZSA9IG5ldyBhcGlnd3YyLldlYlNvY2tldFN0YWdlKHRoaXMsIFwiVW5pdHlXc1N0YWdlXCIsIHtcclxuICAgICAgd2ViU29ja2V0QXBpOiB0aGlzLndlYlNvY2tldEFwaSxcclxuICAgICAgc3RhZ2VOYW1lOiBgJHtwcmVmaXhuYW1lfS1kZXZgLFxyXG4gICAgICBhdXRvRGVwbG95OiB0cnVlLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gTWFuYWdlbWVudCBlbmRwb2ludCB1c2VkIGJ5IG90aGVyIExhbWJkYXMgKEhUVFBTLCBub3Qgd3NzKVxyXG4gICAgdGhpcy5tYW5hZ2VtZW50RW5kcG9pbnQgPSBgaHR0cHM6Ly8ke3RoaXMud2ViU29ja2V0QXBpLmFwaUlkfS5leGVjdXRlLWFwaS4ke3RoaXMucmVnaW9ufS5hbWF6b25hd3MuY29tLyR7dGhpcy5zdGFnZS5zdGFnZU5hbWV9YDtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIlVuaXR5V2ViU29ja2V0V3NzVXJsXCIsIHtcclxuICAgICAgdmFsdWU6IHRoaXMuc3RhZ2UudXJsLCAvLyB3c3M6Ly8uLi4vZGV2XHJcbiAgICAgIGRlc2NyaXB0aW9uOiBcIldlYlNvY2tldCBVUkwgZm9yIGZyb250ZW5kIC8gVW5pdHlcIixcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiVW5pdHlXZWJTb2NrZXRNYW5hZ2VtZW50RW5kcG9pbnRcIiwge1xyXG4gICAgICB2YWx1ZTogdGhpcy5tYW5hZ2VtZW50RW5kcG9pbnQsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiBcIkhUVFBTIGVuZHBvaW50IGZvciBBcGlHYXRld2F5TWFuYWdlbWVudEFwaSBjbGllbnRcIixcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIDcpIEFsbG93IGxhbWJkYXMgdG8gdXNlIHRoZSBtYW5hZ2VtZW50IEFQSSAocG9zdFRvQ29ubmVjdGlvbilcclxuICAgIGNvbnN0IG1nbXRQb2xpY3kgPSBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgIGFjdGlvbnM6IFtcImV4ZWN1dGUtYXBpOk1hbmFnZUNvbm5lY3Rpb25zXCJdLFxyXG4gICAgICByZXNvdXJjZXM6IFtcclxuICAgICAgICBgYXJuOmF3czpleGVjdXRlLWFwaToke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06JHt0aGlzLndlYlNvY2tldEFwaS5hcGlJZH0vJHt0aGlzLnN0YWdlLnN0YWdlTmFtZX0vKi9AY29ubmVjdGlvbnMvKmAsXHJcbiAgICAgIF0sXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25uZWN0Rm4uYWRkVG9Sb2xlUG9saWN5KG1nbXRQb2xpY3kpO1xyXG4gICAgZGlzY29ubmVjdEZuLmFkZFRvUm9sZVBvbGljeShtZ210UG9saWN5KTtcclxuICAgIGRlZmF1bHRGbi5hZGRUb1JvbGVQb2xpY3kobWdtdFBvbGljeSk7XHJcbiAgfVxyXG59XHJcbiJdfQ==