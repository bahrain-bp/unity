using UnityEngine;
using TMPro;
using UnityEngine.UI;
using UnityEngine.InputSystem;


public class ChatUIController : MonoBehaviour
{
    [Header("UI Root")]
    public GameObject chatPanel;              

    [Header("Input")]
    public TMP_InputField inputField;         
    public Button sendButton;                 
    public Button closeButton;                

    [Header("Peccy Integration")]
    public PeccyDialogue peccyDialogue;
    public ChatFocus chatFocus;

    [Header("Optional: Disable FPS Look While Chat Open")]
    public Behaviour fpsLookScript;           

    public bool IsOpen { get; private set; }

    void Awake()
    {
        if (sendButton != null) sendButton.onClick.AddListener(OnSendClicked);
        if (closeButton != null) closeButton.onClick.AddListener(Close);

        if (chatPanel != null)
            chatPanel.SetActive(false);

        IsOpen = false;
    }

    void Update()
    {
        if (!IsOpen) return;

        // ESC closes chat (optional)
        if (Keyboard.current != null && Keyboard.current.escapeKey.wasPressedThisFrame)
        {
            Close();
        }

        // Enter sends (only if the input is focused)
        if (Keyboard.current != null && Keyboard.current.enterKey.wasPressedThisFrame)
        {
            if (inputField != null && inputField.isFocused)
            {
                OnSendClicked();
            }
        }
    }

    public void Open()
    {
        if (chatPanel == null) return;

        // Disable FPS first so it doesn't fight the snap
        if (fpsLookScript != null) fpsLookScript.enabled = false;

        // Snap camera instantly to Peccy/chat anchor
        if (chatFocus != null) chatFocus.SnapFocus();

        // Now open UI + cursor
        chatPanel.SetActive(true);
        IsOpen = true;

        Cursor.lockState = CursorLockMode.None;
        Cursor.visible = true;

        if (peccyDialogue != null) peccyDialogue.OnChatOpened();

        if (inputField != null)
        {
            inputField.ActivateInputField();
            inputField.Select();
        }
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

    private void OnSendClicked()
    {
        if (inputField == null) return;

        string text = inputField.text;
        if (string.IsNullOrWhiteSpace(text)) return;

        // For now: just clear input. Next step we will add message spawning + backend call.
        Debug.Log("Chat Send: " + text);
        inputField.text = "";
        inputField.ActivateInputField();
    }
}
