using System.Collections;
using Unity.Cinemachine;
using UnityEngine;

public class CinematicTour : MonoBehaviour
{
    [Header("Cinemachine Cameras (Shots)")]
    public CinemachineCamera Cam_Entrance;
    public CinemachineCamera Cam_Inside;
    public CinemachineCamera Cam_Lift;
    public CinemachineCamera Cam_Infront_Of_Lift;

    public CinemachineCamera Cam_Left_side;
    public CinemachineCamera Cam_Right_Side;

    public CinemachineCamera Cam_Left_Side_Next;
    public CinemachineCamera Cam_Right_Side_Next;

    [Header("UI Panels")]
    public GameObject receptionpanel;
    public GameObject arrowsPanel;

    [Header("Timings (seconds)")]
    public float toInsideDelay = 2f;
    public float insideLookTime = 2f;
    public float receptionReadTime = 6f;
    public float afterChoiceDelay = 0.5f;
    public float sideNextHoldTime = 1.2f; 

    private bool waitingForChoice = false;
    private bool choiceMade = false;
    private bool choseLeft = false;

    void Start()
    {
        Cam_Entrance.Priority = 0;
        Cam_Inside.Priority = 0;
        Cam_Lift.Priority = 0;
        Cam_Infront_Of_Lift.Priority = 0;

        Cam_Left_side.Priority = 0;
        Cam_Right_Side.Priority = 0;

        Cam_Left_Side_Next.Priority = 0;
        Cam_Right_Side_Next.Priority = 0;

        Cam_Entrance.Priority = 30;

        if (receptionpanel != null) receptionpanel.SetActive(false);
        if (arrowsPanel != null) arrowsPanel.SetActive(false);

        StartCoroutine(PlayTour());
    }

    void Update()
    {
        if (!waitingForChoice || choiceMade) return;

        if (Input.GetKeyDown(KeyCode.L))
        {
            Cam_Left_side.Priority = 50;
            Cam_Right_Side.Priority = 0;
            choseLeft = true;
            choiceMade = true;
        }
        else if (Input.GetKeyDown(KeyCode.R))
        {
            Cam_Right_Side.Priority = 50;
            Cam_Left_side.Priority = 0;
            choseLeft = false;
            choiceMade = true;
        }
    }

    IEnumerator PlayTour()
    {
        // entrance -> inside
        yield return new WaitForSeconds(toInsideDelay);
        Cam_Inside.Priority = 40;

        // let user see inside first
        yield return new WaitForSeconds(insideLookTime);

        // reception instructions
        if (receptionpanel != null) receptionpanel.SetActive(true);
        yield return new WaitForSeconds(receptionReadTime);
        if (receptionpanel != null) receptionpanel.SetActive(false);

        // choice instructions: Press L / R
        waitingForChoice = true;
        choiceMade = false;

        if (arrowsPanel != null) arrowsPanel.SetActive(true);

        // wait until Update() detects L or R
        yield return new WaitUntil(() => choiceMade);

        if (arrowsPanel != null) arrowsPanel.SetActive(false);
        waitingForChoice = false;

        // tiny pause after choice
        yield return new WaitForSeconds(afterChoiceDelay);

        // go to the next cam depending on choice
        if (choseLeft)
        {
            Cam_Left_Side_Next.Priority = 55;
            Cam_Right_Side_Next.Priority = 0;
        }
        else
        {
            Cam_Right_Side_Next.Priority = 55;
            Cam_Left_Side_Next.Priority = 0;
        }

        yield return new WaitForSeconds(sideNextHoldTime);

        // continue to lift
        Cam_Lift.Priority = 60;

        yield return new WaitForSeconds(2f);
        Cam_Infront_Of_Lift.Priority = 70;
    }
}
