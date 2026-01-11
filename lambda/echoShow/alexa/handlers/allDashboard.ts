import { DynamoDBClient, QueryCommand, ScanCommand } from "@aws-sdk/client-dynamodb";
import { allDashboardDocument } from "../apl/all-dashboard-apl-document";
import { calculateParkingStats, fetchTelemetrySummary } from "../utils/telemetryClient";

const dynamo = new DynamoDBClient({});
const ACTIVE_WINDOW_SECONDS = 5 * 60;
const BAHRAIN_OFFSET_SECONDS = 3 * 60 * 60;

function getActivityUserId(item: any) {
  return item.userId?.S ?? item.sessionId?.S;
}

function getBahrainDayStartUtcSeconds(nowUtc: Date) {
  const offsetMs = BAHRAIN_OFFSET_SECONDS * 1000;
  const bahrainNowMs = nowUtc.getTime() + offsetMs;
  const bahrainStart = new Date(bahrainNowMs);
  bahrainStart.setUTCHours(0, 0, 0, 0);
  return Math.floor((bahrainStart.getTime() - offsetMs) / 1000);
}

function formatHourLabel(hour: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour} ${period}`;
}

async function queryWebsiteActivitySince(cutoffSeconds: number) {
  const items: any[] = [];
  let lastKey: Record<string, any> | undefined;

  do {
    const result = await dynamo.send(
      new QueryCommand({
        TableName: process.env.WEBSITE_ACTIVITY_TABLE!,
        KeyConditionExpression: "pk = :pk AND sk >= :sk",
        ExpressionAttributeValues: {
          ":pk": { S: "WEBSITE" },
          ":sk": { S: `${cutoffSeconds}` },
        },
        ExclusiveStartKey: lastKey,
      })
    );

    if (result.Items) {
      items.push(...result.Items);
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return items;
}

async function fetchActivePlayersCount() {
  if (!process.env.ACTIVE_CONNECTIONS_TABLE) {
    return 0;
  }

  const result = await dynamo.send(
    new ScanCommand({
      TableName: process.env.ACTIVE_CONNECTIONS_TABLE,
    })
  );

  return result.Items?.filter((i) => i.role?.S === "visitor").length ?? 0;
}

async function fetchDailySummary() {
  const now = new Date();
  const bahrainDate = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const today = bahrainDate.toISOString().split("T")[0];

  if (!process.env.SUMMARIES_TABLE) {
    return { date: today, text: "Daily summary is not configured." };
  }

  const result = await dynamo.send(
    new QueryCommand({
      TableName: process.env.SUMMARIES_TABLE,
      KeyConditionExpression: "#date = :date",
      ExpressionAttributeNames: { "#date": "date" },
      ExpressionAttributeValues: { ":date": { S: today } },
      ScanIndexForward: false,
      Limit: 1,
    })
  );

  if (!result.Items || result.Items.length === 0) {
    return {
      date: today,
      text: "No summary available yet. Daily summary runs at 5:00 PM Bahrain time.",
    };
  }

  return {
    date: today,
    text: result.Items[0].aiSummary?.S ?? "No summary text available.",
  };
}

function buildHourlyStats(items: any[]) {
  const hourSets = new Map<number, Set<string>>();

  for (const item of items) {
    const userId = getActivityUserId(item);
    const timestamp = Number(item.timestamp?.N ?? 0);
    if (!userId || !timestamp) continue;

    const bahrainDate = new Date((timestamp + BAHRAIN_OFFSET_SECONDS) * 1000);
    const hour = bahrainDate.getUTCHours();

    if (!hourSets.has(hour)) {
      hourSets.set(hour, new Set<string>());
    }
    hourSets.get(hour)!.add(userId);
  }

  const allHours = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    users: hourSets.get(hour)?.size ?? 0,
  }));

  const hoursWithActivity = allHours.filter((h) => h.users > 0);
  const hasActivity = hoursWithActivity.length > 0;

  const peak = allHours.reduce(
    (max, h) => (h.users > max.users ? h : max),
    { hour: 0, users: 0 }
  );

  const lowest =
    hoursWithActivity.length > 0
      ? hoursWithActivity.reduce(
          (min, h) => (h.users < min.users ? h : min),
          hoursWithActivity[0]
        )
      : { hour: 0, users: 0 };

  const sortedHours = [...hoursWithActivity].sort((a, b) => a.users - b.users);
  const midIndex = Math.floor(sortedHours.length / 2);
  const mid =
    sortedHours.length > 0
      ? sortedHours[midIndex]
      : { hour: 12, users: 0 };

  return {
    hasActivity,
    peak: { hour: peak.hour, users: peak.users },
    mid: { hour: mid.hour, users: mid.users },
    lowest: { hour: lowest.hour, users: lowest.users },
  };
}

export async function getAllDashboard(event: any) {
  try {
    const nowUtc = new Date();
    const nowSeconds = Math.floor(nowUtc.getTime() / 1000);
    const cutoffSeconds = nowSeconds - ACTIVE_WINDOW_SECONDS;
    const startOfDay = getBahrainDayStartUtcSeconds(nowUtc);

    const [
      activePlayers,
      activityNowItems,
      activityTodayItems,
      dailySummary,
      telemetry,
    ] = await Promise.all([
      fetchActivePlayersCount(),
      queryWebsiteActivitySince(cutoffSeconds),
      queryWebsiteActivitySince(startOfDay),
      fetchDailySummary(),
      fetchTelemetrySummary(),
    ]);

    const activeUsersNow = new Set(
      activityNowItems.map((item) => getActivityUserId(item)).filter(Boolean)
    ).size;

    const usersToday = new Set(
      activityTodayItems.map((item) => getActivityUserId(item)).filter(Boolean)
    ).size;

    const hourlyStats = buildHourlyStats(activityTodayItems);

    const parkingStats = calculateParkingStats(telemetry.parkingSlots);
    const parkingText =
      parkingStats.total > 0
        ? `${parkingStats.available} / ${parkingStats.total}`
        : "N/A";

    const parkingSlots = telemetry.parkingSlots.map((slot, index) => {
      const status = slot.status ?? "unknown";
      const statusLabel =
        status === "occupied" ? "Occupied" : status === "empty" ? "Available" : "Unknown";
      const statusColor =
        status === "occupied" ? "#EF4444" : status === "empty" ? "#10B981" : "#9CA3AF";

      return {
        slotNumber: slot.slot ?? index + 1,
        status,
        statusLabel,
        statusColor,
      };
    });

    const telemetryData = {
      temperature: telemetry.temperature !== null ? `${telemetry.temperature}C` : "Sensor offline",
      temperatureColor: telemetry.temperature !== null ? "#EF4444" : "#6B7280",
      humidity: telemetry.humidity !== null ? `${telemetry.humidity}%` : "Sensor offline",
      humidityColor: telemetry.humidity !== null ? "#3B82F6" : "#6B7280",
      parking: parkingText,
      parkingSlots,
      hasParkingSlots: parkingSlots.length > 0,
    };

    const formattedSlots = telemetry.parkingSlots
      .slice(0, 6)
      .map((slot) => ({
        slotNumber: slot.slot,
        statusText: slot.status === "occupied" ? "Occupied" : "Available",
        statusColor: slot.status === "occupied" ? "#EF4444" : "#10B981",
      }));

    return {
      version: "1.0",
      response: {
        shouldEndSession: false,
        outputSpeech: {
          type: "PlainText",
          text: "Here is your full dashboard overview.",
        },
        directives: [
          {
            type: "Alexa.Presentation.APL.RenderDocument",
            token: `allDashboard-${Date.now()}`,
            document: allDashboardDocument,
            datasources: {
              data: {
                date: dailySummary.date,
                summaryText: dailySummary.text,
                metrics: {
                  activePlayers,
                  activeUsersNow,
                  usersToday,
                },
                telemetry: telemetryData,
                hourly: {
                  hasActivity: hourlyStats.hasActivity,
                  peakLabel: hourlyStats.hasActivity ? formatHourLabel(hourlyStats.peak.hour) : "--",
                  peakUsers: hourlyStats.peak.users,
                  midLabel: hourlyStats.hasActivity ? formatHourLabel(hourlyStats.mid.hour) : "--",
                  midUsers: hourlyStats.mid.users,
                  lowestLabel: hourlyStats.hasActivity ? formatHourLabel(hourlyStats.lowest.hour) : "--",
                  lowestUsers: hourlyStats.lowest.users,
                },
                iotSlots: formattedSlots,
                hasIotSlots: formattedSlots.length > 0,
              },
            },
          },
        ],
      },
    };
  } catch (error) {
    console.error("Error building all dashboard:", error);
    return {
      version: "1.0",
      response: {
        shouldEndSession: false,
        outputSpeech: {
          type: "PlainText",
          text: "Sorry, I couldn't build the full dashboard right now.",
        },
      },
    };
  }
}
