using UnityEngine;

public class ZoomTarget : MonoBehaviour
{
    [Header("Where the camera should go when zooming")]
    public Transform zoomPoint;

    [Header("Zoom settings")]
    public float zoomFov = 25f;
    public float transitionSeconds = 0.25f;

    [Header("Prompt text")]
    public string promptLook = "Press F to zoom";
    public string promptExit = "Press F to exit";

    void Reset()
    {
        // Auto find a child called ZoomPoint if it exists
        var t = transform.Find("ZoomPoint");
        if (t != null) zoomPoint = t;
    }
}
