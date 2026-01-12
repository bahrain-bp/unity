import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { dashboardDocument } from "../apl/dashboard-apl-document";
import { usersHourlyStatsDocument } from "../apl/users-hourly-stats-apl-document";

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

function activityMessage(activeNow: number) {
  if (activeNow === 0) return "No active users right now";
  if (activeNow <= 5) return "Light website activity";
  if (activeNow <= 20) return "Moderate website traffic";
  return "High website activity";
}

function formatHour(hour: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour} ${period}`;
}

/* ACTIVE USERS NOW */
export async function getActiveUsersNow(event: any) {
  try {
    const nowUtc = new Date();
    const nowSeconds = Math.floor(nowUtc.getTime() / 1000);
    const cutoffSeconds = nowSeconds - ACTIVE_WINDOW_SECONDS;
    const items = await queryWebsiteActivitySince(cutoffSeconds);
    const uniqueUsers = new Set<string>();

    for (const item of items) {
      const userId = getActivityUserId(item);
      if (userId) uniqueUsers.add(userId);
    }

    const activeNow = uniqueUsers.size;
    const message = activityMessage(activeNow);
    
    // Direct, natural response - no AI needed
    const speechText = `There ${activeNow === 1 ? 'is' : 'are'} currently ${activeNow} ${activeNow === 1 ? 'user' : 'users'} on the website. ${message}.`;

    return {
      version: "1.0",
      response: {
        shouldEndSession: false,
        outputSpeech: {
          type: "PlainText",
          text: speechText,
        },
        directives: [
          {
            type: "Alexa.Presentation.APL.RenderDocument",
            token: "activeUsersNow",
            document: dashboardDocument,
            datasources: {
              data: {
                title: "Active Users Now",
                description: "Users currently on the website",
                value: activeNow,
                message,
                showValue: true,
                accentColor: "#8B5CF6"
              },
            },
          },
        ],
      },
    };
  } catch (error) {
    console.error("Error fetching active users:", error);
    return {
      version: "1.0",
      response: {
        shouldEndSession: false,
        outputSpeech: {
          type: "PlainText",
          text: "Sorry, I couldn't fetch the active users data right now.",
        },
      },
    };
  }
}

/* USERS TODAY */
export async function getUsersToday(event: any) {
  try {
    const nowUtc = new Date();
    const startOfDay = getBahrainDayStartUtcSeconds(nowUtc);
    const items = await queryWebsiteActivitySince(startOfDay);
    const uniqueUsers = new Set<string>();

    for (const item of items) {
      const userId = getActivityUserId(item);
      if (userId) uniqueUsers.add(userId);
    }

    const usersToday = uniqueUsers.size;
    
    const speechText = usersToday === 0
      ? "There have been no visitors to the website today."
      : `There ${usersToday === 1 ? 'has' : 'have'} been ${usersToday} ${usersToday === 1 ? 'visitor' : 'visitors'} to the website today.`;

    return {
      version: "1.0",
      response: {
        shouldEndSession: false,
        outputSpeech: {
          type: "PlainText",
          text: speechText,
        },
        directives: [
          {
            type: "Alexa.Presentation.APL.RenderDocument",
            token: "usersToday",
            document: dashboardDocument,
            datasources: {
              data: {
                title: "Users Today",
                description: "Total visitors today",
                value: usersToday,
                message: "Total unique visitors",
                showValue: true,
                accentColor: "#10B981"
              },
            },
          },
        ],
      },
    };
  } catch (error) {
    console.error("Error fetching users today:", error);
    return {
      version: "1.0",
      response: {
        shouldEndSession: false,
        outputSpeech: {
          type: "PlainText",
          text: "Sorry, I couldn't fetch today's user data right now.",
        },
      },
    };
  }
}

export async function getUsersTodayHourly(event: any) {
  try {
    const nowUtc = new Date();
    const startOfDay = getBahrainDayStartUtcSeconds(nowUtc);
    const items = await queryWebsiteActivitySince(startOfDay);
    const hourSets = new Map<number, Set<string>>();

    for (const item of items) {
      const userId = getActivityUserId(item);
      const timestamp = Number(item.timestamp?.N ?? 0);
      if (!userId || !timestamp) continue;

      const bahrainDate = new Date(
        (timestamp + BAHRAIN_OFFSET_SECONDS) * 1000
      );
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

    // Calculate statistics
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

    const sortedHours = [...hoursWithActivity].sort(
      (a, b) => a.users - b.users
    );
    const midIndex = Math.floor(sortedHours.length / 2);
    const mid =
      sortedHours.length > 0
        ? sortedHours[midIndex]
        : { hour: 12, users: 0 };

    const speechText = peak.users === 0
      ? "There has been no website activity today."
      : `Peak activity was ${peak.users} ${peak.users === 1 ? 'user' : 'users'} at ${formatHour(peak.hour)}, ` +
        `quietest at ${formatHour(lowest.hour)} with ${lowest.users} ${lowest.users === 1 ? 'user' : 'users'}, ` +
        `with typical activity around ${mid.users} ${mid.users === 1 ? 'user' : 'users'}.`;

    return {
      version: "1.0",
      response: {
        shouldEndSession: false,
        outputSpeech: {
          type: "PlainText",
          text: speechText,
        },
        directives: [
          {
            type: "Alexa.Presentation.APL.RenderDocument",
            token: `usersHourlyStats-${Date.now()}`,
            document: usersHourlyStatsDocument,
            datasources: {
              data: {
                hasActivity,
                peak: {
                  hour: peak.hour,
                  users: peak.users,
                  label: hasActivity ? formatHour(peak.hour) : "--"
                },
                mid: {
                  hour: mid.hour,
                  users: mid.users,
                  label: hasActivity ? formatHour(mid.hour) : "--"
                },
                lowest: {
                  hour: lowest.hour,
                  users: lowest.users,
                  label: hasActivity ? formatHour(lowest.hour) : "--"
                }
              }
            }
          }
        ]
      }
    };
  } catch (error) {
    console.error("Error fetching hourly data:", error);
    return {
      version: "1.0",
      response: {
        shouldEndSession: false,
        outputSpeech: {
          type: "PlainText",
          text: "Sorry, I couldn't fetch the hourly activity data right now.",
        }
      }
    };
  }
}
