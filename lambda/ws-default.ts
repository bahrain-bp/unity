import { APIGatewayProxyWebsocketEventV2 } from "aws-lambda";

export const handler = async (event: APIGatewayProxyWebsocketEventV2) => {
  console.log("Default WS message:", event.body);
  return { statusCode: 200, body: "ok" };
};
