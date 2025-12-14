import {
  DynamoDBClient,
  GetItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import {
  S3Client,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const dynamo = new DynamoDBClient({});
const s3 = new S3Client({});

export const handler = async (event: any) => {
  try {
const body =
  event.body && event.body !== "null"
    ? JSON.parse(event.body)
    : {};
    const { userId, passedRegistration } = body;

    if (!userId) {
return {
  statusCode: 400,
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ message: "Missing userId" }),
};

    }

    //  If passedRegistration is provided → UPDATE
    if (typeof passedRegistration === "boolean") {
      await dynamo.send(
        new UpdateItemCommand({
          TableName: process.env.USER_TABLE!,
          Key: {
            userId: { S: userId },
          },
            UpdateExpression: "SET passedRegistration = :p, updatedAt = :u",
            ExpressionAttributeValues: {
            ":p": { BOOL: passedRegistration },
            ":u": { S: new Date().toISOString() },
            },

          ConditionExpression: "attribute_exists(userId)",
        })
      );
    }

    // READ updated user
    const result = await dynamo.send(
      new GetItemCommand({
        TableName: process.env.USER_TABLE!,
        Key: {
          userId: { S: userId },
        },
        ConsistentRead: true,
      })
    );

    if (!result.Item) {
      return {
        statusCode: 404,
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  },
        body: JSON.stringify({ message: "User not found" }),
      };
    }

    const userName = result.Item.name?.S ?? "";
    const s3Key = result.Item.s3Key?.S;
    const finalPassedRegistration =
      result.Item.passedRegistration?.BOOL ?? false;

    if (!s3Key) {
      return {
        statusCode: 404,
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  },
        body: JSON.stringify({ message: "Image not found" }),
      };
    }

    //  Generate presigned URL
    const command = new GetObjectCommand({
      Bucket: process.env.BUCKET_NAME!,
      Key: s3Key,
    });

    const imageUrl = await getSignedUrl(s3, command, {
      expiresIn: 300,
    });

    // Return badge info
    return {
      statusCode: 200,
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  },
      body: JSON.stringify({
        userId,
        userName,
        imageUrl,
        passedRegistration: finalPassedRegistration,
      }),
    };
  } catch (error) {
    console.error("GetUserBadgeInfo error", error);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
