using System;
using TMPro;
using UnityEngine;

public class EnvTelemetryText : MonoBehaviour
{
    [Header("UI")]
    public TMP_Text temperatureText;   // TMP for temperature
    public TMP_Text humidityText;      // TMP for humidity

    [Header("Units")]
    public string unitTemp = "°C";
    public string unitHum = "%";

    [Serializable]
    private class TelemetryMsg
    {
        public float temp_c;
        public float humidity;
    }

    // MUST match JS:
    // unityInstance.SendMessage("EnvSensor_UI", "OnTelemetryJson", json)
    public void OnTelemetryJson(string json)
    {
        if (string.IsNullOrEmpty(json))
            return;

        TelemetryMsg msg;

        try
        {
            msg = JsonUtility.FromJson<TelemetryMsg>(json);
        }
        catch (Exception e)
        {
            Debug.LogWarning("[EnvTelemetryText] JSON parse failed: " + e.Message);
            return;
        }

        // --- Temperature ---
        if (temperatureText != null)
        {
            temperatureText.text = $"{msg.temp_c:0.#}{unitTemp}";
        }

        // --- Humidity ---
        if (humidityText != null)
        {
            humidityText.text = $"{msg.humidity:0.#}{unitHum}";
        }
    }
}
