using UnityEngine;
using UnityEngine.InputSystem;
using TMPro;

public class PlayerInteractor : MonoBehaviour
{
    [Header("Raycast")]
    public Camera cam;
    public float maxDistance = 2.2f;
    public LayerMask interactMask = ~0;

    [Header("Prompt UI")]
    public GameObject promptRoot;
    public TMP_Text promptText;
    public string promptMessage = "Press F to interact";

    [Header("Input")]
    public PlayerInput playerInput;
    public string actionMapName = "Player";
    public string interactActionName = "Interact";

    private InputAction interactAction;
    private BadgePickupInteractable currentBadge;

    void Start()
    {
        if (cam == null) cam = Camera.main;
        if (playerInput == null) playerInput = GetComponent<PlayerInput>();

        if (playerInput != null && playerInput.actions != null)
        {
            var map = playerInput.actions.FindActionMap(actionMapName, true);
            interactAction = map.FindAction(interactActionName, true);
        }

        SetPrompt(false);
    }

    void Update()
    {
        currentBadge = FindBadge();

        bool canInteract = currentBadge != null;

        SetPrompt(canInteract);

        if (canInteract && interactAction != null && interactAction.WasPressedThisFrame())
        {
            currentBadge.Pickup();
            SetPrompt(false);
        }
    }

    BadgePickupInteractable FindBadge()
    {
        if (cam == null) return null;

        Ray ray = new Ray(cam.transform.position, cam.transform.forward);

        if (Physics.Raycast(ray, out var hit, maxDistance, interactMask, QueryTriggerInteraction.Ignore))
        {
            var badge = hit.collider.GetComponentInParent<BadgePickupInteractable>();
            if (badge != null && badge.gameObject.activeInHierarchy)
                return badge;
        }

        return null;
    }

    void SetPrompt(bool on)
    {
        if (promptRoot != null) promptRoot.SetActive(on);
        if (on && promptText != null) promptText.text = promptMessage;
    }
}
