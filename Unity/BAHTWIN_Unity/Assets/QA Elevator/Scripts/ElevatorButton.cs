namespace QAtmo
{
    using System.Collections;
    using System.Collections.Generic;
    using UnityEngine;
    using UnityEngine.Events;

    public class ElevatorButton : MonoBehaviour
    {
        public UnityEvent onButtonPressed;
        [HideInInspector] public Collider btnCollider;
        private ElevatorOutsideDoors outsideDoors;
        private float initPosZ;
        public float switchOffTimer = 0;
        public float pressingDepth = 0.012f;
        private MaterialPropertyBlock propertyBlock;
        private MeshRenderer meshRender;
        [ColorUsage(true, true)] public Color inactiveColor = Color.black;
        [ColorUsage(true, true)] public Color activeColor = new Color(160, 191, 191, 255);
        private ElevatorMoving elevatorMoving;
        private AudioSource soundFX;

        void Start()
        {
            btnCollider = GetComponent<Collider>();
            outsideDoors = GetComponentInParent<ElevatorOutsideDoors>();
            soundFX = GetComponent<AudioSource>();

            if (outsideDoors != null)
            {
                outsideDoors.elevator.onElevatorArrived.AddListener(OnElevatorArrived);
                outsideDoors.elevator.onDoorsFullyOpen.AddListener(OnDoorsFullyOpen);
                outsideDoors.elevator.onDoorsFullyClose.AddListener(OnDoorsFullyClose);
                elevatorMoving = outsideDoors.elevator;
            }

            initPosZ = transform.localPosition.z;

            propertyBlock = new MaterialPropertyBlock();
            meshRender = GetComponent<MeshRenderer>();
        }

        public void AddListener(ElevatorMoving elevator)
        {
            elevator.onElevatorArrived.AddListener(OnElevatorArrived);
            elevator.onDoorsFullyOpen.AddListener(OnDoorsFullyOpen);
            elevatorMoving = elevator;
        }

        public void RemoveListener(ElevatorMoving elevator)
        {
            elevator.onElevatorArrived.RemoveListener(OnElevatorArrived);
            elevator.onDoorsFullyOpen.RemoveListener(OnDoorsFullyOpen);

            if (outsideDoors)
            {
                outsideDoors.elevator.onElevatorArrived.RemoveListener(OnElevatorArrived);
                outsideDoors.elevator.onDoorsFullyOpen.RemoveListener(OnDoorsFullyOpen);
                outsideDoors.elevator.onDoorsFullyClose.RemoveListener(OnDoorsFullyClose);
            }
        }

        private void OnElevatorArrived()
        {
            SwitchButton(false);

            if (outsideDoors != null)
            {
                SwitchButton(true, true);
                StopAllCoroutines();
                StartCoroutine(SwitchOff(0.2f));
            }
        }
        private void OnDoorsFullyOpen()
        {

        }

        private void OnDoorsFullyClose()
        {

        }

        public void SwitchButton(bool state, bool noSFX = false)
        {
            float depth = 0;

            if (state)
            {
                depth = initPosZ - pressingDepth;
                propertyBlock.SetColor("_EmissionColor", activeColor);
                if(!noSFX) soundFX.Play();
            }
            else
            {
                depth = initPosZ;
                propertyBlock.SetColor("_EmissionColor", inactiveColor);
            }

            transform.localPosition = new Vector3(transform.localPosition.x, transform.localPosition.y, depth);
            meshRender.SetPropertyBlock(propertyBlock);
        }

        public void OnPressed()
        {
            if (!elevatorMoving.isStay || elevatorMoving.isMove || elevatorMoving.innerDoorsAnim.isPlaying) return;

            for (int i = 0; i < elevatorMoving.buttons.Count; i++)
            {
                elevatorMoving.buttons[i].SwitchButton(false);
            }

            SwitchButton(true);

            if (elevatorMoving.isMove)
            {
                SwitchButton(false);
            }

            if (outsideDoors != null)
            {
                outsideDoors.elevator.NumericButtonPressed(outsideDoors.floor);
            }
            else
            {
                onButtonPressed.Invoke();
            }

            if (switchOffTimer > 0)
            {
                StopAllCoroutines();
                StartCoroutine(SwitchOff(switchOffTimer));
            }
        }

        IEnumerator SwitchOff(float delay)
        {
            yield return new WaitForSeconds(delay);
            SwitchButton(false);
        }
    }  
}
