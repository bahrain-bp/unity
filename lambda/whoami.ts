import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

/**
 * Decode a JWT without verification (for demo only).
 * In production: verify signature with jwks.
 */
function decodeJwt(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = Buffer.from(parts[1], "base64").toString("utf8");
    return JSON.parse(payload);
  } catch (err) {
    return null;
  }
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const authHeader =
    event.headers?.Authorization || event.headers?.authorization;

  // No token - unauthenticated
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "hi ur not authenticated",
      }),
    };
  }

  const token = authHeader.substring("Bearer ".length);
  const payload = decodeJwt(token);

  if (!payload) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "hi ur not authenticated (invalid token)",
      }),
    };
  }

  // Cognito groups come from the ID token claim: cognito:groups
  const rawGroups = payload["cognito:groups"];
  const groups: string[] = Array.isArray(rawGroups)
    ? rawGroups
    : typeof rawGroups === "string"
    ? rawGroups.split(",")
    : [];

  // Build message depending on role
  let message = "hi ur authenticated but have no role";

  if (groups.includes("admin")) message = "hi ur admin";
  else if (groups.includes("newhire")) message = "hi ur newhire";
  else if (groups.includes("visitor")) message = "hi ur visitor";

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      groups,
    }),
  };
};
