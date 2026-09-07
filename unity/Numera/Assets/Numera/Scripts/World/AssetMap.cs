// Drag store assets (Synty, Kenney, Quaternius, Mixamo…) in here; the world builds from them.
// Anything left empty falls back to a primitive placeholder so the game always runs.
using System;
using UnityEngine;

namespace Numera.World
{
    [CreateAssetMenu(menuName = "Numera/Asset Map", fileName = "AssetMap")]
    public class AssetMap : ScriptableObject
    {
        [Header("Character (rigged humanoid)")]
        public GameObject characterPrefab;
        public AnimationClip idleClip, walkClip, celebrateClip;
        public RuntimeAnimatorController animatorController; // built by Numera → Build Animator

        [Header("Environment kit")]
        public GameObject[] treePrefabs, rockPrefabs, bushPrefabs, propPrefabs;
        public GameObject beaconPrefab;        // an art's shrine; leave empty for the built-in pillar
        public GameObject[] houseBlockPrefabs; // the "sleeping town" around the rim

        [Serializable] public class IsleLandmark { public string isleId; public GameObject prefab; }
        public IsleLandmark[] landmarks;       // one hero prop per island (lighthouse, temple…)

        [Header("Materials")]
        public Material groundMaterial, cliffMaterial, roadMaterial, roadEdgeMaterial, plazaMaterial, waterMaterial, skyMaterial, toonOverride;
        public bool applyToonToKit = true;     // swap kit materials to Numera/Toon Lit at spawn
    }
}
