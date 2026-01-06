using System.Collections.Generic;
using UnityEngine;
using UnityEngine.AI;

public class RouteGuidanceController : MonoBehaviour
{
    [Header("Refs")]
    public Transform player;                 // FPS player transform
    public LineRenderer line;                // line renderer used for the route

    [Header("Path Update")]
    [Tooltip("How often to recalc path while user walks.")]
    public float recalcInterval = 0.4f;

    [Tooltip("Only recalc if player moved at least this much since last calc.")]
    public float recalcMoveThreshold = 0.6f;

    [Header("Path Fade (trim behind player)")]
    [Tooltip("Keep this much path behind player. 0 = trim immediately.")]
    public float keepBehindMeters = 0.0f;

    [Tooltip("Lift line above floor to avoid z-fighting.")]
    public float heightOffset = 0.08f;
    [Header("Arrival")]
    [Tooltip("Distance at which destination is considered reached.")]
    public float arrivalDistance = 1.3f;


    private string destinationKey;
    private Vector3 lastRecalcPos;
    private float nextRecalcTime;

    private Vector3[] fullCorners = null;    // full path corners from NavMesh
    private float[] cumulative = null;       // cumulative distance along path

    private readonly List<Vector3> trimmed = new();
    public bool IsRouteActive => !string.IsNullOrEmpty(destinationKey);


    void Reset()
    {
        line = GetComponent<LineRenderer>();
    }

    void Awake()
    {
        if (!line) line = GetComponent<LineRenderer>();
        if (line) line.positionCount = 0;
    }

    void Update()
    {
        if (string.IsNullOrEmpty(destinationKey) || player == null || line == null)
            return;

        // Auto-recalc path while walking
        if (Time.time >= nextRecalcTime)
        {
            float moved = Vector3.Distance(player.position, lastRecalcPos);
            if (fullCorners == null || moved >= recalcMoveThreshold)
            {
                RecalculatePath();
            }
            nextRecalcTime = Time.time + recalcInterval;
        }

        // Fade path as you progress (trim behind player)
        if (fullCorners != null && fullCorners.Length >= 2)
        {
            TrimPathBehindPlayer();
        }

        // Check if player reached destination
        if (fullCorners != null && fullCorners.Length > 0)
        {
            Vector3 destination = fullCorners[fullCorners.Length - 1];
            float dist = Vector3.Distance(player.position, destination);

            if (dist <= arrivalDistance)
            {
                ClearRoute();
            }
        }

    }

    // Call this when user clicks Show Route
    public void SetDestination(RoomSO room)
    {
        if (room == null) return;

        // Use the simplest stable key: room number if it exists, otherwise roomName
        if (room.roomNumber != 0)
            destinationKey = room.roomNumber.ToString();
        else
            destinationKey = room.roomName;

        RecalculatePath();
        nextRecalcTime = Time.time + recalcInterval;
    }

    public void ClearRoute()
    {
        destinationKey = null;
        fullCorners = null;
        cumulative = null;
        if (line) line.positionCount = 0;
    }

    private void RecalculatePath()
    {
        if (NavigationManager.Instance == null) return;

        NavMeshPath path;
        bool ok = NavigationManager.Instance.TryGetPathToRoom(destinationKey, player.position, out path);

        lastRecalcPos = player.position;

        if (!ok || path == null || path.corners == null || path.corners.Length < 2)
        {
            fullCorners = null;
            cumulative = null;
            line.positionCount = 0;
            return;
        }

        // Store full corners + cumulative distances
        fullCorners = path.corners;
        cumulative = BuildCumulative(fullCorners);

        // Draw initial full route
        ApplyCornersToLine(fullCorners);
    }

    private float[] BuildCumulative(Vector3[] corners)
    {
        var cum = new float[corners.Length];
        cum[0] = 0f;
        for (int i = 1; i < corners.Length; i++)
            cum[i] = cum[i - 1] + Vector3.Distance(corners[i - 1], corners[i]);
        return cum;
    }

    private void ApplyCornersToLine(Vector3[] corners)
    {
        line.positionCount = corners.Length;
        for (int i = 0; i < corners.Length; i++)
            line.SetPosition(i, corners[i] + Vector3.up * heightOffset);
    }

    private void TrimPathBehindPlayer()
    {
        // Find progress along polyline (closest point along segments)
        float playerS = FindClosestSOnPath(player.position, fullCorners, cumulative);

        float startS = Mathf.Max(0f, playerS - keepBehindMeters);

        // Build trimmed line from startS to end
        trimmed.Clear();
        BuildTrimmedPoints(startS, fullCorners, cumulative, trimmed);

        // Apply
        line.positionCount = trimmed.Count;
        for (int i = 0; i < trimmed.Count; i++)
            line.SetPosition(i, trimmed[i] + Vector3.up * heightOffset);
    }

    private float FindClosestSOnPath(Vector3 p, Vector3[] corners, float[] cum)
    {
        float bestS = 0f;
        float bestDistSq = float.PositiveInfinity;

        for (int i = 0; i < corners.Length - 1; i++)
        {
            Vector3 a = corners[i];
            Vector3 b = corners[i + 1];

            Vector3 ab = b - a;
            float abLenSq = ab.sqrMagnitude;
            if (abLenSq < 0.0001f) continue;

            float t = Vector3.Dot(p - a, ab) / abLenSq;
            t = Mathf.Clamp01(t);

            Vector3 proj = a + ab * t;
            float dSq = (p - proj).sqrMagnitude;

            if (dSq < bestDistSq)
            {
                bestDistSq = dSq;
                float segLen = Mathf.Sqrt(abLenSq);
                bestS = cum[i] + segLen * t;
            }
        }

        return bestS;
    }

    private void BuildTrimmedPoints(float startS, Vector3[] corners, float[] cum, List<Vector3> outPts)
    {
        // Find segment where startS lies
        int seg = 0;
        while (seg < cum.Length - 1 && cum[seg + 1] < startS) seg++;

        // Add interpolated first point at startS
        Vector3 a = corners[seg];
        Vector3 b = corners[Mathf.Min(seg + 1, corners.Length - 1)];
        float segStart = cum[seg];
        float segEnd = cum[Mathf.Min(seg + 1, cum.Length - 1)];
        float segLen = Mathf.Max(0.0001f, segEnd - segStart);

        float t = Mathf.Clamp01((startS - segStart) / segLen);
        outPts.Add(Vector3.Lerp(a, b, t));

        // Add remaining original corners from next corner onward
        for (int i = seg + 1; i < corners.Length; i++)
            outPts.Add(corners[i]);
    }
}
