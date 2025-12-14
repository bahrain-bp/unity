import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { broadcastToAll } from "./ws-broadcast";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const tableName = process.env.TELEMETRY_TABLE!;

// Distance threshold in cm for occupancy
const DISTANCE_THRESHOLD_CM = 50;

export const handler = async (event: any) => {
  console.log("Raw event from IoT:", JSON.stringify(event));

  // 1) Required fields
  const device = event.device || event.clientId;
  const sensorId = event.sensor_id;
  const sensorType = event.sensor_type;

  // Always use server time for sort key
  const ts = Math.floor(Date.now() / 1000);
  // Optional: keep device/sensor timestamp separately
  const sensorTs = typeof event.ts === "number" ? event.ts : undefined;

  if (!device || !sensorId || !sensorType) {
    console.warn("Missing required fields", { device, sensorId, sensorType, event });
    return;
  }

  // 2) Metrics (numeric only)
  let metrics: Record<string, number> = {};

  if (event.metrics && typeof event.metrics === "object") {
    for (const [key, value] of Object.entries(event.metrics)) {
      if (typeof value === "number") {
        metrics[key] = value as number;
      }
    }
  } else {
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
      "image_b64",
      "status", // don't treat status as numeric metric
    ]);

    for (const [key, value] of Object.entries(event)) {
      if (reservedKeys.has(key)) continue;
      if (typeof value === "number") {
        metrics[key] = value as number;
      }
    }
  }

  // If no numeric metrics at all, just bail
  if (Object.keys(metrics).length === 0) {
    console.warn("No numeric metrics found in event", { event });
    return;
  }

  // Optional: original status from device (for non-ultrasonic sensors)
  const statusFromEvent =
    typeof event.status === "string" ? event.status : undefined;

  // Common extra fields
  const passthroughKeys = ["parking_space", "slot_id", "type"];

  // --------------------------------------------------------
  // CASE 1: NON-ULTRASONIC SENSORS  (humidity, temp, etc.)
  // --------------------------------------------------------
  if (sensorType !== "ultrasonic") {
    const metricKeys =
      event.metric_keys && Array.isArray(event.metric_keys)
        ? event.metric_keys
        : Object.keys(metrics);

    const item: any = {
      device,
      ts,           // server time
      sensor_ts: sensorTs,
      sensor_id: sensorId,
      sensor_type: sensorType,
      metrics,
      metric_keys: metricKeys,
    };

    if (statusFromEvent) {
      item.status = statusFromEvent;
    }

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

    console.log("Wrote item (non-ultrasonic):", item);

    const telemetryEvent = {
      type: "telemetry",
      source: "telemetry-ingest",
      ts,
      payload: {
        device,
        sensor_id: sensorId,
        sensor_type: sensorType,
        metrics,
        metric_keys: metricKeys,
        ts,
        status: item.status,
        parking_space: item.parking_space,
        slot_id: item.slot_id,
        type: item.type,
      },
    };

    try {
      await broadcastToAll(telemetryEvent);
    } catch (err) {
      console.error("Failed to broadcast telemetry over WebSocket:", err);
    }

    return { status: "ok", mode: "non-ultrasonic" };
  }

  // --------------------------------------------------
  // CASE 2: ULTRASONIC SENSORS  (parking logic)
  // --------------------------------------------------

  // 3) Derive parking status from distance
  const distance =
    typeof metrics.distance_cm === "number"
      ? metrics.distance_cm
      : typeof metrics.distance === "number"
      ? metrics.distance
      : undefined;

  let parkingStatus: "occupied" | "empty" | "unknown" = "unknown";

  if (typeof distance === "number") {
    parkingStatus =
      distance < DISTANCE_THRESHOLD_CM ? "occupied" : "empty";
  }

  // Save parking status WITH metrics (numeric flag)
  // 1 = occupied, 0 = empty, -1 = unknown
  if (parkingStatus === "occupied") {
    metrics.parking_status = 1;
  } else if (parkingStatus === "empty") {
    metrics.parking_status = 0;
  } else {
    metrics.parking_status = -1;
  }

  const metricKeys =
    event.metric_keys && Array.isArray(event.metric_keys)
      ? Array.from(new Set([...event.metric_keys, "parking_status"]))
      : Object.keys(metrics);

  // 4) Check last saved status for this device + sensor
  let lastStatus: string | undefined = undefined;

  try {
    const resp = await ddb.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "device = :d",
        ExpressionAttributeValues: {
          ":d": device,
          ":s": sensorId,
        },
        FilterExpression: "sensor_id = :s",
        ScanIndexForward: false, // latest first (by server ts)
        Limit: 1,
      })
    );

    if (resp.Items && resp.Items.length > 0) {
      lastStatus = resp.Items[0].status as string | undefined;
    }
  } catch (err) {
    console.error("Failed to query last status:", err);
    // If the query fails, we'll behave as if there was no previous status
  }

  // 5) If status didn’t change, do nothing (no DB, no WebSocket)
  if (lastStatus === parkingStatus) {
    console.log(
      `Status unchanged for device=${device}, sensor=${sensorId}. Last=${lastStatus}, current=${parkingStatus}. Skipping DB write & WebSocket.`
    );
    return {
      status: "ok",
      mode: "ultrasonic",
      skippedWrite: true,
      skippedBroadcast: true,
    };
  }

  // 6) Build final item for DynamoDB (only when status changed)
  const item: any = {
    device,
    ts,           // server time
    sensor_ts: sensorTs,
    sensor_id: sensorId,
    sensor_type: sensorType,
    metrics,
    metric_keys: metricKeys,
    status: parkingStatus, // derived parking status
  };

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

  console.log("Wrote item (ultrasonic status change):", item);

  // 7) Broadcast over WebSocket (only when status changed)
  const telemetryEvent = {
    type: "telemetry",
    source: "telemetry-ingest",
    ts,
    payload: {
      device,
      sensor_id: sensorId,
      sensor_type: sensorType,
      metrics,
      metric_keys: metricKeys,
      ts,
      status: parkingStatus,
      parking_space: item.parking_space,
      slot_id: item.slot_id,
      type: item.type,
    },
  };

  try {
    await broadcastToAll(telemetryEvent);
  } catch (err) {
    console.error("Failed to broadcast telemetry over WebSocket:", err);
  }

  return { status: "ok", mode: "ultrasonic", skippedWrite: false, skippedBroadcast: false };
};
