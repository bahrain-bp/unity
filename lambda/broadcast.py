import boto3
import os
import json

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['TABLE_NAME'])

def handler(event, context):

    message = json.loads(event.get('body', json.dumps(event)))
    print(message)
    card_type = message.get("card")
    card_data = message.get("data")

    if card_type == "visitor_checkin":
        broadcast_message  = {
        "card": card_type,
        "data": card_data
    }
    elif card_type == "total_bahtwin_visitors":
        broadcast_message  = {
        "card": card_type,
        "data": card_data
    }
    elif card_type == "visitor_comment":
        print(card_data)
        broadcast_message  = {
        "card": card_type,
        "data": card_data
    }
    elif card_type == "avg_feedback_score":
        print(card_data)
        broadcast_message  = {
        "card": card_type,
        "data": card_data
    }
    elif card_type == "active_sessions":
        print(card_data)
        broadcast_message  = {
        "card": card_type,
        "data": card_data
    }
    elif card_type == "today_invitations":
        print(card_data)
        broadcast_message  = {
        "card": card_type,
        "data": card_data
    }
    elif card_type == "active_users_now":
        print(card_data)
        broadcast_message  = {
        "card": card_type,
        "data": card_data
    }
    elif card_type =="users_today":
        print(card_data)
        broadcast_message  = {
        "card": card_type,
        "data": card_data
    }
    elif card_type =="users_last_6_hours":
        print(card_data)
        broadcast_message  = {
        "card": card_type,
        "data": card_data
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
                Data=json.dumps(broadcast_message).encode("utf-8")
            )
        except apigw.exceptions.GoneException:
            # client disconnected → remove from DynamoDB
            table.delete_item(Key={"ConnectionId": connection_id})

    return {"statusCode": 200}
