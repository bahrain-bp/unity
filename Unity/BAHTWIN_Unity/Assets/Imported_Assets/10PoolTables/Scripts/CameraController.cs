using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class CameraController : MonoBehaviour
{
    public float turnSpeed = 4f;
    public float moveSpeed = 8f;
    public float speedUpMod = 3f;

    public float minTurnAngle = -90f;
    public float maxTurnAngle = 90f;
    private float rotX;
    private bool fastMove;

    void Update()
    {
        if (Input.GetKeyDown("left shift"))
        {
            fastMove = !fastMove;
        }

        MouseAiming();
        KeyboardMovement();
    }

    void MouseAiming()
    {
        // get the mouse inputs
        float y = Input.GetAxis("Mouse X") * turnSpeed;
        rotX += Input.GetAxis("Mouse Y") * turnSpeed;

        // clamp the vertical rotation
        rotX = Mathf.Clamp(rotX, minTurnAngle, maxTurnAngle);

        // rotate the camera
        transform.eulerAngles = new Vector3(-rotX, transform.eulerAngles.y + y, 0);
    }

    void KeyboardMovement()
    {
        Vector3 dir = new Vector3(0, 0, 0);

        dir.x = Input.GetAxis("Horizontal");
        dir.z = Input.GetAxis("Vertical");

        if (fastMove)
            transform.Translate(dir * (moveSpeed * speedUpMod) * Time.deltaTime);
        else
            transform.Translate(dir * moveSpeed * Time.deltaTime);
    }
}
