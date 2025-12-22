import boto3
import json
import urllib3

http = urllib3.PoolManager()

def send_response(event, context, status, data=None):
    response_url = event["ResponseURL"]
    response_body = {
        "Status": status,
        "Reason": f"See CloudWatch log: {context.log_stream_name}",
        "PhysicalResourceId": event.get("PhysicalResourceId", context.log_stream_name),
        "StackId": event["StackId"],
        "RequestId": event["RequestId"],
        "LogicalResourceId": event["LogicalResourceId"],
        "Data": data or {},
    }
    encoded_body = json.dumps(response_body).encode("utf-8")
    headers = {"Content-Type": "", "Content-Length": str(len(encoded_body))}
    try:
        http.request("PUT", response_url, body=encoded_body, headers=headers)
    except Exception as e:
        print("send_response failed:", e)

def handler(event, context):
    iot = boto3.client("iot")
    secretsmanager = boto3.client("secretsmanager")

    try:
        if event["RequestType"] == "Delete":
            send_response(event, context, "SUCCESS")
            return

        props = event["ResourceProperties"]
        secret_name = props["SecretName"]
        thing_name = props["ThingName"]
        policy_name = props["PolicyName"]

        # 1️⃣ Create IoT Thing
        iot.create_thing(thingName=thing_name)

        # 2️⃣ Create Keys & Certificate
        cert = iot.create_keys_and_certificate(setAsActive=True)
        certificate_arn = cert["certificateArn"]
        certificate_id = cert["certificateId"]
        certificate_pem = cert["certificatePem"]
        private_key = cert["keyPair"]["PrivateKey"]

        # 3️⃣ Create Policy if not exists
        try:
            iot.describe_policy(policyName=policy_name)
        except iot.exceptions.ResourceNotFoundException:
            iot.create_policy(
                policyName=policy_name,
                policyDocument=json.dumps({
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Effect": "Allow",
                            "Action": ["iot:*"],
                            "Resource": ["*"]
                        }
                    ]
                })
            )

        # 4️⃣ Attach Policy & Certificate to Thing
        iot.attach_policy(policyName=policy_name, target=certificate_arn)
        iot.attach_thing_principal(thingName=thing_name, principal=certificate_arn)

        # 5️⃣ Store in Secrets Manager
        secretsmanager.create_secret(
            Name=secret_name,
            SecretString=json.dumps({
                "certificatePem": certificate_pem,
                "privateKey": private_key,
                "certificateArn": certificate_arn,
                "certificateId": certificate_id,
                "thingName": thing_name,
                "policyName": policy_name
            })
        )

        send_response(event, context, "SUCCESS", {
            "certificateArn": certificate_arn,
            "certificateId": certificate_id,
            "thingName": thing_name,
            "policyName": policy_name
        })

    except Exception as e:
        print("Error:", e)
        send_response(event, context, "FAILED", {"Message": str(e)})
