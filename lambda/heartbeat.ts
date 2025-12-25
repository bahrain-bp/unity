import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const dynamo = new DynamoDBClient({});
const lambdaClient = new LambdaClient({});

const ACTIVE_WINDOW_SECONDS = 5 * 60;        // 5 minutes
const LAST_6_HOURS_SECONDS = 6 * 60 * 60;
const BAHRAIN_OFFSET_SECONDS = 3 * 60 * 60;

/* ────────────────────────────────
   Response helper
──────────────────────────────── */
function respond(status: number, body: object) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
      "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
    },
    body: JSON.stringify(body),
  };
}

/* ────────────────────────────────
   Time helpers
──────────────────────────────── */
function getBahrainDayStartUtcSeconds(nowUtc: Date) {
  const offsetMs = BAHRAIN_OFFSET_SECONDS * 1000;
  const bahrainNowMs = nowUtc.getTime() + offsetMs;
  const start = new Date(bahrainNowMs);
  start.setUTCHours(0, 0, 0, 0);
  return Math.floor((start.getTime() - offsetMs) / 1000);
}

function formatBahrainHourLabel(timestampSeconds: number) {
  const date = new Date((timestampSeconds + BAHRAIN_OFFSET_SECONDS) * 1000);
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
    console.log("Received event:", JSON.stringify(event));

    if (event?.httpMethod === "OPTIONS") {
      console.log("OPTIONS request received, returning 200");
      return respond(200, {});
    }

    const body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    console.log("Parsed request body:", body);

    const userId = body?.userId;
    if (!userId) {
      console.warn("Missing userId in request");
      return respond(400, { message: "Missing userId" });
    }

    const nowUtc = new Date();
    const timestamp = Math.floor(nowUtc.getTime() / 1000);
    console.log(`Current UTC timestamp: ${timestamp}`);

    // 1️⃣ Save heartbeat
    console.log(`Saving heartbeat for userId: ${userId}`);
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
    console.log("Heartbeat saved successfully");

    // 2️⃣ Query activity
    const last6HoursCutoff = timestamp - LAST_6_HOURS_SECONDS;
    const activeCutoff = timestamp - ACTIVE_WINDOW_SECONDS;
    const todayCutoff = getBahrainDayStartUtcSeconds(nowUtc);
    console.log("Query cutoffs:", { last6HoursCutoff, activeCutoff, todayCutoff });

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
    console.log("Queried last 6 hours items:", last6Hours.Items?.length ?? 0);
    console.log("Queried today items:", today.Items?.length ?? 0);

    // 3️⃣ Calculate metrics
    const activeUsers = new Set<string>();
    const usersToday = new Set<string>();
    const hourlyBuckets = new Map<string, Set<string>>();

    for (const item of last6Hours.Items ?? []) {
      const user = item.userId?.S;
      const ts = Number(item.timestamp?.N);
      if (!user || !ts) continue;

      if (ts >= activeCutoff) activeUsers.add(user);

      const bucket = formatBahrainHourLabel(ts);
      if (!hourlyBuckets.has(bucket)) hourlyBuckets.set(bucket, new Set());
      hourlyBuckets.get(bucket)!.add(user);
    }
    console.log("Active users in last 5 minutes:", Array.from(activeUsers));

    for (const item of today.Items ?? []) {
      if (item.userId?.S) usersToday.add(item.userId.S);
    }
    console.log("Users today:", Array.from(usersToday));

    const usersLast6Hours = last6HourBuckets(timestamp).map((hour) => ({
      hour,
      count: hourlyBuckets.get(hour)?.size ?? 0,
    }));
    console.log("Users last 6 hours series:", usersLast6Hours);

    // 4️⃣ Send cards to broadcast Lambda
    const invoke = (payload: any) => {
      console.log("Invoking broadcast Lambda with payload:", payload);
      return lambdaClient.send(
        new InvokeCommand({
          FunctionName: process.env.BROADCAST_LAMBDA!,
          InvocationType: "Event",
          Payload: Buffer.from(JSON.stringify(payload)),
        })
      );
    };

    await invoke({ card: "active_users_now", data: { count: activeUsers.size, timestamp } });
    await invoke({ card: "users_today", data: { count: usersToday.size, timezone: "Asia/Bahrain" } });
    await invoke({ card: "users_last_6_hours", data: { series: usersLast6Hours } });
    console.log("All broadcast Lambda invocations completed");

    return respond(200, { status: "ok" });
  } catch (error) {
    console.error("Heartbeat error:", error);
    return respond(500, { message: "Internal error" });
  }
};
