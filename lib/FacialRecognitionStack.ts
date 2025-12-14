import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { aws_rekognition as rekognition } from 'aws-cdk-lib';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as path from 'path';
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";


export class FacialRecognitionStack extends cdk.Stack {
 public readonly userTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
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
    const bucket = new s3.Bucket(this, 'BahtwinTestBucket',{
      bucketName: 'bahtwin-testing',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects:true,
      });
    
    //////////// Rekognition Resources ////////////

    // Create an Amazon Rekognition Collection
    const collection= new rekognition.CfnCollection(this, 'bahtwin-testing-collection', {
      collectionId: 'bahtwin-testing-collection', 
    });

    //////////// SNS Resources ////////////

    // Create an SNS topic
    const arrivalTopic = new sns.Topic(this, 'VisitorArrivalTopic', {
      topicName: 'VisitorArrivalNotifications',
    });
    arrivalTopic.addSubscription(
  new subscriptions.SmsSubscription("+97332233417")
);

    //////////// Lambda Resources ////////////

    //create lambda for pre registration
    const PreRegisterCheck =new lambda.Function(this, 'lambda_pre_register_check_Handler',{
      runtime: lambda.Runtime.PYTHON_3_11,
      handler:'PreRegisterCheck.PreRegisterCheck',
      code: lambda.Code.fromAsset('lambda'),
      environment:{
        BUCKET_NAME: bucket.bucketName,
        COLLECTION_ID: collection.collectionId,
        USER_TABLE:this.userTable.tableName,
      },
      timeout:cdk.Duration.seconds(30),
      functionName: 'PreRegisterCheck', 
      logRetention: logs.RetentionDays.ONE_DAY, // <- CDK will manage the log group
    });
       
    //create lambda for arrivals picture
    const ArrivalRekognition = new lambda.Function(this, 'Arrival_Handler',{
      runtime: lambda.Runtime.PYTHON_3_11,
      handler:'ArrivalRekognition.ArrivalRekognition',
      code: lambda.Code.fromAsset('lambda'),
      environment:{
        BUCKET_NAME: bucket.bucketName,
        COLLECTION_ID: collection.collectionId,
        USER_TABLE: this.userTable.tableName,
        TOPIC_ARN: arrivalTopic.topicArn,
        InviteTable: InvitedVisitorTable.tableName
      },
      timeout:cdk.Duration.seconds(30),
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
        JWT_SECRET: 'secret',  // same as before
        FRONTEND_URL: 'http://localhost:5173/visitorfeedback',  // your frontend link (test change later)
        GMAIL_USER: 'nonreplyfeedbackrequest@gmail.com',      // Gmail address for sending
        GMAIL_PASS: 'thun ojje rdpt ocjg',        // Gmail app password
      },
      timeout: cdk.Duration.seconds(30),
      functionName: 'SendFeedbackLambda',
      logRetention: logs.RetentionDays.ONE_DAY
    });

    //create lambda to save individual visitor invite
    const RegisterIndividualVisitor = new lambda.Function(this, 'RegisterIndividualVisitor',{
      runtime: lambda.Runtime.PYTHON_3_11,
      handler:'RegisterIndividualVisitor.handler',
      code: lambda.Code.fromAsset('lambda'),
      environment:{
        GMAIL_USER: 'nonreplyfeedbackrequest@gmail.com',      // Gmail address for sending "this is for test create another one later"
        GMAIL_PASS: 'thun ojje rdpt ocjg', 
        BUCKET_NAME: bucket.bucketName,
        InviteTable: InvitedVisitorTable.tableName,
      },
      timeout:cdk.Duration.seconds(30),
      functionName: 'RegisterIndividualVisitor', 
      logRetention: logs.RetentionDays.ONE_DAY, // <- CDK will manage the log group
    });


    //create lambda for bulk upload invites
    const RegisterBulkVisitor = new lambda.Function(this, 'RegisterBulkVisitor',{
      runtime: lambda.Runtime.PYTHON_3_11,
      handler:'RegisterBulkVisitor.handler',
      code: lambda.Code.fromAsset('lambda'),
      environment:{
        GMAIL_USER: 'nonreplyfeedbackrequest@gmail.com',      // Gmail address for sending "this is for test create another one later"
        GMAIL_PASS: 'thun ojje rdpt ocjg', 
        BUCKET_NAME: bucket.bucketName,
        InviteTable: InvitedVisitorTable.tableName,
      },
      timeout:cdk.Duration.seconds(30),
      functionName: 'RegisterBulkVisitor', 
      logRetention: logs.RetentionDays.ONE_DAY, // <- CDK will manage the log group
    });


    //////////// Grant permissions to Resources ////////////

    // Grant permissions for lambdas to S3 and the user table
    bucket.grantReadWrite(PreRegisterCheck);
    bucket.grantReadWrite(ArrivalRekognition);
    this.userTable.grantReadWriteData(PreRegisterCheck);
    this.userTable.grantReadWriteData(ArrivalRekognition);
    const arrivalRole = ArrivalRekognition.role!;
    sendFeedbackLambda.grantInvoke(arrivalRole);
    InvitedVisitorTable.grantReadWriteData(RegisterIndividualVisitor);
    InvitedVisitorTable.grantReadWriteData(RegisterBulkVisitor);
    InvitedVisitorTable.grantReadData(ArrivalRekognition);
    // Grant Lambda permission to publish to SNS
    arrivalTopic.grantPublish(ArrivalRekognition);

    // Give permissions for PreRegisterCheck lambda to use Amazon Rekognition 
    PreRegisterCheck.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'rekognition:IndexFaces',
          'rekognition:SearchFacesByImage',
          'rekognition:DetectFaces',
        ],
        resources: ['*'], 
        
      })
    );

    // Give permissions for ArrivalRekognition lambda to use Amazon Rekognition 
    ArrivalRekognition.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'rekognition:IndexFaces',
          'rekognition:SearchFacesByImage',
          'rekognition:DetectFaces',
        ],
        resources: ['*'], 
        
      })
    );

    ArrivalRekognition.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ["sns:Publish"],
    resources: ["*"],
  })
);

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
const getImageUrlFn = new NodejsFunction(
  this,
  "GeneratePresignedImageUrlHandler",
  {
    runtime: lambda.Runtime.NODEJS_18_X,
    entry: path.join(__dirname, "../lambda/generatePresignedDownloadUrl.ts"),
    handler: "handler",
    environment: {
      BUCKET_NAME: bucket.bucketName,
      USER_TABLE: this.userTable.tableName, 
    },
    timeout: cdk.Duration.seconds(30),
  }
);

// Permissions
bucket.grantRead(getImageUrlFn);                 
this.userTable.grantReadData(getImageUrlFn);    

// API Gateway: w
const getImageUrlResource = visitorResource.addResource("get-image-url");

getImageUrlResource.addCorsPreflight({
  allowOrigins: ["*"],
  allowMethods: ["GET"],
});

getImageUrlResource.addMethod(
  "GET",
  new apigw.LambdaIntegration(getImageUrlFn, { proxy: true }),
  { authorizationType: apigw.AuthorizationType.NONE }
);
    
  }
}
