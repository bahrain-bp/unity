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
    [SerializeField] private AudioMixerGroup ambienceMixerGroup;

    [Header("Audio Sources Pool (Initial Size Only)")]
    [SerializeField] private int poolSize = 10; // NOT a limit anymore

    private Queue<AudioSource> audioSourcePool;
    private List<AudioSource> activeAudioSources;

    [Header("Music Sources (2 internal channels)")]
    [SerializeField] private AudioSource musicSource1;
    [SerializeField] private AudioSource musicSource2;
    private AudioSource currentMusicSource;
    private AudioSource fadingMusicSource;

    [Header("Music Tracks")]
    [SerializeField] private AudioData backgroundMusic1;
    [SerializeField] private AudioData backgroundMusic2;
    [SerializeField] private bool autoSwitchBetweenTwoTracks = true;
    [SerializeField] private float gapBetweenTracks = 0f;

    private Coroutine musicRoutine;

    [Header("Volume Settings")]
    [Range(0f, 1f)] [SerializeField] private float masterVolume = 1f;
    [Range(0f, 1f)] [SerializeField] private float sfxVolume = 1f;
    [Range(0f, 1f)] [SerializeField] private float musicVolume = 1f;
    [Range(0f, 1f)] [SerializeField] private float ambienceVolume = 1f;

    [Header("Music Crossfade")]
    [SerializeField] private float crossfadeDuration = 1f;

    // Audio Mixer parameter names (MUST match exposed params in your mixer)
    private const string MASTER_VOLUME_PARAM = "MasterVolume";
    private const string SFX_VOLUME_PARAM = "SFXVolume";
    private const string MUSIC_VOLUME_PARAM = "MusicVolume";
    private const string AMBIENCE_VOLUME_PARAM = "AmbienceVolume";

    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }

        Instance = this;
        DontDestroyOnLoad(gameObject);

        InitializeMusicSources();
        InitializePool();
        InitializeMixerVolumes();

        StartBackgroundMusic();
    }

    // ============================================================
    // INIT
    // ============================================================

    private void InitializeMusicSources()
    {
        // Create music sources if missing
        if (musicSource1 == null)
        {
            musicSource1 = gameObject.AddComponent<AudioSource>();
            musicSource1.playOnAwake = false;
            musicSource1.loop = false;
            musicSource1.spatialBlend = 0f; // 2D
            if (musicMixerGroup != null) musicSource1.outputAudioMixerGroup = musicMixerGroup;
        }

        if (musicSource2 == null)
        {
            musicSource2 = gameObject.AddComponent<AudioSource>();
            musicSource2.playOnAwake = false;
            musicSource2.loop = false;
            musicSource2.spatialBlend = 0f; // 2D
            if (musicMixerGroup != null) musicSource2.outputAudioMixerGroup = musicMixerGroup;
        }

        currentMusicSource = musicSource1;
        fadingMusicSource = musicSource2;
    }

    private void InitializePool()
    {
        audioSourcePool = new Queue<AudioSource>();
        activeAudioSources = new List<AudioSource>();

        for (int i = 0; i < poolSize; i++)
            CreateAudioSource();
    }

    private void InitializeMixerVolumes()
    {
        if (audioMixer != null)
        {
            SetMasterVolume(masterVolume);
            SetSFXVolume(sfxVolume);
            SetMusicVolume(musicVolume);
            SetAmbienceVolume(ambienceVolume);
        }
    }

    // ============================================================
    // POOL (kept as you requested)
    // ============================================================

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
        // No limit now: if empty, create a new one
        if (audioSourcePool.Count == 0)
            CreateAudioSource();

        AudioSource source = audioSourcePool.Dequeue();
        activeAudioSources.Add(source);
        return source;
    }

    private void ReturnAudioSource(AudioSource source)
    {
        if (source == null) return;

        activeAudioSources.Remove(source);

        source.Stop();

        // Only touch time if a real clip exists
        if (source.clip != null)
            source.time = 0f;

        source.loop = false;
        source.clip = null;

        source.transform.SetParent(transform);
        source.transform.localPosition = Vector3.zero;

        if (sfxMixerGroup != null)
            source.outputAudioMixerGroup = sfxMixerGroup;

        audioSourcePool.Enqueue(source);
    }


    public AudioSource PlayLoopWithRandomStart(AudioData data, Transform parent = null)
    {
        if (data == null || data.clip == null) return null;

        AudioSource source = GetAudioSource();
        ConfigureAudioSource(source, data);

        source.loop = true;
        source.spatialBlend = 0f;
        source.time = Random.Range(0f, Mathf.Max(0.05f, data.clip.length - 0.05f));

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

    public IEnumerator FadeIn(AudioSource source, float duration, float targetVolume)
    {
        if (source == null) yield break;

        float t = 0f;
        float start = 0f;

        while (t < duration)
        {
            t += Time.deltaTime;
            source.volume = Mathf.Lerp(start, targetVolume, t / duration);
            yield return null;
        }
    }

    public IEnumerator FadeOutAndStop(AudioSource source, float duration)
    {
        if (source == null) yield break;

        float t = 0f;
        float start = source.volume;

        while (t < duration)
        {
            t += Time.deltaTime;
            source.volume = Mathf.Lerp(start, 0f, t / duration);
            yield return null;
        }

        StopLoop(source);
    }

    // ============================================================
    // SFX
    // ============================================================

    public void PlaySound2D(AudioData audioData)
    {
        if (audioData == null || audioData.clip == null) return;

        AudioSource source = GetAudioSource();
        ConfigureAudioSource(source, audioData);
        source.spatialBlend = 0f;
        source.Play();

        if (!audioData.loop)
            StartCoroutine(ReturnToPoolAfterPlay(source, audioData.clip.length));
    }

    public void PlaySound3D(AudioData audioData, Vector3 position)
    {
        if (audioData == null || audioData.clip == null) return;

        AudioSource source = GetAudioSource();
        ConfigureAudioSource(source, audioData);
        source.transform.position = position;
        source.spatialBlend = 1f;
        source.Play();

        if (!audioData.loop)
            StartCoroutine(ReturnToPoolAfterPlay(source, audioData.clip.length));
    }

    public AudioSource PlaySound3D(AudioData audioData, Transform parent)
    {
        if (audioData == null || audioData.clip == null) return null;

        AudioSource source = GetAudioSource();
        ConfigureAudioSource(source, audioData);
        source.transform.SetParent(parent);
        source.transform.localPosition = Vector3.zero;
        source.spatialBlend = 1f;
        source.Play();

        if (!audioData.loop)
            StartCoroutine(ReturnToPoolAfterPlay(source, audioData.clip.length, parent));

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

        float vol = audioData.volume;
        if (audioData.randomizeVolume)
            vol += Random.Range(-audioData.volumeVariation, audioData.volumeVariation);

        // If using mixer params, mixer handles master/sfx scaling
        source.volume = (audioMixer != null) ? vol : vol * sfxVolume * masterVolume;

        float pitch = audioData.pitch;
        if (audioData.randomizePitch)
            pitch += Random.Range(-audioData.pitchVariation, audioData.pitchVariation);

        source.pitch = pitch;

        if (sfxMixerGroup != null)
            source.outputAudioMixerGroup = sfxMixerGroup;
    }

    private IEnumerator ReturnToPoolAfterPlay(AudioSource source, float delay, Transform parent = null)
    {
        yield return new WaitForSeconds(delay);

        if (parent != null)
            source.transform.SetParent(transform);

        ReturnAudioSource(source);
    }

    // ============================================================
    // MUSIC (auto alternate 1 <-> 2)
    // ============================================================

    public void StartBackgroundMusic()
    {
        if (!autoSwitchBetweenTwoTracks) return;
        if (backgroundMusic1 == null || backgroundMusic1.clip == null) return;
        if (backgroundMusic2 == null || backgroundMusic2.clip == null) return;

        if (musicRoutine != null) StopCoroutine(musicRoutine);
        musicRoutine = StartCoroutine(BackgroundMusicRoutine());
    }

    private IEnumerator BackgroundMusicRoutine()
    {
        AudioData current = backgroundMusic1;

        while (true)
        {
            // swap channels
            fadingMusicSource = currentMusicSource;
            currentMusicSource = (currentMusicSource == musicSource1) ? musicSource2 : musicSource1;

            ConfigureMusicSource(currentMusicSource, current);

            currentMusicSource.volume = 0f;
            currentMusicSource.Play();

            float baseVol = Mathf.Clamp01(current.volume);
            float targetVol = (audioMixer != null)
                ? baseVol
                : baseVol * musicVolume * masterVolume;


            float t = 0f;
            float startVol = (fadingMusicSource != null) ? fadingMusicSource.volume : 0f;

            while (t < crossfadeDuration)
            {
                t += Time.deltaTime;
                float k = t / crossfadeDuration;

                if (fadingMusicSource != null)
                    fadingMusicSource.volume = Mathf.Lerp(startVol, 0f, k);

                currentMusicSource.volume = Mathf.Lerp(0f, targetVol, k);
                yield return null;
            }

            if (fadingMusicSource != null)
            {
                fadingMusicSource.Stop();
                fadingMusicSource.volume = 0f;
            }

            float waitTime = Mathf.Max(0.1f, current.clip.length - crossfadeDuration);
            yield return new WaitForSeconds(waitTime);

            if (gapBetweenTracks > 0f)
                yield return new WaitForSeconds(gapBetweenTracks);

            current = (current == backgroundMusic1) ? backgroundMusic2 : backgroundMusic1;
        }
    }

    private void ConfigureMusicSource(AudioSource source, AudioData data)
    {
        source.clip = data.clip;
        source.loop = false;
        source.spatialBlend = 0f;
        source.playOnAwake = false;

        if (musicMixerGroup != null)
            source.outputAudioMixerGroup = musicMixerGroup;

        float baseVol = Mathf.Clamp01(data.volume);

        source.volume = (audioMixer != null)
            ? baseVol
            : baseVol * musicVolume * masterVolume;

        source.pitch = (data.pitch <= 0f) ? 1f : data.pitch;
    }

    // ============================================================
    // VOLUMES
    // ============================================================

    public void SetMasterVolume(float volume)
    {
        masterVolume = Mathf.Clamp01(volume);
        ApplyMixer(MASTER_VOLUME_PARAM, masterVolume);
    }

    public void SetSFXVolume(float volume)
    {
        sfxVolume = Mathf.Clamp01(volume);
        ApplyMixer(SFX_VOLUME_PARAM, sfxVolume);
    }

    public void SetMusicVolume(float volume)
    {
        musicVolume = Mathf.Clamp01(volume);
        ApplyMixer(MUSIC_VOLUME_PARAM, musicVolume);

        // If no mixer, update currently playing music immediately
        if (audioMixer == null)
        {
            if (musicSource1) musicSource1.volume = musicVolume * masterVolume;
            if (musicSource2) musicSource2.volume = musicVolume * masterVolume;
        }
    }

    public void SetAmbienceVolume(float volume)
    {
        ambienceVolume = Mathf.Clamp01(volume);
        ApplyMixer(AMBIENCE_VOLUME_PARAM, ambienceVolume);
    }

    private void ApplyMixer(string param, float linear01)
    {
        if (audioMixer == null) return;

        float db = (linear01 <= 0.0001f) ? -80f : 20f * Mathf.Log10(linear01);
        audioMixer.SetFloat(param, db);
    }

    public float GetMasterVolume() => masterVolume;
    public float GetSFXVolume() => sfxVolume;
    public float GetMusicVolume() => musicVolume;
    public float GetAmbienceVolume() => ambienceVolume;

    // For ambience scripts
    public AudioMixerGroup GetAmbienceMixerGroup() => ambienceMixerGroup;
}
