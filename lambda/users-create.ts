import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"
import { CognitoIdentityProviderClient, AdminCreateUserCommand } from "@aws-sdk/client-cognito-identity-provider"
import { isAdmin } from "./utils/auth"
import { createResponse, createErrorResponse } from "./utils/cors"

const client = new CognitoIdentityProviderClient({})

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Check if user is admin
    if (!isAdmin(event)) {
      return createErrorResponse(403, "Access denied. Admin role required.")
    }

    const userData = JSON.parse(event.body || "{}")
    const { email, temporaryPassword } = userData

    if (!email) {
      return createErrorResponse(400, "Email is required");
    }

    // Write input needed to pass to AdminCreateUserCommand (use email as username)
    const input = {
      UserPoolId: process.env.USER_POOL_ID,
      Username: email,
      UserAttributes: [
        { Name: "email", Value: email },
        { Name: "email_verified", Value: "true" }
      ],
      TemporaryPassword: temporaryPassword || "TempPass123!",
      MessageAction: "SUPPRESS" as const
    }

    const command = new AdminCreateUserCommand(input)
    const response = await client.send(command)
    
    return createResponse(201, { 
      message: "User created successfully",
      user: {
        username: response.User?.Username,
        email: email,
        status: response.User?.UserStatus
      }
    })
  } catch (error: any) {
    console.error("Error creating user:", error)
    return createErrorResponse(500, "Failed to create user")
  }
}
