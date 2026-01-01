using UnityEngine;
using UnityEngine.AI;

public class PeccyFollower : MonoBehaviour
{
    [Header("References")]
    public Transform player;

    [Header("Behaviour")]
    public bool followPlayer = false;      // stays false until dialogue sets it
    public float stopDistance = 7f;        // keep distance from player

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

        // If not following or no player reference, stay idle
        if (!followPlayer || player == null)
        {
            if (!agent.isStopped) agent.isStopped = true;
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
