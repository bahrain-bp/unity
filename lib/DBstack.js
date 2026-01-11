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
const aws_cdk_lib_2 = require("aws-cdk-lib");
class DBStack extends aws_cdk_lib_1.Stack {
    table;
    userManagementTable;
    preRegBucket;
    chatbotTable;
    activeConnectionsTable;
    connectionTable;
    whiteboardStrokesTable;
    websiteActivityTable;
    dailySummariesTable;
    alexaUsersTable;
    plugActionsTable;
    iotTelemetryTable;
    visitorFeedbackTable;
    invitedVisitorTable;
    usedTokensTable;
    visitorImagesBucket;
    //sara additions
    bahtwinTestingBucket;
    visitorFaceCollection;
    facialWsConnectionsTable;
    constructor(scope, id, props) {
        super(scope, id, props);
        const prefixname = this.stackName.split("-")[0].toLowerCase();
        // ───────────────────── UnityBahtwin ─────────────────────
        this.table = new dynamodb.Table(this, "BahtwinTable", {
            tableName: `${prefixname}-UnityBahtwinTable`,
            partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
            sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
        });
        // ───────────────────── User Management ─────────────────────
        this.userManagementTable = new dynamodb.Table(this, "UserManagementTable", {
            tableName: `${prefixname}-UserManagementTable`,
            partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
        });
        this.userManagementTable.addGlobalSecondaryIndex({
            indexName: "EmailIndex",
            partitionKey: { name: "email", type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        this.userManagementTable.addGlobalSecondaryIndex({
            indexName: "FaceIdIndex",
            partitionKey: { name: "faceId", type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        this.userManagementTable.addGlobalSecondaryIndex({
            indexName: "visitedIndex",
            partitionKey: { name: "visited", type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        // ───────────────────── Pre-registration bucket ─────────────────────
        this.preRegBucket = new s3.Bucket(this, "PreregistrationImagesBucket", {
            bucketName: `${prefixname}-preregistration-images`,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            cors: [
                {
                    allowedOrigins: ["*"],
                    allowedMethods: [
                        s3.HttpMethods.GET,
                        s3.HttpMethods.POST,
                        s3.HttpMethods.PUT,
                    ],
                    allowedHeaders: ["*"],
                },
            ],
        });
        // ───────────────────── Active WebSocket Connections ─────────────────────
        this.activeConnectionsTable = new dynamodb.Table(this, "ActiveConnectionsTable", {
            tableName: `${prefixname}-ActiveConnections`,
            partitionKey: {
                name: "connectionId",
                type: dynamodb.AttributeType.STRING,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
            timeToLiveAttribute: "ttl",
        });
        // Separate Connection Table (for APIs / chat)
        this.connectionTable = new dynamodb.Table(this, "ConnectionTable", {
            tableName: `${prefixname}-ConnectionTable`,
            partitionKey: {
                name: "connectionId",
                type: dynamodb.AttributeType.STRING,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
            timeToLiveAttribute: "ttl",
        });
        // ───────────────────── Whiteboard ─────────────────────
        this.whiteboardStrokesTable = new dynamodb.Table(this, "WhiteboardStrokesTable", {
            tableName: `${prefixname}-WhiteboardStrokes`,
            partitionKey: {
                name: "boardId",
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: { name: "timestamp", type: dynamodb.AttributeType.NUMBER },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
        });
        // ───────────────────── Website Activity ─────────────────────
        this.websiteActivityTable = new dynamodb.Table(this, "WebsiteActivityTable", {
            tableName: `${prefixname}-WebsiteActivity`,
            partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
            sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
            timeToLiveAttribute: "ttl",
        });
        // ───────────────────── Daily Summaries ─────────────────────
        this.dailySummariesTable = new dynamodb.Table(this, "DailySummariesTable", {
            tableName: `${prefixname}-DailySummaries`,
            partitionKey: { name: "date", type: dynamodb.AttributeType.STRING },
            sortKey: {
                name: "timestamp",
                type: dynamodb.AttributeType.NUMBER,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
            timeToLiveAttribute: "ttl",
        });
        // ───────────────────── Alexa Users ─────────────────────
        this.alexaUsersTable = new dynamodb.Table(this, "AlexaUsersTable", {
            tableName: `${prefixname}-AlexaUsersTable`,
            partitionKey: {
                name: "userId",
                type: dynamodb.AttributeType.STRING,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
        });
        // ───────────────────── Plug Actions ─────────────────────
        this.plugActionsTable = new dynamodb.Table(this, "PlugActionsTable", {
            tableName: `${prefixname}-PlugActionsTable`,
            partitionKey: {
                name: "user_id",
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: { name: "ts", type: dynamodb.AttributeType.NUMBER },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
        });
        this.plugActionsTable.addGlobalSecondaryIndex({
            indexName: "plug_id-ts-index",
            partitionKey: {
                name: "plug_id",
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: { name: "ts", type: dynamodb.AttributeType.NUMBER },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        // ───────────────────── IoT Telemetry ─────────────────────
        this.iotTelemetryTable = new dynamodb.Table(this, "IoTTelemetryTable", {
            tableName: `${prefixname}-IoTDeviceTelemetry`,
            partitionKey: {
                name: "device",
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: { name: "ts", type: dynamodb.AttributeType.NUMBER },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
            timeToLiveAttribute: "expires_at",
        });
        // ───────────────────── Chatbot ─────────────────────
        this.chatbotTable = new dynamodb.Table(this, "UnityChatbotTable", {
            tableName: `${prefixname}-UnityChatbotTable`,
            partitionKey: {
                name: "sessionId",
                type: dynamodb.AttributeType.STRING,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
        });
        // ───────────────────── Visitor Feedback ─────────────────────
        this.visitorFeedbackTable = new dynamodb.Table(this, "VisitorFeedbackTable", {
            tableName: `${prefixname}-VisitorFeedback`,
            partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
        });
        this.visitorFeedbackTable.addGlobalSecondaryIndex({
            indexName: "visitorIdIndex",
            partitionKey: {
                name: "visitorId",
                type: dynamodb.AttributeType.STRING,
            },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        // ───────────────────── Invited Visitors ─────────────────────
        this.invitedVisitorTable = new dynamodb.Table(this, "InvitedVisitorTable", {
            tableName: `${prefixname}-InvitedVisitorTable`,
            partitionKey: {
                name: "visitorId",
                type: dynamodb.AttributeType.STRING,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
        });
        this.invitedVisitorTable.addGlobalSecondaryIndex({
            indexName: "EmailVisitDateIndex",
            partitionKey: {
                name: "email",
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: {
                name: "visitDate",
                type: dynamodb.AttributeType.STRING,
            },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        // ───────────────────── Used Tokens ─────────────────────
        this.usedTokensTable = new dynamodb.Table(this, "UsedTokensTable", {
            tableName: `${prefixname}-UsedTokensTable`,
            partitionKey: {
                name: "token",
                type: dynamodb.AttributeType.STRING,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
        });
        // ───────────────────── Visitor Images Bucket ─────────────────────
        this.visitorImagesBucket = new s3.Bucket(this, "VisitorImagesBucket", {
            bucketName: `${prefixname}-visitor-images`,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });
        // ───────────────────── Outputs ─────────────────────
        new cdk.CfnOutput(this, "InvitedVisitorTableName", {
            value: this.invitedVisitorTable.tableName,
            exportName: `${prefixname}-InvitedVisitorTableName`,
        });
        new cdk.CfnOutput(this, "ConnectionTableName", {
            value: this.connectionTable.tableName,
            exportName: `${prefixname}-ConnectionTableName`,
        });
        new cdk.CfnOutput(this, "VisitorImagesBucketName", {
            value: this.visitorImagesBucket.bucketName,
            exportName: `${prefixname}-VisitorImagesBucketName`,
        });
        //sara additions
        this.bahtwinTestingBucket = new s3.Bucket(this, "BahtwinTestingBucket", {
            // bucketName: `bahtwin-testing-${cdk.Stack.of(this).account}-${cdk.Stack.of(this).region}`,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });
        new cdk.CfnOutput(this, "BahtwinTestingBucketNameOutput", {
            value: this.bahtwinTestingBucket.bucketName,
            exportName: `${prefixname}-BahtwinTestingBucketName`,
        });
        // ───────────────────── Rekognition Collection ─────────────────────
        this.visitorFaceCollection = new aws_cdk_lib_2.aws_rekognition.CfnCollection(this, "VisitorFaceCollection", {
            collectionId: `${prefixname}-visitor-face-collection`,
        });
        new cdk.CfnOutput(this, "VisitorFaceCollectionIdOutput", {
            value: this.visitorFaceCollection.collectionId,
            exportName: `${prefixname}-VisitorFaceCollectionId`,
        });
        // ───────────────────── Facial WS Connection Table ─────────────────────
        this.facialWsConnectionsTable = new dynamodb.Table(this, "FacialWsConnectionTable", {
            // tableName: `${prefixname}-FacialWsConnectionTable`,
            partitionKey: { name: "ConnectionId", type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
            timeToLiveAttribute: "ttl",
        });
        new cdk.CfnOutput(this, "FacialWsConnectionTableNameOutput", {
            value: this.facialWsConnectionsTable.tableName,
            exportName: `${prefixname}-FacialWsConnectionTableName`,
        });
        //modified based on sara additions above
        new cdk.CfnOutput(this, "UserManagementTableNameOutput", {
            value: this.userManagementTable.tableName,
            exportName: `${prefixname}-UserManagementTableName`,
        });
    }
}
exports.DBStack = DBStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiREJzdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIkRCc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxtRUFBcUQ7QUFDckQsdURBQXlDO0FBQ3pDLGlEQUFtQztBQUNuQyw2Q0FBK0Q7QUFFL0QsNkNBQTZEO0FBRTdELE1BQWEsT0FBUSxTQUFRLG1CQUFLO0lBQ2hCLEtBQUssQ0FBaUI7SUFDdEIsbUJBQW1CLENBQWlCO0lBQ3BDLFlBQVksQ0FBWTtJQUN4QixZQUFZLENBQWlCO0lBRTdCLHNCQUFzQixDQUFpQjtJQUN2QyxlQUFlLENBQWlCO0lBQ2hDLHNCQUFzQixDQUFpQjtJQUN2QyxvQkFBb0IsQ0FBaUI7SUFDckMsbUJBQW1CLENBQWlCO0lBQ3BDLGVBQWUsQ0FBaUI7SUFFaEMsZ0JBQWdCLENBQWlCO0lBQ2pDLGlCQUFpQixDQUFpQjtJQUVsQyxvQkFBb0IsQ0FBaUI7SUFDckMsbUJBQW1CLENBQWlCO0lBQ3BDLGVBQWUsQ0FBaUI7SUFFaEMsbUJBQW1CLENBQVk7SUFFL0MsZ0JBQWdCO0lBQ0Esb0JBQW9CLENBQVk7SUFFaEMscUJBQXFCLENBQTRCO0lBRWpELHdCQUF3QixDQUFpQjtJQUV6RCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQWtCO1FBQzFELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBRTlELDJEQUEyRDtRQUMzRCxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFO1lBQ3BELFNBQVMsRUFBRSxHQUFHLFVBQVUsb0JBQW9CO1lBQzVDLFlBQVksRUFBRSxFQUFFLElBQUks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O1lBQzlDLFVBQVUsRUFBRSxHQUFHLFVBQVUsOEJBQThCO1NBQ3hELENBQUMsQ0FBQztRQUVILHdDQUF3QztRQUN4QyxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLCtCQUErQixFQUFFO1lBQ3ZELEtBQUssRUFBRSxJQUFJLENBQUMsbUJBQW1CLENBQUMsU0FBUztZQUN6QyxVQUFVLEVBQUUsR0FBRyxVQUFVLDBCQUEwQjtTQUNwRCxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUE5VkQsMEJBOFZDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSBcImF3cy1jZGstbGliL2F3cy1keW5hbW9kYlwiO1xyXG5pbXBvcnQgKiBhcyBzMyBmcm9tIFwiYXdzLWNkay1saWIvYXdzLXMzXCI7XHJcbmltcG9ydCAqIGFzIGNkayBmcm9tIFwiYXdzLWNkay1saWJcIjtcclxuaW1wb3J0IHsgU3RhY2ssIFN0YWNrUHJvcHMsIFJlbW92YWxQb2xpY3kgfSBmcm9tIFwiYXdzLWNkay1saWJcIjtcclxuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSBcImNvbnN0cnVjdHNcIjtcclxuaW1wb3J0IHsgYXdzX3Jla29nbml0aW9uIGFzIHJla29nbml0aW9uIH0gZnJvbSBcImF3cy1jZGstbGliXCI7XHJcblxyXG5leHBvcnQgY2xhc3MgREJTdGFjayBleHRlbmRzIFN0YWNrIHtcclxuICBwdWJsaWMgcmVhZG9ubHkgdGFibGU6IGR5bmFtb2RiLlRhYmxlO1xyXG4gIHB1YmxpYyByZWFkb25seSB1c2VyTWFuYWdlbWVudFRhYmxlOiBkeW5hbW9kYi5UYWJsZTtcclxuICBwdWJsaWMgcmVhZG9ubHkgcHJlUmVnQnVja2V0OiBzMy5CdWNrZXQ7XHJcbiAgcHVibGljIHJlYWRvbmx5IGNoYXRib3RUYWJsZTogZHluYW1vZGIuVGFibGU7XHJcblxyXG4gIHB1YmxpYyByZWFkb25seSBhY3RpdmVDb25uZWN0aW9uc1RhYmxlOiBkeW5hbW9kYi5UYWJsZTtcclxuICBwdWJsaWMgcmVhZG9ubHkgY29ubmVjdGlvblRhYmxlOiBkeW5hbW9kYi5UYWJsZTtcclxuICBwdWJsaWMgcmVhZG9ubHkgd2hpdGVib2FyZFN0cm9rZXNUYWJsZTogZHluYW1vZGIuVGFibGU7XHJcbiAgcHVibGljIHJlYWRvbmx5IHdlYnNpdGVBY3Rpdml0eVRhYmxlOiBkeW5hbW9kYi5UYWJsZTtcclxuICBwdWJsaWMgcmVhZG9ubHkgZGFpbHlTdW1tYXJpZXNUYWJsZTogZHluYW1vZGIuVGFibGU7XHJcbiAgcHVibGljIHJlYWRvbmx5IGFsZXhhVXNlcnNUYWJsZTogZHluYW1vZGIuVGFibGU7XHJcblxyXG4gIHB1YmxpYyByZWFkb25seSBwbHVnQWN0aW9uc1RhYmxlOiBkeW5hbW9kYi5UYWJsZTtcclxuICBwdWJsaWMgcmVhZG9ubHkgaW90VGVsZW1ldHJ5VGFibGU6IGR5bmFtb2RiLlRhYmxlO1xyXG5cclxuICBwdWJsaWMgcmVhZG9ubHkgdmlzaXRvckZlZWRiYWNrVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xyXG4gIHB1YmxpYyByZWFkb25seSBpbnZpdGVkVmlzaXRvclRhYmxlOiBkeW5hbW9kYi5UYWJsZTtcclxuICBwdWJsaWMgcmVhZG9ubHkgdXNlZFRva2Vuc1RhYmxlOiBkeW5hbW9kYi5UYWJsZTtcclxuXHJcbiAgcHVibGljIHJlYWRvbmx5IHZpc2l0b3JJbWFnZXNCdWNrZXQ6IHMzLkJ1Y2tldDtcclxuXHJcbiAgLy9zYXJhIGFkZGl0aW9uc1xyXG4gIHB1YmxpYyByZWFkb25seSBiYWh0d2luVGVzdGluZ0J1Y2tldDogczMuQnVja2V0O1xyXG5cclxuICBwdWJsaWMgcmVhZG9ubHkgdmlzaXRvckZhY2VDb2xsZWN0aW9uOiByZWtvZ25pdGlvbi5DZm5Db2xsZWN0aW9uO1xyXG5cclxuICBwdWJsaWMgcmVhZG9ubHkgZmFjaWFsV3NDb25uZWN0aW9uc1RhYmxlOiBkeW5hbW9kYi5UYWJsZTtcclxuXHJcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBTdGFja1Byb3BzKSB7XHJcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcclxuXHJcbiAgICBjb25zdCBwcmVmaXhuYW1lID0gdGhpcy5zdGFja05hbWUuc3BsaXQoXCItXCIpWzBdLnRvTG93ZXJDYXNlKCk7XHJcblxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAIFVuaXR5QmFodHdpbiDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIHRoaXMudGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgXCJCYWh0d2luVGFibGVcIiwge1xyXG4gICAgICB0YWJsZU5hbWU6IGAke3ByZWZpeG5hbWV9LVVuaXR5QmFodHdpblRhYmxlYCxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6IFwicGtcIiwgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiBcInNrXCIsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IFJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgCBVc2VyIE1hbmFnZW1lbnQg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICB0aGlzLnVzZXJNYW5hZ2VtZW50VGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgXCJVc2VyTWFuYWdlbWVudFRhYmxlXCIsIHtcclxuICAgICAgdGFibGVOYW1lOiBgJHtwcmVmaXhuYW1lfS1Vc2VyTWFuYWdlbWVudFRhYmxlYCxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6IFwidXNlcklkXCIsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IFJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgIH0pO1xyXG4gXHJcbiAgICB0aGlzLnVzZXJNYW5hZ2VtZW50VGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgICBpbmRleE5hbWU6IFwiRW1haWxJbmRleFwiLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogXCJlbWFpbFwiLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxyXG4gICAgfSk7XHJcbiBcclxuICAgIHRoaXMudXNlck1hbmFnZW1lbnRUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgIGluZGV4TmFtZTogXCJGYWNlSWRJbmRleFwiLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogXCJmYWNlSWRcIiwgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcclxuICAgIH0pO1xyXG4gXHJcbiAgICB0aGlzLnVzZXJNYW5hZ2VtZW50VGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgICBpbmRleE5hbWU6IFwidmlzaXRlZEluZGV4XCIsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiBcInZpc2l0ZWRcIiwgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgCBQcmUtcmVnaXN0cmF0aW9uIGJ1Y2tldCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIHRoaXMucHJlUmVnQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCBcIlByZXJlZ2lzdHJhdGlvbkltYWdlc0J1Y2tldFwiLCB7XHJcbiAgICAgIGJ1Y2tldE5hbWU6IGAke3ByZWZpeG5hbWV9LXByZXJlZ2lzdHJhdGlvbi1pbWFnZXNgLFxyXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxyXG4gICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IFJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IHRydWUsXHJcbiAgICAgIGNvcnM6IFtcclxuICAgICAgICB7XHJcbiAgICAgICAgICBhbGxvd2VkT3JpZ2luczogW1wiKlwiXSxcclxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBbXHJcbiAgICAgICAgICAgIHMzLkh0dHBNZXRob2RzLkdFVCxcclxuICAgICAgICAgICAgczMuSHR0cE1ldGhvZHMuUE9TVCxcclxuICAgICAgICAgICAgczMuSHR0cE1ldGhvZHMuUFVULFxyXG4gICAgICAgICAgXSxcclxuICAgICAgICAgIGFsbG93ZWRIZWFkZXJzOiBbXCIqXCJdLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIF0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIAgQWN0aXZlIFdlYlNvY2tldCBDb25uZWN0aW9ucyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIHRoaXMuYWN0aXZlQ29ubmVjdGlvbnNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZShcclxuICAgICAgdGhpcyxcclxuICAgICAgXCJBY3RpdmVDb25uZWN0aW9uc1RhYmxlXCIsXHJcbiAgICAgIHtcclxuICAgICAgICB0YWJsZU5hbWU6IGAke3ByZWZpeG5hbWV9LUFjdGl2ZUNvbm5lY3Rpb25zYCxcclxuICAgICAgICBwYXJ0aXRpb25LZXk6IHtcclxuICAgICAgICAgIG5hbWU6IFwiY29ubmVjdGlvbklkXCIsXHJcbiAgICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcclxuICAgICAgICB9LFxyXG4gICAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXHJcbiAgICAgICAgcmVtb3ZhbFBvbGljeTogUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgICAgIHRpbWVUb0xpdmVBdHRyaWJ1dGU6IFwidHRsXCIsXHJcbiAgICAgIH1cclxuICAgICk7XHJcblxyXG4gICAgLy8gU2VwYXJhdGUgQ29ubmVjdGlvbiBUYWJsZSAoZm9yIEFQSXMgLyBjaGF0KVxyXG4gICAgdGhpcy5jb25uZWN0aW9uVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgXCJDb25uZWN0aW9uVGFibGVcIiwge1xyXG4gICAgICB0YWJsZU5hbWU6IGAke3ByZWZpeG5hbWV9LUNvbm5lY3Rpb25UYWJsZWAsXHJcbiAgICAgIHBhcnRpdGlvbktleToge1xyXG4gICAgICAgIG5hbWU6IFwiY29ubmVjdGlvbklkXCIsXHJcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXHJcbiAgICAgIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IFJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgICAgdGltZVRvTGl2ZUF0dHJpYnV0ZTogXCJ0dGxcIixcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgCBXaGl0ZWJvYXJkIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgdGhpcy53aGl0ZWJvYXJkU3Ryb2tlc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKFxyXG4gICAgICB0aGlzLFxyXG4gICAgICBcIldoaXRlYm9hcmRTdHJva2VzVGFibGVcIixcclxuICAgICAge1xyXG4gICAgICAgIHRhYmxlTmFtZTogYCR7cHJlZml4bmFtZX0tV2hpdGVib2FyZFN0cm9rZXNgLFxyXG4gICAgICAgIHBhcnRpdGlvbktleToge1xyXG4gICAgICAgICAgbmFtZTogXCJib2FyZElkXCIsXHJcbiAgICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcclxuICAgICAgICB9LFxyXG4gICAgICAgIHNvcnRLZXk6IHsgbmFtZTogXCJ0aW1lc3RhbXBcIiwgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5OVU1CRVIgfSxcclxuICAgICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxyXG4gICAgICAgIHJlbW92YWxQb2xpY3k6IFJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgICAgfVxyXG4gICAgKTtcclxuXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIAgV2Vic2l0ZSBBY3Rpdml0eSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIHRoaXMud2Vic2l0ZUFjdGl2aXR5VGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUoXHJcbiAgICAgIHRoaXMsXHJcbiAgICAgIFwiV2Vic2l0ZUFjdGl2aXR5VGFibGVcIixcclxuICAgICAge1xyXG4gICAgICAgIHRhYmxlTmFtZTogYCR7cHJlZml4bmFtZX0tV2Vic2l0ZUFjdGl2aXR5YCxcclxuICAgICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogXCJwa1wiLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICAgIHNvcnRLZXk6IHsgbmFtZTogXCJza1wiLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXHJcbiAgICAgICAgcmVtb3ZhbFBvbGljeTogUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgICAgIHRpbWVUb0xpdmVBdHRyaWJ1dGU6IFwidHRsXCIsXHJcbiAgICAgIH1cclxuICAgICk7XHJcblxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAIERhaWx5IFN1bW1hcmllcyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIHRoaXMuZGFpbHlTdW1tYXJpZXNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZShcclxuICAgICAgdGhpcyxcclxuICAgICAgXCJEYWlseVN1bW1hcmllc1RhYmxlXCIsXHJcbiAgICAgIHtcclxuICAgICAgICB0YWJsZU5hbWU6IGAke3ByZWZpeG5hbWV9LURhaWx5U3VtbWFyaWVzYCxcclxuICAgICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogXCJkYXRlXCIsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgICAgc29ydEtleToge1xyXG4gICAgICAgICAgbmFtZTogXCJ0aW1lc3RhbXBcIixcclxuICAgICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSLFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcclxuICAgICAgICByZW1vdmFsUG9saWN5OiBSZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICAgICAgdGltZVRvTGl2ZUF0dHJpYnV0ZTogXCJ0dGxcIixcclxuICAgICAgfVxyXG4gICAgKTtcclxuXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIAgQWxleGEgVXNlcnMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICB0aGlzLmFsZXhhVXNlcnNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCBcIkFsZXhhVXNlcnNUYWJsZVwiLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogYCR7cHJlZml4bmFtZX0tQWxleGFVc2Vyc1RhYmxlYCxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7XHJcbiAgICAgICAgbmFtZTogXCJ1c2VySWRcIixcclxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcclxuICAgICAgfSxcclxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcclxuICAgICAgcmVtb3ZhbFBvbGljeTogUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAIFBsdWcgQWN0aW9ucyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIHRoaXMucGx1Z0FjdGlvbnNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCBcIlBsdWdBY3Rpb25zVGFibGVcIiwge1xyXG4gICAgICB0YWJsZU5hbWU6IGAke3ByZWZpeG5hbWV9LVBsdWdBY3Rpb25zVGFibGVgLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcclxuICAgICAgICBuYW1lOiBcInVzZXJfaWRcIixcclxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcclxuICAgICAgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiBcInRzXCIsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IFJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMucGx1Z0FjdGlvbnNUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgIGluZGV4TmFtZTogXCJwbHVnX2lkLXRzLWluZGV4XCIsXHJcbiAgICAgIHBhcnRpdGlvbktleToge1xyXG4gICAgICAgIG5hbWU6IFwicGx1Z19pZFwiLFxyXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxyXG4gICAgICB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6IFwidHNcIiwgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5OVU1CRVIgfSxcclxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgCBJb1QgVGVsZW1ldHJ5IOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgdGhpcy5pb3RUZWxlbWV0cnlUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCBcIklvVFRlbGVtZXRyeVRhYmxlXCIsIHtcclxuICAgICAgdGFibGVOYW1lOiBgJHtwcmVmaXhuYW1lfS1Jb1REZXZpY2VUZWxlbWV0cnlgLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcclxuICAgICAgICBuYW1lOiBcImRldmljZVwiLFxyXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxyXG4gICAgICB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6IFwidHNcIiwgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5OVU1CRVIgfSxcclxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcclxuICAgICAgcmVtb3ZhbFBvbGljeTogUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgICB0aW1lVG9MaXZlQXR0cmlidXRlOiBcImV4cGlyZXNfYXRcIixcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgCBDaGF0Ym90IOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgdGhpcy5jaGF0Ym90VGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgXCJVbml0eUNoYXRib3RUYWJsZVwiLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogYCR7cHJlZml4bmFtZX0tVW5pdHlDaGF0Ym90VGFibGVgLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcclxuICAgICAgICBuYW1lOiBcInNlc3Npb25JZFwiLFxyXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxyXG4gICAgICB9LFxyXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBSZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIAgVmlzaXRvciBGZWVkYmFjayDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIHRoaXMudmlzaXRvckZlZWRiYWNrVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUoXHJcbiAgICAgIHRoaXMsXHJcbiAgICAgIFwiVmlzaXRvckZlZWRiYWNrVGFibGVcIixcclxuICAgICAge1xyXG4gICAgICAgIHRhYmxlTmFtZTogYCR7cHJlZml4bmFtZX0tVmlzaXRvckZlZWRiYWNrYCxcclxuICAgICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogXCJpZFwiLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXHJcbiAgICAgICAgcmVtb3ZhbFBvbGljeTogUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgICB9XHJcbiAgICApO1xyXG5cclxuICAgIHRoaXMudmlzaXRvckZlZWRiYWNrVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgICBpbmRleE5hbWU6IFwidmlzaXRvcklkSW5kZXhcIixcclxuICAgICAgcGFydGl0aW9uS2V5OiB7XHJcbiAgICAgICAgbmFtZTogXCJ2aXNpdG9ySWRcIixcclxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcclxuICAgICAgfSxcclxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgCBJbnZpdGVkIFZpc2l0b3JzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgdGhpcy5pbnZpdGVkVmlzaXRvclRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKFxyXG4gICAgICB0aGlzLFxyXG4gICAgICBcIkludml0ZWRWaXNpdG9yVGFibGVcIixcclxuICAgICAge1xyXG4gICAgICAgIHRhYmxlTmFtZTogYCR7cHJlZml4bmFtZX0tSW52aXRlZFZpc2l0b3JUYWJsZWAsXHJcbiAgICAgICAgcGFydGl0aW9uS2V5OiB7XHJcbiAgICAgICAgICBuYW1lOiBcInZpc2l0b3JJZFwiLFxyXG4gICAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXHJcbiAgICAgICAgfSxcclxuICAgICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxyXG4gICAgICAgIHJlbW92YWxQb2xpY3k6IFJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgICAgfVxyXG4gICAgKTtcclxuXHJcbiAgICB0aGlzLmludml0ZWRWaXNpdG9yVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgICBpbmRleE5hbWU6IFwiRW1haWxWaXNpdERhdGVJbmRleFwiLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcclxuICAgICAgICBuYW1lOiBcImVtYWlsXCIsXHJcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXHJcbiAgICAgIH0sXHJcbiAgICAgIHNvcnRLZXk6IHtcclxuICAgICAgICBuYW1lOiBcInZpc2l0RGF0ZVwiLFxyXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxyXG4gICAgICB9LFxyXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAIFVzZWQgVG9rZW5zIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgdGhpcy51c2VkVG9rZW5zVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgXCJVc2VkVG9rZW5zVGFibGVcIiwge1xyXG4gICAgICB0YWJsZU5hbWU6IGAke3ByZWZpeG5hbWV9LVVzZWRUb2tlbnNUYWJsZWAsXHJcbiAgICAgIHBhcnRpdGlvbktleToge1xyXG4gICAgICAgIG5hbWU6IFwidG9rZW5cIixcclxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcclxuICAgICAgfSxcclxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcclxuICAgICAgcmVtb3ZhbFBvbGljeTogUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAIFZpc2l0b3IgSW1hZ2VzIEJ1Y2tldCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIHRoaXMudmlzaXRvckltYWdlc0J1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgXCJWaXNpdG9ySW1hZ2VzQnVja2V0XCIsIHtcclxuICAgICAgYnVja2V0TmFtZTogYCR7cHJlZml4bmFtZX0tdmlzaXRvci1pbWFnZXNgLFxyXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxyXG4gICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IFJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IHRydWUsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIAgT3V0cHV0cyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiSW52aXRlZFZpc2l0b3JUYWJsZU5hbWVcIiwge1xyXG4gICAgICB2YWx1ZTogdGhpcy5pbnZpdGVkVmlzaXRvclRhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgZXhwb3J0TmFtZTogYCR7cHJlZml4bmFtZX0tSW52aXRlZFZpc2l0b3JUYWJsZU5hbWVgLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJDb25uZWN0aW9uVGFibGVOYW1lXCIsIHtcclxuICAgICAgdmFsdWU6IHRoaXMuY29ubmVjdGlvblRhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgZXhwb3J0TmFtZTogYCR7cHJlZml4bmFtZX0tQ29ubmVjdGlvblRhYmxlTmFtZWAsXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIlZpc2l0b3JJbWFnZXNCdWNrZXROYW1lXCIsIHtcclxuICAgICAgdmFsdWU6IHRoaXMudmlzaXRvckltYWdlc0J1Y2tldC5idWNrZXROYW1lLFxyXG4gICAgICBleHBvcnROYW1lOiBgJHtwcmVmaXhuYW1lfS1WaXNpdG9ySW1hZ2VzQnVja2V0TmFtZWAsXHJcbiAgICB9KTtcclxuXHJcblxyXG5cclxuICAgIC8vc2FyYSBhZGRpdGlvbnNcclxuICAgIHRoaXMuYmFodHdpblRlc3RpbmdCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsIFwiQmFodHdpblRlc3RpbmdCdWNrZXRcIiwge1xyXG4gICAgICAvLyBidWNrZXROYW1lOiBgYmFodHdpbi10ZXN0aW5nLSR7Y2RrLlN0YWNrLm9mKHRoaXMpLmFjY291bnR9LSR7Y2RrLlN0YWNrLm9mKHRoaXMpLnJlZ2lvbn1gLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBSZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICAgIGF1dG9EZWxldGVPYmplY3RzOiB0cnVlLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJCYWh0d2luVGVzdGluZ0J1Y2tldE5hbWVPdXRwdXRcIiwge1xyXG4gICAgICB2YWx1ZTogdGhpcy5iYWh0d2luVGVzdGluZ0J1Y2tldC5idWNrZXROYW1lLFxyXG4gICAgICBleHBvcnROYW1lOiBgJHtwcmVmaXhuYW1lfS1CYWh0d2luVGVzdGluZ0J1Y2tldE5hbWVgLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAIFJla29nbml0aW9uIENvbGxlY3Rpb24g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICB0aGlzLnZpc2l0b3JGYWNlQ29sbGVjdGlvbiA9IG5ldyByZWtvZ25pdGlvbi5DZm5Db2xsZWN0aW9uKHRoaXMsIFwiVmlzaXRvckZhY2VDb2xsZWN0aW9uXCIsIHtcclxuICAgICAgY29sbGVjdGlvbklkOiBgJHtwcmVmaXhuYW1lfS12aXNpdG9yLWZhY2UtY29sbGVjdGlvbmAsXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIlZpc2l0b3JGYWNlQ29sbGVjdGlvbklkT3V0cHV0XCIsIHtcclxuICAgICAgdmFsdWU6IHRoaXMudmlzaXRvckZhY2VDb2xsZWN0aW9uLmNvbGxlY3Rpb25JZCEsXHJcbiAgICAgIGV4cG9ydE5hbWU6IGAke3ByZWZpeG5hbWV9LVZpc2l0b3JGYWNlQ29sbGVjdGlvbklkYCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgCBGYWNpYWwgV1MgQ29ubmVjdGlvbiBUYWJsZSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIHRoaXMuZmFjaWFsV3NDb25uZWN0aW9uc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsIFwiRmFjaWFsV3NDb25uZWN0aW9uVGFibGVcIiwge1xyXG4gICAgICAvLyB0YWJsZU5hbWU6IGAke3ByZWZpeG5hbWV9LUZhY2lhbFdzQ29ubmVjdGlvblRhYmxlYCxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6IFwiQ29ubmVjdGlvbklkXCIsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IFJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgICAgdGltZVRvTGl2ZUF0dHJpYnV0ZTogXCJ0dGxcIixcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiRmFjaWFsV3NDb25uZWN0aW9uVGFibGVOYW1lT3V0cHV0XCIsIHtcclxuICAgICAgdmFsdWU6IHRoaXMuZmFjaWFsV3NDb25uZWN0aW9uc1RhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgZXhwb3J0TmFtZTogYCR7cHJlZml4bmFtZX0tRmFjaWFsV3NDb25uZWN0aW9uVGFibGVOYW1lYCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vbW9kaWZpZWQgYmFzZWQgb24gc2FyYSBhZGRpdGlvbnMgYWJvdmVcclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiVXNlck1hbmFnZW1lbnRUYWJsZU5hbWVPdXRwdXRcIiwge1xyXG4gICAgICB2YWx1ZTogdGhpcy51c2VyTWFuYWdlbWVudFRhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgZXhwb3J0TmFtZTogYCR7cHJlZml4bmFtZX0tVXNlck1hbmFnZW1lbnRUYWJsZU5hbWVgLFxyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcbiJdfQ==