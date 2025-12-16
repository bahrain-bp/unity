import os
import boto3
import json
import jwt
from jwt import ExpiredSignatureError, InvalidTokenError

# Environment variables
VISITOR_TABLE = os.environ['VISITOR_TABLE']
FEEDBACK_SECRET = os.environ['FEEDBACK_SECRET']


# DynamoDB resource
dynamodb = boto3.resource('dynamodb')
visitor_table = dynamodb.Table(VISITOR_TABLE)
used_tokens_table = os.environ["used_tokens_table"]
used_tokens_table = dynamodb.Table(used_tokens_table)

def handler(event, context):
    try:
        # Extract token from headers (API Gateway GET request)
        headers = event.get("headers", {}) or {}  # Ensure it's a dict
        token = headers.get("Authorization", "").replace("Bearer ", "").strip()
        print(f"Token: {token}")
        
        if not token:
            return response(401, {"error": "No token provided"})
        
        token_used = used_tokens_table.get_item(Key={'token': token}).get('Item')
        
        if token_used:
            return response(403, {"error": "Token already used"})

        # Decode JWT
        payload = jwt.decode(token, FEEDBACK_SECRET, algorithms=['HS256'])
        visitor_id = payload.get("visitorId")
        print(f"Visitor ID: {visitor_id}")

        if not visitor_id:
            return response(403, {"error": "Invalid token"})

        # Fetch visitor info from DynamoDB
        response_db = visitor_table.get_item(Key={"userId": visitor_id})
        visitor = response_db.get("Item")
        print(f"Visitor info: {visitor}")

        if not visitor:
            return response(401, {"error": "Visitor not allowed"})

        # Return visitor info
        return response(200, {
            "visitorId": visitor["userId"],
            "name": visitor.get("name", ""),
            "email": visitor.get("email", "")
        })

    except ExpiredSignatureError:
        return response(401, {"error": "Token expired"})
    except InvalidTokenError:
        return response(401, {"error": "Invalid token"})
    except Exception as e:
        return response(500, {"error": str(e)})

def response(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",   # Allow requests from any origin
            "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token"
        },
        "body": json.dumps(body)
    }
