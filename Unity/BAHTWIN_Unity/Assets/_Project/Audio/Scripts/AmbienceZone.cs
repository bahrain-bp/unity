using UnityEngine;

[RequireComponent(typeof(AudioSource))]
public class AmbienceZone : MonoBehaviour
{
    [Header("Player")]
    [SerializeField] private Transform player; // assign, or auto-find by tag

    [Header("Distance Range (live tweak)")]
    [Min(0f)] public float minRange = 5f;   // too close => fade down
    [Min(0f)] public float maxRange = 10f;  // too far  => fade down

    [Header("Fade")]
    [Min(0.01f)] public float fadeSpeed = 3f; // higher = faster

    [Header("Volume")]
    [Range(0f, 1f)] public float maxVolume = 1f;

    [Header("Optional: Inside Room Trigger")]
    public bool fadeDownWhenInsideTrigger = true;
    private int insideCount = 0;

    private AudioSource src;

    void Awake()
    {
        src = GetComponent<AudioSource>();
        src.playOnAwake = false;
        src.loop = true;
        src.spatialBlend = 1f; // 3D
        src.volume = 0f;
    }

    void Start()
    {
        if (player == null)
        {
            var p = GameObject.FindGameObjectWithTag("Player");
            if (p) player = p.transform;
        }

        if (!src.isPlaying)
            src.Play();
    }

    void Update()
    {
        if (player == null) return;

        float target = 0f;

        bool insideRoom = fadeDownWhenInsideTrigger && insideCount > 0;
        if (!insideRoom)
        {
            float d = Vector3.Distance(player.position, transform.position);

            // Only audible when BETWEEN min and max
            if (d >= minRange && d <= maxRange)
            {
                // Make it stronger near the middle of the band
                float mid = (minRange + maxRange) * 0.5f;
                float half = (maxRange - minRange) * 0.5f;

                // 1 at mid, 0 at edges
                float bandStrength = 1f - Mathf.Clamp01(Mathf.Abs(d - mid) / Mathf.Max(0.001f, half));
                target = bandStrength * maxVolume;
            }
        }

        src.volume = Mathf.MoveTowards(src.volume, target, fadeSpeed * Time.deltaTime);

        // Optional: stop the clip when fully silent (saves a tiny bit)
        if (src.volume <= 0.001f && src.isPlaying)
            src.Pause();
        else if (src.volume > 0.001f && !src.isPlaying)
            src.UnPause();
    }

    // Put this script ALSO on a trigger volume collider (or on the same object)
    private void OnTriggerEnter(Collider other)
    {
        if (!fadeDownWhenInsideTrigger) return;
        if (other.CompareTag("Player")) insideCount++;
    }

    private void OnTriggerExit(Collider other)
    {
        if (!fadeDownWhenInsideTrigger) return;
        if (other.CompareTag("Player")) insideCount = Mathf.Max(0, insideCount - 1);
    }
}
