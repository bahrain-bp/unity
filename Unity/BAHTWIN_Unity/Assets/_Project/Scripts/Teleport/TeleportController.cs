using System.Collections;
using TMPro;
using UnityEngine;
using UnityEngine.AI;

public class TeleportController : MonoBehaviour
{
    [Header("Player Refs")]
    public Transform playerRoot;                 // the object you want to teleport (usually the CC holder)
    public CharacterController characterController;

    [Header("Peccy Refs")]
    public Transform peccyRoot;                  // drag Peccy main transform here
    public NavMeshAgent peccyAgent;              // drag Peccy's NavMeshAgent here (if he has one)
    public Vector3 peccyOffset = new Vector3(0.6f, 0f, -0.6f); // beside/behind player
    public float peccySampleRadius = 3f;         // NavMesh snap radius for Peccy
    public bool resetPeccyPathAfterTeleport = true;

    [Header("Registration Gate")]
    public bool requirePassedRegistration = true;

    [Header("Blocked Message UI (reuse PlayerInteractor prompt)")]
    public GameObject promptRoot;                // e.g. InteractionCanvas
    public TMP_Text promptText;                  // e.g. InteractionText
    [TextArea] public string mustRegisterMessage = "You must pass registration to use teleportation.";
    public float showSeconds = 2f;
    public float cooldownSeconds = 1f;

    [Header("Fade (optional but recommended)")]
    public CanvasGroup fadeCanvasGroup;          // full screen overlay (CanvasGroup)
    public float fadeOutTime = 0.2f;
    public float fadeInTime = 0.25f;
    public float holdBlackTime = 0.05f;

    [Header("NavMesh Safety")]
    public float sampleRadius = 3f;              // how far to search for a walkable point
    public float yOffset = 0.05f;                // tiny lift to avoid clipping

    float nextAllowedPopupTime = 0f;
    Coroutine popupRoutine;

    public bool TeleportToRoom(RoomSO room)
    {
        if (room == null || playerRoot == null) return false;
        if (NavigationManager.Instance == null) return false;

        // --- Gate by registration status ---
        if (requirePassedRegistration && !IsRegistrationPassed())
        {
            ShowBlockedMessage();
            return false;
        }

        string key = BuildRoomKey(room);

        if (!NavigationManager.Instance.TryGetRoomPosition(key, out Vector3 roomPos))
        {
            Debug.LogWarning($"[TeleportController] No room position found for key '{key}' ({room.roomName}).");
            return false;
        }

        StartCoroutine(TeleportRoutine(roomPos));
        return true;
    }

    private bool IsRegistrationPassed()
    {
        // If session not ready, treat as NOT passed (safer)
        if (VisitorSession.Instance == null || !VisitorSession.Instance.IsLoaded)
            return false;

        var p = VisitorSession.Instance.Profile;
        if (p == null) return false;

        return p.passedRegistration;
    }

    private void ShowBlockedMessage()
    {
        if (Time.time < nextAllowedPopupTime) return;
        nextAllowedPopupTime = Time.time + Mathf.Max(0f, cooldownSeconds);

        if (promptRoot == null || promptText == null) return;

        if (popupRoutine != null) StopCoroutine(popupRoutine);
        popupRoutine = StartCoroutine(BlockedMessageRoutine());
    }

    private IEnumerator BlockedMessageRoutine()
    {
        promptRoot.SetActive(true);
        promptText.text = mustRegisterMessage;

        yield return new WaitForSeconds(Mathf.Max(0f, showSeconds));

        // Only hide if we’re still showing *our* message
        // (avoids fighting with the normal "Press F to interact" text)
        if (promptText != null && promptText.text == mustRegisterMessage)
        {
            promptRoot.SetActive(false);
        }

        popupRoutine = null;
    }

    private string BuildRoomKey(RoomSO room)
    {
        // Match the same stable logic used elsewhere
        if (room.roomNumber != 0)
            return room.roomNumber.ToString();

        if (!string.IsNullOrWhiteSpace(room.roomID))
            return room.roomID;

        return room.roomName;
    }

    private IEnumerator TeleportRoutine(Vector3 targetWorldPos)
    {
        // Fade out
        if (fadeCanvasGroup != null)
            yield return FadeTo(1f, fadeOutTime);

        if (holdBlackTime > 0f)
            yield return new WaitForSeconds(holdBlackTime);

        // Snap player landing to NavMesh
        Vector3 playerFinalPos = targetWorldPos;
        if (NavMesh.SamplePosition(targetWorldPos, out NavMeshHit hit, sampleRadius, NavMesh.AllAreas))
            playerFinalPos = hit.position;

        playerFinalPos += Vector3.up * yOffset;

        // Disable CC before teleporting to prevent CC fighting the transform move
        if (characterController != null)
            characterController.enabled = false;

        playerRoot.position = playerFinalPos;

        if (characterController != null)
            characterController.enabled = true;

        // Teleport Peccy too (optional)
        TeleportPeccyNearPlayer(playerFinalPos);

        // Fade in
        if (fadeCanvasGroup != null)
            yield return FadeTo(0f, fadeInTime);
    }

    private void TeleportPeccyNearPlayer(Vector3 playerFinalPos)
    {
        if (peccyRoot == null) return;

        // Keep the query at the player's height so it doesn’t “prefer” roof navmesh
        Vector3 query = playerFinalPos + peccyOffset;
        query.y = playerFinalPos.y;

        Vector3 peccyFinalPos = query;

        if (NavMesh.SamplePosition(query, out NavMeshHit hit, peccySampleRadius, NavMesh.AllAreas))
        {
            // If the sampled point is way above/below the player, reject it (likely roof/other floor)
            float yDelta = Mathf.Abs(hit.position.y - playerFinalPos.y);
            if (yDelta <= 1.2f) // tweak if needed (1.0 to 2.0)
                peccyFinalPos = hit.position;
            else
                peccyFinalPos = query; // fallback: stay near player height
        }

        peccyFinalPos += Vector3.up * yOffset;

        if (peccyAgent != null && peccyAgent.enabled)
        {
            // Warp is the correct way to teleport a NavMeshAgent. :contentReference[oaicite:2]{index=2}
            peccyAgent.Warp(peccyFinalPos);

            if (resetPeccyPathAfterTeleport)
                peccyAgent.ResetPath();
        }
        else
        {
            peccyRoot.position = peccyFinalPos;
        }
    }


    private IEnumerator FadeTo(float targetAlpha, float duration)
    {
        if (fadeCanvasGroup == null) yield break;

        float start = fadeCanvasGroup.alpha;
        float t = 0f;

        fadeCanvasGroup.blocksRaycasts = true;

        if (duration <= 0f)
        {
            fadeCanvasGroup.alpha = targetAlpha;
            fadeCanvasGroup.blocksRaycasts = targetAlpha > 0.001f;
            yield break;
        }

        while (t < duration)
        {
            t += Time.deltaTime;
            fadeCanvasGroup.alpha = Mathf.Lerp(start, targetAlpha, t / duration);
            yield return null;
        }

        fadeCanvasGroup.alpha = targetAlpha;
        fadeCanvasGroup.blocksRaycasts = targetAlpha > 0.001f;
    }
}
