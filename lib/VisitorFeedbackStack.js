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
    constructor(scope, id, props) {
        super(scope, id, props);
        const userTable = props.userTable; // reference from the other stack
        // Visitor Feedback Table
        const feedbackTable = new dynamodb.Table(this, 'VisitorFeedbackTable', {
            tableName: 'VisitorFeedback',
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
            tableName: 'used_tokens_table',
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
            used_tokens_table: usedTokensTable.tableName
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
        // API Gateway
        const api = new apigateway.RestApi(this, 'FeedbackApi', {
            restApiName: 'Visitor Feedback API',
        });
        const getVisitorInfoResource = api.root.addResource('getVisitorInfo');
        getVisitorInfoResource.addMethod('GET', new apigateway.LambdaIntegration(getVisitorInfoLambda, { proxy: true }));
        const submitFeedbackResource = api.root.addResource('submitFeedback');
        submitFeedbackResource.addMethod('POST', new apigateway.LambdaIntegration(submitFeedbackLambda, { proxy: true }));
        const getFeedbackResource = api.root.addResource('getFeedback');
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
    }
}
exports.VisitorFeedbackStack = VisitorFeedbackStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVmlzaXRvckZlZWRiYWNrU3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJWaXNpdG9yRmVlZGJhY2tTdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUVuQyxtRUFBcUQ7QUFDckQsK0RBQWlEO0FBQ2pELHVFQUF5RDtBQUN6RCwyREFBNkM7QUFDN0MsMkNBQTZCO0FBTTdCLE1BQWEsb0JBQXFCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDL0MsU0FBUyxDQUFpQjtJQUMxQixZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQWdDO1FBQ3RFLEtBQUssQ0FBQyxLQUFLLEVBQUMsRUFBRSxFQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3RCLE1BQU0sU0FBUyxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxpQ0FBaUM7UUFHeEUseUJBQXlCO1FBRXpCLE1BQU0sYUFBYSxHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsc0JBQXNCLEVBQUU7WUFDckUsU0FBUyxFQUFFLGlCQUFpQjtZQUM1QixZQUFZLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtZQUNqRSxXQUFXLEVBQUUsUUFBUSxDQUFDLFdBQVcsQ0FBQyxlQUFlO1lBQ2pELGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU8sRUFBRSx1QkFBdUI7U0FDbEUsQ0FBQyxDQUFDO1FBRUgseURBQXlEO1FBQ3pELGFBQWEsQ0FBQyx1QkFBdUIsQ0FBQztZQUNwQyxTQUFTLEVBQUUsZ0JBQWdCO1lBQzNCLFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQ3hFLGNBQWMsRUFBRSxRQUFRLENBQUMsY0FBYyxDQUFDLEdB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Qzt3QkFDaEIsVUFBVSxFQUFFLEtBQUs7d0JBQ2pCLGtCQUFrQixFQUFFOzRCQUNsQixxREFBcUQsRUFBRSxJQUFJOzRCQUMzRCxxREFBcUQsRUFBRSxJQUFJOzRCQUMzRCxvREFBb0QsRUFBRSxJQUFJO3lCQUMzRDtxQkFDRixDQUFDO2FBQ0gsQ0FDRixDQUFDO1FBQ0osQ0FBQyxDQUFDO1FBRUYsc0NBQXNDO1FBQ3RDLGNBQWMsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO1FBQ3ZDLGNBQWMsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO1FBQ3ZDLGNBQWMsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO0lBSWhDLENBQUM7Q0FDSjtBQWhLRCxvREFnS0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xyXG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcclxuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcclxuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xyXG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcclxuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XHJcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XHJcblxyXG5pbnRlcmZhY2UgVmlzaXRvckZlZWRiYWNrU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcclxuICB1c2VyVGFibGU6IGR5bmFtb2RiLlRhYmxlOyAvLyBwYXNzIHRoZSB0YWJsZSBmcm9tIGFub3RoZXIgc3RhY2tcclxufVxyXG5cclxuZXhwb3J0IGNsYXNzIFZpc2l0b3JGZWVkYmFja1N0YWNrIGV4dGVuZHMgY2RrLlN0YWNre1xyXG4gICAgdXNlclRhYmxlOiBkeW5hbW9kYi5UYWJsZTtcclxuICAgIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBWaXNpdG9yRmVlZGJhY2tTdGFja1Byb3BzKXtcclxuICAgICAgICBzdXBlcihzY29wZSxpZCxwcm9wcyk7XHJcbiAgICAgICAgY29uc3QgdXNlclRhYmxlID0gcHJvcHMudXNlclRhYmxlOyAvLyByZWZlcmVuY2UgZnJvbSB0aGUgb3RoZXIgc3RhY2tcclxuXHJcbiAgXHJcbiAgICAvLyBWaXNpdG9yIEZlZWRiYWNrIFRhYmxlXHJcbiAgXHJcbiAgICBjb25zdCBmZWVkYmFja1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdWaXNpdG9yRmVlZGJhY2tUYWJsZScsIHtcclxuICAgICAgdGFibGVOYW1lOiAnVmlzaXRvckZlZWRiYWNrJyxcclxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdpZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksIC8vIG9ubHkgZm9yIGRldi90ZXN0aW5nXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBBZGQgdmlzaXRvcklkIGFzIEdTSSBmb3IgcXVlcnlpbmcgZmVlZGJhY2sgcGVyIHZpc2l0b3JcclxuICAgIGZlZWRiYWNrVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xyXG4gICAgICBpbmRleE5hbWU6ICd2aXNpdG9ySWRJbmRleCcsXHJcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAndmlzaXRvcklkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcclxuICAgIH0pO1xyXG5cclxuXHJcbiAgICBjb25zdCB1c2VkVG9rZW5zVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1VzZWRUb2tlbnNUYWJsZScsIHtcclxuICB0YWJsZU5hbWU6ICd1c2VkX3Rva2Vuc190YWJsZScsXHJcbiAgcGFydGl0aW9uS2V5OiB7IFxyXG4gICAgbmFtZTogJ3Rva2VuJywgLy8gdGhpcyBpcyByZXF1aXJlZFxyXG4gICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgXHJcbiAgfSxcclxuICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxyXG4gIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksIC8vIG9ubHkgZm9yIGRldi90ZXN0aW5nXHJcbn0pO1xyXG5cclxuY29uc3QgY3JlYXRlUHl0aG9uTGFtYmRhID0gKGlkOiBzdHJpbmcsIGhhbmRsZXJGaWxlOiBzdHJpbmcsIGZ1bmN0aW9uTmFtZTogc3RyaW5nLCBlbnY6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH0pID0+IHtcclxuICByZXR1cm4gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCBpZCwge1xyXG4gICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTEsXHJcbiAgICBoYW5kbGVyOiBgJHtoYW5kbGVyRmlsZX0uaGFuZGxlcmAsXHJcbiAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uL2xhbWJkYScpLCB7XHJcbiAgICAgIGJ1bmRsaW5nOiB7XHJcbiAgICAgICAgaW1hZ2U6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzExLmJ1bmRsaW5nSW1hZ2UsXHJcbiAgICAgICAgY29tbWFuZDogW1xyXG4gICAgICAgICAgXCJiYXNoXCIsIFwiLWNcIixcclxuICAgICAgICAgIGBcclxuICAgICAgICAgIHBpcCBpbnN0YWxsIC1yIHJlcXVpcmVtZW50cy50eHQgLXQgL2Fzc2V0LW91dHB1dCAmJlxyXG4gICAgICAgICAgY3AgLXIgLiAvYXNzZXQtb3V0cHV0XHJcbiAgICAgICAgICBgXHJcbiAgICAgICAgXSxcclxuICAgICAgfSxcclxuICAgIH0pLFxyXG4gICAgZW52aXJvbm1lbnQ6IGVudixcclxuICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcclxuICAgIGZ1bmN0aW9uTmFtZTogZnVuY3Rpb25OYW1lLFxyXG4gICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX0RBWSxcclxuICB9KTtcclxufTtcclxuXHJcbmNvbnN0IGNvbW1vbkVudiA9IHtcclxuICBGRUVEQkFDS19UQUJMRTogZmVlZGJhY2tUYWJsZS50YWJsZU5hbWUsXHJcbiAgVklTSVRPUl9UQUJMRTogdXNlclRhYmxlLnRhYmxlTmFtZSxcclxuICBGRUVEQkFDS19TRUNSRVQ6ICdzZWNyZXQnLFxyXG4gIHVzZWRfdG9rZW5zX3RhYmxlOiB1c2VkVG9rZW5zVGFibGUudGFibGVOYW1lXHJcbn07XHJcblxyXG4gICAgIC8vIExhbWJkYSB0byBnZXQgdXNlciBpbmZvXHJcbmNvbnN0IGdldFZpc2l0b3JJbmZvTGFtYmRhID0gY3JlYXRlUHl0aG9uTGFtYmRhKFxyXG4gICdHZXRWaXNpdG9ySW5mb0xhbWJkYScsXHJcbiAgJ2dldFZpc2l0b3JJbmZvJyxcclxuICAnR2V0VmlzaXRvckluZm9MYW1iZGEnLFxyXG4gIGNvbW1vbkVudlxyXG4pO1xyXG5cclxuY29uc3Qgc3VibWl0RmVlZGJhY2tMYW1iZGEgPSBjcmVhdGVQeXRob25MYW1iZGEoXHJcbiAgJ1N1Ym1pdEZlZWRiYWNrTGFtYmRhJyxcclxuICAnc3VibWl0RmVlZGJhY2snLFxyXG4gICdTdWJtaXRGZWVkYmFja0xhbWJkYScsXHJcbiAgY29tbW9uRW52XHJcbik7XHJcblxyXG5jb25zdCBnZXRGZWVkYmFja0xhbWJkYSA9IGNyZWF0ZVB5dGhvbkxhbWJkYShcclxuICAnR2V0RmVlZGJhY2tMYW1iZGEnLFxyXG4gICdnZXRGZWVkYmFjaycsXHJcbiAgJ0dldEZlZWRiYWNrTGFtYmRhJyxcclxuICBjb21tb25FbnZcclxuKTtcclxuXHJcbiAgICB1c2VyVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGdldFZpc2l0b3JJbmZvTGFtYmRhKTtcclxuICAgIHVzZXJUYWJsZS5ncmFudFJlYWREYXRhKHN1Ym1pdEZlZWRiYWNrTGFtYmRhKTtcclxuXHJcbiAgICBmZWVkYmFja1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShzdWJtaXRGZWVkYmFja0xhbWJkYSk7XHJcbiAgICBmZWVkYmFja1RhYmxlLmdyYW50UmVhZERhdGEoZ2V0RmVlZGJhY2tMYW1iZGEpO1xyXG5cclxuICAgIHVzZWRUb2tlbnNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoZ2V0VmlzaXRvckluZm9MYW1iZGEpO1xyXG4gICAgdXNlZFRva2Vuc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShzdWJtaXRGZWVkYmFja0xhbWJkYSk7XHJcblxyXG5cclxuICAgIC8vIEFQSSBHYXRld2F5XHJcbiAgICBjb25zdCBhcGkgPSBuZXcgYXBpZ2F0ZXdheS5SZXN0QXBpKHRoaXMsICdGZWVkYmFja0FwaScsIHtcclxuICAgIHJlc3RBcGlOYW1lOiAnVmlzaXRvciBGZWVkYmFjayBBUEknLFxyXG4gICAgXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBnZXRWaXNpdG9ySW5mb1Jlc291cmNlID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2dldFZpc2l0b3JJbmZvJyk7XHJcbiAgICBnZXRWaXNpdG9ySW5mb1Jlc291cmNlLmFkZE1ldGhvZChcclxuICAgICdHRVQnLFxyXG4gICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZ2V0VmlzaXRvckluZm9MYW1iZGEsIHsgcHJveHk6IHRydWUgfSlcclxuICAgICk7XHJcblxyXG4gICAgY29uc3Qgc3VibWl0RmVlZGJhY2tSZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKCdzdWJtaXRGZWVkYmFjaycpO1xyXG4gICAgc3VibWl0RmVlZGJhY2tSZXNvdXJjZS5hZGRNZXRob2QoXHJcbiAgICAnUE9TVCcsXHJcbiAgICBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihzdWJtaXRGZWVkYmFja0xhbWJkYSwgeyBwcm94eTogdHJ1ZSB9KVxyXG4gICAgKTtcclxuXHJcbiAgICBjb25zdCBnZXRGZWVkYmFja1Jlc291cmNlID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2dldEZlZWRiYWNrJyk7XHJcbiAgICBnZXRGZWVkYmFja1Jlc291cmNlLmFkZE1ldGhvZChcclxuICAgICdHRVQnLFxyXG4gICAgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZ2V0RmVlZGJhY2tMYW1iZGEsIHsgcHJveHk6IHRydWUgfSlcclxuICAgICk7XHJcblxyXG4gICAgLy8gSGVscGVyIGZ1bmN0aW9uIHRvIGFkZCBPUFRJT05TIGZvciBDT1JTIHByZWZsaWdodFxyXG5jb25zdCBhZGRDb3JzT3B0aW9ucyA9IChhcGlSZXNvdXJjZTogYXBpZ2F0ZXdheS5JUmVzb3VyY2UpID0+IHtcclxuICBhcGlSZXNvdXJjZS5hZGRNZXRob2QoXHJcbiAgICAnT1BUSU9OUycsXHJcbiAgICBuZXcgYXBpZ2F0ZXdheS5Nb2NrSW50ZWdyYXRpb24oe1xyXG4gICAgICBpbnRlZ3JhdGlvblJlc3BvbnNlczogW3tcclxuICAgICAgICBzdGF0dXNDb2RlOiAnMjAwJyxcclxuICAgICAgICByZXNwb25zZVBhcmFtZXRlcnM6IHtcclxuICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOlxyXG4gICAgICAgICAgICBcIidDb250ZW50LVR5cGUsWC1BbXotRGF0ZSxBdXRob3JpemF0aW9uLFgtQXBpLUtleSxYLUFtei1TZWN1cml0eS1Ub2tlbidcIixcclxuICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IFwiJyonXCIsXHJcbiAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzJzogXCInR0VULFBPU1QsT1BUSU9OUydcIixcclxuICAgICAgICB9LFxyXG4gICAgICB9XSxcclxuICAgICAgcGFzc3Rocm91Z2hCZWhhdmlvcjogYXBpZ2F0ZXdheS5QYXNzdGhyb3VnaEJlaGF2aW9yLk5FVkVSLFxyXG4gICAgICByZXF1ZXN0VGVtcGxhdGVzOiB7XHJcbiAgICAgICAgJ2FwcGxpY2F0aW9uL2pzb24nOiAne1wic3RhdHVzQ29kZVwiOiAyMDB9J1xyXG4gICAgICB9LFxyXG4gICAgfSksXHJcbiAgICB7XHJcbiAgICAgIG1ldGhvZFJlc3BvbnNlczogW3tcclxuICAgICAgICBzdGF0dXNDb2RlOiAnMjAwJyxcclxuICAgICAgICByZXNwb25zZVBhcmFtZXRlcnM6IHtcclxuICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiB0cnVlLFxyXG4gICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6IHRydWUsXHJcbiAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiB0cnVlLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH1dLFxyXG4gICAgfVxyXG4gICk7XHJcbn07XHJcblxyXG4vLyBBZGQgQ09SUyBwcmVmbGlnaHQgdG8gZWFjaCByZXNvdXJjZVxyXG5hZGRDb3JzT3B0aW9ucyhnZXRWaXNpdG9ySW5mb1Jlc291cmNlKTtcclxuYWRkQ29yc09wdGlvbnMoc3VibWl0RmVlZGJhY2tSZXNvdXJjZSk7XHJcbmFkZENvcnNPcHRpb25zKGdldEZlZWRiYWNrUmVzb3VyY2UpO1xyXG5cclxuXHJcblxyXG4gICAgfVxyXG59Il19