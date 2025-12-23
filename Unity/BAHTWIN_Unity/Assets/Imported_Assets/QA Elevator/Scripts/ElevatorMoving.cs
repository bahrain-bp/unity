namespace QAtmo
{
    using System.Collections;
    using System.Collections.Generic;
    using UnityEngine;
    using UnityEngine.Events;
    using TMPro;

    public class ElevatorMoving : MonoBehaviour
    {
        [Tooltip("Type your player controller tag here.")]
        public string playerTag = "Player";

        [HideInInspector] public Transform player;
        public AnimationCurve elevatorMoveCurve;

        public float elevatorSpeed = 1;

        [HideInInspector] public ElevatorOutsideDoors[] outsideDoors;
        [HideInInspector] public Animation outterDoorsAnim;
        [HideInInspector] public Animation innerDoorsAnim;

        [HideInInspector] public bool inZone = false;
        [HideInInspector] public int zoneEnterCount = 0;
        private Transform playerInitParent;
        private CharacterController cController;

        private int floorsDelta;
        private int targetFloor;
        public int currentFloor = 1;

        [Header("SOUND EFFECTS")]
        public AudioSource bellFX;
        public AudioSource moveFX;
        public AudioSource doorsOpenFX;
        public AudioSource doorsCloseFX;

        private TextMeshPro[] floorNumberTexts;
        private List<MeshRenderer> arrowsUp = new List<MeshRenderer>();
        private List<MeshRenderer> arrowDown = new List<MeshRenderer>();

        [HideInInspector] public bool isMove = false;
        [HideInInspector] public bool isOpen = false;
        [HideInInspector] public bool isStay = true;

        //[HideInInspector] public ElevatorButton[] buttons;
        [HideInInspector] public List<ElevatorButton> buttons;
        [HideInInspector] public ElevatorButton buttonInSight;

        [Header("EVENTS")]
        public UnityEvent onButtonInSight;
        public UnityEvent onButtonOutSight;
        public UnityEvent onDoorsFullyOpen;
        public UnityEvent onDoorsFullyClose;
        public UnityEvent onElevatorArrived; 

        void Awake()
        {
            player = GameObject.FindGameObjectWithTag(playerTag).transform;
            if (player == null)
            {
                Debug.LogError($"Player transform with tag '{playerTag}' not found. Please, make sure that your player controller tag = '{playerTag}'");
                return;
            }

            Transform[] allTransforms = transform.parent.GetComponentsInChildren<Transform>();
            for (int i = 0; i < allTransforms.Length; i++)
            {
                if(allTransforms[i].TryGetComponent(out ElevatorButton btn))
                {
                    buttons.Add(btn);
                }
            }

            floorNumberTexts = transform.parent.GetComponentsInChildren<TextMeshPro>();

            for (int i = 0; i < buttons.Count; i++)
            {
                buttons[i].AddListener(this);
            }

            innerDoorsAnim = GetComponentInChildren<Animation>();
            outsideDoors = transform.parent.GetComponentsInChildren<ElevatorOutsideDoors>();

            for (int i = 0; i < outsideDoors.Length; i++)
            {
                if (outsideDoors[i].floor == currentFloor)
                {
                    transform.position = outsideDoors[i].transform.position;
                }
            }

            ElevatorDirectionArrow[] allArrow = transform.parent.GetComponentsInChildren<ElevatorDirectionArrow>(true);
            for (int i = 0; i < allArrow.Length; i++)
            {
                if (allArrow[i].isUp)
                {
                    arrowsUp.Add(allArrow[i].GetComponent<MeshRenderer>());
                }
                else
                {
                    arrowDown.Add(allArrow[i].GetComponent<MeshRenderer>());
                }
            }
            SwitchArrows(false, false);
            SetFloorNumberTexts(currentFloor.ToString());
        }

        private void OnDisable()
        {
            for (int i = 0; i < buttons.Count; i++)
            {
                buttons[i].RemoveListener(this);
            }
        }

        private void OnTriggerEnter(Collider other)
        {
            if (other.transform == player)
            {
                playerInitParent = player.parent;
                player.SetParent(transform);
                zoneEnterCount++;
            }
        }
        private void OnTriggerExit(Collider other)
        {
            if (other.transform == player)
            {
                player.SetParent(playerInitParent);
                zoneEnterCount--;
            }
        }

        public void DoorOpenCloseButtonPressed(bool open)
        {
            if (isMove || innerDoorsAnim.isPlaying)
                return;

            StopAllCoroutines();

            if (open)
            {
                if (!isOpen)
                {
                    //open doors immediately
                    StartCoroutine(DoorsOpenClose(innerDoorsAnim, 0, 1, 0, doorsOpenFX));
                    StartCoroutine(DoorsOpenClose(outterDoorsAnim, 0, 1, 0, doorsOpenFX));
                }
            }
            else
            {
                if (isOpen)
                {
                    //close doors immediately
                    StartCoroutine(DoorsOpenClose(innerDoorsAnim, 1, -1, 0, doorsCloseFX));
                    StartCoroutine(DoorsOpenClose(outterDoorsAnim, 1, -1, 0, doorsCloseFX));
                }
            }
        }

        public void NumericButtonPressed(int number)
        {
            if (isMove || innerDoorsAnim.isPlaying)
                return;

            //Debug.Log("Numeric button pressed = " + number);
            targetFloor = number;
            bool validFloorFound = false;

            for (int i = 0; i < outsideDoors.Length; i++)
            {
                if (outsideDoors[i].floor == number)
                {
                    validFloorFound = true;
                    TryMoveElevator();
                    return;
                }
            }
            if (!validFloorFound)
            {
                Debug.LogWarning("No one floor with this number has been found. Please, check that you added an ElevatorOutsideDoors with the same number as the button has.");
                
                for (int i = 0; i < buttons.Count; i++)
                {
                    buttons[i].SwitchButton(false);
                }
            }
        }
        public void TryMoveElevator()
        {
            StopAllCoroutines();

            if (targetFloor != currentFloor)
            {
                //close door without a delay

                if (isOpen)
                {
                    StartCoroutine(DoorsOpenClose(innerDoorsAnim, 1, -1, 0, doorsCloseFX));
                    StartCoroutine(DoorsOpenClose(outterDoorsAnim, 1, -1, 0, doorsCloseFX));
                }

                Invoke("ElevatorGo", 2);
            }
            else
            {
                //User selected the same floor as the floor where the elevator is located now. Open doors in this case.

                if (!isOpen)
                {
                    GetOutsideDoorsAnim(targetFloor);
                    //open doors without a delay
                    StartCoroutine(DoorsOpenClose(innerDoorsAnim, 0, 1, 0, doorsOpenFX));
                    StartCoroutine(DoorsOpenClose(outterDoorsAnim, 0, 1, 0, doorsOpenFX));

                    //close doors with a delay
                    StartCoroutine(DoorsOpenClose(innerDoorsAnim, 1, -1, 5, doorsCloseFX));
                    StartCoroutine(DoorsOpenClose(outterDoorsAnim, 1, -1, 5, doorsCloseFX));

                    onElevatorArrived?.Invoke();
                }
            }
            //Debug.Log("Go to " + targetFloor);
        }
        public void OpenDoorsButtonPressed(int floor)
        {
            if (isOpen || innerDoorsAnim.isPlaying)
                return;

            Debug.Log("Open door button pressed");
            targetFloor = floor;
            
            ElevatorGo();
        }
        public void CloseDoorsButtonPressed()
        {
            Debug.Log("Close door button pressed");
        }

        private void GetOutsideDoorsAnim(int floor)
        {
            for (int i = 0; i < outsideDoors.Length; i++)
            {
                if (outsideDoors[i].floor == floor)
                {
                    outterDoorsAnim = outsideDoors[i].GetComponent<Animation>();
                    break;
                }
            }
        }

        void ElevatorGo()
        {
            for (int i = 0; i < outsideDoors.Length; i++)
            {
                if (outsideDoors[i].floor == targetFloor)
                {
                    isMove = true;
                    outterDoorsAnim = outsideDoors[i].GetComponent<Animation>();
                    floorsDelta = targetFloor - currentFloor;

                    SetDirectionArrow(floorsDelta);

                    StartCoroutine(MoveElevator(transform.position, outsideDoors[i].transform.position, Mathf.Abs(floorsDelta)));
                }
            }
        }

        IEnumerator DoorsOpenClose(Animation anim, float initTime, float speed, float delay, AudioSource doorFX)
        {
            yield return new WaitForSeconds(delay);
            yield return null;

            anim[anim.clip.name].normalizedTime = initTime;
            anim[anim.clip.name].speed = speed;
            anim.Play();

            doorFX.Play();

            isStay = true;
        }

        void SetFloorNumberTexts(string text)
        {
            for (int i = 0; i < floorNumberTexts.Length; i++)
            {
                floorNumberTexts[i].text = text;
            }      
        }
        void SetDirectionArrow(float signedFloat)
        {
            if(signedFloat > 0)
            {
                SwitchArrows(true, false);
            }
            else
            {
                SwitchArrows(false, true);
            }
        }

        void SwitchArrows(bool upValue, bool downValue)
        {
            for (int i = 0; i < arrowsUp.Count; i++)
            {
                arrowsUp[i].enabled = upValue;
                arrowDown[i].enabled = downValue;
            }
        }

        IEnumerator MoveElevator(Vector3 currentPos, Vector3 targetPos, float floorsCount)
        {
            isStay = false;
            float f = 0;
            int floor = 0;

            float moveT = 0;

            moveFX.Play();

            while (isMove)
            {
                f += Time.fixedDeltaTime * elevatorSpeed / floorsCount;

                transform.position = Vector3.Lerp(currentPos, targetPos, moveT);

                moveT = elevatorMoveCurve.Evaluate(f);

                if (floorsDelta > 0)
                {
                    floor = (int)Mathf.Lerp(currentFloor, targetFloor, f);
                }
                else
                {
                    floor = (int)Mathf.Lerp((float)(currentFloor + 0.99f), targetFloor, f);
                }

                SetFloorNumberTexts(floor.ToString());

                if (f >= 1)
                {
                    currentFloor = targetFloor;
                    isMove = false;
                    StopCoroutine("MoveElevator");
                    StopAllCoroutines();
                    //open doors with a delay
                    StartCoroutine(DoorsOpenClose(innerDoorsAnim, 0, 1, 1, doorsOpenFX));
                    StartCoroutine(DoorsOpenClose(outterDoorsAnim, 0, 1, 1, doorsOpenFX));

                    //close doors with a delay
                    StartCoroutine(DoorsOpenClose(innerDoorsAnim, 1, -1, 5, doorsCloseFX));
                    StartCoroutine(DoorsOpenClose(outterDoorsAnim, 1, -1, 5, doorsCloseFX));

                    if (bellFX != null) bellFX.Play();
                    SwitchArrows(false, false);
                    moveFX.Stop();
                    onElevatorArrived?.Invoke();
                }

                Physics.SyncTransforms();

                yield return new WaitForFixedUpdate();
            }
        }

        public void OnDoorsFullyOpen()
        {
            if(innerDoorsAnim[innerDoorsAnim.clip.name].speed > 0)
            {
                isOpen = true;
                onDoorsFullyOpen.Invoke();
            }
        }

        public void OnDoorsFullyClose()
        {
            if (innerDoorsAnim[innerDoorsAnim.clip.name].speed < 0)
            {
                isOpen = false;
                onDoorsFullyClose.Invoke();
            }
        }
    }
}
