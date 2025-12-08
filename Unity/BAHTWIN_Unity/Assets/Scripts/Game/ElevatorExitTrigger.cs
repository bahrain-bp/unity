using UnityEngine;

public class ElevatorExitTrigger : MonoBehaviour
{
    public TutorialManager tutorial;

    private void OnTriggerEnter(Collider other)
    {
        if (other.CompareTag("Player"))
            tutorial.OnElevatorExitReached();
    }
}
