import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE = process.env.WS_CONNECTIONS_TABLE!;
const MANAGEMENT_ENDPOINT = process.env.WS_MANAGEMENT_ENDPOINT!;

const mgmt = new ApiGatewayManagementApiClient({
  endpoint: MANAGEMENT_ENDPOINT,
});

export async function broadcastToAll(message: any) {
  const payload = typeof message === "string" ? message : JSON.stringify(message);

  const scanRes = await ddb.send(
    new ScanCommand({
      TableName: TABLE,
      ProjectionExpression: "connectionId",
    })
  );

  const items = scanRes.Items || [];

  const promises = items.map(async (item) => {
    const connectionId = item.connectionId as string;
    try {
      await mgmt.send(
        new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: Buffer.from(payload),
        })
      );
    } catch (err: any) {
      // If connection is stale, you can delete it here
      if (err.statusCode === 410) {
        console.log("Stale connection, deleting:", connectionId);
        // optional: delete from DDB
      } else {
        console.error("Failed to send to", connectionId, err);
      }
    }
  });

  await Promise.all(promises);
}
