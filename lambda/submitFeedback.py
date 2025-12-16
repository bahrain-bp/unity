import os
import boto3
import json
import jwt
import datetime

FEEDBACK_TABLE = os.environ["FEEDBACK_TABLE"]
FEEDBACK_SECRET = os.environ["FEEDBACK_SECRET"]
used_tokens_table_name = os.environ["used_tokens_table"]

dynamodb = boto3.resource("dynamodb")
feedback_table = dynamodb.Table(FEEDBACK_TABLE)
used_tokens_table = dynamodb.Table(used_tokens_table_name)

def handler(event, context):
    try:
        # --------------------------------------
        # 1. Extract and validate JWT
        # --------------------------------------
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

        # --------------------------------------
        # 2. Parse body JSON
        # --------------------------------------
        if not event.get("body"):
            return resp(400, {"error": "Missing body"})

        try:
            data = json.loads(event["body"])
        except:
            return resp(400, {"error": "Invalid JSON body"})

        # --------------------------------------
        # 3. Required fields validation
        # --------------------------------------
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
            
        # --------------------------------------
        # 4. Prepare item for DynamoDB
        # --------------------------------------
        feedback_item = {
            "id": f"{datetime.datetime.utcnow().timestamp()}_{visitor_id}",
            "visitorId": visitor_id,
            "createdAt": datetime.datetime.utcnow().isoformat(),

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

        # Save
        feedback_table.put_item(Item=feedback_item)
        used_tokens_table.put_item(Item={'token': token, 'usedAt': datetime.datetime.utcnow().isoformat()})
        print("Feedback saved successfully")
        return resp(200, {"message": "Feedback submitted successfully"})
        

    except jwt.ExpiredSignatureError:
        return resp(401, {"error": "Token expired"})
    except jwt.InvalidTokenError:
        return resp(401, {"error": "Invalid token"})
    except Exception as e:
        return resp(500, {"error": str(e)})


# --------------------------------------
# Helper for consistent JSON + CORS
# --------------------------------------
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
