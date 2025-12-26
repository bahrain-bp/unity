import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"
import { CognitoIdentityProviderClient, AdminDeleteUserCommand } from "@aws-sdk/client-cognito-identity-provider"
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

    // Create input for AdminDeleteUserCommand
    const input = {
      UserPoolId: process.env.USER_POOL_ID,
      Username: userId  // This will be the email since we use email as username
    }

    const command = new AdminDeleteUserCommand(input)
    await client.send(command)
    
    return createResponse(200, { 
      message: "User deleted successfully",
      userId: userId
    })
  } catch (error: any) {
    console.error("Error deleting user:", error)
    return createErrorResponse(500, "Failed to delete user")
  }
}
