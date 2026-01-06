using UnityEngine;

public class UserIdProvider : MonoBehaviour
{
    [Header("Editor Testing")]
    [SerializeField] private string editorTestUserId = "";
    [SerializeField] private string editorTestIdToken = "EDITOR_MOCK_TOKEN";

    [Header("Browser Storage Keys (must match website localStorage keys)")]
    [SerializeField] private string userIdKey = "userId";
    [SerializeField] private string idTokenKey = "idToken";

    public string GetUserId()
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        return WebGLLocalStorage.GetString(userIdKey);
#else
        // Editor/Standalone testing
        return PlayerPrefs.GetString(userIdKey, editorTestUserId);
#endif
    }

    public string GetIdToken()
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        return WebGLLocalStorage.GetString(idTokenKey);
#else
        return PlayerPrefs.GetString(idTokenKey, editorTestIdToken);
#endif
    }
}
