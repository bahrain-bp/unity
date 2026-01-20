using UnityEngine;

public class BAHTWIN_Bridge : MonoBehaviour
{
    [Header("Drag the same VisitorBadgeApi used by VisitorSession")]
    public VisitorBadgeApi visitorBadgeApi;

    // Called from JS: unityInstance.SendMessage("BAHTWIN_Bridge", "SetBadgeApiUrl", url);
    public void SetBadgeApiUrl(string url)
    {
        if (visitorBadgeApi == null)
        {
            Debug.LogWarning("[BAHTWIN_Bridge] VisitorBadgeApi reference is missing.");
            return;
        }

        if (string.IsNullOrWhiteSpace(url))
        {
            Debug.LogWarning("[BAHTWIN_Bridge] Received empty badge API url.");
            return;
        }

        visitorBadgeApi.badgeUrl = url;
        Debug.Log("[BAHTWIN_Bridge] badgeUrl set to: " + url);
    }
}
