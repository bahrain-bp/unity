using UnityEngine;

public class Billboard : MonoBehaviour
{
    void LateUpdate()
    {
        if (Camera.main == null) return;

        transform.LookAt(Camera.main.transform);
        transform.rotation = Quaternion.Euler(0f, transform.rotation.eulerAngles.y + 180f, 0f);

    }
}