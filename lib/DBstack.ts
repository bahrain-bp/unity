import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Stack, StackProps, RemovalPolicy, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";

export class DBStack extends Stack {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Single DynamoDB table for Bahtwin
    this.table = new dynamodb.Table(this, "BahtwinTable", {
      tableName: "UnityBahtwinTable",      // physical name 
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY, // dev only
    });

    new CfnOutput(this, "UnityBahtwinTableNameOutput", {
      value: this.table.tableName,
      exportName: "UnityBahtwinTableName", 
    });
  }
}
