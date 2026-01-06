// lambda/analytics-dashboard.ts
import { APIGatewayProxyHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { jsonResponse } from "./http-response";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const PLUG_ACTIONS_TABLE = process.env.PLUG_ACTIONS_TABLE!;
const TELEMETRY_TABLE = process.env.TELEMETRY_TABLE!;
const PLUG_INDEX_NAME = process.env.PLUG_INDEX_NAME || "plug_id-ts-index";

const DEFAULT_PLUGS = ["plug1", "plug2"];
const DISTANCE_THRESHOLD_CM = Number(process.env.DISTANCE_THRESHOLD_CM || "50");

type ChartResponse = {
  id: string;
  title: string;
  kind: "bar" | "line" | "pie";
  labels: string[];
  series: { name: string; data: number[] }[];
  meta?: Record<string, any>;
};

function parseEpochSeconds(input: string | undefined, fallback: number) {
  if (!input) return fallback;
  const n = Number(input);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function buildHourLabels() {
  return Array.from({ length: 24 }).map((_, h) => String(h).padStart(2, "0") + ":00");
}

function hourIndexUTC(tsSec: number) {
  return new Date(tsSec * 1000).getUTCHours();
}

// ---------- DynamoDB helpers ----------
async function queryPlugActionsByPlug(plugId: string, fromTs: number, toTs: number) {
  const out: any[] = [];
  let lastKey: any | undefined;

  do {
    const resp = await ddb.send(
      new QueryCommand({
        TableName: PLUG_ACTIONS_TABLE,
        IndexName: PLUG_INDEX_NAME,
        KeyConditionExpression: "plug_id = :p AND #ts BETWEEN :from AND :to",
        ExpressionAttributeNames: {
          "#ts": "ts",
          "#a": "action", // reserved word
        },
        ExpressionAttributeValues: { ":p": plugId, ":from": fromTs, ":to": toTs },
        ProjectionExpression: "plug_id, #ts, user_id, #a",
        ExclusiveStartKey: lastKey,
      })
    );

    out.push(...(resp.Items || []));
    lastKey = resp.LastEvaluatedKey;
  } while (lastKey);

  return out;
}

async function scanPlugActions(fromTs: number, toTs: number) {
  const out: any[] = [];
  let lastKey: any | undefined;

  do {
    const resp = await ddb.send(
      new ScanCommand({
        TableName: PLUG_ACTIONS_TABLE,
        FilterExpression: "#ts BETWEEN :from AND :to",
        ExpressionAttributeNames: {
          "#ts": "ts",
          "#a": "action", // reserved word
        },
        ExpressionAttributeValues: { ":from": fromTs, ":to": toTs },
        ProjectionExpression: "user_id, plug_id, #a, #ts",
        ExclusiveStartKey: lastKey,
      })
    );

    out.push(...(resp.Items || []));
    lastKey = resp.LastEvaluatedKey;
  } while (lastKey);

  return out;
}

async function scanUltrasonicTelemetry(fromTs: number, toTs: number) {
  const out: any[] = [];
  let lastKey: any | undefined;

  do {
    const resp = await ddb.send(
      new ScanCommand({
        TableName: TELEMETRY_TABLE,
        FilterExpression: "#ts BETWEEN :from AND :to AND sensor_type = :u",
        ExpressionAttributeNames: {
          "#ts": "ts",
          "#m": "metrics", // reserved word
        },
        ExpressionAttributeValues: { ":from": fromTs, ":to": toTs, ":u": "ultrasonic" },
        ProjectionExpression: "device, sensor_id, sensor_type, #ts, #m",
        ExclusiveStartKey: lastKey,
      })
    );

    out.push(...(resp.Items || []));
    lastKey = resp.LastEvaluatedKey;
  } while (lastKey);

  return out;
}

// ---------- Parking status from metrics ----------
function parkingStateFromMetrics(metrics: any): "occupied" | "empty" | "unknown" {
  if (!metrics || typeof metrics !== "object") return "unknown";

  // priority: parking_status
  const ps = metrics.parking_status;
  if (typeof ps === "number") return ps === 1 ? "occupied" : ps === 0 ? "empty" : "unknown";

  // fallback: distance_cm
  const d = metrics.distance_cm;
  if (typeof d === "number") return d <= DISTANCE_THRESHOLD_CM ? "occupied" : "empty";

  return "unknown";
}

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    // auth
    const claims = (event.requestContext.authorizer as any)?.claims;
    const userId = claims?.sub as string | undefined;
    if (!userId) return jsonResponse(401, { message: "Unauthorized" });

    // default: last 30 days
    const now = Math.floor(Date.now() / 1000);
    const defaultFrom = now - 30 * 24 * 60 * 60;

    const fromTs = parseEpochSeconds(event.queryStringParameters?.from, defaultFrom);
    const toTs = parseEpochSeconds(event.queryStringParameters?.to, now);

    const safeFrom = clamp(fromTs, 0, now);
    const safeTo = clamp(toTs, 0, now);

    // =============================
    // (A) PLUG CHARTS
    // =============================
    const plugs = DEFAULT_PLUGS;

    // 1) plug usage counts (via GSI query)
    const plugCounts: Record<string, number> = {};
    await Promise.all(
      plugs.map(async (p) => {
        const items = await queryPlugActionsByPlug(p, safeFrom, safeTo);
        plugCounts[p] = items.length;
      })
    );

    const plugUsage: ChartResponse = {
      id: "plug_usage",
      title: "Plug Usage (plugId vs #actions)",
      kind: "bar",
      labels: plugs,
      series: [{ name: "actions", data: plugs.map((p) => plugCounts[p] || 0) }],
    };

    const allActions = await scanPlugActions(safeFrom, safeTo);

    // 2) top users
    const userCounts = new Map<string, number>();
    for (const it of allActions) {
      const u = String(it.user_id || "");
      if (!u) continue;
      userCounts.set(u, (userCounts.get(u) || 0) + 1);
    }
    const topUsersSorted = [...userCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

    const topUsers: ChartResponse = {
      id: "top_users",
      title: "Top 10 Users by #actions",
      kind: "bar",
      labels: topUsersSorted.map(([u]) => u),
      series: [{ name: "actions", data: topUsersSorted.map(([, c]) => c) }],
      meta: { horizontal: true },
    };

    // 3/4/5: hourly series + per plug + on/off
    const hourLabels = buildHourLabels();
    const actionsPerHour = Array.from({ length: 24 }, () => 0);
    const perPlugHour: Record<string, number[]> = Object.fromEntries(
      plugs.map((p) => [p, Array.from({ length: 24 }, () => 0)])
    );

    let onTotal = 0;
    let offTotal = 0;

    for (const it of allActions) {
      const ts = Number(it.ts);
      if (!Number.isFinite(ts)) continue;

      const h = hourIndexUTC(ts);
      if (h < 0 || h > 23) continue;

      actionsPerHour[h]++;

      const plugId = String(it.plug_id || "");
      if (perPlugHour[plugId]) perPlugHour[plugId][h]++;

      const a = String(it.action || "").toLowerCase();
      if (a === "on") onTotal++;
      else if (a === "off") offTotal++;
    }

    const actionsTimeseries: ChartResponse = {
      id: "actions_timeseries",
      title: "Actions Over Time (hour buckets)",
      kind: "line",
      labels: hourLabels,
      series: [{ name: "actions", data: actionsPerHour }],
    };

    const plugTimeseries: ChartResponse = {
      id: "actions_per_plug_timeseries",
      title: "Actions Over Time (one line per plug)",
      kind: "line",
      labels: hourLabels,
      series: plugs.map((p) => ({ name: p, data: perPlugHour[p] })),
    };

    const onOffRatio: ChartResponse = {
      id: "on_off_ratio",
      title: "On vs Off Ratio",
      kind: "pie",
      labels: ["on", "off"],
      series: [{ name: "count", data: [onTotal, offTotal] }],
    };

    // =============================
    // (B) PARKING (ULTRASONIC) CHARTS
    // =============================
    const ultrasonic = await scanUltrasonicTelemetry(safeFrom, safeTo);

    // latest per device#sensor_id
    const latestBySensor = new Map<string, any>();
    for (const it of ultrasonic) {
      const device = String(it.device || "");
      const sensorId = String(it.sensor_id || "");
      const ts = Number(it.ts);
      if (!device || !sensorId || !Number.isFinite(ts)) continue;

      const key = `${device}#${sensorId}`;
      const prev = latestBySensor.get(key);
      if (!prev || Number(prev.ts) < ts) latestBySensor.set(key, it);
    }

    let occNow = 0, emptyNow = 0, unkNow = 0;

    for (const it of latestBySensor.values()) {
      const state = parkingStateFromMetrics(it.metrics);
      if (state === "occupied") occNow++;
      else if (state === "empty") emptyNow++;
      else unkNow++;
    }

    const currentParkingStatus: ChartResponse = {
      id: "current_parking_status",
      title: "Current Parking Status (latest per sensor)",
      kind: "bar",
      labels: ["occupied", "empty", "unknown"],
      series: [{ name: "count", data: [occNow, emptyNow, unkNow] }],
      meta: {
        sensorsCount: latestBySensor.size,
        rule: "parking_status (1/0) else distance_cm <= 50",
        distanceThresholdCm: DISTANCE_THRESHOLD_CM,
      },
    };

    // most occupied / most empty sensors across the window
    const occBySensor = new Map<string, number>();
    const emptyBySensor = new Map<string, number>();

    // also compute counts per hour
    const occPerHour = Array.from({ length: 24 }, () => 0);
    const emptyPerHour = Array.from({ length: 24 }, () => 0);

    for (const it of ultrasonic) {
      const device = String(it.device || "");
      const sensorId = String(it.sensor_id || "");
      const ts = Number(it.ts);
      if (!device || !sensorId || !Number.isFinite(ts)) continue;

      const key = `${device}#${sensorId}`;
      const h = hourIndexUTC(ts);

      const state = parkingStateFromMetrics(it.metrics);
      if (state === "occupied") {
        occBySensor.set(key, (occBySensor.get(key) || 0) + 1);
        if (h >= 0 && h <= 23) occPerHour[h]++;
      } else if (state === "empty") {
        emptyBySensor.set(key, (emptyBySensor.get(key) || 0) + 1);
        if (h >= 0 && h <= 23) emptyPerHour[h]++;
      }
    }

    const topOcc = [...occBySensor.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const topEmpty = [...emptyBySensor.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

    const mostOccupiedSensors: ChartResponse = {
      id: "most_occupied_sensors",
      title: "Most Occupied Sensors (top 10) [device#sensor_id]",
      kind: "bar",
      labels: topOcc.map(([k]) => k),
      series: [{ name: "occupied_count", data: topOcc.map(([, c]) => c) }],
      meta: { rule: "parking_status=1 OR distance_cm<=50" },
    };

    const mostEmptySensors: ChartResponse = {
      id: "most_empty_sensors",
      title: "Most Empty Sensors (top 10) [device#sensor_id]",
      kind: "bar",
      labels: topEmpty.map(([k]) => k),
      series: [{ name: "empty_count", data: topEmpty.map(([, c]) => c) }],
      meta: { rule: "parking_status=0 OR distance_cm>50" },
    };

    const mostFullTime: ChartResponse = {
      id: "parking_most_full_time",
      title: "Time Buckets When Parking is Most FULL (occupied counts per hour)",
      kind: "bar",
      labels: hourLabels,
      series: [{ name: "occupied_count", data: occPerHour }],
    };

    const mostEmptyTime: ChartResponse = {
      id: "parking_most_empty_time",
      title: "Time Buckets When Parking is Most EMPTY (empty counts per hour)",
      kind: "bar",
      labels: hourLabels,
      series: [{ name: "empty_count", data: emptyPerHour }],
    };

    return jsonResponse(200, {
      ok: true,
      range: { from: safeFrom, to: safeTo },
      charts: [
        plugUsage,
        topUsers,
        actionsTimeseries,
        plugTimeseries,
        onOffRatio,
        currentParkingStatus,
        mostOccupiedSensors,
        mostEmptySensors,
        mostFullTime,
        mostEmptyTime,
      ],
      meta: {
        plugs,
        parkingRule: "parking_status (1/0) else distance_cm threshold",
        parkingSensorUniqueness: "device#sensor_id",
      },
    });
  } catch (err: any) {
    console.error("analytics-dashboard error:", err);
    return jsonResponse(500, { message: "Internal server error" });
  }
};
