using UnityEngine;

#if UNITY_WEBGL && !UNITY_EDITOR
using System.Runtime.InteropServices;
#endif

public class BAHTWIN_Bridge : MonoBehaviour
{
    [Header("Drag the same VisitorBadgeApi used by VisitorSession")]
    public VisitorBadgeApi visitorBadgeApi;

    // Called from JS:
    // unityInstance.SendMessage("BAHTWIN_Bridge", "SetBadgeApiUrl", url);

#if UNITY_WEBGL && !UNITY_EDITOR
    [DllImport("__Internal")]
    private static extern void BAHTWIN_OnUnityReady();
#endif

    private void Start()
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        // Tell JS that this scene object exists and is ready to receive config
        BAHTWIN_OnUnityReady();
#endif
    }

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
