import os
import boto3
import base64
import uuid
import json
import threading

s3 = boto3.client('s3')
rekog = boto3.client('rekognition')
dynamodb = boto3.resource('dynamodb')

BUCKET = os.environ['BUCKET_NAME']
COLLECTION = os.environ['COLLECTION_ID']
USER_MANAGEMENT_TABLE = os.environ['USER_MANAGEMENT_TABLE']

user_table = dynamodb.Table(USER_MANAGEMENT_TABLE)


def PreRegisterCheck(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return response(200, {"message": "CORS preflight"})

    try:
        body = json.loads(event["body"])

        image_data = body.get("image_data")
        userId = body.get("userId")
        name = body.get("name")
        email = body.get("email")

        if not image_data:
            return response(400, {"error": "No image provided"})

        if not userId:
            return response(400, {"error": "Missing userId"})

        # Decode image
        image_bytes = base64.b64decode(image_data)

        # Detect face
        detect_response = rekog.detect_faces(
            Image={'Bytes': image_bytes},
            Attributes=['ALL']
        )

        face_details = detect_response.get("FaceDetails", [])
        if not face_details:
            return response(400, {"error": "No face detected. Please retake the photo."})

        # Save image to S3
        key = f"visitor-images/{userId}.jpg"

        s3.put_object(
            Bucket=BUCKET,
            Key=key,
            Body=image_bytes,
            ContentType="image/jpeg"
        )

        # Return response immediately
        response_body = {
            "message": "Registration was successful.",
            "image_s3_key": key
        }

        # Background face indexing + DB update
        threading.Thread(
            target=background_index_face,
            args=(image_bytes, key, userId, name, email)
        ).start()

        return response(200, response_body)

    except Exception as e:
        print("ERROR:", str(e))
        return response(500, {"error": "Internal server error"})

def background_index_face(image_bytes, s3_key, userId, name, email):
    try:
        # Index face in Rekognition
        index_response = rekog.index_faces(
            CollectionId=COLLECTION,
            Image={'Bytes': image_bytes},
            DetectionAttributes=[]
        )

        face_records = index_response.get("FaceRecords", [])

        if face_records:
            faceId = face_records[0]["Face"]["FaceId"]

            # Insert into UserManagement table
            user_table.put_item(
                Item={
                    "userId": userId,                # PRIMARY KEY
                    "faceId": faceId,
                    "profileImage": s3_key,          # updated name
                    "name": name,
                    "email": email,
                    "registeredAt": str(uuid.uuid1())
                }
            )
        else:
            print(f"Face could not be indexed for S3 key: {s3_key}")

    except Exception as e:
        print("Error in background indexing:", str(e))


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
