import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  CognitoIdentityProviderClient,
  AdminDeleteUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { isAdmin } from "./utils/auth";
import { jsonResponse } from "./http-response";

const client = new CognitoIdentityProviderClient({});

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // ✅ Handle CORS preflight
    if (event.httpMethod === "OPTIONS") {
      return jsonResponse(200, {});
    }

    // ✅ Admin check
    if (!isAdmin(event)) {
      return jsonResponse(403, {
        message: "Access denied. Admin role required.",
      });
    }

    // ✅ Get userId from path parameters
    const userId = event.pathParameters?.userId;
    if (!userId) {
      return jsonResponse(400, { message: "User ID is required" });
    }

    const input = {
      UserPoolId: process.env.USER_POOL_ID,
      Username: userId, // email if you use email as username
    };

    const command = new AdminDeleteUserCommand(input);
    await client.send(command);

    return jsonResponse(200, {
      message: "User deleted successfully",
      userId,
    });
  } catch (error: any) {
    console.error("Error deleting user:", error);
    return jsonResponse(500, { message: "Failed to delete user" });
  }
};
