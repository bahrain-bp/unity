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
const BUILD_MARKER = "telemetry-ingest-2025-12-27-06";

// Distance threshold in cm for occupancy
const DISTANCE_THRESHOLD_CM = 50;

/**
 * Get the last saved status for (device + sensor_id).
 *
 * Table: PK=device, SK=ts
 * We query newest items for the device, then pick the first that matches sensor_id.
 *
 * NOTE: We intentionally do NOT rely on FilterExpression+Limit=1,
 * and we also don't require sensor_type here (to avoid false "undefined" if old items
 * missed that attribute or ProjectionExpression returns incomplete data).
 */
async function getLastStatusForDeviceSensor(
  device: string,
  sensorId: string,
  maxLookback = 200
): Promise<string | undefined> {
  console.log("BUILD_MARKER:", BUILD_MARKER);
  console.log("TABLE:", tableName);

  const resp = await ddb.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "#d = :dev",
      ExpressionAttributeNames: {
        "#d": "device",
        "#sid": "sensor_id",
        "#st": "status",
        "#ts": "ts",
      },
      ExpressionAttributeValues: {
        ":dev": device,
      },
      ScanIndexForward: false, // newest first by ts
      Limit: Math.min(Math.max(maxLookback, 10), 200),

      // Keep it small, but include what we need
      ProjectionExpression: "#ts, #sid, #st",
    })
  );

  const items = (resp.Items || []) as any[];

  for (const it of items) {
    if (String(it?.sensor_id ?? "") !== sensorId) continue;

    const st = it?.status;
    return typeof st === "string" ? st : undefined;
  }

  return undefined;
}

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
    console.warn("Missing required fields", {
      device,
      sensorId,
      sensorType,
      event,
    });
    return;
  }

  // 2) Metrics (numeric only)
  let metrics: Record<string, number> = {};

  if (event.metrics && typeof event.metrics === "object") {
    for (const [key, value] of Object.entries(event.metrics)) {
      if (typeof value === "number") metrics[key] = value as number;
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
      if (typeof value === "number") metrics[key] = value as number;
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
      ts, // server time
      sensor_ts: sensorTs,
      sensor_id: sensorId,
      sensor_type: sensorType,
      metrics,
      metric_keys: metricKeys,
    };

    if (statusFromEvent) item.status = statusFromEvent;

    for (const key of passthroughKeys) {
      if (event[key] !== undefined) item[key] = event[key];
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
    parkingStatus = distance < DISTANCE_THRESHOLD_CM ? "occupied" : "empty";
  }

  // Save parking status WITH metrics (numeric flag)
  // 1 = occupied, 0 = empty, -1 = unknown
  if (parkingStatus === "occupied") metrics.parking_status = 1;
  else if (parkingStatus === "empty") metrics.parking_status = 0;
  else metrics.parking_status = -1;

  const metricKeys =
    event.metric_keys && Array.isArray(event.metric_keys)
      ? Array.from(new Set([...event.metric_keys, "parking_status"]))
      : Object.keys(metrics);

  // 4) Get last saved status for this *device + sensor_id*
  let lastStatus: string | undefined = undefined;

  try {
    lastStatus = await getLastStatusForDeviceSensor(device, sensorId, 200);
  } catch (err) {
    console.error("Failed to query last status:", err);
    lastStatus = undefined;
  }

  // Normalize for safer comparisons
  const norm = (s?: string) => (typeof s === "string" ? s.trim().toLowerCase() : undefined);
  const lastN = norm(lastStatus);
  const curN = norm(parkingStatus);

  console.log("[ultrasonic] compare", {
    device,
    sensorId,
    lastStatus,
    parkingStatus,
  });

  // 5) ALWAYS broadcast to WebSocket (even if status unchanged)
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
      // keep payload shape EXACT
      parking_space: event.parking_space,
      slot_id: event.slot_id,
      type: event.type,
    },
  };

  try {
    await broadcastToAll(telemetryEvent);
  } catch (err) {
    console.error("Failed to broadcast telemetry over WebSocket:", err);
  }

  // 6) If status didn’t change, SKIP DB write (but we already broadcasted)
  if (lastN === curN) {
    console.log(
      `Status unchanged for device=${device}, sensor=${sensorId}. Last=${lastStatus}, current=${parkingStatus}. Skipping DB write (broadcasted).`
    );
    return {
      status: "ok",
      mode: "ultrasonic",
      skippedWrite: true,
      skippedBroadcast: false,
    };
  }

  // 7) Build final item for DynamoDB (ONLY when status changed)
  const item: any = {
    device,
    ts, // server time
    sensor_ts: sensorTs,
    sensor_id: sensorId,
    sensor_type: sensorType,
    metrics,
    metric_keys: metricKeys,
    status: parkingStatus, // derived parking status
  };

  for (const key of passthroughKeys) {
    if (event[key] !== undefined) item[key] = event[key];
  }

  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: item,
    })
  );

  console.log("Wrote item (ultrasonic status change):", item);

  return {
    status: "ok",
    mode: "ultrasonic",
    skippedWrite: false,
    skippedBroadcast: false,
  };
};
