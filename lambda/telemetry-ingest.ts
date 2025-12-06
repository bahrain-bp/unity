import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const tableName = process.env.TELEMETRY_TABLE!;

export const handler = async (event: any) => {
  console.log("Raw event from IoT:", JSON.stringify(event));

  // 1) Required fields
  const device = event.device || event.clientId;
  const sensorId = event.sensor_id;
  const sensorType = event.sensor_type;
  const ts =
    typeof event.ts === "number"
      ? event.ts
      : Math.floor(Date.now() / 1000);

  if (!device || !sensorId || !sensorType) {
    console.warn("Missing required fields", { device, sensorId, sensorType, event });
    return;
  }

  // 2) Metrics
  let metrics: Record<string, number> = {};

  // Preferred: device sends a metrics object
  if (event.metrics && typeof event.metrics === "object") {
    for (const [key, value] of Object.entries(event.metrics)) {
      if (typeof value === "number") {
        metrics[key] = value as number;
      }
    }
  } else {
    // Fallback: collect numeric top-level fields
    const reservedKeys = new Set([
      "device",
      "clientId",
      "sensor_id",
      "sensor_type",
      "ts",
      "timestamp",
      "topic",
      "metrics",
      "metric_keys",
      "image_b64", // just in case
    ]);

    for (const [key, value] of Object.entries(event)) {
      if (reservedKeys.has(key)) continue;
      if (typeof value === "number") {
        metrics[key] = value as number;
      }
    }
  }

  const metricKeys = event.metric_keys && Array.isArray(event.metric_keys)
    ? event.metric_keys
    : Object.keys(metrics);

  if (metricKeys.length === 0) {
    console.warn("No numeric metrics found in event", { event });
    return;
  }

  // 3) Build final item for DynamoDB
  const item: any = {
    device,
    ts,
    sensor_id: sensorId,
    sensor_type: sensorType,
    metrics,
    metric_keys: metricKeys,
  };

  // Optional extra fields we want to keep
  const passthroughKeys = [
    "status",
    "parking_space",
    "slot_id",
    "type",
  ];

  for (const key of passthroughKeys) {
    if (event[key] !== undefined) {
      item[key] = event[key];
    }
  }

  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: item,
    })
  );

  console.log("Wrote item:", item);

  return { status: "ok" };
};
