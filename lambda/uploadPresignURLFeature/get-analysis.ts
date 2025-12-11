import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";

const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION });

export const handler = async (event: any) => {
  try {
    const sessionId = event.queryStringParameters?.sessionId;
    
    if (!sessionId) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Need session ID" }),
      };
    }
    
    const result = await dynamodb.send(new QueryCommand({
      TableName: process.env.ANALYSIS_TABLE!,
      KeyConditionExpression: "sessionId = :sessionId",
      ExpressionAttributeValues: { ":sessionId": { S: sessionId } },
      ScanIndexForward: false,
      Limit: 1,
    }));
    
    if (!result.Items?.length) {
      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ 
          status: "processing",
          message: "Checking image..." 
        }),
      };
    }
    
    const item = result.Items[0];
    
    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        status: "completed",
        isApproved: item.isApproved.BOOL,
        hasFaces: item.hasFaces.BOOL,
        hasInappropriateContent: item.hasInappropriateContent.BOOL,
        faceCount: parseInt(item.faceCount.N || "0"),
      }),
    };
    
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Failed to check image" }),
    };
  }
};