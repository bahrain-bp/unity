// lib/AlexaStack.ts

import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as path from "path";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { DBStack } from "./DBstack";

interface AlexaStackProps extends cdk.StackProps {
  dbStack: DBStack;
}

export class AlexaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AlexaStackProps) {
    super(scope, id, props);

    const alexaHandler = new NodejsFunction(this, "AlexaAdminLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,

      entry: path.join(
        __dirname,
        "../lambda/echoShow/alexa/alexaAdminHandler.ts"
      ),

      handler: "handler",

      bundling: {
        forceDockerBundling: false,
      },

      environment: {
        ACTIVE_CONNECTIONS_TABLE: props.dbStack.activeConnectionsTable.tableName,
        SUMMARIES_TABLE: props.dbStack.dailySummariesTable.tableName,
        WEBSITE_ACTIVITY_TABLE: props.dbStack.websiteActivityTable.tableName,
        ALEXA_USERS_TABLE: props.dbStack.alexaUsersTable.tableName,
        TELEMETRY_API: process.env.TELEMETRY_API ?? "",
        TELEMETRY_AUTH_HEADER: process.env.TELEMETRY_AUTH_HEADER ?? "",
      },

      timeout: cdk.Duration.seconds(10),
    });

    // Grant read access to both tables
    props.dbStack.activeConnectionsTable.grantReadData(alexaHandler);
    props.dbStack.dailySummariesTable.grantReadData(alexaHandler);
    props.dbStack.alexaUsersTable.grantReadWriteData(alexaHandler);
    props.dbStack.websiteActivityTable.grantReadData(alexaHandler);

    // Allow Bedrock narration for Alexa responses
    alexaHandler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["bedrock:InvokeModel"],
        resources: [
          `arn:aws:bedrock:${this.region}::foundation-model/amazon.nova-pro-v1:0`,
        ],
      })
    );

    alexaHandler.addPermission("AlexaInvokePermission", {
      principal: new iam.ServicePrincipal("alexa-appkit.amazon.com"),
      action: "lambda:InvokeFunction",
    });

    new cdk.CfnOutput(this, "AlexaLambdaArn", {
      value: alexaHandler.functionArn,
    });
  }
}

