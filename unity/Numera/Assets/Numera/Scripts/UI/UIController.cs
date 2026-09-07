// Binds the UI Toolkit document to the game: screens, HUD, the quest loop, modals, toasts, level-up.
using System;
using System.Collections.Generic;
using System.Linq;
using Numera.Core;
using Numera.Gameplay;
using UnityEngine;
using UnityEngine.UIElements;

namespace Numera.UI
{
    public class UIController : MonoBehaviour
    {
        public UIDocument doc; public Camera worldCamera;
        GameManager gm; VisualElement root; readonly Dictionary<string, VisualElement> screens = new();
        public string ActiveScreen { get; private set; } = "";
        Session q; readonly List<VisualElement> labelPool = new();

        VisualElement Q(string name) => root.Q(name);
        Label L(string name) => root.Q<Label>(name);
        Button B(string name) => root.Q<Button>(name);
        static void Show(VisualElement e, bool on) => e.style.display = on ? DisplayStyle.Flex : DisplayStyle.None;

        public bool PointerOverUI
        {
            get
            {
                if (root?.panel == null) return false;
                var pos = UnityEngine.InputSystem.Pointer.current?.position.ReadValue() ?? Vector2.zero;
                var p = RuntimePanelUtils.ScreenToPanel(root.panel, new Vector2(pos.x, Screen.height - pos.y));
                var el = root.panel.Pick(p); return el != null && el != root;
            }
        }

        public void Init(GameManager manager)
        {
            gm = manager; root = doc.rootVisualElement.Q("root");
            foreach (var n in new[] { "title", "home", "quest", "map", "echo", "dex", "medals" }) screens[n] = Q("screen-" + n);
            foreach (var n in new[] { "home", "map", "echo", "dex", "medals" }) { var b = B("nav-" + n); b.clicked += () => Nav(n); }
            B("nav-shop").clicked += OpenShop;
            B("beginBtn").clicked += () => gm.Begin(root.Q<TextField>("nameInput").value);
            B("setSail").clicked += () => Nav("map");
            B("guideBtn").clicked += RunGuide;
            B("qQuit").clicked += () => { q = null; gm.AbandonSession(); };
            B("qSubmit").clicked += () => Submit(-1);
            B("qNext").clicked += NextQuestion;
            B("qHint").clicked += UseHint;
            B("echoStart").clicked += () => gm.StartEcho();
            B("lfBtn").clicked += () => Show(Q("levelfx"), false);
            root.Q<TextField>("qInput").RegisterCallback<KeyDownEvent>(e => { if (e.keyCode == KeyCode.Return || e.keyCode == KeyCode.KeypadEnter) { if (q != null && q.Answered) NextQuestion(); else Submit(-1); } });
            Show(Q("modal"), false); Show(Q("levelfx"), false); Show(Q("hud"), false);
            RenderHud();
        }

        // ---------- routing
        public void ShowScreen(string name)
        {
            ActiveScreen = name;
            foreach (var kv in screens) Show(kv.Value, kv.Key == name);
            Show(Q("hud"), name != "title");
            foreach (var n in new[] { "home", "map", "echo", "dex", "medals" }) B("nav-" + n).EnableInClassList("active", n == name);
            RenderHud();
        }
        void Nav(string n)
        {
            if (q != null) { q = null; gm.Session = null; Toast("Trial abandoned. The problems will wait."); }
            gm.SetWorldVisible(n == "home");
            if (n == "home") { gm.ShowHome(); return; }
            if (n == "map") RenderMap(); if (n == "echo") RenderEcho(); if (n == "dex") RenderDex(); if (n == "medals") RenderMedals();
            ShowScreen(n);
        }
        public void RenderHud()
        {
            var S = gm.State; if (S == null) return;
            L("lvlOrb").text = S.level.ToString(); L("lvlName").text = gm.World.LevelName(S.level);
            int need = WorldData.XpNeed(S.level); L("xpText").text = $"{S.xp} / {need} XP"; Q("xpFill").style.width = Length.Percent(Mathf.Min(100, 100f * S.xp / need));
            L("lumins").text = $"◈ {S.lumins}"; L("streak").text = $"✹ {S.streak}";
            int due = gm.Prog.DueSkills().Count(); B("nav-echo").text = due > 0 ? $"Echo Tide ({due})" : "Echo Tide";
            // progressive disclosure
            Show(B("nav-echo"), gm.World.Skills.Keys.Any(id => S.Skill(id).crowns >= 1));
            Show(B("nav-dex"), S.numen.Count > 0); Show(B("nav-medals"), S.medals.Count > 0); Show(B("nav-shop"), S.lumins >= 30 || S.level >= 3);
        }

        // ---------- home
        Progression.Guide guide;
        public void RenderHome(int isleIndex)
        {
            var isle = gm.World.islands[isleIndex];
            guide = gm.Prog.ComputeGuide();
            L("guideTitle").text = guide.title; L("guideSub").text = guide.sub; B("guideBtn").text = guide.label + " ▸";
            int crowns = isle.skills.Sum(s => gm.State.Skill(s.id).crowns);
            L("ioArc").text = isle.arc.ToUpper(); L("ioName").text = isle.name;
            L("ioCrowns").text = $"{crowns} / {isle.skills.Length * 3} crowns" + (gm.Prog.IsleRestored(isleIndex) ? "  ·  ✦ restored" : "");
        }
        void RunGuide()
        {
            if (guide == null) return;
            if (guide.isEcho) { Nav("echo"); return; }
            if (guide.skillId != null) { gm.CurrentIsle = guide.isleIndex; gm.StartQuest(guide.skillId, guide.tier); }
        }
        void LateUpdate()
        {
            // beacon name chips tracking the 3D beacons
            var wrap = Q("isleLabels"); if (wrap == null || ActiveScreen != "home" || gm?.island == null || worldCamera == null) { if (wrap != null) wrap.Clear(); return; }
            var beacons = gm.island.beacons;
            while (labelPool.Count < beacons.Count) { var b = new Button { text = "" }; b.AddToClassList("isle-label"); labelPool.Add(b); }
            if (wrap.childCount != beacons.Count) { wrap.Clear(); for (int i = 0; i < beacons.Count; i++) wrap.Add(labelPool[i]); }
            for (int i = 0; i < beacons.Count; i++)
            {
                var b = beacons[i]; var el = (Button)labelPool[i];
                el.text = b.skillName + (b.crowns > 0 ? "  " + new string('♛', b.crowns) : "");
                var id = b.skillId; el.clickable = new Clickable(() => ShowSkillModal(id));
                var world = b.transform.position + Vector3.up * 3.75f; var vp = worldCamera.WorldToViewportPoint(world);
                bool visible = vp.z > 0 && vp.x > -0.02f && vp.x < 1.02f && vp.y > -0.02f && vp.y < 1.02f;
                el.style.display = visible ? DisplayStyle.Flex : DisplayStyle.None;
                if (!visible) continue;
                var p = RuntimePanelUtils.CameraTransformWorldToPanel(root.panel, world, worldCamera);
                el.style.left = p.x; el.style.top = p.y;
            }
        }
        public void ShowSkillModal(string id)
        {
            var (sk, isle, _) = gm.World.Skills[id]; var st = gm.State.Skill(id); int caught = gm.State.NumenForm(id);
            string acc = st.attempts > 0 ? $"{Mathf.RoundToInt(100f * st.correct / st.attempts)}% lifetime accuracy" : "untried";
            string numen = caught == 2 ? $"<color=#45d6b5>✦ {sk.numenName} shines here in starform.</color>" : caught == 1 ? $"<color=#45d6b5>✦ {sk.numenName} walks with you.</color>" : "<color=#8b7cf6>✧ A Numen stirs here — reach two crowns to call it home.</color>";
            Modal(isle.name, $"{sk.name}  <color=#f2c14e>{new string('♛', st.crowns)}</color>", $"{sk.desc} · {acc}\n\n{numen}", ("Not yet", null));
            var custom = Q("mCustom"); custom.Clear();
            for (int t = 1; t <= 3; t++)
            {
                bool open = t <= st.crowns + 1, done = t <= st.crowns; int tier = t;
                var b = new Button { text = (done ? "✓ " : "▸ ") + gm.World.tierNames[t] }; b.AddToClassList("btn-ghost"); b.AddToClassList("tierbtn"); if (!done && t == st.crowns + 1) b.AddToClassList("rec");
                b.SetEnabled(open); b.clicked += () => { Show(Q("modal"), false); gm.StartQuest(id, tier); };
                custom.Add(b);
            }
        }

        // ---------- quest loop
        public void BeginSession(Session s) { q = s; gm.SetWorldVisible(true); ShowScreen("quest"); NextQuestion(); }
        void NextQuestion()
        {
            if (q == null) return;
            string tip = q.Next(out var problem);
            if (q.Finished) { var done = q; q = null; gm.FinishSession(); return; }
            var info = gm.World.Skills[q.CurrentMeta.skillId];
            L("qMetaSkill").text = $"{info.island.name} · {info.skill.name}".ToUpper(); L("qMetaTier").text = (q.Mode == SessionMode.Echo ? "Echo Tide" : gm.World.tierNames[q.CurrentMeta.tier]).ToUpper();
            var dots = Q("qDots"); dots.Clear();
            for (int j = 0; j < q.Items.Count; j++) { var d = new VisualElement(); d.AddToClassList("dot"); if (j == q.Index) d.AddToClassList("now"); else if (j < q.Index) d.AddToClassList(q.Items[j].good ? "good" : "bad"); dots.Add(d); }
            var tipL = L("qTip"); Show(tipL, tip != null); if (tip != null) tipL.text = $"<color=#8b7cf6><b>✧ {info.skill.numenName} WHISPERS A TRICK</b></color>\n{tip}";
            L("qPrompt").text = problem.Prompt;
            Show(L("qFeedback"), false); Show(L("qHintBox"), false); Show(B("qNext"), false); Show(B("qSubmit"), problem.Type == ProblemType.Input);
            B("qHint").text = $"✧ Hint ({gm.State.items.hints})"; B("qHint").SetEnabled(true);
            var input = root.Q<TextField>("qInput"); var choices = Q("qChoices"); choices.Clear();
            Show(input, problem.Type == ProblemType.Input); Show(choices, problem.Type == ProblemType.Choice);
            if (problem.Type == ProblemType.Input) { input.SetEnabled(true); input.value = ""; input.schedule.Execute(() => input.Focus()).StartingIn(30); }
            else for (int j = 0; j < problem.Choices.Length; j++) { int idx = j; var b = new Button { text = problem.Choices[j] }; b.AddToClassList("choice"); b.clicked += () => Submit(idx); choices.Add(b); }
            UpdateCombo();
        }
        void UpdateCombo() { var c = L("qCombo"); c.text = $"×{(q?.Multiplier ?? 1f):0.0}"; c.EnableInClassList("hot", q != null && q.Combo >= 3); }
        void Submit(int mcIndex)
        {
            if (q == null || q.Answered) return;
            var input = root.Q<TextField>("qInput");
            if (q.Current.Type == ProblemType.Input && string.IsNullOrWhiteSpace(input.value)) return;
            var r = q.Answer(input.value, mcIndex); if (r == null) return;
            if (q.Current.Type == ProblemType.Choice) { var ch = Q("qChoices").Children().ToList(); for (int j = 0; j < ch.Count; j++) { ch[j].SetEnabled(false); if (j == q.Current.CorrectIndex) ch[j].AddToClassList("hitR"); else if (j == mcIndex) ch[j].AddToClassList("hitW"); } }
            else input.SetEnabled(false);
            var fb = L("qFeedback"); fb.RemoveFromClassList("good"); fb.RemoveFromClassList("bad");
            if (r.good)
            {
                fb.AddToClassList("good");
                string[] praise = { "Solved.", "The light returns.", "Exactly so.", "The Null flinches.", "Radiant." };
                fb.text = $"<b>{praise[UnityEngine.Random.Range(0, praise.Length)]}</b>\n<color=#f2c14e>+{r.xp} XP{(r.swift ? " · swift-bonus" : "")}{(r.lumins > 0 ? $" · +{r.lumins} ◈" : "")}{(q.Combo >= 3 ? $" · combo ×{q.Multiplier:0.0}" : "")}</color>";
                if (r.starfall) Toast("✦ <b>Starfall!</b> +3 lumins from a grateful sky.");
            }
            else { fb.AddToClassList("bad"); fb.text = $"<color=#f26b8a><b>Not this time — the answer is {q.Current.AnswerText}.</b></color>\n<color=#93a5c4>{q.Current.Explain}\nA stumble teaches more than a stroll. This one will return.</color>"; }
            Show(fb, true); Show(B("qSubmit"), false); Show(B("qNext"), true); B("qNext").text = q.Index >= q.Items.Count - 1 ? "Finish ▸" : "Continue ▸";
            UpdateCombo(); RenderHud();
        }
        void UseHint()
        {
            if (q == null || q.Answered) return;
            if (gm.State.items.hints <= 0) { Toast("No hint-charges left. The <b>Bazaar</b> sells a Lens of Insight."); return; }
            var hb = L("qHintBox"); if (hb.style.display == DisplayStyle.Flex) return;
            gm.State.items.hints--; gm.State.Save(); hb.text = "✧ " + q.Current.Hint; Show(hb, true); B("qHint").text = $"✧ Hint ({gm.State.items.hints})";
        }
        public void ShowResult(Session s, Progression.SessionOutcome o, Action then)
        {
            int total = s.Items.Count; int acc = s.Accuracy;
            string title = acc == 100 ? "Perfection" : acc >= 85 ? "A Strong Light" : acc >= 60 ? "The Light Holds" : "The Null Resists";
            string body = $"<b><color=#f2c14e>{s.Correct}/{total}</color></b> solved   ·   <color=#f2c14e>+{s.Xp}</color> XP   ·   <color=#f2c14e>+{s.Lumins + o.bonusLumins}</color> lumins   ·   best combo ×{s.BestCombo}\n\n";
            if (o.crownEarned > 0) body += $"♛ <color=#f2c14e>{gm.World.tierNames[o.crownEarned]} crown earned!</color>\n";
            body += string.Join("\n", o.lines);
            Modal(s.Mode == SessionMode.Echo ? "Echo Tide" : "Trial Complete", title, body, ("Continue", then));
        }

        // ---------- panels
        public void RenderMap()
        {
            var g = Q("mapGrid"); g.Clear(); int restored = 0;
            for (int i = 0; i < gm.World.islands.Length; i++)
            {
                var isle = gm.World.islands[i]; bool open = gm.Prog.IsleUnlocked(i), rest = gm.Prog.IsleRestored(i); if (rest) restored++;
                int crowns = isle.skills.Sum(s => gm.State.Skill(s.id).crowns); int idx = i;
                var b = new Button { text = open ? $"<b>{isle.name}</b>\n<color=#93a5c4>{isle.arc} · {crowns}/{isle.skills.Length * 3} crowns</color>" : "<b>???</b>\n<color=#5a6488>bound by the Null</color>" };
                b.AddToClassList("isle-btn"); b.AddToClassList(rest ? "restored" : open ? "open" : "locked");
                b.clicked += () => { if (open) gm.OpenIsle(idx); else Toast($"Restore <b>{gm.World.islands[idx - 1].name}</b> (1 crown per art) to lift the chains."); };
                g.Add(b);
            }
            L("mapHint").text = restored == gm.World.islands.Length ? "Every isle shines. You are the Grand Mathfinder." : $"{restored} of {gm.World.islands.Length} isles restored · select an isle to travel";
        }
        public void RenderEcho()
        {
            var list = Q("echoList"); list.Clear(); long t = GameState.Today;
            var learned = gm.World.Skills.Keys.Where(id => gm.State.Skill(id).crowns >= 1).OrderBy(id => gm.State.Skill(id).due).ToList();
            foreach (var id in learned) { var st = gm.State.Skill(id); var info = gm.World.Skills[id]; long d = st.due - t; var row = new VisualElement(); row.AddToClassList("echorow"); row.Add(new Label($"{info.skill.name} <color=#93a5c4>· {info.island.name}</color>")); var tag = new Label(d <= 0 ? "ECHOING NOW" : $"returns in {d} day{(d > 1 ? "s" : "")}"); tag.AddToClassList(d <= 0 ? "due" : "fresh"); row.Add(tag); list.Add(row); }
            if (learned.Count == 0) list.Add(new Label("The tide is empty — earn your first crown on Ember Shore and its echo will find you here.") { style = { whiteSpace = WhiteSpace.Normal } });
            int due = gm.Prog.DueSkills().Count(); var btn = B("echoStart"); btn.SetEnabled(due > 0); btn.text = due > 0 ? $"Ride the Tide ({due} echo{(due > 1 ? "es" : "")})" : "No echoes today — the tide remembers for you";
        }
        public void RenderDex()
        {
            var g = Q("dexGrid"); g.Clear(); L("dexSub").text = $"Two crowns call a Numen home; the third grants its starform. Gathered {gm.State.numen.Count} of {gm.World.TotalSkills}.";
            foreach (var kv in gm.World.Skills) { int form = gm.State.NumenForm(kv.Key); var c = new VisualElement(); c.AddToClassList("card"); if (form == 0) c.AddToClassList("locked"); if (form == 2) c.AddToClassList("star"); var gl = new Label(form == 0 ? "?" : form == 2 ? "✦" : "✧"); gl.AddToClassList("card-glyph"); var nm = new Label(form == 0 ? "Unknown Numen" : kv.Value.skill.numenName); nm.AddToClassList("card-name"); var ds = new Label(form == 0 ? kv.Value.skill.name : $"“{kv.Value.skill.numenLore}”"); ds.AddToClassList("card-desc"); c.Add(gl); c.Add(nm); c.Add(ds); g.Add(c); }
        }
        public void RenderMedals()
        {
            var g = Q("medalGrid"); g.Clear();
            foreach (var m in gm.World.medals) { bool got = gm.State.medals.Contains(m.id); var c = new VisualElement(); c.AddToClassList("card"); if (!got) c.AddToClassList("locked"); var gl = new Label(m.glyph); gl.AddToClassList("card-glyph"); var nm = new Label(got ? m.name : "???"); nm.AddToClassList("card-name"); var ds = new Label(m.desc); ds.AddToClassList("card-desc"); c.Add(gl); c.Add(nm); c.Add(ds); g.Add(c); }
        }
        void OpenShop()
        {
            Modal("The Wandering Bazaar", "Spend Your Lumins", $"You carry <color=#f2c14e>◈ {gm.State.lumins}</color> — earned from gold trials, flawless runs, and starfalls.", ("Leave the Bazaar", null));
            var custom = Q("mCustom"); custom.Clear();
            foreach (var item in gm.World.shop)
            {
                var it = gm.State.items; string owned = item.id == "hints" ? $"{it.hints} charges" : item.id == "shield" ? $"{it.shield} held" : $"{it.boost} ready"; bool maxed = item.id == "shield" && it.shield >= 2;
                var row = new VisualElement(); row.AddToClassList("shoprow");
                var txt = new Label($"<b>{item.glyph} {item.name}</b>\n<color=#93a5c4>{item.desc}</color>\n<color=#45d6b5>{owned}</color>") { style = { flexGrow = 1, whiteSpace = WhiteSpace.Normal } }; row.Add(txt);
                var buy = new Button { text = maxed ? "Maxed" : $"{item.cost} ◈" }; buy.AddToClassList("btn-ghost"); buy.SetEnabled(!maxed && gm.State.lumins >= item.cost); string id = item.id;
                buy.clicked += () => { if (gm.Prog.Buy(id)) { Toast($"{item.glyph} <b>{item.name}</b> acquired."); RenderHud(); OpenShop(); } }; row.Add(buy); custom.Add(row);
            }
        }

        // ---------- modal, toasts, level-up
        public void Modal(string eyebrow, string title, string body, params (string label, Action cb)[] actions)
        {
            L("mEyebrow").text = eyebrow.ToUpper(); L("mTitle").text = title; L("mBody").text = body; Q("mCustom").Clear();
            var acts = Q("mActions"); acts.Clear();
            foreach (var (label, cb) in actions) { var b = new Button { text = label }; b.AddToClassList("btn-primary"); var c = cb; b.clicked += () => { Show(Q("modal"), false); c?.Invoke(); }; acts.Add(b); }
            Show(Q("modal"), true);
        }
        public void Toast(string html)
        {
            var t = new Label(html); t.AddToClassList("toast"); Q("toasts").Add(t);
            t.schedule.Execute(() => t.RemoveFromHierarchy()).StartingIn(4200);
        }
        public void LevelUpFX(int level, string title)
        {
            L("lfNum").text = level.ToString(); L("lfTitle").text = title; var num = L("lfNum"); num.RemoveFromClassList("pop");
            Show(Q("levelfx"), true); num.schedule.Execute(() => num.AddToClassList("pop")).StartingIn(30);
            RenderHud();
        }
    }
}
