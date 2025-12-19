import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'path';

interface VisitorFeedbackStackProps extends cdk.StackProps {
  userTable: dynamodb.Table; // pass the table from another stack
  broadcastLambda: lambda.IFunction;
}

export class VisitorFeedbackStack extends cdk.Stack{
    userTable: dynamodb.Table;
    broadcastLambda: lambda.Function;
    constructor(scope: Construct, id: string, props: VisitorFeedbackStackProps){
        super(scope,id,props);
         const { userTable, broadcastLambda } = props;

  
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

const createPythonLambda = (id: string, handlerFile: string, functionName: string, env: { [key: string]: string }) => {
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
const getVisitorInfoLambda = createPythonLambda(
  'GetVisitorInfoLambda',
  'getVisitorInfo',
  'GetVisitorInfoLambda',
  commonEnv
);

const submitFeedbackLambda = createPythonLambda(
  'SubmitFeedbackLambda',
  'submitFeedback',
  'SubmitFeedbackLambda',
  commonEnv
);

const getFeedbackLambda = createPythonLambda(
  'GetFeedbackLambda',
  'getFeedback',
  'GetFeedbackLambda',
  commonEnv
);

    userTable.grantReadWriteData(getVisitorInfoLambda);
    userTable.grantReadData(submitFeedbackLambda);

    feedbackTable.grantReadWriteData(submitFeedbackLambda);
    feedbackTable.grantReadData(getFeedbackLambda);

    usedTokensTable.grantReadWriteData(getVisitorInfoLambda);
    usedTokensTable.grantReadWriteData(submitFeedbackLambda);

    const submitFeedbackrRole = submitFeedbackLambda.role!;
    broadcastLambda.grantInvoke(submitFeedbackrRole);


    const LoadFeedback = new lambda.Function(this, 'LoadFeedback',{
      runtime: lambda.Runtime.PYTHON_3_11,
      handler:'LoadFeedback.handler',
      code: lambda.Code.fromAsset('lambda'),
      environment:{
        FEEDBACK_TABLE: feedbackTable.tableName,
      },
      timeout:cdk.Duration.seconds(30),
      functionName: 'LoadFeedback', 
      logRetention: logs.RetentionDays.ONE_DAY,
    });
    feedbackTable.grantReadData(LoadFeedback);



    // API Gateway
    const api = new apigateway.RestApi(this, 'FeedbackApi', {
    restApiName: 'Visitor Feedback API',
    
    });

    const getVisitorInfoResource = api.root.addResource('getVisitorInfo');
    getVisitorInfoResource.addMethod(
    'GET',
    new apigateway.LambdaIntegration(getVisitorInfoLambda, { proxy: true })
    );

    const submitFeedbackResource = api.root.addResource('submitFeedback');
    submitFeedbackResource.addMethod(
    'POST',
    new apigateway.LambdaIntegration(submitFeedbackLambda, { proxy: true })
    );

    const getFeedbackResource = api.root.addResource('getFeedback');
    getFeedbackResource.addMethod(
    'GET',
    new apigateway.LambdaIntegration(getFeedbackLambda, { proxy: true })
    );

    const adminResource = api.root.addResource('admin');
    const load_feedbackResource = adminResource.addResource('loadFeedback')
    load_feedbackResource.addMethod(
    'POST',
    new apigateway.LambdaIntegration(LoadFeedback, { proxy: true })
    );

    // Helper function to add OPTIONS for CORS preflight
const addCorsOptions = (apiResource: apigateway.IResource) => {
  apiResource.addMethod(
    'OPTIONS',
    new apigateway.MockIntegration({
      integrationResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Headers':
            "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
          'method.response.header.Access-Control-Allow-Origin': "'*'",
          'method.response.header.Access-Control-Allow-Methods': "'GET,POST,OPTIONS'",
        },
      }],
      passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
      requestTemplates: {
        'application/json': '{"statusCode": 200}'
      },
    }),
    {
      methodResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Headers': true,
          'method.response.header.Access-Control-Allow-Methods': true,
          'method.response.header.Access-Control-Allow-Origin': true,
        },
      }],
    }
  );
};

// Add CORS preflight to each resource
addCorsOptions(getVisitorInfoResource);
addCorsOptions(submitFeedbackResource);
addCorsOptions(getFeedbackResource);
addCorsOptions(load_feedbackResource);



    }
}