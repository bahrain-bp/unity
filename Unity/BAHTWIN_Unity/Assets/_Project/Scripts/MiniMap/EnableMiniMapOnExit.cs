using UnityEngine;
using System.Collections;

public class EnableMiniMapOnExit : MonoBehaviour
{
    [Header("Mini Map Root")]
    public GameObject miniMapRoot;

    [Header("Delay Settings")]
    public float enableDelay = 0.3f;

    private bool triggered = false;

    private void OnTriggerEnter(Collider other)
    {
        if (triggered)
            return;

        if (!other.CompareTag("Player"))
            return;

        triggered = true;
        StartCoroutine(EnableMiniMapAfterDelay());
    }

    private IEnumerator EnableMiniMapAfterDelay()
    {
        yield return new WaitForSeconds(enableDelay);

        if (miniMapRoot != null)
            miniMapRoot.SetActive(true);

        // Disable trigger after use
        gameObject.SetActive(false);
    }
}
