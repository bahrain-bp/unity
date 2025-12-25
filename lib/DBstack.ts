import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Stack, StackProps, RemovalPolicy, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";

export class DBStack extends Stack {
  public readonly table: dynamodb.Table;             // UnityBahtwin
  public readonly userManagementTable: dynamodb.Table;
  public readonly preRegBucket: s3.Bucket;
  public readonly chatbotTable: dynamodb.TableV2;
  public readonly plugActionsTable: dynamodb.Table;
  public readonly iotTelemetryTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: StackProps) {
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
      removalPolicy: RemovalPolicy.DESTROY,
    });

    new CfnOutput(this, "UnityBahtwinTableName", {
      value: this.table.tableName,
    });

    /* -------------------------------
       2) User management table
    -------------------------------- */
    this.userManagementTable = new dynamodb.Table(this, "UserManagementTable", {
      tableName: `${prefixname}-UserManagement`,
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    /* -------------------------------
       3) Pre-registration bucket
    -------------------------------- */
    this.preRegBucket = new s3.Bucket(this, "PreregistrationImagesBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
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

    new CfnOutput(this, "ChatbotTableName", {
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
      removalPolicy: RemovalPolicy.DESTROY,
    });

    /* -------------------------------
       6) IoT telemetry table
    -------------------------------- */
    this.iotTelemetryTable = new dynamodb.Table(this, "IoTTelemetryTable", {
      tableName: `${prefixname}-IoTDeviceTelemetry`,
      partitionKey: { name: "device", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "ts", type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }
}
