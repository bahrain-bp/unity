using UnityEngine;
using System.Runtime.InteropServices;

public class UserIdProvider : MonoBehaviour
{
    [Header("Editor Testing")]
    [SerializeField] private string editorTestUserId = "";
    [SerializeField] private string editorTestIdToken = "EDITOR_MOCK_TOKEN";

    [Header("Browser Storage Keys (must match website localStorage keys)")]
    [SerializeField] private string userIdKey = "userId";
    [SerializeField] private string idTokenKey = "idToken";

#if UNITY_WEBGL && !UNITY_EDITOR
    [DllImport("__Internal")]
    private static extern string GetLocalStorage(string key);
#endif

    public string GetUserId()
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        string value = GetLocalStorage(userIdKey);
        return string.IsNullOrEmpty(value) ? "" : value;
#else
        return editorTestUserId;
#endif
    }

    public string GetIdToken()
    {
#if UNITY_EDITOR
        return editorTestIdToken;
#else
    return WebGLLocalStorage.GetItem("idToken");
#endif
    }

}
