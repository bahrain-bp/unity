using System.Collections;
using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;

public class BadgeDoorEntry : MonoBehaviour
{
    [Header("Outside-only trigger")]
    public GameObject promptUI;                 // World-space or screen UI: "Open (F)"
    public TMP_Text promptText;                 // optional
    public string promptLine = "Open (F)";

    [Header("Entry blocker (outside only)")]
    [Tooltip("A collider (NOT trigger) that blocks the player from entering until badge is tapped.")]
    public Collider entryBlocker;

    [Header("Peccy")]
    public Animator peccyAnimator;              // Peccy's Animator
    public string tapTriggerName = "TapBadge";  // must match Animator Trigger name

    [Header("Peccy Bubble (typewriter)")]
    public SpeechBubbleUI bubbleUI;             // your teammate bubble script
    public TMP_Text bubbleTMP;                  // the TMP text inside the bubble
    public float bubbleCharsPerSecond = 40f;

    [TextArea] public string line1 = "Let me tap my badge...";
    [TextArea] public string line2 = "You may come in.";

    [Header("Timings")]
    public float afterTapBeforeAllow = 0.3f;    // small delay after animation starts
    public float allowWindowSeconds = 6f;       // how long the blocker stays off (player can enter)

    [Header("Input")]
    public PlayerInput playerInput;
    public string actionMapName = "Player";
    public string interactActionName = "Interact"; // your F action

    private InputAction interactAction;
    private bool playerInZone;
    private bool busy;

    void Start()
    {
        if (promptUI != null) promptUI.SetActive(false);
        if (promptText != null) promptText.text = promptLine;

        if (playerInput != null && playerInput.actions != null)
        {
            var map = playerInput.actions.FindActionMap(actionMapName, true);
            interactAction = map.FindAction(interactActionName, true);
        }

        // blocker should be ON by default for entry doors
        if (entryBlocker != null) entryBlocker.enabled = true;
    }

    void Update()
    {
        if (!playerInZone || busy) return;
        if (interactAction == null) return;

        if (interactAction.WasPressedThisFrame())
        {
            StartCoroutine(EntryFlow());
        }
    }

    private IEnumerator EntryFlow()
    {
        busy = true;
        SetPrompt(false);

        // Show line 1 typed
        yield return ShowTyped(line1, "");

        // Play tap animation
        if (peccyAnimator != null && !string.IsNullOrEmpty(tapTriggerName))
        {
            peccyAnimator.SetTrigger(tapTriggerName); // Unity API :contentReference[oaicite:3]{index=3}
        }

        // Small timing so it feels like the tap happens then access is granted
        if (afterTapBeforeAllow > 0f)
            yield return new WaitForSeconds(afterTapBeforeAllow); // Unity timing :contentReference[oaicite:4]{index=4}

        // Line 2 typed
        yield return ShowTyped(line2, "");

        // Allow entry by disabling blocker temporarily
        if (entryBlocker != null) entryBlocker.enabled = false;

        // Keep it open long enough for the player to walk through
        float t = 0f;
        while (t < allowWindowSeconds)
        {
            t += Time.deltaTime;
            yield return null;
        }

        // Re-enable blocker for the next time someone approaches from outside
        if (entryBlocker != null) entryBlocker.enabled = true;

        // Hide bubble after done (optional)
        if (bubbleUI != null) bubbleUI.Hide();

        busy = false;

        // If player is still in zone, show prompt again
        if (playerInZone) SetPrompt(true);
    }

    private void SetPrompt(bool show)
    {
        if (promptUI != null) promptUI.SetActive(show);
        if (promptText != null) promptText.text = promptLine;
    }

    private IEnumerator ShowTyped(string line, string options)
    {
        // Show bubble (instant) with empty text, then type into TMP
        if (bubbleUI != null) bubbleUI.Show("", options);

        if (bubbleTMP == null || bubbleCharsPerSecond <= 0f)
        {
            if (bubbleUI != null) bubbleUI.Show(line, options);
            yield break;
        }

        bubbleTMP.text = "";
        float secondsPerChar = 1f / bubbleCharsPerSecond;

        for (int i = 0; i <= line.Length; i++)
        {
            bubbleTMP.text = line.Substring(0, i);
            yield return new WaitForSeconds(secondsPerChar);
        }
    }

    private void OnTriggerEnter(Collider other)
    {
        if (!other.CompareTag("Player")) return;

        playerInZone = true;
        if (!busy) SetPrompt(true);
    }

    private void OnTriggerExit(Collider other)
    {
        if (!other.CompareTag("Player")) return;

        playerInZone = false;
        SetPrompt(false);
    }
}
