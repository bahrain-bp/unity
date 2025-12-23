import { DynamoDBClient, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { broadcastActiveUsers } from "./broadcastActiveUsers";

const client = new DynamoDBClient({});

export const handler = async (event: any) => {
  const connectionId = event.requestContext.connectionId;
  
  console.log(`Disconnection: ${connectionId}`);

  try {
    // Remove connection from DynamoDB
    await client.send(
      new DeleteItemCommand({
        TableName: process.env.ACTIVE_CONNECTIONS_TABLE!,
        Key: { connectionId: { S: connectionId } },
      })
    );

    console.log(`Connection ${connectionId} removed from DynamoDB`);

    // Broadcast updated count to remaining connected clients
    await broadcastActiveUsers(
      process.env.ACTIVE_CONNECTIONS_TABLE!,
      process.env.WS_ENDPOINT!
    );

    return { statusCode: 200, body: "Disconnected" };
  } catch (error) {
    console.error("Error in onDisconnect:", error);
    return { statusCode: 500, body: "Failed to disconnect" };
  }
};