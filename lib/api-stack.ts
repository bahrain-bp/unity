import * as cdk from "aws-cdk-lib";
//import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { DBStack } from "./DBstack";
import { Construct } from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
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
        resources: ["*"],
      })
    );

    userPool.addTrigger(
      cognito.UserPoolOperation.POST_CONFIRMATION,
      postConfirmFn
    );

    const userPoolClient = new cognito.UserPoolClient(this, "UnityUserPoolClientV2", {

      userPool,
      generateSecret: false,
      authFlows: { userSrp: true, userPassword: true },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: true,
        },
        callbackUrls: ["http://localhost:3000/callback"],
        logoutUrls: ["http://localhost:3000/"],
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL],
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ],
    });

    const cfnClient = userPoolClient.node.defaultChild as cognito.CfnUserPoolClient;
    cfnClient.allowedOAuthFlowsUserPoolClient = true;
    cfnClient.allowedOAuthFlows = ["code", "implicit"];
    cfnClient.allowedOAuthScopes = ["openid", "email"];
    cfnClient.supportedIdentityProviders = ["COGNITO"];

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
      handler: "hello.handler",
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
    // whoami
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

    const whoamiResource = api.root.addResource("whoami");
    whoamiResource.addMethod("GET", new apigw.LambdaIntegration(whoamiFn), {
      authorizationType: apigw.AuthorizationType.NONE,
    });

    // ────────────────────────────────
    // set-role
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

    setRoleFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "cognito-idp:AdminAddUserToGroup",
          "cognito-idp:AdminRemoveUserFromGroup",
          "cognito-idp:AdminListGroupsForUser",
        ],
        resources: ["*"],
      })
    );

    const roleResource = api.root.addResource("role");
    roleResource.addMethod("POST", new apigw.LambdaIntegration(setRoleFn), {
      authorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
    });
 
    // ────────────────────────────────
    // PlugActions: use table from DBStack
    // ────────────────────────────────
    const plugActionsTable: dynamodb.Table = dbStack.plugActionsTable;
    
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
        VOICE_MONKEY_TOKEN: "881b17b3b798802187d4133d2cf40875_6242d41e604eec9e5d59b713c3e751e7",
        PLUG_DEVICE_MAP: JSON.stringify({
          plug1: { on: "turnonplugone", off: "turnoffplugone" },
          plug2: { on: "turnonplugtwo", off: "turnoffplugtwo" },
        }),
        COOLDOWN_SECONDS: "30",
      },
    });

    plugActionsTable.grantReadWriteData(plugControlFn);

    const plugsResource = api.root.addResource("plugs");
    plugsResource.addMethod("POST", new apigw.LambdaIntegration(plugControlFn), {
      authorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
    });

    // ────────────────────────────────
    // Telemetry query: use IoTDeviceTelemetry table from DBStack
    // ────────────────────────────────
    const iotTelemetryTable: dynamodb.Table = dbStack.iotTelemetryTable;

    const telemetryQueryFn = new NodejsFunction(this, "TelemetryQueryHandler", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "../lambda/telemetry-query.ts"),
      handler: "handler",
      bundling: {
        target: "node18",
        minify: true,
        sourceMap: false,
      },
      environment: {
        TELEMETRY_TABLE: iotTelemetryTable.tableName,
      },
    });

    iotTelemetryTable.grantReadData(telemetryQueryFn);

    const telemetryResource = api.root.addResource("telemetry");
    telemetryResource.addMethod("GET", new apigw.LambdaIntegration(telemetryQueryFn), {
      authorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
    });

    plugsResource.addCorsPreflight({
      allowOrigins: [
        "http://localhost:8080",
        "http://localhost:5173",     
      ],
      allowMethods: ["OPTIONS", "POST"],
      allowHeaders: ["Content-Type", "Authorization"],
    });

    telemetryResource.addCorsPreflight({
      allowOrigins: [
        "http://localhost:8080",
        "http://localhost:5173",  
      ],
      allowMethods: ["OPTIONS", "GET"],
      allowHeaders: ["Content-Type", "Authorization"],
    });

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