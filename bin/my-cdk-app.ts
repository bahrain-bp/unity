import * as cdk from "aws-cdk-lib";
import { MyCdkStack } from "../lib/my-cdk-app-stack";
import { DBStack } from "../lib/DBstack"; // Import your DBStack
import { APIStack } from "../lib/api-stack"; // Import your APIStack
import { OpenSearchStack } from '../lib/opensearch_stack';
import { BedrockStack } from '../lib/bedrock_stack';
import { IndexStack } from '../lib/index_stack';

const app = new cdk.App();

// Create the DBStack
const dbStack = new DBStack(app, "DBStack", {
  // Any custom stack props you may have for DBStack
});

// Create the APIStack, passing in the DBStack as a dependency
new APIStack(app, "APIStack", dbStack); // Pass the DBStack as the second argument

// Optionally, you can create your other stacks here if needed
new MyCdkStack(app, "MyCdkAppStack");



const openSearchStack = new OpenSearchStack(app, 'OpenSearchStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
  }
});

const indexStack = new IndexStack(app, 'IndexStack', {
  openSearchStack,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
  }
});

const bedrockStack = new BedrockStack(app, 'BedrockStack', {
  openSearchStack,
  indexStack,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
  }
});

indexStack.addDependency(openSearchStack);
bedrockStack.addDependency(indexStack);