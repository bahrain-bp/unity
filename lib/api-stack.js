"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APIStack = void 0;
const cdk = require("aws-cdk-lib");
const cognito = require("aws-cdk-lib/aws-cognito");
const apigw = require("aws-cdk-lib/aws-apigateway");
const lambda = require("aws-cdk-lib/aws-lambda");
class APIStack extends cdk.Stack {
    constructor(scope, id, dbStack, props) {
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
        helloResource.addMethod("GET", new apigw.LambdaIntegration(helloFn), {
            authorizer,
            authorizationType: apigw.AuthorizationType.COGNITO,
        });
        new cdk.CfnOutput(this, "UnityApiUrl", {
            value: api.url,
        });
    }
}
exports.APIStack = APIStack;
// UserPoolId: us-east-1_L9gwjH6sW
// UserPoolClientId: 36ctbjavcongmipvlrerann32t
// UserPoolDomainUrl: https://unity-959171913764-dev.auth.us-east-1.amazoncognito.com
// API URL: https://g3k3s3jhqk.execute-api.us-east-1.amazonaws.com/dev/
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBpLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXBpLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUFtQztBQUluQyxtREFBbUQ7QUFDbkQsb0RBQW9EO0FBQ3BELGlEQUFpRDtBQUVqRCxNQUFhLFFBQVMsU0FBUSxHQUFHLENBQUMsS0FBSztJQUNyQyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLE9BQWdCLEVBQUUsS0FBc0I7UUFDaEYsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsNENBQTRDO1FBQzVDLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFNUIscUNBQXFDO1FBQ3JDLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsa0JBQWtCLEVBQUU7WUFDMUMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsU0FBUztZQUM5QixXQUFXLEVBQUUsNENBQTRDO1NBQzFELENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLEVBQUU7WUFDekMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsUUFBUTtZQUM3QixXQUFXLEVBQUUsMkNBQTJDO1NBQ3pELENBQUMsQ0FBQztRQUVILG1DQUFtQztRQUNuQyx1QkFBdUI7UUFDdkIsbUNBQW1DO1FBQ25DLE1BQU0sUUFBUSxHQUFHLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQzNELFlBQVksRUFBRSxhQUFhO1lBQzNCLGlCQUFpQixFQUFFLElBQUk7WUFDdkIsYUFBYSxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRTtZQUM5QixrQkFBa0IsRUFBRTtnQkFDbEIsS0FBSyxFQUFFLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFO2FBQzFDO1lB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QUNGLENBQUM7UUFFRixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRTtZQUNyQyxLQUFLLEVBQUUsR0FBRyxDQUFDLEdBQUc7U0FDZixDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUF4R0QsNEJBd0dDO0FBR0Qsa0NBQWtDO0FBRWxDLCtDQUErQztBQUUvQyxxRkFBcUY7QUFFckYsdUVBQXVFIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gXCJhd3MtY2RrLWxpYlwiO1xuLy9pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheVwiO1xuaW1wb3J0IHsgREJTdGFjayB9IGZyb20gXCIuL0RCc3RhY2tcIjtcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gXCJjb25zdHJ1Y3RzXCI7XG5pbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtY29nbml0b1wiO1xuaW1wb3J0ICogYXMgYXBpZ3cgZnJvbSBcImF3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5XCI7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSBcImF3cy1jZGstbGliL2F3cy1sYW1iZGFcIjtcblxuZXhwb3J0IGNsYXNzIEFQSVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgZGJTdGFjazogREJTdGFjaywgcHJvcHM/OiBjZGsuU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gRW5zdXJlIERCU3RhY2sgaXMgY3JlYXRlZCBiZWZvcmUgQVBJU3RhY2tcbiAgICB0aGlzLmFkZERlcGVuZGVuY3koZGJTdGFjayk7XG5cbiAgICAvLyBEeW5hbW9EQiBPdXRwdXRzIChhbHJlYWR5IHByZXNlbnQpXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJCYWh0d2luVGFibGVOYW1lXCIsIHtcbiAgICAgIHZhbHVlOiBkYlN0YWNrLnRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiBcIk5hbWUgb2YgdGhlIER5bmFtb0RCIHRhYmxlIHVzZWQgYnkgQkFIVFdJTlwiLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJCYWh0d2luVGFibGVBcm5cIiwge1xuICAgICAgdmFsdWU6IGRiU3RhY2sudGFibGUudGFibGVBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogXCJBUk4gb2YgdGhlIER5bmFtb0RCIHRhYmxlIHVzZWQgYnkgQkFIVFdJTlwiLFxuICAgIH0pO1xuXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4gICAgLy8gMS4gQ29nbml0byBVc2VyIFBvb2xcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbiAgICBjb25zdCB1c2VyUG9vbCA9IG5ldyBjb2duaXRvLlVzZXJQb29sKHRoaXMsIFwiVW5pdHlVc2VyUG9vbFwiLCB7XG4gICAgICB1c2VyUG9vbE5hbWU6IFwidW5pdHktdXNlcnNcIixcbiAgICAgIHNlbGZTaWduVXBFbmFibGVkOiB0cnVlLFxuICAgICAgc2lnbkluQWxpYXNlczogeyBlbWFpbDogdHJ1ZSB9LFxuICAgICAgc3RhbmRhcmRBdHRyaWJ1dGVzOiB7XG4gICAgICAgIGVtYWlsOiB7IHJlcXVpcmVkOiB0cnVlLCBtdXRhYmxlOiBmYWxzZSB9LFxuICAgICAgfSxcbiAgICAgIHBhc3N3b3JkUG9saWN5OiB7XG4gICAgICAgIG1pbkxlbmd0aDogOCxcbiAgICAgICAgcmVxdWlyZURpZ2l0czogdHJ1ZSxcbiAgICAgICAgcmVxdWlyZUxvd2VyY2FzZTogdHJ1ZSxcbiAgICAgICAgcmVxdWlyZVVwcGVyY2FzZTogdHJ1ZSxcbiAgICAgICAgcmVxdWlyZVN5bWJvbHM6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIGFjY291bnRSZWNvdmVyeTogY29nbml0by5BY2NvdW50UmVjb3ZlcnkuRU1BSUxfT05MWSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHVzZXJQb29sQ2xpZW50ID0gbmV3IGNvZ25pdG8uVXNlclBvb2xDbGllbnQodGhpcywgXCJVbml0eVVzZXJQb29sQ2xpZW50XCIsIHtcbiAgICAgIHVzZXJQb29sLFxuICAgICAgZ2VuZXJhdGVTZWNyZXQ6IGZhbHNlLFxuICAgICAgYXV0aEZsb3dzOiB7IHVzZXJTcnA6IHRydWUsIHVzZXJQYXNzd29yZDogdHJ1ZSB9LFxuICAgICAgb0F1dGg6IHtcbiAgICAgICAgZmxvd3M6IHsgYXV0aG9yaXphdGlvbkNvZGVHcmFudDogdHJ1ZSB9LFxuICAgICAgICBjYWxsYmFja1VybHM6IFtcImh0dHA6Ly9sb2NhbGhvc3Q6MzAwMC9jYWxsYmFja1wiXSxcbiAgICAgICAgbG9nb3V0VXJsczogW1wiaHR0cDovL2xvY2FsaG9zdDozMDAwL1wiXSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCB1c2VyUG9vbERvbWFpbiA9IG5ldyBjb2duaXRvLlVzZXJQb29sRG9tYWluKHRoaXMsIFwiVW5pdHlVc2VyUG9vbERvbWFpblwiLCB7XG4gICAgICB1c2VyUG9vbCxcbiAgICAgIGNvZ25pdG9Eb21haW46IHsgZG9tYWluUHJlZml4OiBgdW5pdHktJHt0aGlzLmFjY291bnR9LWRldmAgfSxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiVXNlclBvb2xJZFwiLCB7XG4gICAgICB2YWx1ZTogdXNlclBvb2wudXNlclBvb2xJZCxcbiAgICB9KTtcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIlVzZXJQb29sQ2xpZW50SWRcIiwge1xuICAgICAgdmFsdWU6IHVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXG4gICAgfSk7XG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJVc2VyUG9vbERvbWFpblVybFwiLCB7XG4gICAgICB2YWx1ZTogdXNlclBvb2xEb21haW4uYmFzZVVybCgpLFxuICAgIH0pO1xuXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4gICAgLy8gMi4gTGFtYmRhIEZ1bmN0aW9uXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4gICAgY29uc3QgaGVsbG9GbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgXCJIZWxsb0hhbmRsZXJcIiwge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiBcImhlbGxvLmhhbmRsZXJcIiwgLy8gcG9pbnRzIHRvIGxhbWJkYS9oZWxsby50cyAoZXhwb3J0ZWQgaGFuZGxlcilcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcImxhbWJkYVwiKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFRBQkxFX05BTUU6IGRiU3RhY2sudGFibGUudGFibGVOYW1lLFxuICAgICAgICBVU0VSX1BPT0xfSUQ6IHVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4gICAgLy8gMy4gQVBJIEdhdGV3YXkgKyBDb2duaXRvIEF1dGhvcml6ZXJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbiAgICBjb25zdCBhcGkgPSBuZXcgYXBpZ3cuUmVzdEFwaSh0aGlzLCBcIlVuaXR5UmVzdEFwaVwiLCB7XG4gICAgICByZXN0QXBpTmFtZTogXCJVbml0eSBTZXJ2aWNlXCIsXG4gICAgICBkZXBsb3lPcHRpb25zOiB7IHN0YWdlTmFtZTogXCJkZXZcIiB9LFxuICAgIH0pO1xuXG4gICAgY29uc3QgYXV0aG9yaXplciA9IG5ldyBhcGlndy5Db2duaXRvVXNlclBvb2xzQXV0aG9yaXplcih0aGlzLCBcIlVuaXR5Q29nbml0b0F1dGhvcml6ZXJcIiwge1xuICAgICAgY29nbml0b1VzZXJQb29sczogW3VzZXJQb29sXSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGhlbGxvUmVzb3VyY2UgPSBhcGkucm9vdC5hZGRSZXNvdXJjZShcImhlbGxvXCIpO1xuXG4gICAgaGVsbG9SZXNvdXJjZS5hZGRNZXRob2QoXG4gICAgICBcIkdFVFwiLFxuICAgICAgbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKGhlbGxvRm4pLFxuICAgICAge1xuICAgICAgICBhdXRob3JpemVyLFxuICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ3cuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJVbml0eUFwaVVybFwiLCB7XG4gICAgICB2YWx1ZTogYXBpLnVybCxcbiAgICB9KTtcbiAgfVxufVxuXG5cbi8vIFVzZXJQb29sSWQ6IHVzLWVhc3QtMV9MOWd3akg2c1dcblxuLy8gVXNlclBvb2xDbGllbnRJZDogMzZjdGJqYXZjb25nbWlwdmxyZXJhbm4zMnRcblxuLy8gVXNlclBvb2xEb21haW5Vcmw6IGh0dHBzOi8vdW5pdHktOTU5MTcxOTEzNzY0LWRldi5hdXRoLnVzLWVhc3QtMS5hbWF6b25jb2duaXRvLmNvbVxuXG4vLyBBUEkgVVJMOiBodHRwczovL2czazNzM2pocWsuZXhlY3V0ZS1hcGkudXMtZWFzdC0xLmFtYXpvbmF3cy5jb20vZGV2L1xuIl19