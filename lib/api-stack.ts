import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { DBStack } from "./DBstack"; // Import DBStack;
import { Construct } from "constructs";

export class APIStack extends cdk.Stack {
  constructor(scope: Construct, id: string, dbStack: DBStack, props?: cdk.StackProps) {
    super(scope, id, props);

    // Ensure DBStack is created before APIStack
    this.addDependency(dbStack);

    // Outputs for both APIs
    new cdk.CfnOutput(this, "BahtwinTableName", {
      value: dbStack.table.tableName,
      description: "Name of the DynamoDB table used by BAHTWIN",
    });

    new cdk.CfnOutput(this, "BahtwinTableArn", {
      value: dbStack.table.tableArn,
      description: "ARN of the DynamoDB table used by BAHTWIN",
    });
    
  }
}
