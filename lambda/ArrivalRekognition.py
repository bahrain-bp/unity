import os
import boto3
import base64
import json

dynamodb = boto3.resource('dynamodb')
USER_TABLE = os.environ['USER_TABLE']
USER_TABLE = dynamodb.Table(USER_TABLE)
lambda_client = boto3.client('lambda')
rekog = boto3.client('rekognition')
COLLECTION = os.environ['COLLECTION_ID']
sns = boto3.client('sns')
TOPIC_ARN = os.environ['TOPIC_ARN']
InviteTable = os.environ['InviteTable']
InviteTable = dynamodb.Table(InviteTable)

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

        image = base64.b64decode(image_data)

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
            else:
                return response(404, {"error": "Visitor not found in the system."})
            
            # Prepare payload for email Lambda
            payload = {
                "visitorId": visitor['userId'],
                "email": visitor['email'],
                "name": visitor['name']
            }

            # if visitor not invited by administrator check-in not allowed
            db_response_email = InviteTable.query(
                IndexName='EmailVisitDateIndex',  # the name of the GSI
                KeyConditionExpression=boto3.dynamodb.conditions.Key('email').eq(visitor['email'])
                )
            items_v = db_response_email.get('Items', [])
            print(items_v)

            if not items_v:
                print("not invited")
                return  response(200, {"error": "visitor is not invited"})

            SendSMS(visitor['name'])

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
            return response(200, {"error": "Visitor is not registered"})

    except Exception as e:
        print("ERROR:", str(e))
        return response(500, {"error": "Internal server error"})

def SendSMS(visitor_name):
    
    message = f"Hello Admin, you visitor {visitor_name} has arrived at office for his oppointment"
    
    try:
        # Send SMS directly via SNS
        sns.publish(
            TopicArn = TOPIC_ARN,
            Message=message
        )
        print("sms sent")
        return {"statusCode": 200, "body": "SMS sent"}
    
    except Exception as e:
        print("Error sending SMS:", e)
        return {"statusCode": 500, "body": str(e)}

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
