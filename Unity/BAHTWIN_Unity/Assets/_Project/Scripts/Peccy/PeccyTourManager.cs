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

    [Header("Stop Accuracy (NavMesh projection)")]
    public float stopSampleRadius = 0.25f;
    public float stopSampleFallbackRadius = 1.25f;
    public float maxYDelta = 1.2f;

    [Header("Floor Raycast (IMPORTANT)")]
    [Tooltip("Turn on. But set floorMask to ONLY your real floor colliders layer.")]
    public bool useFloorRaycast = true;

    [Tooltip("Ray starts from target + up.")]
    public float floorRayUp = 2.0f;

    [Tooltip("Ray goes down this far.")]
    public float floorRayDown = 6.0f;

    [Tooltip("Set this to ONLY your floor layer(s). Do NOT keep ~0 if you have furniture colliders.")]
    public LayerMask floorMask = ~0;

    [Header("Start Tour Placement")]
    [Tooltip("When tour starts, always snap Peccy onto NavMesh near his current position.")]
    public bool snapPeccyToNavMeshOnStart = true;

    [Tooltip("Radius used when snapping Peccy to NavMesh at tour start.")]
    public float startSnapRadius = 3f;

    [Header("Arrival + Snap")]
    public float tourStoppingDistance = 0.05f;
    public float finalSnapDistance = 0.25f;
    public float stopVelocityThreshold = 0.01f;

    private float originalStoppingDistance;
    private bool stopDistSaved = false;

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

    [Header("Debug")]
    public bool debugStops = true;

    [Header("State (read-only)")]
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

        nextAction.performed += ctx => nextPressed = true;
        chatAction.performed += ctx => chatPressed = true;
        doneAction.performed += ctx => donePressed = true;

        nextAction.Enable();
        chatAction.Enable();
        doneAction.Enable();
    }

    void OnDestroy()
    {
        if (nextAction != null) nextAction.Disable();
        if (chatAction != null) chatAction.Disable();
        if (doneAction != null) doneAction.Disable();
    }

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

        if (peccyAgent != null)
        {
            // Snap Peccy onto NavMesh where he currently is (fixes starting tour when he's far away/off-mesh)
            if (snapPeccyToNavMeshOnStart)
                SnapAgentToNavMesh(startSnapRadius);

            if (!speedSaved)
            {
                originalSpeed = peccyAgent.speed;
                originalAngularSpeed = peccyAgent.angularSpeed;
                speedSaved = true;
            }

            if (!stopDistSaved)
            {
                originalStoppingDistance = peccyAgent.stoppingDistance;
                stopDistSaved = true;
            }

            peccyAgent.speed = tourMoveSpeed;
            peccyAgent.angularSpeed = tourAngularSpeed;
            peccyAgent.stoppingDistance = tourStoppingDistance;
            peccyAgent.autoBraking = true;
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

        if (peccyAgent != null)
        {
            if (speedSaved)
            {
                peccyAgent.speed = originalSpeed;
                peccyAgent.angularSpeed = originalAngularSpeed;
            }

            if (stopDistSaved)
                peccyAgent.stoppingDistance = originalStoppingDistance;
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
        yield return ShowTyped(introLine, introOptions);
        yield return WaitNext();

        while (tourRunning && stopIndex < stops.Length)
        {
            TourStop s = stops[stopIndex];
            if (s == null || s.stopPoint == null)
            {
                stopIndex++;
                continue;
            }

            if (s.requiresBadgeTap && s.badgeTapPoint != null)
            {
                yield return MovePeccyToPoint(s.badgeTapPoint, facePlayerAtEnd: false, forceEndRotation: s.badgeTapPoint.rotation);

                yield return ShowTyped("I’ll tap my badge so we can enter this room.", "Next (N)");
                yield return WaitNext();

                if (peccyAnimator != null && !string.IsNullOrEmpty(tapTriggerName))
                    peccyAnimator.SetTrigger(tapTriggerName);

                if (tapAnimSeconds > 0f)
                    yield return new WaitForSeconds(tapAnimSeconds);

                if (afterBadgeDoneHold > 0f)
                    yield return new WaitForSeconds(afterBadgeDoneHold);
            }

            yield return MovePeccyToPoint(s.stopPoint, facePlayerAtEnd: s.facePlayerWhenStopped, forceEndRotation: null);

            if (s.arriveHoldSeconds > 0f)
                yield return new WaitForSeconds(s.arriveHoldSeconds);

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
                    yield return WaitChatOrNext(line, opt);
                else
                    yield return WaitNext();

                lineIndex++;
            }

            stopIndex++;
        }

        if (!tourRunning) yield break;

        yield return ShowTyped(outroLine, outroOptions);

        donePressed = false;
        while (tourRunning && !donePressed)
            yield return null;

        if (tourRunning)
            StopTour();
    }

    // -------------------------
    // Fix: snap agent to navmesh
    // -------------------------
    private void SnapAgentToNavMesh(float radius)
    {
        if (peccyAgent == null) return;

        if (NavMesh.SamplePosition(peccyAgent.transform.position, out var hit, radius, peccyAgent.areaMask))
        {
            // Warp only if noticeably off
            if (Vector3.Distance(peccyAgent.transform.position, hit.position) > 0.02f)
                peccyAgent.Warp(hit.position);
        }
    }

    // -------------------------
    // Destination resolve (key fix for stop 5 & 8)
    // -------------------------
    private bool TryResolveDestination(Transform targetPoint, out Vector3 dest, out Vector3 sampleFrom)
    {
        dest = Vector3.zero;
        sampleFrom = targetPoint.position;

        // STEP 1: optional raycast to floor, BUT if it hits non-floor junk we do NOT want that
        if (useFloorRaycast)
        {
            Vector3 rayStart = targetPoint.position + Vector3.up * floorRayUp;
            float rayLen = floorRayUp + floorRayDown;

            // RaycastAll so we can choose the closest hit that is actually on floorMask
            RaycastHit[] hits = Physics.RaycastAll(rayStart, Vector3.down, rayLen, floorMask, QueryTriggerInteraction.Ignore);
            if (hits != null && hits.Length > 0)
            {
                // Choose nearest
                int best = 0;
                float bestDist = hits[0].distance;
                for (int i = 1; i < hits.Length; i++)
                {
                    if (hits[i].distance < bestDist)
                    {
                        bestDist = hits[i].distance;
                        best = i;
                    }
                }

                sampleFrom = hits[best].point;

                if (debugStops)
                    Debug.Log($"[Tour] Raycast '{targetPoint.name}' hit '{hits[best].collider.name}' at {sampleFrom}");
            }
            else
            {
                // If raycast fails, keep original transform pos
                sampleFrom = targetPoint.position;

                if (debugStops)
                    Debug.Log($"[Tour] Raycast '{targetPoint.name}' found no floor hit. Using transform position {sampleFrom}");
            }
        }

        int mask = (peccyAgent != null) ? peccyAgent.areaMask : NavMesh.AllAreas;

        // STEP 2: strict sample
        if (NavMesh.SamplePosition(sampleFrom, out NavMeshHit hit, stopSampleRadius, mask))
        {
            if (Mathf.Abs(hit.position.y - sampleFrom.y) <= maxYDelta)
            {
                dest = hit.position;
                return true;
            }
        }

        // STEP 3: fallback sample
        if (NavMesh.SamplePosition(sampleFrom, out hit, stopSampleFallbackRadius, mask))
        {
            if (Mathf.Abs(hit.position.y - sampleFrom.y) <= maxYDelta)
            {
                dest = hit.position;
                return true;
            }
        }

        return false;
    }

    private IEnumerator MovePeccyToPoint(Transform targetPoint, bool facePlayerAtEnd, Quaternion? forceEndRotation)
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
            if (NavMesh.SamplePosition(peccyAgent.transform.position, out var hit, 3f, peccyAgent.areaMask))
                peccyAgent.Warp(hit.position);
            else
                yield break;
        }

        if (!TryResolveDestination(targetPoint, out Vector3 dest, out Vector3 sampleFrom))
        {
            Debug.LogWarning(
                $"PeccyTourManager: Could not resolve NavMesh point for '{targetPoint.name}'. " +
                $"From={sampleFrom} TargetPos={targetPoint.position} " +
                $"(r={stopSampleRadius} fb={stopSampleFallbackRadius})."
            );
            yield break;
        }

        if (debugStops)
            Debug.Log($"[Tour] Move '{targetPoint.name}' sampleFrom={sampleFrom} dest={dest}");

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

        float startDist = Vector3.Distance(peccyAgent.transform.position, dest);
        float timeout = Mathf.Clamp(startDist / Mathf.Max(0.1f, peccyAgent.speed) + 6f, 10f, 35f);

        float t = 0f;
        while (tourRunning)
        {
            SetWalking(peccyAgent.velocity.sqrMagnitude > movingSpeedThreshold);

            bool arrived =
                !peccyAgent.pathPending &&
                peccyAgent.remainingDistance != Mathf.Infinity &&
                peccyAgent.remainingDistance <= (peccyAgent.stoppingDistance + 0.08f) &&
                peccyAgent.velocity.sqrMagnitude <= stopVelocityThreshold;

            if (arrived) break;

            t += Time.deltaTime;
            if (t >= timeout) break;

            yield return null;
        }

        if (peccyAgent.isOnNavMesh)
        {
            peccyAgent.isStopped = true;
            peccyAgent.ResetPath();

            float endDist = Vector3.Distance(peccyAgent.transform.position, dest);
            if (endDist <= finalSnapDistance)
                peccyAgent.Warp(dest);
        }

        SetWalking(false);

        if (forceEndRotation.HasValue)
            peccyAgent.transform.rotation = forceEndRotation.Value;

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

                    while (tourRunning && peccyDialogue.chatUI.IsOpen)
                        yield return null;

                    chatPressed = false;
                    nextPressed = false;

                    yield return ShowTyped(currentLine, currentOptions);
                    continue;
                }

                chatPressed = false;
            }

            yield return null;
        }
    }
}
