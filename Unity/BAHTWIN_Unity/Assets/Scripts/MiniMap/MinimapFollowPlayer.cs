using UnityEngine;
public class MinimapFollowPlayer : MonoBehaviour
{
    public Transform target;
    public float height = 40f;

    void LateUpdate()
    {
        if (!target) return;

        Vector3 pos = target.position;
        pos.y = height;
        transform.position = pos;

        // If you want the map fixed, keep rotation (90,0,0)
        // If you want it to rotate with the player, uncomment:
        transform.rotation = Quaternion.Euler(90f, target.eulerAngles.y, 0f);
    }
}

