using System.Collections;
using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;

public class RegistrationZoneTrigger : MonoBehaviour
{
    [Header("Speech Bubble Fade (No changes to SpeechBubbleUI)")]
    public CanvasGroup speechBubbleGroup;   // drag SpeechBubble root CanvasGroup here
    public float bubbleFadeIn = 0.25f;
    public float bubbleFadeOut = 0.25f;

    [Header("Post-Flash Badge Moment")]
    [TextArea] public string badgeLine = "Here is your visitor badge please wear at all times when visiting.";
    public float afterFlashDelay = 1f;

    public BadgePickupInteractable badgePickup; // assign in inspector

    [Header("Access Control")]
    public RegistrationAccessGate accessGate;

    [Header("Speech Bubble (teammate prefab)")]
    public SpeechBubbleUI speechBubble;

    [Header("Dialogue Text")]
    [TextArea] public string firstLine = "Welcome to AWS, may I ask for your name?";
    public string firstOptions = "Next (N)";
    [TextArea] public string afterNameLine = "Thank you. Please look at the camera.";
    public string afterNameOptions = "";

    [Header("Replay (Already Registered)")]
    [TextArea] public string replayLine = "Press F to go through the registration process again.";
    public string replayOptions = "F (Interact)";
    public BadgeHUD badgeHud;
    public string interactActionName = "Interact";

    [Header("Bottom UI (Player reply)")]
    public GameObject bottomPanel;
    public CanvasGroup bottomCanvasGroup;
    public TMP_Text bottomText;

    [Header("Bottom UI Animation")]
    public float bottomFadeInSeconds = 0.25f;
    public float bottomFadeOutSeconds = 0.8f;
    public float typewriterSecondsPerChar = 0.03f;
    public float afterTypewriterDelay = 0.15f;
    public float holdReplySeconds = 2f;
    public float afterThankYouDelay = 0.25f;

    [Header("Player")]
    public Transform playerRoot;
    public CharacterController characterController;
    public Transform snapPoint;

    [Header("Input (New Input System)")]
    public PlayerInput playerInput;
    public string actionMapName = "Player";
    public string moveActionName = "Move";
    public string lookActionName = "Look";
    public string nextActionName = "Next";

    [Header("Camera Flash")]
    public Transform cameraLookTarget;
    public CanvasGroup flashCanvasGroup;
    public float lookDotThreshold = 0.95f;
    public float mustLookSeconds = 0.15f;
    public float flashInSeconds = 0.05f;
    public float flashOutSeconds = 0.20f;

    private bool running;
    private bool playerInside;

    private InputAction moveAction;
    private InputAction lookAction;
    private InputAction nextAction;
    private InputAction interactAction;

    private Coroutine waitReplayRoutine;
    private Coroutine bubbleFadeRoutine;

    private void Awake()
    {
        HideBottomInstant();

        // IMPORTANT: Don't call speechBubble.Hide() here if it disables the GameObject.
        // We fade using CanvasGroup, so we need the object active.
        if (speechBubbleGroup != null)
        {
            speechBubbleGroup.alpha = 0f;
            speechBubbleGroup.interactable = false;
            speechBubbleGroup.blocksRaycasts = false;
        }

        if (flashCanvasGroup != null)
        {
            flashCanvasGroup.alpha = 0f;
            flashCanvasGroup.interactable = false;
            flashCanvasGroup.blocksRaycasts = false;
        }
    }

    private void Start()
    {
        CacheActions();
    }

    private void CacheActions()
    {
        if (playerInput == null || playerInput.actions == null) return;

        var map = playerInput.actions.FindActionMap(actionMapName, true);
        moveAction = map.FindAction(moveActionName, true);
        lookAction = map.FindAction(lookActionName, true);
        nextAction = map.FindAction(nextActionName, true);

        if (!string.IsNullOrEmpty(interactActionName))
            interactAction = map.FindAction(interactActionName, false);
    }

    private void OnTriggerEnter(Collider other)
    {
        if (running) return;
        if (!other.CompareTag("Player")) return;

        playerInside = true;

        if (VisitorSession.Instance == null || !VisitorSession.Instance.IsLoaded)
        {
            ShowBubbleFaded("System not ready (VisitorSession missing).", "");
            return;
        }

        var profile = VisitorSession.Instance.Profile;

        if (profile != null && profile.passedRegistration)
        {
            accessGate?.SetRegistrationPassed(true);

            ShowBubbleFaded(replayLine, replayOptions);

            if (waitReplayRoutine != null) StopCoroutine(waitReplayRoutine);
            waitReplayRoutine = StartCoroutine(WaitForReplayPressed());

            return;
        }

        StartCoroutine(Flow(isReplay: false));
    }

    private void OnTriggerExit(Collider other)
    {
        if (!other.CompareTag("Player")) return;

        playerInside = false;

        if (waitReplayRoutine != null)
        {
            StopCoroutine(waitReplayRoutine);
            waitReplayRoutine = null;
        }

        if (!running)
            HideBubbleFaded();
    }

    private IEnumerator WaitForReplayPressed()
    {
        InputAction a = interactAction != null ? interactAction : nextAction;

        while (playerInside && !running)
        {
            if (a != null && a.WasPressedThisFrame())
            {
                SnapPlayerToPoint();
                yield return Flow(isReplay: true);
                yield break;
            }

            yield return null;
        }
    }

    private IEnumerator Flow(bool isReplay)
    {
        running = true;

        if (isReplay && badgeHud != null)
            badgeHud.SetForceHidden(true);

        accessGate?.SetRegistrationPassed(false);

        if (!isReplay)
            SnapPlayerToPoint();

        if (moveAction != null) moveAction.Disable();
        if (lookAction != null) lookAction.Enable();
        if (nextAction != null) nextAction.Enable();

        ShowBubbleFaded(firstLine, firstOptions);
        yield return WaitForNextPressed();

        var profile = VisitorSession.Instance.Profile;
        if (profile == null)
        {
            ShowBubbleFaded("Sorry, I could not load your data.", "");
            EndRegistration();
            yield break;
        }

        yield return ShowBottomReplyAnimated($"You: {profile.userName}");

        if (holdReplySeconds > 0f)
            yield return new WaitForSeconds(holdReplySeconds);

        ShowBubbleFaded(afterNameLine, afterNameOptions);

        if (afterThankYouDelay > 0f)
            yield return new WaitForSeconds(afterThankYouDelay);

        yield return FadeCanvasGroup(bottomCanvasGroup, bottomCanvasGroup != null ? bottomCanvasGroup.alpha : 1f, 0f, bottomFadeOutSeconds);
        if (bottomPanel != null) bottomPanel.SetActive(false);

        yield return WaitUntilLookingAtTarget();
        yield return FlashScreen();

        if (afterFlashDelay > 0f)
            yield return new WaitForSeconds(afterFlashDelay);

        ShowBubbleFaded(badgeLine, "");

        if (badgePickup != null)
        {
            badgePickup.BeginShow();
            yield return badgePickup.WaitUntilPickedUp();
        }

        if (isReplay && badgeHud != null)
            badgeHud.SetForceHidden(false);

        accessGate?.SetRegistrationPassed(true);

        HideBubbleFaded();
        EndRegistration();
    }

    private void SnapPlayerToPoint()
    {
        if (snapPoint == null || playerRoot == null) return;

        if (characterController != null) characterController.enabled = false;

        playerRoot.position = snapPoint.position;
        playerRoot.rotation = snapPoint.rotation;

        if (characterController != null) characterController.enabled = true;
    }

    private IEnumerator WaitForNextPressed()
    {
        while (true)
        {
            if (nextAction != null && nextAction.WasPressedThisFrame())
                yield break;

            yield return null;
        }
    }

    private IEnumerator ShowBottomReplyAnimated(string text)
    {
        if (bottomPanel != null) bottomPanel.SetActive(true);

        if (bottomCanvasGroup != null)
        {
            bottomCanvasGroup.alpha = 0f;
            bottomCanvasGroup.interactable = false;
            bottomCanvasGroup.blocksRaycasts = false;

            yield return FadeCanvasGroup(bottomCanvasGroup, 0f, 1f, bottomFadeInSeconds);
        }

        if (bottomText != null)
            yield return Typewriter(bottomText, text, typewriterSecondsPerChar);

        if (afterTypewriterDelay > 0f)
            yield return new WaitForSeconds(afterTypewriterDelay);
    }

    private IEnumerator Typewriter(TMP_Text tmp, string fullText, float secondsPerChar)
    {
        tmp.text = "";

        if (secondsPerChar <= 0f)
        {
            tmp.text = fullText;
            yield break;
        }

        for (int i = 0; i <= fullText.Length; i++)
        {
            tmp.text = fullText.Substring(0, i);
            yield return new WaitForSeconds(secondsPerChar);
        }
    }

    private IEnumerator FadeCanvasGroup(CanvasGroup cg, float from, float to, float seconds)
    {
        if (cg == null) yield break;

        if (seconds <= 0f)
        {
            cg.alpha = to;
            yield break;
        }

        cg.alpha = from;
        float t = 0f;

        while (t < seconds)
        {
            t += Time.deltaTime;
            cg.alpha = Mathf.Lerp(from, to, t / seconds);
            yield return null;
        }

        cg.alpha = to;
    }

    private void ShowBubbleFaded(string line, string options)
    {
        if (speechBubble != null)
            speechBubble.Show(line, options);

        FadeBubble(true);
    }

    private void HideBubbleFaded()
    {
        FadeBubble(false);
        // We intentionally do NOT call speechBubble.Hide() because many prefabs disable the object,
        // which would break fading. The CanvasGroup alpha=0 is enough.
    }

    private void FadeBubble(bool show)
    {
        if (speechBubbleGroup == null) return;

        if (bubbleFadeRoutine != null)
            StopCoroutine(bubbleFadeRoutine);

        float from = speechBubbleGroup.alpha;
        float to = show ? 1f : 0f;
        float dur = show ? bubbleFadeIn : bubbleFadeOut;

        speechBubbleGroup.interactable = show;
        speechBubbleGroup.blocksRaycasts = show;

        bubbleFadeRoutine = StartCoroutine(FadeCanvasGroup(speechBubbleGroup, from, to, dur));
    }

    private void HideBottomInstant()
    {
        if (bottomPanel != null) bottomPanel.SetActive(false);
        if (bottomCanvasGroup != null) bottomCanvasGroup.alpha = 0f;
        if (bottomText != null) bottomText.text = "";
    }

    private IEnumerator WaitUntilLookingAtTarget()
    {
        if (cameraLookTarget == null) yield break;

        Camera cam = Camera.main;
        if (cam == null) yield break;

        float held = 0f;

        while (held < mustLookSeconds)
        {
            Vector3 toTarget = (cameraLookTarget.position - cam.transform.position).normalized;
            float dot = Vector3.Dot(cam.transform.forward, toTarget);

            if (dot >= lookDotThreshold) held += Time.deltaTime;
            else held = 0f;

            yield return null;
        }
    }

    private IEnumerator FlashScreen()
    {
        if (flashCanvasGroup == null) yield break;

        yield return FadeCanvasGroup(flashCanvasGroup, 0f, 1f, flashInSeconds);
        yield return FadeCanvasGroup(flashCanvasGroup, 1f, 0f, flashOutSeconds);
    }

    public void EndRegistration()
    {
        if (moveAction != null) moveAction.Enable();
        running = false;
    }
}
