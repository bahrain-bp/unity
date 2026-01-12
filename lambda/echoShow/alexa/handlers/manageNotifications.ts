import {
  DynamoDBClient,
  PutItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";

const dynamo = new DynamoDBClient({});

function getUserId(event: any) {
  return event?.context?.System?.user?.userId;
}

function getLocale(event: any) {
  return event?.request?.locale ?? "en-US";
}

export async function enableNotifications(event: any) {
  const userId = getUserId(event);
  const locale = getLocale(event);

  if (!userId || !process.env.ALEXA_USERS_TABLE) {
    return buildError("Notifications could not be enabled right now.");
  }

  await dynamo.send(
    new PutItemCommand({
      TableName: process.env.ALEXA_USERS_TABLE,
      Item: {
        userId: { S: userId },
        notificationsEnabled: { BOOL: true },
        locale: { S: locale },
        updatedAt: { S: new Date().toISOString() },
      },
    })
  );

  return buildSuccess(
    "Notifications enabled. You will receive daily summaries at 5 PM Bahrain time."
  );
}

export async function disableNotifications(event: any) {
  const userId = getUserId(event);

  if (!userId || !process.env.ALEXA_USERS_TABLE) {
    return buildError("Notifications could not be disabled right now.");
  }

  await dynamo.send(
    new UpdateItemCommand({
      TableName: process.env.ALEXA_USERS_TABLE,
      Key: { userId: { S: userId } },
      UpdateExpression: "SET notificationsEnabled = :disabled, updatedAt = :ts",
      ExpressionAttributeValues: {
        ":disabled": { BOOL: false },
        ":ts": { S: new Date().toISOString() },
      },
    })
  );

  return buildSuccess("Notifications disabled. You can ask for summaries anytime.");
}

function buildSuccess(text: string) {
  return {
    version: "1.0",
    response: {
      shouldEndSession: false,
      outputSpeech: {
        type: "PlainText",
        text,
      },
    },
  };
}

function buildError(text: string) {
  return {
    version: "1.0",
    response: {
      shouldEndSession: false,
      outputSpeech: {
        type: "PlainText",
        text,
      },
    },
  };
}
