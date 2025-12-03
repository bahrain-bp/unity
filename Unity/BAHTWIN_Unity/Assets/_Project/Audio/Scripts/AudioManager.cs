using UnityEngine;
using UnityEngine.Audio;
using System.Collections;
using System.Collections.Generic;

public class AudioManager : MonoBehaviour
{
    public static AudioManager Instance { get; private set; }
    
    [Header("Audio Mixer")]
    [SerializeField] private AudioMixer audioMixer;
    [SerializeField] private AudioMixerGroup sfxMixerGroup;
    [SerializeField] private AudioMixerGroup musicMixerGroup;
    
    [Header("Audio Sources Pool")]
    [SerializeField] private int poolSize = 10;
    private Queue<AudioSource> audioSourcePool;
    private List<AudioSource> activeAudioSources;
    
    [Header("Music")]
    [SerializeField] private AudioSource musicSource1;
    [SerializeField] private AudioSource musicSource2;
    private AudioSource currentMusicSource;
    private AudioSource fadingMusicSource;
    
    [Header("Volume Settings")]
    [Range(0f, 1f)]
    [SerializeField] private float masterVolume = 1f;
    [Range(0f, 1f)]
    [SerializeField] private float sfxVolume = 1f;
    [Range(0f, 1f)]
    [SerializeField] private float musicVolume = 1f;
    
    [Header("Music Crossfade")]
    [SerializeField] private float crossfadeDuration = 1f;
    
    // Audio Mixer parameter names
    private const string MASTER_VOLUME_PARAM = "MasterVolume";
    private const string SFX_VOLUME_PARAM = "SFXVolume";
    private const string MUSIC_VOLUME_PARAM = "MusicVolume";
    
    private void Awake()
    {
        // Singleton pattern
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }
        
        Instance = this;
        DontDestroyOnLoad(gameObject);
        
        InitializeAudioSources();
        InitializePool();
        InitializeMixerVolumes();
    }
    
    private void InitializeAudioSources()
    {
        // Create music sources if they don't exist
        if (musicSource1 == null)
        {
            musicSource1 = gameObject.AddComponent<AudioSource>();
            musicSource1.playOnAwake = false;
            musicSource1.loop = true;
            musicSource1.spatialBlend = 0f; // 2D
            if (musicMixerGroup != null)
                musicSource1.outputAudioMixerGroup = musicMixerGroup;
        }
        
        if (musicSource2 == null)
        {
            musicSource2 = gameObject.AddComponent<AudioSource>();
            musicSource2.playOnAwake = false;
            musicSource2.loop = true;
            musicSource2.spatialBlend = 0f; // 2D
            if (musicMixerGroup != null)
                musicSource2.outputAudioMixerGroup = musicMixerGroup;
        }
        
        currentMusicSource = musicSource1;
    }
    
    private void InitializePool()
    {
        audioSourcePool = new Queue<AudioSource>();
        activeAudioSources = new List<AudioSource>();
        
        for (int i = 0; i < poolSize; i++)
        {
            CreateAudioSource();
        }
    }
    
    private void InitializeMixerVolumes()
    {
        if (audioMixer != null)
        {
            SetMasterVolume(masterVolume);
            SetSFXVolume(sfxVolume);
            SetMusicVolume(musicVolume);
        }
    }
    
    private AudioSource CreateAudioSource()
    {
        GameObject go = new GameObject($"PooledAudioSource_{audioSourcePool.Count}");
        go.transform.SetParent(transform);
        AudioSource source = go.AddComponent<AudioSource>();
        source.playOnAwake = false;
        
        // Assign to SFX mixer group
        if (sfxMixerGroup != null)
            source.outputAudioMixerGroup = sfxMixerGroup;
        
        audioSourcePool.Enqueue(source);
        return source;
    }
    
    private AudioSource GetAudioSource()
    {
        if (audioSourcePool.Count == 0)
        {
            CreateAudioSource();
        }
        
        AudioSource source = audioSourcePool.Dequeue();
        activeAudioSources.Add(source);
        return source;
    }
    
    private void ReturnAudioSource(AudioSource source)
    {
        activeAudioSources.Remove(source);
        source.Stop();
        source.clip = null;
        source.transform.position = Vector3.zero;
        audioSourcePool.Enqueue(source);
    }

    public AudioSource PlayLoopWithRandomStart(AudioData data, Transform parent = null)
    {
        if (data == null || data.clip == null) return null;

        AudioSource source = GetAudioSource();
        ConfigureAudioSource(source, data);

        source.loop = true;
        source.spatialBlend = 0f; // footsteps should be 2D for FPS
        source.time = Random.Range(0f, data.clip.length - 0.05f);

        if (parent)
        {
            source.transform.SetParent(parent);
            source.transform.localPosition = Vector3.zero;
        }

        source.Play();
        return source;
    }
    
    public void StopLoop(AudioSource source)
    {
        if (source == null) return;
        source.Stop();
        ReturnAudioSource(source);
    }


    
    // Play 2D Sound
    public void PlaySound2D(AudioData audioData)
    {
        if (audioData == null || audioData.clip == null) return;
        
        AudioSource source = GetAudioSource();
        ConfigureAudioSource(source, audioData);
        source.spatialBlend = 0f; // Force 2D
        source.Play();
        
        if (!audioData.loop)
        {
            StartCoroutine(ReturnToPoolAfterPlay(source, audioData.clip.length));
        }
    }
    
    // Play 3D Sound at position
    public void PlaySound3D(AudioData audioData, Vector3 position)
    {
        if (audioData == null || audioData.clip == null) return;
        
        AudioSource source = GetAudioSource();
        ConfigureAudioSource(source, audioData);
        source.transform.position = position;
        source.spatialBlend = 1f; // Force 3D
        source.Play();
        
        if (!audioData.loop)
        {
            StartCoroutine(ReturnToPoolAfterPlay(source, audioData.clip.length));
        }
    }
    
    // Play 3D Sound attached to transform
    public AudioSource PlaySound3D(AudioData audioData, Transform parent)
    {
        if (audioData == null || audioData.clip == null) return null;
        
        AudioSource source = GetAudioSource();
        ConfigureAudioSource(source, audioData);
        source.transform.SetParent(parent);
        source.transform.localPosition = Vector3.zero;
        source.spatialBlend = 1f; // Force 3D
        source.Play();
        
        if (!audioData.loop)
        {
            StartCoroutine(ReturnToPoolAfterPlay(source, audioData.clip.length, parent));
        }
        
        return source;
    }
    
    private void ConfigureAudioSource(AudioSource source, AudioData audioData)
    {
        source.clip = audioData.clip;
        source.loop = audioData.loop;
        source.spatialBlend = audioData.spatialBlend;
        source.minDistance = audioData.minDistance;
        source.maxDistance = audioData.maxDistance;
        source.rolloffMode = audioData.rolloffMode;
        
        // Apply volume
        float volume = audioData.volume;
        if (audioData.randomizeVolume)
        {
            volume += Random.Range(-audioData.volumeVariation, audioData.volumeVariation);
        }
        source.volume = volume * sfxVolume * masterVolume;
        
        // Apply pitch
        float pitch = audioData.pitch;
        if (audioData.randomizePitch)
        {
            pitch += Random.Range(-audioData.pitchVariation, audioData.pitchVariation);
        }
        source.pitch = pitch;
    }
    
    private IEnumerator ReturnToPoolAfterPlay(AudioSource source, float delay, Transform parent = null)
    {
        yield return new WaitForSeconds(delay);
        
        if (parent != null)
        {
            source.transform.SetParent(transform);
        }
        
        ReturnAudioSource(source);
    }
    
    // Music Management
    public void PlayMusic(AudioClip musicClip, bool crossfade = true)
    {
        if (musicClip == null) return;
        
        if (crossfade && currentMusicSource.isPlaying)
        {
            StartCoroutine(CrossfadeMusic(musicClip));
        }
        else
        {
            currentMusicSource.clip = musicClip;
            currentMusicSource.volume = musicVolume * masterVolume;
            currentMusicSource.Play();
        }
    }
    
    public void PlayMusic(AudioData audioData, bool crossfade = true)
    {
        if (audioData == null || audioData.clip == null) return;
        PlayMusic(audioData.clip, crossfade);
    }
    
    private IEnumerator CrossfadeMusic(AudioClip newClip)
    {
        fadingMusicSource = currentMusicSource;
        currentMusicSource = (currentMusicSource == musicSource1) ? musicSource2 : musicSource1;
        
        currentMusicSource.clip = newClip;
        currentMusicSource.volume = 0f;
        currentMusicSource.Play();
        
        float elapsed = 0f;
        float startVolume = fadingMusicSource.volume;
        
        while (elapsed < crossfadeDuration)
        {
            elapsed += Time.deltaTime;
            float t = elapsed / crossfadeDuration;
            
            fadingMusicSource.volume = Mathf.Lerp(startVolume, 0f, t);
            currentMusicSource.volume = Mathf.Lerp(0f, musicVolume * masterVolume, t);
            
            yield return null;
        }
        
        fadingMusicSource.Stop();
        fadingMusicSource.volume = 0f;
    }
    
    public void StopMusic(bool fadeOut = true)
    {
        if (fadeOut)
        {
            StartCoroutine(FadeOutMusic());
        }
        else
        {
            currentMusicSource.Stop();
        }
    }
    
    private IEnumerator FadeOutMusic()
    {
        float startVolume = currentMusicSource.volume;
        float elapsed = 0f;
        
        while (elapsed < crossfadeDuration)
        {
            elapsed += Time.deltaTime;
            currentMusicSource.volume = Mathf.Lerp(startVolume, 0f, elapsed / crossfadeDuration);
            yield return null;
        }
        
        currentMusicSource.Stop();
    }
    
    public void PauseMusic()
    {
        currentMusicSource.Pause();
    }
    
    public void ResumeMusic()
    {
        currentMusicSource.UnPause();
    }
    
    // Volume Controls (with Audio Mixer support)
    public void SetMasterVolume(float volume)
    {
        masterVolume = Mathf.Clamp01(volume);
        
        if (audioMixer != null)
        {
            // Convert 0-1 to decibels (-80 to 0)
            float db = volume > 0 ? 20f * Mathf.Log10(volume) : -80f;
            audioMixer.SetFloat(MASTER_VOLUME_PARAM, db);
        }
        else
        {
            UpdateAllVolumes();
        }
    }
    
    public void SetSFXVolume(float volume)
    {
        sfxVolume = Mathf.Clamp01(volume);
        
        if (audioMixer != null)
        {
            float db = volume > 0 ? 20f * Mathf.Log10(volume) : -80f;
            audioMixer.SetFloat(SFX_VOLUME_PARAM, db);
        }
        else
        {
            UpdateSFXVolumes();
        }
    }
    
    public void SetMusicVolume(float volume)
    {
        musicVolume = Mathf.Clamp01(volume);
        
        if (audioMixer != null)
        {
            float db = volume > 0 ? 20f * Mathf.Log10(volume) : -80f;
            audioMixer.SetFloat(MUSIC_VOLUME_PARAM, db);
        }
        else
        {
            UpdateMusicVolume();
        }
    }
    
    private void UpdateAllVolumes()
    {
        UpdateSFXVolumes();
        UpdateMusicVolume();
    }
    
    private void UpdateSFXVolumes()
    {
        foreach (var source in activeAudioSources)
        {
            if (source.isPlaying)
            {
                source.volume = source.volume / (sfxVolume * masterVolume) * sfxVolume * masterVolume;
            }
        }
    }
    
    private void UpdateMusicVolume()
    {
        musicSource1.volume = musicVolume * masterVolume;
        musicSource2.volume = musicVolume * masterVolume;
    }
    
    // Utility Methods
    public void StopAllSounds()
    {
        foreach (var source in activeAudioSources)
        {
            source.Stop();
        }
    }
    
    public void PauseAllSounds()
    {
        foreach (var source in activeAudioSources)
        {
            source.Pause();
        }
    }
    
    public void ResumeAllSounds()
    {
        foreach (var source in activeAudioSources)
        {
            source.UnPause();
        }
    }
    
    // Getters
    public float GetMasterVolume() => masterVolume;
    public float GetSFXVolume() => sfxVolume;
    public float GetMusicVolume() => musicVolume;
}