import os
import boto3
from boto3.dynamodb.conditions import Attr
import json
from datetime import datetime, timezone, timedelta

# Initialize DynamoDB tables
dynamodb = boto3.resource("dynamodb")
InviteTable = dynamodb.Table(os.environ["InviteTable"])
userTable = dynamodb.Table(os.environ["USER_TABLE"])


def handler(event, context):
    # Parse POST body
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            return response(400, {"error": "Invalid JSON in request body"})

    component = body.get("component", "")

    # Default response
    card_payload = {
        "card": component,
        "data": []
    }

    # Recent Visitors
    if component == "RecentVisitors":
        response_checked_in = InviteTable.scan(
            FilterExpression=Attr("checked_in").eq("yes")
        )
        items = response_checked_in.get("Items", [])

        if items:
            sorted_items = sorted(
                items,
                key=lambda x: x.get("checkin_time", ""),
                reverse=True
            )
            card_payload["data"] = [
                {
                    "visitor_name": v["name"],
                    "checkin_time": v["checkin_time"]
                }
                for v in sorted_items[:5]
            ]

    # Today Invitations Count
    elif component == "today_invitations":
        bahrain_tz = timezone(timedelta(hours=3))
        today_date = datetime.now(bahrain_tz).date().isoformat()

        response_today = InviteTable.scan(
            FilterExpression=Attr("visitDate").eq(today_date)
        )

        total_today = response_today.get("Count", 0)

        card_payload["data"] = [
            {"total": total_today}
        ]

    # Total BAHTWIN Visitors
    elif component == "total_bahtwin_visitors":
        response_count = userTable.scan(Select="COUNT")
        total_visitors = response_count.get("Count", 0)

        card_payload["data"] = [
            {"total_visitors": total_visitors}
        ]

    # Unknown component
    else:
        return response(400, {"error": "Unknown component"})

    return response(200, card_payload)


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
