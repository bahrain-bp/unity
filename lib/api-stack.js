"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.APIStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const cognito = __importStar(require("aws-cdk-lib/aws-cognito"));
const apigw = __importStar(require("aws-cdk-lib/aws-apigateway"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const aws_lambda_nodejs_1 = require("aws-cdk-lib/aws-lambda-nodejs");
const path = __importStar(require("path"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const sns = __importStar(require("aws-cdk-lib/aws-sns"));
const subscriptions = __importStar(require("aws-cdk-lib/aws-sns-subscriptions"));
class APIStack extends cdk.Stack {
    constructor(scope, id, props) {
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
        const REKOG_COLLECTION_ID = dbStack.visitorFaceCollection.collectionId;
        // Ensure DBStack is created before APIStack
        this.addDependency(dbStack);
        // ────────────────────────────────
        // ✅ X-RAY HELPER (one place, apply to all lambdas)
        // ────────────────────────────────
        const enableXRay = (fn) => {
            fn.role?.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("AWSXRayDaemonWriteAccess"));
        };
        // ────────────────────────────────
        // ✅ ONE GLOBAL CORS (temporary "*", later replace with deployed frontend URL)
        // ────────────────────────────────
        const GLOBAL_CORS = {
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
        const postConfirmFn = new aws_lambda_nodejs_1.NodejsFunction(this, "PostConfirmVisitorHandler", {
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
        postConfirmFn.addToRolePolicy(new iam.PolicyStatement({
            actions: ["cognito-idp:AdminAddUserToGroup"],
            resources: ["*"],
        }));
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
                callbackUrls: ["localhost:5173" + "/callback"],
                logoutUrls: ["localhost:5173" + "/"],
                scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL],
            },
            supportedIdentityProviders: [
                cognito.UserPoolClientIdentityProvider.COGNITO,
            ],
        });
        const cfnClient = userPoolClient.node
            .defaultChild;
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
            cognitoDomain: { domainPrefix: `${prefixname}-unity-${this.account}-dev` },
        });
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
        const whoamiFn = new aws_lambda_nodejs_1.NodejsFunction(this, "WhoAmIHandler", {
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
        const setRoleFn = new aws_lambda_nodejs_1.NodejsFunction(this, "SetRoleHandler", {
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
        setRoleFn.addToRolePolicy(new iam.PolicyStatement({
            actions: [
                "cognito-idp:AdminAddUserToGroup",
                "cognito-idp:AdminRemoveUserFromGroup",
                "cognito-idp:AdminListGroupsForUser",
            ],
            resources: ["*"],
        }));
        const roleResource = api.root.addResource("role");
        roleResource.addMethod("POST", new apigw.LambdaIntegration(setRoleFn), {
            authorizer,
            authorizationType: apigw.AuthorizationType.COGNITO,
        });
        // ────────────────────────────────
        // PlugActions
        // ────────────────────────────────
        const plugActionsTable = dbStack.plugActionsTable;
        const plugControlFn = new aws_lambda_nodejs_1.NodejsFunction(this, "PlugControlHandler", {
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
                WS_CONNECTIONS_TABLE: wsStack.connectionsTable.tableName,
                WS_MANAGEMENT_ENDPOINT: wsStack.managementEndpoint,
            },
            tracing: lambda.Tracing.ACTIVE,
        });
        enableXRay(plugControlFn);
        plugActionsTable.grantReadWriteData(plugControlFn);
        wsStack.connectionsTable.grantReadData(plugControlFn);
        plugControlFn.addToRolePolicy(new iam.PolicyStatement({
            actions: ["execute-api:ManageConnections"],
            resources: [
                `arn:aws:execute-api:${this.region}:${this.account}:${wsStack.webSocketApi.apiId}/${wsStack.stage.stageName}/*/@connections/*`,
            ],
        }));
        const plugsResource = api.root.addResource("plugs");
        plugsResource.addMethod("POST", new apigw.LambdaIntegration(plugControlFn), {
            authorizer,
            authorizationType: apigw.AuthorizationType.COGNITO,
        });
        // ────────────────────────────────
        // Telemetry query
        // ────────────────────────────────
        const iotTelemetryTable = dbStack.iotTelemetryTable;
        const telemetryQueryFn = new aws_lambda_nodejs_1.NodejsFunction(this, "TelemetryQueryHandler", {
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
        const alexaTelemetryFn = new aws_lambda_nodejs_1.NodejsFunction(this, "AlexaTelemetryHandler", {
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
        const publicMethodOptions = {
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
        // ────────────────────────────────
        // WhatsApp Bot (Cloud API) — webhook
        // ────────────────────────────────
        const whatsappBotFn = new aws_lambda_nodejs_1.NodejsFunction(this, "WhatsAppBotHandler", {
            runtime: lambda.Runtime.NODEJS_18_X,
            entry: path.join(__dirname, "../lambda/whatsapp-bot.ts"),
            handler: "handler",
            bundling: { target: "node18", minify: true, sourceMap: false },
            environment: {
                TELEMETRY_TABLE: iotTelemetryTable.tableName,
                WHATSAPP_TOKEN: "EAAK2o4y1wuoBQWx18PoK9ymtzOzZAuZBWaZBexdwkdrS60e2kseWiDbFzehshKCV9eIQObFgHje4bRAvJCM6lvn8WP3qQq3kVqakeEYKCzooAinFYillZALhknRIqcZBxgt0A6Y5PUW56hJv4RVsZBtWQJ1SQsjWibzRL4zHXCUesGryKYdmDVscQ8FzaNKfZCkdxbNOFaCfZA7UYOY5bFcgTmXUQCR0id2ZB9LG5VcURgIf2jXOejDWZCcCbUdO8ZAOfa8Uw5ZAIZBvkA51HyRQCKVC2",
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
        webhookResource.addMethod("GET", new apigw.LambdaIntegration(whatsappBotFn), publicMethodOptions);
        webhookResource.addMethod("POST", new apigw.LambdaIntegration(whatsappBotFn), publicMethodOptions);
        new cdk.CfnOutput(this, "WhatsAppWebhookUrl", { value: api.url + "whatsapp/webhook" });
        // ────────────────────────────────
        // Virtual Assistant API route (Bedrock)
        // ────────────────────────────────
        const bedrockCfnFn = bedrockStack.lambdaFunction.node
            .defaultChild;
        bedrockCfnFn.tracingConfig = { mode: "Active" };
        enableXRay(bedrockStack.lambdaFunction);
        const assistantResource = api.root.addResource("assistant");
        assistantResource.addMethod("POST", new apigw.LambdaIntegration(bedrockStack.lambdaFunction));
        // ────────────────────────────────
        // Pre-Registration: Presigned Upload + Validate Image + Presigned Download
        // ────────────────────────────────
        const generatePresignedUrlFn = new aws_lambda_nodejs_1.NodejsFunction(this, "GeneratePresignedUrlHandler", {
            runtime: lambda.Runtime.NODEJS_20_X,
            entry: path.join(__dirname, "../lambda/generatePresignedUploadUrl.ts"),
            handler: "handler",
            environment: {
                BUCKET_NAME: preRegBucket.bucketName,
            },
            tracing: lambda.Tracing.ACTIVE,
        });
        enableXRay(generatePresignedUrlFn);
        preRegBucket.grantReadWrite(generatePresignedUrlFn);
        const uploadImageResource = api.root.addResource("upload-image");
        uploadImageResource.addMethod("POST", new apigw.LambdaIntegration(generatePresignedUrlFn), { authorizationType: apigw.AuthorizationType.NONE });
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
        validateImageResource.addMethod("POST", new apigw.LambdaIntegration(preRegisterCheckFn), { authorizationType: apigw.AuthorizationType.NONE });
        const getImageFn = new aws_lambda_nodejs_1.NodejsFunction(this, "GetPresignedDownloadUrlHandler", {
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
        const usersGetFn = new aws_lambda_nodejs_1.NodejsFunction(this, "UsersGetHandler", {
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
        usersGetFn.addToRolePolicy(new iam.PolicyStatement({
            actions: ["cognito-idp:ListUsers"],
            resources: [userPool.userPoolArn],
        }));
        usersResource.addMethod("GET", new apigw.LambdaIntegration(usersGetFn), {
            authorizer,
            authorizationType: apigw.AuthorizationType.COGNITO,
        });
        const usersCreateFn = new aws_lambda_nodejs_1.NodejsFunction(this, "UsersCreateHandler", {
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
        usersCreateFn.addToRolePolicy(new iam.PolicyStatement({
            actions: ["cognito-idp:AdminCreateUser"],
            resources: [userPool.userPoolArn],
        }));
        usersResource.addMethod("POST", new apigw.LambdaIntegration(usersCreateFn), {
            authorizer,
            authorizationType: apigw.AuthorizationType.COGNITO,
        });
        const usersUpdateFn = new aws_lambda_nodejs_1.NodejsFunction(this, "UsersUpdateHandler", {
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
        usersUpdateFn.addToRolePolicy(new iam.PolicyStatement({
            actions: ["cognito-idp:AdminUpdateUserAttributes"],
            resources: [userPool.userPoolArn],
        }));
        userByIdResource.addMethod("PUT", new apigw.LambdaIntegration(usersUpdateFn), {
            authorizer,
            authorizationType: apigw.AuthorizationType.COGNITO,
        });
        const usersDeleteFn = new aws_lambda_nodejs_1.NodejsFunction(this, "UsersDeleteHandler", {
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
        usersDeleteFn.addToRolePolicy(new iam.PolicyStatement({
            actions: ["cognito-idp:AdminDeleteUser"],
            resources: [userPool.userPoolArn],
        }));
        userByIdResource.addMethod("DELETE", new apigw.LambdaIntegration(usersDeleteFn), {
            authorizer,
            authorizationType: apigw.AuthorizationType.COGNITO,
        });
        // ────────────────────────────────
        // Analytics Dashboard (REAL DATA)
        // ────────────────────────────────
        const analyticsDashboardFn = new aws_lambda_nodejs_1.NodejsFunction(this, "AnalyticsDashboardHandler", {
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
        const presignedUrlHandler = new aws_lambda_nodejs_1.NodejsFunction(this, "PresignedUrlHandler", {
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
        presignedUrlHandler.addToRolePolicy(new iam.PolicyStatement({
            actions: ["cloudfront:CreateInvalidation"],
            resources: ["*"],
        }));
        const uploadResource = api.root.addResource("generate-upload-urls");
        uploadResource.addMethod("POST", new apigw.LambdaIntegration(presignedUrlHandler));
        // ────────────────────────────────────────────────
        // Visitor Feedback API (python)
        // ────────────────────────────────────────────────
        const createPythonLambda = (id, handlerFile, functionName, env) => {
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
                functionName: `${prefixname}${functionName}`,
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
        const getVisitorInfoLambda = createPythonLambda("GetVisitorInfoLambda", "getVisitorInfo", "GetVisitorInfoLambda", commonEnv);
        const submitFeedbackLambda = createPythonLambda("SubmitFeedbackLambda", "submitFeedback", "SubmitFeedbackLambda", commonEnv);
        const getFeedbackLambda = createPythonLambda("GetFeedbackLambda", "getFeedback", "GetFeedbackLambda", commonEnv);
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
        broadcastLambda.grantInvoke(submitFeedbackLambda.role);
        const getVisitorInfoResource = api.root.addResource("getVisitorInfo");
        getVisitorInfoResource.addMethod("GET", new apigw.LambdaIntegration(getVisitorInfoLambda), {});
        const submitFeedbackResource = api.root.addResource("submitFeedback");
        submitFeedbackResource.addMethod("POST", new apigw.LambdaIntegration(submitFeedbackLambda), {
        // authorizer,
        // authorizationType: apigw.AuthorizationType.COGNITO,
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
        const publicOpts = {
            authorizationType: apigw.AuthorizationType.NONE,
            apiKeyRequired: false,
        };
        const adminOpts = {
            authorizer,
            authorizationType: apigw.AuthorizationType.COGNITO,
        };
        const arrivalTopic = new sns.Topic(this, "VisitorArrivalTopic", {
            topicName: `${prefixname}-VisitorArrivalNotifications`,
        });
        arrivalTopic.addSubscription(new subscriptions.SmsSubscription("+97332233417"));
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
                FRONTEND_URL: frontendStack.distribution.domainName + "/VisitorFeedBack",
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
                SEND_FEEDBACK_LAMBDA_NAME: sendFeedbackLambda.functionName,
            },
        });
        enableXRay(arrivalRekognitionFn);
        const arrivalRole = arrivalRekognitionFn.role;
        sendFeedbackLambda.grantInvoke(arrivalRole);
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
                FRONTEND_URL: frontendStack.distribution.domainName,
                GMAIL_USER: 'bahtwinnoreply@gmail.com', // Gmail address for sending
                GMAIL_PASS: 'zdjl cdgw kxzb okny', // Gmail app password
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
                FRONTEND_URL: frontendStack.distribution.domainName,
                GMAIL_USER: '	bahtwinnoreply@gmail.com', // Gmail address for sending
                GMAIL_PASS: 'zdjl cdgw kxzb okny', // Gmail app password
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
        userTable.grantReadWriteData(loadDashboardFn);
        const getImageUrlFn = new aws_lambda_nodejs_1.NodejsFunction(this, "GeneratePresignedImageUrlHandlerV2", {
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
        const websiteHeartbeatFn = new aws_lambda_nodejs_1.NodejsFunction(this, "WebsiteHeartbeatHandlerV2", {
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
        const getUserBadgeInfoFn = new aws_lambda_nodejs_1.NodejsFunction(this, "GetUserBadgeInfoHandlerV2", {
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
            fn.addToRolePolicy(new iam.PolicyStatement({
                actions: [
                    "rekognition:IndexFaces",
                    "rekognition:SearchFacesByImage",
                    "rekognition:DetectFaces",
                ],
                resources: ["*"],
            }));
        }
        arrivalTopic.grantPublish(arrivalRekognitionFn);
        sendFeedbackLambda.grantInvoke(arrivalRekognitionFn.role);
        broadcastLambda.grantInvoke(arrivalRekognitionFn.role);
        broadcastLambda.grantInvoke(visitorPreRegisterFn.role);
        broadcastLambda.grantInvoke(registerVisitorIndividualFn.role);
        broadcastLambda.grantInvoke(registerVisitorBulkFn.role);
        broadcastLambda.grantInvoke(websiteHeartbeatFn.role);
        const visitorArrivalRes = visitorResource.addResource("arrival");
        visitorArrivalRes.addMethod("POST", new apigw.LambdaIntegration(arrivalRekognitionFn), publicOpts);
        const visitorRegisterRes = visitorResource.addResource("register");
        visitorRegisterRes.addMethod("POST", new apigw.LambdaIntegration(visitorPreRegisterFn), publicOpts);
        const visitorGetImageUrlRes = visitorResource.addResource("get-image-url");
        visitorGetImageUrlRes.addMethod("GET", new apigw.LambdaIntegration(getImageUrlFn), publicOpts);
        const visitorHeartbeatRes = visitorResource.addResource("heartbeat");
        visitorHeartbeatRes.addMethod("POST", new apigw.LambdaIntegration(websiteHeartbeatFn), publicOpts);
        const visitorBadgeRes = visitorResource.addResource("badge");
        visitorBadgeRes.addMethod("POST", new apigw.LambdaIntegration(getUserBadgeInfoFn), publicOpts);
        const adminRegisterIndividualRes = adminResource.addResource("registerVisitorIndividual");
        adminRegisterIndividualRes.addMethod("POST", new apigw.LambdaIntegration(registerVisitorIndividualFn), adminOpts);
        const adminRegisterBulkRes = adminResource.addResource("registerVisitorBulk");
        adminRegisterBulkRes.addMethod("POST", new apigw.LambdaIntegration(registerVisitorBulkFn), adminOpts);
        const adminLoadDashboardRes = adminResource.addResource("loadDashboard");
        adminLoadDashboardRes.addMethod("POST", new apigw.LambdaIntegration(loadDashboardFn), adminOpts);
        //get user info lambda
        const GetUserInfo = new lambda.Function(this, 'GetUserInfo', {
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: 'GetUserInfo.handler',
            code: lambda.Code.fromAsset('lambda'),
            environment: {
                USER_TABLE: userTable.tableName,
                BUCKET_NAME: facialBucket.bucketName
            },
            timeout: cdk.Duration.seconds(30),
            //functionName: 'GetUserInfo', 
            logRetention: logs.RetentionDays.ONE_DAY, // <- CDK will manage the log group
        });
        facialBucket.grantRead(GetUserInfo);
        preRegBucket.grantRead(GetUserInfo);
        userTable.grantReadWriteData(GetUserInfo);
        const getUserInfo = visitorResource.addResource('me');
        getUserInfo.addMethod('GET', new apigw.LambdaIntegration(GetUserInfo, {
            proxy: true
        }));
    }
}
exports.APIStack = APIStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBpLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXBpLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBR25DLGlFQUFtRDtBQUNuRCxrRUFBb0Q7QUFDcEQsK0RBQWlEO0FBRWpELHlEQUEyQztBQUMzQyxxRUFBK0Q7QUFDL0QsMkNBQTZCO0FBSTdCLDJEQUE2QztBQUM3Qyx5REFBMkM7QUFDM0MsaUZBQW1FO0FBVW5FLE1BQWEsUUFBUyxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3JDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBb0I7UUFDNUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7UUFFOUQsTUFBTSxPQUFPLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQztRQUM5QixNQUFNLE9BQU8sR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDO1FBQzlCLE1BQU0sWUFBWSxHQUFHLEtBQUssQ0FBQyxZQUFZLENBQUM7UUFDeEMsTUFBTSxhQUFhLEdBQUcsS0FBSyxDQUFDLGFBQWEsQ0FBQztRQUMxQyxNQUFNLGVBQWUsR0FBRyxLQUFLLENBQUMsZUFBZSxDQUFDO1FBRTlDLE1BQU0sWUFBWSxHQUFHLE9BQU8sQ0FBQyxZQUFZLENBQUM7UUFDMUMsTUFBTSxTQUFTLEdBQUcsT0FBTyxDQUFDLG1CQUFtQixDQUFDO1FBRTlDLE1BQU0sYUFBYSxHQUFHLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQztRQUNuRCxNQUFNLGVBQWUsR0FBRyxPQUFPLENBQUMsZUFBZSxDQUFDO1FBQ2hELE1BQU0sbUJBQW1CLEdBQUcsT0FBTyxDQUFDLHFCQUFxQixDQUFDLFlBQWEsQ0FBQztRQUV4RSw0Q0FBNEM7UUFDNUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUU1QixtQ0FBbUM7UUFDbkMsbURBQW1EO1FBQ25ELG1DQUFtQztRQUNuQyxNQUFNLFVBQVUsR0FBRyxDQUFDLEVBQW1CLEVBQUUsRUFBRTtZQUN6QyxFQUFFLENBQUMsSUFBSSxFQUFFLGdCQUFnQixDQUN2QixHQUFHLENBQUMsYUFBYSxDQUFDLHdCQUF3QixDQUFDLDBCQUEwQixDQUFDLENBQ3ZFLENBQUM7UUFDSixDQUFDLENBQUM7UUFFRixtQ0FBbUM7UUFDbkMsOEVBQThFO1FBQzlFLG1DQUFtQztRQUNuQyxNQUFNLFdBQVcsR0FBc0I7WUFDckMsWUFBWSxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLE1BQU07WUFDNUMsWUFBWSxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsV0FBVztZQUNwQyxZQUFZLEVBQUU7Z0JBQ1osY0FBYztnQkFDZCxlQUFlO2dCQUNmLFlBQVk7Z0JBQ1osV0FBVztnQkFDWCxzQkFBc0I7Z0JBQ3RCLGtCQUFrQjthQUNuQjtTQUNGLENBQUM7UUFFRixxQ0FBcUM7UUFDckMsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxrQkFBa0IsRUFBRTtZQUMxQyxLQUFLLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxTQUFTO1lBQzlCLFdBQVcsRUFBRSw0Q0FBNEM7U0FDMUQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRTtZQUN6QyxLQUFLLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxRQUFRO1lBQzdCLFdBQVcsRUFBRSwyQ0FBMkM7U0FDekQsQ0FBQyxDQUFDO1FBRUgsbUNBQW1DO1FBQ25DLHVCQUF1QjtRQUN2QixtQ0FBbUM7UUFDbkMsTUFBTSxRQUFRLEdBQUcsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDM0QsWUFBWSxFQUFFLEdBQUcsVUFBVSxjQUFjO1lBQ3pDLGlCQUFpQixFQUFFLElBQUk7WUFDdkIsYUFBYSxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRTtZQUM5QixrQkFBa0IsRUFBRTtnQkFDbEIsS0FBSyxFQUFFLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFO2FBQzFDO1lBQ0QsY0FBYyxFQUFFO2dCQUNkLFNBQVMsRUFBRSxDQUFDO2dCQUNaLGFBQWEsRUFBRSxJQUFJO2dCQUNuQixnQkFBZ0IsRUFBRSxJQUFJO2dCQUN0QixnQkFBZ0IsRUFBRSxJQUFJO2dCQUN0QixjQUFjLEVBQUUsS0FBSzthQUN0QjtZQUNELGVBQWUsRUFBRSxPQUFPLENBQUMsZUFBZSxDQUFDLFVBQVU7U0FDcEQsQ0FBQyxDQUFDO1FBRUgsTUFBTSxhQUFhLEdBQUcsSUFBSSxrQ0FBYyxDQUFDLElBQUksRUFBRSwyQkFBMkIsRUFBRTtZQUMxRSxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLEtBQUssRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxtQ0FBbUMsQ0FBQztZQUNoRSxPQUFPLEVBQUUsU0FBUztZQUNsQixRQUFRLEVBQUU7Z0JBQ1IsTUFBTSxFQUFFLFFBQVE7Z0JBQ2hCLE1BQU0sRUFBRSxJQUFJO2dCQUNaLFNBQVMsRUFBRSxLQUFLO2FBQ2pCO1lBQ0QsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTTtTQUMvQixDQUFDLENBQUM7UUFDSCxVQUFVLENBQUMsYUFBYSxDQUFDLENBQUM7UUFFMUIsYUFBYSxDQUFDLGVBQWUsQ0FDM0IsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO1lBQ3RCLE9BQU8sRUFBRSxDQUFDLGlDQUFpQyxDQUFDO1lBQzVDLFNBQVMsRUFBRSxDQUFDLEdBQUcsQ0FBQztTQUNqQixDQUFDLENBQ0gsQ0FBQztRQUVGLFFBQVEsQ0FBQyxVQUFVLENBQ2pCLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxpQkFBaUIsRUFDM0MsYUFBYSxDQUNkLENBQUM7UUFFRixNQUFNLGNBQWMsR0FBRyxJQUFJLE9BQU8sQ0FBQyxjQUFjLENBQy9DLElBQUksRUFDSix1QkFBdUIsRUFDdkI7WUFDRSxRQUFRO1lBQ1IsY0FBYyxFQUFFLEtBQUs7WUFDckIsU0FBUyxFQUFFLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxZQUFZLEVBQUUsSUFBSSxFQUFFO1lBQ2hELEtBQUssRUFBRTtnQkFDTCxLQUFLLEVBQUU7b0JBQ0wsc0JBQXNCLEVBQUUsSUFBSTtvQkFDNUIsaUJBQWlCLEVBQUUsSUFBSTtpQkFDeEI7Z0JBQ0QsWUFBWSxFQUFFLENBQUMsZ0JBQWdCLEdBQUcsV0FBVyxDQUFDO2dCQUM5QyxVQUFVLEVBQUUsQ0FBQyxnQkFBZ0IsR0FBRyxHQUFHLENBQUM7Z0JBQ3BDLE1BQU0sRUFBRSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDO2FBQzlEO1lBQ0QsMEJBQTBCLEVBQUU7Z0JBQzFCLE9BQU8sQ0FBQyw4QkFBOEIsQ0FBQyxPQUFPO2FBQy9DO1NBQ0YsQ0FDRixDQUFDO1FBRUYsTUFBTSxTQUFTLEdBQUcsY0FBYyxDQUFDLElBQUk7YUFDbEMsWUFBeUMsQ0FBQztRQUM3QyxTQUFTLENBQUMsK0JBQStCLEdBQUcsSUFBSSxDQUFDO1FBQ2pELFNBQVMsQ0FBQyxpQkFBaUIsR0FBRyxDQUFDLE1BQU0sRUFBRSxVQUFVLENBQUMsQ0FBQztRQUNuRCxTQUFTLENBQUMsa0JBQWtCLEdBQUcsQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDbkQsU0FBUyxDQUFDLDBCQUEwQixHQUFHLENBQUMsU0FBUyxDQUFDLENBQUM7UUFFbkQsSUFBSSxPQUFPLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUMvQyxVQUFVLEVBQUUsUUFBUSxDQUFDLFVBQVU7WUFDL0IsU0FBUyxFQUFFLE9BQU87U0FDbkIsQ0FBQyxDQUFDO1FBRUgsSUFBSSxPQUFPLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRTtZQUNqRCxVQUFVLEVBQUUsUUFBUSxDQUFDLFVBQVU7WUFDL0IsU0FBUyxFQUFFLFNBQVM7U0FDckIsQ0FBQyxDQUFDO1FBRUgsSUFBSSxPQUFPLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRTtZQUNqRCxVQUFVLEVBQUUsUUFBUSxDQUFDLFVBQVU7WUFDL0IsU0FBUyxFQUFFLFNBQVM7U0FDckIsQ0FBQyxDQUFDO1FBRUgsTUFBTSxjQUFjLEdBQUcsSUFBSSxPQUFPLENBQUMsY0FBYyxDQUMvQyxJQUFJLEVBQ0oscUJBQXFCLEVBQ3JCO1lBQ0UsUUFBUTtZQUNSLGFBQWEsRUFBRSxFQUFFLFlBQVksRUFBRSxHQUFHLFVBQVUsVUFBVSxJQUFJLENBQUMsT0FBTyxNQUFNLEVBQUU7U0FDM0UsQ0FDRixDQUFDO1FBRUYsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUUsRUFBRSxLQUFLLEVBQUUsUUFBUSxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUM7UUFDdEUsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxrQkFBa0IsRUFBRTtZQUMxQyxLQUFLLEVBQUUsY0FBYyxDQUFDLGdCQUFnQjtTQUN2QyxDQUFDLENBQUM7UUFDSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO1lBQzNDLEtBQUssRUFBRSxjQUFjLENBQUMsT0FBTyxFQUFFO1NBQ2hDLENBQUMsQ0FBQztRQUVILG1DQUFtQztRQUNuQyw2QkFBNkI7UUFDN0IsbUNBQW1DO1FBQ25DLE1BQU0sT0FBTyxHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFO1lBQ3hELE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsT0FBTyxFQUFFLGVBQWU7WUFDeEIsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQztZQUNyQyxXQUFXLEVBQUU7Z0JBQ1gsVUFBVSxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsU0FBUztnQkFDbkMsWUFBWSxFQUFFLFFBQVEsQ0FBQyxVQUFVO2FBQ2xDO1lBQ0QsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTTtTQUMvQixDQUFDLENBQUM7UUFDSCxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFcEIsbUNBQW1DO1FBQ25DLHNDQUFzQztRQUN0QyxrQ0FBa0M7UUFDbEMsbUNBQW1DO1FBQ25DLE1BQU0sR0FBRyxHQUFHLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFO1lBQ2xELFdBQVcsRUFBRSxHQUFHLFVBQVUsZ0JBQWdCO1lBQzFDLGFBQWEsRUFBRTtnQkFDYixTQUFTLEVBQUUsS0FBSztnQkFDaEIsY0FBYyxFQUFFLElBQUk7YUFDckI7WUFDRCwyQkFBMkIsRUFBRSxXQUFXO1NBQ3pDLENBQUMsQ0FBQztRQUVILE1BQU0sVUFBVSxHQUFHLElBQUksS0FBSyxDQUFDLDBCQUEwQixDQUNyRCxJQUFJLEVBQ0osd0JBQXdCLEVBQ3hCO1lBQ0UsZ0JBQWdCLEVBQUUsQ0FBQyxRQUFRLENBQUM7U0FDN0IsQ0FDRixDQUFDO1FBRUYsTUFBTSxhQUFhLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDcEQsYUFBYSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsT0FBTyxDQUFDLEVBQUU7WUFDbkUsVUFBVTtZQUNWLGlCQUFpQixFQUFFLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPO1NBQ25ELENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO1FBRTNELG1DQUFtQztRQUNuQyxTQUFTO1FBQ1QsbUNBQW1DO1FBQ25DLE1BQU0sUUFBUSxHQUFHLElBQUksa0NBQWMsQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQ3pELE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsS0FBSyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLHFCQUFxQixDQUFDO1lBQ2xELE9BQU8sRUFBRSxTQUFTO1lBQ2xCLFFBQVEsRUFBRTtnQkFDUixNQUFNLEVBQUUsUUFBUTtnQkFDaEIsTUFBTSxFQUFFLElBQUk7Z0JBQ1osU0FBUyxFQUFFLEtBQUs7YUFDakI7WUFDRCxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUFNO1NBQy9CLENBQUMsQ0FBQztRQUNILFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUVyQixNQUFNLGNBQWMsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUN0RCxjQUFjLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLENBQUMsRUFBRTtZQUNyRSxpQkFBaUIsRUFBRSxLQUFLLENBQUMsaUJBQWlCLENBQUMsSUFBSTtTQUNoRCxDQUFDLENBQUM7UUFFSCxtQ0FBbUM7UUFDbkMsV0FBVztRQUNYLG1DQUFtQztRQUNuQyxNQUFNLFNBQVMsR0FBRyxJQUFJLGtDQUFjLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO1lBQzNELE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsS0FBSyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLHVCQUF1QixDQUFDO1lBQ3BELE9BQU8sRUFBRSxTQUFTO1lBQ2xCLFFBQVEsRUFBRTtnQkFDUixNQUFNLEVBQUUsUUFBUTtnQkFDaEIsTUFBTSxFQUFFLElBQUk7Z0JBQ1osU0FBUyxFQUFFLEtBQUs7YUFDakI7WUFDRCxXQUFXLEVBQUU7Z0JBQ1gsWUFBWSxFQUFFLFFBQVEsQ0FBQyxVQUFVO2FBQ2xDO1lBQ0QsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTTtTQUMvQixDQUFDLENBQUM7UUFDSCxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUM7UUFFdEIsU0FBUyxDQUFDLGVBQWUsQ0FDdkIsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO1lBQ3RCLE9BQU8sRUFBRTtnQkFDUCxpQ0FBaUM7Z0JBQ2pDLHNDQUFzQztnQkFDdEMsb0NBQW9DO2FBQ3JDO1lBQ0QsU0FBUyxFQUFFLENBQUMsR0FBRyxDQUFDO1NBQ2pCLENBQUMsQ0FDSCxDQUFDO1FBRUYsTUFBTSxZQUFZLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDbEQsWUFBWSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsU0FBUyxDQUFDLEVBQUU7WUFDckUsVUFBVTtZQUNWLGlCQUFpQixFQUFFLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPO1NBQ25ELENBQUMsQ0FBQztRQUVILG1DQUFtQztRQUNuQyxjQUFjO1FBQ2QsbUNBQW1DO1FBQ25DLE1BQU0sZ0JBQWdCLEdBQW1CLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQztRQUVsRSxNQUFNLGFBQWEsR0FBRyxJQUFJLGtDQUFjLENBQUMsSUFBSSxFQUFFLG9CQUFvQixFQUFFO1lBQ25FLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsS0FBSyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLDJCQUEyQixDQUFDO1lBQ3hELE9BQU8sRUFBRSxTQUFTO1lBQ2xCLFFBQVEsRUFBRTtnQkFDUixNQUFNLEVBQUUsUUFBUTtnQkFDaEIsTUFBTSxFQUFFLElBQUk7Z0JBQ1osU0FBUyxFQUFFLEtBQUs7YUFDakI7WUFDRCxXQUFXLEVBQUU7Z0JBQ1gsa0JBQWtCLEVBQUUsZ0JBQWdCLENBQUMsU0FBUztnQkFDOUMscUJBQXFCLEVBQUUsdUNBQXVDO2dCQUM5RCxrQkFBa0IsRUFDaEIsbUVBQW1FO2dCQUNyRSxlQUFlLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQztvQkFDOUIsS0FBSyxFQUFFLEVBQUUsRUFBRSxFQUFFLGVBQWUsRUFBRSxHQUFHLEVBQUUsZ0JBQWdCLEVBQUU7b0JBQ3JELEtBQUssRUFBRSxFQUFFLEVBQUUsRUFBRSxlQUFlLEVBQUUsR0FBRyxFQUFFLGdCQUFnQixFQUFFO2lCQUN0RCxDQUFDO2dCQUNGLGdCQUFnQixFQUFFLElBQUk7Z0JBRXRCLG9CQUFvQixFQUFFLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTO2dCQUN4RCxzQkFBc0IsRUFBRSxPQUFPLENBQUMsa0JBQWtCO2FBQ25EO1lBQ0QsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTTtTQUMvQixDQUFDLENBQUM7UUFDSCxVQUFVLENBQUMsYUFBYSxDQUFDLENBQUM7UUFFMUIsZ0JBQWdCLENBQUMsa0JBQWtCLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDbkQsT0FBTyxDQUFDLGdCQUFnQixDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUV0RCxhQUFhLENBQUMsZUFBZSxDQUMzQixJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7WUFDdEIsT0FBTyxFQUFFLENBQUMsK0JBQStCLENBQUM7WUFDMUMsU0FBUyxFQUFFO2dCQUNULHVCQUF1QixJQUFJLENBQUMsTUFBTSxJQUFJLElBQUksQ0FBQyxPQUFPLElBQUksT0FBTyxDQUFDLFlBQVksQ0FBQyxLQUFLLElBQUksT0FBTyxDQUFDLEtBQUssQ0FBQyxTQUFTLG1CQUFtQjthQUMvSDtTQUNGLENBQUMsQ0FDSCxDQUFDO1FBRUYsTUFBTSxhQUFhLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDcEQsYUFBYSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsYUFBYSxDQUFDLEVBQUU7WUFDMUUsVUFBVTtZQUNWLGlCQUFpQixFQUFFLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPO1NBQ25ELENBQUMsQ0FBQztRQUVILG1DQUFtQztRQUNuQyxrQkFBa0I7UUFDbEIsbUNBQW1DO1FBQ25DLE1BQU0saUJBQWlCLEdBQW1CLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQztRQUVwRSxNQUFNLGdCQUFnQixHQUFHLElBQUksa0NBQWMsQ0FBQyxJQUFJLEVBQUUsdUJBQXVCLEVBQUU7WUFDekUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNuQyxLQUFLLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsOEJBQThCLENBQUM7WUFDM0QsT0FBTyxFQUFFLFNBQVM7WUFDbEIsUUFBUSxFQUFFO2dCQUNSLE1BQU0sRUFBRSxRQUFRO2dCQUNoQixNQUFNLEVBQUUsSUFBSTtnQkFDWixTQUFTLEVBQUUsS0FBSzthQUNqQjtZQUNELFdBQVcsRUFBRTtnQkFDWCxlQUFlLEVBQUUsaUJBQWlCLENBQUMsU0FBUzthQUM3QztZQUNELE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU07U0FDL0IsQ0FBQyxDQUFDO1FBQ0gsVUFBVSxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFFN0IsaUJBQWlCLENBQUMsYUFBYSxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFFbEQsTUFBTSxpQkFBaUIsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUM1RCxpQkFBaUIsQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLGdCQUFnQixDQUFDLEVBQUU7WUFDaEYsVUFBVTtZQUNWLGlCQUFpQixFQUFFLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPO1NBQ25ELENBQUMsQ0FBQztRQUVILG1DQUFtQztRQUNuQyw2QkFBNkI7UUFDN0IsbUNBQW1DO1FBQ25DLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxrQ0FBYyxDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtZQUN6RSxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLEtBQUssRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSw4QkFBOEIsQ0FBQztZQUMzRCxPQUFPLEVBQUUsU0FBUztZQUNsQixRQUFRLEVBQUUsRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRTtZQUM5RCxXQUFXLEVBQUU7Z0JBQ1gsZUFBZSxFQUFFLGlCQUFpQixDQUFDLFNBQVM7Z0JBQzVDLFVBQVUsRUFBRSxPQUFPO2dCQUNuQixVQUFVLEVBQUUsa0JBQWtCO2FBQy9CO1lBQ0QsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTTtTQUMvQixDQUFDLENBQUM7UUFDSCxVQUFVLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUU3QixpQkFBaUIsQ0FBQyxhQUFhLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUVsRCxNQUFNLGFBQWEsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUVwRCxNQUFNLG1CQUFtQixHQUF3QjtZQUMvQyxpQkFBaUIsRUFBRSxLQUFLLENBQUMsaUJBQWlCLENBQUMsSUFBSTtZQUMvQyxjQUFjLEVBQUUsS0FBSztTQUN0QixDQUFDO1FBRUYsYUFBYTthQUNWLFdBQVcsQ0FBQyxJQUFJLENBQUM7YUFDakIsV0FBVyxDQUFDLFFBQVEsQ0FBQzthQUNyQixTQUFTLENBQ1IsS0FBSyxFQUNMLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLGdCQUFnQixDQUFDLEVBQzdDLG1CQUFtQixDQUNwQixDQUFDO1FBRUosYUFBYTthQUNWLFdBQVcsQ0FBQyxTQUFTLENBQUM7YUFDdEIsV0FBVyxDQUFDLFFBQVEsQ0FBQzthQUNyQixTQUFTLENBQ1IsS0FBSyxFQUNMLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLGdCQUFnQixDQUFDLEVBQzdDLG1CQUFtQixDQUNwQixDQUFDO1FBRUosYUFBYTthQUNWLFdBQVcsQ0FBQyxTQUFTLENBQUM7YUFDdEIsU0FBUyxDQUNSLEtBQUssRUFDTCxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUM3QyxtQkFBbUIsQ0FDcEIsQ0FBQztRQUVKLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsa0JBQWtCLEVBQUUsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLEdBQUcsR0FBRyxpQkFBaUIsRUFBRSxDQUFDLENBQUM7UUFDcEYsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsR0FBRyxHQUFHLHNCQUFzQixFQUFFLENBQUMsQ0FBQztRQUM5RixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxHQUFHLEdBQUcsZUFBZSxFQUFFLENBQUMsQ0FBQztRQUVqRixtQ0FBbUM7UUFDbkMscUNBQXFDO1FBQ3JDLG1DQUFtQztRQUNuQyxNQUFNLGFBQWEsR0FBRyxJQUFJLGtDQUFjLENBQUMsSUFBSSxFQUFFLG9CQUFvQixFQUFFO1lBQ25FLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsS0FBSyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLDJCQUEyQixDQUFDO1lBQ3hELE9BQU8sRUFBRSxTQUFTO1lBQ2xCLFFBQVEsRUFBRSxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFO1lBQzlELFdBQVcsRUFBRTtnQkFDWCxlQUFlLEVBQUUsaUJBQWlCLENBQUMsU0FBUztnQkFDNUMsY0FBYyxFQUNaLGdTQUFnUztnQkFDbFMsZUFBZSxFQUFFLGlCQUFpQjtnQkFDbEMsWUFBWSxFQUFFLG1CQUFtQjtnQkFDakMsY0FBYyxFQUFFLGNBQWM7YUFDL0I7WUFDRCxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUFNO1NBQy9CLENBQUMsQ0FBQztRQUNILFVBQVUsQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUUxQixpQkFBaUIsQ0FBQyxhQUFhLENBQUMsYUFBYSxDQUFDLENBQUM7UUFFL0MsTUFBTSxnQkFBZ0IsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUMxRCxNQUFNLGVBQWUsR0FBRyxnQkFBZ0IsQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUM7UUFFaEUsZUFBZSxDQUFDLFNBQVMsQ0FDdkIsS0FBSyxFQUNMLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLGFBQWEsQ0FBQyxFQUMxQyxtQkFBbUIsQ0FDcEIsQ0FBQztRQUNGLGVBQWUsQ0FBQyxTQUFTLENBQ3ZCLE1BQU0sRUFDTixJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxhQUFhLENBQUMsRUFDMUMsbUJBQW1CLENBQ3BCLENBQUM7UUFFRixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLG9CQUFvQixFQUFFLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxHQUFHLEdBQUcsa0JBQWtCLEVBQUUsQ0FBQyxDQUFDO1FBRXZGLG1DQUFtQztRQUNuQyx3Q0FBd0M7UUFDeEMsbUNBQW1DO1FBQ25DLE1BQU0sWUFBWSxHQUFHLFlBQVksQ0FBQyxjQUFjLENBQUMsSUFBSTthQUNsRCxZQUFrQyxDQUFDO1FBQ3RDLFlBQVksQ0FBQyxhQUFhLEdBQUcsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLENBQUM7UUFFaEQsVUFBVSxDQUFDLFlBQVksQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUV4QyxNQUFNLGlCQUFpQixHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQzVELGlCQUFpQixDQUFDLFNBQVMsQ0FDekIsTUFBTSxFQUNOLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLFlBQVksQ0FBQyxjQUFjLENBQUMsQ0FDekQsQ0FBQztRQUVGLG1DQUFtQztRQUNuQywyRUFBMkU7UUFDM0UsbUNBQW1DO1FBQ25DLE1BQU0sc0JBQXNCLEdBQUcsSUFBSSxrQ0FBYyxDQUMvQyxJQUFJLEVBQ0osNkJBQTZCLEVBQzdCO1lBQ0UsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNuQyxLQUFLLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUseUNBQXlDLENBQUM7WUFDdEUsT0FBTyxFQUFFLFNBQVM7WUFDbEIsV0FBVyxFQUFFO2dCQUNYLFdBQVcsRUFBRSxZQUFZLENBQUMsVUFBVTthQUNyQztZQUNELE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU07U0FDL0IsQ0FDRixDQUFDO1FBQ0YsVUFBVSxDQUFDLHNCQUFzQixDQUFDLENBQUM7UUFFbkMsWUFBWSxDQUFDLGNBQWMsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO1FBRXBELE1BQU0sbUJBQW1CLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDakUsbUJBQW1CLENBQUMsU0FBUyxDQUMzQixNQUFNLEVBQ04sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsc0JBQXNCLENBQUMsRUFDbkQsRUFBRSxpQkFBaUIsRUFBRSxLQUFLLENBQUMsaUJBQWlCLENBQUMsSUFBSSxFQUFFLENBQ3BELENBQUM7UUFFRixNQUFNLGtCQUFrQixHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUseUJBQXlCLEVBQUU7WUFDOUUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsVUFBVTtZQUNsQyxPQUFPLEVBQUUsMEJBQTBCO1lBQ25DLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUM7WUFDckMsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNqQyxXQUFXLEVBQUU7Z0JBQ1gsV0FBVyxFQUFFLFlBQVksQ0FBQyxVQUFVO2dCQUNwQyxxQkFBcUIsRUFBRSxTQUFTLENBQUMsU0FBUztnQkFDMUMsYUFBYSxFQUFFLEdBQUcsVUFBVSx3QkFBd0I7YUFDckQ7WUFDRCxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUFNO1NBQy9CLENBQUMsQ0FBQztRQUNILFVBQVUsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1FBRS9CLFlBQVksQ0FBQyxjQUFjLENBQUMsa0JBQWtCLENBQUMsQ0FBQztRQUNoRCxTQUFTLENBQUMsa0JBQWtCLENBQUMsa0JBQWtCLENBQUMsQ0FBQztRQUVqRCxNQUFNLHFCQUFxQixHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFDckUscUJBQXFCLENBQUMsU0FBUyxDQUM3QixNQUFNLEVBQ04sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsa0JBQWtCLENBQUMsRUFDL0MsRUFBRSxpQkFBaUIsRUFBRSxLQUFLLENBQUMsaUJBQWlCLENBQUMsSUFBSSxFQUFFLENBQ3BELENBQUM7UUFFRixNQUFNLFVBQVUsR0FBRyxJQUFJLGtDQUFjLENBQUMsSUFBSSxFQUFFLGdDQUFnQyxFQUFFO1lBQzVFLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsS0FBSyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLDJDQUEyQyxDQUFDO1lBQ3hFLE9BQU8sRUFBRSxTQUFTO1lBQ2xCLFdBQVcsRUFBRTtnQkFDWCxXQUFXLEVBQUUsWUFBWSxDQUFDLFVBQVU7YUFDckM7WUFDRCxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUFNO1NBQy9CLENBQUMsQ0FBQztRQUNILFVBQVUsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUV2QixZQUFZLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBRW5DLE1BQU0sZ0JBQWdCLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDM0QsZ0JBQWdCLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxVQUFVLENBQUMsRUFBRTtZQUN6RSxpQkFBaUIsRUFBRSxLQUFLLENBQUMsaUJBQWlCLENBQUMsSUFBSTtTQUNoRCxDQUFDLENBQUM7UUFFSCxtQ0FBbUM7UUFDbkMsa0JBQWtCO1FBQ2xCLG1DQUFtQztRQUNuQyxNQUFNLGFBQWEsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNwRCxNQUFNLGdCQUFnQixHQUFHLGFBQWEsQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLENBQUM7UUFFL0QsTUFBTSxVQUFVLEdBQUcsSUFBSSxrQ0FBYyxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRTtZQUM3RCxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLEtBQUssRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSx3QkFBd0IsQ0FBQztZQUNyRCxPQUFPLEVBQUUsU0FBUztZQUNsQixXQUFXLEVBQUU7Z0JBQ1gsWUFBWSxFQUFFLFFBQVEsQ0FBQyxVQUFVO2dCQUNqQyxjQUFjLEVBQUUsR0FBRyxFQUFFLDJCQUEyQjthQUNqRDtZQUNELFFBQVEsRUFBRSxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFO1lBQzlELE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU07U0FDL0IsQ0FBQyxDQUFDO1FBQ0gsVUFBVSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBRXZCLFVBQVUsQ0FBQyxlQUFlLENBQ3hCLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztZQUN0QixPQUFPLEVBQUUsQ0FBQyx1QkFBdUIsQ0FBQztZQUNsQyxTQUFTLEVBQUUsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDO1NBQ2xDLENBQUMsQ0FDSCxDQUFDO1FBRUYsYUFBYSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsVUFBVSxDQUFDLEVBQUU7WUFDdEUsVUFBVTtZQUNWLGlCQUFpQixFQUFFLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPO1NBQ25ELENBQUMsQ0FBQztRQUVILE1BQU0sYUFBYSxHQUFHLElBQUksa0NBQWMsQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLEVBQUU7WUFDbkUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNuQyxLQUFLLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsMkJBQTJCLENBQUM7WUFDeEQsT0FBTyxFQUFFLFNBQVM7WUFDbEIsV0FBVyxFQUFFO2dCQUNYLFlBQVksRUFBRSxRQUFRLENBQUMsVUFBVTtnQkFDakMsY0FBYyxFQUFFLEdBQUc7YUFDcEI7WUFDRCxRQUFRLEVBQUUsRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRTtZQUM5RCxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUFNO1NBQy9CLENBQUMsQ0FBQztRQUNILFVBQVUsQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUUxQixhQUFhLENBQUMsZUFBZSxDQUMzQixJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7WUFDdEIsT0FBTyxFQUFFLENBQUMsNkJBQTZCLENBQUM7WUFDeEMsU0FBUyxFQUFFLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQztTQUNsQyxDQUFDLENBQ0gsQ0FBQztRQUVGLGFBQWEsQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLGFBQWEsQ0FBQyxFQUFFO1lBQzFFLFVBQVU7WUFDVixpQkFBaUIsRUFBRSxLQUFLLENBQUMsaUJBQWlCLENBQUMsT0FBTztTQUNuRCxDQUFDLENBQUM7UUFFSCxNQUFNLGFBQWEsR0FBRyxJQUFJLGtDQUFjLENBQUMsSUFBSSxFQUFFLG9CQUFvQixFQUFFO1lBQ25FLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsS0FBSyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLDJCQUEyQixDQUFDO1lBQ3hELE9BQU8sRUFBRSxTQUFTO1lBQ2xCLFdBQVcsRUFBRTtnQkFDWCxZQUFZLEVBQUUsUUFBUSxDQUFDLFVBQVU7Z0JBQ2pDLGNBQWMsRUFBRSxHQUFHO2FBQ3BCO1lBQ0QsUUFBUSxFQUFFLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUU7WUFDOUQsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTTtTQUMvQixDQUFDLENBQUM7UUFDSCxVQUFVLENBQUMsYUFBYSxDQUFDLENBQUM7UUFFMUIsYUFBYSxDQUFDLGVBQWUsQ0FDM0IsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO1lBQ3RCLE9BQU8sRUFBRSxDQUFDLHVDQUF1QyxDQUFDO1lBQ2xELFNBQVMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUM7U0FDbEMsQ0FBQyxDQUNILENBQUM7UUFFRixnQkFBZ0IsQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLGFBQWEsQ0FBQyxFQUFFO1lBQzVFLFVBQVU7WUFDVixpQkFBaUIsRUFBRSxLQUFLLENBQUMsaUJBQWlCLENBQUMsT0FBTztTQUNuRCxDQUFDLENBQUM7UUFFSCxNQUFNLGFBQWEsR0FBRyxJQUFJLGtDQUFjLENBQUMsSUFBSSxFQUFFLG9CQUFvQixFQUFFO1lBQ25FLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsS0FBSyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLDJCQUEyQixDQUFDO1lBQ3hELE9BQU8sRUFBRSxTQUFTO1lBQ2xCLFdBQVcsRUFBRTtnQkFDWCxZQUFZLEVBQUUsUUFBUSxDQUFDLFVBQVU7Z0JBQ2pDLGNBQWMsRUFBRSxHQUFHO2FBQ3BCO1lBQ0QsUUFBUSxFQUFFLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUU7WUFDOUQsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTTtTQUMvQixDQUFDLENBQUM7UUFDSCxVQUFVLENBQUMsYUFBYSxDQUFDLENBQUM7UUFFMUIsYUFBYSxDQUFDLGVBQWUsQ0FDM0IsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO1lBQ3RCLE9BQU8sRUFBRSxDQUFDLDZCQUE2QixDQUFDO1lBQ3hDLFNBQVMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUM7U0FDbEMsQ0FBQyxDQUNILENBQUM7UUFFRixnQkFBZ0IsQ0FBQyxTQUFTLENBQ3hCLFFBQVEsRUFDUixJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxhQUFhLENBQUMsRUFDMUM7WUFDRSxVQUFVO1lBQ1YsaUJBQWlCLEVBQUUsS0FBSyxDQUFDLGlCQUFpQixDQUFDLE9BQU87U0FDbkQsQ0FDRixDQUFDO1FBRUYsbUNBQW1DO1FBQ25DLGtDQUFrQztRQUNsQyxtQ0FBbUM7UUFDbkMsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLGtDQUFjLENBQUMsSUFBSSxFQUFFLDJCQUEyQixFQUFFO1lBQ2pGLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsS0FBSyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLGtDQUFrQyxDQUFDO1lBQy9ELE9BQU8sRUFBRSxTQUFTO1lBQ2xCLFFBQVEsRUFBRSxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFO1lBQzlELFdBQVcsRUFBRTtnQkFDWCxrQkFBa0IsRUFBRSxPQUFPLENBQUMsZ0JBQWdCLENBQUMsU0FBUztnQkFDdEQsZUFBZSxFQUFFLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTO2dCQUNwRCxlQUFlLEVBQUUsa0JBQWtCO2FBQ3BDO1lBQ0QsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTTtTQUMvQixDQUFDLENBQUM7UUFDSCxVQUFVLENBQUMsb0JBQW9CLENBQUMsQ0FBQztRQUVqQyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsYUFBYSxDQUFDLG9CQUFvQixDQUFDLENBQUM7UUFDN0QsT0FBTyxDQUFDLGlCQUFpQixDQUFDLGFBQWEsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1FBRTlELE1BQU0saUJBQWlCLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDNUQsTUFBTSxpQkFBaUIsR0FBRyxpQkFBaUIsQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDckUsaUJBQWlCLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxvQkFBb0IsQ0FBQyxFQUFFO1lBQ3BGLFVBQVU7WUFDVixpQkFBaUIsRUFBRSxLQUFLLENBQUMsaUJBQWlCLENBQUMsT0FBTztTQUNuRCxDQUFDLENBQUM7UUFFSCxtQ0FBbUM7UUFDbkMsMkRBQTJEO1FBQzNELG1DQUFtQztRQUNuQyxNQUFNLG1CQUFtQixHQUFHLElBQUksa0NBQWMsQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDMUUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNuQyxPQUFPLEVBQUUsU0FBUztZQUNsQixLQUFLLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSx1QkFBdUIsQ0FBQztZQUNwRSxPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ2pDLFVBQVUsRUFBRSxHQUFHO1lBQ2YsV0FBVyxFQUFFO2dCQUNYLFdBQVcsRUFBRSxhQUFhLENBQUMsY0FBYyxDQUFDLFVBQVU7Z0JBQ3BELGdCQUFnQixFQUFFLE9BQU87Z0JBQ3pCLFNBQVMsRUFBRSxHQUFHO2dCQUNkLHNCQUFzQixFQUFFLE1BQU07Z0JBQzlCLDBCQUEwQixFQUFFLGFBQWEsQ0FBQyxZQUFZLENBQUMsY0FBYzthQUN0RTtZQUNELE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU07U0FDL0IsQ0FBQyxDQUFDO1FBQ0gsVUFBVSxDQUFDLG1CQUFtQixDQUFDLENBQUM7UUFFaEMsYUFBYSxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsbUJBQW1CLENBQUMsQ0FBQztRQUUzRCxtQkFBbUIsQ0FBQyxlQUFlLENBQ2pDLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztZQUN0QixPQUFPLEVBQUUsQ0FBQywrQkFBK0IsQ0FBQztZQUMxQyxTQUFTLEVBQUUsQ0FBQyxHQUFHLENBQUM7U0FDakIsQ0FBQyxDQUNILENBQUM7UUFFRixNQUFNLGNBQWMsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO1FBQ3BFLGNBQWMsQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQztRQUVuRixtREFBbUQ7UUFDbkQsZ0NBQWdDO1FBQ2hDLG1EQUFtRDtRQUNuRCxNQUFNLGtCQUFrQixHQUFHLENBQ3pCLEVBQVUsRUFDVixXQUFtQixFQUNuQixZQUFvQixFQUNwQixHQUE4QixFQUM5QixFQUFFO1lBQ0YsTUFBTSxFQUFFLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxFQUFFLEVBQUU7Z0JBQ3ZDLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7Z0JBQ25DLE9BQU8sRUFBRSxHQUFHLFdBQVcsVUFBVTtnQkFDakMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLFdBQVcsQ0FBQyxFQUFFO29CQUM3RCxRQUFRLEVBQUU7d0JBQ1IsS0FBSyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLGFBQWE7d0JBQy9DLE9BQU8sRUFBRTs0QkFDUCxNQUFNOzRCQUNOLElBQUk7NEJBQ0osMkVBQTJFO3lCQUM1RTtxQkFDRjtpQkFDRixDQUFDO2dCQUNGLFdBQVcsRUFBRSxHQUFHO2dCQUNoQixPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO2dCQUNqQyxZQUFZLEVBQUUsR0FBRyxVQUFVLEdBQUcsWUFBWSxFQUFFO2dCQUM1QyxZQUFZLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPO2dCQUN4QyxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUFNO2FBQy9CLENBQUMsQ0FBQztZQUVILFVBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUNmLE9BQU8sRUFBRSxDQUFDO1FBQ1osQ0FBQyxDQUFDO1FBRUYsTUFBTSxTQUFTLEdBQUc7WUFDaEIsY0FBYyxFQUFFLGFBQWEsQ0FBQyxTQUFTO1lBQ3ZDLGFBQWEsRUFBRSxTQUFTLENBQUMsU0FBUztZQUNsQyxlQUFlLEVBQUUsUUFBUTtZQUN6QixpQkFBaUIsRUFBRSxlQUFlLENBQUMsU0FBUztZQUM1QyxnQkFBZ0IsRUFBRSxlQUFlLENBQUMsV0FBVztTQUM5QyxDQUFDO1FBRUYsTUFBTSxvQkFBb0IsR0FBRyxrQkFBa0IsQ0FDN0Msc0JBQXNCLEVBQ3RCLGdCQUFnQixFQUNoQixzQkFBc0IsRUFDdEIsU0FBUyxDQUNWLENBQUM7UUFFRixNQUFNLG9CQUFvQixHQUFHLGtCQUFrQixDQUM3QyxzQkFBc0IsRUFDdEIsZ0JBQWdCLEVBQ2hCLHNCQUFzQixFQUN0QixTQUFTLENBQ1YsQ0FBQztRQUVGLE1BQU0saUJBQWlCLEdBQUcsa0JBQWtCLENBQzFDLG1CQUFtQixFQUNuQixhQUFhLEVBQ2IsbUJBQW1CLEVBQ25CLFNBQVMsQ0FDVixDQUFDO1FBRUYsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRTtZQUNuRSxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLE9BQU8sRUFBRSxzQkFBc0I7WUFDL0IsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQztZQUNyQyxXQUFXLEVBQUUsRUFBRSxjQUFjLEVBQUUsYUFBYSxDQUFDLFNBQVMsRUFBRTtZQUN4RCxPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ2pDLFlBQVksRUFBRSxHQUFHLFVBQVUsZUFBZTtZQUMxQyxZQUFZLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPO1lBQ3hDLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU07U0FDL0IsQ0FBQyxDQUFDO1FBQ0gsVUFBVSxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFFL0IsU0FBUyxDQUFDLGtCQUFrQixDQUFDLG9CQUFvQixDQUFDLENBQUM7UUFDbkQsU0FBUyxDQUFDLGFBQWEsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1FBQzlDLGFBQWEsQ0FBQyxrQkFBa0IsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1FBQ3ZELGFBQWEsQ0FBQyxhQUFhLENBQUMsaUJBQWlCLENBQUMsQ0FBQztRQUMvQyxhQUFhLENBQUMsYUFBYSxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFDaEQsZUFBZSxDQUFDLGtCQUFrQixDQUFDLG9CQUFvQixDQUFDLENBQUM7UUFDekQsZUFBZSxDQUFDLGtCQUFrQixDQUFDLG9CQUFvQixDQUFDLENBQUM7UUFFekQsZUFBZSxDQUFDLFdBQVcsQ0FBQyxvQkFBb0IsQ0FBQyxJQUFLLENBQUMsQ0FBQztRQUV4RCxNQUFNLHNCQUFzQixHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFDdEUsc0JBQXNCLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxvQkFBb0IsQ0FBQyxFQUFFLEVBQzFGLENBQUMsQ0FBQztRQUVILE1BQU0sc0JBQXNCLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUN0RSxzQkFBc0IsQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLG9CQUFvQixDQUFDLEVBQUU7UUFDMUYsY0FBYztRQUNkLHNEQUFzRDtTQUN2RCxDQUFDLENBQUM7UUFFSCxNQUFNLGFBQWEsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUVwRCxhQUFhO2FBQ1YsV0FBVyxDQUFDLGFBQWEsQ0FBQzthQUMxQixTQUFTLENBQUMsS0FBSyxFQUFFLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLGlCQUFpQixDQUFDLEVBQUU7WUFDaEUsVUFBVTtZQUNWLGlCQUFpQixFQUFFLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPO1NBQ25ELENBQUMsQ0FBQztRQUVMLGFBQWE7YUFDVixXQUFXLENBQUMsY0FBYyxDQUFDO2FBQzNCLFNBQVMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsa0JBQWtCLENBQUMsRUFBRTtZQUNsRSxVQUFVO1lBQ1YsaUJBQWlCLEVBQUUsS0FBSyxDQUFDLGlCQUFpQixDQUFDLE9BQU87U0FDbkQsQ0FBQyxDQUFDO1FBRUwsbURBQW1EO1FBQ25ELDhCQUE4QjtRQUM5QixtREFBbUQ7UUFDbkQsTUFBTSxtQkFBbUIsR0FBRyxPQUFPLENBQUMsbUJBQW1CLENBQUM7UUFDeEQsTUFBTSxvQkFBb0IsR0FBRyxPQUFPLENBQUMsb0JBQW9CLENBQUM7UUFDMUQsTUFBTSxZQUFZLEdBQUcsT0FBTyxDQUFDLG9CQUFvQixDQUFDO1FBRWxELE1BQU0sZUFBZSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBRXhELE1BQU0sVUFBVSxHQUF3QjtZQUN0QyxpQkFBaUIsRUFBRSxLQUFLLENBQUMsaUJBQWlCLENBQUMsSUFBSTtZQUMvQyxjQUFjLEVBQUUsS0FBSztTQUN0QixDQUFDO1FBRUYsTUFBTSxTQUFTLEdBQXdCO1lBQ3JDLFVBQVU7WUFDVixpQkFBaUIsRUFBRSxLQUFLLENBQUMsaUJBQWlCLENBQUMsT0FBTztTQUNuRCxDQUFDO1FBRUYsTUFBTSxZQUFZLEdBQUcsSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxxQkFBcUIsRUFBRTtZQUM5RCxTQUFTLEVBQUUsR0FBRyxVQUFVLDhCQUE4QjtTQUN2RCxDQUFDLENBQUM7UUFDSCxZQUFZLENBQUMsZUFBZSxDQUMxQixJQUFJLGFBQWEsQ0FBQyxlQUFlLENBQUMsY0FBYyxDQUFDLENBQ2xELENBQUM7UUFFRixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHVCQUF1QixFQUFFO1lBQy9DLEtBQUssRUFBRSxZQUFZLENBQUMsUUFBUTtTQUM3QixDQUFDLENBQUM7UUFFSCxNQUFNLGtCQUFrQixHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLEVBQUU7WUFDekUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNuQyxPQUFPLEVBQUUsNEJBQTRCO1lBQ3JDLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxXQUFXLENBQUMsRUFBRTtnQkFDN0QsUUFBUSxFQUFFO29CQUNSLEtBQUssRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxhQUFhO29CQUMvQyxPQUFPLEVBQUU7d0JBQ1AsTUFBTTt3QkFDTixJQUFJO3dCQUNKLDJFQUEyRTtxQkFDNUU7aUJBQ0Y7YUFDRixDQUFDO1lBQ0YsV0FBVyxFQUFFO2dCQUNYLFVBQVUsRUFBRSxRQUFRO2dCQUNwQixZQUFZLEVBQUUsYUFBYSxDQUFDLFlBQVksQ0FBQyxVQUFVLEdBQUcsa0JBQWtCO2dCQUN4RSxVQUFVLEVBQUUsMEJBQTBCO2dCQUN0QyxVQUFVLEVBQUUscUJBQXFCO2dCQUNqQyxhQUFhLEVBQUUsOEJBQThCO2dCQUM3QyxhQUFhLEVBQUUsV0FBVztnQkFDMUIsYUFBYSxFQUFFLGlDQUFpQzthQUNqRDtZQUNELE9BQU8sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDakMsWUFBWSxFQUFFLEdBQUcsVUFBVSxxQkFBcUI7WUFDaEQsWUFBWSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTztZQUN4QyxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUFNO1NBQy9CLENBQUMsQ0FBQztRQUNILFVBQVUsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1FBRy9CLE1BQU0sb0JBQW9CLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSwyQkFBMkIsRUFBRTtZQUNsRixPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLE9BQU8sRUFBRSx1Q0FBdUM7WUFDaEQsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQztZQUNyQyxPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ2pDLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU07WUFDOUIsV0FBVyxFQUFFO2dCQUNYLFdBQVcsRUFBRSxZQUFZLENBQUMsVUFBVTtnQkFDcEMsYUFBYSxFQUFFLG1CQUFtQjtnQkFDbEMsVUFBVSxFQUFFLFNBQVMsQ0FBQyxTQUFTO2dCQUMvQixXQUFXLEVBQUUsbUJBQW1CLENBQUMsU0FBUztnQkFDMUMsZ0JBQWdCLEVBQUUsZUFBZSxDQUFDLFdBQVc7Z0JBQzdDLFNBQVMsRUFBRSxZQUFZLENBQUMsUUFBUTtnQkFDaEMsb0JBQW9CLEVBQUUsa0JBQWtCLENBQUMsV0FBVztnQkFDcEQseUJBQXlCLEVBQUUsa0JBQWtCLENBQUMsWUFBWTthQUMzRDtTQUNGLENBQUMsQ0FBQztRQUNILFVBQVUsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1FBRWpDLE1BQU0sV0FBVyxHQUFHLG9CQUFvQixDQUFDLElBQUssQ0FBQztRQUMvQyxrQkFBa0IsQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLENBQUM7UUFFNUMsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLDJCQUEyQixFQUFFO1lBQ2xGLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsT0FBTyxFQUFFLG1DQUFtQztZQUM1QyxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDO1lBQ3JDLE9BQU8sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDakMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTTtZQUM5QixXQUFXLEVBQUU7Z0JBQ1gsV0FBVyxFQUFFLFlBQVksQ0FBQyxVQUFVO2dCQUNwQyxhQUFhLEVBQUUsbUJBQW1CO2dCQUNsQyxVQUFVLEVBQUUsU0FBUyxDQUFDLFNBQVM7Z0JBQy9CLGdCQUFnQixFQUFFLGVBQWUsQ0FBQyxXQUFXO2FBQzlDO1NBQ0YsQ0FBQyxDQUFDO1FBQ0gsVUFBVSxDQUFDLG9CQUFvQixDQUFDLENBQUM7UUFFakMsTUFBTSwyQkFBMkIsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLGtDQUFrQyxFQUFFO1lBQ2hHLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsT0FBTyxFQUFFLG1DQUFtQztZQUM1QyxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDO1lBQ3JDLE9BQU8sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDakMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTTtZQUM5QixXQUFXLEVBQUU7Z0JBQ1gsWUFBWSxFQUFFLGFBQWEsQ0FBQyxZQUFZLENBQUMsVUFBVTtnQkFDbkQsVUFBVSxFQUFFLDBCQUEwQixFQUFPLDRCQUE0QjtnQkFDekUsVUFBVSxFQUFFLHFCQUFxQixFQUFTLHFCQUFxQjtnQkFDL0QsV0FBVyxFQUFFLG1CQUFtQixDQUFDLFNBQVM7Z0JBQzFDLGdCQUFnQixFQUFFLGVBQWUsQ0FBQyxXQUFXO2FBQzlDO1NBQ0YsQ0FBQyxDQUFDO1FBQ0gsVUFBVSxDQUFDLDJCQUEyQixDQUFDLENBQUM7UUFFeEMsTUFBTSxxQkFBcUIsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLDRCQUE0QixFQUFFO1lBQ3BGLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsT0FBTyxFQUFFLDZCQUE2QjtZQUN0QyxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDO1lBQ3JDLE9BQU8sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDakMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTTtZQUM5QixXQUFXLEVBQUU7Z0JBQ1gsWUFBWSxFQUFFLGFBQWEsQ0FBQyxZQUFZLENBQUMsVUFBVTtnQkFDbkQsVUFBVSxFQUFFLDJCQUEyQixFQUFPLDRCQUE0QjtnQkFDMUUsVUFBVSxFQUFFLHFCQUFxQixFQUFTLHFCQUFxQjtnQkFDL0QsV0FBVyxFQUFFLG1CQUFtQixDQUFDLFNBQVM7Z0JBQzFDLGdCQUFnQixFQUFFLGVBQWUsQ0FBQyxXQUFXO2FBQzlDO1NBQ0YsQ0FBQyxDQUFDO1FBQ0gsVUFBVSxDQUFDLHFCQUFxQixDQUFDLENBQUM7UUFFbEMsTUFBTSxlQUFlLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSx3QkFBd0IsRUFBRTtZQUMxRSxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLE9BQU8sRUFBRSx1QkFBdUI7WUFDaEMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQztZQUNyQyxPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ2pDLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU07WUFDOUIsV0FBVyxFQUFFO2dCQUNYLFdBQVcsRUFBRSxtQkFBbUIsQ0FBQyxTQUFTO2dCQUMxQyxVQUFVLEVBQUUsU0FBUyxDQUFDLFNBQVM7Z0JBQy9CLHNCQUFzQixFQUFFLG9CQUFvQixDQUFDLFNBQVM7YUFDdkQ7U0FDRixDQUFDLENBQUM7UUFDSCxVQUFVLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDNUIsU0FBUyxDQUFDLGtCQUFrQixDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBRzlDLE1BQU0sYUFBYSxHQUFHLElBQUksa0NBQWMsQ0FBQyxJQUFJLEVBQUUsb0NBQW9DLEVBQUU7WUFDbkYsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNuQyxLQUFLLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsMkNBQTJDLENBQUM7WUFDeEUsT0FBTyxFQUFFLFNBQVM7WUFDbEIsUUFBUSxFQUFFLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUU7WUFDOUQsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNqQyxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUFNO1lBQzlCLFdBQVcsRUFBRTtnQkFDWCxXQUFXLEVBQUUsWUFBWSxDQUFDLFVBQVU7Z0JBQ3BDLFVBQVUsRUFBRSxTQUFTLENBQUMsU0FBUzthQUNoQztTQUNGLENBQUMsQ0FBQztRQUNILFVBQVUsQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUUxQixNQUFNLGtCQUFrQixHQUFHLElBQUksa0NBQWMsQ0FBQyxJQUFJLEVBQUUsMkJBQTJCLEVBQUU7WUFDL0UsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNuQyxLQUFLLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsd0JBQXdCLENBQUM7WUFDckQsT0FBTyxFQUFFLFNBQVM7WUFDbEIsUUFBUSxFQUFFLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUU7WUFDOUQsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNqQyxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUFNO1lBQzlCLFdBQVcsRUFBRTtnQkFDWCxzQkFBc0IsRUFBRSxvQkFBb0IsQ0FBQyxTQUFTO2dCQUN0RCxnQkFBZ0IsRUFBRSxlQUFlLENBQUMsV0FBVzthQUM5QztTQUNGLENBQUMsQ0FBQztRQUNILFVBQVUsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1FBRS9CLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxrQ0FBYyxDQUFDLElBQUksRUFBRSwyQkFBMkIsRUFBRTtZQUMvRSxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLEtBQUssRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSwrQkFBK0IsQ0FBQztZQUM1RCxPQUFPLEVBQUUsU0FBUztZQUNsQixRQUFRLEVBQUUsRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRTtZQUM5RCxPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ2pDLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU07WUFDOUIsV0FBVyxFQUFFO2dCQUNYLFVBQVUsRUFBRSxTQUFTLENBQUMsU0FBUztnQkFDL0IsV0FBVyxFQUFFLFlBQVksQ0FBQyxVQUFVO2FBQ3JDO1NBQ0YsQ0FBQyxDQUFDO1FBQ0gsVUFBVSxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFFL0IsWUFBWSxDQUFDLGNBQWMsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1FBQ2xELFlBQVksQ0FBQyxjQUFjLENBQUMsb0JBQW9CLENBQUMsQ0FBQztRQUNsRCxZQUFZLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxDQUFDO1FBQ3RDLFlBQVksQ0FBQyxTQUFTLENBQUMsa0JBQWtCLENBQUMsQ0FBQztRQUUzQyxTQUFTLENBQUMsa0JBQWtCLENBQUMsb0JBQW9CLENBQUMsQ0FBQztRQUNuRCxTQUFTLENBQUMsa0JBQWtCLENBQUMsb0JBQW9CLENBQUMsQ0FBQztRQUNuRCxTQUFTLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxDQUFDO1FBQ3ZDLFNBQVMsQ0FBQyxrQkFBa0IsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1FBRWpELG1CQUFtQixDQUFDLGtCQUFrQixDQUFDLDJCQUEyQixDQUFDLENBQUM7UUFDcEUsbUJBQW1CLENBQUMsa0JBQWtCLENBQUMscUJBQXFCLENBQUMsQ0FBQztRQUM5RCxtQkFBbUIsQ0FBQyxrQkFBa0IsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1FBQzdELG1CQUFtQixDQUFDLGtCQUFrQixDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBRXhELG9CQUFvQixDQUFDLGtCQUFrQixDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQ3pELG9CQUFvQixDQUFDLGtCQUFrQixDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFFNUQsS0FBSyxNQUFNLEVBQUUsSUFBSSxDQUFDLG9CQUFvQixFQUFFLG9CQUFvQixDQUFDLEVBQUUsQ0FBQztZQUM5RCxFQUFFLENBQUMsZUFBZSxDQUNoQixJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7Z0JBQ3RCLE9BQU8sRUFBRTtvQkFDUCx3QkFBd0I7b0JBQ3hCLGdDQUFnQztvQkFDaEMseUJBQXlCO2lCQUMxQjtnQkFDRCxTQUFTLEVBQUUsQ0FBQyxHQUFHLENBQUM7YUFDakIsQ0FBQyxDQUNILENBQUM7UUFDSixDQUFDO1FBRUQsWUFBWSxDQUFDLFlBQVksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1FBQ2hELGtCQUFrQixDQUFDLFdBQVcsQ0FBQyxvQkFBb0IsQ0FBQyxJQUFLLENBQUMsQ0FBQztRQUUzRCxlQUFlLENBQUMsV0FBVyxDQUFDLG9CQUFvQixDQUFDLElBQUssQ0FBQyxDQUFDO1FBQ3hELGVBQWUsQ0FBQyxXQUFXLENBQUMsb0JBQW9CLENBQUMsSUFBSyxDQUFDLENBQUM7UUFDeEQsZUFBZSxDQUFDLFdBQVcsQ0FBQywyQkFBMkIsQ0FBQyxJQUFLLENBQUMsQ0FBQztRQUMvRCxlQUFlLENBQUMsV0FBVyxDQUFDLHFCQUFxQixDQUFDLElBQUssQ0FBQyxDQUFDO1FBQ3pELGVBQWUsQ0FBQyxXQUFXLENBQUMsa0JBQWtCLENBQUMsSUFBSyxDQUFDLENBQUM7UUFFdEQsTUFBTSxpQkFBaUIsR0FBRyxlQUFlLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ2pFLGlCQUFpQixDQUFDLFNBQVMsQ0FDekIsTUFBTSxFQUNOLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLG9CQUFvQixDQUFDLEVBQ2pELFVBQVUsQ0FDWCxDQUFDO1FBRUYsTUFBTSxrQkFBa0IsR0FBRyxlQUFlLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ25FLGtCQUFrQixDQUFDLFNBQVMsQ0FDMUIsTUFBTSxFQUNOLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLG9CQUFvQixDQUFDLEVBQ2pELFVBQVUsQ0FDWCxDQUFDO1FBRUYsTUFBTSxxQkFBcUIsR0FBRyxlQUFlLENBQUMsV0FBVyxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQzNFLHFCQUFxQixDQUFDLFNBQVMsQ0FDN0IsS0FBSyxFQUNMLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLGFBQWEsQ0FBQyxFQUMxQyxVQUFVLENBQ1gsQ0FBQztRQUVGLE1BQU0sbUJBQW1CLEdBQUcsZUFBZSxDQUFDLFdBQVcsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUNyRSxtQkFBbUIsQ0FBQyxTQUFTLENBQzNCLE1BQU0sRUFDTixJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxrQkFBa0IsQ0FBQyxFQUMvQyxVQUFVLENBQ1gsQ0FBQztRQUVGLE1BQU0sZUFBZSxHQUFHLGVBQWUsQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDN0QsZUFBZSxDQUFDLFNBQVMsQ0FDdkIsTUFBTSxFQUNOLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLGtCQUFrQixDQUFDLEVBQy9DLFVBQVUsQ0FDWCxDQUFDO1FBRUYsTUFBTSwwQkFBMEIsR0FBRyxhQUFhLENBQUMsV0FBVyxDQUFDLDJCQUEyQixDQUFDLENBQUM7UUFDMUYsMEJBQTBCLENBQUMsU0FBUyxDQUNsQyxNQUFNLEVBQ04sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsMkJBQTJCLENBQUMsRUFDeEQsU0FBUyxDQUNWLENBQUM7UUFFRixNQUFNLG9CQUFvQixHQUFHLGFBQWEsQ0FBQyxXQUFXLENBQUMscUJBQXFCLENBQUMsQ0FBQztRQUM5RSxvQkFBb0IsQ0FBQyxTQUFTLENBQzVCLE1BQU0sRUFDTixJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxxQkFBcUIsQ0FBQyxFQUNsRCxTQUFTLENBQ1YsQ0FBQztRQUVGLE1BQU0scUJBQXFCLEdBQUcsYUFBYSxDQUFDLFdBQVcsQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUN6RSxxQkFBcUIsQ0FBQyxTQUFTLENBQzdCLE1BQU0sRUFDTixJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxlQUFlLENBQUMsRUFDNUMsU0FBUyxDQUNWLENBQUM7UUFFRixzQkFBc0I7UUFDdEIsTUFBTSxXQUFXLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxhQUFhLEVBQUM7WUFDMUQsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNuQyxPQUFPLEVBQUMscUJBQXFCO1lBQzdCLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUM7WUFDckMsV0FBVyxFQUFDO2dCQUNWLFVBQVUsRUFBRSxTQUFTLENBQUMsU0FBUztnQkFDL0IsV0FBVyxFQUFFLFlBQVksQ0FBQyxVQUFVO2FBQ3JDO1lBQ0QsT0FBTyxFQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNoQywrQkFBK0I7WUFDL0IsWUFBWSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxFQUFFLG1DQUFtQztTQUM5RSxDQUFDLENBQUM7UUFDSCxZQUFZLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ3BDLFlBQVksQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDcEMsU0FBUyxDQUFDLGtCQUFrQixDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQzlDLE1BQU0sV0FBVyxHQUFHLGVBQWUsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDbEQsV0FBVyxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUMsSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsV0FBVyxFQUFFO1lBQ25FLEtBQUssRUFBRSxJQUFJO1NBQ1osQ0FBQyxDQUFDLENBQUM7SUFDTixDQUFDO0NBQ0Y7QUFqbENELDRCQWlsQ0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSBcImF3cy1jZGstbGliXCI7XHJcbmltcG9ydCB7IERCU3RhY2sgfSBmcm9tIFwiLi9EQnN0YWNrXCI7XHJcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gXCJjb25zdHJ1Y3RzXCI7XHJcbmltcG9ydCAqIGFzIGNvZ25pdG8gZnJvbSBcImF3cy1jZGstbGliL2F3cy1jb2duaXRvXCI7XHJcbmltcG9ydCAqIGFzIGFwaWd3IGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheVwiO1xyXG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSBcImF3cy1jZGstbGliL2F3cy1sYW1iZGFcIjtcclxuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSBcImF3cy1jZGstbGliL2F3cy1keW5hbW9kYlwiO1xyXG5pbXBvcnQgKiBhcyBpYW0gZnJvbSBcImF3cy1jZGstbGliL2F3cy1pYW1cIjtcclxuaW1wb3J0IHsgTm9kZWpzRnVuY3Rpb24gfSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWxhbWJkYS1ub2RlanNcIjtcclxuaW1wb3J0ICogYXMgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5pbXBvcnQgeyBCZWRyb2NrU3RhY2sgfSBmcm9tIFwiLi9iZWRyb2NrX3N0YWNrXCI7XHJcbmltcG9ydCB7IFVuaXR5V2ViU29ja2V0U3RhY2sgfSBmcm9tIFwiLi91bml0eS13ZWJzb2NrZXQtc3RhY2tcIjtcclxuaW1wb3J0IHsgRnJvbnRlbmREZXBsb3ltZW50U3RhY2sgfSBmcm9tIFwiLi9mcm9udGVuZC1kZXBsb3ltZW50LXN0YWNrXCI7XHJcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSBcImF3cy1jZGstbGliL2F3cy1sb2dzXCI7XHJcbmltcG9ydCAqIGFzIHNucyBmcm9tIFwiYXdzLWNkay1saWIvYXdzLXNuc1wiO1xyXG5pbXBvcnQgKiBhcyBzdWJzY3JpcHRpb25zIGZyb20gXCJhd3MtY2RrLWxpYi9hd3Mtc25zLXN1YnNjcmlwdGlvbnNcIjtcclxuXHJcbmludGVyZmFjZSBBUElTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xyXG4gIGRiU3RhY2s6IERCU3RhY2s7XHJcbiAgYmVkcm9ja1N0YWNrOiBCZWRyb2NrU3RhY2s7XHJcbiAgd3NTdGFjazogVW5pdHlXZWJTb2NrZXRTdGFjaztcclxuICBmcm9udGVuZFN0YWNrOiBGcm9udGVuZERlcGxveW1lbnRTdGFjaztcclxuICBicm9hZGNhc3RMYW1iZGE6IGxhbWJkYS5JRnVuY3Rpb247XHJcbn1cclxuXHJcbmV4cG9ydCBjbGFzcyBBUElTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XHJcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEFQSVN0YWNrUHJvcHMpIHtcclxuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xyXG5cclxuICAgIGNvbnN0IHByZWZpeG5hbWUgPSB0aGlzLnN0YWNrTmFtZS5zcGxpdChcIi1cIilbMF0udG9Mb3dlckNhc2UoKTtcclxuXHJcbiAgICBjb25zdCB3c1N0YWNrID0gcHJvcHMud3NTdGFjaztcclxuICAgIGNvbnN0IGRiU3RhY2sgPSBwcm9wcy5kYlN0YWNrO1xyXG4gICAgY29uc3QgYmVkcm9ja1N0YWNrID0gcHJvcHMuYmVkcm9ja1N0YWNrO1xyXG4gICAgY29uc3QgZnJvbnRlbmRTdGFjayA9IHByb3BzLmZyb250ZW5kU3RhY2s7XHJcbiAgICBjb25zdCBicm9hZGNhc3RMYW1iZGEgPSBwcm9wcy5icm9hZGNhc3RMYW1iZGE7XHJcblxyXG4gICAgY29uc3QgcHJlUmVnQnVja2V0ID0gZGJTdGFjay5wcmVSZWdCdWNrZXQ7XHJcbiAgICBjb25zdCB1c2VyVGFibGUgPSBkYlN0YWNrLnVzZXJNYW5hZ2VtZW50VGFibGU7XHJcblxyXG4gICAgY29uc3QgZmVlZGJhY2tUYWJsZSA9IGRiU3RhY2sudmlzaXRvckZlZWRiYWNrVGFibGU7XHJcbiAgICBjb25zdCB1c2VkVG9rZW5zVGFibGUgPSBkYlN0YWNrLnVzZWRUb2tlbnNUYWJsZTtcclxuICAgIGNvbnN0IFJFS09HX0NPTExFQ1RJT05fSUQgPSBkYlN0YWNrLnZpc2l0b3JGYWNlQ29sbGVjdGlvbi5jb2xsZWN0aW9uSWQhO1xyXG5cclxuICAgIC8vIEVuc3VyZSBEQlN0YWNrIGlzIGNyZWF0ZWQgYmVmb3JlIEFQSVN0YWNrXHJcbiAgICB0aGlzLmFkZERlcGVuZGVuY3koZGJTdGFjayk7XHJcblxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICAvLyDinIUgWC1SQVkgSEVMUEVSIChvbmUgcGxhY2UsIGFwcGx5IHRvIGFsbCBsYW1iZGFzKVxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICBjb25zdCBlbmFibGVYUmF5ID0gKGZuOiBsYW1iZGEuRnVuY3Rpb24pID0+IHtcclxuICAgICAgZm4ucm9sZT8uYWRkTWFuYWdlZFBvbGljeShcclxuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoXCJBV1NYUmF5RGFlbW9uV3JpdGVBY2Nlc3NcIilcclxuICAgICAgKTtcclxuICAgIH07XHJcblxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICAvLyDinIUgT05FIEdMT0JBTCBDT1JTICh0ZW1wb3JhcnkgXCIqXCIsIGxhdGVyIHJlcGxhY2Ugd2l0aCBkZXBsb3llZCBmcm9udGVuZCBVUkwpXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIGNvbnN0IEdMT0JBTF9DT1JTOiBhcGlndy5Db3JzT3B0aW9ucyA9IHtcclxuICAgICAgYWxsb3dPcmlnaW5zOiBhcGlndy5Db3JzLkFMTF9PUklHSU5TLCAvLyBcIipcIlxyXG4gICAgICBhbGxvd01ldGhvZHM6IGFwaWd3LkNvcnMuQUxMX01FVEhPRFMsXHJcbiAgICAgIGFsbG93SGVhZGVyczogW1xyXG4gICAgICAgIFwiQ29udGVudC1UeXBlXCIsXHJcbiAgICAgICAgXCJBdXRob3JpemF0aW9uXCIsXHJcbiAgICAgICAgXCJYLUFtei1EYXRlXCIsXHJcbiAgICAgICAgXCJYLUFwaS1LZXlcIixcclxuICAgICAgICBcIlgtQW16LVNlY3VyaXR5LVRva2VuXCIsXHJcbiAgICAgICAgXCJYLUFtei1Vc2VyLUFnZW50XCIsXHJcbiAgICAgIF0sXHJcbiAgICB9O1xyXG5cclxuICAgIC8vIER5bmFtb0RCIE91dHB1dHMgKGFscmVhZHkgcHJlc2VudClcclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiQmFodHdpblRhYmxlTmFtZVwiLCB7XHJcbiAgICAgIHZhbHVlOiBkYlN0YWNrLnRhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgZGVzY3JpcHRpb246IFwiTmFtZSBvZiB0aGUgRHluYW1vREIgdGFibGUgdXNlZCBieSBCQUhUV0lOXCIsXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIkJhaHR3aW5UYWJsZUFyblwiLCB7XHJcbiAgICAgIHZhbHVlOiBkYlN0YWNrLnRhYmxlLnRhYmxlQXJuLFxyXG4gICAgICBkZXNjcmlwdGlvbjogXCJBUk4gb2YgdGhlIER5bmFtb0RCIHRhYmxlIHVzZWQgYnkgQkFIVFdJTlwiLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICAvLyAxLiBDb2duaXRvIFVzZXIgUG9vbFxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICBjb25zdCB1c2VyUG9vbCA9IG5ldyBjb2duaXRvLlVzZXJQb29sKHRoaXMsIFwiVW5pdHlVc2VyUG9vbFwiLCB7XHJcbiAgICAgIHVzZXJQb29sTmFtZTogYCR7cHJlZml4bmFtZX0tdW5pdHktdXNlcnNgLFxyXG4gICAgICBzZWxmU2lnblVwRW5hYmxlZDogdHJ1ZSxcclxuICAgICAgc2lnbkluQWxpYXNlczogeyBlbWFpbDogdHJ1ZSB9LFxyXG4gICAgICBzdGFuZGFyZEF0dHJpYnV0ZXM6IHtcclxuICAgICAgICBlbWFpbDogeyByZXF1aXJlZDogdHJ1ZSwgbXV0YWJsZTogZmFsc2UgfSxcclxuICAgICAgfSxcclxuICAgICAgcGFzc3dvcmRQb2xpY3k6IHtcclxuICAgICAgICBtaW5MZW5ndGg6IDgsXHJcbiAgICAgICAgcmVxdWlyZURpZ2l0czogdHJ1ZSxcclxuICAgICAgICByZXF1aXJlTG93ZXJjYXNlOiB0cnVlLFxyXG4gICAgICAgIHJlcXVpcmVVcHBlcmNhc2U6IHRydWUsXHJcbiAgICAgICAgcmVxdWlyZVN5bWJvbHM6IGZhbHNlLFxyXG4gICAgICB9LFxyXG4gICAgICBhY2NvdW50UmVjb3Zlcnk6IGNvZ25pdG8uQWNjb3VudFJlY292ZXJ5LkVNQUlMX09OTFksXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBwb3N0Q29uZmlybUZuID0gbmV3IE5vZGVqc0Z1bmN0aW9uKHRoaXMsIFwiUG9zdENvbmZpcm1WaXNpdG9ySGFuZGxlclwiLCB7XHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxyXG4gICAgICBlbnRyeTogcGF0aC5qb2luKF9fZGlybmFtZSwgXCIuLi9sYW1iZGEvcG9zdC1jb25maXJtLXZpc2l0b3IudHNcIiksXHJcbiAgICAgIGhhbmRsZXI6IFwiaGFuZGxlclwiLFxyXG4gICAgICBidW5kbGluZzoge1xyXG4gICAgICAgIHRhcmdldDogXCJub2RlMThcIixcclxuICAgICAgICBtaW5pZnk6IHRydWUsXHJcbiAgICAgICAgc291cmNlTWFwOiBmYWxzZSxcclxuICAgICAgfSxcclxuICAgICAgdHJhY2luZzogbGFtYmRhLlRyYWNpbmcuQUNUSVZFLFxyXG4gICAgfSk7XHJcbiAgICBlbmFibGVYUmF5KHBvc3RDb25maXJtRm4pO1xyXG5cclxuICAgIHBvc3RDb25maXJtRm4uYWRkVG9Sb2xlUG9saWN5KFxyXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgICAgYWN0aW9uczogW1wiY29nbml0by1pZHA6QWRtaW5BZGRVc2VyVG9Hcm91cFwiXSxcclxuICAgICAgICByZXNvdXJjZXM6IFtcIipcIl0sXHJcbiAgICAgIH0pXHJcbiAgICApO1xyXG5cclxuICAgIHVzZXJQb29sLmFkZFRyaWdnZXIoXHJcbiAgICAgIGNvZ25pdG8uVXNlclBvb2xPcGVyYXRpb24uUE9TVF9DT05GSVJNQVRJT04sXHJcbiAgICAgIHBvc3RDb25maXJtRm5cclxuICAgICk7XHJcblxyXG4gICAgY29uc3QgdXNlclBvb2xDbGllbnQgPSBuZXcgY29nbml0by5Vc2VyUG9vbENsaWVudChcclxuICAgICAgdGhpcyxcclxuICAgICAgXCJVbml0eVVzZXJQb29sQ2xpZW50VjJcIixcclxuICAgICAge1xyXG4gICAgICAgIHVzZXJQb29sLFxyXG4gICAgICAgIGdlbmVyYXRlU2VjcmV0OiBmYWxzZSxcclxuICAgICAgICBhdXRoRmxvd3M6IHsgdXNlclNycDogdHJ1ZSwgdXNlclBhc3N3b3JkOiB0cnVlIH0sXHJcbiAgICAgICAgb0F1dGg6IHtcclxuICAgICAgICAgIGZsb3dzOiB7XHJcbiAgICAgICAgICAgIGF1dGhvcml6YXRpb25Db2RlR3JhbnQ6IHRydWUsXHJcbiAgICAgICAgICAgIGltcGxpY2l0Q29kZUdyYW50OiB0cnVlLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIGNhbGxiYWNrVXJsczogW1wibG9jYWxob3N0OjUxNzNcIiArIFwiL2NhbGxiYWNrXCJdLFxyXG4gICAgICAgICAgbG9nb3V0VXJsczogW1wibG9jYWxob3N0OjUxNzNcIiArIFwiL1wiXSxcclxuICAgICAgICAgIHNjb3BlczogW2NvZ25pdG8uT0F1dGhTY29wZS5PUEVOSUQsIGNvZ25pdG8uT0F1dGhTY29wZS5FTUFJTF0sXHJcbiAgICAgICAgfSxcclxuICAgICAgICBzdXBwb3J0ZWRJZGVudGl0eVByb3ZpZGVyczogW1xyXG4gICAgICAgICAgY29nbml0by5Vc2VyUG9vbENsaWVudElkZW50aXR5UHJvdmlkZXIuQ09HTklUTyxcclxuICAgICAgICBdLFxyXG4gICAgICB9XHJcbiAgICApO1xyXG5cclxuICAgIGNvbnN0IGNmbkNsaWVudCA9IHVzZXJQb29sQ2xpZW50Lm5vZGVcclxuICAgICAgLmRlZmF1bHRDaGlsZCBhcyBjb2duaXRvLkNmblVzZXJQb29sQ2xpZW50O1xyXG4gICAgY2ZuQ2xpZW50LmFsbG93ZWRPQXV0aEZsb3dzVXNlclBvb2xDbGllbnQgPSB0cnVlO1xyXG4gICAgY2ZuQ2xpZW50LmFsbG93ZWRPQXV0aEZsb3dzID0gW1wiY29kZVwiLCBcImltcGxpY2l0XCJdO1xyXG4gICAgY2ZuQ2xpZW50LmFsbG93ZWRPQXV0aFNjb3BlcyA9IFtcIm9wZW5pZFwiLCBcImVtYWlsXCJdO1xyXG4gICAgY2ZuQ2xpZW50LnN1cHBvcnRlZElkZW50aXR5UHJvdmlkZXJzID0gW1wiQ09HTklUT1wiXTtcclxuXHJcbiAgICBuZXcgY29nbml0by5DZm5Vc2VyUG9vbEdyb3VwKHRoaXMsIFwiQWRtaW5Hcm91cFwiLCB7XHJcbiAgICAgIHVzZXJQb29sSWQ6IHVzZXJQb29sLnVzZXJQb29sSWQsXHJcbiAgICAgIGdyb3VwTmFtZTogXCJhZG1pblwiLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNvZ25pdG8uQ2ZuVXNlclBvb2xHcm91cCh0aGlzLCBcIk5ld0hpcmVHcm91cFwiLCB7XHJcbiAgICAgIHVzZXJQb29sSWQ6IHVzZXJQb29sLnVzZXJQb29sSWQsXHJcbiAgICAgIGdyb3VwTmFtZTogXCJuZXdoaXJlXCIsXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY29nbml0by5DZm5Vc2VyUG9vbEdyb3VwKHRoaXMsIFwiVmlzaXRvckdyb3VwXCIsIHtcclxuICAgICAgdXNlclBvb2xJZDogdXNlclBvb2wudXNlclBvb2xJZCxcclxuICAgICAgZ3JvdXBOYW1lOiBcInZpc2l0b3JcIixcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHVzZXJQb29sRG9tYWluID0gbmV3IGNvZ25pdG8uVXNlclBvb2xEb21haW4oXHJcbiAgICAgIHRoaXMsXHJcbiAgICAgIFwiVW5pdHlVc2VyUG9vbERvbWFpblwiLFxyXG4gICAgICB7XHJcbiAgICAgICAgdXNlclBvb2wsXHJcbiAgICAgICAgY29nbml0b0RvbWFpbjogeyBkb21haW5QcmVmaXg6IGAke3ByZWZpeG5hbWV9LXVuaXR5LSR7dGhpcy5hY2NvdW50fS1kZXZgIH0sXHJcbiAgICAgIH1cclxuICAgICk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJVc2VyUG9vbElkXCIsIHsgdmFsdWU6IHVzZXJQb29sLnVzZXJQb29sSWQgfSk7XHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIlVzZXJQb29sQ2xpZW50SWRcIiwge1xyXG4gICAgICB2YWx1ZTogdXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcclxuICAgIH0pO1xyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJVc2VyUG9vbERvbWFpblVybFwiLCB7XHJcbiAgICAgIHZhbHVlOiB1c2VyUG9vbERvbWFpbi5iYXNlVXJsKCksXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIC8vIDIuIExhbWJkYSBGdW5jdGlvbiAoaGVsbG8pXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIGNvbnN0IGhlbGxvRm4gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsIFwiSGVsbG9IYW5kbGVyXCIsIHtcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXHJcbiAgICAgIGhhbmRsZXI6IFwiaGVsbG8uaGFuZGxlclwiLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoXCJsYW1iZGFcIiksXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgVEFCTEVfTkFNRTogZGJTdGFjay50YWJsZS50YWJsZU5hbWUsXHJcbiAgICAgICAgVVNFUl9QT09MX0lEOiB1c2VyUG9vbC51c2VyUG9vbElkLFxyXG4gICAgICB9LFxyXG4gICAgICB0cmFjaW5nOiBsYW1iZGEuVHJhY2luZy5BQ1RJVkUsXHJcbiAgICB9KTtcclxuICAgIGVuYWJsZVhSYXkoaGVsbG9Gbik7XHJcblxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICAvLyAzLiBBUEkgR2F0ZXdheSArIENvZ25pdG8gQXV0aG9yaXplclxyXG4gICAgLy8g4pyFIEdMT0JBTCBDT1JTIEFQUExJRUQgT05DRSBIRVJFXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIGNvbnN0IGFwaSA9IG5ldyBhcGlndy5SZXN0QXBpKHRoaXMsIFwiVW5pdHlSZXN0QXBpXCIsIHtcclxuICAgICAgcmVzdEFwaU5hbWU6IGAke3ByZWZpeG5hbWV9LVVuaXR5IFNlcnZpY2VgLFxyXG4gICAgICBkZXBsb3lPcHRpb25zOiB7XHJcbiAgICAgICAgc3RhZ2VOYW1lOiBcImRldlwiLFxyXG4gICAgICAgIHRyYWNpbmdFbmFibGVkOiB0cnVlLFxyXG4gICAgICB9LFxyXG4gICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IEdMT0JBTF9DT1JTLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgYXV0aG9yaXplciA9IG5ldyBhcGlndy5Db2duaXRvVXNlclBvb2xzQXV0aG9yaXplcihcclxuICAgICAgdGhpcyxcclxuICAgICAgXCJVbml0eUNvZ25pdG9BdXRob3JpemVyXCIsXHJcbiAgICAgIHtcclxuICAgICAgICBjb2duaXRvVXNlclBvb2xzOiBbdXNlclBvb2xdLFxyXG4gICAgICB9XHJcbiAgICApO1xyXG5cclxuICAgIGNvbnN0IGhlbGxvUmVzb3VyY2UgPSBhcGkucm9vdC5hZGRSZXNvdXJjZShcImhlbGxvXCIpO1xyXG4gICAgaGVsbG9SZXNvdXJjZS5hZGRNZXRob2QoXCJHRVRcIiwgbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKGhlbGxvRm4pLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlndy5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJVbml0eUFwaVVybFwiLCB7IHZhbHVlOiBhcGkudXJsIH0pO1xyXG5cclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgLy8gd2hvYW1pXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIGNvbnN0IHdob2FtaUZuID0gbmV3IE5vZGVqc0Z1bmN0aW9uKHRoaXMsIFwiV2hvQW1JSGFuZGxlclwiLCB7XHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxyXG4gICAgICBlbnRyeTogcGF0aC5qb2luKF9fZGlybmFtZSwgXCIuLi9sYW1iZGEvd2hvYW1pLnRzXCIpLFxyXG4gICAgICBoYW5kbGVyOiBcImhhbmRsZXJcIixcclxuICAgICAgYnVuZGxpbmc6IHtcclxuICAgICAgICB0YXJnZXQ6IFwibm9kZTE4XCIsXHJcbiAgICAgICAgbWluaWZ5OiB0cnVlLFxyXG4gICAgICAgIHNvdXJjZU1hcDogZmFsc2UsXHJcbiAgICAgIH0sXHJcbiAgICAgIHRyYWNpbmc6IGxhbWJkYS5UcmFjaW5nLkFDVElWRSxcclxuICAgIH0pO1xyXG4gICAgZW5hYmxlWFJheSh3aG9hbWlGbik7XHJcblxyXG4gICAgY29uc3Qgd2hvYW1pUmVzb3VyY2UgPSBhcGkucm9vdC5hZGRSZXNvdXJjZShcIndob2FtaVwiKTtcclxuICAgIHdob2FtaVJlc291cmNlLmFkZE1ldGhvZChcIkdFVFwiLCBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24od2hvYW1pRm4pLCB7XHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlndy5BdXRob3JpemF0aW9uVHlwZS5OT05FLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICAvLyBzZXQtcm9sZVxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICBjb25zdCBzZXRSb2xlRm4gPSBuZXcgTm9kZWpzRnVuY3Rpb24odGhpcywgXCJTZXRSb2xlSGFuZGxlclwiLCB7XHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxyXG4gICAgICBlbnRyeTogcGF0aC5qb2luKF9fZGlybmFtZSwgXCIuLi9sYW1iZGEvc2V0LXJvbGUudHNcIiksXHJcbiAgICAgIGhhbmRsZXI6IFwiaGFuZGxlclwiLFxyXG4gICAgICBidW5kbGluZzoge1xyXG4gICAgICAgIHRhcmdldDogXCJub2RlMThcIixcclxuICAgICAgICBtaW5pZnk6IHRydWUsXHJcbiAgICAgICAgc291cmNlTWFwOiBmYWxzZSxcclxuICAgICAgfSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICBVU0VSX1BPT0xfSUQ6IHVzZXJQb29sLnVzZXJQb29sSWQsXHJcbiAgICAgIH0sXHJcbiAgICAgIHRyYWNpbmc6IGxhbWJkYS5UcmFjaW5nLkFDVElWRSxcclxuICAgIH0pO1xyXG4gICAgZW5hYmxlWFJheShzZXRSb2xlRm4pO1xyXG5cclxuICAgIHNldFJvbGVGbi5hZGRUb1JvbGVQb2xpY3koXHJcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgICBhY3Rpb25zOiBbXHJcbiAgICAgICAgICBcImNvZ25pdG8taWRwOkFkbWluQWRkVXNlclRvR3JvdXBcIixcclxuICAgICAgICAgIFwiY29nbml0by1pZHA6QWRtaW5SZW1vdmVVc2VyRnJvbUdyb3VwXCIsXHJcbiAgICAgICAgICBcImNvZ25pdG8taWRwOkFkbWluTGlzdEdyb3Vwc0ZvclVzZXJcIixcclxuICAgICAgICBdLFxyXG4gICAgICAgIHJlc291cmNlczogW1wiKlwiXSxcclxuICAgICAgfSlcclxuICAgICk7XHJcblxyXG4gICAgY29uc3Qgcm9sZVJlc291cmNlID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoXCJyb2xlXCIpO1xyXG4gICAgcm9sZVJlc291cmNlLmFkZE1ldGhvZChcIlBPU1RcIiwgbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKHNldFJvbGVGbiksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWd3LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIC8vIFBsdWdBY3Rpb25zXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIGNvbnN0IHBsdWdBY3Rpb25zVGFibGU6IGR5bmFtb2RiLlRhYmxlID0gZGJTdGFjay5wbHVnQWN0aW9uc1RhYmxlO1xyXG5cclxuICAgIGNvbnN0IHBsdWdDb250cm9sRm4gPSBuZXcgTm9kZWpzRnVuY3Rpb24odGhpcywgXCJQbHVnQ29udHJvbEhhbmRsZXJcIiwge1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICAgICAgZW50cnk6IHBhdGguam9pbihfX2Rpcm5hbWUsIFwiLi4vbGFtYmRhL3BsdWctY29udHJvbC50c1wiKSxcclxuICAgICAgaGFuZGxlcjogXCJoYW5kbGVyXCIsXHJcbiAgICAgIGJ1bmRsaW5nOiB7XHJcbiAgICAgICAgdGFyZ2V0OiBcIm5vZGUxOFwiLFxyXG4gICAgICAgIG1pbmlmeTogdHJ1ZSxcclxuICAgICAgICBzb3VyY2VNYXA6IGZhbHNlLFxyXG4gICAgICB9LFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIFBMVUdfQUNUSU9OU19UQUJMRTogcGx1Z0FjdGlvbnNUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgICAgVk9JQ0VfTU9OS0VZX0JBU0VfVVJMOiBcImh0dHBzOi8vYXBpLXYyLnZvaWNlbW9ua2V5LmlvL3RyaWdnZXJcIixcclxuICAgICAgICBWT0lDRV9NT05LRVlfVE9LRU46XHJcbiAgICAgICAgICBcIjg4MWIxN2IzYjc5ODgwMjE4N2Q0MTMzZDJjZjQwODc1XzYyNDJkNDFlNjA0ZWVjOWU1ZDU5YjcxM2MzZTc1MWU3XCIsXHJcbiAgICAgICAgUExVR19ERVZJQ0VfTUFQOiBKU09OLnN0cmluZ2lmeSh7XHJcbiAgICAgICAgICBwbHVnMTogeyBvbjogXCJ0dXJub25wbHVnb25lXCIsIG9mZjogXCJ0dXJub2ZmcGx1Z29uZVwiIH0sXHJcbiAgICAgICAgICBwbHVnMjogeyBvbjogXCJ0dXJub25wbHVndHdvXCIsIG9mZjogXCJ0dXJub2ZmcGx1Z3R3b1wiIH0sXHJcbiAgICAgICAgfSksXHJcbiAgICAgICAgQ09PTERPV05fU0VDT05EUzogXCIzMFwiLFxyXG5cclxuICAgICAgICBXU19DT05ORUNUSU9OU19UQUJMRTogd3NTdGFjay5jb25uZWN0aW9uc1RhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgICBXU19NQU5BR0VNRU5UX0VORFBPSU5UOiB3c1N0YWNrLm1hbmFnZW1lbnRFbmRwb2ludCxcclxuICAgICAgfSxcclxuICAgICAgdHJhY2luZzogbGFtYmRhLlRyYWNpbmcuQUNUSVZFLFxyXG4gICAgfSk7XHJcbiAgICBlbmFibGVYUmF5KHBsdWdDb250cm9sRm4pO1xyXG5cclxuICAgIHBsdWdBY3Rpb25zVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHBsdWdDb250cm9sRm4pO1xyXG4gICAgd3NTdGFjay5jb25uZWN0aW9uc1RhYmxlLmdyYW50UmVhZERhdGEocGx1Z0NvbnRyb2xGbik7XHJcblxyXG4gICAgcGx1Z0NvbnRyb2xGbi5hZGRUb1JvbGVQb2xpY3koXHJcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgICBhY3Rpb25zOiBbXCJleGVjdXRlLWFwaTpNYW5hZ2VDb25uZWN0aW9uc1wiXSxcclxuICAgICAgICByZXNvdXJjZXM6IFtcclxuICAgICAgICAgIGBhcm46YXdzOmV4ZWN1dGUtYXBpOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fToke3dzU3RhY2sud2ViU29ja2V0QXBpLmFwaUlkfS8ke3dzU3RhY2suc3RhZ2Uuc3RhZ2VOYW1lfS8qL0Bjb25uZWN0aW9ucy8qYCxcclxuICAgICAgICBdLFxyXG4gICAgICB9KVxyXG4gICAgKTtcclxuXHJcbiAgICBjb25zdCBwbHVnc1Jlc291cmNlID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoXCJwbHVnc1wiKTtcclxuICAgIHBsdWdzUmVzb3VyY2UuYWRkTWV0aG9kKFwiUE9TVFwiLCBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24ocGx1Z0NvbnRyb2xGbiksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWd3LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIC8vIFRlbGVtZXRyeSBxdWVyeVxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICBjb25zdCBpb3RUZWxlbWV0cnlUYWJsZTogZHluYW1vZGIuVGFibGUgPSBkYlN0YWNrLmlvdFRlbGVtZXRyeVRhYmxlO1xyXG5cclxuICAgIGNvbnN0IHRlbGVtZXRyeVF1ZXJ5Rm4gPSBuZXcgTm9kZWpzRnVuY3Rpb24odGhpcywgXCJUZWxlbWV0cnlRdWVyeUhhbmRsZXJcIiwge1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICAgICAgZW50cnk6IHBhdGguam9pbihfX2Rpcm5hbWUsIFwiLi4vbGFtYmRhL3RlbGVtZXRyeS1xdWVyeS50c1wiKSxcclxuICAgICAgaGFuZGxlcjogXCJoYW5kbGVyXCIsXHJcbiAgICAgIGJ1bmRsaW5nOiB7XHJcbiAgICAgICAgdGFyZ2V0OiBcIm5vZGUxOFwiLFxyXG4gICAgICAgIG1pbmlmeTogdHJ1ZSxcclxuICAgICAgICBzb3VyY2VNYXA6IGZhbHNlLFxyXG4gICAgICB9LFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIFRFTEVNRVRSWV9UQUJMRTogaW90VGVsZW1ldHJ5VGFibGUudGFibGVOYW1lLFxyXG4gICAgICB9LFxyXG4gICAgICB0cmFjaW5nOiBsYW1iZGEuVHJhY2luZy5BQ1RJVkUsXHJcbiAgICB9KTtcclxuICAgIGVuYWJsZVhSYXkodGVsZW1ldHJ5UXVlcnlGbik7XHJcblxyXG4gICAgaW90VGVsZW1ldHJ5VGFibGUuZ3JhbnRSZWFkRGF0YSh0ZWxlbWV0cnlRdWVyeUZuKTtcclxuXHJcbiAgICBjb25zdCB0ZWxlbWV0cnlSZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKFwidGVsZW1ldHJ5XCIpO1xyXG4gICAgdGVsZW1ldHJ5UmVzb3VyY2UuYWRkTWV0aG9kKFwiR0VUXCIsIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbih0ZWxlbWV0cnlRdWVyeUZuKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ3cuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgLy8gQWxleGEgVGVsZW1ldHJ5IENvbnRyb2xsZXJcclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgY29uc3QgYWxleGFUZWxlbWV0cnlGbiA9IG5ldyBOb2RlanNGdW5jdGlvbih0aGlzLCBcIkFsZXhhVGVsZW1ldHJ5SGFuZGxlclwiLCB7XHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxyXG4gICAgICBlbnRyeTogcGF0aC5qb2luKF9fZGlybmFtZSwgXCIuLi9sYW1iZGEvYWxleGEtdGVsZW1ldHJ5LnRzXCIpLFxyXG4gICAgICBoYW5kbGVyOiBcImhhbmRsZXJcIixcclxuICAgICAgYnVuZGxpbmc6IHsgdGFyZ2V0OiBcIm5vZGUxOFwiLCBtaW5pZnk6IHRydWUsIHNvdXJjZU1hcDogZmFsc2UgfSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICBURUxFTUVUUllfVEFCTEU6IGlvdFRlbGVtZXRyeVRhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgICBCQVNJQ19VU0VSOiBcImFsZXhhXCIsXHJcbiAgICAgICAgQkFTSUNfUEFTUzogXCJhTDlReDdQMm1SNFpLOHdFXCIsXHJcbiAgICAgIH0sXHJcbiAgICAgIHRyYWNpbmc6IGxhbWJkYS5UcmFjaW5nLkFDVElWRSxcclxuICAgIH0pO1xyXG4gICAgZW5hYmxlWFJheShhbGV4YVRlbGVtZXRyeUZuKTtcclxuXHJcbiAgICBpb3RUZWxlbWV0cnlUYWJsZS5ncmFudFJlYWREYXRhKGFsZXhhVGVsZW1ldHJ5Rm4pO1xyXG5cclxuICAgIGNvbnN0IGFsZXhhUmVzb3VyY2UgPSBhcGkucm9vdC5hZGRSZXNvdXJjZShcImFsZXhhXCIpO1xyXG5cclxuICAgIGNvbnN0IHB1YmxpY01ldGhvZE9wdGlvbnM6IGFwaWd3Lk1ldGhvZE9wdGlvbnMgPSB7XHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlndy5BdXRob3JpemF0aW9uVHlwZS5OT05FLFxyXG4gICAgICBhcGlLZXlSZXF1aXJlZDogZmFsc2UsXHJcbiAgICB9O1xyXG5cclxuICAgIGFsZXhhUmVzb3VyY2VcclxuICAgICAgLmFkZFJlc291cmNlKFwiaHRcIilcclxuICAgICAgLmFkZFJlc291cmNlKFwibGF0ZXN0XCIpXHJcbiAgICAgIC5hZGRNZXRob2QoXHJcbiAgICAgICAgXCJHRVRcIixcclxuICAgICAgICBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24oYWxleGFUZWxlbWV0cnlGbiksXHJcbiAgICAgICAgcHVibGljTWV0aG9kT3B0aW9uc1xyXG4gICAgICApO1xyXG5cclxuICAgIGFsZXhhUmVzb3VyY2VcclxuICAgICAgLmFkZFJlc291cmNlKFwicGFya2luZ1wiKVxyXG4gICAgICAuYWRkUmVzb3VyY2UoXCJsYXRlc3RcIilcclxuICAgICAgLmFkZE1ldGhvZChcclxuICAgICAgICBcIkdFVFwiLFxyXG4gICAgICAgIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbihhbGV4YVRlbGVtZXRyeUZuKSxcclxuICAgICAgICBwdWJsaWNNZXRob2RPcHRpb25zXHJcbiAgICAgICk7XHJcblxyXG4gICAgYWxleGFSZXNvdXJjZVxyXG4gICAgICAuYWRkUmVzb3VyY2UoXCJzdW1tYXJ5XCIpXHJcbiAgICAgIC5hZGRNZXRob2QoXHJcbiAgICAgICAgXCJHRVRcIixcclxuICAgICAgICBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24oYWxleGFUZWxlbWV0cnlGbiksXHJcbiAgICAgICAgcHVibGljTWV0aG9kT3B0aW9uc1xyXG4gICAgICApO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiQWxleGFIdExhdGVzdFVybFwiLCB7IHZhbHVlOiBhcGkudXJsICsgXCJhbGV4YS9odC9sYXRlc3RcIiB9KTtcclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiQWxleGFQYXJraW5nTGF0ZXN0VXJsXCIsIHsgdmFsdWU6IGFwaS51cmwgKyBcImFsZXhhL3BhcmtpbmcvbGF0ZXN0XCIgfSk7XHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIkFsZXhhU3VtbWFyeVVybFwiLCB7IHZhbHVlOiBhcGkudXJsICsgXCJhbGV4YS9zdW1tYXJ5XCIgfSk7XHJcblxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICAvLyBXaGF0c0FwcCBCb3QgKENsb3VkIEFQSSkg4oCUIHdlYmhvb2tcclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgY29uc3Qgd2hhdHNhcHBCb3RGbiA9IG5ldyBOb2RlanNGdW5jdGlvbih0aGlzLCBcIldoYXRzQXBwQm90SGFuZGxlclwiLCB7XHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxyXG4gICAgICBlbnRyeTogcGF0aC5qb2luKF9fZGlybmFtZSwgXCIuLi9sYW1iZGEvd2hhdHNhcHAtYm90LnRzXCIpLFxyXG4gICAgICBoYW5kbGVyOiBcImhhbmRsZXJcIixcclxuICAgICAgYnVuZGxpbmc6IHsgdGFyZ2V0OiBcIm5vZGUxOFwiLCBtaW5pZnk6IHRydWUsIHNvdXJjZU1hcDogZmFsc2UgfSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICBURUxFTUVUUllfVEFCTEU6IGlvdFRlbGVtZXRyeVRhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgICBXSEFUU0FQUF9UT0tFTjpcclxuICAgICAgICAgIFwiRUFBSzJvNHkxd3VvQlFXeDE4UG9LOXltdHpPelpBdVpCV2FaQmV4ZHdrZHJTNjBlMmtzZVdpRGJGemVoc2hLQ1Y5ZUlRT2JGZ0hqZTRiUkF2SkNNNmx2bjhXUDNxUXEza1ZxYWtlRVlLQ3pvb0FpbkZZaWxsWkFMaGtuUklxY1pCeGd0MEE2WTVQVVc1NmhKdjRSVnNaQnRXUUoxU1FzaldpYnpSTDR6SFhDVWVzR3J5S1lkbURWc2NROEZ6YU5LZlpDa2R4Yk5PRmFDZlpBN1VZT1k1YkZjZ1RtWFVRQ1IwaWQyWkI5TEc1VmNVUmdJZjJqWE9lakRXWkNjQ2JVZE84WkFPZmE4VXc1WkFJWkJ2a0E1MUh5UlFDS1ZDMlwiLFxyXG4gICAgICAgIFBIT05FX05VTUJFUl9JRDogXCI4ODM4ODA4MjQ4MTM2MDVcIixcclxuICAgICAgICBWRVJJRllfVE9LRU46IFwicGFya2luZ2JvdF92ZXJpZnlcIixcclxuICAgICAgICBBTExPV0xJU1RfRTE2NDogXCIrOTczMzgwMDY0NDhcIixcclxuICAgICAgfSxcclxuICAgICAgdHJhY2luZzogbGFtYmRhLlRyYWNpbmcuQUNUSVZFLFxyXG4gICAgfSk7XHJcbiAgICBlbmFibGVYUmF5KHdoYXRzYXBwQm90Rm4pO1xyXG5cclxuICAgIGlvdFRlbGVtZXRyeVRhYmxlLmdyYW50UmVhZERhdGEod2hhdHNhcHBCb3RGbik7XHJcblxyXG4gICAgY29uc3Qgd2hhdHNhcHBSZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKFwid2hhdHNhcHBcIik7XHJcbiAgICBjb25zdCB3ZWJob29rUmVzb3VyY2UgPSB3aGF0c2FwcFJlc291cmNlLmFkZFJlc291cmNlKFwid2ViaG9va1wiKTtcclxuXHJcbiAgICB3ZWJob29rUmVzb3VyY2UuYWRkTWV0aG9kKFxyXG4gICAgICBcIkdFVFwiLFxyXG4gICAgICBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24od2hhdHNhcHBCb3RGbiksXHJcbiAgICAgIHB1YmxpY01ldGhvZE9wdGlvbnNcclxuICAgICk7XHJcbiAgICB3ZWJob29rUmVzb3VyY2UuYWRkTWV0aG9kKFxyXG4gICAgICBcIlBPU1RcIixcclxuICAgICAgbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKHdoYXRzYXBwQm90Rm4pLFxyXG4gICAgICBwdWJsaWNNZXRob2RPcHRpb25zXHJcbiAgICApO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiV2hhdHNBcHBXZWJob29rVXJsXCIsIHsgdmFsdWU6IGFwaS51cmwgKyBcIndoYXRzYXBwL3dlYmhvb2tcIiB9KTtcclxuXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIC8vIFZpcnR1YWwgQXNzaXN0YW50IEFQSSByb3V0ZSAoQmVkcm9jaylcclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgY29uc3QgYmVkcm9ja0NmbkZuID0gYmVkcm9ja1N0YWNrLmxhbWJkYUZ1bmN0aW9uLm5vZGVcclxuICAgICAgLmRlZmF1bHRDaGlsZCBhcyBsYW1iZGEuQ2ZuRnVuY3Rpb247XHJcbiAgICBiZWRyb2NrQ2ZuRm4udHJhY2luZ0NvbmZpZyA9IHsgbW9kZTogXCJBY3RpdmVcIiB9O1xyXG5cclxuICAgIGVuYWJsZVhSYXkoYmVkcm9ja1N0YWNrLmxhbWJkYUZ1bmN0aW9uKTtcclxuXHJcbiAgICBjb25zdCBhc3Npc3RhbnRSZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKFwiYXNzaXN0YW50XCIpO1xyXG4gICAgYXNzaXN0YW50UmVzb3VyY2UuYWRkTWV0aG9kKFxyXG4gICAgICBcIlBPU1RcIixcclxuICAgICAgbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKGJlZHJvY2tTdGFjay5sYW1iZGFGdW5jdGlvbilcclxuICAgICk7XHJcblxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICAvLyBQcmUtUmVnaXN0cmF0aW9uOiBQcmVzaWduZWQgVXBsb2FkICsgVmFsaWRhdGUgSW1hZ2UgKyBQcmVzaWduZWQgRG93bmxvYWRcclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgY29uc3QgZ2VuZXJhdGVQcmVzaWduZWRVcmxGbiA9IG5ldyBOb2RlanNGdW5jdGlvbihcclxuICAgICAgdGhpcyxcclxuICAgICAgXCJHZW5lcmF0ZVByZXNpZ25lZFVybEhhbmRsZXJcIixcclxuICAgICAge1xyXG4gICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxyXG4gICAgICAgIGVudHJ5OiBwYXRoLmpvaW4oX19kaXJuYW1lLCBcIi4uL2xhbWJkYS9nZW5lcmF0ZVByZXNpZ25lZFVwbG9hZFVybC50c1wiKSxcclxuICAgICAgICBoYW5kbGVyOiBcImhhbmRsZXJcIixcclxuICAgICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgICAgQlVDS0VUX05BTUU6IHByZVJlZ0J1Y2tldC5idWNrZXROYW1lLFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgdHJhY2luZzogbGFtYmRhLlRyYWNpbmcuQUNUSVZFLFxyXG4gICAgICB9XHJcbiAgICApO1xyXG4gICAgZW5hYmxlWFJheShnZW5lcmF0ZVByZXNpZ25lZFVybEZuKTtcclxuXHJcbiAgICBwcmVSZWdCdWNrZXQuZ3JhbnRSZWFkV3JpdGUoZ2VuZXJhdGVQcmVzaWduZWRVcmxGbik7XHJcblxyXG4gICAgY29uc3QgdXBsb2FkSW1hZ2VSZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKFwidXBsb2FkLWltYWdlXCIpO1xyXG4gICAgdXBsb2FkSW1hZ2VSZXNvdXJjZS5hZGRNZXRob2QoXHJcbiAgICAgIFwiUE9TVFwiLFxyXG4gICAgICBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24oZ2VuZXJhdGVQcmVzaWduZWRVcmxGbiksXHJcbiAgICAgIHsgYXV0aG9yaXphdGlvblR5cGU6IGFwaWd3LkF1dGhvcml6YXRpb25UeXBlLk5PTkUgfVxyXG4gICAgKTtcclxuXHJcbiAgICBjb25zdCBwcmVSZWdpc3RlckNoZWNrRm4gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsIFwiUHJlUmVnaXN0ZXJDaGVja0hhbmRsZXJcIiwge1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM185LFxyXG4gICAgICBoYW5kbGVyOiBcIlByZVJlZ2lzdGVyQ2hlY2suaGFuZGxlclwiLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoXCJsYW1iZGFcIiksXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICBCVUNLRVRfTkFNRTogcHJlUmVnQnVja2V0LmJ1Y2tldE5hbWUsXHJcbiAgICAgICAgVVNFUl9NQU5BR0VNRU5UX1RBQkxFOiB1c2VyVGFibGUudGFibGVOYW1lLFxyXG4gICAgICAgIENPTExFQ1RJT05fSUQ6IGAke3ByZWZpeG5hbWV9LVZpc2l0b3JGYWNlQ29sbGVjdGlvbmAsXHJcbiAgICAgIH0sXHJcbiAgICAgIHRyYWNpbmc6IGxhbWJkYS5UcmFjaW5nLkFDVElWRSxcclxuICAgIH0pO1xyXG4gICAgZW5hYmxlWFJheShwcmVSZWdpc3RlckNoZWNrRm4pO1xyXG5cclxuICAgIHByZVJlZ0J1Y2tldC5ncmFudFJlYWRXcml0ZShwcmVSZWdpc3RlckNoZWNrRm4pO1xyXG4gICAgdXNlclRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShwcmVSZWdpc3RlckNoZWNrRm4pO1xyXG5cclxuICAgIGNvbnN0IHZhbGlkYXRlSW1hZ2VSZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKFwidmFsaWRhdGUtaW1hZ2VcIik7XHJcbiAgICB2YWxpZGF0ZUltYWdlUmVzb3VyY2UuYWRkTWV0aG9kKFxyXG4gICAgICBcIlBPU1RcIixcclxuICAgICAgbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKHByZVJlZ2lzdGVyQ2hlY2tGbiksXHJcbiAgICAgIHsgYXV0aG9yaXphdGlvblR5cGU6IGFwaWd3LkF1dGhvcml6YXRpb25UeXBlLk5PTkUgfVxyXG4gICAgKTtcclxuXHJcbiAgICBjb25zdCBnZXRJbWFnZUZuID0gbmV3IE5vZGVqc0Z1bmN0aW9uKHRoaXMsIFwiR2V0UHJlc2lnbmVkRG93bmxvYWRVcmxIYW5kbGVyXCIsIHtcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXHJcbiAgICAgIGVudHJ5OiBwYXRoLmpvaW4oX19kaXJuYW1lLCBcIi4uL2xhbWJkYS9nZW5lcmF0ZVByZXNpZ25lZERvd25sb2FkVXJsLnRzXCIpLFxyXG4gICAgICBoYW5kbGVyOiBcImhhbmRsZXJcIixcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICBCVUNLRVRfTkFNRTogcHJlUmVnQnVja2V0LmJ1Y2tldE5hbWUsXHJcbiAgICAgIH0sXHJcbiAgICAgIHRyYWNpbmc6IGxhbWJkYS5UcmFjaW5nLkFDVElWRSxcclxuICAgIH0pO1xyXG4gICAgZW5hYmxlWFJheShnZXRJbWFnZUZuKTtcclxuXHJcbiAgICBwcmVSZWdCdWNrZXQuZ3JhbnRSZWFkKGdldEltYWdlRm4pO1xyXG5cclxuICAgIGNvbnN0IGdldEltYWdlUmVzb3VyY2UgPSBhcGkucm9vdC5hZGRSZXNvdXJjZShcImdldC1pbWFnZVwiKTtcclxuICAgIGdldEltYWdlUmVzb3VyY2UuYWRkTWV0aG9kKFwiR0VUXCIsIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbihnZXRJbWFnZUZuKSwge1xyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ3cuQXV0aG9yaXphdGlvblR5cGUuTk9ORSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgLy8gVVNFUiBNQU5BR0VNRU5UXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIGNvbnN0IHVzZXJzUmVzb3VyY2UgPSBhcGkucm9vdC5hZGRSZXNvdXJjZShcInVzZXJzXCIpO1xyXG4gICAgY29uc3QgdXNlckJ5SWRSZXNvdXJjZSA9IHVzZXJzUmVzb3VyY2UuYWRkUmVzb3VyY2UoXCJ7dXNlcklkfVwiKTtcclxuXHJcbiAgICBjb25zdCB1c2Vyc0dldEZuID0gbmV3IE5vZGVqc0Z1bmN0aW9uKHRoaXMsIFwiVXNlcnNHZXRIYW5kbGVyXCIsIHtcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXHJcbiAgICAgIGVudHJ5OiBwYXRoLmpvaW4oX19kaXJuYW1lLCBcIi4uL2xhbWJkYS91c2Vycy1nZXQudHNcIiksXHJcbiAgICAgIGhhbmRsZXI6IFwiaGFuZGxlclwiLFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIFVTRVJfUE9PTF9JRDogdXNlclBvb2wudXNlclBvb2xJZCxcclxuICAgICAgICBBTExPV0VEX09SSUdJTjogXCIqXCIsIC8vIHNpbmNlIEdMT0JBTCBDT1JTIGlzIFwiKlwiXHJcbiAgICAgIH0sXHJcbiAgICAgIGJ1bmRsaW5nOiB7IHRhcmdldDogXCJub2RlMThcIiwgbWluaWZ5OiB0cnVlLCBzb3VyY2VNYXA6IGZhbHNlIH0sXHJcbiAgICAgIHRyYWNpbmc6IGxhbWJkYS5UcmFjaW5nLkFDVElWRSxcclxuICAgIH0pO1xyXG4gICAgZW5hYmxlWFJheSh1c2Vyc0dldEZuKTtcclxuXHJcbiAgICB1c2Vyc0dldEZuLmFkZFRvUm9sZVBvbGljeShcclxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICAgIGFjdGlvbnM6IFtcImNvZ25pdG8taWRwOkxpc3RVc2Vyc1wiXSxcclxuICAgICAgICByZXNvdXJjZXM6IFt1c2VyUG9vbC51c2VyUG9vbEFybl0sXHJcbiAgICAgIH0pXHJcbiAgICApO1xyXG5cclxuICAgIHVzZXJzUmVzb3VyY2UuYWRkTWV0aG9kKFwiR0VUXCIsIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbih1c2Vyc0dldEZuKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ3cuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHVzZXJzQ3JlYXRlRm4gPSBuZXcgTm9kZWpzRnVuY3Rpb24odGhpcywgXCJVc2Vyc0NyZWF0ZUhhbmRsZXJcIiwge1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICAgICAgZW50cnk6IHBhdGguam9pbihfX2Rpcm5hbWUsIFwiLi4vbGFtYmRhL3VzZXJzLWNyZWF0ZS50c1wiKSxcclxuICAgICAgaGFuZGxlcjogXCJoYW5kbGVyXCIsXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgVVNFUl9QT09MX0lEOiB1c2VyUG9vbC51c2VyUG9vbElkLFxyXG4gICAgICAgIEFMTE9XRURfT1JJR0lOOiBcIipcIixcclxuICAgICAgfSxcclxuICAgICAgYnVuZGxpbmc6IHsgdGFyZ2V0OiBcIm5vZGUxOFwiLCBtaW5pZnk6IHRydWUsIHNvdXJjZU1hcDogZmFsc2UgfSxcclxuICAgICAgdHJhY2luZzogbGFtYmRhLlRyYWNpbmcuQUNUSVZFLFxyXG4gICAgfSk7XHJcbiAgICBlbmFibGVYUmF5KHVzZXJzQ3JlYXRlRm4pO1xyXG5cclxuICAgIHVzZXJzQ3JlYXRlRm4uYWRkVG9Sb2xlUG9saWN5KFxyXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgICAgYWN0aW9uczogW1wiY29nbml0by1pZHA6QWRtaW5DcmVhdGVVc2VyXCJdLFxyXG4gICAgICAgIHJlc291cmNlczogW3VzZXJQb29sLnVzZXJQb29sQXJuXSxcclxuICAgICAgfSlcclxuICAgICk7XHJcblxyXG4gICAgdXNlcnNSZXNvdXJjZS5hZGRNZXRob2QoXCJQT1NUXCIsIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbih1c2Vyc0NyZWF0ZUZuKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ3cuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHVzZXJzVXBkYXRlRm4gPSBuZXcgTm9kZWpzRnVuY3Rpb24odGhpcywgXCJVc2Vyc1VwZGF0ZUhhbmRsZXJcIiwge1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICAgICAgZW50cnk6IHBhdGguam9pbihfX2Rpcm5hbWUsIFwiLi4vbGFtYmRhL3VzZXJzLXVwZGF0ZS50c1wiKSxcclxuICAgICAgaGFuZGxlcjogXCJoYW5kbGVyXCIsXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgVVNFUl9QT09MX0lEOiB1c2VyUG9vbC51c2VyUG9vbElkLFxyXG4gICAgICAgIEFMTE9XRURfT1JJR0lOOiBcIipcIixcclxuICAgICAgfSxcclxuICAgICAgYnVuZGxpbmc6IHsgdGFyZ2V0OiBcIm5vZGUxOFwiLCBtaW5pZnk6IHRydWUsIHNvdXJjZU1hcDogZmFsc2UgfSxcclxuICAgICAgdHJhY2luZzogbGFtYmRhLlRyYWNpbmcuQUNUSVZFLFxyXG4gICAgfSk7XHJcbiAgICBlbmFibGVYUmF5KHVzZXJzVXBkYXRlRm4pO1xyXG5cclxuICAgIHVzZXJzVXBkYXRlRm4uYWRkVG9Sb2xlUG9saWN5KFxyXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgICAgYWN0aW9uczogW1wiY29nbml0by1pZHA6QWRtaW5VcGRhdGVVc2VyQXR0cmlidXRlc1wiXSxcclxuICAgICAgICByZXNvdXJjZXM6IFt1c2VyUG9vbC51c2VyUG9vbEFybl0sXHJcbiAgICAgIH0pXHJcbiAgICApO1xyXG5cclxuICAgIHVzZXJCeUlkUmVzb3VyY2UuYWRkTWV0aG9kKFwiUFVUXCIsIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbih1c2Vyc1VwZGF0ZUZuKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ3cuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHVzZXJzRGVsZXRlRm4gPSBuZXcgTm9kZWpzRnVuY3Rpb24odGhpcywgXCJVc2Vyc0RlbGV0ZUhhbmRsZXJcIiwge1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICAgICAgZW50cnk6IHBhdGguam9pbihfX2Rpcm5hbWUsIFwiLi4vbGFtYmRhL3VzZXJzLWRlbGV0ZS50c1wiKSxcclxuICAgICAgaGFuZGxlcjogXCJoYW5kbGVyXCIsXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgVVNFUl9QT09MX0lEOiB1c2VyUG9vbC51c2VyUG9vbElkLFxyXG4gICAgICAgIEFMTE9XRURfT1JJR0lOOiBcIipcIixcclxuICAgICAgfSxcclxuICAgICAgYnVuZGxpbmc6IHsgdGFyZ2V0OiBcIm5vZGUxOFwiLCBtaW5pZnk6IHRydWUsIHNvdXJjZU1hcDogZmFsc2UgfSxcclxuICAgICAgdHJhY2luZzogbGFtYmRhLlRyYWNpbmcuQUNUSVZFLFxyXG4gICAgfSk7XHJcbiAgICBlbmFibGVYUmF5KHVzZXJzRGVsZXRlRm4pO1xyXG5cclxuICAgIHVzZXJzRGVsZXRlRm4uYWRkVG9Sb2xlUG9saWN5KFxyXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgICAgYWN0aW9uczogW1wiY29nbml0by1pZHA6QWRtaW5EZWxldGVVc2VyXCJdLFxyXG4gICAgICAgIHJlc291cmNlczogW3VzZXJQb29sLnVzZXJQb29sQXJuXSxcclxuICAgICAgfSlcclxuICAgICk7XHJcblxyXG4gICAgdXNlckJ5SWRSZXNvdXJjZS5hZGRNZXRob2QoXHJcbiAgICAgIFwiREVMRVRFXCIsXHJcbiAgICAgIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbih1c2Vyc0RlbGV0ZUZuKSxcclxuICAgICAge1xyXG4gICAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWd3LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICAgIH1cclxuICAgICk7XHJcblxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICAvLyBBbmFseXRpY3MgRGFzaGJvYXJkIChSRUFMIERBVEEpXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIGNvbnN0IGFuYWx5dGljc0Rhc2hib2FyZEZuID0gbmV3IE5vZGVqc0Z1bmN0aW9uKHRoaXMsIFwiQW5hbHl0aWNzRGFzaGJvYXJkSGFuZGxlclwiLCB7XHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxyXG4gICAgICBlbnRyeTogcGF0aC5qb2luKF9fZGlybmFtZSwgXCIuLi9sYW1iZGEvYW5hbHl0aWNzLWRhc2hib2FyZC50c1wiKSxcclxuICAgICAgaGFuZGxlcjogXCJoYW5kbGVyXCIsXHJcbiAgICAgIGJ1bmRsaW5nOiB7IHRhcmdldDogXCJub2RlMThcIiwgbWluaWZ5OiB0cnVlLCBzb3VyY2VNYXA6IGZhbHNlIH0sXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgUExVR19BQ1RJT05TX1RBQkxFOiBkYlN0YWNrLnBsdWdBY3Rpb25zVGFibGUudGFibGVOYW1lLFxyXG4gICAgICAgIFRFTEVNRVRSWV9UQUJMRTogZGJTdGFjay5pb3RUZWxlbWV0cnlUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgICAgUExVR19JTkRFWF9OQU1FOiBcInBsdWdfaWQtdHMtaW5kZXhcIixcclxuICAgICAgfSxcclxuICAgICAgdHJhY2luZzogbGFtYmRhLlRyYWNpbmcuQUNUSVZFLFxyXG4gICAgfSk7XHJcbiAgICBlbmFibGVYUmF5KGFuYWx5dGljc0Rhc2hib2FyZEZuKTtcclxuXHJcbiAgICBkYlN0YWNrLnBsdWdBY3Rpb25zVGFibGUuZ3JhbnRSZWFkRGF0YShhbmFseXRpY3NEYXNoYm9hcmRGbik7XHJcbiAgICBkYlN0YWNrLmlvdFRlbGVtZXRyeVRhYmxlLmdyYW50UmVhZERhdGEoYW5hbHl0aWNzRGFzaGJvYXJkRm4pO1xyXG5cclxuICAgIGNvbnN0IGFuYWx5dGljc1Jlc291cmNlID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoXCJhbmFseXRpY3NcIik7XHJcbiAgICBjb25zdCBkYXNoYm9hcmRSZXNvdXJjZSA9IGFuYWx5dGljc1Jlc291cmNlLmFkZFJlc291cmNlKFwiZGFzaGJvYXJkXCIpO1xyXG4gICAgZGFzaGJvYXJkUmVzb3VyY2UuYWRkTWV0aG9kKFwiR0VUXCIsIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbihhbmFseXRpY3NEYXNoYm9hcmRGbiksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWd3LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIC8vIFVwbG9hZCBVbml0eSBidWlsZCAocHJlc2lnbmVkKSArIENsb3VkRnJvbnQgaW52YWxpZGF0aW9uXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIGNvbnN0IHByZXNpZ25lZFVybEhhbmRsZXIgPSBuZXcgTm9kZWpzRnVuY3Rpb24odGhpcywgXCJQcmVzaWduZWRVcmxIYW5kbGVyXCIsIHtcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXHJcbiAgICAgIGhhbmRsZXI6IFwiaGFuZGxlclwiLFxyXG4gICAgICBlbnRyeTogcGF0aC5qb2luKF9fZGlybmFtZSwgXCIuLlwiLCBcImxhbWJkYVwiLCBcInVwbG9hZEJ1aWxkSGFuZGxlci50c1wiKSxcclxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTApLFxyXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgQlVDS0VUX05BTUU6IGZyb250ZW5kU3RhY2suZnJvbnRlbmRCdWNrZXQuYnVja2V0TmFtZSxcclxuICAgICAgICBVUExPQURfRElSRUNUT1JZOiBcInVuaXR5XCIsXHJcbiAgICAgICAgTUFYX0ZJTEVTOiBcIjRcIixcclxuICAgICAgICBVUkxfRVhQSVJBVElPTl9TRUNPTkRTOiBcIjM2MDBcIixcclxuICAgICAgICBDTE9VREZST05UX0RJU1RSSUJVVElPTl9JRDogZnJvbnRlbmRTdGFjay5kaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uSWQsXHJcbiAgICAgIH0sXHJcbiAgICAgIHRyYWNpbmc6IGxhbWJkYS5UcmFjaW5nLkFDVElWRSxcclxuICAgIH0pO1xyXG4gICAgZW5hYmxlWFJheShwcmVzaWduZWRVcmxIYW5kbGVyKTtcclxuXHJcbiAgICBmcm9udGVuZFN0YWNrLmZyb250ZW5kQnVja2V0LmdyYW50UHV0KHByZXNpZ25lZFVybEhhbmRsZXIpO1xyXG5cclxuICAgIHByZXNpZ25lZFVybEhhbmRsZXIuYWRkVG9Sb2xlUG9saWN5KFxyXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgICAgYWN0aW9uczogW1wiY2xvdWRmcm9udDpDcmVhdGVJbnZhbGlkYXRpb25cIl0sXHJcbiAgICAgICAgcmVzb3VyY2VzOiBbXCIqXCJdLFxyXG4gICAgICB9KVxyXG4gICAgKTtcclxuXHJcbiAgICBjb25zdCB1cGxvYWRSZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKFwiZ2VuZXJhdGUtdXBsb2FkLXVybHNcIik7XHJcbiAgICB1cGxvYWRSZXNvdXJjZS5hZGRNZXRob2QoXCJQT1NUXCIsIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbihwcmVzaWduZWRVcmxIYW5kbGVyKSk7XHJcblxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICAvLyBWaXNpdG9yIEZlZWRiYWNrIEFQSSAocHl0aG9uKVxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICBjb25zdCBjcmVhdGVQeXRob25MYW1iZGEgPSAoXHJcbiAgICAgIGlkOiBzdHJpbmcsXHJcbiAgICAgIGhhbmRsZXJGaWxlOiBzdHJpbmcsXHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogc3RyaW5nLFxyXG4gICAgICBlbnY6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH1cclxuICAgICkgPT4ge1xyXG4gICAgICBjb25zdCBmbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgaWQsIHtcclxuICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMSxcclxuICAgICAgICBoYW5kbGVyOiBgJHtoYW5kbGVyRmlsZX0uaGFuZGxlcmAsXHJcbiAgICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsIFwiLi4vbGFtYmRhXCIpLCB7XHJcbiAgICAgICAgICBidW5kbGluZzoge1xyXG4gICAgICAgICAgICBpbWFnZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTEuYnVuZGxpbmdJbWFnZSxcclxuICAgICAgICAgICAgY29tbWFuZDogW1xyXG4gICAgICAgICAgICAgIFwiYmFzaFwiLFxyXG4gICAgICAgICAgICAgIFwiLWNcIixcclxuICAgICAgICAgICAgICBgcGlwIGluc3RhbGwgLXIgcmVxdWlyZW1lbnRzLnR4dCAtdCAvYXNzZXQtb3V0cHV0ICYmIGNwIC1yIC4gL2Fzc2V0LW91dHB1dGAsXHJcbiAgICAgICAgICAgIF0sXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgIH0pLFxyXG4gICAgICAgIGVudmlyb25tZW50OiBlbnYsXHJcbiAgICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxyXG4gICAgICAgIGZ1bmN0aW9uTmFtZTogYCR7cHJlZml4bmFtZX0ke2Z1bmN0aW9uTmFtZX1gLFxyXG4gICAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9EQVksXHJcbiAgICAgICAgdHJhY2luZzogbGFtYmRhLlRyYWNpbmcuQUNUSVZFLFxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGVuYWJsZVhSYXkoZm4pO1xyXG4gICAgICByZXR1cm4gZm47XHJcbiAgICB9O1xyXG5cclxuICAgIGNvbnN0IGNvbW1vbkVudiA9IHtcclxuICAgICAgRkVFREJBQ0tfVEFCTEU6IGZlZWRiYWNrVGFibGUudGFibGVOYW1lLFxyXG4gICAgICBWSVNJVE9SX1RBQkxFOiB1c2VyVGFibGUudGFibGVOYW1lLFxyXG4gICAgICBGRUVEQkFDS19TRUNSRVQ6IFwic2VjcmV0XCIsXHJcbiAgICAgIHVzZWRfdG9rZW5zX3RhYmxlOiB1c2VkVG9rZW5zVGFibGUudGFibGVOYW1lLFxyXG4gICAgICBCUk9BRENBU1RfTEFNQkRBOiBicm9hZGNhc3RMYW1iZGEuZnVuY3Rpb25Bcm4sXHJcbiAgICB9O1xyXG5cclxuICAgIGNvbnN0IGdldFZpc2l0b3JJbmZvTGFtYmRhID0gY3JlYXRlUHl0aG9uTGFtYmRhKFxyXG4gICAgICBcIkdldFZpc2l0b3JJbmZvTGFtYmRhXCIsXHJcbiAgICAgIFwiZ2V0VmlzaXRvckluZm9cIixcclxuICAgICAgXCJHZXRWaXNpdG9ySW5mb0xhbWJkYVwiLFxyXG4gICAgICBjb21tb25FbnZcclxuICAgICk7XHJcblxyXG4gICAgY29uc3Qgc3VibWl0RmVlZGJhY2tMYW1iZGEgPSBjcmVhdGVQeXRob25MYW1iZGEoXHJcbiAgICAgIFwiU3VibWl0RmVlZGJhY2tMYW1iZGFcIixcclxuICAgICAgXCJzdWJtaXRGZWVkYmFja1wiLFxyXG4gICAgICBcIlN1Ym1pdEZlZWRiYWNrTGFtYmRhXCIsXHJcbiAgICAgIGNvbW1vbkVudlxyXG4gICAgKTtcclxuXHJcbiAgICBjb25zdCBnZXRGZWVkYmFja0xhbWJkYSA9IGNyZWF0ZVB5dGhvbkxhbWJkYShcclxuICAgICAgXCJHZXRGZWVkYmFja0xhbWJkYVwiLFxyXG4gICAgICBcImdldEZlZWRiYWNrXCIsXHJcbiAgICAgIFwiR2V0RmVlZGJhY2tMYW1iZGFcIixcclxuICAgICAgY29tbW9uRW52XHJcbiAgICApO1xyXG5cclxuICAgIGNvbnN0IGxvYWRGZWVkYmFja0xhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgXCJMb2FkRmVlZGJhY2tcIiwge1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMSxcclxuICAgICAgaGFuZGxlcjogXCJMb2FkRmVlZGJhY2suaGFuZGxlclwiLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoXCJsYW1iZGFcIiksXHJcbiAgICAgIGVudmlyb25tZW50OiB7IEZFRURCQUNLX1RBQkxFOiBmZWVkYmFja1RhYmxlLnRhYmxlTmFtZSB9LFxyXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogYCR7cHJlZml4bmFtZX0tTG9hZEZlZWRiYWNrYCxcclxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX0RBWSxcclxuICAgICAgdHJhY2luZzogbGFtYmRhLlRyYWNpbmcuQUNUSVZFLFxyXG4gICAgfSk7XHJcbiAgICBlbmFibGVYUmF5KGxvYWRGZWVkYmFja0xhbWJkYSk7XHJcblxyXG4gICAgdXNlclRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShnZXRWaXNpdG9ySW5mb0xhbWJkYSk7XHJcbiAgICB1c2VyVGFibGUuZ3JhbnRSZWFkRGF0YShzdWJtaXRGZWVkYmFja0xhbWJkYSk7XHJcbiAgICBmZWVkYmFja1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShzdWJtaXRGZWVkYmFja0xhbWJkYSk7XHJcbiAgICBmZWVkYmFja1RhYmxlLmdyYW50UmVhZERhdGEoZ2V0RmVlZGJhY2tMYW1iZGEpO1xyXG4gICAgZmVlZGJhY2tUYWJsZS5ncmFudFJlYWREYXRhKGxvYWRGZWVkYmFja0xhbWJkYSk7XHJcbiAgICB1c2VkVG9rZW5zVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGdldFZpc2l0b3JJbmZvTGFtYmRhKTtcclxuICAgIHVzZWRUb2tlbnNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoc3VibWl0RmVlZGJhY2tMYW1iZGEpO1xyXG5cclxuICAgIGJyb2FkY2FzdExhbWJkYS5ncmFudEludm9rZShzdWJtaXRGZWVkYmFja0xhbWJkYS5yb2xlISk7XHJcblxyXG4gICAgY29uc3QgZ2V0VmlzaXRvckluZm9SZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKFwiZ2V0VmlzaXRvckluZm9cIik7XHJcbiAgICBnZXRWaXNpdG9ySW5mb1Jlc291cmNlLmFkZE1ldGhvZChcIkdFVFwiLCBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24oZ2V0VmlzaXRvckluZm9MYW1iZGEpLCB7XHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBzdWJtaXRGZWVkYmFja1Jlc291cmNlID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoXCJzdWJtaXRGZWVkYmFja1wiKTtcclxuICAgIHN1Ym1pdEZlZWRiYWNrUmVzb3VyY2UuYWRkTWV0aG9kKFwiUE9TVFwiLCBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24oc3VibWl0RmVlZGJhY2tMYW1iZGEpLCB7XHJcbiAgICAgIC8vIGF1dGhvcml6ZXIsXHJcbiAgICAgIC8vIGF1dGhvcml6YXRpb25UeXBlOiBhcGlndy5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgYWRtaW5SZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKFwiYWRtaW5cIik7XHJcblxyXG4gICAgYWRtaW5SZXNvdXJjZVxyXG4gICAgICAuYWRkUmVzb3VyY2UoXCJnZXRGZWVkYmFja1wiKVxyXG4gICAgICAuYWRkTWV0aG9kKFwiR0VUXCIsIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbihnZXRGZWVkYmFja0xhbWJkYSksIHtcclxuICAgICAgICBhdXRob3JpemVyLFxyXG4gICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlndy5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgICB9KTtcclxuXHJcbiAgICBhZG1pblJlc291cmNlXHJcbiAgICAgIC5hZGRSZXNvdXJjZShcImxvYWRGZWVkYmFja1wiKVxyXG4gICAgICAuYWRkTWV0aG9kKFwiUE9TVFwiLCBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24obG9hZEZlZWRiYWNrTGFtYmRhKSwge1xyXG4gICAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWd3LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICAgIH0pO1xyXG5cclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgLy8gRmFjaWFsIFJlY29nbml0aW9uIFJFU1QgQVBJXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIGNvbnN0IGludml0ZWRWaXNpdG9yVGFibGUgPSBkYlN0YWNrLmludml0ZWRWaXNpdG9yVGFibGU7XHJcbiAgICBjb25zdCB3ZWJzaXRlQWN0aXZpdHlUYWJsZSA9IGRiU3RhY2sud2Vic2l0ZUFjdGl2aXR5VGFibGU7XHJcbiAgICBjb25zdCBmYWNpYWxCdWNrZXQgPSBkYlN0YWNrLmJhaHR3aW5UZXN0aW5nQnVja2V0O1xyXG5cclxuICAgIGNvbnN0IHZpc2l0b3JSZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKFwidmlzaXRvclwiKTtcclxuXHJcbiAgICBjb25zdCBwdWJsaWNPcHRzOiBhcGlndy5NZXRob2RPcHRpb25zID0ge1xyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ3cuQXV0aG9yaXphdGlvblR5cGUuTk9ORSxcclxuICAgICAgYXBpS2V5UmVxdWlyZWQ6IGZhbHNlLFxyXG4gICAgfTtcclxuXHJcbiAgICBjb25zdCBhZG1pbk9wdHM6IGFwaWd3Lk1ldGhvZE9wdGlvbnMgPSB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlndy5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfTtcclxuXHJcbiAgICBjb25zdCBhcnJpdmFsVG9waWMgPSBuZXcgc25zLlRvcGljKHRoaXMsIFwiVmlzaXRvckFycml2YWxUb3BpY1wiLCB7XHJcbiAgICAgIHRvcGljTmFtZTogYCR7cHJlZml4bmFtZX0tVmlzaXRvckFycml2YWxOb3RpZmljYXRpb25zYCxcclxuICAgIH0pO1xyXG4gICAgYXJyaXZhbFRvcGljLmFkZFN1YnNjcmlwdGlvbihcclxuICAgICAgbmV3IHN1YnNjcmlwdGlvbnMuU21zU3Vic2NyaXB0aW9uKFwiKzk3MzMyMjMzNDE3XCIpXHJcbiAgICApO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiQXJyaXZhbFRvcGljQXJuT3V0cHV0XCIsIHtcclxuICAgICAgdmFsdWU6IGFycml2YWxUb3BpYy50b3BpY0FybixcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHNlbmRGZWVkYmFja0xhbWJkYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgXCJTZW5kRmVlZGJhY2tMYW1iZGFcIiwge1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMSxcclxuICAgICAgaGFuZGxlcjogXCJzZW5kRmVlZGJhY2tMYW1iZGEuaGFuZGxlclwiLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgXCIuLi9sYW1iZGFcIiksIHtcclxuICAgICAgICBidW5kbGluZzoge1xyXG4gICAgICAgICAgaW1hZ2U6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzExLmJ1bmRsaW5nSW1hZ2UsXHJcbiAgICAgICAgICBjb21tYW5kOiBbXHJcbiAgICAgICAgICAgIFwiYmFzaFwiLFxyXG4gICAgICAgICAgICBcIi1jXCIsXHJcbiAgICAgICAgICAgIGBwaXAgaW5zdGFsbCAtciByZXF1aXJlbWVudHMudHh0IC10IC9hc3NldC1vdXRwdXQgJiYgY3AgLXIgLiAvYXNzZXQtb3V0cHV0YCxcclxuICAgICAgICAgIF0sXHJcbiAgICAgICAgfSxcclxuICAgICAgfSksXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgSldUX1NFQ1JFVDogXCJzZWNyZXRcIixcclxuICAgICAgICBGUk9OVEVORF9VUkw6IGZyb250ZW5kU3RhY2suZGlzdHJpYnV0aW9uLmRvbWFpbk5hbWUgKyBcIi9WaXNpdG9yRmVlZEJhY2tcIixcclxuICAgICAgICBHTUFJTF9VU0VSOiBcImJhaHR3aW5ub3JlcGx5QGdtYWlsLmNvbVwiLFxyXG4gICAgICAgIEdNQUlMX1BBU1M6IFwiemRqbCBjZGd3IGt4emIgb2tueVwiLFxyXG4gICAgICAgIFdPUktNQUlMX1VTRVI6IFwibm8tcmVwbHlAYmFodHdpbi5hd3NhcHBzLmNvbVwiLFxyXG4gICAgICAgIFdPUktNQUlMX1BBU1M6IFwiVGVzdDEyMzQqXCIsXHJcbiAgICAgICAgV09SS01BSUxfU01UUDogXCJzbXRwLm1haWwudXMtZWFzdC0xLmF3c2FwcHMuY29tXCIsXHJcbiAgICAgIH0sXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcclxuICAgICAgZnVuY3Rpb25OYW1lOiBgJHtwcmVmaXhuYW1lfS1TZW5kRmVlZGJhY2tMYW1iZGFgLFxyXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfREFZLFxyXG4gICAgICB0cmFjaW5nOiBsYW1iZGEuVHJhY2luZy5BQ1RJVkUsXHJcbiAgICB9KTtcclxuICAgIGVuYWJsZVhSYXkoc2VuZEZlZWRiYWNrTGFtYmRhKTtcclxuICAgIFxyXG4gICAgXHJcbiAgICBjb25zdCBhcnJpdmFsUmVrb2duaXRpb25GbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgXCJBcnJpdmFsUmVrb2duaXRpb25IYW5kbGVyXCIsIHtcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTEsXHJcbiAgICAgIGhhbmRsZXI6IFwiQXJyaXZhbFJla29nbml0aW9uLkFycml2YWxSZWtvZ25pdGlvblwiLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoXCJsYW1iZGFcIiksXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcclxuICAgICAgdHJhY2luZzogbGFtYmRhLlRyYWNpbmcuQUNUSVZFLFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIEJVQ0tFVF9OQU1FOiBmYWNpYWxCdWNrZXQuYnVja2V0TmFtZSxcclxuICAgICAgICBDT0xMRUNUSU9OX0lEOiBSRUtPR19DT0xMRUNUSU9OX0lELFxyXG4gICAgICAgIFVTRVJfVEFCTEU6IHVzZXJUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgICAgSW52aXRlVGFibGU6IGludml0ZWRWaXNpdG9yVGFibGUudGFibGVOYW1lLFxyXG4gICAgICAgIEJST0FEQ0FTVF9MQU1CREE6IGJyb2FkY2FzdExhbWJkYS5mdW5jdGlvbkFybixcclxuICAgICAgICBUT1BJQ19BUk46IGFycml2YWxUb3BpYy50b3BpY0FybixcclxuICAgICAgICBTRU5EX0ZFRURCQUNLX0xBTUJEQTogc2VuZEZlZWRiYWNrTGFtYmRhLmZ1bmN0aW9uQXJuLFxyXG4gICAgICAgIFNFTkRfRkVFREJBQ0tfTEFNQkRBX05BTUU6IHNlbmRGZWVkYmFja0xhbWJkYS5mdW5jdGlvbk5hbWUsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICAgIGVuYWJsZVhSYXkoYXJyaXZhbFJla29nbml0aW9uRm4pO1xyXG5cclxuICAgIGNvbnN0IGFycml2YWxSb2xlID0gYXJyaXZhbFJla29nbml0aW9uRm4ucm9sZSE7XHJcbiAgICBzZW5kRmVlZGJhY2tMYW1iZGEuZ3JhbnRJbnZva2UoYXJyaXZhbFJvbGUpO1xyXG4gICAgXHJcbiAgICBjb25zdCB2aXNpdG9yUHJlUmVnaXN0ZXJGbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgXCJWaXNpdG9yUHJlUmVnaXN0ZXJIYW5kbGVyXCIsIHtcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTEsXHJcbiAgICAgIGhhbmRsZXI6IFwiUHJlUmVnaXN0ZXJDaGVjay5QcmVSZWdpc3RlckNoZWNrXCIsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcImxhbWJkYVwiKSxcclxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxyXG4gICAgICB0cmFjaW5nOiBsYW1iZGEuVHJhY2luZy5BQ1RJVkUsXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgQlVDS0VUX05BTUU6IGZhY2lhbEJ1Y2tldC5idWNrZXROYW1lLFxyXG4gICAgICAgIENPTExFQ1RJT05fSUQ6IFJFS09HX0NPTExFQ1RJT05fSUQsXHJcbiAgICAgICAgVVNFUl9UQUJMRTogdXNlclRhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgICBCUk9BRENBU1RfTEFNQkRBOiBicm9hZGNhc3RMYW1iZGEuZnVuY3Rpb25Bcm4sXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICAgIGVuYWJsZVhSYXkodmlzaXRvclByZVJlZ2lzdGVyRm4pO1xyXG5cclxuICAgIGNvbnN0IHJlZ2lzdGVyVmlzaXRvckluZGl2aWR1YWxGbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgXCJSZWdpc3RlclZpc2l0b3JJbmRpdmlkdWFsSGFuZGxlclwiLCB7XHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzExLFxyXG4gICAgICBoYW5kbGVyOiBcIlJlZ2lzdGVySW5kaXZpZHVhbFZpc2l0b3IuaGFuZGxlclwiLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoXCJsYW1iZGFcIiksXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcclxuICAgICAgdHJhY2luZzogbGFtYmRhLlRyYWNpbmcuQUNUSVZFLFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIEZST05URU5EX1VSTDogZnJvbnRlbmRTdGFjay5kaXN0cmlidXRpb24uZG9tYWluTmFtZSxcclxuICAgICAgICBHTUFJTF9VU0VSOiAnYmFodHdpbm5vcmVwbHlAZ21haWwuY29tJywgICAgICAvLyBHbWFpbCBhZGRyZXNzIGZvciBzZW5kaW5nXHJcbiAgICAgICAgR01BSUxfUEFTUzogJ3pkamwgY2RndyBreHpiIG9rbnknLCAgICAgICAgLy8gR21haWwgYXBwIHBhc3N3b3JkXHJcbiAgICAgICAgSW52aXRlVGFibGU6IGludml0ZWRWaXNpdG9yVGFibGUudGFibGVOYW1lLFxyXG4gICAgICAgIEJST0FEQ0FTVF9MQU1CREE6IGJyb2FkY2FzdExhbWJkYS5mdW5jdGlvbkFybixcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG4gICAgZW5hYmxlWFJheShyZWdpc3RlclZpc2l0b3JJbmRpdmlkdWFsRm4pO1xyXG5cclxuICAgIGNvbnN0IHJlZ2lzdGVyVmlzaXRvckJ1bGtGbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgXCJSZWdpc3RlclZpc2l0b3JCdWxrSGFuZGxlclwiLCB7XHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzExLFxyXG4gICAgICBoYW5kbGVyOiBcIlJlZ2lzdGVyQnVsa1Zpc2l0b3IuaGFuZGxlclwiLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoXCJsYW1iZGFcIiksXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcclxuICAgICAgdHJhY2luZzogbGFtYmRhLlRyYWNpbmcuQUNUSVZFLFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIEZST05URU5EX1VSTDogZnJvbnRlbmRTdGFjay5kaXN0cmlidXRpb24uZG9tYWluTmFtZSxcclxuICAgICAgICBHTUFJTF9VU0VSOiAnXHRiYWh0d2lubm9yZXBseUBnbWFpbC5jb20nLCAgICAgIC8vIEdtYWlsIGFkZHJlc3MgZm9yIHNlbmRpbmdcclxuICAgICAgICBHTUFJTF9QQVNTOiAnemRqbCBjZGd3IGt4emIgb2tueScsICAgICAgICAvLyBHbWFpbCBhcHAgcGFzc3dvcmRcclxuICAgICAgICBJbnZpdGVUYWJsZTogaW52aXRlZFZpc2l0b3JUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgICAgQlJPQURDQVNUX0xBTUJEQTogYnJvYWRjYXN0TGFtYmRhLmZ1bmN0aW9uQXJuLFxyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcbiAgICBlbmFibGVYUmF5KHJlZ2lzdGVyVmlzaXRvckJ1bGtGbik7XHJcblxyXG4gICAgY29uc3QgbG9hZERhc2hib2FyZEZuID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCBcIkxvYWREYXNoYm9hcmRIYW5kbGVyVjJcIiwge1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMSxcclxuICAgICAgaGFuZGxlcjogXCJMb2FkRGFzaGJvYXJkLmhhbmRsZXJcIixcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KFwibGFtYmRhXCIpLFxyXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXHJcbiAgICAgIHRyYWNpbmc6IGxhbWJkYS5UcmFjaW5nLkFDVElWRSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICBJbnZpdGVUYWJsZTogaW52aXRlZFZpc2l0b3JUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgICAgVVNFUl9UQUJMRTogdXNlclRhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgICBXRUJTSVRFX0FDVElWSVRZX1RBQkxFOiB3ZWJzaXRlQWN0aXZpdHlUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICAgIGVuYWJsZVhSYXkobG9hZERhc2hib2FyZEZuKTtcclxuICAgIHVzZXJUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEobG9hZERhc2hib2FyZEZuKTtcclxuICAgIFxyXG5cclxuICAgIGNvbnN0IGdldEltYWdlVXJsRm4gPSBuZXcgTm9kZWpzRnVuY3Rpb24odGhpcywgXCJHZW5lcmF0ZVByZXNpZ25lZEltYWdlVXJsSGFuZGxlclYyXCIsIHtcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXHJcbiAgICAgIGVudHJ5OiBwYXRoLmpvaW4oX19kaXJuYW1lLCBcIi4uL2xhbWJkYS9nZW5lcmF0ZVByZXNpZ25lZERvd25sb2FkVXJsLnRzXCIpLFxyXG4gICAgICBoYW5kbGVyOiBcImhhbmRsZXJcIixcclxuICAgICAgYnVuZGxpbmc6IHsgdGFyZ2V0OiBcIm5vZGUxOFwiLCBtaW5pZnk6IHRydWUsIHNvdXJjZU1hcDogZmFsc2UgfSxcclxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxyXG4gICAgICB0cmFjaW5nOiBsYW1iZGEuVHJhY2luZy5BQ1RJVkUsXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgQlVDS0VUX05BTUU6IGZhY2lhbEJ1Y2tldC5idWNrZXROYW1lLFxyXG4gICAgICAgIFVTRVJfVEFCTEU6IHVzZXJUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICAgIGVuYWJsZVhSYXkoZ2V0SW1hZ2VVcmxGbik7XHJcblxyXG4gICAgY29uc3Qgd2Vic2l0ZUhlYXJ0YmVhdEZuID0gbmV3IE5vZGVqc0Z1bmN0aW9uKHRoaXMsIFwiV2Vic2l0ZUhlYXJ0YmVhdEhhbmRsZXJWMlwiLCB7XHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxyXG4gICAgICBlbnRyeTogcGF0aC5qb2luKF9fZGlybmFtZSwgXCIuLi9sYW1iZGEvaGVhcnRiZWF0LnRzXCIpLFxyXG4gICAgICBoYW5kbGVyOiBcImhhbmRsZXJcIixcclxuICAgICAgYnVuZGxpbmc6IHsgdGFyZ2V0OiBcIm5vZGUxOFwiLCBtaW5pZnk6IHRydWUsIHNvdXJjZU1hcDogZmFsc2UgfSxcclxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxyXG4gICAgICB0cmFjaW5nOiBsYW1iZGEuVHJhY2luZy5BQ1RJVkUsXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgV0VCU0lURV9BQ1RJVklUWV9UQUJMRTogd2Vic2l0ZUFjdGl2aXR5VGFibGUudGFibGVOYW1lLFxyXG4gICAgICAgIEJST0FEQ0FTVF9MQU1CREE6IGJyb2FkY2FzdExhbWJkYS5mdW5jdGlvbkFybixcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG4gICAgZW5hYmxlWFJheSh3ZWJzaXRlSGVhcnRiZWF0Rm4pO1xyXG5cclxuICAgIGNvbnN0IGdldFVzZXJCYWRnZUluZm9GbiA9IG5ldyBOb2RlanNGdW5jdGlvbih0aGlzLCBcIkdldFVzZXJCYWRnZUluZm9IYW5kbGVyVjJcIiwge1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICAgICAgZW50cnk6IHBhdGguam9pbihfX2Rpcm5hbWUsIFwiLi4vbGFtYmRhL2dldFVzZXJCYWRnZUluZm8udHNcIiksXHJcbiAgICAgIGhhbmRsZXI6IFwiaGFuZGxlclwiLFxyXG4gICAgICBidW5kbGluZzogeyB0YXJnZXQ6IFwibm9kZTE4XCIsIG1pbmlmeTogdHJ1ZSwgc291cmNlTWFwOiBmYWxzZSB9LFxyXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXHJcbiAgICAgIHRyYWNpbmc6IGxhbWJkYS5UcmFjaW5nLkFDVElWRSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICBVU0VSX1RBQkxFOiB1c2VyVGFibGUudGFibGVOYW1lLFxyXG4gICAgICAgIEJVQ0tFVF9OQU1FOiBmYWNpYWxCdWNrZXQuYnVja2V0TmFtZSxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG4gICAgZW5hYmxlWFJheShnZXRVc2VyQmFkZ2VJbmZvRm4pO1xyXG5cclxuICAgIGZhY2lhbEJ1Y2tldC5ncmFudFJlYWRXcml0ZShhcnJpdmFsUmVrb2duaXRpb25Gbik7XHJcbiAgICBmYWNpYWxCdWNrZXQuZ3JhbnRSZWFkV3JpdGUodmlzaXRvclByZVJlZ2lzdGVyRm4pO1xyXG4gICAgZmFjaWFsQnVja2V0LmdyYW50UmVhZChnZXRJbWFnZVVybEZuKTtcclxuICAgIGZhY2lhbEJ1Y2tldC5ncmFudFJlYWQoZ2V0VXNlckJhZGdlSW5mb0ZuKTtcclxuXHJcbiAgICB1c2VyVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGFycml2YWxSZWtvZ25pdGlvbkZuKTtcclxuICAgIHVzZXJUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEodmlzaXRvclByZVJlZ2lzdGVyRm4pO1xyXG4gICAgdXNlclRhYmxlLmdyYW50UmVhZERhdGEoZ2V0SW1hZ2VVcmxGbik7XHJcbiAgICB1c2VyVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGdldFVzZXJCYWRnZUluZm9Gbik7XHJcblxyXG4gICAgaW52aXRlZFZpc2l0b3JUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEocmVnaXN0ZXJWaXNpdG9ySW5kaXZpZHVhbEZuKTtcclxuICAgIGludml0ZWRWaXNpdG9yVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHJlZ2lzdGVyVmlzaXRvckJ1bGtGbik7XHJcbiAgICBpbnZpdGVkVmlzaXRvclRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShhcnJpdmFsUmVrb2duaXRpb25Gbik7XHJcbiAgICBpbnZpdGVkVmlzaXRvclRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShsb2FkRGFzaGJvYXJkRm4pO1xyXG5cclxuICAgIHdlYnNpdGVBY3Rpdml0eVRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShsb2FkRGFzaGJvYXJkRm4pO1xyXG4gICAgd2Vic2l0ZUFjdGl2aXR5VGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHdlYnNpdGVIZWFydGJlYXRGbik7XHJcblxyXG4gICAgZm9yIChjb25zdCBmbiBvZiBbdmlzaXRvclByZVJlZ2lzdGVyRm4sIGFycml2YWxSZWtvZ25pdGlvbkZuXSkge1xyXG4gICAgICBmbi5hZGRUb1JvbGVQb2xpY3koXHJcbiAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICAgICAgYWN0aW9uczogW1xyXG4gICAgICAgICAgICBcInJla29nbml0aW9uOkluZGV4RmFjZXNcIixcclxuICAgICAgICAgICAgXCJyZWtvZ25pdGlvbjpTZWFyY2hGYWNlc0J5SW1hZ2VcIixcclxuICAgICAgICAgICAgXCJyZWtvZ25pdGlvbjpEZXRlY3RGYWNlc1wiLFxyXG4gICAgICAgICAgXSxcclxuICAgICAgICAgIHJlc291cmNlczogW1wiKlwiXSxcclxuICAgICAgICB9KVxyXG4gICAgICApO1xyXG4gICAgfVxyXG5cclxuICAgIGFycml2YWxUb3BpYy5ncmFudFB1Ymxpc2goYXJyaXZhbFJla29nbml0aW9uRm4pO1xyXG4gICAgc2VuZEZlZWRiYWNrTGFtYmRhLmdyYW50SW52b2tlKGFycml2YWxSZWtvZ25pdGlvbkZuLnJvbGUhKTtcclxuXHJcbiAgICBicm9hZGNhc3RMYW1iZGEuZ3JhbnRJbnZva2UoYXJyaXZhbFJla29nbml0aW9uRm4ucm9sZSEpO1xyXG4gICAgYnJvYWRjYXN0TGFtYmRhLmdyYW50SW52b2tlKHZpc2l0b3JQcmVSZWdpc3RlckZuLnJvbGUhKTtcclxuICAgIGJyb2FkY2FzdExhbWJkYS5ncmFudEludm9rZShyZWdpc3RlclZpc2l0b3JJbmRpdmlkdWFsRm4ucm9sZSEpO1xyXG4gICAgYnJvYWRjYXN0TGFtYmRhLmdyYW50SW52b2tlKHJlZ2lzdGVyVmlzaXRvckJ1bGtGbi5yb2xlISk7XHJcbiAgICBicm9hZGNhc3RMYW1iZGEuZ3JhbnRJbnZva2Uod2Vic2l0ZUhlYXJ0YmVhdEZuLnJvbGUhKTtcclxuXHJcbiAgICBjb25zdCB2aXNpdG9yQXJyaXZhbFJlcyA9IHZpc2l0b3JSZXNvdXJjZS5hZGRSZXNvdXJjZShcImFycml2YWxcIik7XHJcbiAgICB2aXNpdG9yQXJyaXZhbFJlcy5hZGRNZXRob2QoXHJcbiAgICAgIFwiUE9TVFwiLFxyXG4gICAgICBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24oYXJyaXZhbFJla29nbml0aW9uRm4pLFxyXG4gICAgICBwdWJsaWNPcHRzXHJcbiAgICApO1xyXG5cclxuICAgIGNvbnN0IHZpc2l0b3JSZWdpc3RlclJlcyA9IHZpc2l0b3JSZXNvdXJjZS5hZGRSZXNvdXJjZShcInJlZ2lzdGVyXCIpO1xyXG4gICAgdmlzaXRvclJlZ2lzdGVyUmVzLmFkZE1ldGhvZChcclxuICAgICAgXCJQT1NUXCIsXHJcbiAgICAgIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbih2aXNpdG9yUHJlUmVnaXN0ZXJGbiksXHJcbiAgICAgIHB1YmxpY09wdHNcclxuICAgICk7XHJcblxyXG4gICAgY29uc3QgdmlzaXRvckdldEltYWdlVXJsUmVzID0gdmlzaXRvclJlc291cmNlLmFkZFJlc291cmNlKFwiZ2V0LWltYWdlLXVybFwiKTtcclxuICAgIHZpc2l0b3JHZXRJbWFnZVVybFJlcy5hZGRNZXRob2QoXHJcbiAgICAgIFwiR0VUXCIsXHJcbiAgICAgIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbihnZXRJbWFnZVVybEZuKSxcclxuICAgICAgcHVibGljT3B0c1xyXG4gICAgKTtcclxuXHJcbiAgICBjb25zdCB2aXNpdG9ySGVhcnRiZWF0UmVzID0gdmlzaXRvclJlc291cmNlLmFkZFJlc291cmNlKFwiaGVhcnRiZWF0XCIpO1xyXG4gICAgdmlzaXRvckhlYXJ0YmVhdFJlcy5hZGRNZXRob2QoXHJcbiAgICAgIFwiUE9TVFwiLFxyXG4gICAgICBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24od2Vic2l0ZUhlYXJ0YmVhdEZuKSxcclxuICAgICAgcHVibGljT3B0c1xyXG4gICAgKTtcclxuXHJcbiAgICBjb25zdCB2aXNpdG9yQmFkZ2VSZXMgPSB2aXNpdG9yUmVzb3VyY2UuYWRkUmVzb3VyY2UoXCJiYWRnZVwiKTtcclxuICAgIHZpc2l0b3JCYWRnZVJlcy5hZGRNZXRob2QoXHJcbiAgICAgIFwiUE9TVFwiLFxyXG4gICAgICBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24oZ2V0VXNlckJhZGdlSW5mb0ZuKSxcclxuICAgICAgcHVibGljT3B0c1xyXG4gICAgKTtcclxuXHJcbiAgICBjb25zdCBhZG1pblJlZ2lzdGVySW5kaXZpZHVhbFJlcyA9IGFkbWluUmVzb3VyY2UuYWRkUmVzb3VyY2UoXCJyZWdpc3RlclZpc2l0b3JJbmRpdmlkdWFsXCIpO1xyXG4gICAgYWRtaW5SZWdpc3RlckluZGl2aWR1YWxSZXMuYWRkTWV0aG9kKFxyXG4gICAgICBcIlBPU1RcIixcclxuICAgICAgbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKHJlZ2lzdGVyVmlzaXRvckluZGl2aWR1YWxGbiksXHJcbiAgICAgIGFkbWluT3B0c1xyXG4gICAgKTtcclxuXHJcbiAgICBjb25zdCBhZG1pblJlZ2lzdGVyQnVsa1JlcyA9IGFkbWluUmVzb3VyY2UuYWRkUmVzb3VyY2UoXCJyZWdpc3RlclZpc2l0b3JCdWxrXCIpO1xyXG4gICAgYWRtaW5SZWdpc3RlckJ1bGtSZXMuYWRkTWV0aG9kKFxyXG4gICAgICBcIlBPU1RcIixcclxuICAgICAgbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKHJlZ2lzdGVyVmlzaXRvckJ1bGtGbiksXHJcbiAgICAgIGFkbWluT3B0c1xyXG4gICAgKTtcclxuXHJcbiAgICBjb25zdCBhZG1pbkxvYWREYXNoYm9hcmRSZXMgPSBhZG1pblJlc291cmNlLmFkZFJlc291cmNlKFwibG9hZERhc2hib2FyZFwiKTtcclxuICAgIGFkbWluTG9hZERhc2hib2FyZFJlcy5hZGRNZXRob2QoXHJcbiAgICAgIFwiUE9TVFwiLFxyXG4gICAgICBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24obG9hZERhc2hib2FyZEZuKSxcclxuICAgICAgYWRtaW5PcHRzXHJcbiAgICApO1xyXG5cclxuICAgIC8vZ2V0IHVzZXIgaW5mbyBsYW1iZGFcclxuICAgIGNvbnN0IEdldFVzZXJJbmZvID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnR2V0VXNlckluZm8nLHtcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTEsXHJcbiAgICAgIGhhbmRsZXI6J0dldFVzZXJJbmZvLmhhbmRsZXInLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYScpLFxyXG4gICAgICBlbnZpcm9ubWVudDp7XHJcbiAgICAgICAgVVNFUl9UQUJMRTogdXNlclRhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgICBCVUNLRVRfTkFNRTogZmFjaWFsQnVja2V0LmJ1Y2tldE5hbWVcclxuICAgICAgfSxcclxuICAgICAgdGltZW91dDpjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXHJcbiAgICAgIC8vZnVuY3Rpb25OYW1lOiAnR2V0VXNlckluZm8nLCBcclxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX0RBWSwgLy8gPC0gQ0RLIHdpbGwgbWFuYWdlIHRoZSBsb2cgZ3JvdXBcclxuICAgIH0pO1xyXG4gICAgZmFjaWFsQnVja2V0LmdyYW50UmVhZChHZXRVc2VySW5mbyk7XHJcbiAgICBwcmVSZWdCdWNrZXQuZ3JhbnRSZWFkKEdldFVzZXJJbmZvKTtcclxuICAgIHVzZXJUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoR2V0VXNlckluZm8pO1xyXG5jb25zdCBnZXRVc2VySW5mbyA9IHZpc2l0b3JSZXNvdXJjZS5hZGRSZXNvdXJjZSgnbWUnKTtcclxuICAgIGdldFVzZXJJbmZvLmFkZE1ldGhvZCgnR0VUJyxuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24oR2V0VXNlckluZm8sIHsgXHJcbiAgICAgIHByb3h5OiB0cnVlIFxyXG4gICAgfSkpO1xyXG4gIH1cclxufVxyXG4iXX0=