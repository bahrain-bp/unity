using UnityEngine;

public class GameManager : MonoBehaviour
{
    public static GameManager Instance { get; private set; }

    [Header("Managers")]
    [SerializeField] private GameFlowManager gameFlowManager;
    [SerializeField] private SceneHandler sceneHandler;
    // [SerializeField] private UIManager uiManager;
    // [SerializeField] private AudioManager audioManager;

    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }

        Instance = this;
        DontDestroyOnLoad(gameObject);

        gameFlowManager ??= FindObjectOfType<GameFlowManager>();
        sceneHandler ??= FindObjectOfType<SceneHandler>();
        // uiManager ??= FindObjectOfType<UIManager>();
        // audioManager ??= FindObjectOfType<AudioManager>();

        if (!gameFlowManager)
            gameFlowManager = new GameObject("GameFlowManager").AddComponent<GameFlowManager>();

        if (!sceneHandler)
            sceneHandler = new GameObject("SceneHandler").AddComponent<SceneHandler>();
    }
}
