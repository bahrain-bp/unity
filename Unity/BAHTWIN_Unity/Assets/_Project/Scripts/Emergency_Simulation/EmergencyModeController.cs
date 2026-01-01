using UnityEngine;
using UnityEngine.UI;

public class EmergencyModeController : MonoBehaviour
{
    [Header("UI")]
    public GameObject emergencyOverlay;          // EmergencyOverlay
    public Button closeButton;                   // CloseButton (X)
    public Button startEvacuationButton;         // StartEvacuationButton

    [Header("Player Control")]
    public MonoBehaviour[] disableWhenEmergency; // movement, look, interaction scripts

    [Header("Minimap")]
    public GameObject minimapRoot;               // minimap canvas/root

    [Header("Cursor")]
    public bool showCursor = true;
    [Header("UI State")]
    public ModeButtonsUI modeButtonsUI;
    [Header("Evacuation")]
    public EmergencyEvacuationController evacuationController;



    bool emergencyActive;

    void Awake()
    {
        emergencyOverlay.SetActive(false);

        closeButton.onClick.AddListener(ExitEmergencyMode);
        startEvacuationButton.onClick.AddListener(OnStartEvacuation);
    }

    // CALLED FROM YOUR EXISTING "Emergency Mode [E]" BUTTON LOGIC
    public void ToggleEmergencyMode()
    {
        if (emergencyActive)
            ExitEmergencyMode();
        else
            EnterEmergencyMode();
    }

    void EnterEmergencyMode()
    {
        emergencyActive = true;

        emergencyOverlay.SetActive(true);

        // Disable player scripts
        foreach (var script in disableWhenEmergency)
            script.enabled = false;

        // Disable minimap
        if (minimapRoot != null)
            minimapRoot.SetActive(false);

        // Cursor
        if (showCursor)
        {
            Cursor.lockState = CursorLockMode.None;
            Cursor.visible = true;
        }
    }

    void ExitEmergencyMode()
    {
        emergencyActive = false;

        emergencyOverlay.SetActive(false);

        // Re-enable player scripts
        foreach (var script in disableWhenEmergency)
            script.enabled = true;

        // Enable minimap
        if (minimapRoot != null)
            minimapRoot.SetActive(true);

        // Cursor
        Cursor.lockState = CursorLockMode.Locked;
        Cursor.visible = false;

        // reset Emergency button visuals
        if (modeButtonsUI != null)
            modeButtonsUI.ForceExitEmergencyMode();
    }


void OnStartEvacuation()
{
    ExitEmergencyMode();

    if (evacuationController != null)
        evacuationController.StartEvacuation();
}

}
