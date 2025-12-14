namespace QAtmo
{
    using System.Collections;
    using System.Collections.Generic;
    using UnityEngine;

    public class FPSController : MonoBehaviour
    {
        [SerializeField] private bool lockCursor = true;

        [Header("MOVEMENT")]
        public bool canMove = true;

        public float walkSpeed = 3;
        public float runSpeed = 6;
        public float jumpPower = 1.5f;
        public float gravity = 10;

        [Header("LOOK")]
        public float camLookSens = 2;
        public float camLookXLimit = 85;
        public float smoothTime = 25f;

        [Header("REFERENCES")]
        public Transform cameraTransform;
        public CharacterController charController;
        private PlayerInput playerInput;

        [HideInInspector] public float xRecoil;
        [HideInInspector] public float yRecoil;

        private Quaternion characterTargetRot;
        private Quaternion cameraTargetRot;
        private Vector3 moveDir = Vector3.zero;
        private bool jumpInputPressed;

        // Start is called before the first frame update
        void Awake()
        {
            charController = GetComponent<CharacterController>();
            playerInput = GetComponent<PlayerInput>();
        }

        private void OnEnable()
        {
            playerInput.OnJumpPressed += OnJumpInput;
        }

        private void OnDisable()
        {
            playerInput.OnJumpPressed -= OnJumpInput;
        }

        private void Start()
        {
            cameraTargetRot = cameraTransform.localRotation;
            ToggleCursor(!lockCursor);
        }

        private void ToggleCursor(bool state)
        {
            if (state)
            {
                Cursor.visible = true;
                Cursor.lockState = CursorLockMode.None;
            }
            else
            {
                Cursor.visible = false;
                Cursor.lockState = CursorLockMode.Locked;
            }
        }

        // Update is called once per frame
        void Update()
        {
            Movement();
            LookRotation();
        }

        private void OnJumpInput()
        {
            jumpInputPressed = true;
        }

        private void Movement()
        {
            Vector3 forward = transform.TransformDirection(Vector3.forward);
            Vector3 right = transform.TransformDirection(Vector3.right);
            float curSpeed = playerInput.tacticalWalk ? walkSpeed : runSpeed;

            float curSpeedZ = canMove ? curSpeed * playerInput.vertical : 0;
            float curSpeedX = canMove ? curSpeed * playerInput.horizontal : 0;
            float moveDirY = moveDir.y;

            moveDir = (forward * curSpeedZ) + (right * curSpeedX);

            if (jumpInputPressed && canMove && charController.isGrounded)
                moveDir.y = jumpPower;
            else
                moveDir.y = moveDirY;

            if (!charController.isGrounded)
                moveDir.y -= gravity * Time.deltaTime;

            charController.Move(moveDir * Time.deltaTime);

            jumpInputPressed = false;
        }

        Quaternion nanRot = new Quaternion(float.NaN, float.NaN, float.NaN, float.NaN);
        public void LookRotation()
        {
            characterTargetRot *= Quaternion.Euler(0f, playerInput.yRot * camLookSens, 0f);
            cameraTargetRot *= Quaternion.Euler(-playerInput.xRot * camLookSens, 0f, 0f);

            characterTargetRot = characterTargetRot.normalized;
            cameraTargetRot = cameraTargetRot.normalized;

            cameraTargetRot = ClampRotationAroundXAxis(cameraTargetRot);

            if (characterTargetRot != nanRot)
                transform.localRotation = Quaternion.Slerp(transform.localRotation, characterTargetRot, smoothTime * Time.deltaTime);
            if (cameraTargetRot != nanRot)
                cameraTransform.localRotation = Quaternion.Slerp(cameraTransform.localRotation, cameraTargetRot, smoothTime * Time.deltaTime);
        }

        Quaternion ClampRotationAroundXAxis(Quaternion q)
        {
            q.x /= q.w;
            q.y /= q.w;
            q.z /= q.w;
            q.w = 1.0f;

            float angleX = 2.0f * Mathf.Rad2Deg * Mathf.Atan(q.x);

            angleX = Mathf.Clamp(angleX, -camLookXLimit, camLookXLimit);

            q.x = Mathf.Tan(0.5f * Mathf.Deg2Rad * angleX);

            return q;
        }
    }
}
