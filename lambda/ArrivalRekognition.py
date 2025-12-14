import os
import boto3
import base64
import uuid
import json

dynamodb = boto3.resource('dynamodb')
USER_TABLE = os.environ['USER_TABLE']
USER_TABLE = dynamodb.Table(USER_TABLE)
lambda_client = boto3.client('lambda')
s3 = boto3.client('s3')
rekog = boto3.client('rekognition')
BUCKET = os.environ['BUCKET_NAME']
COLLECTION = os.environ['COLLECTION_ID']


def ArrivalRekognition(event, context):
    if event["httpMethod"] == "OPTIONS":
        print("CORS preflight")
        return response(200, {"message": "CORS preflight"})
    try:

        # Get body as string (API Gateway)
        body_str = event["body"]
        image_data= json.loads(body_str)["image_data"]

        
        if not image_data:
            return response(400, {"error": "No image provided"})
        # Generate S3 key
        ##key = f"arrival/{uuid.uuid4()}.jpg"
        image = base64.b64decode(image_data)

       ## # Upload image to S3
       ## s3.put_object(
         ##   Bucket=BUCKET,
           ## Key=key,
            ##Body=base64.b64decode(image_data),
            ##ContentType="image/jpeg"
       ## )

        # Detect face
        detect_response = rekog.detect_faces(
            Image={'Bytes': image},
            Attributes=['ALL']
        )

        face_details = detect_response.get("FaceDetails", [])
        if not face_details:
            return response(400, {"error": "No face detected. Please retake the photo."})

        # Search match
        match_response = rekog.search_faces_by_image(
            CollectionId=COLLECTION,
            Image={'Bytes': image},
            FaceMatchThreshold=90,
            MaxFaces=1
        )

        matches = match_response.get("FaceMatches", [])

        if matches:
            match = matches[0]

            face_id = match['Face']['FaceId']

            # Query by faceId using the GSI
            db_response = USER_TABLE.query(
                IndexName='FaceIdIndex',  # the name of the GSI
                KeyConditionExpression=boto3.dynamodb.conditions.Key('faceId').eq(face_id)
                )
            items = db_response.get('Items', [])
            if items:
                visitor = items[0]  # usually one match

            if not visitor:
                return response(404, {"error": "Visitor not found in the system."})
            

            # Prepare payload for email Lambda
            payload = {
                "visitorId": visitor['userId'],
                "email": visitor['email'],
                "name": visitor['name']
            }

            lambda_client.invoke(
            FunctionName='SendFeedbackLambda',
            InvocationType='Event',  # async invocation
            Payload=json.dumps(payload)
        )

            return response(200, {
                "name": visitor['name'],
                "status": "match",
            })
        else:
            return response(200, {"error": "unknown visitor"})

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
