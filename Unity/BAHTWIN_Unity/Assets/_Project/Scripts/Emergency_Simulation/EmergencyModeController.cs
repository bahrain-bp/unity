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
    public bool IsPanelOpen => emergencyActive;

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

public void EnterEmergencyMode()
{
    if (emergencyActive) return;

    emergencyActive = true;
    emergencyOverlay.SetActive(true);

    foreach (var script in disableWhenEmergency)
        script.enabled = false;

    if (minimapRoot != null)
        minimapRoot.SetActive(false);

    Cursor.lockState = CursorLockMode.None;
    Cursor.visible = true;
}

public void ExitEmergencyMode()
{
    if (!emergencyActive) return;

    emergencyActive = false;
    emergencyOverlay.SetActive(false);

    foreach (var script in disableWhenEmergency)
        script.enabled = true;

    if (minimapRoot != null)
        minimapRoot.SetActive(true);

    Cursor.lockState = CursorLockMode.Locked;
    Cursor.visible = false;
}



void OnStartEvacuation()
{
    ExitEmergencyMode();

    if (evacuationController != null)
        evacuationController.StartEvacuation();
}

}
