import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { aws_rekognition as rekognition } from 'aws-cdk-lib';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as logs from 'aws-cdk-lib/aws-logs';

export class FacialRecognitionStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    //create S3 Bucked
    const bucket = new s3.Bucket(this, 'BahtwinTestBucket',{
      bucketName: 'bahtwin-testing',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects:true,
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
      },
      timeout:cdk.Duration.seconds(30),
      functionName: 'ArrivalRekognition', 
      logRetention: logs.RetentionDays.ONE_DAY, // <- CDK will manage the log group
    });

    // Permissions
    bucket.grantReadWrite(PreRegisterCheck);
    bucket.grantReadWrite(ArrivalRekognition);

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

// connect POST to Lambda
arrivalResource.addMethod('POST', new apigw.LambdaIntegration(ArrivalRekognition, {
  proxy: true,
}));
// OPTIONS method -> Lambda proxy (handles CORS)
 //   arrivalResource.addMethod('OPTIONS', new apigw.LambdaIntegration(ArrivalRekognition, { proxy: true }));
 // OPTIONS method -> MockIntegration for CORS preflight
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


    
  }
}
