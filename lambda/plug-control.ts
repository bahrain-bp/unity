import { APIGatewayProxyHandler } from "aws-lambda";
import {
  DynamoDBClient,
  QueryCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { jsonResponse } from "./http-response";
import { broadcastToAll } from "./ws-broadcast";

const ddb = new DynamoDBClient({});

const TABLE_NAME = process.env.PLUG_ACTIONS_TABLE!;
const VOICE_MONKEY_BASE_URL = process.env.VOICE_MONKEY_BASE_URL!;
const VOICE_MONKEY_TOKEN = process.env.VOICE_MONKEY_TOKEN!;
const COOLDOWN_SECONDS = parseInt(process.env.COOLDOWN_SECONDS || "30", 10);

// GSI name (add this index on the same table)
const PLUG_INDEX_NAME = process.env.PLUG_INDEX_NAME || "plug_id-ts-index";

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
      return jsonResponse(401, { message: "Unauthorized: no user id" });
    }

    // ────────────────────────────────
    // 2) Parse body: { plugId, state }
    // ────────────────────────────────
    if (!event.body) {
      return jsonResponse(400, { message: "Missing body" });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(event.body);
    } catch {
      return jsonResponse(400, { message: "Invalid JSON" });
    }

    const plugId = (parsed.plugId || "").toString();
    const state = (parsed.state || "").toString().toLowerCase(); // "on" | "off"

    if (!plugId || !["on", "off"].includes(state)) {
      return jsonResponse(400, {
        message:
          "Invalid payload. Expected { plugId: 'plug1'|'plug2', state: 'on'|'off' }",
      });
    }

    if (!PLUG_DEVICE_MAP[plugId]) {
      return jsonResponse(400, { message: `Unknown plugId: ${plugId}` });
    }

    const deviceId =
      state === "on"
        ? PLUG_DEVICE_MAP[plugId].on
        : PLUG_DEVICE_MAP[plugId].off;

    // ────────────────────────────────
    // 3) Cooldown: BOTH per-user AND per-plug
    // ────────────────────────────────
    const nowSeconds = Math.floor(Date.now() / 1000);

    // A) last action for this user (your existing behavior)
    const userQuery = new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "user_id = :u",
      ExpressionAttributeValues: {
        ":u": { S: userId },
      },
      Limit: 1,
      ScanIndexForward: false, // latest first
    });

    // B) last action for this plug (NEW via GSI)
    const plugQuery = new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: PLUG_INDEX_NAME, // GSI required
      KeyConditionExpression: "plug_id = :p",
      ExpressionAttributeValues: {
        ":p": { S: plugId },
      },
      Limit: 1,
      ScanIndexForward: false, // latest first
    });

    const [userRes, plugRes] = await Promise.all([
      ddb.send(userQuery),
      ddb.send(plugQuery),
    ]);

    const lastUserItem = userRes.Items?.[0];
    const lastPlugItem = plugRes.Items?.[0];

    const lastUserTs = lastUserItem?.ts?.N ? parseInt(lastUserItem.ts.N, 10) : 0;
    const lastPlugTs = lastPlugItem?.ts?.N ? parseInt(lastPlugItem.ts.N, 10) : 0;

    const userDiff = lastUserTs ? nowSeconds - lastUserTs : Number.POSITIVE_INFINITY;
    const plugDiff = lastPlugTs ? nowSeconds - lastPlugTs : Number.POSITIVE_INFINITY;

    const retryAfterUser =
      userDiff < COOLDOWN_SECONDS ? COOLDOWN_SECONDS - userDiff : 0;

    const retryAfterPlug =
      plugDiff < COOLDOWN_SECONDS ? COOLDOWN_SECONDS - plugDiff : 0;

    const retryAfter = Math.max(retryAfterUser, retryAfterPlug);

    if (retryAfter > 0) {
      const reason =
        retryAfterPlug > 0
          ? `Plug cooldown active. Please wait ${retryAfter} seconds.`
          : `User cooldown active. Please wait ${retryAfter} seconds.`;

      // Broadcast cooldown info (same structure you already use)
      try {
        await broadcastToAll({
          type: "plug_action",
          source: "plug-control",
          ts: nowSeconds,
          payload: {
            plugId,
            state, // requested state
            userId,
            cooldown: {
              active: true,
              retryAfter,
              // "nextAllowedAt" here is effectively the later of the two locks
              nextAllowedAt: nowSeconds + retryAfter,
              // optional extra detail (won't break existing clients)
              user: { active: retryAfterUser > 0, retryAfter: retryAfterUser },
              plug: { active: retryAfterPlug > 0, retryAfter: retryAfterPlug },
            },
            status: 429,
            message: reason,
          },
        });
      } catch (e) {
        console.error("WS broadcast (cooldown) failed:", e);
      }

      return jsonResponse(
        429,
        {
          message: reason,
          retryAfter,
          cooldown: {
            user: { active: retryAfterUser > 0, retryAfter: retryAfterUser },
            plug: { active: retryAfterPlug > 0, retryAfter: retryAfterPlug },
          },
        },
        { "Retry-After": retryAfter.toString() }
      );
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
      return jsonResponse(502, {
        message: "Failed to trigger Voice Monkey",
        status: vmRes.status,
        response: vmText,
      });
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
        vm_response: { S: vmText.slice(0, 500) },
      },
    });

    await ddb.send(put);

    const responseBody = {
      ok: true,
      plugId,
      state,
      vmResponse: vmText,
      nextAllowedAt: nowSeconds + COOLDOWN_SECONDS,
    };

    // ────────────────────────────────
    // 6) Broadcast successful action over WebSocket
    // ────────────────────────────────
    try {
      await broadcastToAll({
        type: "plug_action",
        source: "plug-control",
        ts: nowSeconds,
        payload: {
          plugId,
          state,
          userId,
          cooldown: {
            active: false,
            nextAllowedAt: nowSeconds + COOLDOWN_SECONDS,
          },
          status: 200,
          message: "Plug action accepted",
        },
      });
    } catch (e) {
      console.error("WS broadcast (success) failed:", e);
    }

    return jsonResponse(200, responseBody);
  } catch (err: any) {
    console.error("Unexpected error:", err);
    return jsonResponse(500, { message: "Internal server error" });
  }
};
