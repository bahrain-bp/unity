import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
  AdminListGroupsForUserCommand,
  AdminRemoveUserFromGroupCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const client = new CognitoIdentityProviderClient({});

const USER_POOL_ID = process.env.USER_POOL_ID!;
const ALLOWED_ROLES = ["newhire", "visitor"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

interface BodyShape {
  requestedRole?: string;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // 1) Get user from Cognito authorizer
    const claims = event.requestContext.authorizer?.claims as any;
    const username = claims?.sub; // Cognito username/subject

    if (!username) {
      return {
        statusCode: 401,
        body: JSON.stringify({ message: "Not authenticated" }),
      };
    }

    // 2) Read requestedRole from JSON body
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Missing body" }),
      };
    }

    let parsed: BodyShape;
    try {
      parsed = JSON.parse(event.body);
    } catch {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Invalid JSON body" }),
      };
    }

    const requestedRole = parsed.requestedRole as string | undefined;

    if (!requestedRole || !ALLOWED_ROLES.includes(requestedRole as AllowedRole)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "requestedRole must be 'newhire' or 'visitor'",
        }),
      };
    }

    // 3) Remove user from any existing newhire/visitor group
    const groupsResp = await client.send(
      new AdminListGroupsForUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: username,
      })
    );

    const currentGroups = (groupsResp.Groups || []).map((g) => g.GroupName);

    for (const gName of currentGroups) {
      if (gName && ALLOWED_ROLES.includes(gName as AllowedRole)) {
        await client.send(
          new AdminRemoveUserFromGroupCommand({
            UserPoolId: USER_POOL_ID,
            Username: username,
            GroupName: gName,
          })
        );
      }
    }

    // 4) Add user to the requested group
    await client.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: USER_POOL_ID,
        Username: username,
        GroupName: requestedRole,
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Role updated to ${requestedRole}`,
      }),
    };
  } catch (err: any) {
    console.error("Error in set-role:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal error",
        error: err?.message,
      }),
    };
  }
};
