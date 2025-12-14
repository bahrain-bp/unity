import boto3
import os
import json
import random

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['TABLE_NAME'])

def handler(event, context):

    # Determine if this is an IoT shadow update
    if "state" in event and "reported" in event["state"]:
        # Extract LED color and status
        reported = event["state"]["reported"]
        # Assuming only one key-value pair in reported
        color, status = list(reported.items())[0]
        message = {
            "device": "LED",
            "color": color,
            "status": status
        }
    else:
        # Default behavior → broadcast fake temperature/humidity
        message = {
            "temperature": round(random.uniform(20, 35), 2),
            "humidity": random.randint(40, 80),
        }

    # WebSocket Management API
    apigw = boto3.client(
        'apigatewaymanagementapi',
        endpoint_url=os.environ['WS_ENDPOINT']
    )

    # Get all connected clients
    connections = table.scan().get('Items', [])

    for item in connections:
        connection_id = item["ConnectionId"]
        try:
            apigw.post_to_connection(
                ConnectionId=connection_id,
                Data=json.dumps(message).encode("utf-8")
            )
        except apigw.exceptions.GoneException:
            # client disconnected → remove from DynamoDB
            table.delete_item(Key={"ConnectionId": connection_id})

    return {"statusCode": 200}
