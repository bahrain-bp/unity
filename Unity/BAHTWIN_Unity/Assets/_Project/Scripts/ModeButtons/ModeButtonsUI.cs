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
        if (!emergencyActive && tourActive)
        {
            tourActive = false;
        }

        emergencyActive = !emergencyActive;

        UpdateAllVisuals();

        if (emergencyModeController != null)
            emergencyModeController.ToggleEmergencyMode();
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

}
