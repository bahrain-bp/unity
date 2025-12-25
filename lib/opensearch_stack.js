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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3BlbnNlYXJjaF9zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm9wZW5zZWFyY2hfc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFFbkMseURBQTJDO0FBQzNDLHVEQUF5QztBQUN6QywyRkFBNkU7QUFFN0UsTUFBYSxlQUFnQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzVCLFVBQVUsQ0FBcUM7SUFDL0MsV0FBVyxDQUFXO0lBQ3RCLFVBQVUsQ0FBWTtJQUN0QixnQkFBZ0IsQ0FBdUM7SUFFdkUsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUN4QixNQUFNLGNBQWMsR0FBRyxxQkFBcUIsQ0FBQTtRQUU1QyxvQ0FBb0M7UUFDcEMsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLHFCQUFxQixFQUFFO1lBQzNELGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87U0FDekMsQ0FBQyxDQUFDO1FBRUgsdUJBQXVCO1FBQ3ZCLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSwwQkFBMEIsRUFBRTtZQUNoRSxTQUFTLEVBQUUsSUFBSSxHQUFHLENBQUMsZ0JBQWdCLENBQUMsdUJBQXVCLENBQUM7WUFDNUQsY0FBYyxFQUFFO2dCQUNkLGFBQWEsRUFBRSxJQUFJLEdBQUcsQ0FBQyxjQUFjLENBQUM7b0JBQ3BDLFVBQVUsRUFBRTt3QkFDVixJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7NEJBQ3RCLE9BQU8sRUFBRSxDQUFDLHFCQUFxQixDQUFDOzRCQUNoQyxTQUFTLEVBQUUsQ0FBQyxrRUFBa0UsQ0FBQzt5QkFDaEYsQ0FBQztxQkFDSDtpQkFDRixD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QUFFLENBQUMsbUJBQW1CLENBQUM7WUFDOUIsU0FBUyxFQUFFLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUM7U0FDckMsQ0FBQyxDQUFDLENBQUM7UUFFSixVQUFVO1FBQ1YsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxvQkFBb0IsRUFBRTtZQUM1QyxLQUFLLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxzQkFBc0I7WUFDN0MsVUFBVSxFQUFFLHlCQUF5QjtTQUN0QyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUFyR0QsMENBcUdDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcclxuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XHJcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcclxuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcclxuaW1wb3J0ICogYXMgb3BlbnNlYXJjaHNlcnZlcmxlc3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLW9wZW5zZWFyY2hzZXJ2ZXJsZXNzJztcclxuXHJcbmV4cG9ydCBjbGFzcyBPcGVuU2VhcmNoU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xyXG4gIHB1YmxpYyByZWFkb25seSBjb2xsZWN0aW9uOiBvcGVuc2VhcmNoc2VydmVybGVzcy5DZm5Db2xsZWN0aW9uO1xyXG4gIHB1YmxpYyByZWFkb25seSBiZWRyb2NrUm9sZTogaWFtLlJvbGU7XHJcbiAgcHVibGljIHJlYWRvbmx5IGRhdGFCdWNrZXQ6IHMzLkJ1Y2tldDtcclxuICBwdWJsaWMgcmVhZG9ubHkgZGF0YUFjY2Vzc1BvbGljeTogb3BlbnNlYXJjaHNlcnZlcmxlc3MuQ2ZuQWNjZXNzUG9saWN5O1xyXG5cclxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IGNkay5TdGFja1Byb3BzKSB7XHJcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcclxuICAgIGNvbnN0IGNvbGxlY3Rpb25OYW1lID0gXCJ1bml0eS1rYi1jb2xsZWN0aW9uXCJcclxuXHJcbiAgICAvLyBTMyBidWNrZXQgZm9yIGtub3dsZWRnZSBiYXNlIGRhdGFcclxuICAgIHRoaXMuZGF0YUJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ0tub3dsZWRnZUJhc2VCdWNrZXQnLCB7XHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1lcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIElBTSByb2xlIGZvciBCZWRyb2NrXHJcbiAgICB0aGlzLmJlZHJvY2tSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdCZWRyb2NrS25vd2xlZGdlQmFzZVJvbGUnLCB7XHJcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdiZWRyb2NrLmFtYXpvbmF3cy5jb20nKSxcclxuICAgICAgaW5saW5lUG9saWNpZXM6IHtcclxuICAgICAgICBCZWRyb2NrUG9saWN5OiBuZXcgaWFtLlBvbGljeURvY3VtZW50KHtcclxuICAgICAgICAgIHN0YXRlbWVudHM6IFtcclxuICAgICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICAgICAgICAgIGFjdGlvbnM6IFsnYmVkcm9jazpJbnZva2VNb2RlbCddLFxyXG4gICAgICAgICAgICAgIHJlc291cmNlczogWydhcm46YXdzOmJlZHJvY2s6Kjo6Zm91bmRhdGlvbi1tb2RlbC9hbWF6b24udGl0YW4tZW1iZWQtdGV4dC12MjowJ11cclxuICAgICAgICAgICAgfSlcclxuICAgICAgICAgIF1cclxuICAgICAgICB9KVxyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLmRhdGFCdWNrZXQuZ3JhbnRSZWFkKHRoaXMuYmVkcm9ja1JvbGUpO1xyXG5cclxuICAgIC8vIE9wZW5TZWFyY2ggU2VydmVybGVzcyBwb2xpY2llc1xyXG4gICAgY29uc3QgZW5jcnlwdGlvblBvbGljeSA9IG5ldyBvcGVuc2VhcmNoc2VydmVybGVzcy5DZm5TZWN1cml0eVBvbGljeSh0aGlzLCAnRW5jcnlwdGlvblBvbGljeScsIHtcclxuICAgICAgbmFtZTogJ3VuaXR5LWtiLWVuY3J5cHRpb24tcG9saWN5JyxcclxuICAgICAgdHlwZTogJ2VuY3J5cHRpb24nLFxyXG4gICAgICBwb2xpY3k6IEpTT04uc3RyaW5naWZ5KHtcclxuICAgICAgICBSdWxlczogW3sgUmVzb3VyY2VUeXBlOiAnY29sbGVjdGlvbicsIFJlc291cmNlOiBbYGNvbGxlY3Rpb24vJHtjb2xsZWN0aW9uTmFtZX1gXSB9XSxcclxuICAgICAgICBBV1NPd25lZEtleTogdHJ1ZVxyXG4gICAgICB9KVxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgbmV0d29ya1BvbGljeSA9IG5ldyBvcGVuc2VhcmNoc2VydmVybGVzcy5DZm5TZWN1cml0eVBvbGljeSh0aGlzLCAnTmV0d29ya1BvbGljeScsIHtcclxuICAgICAgbmFtZTogJ3VuaXR5LWtiLW5ldHdvcmstcG9saWN5JyxcclxuICAgICAgdHlwZTogJ25ldHdvcmsnLFxyXG4gICAgICBwb2xpY3k6IEpTT04uc3RyaW5naWZ5KFt7XHJcbiAgICAgICAgUnVsZXM6IFtcclxuICAgICAgICAgIHsgUmVzb3VyY2VUeXBlOiAnY29sbGVjdGlvbicsIFJlc291cmNlOiBbYGNvbGxlY3Rpb24vJHtjb2xsZWN0aW9uTmFtZX1gXSB9LFxyXG4gICAgICAgICAgeyBSZXNvdXJjZVR5cGU6ICdkYXNoYm9hcmQnLCBSZXNvdXJjZTogW2Bjb2xsZWN0aW9uLyR7Y29sbGVjdGlvbk5hbWV9YF0gfVxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgQWxsb3dGcm9tUHVibGljOiB0cnVlXHJcbiAgICAgIH1dKVxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gT3BlblNlYXJjaCBjb2xsZWN0aW9uXHJcbiAgICB0aGlzLmNvbGxlY3Rpb24gPSBuZXcgb3BlbnNlYXJjaHNlcnZlcmxlc3MuQ2ZuQ29sbGVjdGlvbih0aGlzLCAnQ29sbGVjdGlvbicsIHtcclxuICAgICAgbmFtZTogY29sbGVjdGlvbk5hbWUsXHJcbiAgICAgIHR5cGU6ICdWRUNUT1JTRUFSQ0gnXHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLmNvbGxlY3Rpb24uYWRkRGVwZW5kZW5jeShlbmNyeXB0aW9uUG9saWN5KTtcclxuICAgIHRoaXMuY29sbGVjdGlvbi5hZGREZXBlbmRlbmN5KG5ldHdvcmtQb2xpY3kpO1xyXG5cclxuICAgIC8vIERhdGEgYWNjZXNzIHBvbGljeVxyXG4gICAgdGhpcy5kYXRhQWNjZXNzUG9saWN5ID0gbmV3IG9wZW5zZWFyY2hzZXJ2ZXJsZXNzLkNmbkFjY2Vzc1BvbGljeSh0aGlzLCAnRGF0YUFjY2Vzc1BvbGljeScsIHtcclxuICAgICAgbmFtZTogJ3VuaXR5LWtiLWRhdGEtYWNjZXNzLXBvbGljeScsXHJcbiAgICAgIHR5cGU6ICdkYXRhJyxcclxuICAgICAgcG9saWN5OiBKU09OLnN0cmluZ2lmeShbe1xyXG4gICAgICAgIFJ1bGVzOiBbXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIFJlc291cmNlVHlwZTogJ2NvbGxlY3Rpb24nLFxyXG4gICAgICAgICAgICBSZXNvdXJjZTogW2Bjb2xsZWN0aW9uLyR7Y29sbGVjdGlvbk5hbWV9YF0sXHJcbiAgICAgICAgICAgIFBlcm1pc3Npb246IFsnYW9zczpDcmVhdGVDb2xsZWN0aW9uSXRlbXMnLCAnYW9zczpEZWxldGVDb2xsZWN0aW9uSXRlbXMnLCAnYW9zczpVcGRhdGVDb2xsZWN0aW9uSXRlbXMnLCAnYW9zczpEZXNjcmliZUNvbGxlY3Rpb25JdGVtcyddXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICBSZXNvdXJjZVR5cGU6ICdpbmRleCcsXHJcbiAgICAgICAgICAgIFJlc291cmNlOiBbYGluZGV4LyR7Y29sbGVjdGlvbk5hbWV9LypgXSxcclxuICAgICAgICAgICAgUGVybWlzc2lvbjogWydhb3NzOkNyZWF0ZUluZGV4JywgJ2Fvc3M6RGVsZXRlSW5kZXgnLCAnYW9zczpVcGRhdGVJbmRleCcsICdhb3NzOkRlc2NyaWJlSW5kZXgnLCAnYW9zczpSZWFkRG9jdW1lbnQnLCAnYW9zczpXcml0ZURvY3VtZW50J11cclxuICAgICAgICAgIH1cclxuICAgICAgICBdLFxyXG4gICAgICAgIFByaW5jaXBhbDogW1xyXG4gICAgICAgICAgdGhpcy5iZWRyb2NrUm9sZS5yb2xlQXJuLFxyXG4gICAgICAgICAgYGFybjphd3M6aWFtOjoke3RoaXMuYWNjb3VudH06cm9vdGBcclxuICAgICAgICBdXHJcbiAgICAgIH1dKVxyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5kYXRhQWNjZXNzUG9saWN5Lm5vZGUuYWRkRGVwZW5kZW5jeSh0aGlzLmNvbGxlY3Rpb24pO1xyXG5cclxuICAgIC8vIEdyYW50IE9wZW5TZWFyY2ggYWNjZXNzIHRvIEJlZHJvY2sgcm9sZVxyXG4gICAgdGhpcy5iZWRyb2NrUm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgIGFjdGlvbnM6IFsnYW9zczpBUElBY2Nlc3NBbGwnXSxcclxuICAgICAgcmVzb3VyY2VzOiBbdGhpcy5jb2xsZWN0aW9uLmF0dHJBcm5dXHJcbiAgICB9KSk7XHJcblxyXG4gICAgLy8gT3V0cHV0c1xyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0NvbGxlY3Rpb25FbmRwb2ludCcsIHtcclxuICAgICAgdmFsdWU6IHRoaXMuY29sbGVjdGlvbi5hdHRyQ29sbGVjdGlvbkVuZHBvaW50LFxyXG4gICAgICBleHBvcnROYW1lOiAnVW5pdHlDb2xsZWN0aW9uRW5kcG9pbnQnXHJcbiAgICB9KTtcclxuICB9XHJcbn1cclxuIl19