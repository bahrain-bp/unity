using UnityEngine;
using UnityEngine.AI;

public class TestAgentMove : MonoBehaviour
{
    public NavMeshAgent agent;
    public Transform target;

    void Start()
    {
        agent = GetComponent<NavMeshAgent>();
    }

    void Update()
    {
        agent.SetDestination(target.position);
    }
}
