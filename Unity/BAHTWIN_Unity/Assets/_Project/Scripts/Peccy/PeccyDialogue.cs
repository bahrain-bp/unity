using UnityEngine;
using UnityEngine.InputSystem;

public class PeccyDialogue : MonoBehaviour
{
    [Header("References")]
    public SpeechBubbleUI bubble;
    public Camera playerCamera;
    public ChatUIController chatUI;

    [Header("Look-to-interact gate (NO colliders needed)")]
    [Range(0.5f, 1f)]
    public float lookDotThreshold = 0.93f;

    [Tooltip("If true, interaction is blocked when something (like a wall) is between the camera and Peccy.")]
    public bool blockIfOccluded = true;

    [Tooltip("Layers that can block line of sight (Walls, props, etc). Exclude the Player layer if it causes issues.")]
    public LayerMask occluderMask = ~0;

    [Header("Start Trigger")]
    public bool startWhenVisible = true;
    public bool startManually = false;
    public float startInputCooldown = 0.35f;

    [Header("Follower (enable on No)")]
    public PeccyFollower follower; 

    [Header("State (read-only)")]
    public bool introStarted = false;
    public bool tourMode = false;
    public bool assistantMode = false;

    private enum DialogueState { Welcome, TourQuestion, IdleAssistant }
    private DialogueState state = DialogueState.Welcome;

    private InputAction nextAction;   // N
    private InputAction enterAction;  // Enter
    private InputAction yesAction;    // Y
    private InputAction chatAction;   // C

    private float ignoreInputUntilTime = 0f;

    private Renderer[] renderers;

    [HideInInspector] public bool chatUIOpen = false;

    void Awake()
    {
        renderers = GetComponentsInChildren<Renderer>(true);

        nextAction  = new InputAction(type: InputActionType.Button, binding: "<Keyboard>/n");
        enterAction = new InputAction(type: InputActionType.Button, binding: "<Keyboard>/enter");
        yesAction   = new InputAction(type: InputActionType.Button, binding: "<Keyboard>/y");
        chatAction  = new InputAction(type: InputActionType.Button, binding: "<Keyboard>/c");

        nextAction.performed  += OnNext;
        enterAction.performed += OnNext;
        yesAction.performed   += OnYes;
        chatAction.performed  += OnChat;

        nextAction.Enable();
        enterAction.Enable();
        yesAction.Enable();
        chatAction.Enable();
    }

    void OnDestroy()
    {
        nextAction.performed  -= OnNext;
        enterAction.performed -= OnNext;
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

        introStarted = false;
        assistantMode = false;
        tourMode = false;

        if (playerCamera == null) playerCamera = Camera.main;
    }

    void Update()
    {
        // Start intro as soon as Peccy is visible on screen (your old behavior)
        if (!introStarted && !startManually && startWhenVisible)
        {
            if (IsPeccyOnScreen())
                StartIntro();
        }

        if (introStarted && state == DialogueState.IdleAssistant)
        {
            if (chatUIOpen)
            {
                bubble.Hide();
            }
            else
            {
                if (IsPlayerLookingAtPeccy())
                    bubble.Show("Need my Assistance? Let's Chat!", "Chat (C)");
                else
                    bubble.Hide();
            }
        }
    }

    public void StartIntro()
    {
        if (introStarted) return;

        introStarted = true;
        state = DialogueState.Welcome;

        ignoreInputUntilTime = Time.time + startInputCooldown;
        ShowWelcome();
    }

    private void OnNext(InputAction.CallbackContext ctx)
    {
        if (!introStarted) return;
        if (Time.time < ignoreInputUntilTime) return;
        if (!IsPlayerLookingAtPeccy()) return;

        if (state == DialogueState.Welcome)
        {
            ShowTourQuestion();
        }
        else if (state == DialogueState.TourQuestion)
        {
            // N or Enter means No
            ChooseNo();
        }
    }

    private void OnYes(InputAction.CallbackContext ctx)
    {
        if (!introStarted) return;
        if (Time.time < ignoreInputUntilTime) return;
        if (state != DialogueState.TourQuestion) return;
        if (!IsPlayerLookingAtPeccy()) return;

        tourMode = true;
        assistantMode = false;
        bubble.Hide();

        if (follower != null) follower.SetFollow(false);

        Debug.Log("Tour mode selected (Y). Hook tour start later.");
    }

    private void OnChat(InputAction.CallbackContext ctx)
    {
        if (!introStarted) return;
        if (state != DialogueState.IdleAssistant) return;
        if (!IsPlayerLookingAtPeccy()) return;

        if (chatUI != null)
            chatUI.Open();
        else
            Debug.LogWarning("ChatUI not assigned in PeccyDialogue.");
    }

    private void ChooseNo()
    {
        tourMode = false;
        assistantMode = true;
        state = DialogueState.IdleAssistant;

        // Hide once, then Update() will show "Let's Chat" only when looked at
        bubble.Hide();

        // Start following after "No"
        if (follower != null) follower.SetFollow(true);
    }

    private void ShowWelcome()
    {
        bubble.Show("Hello there! Welcome to AWS's Bahrain Office.", "Next (N)  |  Enter");
    }

    private void ShowTourQuestion()
    {
        state = DialogueState.TourQuestion;
        bubble.Show(
            "Want a quick tour? I can guide you to the coolest spots in the office.",
            "Yes (Y)   |   No (N)"
        );
    }

    public void OnChatOpened()
    {
        chatUIOpen = true;
        if (bubble != null) bubble.Hide();
    }

    public void OnChatClosed()
    {
        chatUIOpen = false;

        if (bubble == null) return;

        if (introStarted && state == DialogueState.IdleAssistant && IsPlayerLookingAtPeccy())
            bubble.Show("Need my Assistance? Let's Chat!", "Chat (C)");
        else
            bubble.Hide();
    }

    private bool IsPlayerLookingAtPeccy()
    {
        if (playerCamera == null) return false;

        Vector3 vp = playerCamera.WorldToViewportPoint(transform.position); // 
        bool onScreen = (vp.z > 0f && vp.x > 0f && vp.x < 1f && vp.y > 0f && vp.y < 1f);
        if (!onScreen) return false;

        Vector3 toPeccy = (transform.position - playerCamera.transform.position).normalized;
        float dot = Vector3.Dot(playerCamera.transform.forward, toPeccy);
        if (dot < lookDotThreshold) return false;

        if (blockIfOccluded)
        {
            Vector3 start = playerCamera.transform.position;
            Vector3 end = transform.position;

            if (Physics.Linecast(start, end, out RaycastHit hit, occluderMask))
            {
                if (Vector3.Distance(hit.point, end) > 0.15f)
                    return false;
            }
        }

        return true;
    }

    private bool IsPeccyOnScreen()
    {
        if (playerCamera == null) return false;

        bool anyRendererVisible = false;
        for (int i = 0; i < renderers.Length; i++)
        {
            if (renderers[i] != null && renderers[i].isVisible)
            {
                anyRendererVisible = true;
                break;
            }
        }
        if (!anyRendererVisible) return false;

        Vector3 p = playerCamera.WorldToViewportPoint(transform.position); // 
        return (p.z > 0f && p.x > 0f && p.x < 1f && p.y > 0f && p.y < 1f);
    }
}
