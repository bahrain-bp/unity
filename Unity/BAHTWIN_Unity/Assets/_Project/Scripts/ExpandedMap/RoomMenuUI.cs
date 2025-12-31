using System;
using System.Collections.Generic;
using System.Linq;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

public class RoomMenuUI : MonoBehaviour
{
    [Header("Data")]
    public RoomUIRegistry registry;

    [Header("UI References")]
    public TMP_InputField searchInput;
    public Transform contentRoot; // RoomsScroll/Viewport/Content

    [Header("Prefabs")]
    public TMP_Text categoryHeaderPrefab;
    public Button roomButtonPrefab;

    [Header("Bottom Buttons")]
    public Button showRouteButton;
    public Button teleportButton;

    [Header("Button Visuals")]
    public Sprite normalSprite;
    public Sprite selectedSprite;

    private RoomSO selectedRoom;

    [Header("Controllers")]
    public RouteGuidanceController routeController;
    public TeleportController teleportController;

    [Header("Panel Control")]
    public GameObject mapPanelRoot;
    public MapMenuToggle mapToggle;

    private readonly List<GameObject> spawnedObjects = new();
    private readonly Dictionary<Button, RoomSO> buttonRoomMap = new();

    void Awake()
    {
        SetBottomButtons(false);

        if (searchInput != null)
            searchInput.onValueChanged.AddListener(_ => RebuildList());
    }

    void OnEnable()
    {
        RebuildList();
        ClearSelection();
    }

    void ClearSelection()
    {
        selectedRoom = null;
        SetBottomButtons(false);
        UpdateButtonVisuals();
    }

    void SetBottomButtons(bool enabled)
    {
        if (showRouteButton) showRouteButton.interactable = enabled;
        if (teleportButton) teleportButton.interactable = enabled;
    }

    void RebuildList()
    {
        ClearList();

        string query = searchInput ? searchInput.text.Trim().ToLower() : "";

        var filtered = registry.entries
            .Where(e => e.room != null)
            .Where(e =>
            {
                string name = GetDisplayName(e);
                return string.IsNullOrEmpty(query) || name.ToLower().Contains(query);
            })
            .OrderBy(e => e.category)
            .ThenBy(e => GetDisplayName(e))
            .ToList();

        foreach (RoomCategory category in Enum.GetValues(typeof(RoomCategory)))
        {
            var group = filtered.Where(e => e.category == category).ToList();
            if (group.Count == 0) continue;

            SpawnCategoryHeader(GetCategoryTitle(category));

            foreach (var entry in group)
                SpawnRoomButton(entry);
        }

        UpdateButtonVisuals();
    }

    void SpawnCategoryHeader(string title)
    {
        var header = Instantiate(categoryHeaderPrefab, contentRoot);
        header.text = title;
        spawnedObjects.Add(header.gameObject);
    }

    void SpawnRoomButton(RoomUIEntry entry)
    {
        var button = Instantiate(roomButtonPrefab, contentRoot);
        spawnedObjects.Add(button.gameObject);

        var text = button.GetComponentInChildren<TMP_Text>(true);
        if (text) text.text = GetDisplayName(entry);

        buttonRoomMap[button] = entry.room;

        button.onClick.RemoveAllListeners();
        button.onClick.AddListener(() =>
        {
            selectedRoom = entry.room;
            SetBottomButtons(true);
            UpdateButtonVisuals();
        });
    }

    void UpdateButtonVisuals()
    {
        foreach (var pair in buttonRoomMap)
        {
            var img = pair.Key.GetComponent<Image>();
            if (!img) continue;

            bool isSelected = selectedRoom != null && pair.Value == selectedRoom;
            img.sprite = isSelected ? selectedSprite : normalSprite;
        }
    }

    void ClearList()
    {
        foreach (var obj in spawnedObjects)
            Destroy(obj);

        spawnedObjects.Clear();
        buttonRoomMap.Clear();
    }

    string GetDisplayName(RoomUIEntry entry)
    {
        return string.IsNullOrWhiteSpace(entry.displayNameOverride)
            ? entry.room.roomName
            : entry.displayNameOverride;
    }

    string GetCategoryTitle(RoomCategory category)
    {
        return category switch
        {
            RoomCategory.TrainingRooms => "Training Rooms",
            RoomCategory.ConferenceRooms => "Conference Rooms",
            RoomCategory.InterviewRooms => "Interview Room",
            RoomCategory.EmergencyExits => "Emergency Exits",
            RoomCategory.PhoneRooms => "Phone Rooms",
            RoomCategory.RestRooms => "Rest Rooms",
            RoomCategory.OpenOffices => "Open Offices",
            _ => "Other Office Areas"
        };
    }

    public RoomSO GetSelectedRoom()
    {
        return selectedRoom;
    }

    public void OnShowRouteClicked()
    {
        if (routeController == null) return;

        var room = GetSelectedRoom();
        if (room == null) return;

        routeController.SetDestination(room);

        if (mapToggle != null)
            mapToggle.CloseMap();
    }

    public void OnTeleportClicked()
    {
        if (teleportController == null) return;

        var room = GetSelectedRoom();
        if (room == null) return;

        // Optional: clear the line if you want teleport to remove any active route
        if (routeController != null)
            routeController.ClearRoute();

        teleportController.TeleportToRoom(room);

        if (mapToggle != null)
            mapToggle.CloseMap();
    }
}
