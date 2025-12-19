import json
import boto3
import os

dynamodb = boto3.resource("dynamodb")
USER_TABLE_NAME = os.environ['USER_TABLE']
USER_TABLE = dynamodb.Table(USER_TABLE_NAME)

def handler(event, context):
    try:
        user_id = event["queryStringParameters"]["userId"]

        response = USER_TABLE.get_item(
            Key={"userId": user_id}
        )

        if "Item" not in response:
            return {
                "statusCode": 404,
                "body": json.dumps({"error": "User not found"})
            }

        item = response["Item"]
        # Only return name and email
        result = {
            "name": item.get("name"),
            "email": item.get("email")
        }

        return {
            "statusCode": 200,
            "body": json.dumps(result)
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }
