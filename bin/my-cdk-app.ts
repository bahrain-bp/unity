import * as cdk from "aws-cdk-lib"
import { DBStack } from "../lib/DBstack"; // Import your DBStack
import { APIStack } from "../lib/api-stack"; // Import your APIStack
import { FrontendDeploymentStack } from "../lib/frontend-deployment-stack";
import { OpenSearchStack } from '../lib/opensearch_stack';
import { BedrockStack } from '../lib/bedrock_stack';
import { IndexStack } from '../lib/index_stack';
import { IoTStack } from "../lib/IoTStack";

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || "us-east-1",
};

// 1) DB stack (all tables)
const dbStack = new DBStack(app, "Unity-DBStack", { env });

// 2) API stack (Cognito + API Gateway + Lambdas)
// const apiStack = new APIStack(app, "Unity-APIStack", dbStack, { env });

// 3) IoT stack (Things + policy + rule + ingest Lambda)
const iotStack = new IoTStack(app, "Unity-IoTStack", dbStack, { env });

// 4) OpenSearch + Index + Bedrock
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

// 5) Frontend deployment
new FrontendDeploymentStack(app, "Unity-FrontendDeploymentStack");
 
// Create the APIStack, passing in the DBStack as a dependency
new APIStack(app, "Unity-APIStack", {
  dbStack,
  bedrockStack,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
  }
});
 