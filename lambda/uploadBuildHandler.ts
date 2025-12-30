// uploadBuildHandler.ts

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  CloudFrontClient,
  CreateInvalidationCommand,
} from '@aws-sdk/client-cloudfront';

const s3Client = new S3Client({});
const cfClient = new CloudFrontClient({});

const BUCKET_NAME = process.env.BUCKET_NAME!;
const UPLOAD_DIRECTORY = process.env.UPLOAD_DIRECTORY || 'unity';
const MAX_FILES = parseInt(process.env.MAX_FILES || '4');
const URL_EXPIRATION = parseInt(process.env.URL_EXPIRATION_SECONDS || '3600');
const DISTRIBUTION_ID = process.env.CLOUDFRONT_DISTRIBUTION_ID!;

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    if (!event.body) return errorResponse(400, 'Missing body');

    const body = JSON.parse(event.body);
    const files = body.files;

    if (!Array.isArray(files) || files.length === 0) {
      return errorResponse(400, 'files[] is required and cannot be empty');
    }

    if (files.length > MAX_FILES) {
      return errorResponse(400, `Max ${MAX_FILES} files allowed`);
    }

    const timestamp = Date.now();
    const results = [];

    // Generate presigned URLs (no file upload here)
    for (const f of files) {
      if (!f.filename) {
        return errorResponse(400, 'Each file must have a filename');
      }

      const sanitized = sanitize(f.filename);
      const key = `${UPLOAD_DIRECTORY}/${sanitized}`;

      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        ContentType: f.contentType || 'application/octet-stream',
        Metadata: {
          original: f.filename,
          uploaded: timestamp.toString(),
        },
      });

      const uploadUrl = await getSignedUrl(s3Client, command, {
        expiresIn: URL_EXPIRATION,
      });

      results.push({
        filename: sanitized,
        key,
        uploadUrl,
        method: 'PUT',
        headers: {
          'Content-Type': f.contentType || 'application/octet-stream',
        },
      });
    }

    // 🚀 NEW: CloudFront Invalidation
    if (DISTRIBUTION_ID) {
      try {
        await invalidateCloudFront(DISTRIBUTION_ID);
        console.log('CloudFront invalidation triggered');
      } catch (err) {
        console.error('Failed to invalidate CloudFront:', err);
      }
    } else {
      console.warn('CLOUDFRONT_DISTRIBUTION_ID not provided, skipping invalidation');
    }

    return successResponse({
      urls: results,
      expiresIn: URL_EXPIRATION,
      invalidation: true,
    });
  } catch (e: any) {
    return errorResponse(500, e.message || 'Internal error');
  }
};

// --- Helpers --------------------------------------------------

const invalidateCloudFront = async (distributionId: string) => {
  const command = new CreateInvalidationCommand({
    DistributionId: distributionId,
    InvalidationBatch: {
      CallerReference: Date.now().toString(),
      Paths: {
        Quantity: 1,
        Items: ['/unity/*'], // invalidate everything in /unity/
      },
    },
  });

  return cfClient.send(command);
};

const sanitize = (name: string) =>
  name.replace(/^.*[\\\/]/, '').replace(/[^a-zA-Z0-9._-]/g, '_');

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const successResponse = (body: any) => ({
  statusCode: 200,
  headers: cors,
  body: JSON.stringify(body),
});

const errorResponse = (status: number, msg: string) => ({
  statusCode: status,
  headers: cors,
  body: JSON.stringify({ error: msg }),
});
