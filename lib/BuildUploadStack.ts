// BuildUploadStack.ts
import { Stack, StackProps, CfnOutput, Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as path from "path";
import * as iam from 'aws-cdk-lib/aws-iam';

interface BuildUploadStackProps extends StackProps {
  frontendBucketName: string;
}

export class BuildUploadStack extends Stack {
  constructor(scope: Construct, id: string, props: BuildUploadStackProps) {
    super(scope, id, props);

    // Reference existing bucket
    const frontendBucket = s3.Bucket.fromBucketName(
      this,
      "ExistingFrontendBucket",
      props.frontendBucketName
    );

    // Lambda only generates presigned URLs
    const presignedUrlHandler = new NodejsFunction(
      this,
      "PresignedUrlHandler",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "handler",
        entry: path.join(__dirname, "..", "lambda", "uploadBuildHandler.ts"),
        timeout: Duration.seconds(10),
        memorySize: 256,
        environment: {
          BUCKET_NAME: frontendBucket.bucketName,
          UPLOAD_DIRECTORY: "unity",
          MAX_FILES: "4",
          URL_EXPIRATION_SECONDS: "3600", // 1 hour
          CLOUDFRONT_DISTRIBUTION_ID: "E10Z2Q2KTJ7IIS",
        },
      }
    );

    // Lambda only needs permission to *create* presigned URLs
    frontendBucket.grantPut(presignedUrlHandler);

    presignedUrlHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["cloudfront:CreateInvalidation"],
        resources: ["*"],
      })
    );

    // API Gateway
    const api = new apigateway.RestApi(this, "FileUploadApi", {
      restApiName: "File Upload Service",
      description: "API for generating presigned URLs",
      deployOptions: {
        stageName: "prod",
        throttlingRateLimit: 100,
        throttlingBurstLimit: 200,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          "Content-Type",
          "X-Amz-Date",
          "Authorization",
          "X-Api-Key",
          "X-Amz-Security-Token",
        ],
      },
    });

    const uploadResource = api.root.addResource("generate-upload-urls");

    uploadResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(presignedUrlHandler)
    );

    // Outputs
    new CfnOutput(this, "GenerateUrlsEndpoint", {
      value: `${api.url}generate-upload-urls`,
    });

    new CfnOutput(this, "TargetBucketName", {
      value: frontendBucket.bucketName,
    });
  }
}
