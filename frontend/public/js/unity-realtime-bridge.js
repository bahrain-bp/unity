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

function setupWebSocket(unityInstance) {
  wsUnityInstance = unityInstance;

  if (ws && wsReady) return;

  console.log("[WS] Connecting:", WS_URL);
  wsDebug("Connecting...");

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    wsReady = true;
    console.log("[WS] connected");
    wsDebug("Connected ✔");

    try {
      ws.send(JSON.stringify({
        type: "hello",
        client: "unity",
        ts: Math.floor(Date.now() / 1000)
      }));
    } catch {}
  };

  ws.onclose = (e) => {
    console.warn("[WS] closed:", e.code, e.reason);
    wsDebug("Closed ❌  Retrying...");
    wsReady = false;
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
    wsDebug("Error: " + err.message);
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
      return;
    }

    if (msg.type === "plug_update") {
      const payload = msg.payload;
      const targetObj = `SmartPlug_${payload.id}`;

      console.log("[WS] Plug update → Unity:", payload);

      wsUnityInstance?.SendMessage(
        targetObj,
        "OnDeviceStateJson",
        JSON.stringify(payload)
      );
    }
  };
}

// ------------------------------------------------
// Unity → Backend HTTP (toggle plug)
// ------------------------------------------------
window.initSmartPlugBridge = function (unityInstance) {
  console.log("[JS] Initializing Unity Realtime Bridge…");
  setupWebSocket(unityInstance);

  window.ToggleSmartPlug = async function (deviceId, state) {
    console.log("[JS] ToggleSmartPlug:", { deviceId, state });

    const token = getIdToken();
    const targetObject = `SmartPlug_${deviceId}`;

    if (!token) {
      const errorPayload = {
        id: deviceId,
        type: "plug",
        state,
        updated_at: Date.now() / 1000,
        status: 401,
        message: "Not authenticated",
      };

      unityInstance.SendMessage(
        targetObject,
        "OnDeviceStateJson",
        JSON.stringify(errorPayload)
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

    const payload = {
      id: deviceId,
      type: "plug",
      state: body.state || state,
      updated_at: Math.floor(Date.now() / 1000),
      status: res.status,
      message: body.message || "",
      retryAfter: body.retryAfter || 0,
    };

    unityInstance.SendMessage(
      targetObject,
      "OnDeviceStateJson",
      JSON.stringify(payload)
    );
  };

  console.log("[JS] Unity Realtime Bridge Ready");
};
