import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as path from "path";
import { DBStack } from "./DBstack";
import * as iam from "aws-cdk-lib/aws-iam";

interface WebSocketStackProps extends cdk.StackProps {
  dbStack: DBStack;
}

export class WebSocketStack extends cdk.Stack {
  public readonly webSocketUrl: string;

  constructor(scope: Construct, id: string, props: WebSocketStackProps) {
    super(scope, id, props);

    // Make sure DBStack is deployed first
    this.addDependency(props.dbStack);

    const activeConnectionsTable = props.dbStack.activeConnectionsTable;

    // ────────────────────────────────
    // WebSocket API
    // ────────────────────────────────
    const webSocketApi = new apigwv2.WebSocketApi(this, "WebSocketApi", {
      apiName: "Unity-Realtime-WebSocket",
      routeSelectionExpression: "$request.body.action",
      description: "WebSocket API for real-time active user tracking",
    });

    const webSocketStage = new apigwv2.WebSocketStage(
      this,
      "WebSocketStage",
      {
        webSocketApi,
        stageName: "prod",
        autoDeploy: true,
      }
    );

    // Store the WebSocket URL for use in lambda environment variables
    const wsEndpoint = `https://${webSocketApi.apiId}.execute-api.${
      cdk.Stack.of(this).region
    }.amazonaws.com/${webSocketStage.stageName}`;

    // ────────────────────────────────
    // Lambda Functions
    // ────────────────────────────────
    const presenceOnConnectFn = new NodejsFunction(
      this,
      "PresenceOnConnectFn",
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: path.join(
          __dirname,
          "../lambda/echoShow/presenceOnConnect.ts"
        ),
        handler: "handler",
        environment: {
          ACTIVE_CONNECTIONS_TABLE: activeConnectionsTable.tableName,
          WS_ENDPOINT: wsEndpoint,
        },
        timeout: cdk.Duration.seconds(10),
      }
    );

    const presenceOnDisconnectFn = new NodejsFunction(
      this,
      "PresenceOnDisconnectFn",
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: path.join(
          __dirname,
          "../lambda/echoShow/presenceOnDisconnect.ts"
        ),
        handler: "handler",
        environment: {
          ACTIVE_CONNECTIONS_TABLE: activeConnectionsTable.tableName,
          WS_ENDPOINT: wsEndpoint,
        },
        timeout: cdk.Duration.seconds(10),
      }
    );

    // Default route handler (handles any unmatched routes)
    const defaultRouteFn = new NodejsFunction(this, "DefaultRouteFn", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "handler",
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('Default route called:', event);
          return { statusCode: 200, body: 'OK' };
        };
      `),
      timeout: cdk.Duration.seconds(10),
    });

    // ────────────────────────────────
    // Permissions
    // ────────────────────────────────
    activeConnectionsTable.grantReadWriteData(presenceOnConnectFn);
    activeConnectionsTable.grantReadWriteData(presenceOnDisconnectFn);

    // Allow posting messages back to connected clients
    const region = cdk.Stack.of(this).region;
    const account = cdk.Stack.of(this).account;
const connectionsArn = `arn:aws:execute-api:${region}:${account}:${webSocketApi.apiId}/${webSocketStage.stageName}/POST/@connections/*`;

    presenceOnConnectFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["execute-api:ManageConnections"],
        resources: [connectionsArn],
      })
    );

    presenceOnDisconnectFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["execute-api:ManageConnections"],
        resources: [connectionsArn],
      })
    );

    // ────────────────────────────────
    // WebSocket Routes
    // ────────────────────────────────
    webSocketApi.addRoute("$connect", {
      integration: new integrations.WebSocketLambdaIntegration(
        "ConnectIntegration",
        presenceOnConnectFn
      ),
    });

    webSocketApi.addRoute("$disconnect", {
      integration: new integrations.WebSocketLambdaIntegration(
        "DisconnectIntegration",
        presenceOnDisconnectFn
      ),
    });

    webSocketApi.addRoute("$default", {
      integration: new integrations.WebSocketLambdaIntegration(
        "DefaultIntegration",
        defaultRouteFn
      ),
    });

    // ────────────────────────────────
    // Outputs
    // ────────────────────────────────
    this.webSocketUrl = webSocketStage.url;

    new cdk.CfnOutput(this, "WebSocketEndpoint", {
      value: webSocketStage.url,
      exportName: "UnityWebSocketEndpoint",
      description: "WebSocket endpoint URL for Unity clients",
    });

    new cdk.CfnOutput(this, "ActiveConnectionsTableName", {
      value: activeConnectionsTable.tableName,
      description: "DynamoDB table storing active connections",
    });
  }
}