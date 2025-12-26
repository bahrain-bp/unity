using TMPro;
using UnityEngine;

public class SpeechBubbleUI : MonoBehaviour
{
    [Header("UI References")]
    [SerializeField] private TMP_Text messageText;
    [SerializeField] private TMP_Text optionsText;

    void Reset()
    {
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
            messageText.text = message;
    }

    public void SetOptions(string options)
    {
        if (optionsText != null)
            optionsText.text = options;
    }
}
