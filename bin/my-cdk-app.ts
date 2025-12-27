import * as cdk from "aws-cdk-lib"
import { DBStack } from "../lib/DBstack"; 
import { APIStack } from "../lib/api-stack";
import { FrontendDeploymentStack } from "../lib/frontend-deployment-stack";
import { OpenSearchStack } from '../lib/opensearch_stack';
import { BedrockStack } from '../lib/bedrock_stack';
import { IndexStack } from '../lib/index_stack';
import { FacialRecognitionStack } from "../lib/FacialRecognitionStack";
import { VisitorFeedbackStack } from "../lib/VisitorFeedbackStack";
 
import { IoTStack } from "../lib/IoTStack";
import { UnityWebSocketStack } from "../lib/unity-websocket-stack";

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || "us-east-1",
};

// 1) DB stack (all tables)
const dbStack = new DBStack(app, "Unity-DBStack", { env });

// 2) WebSocket stack
const wsStack = new UnityWebSocketStack(app, "UnityWebSocketStack", {
  env,
  dbStack,
});

// 3) IoT stack (Things + policy + rule + ingest Lambda + WS broadcast)
const iotStack = new IoTStack(app, "Unity-IoTStack", {
  env,
  dbStack,
  wsStack,
});

// 4) OpenSearch + Index + Bedrock
const openSearchStack = new OpenSearchStack(app, 'Unity-OpenSearchStack', { env });

const indexStack = new IndexStack(app, 'Unity-IndexStack', {
  openSearchStack,
  env,
});

const bedrockStack = new BedrockStack(app, 'Unity-BedrockStack', {
  openSearchStack,
  indexStack,
  dbStack,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
  }
});

indexStack.addDependency(openSearchStack);
bedrockStack.addDependency(indexStack);

// 5) Frontend deployment
new FrontendDeploymentStack(app, "Unity-FrontendDeploymentStack");

// 6) API stack (Cognito + API Gateway + Lambdas)
new APIStack(app, "Unity-APIStack", {
  dbStack,
  bedrockStack,
  wsStack,
  env,
});


// const FRStack = new FacialRecognitionStack(app, 'FacialRecognitionStack', {
//   env: {
//     account: process.env.CDK_DEFAULT_ACCOUNT,
//     region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
//   },
// });


// new VisitorFeedbackStack(app, 'VisitorFeedbackStack', {
//   env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION || 'us-east-1' },
//   userTable: FRStack.userTable, 
// });
 
//new FrontendDeploymentStack(app, "Unity-FrontendDeploymentStack");
