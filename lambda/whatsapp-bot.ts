import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const TABLE = process.env.TELEMETRY_TABLE!;

// WhatsApp Cloud API env
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN!; // Bearer token
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID!; // for /{id}/messages
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || ""; // for GET webhook verification

// Optional: only allow your number(s)
const ALLOWLIST_E164 = (process.env.ALLOWLIST_E164 || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function json(statusCode: number, body: any): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

function text(statusCode: number, body: string): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      "content-type": "text/plain",
      "cache-control": "no-store",
    },
    body,
  };
}

function normalizePath(event: APIGatewayProxyEvent): string {
  return (event.path || "").toLowerCase();
}

function normalizeText(s: string): string {
  return (s || "").trim().toLowerCase();
}

function toIsoFromSeconds(ts?: number): string | null {
  if (typeof ts !== "number") return null;
  return new Date(ts * 1000).toISOString();
}

/**
 * Parking scan (same concept as your Alexa lambda)
 */
async function scanLatestParkingSlots(maxScanItems = 5000) {
  const PAGE_LIMIT = 200;
  const MAX_SLOTS = 24;

  let lastKey: Record<string, any> | undefined = undefined;
  let scanned = 0;

  const latestByKey = new Map<string, any>(); // `${device}#${sensor_id}` -> newest

  do {
    const resp = await ddb.send(
      new ScanCommand({
        TableName: TABLE,
        ExclusiveStartKey: lastKey,
        Limit: PAGE_LIMIT,
        FilterExpression:
          "sensor_type = :u AND attribute_exists(device) AND attribute_exists(sensor_id) AND attribute_exists(ts)",
        ExpressionAttributeValues: { ":u": "ultrasonic" },
        ProjectionExpression: "device, ts, sensor_id, sensor_type, #st, #m",
        ExpressionAttributeNames: {
          "#st": "status",
          "#m": "metrics",
        },
      })
    );

    const items = (resp.Items || []) as any[];
    scanned += items.length;

    for (const x of items) {
      if (x?.sensor_type !== "ultrasonic") continue;

      const device = String(x?.device ?? "");
      const sensor_id = String(x?.sensor_id ?? "");
      const ts = typeof x?.ts === "number" ? x.ts : undefined;

      if (!device || !sensor_id || typeof ts !== "number") continue;

      const key = `${device}#${sensor_id}`;
      const prev = latestByKey.get(key);

      if (!prev || (typeof prev.ts === "number" && ts > prev.ts)) {
        latestByKey.set(key, x);
      }
    }

    if (latestByKey.size >= MAX_SLOTS) break;

    lastKey = resp.LastEvaluatedKey as any;
    if (scanned >= maxScanItems) break;
  } while (lastKey);

  const rows = Array.from(latestByKey.values()).map((hit) => {
    const m = hit.metrics || {};
    const distance_cm =
      typeof m.distance_cm === "number"
        ? m.distance_cm
        : typeof m.distance === "number"
        ? m.distance
        : null;

    return {
      device: String(hit.device ?? ""),
      sensor_id: String(hit.sensor_id ?? ""),
      status: String(hit.status ?? "unknown").toLowerCase(),
      distance_cm,
      ts: hit.ts,
      datetime: toIsoFromSeconds(hit.ts),
    };
  });

  rows.sort((a, b) => {
    const d = a.device.localeCompare(b.device);
    if (d !== 0) return d;
    return a.sensor_id.localeCompare(b.sensor_id);
  });

  return rows.map((r, idx) => ({
    slot: idx + 1,
    status: r.status,
    distance_cm: r.distance_cm,
    ts: r.ts,
    datetime: r.datetime,
  }));
}

function menuText() {
  return (
    `🚗 Parking Updates\n` +
    `Reply with:\n` +
    `1) List all slots\n` +
    `2) Empty slots\n` +
    `3) Occupied slots\n\n` +
    `Type "menu" anytime.`
  );
}

function formatAll(slots: Array<{ slot: number; status: string; distance_cm: number | null }>) {
  return (
    `All slots:\n` +
    slots
      .map((s) => {
        const d =
          typeof s.distance_cm === "number" ? ` (${Math.round(s.distance_cm)}cm)` : "";
        return `Slot ${s.slot}: ${s.status}${d}`;
      })
      .join("\n")
  );
}

function formatEmpty(slots: Array<{ slot: number; status: string }>) {
  const empties = slots.filter((s) => s.status === "empty" || s.status === "available");
  if (empties.length === 0) return "No empty slots right now.";
  return `Empty slots: ${empties.map((s) => `Slot ${s.slot}`).join(", ")}`;
}

function formatOccupied(slots: Array<{ slot: number; status: string }>) {
  const occ = slots.filter((s) => s.status === "occupied" || s.status === "busy");
  if (occ.length === 0) return "No occupied slots right now.";
  return `Occupied slots: ${occ.map((s) => `Slot ${s.slot}`).join(", ")}`;
}

/**
 * WhatsApp Cloud API: send text message
 * POST https://graph.facebook.com/v19.0/{PHONE_NUMBER_ID}/messages 
 */
async function sendWhatsAppText(toDigits: string, body: string) {
  const url = `https://graph.facebook.com/v22.0/${encodeURIComponent(PHONE_NUMBER_ID)}/messages`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toDigits,
      type: "text",
      text: { body },
    }),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    console.error("WhatsApp send failed", resp.status, data);
    throw new Error(`WhatsApp send failed: ${resp.status}`);
  }
  return data;
}

/**
 * Parse Meta webhook payload for inbound text
 */
function parseInbound(payload: any): { fromDigits: string; text: string } | null {
  const msg = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  const from = msg?.from; // usually digits like "9733xxxxxxx"
  const text = msg?.text?.body;
  if (!from || !text) return null;

  const fromDigits = String(from).replace(/[^\d]/g, "");
  return { fromDigits, text: String(text) };
}

function isAllowed(fromDigits: string): boolean {
  if (ALLOWLIST_E164.length === 0) return true;
  return ALLOWLIST_E164.some((x) => x.replace(/[^\d]/g, "") === fromDigits);
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const path = normalizePath(event);

    // ─────────────────────────────────────────
    // 1) Webhook verification (GET)
    // Meta sends hub.challenge; we must echo it back. 
    // ─────────────────────────────────────────
    if (event.httpMethod === "GET" && path.endsWith("/whatsapp/webhook")) {
      const qs = event.queryStringParameters ?? {};
      const mode = qs["hub.mode"];
      const token = qs["hub.verify_token"];
      const challenge = qs["hub.challenge"];

      if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
        return text(200, challenge);
      }
      return text(403, "Forbidden");
    }

    // ─────────────────────────────────────────
    // 2) Inbound message (POST)
    // ─────────────────────────────────────────
    if (event.httpMethod === "POST" && path.endsWith("/whatsapp/webhook")) {
      const raw =
        event.isBase64Encoded && event.body
          ? Buffer.from(event.body, "base64").toString("utf8")
          : event.body || "";

      if (!raw) return json(200, { ok: true });

      let payload: any;
      try {
        payload = JSON.parse(raw);
      } catch {
        return json(400, { error: "Invalid JSON" });
      }

      const inbound = parseInbound(payload);
      if (!inbound) return json(200, { ok: true });

      // Optional allowlist
      if (!isAllowed(inbound.fromDigits)) {
        await sendWhatsAppText(inbound.fromDigits, "Sorry, you are not allowed to use this bot.");
        return json(200, { ok: true });
      }

      const msg = normalizeText(inbound.text);

      // Menu
      if (!msg || msg === "hi" || msg === "hello" || msg === "menu" || msg === "start") {
        await sendWhatsAppText(inbound.fromDigits, menuText());
        return json(200, { ok: true });
      }

      // 1) List all
      if (msg === "1" || msg.includes("list")) {
        const slots = await scanLatestParkingSlots(5000);
        const reply = slots.length ? `${formatAll(slots)}\n\n${menuText()}` : `No parking readings found.\n\n${menuText()}`;
        await sendWhatsAppText(inbound.fromDigits, reply);
        return json(200, { ok: true });
      }

      // 2) Empty
      if (msg === "2" || msg.includes("empty") || msg.includes("available")) {
        const slots = await scanLatestParkingSlots(5000);
        const reply = slots.length ? `${formatEmpty(slots)}\n\n${menuText()}` : `No parking readings found.\n\n${menuText()}`;
        await sendWhatsAppText(inbound.fromDigits, reply);
        return json(200, { ok: true });
      }

      // 3) Occupied
      if (msg === "3" || msg.includes("occupied") || msg.includes("busy")) {
        const slots = await scanLatestParkingSlots(5000);
        const reply = slots.length ? `${formatOccupied(slots)}\n\n${menuText()}` : `No parking readings found.\n\n${menuText()}`;
        await sendWhatsAppText(inbound.fromDigits, reply);
        return json(200, { ok: true });
      }

      // Fallback
      await sendWhatsAppText(inbound.fromDigits, `I didn’t understand.\n\n${menuText()}`);
      return json(200, { ok: true });
    }

    return json(404, { error: "Unknown route", path: event.path });
  } catch (err: any) {
    console.error("whatsapp-bot error:", err);
    // Return 200 for webhook POST to avoid retries storm; but keep 500 for other routes
    return json(200, { ok: true });
  }
};
