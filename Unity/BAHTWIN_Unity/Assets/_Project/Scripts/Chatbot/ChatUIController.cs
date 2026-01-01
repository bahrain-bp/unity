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

    [Header("Disable Gameplay While Chat Open (Simple Arrays)")]
    [Tooltip("Drag gameplay scripts here (movement, interaction raycast, teleport, etc.). Do NOT put EventSystem or chat UI scripts here.")]
    public Behaviour[] disableBehavioursWhileChatOpen;

    [Tooltip("Optional: drag gameplay GameObjects here (example: InteractPrompt UI, crosshair, gameplay panels). Do NOT put Chat UI here.")]
    public GameObject[] disableGameObjectsWhileChatOpen;

    // Conversation thread id (backend returns it, we send it back next time)
    private string sessionId = null;

    private bool waitingForReply = false;
    private ChatMessageItem typingItem;
    private bool hasSentFirstMessage = false;

    private bool[] cachedBehaviourStates;
    private bool[] cachedGameObjectStates;

    public bool IsOpen { get; private set; }

#if UNITY_WEBGL && !UNITY_EDITOR
    [DllImport("__Internal")]
    private static extern void AskPeccyAssistantFromUnity(string question, string sessionId, string unityObjectName);
#endif

    void Awake()
    {
        if (sendButton != null) sendButton.onClick.AddListener(SendFromInputField);
        if (closeButton != null) closeButton.onClick.AddListener(Close);

        HookQuickQuestionButtons();

        if (chatPanel != null) chatPanel.SetActive(false);
        IsOpen = false;

        SetInputEnabled(true);

        CacheDisableTargetsInitialStates();
    }

    void Update()
    {
        if (!IsOpen) return;

        if (Keyboard.current != null && Keyboard.current.escapeKey.wasPressedThisFrame)
            Close();

        if (Keyboard.current != null && Keyboard.current.enterKey.wasPressedThisFrame)
        {
            if (inputField != null && inputField.isFocused)
                SendFromInputField();
        }
    }

    public void Open()
    {
        if (chatPanel == null) return;

        // Disable FPS look so it doesn't fight focus/cursor
        if (fpsLookScript != null) fpsLookScript.enabled = false;

        // Snap camera instantly to Peccy/chat anchor
        if (chatFocus != null) chatFocus.SnapFocus();

        // Disable gameplay stuff
        ApplyDisableTargets(disable: true);

        chatPanel.SetActive(true);
        IsOpen = true;

        Cursor.lockState = CursorLockMode.None;
        Cursor.visible = true;

        if (peccyDialogue != null) peccyDialogue.OnChatOpened();

        RefreshQuickQuestionsVisibility();
        FocusInput();
    }

    public void Close()
    {
        if (chatPanel == null) return;

        chatPanel.SetActive(false);
        IsOpen = false;

        // Restore gameplay stuff
        ApplyDisableTargets(disable: false);

        Cursor.lockState = CursorLockMode.Locked;
        Cursor.visible = false;

        if (fpsLookScript != null) fpsLookScript.enabled = true;

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

    public void SendQuickQuestion(string question)
    {
        if (string.IsNullOrWhiteSpace(question)) return;

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
        Fail("Chat works only in WebGL build inside the website.", null);
#endif
    }

    public void OnAssistantResponseJson(string json)
    {
        HideTyping();

        var data = TryParse(json);

        if (data != null && !string.IsNullOrEmpty(data.answer))
        {
            AddMessage(data.answer, isBot: true);

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

        if (quickQuestionButtons != null)
        {
            foreach (var b in quickQuestionButtons)
                if (b != null) b.interactable = enabled;
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

    // -------------------------
    // Disable Targets (Simple)
    // -------------------------

    void CacheDisableTargetsInitialStates()
    {
        if (disableBehavioursWhileChatOpen != null)
        {
            cachedBehaviourStates = new bool[disableBehavioursWhileChatOpen.Length];
            for (int i = 0; i < disableBehavioursWhileChatOpen.Length; i++)
            {
                var b = disableBehavioursWhileChatOpen[i];
                cachedBehaviourStates[i] = (b != null && b.enabled);
            }
        }

        if (disableGameObjectsWhileChatOpen != null)
        {
            cachedGameObjectStates = new bool[disableGameObjectsWhileChatOpen.Length];
            for (int i = 0; i < disableGameObjectsWhileChatOpen.Length; i++)
            {
                var go = disableGameObjectsWhileChatOpen[i];
                cachedGameObjectStates[i] = (go != null && go.activeSelf);
            }
        }
    }

    void ApplyDisableTargets(bool disable)
    {
        // Behaviours
        if (disableBehavioursWhileChatOpen != null)
        {
            for (int i = 0; i < disableBehavioursWhileChatOpen.Length; i++)
            {
                var b = disableBehavioursWhileChatOpen[i];
                if (b == null) continue;

                // Safety: do not disable anything that lives under the chat UI
                if (chatPanel != null && b.transform.IsChildOf(chatPanel.transform)) continue;
                if (b == this) continue;

                if (disable)
                {
                    b.enabled = false;
                }
                else
                {
                    // restore original state
                    bool original = (cachedBehaviourStates != null && i < cachedBehaviourStates.Length) ? cachedBehaviourStates[i] : true;
                    b.enabled = original;
                }
            }
        }

        // GameObjects
        if (disableGameObjectsWhileChatOpen != null)
        {
            for (int i = 0; i < disableGameObjectsWhileChatOpen.Length; i++)
            {
                var go = disableGameObjectsWhileChatOpen[i];
                if (go == null) continue;

                // Safety: do not disable chat itself
                if (chatPanel != null && (go == chatPanel || go.transform.IsChildOf(chatPanel.transform))) continue;

                if (disable)
                {
                    go.SetActive(false);
                }
                else
                {
                    bool original = (cachedGameObjectStates != null && i < cachedGameObjectStates.Length) ? cachedGameObjectStates[i] : true;
                    go.SetActive(original);
                }
            }
        }
    }

    [Serializable]
    private class AssistantResponse
    {
        public string answer;
        public string sessionId;
    }
}
