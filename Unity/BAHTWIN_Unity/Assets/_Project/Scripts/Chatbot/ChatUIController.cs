using System;
using UnityEngine;
using TMPro;
using UnityEngine.UI;
using UnityEngine.InputSystem;

#if UNITY_WEBGL && !UNITY_EDITOR
using System.Runtime.InteropServices;
#endif

public class ChatUIController : MonoBehaviour
{
    [Header("UI")]
    public GameObject chatPanel;
    public TMP_InputField inputField;
    public Button sendButton;
    public Button closeButton;

    [Header("Messages")]
    public Transform contentRoot;
    public ScrollRect scrollRect;
    public ChatMessageItem messagePrefab;

    [Header("Quick Questions UI")]
    [Tooltip("Parent GameObject that contains the quick question buttons (the plane/panel).")]
    public GameObject quickQuestionsPanel;
    [Tooltip("Optional: Buttons inside the quick questions panel. If set, this script will hook them automatically.")]
    public Button[] quickQuestionButtons;
    [Tooltip("The text to send when each quick question button is clicked. Must match the buttons order.")]
    public string[] quickQuestionTexts;

    [Header("Peccy Integration")]
    public PeccyDialogue peccyDialogue;
    public ChatFocus chatFocus;

    [Header("Optional: Disable FPS Look While Chat Open")]
    public Behaviour fpsLookScript;

    // Conversation thread id (backend returns it, we send it back next time)
    private string sessionId = null;

    // Prevent sending multiple messages while waiting
    private bool waitingForReply = false;

    // Keep reference so we can remove "Typing..."
    private ChatMessageItem typingItem;

    // Track if user already asked something (so we hide quick questions after first send)
    private bool hasSentFirstMessage = false;

    public bool IsOpen { get; private set; }

#if UNITY_WEBGL && !UNITY_EDITOR
    [DllImport("__Internal")]
    private static extern void AskPeccyAssistantFromUnity(string question, string sessionId, string unityObjectName);
#endif

    void Awake()
    {
        if (sendButton != null) sendButton.onClick.AddListener(SendFromInputField);
        if (closeButton != null) closeButton.onClick.AddListener(Close);

        // Hook quick question buttons (optional convenience)
        HookQuickQuestionButtons();

        if (chatPanel != null) chatPanel.SetActive(false);
        IsOpen = false;

        SetInputEnabled(true);
    }

    void Update()
    {
        if (!IsOpen) return;

        // ESC closes chat
        if (Keyboard.current != null && Keyboard.current.escapeKey.wasPressedThisFrame)
            Close();

        // Enter sends if typing in the input field
        if (Keyboard.current != null && Keyboard.current.enterKey.wasPressedThisFrame)
        {
            if (inputField != null && inputField.isFocused)
                SendFromInputField();
        }
    }

    public void Open()
    {
        if (chatPanel == null) return;

        // Disable FPS first so it doesn't fight the snap
        if (fpsLookScript != null) fpsLookScript.enabled = false;

        // Snap camera instantly to Peccy/chat anchor
        if (chatFocus != null) chatFocus.SnapFocus();

        chatPanel.SetActive(true);
        IsOpen = true;

        Cursor.lockState = CursorLockMode.None;
        Cursor.visible = true;

        if (peccyDialogue != null) peccyDialogue.OnChatOpened();

        // Show quick questions only if user hasn't sent anything yet
        RefreshQuickQuestionsVisibility();

        FocusInput();
    }

    public void Close()
    {
        if (chatPanel == null) return;

        chatPanel.SetActive(false);
        IsOpen = false;

        Cursor.lockState = CursorLockMode.Locked;
        Cursor.visible = false;

        if (fpsLookScript != null) fpsLookScript.enabled = true;

        // Restore bubble + stop focus
        if (chatFocus != null) chatFocus.StopFocus();
        if (peccyDialogue != null) peccyDialogue.OnChatClosed();
    }

    void SendFromInputField()
    {
        if (inputField == null) return;

        string text = inputField.text;
        if (string.IsNullOrWhiteSpace(text)) return;

        inputField.text = "";
        FocusInput();

        SendQuestion(text);
    }

    // Called by quick question buttons (either automatically hooked or manually from Inspector)
    public void SendQuickQuestion(string question)
    {
        if (string.IsNullOrWhiteSpace(question)) return;

        // Optional: also populate input field so user "sees" what was sent
        if (inputField != null)
        {
            inputField.text = "";
            FocusInput();
        }

        SendQuestion(question);
    }

    void SendQuestion(string question)
    {
        if (!IsOpen) return;
        if (waitingForReply) return;

        // First message? then hide quick questions panel
        if (!hasSentFirstMessage)
        {
            hasSentFirstMessage = true;
            RefreshQuickQuestionsVisibility(forceHide: true);
        }

        AddMessage(question, isBot: false);
        ShowTyping();

        waitingForReply = true;
        SetInputEnabled(false);

#if UNITY_WEBGL && !UNITY_EDITOR
        try
        {
            AskPeccyAssistantFromUnity(question, sessionId ?? "", gameObject.name);
        }
        catch (Exception e)
        {
            Fail("Chat bridge plugin call failed (AskPeccyAssistantFromUnity).", e);
        }
#else
        // Editor cannot use the bridge (no website token/storage).
        Fail("Chat works only in WebGL build inside the website.", null);
#endif
    }

    // JS calls this back:
    // unityInstance.SendMessage(unityObjectName, "OnAssistantResponseJson", JSON.stringify(payload))
    public void OnAssistantResponseJson(string json)
    {
        HideTyping();

        var data = TryParse(json);

        if (data != null && !string.IsNullOrEmpty(data.answer))
        {
            AddMessage(data.answer, isBot: true);

            // Save sessionId for the next question
            if (!string.IsNullOrEmpty(data.sessionId))
                sessionId = data.sessionId;
        }
        else
        {
            AddMessage("I got a response but it didn't include an answer.", isBot: true);
        }

        waitingForReply = false;
        SetInputEnabled(true);
        FocusInput();
    }

    AssistantResponse TryParse(string json)
    {
        try
        {
            // JsonUtility ignores extra fields (status/message), so safe.
            return JsonUtility.FromJson<AssistantResponse>(json);
        }
        catch
        {
            Debug.LogError("Failed to parse assistant JSON: " + json);
            return null;
        }
    }

    void Fail(string userMessage, Exception e)
    {
        HideTyping();
        AddMessage(userMessage, isBot: true);

        if (e != null) Debug.LogError(e);

        waitingForReply = false;
        SetInputEnabled(true);
        FocusInput();
    }

    void AddMessage(string text, bool isBot)
    {
        if (messagePrefab == null || contentRoot == null) return;

        var item = Instantiate(messagePrefab, contentRoot);
        item.Set(text, isBot);

        Canvas.ForceUpdateCanvases();
        if (scrollRect != null) scrollRect.verticalNormalizedPosition = 0f;
    }

    void ShowTyping()
    {
        if (typingItem != null) return;
        if (messagePrefab == null || contentRoot == null) return;

        typingItem = Instantiate(messagePrefab, contentRoot);
        typingItem.Set("Typing...", isBot: true);

        Canvas.ForceUpdateCanvases();
        if (scrollRect != null) scrollRect.verticalNormalizedPosition = 0f;
    }

    void HideTyping()
    {
        if (typingItem == null) return;
        Destroy(typingItem.gameObject);
        typingItem = null;
    }

    void SetInputEnabled(bool enabled)
    {
        if (sendButton != null) sendButton.interactable = enabled;
        if (inputField != null) inputField.interactable = enabled;

        // Optional: disable quick questions while waiting so user can't spam
        if (quickQuestionButtons != null)
        {
            foreach (var b in quickQuestionButtons)
            {
                if (b != null) b.interactable = enabled;
            }
        }
    }

    void FocusInput()
    {
        if (inputField == null) return;
        inputField.ActivateInputField();
        inputField.Select();
    }

    void RefreshQuickQuestionsVisibility(bool forceHide = false)
    {
        if (quickQuestionsPanel == null) return;

        if (forceHide)
        {
            quickQuestionsPanel.SetActive(false);
            return;
        }

        // Show only if first message not sent yet
        quickQuestionsPanel.SetActive(!hasSentFirstMessage);
    }

    void HookQuickQuestionButtons()
    {
        if (quickQuestionButtons == null || quickQuestionButtons.Length == 0) return;
        if (quickQuestionTexts == null || quickQuestionTexts.Length == 0) return;

        int count = Mathf.Min(quickQuestionButtons.Length, quickQuestionTexts.Length);

        for (int i = 0; i < count; i++)
        {
            var btn = quickQuestionButtons[i];
            string q = quickQuestionTexts[i];

            if (btn == null) continue;

            btn.onClick.RemoveAllListeners();
            btn.onClick.AddListener(() => SendQuickQuestion(q));
        }
    }

    [Serializable]
    private class AssistantResponse
    {
        public string answer;
        public string sessionId;
    }
}
