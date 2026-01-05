using System.Collections;
using UnityEngine;

public class DoorLock : MonoBehaviour
{
    [Header("Lock")]
    public bool isLocked = false;

    [Header("Who can open the door")]
    public string[] allowedTags = { "Player", "Peccy" };


    public void SetLocked(bool locked)
    {
        isLocked = locked;


        // If we lock while it�s open, optionally force close:
        if (isLocked)
        {
            if (openRoutine != null) { StopCoroutine(openRoutine); openRoutine = null; }
            if (closeRoutine != null) { StopCoroutine(closeRoutine); closeRoutine = null; }
            transform.rotation = closedRot;
        }
    }


    [Tooltip("Optional sound when locked door is tried.")]
    public AudioSource lockedSound;

    [Header("Audio")]
    public AudioSource doorOpenSound;   // optional
    public AudioSource doorCloseSound;  // optional

    [Header("Rotation Settings")]
    public float doorOpenAngle = 90f;   // use 90 or -90 for direction
    public float rotationSpeed = 2f;    // how fast it opens/closes
    public float stayOpenDelay = 1f;    // time to wait after player leaves

    private Quaternion closedRot;
    private Quaternion openRot;

    private bool playerInside = false;

    private Coroutine openRoutine;
    private Coroutine closeRoutine;

    void Start()
    {
        closedRot = transform.rotation;
        openRot = closedRot * Quaternion.Euler(0f, doorOpenAngle, 0f);
    }

    private void OnTriggerEnter(Collider other)
    {
        if (!IsAllowedOpener(other)) return;

        if (isLocked)
        {
            if (lockedSound != null && !lockedSound.isPlaying)
                lockedSound.Play();
            return;
        }

        playerInside = true;

        if (closeRoutine != null)
        {
            StopCoroutine(closeRoutine);
            closeRoutine = null;
        }

        if (openRoutine == null)
            openRoutine = StartCoroutine(OpenDoorRoutine());
    }

    private void OnTriggerExit(Collider other)
    {
        if (!IsAllowedOpener(other)) return;

        playerInside = false;

        if (openRoutine == null && closeRoutine == null)
            closeRoutine = StartCoroutine(CloseDoorAfterDelayRoutine());
    }

    private IEnumerator OpenDoorRoutine()
    {
        if (doorOpenSound != null) doorOpenSound.Play();

        Quaternion startRot = transform.rotation;
        float t = 0f;

        while (Quaternion.Angle(transform.rotation, openRot) > 0.1f)
        {
            t += Time.deltaTime * rotationSpeed;
            transform.rotation = Quaternion.Slerp(startRot, openRot, t);
            yield return null;
        }

        transform.rotation = openRot;
        openRoutine = null;

        if (!playerInside && closeRoutine == null)
            closeRoutine = StartCoroutine(CloseDoorAfterDelayRoutine());
    }

    private IEnumerator CloseDoorAfterDelayRoutine()
    {
        float elapsed = 0f;
        while (elapsed < stayOpenDelay)
        {
            if (playerInside)
            {
                closeRoutine = null;
                yield break;
            }

            elapsed += Time.deltaTime;
            yield return null;
        }

        if (doorCloseSound != null) doorCloseSound.Play();

        Quaternion startRot = transform.rotation;
        float t = 0f;

        while (Quaternion.Angle(transform.rotation, closedRot) > 0.1f)
        {
            t += Time.deltaTime * rotationSpeed;
            transform.rotation = Quaternion.Slerp(startRot, closedRot, t);
            yield return null;
        }

        transform.rotation = closedRot;
        closeRoutine = null;
    }

    private bool IsAllowedOpener(Collider other)
    {
        if (allowedTags == null || allowedTags.Length == 0) return other.CompareTag("Player");

        for (int i = 0; i < allowedTags.Length; i++)
        {
            if (!string.IsNullOrEmpty(allowedTags[i]) && other.CompareTag(allowedTags[i]))
                return true;
        }
        return false;
    }
}
