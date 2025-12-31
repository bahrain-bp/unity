using TMPro;
using UnityEngine;

public class RegistrationBlockerMessage : MonoBehaviour
{
    [Header("Prompt UI (reuse PlayerInteractor prompt)")]
    public GameObject promptRoot;   // e.g. InteractionCanvas
    public TMP_Text promptText;     // e.g. InteractionText (TMP)

    [TextArea]
    public string message = "You must pass registration to unlock this path.";

    [Header("Timing")]
    public float showSeconds = 2f;
    public float cooldownSeconds = 1f;

    // Internal
    private bool playerInside;
    private float showUntil;
    private float cooldownUntil;

    private string cachedDefaultText;
    private bool cached;

    private void Awake()
    {
        if (promptText != null)
        {
            cachedDefaultText = promptText.text;
            cached = true;
        }
    }

    private bool IsRegistrationPassed()
    {
        if (VisitorSession.Instance == null || !VisitorSession.Instance.IsLoaded) return false;
        var p = VisitorSession.Instance.Profile;
        return p != null && p.passedRegistration;
    }

    private bool IsPlayerCollider(Collider other)
    {
        // Works even if the collider is on a child (common setup)
        if (other.CompareTag("Player")) return true;
        if (other.transform.root != null && other.transform.root.CompareTag("Player")) return true;
        return false;
    }

    private void OnTriggerEnter(Collider other)
    {
        if (!IsPlayerCollider(other)) return;
        playerInside = true;

        // Don’t spam if already passed
        if (IsRegistrationPassed()) return;

        TryStartShow();
    }

    private void OnTriggerExit(Collider other)
    {
        if (!IsPlayerCollider(other)) return;
        playerInside = false;
        // Stop forcing immediately when leaving
        showUntil = 0f;
    }

    private void Update()
    {
        // If they pass registration while standing inside, stop showing message
        if (IsRegistrationPassed())
        {
            showUntil = 0f;
            return;
        }

        if (!playerInside) return;

        // If message expired, allow it again after cooldown
        if (Time.time > showUntil && Time.time > cooldownUntil)
        {
            // optional: you can remove this line if you only want it once on enter
            // TryStartShow();
        }
    }

    private void LateUpdate()
    {
        // LateUpdate runs after PlayerInteractor.Update(), so this will actually appear. :contentReference[oaicite:3]{index=3}
        if (IsRegistrationPassed()) return;
        if (!playerInside) return;
        if (Time.time > showUntil) return;

        if (promptRoot != null && !promptRoot.activeSelf)
            promptRoot.SetActive(true);

        if (promptText != null)
            promptText.text = message;
    }

    private void TryStartShow()
    {
        if (Time.time < cooldownUntil) return;

        showUntil = Time.time + Mathf.Max(0.05f, showSeconds);
        cooldownUntil = showUntil + Mathf.Max(0f, cooldownSeconds);
    }

    // Optional: if you want to restore the original text when this component disables
    private void OnDisable()
    {
        if (promptText != null && cached)
            promptText.text = cachedDefaultText;
    }
}
