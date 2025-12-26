using UnityEngine;

public class MinimapCameraFollow : MonoBehaviour
{
    public Transform player;
    public float height = 20f;

    void LateUpdate()
    {
        if (!player) return;

        transform.position = new Vector3(
            player.position.x,
            height,
            player.position.z
        );
    }
}
