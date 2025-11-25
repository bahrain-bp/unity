"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APIStack = void 0;
const cdk = require("aws-cdk-lib");
const cognito = require("aws-cdk-lib/aws-cognito");
const apigw = require("aws-cdk-lib/aws-apigateway");
const lambda = require("aws-cdk-lib/aws-lambda");
const iot = require("aws-cdk-lib/aws-iot");
const dynamodb = require("aws-cdk-lib/aws-dynamodb");
const iam = require("aws-cdk-lib/aws-iam");
const aws_lambda_nodejs_1 = require("aws-cdk-lib/aws-lambda-nodejs");
const path = require("path");
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
        // 2. Lambda Function (hello)
        // ────────────────────────────────
        const helloFn = new lambda.Function(this, "HelloHandler", {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: "hello.handler", // points to lambda/hello.ts -> compiled to JS in /lambda
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
        // ────────────────────────────────
        // 4) IoT Core: Thing + Policy
        // ────────────────────────────────
        const thingName = "pi3-01";
        const piThing = new iot.CfnThing(this, "PiThing", { thingName });
        const piPolicy = new iot.CfnPolicy(this, "PiPolicy", {
            policyName: "Pi3Policy",
            policyDocument: {
                Version: "2012-10-17",
                Statement: [
                    {
                        Effect: "Allow",
                        Action: ["iot:Connect"],
                        Resource: [`arn:aws:iot:${this.region}:${this.account}:client/${thingName}*`],
                    },
                    {
                        Effect: "Allow",
                        Action: ["iot:Publish"],
                        Resource: [`arn:aws:iot:${this.region}:${this.account}:topic/${thingName}/#`],
                    },
                    {
                        Effect: "Allow",
                        Action: ["iot:Receive"],
                        Resource: [`arn:aws:iot:${this.region}:${this.account}:topic/${thingName}/#`],
                    },
                    {
                        Effect: "Allow",
                        Action: ["iot:Subscribe"],
                        Resource: [`arn:aws:iot:${this.region}:${this.account}:topicfilter/${thingName}/#`],
                    },
                ],
            },
        });
        // ────────────────────────────────
        // 5) DynamoDB table for telemetry
        //    PK=device (string), SK=ts (number, epoch seconds)
        // ────────────────────────────────
        const telemTable = new dynamodb.Table(this, "TelemetryTable", {
            tableName: "PiTelemetry",
            partitionKey: { name: "device", type: dynamodb.AttributeType.STRING },
            sortKey: { name: "ts", type: dynamodb.AttributeType.NUMBER },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY, // change to RETAIN in prod
        });
        new cdk.CfnOutput(this, "TelemetryTableName", { value: telemTable.tableName });
        // ────────────────────────────────
        // 6) IoT Rule → DynamoDB (v2 action)
        // ────────────────────────────────
        const iotRuleRole = new iam.Role(this, "IotRuleDdbRole", {
            assumedBy: new iam.ServicePrincipal("iot.amazonaws.com"),
        });
        telemTable.grantWriteData(iotRuleRole);
        new iot.CfnTopicRule(this, "SavePiTelemetryRule", {
            topicRulePayload: {
                sql: "SELECT device, ts, temp_c, humidity FROM 'pi3-01/telemetry'",
                actions: [
                    {
                        dynamoDBv2: {
                            putItem: { tableName: telemTable.tableName },
                            roleArn: iotRuleRole.roleArn,
                        },
                    },
                ],
                ruleDisabled: false,
                awsIotSqlVersion: "2016-03-23",
            },
        });
        // ────────────────────────────────
        // 7) Lambda (TypeScript) + API to read it back
        //    GET /telemetry?device=pi3-01&limit=25
        // ────────────────────────────────
        const telemetryGetFn = new aws_lambda_nodejs_1.NodejsFunction(this, "TelemetryGetHandler", {
            runtime: lambda.Runtime.NODEJS_18_X,
            entry: path.join(__dirname, "../lambda/telemetry-get.ts"),
            handler: "handler",
            bundling: {
                target: "node18",
                minify: true,
                sourceMap: false,
            },
            environment: {
                TELEMETRY_TABLE: telemTable.tableName,
            },
        });
        telemTable.grantReadData(telemetryGetFn);
        const telemetryResource = api.root.addResource("telemetry");
        telemetryResource.addMethod("GET", new apigw.LambdaIntegration(telemetryGetFn), {
            authorizationType: apigw.AuthorizationType.NONE, // switch to COGNITO later if desired
        });
        // Useful outputs
        new cdk.CfnOutput(this, "PiThingName", { value: thingName });
        new cdk.CfnOutput(this, "PiPolicyName", { value: piPolicy.policyName });
    }
}
exports.APIStack = APIStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBpLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXBpLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUFtQztBQUluQyxtREFBbUQ7QUFDbkQsb0RBQW9EO0FBQ3BELGlEQUFpRDtBQUNqRCwyQ0FBMkM7QUFDM0MscURBQXFEO0FBQ3JELDJDQUEyQztBQUMzQyxxRUFBK0Q7QUFDL0QsNkJBQTZCO0FBRTdCLE1BQWEsUUFBUyxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3JDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsT0FBZ0IsRUFBRSxLQUFzQjtRQUNoRixLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4Qiw0Q0FBNEM7UUFDNUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUU1QixxQ0FBcUM7UUFDckMsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxrQkFBa0IsRUFBRTtZQUMxQyxLQUFLLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxTQUFTO1lBQzlCLFdBQVcsRUFBRSw0Q0FBNEM7U0FDMUQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRTtZQUN6QyxLQUFLLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxRQUFRO1lBQzdCLFdBQVcsRUFBRSwyQ0FBMkM7U0FDekQsQ0FBQyxDQUFDO1FBRUgsbUNBQW1DO1FBQ25DLHVCQUF1QjtRQUN2QixtQ0FBbUM7UUFDbkMsTUFBTSxRQUFRLEdBQUcsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDM0QsWUFBWSxFQUFFLGFBQWE7WUFDM0IsaUJBQWlCLEVBQUUsSUFBSTtZQUN2QixhQUFhLEVBQUUsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFO1lBQzlCLGtCQUFrQixFQUFFO2dCQUNs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QUFFLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLEVBQUUscUNBQXFDO1NBQ3ZGLENBQUMsQ0FBQztRQUVILGlCQUFpQjtRQUNqQixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRSxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDO1FBQzdELElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFLEVBQUUsS0FBSyxFQUFFLFFBQVEsQ0FBQyxVQUFXLEVBQUUsQ0FBQyxDQUFDO0lBQzNFLENBQUM7Q0FDRjtBQTFNRCw0QkEwTUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSBcImF3cy1jZGstbGliXCI7XHJcbi8vaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXlcIjtcclxuaW1wb3J0IHsgREJTdGFjayB9IGZyb20gXCIuL0RCc3RhY2tcIjtcclxuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSBcImNvbnN0cnVjdHNcIjtcclxuaW1wb3J0ICogYXMgY29nbml0byBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWNvZ25pdG9cIjtcclxuaW1wb3J0ICogYXMgYXBpZ3cgZnJvbSBcImF3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5XCI7XHJcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWxhbWJkYVwiO1xyXG5pbXBvcnQgKiBhcyBpb3QgZnJvbSBcImF3cy1jZGstbGliL2F3cy1pb3RcIjtcclxuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSBcImF3cy1jZGstbGliL2F3cy1keW5hbW9kYlwiO1xyXG5pbXBvcnQgKiBhcyBpYW0gZnJvbSBcImF3cy1jZGstbGliL2F3cy1pYW1cIjtcclxuaW1wb3J0IHsgTm9kZWpzRnVuY3Rpb24gfSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWxhbWJkYS1ub2RlanNcIjtcclxuaW1wb3J0ICogYXMgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5cclxuZXhwb3J0IGNsYXNzIEFQSVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcclxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBkYlN0YWNrOiBEQlN0YWNrLCBwcm9wcz86IGNkay5TdGFja1Byb3BzKSB7XHJcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcclxuXHJcbiAgICAvLyBFbnN1cmUgREJTdGFjayBpcyBjcmVhdGVkIGJlZm9yZSBBUElTdGFja1xyXG4gICAgdGhpcy5hZGREZXBlbmRlbmN5KGRiU3RhY2spO1xyXG5cclxuICAgIC8vIER5bmFtb0RCIE91dHB1dHMgKGFscmVhZHkgcHJlc2VudClcclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiQmFodHdpblRhYmxlTmFtZVwiLCB7XHJcbiAgICAgIHZhbHVlOiBkYlN0YWNrLnRhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgZGVzY3JpcHRpb246IFwiTmFtZSBvZiB0aGUgRHluYW1vREIgdGFibGUgdXNlZCBieSBCQUhUV0lOXCIsXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIkJhaHR3aW5UYWJsZUFyblwiLCB7XHJcbiAgICAgIHZhbHVlOiBkYlN0YWNrLnRhYmxlLnRhYmxlQXJuLFxyXG4gICAgICBkZXNjcmlwdGlvbjogXCJBUk4gb2YgdGhlIER5bmFtb0RCIHRhYmxlIHVzZWQgYnkgQkFIVFdJTlwiLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICAvLyAxLiBDb2duaXRvIFVzZXIgUG9vbFxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICBjb25zdCB1c2VyUG9vbCA9IG5ldyBjb2duaXRvLlVzZXJQb29sKHRoaXMsIFwiVW5pdHlVc2VyUG9vbFwiLCB7XHJcbiAgICAgIHVzZXJQb29sTmFtZTogXCJ1bml0eS11c2Vyc1wiLFxyXG4gICAgICBzZWxmU2lnblVwRW5hYmxlZDogdHJ1ZSxcclxuICAgICAgc2lnbkluQWxpYXNlczogeyBlbWFpbDogdHJ1ZSB9LFxyXG4gICAgICBzdGFuZGFyZEF0dHJpYnV0ZXM6IHtcclxuICAgICAgICBlbWFpbDogeyByZXF1aXJlZDogdHJ1ZSwgbXV0YWJsZTogZmFsc2UgfSxcclxuICAgICAgfSxcclxuICAgICAgcGFzc3dvcmRQb2xpY3k6IHtcclxuICAgICAgICBtaW5MZW5ndGg6IDgsXHJcbiAgICAgICAgcmVxdWlyZURpZ2l0czogdHJ1ZSxcclxuICAgICAgICByZXF1aXJlTG93ZXJjYXNlOiB0cnVlLFxyXG4gICAgICAgIHJlcXVpcmVVcHBlcmNhc2U6IHRydWUsXHJcbiAgICAgICAgcmVxdWlyZVN5bWJvbHM6IGZhbHNlLFxyXG4gICAgICB9LFxyXG4gICAgICBhY2NvdW50UmVjb3Zlcnk6IGNvZ25pdG8uQWNjb3VudFJlY292ZXJ5LkVNQUlMX09OTFksXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCB1c2VyUG9vbENsaWVudCA9IG5ldyBjb2duaXRvLlVzZXJQb29sQ2xpZW50KHRoaXMsIFwiVW5pdHlVc2VyUG9vbENsaWVudFwiLCB7XHJcbiAgICAgIHVzZXJQb29sLFxyXG4gICAgICBnZW5lcmF0ZVNlY3JldDogZmFsc2UsXHJcbiAgICAgIGF1dGhGbG93czogeyB1c2VyU3JwOiB0cnVlLCB1c2VyUGFzc3dvcmQ6IHRydWUgfSxcclxuICAgICAgb0F1dGg6IHtcclxuICAgICAgICBmbG93czogeyBhdXRob3JpemF0aW9uQ29kZUdyYW50OiB0cnVlIH0sXHJcbiAgICAgICAgY2FsbGJhY2tVcmxzOiBbXCJodHRwOi8vbG9jYWxob3N0OjMwMDAvY2FsbGJhY2tcIl0sXHJcbiAgICAgICAgbG9nb3V0VXJsczogW1wiaHR0cDovL2xvY2FsaG9zdDozMDAwL1wiXSxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHVzZXJQb29sRG9tYWluID0gbmV3IGNvZ25pdG8uVXNlclBvb2xEb21haW4odGhpcywgXCJVbml0eVVzZXJQb29sRG9tYWluXCIsIHtcclxuICAgICAgdXNlclBvb2wsXHJcbiAgICAgIGNvZ25pdG9Eb21haW46IHsgZG9tYWluUHJlZml4OiBgdW5pdHktJHt0aGlzLmFjY291bnR9LWRldmAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiVXNlclBvb2xJZFwiLCB7XHJcbiAgICAgIHZhbHVlOiB1c2VyUG9vbC51c2VyUG9vbElkLFxyXG4gICAgfSk7XHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIlVzZXJQb29sQ2xpZW50SWRcIiwge1xyXG4gICAgICB2YWx1ZTogdXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcclxuICAgIH0pO1xyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJVc2VyUG9vbERvbWFpblVybFwiLCB7XHJcbiAgICAgIHZhbHVlOiB1c2VyUG9vbERvbWFpbi5iYXNlVXJsKCksXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIC8vIDIuIExhbWJkYSBGdW5jdGlvbiAoaGVsbG8pXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIGNvbnN0IGhlbGxvRm4gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsIFwiSGVsbG9IYW5kbGVyXCIsIHtcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXHJcbiAgICAgIGhhbmRsZXI6IFwiaGVsbG8uaGFuZGxlclwiLCAvLyBwb2ludHMgdG8gbGFtYmRhL2hlbGxvLnRzIC0+IGNvbXBpbGVkIHRvIEpTIGluIC9sYW1iZGFcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KFwibGFtYmRhXCIpLFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIFRBQkxFX05BTUU6IGRiU3RhY2sudGFibGUudGFibGVOYW1lLFxyXG4gICAgICAgIFVTRVJfUE9PTF9JRDogdXNlclBvb2wudXNlclBvb2xJZCxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgLy8gMy4gQVBJIEdhdGV3YXkgKyBDb2duaXRvIEF1dGhvcml6ZXJcclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgY29uc3QgYXBpID0gbmV3IGFwaWd3LlJlc3RBcGkodGhpcywgXCJVbml0eVJlc3RBcGlcIiwge1xyXG4gICAgICByZXN0QXBpTmFtZTogXCJVbml0eSBTZXJ2aWNlXCIsXHJcbiAgICAgIGRlcGxveU9wdGlvbnM6IHsgc3RhZ2VOYW1lOiBcImRldlwiIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBhdXRob3JpemVyID0gbmV3IGFwaWd3LkNvZ25pdG9Vc2VyUG9vbHNBdXRob3JpemVyKHRoaXMsIFwiVW5pdHlDb2duaXRvQXV0aG9yaXplclwiLCB7XHJcbiAgICAgIGNvZ25pdG9Vc2VyUG9vbHM6IFt1c2VyUG9vbF0sXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBoZWxsb1Jlc291cmNlID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoXCJoZWxsb1wiKTtcclxuICAgIGhlbGxvUmVzb3VyY2UuYWRkTWV0aG9kKFwiR0VUXCIsIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbihoZWxsb0ZuKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ3cuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiVW5pdHlBcGlVcmxcIiwge1xyXG4gICAgICB2YWx1ZTogYXBpLnVybCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgLy8gNCkgSW9UIENvcmU6IFRoaW5nICsgUG9saWN5XHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIGNvbnN0IHRoaW5nTmFtZSA9IFwicGkzLTAxXCI7XHJcblxyXG4gICAgY29uc3QgcGlUaGluZyA9IG5ldyBpb3QuQ2ZuVGhpbmcodGhpcywgXCJQaVRoaW5nXCIsIHsgdGhpbmdOYW1lIH0pO1xyXG5cclxuICAgIGNvbnN0IHBpUG9saWN5ID0gbmV3IGlvdC5DZm5Qb2xpY3kodGhpcywgXCJQaVBvbGljeVwiLCB7XHJcbiAgICAgIHBvbGljeU5hbWU6IFwiUGkzUG9saWN5XCIsXHJcbiAgICAgIHBvbGljeURvY3VtZW50OiB7XHJcbiAgICAgICAgVmVyc2lvbjogXCIyMDEyLTEwLTE3XCIsXHJcbiAgICAgICAgU3RhdGVtZW50OiBbXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIEVmZmVjdDogXCJBbGxvd1wiLFxyXG4gICAgICAgICAgICBBY3Rpb246IFtcImlvdDpDb25uZWN0XCJdLFxyXG4gICAgICAgICAgICBSZXNvdXJjZTogW2Bhcm46YXdzOmlvdDoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06Y2xpZW50LyR7dGhpbmdOYW1lfSpgXSxcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIEVmZmVjdDogXCJBbGxvd1wiLFxyXG4gICAgICAgICAgICBBY3Rpb246IFtcImlvdDpQdWJsaXNoXCJdLFxyXG4gICAgICAgICAgICBSZXNvdXJjZTogW2Bhcm46YXdzOmlvdDoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06dG9waWMvJHt0aGluZ05hbWV9LyNgXSxcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIEVmZmVjdDogXCJBbGxvd1wiLFxyXG4gICAgICAgICAgICBBY3Rpb246IFtcImlvdDpSZWNlaXZlXCJdLFxyXG4gICAgICAgICAgICBSZXNvdXJjZTogW2Bhcm46YXdzOmlvdDoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06dG9waWMvJHt0aGluZ05hbWV9LyNgXSxcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIEVmZmVjdDogXCJBbGxvd1wiLFxyXG4gICAgICAgICAgICBBY3Rpb246IFtcImlvdDpTdWJzY3JpYmVcIl0sXHJcbiAgICAgICAgICAgIFJlc291cmNlOiBbYGFybjphd3M6aW90OiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTp0b3BpY2ZpbHRlci8ke3RoaW5nTmFtZX0vI2BdLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICBdLFxyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICAvLyA1KSBEeW5hbW9EQiB0YWJsZSBmb3IgdGVsZW1ldHJ5XHJcbiAgICAvLyAgICBQSz1kZXZpY2UgKHN0cmluZyksIFNLPXRzIChudW1iZXIsIGVwb2NoIHNlY29uZHMpXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIGNvbnN0IHRlbGVtVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgXCJUZWxlbWV0cnlUYWJsZVwiLCB7XHJcbiAgICAgIHRhYmxlTmFtZTogXCJQaVRlbGVtZXRyeVwiLFxyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogXCJkZXZpY2VcIiwgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc29ydEtleTogeyBuYW1lOiBcInRzXCIsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSIH0sXHJcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksIC8vIGNoYW5nZSB0byBSRVRBSU4gaW4gcHJvZFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJUZWxlbWV0cnlUYWJsZU5hbWVcIiwgeyB2YWx1ZTogdGVsZW1UYWJsZS50YWJsZU5hbWUgfSk7XHJcblxyXG4gICAgLy8g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICAvLyA2KSBJb1QgUnVsZSDihpIgRHluYW1vREIgKHYyIGFjdGlvbilcclxuICAgIC8vIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgY29uc3QgaW90UnVsZVJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgXCJJb3RSdWxlRGRiUm9sZVwiLCB7XHJcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKFwiaW90LmFtYXpvbmF3cy5jb21cIiksXHJcbiAgICB9KTtcclxuICAgIHRlbGVtVGFibGUuZ3JhbnRXcml0ZURhdGEoaW90UnVsZVJvbGUpO1xyXG5cclxuICAgIG5ldyBpb3QuQ2ZuVG9waWNSdWxlKHRoaXMsIFwiU2F2ZVBpVGVsZW1ldHJ5UnVsZVwiLCB7XHJcbiAgICAgIHRvcGljUnVsZVBheWxvYWQ6IHtcclxuICAgICAgICBzcWw6IFwiU0VMRUNUIGRldmljZSwgdHMsIHRlbXBfYywgaHVtaWRpdHkgRlJPTSAncGkzLTAxL3RlbGVtZXRyeSdcIixcclxuICAgICAgICBhY3Rpb25zOiBbXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIGR5bmFtb0RCdjI6IHtcclxuICAgICAgICAgICAgICBwdXRJdGVtOiB7IHRhYmxlTmFtZTogdGVsZW1UYWJsZS50YWJsZU5hbWUgfSxcclxuICAgICAgICAgICAgICByb2xlQXJuOiBpb3RSdWxlUm9sZS5yb2xlQXJuLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIHJ1bGVEaXNhYmxlZDogZmFsc2UsXHJcbiAgICAgICAgYXdzSW90U3FsVmVyc2lvbjogXCIyMDE2LTAzLTIzXCIsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIC8vIDcpIExhbWJkYSAoVHlwZVNjcmlwdCkgKyBBUEkgdG8gcmVhZCBpdCBiYWNrXHJcbiAgICAvLyAgICBHRVQgL3RlbGVtZXRyeT9kZXZpY2U9cGkzLTAxJmxpbWl0PTI1XHJcbiAgICAvLyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIGNvbnN0IHRlbGVtZXRyeUdldEZuID0gbmV3IE5vZGVqc0Z1bmN0aW9uKHRoaXMsIFwiVGVsZW1ldHJ5R2V0SGFuZGxlclwiLCB7XHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxyXG4gICAgICBlbnRyeTogcGF0aC5qb2luKF9fZGlybmFtZSwgXCIuLi9sYW1iZGEvdGVsZW1ldHJ5LWdldC50c1wiKSxcclxuICAgICAgaGFuZGxlcjogXCJoYW5kbGVyXCIsXHJcbiAgICAgIGJ1bmRsaW5nOiB7XHJcbiAgICAgICAgdGFyZ2V0OiBcIm5vZGUxOFwiLFxyXG4gICAgICAgIG1pbmlmeTogdHJ1ZSxcclxuICAgICAgICBzb3VyY2VNYXA6IGZhbHNlLFxyXG4gICAgICB9LFxyXG4gICAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICAgIFRFTEVNRVRSWV9UQUJMRTogdGVsZW1UYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICB0ZWxlbVRhYmxlLmdyYW50UmVhZERhdGEodGVsZW1ldHJ5R2V0Rm4pO1xyXG5cclxuICAgIGNvbnN0IHRlbGVtZXRyeVJlc291cmNlID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoXCJ0ZWxlbWV0cnlcIik7XHJcbiAgICB0ZWxlbWV0cnlSZXNvdXJjZS5hZGRNZXRob2QoXCJHRVRcIiwgbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKHRlbGVtZXRyeUdldEZuKSwge1xyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ3cuQXV0aG9yaXphdGlvblR5cGUuTk9ORSwgLy8gc3dpdGNoIHRvIENPR05JVE8gbGF0ZXIgaWYgZGVzaXJlZFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gVXNlZnVsIG91dHB1dHNcclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIFwiUGlUaGluZ05hbWVcIiwgeyB2YWx1ZTogdGhpbmdOYW1lIH0pO1xyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJQaVBvbGljeU5hbWVcIiwgeyB2YWx1ZTogcGlQb2xpY3kucG9saWN5TmFtZSEgfSk7XHJcbiAgfVxyXG59XHJcbiJdfQ==