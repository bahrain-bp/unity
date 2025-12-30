console.log("[JS] SmartPlug Bridge Loaded");

const API_BASE = "https://mixmh2ecul.execute-api.us-east-1.amazonaws.com/dev";
const PLUGS_ENDPOINT = `${API_BASE}/plugs`;

// 🔹 global cooldown in JS (unix seconds)
let globalCooldownUntil = 0;

// Adjust token retrieval as needed
function getIdToken() {
  const token =
    localStorage.getItem("idToken") ||
    sessionStorage.getItem("idToken") ||
    (window.afsAuth && window.afsAuth.idToken) ||
    null;

  console.log("[JS] getIdToken:", token ? token.slice(0, 20) + "..." : "null");
  return token;
}

// Call this AFTER unityInstance is ready
window.initSmartPlugBridge = function (unityInstance) {
  console.log("[JS] Initializing SmartPlug Bridge…");

  window.ToggleSmartPlug = async function (deviceId, state) {
    console.log("[JS] ToggleSmartPlug called:", { deviceId, state });

    const token = getIdToken();
    const targetObject = `SmartPlug_${deviceId}`;
    const nowSec = Math.floor(Date.now() / 1000);

    // 🔹 If we're in cooldown, don't call the API.
    if (nowSec < globalCooldownUntil) {
      const remaining = globalCooldownUntil - nowSec;
      console.log(
        "[JS] Global cooldown active, skipping HTTP call. Remaining:",
        remaining,
        "s"
      );

      const cooldownPayload = {
        id: deviceId,
        type: "plug",
        state, // Unity will ignore state when status != 200
        updated_at: nowSec,
        status: 429,
        message: `Cooldown active. Please wait ${remaining} seconds.`,
        retryAfter: remaining,
      };

      unityInstance.SendMessage(
        targetObject,
        "OnDeviceStateJson",
        JSON.stringify(cooldownPayload)
      );
      return;
    }

    if (!token) {
      const errorPayload = {
        id: deviceId,
        type: "plug",
        state,
        updated_at: nowSec,
        status: 401,
        message: "Not authenticated",
        retryAfter: 0,
      };
      unityInstance.SendMessage(
        targetObject,
        "OnDeviceStateJson",
        JSON.stringify(errorPayload)
      );
      return;
    }

    let res, text, body;
    try {
      res = await fetch(PLUGS_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ plugId: deviceId, state }),
      });

      text = await res.text();
      try {
        body = JSON.parse(text);
      } catch {
        body = { raw: text };
      }
    } catch (err) {
      body = { message: String(err) };
      // fake a "network error" status
      res = { status: 0 };
    }

    // 🔹 If backend returns 429, set global cooldown so we don't spam it.
    if (res.status === 429 && body.retryAfter) {
      globalCooldownUntil = nowSec + body.retryAfter;
      console.log(
        "[JS] Backend cooldown started, globalCooldownUntil =",
        globalCooldownUntil,
        "(+" + body.retryAfter + "s)"
      );
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

  console.log("[JS] SmartPlug Bridge OK");
};
