import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as multipart from 'parse-multipart-data';

const s3Client = new S3Client({});
const BUCKET_NAME = process.env.BUCKET_NAME!;
const UPLOAD_DIRECTORY = process.env.UPLOAD_DIRECTORY || 'uploads';
const MAX_FILES = 4;

interface UploadedFile {
  filename: string;
  s3Key: string;
  size: number;
  contentType: string;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Validate request
    if (!event.body) {
      return {
        statusCode: 400,
        headers: getCorsHeaders(),
        body: JSON.stringify({ error: 'No request body' }),
      };
    }

    // Get content type and boundary
    const contentType = event.headers['content-type'] || event.headers['Content-Type'];
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return {
        statusCode: 400,
        headers: getCorsHeaders(),
        body: JSON.stringify({ error: 'Content-Type must be multipart/form-data' }),
      };
    }

    // Extract boundary
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!boundaryMatch) {
      return {
        statusCode: 400,
        headers: getCorsHeaders(),
        body: JSON.stringify({ error: 'No boundary found in Content-Type' }),
      };
    }
    const boundary = boundaryMatch[1] || boundaryMatch[2];

    // Parse multipart data
    const buffer = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8');
    const parts = multipart.parse(buffer, boundary);

    // Filter only file parts (should have filename)
    const files = parts.filter(part => part.filename);

    // Validate number of files
    if (files.length === 0) {
      return {
        statusCode: 400,
        headers: getCorsHeaders(),
        body: JSON.stringify({ error: 'No files provided' }),
      };
    }

    if (files.length > MAX_FILES) {
      return {
        statusCode: 400,
        headers: getCorsHeaders(),
        body: JSON.stringify({ 
          error: `Maximum ${MAX_FILES} files allowed, received ${files.length}` 
        }),
      };
    }

    // Upload files to S3
    const uploadedFiles: UploadedFile[] = [];
    const timestamp = Date.now();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filename = file.filename || `file_${i}`;
      const sanitizedFilename = sanitizeFilename(filename);
      const s3Key = `${UPLOAD_DIRECTORY}/${timestamp}_${sanitizedFilename}`;

      // Upload to S3
      const uploadCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: file.data,
        ContentType: file.type || 'application/octet-stream',
      });

      await s3Client.send(uploadCommand);

      uploadedFiles.push({
        filename: sanitizedFilename,
        s3Key: s3Key,
        size: file.data.length,
        contentType: file.type || 'application/octet-stream',
      });
    }

    // Return success response
    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        message: 'Files uploaded successfully',
        files: uploadedFiles,
        count: uploadedFiles.length,
      }),
    };

  } catch (error) {
    console.error('Error uploading files:', error);
    return {
      statusCode: 500,
      headers: getCorsHeaders(),
      body: JSON.stringify({ 
        error: 'Failed to upload files',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};

function sanitizeFilename(filename: string): string {
  // Remove any path components and dangerous characters
  return filename
    .replace(/^.*[\\\/]/, '') // Remove path
    .replace(/[^a-zA-Z0-9._-]/g, '_'); // Replace special chars
}

function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*', // Restrict this in production
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Content-Type': 'application/json',
  };
}