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
            name: 'kb-encryption-policy',
            type: 'encryption',
            policy: JSON.stringify({
                Rules: [{ ResourceType: 'collection', Resource: ['collection/kb-collection'] }],
                AWSOwnedKey: true
            })
        });
        const networkPolicy = new opensearchserverless.CfnSecurityPolicy(this, 'NetworkPolicy', {
            name: 'kb-network-policy',
            type: 'network',
            policy: JSON.stringify([{
                    Rules: [
                        { ResourceType: 'collection', Resource: ['collection/kb-collection'] },
                        { ResourceType: 'dashboard', Resource: ['collection/kb-collection'] }
                    ],
                    AllowFromPublic: true
                }])
        });
        // OpenSearch collection
        this.collection = new opensearchserverless.CfnCollection(this, 'Collection', {
            name: 'kb-collection',
            type: 'VECTORSEARCH'
        });
        this.collection.addDependency(encryptionPolicy);
        this.collection.addDependency(networkPolicy);
        // Data access policy
        this.dataAccessPolicy = new opensearchserverless.CfnAccessPolicy(this, 'DataAccessPolicy', {
            name: 'kb-data-access-policy',
            type: 'data',
            policy: JSON.stringify([{
                    Rules: [
                        {
                            ResourceType: 'collection',
                            Resource: ['collection/kb-collection'],
                            Permission: ['aoss:CreateCollectionItems', 'aoss:DeleteCollectionItems', 'aoss:UpdateCollectionItems', 'aoss:DescribeCollectionItems']
                        },
                        {
                            ResourceType: 'index',
                            Resource: ['index/kb-collection/*'],
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
            exportName: 'CollectionEndpoint'
        });
    }
}
exports.OpenSearchStack = OpenSearchStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3BlbnNlYXJjaF9zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm9wZW5zZWFyY2hfc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBRW5DLDJDQUEyQztBQUMzQyx5Q0FBeUM7QUFDekMsNkVBQTZFO0FBRTdFLE1BQWEsZUFBZ0IsU0FBUSxHQUFHLENBQUMsS0FBSztJQU01QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXNCO1FBQzlELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLG9DQUFvQztRQUNwQyxJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDM0QsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztTQUN6QyxDQUFDLENBQUM7UUFFSCx1QkFBdUI7UUFDdkIsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLDBCQUEwQixFQUFFO1lBQ2hFLFNBQVMsRUFBRSxJQUFJLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyx1QkFBdUIsQ0FBQztZQUM1RCxjQUFjLEVBQUU7Z0JBQ2QsYUFBYSxFQUFFLElBQUksR0FBRyxDQUFDLGNBQWMsQ0FBQztvQkFDcEMsVUFBVSxFQUFFO3dCQUNWLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQzs0QkFDdEIsT0FBTyxFQUFFLENBQUMscUJBQXFCLENBQUM7NEJBQ2hDLFNBQVMsRUFBRSxDQUFDLGtFQUFrRSxDQUFDO3lCQUNoRixDQUFDO3FCQUNIO2lCQUNGLENBQUM7YUFDSDtTQUNGLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUU1QyxpQ0FBaUM7UUFDakMsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJ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SyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsc0JBQXNCO1lBQzdDLFVBQVUsRUFBRSxvQkFBb0I7U0FDakMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBcEdELDBDQW9HQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XHJcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xyXG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XHJcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XHJcbmltcG9ydCAqIGFzIG9wZW5zZWFyY2hzZXJ2ZXJsZXNzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1vcGVuc2VhcmNoc2VydmVybGVzcyc7XHJcblxyXG5leHBvcnQgY2xhc3MgT3BlblNlYXJjaFN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcclxuICBwdWJsaWMgcmVhZG9ubHkgY29sbGVjdGlvbjogb3BlbnNlYXJjaHNlcnZlcmxlc3MuQ2ZuQ29sbGVjdGlvbjtcclxuICBwdWJsaWMgcmVhZG9ubHkgYmVkcm9ja1JvbGU6IGlhbS5Sb2xlO1xyXG4gIHB1YmxpYyByZWFkb25seSBkYXRhQnVja2V0OiBzMy5CdWNrZXQ7XHJcbiAgcHVibGljIHJlYWRvbmx5IGRhdGFBY2Nlc3NQb2xpY3k6IG9wZW5zZWFyY2hzZXJ2ZXJsZXNzLkNmbkFjY2Vzc1BvbGljeTtcclxuXHJcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBjZGsuU3RhY2tQcm9wcykge1xyXG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XHJcblxyXG4gICAgLy8gUzMgYnVja2V0IGZvciBrbm93bGVkZ2UgYmFzZSBkYXRhXHJcbiAgICB0aGlzLmRhdGFCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdLbm93bGVkZ2VCYXNlQnVja2V0Jywge1xyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBJQU0gcm9sZSBmb3IgQmVkcm9ja1xyXG4gICAgdGhpcy5iZWRyb2NrUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnQmVkcm9ja0tub3dsZWRnZUJhc2VSb2xlJywge1xyXG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnYmVkcm9jay5hbWF6b25hd3MuY29tJyksXHJcbiAgICAgIGlubGluZVBvbGljaWVzOiB7XHJcbiAgICAgICAgQmVkcm9ja1BvbGljeTogbmV3IGlhbS5Qb2xpY3lEb2N1bWVudCh7XHJcbiAgICAgICAgICBzdGF0ZW1lbnRzOiBbXHJcbiAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgICAgICAgICBhY3Rpb25zOiBbJ2JlZHJvY2s6SW52b2tlTW9kZWwnXSxcclxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFsnYXJuOmF3czpiZWRyb2NrOio6OmZvdW5kYXRpb24tbW9kZWwvYW1hem9uLnRpdGFuLWVtYmVkLXRleHQtdjI6MCddXHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICBdXHJcbiAgICAgICAgfSlcclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5kYXRhQnVja2V0LmdyYW50UmVhZCh0aGlzLmJlZHJvY2tSb2xlKTtcclxuXHJcbiAgICAvLyBPcGVuU2VhcmNoIFNlcnZlcmxlc3MgcG9saWNpZXNcclxuICAgIGNvbnN0IGVuY3J5cHRpb25Qb2xpY3kgPSBuZXcgb3BlbnNlYXJjaHNlcnZlcmxlc3MuQ2ZuU2VjdXJpdHlQb2xpY3kodGhpcywgJ0VuY3J5cHRpb25Qb2xpY3knLCB7XHJcbiAgICAgIG5hbWU6ICdrYi1lbmNyeXB0aW9uLXBvbGljeScsXHJcbiAgICAgIHR5cGU6ICdlbmNyeXB0aW9uJyxcclxuICAgICAgcG9saWN5OiBKU09OLnN0cmluZ2lmeSh7XHJcbiAgICAgICAgUnVsZXM6IFt7IFJlc291cmNlVHlwZTogJ2NvbGxlY3Rpb24nLCBSZXNvdXJjZTogWydjb2xsZWN0aW9uL2tiLWNvbGxlY3Rpb24nXSB9XSxcclxuICAgICAgICBBV1NPd25lZEtleTogdHJ1ZVxyXG4gICAgICB9KVxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgbmV0d29ya1BvbGljeSA9IG5ldyBvcGVuc2VhcmNoc2VydmVybGVzcy5DZm5TZWN1cml0eVBvbGljeSh0aGlzLCAnTmV0d29ya1BvbGljeScsIHtcclxuICAgICAgbmFtZTogJ2tiLW5ldHdvcmstcG9saWN5JyxcclxuICAgICAgdHlwZTogJ25ldHdvcmsnLFxyXG4gICAgICBwb2xpY3k6IEpTT04uc3RyaW5naWZ5KFt7XHJcbiAgICAgICAgUnVsZXM6IFtcclxuICAgICAgICAgIHsgUmVzb3VyY2VUeXBlOiAnY29sbGVjdGlvbicsIFJlc291cmNlOiBbJ2NvbGxlY3Rpb24va2ItY29sbGVjdGlvbiddIH0sXHJcbiAgICAgICAgICB7IFJlc291cmNlVHlwZTogJ2Rhc2hib2FyZCcsIFJlc291cmNlOiBbJ2NvbGxlY3Rpb24va2ItY29sbGVjdGlvbiddIH1cclxuICAgICAgICBdLFxyXG4gICAgICAgIEFsbG93RnJvbVB1YmxpYzogdHJ1ZVxyXG4gICAgICB9XSlcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIE9wZW5TZWFyY2ggY29sbGVjdGlvblxyXG4gICAgdGhpcy5jb2xsZWN0aW9uID0gbmV3IG9wZW5zZWFyY2hzZXJ2ZXJsZXNzLkNmbkNvbGxlY3Rpb24odGhpcywgJ0NvbGxlY3Rpb24nLCB7XHJcbiAgICAgIG5hbWU6ICdrYi1jb2xsZWN0aW9uJyxcclxuICAgICAgdHlwZTogJ1ZFQ1RPUlNFQVJDSCdcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuY29sbGVjdGlvbi5hZGREZXBlbmRlbmN5KGVuY3J5cHRpb25Qb2xpY3kpO1xyXG4gICAgdGhpcy5jb2xsZWN0aW9uLmFkZERlcGVuZGVuY3kobmV0d29ya1BvbGljeSk7XHJcblxyXG4gICAgLy8gRGF0YSBhY2Nlc3MgcG9saWN5XHJcbiAgICB0aGlzLmRhdGFBY2Nlc3NQb2xpY3kgPSBuZXcgb3BlbnNlYXJjaHNlcnZlcmxlc3MuQ2ZuQWNjZXNzUG9saWN5KHRoaXMsICdEYXRhQWNjZXNzUG9saWN5Jywge1xyXG4gICAgICBuYW1lOiAna2ItZGF0YS1hY2Nlc3MtcG9saWN5JyxcclxuICAgICAgdHlwZTogJ2RhdGEnLFxyXG4gICAgICBwb2xpY3k6IEpTT04uc3RyaW5naWZ5KFt7XHJcbiAgICAgICAgUnVsZXM6IFtcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgUmVzb3VyY2VUeXBlOiAnY29sbGVjdGlvbicsXHJcbiAgICAgICAgICAgIFJlc291cmNlOiBbJ2NvbGxlY3Rpb24va2ItY29sbGVjdGlvbiddLFxyXG4gICAgICAgICAgICBQZXJtaXNzaW9uOiBbJ2Fvc3M6Q3JlYXRlQ29sbGVjdGlvbkl0ZW1zJywgJ2Fvc3M6RGVsZXRlQ29sbGVjdGlvbkl0ZW1zJywgJ2Fvc3M6VXBkYXRlQ29sbGVjdGlvbkl0ZW1zJywgJ2Fvc3M6RGVzY3JpYmVDb2xsZWN0aW9uSXRlbXMnXVxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgUmVzb3VyY2VUeXBlOiAnaW5kZXgnLFxyXG4gICAgICAgICAgICBSZXNvdXJjZTogWydpbmRleC9rYi1jb2xsZWN0aW9uLyonXSxcclxuICAgICAgICAgICAgUGVybWlzc2lvbjogWydhb3NzOkNyZWF0ZUluZGV4JywgJ2Fvc3M6RGVsZXRlSW5kZXgnLCAnYW9zczpVcGRhdGVJbmRleCcsICdhb3NzOkRlc2NyaWJlSW5kZXgnLCAnYW9zczpSZWFkRG9jdW1lbnQnLCAnYW9zczpXcml0ZURvY3VtZW50J11cclxuICAgICAgICAgIH1cclxuICAgICAgICBdLFxyXG4gICAgICAgIFByaW5jaXBhbDogW1xyXG4gICAgICAgICAgdGhpcy5iZWRyb2NrUm9sZS5yb2xlQXJuLFxyXG4gICAgICAgICAgYGFybjphd3M6aWFtOjoke3RoaXMuYWNjb3VudH06cm9vdGBcclxuICAgICAgICBdXHJcbiAgICAgIH1dKVxyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5kYXRhQWNjZXNzUG9saWN5Lm5vZGUuYWRkRGVwZW5kZW5jeSh0aGlzLmNvbGxlY3Rpb24pO1xyXG5cclxuICAgIC8vIEdyYW50IE9wZW5TZWFyY2ggYWNjZXNzIHRvIEJlZHJvY2sgcm9sZVxyXG4gICAgdGhpcy5iZWRyb2NrUm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgIGFjdGlvbnM6IFsnYW9zczpBUElBY2Nlc3NBbGwnXSxcclxuICAgICAgcmVzb3VyY2VzOiBbdGhpcy5jb2xsZWN0aW9uLmF0dHJBcm5dXHJcbiAgICB9KSk7XHJcblxyXG4gICAgLy8gT3V0cHV0c1xyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0NvbGxlY3Rpb25FbmRwb2ludCcsIHtcclxuICAgICAgdmFsdWU6IHRoaXMuY29sbGVjdGlvbi5hdHRyQ29sbGVjdGlvbkVuZHBvaW50LFxyXG4gICAgICBleHBvcnROYW1lOiAnQ29sbGVjdGlvbkVuZHBvaW50J1xyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcbiJdfQ==