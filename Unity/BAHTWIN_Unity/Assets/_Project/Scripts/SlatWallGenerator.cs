using UnityEngine;

public class SlatWallGenerator : MonoBehaviour
{
    [Header("Prefab")]
    public GameObject slatPrefab;

    [Header("Layout")]
    public int count = 20;
    public float spacing = 0.05f;     // gap between slats
    public float slatWidth = 0.08f;   // width of each slat (X direction)
    public float slatHeight = 2.5f;   // wall height
    public float slatDepth = 0.05f;   // thickness (Z direction)

    [Header("Direction")]
    public Vector3 direction = Vector3.right; // along the wall

    [ContextMenu("Rebuild Slats")]
    public void Rebuild()
    {
        // delete old
        for (int i = transform.childCount - 1; i >= 0; i--)
        {
            DestroyImmediate(transform.GetChild(i).gameObject);
        }

        if (!slatPrefab || count <= 0) return;

        direction = direction.normalized;
        float step = slatWidth + spacing;

        for (int i = 0; i < count; i++)
        {
            var slat = (GameObject)Instantiate(slatPrefab, transform);
            slat.name = $"Slat_{i:00}";
            slat.transform.position = transform.position + direction * (i * step);
            slat.transform.rotation = transform.rotation;

            // size it
            //slat.transform.localScale = new Vector3(slatWidth, slatHeight, slatDepth);
        }
    }
}
