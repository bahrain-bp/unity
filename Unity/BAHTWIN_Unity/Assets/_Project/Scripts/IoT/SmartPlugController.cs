using System;
using UnityEngine;
using TMPro;
using UnityEngine.InputSystem; // New Input System

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
    [Tooltip("Set this to your Player tag. Your player root should be tagged Player.")]
    public string playerTag = "Player";

    [Tooltip("Drag your Input Action here (recommended): Player/Interact (F).")]
    public InputActionReference interactAction;

    [Tooltip("Keep mouse click working too (optional).")]
    public bool allowMouseClick = true;

    // --- state ---
    private bool isOn;
    private bool isBusy;
    private float localCooldownRemaining = 0f;

    // trigger state
    private bool playerInRange;

    private void Awake()
    {
        isOn = startsOn;
        ApplyVisualState();

        // Ensure our collider is trigger (interaction zone)
        var col = GetComponent<Collider>();
        if (col != null && !col.isTrigger)
        {
            // You can leave it off if you want, but then OnTrigger won't fire.
            // Better to force it for this interaction style.
            col.isTrigger = true;
        }
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
        // Cooldown timer
        if (localCooldownRemaining > 0f)
        {
            localCooldownRemaining -= Time.deltaTime;
            if (localCooldownRemaining < 0f) localCooldownRemaining = 0f;

            if (label != null)
            {
                int remaining = Mathf.CeilToInt(localCooldownRemaining);
                if (remaining > 0) label.text = $"{plugDisplayName} : COOLDOWN {remaining}s";
                else ApplyVisualState();
            }
        }

        if (isBusy || localCooldownRemaining > 0f) return;

        // Show hint only when player is inside trigger
        if (label != null)
        {
            label.text = playerInRange
                ? $"{plugDisplayName} : Press [F]"
                : $"{plugDisplayName} : {(isOn ? "ON" : "OFF")}";
        }

        // Press F (Interact Action) while in range
        if (playerInRange && interactAction != null && interactAction.action.WasPressedThisFrame())
        {
            Debug.Log($"[SmartPlug] Interact pressed in trigger for {deviceId}");
            OnClick();
        }
    }

    private void OnTriggerEnter(Collider other)
    {
        if (other.CompareTag(playerTag))
        {
            playerInRange = true;
            // Debug.Log($"[SmartPlug] Player entered trigger for {deviceId}");
        }
    }

    private void OnTriggerExit(Collider other)
    {
        if (other.CompareTag(playerTag))
        {
            playerInRange = false;
            // Debug.Log($"[SmartPlug] Player exited trigger for {deviceId}");
        }
    }

    // Call this from Button / OnMouseDown / Trigger+Key
    public void OnClick()
    {
        if (isBusy) return;
        if (localCooldownRemaining > 0f) return;

        bool desired = !isOn;
        string desiredState = desired ? "on" : "off";

        isBusy = true;
        Debug.Log($"[SmartPlug] Toggle → deviceId={deviceId}, desired={desiredState}");

#if UNITY_WEBGL && !UNITY_EDITOR
        Application.ExternalCall("ToggleSmartPlug", deviceId, desiredState);
#else
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
            isBusy = false;
            return;
        }

        // Handle error/cooldown
        if (payload.status != 200 && payload.status != 0)
        {
            Debug.LogWarning($"[SmartPlug] Backend status {payload.status}: {payload.message}");

            if (payload.status == 429 && payload.retryAfter > 0)
            {
                localCooldownRemaining = payload.retryAfter;
                if (label != null) label.text = $"{plugDisplayName} : COOLDOWN {payload.retryAfter}s";
            }

            isBusy = false;
            return;
        }

        // Success
        bool newState = string.Equals(payload.state, "on", StringComparison.OrdinalIgnoreCase);
        isOn = newState;

        isBusy = false;
        localCooldownRemaining = 0f;
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
