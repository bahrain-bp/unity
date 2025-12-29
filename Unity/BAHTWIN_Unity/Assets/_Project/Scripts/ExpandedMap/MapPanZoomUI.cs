using UnityEngine;
using UnityEngine.EventSystems;

public class MapPanZoomUI : MonoBehaviour, IDragHandler
{
    [Header("References")]
    public RectTransform mapViewport;
    public RectTransform mapContent;

    [Header("Zoom Settings")]
    [SerializeField] float zoomStep = 0.25f;
    [SerializeField] float maxZoom = 3f;

    [Header("Pan Settings")]
    [SerializeField] float panSpeed = 1f;

    Vector3 defaultScale;
    Vector2 defaultAnchoredPosition;
    float minZoom;

    void Awake()
    {
        FitMapToViewport();
    }

    /* =======================
     * FIT MAP ON OPEN
     * ======================= */

    public void FitMapToViewport()
    {
        float viewportWidth = mapViewport.rect.width;
        float viewportHeight = mapViewport.rect.height;

        float mapWidth = mapContent.rect.width;
        float mapHeight = mapContent.rect.height;

        float scaleX = viewportWidth / mapWidth;
        float scaleY = viewportHeight / mapHeight;

        // Choose the smaller scale so the entire map fits
        minZoom = Mathf.Min(scaleX, scaleY);

        mapContent.localScale = Vector3.one * minZoom;
        mapContent.anchoredPosition = Vector2.zero;

        defaultScale = mapContent.localScale;
        defaultAnchoredPosition = mapContent.anchoredPosition;
    }

    /* =======================
     * ZOOM CONTROLS
     * ======================= */

    public void ZoomIn()
    {
        float next = Mathf.Min(mapContent.localScale.x + zoomStep, maxZoom);
        mapContent.localScale = Vector3.one * next;
    }

    public void ZoomOut()
    {
        float next = Mathf.Max(mapContent.localScale.x - zoomStep, minZoom);
        mapContent.localScale = Vector3.one * next;

        if (Mathf.Approximately(next, minZoom))
        {
            mapContent.localScale = defaultScale;
            mapContent.anchoredPosition = defaultAnchoredPosition;
        }
    }

    /* =======================
     * PAN
     * ======================= */

    public void OnDrag(PointerEventData eventData)
    {
        if (mapContent.localScale.x <= minZoom)
            return;

        mapContent.anchoredPosition += eventData.delta * panSpeed;
    }
}
