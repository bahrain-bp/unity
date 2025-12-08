using UnityEngine;

[CreateAssetMenu(fileName = "AudioData", menuName = "Scriptable Objects/AudioData")]

public class AudioData : ScriptableObject
{
    [Header("Audio Clip")]
    public AudioClip clip;
    
    [Header("Settings")]
    [Range(0f, 1f)]
    public float volume = 1f;
    
    [Range(0.1f, 3f)]
    public float pitch = 1f;
    
    [Range(0f, 1f)]
    public float spatialBlend = 0f; // 0 = 2D, 1 = 3D
    
    public bool loop = false;
    
    [Header("3D Sound Settings")]
    [Range(0f, 100f)]
    public float minDistance = 1f;
    
    [Range(0f, 500f)]
    public float maxDistance = 50f;
    
    public AudioRolloffMode rolloffMode = AudioRolloffMode.Logarithmic;
    
    [Header("Randomization (Optional)")]
    public bool randomizePitch = false;
    
    [Range(0f, 0.5f)]
    public float pitchVariation = 0.1f;
    
    public bool randomizeVolume = false;
    
    [Range(0f, 0.3f)]
    public float volumeVariation = 0.1f;
}
