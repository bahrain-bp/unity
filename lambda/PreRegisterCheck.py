import os
import boto3
import base64
import uuid
import json
from datetime import datetime

s3 = boto3.client('s3')
rekog = boto3.client('rekognition')
dynamodb = boto3.resource('dynamodb')

BUCKET = os.environ['BUCKET_NAME']
COLLECTION = os.environ['COLLECTION_ID']
USER_TABLE = os.environ['USER_TABLE']
USER_TABLE = dynamodb.Table(USER_TABLE)

def PreRegisterCheck(event, context):
    if event["httpMethod"] == "OPTIONS":
        return response(200, {"message": "CORS preflight"})
    
    try:
        body = json.loads(event["body"])
        image_data = body.get("image_data")
        userId = body.get("userId")
        name = body.get("name")
        email = body.get("email")


        if not image_data:
            return response(400, {"error": "No image provided"})

        # Decode image
        image_bytes = base64.b64decode(image_data)

        # Detect face
        detect_response = rekog.detect_faces(
            Image={'Bytes': image_bytes},
            Attributes=['ALL']
        )
        face_details = detect_response.get("FaceDetails", [])
        if not face_details:
            return response(400, {"error": "No face detected. Please upload another image."})

        # Face detected → upload image to S3
        key = f"pre-reg/{userId}.jpg"
        s3.put_object(
            Bucket=BUCKET,
            Key=key,
            Body=image_bytes,
            ContentType="image/jpeg"
        )


        # Index face in Rekognition (synchronous so Lambda doesn't freeze background work)
        index_response = rekog.index_faces(
            CollectionId=COLLECTION,
            Image={'Bytes': image_bytes},
            DetectionAttributes=[]
        )
        face_records = index_response.get("FaceRecords", [])
        if not face_records:
            return response(400, {"error": "Face could not be indexed. Please upload another image."})

        faceId = face_records[0]["Face"]["FaceId"]

        # Store visitor info in DynamoDB
        USER_TABLE.put_item(
            Item={
                "userId": userId,
                "s3Key": key,
                "registeredAt": datetime.utcnow().isoformat(),
                "name": name,
                "email": email,
                "faceId": faceId,
                "passedRegistration": False
            }
        )

        # Respond after Dynamo write to ensure GET can find the record
        return response(200, {"message": "Registration was successfull."})

    except Exception as e:
        print("ERROR:", str(e))
        return response(500, {"error": "Internal server error"})

def response(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token"
        },
        "body": json.dumps(body)
    }
