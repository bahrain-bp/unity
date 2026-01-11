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
import { FrontendDeploymentStack } from "./frontend-deployment-stack";
import * as logs from "aws-cdk-lib/aws-logs";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";

interface APIStackProps extends cdk.StackProps {
  dbStack: DBStack;
  bedrockStack: BedrockStack;
  wsStack: UnityWebSocketStack;
  frontendStack: FrontendDeploymentStack;
  broadcastLambda: lambda.IFunction;
}

export class APIStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: APIStackProps) {
    super(scope, id, props);

    const prefixname = this.stackName.split("-")[0].toLowerCase();

    const wsStack = props.wsStack;
    const dbStack = props.dbStack;
    const bedrockStack = props.bedrockStack;
    const frontendStack = props.frontendStack;
    const broadcastLambda = props.broadcastLambda;

    const preRegBucket = dbStack.preRegBucket;
    const userTable = dbStack.userManagementTable;

    const feedbackTable = dbStack.visitorFeedbackTable;
    const usedTokensTable = dbStack.usedTokensTable;
    const REKOG_COLLECTION_ID = dbStack.visitorFaceCollection.collectionId!;

    // Ensure DBStack is created before APIStack
    this.addDependency(dbStack);

    // ────────────────────────────────
    // ✅ X-RAY HELPER (one place, apply to all lambdas)
    // ────────────────────────────────
    const enableXRay = (fn: lambda.Function) => {
      fn.role?.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName("AWSXRayDaemonWriteAccess")
      );
    };

    // ────────────────────────────────
    // ✅ ONE GLOBAL CORS (temporary "*", later replace with deployed frontend URL)
    // ────────────────────────────────
    const GLOBAL_CORS: apigw.CorsOptions = {
      allowOrigins: apigw.Cors.ALL_ORIGINS, // "*"
      allowMethods: apigw.Cors.ALL_METHODS,
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "X-Amz-Date",
        "X-Api-Key",
        "X-Amz-Security-Token",
        "X-Amz-User-Agent",
      ],
    };

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
      userPoolName: `${prefixname}-unity-users`,
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
      tracing: lambda.Tracing.ACTIVE,
    });
    enableXRay(postConfirmFn);

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

    const userPoolClient = new cognito.UserPoolClient(
      this,
      "UnityUserPoolClientV2",
      {
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
      }
    );

    const cfnClient = userPoolClient.node
      .defaultChild as cognito.CfnUserPoolClient;
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

    const userPoolDomain = new cognito.UserPoolDomain(
      this,
      "UnityUserPoolDomain",
      {
        userPool,
        cognitoDomain: { domainPrefix: `${prefixname}-unity-${this.account}-dev` },
      }
    );

    new cdk.CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
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
      tracing: lambda.Tracing.ACTIVE,
    });
    enableXRay(helloFn);

    // ────────────────────────────────
    // 3. API Gateway + Cognito Authorizer
    // ✅ GLOBAL CORS APPLIED ONCE HERE
    // ────────────────────────────────
    const api = new apigw.RestApi(this, "UnityRestApi", {
      restApiName: `${prefixname}-Unity Service`,
      deployOptions: {
        stageName: "dev",
        tracingEnabled: true,
      },
      defaultCorsPreflightOptions: GLOBAL_CORS,
    });

    const authorizer = new apigw.CognitoUserPoolsAuthorizer(
      this,
      "UnityCognitoAuthorizer",
      {
        cognitoUserPools: [userPool],
      }
    );

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
      tracing: lambda.Tracing.ACTIVE,
    });
    enableXRay(whoamiFn);

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
      tracing: lambda.Tracing.ACTIVE,
    });
    enableXRay(setRoleFn);

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
    // PlugActions
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
      tracing: lambda.Tracing.ACTIVE,
    });
    enableXRay(plugControlFn);

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
    // Telemetry query
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
      tracing: lambda.Tracing.ACTIVE,
    });
    enableXRay(telemetryQueryFn);

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
        BASIC_USER: "alexa",
        BASIC_PASS: "aL9Qx7P2mR4ZK8wE",
      },
      tracing: lambda.Tracing.ACTIVE,
    });
    enableXRay(alexaTelemetryFn);

    iotTelemetryTable.grantReadData(alexaTelemetryFn);

    const alexaResource = api.root.addResource("alexa");

    const publicMethodOptions: apigw.MethodOptions = {
      authorizationType: apigw.AuthorizationType.NONE,
      apiKeyRequired: false,
    };

    alexaResource
      .addResource("ht")
      .addResource("latest")
      .addMethod(
        "GET",
        new apigw.LambdaIntegration(alexaTelemetryFn),
        publicMethodOptions
      );

    alexaResource
      .addResource("parking")
      .addResource("latest")
      .addMethod(
        "GET",
        new apigw.LambdaIntegration(alexaTelemetryFn),
        publicMethodOptions
      );

    alexaResource
      .addResource("summary")
      .addMethod(
        "GET",
        new apigw.LambdaIntegration(alexaTelemetryFn),
        publicMethodOptions
      );

    new cdk.CfnOutput(this, "AlexaHtLatestUrl", { value: api.url + "alexa/ht/latest" });
    new cdk.CfnOutput(this, "AlexaParkingLatestUrl", { value: api.url + "alexa/parking/latest" });
    new cdk.CfnOutput(this, "AlexaSummaryUrl", { value: api.url + "alexa/summary" });

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
      tracing: lambda.Tracing.ACTIVE,
    });
    enableXRay(whatsappBotFn);

    iotTelemetryTable.grantReadData(whatsappBotFn);

    const whatsappResource = api.root.addResource("whatsapp");
    const webhookResource = whatsappResource.addResource("webhook");

    webhookResource.addMethod(
      "GET",
      new apigw.LambdaIntegration(whatsappBotFn),
      publicMethodOptions
    );
    webhookResource.addMethod(
      "POST",
      new apigw.LambdaIntegration(whatsappBotFn),
      publicMethodOptions
    );

    new cdk.CfnOutput(this, "WhatsAppWebhookUrl", { value: api.url + "whatsapp/webhook" });

    // ────────────────────────────────
    // Virtual Assistant API route (Bedrock)
    // ────────────────────────────────
    const bedrockCfnFn = bedrockStack.lambdaFunction.node
      .defaultChild as lambda.CfnFunction;
    bedrockCfnFn.tracingConfig = { mode: "Active" };

    enableXRay(bedrockStack.lambdaFunction);

    const assistantResource = api.root.addResource("assistant");
    assistantResource.addMethod(
      "POST",
      new apigw.LambdaIntegration(bedrockStack.lambdaFunction)
    );

    // ────────────────────────────────
    // Pre-Registration: Presigned Upload + Validate Image + Presigned Download
    // ────────────────────────────────
    const generatePresignedUrlFn = new NodejsFunction(
      this,
      "GeneratePresignedUrlHandler",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.join(__dirname, "../lambda/generatePresignedUploadUrl.ts"),
        handler: "handler",
        environment: {
          BUCKET_NAME: preRegBucket.bucketName,
        },
        tracing: lambda.Tracing.ACTIVE,
      }
    );
    enableXRay(generatePresignedUrlFn);

    preRegBucket.grantReadWrite(generatePresignedUrlFn);

    const uploadImageResource = api.root.addResource("upload-image");
    uploadImageResource.addMethod(
      "POST",
      new apigw.LambdaIntegration(generatePresignedUrlFn),
      { authorizationType: apigw.AuthorizationType.NONE }
    );

    const preRegisterCheckFn = new lambda.Function(this, "PreRegisterCheckHandler", {
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: "PreRegisterCheck.handler",
      code: lambda.Code.fromAsset("lambda"),
      timeout: cdk.Duration.seconds(30),
      environment: {
        BUCKET_NAME: preRegBucket.bucketName,
        USER_MANAGEMENT_TABLE: userTable.tableName,
        COLLECTION_ID: `${prefixname}-VisitorFaceCollection`,
      },
      tracing: lambda.Tracing.ACTIVE,
    });
    enableXRay(preRegisterCheckFn);

    preRegBucket.grantReadWrite(preRegisterCheckFn);
    userTable.grantReadWriteData(preRegisterCheckFn);

    const validateImageResource = api.root.addResource("validate-image");
    validateImageResource.addMethod(
      "POST",
      new apigw.LambdaIntegration(preRegisterCheckFn),
      { authorizationType: apigw.AuthorizationType.NONE }
    );

    const getImageFn = new NodejsFunction(this, "GetPresignedDownloadUrlHandler", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "../lambda/generatePresignedDownloadUrl.ts"),
      handler: "handler",
      environment: {
        BUCKET_NAME: preRegBucket.bucketName,
      },
      tracing: lambda.Tracing.ACTIVE,
    });
    enableXRay(getImageFn);

    preRegBucket.grantRead(getImageFn);

    const getImageResource = api.root.addResource("get-image");
    getImageResource.addMethod("GET", new apigw.LambdaIntegration(getImageFn), {
      authorizationType: apigw.AuthorizationType.NONE,
    });

    // ────────────────────────────────
    // USER MANAGEMENT
    // ────────────────────────────────
    const usersResource = api.root.addResource("users");
    const userByIdResource = usersResource.addResource("{userId}");

    const usersGetFn = new NodejsFunction(this, "UsersGetHandler", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "../lambda/users-get.ts"),
      handler: "handler",
      environment: {
        USER_POOL_ID: userPool.userPoolId,
        ALLOWED_ORIGIN: "*", // since GLOBAL CORS is "*"
      },
      bundling: { target: "node18", minify: true, sourceMap: false },
      tracing: lambda.Tracing.ACTIVE,
    });
    enableXRay(usersGetFn);

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

    const usersCreateFn = new NodejsFunction(this, "UsersCreateHandler", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "../lambda/users-create.ts"),
      handler: "handler",
      environment: {
        USER_POOL_ID: userPool.userPoolId,
        ALLOWED_ORIGIN: "*",
      },
      bundling: { target: "node18", minify: true, sourceMap: false },
      tracing: lambda.Tracing.ACTIVE,
    });
    enableXRay(usersCreateFn);

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

    const usersUpdateFn = new NodejsFunction(this, "UsersUpdateHandler", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "../lambda/users-update.ts"),
      handler: "handler",
      environment: {
        USER_POOL_ID: userPool.userPoolId,
        ALLOWED_ORIGIN: "*",
      },
      bundling: { target: "node18", minify: true, sourceMap: false },
      tracing: lambda.Tracing.ACTIVE,
    });
    enableXRay(usersUpdateFn);

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

    const usersDeleteFn = new NodejsFunction(this, "UsersDeleteHandler", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "../lambda/users-delete.ts"),
      handler: "handler",
      environment: {
        USER_POOL_ID: userPool.userPoolId,
        ALLOWED_ORIGIN: "*",
      },
      bundling: { target: "node18", minify: true, sourceMap: false },
      tracing: lambda.Tracing.ACTIVE,
    });
    enableXRay(usersDeleteFn);

    usersDeleteFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["cognito-idp:AdminDeleteUser"],
        resources: [userPool.userPoolArn],
      })
    );

    userByIdResource.addMethod(
      "DELETE",
      new apigw.LambdaIntegration(usersDeleteFn),
      {
        authorizer,
        authorizationType: apigw.AuthorizationType.COGNITO,
      }
    );

    // ────────────────────────────────
    // Analytics Dashboard (REAL DATA)
    // ────────────────────────────────
    const analyticsDashboardFn = new NodejsFunction(this, "AnalyticsDashboardHandler", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "../lambda/analytics-dashboard.ts"),
      handler: "handler",
      bundling: { target: "node18", minify: true, sourceMap: false },
      environment: {
        PLUG_ACTIONS_TABLE: dbStack.plugActionsTable.tableName,
        TELEMETRY_TABLE: dbStack.iotTelemetryTable.tableName,
        PLUG_INDEX_NAME: "plug_id-ts-index",
      },
      tracing: lambda.Tracing.ACTIVE,
    });
    enableXRay(analyticsDashboardFn);

    dbStack.plugActionsTable.grantReadData(analyticsDashboardFn);
    dbStack.iotTelemetryTable.grantReadData(analyticsDashboardFn);

    const analyticsResource = api.root.addResource("analytics");
    const dashboardResource = analyticsResource.addResource("dashboard");
    dashboardResource.addMethod("GET", new apigw.LambdaIntegration(analyticsDashboardFn), {
      authorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
    });

    // ────────────────────────────────
    // Upload Unity build (presigned) + CloudFront invalidation
    // ────────────────────────────────
    const presignedUrlHandler = new NodejsFunction(this, "PresignedUrlHandler", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "handler",
      entry: path.join(__dirname, "..", "lambda", "uploadBuildHandler.ts"),
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      environment: {
        BUCKET_NAME: frontendStack.frontendBucket.bucketName,
        UPLOAD_DIRECTORY: "unity",
        MAX_FILES: "4",
        URL_EXPIRATION_SECONDS: "3600",
        CLOUDFRONT_DISTRIBUTION_ID: frontendStack.distribution.distributionId,
      },
      tracing: lambda.Tracing.ACTIVE,
    });
    enableXRay(presignedUrlHandler);

    frontendStack.frontendBucket.grantPut(presignedUrlHandler);

    presignedUrlHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["cloudfront:CreateInvalidation"],
        resources: ["*"],
      })
    );

    const uploadResource = api.root.addResource("generate-upload-urls");
    uploadResource.addMethod("POST", new apigw.LambdaIntegration(presignedUrlHandler));

    // ────────────────────────────────────────────────
    // Visitor Feedback API (python)
    // ────────────────────────────────────────────────
    const createPythonLambda = (
      id: string,
      handlerFile: string,
      functionName: string,
      env: { [key: string]: string }
    ) => {
      const fn = new lambda.Function(this, id, {
        runtime: lambda.Runtime.PYTHON_3_11,
        handler: `${handlerFile}.handler`,
        code: lambda.Code.fromAsset(path.join(__dirname, "../lambda"), {
          bundling: {
            image: lambda.Runtime.PYTHON_3_11.bundlingImage,
            command: [
              "bash",
              "-c",
              `pip install -r requirements.txt -t /asset-output && cp -r . /asset-output`,
            ],
          },
        }),
        environment: env,
        timeout: cdk.Duration.seconds(30),
        functionName,
        logRetention: logs.RetentionDays.ONE_DAY,
        tracing: lambda.Tracing.ACTIVE,
      });

      enableXRay(fn);
      return fn;
    };

    const commonEnv = {
      FEEDBACK_TABLE: feedbackTable.tableName,
      VISITOR_TABLE: userTable.tableName,
      FEEDBACK_SECRET: "secret",
      used_tokens_table: usedTokensTable.tableName,
      BROADCAST_LAMBDA: broadcastLambda.functionArn,
    };

    const getVisitorInfoLambda = createPythonLambda(
      "GetVisitorInfoLambda",
      "getVisitorInfo",
      "GetVisitorInfoLambda",
      commonEnv
    );

    const submitFeedbackLambda = createPythonLambda(
      "SubmitFeedbackLambda",
      "submitFeedback",
      "SubmitFeedbackLambda",
      commonEnv
    );

    const getFeedbackLambda = createPythonLambda(
      "GetFeedbackLambda",
      "getFeedback",
      "GetFeedbackLambda",
      commonEnv
    );

    const loadFeedbackLambda = new lambda.Function(this, "LoadFeedback", {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: "LoadFeedback.handler",
      code: lambda.Code.fromAsset("lambda"),
      environment: { FEEDBACK_TABLE: feedbackTable.tableName },
      timeout: cdk.Duration.seconds(30),
      functionName: `${prefixname}-LoadFeedback`,
      logRetention: logs.RetentionDays.ONE_DAY,
      tracing: lambda.Tracing.ACTIVE,
    });
    enableXRay(loadFeedbackLambda);

    userTable.grantReadWriteData(getVisitorInfoLambda);
    userTable.grantReadData(submitFeedbackLambda);
    feedbackTable.grantReadWriteData(submitFeedbackLambda);
    feedbackTable.grantReadData(getFeedbackLambda);
    feedbackTable.grantReadData(loadFeedbackLambda);
    usedTokensTable.grantReadWriteData(getVisitorInfoLambda);
    usedTokensTable.grantReadWriteData(submitFeedbackLambda);

    broadcastLambda.grantInvoke(submitFeedbackLambda.role!);

    const getVisitorInfoResource = api.root.addResource("getVisitorInfo");
    getVisitorInfoResource.addMethod("GET", new apigw.LambdaIntegration(getVisitorInfoLambda), {
      authorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
    });

    const submitFeedbackResource = api.root.addResource("submitFeedback");
    submitFeedbackResource.addMethod("POST", new apigw.LambdaIntegration(submitFeedbackLambda), {
      authorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
    });

    const adminResource = api.root.addResource("admin");

    adminResource
      .addResource("getFeedback")
      .addMethod("GET", new apigw.LambdaIntegration(getFeedbackLambda), {
        authorizer,
        authorizationType: apigw.AuthorizationType.COGNITO,
      });

    adminResource
      .addResource("loadFeedback")
      .addMethod("POST", new apigw.LambdaIntegration(loadFeedbackLambda), {
        authorizer,
        authorizationType: apigw.AuthorizationType.COGNITO,
      });

    // ────────────────────────────────────────────────
    // Facial Recognition REST API
    // ────────────────────────────────────────────────
    const invitedVisitorTable = dbStack.invitedVisitorTable;
    const websiteActivityTable = dbStack.websiteActivityTable;
    const facialBucket = dbStack.bahtwinTestingBucket;

    const visitorResource = api.root.addResource("visitor");

    const publicOpts: apigw.MethodOptions = {
      authorizationType: apigw.AuthorizationType.NONE,
      apiKeyRequired: false,
    };

    const adminOpts: apigw.MethodOptions = {
      authorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
    };

    const arrivalTopic = new sns.Topic(this, "VisitorArrivalTopic", {
      topicName: `${prefixname}-VisitorArrivalNotifications`,
    });
    arrivalTopic.addSubscription(
      new subscriptions.SmsSubscription("+97332233417")
    );

    new cdk.CfnOutput(this, "ArrivalTopicArnOutput", {
      value: arrivalTopic.topicArn,
    });

    const sendFeedbackLambda = new lambda.Function(this, "SendFeedbackLambda", {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: "sendFeedbackLambda.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda"), {
        bundling: {
          image: lambda.Runtime.PYTHON_3_11.bundlingImage,
          command: [
            "bash",
            "-c",
            `pip install -r requirements.txt -t /asset-output && cp -r . /asset-output`,
          ],
        },
      }),
      environment: {
        JWT_SECRET: "secret",
        FRONTEND_URL: "https://d3pah2wsw5ry03.cloudfront.net/VisitorFeedBack",
        GMAIL_USER: "bahtwinnoreply@gmail.com",
        GMAIL_PASS: "zdjl cdgw kxzb okny",
        WORKMAIL_USER: "no-reply@bahtwin.awsapps.com",
        WORKMAIL_PASS: "Test1234*",
        WORKMAIL_SMTP: "smtp.mail.us-east-1.awsapps.com",
      },
      timeout: cdk.Duration.seconds(30),
      functionName: `${prefixname}-SendFeedbackLambda`,
      logRetention: logs.RetentionDays.ONE_DAY,
      tracing: lambda.Tracing.ACTIVE,
    });
    enableXRay(sendFeedbackLambda);

    const arrivalRekognitionFn = new lambda.Function(this, "ArrivalRekognitionHandler", {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: "ArrivalRekognition.ArrivalRekognition",
      code: lambda.Code.fromAsset("lambda"),
      timeout: cdk.Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        BUCKET_NAME: facialBucket.bucketName,
        COLLECTION_ID: REKOG_COLLECTION_ID,
        USER_TABLE: userTable.tableName,
        InviteTable: invitedVisitorTable.tableName,
        BROADCAST_LAMBDA: broadcastLambda.functionArn,
        TOPIC_ARN: arrivalTopic.topicArn,
        SEND_FEEDBACK_LAMBDA: sendFeedbackLambda.functionArn,
      },
    });
    enableXRay(arrivalRekognitionFn);

    const visitorPreRegisterFn = new lambda.Function(this, "VisitorPreRegisterHandler", {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: "PreRegisterCheck.PreRegisterCheck",
      code: lambda.Code.fromAsset("lambda"),
      timeout: cdk.Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        BUCKET_NAME: facialBucket.bucketName,
        COLLECTION_ID: REKOG_COLLECTION_ID,
        USER_TABLE: userTable.tableName,
        BROADCAST_LAMBDA: broadcastLambda.functionArn,
      },
    });
    enableXRay(visitorPreRegisterFn);

    const registerVisitorIndividualFn = new lambda.Function(this, "RegisterVisitorIndividualHandler", {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: "RegisterIndividualVisitor.handler",
      code: lambda.Code.fromAsset("lambda"),
      timeout: cdk.Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        InviteTable: invitedVisitorTable.tableName,
        BROADCAST_LAMBDA: broadcastLambda.functionArn,
      },
    });
    enableXRay(registerVisitorIndividualFn);

    const registerVisitorBulkFn = new lambda.Function(this, "RegisterVisitorBulkHandler", {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: "RegisterBulkVisitor.handler",
      code: lambda.Code.fromAsset("lambda"),
      timeout: cdk.Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        InviteTable: invitedVisitorTable.tableName,
        BROADCAST_LAMBDA: broadcastLambda.functionArn,
      },
    });
    enableXRay(registerVisitorBulkFn);

    const loadDashboardFn = new lambda.Function(this, "LoadDashboardHandlerV2", {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: "LoadDashboard.handler",
      code: lambda.Code.fromAsset("lambda"),
      timeout: cdk.Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        InviteTable: invitedVisitorTable.tableName,
        USER_TABLE: userTable.tableName,
        WEBSITE_ACTIVITY_TABLE: websiteActivityTable.tableName,
      },
    });
    enableXRay(loadDashboardFn);

    const getImageUrlFn = new NodejsFunction(this, "GeneratePresignedImageUrlHandlerV2", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "../lambda/generatePresignedDownloadUrl.ts"),
      handler: "handler",
      bundling: { target: "node18", minify: true, sourceMap: false },
      timeout: cdk.Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        BUCKET_NAME: facialBucket.bucketName,
        USER_TABLE: userTable.tableName,
      },
    });
    enableXRay(getImageUrlFn);

    const websiteHeartbeatFn = new NodejsFunction(this, "WebsiteHeartbeatHandlerV2", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "../lambda/heartbeat.ts"),
      handler: "handler",
      bundling: { target: "node18", minify: true, sourceMap: false },
      timeout: cdk.Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        WEBSITE_ACTIVITY_TABLE: websiteActivityTable.tableName,
        BROADCAST_LAMBDA: broadcastLambda.functionArn,
      },
    });
    enableXRay(websiteHeartbeatFn);

    const getUserBadgeInfoFn = new NodejsFunction(this, "GetUserBadgeInfoHandlerV2", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "../lambda/getUserBadgeInfo.ts"),
      handler: "handler",
      bundling: { target: "node18", minify: true, sourceMap: false },
      timeout: cdk.Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        USER_TABLE: userTable.tableName,
        BUCKET_NAME: facialBucket.bucketName,
      },
    });
    enableXRay(getUserBadgeInfoFn);

    facialBucket.grantReadWrite(arrivalRekognitionFn);
    facialBucket.grantReadWrite(visitorPreRegisterFn);
    facialBucket.grantRead(getImageUrlFn);
    facialBucket.grantRead(getUserBadgeInfoFn);

    userTable.grantReadWriteData(arrivalRekognitionFn);
    userTable.grantReadWriteData(visitorPreRegisterFn);
    userTable.grantReadData(getImageUrlFn);
    userTable.grantReadWriteData(getUserBadgeInfoFn);

    invitedVisitorTable.grantReadWriteData(registerVisitorIndividualFn);
    invitedVisitorTable.grantReadWriteData(registerVisitorBulkFn);
    invitedVisitorTable.grantReadWriteData(arrivalRekognitionFn);
    invitedVisitorTable.grantReadWriteData(loadDashboardFn);

    websiteActivityTable.grantReadWriteData(loadDashboardFn);
    websiteActivityTable.grantReadWriteData(websiteHeartbeatFn);

    for (const fn of [visitorPreRegisterFn, arrivalRekognitionFn]) {
      fn.addToRolePolicy(
        new iam.PolicyStatement({
          actions: [
            "rekognition:IndexFaces",
            "rekognition:SearchFacesByImage",
            "rekognition:DetectFaces",
          ],
          resources: ["*"],
        })
      );
    }

    arrivalTopic.grantPublish(arrivalRekognitionFn);
    sendFeedbackLambda.grantInvoke(arrivalRekognitionFn.role!);

    broadcastLambda.grantInvoke(arrivalRekognitionFn.role!);
    broadcastLambda.grantInvoke(visitorPreRegisterFn.role!);
    broadcastLambda.grantInvoke(registerVisitorIndividualFn.role!);
    broadcastLambda.grantInvoke(registerVisitorBulkFn.role!);
    broadcastLambda.grantInvoke(websiteHeartbeatFn.role!);

    const visitorArrivalRes = visitorResource.addResource("arrival");
    visitorArrivalRes.addMethod(
      "POST",
      new apigw.LambdaIntegration(arrivalRekognitionFn),
      publicOpts
    );

    const visitorRegisterRes = visitorResource.addResource("register");
    visitorRegisterRes.addMethod(
      "POST",
      new apigw.LambdaIntegration(visitorPreRegisterFn),
      publicOpts
    );

    const visitorGetImageUrlRes = visitorResource.addResource("get-image-url");
    visitorGetImageUrlRes.addMethod(
      "GET",
      new apigw.LambdaIntegration(getImageUrlFn),
      publicOpts
    );

    const visitorHeartbeatRes = visitorResource.addResource("heartbeat");
    visitorHeartbeatRes.addMethod(
      "POST",
      new apigw.LambdaIntegration(websiteHeartbeatFn),
      publicOpts
    );

    const visitorBadgeRes = visitorResource.addResource("badge");
    visitorBadgeRes.addMethod(
      "POST",
      new apigw.LambdaIntegration(getUserBadgeInfoFn),
      publicOpts
    );

    const adminRegisterIndividualRes = adminResource.addResource("registerVisitorIndividual");
    adminRegisterIndividualRes.addMethod(
      "POST",
      new apigw.LambdaIntegration(registerVisitorIndividualFn),
      adminOpts
    );

    const adminRegisterBulkRes = adminResource.addResource("registerVisitorBulk");
    adminRegisterBulkRes.addMethod(
      "POST",
      new apigw.LambdaIntegration(registerVisitorBulkFn),
      adminOpts
    );

    const adminLoadDashboardRes = adminResource.addResource("loadDashboard");
    adminLoadDashboardRes.addMethod(
      "POST",
      new apigw.LambdaIntegration(loadDashboardFn),
      adminOpts
    );
  }
}
