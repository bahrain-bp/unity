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
const IoTStack_1 = require("../lib/IoTStack");
const unity_websocket_stack_1 = require("../lib/unity-websocket-stack");
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
// const FRStack = new FacialRecognitionStack(app, `${stackNamePrefix}-Unity-FacialRecognitionStack`, {
//   env: {
//     account: process.env.CDK_DEFAULT_ACCOUNT,
//     region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
//   },
// }
// );
const FRStack = new FacialRecognitionStack_1.FacialRecognitionStack(app, `${stackNamePrefix}-Unity-FacialRecognitionStack`, {
    facialWsConnectionsTable: dbStack.facialWsConnectionsTable,
    env
});
FRStack.addDependency(dbStack);
// 6) API stack (Cognito + API Gateway + Lambdas)
const apistack = new api_stack_1.APIStack(app, `${stackNamePrefix}-Unity-APIStack`, {
    dbStack,
    bedrockStack,
    wsStack,
    frontendStack,
    env,
    broadcastLambda: FRStack.broadcastLambda
});
apistack.addDependency(frontendStack);
// new VisitorFeedbackStack(app, `${stackNamePrefix}-VisitorFeedbackStack`, {
//   env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION || 'us-east-1' },
//   userTable: FRStack.userTable, 
//   broadcastLambda: FRStack.broadcastLambda
// });
// Build Upload Stack
// new BuildUploadStack(app, `${stackNamePrefix}-Unity-BuildUploadStack`, {
//   frontendBucketName: frontendStack.frontendBucket.bucketName,
//   cloudfrontDistributionId: frontendStack.distribution.distributionId,  // ✅
//   env: {
//     account: process.env.CDK_DEFAULT_ACCOUNT,
//     region: process.env.CDK_DEFAULT_REGION || "us-east-1",
//   },
// });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXktY2RrLWFwcC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm15LWNkay1hcHAudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFrQztBQUNsQyw0Q0FBeUM7QUFDekMsZ0RBQTRDO0FBQzVDLGdGQUEyRTtBQUMzRSw4REFBMEQ7QUFDMUQsd0RBQW9EO0FBQ3BELG9EQUFnRDtBQUNoRCwwRUFBdUU7QUFHdkUsOENBQTJDO0FBQzNDLHdFQUFtRTtBQUduRSxNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUUxQixNQUFNLFdBQVcsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsSUFBSSxLQUFLLENBQUM7QUFFbkUsTUFBTSxlQUFlLEdBQUcsR0FBRyxXQUFXLEVBQUUsQ0FBQztBQUV6QyxNQUFNLEdBQUcsR0FBRztJQUNWLE9BQU8sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQjtJQUN4QyxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsSUFBSSxXQUFXO0NBQ3RELENBQUM7QUFFRiwyQkFBMkI7QUFDM0IsTUFBTSxPQUFPLEdBQUcsSUFBSSxpQkFBTyxDQUFDLEdBQUcsRUFBRSxHQUFHLGVBQWUsZ0JBQWdCLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDO0FBRTlFLHFCQUFxQjtBQUNyQixNQUFNLE9BQU8sR0FBRyxJQUFJLDJDQUFtQixDQUFDLEdBQUcsRUFBRSxHQUFHLGVBQWUsc0JBQXNCLEVBQUU7SUFDckYsR0FBRztJQUNILE9BQU87Q0FDUixDQUFDLENBQUM7QUFFSCwwRUFBMEU7QUFDMUUsTUFBTSxRQUFRLEdBQUcsSUFBSSxtQkFBUSxDQUFDLEdBQUcsRUFBRSxHQUFHLGVBQWUsaUJBQWlCLEVBQUU7SUFDdEUsR0FBRztJQUNILE9BQU87SUFDUCxPQUFPO0NBQ1IsQ0FBQyxDQUFDO0FBRUgsa0NBQWtDO0FBQ2xDLE1BQU0sZUFBZSxHQUFHLElBQUksa0NBQWUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxlQUFlLHdCQUF3QixFQUFFLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztBQUV0RyxNQUFNLFVBQVUsR0FBRyxJQUFJLHdCQUFVLENBQUMsR0FBRyxFQUFFLEdBQUcsZUFBZSxtQkFBbUIsRUFBRTtJQUM1RSxlQUFlO0lBQ2YsR0FBRztDQUNKLENBQUMsQ0FBQztBQUVILE1BQU0sWUFBWSxHQUFHLElBQUksNEJBQVksQ0FBQyxHQUFHLEVBQUUsR0FBRyxlQUFlLHFCQUFxQixFQUFFO0lBQ2xGLGVBQWU7SUFDZixVQUFVO0lBQ1YsT0FBTztJQUNQLEdBQUcsRUFBRTtRQUNILE9BQU8sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQjtRQUN4QyxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsSUFBSSxXQUFXO0tBQ3REO0NBQ0YsQ0FBQyxDQUFDO0FBRUgsVUFBVSxDQUFDLGFBQWEsQ0FBQyxlQUFlLENBQUMsQ0FBQztBQUMxQyxZQUFZLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBRXZDLHlCQUF5QjtBQUN6QixNQUFNLGFBQWEsR0FBRyxJQUFJLG1EQUF1QixDQUMvQyxHQUFHLEVBQ0gsR0FBRyxlQUFlLGdDQUFnQyxFQUNsRDtJQUNFLEdBQUcsRUFBRTtRQUNILE9BQU8sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQjtRQUN4QyxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsSUFBSSxXQUFXO0tBQ3REO0NBQ0YsQ0FDRixDQUFDO0FBSUYsdUdBQXVHO0FBQ3ZHLFdBQVc7QUFDWCxnREFBZ0Q7QUFDaEQsNkRBQTZEO0FBQzdELE9BQU87QUFDUCxJQUFJO0FBQ0osS0FBSztBQUVMLE1BQU0sT0FBTyxHQUFHLElBQUksK0NBQXNCLENBQUMsR0FBRyxFQUFFLEdBQUcsZUFBZSwrQkFBK0IsRUFBRTtJQUNqRyx3QkFBd0IsRUFBRSxPQUFPLENBQUMsd0JBQXdCO0lBQzFELEdBQUc7Q0FDSixDQUFDLENBQUM7QUFDSCxPQUFPLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBRy9CLGlEQUFpRDtBQUNqRCxNQUFNLFFBQVEsR0FBRyxJQUFJLG9CQUFRLENBQUMsR0FBRyxFQUFFLEdBQUcsZUFBZSxpQkFBaUIsRUFBRTtJQUN0RSxPQUFPO0lBQ1AsWUFBWTtJQUNaLE9BQU87SUFDUCxhQUFhO0lBQ2IsR0FBRztJQUNILGVBQWUsRUFBRSxPQUFPLENBQUMsZUFBZTtDQUN6QyxDQUFDLENBQUM7QUFFSCxRQUFRLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxDQUFDO0FBRXRDLDZFQUE2RTtBQUM3RSw4R0FBOEc7QUFDOUcsbUNBQW1DO0FBQ25DLDZDQUE2QztBQUM3QyxNQUFNO0FBRU4scUJBQXFCO0FBQ3JCLDJFQUEyRTtBQUMzRSxpRUFBaUU7QUFDakUsK0VBQStFO0FBQy9FLFdBQVc7QUFDWCxnREFBZ0Q7QUFDaEQsNkRBQTZEO0FBQzdELE9BQU87QUFDUCxNQUFNIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gXCJhd3MtY2RrLWxpYlwiXHJcbmltcG9ydCB7IERCU3RhY2sgfSBmcm9tIFwiLi4vbGliL0RCc3RhY2tcIjsgXHJcbmltcG9ydCB7IEFQSVN0YWNrIH0gZnJvbSBcIi4uL2xpYi9hcGktc3RhY2tcIjtcclxuaW1wb3J0IHsgRnJvbnRlbmREZXBsb3ltZW50U3RhY2sgfSBmcm9tIFwiLi4vbGliL2Zyb250ZW5kLWRlcGxveW1lbnQtc3RhY2tcIjtcclxuaW1wb3J0IHsgT3BlblNlYXJjaFN0YWNrIH0gZnJvbSAnLi4vbGliL29wZW5zZWFyY2hfc3RhY2snO1xyXG5pbXBvcnQgeyBCZWRyb2NrU3RhY2sgfSBmcm9tICcuLi9saWIvYmVkcm9ja19zdGFjayc7XHJcbmltcG9ydCB7IEluZGV4U3RhY2sgfSBmcm9tICcuLi9saWIvaW5kZXhfc3RhY2snO1xyXG5pbXBvcnQgeyBGYWNpYWxSZWNvZ25pdGlvblN0YWNrIH0gZnJvbSBcIi4uL2xpYi9GYWNpYWxSZWNvZ25pdGlvblN0YWNrXCI7XHJcbmltcG9ydCB7IFZpc2l0b3JGZWVkYmFja1N0YWNrIH0gZnJvbSBcIi4uL2xpYi9WaXNpdG9yRmVlZGJhY2tTdGFja1wiO1xyXG5cclxuaW1wb3J0IHsgSW9UU3RhY2sgfSBmcm9tIFwiLi4vbGliL0lvVFN0YWNrXCI7XHJcbmltcG9ydCB7IFVuaXR5V2ViU29ja2V0U3RhY2sgfSBmcm9tIFwiLi4vbGliL3VuaXR5LXdlYnNvY2tldC1zdGFja1wiO1xyXG5pbXBvcnQgeyBCdWlsZFVwbG9hZFN0YWNrIH0gZnJvbSBcIi4uL2xpYi9CdWlsZFVwbG9hZFN0YWNrXCI7IFxyXG5cclxuY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKTtcclxuXHJcbmNvbnN0IGVudmlyb25tZW50ID0gYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgnZW52aXJvbm1lbnQnKSB8fCAnZGV2JztcclxuXHJcbmNvbnN0IHN0YWNrTmFtZVByZWZpeCA9IGAke2Vudmlyb25tZW50fWA7XHJcblxyXG5jb25zdCBlbnYgPSB7XHJcbiAgYWNjb3VudDogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfQUNDT1VOVCxcclxuICByZWdpb246IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX1JFR0lPTiB8fCBcInVzLWVhc3QtMVwiLFxyXG59O1xyXG5cclxuLy8gMSkgREIgc3RhY2sgKGFsbCB0YWJsZXMpXHJcbmNvbnN0IGRiU3RhY2sgPSBuZXcgREJTdGFjayhhcHAsIGAke3N0YWNrTmFtZVByZWZpeH0tVW5pdHktREJTdGFja2AsIHsgZW52IH0pO1xyXG5cclxuLy8gMikgV2ViU29ja2V0IHN0YWNrXHJcbmNvbnN0IHdzU3RhY2sgPSBuZXcgVW5pdHlXZWJTb2NrZXRTdGFjayhhcHAsIGAke3N0YWNrTmFtZVByZWZpeH0tVW5pdHlXZWJTb2NrZXRTdGFja2AsIHtcclxuICBlbnYsXHJcbiAgZGJTdGFjayxcclxufSk7XHJcblxyXG4vLyAvLyAzKSBJb1Qgc3RhY2sgKFRoaW5ncyArIHBvbGljeSArIHJ1bGUgKyBpbmdlc3QgTGFtYmRhICsgV1MgYnJvYWRjYXN0KVxyXG5jb25zdCBpb3RTdGFjayA9IG5ldyBJb1RTdGFjayhhcHAsIGAke3N0YWNrTmFtZVByZWZpeH0tVW5pdHktSW9UU3RhY2tgLCB7XHJcbiAgZW52LFxyXG4gIGRiU3RhY2ssXHJcbiAgd3NTdGFjayxcclxufSk7XHJcblxyXG4vLyA0KSBPcGVuU2VhcmNoICsgSW5kZXggKyBCZWRyb2NrXHJcbmNvbnN0IG9wZW5TZWFyY2hTdGFjayA9IG5ldyBPcGVuU2VhcmNoU3RhY2soYXBwLCBgJHtzdGFja05hbWVQcmVmaXh9LVVuaXR5LU9wZW5TZWFyY2hTdGFja2AsIHsgZW52IH0pO1xyXG5cclxuY29uc3QgaW5kZXhTdGFjayA9IG5ldyBJbmRleFN0YWNrKGFwcCwgYCR7c3RhY2tOYW1lUHJlZml4fS1Vbml0eS1JbmRleFN0YWNrYCwge1xyXG4gIG9wZW5TZWFyY2hTdGFjayxcclxuICBlbnYsXHJcbn0pO1xyXG5cclxuY29uc3QgYmVkcm9ja1N0YWNrID0gbmV3IEJlZHJvY2tTdGFjayhhcHAsIGAke3N0YWNrTmFtZVByZWZpeH0tVW5pdHktQmVkcm9ja1N0YWNrYCwge1xyXG4gIG9wZW5TZWFyY2hTdGFjayxcclxuICBpbmRleFN0YWNrLFxyXG4gIGRiU3RhY2ssXHJcbiAgZW52OiB7XHJcbiAgICBhY2NvdW50OiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9BQ0NPVU5ULFxyXG4gICAgcmVnaW9uOiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9SRUdJT04gfHwgJ3VzLWVhc3QtMSdcclxuICB9XHJcbn0pO1xyXG5cclxuaW5kZXhTdGFjay5hZGREZXBlbmRlbmN5KG9wZW5TZWFyY2hTdGFjayk7XHJcbmJlZHJvY2tTdGFjay5hZGREZXBlbmRlbmN5KGluZGV4U3RhY2spO1xyXG5cclxuLy8gNSkgRnJvbnRlbmQgZGVwbG95bWVudFxyXG5jb25zdCBmcm9udGVuZFN0YWNrID0gbmV3IEZyb250ZW5kRGVwbG95bWVudFN0YWNrKFxyXG4gIGFwcCxcclxuICBgJHtzdGFja05hbWVQcmVmaXh9LVVuaXR5LUZyb250ZW5kRGVwbG95bWVudFN0YWNrYCxcclxuICB7XHJcbiAgICBlbnY6IHtcclxuICAgICAgYWNjb3VudDogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfQUNDT1VOVCxcclxuICAgICAgcmVnaW9uOiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9SRUdJT04gfHwgXCJ1cy1lYXN0LTFcIixcclxuICAgIH0sXHJcbiAgfVxyXG4pO1xyXG5cclxuXHJcblxyXG4vLyBjb25zdCBGUlN0YWNrID0gbmV3IEZhY2lhbFJlY29nbml0aW9uU3RhY2soYXBwLCBgJHtzdGFja05hbWVQcmVmaXh9LVVuaXR5LUZhY2lhbFJlY29nbml0aW9uU3RhY2tgLCB7XHJcbi8vICAgZW52OiB7XHJcbi8vICAgICBhY2NvdW50OiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9BQ0NPVU5ULFxyXG4vLyAgICAgcmVnaW9uOiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9SRUdJT04gfHwgJ3VzLWVhc3QtMScsXHJcbi8vICAgfSxcclxuLy8gfVxyXG4vLyApO1xyXG5cclxuY29uc3QgRlJTdGFjayA9IG5ldyBGYWNpYWxSZWNvZ25pdGlvblN0YWNrKGFwcCwgYCR7c3RhY2tOYW1lUHJlZml4fS1Vbml0eS1GYWNpYWxSZWNvZ25pdGlvblN0YWNrYCwge1xyXG4gIGZhY2lhbFdzQ29ubmVjdGlvbnNUYWJsZTogZGJTdGFjay5mYWNpYWxXc0Nvbm5lY3Rpb25zVGFibGUsXHJcbiAgZW52XHJcbn0pO1xyXG5GUlN0YWNrLmFkZERlcGVuZGVuY3koZGJTdGFjayk7XHJcblxyXG5cclxuLy8gNikgQVBJIHN0YWNrIChDb2duaXRvICsgQVBJIEdhdGV3YXkgKyBMYW1iZGFzKVxyXG5jb25zdCBhcGlzdGFjayA9IG5ldyBBUElTdGFjayhhcHAsIGAke3N0YWNrTmFtZVByZWZpeH0tVW5pdHktQVBJU3RhY2tgLCB7XHJcbiAgZGJTdGFjayxcclxuICBiZWRyb2NrU3RhY2ssXHJcbiAgd3NTdGFjayxcclxuICBmcm9udGVuZFN0YWNrLFxyXG4gIGVudixcclxuICBicm9hZGNhc3RMYW1iZGE6IEZSU3RhY2suYnJvYWRjYXN0TGFtYmRhXHJcbn0pO1xyXG5cclxuYXBpc3RhY2suYWRkRGVwZW5kZW5jeShmcm9udGVuZFN0YWNrKTtcclxuXHJcbi8vIG5ldyBWaXNpdG9yRmVlZGJhY2tTdGFjayhhcHAsIGAke3N0YWNrTmFtZVByZWZpeH0tVmlzaXRvckZlZWRiYWNrU3RhY2tgLCB7XHJcbi8vICAgZW52OiB7IGFjY291bnQ6IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX0FDQ09VTlQsIHJlZ2lvbjogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfUkVHSU9OIHx8ICd1cy1lYXN0LTEnIH0sXHJcbi8vICAgdXNlclRhYmxlOiBGUlN0YWNrLnVzZXJUYWJsZSwgXHJcbi8vICAgYnJvYWRjYXN0TGFtYmRhOiBGUlN0YWNrLmJyb2FkY2FzdExhbWJkYVxyXG4vLyB9KTtcclxuXHJcbi8vIEJ1aWxkIFVwbG9hZCBTdGFja1xyXG4vLyBuZXcgQnVpbGRVcGxvYWRTdGFjayhhcHAsIGAke3N0YWNrTmFtZVByZWZpeH0tVW5pdHktQnVpbGRVcGxvYWRTdGFja2AsIHtcclxuLy8gICBmcm9udGVuZEJ1Y2tldE5hbWU6IGZyb250ZW5kU3RhY2suZnJvbnRlbmRCdWNrZXQuYnVja2V0TmFtZSxcclxuLy8gICBjbG91ZGZyb250RGlzdHJpYnV0aW9uSWQ6IGZyb250ZW5kU3RhY2suZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbklkLCAgLy8g4pyFXHJcbi8vICAgZW52OiB7XHJcbi8vICAgICBhY2NvdW50OiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9BQ0NPVU5ULFxyXG4vLyAgICAgcmVnaW9uOiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9SRUdJT04gfHwgXCJ1cy1lYXN0LTFcIixcclxuLy8gICB9LFxyXG4vLyB9KTsiXX0=