import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"
import { CognitoIdentityProviderClient, AdminUpdateUserAttributesCommand } from "@aws-sdk/client-cognito-identity-provider"
import { isAdmin } from "./utils/auth"
import { createResponse, createErrorResponse } from "./utils/cors"

const client = new CognitoIdentityProviderClient({})

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Check if user is admin
    if (!isAdmin(event)) {
      return createErrorResponse(403, "Access denied. Admin role required.")
    }

    // Get userId from path parameters
    const userId = event.pathParameters?.userId
    if (!userId) {
      return createErrorResponse(400, "User ID is required")
    }

    // Parse request body
    const userData = JSON.parse(event.body || "{}")
    const { email } = userData

    if (!email) {
      return createErrorResponse(400, "Email is required")
    }

    // write input to pass to AdminUpdateUserAttributesCommand
    const input = {
      UserPoolId: process.env.USER_POOL_ID,
      Username: userId,
      UserAttributes: [
        { Name: "email", Value: email },
        { Name: "email_verified", Value: "true" }
      ]
    }

    const command = new AdminUpdateUserAttributesCommand(input)
    await client.send(command)
    
    return createResponse(200, { 
      message: "User updated successfully",
      userId: userId,
      email: email
    })
  } catch (error: any) {
    console.error("Error updating user:", error)
    return createErrorResponse(500, "Failed to update user")
  }
}
