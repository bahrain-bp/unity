import os
import boto3
import uuid
import json
from datetime import datetime
import re
import smtplib
from email.mime.text import MIMEText
from datetime import datetime


GMAIL_USER = os.environ['GMAIL_USER']      # Your Gmail address
GMAIL_PASS = os.environ['GMAIL_PASS']      # Gmail app password

s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')

BUCKET = os.environ['BUCKET_NAME']
InviteTable = os.environ['InviteTable']
InviteTable = dynamodb.Table(InviteTable)

def handler(event, context):
    if event["httpMethod"] == "OPTIONS":
        return response(200, {"message": "CORS preflight"})
    
    try:
        body = json.loads(event["body"])
        name = body.get("name")
        email = body.get("email")
        visitDateTime = body.get("visitDateTime")

        if not name or not email or not visitDateTime:
            return response(404, {"error": "Required fields are missing"})

        if not is_valid_email(email):
            return response(404, {"error": "invalid email address"})

        # generate unique ID
        invited_visitor_id = str(uuid.uuid4())
        visit_dt = datetime.fromisoformat(visitDateTime)
        # Check if visit date is in the past
        if visit_dt < datetime.utcnow():
            return response(400, {"error": "Visit date scheduled is invalid"})
        formatted_visit_dt = visit_dt.strftime("%A, %B %d, %Y at %I:%M %p") 
        visit_date = visit_dt.date().isoformat()  # YYYY-MM-DD
        visit_time = visit_dt.strftime("%H:%M")  # e.g., "10:30"
        print("visit_dt",visit_dt)
        print("visit_date"+visit_date)
        print("visit_dt.isoformat()"+visit_dt.isoformat())

        if is_duplicate_visit(email, visit_date):
            return response(409, {"error": "This visitor is already registered for this date."
            })
        print("is duplicate function was executed. no duplicate")

        # Insert into DynamoDB
        InviteTable.put_item(
            Item={
                "visitorId": invited_visitor_id,
                "name": name,
                "email": email,
                "visitDate": visit_date,
                "visitTime": visit_time,
                "status": "invited",
                "createdAt": datetime.utcnow().isoformat()
            }
        )
        print("DynamoDB put successflly")

        # send an invitation via email
        send_invitation_email(name, email, formatted_visit_dt)

        # Respond after invitation sent
        response_body = {
            "message": "Registration was successfull and an invitation was sent the user.",
        }

        return response(200, response_body)

    except Exception as e:
        print("ERROR:", str(e))
        return response(500, {"error": "Internal server error"})

# Simple email validation
def is_valid_email(email):
    return re.match(r"[^@]+@[^@]+\.[^@]+", email)

def send_invitation_email(name, email, formatted_visit_dt):
    try:
        # Prepare email
        subject = "Your BAHTWIN Visit Invitation"
        body_html = f"""
        <html>
        <head>
        <style>
        body {{
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
        }}
        .container {{
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            background-color: #f9f9f9;
        }}
        .btn {{
            display: inline-block;
            padding: 12px 20px;
            margin-top: 20px;
            font-size: 16px;
            color: white;
            background-color: #007BFF;
            text-decoration: none;
            border-radius: 5px;
        }}
        .footer {{
            margin-top: 30px;
            font-size: 12px;
            color: #777;
        }}
        </style>
        </head>
        <body>
        <div class="container">

        <p>Dear {name},</p>

        <p>
        We are pleased to invite you to visit <strong>AWS</strong> on 
        <strong>{formatted_visit_dt}</strong>.
        </p>

        <p>
        As part of this visit, we would like to introduce you to 
        <strong>BAHTWIN</strong>, a smart visitor management platform specifically designed 
        to enhance the visitor experience by streamlining registration and facility visualization, reducing waiting 
        time, and ensuring a smooth and secure entry process.
        </p>

        <p>
        BAHTWIN leverages modern cloud technologies to provide an efficient, 
        contactless, and user-friendly experience throughout your visit. 
        To familiarize yourself with the platform and navigate the facility digitally, 
        please access BAHTWIN using the link below:
        </p>

        <p>
        <a href="https://localhost:5173" class="btn">
            Access BAHTWIN Platform
        </a>
        </p>

        <p class="footer">
        If you did not intend to visit AWS or received this email in error, 
        please disregard this message.
        </p>

        <p class="footer">
        We look forward to welcoming you.
        </p>

        </div>
        </body>
        </html>
        """
        # Create MIME message
        msg = MIMEText(body_html, 'html')
        msg['Subject'] = subject
        msg['From'] = GMAIL_USER
        msg['To'] = email

        # Send email via Gmail SMTP
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(GMAIL_USER, GMAIL_PASS)
            server.send_message(msg)

        print("Invitation email sent to:", email)
        return True

    except Exception as e:
        print("Error sending email:", e)
        return False

from boto3.dynamodb.conditions import Key

def is_duplicate_visit(email, visit_date):
    response = InviteTable.query(
        IndexName='EmailVisitDateIndex',
        KeyConditionExpression=
            Key('email').eq(email) & Key('visitDate').eq(visit_date)
    )
    return len(response.get('Items', [])) > 0

#response handling function
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
