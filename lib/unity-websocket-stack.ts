import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as path from "path";
import * as iam from "aws-cdk-lib/aws-iam";

// WebSocket API v2 (alpha module)
import * as apigwv2 from "@aws-cdk/aws-apigatewayv2-alpha";
import * as integrations from "@aws-cdk/aws-apigatewayv2-integrations-alpha";

// import DBStack to can pass it in
import { DBStack } from "./DBstack";

export interface UnityWebSocketStackProps extends cdk.StackProps {
  dbStack: DBStack;
}

export class UnityWebSocketStack extends cdk.Stack {
  public readonly connectionsTable: dynamodb.Table;
  public readonly webSocketApi: apigwv2.WebSocketApi;
  public readonly stage: apigwv2.WebSocketStage;

  // Convenience: HTTPS management endpoint for other Lambdas
  public readonly managementEndpoint: string;

  constructor(scope: Construct, id: string, props: UnityWebSocketStackProps) {
    super(scope, id, props);

    const plugActionsTable = props.dbStack.plugActionsTable;

    // ────────────────────────────────
    // ✅ X-RAY HELPER
    // ────────────────────────────────
    const enableXRay = (fn: lambda.Function) => {
      fn.role?.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName("AWSXRayDaemonWriteAccess")
      );
    };

    // 1) Connections table
    this.connectionsTable = new dynamodb.Table(this, "WsConnectionsTable", {
      partitionKey: { name: "connectionId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // change to RETAIN in prod
    });

    // 2) Lambda: $connect  (ONLY save connection)
    const connectFn = new NodejsFunction(this, "WsConnectHandler", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "../lambda/ws-connect.ts"),
      handler: "handler",
      bundling: { target: "node18", minify: true, sourceMap: false },
      environment: {
        CONNECTIONS_TABLE: this.connectionsTable.tableName,
      },
      // ✅ X-Ray
      tracing: lambda.Tracing.ACTIVE,
    });
    enableXRay(connectFn);

    // 3) Lambda: $disconnect
    const disconnectFn = new NodejsFunction(this, "WsDisconnectHandler", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "../lambda/ws-disconnect.ts"),
      handler: "handler",
      bundling: { target: "node18", minify: true, sourceMap: false },
      environment: {
        CONNECTIONS_TABLE: this.connectionsTable.tableName,
      },
      // ✅ X-Ray
      tracing: lambda.Tracing.ACTIVE,
    });
    enableXRay(disconnectFn);

    // 4) Lambda: $default (handles hello/requestSnapshot -> sends plug_snapshot)
    const defaultFn = new NodejsFunction(this, "WsDefaultHandler", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "../lambda/ws-default.ts"),
      handler: "handler",
      bundling: { target: "node18", minify: true, sourceMap: false },
      environment: {
        CONNECTIONS_TABLE: this.connectionsTable.tableName,

        // snapshot inputs (used by ws-default.ts)
        PLUG_ACTIONS_TABLE: plugActionsTable.tableName,
        PLUG_INDEX_NAME: "plug_id-ts-index",
        PLUG_IDS: JSON.stringify(["plug1", "plug2"]),
      },
      // ✅ X-Ray
      tracing: lambda.Tracing.ACTIVE,
    });
    enableXRay(defaultFn);

    // Permissions for connections table
    this.connectionsTable.grantReadWriteData(connectFn);
    this.connectionsTable.grantReadWriteData(disconnectFn);
    this.connectionsTable.grantReadWriteData(defaultFn);

    // defaultFn needs to read PlugActions to compute snapshot
    plugActionsTable.grantReadData(defaultFn);

    // 5) WebSocket API
    this.webSocketApi = new apigwv2.WebSocketApi(this, "UnityWebSocketApi", {
      apiName: "unity-realtime-api",
      connectRouteOptions: {
        integration: new integrations.WebSocketLambdaIntegration(
          "ConnectIntegration",
          connectFn
        ),
      },
      disconnectRouteOptions: {
        integration: new integrations.WebSocketLambdaIntegration(
          "DisconnectIntegration",
          disconnectFn
        ),
      },
      defaultRouteOptions: {
        integration: new integrations.WebSocketLambdaIntegration(
          "DefaultIntegration",
          defaultFn
        ),
      },
    });

    // 6) Stage
    this.stage = new apigwv2.WebSocketStage(this, "UnityWsStage", {
      webSocketApi: this.webSocketApi,
      stageName: "dev",
      autoDeploy: true,
    });

    // Management endpoint used by other Lambdas (HTTPS, not wss)
    this.managementEndpoint = `https://${this.webSocketApi.apiId}.execute-api.${this.region}.amazonaws.com/${this.stage.stageName}`;

    new cdk.CfnOutput(this, "UnityWebSocketWssUrl", {
      value: this.stage.url, // wss://.../dev
      description: "WebSocket URL for frontend / Unity",
    });

    new cdk.CfnOutput(this, "UnityWebSocketManagementEndpoint", {
      value: this.managementEndpoint,
      description: "HTTPS endpoint for ApiGatewayManagementApi client",
    });

    // 7) Allow lambdas to use the management API (postToConnection)
    const mgmtPolicy = new iam.PolicyStatement({
      actions: ["execute-api:ManageConnections"],
      resources: [
        `arn:aws:execute-api:${this.region}:${this.account}:${this.webSocketApi.apiId}/${this.stage.stageName}/*/@connections/*`,
      ],
    });

    connectFn.addToRolePolicy(mgmtPolicy);
    disconnectFn.addToRolePolicy(mgmtPolicy);
    defaultFn.addToRolePolicy(mgmtPolicy);
  }
}
