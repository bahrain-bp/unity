import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { isAdmin } from "./utils/auth";
import { jsonResponse } from "./http-response";

const client = new CognitoIdentityProviderClient({});

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return jsonResponse(200, {});
    }

    if (!isAdmin(event)) {
      return jsonResponse(403, {
        message: "Access denied. Not an Admin.",
      });
    }

    const command = new ListUsersCommand({
      UserPoolId: process.env.USER_POOL_ID,
    });

    const result = await client.send(command);

    return jsonResponse(200, {
      users: result.Users || [],
    });
  } catch (error: any) {
    console.error("Error getting users:", error);
    return jsonResponse(500, {
      message: "Failed to get users",
    });
  }
};
