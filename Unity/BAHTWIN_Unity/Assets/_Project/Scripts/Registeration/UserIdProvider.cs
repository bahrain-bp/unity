using UnityEngine;

public class UserIdProvider : MonoBehaviour
{
    [Header("Editor Testing")]
    [SerializeField] private string editorTestUserId = "";
    [SerializeField] private string editorTestIdToken = "EDITOR_MOCK_TOKEN";

    [Header("Browser Storage Keys")]
    [SerializeField] private string userIdKey = "userId";
    [SerializeField] private string idTokenKey = "idToken";

    public string GetUserId()
    {
        return PlayerPrefs.GetString(userIdKey, editorTestUserId);
    }

    public string GetIdToken()
    {
        return PlayerPrefs.GetString(idTokenKey, editorTestIdToken);
    }
}
