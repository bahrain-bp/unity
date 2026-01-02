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
    public PeccyTourManager tourManager;

    bool tourActive = false;
    bool emergencyActive = false;

    Image tourImage;
    Image emergencyImage;
    [Header("Emergency Logic")]
    public EmergencyEvacuationController evacuationController;
    [Header("Input Locks")]
    public MapMenuToggle mapMenuToggle;
    public RouteGuidanceController routeGuidanceController;


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
    // Block Tour if map open OR route active
    if ((mapMenuToggle != null && mapMenuToggle.IsMapOpen) ||
        (routeGuidanceController != null && routeGuidanceController.IsRouteActive))
    {
        return;
    }

    // Block tour during evacuation
    if (evacuationController != null && evacuationController.IsEvacuating)
        return;

    // If emergency was active, turn it off (visual only)
    if (!tourActive && emergencyActive)
        emergencyActive = false;

    // Toggle tour visual state
    tourActive = !tourActive;
    UpdateAllVisuals();

    // START/STOP the actual tour system
    if (tourManager != null)
        tourManager.ToggleTour();
    else
        Debug.LogWarning("ModeButtonsUI: tourManager not assigned.");
}


    void ToggleEmergency()
    {
        // Block Emergency if map open OR route active
        if ((mapMenuToggle != null && mapMenuToggle.IsMapOpen) ||
            (routeGuidanceController != null && routeGuidanceController.IsRouteActive))
        {
            return;
        }

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

    public void SetTourActiveVisual(bool active)
    {
        tourActive = active;
        UpdateTourVisual();
    }

}
