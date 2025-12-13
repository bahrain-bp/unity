import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as iot from "aws-cdk-lib/aws-iot";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as path from "path";
import { DBStack } from "./DBstack";
import { UnityWebSocketStack } from "./unity-websocket-stack";

interface IoTStackProps extends cdk.StackProps {
  dbStack: DBStack;
  wsStack: UnityWebSocketStack;
}

interface DeviceConfig {
  name: string;
  sensors: string[];
}

export class IoTStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: IoTStackProps) {
    super(scope, id, props);

    const { dbStack, wsStack } = props;

    // Ensure DBStack and WebSocketStack are created before IoTStack
    this.addDependency(dbStack);
    this.addDependency(wsStack);

    // ────────────────────────────────
    // 0) Device list (3 devices × 2 sensors)
    // ────────────────────────────────
    const devices: DeviceConfig[] = [
      {
        name: "pi3-01",
        sensors: ["temp_c", "humidity"],
      },
      {
        name: "pico-01",
        sensors: ["temp_c", "humidity"],
      },
      {
        name: "pico-02",
        sensors: ["temp_c", "humidity"],
      },
    ];

    // ────────────────────────────────
    // 1) IoT Things (one per device)
    // ────────────────────────────────
    const thingMap: Record<string, iot.CfnThing> = {};

    for (const device of devices) {
      const thing = new iot.CfnThing(this, `Thing-${device.name}`, {
        thingName: device.name,
      });
      thingMap[device.name] = thing;
    }

    // ────────────────────────────────
    // 2) Shared IoT Policy for all devices
    // ────────────────────────────────
    const iotPolicy = new iot.CfnPolicy(this, "DeviceTelemetryPolicy", {
      policyName: "DeviceTelemetryPolicy",
      policyDocument: {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: ["iot:Connect"],
            Resource: [
              `arn:aws:iot:${this.region}:${this.account}:client/\${iot:ClientId}`,
            ],
          },
          {
            Effect: "Allow",
            Action: ["iot:Publish", "iot:Receive"],
            Resource: [
              `arn:aws:iot:${this.region}:${this.account}:topic/devices/\${iot:ClientId}/*`,
            ],
          },
          {
            Effect: "Allow",
            Action: ["iot:Subscribe"],
            Resource: [
              `arn:aws:iot:${this.region}:${this.account}:topicfilter/devices/\${iot:ClientId}/*`,
            ],
          },
        ],
      },
    });

    new cdk.CfnOutput(this, "IoTPolicyName", {
      value: iotPolicy.policyName!,
      description: "Shared IoT policy for all devices",
    });

    // ────────────────────────────────
    // 3) Use telemetry table from DBStack
    // ────────────────────────────────
    const telemetryTable: dynamodb.Table = dbStack.iotTelemetryTable;

    // ────────────────────────────────
    // 4) Lambda: ingest telemetry from IoT Core → DynamoDB + WebSocket broadcast
    // ────────────────────────────────
    const telemetryIngestFn = new NodejsFunction(this, "TelemetryIngestHandler", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "../lambda/telemetry-ingest.ts"),
      handler: "handler",
      bundling: {
        target: "node18",
        minify: true,
        sourceMap: false,
      },
      environment: {
        TELEMETRY_TABLE: telemetryTable.tableName,
        WS_CONNECTIONS_TABLE: wsStack.connectionsTable.tableName,
        WS_MANAGEMENT_ENDPOINT: wsStack.managementEndpoint,
      },
    });

    telemetryTable.grantWriteData(telemetryIngestFn);
    wsStack.connectionsTable.grantReadData(telemetryIngestFn);

    // Allow managing WebSocket connections
    telemetryIngestFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["execute-api:ManageConnections"],
        resources: [
          `arn:aws:execute-api:${this.region}:${this.account}:` +
            `${wsStack.webSocketApi.apiId}/${wsStack.stage.stageName}/*/@connections/*`,
        ],
      })
    );

    // Allow IoT to invoke this Lambda (rule-restricted below)
    telemetryIngestFn.addPermission("AllowIotInvoke", {
      principal: new iam.ServicePrincipal("iot.amazonaws.com"),
      action: "lambda:InvokeFunction",
      sourceAccount: this.account,
    });

    // ────────────────────────────────
    // 5) IoT Rule: trigger telemetryIngestFn on telemetry topics
    // ────────────────────────────────
    const telemetryRule = new iot.CfnTopicRule(this, "DeviceTelemetryRule", {
      topicRulePayload: {
        sql: "SELECT * FROM 'devices/+/telemetry'",
        actions: [
          {
            lambda: {
              functionArn: telemetryIngestFn.functionArn,
            },
          },
        ],
        ruleDisabled: false,
        awsIotSqlVersion: "2016-03-23",
      },
    });

    telemetryIngestFn.addPermission("AllowIotInvokeFromRule", {
      principal: new iam.ServicePrincipal("iot.amazonaws.com"),
      action: "lambda:InvokeFunction",
      sourceArn: telemetryRule.attrArn,
    });

    // ────────────────────────────────
    // 6) Outputs for devices (things)
    // ────────────────────────────────
    devices.forEach((device) => {
      new cdk.CfnOutput(this, `ThingName-${device.name}`, {
        value: device.name,
        description: `IoT Thing for device ${device.name}`,
      });
    });
  }
}
