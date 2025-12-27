import * as cdk from "aws-cdk-lib";
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
import { UnityWebSocketStack } from "./unity-websocket-stack";

interface APIStackProps extends cdk.StackProps {
  dbStack: DBStack;
  bedrockStack: BedrockStack;
  wsStack: UnityWebSocketStack;
}

export class APIStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: APIStackProps) {
    super(scope, id, props);

    const wsStack = props.wsStack;
    const dbStack = props.dbStack;
    const bedrockStack = props.bedrockStack;

    const preRegBucket = dbStack.preRegBucket;
    const userTable = dbStack.userManagementTable;

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

    userPool.addTrigger(cognito.UserPoolOperation.POST_CONFIRMATION, postConfirmFn);

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
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
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

    new cdk.CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
    new cdk.CfnOutput(this, "UserPoolClientId", { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, "UserPoolDomainUrl", { value: userPoolDomain.baseUrl() });

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

    new cdk.CfnOutput(this, "UnityApiUrl", { value: api.url });

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
        VOICE_MONKEY_TOKEN:
          "881b17b3b798802187d4133d2cf40875_6242d41e604eec9e5d59b713c3e751e7",
        PLUG_DEVICE_MAP: JSON.stringify({
          plug1: { on: "turnonplugone", off: "turnoffplugone" },
          plug2: { on: "turnonplugtwo", off: "turnoffplugtwo" },
        }),
        COOLDOWN_SECONDS: "30",

        WS_CONNECTIONS_TABLE: wsStack.connectionsTable.tableName,
        WS_MANAGEMENT_ENDPOINT: wsStack.managementEndpoint,
      },
    });

    plugActionsTable.grantReadWriteData(plugControlFn);
    wsStack.connectionsTable.grantReadData(plugControlFn);

    plugControlFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["execute-api:ManageConnections"],
        resources: [
          `arn:aws:execute-api:${this.region}:${this.account}:${wsStack.webSocketApi.apiId}/${wsStack.stage.stageName}/*/@connections/*`,
        ],
      })
    );

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

    // ────────────────────────────────
    // Alexa Telemetry Controller 
    // ────────────────────────────────
    const alexaTelemetryFn = new NodejsFunction(this, "AlexaTelemetryHandler", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "../lambda/alexa-telemetry.ts"),
      handler: "handler",
      bundling: { target: "node18", minify: true, sourceMap: false },
      environment: {
        TELEMETRY_TABLE: iotTelemetryTable.tableName,

        // TEMPORARY: hard-coded Basic Auth credentials
        BASIC_USER: "alexa",
        BASIC_PASS: "aL9Qx7P2mR4ZK8wE",
      },
    });

    iotTelemetryTable.grantReadData(alexaTelemetryFn);

    const alexaResource = api.root.addResource("alexa");

    const publicMethodOptions: apigw.MethodOptions = {
      authorizationType: apigw.AuthorizationType.NONE,
      apiKeyRequired: false,
    };

    alexaResource
      .addResource("ht")
      .addResource("latest")
      .addMethod("GET", new apigw.LambdaIntegration(alexaTelemetryFn), publicMethodOptions);

    alexaResource
      .addResource("parking")
      .addResource("latest")
      .addMethod("GET", new apigw.LambdaIntegration(alexaTelemetryFn), publicMethodOptions);

    alexaResource
      .addResource("summary")
      .addMethod("GET", new apigw.LambdaIntegration(alexaTelemetryFn), publicMethodOptions);

    new cdk.CfnOutput(this, "AlexaHtLatestUrl", { value: api.url + "alexa/ht/latest" });
    new cdk.CfnOutput(this, "AlexaParkingLatestUrl", { value: api.url + "alexa/parking/latest" });
    new cdk.CfnOutput(this, "AlexaSummaryUrl", { value: api.url + "alexa/summary" });

    plugsResource.addCorsPreflight({
      allowOrigins: ["http://localhost:8080", "http://localhost:5173"],
      allowMethods: ["OPTIONS", "POST"],
      allowHeaders: ["Content-Type", "Authorization"],
    });

    telemetryResource.addCorsPreflight({
      allowOrigins: ["http://localhost:8080", "http://localhost:5173"],
      allowMethods: ["OPTIONS", "GET"],
      allowHeaders: ["Content-Type", "Authorization"],
    });

    // ────────────────────────────────
    // WhatsApp Bot (Cloud API) — webhook
    // ────────────────────────────────
    const whatsappBotFn = new NodejsFunction(this, "WhatsAppBotHandler", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "../lambda/whatsapp-bot.ts"),
      handler: "handler",
      bundling: { target: "node18", minify: true, sourceMap: false },
      environment: {
        TELEMETRY_TABLE: iotTelemetryTable.tableName,
        WHATSAPP_TOKEN:
          "EAAK2o4y1wuoBQWx18PoK9ymtzOzZAuZBWaZBexdwkdrS60e2kseWiDbFzehshKCV9eIQObFgHje4bRAvJCM6lvn8WP3qQq3kVqakeEYKCzooAinFYillZALhknRIqcZBxgt0A6Y5PUW56hJv4RVsZBtWQJ1SQsjWibzRL4zHXCUesGryKYdmDVscQ8FzaNKfZCkdxbNOFaCfZA7UYOY5bFcgTmXUQCR0id2ZB9LG5VcURgIf2jXOejDWZCcCbUdO8ZAOfa8Uw5ZAIZBvkA51HyRQCKVC2",
        PHONE_NUMBER_ID: "883880824813605",
        VERIFY_TOKEN: "parkingbot_verify",
        ALLOWLIST_E164: "+97338006448",
      },
    });

    iotTelemetryTable.grantReadData(whatsappBotFn);

    const whatsappResource = api.root.addResource("whatsapp");
    const webhookResource = whatsappResource.addResource("webhook");

    webhookResource.addMethod("GET", new apigw.LambdaIntegration(whatsappBotFn), publicMethodOptions);
    webhookResource.addMethod("POST", new apigw.LambdaIntegration(whatsappBotFn), publicMethodOptions);

    new cdk.CfnOutput(this, "WhatsAppWebhookUrl", { value: api.url + "whatsapp/webhook" });

    // ────────────────────────────────
    // Virtual Assistant API route (Bedrock)
    // ────────────────────────────────
    const assistantResource = api.root.addResource("assistant");

    assistantResource.addCorsPreflight({
      allowOrigins: ["*"],
      allowMethods: ["POST"],
    });

    assistantResource.addMethod("POST", new apigw.LambdaIntegration(bedrockStack.lambdaFunction));

    // ────────────────────────────────
    // Pre-Registration: Presigned Upload + Validate Image + Presigned Download
    // (KEPT ONCE — DUPLICATE REMOVED)
    // ────────────────────────────────

    // Generate presigned S3 upload URL
    const generatePresignedUrlFn = new NodejsFunction(this, "GeneratePresignedUrlHandler", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, "../lambda/generatePresignedUploadUrl.ts"),
      handler: "handler",
      environment: {
        BUCKET_NAME: preRegBucket.bucketName,
      },
    });

    preRegBucket.grantReadWrite(generatePresignedUrlFn);

    const uploadImageResource = api.root.addResource("upload-image");

    uploadImageResource.addCorsPreflight({
      allowOrigins: ["*"], // replace "*" with your frontend URL in production
      allowMethods: ["POST"],
    });

    uploadImageResource.addMethod("POST", new apigw.LambdaIntegration(generatePresignedUrlFn), {
      authorizationType: apigw.AuthorizationType.NONE,
    });

    // Validate image (Python lambda)
    const preRegisterCheckFn = new lambda.Function(this, "PreRegisterCheckHandler", {
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: "PreRegisterCheck.handler",
      code: lambda.Code.fromAsset("lambda"),
      timeout: cdk.Duration.seconds(30),
      environment: {
        BUCKET_NAME: preRegBucket.bucketName,
        USER_MANAGEMENT_TABLE: userTable.tableName,
        COLLECTION_ID: "VisitorFaceCollection",
      },
    });

    preRegBucket.grantReadWrite(preRegisterCheckFn);
    userTable.grantReadWriteData(preRegisterCheckFn);

    const validateImageResource = api.root.addResource("validate-image");

    validateImageResource.addCorsPreflight({
      allowOrigins: ["*"],
      allowMethods: ["POST"],
    });

    validateImageResource.addMethod("POST", new apigw.LambdaIntegration(preRegisterCheckFn), {
      authorizationType: apigw.AuthorizationType.NONE,
    });

    // Generate presigned S3 download URL
    const getImageFn = new NodejsFunction(this, "GetPresignedDownloadUrlHandler", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "../lambda/generatePresignedDownloadUrl.ts"),
      handler: "handler",
      environment: {
        BUCKET_NAME: preRegBucket.bucketName,
      },
    });

    preRegBucket.grantRead(getImageFn);

    const getImageResource = api.root.addResource("get-image");

    getImageResource.addCorsPreflight({
      allowOrigins: ["*"],
      allowMethods: ["GET"],
    });

    getImageResource.addMethod("GET", new apigw.LambdaIntegration(getImageFn), {
      authorizationType: apigw.AuthorizationType.NONE,
    });

    // ────────────────────────────────
    // USER MANAGEMENT
    // ────────────────────────────────
    const usersResource = api.root.addResource("users");

    usersResource.addCorsPreflight({
      allowOrigins: ["http://localhost:5173"],
      allowMethods: ["OPTIONS", "GET", "POST", "PUT", "DELETE"],
      allowHeaders: ["Content-Type", "Authorization"],
    });

    const userByIdResource = usersResource.addResource("{userId}");

    userByIdResource.addCorsPreflight({
      allowOrigins: ["http://localhost:5173"],
      allowMethods: ["OPTIONS", "PUT", "DELETE"],
      allowHeaders: ["Content-Type", "Authorization"],
    });

    // Get users
    const usersGetFn = new NodejsFunction(this, "UsersGetHandler", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "../lambda/users-get.ts"),
      handler: "handler",
      environment: {
        USER_POOL_ID: userPool.userPoolId,
        ALLOWED_ORIGIN: "http://localhost:5173", 
      },
      bundling: {
        target: "node18",
        minify: true,
        sourceMap: false,
      },
    });

    usersGetFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["cognito-idp:ListUsers"],
        resources: [userPool.userPoolArn],
      })
    );

    usersResource.addMethod("GET", new apigw.LambdaIntegration(usersGetFn), {
      authorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
    });

    // Create users
    const usersCreateFn = new NodejsFunction(this, "UsersCreateHandler", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "../lambda/users-create.ts"),
      handler: "handler",
      environment: {
        USER_POOL_ID: userPool.userPoolId,
        ALLOWED_ORIGIN: "http://localhost:5173", 
      },
      bundling: {
        target: "node18",
        minify: true,
        sourceMap: false,
      },
    });

    usersCreateFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["cognito-idp:AdminCreateUser"],
        resources: [userPool.userPoolArn],
      })
    );

    usersResource.addMethod("POST", new apigw.LambdaIntegration(usersCreateFn), {
      authorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
    });

    // Update users
    const usersUpdateFn = new NodejsFunction(this, "UsersUpdateHandler", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "../lambda/users-update.ts"),
      handler: "handler",
      environment: {
        USER_POOL_ID: userPool.userPoolId,
        ALLOWED_ORIGIN: "http://localhost:5173", 
      },
      bundling: {
        target: "node18",
        minify: true,
        sourceMap: false,
      },
    });

    usersUpdateFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["cognito-idp:AdminUpdateUserAttributes"],
        resources: [userPool.userPoolArn],
      })
    );

    userByIdResource.addMethod("PUT", new apigw.LambdaIntegration(usersUpdateFn), {
      authorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
    });

    // Delete users
    const usersDeleteFn = new NodejsFunction(this, "UsersDeleteHandler", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "../lambda/users-delete.ts"),
      handler: "handler",
      environment: {
        USER_POOL_ID: userPool.userPoolId,
        ALLOWED_ORIGIN: "http://localhost:5173", 
      },
      bundling: {
        target: "node18",
        minify: true,
        sourceMap: false,
      },
    });

    usersDeleteFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["cognito-idp:AdminDeleteUser"],
        resources: [userPool.userPoolArn],
      })
    );

    userByIdResource.addMethod("DELETE", new apigw.LambdaIntegration(usersDeleteFn), {
      authorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
    });
  }
}
