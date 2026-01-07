using TMPro;
using UnityEngine;
using UnityEngine.UI;

public class ChatMessageItem : MonoBehaviour
{
    [Header("Refs")]
    public TMP_Text messageText;

    [Tooltip("The Image on the Bubble object (not the root).")]
    public Image bubbleBackground;

    [Tooltip("Spacer objects with LayoutElement (FlexibleWidth).")]
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
        if (messageText) messageText.text = text;

        // Limit bubble width so long text wraps
        if (bubbleLayout) bubbleLayout.preferredWidth = maxBubbleWidth;

        // Apply bubble sprite style
        if (bubbleBackground)
        {
            bubbleBackground.sprite = isBot ? botBubbleSprite : userBubbleSprite;
            bubbleBackground.type = Image.Type.Sliced; // requires sprite borders set in Sprite Editor
        }

        // Align bubble using spacers
        if (isBot)
        {
            if (leftSpacer) leftSpacer.flexibleWidth = 0f;
            if (rightSpacer) rightSpacer.flexibleWidth = 1f;

            if (messageText) messageText.alignment = TextAlignmentOptions.Left;
        }
        else
        {
            if (leftSpacer) leftSpacer.flexibleWidth = 1f;
            if (rightSpacer) rightSpacer.flexibleWidth = 0f;

            if (messageText) messageText.alignment = TextAlignmentOptions.Left;
        }
    }
}
