using System.Collections;
using UnityEngine;

public class BadgePickupInteractable : MonoBehaviour
{
    public bool IsPickedUp { get; private set; }

    [Header("Visual Root (child mesh object)")]
    public Transform visualRoot;

    [Header("Spawn Animation")]
    public float fadeInSeconds = 0.8f;
    public float floatAmplitude = 0.01f;   // reduced bounce (was 0.03)
    public float floatSpeed = 1.2f;        // slightly slower
    public float spinSpeed = 60f;          // slightly slower

    private bool active;
    private Vector3 baseLocalPos;
    private Collider cachedCollider;

    void Awake()
    {
        if (visualRoot == null) visualRoot = transform;

        cachedCollider = GetComponent<Collider>();

        baseLocalPos = visualRoot.localPosition;

        // Start hidden + NOT interactable
        if (visualRoot != null) visualRoot.gameObject.SetActive(false);
        if (cachedCollider != null) cachedCollider.enabled = false;

        IsPickedUp = false;
        active = false;
    }

    // Called after the flash line
    public void BeginShow()
    {
        if (active) return;

        IsPickedUp = false;
        active = true;

        gameObject.SetActive(true);

        if (visualRoot != null) visualRoot.gameObject.SetActive(true);
        if (cachedCollider != null) cachedCollider.enabled = true;

        StartCoroutine(FadeInScale());
    }

    public IEnumerator WaitUntilPickedUp()
    {
        while (!IsPickedUp)
            yield return null;
    }

    IEnumerator FadeInScale()
    {
        float t = 0f;
        if (visualRoot != null) visualRoot.localScale = Vector3.zero;

        while (t < fadeInSeconds)
        {
            t += Time.deltaTime;
            float a = Mathf.Clamp01(t / fadeInSeconds);

            if (visualRoot != null)
                visualRoot.localScale = Vector3.Lerp(Vector3.zero, Vector3.one, a);

            yield return null;
        }

        if (visualRoot != null) visualRoot.localScale = Vector3.one;
    }

    void Update()
    {
        if (!active || IsPickedUp) return;
        if (visualRoot == null) return;

        float bob = Mathf.Sin(Time.time * floatSpeed) * floatAmplitude;
        visualRoot.localPosition = baseLocalPos + new Vector3(0f, bob, 0f);
        visualRoot.Rotate(0f, spinSpeed * Time.deltaTime, 0f, Space.Self);
    }

    // Called by your interactor when you press F
    public void Pickup()
    {
        if (IsPickedUp) return;
        if (!active) return; // do nothing if badge wasn't shown yet

        IsPickedUp = true;

        if (visualRoot != null) visualRoot.gameObject.SetActive(false);
        if (cachedCollider != null) cachedCollider.enabled = false;

        if (VisitorSession.Instance != null)
        {
            VisitorSession.Instance.SetPickedUpBadgeLocal(true);
            VisitorSession.Instance.SetPassedRegistrationLocal(true);
            StartCoroutine(VisitorSession.Instance.SetPassedRegistrationBackend(true));
        }

        gameObject.SetActive(false);
    }
}
