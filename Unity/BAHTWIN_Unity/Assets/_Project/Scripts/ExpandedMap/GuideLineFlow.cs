using UnityEngine;

public class GuideLineFlow : MonoBehaviour
{
    public float flowSpeed = 0.8f;

    private LineRenderer lr;
    private Material mat;
    private Vector2 offset;

    void Awake()
    {
        lr = GetComponent<LineRenderer>();
        mat = lr.material;
    }

    void Update()
    {
        offset.x -= flowSpeed * Time.deltaTime;
        mat.mainTextureOffset = offset;
    }
}
