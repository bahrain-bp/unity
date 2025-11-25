import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const TABLE = process.env.TELEMETRY_TABLE || "PiTelemetry";

/**
 * GET /telemetry?device=pi3-01&limit=25
 * Returns newest -> oldest items.
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const qs = event.queryStringParameters ?? {};
    const device = (qs.device ?? "pi3-01").toString();
    const limitRaw = Number(qs.limit ?? 25);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 25;

    const cmd = new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "#d = :dev",
      ExpressionAttributeNames: { "#d": "device" },
      ExpressionAttributeValues: { ":dev": device },
      ScanIndexForward: false, // newest first
      Limit: limit,
    });

    const { Items = [] } = await ddb.send(cmd);

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ device, count: Items.length, items: Items }),
    };
  } catch (err: any) {
    console.error("telemetry-get error:", err);
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: "Failed to query telemetry", details: String(err?.message ?? err) }),
    };
  }
};
