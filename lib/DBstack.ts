import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cdk from "aws-cdk-lib";
import { Stack, StackProps, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";

export class DBStack extends Stack {
  public readonly table: dynamodb.Table;
  public readonly userManagementTable: dynamodb.Table;
  public readonly preRegBucket: s3.Bucket;

  public readonly chatbotTable: dynamodb.Table; 

  public readonly activeConnectionsTable: dynamodb.Table;
  public readonly whiteboardStrokesTable: dynamodb.Table;
  public readonly websiteActivityTable: dynamodb.Table;
  public readonly dailySummariesTable: dynamodb.Table;
  public readonly alexaUsersTable: dynamodb.Table;

  public readonly plugActionsTable: dynamodb.Table;
  public readonly iotTelemetryTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // 1) UnityBahtwin
    this.table = new dynamodb.Table(this, "BahtwinTable", {
      tableName: "UnityBahtwinTable",
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    new cdk.CfnOutput(this, "UnityBahtwinTableNameOutput", {
      value: this.table.tableName,
      exportName: "UnityBahtwinTableName",
    });

    // 2) User management
    this.userManagementTable = new dynamodb.Table(this, "UserManagementTable", {
      tableName: "UserManagement",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // 3) PreReg bucket
    this.preRegBucket = new s3.Bucket(this, "PreregistrationImagesBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedOrigins: ["*"],
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.POST, s3.HttpMethods.PUT],
          allowedHeaders: ["*"],
        },
      ],
    });

    this.preRegBucket.addCorsRule({
      allowedOrigins: ["*"],
      allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.POST, s3.HttpMethods.PUT],
      allowedHeaders: ["*"],
    });

    // Active WebSocket connections
    this.activeConnectionsTable = new dynamodb.Table(this, "ActiveConnectionsTable", {
      tableName: "ActiveConnections",
      partitionKey: { name: "connectionId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
      timeToLiveAttribute: "ttl",
    });

    // Whiteboard strokes history table
    this.whiteboardStrokesTable = new dynamodb.Table(this, "WhiteboardStrokesTable", {
      tableName: "WhiteboardStrokes",
      partitionKey: { name: "boardId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "timestamp", type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Website activity analytics table
    this.websiteActivityTable = new dynamodb.Table(this, "WebsiteActivityTable", {
      tableName: "WebsiteActivity",
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
      timeToLiveAttribute: "ttl",
    });

    // Daily summaries
    this.dailySummariesTable = new dynamodb.Table(this, "DailySummariesTable", {
      tableName: "bahtwin-daily-summaries",
      partitionKey: { name: "date", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "timestamp", type: dynamodb.AttributeType.NUMBER },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: "ttl",
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // Alexa users table
    this.alexaUsersTable = new dynamodb.Table(this, "AlexaUsersTable", {
      tableName: "alexa-users",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new cdk.CfnOutput(this, "AlexaUsersTableName", {
      value: this.alexaUsersTable.tableName,
      exportName: "AlexaUsersTableName",
    });

    // 4) PlugActions
    this.plugActionsTable = new dynamodb.Table(this, "PlugActionsTable", {
      tableName: "PlugActions",
      partitionKey: { name: "user_id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "ts", type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.plugActionsTable.addGlobalSecondaryIndex({
      indexName: "plug_id-ts-index",
      partitionKey: { name: "plug_id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "ts", type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    new cdk.CfnOutput(this, "PlugActionsTableNameOutput", {
      value: this.plugActionsTable.tableName,
      exportName: "PlugActionsTableName",
    });

    // 5) IoT telemetry
    this.iotTelemetryTable = new dynamodb.Table(this, "IoTTelemetryTable", {
      tableName: "IoTDeviceTelemetry",
      partitionKey: { name: "device", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "ts", type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
      timeToLiveAttribute: "expires_at",
    });

    new cdk.CfnOutput(this, "IoTDeviceTelemetryTableNameOutput", {
      value: this.iotTelemetryTable.tableName,
      exportName: "IoTDeviceTelemetryTableName",
    });

    // 6) Chatbot
    this.chatbotTable = new dynamodb.Table(this, "UnityChatbotTable", {
      tableName: "UnityChatbotTable",
      partitionKey: { name: "sessionId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "createdAt", type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    new cdk.CfnOutput(this, "UnityChatbotTableNameOutput", {
      value: this.chatbotTable.tableName,
      exportName: "UnityChatbotTable",
    });
  }
}
