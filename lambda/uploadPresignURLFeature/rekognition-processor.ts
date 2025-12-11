import { RekognitionClient, DetectFacesCommand, DetectModerationLabelsCommand } from "@aws-sdk/client-rekognition";
import { S3Client } from "@aws-sdk/client-s3";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

const rekognition = new RekognitionClient({ region: process.env.AWS_REGION });
const s3 = new S3Client({ region: process.env.AWS_REGION });
const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION });

export const handler = async (event: any) => {
  console.log("Rekognition triggered for new image");
  
  try {
    // Get uploaded file info
    const record = event.Records[0];
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    
    // Only process registration images
    if (!key.startsWith('temp/registration/')) {
      console.log("Skipping non-registration file:", key);
      return;
    }
    
    // Extract session ID
    const pathParts = key.split('/');
    const sessionId = pathParts[2];
    
    console.log(`Analyzing image for session: ${sessionId}`);
    
    // 1. DETECT FACES
    const faceResult = await rekognition.send(new DetectFacesCommand({
      Image: { S3Object: { Bucket: bucket, Name: key } },
      Attributes: ['ALL'],
    }));
    
    // 2. CHECK FOR INAPPROPRIATE CONTENT
    const moderationResult = await rekognition.send(new DetectModerationLabelsCommand({
      Image: { S3Object: { Bucket: bucket, Name: key } },
      MinConfidence: 75,
    }));
    
    // Prepare results
    const analysis = {
      sessionId,
      fileKey: key,
      timestamp: new Date().toISOString(),
      faceCount: faceResult.FaceDetails?.length || 0,
      hasFaces: (faceResult.FaceDetails?.length || 0) > 0,
      hasInappropriateContent: (moderationResult.ModerationLabels?.length || 0) > 0,
      isApproved: (faceResult.FaceDetails?.length || 0) > 0 && 
                  (moderationResult.ModerationLabels?.length || 0) === 0,
    };
    
    console.log("Analysis complete:", JSON.stringify(analysis, null, 2));
    
    // Save to DynamoDB
    await dynamodb.send(new PutItemCommand({
      TableName: process.env.ANALYSIS_TABLE!,
      Item: {
        sessionId: { S: sessionId },
        fileKey: { S: key },
        timestamp: { S: analysis.timestamp },
        faceCount: { N: analysis.faceCount.toString() },
        hasFaces: { BOOL: analysis.hasFaces },
        hasInappropriateContent: { BOOL: analysis.hasInappropriateContent },
        isApproved: { BOOL: analysis.isApproved },
        ttl: { N: Math.floor(Date.now() / 1000 + 86400).toString() },
      },
    }));
    
    console.log(`Saved analysis for session: ${sessionId}`);
    
    return { statusCode: 200, body: JSON.stringify(analysis) };
    
  } catch (error) {
    console.error("Rekognition error:", error);
    throw error;
  }
};