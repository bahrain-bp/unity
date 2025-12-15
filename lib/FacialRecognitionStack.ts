import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { aws_rekognition as rekognition } from 'aws-cdk-lib';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as path from 'path';
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";

export class FacialRecognitionStack extends cdk.Stack {
  public readonly userTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);


        // Users Table
    
        this.userTable = new dynamodb.Table(this, 'userTable', {
          tableName: 'UserManagementTable',
          partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
          billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // serverless
          removalPolicy: cdk.RemovalPolicy.DESTROY, // only for dev/testing
        });

        this.userTable.addGlobalSecondaryIndex({
      indexName: 'EmailIndex',
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

        // Add GSI for faceId
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


    //create S3 Bucked
   const bucket = new s3.Bucket(this, 'BahtwinTestBucket',{
  removalPolicy: cdk.RemovalPolicy.DESTROY,
  autoDeleteObjects: true,
});


    // Create an Amazon Rekognition Collection
    const collection= new rekognition.CfnCollection(this, 'bahtwin-testing-collection', {
      collectionId: 'bahtwin-testing-collection', 
    });

 
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

        //create lambda for to extract user photo
    const ExtractPhoto = new lambda.Function(this, 'ExtractPhoto',{
      runtime: lambda.Runtime.PYTHON_3_11,
      handler:'ExtractPhoto.handler',
      code: lambda.Code.fromAsset('lambda'),
      environment:{
        BUCKET_NAME: bucket.bucketName,
        USER_TABLE: this.userTable.tableName,
      },
      timeout:cdk.Duration.seconds(30),
      functionName: 'ExtractPhoto', 
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
      },
      timeout:cdk.Duration.seconds(30),
      functionName: 'ArrivalRekognition', 
      logRetention: logs.RetentionDays.ONE_DAY, // <- CDK will manage the log group
    });

        //create lambda to send feedback
// const sendFeedbackLambda = new lambda.Function(this, 'SendFeedbackLambda', {
//   runtime: lambda.Runtime.PYTHON_3_11,
//   handler: 'sendFeedbackLambda.handler',
//   code: lambda.Code.fromAsset(path.join(__dirname, '../lambda'), {
//     bundling: {
//       image: lambda.Runtime.PYTHON_3_11.bundlingImage,
//       command: [
//         "bash", "-c",
//         `
//         pip install -r requirements.txt -t /asset-output &&
//         cp -r . /asset-output
//         `
//       ],
//     },
//   }),
//   environment: {
//     JWT_SECRET: 'secret',
//     FRONTEND_URL: 'https://localhost:5173/visitorfeedback',
//     GMAIL_USER: 'nonreplyfeedbackrequest@gmail.com',
//     GMAIL_PASS: 'thun ojje rdpt ocjg',
//   },
//   timeout: cdk.Duration.seconds(30),
//   functionName: 'SendFeedbackLambda',
//   logRetention: logs.RetentionDays.ONE_DAY
// });



    // Permissions
    bucket.grantReadWrite(PreRegisterCheck);
    bucket.grantReadWrite(ArrivalRekognition);
    this.userTable.grantReadWriteData(PreRegisterCheck);
    this.userTable.grantReadWriteData(ArrivalRekognition);
    const arrivalRole = ArrivalRekognition.role!;
    //sendFeedbackLambda.grantInvoke(arrivalRole);
    bucket.grantRead(ExtractPhoto);
    this.userTable.grantReadData(ExtractPhoto);

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

//create extract photo resource under the visitor resource
const extractPhotoResource = visitorResource.addResource('retrivePhoto');
// connect POST to Lambda
arrivalResource.addMethod('POST', new apigw.LambdaIntegration(ArrivalRekognition, {
  proxy: true,
}));

// connect POST to Lambda
registerResource.addMethod('POST', new apigw.LambdaIntegration(PreRegisterCheck, {
  proxy: true,
}));

// connect POST to Lambda
extractPhotoResource.addMethod('POST', new apigw.LambdaIntegration(ExtractPhoto, {
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


    extractPhotoResource.addMethod('OPTIONS', new apigw.MockIntegration({
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

// API Gateway: /visitor/get-image-url
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






// ────────────────────────────────
// GET USER BADGE INFO (Unity)
// ────────────────────────────────
const getUserBadgeInfoFn = new NodejsFunction(
  this,
  "GetUserBadgeInfoHandler",
  {
    runtime: lambda.Runtime.NODEJS_18_X,
    entry: path.join(__dirname, "../lambda/getUserBadgeInfo.ts"),
    handler: "handler",
    environment: {
      USER_TABLE: this.userTable.tableName,
      BUCKET_NAME: bucket.bucketName,
    },
    timeout: cdk.Duration.seconds(30),
  }
);

// Permissions
this.userTable.grantReadWriteData(getUserBadgeInfoFn);
bucket.grantRead(getUserBadgeInfoFn);



const badgeResource = visitorResource.addResource("badge");

badgeResource.addMethod(
  "POST",
  new apigw.LambdaIntegration(getUserBadgeInfoFn),
  { authorizationType: apigw.AuthorizationType.NONE }
);

badgeResource.addCorsPreflight({
  allowOrigins: ["*"],
  allowMethods: ["POST"],
});



  }
}
