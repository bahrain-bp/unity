import os
import boto3
import json

s3 = boto3.client('s3')
rekog = boto3.client('rekognition')
BUCKET = os.environ['BUCKET_NAME']
COLLECTION = os.environ['COLLECTION_ID']

# this function will handle the picture uploaded in the pre registration process
def PreRegisterCheck(event, context):
   ## if event["httpMethod"] == "OPTIONS":
     ##   return response(200, {"message": "CORS preflight"})
    #take the s3 key
    key = event.get("key")
    if not key:
        return {"error": "No S3 key provided"}

    # Common step: detect face and check quality
    detect_response = rekog.detect_faces(
        Image={'S3Object': {'Bucket': BUCKET, 'Name': key}},
        Attributes=['ALL']
    )
    face_details = detect_response.get("FaceDetails", [])

    if not face_details:
        return {"error": "No face detected. Please retake the photo."}

    face = face_details[0]
    if face['Confidence'] < 90 or face['Quality']['Sharpness'] < 70:
        return {"error": "Face quality is poor. Please retake the photo."}

        # Index the face without a visitor ID for now
    response = rekog.index_faces(
            CollectionId=COLLECTION,
            Image={'S3Object': {'Bucket': BUCKET, 'Name': key}},
            DetectionAttributes=[]
        )
    face_records = response.get("FaceRecords", [])
    if face_records:
            faceId = face_records[0]["Face"]["FaceId"]
            print(f"Face registered with FaceId: {faceId}")
            return {"FaceId": faceId}
    else:
            return {"error": "Face could not be indexed"}
    
def response(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",   #Allow requests from any origin
            "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token"
        },
        "body": json.dumps(body)
    }
