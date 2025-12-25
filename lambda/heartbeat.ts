import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import {
  LambdaClient,
  InvokeCommand,
} from "@aws-sdk/client-lambda";

const dynamo = new DynamoDBClient({});
const lambdaClient = new LambdaClient({});

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

const ACTIVE_WINDOW_SECONDS = 5 * 60;        // 5 minutes
const LAST_6_HOURS_SECONDS = 6 * 60 * 60;
const BAHRAIN_OFFSET_SECONDS = 3 * 60 * 60;

/* ────────────────────────────────
   Time helpers (Bahrain timezone)
──────────────────────────────── */

function getBahrainDayStartUtcSeconds(nowUtc: Date) {
  const offsetMs = BAHRAIN_OFFSET_SECONDS * 1000;
  const bahrainNowMs = nowUtc.getTime() + offsetMs;
  const start = new Date(bahrainNowMs);
  start.setUTCHours(0, 0, 0, 0);
  return Math.floor((start.getTime() - offsetMs) / 1000);
}

function formatBahrainHourLabel(timestampSeconds: number) {
  const date = new Date(
    (timestampSeconds + BAHRAIN_OFFSET_SECONDS) * 1000
  );
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const h = String(date.getUTCHours()).padStart(2, "0");
  return `${y}-${m}-${d} ${h}:00`;
}

function last6HourBuckets(nowSeconds: number) {
  const buckets: string[] = [];
  for (let i = 5; i >= 0; i--) {
    buckets.push(formatBahrainHourLabel(nowSeconds - i * 3600));
  }
  return buckets;
}

/* ────────────────────────────────
   Lambda handler
──────────────────────────────── */

export const handler = async (event: any) => {
  try {
    if (event?.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: CORS_HEADERS, body: "" };
    }

    const body =
      typeof event.body === "string" ? JSON.parse(event.body) : event.body;

    const userId = body?.userId;
    if (!userId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: "Missing userId" }),
      };
    }

    const nowUtc = new Date();
    const timestamp = Math.floor(nowUtc.getTime() / 1000);

    /* ────────────────────────────────
       1️⃣ Save heartbeat
    ──────────────────────────────── */

    await dynamo.send(
      new PutItemCommand({
        TableName: process.env.WEBSITE_ACTIVITY_TABLE!,
        Item: {
          pk: { S: "WEBSITE" },
          sk: { S: `${timestamp}#${userId}` },
          userId: { S: userId },
          timestamp: { N: timestamp.toString() },
          ttl: { N: (timestamp + LAST_6_HOURS_SECONDS).toString() },
        },
      })
    );

    /* ────────────────────────────────
       2️⃣ Query activity
    ──────────────────────────────── */

    const last6HoursCutoff = timestamp - LAST_6_HOURS_SECONDS;
    const activeCutoff = timestamp - ACTIVE_WINDOW_SECONDS;
    const todayCutoff = getBahrainDayStartUtcSeconds(nowUtc);

    const [last6Hours, today] = await Promise.all([
      dynamo.send(
        new QueryCommand({
          TableName: process.env.WEBSITE_ACTIVITY_TABLE!,
          KeyConditionExpression: "pk = :pk AND sk >= :sk",
          ExpressionAttributeValues: {
            ":pk": { S: "WEBSITE" },
            ":sk": { S: `${last6HoursCutoff}` },
          },
        })
      ),
      dynamo.send(
        new QueryCommand({
          TableName: process.env.WEBSITE_ACTIVITY_TABLE!,
          KeyConditionExpression: "pk = :pk AND sk >= :sk",
          ExpressionAttributeValues: {
            ":pk": { S: "WEBSITE" },
            ":sk": { S: `${todayCutoff}` },
          },
        })
      ),
    ]);

    /* ────────────────────────────────
       3️⃣ Calculate metrics
    ──────────────────────────────── */

    const activeUsers = new Set<string>();
    const usersToday = new Set<string>();
    const hourlyBuckets = new Map<string, Set<string>>();

    for (const item of last6Hours.Items ?? []) {
      const user = item.userId?.S;
      const ts = Number(item.timestamp?.N);
      if (!user || !ts) continue;

      if (ts >= activeCutoff) activeUsers.add(user);

      const bucket = formatBahrainHourLabel(ts);
      if (!hourlyBuckets.has(bucket)) {
        hourlyBuckets.set(bucket, new Set());
      }
      hourlyBuckets.get(bucket)!.add(user);
    }

    for (const item of today.Items ?? []) {
      if (item.userId?.S) usersToday.add(item.userId.S);
    }

    const usersLast6Hours = last6HourBuckets(timestamp).map((hour) => ({
      hour,
      count: hourlyBuckets.get(hour)?.size ?? 0,
    }));

    /* ────────────────────────────────
       4️⃣ Send cards to broadcast Lambda
    ──────────────────────────────── */

    const invoke = (payload: any) =>
      lambdaClient.send(
        new InvokeCommand({
          FunctionName: process.env.BROADCAST_LAMBDA!,
          InvocationType: "Event",
          Payload: Buffer.from(JSON.stringify(payload)),
        })
      );

    // 🔹 Active users (live)
    await invoke({
      card: "active_users_now",
      data: {
        count: activeUsers.size,
        timestamp,
      },
    });

    // 🔹 Users today
    await invoke({
      card: "users_today",
      data: {
        count: usersToday.size,
        timezone: "Asia/Bahrain",
      },
    });

    // 🔹 Last 6 hours chart
    await invoke({
      card: "users_last_6_hours",
      data: {
        series: usersLast6Hours,
      },
    });

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ status: "ok" }),
    };
  } catch (error) {
    console.error("Heartbeat error:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: "Internal error" }),
    };
  }
};
