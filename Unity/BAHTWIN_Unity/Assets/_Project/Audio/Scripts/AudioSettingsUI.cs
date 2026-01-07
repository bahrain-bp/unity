using UnityEngine;
using UnityEngine.UI;

public class AudioSettingsUI : MonoBehaviour
{
    [Header("Sliders (0 – 100)")]
    public Slider masterSlider;
    public Slider sfxSlider;
    public Slider musicSlider;
    public Slider ambienceSlider;

    private void Start()
    {
        if (AudioManager.Instance == null) return;

        // Ensure sliders are 0–100
        InitSlider(masterSlider);
        InitSlider(sfxSlider);
        InitSlider(musicSlider);
        InitSlider(ambienceSlider);

        // Sync UI FROM AudioManager (0–1 ➜ 0–100)
        if (masterSlider) masterSlider.value = AudioManager.Instance.GetMasterVolume() * 100f;
        if (sfxSlider) sfxSlider.value = AudioManager.Instance.GetSFXVolume() * 100f;
        if (musicSlider) musicSlider.value = AudioManager.Instance.GetMusicVolume() * 100f;
        if (ambienceSlider) ambienceSlider.value = AudioManager.Instance.GetAmbienceVolume() * 100f;

        // Hook slider changes (0–100 ➜ 0–1)
        if (masterSlider)
            masterSlider.onValueChanged.AddListener(v =>
                AudioManager.Instance.SetMasterVolume(v / 100f));

        if (sfxSlider)
            sfxSlider.onValueChanged.AddListener(v =>
                AudioManager.Instance.SetSFXVolume(v / 100f));

        if (musicSlider)
            musicSlider.onValueChanged.AddListener(v =>
                AudioManager.Instance.SetMusicVolume(v / 100f));

        if (ambienceSlider)
            ambienceSlider.onValueChanged.AddListener(v =>
                AudioManager.Instance.SetAmbienceVolume(v / 100f));
    }

    private void InitSlider(Slider s)
    {
        if (!s) return;
        s.minValue = 0f;
        s.maxValue = 100f;
        s.wholeNumbers = false;
    }
}
