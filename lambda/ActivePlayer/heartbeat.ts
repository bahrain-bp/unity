import {
  DeleteItemCommand,
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
 
const dynamo = new DynamoDBClient({});
 
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*", // or http://localhost:5173
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};
 
const ACTIVE_WINDOW_SECONDS = 5 * 60; // 5 minutes
const LAST_6_HOURS_SECONDS = 6 * 60 * 60;
const BAHRAIN_OFFSET_SECONDS = 3 * 60 * 60;
 
function getBahrainDayStartUtcSeconds(nowUtc: Date) {
  const offsetMs = BAHRAIN_OFFSET_SECONDS * 1000;
  const bahrainNowMs = nowUtc.getTime() + offsetMs;
  const bahrainStart = new Date(bahrainNowMs);
  bahrainStart.setUTCHours(0, 0, 0, 0);
  return Math.floor((bahrainStart.getTime() - offsetMs) / 1000);
}
 
function formatBahrainHourLabel(timestampSeconds: number) {
  const date = new Date(
    (timestampSeconds + BAHRAIN_OFFSET_SECONDS) * 1000
  );
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:00`;
}
 
function formatBahrainHourBuckets(nowUtcSeconds: number) {
  const buckets: string[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const bucketSeconds = nowUtcSeconds - i * 3600;
    buckets.push(formatBahrainHourLabel(bucketSeconds));
  }
  return buckets;
}
 
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
 
    await dynamo.send(
      new PutItemCommand({
        TableName: process.env.WEBSITE_ACTIVITY_TABLE!,
        Item: {
          pk: { S: "WEBSITE" },
          sk: { S: `${timestamp}#${userId}` },
          userId: { S: userId },
          timestamp: { N: timestamp.toString() },
        },
      })
    );
 
    const last6HoursCutoff = timestamp - LAST_6_HOURS_SECONDS;
    const activeWindowCutoff = timestamp - ACTIVE_WINDOW_SECONDS;
    const bahrainDayStartUtc = getBahrainDayStartUtcSeconds(nowUtc);
 
    const last6Result = await dynamo.send(
      new QueryCommand({
        TableName: process.env.WEBSITE_ACTIVITY_TABLE!,
        KeyConditionExpression: "pk = :pk AND sk >= :sk",
        ExpressionAttributeValues: {
          ":pk": { S: "WEBSITE" },
          ":sk": { S: `${last6HoursCutoff}` },
        },
      })
    );
 
    const todayResult = await dynamo.send(
      new QueryCommand({
        TableName: process.env.WEBSITE_ACTIVITY_TABLE!,
        KeyConditionExpression: "pk = :pk AND sk >= :sk",
        ExpressionAttributeValues: {
          ":pk": { S: "WEBSITE" },
          ":sk": { S: `${bahrainDayStartUtc}` },
        },
      })
    );
 
    const activeUsersNow = new Set<string>();
    const usersToday = new Set<string>();
    const hourlyUserSets = new Map<string, Set<string>>();
 
    for (const item of last6Result.Items ?? []) {
      const user = item.userId?.S;
      const ts = Number(item.timestamp?.N ?? 0);
      if (!user || !ts) continue;
 
      if (ts >= activeWindowCutoff) {
        activeUsersNow.add(user);
      }
 
      const bucket = formatBahrainHourLabel(ts);
      if (!hourlyUserSets.has(bucket)) {
        hourlyUserSets.set(bucket, new Set<string>());
      }
      hourlyUserSets.get(bucket)!.add(user);
    }
 
    for (const item of todayResult.Items ?? []) {
      const user = item.userId?.S;
      if (user) {
        usersToday.add(user);
      }
    }
 
    const hourBuckets = formatBahrainHourBuckets(timestamp);
    const usersLast6Hours = hourBuckets.map((hour) => ({
      hour,
      count: hourlyUserSets.get(hour)?.size ?? 0,
    }));
 
    const broadcastMessage = {
      type: "DASHBOARD_STATS",
      activeUsersNow: activeUsersNow.size,
      usersToday: usersToday.size,
      usersLast6Hours,
      timezone: "Asia/Bahrain",
      timestamp,
    };
 
    const connectionsTable = process.env.ACTIVE_CONNECTIONS_TABLE;
    const wsEndpoint = process.env.WS_ENDPOINT;
 
    if (connectionsTable && wsEndpoint) {
      const scan = await dynamo.send(
        new ScanCommand({
          TableName: connectionsTable,
          FilterExpression: "#role = :role",
          ExpressionAttributeNames: {
            "#role": "role",
          },
          ExpressionAttributeValues: {
            ":role": { S: "admin" },
          },
        })
      );
 
      const api = new ApiGatewayManagementApiClient({
        endpoint: wsEndpoint
          .replace("wss://", "https://")
          .replace("ws://", "http://"),
      });
 
      const staleConnections: string[] = [];
 
      for (const item of scan.Items ?? []) {
        const connectionId = item.connectionId?.S;
        if (!connectionId) continue;
 
        try {
          await api.send(
            new PostToConnectionCommand({
              ConnectionId: connectionId,
              Data: Buffer.from(JSON.stringify(broadcastMessage)),
            })
          );
        } catch (error: any) {
          if (error?.statusCode === 410) {
            staleConnections.push(connectionId);
          } else {
            console.error("Broadcast error:", error);
          }
        }
      }
 
      for (const connectionId of staleConnections) {
        try {
          await dynamo.send(
            new DeleteItemCommand({
              TableName: connectionsTable,
              Key: { connectionId: { S: connectionId } },
            })
          );
        } catch (error) {
          console.error("Failed to delete stale connection:", error);
        }
      }
    }
 
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ status: "ok" }),
    };
  } catch (err) {
    console.error("Heartbeat error", err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: "Internal error" }),
    };
  }
};