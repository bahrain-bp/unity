using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class DoorLock : MonoBehaviour
{
    public AudioSource doorOpenSound;

    private bool isOpened = false;

    private Quaternion defaultRot;
    private Quaternion openRot;

    public float smooth = 2.0f;
    public float DoorOpenAngle = 90.0f;
    public float rotationTolerance = 1.0f;

    void Start()
    {
        // Store the default rotation
        defaultRot = transform.rotation;

        // Calculate the open rotation
        openRot = Quaternion.Euler(defaultRot.eulerAngles + Vector3.up * DoorOpenAngle);
    }

    void Update()
    {
        // Rotate door toward open state if it is supposed to be open
        if (isOpened && Quaternion.Angle(transform.rotation, openRot) > rotationTolerance)
        {
            transform.rotation = Quaternion.Slerp(transform.rotation, openRot, Time.deltaTime * smooth);
        }
    }

    private void OpenDoor()
    {
        // Mark as opened and play sound
        isOpened = true;

        if (doorOpenSound != null)
        {
            doorOpenSound.Play();
        }
    }

    private void OnTriggerEnter(Collider other)
    {
        // When the player enters the trigger, open the door
        if (other.CompareTag("Player"))
        {
            OpenDoor();
        }
    }
}
