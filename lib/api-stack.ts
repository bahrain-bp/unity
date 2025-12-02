import * as cdk from "aws-cdk-lib";
//import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { DBStack } from "./DBstack";
import { Construct } from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iot from "aws-cdk-lib/aws-iot";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as path from "path";
import { BedrockStack } from "./bedrock_stack";
 
 
interface APIStackProps extends cdk.StackProps {
  dbStack: DBStack;
  bedrockStack: BedrockStack;
}
 
export class APIStack extends cdk.Stack {
constructor(scope: Construct, id: string, props: APIStackProps) {
  super(scope, id, props);
 
 const dbStack = props.dbStack;
  const bedrockStack = props.bedrockStack;
 
    // Ensure DBStack is created before APIStack
    this.addDependency(dbStack);
 
    // DynamoDB Outputs (already present)
    new cdk.CfnOutput(this, "BahtwinTableName", {
      value: dbStack.table.tableName,
      description: "Name of the DynamoDB table used by BAHTWIN",
    });
 
    new cdk.CfnOutput(this, "BahtwinTableArn", {
      value: dbStack.table.tableArn,
      description: "ARN of the DynamoDB table used by BAHTWIN",
    });
 
    // ────────────────────────────────
    // 1. Cognito User Pool
    // ────────────────────────────────
    const userPool = new cognito.UserPool(this, "UnityUserPool", {
      userPoolName: "unity-users",
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      standardAttributes: {
        email: { required: true, mutable: false },
      },
      passwordPolicy: {
        minLength: 8,
        requireDigits: true,
        requireLowercase: true,
        requireUppercase: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
    });
 
    const userPoolClient = new cognito.UserPoolClient(this, "UnityUserPoolClient", {
      userPool,
      generateSecret: false,
      authFlows: { userSrp: true, userPassword: true },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        callbackUrls: ["http://localhost:3000/callback"],
        logoutUrls: ["http://localhost:3000/"],
      },
    });
 
    const userPoolDomain = new cognito.UserPoolDomain(this, "UnityUserPoolDomain", {
      userPool,
      cognitoDomain: { domainPrefix: `unity-${this.account}-dev` },
    });
 
    new cdk.CfnOutput(this, "UserPoolId", {
      value: userPool.userPoolId,
    });
    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.userPoolClientId,
    });
    new cdk.CfnOutput(this, "UserPoolDomainUrl", {
      value: userPoolDomain.baseUrl(),
    });
 
    // ────────────────────────────────
    // 2. Lambda Function (hello)
    // ────────────────────────────────
    const helloFn = new lambda.Function(this, "HelloHandler", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "hello.handler", // points to lambda/hello.ts -> compiled to JS in /lambda
      code: lambda.Code.fromAsset("lambda"),
      environment: {
        TABLE_NAME: dbStack.table.tableName,
        USER_POOL_ID: userPool.userPoolId,
      },
    });
 
    // ────────────────────────────────
    // 3. API Gateway + Cognito Authorizer
    // ────────────────────────────────
    const api = new apigw.RestApi(this, "UnityRestApi", {
      restApiName: "Unity Service",
      deployOptions: { stageName: "dev" },
    });
 
    const authorizer = new apigw.CognitoUserPoolsAuthorizer(this, "UnityCognitoAuthorizer", {
      cognitoUserPools: [userPool],
    });
 
    const helloResource = api.root.addResource("hello");
    helloResource.addMethod("GET", new apigw.LambdaIntegration(helloFn), {
      authorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
    });
 
    new cdk.CfnOutput(this, "UnityApiUrl", {
      value: api.url,
    });
 
    // ────────────────────────────────
    // 4) IoT Core: Thing + Policy
    // ────────────────────────────────
    const thingName = "pi3-01";
 
    const piThing = new iot.CfnThing(this, "PiThing", { thingName });
 
    const piPolicy = new iot.CfnPolicy(this, "PiPolicy", {
      policyName: "Pi3Policy",
      policyDocument: {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: ["iot:Connect"],
            Resource: [`arn:aws:iot:${this.region}:${this.account}:client/${thingName}*`],
          },
          {
            Effect: "Allow",
            Action: ["iot:Publish"],
            Resource: [`arn:aws:iot:${this.region}:${this.account}:topic/${thingName}/#`],
          },
          {
            Effect: "Allow",
            Action: ["iot:Receive"],
            Resource: [`arn:aws:iot:${this.region}:${this.account}:topic/${thingName}/#`],
          },
          {
            Effect: "Allow",
            Action: ["iot:Subscribe"],
            Resource: [`arn:aws:iot:${this.region}:${this.account}:topicfilter/${thingName}/#`],
          },
        ],
      },
    });
 
    // ────────────────────────────────
    // 5) DynamoDB table for telemetry
    //    PK=device (string), SK=ts (number, epoch seconds)
    // ────────────────────────────────
    const telemTable = new dynamodb.Table(this, "TelemetryTable", {
      tableName: "PiTelemetry",
      partitionKey: { name: "device", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "ts", type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // change to RETAIN in prod
    });
 
    new cdk.CfnOutput(this, "TelemetryTableName", { value: telemTable.tableName });
 
    // ────────────────────────────────
    // 6) IoT Rule → DynamoDB (v2 action)
    // ────────────────────────────────
    const iotRuleRole = new iam.Role(this, "IotRuleDdbRole", {
      assumedBy: new iam.ServicePrincipal("iot.amazonaws.com"),
    });
    telemTable.grantWriteData(iotRuleRole);
 
    new iot.CfnTopicRule(this, "SavePiTelemetryRule", {
      topicRulePayload: {
        sql: "SELECT device, ts, temp_c, humidity FROM 'pi3-01/telemetry'",
        actions: [
          {
            dynamoDBv2: {
              putItem: { tableName: telemTable.tableName },
              roleArn: iotRuleRole.roleArn,
            },
          },
        ],
        ruleDisabled: false,
        awsIotSqlVersion: "2016-03-23",
      },
    });
 
    // ────────────────────────────────
    // 7) Lambda (TypeScript) + API to read it back
    //    GET /telemetry?device=pi3-01&limit=25
    // ────────────────────────────────
    const telemetryGetFn = new NodejsFunction(this, "TelemetryGetHandler", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "../lambda/telemetry-get.ts"),
      handler: "handler",
      bundling: {
        target: "node18",
        minify: true,
        sourceMap: false,
      },
      environment: {
        TELEMETRY_TABLE: telemTable.tableName,
      },
    });
 
    telemTable.grantReadData(telemetryGetFn);
 
    const telemetryResource = api.root.addResource("telemetry");
    telemetryResource.addMethod("GET", new apigw.LambdaIntegration(telemetryGetFn), {
      authorizationType: apigw.AuthorizationType.NONE, // switch to COGNITO later if desired
    });
 
    // Useful outputs
    new cdk.CfnOutput(this, "PiThingName", { value: thingName });
    new cdk.CfnOutput(this, "PiPolicyName", { value: piPolicy.policyName! });
 
 
       // 8) Virtual Assistant API route (Picky)
const virtualAssistantFn = bedrockStack.lambdaFunction;
const assistantResource = api.root.addResource("assistant");
 
// CORS — required for frontend
assistantResource.addCorsPreflight({
  allowOrigins: ["*"],  
  allowMethods: ["POST"],
});
 
assistantResource.addMethod("POST", new apigw.LambdaIntegration(bedrockStack.lambdaFunction),
  {
      // authorizer,
      // authorizationType: apigw.AuthorizationType.COGNITO,
    });
 
  }
}