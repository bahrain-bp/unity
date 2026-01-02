using UnityEngine;
using UnityEngine.InputSystem;

public class BadgeDoorEntry : MonoBehaviour
{
    [Header("UI Prompt")]
    public GameObject promptUI;                 
    public string promptLine = "Open (F)";

    [Header("Entry blocker (outside only)")]
    public Collider entryBlocker;

    [Header("Tap Point (near badge reader)")]
    public Transform tapPoint;

    [Header("Peccy Dialogue (owner of bubble + animation)")]
    public PeccyDialogue peccyDialogue;

    [Header("Allow entry seconds")]
    public float allowSeconds = 15f;

    [Header("Input")]
    public PlayerInput playerInput;
    public string actionMapName = "Player";
    public string interactActionName = "Interact";

    private InputAction interactAction;
    private bool playerInZone;

    void Start()
    {
        if (promptUI != null) promptUI.SetActive(false);

        if (entryBlocker != null)
            entryBlocker.enabled = true;

        if (playerInput != null && playerInput.actions != null)
        {
            var map = playerInput.actions.FindActionMap(actionMapName, true);
            interactAction = map.FindAction(interactActionName, true);
        }
    }

    void Update()
    {
        if (!playerInZone) return;
        if (interactAction == null) return;

        if (interactAction.WasPressedThisFrame()) 
        {
            // Trigger Peccy's badge flow for THIS door
            if (peccyDialogue != null)
                peccyDialogue.StartBadgeDoorSequence(tapPoint, entryBlocker, allowSeconds);

            // Hide prompt while sequence runs
            if (promptUI != null) promptUI.SetActive(false);
        }
    }

    private void OnTriggerEnter(Collider other)
    {
        if (!other.CompareTag("Player")) return;
        playerInZone = true;
        if (promptUI != null) promptUI.SetActive(true);
    }

    private void OnTriggerExit(Collider other)
    {
        if (!other.CompareTag("Player")) return;
        playerInZone = false;
        if (promptUI != null) promptUI.SetActive(false);
    }
}
