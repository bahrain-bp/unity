import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Stack, StackProps, RemovalPolicy, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";

export class DBStack extends Stack {
  public readonly table: dynamodb.Table;
  public readonly chatbotTable: dynamodb.TableV2;
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

    this.chatbotTable = new dynamodb.TableV2(this, "chatbotTable", {
      partitionKey: { name: "sessionId", type: dynamodb.AttributeType.STRING },
    });

    new cdk.CfnOutput(this, "tablenameoutput", {
      value: this.chatbotTable.tableName,
      exportName: "UnityChatbotTable",
    // 2) PlugActions table (audit + cooldown)
    this.plugActionsTable = new dynamodb.Table(this, "PlugActionsTable", {
      tableName: "PlugActions",
      partitionKey: { name: "user_id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "ts", type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY, // change to RETAIN in prod
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
