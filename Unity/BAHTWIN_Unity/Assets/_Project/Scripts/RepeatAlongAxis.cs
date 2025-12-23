using UnityEngine;

#if UNITY_EDITOR
using UnityEditor;
#endif

public class RepeatAlongAxis : MonoBehaviour
{
    [Header("Source")]
    public Transform prefabToRepeat;        // drag slat (preferably a prefab)
    public bool useSourceRotation = true;

    [Header("Layout")]
    [Min(1)] public int count = 20;
    public Axis axis = Axis.Z;
    public float spacing = 0.35f;           // beam width + gap (tweak)
    public bool centerOnParent = false;     // if true, distributes around parent center

    [Header("Cleanup")]
    public bool clearChildrenBeforeGenerate = true;
    public string generatedPrefix = "Slat_";

    public enum Axis { X, Y, Z }

#if UNITY_EDITOR
    [ContextMenu("Generate")]
    public void Generate()
    {
        if (prefabToRepeat == null)
        {
            Debug.LogError("Assign Prefab To Repeat first.");
            return;
        }

        Undo.RegisterFullObjectHierarchyUndo(gameObject, "Generate Repeats");

        if (clearChildrenBeforeGenerate)
            ClearChildren();

        Vector3 dir = axis switch
        {
            Axis.X => Vector3.right,
            Axis.Y => Vector3.up,
            _ => Vector3.forward
        };

        float startOffset = 0f;
        if (centerOnParent && count > 1)
            startOffset = -((count - 1) * spacing) * 0.5f;

        Quaternion rot = useSourceRotation ? prefabToRepeat.rotation : transform.rotation;

        for (int i = 0; i < count; i++)
        {
            float offset = startOffset + (i * spacing);
            Vector3 pos = transform.position + dir * offset;

            Transform instance = (Transform)PrefabUtility.InstantiatePrefab(prefabToRepeat);
            if (instance == null)
            {
                // Fallback if it's not a prefab in project
                instance = Instantiate(prefabToRepeat);
            }

            instance.name = $"{generatedPrefix}{i:00}";
            instance.position = pos;
            instance.rotation = rot;
            instance.SetParent(transform, true);
        }
    }

    [ContextMenu("Clear Children")]
    public void ClearChildren()
    {
        Undo.RegisterFullObjectHierarchyUndo(gameObject, "Clear Repeats");

        for (int i = transform.childCount - 1; i >= 0; i--)
        {
            var child = transform.GetChild(i);
            if (child != null)
                Undo.DestroyObjectImmediate(child.gameObject);
        }
    }

    [CustomEditor(typeof(RepeatAlongAxis))]
    public class RepeatAlongAxisEditor : Editor
    {
        public override void OnInspectorGUI()
        {
            DrawDefaultInspector();

            var gen = (RepeatAlongAxis)target;

            GUILayout.Space(8);
            if (GUILayout.Button("Generate"))
                gen.Generate();

            if (GUILayout.Button("Clear Children"))
                gen.ClearChildren();
        }
    }
#endif
}
