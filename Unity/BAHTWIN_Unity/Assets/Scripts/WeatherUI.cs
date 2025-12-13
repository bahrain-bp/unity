using UnityEngine;
using UnityEngine.Networking;
using TMPro;
using System.Collections;

public class WeatherUI : MonoBehaviour
{
    public TextMeshProUGUI weatherText;

    private string url =
        "https://api.open-meteo.com/v1/forecast?latitude=26.2235&longitude=50.5876&current_weather=true";

    void Start()
    {
        StartCoroutine(GetWeather());
    }

    IEnumerator GetWeather()
    {
        using (UnityWebRequest request = UnityWebRequest.Get(url))
        {
            yield return request.SendWebRequest();

            if (request.result != UnityWebRequest.Result.Success)
            {
                weatherText.text = "--°C";
            }
            else
            {
                WeatherResponse data =
                    JsonUtility.FromJson<WeatherResponse>(request.downloadHandler.text);

                weatherText.text = Mathf.RoundToInt(data.current_weather.temperature) + "°C";
            }
        }
    }
}

[System.Serializable]
public class WeatherResponse
{
    public CurrentWeather current_weather;
}

[System.Serializable]
public class CurrentWeather
{
    public float temperature;
}
