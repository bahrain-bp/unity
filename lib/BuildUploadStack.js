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
exports.BuildUploadStack = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const aws_lambda_nodejs_1 = require("aws-cdk-lib/aws-lambda-nodejs");
const path = __importStar(require("path"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
class BuildUploadStack extends aws_cdk_lib_1.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const prefixname = this.stackName.split('-')[0].toLowerCase(); // ✅ Add this
        const frontendBucket = s3.Bucket.fromBucketName(this, "ExistingFrontendBucket", props.frontendBucketName);
        const presignedUrlHandler = new aws_lambda_nodejs_1.NodejsFunction(this, "PresignedUrlHandler", {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: "handler",
            entry: path.join(__dirname, "..", "lambda", "uploadBuildHandler.ts"),
            timeout: aws_cdk_lib_1.Duration.seconds(10),
            memorySize: 256,
            environment: {
                BUCKET_NAME: frontendBucket.bucketName,
                UPLOAD_DIRECTORY: "unity",
                MAX_FILES: "4",
                URL_EXPIRATION_SECONDS: "3600", // 1 hour
                //CLOUDFRONT_DISTRIBUTION_ID: "E8RMBHHUMVCJZ",
                CLOUDFRONT_DISTRIBUTION_ID: props.cloudfrontDistributionId,
            },
        });
        frontendBucket.grantPut(presignedUrlHandler);
        presignedUrlHandler.addToRolePolicy(new iam.PolicyStatement({
            actions: ["cloudfront:CreateInvalidation"],
            resources: ["*"],
        }));
        // API Gateway
        const api = new apigateway.RestApi(this, "FileUploadApi", {
            restApiName: `${prefixname}-File Upload Service`,
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
        uploadResource.addMethod("POST", new apigateway.LambdaIntegration(presignedUrlHandler));
        // Outputs
        new aws_cdk_lib_1.CfnOutput(this, "GenerateUrlsEndpoint", {
            value: `${api.url}generate-upload-urls`,
        });
        new aws_cdk_lib_1.CfnOutput(this, "TargetBucketName", {
            value: frontendBucket.bucketName,
        });
    }
}
exports.BuildUploadStack = BuildUploadStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQnVpbGRVcGxvYWRTdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIkJ1aWxkVXBsb2FkU3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSw2Q0FBcUU7QUFFckUsdURBQXlDO0FBQ3pDLCtEQUFpRDtBQUNqRCx1RUFBeUQ7QUFDekQscUVBQStEO0FBQy9ELDJDQUE2QjtBQUM3Qix5REFBMkM7QUFPM0MsTUFBYSxnQkFBaUIsU0FBUSxtQkFBSztJQUN6QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQTRCO1FBQ3BFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUUsYUFBYTtRQUU3RSxNQUFNLGNBQWMsR0FBRyxFQUFFLENBQUMsTUFBTSxDQUFDLGNBQWMsQ0FDN0MsSUFBSSxFQUNKLHdCQUF3QixFQUN4QixLQUFLLENBQUMsa0JBQWtCLENBQ3pCLENBQUM7UUFFRixNQUFNLG1CQUFtQixHQUFHLElBQUksa0NBQWMsQ0FDNUMsSUFBSSxFQUNKLHFCQUFxQixFQUNyQjtZQUNFLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsT0FBTyxFQUFFLFNBQVM7WUFDbEIsS0FBSyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsdUJBQXVCLENBQUM7WUFDcEUsT0FBTyxFQUFFLHNCQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUM3QixVQUFVLEVBQUUsR0FBRztZQUNmLFdBQVcsRUFBRTtnQkFDWCxXQUFXLEVBQUUsY0FBYyxDQUFDLFVBQVU7Z0JBQ3RDLGdCQUFnQixFQUFFLE9BQU87Z0JBQ3pCLFNBQVMsRUFBRSxHQUFHO2dCQUNkLHNCQUFzQixFQUFFLE1BQU0sRUFBRSxTQUFTO2dCQUN6Qyw4Q0FBOEM7Z0JBQzlDLDBCQUEwQixFQUFFLEtBQUssQ0FBQyx3QkFBd0I7YUFFM0Q7U0FDRixDQUNGLENBQUM7UUFFRixjQUFjLENBQUMsUUFBUSxDQUFDLG1CQUFtQixDQUFDLENBQUM7UUFFN0MsbUJBQW1CLENBQUMsZUFBZSxDQUNqQyxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7WUFDdEIsT0FBTyxFQUFFLENBQUMsK0JBQStCLENBQUM7WUFDMUMsU0FBUyxFQUFFLENBQUMsR0FBRyxDQUFDO1NBQ2pCLENBQUMsQ0FDSCxDQUFDO1FBRUYsY0FBYztRQUNkLE1BQU0sR0FBRyxHQUFHLElBQUksVUFBVSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQ3hELFdBQVcsRUFBRSxHQUFHLFVBQVUsc0JBQXNCO1lBQ2hELFdBQVcsRUFBRSxtQ0FBbUM7WUFDaEQsYUFBYSxFQUFFO2dCQUNiLFNBQVMsRUFBRSxNQUFNO2dCQUNqQixtQkFBbUIsRUFBRSxHQUFHO2dCQUN4QixvQkFBb0IsRUFBRSxHQUFHO2FBQzFCO1lBQ0QsMkJBQTJCLEVBQUU7Z0JBQzNCLFlBQVksRUFBRSxVQUFVLENBQUMsSUFBSSxDQUFDLFdBQVc7Z0JBQ3pDLFlBQVksRUFBRSxVQUFVLENBQUMsSUFBSSxDQUFDLFdBQVc7Z0JBQ3pDLFlBQVksRUFBRTtvQkFDWixjQUFjO29CQUNkLFlBQVk7b0JBQ1osZUFBZTtvQkFDZixXQUFXO29CQUNYLHNCQUFzQjtpQkFDdkI7YUFDRjtTQUNGLENBQUMsQ0FBQztRQUVILE1BQU0sY0FBYyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLHNCQUFzQixDQUFDLENBQUM7UUFFcEUsY0FBYyxDQUFDLFNBQVMsQ0FDdEIsTUFBTSxFQUNOLElBQUksVUFBVSxDQUFDLGlCQUFpQixDQUFDLG1CQUFtQixDQUFDLENBQ3RELENBQUM7UUFFRixVQUFVO1FBQ1YsSUFBSSx1QkFBUyxDQUFDLElBQUksRUFBRSxzQkFBc0IsRUFBRTtZQUMxQyxLQUFLLEVBQUUsR0FBRyxHQUFHLENBQUMsR0FBRyxzQkFBc0I7U0FDeEMsQ0FBQyxDQUFDO1FBRUgsSUFBSSx1QkFBUyxDQUFDLElBQUksRUFBRSxrQkFBa0IsRUFBRTtZQUN0QyxLQUFLLEVBQUUsY0FBYyxDQUFDLFVBQVU7U0FDakMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBaEZELDRDQWdGQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFN0YWNrLCBTdGFja1Byb3BzLCBDZm5PdXRwdXQsIER1cmF0aW9uIH0gZnJvbSBcImF3cy1jZGstbGliXCI7XHJcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gXCJjb25zdHJ1Y3RzXCI7XHJcbmltcG9ydCAqIGFzIHMzIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtczNcIjtcclxuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtbGFtYmRhXCI7XHJcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSBcImF3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5XCI7XHJcbmltcG9ydCB7IE5vZGVqc0Z1bmN0aW9uIH0gZnJvbSBcImF3cy1jZGstbGliL2F3cy1sYW1iZGEtbm9kZWpzXCI7XHJcbmltcG9ydCAqIGFzIHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xyXG5cclxuaW50ZXJmYWNlIEJ1aWxkVXBsb2FkU3RhY2tQcm9wcyBleHRlbmRzIFN0YWNrUHJvcHMge1xyXG4gIGZyb250ZW5kQnVja2V0TmFtZTogc3RyaW5nO1xyXG4gIGNsb3VkZnJvbnREaXN0cmlidXRpb25JZDogc3RyaW5nO1xyXG59XHJcblxyXG5leHBvcnQgY2xhc3MgQnVpbGRVcGxvYWRTdGFjayBleHRlbmRzIFN0YWNrIHtcclxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogQnVpbGRVcGxvYWRTdGFja1Byb3BzKSB7XHJcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcclxuXHJcbiAgICBjb25zdCBwcmVmaXhuYW1lID0gdGhpcy5zdGFja05hbWUuc3BsaXQoJy0nKVswXS50b0xvd2VyQ2FzZSgpOyAgLy8g4pyFIEFkZCB0aGlzXHJcblxyXG4gICAgY29uc3QgZnJvbnRlbmRCdWNrZXQgPSBzMy5CdWNrZXQuZnJvbUJ1Y2tldE5hbWUoXHJcbiAgICAgIHRoaXMsXHJcbiAgICAgIFwiRXhpc3RpbmdGcm9udGVuZEJ1Y2tldFwiLFxyXG4gICAgICBwcm9wcy5mcm9udGVuZEJ1Y2tldE5hbWVcclxuICAgICk7XHJcblxyXG4gICAgY29uc3QgcHJlc2lnbmVkVXJsSGFuZGxlciA9IG5ldyBOb2RlanNGdW5jdGlvbihcclxuICAgICAgdGhpcyxcclxuICAgICAgXCJQcmVzaWduZWRVcmxIYW5kbGVyXCIsXHJcbiAgICAgIHtcclxuICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcclxuICAgICAgICBoYW5kbGVyOiBcImhhbmRsZXJcIixcclxuICAgICAgICBlbnRyeTogcGF0aC5qb2luKF9fZGlybmFtZSwgXCIuLlwiLCBcImxhbWJkYVwiLCBcInVwbG9hZEJ1aWxkSGFuZGxlci50c1wiKSxcclxuICAgICAgICB0aW1lb3V0OiBEdXJhdGlvbi5zZWNvbmRzKDEwKSxcclxuICAgICAgICBtZW1vcnlTaXplOiAyNTYsXHJcbiAgICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICAgIEJVQ0tFVF9OQU1FOiBmcm9udGVuZEJ1Y2tldC5idWNrZXROYW1lLFxyXG4gICAgICAgICAgVVBMT0FEX0RJUkVDVE9SWTogXCJ1bml0eVwiLFxyXG4gICAgICAgICAgTUFYX0ZJTEVTOiBcIjRcIixcclxuICAgICAgICAgIFVSTF9FWFBJUkFUSU9OX1NFQ09ORFM6IFwiMzYwMFwiLCAvLyAxIGhvdXJcclxuICAgICAgICAgIC8vQ0xPVURGUk9OVF9ESVNUUklCVVRJT05fSUQ6IFwiRThSTUJISFVNVkNKWlwiLFxyXG4gICAgICAgICAgQ0xPVURGUk9OVF9ESVNUUklCVVRJT05fSUQ6IHByb3BzLmNsb3VkZnJvbnREaXN0cmlidXRpb25JZCxcclxuXHJcbiAgICAgICAgfSxcclxuICAgICAgfVxyXG4gICAgKTtcclxuXHJcbiAgICBmcm9udGVuZEJ1Y2tldC5ncmFudFB1dChwcmVzaWduZWRVcmxIYW5kbGVyKTtcclxuXHJcbiAgICBwcmVzaWduZWRVcmxIYW5kbGVyLmFkZFRvUm9sZVBvbGljeShcclxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICAgIGFjdGlvbnM6IFtcImNsb3VkZnJvbnQ6Q3JlYXRlSW52YWxpZGF0aW9uXCJdLFxyXG4gICAgICAgIHJlc291cmNlczogW1wiKlwiXSxcclxuICAgICAgfSlcclxuICAgICk7XHJcblxyXG4gICAgLy8gQVBJIEdhdGV3YXlcclxuICAgIGNvbnN0IGFwaSA9IG5ldyBhcGlnYXRld2F5LlJlc3RBcGkodGhpcywgXCJGaWxlVXBsb2FkQXBpXCIsIHtcclxuICAgICAgcmVzdEFwaU5hbWU6IGAke3ByZWZpeG5hbWV9LUZpbGUgVXBsb2FkIFNlcnZpY2VgLFxyXG4gICAgICBkZXNjcmlwdGlvbjogXCJBUEkgZm9yIGdlbmVyYXRpbmcgcHJlc2lnbmVkIFVSTHNcIixcclxuICAgICAgZGVwbG95T3B0aW9uczoge1xyXG4gICAgICAgIHN0YWdlTmFtZTogXCJwcm9kXCIsXHJcbiAgICAgICAgdGhyb3R0bGluZ1JhdGVMaW1pdDogMTAwLFxyXG4gICAgICAgIHRocm90dGxpbmdCdXJzdExpbWl0OiAyMDAsXHJcbiAgICAgIH0sXHJcbiAgICAgIGRlZmF1bHRDb3JzUHJlZmxpZ2h0T3B0aW9uczoge1xyXG4gICAgICAgIGFsbG93T3JpZ2luczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9PUklHSU5TLFxyXG4gICAgICAgIGFsbG93TWV0aG9kczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9NRVRIT0RTLFxyXG4gICAgICAgIGFsbG93SGVhZGVyczogW1xyXG4gICAgICAgICAgXCJDb250ZW50LVR5cGVcIixcclxuICAgICAgICAgIFwiWC1BbXotRGF0ZVwiLFxyXG4gICAgICAgICAgXCJBdXRob3JpemF0aW9uXCIsXHJcbiAgICAgICAgICBcIlgtQXBpLUtleVwiLFxyXG4gICAgICAgICAgXCJYLUFtei1TZWN1cml0eS1Ub2tlblwiLFxyXG4gICAgICAgIF0sXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCB1cGxvYWRSZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKFwiZ2VuZXJhdGUtdXBsb2FkLXVybHNcIik7XHJcblxyXG4gICAgdXBsb2FkUmVzb3VyY2UuYWRkTWV0aG9kKFxyXG4gICAgICBcIlBPU1RcIixcclxuICAgICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24ocHJlc2lnbmVkVXJsSGFuZGxlcilcclxuICAgICk7XHJcblxyXG4gICAgLy8gT3V0cHV0c1xyXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCBcIkdlbmVyYXRlVXJsc0VuZHBvaW50XCIsIHtcclxuICAgICAgdmFsdWU6IGAke2FwaS51cmx9Z2VuZXJhdGUtdXBsb2FkLXVybHNgLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCBcIlRhcmdldEJ1Y2tldE5hbWVcIiwge1xyXG4gICAgICB2YWx1ZTogZnJvbnRlbmRCdWNrZXQuYnVja2V0TmFtZSxcclxuICAgIH0pO1xyXG4gIH1cclxufVxyXG4iXX0=