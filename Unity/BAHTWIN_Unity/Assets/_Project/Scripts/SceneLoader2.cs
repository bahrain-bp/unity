using UnityEngine;
using UnityEngine.SceneManagement;

public class SceneLoader2 : MonoBehaviour
{
    public string nextSceneName;
    public float delayBeforeLoad = 0f;

    public void LoadNextScene()
    {
        if (delayBeforeLoad > 0f)
            Invoke(nameof(Load), delayBeforeLoad);
        else
            Load();
    }

    private void Load()
    {
        SceneManager.LoadScene(nextSceneName);
    }
}
