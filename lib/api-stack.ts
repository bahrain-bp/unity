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

    // Post-confirm trigger to auto-add 'visitor'
    const postConfirmFn = new NodejsFunction(this, "PostConfirmVisitorHandler", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "../lambda/post-confirm-visitor.ts"),
      handler: "handler",
      bundling: {
        target: "node18",
        minify: true,
        sourceMap: false,
      },
    });

    postConfirmFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["cognito-idp:AdminAddUserToGroup"],
        resources: ["*"], // break circular dependency
      })
    );

    userPool.addTrigger(
      cognito.UserPoolOperation.POST_CONFIRMATION,
      postConfirmFn
    );

    // app client with OAuth config
    const userPoolClient = new cognito.UserPoolClient(this, "UnityUserPoolClientV2", {

      userPool,
      generateSecret: false,
      authFlows: { userSrp: true, userPassword: true },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: true,   // so response_type=token works
        },
        callbackUrls: ["http://localhost:3000/callback"],
        logoutUrls: ["http://localhost:3000/"],
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL],
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ],
    });

    // FORCE the low-level OAuth flags on the L1 resource
    const cfnClient = userPoolClient.node.defaultChild as cognito.CfnUserPoolClient;
    cfnClient.allowedOAuthFlowsUserPoolClient = true;
    cfnClient.allowedOAuthFlows = ["code", "implicit"];   // must include "implicit" for response_type=token
    cfnClient.allowedOAuthScopes = ["openid", "email"];
    cfnClient.supportedIdentityProviders = ["COGNITO"];   // same as above, but at L1

    // your groups (they’re fine)
    new cognito.CfnUserPoolGroup(this, "AdminGroup", {
      userPoolId: userPool.userPoolId,
      groupName: "admin",
    });

    new cognito.CfnUserPoolGroup(this, "NewHireGroup", {
      userPoolId: userPool.userPoolId,
      groupName: "newhire",
    });

    new cognito.CfnUserPoolGroup(this, "VisitorGroup", {
      userPoolId: userPool.userPoolId,
      groupName: "visitor",
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
    // Test Lambda: whoami (TypeScript)
    // ────────────────────────────────
    const whoamiFn = new NodejsFunction(this, "WhoAmIHandler", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "../lambda/whoami.ts"),
      handler: "handler",
      bundling: {
        target: "node18",
        minify: true,
        sourceMap: false,
      },
    });

    // API: GET /whoami (no auth required)
    const whoamiResource = api.root.addResource("whoami");
    whoamiResource.addMethod(
      "GET",
      new apigw.LambdaIntegration(whoamiFn),
      {
        authorizationType: apigw.AuthorizationType.NONE,
      }
    );

    // ────────────────────────────────
    // Lambda: set-role (assign newhire/visitor)
    // ────────────────────────────────
    const setRoleFn = new NodejsFunction(this, "SetRoleHandler", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "../lambda/set-role.ts"),
      handler: "handler",
      bundling: {
        target: "node18",
        minify: true,
        sourceMap: false,
      },
      environment: {
        USER_POOL_ID: userPool.userPoolId,
      },
    });

    // Allow Lambda to manage groups in this user pool
    setRoleFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "cognito-idp:AdminAddUserToGroup",
          "cognito-idp:AdminRemoveUserFromGroup",
          "cognito-idp:AdminListGroupsForUser",
        ],
        resources: ["*"], // break circular dependency
      })
    );

    // API: POST /role (protected by Cognito authorizer)
    const roleResource = api.root.addResource("role");
    roleResource.addMethod(
      "POST",
      new apigw.LambdaIntegration(setRoleFn),
      {
        authorizer,
        authorizationType: apigw.AuthorizationType.COGNITO,
      }
    );


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
      authorizationType: apigw.AuthorizationType.NONE, // switch to COGNITO later 
    });
 
    // Useful outputs
    new cdk.CfnOutput(this, "PiThingName", { value: thingName });
    new cdk.CfnOutput(this, "PiPolicyName", { value: piPolicy.policyName! });

    // ────────────────────────────────
    // 8) DynamoDB table for plug actions (audit + cooldown)
    //    PK = user_id (string), SK = ts (number, epoch seconds)
    // ────────────────────────────────
    const plugActionsTable = new dynamodb.Table(this, "PlugActionsTable", {
      tableName: "PlugActions",
      partitionKey: { name: "user_id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "ts", type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // change to RETAIN in prod
    });

    new cdk.CfnOutput(this, "PlugActionsTableName", {
      value: plugActionsTable.tableName,
      description: "Audit table for plug control actions",
    });

    // ────────────────────────────────
    // 9) Lambda to handle plug control + cooldown + logging
    // ────────────────────────────────
    const plugControlFn = new NodejsFunction(this, "PlugControlHandler", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "../lambda/plug-control.ts"),
      handler: "handler",
      bundling: {
        target: "node18",
        minify: true,
        sourceMap: false,
      },
      environment: {
        PLUG_ACTIONS_TABLE: plugActionsTable.tableName,
        VOICE_MONKEY_BASE_URL: "https://api-v2.voicemonkey.io/trigger",
        // Voice Monkey token 
        VOICE_MONKEY_TOKEN: "881b17b3b798802187d4133d2cf40875_6242d41e604eec9e5d59b713c3e751e7",
        // Mapping plugId + state → Voice Monkey device ids
        // this later if more plugs added
        PLUG_DEVICE_MAP: JSON.stringify({
          plug1: { on: "turnonplugone", off: "turnoffplugone" },
          plug2: { on: "turnonplugtwo", off: "turnoffplugtwo" },
        }),
        COOLDOWN_SECONDS: "30",
      },
    });

    plugActionsTable.grantReadWriteData(plugControlFn);

    // ────────────────────────────────
    // 10) API Gateway: /plugs POST → plugControlFn (protected by Cognito)
    // ────────────────────────────────
    const plugsResource = api.root.addResource("plugs");
    plugsResource.addMethod(
      "POST",
      new apigw.LambdaIntegration(plugControlFn),
      {
        authorizer,
        authorizationType: apigw.AuthorizationType.COGNITO,
      }
    );

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