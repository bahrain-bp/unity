namespace QAtmo
{
    using System;
    using System.Collections;
    using System.Collections.Generic;
    using UnityEngine;
    using UnityEngine.Events;
    using UnityEngine.UI;

#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
#endif

    [Serializable]
    public class MobileInput
    {
        public GameObject mobileInputUI;
        public Button shootBtn;
        public Button aimBtn;
        public Button reloadBtn;
        public Button jumpBtn;
        [HideInInspector] public bool fireBtnDown;
    }

    public class PlayerInput : MonoBehaviour
    {
        [HideInInspector] public float vertical;
        [HideInInspector] public float horizontal;
        [HideInInspector] public bool tacticalWalk;
        [HideInInspector] public bool jump;
        [HideInInspector] public float xRot = 0;
        [HideInInspector] public float yRot = 0;

        public UnityAction OnJumpPressed;

#if ENABLE_INPUT_SYSTEM
    [SerializeField] private Key interactionKey = Key.E;
#else

        private string vAxisName = "Vertical";
        private string hAxisName = "Horizontal";

        private string xMouseAxisName = "Mouse X";
        private string yMouseAxisName = "Mouse Y";
#endif

        public bool useMobileInput;
        public MobileInput mobileInput;

        void Start()
        {
            if (useMobileInput)
            {
                mobileInput.mobileInputUI.SetActive(true);
                mobileInput.jumpBtn.onClick.AddListener(OnMobileJumpBtnPress);
            }
            else if (mobileInput.mobileInputUI != null)
                mobileInput.mobileInputUI.SetActive(false);
        }

        private void OnDestroy()
        {
            if (!useMobileInput) return;

            mobileInput.reloadBtn.onClick.RemoveAllListeners();
            mobileInput.aimBtn.onClick.RemoveAllListeners();
            mobileInput.jumpBtn.onClick.RemoveAllListeners();
        }

        private void OnMobileJumpBtnPress()
        {
            OnJumpPressed?.Invoke();
        }

        void Update()
        {
            HandleInput();
        }

        private void HandleInput()
        {
            if (useMobileInput)
            {

            }
            else
            {
#if ENABLE_INPUT_SYSTEM
            vertical = 0;
            horizontal = 0;
            if(Keyboard.current[Key.W].isPressed) vertical = 1;
			else if(Keyboard.current[Key.S].isPressed) vertical = -1;

			if(Keyboard.current[Key.D].isPressed) horizontal = 1;
			else if(Keyboard.current[Key.A].isPressed) horizontal = -1;

            yRot = 0;
            xRot = 0;

            yRot = Mouse.current.delta.x.ReadValue() * 0.1f;
			xRot = Mouse.current.delta.y.ReadValue() * 0.1f;
#else
                vertical = Input.GetAxis(vAxisName);
                horizontal = Input.GetAxis(hAxisName);
                tacticalWalk = Input.GetKey(KeyCode.LeftShift);

                if (Input.GetKeyDown(KeyCode.Space)) OnJumpPressed?.Invoke();

                xRot = Input.GetAxis(yMouseAxisName);
                yRot = Input.GetAxis(xMouseAxisName);
#endif
            }
        }
    }
}
