using UnityEngine;
namespace Numera.World
{
    /// A tappable shrine for one art. GameManager raycasts for these.
    public class Beacon : MonoBehaviour
    {
        public string skillId, skillName; public int crowns; public Transform gem, halo;
        public Renderer[] tinted;
        static readonly Color[] StateColor = { new(0.95f, 0.76f, 0.31f), new(0.55f, 0.49f, 0.96f), new(0.27f, 0.84f, 0.71f), Color.white };
        public Color Tint => StateColor[Mathf.Min(3, crowns)];
        public void Apply()
        {
            foreach (var r in tinted) if (r) { var m = r.material; m.color = Tint; if (m.HasProperty("_EmissionColor")) { m.EnableKeyword("_EMISSION"); m.SetColor("_EmissionColor", Tint * 1.2f); } if (m.HasProperty("_Emission")) m.SetColor("_Emission", Tint * 0.8f); }
        }
        void Update()
        {
            float s = Time.time;
            if (gem) { gem.Rotate(0, 40 * Time.deltaTime, 0); gem.localPosition = new Vector3(0, 2.95f + Mathf.Sin(s * 1.4f + transform.position.x) * 0.1f, 0); }
            if (halo) { halo.Rotate(0, 0, 30 * Time.deltaTime); halo.localScale = Vector3.one * (1 + Mathf.Sin(s * 2f) * 0.06f); }
        }
    }
}
