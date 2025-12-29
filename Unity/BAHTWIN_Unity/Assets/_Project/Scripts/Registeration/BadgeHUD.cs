using UnityEngine;
using UnityEngine.UI;
using TMPro;

public class BadgeHUD : MonoBehaviour
{
    public GameObject root;
    public Image photoImage;
    public TMP_Text nameText;

    // NEW: lets other scripts temporarily hide the badge even if the profile says passedRegistration=true
    private bool forceHidden;

    private void Start()
    {
        if (root != null) root.SetActive(false);

        if (VisitorSession.Instance != null)
        {
            // if already loaded
            if (VisitorSession.Instance.IsLoaded)
                Apply(VisitorSession.Instance.Profile);

            // subscribe for later
            VisitorSession.Instance.OnProfileLoaded += Apply;
        }
    }

    public void SetForceHidden(bool hidden)
    {
        forceHidden = hidden;
        Apply(VisitorSession.Instance != null ? VisitorSession.Instance.Profile : null);
    }

    private void Apply(VisitorBadgeResponse p)
    {
        if (p == null)
        {
            if (root != null) root.SetActive(false);
            return;
        }

        // show only if earned AND not forced hidden
        bool show = p.passedRegistration && !forceHidden;

        if (root != null) root.SetActive(show);
        if (!show) return;

        if (nameText != null) nameText.text = p.userName;

        if (photoImage != null && VisitorSession.Instance != null && VisitorSession.Instance.badgePhotoSprite != null)
            photoImage.sprite = VisitorSession.Instance.badgePhotoSprite;
    }

    private void OnDestroy()
    {
        if (VisitorSession.Instance != null)
            VisitorSession.Instance.OnProfileLoaded -= Apply;
    }
}
