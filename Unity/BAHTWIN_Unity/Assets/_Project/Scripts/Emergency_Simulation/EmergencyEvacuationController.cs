using UnityEngine;
using UnityEngine.AI;
using TMPro;

public class EmergencyEvacuationController : MonoBehaviour
{
    [Header("Refs")]
    public Transform player;                         // FPS player transform
    public RouteGuidanceController routeController;  // RED route line object

    [Header("Emergency Exits (RoomSO)")]
    public RoomSO[] emergencyExits;                  // size = 3

    [Header("UI")]
    public TMP_Text statusText;                      // center screen text
    public ModeButtonsUI modeButtonsUI;              // reset Emergency button visuals

    [Header("Arrival")]
    public float arrivalDistance = 1.3f;

    bool evacuating;
    Vector3 destinationWorld;
    bool hasDestination;
    [Header("Audio")]
    public AudioSource alarmSource;


    void Awake()
    {
        if (routeController != null)
            routeController.gameObject.SetActive(false);

        if (statusText != null)
            statusText.gameObject.SetActive(false);
    }

    // Called from EmergencyModeController when "Start Evacuation" is pressed
    public void StartEvacuation()
    {
        if (evacuating) return;
        if (player == null || routeController == null) return;
        if (NavigationManager.Instance == null) return;
        if (emergencyExits == null || emergencyExits.Length == 0) return;

        if (!TryFindNearestExit(out RoomSO nearestExit, out Vector3 destWorld))
        {
            ShowTempMessage("No safe evacuation route found");
            return;
        }

        evacuating = true;
        hasDestination = true;
        destinationWorld = destWorld;

        routeController.gameObject.SetActive(true);
        routeController.arrivalDistance = arrivalDistance;
        routeController.SetDestination(nearestExit);
        if (alarmSource != null && !alarmSource.isPlaying)
        {
            alarmSource.Play();
        }

        ShowMessage("Follow the route to the nearest exit");
    }

    void Update()
    {
        if (!evacuating || !hasDestination || player == null)
            return;

        float d = Vector3.Distance(player.position, destinationWorld);
        if (d <= arrivalDistance)
        {
            CompleteEvacuation();
        }
    }

    void CompleteEvacuation()
    {
        evacuating = false;
        hasDestination = false;

        if (alarmSource != null && alarmSource.isPlaying)
        {
            alarmSource.Stop();
        }

        if (routeController != null)
        {
            routeController.ClearRoute();
            routeController.gameObject.SetActive(false);
        }

        ShowTempMessage("Evacuation done successfully");

        if (modeButtonsUI != null)
            modeButtonsUI.ForceExitEmergencyMode();
    }

    // Nearest-exit logic

    bool TryFindNearestExit(out RoomSO bestExit, out Vector3 bestDestWorld)
    {
        bestExit = null;
        bestDestWorld = Vector3.zero;

        float bestPathLength = float.MaxValue;

        foreach (var exit in emergencyExits)
        {
            if (exit == null) continue;

            string key = GetRoomKey(exit);
            if (string.IsNullOrEmpty(key)) continue;

            if (!NavigationManager.Instance.TryGetPathToRoom(
                    key,
                    player.position,
                    out NavMeshPath path))
                continue;

            if (path == null || path.corners == null || path.corners.Length < 2)
                continue;

            float length = CalculatePathLength(path);
            if (length < bestPathLength)
            {
                bestPathLength = length;
                bestExit = exit;
                bestDestWorld = path.corners[path.corners.Length - 1];
            }
        }

        return bestExit != null;
    }

    string GetRoomKey(RoomSO room)
    {
        // Prefer Room ID (unique)
        if (!string.IsNullOrEmpty(room.roomID))
            return room.roomID;

        // Fallback to name
        return room.roomName;
    }

    float CalculatePathLength(NavMeshPath path)
    {
        float total = 0f;
        for (int i = 1; i < path.corners.Length; i++)
            total += Vector3.Distance(path.corners[i - 1], path.corners[i]);
        return total;
    }

    // UI helpers

    void ShowMessage(string msg)
    {
        if (statusText == null) return;
        statusText.gameObject.SetActive(true);
        statusText.text = msg;
    }

    void ShowTempMessage(string msg)
    {
        ShowMessage(msg);
        Invoke(nameof(HideMessage), 2f);
    }

    void HideMessage()
    {
        if (statusText != null)
            statusText.gameObject.SetActive(false);
    }
}
