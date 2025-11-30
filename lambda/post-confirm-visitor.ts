import {
  CognitoUserPoolTriggerEvent,
  Context,
  Callback,
} from "aws-lambda";
import {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const client = new CognitoIdentityProviderClient({});
const DEFAULT_GROUP = "visitor";

export const handler = async (
  event: CognitoUserPoolTriggerEvent,
  _context: Context,
  callback: Callback
) => {
  try {
    const username = event.userName;     // user
    const poolId = event.userPoolId;     // comes from trigger event

    await client.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: poolId,
        Username: username,
        GroupName: DEFAULT_GROUP,
      })
    );

    callback(null, event);
  } catch (err) {
    console.error("Error adding user to visitor group:", err);
    // Don't block confirmation even if this fails:
    callback(null, event);
  }
};
