import os
import boto3
import json
import jwt
from datetime import datetime, timezone, timedelta
from decimal import Decimal

FEEDBACK_TABLE = os.environ["FEEDBACK_TABLE"]
FEEDBACK_SECRET = os.environ["FEEDBACK_SECRET"]
used_tokens_table_name = os.environ["used_tokens_table"]

dynamodb = boto3.resource("dynamodb")
feedback_table = dynamodb.Table(FEEDBACK_TABLE)
used_tokens_table = dynamodb.Table(used_tokens_table_name)
lambda_client = boto3.client('lambda')
BROADCAST_LAMBDA = os.environ["BROADCAST_LAMBDA"]

def handler(event, context):
    try:
        # 1. Extract and validate JWT
        headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
        token = headers.get("authorization", "").replace("Bearer ", "").strip()

        if not token:
            return resp(401, {"error": "No token provided"})

        payload = jwt.decode(token, FEEDBACK_SECRET, algorithms=["HS256"])

        # Before saving feedback
        token_used = used_tokens_table.get_item(Key={'token': token}).get('Item')
        if token_used:
            return resp(400, {"error": "Token already used"})

        visitor_id = payload.get("visitorId")

        if not visitor_id:
            return resp(400, {"error": "Invalid token"})

        # 2. Parse body JSON
        if not event.get("body"):
            return resp(400, {"error": "Missing body"})

        try:
            data = json.loads(event["body"])
        except:
            return resp(400, {"error": "Invalid JSON body"})

        # 3. Required fields validation
        required_fields = [
            "name",
            "email",
            "purpose",
            "checkInTime",
            "faster",
            "digitalPref",
            "faceHelp",
            "overallRating",
            "commentText",
        ]

        missing = [f for f in required_fields if f not in data]
        if missing:
            print("missing field")
            return resp(400, {"error": f"Missing fields: {', '.join(missing)}"})
            
        # 4. Prepare item for DynamoDB
        # Define Bahrain timezone
        bahrain_tz = timezone(timedelta(hours=3))
        today_bahrain = datetime.now(bahrain_tz).date().isoformat()
        feedback_item = {
            "id": visitor_id,
            "createdAt": today_bahrain,

            # Store all fields directly
            "name": data["name"],
            "email": data["email"],
            "purpose": data["purpose"],
            "checkInTime": data["checkInTime"],
            "faster": data["faster"],
            "digitalPref": data["digitalPref"],
            "faceHelp": data["faceHelp"],
            "overallRating": data["overallRating"],
            "commentText": data["commentText"],
        }
        #construct the comment
        comment = f'"{data["commentText"]}" - {data["name"]}'

        to_dashboard = {
            "card": "visitor_comment",
            "data": {
                "comment":  comment,
                }
            }
            # Invoke the broadcast Lambda asynchronously
        lambda_client.invoke(
                FunctionName=BROADCAST_LAMBDA,
                InvocationType="Event",  # async
                Payload=json.dumps(to_dashboard)
            )

        # Save
        feedback_table.put_item(Item=feedback_item)
        used_tokens_table.put_item(Item={'token': token, 'usedAt': today_bahrain})
        print("Feedback saved successfully")
        broadcast_avg_feedback()
        return resp(200, {"message": "Feedback submitted successfully"})
        

    except jwt.ExpiredSignatureError:
        return resp(401, {"error": "Token expired"})
    except jwt.InvalidTokenError:
        return resp(401, {"error": "Invalid token"})
    except Exception as e:
        return resp(500, {"error": str(e)})


def broadcast_avg_feedback():
    # Fetch all feedback items
    resp = feedback_table.scan()
    items = resp.get("Items", [])

    if not items:
        avg_score = 0
    else:
        total_score = sum(Decimal(item["overallRating"]) for item in items)
        avg_score = float(total_score / len(items))

        # Calculate stars
        num_colored_stars = int(avg_score)              # full colored stars
        num_empty_stars = 5 - num_colored_stars        # remaining empty stars
        print(avg_score)
        # Prepare dashboard payload
        to_dashboard = {
            "card": "avg_feedback_score",
            "data": {
                "avg_score": round(avg_score, 1),       # e.g., 4.3
                "colored_stars": num_colored_stars,
                "empty_stars": num_empty_stars
            }
        }

        # Invoke broadcast Lambda asynchronously
        lambda_client.invoke(
            FunctionName=BROADCAST_LAMBDA,
            InvocationType="Event",
            Payload=json.dumps(to_dashboard)
        )
        print("success")


# Helper for consistent JSON + CORS
def resp(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*"
        },
        "body": json.dumps(body)
    }
