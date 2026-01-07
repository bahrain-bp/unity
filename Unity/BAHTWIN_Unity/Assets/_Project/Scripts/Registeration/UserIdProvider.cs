using UnityEngine;
using System.Runtime.InteropServices;

public class UserIdProvider : MonoBehaviour
{
    [Header("Editor Testing (used in Unity Editor only)")]
    [SerializeField] private string editorTestUserId = "EDITOR_TEST_USER";
    [SerializeField] private string editorTestIdToken = "EDITOR_MOCK_TOKEN";

    [Header("Browser localStorage keys (must match React website)")]
    [SerializeField] private string userIdKey = "userId";
    [SerializeField] private string idTokenKey = "idToken";

    [Header("WebGL Fallback (used ONLY if website data is missing)")]
    [SerializeField] private string webglFallbackUserId = "a428d478-3071-70bd-b8ca-de153de89212";
    [SerializeField] private string webglFallbackToken = "";

    [Header("Caching")]
    [SerializeField] private bool cacheValuesOnAwake = true;

    private bool cached;
    private string cachedUserId;
    private string cachedIdToken;

#if UNITY_WEBGL && !UNITY_EDITOR
    [DllImport("__Internal")]
    private static extern string BAHTWIN_LS_GetString(string key);
#endif

    private void Awake()
    {
        if (cacheValuesOnAwake)
            CacheFromSource();
    }

    /// <summary>
    /// Call this once (or when you want to re-read localStorage after login).
    /// </summary>
    public void CacheFromSource()
    {
        cachedUserId = ReadUserIdInternal();
        cachedIdToken = ReadIdTokenInternal();
        cached = true;
    }

    public string GetUserId()
    {
        if (cached) return cachedUserId;
        return ReadUserIdInternal();
    }

    public string GetIdToken()
    {
        if (cached) return cachedIdToken;
        return ReadIdTokenInternal();
    }

    private string ReadUserIdInternal()
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        string value = SafeGetLocalStorage(userIdKey);

        if (string.IsNullOrEmpty(value))
        {
            Debug.LogWarning("[UserIdProvider] userId not found in localStorage. Using fallback userId.");
            return webglFallbackUserId;
        }

        return value;
#else
        return string.IsNullOrEmpty(editorTestUserId) ? webglFallbackUserId : editorTestUserId;
#endif
    }

    private string ReadIdTokenInternal()
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        string value = SafeGetLocalStorage(idTokenKey);

        if (string.IsNullOrEmpty(value))
        {
            Debug.LogWarning("[UserIdProvider] idToken not found in localStorage. Using fallback token.");
            return webglFallbackToken;
        }

        return value;
#else
        return editorTestIdToken;
#endif
    }

#if UNITY_WEBGL && !UNITY_EDITOR
    private string SafeGetLocalStorage(string key)
    {
        try
        {
            // Some browsers or privacy modes can throw when accessing localStorage.
            return BAHTWIN_LS_GetString(key);
        }
        catch (System.Exception ex)
        {
            Debug.LogWarning($"[UserIdProvider] localStorage read failed for key '{key}'. {ex.Message}");
            return "";
        }
    }
#endif
}
