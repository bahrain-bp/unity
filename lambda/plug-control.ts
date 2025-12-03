import { APIGatewayProxyHandler } from "aws-lambda";
import {
  DynamoDBClient,
  QueryCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";

const ddb = new DynamoDBClient({});

const TABLE_NAME = process.env.PLUG_ACTIONS_TABLE!;
const VOICE_MONKEY_BASE_URL = process.env.VOICE_MONKEY_BASE_URL!;
const VOICE_MONKEY_TOKEN = process.env.VOICE_MONKEY_TOKEN!;
const COOLDOWN_SECONDS = parseInt(process.env.COOLDOWN_SECONDS || "30", 10);

type PlugDeviceMap = {
  [plugId: string]: { on: string; off: string };
};

const PLUG_DEVICE_MAP: PlugDeviceMap = JSON.parse(
  process.env.PLUG_DEVICE_MAP || "{}"
);

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    // ────────────────────────────────
    // 1) Extract user from Cognito
    // ────────────────────────────────
    const claims = (event.requestContext.authorizer as any)?.claims;
    const userId = claims?.sub as string | undefined;

    if (!userId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ message: "Unauthorized: no user id" }),
      };
    }

    // ────────────────────────────────
    // 2) Parse body: { plugId, state }
    // ────────────────────────────────
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Missing body" }),
      };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(event.body);
    } catch {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Invalid JSON" }),
      };
    }

    const plugId = (parsed.plugId || "").toString();
    const state = (parsed.state || "").toString().toLowerCase(); // "on" | "off"

    if (!plugId || !["on", "off"].includes(state)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message:
            "Invalid payload. Expected { plugId: 'plug1'|'plug2', state: 'on'|'off' }",
        }),
      };
    }

    if (!PLUG_DEVICE_MAP[plugId]) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: `Unknown plugId: ${plugId}` }),
      };
    }

    const deviceId =
      state === "on"
        ? PLUG_DEVICE_MAP[plugId].on
        : PLUG_DEVICE_MAP[plugId].off;

    // ────────────────────────────────
    // 3) Cooldown: check last action for this user
    // ────────────────────────────────
    const nowSeconds = Math.floor(Date.now() / 1000);

    const query = new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "user_id = :u",
      ExpressionAttributeValues: {
        ":u": { S: userId },
      },
      Limit: 1,
      ScanIndexForward: false, // latest first
    });

    const queryRes = await ddb.send(query);
    const lastItem = queryRes.Items?.[0];

    if (lastItem?.ts?.N) {
      const lastTs = parseInt(lastItem.ts.N, 10);
      const diff = nowSeconds - lastTs;

      if (diff < COOLDOWN_SECONDS) {
        const retryAfter = COOLDOWN_SECONDS - diff;
        return {
          statusCode: 429,
          headers: {
            "Retry-After": retryAfter.toString(),
          },
          body: JSON.stringify({
            message: `Cooldown active. Please wait ${retryAfter} seconds.`,
            retryAfter,
          }),
        };
      }
    }

    // ────────────────────────────────
    // 4) Call Voice Monkey
    // ────────────────────────────────
    const url = new URL(VOICE_MONKEY_BASE_URL);
    url.searchParams.set("token", VOICE_MONKEY_TOKEN);
    url.searchParams.set("device", deviceId);

    const vmRes = await fetch(url.toString(), {
      method: "GET",
    });

    const vmText = await vmRes.text();
    if (!vmRes.ok) {
      console.error("Voice Monkey error:", vmRes.status, vmText);
      return {
        statusCode: 502,
        body: JSON.stringify({
          message: "Failed to trigger Voice Monkey",
          status: vmRes.status,
          response: vmText,
        }),
      };
    }

    // ────────────────────────────────
    // 5) Log to DynamoDB
    // ────────────────────────────────
    const put = new PutItemCommand({
      TableName: TABLE_NAME,
      Item: {
        user_id: { S: userId },
        ts: { N: nowSeconds.toString() },
        plug_id: { S: plugId },
        action: { S: state },
        vm_device: { S: deviceId },
        vm_response: { S: vmText.slice(0, 500) }, // keep it short
      },
    });

    await ddb.send(put);

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        plugId,
        state,
        vmResponse: vmText,
        nextAllowedAt: nowSeconds + COOLDOWN_SECONDS,
      }),
    };
  } catch (err: any) {
    console.error("Unexpected error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
