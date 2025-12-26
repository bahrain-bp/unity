using UnityEngine;
using UnityEngine.UI;
using UnityEngine.InputSystem;

public class PauseMenu : MonoBehaviour
{
    // Start is called once before the first execution of Update after the MonoBehaviour is created
    public GameObject pauseMenuUI;
    public GameObject playUI;
    public GameObject tutorialUI;
    private GameFlowManager.GameFlow currentFlow;

    [Header("Player Control")]
    [SerializeField] private PlayerInput playerInput;
    [SerializeField] private GameObject player;
    private MonoBehaviour fpsController;

    private bool isPaused = false;

    private void OnEnable()
    {
        GameFlowManager.OnGameFlowChanged += HandleGameFlowChanged;
    }

    private void OnDisable()
    {
        GameFlowManager.OnGameFlowChanged -= HandleGameFlowChanged;
    }

    void Start()
    {
        pauseMenuUI.SetActive(false);
        HandleGameFlowChanged(GameFlowManager.Instance.CurrentFlow);
        fpsController = player.GetComponent<MonoBehaviour>();
    }

    void Update()
    {
        // Check ESC or P using the new InputSystem API
        if (Keyboard.current.escapeKey.wasPressedThisFrame)
        {
            if (isPaused)
                ResumeGame();
            else
                PauseGame();
        }
    }
    private void HandleGameFlowChanged(GameFlowManager.GameFlow flow)
    {
        currentFlow = flow;
        
        if (isPaused) return;

        playUI.SetActive(flow != GameFlowManager.GameFlow.Tutorial);
        tutorialUI.SetActive(flow == GameFlowManager.GameFlow.Tutorial);
    }

    public void ResumeGame()
    {
        pauseMenuUI.SetActive(false);
        playUI.SetActive(currentFlow != GameFlowManager.GameFlow.Tutorial);
        tutorialUI.SetActive(currentFlow == GameFlowManager.GameFlow.Tutorial);
        Time.timeScale = 1f;
        playerInput.enabled = true;
        fpsController.enabled = true;
        isPaused = false;
        Cursor.lockState = CursorLockMode.Locked;
        Cursor.visible = false;
    }

    public void PauseGame()
    {
        pauseMenuUI.SetActive(true);
        playUI.SetActive(false);
        tutorialUI.SetActive(false);
        Time.timeScale = 0f;
        playerInput.enabled = false;
        fpsController.enabled = false;
        isPaused = true;
        Cursor.lockState = CursorLockMode.None;
        Cursor.visible = true;
    }
}