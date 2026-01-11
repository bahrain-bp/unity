import { 
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { DateTime } from "luxon";

const dynamo = new DynamoDBClient({});
const lambdaClient = new LambdaClient({});

const ACTIVE_WINDOW_SECONDS = 5 * 60;        // 5 minutes
const LAST_6_HOURS_SECONDS = 6 * 60 * 60;
const TTL_SECONDS = 2 * 24 * 60 * 60;
const BAHRAIN_TIMEZONE = "Asia/Bahrain";

// Response helper
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

// Time helpers (using Luxon)
function getBahrainDayStartUtcSeconds(nowUtc: Date) {
  const bahrainStart = DateTime.fromJSDate(nowUtc, { zone: "utc" })
    .setZone(BAHRAIN_TIMEZONE)
    .startOf("day");
  return Math.floor(bahrainStart.toUTC().toSeconds());
}

function formatBahrainHourLabel(timestampSeconds: number) {
  return DateTime.fromSeconds(timestampSeconds, { zone: "utc" })
    .setZone(BAHRAIN_TIMEZONE)
    .toFormat("yyyy-LL-dd HH:00");
}

function last6HourBuckets(nowSeconds: number) {
  const buckets: string[] = [];
  for (let i = 5; i >= 0; i--) {
    buckets.push(formatBahrainHourLabel(nowSeconds - i * 3600));
  }
  return buckets;
}

// Lambda handler
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

    // Using Luxon for proper timezone handling
    const bahrainNow = DateTime.fromJSDate(nowUtc, { zone: "utc" }).setZone(BAHRAIN_TIMEZONE);
    const bahrainDate = bahrainNow.toISODate();
    const yesterdayBahrainDate = bahrainNow.minus({ days: 1 }).toISODate();

    console.log(`Bahrain dates - Today: ${bahrainDate}, Yesterday: ${yesterdayBahrainDate}`);

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
          ttl: { N: (timestamp + TTL_SECONDS).toString() },
        },
      })
    );
    console.log("Heartbeat saved successfully");

    // 1️⃣ Save daily marker (users active today)
    try {
      await dynamo.send(
        new PutItemCommand({
          TableName: process.env.WEBSITE_ACTIVITY_TABLE!,
          Item: {
            pk: { S: `DAY#${bahrainDate}` },
            sk: { S: userId },
            ttl: { N: (timestamp + TTL_SECONDS).toString() },
          },
          ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
        })
      );
      console.log("Daily marker saved (first time today for this user)");
    } catch (error: any) {
      if (error?.name !== "ConditionalCheckFailedException") {
        throw error;
      }
      console.log("Daily marker already exists for this user today");
    }

    // 2️⃣ Query activity
    const last6HoursCutoff = timestamp - LAST_6_HOURS_SECONDS;
    const activeCutoff = timestamp - ACTIVE_WINDOW_SECONDS;
    const last6HoursStart = `${last6HoursCutoff}#`;
    const last6HoursEnd = `${timestamp}#~`;

    console.log("Query cutoffs:", { 
      last6HoursCutoff, 
      activeCutoff,
      last6HoursStart,
      last6HoursEnd 
    });

    const [last6Hours, todayDaily, yesterdayDaily] = await Promise.all([
      dynamo.send(
        new QueryCommand({
          TableName: process.env.WEBSITE_ACTIVITY_TABLE!,
          KeyConditionExpression: "pk = :pk AND sk BETWEEN :start AND :end",
          ExpressionAttributeValues: {
            ":pk": { S: "WEBSITE" },
            ":start": { S: last6HoursStart },
            ":end": { S: last6HoursEnd },
          },
        })
      ),
      dynamo.send(
        new QueryCommand({
          TableName: process.env.WEBSITE_ACTIVITY_TABLE!,
          KeyConditionExpression: "pk = :pk",
          ExpressionAttributeValues: {
            ":pk": { S: `DAY#${bahrainDate}` },
          },
        })
      ),
      dynamo.send(
        new QueryCommand({
          TableName: process.env.WEBSITE_ACTIVITY_TABLE!,
          KeyConditionExpression: "pk = :pk",
          ExpressionAttributeValues: {
            ":pk": { S: `DAY#${yesterdayBahrainDate}` },
          },
        })
      ),
    ]);

    console.log("Queried last 6 hours items:", last6Hours.Items?.length ?? 0);
    console.log("Queried today items:", todayDaily.Items?.length ?? 0);
    console.log("Queried yesterday items:", yesterdayDaily.Items?.length ?? 0);

    // 3️⃣ Calculate metrics
    const activeUsers = new Set<string>();
    const usersToday = new Set<string>();
    const usersYesterday = new Set<string>();
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

    for (const item of todayDaily.Items ?? []) {
      if (item.sk?.S) usersToday.add(item.sk.S);
    }
    console.log("Users today:", Array.from(usersToday));

    for (const item of yesterdayDaily.Items ?? []) {
      if (item.sk?.S) usersYesterday.add(item.sk.S);
    }
    console.log("Users yesterday:", Array.from(usersYesterday));

    const usersLast6Hours = last6HourBuckets(timestamp).map((hour) => ({
      hour,
      count: hourlyBuckets.get(hour)?.size ?? 0,
    }));
    console.log("Users last 6 hours series:", usersLast6Hours);

    const usersTodayCount = usersToday.size;
    const usersYesterdayCount = usersYesterday.size;
    let usersTodayChangePct: number;

    if (usersYesterdayCount === 0 && usersTodayCount > 0) {
      usersTodayChangePct = 100;
    } else if (usersYesterdayCount === 0 && usersTodayCount === 0) {
      usersTodayChangePct = 0;
    } else {
      usersTodayChangePct =
        ((usersTodayCount - usersYesterdayCount) / usersYesterdayCount) * 100;
    }

    // 4️⃣ Send cards to broadcast Lambda (from first version)
    const invoke = (payload: any) => {
      console.log("Invoking broadcast Lambda with payload:", payload);
      return lambdaClient.send(
        new InvokeCommand({
          FunctionName: process.env.BROADCAST_LAMBDA!,
          InvocationType: "Event", // Async invocation
          Payload: Buffer.from(JSON.stringify(payload)),
        })
      );
    };

    // Broadcast all three metrics
    await invoke({ 
      card: "active_users_now", 
      data: { 
        count: activeUsers.size, 
        timestamp 
      } 
    });
    
    await invoke({
      card: "users_today",
      data: {
        count: usersTodayCount,
        usersYesterday: usersYesterdayCount,
        usersTodayChangePct,
        timezone: BAHRAIN_TIMEZONE,
      },
    });
    
    await invoke({ 
      card: "users_last_6_hours", 
      data: { 
        series: usersLast6Hours 
      } 
    });

    console.log("All broadcast Lambda invocations completed");

    return respond(200, { status: "ok" });
  } catch (error) {
    console.error("Heartbeat error:", error);
    return respond(500, { message: "Internal error" });
  }
};