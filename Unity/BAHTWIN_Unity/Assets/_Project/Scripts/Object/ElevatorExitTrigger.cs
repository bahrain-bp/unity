using UnityEngine;

public class ElevatorExitTrigger : MonoBehaviour
{
    [SerializeField] private TutorialManager tutorial;

    private void Reset()
    {
        // Auto-assign if placed in scene
        tutorial = FindObjectOfType<TutorialManager>();
    }

    private void OnTriggerEnter(Collider other)
    {
        if (!other.CompareTag("Player"))
            return;

        if (tutorial == null)
        {
            Debug.LogWarning("ElevatorExitTrigger: TutorialManager not assigned.");
            return;
        }

        tutorial.OnElevatorExitReached();
    }
}
