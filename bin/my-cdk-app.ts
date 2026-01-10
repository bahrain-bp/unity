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
import { BuildUploadStack } from "../lib/BuildUploadStack"; 

const app = new cdk.App();

const environment = app.node.tryGetContext('environment') || 'dev';

const stackNamePrefix = `${environment}`;

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || "us-east-1",
};

// 1) DB stack (all tables)
const dbStack = new DBStack(app, `${stackNamePrefix}-Unity-DBStack`, { env });

// 2) WebSocket stack
const wsStack = new UnityWebSocketStack(app, `${stackNamePrefix}-UnityWebSocketStack`, {
  env,
  dbStack,
});

// // 3) IoT stack (Things + policy + rule + ingest Lambda + WS broadcast)
const iotStack = new IoTStack(app, `${stackNamePrefix}-Unity-IoTStack`, {
  env,
  dbStack,
  wsStack,
});

// 4) OpenSearch + Index + Bedrock
const openSearchStack = new OpenSearchStack(app, `${stackNamePrefix}-Unity-OpenSearchStack`, { env });

const indexStack = new IndexStack(app, `${stackNamePrefix}-Unity-IndexStack`, {
  openSearchStack,
  env,
});

const bedrockStack = new BedrockStack(app, `${stackNamePrefix}-Unity-BedrockStack`, {
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
const frontendStack = new FrontendDeploymentStack(
  app,
  `${stackNamePrefix}-Unity-FrontendDeploymentStack`,
  {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION || "us-east-1",
    },
  }
);

// 6) API stack (Cognito + API Gateway + Lambdas)
new APIStack(app, `${stackNamePrefix}-Unity-APIStack`, {
  dbStack,
  bedrockStack,
  wsStack,
  env,
});


const FRStack = new FacialRecognitionStack(app, `${stackNamePrefix}-Unity-FacialRecognitionStack`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
});

new VisitorFeedbackStack(app, `${stackNamePrefix}-VisitorFeedbackStack`, {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION || 'us-east-1' },
  userTable: FRStack.userTable, 
  broadcastLambda: FRStack.broadcastLambda
});

// Build Upload Stack
new BuildUploadStack(app, `${stackNamePrefix}-Unity-BuildUploadStack`, {
  frontendBucketName: frontendStack.frontendBucket.bucketName,
  cloudfrontDistributionId: frontendStack.distribution.distributionId,  // ✅
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || "us-east-1",
  },
});