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
const cdk = __importStar(require("aws-cdk-lib"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const aws_cdk_lib_1 = require("aws-cdk-lib");
const apigw = __importStar(require("aws-cdk-lib/aws-apigateway"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const sns = __importStar(require("aws-cdk-lib/aws-sns"));
const subscriptions = __importStar(require("aws-cdk-lib/aws-sns-subscriptions"));
const path = __importStar(require("path"));
const aws_lambda_nodejs_1 = require("aws-cdk-lib/aws-lambda-nodejs");
class FacialRecognitionStack extends cdk.Stack {
    userTable;
    constructor(scope, id, props) {
        super(scope, id, props);
        //////////// DynamoDB Resources ////////////
        // Users Table
        this.userTable = new dynamodb.Table(this, 'userTable', {
            tableName: 'UserManagementTable',
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
            tableName: 'InvitedVisitorTable',
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
        // create BulkUploadSTatusTable table
        const BulkUploadSTatusTable = new dynamodb.Table(this, 'BulkUploadSTatusTable', {
            tableName: 'BulkUploadSTatusTable',
            partitionKey: { name: 'batchId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // serverless
            removalPolicy: cdk.RemovalPolicy.DESTROY, // only for dev/testing
        });
        //////////// S3 Resources ////////////
        //create S3 Bucket for images and static files
        const bucket = new s3.Bucket(this, 'BahtwinTestBucket', {
            bucketName: 'bahtwin-testing',
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });
        //////////// Rekognition Resources ////////////
        // Create an Amazon Rekognition Collection
        const collection = new aws_cdk_lib_1.aws_rekognition.CfnCollection(this, 'bahtwin-testing-collection', {
            collectionId: 'bahtwin-testing-collection',
        });
        //////////// SNS Resources ////////////
        // Create an SNS topic
        const arrivalTopic = new sns.Topic(this, 'VisitorArrivalTopic', {
            topicName: 'VisitorArrivalNotifications',
        });
        arrivalTopic.addSubscription(new subscriptions.SmsSubscription("+97332233417"));
        //////////// Lambda Resources ////////////
        //create lambda for pre registration
        const PreRegisterCheck = new lambda.Function(this, 'lambda_pre_register_check_Handler', {
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: 'PreRegisterCheck.PreRegisterCheck',
            code: lambda.Code.fromAsset('lambda'),
            environment: {
                BUCKET_NAME: bucket.bucketName,
                COLLECTION_ID: collection.collectionId,
                USER_TABLE: this.userTable.tableName,
            },
            timeout: cdk.Duration.seconds(30),
            functionName: 'PreRegisterCheck',
            logRetention: logs.RetentionDays.ONE_DAY, // <- CDK will manage the log group
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
                InviteTable: InvitedVisitorTable.tableName
            },
            timeout: cdk.Duration.seconds(30),
            functionName: 'ArrivalRekognition',
            logRetention: logs.RetentionDays.ONE_DAY, // <- CDK will manage the log group
        });
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
                FRONTEND_URL: 'http://localhost:5173/visitorfeedback', // your frontend link (test change later)
                GMAIL_USER: 'nonreplyfeedbackrequest@gmail.com', // Gmail address for sending
                GMAIL_PASS: 'thun ojje rdpt ocjg', // Gmail app password
            },
            timeout: cdk.Duration.seconds(30),
            functionName: 'SendFeedbackLambda',
            logRetention: logs.RetentionDays.ONE_DAY
        });
        //create lambda to save individual visitor invite
        const RegisterIndividualVisitor = new lambda.Function(this, 'RegisterIndividualVisitor', {
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: 'RegisterIndividualVisitor.handler',
            code: lambda.Code.fromAsset('lambda'),
            environment: {
                GMAIL_USER: 'nonreplyfeedbackrequest@gmail.com', // Gmail address for sending "this is for test create another one later"
                GMAIL_PASS: 'thun ojje rdpt ocjg',
                BUCKET_NAME: bucket.bucketName,
                InviteTable: InvitedVisitorTable.tableName,
            },
            timeout: cdk.Duration.seconds(30),
            functionName: 'RegisterIndividualVisitor',
            logRetention: logs.RetentionDays.ONE_DAY, // <- CDK will manage the log group
        });
        //create lambda for bulk upload invites
        const RegisterBulkVisitor = new lambda.Function(this, 'RegisterBulkVisitor', {
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: 'RegisterBulkVisitor.handler',
            code: lambda.Code.fromAsset('lambda'),
            environment: {
                GMAIL_USER: 'nonreplyfeedbackrequest@gmail.com', // Gmail address for sending "this is for test create another one later"
                GMAIL_PASS: 'thun ojje rdpt ocjg',
                BUCKET_NAME: bucket.bucketName,
                InviteTable: InvitedVisitorTable.tableName,
            },
            timeout: cdk.Duration.seconds(30),
            functionName: 'RegisterBulkVisitor',
            logRetention: logs.RetentionDays.ONE_DAY, // <- CDK will manage the log group
        });
        //////////// Grant permissions to Resources ////////////
        // Grant permissions for lambdas to S3 and the user table
        bucket.grantReadWrite(PreRegisterCheck);
        bucket.grantReadWrite(ArrivalRekognition);
        this.userTable.grantReadWriteData(PreRegisterCheck);
        this.userTable.grantReadWriteData(ArrivalRekognition);
        const arrivalRole = ArrivalRekognition.role;
        sendFeedbackLambda.grantInvoke(arrivalRole);
        InvitedVisitorTable.grantReadWriteData(RegisterIndividualVisitor);
        InvitedVisitorTable.grantReadWriteData(RegisterBulkVisitor);
        InvitedVisitorTable.grantReadData(ArrivalRekognition);
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
        //////////// API  Resources ////////////
        //create API
        const api_arrival = new apigw.RestApi(this, 'api_arrival', {
            restApiName: 'Bahtwin Visitor API',
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
    }
}
exports.FacialRecognitionStack = FacialRecognitionStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRmFjaWFsUmVjb2duaXRpb25TdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIkZhY2lhbFJlY29nbml0aW9uU3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFFbkMsdURBQXdDO0FBQ3hDLCtEQUFpRDtBQUNqRCx5REFBMkM7QUFDM0MsNkNBQTZEO0FBQzdELGtFQUFvRDtBQUNwRCwyREFBNkM7QUFDN0MsbUVBQXFEO0FBQ3JELHlEQUEyQztBQUMzQyxpRkFBbUU7QUFDbkUsMkNBQTZCO0FBQzdCLHFFQUErRDtBQUUvRCxNQUFhLHNCQUF1QixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3BDLFNBQVMsQ0FBaUI7SUFFekMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4Qiw0Q0FBNEM7UUFFNUMsY0FBYztRQUNkLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxXQUFXLEVBQUU7WUFDckQsU0FBUyxFQUFFLHFCQUFxQjtZQUNoQyxZQUFZLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtZQUNyRSxXQUFXLEVBQUUsUUFBUSxDQUFDLFdBQVcsQ0FBQyxlQUFlLEVBQUUsYUFBYTtZQUNoRSxhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxPQUFPLEVBQUUsdUJBQXVCO1NBQzlELENBQUMsQ0FBQztRQUVQLDBEQUEwRDtRQUMxRCxJQUFJLENBQUMsU0FBUyxDQUFDLHVCQUF1QixDQUFDO1lBQ3JDLFNBQVMsRUFBRSxZQUFZO1lBQ3ZCLFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FB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QUFTLENBQUMsU0FBUzthQUNyQztZQUNELE9BQU8sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7U0FDbEMsQ0FDRixDQUFDO1FBRUYsY0FBYztRQUNkLE1BQU0sQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDaEMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsYUFBYSxDQUFDLENBQUM7UUFFNUMsaUJBQWlCO1FBQ2pCLE1BQU0sbUJBQW1CLEdBQUcsZUFBZSxDQUFDLFdBQVcsQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUV6RSxtQkFBbUIsQ0FBQyxnQkFBZ0IsQ0FBQztZQUNuQyxZQUFZLEVBQUUsQ0FBQyxHQUFHLENBQUM7WUFDbkIsWUFBWSxFQUFFLENBQUMsS0FBSyxDQUFDO1NBQ3RCLENBQUMsQ0FBQztRQUVILG1CQUFtQixDQUFDLFNBQVMsQ0FDM0IsS0FBSyxFQUNMLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLGFBQWEsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUMzRCxFQUFFLGlCQUFpQixFQUFFLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLEVBQUUsQ0FDcEQsQ0FBQztJQUVBLENBQUM7Q0FDRjtBQWphRCx3REFpYUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xyXG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcclxuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJ1xyXG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XHJcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcclxuaW1wb3J0IHsgYXdzX3Jla29nbml0aW9uIGFzIHJla29nbml0aW9uIH0gZnJvbSAnYXdzLWNkay1saWInO1xyXG5pbXBvcnQgKiBhcyBhcGlndyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XHJcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xyXG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xyXG5pbXBvcnQgKiBhcyBzbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNucyc7XHJcbmltcG9ydCAqIGFzIHN1YnNjcmlwdGlvbnMgZnJvbSBcImF3cy1jZGstbGliL2F3cy1zbnMtc3Vic2NyaXB0aW9uc1wiO1xyXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xyXG5pbXBvcnQgeyBOb2RlanNGdW5jdGlvbiB9IGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtbGFtYmRhLW5vZGVqc1wiO1xyXG5cclxuZXhwb3J0IGNsYXNzIEZhY2lhbFJlY29nbml0aW9uU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xyXG4gcHVibGljIHJlYWRvbmx5IHVzZXJUYWJsZTogZHluYW1vZGIuVGFibGU7XHJcblxyXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcclxuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xyXG5cclxuICAgIC8vLy8vLy8vLy8vLyBEeW5hbW9EQiBSZXNvdXJjZXMgLy8vLy8vLy8vLy8vXHJcblxyXG4gICAgLy8gVXNlcnMgVGFibGVcclxuICAgIHRoaXMudXNlclRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICd1c2VyVGFibGUnLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogJ1VzZXJNYW5hZ2VtZW50VGFibGUnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3VzZXJJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsIC8vIHNlcnZlcmxlc3NcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSwgLy8gb25seSBmb3IgZGV2L3Rlc3RpbmdcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAvLyBFbnN1cmUgdXNlciByZWNvcmQgaXMgZXh0cmFjdGFibGUgdXNpbmcgdGhlIGVtYWlsIGZpZWxkXHJcbiAgICB0aGlzLnVzZXJUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgIGluZGV4TmFtZTogJ0VtYWlsSW5kZXgnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2VtYWlsJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcclxuICAgICAgfSk7XHJcblxyXG4gICAgLy8gRW5zdXJlIHVzZXIgcmVjb3JkIGlzIGV4dHJhY3RhYmxlIHVzaW5nIHRoZSBmYWNlSWRcclxuICAgIHRoaXMudXNlclRhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcclxuICAgICAgaW5kZXhOYW1lOiAnRmFjZUlkSW5kZXgnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2ZhY2VJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIHByb2plY3Rpb25UeXBlOiBkeW5hbW9kYi5Qcm9qZWN0aW9uVHlwZS5BTEwsIC8vIGluY2x1ZGUgYWxsIGNvbHVtbnNcclxuICAgICAgfSk7XHJcbiAgICAgICAgICBcclxuICAgIC8vIEFkZCBleHRyYSBhdHRyaWJ1dGVzIFxyXG4gICAgdGhpcy51c2VyVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgICBpbmRleE5hbWU6ICd2aXNpdGVkSW5kZXgnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3Zpc2l0ZWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxyXG4gICAgICB9KTtcclxuXHJcbiAgICAvLyBjcmVhdGUgdGFibGUgZm9yIGludml0ZWQgdmlzaXRvcnNcclxuICAgIGNvbnN0IEludml0ZWRWaXNpdG9yVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ0ludml0ZWRWaXNpdG9yVGFibGUnLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogJ0ludml0ZWRWaXNpdG9yVGFibGUnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3Zpc2l0b3JJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsIC8vIHNlcnZlcmxlc3NcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSwgLy8gb25seSBmb3IgZGV2L3Rlc3RpbmdcclxuICAgICAgfSk7XHJcblxyXG4gICAgLy8gRW5zdXJlIHZpc2l0b3IgcmVjb3JkIGlzIGV4dHJhY3RhYmxlIHVzaW5nIHRoZSBlbWFpbCBmaWVsZFxyXG4gICAgSW52aXRlZFZpc2l0b3JUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XHJcbiAgICAgICAgaW5kZXhOYW1lOiAnRW1haWxWaXNpdERhdGVJbmRleCcsXHJcbiAgICAgICAgcGFydGl0aW9uS2V5OiB7XHJcbiAgICAgICAgICBuYW1lOiAnZW1haWwnLFxyXG4gICAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXHJcbiAgICAgICAgfSxcclxuICAgICAgICBzb3J0S2V5OiB7XHJcbiAgICAgICAgICBuYW1lOiAndmlzaXREYXRlJyxcclxuICAgICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcclxuICAgICAgfSk7XHJcblxyXG4gICAgICAgIC8vIGNyZWF0ZSBCdWxrVXBsb2FkU1RhdHVzVGFibGUgdGFibGVcclxuICAgIGNvbnN0IEJ1bGtVcGxvYWRTVGF0dXNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnQnVsa1VwbG9hZFNUYXR1c1RhYmxlJywge1xyXG4gICAgICB0YWJsZU5hbWU6ICdCdWxrVXBsb2FkU1RhdHVzVGFibGUnLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2JhdGNoSWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxyXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULCAvLyBzZXJ2ZXJsZXNzXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksIC8vIG9ubHkgZm9yIGRldi90ZXN0aW5nXHJcbiAgICAgIH0pO1xyXG5cclxuICAgIC8vLy8vLy8vLy8vLyBTMyBSZXNvdXJjZXMgLy8vLy8vLy8vLy8vXHJcblxyXG4gICAgLy9jcmVhdGUgUzMgQnVja2V0IGZvciBpbWFnZXMgYW5kIHN0YXRpYyBmaWxlc1xyXG4gICAgY29uc3QgYnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnQmFodHdpblRlc3RCdWNrZXQnLHtcclxuICAgICAgYnVja2V0TmFtZTogJ2JhaHR3aW4tdGVzdGluZycsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICAgIGF1dG9EZWxldGVPYmplY3RzOnRydWUsXHJcbiAgICAgIH0pO1xyXG4gICAgXHJcbiAgICAvLy8vLy8vLy8vLy8gUmVrb2duaXRpb24gUmVzb3VyY2VzIC8vLy8vLy8vLy8vL1xyXG5cclxuICAgIC8vIENyZWF0ZSBhbiBBbWF6b24gUmVrb2duaXRpb24gQ29sbGVjdGlvblxyXG4gICAgY29uc3QgY29sbGVjdGlvbj0gbmV3IHJla29nbml0aW9uLkNmbkNvbGxlY3Rpb24odGhpcywgJ2JhaHR3aW4tdGVzdGluZy1jb2xsZWN0aW9uJywge1xyXG4gICAgICBjb2xsZWN0aW9uSWQ6ICdiYWh0d2luLXRlc3RpbmctY29sbGVjdGlvbicsIFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8vLy8vLy8vLy8vIFNOUyBSZXNvdXJjZXMgLy8vLy8vLy8vLy8vXHJcblxyXG4gICAgLy8gQ3JlYXRlIGFuIFNOUyB0b3BpY1xyXG4gICAgY29uc3QgYXJyaXZhbFRvcGljID0gbmV3IHNucy5Ub3BpYyh0aGlzLCAnVmlzaXRvckFycml2YWxUb3BpYycsIHtcclxuICAgICAgdG9waWNOYW1lOiAnVmlzaXRvckFycml2YWxOb3RpZmljYXRpb25zJyxcclxuICAgIH0pO1xyXG4gICAgYXJyaXZhbFRvcGljLmFkZFN1YnNjcmlwdGlvbihcclxuICBuZXcgc3Vic2NyaXB0aW9ucy5TbXNTdWJzY3JpcHRpb24oXCIrOTczMzIyMzM0MTdcIilcclxuKTtcclxuXHJcbiAgICAvLy8vLy8vLy8vLy8gTGFtYmRhIFJlc291cmNlcyAvLy8vLy8vLy8vLy9cclxuXHJcbiAgICAvL2NyZWF0ZSBsYW1iZGEgZm9yIHByZSByZWdpc3RyYXRpb25cclxuICAgIGNvbnN0IFByZVJlZ2lzdGVyQ2hlY2sgPW5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ2xhbWJkYV9wcmVfcmVnaXN0ZXJfY2hlY2tfSGFuZGxlcicse1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMSxcclxuICAgICAgaGFuZGxlcjonUHJlUmVnaXN0ZXJDaGVjay5QcmVSZWdpc3RlckNoZWNrJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEnKSxcclxuICAgICAgZW52aXJvbm1lbnQ6e1xyXG4gICAgICAgIEJVQ0tFVF9OQU1FOiBidWNrZXQuYnVja2V0TmFtZSxcclxuICAgICAgICBDT0xMRUNUSU9OX0lEOiBjb2xsZWN0aW9uLmNvbGxlY3Rpb25JZCxcclxuICAgICAgICBVU0VSX1RBQkxFOnRoaXMudXNlclRhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgfSxcclxuICAgICAgdGltZW91dDpjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ1ByZVJlZ2lzdGVyQ2hlY2snLCBcclxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX0RBWSwgLy8gPC0gQ0RLIHdpbGwgbWFuYWdlIHRoZSBsb2cgZ3JvdXBcclxuICAgIH0pO1xyXG4gICAgICAgXHJcbiAgICAvL2NyZWF0ZSBsYW1iZGEgZm9yIGFycml2YWxzIHBpY3R1cmVcclxuICAgIGNvbnN0IEFycml2YWxSZWtvZ25pdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0Fycml2YWxfSGFuZGxlcicse1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMSxcclxuICAgICAgaGFuZGxlcjonQXJyaXZhbFJla29nbml0aW9uLkFycml2YWxSZWtvZ25pdGlvbicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhJyksXHJcbiAgICAgIGVudmlyb25tZW50OntcclxuICAgICAgICBCVUNLRVRfTkFNRTogYnVja2V0LmJ1Y2tldE5hbWUsXHJcbiAgICAgICAgQ09MTEVDVElPTl9JRDogY29sbGVjdGlvbi5jb2xsZWN0aW9uSWQsXHJcbiAgICAgICAgVVNFUl9UQUJMRTogdGhpcy51c2VyVGFibGUudGFibGVOYW1lLFxyXG4gICAgICAgIFRPUElDX0FSTjogYXJyaXZhbFRvcGljLnRvcGljQXJuLFxyXG4gICAgICAgIEludml0ZVRhYmxlOiBJbnZpdGVkVmlzaXRvclRhYmxlLnRhYmxlTmFtZVxyXG4gICAgICB9LFxyXG4gICAgICB0aW1lb3V0OmNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcclxuICAgICAgZnVuY3Rpb25OYW1lOiAnQXJyaXZhbFJla29nbml0aW9uJywgXHJcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9EQVksIC8vIDwtIENESyB3aWxsIG1hbmFnZSB0aGUgbG9nIGdyb3VwXHJcbiAgICB9KTtcclxuXHJcbiAgICAvL2NyZWF0ZSBsYW1iZGEgdG8gc2VuZCBmZWVkYmFja1xyXG4gICAgY29uc3Qgc2VuZEZlZWRiYWNrTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnU2VuZEZlZWRiYWNrTGFtYmRhJywge1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMSxcclxuICAgICAgaGFuZGxlcjogJ3NlbmRGZWVkYmFja0xhbWJkYS5oYW5kbGVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi9sYW1iZGEnKSwge1xyXG4gICAgICAgIGJ1bmRsaW5nOiB7XHJcbiAgICAgICAgICBpbWFnZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTEuYnVuZGxpbmdJbWFnZSxcclxuICAgICAgICAgIGNvbW1hbmQ6IFtcclxuICAgICAgICAgICAgXCJiYXNoXCIsIFwiLWNcIixcclxuICAgICAgICAgICAgYFxyXG4gICAgICAgICAgICBwaXAgaW5zdGFsbCAtciByZXF1aXJlbWVudHMudHh0IC10IC9hc3NldC1vdXRwdXQgJiZcclxuICAgICAgICAgICAgY3AgLXIgLiAvYXNzZXQtb3V0cHV0XHJcbiAgICAgICAgICAgIGBcclxuICAgICAgICAgIF0sXHJcbiAgICAgICAgfSxcclxuICAgICAgfSksXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgSldUX1NFQ1JFVDogJ3NlY3JldCcsICAvLyBzYW1lIGFzIGJlZm9yZVxyXG4gICAgICAgIEZST05URU5EX1VSTDogJ2h0dHA6Ly9sb2NhbGhvc3Q6NTE3My92aXNpdG9yZmVlZGJhY2snLCAgLy8geW91ciBmcm9udGVuZCBsaW5rICh0ZXN0IGNoYW5nZSBsYXRlcilcclxuICAgICAgICBHTUFJTF9VU0VSOiAnbm9ucmVwbHlmZWVkYmFja3JlcXVlc3RAZ21haWwuY29tJywgICAgICAvLyBHbWFpbCBhZGRyZXNzIGZvciBzZW5kaW5nXHJcbiAgICAgICAgR01BSUxfUEFTUzogJ3RodW4gb2pqZSByZHB0IG9jamcnLCAgICAgICAgLy8gR21haWwgYXBwIHBhc3N3b3JkXHJcbiAgICAgIH0sXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcclxuICAgICAgZnVuY3Rpb25OYW1lOiAnU2VuZEZlZWRiYWNrTGFtYmRhJyxcclxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX0RBWVxyXG4gICAgfSk7XHJcblxyXG4gICAgLy9jcmVhdGUgbGFtYmRhIHRvIHNhdmUgaW5kaXZpZHVhbCB2aXNpdG9yIGludml0ZVxyXG4gICAgY29uc3QgUmVnaXN0ZXJJbmRpdmlkdWFsVmlzaXRvciA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1JlZ2lzdGVySW5kaXZpZHVhbFZpc2l0b3InLHtcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTEsXHJcbiAgICAgIGhhbmRsZXI6J1JlZ2lzdGVySW5kaXZpZHVhbFZpc2l0b3IuaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhJyksXHJcbiAgICAgIGVudmlyb25tZW50OntcclxuICAgICAgICBHTUFJTF9VU0VSOiAnbm9ucmVwbHlmZWVkYmFja3JlcXVlc3RAZ21haWwuY29tJywgICAgICAvLyBHbWFpbCBhZGRyZXNzIGZvciBzZW5kaW5nIFwidGhpcyBpcyBmb3IgdGVzdCBjcmVhdGUgYW5vdGhlciBvbmUgbGF0ZXJcIlxyXG4gICAgICAgIEdNQUlMX1BBU1M6ICd0aHVuIG9qamUgcmRwdCBvY2pnJywgXHJcbiAgICAgICAgQlVDS0VUX05BTUU6IGJ1Y2tldC5idWNrZXROYW1lLFxyXG4gICAgICAgIEludml0ZVRhYmxlOiBJbnZpdGVkVmlzaXRvclRhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgfSxcclxuICAgICAgdGltZW91dDpjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ1JlZ2lzdGVySW5kaXZpZHVhbFZpc2l0b3InLCBcclxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX0RBWSwgLy8gPC0gQ0RLIHdpbGwgbWFuYWdlIHRoZSBsb2cgZ3JvdXBcclxuICAgIH0pO1xyXG5cclxuXHJcbiAgICAvL2NyZWF0ZSBsYW1iZGEgZm9yIGJ1bGsgdXBsb2FkIGludml0ZXNcclxuICAgIGNvbnN0IFJlZ2lzdGVyQnVsa1Zpc2l0b3IgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdSZWdpc3RlckJ1bGtWaXNpdG9yJyx7XHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzExLFxyXG4gICAgICBoYW5kbGVyOidSZWdpc3RlckJ1bGtWaXNpdG9yLmhhbmRsZXInLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYScpLFxyXG4gICAgICBlbnZpcm9ubWVudDp7XHJcbiAgICAgICAgR01BSUxfVVNFUjogJ25vbnJlcGx5ZmVlZGJhY2tyZXF1ZXN0QGdtYWlsLmNvbScsICAgICAgLy8gR21haWwgYWRkcmVzcyBmb3Igc2VuZGluZyBcInRoaXMgaXMgZm9yIHRlc3QgY3JlYXRlIGFub3RoZXIgb25lIGxhdGVyXCJcclxuICAgICAgICBHTUFJTF9QQVNTOiAndGh1biBvamplIHJkcHQgb2NqZycsIFxyXG4gICAgICAgIEJVQ0tFVF9OQU1FOiBidWNrZXQuYnVja2V0TmFtZSxcclxuICAgICAgICBJbnZpdGVUYWJsZTogSW52aXRlZFZpc2l0b3JUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgIH0sXHJcbiAgICAgIHRpbWVvdXQ6Y2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxyXG4gICAgICBmdW5jdGlvbk5hbWU6ICdSZWdpc3RlckJ1bGtWaXNpdG9yJywgXHJcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9EQVksIC8vIDwtIENESyB3aWxsIG1hbmFnZSB0aGUgbG9nIGdyb3VwXHJcbiAgICB9KTtcclxuXHJcblxyXG4gICAgLy8vLy8vLy8vLy8vIEdyYW50IHBlcm1pc3Npb25zIHRvIFJlc291cmNlcyAvLy8vLy8vLy8vLy9cclxuXHJcbiAgICAvLyBHcmFudCBwZXJtaXNzaW9ucyBmb3IgbGFtYmRhcyB0byBTMyBhbmQgdGhlIHVzZXIgdGFibGVcclxuICAgIGJ1Y2tldC5ncmFudFJlYWRXcml0ZShQcmVSZWdpc3RlckNoZWNrKTtcclxuICAgIGJ1Y2tldC5ncmFudFJlYWRXcml0ZShBcnJpdmFsUmVrb2duaXRpb24pO1xyXG4gICAgdGhpcy51c2VyVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKFByZVJlZ2lzdGVyQ2hlY2spO1xyXG4gICAgdGhpcy51c2VyVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKEFycml2YWxSZWtvZ25pdGlvbik7XHJcbiAgICBjb25zdCBhcnJpdmFsUm9sZSA9IEFycml2YWxSZWtvZ25pdGlvbi5yb2xlITtcclxuICAgIHNlbmRGZWVkYmFja0xhbWJkYS5ncmFudEludm9rZShhcnJpdmFsUm9sZSk7XHJcbiAgICBJbnZpdGVkVmlzaXRvclRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShSZWdpc3RlckluZGl2aWR1YWxWaXNpdG9yKTtcclxuICAgIEludml0ZWRWaXNpdG9yVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKFJlZ2lzdGVyQnVsa1Zpc2l0b3IpO1xyXG4gICAgSW52aXRlZFZpc2l0b3JUYWJsZS5ncmFudFJlYWREYXRhKEFycml2YWxSZWtvZ25pdGlvbik7XHJcbiAgICAvLyBHcmFudCBMYW1iZGEgcGVybWlzc2lvbiB0byBwdWJsaXNoIHRvIFNOU1xyXG4gICAgYXJyaXZhbFRvcGljLmdyYW50UHVibGlzaChBcnJpdmFsUmVrb2duaXRpb24pO1xyXG5cclxuICAgIC8vIEdpdmUgcGVybWlzc2lvbnMgZm9yIFByZVJlZ2lzdGVyQ2hlY2sgbGFtYmRhIHRvIHVzZSBBbWF6b24gUmVrb2duaXRpb24gXHJcbiAgICBQcmVSZWdpc3RlckNoZWNrLmFkZFRvUm9sZVBvbGljeShcclxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICAgIGFjdGlvbnM6IFtcclxuICAgICAgICAgICdyZWtvZ25pdGlvbjpJbmRleEZhY2VzJyxcclxuICAgICAgICAgICdyZWtvZ25pdGlvbjpTZWFyY2hGYWNlc0J5SW1hZ2UnLFxyXG4gICAgICAgICAgJ3Jla29nbml0aW9uOkRldGVjdEZhY2VzJyxcclxuICAgICAgICBdLFxyXG4gICAgICAgIHJlc291cmNlczogWycqJ10sIFxyXG4gICAgICAgIFxyXG4gICAgICB9KVxyXG4gICAgKTtcclxuXHJcbiAgICAvLyBHaXZlIHBlcm1pc3Npb25zIGZvciBBcnJpdmFsUmVrb2duaXRpb24gbGFtYmRhIHRvIHVzZSBBbWF6b24gUmVrb2duaXRpb24gXHJcbiAgICBBcnJpdmFsUmVrb2duaXRpb24uYWRkVG9Sb2xlUG9saWN5KFxyXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgICAgYWN0aW9uczogW1xyXG4gICAgICAgICAgJ3Jla29nbml0aW9uOkluZGV4RmFjZXMnLFxyXG4gICAgICAgICAgJ3Jla29nbml0aW9uOlNlYXJjaEZhY2VzQnlJbWFnZScsXHJcbiAgICAgICAgICAncmVrb2duaXRpb246RGV0ZWN0RmFjZXMnLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgcmVzb3VyY2VzOiBbJyonXSwgXHJcbiAgICAgICAgXHJcbiAgICAgIH0pXHJcbiAgICApO1xyXG5cclxuICAgIEFycml2YWxSZWtvZ25pdGlvbi5hZGRUb1JvbGVQb2xpY3koXHJcbiAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgYWN0aW9uczogW1wic25zOlB1Ymxpc2hcIl0sXHJcbiAgICByZXNvdXJjZXM6IFtcIipcIl0sXHJcbiAgfSlcclxuKTtcclxuXHJcbiAgICAvLy8vLy8vLy8vLy8gQVBJICBSZXNvdXJjZXMgLy8vLy8vLy8vLy8vXHJcblxyXG4gICAgLy9jcmVhdGUgQVBJXHJcbiAgICBjb25zdCBhcGlfYXJyaXZhbCA9IG5ldyBhcGlndy5SZXN0QXBpKHRoaXMsICdhcGlfYXJyaXZhbCcsIHtcclxuICAgICAgcmVzdEFwaU5hbWU6ICdCYWh0d2luIFZpc2l0b3IgQVBJJyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIGNyZWF0ZSB2aXNpdG9yIHJlc291cmNlIGZvciB0aGUgYXBpXHJcbiAgICBjb25zdCB2aXNpdG9yUmVzb3VyY2UgPSBhcGlfYXJyaXZhbC5yb290LmFkZFJlc291cmNlKCd2aXNpdG9yJyk7XHJcblxyXG4gICAgLy8gY3JlYXRlIGFycml2YWwgcmVzb3VyY2UgdW5kZXIgdGhlIHZpc2l0b3IgcmVzb3VyY2VcclxuICAgIGNvbnN0IGFycml2YWxSZXNvdXJjZSA9IHZpc2l0b3JSZXNvdXJjZS5hZGRSZXNvdXJjZSgnYXJyaXZhbCcpO1xyXG5cclxuICAgIC8vIGNyZWF0ZSByZWdpc3RlciByZXNvdXJjZSB1bmRlciB0aGUgdmlzaXRvciByZXNvdXJjZVxyXG4gICAgY29uc3QgcmVnaXN0ZXJSZXNvdXJjZSA9IHZpc2l0b3JSZXNvdXJjZS5hZGRSZXNvdXJjZSgncmVnaXN0ZXInKTtcclxuXHJcbiAgICAvLyBjb25uZWN0IFBPU1QgdG8gTGFtYmRhXHJcbiAgICBhcnJpdmFsUmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKEFycml2YWxSZWtvZ25pdGlvbiwge1xyXG4gICAgICBwcm94eTogdHJ1ZSxcclxuICAgIH0pKTtcclxuXHJcbiAgICAvLyBjb25uZWN0IFBPU1QgdG8gTGFtYmRhXHJcbiAgICByZWdpc3RlclJlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbihQcmVSZWdpc3RlckNoZWNrLCB7XHJcbiAgICAgIHByb3h5OiB0cnVlLFxyXG4gICAgfSkpO1xyXG5cclxuICAgIC8vLy8gY3JlYXRlIGFkbWluIHJlc291cmNlIGZvciB0aGUgYXBpXHJcbiAgICBjb25zdCBhZG1pblJlc291cmNlID0gYXBpX2Fycml2YWwucm9vdC5hZGRSZXNvdXJjZSgnYWRtaW4nKTtcclxuXHJcbiAgICAvLyBjcmVhdGUgaW5kaXZpZHVhbCByZWdpc3RlciByZXNvdXJjZSB1bmRlciB0aGUgYWRtaW4gcmVzb3VyY2VcclxuICAgIGNvbnN0IHJlZ2lzdGVyVmlzaXRvckluZGl2aWR1YWwgPSBhZG1pblJlc291cmNlLmFkZFJlc291cmNlKCdyZWdpc3RlclZpc2l0b3JJbmRpdmlkdWFsJyk7XHJcbiAgICBcclxuICAgIC8vIGNvbm5lY3QgUE9TVCB0byBMYW1iZGFcclxuICAgIHJlZ2lzdGVyVmlzaXRvckluZGl2aWR1YWwuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKFJlZ2lzdGVySW5kaXZpZHVhbFZpc2l0b3IsIHtcclxuICAgICAgcHJveHk6IHRydWUsXHJcbiAgICB9KSk7XHJcblxyXG4gICAgLy8gY3JlYXRlIGJ1bGsgcmVnaXN0ZXIgcmVzb3VyY2UgdW5kZXIgdGhlIGFkbWluIHJlc291cmNlXHJcbiAgICBjb25zdCByZWdpc3RlclZpc2l0b3JCdWxrID0gYWRtaW5SZXNvdXJjZS5hZGRSZXNvdXJjZSgncmVnaXN0ZXJWaXNpdG9yQnVsaycpO1xyXG4gICAgXHJcbiAgICAvLyBjb25uZWN0IFBPU1QgdG8gTGFtYmRhXHJcbiAgICByZWdpc3RlclZpc2l0b3JCdWxrLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbihSZWdpc3RlckJ1bGtWaXNpdG9yLCB7XHJcbiAgICAgIHByb3h5OiB0cnVlLFxyXG4gICAgfSkpO1xyXG5cclxuICAgIGFycml2YWxSZXNvdXJjZS5hZGRNZXRob2QoJ09QVElPTlMnLCBuZXcgYXBpZ3cuTW9ja0ludGVncmF0aW9uKHtcclxuICAgICAgaW50ZWdyYXRpb25SZXNwb25zZXM6IFt7XHJcbiAgICAgICAgc3RhdHVzQ29kZTogJzIwMCcsXHJcbiAgICAgICAgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XHJcbiAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzogXCInQ29udGVudC1UeXBlLFgtQW16LURhdGUsQXV0aG9yaXphdGlvbixYLUFwaS1LZXksWC1BbXotU2VjdXJpdHktVG9rZW4nXCIsXHJcbiAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiBcIicqJ1wiLFxyXG4gICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6IFwiJ1BPU1QsT1BUSU9OUydcIixcclxuICAgICAgICB9LFxyXG4gICAgICB9XSxcclxuICAgICAgcGFzc3Rocm91Z2hCZWhhdmlvcjogYXBpZ3cuUGFzc3Rocm91Z2hCZWhhdmlvci5ORVZFUixcclxuICAgICAgcmVxdWVzdFRlbXBsYXRlczoge1xyXG4gICAgICAgICdhcHBsaWNhdGlvbi9qc29uJzogJ3tcInN0YXR1c0NvZGVcIjogMjAwfSdcclxuICAgICAgfSxcclxuICAgIH0pLCB7XHJcbiAgICAgIG1ldGhvZFJlc3BvbnNlczogW3tcclxuICAgICAgICBzdGF0dXNDb2RlOiAnMjAwJyxcclxuICAgICAgICByZXNwb25zZVBhcmFtZXRlcnM6IHtcclxuICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiB0cnVlLFxyXG4gICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6IHRydWUsXHJcbiAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiB0cnVlLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH1dLFxyXG4gICAgfSk7XHJcblxyXG5cclxuICAgIHJlZ2lzdGVyUmVzb3VyY2UuYWRkTWV0aG9kKCdPUFRJT05TJywgbmV3IGFwaWd3Lk1vY2tJbnRlZ3JhdGlvbih7XHJcbiAgICAgIGludGVncmF0aW9uUmVzcG9uc2VzOiBbe1xyXG4gICAgICAgIHN0YXR1c0NvZGU6ICcyMDAnLFxyXG4gICAgICAgIHJlc3BvbnNlUGFyYW1ldGVyczoge1xyXG4gICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6IFwiJ0NvbnRlbnQtVHlwZSxYLUFtei1EYXRlLEF1dGhvcml6YXRpb24sWC1BcGktS2V5LFgtQW16LVNlY3VyaXR5LVRva2VuJ1wiLFxyXG4gICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogXCInKidcIixcclxuICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnOiBcIidQT1NULE9QVElPTlMnXCIsXHJcbiAgICAgICAgfSxcclxuICAgICAgfV0sXHJcbiAgICAgIHBhc3N0aHJvdWdoQmVoYXZpb3I6IGFwaWd3LlBhc3N0aHJvdWdoQmVoYXZpb3IuTkVWRVIsXHJcbiAgICAgIHJlcXVlc3RUZW1wbGF0ZXM6IHtcclxuICAgICAgICAnYXBwbGljYXRpb24vanNvbic6ICd7XCJzdGF0dXNDb2RlXCI6IDIwMH0nXHJcbiAgICAgIH0sXHJcbiAgICB9KSwge1xyXG4gICAgICBtZXRob2RSZXNwb25zZXM6IFt7XHJcbiAgICAgICAgc3RhdHVzQ29kZTogJzIwMCcsXHJcbiAgICAgICAgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XHJcbiAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzogdHJ1ZSxcclxuICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnOiB0cnVlLFxyXG4gICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogdHJ1ZSxcclxuICAgICAgICB9LFxyXG4gICAgICB9XSxcclxuICAgIH0pO1xyXG5cclxuICAgIHJlZ2lzdGVyVmlzaXRvckluZGl2aWR1YWwuYWRkTWV0aG9kKCdPUFRJT05TJywgbmV3IGFwaWd3Lk1vY2tJbnRlZ3JhdGlvbih7XHJcbiAgICAgIGludGVncmF0aW9uUmVzcG9uc2VzOiBbe1xyXG4gICAgICAgIHN0YXR1c0NvZGU6ICcyMDAnLFxyXG4gICAgICAgIHJlc3BvbnNlUGFyYW1ldGVyczoge1xyXG4gICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6IFwiJ0NvbnRlbnQtVHlwZSxYLUFtei1EYXRlLEF1dGhvcml6YXRpb24sWC1BcGktS2V5LFgtQW16LVNlY3VyaXR5LVRva2VuJ1wiLFxyXG4gICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogXCInKidcIixcclxuICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnOiBcIidQT1NULE9QVElPTlMnXCIsXHJcbiAgICAgICAgfSxcclxuICAgICAgfV0sXHJcbiAgICAgIHBhc3N0aHJvdWdoQmVoYXZpb3I6IGFwaWd3LlBhc3N0aHJvdWdoQmVoYXZpb3IuTkVWRVIsXHJcbiAgICAgIHJlcXVlc3RUZW1wbGF0ZXM6IHtcclxuICAgICAgICAnYXBwbGljYXRpb24vanNvbic6ICd7XCJzdGF0dXNDb2RlXCI6IDIwMH0nXHJcbiAgICAgIH0sXHJcbiAgICB9KSwge1xyXG4gICAgICBtZXRob2RSZXNwb25zZXM6IFt7XHJcbiAgICAgICAgc3RhdHVzQ29kZTogJzIwMCcsXHJcbiAgICAgICAgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XHJcbiAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzogdHJ1ZSxcclxuICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnOiB0cnVlLFxyXG4gICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogdHJ1ZSxcclxuICAgICAgICB9LFxyXG4gICAgICB9XSxcclxuICAgIH0pO1xyXG5cclxuICAgIHJlZ2lzdGVyVmlzaXRvckJ1bGsuYWRkTWV0aG9kKCdPUFRJT05TJywgbmV3IGFwaWd3Lk1vY2tJbnRlZ3JhdGlvbih7XHJcbiAgICAgIGludGVncmF0aW9uUmVzcG9uc2VzOiBbe1xyXG4gICAgICAgIHN0YXR1c0NvZGU6ICcyMDAnLFxyXG4gICAgICAgIHJlc3BvbnNlUGFyYW1ldGVyczoge1xyXG4gICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6IFwiJ0NvbnRlbnQtVHlwZSxYLUFtei1EYXRlLEF1dGhvcml6YXRpb24sWC1BcGktS2V5LFgtQW16LVNlY3VyaXR5LVRva2VuJ1wiLFxyXG4gICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogXCInKidcIixcclxuICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnOiBcIidQT1NULE9QVElPTlMnXCIsXHJcbiAgICAgICAgfSxcclxuICAgICAgfV0sXHJcbiAgICAgIHBhc3N0aHJvdWdoQmVoYXZpb3I6IGFwaWd3LlBhc3N0aHJvdWdoQmVoYXZpb3IuTkVWRVIsXHJcbiAgICAgIHJlcXVlc3RUZW1wbGF0ZXM6IHtcclxuICAgICAgICAnYXBwbGljYXRpb24vanNvbic6ICd7XCJzdGF0dXNDb2RlXCI6IDIwMH0nXHJcbiAgICAgIH0sXHJcbiAgICB9KSwge1xyXG4gICAgICBtZXRob2RSZXNwb25zZXM6IFt7XHJcbiAgICAgICAgc3RhdHVzQ29kZTogJzIwMCcsXHJcbiAgICAgICAgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XHJcbiAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzogdHJ1ZSxcclxuICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnOiB0cnVlLFxyXG4gICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogdHJ1ZSxcclxuICAgICAgICB9LFxyXG4gICAgICB9XSxcclxuICAgIH0pO1xyXG5cclxuICAgIFxyXG5cclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4vLyBHRVQgSU1BR0UgVVJMIChwcmVzaWduZWQgR0VUIFVSTClcclxuLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbmNvbnN0IGdldEltYWdlVXJsRm4gPSBuZXcgTm9kZWpzRnVuY3Rpb24oXHJcbiAgdGhpcyxcclxuICBcIkdlbmVyYXRlUHJlc2lnbmVkSW1hZ2VVcmxIYW5kbGVyXCIsXHJcbiAge1xyXG4gICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXHJcbiAgICBlbnRyeTogcGF0aC5qb2luKF9fZGlybmFtZSwgXCIuLi9sYW1iZGEvZ2VuZXJhdGVQcmVzaWduZWREb3dubG9hZFVybC50c1wiKSxcclxuICAgIGhhbmRsZXI6IFwiaGFuZGxlclwiLFxyXG4gICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgQlVDS0VUX05BTUU6IGJ1Y2tldC5idWNrZXROYW1lLFxyXG4gICAgICBVU0VSX1RBQkxFOiB0aGlzLnVzZXJUYWJsZS50YWJsZU5hbWUsIFxyXG4gICAgfSxcclxuICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcclxuICB9XHJcbik7XHJcblxyXG4vLyBQZXJtaXNzaW9uc1xyXG5idWNrZXQuZ3JhbnRSZWFkKGdldEltYWdlVXJsRm4pOyAgICAgICAgICAgICAgICAgXHJcbnRoaXMudXNlclRhYmxlLmdyYW50UmVhZERhdGEoZ2V0SW1hZ2VVcmxGbik7ICAgIFxyXG5cclxuLy8gQVBJIEdhdGV3YXk6IHdcclxuY29uc3QgZ2V0SW1hZ2VVcmxSZXNvdXJjZSA9IHZpc2l0b3JSZXNvdXJjZS5hZGRSZXNvdXJjZShcImdldC1pbWFnZS11cmxcIik7XHJcblxyXG5nZXRJbWFnZVVybFJlc291cmNlLmFkZENvcnNQcmVmbGlnaHQoe1xyXG4gIGFsbG93T3JpZ2luczogW1wiKlwiXSxcclxuICBhbGxvd01ldGhvZHM6IFtcIkdFVFwiXSxcclxufSk7XHJcblxyXG5nZXRJbWFnZVVybFJlc291cmNlLmFkZE1ldGhvZChcclxuICBcIkdFVFwiLFxyXG4gIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbihnZXRJbWFnZVVybEZuLCB7IHByb3h5OiB0cnVlIH0pLFxyXG4gIHsgYXV0aG9yaXphdGlvblR5cGU6IGFwaWd3LkF1dGhvcml6YXRpb25UeXBlLk5PTkUgfVxyXG4pO1xyXG4gICAgXHJcbiAgfVxyXG59XHJcbiJdfQ==