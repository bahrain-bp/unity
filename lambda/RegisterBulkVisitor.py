import os
import json
import csv
import io
import re
import base64
import uuid
from datetime import datetime
import boto3
import smtplib
from email.mime.text import MIMEText
from boto3.dynamodb.conditions import Key

# Environment variables
GMAIL_USER = os.environ['GMAIL_USER']
GMAIL_PASS = os.environ['GMAIL_PASS']
InviteTableName = os.environ['InviteTable']
InviteTable = boto3.resource('dynamodb').Table(InviteTableName)

EMAIL_REGEX = r"[^@]+@[^@]+\.[^@]+"
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB max
REQUIRED_FIELDS = ["name", "email", "visitDate", "visitTime"]

def handler(event, context):
    try:
        body = json.loads(event["body"])
        if "file" not in body:
            return response(400, {"error": f"No file uploaded. Required columns: {', '.join(REQUIRED_FIELDS)}"})
        
        csv_bytes = base64.b64decode(body["file"])
        if len(csv_bytes) > MAX_FILE_SIZE:
            return response(400, {"error": "File too large. Maximum allowed size is 5 MB"})

        csv_file = io.StringIO(csv_bytes.decode("utf-8"))
        reader = csv.DictReader(csv_file)

        # Validate headers
        missing_headers = [f for f in REQUIRED_FIELDS if f not in reader.fieldnames]
        if missing_headers:
            return response(400, {"error": f"Missing required columns: {', '.join(missing_headers)}"})

        today = datetime.today().date()
        for i, row in enumerate(reader, start=1):
            # Check required fields
            for field in REQUIRED_FIELDS:
                if not row.get(field) or not row.get(field).strip():
                    return response(400, {"error": f"Row {i}: {field} is missing"})

            # Validate email
            email = row["email"].strip()
            if not re.match(EMAIL_REGEX, email):
                return response(400, {"error": f"Row {i}: Invalid email format"})

            # Validate date
            visit_date_str = row["visitDate"].strip()
            try:
                print(visit_date_str)
                visit_date = datetime.strptime(visit_date_str, "%m/%d/%Y").date()
                
                if visit_date < today:
                    return response(400, {"error": f"Row {i}: Visit date cannot be in the past"})
            except ValueError:
                return response(400, {"error": f"Row {i}: Invalid visit date format, expected MM-DD-YYYY"})

            # Validate time
            visit_time_str = row["visitTime"].strip().upper().replace(" ", "")
            try:
                visit_dt_time = datetime.strptime(visit_time_str, "%I:%M%p")
            except ValueError:
                return response(400, {"error": f"Row {i}: Invalid visit time format, expected HH:MM AM/PM"})

            # Combine date and time for storage
            visit_dt = datetime.combine(visit_date, visit_dt_time.time())
            formatted_visit_dt = visit_dt.strftime("%A, %B %d, %Y at %I:%M %p")
            visit_time_24h = visit_dt.strftime("%H:%M")  # For DynamoDB storage
            visit_date_iso = visit_dt.date().isoformat()

            # Check for duplicates
            if is_duplicate_visit(email, visit_date_iso):
                return response(409, {"error": f"Row {i}: Visitor already registered for this date"})

            # Register in DynamoDB
            visitor_id = str(uuid.uuid4())
            InviteTable.put_item(
                Item={
                    "visitorId": visitor_id,
                    "name": row["name"].strip(),
                    "email": email,
                    "visitDate": visit_date_iso,
                    "visitTime": visit_time_24h,
                    "status": "invited",
                    "createdAt": datetime.utcnow().isoformat()
                }
            )

            # Send invitation
            send_invitation_email(row["name"].strip(), email, formatted_visit_dt)

        return response(200, {"message": "All visitors registered and invitations sent successfully"})

    except Exception as e:
        return response(500, {"error": str(e)})


def is_duplicate_visit(email, visit_date):
    response = InviteTable.query(
        IndexName='EmailVisitDateIndex',
        KeyConditionExpression=Key('email').eq(email) & Key('visitDate').eq(visit_date)
    )
    return len(response.get('Items', [])) > 0


def send_invitation_email(name, email, formatted_visit_dt):
    try:
        subject = "Your BAHTWIN Visit Invitation"
        body_html = f"""<html><body>
        <p>Dear {name},</p>
        <p>We are pleased to invite you on <strong>{formatted_visit_dt}</strong>.</p>
        <p><a href='https://localhost:5173'>Access BAHTWIN Platform</a></p>
        </body></html>"""
        msg = MIMEText(body_html, 'html')
        msg['Subject'] = subject
        msg['From'] = GMAIL_USER
        msg['To'] = email
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(GMAIL_USER, GMAIL_PASS)
            server.send_message(msg)
        return True
    except Exception as e:
        print("Error sending email:", e)
        return False


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
