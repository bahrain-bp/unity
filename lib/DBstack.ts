import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cdk from "aws-cdk-lib";
import { Stack, StackProps, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";

export class DBStack extends Stack {
  public readonly table: dynamodb.Table;             // UnityBahtwin
  public readonly plugActionsTable: dynamodb.Table;  // PlugActions
  public readonly iotTelemetryTable: dynamodb.Table; // IoTDeviceTelemetry
  public readonly userManagementTable: dynamodb.Table;
  public readonly chatbotTable: dynamodb.Table;
  public readonly preRegBucket: s3.Bucket;

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
