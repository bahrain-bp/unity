"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APIStack = void 0;
const cdk = require("aws-cdk-lib");
const cognito = require("aws-cdk-lib/aws-cognito");
const apigw = require("aws-cdk-lib/aws-apigateway");
const lambda = require("aws-cdk-lib/aws-lambda");
const iot = require("aws-cdk-lib/aws-iot");
const dynamodb = require("aws-cdk-lib/aws-dynamodb");
const iam = require("aws-cdk-lib/aws-iam");
const aws_lambda_nodejs_1 = require("aws-cdk-lib/aws-lambda-nodejs");
const path = require("path");
class APIStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
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
        // Post-confirm trigger to auto-add 'visitor'
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
            resources: ["*"], // break circular dependency
        }));
        userPool.addTrigger(cognito.UserPoolOperation.POST_CONFIRMATION, postConfirmFn);
        // app client with OAuth config
        const userPoolClient = new cognito.UserPoolClient(this, "UnityUserPoolClientV2", {
            userPool,
            generateSecret: false,
            authFlows: { userSrp: true, userPassword: true },
            oAuth: {
                flows: {
                    authorizationCodeGrant: true,
                    implicitCodeGrant: true, // so response_type=token works
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
        const cfnClient = userPoolClient.node.defaultChild;
        cfnClient.allowedOAuthFlowsUserPoolClient = true;
        cfnClient.allowedOAuthFlows = ["code", "implicit"]; // must include "implicit" for response_type=token
        cfnClient.allowedOAuthScopes = ["openid", "email"];
        cfnClient.supportedIdentityProviders = ["COGNITO"]; // same as above, but at L1
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
        // API: GET /whoami (no auth required)
        const whoamiResource = api.root.addResource("whoami");
        whoamiResource.addMethod("GET", new apigw.LambdaIntegration(whoamiFn), {
            authorizationType: apigw.AuthorizationType.NONE,
        });
        // ────────────────────────────────
        // Lambda: set-role (assign newhire/visitor)
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
        // Allow Lambda to manage groups in this user pool
        setRoleFn.addToRolePolicy(new iam.PolicyStatement({
            actions: [
                "cognito-idp:AdminAddUserToGroup",
                "cognito-idp:AdminRemoveUserFromGroup",
                "cognito-idp:AdminListGroupsForUser",
            ],
            resources: ["*"], // break circular dependency
        }));
        // API: POST /role (protected by Cognito authorizer)
        const roleResource = api.root.addResource("role");
        roleResource.addMethod("POST", new apigw.LambdaIntegration(setRoleFn), {
            authorizer,
            authorizationType: apigw.AuthorizationType.COGNITO,
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
        const telemetryGetFn = new aws_lambda_nodejs_1.NodejsFunction(this, "TelemetryGetHandler", {
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
        new cdk.CfnOutput(this, "PiPolicyName", { value: piPolicy.policyName });
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
        plugsResource.addMethod("POST", new apigw.LambdaIntegration(plugControlFn), {
            authorizer,
            authorizationType: apigw.AuthorizationType.COGNITO,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBpLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXBpLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUFtQztBQUluQyxtREFBbUQ7QUFDbkQsb0RBQW9EO0FBQ3BELGlEQUFpRDtBQUNqRCwyQ0FBMkM7QUFDM0MscURBQXFEO0FBQ3JELDJDQUEyQztBQUMzQyxxRUFBK0Q7QUFDL0QsNkJBQTZCO0FBUTdCLE1BQWEsUUFBUyxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3ZDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBb0I7UUFDNUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxPQUFPLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQztRQUM5QixNQUFNLFlBQVksR0FBRyxLQUFLLENBQUMsWUFBWSxDQUFDO1FBQ3hDLE1BQU0sWUFBWSxHQUFHLE9BQU8sQ0FBQyxZQUFZLENBQUM7UUFDMUMsTUFBTSxTQUFTLEdBQUcsT0FBTyxDQUFDLG1CQUFtQixDQUFDO1FBRTVDLDRDQUE0QztRQUM1QyxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBRTVCLHFDQUFxQztRQUNyQyxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGtCQUFrQixFQUFFO1lBQzFDLEtBQUssRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLFNBQVM7WUFDOUIsV0FBVyxFQUFFLDRDQUE0QztTQUMxRCxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFO1lBQ3pDLEtBQUssRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLFFBQVE7WUFDN0IsV0FBVyxFQUFFLDJDQUEyQztTQUN6RCxDQUFDLENBQUM7UUFFSCxtQ0FBbUM7UUFDbkMsdUJBQXVCO1FBQ3ZCLG1DQUFtQztRQUNuQyxNQUFNLFFBQVEsR0FB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ay1saWJcIjtcclxuLy9pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheVwiO1xyXG5pbXBvcnQgeyBEQlN0YWNrIH0gZnJvbSBcIi4vREJzdGFja1wiO1xyXG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tIFwiY29uc3RydWN0c1wiO1xyXG5pbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtY29nbml0b1wiO1xyXG5pbXBvcnQgKiBhcyBhcGlndyBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXlcIjtcclxuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtbGFtYmRhXCI7XHJcbmltcG9ydCAqIGFzIGlvdCBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWlvdFwiO1xyXG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiXCI7XHJcbmltcG9ydCAqIGFzIGlhbSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWlhbVwiO1xyXG5pbXBvcnQgeyBOb2RlanNGdW5jdGlvbiB9IGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtbGFtYmRhLW5vZGVqc1wiO1xyXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gXCJwYXRoXCI7XHJcbmltcG9ydCB7IEJlZHJvY2tTdGFjayB9IGZyb20gXCIuL2JlZHJvY2tfc3RhY2tcIjtcclxuXHJcbmludGVyZmFjZSBBUElTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xyXG4gIGRiU3RhY2s6IERCU3RhY2s7XHJcbiAgYmVkcm9ja1N0YWNrOiBCZWRyb2NrU3RhY2s7XHJcbn1cclxuIFxyXG5leHBvcnQgY2xhc3MgQVBJU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xyXG5jb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogQVBJU3RhY2tQcm9wcykge1xyXG4gIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xyXG4gXHJcbiAgY29uc3QgZGJTdGFjayA9IHByb3BzLmRiU3RhY2s7XHJcbiAgY29uc3QgYmVkcm9ja1N0YWNrID0gcHJvcHMuYmVkcm9ja1N0YWNrO1xyXG4gIGNvbnN0IHByZVJlZ0J1Y2tldCA9IGRiU3RhY2sucHJlUmVnQnVja2V0O1xyXG4gIGNvbnN0IHVzZXJUYWJsZSA9IGRiU3RhY2sudXNlck1hbmFnZW1lbnRUYWJsZTtcclxuICBcclxuICAgIC8vIEVuc3VyZSBEQlN0YWNrIGlzIGNyZWF0ZWQgYmVmb3JlIEFQSVN0YWNrXHJcbiAgICB0aGlzLmFkZERlcGVuZGVuY3koZGJTdGFjayk7XHJcbiBcclxuICAgIC8vIER5bmFtb0RCIE91dHB1dHMgKGFscmVhZHkgcHJlc2VudClcclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiQmFodHdpblRhYmxlTmFtZVwiLCB7XHJcbiAgICAgIHZhbHVlOiBkYlN0YWNrLnRhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgZGVzY3JpcHRpb246IFwiTmFtZSBvZiB0aGUgRHluYW1vREIgdGFibGUgdXNlZCBieSBCQUhUV0lOXCIsXHJcbiAgICB9KTtcclxuIFxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJCYWh0d2luVGFibGVBcm5cIiwge1xyXG4gICAgICB2YWx1ZTogZGJTdGFjay50YWJsZS50YWJsZUFybixcclxuICAgICAgZGVzY3JpcHRpb246IFwiQVJOIG9mIHRoZSBEeW5hbW9EQiB0YWJsZSB1c2VkIGJ5IEJBSFRXSU5cIixcclxuICAgIH0pO1xyXG4gXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIC8vIDEuIENvZ25pdG8gVXNlciBQb29sXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIGNvbnN0IHVzZXJQb29sID0gbmV3IGNvZ25pdG8uVXNlclBvb2wodGhpcywgXCJVbml0eVVzZXJQb29sXCIsIHtcclxuICAgICAgdXNlclBvb2xOYW1lOiBcInVuaXR5LXVzZXJzXCIsXHJcbiAgICAgIHNlbGZTaWduVXBFbmFibGVkOiB0cnVlLFxyXG4gICAgICBzaWduSW5BbGlhc2VzOiB7IGVtYWlsOiB0cnVlIH0sXHJcbiAgICAgIHN0YW5kYXJkQXR0cmlidXRlczoge1xyXG4gICAgICAgIGVtYWlsOiB7IHJlcXVpcmVkOiB0cnVlLCBtdXRhYmxlOiBmYWxzZSB9LFxyXG4gICAgICB9LFxyXG4gICAgICBwYXNzd29yZFBvbGljeToge1xyXG4gICAgICAgIG1pbkxlbmd0aDogOCxcclxuICAgICAgICByZXF1aXJlRGlnaXRzOiB0cnVlLFxyXG4gICAgICAgIHJlcXVpcmVMb3dlcmNhc2U6IHRydWUsXHJcbiAgICAgICAgcmVxdWlyZVVwcGVyY2FzZTogdHJ1ZSxcclxuICAgICAgICByZXF1aXJlU3ltYm9sczogZmFsc2UsXHJcbiAgICAgIH0sXHJcbiAgICAgIGFjY291bnRSZWNvdmVyeTogY29nbml0by5BY2NvdW50UmVjb3ZlcnkuRU1BSUxfT05MWSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFBvc3QtY29uZmlybSB0cmlnZ2VyIHRvIGF1dG8tYWRkICd2aXNpdG9yJ1xyXG4gICAgY29uc3QgcG9zdENvbmZpcm1GbiA9IG5ldyBOb2RlanNGdW5jdGlvbih0aGlzLCBcIlBvc3RDb25maXJtVmlzaXRvckhhbmRsZXJcIiwge1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICAgICAgZW50cnk6IHBhdGguam9pbihfX2Rpcm5hbWUsIFwiLi4vbGFtYmRhL3Bvc3QtY29uZmlybS12aXNpdG9yLnRzXCIpLFxyXG4gICAgICBoYW5kbGVyOiBcImhhbmRsZXJcIixcclxuICAgICAgYnVuZGxpbmc6IHtcclxuICAgICAgICB0YXJnZXQ6IFwibm9kZTE4XCIsXHJcbiAgICAgICAgbWluaWZ5OiB0cnVlLFxyXG4gICAgICAgIHNvdXJjZU1hcDogZmFsc2UsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICBwb3N0Q29uZmlybUZuLmFkZFRvUm9sZVBvbGljeShcclxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICAgIGFjdGlvbnM6IFtcImNvZ25pdG8taWRwOkFkbWluQWRkVXNlclRvR3JvdXBcIl0sXHJcbiAgICAgICAgcmVzb3VyY2VzOiBbXCIqXCJdLCAvLyBicmVhayBjaXJjdWxhciBkZXBlbmRlbmN5XHJcbiAgICAgIH0pXHJcbiAgICApO1xyXG5cclxuICAgIHVzZXJQb29sLmFkZFRyaWdnZXIoXHJcbiAgICAgIGNvZ25pdG8uVXNlclBvb2xPcGVyYXRpb24uUE9TVF9DT05GSVJNQVRJT04sXHJcbiAgICAgIHBvc3RDb25maXJtRm5cclxuICAgICk7XHJcblxyXG4gICAgLy8gYXBwIGNsaWVudCB3aXRoIE9BdXRoIGNvbmZpZ1xyXG4gICAgY29uc3QgdXNlclBvb2xDbGllbnQgPSBuZXcgY29nbml0by5Vc2VyUG9vbENsaWVudCh0aGlzLCBcIlVuaXR5VXNlclBvb2xDbGllbnRWMlwiLCB7XHJcblxyXG4gICAgICB1c2VyUG9vbCxcclxuICAgICAgZ2VuZXJhdGVTZWNyZXQ6IGZhbHNlLFxyXG4gICAgICBhdXRoRmxvd3M6IHsgdXNlclNycDogdHJ1ZSwgdXNlclBhc3N3b3JkOiB0cnVlIH0sXHJcbiAgICAgIG9BdXRoOiB7XHJcbiAgICAgICAgZmxvd3M6IHtcclxuICAgICAgICAgIGF1dGhvcml6YXRpb25Db2RlR3JhbnQ6IHRydWUsXHJcbiAgICAgICAgICBpbXBsaWNpdENvZGVHcmFudDogdHJ1ZSwgICAvLyBzbyByZXNwb25zZV90eXBlPXRva2VuIHdvcmtzXHJcbiAgICAgICAgfSxcclxuICAgICAgICBjYWxsYmFja1VybHM6IFtcImh0dHA6Ly9sb2NhbGhvc3Q6MzAwMC9jYWxsYmFja1wiXSxcclxuICAgICAgICBsb2dvdXRVcmxzOiBbXCJodHRwOi8vbG9jYWxob3N0OjMwMDAvXCJdLFxyXG4gICAgICAgIHNjb3BlczogW2NvZ25pdG8uT0F1dGhTY29wZS5PUEVOSUQsIGNvZ25pdG8uT0F1dGhTY29wZS5FTUFJTF0sXHJcbiAgICAgIH0sXHJcbiAgICAgIHN1cHBvcnRlZElkZW50aXR5UHJvdmlkZXJzOiBbXHJcbiAgICAgICAgY29nbml0by5Vc2VyUG9vbENsaWVudElkZW50aXR5UHJvdmlkZXIuQ09HTklUTyxcclxuICAgICAgXSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEZPUkNFIHRoZSBsb3ctbGV2ZWwgT0F1dGggZmxhZ3Mgb24gdGhlIEwxIHJlc291cmNlXHJcbiAgICBjb25zdCBjZm5DbGllbnQgPSB1c2VyUG9vbENsaWVudC5ub2RlLmRlZmF1bHRDaGlsZCBhcyBjb2duaXRvLkNmblVzZXJQb29sQ2xpZW50O1xyXG4gICAgY2ZuQ2xpZW50LmFsbG93ZWRPQXV0aEZsb3dzVXNlclBvb2xDbGllbnQgPSB0cnVlO1xyXG4gICAgY2ZuQ2xpZW50LmFsbG93ZWRPQXV0aEZsb3dzID0gW1wiY29kZVwiLCBcImltcGxpY2l0XCJdOyAgIC8vIG11c3QgaW5jbHVkZSBcImltcGxpY2l0XCIgZm9yIHJlc3BvbnNlX3R5cGU9dG9rZW5cclxuICAgIGNmbkNsaWVudC5hbGxvd2VkT0F1dGhTY29wZXMgPSBbXCJvcGVuaWRcIiwgXCJlbWFpbFwiXTtcclxuICAgIGNmbkNsaWVudC5zdXBwb3J0ZWRJZGVudGl0eVByb3ZpZGVycyA9IFtcIkNPR05JVE9cIl07ICAgLy8gc2FtZSBhcyBhYm92ZSwgYnV0IGF0IEwxXHJcblxyXG4gICAgLy8geW91ciBncm91cHMgKHRoZXnigJlyZSBmaW5lKVxyXG4gICAgbmV3IGNvZ25pdG8uQ2ZuVXNlclBvb2xHcm91cCh0aGlzLCBcIkFkbWluR3JvdXBcIiwge1xyXG4gICAgICB1c2VyUG9vbElkOiB1c2VyUG9vbC51c2VyUG9vbElkLFxyXG4gICAgICBncm91cE5hbWU6IFwiYWRtaW5cIixcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjb2duaXRvLkNmblVzZXJQb29sR3JvdXAodGhpcywgXCJOZXdIaXJlR3JvdXBcIiwge1xyXG4gICAgICB1c2VyUG9vbElkOiB1c2VyUG9vbC51c2VyUG9vbElkLFxyXG4gICAgICBncm91cE5hbWU6IFwibmV3aGlyZVwiLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNvZ25pdG8uQ2ZuVXNlclBvb2xHcm91cCh0aGlzLCBcIlZpc2l0b3JHcm91cFwiLCB7XHJcbiAgICAgIHVzZXJQb29sSWQ6IHVzZXJQb29sLnVzZXJQb29sSWQsXHJcbiAgICAgIGdyb3VwTmFtZTogXCJ2aXNpdG9yXCIsXHJcbiAgICB9KTtcclxuIFxyXG4gICAgY29uc3QgdXNlclBvb2xEb21haW4gPSBuZXcgY29nbml0by5Vc2VyUG9vbERvbWFpbih0aGlzLCBcIlVuaXR5VXNlclBvb2xEb21haW5cIiwge1xyXG4gICAgICB1c2VyUG9vbCxcclxuICAgICAgY29nbml0b0RvbWFpbjogeyBkb21haW5QcmVmaXg6IGB1bml0eS0ke3RoaXMuYWNjb3VudH0tZGV2YCB9LFxyXG4gICAgfSk7XHJcbiBcclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiVXNlclBvb2xJZFwiLCB7XHJcbiAgICAgIHZhbHVlOiB1c2VyUG9vbC51c2VyUG9vbElkLFxyXG4gICAgfSk7XHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIlVzZXJQb29sQ2xpZW50SWRcIiwge1xyXG4gICAgICB2YWx1ZTogdXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcclxuICAgIH0pO1xyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJVc2VyUG9vbERvbWFpblVybFwiLCB7XHJcbiAgICAgIHZhbHVlOiB1c2VyUG9vbERvbWFpbi5iYXNlVXJsKCksXHJcbiAgICB9KTtcclxuIFxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICAvLyAyLiBMYW1iZGEgRnVuY3Rpb24gKGhlbGxvKVxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICBjb25zdCBoZWxsb0ZuID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCBcIkhlbGxvSGFuZGxlclwiLCB7XHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxyXG4gICAgICBoYW5kbGVyOiBcImhlbGxvLmhhbmRsZXJcIiwgLy8gcG9pbnRzIHRvIGxhbWJkYS9oZWxsby50cyAtPiBjb21waWxlZCB0byBKUyBpbiAvbGFtYmRhXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcImxhbWJkYVwiKSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICBUQUJMRV9OQU1FOiBkYlN0YWNrLnRhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgICBVU0VSX1BPT0xfSUQ6IHVzZXJQb29sLnVzZXJQb29sSWQsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuIFxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICAvLyAzLiBBUEkgR2F0ZXdheSArIENvZ25pdG8gQXV0aG9yaXplclxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICBjb25zdCBhcGkgPSBuZXcgYXBpZ3cuUmVzdEFwaSh0aGlzLCBcIlVuaXR5UmVzdEFwaVwiLCB7XHJcbiAgICAgIHJlc3RBcGlOYW1lOiBcIlVuaXR5IFNlcnZpY2VcIixcclxuICAgICAgZGVwbG95T3B0aW9uczogeyBzdGFnZU5hbWU6IFwiZGV2XCIgfSxcclxuICAgIH0pO1xyXG4gXHJcbiAgICBjb25zdCBhdXRob3JpemVyID0gbmV3IGFwaWd3LkNvZ25pdG9Vc2VyUG9vbHNBdXRob3JpemVyKHRoaXMsIFwiVW5pdHlDb2duaXRvQXV0aG9yaXplclwiLCB7XHJcbiAgICAgIGNvZ25pdG9Vc2VyUG9vbHM6IFt1c2VyUG9vbF0sXHJcbiAgICB9KTtcclxuIFxyXG4gICAgY29uc3QgaGVsbG9SZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKFwiaGVsbG9cIik7XHJcbiAgICBoZWxsb1Jlc291cmNlLmFkZE1ldGhvZChcIkdFVFwiLCBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24oaGVsbG9GbiksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWd3LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuIFxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJVbml0eUFwaVVybFwiLCB7XHJcbiAgICAgIHZhbHVlOiBhcGkudXJsLFxyXG4gICAgfSk7XHJcblxyXG5cclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgLy8gVGVzdCBMYW1iZGE6IHdob2FtaSAoVHlwZVNjcmlwdClcclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgY29uc3Qgd2hvYW1pRm4gPSBuZXcgTm9kZWpzRnVuY3Rpb24odGhpcywgXCJXaG9BbUlIYW5kbGVyXCIsIHtcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXHJcbiAgICAgIGVudHJ5OiBwYXRoLmpvaW4oX19kaXJuYW1lLCBcIi4uL2xhbWJkYS93aG9hbWkudHNcIiksXHJcbiAgICAgIGhhbmRsZXI6IFwiaGFuZGxlclwiLFxyXG4gICAgICBidW5kbGluZzoge1xyXG4gICAgICAgIHRhcmdldDogXCJub2RlMThcIixcclxuICAgICAgICBtaW5pZnk6IHRydWUsXHJcbiAgICAgICAgc291cmNlTWFwOiBmYWxzZSxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEFQSTogR0VUIC93aG9hbWkgKG5vIGF1dGggcmVxdWlyZWQpXHJcbiAgICBjb25zdCB3aG9hbWlSZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKFwid2hvYW1pXCIpO1xyXG4gICAgd2hvYW1pUmVzb3VyY2UuYWRkTWV0aG9kKFxyXG4gICAgICBcIkdFVFwiLFxyXG4gICAgICBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24od2hvYW1pRm4pLFxyXG4gICAgICB7XHJcbiAgICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWd3LkF1dGhvcml6YXRpb25UeXBlLk5PTkUsXHJcbiAgICAgIH1cclxuICAgICk7XHJcblxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICAvLyBMYW1iZGE6IHNldC1yb2xlIChhc3NpZ24gbmV3aGlyZS92aXNpdG9yKVxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICBjb25zdCBzZXRSb2xlRm4gPSBuZXcgTm9kZWpzRnVuY3Rpb24odGhpcywgXCJTZXRSb2xlSGFuZGxlclwiLCB7XHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxyXG4gICAgICBlbnRyeTogcGF0aC5qb2luKF9fZGlybmFtZSwgXCIuLi9sYW1iZGEvc2V0LXJvbGUudHNcIiksXHJcbiAgICAgIGhhbmRsZXI6IFwiaGFuZGxlclwiLFxyXG4gICAgICBidW5kbGluZzoge1xyXG4gICAgICAgIHRhcmdldDogXCJub2RlMThcIixcclxuICAgICAgICBtaW5pZnk6IHRydWUsXHJcbiAgICAgICAgc291cmNlTWFwOiBmYWxzZSxcclxuICAgICAgfSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICBVU0VSX1BPT0xfSUQ6IHVzZXJQb29sLnVzZXJQb29sSWQsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBBbGxvdyBMYW1iZGEgdG8gbWFuYWdlIGdyb3VwcyBpbiB0aGlzIHVzZXIgcG9vbFxyXG4gICAgc2V0Um9sZUZuLmFkZFRvUm9sZVBvbGljeShcclxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICAgIGFjdGlvbnM6IFtcclxuICAgICAgICAgIFwiY29nbml0by1pZHA6QWRtaW5BZGRVc2VyVG9Hcm91cFwiLFxyXG4gICAgICAgICAgXCJjb2duaXRvLWlkcDpBZG1pblJlbW92ZVVzZXJGcm9tR3JvdXBcIixcclxuICAgICAgICAgIFwiY29nbml0by1pZHA6QWRtaW5MaXN0R3JvdXBzRm9yVXNlclwiLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgcmVzb3VyY2VzOiBbXCIqXCJdLCAvLyBicmVhayBjaXJjdWxhciBkZXBlbmRlbmN5XHJcbiAgICAgIH0pXHJcbiAgICApO1xyXG5cclxuICAgIC8vIEFQSTogUE9TVCAvcm9sZSAocHJvdGVjdGVkIGJ5IENvZ25pdG8gYXV0aG9yaXplcilcclxuICAgIGNvbnN0IHJvbGVSZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKFwicm9sZVwiKTtcclxuICAgIHJvbGVSZXNvdXJjZS5hZGRNZXRob2QoXHJcbiAgICAgIFwiUE9TVFwiLFxyXG4gICAgICBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24oc2V0Um9sZUZuKSxcclxuICAgICAge1xyXG4gICAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWd3LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICAgIH1cclxuICAgICk7XHJcblxyXG5cclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgLy8gNCkgSW9UIENvcmU6IFRoaW5nICsgUG9saWN5XHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIGNvbnN0IHRoaW5nTmFtZSA9IFwicGkzLTAxXCI7XHJcbiBcclxuICAgIGNvbnN0IHBpVGhpbmcgPSBuZXcgaW90LkNmblRoaW5nKHRoaXMsIFwiUGlUaGluZ1wiLCB7IHRoaW5nTmFtZSB9KTtcclxuIFxyXG4gICAgY29uc3QgcGlQb2xpY3kgPSBuZXcgaW90LkNmblBvbGljeSh0aGlzLCBcIlBpUG9saWN5XCIsIHtcclxuICAgICAgcG9saWN5TmFtZTogXCJQaTNQb2xpY3lcIixcclxuICAgICAgcG9saWN5RG9jdW1lbnQ6IHtcclxuICAgICAgICBWZXJzaW9uOiBcIjIwMTItMTAtMTdcIixcclxuICAgICAgICBTdGF0ZW1lbnQ6IFtcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgRWZmZWN0OiBcIkFsbG93XCIsXHJcbiAgICAgICAgICAgIEFjdGlvbjogW1wiaW90OkNvbm5lY3RcIl0sXHJcbiAgICAgICAgICAgIFJlc291cmNlOiBbYGFybjphd3M6aW90OiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTpjbGllbnQvJHt0aGluZ05hbWV9KmBdLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgRWZmZWN0OiBcIkFsbG93XCIsXHJcbiAgICAgICAgICAgIEFjdGlvbjogW1wiaW90OlB1Ymxpc2hcIl0sXHJcbiAgICAgICAgICAgIFJlc291cmNlOiBbYGFybjphd3M6aW90OiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTp0b3BpYy8ke3RoaW5nTmFtZX0vI2BdLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgRWZmZWN0OiBcIkFsbG93XCIsXHJcbiAgICAgICAgICAgIEFjdGlvbjogW1wiaW90OlJlY2VpdmVcIl0sXHJcbiAgICAgICAgICAgIFJlc291cmNlOiBbYGFybjphd3M6aW90OiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTp0b3BpYy8ke3RoaW5nTmFtZX0vI2BdLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgRWZmZWN0OiBcIkFsbG93XCIsXHJcbiAgICAgICAgICAgIEFjdGlvbjogW1wiaW90OlN1YnNjcmliZVwiXSxcclxuICAgICAgICAgICAgUmVzb3VyY2U6IFtgYXJuOmF3czppb3Q6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OnRvcGljZmlsdGVyLyR7dGhpbmdOYW1lfS8jYF0sXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgIF0sXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuIFxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICAvLyA1KSBEeW5hbW9EQiB0YWJsZSBmb3IgdGVsZW1ldHJ5XHJcbiAgICAvLyAgICBQSz1kZXZpY2UgKHN0cmluZyksIFNLPXRzIChudW1iZXIsIGVwb2NoIHNlY29uZHMpXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIGNvbnN0IHRlbGVtVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgXCJUZWxlbWV0cnlUYWJsZVwiLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogXCJQaVRlbGVtZXRyeVwiLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogXCJkZXZpY2VcIiwgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiBcInRzXCIsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksIC8vIGNoYW5nZSB0byBSRVRBSU4gaW4gcHJvZFxyXG4gICAgfSk7XHJcbiBcclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiVGVsZW1ldHJ5VGFibGVOYW1lXCIsIHsgdmFsdWU6IHRlbGVtVGFibGUudGFibGVOYW1lIH0pO1xyXG4gXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIC8vIDYpIElvVCBSdWxlIOKGkiBEeW5hbW9EQiAodjIgYWN0aW9uKVxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICBjb25zdCBpb3RSdWxlUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCBcIklvdFJ1bGVEZGJSb2xlXCIsIHtcclxuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoXCJpb3QuYW1hem9uYXdzLmNvbVwiKSxcclxuICAgIH0pO1xyXG4gICAgdGVsZW1UYWJsZS5ncmFudFdyaXRlRGF0YShpb3RSdWxlUm9sZSk7XHJcbiBcclxuICAgIG5ldyBpb3QuQ2ZuVG9waWNSdWxlKHRoaXMsIFwiU2F2ZVBpVGVsZW1ldHJ5UnVsZVwiLCB7XHJcbiAgICAgIHRvcGljUnVsZVBheWxvYWQ6IHtcclxuICAgICAgICBzcWw6IFwiU0VMRUNUIGRldmljZSwgdHMsIHRlbXBfYywgaHVtaWRpdHkgRlJPTSAncGkzLTAxL3RlbGVtZXRyeSdcIixcclxuICAgICAgICBhY3Rpb25zOiBbXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIGR5bmFtb0RCdjI6IHtcclxuICAgICAgICAgICAgICBwdXRJdGVtOiB7IHRhYmxlTmFtZTogdGVsZW1UYWJsZS50YWJsZU5hbWUgfSxcclxuICAgICAgICAgICAgICByb2xlQXJuOiBpb3RSdWxlUm9sZS5yb2xlQXJuLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIHJ1bGVEaXNhYmxlZDogZmFsc2UsXHJcbiAgICAgICAgYXdzSW90U3FsVmVyc2lvbjogXCIyMDE2LTAzLTIzXCIsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuIFxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICAvLyA3KSBMYW1iZGEgKFR5cGVTY3JpcHQpICsgQVBJIHRvIHJlYWQgaXQgYmFja1xyXG4gICAgLy8gICAgR0VUIC90ZWxlbWV0cnk/ZGV2aWNlPXBpMy0wMSZsaW1pdD0yNVxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICBjb25zdCB0ZWxlbWV0cnlHZXRGbiA9IG5ldyBOb2RlanNGdW5jdGlvbih0aGlzLCBcIlRlbGVtZXRyeUdldEhhbmRsZXJcIiwge1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICAgICAgZW50cnk6IHBhdGguam9pbihfX2Rpcm5hbWUsIFwiLi4vbGFtYmRhL3RlbGVtZXRyeS1nZXQudHNcIiksXHJcbiAgICAgIGhhbmRsZXI6IFwiaGFuZGxlclwiLFxyXG4gICAgICBidW5kbGluZzoge1xyXG4gICAgICAgIHRhcmdldDogXCJub2RlMThcIixcclxuICAgICAgICBtaW5pZnk6IHRydWUsXHJcbiAgICAgICAgc291cmNlTWFwOiBmYWxzZSxcclxuICAgICAgfSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICBURUxFTUVUUllfVEFCTEU6IHRlbGVtVGFibGUudGFibGVOYW1lLFxyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcbiBcclxuICAgIHRlbGVtVGFibGUuZ3JhbnRSZWFkRGF0YSh0ZWxlbWV0cnlHZXRGbik7XHJcbiBcclxuICAgIGNvbnN0IHRlbGVtZXRyeVJlc291cmNlID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoXCJ0ZWxlbWV0cnlcIik7XHJcbiAgICB0ZWxlbWV0cnlSZXNvdXJjZS5hZGRNZXRob2QoXCJHRVRcIiwgbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKHRlbGVtZXRyeUdldEZuKSwge1xyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ3cuQXV0aG9yaXphdGlvblR5cGUuTk9ORSwgLy8gc3dpdGNoIHRvIENPR05JVE8gbGF0ZXIgXHJcbiAgICB9KTtcclxuIFxyXG4gICAgLy8gVXNlZnVsIG91dHB1dHNcclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiUGlUaGluZ05hbWVcIiwgeyB2YWx1ZTogdGhpbmdOYW1lIH0pO1xyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJQaVBvbGljeU5hbWVcIiwgeyB2YWx1ZTogcGlQb2xpY3kucG9saWN5TmFtZSEgfSk7XHJcblxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICAvLyA4KSBEeW5hbW9EQiB0YWJsZSBmb3IgcGx1ZyBhY3Rpb25zIChhdWRpdCArIGNvb2xkb3duKVxyXG4gICAgLy8gICAgUEsgPSB1c2VyX2lkIChzdHJpbmcpLCBTSyA9IHRzIChudW1iZXIsIGVwb2NoIHNlY29uZHMpXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIGNvbnN0IHBsdWdBY3Rpb25zVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgXCJQbHVnQWN0aW9uc1RhYmxlXCIsIHtcclxuICAgICAgdGFibGVOYW1lOiBcIlBsdWdBY3Rpb25zXCIsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiBcInVzZXJfaWRcIiwgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiBcInRzXCIsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksIC8vIGNoYW5nZSB0byBSRVRBSU4gaW4gcHJvZFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJQbHVnQWN0aW9uc1RhYmxlTmFtZVwiLCB7XHJcbiAgICAgIHZhbHVlOiBwbHVnQWN0aW9uc1RhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgZGVzY3JpcHRpb246IFwiQXVkaXQgdGFibGUgZm9yIHBsdWcgY29udHJvbCBhY3Rpb25zXCIsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIC8vIDkpIExhbWJkYSB0byBoYW5kbGUgcGx1ZyBjb250cm9sICsgY29vbGRvd24gKyBsb2dnaW5nXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIGNvbnN0IHBsdWdDb250cm9sRm4gPSBuZXcgTm9kZWpzRnVuY3Rpb24odGhpcywgXCJQbHVnQ29udHJvbEhhbmRsZXJcIiwge1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICAgICAgZW50cnk6IHBhdGguam9pbihfX2Rpcm5hbWUsIFwiLi4vbGFtYmRhL3BsdWctY29udHJvbC50c1wiKSxcclxuICAgICAgaGFuZGxlcjogXCJoYW5kbGVyXCIsXHJcbiAgICAgIGJ1bmRsaW5nOiB7XHJcbiAgICAgICAgdGFyZ2V0OiBcIm5vZGUxOFwiLFxyXG4gICAgICAgIG1pbmlmeTogdHJ1ZSxcclxuICAgICAgICBzb3VyY2VNYXA6IGZhbHNlLFxyXG4gICAgICB9LFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIFBMVUdfQUNUSU9OU19UQUJMRTogcGx1Z0FjdGlvbnNUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgICAgVk9JQ0VfTU9OS0VZX0JBU0VfVVJMOiBcImh0dHBzOi8vYXBpLXYyLnZvaWNlbW9ua2V5LmlvL3RyaWdnZXJcIixcclxuICAgICAgICAvLyBWb2ljZSBNb25rZXkgdG9rZW4gXHJcbiAgICAgICAgVk9JQ0VfTU9OS0VZX1RPS0VOOiBcIjg4MWIxN2IzYjc5ODgwMjE4N2Q0MTMzZDJjZjQwODc1XzYyNDJkNDFlNjA0ZWVjOWU1ZDU5YjcxM2MzZTc1MWU3XCIsXHJcbiAgICAgICAgLy8gTWFwcGluZyBwbHVnSWQgKyBzdGF0ZSDihpIgVm9pY2UgTW9ua2V5IGRldmljZSBpZHNcclxuICAgICAgICAvLyB0aGlzIGxhdGVyIGlmIG1vcmUgcGx1Z3MgYWRkZWRcclxuICAgICAgICBQTFVHX0RFVklDRV9NQVA6IEpTT04uc3RyaW5naWZ5KHtcclxuICAgICAgICAgIHBsdWcxOiB7IG9uOiBcInR1cm5vbnBsdWdvbmVcIiwgb2ZmOiBcInR1cm5vZmZwbHVnb25lXCIgfSxcclxuICAgICAgICAgIHBsdWcyOiB7IG9uOiBcInR1cm5vbnBsdWd0d29cIiwgb2ZmOiBcInR1cm5vZmZwbHVndHdvXCIgfSxcclxuICAgICAgICB9KSxcclxuICAgICAgICBDT09MRE9XTl9TRUNPTkRTOiBcIjMwXCIsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICBwbHVnQWN0aW9uc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShwbHVnQ29udHJvbEZuKTtcclxuXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIC8vIDEwKSBBUEkgR2F0ZXdheTogL3BsdWdzIFBPU1Qg4oaSIHBsdWdDb250cm9sRm4gKHByb3RlY3RlZCBieSBDb2duaXRvKVxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICBjb25zdCBwbHVnc1Jlc291cmNlID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoXCJwbHVnc1wiKTtcclxuICAgIHBsdWdzUmVzb3VyY2UuYWRkTWV0aG9kKFxyXG4gICAgICBcIlBPU1RcIixcclxuICAgICAgbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKHBsdWdDb250cm9sRm4pLFxyXG4gICAgICB7XHJcbiAgICAgICAgYXV0aG9yaXplcixcclxuICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ3cuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgICAgfVxyXG4gICAgKTtcclxuXHJcbiAgICAgICAvLyA4KSBWaXJ0dWFsIEFzc2lzdGFudCBBUEkgcm91dGUgKFBpY2t5KVxyXG4gICAgICBjb25zdCB2aXJ0dWFsQXNzaXN0YW50Rm4gPSBiZWRyb2NrU3RhY2subGFtYmRhRnVuY3Rpb247XHJcbiAgICAgIGNvbnN0IGFzc2lzdGFudFJlc291cmNlID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoXCJhc3Npc3RhbnRcIik7XHJcblxyXG4gICAgICAvLyBDT1JTIOKAlCByZXF1aXJlZCBmb3IgZnJvbnRlbmRcclxuICAgICAgYXNzaXN0YW50UmVzb3VyY2UuYWRkQ29yc1ByZWZsaWdodCh7XHJcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBbXCIqXCJdLCAgXHJcbiAgICAgICAgYWxsb3dNZXRob2RzOiBbXCJQT1NUXCJdLFxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGFzc2lzdGFudFJlc291cmNlLmFkZE1ldGhvZChcIlBPU1RcIiwgbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKGJlZHJvY2tTdGFjay5sYW1iZGFGdW5jdGlvbiksXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICAvLyBhdXRob3JpemVyLFxyXG4gICAgICAgICAgICAvLyBhdXRob3JpemF0aW9uVHlwZTogYXBpZ3cuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgICAgICAgIH0pO1xyXG5cclxuXHJcblxyXG5cclxuICAgICAgICAgIFxyXG4vLyBMYW1iZGEgZnVuY3Rpb24gcmVzcG9uc2libGUgZm9yIGdlbmVyYXRpbmcgcHJlc2lnbmVkIFMzIHVwbG9hZCBVUkxzXHJcbi8vIHVzZWQgYnkgdGhlIGZyb250ZW5kIGR1cmluZyB1c2VyIHByZS1yZWdpc3RyYXRpb24gdG8gc2VjdXJlbHkgdXBsb2FkIGltYWdlcy4gICBcclxuICAgIGNvbnN0IGdlbmVyYXRlUHJlc2lnbmVkVXJsRm4gPSBuZXcgTm9kZWpzRnVuY3Rpb24odGhpcywgXCJHZW5lcmF0ZVByZXNpZ25lZFVybEhhbmRsZXJcIiwge1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcclxuICAgICAgZW50cnk6IHBhdGguam9pbihfX2Rpcm5hbWUsIFwiLi4vbGFtYmRhL2dlbmVyYXRlUHJlc2lnbmVkVXBsb2FkVXJsLnRzXCIpLFxyXG4gICAgICBoYW5kbGVyOiBcImhhbmRsZXJcIixcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICBCVUNLRVRfTkFNRTogcHJlUmVnQnVja2V0LmJ1Y2tldE5hbWUsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICAgICAgXHJcbiAgICAgICAgIHByZVJlZ0J1Y2tldC5ncmFudFJlYWRXcml0ZShnZW5lcmF0ZVByZXNpZ25lZFVybEZuKTtcclxuXHJcbi8vQVBJIEdhdGV3YXkgUm91dGUgZm9yIFVwbG9hZFxyXG5cclxuY29uc3QgdXBsb2FkSW1hZ2VSZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKFwidXBsb2FkLWltYWdlXCIpO1xyXG5cclxuLy8gQWRkIENPUlMgZmlyc3RcclxuLy8gUmVuYW1lIHRoZSByZXNvdXJjZSBwYXRoXHJcblxyXG4vLyBBZGQgQ09SUyBmaXJzdFxyXG51cGxvYWRJbWFnZVJlc291cmNlLmFkZENvcnNQcmVmbGlnaHQoe1xyXG4gIGFsbG93T3JpZ2luczogW1wiKlwiXSwgICAgICAgIC8vIHJlcGxhY2UgXCIqXCIgd2l0aCB5b3VyIGZyb250ZW5kIFVSTCBpbiBwcm9kdWN0aW9uXHJcbiAgYWxsb3dNZXRob2RzOiBbXCJQT1NUXCJdLFxyXG59KTtcclxuXHJcblxyXG4vLyAqKk5vIENvZ25pdG8gYXV0aCByZXF1aXJlZCBmb3IgcHJlLXJlZ2lzdHJhdGlvbioqXHJcbnVwbG9hZEltYWdlUmVzb3VyY2UuYWRkTWV0aG9kKFxyXG4gIFwiUE9TVFwiLFxyXG4gIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbihnZW5lcmF0ZVByZXNpZ25lZFVybEZuKSxcclxuICB7XHJcbiAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ3cuQXV0aG9yaXphdGlvblR5cGUuTk9ORSxcclxuICB9XHJcbik7XHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcbmNvbnN0IHByZVJlZ2lzdGVyQ2hlY2tGbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgXCJQcmVSZWdpc3RlckNoZWNrSGFuZGxlclwiLCB7XHJcbiAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfOSxcclxuICBoYW5kbGVyOiBcIlByZVJlZ2lzdGVyQ2hlY2suaGFuZGxlclwiLFxyXG4gIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcImxhbWJkYVwiKSxcclxuICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXHJcbiAgZW52aXJvbm1lbnQ6IHtcclxuICAgIEJVQ0tFVF9OQU1FOiBwcmVSZWdCdWNrZXQuYnVja2V0TmFtZSxcclxuICAgIFVTRVJfTUFOQUdFTUVOVF9UQUJMRTogdXNlclRhYmxlLnRhYmxlTmFtZSwgICAvLyBSRVFVSVJFRFxyXG4gICAgQ09MTEVDVElPTl9JRDogXCJWaXNpdG9yRmFjZUNvbGxlY3Rpb25cIixcclxuICB9LFxyXG59KTtcclxuXHJcbnByZVJlZ0J1Y2tldC5ncmFudFJlYWRXcml0ZShwcmVSZWdpc3RlckNoZWNrRm4pO1xyXG51c2VyVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHByZVJlZ2lzdGVyQ2hlY2tGbik7XHJcblxyXG5jb25zdCB2YWxpZGF0ZUltYWdlUmVzb3VyY2UgPSBhcGkucm9vdC5hZGRSZXNvdXJjZShcInZhbGlkYXRlLWltYWdlXCIpO1xyXG5cclxudmFsaWRhdGVJbWFnZVJlc291cmNlLmFkZENvcnNQcmVmbGlnaHQoe1xyXG4gIGFsbG93T3JpZ2luczogW1wiKlwiXSxcclxuICBhbGxvd01ldGhvZHM6IFtcIlBPU1RcIl0sXHJcbn0pO1xyXG5cclxudmFsaWRhdGVJbWFnZVJlc291cmNlLmFkZE1ldGhvZChcclxuICBcIlBPU1RcIixcclxuICBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24ocHJlUmVnaXN0ZXJDaGVja0ZuKSxcclxuICB7XHJcbiAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ3cuQXV0aG9yaXphdGlvblR5cGUuTk9ORSxcclxuICB9XHJcbik7XHJcblxyXG5cclxuXHJcbi8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4vLyBHRVQgSU1BR0UgKHJldHVybiBwcmVzaWduZWQgR0VUIFVSTClcclxuLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbmNvbnN0IGdldEltYWdlRm4gPSBuZXcgTm9kZWpzRnVuY3Rpb24odGhpcywgXCJHZXRQcmVzaWduZWREb3dubG9hZFVybEhhbmRsZXJcIiwge1xyXG4gIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxyXG4gIGVudHJ5OiBwYXRoLmpvaW4oX19kaXJuYW1lLCBcIi4uL2xhbWJkYS9nZW5lcmF0ZVByZXNpZ25lZERvd25sb2FkVXJsLnRzXCIpLFxyXG4gIGhhbmRsZXI6IFwiaGFuZGxlclwiLFxyXG4gIGVudmlyb25tZW50OiB7XHJcbiAgICBCVUNLRVRfTkFNRTogcHJlUmVnQnVja2V0LmJ1Y2tldE5hbWUsXHJcbiAgfSxcclxufSk7XHJcblxyXG5wcmVSZWdCdWNrZXQuZ3JhbnRSZWFkKGdldEltYWdlRm4pO1xyXG5cclxuY29uc3QgZ2V0SW1hZ2VSZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKFwiZ2V0LWltYWdlXCIpO1xyXG5cclxuZ2V0SW1hZ2VSZXNvdXJjZS5hZGRDb3JzUHJlZmxpZ2h0KHtcclxuICBhbGxvd09yaWdpbnM6IFtcIipcIl0sXHJcbiAgYWxsb3dNZXRob2RzOiBbXCJHRVRcIl0sXHJcbn0pO1xyXG5cclxuZ2V0SW1hZ2VSZXNvdXJjZS5hZGRNZXRob2QoXHJcbiAgXCJHRVRcIixcclxuICBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24oZ2V0SW1hZ2VGbiksXHJcbiAge1xyXG4gICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWd3LkF1dGhvcml6YXRpb25UeXBlLk5PTkUsXHJcbiAgfVxyXG4pO1xyXG5cclxuXHJcblxyXG5cclxuXHJcblxyXG5cclxuICB9XHJcbn0iXX0=