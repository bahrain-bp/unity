using UnityEngine;
using UnityEngine.InputSystem;

public class MapMenuToggle : MonoBehaviour
{
    [Header("References")]
    public GameObject mapPanelRoot;
    public Behaviour playerLookScript;
    public Behaviour playerMoveScript;
    [Header("Emergency")]
    public EmergencyEvacuationController evacuationController;
    public bool IsMapOpen => mapPanelRoot != null && mapPanelRoot.activeSelf;



    void Start()
    {
        // Ensure map is closed at start
        mapPanelRoot.SetActive(false);

        Cursor.lockState = CursorLockMode.Locked;
        Cursor.visible = false;
    }

void Update()
{
    if (Keyboard.current == null) return;

    // Block map toggle during evacuation
    if (evacuationController != null && evacuationController.IsEvacuating)
        return;

    // M key only opens the map
    if (Keyboard.current.mKey.wasPressedThisFrame)
    {
        OpenMap();
    }
}



    public void OpenMap()
    {
        // Already open → do nothing
        if (mapPanelRoot.activeSelf)
            return;

        mapPanelRoot.SetActive(true);

        if (playerLookScript) playerLookScript.enabled = false;
        if (playerMoveScript) playerMoveScript.enabled = false;

        Cursor.lockState = CursorLockMode.None;
        Cursor.visible = true;
    }

    public void CloseMap()
    {
        // Already closed → do nothing
        if (!mapPanelRoot.activeSelf)
            return;

        mapPanelRoot.SetActive(false);

        if (playerLookScript) playerLookScript.enabled = true;
        if (playerMoveScript) playerMoveScript.enabled = true;

        Cursor.lockState = CursorLockMode.Locked;
        Cursor.visible = false;
    }
}
