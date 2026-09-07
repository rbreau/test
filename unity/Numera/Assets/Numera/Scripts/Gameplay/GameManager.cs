// Bootstraps data + state, owns screen routing between the 3D world and the UI Toolkit panels.
using System.Collections.Generic;
using System.Linq;
using Numera.Core;
using Numera.UI;
using Numera.World;
using UnityEngine;
using UnityEngine.InputSystem;

namespace Numera.Gameplay
{
    public class GameManager : MonoBehaviour
    {
        public static GameManager I { get; private set; }
        public AssetMap assetMap; public IslandView island; public MathfinderController player; public FollowCamera followCamera; public DayNightCycle dayNight; public UIController ui; public Camera worldCamera;
        public WorldData World; public GameState State; public Progression Prog; public Session Session; public int CurrentIsle;

        void Awake()
        {
            I = this; Application.targetFrameRate = 60;
            World = WorldData.Load(); State = GameState.Load(); Prog = new Progression(World, State);
            Prog.LeveledUp += lvl => { ui.LevelUpFX(lvl, World.LevelName(lvl)); player?.Celebrate(); };
            Prog.MedalEarned += m => ui.Toast($"{m.glyph} Medal struck: {m.name} · +10 ◈");
        }
        void Start()
        {
            ui.Init(this);
            if (island) island.map = assetMap;
            if (player) player.Setup(assetMap);
            if (followCamera && player) followCamera.target = player.transform;
            if (!State.introSeen) { ui.ShowScreen("title"); SetWorldVisible(false); }
            else { CurrentIsle = Prog.FrontierIsle(); ShowHome(); int due = Prog.DueSkills().Count(); if (due > 0) ui.Toast($"≈ The Echo Tide carries {due} echo{(due > 1 ? "es" : "")} today."); }
        }
        void Update()
        {
            // tap a beacon
            if (ui.ActiveScreen != "home" || worldCamera == null || ui.PointerOverUI) return;
            var ptr = Pointer.current; if (ptr == null || !ptr.press.wasPressedThisFrame) return;
            var ray = worldCamera.ScreenPointToRay(ptr.position.ReadValue());
            if (Physics.Raycast(ray, out var hit, 200f)) { var b = hit.collider.GetComponentInParent<Beacon>(); if (b) ui.ShowSkillModal(b.skillId); }
        }
        public void SetWorldVisible(bool on) { if (island) island.gameObject.SetActive(on); if (player) player.gameObject.SetActive(on); }

        public void Begin(string name)
        {
            State.name = string.IsNullOrWhiteSpace(name) ? "Wanderer" : name.Trim(); State.introSeen = true; State.Save();
            OpenIsle(Prog.FrontierIsle());
            ui.Toast($"Welcome, {State.name}. Follow Your Path — it always knows the next step.");
        }
        public void OpenIsle(int i)
        {
            CurrentIsle = i; var isle = World.islands[i];
            if (!State.seenIsles.Contains(isle.id)) { State.seenIsles.Add(isle.id); State.Save(); ui.Modal(isle.arc, isle.name, isle.lore + "\n\n<i>Earn crowns in each art: Bronze, Silver, Gold. Two crowns call an art’s Numen home; every art at two crowns restores the isle.</i>", ("Step Ashore", null)); }
            ShowHome();
        }
        public void ShowHome()
        {
            var isle = World.islands[CurrentIsle];
            var skills = isle.skills.Select(s => (s.id, s.name, State.Skill(s.id).crowns)).ToList();
            if (island) { island.Build(isle, CurrentIsle, skills); }
            if (player) player.ResetTo(new Vector3(0, 0, 2.2f), 180);
            SetWorldVisible(true);
            ui.RenderHome(CurrentIsle); ui.ShowScreen("home");
        }
        public void StartQuest(string skillId, int tier) { Session = Core.Session.Quest(Prog, skillId, tier); if (Session.Boost) ui.Toast("☄ Comet Boost burns — double XP this trial!"); ui.BeginSession(Session); }
        public void StartEcho() { Session = Core.Session.Echo(Prog); if (Session == null) return; ui.BeginSession(Session); }
        public void AbandonSession() { Session = null; ShowHome(); ui.Toast("Trial abandoned. The problems will wait."); }
        public void FinishSession()
        {
            var q = Session; Session = null;
            var outcome = Prog.ApplySession(q);
            ui.ShowResult(q, outcome, () =>
            {
                var steps = new Queue<System.Action<System.Action>>();
                foreach (var (skillId, star) in outcome.newNumen) { var sk = World.Skills[skillId].skill; steps.Enqueue(next => ui.Modal(star ? "Starform Ascension" : "A Numen Returns", sk.numenName, $"<i>“{sk.numenLore}”</i>\n\n{(star ? "Mastered in gold — its constellation blazes in your Numendex." : "The spirit of " + sk.name + " joins your lantern-light.")}", (star ? "Shine On" : "Welcome, friend", next))); }
                foreach (var isle in Prog.CollectNewRestores()) steps.Enqueue(next => ui.Modal("Isle Restored", isle.name, isle.restored + "\n\n<i>+50 lumins. The chains on the next isle loosen…</i>", ("Onward", next)));
                if (Prog.AllRestored() && !State.endingSeen) { State.endingSeen = true; State.lumins += 200; State.Save(); steps.Enqueue(next => ui.Modal("The Null, Unsolved", "Numera Shines Whole", World.islands[^1].restored + "\n\n<i>+200 lumins.</i>", ("✦", next))); }
                void Run() { if (steps.Count == 0) { Prog.CheckMedals(); if (q.Mode == SessionMode.Echo) { ui.RenderEcho(); ui.ShowScreen("echo"); } else { if (Prog.IsleRestored(CurrentIsle)) CurrentIsle = Prog.FrontierIsle(); ShowHome(); } return; } steps.Dequeue()(Run); }
                Run();
            });
        }
    }
}
