import boto3
import os
import json

lambda_client = boto3.client("lambda")
BROADCAST_LAMBDA = os.environ["BROADCAST_LAMBDA"]

def handler(event, context):
    print("Received IoT event:", event)

    lambda_client.invoke(
        FunctionName=BROADCAST_LAMBDA,
        InvocationType="Event",  # async
        Payload=json.dumps(event).encode("utf-8")
    )

    return {"status": "sent to broadcast"}
