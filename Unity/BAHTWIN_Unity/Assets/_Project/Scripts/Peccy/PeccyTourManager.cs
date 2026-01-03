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
    public float afterBadgeDoneHold = 0.1f;

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

        if (peccyDialogue != null) peccyDialogue.SetTourLock(true);

        stopIndex = 0;
        lineIndex = 0;

        if (peccyDialogue != null)
        {
            peccyDialogue.tourMode = true;
            peccyDialogue.assistantMode = false;
        }

        if (follower != null) follower.SetFollow(false);

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

        SetWalking(false);

        if (bubble != null) bubble.Hide();
        if (tourLine != null) tourLine.ClearRoute();

        if (follower != null) follower.SetFollow(true);

        if (peccyAgent != null && speedSaved)
        {
            peccyAgent.speed = originalSpeed;
            peccyAgent.angularSpeed = originalAngularSpeed;
        }

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

            // Badge tap before entering this stop
            if (s.requiresBadgeTap && s.badgeTapPoint != null)
            {
                // Walk to badge reader
                yield return MovePeccyToStop(
                    s.badgeTapPoint,
                    facePlayerAtEnd: false,
                    forceEndRotation: s.badgeTapPoint.rotation
                );

                // Show prompt only when standing at the reader
                yield return ShowTyped("I’ll tap my badge so we can enter this room.", "Next (N)");
                yield return WaitNext();

                // Play tap animation
                if (peccyAnimator != null && !string.IsNullOrEmpty(tapTriggerName))
                    peccyAnimator.SetTrigger(tapTriggerName);

                if (tapAnimSeconds > 0f)
                    yield return new WaitForSeconds(tapAnimSeconds);

                if (afterBadgeDoneHold > 0f)
                    yield return new WaitForSeconds(afterBadgeDoneHold);
            }

            // Move to stop, then face player (you ticked it for all stops)
            yield return MovePeccyToStop(
                s.stopPoint,
                facePlayerAtEnd: s.facePlayerWhenStopped,
                forceEndRotation: null
            );

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
                    yield return WaitChatOrNext(line, opt); // IMPORTANT: pass current line+options
                else
                    yield return WaitNext();

                lineIndex++;
            }

            stopIndex++;
        }

        if (!tourRunning) yield break;

        // Outro
        yield return ShowTyped(outroLine, outroOptions);

        donePressed = false;
        while (tourRunning && !donePressed)
            yield return null;

        if (tourRunning)
            StopTour();
    }

    private IEnumerator MovePeccyToStop(Transform targetPoint, bool facePlayerAtEnd, Quaternion? forceEndRotation)
    {
        if (bubble != null) bubble.Hide();
        if (targetPoint == null) yield break;

        if (peccyAgent == null)
        {
            transform.position = targetPoint.position;
            transform.rotation = forceEndRotation ?? targetPoint.rotation;
            if (facePlayerAtEnd) FacePlayer();
            yield break;
        }

        // Ensure agent is on navmesh
        if (!peccyAgent.isOnNavMesh)
        {
            if (NavMesh.SamplePosition(peccyAgent.transform.position, out var hit, 2f, NavMesh.AllAreas))
                peccyAgent.Warp(hit.position);
            else
                yield break;
        }

        // Snap destination to navmesh
        Vector3 dest = targetPoint.position;
        if (NavMesh.SamplePosition(targetPoint.position, out var destHit, 2f, NavMesh.AllAreas))
            dest = destHit.position;

        peccyAgent.ResetPath();
        peccyAgent.isStopped = false;
        SetWalking(true);

        bool ok = peccyAgent.SetDestination(dest);
        if (!ok)
        {
            peccyAgent.isStopped = true;
            SetWalking(false);
            yield break;
        }

        while (tourRunning && peccyAgent.pathPending)
            yield return null;

        if (!tourRunning) yield break;

        if (peccyAgent.pathStatus != NavMeshPathStatus.PathComplete)
        {
            peccyAgent.isStopped = true;
            SetWalking(false);
            yield break;
        }

        float timeout = 12f;
        float t = 0f;

        while (tourRunning)
        {
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
        }

        SetWalking(false);

        // Apply end rotation rules
        if (forceEndRotation.HasValue && peccyAgent != null)
        {
            peccyAgent.transform.rotation = forceEndRotation.Value;
        }

        // Optional tiny settle frame
        yield return null;

        if (facePlayerAtEnd)
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

    private IEnumerator WaitChatOrNext(string currentLine, string currentOptions)
    {
        nextPressed = false;
        chatPressed = false;

        while (tourRunning)
        {
            if (nextPressed) yield break;

            if (chatPressed)
            {
                if (peccyDialogue != null && peccyDialogue.chatUI != null)
                {
                    peccyDialogue.chatUI.Open();

                    if (bubble != null) bubble.Hide();

                    // Pause tour until chat closes
                    while (tourRunning && peccyDialogue.chatUI.IsOpen)
                        yield return null;

                    // After closing chat: re-show the SAME checkpoint bubble again
                    chatPressed = false;
                    nextPressed = false;

                    yield return ShowTyped(currentLine, currentOptions);

                    // Continue waiting for Next or Chat again
                    continue;
                }

                chatPressed = false;
            }

            yield return null;
        }
    }
}
