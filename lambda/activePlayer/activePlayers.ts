import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { dashboardDocument } from "../echoShow/alexa/apl/dashboard-apl-document";

const dynamo = new DynamoDBClient({});

function buildContextMessage(count: number) {
  if (count === 0) return "No one in the office right now";
  if (count <= 3) return "Light activity in the office";
  if (count <= 8) return "Moderate office presence";
  return "Busy office environment";
}

export async function getActivePlayers(event: any) {
  try {
    const result = await dynamo.send(
      new ScanCommand({
        TableName: process.env.ACTIVE_CONNECTIONS_TABLE!,
      })
    );

    const count = result.Items?.filter((i) => i.role?.S === "visitor").length ?? 0;
    const message = buildContextMessage(count);

    return {
      version: "1.0",
      response: {
        shouldEndSession: false,
        outputSpeech: {
          type: "PlainText",
          text: `There are currently ${count} active players. ${message}`,
        },
        directives: [
          {
            type: "Alexa.Presentation.APL.RenderDocument",
            token: "activePlayers",
            document: dashboardDocument,
            datasources: {
              data: {
                title: "Active Players",
                description: "People currently in the office",
                value: count,
                message,
                showValue: true,
                iconSource: "gamepadIcon",  // ← SVG icon reference
                accentColor: "#FF8E3C"
              },
            },
          },
        ],
      },
    };
  } catch (error) {
    console.error("Error fetching active players:", error);
    return {
      version: "1.0",
      response: {
        shouldEndSession: false,
        outputSpeech: {
          type: "PlainText",
          text: "Sorry, I couldn't fetch the active players data right now.",
        },
      },
    };
  }
}
