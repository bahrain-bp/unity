import * as cdk from "aws-cdk-lib";
//import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { DBStack } from "./DBstack";
import { Construct } from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";

export class APIStack extends cdk.Stack {
  constructor(scope: Construct, id: string, dbStack: DBStack, props?: cdk.StackProps) {
    super(scope, id, props);

    // Ensure DBStack is created before APIStack
    this.addDependency(dbStack);

    // DynamoDB Outputs (already present)
    new cdk.CfnOutput(this, "BahtwinTableName", {
      value: dbStack.table.tableName,
      description: "Name of the DynamoDB table used by BAHTWIN",
    });

    new cdk.CfnOutput(this, "BahtwinTableArn", {
      value: dbStack.table.tableArn,
      description: "ARN of the DynamoDB table used by BAHTWIN",
    });

    // ────────────────────────────────
    // 1. Cognito User Pool
    // ────────────────────────────────
    const userPool = new cognito.UserPool(this, "UnityUserPool", {
      userPoolName: "unity-users",
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      standardAttributes: {
        email: { required: true, mutable: false },
      },
      passwordPolicy: {
        minLength: 8,
        requireDigits: true,
        requireLowercase: true,
        requireUppercase: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
    });

    const userPoolClient = new cognito.UserPoolClient(this, "UnityUserPoolClient", {
      userPool,
      generateSecret: false,
      authFlows: { userSrp: true, userPassword: true },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        callbackUrls: ["http://localhost:3000/callback"],
        logoutUrls: ["http://localhost:3000/"],
      },
    });

    const userPoolDomain = new cognito.UserPoolDomain(this, "UnityUserPoolDomain", {
      userPool,
      cognitoDomain: { domainPrefix: `unity-${this.account}-dev` },
    });

    new cdk.CfnOutput(this, "UserPoolId", {
      value: userPool.userPoolId,
    });
    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.userPoolClientId,
    });
    new cdk.CfnOutput(this, "UserPoolDomainUrl", {
      value: userPoolDomain.baseUrl(),
    });

    // ────────────────────────────────
    // 2. Lambda Function
    // ────────────────────────────────
    const helloFn = new lambda.Function(this, "HelloHandler", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "hello.handler", // points to lambda/hello.ts (exported handler)
      code: lambda.Code.fromAsset("lambda"),
      environment: {
        TABLE_NAME: dbStack.table.tableName,
        USER_POOL_ID: userPool.userPoolId,
      },
    });

    // ────────────────────────────────
    // 3. API Gateway + Cognito Authorizer
    // ────────────────────────────────
    const api = new apigw.RestApi(this, "UnityRestApi", {
      restApiName: "Unity Service",
      deployOptions: { stageName: "dev" },
    });

    const authorizer = new apigw.CognitoUserPoolsAuthorizer(this, "UnityCognitoAuthorizer", {
      cognitoUserPools: [userPool],
    });

    const helloResource = api.root.addResource("hello");

    helloResource.addMethod(
      "GET",
      new apigw.LambdaIntegration(helloFn),
      {
        authorizer,
        authorizationType: apigw.AuthorizationType.COGNITO,
      }
    );

    new cdk.CfnOutput(this, "UnityApiUrl", {
      value: api.url,
    });
  }
}


// UserPoolId: us-east-1_L9gwjH6sW

// UserPoolClientId: 36ctbjavcongmipvlrerann32t

// UserPoolDomainUrl: https://unity-959171913764-dev.auth.us-east-1.amazoncognito.com

// API URL: https://g3k3s3jhqk.execute-api.us-east-1.amazonaws.com/dev/
