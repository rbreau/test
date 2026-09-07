// One-click project setup: render pipeline, scene, animator, toon materials. Menu: Numera → …
#if UNITY_EDITOR
using System.IO;
using System.Linq;
using Numera.Gameplay;
using Numera.UI;
using Numera.World;
using UnityEditor;
using UnityEditor.Animations;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using UnityEngine.SceneManagement;
using UnityEngine.UIElements;

namespace Numera.EditorTools
{
    public static class NumeraSetup
    {
        const string Settings = "Assets/Numera/Settings";
        static T LoadOrCreate<T>(string path, System.Func<T> make) where T : Object
        {
            var a = AssetDatabase.LoadAssetAtPath<T>(path); if (a) return a;
            Directory.CreateDirectory(Path.GetDirectoryName(path)); a = make(); AssetDatabase.CreateAsset(a, path); return a;
        }

        [MenuItem("Numera/1 · Setup Render Pipeline (URP + post-processing)")]
        public static void SetupPipeline()
        {
            Directory.CreateDirectory(Settings);
            var rendererData = LoadOrCreate($"{Settings}/NumeraRenderer.asset", () =>
            {
                var rd = ScriptableObject.CreateInstance<UniversalRendererData>();
                rd.postProcessData = AssetDatabase.LoadAssetAtPath<PostProcessData>("Packages/com.unity.render-pipelines.universal/Runtime/Data/PostProcessData.asset");
                return rd;
            });
            var pipeline = LoadOrCreate($"{Settings}/NumeraURP.asset", () => UniversalRenderPipelineAsset.Create(rendererData));
            pipeline.supportsHDR = true; pipeline.shadowDistance = 60; pipeline.msaaSampleCount = 4; pipeline.colorGradingMode = ColorGradingMode.HighDynamicRange;
            GraphicsSettings.defaultRenderPipeline = pipeline; QualitySettings.renderPipeline = pipeline;
            EditorUtility.SetDirty(pipeline); AssetDatabase.SaveAssets();
            Debug.Log("Numera: URP assigned with post-processing data.");
        }

        [MenuItem("Numera/2 · Build Scene")]
        public static void BuildScene()
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            Directory.CreateDirectory(Settings); Directory.CreateDirectory("Assets/Numera/Scenes");

            var map = LoadOrCreate($"{Settings}/AssetMap.asset", () => ScriptableObject.CreateInstance<AssetMap>());
            var toon = LoadOrCreate($"{Settings}/Mat_Toon.mat", () => new Material(Shader.Find("Numera/Toon Lit")));
            var water = LoadOrCreate($"{Settings}/Mat_Water.mat", () => new Material(Shader.Find("Numera/Water")));
            var sky = LoadOrCreate($"{Settings}/Mat_Sky.mat", () => new Material(Shader.Find("Numera/Sky Gradient")));
            if (!map.toonOverride) map.toonOverride = toon; if (!map.waterMaterial) map.waterMaterial = water; if (!map.skyMaterial) map.skyMaterial = sky; EditorUtility.SetDirty(map);

            // post volume
            var profile = LoadOrCreate($"{Settings}/NumeraVolume.asset", () =>
            {
                var p = ScriptableObject.CreateInstance<VolumeProfile>();
                var bloom = p.Add<Bloom>(true); bloom.intensity.Override(0.45f); bloom.threshold.Override(1.0f); bloom.scatter.Override(0.65f);
                var vig = p.Add<Vignette>(true); vig.intensity.Override(0.28f); vig.smoothness.Override(0.5f);
                var tm = p.Add<Tonemapping>(true); tm.mode.Override(TonemappingMode.ACES);
                var ca = p.Add<ColorAdjustments>(true); ca.saturation.Override(8f); ca.postExposure.Override(0.1f);
                return p;
            });
            var volumeGo = new GameObject("Global Volume"); var vol = volumeGo.AddComponent<Volume>(); vol.isGlobal = true; vol.profile = profile;

            // light + day/night
            var sunGo = new GameObject("Sun"); var sun = sunGo.AddComponent<Light>(); sun.type = LightType.Directional; sun.shadows = LightShadows.Soft; sun.intensity = 1.4f; sunGo.transform.rotation = Quaternion.Euler(50, -30, 0);
            var dn = sunGo.AddComponent<DayNightCycle>(); dn.sun = sun; dn.sky = sky; dn.volume = vol; RenderSettings.skybox = sky;

            // camera
            var camGo = new GameObject("Main Camera"); camGo.tag = "MainCamera"; var cam = camGo.AddComponent<Camera>(); cam.fieldOfView = 50; cam.nearClipPlane = 0.1f; cam.farClipPlane = 400;
            camGo.transform.position = new Vector3(0, 3.7f, 8.8f); camGo.transform.LookAt(new Vector3(0, 1.1f, 0));
            var camData = camGo.AddComponent<UniversalAdditionalCameraData>(); camData.renderPostProcessing = true; camData.antialiasing = AntialiasingMode.FastApproximateAntialiasing;
            camGo.AddComponent<AudioListener>(); var follow = camGo.AddComponent<FollowCamera>();

            // world + player
            var islandGo = new GameObject("Island"); var island = islandGo.AddComponent<IslandView>(); island.map = map;
            var playerGo = new GameObject("Mathfinder"); var player = playerGo.AddComponent<MathfinderController>(); playerGo.transform.position = new Vector3(0, 0, 2.2f); follow.target = playerGo.transform;

            // UI
            var panel = LoadOrCreate($"{Settings}/NumeraPanel.asset", () =>
            {
                var ps = ScriptableObject.CreateInstance<PanelSettings>();
                ps.scaleMode = PanelScaleMode.ScaleWithScreenSize; ps.referenceResolution = new Vector2Int(1170, 2532); ps.match = 0.5f;
                ps.themeStyleSheet = AssetDatabase.LoadAssetAtPath<ThemeStyleSheet>("Assets/Numera/UI/NumeraTheme.tss");
                return ps;
            });
            var uiGo = new GameObject("UI"); var doc = uiGo.AddComponent<UIDocument>(); doc.panelSettings = panel; doc.visualTreeAsset = AssetDatabase.LoadAssetAtPath<VisualTreeAsset>("Assets/Numera/UI/Numera.uxml");
            var ui = uiGo.AddComponent<UIController>(); ui.doc = doc; ui.worldCamera = cam;
            var es = new GameObject("EventSystem"); es.AddComponent<UnityEngine.EventSystems.EventSystem>(); es.AddComponent<UnityEngine.InputSystem.UI.InputSystemUIInputModule>();

            // manager
            var gmGo = new GameObject("Numera"); var gm = gmGo.AddComponent<GameManager>();
            gm.assetMap = map; gm.island = island; gm.player = player; gm.followCamera = follow; gm.dayNight = dn; gm.ui = ui; gm.worldCamera = cam;

            const string scenePath = "Assets/Numera/Scenes/Numera.unity";
            EditorSceneManager.SaveScene(scene, scenePath);
            if (!EditorBuildSettings.scenes.Any(s => s.path == scenePath)) EditorBuildSettings.scenes = EditorBuildSettings.scenes.Concat(new[] { new EditorBuildSettingsScene(scenePath, true) }).ToArray();
            AssetDatabase.SaveAssets(); Selection.activeObject = map;
            Debug.Log("Numera: scene built. Fill in Assets/Numera/Settings/AssetMap.asset with your character and kit, then run Numera → Build Animator.");
        }

        [MenuItem("Numera/3 · Build Animator From Asset Map")]
        public static void BuildAnimator()
        {
            var map = AssetDatabase.LoadAssetAtPath<AssetMap>($"{Settings}/AssetMap.asset");
            if (!map || !map.idleClip || !map.walkClip) { EditorUtility.DisplayDialog("Numera", "Assign Idle and Walk clips in Assets/Numera/Settings/AssetMap.asset first (Mixamo clips work).", "OK"); return; }
            var path = $"{Settings}/MathfinderAnimator.controller";
            AssetDatabase.DeleteAsset(path);
            var ctrl = AnimatorController.CreateAnimatorControllerAtPath(path);
            ctrl.AddParameter("Speed", AnimatorControllerParameterType.Float); ctrl.AddParameter("Celebrate", AnimatorControllerParameterType.Trigger);
            var sm = ctrl.layers[0].stateMachine;
            var move = ctrl.CreateBlendTreeInController("Locomotion", out var tree);
            tree.blendType = BlendTreeType.Simple1D; tree.blendParameter = "Speed";
            tree.AddChild(map.idleClip, 0f); tree.AddChild(map.walkClip, 1f);
            sm.defaultState = move;
            if (map.celebrateClip)
            {
                var cel = sm.AddState("Celebrate"); cel.motion = map.celebrateClip;
                var t = sm.AddAnyStateTransition(cel); t.AddCondition(AnimatorConditionMode.If, 0, "Celebrate"); t.duration = 0.15f; t.canTransitionToSelf = false;
                var back = cel.AddTransition(move); back.hasExitTime = true; back.exitTime = 0.95f; back.duration = 0.2f;
            }
            map.animatorController = ctrl; EditorUtility.SetDirty(map); AssetDatabase.SaveAssets();
            Debug.Log("Numera: animator built and assigned to the Asset Map.");
        }

        [MenuItem("Numera/4 · Convert Selected Materials To Toon")]
        public static void ConvertToToon()
        {
            var toon = Shader.Find("Numera/Toon Lit"); int n = 0;
            foreach (var obj in Selection.objects)
            {
                foreach (var mat in AssetDatabase.LoadAllAssetsAtPath(AssetDatabase.GetAssetPath(obj)).OfType<Material>().Concat(obj as Material ? new[] { (Material)obj } : new Material[0]))
                {
                    if (mat.shader == toon) continue;
                    var tex = mat.HasProperty("_BaseMap") ? mat.GetTexture("_BaseMap") : mat.HasProperty("_MainTex") ? mat.GetTexture("_MainTex") : null;
                    var col = mat.HasProperty("_BaseColor") ? mat.GetColor("_BaseColor") : mat.HasProperty("_Color") ? mat.GetColor("_Color") : Color.white;
                    mat.shader = toon; if (tex) mat.SetTexture("_BaseMap", tex); mat.SetColor("_BaseColor", col); EditorUtility.SetDirty(mat); n++;
                }
            }
            AssetDatabase.SaveAssets(); Debug.Log($"Numera: converted {n} material(s) to Toon Lit.");
        }
    }
}
#endif
