import { S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";

// AWS S3 client
const s3 = new S3Client({ region: process.env.AWS_REGION });

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/jpg"];
const MAX_FILE_SIZE_MB = 5;

export const handler = async (event: any) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const fileType = body.fileType;
    const userId = body.userId; 

    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Missing userId parameter" }),
      };
    }

    if (!fileType || !ALLOWED_IMAGE_TYPES.includes(fileType)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Invalid or unsupported file type" }),
      };
    }

    // Extract extension
    const fileExtension = fileType.split("/")[1].replace(/\+.*$/, "");

    // FINAL STANDARDIZED STORAGE PATH
const fileKey = `visitor-images/${userId}/profile.${fileExtension}`;

    const presignedPost = await createPresignedPost(s3, {
      Bucket: process.env.BUCKET_NAME!,
      Key: fileKey,
      Fields: { "Content-Type": fileType },
      Conditions: [
        ["content-length-range", 0, MAX_FILE_SIZE_MB * 1024 * 1024],
        ["starts-with", "$Content-Type", fileType],
      ],
      Expires: 300, // 5 minutes
    });

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        url: presignedPost.url,
        fields: presignedPost.fields,
        fileKey,
        userId,
        expiresIn: 300,
      }),
    };
  } catch (error) {
    console.error("Error generating presigned POST URL:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
