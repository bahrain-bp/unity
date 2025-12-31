using System;
using System.Collections;
using UnityEngine;
using UnityEngine.Networking;

public static class BadgeImageLoader
{
    public static IEnumerator DownloadTexture(
        string url,
        Action<Texture2D> onSuccess,
        Action<string> onError)
    {
        using (UnityWebRequest req = UnityWebRequestTexture.GetTexture(url))
        {
            yield return req.SendWebRequest();

            if (req.result != UnityWebRequest.Result.Success)
            {
                onError?.Invoke(req.error);
                yield break;
            }

            Texture2D texture = DownloadHandlerTexture.GetContent(req);
            onSuccess?.Invoke(texture);
        }
    }
}
