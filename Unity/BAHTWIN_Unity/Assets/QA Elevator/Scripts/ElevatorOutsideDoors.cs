namespace QAtmo
{
    using System.Collections;
    using System.Collections.Generic;
    using UnityEngine;
    using UnityEngine.Events;

    public class ElevatorOutsideDoors : MonoBehaviour
    {
        public int floor;
        [HideInInspector] public ElevatorMoving elevator;

        private void Awake()
        {
            Transform[] allTransforms = transform.parent.GetComponentsInChildren<Transform>();
            for (int i = 0; i < allTransforms.Length; i++)
            {
                if (allTransforms[i].GetComponent<ElevatorMoving>())
                {
                    elevator = allTransforms[i].GetComponent<ElevatorMoving>();

                    break;
                }
            }
        }

        private void OnTriggerEnter(Collider other)
        {
            if (other.transform == elevator.player)
            {          
                elevator.zoneEnterCount++;
            }
        }
        private void OnTriggerExit(Collider other)
        {
            if (other.transform == elevator.player)
            {
                elevator.zoneEnterCount--;
            }
        }
    }
}
