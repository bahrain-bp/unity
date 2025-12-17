namespace QAtmo
{
    using System.Collections;
    using System.Collections.Generic;
    using UnityEngine;
    using UnityEngine.Events;

#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
#endif

    public class ElevatorFirstPersonInteraction : MonoBehaviour
    {
        [Tooltip("Type your player controller camera tag here.")]
        public string playerCameraTag = "MainCamera";

        //Interaction for Unity Input System package
#if ENABLE_INPUT_SYSTEM
    [SerializeField] private Key interactionKey = Key.E;
#else
        //Interaction for leagacy input
        [SerializeField] private KeyCode interactionKeycode = KeyCode.E;
#endif

        //The maximum distance the player can stay from the interactive buttons and use them
        [SerializeField] private float maxInteractionDistance = 1.5f;
        //Layer mask for raycast
        [SerializeField] private LayerMask interactionMask = -1;

        private ElevatorMoving elevator;
        private ElevatorButton buttonInSight;
        private Transform playerCamera;

        private bool interactionKeyPressed = false;

        //You can subsctibe to this events to show interaction popups
        [Header("EVENTS")]
        public UnityEvent onButtonInSight;
        public UnityEvent onButtonOutSight;
        public UnityAction OnButtonInSight;
        public UnityAction OnButtonOutSight;

        void Start()
        {
            elevator = GetComponent<ElevatorMoving>();
            playerCamera = GameObject.FindGameObjectWithTag(playerCameraTag).transform;
        }

        // Update is called once per frame
        void Update()
        {
            if (elevator.zoneEnterCount > 0)
            {
#if ENABLE_INPUT_SYSTEM
            interactionKeyPressed = Keyboard.current[interactionKey].wasPressedThisFrame;
#else
                interactionKeyPressed = Input.GetKeyDown(interactionKeycode);
#endif
                Raycast(elevator.buttons);
            }
        }

        public void Raycast(List<ElevatorButton> btns)
        {
            RaycastHit hit;
            if (Physics.Raycast(playerCamera.position, playerCamera.forward, out hit, maxInteractionDistance, interactionMask))
            {
                for (int i = 0; i < btns.Count; i++)
                {
                    if (hit.collider == btns[i].btnCollider)
                    {
                        buttonInSight = btns[i];

                        if (interactionKeyPressed)
                            btns[i].OnPressed(); //Call this method on the button which is currently in sight to invoke this button's functionality.
                    }
                    else
                    {
                        if (buttonInSight == btns[i])
                            buttonInSight = null;
                    }
                }
                if (buttonInSight != null)
                {
                    onButtonInSight.Invoke();
                    OnButtonInSight?.Invoke();
                }
                else
                {
                    onButtonOutSight.Invoke();
                    OnButtonOutSight?.Invoke();
                }
            }
            else
            {
                onButtonOutSight.Invoke();
                OnButtonOutSight?.Invoke();
            }
        }
    }
}
