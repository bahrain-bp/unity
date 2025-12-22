using UnityEngine;

#if UNITY_EDITOR
using UnityEditor;
#endif

public class BlueRodsGridSpawnerSimple : MonoBehaviour
{
    [Header("Prefab (plain Cylinder is OK)")]
    public Transform cylinderPrefab;

    [Header("Grid")]
    [Min(1)] public int rows = 18;          // X direction
    [Min(1)] public int columns = 40;       // Z direction
    public float spacingX = 0.20f;
    public float spacingZ = 0.20f;
    public bool centerOnParent = true;

    [Header("Height")]
    public Vector2 heightRange = new Vector2(0.7f, 1.7f); // world-ish size
    public float thickness = 0.03f;                       // X,Z scale of cylinder

    [Header("Where rods start")]
    public float ceilingY = 3.0f; // set this to your ceiling height
    public float extraDownOffset = 0f; // small tweak if needed

    [Header("Optional gaps")]
    [Range(0f, 1f)] public float skipChance = 0.05f;
    public int seed = 12345;

    [Header("Cleanup")]
    public bool clearChildrenBeforeGenerate = true;
    public string generatedPrefix = "Rod_";

#if UNITY_EDITOR
    [ContextMenu("Generate")]
    public void Generate()
    {
        if (!cylinderPrefab)
        {
            Debug.LogError("Assign cylinderPrefab first.");
            return;
        }

        Undo.RegisterFullObjectHierarchyUndo(gameObject, "Generate Blue Rods");

        if (clearChildrenBeforeGenerate)
            ClearChildren();

        Random.InitState(seed);

        float startX = 0f;
        float startZ = 0f;

        if (centerOnParent)
        {
            startX = -((rows - 1) * spacingX) * 0.5f;
            startZ = -((columns - 1) * spacingZ) * 0.5f;
        }

        int index = 0;

        for (int r = 0; r < rows; r++)
        {
            for (int c = 0; c < columns; c++)
            {
                if (skipChance > 0f && Random.value < skipChance)
                    continue;

                float h = Random.Range(heightRange.x, heightRange.y);

                // Base grid position (in parent's local XZ)
                Vector3 local = new Vector3(startX + r * spacingX, 0f, startZ + c * spacingZ);
                Vector3 worldBase = transform.TransformPoint(local);

                // Spawn
                Transform rod = (Transform)PrefabUtility.InstantiatePrefab(cylinderPrefab);
                if (!rod) rod = Instantiate(cylinderPrefab);

                rod.name = $"{generatedPrefix}{index:0000}";
                rod.SetParent(transform, true); // parent it while keeping world transform :contentReference[oaicite:1]{index=1}

                // Scale cylinder: Y is "half-height" visually in Unity cylinders, so we set localScale.y = h / 2
                // Unity's built-in cylinder is 2 units tall by default (from -1 to +1), so scale.y = desiredHeight / 2
                rod.localScale = new Vector3(thickness, h / 2f, thickness);

                // Place it so TOP touches the ceiling: center must be at ceilingY - (h/2)
                float centerY = ceilingY - (h * 0.5f) - extraDownOffset;

                rod.position = new Vector3(worldBase.x, centerY, worldBase.z);
                rod.rotation = Quaternion.identity;

                index++;
            }
        }
    }

    [ContextMenu("Clear Children")]
    public void ClearChildren()
    {
        Undo.RegisterFullObjectHierarchyUndo(gameObject, "Clear Blue Rods");

        for (int i = transform.childCount - 1; i >= 0; i--)
        {
            var child = transform.GetChild(i);
            if (child != null)
                Undo.DestroyObjectImmediate(child.gameObject);
        }
    }

    [CustomEditor(typeof(BlueRodsGridSpawnerSimple))]
    public class BlueRodsGridSpawnerSimpleEditor : Editor
    {
        public override void OnInspectorGUI()
        {
            DrawDefaultInspector();
            var gen = (BlueRodsGridSpawnerSimple)target;

            GUILayout.Space(8);
            if (GUILayout.Button("Generate")) gen.Generate();
            if (GUILayout.Button("Clear Children")) gen.ClearChildren();
        }
    }
#endif
}
