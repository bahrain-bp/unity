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

    // MODE TOGGLES
    void ToggleTour()
    {
        // Turn OFF emergency if it's active
        if (!tourActive && emergencyActive)
        {
            emergencyActive = false;
        }

        tourActive = !tourActive;

        UpdateAllVisuals();

        // if (tourActive) StartTour();
        // else StopTour();
    }

    void ToggleEmergency()
    {
        // Turn OFF tour if it's active
        if (!emergencyActive && tourActive)
        {
            tourActive = false;
        }

        emergencyActive = !emergencyActive;

        UpdateAllVisuals();

        // if (emergencyActive) StartEvacuation();
        // else StopEvacuation();
    }

    // VISUAL UPDATES
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
}
