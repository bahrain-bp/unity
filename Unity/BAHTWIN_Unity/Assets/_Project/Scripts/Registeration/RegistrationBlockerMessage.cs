using System.Collections;
using TMPro;
using UnityEngine;

public class RegistrationBlockerMessage : MonoBehaviour
{
    [Header("Prompt UI (reuse PlayerInteractor prompt)")]
    public GameObject promptRoot;   // drag PlayerInteractor.promptRoot
    public TMP_Text promptText;     // drag PlayerInteractor.promptText

    [TextArea]
    public string message = "You must pass registration to unlock this path.";

    [Header("Timing")]
    public float showSeconds = 2.0f;
    public float cooldownSeconds = 1.0f;

    private bool coolingDown;
    private Coroutine routine;

    private void Reset()
    {
        // Helpful default: make this collider a trigger if one exists
        var col = GetComponent<Collider>();
        if (col != null) col.isTrigger = true;
    }

    private void OnTriggerEnter(Collider other)
    {
        if (!other.CompareTag("Player")) return;

        // If already registered, do nothing
        if (VisitorSession.Instance != null &&
            VisitorSession.Instance.IsLoaded &&
            VisitorSession.Instance.Profile != null &&
            VisitorSession.Instance.Profile.passedRegistration)
            return;

        if (coolingDown) return;

        if (routine != null) StopCoroutine(routine);
        routine = StartCoroutine(ShowRoutine());
    }

    private IEnumerator ShowRoutine()
    {
        coolingDown = true;

        // show
        if (promptRoot != null) promptRoot.SetActive(true);
        if (promptText != null) promptText.text = message;

        // wait
        yield return new WaitForSeconds(showSeconds);

        // hide (only if we are the one showing it)
        if (promptRoot != null) promptRoot.SetActive(false);

        // cooldown to avoid spam
        yield return new WaitForSeconds(cooldownSeconds);
        coolingDown = false;
    }
}
