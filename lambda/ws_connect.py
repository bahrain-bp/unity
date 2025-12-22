import os
import boto3

dynamodb = boto3.resource("dynamodb")
table_name = os.environ.get("TABLE_NAME")
table = dynamodb.Table(table_name)

def handler(event, context):
    print("Received event:", event)  # <--- this will show the full event
    connection_id = event.get("requestContext", {}).get("connectionId")
    print("Connection ID:", connection_id)

    if connection_id:
        table.put_item(Item={"ConnectionId": connection_id})
        print("Stored connection in DynamoDB")
        resp = table.get_item(Key={"ConnectionId": connection_id})
        print(f"Table ARN: {table.table_arn}")
        print("Stored item:", resp.get("Item"))

    else:
        print("No connection ID found!")

    return {"statusCode": 200, "body": "Connected."}
