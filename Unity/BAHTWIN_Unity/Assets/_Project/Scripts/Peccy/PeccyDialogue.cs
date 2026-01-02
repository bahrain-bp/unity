using System.Collections;
using UnityEngine;
using UnityEngine.AI;
using UnityEngine.InputSystem;

public class PeccyDialogue : MonoBehaviour
{
    [Header("References")]
    public SpeechBubbleUI bubble;
    public Camera playerCamera;
    public ChatUIController chatUI;

    [Header("Peccy Movement")]
    public NavMeshAgent agent;          
    public PeccyFollower follower;      
    public Animator animator;           
    public string tapTriggerName = "TapBadge";

    [Header("Intro Lines")]
    [TextArea] public string welcomeLine = "Hello there! Welcome to AWS's Bahrain Office.";
    public string welcomeOptions = "Next (N)  |  Enter";

    [TextArea] public string tourLine = "Want a quick tour? I can guide you to the coolest spots in the office.";
    public string tourOptions = "Yes (Y)   |   No (N)";

    [Header("Assistant Line")]
    [TextArea] public string assistantLine = "Need my Assistance? Let's Chat!";
    public string assistantOptions = "Chat (C)";

    [Header("Badge Door Lines")]
    [TextArea] public string badgeAskLine = "Let me tap my badge...";
    public string badgeAskOptions = "Next (N)";
    [TextArea] public string badgeDoneLine = "You may come in.";
    public float tapAnimSeconds = 2f;         
    public float afterDoneHoldSeconds = 5f;

    [Header("Start Trigger")]
    public bool startWhenOnScreen = true;
    public float startInputCooldown = 0.35f;

    [Header("Screen check")]
    public bool requireOnScreenForAssistant = true;

    [Header("State (read-only)")]
    public bool introStarted = false;
    public bool tourMode = false;
    public bool assistantMode = false;

    private enum DialogueState { Welcome, TourQuestion, IdleAssistant }
    private DialogueState state = DialogueState.Welcome;

    // Input actions
    private InputAction nextAction;    // N
    private InputAction enterAction;   // Enter
    private InputAction yesAction;     // Y
    private InputAction chatAction;    // C

    private float ignoreInputUntilTime = 0f;
    private bool chatUIOpen = false;

    // IMPORTANT: when badge flow runs, we pause the normal assistant prompt
    private bool overrideBusy = false;

    void Awake()
    {
        nextAction  = new InputAction(type: InputActionType.Button, binding: "<Keyboard>/n");
        enterAction = new InputAction(type: InputActionType.Button, binding: "<Keyboard>/enter");
        yesAction   = new InputAction(type: InputActionType.Button, binding: "<Keyboard>/y");
        chatAction  = new InputAction(type: InputActionType.Button, binding: "<Keyboard>/c");

        nextAction.performed  += OnNextOrEnter;
        enterAction.performed += OnNextOrEnter;
        yesAction.performed   += OnYes;
        chatAction.performed  += OnChat;

        nextAction.Enable();
        enterAction.Enable();
        yesAction.Enable();
        chatAction.Enable();
    }

    void OnDestroy()
    {
        nextAction.performed  -= OnNextOrEnter;
        enterAction.performed -= OnNextOrEnter;
        yesAction.performed   -= OnYes;
        chatAction.performed  -= OnChat;

        nextAction.Disable();
        enterAction.Disable();
        yesAction.Disable();
        chatAction.Disable();
    }

    void Start()
    {
        if (bubble != null) bubble.Hide();
        if (playerCamera == null) playerCamera = Camera.main;
    }

    void Update()
    {
        // Start intro once when Peccy is on screen
        if (!introStarted && startWhenOnScreen && IsPeccyOnScreen())
        {
            StartIntro();
        }

        // If badge override is running, do NOT show assistant prompt
        if (overrideBusy) return;

        // Assistant always shows when assistantMode is active (and not in tour mode)
        if (introStarted && state == DialogueState.IdleAssistant && assistantMode && !tourMode)
        {
            if (chatUIOpen)
            {
                bubble.Hide();
                return;
            }

            if (requireOnScreenForAssistant && !IsPeccyOnScreen())
            {
                bubble.Hide();
                return;
            }

            // always show this when idle assistant
            bubble.Show(assistantLine, assistantOptions);
        }
    }

    private void StartIntro()
    {
        introStarted = true;
        tourMode = false;
        assistantMode = false;
        state = DialogueState.Welcome;

        ignoreInputUntilTime = Time.time + startInputCooldown;

        bubble.Show(welcomeLine, welcomeOptions);
    }

    private void OnNextOrEnter(InputAction.CallbackContext ctx)
    {
        if (!introStarted) return;
        if (Time.time < ignoreInputUntilTime) return;
        if (overrideBusy) return; // badge flow consumes N/Enter separately

        if (state == DialogueState.Welcome)
        {
            state = DialogueState.TourQuestion;
            bubble.Show(tourLine, tourOptions);
        }
        else if (state == DialogueState.TourQuestion)
        {
            ChooseNo();
        }
    }

    private void OnYes(InputAction.CallbackContext ctx)
    {
        if (!introStarted) return;
        if (Time.time < ignoreInputUntilTime) return;
        if (overrideBusy) return;
        if (state != DialogueState.TourQuestion) return;

        // Tour selected
        tourMode = true;
        assistantMode = false;

        bubble.Hide();

        // Tour system will take over later, for now stop following
        if (follower != null) follower.SetFollow(false);
    }

    private void ChooseNo()
    {
        tourMode = false;
        assistantMode = true;
        state = DialogueState.IdleAssistant;

        // Start following after No
        if (follower != null) follower.SetFollow(true);

        // Update() will keep showing assistant prompt
    }

    private void OnChat(InputAction.CallbackContext ctx)
    {
        if (!introStarted) return;
        if (overrideBusy) return;
        if (!assistantMode) return;
        if (state != DialogueState.IdleAssistant) return;

        if (chatUI != null)
            chatUI.Open();
    }

    public void OnChatOpened()
    {
        chatUIOpen = true;
        bubble.Hide();
    }

    public void OnChatClosed()
    {
        chatUIOpen = false;
        // Update() will show assistant prompt again
    }

    // CALLED BY BadgeDoorEntry
    public void StartBadgeDoorSequence(Transform tapPoint, Collider entryBlocker, float unblockSeconds)
    {
        if (!introStarted) return;      
        if (overrideBusy) return;

        StartCoroutine(BadgeDoorRoutine(tapPoint, entryBlocker, unblockSeconds));
    }

    private IEnumerator BadgeDoorRoutine(Transform tapPoint, Collider entryBlocker, float unblockSeconds)
    {
        overrideBusy = true;

        // Pause assistant prompt
        bubble.Hide();

        // Stop following during badge simulation
        if (follower != null) follower.SetFollow(false);

        // Move Peccy to the badge reader point
        if (tapPoint != null)
        {
            if (agent != null)
            {
                agent.isStopped = true;
                agent.Warp(tapPoint.position); // :contentReference[oaicite:3]{index=3}
                agent.transform.rotation = tapPoint.rotation;
            }
            else
            {
                transform.position = tapPoint.position;
                transform.rotation = tapPoint.rotation;
            }
        }

        // Show badge ask line with Next (N)
        bubble.Show(badgeAskLine, badgeAskOptions);

        // Wait for N or Enter
        yield return WaitForNextOrEnter();

        // Play tap animation
        if (animator != null && !string.IsNullOrEmpty(tapTriggerName))
        {
            animator.SetTrigger(tapTriggerName); 
        }

        // Wait until animation finishes (set tapAnimSeconds to your clip length)
        if (tapAnimSeconds > 0f)
            yield return new WaitForSeconds(tapAnimSeconds); 

        // Say you may come in
        bubble.Show(badgeDoneLine, "");

        
        if (entryBlocker != null) entryBlocker.enabled = false;

        // Re-enable follow immediately 
        if (follower != null) follower.SetFollow(true);

        if (afterDoneHoldSeconds > 0f)
            yield return new WaitForSeconds(afterDoneHoldSeconds); 

        // Return to assistant prompt mode
        state = DialogueState.IdleAssistant;
        assistantMode = true;
        tourMode = false;

        overrideBusy = false;

        // Keep blocker disabled for 15s then restore
        float t = 0f;
        while (t < unblockSeconds)
        {
            t += Time.deltaTime;
            yield return null;
        }
        if (entryBlocker != null) entryBlocker.enabled = true;
    }

    private IEnumerator WaitForNextOrEnter()
    {
        while (true)
        {
            // WasPressedThisFrame exists on InputAction (Input System API)
            if (nextAction != null && nextAction.WasPressedThisFrame()) yield break;
            if (enterAction != null && enterAction.WasPressedThisFrame()) yield break;
            yield return null;
        }
    }

    private bool IsPeccyOnScreen()
    {
        if (playerCamera == null) return false;

        Vector3 vp = playerCamera.WorldToViewportPoint(transform.position);
        return (vp.z > 0f && vp.x > 0f && vp.x < 1f && vp.y > 0f && vp.y < 1f);
    }
}
