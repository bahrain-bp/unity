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
        });
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
            supportedIdentityProviders: [
                cognito.UserPoolClientIdentityProvider.COGNITO,
            ],
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
            restApiName: `${prefixname}-Unity Service`,
            deployOptions: { stageName: `${prefixname}-dev` },
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
        const whoamiFn = new aws_lambda_nodejs_1.NodejsFunction(this, "WhoAmIHandler", {
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
        });
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
        // PlugActions: use table from DBStack
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
        });
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
        // Telemetry query: use IoTDeviceTelemetry table from DBStack
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
        assistantResource.addMethod("POST", new apigw.LambdaIntegration(bedrockStack.lambdaFunction), {
        // authorizer,
        // authorizationType: apigw.AuthorizationType.COGNITO,
        });
        // Lambda function responsible for generating presigned S3 upload URLs
        // used by the frontend during user pre-registration to securely upload images.   
        const generatePresignedUrlFn = new aws_lambda_nodejs_1.NodejsFunction(this, "GeneratePresignedUrlHandler", {
            runtime: lambda.Runtime.NODEJS_20_X,
            entry: path.join(__dirname, "../lambda/generatePresignedUploadUrl.ts"),
            handler: "handler",
            environment: {
                BUCKET_NAME: preRegBucket.bucketName,
            },
        });
        preRegBucket.grantReadWrite(generatePresignedUrlFn);
        //API Gateway Route for Upload
        const uploadImageResource = api.root.addResource("upload-image");
        // Add CORS first
        // Rename the resource path
        // Add CORS first
        uploadImageResource.addCorsPreflight({
            allowOrigins: ["*"], // replace "*" with your frontend URL in production
            allowMethods: ["POST"],
        });
        // **No Cognito auth required for pre-registration**
        uploadImageResource.addMethod("POST", new apigw.LambdaIntegration(generatePresignedUrlFn), {
            authorizationType: apigw.AuthorizationType.NONE,
        });
        const preRegisterCheckFn = new lambda.Function(this, "PreRegisterCheckHandler", {
            runtime: lambda.Runtime.PYTHON_3_9,
            handler: "PreRegisterCheck.handler",
            code: lambda.Code.fromAsset("lambda"),
            timeout: cdk.Duration.seconds(30),
            environment: {
                BUCKET_NAME: preRegBucket.bucketName,
                USER_MANAGEMENT_TABLE: userTable.tableName, // REQUIRED
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
        // ────────────────────────────────
        // GET IMAGE (return presigned GET URL)
        // ────────────────────────────────
        const getImageFn = new aws_lambda_nodejs_1.NodejsFunction(this, "GetPresignedDownloadUrlHandler", {
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
    }
}
exports.APIStack = APIStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBpLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXBpLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBSW5DLGlFQUFtRDtBQUNuRCxrRUFBb0Q7QUFDcEQsK0RBQWlEO0FBRWpELHlEQUEyQztBQUMzQyxxRUFBK0Q7QUFDL0QsMkNBQTZCO0FBVzdCLE1BQWEsUUFBUyxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3ZDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBb0I7UUFDNUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFMUIsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7UUFFNUQsTUFBTSxPQUFPLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQztRQUM5QixNQUFNLE9BQU8sR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDO1FBQzlCLE1BQU0sWUFBWSxHQUFHLEtBQUssQ0FBQyxZQUFZLENBQUM7UUFDeEMsTUFBTSxZQUFZLEdBQUcsT0FBTyxDQUFDLFlBQVksQ0FBQztRQUMxQyxNQUFNLFNBQVMsR0FBRyxPQUFPLENBQUMsbUJBQW1CLENBQUM7UUFFNUMsNENBQTRDO1FBQzVDLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFNUIscUNBQXFDO1FBQ3JDLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsa0JBQWtCLEVBQUU7WUFDMUMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsU0FBUztZQUM5QixXQUFXLEVBQUUsNENBQTRDO1NBQzFELENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLEVBQUU7WUFD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LGlCQUFpQixDQUFDLElBQUk7U0FDaEQsQ0FDRixDQUFDO1FBSUYsbUNBQW1DO1FBQ25DLHVDQUF1QztRQUN2QyxtQ0FBbUM7UUFDbkMsTUFBTSxVQUFVLEdBQUcsSUFBSSxrQ0FBYyxDQUFDLElBQUksRUFBRSxnQ0FBZ0MsRUFBRTtZQUM1RSxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLEtBQUssRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSwyQ0FBMkMsQ0FBQztZQUN4RSxPQUFPLEVBQUUsU0FBUztZQUNsQixXQUFXLEVBQUU7Z0JBQ1gsV0FBVyxFQUFFLFlBQVksQ0FBQyxVQUFVO2FBQ3JDO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsWUFBWSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUVuQyxNQUFNLGdCQUFnQixHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBRTNELGdCQUFnQixDQUFDLGdCQUFnQixDQUFDO1lBQ2hDLFlBQVksRUFBRSxDQUFDLEdBQUcsQ0FBQztZQUNuQixZQUFZLEVBQUUsQ0FBQyxLQUFLLENBQUM7U0FDdEIsQ0FBQyxDQUFDO1FBRUgsZ0JBQWdCLENBQUMsU0FBUyxDQUN4QixLQUFLLEVBQ0wsSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsVUFBVSxDQUFDLEVBQ3ZDO1lBQ0UsaUJBQWlCLEVBQUUsS0FBSyxDQUFDLGlCQUFpQixDQUFDLElBQUk7U0FDaEQsQ0FDRixDQUFDO0lBUUEsQ0FBQztDQUNGO0FBdGJELDRCQXNiQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tIFwiYXdzLWNkay1saWJcIjtcclxuLy9pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheVwiO1xyXG5pbXBvcnQgeyBEQlN0YWNrIH0gZnJvbSBcIi4vREJzdGFja1wiO1xyXG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tIFwiY29uc3RydWN0c1wiO1xyXG5pbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtY29nbml0b1wiO1xyXG5pbXBvcnQgKiBhcyBhcGlndyBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXlcIjtcclxuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtbGFtYmRhXCI7XHJcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGJcIjtcclxuaW1wb3J0ICogYXMgaWFtIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtaWFtXCI7XHJcbmltcG9ydCB7IE5vZGVqc0Z1bmN0aW9uIH0gZnJvbSBcImF3cy1jZGstbGliL2F3cy1sYW1iZGEtbm9kZWpzXCI7XHJcbmltcG9ydCAqIGFzIHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IHsgQmVkcm9ja1N0YWNrIH0gZnJvbSBcIi4vYmVkcm9ja19zdGFja1wiO1xyXG5cclxuaW1wb3J0IHsgVW5pdHlXZWJTb2NrZXRTdGFjayB9IGZyb20gXCIuL3VuaXR5LXdlYnNvY2tldC1zdGFja1wiO1xyXG4gXHJcbmludGVyZmFjZSBBUElTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xyXG4gIGRiU3RhY2s6IERCU3RhY2s7XHJcbiAgYmVkcm9ja1N0YWNrOiBCZWRyb2NrU3RhY2s7XHJcbiAgd3NTdGFjazogVW5pdHlXZWJTb2NrZXRTdGFjaztcclxufVxyXG4gXHJcbmV4cG9ydCBjbGFzcyBBUElTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XHJcbmNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBBUElTdGFja1Byb3BzKSB7XHJcbiAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XHJcbiBcclxuY29uc3QgcHJlZml4bmFtZSA9IHRoaXMuc3RhY2tOYW1lLnNwbGl0KCctJylbMF0udG9Mb3dlckNhc2UoKTtcclxuXHJcbiAgY29uc3Qgd3NTdGFjayA9IHByb3BzLndzU3RhY2s7XHJcbiAgY29uc3QgZGJTdGFjayA9IHByb3BzLmRiU3RhY2s7XHJcbiAgY29uc3QgYmVkcm9ja1N0YWNrID0gcHJvcHMuYmVkcm9ja1N0YWNrO1xyXG4gIGNvbnN0IHByZVJlZ0J1Y2tldCA9IGRiU3RhY2sucHJlUmVnQnVja2V0O1xyXG4gIGNvbnN0IHVzZXJUYWJsZSA9IGRiU3RhY2sudXNlck1hbmFnZW1lbnRUYWJsZTtcclxuICBcclxuICAgIC8vIEVuc3VyZSBEQlN0YWNrIGlzIGNyZWF0ZWQgYmVmb3JlIEFQSVN0YWNrXHJcbiAgICB0aGlzLmFkZERlcGVuZGVuY3koZGJTdGFjayk7XHJcbiBcclxuICAgIC8vIER5bmFtb0RCIE91dHB1dHMgKGFscmVhZHkgcHJlc2VudClcclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiQmFodHdpblRhYmxlTmFtZVwiLCB7XHJcbiAgICAgIHZhbHVlOiBkYlN0YWNrLnRhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgZGVzY3JpcHRpb246IFwiTmFtZSBvZiB0aGUgRHluYW1vREIgdGFibGUgdXNlZCBieSBCQUhUV0lOXCIsXHJcbiAgICB9KTtcclxuIFxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJCYWh0d2luVGFibGVBcm5cIiwge1xyXG4gICAgICB2YWx1ZTogZGJTdGFjay50YWJsZS50YWJsZUFybixcclxuICAgICAgZGVzY3JpcHRpb246IFwiQVJOIG9mIHRoZSBEeW5hbW9EQiB0YWJsZSB1c2VkIGJ5IEJBSFRXSU5cIixcclxuICAgIH0pO1xyXG4gXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIC8vIDEuIENvZ25pdG8gVXNlciBQb29sXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIGNvbnN0IHVzZXJQb29sID0gbmV3IGNvZ25pdG8uVXNlclBvb2wodGhpcywgXCJVbml0eVVzZXJQb29sXCIsIHtcclxuICAgICAgdXNlclBvb2xOYW1lOiBgJHtwcmVmaXhuYW1lfS11bml0eS11c2Vyc2AsXHJcbiAgICAgIHNlbGZTaWduVXBFbmFibGVkOiB0cnVlLFxyXG4gICAgICBzaWduSW5BbGlhc2VzOiB7IGVtYWlsOiB0cnVlIH0sXHJcbiAgICAgIHN0YW5kYXJkQXR0cmlidXRlczoge1xyXG4gICAgICAgIGVtYWlsOiB7IHJlcXVpcmVkOiB0cnVlLCBtdXRhYmxlOiBmYWxzZSB9LFxyXG4gICAgICB9LFxyXG4gICAgICBwYXNzd29yZFBvbGljeToge1xyXG4gICAgICAgIG1pbkxlbmd0aDogOCxcclxuICAgICAgICByZXF1aXJlRGlnaXRzOiB0cnVlLFxyXG4gICAgICAgIHJlcXVpcmVMb3dlcmNhc2U6IHRydWUsXHJcbiAgICAgICAgcmVxdWlyZVVwcGVyY2FzZTogdHJ1ZSxcclxuICAgICAgICByZXF1aXJlU3ltYm9sczogZmFsc2UsXHJcbiAgICAgIH0sXHJcbiAgICAgIGFjY291bnRSZWNvdmVyeTogY29nbml0by5BY2NvdW50UmVjb3ZlcnkuRU1BSUxfT05MWSxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHBvc3RDb25maXJtRm4gPSBuZXcgTm9kZWpzRnVuY3Rpb24odGhpcywgXCJQb3N0Q29uZmlybVZpc2l0b3JIYW5kbGVyXCIsIHtcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXHJcbiAgICAgIGVudHJ5OiBwYXRoLmpvaW4oX19kaXJuYW1lLCBcIi4uL2xhbWJkYS9wb3N0LWNvbmZpcm0tdmlzaXRvci50c1wiKSxcclxuICAgICAgaGFuZGxlcjogXCJoYW5kbGVyXCIsXHJcbiAgICAgIGJ1bmRsaW5nOiB7XHJcbiAgICAgICAgdGFyZ2V0OiBcIm5vZGUxOFwiLFxyXG4gICAgICAgIG1pbmlmeTogdHJ1ZSxcclxuICAgICAgICBzb3VyY2VNYXA6IGZhbHNlLFxyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgcG9zdENvbmZpcm1Gbi5hZGRUb1JvbGVQb2xpY3koXHJcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgICBhY3Rpb25zOiBbXCJjb2duaXRvLWlkcDpBZG1pbkFkZFVzZXJUb0dyb3VwXCJdLFxyXG4gICAgICAgIHJlc291cmNlczogW1wiKlwiXSxcclxuICAgICAgfSlcclxuICAgICk7XHJcblxyXG4gICAgdXNlclBvb2wuYWRkVHJpZ2dlcihcclxuICAgICAgY29nbml0by5Vc2VyUG9vbE9wZXJhdGlvbi5QT1NUX0NPTkZJUk1BVElPTixcclxuICAgICAgcG9zdENvbmZpcm1GblxyXG4gICAgKTtcclxuXHJcbiAgICBjb25zdCB1c2VyUG9vbENsaWVudCA9IG5ldyBjb2duaXRvLlVzZXJQb29sQ2xpZW50KHRoaXMsIFwiVW5pdHlVc2VyUG9vbENsaWVudFYyXCIsIHtcclxuICAgICAgdXNlclBvb2wsXHJcbiAgICAgIGdlbmVyYXRlU2VjcmV0OiBmYWxzZSxcclxuICAgICAgYXV0aEZsb3dzOiB7IHVzZXJTcnA6IHRydWUsIHVzZXJQYXNzd29yZDogdHJ1ZSB9LFxyXG4gICAgICBvQXV0aDoge1xyXG4gICAgICAgIGZsb3dzOiB7XHJcbiAgICAgICAgICBhdXRob3JpemF0aW9uQ29kZUdyYW50OiB0cnVlLFxyXG4gICAgICAgICAgaW1wbGljaXRDb2RlR3JhbnQ6IHRydWUsXHJcbiAgICAgICAgfSxcclxuICAgICAgICBjYWxsYmFja1VybHM6IFtcImh0dHA6Ly9sb2NhbGhvc3Q6MzAwMC9jYWxsYmFja1wiXSxcclxuICAgICAgICBsb2dvdXRVcmxzOiBbXCJodHRwOi8vbG9jYWxob3N0OjMwMDAvXCJdLFxyXG4gICAgICAgIHNjb3BlczogW2NvZ25pdG8uT0F1dGhTY29wZS5PUEVOSUQsIGNvZ25pdG8uT0F1dGhTY29wZS5FTUFJTF0sXHJcbiAgICAgIH0sXHJcbiAgICAgIHN1cHBvcnRlZElkZW50aXR5UHJvdmlkZXJzOiBbXHJcbiAgICAgICAgY29nbml0by5Vc2VyUG9vbENsaWVudElkZW50aXR5UHJvdmlkZXIuQ09HTklUTyxcclxuICAgICAgXSxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IGNmbkNsaWVudCA9IHVzZXJQb29sQ2xpZW50Lm5vZGUuZGVmYXVsdENoaWxkIGFzIGNvZ25pdG8uQ2ZuVXNlclBvb2xDbGllbnQ7XHJcbiAgICBjZm5DbGllbnQuYWxsb3dlZE9BdXRoRmxvd3NVc2VyUG9vbENsaWVudCA9IHRydWU7XHJcbiAgICBjZm5DbGllbnQuYWxsb3dlZE9BdXRoRmxvd3MgPSBbXCJjb2RlXCIsIFwiaW1wbGljaXRcIl07XHJcbiAgICBjZm5DbGllbnQuYWxsb3dlZE9BdXRoU2NvcGVzID0gW1wib3BlbmlkXCIsIFwiZW1haWxcIl07XHJcbiAgICBjZm5DbGllbnQuc3VwcG9ydGVkSWRlbnRpdHlQcm92aWRlcnMgPSBbXCJDT0dOSVRPXCJdO1xyXG5cclxuICAgIG5ldyBjb2duaXRvLkNmblVzZXJQb29sR3JvdXAodGhpcywgXCJBZG1pbkdyb3VwXCIsIHtcclxuICAgICAgdXNlclBvb2xJZDogdXNlclBvb2wudXNlclBvb2xJZCxcclxuICAgICAgZ3JvdXBOYW1lOiBcImFkbWluXCIsXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY29nbml0by5DZm5Vc2VyUG9vbEdyb3VwKHRoaXMsIFwiTmV3SGlyZUdyb3VwXCIsIHtcclxuICAgICAgdXNlclBvb2xJZDogdXNlclBvb2wudXNlclBvb2xJZCxcclxuICAgICAgZ3JvdXBOYW1lOiBcIm5ld2hpcmVcIixcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjb2duaXRvLkNmblVzZXJQb29sR3JvdXAodGhpcywgXCJWaXNpdG9yR3JvdXBcIiwge1xyXG4gICAgICB1c2VyUG9vbElkOiB1c2VyUG9vbC51c2VyUG9vbElkLFxyXG4gICAgICBncm91cE5hbWU6IFwidmlzaXRvclwiLFxyXG4gICAgfSk7XHJcbiBcclxuICAgIGNvbnN0IHVzZXJQb29sRG9tYWluID0gbmV3IGNvZ25pdG8uVXNlclBvb2xEb21haW4odGhpcywgXCJVbml0eVVzZXJQb29sRG9tYWluXCIsIHtcclxuICAgICAgdXNlclBvb2wsXHJcbiAgICAgIGNvZ25pdG9Eb21haW46IHsgZG9tYWluUHJlZml4OiBgJHtwcmVmaXhuYW1lfS11bml0eS0ke3RoaXMuYWNjb3VudH0tZGV2YCB9LFxyXG4gICAgfSk7XHJcbiBcclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiVXNlclBvb2xJZFwiLCB7XHJcbiAgICAgIHZhbHVlOiB1c2VyUG9vbC51c2VyUG9vbElkLFxyXG4gICAgfSk7XHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIlVzZXJQb29sQ2xpZW50SWRcIiwge1xyXG4gICAgICB2YWx1ZTogdXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcclxuICAgIH0pO1xyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJVc2VyUG9vbERvbWFpblVybFwiLCB7XHJcbiAgICAgIHZhbHVlOiB1c2VyUG9vbERvbWFpbi5iYXNlVXJsKCksXHJcbiAgICB9KTtcclxuIFxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICAvLyAyLiBMYW1iZGEgRnVuY3Rpb24gKGhlbGxvKVxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICBjb25zdCBoZWxsb0ZuID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCBcIkhlbGxvSGFuZGxlclwiLCB7XHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxyXG4gICAgICBoYW5kbGVyOiBcImhlbGxvLmhhbmRsZXJcIixcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KFwibGFtYmRhXCIpLFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIFRBQkxFX05BTUU6IGRiU3RhY2sudGFibGUudGFibGVOYW1lLFxyXG4gICAgICAgIFVTRVJfUE9PTF9JRDogdXNlclBvb2wudXNlclBvb2xJZCxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG4gXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIC8vIDMuIEFQSSBHYXRld2F5ICsgQ29nbml0byBBdXRob3JpemVyXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIGNvbnN0IGFwaSA9IG5ldyBhcGlndy5SZXN0QXBpKHRoaXMsIFwiVW5pdHlSZXN0QXBpXCIsIHtcclxuICAgICAgcmVzdEFwaU5hbWU6IGAke3ByZWZpeG5hbWV9LVVuaXR5IFNlcnZpY2VgLFxyXG4gICAgICBkZXBsb3lPcHRpb25zOiB7IHN0YWdlTmFtZTogYCR7cHJlZml4bmFtZX0tZGV2YCB9LFxyXG4gICAgfSk7XHJcbiBcclxuICAgIGNvbnN0IGF1dGhvcml6ZXIgPSBuZXcgYXBpZ3cuQ29nbml0b1VzZXJQb29sc0F1dGhvcml6ZXIodGhpcywgXCJVbml0eUNvZ25pdG9BdXRob3JpemVyXCIsIHtcclxuICAgICAgY29nbml0b1VzZXJQb29sczogW3VzZXJQb29sXSxcclxuICAgIH0pO1xyXG4gXHJcbiAgICBjb25zdCBoZWxsb1Jlc291cmNlID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoXCJoZWxsb1wiKTtcclxuICAgIGhlbGxvUmVzb3VyY2UuYWRkTWV0aG9kKFwiR0VUXCIsIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbihoZWxsb0ZuKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ3cuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG4gXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIlVuaXR5QXBpVXJsXCIsIHtcclxuICAgICAgdmFsdWU6IGFwaS51cmwsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIC8vIHdob2FtaVxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICBjb25zdCB3aG9hbWlGbiA9IG5ldyBOb2RlanNGdW5jdGlvbih0aGlzLCBcIldob0FtSUhhbmRsZXJcIiwge1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICAgICAgZW50cnk6IHBhdGguam9pbihfX2Rpcm5hbWUsIFwiLi4vbGFtYmRhL3dob2FtaS50c1wiKSxcclxuICAgICAgaGFuZGxlcjogXCJoYW5kbGVyXCIsXHJcbiAgICAgIGJ1bmRsaW5nOiB7XHJcbiAgICAgICAgdGFyZ2V0OiBcIm5vZGUxOFwiLFxyXG4gICAgICAgIG1pbmlmeTogdHJ1ZSxcclxuICAgICAgICBzb3VyY2VNYXA6IGZhbHNlLFxyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3Qgd2hvYW1pUmVzb3VyY2UgPSBhcGkucm9vdC5hZGRSZXNvdXJjZShcIndob2FtaVwiKTtcclxuICAgIHdob2FtaVJlc291cmNlLmFkZE1ldGhvZChcIkdFVFwiLCBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24od2hvYW1pRm4pLCB7XHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlndy5BdXRob3JpemF0aW9uVHlwZS5OT05FLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICAvLyBzZXQtcm9sZVxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICBjb25zdCBzZXRSb2xlRm4gPSBuZXcgTm9kZWpzRnVuY3Rpb24odGhpcywgXCJTZXRSb2xlSGFuZGxlclwiLCB7XHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxyXG4gICAgICBlbnRyeTogcGF0aC5qb2luKF9fZGlybmFtZSwgXCIuLi9sYW1iZGEvc2V0LXJvbGUudHNcIiksXHJcbiAgICAgIGhhbmRsZXI6IFwiaGFuZGxlclwiLFxyXG4gICAgICBidW5kbGluZzoge1xyXG4gICAgICAgIHRhcmdldDogXCJub2RlMThcIixcclxuICAgICAgICBtaW5pZnk6IHRydWUsXHJcbiAgICAgICAgc291cmNlTWFwOiBmYWxzZSxcclxuICAgICAgfSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICBVU0VSX1BPT0xfSUQ6IHVzZXJQb29sLnVzZXJQb29sSWQsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICBzZXRSb2xlRm4uYWRkVG9Sb2xlUG9saWN5KFxyXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgICAgYWN0aW9uczogW1xyXG4gICAgICAgICAgXCJjb2duaXRvLWlkcDpBZG1pbkFkZFVzZXJUb0dyb3VwXCIsXHJcbiAgICAgICAgICBcImNvZ25pdG8taWRwOkFkbWluUmVtb3ZlVXNlckZyb21Hcm91cFwiLFxyXG4gICAgICAgICAgXCJjb2duaXRvLWlkcDpBZG1pbkxpc3RHcm91cHNGb3JVc2VyXCIsXHJcbiAgICAgICAgXSxcclxuICAgICAgICByZXNvdXJjZXM6IFtcIipcIl0sXHJcbiAgICAgIH0pXHJcbiAgICApO1xyXG5cclxuICAgIGNvbnN0IHJvbGVSZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKFwicm9sZVwiKTtcclxuICAgIHJvbGVSZXNvdXJjZS5hZGRNZXRob2QoXCJQT1NUXCIsIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbihzZXRSb2xlRm4pLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlndy5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcbiBcclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgLy8gUGx1Z0FjdGlvbnM6IHVzZSB0YWJsZSBmcm9tIERCU3RhY2tcclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgY29uc3QgcGx1Z0FjdGlvbnNUYWJsZTogZHluYW1vZGIuVGFibGUgPSBkYlN0YWNrLnBsdWdBY3Rpb25zVGFibGU7XHJcblxyXG4gICAgY29uc3QgcGx1Z0NvbnRyb2xGbiA9IG5ldyBOb2RlanNGdW5jdGlvbih0aGlzLCBcIlBsdWdDb250cm9sSGFuZGxlclwiLCB7XHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxyXG4gICAgICBlbnRyeTogcGF0aC5qb2luKF9fZGlybmFtZSwgXCIuLi9sYW1iZGEvcGx1Zy1jb250cm9sLnRzXCIpLFxyXG4gICAgICBoYW5kbGVyOiBcImhhbmRsZXJcIixcclxuICAgICAgYnVuZGxpbmc6IHtcclxuICAgICAgICB0YXJnZXQ6IFwibm9kZTE4XCIsXHJcbiAgICAgICAgbWluaWZ5OiB0cnVlLFxyXG4gICAgICAgIHNvdXJjZU1hcDogZmFsc2UsXHJcbiAgICAgIH0sXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgUExVR19BQ1RJT05TX1RBQkxFOiBwbHVnQWN0aW9uc1RhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgICBWT0lDRV9NT05LRVlfQkFTRV9VUkw6IFwiaHR0cHM6Ly9hcGktdjIudm9pY2Vtb25rZXkuaW8vdHJpZ2dlclwiLFxyXG4gICAgICAgIFZPSUNFX01PTktFWV9UT0tFTjogXCI4ODFiMTdiM2I3OTg4MDIxODdkNDEzM2QyY2Y0MDg3NV82MjQyZDQxZTYwNGVlYzllNWQ1OWI3MTNjM2U3NTFlN1wiLFxyXG4gICAgICAgIFBMVUdfREVWSUNFX01BUDogSlNPTi5zdHJpbmdpZnkoe1xyXG4gICAgICAgICAgcGx1ZzE6IHsgb246IFwidHVybm9ucGx1Z29uZVwiLCBvZmY6IFwidHVybm9mZnBsdWdvbmVcIiB9LFxyXG4gICAgICAgICAgcGx1ZzI6IHsgb246IFwidHVybm9ucGx1Z3R3b1wiLCBvZmY6IFwidHVybm9mZnBsdWd0d29cIiB9LFxyXG4gICAgICAgIH0pLFxyXG4gICAgICAgIENPT0xET1dOX1NFQ09ORFM6IFwiMzBcIixcclxuXHJcbiAgICAgICAgV1NfQ09OTkVDVElPTlNfVEFCTEU6IHdzU3RhY2suY29ubmVjdGlvbnNUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgICAgV1NfTUFOQUdFTUVOVF9FTkRQT0lOVDogd3NTdGFjay5tYW5hZ2VtZW50RW5kcG9pbnQsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICBwbHVnQWN0aW9uc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShwbHVnQ29udHJvbEZuKTtcclxuICAgIHdzU3RhY2suY29ubmVjdGlvbnNUYWJsZS5ncmFudFJlYWREYXRhKHBsdWdDb250cm9sRm4pO1xyXG5cclxuICAgIHBsdWdDb250cm9sRm4uYWRkVG9Sb2xlUG9saWN5KFxyXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgICAgYWN0aW9uczogW1wiZXhlY3V0ZS1hcGk6TWFuYWdlQ29ubmVjdGlvbnNcIl0sXHJcbiAgICAgICAgcmVzb3VyY2VzOiBbXHJcbiAgICAgICAgICBgYXJuOmF3czpleGVjdXRlLWFwaToke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06JHt3c1N0YWNrLndlYlNvY2tldEFwaS5hcGlJZH0vJHt3c1N0YWNrLnN0YWdlLnN0YWdlTmFtZX0vKi9AY29ubmVjdGlvbnMvKmAsXHJcbiAgICAgICAgXSxcclxuICAgICAgfSlcclxuICAgICk7XHJcbiAgICBcclxuICAgIGNvbnN0IHBsdWdzUmVzb3VyY2UgPSBhcGkucm9vdC5hZGRSZXNvdXJjZShcInBsdWdzXCIpO1xyXG4gICAgcGx1Z3NSZXNvdXJjZS5hZGRNZXRob2QoXCJQT1NUXCIsIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbihwbHVnQ29udHJvbEZuKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ3cuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgLy8gVGVsZW1ldHJ5IHF1ZXJ5OiB1c2UgSW9URGV2aWNlVGVsZW1ldHJ5IHRhYmxlIGZyb20gREJTdGFja1xyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICBjb25zdCBpb3RUZWxlbWV0cnlUYWJsZTogZHluYW1vZGIuVGFibGUgPSBkYlN0YWNrLmlvdFRlbGVtZXRyeVRhYmxlO1xyXG5cclxuICAgIGNvbnN0IHRlbGVtZXRyeVF1ZXJ5Rm4gPSBuZXcgTm9kZWpzRnVuY3Rpb24odGhpcywgXCJUZWxlbWV0cnlRdWVyeUhhbmRsZXJcIiwge1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICAgICAgZW50cnk6IHBhdGguam9pbihfX2Rpcm5hbWUsIFwiLi4vbGFtYmRhL3RlbGVtZXRyeS1xdWVyeS50c1wiKSxcclxuICAgICAgaGFuZGxlcjogXCJoYW5kbGVyXCIsXHJcbiAgICAgIGJ1bmRsaW5nOiB7XHJcbiAgICAgICAgdGFyZ2V0OiBcIm5vZGUxOFwiLFxyXG4gICAgICAgIG1pbmlmeTogdHJ1ZSxcclxuICAgICAgICBzb3VyY2VNYXA6IGZhbHNlLFxyXG4gICAgICB9LFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIFRFTEVNRVRSWV9UQUJMRTogaW90VGVsZW1ldHJ5VGFibGUudGFibGVOYW1lLFxyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgaW90VGVsZW1ldHJ5VGFibGUuZ3JhbnRSZWFkRGF0YSh0ZWxlbWV0cnlRdWVyeUZuKTtcclxuXHJcbiAgICBjb25zdCB0ZWxlbWV0cnlSZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKFwidGVsZW1ldHJ5XCIpO1xyXG4gICAgdGVsZW1ldHJ5UmVzb3VyY2UuYWRkTWV0aG9kKFwiR0VUXCIsIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbih0ZWxlbWV0cnlRdWVyeUZuKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ3cuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG5cclxuICAgIHBsdWdzUmVzb3VyY2UuYWRkQ29yc1ByZWZsaWdodCh7XHJcbiAgICAgIGFsbG93T3JpZ2luczogW1xyXG4gICAgICAgIFwiaHR0cDovL2xvY2FsaG9zdDo4MDgwXCIsXHJcbiAgICAgICAgXCJodHRwOi8vbG9jYWxob3N0OjUxNzNcIiwgICAgIFxyXG4gICAgICBdLFxyXG4gICAgICBhbGxvd01ldGhvZHM6IFtcIk9QVElPTlNcIiwgXCJQT1NUXCJdLFxyXG4gICAgICBhbGxvd0hlYWRlcnM6IFtcIkNvbnRlbnQtVHlwZVwiLCBcIkF1dGhvcml6YXRpb25cIl0sXHJcbiAgICB9KTtcclxuXHJcbiAgICB0ZWxlbWV0cnlSZXNvdXJjZS5hZGRDb3JzUHJlZmxpZ2h0KHtcclxuICAgICAgYWxsb3dPcmlnaW5zOiBbXHJcbiAgICAgICAgXCJodHRwOi8vbG9jYWxob3N0OjgwODBcIixcclxuICAgICAgICBcImh0dHA6Ly9sb2NhbGhvc3Q6NTE3M1wiLCAgXHJcbiAgICAgIF0sXHJcbiAgICAgIGFsbG93TWV0aG9kczogW1wiT1BUSU9OU1wiLCBcIkdFVFwiXSxcclxuICAgICAgYWxsb3dIZWFkZXJzOiBbXCJDb250ZW50LVR5cGVcIiwgXCJBdXRob3JpemF0aW9uXCJdLFxyXG4gICAgfSk7XHJcblxyXG4gICAgICAgLy8gOCkgVmlydHVhbCBBc3Npc3RhbnQgQVBJIHJvdXRlIChQaWNreSlcclxuICAgICAgY29uc3QgdmlydHVhbEFzc2lzdGFudEZuID0gYmVkcm9ja1N0YWNrLmxhbWJkYUZ1bmN0aW9uO1xyXG4gICAgICBjb25zdCBhc3Npc3RhbnRSZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKFwiYXNzaXN0YW50XCIpO1xyXG5cclxuICAgICAgLy8gQ09SUyDigJQgcmVxdWlyZWQgZm9yIGZyb250ZW5kXHJcbiAgICAgIGFzc2lzdGFudFJlc291cmNlLmFkZENvcnNQcmVmbGlnaHQoe1xyXG4gICAgICAgIGFsbG93T3JpZ2luczogW1wiKlwiXSwgIFxyXG4gICAgICAgIGFsbG93TWV0aG9kczogW1wiUE9TVFwiXSxcclxuICAgICAgfSk7XHJcblxyXG4gICAgICBhc3Npc3RhbnRSZXNvdXJjZS5hZGRNZXRob2QoXCJQT1NUXCIsIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbihiZWRyb2NrU3RhY2subGFtYmRhRnVuY3Rpb24pLFxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgLy8gYXV0aG9yaXplcixcclxuICAgICAgICAgICAgLy8gYXV0aG9yaXphdGlvblR5cGU6IGFwaWd3LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICAgICAgICB9KTtcclxuXHJcblxyXG5cclxuXHJcbiAgICAgICAgICBcclxuLy8gTGFtYmRhIGZ1bmN0aW9uIHJlc3BvbnNpYmxlIGZvciBnZW5lcmF0aW5nIHByZXNpZ25lZCBTMyB1cGxvYWQgVVJMc1xyXG4vLyB1c2VkIGJ5IHRoZSBmcm9udGVuZCBkdXJpbmcgdXNlciBwcmUtcmVnaXN0cmF0aW9uIHRvIHNlY3VyZWx5IHVwbG9hZCBpbWFnZXMuICAgXHJcbiAgICBjb25zdCBnZW5lcmF0ZVByZXNpZ25lZFVybEZuID0gbmV3IE5vZGVqc0Z1bmN0aW9uKHRoaXMsIFwiR2VuZXJhdGVQcmVzaWduZWRVcmxIYW5kbGVyXCIsIHtcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXHJcbiAgICAgIGVudHJ5OiBwYXRoLmpvaW4oX19kaXJuYW1lLCBcIi4uL2xhbWJkYS9nZW5lcmF0ZVByZXNpZ25lZFVwbG9hZFVybC50c1wiKSxcclxuICAgICAgaGFuZGxlcjogXCJoYW5kbGVyXCIsXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgQlVDS0VUX05BTUU6IHByZVJlZ0J1Y2tldC5idWNrZXROYW1lLFxyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcbiAgICAgIFxyXG4gICAgICAgICBwcmVSZWdCdWNrZXQuZ3JhbnRSZWFkV3JpdGUoZ2VuZXJhdGVQcmVzaWduZWRVcmxGbik7XHJcblxyXG4vL0FQSSBHYXRld2F5IFJvdXRlIGZvciBVcGxvYWRcclxuXHJcbmNvbnN0IHVwbG9hZEltYWdlUmVzb3VyY2UgPSBhcGkucm9vdC5hZGRSZXNvdXJjZShcInVwbG9hZC1pbWFnZVwiKTtcclxuXHJcbi8vIEFkZCBDT1JTIGZpcnN0XHJcbi8vIFJlbmFtZSB0aGUgcmVzb3VyY2UgcGF0aFxyXG5cclxuLy8gQWRkIENPUlMgZmlyc3RcclxudXBsb2FkSW1hZ2VSZXNvdXJjZS5hZGRDb3JzUHJlZmxpZ2h0KHtcclxuICBhbGxvd09yaWdpbnM6IFtcIipcIl0sICAgICAgICAvLyByZXBsYWNlIFwiKlwiIHdpdGggeW91ciBmcm9udGVuZCBVUkwgaW4gcHJvZHVjdGlvblxyXG4gIGFsbG93TWV0aG9kczogW1wiUE9TVFwiXSxcclxufSk7XHJcblxyXG5cclxuLy8gKipObyBDb2duaXRvIGF1dGggcmVxdWlyZWQgZm9yIHByZS1yZWdpc3RyYXRpb24qKlxyXG51cGxvYWRJbWFnZVJlc291cmNlLmFkZE1ldGhvZChcclxuICBcIlBPU1RcIixcclxuICBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24oZ2VuZXJhdGVQcmVzaWduZWRVcmxGbiksXHJcbiAge1xyXG4gICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWd3LkF1dGhvcml6YXRpb25UeXBlLk5PTkUsXHJcbiAgfVxyXG4pO1xyXG5cclxuXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcblxyXG5jb25zdCBwcmVSZWdpc3RlckNoZWNrRm4gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsIFwiUHJlUmVnaXN0ZXJDaGVja0hhbmRsZXJcIiwge1xyXG4gIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzksXHJcbiAgaGFuZGxlcjogXCJQcmVSZWdpc3RlckNoZWNrLmhhbmRsZXJcIixcclxuICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoXCJsYW1iZGFcIiksXHJcbiAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxyXG4gIGVudmlyb25tZW50OiB7XHJcbiAgICBCVUNLRVRfTkFNRTogcHJlUmVnQnVja2V0LmJ1Y2tldE5hbWUsXHJcbiAgICBVU0VSX01BTkFHRU1FTlRfVEFCTEU6IHVzZXJUYWJsZS50YWJsZU5hbWUsICAgLy8gUkVRVUlSRURcclxuICAgIENPTExFQ1RJT05fSUQ6IFwiVmlzaXRvckZhY2VDb2xsZWN0aW9uXCIsXHJcbiAgfSxcclxufSk7XHJcblxyXG5wcmVSZWdCdWNrZXQuZ3JhbnRSZWFkV3JpdGUocHJlUmVnaXN0ZXJDaGVja0ZuKTtcclxudXNlclRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShwcmVSZWdpc3RlckNoZWNrRm4pO1xyXG5cclxuY29uc3QgdmFsaWRhdGVJbWFnZVJlc291cmNlID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoXCJ2YWxpZGF0ZS1pbWFnZVwiKTtcclxuXHJcbnZhbGlkYXRlSW1hZ2VSZXNvdXJjZS5hZGRDb3JzUHJlZmxpZ2h0KHtcclxuICBhbGxvd09yaWdpbnM6IFtcIipcIl0sXHJcbiAgYWxsb3dNZXRob2RzOiBbXCJQT1NUXCJdLFxyXG59KTtcclxuXHJcbnZhbGlkYXRlSW1hZ2VSZXNvdXJjZS5hZGRNZXRob2QoXHJcbiAgXCJQT1NUXCIsXHJcbiAgbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKHByZVJlZ2lzdGVyQ2hlY2tGbiksXHJcbiAge1xyXG4gICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWd3LkF1dGhvcml6YXRpb25UeXBlLk5PTkUsXHJcbiAgfVxyXG4pO1xyXG5cclxuXHJcblxyXG4vLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuLy8gR0VUIElNQUdFIChyZXR1cm4gcHJlc2lnbmVkIEdFVCBVUkwpXHJcbi8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG5jb25zdCBnZXRJbWFnZUZuID0gbmV3IE5vZGVqc0Z1bmN0aW9uKHRoaXMsIFwiR2V0UHJlc2lnbmVkRG93bmxvYWRVcmxIYW5kbGVyXCIsIHtcclxuICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICBlbnRyeTogcGF0aC5qb2luKF9fZGlybmFtZSwgXCIuLi9sYW1iZGEvZ2VuZXJhdGVQcmVzaWduZWREb3dubG9hZFVybC50c1wiKSxcclxuICBoYW5kbGVyOiBcImhhbmRsZXJcIixcclxuICBlbnZpcm9ubWVudDoge1xyXG4gICAgQlVDS0VUX05BTUU6IHByZVJlZ0J1Y2tldC5idWNrZXROYW1lLFxyXG4gIH0sXHJcbn0pO1xyXG5cclxucHJlUmVnQnVja2V0LmdyYW50UmVhZChnZXRJbWFnZUZuKTtcclxuXHJcbmNvbnN0IGdldEltYWdlUmVzb3VyY2UgPSBhcGkucm9vdC5hZGRSZXNvdXJjZShcImdldC1pbWFnZVwiKTtcclxuXHJcbmdldEltYWdlUmVzb3VyY2UuYWRkQ29yc1ByZWZsaWdodCh7XHJcbiAgYWxsb3dPcmlnaW5zOiBbXCIqXCJdLFxyXG4gIGFsbG93TWV0aG9kczogW1wiR0VUXCJdLFxyXG59KTtcclxuXHJcbmdldEltYWdlUmVzb3VyY2UuYWRkTWV0aG9kKFxyXG4gIFwiR0VUXCIsXHJcbiAgbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKGdldEltYWdlRm4pLFxyXG4gIHtcclxuICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlndy5BdXRob3JpemF0aW9uVHlwZS5OT05FLFxyXG4gIH1cclxuKTtcclxuXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcbiAgfVxyXG59Il19