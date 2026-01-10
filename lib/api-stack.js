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
class APIStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const prefixname = this.stackName.split('-')[0].toLowerCase();
        const wsStack = props.wsStack;
        const dbStack = props.dbStack;
        const bedrockStack = props.bedrockStack;
        const preRegBucket = dbStack.preRegBucket;
        const userTable = dbStack.userManagementTable;
        // Ensure DBStack is created before APIStack
        this.addDependency(dbStack);
        // ────────────────────────────────
        // ✅ X-RAY HELPER (one place, apply to all lambdas)
        // ────────────────────────────────
        const enableXRay = (fn) => {
            // Allow Lambda to send traces to X-Ray
            fn.role?.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("AWSXRayDaemonWriteAccess"));
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
                callbackUrls: ["http://localhost:3000/callback"],
                logoutUrls: ["http://localhost:3000/"],
                scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL],
            },
            supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
        });
        const cfnClient = userPoolClient.node.defaultChild;
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
            tracing: lambda.Tracing.ACTIVE,
        });
        enableXRay(helloFn);
        // ────────────────────────────────
        // 3. API Gateway + Cognito Authorizer
        // ────────────────────────────────
        const api = new apigw.RestApi(this, "UnityRestApi", {
            restApiName: `${prefixname}-Unity Service`,
            deployOptions: {
                stageName: "dev",
                tracingEnabled: true,
            },
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
        // ✅ FIX: no addTracing() in CDK. Use escape hatch to enable tracing.
        const bedrockCfnFn = bedrockStack.lambdaFunction.node.defaultChild;
        bedrockCfnFn.tracingConfig = { mode: "Active" };
        // ✅ Ensure bedrock lambda can publish traces too
        enableXRay(bedrockStack.lambdaFunction);
        const assistantResource = api.root.addResource("assistant");
        assistantResource.addCorsPreflight({
            allowOrigins: ["*"],
            allowMethods: ["POST"],
        });
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
        uploadImageResource.addCorsPreflight({
            allowOrigins: ["*"],
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
                COLLECTION_ID: `${prefixname}-VisitorFaceCollection`,
            },
            tracing: lambda.Tracing.ACTIVE,
        });
        enableXRay(preRegisterCheckFn);
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
        const usersGetFn = new aws_lambda_nodejs_1.NodejsFunction(this, "UsersGetHandler", {
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
        // Create users
        const usersCreateFn = new aws_lambda_nodejs_1.NodejsFunction(this, "UsersCreateHandler", {
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
        // Update users
        const usersUpdateFn = new aws_lambda_nodejs_1.NodejsFunction(this, "UsersUpdateHandler", {
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
        // Delete users
        const usersDeleteFn = new aws_lambda_nodejs_1.NodejsFunction(this, "UsersDeleteHandler", {
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
        dashboardResource.addCorsPreflight({
            allowOrigins: ["http://localhost:8080", "http://localhost:5173"],
            allowMethods: ["OPTIONS", "GET"],
            allowHeaders: ["Content-Type", "Authorization"],
        });
        dashboardResource.addMethod("GET", new apigw.LambdaIntegration(analyticsDashboardFn), {
            authorizer,
            authorizationType: apigw.AuthorizationType.COGNITO,
        });
    }
}
exports.APIStack = APIStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBpLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXBpLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBR25DLGlFQUFtRDtBQUNuRCxrRUFBb0Q7QUFDcEQsK0RBQWlEO0FBRWpELHlEQUEyQztBQUMzQyxxRUFBK0Q7QUFDL0QsMkNBQTZCO0FBVTdCLE1BQWEsUUFBUyxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3JDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBb0I7UUFDNUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7UUFFOUQsTUFBTSxPQUFPLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQztRQUM5QixNQUFNLE9BQU8sR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDO1FBQzlCLE1BQU0sWUFBWSxHQUFHLEtBQUssQ0FBQyxZQUFZLENBQUM7UUFFeEMsTUFBTSxZQUFZLEdBQUcsT0FBTyxDQUFDLFlBQVksQ0FBQztRQUMxQyxNQUFNLFNBQVMsR0FBRyxPQUFPLENBQUMsbUJBQW1CLENBQUM7UUFFOUMsNENBQTRDO1FBQzVDLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFNUIsbUNBQW1DO1FBQ25DLG1EQUFtRDtRQUNuRCxtQ0FBbUM7UUFDbkMsTUFBTSxVQUFVLEdBQUcsQ0FBQyxFQUFtQixFQUFFLEVBQUU7WUFDekMsdUNBQXVDO1lBQ3ZDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLENBQ3ZCLEdBQUcsQ0FBQyxhQUFhLENBQUMsd0JBQXdCLENBQUMsMEJBQTBCLENBQUMsQ0FDdkUsQ0FBQztRQUNKLENBQUMsQ0FB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QUMsQ0FBQztRQUU5RCxNQUFNLGlCQUFpQixHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQzVELE1BQU0saUJBQWlCLEdBQUcsaUJBQWlCLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBRXJFLGlCQUFpQixDQUFDLGdCQUFnQixDQUFDO1lBQ2pDLFlBQVksRUFBRSxDQUFDLHVCQUF1QixFQUFFLHVCQUF1QixDQUFDO1lBQ2hFLFlBQVksRUFBRSxDQUFDLFNBQVMsRUFBRSxLQUFLLENBQUM7WUFDaEMsWUFBWSxFQUFFLENBQUMsY0FBYyxFQUFFLGVBQWUsQ0FBQztTQUNoRCxDQUFDLENBQUM7UUFFSCxpQkFBaUIsQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLG9CQUFvQixDQUFDLEVBQUU7WUFDcEYsVUFBVTtZQUNWLGlCQUFpQixFQUFFLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPO1NBQ25ELENBQUMsQ0FBQztJQUdMLENBQUM7Q0FDRjtBQXBwQkQsNEJBb3BCQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tIFwiYXdzLWNkay1saWJcIjtcclxuaW1wb3J0IHsgREJTdGFjayB9IGZyb20gXCIuL0RCc3RhY2tcIjtcclxuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSBcImNvbnN0cnVjdHNcIjtcclxuaW1wb3J0ICogYXMgY29nbml0byBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWNvZ25pdG9cIjtcclxuaW1wb3J0ICogYXMgYXBpZ3cgZnJvbSBcImF3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5XCI7XHJcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWxhbWJkYVwiO1xyXG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiXCI7XHJcbmltcG9ydCAqIGFzIGlhbSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWlhbVwiO1xyXG5pbXBvcnQgeyBOb2RlanNGdW5jdGlvbiB9IGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtbGFtYmRhLW5vZGVqc1wiO1xyXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gXCJwYXRoXCI7XHJcbmltcG9ydCB7IEJlZHJvY2tTdGFjayB9IGZyb20gXCIuL2JlZHJvY2tfc3RhY2tcIjtcclxuaW1wb3J0IHsgVW5pdHlXZWJTb2NrZXRTdGFjayB9IGZyb20gXCIuL3VuaXR5LXdlYnNvY2tldC1zdGFja1wiO1xyXG5cclxuaW50ZXJmYWNlIEFQSVN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XHJcbiAgZGJTdGFjazogREJTdGFjaztcclxuICBiZWRyb2NrU3RhY2s6IEJlZHJvY2tTdGFjaztcclxuICB3c1N0YWNrOiBVbml0eVdlYlNvY2tldFN0YWNrO1xyXG59XHJcblxyXG5leHBvcnQgY2xhc3MgQVBJU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xyXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBBUElTdGFja1Byb3BzKSB7XHJcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcclxuXHJcbiAgICBjb25zdCBwcmVmaXhuYW1lID0gdGhpcy5zdGFja05hbWUuc3BsaXQoJy0nKVswXS50b0xvd2VyQ2FzZSgpO1xyXG5cclxuICAgIGNvbnN0IHdzU3RhY2sgPSBwcm9wcy53c1N0YWNrO1xyXG4gICAgY29uc3QgZGJTdGFjayA9IHByb3BzLmRiU3RhY2s7XHJcbiAgICBjb25zdCBiZWRyb2NrU3RhY2sgPSBwcm9wcy5iZWRyb2NrU3RhY2s7XHJcblxyXG4gICAgY29uc3QgcHJlUmVnQnVja2V0ID0gZGJTdGFjay5wcmVSZWdCdWNrZXQ7XHJcbiAgICBjb25zdCB1c2VyVGFibGUgPSBkYlN0YWNrLnVzZXJNYW5hZ2VtZW50VGFibGU7XHJcblxyXG4gICAgLy8gRW5zdXJlIERCU3RhY2sgaXMgY3JlYXRlZCBiZWZvcmUgQVBJU3RhY2tcclxuICAgIHRoaXMuYWRkRGVwZW5kZW5jeShkYlN0YWNrKTtcclxuXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIC8vIOKchSBYLVJBWSBIRUxQRVIgKG9uZSBwbGFjZSwgYXBwbHkgdG8gYWxsIGxhbWJkYXMpXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIGNvbnN0IGVuYWJsZVhSYXkgPSAoZm46IGxhbWJkYS5GdW5jdGlvbikgPT4ge1xyXG4gICAgICAvLyBBbGxvdyBMYW1iZGEgdG8gc2VuZCB0cmFjZXMgdG8gWC1SYXlcclxuICAgICAgZm4ucm9sZT8uYWRkTWFuYWdlZFBvbGljeShcclxuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoXCJBV1NYUmF5RGFlbW9uV3JpdGVBY2Nlc3NcIilcclxuICAgICAgKTtcclxuICAgIH07XHJcblxyXG4gICAgLy8gRHluYW1vREIgT3V0cHV0cyAoYWxyZWFkeSBwcmVzZW50KVxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJCYWh0d2luVGFibGVOYW1lXCIsIHtcclxuICAgICAgdmFsdWU6IGRiU3RhY2sudGFibGUudGFibGVOYW1lLFxyXG4gICAgICBkZXNjcmlwdGlvbjogXCJOYW1lIG9mIHRoZSBEeW5hbW9EQiB0YWJsZSB1c2VkIGJ5IEJBSFRXSU5cIixcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiQmFodHdpblRhYmxlQXJuXCIsIHtcclxuICAgICAgdmFsdWU6IGRiU3RhY2sudGFibGUudGFibGVBcm4sXHJcbiAgICAgIGRlc2NyaXB0aW9uOiBcIkFSTiBvZiB0aGUgRHluYW1vREIgdGFibGUgdXNlZCBieSBCQUhUV0lOXCIsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIC8vIDEuIENvZ25pdG8gVXNlciBQb29sXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIGNvbnN0IHVzZXJQb29sID0gbmV3IGNvZ25pdG8uVXNlclBvb2wodGhpcywgXCJVbml0eVVzZXJQb29sXCIsIHtcclxuICAgICAgdXNlclBvb2xOYW1lOiBgJHtwcmVmaXhuYW1lfS11bml0eS11c2Vyc2AsXHJcbiAgICAgIHNlbGZTaWduVXBFbmFibGVkOiB0cnVlLFxyXG4gICAgICBzaWduSW5BbGlhc2VzOiB7IGVtYWlsOiB0cnVlIH0sXHJcbiAgICAgIHN0YW5kYXJkQXR0cmlidXRlczoge1xyXG4gICAgICAgIGVtYWlsOiB7IHJlcXVpcmVkOiB0cnVlLCBtdXRhYmxlOiBmYWxzZSB9LFxyXG4gICAgICB9LFxyXG4gICAgICBwYXNzd29yZFBvbGljeToge1xyXG4gICAgICAgIG1pbkxlbmd0aDogOCxcclxuICAgICAgICByZXF1aXJlRGlnaXRzOiB0cnVlLFxyXG4gICAgICAgIHJlcXVpcmVMb3dlcmNhc2U6IHRydWUsXHJcbiAgICAgICAgcmVxdWlyZVVwcGVyY2FzZTogdHJ1ZSxcclxuICAgICAgICByZXF1aXJlU3ltYm9sczogZmFsc2UsXHJcbiAgICAgIH0sXHJcbiAgICAgIGFjY291bnRSZWNvdmVyeTogY29nbml0by5BY2NvdW50UmVjb3ZlcnkuRU1BSUxfT05MWSxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHBvc3RDb25maXJtRm4gPSBuZXcgTm9kZWpzRnVuY3Rpb24odGhpcywgXCJQb3N0Q29uZmlybVZpc2l0b3JIYW5kbGVyXCIsIHtcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXHJcbiAgICAgIGVudHJ5OiBwYXRoLmpvaW4oX19kaXJuYW1lLCBcIi4uL2xhbWJkYS9wb3N0LWNvbmZpcm0tdmlzaXRvci50c1wiKSxcclxuICAgICAgaGFuZGxlcjogXCJoYW5kbGVyXCIsXHJcbiAgICAgIGJ1bmRsaW5nOiB7XHJcbiAgICAgICAgdGFyZ2V0OiBcIm5vZGUxOFwiLFxyXG4gICAgICAgIG1pbmlmeTogdHJ1ZSxcclxuICAgICAgICBzb3VyY2VNYXA6IGZhbHNlLFxyXG4gICAgICB9LFxyXG4gICAgICB0cmFjaW5nOiBsYW1iZGEuVHJhY2luZy5BQ1RJVkUsXHJcbiAgICB9KTtcclxuICAgIGVuYWJsZVhSYXkocG9zdENvbmZpcm1Gbik7XHJcblxyXG4gICAgcG9zdENvbmZpcm1Gbi5hZGRUb1JvbGVQb2xpY3koXHJcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgICBhY3Rpb25zOiBbXCJjb2duaXRvLWlkcDpBZG1pbkFkZFVzZXJUb0dyb3VwXCJdLFxyXG4gICAgICAgIHJlc291cmNlczogW1wiKlwiXSxcclxuICAgICAgfSlcclxuICAgICk7XHJcblxyXG4gICAgdXNlclBvb2wuYWRkVHJpZ2dlcihjb2duaXRvLlVzZXJQb29sT3BlcmF0aW9uLlBPU1RfQ09ORklSTUFUSU9OLCBwb3N0Q29uZmlybUZuKTtcclxuXHJcbiAgICBjb25zdCB1c2VyUG9vbENsaWVudCA9IG5ldyBjb2duaXRvLlVzZXJQb29sQ2xpZW50KHRoaXMsIFwiVW5pdHlVc2VyUG9vbENsaWVudFYyXCIsIHtcclxuICAgICAgdXNlclBvb2wsXHJcbiAgICAgIGdlbmVyYXRlU2VjcmV0OiBmYWxzZSxcclxuICAgICAgYXV0aEZsb3dzOiB7IHVzZXJTcnA6IHRydWUsIHVzZXJQYXNzd29yZDogdHJ1ZSB9LFxyXG4gICAgICBvQXV0aDoge1xyXG4gICAgICAgIGZsb3dzOiB7XHJcbiAgICAgICAgICBhdXRob3JpemF0aW9uQ29kZUdyYW50OiB0cnVlLFxyXG4gICAgICAgICAgaW1wbGljaXRDb2RlR3JhbnQ6IHRydWUsXHJcbiAgICAgICAgfSxcclxuICAgICAgICBjYWxsYmFja1VybHM6IFtcImh0dHA6Ly9sb2NhbGhvc3Q6MzAwMC9jYWxsYmFja1wiXSxcclxuICAgICAgICBsb2dvdXRVcmxzOiBbXCJodHRwOi8vbG9jYWxob3N0OjMwMDAvXCJdLFxyXG4gICAgICAgIHNjb3BlczogW2NvZ25pdG8uT0F1dGhTY29wZS5PUEVOSUQsIGNvZ25pdG8uT0F1dGhTY29wZS5FTUFJTF0sXHJcbiAgICAgIH0sXHJcbiAgICAgIHN1cHBvcnRlZElkZW50aXR5UHJvdmlkZXJzOiBbY29nbml0by5Vc2VyUG9vbENsaWVudElkZW50aXR5UHJvdmlkZXIuQ09HTklUT10sXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBjZm5DbGllbnQgPSB1c2VyUG9vbENsaWVudC5ub2RlLmRlZmF1bHRDaGlsZCBhcyBjb2duaXRvLkNmblVzZXJQb29sQ2xpZW50O1xyXG4gICAgY2ZuQ2xpZW50LmFsbG93ZWRPQXV0aEZsb3dzVXNlclBvb2xDbGllbnQgPSB0cnVlO1xyXG4gICAgY2ZuQ2xpZW50LmFsbG93ZWRPQXV0aEZsb3dzID0gW1wiY29kZVwiLCBcImltcGxpY2l0XCJdO1xyXG4gICAgY2ZuQ2xpZW50LmFsbG93ZWRPQXV0aFNjb3BlcyA9IFtcIm9wZW5pZFwiLCBcImVtYWlsXCJdO1xyXG4gICAgY2ZuQ2xpZW50LnN1cHBvcnRlZElkZW50aXR5UHJvdmlkZXJzID0gW1wiQ09HTklUT1wiXTtcclxuXHJcbiAgICBuZXcgY29nbml0by5DZm5Vc2VyUG9vbEdyb3VwKHRoaXMsIFwiQWRtaW5Hcm91cFwiLCB7XHJcbiAgICAgIHVzZXJQb29sSWQ6IHVzZXJQb29sLnVzZXJQb29sSWQsXHJcbiAgICAgIGdyb3VwTmFtZTogXCJhZG1pblwiLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNvZ25pdG8uQ2ZuVXNlclBvb2xHcm91cCh0aGlzLCBcIk5ld0hpcmVHcm91cFwiLCB7XHJcbiAgICAgIHVzZXJQb29sSWQ6IHVzZXJQb29sLnVzZXJQb29sSWQsXHJcbiAgICAgIGdyb3VwTmFtZTogXCJuZXdoaXJlXCIsXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY29nbml0by5DZm5Vc2VyUG9vbEdyb3VwKHRoaXMsIFwiVmlzaXRvckdyb3VwXCIsIHtcclxuICAgICAgdXNlclBvb2xJZDogdXNlclBvb2wudXNlclBvb2xJZCxcclxuICAgICAgZ3JvdXBOYW1lOiBcInZpc2l0b3JcIixcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHVzZXJQb29sRG9tYWluID0gbmV3IGNvZ25pdG8uVXNlclBvb2xEb21haW4odGhpcywgXCJVbml0eVVzZXJQb29sRG9tYWluXCIsIHtcclxuICAgICAgdXNlclBvb2wsXHJcbiAgICAgIGNvZ25pdG9Eb21haW46IHsgZG9tYWluUHJlZml4OiBgJHtwcmVmaXhuYW1lfS11bml0eS0ke3RoaXMuYWNjb3VudH0tZGV2YCB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJVc2VyUG9vbElkXCIsIHsgdmFsdWU6IHVzZXJQb29sLnVzZXJQb29sSWQgfSk7XHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIlVzZXJQb29sQ2xpZW50SWRcIiwgeyB2YWx1ZTogdXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCB9KTtcclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiVXNlclBvb2xEb21haW5VcmxcIiwgeyB2YWx1ZTogdXNlclBvb2xEb21haW4uYmFzZVVybCgpIH0pO1xyXG5cclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgLy8gMi4gTGFtYmRhIEZ1bmN0aW9uIChoZWxsbylcclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgY29uc3QgaGVsbG9GbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgXCJIZWxsb0hhbmRsZXJcIiwge1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICAgICAgaGFuZGxlcjogXCJoZWxsby5oYW5kbGVyXCIsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcImxhbWJkYVwiKSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICBUQUJMRV9OQU1FOiBkYlN0YWNrLnRhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgICBVU0VSX1BPT0xfSUQ6IHVzZXJQb29sLnVzZXJQb29sSWQsXHJcbiAgICAgIH0sXHJcbiAgICAgIHRyYWNpbmc6IGxhbWJkYS5UcmFjaW5nLkFDVElWRSxcclxuICAgIH0pO1xyXG4gICAgZW5hYmxlWFJheShoZWxsb0ZuKTtcclxuXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIC8vIDMuIEFQSSBHYXRld2F5ICsgQ29nbml0byBBdXRob3JpemVyXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIGNvbnN0IGFwaSA9IG5ldyBhcGlndy5SZXN0QXBpKHRoaXMsIFwiVW5pdHlSZXN0QXBpXCIsIHtcclxuICAgICAgcmVzdEFwaU5hbWU6IGAke3ByZWZpeG5hbWV9LVVuaXR5IFNlcnZpY2VgLFxyXG4gICAgICBkZXBsb3lPcHRpb25zOiB7XHJcbiAgICAgICAgc3RhZ2VOYW1lOiBcImRldlwiLFxyXG4gICAgICAgIHRyYWNpbmdFbmFibGVkOiB0cnVlLFxyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgYXV0aG9yaXplciA9IG5ldyBhcGlndy5Db2duaXRvVXNlclBvb2xzQXV0aG9yaXplcih0aGlzLCBcIlVuaXR5Q29nbml0b0F1dGhvcml6ZXJcIiwge1xyXG4gICAgICBjb2duaXRvVXNlclBvb2xzOiBbdXNlclBvb2xdLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgaGVsbG9SZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKFwiaGVsbG9cIik7XHJcbiAgICBoZWxsb1Jlc291cmNlLmFkZE1ldGhvZChcIkdFVFwiLCBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24oaGVsbG9GbiksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWd3LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIlVuaXR5QXBpVXJsXCIsIHsgdmFsdWU6IGFwaS51cmwgfSk7XHJcblxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICAvLyB3aG9hbWlcclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgY29uc3Qgd2hvYW1pRm4gPSBuZXcgTm9kZWpzRnVuY3Rpb24odGhpcywgXCJXaG9BbUlIYW5kbGVyXCIsIHtcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXHJcbiAgICAgIGVudHJ5OiBwYXRoLmpvaW4oX19kaXJuYW1lLCBcIi4uL2xhbWJkYS93aG9hbWkudHNcIiksXHJcbiAgICAgIGhhbmRsZXI6IFwiaGFuZGxlclwiLFxyXG4gICAgICBidW5kbGluZzoge1xyXG4gICAgICAgIHRhcmdldDogXCJub2RlMThcIixcclxuICAgICAgICBtaW5pZnk6IHRydWUsXHJcbiAgICAgICAgc291cmNlTWFwOiBmYWxzZSxcclxuICAgICAgfSxcclxuICAgICAgdHJhY2luZzogbGFtYmRhLlRyYWNpbmcuQUNUSVZFLFxyXG4gICAgfSk7XHJcbiAgICBlbmFibGVYUmF5KHdob2FtaUZuKTtcclxuXHJcbiAgICBjb25zdCB3aG9hbWlSZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKFwid2hvYW1pXCIpO1xyXG4gICAgd2hvYW1pUmVzb3VyY2UuYWRkTWV0aG9kKFwiR0VUXCIsIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbih3aG9hbWlGbiksIHtcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWd3LkF1dGhvcml6YXRpb25UeXBlLk5PTkUsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIC8vIHNldC1yb2xlXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIGNvbnN0IHNldFJvbGVGbiA9IG5ldyBOb2RlanNGdW5jdGlvbih0aGlzLCBcIlNldFJvbGVIYW5kbGVyXCIsIHtcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXHJcbiAgICAgIGVudHJ5OiBwYXRoLmpvaW4oX19kaXJuYW1lLCBcIi4uL2xhbWJkYS9zZXQtcm9sZS50c1wiKSxcclxuICAgICAgaGFuZGxlcjogXCJoYW5kbGVyXCIsXHJcbiAgICAgIGJ1bmRsaW5nOiB7XHJcbiAgICAgICAgdGFyZ2V0OiBcIm5vZGUxOFwiLFxyXG4gICAgICAgIG1pbmlmeTogdHJ1ZSxcclxuICAgICAgICBzb3VyY2VNYXA6IGZhbHNlLFxyXG4gICAgICB9LFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIFVTRVJfUE9PTF9JRDogdXNlclBvb2wudXNlclBvb2xJZCxcclxuICAgICAgfSxcclxuICAgICAgdHJhY2luZzogbGFtYmRhLlRyYWNpbmcuQUNUSVZFLFxyXG4gICAgfSk7XHJcbiAgICBlbmFibGVYUmF5KHNldFJvbGVGbik7XHJcblxyXG4gICAgc2V0Um9sZUZuLmFkZFRvUm9sZVBvbGljeShcclxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICAgIGFjdGlvbnM6IFtcclxuICAgICAgICAgIFwiY29nbml0by1pZHA6QWRtaW5BZGRVc2VyVG9Hcm91cFwiLFxyXG4gICAgICAgICAgXCJjb2duaXRvLWlkcDpBZG1pblJlbW92ZVVzZXJGcm9tR3JvdXBcIixcclxuICAgICAgICAgIFwiY29nbml0by1pZHA6QWRtaW5MaXN0R3JvdXBzRm9yVXNlclwiLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgcmVzb3VyY2VzOiBbXCIqXCJdLFxyXG4gICAgICB9KVxyXG4gICAgKTtcclxuXHJcbiAgICBjb25zdCByb2xlUmVzb3VyY2UgPSBhcGkucm9vdC5hZGRSZXNvdXJjZShcInJvbGVcIik7XHJcbiAgICByb2xlUmVzb3VyY2UuYWRkTWV0aG9kKFwiUE9TVFwiLCBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24oc2V0Um9sZUZuKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ3cuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgLy8gUGx1Z0FjdGlvbnNcclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgY29uc3QgcGx1Z0FjdGlvbnNUYWJsZTogZHluYW1vZGIuVGFibGUgPSBkYlN0YWNrLnBsdWdBY3Rpb25zVGFibGU7XHJcblxyXG4gICAgY29uc3QgcGx1Z0NvbnRyb2xGbiA9IG5ldyBOb2RlanNGdW5jdGlvbih0aGlzLCBcIlBsdWdDb250cm9sSGFuZGxlclwiLCB7XHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxyXG4gICAgICBlbnRyeTogcGF0aC5qb2luKF9fZGlybmFtZSwgXCIuLi9sYW1iZGEvcGx1Zy1jb250cm9sLnRzXCIpLFxyXG4gICAgICBoYW5kbGVyOiBcImhhbmRsZXJcIixcclxuICAgICAgYnVuZGxpbmc6IHtcclxuICAgICAgICB0YXJnZXQ6IFwibm9kZTE4XCIsXHJcbiAgICAgICAgbWluaWZ5OiB0cnVlLFxyXG4gICAgICAgIHNvdXJjZU1hcDogZmFsc2UsXHJcbiAgICAgIH0sXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgUExVR19BQ1RJT05TX1RBQkxFOiBwbHVnQWN0aW9uc1RhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgICBWT0lDRV9NT05LRVlfQkFTRV9VUkw6IFwiaHR0cHM6Ly9hcGktdjIudm9pY2Vtb25rZXkuaW8vdHJpZ2dlclwiLFxyXG4gICAgICAgIFZPSUNFX01PTktFWV9UT0tFTjpcclxuICAgICAgICAgIFwiODgxYjE3YjNiNzk4ODAyMTg3ZDQxMzNkMmNmNDA4NzVfNjI0MmQ0MWU2MDRlZWM5ZTVkNTliNzEzYzNlNzUxZTdcIixcclxuICAgICAgICBQTFVHX0RFVklDRV9NQVA6IEpTT04uc3RyaW5naWZ5KHtcclxuICAgICAgICAgIHBsdWcxOiB7IG9uOiBcInR1cm5vbnBsdWdvbmVcIiwgb2ZmOiBcInR1cm5vZmZwbHVnb25lXCIgfSxcclxuICAgICAgICAgIHBsdWcyOiB7IG9uOiBcInR1cm5vbnBsdWd0d29cIiwgb2ZmOiBcInR1cm5vZmZwbHVndHdvXCIgfSxcclxuICAgICAgICB9KSxcclxuICAgICAgICBDT09MRE9XTl9TRUNPTkRTOiBcIjMwXCIsXHJcblxyXG4gICAgICAgIFdTX0NPTk5FQ1RJT05TX1RBQkxFOiB3c1N0YWNrLmNvbm5lY3Rpb25zVGFibGUudGFibGVOYW1lLFxyXG4gICAgICAgIFdTX01BTkFHRU1FTlRfRU5EUE9JTlQ6IHdzU3RhY2subWFuYWdlbWVudEVuZHBvaW50LFxyXG4gICAgICB9LFxyXG4gICAgICB0cmFjaW5nOiBsYW1iZGEuVHJhY2luZy5BQ1RJVkUsXHJcbiAgICB9KTtcclxuICAgIGVuYWJsZVhSYXkocGx1Z0NvbnRyb2xGbik7XHJcblxyXG4gICAgcGx1Z0FjdGlvbnNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEocGx1Z0NvbnRyb2xGbik7XHJcbiAgICB3c1N0YWNrLmNvbm5lY3Rpb25zVGFibGUuZ3JhbnRSZWFkRGF0YShwbHVnQ29udHJvbEZuKTtcclxuXHJcbiAgICBwbHVnQ29udHJvbEZuLmFkZFRvUm9sZVBvbGljeShcclxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICAgIGFjdGlvbnM6IFtcImV4ZWN1dGUtYXBpOk1hbmFnZUNvbm5lY3Rpb25zXCJdLFxyXG4gICAgICAgIHJlc291cmNlczogW1xyXG4gICAgICAgICAgYGFybjphd3M6ZXhlY3V0ZS1hcGk6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OiR7d3NTdGFjay53ZWJTb2NrZXRBcGkuYXBpSWR9LyR7d3NTdGFjay5zdGFnZS5zdGFnZU5hbWV9LyovQGNvbm5lY3Rpb25zLypgLFxyXG4gICAgICAgIF0sXHJcbiAgICAgIH0pXHJcbiAgICApO1xyXG5cclxuICAgIGNvbnN0IHBsdWdzUmVzb3VyY2UgPSBhcGkucm9vdC5hZGRSZXNvdXJjZShcInBsdWdzXCIpO1xyXG4gICAgcGx1Z3NSZXNvdXJjZS5hZGRNZXRob2QoXCJQT1NUXCIsIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbihwbHVnQ29udHJvbEZuKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ3cuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgLy8gVGVsZW1ldHJ5IHF1ZXJ5XHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIGNvbnN0IGlvdFRlbGVtZXRyeVRhYmxlOiBkeW5hbW9kYi5UYWJsZSA9IGRiU3RhY2suaW90VGVsZW1ldHJ5VGFibGU7XHJcblxyXG4gICAgY29uc3QgdGVsZW1ldHJ5UXVlcnlGbiA9IG5ldyBOb2RlanNGdW5jdGlvbih0aGlzLCBcIlRlbGVtZXRyeVF1ZXJ5SGFuZGxlclwiLCB7XHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxyXG4gICAgICBlbnRyeTogcGF0aC5qb2luKF9fZGlybmFtZSwgXCIuLi9sYW1iZGEvdGVsZW1ldHJ5LXF1ZXJ5LnRzXCIpLFxyXG4gICAgICBoYW5kbGVyOiBcImhhbmRsZXJcIixcclxuICAgICAgYnVuZGxpbmc6IHtcclxuICAgICAgICB0YXJnZXQ6IFwibm9kZTE4XCIsXHJcbiAgICAgICAgbWluaWZ5OiB0cnVlLFxyXG4gICAgICAgIHNvdXJjZU1hcDogZmFsc2UsXHJcbiAgICAgIH0sXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgVEVMRU1FVFJZX1RBQkxFOiBpb3RUZWxlbWV0cnlUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgIH0sXHJcbiAgICAgIHRyYWNpbmc6IGxhbWJkYS5UcmFjaW5nLkFDVElWRSxcclxuICAgIH0pO1xyXG4gICAgZW5hYmxlWFJheSh0ZWxlbWV0cnlRdWVyeUZuKTtcclxuXHJcbiAgICBpb3RUZWxlbWV0cnlUYWJsZS5ncmFudFJlYWREYXRhKHRlbGVtZXRyeVF1ZXJ5Rm4pO1xyXG5cclxuICAgIGNvbnN0IHRlbGVtZXRyeVJlc291cmNlID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoXCJ0ZWxlbWV0cnlcIik7XHJcbiAgICB0ZWxlbWV0cnlSZXNvdXJjZS5hZGRNZXRob2QoXCJHRVRcIiwgbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKHRlbGVtZXRyeVF1ZXJ5Rm4pLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlndy5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICAvLyBBbGV4YSBUZWxlbWV0cnkgQ29udHJvbGxlclxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICBjb25zdCBhbGV4YVRlbGVtZXRyeUZuID0gbmV3IE5vZGVqc0Z1bmN0aW9uKHRoaXMsIFwiQWxleGFUZWxlbWV0cnlIYW5kbGVyXCIsIHtcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXHJcbiAgICAgIGVudHJ5OiBwYXRoLmpvaW4oX19kaXJuYW1lLCBcIi4uL2xhbWJkYS9hbGV4YS10ZWxlbWV0cnkudHNcIiksXHJcbiAgICAgIGhhbmRsZXI6IFwiaGFuZGxlclwiLFxyXG4gICAgICBidW5kbGluZzogeyB0YXJnZXQ6IFwibm9kZTE4XCIsIG1pbmlmeTogdHJ1ZSwgc291cmNlTWFwOiBmYWxzZSB9LFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIFRFTEVNRVRSWV9UQUJMRTogaW90VGVsZW1ldHJ5VGFibGUudGFibGVOYW1lLFxyXG4gICAgICAgIEJBU0lDX1VTRVI6IFwiYWxleGFcIixcclxuICAgICAgICBCQVNJQ19QQVNTOiBcImFMOVF4N1AybVI0Wks4d0VcIixcclxuICAgICAgfSxcclxuICAgICAgdHJhY2luZzogbGFtYmRhLlRyYWNpbmcuQUNUSVZFLFxyXG4gICAgfSk7XHJcbiAgICBlbmFibGVYUmF5KGFsZXhhVGVsZW1ldHJ5Rm4pO1xyXG5cclxuICAgIGlvdFRlbGVtZXRyeVRhYmxlLmdyYW50UmVhZERhdGEoYWxleGFUZWxlbWV0cnlGbik7XHJcblxyXG4gICAgY29uc3QgYWxleGFSZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKFwiYWxleGFcIik7XHJcblxyXG4gICAgY29uc3QgcHVibGljTWV0aG9kT3B0aW9uczogYXBpZ3cuTWV0aG9kT3B0aW9ucyA9IHtcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWd3LkF1dGhvcml6YXRpb25UeXBlLk5PTkUsXHJcbiAgICAgIGFwaUtleVJlcXVpcmVkOiBmYWxzZSxcclxuICAgIH07XHJcblxyXG4gICAgYWxleGFSZXNvdXJjZVxyXG4gICAgICAuYWRkUmVzb3VyY2UoXCJodFwiKVxyXG4gICAgICAuYWRkUmVzb3VyY2UoXCJsYXRlc3RcIilcclxuICAgICAgLmFkZE1ldGhvZChcIkdFVFwiLCBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24oYWxleGFUZWxlbWV0cnlGbiksIHB1YmxpY01ldGhvZE9wdGlvbnMpO1xyXG5cclxuICAgIGFsZXhhUmVzb3VyY2VcclxuICAgICAgLmFkZFJlc291cmNlKFwicGFya2luZ1wiKVxyXG4gICAgICAuYWRkUmVzb3VyY2UoXCJsYXRlc3RcIilcclxuICAgICAgLmFkZE1ldGhvZChcIkdFVFwiLCBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24oYWxleGFUZWxlbWV0cnlGbiksIHB1YmxpY01ldGhvZE9wdGlvbnMpO1xyXG5cclxuICAgIGFsZXhhUmVzb3VyY2VcclxuICAgICAgLmFkZFJlc291cmNlKFwic3VtbWFyeVwiKVxyXG4gICAgICAuYWRkTWV0aG9kKFwiR0VUXCIsIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbihhbGV4YVRlbGVtZXRyeUZuKSwgcHVibGljTWV0aG9kT3B0aW9ucyk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJBbGV4YUh0TGF0ZXN0VXJsXCIsIHsgdmFsdWU6IGFwaS51cmwgKyBcImFsZXhhL2h0L2xhdGVzdFwiIH0pO1xyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJBbGV4YVBhcmtpbmdMYXRlc3RVcmxcIiwgeyB2YWx1ZTogYXBpLnVybCArIFwiYWxleGEvcGFya2luZy9sYXRlc3RcIiB9KTtcclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiQWxleGFTdW1tYXJ5VXJsXCIsIHsgdmFsdWU6IGFwaS51cmwgKyBcImFsZXhhL3N1bW1hcnlcIiB9KTtcclxuXHJcbiAgICBwbHVnc1Jlc291cmNlLmFkZENvcnNQcmVmbGlnaHQoe1xyXG4gICAgICBhbGxvd09yaWdpbnM6IFtcImh0dHA6Ly9sb2NhbGhvc3Q6ODA4MFwiLCBcImh0dHA6Ly9sb2NhbGhvc3Q6NTE3M1wiXSxcclxuICAgICAgYWxsb3dNZXRob2RzOiBbXCJPUFRJT05TXCIsIFwiUE9TVFwiXSxcclxuICAgICAgYWxsb3dIZWFkZXJzOiBbXCJDb250ZW50LVR5cGVcIiwgXCJBdXRob3JpemF0aW9uXCJdLFxyXG4gICAgfSk7XHJcblxyXG4gICAgdGVsZW1ldHJ5UmVzb3VyY2UuYWRkQ29yc1ByZWZsaWdodCh7XHJcbiAgICAgIGFsbG93T3JpZ2luczogW1wiaHR0cDovL2xvY2FsaG9zdDo4MDgwXCIsIFwiaHR0cDovL2xvY2FsaG9zdDo1MTczXCJdLFxyXG4gICAgICBhbGxvd01ldGhvZHM6IFtcIk9QVElPTlNcIiwgXCJHRVRcIl0sXHJcbiAgICAgIGFsbG93SGVhZGVyczogW1wiQ29udGVudC1UeXBlXCIsIFwiQXV0aG9yaXphdGlvblwiXSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgLy8gV2hhdHNBcHAgQm90IChDbG91ZCBBUEkpIOKAlCB3ZWJob29rXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIGNvbnN0IHdoYXRzYXBwQm90Rm4gPSBuZXcgTm9kZWpzRnVuY3Rpb24odGhpcywgXCJXaGF0c0FwcEJvdEhhbmRsZXJcIiwge1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICAgICAgZW50cnk6IHBhdGguam9pbihfX2Rpcm5hbWUsIFwiLi4vbGFtYmRhL3doYXRzYXBwLWJvdC50c1wiKSxcclxuICAgICAgaGFuZGxlcjogXCJoYW5kbGVyXCIsXHJcbiAgICAgIGJ1bmRsaW5nOiB7IHRhcmdldDogXCJub2RlMThcIiwgbWluaWZ5OiB0cnVlLCBzb3VyY2VNYXA6IGZhbHNlIH0sXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgVEVMRU1FVFJZX1RBQkxFOiBpb3RUZWxlbWV0cnlUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgICAgV0hBVFNBUFBfVE9LRU46XHJcbiAgICAgICAgICBcIkVBQUsybzR5MXd1b0JRV3gxOFBvSzl5bXR6T3paQXVaQldhWkJleGR3a2RyUzYwZTJrc2VXaURiRnplaHNoS0NWOWVJUU9iRmdIamU0YlJBdkpDTTZsdm44V1AzcVFxM2tWcWFrZUVZS0N6b29BaW5GWWlsbFpBTGhrblJJcWNaQnhndDBBNlk1UFVXNTZoSnY0UlZzWkJ0V1FKMVNRc2pXaWJ6Ukw0ekhYQ1Vlc0dyeUtZZG1EVnNjUThGemFOS2ZaQ2tkeGJOT0ZhQ2ZaQTdVWU9ZNWJGY2dUbVhVUUNSMGlkMlpCOUxHNVZjVVJnSWYyalhPZWpEV1pDY0NiVWRPOFpBT2ZhOFV3NVpBSVpCdmtBNTFIeVJRQ0tWQzJcIixcclxuICAgICAgICBQSE9ORV9OVU1CRVJfSUQ6IFwiODgzODgwODI0ODEzNjA1XCIsXHJcbiAgICAgICAgVkVSSUZZX1RPS0VOOiBcInBhcmtpbmdib3RfdmVyaWZ5XCIsXHJcbiAgICAgICAgQUxMT1dMSVNUX0UxNjQ6IFwiKzk3MzM4MDA2NDQ4XCIsXHJcbiAgICAgIH0sXHJcbiAgICAgIHRyYWNpbmc6IGxhbWJkYS5UcmFjaW5nLkFDVElWRSxcclxuICAgIH0pO1xyXG4gICAgZW5hYmxlWFJheSh3aGF0c2FwcEJvdEZuKTtcclxuXHJcbiAgICBpb3RUZWxlbWV0cnlUYWJsZS5ncmFudFJlYWREYXRhKHdoYXRzYXBwQm90Rm4pO1xyXG5cclxuICAgIGNvbnN0IHdoYXRzYXBwUmVzb3VyY2UgPSBhcGkucm9vdC5hZGRSZXNvdXJjZShcIndoYXRzYXBwXCIpO1xyXG4gICAgY29uc3Qgd2ViaG9va1Jlc291cmNlID0gd2hhdHNhcHBSZXNvdXJjZS5hZGRSZXNvdXJjZShcIndlYmhvb2tcIik7XHJcblxyXG4gICAgd2ViaG9va1Jlc291cmNlLmFkZE1ldGhvZChcIkdFVFwiLCBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24od2hhdHNhcHBCb3RGbiksIHB1YmxpY01ldGhvZE9wdGlvbnMpO1xyXG4gICAgd2ViaG9va1Jlc291cmNlLmFkZE1ldGhvZChcIlBPU1RcIiwgbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKHdoYXRzYXBwQm90Rm4pLCBwdWJsaWNNZXRob2RPcHRpb25zKTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIldoYXRzQXBwV2ViaG9va1VybFwiLCB7IHZhbHVlOiBhcGkudXJsICsgXCJ3aGF0c2FwcC93ZWJob29rXCIgfSk7XHJcblxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICAvLyBWaXJ0dWFsIEFzc2lzdGFudCBBUEkgcm91dGUgKEJlZHJvY2spXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIC8vIOKchSBGSVg6IG5vIGFkZFRyYWNpbmcoKSBpbiBDREsuIFVzZSBlc2NhcGUgaGF0Y2ggdG8gZW5hYmxlIHRyYWNpbmcuXHJcbiAgICBjb25zdCBiZWRyb2NrQ2ZuRm4gPSBiZWRyb2NrU3RhY2subGFtYmRhRnVuY3Rpb24ubm9kZS5kZWZhdWx0Q2hpbGQgYXMgbGFtYmRhLkNmbkZ1bmN0aW9uO1xyXG4gICAgYmVkcm9ja0NmbkZuLnRyYWNpbmdDb25maWcgPSB7IG1vZGU6IFwiQWN0aXZlXCIgfTtcclxuXHJcbiAgICAvLyDinIUgRW5zdXJlIGJlZHJvY2sgbGFtYmRhIGNhbiBwdWJsaXNoIHRyYWNlcyB0b29cclxuICAgIGVuYWJsZVhSYXkoYmVkcm9ja1N0YWNrLmxhbWJkYUZ1bmN0aW9uKTtcclxuXHJcbiAgICBjb25zdCBhc3Npc3RhbnRSZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKFwiYXNzaXN0YW50XCIpO1xyXG5cclxuICAgIGFzc2lzdGFudFJlc291cmNlLmFkZENvcnNQcmVmbGlnaHQoe1xyXG4gICAgICBhbGxvd09yaWdpbnM6IFtcIipcIl0sXHJcbiAgICAgIGFsbG93TWV0aG9kczogW1wiUE9TVFwiXSxcclxuICAgIH0pO1xyXG5cclxuICAgIGFzc2lzdGFudFJlc291cmNlLmFkZE1ldGhvZChcIlBPU1RcIiwgbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKGJlZHJvY2tTdGFjay5sYW1iZGFGdW5jdGlvbikpO1xyXG5cclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgLy8gUHJlLVJlZ2lzdHJhdGlvbjogUHJlc2lnbmVkIFVwbG9hZCArIFZhbGlkYXRlIEltYWdlICsgUHJlc2lnbmVkIERvd25sb2FkXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIGNvbnN0IGdlbmVyYXRlUHJlc2lnbmVkVXJsRm4gPSBuZXcgTm9kZWpzRnVuY3Rpb24odGhpcywgXCJHZW5lcmF0ZVByZXNpZ25lZFVybEhhbmRsZXJcIiwge1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcclxuICAgICAgZW50cnk6IHBhdGguam9pbihfX2Rpcm5hbWUsIFwiLi4vbGFtYmRhL2dlbmVyYXRlUHJlc2lnbmVkVXBsb2FkVXJsLnRzXCIpLFxyXG4gICAgICBoYW5kbGVyOiBcImhhbmRsZXJcIixcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICBCVUNLRVRfTkFNRTogcHJlUmVnQnVja2V0LmJ1Y2tldE5hbWUsXHJcbiAgICAgIH0sXHJcbiAgICAgIHRyYWNpbmc6IGxhbWJkYS5UcmFjaW5nLkFDVElWRSxcclxuICAgIH0pO1xyXG4gICAgZW5hYmxlWFJheShnZW5lcmF0ZVByZXNpZ25lZFVybEZuKTtcclxuXHJcbiAgICBwcmVSZWdCdWNrZXQuZ3JhbnRSZWFkV3JpdGUoZ2VuZXJhdGVQcmVzaWduZWRVcmxGbik7XHJcblxyXG4gICAgY29uc3QgdXBsb2FkSW1hZ2VSZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKFwidXBsb2FkLWltYWdlXCIpO1xyXG5cclxuICAgIHVwbG9hZEltYWdlUmVzb3VyY2UuYWRkQ29yc1ByZWZsaWdodCh7XHJcbiAgICAgIGFsbG93T3JpZ2luczogW1wiKlwiXSxcclxuICAgICAgYWxsb3dNZXRob2RzOiBbXCJQT1NUXCJdLFxyXG4gICAgfSk7XHJcblxyXG4gICAgdXBsb2FkSW1hZ2VSZXNvdXJjZS5hZGRNZXRob2QoXCJQT1NUXCIsIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbihnZW5lcmF0ZVByZXNpZ25lZFVybEZuKSwge1xyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ3cuQXV0aG9yaXphdGlvblR5cGUuTk9ORSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFZhbGlkYXRlIGltYWdlIChQeXRob24gbGFtYmRhKVxyXG4gICAgY29uc3QgcHJlUmVnaXN0ZXJDaGVja0ZuID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCBcIlByZVJlZ2lzdGVyQ2hlY2tIYW5kbGVyXCIsIHtcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfOSxcclxuICAgICAgaGFuZGxlcjogXCJQcmVSZWdpc3RlckNoZWNrLmhhbmRsZXJcIixcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KFwibGFtYmRhXCIpLFxyXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgQlVDS0VUX05BTUU6IHByZVJlZ0J1Y2tldC5idWNrZXROYW1lLFxyXG4gICAgICAgIFVTRVJfTUFOQUdFTUVOVF9UQUJMRTogdXNlclRhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgICBDT0xMRUNUSU9OX0lEOiBgJHtwcmVmaXhuYW1lfS1WaXNpdG9yRmFjZUNvbGxlY3Rpb25gLFxyXG4gICAgICB9LFxyXG4gICAgICB0cmFjaW5nOiBsYW1iZGEuVHJhY2luZy5BQ1RJVkUsXHJcbiAgICB9KTtcclxuICAgIGVuYWJsZVhSYXkocHJlUmVnaXN0ZXJDaGVja0ZuKTtcclxuXHJcbiAgICBwcmVSZWdCdWNrZXQuZ3JhbnRSZWFkV3JpdGUocHJlUmVnaXN0ZXJDaGVja0ZuKTtcclxuICAgIHVzZXJUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEocHJlUmVnaXN0ZXJDaGVja0ZuKTtcclxuXHJcbiAgICBjb25zdCB2YWxpZGF0ZUltYWdlUmVzb3VyY2UgPSBhcGkucm9vdC5hZGRSZXNvdXJjZShcInZhbGlkYXRlLWltYWdlXCIpO1xyXG5cclxuICAgIHZhbGlkYXRlSW1hZ2VSZXNvdXJjZS5hZGRDb3JzUHJlZmxpZ2h0KHtcclxuICAgICAgYWxsb3dPcmlnaW5zOiBbXCIqXCJdLFxyXG4gICAgICBhbGxvd01ldGhvZHM6IFtcIlBPU1RcIl0sXHJcbiAgICB9KTtcclxuXHJcbiAgICB2YWxpZGF0ZUltYWdlUmVzb3VyY2UuYWRkTWV0aG9kKFwiUE9TVFwiLCBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24ocHJlUmVnaXN0ZXJDaGVja0ZuKSwge1xyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ3cuQXV0aG9yaXphdGlvblR5cGUuTk9ORSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEdlbmVyYXRlIHByZXNpZ25lZCBTMyBkb3dubG9hZCBVUkxcclxuICAgIGNvbnN0IGdldEltYWdlRm4gPSBuZXcgTm9kZWpzRnVuY3Rpb24odGhpcywgXCJHZXRQcmVzaWduZWREb3dubG9hZFVybEhhbmRsZXJcIiwge1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICAgICAgZW50cnk6IHBhdGguam9pbihfX2Rpcm5hbWUsIFwiLi4vbGFtYmRhL2dlbmVyYXRlUHJlc2lnbmVkRG93bmxvYWRVcmwudHNcIiksXHJcbiAgICAgIGhhbmRsZXI6IFwiaGFuZGxlclwiLFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIEJVQ0tFVF9OQU1FOiBwcmVSZWdCdWNrZXQuYnVja2V0TmFtZSxcclxuICAgICAgfSxcclxuICAgICAgdHJhY2luZzogbGFtYmRhLlRyYWNpbmcuQUNUSVZFLFxyXG4gICAgfSk7XHJcbiAgICBlbmFibGVYUmF5KGdldEltYWdlRm4pO1xyXG5cclxuICAgIHByZVJlZ0J1Y2tldC5ncmFudFJlYWQoZ2V0SW1hZ2VGbik7XHJcblxyXG4gICAgY29uc3QgZ2V0SW1hZ2VSZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKFwiZ2V0LWltYWdlXCIpO1xyXG5cclxuICAgIGdldEltYWdlUmVzb3VyY2UuYWRkQ29yc1ByZWZsaWdodCh7XHJcbiAgICAgIGFsbG93T3JpZ2luczogW1wiKlwiXSxcclxuICAgICAgYWxsb3dNZXRob2RzOiBbXCJHRVRcIl0sXHJcbiAgICB9KTtcclxuXHJcbiAgICBnZXRJbWFnZVJlc291cmNlLmFkZE1ldGhvZChcIkdFVFwiLCBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24oZ2V0SW1hZ2VGbiksIHtcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWd3LkF1dGhvcml6YXRpb25UeXBlLk5PTkUsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIC8vIFVTRVIgTUFOQUdFTUVOVFxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICBjb25zdCB1c2Vyc1Jlc291cmNlID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoXCJ1c2Vyc1wiKTtcclxuXHJcbiAgICB1c2Vyc1Jlc291cmNlLmFkZENvcnNQcmVmbGlnaHQoe1xyXG4gICAgICBhbGxvd09yaWdpbnM6IFtcImh0dHA6Ly9sb2NhbGhvc3Q6NTE3M1wiXSxcclxuICAgICAgYWxsb3dNZXRob2RzOiBbXCJPUFRJT05TXCIsIFwiR0VUXCIsIFwiUE9TVFwiLCBcIlBVVFwiLCBcIkRFTEVURVwiXSxcclxuICAgICAgYWxsb3dIZWFkZXJzOiBbXCJDb250ZW50LVR5cGVcIiwgXCJBdXRob3JpemF0aW9uXCJdLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgdXNlckJ5SWRSZXNvdXJjZSA9IHVzZXJzUmVzb3VyY2UuYWRkUmVzb3VyY2UoXCJ7dXNlcklkfVwiKTtcclxuXHJcbiAgICB1c2VyQnlJZFJlc291cmNlLmFkZENvcnNQcmVmbGlnaHQoe1xyXG4gICAgICBhbGxvd09yaWdpbnM6IFtcImh0dHA6Ly9sb2NhbGhvc3Q6NTE3M1wiXSxcclxuICAgICAgYWxsb3dNZXRob2RzOiBbXCJPUFRJT05TXCIsIFwiUFVUXCIsIFwiREVMRVRFXCJdLFxyXG4gICAgICBhbGxvd0hlYWRlcnM6IFtcIkNvbnRlbnQtVHlwZVwiLCBcIkF1dGhvcml6YXRpb25cIl0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBHZXQgdXNlcnNcclxuICAgIGNvbnN0IHVzZXJzR2V0Rm4gPSBuZXcgTm9kZWpzRnVuY3Rpb24odGhpcywgXCJVc2Vyc0dldEhhbmRsZXJcIiwge1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICAgICAgZW50cnk6IHBhdGguam9pbihfX2Rpcm5hbWUsIFwiLi4vbGFtYmRhL3VzZXJzLWdldC50c1wiKSxcclxuICAgICAgaGFuZGxlcjogXCJoYW5kbGVyXCIsXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgVVNFUl9QT09MX0lEOiB1c2VyUG9vbC51c2VyUG9vbElkLFxyXG4gICAgICAgIEFMTE9XRURfT1JJR0lOOiBcImh0dHA6Ly9sb2NhbGhvc3Q6NTE3M1wiLFxyXG4gICAgICB9LFxyXG4gICAgICBidW5kbGluZzoge1xyXG4gICAgICAgIHRhcmdldDogXCJub2RlMThcIixcclxuICAgICAgICBtaW5pZnk6IHRydWUsXHJcbiAgICAgICAgc291cmNlTWFwOiBmYWxzZSxcclxuICAgICAgfSxcclxuICAgICAgdHJhY2luZzogbGFtYmRhLlRyYWNpbmcuQUNUSVZFLFxyXG4gICAgfSk7XHJcbiAgICBlbmFibGVYUmF5KHVzZXJzR2V0Rm4pO1xyXG5cclxuICAgIHVzZXJzR2V0Rm4uYWRkVG9Sb2xlUG9saWN5KFxyXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgICAgYWN0aW9uczogW1wiY29nbml0by1pZHA6TGlzdFVzZXJzXCJdLFxyXG4gICAgICAgIHJlc291cmNlczogW3VzZXJQb29sLnVzZXJQb29sQXJuXSxcclxuICAgICAgfSlcclxuICAgICk7XHJcblxyXG4gICAgdXNlcnNSZXNvdXJjZS5hZGRNZXRob2QoXCJHRVRcIiwgbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKHVzZXJzR2V0Rm4pLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlndy5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQ3JlYXRlIHVzZXJzXHJcbiAgICBjb25zdCB1c2Vyc0NyZWF0ZUZuID0gbmV3IE5vZGVqc0Z1bmN0aW9uKHRoaXMsIFwiVXNlcnNDcmVhdGVIYW5kbGVyXCIsIHtcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXHJcbiAgICAgIGVudHJ5OiBwYXRoLmpvaW4oX19kaXJuYW1lLCBcIi4uL2xhbWJkYS91c2Vycy1jcmVhdGUudHNcIiksXHJcbiAgICAgIGhhbmRsZXI6IFwiaGFuZGxlclwiLFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIFVTRVJfUE9PTF9JRDogdXNlclBvb2wudXNlclBvb2xJZCxcclxuICAgICAgICBBTExPV0VEX09SSUdJTjogXCJodHRwOi8vbG9jYWxob3N0OjUxNzNcIixcclxuICAgICAgfSxcclxuICAgICAgYnVuZGxpbmc6IHtcclxuICAgICAgICB0YXJnZXQ6IFwibm9kZTE4XCIsXHJcbiAgICAgICAgbWluaWZ5OiB0cnVlLFxyXG4gICAgICAgIHNvdXJjZU1hcDogZmFsc2UsXHJcbiAgICAgIH0sXHJcbiAgICAgIHRyYWNpbmc6IGxhbWJkYS5UcmFjaW5nLkFDVElWRSxcclxuICAgIH0pO1xyXG4gICAgZW5hYmxlWFJheSh1c2Vyc0NyZWF0ZUZuKTtcclxuXHJcbiAgICB1c2Vyc0NyZWF0ZUZuLmFkZFRvUm9sZVBvbGljeShcclxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICAgIGFjdGlvbnM6IFtcImNvZ25pdG8taWRwOkFkbWluQ3JlYXRlVXNlclwiXSxcclxuICAgICAgICByZXNvdXJjZXM6IFt1c2VyUG9vbC51c2VyUG9vbEFybl0sXHJcbiAgICAgIH0pXHJcbiAgICApO1xyXG5cclxuICAgIHVzZXJzUmVzb3VyY2UuYWRkTWV0aG9kKFwiUE9TVFwiLCBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24odXNlcnNDcmVhdGVGbiksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWd3LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBVcGRhdGUgdXNlcnNcclxuICAgIGNvbnN0IHVzZXJzVXBkYXRlRm4gPSBuZXcgTm9kZWpzRnVuY3Rpb24odGhpcywgXCJVc2Vyc1VwZGF0ZUhhbmRsZXJcIiwge1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICAgICAgZW50cnk6IHBhdGguam9pbihfX2Rpcm5hbWUsIFwiLi4vbGFtYmRhL3VzZXJzLXVwZGF0ZS50c1wiKSxcclxuICAgICAgaGFuZGxlcjogXCJoYW5kbGVyXCIsXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgVVNFUl9QT09MX0lEOiB1c2VyUG9vbC51c2VyUG9vbElkLFxyXG4gICAgICAgIEFMTE9XRURfT1JJR0lOOiBcImh0dHA6Ly9sb2NhbGhvc3Q6NTE3M1wiLFxyXG4gICAgICB9LFxyXG4gICAgICBidW5kbGluZzoge1xyXG4gICAgICAgIHRhcmdldDogXCJub2RlMThcIixcclxuICAgICAgICBtaW5pZnk6IHRydWUsXHJcbiAgICAgICAgc291cmNlTWFwOiBmYWxzZSxcclxuICAgICAgfSxcclxuICAgICAgdHJhY2luZzogbGFtYmRhLlRyYWNpbmcuQUNUSVZFLFxyXG4gICAgfSk7XHJcbiAgICBlbmFibGVYUmF5KHVzZXJzVXBkYXRlRm4pO1xyXG5cclxuICAgIHVzZXJzVXBkYXRlRm4uYWRkVG9Sb2xlUG9saWN5KFxyXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgICAgYWN0aW9uczogW1wiY29nbml0by1pZHA6QWRtaW5VcGRhdGVVc2VyQXR0cmlidXRlc1wiXSxcclxuICAgICAgICByZXNvdXJjZXM6IFt1c2VyUG9vbC51c2VyUG9vbEFybl0sXHJcbiAgICAgIH0pXHJcbiAgICApO1xyXG5cclxuICAgIHVzZXJCeUlkUmVzb3VyY2UuYWRkTWV0aG9kKFwiUFVUXCIsIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbih1c2Vyc1VwZGF0ZUZuKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ3cuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIERlbGV0ZSB1c2Vyc1xyXG4gICAgY29uc3QgdXNlcnNEZWxldGVGbiA9IG5ldyBOb2RlanNGdW5jdGlvbih0aGlzLCBcIlVzZXJzRGVsZXRlSGFuZGxlclwiLCB7XHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxyXG4gICAgICBlbnRyeTogcGF0aC5qb2luKF9fZGlybmFtZSwgXCIuLi9sYW1iZGEvdXNlcnMtZGVsZXRlLnRzXCIpLFxyXG4gICAgICBoYW5kbGVyOiBcImhhbmRsZXJcIixcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICBVU0VSX1BPT0xfSUQ6IHVzZXJQb29sLnVzZXJQb29sSWQsXHJcbiAgICAgICAgQUxMT1dFRF9PUklHSU46IFwiaHR0cDovL2xvY2FsaG9zdDo1MTczXCIsXHJcbiAgICAgIH0sXHJcbiAgICAgIGJ1bmRsaW5nOiB7XHJcbiAgICAgICAgdGFyZ2V0OiBcIm5vZGUxOFwiLFxyXG4gICAgICAgIG1pbmlmeTogdHJ1ZSxcclxuICAgICAgICBzb3VyY2VNYXA6IGZhbHNlLFxyXG4gICAgICB9LFxyXG4gICAgICB0cmFjaW5nOiBsYW1iZGEuVHJhY2luZy5BQ1RJVkUsXHJcbiAgICB9KTtcclxuICAgIGVuYWJsZVhSYXkodXNlcnNEZWxldGVGbik7XHJcblxyXG4gICAgdXNlcnNEZWxldGVGbi5hZGRUb1JvbGVQb2xpY3koXHJcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgICBhY3Rpb25zOiBbXCJjb2duaXRvLWlkcDpBZG1pbkRlbGV0ZVVzZXJcIl0sXHJcbiAgICAgICAgcmVzb3VyY2VzOiBbdXNlclBvb2wudXNlclBvb2xBcm5dLFxyXG4gICAgICB9KVxyXG4gICAgKTtcclxuXHJcbiAgICB1c2VyQnlJZFJlc291cmNlLmFkZE1ldGhvZChcIkRFTEVURVwiLCBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24odXNlcnNEZWxldGVGbiksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWd3LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIC8vIEFuYWx5dGljcyBEYXNoYm9hcmQgKFJFQUwgREFUQSlcclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgY29uc3QgYW5hbHl0aWNzRGFzaGJvYXJkRm4gPSBuZXcgTm9kZWpzRnVuY3Rpb24odGhpcywgXCJBbmFseXRpY3NEYXNoYm9hcmRIYW5kbGVyXCIsIHtcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXHJcbiAgICAgIGVudHJ5OiBwYXRoLmpvaW4oX19kaXJuYW1lLCBcIi4uL2xhbWJkYS9hbmFseXRpY3MtZGFzaGJvYXJkLnRzXCIpLFxyXG4gICAgICBoYW5kbGVyOiBcImhhbmRsZXJcIixcclxuICAgICAgYnVuZGxpbmc6IHsgdGFyZ2V0OiBcIm5vZGUxOFwiLCBtaW5pZnk6IHRydWUsIHNvdXJjZU1hcDogZmFsc2UgfSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICBQTFVHX0FDVElPTlNfVEFCTEU6IGRiU3RhY2sucGx1Z0FjdGlvbnNUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgICAgVEVMRU1FVFJZX1RBQkxFOiBkYlN0YWNrLmlvdFRlbGVtZXRyeVRhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgICBQTFVHX0lOREVYX05BTUU6IFwicGx1Z19pZC10cy1pbmRleFwiLFxyXG4gICAgICB9LFxyXG4gICAgICB0cmFjaW5nOiBsYW1iZGEuVHJhY2luZy5BQ1RJVkUsXHJcbiAgICB9KTtcclxuICAgIGVuYWJsZVhSYXkoYW5hbHl0aWNzRGFzaGJvYXJkRm4pO1xyXG5cclxuICAgIGRiU3RhY2sucGx1Z0FjdGlvbnNUYWJsZS5ncmFudFJlYWREYXRhKGFuYWx5dGljc0Rhc2hib2FyZEZuKTtcclxuICAgIGRiU3RhY2suaW90VGVsZW1ldHJ5VGFibGUuZ3JhbnRSZWFkRGF0YShhbmFseXRpY3NEYXNoYm9hcmRGbik7XHJcblxyXG4gICAgY29uc3QgYW5hbHl0aWNzUmVzb3VyY2UgPSBhcGkucm9vdC5hZGRSZXNvdXJjZShcImFuYWx5dGljc1wiKTtcclxuICAgIGNvbnN0IGRhc2hib2FyZFJlc291cmNlID0gYW5hbHl0aWNzUmVzb3VyY2UuYWRkUmVzb3VyY2UoXCJkYXNoYm9hcmRcIik7XHJcblxyXG4gICAgZGFzaGJvYXJkUmVzb3VyY2UuYWRkQ29yc1ByZWZsaWdodCh7XHJcbiAgICAgIGFsbG93T3JpZ2luczogW1wiaHR0cDovL2xvY2FsaG9zdDo4MDgwXCIsIFwiaHR0cDovL2xvY2FsaG9zdDo1MTczXCJdLFxyXG4gICAgICBhbGxvd01ldGhvZHM6IFtcIk9QVElPTlNcIiwgXCJHRVRcIl0sXHJcbiAgICAgIGFsbG93SGVhZGVyczogW1wiQ29udGVudC1UeXBlXCIsIFwiQXV0aG9yaXphdGlvblwiXSxcclxuICAgIH0pO1xyXG5cclxuICAgIGRhc2hib2FyZFJlc291cmNlLmFkZE1ldGhvZChcIkdFVFwiLCBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24oYW5hbHl0aWNzRGFzaGJvYXJkRm4pLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlndy5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcblxyXG5cclxuICB9XHJcbn0iXX0=