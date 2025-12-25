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
const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || "us-east-1",
};
// 1) DB stack (all tables)
const dbStack = new DBstack_1.DBStack(app, "Unity-DBStack", { env });
// 2) WebSocket stack
const wsStack = new unity_websocket_stack_1.UnityWebSocketStack(app, "UnityWebSocketStack", { env });
// 3) IoT stack (Things + policy + rule + ingest Lambda + WS broadcast)
const iotStack = new IoTStack_1.IoTStack(app, "Unity-IoTStack", {
    env,
    dbStack,
    wsStack,
});
// 4) OpenSearch + Index + Bedrock
const openSearchStack = new opensearch_stack_1.OpenSearchStack(app, 'Unity-OpenSearchStack', { env });
const indexStack = new index_stack_1.IndexStack(app, 'Unity-IndexStack', {
    openSearchStack,
    env,
});
const bedrockStack = new bedrock_stack_1.BedrockStack(app, 'Unity-BedrockStack', {
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
new frontend_deployment_stack_1.FrontendDeploymentStack(app, "Unity-FrontendDeploymentStack");
// 6) API stack (Cognito + API Gateway + Lambdas)
new api_stack_1.APIStack(app, "Unity-APIStack", {
    dbStack,
    bedrockStack,
    wsStack,
    env,
});
const FRStack = new FacialRecognitionStack_1.FacialRecognitionStack(app, 'FacialRecognitionStack', {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
    },
});
// new VisitorFeedbackStack(app, 'VisitorFeedbackStack', {
//   env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION || 'us-east-1' },
//   userTable: FRStack.userTable, 
// });
//new FrontendDeploymentStack(app, "Unity-FrontendDeploymentStack");
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXktY2RrLWFwcC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm15LWNkay1hcHAudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFrQztBQUNsQyw0Q0FBeUM7QUFDekMsZ0RBQTRDO0FBQzVDLGdGQUEyRTtBQUMzRSw4REFBMEQ7QUFDMUQsd0RBQW9EO0FBQ3BELG9EQUFnRDtBQUNoRCwwRUFBdUU7QUFHdkUsOENBQTJDO0FBQzNDLHdFQUFtRTtBQUVuRSxNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUUxQixNQUFNLEdBQUcsR0FBRztJQUNWLE9BQU8sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQjtJQUN4QyxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsSUFBSSxXQUFXO0NBQ3RELENBQUM7QUFFRiwyQkFBMkI7QUFDM0IsTUFBTSxPQUFPLEdBQUcsSUFBSSxpQkFBTyxDQUFDLEdBQUcsRUFBRSxlQUFlLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDO0FBRTNELHFCQUFxQjtBQUNyQixNQUFNLE9BQU8sR0FBRyxJQUFJLDJDQUFtQixDQUFDLEdBQUcsRUFBRSxxQkFBcUIsRUFBRSxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUM7QUFFN0UsdUVBQXVFO0FBQ3ZFLE1BQU0sUUFBUSxHQUFHLElBQUksbUJBQVEsQ0FBQyxHQUFHLEVBQUUsZ0JBQWdCLEVBQUU7SUFDbkQsR0FBRztJQUNILE9BQU87SUFDUCxPQUFPO0NBQ1IsQ0FBQyxDQUFDO0FBRUgsa0NBQWtDO0FBQ2xDLE1BQU0sZUFBZSxHQUFHLElBQUksa0NBQWUsQ0FBQyxHQUFHLEVBQUUsdUJBQXVCLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDO0FBRW5GLE1BQU0sVUFBVSxHQUFHLElBQUksd0JBQVUsQ0FBQyxHQUFHLEVBQUUsa0JBQWtCLEVBQUU7SUFDekQsZUFBZTtJQUNmLEdBQUc7Q0FDSixDQUFDLENBQUM7QUFFSCxNQUFNLFlBQVksR0FBRyxJQUFJLDRCQUFZLENBQUMsR0FBRyxFQUFFLG9CQUFvQixFQUFFO0lBQy9ELGVBQWU7SUFDZixVQUFVO0lBQ1YsT0FBTztJQUNQLEdBQUcsRUFBRTtRQUNILE9BQU8sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQjtRQUN4QyxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsSUFBSSxXQUFXO0tBQ3REO0NBQ0YsQ0FBQyxDQUFDO0FBRUgsVUFBVSxDQUFDLGFBQWEsQ0FBQyxlQUFlLENBQUMsQ0FBQztBQUMxQyxZQUFZLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBRXZDLHlCQUF5QjtBQUN6QixJQUFJLG1EQUF1QixDQUFDLEdBQUcsRUFBRSwrQkFBK0IsQ0FBQyxDQUFDO0FBRWxFLGlEQUFpRDtBQUNqRCxJQUFJLG9CQUFRLENBQUMsR0FBRyxFQUFFLGdCQUFnQixFQUFFO0lBQ2xDLE9BQU87SUFDUCxZQUFZO0lBQ1osT0FBTztJQUNQLEdBQUc7Q0FDSixDQUFDLENBQUM7QUFHSCxNQUFNLE9BQU8sR0FBRyxJQUFJLCtDQUFzQixDQUFDLEdBQUcsRUFBRSx3QkFBd0IsRUFBRTtJQUN4RSxHQUFHLEVBQUU7UUFDSCxPQUFPLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUI7UUFDeEMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCLElBQUksV0FBVztLQUN0RDtDQUNGLENBQUMsQ0FBQztBQUdILDBEQUEwRDtBQUMxRCw4R0FBOEc7QUFDOUcsbUNBQW1DO0FBQ25DLE1BQU07QUFFTixvRUFBb0UiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSBcImF3cy1jZGstbGliXCJcclxuaW1wb3J0IHsgREJTdGFjayB9IGZyb20gXCIuLi9saWIvREJzdGFja1wiOyBcclxuaW1wb3J0IHsgQVBJU3RhY2sgfSBmcm9tIFwiLi4vbGliL2FwaS1zdGFja1wiO1xyXG5pbXBvcnQgeyBGcm9udGVuZERlcGxveW1lbnRTdGFjayB9IGZyb20gXCIuLi9saWIvZnJvbnRlbmQtZGVwbG95bWVudC1zdGFja1wiO1xyXG5pbXBvcnQgeyBPcGVuU2VhcmNoU3RhY2sgfSBmcm9tICcuLi9saWIvb3BlbnNlYXJjaF9zdGFjayc7XHJcbmltcG9ydCB7IEJlZHJvY2tTdGFjayB9IGZyb20gJy4uL2xpYi9iZWRyb2NrX3N0YWNrJztcclxuaW1wb3J0IHsgSW5kZXhTdGFjayB9IGZyb20gJy4uL2xpYi9pbmRleF9zdGFjayc7XHJcbmltcG9ydCB7IEZhY2lhbFJlY29nbml0aW9uU3RhY2sgfSBmcm9tIFwiLi4vbGliL0ZhY2lhbFJlY29nbml0aW9uU3RhY2tcIjtcclxuaW1wb3J0IHsgVmlzaXRvckZlZWRiYWNrU3RhY2sgfSBmcm9tIFwiLi4vbGliL1Zpc2l0b3JGZWVkYmFja1N0YWNrXCI7XHJcbiBcclxuaW1wb3J0IHsgSW9UU3RhY2sgfSBmcm9tIFwiLi4vbGliL0lvVFN0YWNrXCI7XHJcbmltcG9ydCB7IFVuaXR5V2ViU29ja2V0U3RhY2sgfSBmcm9tIFwiLi4vbGliL3VuaXR5LXdlYnNvY2tldC1zdGFja1wiO1xyXG5cclxuY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKTtcclxuXHJcbmNvbnN0IGVudiA9IHtcclxuICBhY2NvdW50OiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9BQ0NPVU5ULFxyXG4gIHJlZ2lvbjogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfUkVHSU9OIHx8IFwidXMtZWFzdC0xXCIsXHJcbn07XHJcblxyXG4vLyAxKSBEQiBzdGFjayAoYWxsIHRhYmxlcylcclxuY29uc3QgZGJTdGFjayA9IG5ldyBEQlN0YWNrKGFwcCwgXCJVbml0eS1EQlN0YWNrXCIsIHsgZW52IH0pO1xyXG5cclxuLy8gMikgV2ViU29ja2V0IHN0YWNrXHJcbmNvbnN0IHdzU3RhY2sgPSBuZXcgVW5pdHlXZWJTb2NrZXRTdGFjayhhcHAsIFwiVW5pdHlXZWJTb2NrZXRTdGFja1wiLCB7IGVudiB9KTtcclxuXHJcbi8vIDMpIElvVCBzdGFjayAoVGhpbmdzICsgcG9saWN5ICsgcnVsZSArIGluZ2VzdCBMYW1iZGEgKyBXUyBicm9hZGNhc3QpXHJcbmNvbnN0IGlvdFN0YWNrID0gbmV3IElvVFN0YWNrKGFwcCwgXCJVbml0eS1Jb1RTdGFja1wiLCB7XHJcbiAgZW52LFxyXG4gIGRiU3RhY2ssXHJcbiAgd3NTdGFjayxcclxufSk7XHJcblxyXG4vLyA0KSBPcGVuU2VhcmNoICsgSW5kZXggKyBCZWRyb2NrXHJcbmNvbnN0IG9wZW5TZWFyY2hTdGFjayA9IG5ldyBPcGVuU2VhcmNoU3RhY2soYXBwLCAnVW5pdHktT3BlblNlYXJjaFN0YWNrJywgeyBlbnYgfSk7XHJcblxyXG5jb25zdCBpbmRleFN0YWNrID0gbmV3IEluZGV4U3RhY2soYXBwLCAnVW5pdHktSW5kZXhTdGFjaycsIHtcclxuICBvcGVuU2VhcmNoU3RhY2ssXHJcbiAgZW52LFxyXG59KTtcclxuXHJcbmNvbnN0IGJlZHJvY2tTdGFjayA9IG5ldyBCZWRyb2NrU3RhY2soYXBwLCAnVW5pdHktQmVkcm9ja1N0YWNrJywge1xyXG4gIG9wZW5TZWFyY2hTdGFjayxcclxuICBpbmRleFN0YWNrLFxyXG4gIGRiU3RhY2ssXHJcbiAgZW52OiB7XHJcbiAgICBhY2NvdW50OiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9BQ0NPVU5ULFxyXG4gICAgcmVnaW9uOiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9SRUdJT04gfHwgJ3VzLWVhc3QtMSdcclxuICB9XHJcbn0pO1xyXG5cclxuaW5kZXhTdGFjay5hZGREZXBlbmRlbmN5KG9wZW5TZWFyY2hTdGFjayk7XHJcbmJlZHJvY2tTdGFjay5hZGREZXBlbmRlbmN5KGluZGV4U3RhY2spO1xyXG5cclxuLy8gNSkgRnJvbnRlbmQgZGVwbG95bWVudFxyXG5uZXcgRnJvbnRlbmREZXBsb3ltZW50U3RhY2soYXBwLCBcIlVuaXR5LUZyb250ZW5kRGVwbG95bWVudFN0YWNrXCIpO1xyXG5cclxuLy8gNikgQVBJIHN0YWNrIChDb2duaXRvICsgQVBJIEdhdGV3YXkgKyBMYW1iZGFzKVxyXG5uZXcgQVBJU3RhY2soYXBwLCBcIlVuaXR5LUFQSVN0YWNrXCIsIHtcclxuICBkYlN0YWNrLFxyXG4gIGJlZHJvY2tTdGFjayxcclxuICB3c1N0YWNrLFxyXG4gIGVudixcclxufSk7XHJcblxyXG5cclxuY29uc3QgRlJTdGFjayA9IG5ldyBGYWNpYWxSZWNvZ25pdGlvblN0YWNrKGFwcCwgJ0ZhY2lhbFJlY29nbml0aW9uU3RhY2snLCB7XHJcbiAgZW52OiB7XHJcbiAgICBhY2NvdW50OiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9BQ0NPVU5ULFxyXG4gICAgcmVnaW9uOiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9SRUdJT04gfHwgJ3VzLWVhc3QtMScsXHJcbiAgfSxcclxufSk7XHJcblxyXG5cclxuLy8gbmV3IFZpc2l0b3JGZWVkYmFja1N0YWNrKGFwcCwgJ1Zpc2l0b3JGZWVkYmFja1N0YWNrJywge1xyXG4vLyAgIGVudjogeyBhY2NvdW50OiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9BQ0NPVU5ULCByZWdpb246IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX1JFR0lPTiB8fCAndXMtZWFzdC0xJyB9LFxyXG4vLyAgIHVzZXJUYWJsZTogRlJTdGFjay51c2VyVGFibGUsIFxyXG4vLyB9KTtcclxuIFxyXG4vL25ldyBGcm9udGVuZERlcGxveW1lbnRTdGFjayhhcHAsIFwiVW5pdHktRnJvbnRlbmREZXBsb3ltZW50U3RhY2tcIik7XHJcbiJdfQ==