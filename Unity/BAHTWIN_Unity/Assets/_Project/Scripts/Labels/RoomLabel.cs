using UnityEngine;
using TMPro;

public class RoomLabel : MonoBehaviour
{
    public RoomSO roomData;
    public TextMeshPro textMesh;

    private void OnValidate()
    {
        UpdateLabel();
    }

    public void UpdateLabel()
    {
        if (roomData != null && textMesh != null)
        {
            textMesh.text = $"{roomData.roomName}\n" + $"(02.{roomData.roomNumber})";
        }
    }
}