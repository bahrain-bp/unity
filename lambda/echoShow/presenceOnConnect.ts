import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { broadcastActiveUsers } from "./broadcastActiveUsers";

const client = new DynamoDBClient({});


export const handler = async (event: any) => {
  const connectionId = event.requestContext.connectionId;
const role = event.queryStringParameters?.role ?? "visitor";
  
  console.log(`New connection: ${connectionId}`);

  try {
    // Store connection in DynamoDB
const now = Math.floor(Date.now() / 1000);
const ttl = now + 60 * 5; // 5 minutes

await client.send(
  new PutItemCommand({
    TableName: process.env.ACTIVE_CONNECTIONS_TABLE!,
    Item: {
      connectionId: { S: connectionId },
      role: { S: role },
      timestamp: { N: Date.now().toString() },
      ttl: { N: ttl.toString() },
    },
  })
);


    console.log(`Connection ${connectionId} stored in DynamoDB`);

    // Broadcast updated count to all connected clients
    await broadcastActiveUsers(
      process.env.ACTIVE_CONNECTIONS_TABLE!,
      process.env.WS_ENDPOINT!
    );

    return { statusCode: 200, body: "Connected" };
  } catch (error) {
    console.error("Error in onConnect:", error);
    return { statusCode: 500, body: "Failed to connect" };
  }
};