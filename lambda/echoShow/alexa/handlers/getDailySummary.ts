// lambda/echoShow/alexa/handlers/getDailySummary.ts

import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { dailySummaryDocument } from "../apl/daily-summary-apl-document";

const dynamo = new DynamoDBClient({});
const SUMMARIES_TABLE = process.env.SUMMARIES_TABLE!;

// Helper to format Bahrain date
function formatBahrainDate(offset: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const bahrainDate = new Date(d.getTime() + 3 * 60 * 60 * 1000); // UTC+3
  return bahrainDate.toISOString().split("T")[0];
}

export async function getDailySummary(event: any) {
  try {
    const today = formatBahrainDate(0);
    const now = new Date();
    const bahrainNow = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const bahrainHour = bahrainNow.getUTCHours();
    const summaryDateLabel = bahrainNow.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    const result = await dynamo.send(
      new QueryCommand({
        TableName: SUMMARIES_TABLE,
        KeyConditionExpression: "#date = :date",
        ExpressionAttributeNames: { "#date": "date" },
        ExpressionAttributeValues: { ":date": { S: today } },
        ScanIndexForward: false,
        Limit: 1,
      })
    );

    let summary =
      bahrainHour < 17
        ? "Daily summary will be generated at 5:00 PM Bahrain time."
        : "No activity recorded today.";

    if (result.Items && result.Items.length > 0) {
      summary = result.Items[0].aiSummary.S!;
    }

    return {
      version: "1.0",
      response: {
        shouldEndSession: false,
        outputSpeech: {
          type: "PlainText",
          text: summary,
        },
        directives: [
          {
            type: "Alexa.Presentation.APL.RenderDocument",
            token: "dailySummary",
            document: dailySummaryDocument,
            datasources: {
              data: {
                date: today,
                summaryDateLabel,
                summary: summary
              },
            },
          },
        ],
      },
    };
  } catch (error) {
    console.error("Error fetching summary:", error);
    return {
      version: "1.0",
      response: {
        shouldEndSession: false,
        outputSpeech: {
          type: "PlainText",
          text: "Sorry, I couldn't fetch the daily summary right now.",
        },
      },
    };
  }
}
