import * as cdk from "aws-cdk-lib"
import { DBStack } from "../lib/DBstack"; // Import your DBStack
import { APIStack } from "../lib/api-stack"; // Import your APIStack
import { FrontendDeploymentStack } from "../lib/frontend-deployment-stack";
import { OpenSearchStack } from '../lib/opensearch_stack';
import { BedrockStack } from '../lib/bedrock_stack';
import { IndexStack } from '../lib/index_stack';
 
const app = new cdk.App();
 
// Create the DBStack
const dbStack = new DBStack(app, "Unity-DBStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
  }
});
 
const openSearchStack = new OpenSearchStack(app, 'Unity-OpenSearchStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
  }
});
 
const indexStack = new IndexStack(app, 'Unity-IndexStack', {
  openSearchStack,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
  }
});
 
const bedrockStack = new BedrockStack(app, 'Unity-BedrockStack', {
  openSearchStack,
  indexStack,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
  }
});
 
indexStack.addDependency(openSearchStack);
bedrockStack.addDependency(indexStack);
 
// Create the APIStack, passing in the DBStack as a dependency
new APIStack(app, "Unity-APIStack", {
  dbStack,
  bedrockStack,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
  }
});
 
new FrontendDeploymentStack(app, "Unity-FrontendDeploymentStack");