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
exports.DBStack = void 0;
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const cdk = __importStar(require("aws-cdk-lib"));
const aws_cdk_lib_1 = require("aws-cdk-lib");
class DBStack extends aws_cdk_lib_1.Stack {
    table;
    userManagementTable;
    preRegBucket;
    chatbotTable;
    activeConnectionsTable;
    whiteboardStrokesTable;
    websiteActivityTable;
    dailySummariesTable;
    alexaUsersTable;
    plugActionsTable;
    iotTelemetryTable;
    constructor(scope, id, props) {
        super(scope, id, props);
        // 1) UnityBahtwin
        const prefixname = this.stackName.split('-')[0].toLowerCase();
        this.table = new dynamodb.Table(this, "BahtwinTable", {
            tableName: `${prefixname}-UnityBahtwinTable`,
            partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
            sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
        });
        // 2) User management
        this.userManagementTable = new dynamodb.Table(this, "UserManagementTable", {
            tableName: `${prefixname}-UserManagementTable`,
            partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
        });
        // 3) PreReg bucket
        this.preRegBucket = new s3.Bucket(this, "PreregistrationImagesBucket", {
            bucketName: `${prefixname}-preregistration-images`, // Add this
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            cors: [
                {
                    allowedOrigins: ["*"],
                    allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.POST, s3.HttpMethods.PUT],
                    allowedHeaders: ["*"],
                },
            ],
        });
        // this.preRegBucket.addCorsRule({
        //   allowedOrigins: ["*"],
        //   allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.POST, s3.HttpMethods.PUT],
        //   allowedHeaders: ["*"],
        // });
        // Active WebSocket connections
        this.activeConnectionsTable = new dynamodb.Table(this, "ActiveConnectionsTable", {
            tableName: `${prefixname}-ActiveConnections`,
            partitionKey: { name: "connectionId", type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
            timeToLiveAttribute: "ttl",
        });
        // Whiteboard strokes history table
        this.whiteboardStrokesTable = new dynamodb.Table(this, "WhiteboardStrokesTable", {
            tableName: `${prefixname}-WhiteboardStrokes`,
            partitionKey: { name: "boardId", type: dynamodb.AttributeType.STRING },
            sortKey: { name: "timestamp", type: dynamodb.AttributeType.NUMBER },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // Website activity analytics table
        this.websiteActivityTable = new dynamodb.Table(this, "WebsiteActivityTable", {
            tableName: `${prefixname}-WebsiteActivity`,
            partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
            sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
            timeToLiveAttribute: "ttl",
        });
        // Daily summaries
        this.dailySummariesTable = new dynamodb.Table(this, "DailySummariesTable", {
            tableName: `${prefixname}-DailySummaries`,
            partitionKey: { name: "date", type: dynamodb.AttributeType.STRING },
            sortKey: { name: "timestamp", type: dynamodb.AttributeType.NUMBER },
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            timeToLiveAttribute: "ttl",
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        });
        // Alexa users table
        this.alexaUsersTable = new dynamodb.Table(this, "AlexaUsersTable", {
            tableName: `${prefixname}-AlexaUsersTable`,
            partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // 4) PlugActions
        this.plugActionsTable = new dynamodb.Table(this, "PlugActionsTable", {
            tableName: `${prefixname}-PlugActionsTable`,
            partitionKey: { name: "user_id", type: dynamodb.AttributeType.STRING },
            sortKey: { name: "ts", type: dynamodb.AttributeType.NUMBER },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
        });
        this.plugActionsTable.addGlobalSecondaryIndex({
            indexName: `plug_id-ts-index`,
            partitionKey: { name: "plug_id", type: dynamodb.AttributeType.STRING },
            sortKey: { name: "ts", type: dynamodb.AttributeType.NUMBER },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        // 5) IoT telemetry
        this.iotTelemetryTable = new dynamodb.Table(this, "IoTTelemetryTable", {
            tableName: `${prefixname}-IoTDeviceTelemetry`,
            partitionKey: { name: "device", type: dynamodb.AttributeType.STRING },
            sortKey: { name: "ts", type: dynamodb.AttributeType.NUMBER },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
            timeToLiveAttribute: "expires_at",
        });
        // 6) Chatbot
        this.chatbotTable = new dynamodb.Table(this, "UnityChatbotTable", {
            tableName: `${prefixname}-UnityChatbotTable`,
            partitionKey: { name: "sessionId", type: dynamodb.AttributeType.STRING },
            sortKey: { name: "createdAt", type: dynamodb.AttributeType.NUMBER },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
        });
        new cdk.CfnOutput(this, "UnityChatbotTableNameOutput", {
            value: this.chatbotTable.tableName,
            exportName: `${prefixname}-UnityChatbotTableName`,
        });
        new cdk.CfnOutput(this, "UnityBahtwinTableNameOutput", {
            value: this.table.tableName,
            exportName: `${prefixname}-UnityBahtwinTableName`,
        });
        new cdk.CfnOutput(this, "AlexaUsersTableName", {
            value: this.alexaUsersTable.tableName,
            exportName: `${prefixname}-AlexaUsersTableName`,
        });
        new cdk.CfnOutput(this, "PlugActionsTableNameOutput", {
            value: this.plugActionsTable.tableName,
            exportName: `${prefixname}-PlugActionsTableName`,
        });
        new cdk.CfnOutput(this, "IoTDeviceTelemetryTableNameOutput", {
            value: this.iotTelemetryTable.tableName,
            exportName: `${prefixname}-IoTDeviceTelemetryTableName`,
        });
    }
}
exports.DBStack = DBStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiREJzdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIkRCc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxtRUFBcUQ7QUFDckQsdURBQXlDO0FBQ3pDLGlEQUFtQztBQUNuQyw2Q0FBK0Q7QUFHL0QsTUFBYSxPQUFRLFNBQVEsbUJBQUs7SUFDaEIsS0FBSyxDQUFpQjtJQUN0QixtQkFBbUIsQ0FBaUI7SUFDcEMsWUFBWSxDQUFZO0lBRXhCLFlBQVksQ0FBaUI7SUFFN0Isc0JBQXNCLENBQWlCO0lBQ3ZDLHNCQUFzQixDQUFpQjtJQUN2QyxvQkFBb0IsQ0FBaUI7SUFDckMsbUJBQW1CLENBQWlCO0lBQ3BDLGVBQWUsQ0FBaUI7SUFFaEMsZ0JBQWdCLENBQWlCO0lBQ2pDLGlCQUFpQixDQUFpQjtJQUVsRCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQWtCO1FBQzFELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLGtCQUFrQjtRQUNsQixNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUU5RCxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFO1lBQ3BELFNBQVMsRUFBRSxHQUFHLFVBQVUsb0JBQW9CO1lBQzVDLFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQ2pFLE9BQU8sRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQzVELFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFD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QVUsc0JBQXNCO1NBQ2hELENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsNEJBQTRCLEVBQUU7WUFDcEQsS0FBSyxFQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTO1lBQ3RDLFVBQVUsRUFBRSxHQUFHLFVBQVUsdUJBQXVCO1NBQ2pELENBQUMsQ0FBQztRQUVBLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsbUNBQW1DLEVBQUU7WUFDOUQsS0FBSyxFQUFFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTO1lBQ3ZDLFVBQVUsRUFBRSxHQUFHLFVBQVUsOEJBQThCO1NBQ3hELENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQXhLRCwwQkF3S0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiXCI7XHJcbmltcG9ydCAqIGFzIHMzIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtczNcIjtcclxuaW1wb3J0ICogYXMgY2RrIGZyb20gXCJhd3MtY2RrLWxpYlwiO1xyXG5pbXBvcnQgeyBTdGFjaywgU3RhY2tQcm9wcywgUmVtb3ZhbFBvbGljeSB9IGZyb20gXCJhd3MtY2RrLWxpYlwiO1xyXG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tIFwiY29uc3RydWN0c1wiO1xyXG5cclxuZXhwb3J0IGNsYXNzIERCU3RhY2sgZXh0ZW5kcyBTdGFjayB7XHJcbiAgcHVibGljIHJlYWRvbmx5IHRhYmxlOiBkeW5hbW9kYi5UYWJsZTtcclxuICBwdWJsaWMgcmVhZG9ubHkgdXNlck1hbmFnZW1lbnRUYWJsZTogZHluYW1vZGIuVGFibGU7XHJcbiAgcHVibGljIHJlYWRvbmx5IHByZVJlZ0J1Y2tldDogczMuQnVja2V0O1xyXG5cclxuICBwdWJsaWMgcmVhZG9ubHkgY2hhdGJvdFRhYmxlOiBkeW5hbW9kYi5UYWJsZTsgXHJcblxyXG4gIHB1YmxpYyByZWFkb25seSBhY3RpdmVDb25uZWN0aW9uc1RhYmxlOiBkeW5hbW9kYi5UYWJsZTtcclxuICBwdWJsaWMgcmVhZG9ubHkgd2hpdGVib2FyZFN0cm9rZXNUYWJsZTogZHluYW1vZGIuVGFibGU7XHJcbiAgcHVibGljIHJlYWRvbmx5IHdlYnNpdGVBY3Rpdml0eVRhYmxlOiBkeW5hbW9kYi5UYWJsZTtcclxuICBwdWJsaWMgcmVhZG9ubHkgZGFpbHlTdW1tYXJpZXNUYWJsZTogZHluYW1vZGIuVGFibGU7XHJcbiAgcHVibGljIHJlYWRvbmx5IGFsZXhhVXNlcnNUYWJsZTogZHluYW1vZGIuVGFibGU7XHJcblxyXG4gIHB1YmxpYyByZWFkb25seSBwbHVnQWN0aW9uc1RhYmxlOiBkeW5hbW9kYi5UYWJsZTtcclxuICBwdWJsaWMgcmVhZG9ubHkgaW90VGVsZW1ldHJ5VGFibGU6IGR5bmFtb2RiLlRhYmxlO1xyXG5cclxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IFN0YWNrUHJvcHMpIHtcclxuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xyXG5cclxuICAgIC8vIDEpIFVuaXR5QmFodHdpblxyXG4gICAgY29uc3QgcHJlZml4bmFtZSA9IHRoaXMuc3RhY2tOYW1lLnNwbGl0KCctJylbMF0udG9Mb3dlckNhc2UoKTtcclxuXHJcbiAgICB0aGlzLnRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsIFwiQmFodHdpblRhYmxlXCIsIHtcclxuICAgICAgdGFibGVOYW1lOiBgJHtwcmVmaXhuYW1lfS1Vbml0eUJhaHR3aW5UYWJsZWAsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiBcInBrXCIsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogXCJza1wiLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBSZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyAyKSBVc2VyIG1hbmFnZW1lbnRcclxuICAgIHRoaXMudXNlck1hbmFnZW1lbnRUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCBcIlVzZXJNYW5hZ2VtZW50VGFibGVcIiwge1xyXG4gICAgICB0YWJsZU5hbWU6IGAke3ByZWZpeG5hbWV9LVVzZXJNYW5hZ2VtZW50VGFibGVgLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogXCJ1c2VySWRcIiwgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcclxuICAgICAgcmVtb3ZhbFBvbGljeTogUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gMykgUHJlUmVnIGJ1Y2tldFxyXG4gICAgdGhpcy5wcmVSZWdCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsIFwiUHJlcmVnaXN0cmF0aW9uSW1hZ2VzQnVja2V0XCIsIHtcclxuICAgICAgYnVja2V0TmFtZTogYCR7cHJlZml4bmFtZX0tcHJlcmVnaXN0cmF0aW9uLWltYWdlc2AsICAvLyBBZGQgdGhpc1xyXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxyXG4gICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IFJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IHRydWUsXHJcbiAgICAgIGNvcnM6IFtcclxuICAgICAgICB7XHJcbiAgICAgICAgICBhbGxvd2VkT3JpZ2luczogW1wiKlwiXSxcclxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBbczMuSHR0cE1ldGhvZHMuR0VULCBzMy5IdHRwTWV0aG9kcy5QT1NULCBzMy5IdHRwTWV0aG9kcy5QVVRdLFxyXG4gICAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFtcIipcIl0sXHJcbiAgICAgICAgfSxcclxuICAgICAgXSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIHRoaXMucHJlUmVnQnVja2V0LmFkZENvcnNSdWxlKHtcclxuICAgIC8vICAgYWxsb3dlZE9yaWdpbnM6IFtcIipcIl0sXHJcbiAgICAvLyAgIGFsbG93ZWRNZXRob2RzOiBbczMuSHR0cE1ldGhvZHMuR0VULCBzMy5IdHRwTWV0aG9kcy5QT1NULCBzMy5IdHRwTWV0aG9kcy5QVVRdLFxyXG4gICAgLy8gICBhbGxvd2VkSGVhZGVyczogW1wiKlwiXSxcclxuICAgIC8vIH0pO1xyXG5cclxuICAgIC8vIEFjdGl2ZSBXZWJTb2NrZXQgY29ubmVjdGlvbnNcclxuICAgIHRoaXMuYWN0aXZlQ29ubmVjdGlvbnNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCBcIkFjdGl2ZUNvbm5lY3Rpb25zVGFibGVcIiwge1xyXG4gICAgICB0YWJsZU5hbWU6IGAke3ByZWZpeG5hbWV9LUFjdGl2ZUNvbm5lY3Rpb25zYCxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6IFwiY29ubmVjdGlvbklkXCIsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IFJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgICAgdGltZVRvTGl2ZUF0dHJpYnV0ZTogXCJ0dGxcIixcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFdoaXRlYm9hcmQgc3Ryb2tlcyBoaXN0b3J5IHRhYmxlXHJcbiAgICB0aGlzLndoaXRlYm9hcmRTdHJva2VzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgXCJXaGl0ZWJvYXJkU3Ryb2tlc1RhYmxlXCIsIHtcclxuICAgICAgdGFibGVOYW1lOiBgJHtwcmVmaXhuYW1lfS1XaGl0ZWJvYXJkU3Ryb2tlc2AsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiBcImJvYXJkSWRcIiwgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiBcInRpbWVzdGFtcFwiLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLk5VTUJFUiB9LFxyXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gV2Vic2l0ZSBhY3Rpdml0eSBhbmFseXRpY3MgdGFibGVcclxuICAgIHRoaXMud2Vic2l0ZUFjdGl2aXR5VGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgXCJXZWJzaXRlQWN0aXZpdHlUYWJsZVwiLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogYCR7cHJlZml4bmFtZX0tV2Vic2l0ZUFjdGl2aXR5YCxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6IFwicGtcIiwgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiBcInNrXCIsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IFJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgICAgdGltZVRvTGl2ZUF0dHJpYnV0ZTogXCJ0dGxcIixcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIERhaWx5IHN1bW1hcmllc1xyXG4gICAgdGhpcy5kYWlseVN1bW1hcmllc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsIFwiRGFpbHlTdW1tYXJpZXNUYWJsZVwiLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogYCR7cHJlZml4bmFtZX0tRGFpbHlTdW1tYXJpZXNgLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogXCJkYXRlXCIsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogXCJ0aW1lc3RhbXBcIiwgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5OVU1CRVIgfSxcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgICAgdGltZVRvTGl2ZUF0dHJpYnV0ZTogXCJ0dGxcIixcclxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEFsZXhhIHVzZXJzIHRhYmxlXHJcbiAgICB0aGlzLmFsZXhhVXNlcnNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCBcIkFsZXhhVXNlcnNUYWJsZVwiLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogYCR7cHJlZml4bmFtZX0tQWxleGFVc2Vyc1RhYmxlYCxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6IFwidXNlcklkXCIsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyA0KSBQbHVnQWN0aW9uc1xyXG4gICAgdGhpcy5wbHVnQWN0aW9uc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsIFwiUGx1Z0FjdGlvbnNUYWJsZVwiLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogYCR7cHJlZml4bmFtZX0tUGx1Z0FjdGlvbnNUYWJsZWAsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiBcInVzZXJfaWRcIiwgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiBcInRzXCIsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IFJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMucGx1Z0FjdGlvbnNUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgIGluZGV4TmFtZTogYHBsdWdfaWQtdHMtaW5kZXhgLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogXCJwbHVnX2lkXCIsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogXCJ0c1wiLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLk5VTUJFUiB9LFxyXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gNSkgSW9UIHRlbGVtZXRyeVxyXG4gICAgdGhpcy5pb3RUZWxlbWV0cnlUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCBcIklvVFRlbGVtZXRyeVRhYmxlXCIsIHtcclxuICAgICAgdGFibGVOYW1lOiBgJHtwcmVmaXhuYW1lfS1Jb1REZXZpY2VUZWxlbWV0cnlgLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogXCJkZXZpY2VcIiwgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiBcInRzXCIsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IFJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgICAgdGltZVRvTGl2ZUF0dHJpYnV0ZTogXCJleHBpcmVzX2F0XCIsXHJcbiAgICB9KTtcclxuXHJcbiBcclxuXHJcbiAgICAvLyA2KSBDaGF0Ym90XHJcbiAgICB0aGlzLmNoYXRib3RUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCBcIlVuaXR5Q2hhdGJvdFRhYmxlXCIsIHtcclxuICAgICAgdGFibGVOYW1lOiBgJHtwcmVmaXhuYW1lfS1Vbml0eUNoYXRib3RUYWJsZWAsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiBcInNlc3Npb25JZFwiLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6IFwiY3JlYXRlZEF0XCIsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IFJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiVW5pdHlDaGF0Ym90VGFibGVOYW1lT3V0cHV0XCIsIHtcclxuICAgICAgdmFsdWU6IHRoaXMuY2hhdGJvdFRhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgZXhwb3J0TmFtZTogYCR7cHJlZml4bmFtZX0tVW5pdHlDaGF0Ym90VGFibGVOYW1lYCxcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiVW5pdHlCYWh0d2luVGFibGVOYW1lT3V0cHV0XCIsIHtcclxuICAgICAgdmFsdWU6IHRoaXMudGFibGUudGFibGVOYW1lLFxyXG4gICAgICBleHBvcnROYW1lOiBgJHtwcmVmaXhuYW1lfS1Vbml0eUJhaHR3aW5UYWJsZU5hbWVgLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJBbGV4YVVzZXJzVGFibGVOYW1lXCIsIHtcclxuICAgICAgdmFsdWU6IHRoaXMuYWxleGFVc2Vyc1RhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgZXhwb3J0TmFtZTogYCR7cHJlZml4bmFtZX0tQWxleGFVc2Vyc1RhYmxlTmFtZWAsXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIlBsdWdBY3Rpb25zVGFibGVOYW1lT3V0cHV0XCIsIHtcclxuICAgICAgdmFsdWU6IHRoaXMucGx1Z0FjdGlvbnNUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgIGV4cG9ydE5hbWU6IGAke3ByZWZpeG5hbWV9LVBsdWdBY3Rpb25zVGFibGVOYW1lYCxcclxuICAgIH0pO1xyXG5cclxuICAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiSW9URGV2aWNlVGVsZW1ldHJ5VGFibGVOYW1lT3V0cHV0XCIsIHtcclxuICAgICAgdmFsdWU6IHRoaXMuaW90VGVsZW1ldHJ5VGFibGUudGFibGVOYW1lLFxyXG4gICAgICBleHBvcnROYW1lOiBgJHtwcmVmaXhuYW1lfS1Jb1REZXZpY2VUZWxlbWV0cnlUYWJsZU5hbWVgLFxyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcbiJdfQ==