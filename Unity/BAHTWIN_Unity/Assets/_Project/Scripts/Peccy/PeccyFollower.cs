using UnityEngine;
using UnityEngine.AI;

public class PeccyFollower : MonoBehaviour
{
    [Header("References")]
    public Transform player;

    [Header("Behaviour")]
    public bool followPlayer = false;
    public float stopDistance = 8f;

    private NavMeshAgent agent;
    private Animator animator;

    private readonly int isWalkingHash = Animator.StringToHash("isWalking");

    void Awake()
    {
        agent = GetComponent<NavMeshAgent>();
        animator = GetComponent<Animator>();

        if (agent == null) Debug.LogError("PeccyFollower: No NavMeshAgent found.");
        if (animator == null) Debug.LogError("PeccyFollower: No Animator found.");
    }

    public void SetFollow(bool shouldFollow)
    {
        followPlayer = shouldFollow;

        if (agent == null) return;

        // Only STOP ONCE when turning follow OFF
        if (!followPlayer)
        {
            agent.isStopped = true;
            agent.ResetPath();
            SetWalking(false);
        }
    }

    void Update()
    {
        if (agent == null) return;

        // IMPORTANT:
        // If follow is OFF, do NOT keep forcing agent state every frame.
        // Tour/other systems may need to move the agent.
        if (!followPlayer || player == null)
        {
            SetWalking(false);
            return;
        }

        float distance = Vector3.Distance(transform.position, player.position);

        if (distance > stopDistance)
        {
            agent.isStopped = false;
            agent.SetDestination(player.position);
        }
        else
        {
            agent.isStopped = true;
            agent.ResetPath();
        }

        bool isMoving = !agent.isStopped && agent.velocity.sqrMagnitude > 0.01f;
        SetWalking(isMoving);
    }

    private void SetWalking(bool value)
    {
        if (animator != null)
            animator.SetBool(isWalkingHash, value);
    }
}
