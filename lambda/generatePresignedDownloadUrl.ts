import {
  DynamoDBClient,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";
import {
  S3Client,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({});
const dynamo = new DynamoDBClient({});

export const handler = async (event: any) => {
  try {
    console.log("get-image-url request", {
      userId: event.queryStringParameters?.userId,
      table: process.env.USER_TABLE,
    });
    const userId = event.queryStringParameters?.userId?.trim();


    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Missing userId" }),
      };
    }

    // Get user record from DynamoDB
    const result = await dynamo.send(
      new GetItemCommand({
        TableName: process.env.USER_TABLE!,
        Key: {
          userId: { S: userId },
        },
        ConsistentRead: true,
      })
    );

    console.log("get-image-url dynamo response", result);

    if (!result.Item || !result.Item.s3Key) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Image not found" }),
      };
    }

    const s3Key = result.Item.s3Key.S!;

    // Generate presigned GET URL
    const command = new GetObjectCommand({
      Bucket: process.env.BUCKET_NAME!,
      Key: s3Key,
    });

    const signedUrl = await getSignedUrl(s3, command, {
      expiresIn: 300, // 5 minutes
    });

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        imageUrl: signedUrl,
        s3Key,
      }),
    };
  } catch (error) {
    console.error("Error generating GET URL:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};