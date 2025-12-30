using System.Collections;
using UnityEngine;

public class DoorLock : MonoBehaviour
{
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
        // Save start rotation as "closed"
        closedRot = transform.rotation;

        // Open rotation relative to the closed one
        openRot = closedRot * Quaternion.Euler(0f, doorOpenAngle, 0f);
    }

    private void OnTriggerEnter(Collider other)
    {
        if (!other.CompareTag("Player")) return;

        playerInside = true;

        // If it's trying to close, cancel that
        if (closeRoutine != null)
        {
            StopCoroutine(closeRoutine);
            closeRoutine = null;
        }

        // Start opening if not already opening
        if (openRoutine == null)
        {
            openRoutine = StartCoroutine(OpenDoorRoutine());
        }
    }

    private void OnTriggerExit(Collider other)
    {
        if (!other.CompareTag("Player")) return;

        playerInside = false;

        // If the door is already fully open (no openRoutine running),
        // we can start the "wait then close" straight away.
        if (openRoutine == null && closeRoutine == null)
        {
            closeRoutine = StartCoroutine(CloseDoorAfterDelayRoutine());
        }
    }

    private IEnumerator OpenDoorRoutine()
    {
        if (doorOpenSound != null)
            doorOpenSound.Play();

        Quaternion startRot = transform.rotation;
        float t = 0f;

        // Always finish opening fully once started
        while (Quaternion.Angle(transform.rotation, openRot) > 0.1f)
        {
            t += Time.deltaTime * rotationSpeed;
            transform.rotation = Quaternion.Slerp(startRot, openRot, t);
            yield return null;
        }

        transform.rotation = openRot; // snap exactly
        openRoutine = null;

        // If the player already left while it was opening,
        // start the close-after-delay routine now.
        if (!playerInside && closeRoutine == null)
        {
            closeRoutine = StartCoroutine(CloseDoorAfterDelayRoutine());
        }
    }

    private IEnumerator CloseDoorAfterDelayRoutine()
    {
        // Wait a bit; if player comes back, cancel closing
        float elapsed = 0f;
        while (elapsed < stayOpenDelay)
        {
            if (playerInside)
            {
                closeRoutine = null;
                yield break; // someone came back, stop closing
            }

            elapsed += Time.deltaTime;
            yield return null;
        }

        if (doorCloseSound != null)
            doorCloseSound.Play();

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
}
