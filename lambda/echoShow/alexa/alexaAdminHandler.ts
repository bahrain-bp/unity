// lambda/echoShow/alexa/alexaAdminHandler.ts

import { welcomeDashboardDocument } from "./apl/welcome-dashboard-apl-document";
import { getActivePlayers } from "./handlers/activePlayers";
import {
  getActiveUsersNow,
  getUsersToday,
  getUsersTodayHourly,
} from "./handlers/activeUsers";
import { showIotSensors } from "./handlers/showIotSensors";
import { getDailySummary } from "./handlers/getDailySummary";
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import {
  enableNotifications,
  disableNotifications,
} from "./handlers/manageNotifications";
import {
  getTemperature,
  getHumidity,
  getParkingStatus,
  getClimate,
} from "./handlers/telemetry";
import { getAllDashboard } from "./handlers/allDashboard";

export const handler = async (event: any) => {
  console.log("Alexa Request:", JSON.stringify(event.request, null, 2));

  const requestType = event.request?.type;
  const intentName = event.request?.intent?.name || event.request?.arguments?.[0];

  try {
    // Launch Request -> Welcome Screen
    if (requestType === "LaunchRequest") {
      return await buildWelcomeResponse(event);
    }

    // Button Press (APL UserEvent) or Voice Intent
    if (
      requestType === "Alexa.Presentation.APL.UserEvent" ||
      requestType === "IntentRequest"
    ) {
      return await routeIntent(intentName, event);
    }

    // Fallback for unknown request types
    return await buildHelpResponse(event);
  } catch (error) {
    console.error("Handler Error:", error);
    return buildErrorResponse();
  }
};

// Route intents to appropriate handlers
async function routeIntent(intent: string, event: any) {
  console.log(`Routing intent: ${intent}`);

  switch (intent) {
    // Telemetry Intents
    case "GetTemperatureIntent":
      return await getTemperature(event);

    case "GetHumidityIntent":
      return await getHumidity(event);

    case "GetParkingStatusIntent":
      return await getParkingStatus(event);

    case "GetClimateIntent":
      return await getClimate(event);

    // Daily Summary Intents
    case "GetDailySummaryIntent":
      return await getDailySummary(event);

    // Analytics Intents
    case "GetActivePlayersIntent":
      return await getActivePlayers(event);

    case "GetActiveUsersNowIntent":
      return await getActiveUsersNow(event);

    case "GetUsersTodayIntent":
      return await getUsersToday(event);

    case "GetUsersTodayHourlyIntent":
      return await getUsersTodayHourly(event);

    case "ShowAllDashboardIntent":
      return await getAllDashboard(event);

    // IoT Sensors
    case "ShowIotSensorsIntent":
      return await showIotSensors(event);

    case "EnableNotificationsIntent":
      return await enableNotifications(event);

    case "DisableNotificationsIntent":
      return await disableNotifications(event);

    case "OpenAdminWebsiteIntent":
    case "OpenAdminDashboardIntent":
    case "OpenAdminDashboard":
      return buildOpenAdminDashboardResponse();
    case "OpenWhiteboardIntent":
      return buildOpenWhiteboardResponse();

    // Navigation
    case "AMAZON.HelpIntent":
      return await buildHelpResponse(event);

    case "BackToHomeIntent":
    case "AMAZON.NavigateHomeIntent":
      return await buildWelcomeResponse(event);

    case "AMAZON.StopIntent":
    case "AMAZON.CancelIntent":
      return buildStopResponse();

    default:
      console.warn(`Unknown intent: ${intent}`);
      return await buildHelpResponse(event);
  }
}

// Response builders
const dynamo = new DynamoDBClient({});
const ALEXA_USERS_TABLE = process.env.ALEXA_USERS_TABLE;

async function getNotificationPayload(event: any) {
  const userId = event?.context?.System?.user?.userId;
  if (!userId || !ALEXA_USERS_TABLE) {
    return {
      notificationsEnabled: false,
      notificationsLabel: "Enable Daily Notifications",
      notificationsSubtext: "Get 5 PM Bahrain summaries",
      notificationsAction: "EnableNotificationsIntent",
      notificationsAccent: "#6B7280",
    };
  }

  try {
    const result = await dynamo.send(
      new GetItemCommand({
        TableName: ALEXA_USERS_TABLE,
        Key: { userId: { S: userId } },
      })
    );

    const enabled = result.Item?.notificationsEnabled?.BOOL ?? false;

    return {
      notificationsEnabled: enabled,
      notificationsLabel: enabled
        ? "Disable Daily Notifications"
        : "Enable Daily Notifications",
      notificationsSubtext: enabled
        ? "Daily summaries are on"
        : "Get 5 PM Bahrain summaries",
      notificationsAction: enabled
        ? "DisableNotificationsIntent"
        : "EnableNotificationsIntent",
      notificationsAccent: enabled ? "#10B981" : "#6B7280",
    };
  } catch (error) {
    console.error("Notification lookup error:", error);
    return {
      notificationsEnabled: false,
      notificationsLabel: "Enable Daily Notifications",
      notificationsSubtext: "Get 5 PM Bahrain summaries",
      notificationsAction: "EnableNotificationsIntent",
      notificationsAccent: "#6B7280",
    };
  }
}

async function buildWelcomeResponse(event: any) {
  const notificationPayload = await getNotificationPayload(event);
  return {
    version: "1.0",
    response: {
      shouldEndSession: false,
      outputSpeech: {
        type: "PlainText",
        text: "Hi admin! I'm Peccy, your assistant. What would you like to see?",
      },
      directives: [
        {
          type: "Alexa.Presentation.APL.RenderDocument",
          token: "welcome",
          document: welcomeDashboardDocument,
          datasources: { payload: notificationPayload },
        },
      ],
    },
  };
}

async function buildHelpResponse(event: any) {
  const notificationPayload = await getNotificationPayload(event);
  return {
    version: "1.0",
    response: {
      shouldEndSession: false,
      outputSpeech: {
        type: "PlainText",
        text:
          "You can ask about temperature, humidity, parking, active players, website users, or say show all dashboard. You can also tap buttons on the screen.",
      },
      directives: [
        {
          type: "Alexa.Presentation.APL.RenderDocument",
          token: "welcome",
          document: welcomeDashboardDocument,
          datasources: { payload: notificationPayload },
        },
      ],
    },
  };
}

function buildStopResponse() {
  return {
    version: "1.0",
    response: {
      shouldEndSession: true,
      outputSpeech: {
        type: "PlainText",
        text: "Goodbye! Have a great day!",
      },
    },
  };
}

function buildErrorResponse() {
  return {
    version: "1.0",
    response: {
      shouldEndSession: false,
      outputSpeech: {
        type: "PlainText",
        text: "Sorry, something went wrong. Please try again.",
      },
      directives: [
        {
          type: "Alexa.Presentation.APL.RenderDocument",
          token: "welcome",
          document: welcomeDashboardDocument,
          datasources: { payload: {} },
        },
      ],
    },
  };
}

function buildOpenAdminDashboardResponse() {
  return {
    version: "1.0",
    response: {
      shouldEndSession: true,
      outputSpeech: {
        type: "PlainText",
        text: "Opening BAHTWIN Manager dashboard.",
      },
      directives: [
        {
          type: "Alexa.Presentation.APL.RenderDocument",
          token: "openAdminWebsite",
          document: {
            type: "APL",
            version: "1.4",
            mainTemplate: {
              parameters: ["payload"],
              items: [
                {
                  type: "Container",
                  items: [
                    {
                      type: "Text",
                      text: "Loading BAHTWIN Dashboard...",
                      color: "white",
                      fontSize: "28dp",
                      paddingTop: "30dp",
                      alignSelf: "center",
                    },
                  ],
                  onMount: [
                    {
                      type: "OpenURL",
                      source: "https://d3pah2wsw5ry03.cloudfront.net/dashboard",
                    },
                  ],
                },
              ],
            },
          },
        },
      ],
    },
  };
}

function buildOpenWhiteboardResponse() {
  return {
    version: "1.0",
    response: {
      shouldEndSession: true,
      outputSpeech: {
        type: "PlainText",
        text: "Opening BAHTWIN whiteboard.",
      },
      directives: [
        {
          type: "Alexa.Presentation.APL.RenderDocument",
          token: "openWhiteboard",
          document: {
            type: "APL",
            version: "1.4",
            mainTemplate: {
              parameters: ["payload"],
              items: [
                {
                  type: "Container",
                  items: [
                    {
                      type: "Text",
                      text: "Loading BAHTWIN Whiteboard...",
                      color: "white",
                      fontSize: "28dp",
                      paddingTop: "30dp",
                      alignSelf: "center",
                    },
                  ],
                  onMount: [
                    {
                      type: "OpenURL",
                      source: "https://d3pah2wsw5ry03.cloudfront.net/dashboard/whiteboard",
                    },
                  ],
                },
              ],
            },
          },
        },
      ],
    },
  };
}
