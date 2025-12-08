using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.AI;

/// <summary>
/// Small helper struct that links a RoomSO to a specific entrance point in the scene.
/// One room can have multiple RoomNavInfo entries if it has several doors.
/// </summary>
[Serializable]
public class RoomNavInfo
{
    public RoomSO roomData;            // ScriptableObject with metadata (room name, number, ID, etc.)
    public Transform anchorTransform;  // World position where the NavigationManager should guide the user to
}

/// <summary>
/// Central navigation system for the entire office.
/// Other scripts NEVER talk to the NavMesh directly.
/// Instead, they ask this manager:
///
///    NavigationManager.Instance.TryGetPathToRoom("504", fromPos, out path)
///
/// Room keys can be:
///  • "504"
///  • "02.504"
///  • "Kitchen"
///  • "Restroom"
///  • roomID from RoomSO
///
/// It automatically finds all RoomLabel components in the scene
/// and maps every room to its entrance anchors.
/// </summary>
public class NavigationManager : MonoBehaviour
{
    public static NavigationManager Instance { get; private set; }

    [Header("Optional Debug Test")]
    [Tooltip("If enabled, tests one path on Start for quick verification.")]
    [SerializeField] private bool runDebugOnStart = false;

    [Tooltip("Start point used only for debug path testing.")]
    [SerializeField] private Transform debugStartPoint;

    [Tooltip("Room key used for the debug test path.")]
    [SerializeField] private string debugRoomKey = "504";

    [Header("Optional Logging")]
    [Tooltip("Print all discovered room keys in the console.")]
    [SerializeField] private bool logKeysInConsole = false;

    [Tooltip("Print warnings (missing rooms, missing paths).")]
    [SerializeField] private bool logWarnings = false;

    // Internal lookup:
    // One room can be known by many keys:
    //  - roomID
    //  - roomNumber (“504”)
    //  - floor.roomNumber (“02.504”)
    //  - roomName (“Kitchen”)
    //
    // Each roomKey can have multiple entrances.
    private readonly Dictionary<string, List<RoomNavInfo>> roomsByKey =
        new Dictionary<string, List<RoomNavInfo>>();

    private void Awake()
    {
        // Simple singleton pattern so other scripts can safely call:
        // NavigationManager.Instance
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }

        Instance = this;
        BuildRoomsLookup();
    }

    private void Start()
    {
        if (logKeysInConsole)
            LogAllRoomKeys();

        // Optional debug test once on Start
        if (runDebugOnStart && debugStartPoint != null && !string.IsNullOrWhiteSpace(debugRoomKey))
        {
            if (TryGetPathToRoom(debugRoomKey, debugStartPoint.position, out var path))
            {
                if (logWarnings)
                    Debug.Log($"[NavigationManager] Debug path to '{debugRoomKey}' has {path.corners.Length} corners.");
            }
            else
            {
                if (logWarnings)
                    Debug.LogWarning($"[NavigationManager] Could not get debug path to '{debugRoomKey}'.");
            }
        }
    }

    // ----------------------------------------------------------------------
    // Building the lookup from RoomLabels in the scene
    // ----------------------------------------------------------------------

    /// <summary>
    /// Adds a new key → (room, anchor) mapping.
    /// If the key already exists, adds another entrance to the same key.
    /// </summary>
    private void AddRoomKey(string key, RoomSO data, Transform anchor)
    {
        if (string.IsNullOrWhiteSpace(key) || anchor == null)
            return;

        key = key.Trim();

        if (!roomsByKey.TryGetValue(key, out var list))
        {
            list = new List<RoomNavInfo>();
            roomsByKey[key] = list;
        }

        list.Add(new RoomNavInfo
        {
            roomData = data,
            anchorTransform = anchor
        });
    }

    /// <summary>
    /// Finds all RoomLabel components and registers each room
    /// using multiple possible keys (name, number, ID).
    /// This is the heart of the navigation system.
    /// </summary>
    private void BuildRoomsLookup()
    {
        roomsByKey.Clear();

        RoomLabel[] labels = FindObjectsByType<RoomLabel>(
            FindObjectsInactive.Include,
            FindObjectsSortMode.None
        );

        foreach (var label in labels)
        {
            if (label.roomData == null)
                continue;

            RoomSO data = label.roomData;
            Transform anchor = label.transform; // label position is used as the room anchor

            // Key 1: custom roomID
            if (!string.IsNullOrWhiteSpace(data.roomID))
                AddRoomKey(data.roomID, data, anchor);

            // Key 2: numeric roomNumber (e.g. “504”)
            if (data.roomNumber > 0)
            {
                AddRoomKey(data.roomNumber.ToString(), data, anchor);

                // Key 3: “02.504” format — floor + number
                string floorDot = $"02.{data.roomNumber}";
                AddRoomKey(floorDot, data, anchor);
            }

            // Key 4: roomName (e.g. Kitchen, Restroom)
            if (!string.IsNullOrWhiteSpace(data.roomName))
                AddRoomKey(data.roomName, data, anchor);
        }

        if (logKeysInConsole)
            Debug.Log($"[NavigationManager] Built room lookup with {roomsByKey.Count} unique room keys.");
    }

    /// <summary>
    /// Prints all room keys found in this scene.
    /// Helps designers know exactly what to type into the UI.
    /// </summary>
    private void LogAllRoomKeys()
    {
        Debug.Log("[NavigationManager] Known room keys:");

        foreach (var kvp in roomsByKey)
        {
            int entrances = kvp.Value?.Count ?? 0;
            Debug.Log($"   '{kvp.Key}' -> {entrances} entrance(s)");
        }
    }

    // ----------------------------------------------------------------------
    // Lookup helper
    // ----------------------------------------------------------------------

    /// <summary>
    /// Returns the world position of the first entrance for a given room key.
    /// </summary>
    public bool TryGetRoomPosition(string roomKey, out Vector3 position)
    {
        position = Vector3.zero;

        if (roomsByKey.TryGetValue(roomKey, out var list) &&
            list.Count > 0 &&
            list[0].anchorTransform != null)
        {
            position = list[0].anchorTransform.position;
            return true;
        }

        if (logWarnings)
            Debug.LogWarning($"[NavigationManager] No entrances found for room key '{roomKey}'.");
        return false;
    }

    // ----------------------------------------------------------------------
    // NavMesh Helpers
    // ----------------------------------------------------------------------

    /// <summary>
    /// Snaps a point to the NavMesh.
    /// If pushInside = true, nudges it slightly deeper inside the walkable area.
    /// Prevents paths from starting/ending on the border of the NavMesh.
    /// </summary>
    private bool TryGetNearestNavMeshPoint(
        Vector3 worldPosition,
        out Vector3 navMeshPosition,
        float maxDistance = 2f,
        bool pushInside = false)
    {
        navMeshPosition = worldPosition;

        if (!NavMesh.SamplePosition(worldPosition, out NavMeshHit hit, maxDistance, NavMesh.AllAreas))
        {
            if (logWarnings)
                Debug.LogWarning($"[NavigationManager] No NavMesh near {worldPosition}");
            return false;
        }

        navMeshPosition = hit.position;

        if (!pushInside)
            return true;

        // Nudge slightly toward inside
        Vector3 dir = hit.position - worldPosition;
        dir.y = 0f;

        if (dir.sqrMagnitude < 0.0001f)
            dir = Vector3.forward;

        dir.Normalize();

        const float pushDistance = 0.4f;
        Vector3 candidate = hit.position + dir * pushDistance;

        if (NavMesh.SamplePosition(candidate, out NavMeshHit innerHit, 0.5f, NavMesh.AllAreas))
            navMeshPosition = innerHit.position;

        return true;
    }

    // ----------------------------------------------------------------------
    // Public API that other scripts will use
    // ----------------------------------------------------------------------

    /// <summary>
    /// Calculates a NavMesh path between two world positions.
    /// Both points are snapped to the NavMesh automatically.
    /// Partial paths are still accepted as long as Unity returns corners.
    /// </summary>
    public bool TryCalculatePath(Vector3 fromWorld, Vector3 toWorld, out NavMeshPath path)
    {
        path = new NavMeshPath();

        if (!TryGetNearestNavMeshPoint(fromWorld, out var startOnNav, 20f, false))
            return false;

        if (!TryGetNearestNavMeshPoint(toWorld, out var endOnNav, 20f, true))
            return false;

        bool success = NavMesh.CalculatePath(startOnNav, endOnNav, NavMesh.AllAreas, path);

        if (!success || path.corners.Length < 2)
            return false;

        return true;
    }

    /// <summary>
    /// Main API used by UI, Peccy, and player interaction.
    /// Finds the entrance of a room (by name/number/ID),
    /// then calculates a path to it.
    /// </summary>
    public bool TryGetPathToRoom(string roomKey, Vector3 fromWorld, out NavMeshPath path)
    {
        path = null;

        if (!TryGetRoomPosition(roomKey, out var roomPos))
            return false;

        if (!TryCalculatePath(fromWorld, roomPos, out var computedPath))
            return false;

        path = computedPath;
        return true;
    }
}