using UnityEngine;
public class MinimapFollowPlayer : MonoBehaviour
{
       public Transform target;   
    public float height = 40f; 

    void LateUpdate()
    {
        if (!target) return;

        // Follow player X and Z positions, keep Y constant
        Vector3 newPos = target.position;
        newPos.y = height;

        transform.position = newPos;

        // If you want the map fixed, keep rotation (90,0,0)
        // If you want it to rotate with the player, uncomment:
        //transform.rotation = Quaternion.Euler(90f, target.eulerAngles.y, 0f);
    }
}

