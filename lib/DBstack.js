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
const aws_cdk_lib_1 = require("aws-cdk-lib");
class DBStack extends aws_cdk_lib_1.Stack {
    table; // UnityBahtwin
    userManagementTable;
    preRegBucket;
    chatbotTable;
    plugActionsTable;
    iotTelemetryTable;
    constructor(scope, id, props) {
        super(scope, id, props);
        /* -------------------------------
           1) Main application table
        -------------------------------- */
        const prefixname = this.stackName.split('-')[0].toLowerCase();
        this.table = new dynamodb.Table(this, "BahtwinTable", {
            tableName: `${prefixname}-BahtwinTable`,
            partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
            sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
        });
        new aws_cdk_lib_1.CfnOutput(this, "UnityBahtwinTableName", {
            value: this.table.tableName,
        });
        /* -------------------------------
           2) User management table
        -------------------------------- */
        this.userManagementTable = new dynamodb.Table(this, "UserManagementTable", {
            tableName: `${prefixname}-UserManagement`,
            partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
        });
        /* -------------------------------
           3) Pre-registration bucket
        -------------------------------- */
        this.preRegBucket = new s3.Bucket(this, "PreregistrationImagesBucket", {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            autoDeleteObjects: true,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
        });
        this.preRegBucket.addCorsRule({
            allowedOrigins: ["*"],
            allowedMethods: [
                s3.HttpMethods.GET,
                s3.HttpMethods.POST,
                s3.HttpMethods.PUT,
            ],
            allowedHeaders: ["*"],
        });
        /* -------------------------------
           4) Chatbot table (Bedrock)
        -------------------------------- */
        this.chatbotTable = new dynamodb.TableV2(this, "ChatbotTable", {
            partitionKey: {
                name: "sessionId",
                type: dynamodb.AttributeType.STRING,
            },
        });
        new aws_cdk_lib_1.CfnOutput(this, "ChatbotTableName", {
            value: this.chatbotTable.tableName,
        });
        /* -------------------------------
           5) Plug actions table
        -------------------------------- */
        this.plugActionsTable = new dynamodb.Table(this, "PlugActionsTable", {
            tableName: `${prefixname}-PlugActions`,
            partitionKey: { name: "user_id", type: dynamodb.AttributeType.STRING },
            sortKey: { name: "ts", type: dynamodb.AttributeType.NUMBER },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
        });
        /* -------------------------------
           6) IoT telemetry table
        -------------------------------- */
        this.iotTelemetryTable = new dynamodb.Table(this, "IoTTelemetryTable", {
            tableName: `${prefixname}-IoTDeviceTelemetry`,
            partitionKey: { name: "device", type: dynamodb.AttributeType.STRING },
            sortKey: { name: "ts", type: dynamodb.AttributeType.NUMBER },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
        });
    }
}
exports.DBStack = DBStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiREJzdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIkRCc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxtRUFBcUQ7QUFDckQsdURBQXlDO0FBQ3pDLDZDQUEwRTtBQUcxRSxNQUFhLE9BQVEsU0FBUSxtQkFBSztJQUNoQixLQUFLLENBQWlCLENBQWEsZUFBZTtJQUNsRCxtQkFBbUIsQ0FBaUI7SUFDcEMsWUFBWSxDQUFZO0lBQ3hCLFlBQVksQ0FBbUI7SUFDL0IsZ0JBQWdCLENBQWlCO0lBQ2pDLGlCQUFpQixDQUFpQjtJQUVsRCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQWtCO1FBQzFELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCOzsyQ0FFbUM7UUFDbkMsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7UUFFOUQsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRTtZQUNwRCxTQUFTLEVBQUUsR0FBRyxVQUFVLGVBQWU7WUFDdkMsWUFBWSxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUU7WUFDakUsT0FBTyxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUU7WUFDNUQsV0FBVyxFQUFFLFFBQVEsQ0FBQyxXQUFXLENBQUMsZUFBZTtZQUNqRCxhQUFhLEVBQUUsMkJBQWEsQ0FBQyxPQUFPO1NBQ3JDLENBQUMsQ0FBQztRQUVILElBQUksdUJBQVMsQ0FBQyxJQUFJLEVBQUUsdUJBQXVCLEVBQUU7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WUFDakQsYUFBYSxFQUFFLDJCQUFhLENBQUMsT0FBTztTQUNyQyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUE5RkQsMEJBOEZDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSBcImF3cy1jZGstbGliL2F3cy1keW5hbW9kYlwiO1xyXG5pbXBvcnQgKiBhcyBzMyBmcm9tIFwiYXdzLWNkay1saWIvYXdzLXMzXCI7XHJcbmltcG9ydCB7IFN0YWNrLCBTdGFja1Byb3BzLCBSZW1vdmFsUG9saWN5LCBDZm5PdXRwdXQgfSBmcm9tIFwiYXdzLWNkay1saWJcIjtcclxuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSBcImNvbnN0cnVjdHNcIjtcclxuXHJcbmV4cG9ydCBjbGFzcyBEQlN0YWNrIGV4dGVuZHMgU3RhY2sge1xyXG4gIHB1YmxpYyByZWFkb25seSB0YWJsZTogZHluYW1vZGIuVGFibGU7ICAgICAgICAgICAgIC8vIFVuaXR5QmFodHdpblxyXG4gIHB1YmxpYyByZWFkb25seSB1c2VyTWFuYWdlbWVudFRhYmxlOiBkeW5hbW9kYi5UYWJsZTtcclxuICBwdWJsaWMgcmVhZG9ubHkgcHJlUmVnQnVja2V0OiBzMy5CdWNrZXQ7XHJcbiAgcHVibGljIHJlYWRvbmx5IGNoYXRib3RUYWJsZTogZHluYW1vZGIuVGFibGVWMjtcclxuICBwdWJsaWMgcmVhZG9ubHkgcGx1Z0FjdGlvbnNUYWJsZTogZHluYW1vZGIuVGFibGU7XHJcbiAgcHVibGljIHJlYWRvbmx5IGlvdFRlbGVtZXRyeVRhYmxlOiBkeW5hbW9kYi5UYWJsZTtcclxuXHJcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBTdGFja1Byb3BzKSB7XHJcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcclxuXHJcbiAgICAvKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAgICAgICAxKSBNYWluIGFwcGxpY2F0aW9uIHRhYmxlXHJcbiAgICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG4gICAgY29uc3QgcHJlZml4bmFtZSA9IHRoaXMuc3RhY2tOYW1lLnNwbGl0KCctJylbMF0udG9Mb3dlckNhc2UoKTtcclxuXHJcbiAgICB0aGlzLnRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsIFwiQmFodHdpblRhYmxlXCIsIHtcclxuICAgICAgdGFibGVOYW1lOiBgJHtwcmVmaXhuYW1lfS1CYWh0d2luVGFibGVgLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogXCJwa1wiLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6IFwic2tcIiwgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcclxuICAgICAgcmVtb3ZhbFBvbGljeTogUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCBcIlVuaXR5QmFodHdpblRhYmxlTmFtZVwiLCB7XHJcbiAgICAgIHZhbHVlOiB0aGlzLnRhYmxlLnRhYmxlTmFtZSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgICAgIDIpIFVzZXIgbWFuYWdlbWVudCB0YWJsZVxyXG4gICAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuICAgIHRoaXMudXNlck1hbmFnZW1lbnRUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCBcIlVzZXJNYW5hZ2VtZW50VGFibGVcIiwge1xyXG4gICAgICB0YWJsZU5hbWU6IGAke3ByZWZpeG5hbWV9LVVzZXJNYW5hZ2VtZW50YCxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6IFwidXNlcklkXCIsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IFJlbW92YWxQb2xpY3kuREVTVFJPWSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgICAgIDMpIFByZS1yZWdpc3RyYXRpb24gYnVja2V0XHJcbiAgICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG4gICAgdGhpcy5wcmVSZWdCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsIFwiUHJlcmVnaXN0cmF0aW9uSW1hZ2VzQnVja2V0XCIsIHtcclxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcclxuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxyXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogdHJ1ZSxcclxuICAgICAgcmVtb3ZhbFBvbGljeTogUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5wcmVSZWdCdWNrZXQuYWRkQ29yc1J1bGUoe1xyXG4gICAgICBhbGxvd2VkT3JpZ2luczogW1wiKlwiXSxcclxuICAgICAgYWxsb3dlZE1ldGhvZHM6IFtcclxuICAgICAgICBzMy5IdHRwTWV0aG9kcy5HRVQsXHJcbiAgICAgICAgczMuSHR0cE1ldGhvZHMuUE9TVCxcclxuICAgICAgICBzMy5IdHRwTWV0aG9kcy5QVVQsXHJcbiAgICAgIF0sXHJcbiAgICAgIGFsbG93ZWRIZWFkZXJzOiBbXCIqXCJdLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgICAgNCkgQ2hhdGJvdCB0YWJsZSAoQmVkcm9jaylcclxuICAgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcbiAgICB0aGlzLmNoYXRib3RUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZVYyKHRoaXMsIFwiQ2hhdGJvdFRhYmxlXCIsIHtcclxuICAgICAgcGFydGl0aW9uS2V5OiB7XHJcbiAgICAgICAgbmFtZTogXCJzZXNzaW9uSWRcIixcclxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgXCJDaGF0Ym90VGFibGVOYW1lXCIsIHtcclxuICAgICAgdmFsdWU6IHRoaXMuY2hhdGJvdFRhYmxlLnRhYmxlTmFtZSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgICAgIDUpIFBsdWcgYWN0aW9ucyB0YWJsZVxyXG4gICAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuICAgIHRoaXMucGx1Z0FjdGlvbnNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCBcIlBsdWdBY3Rpb25zVGFibGVcIiwge1xyXG4gICAgICB0YWJsZU5hbWU6IGAke3ByZWZpeG5hbWV9LVBsdWdBY3Rpb25zYCxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6IFwidXNlcl9pZFwiLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6IFwidHNcIiwgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5OVU1CRVIgfSxcclxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcclxuICAgICAgcmVtb3ZhbFBvbGljeTogUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgICAgNikgSW9UIHRlbGVtZXRyeSB0YWJsZVxyXG4gICAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuICAgIHRoaXMuaW90VGVsZW1ldHJ5VGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgXCJJb1RUZWxlbWV0cnlUYWJsZVwiLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogYCR7cHJlZml4bmFtZX0tSW9URGV2aWNlVGVsZW1ldHJ5YCxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6IFwiZGV2aWNlXCIsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogXCJ0c1wiLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLk5VTUJFUiB9LFxyXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBSZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICB9KTtcclxuICB9XHJcbn1cclxuIl19