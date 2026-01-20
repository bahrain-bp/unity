using UnityEngine;
using UnityEngine.InputSystem;
using TMPro;
using UnityEngine.UI;
using System.Collections;

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
        ShowRoute,
        WalkToRegistration,
        Completed
    }

    [Header("UI")]
    public GameObject welcomePanel;
    public Image controlsImage;
    public TMP_Text instructionText;
    public GameObject selectRoomUI;   
    public GameObject showRouteUI;   
    

    [Header("Dynamic Minimap Content")]
    public Button showRouteButton; 

    [Header("References")]
    public Transform playerCamera;
    public Transform floorListTarget;
    public GameObject elevatorButton;         

    [Header("Developer Control")]
    public Step endTutorialAt = Step.Completed;

    private Step current = Step.Welcome;
    private Coroutine bindRoomCoroutine;

    private void Start()
    {
        welcomePanel.SetActive(true);
        controlsImage.gameObject.SetActive(false);

        instructionText.text = "Press ENTER to continue";

        if (floorListTarget) floorListTarget.GetComponent<Outline>().enabled = false;

        if (selectRoomUI) selectRoomUI.SetActive(false);
        if (showRouteUI) showRouteUI.SetActive(false);

        if (showRouteButton)
        {
            showRouteButton.onClick.RemoveListener(OnShowRouteClicked);
            showRouteButton.onClick.AddListener(OnShowRouteClicked);
        }

        if (elevatorButton) elevatorButton.SetActive(false);
    }

    private void Update()
    {
        switch (current)
        {
            case Step.Welcome:
                if (Keyboard.current.enterKey.wasPressedThisFrame)
                    Advance(Step.FindFloorList);
                break;

            case Step.FindFloorList:
                DetectLookAtFloorList();
                break;

            case Step.OpenMinimap:
                if (Keyboard.current.mKey.wasPressedThisFrame)
                    Advance(Step.SelectRegistration);
                break;
        }
    }

    // called by Elevator script when correct floor pressed
    public void OnCorrectFloorPressed()
    {
        if (current != Step.PressCorrectFloor) return;
        Advance(Step.ExitElevator);
    }

    public void OnElevatorExitReached()
    {
        if (current != Step.ExitElevator) return;
        Advance(Step.OpenMinimap);
    }

    public void OnOpenMinimap(InputAction.CallbackContext ctx)
    {
        if (!ctx.performed) return;
        if (current != Step.OpenMinimap) return;

        Advance(Step.SelectRegistration);
    }

    private void DetectLookAtFloorList()
    {
        Vector3 dir = (floorListTarget.position - playerCamera.position).normalized;
        if (Vector3.Dot(playerCamera.forward, dir) > 0.97f)
            Advance(Step.PressCorrectFloor);
    }

    private void Advance(Step next)
    {
        current = next;

        if (current == endTutorialAt)
        {
            CompleteTutorial();
            return;
        }

        if (selectRoomUI) selectRoomUI.SetActive(false);
        if (showRouteUI) showRouteUI.SetActive(false);

        switch (current)
        {
            case Step.FindFloorList:
                welcomePanel.SetActive(false);
                controlsImage.gameObject.SetActive(true);
                instructionText.text = "Find the floor list inside the elevator.";
                floorListTarget.GetComponent<Outline>().enabled = true;
                if (elevatorButton) elevatorButton.SetActive(false);
                break;

            case Step.PressCorrectFloor:
                instructionText.text = "Press the correct floor (AWS – Floor 2).";
                floorListTarget.GetComponent<Outline>().enabled = false;
                if (elevatorButton) elevatorButton.SetActive(true);
                elevatorButton.GetComponent<Outline>().enabled = true;
                break;

            case Step.ExitElevator:
                instructionText.text = "Exit the elevator.";
                if (elevatorButton)
                {
                    var o = elevatorButton.GetComponent<Outline>();
                    if (o) o.enabled = false;
                    elevatorButton.SetActive(false);
                }
                break;

            case Step.OpenMinimap:
                instructionText.text = "Press M to open the minimap.";
                break;

            case Step.SelectRegistration:
                instructionText.text = ""; // no instruction text for this step
                if (selectRoomUI) selectRoomUI.SetActive(true);
                break;

            case Step.ShowRoute:
                instructionText.text = ""; // no instruction text for this step
                if (selectRoomUI) selectRoomUI.SetActive(false);
                if (showRouteUI) showRouteUI.SetActive(true);
                break;

            case Step.WalkToRegistration:
                if (showRouteUI) showRouteUI.SetActive(false);
                instructionText.text = "Follow navigation to the Registration desk.";
                break;
        }
    }


    public void OnReceptionSelected()
    {
       if (current != Step.SelectRegistration) return;
       Advance(Step.ShowRoute);
    }


    private void OnShowRouteClicked()
    {
        if (current != Step.ShowRoute) return;
        Advance(Step.WalkToRegistration);
    }

    public void OnRegistrationReached()
    {
        if (current == Step.WalkToRegistration)
            CompleteTutorial();
    }

    public void CompleteTutorial()
    {
        current = Step.Completed;

        welcomePanel.SetActive(false);
        controlsImage.gameObject.SetActive(false);
        if (selectRoomUI) selectRoomUI.SetActive(false);
        if (showRouteUI) showRouteUI.SetActive(false);

        GameFlowManager.Instance.SetGameFlow(GameFlowManager.GameFlow.Normal);
    }
}
