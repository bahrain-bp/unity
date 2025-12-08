using UnityEngine;
using UnityEngine.AI;

/// <summary>
/// Simple helper that draws a navigation path using Unity Gizmos.
/// This never appears in gameplay — only visible in the editor for debugging.
/// </summary>
public class PathDebugDrawer : MonoBehaviour
{
    [Header("Path Setup")]
    [Tooltip("Start point of the path (e.g. player transform).")]
    public Transform startPoint;

    [Tooltip("Room key to navigate to (e.g. 504, 02.504, Kitchen).")]
    public string roomId = "504";

    [Tooltip("How often the path is recalculated (seconds).")]
    public float refreshInterval = 0.25f;

    [Header("Gizmos")]
    [Tooltip("If true, only draws in Play Mode.")]
    public bool drawOnlyDuringPlayMode = true;

    [Header("Warnings")]
    [Tooltip("If true, prints a few warnings when no path is found.")]
    public bool showWarnings = false;

    private NavMeshPath debugPath;
    private float timer;
    private int warnCount = 0;
    private const int maxWarn = 5;

    private void Update()
    {
        if (NavigationManager.Instance == null || startPoint == null)
            return;

        timer += Time.deltaTime;
        if (timer < refreshInterval)
            return;

        timer = 0f;

        bool gotPath = NavigationManager.Instance.TryGetPathToRoom(
            roomId,
            startPoint.position,
            out var path
        );

        if (!gotPath)
        {
            if (showWarnings && warnCount < maxWarn)
            {
                Debug.LogWarning($"[PathDebugDrawer] Could not get path to '{roomId}'.");
                warnCount++;
            }

            debugPath = null;
            return;
        }

        debugPath = path;
    }

    private void OnDrawGizmos()
    {
        if (drawOnlyDuringPlayMode && !Application.isPlaying)
            return;

        if (debugPath == null || debugPath.corners == null || debugPath.corners.Length < 2)
            return;

        Gizmos.color = Color.green;

        for (int i = 0; i < debugPath.corners.Length - 1; i++)
        {
            Gizmos.DrawLine(debugPath.corners[i], debugPath.corners[i + 1]);
            Gizmos.DrawSphere(debugPath.corners[i], 0.2f);
        }

        Gizmos.DrawSphere(debugPath.corners[^1], 0.25f);
    }
}
