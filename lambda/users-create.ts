import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
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

    // ✅ Safe JSON parsing
    let userData: any = {};
    try {
      userData = event.body ? JSON.parse(event.body) : {};
    } catch {
      return jsonResponse(400, { message: "Invalid JSON body" });
    }

    const { email, temporaryPassword } = userData;

    if (!email) {
      return jsonResponse(400, { message: "Email is required" });
    }

    // ✅ Create user (email as username)
    const input = {
      UserPoolId: process.env.USER_POOL_ID,
      Username: email,
      UserAttributes: [
        { Name: "email", Value: String(email) },
        { Name: "email_verified", Value: "true" },
      ],
      TemporaryPassword: temporaryPassword || "TempPass123!",
      MessageAction: "SUPPRESS" as const,
    };

    const command = new AdminCreateUserCommand(input);
    const response = await client.send(command);

    return jsonResponse(201, {
      message: "User created successfully",
      user: {
        username: response.User?.Username,
        email,
        status: response.User?.UserStatus,
      },
    });
  } catch (error: any) {
    console.error("Error creating user:", error);
    return jsonResponse(500, {
      message: "Failed to create user",
    });
  }
};
