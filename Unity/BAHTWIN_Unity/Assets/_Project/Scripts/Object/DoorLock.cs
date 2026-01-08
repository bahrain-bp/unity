using System.Collections;
using UnityEngine;

public class DoorLock : MonoBehaviour
{
    [Header("Lock")]
    public bool isLocked = false;

    [Header("Who can open the door")]
    public string[] allowedTags = { "Player", "Peccy" };

    [Header("Door Visual (HINGE to rotate)")]
    public Transform doorHinge;   // <-- ASSIGN DoorHinge HERE

    [Tooltip("Optional sound when locked door is tried.")]
    public AudioSource lockedSound;

    [Header("Audio")]
    public AudioSource doorOpenSound;
    public AudioSource doorCloseSound;

    [Header("Rotation Settings")]
    public float doorOpenAngle = 90f;
    public float rotationSpeed = 2f;
    public float stayOpenDelay = 1f;

    private Quaternion closedRot;
    private Quaternion openRot;

    private bool playerInside = false;

    private Coroutine openRoutine;
    private Coroutine closeRoutine;

    void Start()
    {
        closedRot = doorHinge.localRotation;
        openRot = closedRot * Quaternion.Euler(0f, doorOpenAngle, 0f);
    }

    public void SetLocked(bool locked)
    {
        isLocked = locked;

        if (isLocked)
        {
            if (openRoutine != null) { StopCoroutine(openRoutine); openRoutine = null; }
            if (closeRoutine != null) { StopCoroutine(closeRoutine); closeRoutine = null; }
            doorHinge.localRotation = closedRot;
        }
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

        Quaternion startRot = doorHinge.localRotation;
        float t = 0f;

        while (Quaternion.Angle(doorHinge.localRotation, openRot) > 0.1f)
        {
            t += Time.deltaTime * rotationSpeed;
            doorHinge.localRotation = Quaternion.Slerp(startRot, openRot, t);
            yield return null;
        }

        doorHinge.localRotation = openRot;
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

        Quaternion startRot = doorHinge.localRotation;
        float t = 0f;

        while (Quaternion.Angle(doorHinge.localRotation, closedRot) > 0.1f)
        {
            t += Time.deltaTime * rotationSpeed;
            doorHinge.localRotation = Quaternion.Slerp(startRot, closedRot, t);
            yield return null;
        }

        doorHinge.localRotation = closedRot;
        closeRoutine = null;
    }

    private bool IsAllowedOpener(Collider other)
    {
        if (allowedTags == null || allowedTags.Length == 0)
            return other.CompareTag("Player");

        for (int i = 0; i < allowedTags.Length; i++)
        {
            if (!string.IsNullOrEmpty(allowedTags[i]) && other.CompareTag(allowedTags[i]))
                return true;
        }
        return false;
    }
}
