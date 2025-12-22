import os
import boto3
import json
import jwt

FEEDBACK_TABLE = os.environ['FEEDBACK_TABLE']
FEEDBACK_SECRET = os.environ['FEEDBACK_SECRET']

dynamodb = boto3.resource('dynamodb')
feedback_table = dynamodb.Table(FEEDBACK_TABLE)

def handler(event, context):
    try:
        token = event['headers'].get('Authorization', '').replace('Bearer ', '')
        if not token:
            return {"statusCode": 401, "body": json.dumps({"error": "No token provided"})}

        payload = jwt.decode(token, FEEDBACK_SECRET, algorithms=['HS256'])
        visitor_id = payload.get('visitorId')

        if not visitor_id:
            return {"statusCode": 400, "body": json.dumps({"error": "Invalid token"})}

        # Query feedbacks using visitorId GSI
        response = feedback_table.query(
            IndexName='visitorIdIndex',
            KeyConditionExpression=boto3.dynamodb.conditions.Key('visitorId').eq(visitor_id)
        )

        return {"statusCode": 200, "body": json.dumps(response.get('Items', []))}

    except jwt.ExpiredSignatureError:
        return {"statusCode": 401, "body": json.dumps({"error": "Token expired"})}
    except jwt.InvalidTokenError:
        return {"statusCode": 401, "body": json.dumps({"error": "Invalid token"})}
    except Exception as e:
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}
