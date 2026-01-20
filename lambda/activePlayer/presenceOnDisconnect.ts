import { DynamoDBClient, DeleteItemCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({});

export const handler = async (event: any) => {
  const connectionId = event.requestContext.connectionId;

  await client.send(
    new DeleteItemCommand({
      TableName: process.env.ACTIVE_CONNECTIONS_TABLE!,
      Key: {
        connectionId: { S: connectionId },
      },
    })
  );

  return { statusCode: 200 };
};
