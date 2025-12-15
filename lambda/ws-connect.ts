import { APIGatewayProxyWebsocketEventV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.CONNECTIONS_TABLE!;

export const handler = async (event: APIGatewayProxyWebsocketEventV2) => {
  const connectionId = event.requestContext.connectionId!;
  const now = Date.now();

  // later you can extract userId from Cognito JWT / query string if needed
  const item = {
    connectionId,
    createdAt: now,
  };

  await ddb.send(new PutCommand({
    TableName: TABLE,
    Item: item,
  }));

  return { statusCode: 200, body: "Connected." };
};
