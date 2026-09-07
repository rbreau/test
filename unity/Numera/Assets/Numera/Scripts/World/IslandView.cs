// Builds the current island: a grass plateau on a cliff, ring road with spokes and plazas, one
// beacon per art, the isle's landmark, trees/rocks/town blocks — from AssetMap prefabs when
// assigned, primitives otherwise. Placement is seeded per island so layouts are stable.
using System.Collections.Generic;
using Numera.Core;
using UnityEngine;

namespace Numera.World
{
    public class IslandView : MonoBehaviour
    {
        public const float IsleR = 9f, RingR = 5.2f, BeaconR = RingR + 1.4f;
        public AssetMap map; public readonly List<Beacon> beacons = new();
        System.Random _rng; Transform _root;
        float Rnd() => (float)_rng.NextDouble();

        Material Mat(Material fromMap, Color fallback)
        {
            if (fromMap) return fromMap;
            var sh = Shader.Find("Numera/Toon Lit") ?? Shader.Find("Universal Render Pipeline/Lit");
            var m = new Material(sh); m.SetColor("_BaseColor", fallback); return m;
        }
        GameObject Prim(PrimitiveType t, Vector3 pos, Vector3 scale, Material m, string name = null)
        {
            var g = GameObject.CreatePrimitive(t); g.name = name ?? t.ToString(); g.transform.SetParent(_root, false);
            g.transform.localPosition = pos; g.transform.localScale = scale; g.GetComponent<Renderer>().sharedMaterial = m;
            var c = g.GetComponent<Collider>(); if (c) Destroy(c); return g;
        }
        GameObject Spawn(GameObject prefab, Vector3 pos, float yaw, float scale = 1)
        {
            var g = Instantiate(prefab, _root); g.transform.localPosition = pos; g.transform.localRotation = Quaternion.Euler(0, yaw, 0); g.transform.localScale = Vector3.one * scale;
            if (map && map.applyToonToKit && map.toonOverride) foreach (var r in g.GetComponentsInChildren<Renderer>()) Retint(r);
            return g;
        }
        void Retint(Renderer r)
        {
            var mats = r.sharedMaterials;
            for (int i = 0; i < mats.Length; i++) { if (!mats[i] || mats[i].shader.name.StartsWith("Numera/")) continue; var m = new Material(map.toonOverride); if (mats[i].HasProperty("_BaseMap")) m.SetTexture("_BaseMap", mats[i].GetTexture("_BaseMap")); else if (mats[i].HasProperty("_MainTex")) m.SetTexture("_BaseMap", mats[i].GetTexture("_MainTex")); if (mats[i].HasProperty("_BaseColor")) m.SetColor("_BaseColor", mats[i].GetColor("_BaseColor")); else if (mats[i].HasProperty("_Color")) m.SetColor("_BaseColor", mats[i].GetColor("_Color")); mats[i] = m; }
            r.sharedMaterials = mats;
        }
        GameObject PickPrefab(GameObject[] arr) => arr != null && arr.Length > 0 ? arr[_rng.Next(arr.Length)] : null;

        public void Build(IslandDef isle, int index, IList<(string id, string name, int crowns)> skills)
        {
            if (_root) Destroy(_root.gameObject);
            _root = new GameObject("Isle_" + isle.id).transform; _root.SetParent(transform, false);
            beacons.Clear(); _rng = new System.Random(index * 2711 + 13);
            var tint = isle.Tint;

            // sea + plateau + cliff
            var sea = Prim(PrimitiveType.Plane, new Vector3(0, -0.55f, 0), new Vector3(34, 1, 34), Mat(map ? map.waterMaterial : null, new Color(0.3f, 0.65f, 0.8f)), "Sea");
            var grass = Mat(map ? map.groundMaterial : null, Color.Lerp(tint, new Color(0.5f, 0.81f, 0.62f), 0.72f));
            Prim(PrimitiveType.Cylinder, new Vector3(0, -0.25f, 0), new Vector3(IsleR * 2, 0.25f, IsleR * 2), grass, "Plateau");
            Prim(PrimitiveType.Cylinder, new Vector3(0, -1.3f, 0), new Vector3(IsleR * 2 + 0.8f, 0.8f, IsleR * 2 + 0.8f), Mat(map ? map.cliffMaterial : null, Color.Lerp(tint, new Color(0.42f, 0.35f, 0.29f), 0.7f)), "Cliff");
            for (int i = 0; i < 5; i++) { float a = Rnd() * Mathf.PI * 2, d = 34 + Rnd() * 22; Prim(PrimitiveType.Sphere, new Vector3(Mathf.Cos(a) * d, -1.2f, Mathf.Sin(a) * d), new Vector3(8 + Rnd() * 10, 2.4f + Rnd() * 1.2f, 8 + Rnd() * 10), Mat(null, new Color(0.62f, 0.83f, 0.75f)), "FarIsle"); }

            // roads: ring (segments), plazas, spokes with yellow edges
            var road = Mat(map ? map.roadMaterial : null, new Color(0.36f, 0.39f, 0.45f)); var edge = Mat(map ? map.roadEdgeMaterial : null, new Color(0.96f, 0.83f, 0.42f)); var stone = Mat(map ? map.plazaMaterial : null, new Color(0.88f, 0.9f, 0.92f));
            int segs = 48;
            for (int i = 0; i < segs; i++)
            {
                float a = i / (float)segs * Mathf.PI * 2, len = 2 * Mathf.PI * RingR / segs + 0.05f;
                var g = Prim(PrimitiveType.Cube, new Vector3(Mathf.Cos(a) * RingR, 0.012f, Mathf.Sin(a) * RingR), new Vector3(len, 0.02f, 0.7f), road, "Ring"); g.transform.localRotation = Quaternion.Euler(0, -a * Mathf.Rad2Deg, 0);
                foreach (var s in new[] { -1, 1 }) { float rr = RingR + s * 0.4f; var e = Prim(PrimitiveType.Cube, new Vector3(Mathf.Cos(a) * rr, 0.014f, Mathf.Sin(a) * rr), new Vector3(len * rr / RingR, 0.02f, 0.09f), edge, "RingEdge"); e.transform.localRotation = Quaternion.Euler(0, -a * Mathf.Rad2Deg, 0); }
            }
            Prim(PrimitiveType.Cylinder, new Vector3(0, 0.012f, 0), new Vector3(3, 0.01f, 3), stone, "Plaza");
            int n = skills.Count;
            for (int i = 0; i < n; i++)
            {
                float a = i / (float)n * Mathf.PI * 2 + Mathf.PI / n; var dir = new Vector3(Mathf.Cos(a), 0, Mathf.Sin(a));
                float len = RingR - 1.5f + 0.35f, mid = 1.5f + len / 2;
                var sp = Prim(PrimitiveType.Cube, dir * mid + Vector3.up * 0.011f, new Vector3(0.62f, 0.02f, len), road, "Spoke"); sp.transform.localRotation = Quaternion.Euler(0, 90 - a * Mathf.Rad2Deg, 0);
                foreach (var s in new[] { -1, 1 }) { var off = new Vector3(-dir.z, 0, dir.x) * s * 0.35f; var e = Prim(PrimitiveType.Cube, dir * mid + off + Vector3.up * 0.013f, new Vector3(0.08f, 0.02f, len), edge, "SpokeEdge"); e.transform.localRotation = sp.transform.localRotation; }
                var bp = dir * BeaconR;
                Prim(PrimitiveType.Cylinder, bp + Vector3.up * 0.012f, new Vector3(1.9f, 0.01f, 1.9f), stone, "BeaconPlaza");
                beacons.Add(BuildBeacon(skills[i], bp));
            }

            // landmark, town, trees, rocks
            var lm = LandmarkAnchor(n); var landmarkPrefab = map ? System.Array.Find(map.landmarks ?? new AssetMap.IsleLandmark[0], l => l.isleId == isle.id)?.prefab : null;
            if (landmarkPrefab) Spawn(landmarkPrefab, lm, -Mathf.Atan2(lm.z, lm.x) * Mathf.Rad2Deg + 90);
            else { var g = Prim(PrimitiveType.Cylinder, lm + Vector3.up * 1.2f, new Vector3(0.8f, 1.2f, 0.8f), Mat(null, tint), "Landmark_" + isle.id); g.name = "Landmark_" + isle.id; }
            for (int i = 0; i < 16; i++)
            {
                float a = Rnd() * Mathf.PI * 2, r = 6.9f + Rnd() * 1.6f; var pos = new Vector3(Mathf.Cos(a) * r, 0, Mathf.Sin(a) * r);
                var hp = map ? PickPrefab(map.houseBlockPrefabs) : null;
                if (hp) Spawn(hp, pos, Rnd() * 360);
                else { float h = 0.3f + Rnd() * 1.1f; var b = Prim(PrimitiveType.Cube, pos + Vector3.up * h / 2, new Vector3(0.5f + Rnd() * 0.9f, h, 0.5f + Rnd() * 0.9f), Mat(null, new Color(0.56f, 0.9f, 0.84f, 0.6f)), "Block"); b.transform.localRotation = Quaternion.Euler(0, Rnd() * 180, 0); }
            }
            for (int i = 0, tries = 0; i < 9 && tries < 60; tries++)
            {
                float a = Rnd() * Mathf.PI * 2, r = 2.6f + Rnd() * 1.9f; var pos = new Vector3(Mathf.Cos(a) * r, 0, Mathf.Sin(a) * r);
                if (Vector3.Distance(pos, lm) < 2.6f || OnRoad(pos, n)) continue;
                var tp = map ? PickPrefab(map.treePrefabs) : null;
                if (tp) Spawn(tp, pos, Rnd() * 360, 0.85f + Rnd() * 0.3f);
                else { float h = 0.7f + Rnd() * 0.4f; Prim(PrimitiveType.Cylinder, pos + Vector3.up * h / 2, new Vector3(0.12f, h / 2, 0.12f), Mat(null, new Color(0.42f, 0.29f, 0.18f)), "Trunk"); Prim(PrimitiveType.Sphere, pos + Vector3.up * (h + 0.25f), new Vector3(0.7f, 0.85f, 0.7f), Mat(null, Color.Lerp(tint, new Color(0.18f, 0.6f, 0.36f), 0.75f)), "Canopy"); }
                i++;
            }
            for (int i = 0; i < 6; i++) { float a = Rnd() * Mathf.PI * 2, r = 3 + Rnd() * 5; var pos = new Vector3(Mathf.Cos(a) * r, 0, Mathf.Sin(a) * r); if (OnRoad(pos, n) || Vector3.Distance(pos, lm) < 2.6f) continue; var rp = map ? PickPrefab(map.rockPrefabs) : null; if (rp) Spawn(rp, pos, Rnd() * 360, 0.6f + Rnd() * 0.5f); else Prim(PrimitiveType.Sphere, pos, new Vector3(0.5f, 0.35f, 0.4f) * (0.6f + Rnd()), Mat(null, new Color(0.43f, 0.42f, 0.47f)), "Rock"); }
        }

        Beacon BuildBeacon((string id, string name, int crowns) sk, Vector3 pos)
        {
            GameObject root;
            if (map && map.beaconPrefab) root = Spawn(map.beaconPrefab, pos, 0);
            else
            {
                root = new GameObject("Beacon_" + sk.id); root.transform.SetParent(_root, false); root.transform.localPosition = pos;
                var pillar = GameObject.CreatePrimitive(PrimitiveType.Cylinder); pillar.transform.SetParent(root.transform, false); pillar.transform.localPosition = new Vector3(0, 1.2f, 0); pillar.transform.localScale = new Vector3(0.4f, 1.2f, 0.4f); pillar.GetComponent<Renderer>().sharedMaterial = Mat(null, new Color(0.75f, 0.91f, 1f)); Destroy(pillar.GetComponent<Collider>());
                var disc = GameObject.CreatePrimitive(PrimitiveType.Cylinder); disc.transform.SetParent(root.transform, false); disc.transform.localPosition = new Vector3(0, 0.06f, 0); disc.transform.localScale = new Vector3(1.2f, 0.06f, 1.2f); Destroy(disc.GetComponent<Collider>());
                var gem = GameObject.CreatePrimitive(PrimitiveType.Cube); gem.transform.SetParent(root.transform, false); gem.transform.localPosition = new Vector3(0, 2.95f, 0); gem.transform.localScale = Vector3.one * 0.55f; gem.transform.localRotation = Quaternion.Euler(45, 0, 45); Destroy(gem.GetComponent<Collider>());
                var b = root.AddComponent<Beacon>(); b.gem = gem.transform; b.tinted = new[] { disc.GetComponent<Renderer>(), gem.GetComponent<Renderer>() };
                foreach (var r in b.tinted) r.sharedMaterial = Mat(null, Color.white);
            }
            var beacon = root.GetComponent<Beacon>() ?? root.AddComponent<Beacon>();
            beacon.skillId = sk.id; beacon.skillName = sk.name; beacon.crowns = sk.crowns; beacon.Apply();
            var col = root.GetComponent<Collider>() ?? root.AddComponent<CapsuleCollider>();
            if (col is CapsuleCollider cc) { cc.center = new Vector3(0, 1.8f, 0); cc.height = 3.8f; cc.radius = 0.7f; }
            return beacon;
        }
        public void RefreshBeacons(System.Func<string, int> crownsOf) { foreach (var b in beacons) { b.crowns = crownsOf(b.skillId); b.Apply(); } }

        static Vector3 LandmarkAnchor(int n)
        {
            float best = 0, bd = 9;
            for (int i = 0; i < n; i++) { float a = i / (float)n * Mathf.PI * 2; float d = Mathf.Abs(Mathf.DeltaAngle(a * Mathf.Rad2Deg, 270f)); if (d < bd) { bd = d; best = a; } }
            return new Vector3(Mathf.Cos(best) * 3.9f, 0, Mathf.Sin(best) * 3.9f);
        }
        static bool OnRoad(Vector3 p, int n)
        {
            float r = new Vector2(p.x, p.z).magnitude, th = Mathf.Atan2(p.z, p.x);
            if (r < 1.75f || Mathf.Abs(r - RingR) < 0.55f) return true;
            for (int i = 0; i < n; i++) { float a = i / (float)n * Mathf.PI * 2 + Mathf.PI / n; if (Vector2.Distance(new Vector2(p.x, p.z), new Vector2(Mathf.Cos(a), Mathf.Sin(a)) * BeaconR) < 1.1f) return true; float da = Mathf.DeltaAngle(th * Mathf.Rad2Deg, a * Mathf.Rad2Deg) * Mathf.Deg2Rad; if (Mathf.Cos(da) > 0 && r > 1.5f && r < RingR + 0.5f && Mathf.Abs(Mathf.Sin(da)) * r < 0.5f) return true; }
            return false;
        }
    }
}
