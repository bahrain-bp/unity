using System.Collections;
using System.Collections.Generic;
using UnityEngine;

#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
#endif

public class Elevator : MonoBehaviour {
	private bool inTrigger = false;
	private Rigidbody Player;
	private Transform PlayerCam;

    //Interaction for Unity Input System package
#if ENABLE_INPUT_SYSTEM
    [SerializeField] private Key interactionKey = Key.E;
#else
    //Interaction for leagacy input
    [SerializeField] private KeyCode interactionKeycode = KeyCode.E;
#endif

    [Tooltip("Type your Player's tag here.")]
	public string PlayerTag = "Player";
	private Animation DoorsAnim;

	[Tooltip("Speed multiplier of the doors opening and closing. 1 is default speed.")]
	public float DoorsAnimSpeed = 1;

	[Tooltip("How fast the elevator 'passes' one floor. The time in seconds.")]
	public float OneFloorTime = 1.5f;

	private float OpenDelay = 1;

	[Tooltip("How long the doors are open. The time in seconds.")]
	public float CloseDelay = 4;
	private bool isOpen = false;
	private string AnimName = "ElevatorDoorsAnim_open";
	private string InputFloor = "";
	private int TargetFloor;

	[Tooltip("The floor, where this elevator is placed. Set an unique value for each elevator.")]
	public int CurrentFloor;
	private int FloorCount;
	[HideInInspector]
	public int ElevatorFloor;
	private List<GameObject> Elevators = new List<GameObject>();
	private Elevator[] ElevatorsScripts;
	private Animation TargetElvAnim;
	private TextMesh TargetElvTextInside;
	private TextMesh TargetElvTextOutside;
	public TextMesh TextOutside;
	public TextMesh TextInside;

	[Tooltip("If set to true, the Reflection Probe inside the elevator will be updated every frame, when the player near or inside the elevator. Can impact performance.")]
	public bool UpdateReflectionEveryFrame = false;
	private bool isReflectionProbe = true;
	private MeshRenderer ElevatorOpenButton;
	private MeshRenderer ElevatorGoBtn;
	private List<MeshRenderer> ElevatorNumericButtons = new List<MeshRenderer>();
	private AudioSource SoundFX;
	private AudioSource TargetSoundFX;
	private bool SpeedUp = false;
	private bool SlowDown = false;
	private static bool Moving = false;
	private bool isPlayer;
	private float PlayerHeight;
	private bool isRigidbodyCharacter;
	private ReflectionProbe probe;

	[Header("Sound Effects settings")]

	public AudioClip Bell;
	[Range(0, 1)]
	public float BellVolume = 1;

	public AudioClip DoorsOpen;
	[Range(0, 1)]
	public float DoorsOpenVolume = 1;

	public AudioClip DoorsClose;
	[Range(0, 1)]
	public float DoorsCloseVolume = 1;

	public AudioClip ElevatorMove;
	[Range(0, 1)]
	public float ElevatorMoveVolume = 1;

	public AudioClip ElevatorBtn;
	[Range(0, 1)]
	public float ElevatorBtnVolume = 1;

	public AudioClip ElevatorError;
	[Range(0, 1)]
	public float ElevatorErrorVolume = 1;

	private AudioSource BtnSoundFX;

	private bool ElvFound = false;
	private ElevatorManager _elevatorManager;
	private GameObject ElevatorsParent;

    private CharacterController playerController;
    private static SphereCollider extraCollider;

    private bool interactionKeyPressed = false;

    // Use this for initialization
    void Awake () {
		if (GetComponentInChildren<ReflectionProbe> ()) {
			probe = GetComponentInChildren<ReflectionProbe> ();
			probe.refreshMode = UnityEngine.Rendering.ReflectionProbeRefreshMode.OnAwake;
			isReflectionProbe = true;
		} else {
			isReflectionProbe = false;
		}

		isPlayer = false;
		Moving = false;
		BtnSoundFX = GetComponent<AudioSource> ();

		if(transform.parent != null){
			ElevatorsParent = transform.parent.gameObject;
			if(ElevatorsParent.GetComponent<ElevatorManager>()){
				_elevatorManager = ElevatorsParent.GetComponent<ElevatorManager> ();
			}
		}


		//SoundFX initialisation
		SoundFX = new GameObject ().AddComponent<AudioSource>();
		SoundFX.transform.parent = gameObject.transform;
		SoundFX.transform.position = new Vector3 (gameObject.transform.position.x, gameObject.transform.position.y + 2.2f, gameObject.transform.position.z);
		SoundFX.gameObject.name = "SoundFX";
		SoundFX.playOnAwake = false;
		SoundFX.spatialBlend = 1;
		SoundFX.minDistance = 0.1f;
		SoundFX.maxDistance = 10;
		SoundFX.rolloffMode = AudioRolloffMode.Linear;
		SoundFX.priority = 256;
		//

		DoorsAnim = gameObject.GetComponent<Animation> ();
		AnimName = DoorsAnim.clip.name;


		if (GameObject.FindGameObjectWithTag (PlayerTag)) {

			Player = GameObject.FindGameObjectWithTag (PlayerTag).GetComponent<Rigidbody>();

			if(Player.gameObject.GetComponent<CapsuleCollider>()){
				PlayerHeight = Player.gameObject.GetComponent<CapsuleCollider> ().height/2;
				isRigidbodyCharacter = true;
				isPlayer = true;
			}else if(Player.gameObject.GetComponent<CharacterController>()){

                //Unity 2019 fix

                if (extraCollider == null) {
                    extraCollider = Player.gameObject.AddComponent<SphereCollider>();
                    extraCollider.radius = 0.001f;
                }

                playerController = Player.GetComponent<CharacterController>();

                //

				PlayerHeight = Player.gameObject.GetComponent<CharacterController> ().height/2 + Player.gameObject.GetComponent<CharacterController> ().skinWidth;
				isRigidbodyCharacter = false;
				isPlayer = true;
			}
		} else {
			Debug.LogWarning ("Elevator: Can't find Player. Please, check that your Player object has 'Player' tag.");
			this.enabled = false;
			isPlayer = false;
		}

		if(isPlayer){
			if (Player.GetComponentInChildren<Camera>().transform) {
				PlayerCam = Player.GetComponentInChildren<Camera>().transform;
			} else {
				Debug.LogWarning ("Elevator: Can't find Player's camera. Please, check that your Player have a camera parented to it.");
				this.enabled = false;
			}
		}

		foreach (GameObject obj in GameObject.FindGameObjectsWithTag ("Elevator")) {
			if(obj.transform.parent == gameObject.transform.parent){
				
				if(obj != gameObject){
					Elevators.Add (obj);
				}
			}
		}

		if (_elevatorManager) {
			_elevatorManager.WasStarted += RandomInit;
		} else {
			Debug.LogWarning ("Elevator: To use more than one elevator shaft, please create an empty gameobject in your scene, add the ElevatorManager.cs script on it and make elevators of one elevator shaft as child to this object. Repeate this for every different elevators shafts.");
		}

	}

	void RandomInit(){
		if (_elevatorManager) {
			ElevatorFloor = _elevatorManager.InitialFloor;
		} else {
			ElevatorFloor = 1;
			//Debug.LogWarning ("No ElevatorManager has been found for '" + gameObject.name + "'. Initial floor will be set to 1. If you want to set your own floor or make it random, please make this object child to object with ElevatorManager script.");
		}
		TextOutside.text = ElevatorFloor.ToString();
		TextInside.text = ElevatorFloor.ToString();
	}
	

	void Update () {
		if (inTrigger) 
		{
#if ENABLE_INPUT_SYSTEM
            interactionKeyPressed = Keyboard.current[interactionKey].wasPressedThisFrame;
#else
            interactionKeyPressed = Input.GetKeyDown(interactionKeycode);
#endif
            RaycastHit[] hits;
				if (interactionKeyPressed) {

					hits = Physics.RaycastAll (PlayerCam.position, PlayerCam.forward, 3);

					for (int i = 0; i < hits.Length; i++) {
						RaycastHit hit = hits [i];

					if (hit.transform.tag == "ElevatorButtonOpen" && !isOpen) {
						BtnSoundFX.clip = ElevatorBtn;
						BtnSoundFX.volume = ElevatorBtnVolume;
						BtnSoundFX.Play ();
						ElevatorOpenButton = hit.transform.GetComponent<MeshRenderer> ();
						ElevatorOpenButton.enabled = true;

						isOpen = true;
						Invoke ("DoorsOpening", OneFloorTime * Mathf.Abs (CurrentFloor - ElevatorFloor) + OpenDelay);

						FloorCount = ElevatorFloor;
						ElevatorFloor = CurrentFloor;

						foreach (GameObject elv in Elevators) {
							Elevator elvScipt = (Elevator)elv.GetComponent (typeof(Elevator));
							elvScipt.ElevatorFloor = CurrentFloor;
						}

						StartCoroutine ("FloorsCounter");
					}

					if (hit.transform.tag == "ElevatorNumericButton" && !Moving) {
						InputFloor += hit.transform.name;
						hit.transform.GetComponent<MeshRenderer> ().enabled = true;
						ElevatorNumericButtons.Add (hit.transform.GetComponent<MeshRenderer> ());
						BtnSoundFX.clip = ElevatorBtn;
						BtnSoundFX.volume = ElevatorBtnVolume;
						BtnSoundFX.Play ();
					}

					if (hit.transform.tag == "ElevatorGoButton" && !Moving) {
						
						if (InputFloor != "" && InputFloor.Length < 4) {
							if (InputFloor == "0-1") {
								InputFloor = "-99";
							}
							TargetFloor = int.Parse (InputFloor);
							
							foreach (GameObject elv in Elevators) {
								Elevator elvScipt = (Elevator)elv.GetComponent (typeof(Elevator));
								if (elvScipt.CurrentFloor == TargetFloor) {
									ElvFound = true;
									TargetElvAnim = elv.GetComponent<Animation> ();
									TargetElvTextInside = elv.GetComponent<Elevator> ().TextInside;
									TargetElvTextOutside = elv.GetComponent<Elevator> ().TextOutside;
									BtnSoundFX.clip = ElevatorBtn;
									BtnSoundFX.volume = ElevatorBtnVolume;
									BtnSoundFX.Play ();
									ElevatorFloor = TargetFloor;
									elvScipt.ElevatorFloor = TargetFloor;

									FloorCount = CurrentFloor;

									if (CurrentFloor != ElevatorFloor) {
										if (elvScipt.isReflectionProbe) {
											if (elvScipt.UpdateReflectionEveryFrame) {
												elvScipt.probe.RenderProbe ();
											}
										}
										Invoke ("ElevatorGO", 1);
										ElevatorGoBtn = hit.transform.GetComponent<MeshRenderer> ();
										ElevatorGoBtn.enabled = true;
										Moving = true;

									} else {
										DoorsOpening ();
									}
									InputFloor = "";
								} else {
									
								}
							}
						} else {
							ButtonsReset ();
							InputFloor = "";
							BtnSoundFX.clip = ElevatorError;
							BtnSoundFX.volume = ElevatorErrorVolume;
							BtnSoundFX.Play ();
						}
						if (!ElvFound) {
							ButtonsReset ();
							InputFloor = "";
							BtnSoundFX.clip = ElevatorError;
							BtnSoundFX.volume = ElevatorErrorVolume;
							BtnSoundFX.Play ();
						}
						if (TargetFloor != CurrentFloor) {
							DoorsClosing ();
						} else if (!isOpen) {
							DoorsOpening ();
						}
					}
				}
			}
		

			if(SpeedUp){
				if (SoundFX.volume < ElevatorMoveVolume) {
					SoundFX.volume += 0.9f * Time.deltaTime;
				} else {
					SpeedUp = false;
				}
				if(SoundFX.pitch < 1){
					SoundFX.pitch += 0.9f * Time.deltaTime;
				}
			}

			if(SlowDown){
				if (SoundFX.volume > 0) {
					SoundFX.volume -= 0.9f * Time.deltaTime;
				} else {
					SlowDown = false;
				}
				if(SoundFX.pitch > 0){
					SoundFX.pitch -= 0.9f * Time.deltaTime;
				}
			}
		}
	}

	void ElevatorGO(){	

		ElvFound = false;
		StartCoroutine ("FloorsCounterInside");
		SoundFX.clip = ElevatorMove;
		SoundFX.loop = true;
		SoundFX.volume = 0;
		SoundFX.pitch = 0.5f;
		SpeedUp = true;	
		SoundFX.Play ();

	}

	void SlowDownStart(){
		SlowDown = true;
	}

	IEnumerator FloorsCounterInside(){
		for (;;) {
			TextOutside.text = FloorCount.ToString();
			TextInside.text = FloorCount.ToString();


			if(TargetFloor - FloorCount == 1){
				Invoke ("SlowDownStart", OneFloorTime/2);
			}

			if(FloorCount - TargetFloor == 1){
				Invoke ("SlowDownStart", OneFloorTime/2);
			}

			if(TargetFloor == FloorCount){
				yield break;
			}

			yield return new WaitForSeconds (OneFloorTime);
			if (CurrentFloor < TargetFloor) {
				FloorCount++;


			}
			if (CurrentFloor > TargetFloor) {
				FloorCount--;

			}

			if(FloorCount == TargetFloor){
				//Moving = false;
				SoundFX.Stop ();
				TargetBellSoundPlay ();
                
				if (!isRigidbodyCharacter) {
                    playerController.enabled = false;
                    Player.isKinematic = false;
                }

                Player.transform.position = new Vector3 (Player.transform.position.x, TargetElvAnim.transform.position.y + PlayerHeight, Player.transform.position.z);

				if(isReflectionProbe){
					if(UpdateReflectionEveryFrame){
						probe.refreshMode = UnityEngine.Rendering.ReflectionProbeRefreshMode.OnAwake;
						probe.RenderProbe ();
					}
				}

				if(!isRigidbodyCharacter){
                    playerController.enabled = true;
                    Player.isKinematic = true;
                }
                
                Invoke ("TargetElvOpening", OpenDelay);
			}
		}

	}

	IEnumerator FloorsCounter(){
		for (;;) {
			TextOutside.text = FloorCount.ToString();
			TextInside.text = FloorCount.ToString();

			if(CurrentFloor == FloorCount){
				BellSoundPlay ();
				yield break;
			}

			yield return new WaitForSeconds (OneFloorTime);
			if (CurrentFloor < FloorCount) {
				FloorCount--;
			}
			if (CurrentFloor > FloorCount) {
				FloorCount++;
			}
		}

	}

	void DoorsClosingSoundPlay(){
		if(DoorsAnim[AnimName].speed < 0){
			SoundFX.clip = DoorsClose;
			SoundFX.loop = false;
			SoundFX.volume = DoorsCloseVolume;
			SoundFX.pitch = 1;
			SoundFX.Play ();
		}
	}

	void DoorsOpeningSoundPlay(){
		if(DoorsAnim[AnimName].speed > 0){
			SoundFX.clip = DoorsOpen;
			SoundFX.volume = DoorsOpenVolume;
			SoundFX.pitch = 1;
			SoundFX.Play ();
		}
	}

	void TargetBellSoundPlay(){
		foreach (GameObject elv in Elevators){
			if(elv.GetComponent<Elevator>().CurrentFloor == TargetFloor){
				TargetSoundFX = elv.GetComponent<Elevator> ().SoundFX;
				TargetSoundFX.clip = Bell;
				TargetSoundFX.loop = false;
				TargetSoundFX.volume = BellVolume;
				TargetSoundFX.pitch = 1;
				SoundFX.pitch = 1;
				TargetSoundFX.Play ();
				TextsUpdate ();
			}
		}
	}
		
	void BellSoundPlay(){
		SoundFX.clip = Bell;
		SoundFX.loop = false;
		SoundFX.volume = BellVolume;
		SoundFX.pitch = 1;
		SoundFX.Play ();
	}

	void TextsUpdate(){
		foreach (GameObject elv in Elevators) {
			TargetElvTextInside = elv.GetComponent<Elevator> ().TextInside;
			TargetElvTextOutside = elv.GetComponent<Elevator> ().TextOutside;
			TargetElvTextInside.text = ElevatorFloor.ToString();
			TargetElvTextOutside.text = ElevatorFloor.ToString();
		}
	}

	void ButtonsReset(){
		foreach (MeshRenderer MR in ElevatorNumericButtons) {
			MR.enabled = false;
		}
		if(ElevatorGoBtn != null){
			ElevatorGoBtn.enabled = false;
		}
	}

	void TargetElvOpening(){

		TextsUpdate ();

		TargetElvAnim [AnimName].normalizedTime = 0;
		TargetElvAnim [AnimName].speed = DoorsAnimSpeed;
		TargetElvAnim.Play ();
		ButtonsReset ();


		//isOpen = true;
	}

	void DoorsOpening(){
		TargetFloor = 0;
		TextsUpdate ();
		DoorsAnim [AnimName].normalizedTime = 0;
		DoorsAnim [AnimName].speed = DoorsAnimSpeed;
		DoorsAnim.Play ();
		ButtonsReset ();
	}
	void DoorsClosingTimer(){
		if(DoorsAnim[AnimName].speed > 0){
			Invoke ("DoorsClosing", CloseDelay);
			isOpen = true;
			Moving = false;
		}
	}
	void DoorsClosing(){
		if(isOpen){
			DoorsAnim [AnimName].normalizedTime = 1;
			DoorsAnim [AnimName].speed = -DoorsAnimSpeed;
			DoorsAnim.Play ();
			isOpen = false;
			if(ElevatorOpenButton != null){
				ElevatorOpenButton.enabled = false;
			}
	}
	}

	void OnTriggerEnter(Collider other){
		if(other.gameObject == Player.gameObject){
			inTrigger = true;
			if(isReflectionProbe){
				if(UpdateReflectionEveryFrame){
					probe.refreshMode = UnityEngine.Rendering.ReflectionProbeRefreshMode.EveryFrame;
					probe.RenderProbe ();
				}
			}
		}
	}
	void OnTriggerExit(Collider other){
		if(other.gameObject == Player.gameObject){
			inTrigger = false;
			if(isReflectionProbe){
				if(UpdateReflectionEveryFrame){
					probe.refreshMode = UnityEngine.Rendering.ReflectionProbeRefreshMode.OnAwake;
					probe.RenderProbe ();
				}
			}
		}
	}

}
