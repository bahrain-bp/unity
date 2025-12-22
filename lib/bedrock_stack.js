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
        const { chatbotTable } = props.dbStack; // ✅ Destructure the table
        // Knowledge Base
        this.knowledgeBase = new bedrock.CfnKnowledgeBase(this, 'KnowledgeBase', {
            name: 'unity-knowledge-base',
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
                    vectorIndexName: 'unity-vector-index'
                }
            }
        });
        this.knowledgeBase.node.addDependency(vectorIndex);
        // Data Source
        const dataSource = new bedrock.CfnDataSource(this, 'DataSource', {
            name: 'unity-s3-data-source',
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
                KNOWLEDGE_BASE_ID: this.knowledgeBase.attrKnowledgeBaseId,
                TABLE_NAME: chatbotTable.tableName
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
        chatbotTable.grantReadWriteData(this.lambdaFunction);
        // Outputs
        new cdk.CfnOutput(this, 'KnowledgeBaseId', {
            value: this.knowledgeBase.attrKnowledgeBaseId,
            exportName: 'UnityKnowledgeBaseId'
        });
        new cdk.CfnOutput(this, 'DataBucketName', {
            value: dataBucket.bucketName,
            exportName: 'UnityDataBucketName'
        });
    }
}
exports.BedrockStack = BedrockStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmVkcm9ja19zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImJlZHJvY2tfc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBRW5DLG1EQUFtRDtBQUNuRCxpREFBaUQ7QUFDakQsMkNBQTJDO0FBVTNDLE1BQWEsWUFBYSxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBSXpDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBd0I7UUFDaEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxFQUFFLFVBQVUsRUFBRSxXQUFXLEVBQUUsVUFBVSxFQUFFLEdBQUcsS0FBSyxDQUFDLGVBQWUsQ0FBQztRQUN0RSxNQUFNLEVBQUUsV0FBVyxFQUFFLEdBQUcsS0FBSyxDQUFDLFVBQVUsQ0FBQztRQUN6QyxNQUFNLEVBQUUsWUFBWSxFQUFFLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLDBCQUEwQjtRQUVsRSxpQkFBaUI7UUFDakIsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQ3ZFLElBQUksRUFBRSxzQkFBc0I7WUFDNUIsT0FBTyxFQUFFLFdBQVcsQ0FBQyxPQUFPO1lBQzVCLDBCQUEwQixFQUFFO2dCQUMxQixJQUFJLEVBQUUsUUFBUTtnQkFDZCxnQ0FBZ0MsRUFBRTtvQkFDaEMsaUJBQWlCLEVBQUUsMEVBQTBFO2lCQUM5RjthQUNGO1lBQ0Qsb0JBQW9CLEVBQUU7Z0JBQ3BCLElBQUksRUFBRSx1QkFBdUI7Z0JBQzdCLGlDQUFpQyxFQUFFO29CQUNqQyxhQUFhLEVBQUUsVUFBVSxDQUFDLE9BQU87b0JBQ2pDLFlBQVksRUFBRTt3QkFDWixhQUFhLEVBQUUseUJBQXlCO3dCQUN4QyxTQUFTLEVBQUUsMkJBQTJCO3dCQUN0QyxXQUFXLEVBQUUsK0JBQStCO3FCQUM3QztvQkFDRCxlQUFlLEVBQUUsb0JBQW9CO2lCQUN0QzthQUNGO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBRW5ELGNBQWM7UUFDZCxNQUFNLFVBQVUsR0FBRyxJQUFJLE9BQU8sQ0FBQyxhQUFhLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUMvRCxJQUFJLEVBQUUsc0JBQXNCO1lBQzVCLGVBQWUsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLG1CQUFtQjtZQUN2RCx1QkFBdUIsRUFBRTtnQkFDdkIsSUFBSSxFQUFFLElBQUk7Z0JBQ1YsZUFBZSxFQUFFO29CQUNmLFNBQVMsRUFBRSxVQUFVLENBQUMsU0FBUztpQkFDaEM7YUFDRjtTQUNGLENBQUMsQ0FBQztRQUVILGtEQUFrRDtRQUNsRCxJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsdUJBQXVCLEVBQUU7WUFDdkUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNuQyxPQUFPLEVBQUcsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ2xDLE9BQU8sRUFBRSwwQkFBMEI7WUFDbkMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQztZQUNyQyxXQUFXLEVBQUU7Z0JBQ1gsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxtQkFBbUI7Z0JBQ3pELFVBQVUsRUFBRyxZQUFZLENBQUMsU0FBUzthQUNwQztTQUNGLENBQUMsQ0FBQztRQUVILHFCQUFxQjtRQUNyQixJQUFJLENBQUMsY0FBYyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7WUFDMUQsT0FBTyxFQUFFO2dCQUNQLHFCQUFxQjtnQkFDckIsa0JBQWtCO2dCQUNsQiw2QkFBNkI7YUFDOUI7WUFDRCxTQUFTLEVBQUUsQ0FBQyxHQUFHLENBQUM7U0FDakIsQ0FBQyxDQUFDLENBQUM7UUFFSixZQUFZLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBRXJELFVBQVU7UUFDVixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFO1lBQ3pDLEtBQUssRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLG1CQUFtQjtZQUM3QyxVQUFVLEVBQUUsc0JBQXNCO1NBQ25DLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLEVBQUU7WUFDeEMsS0FBSyxFQUFFLFVBQVUsQ0FBQyxVQUFVO1lBQzVCLFVBQVUsRUFBRSxxQkFBcUI7U0FDbEMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBcEZELG9DQW9GQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XHJcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xyXG5pbXBvcnQgKiBhcyBiZWRyb2NrIGZyb20gJ2F3cy1jZGstbGliL2F3cy1iZWRyb2NrJztcclxuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xyXG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XHJcbmltcG9ydCB7IE9wZW5TZWFyY2hTdGFjayB9IGZyb20gJy4vb3BlbnNlYXJjaF9zdGFjayc7XHJcbmltcG9ydCB7IEluZGV4U3RhY2sgfSBmcm9tICcuL2luZGV4X3N0YWNrJztcclxuaW1wb3J0IHsgREJTdGFjayB9IGZyb20gJy4vREJzdGFjayc7XHJcbmludGVyZmFjZSBCZWRyb2NrU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcclxuICBvcGVuU2VhcmNoU3RhY2s6IE9wZW5TZWFyY2hTdGFjaztcclxuICBpbmRleFN0YWNrOiBJbmRleFN0YWNrO1xyXG4gIGRiU3RhY2sgOiBEQlN0YWNrO1xyXG59XHJcblxyXG5leHBvcnQgY2xhc3MgQmVkcm9ja1N0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcclxuICBwdWJsaWMgcmVhZG9ubHkga25vd2xlZGdlQmFzZTogYmVkcm9jay5DZm5Lbm93bGVkZ2VCYXNlO1xyXG4gIHB1YmxpYyByZWFkb25seSBsYW1iZGFGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xyXG5cclxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogQmVkcm9ja1N0YWNrUHJvcHMpIHtcclxuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xyXG5cclxuICAgIGNvbnN0IHsgY29sbGVjdGlvbiwgYmVkcm9ja1JvbGUsIGRhdGFCdWNrZXQgfSA9IHByb3BzLm9wZW5TZWFyY2hTdGFjaztcclxuICAgIGNvbnN0IHsgdmVjdG9ySW5kZXggfSA9IHByb3BzLmluZGV4U3RhY2s7XHJcbiAgICBjb25zdCB7IGNoYXRib3RUYWJsZSB9ID0gcHJvcHMuZGJTdGFjazsgLy8g4pyFIERlc3RydWN0dXJlIHRoZSB0YWJsZVxyXG5cclxuICAgIC8vIEtub3dsZWRnZSBCYXNlXHJcbiAgICB0aGlzLmtub3dsZWRnZUJhc2UgPSBuZXcgYmVkcm9jay5DZm5Lbm93bGVkZ2VCYXNlKHRoaXMsICdLbm93bGVkZ2VCYXNlJywge1xyXG4gICAgICBuYW1lOiAndW5pdHkta25vd2xlZGdlLWJhc2UnLFxyXG4gICAgICByb2xlQXJuOiBiZWRyb2NrUm9sZS5yb2xlQXJuLFxyXG4gICAgICBrbm93bGVkZ2VCYXNlQ29uZmlndXJhdGlvbjoge1xyXG4gICAgICAgIHR5cGU6ICdWRUNUT1InLFxyXG4gICAgICAgIHZlY3Rvcktub3dsZWRnZUJhc2VDb25maWd1cmF0aW9uOiB7XHJcbiAgICAgICAgICBlbWJlZGRpbmdNb2RlbEFybjogJ2Fybjphd3M6YmVkcm9jazp1cy1lYXN0LTE6OmZvdW5kYXRpb24tbW9kZWwvYW1hem9uLnRpdGFuLWVtYmVkLXRleHQtdjI6MCdcclxuICAgICAgICB9XHJcbiAgICAgIH0sXHJcbiAgICAgIHN0b3JhZ2VDb25maWd1cmF0aW9uOiB7XHJcbiAgICAgICAgdHlwZTogJ09QRU5TRUFSQ0hfU0VSVkVSTEVTUycsXHJcbiAgICAgICAgb3BlbnNlYXJjaFNlcnZlcmxlc3NDb25maWd1cmF0aW9uOiB7XHJcbiAgICAgICAgICBjb2xsZWN0aW9uQXJuOiBjb2xsZWN0aW9uLmF0dHJBcm4sXHJcbiAgICAgICAgICBmaWVsZE1hcHBpbmc6IHtcclxuICAgICAgICAgICAgbWV0YWRhdGFGaWVsZDogJ0FNQVpPTl9CRURST0NLX01FVEFEQVRBJyxcclxuICAgICAgICAgICAgdGV4dEZpZWxkOiAnQU1BWk9OX0JFRFJPQ0tfVEVYVF9DSFVOSycsXHJcbiAgICAgICAgICAgIHZlY3RvckZpZWxkOiAnYmVkcm9jay1rbm93bGVkZ2UtYmFzZS12ZWN0b3InXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgdmVjdG9ySW5kZXhOYW1lOiAndW5pdHktdmVjdG9yLWluZGV4J1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5rbm93bGVkZ2VCYXNlLm5vZGUuYWRkRGVwZW5kZW5jeSh2ZWN0b3JJbmRleCk7XHJcblxyXG4gICAgLy8gRGF0YSBTb3VyY2VcclxuICAgIGNvbnN0IGRhdGFTb3VyY2UgPSBuZXcgYmVkcm9jay5DZm5EYXRhU291cmNlKHRoaXMsICdEYXRhU291cmNlJywge1xyXG4gICAgICBuYW1lOiAndW5pdHktczMtZGF0YS1zb3VyY2UnLFxyXG4gICAgICBrbm93bGVkZ2VCYXNlSWQ6IHRoaXMua25vd2xlZGdlQmFzZS5hdHRyS25vd2xlZGdlQmFzZUlkLFxyXG4gICAgICBkYXRhU291cmNlQ29uZmlndXJhdGlvbjoge1xyXG4gICAgICAgIHR5cGU6ICdTMycsXHJcbiAgICAgICAgczNDb25maWd1cmF0aW9uOiB7XHJcbiAgICAgICAgICBidWNrZXRBcm46IGRhdGFCdWNrZXQuYnVja2V0QXJuXHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBMYW1iZGEgZnVuY3Rpb24gdG8gaW50ZXJhY3Qgd2l0aCBrbm93bGVkZ2UgYmFzZVxyXG4gICAgdGhpcy5sYW1iZGFGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0tub3dsZWRnZUJhc2VGdW5jdGlvbicsIHtcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXHJcbiAgICAgIHRpbWVvdXQgOiBjZGsuRHVyYXRpb24uc2Vjb25kcyg2MCksXHJcbiAgICAgIGhhbmRsZXI6ICd2aXJ0dWFsQXNzaXN0YW50LmhhbmRsZXInLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYScpLFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIEtOT1dMRURHRV9CQVNFX0lEOiB0aGlzLmtub3dsZWRnZUJhc2UuYXR0cktub3dsZWRnZUJhc2VJZCxcclxuICAgICAgICBUQUJMRV9OQU1FIDogY2hhdGJvdFRhYmxlLnRhYmxlTmFtZVxyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBMYW1iZGEgcGVybWlzc2lvbnNcclxuICAgIHRoaXMubGFtYmRhRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgYWN0aW9uczogW1xyXG4gICAgICAgICdiZWRyb2NrOkludm9rZU1vZGVsJyxcclxuICAgICAgICAnYmVkcm9jazpSZXRyaWV2ZScsXHJcbiAgICAgICAgJ2JlZHJvY2s6UmV0cmlldmVBbmRHZW5lcmF0ZSdcclxuICAgICAgXSxcclxuICAgICAgcmVzb3VyY2VzOiBbJyonXVxyXG4gICAgfSkpO1xyXG5cclxuICAgIGNoYXRib3RUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEodGhpcy5sYW1iZGFGdW5jdGlvbik7XHJcblxyXG4gICAgLy8gT3V0cHV0c1xyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0tub3dsZWRnZUJhc2VJZCcsIHtcclxuICAgICAgdmFsdWU6IHRoaXMua25vd2xlZGdlQmFzZS5hdHRyS25vd2xlZGdlQmFzZUlkLFxyXG4gICAgICBleHBvcnROYW1lOiAnVW5pdHlLbm93bGVkZ2VCYXNlSWQnXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRGF0YUJ1Y2tldE5hbWUnLCB7XHJcbiAgICAgIHZhbHVlOiBkYXRhQnVja2V0LmJ1Y2tldE5hbWUsXHJcbiAgICAgIGV4cG9ydE5hbWU6ICdVbml0eURhdGFCdWNrZXROYW1lJ1xyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcbiJdfQ==