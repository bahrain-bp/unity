using System;
using UnityEngine;

public class GameManager : MonoBehaviour
{
    public enum GameFlow
    {
        Tutorial,
        Registration,
        Normal,
        EmergencyMode,
        Admin
    }

    public static GameManager Instance { get; private set; }

    public static event Action<GameFlow> OnGameFlowChanged;

    [Header("Settings")]
    [SerializeField] private GameFlow initialFlow = GameFlow.Tutorial;
    [SerializeField] private bool logTransitions = true;

    private GameFlow currentFlow;
    public GameFlow CurrentFlow => currentFlow;

    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }

        Instance = this;
        DontDestroyOnLoad(gameObject);

        currentFlow = initialFlow;
        if (logTransitions)
            Debug.Log($"[GameManager] Initial flow: {currentFlow}");

        OnGameFlowChanged?.Invoke(currentFlow);
    }

    public void SetGameFlow(GameFlow newFlow)
    {
        if (currentFlow == newFlow) return;

        if (logTransitions)
            Debug.Log($"[GameManager] Flow change: {currentFlow} → {newFlow}");

        currentFlow = newFlow;
        OnGameFlowChanged?.Invoke(currentFlow);
    }

    public bool IsCurrentFlow(GameFlow flow) => currentFlow == flow;
}
