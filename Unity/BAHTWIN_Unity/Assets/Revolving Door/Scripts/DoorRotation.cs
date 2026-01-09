using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class DoorRotation : MonoBehaviour {
    public int Speed;
	// Use this for initialization
	void Start () {
		
	}
	
	// Update is called once per frame
	void Update () {
        transform.Rotate(0,Speed*Time.deltaTime,0);
	}
}
