using TMPro;
using UnityEngine;
using UnityEngine.UI;

public class ChatMessageItem : MonoBehaviour
{
    public TMP_Text messageText;
    public LayoutElement layoutElement;
    public RectTransform rect;
    public Image background;

    void Awake()
    {
        if (rect == null) rect = GetComponent<RectTransform>();
        if (layoutElement == null) layoutElement = GetComponent<LayoutElement>();
        if (messageText == null) messageText = GetComponentInChildren<TMP_Text>(true);
        if (background == null) background = GetComponent<Image>();
    }

    public void Set(string text, bool isBot)
    {
        if (messageText != null) messageText.text = text;

        if (rect == null) return;

        if (!isBot)
        {
            // USER on LEFT
            rect.anchorMin = new Vector2(0f, 1f);
            rect.anchorMax = new Vector2(0f, 1f);
            rect.pivot = new Vector2(0f, 1f);
            if (messageText != null) messageText.alignment = TextAlignmentOptions.Left;
        }
        else
        {
            // BOT on RIGHT
            rect.anchorMin = new Vector2(1f, 1f);
            rect.anchorMax = new Vector2(1f, 1f);
            rect.pivot = new Vector2(1f, 1f);
            if (messageText != null) messageText.alignment = TextAlignmentOptions.Right;
        }
    }
}
