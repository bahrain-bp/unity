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
        if (!tourActive && emergencyActive)
        {
            emergencyActive = false;
        }

        tourActive = !tourActive;

        UpdateAllVisuals();
    }

void ToggleEmergency()
{
    // CASE 1: Evacuation is running , STOP it
    if (evacuationController != null && evacuationController.IsEvacuating)
    {
        evacuationController.StopEvacuation();
        emergencyActive = false;
        UpdateAllVisuals();
        return;
    }

    // CASE 2: Toggle emergency panel
    emergencyActive = !emergencyActive;

    if (emergencyActive)
    {
        if (emergencyModeController != null)
            emergencyModeController.EnterEmergencyMode();
    }
    else
    {
        if (emergencyModeController != null)
            emergencyModeController.ExitEmergencyMode();
    }

    UpdateAllVisuals();
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
