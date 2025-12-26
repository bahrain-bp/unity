import os
import boto3
from boto3.dynamodb.conditions import Attr, Key
import json
from datetime import datetime, timezone, timedelta

# Initialize DynamoDB tables
dynamodb = boto3.resource("dynamodb")
InviteTable = dynamodb.Table(os.environ["InviteTable"])
userTable = dynamodb.Table(os.environ["USER_TABLE"])
WebsiteActivityTable = dynamodb.Table(os.environ["WEBSITE_ACTIVITY_TABLE"])

ACTIVE_WINDOW_SECONDS = 5 * 60
LAST_6_HOURS_SECONDS = 6 * 60 * 60
BAHRAIN_OFFSET_SECONDS = 3 * 60 * 60

def get_bahrain_day_start_utc_seconds(now_utc):
    offset = timedelta(seconds=BAHRAIN_OFFSET_SECONDS)
    bahrain_now = now_utc + offset
    start_bahrain = datetime(
        bahrain_now.year, bahrain_now.month, bahrain_now.day, tzinfo=timezone.utc
    )
    start_utc = start_bahrain - offset
    return int(start_utc.timestamp())

def format_bahrain_hour_label(timestamp_seconds):
    date = datetime.fromtimestamp(
        timestamp_seconds + BAHRAIN_OFFSET_SECONDS, tz=timezone.utc
    )
    return f"{date.year:04d}-{date.month:02d}-{date.day:02d} {date.hour:02d}:00"

def last6_hour_buckets(now_seconds):
    return [
        format_bahrain_hour_label(now_seconds - i * 3600)
        for i in range(5, -1, -1)
    ]

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

    # -------------------------
    # Recent Visitors
    # -------------------------
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

    # -------------------------
    # Today Invitations Count
    # -------------------------
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

    # -------------------------
    # Total BAHTWIN Visitors
    # -------------------------
    elif component == "total_bahtwin_visitors":
        response_count = userTable.scan(Select="COUNT")
        total_visitors = response_count.get("Count", 0)

        card_payload["data"] = [
            {"total_visitors": total_visitors}
        ]

    # -------------------------
    # Website Activity (Heartbeat)
    # -------------------------
    elif component in ("active_users_now", "users_today", "users_last_6_hours"):
        now_utc = datetime.now(timezone.utc)
        timestamp = int(now_utc.timestamp())

        last6_hours_cutoff = timestamp - LAST_6_HOURS_SECONDS
        active_cutoff = timestamp - ACTIVE_WINDOW_SECONDS
        today_cutoff = get_bahrain_day_start_utc_seconds(now_utc)
        yesterday_start = today_cutoff - 24 * 60 * 60
        yesterday_end = today_cutoff - 1

        response_last6 = WebsiteActivityTable.query(
            KeyConditionExpression=Key("pk").eq("WEBSITE")
            & Key("sk").gte(str(last6_hours_cutoff))
        )
        response_today = WebsiteActivityTable.query(
            KeyConditionExpression=Key("pk").eq("WEBSITE")
            & Key("sk").gte(str(today_cutoff))
        )
        response_yesterday = WebsiteActivityTable.query(
            KeyConditionExpression=Key("pk").eq("WEBSITE")
            & Key("sk").between(
                str(yesterday_start), f"{yesterday_end}#\uffff"
            )
        )

        active_users = set()
        users_today = set()
        users_yesterday = set()
        hourly_buckets = {}

        for item in response_last6.get("Items", []):
            user = item.get("userId")
            ts = item.get("timestamp")
            if not user or ts is None:
                continue
            ts = int(ts)
            if ts >= active_cutoff:
                active_users.add(user)
            bucket = format_bahrain_hour_label(ts)
            hourly_buckets.setdefault(bucket, set()).add(user)

        for item in response_today.get("Items", []):
            user = item.get("userId")
            if user:
                users_today.add(user)

        for item in response_yesterday.get("Items", []):
            user = item.get("userId")
            if user:
                users_yesterday.add(user)

        users_last_6_hours = [
            {"hour": hour, "count": len(hourly_buckets.get(hour, set()))}
            for hour in last6_hour_buckets(timestamp)
        ]

        users_today_count = len(users_today)
        users_yesterday_count = len(users_yesterday)
        if users_yesterday_count > 0:
            users_today_change_pct = (
                (users_today_count - users_yesterday_count)
                / users_yesterday_count
            ) * 100
        else:
            users_today_change_pct = 0

        if component == "active_users_now":
            card_payload["data"] = [
                {"count": len(active_users), "timestamp": timestamp}
            ]
        elif component == "users_today":
            card_payload["data"] = [
                {
                    "count": users_today_count,
                    "usersYesterday": users_yesterday_count,
                    "usersTodayChangePct": users_today_change_pct,
                    "timezone": "Asia/Bahrain",
                }
            ]
        else:
            card_payload["data"] = [
                {"series": users_last_6_hours}
            ]
    # -------------------------
    # Unknown component
    # -------------------------
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


