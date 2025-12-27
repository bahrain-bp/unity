using UnityEngine;
using UnityEngine.InputSystem;

public class PeccyDialogue : MonoBehaviour
{
    [Header("References")]
    public SpeechBubbleUI bubble;
    public Camera playerCamera;

    [Header("Start Trigger")]
    public bool startWhenVisible = true;
    public bool startManually = false;
    public float startInputCooldown = 0.35f;

    [Header("State (read-only)")]
    public bool introStarted = false;
    public bool tourMode = false;
    public bool assistantMode = false;

    private enum DialogueState { Welcome, TourQuestion, IdleAssistant }
    private DialogueState state = DialogueState.Welcome;

    private InputAction nextAction;    // N
    private InputAction enterAction;   // Enter
    private InputAction yesAction;     // Y
    private InputAction chatAction;    // C

    private float ignoreInputUntilTime = 0f;

    public ChatUIController chatUI;

    // Renderer to check if Peccy is visible
    private Renderer[] renderers;

    [HideInInspector]
    public bool chatUIOpen = false;

    void Awake()
    {
        renderers = GetComponentsInChildren<Renderer>(true);

        nextAction = new InputAction(type: InputActionType.Button, binding: "<Keyboard>/n");
        enterAction = new InputAction(type: InputActionType.Button, binding: "<Keyboard>/enter");
        yesAction = new InputAction(type: InputActionType.Button, binding: "<Keyboard>/y");
        chatAction = new InputAction(type: InputActionType.Button, binding: "<Keyboard>/c");

        nextAction.performed += OnNext;
        enterAction.performed += OnNext;
        yesAction.performed += OnYes;
        chatAction.performed += OnChat;

        nextAction.Enable();
        enterAction.Enable();
        yesAction.Enable();
        chatAction.Enable();
    }

    void OnDestroy()
    {
        nextAction.performed -= OnNext;
        enterAction.performed -= OnNext;
        yesAction.performed -= OnYes;
        chatAction.performed -= OnChat;

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

        if (playerCamera == null)
        {
            playerCamera = Camera.main;
        }
    }

    void Update()
    {
        // Start intro as soon as Peccy is visible on screen
        if (!introStarted && !startManually && startWhenVisible)
        {
            if (IsPeccyVisibleOnScreen())
            {
                StartIntro();
            }
        }

        // Assistant mode bubble appears whenever Peccy is visible,
        // but NOT while chat UI is open
        if (introStarted && state == DialogueState.IdleAssistant)
        {
            if (chatUIOpen)
            {
                bubble.Hide();
            }
            else
            {
                if (IsPeccyVisibleOnScreen())
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

        if (state == DialogueState.Welcome)
        {
            ShowTourQuestion();
        }
        else if (state == DialogueState.TourQuestion)
        {
            // N or Enter here means No
            ChooseNo();
        }
    }

    private void OnYes(InputAction.CallbackContext ctx)
    {
        if (!introStarted) return;
        if (Time.time < ignoreInputUntilTime) return;
        if (state != DialogueState.TourQuestion) return;

        tourMode = true;
        assistantMode = false;
        bubble.Hide();

        Debug.Log("Tour mode selected (Y). Hook tour start later.");
    }

    private void OnChat(InputAction.CallbackContext ctx)
    {
        if (!introStarted) return;
        if (state != DialogueState.IdleAssistant) return;
        if (!IsPeccyVisibleOnScreen()) return;

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
        bubble.Hide();
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

        if (introStarted && state == DialogueState.IdleAssistant && IsPeccyVisibleOnScreen())
            bubble.Show("Need my Assistance? Let's Chat!", "Chat (C)");
        else
            bubble.Hide();
    }

    private bool IsPeccyVisibleOnScreen()
    {
        if (playerCamera == null) return false;

        // Fast check any renderer visible to any camera
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

        // Ensure Peccy is actually inside THIS camera view
        Vector3 p = playerCamera.WorldToViewportPoint(transform.position);

        // in front of camera and within screen bounds
        return (p.z > 0f && p.x > 0f && p.x < 1f && p.y > 0f && p.y < 1f);
    }
}
