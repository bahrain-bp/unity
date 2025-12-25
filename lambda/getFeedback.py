import json
import os
import boto3
from decimal import Decimal

dynamodb = boto3.resource("dynamodb")
TABLE_NAME = os.environ["FEEDBACK_TABLE"]
table = dynamodb.Table(TABLE_NAME)

# Helper to convert Decimal -> int
def decimal_to_int(obj):
    if isinstance(obj, Decimal):
        return int(obj)
    raise TypeError

def handler(event, context):
    try:
        response = table.scan()
        items = response.get("Items", [])
        print(items)
        print(json.dumps(items, default=decimal_to_int))

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"  # allow frontend calls
            },
            "body": json.dumps(items, default=decimal_to_int)  # convert all Decimals to int
        }

    except Exception as e:
        print("Error fetching feedbacks:", str(e))
        return {
            "statusCode": 500,
            "body": json.dumps({"message": "Failed to fetch feedbacks"})
        }
