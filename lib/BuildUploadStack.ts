import { Stack, StackProps, CfnOutput, Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as path from "path";

interface FileUploadApiStackProps extends StackProps {
  frontendBucketName: string; // Pass the bucket name from the frontend stack
}

export class FileUploadApiStack extends Stack {
  constructor(scope: Construct, id: string, props: FileUploadApiStackProps) {
    super(scope, id, props);

    // Reference the existing frontend bucket by name
    const frontendBucket = s3.Bucket.fromBucketName(
      this,
      'ExistingFrontendBucket',
      props.frontendBucketName
    );

    // Lambda function to generate presigned URLs for file uploads
    const presignedUrlHandler = new NodejsFunction(this, 'PresignedUrlHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, "../lambda/ws-connect.ts"),
      timeout: Duration.seconds(10),
      memorySize: 256,
      environment: {
        BUCKET_NAME: frontendBucket.bucketName,
        UPLOAD_DIRECTORY: 'uploads', // Separate directory for user uploads
        MAX_FILES: '4',
        URL_EXPIRATION_SECONDS: '3600', // 1 hour
      },
    });

    // Grant Lambda permissions to generate presigned URLs for the frontend bucket
    frontendBucket.grantPut(presignedUrlHandler);
    frontendBucket.grantPutAcl(presignedUrlHandler);

    // API Gateway REST API for file uploads
    const api = new apigateway.RestApi(this, 'FileUploadApi', {
      restApiName: 'File Upload Service',
      description: 'API for generating presigned URLs for large file uploads',
      deployOptions: {
        stageName: 'prod',
        throttlingRateLimit: 100,
        throttlingBurstLimit: 200,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS, // Restrict this in production
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
      },
    });

    // Create /generate-upload-urls resource
    const uploadResource = api.root.addResource('generate-upload-urls');

    // Add POST method with Lambda integration
    uploadResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(presignedUrlHandler, {
        proxy: true,
      })
    );

    // Outputs
    new CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
    });

    new CfnOutput(this, 'GenerateUrlsEndpoint', {
      value: `${api.url}generate-upload-urls`,
      description: 'Generate Presigned URLs Endpoint',
    });

    new CfnOutput(this, 'TargetBucketName', {
      value: frontendBucket.bucketName,
      description: 'S3 Bucket Name (Shared with Frontend)',
    });
  }
}