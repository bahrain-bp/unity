import boto3
import os
import json

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['TABLE_NAME'])

VALID_CARDS = {
    "visitor_checkin",
    "total_bahtwin_visitors",
    "visitor_comment",
    "avg_feedback_score",
    "today_invitations",
    "active_users_now",
    "users_today",
    "users_last_6_hours",
}

def handler(event, context):
    message = json.loads(event.get('body', json.dumps(event)))
    print(message)

    card_type = message.get("card")
    card_data = message.get("data")

    if card_type in VALID_CARDS:
        print(card_data)
        broadcast_message = {
            "card": card_type,
            "data": card_data
        }
    else:
        # Optional: ignore unknown cards
        return {"statusCode": 400, "body": "Invalid card type"}

    # WebSocket Management API
    apigw = boto3.client(
        'apigatewaymanagementapi',
        endpoint_url=os.environ['WS_ENDPOINT']
    )

    connections = table.scan().get('Items', [])

    for item in connections:
        connection_id = item["ConnectionId"]
        try:
            apigw.post_to_connection(
                ConnectionId=connection_id,
                Data=json.dumps(broadcast_message).encode("utf-8")
            )
        except apigw.exceptions.GoneException:
            table.delete_item(Key={"ConnectionId": connection_id})

    return {"statusCode": 200}
