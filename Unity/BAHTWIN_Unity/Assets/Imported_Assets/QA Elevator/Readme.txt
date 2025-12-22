Hi!
Thank you for purchase!

Here's a step by step guide:

New moving elevator system (released in v2.0):

1. Create an empty gameobject in your scene and call it, for example, Elevator Shaft 01;
2. Drag & drop the Elevator prefab into your scene from the QA Elevator/Prefabs/ElevatorMoving/ folder and make it child of the empty object created at step 1;
3. Type your player's tag into the "Player tag" field (it's set to "Player" by default);
4. Drag & drop the Elevator_outsideDoors prefab into your scene from the QA Elevator/Prefabs/ElevatorMoving/ folder and make it child of the empty object created at step 1;
5. Duplicate this Elevator_outsideDoors for every floor where you need the elevator to move.
6. Set the Floor property for every Elevator_outsideDoors.

If you need more elevator shafts, simply duplicate the already created shaft with all the Elevator_outsideDoors and the Elevator and place it where you want in your scene.


Legacy (teleporting system):

1. Drag & drop the Elevator prefab into your scene from the QA Elevator/Prefabs/ folder;

2. Copy the Elevator few times and set the "Current Floor" property to appropriate floor;

3. Type your player's tag into the "Player tag" field (it's set to "Player" by default);

4. If you need more than one elevator shafts in the scene, you have to create an empty gameobject for the each group of elevators (shaft), and put elevators inside these empty objects (parent them). You can add the ElevatorManager.cs script to these parent empty objects to be able to set a random floor at start or set the floor manually.

To learn more about other properties in the Elevator inspector, simply move your mouse cursor on property names and you will see hints.


If you want to achieve the same visuals as on screenshots and video, check the Color Space settings in Player Settings, it should be set to Linear. Also check the Render Path settings in Graphics Settings, it should be set to Deferred.
Use free Unity 'Post Processing Stack' camera effects from the Package Manager and the adjusted profile for that, which can be founded in the QA Elevator/DemoScene/ folder.

Thanks!