using System;
using System.Runtime.InteropServices;
using UnityEngine;

public static class WebGLLocalStorage
{
#if UNITY_WEBGL && !UNITY_EDITOR
    [DllImport("__Internal")]
    private static extern IntPtr BAHTWIN_LS_GetString(string key);
#endif

    public static string GetString(string key)
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        var ptr = BAHTWIN_LS_GetString(key);
        return Marshal.PtrToStringUTF8(ptr);
#else
        // Editor fallback so you can test without WebGL
        return PlayerPrefs.GetString(key, "");
#endif
    }
}
