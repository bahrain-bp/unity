console.log("[JS] Unity Realtime Bridge Loaded");

const API_BASE = "https://mixmh2ecul.execute-api.us-east-1.amazonaws.com/dev";
const PLUGS_ENDPOINT = `${API_BASE}/plugs`;
const WS_URL = "wss://x7zgvke8me.execute-api.us-east-1.amazonaws.com/dev";

// Show debug panel only on localhost (change if you want)
// const DEBUG = location.hostname === "localhost" || location.hostname === "127.0.0.1";
const DEBUG = false;

// --------------------
// Debug Panel (Browser)
// --------------------
function createWsDebugPanel() {
  if (!DEBUG) return;
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
  if (!DEBUG) return;
  createWsDebugPanel();
  const box = document.getElementById("ws-debug-log");
  if (!box) return;
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
// Frontend event dispatcher (React pages can listen to this)
// ----------------------
function dispatchToFrontend(type, payload, ts) {
  window.dispatchEvent(
    new CustomEvent("realtime-message", {
      detail: { type, payload, ts: ts || safeNowSeconds() },
    })
  );
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
  autoStarted: false,
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

/**
 * DHT11 telemetry → Unity
 */
function sendDht11TelemetryToUnity(payload, msgTs) {
  if (!payload) return;

  // Only DHT11
  if (payload.sensor_type !== "dht11") return;

  const metrics = payload.metrics || {};
  const tempC = metrics.temp_c;
  const hum = metrics.humidity;

  // Only send if BOTH exist (relax if you want)
  if (typeof tempC !== "number" || typeof hum !== "number") return;

  const normalized = {
    device: payload.device || "",
    sensor_id: payload.sensor_id || "",
    sensor_type: payload.sensor_type || "dht11",
    temp_c: tempC,
    humidity: hum,
    ts: payload.ts || msgTs || safeNowSeconds(),
    status: payload.status || "ok",
  };

  // GameObject in Unity must exist
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

/**
 * Connect WS even if Unity isn't open.
 * Unity can attach later via initSmartPlugBridge.
 */
function setupWebSocket(unityInstance) {
  // Keep latest unity instance (can be null)
  wsUnityInstance = unityInstance || wsUnityInstance;

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
      action: "hello", // for routeSelectionExpression "$request.body.action"
      type: "hello",
      client: "frontend", // not only unity now
      requestSnapshot: true,
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
        // reconnect using latest global unity instance
        setupWebSocket(wsUnityInstance);
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

    // Always dispatch for frontend pages
    if (msg?.type) {
      dispatchToFrontend(msg.type, msg.payload, msg.ts);
    }

    // Telemetry: { type:"telemetry", payload:{...}, ts }
    if (msg.type === "telemetry") {
      console.log("[WS] Telemetry:", msg);

      // forward telemetry to Unity UI (if Unity attached)
      sendDht11TelemetryToUnity(msg.payload, msg.ts);
      sendPirOccupancyToUnity(msg.payload, msg.ts);

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
// Auto-start WS on page load (so normal React pages work)
// ------------------------------------------------
(function autoStart() {
  if (window.__SMART_PLUG_BRIDGE__.autoStarted) return;
  window.__SMART_PLUG_BRIDGE__.autoStarted = true;

  console.log("[JS] Auto-starting WebSocket bridge (no Unity required)...");
  setupWebSocket(null);
})();

// ------------------------------------------------
// Unity → Backend HTTP (toggle plug)
// ------------------------------------------------
window.initSmartPlugBridge = function (unityInstance) {
  if (window.__SMART_PLUG_BRIDGE__.inited) {
    console.warn("[JS] initSmartPlugBridge already called — attaching Unity instance");
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


/**
 * PIR occupancy telemetry → Unity
 * Expects payload like:
 * { sensor_type:"pir", attrs:{ room_status:"OCCUPIED" } }
 */
function sendPirOccupancyToUnity(payload, msgTs) {
  if (!payload) return;

  // Only PIR
  if (payload.sensor_type !== "pir") return;

  const roomStatus = payload.attrs?.room_status;
  if (typeof roomStatus !== "string" || roomStatus.length === 0) return;

  const normalized = {
    device: payload.device || "",
    sensor_id: payload.sensor_id || "",
    sensor_type: payload.sensor_type || "pir",
    state: roomStatus, // "OCCUPIED" / "EMPTY"
    ts: payload.ts || msgTs || safeNowSeconds(),
    status: payload.status || "ok",
  };

  // GameObject in Unity must exist (choose your name)
  const targetObj = "Occupancy_UI";

  console.log("[Bridge] PIR Occupancy → Unity:", normalized);

  try {
    wsUnityInstance?.SendMessage(
      targetObj,
      "OnOccupancyJson",
      JSON.stringify(normalized)
    );
  } catch (e) {
    console.warn("[Bridge] PIR SendMessage failed:", e);
  }
}
