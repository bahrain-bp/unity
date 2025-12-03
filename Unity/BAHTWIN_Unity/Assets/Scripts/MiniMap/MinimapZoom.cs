using UnityEngine;

public class MinimapZoom : MonoBehaviour
{
    public Camera minimapCamera;
    public float zoomStep = 2f;
    public float minSize = 5f;
    public float maxSize = 40f;

    void Start()
    {
        if (minimapCamera == null)
        {
            minimapCamera = GetComponent<Camera>();
        }
    }

    public void ZoomIn()
    {
        if (minimapCamera.orthographic)
        {
            minimapCamera.orthographicSize =
                Mathf.Max(minimapCamera.orthographicSize - zoomStep, minSize);
        }
    }

    public void ZoomOut()
    {
        if (minimapCamera.orthographic)
        {
            minimapCamera.orthographicSize =
                Mathf.Min(minimapCamera.orthographicSize + zoomStep, maxSize);
        }
    }
}
