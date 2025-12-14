import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);
const tableName = process.env.TELEMETRY_TABLE!;

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const device = event.queryStringParameters?.device;
  const limitStr = event.queryStringParameters?.limit;
  const limit = limitStr ? parseInt(limitStr, 10) : 25;

  if (!device) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Missing ?device=..." }),
    };
  }

  const cmd = new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: "#d = :device",
    ExpressionAttributeNames: { "#d": "device" },
    ExpressionAttributeValues: { ":device": device },
    ScanIndexForward: false, // newest first
    Limit: limit,
  });

  const result = await ddb.send(cmd);

  return {
    statusCode: 200,
    body: JSON.stringify({
      device,
      count: result.Count,
      items: result.Items ?? [],
    }),
    headers: { "Content-Type": "application/json" },
  };
};
