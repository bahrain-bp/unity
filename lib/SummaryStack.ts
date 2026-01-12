// lib/SummaryStack.ts (NEW FILE)

import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as path from "path";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { DBStack } from "./DBstack";

interface SummaryStackProps extends cdk.StackProps {
  dbStack: DBStack;
}

export class SummaryStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SummaryStackProps) {
    super(scope, id, props);

    // Lambda: Generate Daily Summary
    const summaryGenerator = new NodejsFunction(this, "SummaryGeneratorLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(
        __dirname,
        "../lambda/echoShow/alexa/handlers/generateDailySummary.ts"
      ),
      handler: "handler",
      bundling: {
        forceDockerBundling: false,
      },
      environment: {
        SUMMARIES_TABLE: props.dbStack.dailySummariesTable.tableName,
        WEBSITE_ACTIVITY_TABLE: props.dbStack.websiteActivityTable.tableName,
        ALEXA_USERS_TABLE: props.dbStack.alexaUsersTable.tableName,
        ALEXA_CLIENT_ID: process.env.ALEXA_CLIENT_ID ?? "",
        ALEXA_CLIENT_SECRET: process.env.ALEXA_CLIENT_SECRET ?? "",
        ALEXA_STAGE: process.env.ALEXA_STAGE ?? "development",
      },
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
    });

    // Grant DynamoDB permissions
    props.dbStack.dailySummariesTable.grantWriteData(summaryGenerator);
    props.dbStack.websiteActivityTable.grantReadData(summaryGenerator);
    props.dbStack.alexaUsersTable.grantReadData(summaryGenerator);

    // Grant Bedrock Nova permissions
    summaryGenerator.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["bedrock:InvokeModel"],
        resources: [
          `arn:aws:bedrock:${this.region}::foundation-model/amazon.nova-pro-v1:0`,
          `arn:aws:bedrock:${this.region}::foundation-model/amazon.nova-lite-v1:0`,
        ],
      })
    );

    // EventBridge Schedule: Weekdays at 5:00 PM Bahrain (UTC+3 => 14:00 UTC)
    const dailyRule = new events.Rule(this, "DailySummarySchedule", {
      schedule: events.Schedule.cron({
        minute: "0",
        hour: "14", // 5:00 PM Bahrain time
        weekDay: "MON-FRI",
        month: "*",
        year: "*",
      }),
      description: "Trigger daily summary generation at 5:00 PM Bahrain time on weekdays",
    });

    dailyRule.addTarget(new targets.LambdaFunction(summaryGenerator));

    // Outputs
    new cdk.CfnOutput(this, "SummaryGeneratorArn", {
      value: summaryGenerator.functionArn,
    });

    new cdk.CfnOutput(this, "EventBridgeRuleName", {
      value: dailyRule.ruleName,
    });
  }
}
