import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({ region: process.env.AWS_REGION });

export const handler = async (event: any) => {
  try {
    const userId = event.queryStringParameters?.userId;

    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Missing userId" }),
      };
    }

    // SAME PATH YOU USED FOR UPLOAD
     const fileKey = `visitor-images/${userId}.jpg`;

    const command = new GetObjectCommand({
      Bucket: process.env.BUCKET_NAME!,
      Key: fileKey,
    });

    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        imageUrl: signedUrl,
        fileKey,
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
