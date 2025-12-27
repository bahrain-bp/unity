import os
import boto3
import uuid
import json
from datetime import datetime, timezone, timedelta
import re
import smtplib
from email.mime.text import MIMEText
from boto3.dynamodb.conditions import Key


lambda_client = boto3.client("lambda")
BROADCAST_LAMBDA = os.environ["BROADCAST_LAMBDA"]

GMAIL_USER = os.environ['GMAIL_USER']      # Your Gmail address
GMAIL_PASS = os.environ['GMAIL_PASS']      # Gmail app password

s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')

InviteTable = os.environ['InviteTable']
InviteTable = dynamodb.Table(InviteTable)

def handler(event, context):
    
    try:
        body = json.loads(event["body"])
        name = body.get("name")
        email = body.get("email")
        visitDateTime = body.get("visitDateTime")

        if not name or not email or not visitDateTime:
            return response(400, {"error": "Required fields are missing"})

        if not is_valid_email(email):
            return response(400, {"error": "invalid email address"})

        # Check if visit date is in the past
        bahrain_tz = timezone(timedelta(hours=3))
        visit_dt = datetime.fromisoformat(visitDateTime)  # naive datetime
        visit_dt = visit_dt.replace(tzinfo=bahrain_tz)    # now it is zone aware
        now_bahrain = datetime.now(bahrain_tz)
       
        if visit_dt < now_bahrain:
            return response(400, {"error": "Visit date scheduled is invalid"})
        formatted_visit_dt = visit_dt.strftime("%A, %B %d, %Y at %I:%M %p") 
        visit_date = visit_dt.date().isoformat()  # YYYY-MM-DD
        visit_time = visit_dt.strftime("%H:%M")  # e.g., "10:30"

        #Does teh visitor have a duplicate invitation in the same day
        if is_duplicate_visit(email, visit_date):
            return response(409, {"error": "This visitor is already registered for this date."
            })
        print("is duplicate function was executed. no duplicate")

        # generate unique ID
        visitorId  = str(uuid.uuid4())
        # Insert into DynamoDB
        InviteTable.put_item(
            Item={
                "visitorId": visitorId ,
                "name": name,
                "email": email,
                "visitDate": visit_date,
                "visitTime": visit_time,
                "status": "invited",
                "createdAt": now_bahrain.isoformat()
            }
        )
        print("DynamoDB put successflly")

        # Count today's invitations
        today_date = now_bahrain.date().isoformat()
        total_today_invitations = count_today_invitations(today_date)

        # Prepare dashboard payload
        to_dashboard = {
            "card": "today_invitations",
            "data": {
                "total": total_today_invitations
            }
        }

        # Invoke the broadcast Lambda asynchronously
        lambda_client.invoke(
            FunctionName=BROADCAST_LAMBDA,
            InvocationType="Event",  # async
            Payload=json.dumps(to_dashboard)
        )

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
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
        }}
        .container {{
            max-width: 600px;
            margin: 40px auto;
            padding: 25px;
            border-radius: 10px;
            background-color: #ffffff;
            box-shadow: 0 4px 8px rgba(0,0,0,0.05);
            border: 1px solid #e0e0e0;
        }}
        h2 {{
            color: #333333;
            text-align: center;
        }}
        .btn {{
            display: inline-block;
            padding: 14px 24px;
            margin-top: 20px;
            font-size: 16px;
            color: #ffffff;
            background-color: #ff7614; /* platform orange */
            text-decoration: none;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        p {{
            margin-bottom: 16px;
        }}
        .footer {{
            margin-top: 30px;
            font-size: 12px;
            color: #777777;
            text-align: center;
        }}
        </style>
        </head>
        <body>
        <div class="container">

        <h2>Visitor Invitation</h2>

        <p>Dear {name},</p>

        <p>We are pleased to invite you to visit <strong>AWS</strong> on <strong>{formatted_visit_dt}</strong>.</p>

        <p>
        During this visit, we would like to introduce you to 
        <strong>BAHTWIN</strong>, a smart visitor management platform designed to enhance your experience by streamlining registration, reducing waiting times, and ensuring smooth entry.
        </p>

        <p>
        To familiarize yourself with the platform and explore the facility digitally, please access BAHTWIN using the link below:
        </p>

        <p style="text-align:center;">
        <a href="http://localhost:5173" class="btn" style="color:#ffffff;">Access BAHTWIN Platform</a>
        </p>

        <p class="footer">
        If you did not intend to visit AWS or received this email in error, please disregard this message.
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

def is_duplicate_visit(email, visit_date):
    response = InviteTable.query(
        IndexName='EmailVisitDateIndex',
        KeyConditionExpression=
            Key('email').eq(email) & Key('visitDate').eq(visit_date)
    )
    return len(response.get('Items', [])) > 0

def count_today_invitations(today_date):
    response = InviteTable.scan(
        FilterExpression=Key("visitDate").eq(today_date)
    )
    return response.get("Count", 0)

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
