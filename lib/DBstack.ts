import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cdk from "aws-cdk-lib";
import { Stack, StackProps, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";
import { aws_rekognition as rekognition } from "aws-cdk-lib";

export class DBStack extends Stack {
  public readonly table: dynamodb.Table;
  public readonly userManagementTable: dynamodb.Table;
  public readonly preRegBucket: s3.Bucket;
  public readonly chatbotTable: dynamodb.Table;

  public readonly activeConnectionsTable: dynamodb.Table;
  public readonly connectionTable: dynamodb.Table;
  public readonly whiteboardStrokesTable: dynamodb.Table;
  public readonly websiteActivityTable: dynamodb.Table;
  public readonly dailySummariesTable: dynamodb.Table;
  public readonly alexaUsersTable: dynamodb.Table;

  public readonly plugActionsTable: dynamodb.Table;
  public readonly iotTelemetryTable: dynamodb.Table;

  public readonly visitorFeedbackTable: dynamodb.Table;
  public readonly invitedVisitorTable: dynamodb.Table;
  public readonly usedTokensTable: dynamodb.Table;

  public readonly visitorImagesBucket: s3.Bucket;

  //sara additions
  public readonly bahtwinTestingBucket: s3.Bucket;

  public readonly visitorFaceCollection: rekognition.CfnCollection;

  public readonly facialWsConnectionsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const prefixname = this.stackName.split("-")[0].toLowerCase();

    // ───────────────────── UnityBahtwin ─────────────────────
    this.table = new dynamodb.Table(this, "BahtwinTable", {
      tableName: `${prefixname}-UnityBahtwinTable`,
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // ───────────────────── User Management ─────────────────────
    this.userManagementTable = new dynamodb.Table(this, "UserManagementTable", {
      tableName: `${prefixname}-UserManagementTable`,
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
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
      removalPolicy: RemovalPolicy.DESTROY,
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
    this.activeConnectionsTable = new dynamodb.Table(
      this,
      "ActiveConnectionsTable",
      {
        tableName: `${prefixname}-ActiveConnections`,
        partitionKey: {
          name: "connectionId",
          type: dynamodb.AttributeType.STRING,
        },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: RemovalPolicy.DESTROY,
        timeToLiveAttribute: "ttl",
      }
    );

    // Separate Connection Table (for APIs / chat)
    this.connectionTable = new dynamodb.Table(this, "ConnectionTable", {
      tableName: `${prefixname}-ConnectionTable`,
      partitionKey: {
        name: "connectionId",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
      timeToLiveAttribute: "ttl",
    });

    // ───────────────────── Whiteboard ─────────────────────
    this.whiteboardStrokesTable = new dynamodb.Table(
      this,
      "WhiteboardStrokesTable",
      {
        tableName: `${prefixname}-WhiteboardStrokes`,
        partitionKey: {
          name: "boardId",
          type: dynamodb.AttributeType.STRING,
        },
        sortKey: { name: "timestamp", type: dynamodb.AttributeType.NUMBER },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: RemovalPolicy.DESTROY,
      }
    );

    // ───────────────────── Website Activity ─────────────────────
    this.websiteActivityTable = new dynamodb.Table(
      this,
      "WebsiteActivityTable",
      {
        tableName: `${prefixname}-WebsiteActivity`,
        partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
        sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: RemovalPolicy.DESTROY,
        timeToLiveAttribute: "ttl",
      }
    );

    // ───────────────────── Daily Summaries ─────────────────────
    this.dailySummariesTable = new dynamodb.Table(
      this,
      "DailySummariesTable",
      {
        tableName: `${prefixname}-DailySummaries`,
        partitionKey: { name: "date", type: dynamodb.AttributeType.STRING },
        sortKey: {
          name: "timestamp",
          type: dynamodb.AttributeType.NUMBER,
        },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: RemovalPolicy.DESTROY,
        timeToLiveAttribute: "ttl",
      }
    );

    // ───────────────────── Alexa Users ─────────────────────
    this.alexaUsersTable = new dynamodb.Table(this, "AlexaUsersTable", {
      tableName: `${prefixname}-AlexaUsersTable`,
      partitionKey: {
        name: "userId",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
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
      removalPolicy: RemovalPolicy.DESTROY,
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
      removalPolicy: RemovalPolicy.DESTROY,
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
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // ───────────────────── Visitor Feedback ─────────────────────
    this.visitorFeedbackTable = new dynamodb.Table(
      this,
      "VisitorFeedbackTable",
      {
        tableName: `${prefixname}-VisitorFeedback`,
        partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: RemovalPolicy.DESTROY,
      }
    );

    this.visitorFeedbackTable.addGlobalSecondaryIndex({
      indexName: "visitorIdIndex",
      partitionKey: {
        name: "visitorId",
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ───────────────────── Invited Visitors ─────────────────────
    this.invitedVisitorTable = new dynamodb.Table(
      this,
      "InvitedVisitorTable",
      {
        tableName: `${prefixname}-InvitedVisitorTable`,
        partitionKey: {
          name: "visitorId",
          type: dynamodb.AttributeType.STRING,
        },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: RemovalPolicy.DESTROY,
      }
    );

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
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // ───────────────────── Visitor Images Bucket ─────────────────────
    this.visitorImagesBucket = new s3.Bucket(this, "VisitorImagesBucket", {
      bucketName: `${prefixname}-visitor-images`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
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
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    new cdk.CfnOutput(this, "BahtwinTestingBucketNameOutput", {
      value: this.bahtwinTestingBucket.bucketName,
      exportName: `${prefixname}-BahtwinTestingBucketName`,
    });

    // ───────────────────── Rekognition Collection ─────────────────────
    this.visitorFaceCollection = new rekognition.CfnCollection(this, "VisitorFaceCollection", {
      collectionId: `${prefixname}-visitor-face-collection`,
    });

    new cdk.CfnOutput(this, "VisitorFaceCollectionIdOutput", {
      value: this.visitorFaceCollection.collectionId!,
      exportName: `${prefixname}-VisitorFaceCollectionId`,
    });

    // ───────────────────── Facial WS Connection Table ─────────────────────
    this.facialWsConnectionsTable = new dynamodb.Table(this, "FacialWsConnectionTable", {
      // tableName: `${prefixname}-FacialWsConnectionTable`,
      partitionKey: { name: "ConnectionId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
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
