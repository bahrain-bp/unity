console.log("[JS] Unity Realtime Bridge Loaded");

const API_BASE = "https://mixmh2ecul.execute-api.us-east-1.amazonaws.com/dev";
const PLUGS_ENDPOINT = `${API_BASE}/plugs`;
const WS_URL = "wss://x7zgvke8me.execute-api.us-east-1.amazonaws.com/dev";

// --------------------
// Debug Panel (Browser)
// --------------------
function createWsDebugPanel() {
  if (document.getElementById("ws-debug-log")) return;

  const box = document.createElement("div");
  box.id = "ws-debug-log";
  box.style.position = "fixed";
  box.style.bottom = "10px";
  box.style.right = "10px";
  box.style.width = "380px";
  box.style.height = "200px";
  box.style.overflowY = "auto";
  box.style.fontSize = "12px";
  box.style.background = "rgba(0,0,0,0.7)";
  box.style.color = "lime";
  box.style.padding = "10px";
  box.style.borderRadius = "6px";
  box.style.zIndex = "99999";
  box.style.fontFamily = "monospace";
  box.innerHTML = "<b>WebSocket Debug:</b><br/>";
  document.body.appendChild(box);
}

function wsDebug(text) {
  createWsDebugPanel();
  const box = document.getElementById("ws-debug-log");
  box.innerHTML += text + "<br/>";
  box.scrollTop = box.scrollHeight;
}

// ----------------------
// Auth helper
// ----------------------
function getIdToken() {
  const token =
    localStorage.getItem("idToken") ||
    sessionStorage.getItem("idToken") ||
    (window.afsAuth && window.afsAuth.idToken) ||
    null;

  console.log("[JS] getIdToken:", token ? token.slice(0, 20) + "..." : "null");
  return token;
}

// ----------------------
// WebSocket setup
// ----------------------
let ws = null;
let wsReady = false;
let wsUnityInstance = null;
let wsRetryTimer = null;

window.__SMART_PLUG_BRIDGE__ = window.__SMART_PLUG_BRIDGE__ || {
  inited: false,
  wsConnecting: false,
};

function safeNowSeconds() {
  return Math.floor(Date.now() / 1000);
}

/**
 * Unified sender: snapshot / plug_action / http all go through here.
 */
function sendPlugStateToUnity(raw, msgTs) {
  const id = raw?.id || raw?.plugId;
  if (!id) {
    console.warn("[Bridge] Missing id/plugId:", raw);
    return;
  }

  const normalized = {
    id,
    type: "plug",
    state: raw.state ?? "unknown",
    updated_at: msgTs || raw.updated_at || safeNowSeconds(),
    status: raw.status ?? 200,
    message: raw.message || "",
    retryAfter: raw.retryAfter || raw.cooldown?.retryAfter || 0,
  };

  const targetObj = `SmartPlug_${id}`;
  console.log("[Bridge] Plug → Unity:", normalized);

  try {
    wsUnityInstance?.SendMessage(
      targetObj,
      "OnDeviceStateJson",
      JSON.stringify(normalized)
    );
  } catch (e) {
    console.warn("[Bridge] SendMessage failed:", e);
  }
}

function sendTelemetryToUnity(payload, msgTs) {
  if (!payload) return;

  // Only handle your DHT11 env sensor (optional filter)
  if (payload.sensor_type !== "dht11") return;

  const tempC = payload.metrics?.temp_c;
  const humidity = payload.metrics?.humidity;

  // If metrics are missing, don't spam Unity
  if (tempC === undefined && humidity === undefined) return;

  const normalized = {
    device: payload.device || "unknown",
    sensor_id: payload.sensor_id || "unknown",
    sensor_type: payload.sensor_type || "unknown",
    temp_c: typeof tempC === "number" ? tempC : 0,
    humidity: typeof humidity === "number" ? humidity : 0,
    ts: msgTs || payload.ts || safeNowSeconds(),
    status: payload.status || "ok",
  };

  // ✅ IMPORTANT: this GameObject name must exist in Unity
  // Create an empty GameObject called EXACTLY: EnvSensor_UI
  const targetObj = "EnvSensor_UI";

  console.log("[Bridge] Telemetry → Unity:", normalized);

  try {
    wsUnityInstance?.SendMessage(
      targetObj,
      "OnTelemetryJson",
      JSON.stringify(normalized)
    );
  } catch (e) {
    console.warn("[Bridge] Telemetry SendMessage failed:", e);
  }
}

function sendDht11TelemetryToUnity(payload, msgTs) {
  if (!payload) return;

  // ✅ Only DHT11
  if (payload.sensor_type !== "dht11") return;

  const metrics = payload.metrics || {};
  const tempC = metrics.temp_c;
  const hum = metrics.humidity;

  // ✅ Only send if BOTH exist (you can relax this if you want)
  if (typeof tempC !== "number" || typeof hum !== "number") return;

  // ✅ Flatten metrics for your C# TelemetryMsg class
  const normalized = {
    device: payload.device || "",
    sensor_id: payload.sensor_id || "",
    sensor_type: payload.sensor_type || "dht11",
    temp_c: tempC,
    humidity: hum,
    ts: payload.ts || msgTs || safeNowSeconds(),
    status: payload.status || "ok",
  };

  // ✅ Choose the Unity GameObject name that has EnvTelemetryText attached
  // Change this to YOUR actual object name in Unity
  const targetObj = "EnvSensor_UI";

  console.log("[Bridge] DHT11 Telemetry → Unity:", normalized);

  try {
    wsUnityInstance?.SendMessage(
      targetObj,
      "OnTelemetryJson",
      JSON.stringify(normalized)
    );
  } catch (e) {
    console.warn("[Bridge] Telemetry SendMessage failed:", e);
  }
}


function setupWebSocket(unityInstance) {
  wsUnityInstance = unityInstance;

  if (ws && wsReady) {
    console.log("[WS] already connected");
    return;
  }

  if (window.__SMART_PLUG_BRIDGE__.wsConnecting) {
    console.log("[WS] connection already in progress");
    return;
  }
  window.__SMART_PLUG_BRIDGE__.wsConnecting = true;

  console.log("[WS] Connecting:", WS_URL);
  wsDebug("Connecting...");

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    wsReady = true;
    window.__SMART_PLUG_BRIDGE__.wsConnecting = false;

    console.log("[WS] connected");
    wsDebug("Connected ✔");

    // Send BOTH action + type (covers all API Gateway routing configs)
    const hello = {
      action: "hello",          // for routeSelectionExpression "$request.body.action"
      type: "hello",            
      client: "unity",
      requestSnapshot: true,    // tells ws-default to send plug_snapshot
      ts: safeNowSeconds(),
    };

    try {
      wsDebug("SEND: " + JSON.stringify(hello));
      ws.send(JSON.stringify(hello));
    } catch (e) {
      console.warn("[WS] hello send failed:", e);
    }
  };

  ws.onclose = (e) => {
    console.warn("[WS] closed:", e.code, e.reason);
    wsDebug("Closed ❌  Retrying...");
    wsReady = false;
    window.__SMART_PLUG_BRIDGE__.wsConnecting = false;
    ws = null;

    if (!wsRetryTimer) {
      wsRetryTimer = setTimeout(() => {
        wsRetryTimer = null;
        setupWebSocket(unityInstance);
      }, 3000);
    }
  };

  ws.onerror = (err) => {
    console.warn("[WS] error:", err);
    wsDebug("Error: " + (err?.message || "unknown"));
  };

  ws.onmessage = (event) => {
    wsDebug("MSG: " + event.data);

    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }

    if (msg.type === "telemetry") {
      console.log("[WS] Telemetry:", msg);

      // forward telemetry to Unity UI
      sendDht11TelemetryToUnity(msg.payload, msg.ts);

      return;
    }


    // Snapshot: { type:"plug_snapshot", payload:{ plugs:[...] } }
    if (msg.type === "plug_snapshot") {
      const plugs = Array.isArray(msg.payload?.plugs) ? msg.payload.plugs : [];
      console.log("[WS] plug_snapshot:", plugs);

      for (const p of plugs) {
        sendPlugStateToUnity(p, msg.ts);
      }
      return;
    }

    // Live updates: { type:"plug_action", payload:{ plugId, state, cooldown{...}, ... } }
    if (msg.type === "plug_action") {
      const p = msg.payload || {};
      sendPlugStateToUnity(
        {
          plugId: p.plugId,
          state: p.state,
          status: p.status,
          message: p.message,
          cooldown: p.cooldown,
          retryAfter: p.retryAfter,
        },
        msg.ts
      );
      return;
    }

    // compatibility
    if (msg.type === "plug_update") {
      const p = msg.payload || {};
      sendPlugStateToUnity(
        {
          id: p.id || p.plugId,
          state: p.state,
          status: p.status,
          message: p.message,
          cooldown: p.cooldown,
          retryAfter: p.retryAfter,
        },
        msg.ts
      );
      return;
    }
  };
}

// ------------------------------------------------
// Unity → Backend HTTP (toggle plug)
// ------------------------------------------------
window.initSmartPlugBridge = function (unityInstance) {
  if (window.__SMART_PLUG_BRIDGE__.inited) {
    console.warn("[JS] initSmartPlugBridge already called — reusing existing bridge");
    wsUnityInstance = unityInstance;
    setupWebSocket(unityInstance);
    return;
  }
  window.__SMART_PLUG_BRIDGE__.inited = true;

  console.log("[JS] Initializing Unity Realtime Bridge…");
  setupWebSocket(unityInstance);

  window.ToggleSmartPlug = async function (deviceId, state) {
    console.log("[JS] ToggleSmartPlug:", { deviceId, state });

    const token = getIdToken();
    if (!token) {
      sendPlugStateToUnity(
        {
          id: deviceId,
          state,
          status: 401,
          message: "Not authenticated",
          retryAfter: 0,
        },
        safeNowSeconds()
      );
      return;
    }

    let res, body;

    try {
      res = await fetch(PLUGS_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ plugId: deviceId, state }),
      });

      const text = await res.text();
      try {
        body = JSON.parse(text);
      } catch {
        body = { raw: text };
      }
    } catch (e) {
      body = { message: String(e) };
      res = { status: 0 };
    }

    sendPlugStateToUnity(
      {
        id: deviceId,
        state: body?.state || state,
        status: res.status,
        message: body?.message || "",
        retryAfter: body?.retryAfter || body?.cooldown?.retryAfter || 0,
      },
      safeNowSeconds()
    );
  };

  console.log("[JS] Unity Realtime Bridge Ready");
};
