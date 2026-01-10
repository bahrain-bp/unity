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
exports.VisitorFeedbackStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const path = __importStar(require("path"));
class VisitorFeedbackStack extends cdk.Stack {
    userTable;
    broadcastLambda;
    constructor(scope, id, props) {
        super(scope, id, props);
        const { userTable, broadcastLambda } = props;
        const prefixname = this.stackName.split('-')[0].toLowerCase(); // ✅ Add this
        // Visitor Feedback Table
        const feedbackTable = new dynamodb.Table(this, 'VisitorFeedbackTable', {
            tableName: `${prefixname}-VisitorFeedback`,
            partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY, // only for dev/testing
        });
        // Add visitorId as GSI for querying feedback per visitor
        feedbackTable.addGlobalSecondaryIndex({
            indexName: 'visitorIdIndex',
            partitionKey: { name: 'visitorId', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        const usedTokensTable = new dynamodb.Table(this, 'UsedTokensTable', {
            tableName: `${prefixname}-UsedTokens`,
            partitionKey: {
                name: 'token', // this is required
                type: dynamodb.AttributeType.STRING
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY, // only for dev/testing
        });
        const createPythonLambda = (id, handlerFile, functionName, env) => {
            return new lambda.Function(this, id, {
                runtime: lambda.Runtime.PYTHON_3_11,
                handler: `${handlerFile}.handler`,
                code: lambda.Code.fromAsset(path.join(__dirname, '../lambda'), {
                    bundling: {
                        image: lambda.Runtime.PYTHON_3_11.bundlingImage,
                        command: [
                            "bash", "-c",
                            `
          pip install -r requirements.txt -t /asset-output &&
          cp -r . /asset-output
          `
                        ],
                    },
                }),
                environment: env,
                timeout: cdk.Duration.seconds(30),
                functionName: functionName,
                logRetention: logs.RetentionDays.ONE_DAY,
            });
        };
        const commonEnv = {
            FEEDBACK_TABLE: feedbackTable.tableName,
            VISITOR_TABLE: userTable.tableName,
            FEEDBACK_SECRET: 'secret',
            used_tokens_table: usedTokensTable.tableName,
            BROADCAST_LAMBDA: broadcastLambda.functionArn,
        };
        // Lambda to get user info
        const getVisitorInfoLambda = createPythonLambda('GetVisitorInfoLambda', 'getVisitorInfo', 'GetVisitorInfoLambda', commonEnv);
        const submitFeedbackLambda = createPythonLambda('SubmitFeedbackLambda', 'submitFeedback', 'SubmitFeedbackLambda', commonEnv);
        const getFeedbackLambda = createPythonLambda('GetFeedbackLambda', 'getFeedback', 'GetFeedbackLambda', commonEnv);
        userTable.grantReadWriteData(getVisitorInfoLambda);
        userTable.grantReadData(submitFeedbackLambda);
        feedbackTable.grantReadWriteData(submitFeedbackLambda);
        feedbackTable.grantReadData(getFeedbackLambda);
        usedTokensTable.grantReadWriteData(getVisitorInfoLambda);
        usedTokensTable.grantReadWriteData(submitFeedbackLambda);
        const submitFeedbackrRole = submitFeedbackLambda.role;
        broadcastLambda.grantInvoke(submitFeedbackrRole);
        const LoadFeedback = new lambda.Function(this, 'LoadFeedback', {
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: 'LoadFeedback.handler',
            code: lambda.Code.fromAsset('lambda'),
            environment: {
                FEEDBACK_TABLE: feedbackTable.tableName,
            },
            timeout: cdk.Duration.seconds(30),
            functionName: 'LoadFeedback',
            logRetention: logs.RetentionDays.ONE_DAY,
        });
        feedbackTable.grantReadData(LoadFeedback);
        // API Gateway
        const api = new apigateway.RestApi(this, 'FeedbackApi', {
            restApiName: `${prefixname}-Visitor Feedback API`,
        });
        const getVisitorInfoResource = api.root.addResource('getVisitorInfo');
        getVisitorInfoResource.addMethod('GET', new apigateway.LambdaIntegration(getVisitorInfoLambda, { proxy: true }));
        const submitFeedbackResource = api.root.addResource('submitFeedback');
        submitFeedbackResource.addMethod('POST', new apigateway.LambdaIntegration(submitFeedbackLambda, { proxy: true }));
        const adminResource = api.root.addResource('admin');
        const load_feedbackResource = adminResource.addResource('loadFeedback');
        load_feedbackResource.addMethod('POST', new apigateway.LambdaIntegration(LoadFeedback, { proxy: true }));
        const getFeedbackResource = adminResource.addResource('getFeedback');
        getFeedbackResource.addMethod('GET', new apigateway.LambdaIntegration(getFeedbackLambda, { proxy: true }));
        // Helper function to add OPTIONS for CORS preflight
        const addCorsOptions = (apiResource) => {
            apiResource.addMethod('OPTIONS', new apigateway.MockIntegration({
                integrationResponses: [{
                        statusCode: '200',
                        responseParameters: {
                            'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
                            'method.response.header.Access-Control-Allow-Origin': "'*'",
                            'method.response.header.Access-Control-Allow-Methods': "'GET,POST,OPTIONS'",
                        },
                    }],
                passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
                requestTemplates: {
                    'application/json': '{"statusCode": 200}'
                },
            }), {
                methodResponses: [{
                        statusCode: '200',
                        responseParameters: {
                            'method.response.header.Access-Control-Allow-Headers': true,
                            'method.response.header.Access-Control-Allow-Methods': true,
                            'method.response.header.Access-Control-Allow-Origin': true,
                        },
                    }],
            });
        };
        // Add CORS preflight to each resource
        addCorsOptions(getVisitorInfoResource);
        addCorsOptions(submitFeedbackResource);
        addCorsOptions(getFeedbackResource);
        addCorsOptions(load_feedbackResource);
    }
}
exports.VisitorFeedbackStack = VisitorFeedbackStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVmlzaXRvckZlZWRiYWNrU3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJWaXNpdG9yRmVlZGJhY2tTdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUVuQyxtRUFBcUQ7QUFDckQsK0RBQWlEO0FBQ2pELHVFQUF5RDtBQUN6RCwyREFBNkM7QUFDN0MsMkNBQTZCO0FBTzdCLE1BQWEsb0JBQXFCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDL0MsU0FBUyxDQUFpQjtJQUMxQixlQUFlLENBQWtCO0lBQ2pDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBZ0M7UUFDdEUsS0FBSyxDQUFDLEtBQUssRUFBQyxFQUFFLEVBQUMsS0FBSyxDQUFDLENBQUM7UUFDckIsTUFBTSxFQUFFLFNBQVMsRUFBRSxlQUFlLEVBQUUsR0FBRyxLQUFLLENBQUM7UUFFOUMsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBRSxhQUFhO1FBR2pGLHlCQUF5QjtRQUV6QixNQUFNLGFBQWEsR0FBRyxJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLHNCQUFzQixFQUFFO1lBQ3JFLFNBQVMsRUFBRSxHQUFHLFVBQVUsa0JBQWtCO1lBQzFDLFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQ2pFLFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7WUFDakQsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTyxFQUFFLHVCQUF1QjtTQUNsRSxDQUFDLENBQUM7UUFFSCx5REFBeUQ7UUFDekQsYUFBYSxDQUFDLHVCQUF1QixDQUFDO1lBQ3BDLFNBQVMs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QUFlLEVBQUUsQ0FBQzt3QkFDaEIsVUFBVSxFQUFFLEtBQUs7d0JBQ2pCLGtCQUFrQixFQUFFOzRCQUNsQixxREFBcUQsRUFBRSxJQUFJOzRCQUMzRCxxREFBcUQsRUFBRSxJQUFJOzRCQUMzRCxvREFBb0QsRUFBRSxJQUFJO3lCQUMzRDtxQkFDRixDQUFDO2FBQ0gsQ0FDRixDQUFDO1FBQ0osQ0FBQyxDQUFDO1FBRUYsc0NBQXNDO1FBQ3RDLGNBQWMsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO1FBQ3ZDLGNBQWMsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO1FBQ3ZDLGNBQWMsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1FBQ3BDLGNBQWMsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO0lBSWxDLENBQUM7Q0FDSjtBQS9MRCxvREErTEMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xyXG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcclxuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcclxuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xyXG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcclxuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XHJcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XHJcblxyXG5pbnRlcmZhY2UgVmlzaXRvckZlZWRiYWNrU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcclxuICB1c2VyVGFibGU6IGR5bmFtb2RiLlRhYmxlOyAvLyBwYXNzIHRoZSB0YWJsZSBmcm9tIGFub3RoZXIgc3RhY2tcclxuICBicm9hZGNhc3RMYW1iZGE6IGxhbWJkYS5JRnVuY3Rpb247XHJcbn1cclxuXHJcbmV4cG9ydCBjbGFzcyBWaXNpdG9yRmVlZGJhY2tTdGFjayBleHRlbmRzIGNkay5TdGFja3tcclxuICAgIHVzZXJUYWJsZTogZHluYW1vZGIuVGFibGU7XHJcbiAgICBicm9hZGNhc3RMYW1iZGE6IGxhbWJkYS5GdW5jdGlvbjtcclxuICAgIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBWaXNpdG9yRmVlZGJhY2tTdGFja1Byb3BzKXtcclxuICAgICAgICBzdXBlcihzY29wZSxpZCxwcm9wcyk7XHJcbiAgICAgICAgIGNvbnN0IHsgdXNlclRhYmxlLCBicm9hZGNhc3RMYW1iZGEgfSA9IHByb3BzO1xyXG5cclxuICAgICAgICBjb25zdCBwcmVmaXhuYW1lID0gdGhpcy5zdGFja05hbWUuc3BsaXQoJy0nKVswXS50b0xvd2VyQ2FzZSgpOyAgLy8g4pyFIEFkZCB0aGlzXHJcblxyXG4gIFxyXG4gICAgLy8gVmlzaXRvciBGZWVkYmFjayBUYWJsZVxyXG4gIFxyXG4gICAgY29uc3QgZmVlZGJhY2tUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnVmlzaXRvckZlZWRiYWNrVGFibGUnLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogYCR7cHJlZml4bmFtZX0tVmlzaXRvckZlZWRiYWNrYCxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdpZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksIC8vIG9ubHkgZm9yIGRldi90ZXN0aW5nXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBBZGQgdmlzaXRvcklkIGFzIEdTSSBmb3IgcXVlcnlpbmcgZmVlZGJhY2sgcGVyIHZpc2l0b3JcclxuICAgIGZlZWRiYWNrVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgICBpbmRleE5hbWU6ICd2aXNpdG9ySWRJbmRleCcsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAndmlzaXRvcklkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcclxuICAgIH0pO1xyXG5cclxuXHJcbiAgICBjb25zdCB1c2VkVG9rZW5zVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1VzZWRUb2tlbnNUYWJsZScsIHtcclxuICB0YWJsZU5hbWU6IGAke3ByZWZpeG5hbWV9LVVzZWRUb2tlbnNgLFxyXG4gIHBhcnRpdGlvbktleTogeyBcclxuICAgIG5hbWU6ICd0b2tlbicsIC8vIHRoaXMgaXMgcmVxdWlyZWRcclxuICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIFxyXG4gIH0sXHJcbiAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcclxuICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLCAvLyBvbmx5IGZvciBkZXYvdGVzdGluZ1xyXG59KTtcclxuXHJcbmNvbnN0IGNyZWF0ZVB5dGhvbkxhbWJkYSA9IChpZDogc3RyaW5nLCBoYW5kbGVyRmlsZTogc3RyaW5nLCBmdW5jdGlvbk5hbWU6IHN0cmluZywgZW52OiB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB9KSA9PiB7XHJcbiAgcmV0dXJuIG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgaWQsIHtcclxuICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzExLFxyXG4gICAgaGFuZGxlcjogYCR7aGFuZGxlckZpbGV9LmhhbmRsZXJgLFxyXG4gICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi9sYW1iZGEnKSwge1xyXG4gICAgICBidW5kbGluZzoge1xyXG4gICAgICAgIGltYWdlOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMS5idW5kbGluZ0ltYWdlLFxyXG4gICAgICAgIGNvbW1hbmQ6IFtcclxuICAgICAgICAgIFwiYmFzaFwiLCBcIi1jXCIsXHJcbiAgICAgICAgICBgXHJcbiAgICAgICAgICBwaXAgaW5zdGFsbCAtciByZXF1aXJlbWVudHMudHh0IC10IC9hc3NldC1vdXRwdXQgJiZcclxuICAgICAgICAgIGNwIC1yIC4gL2Fzc2V0LW91dHB1dFxyXG4gICAgICAgICAgYFxyXG4gICAgICAgIF0sXHJcbiAgICAgIH0sXHJcbiAgICB9KSxcclxuICAgIGVudmlyb25tZW50OiBlbnYsXHJcbiAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXHJcbiAgICBmdW5jdGlvbk5hbWU6IGZ1bmN0aW9uTmFtZSxcclxuICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9EQVksXHJcbiAgfSk7XHJcbn07XHJcblxyXG5jb25zdCBjb21tb25FbnYgPSB7XHJcbiAgRkVFREJBQ0tfVEFCTEU6IGZlZWRiYWNrVGFibGUudGFibGVOYW1lLFxyXG4gIFZJU0lUT1JfVEFCTEU6IHVzZXJUYWJsZS50YWJsZU5hbWUsXHJcbiAgRkVFREJBQ0tfU0VDUkVUOiAnc2VjcmV0JyxcclxuICB1c2VkX3Rva2Vuc190YWJsZTogdXNlZFRva2Vuc1RhYmxlLnRhYmxlTmFtZSxcclxuICBCUk9BRENBU1RfTEFNQkRBOiBicm9hZGNhc3RMYW1iZGEuZnVuY3Rpb25Bcm4sXHJcbn07XHJcblxyXG4gICAgIC8vIExhbWJkYSB0byBnZXQgdXNlciBpbmZvXHJcbmNvbnN0IGdldFZpc2l0b3JJbmZvTGFtYmRhID0gY3JlYXRlUHl0aG9uTGFtYmRhKFxyXG4gICdHZXRWaXNpdG9ySW5mb0xhbWJkYScsXHJcbiAgJ2dldFZpc2l0b3JJbmZvJyxcclxuICAnR2V0VmlzaXRvckluZm9MYW1iZGEnLFxyXG4gIGNvbW1vbkVudlxyXG4pO1xyXG5cclxuY29uc3Qgc3VibWl0RmVlZGJhY2tMYW1iZGEgPSBjcmVhdGVQeXRob25MYW1iZGEoXHJcbiAgJ1N1Ym1pdEZlZWRiYWNrTGFtYmRhJyxcclxuICAnc3VibWl0RmVlZGJhY2snLFxyXG4gICdTdWJtaXRGZWVkYmFja0xhbWJkYScsXHJcbiAgY29tbW9uRW52XHJcbik7XHJcblxyXG5jb25zdCBnZXRGZWVkYmFja0xhbWJkYSA9IGNyZWF0ZVB5dGhvbkxhbWJkYShcclxuICAnR2V0RmVlZGJhY2tMYW1iZGEnLFxyXG4gICdnZXRGZWVkYmFjaycsXHJcbiAgJ0dldEZlZWRiYWNrTGFtYmRhJyxcclxuICBjb21tb25FbnZcclxuKTtcclxuXHJcbiAgICB1c2VyVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGdldFZpc2l0b3JJbmZvTGFtYmRhKTtcclxuICAgIHVzZXJUYWJsZS5ncmFudFJlYWREYXRhKHN1Ym1pdEZlZWRiYWNrTGFtYmRhKTtcclxuXHJcbiAgICBmZWVkYmFja1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShzdWJtaXRGZWVkYmFja0xhbWJkYSk7XHJcbiAgICBmZWVkYmFja1RhYmxlLmdyYW50UmVhZERhdGEoZ2V0RmVlZGJhY2tMYW1iZGEpO1xyXG5cclxuICAgIHVzZWRUb2tlbnNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoZ2V0VmlzaXRvckluZm9MYW1iZGEpO1xyXG4gICAgdXNlZFRva2Vuc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShzdWJtaXRGZWVkYmFja0xhbWJkYSk7XHJcblxyXG4gICAgY29uc3Qgc3VibWl0RmVlZGJhY2tyUm9sZSA9IHN1Ym1pdEZlZWRiYWNrTGFtYmRhLnJvbGUhO1xyXG4gICAgYnJvYWRjYXN0TGFtYmRhLmdyYW50SW52b2tlKHN1Ym1pdEZlZWRiYWNrclJvbGUpO1xyXG5cclxuXHJcbiAgICBjb25zdCBMb2FkRmVlZGJhY2sgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdMb2FkRmVlZGJhY2snLHtcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTEsXHJcbiAgICAgIGhhbmRsZXI6J0xvYWRGZWVkYmFjay5oYW5kbGVyJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEnKSxcclxuICAgICAgZW52aXJvbm1lbnQ6e1xyXG4gICAgICAgIEZFRURCQUNLX1RBQkxFOiBmZWVkYmFja1RhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgfSxcclxuICAgICAgdGltZW91dDpjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ0xvYWRGZWVkYmFjaycsIFxyXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfREFZLFxyXG4gICAgfSk7XHJcbiAgICBmZWVkYmFja1RhYmxlLmdyYW50UmVhZERhdGEoTG9hZEZlZWRiYWNrKTtcclxuXHJcblxyXG5cclxuICAgIC8vIEFQSSBHYXRld2F5XHJcbiAgICBjb25zdCBhcGkgPSBuZXcgYXBpZ2F0ZXdheS5SZXN0QXBpKHRoaXMsICdGZWVkYmFja0FwaScsIHtcclxuICAgIHJlc3RBcGlOYW1lOiBgJHtwcmVmaXhuYW1lfS1WaXNpdG9yIEZlZWRiYWNrIEFQSWAsXHJcbiAgICBcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IGdldFZpc2l0b3JJbmZvUmVzb3VyY2UgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnZ2V0VmlzaXRvckluZm8nKTtcclxuICAgIGdldFZpc2l0b3JJbmZvUmVzb3VyY2UuYWRkTWV0aG9kKFxyXG4gICAgJ0dFVCcsXHJcbiAgICBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihnZXRWaXNpdG9ySW5mb0xhbWJkYSwgeyBwcm94eTogdHJ1ZSB9KVxyXG4gICAgKTtcclxuXHJcbiAgICBjb25zdCBzdWJtaXRGZWVkYmFja1Jlc291cmNlID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3N1Ym1pdEZlZWRiYWNrJyk7XHJcbiAgICBzdWJtaXRGZWVkYmFja1Jlc291cmNlLmFkZE1ldGhvZChcclxuICAgICdQT1NUJyxcclxuICAgIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHN1Ym1pdEZlZWRiYWNrTGFtYmRhLCB7IHByb3h5OiB0cnVlIH0pXHJcbiAgICApO1xyXG5cclxuICBcclxuICAgIGNvbnN0IGFkbWluUmVzb3VyY2UgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnYWRtaW4nKTtcclxuICAgIGNvbnN0IGxvYWRfZmVlZGJhY2tSZXNvdXJjZSA9IGFkbWluUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2xvYWRGZWVkYmFjaycpXHJcbiAgICBsb2FkX2ZlZWRiYWNrUmVzb3VyY2UuYWRkTWV0aG9kKFxyXG4gICAgJ1BPU1QnLFxyXG4gICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oTG9hZEZlZWRiYWNrLCB7IHByb3h5OiB0cnVlIH0pXHJcbiAgICApO1xyXG5cclxuICAgIGNvbnN0IGdldEZlZWRiYWNrUmVzb3VyY2UgPSBhZG1pblJlc291cmNlLmFkZFJlc291cmNlKCdnZXRGZWVkYmFjaycpO1xyXG4gICAgZ2V0RmVlZGJhY2tSZXNvdXJjZS5hZGRNZXRob2QoXHJcbiAgICAnR0VUJyxcclxuICAgIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGdldEZlZWRiYWNrTGFtYmRhLCB7IHByb3h5OiB0cnVlIH0pXHJcbiAgICApO1xyXG5cclxuICAgIC8vIEhlbHBlciBmdW5jdGlvbiB0byBhZGQgT1BUSU9OUyBmb3IgQ09SUyBwcmVmbGlnaHRcclxuY29uc3QgYWRkQ29yc09wdGlvbnMgPSAoYXBpUmVzb3VyY2U6IGFwaWdhdGV3YXkuSVJlc291cmNlKSA9PiB7XHJcbiAgYXBpUmVzb3VyY2UuYWRkTWV0aG9kKFxyXG4gICAgJ09QVElPTlMnLFxyXG4gICAgbmV3IGFwaWdhdGV3YXkuTW9ja0ludGVncmF0aW9uKHtcclxuICAgICAgaW50ZWdyYXRpb25SZXNwb25zZXM6IFt7XHJcbiAgICAgICAgc3RhdHVzQ29kZTogJzIwMCcsXHJcbiAgICAgICAgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XHJcbiAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzpcclxuICAgICAgICAgICAgXCInQ29udGVudC1UeXBlLFgtQW16LURhdGUsQXV0aG9yaXphdGlvbixYLUFwaS1LZXksWC1BbXotU2VjdXJpdHktVG9rZW4nXCIsXHJcbiAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiBcIicqJ1wiLFxyXG4gICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6IFwiJ0dFVCxQT1NULE9QVElPTlMnXCIsXHJcbiAgICAgICAgfSxcclxuICAgICAgfV0sXHJcbiAgICAgIHBhc3N0aHJvdWdoQmVoYXZpb3I6IGFwaWdhdGV3YXkuUGFzc3Rocm91Z2hCZWhhdmlvci5ORVZFUixcclxuICAgICAgcmVxdWVzdFRlbXBsYXRlczoge1xyXG4gICAgICAgICdhcHBsaWNhdGlvbi9qc29uJzogJ3tcInN0YXR1c0NvZGVcIjogMjAwfSdcclxuICAgICAgfSxcclxuICAgIH0pLFxyXG4gICAge1xyXG4gICAgICBtZXRob2RSZXNwb25zZXM6IFt7XHJcbiAgICAgICAgc3RhdHVzQ29kZTogJzIwMCcsXHJcbiAgICAgICAgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XHJcbiAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzogdHJ1ZSxcclxuICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnOiB0cnVlLFxyXG4gICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogdHJ1ZSxcclxuICAgICAgICB9LFxyXG4gICAgICB9XSxcclxuICAgIH1cclxuICApO1xyXG59O1xyXG5cclxuLy8gQWRkIENPUlMgcHJlZmxpZ2h0IHRvIGVhY2ggcmVzb3VyY2VcclxuYWRkQ29yc09wdGlvbnMoZ2V0VmlzaXRvckluZm9SZXNvdXJjZSk7XHJcbmFkZENvcnNPcHRpb25zKHN1Ym1pdEZlZWRiYWNrUmVzb3VyY2UpO1xyXG5hZGRDb3JzT3B0aW9ucyhnZXRGZWVkYmFja1Jlc291cmNlKTtcclxuYWRkQ29yc09wdGlvbnMobG9hZF9mZWVkYmFja1Jlc291cmNlKTtcclxuXHJcblxyXG5cclxuICAgIH1cclxufSJdfQ==