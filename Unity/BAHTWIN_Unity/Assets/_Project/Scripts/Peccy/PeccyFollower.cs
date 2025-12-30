using UnityEngine;
using UnityEngine.AI;
using UnityEngine.InputSystem;

public class PeccyFollower : MonoBehaviour
{
    [Header("References")]
    public Transform player;
    private NavMeshAgent agent;
    private Animator animator;

    [Header("Behaviour")]
    public bool followPlayer = false; // Start with false so Peccy is idle
    public float stopDistance = 7f; // Distance to keep from the player

    private readonly int isWalkingHash = Animator.StringToHash("isWalking");

    private InputAction toggleFollowAction;

    void Awake()
    {
        agent = GetComponent<NavMeshAgent>();
        animator = GetComponent<Animator>();

        if (agent == null)
        {
            Debug.LogError("PeccyFollower: No NavMeshAgent found on this GameObject.");
        }

        if (animator == null)
        {
            Debug.LogError("PeccyFollower: No Animator found on this GameObject.");
        }

        // Create a simple input action that listens to the P key
        toggleFollowAction = new InputAction(
            type: InputActionType.Button,
            binding: "<Keyboard>/p"
        );

        toggleFollowAction.performed += OnToggleFollow;
        toggleFollowAction.Enable();
    }

    void OnDestroy()
    {
        if (toggleFollowAction != null)
        {
            toggleFollowAction.performed -= OnToggleFollow;
            toggleFollowAction.Disable();
        }
    }

    private void OnToggleFollow(InputAction.CallbackContext context)
    {
        followPlayer = !followPlayer;
    }

    void Update()
    {
        // If not following or no player reference, stay idle
        if (!followPlayer || player == null)
        {
            if (!agent.isStopped)
            {
                agent.isStopped = true;
            }

            SetWalking(false);
            return;
        }

        // Follow the player using NavMeshAgent but keep a distance
        float distance = Vector3.Distance(transform.position, player.position);

        if (distance > stopDistance)
        {
            agent.isStopped = false;
            agent.SetDestination(player.position);
        }
        else
        {
            // Close enough, stop near the player
            agent.isStopped = true;
        }

        // Decide if Peccy should play walk or idle animation
        bool isMoving = !agent.isStopped && agent.velocity.sqrMagnitude > 0.01f;
        SetWalking(isMoving);
    }

    private void SetWalking(bool value)
    {
        if (animator != null)
        {
            animator.SetBool(isWalkingHash, value);
        }
    }
}
