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
const cdk = __importStar(require("aws-cdk-lib"));
const DBstack_1 = require("../lib/DBstack");
const api_stack_1 = require("../lib/api-stack");
const frontend_deployment_stack_1 = require("../lib/frontend-deployment-stack");
const opensearch_stack_1 = require("../lib/opensearch_stack");
const bedrock_stack_1 = require("../lib/bedrock_stack");
const index_stack_1 = require("../lib/index_stack");
const FacialRecognitionStack_1 = require("../lib/FacialRecognitionStack");
const VisitorFeedbackStack_1 = require("../lib/VisitorFeedbackStack");
const IoTStack_1 = require("../lib/IoTStack");
const unity_websocket_stack_1 = require("../lib/unity-websocket-stack");
const BuildUploadStack_1 = require("../lib/BuildUploadStack");
const app = new cdk.App();
const environment = app.node.tryGetContext('environment') || 'dev';
const stackNamePrefix = `${environment}`;
const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || "us-east-1",
};
// 1) DB stack (all tables)
const dbStack = new DBstack_1.DBStack(app, `${stackNamePrefix}-Unity-DBStack`, { env });
// 2) WebSocket stack
const wsStack = new unity_websocket_stack_1.UnityWebSocketStack(app, `${stackNamePrefix}-UnityWebSocketStack`, {
    env,
    dbStack,
});
// // 3) IoT stack (Things + policy + rule + ingest Lambda + WS broadcast)
const iotStack = new IoTStack_1.IoTStack(app, `${stackNamePrefix}-Unity-IoTStack`, {
    env,
    dbStack,
    wsStack,
});
// 4) OpenSearch + Index + Bedrock
const openSearchStack = new opensearch_stack_1.OpenSearchStack(app, `${stackNamePrefix}-Unity-OpenSearchStack`, { env });
const indexStack = new index_stack_1.IndexStack(app, `${stackNamePrefix}-Unity-IndexStack`, {
    openSearchStack,
    env,
});
const bedrockStack = new bedrock_stack_1.BedrockStack(app, `${stackNamePrefix}-Unity-BedrockStack`, {
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
const frontendStack = new frontend_deployment_stack_1.FrontendDeploymentStack(app, `${stackNamePrefix}-Unity-FrontendDeploymentStack`, {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION || "us-east-1",
    },
});
// 6) API stack (Cognito + API Gateway + Lambdas)
new api_stack_1.APIStack(app, `${stackNamePrefix}-Unity-APIStack`, {
    dbStack,
    bedrockStack,
    wsStack,
    env,
});
const FRStack = new FacialRecognitionStack_1.FacialRecognitionStack(app, `${stackNamePrefix}-Unity-FacialRecognitionStack`, {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
    },
});
new VisitorFeedbackStack_1.VisitorFeedbackStack(app, `${stackNamePrefix}-VisitorFeedbackStack`, {
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION || 'us-east-1' },
    userTable: FRStack.userTable,
    broadcastLambda: FRStack.broadcastLambda
});
// Build Upload Stack
new BuildUploadStack_1.BuildUploadStack(app, `${stackNamePrefix}-Unity-BuildUploadStack`, {
    frontendBucketName: frontendStack.frontendBucket.bucketName,
    cloudfrontDistributionId: frontendStack.distribution.distributionId, // ✅
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION || "us-east-1",
    },
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXktY2RrLWFwcC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm15LWNkay1hcHAudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFrQztBQUNsQyw0Q0FBeUM7QUFDekMsZ0RBQTRDO0FBQzVDLGdGQUEyRTtBQUMzRSw4REFBMEQ7QUFDMUQsd0RBQW9EO0FBQ3BELG9EQUFnRDtBQUNoRCwwRUFBdUU7QUFDdkUsc0VBQW1FO0FBRW5FLDhDQUEyQztBQUMzQyx3RUFBbUU7QUFDbkUsOERBQTJEO0FBRTNELE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBRTFCLE1BQU0sV0FBVyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxJQUFJLEtBQUssQ0FBQztBQUVuRSxNQUFNLGVBQWUsR0FBRyxHQUFHLFdBQVcsRUFBRSxDQUFDO0FBRXpDLE1BQU0sR0FBRyxHQUFHO0lBQ1YsT0FBTyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CO0lBQ3hDLE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixJQUFJLFdBQVc7Q0FDdEQsQ0FBQztBQUVGLDJCQUEyQjtBQUMzQixNQUFNLE9BQU8sR0FBRyxJQUFJLGlCQUFPLENBQUMsR0FBRyxFQUFFLEdBQUcsZUFBZSxnQkFBZ0IsRUFBRSxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUM7QUFFOUUscUJBQXFCO0FBQ3JCLE1BQU0sT0FBTyxHQUFHLElBQUksMkNBQW1CLENBQUMsR0FBRyxFQUFFLEdBQUcsZUFBZSxzQkFBc0IsRUFBRTtJQUNyRixHQUFHO0lBQ0gsT0FBTztDQUNSLENBQUMsQ0FBQztBQUVILDBFQUEwRTtBQUMxRSxNQUFNLFFBQVEsR0FBRyxJQUFJLG1CQUFRLENBQUMsR0FBRyxFQUFFLEdBQUcsZUFBZSxpQkFBaUIsRUFBRTtJQUN0RSxHQUFHO0lBQ0gsT0FBTztJQUNQLE9BQU87Q0FDUixDQUFDLENBQUM7QUFFSCxrQ0FBa0M7QUFDbEMsTUFBTSxlQUFlLEdBQUcsSUFBSSxrQ0FBZSxDQUFDLEdBQUcsRUFBRSxHQUFHLGVBQWUsd0JBQXdCLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDO0FBRXRHLE1BQU0sVUFBVSxHQUFHLElBQUksd0JBQVUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxlQUFlLG1CQUFtQixFQUFFO0lBQzVFLGVBQWU7SUFDZixHQUFHO0NBQ0osQ0FBQyxDQUFDO0FBRUgsTUFBTSxZQUFZLEdBQUcsSUFBSSw0QkFBWSxDQUFDLEdBQUcsRUFBRSxHQUFHLGVBQWUscUJBQXFCLEVBQUU7SUFDbEYsZUFBZTtJQUNmLFVBQVU7SUFDVixPQUFPO0lBQ1AsR0FBRyxFQUFFO1FBQ0gsT0FBTyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CO1FBQ3hDLE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixJQUFJLFdBQVc7S0FDdEQ7Q0FDRixDQUFDLENBQUM7QUFFSCxVQUFVLENBQUMsYUFBYSxDQUFDLGVBQWUsQ0FBQyxDQUFDO0FBQzFDLFlBQVksQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUFDLENBQUM7QUFFdkMseUJBQXlCO0FBQ3pCLE1BQU0sYUFBYSxHQUFHLElBQUksbURBQXVCLENBQy9DLEdBQUcsRUFDSCxHQUFHLGVBQWUsZ0NBQWdDLEVBQ2xEO0lBQ0UsR0FBRyxFQUFFO1FBQ0gsT0FBTyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CO1FBQ3hDLE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixJQUFJLFdBQVc7S0FDdEQ7Q0FDRixDQUNGLENBQUM7QUFFRixpREFBaUQ7QUFDakQsSUFBSSxvQkFBUSxDQUFDLEdBQUcsRUFBRSxHQUFHLGVBQWUsaUJBQWlCLEVBQUU7SUFDckQsT0FBTztJQUNQLFlBQVk7SUFDWixPQUFPO0lBQ1AsR0FBRztDQUNKLENBQUMsQ0FBQztBQUdILE1BQU0sT0FBTyxHQUFHLElBQUksK0NBQXNCLENBQUMsR0FBRyxFQUFFLEdBQUcsZUFBZSwrQkFBK0IsRUFBRTtJQUNqRyxHQUFHLEVBQUU7UUFDSCxPQUFPLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUI7UUFDeEMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCLElBQUksV0FBVztLQUN0RDtDQUNGLENBQUMsQ0FBQztBQUVILElBQUksMkNBQW9CLENBQUMsR0FBRyxFQUFFLEdBQUcsZUFBZSx1QkFBdUIsRUFBRTtJQUN2RSxHQUFHLEVBQUUsRUFBRSxPQUFPLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUIsRUFBRSxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsSUFBSSxXQUFXLEVBQUU7SUFDeEcsU0FBUyxFQUFFLE9BQU8sQ0FBQyxTQUFTO0lBQzVCLGVBQWUsRUFBRSxPQUFPLENBQUMsZUFBZTtDQUN6QyxDQUFDLENBQUM7QUFFSCxxQkFBcUI7QUFDckIsSUFBSSxtQ0FBZ0IsQ0FBQyxHQUFHLEVBQUUsR0FBRyxlQUFlLHlCQUF5QixFQUFFO0lBQ3JFLGtCQUFrQixFQUFFLGFBQWEsQ0FBQyxjQUFjLENBQUMsVUFBVTtJQUMzRCx3QkFBd0IsRUFBRSxhQUFhLENBQUMsWUFBWSxDQUFDLGNBQWMsRUFBRyxJQUFJO0lBQzFFLEdBQUcsRUFBRTtRQUNILE9BQU8sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQjtRQUN4QyxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsSUFBSSxXQUFXO0tBQ3REO0NBQ0YsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gXCJhd3MtY2RrLWxpYlwiXHJcbmltcG9ydCB7IERCU3RhY2sgfSBmcm9tIFwiLi4vbGliL0RCc3RhY2tcIjsgXHJcbmltcG9ydCB7IEFQSVN0YWNrIH0gZnJvbSBcIi4uL2xpYi9hcGktc3RhY2tcIjtcclxuaW1wb3J0IHsgRnJvbnRlbmREZXBsb3ltZW50U3RhY2sgfSBmcm9tIFwiLi4vbGliL2Zyb250ZW5kLWRlcGxveW1lbnQtc3RhY2tcIjtcclxuaW1wb3J0IHsgT3BlblNlYXJjaFN0YWNrIH0gZnJvbSAnLi4vbGliL29wZW5zZWFyY2hfc3RhY2snO1xyXG5pbXBvcnQgeyBCZWRyb2NrU3RhY2sgfSBmcm9tICcuLi9saWIvYmVkcm9ja19zdGFjayc7XHJcbmltcG9ydCB7IEluZGV4U3RhY2sgfSBmcm9tICcuLi9saWIvaW5kZXhfc3RhY2snO1xyXG5pbXBvcnQgeyBGYWNpYWxSZWNvZ25pdGlvblN0YWNrIH0gZnJvbSBcIi4uL2xpYi9GYWNpYWxSZWNvZ25pdGlvblN0YWNrXCI7XHJcbmltcG9ydCB7IFZpc2l0b3JGZWVkYmFja1N0YWNrIH0gZnJvbSBcIi4uL2xpYi9WaXNpdG9yRmVlZGJhY2tTdGFja1wiO1xyXG5cclxuaW1wb3J0IHsgSW9UU3RhY2sgfSBmcm9tIFwiLi4vbGliL0lvVFN0YWNrXCI7XHJcbmltcG9ydCB7IFVuaXR5V2ViU29ja2V0U3RhY2sgfSBmcm9tIFwiLi4vbGliL3VuaXR5LXdlYnNvY2tldC1zdGFja1wiO1xyXG5pbXBvcnQgeyBCdWlsZFVwbG9hZFN0YWNrIH0gZnJvbSBcIi4uL2xpYi9CdWlsZFVwbG9hZFN0YWNrXCI7IFxyXG5cclxuY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKTtcclxuXHJcbmNvbnN0IGVudmlyb25tZW50ID0gYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgnZW52aXJvbm1lbnQnKSB8fCAnZGV2JztcclxuXHJcbmNvbnN0IHN0YWNrTmFtZVByZWZpeCA9IGAke2Vudmlyb25tZW50fWA7XHJcblxyXG5jb25zdCBlbnYgPSB7XHJcbiAgYWNjb3VudDogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfQUNDT1VOVCxcclxuICByZWdpb246IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX1JFR0lPTiB8fCBcInVzLWVhc3QtMVwiLFxyXG59O1xyXG5cclxuLy8gMSkgREIgc3RhY2sgKGFsbCB0YWJsZXMpXHJcbmNvbnN0IGRiU3RhY2sgPSBuZXcgREJTdGFjayhhcHAsIGAke3N0YWNrTmFtZVByZWZpeH0tVW5pdHktREJTdGFja2AsIHsgZW52IH0pO1xyXG5cclxuLy8gMikgV2ViU29ja2V0IHN0YWNrXHJcbmNvbnN0IHdzU3RhY2sgPSBuZXcgVW5pdHlXZWJTb2NrZXRTdGFjayhhcHAsIGAke3N0YWNrTmFtZVByZWZpeH0tVW5pdHlXZWJTb2NrZXRTdGFja2AsIHtcclxuICBlbnYsXHJcbiAgZGJTdGFjayxcclxufSk7XHJcblxyXG4vLyAvLyAzKSBJb1Qgc3RhY2sgKFRoaW5ncyArIHBvbGljeSArIHJ1bGUgKyBpbmdlc3QgTGFtYmRhICsgV1MgYnJvYWRjYXN0KVxyXG5jb25zdCBpb3RTdGFjayA9IG5ldyBJb1RTdGFjayhhcHAsIGAke3N0YWNrTmFtZVByZWZpeH0tVW5pdHktSW9UU3RhY2tgLCB7XHJcbiAgZW52LFxyXG4gIGRiU3RhY2ssXHJcbiAgd3NTdGFjayxcclxufSk7XHJcblxyXG4vLyA0KSBPcGVuU2VhcmNoICsgSW5kZXggKyBCZWRyb2NrXHJcbmNvbnN0IG9wZW5TZWFyY2hTdGFjayA9IG5ldyBPcGVuU2VhcmNoU3RhY2soYXBwLCBgJHtzdGFja05hbWVQcmVmaXh9LVVuaXR5LU9wZW5TZWFyY2hTdGFja2AsIHsgZW52IH0pO1xyXG5cclxuY29uc3QgaW5kZXhTdGFjayA9IG5ldyBJbmRleFN0YWNrKGFwcCwgYCR7c3RhY2tOYW1lUHJlZml4fS1Vbml0eS1JbmRleFN0YWNrYCwge1xyXG4gIG9wZW5TZWFyY2hTdGFjayxcclxuICBlbnYsXHJcbn0pO1xyXG5cclxuY29uc3QgYmVkcm9ja1N0YWNrID0gbmV3IEJlZHJvY2tTdGFjayhhcHAsIGAke3N0YWNrTmFtZVByZWZpeH0tVW5pdHktQmVkcm9ja1N0YWNrYCwge1xyXG4gIG9wZW5TZWFyY2hTdGFjayxcclxuICBpbmRleFN0YWNrLFxyXG4gIGRiU3RhY2ssXHJcbiAgZW52OiB7XHJcbiAgICBhY2NvdW50OiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9BQ0NPVU5ULFxyXG4gICAgcmVnaW9uOiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9SRUdJT04gfHwgJ3VzLWVhc3QtMSdcclxuICB9XHJcbn0pO1xyXG5cclxuaW5kZXhTdGFjay5hZGREZXBlbmRlbmN5KG9wZW5TZWFyY2hTdGFjayk7XHJcbmJlZHJvY2tTdGFjay5hZGREZXBlbmRlbmN5KGluZGV4U3RhY2spO1xyXG5cclxuLy8gNSkgRnJvbnRlbmQgZGVwbG95bWVudFxyXG5jb25zdCBmcm9udGVuZFN0YWNrID0gbmV3IEZyb250ZW5kRGVwbG95bWVudFN0YWNrKFxyXG4gIGFwcCxcclxuICBgJHtzdGFja05hbWVQcmVmaXh9LVVuaXR5LUZyb250ZW5kRGVwbG95bWVudFN0YWNrYCxcclxuICB7XHJcbiAgICBlbnY6IHtcclxuICAgICAgYWNjb3VudDogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfQUNDT1VOVCxcclxuICAgICAgcmVnaW9uOiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9SRUdJT04gfHwgXCJ1cy1lYXN0LTFcIixcclxuICAgIH0sXHJcbiAgfVxyXG4pO1xyXG5cclxuLy8gNikgQVBJIHN0YWNrIChDb2duaXRvICsgQVBJIEdhdGV3YXkgKyBMYW1iZGFzKVxyXG5uZXcgQVBJU3RhY2soYXBwLCBgJHtzdGFja05hbWVQcmVmaXh9LVVuaXR5LUFQSVN0YWNrYCwge1xyXG4gIGRiU3RhY2ssXHJcbiAgYmVkcm9ja1N0YWNrLFxyXG4gIHdzU3RhY2ssXHJcbiAgZW52LFxyXG59KTtcclxuXHJcblxyXG5jb25zdCBGUlN0YWNrID0gbmV3IEZhY2lhbFJlY29nbml0aW9uU3RhY2soYXBwLCBgJHtzdGFja05hbWVQcmVmaXh9LVVuaXR5LUZhY2lhbFJlY29nbml0aW9uU3RhY2tgLCB7XHJcbiAgZW52OiB7XHJcbiAgICBhY2NvdW50OiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9BQ0NPVU5ULFxyXG4gICAgcmVnaW9uOiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9SRUdJT04gfHwgJ3VzLWVhc3QtMScsXHJcbiAgfSxcclxufSk7XHJcblxyXG5uZXcgVmlzaXRvckZlZWRiYWNrU3RhY2soYXBwLCBgJHtzdGFja05hbWVQcmVmaXh9LVZpc2l0b3JGZWVkYmFja1N0YWNrYCwge1xyXG4gIGVudjogeyBhY2NvdW50OiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9BQ0NPVU5ULCByZWdpb246IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX1JFR0lPTiB8fCAndXMtZWFzdC0xJyB9LFxyXG4gIHVzZXJUYWJsZTogRlJTdGFjay51c2VyVGFibGUsIFxyXG4gIGJyb2FkY2FzdExhbWJkYTogRlJTdGFjay5icm9hZGNhc3RMYW1iZGFcclxufSk7XHJcblxyXG4vLyBCdWlsZCBVcGxvYWQgU3RhY2tcclxubmV3IEJ1aWxkVXBsb2FkU3RhY2soYXBwLCBgJHtzdGFja05hbWVQcmVmaXh9LVVuaXR5LUJ1aWxkVXBsb2FkU3RhY2tgLCB7XHJcbiAgZnJvbnRlbmRCdWNrZXROYW1lOiBmcm9udGVuZFN0YWNrLmZyb250ZW5kQnVja2V0LmJ1Y2tldE5hbWUsXHJcbiAgY2xvdWRmcm9udERpc3RyaWJ1dGlvbklkOiBmcm9udGVuZFN0YWNrLmRpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25JZCwgIC8vIOKchVxyXG4gIGVudjoge1xyXG4gICAgYWNjb3VudDogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfQUNDT1VOVCxcclxuICAgIHJlZ2lvbjogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfUkVHSU9OIHx8IFwidXMtZWFzdC0xXCIsXHJcbiAgfSxcclxufSk7Il19