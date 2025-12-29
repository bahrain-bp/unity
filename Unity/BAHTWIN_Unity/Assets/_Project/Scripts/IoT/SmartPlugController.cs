using System;
using UnityEngine;
using TMPro;   // for TextMeshPro

[Serializable]
public class PlugStatePayload
{
    public string id;          // "plug1", "plug2"
    public string type;        // "plug"
    public string state;       // "on" / "off"
    public long updated_at;    // unix seconds
    public int status;         // HTTP status from backend
    public string message;     // optional error / info
    public int retryAfter;     // cooldown seconds (for 429)
}

public class SmartPlugController : MonoBehaviour
{
    [Header("Config")]
    public string deviceId = "plug1";
    public bool startsOn = false;
    public string plugDisplayName = "Plug 1";   // shown on label

    [Header("Visuals")]
    public Renderer targetRenderer;
    public Color onColor = Color.green;
    public Color offColor = Color.red;

    [Header("Label (optional)")]
    public TextMeshPro label;                  // drag your TextMeshPro here

    [Header("Interaction (Proximity + Key)")]
    public Transform player;                   // assign Main Camera / FPS Controller transform
    public float interactDistance = 2f;
    public KeyCode interactKey = KeyCode.F;
    public bool allowMouseClick = true;        // keep mouse click toggle too

    // --- state ---
    private bool isOn;
    private bool isBusy;

    // per-plug cooldown timer (seconds)
    private float localCooldownRemaining = 0f;

    private void Awake()
    {
        isOn = startsOn;
        ApplyVisualState();
    }

    private void Update()
    {
        // update label countdown if we are in cooldown
        if (localCooldownRemaining > 0f)
        {
            localCooldownRemaining -= Time.deltaTime;
            if (localCooldownRemaining < 0f)
                localCooldownRemaining = 0f;

            if (label != null)
            {
                int remaining = Mathf.CeilToInt(localCooldownRemaining);
                if (remaining > 0)
                {
                    label.text = $"{plugDisplayName} : COOLDOWN {remaining}s";
                }
                else
                {
                    // cooldown finished → restore normal label
                    ApplyVisualState();
                }
            }
        }

        // --- Proximity + F key interaction ---
        if (player != null && !isBusy && localCooldownRemaining <= 0f)
        {
            float distance = Vector3.Distance(player.position, transform.position);

            // optional: show hint when close
            if (label != null && distance <= interactDistance)
            {
                label.text = $"{plugDisplayName} : Press [F]";
            }
            else if (label != null && localCooldownRemaining <= 0f)
            {
                // if not close, keep normal state label
                label.text = $"{plugDisplayName} : {(isOn ? "ON" : "OFF")}";
            }

            if (distance <= interactDistance && Input.GetKeyDown(interactKey))
            {
                Debug.Log($"[SmartPlug] {interactKey} pressed near {deviceId}");
                OnClick();
            }
        }
    }

    // Call this from Button / OnMouseDown / Proximity Key
    public void OnClick()
    {
        if (isBusy) return;
        if (localCooldownRemaining > 0f) return;

        bool desired = !isOn;
        string desiredState = desired ? "on" : "off";

        isBusy = true;
        Debug.Log($"[SmartPlug] Toggle → deviceId={deviceId}, desired={desiredState}");

#if UNITY_WEBGL && !UNITY_EDITOR
        // Call the JS global function window.ToggleSmartPlug(deviceId, state)
        Application.ExternalCall("ToggleSmartPlug", deviceId, desiredState);
#else
        // In Editor / non-WebGL → just simulate backend
        SimulateBackendResponse(desiredState);
#endif
    }

    private void OnMouseDown()
    {
        if (!allowMouseClick) return;
        OnClick();
    }

    // JS will call this:
    // unityInstance.SendMessage("SmartPlug_<deviceId>", "OnDeviceStateJson", json)
    public void OnDeviceStateJson(string json)
    {
        Debug.Log($"[SmartPlug] OnDeviceStateJson({deviceId}) raw: {json}");

        PlugStatePayload payload;
        try
        {
            payload = JsonUtility.FromJson<PlugStatePayload>(json);
        }
        catch (Exception ex)
        {
            Debug.LogWarning("[SmartPlug] Failed to parse JSON: " + ex.Message);
            isBusy = false;
            return;
        }

        if (payload == null || string.IsNullOrEmpty(payload.id))
        {
            Debug.LogWarning("[SmartPlug] Invalid payload");
            isBusy = false;
            return;
        }

        if (!string.Equals(payload.id, deviceId, StringComparison.OrdinalIgnoreCase))
        {
            // Not for this plug
            isBusy = false;
            return;
        }

        // Handle cooldown / error
        if (payload.status != 200 && payload.status != 0)
        {
            Debug.LogWarning($"[SmartPlug] Backend status {payload.status}: {payload.message}");

            if (payload.status == 429 && payload.retryAfter > 0)
            {
                Debug.Log($"[SmartPlug] Cooldown, retry after {payload.retryAfter} seconds");

                // start per-plug countdown
                localCooldownRemaining = payload.retryAfter;

                if (label != null)
                {
                    label.text = $"{plugDisplayName} : COOLDOWN {payload.retryAfter}s";
                }
            }

            isBusy = false;
            return;
        }

        // Normal success
        bool newState = string.Equals(payload.state, "on", StringComparison.OrdinalIgnoreCase);

        isOn = newState;
        isBusy = false;
        localCooldownRemaining = 0f;   // clear cooldown on success
        ApplyVisualState();
    }

    private void ApplyVisualState()
    {
        if (targetRenderer != null)
        {
            var mat = targetRenderer.material;
            mat.color = isOn ? onColor : offColor;
        }

        if (label != null && localCooldownRemaining <= 0f)
        {
            // Only show ON/OFF when not in cooldown
            label.text = $"{plugDisplayName} : {(isOn ? "ON" : "OFF")}";
        }

        Debug.Log($"[SmartPlug] {deviceId} -> {(isOn ? "ON" : "OFF")}");
    }

    // Editor-only helper
    private void SimulateBackendResponse(string desiredState)
    {
        var payload = new PlugStatePayload
        {
            id = deviceId,
            type = "plug",
            state = desiredState,
            updated_at = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
            status = 200,
            message = "Simulated OK",
            retryAfter = 0
        };

        string json = JsonUtility.ToJson(payload);
        OnDeviceStateJson(json);
    }
}