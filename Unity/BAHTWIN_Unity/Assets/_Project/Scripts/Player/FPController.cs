using UnityEngine;
using UnityEngine.InputSystem;

[RequireComponent(typeof(CharacterController))]
public class FPController : MonoBehaviour
{
    [Header("Movement")]
    public float speed = 5f;
    public float gravity = -9.81f;
    public float jumpHeight = 1.5f;

    [Header("Look")]
    public Transform cameraTransform;
    public float lookSensitivity = 0.1f;

    [Header("Animation")]
    public Animator animator;

    [Header("Audio")]
    public AudioData walkingAudio;
    public AudioSource walkingSource;

    private CharacterController controller;
    private Vector2 moveInput;
    private Vector2 lookInput;
    private float xRotation;
    private float verticalVelocity;

    void Start()
    {
        controller = GetComponent<CharacterController>();
        if (cameraTransform == null && Camera.main != null)
            cameraTransform = Camera.main.transform;

        if (animator == null)
            animator = GetComponentInChildren<Animator>();

        Cursor.lockState = CursorLockMode.Locked;
        Cursor.visible = false;
    }

    void Update()
    {
        HandleLook();
        HandleMovement();
    }

    void HandleMovement()
    {
        Vector3 move = transform.right * moveInput.x + transform.forward * moveInput.y;

        bool isWalking = moveInput.sqrMagnitude > 0.01f;

        // DEBUG CHECKS
        if (controller == null) Debug.LogError("CONTROLLER IS NULL");
        if (AudioManager.Instance == null) Debug.LogError("AUDIOMANAGER INSTANCE IS NULL");
        if (walkingAudio == null) Debug.LogError("WALKING AUDIODATA IS NULL");


        // Walking animation control
        if (animator != null)
        {    
            animator.SetBool("IsWalking", isWalking);
        }

        // Walking audio control
        if (isWalking && controller.isGrounded)
        {
            if (walkingSource == null)
            {
                walkingSource = AudioManager.Instance.PlayLoopWithRandomStart(walkingAudio, transform);
            }
            else
            {
                walkingSource.pitch = Mathf.Lerp(0.9f, 1.1f, moveInput.magnitude);
            }
        }
        else
        {
            if (walkingSource != null)
            {
                AudioManager.Instance.StopLoop(walkingSource);
                walkingSource = null;
            }
        }

        // Gravity
        if (controller.isGrounded)
        {
            if (verticalVelocity < 0)
                verticalVelocity = -2f;
        }
        else
        {
            verticalVelocity += gravity * Time.deltaTime;
        }

        // Jump physics
        if (controller.isGrounded && moveInput.y > 0 && Keyboard.current.spaceKey.wasPressedThisFrame)
        {
            verticalVelocity = Mathf.Sqrt(jumpHeight * -2f * gravity);
        }

        move.y = verticalVelocity;

        controller.Move(move * speed * Time.deltaTime);
    }

    void HandleLook()
    {
        float mouseX = lookInput.x * lookSensitivity;
        float mouseY = lookInput.y * lookSensitivity;

        xRotation -= mouseY;
        xRotation = Mathf.Clamp(xRotation, -80f, 80f);

        cameraTransform.localRotation = Quaternion.Euler(xRotation, 0f, 0f);
        transform.Rotate(Vector3.up * mouseX);
    }

    // Player Input System
    public void OnMove(InputAction.CallbackContext context)
    {
        moveInput = context.ReadValue<Vector2>();
    }

    public void OnLook(InputAction.CallbackContext context)
    {
        lookInput = context.ReadValue<Vector2>();
    }

    public void OnJump(InputAction.CallbackContext context)
    {
        if (context.performed && controller.isGrounded)
        {
            verticalVelocity = Mathf.Sqrt(jumpHeight * -2f * gravity);
        }
    }
}
