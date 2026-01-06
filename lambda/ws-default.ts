import { APIGatewayProxyWebsocketEventV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const PLUG_ACTIONS_TABLE = process.env.PLUG_ACTIONS_TABLE!;
const PLUG_INDEX_NAME = process.env.PLUG_INDEX_NAME || "plug_id-ts-index";

const PLUG_IDS: string[] = (() => {
  try {
    return JSON.parse(process.env.PLUG_IDS || "[]");
  } catch {
    return [];
  }
})();

export const handler = async (event: APIGatewayProxyWebsocketEventV2) => {
  const connectionId = event.requestContext.connectionId!;
  const body = event.body ? JSON.parse(event.body) : {};
  const nowSeconds = Math.floor(Date.now() / 1000);

  // Only react to hello / snapshot request
  if (body?.action !== "hello" || !body?.requestSnapshot) {
    return { statusCode: 200 };
  }

  const plugIds = PLUG_IDS.length ? PLUG_IDS : ["plug1", "plug2"];

  // Build snapshot
  const plugs = await Promise.all(
    plugIds.map(async (plugId) => {
      const res = await ddb.send(
        new QueryCommand({
          TableName: PLUG_ACTIONS_TABLE,
          IndexName: PLUG_INDEX_NAME,
          KeyConditionExpression: "plug_id = :p",
          ExpressionAttributeValues: {
            ":p": plugId,
          },
          Limit: 1,
          ScanIndexForward: false,
        })
      );

      const item: any = res.Items?.[0];

      return {
        id: plugId,
        type: "plug",
        state: item?.action ?? "off", // default off if never used
        updated_at: item?.ts ?? 0,
      };
    })
  );

  const mgmt = new ApiGatewayManagementApiClient({
    endpoint: `https://${event.requestContext.domainName}/${event.requestContext.stage}`,
  });

  await mgmt.send(
    new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: Buffer.from(
        JSON.stringify({
          type: "plug_snapshot",
          ts: nowSeconds,
          payload: { plugs },
        })
      ),
    })
  );

  return { statusCode: 200 };
};
