import os
import boto3
import time
from datetime import datetime

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["TABLE_NAME"])

def handler(event, context):
    print("Received event:", event)

    # Token validation
    params = event.get("queryStringParameters") or {}
    token = params.get("token")

    expected_token = os.environ.get("WS_TOKEN")

    if not token or token != expected_token:
        print("Unauthorized WebSocket connection attempt")
        return {
            "statusCode": 401,
            "body": "Unauthorized"
        }

    # Authorized connection
    connection_id = event["requestContext"]["connectionId"]
    now = int(time.time())

    table.put_item(
        Item={
            "ConnectionId": connection_id,
            "connectedAt": datetime.utcnow().isoformat(),
            "lastSeen": now,
            "ttl": now + 120  # expires after 2 minutes if no heartbeat
        }
    )

    print("Stored connection:", connection_id)

    return {
        "statusCode": 200,
        "body": "Connected"
    }
