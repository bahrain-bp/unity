using UnityEngine;

public class RegistrationTrigger : MonoBehaviour
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
            Debug.LogWarning("RegistrationTrigger: TutorialManager not assigned.");
            return;
        }

        tutorial.OnRegistrationReached();
    }
}
