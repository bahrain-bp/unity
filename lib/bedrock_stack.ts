import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as bedrock from "aws-cdk-lib/aws-bedrock";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import { OpenSearchStack } from "./opensearch_stack";
import { IndexStack } from "./index_stack";
import { DBStack } from "./DBstack";

interface BedrockStackProps extends cdk.StackProps {
  openSearchStack: OpenSearchStack;
  indexStack: IndexStack;
  dbStack: DBStack;
}

export class BedrockStack extends cdk.Stack {
  public readonly knowledgeBase: bedrock.CfnKnowledgeBase;
  public readonly lambdaFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: BedrockStackProps) {
    super(scope, id, props);
    const prefixname = this.stackName.split('-')[0].toLowerCase();

    const { collection, bedrockRole, dataBucket } = props.openSearchStack;
    const { vectorIndex } = props.indexStack;
    const { chatbotTable } = props.dbStack;

    // Knowledge Base
    this.knowledgeBase = new bedrock.CfnKnowledgeBase(this, "KnowledgeBase", {
      name: `${prefixname}-knowledge-base`,
      roleArn: bedrockRole.roleArn,
      knowledgeBaseConfiguration: {
        type: "VECTOR",
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn:
            "arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0",
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
          vectorIndexName: vectorIndex.indexName!,
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
    this.lambdaFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "bedrock:InvokeModel",
          "bedrock:Retrieve",
          "bedrock:RetrieveAndGenerate",
        ],
        resources: ["*"],
      })
    );
    chatbotTable.grantReadWriteData(this.lambdaFunction);

    chatbotTable.grantReadWriteData(this.lambdaFunction);

    // Outputs
    new cdk.CfnOutput(this, "KnowledgeBaseId", {
      value: this.knowledgeBase.attrKnowledgeBaseId,
      exportName: `${prefixname}-KnowledgeBaseId`,
    });

    new cdk.CfnOutput(this, "DataBucketName", {
      value: dataBucket.bucketName,
      exportName: `${prefixname}-DataBucketName`,
    });
  }
}
