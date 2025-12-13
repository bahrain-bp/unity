using TMPro;
using UnityEngine;
using UnityEngine.UI;

public class VolumeSilder : MonoBehaviour
{
    [SerializeField] private Slider _slider;
    [SerializeField] private TextMeshProUGUI _sliderText;

    void Start()
    {
        _slider.onValueChanged.AddListener((v) =>
        {
            _sliderText.text = v.ToString("0");
        });
    }
    

    public float GetVoulme(float slider)
    {
        return slider;
    }
    
}
