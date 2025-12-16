import {
  DynamoDBClient,
  ScanCommand,
  DeleteItemCommand,
} from "@aws-sdk/client-dynamodb";
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";

const dynamo = new DynamoDBClient({});

export async function broadcastActiveUsers(
  tableName: string,
  wsEndpoint: string
) {
  try {
    //  Scan all connections
    const scan = await dynamo.send(
      new ScanCommand({ TableName: tableName })
    );

    const items = scan.Items ?? [];

    //  Separate roles
    const visitorCount = items.filter(
      (i) => i.role?.S === "visitor"
    ).length;

    const adminConnections = items
      .filter((i) => i.role?.S === "admin" && i.connectionId?.S)
      .map((i) => i.connectionId.S!);

    console.log(
      `Visitors: ${visitorCount}, Admin connections: ${adminConnections.length}`
    );

    //  Management API (MUST be https)
    const api = new ApiGatewayManagementApiClient({
      endpoint: wsEndpoint
        .replace("wss://", "https://")
        .replace("ws://", "http://"),
    });

    //  Message sent to admins
    const message = JSON.stringify({
      type: "ACTIVE_USERS",
      value: visitorCount,
      timestamp: Date.now(),
    });

    const staleConnections: string[] = [];

    //  Send ONLY to admins
    for (const connectionId of adminConnections) {
      try {
        await api.send(
          new PostToConnectionCommand({
            ConnectionId: connectionId,
            Data: Buffer.from(message),
          })
        );
        console.log(`Message sent to admin ${connectionId}`);
      } catch (error: any) {
        console.log(
          `Failed to send to admin ${connectionId}:`,
          error.message
        );

        // 410 = stale connection
        if (error.statusCode === 410) {
          staleConnections.push(connectionId);
        }
      }
    }

    //  Cleanup stale connections
    if (staleConnections.length > 0) {
      console.log(`Cleaning up ${staleConnections.length} stale connections`);

      for (const connectionId of staleConnections) {
        try {
          await dynamo.send(
            new DeleteItemCommand({
              TableName: tableName,
              Key: { connectionId: { S: connectionId } },
            })
          );
        } catch (error) {
          console.error(
            `Failed to delete stale connection ${connectionId}:`,
            error
          );
        }
      }
    }
  } catch (error) {
    console.error("Error broadcasting active users:", error);
    throw error;
  }
}
