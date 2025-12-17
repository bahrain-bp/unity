import os
import boto3

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ.get("TABLE_NAME", "ConnectionTable"))

def handler(event, context):
    connection_id = event["requestContext"]["connectionId"]

    # delete the connection
    table.delete_item(Key={"ConnectionId": connection_id})

    return {
        "statusCode": 200,
        "body": "Disconnected."
    }
