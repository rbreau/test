// The learning-engine rules: unlocks, crowns, Leitner scheduling, streaks, XP, medals, shop, guide.
using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace Numera.Core
{
    public class Progression
    {
        public readonly WorldData World; public readonly GameState State;
        public event Action<int> LeveledUp;                 // new level
        public event Action<MedalDef> MedalEarned;
        public event Action<string> Toast;

        public Progression(WorldData world, GameState state) { World = world; State = state; }

        // ---- islands
        public bool IsleUnlocked(int i) => i == 0 || World.islands[i - 1].skills.All(s => State.Skill(s.id).crowns >= 1);
        public bool IsleRestored(int i) => World.islands[i].skills.All(s => State.Skill(s.id).crowns >= 2);
        public int FrontierIsle()
        {
            for (int i = 0; i < World.islands.Length; i++) if (IsleUnlocked(i) && !IsleRestored(i)) return i;
            for (int i = World.islands.Length - 1; i >= 0; i--) if (IsleUnlocked(i)) return i;
            return 0;
        }
        public IEnumerable<string> DueSkills() => World.Skills.Keys.Where(id => { var s = State.Skill(id); return s.crowns >= 1 && s.due <= GameState.Today; });

        // ---- xp
        public void GainXp(int amount)
        {
            State.xp += amount; bool leveled = false;
            while (State.xp >= WorldData.XpNeed(State.level)) { State.xp -= WorldData.XpNeed(State.level); State.level++; leveled = true; }
            if (leveled) LeveledUp?.Invoke(State.level);
        }

        // ---- session outcome (mirrors game.js endSession)
        public class SessionOutcome { public int crownEarned; public List<(string skillId, bool starform)> newNumen = new(); public List<string> lines = new(); public int bonusLumins; public bool perfect; }
        public SessionOutcome ApplySession(Session q)
        {
            var o = new SessionOutcome(); State.stats.sessions++;
            long t = GameState.Today;
            if (State.lastDay != t)
            {
                if (State.lastDay == t - 1 || State.lastDay == 0) State.streak++;
                else if (State.items.shield > 0 && State.lastDay == t - 2) { State.items.shield--; State.streak++; o.lines.Add("A Streak Shield shattered to guard your flame."); }
                else State.streak = 1;
                State.lastDay = t; State.bestStreak = Mathf.Max(State.bestStreak, State.streak);
            }
            int baseLen = q.Mode == SessionMode.Quest ? Session.QuestLen : Session.EchoLen;
            o.perfect = q.Items.Take(baseLen).All(it => it.good);
            if (o.perfect) { State.stats.perfect++; o.bonusLumins += 15; o.lines.Add("Flawless. +15 lumins."); }
            if (q.Mode == SessionMode.Quest)
            {
                var meta = q.Items[0]; var st = State.Skill(meta.skillId);
                bool passed = q.Correct >= Mathf.CeilToInt(q.Items.Count * 0.85f);
                if (passed && meta.tier == st.crowns + 1)
                {
                    st.crowns = meta.tier; o.crownEarned = meta.tier;
                    if (st.crowns == 1) { st.box = 1; st.due = t + World.leitnerDays[1]; }
                    if (st.crowns == 2 && State.NumenForm(meta.skillId) == 0) { State.SetNumen(meta.skillId, 1); o.newNumen.Add((meta.skillId, false)); }
                    if (st.crowns == 3 && State.NumenForm(meta.skillId) == 1) { State.SetNumen(meta.skillId, 2); o.newNumen.Add((meta.skillId, true)); }
                }
                else if (!passed && q.Accuracy < 50 && meta.tier > 1) o.lines.Add("The trial pushed back hard — a lower trial will rebuild your footing. Struggle is where learning lives.");
                else if (!passed) o.lines.Add($"A crown asks for {Mathf.CeilToInt(q.Items.Count * 0.85f)} of {q.Items.Count}. The missed ones already returned once — try again; it will feel shorter.");
            }
            else
            {
                State.stats.echoes++;
                foreach (var kv in q.PerSkill)
                {
                    var st = State.Skill(kv.Key);
                    st.box = kv.Value.bad == 0 ? Mathf.Min(5, st.box + 1) : Mathf.Max(1, st.box - 1);
                    st.due = t + World.leitnerDays[st.box];
                }
                o.lines.Add("The echoes drift out again on the tide — the well-remembered ones for longer.");
            }
            State.lumins += o.bonusLumins; State.Save();
            return o;
        }

        // ---- restores + ending (returns islands newly restored, in order)
        public List<IslandDef> CollectNewRestores()
        {
            var list = new List<IslandDef>();
            for (int i = 0; i < World.islands.Length; i++)
                if (IsleRestored(i) && !State.restoredSeen.Contains(World.islands[i].id)) { State.restoredSeen.Add(World.islands[i].id); State.lumins += 50; list.Add(World.islands[i]); }
            if (list.Count > 0) State.Save();
            return list;
        }
        public bool AllRestored() => Enumerable.Range(0, World.islands.Length).All(IsleRestored);

        // ---- medals
        bool MedalCondition(string id)
        {
            var S = State; int numenCount = S.numen.Count; int restored = Enumerable.Range(0, World.islands.Length).Count(IsleRestored);
            switch (id)
            {
                case "spark": return S.stats.solved >= 1; case "ten": return S.stats.solved >= 10; case "century": return S.stats.solved >= 100; case "fivehundred": return S.stats.solved >= 500;
                case "perfect": return S.stats.perfect >= 1; case "perfect5": return S.stats.perfect >= 5;
                case "combo8": return S.stats.bestCombo >= 8; case "combo15": return S.stats.bestCombo >= 15;
                case "streak3": return S.bestStreak >= 3; case "streak7": return S.bestStreak >= 7; case "streak30": return S.bestStreak >= 30;
                case "isle1": return restored >= 1; case "isle6": return restored >= 6; case "isle12": return restored >= World.islands.Length;
                case "numen1": return numenCount >= 1; case "numen10": return numenCount >= 10; case "numenall": return numenCount >= World.TotalSkills;
                case "star1": return S.numen.Any(n => n.form == 2); case "rich": return S.lumins >= 200; case "echo10": return S.stats.echoes >= 10;
                case "lvl10": return S.level >= 10; case "lvl25": return S.level >= 25;
                default: return false;
            }
        }
        public void CheckMedals()
        {
            foreach (var m in World.medals)
                if (!State.medals.Contains(m.id) && MedalCondition(m.id)) { State.medals.Add(m.id); State.lumins += 10; MedalEarned?.Invoke(m); }
            State.Save();
        }

        // ---- shop
        public bool Buy(string id)
        {
            var item = World.shop.First(s => s.id == id);
            if (State.lumins < item.cost) return false;
            if (id == "shield" && State.items.shield >= 2) return false;
            State.lumins -= item.cost;
            if (id == "hints") State.items.hints += 5; else if (id == "shield") State.items.shield++; else if (id == "boost") State.items.boost++;
            State.Save(); CheckMedals(); return true;
        }

        // ---- the guide: exactly one recommended next step
        public class Guide { public string title, sub, label; public bool isEcho; public int isleIndex; public string skillId; public int tier; }
        public Guide ComputeGuide()
        {
            var due = DueSkills().ToList();
            if (due.Count > 0) return new Guide { isEcho = true, title = "Ride the Echo Tide", sub = $"{due.Count} mastered art{(due.Count > 1 ? "s are" : " is")} echoing — reviewing now locks {(due.Count > 1 ? "them" : "it")} deeper into memory.", label = "Ride" };
            for (int i = 0; i < World.islands.Length; i++)
            {
                if (!IsleUnlocked(i) || IsleRestored(i)) continue;
                var sk = World.islands[i].skills.FirstOrDefault(s => State.Skill(s.id).crowns < 2); if (sk == null) continue;
                int tier = State.Skill(sk.id).crowns + 1;
                return new Guide { title = $"{World.tierNames[tier]} — {sk.name}", sub = $"{World.islands[i].name} · {sk.desc}", label = "Begin", isleIndex = i, skillId = sk.id, tier = tier };
            }
            for (int i = 0; i < World.islands.Length; i++)
            {
                var sk = World.islands[i].skills.FirstOrDefault(s => State.Skill(s.id).crowns < 3); if (sk == null) continue;
                return new Guide { title = $"Gold Trial — {sk.name}", sub = $"{World.islands[i].name} · a third crown will raise {sk.numenName} to starform.", label = "Begin", isleIndex = i, skillId = sk.id, tier = 3 };
            }
            return new Guide { title = "The sky is full.", sub = "Every crown won, every Numen a star. Ride the Echo Tide when it calls.", label = "Wander", isleIndex = FrontierIsle() };
        }
    }
}
