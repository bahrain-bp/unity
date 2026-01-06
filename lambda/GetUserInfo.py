import json
import boto3
import os

dynamodb = boto3.resource("dynamodb")
s3 = boto3.client("s3")

USER_TABLE_NAME = os.environ["USER_TABLE"]
USER_TABLE = dynamodb.Table(USER_TABLE_NAME)
BUCKET_NAME = os.environ.get("BUCKET_NAME")


def handler(event, context):
    try:
        # Safely extract userId
        params = event.get("queryStringParameters") or {}
        user_id = params.get("userId")

        if not user_id:
            return response(400, {"error": "Missing userId"})

        # Fetch user from DynamoDB
        response_db = USER_TABLE.get_item(
            Key={"userId": user_id}
        )

        if "Item" not in response_db:
            return response(404, {"error": "User not found"})

        item = response_db["Item"]

        # Generate presigned image URL if available
        s3_key = item.get("s3Key")
        image_url = None
        print(s3_key)

        if s3_key and BUCKET_NAME:
            image_url = s3.generate_presigned_url(
                "get_object",
                Params={
                    "Bucket": BUCKET_NAME,
                    "Key": s3_key
                },
                ExpiresIn=300,
            )

        result = {
            "name": item.get("name"),
            "email": item.get("email"),
            "imageUrl": image_url,
        }

        return response(200, result)

    except Exception as e:
        return response(500, {"error": str(e)})


def response(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
            "Access-Control-Allow-Headers": (
                "Content-Type,"
                "X-Amz-Date,"
                "Authorization,"
                "X-Api-Key,"
                "X-Amz-Security-Token"
            ),
        },
        "body": json.dumps(body),
    }
