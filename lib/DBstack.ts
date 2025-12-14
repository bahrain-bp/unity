import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Stack, StackProps, RemovalPolicy, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";

export class DBStack extends Stack {
  public readonly table: dynamodb.Table;             // UnityBahtwin
  public readonly plugActionsTable: dynamodb.Table;  // PlugActions
  public readonly iotTelemetryTable: dynamodb.Table; // IoTDeviceTelemetry

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // 1) Single DynamoDB table for Bahtwin
    this.table = new dynamodb.Table(this, "BahtwinTable", {
      tableName: "UnityBahtwinTable", // physical name
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY, // dev only
    });

    new CfnOutput(this, "UnityBahtwinTableNameOutput", {
      value: this.table.tableName,
      exportName: "UnityBahtwinTableName",
    });

    // 2) PlugActions table (audit + cooldown)
    this.plugActionsTable = new dynamodb.Table(this, "PlugActionsTable", {
      tableName: "PlugActions",
      partitionKey: { name: "user_id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "ts", type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY, // change to RETAIN in prod
    });

    // GSI to query last action per plug (for per-plug cooldown)
    // Lets you query: plug_id = "plug1" ORDER BY ts DESC LIMIT 1
    this.plugActionsTable.addGlobalSecondaryIndex({
      indexName: "plug_id-ts-index",
      partitionKey: { name: "plug_id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "ts", type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    new CfnOutput(this, "PlugActionsTableNameOutput", {
      value: this.plugActionsTable.tableName,
      exportName: "PlugActionsTableName",
    });

    // 3) IoT telemetry table (all devices/sensors)
    this.iotTelemetryTable = new dynamodb.Table(this, "IoTTelemetryTable", {
      tableName: "IoTDeviceTelemetry",
      partitionKey: { name: "device", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "ts", type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY, // TODO: RETAIN in prod
    });

    new CfnOutput(this, "IoTDeviceTelemetryTableNameOutput", {
      value: this.iotTelemetryTable.tableName,
      exportName: "IoTDeviceTelemetryTableName",
    });
  }
}
