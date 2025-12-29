using System;
using System.Collections;
using UnityEngine;

public class VisitorSession : MonoBehaviour
{
    public static VisitorSession Instance { get; private set; }

    [Header("Dependencies")]
    public UserIdProvider userIdProvider;
    public VisitorBadgeApi api;
    public RegistrationAccessGate accessGate;

    [Header("Badge Photo Cache")]
    public Texture2D badgePhotoTexture;
    public Sprite badgePhotoSprite;

    public VisitorBadgeResponse Profile { get; private set; }
    public bool IsLoaded { get; private set; }

    public event Action<VisitorBadgeResponse> OnProfileLoaded;

    private void Awake()
    {
        if (Instance != null) { Destroy(gameObject); return; }
        Instance = this;
        DontDestroyOnLoad(gameObject);
    }

    private void Start()
    {
        StartCoroutine(LoadProfileAtStart());
    }

    private IEnumerator LoadProfileAtStart()
    {
        IsLoaded = false;

        if (userIdProvider == null || api == null)
        {
            Debug.LogError("[VisitorSession] Missing references (UserIdProvider or VisitorBadgeApi).");
            yield break;
        }

        string userId = userIdProvider.GetUserId();
        string token = userIdProvider.GetIdToken();

        if (string.IsNullOrEmpty(userId))
        {
            Debug.LogError("[VisitorSession] Missing userId.");
            yield break;
        }

        VisitorBadgeResponse profile = null;
        string err = null;

        yield return api.GetBadge(
            userId,
            token,
            ok => profile = ok,
            e => err = e
        );

        if (profile == null)
        {
            Debug.LogError("[VisitorSession] Failed to load profile: " + err);
            yield break;
        }

        Profile = profile;

        // Apply lock/unlock immediately
        if (accessGate != null)
            accessGate.SetRegistrationPassed(Profile.passedRegistration);

        // Cache photo once
        if (!string.IsNullOrEmpty(Profile.imageUrl))
        {
            yield return BadgeImageLoader.DownloadTexture(
                Profile.imageUrl,
                tex =>
                {
                    badgePhotoTexture = tex;
                    badgePhotoSprite = Sprite.Create(
                        tex,
                        new Rect(0, 0, tex.width, tex.height),
                        new Vector2(0.5f, 0.5f)
                    );
                },
                e => Debug.LogError("[VisitorSession] Photo download failed: " + e)
            );
        }

        IsLoaded = true;
        OnProfileLoaded?.Invoke(Profile);
    }
}
