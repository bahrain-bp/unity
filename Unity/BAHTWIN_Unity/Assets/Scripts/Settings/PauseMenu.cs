using UnityEngine;
using UnityEngine.UI;
using UnityEngine.InputSystem;

public class PauseMenu : MonoBehaviour
{
    // Start is called once before the first execution of Update after the MonoBehaviour is created
    public GameObject pauseMenuUI;
    public GameObject playUI;
    //[Serilazition] private GameManager gameManager;
    private bool isPaused = false;

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

    public void ResumeGame()
    {
        pauseMenuUI.SetActive(false);
        playUI.SetActive(true);
        Time.timeScale = 1f;
        isPaused = false;

        print("test");
    }

    public void PauseGame()
    {
        pauseMenuUI.SetActive(true);
        playUI.SetActive(false);
        //Time.timeScale = 0f;
        isPaused = true;
    }
}