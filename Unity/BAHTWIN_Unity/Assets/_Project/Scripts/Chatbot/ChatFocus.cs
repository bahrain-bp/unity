using UnityEngine;

public class ChatFocus : MonoBehaviour
{
    [Header("References")]
    public Transform playerRoot;        
    public Transform cameraTransform;   
    public Transform target;            

    [Header("Aim")]
    public Vector3 targetOffset = new Vector3(0f, 1.6f, 0f);

    [Header("Smoothing")]
    public float yawSpeed = 10f;
    public float pitchSpeed = 10f;
    public float maxPitch = 80f;
    public float stopThresholdDegrees = 0.5f;

    bool focusing;

    public void StartFocus() => focusing = true;
    public void StopFocus() => focusing = false;

    void LateUpdate()
    {
        if (!focusing || playerRoot == null || cameraTransform == null || target == null) return;

        Vector3 lookPoint = target.position + targetOffset;

        Vector3 dirWorld = (lookPoint - cameraTransform.position);
        if (dirWorld.sqrMagnitude < 0.0001f) return;

        Vector3 dirYaw = dirWorld;
        dirYaw.y = 0f;

        if (dirYaw.sqrMagnitude > 0.0001f)
        {
            float desiredYaw = Quaternion.LookRotation(dirYaw.normalized, Vector3.up).eulerAngles.y;
            float currentYaw = playerRoot.eulerAngles.y;

            float newYaw = Mathf.LerpAngle(currentYaw, desiredYaw, Time.deltaTime * yawSpeed);
            playerRoot.rotation = Quaternion.Euler(0f, newYaw, 0f);
        }

        Vector3 dirCamSpace = cameraTransform.InverseTransformDirection(dirWorld.normalized);

        float desiredPitch = Mathf.Atan2(-dirCamSpace.y, dirCamSpace.z) * Mathf.Rad2Deg;
        desiredPitch = Mathf.Clamp(desiredPitch, -maxPitch, maxPitch);

        float currentPitch = cameraTransform.localEulerAngles.x;
        if (currentPitch > 180f) currentPitch -= 360f;

        float newPitch = Mathf.Lerp(currentPitch, desiredPitch, Time.deltaTime * pitchSpeed);
        cameraTransform.localRotation = Quaternion.Euler(newPitch, 0f, 0f);

        float yawErr = Mathf.DeltaAngle(playerRoot.eulerAngles.y,
            Quaternion.LookRotation(dirYaw.sqrMagnitude > 0.0001f ? dirYaw.normalized : playerRoot.forward).eulerAngles.y);

        float pitchErr = Mathf.DeltaAngle(newPitch, desiredPitch);

        if (Mathf.Abs(yawErr) < stopThresholdDegrees && Mathf.Abs(pitchErr) < stopThresholdDegrees)
        {
            focusing = false;
        }
    }

    public void SnapFocus()
    {
        if (playerRoot == null || cameraTransform == null || target == null) return;

        Vector3 lookPoint = target.position + targetOffset;

        Vector3 dirWorld = (lookPoint - cameraTransform.position);
        if (dirWorld.sqrMagnitude < 0.0001f) return;

        Vector3 dirYaw = dirWorld;
        dirYaw.y = 0f;

        if (dirYaw.sqrMagnitude > 0.0001f)
        {
            float desiredYaw = Quaternion.LookRotation(dirYaw.normalized, Vector3.up).eulerAngles.y;
            playerRoot.rotation = Quaternion.Euler(0f, desiredYaw, 0f);
        }

        Vector3 dirCamSpace = cameraTransform.InverseTransformDirection(dirWorld.normalized);
        float desiredPitch = Mathf.Atan2(-dirCamSpace.y, dirCamSpace.z) * Mathf.Rad2Deg;
        desiredPitch = Mathf.Clamp(desiredPitch, -maxPitch, maxPitch);

        cameraTransform.localRotation = Quaternion.Euler(desiredPitch, 0f, 0f);

        focusing = false;
    }
}
