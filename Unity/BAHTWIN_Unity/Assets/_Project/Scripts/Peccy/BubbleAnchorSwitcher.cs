using UnityEngine;

public class BubbleAnchorSwitcher : MonoBehaviour
{
    [Header("Anchors")]
    public Transform normalAnchor;   // PeccyBubbleNorm
    public Transform safeAnchor;     // PeccyHeadAnchor

    [Header("Camera")]
    public Camera cam;

    [Header("Wall Detection")]
    public LayerMask wallMask;
    public float extraPadding = 0.02f;
    public float boxThicknessZ = 0.05f;

    [Header("Bubble Size Source")]
    public RectTransform bubbleRect;

    [Header("Safe Offset (world units)")]
    public float safeSideOffset = 0.25f;   // how far to shift sideways when blocked
    public float safeUpOffset = 0.00f;     // optional: move a bit up when blocked

    [Header("Debug")]
    public bool debugDraw = false;

    void Awake()
    {
        if (cam == null) cam = Camera.main;
        if (bubbleRect == null) bubbleRect = GetComponent<RectTransform>();
    }

    void LateUpdate()
    {
        if (normalAnchor == null || safeAnchor == null || cam == null || bubbleRect == null) return;

        // Always face camera
        transform.forward = cam.transform.forward;

        // 1) Try normal position
        transform.position = normalAnchor.position;

        if (!IsBubbleOverlappingWall(transform.position))
        {
            if (debugDraw) DrawOverlapBoxGizmo(transform.position, Color.green);
            return;
        }

        // 2) If blocked, try safe anchor centered
        Vector3 safeBase = safeAnchor.position + Vector3.up * safeUpOffset;

        // Sideways direction relative to camera (screen right)
        Vector3 side = cam.transform.right;
        side.y = 0f;
        side.Normalize();

        Vector3 tryRight = safeBase + side * safeSideOffset;
        Vector3 tryLeft = safeBase - side * safeSideOffset;

        bool rightOk = !IsBubbleOverlappingWall(tryRight);
        bool leftOk = !IsBubbleOverlappingWall(tryLeft);

        if (rightOk && leftOk)
        {
            // Choose whichever is farther from camera center direction (optional)
            // Here we pick the one with more clearance by checking distance to nearest hit is more complex,
            // so we just choose right by default if both are fine.
            transform.position = tryRight;
        }
        else if (rightOk)
        {
            transform.position = tryRight;
        }
        else if (leftOk)
        {
            transform.position = tryLeft;
        }
        else
        {
            // Both sides still blocked, fall back to safe base
            transform.position = safeBase;
        }

        if (debugDraw) DrawOverlapBoxGizmo(transform.position, Color.yellow);
    }

    bool IsBubbleOverlappingWall(Vector3 testCenter)
    {
        Vector2 size = bubbleRect.rect.size;

        float halfX = (size.x * bubbleRect.lossyScale.x) * 0.5f + extraPadding;
        float halfY = (size.y * bubbleRect.lossyScale.y) * 0.5f + extraPadding;
        float halfZ = boxThicknessZ * 0.5f;

        Vector3 halfExtents = new Vector3(halfX, halfY, halfZ);

        Collider[] hits = Physics.OverlapBox(
            testCenter,
            halfExtents,
            bubbleRect.rotation,
            wallMask,
            QueryTriggerInteraction.Ignore
        );

        return hits != null && hits.Length > 0;
    }

    void DrawOverlapBoxGizmo(Vector3 center, Color color)
    {
        Vector2 size = bubbleRect.rect.size;

        float halfX = (size.x * bubbleRect.lossyScale.x) * 0.5f + extraPadding;
        float halfY = (size.y * bubbleRect.lossyScale.y) * 0.5f + extraPadding;

        Debug.DrawLine(center + new Vector3(-halfX, -halfY, 0), center + new Vector3(halfX, -halfY, 0), color);
        Debug.DrawLine(center + new Vector3(halfX, -halfY, 0), center + new Vector3(halfX, halfY, 0), color);
        Debug.DrawLine(center + new Vector3(halfX, halfY, 0), center + new Vector3(-halfX, halfY, 0), color);
        Debug.DrawLine(center + new Vector3(-halfX, halfY, 0), center + new Vector3(-halfX, -halfY, 0), color);
    }
}
