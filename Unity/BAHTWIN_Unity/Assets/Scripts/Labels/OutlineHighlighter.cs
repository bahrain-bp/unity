using UnityEngine;

[RequireComponent(typeof(Renderer))]
public class OutlineHighlighter : MonoBehaviour
{
    private Renderer rend;
    private MaterialPropertyBlock block;
    public bool highlighted = false;

    [Header("Outline Settings")]
    public Color outlineColor = Color.yellow;
    public float outlineWidth = 4f;

    private void Awake()
    {
        rend = GetComponent<Renderer>();
        block = new MaterialPropertyBlock();
    }

    public void SetHighlight(bool state)
    {
        highlighted = state;

        if (rend == null) return;

        rend.GetPropertyBlock(block);
        block.SetFloat("_OutlineEnabled", highlighted ? 1f : 0f);
        block.SetColor("_OutlineColor", outlineColor);
        block.SetFloat("_OutlineWidth", outlineWidth);
        rend.SetPropertyBlock(block);
    }
}

