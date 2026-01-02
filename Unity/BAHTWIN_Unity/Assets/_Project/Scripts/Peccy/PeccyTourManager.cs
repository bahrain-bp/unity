using System.Collections;
using UnityEngine;
using UnityEngine.AI;
using UnityEngine.InputSystem;
using TMPro;

[System.Serializable]
public class TourStop
{
    public string stopName;
    public Transform stopPoint;

    [Header("Lines for this stop (keep them short)")]
    [TextArea] public string[] lines;

    [Header("Options shown per line (same size as lines, or leave empty for default)")]
    public string[] options;

    [Header("Stop behavior")]
    public bool facePlayerWhenStopped = true;
    public float arriveHoldSeconds = 0.2f;

    [Header("Chat checkpoint (shows Chat (C) | Next (N) on last line)")]
    public bool chatCheckpoint = false;

    [Header("Badge door before entering this stop")]
    public bool requiresBadgeTap = false;
    public Transform badgeTapPoint;
}

public class PeccyTourManager : MonoBehaviour
{
    [Header("Core Refs")]
    public PeccyDialogue peccyDialogue;
    public SpeechBubbleUI bubble;
    public TMP_Text bubbleTMP;
    public Transform player;
    public NavMeshAgent peccyAgent;
    public Animator peccyAnimator;
    public PeccyFollower follower;

    [Header("Animation")]
    public string isWalkingParam = "isWalking";
    public float movingSpeedThreshold = 0.02f;
    private int isWalkingHash;

    [Header("Tour Speed")]
    public float tourMoveSpeed = 2.0f;
    public float tourAngularSpeed = 240f;
    private float originalSpeed;
    private float originalAngularSpeed;
    private bool speedSaved = false;

    [Header("UI Sync (optional)")]
    public ModeButtonsUI modeButtonsUI;

    [Header("Tour Route Line")]
    public TourGuideLineController tourLine;
    public bool showLineDuringTour = true;

    [Header("Tour Stops")]
    public TourStop[] stops;

    [Header("Typewriter")]
    public bool useTypewriter = true;
    public float charsPerSecond = 45f;

    [Header("Badge Tap")]
    public string tapTriggerName = "TapBadge";
    public float tapAnimSeconds = 2f;
    public float afterBadgeDoneHold = 10f;

    [Header("Tour Intro/Outro")]
    [TextArea] public string introLine = "Great choice! Let’s begin our guided tour of the AWS Bahrain office.";
    public string introOptions = "Next (N)";
    [TextArea] public string outroLine = "That brings us to the end of our tour. Thank you for joining me today.";
    public string outroOptions = "Done (D)";

    public bool tourRunning = false;

    private InputAction nextAction;
    private InputAction chatAction;
    private InputAction doneAction;

    private bool nextPressed;
    private bool chatPressed;
    private bool donePressed;

    private int stopIndex = 0;
    private int lineIndex = 0;

    void Awake()
    {
        isWalkingHash = Animator.StringToHash(isWalkingParam);

        nextAction = new InputAction(type: InputActionType.Button, binding: "<Keyboard>/n");
        chatAction = new InputAction(type: InputActionType.Button, binding: "<Keyboard>/c");
        doneAction = new InputAction(type: InputActionType.Button, binding: "<Keyboard>/d");

        nextAction.performed += OnNextPerformed;
        chatAction.performed += OnChatPerformed;
        doneAction.performed += OnDonePerformed;

        nextAction.Enable();
        chatAction.Enable();
        doneAction.Enable();
    }

    void OnDestroy()
    {
        if (nextAction != null) nextAction.performed -= OnNextPerformed;
        if (chatAction != null) chatAction.performed -= OnChatPerformed;
        if (doneAction != null) doneAction.performed -= OnDonePerformed;

        if (nextAction != null) nextAction.Disable();
        if (chatAction != null) chatAction.Disable();
        if (doneAction != null) doneAction.Disable();
    }

    private void OnNextPerformed(InputAction.CallbackContext ctx) => nextPressed = true;
    private void OnChatPerformed(InputAction.CallbackContext ctx) => chatPressed = true;
    private void OnDonePerformed(InputAction.CallbackContext ctx) => donePressed = true;

    private void SetWalking(bool walking)
    {
        if (peccyAnimator != null)
            peccyAnimator.SetBool(isWalkingHash, walking);
    }

    public void StartTourFromDialogueYes()
    {
        if (!tourRunning)
            StartTour();
    }

    public void ToggleTour()
    {
        if (tourRunning) StopTour();
        else StartTour();
    }

    public void StartTour()
    {
        if (tourRunning) return;
        if (stops == null || stops.Length == 0) return;

        // Reset input flags
        nextPressed = chatPressed = donePressed = false;

        tourRunning = true;
        if (modeButtonsUI != null) modeButtonsUI.SetTourActiveVisual(true);

        // Save + apply tour speed
        if (peccyAgent != null)
        {
            if (!speedSaved)
            {
                originalSpeed = peccyAgent.speed;
                originalAngularSpeed = peccyAgent.angularSpeed;
                speedSaved = true;
            }
            peccyAgent.speed = tourMoveSpeed;
            peccyAgent.angularSpeed = tourAngularSpeed;
        }

        // Lock dialogue so it doesn't fight over bubble + N key
        if (peccyDialogue != null) peccyDialogue.SetTourLock(true);

        stopIndex = 0;
        lineIndex = 0;

        // tell dialogue we’re in tour mode so it stops assistant prompt
        if (peccyDialogue != null)
        {
            peccyDialogue.tourMode = true;
            peccyDialogue.assistantMode = false;
        }

        // disable follower while touring
        if (follower != null) follower.SetFollow(false);

        // show tour line
        if (tourLine != null)
        {
            if (showLineDuringTour)
                tourLine.SetTarget(peccyAgent != null ? peccyAgent.transform : null);
            else
                tourLine.ClearRoute();
        }

        StopAllCoroutines();
        StartCoroutine(TourRoutine());
    }

    public void StopTour()
    {
        if (!tourRunning) return;

        tourRunning = false;
        if (modeButtonsUI != null) modeButtonsUI.SetTourActiveVisual(false);

        StopAllCoroutines();

        // stop walk anim
        SetWalking(false);

        // hide bubble
        if (bubble != null) bubble.Hide();

        // hide tour line
        if (tourLine != null) tourLine.ClearRoute();

        // restore follower
        if (follower != null) follower.SetFollow(true);

        // restore agent speed
        if (peccyAgent != null && speedSaved)
        {
            peccyAgent.speed = originalSpeed;
            peccyAgent.angularSpeed = originalAngularSpeed;
        }

        // unlock dialogue and restore assistant
        if (peccyDialogue != null)
        {
            peccyDialogue.SetTourLock(false);
            peccyDialogue.tourMode = false;
            peccyDialogue.assistantMode = true;
            peccyDialogue.ForceAssistantIdle();
        }
    }

    private IEnumerator TourRoutine()
    {
        // Intro
        yield return ShowTyped(introLine, introOptions);
        yield return WaitNext();

        // Stops
        while (tourRunning && stopIndex < stops.Length)
        {
            TourStop s = stops[stopIndex];
            if (s == null || s.stopPoint == null)
            {
                stopIndex++;
                continue;
            }

            // Badge tap before entering this stop (WALK to tap point, no teleport)
            if (s.requiresBadgeTap && s.badgeTapPoint != null)
            {
                // Walk to badge reader first
                yield return MovePeccyToStop(s.badgeTapPoint);

                // Now show the badge prompt at the reader
                yield return ShowTyped("I’ll tap my badge so we can enter this room.", "Next (N)");
                yield return WaitNext();

                // Play tap animation
                if (peccyAnimator != null && !string.IsNullOrEmpty(tapTriggerName))
                    peccyAnimator.SetTrigger(tapTriggerName);

                if (tapAnimSeconds > 0f)
                    yield return new WaitForSeconds(tapAnimSeconds);

                // Small pause so animation doesn't snap into walk immediately
                yield return new WaitForSeconds(0.1f);
            }

            // Move Peccy to stop
            yield return MovePeccyToStop(s.stopPoint);

            // Speak lines
            lineIndex = 0;
            while (tourRunning && s.lines != null && lineIndex < s.lines.Length)
            {
                string line = s.lines[lineIndex];
                string opt = "Next (N)";

                if (s.options != null && lineIndex < s.options.Length && !string.IsNullOrEmpty(s.options[lineIndex]))
                    opt = s.options[lineIndex];

                bool lastLine = (lineIndex == s.lines.Length - 1);
                if (s.chatCheckpoint && lastLine)
                    opt = "Chat (C) | Next (N)";

                yield return ShowTyped(line, opt);

                if (s.chatCheckpoint && lastLine)
                    yield return WaitChatOrNext();
                else
                    yield return WaitNext();

                lineIndex++;
            }

            stopIndex++;
        }

        if (!tourRunning) yield break;

        // Outro
        yield return ShowTyped(outroLine, outroOptions);

        // Wait for Done (D)
        donePressed = false;
        while (tourRunning && !donePressed)
            yield return null;

        if (tourRunning)
            StopTour();
    }

    private IEnumerator MovePeccyToStop(Transform stopPoint)
    {
        if (bubble != null) bubble.Hide();

        if (stopPoint == null) yield break;

        if (peccyAgent == null)
        {
            transform.position = stopPoint.position;
            transform.rotation = stopPoint.rotation;
            FacePlayer();
            yield break;
        }

        // Ensure agent is on navmesh (or bail safely)
        if (!peccyAgent.isOnNavMesh)
        {
            if (NavMesh.SamplePosition(peccyAgent.transform.position, out var hit, 2f, NavMesh.AllAreas))
                peccyAgent.Warp(hit.position);
            else
                yield break;
        }

        // Snap destination to navmesh
        Vector3 dest = stopPoint.position;
        if (NavMesh.SamplePosition(stopPoint.position, out var destHit, 2f, NavMesh.AllAreas))
            dest = destHit.position;

        // IMPORTANT: ResetPath before new destination to avoid leftover path weirdness
        peccyAgent.ResetPath();

        peccyAgent.isStopped = false;
        SetWalking(true);

        bool ok = peccyAgent.SetDestination(dest);
        if (!ok)
        {
            // If destination can't be set, do NOT keep trying forever
            peccyAgent.isStopped = true;
            SetWalking(false);
            yield break;
        }

        while (tourRunning && peccyAgent.pathPending)
            yield return null;

        if (!tourRunning) yield break;

        if (peccyAgent.pathStatus != NavMeshPathStatus.PathComplete)
        {
            // Don't teleport; just stop and continue (prevents surprise warps)
            peccyAgent.isStopped = true;
            SetWalking(false);
            yield break;
        }

        float timeout = 12f;
        float t = 0f;

        while (tourRunning)
        {
            // Update walking from velocity
            SetWalking(peccyAgent.velocity.sqrMagnitude > movingSpeedThreshold);

            float dist = Vector3.Distance(peccyAgent.transform.position, dest);

            bool closeEnough =
                (!float.IsInfinity(peccyAgent.remainingDistance) &&
                 peccyAgent.remainingDistance <= peccyAgent.stoppingDistance + 0.2f)
                || dist <= peccyAgent.stoppingDistance + 0.25f;

            if (closeEnough) break;

            t += Time.deltaTime;
            if (t >= timeout) break;

            yield return null;
        }

        if (peccyAgent.isOnNavMesh)
        {
            peccyAgent.isStopped = true;
            peccyAgent.ResetPath();
            if (bubble != null) bubble.Hide(); // keep hidden until you call ShowTyped()

        }

        SetWalking(false);

        if (stopPoint != null)
        {
            // optional tiny hold at stop
            yield return null;
        }

        FacePlayer();
    }

    private void FacePlayer()
    {
        if (player == null) return;

        Transform t = (peccyAgent != null) ? peccyAgent.transform : transform;
        Vector3 dir = player.position - t.position;
        dir.y = 0f;
        if (dir.sqrMagnitude < 0.01f) return;

        t.rotation = Quaternion.LookRotation(dir.normalized);
    }

    private IEnumerator ShowTyped(string line, string options)
    {
        // If chat is open, wait until it closes before showing tour bubble
        if (peccyDialogue != null && peccyDialogue.chatUI != null)
        {
            while (tourRunning && peccyDialogue.chatUI.IsOpen)
                yield return null;
        }

        if (bubble == null) yield break;

        bubble.Show("", options);

        if (!useTypewriter || bubbleTMP == null || charsPerSecond <= 0f)
        {
            bubble.Show(line, options);
            yield break;
        }

        bubbleTMP.text = "";
        float spc = 1f / charsPerSecond;

        for (int i = 0; i <= line.Length; i++)
        {
            bubbleTMP.text = line.Substring(0, i);
            yield return new WaitForSeconds(spc);
        }
    }

    private IEnumerator WaitNext()
    {
        nextPressed = false;
        while (tourRunning && !nextPressed)
            yield return null;
    }

    private IEnumerator WaitChatOrNext()
    {
        nextPressed = false;
        chatPressed = false;

        while (tourRunning)
        {
            if (nextPressed) yield break;

            if (chatPressed)
            {
                // Open chat
                if (peccyDialogue != null && peccyDialogue.chatUI != null)
                {
                    peccyDialogue.chatUI.Open();

                    // Hide bubble while chat is open
                    if (bubble != null) bubble.Hide();

                    // PAUSE tour here until chat is closed
                    while (tourRunning && peccyDialogue.chatUI.IsOpen)
                        yield return null;

                    // After chat closes, show the same line again (so user can press Next)
                    chatPressed = false;
                    nextPressed = false;

                    // IMPORTANT: do NOT "yield break" here, we want to keep waiting for Next
                    continue;
                }

                // If no chatUI, just ignore
                chatPressed = false;
            }

            yield return null;
        }
    }

}
