using UnityEngine;
using System.Runtime.InteropServices;

public static class WebGLRedirect
{
#if UNITY_WEBGL && !UNITY_EDITOR
    [DllImport("__Internal")]
    private static extern void RedirectToURL(string url);
#endif

    public static void GoToHomepage(string url)
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        RedirectToURL(url);
#else
        Debug.Log("Redirect requested to: " + url);
        Application.Quit();
#endif
    }
}
