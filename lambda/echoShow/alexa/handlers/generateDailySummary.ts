// lambda/echoShow/alexa/handlers/generateDailySummary.ts

import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { fetchTelemetrySummary, calculateParkingStats } from "../utils/telemetryClient";
import { broadcastDailySummary } from "../utils/alexaNotifications";

const dynamo = new DynamoDBClient({});
const bedrock = new BedrockRuntimeClient({ region: "us-east-1" });

const SUMMARIES_TABLE = process.env.SUMMARIES_TABLE!;
const WEBSITE_ACTIVITY_TABLE = process.env.WEBSITE_ACTIVITY_TABLE!;

// Bahrain is UTC+3
const BAHRAIN_OFFSET_SECONDS = 3 * 60 * 60;
const ACTIVE_WINDOW_SECONDS = 5 * 60; // 5 minutes

export async function handler() {
  try {
    console.log("Starting daily summary generation...");

    // 1) Collect current metrics
    const metrics = await collectMetrics();
    console.log("Metrics collected:", {
      visitors: metrics.usersToday,
      activeNow: metrics.activeUsersNow,
      temperature: metrics.temperature,
      parking: `${metrics.parkingAvailable}/${metrics.parkingTotal}`,
    });

    // 2) Get historical context
    const historical = await getHistoricalContext();
    console.log("Historical averages:", {
      avgVisitors: historical.avgUsersLast7Days,
      avgTemp: historical.avgTemperature,
    });

    // 3) Generate AI summary
    const aiSummary = await generateNovaSummary(metrics, historical);
    console.log("Summary generated:", aiSummary.substring(0, 100) + "...");

    // 4) Store in DynamoDB
    const date = metrics.date;
    const timestamp = Date.now();

    await dynamo.send(
      new PutItemCommand({
        TableName: SUMMARIES_TABLE,
        Item: {
          date: { S: date },
          timestamp: { N: timestamp.toString() },
          metrics: { S: JSON.stringify(metrics) },
          aiSummary: { S: aiSummary },
          ttl: {
            N: Math.floor(Date.now() / 1000 + 90 * 24 * 60 * 60).toString(),
          },
        },
      })
    );

    try {
      await broadcastDailySummary(aiSummary);
    } catch (notifyError) {
      console.error("Proactive events error:", notifyError);
    }

    console.log("Summary saved to DynamoDB");
    return { statusCode: 200, body: "Summary generated successfully" };
  } catch (error) {
    console.error("Error generating summary:", error);
    return { statusCode: 500, body: `Error: ${error}` };
  }
}

// Collect today's metrics
async function collectMetrics() {
  const nowUtc = new Date();
  const nowSeconds = Math.floor(nowUtc.getTime() / 1000);
  const activeWindowCutoff = nowSeconds - ACTIVE_WINDOW_SECONDS;

  // Calculate Bahrain day start in UTC seconds
  const bahrainDayStartUtc = getBahrainDayStartUtcSeconds(nowUtc);
  const bahrainDateStr = formatBahrainDate(nowUtc);

  try {
    // Fetch website activity
    const [last6HoursItems, todayItems] = await Promise.all([
      queryWebsiteActivitySince(nowSeconds - 6 * 60 * 60),
      queryWebsiteActivitySince(bahrainDayStartUtc),
    ]);

    // Process website metrics
    const activeUsersNowSet = new Set<string>();
    const usersTodaySet = new Set<string>();
    const hourlyCounts = new Map<number, number>();

    for (const item of last6HoursItems) {
      const userId = item.userId?.S;
      const ts = Number(item.timestamp?.N ?? 0);
      if (!userId || !ts) continue;

      // Active users now (last 5 minutes)
      if (ts >= activeWindowCutoff) {
        activeUsersNowSet.add(userId);
      }

      // Hourly breakdown (Bahrain timezone)
      const bahrainDate = new Date((ts + BAHRAIN_OFFSET_SECONDS) * 1000);
      const hour = bahrainDate.getUTCHours();
      hourlyCounts.set(hour, (hourlyCounts.get(hour) || 0) + 1);
    }

    // Count unique visitors today
    for (const item of todayItems) {
      const userId = item.userId?.S;
      if (userId) usersTodaySet.add(userId);
    }

    const activeUsersNow = activeUsersNowSet.size;
    const usersToday = usersTodaySet.size;

    // Build hourly data
    const hourlyData = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      users: hourlyCounts.get(hour) || 0,
    }));

    const peakHour = hourlyData.reduce(
      (max, h) => (h.users > max.users ? h : max),
      { hour: 0, users: 0 }
    );

    const peakHourLabel = formatBahrainHourLabel(bahrainDateStr, peakHour.hour);

    // Fetch IoT sensor data using shared client
    console.log("Fetching IoT data via shared client...");
    const { temperature, humidity, parkingSlots } = await fetchTelemetrySummary(5000);
    const parkingStats = calculateParkingStats(parkingSlots);

    console.log(
      `IoT: ${temperature}C, ${humidity}%, Parking: ${parkingStats.available}/${parkingStats.total}`
    );

    return {
      date: bahrainDateStr,
      timestamp: new Date().toISOString(),
      timezone: "Asia/Bahrain",
      activeUsersNow,
      usersToday,
      peakHour: peakHour.hour,
      peakHourLabel,
      peakHourUsers: peakHour.users,
      hourlyData,
      temperature,
      humidity,
      parkingAvailable: parkingStats.available,
      parkingTotal: parkingStats.total,
    };
  } catch (error) {
    console.error("Error collecting metrics:", error);
    // Return empty metrics as fallback
    return {
      date: formatBahrainDate(nowUtc),
      timestamp: new Date().toISOString(),
      timezone: "Asia/Bahrain",
      activeUsersNow: 0,
      usersToday: 0,
      peakHour: 0,
      peakHourLabel: "00:00",
      peakHourUsers: 0,
      hourlyData: [],
      temperature: null,
      humidity: null,
      parkingAvailable: 0,
      parkingTotal: 0,
    };
  }
}

// Get 7-day historical context
async function getHistoricalContext() {
  try {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i - 1);
      return formatBahrainDate(d);
    });

    const historicalPromises = last7Days.map(async (date) => {
      const result = await dynamo.send(
        new QueryCommand({
          TableName: SUMMARIES_TABLE,
          KeyConditionExpression: "#date = :date",
          ExpressionAttributeNames: { "#date": "date" },
          ExpressionAttributeValues: { ":date": { S: date } },
          ScanIndexForward: false,
          Limit: 1,
        })
      );

      if (result.Items && result.Items.length > 0) {
        const metrics = JSON.parse(result.Items[0].metrics.S!);
        return {
          date,
          usersToday: metrics.usersToday || 0,
          temperature: metrics.temperature ?? null,
          humidity: metrics.humidity ?? null,
        };
      }
      return { date, usersToday: 0, temperature: null, humidity: null };
    });

    const historicalData = await Promise.all(historicalPromises);

    // Calculate averages
    const avgUsers = historicalData.reduce((sum, d) => sum + d.usersToday, 0) / 7;

    const temps = historicalData
      .map((d) => d.temperature)
      .filter((t) => t !== null) as number[];
    const avgTemp =
      temps.length > 0
        ? temps.reduce((sum, t) => sum + t, 0) / temps.length
        : null;

    const humidities = historicalData
      .map((d) => d.humidity)
      .filter((h) => h !== null) as number[];
    const avgHumidity =
      humidities.length > 0
        ? humidities.reduce((sum, h) => sum + h, 0) / humidities.length
        : null;

    return {
      last7Days: historicalData,
      avgUsersLast7Days: Math.round(avgUsers),
      avgTemperature: avgTemp !== null ? Number(avgTemp.toFixed(1)) : null,
      avgHumidity: avgHumidity !== null ? Number(avgHumidity.toFixed(1)) : null,
    };
  } catch (error) {
    console.error("Error fetching historical data:", error);
    return {
      last7Days: [],
      avgUsersLast7Days: 0,
      avgTemperature: null,
      avgHumidity: null,
    };
  }
}

// Generate AI summary with Amazon Nova (enhanced)
async function generateNovaSummary(metrics: any, historical: any): Promise<string> {
  const dayOfWeek = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const date = new Date(metrics.date);
  const isWeekend = date.getDay() === 0 || date.getDay() === 6; // Sunday = 0, Saturday = 6

  // Calculate changes
  const userChange =
    historical.avgUsersLast7Days > 0
      ? ((metrics.usersToday - historical.avgUsersLast7Days) /
          historical.avgUsersLast7Days) *
        100
      : 0;

  const tempChange =
    historical.avgTemperature && metrics.temperature
      ? metrics.temperature - historical.avgTemperature
      : null;

  const humidityChange =
    historical.avgHumidity && metrics.humidity
      ? metrics.humidity - historical.avgHumidity
      : null;

  // Detect data quality issues
  const hasWebsiteData = metrics.usersToday > 0 || historical.avgUsersLast7Days > 0;
  const hasIoTData = metrics.temperature !== null || metrics.humidity !== null;
  const hasParkingData = metrics.parkingTotal > 0;

  // Context-aware prompt
  const systemPrompt = `You are Peccy, the friendly AI assistant for BahTwin Admin Dashboard. Generate a natural, conversational daily summary for Alexa voice delivery.

STYLE GUIDE:
- Sound like a helpful colleague sharing insights
- Keep it to 3-4 sentences maximum
- Always provide CONTEXT for the numbers (e.g., "typical weekend", "holiday", "system downtime")
- If data shows zero activity, explain WHY (weekend, late night, data collection issue)
- Include environmental comfort (temperature/humidity) when available
- Mention parking status if notable
- End with a forward-looking insight or recommendation
- Be optimistic but realistic

SPECIAL CASES:
- Weekend with no traffic: "Expected quiet weekend - system is working normally"
- Zero data on weekday: "Possible data collection issue - will investigate"
- Missing IoT: "IoT sensors offline - checking connectivity"
- No historical data: "First week of data collection - building baseline"

TONE: Warm, professional, insightful, never boring`;

  let contextNotes = "";

  // Build context based on data patterns
  if (isWeekend && metrics.usersToday === 0) {
    contextNotes =
      "This is a weekend - zero website traffic is normal and expected. Focus on environmental conditions and forward-looking insights for Monday.";
  } else if (!hasWebsiteData && !isWeekend) {
    contextNotes =
      "Alert: No website data on a weekday suggests a data collection issue. Acknowledge this and recommend checking the system.";
  } else if (metrics.usersToday === 0 && historical.avgUsersLast7Days > 10) {
    contextNotes =
      "Unusual: Usually active but zero today - possible system downtime or holiday.";
  }

  const userPrompt = `Generate a ${dayOfWeek} summary for ${metrics.date}:

TODAY'S DATA:
- Website Visitors: ${metrics.usersToday} ${isWeekend ? "(weekend)" : ""}
- 7-Day Average: ${historical.avgUsersLast7Days} visitors/day
- Traffic Change: ${userChange > 0 ? "+" : ""}${userChange.toFixed(1)}%
- Active Users Now: ${metrics.activeUsersNow}
- Peak Activity: ${metrics.peakHourLabel} with ${metrics.peakHourUsers} users
${
  metrics.temperature !== null
    ? `- Temperature: ${metrics.temperature}C (7-day avg: ${historical.avgTemperature}C)`
    : "- Temperature: N/A (IoT sensors offline)"
}
${
  metrics.humidity !== null
    ? `- Humidity: ${metrics.humidity}% (7-day avg: ${historical.avgHumidity}%)`
    : "- Humidity: N/A"
}
${
  hasParkingData
    ? `- Parking: ${metrics.parkingAvailable}/${metrics.parkingTotal} slots available (${Math.round(
        (metrics.parkingAvailable / metrics.parkingTotal) * 100
      )}% free)`
    : "- Parking: Data unavailable"
}

CONTEXT:
${contextNotes || "Standard business day - compare to historical baseline."}
- Data Quality: ${hasWebsiteData ? "Good" : "Poor - investigate"}
- IoT Status: ${hasIoTData ? "Connected" : "Offline"}
- Day Type: ${isWeekend ? "Weekend (low traffic expected)" : "Weekday (normal operations)"}

YOUR TASK:
Generate a summary that:
1. Explains the activity level (or lack thereof) with context
2. Mentions environmental conditions if comfortable/uncomfortable
3. Notes any unusual patterns
4. Provides a forward-looking insight or recommendation
5. Never just state "zero visitors" without explaining why

Generate the summary:`;

  try {
    const payload = {
      messages: [
        {
          role: "user",
          content: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
        },
      ],
      inferenceConfig: {
        max_new_tokens: 250,
        temperature: 0.8,
        top_p: 0.9,
      },
    };

    const command = new InvokeModelCommand({
      modelId: "amazon.nova-pro-v1:0",
      contentType: "application/json",
      body: JSON.stringify(payload),
    });

    const response = await bedrock.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    return responseBody.output.message.content[0].text.trim();
  } catch (error) {
    console.error("Bedrock error:", error);

    // Intelligent fallback (context-aware)
    if (isWeekend && metrics.usersToday === 0) {
      return `${dayOfWeek} was a quiet weekend day with no website activity, which is completely normal. ${
        metrics.temperature !== null
          ? `Temperature was ${metrics.temperature}C with ${metrics.humidity}% humidity.`
          : ""
      } ${
        hasParkingData
          ? `All ${metrics.parkingTotal} parking slots were available.`
          : ""
      } We typically see traffic resume Monday morning around 9 AM.`;
    }

    if (metrics.usersToday === 0 && !isWeekend) {
      return `Unusual ${dayOfWeek} with no website visitors detected. This may indicate a data collection issue or system downtime. Please verify that analytics tracking is functioning properly. ${
        metrics.temperature !== null ? `Office environment was ${metrics.temperature}C.` : ""
      }`;
    }

    return `${dayOfWeek} saw ${metrics.usersToday} website visitors${  
      userChange !== 0
        ? `, ${userChange > 0 ? "up" : "down"} ${Math.abs(userChange).toFixed(
            0
          )}% from the weekly average`
        : ""
    }. ${metrics.peakHourUsers > 0 ? `Peak activity was at ${metrics.peakHourLabel}.` : ""} ${
      metrics.temperature !== null ? `Temperature was ${metrics.temperature}C.` : ""
    }`;
  }
}

// Utility functions
function formatBahrainDate(nowUtc: Date): string {
  const offsetMs = BAHRAIN_OFFSET_SECONDS * 1000;
  const bahrainDate = new Date(nowUtc.getTime() + offsetMs);
  const year = bahrainDate.getUTCFullYear();
  const month = String(bahrainDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(bahrainDate.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatBahrainHourLabel(dateStr: string, hour: number): string {
  const hourLabel = String(hour).padStart(2, "0");
  return `${hourLabel}:00`;
}

function getBahrainDayStartUtcSeconds(nowUtc: Date): number {
  const offsetMs = BAHRAIN_OFFSET_SECONDS * 1000;
  const bahrainNowMs = nowUtc.getTime() + offsetMs;
  const bahrainStart = new Date(bahrainNowMs);
  bahrainStart.setUTCHours(0, 0, 0, 0);
  return Math.floor((bahrainStart.getTime() - offsetMs) / 1000);
}

async function queryWebsiteActivitySince(cutoffSeconds: number) {
  const items: any[] = [];
  let lastKey: Record<string, any> | undefined;

  do {
    const result = await dynamo.send(
      new QueryCommand({
        TableName: WEBSITE_ACTIVITY_TABLE,
        KeyConditionExpression: "pk = :pk AND sk >= :sk",
        ExpressionAttributeValues: {
          ":pk": { S: "WEBSITE" },
          ":sk": { S: `${cutoffSeconds}` },
        },
        ExclusiveStartKey: lastKey,
      })
    );

    if (result.Items) items.push(...result.Items);
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return items;
}
