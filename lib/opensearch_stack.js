"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenSearchStack = void 0;
const cdk = require("aws-cdk-lib");
const iam = require("aws-cdk-lib/aws-iam");
const s3 = require("aws-cdk-lib/aws-s3");
const opensearchserverless = require("aws-cdk-lib/aws-opensearchserverless");
class OpenSearchStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const collectionName = "unity-kb-collection";
        // S3 bucket for knowledge base data
        this.dataBucket = new s3.Bucket(this, 'KnowledgeBaseBucket', {
            removalPolicy: cdk.RemovalPolicy.DESTROY
        });
        // IAM role for Bedrock
        this.bedrockRole = new iam.Role(this, 'BedrockKnowledgeBaseRole', {
            assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
            inlinePolicies: {
                BedrockPolicy: new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            actions: ['bedrock:InvokeModel'],
                            resources: ['arn:aws:bedrock:*::foundation-model/amazon.titan-embed-text-v2:0']
                        })
                    ]
                })
            }
        });
        this.dataBucket.grantRead(this.bedrockRole);
        // OpenSearch Serverless policies
        const encryptionPolicy = new opensearchserverless.CfnSecurityPolicy(this, 'EncryptionPolicy', {
            name: 'unity-kb-encryption-policy',
            type: 'encryption',
            policy: JSON.stringify({
                Rules: [{ ResourceType: 'collection', Resource: [`collection/${collectionName}`] }],
                AWSOwnedKey: true
            })
        });
        const networkPolicy = new opensearchserverless.CfnSecurityPolicy(this, 'NetworkPolicy', {
            name: 'unity-kb-network-policy',
            type: 'network',
            policy: JSON.stringify([{
                    Rules: [
                        { ResourceType: 'collection', Resource: [`collection/${collectionName}`] },
                        { ResourceType: 'dashboard', Resource: [`collection/${collectionName}`] }
                    ],
                    AllowFromPublic: true
                }])
        });
        // OpenSearch collection
        this.collection = new opensearchserverless.CfnCollection(this, 'Collection', {
            name: collectionName,
            type: 'VECTORSEARCH'
        });
        this.collection.addDependency(encryptionPolicy);
        this.collection.addDependency(networkPolicy);
        // Data access policy
        this.dataAccessPolicy = new opensearchserverless.CfnAccessPolicy(this, 'DataAccessPolicy', {
            name: 'unity-kb-data-access-policy',
            type: 'data',
            policy: JSON.stringify([{
                    Rules: [
                        {
                            ResourceType: 'collection',
                            Resource: [`collection/${collectionName}`],
                            Permission: ['aoss:CreateCollectionItems', 'aoss:DeleteCollectionItems', 'aoss:UpdateCollectionItems', 'aoss:DescribeCollectionItems']
                        },
                        {
                            ResourceType: 'index',
                            Resource: [`index/${collectionName}/*`],
                            Permission: ['aoss:CreateIndex', 'aoss:DeleteIndex', 'aoss:UpdateIndex', 'aoss:DescribeIndex', 'aoss:ReadDocument', 'aoss:WriteDocument']
                        }
                    ],
                    Principal: [
                        this.bedrockRole.roleArn,
                        `arn:aws:iam::${this.account}:root`
                    ]
                }])
        });
        this.dataAccessPolicy.node.addDependency(this.collection);
        // Grant OpenSearch access to Bedrock role
        this.bedrockRole.addToPolicy(new iam.PolicyStatement({
            actions: ['aoss:APIAccessAll'],
            resources: [this.collection.attrArn]
        }));
        // Outputs
        new cdk.CfnOutput(this, 'CollectionEndpoint', {
            value: this.collection.attrCollectionEndpoint,
            exportName: 'UnityCollectionEndpoint'
        });
    }
}
exports.OpenSearchStack = OpenSearchStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3BlbnNlYXJjaF9zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm9wZW5zZWFyY2hfc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBRW5DLDJDQUEyQztBQUMzQyx5Q0FBeUM7QUFDekMsNkVBQTZFO0FBRTdFLE1BQWEsZUFBZ0IsU0FBUSxHQUFHLENBQUMsS0FBSztJQU01QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXNCO1FBQzlELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ3hCLE1BQU0sY0FBYyxHQUFHLHFCQUFxQixDQUFBO1FBRTVDLG9DQUFvQztRQUNwQyxJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDM0QsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztTQUN6QyxDQUFDLENBQUM7UUFFSCx1QkFBdUI7UUFDdkIsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLDBCQUEwQixFQUFFO1lBQ2hFLFNBQVMsRUFBRSxJQUFJLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyx1QkFBdUIsQ0FBQztZQUM1RCxjQUFjLEVBQUU7Z0JBQ2QsYUFBYSxFQUFFLElBQUksR0FBRyxDQUFDLGNBQWMsQ0FBQztvQkFDcEMsVUFBVSxFQUFFO3dCQUNWLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQzs0QkFDdEIsT0FBTyxFQUFFLENBQUMscUJBQXFCLENBQUM7NEJBQ2hDLFNBQVMsRUFBRSxDQUFDLGtFQUFrRSxDQUFDO3lCQUNoRixDQUFDO3FCQUNIO2lCQUNGLENBQUM7YUFDSDtTQUNGLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUU1Qyxp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QztRQUVKLFVBQVU7UUFDVixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLG9CQUFvQixFQUFFO1lBQzVDLEtBQUssRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLHNCQUFzQjtZQUM3QyxVQUFVLEVBQUUseUJBQXlCO1NBQ3RDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQXJHRCwwQ0FxR0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xyXG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcclxuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xyXG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xyXG5pbXBvcnQgKiBhcyBvcGVuc2VhcmNoc2VydmVybGVzcyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtb3BlbnNlYXJjaHNlcnZlcmxlc3MnO1xyXG5cclxuZXhwb3J0IGNsYXNzIE9wZW5TZWFyY2hTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XHJcbiAgcHVibGljIHJlYWRvbmx5IGNvbGxlY3Rpb246IG9wZW5zZWFyY2hzZXJ2ZXJsZXNzLkNmbkNvbGxlY3Rpb247XHJcbiAgcHVibGljIHJlYWRvbmx5IGJlZHJvY2tSb2xlOiBpYW0uUm9sZTtcclxuICBwdWJsaWMgcmVhZG9ubHkgZGF0YUJ1Y2tldDogczMuQnVja2V0O1xyXG4gIHB1YmxpYyByZWFkb25seSBkYXRhQWNjZXNzUG9saWN5OiBvcGVuc2VhcmNoc2VydmVybGVzcy5DZm5BY2Nlc3NQb2xpY3k7XHJcblxyXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcclxuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xyXG4gICAgY29uc3QgY29sbGVjdGlvbk5hbWUgPSBcInVuaXR5LWtiLWNvbGxlY3Rpb25cIlxyXG5cclxuICAgIC8vIFMzIGJ1Y2tldCBmb3Iga25vd2xlZGdlIGJhc2UgZGF0YVxyXG4gICAgdGhpcy5kYXRhQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnS25vd2xlZGdlQmFzZUJ1Y2tldCcsIHtcclxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWVxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gSUFNIHJvbGUgZm9yIEJlZHJvY2tcclxuICAgIHRoaXMuYmVkcm9ja1JvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0JlZHJvY2tLbm93bGVkZ2VCYXNlUm9sZScsIHtcclxuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2JlZHJvY2suYW1hem9uYXdzLmNvbScpLFxyXG4gICAgICBpbmxpbmVQb2xpY2llczoge1xyXG4gICAgICAgIEJlZHJvY2tQb2xpY3k6IG5ldyBpYW0uUG9saWN5RG9jdW1lbnQoe1xyXG4gICAgICAgICAgc3RhdGVtZW50czogW1xyXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgICAgICAgICAgYWN0aW9uczogWydiZWRyb2NrOkludm9rZU1vZGVsJ10sXHJcbiAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbJ2Fybjphd3M6YmVkcm9jazoqOjpmb3VuZGF0aW9uLW1vZGVsL2FtYXpvbi50aXRhbi1lbWJlZC10ZXh0LXYyOjAnXVxyXG4gICAgICAgICAgICB9KVxyXG4gICAgICAgICAgXVxyXG4gICAgICAgIH0pXHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuZGF0YUJ1Y2tldC5ncmFudFJlYWQodGhpcy5iZWRyb2NrUm9sZSk7XHJcblxyXG4gICAgLy8gT3BlblNlYXJjaCBTZXJ2ZXJsZXNzIHBvbGljaWVzXHJcbiAgICBjb25zdCBlbmNyeXB0aW9uUG9saWN5ID0gbmV3IG9wZW5zZWFyY2hzZXJ2ZXJsZXNzLkNmblNlY3VyaXR5UG9saWN5KHRoaXMsICdFbmNyeXB0aW9uUG9saWN5Jywge1xyXG4gICAgICBuYW1lOiAndW5pdHkta2ItZW5jcnlwdGlvbi1wb2xpY3knLFxyXG4gICAgICB0eXBlOiAnZW5jcnlwdGlvbicsXHJcbiAgICAgIHBvbGljeTogSlNPTi5zdHJpbmdpZnkoe1xyXG4gICAgICAgIFJ1bGVzOiBbeyBSZXNvdXJjZVR5cGU6ICdjb2xsZWN0aW9uJywgUmVzb3VyY2U6IFtgY29sbGVjdGlvbi8ke2NvbGxlY3Rpb25OYW1lfWBdIH1dLFxyXG4gICAgICAgIEFXU093bmVkS2V5OiB0cnVlXHJcbiAgICAgIH0pXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBuZXR3b3JrUG9saWN5ID0gbmV3IG9wZW5zZWFyY2hzZXJ2ZXJsZXNzLkNmblNlY3VyaXR5UG9saWN5KHRoaXMsICdOZXR3b3JrUG9saWN5Jywge1xyXG4gICAgICBuYW1lOiAndW5pdHkta2ItbmV0d29yay1wb2xpY3knLFxyXG4gICAgICB0eXBlOiAnbmV0d29yaycsXHJcbiAgICAgIHBvbGljeTogSlNPTi5zdHJpbmdpZnkoW3tcclxuICAgICAgICBSdWxlczogW1xyXG4gICAgICAgICAgeyBSZXNvdXJjZVR5cGU6ICdjb2xsZWN0aW9uJywgUmVzb3VyY2U6IFtgY29sbGVjdGlvbi8ke2NvbGxlY3Rpb25OYW1lfWBdIH0sXHJcbiAgICAgICAgICB7IFJlc291cmNlVHlwZTogJ2Rhc2hib2FyZCcsIFJlc291cmNlOiBbYGNvbGxlY3Rpb24vJHtjb2xsZWN0aW9uTmFtZX1gXSB9XHJcbiAgICAgICAgXSxcclxuICAgICAgICBBbGxvd0Zyb21QdWJsaWM6IHRydWVcclxuICAgICAgfV0pXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBPcGVuU2VhcmNoIGNvbGxlY3Rpb25cclxuICAgIHRoaXMuY29sbGVjdGlvbiA9IG5ldyBvcGVuc2VhcmNoc2VydmVybGVzcy5DZm5Db2xsZWN0aW9uKHRoaXMsICdDb2xsZWN0aW9uJywge1xyXG4gICAgICBuYW1lOiBjb2xsZWN0aW9uTmFtZSxcclxuICAgICAgdHlwZTogJ1ZFQ1RPUlNFQVJDSCdcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuY29sbGVjdGlvbi5hZGREZXBlbmRlbmN5KGVuY3J5cHRpb25Qb2xpY3kpO1xyXG4gICAgdGhpcy5jb2xsZWN0aW9uLmFkZERlcGVuZGVuY3kobmV0d29ya1BvbGljeSk7XHJcblxyXG4gICAgLy8gRGF0YSBhY2Nlc3MgcG9saWN5XHJcbiAgICB0aGlzLmRhdGFBY2Nlc3NQb2xpY3kgPSBuZXcgb3BlbnNlYXJjaHNlcnZlcmxlc3MuQ2ZuQWNjZXNzUG9saWN5KHRoaXMsICdEYXRhQWNjZXNzUG9saWN5Jywge1xyXG4gICAgICBuYW1lOiAndW5pdHkta2ItZGF0YS1hY2Nlc3MtcG9saWN5JyxcclxuICAgICAgdHlwZTogJ2RhdGEnLFxyXG4gICAgICBwb2xpY3k6IEpTT04uc3RyaW5naWZ5KFt7XHJcbiAgICAgICAgUnVsZXM6IFtcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgUmVzb3VyY2VUeXBlOiAnY29sbGVjdGlvbicsXHJcbiAgICAgICAgICAgIFJlc291cmNlOiBbYGNvbGxlY3Rpb24vJHtjb2xsZWN0aW9uTmFtZX1gXSxcclxuICAgICAgICAgICAgUGVybWlzc2lvbjogWydhb3NzOkNyZWF0ZUNvbGxlY3Rpb25JdGVtcycsICdhb3NzOkRlbGV0ZUNvbGxlY3Rpb25JdGVtcycsICdhb3NzOlVwZGF0ZUNvbGxlY3Rpb25JdGVtcycsICdhb3NzOkRlc2NyaWJlQ29sbGVjdGlvbkl0ZW1zJ11cclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIFJlc291cmNlVHlwZTogJ2luZGV4JyxcclxuICAgICAgICAgICAgUmVzb3VyY2U6IFtgaW5kZXgvJHtjb2xsZWN0aW9uTmFtZX0vKmBdLFxyXG4gICAgICAgICAgICBQZXJtaXNzaW9uOiBbJ2Fvc3M6Q3JlYXRlSW5kZXgnLCAnYW9zczpEZWxldGVJbmRleCcsICdhb3NzOlVwZGF0ZUluZGV4JywgJ2Fvc3M6RGVzY3JpYmVJbmRleCcsICdhb3NzOlJlYWREb2N1bWVudCcsICdhb3NzOldyaXRlRG9jdW1lbnQnXVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgUHJpbmNpcGFsOiBbXHJcbiAgICAgICAgICB0aGlzLmJlZHJvY2tSb2xlLnJvbGVBcm4sXHJcbiAgICAgICAgICBgYXJuOmF3czppYW06OiR7dGhpcy5hY2NvdW50fTpyb290YFxyXG4gICAgICAgIF1cclxuICAgICAgfV0pXHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLmRhdGFBY2Nlc3NQb2xpY3kubm9kZS5hZGREZXBlbmRlbmN5KHRoaXMuY29sbGVjdGlvbik7XHJcblxyXG4gICAgLy8gR3JhbnQgT3BlblNlYXJjaCBhY2Nlc3MgdG8gQmVkcm9jayByb2xlXHJcbiAgICB0aGlzLmJlZHJvY2tSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgYWN0aW9uczogWydhb3NzOkFQSUFjY2Vzc0FsbCddLFxyXG4gICAgICByZXNvdXJjZXM6IFt0aGlzLmNvbGxlY3Rpb24uYXR0ckFybl1cclxuICAgIH0pKTtcclxuXHJcbiAgICAvLyBPdXRwdXRzXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ29sbGVjdGlvbkVuZHBvaW50Jywge1xyXG4gICAgICB2YWx1ZTogdGhpcy5jb2xsZWN0aW9uLmF0dHJDb2xsZWN0aW9uRW5kcG9pbnQsXHJcbiAgICAgIGV4cG9ydE5hbWU6ICdVbml0eUNvbGxlY3Rpb25FbmRwb2ludCdcclxuICAgIH0pO1xyXG4gIH1cclxufVxyXG4iXX0=