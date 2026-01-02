using UnityEngine;
using UnityEngine.UI;
using UnityEngine.InputSystem;

public class ModeButtonsUI : MonoBehaviour
{
    [Header("Buttons")]
    public Button tourButton;
    public Button emergencyButton;

    [Header("Tour Sprites")]
    public Sprite tourNormalSprite;
    public Sprite tourStopSprite;

    [Header("Emergency Sprites")]
    public Sprite emergencyNormalSprite;
    public Sprite emergencyStopSprite;

    [Header("Controllers")]
    public EmergencyModeController emergencyModeController;

    bool tourActive = false;
    bool emergencyActive = false;

    Image tourImage;
    Image emergencyImage;
    [Header("Emergency Logic")]
    public EmergencyEvacuationController evacuationController;


    void Awake()
    {
        tourImage = tourButton.GetComponent<Image>();
        emergencyImage = emergencyButton.GetComponent<Image>();

        UpdateAllVisuals();
    }

    void Update()
    {
        var keyboard = Keyboard.current;
        if (keyboard == null) return;

        if (keyboard.tKey.wasPressedThisFrame)
            ToggleTour();

        if (keyboard.eKey.wasPressedThisFrame)
            ToggleEmergency();
    }

void ToggleTour()
{
    //Block tour during evacuation
    if (evacuationController != null && evacuationController.IsEvacuating)
        return;

    if (!tourActive && emergencyActive)
    {
        emergencyActive = false;
    }

    tourActive = !tourActive;
    UpdateAllVisuals();
}


void ToggleEmergency()
{
    // If evacuation is running , STOP evacuation
    if (evacuationController != null && evacuationController.IsEvacuating)
    {
        evacuationController.StopEvacuation();
        emergencyActive = false;
        UpdateAllVisuals();
        return;
    }

    //  If panel is already open , just close UI (X behavior)
    if (emergencyModeController != null && emergencyModeController.IsPanelOpen)
    {
        emergencyModeController.ExitEmergencyMode();
        return;
    }

    //  Normal case , open panel only (no state change)
    emergencyModeController.EnterEmergencyMode();
}



    void UpdateAllVisuals()
    {
        UpdateTourVisual();
        UpdateEmergencyVisual();
    }

    void UpdateTourVisual()
    {
        tourImage.sprite = tourActive
            ? tourStopSprite
            : tourNormalSprite;
    }

    void UpdateEmergencyVisual()
    {
        emergencyImage.sprite = emergencyActive
            ? emergencyStopSprite
            : emergencyNormalSprite;
    }
    public void ForceExitEmergencyMode()
    {
        emergencyActive = false;
        UpdateAllVisuals();
    }
    public void ForceEnterEmergencyMode()
    {
        emergencyActive = true;
        tourActive = false; // safety: only one mode active
        UpdateAllVisuals();
    }


}
