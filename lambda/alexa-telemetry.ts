import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const TABLE = process.env.TELEMETRY_TABLE!;
const BASIC_USER = process.env.BASIC_USER || "";
const BASIC_PASS = process.env.BASIC_PASS || "";

function json(statusCode: number, body: any): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

function unauthorized(message = "Unauthorized"): APIGatewayProxyResult {
  return {
    statusCode: 401,
    headers: {
      "content-type": "application/json",
      "www-authenticate": 'Basic realm="alexa-api"',
      "cache-control": "no-store",
    },
    body: JSON.stringify({ error: message }),
  };
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function parseBasicAuth(
  authHeader?: string
): { user: string; pass: string } | null {
  if (!authHeader) return null;

  const parts = authHeader.trim().split(" ");
  if (parts.length !== 2) return null;

  const [scheme, token] = parts;
  if (scheme.toLowerCase() !== "basic" || !token) return null;

  let decoded = "";
  try {
    decoded = Buffer.from(token, "base64").toString("utf8");
  } catch {
    return null;
  }

  const idx = decoded.indexOf(":");
  if (idx < 0) return null;

  return { user: decoded.slice(0, idx), pass: decoded.slice(idx + 1) };
}

function assertBasicAuth(event: APIGatewayProxyEvent): boolean {
  const header =
    event.headers?.authorization ||
    event.headers?.Authorization ||
    event.headers?.AUTHORIZATION;

  const creds = parseBasicAuth(header);
  if (!creds) return false;
  if (!BASIC_USER || !BASIC_PASS) return false;

  return safeEqual(creds.user, BASIC_USER) && safeEqual(creds.pass, BASIC_PASS);
}

function normalizePath(event: APIGatewayProxyEvent): string {
  return (event.path || "").toLowerCase();
}

function toIsoFromSeconds(ts?: number): string | null {
  if (typeof ts !== "number") return null;
  return new Date(ts * 1000).toISOString();
}

/**
 * Query newest items for a device (newest first)
 * PK=device, SK=ts
 */
async function queryLatestForDevice(device: string, limit = 80) {
  const cmd = new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: "#d = :dev",
    ExpressionAttributeNames: { "#d": "device" },
    ExpressionAttributeValues: { ":dev": device },
    ScanIndexForward: false,
    Limit: Math.min(Math.max(limit, 1), 200),
  });

  const resp = await ddb.send(cmd);
  return (resp.Items || []) as any[];
}

/**
 * Parking (global, no device param):
 * - Scans table (dev/small data)
 * - NOW: bounded scan pages + server-side filter + early exit
 * - Filters ultrasonic
 * - Groups by (device + sensor_id) so esp32 parking-1 and pico parking-1 are BOTH kept
 * - Returns "slots" array without exposing device/sensor_id
 *
 * NOTE: Scan is OK for dev/small data. Optimize later with a GSI.
 */
async function scanLatestParkingSlots(maxScanItems = 5000) {
  // Keep scan predictable (helps cold-start 502)
  const PAGE_LIMIT = 200; // <= controls per-request work
  const MAX_SLOTS = 24; // <= stop early once we have enough unique slots

  let lastKey: Record<string, any> | undefined = undefined;
  let scanned = 0;

  // key = `${device}#${sensor_id}` -> newest item
  const latestByKey = new Map<string, any>();

  do {
    const resp = await ddb.send(
      new ScanCommand({
        TableName: TABLE,
        ExclusiveStartKey: lastKey,

        // Make scan bounded & predictable (avoid huge 1MB pages)
        Limit: PAGE_LIMIT,

        // Reduce returned items (still scans internally, but returns fewer bytes to Lambda)
        FilterExpression:
          "sensor_type = :u AND attribute_exists(device) AND attribute_exists(sensor_id) AND attribute_exists(ts)",
        ExpressionAttributeValues: {
          ":u": "ultrasonic",
        },

        // "metrics" must be aliased (reserved word in ProjectionExpression)
        ProjectionExpression: "device, ts, sensor_id, sensor_type, #st, #m",
        ExpressionAttributeNames: {
          "#st": "status",
          "#m": "metrics",
        },
      })
    );

    const items = (resp.Items || []) as any[];
    scanned += items.length;

    for (const x of items) {
      // (FilterExpression already narrows, but keep this guard for safety)
      if (x?.sensor_type !== "ultrasonic") continue;

      const device = String(x?.device ?? "");
      const sensor_id = String(x?.sensor_id ?? "");
      const ts = typeof x?.ts === "number" ? x.ts : undefined;

      if (!device || !sensor_id || typeof ts !== "number") continue;

      const key = `${device}#${sensor_id}`;
      const prev = latestByKey.get(key);

      if (!prev || (typeof prev.ts === "number" && ts > prev.ts)) {
        latestByKey.set(key, x);
      }
    }

    // Early exit once we have enough unique slots
    if (latestByKey.size >= MAX_SLOTS) break;

    lastKey = resp.LastEvaluatedKey as any;
    if (scanned >= maxScanItems) break;
  } while (lastKey);

  // Build a stable ordered list, then map to slot numbers 1..N
  const rows = Array.from(latestByKey.values()).map((hit) => {
    const m = hit.metrics || {};
    const distance_cm =
      typeof m.distance_cm === "number"
        ? m.distance_cm
        : typeof m.distance === "number"
        ? m.distance
        : null;

    return {
      device: String(hit.device ?? ""),
      sensor_id: String(hit.sensor_id ?? ""),
      status: hit.status ?? "unknown",
      distance_cm,
      ts: hit.ts,
      datetime: toIsoFromSeconds(hit.ts),
    };
  });

  // Ensure stable slot assignment order (device then sensor_id)
  rows.sort((a, b) => {
    const d = a.device.localeCompare(b.device);
    if (d !== 0) return d;
    return a.sensor_id.localeCompare(b.sensor_id);
  });

  const slots = rows.map((r, idx) => ({
    slot: idx + 1,
    status: r.status,
    distance_cm: r.distance_cm,
    ts: r.ts,
    datetime: r.datetime,
  }));

  return slots;
}

/**
 * HT: pick latest non-ultrasonic record (by newest order), return client-friendly shape.
 */
function pickLatestHTClient(items: any[]) {
  const ht = items.find((x) => x?.sensor_type && x.sensor_type !== "ultrasonic");
  if (!ht) return null;

  const m = ht.metrics || {};

  const temperature =
    typeof m.temperature === "number"
      ? m.temperature
      : typeof m.temp_c === "number"
      ? m.temp_c
      : typeof m.temp === "number"
      ? m.temp
      : null;

  const humidity =
    typeof m.humidity === "number"
      ? m.humidity
      : typeof m.rh === "number"
      ? m.rh
      : null;

  const ts = typeof ht.ts === "number" ? ht.ts : undefined;

  return {
    temperature,
    humidity,
    ts: ts ?? null,
    datetime: toIsoFromSeconds(ts),
  };
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // 1) Basic Auth
    if (!assertBasicAuth(event)) return unauthorized();

    const path = normalizePath(event);
    const qs = event.queryStringParameters ?? {};

    // HT (device optional; default pi3-01)
    if (path.endsWith("/alexa/ht/latest")) {
      const device = (qs.device ?? "pi3-01").toString();
      const items = await queryLatestForDevice(device, 80);

      const ht = pickLatestHTClient(items);
      if (!ht)
        return json(404, { error: "No humidity/temperature reading found" });

      return json(200, ht);
    }

    // Parking (NO device, NO slot) => returns slots[1..N]
    if (path.endsWith("/alexa/parking/latest")) {
      const slots = await scanLatestParkingSlots(5000);

      if (slots.length === 0) {
        return json(404, { error: "No parking readings found" });
      }

      return json(200, {
        count: slots.length,
        slots,
      });
    }

    // Summary: HT (device-based) + Parking (global)
    if (path.endsWith("/alexa/summary")) {
      const device = (qs.device ?? "pi3-01").toString();

      // Run in parallel to reduce total latency (helps avoid cold-start timeouts)
      const [items, slots] = await Promise.all([
        queryLatestForDevice(device, 80),
        scanLatestParkingSlots(5000),
      ]);

      const ht = pickLatestHTClient(items);

      return json(200, {
        ht,
        parking: {
          count: slots.length,
          slots,
        },
      });
    }

    return json(404, { error: "Unknown route", path: event.path });
  } catch (err: any) {
    console.error("alexa-telemetry error:", err);
    return json(500, {
      error: "Server error",
      details: String(err?.message ?? err),
    });
  }
};
