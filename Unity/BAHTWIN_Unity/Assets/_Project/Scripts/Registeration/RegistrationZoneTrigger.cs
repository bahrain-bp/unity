using System.Collections;
using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;

public class RegistrationZoneTrigger : MonoBehaviour
{
    [Header("Peccy (Enable only after passedRegistration)")]
    public GameObject peccyRoot;          // drag Peccy root here
    public bool hidePeccyOnStart = true;  // keep true

    [Header("Speech Bubble Typewriter (optional)")]
    public TMP_Text bubbleText;
    public float bubbleTypeSecondsPerChar = 0.02f;

    [Header("Speech Bubble Fade (No changes to SpeechBubbleUI)")]
    public CanvasGroup speechBubbleGroup;
    public float bubbleFadeIn = 0.25f;
    public float bubbleFadeOut = 0.25f;

    [Header("Post-Flash Badge Moment")]
    [TextArea] public string badgeLine = "Here is your visitor badge please wear at all times when visiting.";
    public float afterFlashDelay = 1f;

    public BadgePickupInteractable badgePickup;

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

    [Header("Registration Locked UI (disable until passedRegistration = true)")]
    [Tooltip("If your badge-doors show a prompt, drag the PROMPT GameObject(s) here to hide them before registration.")]
    public GameObject[] hideObjectsWhenNotRegistered;

    [Tooltip("Optional: drag TMP_Text components here if you want to disable only the text component.")]
    public TMP_Text[] disableTextsWhenNotRegistered;

    [Tooltip("Optional: drag any Behaviour (scripts, colliders, etc.) you want disabled before registration.")]
    public Behaviour[] disableBehavioursWhenNotRegistered;

    private readonly Dictionary<TMP_Text, bool> _textWasEnabled = new();
    private bool _gatesCached;

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

        // Peccy start state
        if (peccyRoot != null && hidePeccyOnStart)
            peccyRoot.SetActive(false);

        CacheGatedUIInitialState();
    }

    private void Start()
    {
        CacheActions();
        StartCoroutine(InitFromSession());
    }

    private void CacheGatedUIInitialState()
    {
        if (_gatesCached) return;
        _gatesCached = true;

        if (disableTextsWhenNotRegistered != null)
        {
            foreach (var t in disableTextsWhenNotRegistered)
            {
                if (!t) continue;
                if (!_textWasEnabled.ContainsKey(t))
                    _textWasEnabled.Add(t, t.enabled);
            }
        }
    }

    private IEnumerator InitFromSession()
    {
        while (VisitorSession.Instance == null || !VisitorSession.Instance.IsLoaded)
            yield return null;

        var profile = VisitorSession.Instance.Profile;
        bool passed = profile != null && profile.passedRegistration;

        // Keep everything consistent on load
        ApplyRegistrationState(passed);

        if (peccyRoot != null)
            peccyRoot.SetActive(passed);
    }

    private void ApplyRegistrationState(bool passed)
    {
        // 1) Tell your access gate (colliders / navmesh blockers etc.)
        accessGate?.SetRegistrationPassed(passed);

        // 2) Hide / show prompt objects
        if (hideObjectsWhenNotRegistered != null)
        {
            foreach (var go in hideObjectsWhenNotRegistered)
            {
                if (!go) continue;
                go.SetActive(passed);
            }
        }

        // 3) Disable / enable specific TMP texts
        if (disableTextsWhenNotRegistered != null)
        {
            foreach (var t in disableTextsWhenNotRegistered)
            {
                if (!t) continue;

                if (passed)
                {
                    // restore the enabled state it originally had
                    if (_textWasEnabled.TryGetValue(t, out bool wasEnabled))
                        t.enabled = wasEnabled;
                    else
                        t.enabled = true;
                }
                else
                {
                    t.enabled = false;
                }
            }
        }

        // 4) Disable / enable any behaviours
        if (disableBehavioursWhenNotRegistered != null)
        {
            foreach (var b in disableBehavioursWhenNotRegistered)
            {
                if (!b) continue;
                b.enabled = passed;
            }
        }
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
            ApplyRegistrationState(true);

            if (peccyRoot != null) peccyRoot.SetActive(true);

            ShowBubbleFaded(replayLine, replayOptions);

            if (waitReplayRoutine != null) StopCoroutine(waitReplayRoutine);
            waitReplayRoutine = StartCoroutine(WaitForReplayPressed());
            return;
        }

        // Not registered state
        ApplyRegistrationState(false);
        if (peccyRoot != null) peccyRoot.SetActive(false);

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

        // During registration, treat as not passed
        ApplyRegistrationState(false);

        if (!isReplay)
            SnapPlayerToPoint();

        // Enable/Disable input actions (Input System)
        if (moveAction != null) moveAction.Disable();
        if (lookAction != null) lookAction.Enable();
        if (nextAction != null) nextAction.Enable();
        // InputAction Enable/Disable is the supported approach in the new Input System. :contentReference[oaicite:1]{index=1}

        yield return ShowBubbleTypewriter(firstLine, firstOptions);
        yield return WaitForNextPressed();

        var profile = VisitorSession.Instance.Profile;
        if (profile == null)
        {
            yield return ShowBubbleTypewriter("Sorry, I could not load your data.", "");
            EndRegistration();
            yield break;
        }

        yield return ShowBottomReplyAnimated($"You: {profile.userName}");

        if (holdReplySeconds > 0f)
            yield return new WaitForSeconds(holdReplySeconds);

        yield return ShowBubbleTypewriter(afterNameLine, afterNameOptions);

        if (afterThankYouDelay > 0f)
            yield return new WaitForSeconds(afterThankYouDelay);

        yield return FadeCanvasGroup(bottomCanvasGroup, bottomCanvasGroup != null ? bottomCanvasGroup.alpha : 1f, 0f, bottomFadeOutSeconds);
        if (bottomPanel != null) bottomPanel.SetActive(false);

        yield return WaitUntilLookingAtTarget();
        yield return FlashScreen();

        if (afterFlashDelay > 0f)
            yield return new WaitForSeconds(afterFlashDelay);

        yield return ShowBubbleTypewriter(badgeLine, "");

        if (badgePickup != null)
        {
            badgePickup.BeginShow();
            yield return badgePickup.WaitUntilPickedUp();
        }

        // Mark registration as passed in the session profile (so next time it loads correctly)
        if (VisitorSession.Instance != null && VisitorSession.Instance.Profile != null)
            VisitorSession.Instance.Profile.passedRegistration = true;

        // Registration passed -> allow access + show Peccy + re-enable door texts
        ApplyRegistrationState(true);
        if (peccyRoot != null) peccyRoot.SetActive(true);

        if (isReplay && badgeHud != null)
            badgeHud.SetForceHidden(false);

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
        if (tmp == null) yield break;

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
        // CanvasGroup controls visibility and interactability for UI groups. :contentReference[oaicite:2]{index=2}
    }

    private IEnumerator ShowBubbleTypewriter(string line, string options)
    {
        FadeBubble(false);
        if (bubbleFadeOut > 0f) yield return new WaitForSeconds(bubbleFadeOut);

        if (speechBubble != null) speechBubble.Show("", options);

        FadeBubble(true);
        if (bubbleFadeIn > 0f) yield return new WaitForSeconds(bubbleFadeIn);

        if (bubbleText != null)
            yield return Typewriter(bubbleText, line, bubbleTypeSecondsPerChar);
        else if (speechBubble != null)
            speechBubble.Show(line, options);
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
