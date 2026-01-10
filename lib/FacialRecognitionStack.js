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
exports.FacialRecognitionStack = void 0;
const cdk = __importStar(require("aws-cdk-lib/core"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const aws_iam_1 = require("aws-cdk-lib/aws-iam");
const aws_cdk_lib_1 = require("aws-cdk-lib");
const apigw = __importStar(require("aws-cdk-lib/aws-apigateway"));
const apigatewayv2 = __importStar(require("aws-cdk-lib/aws-apigatewayv2"));
const aws_apigatewayv2_integrations_1 = require("aws-cdk-lib/aws-apigatewayv2-integrations");
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const sns = __importStar(require("aws-cdk-lib/aws-sns"));
const subscriptions = __importStar(require("aws-cdk-lib/aws-sns-subscriptions"));
const path = __importStar(require("path"));
const aws_lambda_nodejs_1 = require("aws-cdk-lib/aws-lambda-nodejs");
class FacialRecognitionStack extends cdk.Stack {
    userTable;
    broadcastLambda;
    PreRegisterCheckExport;
    // restApi: apigw.RestApi; 
    constructor(scope, id, props) {
        super(scope, id, props);
        const prefixname = this.stackName.split('-')[0].toLowerCase(); // ✅ Add this
        //////////// DynamoDB Resources ////////////
        // Users Table
        this.userTable = new dynamodb.Table(this, 'userTable', {
            tableName: `${prefixname}-UserManagementTable1`,
            partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // serverless
            removalPolicy: cdk.RemovalPolicy.DESTROY, // only for dev/testing
        });
        // Ensure user record is extractable using the email field
        this.userTable.addGlobalSecondaryIndex({
            indexName: 'EmailIndex',
            partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        // Ensure user record is extractable using the faceId
        this.userTable.addGlobalSecondaryIndex({
            indexName: 'FaceIdIndex',
            partitionKey: { name: 'faceId', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL, // include all columns
        });
        // Add extra attributes 
        this.userTable.addGlobalSecondaryIndex({
            indexName: 'visitedIndex',
            partitionKey: { name: 'visited', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        // create table for invited visitors
        const InvitedVisitorTable = new dynamodb.Table(this, 'InvitedVisitorTable', {
            tableName: `${prefixname}-InvitedVisitorTable`,
            partitionKey: { name: 'visitorId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // serverless
            removalPolicy: cdk.RemovalPolicy.DESTROY, // only for dev/testing
        });
        // Ensure visitor record is extractable using the email field
        InvitedVisitorTable.addGlobalSecondaryIndex({
            indexName: 'EmailVisitDateIndex',
            partitionKey: {
                name: 'email',
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: {
                name: 'visitDate',
                type: dynamodb.AttributeType.STRING,
            },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        // create connection table
        const connection = new dynamodb.Table(this, "ConnectionTable", {
            tableName: `${prefixname}-ConnectionTable`,
            partitionKey: {
                name: "ConnectionId",
                type: dynamodb.AttributeType.STRING,
            },
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // Active Users analytics table
        const websiteActivityTable = new dynamodb.Table(this, "WebsiteActivityTable", {
            tableName: `${prefixname}-WebsiteActivityTable`,
            partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
            sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            timeToLiveAttribute: "ttl",
        });
        //////////// S3 Resources ////////////
        //create S3 Bucket for images and static files
        const bucket = new s3.Bucket(this, 'BahtwinTestBucket', {
            bucketName: `${prefixname}-bahtwin-testing`,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });
        //////////// Rekognition Resources ////////////
        // Create an Amazon Rekognition Collection
        const collection = new aws_cdk_lib_1.aws_rekognition.CfnCollection(this, 'bahtwin-testing-collection', {
            collectionId: `${prefixname}-bahtwin-testing-collection`,
        });
        //////////// SNS Resources ////////////
        // Create an SNS topic
        const arrivalTopic = new sns.Topic(this, 'VisitorArrivalTopic', {
            topicName: `${prefixname}-VisitorArrivalNotifications`,
        });
        arrivalTopic.addSubscription(new subscriptions.SmsSubscription("+97332233417"));
        //////////// Lambda Resources ////////////
        //create lambda to send feedback
        const sendFeedbackLambda = new lambda.Function(this, 'SendFeedbackLambda', {
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: 'sendFeedbackLambda.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../lambda'), {
                bundling: {
                    image: lambda.Runtime.PYTHON_3_11.bundlingImage,
                    command: [
                        "bash", "-c",
                        `
            pip install -r requirements.txt -t /asset-output &&
            cp -r . /asset-output
            `
                    ],
                },
            }),
            environment: {
                JWT_SECRET: 'secret', // same as before
                FRONTEND_URL: 'https://d3pah2wsw5ry03.cloudfront.net/VisitorFeedBack', //  frontend link 
                GMAIL_USER: '	bahtwinnoreply@gmail.com', // Gmail address for sending
                GMAIL_PASS: 'zdjl cdgw kxzb okny', // Gmail app password
                WORKMAIL_USER: 'no-reply@bahtwin.awsapps.com',
                WORKMAIL_PASS: 'Test1234*',
                WORKMAIL_SMTP: 'smtp.mail.us-east-1.awsapps.com',
            },
            timeout: cdk.Duration.seconds(30),
            //functionName: 'SendFeedbackLambda',
            logRetention: logs.RetentionDays.ONE_DAY
        });
        //create lambda to load dashboard
        const LoadDashboard = new lambda.Function(this, 'LoadDashboard', {
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: 'LoadDashboard.handler',
            code: lambda.Code.fromAsset('lambda'),
            environment: {
                InviteTable: InvitedVisitorTable.tableName,
                USER_TABLE: this.userTable.tableName,
                WEBSITE_ACTIVITY_TABLE: websiteActivityTable.tableName
            },
            timeout: cdk.Duration.seconds(30),
            //functionName: 'LoadDashboard', 
            logRetention: logs.RetentionDays.ONE_DAY, // <- CDK will manage the log group
        });
        //connect lambda function
        const wsConnectLambda = new lambda.Function(this, 'ws-connect-lambda', {
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: 'ws_connect.handler',
            code: lambda.Code.fromAsset('lambda'),
            timeout: cdk.Duration.seconds(30),
            //functionName: 'connect-lambda', 
            environment: {
                TABLE_NAME: connection.tableName,
                WS_TOKEN: "YZ0CLr6sRvWwTjPAccFHj6JdHY6HetrDq39ogV75TDDqijQsYJkO1LDgqYERCbLS"
            },
            logRetention: logs.RetentionDays.ONE_DAY, // <- CDK will manage the log group
        });
        //disable lambda function
        const wsDisconnectLambda = new lambda.Function(this, 'ws-disconnect-lambda', {
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: 'ws_disable.handler',
            code: lambda.Code.fromAsset('lambda'),
            timeout: cdk.Duration.seconds(30),
            //functionName: 'disconnect-lambda', 
            logRetention: logs.RetentionDays.ONE_DAY, // <- CDK will manage the log group
        });
        // Create websocket API for real time admin dashboard
        const wsAPI = new apigatewayv2.WebSocketApi(this, "AdminDashboardWS", {
            connectRouteOptions: {
                integration: new aws_apigatewayv2_integrations_1.WebSocketLambdaIntegration('ws-connect-integration', wsConnectLambda),
            },
            disconnectRouteOptions: {
                integration: new aws_apigatewayv2_integrations_1.WebSocketLambdaIntegration('ws-disconnect-integration', wsDisconnectLambda),
            },
        });
        const apiStage = new apigatewayv2.WebSocketStage(this, 'dev', {
            webSocketApi: wsAPI,
            stageName: 'dev',
            autoDeploy: true,
        });
        const managementApiEndpoint = cdk.Fn.join("", [
            "https://",
            cdk.Fn.select(2, cdk.Fn.split("/", wsAPI.apiEndpoint)),
            "/",
            apiStage.stageName
        ]);
        //boradcast lambda
        this.broadcastLambda = new lambda.Function(this, 'ws-broadcast-lambda', {
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: 'broadcast.handler',
            code: lambda.Code.fromAsset('lambda'),
            timeout: cdk.Duration.seconds(30),
            //functionName: 'broadcast-lambda',
            environment: {
                TABLE_NAME: connection.tableName,
                WS_ENDPOINT: managementApiEndpoint,
            },
            initialPolicy: [
                new iam.PolicyStatement({
                    effect: aws_iam_1.Effect.ALLOW,
                    actions: ["execute-api:ManageConnections"],
                    resources: [`arn:aws:execute-api:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:${wsAPI.apiId}/${apiStage.stageName}/*/@connections/*`],
                }),
            ],
            logRetention: logs.RetentionDays.ONE_DAY,
        });
        //create lambda for arrivals picture
        const ArrivalRekognition = new lambda.Function(this, 'Arrival_Handler', {
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: 'ArrivalRekognition.ArrivalRekognition',
            code: lambda.Code.fromAsset('lambda'),
            environment: {
                BUCKET_NAME: bucket.bucketName,
                COLLECTION_ID: collection.collectionId,
                USER_TABLE: this.userTable.tableName,
                TOPIC_ARN: arrivalTopic.topicArn,
                InviteTable: InvitedVisitorTable.tableName,
                BROADCAST_LAMBDA: this.broadcastLambda.functionArn,
            },
            timeout: cdk.Duration.seconds(30),
            //functionName: 'ArrivalRekognition', 
            logRetention: logs.RetentionDays.ONE_DAY, // <- CDK will manage the log group
        });
        //create lambda for pre registration
        const PreRegisterCheck = new lambda.Function(this, 'lambda_pre_register_check_Handler', {
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: 'PreRegisterCheck.PreRegisterCheck',
            code: lambda.Code.fromAsset('lambda'),
            environment: {
                BUCKET_NAME: bucket.bucketName,
                COLLECTION_ID: collection.collectionId,
                USER_TABLE: this.userTable.tableName,
                BROADCAST_LAMBDA: this.broadcastLambda.functionArn,
            },
            timeout: cdk.Duration.seconds(30),
            //functionName: 'PreRegisterCheck', 
            logRetention: logs.RetentionDays.ONE_DAY, // <- CDK will manage the log group
        });
        this.PreRegisterCheckExport = PreRegisterCheck;
        //create lambda to save individual visitor invite
        const RegisterIndividualVisitor = new lambda.Function(this, 'RegisterIndividualVisitor', {
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: 'RegisterIndividualVisitor.handler',
            code: lambda.Code.fromAsset('lambda'),
            environment: {
                GMAIL_USER: '	bahtwinnoreply@gmail.com', // Gmail address for sending
                GMAIL_PASS: 'zdjl cdgw kxzb okny', // Gmail app password
                WORKMAIL_USER: 'no-reply@bahtwin.awsapps.com',
                WORKMAIL_PASS: 'Test1234*',
                WORKMAIL_SMTP: 'smtp.mail.us-east-1.awsapps.com',
                InviteTable: InvitedVisitorTable.tableName,
                BROADCAST_LAMBDA: this.broadcastLambda.functionArn
            },
            timeout: cdk.Duration.seconds(30),
            //functionName: 'RegisterIndividualVisitor', 
            logRetention: logs.RetentionDays.ONE_DAY, // <- CDK will manage the log group
        });
        //create lambda for bulk upload invites
        const RegisterBulkVisitor = new lambda.Function(this, 'RegisterBulkVisitor', {
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: 'RegisterBulkVisitor.handler',
            code: lambda.Code.fromAsset('lambda'),
            environment: {
                GMAIL_USER: '	bahtwinnoreply@gmail.com', // Gmail address for sending
                GMAIL_PASS: 'zdjl cdgw kxzb okny', // Gmail app password
                WORKMAIL_USER: 'no-reply@bahtwin.awsapps.com',
                WORKMAIL_PASS: 'Test1234*',
                WORKMAIL_SMTP: 'smtp.mail.us-east-1.awsapps.com',
                InviteTable: InvitedVisitorTable.tableName,
                BROADCAST_LAMBDA: this.broadcastLambda.functionArn
            },
            timeout: cdk.Duration.seconds(30),
            //functionName: 'RegisterBulkVisitor', 
            logRetention: logs.RetentionDays.ONE_DAY, // <- CDK will manage the log group
        });
        //get user info lambda
        const GetUserInfo = new lambda.Function(this, 'GetUserInfo', {
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: 'GetUserInfo.handler',
            code: lambda.Code.fromAsset('lambda'),
            environment: {
                USER_TABLE: this.userTable.tableName,
                BUCKET_NAME: bucket.bucketName
            },
            timeout: cdk.Duration.seconds(30),
            //functionName: 'GetUserInfo', 
            logRetention: logs.RetentionDays.ONE_DAY, // <- CDK will manage the log group
        });
        bucket.grantRead(GetUserInfo);
        //////////// Grant permissions to Resources ////////////
        // Grant permissions for lambdas to S3 and the user table
        bucket.grantReadWrite(PreRegisterCheck);
        bucket.grantReadWrite(ArrivalRekognition);
        this.userTable.grantReadWriteData(PreRegisterCheck);
        this.userTable.grantReadWriteData(ArrivalRekognition);
        this.userTable.grantReadWriteData(LoadDashboard);
        websiteActivityTable.grantReadWriteData(LoadDashboard);
        this.userTable.grantReadWriteData(GetUserInfo);
        const registerRole = PreRegisterCheck.role;
        const arrivalRole = ArrivalRekognition.role;
        sendFeedbackLambda.grantInvoke(arrivalRole);
        InvitedVisitorTable.grantReadWriteData(RegisterIndividualVisitor);
        InvitedVisitorTable.grantReadWriteData(RegisterBulkVisitor);
        InvitedVisitorTable.grantReadWriteData(ArrivalRekognition);
        InvitedVisitorTable.grantReadWriteData(LoadDashboard);
        const individualRegisterRole = RegisterIndividualVisitor.role;
        const BulkRegisterRole = RegisterBulkVisitor.role;
        // Grant Lambda permission to publish to SNS
        arrivalTopic.grantPublish(ArrivalRekognition);
        // Give permissions for PreRegisterCheck lambda to use Amazon Rekognition 
        PreRegisterCheck.addToRolePolicy(new iam.PolicyStatement({
            actions: [
                'rekognition:IndexFaces',
                'rekognition:SearchFacesByImage',
                'rekognition:DetectFaces',
            ],
            resources: ['*'],
        }));
        // Give permissions for ArrivalRekognition lambda to use Amazon Rekognition 
        ArrivalRekognition.addToRolePolicy(new iam.PolicyStatement({
            actions: [
                'rekognition:IndexFaces',
                'rekognition:SearchFacesByImage',
                'rekognition:DetectFaces',
            ],
            resources: ['*'],
        }));
        ArrivalRekognition.addToRolePolicy(new iam.PolicyStatement({
            actions: ["sns:Publish"],
            resources: ["*"],
        }));
        //grant permissions to connect lambda and disable lambda to edit the table created
        connection.grantReadWriteData(wsConnectLambda);
        connection.grantReadWriteData(wsDisconnectLambda);
        connection.grantReadWriteData(this.broadcastLambda);
        wsAPI.addRoute("$default", { integration: new aws_apigatewayv2_integrations_1.WebSocketLambdaIntegration("id", this.broadcastLambda) });
        // enable other functions to call bradcast function
        this.broadcastLambda.grantInvoke(arrivalRole);
        this.broadcastLambda.grantInvoke(registerRole);
        this.broadcastLambda.grantInvoke(individualRegisterRole);
        this.broadcastLambda.grantInvoke(BulkRegisterRole);
        //////////// API  Resources ////////////
        //create API
        const api_arrival = new apigw.RestApi(this, 'api_arrival', {
            restApiName: `${prefixname}-Bahtwin-Visitor-API`,
        });
        // create visitor resource for the api
        const visitorResource = api_arrival.root.addResource('visitor');
        // create arrival resource under the visitor resource
        const arrivalResource = visitorResource.addResource('arrival');
        // create register resource under the visitor resource
        const registerResource = visitorResource.addResource('register');
        // connect POST to Lambda
        arrivalResource.addMethod('POST', new apigw.LambdaIntegration(ArrivalRekognition, {
            proxy: true,
        }));
        // connect POST to Lambda
        registerResource.addMethod('POST', new apigw.LambdaIntegration(PreRegisterCheck, {
            proxy: true,
        }));
        //// create admin resource for the api
        const adminResource = api_arrival.root.addResource('admin');
        // create individual register resource under the admin resource
        const registerVisitorIndividual = adminResource.addResource('registerVisitorIndividual');
        // connect POST to Lambda
        registerVisitorIndividual.addMethod('POST', new apigw.LambdaIntegration(RegisterIndividualVisitor, {
            proxy: true,
        }));
        // create bulk register resource under the admin resource
        const registerVisitorBulk = adminResource.addResource('registerVisitorBulk');
        // connect POST to Lambda
        registerVisitorBulk.addMethod('POST', new apigw.LambdaIntegration(RegisterBulkVisitor, {
            proxy: true,
        }));
        // create dashboard resource under the admin resource
        const load_Dashboard = adminResource.addResource('loadDashboard');
        // connect GET to Lambda
        load_Dashboard.addMethod('POST', new apigw.LambdaIntegration(LoadDashboard, {
            proxy: true,
        }));
        const getUserInfo = visitorResource.addResource('me');
        getUserInfo.addMethod('GET', new apigw.LambdaIntegration(GetUserInfo, {
            proxy: true
        }));
        arrivalResource.addMethod('OPTIONS', new apigw.MockIntegration({
            integrationResponses: [{
                    statusCode: '200',
                    responseParameters: {
                        'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
                        'method.response.header.Access-Control-Allow-Origin': "'*'",
                        'method.response.header.Access-Control-Allow-Methods': "'POST,OPTIONS'",
                    },
                }],
            passthroughBehavior: apigw.PassthroughBehavior.NEVER,
            requestTemplates: {
                'application/json': '{"statusCode": 200}'
            },
        }), {
            methodResponses: [{
                    statusCode: '200',
                    responseParameters: {
                        'method.response.header.Access-Control-Allow-Headers': true,
                        'method.response.header.Access-Control-Allow-Methods': true,
                        'method.response.header.Access-Control-Allow-Origin': true,
                    },
                }],
        });
        registerResource.addMethod('OPTIONS', new apigw.MockIntegration({
            integrationResponses: [{
                    statusCode: '200',
                    responseParameters: {
                        'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
                        'method.response.header.Access-Control-Allow-Origin': "'*'",
                        'method.response.header.Access-Control-Allow-Methods': "'POST,OPTIONS'",
                    },
                }],
            passthroughBehavior: apigw.PassthroughBehavior.NEVER,
            requestTemplates: {
                'application/json': '{"statusCode": 200}'
            },
        }), {
            methodResponses: [{
                    statusCode: '200',
                    responseParameters: {
                        'method.response.header.Access-Control-Allow-Headers': true,
                        'method.response.header.Access-Control-Allow-Methods': true,
                        'method.response.header.Access-Control-Allow-Origin': true,
                    },
                }],
        });
        registerVisitorIndividual.addMethod('OPTIONS', new apigw.MockIntegration({
            integrationResponses: [{
                    statusCode: '200',
                    responseParameters: {
                        'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
                        'method.response.header.Access-Control-Allow-Origin': "'*'",
                        'method.response.header.Access-Control-Allow-Methods': "'POST,OPTIONS'",
                    },
                }],
            passthroughBehavior: apigw.PassthroughBehavior.NEVER,
            requestTemplates: {
                'application/json': '{"statusCode": 200}'
            },
        }), {
            methodResponses: [{
                    statusCode: '200',
                    responseParameters: {
                        'method.response.header.Access-Control-Allow-Headers': true,
                        'method.response.header.Access-Control-Allow-Methods': true,
                        'method.response.header.Access-Control-Allow-Origin': true,
                    },
                }],
        });
        registerVisitorBulk.addMethod('OPTIONS', new apigw.MockIntegration({
            integrationResponses: [{
                    statusCode: '200',
                    responseParameters: {
                        'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
                        'method.response.header.Access-Control-Allow-Origin': "'*'",
                        'method.response.header.Access-Control-Allow-Methods': "'POST,OPTIONS'",
                    },
                }],
            passthroughBehavior: apigw.PassthroughBehavior.NEVER,
            requestTemplates: {
                'application/json': '{"statusCode": 200}'
            },
        }), {
            methodResponses: [{
                    statusCode: '200',
                    responseParameters: {
                        'method.response.header.Access-Control-Allow-Headers': true,
                        'method.response.header.Access-Control-Allow-Methods': true,
                        'method.response.header.Access-Control-Allow-Origin': true,
                    },
                }],
        });
        load_Dashboard.addMethod('OPTIONS', new apigw.MockIntegration({
            integrationResponses: [{
                    statusCode: '200',
                    responseParameters: {
                        'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
                        'method.response.header.Access-Control-Allow-Origin': "'*'",
                        'method.response.header.Access-Control-Allow-Methods': "'POST,OPTIONS'",
                    },
                }],
            passthroughBehavior: apigw.PassthroughBehavior.NEVER,
            requestTemplates: {
                'application/json': '{"statusCode": 200}'
            },
        }), {
            methodResponses: [{
                    statusCode: '200',
                    responseParameters: {
                        'method.response.header.Access-Control-Allow-Headers': true,
                        'method.response.header.Access-Control-Allow-Methods': true,
                        'method.response.header.Access-Control-Allow-Origin': true,
                    },
                }],
        });
        getUserInfo.addMethod('OPTIONS', new apigw.MockIntegration({
            integrationResponses: [{
                    statusCode: '200',
                    responseParameters: {
                        'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
                        'method.response.header.Access-Control-Allow-Origin': "'*'",
                        'method.response.header.Access-Control-Allow-Methods': "'POST,OPTIONS'",
                    },
                }],
            passthroughBehavior: apigw.PassthroughBehavior.NEVER,
            requestTemplates: {
                'application/json': '{"statusCode": 200}'
            },
        }), {
            methodResponses: [{
                    statusCode: '200',
                    responseParameters: {
                        'method.response.header.Access-Control-Allow-Headers': true,
                        'method.response.header.Access-Control-Allow-Methods': true,
                        'method.response.header.Access-Control-Allow-Origin': true,
                    },
                }],
        });
        // ────────────────────────────────
        // GET IMAGE URL (presigned GET URL)
        // ────────────────────────────────
        const getImageUrlFn = new aws_lambda_nodejs_1.NodejsFunction(this, "GeneratePresignedImageUrlHandler", {
            runtime: lambda.Runtime.NODEJS_18_X,
            entry: path.join(__dirname, "../lambda/generatePresignedDownloadUrl.ts"),
            handler: "handler",
            environment: {
                BUCKET_NAME: bucket.bucketName,
                USER_TABLE: this.userTable.tableName,
            },
            timeout: cdk.Duration.seconds(30),
        });
        // Permissions
        bucket.grantRead(getImageUrlFn);
        this.userTable.grantReadData(getImageUrlFn);
        // API Gateway: w
        const getImageUrlResource = visitorResource.addResource("get-image-url");
        getImageUrlResource.addCorsPreflight({
            allowOrigins: ["*"],
            allowMethods: ["GET"],
        });
        getImageUrlResource.addMethod("GET", new apigw.LambdaIntegration(getImageUrlFn, { proxy: true }), { authorizationType: apigw.AuthorizationType.NONE });
        new cdk.CfnOutput(this, 'AdminApiBaseUrl', {
            value: api_arrival.urlForPath('/admin/'),
            exportName: `${prefixname}-AdminApiBaseUrl`,
        });
        // active users
        const websiteHeartbeatLambda = new aws_lambda_nodejs_1.NodejsFunction(this, "WebsiteHeartbeatLambda", {
            runtime: lambda.Runtime.NODEJS_18_X,
            entry: path.join(__dirname, "../lambda/heartbeat.ts"),
            handler: "handler",
            environment: {
                WEBSITE_ACTIVITY_TABLE: websiteActivityTable.tableName,
                BROADCAST_LAMBDA: this.broadcastLambda.functionArn,
            },
        });
        const heartbeatResource = visitorResource.addResource("heartbeat");
        heartbeatResource.addMethod("POST", new apigw.LambdaIntegration(websiteHeartbeatLambda));
        heartbeatResource.addMethod('OPTIONS', new apigw.MockIntegration({
            integrationResponses: [{
                    statusCode: '200',
                    responseParameters: {
                        'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
                        'method.response.header.Access-Control-Allow-Origin': "'*'",
                        'method.response.header.Access-Control-Allow-Methods': "'POST,OPTIONS'",
                    },
                }],
            passthroughBehavior: apigw.PassthroughBehavior.NEVER,
            requestTemplates: {
                'application/json': '{"statusCode": 200}'
            },
        }), {
            methodResponses: [{
                    statusCode: '200',
                    responseParameters: {
                        'method.response.header.Access-Control-Allow-Headers': true,
                        'method.response.header.Access-Control-Allow-Methods': true,
                        'method.response.header.Access-Control-Allow-Origin': true,
                    },
                }],
        });
        websiteActivityTable.grantReadWriteData(websiteHeartbeatLambda);
        const heartbeatRole = websiteHeartbeatLambda.role;
        this.broadcastLambda.grantInvoke(heartbeatRole);
        // GET USER BADGE INFO (Unity)
        const getUserBadgeInfoFn = new aws_lambda_nodejs_1.NodejsFunction(this, "GetUserBadgeInfoHandler", {
            runtime: lambda.Runtime.NODEJS_18_X,
            entry: path.join(__dirname, "../lambda/getUserBadgeInfo.ts"),
            handler: "handler",
            environment: {
                USER_TABLE: this.userTable.tableName,
                BUCKET_NAME: bucket.bucketName,
            },
        });
        this.userTable.grantReadWriteData(getUserBadgeInfoFn);
        bucket.grantRead(getUserBadgeInfoFn);
        const badgeResource = visitorResource.addResource("badge");
        badgeResource.addMethod("POST", new apigw.LambdaIntegration(getUserBadgeInfoFn), { authorizationType: apigw.AuthorizationType.NONE });
        badgeResource.addCorsPreflight({
            allowOrigins: ["*"],
            allowMethods: ["POST"],
        });
    }
}
exports.FacialRecognitionStack = FacialRecognitionStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRmFjaWFsUmVjb2duaXRpb25TdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIkZhY2lhbFJlY29nbml0aW9uU3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxzREFBd0M7QUFFeEMsdURBQXdDO0FBQ3hDLCtEQUFpRDtBQUNqRCx5REFBMkM7QUFDM0MsaURBQTZDO0FBQzdDLDZDQUE2RDtBQUM3RCxrRUFBb0Q7QUFDcEQsMkVBQTZEO0FBQzdELDZGQUF1RjtBQUN2RiwyREFBNkM7QUFDN0MsbUVBQXFEO0FBQ3JELHlEQUEyQztBQUMzQyxpRkFBbUU7QUFDbkUsMkNBQTZCO0FBQzdCLHFFQUErRDtBQUUvRCxNQUFhLHNCQUF1QixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ25DLFNBQVMsQ0FBaUI7SUFDMUIsZUFBZSxDQUFrQjtJQUNqQyxzQkFBc0IsQ0FBa0I7SUFDekQsMkJBQTJCO0lBRzFCLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDOUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFHeEIsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBRSxhQUFhO1FBQzdFLDRDQUE0QztRQUc1QyxjQUFjO1FBQ2QsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRTtZQUNyRCxTQUFTLEVBQUUsR0FBRyxVQUFVLHVCQUF1QjtZQUMvQyxZQUFZLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtZQUNyRSxXQUFXLEVBQUUsUUFBUSxDQUFDLFdBQVcsQ0FBQyxlQUFlLEVBQUUs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QUM7WUFDNUQsT0FBTyxFQUFFLFNBQVM7WUFDbEIsV0FBVyxFQUFFO2dCQUNYLFVBQVUsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVM7Z0JBQ3BDLFdBQVcsRUFBRSxNQUFNLENBQUMsVUFBVTthQUMvQjtTQUNGLENBQ0YsQ0FBQztRQUVGLElBQUksQ0FBQyxTQUFTLENBQUMsa0JBQWtCLENBQUMsa0JBQWtCLENBQUMsQ0FBQztRQUN0RCxNQUFNLENBQUMsU0FBUyxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFFckMsTUFBTSxhQUFhLEdBQUcsZUFBZSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUMzRCxhQUFhLENBQUMsU0FBUyxDQUNyQixNQUFNLEVBQ04sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsa0JBQWtCLENBQUMsRUFDL0MsRUFBRSxpQkFBaUIsRUFBRSxLQUFLLENBQUMsaUJBQWlCLENBQUMsSUFBSSxFQUFFLENBQ3BELENBQUM7UUFFRixhQUFhLENBQUMsZ0JBQWdCLENBQUM7WUFDN0IsWUFBWSxFQUFFLENBQUMsR0FBRyxDQUFDO1lBQ25CLFlBQVksRUFBRSxDQUFDLE1BQU0sQ0FBQztTQUN2QixDQUFDLENBQUM7SUFFRCxDQUFDO0NBQ0Y7QUFwc0JELHdEQW9zQkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWIvY29yZSc7XHJcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xyXG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnXHJcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcclxuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xyXG5pbXBvcnQgeyBFZmZlY3QgfSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWlhbVwiO1xyXG5pbXBvcnQgeyBhd3NfcmVrb2duaXRpb24gYXMgcmVrb2duaXRpb24gfSBmcm9tICdhd3MtY2RrLWxpYic7XHJcbmltcG9ydCAqIGFzIGFwaWd3IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcclxuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheXYyIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheXYyXCI7XHJcbmltcG9ydCB7IFdlYlNvY2tldExhbWJkYUludGVncmF0aW9uIH0gZnJvbSBcImF3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5djItaW50ZWdyYXRpb25zXCI7XHJcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xyXG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xyXG5pbXBvcnQgKiBhcyBzbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNucyc7XHJcbmltcG9ydCAqIGFzIHN1YnNjcmlwdGlvbnMgZnJvbSBcImF3cy1jZGstbGliL2F3cy1zbnMtc3Vic2NyaXB0aW9uc1wiO1xyXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xyXG5pbXBvcnQgeyBOb2RlanNGdW5jdGlvbiB9IGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtbGFtYmRhLW5vZGVqc1wiO1xyXG5cclxuZXhwb3J0IGNsYXNzIEZhY2lhbFJlY29nbml0aW9uU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xyXG4gIHB1YmxpYyByZWFkb25seSB1c2VyVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xyXG4gIHB1YmxpYyByZWFkb25seSBicm9hZGNhc3RMYW1iZGE6IGxhbWJkYS5GdW5jdGlvbjtcclxuICBwdWJsaWMgcmVhZG9ubHkgUHJlUmVnaXN0ZXJDaGVja0V4cG9ydDogbGFtYmRhLkZ1bmN0aW9uO1xyXG4gLy8gcmVzdEFwaTogYXBpZ3cuUmVzdEFwaTsgXHJcblxyXG4gIFxyXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcclxuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xyXG5cclxuXHJcbiAgICBjb25zdCBwcmVmaXhuYW1lID0gdGhpcy5zdGFja05hbWUuc3BsaXQoJy0nKVswXS50b0xvd2VyQ2FzZSgpOyAgLy8g4pyFIEFkZCB0aGlzXHJcbiAgICAvLy8vLy8vLy8vLy8gRHluYW1vREIgUmVzb3VyY2VzIC8vLy8vLy8vLy8vL1xyXG5cclxuICAgIFxyXG4gICAgLy8gVXNlcnMgVGFibGVcclxuICAgIHRoaXMudXNlclRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICd1c2VyVGFibGUnLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogYCR7cHJlZml4bmFtZX0tVXNlck1hbmFnZW1lbnRUYWJsZTFgLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3VzZXJJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsIC8vIHNlcnZlcmxlc3NcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSwgLy8gb25seSBmb3IgZGV2L3Rlc3RpbmdcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAvLyBFbnN1cmUgdXNlciByZWNvcmQgaXMgZXh0cmFjdGFibGUgdXNpbmcgdGhlIGVtYWlsIGZpZWxkXHJcbiAgICB0aGlzLnVzZXJUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgIGluZGV4TmFtZTogJ0VtYWlsSW5kZXgnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2VtYWlsJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcclxuICAgICAgfSk7XHJcblxyXG4gICAgLy8gRW5zdXJlIHVzZXIgcmVjb3JkIGlzIGV4dHJhY3RhYmxlIHVzaW5nIHRoZSBmYWNlSWRcclxuICAgIHRoaXMudXNlclRhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgICAgaW5kZXhOYW1lOiAnRmFjZUlkSW5kZXgnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2ZhY2VJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHByb2plY3Rpb25UeXBlOiBkeW5hbW9kYi5Qcm9qZWN0aW9uVHlwZS5BTEwsIC8vIGluY2x1ZGUgYWxsIGNvbHVtbnNcclxuICAgICAgfSk7XHJcbiAgICAgICAgICBcclxuICAgIC8vIEFkZCBleHRyYSBhdHRyaWJ1dGVzIFxyXG4gICAgdGhpcy51c2VyVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgICBpbmRleE5hbWU6ICd2aXNpdGVkSW5kZXgnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3Zpc2l0ZWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxyXG4gICAgICB9KTtcclxuXHJcbiAgICAvLyBjcmVhdGUgdGFibGUgZm9yIGludml0ZWQgdmlzaXRvcnNcclxuICAgIGNvbnN0IEludml0ZWRWaXNpdG9yVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ0ludml0ZWRWaXNpdG9yVGFibGUnLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogYCR7cHJlZml4bmFtZX0tSW52aXRlZFZpc2l0b3JUYWJsZWAsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAndmlzaXRvcklkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCwgLy8gc2VydmVybGVzc1xyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLCAvLyBvbmx5IGZvciBkZXYvdGVzdGluZ1xyXG4gICAgICB9KTtcclxuXHJcbiAgICAvLyBFbnN1cmUgdmlzaXRvciByZWNvcmQgaXMgZXh0cmFjdGFibGUgdXNpbmcgdGhlIGVtYWlsIGZpZWxkXHJcbiAgICBJbnZpdGVkVmlzaXRvclRhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgICAgICBpbmRleE5hbWU6ICdFbWFpbFZpc2l0RGF0ZUluZGV4JyxcclxuICAgICAgICBwYXJ0aXRpb25LZXk6IHtcclxuICAgICAgICAgIG5hbWU6ICdlbWFpbCcsXHJcbiAgICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcclxuICAgICAgICB9LFxyXG4gICAgICAgIHNvcnRLZXk6IHtcclxuICAgICAgICAgIG5hbWU6ICd2aXNpdERhdGUnLFxyXG4gICAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXHJcbiAgICAgICAgfSxcclxuICAgICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIC8vIGNyZWF0ZSBjb25uZWN0aW9uIHRhYmxlXHJcbiAgICAgIGNvbnN0IGNvbm5lY3Rpb24gPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgXCJDb25uZWN0aW9uVGFibGVcIix7XHJcbiAgICAgICAgICAgIHRhYmxlTmFtZTogYCR7cHJlZml4bmFtZX0tQ29ubmVjdGlvblRhYmxlYCxcclxuICAgICAgICAgICAgcGFydGl0aW9uS2V5OntcclxuICAgICAgICAgICAgICAgIG5hbWU6IFwiQ29ubmVjdGlvbklkXCIsXHJcbiAgICAgICAgICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICAgICAgfSk7ICAgXHJcbiAgICAgICAgXHJcbiAgICAgIC8vIEFjdGl2ZSBVc2VycyBhbmFseXRpY3MgdGFibGVcclxuICAgICAgY29uc3Qgd2Vic2l0ZUFjdGl2aXR5VGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgXCJXZWJzaXRlQWN0aXZpdHlUYWJsZVwiLCB7XHJcbiAgICAgICAgdGFibGVOYW1lOiBgJHtwcmVmaXhuYW1lfS1XZWJzaXRlQWN0aXZpdHlUYWJsZWAsXHJcbiAgICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6IFwicGtcIiwgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgICBzb3J0S2V5OiB7IG5hbWU6IFwic2tcIiwgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxyXG4gICAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICAgICAgdGltZVRvTGl2ZUF0dHJpYnV0ZTogXCJ0dGxcIixcclxuICAgICAgfSk7XHJcblxyXG4gICAgLy8vLy8vLy8vLy8vIFMzIFJlc291cmNlcyAvLy8vLy8vLy8vLy9cclxuXHJcbiAgICAvL2NyZWF0ZSBTMyBCdWNrZXQgZm9yIGltYWdlcyBhbmQgc3RhdGljIGZpbGVzXHJcbiAgICBjb25zdCBidWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdCYWh0d2luVGVzdEJ1Y2tldCcse1xyXG4gICAgICBidWNrZXROYW1lOiBgJHtwcmVmaXhuYW1lfS1iYWh0d2luLXRlc3RpbmdgLFxyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxyXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czp0cnVlLFxyXG4gICAgICB9KTtcclxuICAgIFxyXG4gICAgLy8vLy8vLy8vLy8vIFJla29nbml0aW9uIFJlc291cmNlcyAvLy8vLy8vLy8vLy9cclxuXHJcbiAgICAvLyBDcmVhdGUgYW4gQW1hem9uIFJla29nbml0aW9uIENvbGxlY3Rpb25cclxuICAgIGNvbnN0IGNvbGxlY3Rpb249IG5ldyByZWtvZ25pdGlvbi5DZm5Db2xsZWN0aW9uKHRoaXMsICdiYWh0d2luLXRlc3RpbmctY29sbGVjdGlvbicsIHtcclxuICAgICAgY29sbGVjdGlvbklkOiBgJHtwcmVmaXhuYW1lfS1iYWh0d2luLXRlc3RpbmctY29sbGVjdGlvbmAsIFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8vLy8vLy8vLy8vIFNOUyBSZXNvdXJjZXMgLy8vLy8vLy8vLy8vXHJcblxyXG4gICAgLy8gQ3JlYXRlIGFuIFNOUyB0b3BpY1xyXG4gICAgY29uc3QgYXJyaXZhbFRvcGljID0gbmV3IHNucy5Ub3BpYyh0aGlzLCAnVmlzaXRvckFycml2YWxUb3BpYycsIHtcclxuICAgICAgdG9waWNOYW1lOiBgJHtwcmVmaXhuYW1lfS1WaXNpdG9yQXJyaXZhbE5vdGlmaWNhdGlvbnNgLFxyXG4gICAgfSk7XHJcbiAgICBhcnJpdmFsVG9waWMuYWRkU3Vic2NyaXB0aW9uKFxyXG4gIG5ldyBzdWJzY3JpcHRpb25zLlNtc1N1YnNjcmlwdGlvbihcIis5NzMzMjIzMzQxN1wiKVxyXG4pO1xyXG5cclxuICAgIC8vLy8vLy8vLy8vLyBMYW1iZGEgUmVzb3VyY2VzIC8vLy8vLy8vLy8vL1xyXG5cclxuICAgIC8vY3JlYXRlIGxhbWJkYSB0byBzZW5kIGZlZWRiYWNrXHJcbiAgICBjb25zdCBzZW5kRmVlZGJhY2tMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdTZW5kRmVlZGJhY2tMYW1iZGEnLCB7XHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzExLFxyXG4gICAgICBoYW5kbGVyOiAnc2VuZEZlZWRiYWNrTGFtYmRhLmhhbmRsZXInLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uL2xhbWJkYScpLCB7XHJcbiAgICAgICAgYnVuZGxpbmc6IHtcclxuICAgICAgICAgIGltYWdlOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMS5idW5kbGluZ0ltYWdlLFxyXG4gICAgICAgICAgY29tbWFuZDogW1xyXG4gICAgICAgICAgICBcImJhc2hcIiwgXCItY1wiLFxyXG4gICAgICAgICAgICBgXHJcbiAgICAgICAgICAgIHBpcCBpbnN0YWxsIC1yIHJlcXVpcmVtZW50cy50eHQgLXQgL2Fzc2V0LW91dHB1dCAmJlxyXG4gICAgICAgICAgICBjcCAtciAuIC9hc3NldC1vdXRwdXRcclxuICAgICAgICAgICAgYFxyXG4gICAgICAgICAgXSxcclxuICAgICAgICB9LFxyXG4gICAgICB9KSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICBKV1RfU0VDUkVUOiAnc2VjcmV0JywgIC8vIHNhbWUgYXMgYmVmb3JlXHJcbiAgICAgICAgRlJPTlRFTkRfVVJMOiAnaHR0cHM6Ly9kM3BhaDJ3c3c1cnkwMy5jbG91ZGZyb250Lm5ldC9WaXNpdG9yRmVlZEJhY2snLCAgLy8gIGZyb250ZW5kIGxpbmsgXHJcbiAgICAgICAgR01BSUxfVVNFUjogJ1x0YmFodHdpbm5vcmVwbHlAZ21haWwuY29tJywgICAgICAvLyBHbWFpbCBhZGRyZXNzIGZvciBzZW5kaW5nXHJcbiAgICAgICAgR01BSUxfUEFTUzogJ3pkamwgY2RndyBreHpiIG9rbnknLCAgICAgICAgLy8gR21haWwgYXBwIHBhc3N3b3JkXHJcbiAgICAgICAgV09SS01BSUxfVVNFUjogJ25vLXJlcGx5QGJhaHR3aW4uYXdzYXBwcy5jb20nLFxyXG4gICAgICAgIFdPUktNQUlMX1BBU1M6ICdUZXN0MTIzNConLFxyXG4gICAgICAgIFdPUktNQUlMX1NNVFA6ICdzbXRwLm1haWwudXMtZWFzdC0xLmF3c2FwcHMuY29tJyxcclxuICAgICAgICBcclxuICAgICAgfSxcclxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxyXG4gICAgICAvL2Z1bmN0aW9uTmFtZTogJ1NlbmRGZWVkYmFja0xhbWJkYScsXHJcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9EQVlcclxuICAgIH0pO1xyXG5cclxuICAgICAgICAvL2NyZWF0ZSBsYW1iZGEgdG8gbG9hZCBkYXNoYm9hcmRcclxuICAgIGNvbnN0IExvYWREYXNoYm9hcmQgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdMb2FkRGFzaGJvYXJkJyx7XHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzExLFxyXG4gICAgICBoYW5kbGVyOidMb2FkRGFzaGJvYXJkLmhhbmRsZXInLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYScpLFxyXG4gICAgICBlbnZpcm9ubWVudDp7XHJcbiAgICAgICAgSW52aXRlVGFibGU6IEludml0ZWRWaXNpdG9yVGFibGUudGFibGVOYW1lLFxyXG4gICAgICAgIFVTRVJfVEFCTEU6IHRoaXMudXNlclRhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgICBXRUJTSVRFX0FDVElWSVRZX1RBQkxFOiB3ZWJzaXRlQWN0aXZpdHlUYWJsZS50YWJsZU5hbWVcclxuICAgICAgfSxcclxuICAgICAgdGltZW91dDpjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXHJcbiAgICAgIC8vZnVuY3Rpb25OYW1lOiAnTG9hZERhc2hib2FyZCcsIFxyXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfREFZLCAvLyA8LSBDREsgd2lsbCBtYW5hZ2UgdGhlIGxvZyBncm91cFxyXG4gICAgfSk7XHJcblxyXG5cclxuICAgIC8vY29ubmVjdCBsYW1iZGEgZnVuY3Rpb25cclxuICAgIGNvbnN0IHdzQ29ubmVjdExhbWJkYSA9bmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnd3MtY29ubmVjdC1sYW1iZGEnLHtcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTEsXHJcbiAgICAgIGhhbmRsZXI6J3dzX2Nvbm5lY3QuaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhJyksXHJcbiAgICAgIHRpbWVvdXQ6Y2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxyXG4gICAgICAvL2Z1bmN0aW9uTmFtZTogJ2Nvbm5lY3QtbGFtYmRhJywgXHJcbiAgICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICAgIFRBQkxFX05BTUU6IGNvbm5lY3Rpb24udGFibGVOYW1lLFxyXG4gICAgICAgICAgV1NfVE9LRU46IFwiWVowQ0xyNnNSdld3VGpQQWNjRkhqNkpkSFk2SGV0ckRxMzlvZ1Y3NVRERHFpalFzWUprTzFMRGdxWUVSQ2JMU1wiXHJcbiAgICAgICAgfSxcclxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX0RBWSwgLy8gPC0gQ0RLIHdpbGwgbWFuYWdlIHRoZSBsb2cgZ3JvdXBcclxuICAgICAgfSk7XHJcbiAgICAgIC8vZGlzYWJsZSBsYW1iZGEgZnVuY3Rpb25cclxuICAgIGNvbnN0IHdzRGlzY29ubmVjdExhbWJkYSA9bmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnd3MtZGlzY29ubmVjdC1sYW1iZGEnLHtcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTEsXHJcbiAgICAgIGhhbmRsZXI6J3dzX2Rpc2FibGUuaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhJyksXHJcbiAgICAgIHRpbWVvdXQ6Y2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxyXG4gICAgICAvL2Z1bmN0aW9uTmFtZTogJ2Rpc2Nvbm5lY3QtbGFtYmRhJywgXHJcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9EQVksIC8vIDwtIENESyB3aWxsIG1hbmFnZSB0aGUgbG9nIGdyb3VwXHJcbiAgICAgIH0pO1xyXG5cclxuLy8gQ3JlYXRlIHdlYnNvY2tldCBBUEkgZm9yIHJlYWwgdGltZSBhZG1pbiBkYXNoYm9hcmRcclxuICBjb25zdCB3c0FQSSA9IG5ldyBhcGlnYXRld2F5djIuV2ViU29ja2V0QXBpKHRoaXMsIFwiQWRtaW5EYXNoYm9hcmRXU1wiLHtcclxuICAgICAgICAgICAgICBjb25uZWN0Um91dGVPcHRpb25zOntcclxuICAgICAgICAgICAgICAgICAgaW50ZWdyYXRpb246IG5ldyBXZWJTb2NrZXRMYW1iZGFJbnRlZ3JhdGlvbihcclxuICAgICAgICAgICAgICAgICAgICAgICd3cy1jb25uZWN0LWludGVncmF0aW9uJyxcclxuICAgICAgICAgICAgICAgICAgICAgIHdzQ29ubmVjdExhbWJkYVxyXG4gICAgICAgICAgICAgICAgICApLFxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgZGlzY29ubmVjdFJvdXRlT3B0aW9uczp7XHJcbiAgICAgICAgICAgICAgICAgIGludGVncmF0aW9uOiBuZXcgV2ViU29ja2V0TGFtYmRhSW50ZWdyYXRpb24oXHJcbiAgICAgICAgICAgICAgICAgICAgICAnd3MtZGlzY29ubmVjdC1pbnRlZ3JhdGlvbicsXHJcbiAgICAgICAgICAgICAgICAgICAgICB3c0Rpc2Nvbm5lY3RMYW1iZGFcclxuICAgICAgICAgICAgICAgICAgKSxcclxuICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgfSk7XHJcbiAgXHJcbiAgICAgICAgICBjb25zdCBhcGlTdGFnZSA9IG5ldyBhcGlnYXRld2F5djIuV2ViU29ja2V0U3RhZ2UodGhpcywgJ2RldicsIHtcclxuICAgICAgICAgICAgICB3ZWJTb2NrZXRBcGk6IHdzQVBJLFxyXG4gICAgICAgICAgICAgIHN0YWdlTmFtZTogJ2RldicsXHJcbiAgICAgICAgICAgICAgYXV0b0RlcGxveTogdHJ1ZSxcclxuICAgICAgICAgICAgICB9KTtcclxuICBcclxuICAgICAgICAgIGNvbnN0IG1hbmFnZW1lbnRBcGlFbmRwb2ludCA9IGNkay5Gbi5qb2luKFwiXCIsIFtcclxuICAgIFwiaHR0cHM6Ly9cIixcclxuICAgIGNkay5Gbi5zZWxlY3QoMiwgY2RrLkZuLnNwbGl0KFwiL1wiLCB3c0FQSS5hcGlFbmRwb2ludCkpLFxyXG4gICAgXCIvXCIsIFxyXG4gICAgYXBpU3RhZ2Uuc3RhZ2VOYW1lXHJcbiAgXSk7XHJcblxyXG4gIC8vYm9yYWRjYXN0IGxhbWJkYVxyXG4gIHRoaXMuYnJvYWRjYXN0TGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnd3MtYnJvYWRjYXN0LWxhbWJkYScsIHtcclxuICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzExLFxyXG4gICAgaGFuZGxlcjogJ2Jyb2FkY2FzdC5oYW5kbGVyJyxcclxuICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhJyksXHJcbiAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXHJcbiAgICAvL2Z1bmN0aW9uTmFtZTogJ2Jyb2FkY2FzdC1sYW1iZGEnLFxyXG4gICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgVEFCTEVfTkFNRTogY29ubmVjdGlvbi50YWJsZU5hbWUsXHJcbiAgICAgIFdTX0VORFBPSU5UOiBtYW5hZ2VtZW50QXBpRW5kcG9pbnQsXHJcbiAgICAgIH0sXHJcbiAgICAgIGluaXRpYWxQb2xpY3k6W1xyXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgICAgZWZmZWN0OiBFZmZlY3QuQUxMT1csXHJcbiAgICAgICAgICBhY3Rpb25zOiBbXCJleGVjdXRlLWFwaTpNYW5hZ2VDb25uZWN0aW9uc1wiXSxcclxuICAgICAgICAgIHJlc291cmNlczpbYGFybjphd3M6ZXhlY3V0ZS1hcGk6JHtjZGsuU3RhY2sub2YodGhpcykucmVnaW9ufToke2Nkay5TdGFjay5vZih0aGlzKS5hY2NvdW50fToke3dzQVBJLmFwaUlkfS8ke2FwaVN0YWdlLnN0YWdlTmFtZX0vKi9AY29ubmVjdGlvbnMvKmBdLFxyXG4gICAgICAgICAgfSksXHJcbiAgICAgICAgICBdLFxyXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfREFZLFxyXG4gICAgICAgICAgfSk7XHJcbiAgICAvL2NyZWF0ZSBsYW1iZGEgZm9yIGFycml2YWxzIHBpY3R1cmVcclxuICAgIGNvbnN0IEFycml2YWxSZWtvZ25pdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0Fycml2YWxfSGFuZGxlcicse1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMSxcclxuICAgICAgaGFuZGxlcjonQXJyaXZhbFJla29nbml0aW9uLkFycml2YWxSZWtvZ25pdGlvbicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhJyksXHJcbiAgICAgIGVudmlyb25tZW50OntcclxuICAgICAgICBCVUNLRVRfTkFNRTogYnVja2V0LmJ1Y2tldE5hbWUsXHJcbiAgICAgICAgQ09MTEVDVElPTl9JRDogY29sbGVjdGlvbi5jb2xsZWN0aW9uSWQsXHJcbiAgICAgICAgVVNFUl9UQUJMRTogdGhpcy51c2VyVGFibGUudGFibGVOYW1lLFxyXG4gICAgICAgIFRPUElDX0FSTjogYXJyaXZhbFRvcGljLnRvcGljQXJuLFxyXG4gICAgICAgIEludml0ZVRhYmxlOiBJbnZpdGVkVmlzaXRvclRhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgICBCUk9BRENBU1RfTEFNQkRBOiB0aGlzLmJyb2FkY2FzdExhbWJkYS5mdW5jdGlvbkFybixcclxuICAgICAgfSxcclxuICAgICAgdGltZW91dDpjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXHJcbiAgICAgIC8vZnVuY3Rpb25OYW1lOiAnQXJyaXZhbFJla29nbml0aW9uJywgXHJcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9EQVksIC8vIDwtIENESyB3aWxsIG1hbmFnZSB0aGUgbG9nIGdyb3VwXHJcbiAgICB9KTtcclxuXHJcbiAgICAgICAgLy9jcmVhdGUgbGFtYmRhIGZvciBwcmUgcmVnaXN0cmF0aW9uXHJcbiAgICBjb25zdCBQcmVSZWdpc3RlckNoZWNrID1uZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdsYW1iZGFfcHJlX3JlZ2lzdGVyX2NoZWNrX0hhbmRsZXInLHtcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTEsXHJcbiAgICAgIGhhbmRsZXI6J1ByZVJlZ2lzdGVyQ2hlY2suUHJlUmVnaXN0ZXJDaGVjaycsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhJyksXHJcbiAgICAgIGVudmlyb25tZW50OntcclxuICAgICAgICBCVUNLRVRfTkFNRTogYnVja2V0LmJ1Y2tldE5hbWUsXHJcbiAgICAgICAgQ09MTEVDVElPTl9JRDogY29sbGVjdGlvbi5jb2xsZWN0aW9uSWQsXHJcbiAgICAgICAgVVNFUl9UQUJMRTp0aGlzLnVzZXJUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgICAgQlJPQURDQVNUX0xBTUJEQTogdGhpcy5icm9hZGNhc3RMYW1iZGEuZnVuY3Rpb25Bcm4sXHJcbiAgICAgIH0sXHJcbiAgICAgIHRpbWVvdXQ6Y2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxyXG4gICAgICAvL2Z1bmN0aW9uTmFtZTogJ1ByZVJlZ2lzdGVyQ2hlY2snLCBcclxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX0RBWSwgLy8gPC0gQ0RLIHdpbGwgbWFuYWdlIHRoZSBsb2cgZ3JvdXBcclxuICAgIH0pO1xyXG4gICAgdGhpcy5QcmVSZWdpc3RlckNoZWNrRXhwb3J0ID0gUHJlUmVnaXN0ZXJDaGVjaztcclxuICAgIC8vY3JlYXRlIGxhbWJkYSB0byBzYXZlIGluZGl2aWR1YWwgdmlzaXRvciBpbnZpdGVcclxuICAgIGNvbnN0IFJlZ2lzdGVySW5kaXZpZHVhbFZpc2l0b3IgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdSZWdpc3RlckluZGl2aWR1YWxWaXNpdG9yJyx7XHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzExLFxyXG4gICAgICBoYW5kbGVyOidSZWdpc3RlckluZGl2aWR1YWxWaXNpdG9yLmhhbmRsZXInLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYScpLFxyXG4gICAgICBlbnZpcm9ubWVudDp7XHJcbiAgICAgICAgR01BSUxfVVNFUjogJ1x0YmFodHdpbm5vcmVwbHlAZ21haWwuY29tJywgICAgICAvLyBHbWFpbCBhZGRyZXNzIGZvciBzZW5kaW5nXHJcbiAgICAgICAgR01BSUxfUEFTUzogJ3pkamwgY2RndyBreHpiIG9rbnknLCAgICAgICAgLy8gR21haWwgYXBwIHBhc3N3b3JkXHJcbiAgICAgICAgV09SS01BSUxfVVNFUjogJ25vLXJlcGx5QGJhaHR3aW4uYXdzYXBwcy5jb20nLFxyXG4gICAgICAgIFdPUktNQUlMX1BBU1M6ICdUZXN0MTIzNConLFxyXG4gICAgICAgIFdPUktNQUlMX1NNVFA6ICdzbXRwLm1haWwudXMtZWFzdC0xLmF3c2FwcHMuY29tJyxcclxuICAgICAgICBJbnZpdGVUYWJsZTogSW52aXRlZFZpc2l0b3JUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgICAgQlJPQURDQVNUX0xBTUJEQTogdGhpcy5icm9hZGNhc3RMYW1iZGEuZnVuY3Rpb25Bcm5cclxuICAgICAgfSxcclxuICAgICAgdGltZW91dDpjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXHJcbiAgICAgIC8vZnVuY3Rpb25OYW1lOiAnUmVnaXN0ZXJJbmRpdmlkdWFsVmlzaXRvcicsIFxyXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfREFZLCAvLyA8LSBDREsgd2lsbCBtYW5hZ2UgdGhlIGxvZyBncm91cFxyXG4gICAgfSk7XHJcbiAgICAvL2NyZWF0ZSBsYW1iZGEgZm9yIGJ1bGsgdXBsb2FkIGludml0ZXNcclxuICAgIGNvbnN0IFJlZ2lzdGVyQnVsa1Zpc2l0b3IgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdSZWdpc3RlckJ1bGtWaXNpdG9yJyx7XHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzExLFxyXG4gICAgICBoYW5kbGVyOidSZWdpc3RlckJ1bGtWaXNpdG9yLmhhbmRsZXInLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYScpLFxyXG4gICAgICBlbnZpcm9ubWVudDp7XHJcbiAgICAgICAgR01BSUxfVVNFUjogJ1x0YmFodHdpbm5vcmVwbHlAZ21haWwuY29tJywgICAgICAvLyBHbWFpbCBhZGRyZXNzIGZvciBzZW5kaW5nXHJcbiAgICAgICAgR01BSUxfUEFTUzogJ3pkamwgY2RndyBreHpiIG9rbnknLCAgICAgICAgLy8gR21haWwgYXBwIHBhc3N3b3JkXHJcbiAgICAgICAgV09SS01BSUxfVVNFUjogJ25vLXJlcGx5QGJhaHR3aW4uYXdzYXBwcy5jb20nLFxyXG4gICAgICAgIFdPUktNQUlMX1BBU1M6ICdUZXN0MTIzNConLFxyXG4gICAgICAgIFdPUktNQUlMX1NNVFA6ICdzbXRwLm1haWwudXMtZWFzdC0xLmF3c2FwcHMuY29tJyxcclxuICAgICAgICBJbnZpdGVUYWJsZTogSW52aXRlZFZpc2l0b3JUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgICAgQlJPQURDQVNUX0xBTUJEQTogdGhpcy5icm9hZGNhc3RMYW1iZGEuZnVuY3Rpb25Bcm5cclxuICAgICAgfSxcclxuICAgICAgdGltZW91dDpjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXHJcbiAgICAgIC8vZnVuY3Rpb25OYW1lOiAnUmVnaXN0ZXJCdWxrVmlzaXRvcicsIFxyXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfREFZLCAvLyA8LSBDREsgd2lsbCBtYW5hZ2UgdGhlIGxvZyBncm91cFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy9nZXQgdXNlciBpbmZvIGxhbWJkYVxyXG4gICAgY29uc3QgR2V0VXNlckluZm8gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdHZXRVc2VySW5mbycse1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMSxcclxuICAgICAgaGFuZGxlcjonR2V0VXNlckluZm8uaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhJyksXHJcbiAgICAgIGVudmlyb25tZW50OntcclxuICAgICAgICBVU0VSX1RBQkxFOnRoaXMudXNlclRhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgICBCVUNLRVRfTkFNRTogYnVja2V0LmJ1Y2tldE5hbWVcclxuICAgICAgfSxcclxuICAgICAgdGltZW91dDpjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXHJcbiAgICAgIC8vZnVuY3Rpb25OYW1lOiAnR2V0VXNlckluZm8nLCBcclxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX0RBWSwgLy8gPC0gQ0RLIHdpbGwgbWFuYWdlIHRoZSBsb2cgZ3JvdXBcclxuICAgIH0pO1xyXG4gICAgYnVja2V0LmdyYW50UmVhZChHZXRVc2VySW5mbyk7XHJcblxyXG5cclxuICAgIC8vLy8vLy8vLy8vLyBHcmFudCBwZXJtaXNzaW9ucyB0byBSZXNvdXJjZXMgLy8vLy8vLy8vLy8vXHJcblxyXG4gICAgLy8gR3JhbnQgcGVybWlzc2lvbnMgZm9yIGxhbWJkYXMgdG8gUzMgYW5kIHRoZSB1c2VyIHRhYmxlXHJcbiAgICBidWNrZXQuZ3JhbnRSZWFkV3JpdGUoUHJlUmVnaXN0ZXJDaGVjayk7XHJcbiAgICBidWNrZXQuZ3JhbnRSZWFkV3JpdGUoQXJyaXZhbFJla29nbml0aW9uKTtcclxuICAgIHRoaXMudXNlclRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShQcmVSZWdpc3RlckNoZWNrKTtcclxuICAgIHRoaXMudXNlclRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShBcnJpdmFsUmVrb2duaXRpb24pO1xyXG4gICAgdGhpcy51c2VyVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKExvYWREYXNoYm9hcmQpO1xyXG4gICAgd2Vic2l0ZUFjdGl2aXR5VGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKExvYWREYXNoYm9hcmQpO1xyXG4gICAgdGhpcy51c2VyVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKEdldFVzZXJJbmZvKTtcclxuICAgIGNvbnN0IHJlZ2lzdGVyUm9sZSA9IFByZVJlZ2lzdGVyQ2hlY2sucm9sZSE7XHJcbiAgICBjb25zdCBhcnJpdmFsUm9sZSA9IEFycml2YWxSZWtvZ25pdGlvbi5yb2xlITtcclxuICAgIHNlbmRGZWVkYmFja0xhbWJkYS5ncmFudEludm9rZShhcnJpdmFsUm9sZSk7XHJcbiAgICBJbnZpdGVkVmlzaXRvclRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShSZWdpc3RlckluZGl2aWR1YWxWaXNpdG9yKTtcclxuICAgIEludml0ZWRWaXNpdG9yVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKFJlZ2lzdGVyQnVsa1Zpc2l0b3IpO1xyXG4gICAgSW52aXRlZFZpc2l0b3JUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoQXJyaXZhbFJla29nbml0aW9uKTtcclxuICAgIEludml0ZWRWaXNpdG9yVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKExvYWREYXNoYm9hcmQpO1xyXG4gICAgY29uc3QgaW5kaXZpZHVhbFJlZ2lzdGVyUm9sZSA9IFJlZ2lzdGVySW5kaXZpZHVhbFZpc2l0b3Iucm9sZSE7XHJcbiAgICBjb25zdCBCdWxrUmVnaXN0ZXJSb2xlID0gUmVnaXN0ZXJCdWxrVmlzaXRvci5yb2xlITtcclxuICAgIC8vIEdyYW50IExhbWJkYSBwZXJtaXNzaW9uIHRvIHB1Ymxpc2ggdG8gU05TXHJcbiAgICBhcnJpdmFsVG9waWMuZ3JhbnRQdWJsaXNoKEFycml2YWxSZWtvZ25pdGlvbik7XHJcblxyXG4gICAgLy8gR2l2ZSBwZXJtaXNzaW9ucyBmb3IgUHJlUmVnaXN0ZXJDaGVjayBsYW1iZGEgdG8gdXNlIEFtYXpvbiBSZWtvZ25pdGlvbiBcclxuICAgIFByZVJlZ2lzdGVyQ2hlY2suYWRkVG9Sb2xlUG9saWN5KFxyXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgICAgYWN0aW9uczogW1xyXG4gICAgICAgICAgJ3Jla29nbml0aW9uOkluZGV4RmFjZXMnLFxyXG4gICAgICAgICAgJ3Jla29nbml0aW9uOlNlYXJjaEZhY2VzQnlJbWFnZScsXHJcbiAgICAgICAgICAncmVrb2duaXRpb246RGV0ZWN0RmFjZXMnLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgcmVzb3VyY2VzOiBbJyonXSwgXHJcbiAgICAgICAgXHJcbiAgICAgIH0pXHJcbiAgICApO1xyXG5cclxuICAgIC8vIEdpdmUgcGVybWlzc2lvbnMgZm9yIEFycml2YWxSZWtvZ25pdGlvbiBsYW1iZGEgdG8gdXNlIEFtYXpvbiBSZWtvZ25pdGlvbiBcclxuICAgIEFycml2YWxSZWtvZ25pdGlvbi5hZGRUb1JvbGVQb2xpY3koXHJcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgICBhY3Rpb25zOiBbXHJcbiAgICAgICAgICAncmVrb2duaXRpb246SW5kZXhGYWNlcycsXHJcbiAgICAgICAgICAncmVrb2duaXRpb246U2VhcmNoRmFjZXNCeUltYWdlJyxcclxuICAgICAgICAgICdyZWtvZ25pdGlvbjpEZXRlY3RGYWNlcycsXHJcbiAgICAgICAgXSxcclxuICAgICAgICByZXNvdXJjZXM6IFsnKiddLCBcclxuICAgICAgICBcclxuICAgICAgfSlcclxuICAgICk7XHJcblxyXG4gICAgQXJyaXZhbFJla29nbml0aW9uLmFkZFRvUm9sZVBvbGljeShcclxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICAgIGFjdGlvbnM6IFtcInNuczpQdWJsaXNoXCJdLFxyXG4gICAgICAgIHJlc291cmNlczogW1wiKlwiXSxcclxuICAgICAgfSlcclxuICAgICk7XHJcblxyXG4gIC8vZ3JhbnQgcGVybWlzc2lvbnMgdG8gY29ubmVjdCBsYW1iZGEgYW5kIGRpc2FibGUgbGFtYmRhIHRvIGVkaXQgdGhlIHRhYmxlIGNyZWF0ZWRcclxuICBjb25uZWN0aW9uLmdyYW50UmVhZFdyaXRlRGF0YSh3c0Nvbm5lY3RMYW1iZGEpO1xyXG4gIGNvbm5lY3Rpb24uZ3JhbnRSZWFkV3JpdGVEYXRhKHdzRGlzY29ubmVjdExhbWJkYSk7XHJcbiAgY29ubmVjdGlvbi5ncmFudFJlYWRXcml0ZURhdGEodGhpcy5icm9hZGNhc3RMYW1iZGEpO1xyXG4gIHdzQVBJLmFkZFJvdXRlKFwiJGRlZmF1bHRcIiwgeyBpbnRlZ3JhdGlvbjogbmV3IFdlYlNvY2tldExhbWJkYUludGVncmF0aW9uKFwiaWRcIiwgdGhpcy5icm9hZGNhc3RMYW1iZGEpIH0pXHJcbiAgLy8gZW5hYmxlIG90aGVyIGZ1bmN0aW9ucyB0byBjYWxsIGJyYWRjYXN0IGZ1bmN0aW9uXHJcbiAgdGhpcy5icm9hZGNhc3RMYW1iZGEuZ3JhbnRJbnZva2UoYXJyaXZhbFJvbGUpO1xyXG4gIHRoaXMuYnJvYWRjYXN0TGFtYmRhLmdyYW50SW52b2tlKHJlZ2lzdGVyUm9sZSk7XHJcbiAgdGhpcy5icm9hZGNhc3RMYW1iZGEuZ3JhbnRJbnZva2UoaW5kaXZpZHVhbFJlZ2lzdGVyUm9sZSk7XHJcbiAgdGhpcy5icm9hZGNhc3RMYW1iZGEuZ3JhbnRJbnZva2UoQnVsa1JlZ2lzdGVyUm9sZSk7XHJcblxyXG4gICAgLy8vLy8vLy8vLy8vIEFQSSAgUmVzb3VyY2VzIC8vLy8vLy8vLy8vL1xyXG5cclxuICAgIC8vY3JlYXRlIEFQSVxyXG4gICAgY29uc3QgYXBpX2Fycml2YWwgPSBuZXcgYXBpZ3cuUmVzdEFwaSh0aGlzLCAnYXBpX2Fycml2YWwnLCB7XHJcbiAgICAgICAgcmVzdEFwaU5hbWU6IGAke3ByZWZpeG5hbWV9LUJhaHR3aW4tVmlzaXRvci1BUElgLCAgXHJcbiAgICB9KTtcclxuIFxyXG5cclxuICAgIC8vIGNyZWF0ZSB2aXNpdG9yIHJlc291cmNlIGZvciB0aGUgYXBpXHJcbiAgICBjb25zdCB2aXNpdG9yUmVzb3VyY2UgPSBhcGlfYXJyaXZhbC5yb290LmFkZFJlc291cmNlKCd2aXNpdG9yJyk7XHJcblxyXG4gICAgLy8gY3JlYXRlIGFycml2YWwgcmVzb3VyY2UgdW5kZXIgdGhlIHZpc2l0b3IgcmVzb3VyY2VcclxuICAgIGNvbnN0IGFycml2YWxSZXNvdXJjZSA9IHZpc2l0b3JSZXNvdXJjZS5hZGRSZXNvdXJjZSgnYXJyaXZhbCcpO1xyXG5cclxuICAgIC8vIGNyZWF0ZSByZWdpc3RlciByZXNvdXJjZSB1bmRlciB0aGUgdmlzaXRvciByZXNvdXJjZVxyXG4gICAgY29uc3QgcmVnaXN0ZXJSZXNvdXJjZSA9IHZpc2l0b3JSZXNvdXJjZS5hZGRSZXNvdXJjZSgncmVnaXN0ZXInKTtcclxuXHJcbiAgICAvLyBjb25uZWN0IFBPU1QgdG8gTGFtYmRhXHJcbiAgICBhcnJpdmFsUmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKEFycml2YWxSZWtvZ25pdGlvbiwge1xyXG4gICAgICBwcm94eTogdHJ1ZSxcclxuICAgIH0pKTtcclxuXHJcbiAgICAvLyBjb25uZWN0IFBPU1QgdG8gTGFtYmRhXHJcbiAgICByZWdpc3RlclJlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbihQcmVSZWdpc3RlckNoZWNrLCB7XHJcbiAgICAgIHByb3h5OiB0cnVlLFxyXG4gICAgfSkpO1xyXG5cclxuICAgIC8vLy8gY3JlYXRlIGFkbWluIHJlc291cmNlIGZvciB0aGUgYXBpXHJcbiAgICBjb25zdCBhZG1pblJlc291cmNlID0gYXBpX2Fycml2YWwucm9vdC5hZGRSZXNvdXJjZSgnYWRtaW4nKTtcclxuXHJcbiAgICAvLyBjcmVhdGUgaW5kaXZpZHVhbCByZWdpc3RlciByZXNvdXJjZSB1bmRlciB0aGUgYWRtaW4gcmVzb3VyY2VcclxuICAgIGNvbnN0IHJlZ2lzdGVyVmlzaXRvckluZGl2aWR1YWwgPSBhZG1pblJlc291cmNlLmFkZFJlc291cmNlKCdyZWdpc3RlclZpc2l0b3JJbmRpdmlkdWFsJyk7XHJcbiAgICBcclxuICAgIC8vIGNvbm5lY3QgUE9TVCB0byBMYW1iZGFcclxuICAgIHJlZ2lzdGVyVmlzaXRvckluZGl2aWR1YWwuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKFJlZ2lzdGVySW5kaXZpZHVhbFZpc2l0b3IsIHtcclxuICAgICAgcHJveHk6IHRydWUsXHJcbiAgICB9KSk7XHJcblxyXG4gICAgLy8gY3JlYXRlIGJ1bGsgcmVnaXN0ZXIgcmVzb3VyY2UgdW5kZXIgdGhlIGFkbWluIHJlc291cmNlXHJcbiAgICBjb25zdCByZWdpc3RlclZpc2l0b3JCdWxrID0gYWRtaW5SZXNvdXJjZS5hZGRSZXNvdXJjZSgncmVnaXN0ZXJWaXNpdG9yQnVsaycpO1xyXG4gICAgXHJcbiAgICAvLyBjb25uZWN0IFBPU1QgdG8gTGFtYmRhXHJcbiAgICByZWdpc3RlclZpc2l0b3JCdWxrLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbihSZWdpc3RlckJ1bGtWaXNpdG9yLCB7XHJcbiAgICAgIHByb3h5OiB0cnVlLFxyXG4gICAgfSkpO1xyXG5cclxuICAgIC8vIGNyZWF0ZSBkYXNoYm9hcmQgcmVzb3VyY2UgdW5kZXIgdGhlIGFkbWluIHJlc291cmNlXHJcbiAgICBjb25zdCBsb2FkX0Rhc2hib2FyZCA9IGFkbWluUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2xvYWREYXNoYm9hcmQnKTtcclxuICAgIFxyXG4gICAgLy8gY29ubmVjdCBHRVQgdG8gTGFtYmRhXHJcbiAgICBsb2FkX0Rhc2hib2FyZC5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24oTG9hZERhc2hib2FyZCwge1xyXG4gICAgICBwcm94eTogdHJ1ZSxcclxuICAgIH0pKTtcclxuICAgIGNvbnN0IGdldFVzZXJJbmZvID0gdmlzaXRvclJlc291cmNlLmFkZFJlc291cmNlKCdtZScpO1xyXG4gICAgZ2V0VXNlckluZm8uYWRkTWV0aG9kKCdHRVQnLG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbihHZXRVc2VySW5mbywgeyBcclxuICAgICAgcHJveHk6IHRydWUgXHJcbiAgICB9KSk7XHJcblxyXG4gICAgYXJyaXZhbFJlc291cmNlLmFkZE1ldGhvZCgnT1BUSU9OUycsIG5ldyBhcGlndy5Nb2NrSW50ZWdyYXRpb24oe1xyXG4gICAgICBpbnRlZ3JhdGlvblJlc3BvbnNlczogW3tcclxuICAgICAgICBzdGF0dXNDb2RlOiAnMjAwJyxcclxuICAgICAgICByZXNwb25zZVBhcmFtZXRlcnM6IHtcclxuICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiBcIidDb250ZW50LVR5cGUsWC1BbXotRGF0ZSxBdXRob3JpemF0aW9uLFgtQXBpLUtleSxYLUFtei1TZWN1cml0eS1Ub2tlbidcIixcclxuICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IFwiJyonXCIsXHJcbiAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzJzogXCInUE9TVCxPUFRJT05TJ1wiLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH1dLFxyXG4gICAgICBwYXNzdGhyb3VnaEJlaGF2aW9yOiBhcGlndy5QYXNzdGhyb3VnaEJlaGF2aW9yLk5FVkVSLFxyXG4gICAgICByZXF1ZXN0VGVtcGxhdGVzOiB7XHJcbiAgICAgICAgJ2FwcGxpY2F0aW9uL2pzb24nOiAne1wic3RhdHVzQ29kZVwiOiAyMDB9J1xyXG4gICAgICB9LFxyXG4gICAgfSksIHtcclxuICAgICAgbWV0aG9kUmVzcG9uc2VzOiBbe1xyXG4gICAgICAgIHN0YXR1c0NvZGU6ICcyMDAnLFxyXG4gICAgICAgIHJlc3BvbnNlUGFyYW1ldGVyczoge1xyXG4gICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6IHRydWUsXHJcbiAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzJzogdHJ1ZSxcclxuICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IHRydWUsXHJcbiAgICAgICAgfSxcclxuICAgICAgfV0sXHJcbiAgICB9KTtcclxuXHJcblxyXG4gICAgcmVnaXN0ZXJSZXNvdXJjZS5hZGRNZXRob2QoJ09QVElPTlMnLCBuZXcgYXBpZ3cuTW9ja0ludGVncmF0aW9uKHtcclxuICAgICAgaW50ZWdyYXRpb25SZXNwb25zZXM6IFt7XHJcbiAgICAgICAgc3RhdHVzQ29kZTogJzIwMCcsXHJcbiAgICAgICAgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XHJcbiAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzogXCInQ29udGVudC1UeXBlLFgtQW16LURhdGUsQXV0aG9yaXphdGlvbixYLUFwaS1LZXksWC1BbXotU2VjdXJpdHktVG9rZW4nXCIsXHJcbiAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiBcIicqJ1wiLFxyXG4gICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6IFwiJ1BPU1QsT1BUSU9OUydcIixcclxuICAgICAgICB9LFxyXG4gICAgICB9XSxcclxuICAgICAgcGFzc3Rocm91Z2hCZWhhdmlvcjogYXBpZ3cuUGFzc3Rocm91Z2hCZWhhdmlvci5ORVZFUixcclxuICAgICAgcmVxdWVzdFRlbXBsYXRlczoge1xyXG4gICAgICAgICdhcHBsaWNhdGlvbi9qc29uJzogJ3tcInN0YXR1c0NvZGVcIjogMjAwfSdcclxuICAgICAgfSxcclxuICAgIH0pLCB7XHJcbiAgICAgIG1ldGhvZFJlc3BvbnNlczogW3tcclxuICAgICAgICBzdGF0dXNDb2RlOiAnMjAwJyxcclxuICAgICAgICByZXNwb25zZVBhcmFtZXRlcnM6IHtcclxuICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiB0cnVlLFxyXG4gICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6IHRydWUsXHJcbiAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiB0cnVlLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH1dLFxyXG4gICAgfSk7XHJcblxyXG4gICAgcmVnaXN0ZXJWaXNpdG9ySW5kaXZpZHVhbC5hZGRNZXRob2QoJ09QVElPTlMnLCBuZXcgYXBpZ3cuTW9ja0ludGVncmF0aW9uKHtcclxuICAgICAgaW50ZWdyYXRpb25SZXNwb25zZXM6IFt7XHJcbiAgICAgICAgc3RhdHVzQ29kZTogJzIwMCcsXHJcbiAgICAgICAgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XHJcbiAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzogXCInQ29udGVudC1UeXBlLFgtQW16LURhdGUsQXV0aG9yaXphdGlvbixYLUFwaS1LZXksWC1BbXotU2VjdXJpdHktVG9rZW4nXCIsXHJcbiAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiBcIicqJ1wiLFxyXG4gICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6IFwiJ1BPU1QsT1BUSU9OUydcIixcclxuICAgICAgICB9LFxyXG4gICAgICB9XSxcclxuICAgICAgcGFzc3Rocm91Z2hCZWhhdmlvcjogYXBpZ3cuUGFzc3Rocm91Z2hCZWhhdmlvci5ORVZFUixcclxuICAgICAgcmVxdWVzdFRlbXBsYXRlczoge1xyXG4gICAgICAgICdhcHBsaWNhdGlvbi9qc29uJzogJ3tcInN0YXR1c0NvZGVcIjogMjAwfSdcclxuICAgICAgfSxcclxuICAgIH0pLCB7XHJcbiAgICAgIG1ldGhvZFJlc3BvbnNlczogW3tcclxuICAgICAgICBzdGF0dXNDb2RlOiAnMjAwJyxcclxuICAgICAgICByZXNwb25zZVBhcmFtZXRlcnM6IHtcclxuICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiB0cnVlLFxyXG4gICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6IHRydWUsXHJcbiAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiB0cnVlLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH1dLFxyXG4gICAgfSk7XHJcblxyXG4gICAgcmVnaXN0ZXJWaXNpdG9yQnVsay5hZGRNZXRob2QoJ09QVElPTlMnLCBuZXcgYXBpZ3cuTW9ja0ludGVncmF0aW9uKHtcclxuICAgICAgaW50ZWdyYXRpb25SZXNwb25zZXM6IFt7XHJcbiAgICAgICAgc3RhdHVzQ29kZTogJzIwMCcsXHJcbiAgICAgICAgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XHJcbiAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzogXCInQ29udGVudC1UeXBlLFgtQW16LURhdGUsQXV0aG9yaXphdGlvbixYLUFwaS1LZXksWC1BbXotU2VjdXJpdHktVG9rZW4nXCIsXHJcbiAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiBcIicqJ1wiLFxyXG4gICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6IFwiJ1BPU1QsT1BUSU9OUydcIixcclxuICAgICAgICB9LFxyXG4gICAgICB9XSxcclxuICAgICAgcGFzc3Rocm91Z2hCZWhhdmlvcjogYXBpZ3cuUGFzc3Rocm91Z2hCZWhhdmlvci5ORVZFUixcclxuICAgICAgcmVxdWVzdFRlbXBsYXRlczoge1xyXG4gICAgICAgICdhcHBsaWNhdGlvbi9qc29uJzogJ3tcInN0YXR1c0NvZGVcIjogMjAwfSdcclxuICAgICAgfSxcclxuICAgIH0pLCB7XHJcbiAgICAgIG1ldGhvZFJlc3BvbnNlczogW3tcclxuICAgICAgICBzdGF0dXNDb2RlOiAnMjAwJyxcclxuICAgICAgICByZXNwb25zZVBhcmFtZXRlcnM6IHtcclxuICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiB0cnVlLFxyXG4gICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6IHRydWUsXHJcbiAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiB0cnVlLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH1dLFxyXG4gICAgfSk7XHJcblxyXG4gICAgIGxvYWRfRGFzaGJvYXJkLmFkZE1ldGhvZCgnT1BUSU9OUycsIG5ldyBhcGlndy5Nb2NrSW50ZWdyYXRpb24oe1xyXG4gICAgICBpbnRlZ3JhdGlvblJlc3BvbnNlczogW3tcclxuICAgICAgICBzdGF0dXNDb2RlOiAnMjAwJyxcclxuICAgICAgICByZXNwb25zZVBhcmFtZXRlcnM6IHtcclxuICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiBcIidDb250ZW50LVR5cGUsWC1BbXotRGF0ZSxBdXRob3JpemF0aW9uLFgtQXBpLUtleSxYLUFtei1TZWN1cml0eS1Ub2tlbidcIixcclxuICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IFwiJyonXCIsXHJcbiAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzJzogXCInUE9TVCxPUFRJT05TJ1wiLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH1dLFxyXG4gICAgICBwYXNzdGhyb3VnaEJlaGF2aW9yOiBhcGlndy5QYXNzdGhyb3VnaEJlaGF2aW9yLk5FVkVSLFxyXG4gICAgICByZXF1ZXN0VGVtcGxhdGVzOiB7XHJcbiAgICAgICAgJ2FwcGxpY2F0aW9uL2pzb24nOiAne1wic3RhdHVzQ29kZVwiOiAyMDB9J1xyXG4gICAgICB9LFxyXG4gICAgfSksIHtcclxuICAgICAgbWV0aG9kUmVzcG9uc2VzOiBbe1xyXG4gICAgICAgIHN0YXR1c0NvZGU6ICcyMDAnLFxyXG4gICAgICAgIHJlc3BvbnNlUGFyYW1ldGVyczoge1xyXG4gICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6IHRydWUsXHJcbiAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzJzogdHJ1ZSxcclxuICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IHRydWUsXHJcbiAgICAgICAgfSxcclxuICAgICAgfV0sXHJcbiAgICB9KTtcclxuXHJcbiAgICBnZXRVc2VySW5mbyAuYWRkTWV0aG9kKCdPUFRJT05TJywgbmV3IGFwaWd3Lk1vY2tJbnRlZ3JhdGlvbih7XHJcbiAgICAgIGludGVncmF0aW9uUmVzcG9uc2VzOiBbe1xyXG4gICAgICAgIHN0YXR1c0NvZGU6ICcyMDAnLFxyXG4gICAgICAgIHJlc3BvbnNlUGFyYW1ldGVyczoge1xyXG4gICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6IFwiJ0NvbnRlbnQtVHlwZSxYLUFtei1EYXRlLEF1dGhvcml6YXRpb24sWC1BcGktS2V5LFgtQW16LVNlY3VyaXR5LVRva2VuJ1wiLFxyXG4gICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogXCInKidcIixcclxuICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnOiBcIidQT1NULE9QVElPTlMnXCIsXHJcbiAgICAgICAgfSxcclxuICAgICAgfV0sXHJcbiAgICAgIHBhc3N0aHJvdWdoQmVoYXZpb3I6IGFwaWd3LlBhc3N0aHJvdWdoQmVoYXZpb3IuTkVWRVIsXHJcbiAgICAgIHJlcXVlc3RUZW1wbGF0ZXM6IHtcclxuICAgICAgICAnYXBwbGljYXRpb24vanNvbic6ICd7XCJzdGF0dXNDb2RlXCI6IDIwMH0nXHJcbiAgICAgIH0sXHJcbiAgICB9KSwge1xyXG4gICAgICBtZXRob2RSZXNwb25zZXM6IFt7XHJcbiAgICAgICAgc3RhdHVzQ29kZTogJzIwMCcsXHJcbiAgICAgICAgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XHJcbiAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzogdHJ1ZSxcclxuICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnOiB0cnVlLFxyXG4gICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogdHJ1ZSxcclxuICAgICAgICB9LFxyXG4gICAgICB9XSxcclxuICAgIH0pO1xyXG5cclxuXHJcbiAgICBcclxuXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuLy8gR0VUIElNQUdFIFVSTCAocHJlc2lnbmVkIEdFVCBVUkwpXHJcbi8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG5jb25zdCBnZXRJbWFnZVVybEZuID0gbmV3IE5vZGVqc0Z1bmN0aW9uKFxyXG4gIHRoaXMsXHJcbiAgXCJHZW5lcmF0ZVByZXNpZ25lZEltYWdlVXJsSGFuZGxlclwiLFxyXG4gIHtcclxuICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxyXG4gICAgZW50cnk6IHBhdGguam9pbihfX2Rpcm5hbWUsIFwiLi4vbGFtYmRhL2dlbmVyYXRlUHJlc2lnbmVkRG93bmxvYWRVcmwudHNcIiksXHJcbiAgICBoYW5kbGVyOiBcImhhbmRsZXJcIixcclxuICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgIEJVQ0tFVF9OQU1FOiBidWNrZXQuYnVja2V0TmFtZSxcclxuICAgICAgVVNFUl9UQUJMRTogdGhpcy51c2VyVGFibGUudGFibGVOYW1lLCBcclxuICAgIH0sXHJcbiAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXHJcbiAgfVxyXG4pO1xyXG5cclxuLy8gUGVybWlzc2lvbnNcclxuYnVja2V0LmdyYW50UmVhZChnZXRJbWFnZVVybEZuKTsgICAgICAgICAgICAgICAgIFxyXG50aGlzLnVzZXJUYWJsZS5ncmFudFJlYWREYXRhKGdldEltYWdlVXJsRm4pOyAgICBcclxuXHJcbi8vIEFQSSBHYXRld2F5OiB3XHJcbmNvbnN0IGdldEltYWdlVXJsUmVzb3VyY2UgPSB2aXNpdG9yUmVzb3VyY2UuYWRkUmVzb3VyY2UoXCJnZXQtaW1hZ2UtdXJsXCIpO1xyXG5cclxuZ2V0SW1hZ2VVcmxSZXNvdXJjZS5hZGRDb3JzUHJlZmxpZ2h0KHtcclxuICBhbGxvd09yaWdpbnM6IFtcIipcIl0sXHJcbiAgYWxsb3dNZXRob2RzOiBbXCJHRVRcIl0sXHJcbn0pO1xyXG5cclxuZ2V0SW1hZ2VVcmxSZXNvdXJjZS5hZGRNZXRob2QoXHJcbiAgXCJHRVRcIixcclxuICBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24oZ2V0SW1hZ2VVcmxGbiwgeyBwcm94eTogdHJ1ZSB9KSxcclxuICB7IGF1dGhvcml6YXRpb25UeXBlOiBhcGlndy5BdXRob3JpemF0aW9uVHlwZS5OT05FIH1cclxuKTtcclxuXHJcbm5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBZG1pbkFwaUJhc2VVcmwnLCB7XHJcbiAgdmFsdWU6IGFwaV9hcnJpdmFsLnVybEZvclBhdGgoJy9hZG1pbi8nKSxcclxuICBleHBvcnROYW1lOiBgJHtwcmVmaXhuYW1lfS1BZG1pbkFwaUJhc2VVcmxgLFxyXG59KTtcclxuXHJcbi8vIGFjdGl2ZSB1c2Vyc1xyXG5cclxuXHJcbmNvbnN0IHdlYnNpdGVIZWFydGJlYXRMYW1iZGEgPSBuZXcgTm9kZWpzRnVuY3Rpb24odGhpcywgXCJXZWJzaXRlSGVhcnRiZWF0TGFtYmRhXCIsIHtcclxuICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICBlbnRyeTogcGF0aC5qb2luKF9fZGlybmFtZSwgXCIuLi9sYW1iZGEvaGVhcnRiZWF0LnRzXCIpLFxyXG4gIGhhbmRsZXI6IFwiaGFuZGxlclwiLFxyXG4gIGVudmlyb25tZW50OiB7XHJcbiAgICBXRUJTSVRFX0FDVElWSVRZX1RBQkxFOiB3ZWJzaXRlQWN0aXZpdHlUYWJsZS50YWJsZU5hbWUsXHJcbiAgICBCUk9BRENBU1RfTEFNQkRBOiB0aGlzLmJyb2FkY2FzdExhbWJkYS5mdW5jdGlvbkFybixcclxuICB9LFxyXG59KTtcclxuXHJcbmNvbnN0IGhlYXJ0YmVhdFJlc291cmNlID12aXNpdG9yUmVzb3VyY2UuYWRkUmVzb3VyY2UoXCJoZWFydGJlYXRcIik7XHJcblxyXG5oZWFydGJlYXRSZXNvdXJjZS5hZGRNZXRob2QoXCJQT1NUXCIsIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbih3ZWJzaXRlSGVhcnRiZWF0TGFtYmRhKSk7XHJcblxyXG5oZWFydGJlYXRSZXNvdXJjZS5hZGRNZXRob2QoJ09QVElPTlMnLCBuZXcgYXBpZ3cuTW9ja0ludGVncmF0aW9uKHtcclxuICAgICAgaW50ZWdyYXRpb25SZXNwb25zZXM6IFt7XHJcbiAgICAgICAgc3RhdHVzQ29kZTogJzIwMCcsXHJcbiAgICAgICAgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XHJcbiAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzogXCInQ29udGVudC1UeXBlLFgtQW16LURhdGUsQXV0aG9yaXphdGlvbixYLUFwaS1LZXksWC1BbXotU2VjdXJpdHktVG9rZW4nXCIsXHJcbiAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiBcIicqJ1wiLFxyXG4gICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6IFwiJ1BPU1QsT1BUSU9OUydcIixcclxuICAgICAgICB9LFxyXG4gICAgICB9XSxcclxuICAgICAgcGFzc3Rocm91Z2hCZWhhdmlvcjogYXBpZ3cuUGFzc3Rocm91Z2hCZWhhdmlvci5ORVZFUixcclxuICAgICAgcmVxdWVzdFRlbXBsYXRlczoge1xyXG4gICAgICAgICdhcHBsaWNhdGlvbi9qc29uJzogJ3tcInN0YXR1c0NvZGVcIjogMjAwfSdcclxuICAgICAgfSxcclxuICAgIH0pLCB7XHJcbiAgICAgIG1ldGhvZFJlc3BvbnNlczogW3tcclxuICAgICAgICBzdGF0dXNDb2RlOiAnMjAwJyxcclxuICAgICAgICByZXNwb25zZVBhcmFtZXRlcnM6IHtcclxuICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiB0cnVlLFxyXG4gICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6IHRydWUsXHJcbiAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiB0cnVlLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH1dLFxyXG4gICAgfSk7XHJcbndlYnNpdGVBY3Rpdml0eVRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YSh3ZWJzaXRlSGVhcnRiZWF0TGFtYmRhKTtcclxuY29uc3QgaGVhcnRiZWF0Um9sZSA9IHdlYnNpdGVIZWFydGJlYXRMYW1iZGEucm9sZSE7XHJcbnRoaXMuYnJvYWRjYXN0TGFtYmRhLmdyYW50SW52b2tlKGhlYXJ0YmVhdFJvbGUpO1xyXG5cclxuLy8gR0VUIFVTRVIgQkFER0UgSU5GTyAoVW5pdHkpXHJcbmNvbnN0IGdldFVzZXJCYWRnZUluZm9GbiA9IG5ldyBOb2RlanNGdW5jdGlvbihcclxuICB0aGlzLFxyXG4gIFwiR2V0VXNlckJhZGdlSW5mb0hhbmRsZXJcIixcclxuICB7XHJcbiAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcclxuICAgIGVudHJ5OiBwYXRoLmpvaW4oX19kaXJuYW1lLCBcIi4uL2xhbWJkYS9nZXRVc2VyQmFkZ2VJbmZvLnRzXCIpLFxyXG4gICAgaGFuZGxlcjogXCJoYW5kbGVyXCIsXHJcbiAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICBVU0VSX1RBQkxFOiB0aGlzLnVzZXJUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgIEJVQ0tFVF9OQU1FOiBidWNrZXQuYnVja2V0TmFtZSxcclxuICAgIH0sXHJcbiAgfVxyXG4pO1xyXG5cclxudGhpcy51c2VyVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGdldFVzZXJCYWRnZUluZm9Gbik7XHJcbmJ1Y2tldC5ncmFudFJlYWQoZ2V0VXNlckJhZGdlSW5mb0ZuKTtcclxuXHJcbmNvbnN0IGJhZGdlUmVzb3VyY2UgPSB2aXNpdG9yUmVzb3VyY2UuYWRkUmVzb3VyY2UoXCJiYWRnZVwiKTtcclxuYmFkZ2VSZXNvdXJjZS5hZGRNZXRob2QoXHJcbiAgXCJQT1NUXCIsXHJcbiAgbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKGdldFVzZXJCYWRnZUluZm9GbiksXHJcbiAgeyBhdXRob3JpemF0aW9uVHlwZTogYXBpZ3cuQXV0aG9yaXphdGlvblR5cGUuTk9ORSB9XHJcbik7XHJcblxyXG5iYWRnZVJlc291cmNlLmFkZENvcnNQcmVmbGlnaHQoe1xyXG4gIGFsbG93T3JpZ2luczogW1wiKlwiXSxcclxuICBhbGxvd01ldGhvZHM6IFtcIlBPU1RcIl0sXHJcbn0pO1xyXG4gICAgXHJcbiAgfVxyXG59XHJcbiJdfQ==