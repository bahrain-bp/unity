"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BedrockStack = void 0;
const cdk = require("aws-cdk-lib");
const bedrock = require("aws-cdk-lib/aws-bedrock");
const lambda = require("aws-cdk-lib/aws-lambda");
const iam = require("aws-cdk-lib/aws-iam");
class BedrockStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const { collection, bedrockRole, dataBucket } = props.openSearchStack;
        const { vectorIndex } = props.indexStack;
        // Knowledge Base
        this.knowledgeBase = new bedrock.CfnKnowledgeBase(this, 'KnowledgeBase', {
            name: 'my-knowledge-base',
            roleArn: bedrockRole.roleArn,
            knowledgeBaseConfiguration: {
                type: 'VECTOR',
                vectorKnowledgeBaseConfiguration: {
                    embeddingModelArn: 'arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0'
                }
            },
            storageConfiguration: {
                type: 'OPENSEARCH_SERVERLESS',
                opensearchServerlessConfiguration: {
                    collectionArn: collection.attrArn,
                    fieldMapping: {
                        metadataField: 'AMAZON_BEDROCK_METADATA',
                        textField: 'AMAZON_BEDROCK_TEXT_CHUNK',
                        vectorField: 'bedrock-knowledge-base-vector'
                    },
                    vectorIndexName: 'bedrock-knowledge-base-index'
                }
            }
        });
        this.knowledgeBase.node.addDependency(vectorIndex);
        // Data Source
        const dataSource = new bedrock.CfnDataSource(this, 'DataSource', {
            name: 's3-data-source',
            knowledgeBaseId: this.knowledgeBase.attrKnowledgeBaseId,
            dataSourceConfiguration: {
                type: 'S3',
                s3Configuration: {
                    bucketArn: dataBucket.bucketArn
                }
            }
        });
        // Lambda function to interact with knowledge base
        this.lambdaFunction = new lambda.Function(this, 'KnowledgeBaseFunction', {
            runtime: lambda.Runtime.NODEJS_20_X,
            timeout: cdk.Duration.seconds(60),
            handler: 'virtualAssistant.handler',
            code: lambda.Code.fromAsset('lambda'),
            environment: {
                KNOWLEDGE_BASE_ID: this.knowledgeBase.attrKnowledgeBaseId
            }
        });
        // Lambda permissions
        this.lambdaFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: [
                'bedrock:InvokeModel',
                'bedrock:Retrieve',
                'bedrock:RetrieveAndGenerate'
            ],
            resources: ['*']
        }));
        // Outputs
        new cdk.CfnOutput(this, 'KnowledgeBaseId', {
            value: this.knowledgeBase.attrKnowledgeBaseId,
            exportName: 'KnowledgeBaseId'
        });
        new cdk.CfnOutput(this, 'DataBucketName', {
            value: dataBucket.bucketName,
            exportName: 'DataBucketName'
        });
    }
}
exports.BedrockStack = BedrockStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmVkcm9ja19zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImJlZHJvY2tfc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBRW5DLG1EQUFtRDtBQUNuRCxpREFBaUQ7QUFDakQsMkNBQTJDO0FBUzNDLE1BQWEsWUFBYSxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBSXpDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBd0I7UUFDaEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxFQUFFLFVBQVUsRUFBRSxXQUFXLEVBQUUsVUFBVSxFQUFFLEdBQUcsS0FBSyxDQUFDLGVBQWUsQ0FBQztRQUN0RSxNQUFNLEVBQUUsV0FBVyxFQUFFLEdBQUcsS0FBSyxDQUFDLFVBQVUsQ0FBQztRQUV6QyxpQkFBaUI7UUFDakIsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQ3ZFLElBQUksRUFBRSxtQkFBbUI7WUFDekIsT0FBTyxFQUFFLFdBQVcsQ0FBQyxPQUFPO1lBQzVCLDBCQUEwQixFQUFFO2dCQUMxQixJQUFJLEVBQUUsUUFBUTtnQkFDZCxnQ0FBZ0MsRUFBRTtvQkFDaEMsaUJBQWlCLEVBQUUsMEVBQTBFO2lCQUM5RjthQUNGO1lBQ0Qsb0JBQW9CLEVBQUU7Z0JBQ3BCLElBQUksRUFBRSx1QkFBdUI7Z0JBQzdCLGlDQUFpQyxFQUFFO29CQUNqQyxhQUFhLEVBQUUsVUFBVSxDQUFDLE9BQU87b0JBQ2pDLFlBQVksRUFBRTt3QkFDWixhQUFhLEVBQUUseUJBQXlCO3dCQUN4QyxTQUFTLEVBQUUsMkJBQTJCO3dCQUN0QyxXQUFXLEVBQUUsK0JBQStCO3FCQUM3QztvQkFDRCxlQUFlLEVBQUUsOEJBQThCO2lCQUNoRDthQUNGO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBRW5ELGNBQWM7UUFDZCxNQUFNLFVBQVUsR0FBRyxJQUFJLE9BQU8sQ0FBQyxhQUFhLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUMvRCxJQUFJLEVBQUUsZ0JBQWdCO1lBQ3RCLGVBQWUsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLG1CQUFtQjtZQUN2RCx1QkFBdUIsRUFBRTtnQkFDdkIsSUFBSSxFQUFFLElBQUk7Z0JBQ1YsZUFBZSxFQUFFO29CQUNmLFNBQVMsRUFBRSxVQUFVLENBQUMsU0FBUztpQkFDaEM7YUFDRjtTQUNGLENBQUMsQ0FBQztRQUVILGtEQUFrRDtRQUNsRCxJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsdUJBQXVCLEVBQUU7WUFDdkUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNuQyxPQUFPLEVBQUcsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ2xDLE9BQU8sRUFBRSwwQkFBMEI7WUFDbkMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQztZQUNyQyxXQUFXLEVBQUU7Z0JBQ1gsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxtQkFBbUI7YUFDMUQ7U0FDRixDQUFDLENBQUM7UUFFSCxxQkFBcUI7UUFDckIsSUFBSSxDQUFDLGNBQWMsQ0FBQyxlQUFlLENBQUMsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO1lBQzFELE9BQU8sRUFBRTtnQkFDUCxxQkFBcUI7Z0JBQ3JCLGtCQUFrQjtnQkFDbEIsNkJBQTZCO2FBQzlCO1lBQ0QsU0FBUyxFQUFFLENBQUMsR0FBRyxDQUFDO1NBQ2pCLENBQUMsQ0FBQyxDQUFDO1FBRUosVUFBVTtRQUNWLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLEVBQUU7WUFDekMsS0FBSyxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsbUJBQW1CO1lBQzdDLFVBQVUsRUFBRSxpQkFBaUI7U0FDOUIsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxnQkFBZ0IsRUFBRTtZQUN4QyxLQUFLLEVBQUUsVUFBVSxDQUFDLFVBQVU7WUFDNUIsVUFBVSxFQUFFLGdCQUFnQjtTQUM3QixDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUFoRkQsb0NBZ0ZDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcclxuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XHJcbmltcG9ydCAqIGFzIGJlZHJvY2sgZnJvbSAnYXdzLWNkay1saWIvYXdzLWJlZHJvY2snO1xyXG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XHJcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcclxuaW1wb3J0IHsgT3BlblNlYXJjaFN0YWNrIH0gZnJvbSAnLi9vcGVuc2VhcmNoX3N0YWNrJztcclxuaW1wb3J0IHsgSW5kZXhTdGFjayB9IGZyb20gJy4vaW5kZXhfc3RhY2snO1xyXG5cclxuaW50ZXJmYWNlIEJlZHJvY2tTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xyXG4gIG9wZW5TZWFyY2hTdGFjazogT3BlblNlYXJjaFN0YWNrO1xyXG4gIGluZGV4U3RhY2s6IEluZGV4U3RhY2s7XHJcbn1cclxuXHJcbmV4cG9ydCBjbGFzcyBCZWRyb2NrU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xyXG4gIHB1YmxpYyByZWFkb25seSBrbm93bGVkZ2VCYXNlOiBiZWRyb2NrLkNmbktub3dsZWRnZUJhc2U7XHJcbiAgcHVibGljIHJlYWRvbmx5IGxhbWJkYUZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XHJcblxyXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBCZWRyb2NrU3RhY2tQcm9wcykge1xyXG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XHJcblxyXG4gICAgY29uc3QgeyBjb2xsZWN0aW9uLCBiZWRyb2NrUm9sZSwgZGF0YUJ1Y2tldCB9ID0gcHJvcHMub3BlblNlYXJjaFN0YWNrO1xyXG4gICAgY29uc3QgeyB2ZWN0b3JJbmRleCB9ID0gcHJvcHMuaW5kZXhTdGFjaztcclxuXHJcbiAgICAvLyBLbm93bGVkZ2UgQmFzZVxyXG4gICAgdGhpcy5rbm93bGVkZ2VCYXNlID0gbmV3IGJlZHJvY2suQ2ZuS25vd2xlZGdlQmFzZSh0aGlzLCAnS25vd2xlZGdlQmFzZScsIHtcclxuICAgICAgbmFtZTogJ215LWtub3dsZWRnZS1iYXNlJyxcclxuICAgICAgcm9sZUFybjogYmVkcm9ja1JvbGUucm9sZUFybixcclxuICAgICAga25vd2xlZGdlQmFzZUNvbmZpZ3VyYXRpb246IHtcclxuICAgICAgICB0eXBlOiAnVkVDVE9SJyxcclxuICAgICAgICB2ZWN0b3JLbm93bGVkZ2VCYXNlQ29uZmlndXJhdGlvbjoge1xyXG4gICAgICAgICAgZW1iZWRkaW5nTW9kZWxBcm46ICdhcm46YXdzOmJlZHJvY2s6dXMtZWFzdC0xOjpmb3VuZGF0aW9uLW1vZGVsL2FtYXpvbi50aXRhbi1lbWJlZC10ZXh0LXYyOjAnXHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG4gICAgICBzdG9yYWdlQ29uZmlndXJhdGlvbjoge1xyXG4gICAgICAgIHR5cGU6ICdPUEVOU0VBUkNIX1NFUlZFUkxFU1MnLFxyXG4gICAgICAgIG9wZW5zZWFyY2hTZXJ2ZXJsZXNzQ29uZmlndXJhdGlvbjoge1xyXG4gICAgICAgICAgY29sbGVjdGlvbkFybjogY29sbGVjdGlvbi5hdHRyQXJuLFxyXG4gICAgICAgICAgZmllbGRNYXBwaW5nOiB7XHJcbiAgICAgICAgICAgIG1ldGFkYXRhRmllbGQ6ICdBTUFaT05fQkVEUk9DS19NRVRBREFUQScsXHJcbiAgICAgICAgICAgIHRleHRGaWVsZDogJ0FNQVpPTl9CRURST0NLX1RFWFRfQ0hVTksnLFxyXG4gICAgICAgICAgICB2ZWN0b3JGaWVsZDogJ2JlZHJvY2sta25vd2xlZGdlLWJhc2UtdmVjdG9yJ1xyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIHZlY3RvckluZGV4TmFtZTogJ2JlZHJvY2sta25vd2xlZGdlLWJhc2UtaW5kZXgnXHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLmtub3dsZWRnZUJhc2Uubm9kZS5hZGREZXBlbmRlbmN5KHZlY3RvckluZGV4KTtcclxuXHJcbiAgICAvLyBEYXRhIFNvdXJjZVxyXG4gICAgY29uc3QgZGF0YVNvdXJjZSA9IG5ldyBiZWRyb2NrLkNmbkRhdGFTb3VyY2UodGhpcywgJ0RhdGFTb3VyY2UnLCB7XHJcbiAgICAgIG5hbWU6ICdzMy1kYXRhLXNvdXJjZScsXHJcbiAgICAgIGtub3dsZWRnZUJhc2VJZDogdGhpcy5rbm93bGVkZ2VCYXNlLmF0dHJLbm93bGVkZ2VCYXNlSWQsXHJcbiAgICAgIGRhdGFTb3VyY2VDb25maWd1cmF0aW9uOiB7XHJcbiAgICAgICAgdHlwZTogJ1MzJyxcclxuICAgICAgICBzM0NvbmZpZ3VyYXRpb246IHtcclxuICAgICAgICAgIGJ1Y2tldEFybjogZGF0YUJ1Y2tldC5idWNrZXRBcm5cclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIC8vIExhbWJkYSBmdW5jdGlvbiB0byBpbnRlcmFjdCB3aXRoIGtub3dsZWRnZSBiYXNlXHJcbiAgICB0aGlzLmxhbWJkYUZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnS25vd2xlZGdlQmFzZUZ1bmN0aW9uJywge1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcclxuICAgICAgdGltZW91dCA6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDYwKSxcclxuICAgICAgaGFuZGxlcjogJ3ZpcnR1YWxBc3Npc3RhbnQuaGFuZGxlcicsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhJyksXHJcbiAgICAgIGVudmlyb25tZW50OiB7XHJcbiAgICAgICAgS05PV0xFREdFX0JBU0VfSUQ6IHRoaXMua25vd2xlZGdlQmFzZS5hdHRyS25vd2xlZGdlQmFzZUlkXHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIC8vIExhbWJkYSBwZXJtaXNzaW9uc1xyXG4gICAgdGhpcy5sYW1iZGFGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICBhY3Rpb25zOiBbXHJcbiAgICAgICAgJ2JlZHJvY2s6SW52b2tlTW9kZWwnLFxyXG4gICAgICAgICdiZWRyb2NrOlJldHJpZXZlJyxcclxuICAgICAgICAnYmVkcm9jazpSZXRyaWV2ZUFuZEdlbmVyYXRlJ1xyXG4gICAgICBdLFxyXG4gICAgICByZXNvdXJjZXM6IFsnKiddXHJcbiAgICB9KSk7XHJcblxyXG4gICAgLy8gT3V0cHV0c1xyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0tub3dsZWRnZUJhc2VJZCcsIHtcclxuICAgICAgdmFsdWU6IHRoaXMua25vd2xlZGdlQmFzZS5hdHRyS25vd2xlZGdlQmFzZUlkLFxyXG4gICAgICBleHBvcnROYW1lOiAnS25vd2xlZGdlQmFzZUlkJ1xyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0RhdGFCdWNrZXROYW1lJywge1xyXG4gICAgICB2YWx1ZTogZGF0YUJ1Y2tldC5idWNrZXROYW1lLFxyXG4gICAgICBleHBvcnROYW1lOiAnRGF0YUJ1Y2tldE5hbWUnXHJcbiAgICB9KTtcclxuICB9XHJcbn1cclxuIl19