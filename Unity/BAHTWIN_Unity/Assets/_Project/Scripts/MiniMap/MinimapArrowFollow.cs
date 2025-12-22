using UnityEngine;

public class MinimapArrowFollow : MonoBehaviour
{
    public Transform player;

    void LateUpdate()
    {
        transform.rotation = Quaternion.Euler(90, player.eulerAngles.y, 0);
    }
}

