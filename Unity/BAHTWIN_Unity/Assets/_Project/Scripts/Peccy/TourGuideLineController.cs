using System.Collections.Generic;
using UnityEngine;
using UnityEngine.AI;

public class TourGuideLineController : MonoBehaviour
{
    [Header("Refs")]
    public Transform player;
    public Transform target;          // Peccy during tour
    public LineRenderer line;

    [Header("Path Update")]
    public float recalcInterval = 0.4f;
    public float recalcMoveThreshold = 0.6f;

    [Header("Path Fade (trim behind player)")]
    public float keepBehindMeters = 0.0f;
    public float heightOffset = 0.08f;

    private Vector3 lastRecalcPos;
    private float nextRecalcTime;

    private Vector3[] fullCorners = null;
    private float[] cumulative = null;

    private readonly List<Vector3> trimmed = new();

    void Reset()
    {
        line = GetComponent<LineRenderer>();
    }

    void Awake()
    {
        if (!line) line = GetComponent<LineRenderer>();

        // IMPORTANT: hide line on scene start no matter what
        if (line)
        {
            line.positionCount = 0;
            line.enabled = false;
        }

        target = null;
    }

    void Update()
    {
        // Do nothing unless tour has set a target
        if (player == null || target == null || line == null) return;

        if (Time.time >= nextRecalcTime)
        {
            float moved = Vector3.Distance(player.position, lastRecalcPos);
            if (fullCorners == null || moved >= recalcMoveThreshold)
                RecalculatePath();

            nextRecalcTime = Time.time + recalcInterval;
        }

        if (fullCorners != null && fullCorners.Length >= 2)
            TrimPathBehindPlayer();
    }

    public void SetTarget(Transform newTarget)
    {
        target = newTarget;

        if (line)
        {
            line.enabled = (target != null);
            line.positionCount = 0;
        }

        RecalculatePath();
        nextRecalcTime = Time.time + recalcInterval;
    }

    public void ClearRoute()
    {
        target = null;
        fullCorners = null;
        cumulative = null;

        if (line)
        {
            line.positionCount = 0;
            line.enabled = false;
        }
    }

    private void RecalculatePath()
    {
        if (player == null || target == null || line == null) return;

        lastRecalcPos = player.position;

        var path = new NavMeshPath();
        bool ok = NavMesh.CalculatePath(player.position, target.position, NavMesh.AllAreas, path);

        if (!ok || path.corners == null || path.corners.Length < 2)
        {
            fullCorners = null;
            cumulative = null;
            line.positionCount = 0;
            return;
        }

        fullCorners = path.corners;
        cumulative = BuildCumulative(fullCorners);
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
        float playerS = FindClosestSOnPath(player.position, fullCorners, cumulative);
        float startS = Mathf.Max(0f, playerS - keepBehindMeters);

        trimmed.Clear();
        BuildTrimmedPoints(startS, fullCorners, cumulative, trimmed);

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
        int seg = 0;
        while (seg < cum.Length - 1 && cum[seg + 1] < startS) seg++;

        Vector3 a = corners[seg];
        Vector3 b = corners[Mathf.Min(seg + 1, corners.Length - 1)];
        float segStart = cum[seg];
        float segEnd = cum[Mathf.Min(seg + 1, cum.Length - 1)];
        float segLen = Mathf.Max(0.0001f, segEnd - segStart);

        float t = Mathf.Clamp01((startS - segStart) / segLen);
        outPts.Add(Vector3.Lerp(a, b, t));

        for (int i = seg + 1; i < corners.Length; i++)
            outPts.Add(corners[i]);
    }
}
