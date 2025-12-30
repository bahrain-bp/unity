using System;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

public class MeetingRoomStatusUI : MonoBehaviour
{
    [Header("UI References")]
    public TextMeshProUGUI roomStatusText;
    public Image statusDot;

    [Header("Labels")]
    public string occupiedLabel = "OCCUPIED";
    public string availableLabel = "AVAILABLE";

    [Header("Colors")]
    public Color occupiedColor = Color.red;
    public Color availableColor = Color.green;

    [Serializable]
    private class OccupancyMsg
    {
        public string device;
        public string sensor_id;
        public string sensor_type;
        public string state;   // "OCCUPIED" / "AVAILABLE"
        public long ts;
        public string status;
    }

    // CALLED FROM JAVASCRIPT
    // wsUnityInstance.SendMessage("MeetingRoomCard", "OnOccupancyJson", json)
    public void OnOccupancyJson(string json)
    {
        if (string.IsNullOrEmpty(json))
            return;

        OccupancyMsg msg;

        try
        {
            msg = JsonUtility.FromJson<OccupancyMsg>(json);
        }
        catch (Exception e)
        {
            Debug.LogWarning("[MeetingRoomStatusUI] JSON parse failed: " + e.Message);
            return;
        }

        if (msg == null || string.IsNullOrEmpty(msg.state))
            return;

        bool isOccupied =
            msg.state.Equals("OCCUPIED", StringComparison.OrdinalIgnoreCase);

        if (isOccupied)
            SetOccupied();
        else
            SetAvailable();

        Debug.Log(
            $"[MeetingRoomStatusUI] {msg.sensor_id} → {msg.state}"
        );
    }

    private void SetAvailable()
    {
        roomStatusText.text = availableLabel;
        roomStatusText.color = availableColor;
        statusDot.color = availableColor;
    }

    private void SetOccupied()
    {
        roomStatusText.text = occupiedLabel;
        roomStatusText.color = occupiedColor;
        statusDot.color = occupiedColor;
    }
}
