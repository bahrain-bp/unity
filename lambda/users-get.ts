import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"
import { CognitoIdentityProviderClient, ListUsersCommand } from "@aws-sdk/client-cognito-identity-provider"
import { isAdmin } from "./utils/auth"
import { createResponse, createErrorResponse } from "./utils/cors"

const client = new CognitoIdentityProviderClient({})

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {    
    if (!isAdmin(event)) {
      return createErrorResponse(403, "Access denied. Not an Admin.")
    }

    // List all users from Cognito
    const command = new ListUsersCommand({
      UserPoolId: process.env.USER_POOL_ID,
    })
    
    const result = await client.send(command)
    
    return createResponse(200, { users: result.Users || [] })
  } catch (error: any) {
    console.error("Error getting users:", error)
    return createErrorResponse(500, "Failed to get users")
  }
}
