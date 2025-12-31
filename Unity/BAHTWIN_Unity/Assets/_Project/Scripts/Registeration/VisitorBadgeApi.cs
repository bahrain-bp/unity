using System;
using System.Collections;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

[Serializable]
public class VisitorBadgeResponse
{
    public string userId;
    public string userName;
    public string imageUrl;
    public bool passedRegistration;
}

public class VisitorBadgeApi : MonoBehaviour
{
    [Header("API Gateway")]
    public string badgeUrl;

    [Header("Auth Header")]
    public bool useBearerPrefix = true;

    [Header("Debug / Editor")]
    public bool useMockInEditor = false;
    public bool debugLogs = true;
    public float timeoutSeconds = 15f;

    [Serializable]
    private class GetBadgeRequest
    {
        public string userId;
    }

    [Serializable]
    private class SetBadgeRequest
    {
        public string userId;
        public bool passedRegistration; // IMPORTANT: NOT nullable
    }

    public IEnumerator GetBadge(string userId, string token, Action<VisitorBadgeResponse> onSuccess, Action<string> onError)
    {
#if UNITY_EDITOR
        if (useMockInEditor)
        {
            yield return new WaitForSeconds(0.05f);
            onSuccess?.Invoke(new VisitorBadgeResponse
            {
                userId = userId,
                userName = "Worked Test",
                imageUrl = "",
                passedRegistration = false
            });
            yield break;
        }
#endif

        if (string.IsNullOrWhiteSpace(badgeUrl))
        {
            onError?.Invoke("BadgeUrl is empty.");
            yield break;
        }

        string json = JsonUtility.ToJson(new GetBadgeRequest { userId = userId });
        yield return SendPost(json, token, onSuccess, onError, label: "GET/POST");
    }

    public IEnumerator SetPassedRegistration(string userId, bool passed, string token, Action<VisitorBadgeResponse> onSuccess, Action<string> onError)
    {
#if UNITY_EDITOR
        if (useMockInEditor)
        {
            yield return new WaitForSeconds(0.05f);
            onSuccess?.Invoke(new VisitorBadgeResponse
            {
                userId = userId,
                userName = "Worked Test",
                imageUrl = "",
                passedRegistration = passed
            });
            yield break;
        }
#endif

        if (string.IsNullOrWhiteSpace(badgeUrl))
        {
            onError?.Invoke("BadgeUrl is empty.");
            yield break;
        }

        string json = JsonUtility.ToJson(new SetBadgeRequest { userId = userId, passedRegistration = passed });

        if (debugLogs)
        {
            Debug.Log("[VisitorBadgeApi] SET/POST " + badgeUrl);
            Debug.Log("[VisitorBadgeApi] Body: " + json);
            Debug.Log("[VisitorBadgeApi] HasToken: " + (!string.IsNullOrEmpty(token)));
        }

        yield return SendPost(json, token, onSuccess, onError, label: "SET/POST");
    }

    private IEnumerator SendPost(string json, string token, Action<VisitorBadgeResponse> onSuccess, Action<string> onError, string label)
    {
        using (var req = new UnityWebRequest(badgeUrl, "POST"))
        {
            req.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(json));
            req.downloadHandler = new DownloadHandlerBuffer();
            req.SetRequestHeader("Content-Type", "application/json");

            if (!string.IsNullOrEmpty(token))
                req.SetRequestHeader("Authorization", useBearerPrefix ? ("Bearer " + token) : token);

#if UNITY_2022_2_OR_NEWER
            req.timeout = Mathf.CeilToInt(timeoutSeconds);
#endif

            yield return req.SendWebRequest();

            if (req.result != UnityWebRequest.Result.Success)
            {
                string msg = $"[{label}] Request failed: {req.result}\nHTTP: {req.responseCode}\nError: {req.error}\nBody: {req.downloadHandler?.text}";
                onError?.Invoke(msg);
                yield break;
            }

            string text = req.downloadHandler.text;
            if (debugLogs) Debug.Log("[VisitorBadgeApi] Response: " + text);

            try
            {
                var data = JsonUtility.FromJson<VisitorBadgeResponse>(text);
                onSuccess?.Invoke(data);
            }
            catch (Exception ex)
            {
                onError?.Invoke("JSON parse failed: " + ex.Message + "\nRaw: " + text);
            }
        }
    }
}
