using UnityEngine;
using UnityEngine.InputSystem;
using TMPro;

public class PlayerInteractor_Generic : MonoBehaviour
{
    [Header("Raycast")]
    public Camera cam;
    public float maxDistance = 2.2f;
    public LayerMask interactMask = ~0;

    [Header("Prompt UI")]
    public GameObject promptRoot;
    public TMP_Text promptText;

    [Header("Input")]
    public PlayerInput playerInput;
    public string actionMapName = "Player";
    public string interactActionName = "Interact";

    [Header("Debug")]
    public bool debugRay;

    private InputAction interactAction;
    private IInteractable current;
    private IInteractable last;

    void Start()
    {
        if (cam == null) cam = Camera.main;
        if (playerInput == null) playerInput = GetComponent<PlayerInput>();

        if (playerInput != null && playerInput.actions != null)
        {
            var map = playerInput.actions.FindActionMap(actionMapName, true);
            interactAction = map.FindAction(interactActionName, true);
        }

        SetPrompt(false, null);
    }

    void Update()
    {
        current = FindInteractable();

        if (current != last)
        {
            if (last != null) last.OnFocusExit(gameObject);
            if (current != null) current.OnFocusEnter(gameObject);
            last = current;
        }

        bool canInteract = current != null && current.CanInteract;

        if (canInteract) SetPrompt(true, current.PromptText);
        else SetPrompt(false, null);

        if (canInteract && interactAction != null && interactAction.WasPressedThisFrame())
        {
            current.Interact(gameObject);
            SetPrompt(false, null); // hide after press F
        }
    }

    IInteractable FindInteractable()
    {
        if (cam == null) return null;

        Ray ray = new Ray(cam.transform.position, cam.transform.forward);

        if (debugRay)
            Debug.DrawRay(ray.origin, ray.direction * maxDistance, Color.cyan);

        if (Physics.Raycast(ray, out var hit, maxDistance, interactMask, QueryTriggerInteraction.Ignore))
        {
            // Important: Raycast hits colliders, so we search parents for the script.
            var monos = hit.collider.GetComponentsInParent<MonoBehaviour>(true);
            for (int i = 0; i < monos.Length; i++)
            {
                if (monos[i] is IInteractable it && it.CanInteract)
                    return it;
            }
        }

        return null;
    }

    void SetPrompt(bool on, string msg)
    {
        if (promptRoot != null) promptRoot.SetActive(on);
        if (on && promptText != null)
            promptText.text = string.IsNullOrEmpty(msg) ? "Press F to interact" : msg;
    }
}
