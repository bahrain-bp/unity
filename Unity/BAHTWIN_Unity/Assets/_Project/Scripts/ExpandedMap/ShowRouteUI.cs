using UnityEngine;
using UnityEngine.AI;

public class ShowRouteUI : MonoBehaviour
{
    [Header("References")]
    public RoomMenuUI roomMenuUI;
    public Transform player;
    public LineRenderer routeLine;

    public void ShowRoute()
    {
        if (roomMenuUI == null || player == null || routeLine == null)
        {
            Debug.LogWarning("ShowRouteUI: Missing references");
            return;
        }

        RoomSO room = roomMenuUI.GetSelectedRoom();
        if (room == null)
        {
            Debug.Log("No room selected");
            return;
        }

        NavMeshPath path;
        bool success = NavigationManager.Instance.TryGetPathToRoom(
            room.roomName,
            player.position,
            out path
        );

        if (!success || path.corners.Length == 0)
        {
            Debug.LogWarning("No path found to " + room.roomName);
            routeLine.positionCount = 0;
            return;
        }

        float heightOffset = 0.08f;

        Vector3[] smoothed = SmoothPath(path.corners, 5);

        for (int i = 0; i < smoothed.Length; i++)
        {
            smoothed[i] += Vector3.up * heightOffset;
        }

        routeLine.positionCount = smoothed.Length;
        routeLine.SetPositions(smoothed);


        // Debug.Log("Routing to: " + room.roomName);

    }

    public void ClearRoute()
    {
        if (routeLine)
            routeLine.positionCount = 0;
    }

    Vector3[] SmoothPath(Vector3[] input, int smoothness = 4)
    {
        if (input.Length < 3)
            return input;

        var result = new System.Collections.Generic.List<Vector3>();

        for (int i = 0; i < input.Length - 1; i++)
        {
            Vector3 a = input[i];
            Vector3 b = input[i + 1];

            result.Add(a);

            for (int j = 1; j < smoothness; j++)
            {
                float t = j / (float)smoothness;
                result.Add(Vector3.Lerp(a, b, t));
            }
        }

        result.Add(input[^1]);
        return result.ToArray();
    }

}
