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

    [Header("Emergency Logic")]
    public EmergencyEvacuationController evacuationController;

    [Header("Input Locks")]
    public MapMenuToggle mapMenuToggle;
    public RouteGuidanceController routeGuidanceController;

    private bool tourActive = false;
    private bool emergencyActive = false;

    private Image tourImage;
    private Image emergencyImage;

    void Awake()
    {
        if (tourButton != null) tourImage = tourButton.GetComponent<Image>();
        if (emergencyButton != null) emergencyImage = emergencyButton.GetComponent<Image>();

        UpdateAllVisuals();
    }

    void Update()
    {
        // Always sync visuals with REAL state, even if UI buttons close panels
        SyncVisualStatesFromControllers();

        var keyboard = Keyboard.current;
        if (keyboard == null) return;

        if (keyboard.tKey.wasPressedThisFrame)
            ToggleTour();

        if (keyboard.eKey.wasPressedThisFrame)
            ToggleEmergency();
    }

    // -------------------------
    // Sync (fixes your issue)
    // -------------------------

    void SyncVisualStatesFromControllers()
    {
        bool realTourRunning = (tourManager != null && tourManager.tourRunning);

        bool panelOpen = (emergencyModeController != null && emergencyModeController.IsPanelOpen);
        bool evacuating = (evacuationController != null && evacuationController.IsEvacuating);
        bool realEmergencyActive = panelOpen || evacuating;

        bool changed = false;

        if (tourActive != realTourRunning)
        {
            tourActive = realTourRunning;
            changed = true;
        }

        if (emergencyActive != realEmergencyActive)
        {
            emergencyActive = realEmergencyActive;
            changed = true;
        }

        if (changed)
            UpdateAllVisuals();
    }

    bool IsBlockedByUI()
    {
        return (mapMenuToggle != null && mapMenuToggle.IsMapOpen) ||
               (routeGuidanceController != null && routeGuidanceController.IsRouteActive);
    }

    // -------------------------
    // Mutual Exclusivity Helpers
    // -------------------------

    void StopTourIfRunning()
    {
        if (tourManager != null && tourManager.tourRunning)
            tourManager.StopTour();

        tourActive = false;
        UpdateTourVisual();
    }

    void ExitEmergencyIfOpenOrRunning()
    {
        if (evacuationController != null && evacuationController.IsEvacuating)
            evacuationController.StopEvacuation();

        if (emergencyModeController != null && emergencyModeController.IsPanelOpen)
            emergencyModeController.ExitEmergencyMode();

        emergencyActive = false;
        UpdateEmergencyVisual();
    }

    // -------------------------
    // Tour
    // -------------------------

    void ToggleTour()
    {
        if (IsBlockedByUI())
            return;

        if (evacuationController != null && evacuationController.IsEvacuating)
            return;

        // If we're about to start tour, ensure emergency is fully off
        bool willTurnOnTour = !(tourManager != null && tourManager.tourRunning);
        if (willTurnOnTour)
            ExitEmergencyIfOpenOrRunning();

        if (tourManager != null)
            tourManager.ToggleTour();
        else
            Debug.LogWarning("ModeButtonsUI: tourManager not assigned.");

        // Sync visuals from real state immediately
        SyncVisualStatesFromControllers();
    }

    // -------------------------
    // Emergency
    // -------------------------

    void ToggleEmergency()
    {
        if (IsBlockedByUI())
            return;

        // If evacuation running -> stop it
        if (evacuationController != null && evacuationController.IsEvacuating)
        {
            evacuationController.StopEvacuation();
            SyncVisualStatesFromControllers();
            return;
        }

        // If panel open -> close it
        if (emergencyModeController != null && emergencyModeController.IsPanelOpen)
        {
            emergencyModeController.ExitEmergencyMode();
            SyncVisualStatesFromControllers();
            return;
        }

        // We are about to open emergency -> stop tour first
        StopTourIfRunning();

        if (emergencyModeController != null)
            emergencyModeController.EnterEmergencyMode();
        else
            Debug.LogWarning("ModeButtonsUI: emergencyModeController not assigned.");

        SyncVisualStatesFromControllers();
    }

    // -------------------------
    // Visuals
    // -------------------------

    void UpdateAllVisuals()
    {
        UpdateTourVisual();
        UpdateEmergencyVisual();
    }

    void UpdateTourVisual()
    {
        if (tourImage == null) return;
        tourImage.sprite = tourActive ? tourStopSprite : tourNormalSprite;
    }

    void UpdateEmergencyVisual()
    {
        if (emergencyImage == null) return;
        emergencyImage.sprite = emergencyActive ? emergencyStopSprite : emergencyNormalSprite;
    }

    // -------------------------
    // External calls (optional)
    // -------------------------

    public void ForceExitEmergencyMode()
    {
        ExitEmergencyIfOpenOrRunning();
        UpdateAllVisuals();
    }

    public void ForceEnterEmergencyMode()
    {
        StopTourIfRunning();
        emergencyActive = true;
        tourActive = false;
        UpdateAllVisuals();
    }

    public void SetTourActiveVisual(bool active)
    {
        tourActive = active;
        UpdateTourVisual();
    }
}
