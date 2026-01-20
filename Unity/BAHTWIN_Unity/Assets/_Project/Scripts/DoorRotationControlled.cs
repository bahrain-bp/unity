using UnityEngine;

public class DoorRotationControlled : MonoBehaviour
{
    [Header("Rotation")]
    public float speed = 90f;        // degrees per second
    public float openAngle = 90f;    // total rotation angle
    public bool rotateAroundY = true;

    private bool isOpening = false;
    private float rotated = 0f;

    // Exposed state for CinematicTour
    public bool IsOpening => isOpening;
    public float Progress01 => (openAngle <= 0f)
        ? 1f
        : Mathf.Clamp01(rotated / openAngle);

    void Update()
    {
        if (!isOpening) return;

        float step = speed * Time.deltaTime;
        float remaining = openAngle - rotated;
        float actual = Mathf.Min(step, remaining);

        if (rotateAroundY)
            transform.Rotate(0f, actual, 0f);
        else
            transform.Rotate(actual, 0f, 0f);

        rotated += actual;
        Debug.Log($"Door progress: {Progress01:0.00}");


        if (rotated >= openAngle)
        {
            isOpening = false;
        }
    }

    public void OpenDoor()
    {
        rotated = 0f;
        isOpening = true;
    }
}
