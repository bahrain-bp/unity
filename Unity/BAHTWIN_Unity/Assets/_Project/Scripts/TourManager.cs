using System.Collections;
using Unity.Cinemachine;
using UnityEngine;

public class CinematicTour : MonoBehaviour
{
    [Header("Cinemachine Cameras")]
    public CinemachineCamera Cam_Entrance;
    public CinemachineCamera Cam_Door;
    public CinemachineCamera Cam_ThroughDoor_Start;
    public CinemachineCamera Cam_ThroughDoor;
    public CinemachineCamera Cam_Inside;

    public CinemachineCamera Cam_Left_side;
    public CinemachineCamera Cam_Right_Side;
    public CinemachineCamera Cam_Left_Side_Next;
    public CinemachineCamera Cam_Right_Side_Next;

    public CinemachineCamera Cam_Lift;
    public CinemachineCamera Cam_Infront_Of_Lift;

    [Header("Door")]
    [SerializeField] private DoorRotationControlled revolvingDoor;

    [Header("UI Panels")]
    public GameObject receptionpanel;
    public GameObject arrowsPanel;
    public GameObject doorHintPanel; // "Press O to open"

    [Header("Timings")]
    public float toDoorDelay = 1.5f;
    public float insideLookTime = 2f;
    public float receptionReadTime = 6f;
    public float afterChoiceDelay = 0.5f;
    public float sideNextHoldTime = 1.2f;

    [Header("Door Camera Switch Fractions (0..1)")]
    [Range(0f, 1f)] public float startCamAt = 0.15f;   // Door -> ThroughDoor_Start
    [Range(0f, 1f)] public float throughCamAt = 0.30f; // ThroughDoor_Start -> ThroughDoor
    [Range(0f, 1f)] public float insideCamAt = 0.50f;  // ThroughDoor -> Inside

    [Header("Scene Transition")]
    [SerializeField] private SceneLoader2 sceneLoader;

    private bool waitingForDoor = false;
    private bool doorOpened = false;

    private bool waitingForChoice = false;
    private bool choiceMade = false;
    private bool choseLeft = false;

    void Start()
    {
        SetAllCamPriorities(0);

        if (Cam_Entrance) Cam_Entrance.Priority = 30;

        if (receptionpanel) receptionpanel.SetActive(false);
        if (arrowsPanel) arrowsPanel.SetActive(false);
        if (doorHintPanel) doorHintPanel.SetActive(false);

        StartCoroutine(PlayTour());
    }

    void Update()
    {
        // Door input
        if (waitingForDoor && !doorOpened)
        {
            if (Input.GetKeyDown(KeyCode.O))
                doorOpened = true;
        }

        // Direction input (L/R)
        if (!waitingForChoice || choiceMade) return;

        if (Input.GetKeyDown(KeyCode.L))
        {
            choseLeft = true;
            choiceMade = true;

            if (Cam_Left_side) Cam_Left_side.Priority = 80;
            if (Cam_Right_Side) Cam_Right_Side.Priority = 0;
        }
        else if (Input.GetKeyDown(KeyCode.R))
        {
            choseLeft = false;
            choiceMade = true;

            if (Cam_Right_Side) Cam_Right_Side.Priority = 80;
            if (Cam_Left_side) Cam_Left_side.Priority = 0;
        }
    }

    IEnumerator PlayTour()
    {
        // 1) Entrance → Door
        yield return new WaitForSeconds(toDoorDelay);

        if (Cam_Entrance) Cam_Entrance.Priority = 0;
        if (Cam_Door) Cam_Door.Priority = 40;

        // 2) Ask user to press O
        waitingForDoor = true;
        doorOpened = false;

        if (doorHintPanel) doorHintPanel.SetActive(true);
        yield return new WaitUntil(() => doorOpened);

        if (doorHintPanel) doorHintPanel.SetActive(false);
        waitingForDoor = false;

        // 3) Start opening door
        float doorDuration = 1.0f;
        if (revolvingDoor != null)
        {
            revolvingDoor.OpenDoor();
            doorDuration = Mathf.Max(
                revolvingDoor.openAngle / Mathf.Max(revolvingDoor.speed, 0.01f),
                0.1f
            );
        }

        // 4) Camera switches while door rotates (NO HOLD at ThroughDoor)
        yield return new WaitForSeconds(doorDuration * startCamAt);
        if (Cam_Door) Cam_Door.Priority = 0;
        if (Cam_ThroughDoor_Start) Cam_ThroughDoor_Start.Priority = 55;

        yield return new WaitForSeconds(doorDuration * (throughCamAt - startCamAt));
        if (Cam_ThroughDoor_Start) Cam_ThroughDoor_Start.Priority = 0;
        if (Cam_ThroughDoor) Cam_ThroughDoor.Priority = 60;

        yield return new WaitForSeconds(doorDuration * (insideCamAt - throughCamAt));
        if (Cam_ThroughDoor) Cam_ThroughDoor.Priority = 0;
        if (Cam_Inside) Cam_Inside.Priority = 70;

        // 5) Reception instructions
        yield return new WaitForSeconds(insideLookTime);

        if (receptionpanel) receptionpanel.SetActive(true);
        yield return new WaitForSeconds(receptionReadTime);
        if (receptionpanel) receptionpanel.SetActive(false);

        // 6) Direction choice
        waitingForChoice = true;
        choiceMade = false;

        if (arrowsPanel) arrowsPanel.SetActive(true);
        yield return new WaitUntil(() => choiceMade);

        if (arrowsPanel) arrowsPanel.SetActive(false);
        waitingForChoice = false;

        yield return new WaitForSeconds(afterChoiceDelay);

        if (choseLeft)
        {
            if (Cam_Left_Side_Next) Cam_Left_Side_Next.Priority = 90;
        }
        else
        {
            if (Cam_Right_Side_Next) Cam_Right_Side_Next.Priority = 90;
        }

        yield return new WaitForSeconds(sideNextHoldTime);

        // 7) Lift sequence
        if (Cam_Lift) Cam_Lift.Priority = 100;

        yield return new WaitForSeconds(2f);
        if (Cam_Infront_Of_Lift) Cam_Infront_Of_Lift.Priority = 110;

        yield return new WaitForSeconds(2f);

        // 8) Load next scene (disable SceneLoader2 if needed)
        if (sceneLoader != null)
            sceneLoader.LoadNextScene();
    }

    private void SetAllCamPriorities(int p)
    {
        if (Cam_Entrance) Cam_Entrance.Priority = p;
        if (Cam_Door) Cam_Door.Priority = p;
        if (Cam_ThroughDoor_Start) Cam_ThroughDoor_Start.Priority = p;
        if (Cam_ThroughDoor) Cam_ThroughDoor.Priority = p;
        if (Cam_Inside) Cam_Inside.Priority = p;

        if (Cam_Left_side) Cam_Left_side.Priority = p;
        if (Cam_Right_Side) Cam_Right_Side.Priority = p;
        if (Cam_Left_Side_Next) Cam_Left_Side_Next.Priority = p;
        if (Cam_Right_Side_Next) Cam_Right_Side_Next.Priority = p;

        if (Cam_Lift) Cam_Lift.Priority = p;
        if (Cam_Infront_Of_Lift) Cam_Infront_Of_Lift.Priority = p;
    }
}
