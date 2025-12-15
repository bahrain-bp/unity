import os
import json
import smtplib
from email.mime.text import MIMEText
import jwt
from datetime import datetime, timedelta
import secrets

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = 'HS256'
JWT_EXP_DELTA_HOURS = 24
FRONTEND_URL = os.environ['FRONTEND_URL']  # e.g., https://yourdomain.com/feedback
GMAIL_USER = os.environ['GMAIL_USER']      # Your Gmail address
GMAIL_PASS = os.environ['GMAIL_PASS']      # Gmail app password

def handler(event, context):
    try:
        visitor_id = event['visitorId']
        email = event['email']
        name = event['name']

        # Generate JWT token
        token_payload = {
            "visitorId": visitor_id,
            "exp": datetime.utcnow() + timedelta(hours=JWT_EXP_DELTA_HOURS),
            "iat": datetime.utcnow(),
            "nonce": secrets.token_hex(8)  # random 16-character string
        }
        token = jwt.encode(token_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

        # Construct feedback link
        feedback_link = f"{FRONTEND_URL}?token={token}"

        # Prepare email
        subject = "We value your feedback!"
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
  <p>Hi {name},</p>

  <p>Thank you for visiting <strong>AWS Bahrain</strong>! We truly appreciate your time and would love to hear about your experience.</p>

  <p>Your feedback helps us improve our services and ensures that future visitors have an even better experience.</p>

  <p>Please click the button below to provide your feedback. The link is valid for the next {JWT_EXP_DELTA_HOURS} hours:</p>

  <a href="{feedback_link}" class="btn">Leave Feedback</a>

  <p class="footer">
    If you did not visit <strong>AWS Bahrain</strong> or received this email by mistake, please ignore this message.
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

        print("Email sent to:", email)
        return {
            "statusCode": 200,
            "body": json.dumps({"message": "Email sent successfully"})
        }

    except Exception as e:
        print("Error sending email:", e)
        return {
            "statusCode": 500,
            "body": json.dumps({"error": "Failed to send email"})
        }
