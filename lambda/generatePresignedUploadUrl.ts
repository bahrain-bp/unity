import { S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { v4 as uuidv4 } from "uuid";

// AWS S3 client
const s3 = new S3Client({ region: process.env.AWS_REGION });

// Allowed file types and max size
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/jpg"];
const MAX_FILE_SIZE_MB = 5;

export const handler = async (event: any) => {
  try {
    // Parse incoming request
    const body = JSON.parse(event.body || "{}");
    const fileType = body.fileType;

    // Validate file type
    if (!fileType || !ALLOWED_IMAGE_TYPES.includes(fileType)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Invalid or unsupported file type" }),
      };
    }

    // Generate temporary session ID & file key
    const sessionId = uuidv4();
    const fileId = uuidv4();
    const fileExtension = fileType.split("/")[1].replace(/\+.*$/, "");
    const fileKey = `temp/registration/${sessionId}/${fileId}.${fileExtension}`;

    // Create presigned POST
    const presignedPost = await createPresignedPost(s3, {
      Bucket: process.env.BUCKET_NAME!,
      Key: fileKey,
      Fields: {
        "Content-Type": fileType,
      },
      Conditions: [
        ["content-length-range", 0, MAX_FILE_SIZE_MB * 1024 * 1024],
        ["starts-with", "$Content-Type", fileType],
      ],
      Expires: 3600, // 60 minutes
    });

    // Return response to frontend
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*", // restrict in production
      },
      body: JSON.stringify({
        url: presignedPost.url,
        fields: presignedPost.fields,
        sessionId,
        fileKey,
        expiresIn: 300,
        maxFileSizeMB: MAX_FILE_SIZE_MB,
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