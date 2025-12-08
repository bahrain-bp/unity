using UnityEngine;
using UnityEngine.InputSystem;
using TMPro;
using UnityEngine.UI;

public class TutorialManager : MonoBehaviour
{
    public enum Step
    {
        LookAround,
        MoveAround,
        Jump,
        ElevatorInteraction,
        ExitElevator,
        MinimapOpen,
        MinimapSelectOffice,
        MinimapSelectNavigate,
        NavigationToWaypoint,
        RegistrationInteraction,
        Completed
    }

    [Header("UI")]
    public Canvas tutorialCanvas;
    public TMP_Text titleText;
    public TMP_Text bodyText;

    [Header("Movement UI")]
    public GameObject wasdKeys;
    public Image WImage;
    public Image AImage;
    public Image SImage;
    public Image DImage;

    public Color completedColor = Color.green;
    public Color defaultColor = Color.white;

    [Header("References")]
    public Transform playerCamera;
    public Transform lookTarget;
    public GameObject elevatorButton;
    public GameObject registrationTable;

    private Step current = Step.LookAround;

    bool pressedW, pressedA, pressedS, pressedD;
    bool jumped = false;

    private void Start()
    {
        wasdKeys.SetActive(false);
        ShowUI("Look Around", "Look at the highlighted object.");
    }

    private void Update()
    {
        if (current == Step.LookAround)
            DetectLookDirection();

        if (current == Step.MoveAround)
            DetectKeyboardMovement();

        if (current == Step.Jump)
            DetectJumpFallback();

        if (current == Step.ElevatorInteraction || current == Step.RegistrationInteraction)
            DetectInteractFallback();
    }

    public void OnJump(InputAction.CallbackContext ctx)
    {
        if (!ctx.performed) return;
        if (current != Step.Jump) return;

        jumped = true;
        Advance(Step.ElevatorInteraction, "Elevator", "Look at the elevator button and press F.");
    }

    public void OnInteract(InputAction.CallbackContext ctx)
    {
        if (!ctx.performed) return;
        HandleInteract();
    }

    public void OnOpenMinimap(InputAction.CallbackContext ctx)
    {
        if (!ctx.performed) return;

        if (current == Step.MinimapOpen)
            Advance(Step.MinimapSelectOffice, "Minimap", "Select the Registration Office.");
    }

    public void OnOfficeSelected() =>
        AdvanceIf(Step.MinimapSelectOffice, Step.MinimapSelectNavigate,
            "Navigation", "Select Navigate or Teleport.");

    public void OnNavigateChosen() =>
        AdvanceIf(Step.MinimapSelectNavigate, Step.NavigationToWaypoint,
            "Navigation", "Follow the waypoint marker.");

    public void OnWaypointReached() =>
        AdvanceIf(Step.NavigationToWaypoint, Step.RegistrationInteraction,
            "Registration", "Look at the table and press F.");

    void DetectLookDirection()
    {
        Vector3 dir = (lookTarget.position - playerCamera.position).normalized;
        float dot = Vector3.Dot(playerCamera.forward, dir);

        if (dot > 0.97f)
            Advance(Step.MoveAround, "Movement", "Press W, A, S, and D once each.");
    }

    void DetectKeyboardMovement()
    {
        var kb = Keyboard.current;
        if (kb == null) return;

        if (!pressedW && kb.wKey.wasPressedThisFrame)
        {
            pressedW = true;
            WImage.color = completedColor;
        }

        if (!pressedA && kb.aKey.wasPressedThisFrame)
        {
            pressedA = true;
            AImage.color = completedColor;
        }

        if (!pressedS && kb.sKey.wasPressedThisFrame)
        {
            pressedS = true;
            SImage.color = completedColor;
        }

        if (!pressedD && kb.dKey.wasPressedThisFrame)
        {
            pressedD = true;
            DImage.color = completedColor;
        }

        if (pressedW && pressedA && pressedS && pressedD)
            Advance(Step.Jump, "Jump", "Press SPACE to jump.");
    }

    void DetectJumpFallback()
    {
        var kb = Keyboard.current;
        if (kb == null) return;

        if (!jumped && kb.spaceKey.wasPressedThisFrame)
        {
            jumped = true;
            Advance(Step.ElevatorInteraction, "Elevator", "Look at the elevator button and press F.");
        }
    }

    void DetectInteractFallback()
    {
        var kb = Keyboard.current;
        if (kb == null) return;

        if (kb.fKey.wasPressedThisFrame)
            HandleInteract();
    }

    void HandleInteract()
    {
        if (current == Step.ElevatorInteraction)
        {
            if (IsLookingAt(elevatorButton.transform))
            {
                Advance(Step.ExitElevator, "Exit Elevator", "Walk out of the elevator.");
            }
            return;
        }

        if (current == Step.RegistrationInteraction)
        {
            if (IsLookingAt(registrationTable.transform))
                CompleteTutorial();
        }
    }

    public void OnElevatorExitReached()
    {
        if (current != Step.ExitElevator) return;
        Advance(Step.MinimapOpen, "Minimap", "Press M to open the minimap.");
    }

    void ResetWASDUI()
    {
        WImage.color = defaultColor;
        AImage.color = defaultColor;
        SImage.color = defaultColor;
        DImage.color = defaultColor;

        pressedW = pressedA = pressedS = pressedD = false;
    }

    void Advance(Step next, string title, string body)
    {
        current = next;
        ShowUI(title, body);

        wasdKeys.SetActive(next == Step.MoveAround);

        if (next != Step.MoveAround)
            ResetWASDUI();
    }

    void AdvanceIf(Step required, Step next, string title, string body)
    {
        if (current != required) return;
        Advance(next, title, body);
    }

    void ShowUI(string title, string body)
    {
        tutorialCanvas.enabled = true;
        titleText.text = title;
        bodyText.text = body;
    }

    bool IsLookingAt(Transform target)
    {
        Ray ray = new Ray(playerCamera.position, playerCamera.forward);
        if (Physics.Raycast(ray, out RaycastHit hit, 5f))
            return hit.transform == target.transform || hit.transform.IsChildOf(target.transform);

        return false;
    }

    void CompleteTutorial()
    {
        current = Step.Completed;
        tutorialCanvas.enabled = false;
        GameManager.Instance.SetGameFlow(GameManager.GameFlow.Registration);
    }
}
