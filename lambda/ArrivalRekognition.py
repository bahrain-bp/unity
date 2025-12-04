import os
import boto3
import base64
import uuid
import json

s3 = boto3.client('s3')
rekog = boto3.client('rekognition')
BUCKET = os.environ['BUCKET_NAME']
COLLECTION = os.environ['COLLECTION_ID']

# this function will handle the picture uploaded in the pre registration process
def PreRegisterCheck(event, context):
    if event["httpMethod"] == "OPTIONS":
        return response(200, {"message": "CORS preflight"})
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
def ArrivalRekognition(event, context):
    if event["httpMethod"] == "OPTIONS":
        print("CORS preflight")
        return response(200, {"message": "CORS preflight"})
    try:

        # Get body either as string (API Gateway) or dict (direct Lambda)
        body_str = event["body"]
        image_data= json.loads(body_str)["image_data"]
        
        if not image_data:
            return response(400, {"error": "No image provided"})
        # Generate S3 key
        key = f"arrival/{uuid.uuid4()}.jpg"

        # Upload image to S3
        s3.put_object(
            Bucket=BUCKET,
            Key=key,
            Body=base64.b64decode(image_data),
            ContentType="image/jpeg"
        )

        # Detect face
        detect_response = rekog.detect_faces(
            Image={'S3Object': {'Bucket': BUCKET, 'Name': key}},
            Attributes=['ALL']
        )

        face_details = detect_response.get("FaceDetails", [])
        if not face_details:
            return response(400, {"error": "No face detected. Please retake the photo."})

       ## face = face_details[0]
        ##if face['Confidence'] < 90 or face['Quality']['Sharpness'] < 70:
          ##  return response(400, {"error": "Face quality is poor. Please retake the photo."})

        # Search match
        match_response = rekog.search_faces_by_image(
            CollectionId=COLLECTION,
            Image={'S3Object': {'Bucket': BUCKET, 'Name': key}},
            FaceMatchThreshold=90,
            MaxFaces=1
        )

        matches = match_response.get("FaceMatches", [])

        if matches:
            match = matches[0]
            return response(200, {
                "status": "match",
                "faceId": match['Face']['FaceId'],
                "similarity": match['Similarity']
            })
        else:
            return response(200, {"status": "unknown visitor"})

    except Exception as e:
        print("ERROR:", str(e))
        return response(500, {"error": "Internal server error"})


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
