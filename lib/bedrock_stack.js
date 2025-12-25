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
exports.BedrockStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const bedrock = __importStar(require("aws-cdk-lib/aws-bedrock"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
class BedrockStack extends cdk.Stack {
    knowledgeBase;
    lambdaFunction;
    constructor(scope, id, props) {
        super(scope, id, props);
        const { collection, bedrockRole, dataBucket } = props.openSearchStack;
        const { vectorIndex } = props.indexStack;
        const { chatbotTable } = props.dbStack;
        // Knowledge Base
        this.knowledgeBase = new bedrock.CfnKnowledgeBase(this, "KnowledgeBase", {
            name: "unity-knowledge-base",
            roleArn: bedrockRole.roleArn,
            knowledgeBaseConfiguration: {
                type: "VECTOR",
                vectorKnowledgeBaseConfiguration: {
                    embeddingModelArn: "arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0",
                },
            },
            storageConfiguration: {
                type: "OPENSEARCH_SERVERLESS",
                opensearchServerlessConfiguration: {
                    collectionArn: collection.attrArn,
                    fieldMapping: {
                        metadataField: "AMAZON_BEDROCK_METADATA",
                        textField: "AMAZON_BEDROCK_TEXT_CHUNK",
                        vectorField: "bedrock-knowledge-base-vector",
                    },
                    vectorIndexName: "unity-vector-index",
                },
            },
        });
        this.knowledgeBase.node.addDependency(vectorIndex);
        // Data Source
        const dataSource = new bedrock.CfnDataSource(this, "DataSource", {
            name: "unity-s3-data-source",
            knowledgeBaseId: this.knowledgeBase.attrKnowledgeBaseId,
            dataSourceConfiguration: {
                type: "S3",
                s3Configuration: {
                    bucketArn: dataBucket.bucketArn,
                },
            },
        });
        // Lambda function to interact with knowledge base
        this.lambdaFunction = new lambda.Function(this, "KnowledgeBaseFunction", {
            runtime: lambda.Runtime.NODEJS_20_X,
            timeout: cdk.Duration.seconds(60),
            handler: "virtualAssistant.handler",
            code: lambda.Code.fromAsset("lambda"),
            environment: {
                KNOWLEDGE_BASE_ID: this.knowledgeBase.attrKnowledgeBaseId,
                TABLE_NAME: chatbotTable.tableName,
            },
        });
        // Lambda permissions
        this.lambdaFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: [
                "bedrock:InvokeModel",
                "bedrock:Retrieve",
                "bedrock:RetrieveAndGenerate",
            ],
            resources: ["*"],
        }));
        chatbotTable.grantReadWriteData(this.lambdaFunction);
        chatbotTable.grantReadWriteData(this.lambdaFunction);
        // Outputs
        new cdk.CfnOutput(this, "KnowledgeBaseId", {
            value: this.knowledgeBase.attrKnowledgeBaseId,
            exportName: "UnityKnowledgeBaseId",
        });
        new cdk.CfnOutput(this, "DataBucketName", {
            value: dataBucket.bucketName,
            exportName: "UnityDataBucketName",
        });
    }
}
exports.BedrockStack = BedrockStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmVkcm9ja19zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImJlZHJvY2tfc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFFbkMsaUVBQW1EO0FBQ25ELCtEQUFpRDtBQUNqRCx5REFBMkM7QUFXM0MsTUFBYSxZQUFhLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDekIsYUFBYSxDQUEyQjtJQUN4QyxjQUFjLENBQWtCO0lBRWhELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBd0I7UUFDaEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxFQUFFLFVBQVUsRUFBRSxXQUFXLEVBQUUsVUFBVSxFQUFFLEdBQUcsS0FBSyxDQUFDLGVBQWUsQ0FBQztRQUN0RSxNQUFNLEVBQUUsV0FBVyxFQUFFLEdBQUcsS0FBSyxDQUFDLFVBQVUsQ0FBQztRQUN6QyxNQUFNLEVBQUUsWUFBWSxFQUFFLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQztRQUV2QyxpQkFBaUI7UUFDakIsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQ3ZFLElBQUksRUFBRSxzQkFBc0I7WUFDNUIsT0FBTyxFQUFFLFdBQVcsQ0FBQyxPQUFPO1lBQzVCLDBCQUEwQixFQUFFO2dCQUMxQixJQUFJLEVBQUUsUUFBUTtnQkFDZCxnQ0FBZ0MsRUFBRTtvQkFDaEMsaUJBQWlCLEVBQ2YsMEVBQTBFO2lCQUM3RTthQUNGO1lBQ0Qsb0JBQW9CLEVBQUU7Z0JBQ3BCLElBQUksRUFBRSx1QkFBdUI7Z0JBQzdCLGlDQUFpQyxFQUFFO29CQUNqQyxhQUFhLEVBQUUsVUFBVSxDQUFDLE9BQU87b0JBQ2pDLFlBQVksRUFBRTt3QkFDWixhQUFhLEVBQUUseUJBQXlCO3dCQUN4QyxTQUFTLEVBQUUsMkJBQTJCO3dCQUN0QyxXQUFXLEVBQUUsK0JBQStCO3FCQUM3QztvQkFDRCxlQUFlLEVBQUUsb0JBQW9CO2lCQUN0QzthQUNGO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBRW5ELGNBQWM7UUFDZCxNQUFNLFVBQVUsR0FBRyxJQUFJLE9BQU8sQ0FBQyxhQUFhLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUMvRCxJQUFJLEVBQUUsc0JBQXNCO1lBQzVCLGVBQWUsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLG1CQUFtQjtZQUN2RCx1QkFBdUIsRUFBRTtnQkFDdkIsSUFBSSxFQUFFLElBQUk7Z0JBQ1YsZUFBZSxFQUFFO29CQUNmLFNBQVMsRUFBRSxVQUFVLENBQUMsU0FBUztpQkFDaEM7YUFDRjtTQUNGLENBQUMsQ0FBQztRQUVILGtEQUFrRDtRQUNsRCxJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsdUJBQXVCLEVBQUU7WUFDdkUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNuQyxPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ2pDLE9BQU8sRUFBRSwwQkFBMEI7WUFDbkMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQztZQUNyQyxXQUFXLEVBQUU7Z0JBQ1gsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxtQkFBbUI7Z0JBQ3pELFVBQVUsRUFBRSxZQUFZLENBQUMsU0FBUzthQUNuQztTQUNGLENBQUMsQ0FBQztRQUVILHFCQUFxQjtRQUNyQixJQUFJLENBQUMsY0FBYyxDQUFDLGVBQWUsQ0FDakMsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO1lBQ3RCLE9BQU8sRUFBRTtnQkFDUCxxQkFBcUI7Z0JBQ3JCLGtCQUFrQjtnQkFDbEIsNkJBQTZCO2FBQzlCO1lBQ0QsU0FBUyxFQUFFLENBQUMsR0FBRyxDQUFDO1NBQ2pCLENBQUMsQ0FDSCxDQUFDO1FBQ0YsWUFBWSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUVyRCxZQUFZLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBRXJELFVBQVU7UUFDVixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFO1lBQ3pDLEtBQUssRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLG1CQUFtQjtZQUM3QyxVQUFVLEVBQUUsc0JBQXNCO1NBQ25DLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLEVBQUU7WUFDeEMsS0FBSyxFQUFFLFVBQVUsQ0FBQyxVQUFVO1lBQzVCLFVBQVUsRUFBRSxxQkFBcUI7U0FDbEMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBeEZELG9DQXdGQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tIFwiYXdzLWNkay1saWJcIjtcclxuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSBcImNvbnN0cnVjdHNcIjtcclxuaW1wb3J0ICogYXMgYmVkcm9jayBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWJlZHJvY2tcIjtcclxuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtbGFtYmRhXCI7XHJcbmltcG9ydCAqIGFzIGlhbSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWlhbVwiO1xyXG5pbXBvcnQgeyBPcGVuU2VhcmNoU3RhY2sgfSBmcm9tIFwiLi9vcGVuc2VhcmNoX3N0YWNrXCI7XHJcbmltcG9ydCB7IEluZGV4U3RhY2sgfSBmcm9tIFwiLi9pbmRleF9zdGFja1wiO1xyXG5pbXBvcnQgeyBEQlN0YWNrIH0gZnJvbSBcIi4vREJzdGFja1wiO1xyXG5cclxuaW50ZXJmYWNlIEJlZHJvY2tTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xyXG4gIG9wZW5TZWFyY2hTdGFjazogT3BlblNlYXJjaFN0YWNrO1xyXG4gIGluZGV4U3RhY2s6IEluZGV4U3RhY2s7XHJcbiAgZGJTdGFjazogREJTdGFjaztcclxufVxyXG5cclxuZXhwb3J0IGNsYXNzIEJlZHJvY2tTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XHJcbiAgcHVibGljIHJlYWRvbmx5IGtub3dsZWRnZUJhc2U6IGJlZHJvY2suQ2ZuS25vd2xlZGdlQmFzZTtcclxuICBwdWJsaWMgcmVhZG9ubHkgbGFtYmRhRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcclxuXHJcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEJlZHJvY2tTdGFja1Byb3BzKSB7XHJcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcclxuXHJcbiAgICBjb25zdCB7IGNvbGxlY3Rpb24sIGJlZHJvY2tSb2xlLCBkYXRhQnVja2V0IH0gPSBwcm9wcy5vcGVuU2VhcmNoU3RhY2s7XHJcbiAgICBjb25zdCB7IHZlY3RvckluZGV4IH0gPSBwcm9wcy5pbmRleFN0YWNrO1xyXG4gICAgY29uc3QgeyBjaGF0Ym90VGFibGUgfSA9IHByb3BzLmRiU3RhY2s7XHJcblxyXG4gICAgLy8gS25vd2xlZGdlIEJhc2VcclxuICAgIHRoaXMua25vd2xlZGdlQmFzZSA9IG5ldyBiZWRyb2NrLkNmbktub3dsZWRnZUJhc2UodGhpcywgXCJLbm93bGVkZ2VCYXNlXCIsIHtcclxuICAgICAgbmFtZTogXCJ1bml0eS1rbm93bGVkZ2UtYmFzZVwiLFxyXG4gICAgICByb2xlQXJuOiBiZWRyb2NrUm9sZS5yb2xlQXJuLFxyXG4gICAgICBrbm93bGVkZ2VCYXNlQ29uZmlndXJhdGlvbjoge1xyXG4gICAgICAgIHR5cGU6IFwiVkVDVE9SXCIsXHJcbiAgICAgICAgdmVjdG9yS25vd2xlZGdlQmFzZUNvbmZpZ3VyYXRpb246IHtcclxuICAgICAgICAgIGVtYmVkZGluZ01vZGVsQXJuOlxyXG4gICAgICAgICAgICBcImFybjphd3M6YmVkcm9jazp1cy1lYXN0LTE6OmZvdW5kYXRpb24tbW9kZWwvYW1hem9uLnRpdGFuLWVtYmVkLXRleHQtdjI6MFwiLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICAgIHN0b3JhZ2VDb25maWd1cmF0aW9uOiB7XHJcbiAgICAgICAgdHlwZTogXCJPUEVOU0VBUkNIX1NFUlZFUkxFU1NcIixcclxuICAgICAgICBvcGVuc2VhcmNoU2VydmVybGVzc0NvbmZpZ3VyYXRpb246IHtcclxuICAgICAgICAgIGNvbGxlY3Rpb25Bcm46IGNvbGxlY3Rpb24uYXR0ckFybixcclxuICAgICAgICAgIGZpZWxkTWFwcGluZzoge1xyXG4gICAgICAgICAgICBtZXRhZGF0YUZpZWxkOiBcIkFNQVpPTl9CRURST0NLX01FVEFEQVRBXCIsXHJcbiAgICAgICAgICAgIHRleHRGaWVsZDogXCJBTUFaT05fQkVEUk9DS19URVhUX0NIVU5LXCIsXHJcbiAgICAgICAgICAgIHZlY3RvckZpZWxkOiBcImJlZHJvY2sta25vd2xlZGdlLWJhc2UtdmVjdG9yXCIsXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgdmVjdG9ySW5kZXhOYW1lOiBcInVuaXR5LXZlY3Rvci1pbmRleFwiLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLmtub3dsZWRnZUJhc2Uubm9kZS5hZGREZXBlbmRlbmN5KHZlY3RvckluZGV4KTtcclxuXHJcbiAgICAvLyBEYXRhIFNvdXJjZVxyXG4gICAgY29uc3QgZGF0YVNvdXJjZSA9IG5ldyBiZWRyb2NrLkNmbkRhdGFTb3VyY2UodGhpcywgXCJEYXRhU291cmNlXCIsIHtcclxuICAgICAgbmFtZTogXCJ1bml0eS1zMy1kYXRhLXNvdXJjZVwiLFxyXG4gICAgICBrbm93bGVkZ2VCYXNlSWQ6IHRoaXMua25vd2xlZGdlQmFzZS5hdHRyS25vd2xlZGdlQmFzZUlkLFxyXG4gICAgICBkYXRhU291cmNlQ29uZmlndXJhdGlvbjoge1xyXG4gICAgICAgIHR5cGU6IFwiUzNcIixcclxuICAgICAgICBzM0NvbmZpZ3VyYXRpb246IHtcclxuICAgICAgICAgIGJ1Y2tldEFybjogZGF0YUJ1Y2tldC5idWNrZXRBcm4sXHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIExhbWJkYSBmdW5jdGlvbiB0byBpbnRlcmFjdCB3aXRoIGtub3dsZWRnZSBiYXNlXHJcbiAgICB0aGlzLmxhbWJkYUZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCBcIktub3dsZWRnZUJhc2VGdW5jdGlvblwiLCB7XHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxyXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyg2MCksXHJcbiAgICAgIGhhbmRsZXI6IFwidmlydHVhbEFzc2lzdGFudC5oYW5kbGVyXCIsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcImxhbWJkYVwiKSxcclxuICAgICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgICBLTk9XTEVER0VfQkFTRV9JRDogdGhpcy5rbm93bGVkZ2VCYXNlLmF0dHJLbm93bGVkZ2VCYXNlSWQsXHJcbiAgICAgICAgVEFCTEVfTkFNRTogY2hhdGJvdFRhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIExhbWJkYSBwZXJtaXNzaW9uc1xyXG4gICAgdGhpcy5sYW1iZGFGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koXHJcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgICBhY3Rpb25zOiBbXHJcbiAgICAgICAgICBcImJlZHJvY2s6SW52b2tlTW9kZWxcIixcclxuICAgICAgICAgIFwiYmVkcm9jazpSZXRyaWV2ZVwiLFxyXG4gICAgICAgICAgXCJiZWRyb2NrOlJldHJpZXZlQW5kR2VuZXJhdGVcIixcclxuICAgICAgICBdLFxyXG4gICAgICAgIHJlc291cmNlczogW1wiKlwiXSxcclxuICAgICAgfSlcclxuICAgICk7XHJcbiAgICBjaGF0Ym90VGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHRoaXMubGFtYmRhRnVuY3Rpb24pO1xyXG5cclxuICAgIGNoYXRib3RUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEodGhpcy5sYW1iZGFGdW5jdGlvbik7XHJcblxyXG4gICAgLy8gT3V0cHV0c1xyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJLbm93bGVkZ2VCYXNlSWRcIiwge1xyXG4gICAgICB2YWx1ZTogdGhpcy5rbm93bGVkZ2VCYXNlLmF0dHJLbm93bGVkZ2VCYXNlSWQsXHJcbiAgICAgIGV4cG9ydE5hbWU6IFwiVW5pdHlLbm93bGVkZ2VCYXNlSWRcIixcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiRGF0YUJ1Y2tldE5hbWVcIiwge1xyXG4gICAgICB2YWx1ZTogZGF0YUJ1Y2tldC5idWNrZXROYW1lLFxyXG4gICAgICBleHBvcnROYW1lOiBcIlVuaXR5RGF0YUJ1Y2tldE5hbWVcIixcclxuICAgIH0pO1xyXG4gIH1cclxufVxyXG4iXX0=