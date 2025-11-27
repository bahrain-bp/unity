using UnityEngine;

[CreateAssetMenu(fileName = "RoomSO", menuName = "Scriptable Objects/RoomSO")]
public class RoomSO : ScriptableObject
{
    public string roomName;
    public string roomID;
    public int roomNumber;

    public bool hasAV_VC;
    public int capacity;
}
