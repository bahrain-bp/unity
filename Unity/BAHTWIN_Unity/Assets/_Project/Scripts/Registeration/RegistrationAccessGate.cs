using UnityEngine;

public class RegistrationAccessGate : MonoBehaviour
{
    [Header("Doors to lock until registration is done (ONLY 4)")]
    public DoorLock[] lockedDoors;

    [Header("Hallway invisible wall")]
    public GameObject hallwayBlocker;

    public void SetRegistrationPassed(bool passed)
    {
        bool lockState = !passed;

        if (lockedDoors != null)
        {
            foreach (var door in lockedDoors)
                if (door != null) door.SetLocked(lockState);
        }

        if (hallwayBlocker != null)
            hallwayBlocker.SetActive(lockState);
    }
}
