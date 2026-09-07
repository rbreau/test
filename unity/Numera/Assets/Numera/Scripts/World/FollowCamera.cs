// Low, behind-the-shoulder follow with a fixed compass heading (the Pokémon-Go framing).
using UnityEngine;
namespace Numera.World
{
    public class FollowCamera : MonoBehaviour
    {
        public Transform target; public float back = 6.6f, up = 3.7f, lookAhead = 2.2f, lookHeight = 1.1f, smooth = 2.5f;
        void LateUpdate()
        {
            if (!target) return;
            var cam = GetComponent<Camera>(); bool portrait = cam && cam.aspect < 1f;
            var want = target.position + new Vector3(0, portrait ? up + 0.7f : up, portrait ? back + 1.6f : back);
            transform.position = Vector3.Lerp(transform.position, want, 1 - Mathf.Exp(-smooth * Time.deltaTime));
            transform.LookAt(target.position + new Vector3(0, lookHeight, -lookAhead));
        }
    }
}
