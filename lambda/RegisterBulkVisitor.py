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
from datetime import datetime, timezone, timedelta

lambda_client = boto3.client("lambda")
BROADCAST_LAMBDA = os.environ["BROADCAST_LAMBDA"]
# Environment variables
GMAIL_USER = os.environ['GMAIL_USER']
GMAIL_PASS = os.environ['GMAIL_PASS']

WORKMAIL_USER = os.environ['WORKMAIL_USER']      
WORKMAIL_PASS = os.environ['WORKMAIL_PASS']    
WORKMAIL_SMTP = os.environ['WORKMAIL_SMTP'] 

InviteTableName = os.environ['InviteTable']
InviteTable = boto3.resource('dynamodb').Table(InviteTableName)

EMAIL_REGEX = r"[^@]+@[^@]+\.[^@]+"
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB max
REQUIRED_FIELDS = ["name", "email", "visitDate", "visitTime"]
BAHRAIN_TZ = timezone(timedelta(hours=3))

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

        validated_rows = []
        errors = []
        # PASS 1: VALIDATION ONLY
        for i, row in enumerate(reader, start=1):
            # Skip completely empty rows
            if not any(row.values()):
                continue
            try:
                # Check required fields
                for field in REQUIRED_FIELDS:
                    if not row.get(field) or not row.get(field).strip():
                        add_error(
                            errors,
                            i,
                            field,
                            f"{field} is missing",
                            "Please fill in this field"
                        )
                        break

                # Validate email
                email = row["email"].strip()
                if not re.match(EMAIL_REGEX, email):
                    add_error(
                        errors,
                        i,
                        "email",
                        "Email address format is invalid",
                        "Use format: example@domain.com"
                    )
                    continue
                
                # Validate time
                try:
                    visit_time_str = row["visitTime"].strip().upper().replace(" ", "")
                    visit_time = datetime.strptime(visit_time_str, "%I:%M%p").time()
                except ValueError:
                    add_error(
                        errors,
                        i,
                        "visitTime",
                        "Invalid time format",
                        "Use format: HH:MM AM/PM"
                    )
                    continue
                try:
                    visit_date = datetime.strptime(
                            row["visitDate"].strip(), "%m/%d/%Y"
                        ).date()
                except ValueError:
                    add_error(
                        errors,
                        i,
                        "visitDate",
                        "Invalid date format",
                        "Use format: MM/DD/YYYY"
                    )
                    continue
                visit_dt = datetime.combine(
                        visit_date, visit_time
                    ).replace(tzinfo=BAHRAIN_TZ)
                now_bahrain = datetime.now(BAHRAIN_TZ)
                if visit_dt < now_bahrain:
                        add_error(
                            errors,
                            i,
                            "visitDate",
                            "Visit date is in the past",
                            "Select a future date"
                        )
                        continue
                visit_date_iso = visit_dt.date().isoformat()
                if is_duplicate_visit(email, visit_date_iso):
                        add_error(
                            errors,
                            i,
                            "email",
                            "Visitor already registered for this date",
                            "Use a different date or email"
                        )
                        continue
                validated_rows.append({
                        "name": row["name"].strip(),
                        "email": email,
                        "visitDate": visit_date_iso,
                        "visitTime": visit_dt.strftime("%H:%M"),
                        "formatted_dt": visit_dt.strftime(
                            "%A, %B %d, %Y at %I:%M %p"
                        )
                    })
            except Exception as e:
                errors.append(str(e))
        if errors:
            return response(400, {
            "error": errors  # structured list of error dicts
    })
        
        # PASS 2: DYNAMODB WRITE
        now_bahrain = datetime.now(BAHRAIN_TZ)

        with InviteTable.batch_writer() as batch:
            for row in validated_rows:
                batch.put_item(
                    Item={
                        "visitorId": str(uuid.uuid4()),
                        "name": row["name"],
                        "email": row["email"],
                        "visitDate": row["visitDate"],
                        "visitTime": row["visitTime"],
                        "status": "invited",
                        "createdAt": now_bahrain.isoformat()
                    }
                )
            

        # Count today's invitations 
        # DASHBOARD UPDATE
        today_date = now_bahrain.date().isoformat()
        total_today_invitations = count_today_invitations(today_date)
        print(total_today_invitations)

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

        # PASS 3: SEND EMAILS
        for row in validated_rows:
            send_invitation_email(
                row["name"],
                row["email"],
                row["formatted_dt"]
            )
        return response(200, {
            "message": "All visitors registered and invitations sent successfully",
            "count": len(validated_rows)
        })

    except Exception as e:
        return response(500, {"error": str(e)})


def add_error(errors, row, field, message, hint=None):
    errors.append({
        "row": row,
        "field": field,
        "message": message,
        "hint": hint
    })


def is_duplicate_visit(email, visit_date):
    response = InviteTable.query(
        IndexName='EmailVisitDateIndex',
        KeyConditionExpression=Key('email').eq(email) & Key('visitDate').eq(visit_date)
    )
    return len(response.get('Items', [])) > 0


def send_invitation_email(name, email, formatted_visit_dt):
    try:
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
        <a href="https://d3pah2wsw5ry03.cloudfront.net/" class="btn" style="color:#ffffff;">Access BAHTWIN Platform</a>
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
        #msg['From'] = os.environ["WORKMAIL_USER"]
        msg['To'] = email

        # Send email via Gmail SMTP
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(GMAIL_USER, GMAIL_PASS)
            server.send_message(msg)
        #with smtplib.SMTP_SSL(
        #    os.environ["WORKMAIL_SMTP"], 465
        #) as server:
         #   server.login(
          #      os.environ["WORKMAIL_USER"],
           #     os.environ["WORKMAIL_PASS"]
            #)
            #server.send_message(msg)
        return True
    except Exception as e:
        print("Error sending email:", e)
        return False

def count_today_invitations(today_date):
    response = InviteTable.scan(
        FilterExpression=Key("visitDate").eq(today_date)
    )
    return response.get("Count", 0)

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
