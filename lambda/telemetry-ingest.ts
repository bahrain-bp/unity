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
const DISTANCE_THRESHOLD_CM = 50;

// TTL settings (DynamoDB TTL must be enabled on this attribute in the table)
const TTL_ATTRIBUTE = "expires_at"; // Number (epoch seconds)
const TTL_24H_SECONDS = 24 * 60 * 60;

type ParkingStatus = "occupied" | "empty" | "unknown";

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
  "status",
]);

const passthroughKeys = ["parking_space", "slot_id", "type"] as const;

const norm = (s?: string) =>
  typeof s === "string" ? s.trim().toLowerCase() : undefined;

/**
 * ✅ Option A:
 * - Keep numeric values in `metrics`
 * - Keep string/boolean values in `attrs`
 * - Allow DB write if either metrics OR attrs has content
 */
function extractMetricsAndAttrs(event: any): {
  metrics: Record<string, number>;
  attrs: Record<string, string | boolean>;
} {
  const metrics: Record<string, number> = {};
  const attrs: Record<string, string | boolean> = {};

  // Prefer event.metrics when present
  if (event.metrics && typeof event.metrics === "object") {
    for (const [k, v] of Object.entries(event.metrics)) {
      if (typeof v === "number") metrics[k] = v;
      else if (typeof v === "string" || typeof v === "boolean") attrs[k] = v;
    }
    return { metrics, attrs };
  }

  // Fallback: treat top-level numeric as metrics, string/boolean as attrs
  for (const [k, v] of Object.entries(event)) {
    if (reservedKeys.has(k)) continue;

    if (typeof v === "number") metrics[k] = v;
    else if (typeof v === "string" || typeof v === "boolean") attrs[k] = v;
  }

  return { metrics, attrs };
}

function deriveDistance(metrics: Record<string, number>): number | undefined {
  if (typeof metrics.distance_cm === "number") return metrics.distance_cm;
  if (typeof metrics.distance === "number") return metrics.distance;
  return undefined;
}

function deriveParkingStatus(distance?: number): ParkingStatus {
  if (typeof distance !== "number") return "unknown";
  return distance < DISTANCE_THRESHOLD_CM ? "occupied" : "empty";
}

/**
 * Get last status for (device + sensor_id)
 * Table: PK=device, SK=ts
 * Query newest items for device, scan until first matching sensor_id.
 */
async function getLastStatusForDeviceSensor(
  device: string,
  sensorId: string,
  maxLookback = 200
): Promise<string | undefined> {
  const resp = await ddb.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "device = :dev",
      ExpressionAttributeValues: {
        ":dev": device,
      },
      ScanIndexForward: false,
      Limit: Math.min(Math.max(maxLookback, 10), 200),

      // only fetch what we need
      ProjectionExpression: "ts, sensor_id, #st",
      ExpressionAttributeNames: {
        "#st": "status",
      },
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

  // Required fields
  const device = event.device || event.clientId;
  const sensorId = event.sensor_id;
  const sensorType = event.sensor_type;

  // Server time for sort key
  const ts = Math.floor(Date.now() / 1000);
  const sensorTs = typeof event.ts === "number" ? event.ts : undefined;

  if (!device || !sensorId || !sensorType) {
    console.warn("Missing required fields", { device, sensorId, sensorType, event });
    return;
  }

  // ✅ Metrics + Attrs (Option A)
  const { metrics, attrs } = extractMetricsAndAttrs(event);

  // ✅ allow saving if either exists
  if (Object.keys(metrics).length === 0 && Object.keys(attrs).length === 0) {
    console.warn("No metrics/attrs found in event", { event });
    return;
  }

  const statusFromEvent =
    typeof event.status === "string" ? event.status : undefined;

  // -----------------------------
  // CASE 1: NON-ULTRASONIC
  // -----------------------------
  if (sensorType !== "ultrasonic") {
    // metric_keys: prefer provided keys, else union of metrics+attrs keys
    const metricKeys =
      event.metric_keys && Array.isArray(event.metric_keys)
        ? event.metric_keys
        : Array.from(
            new Set([...Object.keys(metrics), ...Object.keys(attrs)])
          );

    const item: any = {
      device,
      ts,
      sensor_ts: sensorTs,
      sensor_id: sensorId,
      sensor_type: sensorType,
      metrics,     // numbers
      attrs,       // strings/bools (e.g., room_status: "AVAILABLE")
      metric_keys: metricKeys,
    };

    if (statusFromEvent) item.status = statusFromEvent;

    for (const key of passthroughKeys) {
      if (event[key] !== undefined) item[key] = event[key];
    }

    // ✅ TTL: only for dht11 items -> auto-delete ~24h after write
    if (norm(sensorType) === "dht11") {
      item[TTL_ATTRIBUTE] = ts + TTL_24H_SECONDS; // MUST be Number epoch seconds
    }

    await ddb.send(new PutCommand({ TableName: tableName, Item: item }));
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
        attrs,
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

  // -----------------------------
  // CASE 2: ULTRASONIC
  // -----------------------------
  const distance = deriveDistance(metrics);
  const parkingStatus = deriveParkingStatus(distance);

  // Add numeric parking_status to metrics
  if (parkingStatus === "occupied") metrics.parking_status = 1;
  else if (parkingStatus === "empty") metrics.parking_status = 0;
  else metrics.parking_status = -1;

  // Ensure metric_keys includes parking_status (and any attrs keys if you want)
  const metricKeys =
    event.metric_keys && Array.isArray(event.metric_keys)
      ? Array.from(new Set([...event.metric_keys, "parking_status"]))
      : Array.from(
          new Set([...Object.keys(metrics), ...Object.keys(attrs), "parking_status"])
        );

  let lastStatus: string | undefined;
  try {
    lastStatus = await getLastStatusForDeviceSensor(device, sensorId, 200);
  } catch (err) {
    console.error("Failed to query last status:", err);
    lastStatus = undefined;
  }

  const lastN = norm(lastStatus);
  const curN = norm(parkingStatus);

  console.log("[ultrasonic] compare", { device, sensorId, lastStatus, parkingStatus });

  // Always broadcast
  const telemetryEvent = {
    type: "telemetry",
    source: "telemetry-ingest",
    ts,
    payload: {
      device,
      sensor_id: sensorId,
      sensor_type: sensorType,
      metrics,
      attrs,
      metric_keys: metricKeys,
      ts,
      status: parkingStatus,
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

  // Skip DB write if status unchanged
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

  // Write only on change
  const item: any = {
    device,
    ts,
    sensor_ts: sensorTs,
    sensor_id: sensorId,
    sensor_type: sensorType,
    metrics,
    attrs,
    metric_keys: metricKeys,
    status: parkingStatus,
  };

  for (const key of passthroughKeys) {
    if (event[key] !== undefined) item[key] = event[key];
  }

  await ddb.send(new PutCommand({ TableName: tableName, Item: item }));
  console.log("Wrote item (ultrasonic status change):", item);

  return {
    status: "ok",
    mode: "ultrasonic",
    skippedWrite: false,
    skippedBroadcast: false,
  };
};
