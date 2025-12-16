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

        <h2>Visitor Feedback</h2>

        <p>Dear {name},</p>

        <p>
        Thank you for visiting <strong>AWS Bahrain</strong>. We truly appreciate your time and hope you had a pleasant experience.
        </p>

        <p>
        Your feedback is valuable to us and helps improve our services and visitor experience.
        </p>

        <p>
        Please click the button below to share your feedback. The link will remain valid for the next <strong>{JWT_EXP_DELTA_HOURS} hours</strong>.
        </p>

        <p style="text-align:center;">
        <a href="{feedback_link}" class="btn" style="color:#ffffff;">
        Leave Feedback
        </a>
        </p>

        <p class="footer">
        If you did not visit AWS Bahrain or received this email in error, please disregard this message.
        </p>

        <p class="footer">
        Thank you for your time.
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
