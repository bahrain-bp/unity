import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  CognitoIdentityProviderClient,
  AdminUpdateUserAttributesCommand,
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

    // ✅ userId from path
    const userId = event.pathParameters?.userId;
    if (!userId) {
      return jsonResponse(400, { message: "User ID is required" });
    }

    // ✅ Parse body safely
    let userData: any = {};
    try {
      userData = event.body ? JSON.parse(event.body) : {};
    } catch {
      return jsonResponse(400, { message: "Invalid JSON body" });
    }

    const email = userData?.email;
    if (!email) {
      return jsonResponse(400, { message: "Email is required" });
    }

    const input = {
      UserPoolId: process.env.USER_POOL_ID,
      Username: userId,
      UserAttributes: [
        { Name: "email", Value: String(email) },
        { Name: "email_verified", Value: "true" },
      ],
    };

    const command = new AdminUpdateUserAttributesCommand(input);
    await client.send(command);

    return jsonResponse(200, {
      message: "User updated successfully",
      userId,
      email,
    });
  } catch (error: any) {
    console.error("Error updating user:", error);
    return jsonResponse(500, { message: "Failed to update user" });
  }
};
