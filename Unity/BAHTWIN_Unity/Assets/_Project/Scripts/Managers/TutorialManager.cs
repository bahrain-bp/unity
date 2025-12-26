using UnityEngine;
using UnityEngine.InputSystem;
using TMPro;
using UnityEngine.UI;
using System.Diagnostics;

public class TutorialManager : MonoBehaviour
{
    public enum Step
    {
        Welcome,
        FindFloorList,
        PressCorrectFloor,
        ExitElevator,
        OpenMinimap,
        SelectRegistration,
        PressNavigate,
        WalkToRegistration,
        Completed
    }


    [Header("UI")]
    public GameObject welcomePanel;
    public Image controlsImage;
    public TMP_Text instructionText;

    [Header("References")]
    public Transform playerCamera;
    public Transform floorListTarget;
    public GameObject elevatorButton;
    public Collider registrationRoomTrigger;

    [Header("Developer Control")]
    public Step endTutorialAt = Step.Completed;

    private Step current = Step.Welcome;

    private void Start()
    {

        welcomePanel.SetActive(true);
        controlsImage.gameObject.SetActive(false);

        instructionText.text = "Press ENTER to continue";
        floorListTarget.GetComponent<Outline>().enabled = false;
    }

    private void Update()
    {
        switch (current)
        {
            case Step.Welcome:
                DetectWelcome();
                break;

            case Step.FindFloorList:
                DetectLookAtFloorList();
                break;

            case Step.OpenMinimap:
                DetectMinimapOpen();
                break;
        }
    }

    // --------------------------------------------------
    // INPUT CALLBACKS
    // --------------------------------------------------

    public void OnInteract(InputAction.CallbackContext ctx)
    {
        if (!ctx.started) return;

        if (current == Step.PressCorrectFloor && IsLookingAt(elevatorButton.transform))
            Advance(Step.ExitElevator);
    }

    public void OnOpenMinimap(InputAction.CallbackContext ctx)
    {
        if (!ctx.performed) return;

        if (current == Step.OpenMinimap)
            Advance(Step.SelectRegistration);
    }

    // Called by minimap UI (button OR list)
    public void OnRegistrationSelected()
    {
        if (current == Step.SelectRegistration)
            Advance(Step.PressNavigate);
    }

    // Called by minimap Navigate button
    public void OnNavigatePressed()
    {
        if (current == Step.PressNavigate)
            Advance(Step.WalkToRegistration);
    }

    // --------------------------------------------------
    // STEP LOGIC
    // --------------------------------------------------

    void DetectWelcome()
    {
        if (Keyboard.current.enterKey.wasPressedThisFrame)
            Advance(Step.FindFloorList);
    }

    void DetectLookAtFloorList()
    {
        Vector3 dir = (floorListTarget.position - playerCamera.position).normalized;
        if (Vector3.Dot(playerCamera.forward, dir) > 0.97f)
            Advance(Step.PressCorrectFloor);
    }

    void DetectMinimapOpen()
    {
        // handled by input callback
    }

    // --------------------------------------------------
    // STEP TRANSITIONS
    // --------------------------------------------------

    void Advance(Step next)
    {
        current = next;

        if (current == endTutorialAt)
        {
            CompleteTutorial();
            return;
        }

        switch (current)
        {
            case Step.FindFloorList:
                welcomePanel.SetActive(false);
                controlsImage.gameObject.SetActive(true);
                instructionText.text = "Find the floor list inside the elevator.";
                floorListTarget.gameObject.GetComponent<Outline>().enabled = true;
                break;

            case Step.PressCorrectFloor:
                instructionText.text = "Press the correct floor (AWS – Floor 2).";
                floorListTarget.gameObject.GetComponent<Outline>().enabled = false;
                elevatorButton.GetComponent<Outline>().enabled = true;
                break;

            case Step.ExitElevator:
                instructionText.text = "Exit the elevator.";
                elevatorButton.GetComponent<Outline>().enabled = false;
                break;

            case Step.OpenMinimap:
                instructionText.text = "Press M to open the minimap.";
                break;

            case Step.SelectRegistration:
                instructionText.text = "Select the Registration Room on the minimap.";
                break;

            case Step.PressNavigate:
                instructionText.text = "Press Navigate (or Teleport) to proceed.";
                break;

            case Step.WalkToRegistration:
                instructionText.text = "Follow navigation to the Registration desk.";
                break;
        }
    }

    // --------------------------------------------------
    // TRIGGERS
    // --------------------------------------------------

    private void OnRegistrationReached()
    {
        if (current == Step.WalkToRegistration)
            CompleteTutorial();
    }

    public void OnElevatorExitReached()
    {
        if (current != Step.ExitElevator)
            return;

        Advance(Step.OpenMinimap);
    }


    // --------------------------------------------------
    // HELPERS
    // --------------------------------------------------

    bool IsLookingAt(Transform target)
    {
        Ray ray = new Ray(playerCamera.position, playerCamera.forward);

        if (Physics.Raycast(ray, out RaycastHit hit, 5f))
        {
            return hit.transform == target ||
                hit.transform.IsChildOf(target);
        }

        return false;
    }


    void CompleteTutorial()
    {
        current = Step.Completed;

        GameFlowManager.Instance.SetGameFlow(GameFlowManager.GameFlow.Normal);
    }
}
