using UnityEngine;
using UnityEngine.UI;
using UnityEngine.InputSystem;   // for Keyboard.current

public class MapUIController : MonoBehaviour
{
    [Header("Panels")]
    public GameObject miniMapPanel;
    public GameObject fullMapPanel;

    [Header("Zoom")]
    public MinimapZoom minimapZoom;        // your zoom script on the minimap camera or panel
    public Button miniZoomInButton;
    public Button miniZoomOutButton;
    public Button fullZoomInButton;
    public Button fullZoomOutButton;

    bool isMapOpen = false;

    void Awake()
    {
        // Connect buttons to the same zoom logic
        if (miniZoomInButton)   miniZoomInButton.onClick.AddListener(() => minimapZoom.ZoomIn());
        if (miniZoomOutButton)  miniZoomOutButton.onClick.AddListener(() => minimapZoom.ZoomOut());
        if (fullZoomInButton)   fullZoomInButton.onClick.AddListener(() => minimapZoom.ZoomIn());
        if (fullZoomOutButton)  fullZoomOutButton.onClick.AddListener(() => minimapZoom.ZoomOut());
    }

    void Start()
    {
        // start with mini-map visible, full map hidden
        ShowMiniMap();
    }

    void Update()
    {
        if (Keyboard.current == null) return;

        // M key toggles the map
        if (Keyboard.current.mKey.wasPressedThisFrame)
        {
            ToggleMap();
        }

        // Esc closes if already open
        if (isMapOpen && Keyboard.current.escapeKey.wasPressedThisFrame)
        {
            CloseMap();
        }
    }

    // Called from MiniMapPanel Button
    public void OnMiniMapClicked()
    {
        OpenMap();
    }

    public void ToggleMap()
    {
        if (isMapOpen) CloseMap();
        else OpenMap();
    }

    void OpenMap()
    {
        isMapOpen = true;
        fullMapPanel.SetActive(true);
        miniMapPanel.SetActive(false);

        Cursor.lockState = CursorLockMode.None;
        Cursor.visible = true;
    }

    void CloseMap()
    {
        isMapOpen = false;
        ShowMiniMap();

        Cursor.lockState = CursorLockMode.Locked;
        Cursor.visible = false;
    }

    void ShowMiniMap()
    {
        if (miniMapPanel) miniMapPanel.SetActive(true);
        if (fullMapPanel) fullMapPanel.SetActive(false);
    }
}
