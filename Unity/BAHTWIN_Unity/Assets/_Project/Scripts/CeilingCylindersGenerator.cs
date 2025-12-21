using UnityEngine;

#if UNITY_EDITOR
using UnityEditor;
#endif

[ExecuteAlways]
public class CeilingCylindersGenerator : MonoBehaviour
{
    [Header("Prefab")]
    public GameObject cylinderPrefab;

    [Header("Shared Material")]
    public Material sharedMaterial;

    [Header("Grid Size")]
    [Min(1)] public int rows = 48;
    [Min(1)] public int columns = 14;

    [Header("Spacing")]
    [Min(0f)] public float rowSpacing = 0.18f;
    [Min(0f)] public float colSpacing = 0.18f;

    [Header("Directions")]
    public Vector3 rowDirection = Vector3.right;
    public Vector3 colDirection = Vector3.forward;

    [Header("Color Pattern")]
    [Min(1)] public int rowsPerColor = 6;

    [Tooltip("Colors in order (maroon → olive). Extra rows will continue in reverse (ping-pong).")]
    public Color[] colors = new Color[8];

    [Header("Shader Color Property")]
    public string colorProperty = "_BaseColor";

    private MaterialPropertyBlock _mpb;

    [ContextMenu("Rebuild Cylinders")]
    public void Rebuild()
    {
        if (cylinderPrefab == null)
        {
            Debug.LogWarning("CeilingCylindersGenerator: cylinderPrefab is not assigned.");
            return;
        }
        if (sharedMaterial == null)
        {
            Debug.LogWarning("CeilingCylindersGenerator: sharedMaterial is not assigned.");
            return;
        }
        if (colors == null || colors.Length == 0)
        {
            Debug.LogWarning("CeilingCylindersGenerator: colors array is empty.");
            return;
        }

        ClearChildren();
        if (_mpb == null) _mpb = new MaterialPropertyBlock();

        Vector3 rDir = rowDirection.sqrMagnitude > 0.0001f ? rowDirection.normalized : Vector3.right;
        Vector3 cDir = colDirection.sqrMagnitude > 0.0001f ? colDirection.normalized : Vector3.forward;

        int n = colors.Length;

        Quaternion spawnRot = transform.rotation * cylinderPrefab.transform.rotation;

        for (int r = 0; r < rows; r++)
        {
            // Each band = rowsPerColor rows
            int band = r / rowsPerColor;

            // Ping-pong across colors: 0..n-1..1..0..n-1...
            int colorIndex = PingPongIndex(band, n);
            Color rowColor = colors[colorIndex];

            for (int c = 0; c < columns; c++)
            {
                GameObject go;

#if UNITY_EDITOR
                if (!Application.isPlaying)
                    go = (GameObject)PrefabUtility.InstantiatePrefab(cylinderPrefab, transform);
                else
                    go = Instantiate(cylinderPrefab, transform);
#else
                go = Instantiate(cylinderPrefab, transform);
#endif

                go.name = $"Cyl_{r:00}_{c:00}";
                go.transform.position = transform.position + rDir * (r * rowSpacing) + cDir * (c * colSpacing);

                go.transform.rotation = spawnRot;

                var rend = go.GetComponentInChildren<Renderer>();
                if (rend != null)
                {
                    rend.sharedMaterial = sharedMaterial;

                    _mpb.Clear();
                    _mpb.SetColor(colorProperty, rowColor);
                    rend.SetPropertyBlock(_mpb);
                }
            }
        }
    }

    private static int PingPongIndex(int band, int n)
    {
        if (n <= 1) return 0;

        int period = (n * 2) - 2;      
        int m = band % period;         
        return (m < n) ? m : period - m;
    }

    [ContextMenu("Clear Generated")]
    public void ClearChildren()
    {
        for (int i = transform.childCount - 1; i >= 0; i--)
        {
            var child = transform.GetChild(i).gameObject;
            if (Application.isPlaying) Destroy(child);
            else DestroyImmediate(child);
        }
    }
}
