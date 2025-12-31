using TMPro;
using UnityEngine;
using System;

public class ClockUI : MonoBehaviour
{
    public TMP_Text timeText;

    void Update()
    {
        timeText.text = DateTime.Now.ToString("HH:mm");
    }
}
