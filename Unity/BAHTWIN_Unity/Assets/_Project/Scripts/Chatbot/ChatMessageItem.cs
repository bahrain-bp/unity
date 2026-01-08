using TMPro;
using UnityEngine;
using UnityEngine.UI;

public class ChatMessageItem : MonoBehaviour
{
    [Header("Refs")]
    public TMP_Text messageText;

    [Tooltip("The Image on the Bubble object")]
    public Image bubbleBackground;

    [Tooltip("Spacer objects with LayoutElement")]
    public LayoutElement leftSpacer;
    public LayoutElement rightSpacer;

    [Header("Bubble Width Control")]
    [Tooltip("LayoutElement on the Bubble object.")]
    public LayoutElement bubbleLayout;
    public float maxBubbleWidth = 520f;

    [Header("Sprites")]
    public Sprite botBubbleSprite;
    public Sprite userBubbleSprite;

    void Awake()
    {
        if (!messageText) messageText = GetComponentInChildren<TMP_Text>(true);
    }

    public void Set(string text, bool isBot)
    {
        if (!messageText) return;

        messageText.enableWordWrapping = true;
        messageText.text = text;

        if (bubbleLayout)
        {
            bubbleLayout.preferredWidth = maxBubbleWidth;

            if (bubbleLayout.preferredHeight > 0) bubbleLayout.preferredHeight = -1;
        }

        if (bubbleBackground)
        {
            bubbleBackground.sprite = isBot ? botBubbleSprite : userBubbleSprite;
            bubbleBackground.type = Image.Type.Sliced;
        }

        if (isBot)
        {
            if (leftSpacer) leftSpacer.flexibleWidth = 0f;
            if (rightSpacer) rightSpacer.flexibleWidth = 1f;
            messageText.alignment = TextAlignmentOptions.Left;
        }
        else
        {
            if (leftSpacer) leftSpacer.flexibleWidth = 1f;
            if (rightSpacer) rightSpacer.flexibleWidth = 0f;
            messageText.alignment = TextAlignmentOptions.Left;
        }

        messageText.ForceMeshUpdate(true);
        LayoutRebuilder.ForceRebuildLayoutImmediate((RectTransform)transform);
    }
}
