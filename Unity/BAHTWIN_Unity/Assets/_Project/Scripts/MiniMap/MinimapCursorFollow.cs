using UnityEngine;

// Stable minimap cursor follow (no disappearing)
public class MinimapCursorFollow : MonoBehaviour
{
    public Transform player;
    public RectTransform mapRect;
    public RectTransform cursor;
    public Camera minimapCamera;

    [Range(0.45f, 0.5f)]
    public float edgePadding = 0.48f; // keeps cursor inside minimap

    void Update()
    {
        if (!player || !mapRect || !cursor || !minimapCamera)
            return;

        // Convert world to viewport
        Vector3 vp = minimapCamera.WorldToViewportPoint(player.position);

        // If player is behind camera, keep cursor centered
        if (vp.z <= 0f)
        {
            cursor.anchoredPosition = Vector2.zero;
            return;
        }

        // Clamp viewport values safely
        vp.x = Mathf.Clamp(vp.x, 0.5f - edgePadding, 0.5f + edgePadding);
        vp.y = Mathf.Clamp(vp.y, 0.5f - edgePadding, 0.5f + edgePadding);

        // Convert to UI space
        Vector2 mapSize = mapRect.rect.size;
        Vector2 uiPos = new Vector2(
            (vp.x - 0.5f) * mapSize.x,
            (vp.y - 0.5f) * mapSize.y
        );

        cursor.anchoredPosition = uiPos;

        // Rotate cursor with player
        cursor.localRotation = Quaternion.Euler(0, 0, -player.eulerAngles.y);
    }
}
