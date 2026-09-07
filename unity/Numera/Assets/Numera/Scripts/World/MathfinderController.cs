// The player's avatar: wanders the isle between waypoints, faces its heading, drives the Animator.
using UnityEngine;
namespace Numera.World
{
    public class MathfinderController : MonoBehaviour
    {
        public float wanderRadius = 5.6f, walkSpeed = 1.35f, turnLerp = 8f;
        public Animator animator; public Light lantern;
        Vector3 _target; float _pauseUntil, _speed; bool _hasTarget; GameObject _model;
        static readonly int SpeedHash = Animator.StringToHash("Speed"), CelebrateHash = Animator.StringToHash("Celebrate");

        public void Setup(AssetMap map)
        {
            if (_model) Destroy(_model);
            if (map && map.characterPrefab)
            {
                _model = Instantiate(map.characterPrefab, transform);
                _model.transform.localPosition = Vector3.zero; _model.transform.localRotation = Quaternion.identity;
                animator = _model.GetComponentInChildren<Animator>() ?? _model.AddComponent<Animator>();
                if (map.animatorController) animator.runtimeAnimatorController = map.animatorController;
                animator.applyRootMotion = false;
                if (map.applyToonToKit && map.toonOverride) foreach (var r in _model.GetComponentsInChildren<Renderer>()) Retint(r, map.toonOverride);
            }
            else
            {   // placeholder: a capsule with a "head" so the camera has something to follow
                _model = new GameObject("Placeholder");
                _model.transform.SetParent(transform, false);
                var body = GameObject.CreatePrimitive(PrimitiveType.Capsule); body.transform.SetParent(_model.transform, false); body.transform.localPosition = new Vector3(0, 0.9f, 0); body.transform.localScale = new Vector3(0.6f, 0.9f, 0.6f);
                var head = GameObject.CreatePrimitive(PrimitiveType.Sphere); head.transform.SetParent(_model.transform, false); head.transform.localPosition = new Vector3(0, 1.75f, 0); head.transform.localScale = Vector3.one * 0.45f;
                foreach (var c in _model.GetComponentsInChildren<Collider>()) Destroy(c);
                body.GetComponent<Renderer>().material.color = new Color(0.96f, 0.95f, 0.93f); head.GetComponent<Renderer>().material.color = new Color(0.95f, 0.81f, 0.68f);
                animator = null;
            }
            if (!lantern)
            {
                var l = new GameObject("Lantern").AddComponent<Light>(); l.transform.SetParent(transform, false); l.transform.localPosition = new Vector3(0.35f, 0.95f, 0.2f);
                l.type = LightType.Point; l.color = new Color(0.95f, 0.76f, 0.31f); l.range = 4; l.intensity = 0.8f; lantern = l;
            }
            _pauseUntil = Time.time + 1f; _hasTarget = false;
        }
        static void Retint(Renderer r, Material toon)
        {
            var mats = r.sharedMaterials;
            for (int i = 0; i < mats.Length; i++) { if (!mats[i]) continue; var m = new Material(toon); if (mats[i].HasProperty("_BaseMap")) m.SetTexture("_BaseMap", mats[i].GetTexture("_BaseMap")); else if (mats[i].HasProperty("_MainTex")) m.SetTexture("_BaseMap", mats[i].GetTexture("_MainTex")); if (mats[i].HasProperty("_BaseColor")) m.SetColor("_BaseColor", mats[i].GetColor("_BaseColor")); else if (mats[i].HasProperty("_Color")) m.SetColor("_BaseColor", mats[i].GetColor("_Color")); mats[i] = m; }
            r.sharedMaterials = mats;
        }
        public void ResetTo(Vector3 pos, float yaw) { transform.position = pos; transform.rotation = Quaternion.Euler(0, yaw, 0); _hasTarget = false; _pauseUntil = Time.time + 0.9f; _speed = 0; }
        public void Celebrate() { if (animator) animator.SetTrigger(CelebrateHash); }

        Vector3 PickTarget()
        {
            for (int i = 0; i < 10; i++) { var a = Random.value * Mathf.PI * 2; var r = 1f + Random.value * wanderRadius; var p = new Vector3(Mathf.Cos(a) * r, 0, Mathf.Sin(a) * r); if ((p - transform.position).magnitude > 2.2f) return p; }
            return Vector3.zero;
        }
        void Update()
        {
            if (_hasTarget)
            {
                var d = _target - transform.position; d.y = 0; float dist = d.magnitude;
                if (dist < 0.1f) { _hasTarget = false; _pauseUntil = Time.time + 1.5f + Random.value * 3f; }
                else
                {
                    _speed = Mathf.Min(1, _speed + 1.8f * Time.deltaTime);
                    transform.position += d.normalized * walkSpeed * _speed * Time.deltaTime;
                    transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.LookRotation(d.normalized), turnLerp * Time.deltaTime);
                }
            }
            else { _speed = Mathf.Max(0, _speed - 3f * Time.deltaTime); if (Time.time > _pauseUntil) { _target = PickTarget(); _hasTarget = true; } }
            if (animator) animator.SetFloat(SpeedHash, _speed);
            if (lantern) lantern.intensity = 0.8f * (1 + Mathf.Sin(Time.time * 3.2f) * 0.1f);
        }
    }
}
