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
exports.OpenSearchStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const opensearchserverless = __importStar(require("aws-cdk-lib/aws-opensearchserverless"));
class OpenSearchStack extends cdk.Stack {
    collection;
    bedrockRole;
    dataBucket;
    dataAccessPolicy;
    constructor(scope, id, props) {
        super(scope, id, props);
        // const collectionName = "unity-kb-collection"
        const prefixname = this.stackName.split('-')[0].toLowerCase();
        const collectionName = `${prefixname}-kb-collection`;
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
            name: `${prefixname}-kb-encryption-policy`,
            type: 'encryption',
            policy: JSON.stringify({
                Rules: [{ ResourceType: 'collection', Resource: [`collection/${collectionName}`] }],
                AWSOwnedKey: true
            })
        });
        const networkPolicy = new opensearchserverless.CfnSecurityPolicy(this, 'NetworkPolicy', {
            name: `${prefixname}-kb-network-policy`,
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
            name: `${prefixname}-kb-data-access-policy`,
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
            exportName: `${prefixname}-CollectionEndpoint`
        });
    }
}
exports.OpenSearchStack = OpenSearchStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3BlbnNlYXJjaF9zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm9wZW5zZWFyY2hfc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFFbkMseURBQTJDO0FBQzNDLHVEQUF5QztBQUN6QywyRkFBNkU7QUFFN0UsTUFBYSxlQUFnQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzVCLFVBQVUsQ0FBcUM7SUFDL0MsV0FBVyxDQUFXO0lBQ3RCLFVBQVUsQ0FBWTtJQUN0QixnQkFBZ0IsQ0FBdUM7SUFFdkUsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUN4QiwrQ0FBK0M7UUFDL0MsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7UUFDOUQsTUFBTSxjQUFjLEdBQUcsR0FBRyxVQUFVLGdCQUFnQixDQUFDO1FBQ3JELG9DQUFvQztRQUNwQyxJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDM0QsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztTQUN6QyxDQUFDLENBQUM7UUFFSCx1QkFBdUI7UUFDdkIsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLDBCQUEwQixFQUFFO1lBQ2hFLFNBQVMsRUFBRSxJQUFJLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyx1QkFBdUIsQ0FBQztZQUM1RCxjQUFjLEVBQUU7Z0JBQ2QsYUFBYSxFQUFFLElBQUksR0FBRyxDQUFDLGNBQWMsQ0FBQztvQkFDcEMsVUFBVSxFQUFFO3dCQUNW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LENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7UUFFMUQsMENBQTBDO1FBQzFDLElBQUksQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztZQUNuRCxPQUFPLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQztZQUM5QixTQUFTLEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQztTQUNyQyxDQUFDLENBQUMsQ0FBQztRQUVKLFVBQVU7UUFDVixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLG9CQUFvQixFQUFFO1lBQzVDLEtBQUssRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLHNCQUFzQjtZQUM3QyxVQUFVLEVBQUUsR0FBRyxVQUFVLHFCQUFxQjtTQUMvQyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUF0R0QsMENBc0dDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcclxuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XHJcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcclxuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcclxuaW1wb3J0ICogYXMgb3BlbnNlYXJjaHNlcnZlcmxlc3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLW9wZW5zZWFyY2hzZXJ2ZXJsZXNzJztcclxuXHJcbmV4cG9ydCBjbGFzcyBPcGVuU2VhcmNoU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xyXG4gIHB1YmxpYyByZWFkb25seSBjb2xsZWN0aW9uOiBvcGVuc2VhcmNoc2VydmVybGVzcy5DZm5Db2xsZWN0aW9uO1xyXG4gIHB1YmxpYyByZWFkb25seSBiZWRyb2NrUm9sZTogaWFtLlJvbGU7XHJcbiAgcHVibGljIHJlYWRvbmx5IGRhdGFCdWNrZXQ6IHMzLkJ1Y2tldDtcclxuICBwdWJsaWMgcmVhZG9ubHkgZGF0YUFjY2Vzc1BvbGljeTogb3BlbnNlYXJjaHNlcnZlcmxlc3MuQ2ZuQWNjZXNzUG9saWN5O1xyXG5cclxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IGNkay5TdGFja1Byb3BzKSB7XHJcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcclxuICAgIC8vIGNvbnN0IGNvbGxlY3Rpb25OYW1lID0gXCJ1bml0eS1rYi1jb2xsZWN0aW9uXCJcclxuICAgIGNvbnN0IHByZWZpeG5hbWUgPSB0aGlzLnN0YWNrTmFtZS5zcGxpdCgnLScpWzBdLnRvTG93ZXJDYXNlKCk7XHJcbiAgICBjb25zdCBjb2xsZWN0aW9uTmFtZSA9IGAke3ByZWZpeG5hbWV9LWtiLWNvbGxlY3Rpb25gO1xyXG4gICAgLy8gUzMgYnVja2V0IGZvciBrbm93bGVkZ2UgYmFzZSBkYXRhXHJcbiAgICB0aGlzLmRhdGFCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdLbm93bGVkZ2VCYXNlQnVja2V0Jywge1xyXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBJQU0gcm9sZSBmb3IgQmVkcm9ja1xyXG4gICAgdGhpcy5iZWRyb2NrUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnQmVkcm9ja0tub3dsZWRnZUJhc2VSb2xlJywge1xyXG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnYmVkcm9jay5hbWF6b25hd3MuY29tJyksXHJcbiAgICAgIGlubGluZVBvbGljaWVzOiB7XHJcbiAgICAgICAgQmVkcm9ja1BvbGljeTogbmV3IGlhbS5Qb2xpY3lEb2N1bWVudCh7XHJcbiAgICAgICAgICBzdGF0ZW1lbnRzOiBbXHJcbiAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgICAgICAgICBhY3Rpb25zOiBbJ2JlZHJvY2s6SW52b2tlTW9kZWwnXSxcclxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFsnYXJuOmF3czpiZWRyb2NrOio6OmZvdW5kYXRpb24tbW9kZWwvYW1hem9uLnRpdGFuLWVtYmVkLXRleHQtdjI6MCddXHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICBdXHJcbiAgICAgICAgfSlcclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5kYXRhQnVja2V0LmdyYW50UmVhZCh0aGlzLmJlZHJvY2tSb2xlKTtcclxuXHJcbiAgICAvLyBPcGVuU2VhcmNoIFNlcnZlcmxlc3MgcG9saWNpZXNcclxuICAgIGNvbnN0IGVuY3J5cHRpb25Qb2xpY3kgPSBuZXcgb3BlbnNlYXJjaHNlcnZlcmxlc3MuQ2ZuU2VjdXJpdHlQb2xpY3kodGhpcywgJ0VuY3J5cHRpb25Qb2xpY3knLCB7XHJcbiAgICAgIG5hbWU6IGAke3ByZWZpeG5hbWV9LWtiLWVuY3J5cHRpb24tcG9saWN5YCxcclxuICAgICAgdHlwZTogJ2VuY3J5cHRpb24nLFxyXG4gICAgICBwb2xpY3k6IEpTT04uc3RyaW5naWZ5KHtcclxuICAgICAgICBSdWxlczogW3sgUmVzb3VyY2VUeXBlOiAnY29sbGVjdGlvbicsIFJlc291cmNlOiBbYGNvbGxlY3Rpb24vJHtjb2xsZWN0aW9uTmFtZX1gXSB9XSxcclxuICAgICAgICBBV1NPd25lZEtleTogdHJ1ZVxyXG4gICAgICB9KVxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgbmV0d29ya1BvbGljeSA9IG5ldyBvcGVuc2VhcmNoc2VydmVybGVzcy5DZm5TZWN1cml0eVBvbGljeSh0aGlzLCAnTmV0d29ya1BvbGljeScsIHtcclxuICAgICAgbmFtZTogYCR7cHJlZml4bmFtZX0ta2ItbmV0d29yay1wb2xpY3lgLFxyXG4gICAgICB0eXBlOiAnbmV0d29yaycsXHJcbiAgICAgIHBvbGljeTogSlNPTi5zdHJpbmdpZnkoW3tcclxuICAgICAgICBSdWxlczogW1xyXG4gICAgICAgICAgeyBSZXNvdXJjZVR5cGU6ICdjb2xsZWN0aW9uJywgUmVzb3VyY2U6IFtgY29sbGVjdGlvbi8ke2NvbGxlY3Rpb25OYW1lfWBdIH0sXHJcbiAgICAgICAgICB7IFJlc291cmNlVHlwZTogJ2Rhc2hib2FyZCcsIFJlc291cmNlOiBbYGNvbGxlY3Rpb24vJHtjb2xsZWN0aW9uTmFtZX1gXSB9XHJcbiAgICAgICAgXSxcclxuICAgICAgICBBbGxvd0Zyb21QdWJsaWM6IHRydWVcclxuICAgICAgfV0pXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBPcGVuU2VhcmNoIGNvbGxlY3Rpb25cclxuICAgIHRoaXMuY29sbGVjdGlvbiA9IG5ldyBvcGVuc2VhcmNoc2VydmVybGVzcy5DZm5Db2xsZWN0aW9uKHRoaXMsICdDb2xsZWN0aW9uJywge1xyXG4gICAgICBuYW1lOiBjb2xsZWN0aW9uTmFtZSxcclxuICAgICAgdHlwZTogJ1ZFQ1RPUlNFQVJDSCdcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuY29sbGVjdGlvbi5hZGREZXBlbmRlbmN5KGVuY3J5cHRpb25Qb2xpY3kpO1xyXG4gICAgdGhpcy5jb2xsZWN0aW9uLmFkZERlcGVuZGVuY3kobmV0d29ya1BvbGljeSk7XHJcblxyXG4gICAgLy8gRGF0YSBhY2Nlc3MgcG9saWN5XHJcbiAgICB0aGlzLmRhdGFBY2Nlc3NQb2xpY3kgPSBuZXcgb3BlbnNlYXJjaHNlcnZlcmxlc3MuQ2ZuQWNjZXNzUG9saWN5KHRoaXMsICdEYXRhQWNjZXNzUG9saWN5Jywge1xyXG4gICAgICBuYW1lOiBgJHtwcmVmaXhuYW1lfS1rYi1kYXRhLWFjY2Vzcy1wb2xpY3lgLFxyXG4gICAgICB0eXBlOiAnZGF0YScsXHJcbiAgICAgIHBvbGljeTogSlNPTi5zdHJpbmdpZnkoW3tcclxuICAgICAgICBSdWxlczogW1xyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICBSZXNvdXJjZVR5cGU6ICdjb2xsZWN0aW9uJyxcclxuICAgICAgICAgICAgUmVzb3VyY2U6IFtgY29sbGVjdGlvbi8ke2NvbGxlY3Rpb25OYW1lfWBdLFxyXG4gICAgICAgICAgICBQZXJtaXNzaW9uOiBbJ2Fvc3M6Q3JlYXRlQ29sbGVjdGlvbkl0ZW1zJywgJ2Fvc3M6RGVsZXRlQ29sbGVjdGlvbkl0ZW1zJywgJ2Fvc3M6VXBkYXRlQ29sbGVjdGlvbkl0ZW1zJywgJ2Fvc3M6RGVzY3JpYmVDb2xsZWN0aW9uSXRlbXMnXVxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgUmVzb3VyY2VUeXBlOiAnaW5kZXgnLFxyXG4gICAgICAgICAgICBSZXNvdXJjZTogW2BpbmRleC8ke2NvbGxlY3Rpb25OYW1lfS8qYF0sXHJcbiAgICAgICAgICAgIFBlcm1pc3Npb246IFsnYW9zczpDcmVhdGVJbmRleCcsICdhb3NzOkRlbGV0ZUluZGV4JywgJ2Fvc3M6VXBkYXRlSW5kZXgnLCAnYW9zczpEZXNjcmliZUluZGV4JywgJ2Fvc3M6UmVhZERvY3VtZW50JywgJ2Fvc3M6V3JpdGVEb2N1bWVudCddXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgXSxcclxuICAgICAgICBQcmluY2lwYWw6IFtcclxuICAgICAgICAgIHRoaXMuYmVkcm9ja1JvbGUucm9sZUFybixcclxuICAgICAgICAgIGBhcm46YXdzOmlhbTo6JHt0aGlzLmFjY291bnR9OnJvb3RgXHJcbiAgICAgICAgXVxyXG4gICAgICB9XSlcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuZGF0YUFjY2Vzc1BvbGljeS5ub2RlLmFkZERlcGVuZGVuY3kodGhpcy5jb2xsZWN0aW9uKTtcclxuXHJcbiAgICAvLyBHcmFudCBPcGVuU2VhcmNoIGFjY2VzcyB0byBCZWRyb2NrIHJvbGVcclxuICAgIHRoaXMuYmVkcm9ja1JvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICBhY3Rpb25zOiBbJ2Fvc3M6QVBJQWNjZXNzQWxsJ10sXHJcbiAgICAgIHJlc291cmNlczogW3RoaXMuY29sbGVjdGlvbi5hdHRyQXJuXVxyXG4gICAgfSkpO1xyXG5cclxuICAgIC8vIE91dHB1dHNcclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDb2xsZWN0aW9uRW5kcG9pbnQnLCB7XHJcbiAgICAgIHZhbHVlOiB0aGlzLmNvbGxlY3Rpb24uYXR0ckNvbGxlY3Rpb25FbmRwb2ludCxcclxuICAgICAgZXhwb3J0TmFtZTogYCR7cHJlZml4bmFtZX0tQ29sbGVjdGlvbkVuZHBvaW50YFxyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcbiJdfQ==