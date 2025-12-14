import { APIGatewayProxyWebsocketEventV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.CONNECTIONS_TABLE!;

export const handler = async (event: APIGatewayProxyWebsocketEventV2) => {
  const connectionId = event.requestContext.connectionId!;

  await ddb.send(
    new DeleteCommand({
      TableName: TABLE,
      Key: { connectionId },
    })
  );

  return { statusCode: 200, body: "Disconnected." };
};
