using UnityEngine;

public class MinimapCursorFollow : MonoBehaviour
{
    public Transform player;
    public RectTransform mapRect;
    public RectTransform cursor;

    public Vector2 worldMin;
    public Vector2 worldMax;

    void Update()
    {
        // 1. Get player world position (X,Z)
        Vector2 playerXZ = new Vector2(player.position.x, player.position.z);

        // 2. Normalize (0–1)
        float nx = Mathf.InverseLerp(worldMin.x, worldMax.x, playerXZ.x);
        float ny = Mathf.InverseLerp(worldMin.y, worldMax.y, playerXZ.y);

        // 3. Convert to UI space
        Vector2 mapSize = mapRect.rect.size;
        Vector2 uiPos = new Vector2(
            (nx - 0.5f) * mapSize.x,
            (ny - 0.5f) * mapSize.y
        );

        // 4. Apply position
        cursor.anchoredPosition = uiPos;

        // 5. Rotation (Y → Z)
        cursor.localRotation = Quaternion.Euler(0, 0, -player.eulerAngles.y);
    }
}
