using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.InputSystem;
using TMPro;

public class PlayerInteractorZoom : MonoBehaviour
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

    [Header("Optional: freeze player scripts while zoomed")]
    public Behaviour[] disableWhileZoomed;

    [Header("UI to hide while zoomed (restore original states on exit)")]
    [Tooltip("Drag any UI roots here: map panel, map labels, HUD, etc.")]
    public GameObject[] hideUIWhileZoomed;

    private readonly Dictionary<GameObject, bool> uiWasActive = new Dictionary<GameObject, bool>();
    private bool uiStateCached;

    private InputAction interactAction;

    // Existing badge flow
    private BadgePickupInteractable currentBadge;

    // Zoom flow
    private ZoomTarget currentZoomTarget;
    private ZoomTarget zoomedTarget;
    private bool isTransitioning;

    // Saved camera state
    private Vector3 camPos0;
    private Quaternion camRot0;
    private float camFov0;

    private Coroutine zoomRoutine;

    void Start()
    {
        if (cam == null) cam = Camera.main;
        if (playerInput == null) playerInput = GetComponent<PlayerInput>();

        if (playerInput != null && playerInput.actions != null)
        {
            var map = playerInput.actions.FindActionMap(actionMapName, true);
            interactAction = map.FindAction(interactActionName, true);
        }

        if (cam != null) camFov0 = cam.fieldOfView;

        SetPrompt(false, "");
    }

    void Update()
    {
        if (cam == null || interactAction == null) return;

        // If zoomed, pressing F exits zoom
        if (zoomedTarget != null)
        {
            SetPrompt(true, zoomedTarget.promptExit);

            if (!isTransitioning && interactAction.WasPressedThisFrame())
                ExitZoom();

            return;
        }

        // Not zoomed: detect what we're looking at
        currentBadge = FindBadge();
        currentZoomTarget = FindZoomTarget();

        if (currentZoomTarget != null && currentZoomTarget.zoomPoint != null)
        {
            SetPrompt(true, currentZoomTarget.promptLook);

            if (!isTransitioning && interactAction.WasPressedThisFrame())
                EnterZoom(currentZoomTarget);
        }
        else if (currentBadge != null)
        {
            SetPrompt(true, "Press F to interact");

            if (interactAction.WasPressedThisFrame())
            {
                currentBadge.Pickup();
                SetPrompt(false, "");
            }
        }
        else
        {
            SetPrompt(false, "");
        }
    }

    ZoomTarget FindZoomTarget()
    {
        Ray ray = new Ray(cam.transform.position, cam.transform.forward);

        if (Physics.Raycast(ray, out var hit, maxDistance, interactMask, QueryTriggerInteraction.Ignore))
        {
            var z = hit.collider.GetComponentInParent<ZoomTarget>();
            if (z != null && z.gameObject.activeInHierarchy) return z;
        }
        return null;
    }

    BadgePickupInteractable FindBadge()
    {
        Ray ray = new Ray(cam.transform.position, cam.transform.forward);

        if (Physics.Raycast(ray, out var hit, maxDistance, interactMask, QueryTriggerInteraction.Ignore))
        {
            var badge = hit.collider.GetComponentInParent<BadgePickupInteractable>();
            if (badge != null && badge.gameObject.activeInHierarchy) return badge;
        }
        return null;
    }

    void EnterZoom(ZoomTarget target)
    {
        zoomedTarget = target;

        camPos0 = cam.transform.position;
        camRot0 = cam.transform.rotation;
        camFov0 = cam.fieldOfView;

        CacheAndHideUI();
        FreezePlayer(true);

        StartZoomTransition(
            toPos: target.zoomPoint.position,
            toRot: target.zoomPoint.rotation,
            toFov: target.zoomFov,
            seconds: target.transitionSeconds
        );
    }

    void ExitZoom()
    {
        var seconds = zoomedTarget != null ? zoomedTarget.transitionSeconds : 0.25f;

        StartZoomTransition(
            toPos: camPos0,
            toRot: camRot0,
            toFov: camFov0,
            seconds: seconds,
            onDone: () =>
            {
                zoomedTarget = null;

                RestoreUI();
                FreezePlayer(false);

                SetPrompt(false, "");
            }
        );
    }

    void CacheAndHideUI()
    {
        uiWasActive.Clear();
        uiStateCached = true;

        if (hideUIWhileZoomed == null) return;

        foreach (var go in hideUIWhileZoomed)
        {
            if (go == null) continue;

            // activeSelf = the object's own local enabled state
            uiWasActive[go] = go.activeSelf;

            // hide it while zoomed
            go.SetActive(false);
        }
    }

    void RestoreUI()
    {
        if (!uiStateCached) return;

        foreach (var kv in uiWasActive)
        {
            var go = kv.Key;
            if (go == null) continue;

            // restore exactly what it was before zoom
            go.SetActive(kv.Value);
        }

        uiWasActive.Clear();
        uiStateCached = false;
    }

    void StartZoomTransition(Vector3 toPos, Quaternion toRot, float toFov, float seconds, System.Action onDone = null)
    {
        if (zoomRoutine != null) StopCoroutine(zoomRoutine);
        zoomRoutine = StartCoroutine(ZoomRoutine(toPos, toRot, toFov, Mathf.Max(0.01f, seconds), onDone));
    }

    IEnumerator ZoomRoutine(Vector3 toPos, Quaternion toRot, float toFov, float seconds, System.Action onDone)
    {
        isTransitioning = true;

        Vector3 fromPos = cam.transform.position;
        Quaternion fromRot = cam.transform.rotation;
        float fromFov = cam.fieldOfView;

        float t = 0f;
        while (t < 1f)
        {
            t += Time.deltaTime / seconds;
            float eased = t * t * (3f - 2f * t); // smoothstep

            cam.transform.position = Vector3.Lerp(fromPos, toPos, eased);
            cam.transform.rotation = Quaternion.Slerp(fromRot, toRot, eased);
            cam.fieldOfView = Mathf.Lerp(fromFov, toFov, eased);

            yield return null;
        }

        cam.transform.position = toPos;
        cam.transform.rotation = toRot;
        cam.fieldOfView = toFov;

        isTransitioning = false;
        onDone?.Invoke();
    }

    void FreezePlayer(bool freeze)
    {
        if (disableWhileZoomed != null)
        {
            foreach (var b in disableWhileZoomed)
            {
                if (b != null) b.enabled = !freeze;
            }
        }

        Cursor.visible = freeze;
        Cursor.lockState = freeze ? CursorLockMode.None : CursorLockMode.Locked;
    }

    void SetPrompt(bool on, string msg)
    {
        if (promptRoot != null) promptRoot.SetActive(on);
        if (promptText != null) promptText.text = on ? msg : "";
    }
}
