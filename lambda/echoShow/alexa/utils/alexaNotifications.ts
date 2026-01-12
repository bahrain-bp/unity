import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";

const dynamo = new DynamoDBClient({});

const ALEXA_API_ENDPOINT = "https://api.amazonalexa.com";
const CLIENT_ID = process.env.ALEXA_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.ALEXA_CLIENT_SECRET ?? "";
const USERS_TABLE = process.env.ALEXA_USERS_TABLE ?? "";
const STAGE = process.env.ALEXA_STAGE ?? "development";

interface AlexaUser {
  userId: string;
  locale: string;
}

async function getAccessToken(): Promise<string> {
  const response = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: "alexa::proactive_events",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OAuth failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function getNotificationEnabledUsers(): Promise<AlexaUser[]> {
  if (!USERS_TABLE) {
    return [];
  }

  const result = await dynamo.send(
    new ScanCommand({
      TableName: USERS_TABLE,
      FilterExpression: "notificationsEnabled = :enabled",
      ExpressionAttributeValues: {
        ":enabled": { BOOL: true },
      },
    })
  );

  return (result.Items ?? [])
    .map((item) => ({
      userId: item.userId?.S ?? "",
      locale: item.locale?.S ?? "en-US",
    }))
    .filter((user) => user.userId.length > 0);
}

async function sendProactiveEvent(
  accessToken: string,
  user: AlexaUser,
  summaryText: string
): Promise<void> {
  const now = new Date();
  const expiryTime = new Date(now.getTime() + 60 * 60 * 1000);

  const payload = {
    timestamp: now.toISOString(),
    referenceId: `daily-summary-${now.getTime()}`,
    expiryTime: expiryTime.toISOString(),
    event: {
      name: "AMAZON.MessageAlert.Activated",
      payload: {
        state: {
          status: "UNREAD",
        },
        messageGroup: {
          creator: {
            name: "BahTwin Admin",
          },
          count: 1,
          urgency: "NORMAL",
        },
      },
    },
    localizedAttributes: [
      {
        locale: user.locale,
        summaryText: summaryText.substring(0, 200),
      },
    ],
    relevantAudience: {
      type: "Unicast",
      payload: {
        user: user.userId,
      },
    },
  };

  const response = await fetch(
    `${ALEXA_API_ENDPOINT}/v1/proactiveEvents/stages/${STAGE}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Proactive event failed: ${response.status} ${text}`);
  }
}

export async function broadcastDailySummary(summaryText: string): Promise<void> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.warn("Alexa proactive events credentials missing.");
    return;
  }

  const users = await getNotificationEnabledUsers();
  if (!users.length) {
    console.warn("No users enabled for proactive events.");
    return;
  }

  const accessToken = await getAccessToken();

  await Promise.all(
    users.map((user) => sendProactiveEvent(accessToken, user, summaryText))
  );
}
