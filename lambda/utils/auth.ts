import { APIGatewayProxyEvent } from "aws-lambda"

export const isAdmin = (event: APIGatewayProxyEvent): boolean => {
  const userGroups = event.requestContext.authorizer?.claims?.["cognito:groups"]

  if (!userGroups) return false

  const groups = Array.isArray(userGroups)
    ? userGroups
    : String(userGroups).split(",")

  return groups.includes("admin")
}
