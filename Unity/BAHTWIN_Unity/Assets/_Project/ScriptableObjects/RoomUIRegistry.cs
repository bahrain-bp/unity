using System.Collections.Generic;
using UnityEngine;

public enum RoomCategory
{
    TrainingRooms,
    ConferenceRooms,
    InterviewRooms,
    OpenOffices,
    EmergencyExits,
    PhoneRooms,
    RestRooms,
    OtherOfficeAreas
}

[System.Serializable]
public class RoomUIEntry
{
    public RoomSO room;
    public RoomCategory category;
    public string displayNameOverride;
}

[CreateAssetMenu(fileName = "RoomUIRegistry", menuName = "BAHTWIN/UI/Room UI Registry")]
public class RoomUIRegistry : ScriptableObject
{
    public List<RoomUIEntry> entries = new();
}
