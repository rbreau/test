// Real-clock day/night: sun, sky gradient, fog, ambient, bloom and exposure all follow the hour.
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
namespace Numera.World
{
    public class DayNightCycle : MonoBehaviour
    {
        public Light sun; public Material sky; public Volume volume; public Light[] nightLights;
        [Tooltip("-1 = use the real clock")] public float hourOverride = -1;
        Bloom _bloom; ColorAdjustments _grade; Color _skyTop, _skyMid, _skyBot;
        static Color Lerp(Color a, Color b, float t) => Color.Lerp(a, b, t);
        static Color Hex(string h) => ColorUtility.TryParseHtmlString(h, out var c) ? c : Color.magenta;
        public float Hour => hourOverride >= 0 ? hourOverride : (float)System.DateTime.Now.TimeOfDay.TotalHours;

        void Start() { if (volume && volume.profile) { volume.profile.TryGet(out _bloom); volume.profile.TryGet(out _grade); } if (sky) RenderSettings.skybox = sky; }
        void Update()
        {
            float h = Hour, elev = Mathf.Sin((h - 6f) / 12f * Mathf.PI);
            float day = Mathf.Clamp01(elev * 1.6f), dusk = Mathf.Clamp01(1 - Mathf.Abs(elev) * 3.5f), night = 1 - day;
            _skyTop = Lerp(Lerp(Hex("#0a0e23"), Hex("#3f8fe0"), day), Hex("#6a4fa8"), dusk * 0.5f);
            _skyMid = Lerp(Lerp(Hex("#151c40"), Hex("#a9d6f5"), day), Hex("#f2a25c"), dusk * 0.6f);
            _skyBot = Lerp(Lerp(Hex("#1b2450"), Hex("#d9ebf5"), day), Hex("#f7c98b"), dusk * 0.6f);
            if (sky) { sky.SetColor("_Top", _skyTop); sky.SetColor("_Mid", _skyMid); sky.SetColor("_Bottom", _skyBot); }
            RenderSettings.fog = true; RenderSettings.fogMode = FogMode.Linear; RenderSettings.fogStartDistance = 34; RenderSettings.fogEndDistance = 120; RenderSettings.fogColor = _skyBot;
            RenderSettings.ambientMode = AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = Lerp(Hex("#2a3468"), Hex("#dff0ff"), day) * (0.35f + 0.45f * day);
            RenderSettings.ambientEquatorColor = _skyMid * (0.3f + 0.4f * day);
            RenderSettings.ambientGroundColor = Lerp(Hex("#0d1230"), Hex("#6fa383"), day) * 0.5f;
            if (sun)
            {
                sun.color = Lerp(Lerp(Hex("#8ea2ff"), Hex("#fff3dd"), day), Hex("#ffb070"), dusk * 0.6f);
                sun.intensity = 0.25f + 1.3f * day;
                float az = (h - 6f) / 12f * 180f; // sweeps east → west
                sun.transform.rotation = Quaternion.Euler(Mathf.Lerp(18f, 62f, Mathf.Max(elev, 0.25f)), az - 90f + 30f, 0);
            }
            if (_bloom) { _bloom.intensity.value = 0.35f + 0.9f * night; _bloom.threshold.value = 1.05f - 0.25f * night; }
            if (_grade) { _grade.postExposure.value = -0.15f + 0.25f * day; _grade.saturation.value = 8f; }
            if (nightLights != null) foreach (var l in nightLights) if (l) l.intensity = l.range * 0.3f * (0.15f + 0.85f * night);
        }
    }
}
