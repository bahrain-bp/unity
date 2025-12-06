import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Stack, StackProps, RemovalPolicy, CfnOutput, Duration } from "aws-cdk-lib";
import { Construct } from "constructs";

export class DBStack extends Stack {
  public readonly table: dynamodb.Table;
  public readonly preRegBucket: s3.Bucket; // declare bucket as a property

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // DynamoDB table
    this.table = new dynamodb.Table(this, "BahtwinTable", {
      tableName: "UnityBahtwinTable",
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY, // dev only
    });

    new CfnOutput(this, "UnityBahtwinTableNameOutput", {
      value: this.table.tableName,
      exportName: "UnityBahtwinTableName",
    });
    
    // Bucket for preregistration user images (temporary)
this.preRegBucket = new s3.Bucket(this, "PreregistrationImagesBucket", {
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  encryption: s3.BucketEncryption.S3_MANAGED,
  removalPolicy: RemovalPolicy.DESTROY,
  autoDeleteObjects: true, 
});


// Allow all origins for development
this.preRegBucket.addCorsRule({
  allowedOrigins: ["*"],
  allowedMethods: [
    s3.HttpMethods.GET,
    s3.HttpMethods.POST,
    s3.HttpMethods.PUT
  ],
  allowedHeaders: ["*"],
});

// ───────────── Lifecycle rule ─────────────
this.preRegBucket.addLifecycleRule({
  id: "TempPreRegCleanup",
  prefix: "temp/registration/",
  expiration: Duration.days(1),
});

// Output the bucket name for other stacks
new CfnOutput(this, "PreregistrationImagesBucketNameOutput", {
  value: this.preRegBucket.bucketName,
  exportName: "PreregistrationImagesBucketName",
});
  }
}