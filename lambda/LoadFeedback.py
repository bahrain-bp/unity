import os
import boto3
from boto3.dynamodb.conditions import Attr
import json
from decimal import Decimal

# Initialize DynamoDB table
FeedbackTable = boto3.resource('dynamodb').Table(os.environ['FEEDBACK_TABLE'])

def handler(event, context):
    # Parse POST body
    body = {}
    if 'body' in event and event['body']:
        try:
            body = json.loads(event['body'])
        except Exception:
            return response(400, {"error": "Invalid JSON in request body"})

    component = body.get('component', '')

    # Response payload template
    card_payload = {
        "card": component,
        "data": []
    }

    # Logic for visitor_comment component
    if component == "visitor_comment":
        response_feedback = FeedbackTable.scan()
        items = response_feedback.get('Items', [])

        if items:
            sorted_feedback = sorted(items, key=lambda x: x['createdAt'], reverse=True)
            card_payload['data'] = [
                {"comment": f'"{f["commentText"]}" - {f["name"]}'}
                for f in sorted_feedback[:10]
            ]
    if component == "avg_feedback_score":
        # Fetch all feedback items
        resp = FeedbackTable.scan()
        items = resp.get("Items", [])

        if not items:
            avg_score = 0
        else:
            total_score = sum(Decimal(item["overallRating"]) for item in items)
            avg_score = float(total_score / len(items))

            # Calculate stars
            num_colored_stars = int(avg_score)              # full colored stars
            num_empty_stars = 5 - num_colored_stars        # remaining empty stars
            card_payload['data'] = [
                {
                    "avg_score": round(avg_score, 1),       # e.g., 4.3
                    "colored_stars": num_colored_stars,
                    "empty_stars": num_empty_stars
                }

            ]
        

    return response(200, card_payload)

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
