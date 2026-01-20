import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as opensearchserverless from 'aws-cdk-lib/aws-opensearchserverless';

export class OpenSearchStack extends cdk.Stack {
  public readonly collection: opensearchserverless.CfnCollection;
  public readonly bedrockRole: iam.Role;
  public readonly dataBucket: s3.Bucket;
  public readonly dataAccessPolicy: opensearchserverless.CfnAccessPolicy;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
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
