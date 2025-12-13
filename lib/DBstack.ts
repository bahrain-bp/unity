import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Stack, StackProps, RemovalPolicy, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";

export class DBStack extends Stack {
  public readonly table: dynamodb.Table;
  public readonly userManagementTable: dynamodb.Table;
  public readonly preRegBucket: s3.Bucket;
  public readonly chatbotTable : dynamodb.TableV2;
  public readonly activeConnectionsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Main application table (UnityBahtwinTable)
    this.table = new dynamodb.Table(this, "BahtwinTable", {
      tableName: "UnityBahtwinTable",
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // User management table
    this.userManagementTable = new dynamodb.Table(this, "UserManagementTable", {
      tableName: "UserManagement",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Pre-registration images bucket
    this.preRegBucket = new s3.Bucket(this, "PreregistrationImagesBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    this.preRegBucket.addCorsRule({
      allowedOrigins: ["*"],
      allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.POST, s3.HttpMethods.PUT],
      allowedHeaders: ["*"],
    });

    this.chatbotTable = new dynamodb.TableV2(this, 'chatbotTable', {
            partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
        });

        new cdk.CfnOutput(this , 'tablenameoutput' , {
            value: this.chatbotTable.tableName,
            exportName: 'UnityChatbotTable',
        });

        //  Active WebSocket connections 
      this.activeConnectionsTable = new dynamodb.Table(
        this,
        "ActiveConnectionsTable",
        {
          tableName: "ActiveConnections",
          partitionKey: {
            name: "connectionId",
            type: dynamodb.AttributeType.STRING,
          },
          billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
          removalPolicy: RemovalPolicy.DESTROY, // dev only
          timeToLiveAttribute: "ttl", // auto-cleanup
        }
      );




  }
}