using TMPro;
using UnityEngine;

public class SpeechBubbleUI : MonoBehaviour
{
    [Header("UI References")]
    [SerializeField] private TMP_Text messageText;
    [SerializeField] private TMP_Text optionsText;

    void Reset()
    {
        // Auto-fill if you added this script on the root bubble object
        if (!messageText) messageText = transform.GetComponentInChildren<TMP_Text>();
    }

    public void Show(string message, string options)
    {
        gameObject.SetActive(true);
        SetMessage(message);
        SetOptions(options);
    }

    public void Hide()
    {
        gameObject.SetActive(false);
    }

    public void SetMessage(string message)
    {
        if (messageText != null)
            messageText.text = message; // TMP text update
    }

    public void SetOptions(string options)
    {
        if (optionsText != null)
            optionsText.text = options; // TMP text update
    }
}
