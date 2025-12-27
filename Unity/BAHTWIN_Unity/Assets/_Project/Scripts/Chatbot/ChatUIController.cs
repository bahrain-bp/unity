using UnityEngine;
using TMPro;
using UnityEngine.UI;
using UnityEngine.InputSystem;


public class ChatUIController : MonoBehaviour
{
    [Header("UI Root")]
    public GameObject chatPanel;              // ChatPanel (the one you disabled by default)

    [Header("Input")]
    public TMP_InputField inputField;         // ChatInput
    public Button sendButton;                 // SendButton
    public Button closeButton;                // CloseButton

    [Header("Optional: Disable FPS Look While Chat Open")]
    public Behaviour fpsLookScript;           // drag your mouse-look script here (or player controller look script)

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

        // ESC closes chat (optional but helpful)
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

        chatPanel.SetActive(true);
        IsOpen = true;

        // Enable cursor so UI is clickable (FPS normally locks it)
        Cursor.lockState = CursorLockMode.None;
        Cursor.visible = true;

        // Disable FPS look so mouse doesn't rotate camera while clicking UI
        if (fpsLookScript != null) fpsLookScript.enabled = false;

        // Focus input so user can type immediately
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

        // Return to FPS mode
        Cursor.lockState = CursorLockMode.Locked;
        Cursor.visible = false;

        if (fpsLookScript != null) fpsLookScript.enabled = true;
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
