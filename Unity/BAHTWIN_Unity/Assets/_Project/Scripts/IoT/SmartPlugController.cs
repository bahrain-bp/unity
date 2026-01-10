using System;
using UnityEngine;
using TMPro;
using UnityEngine.InputSystem;

[Serializable]
public class PlugStatePayload
{
    public string id;
    public string type;
    public string state;
    public long updated_at;
    public int status;
    public string message;
    public int retryAfter;
}

[RequireComponent(typeof(Collider))]
public class SmartPlugController : MonoBehaviour
{
    [Header("Config")]
    public string deviceId = "plug1";
    public bool startsOn = false;
    public string plugDisplayName = "Plug 1";

    [Header("Visuals")]
    public Renderer targetRenderer;
    public Color onColor = Color.green;
    public Color offColor = Color.red;

    [Header("Label (optional)")]
    public TextMeshPro label;

    [Header("Interaction (Trigger + Interact Action)")]
    public string playerTag = "Player";
    public InputActionReference interactAction;
    public bool allowMouseClick = true;

    // --- state ---
    private bool isOn;
    private bool isBusy;

    // backend cooldown remaining (seconds)
    private float cooldownRemaining = 0f;

    // trigger state
    private bool playerInRange;

    // Prevent duplicate click in same frame (e.g., OnMouseDown + Interact)
    private int lastClickFrame = -1;

    private void Awake()
    {
        isOn = startsOn;
        ApplyVisualState();

        var col = GetComponent<Collider>();
        if (col != null && !col.isTrigger) col.isTrigger = true;
    }

    private void OnEnable()
    {
        if (interactAction != null) interactAction.action.Enable();
    }

    private void OnDisable()
    {
        if (interactAction != null) interactAction.action.Disable();
    }

    private void Update()
    {
        // Tick cooldown timer (only from backend)
        if (cooldownRemaining > 0f)
        {
            cooldownRemaining -= Time.deltaTime;
            if (cooldownRemaining < 0f) cooldownRemaining = 0f;

            if (label != null)
            {
                int remaining = Mathf.CeilToInt(cooldownRemaining);
                if (remaining > 0) label.text = $"{plugDisplayName} : COOLDOWN {remaining}s";
                else ApplyVisualState();
            }

            // During cooldown, no interaction
            return;
        }

        // If busy, keep showing "TOGGLING..." and block input
        if (isBusy)
        {
            if (label != null) label.text = $"{plugDisplayName} : TOGGLING...";
            return;
        }

        // Normal idle label
        if (label != null)
        {
            label.text = playerInRange
                ? $"{plugDisplayName} : Press [F]"
                : $"{plugDisplayName} : {(isOn ? "ON" : "OFF")}";
        }

        // Press F while in range
        if (playerInRange && interactAction != null && interactAction.action.WasPressedThisFrame())
        {
            TryToggleFromUser();
        }
    }

    private void OnTriggerEnter(Collider other)
    {
        if (other.CompareTag(playerTag)) playerInRange = true;
    }

    private void OnTriggerExit(Collider other)
    {
        if (other.CompareTag(playerTag)) playerInRange = false;
    }

    private void OnMouseDown()
    {
        if (!allowMouseClick) return;
        TryToggleFromUser();
    }

    private void TryToggleFromUser()
    {
        // Avoid double-fire same frame
        if (Time.frameCount == lastClickFrame) return;
        lastClickFrame = Time.frameCount;

        if (isBusy) return;
        if (cooldownRemaining > 0f) return;

        bool desired = !isOn;
        string desiredState = desired ? "on" : "off";

        // Busy immediately until backend responds
        isBusy = true;
        if (label != null) label.text = $"{plugDisplayName} : TOGGLING...";

        Debug.Log($"[SmartPlug] Toggle → deviceId={deviceId}, desired={desiredState}");

#if UNITY_WEBGL && !UNITY_EDITOR
        Application.ExternalCall("ToggleSmartPlug", deviceId, desiredState);
#else
        SimulateBackendResponse(desiredState);
#endif
    }

    // Called by JS/WS:
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
            return;
        }

        // Backend cooldown -> show cooldown + unlock after it ends
        if (payload.retryAfter > 0)
        {
            cooldownRemaining = Mathf.Max(cooldownRemaining, payload.retryAfter);
            isBusy = false;

            if (label != null) label.text = $"{plugDisplayName} : COOLDOWN {payload.retryAfter}s";
            return;
        }

        // Error (not success)
        if (payload.status != 200 && payload.status != 0)
        {
            isBusy = false;
            if (label != null)
            {
                var msg = string.IsNullOrWhiteSpace(payload.message) ? $"Error {payload.status}" : payload.message;
                label.text = $"{plugDisplayName} : ERROR";
                Debug.LogWarning($"[SmartPlug] Backend status {payload.status}: {msg}");
            }
            return;
        }

        // Success: update state + unlock
        isOn = string.Equals(payload.state, "on", StringComparison.OrdinalIgnoreCase);
        isBusy = false;

        ApplyVisualState();
    }

    private void ApplyVisualState()
    {
        if (targetRenderer != null)
        {
            var mat = targetRenderer.material;
            mat.color = isOn ? onColor : offColor;
        }

        if (label != null)
        {
            label.text = $"{plugDisplayName} : {(isOn ? "ON" : "OFF")}";
        }

        Debug.Log($"[SmartPlug] {deviceId} -> {(isOn ? "ON" : "OFF")}");
    }

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

        OnDeviceStateJson(JsonUtility.ToJson(payload));
    }
}