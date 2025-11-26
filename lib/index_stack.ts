import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as opensearchserverless from 'aws-cdk-lib/aws-opensearchserverless';
import { OpenSearchStack } from './opensearch_stack';

interface IndexStackProps extends cdk.StackProps {
  openSearchStack: OpenSearchStack;
}

export class IndexStack extends cdk.Stack {
  public readonly vectorIndex: opensearchserverless.CfnIndex;

  constructor(scope: Construct, id: string, props: IndexStackProps) {
    super(scope, id, props);

    const { collection, dataAccessPolicy } = props.openSearchStack;

    // Vector index
    this.vectorIndex = new opensearchserverless.CfnIndex(this, 'VectorIndex', {
      collectionEndpoint: collection.attrCollectionEndpoint,
      indexName: 'unity-vector-index',
      mappings: {
        properties: {
          'bedrock-knowledge-base-vector': {
            type: 'knn_vector',
            dimension: 1024,
            method: {
              name: 'hnsw',
              engine: 'faiss',
              spaceType: 'l2'
            }
          },
          'AMAZON_BEDROCK_TEXT_CHUNK': { type: 'text' },
          'AMAZON_BEDROCK_METADATA': { type: 'text', index: false }
        }
      },
      settings: {
        index: { knn: true }
      }
    });

    this.vectorIndex.node.addDependency(dataAccessPolicy);

    // Output
    new cdk.CfnOutput(this, 'IndexName', {
      value: this.vectorIndex.indexName!,
      exportName: 'UnityIndexName'
    });
  }
}
