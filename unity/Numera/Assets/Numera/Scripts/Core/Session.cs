// A trial (one skill, one tier) or an Echo Tide review (interleaved due skills).
using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace Numera.Core
{
    public enum SessionMode { Quest, Echo }

    public class Session
    {
        public const int QuestLen = 8, EchoLen = 6;
        public class Item { public string skillId; public int tier; public bool good; }
        public class Tally { public int good, bad; }

        public SessionMode Mode; public List<Item> Items = new(); public int Index = -1, Correct, Combo, BestCombo, Xp, Lumins;
        public bool Boost, Answered, ShowTip; public int TipIndex; public Problem Current; public Item CurrentMeta; public float StartedAt;
        public Dictionary<string, Tally> PerSkill = new();
        public int Accuracy => Items.Count == 0 ? 0 : Mathf.RoundToInt(100f * Correct / Items.Count);
        public bool Finished => Index >= Items.Count;
        public float Multiplier => 1f + 0.1f * Mathf.Min(Combo, 10);

        readonly Progression _p; readonly System.Random _rng = new();
        public event Action<string> Toast;

        public Session(Progression p) { _p = p; }

        public static Session Quest(Progression p, string skillId, int tier)
        {
            var s = new Session(p) { Mode = SessionMode.Quest };
            for (int i = 0; i < QuestLen; i++) s.Items.Add(new Item { skillId = skillId, tier = tier });
            if (p.State.items.boost > 0) { p.State.items.boost--; s.Boost = true; }
            return s;
        }
        public static Session Echo(Progression p)
        {
            var due = p.DueSkills().ToList(); if (due.Count == 0) return null;
            var s = new Session(p) { Mode = SessionMode.Echo };
            for (int k = 0; s.Items.Count < EchoLen; k++) { var id = due[k % due.Count]; s.Items.Add(new Item { skillId = id, tier = Mathf.Clamp(p.State.Skill(id).crowns, 1, 3) }); }
            s.Items = s.Items.OrderBy(_ => s._rng.Next()).ToList();
            return s;
        }

        /// Advances to the next problem. Returns the tip to show first (or null).
        public string Next(out Problem problem)
        {
            Index++; problem = null;
            if (Finished) return null;
            CurrentMeta = Items[Index];
            Current = problem = ProblemGenerators.Generate(CurrentMeta.skillId, CurrentMeta.tier, _rng);
            StartedAt = Time.realtimeSinceStartup; Answered = false;
            string tip = null;
            var tips = _p.World.Skills[CurrentMeta.skillId].skill.tips;
            if (ShowTip && tips != null && tips.Length > 0) { tip = tips[TipIndex % tips.Length]; TipIndex++; ShowTip = false; }
            return tip;
        }

        public class Result { public bool good; public int xp, lumins; public bool swift, starfall; }
        public Result Answer(string input, int mcIndex = -1)
        {
            if (Answered) return null; Answered = true;
            bool good = Current.Type == ProblemType.Choice ? mcIndex == Current.CorrectIndex : Current.Check(input);
            CurrentMeta.good = good;
            var st = _p.State.Skill(CurrentMeta.skillId); st.attempts++;
            float secs = Time.realtimeSinceStartup - StartedAt;
            if (secs > 20 + 8 * (CurrentMeta.tier - 1)) ShowTip = true;   // a long think earns a whisper before the next question
            var r = new Result { good = good };
            if (good)
            {
                st.correct++; _p.State.stats.solved++; Correct++; Combo++; BestCombo = Mathf.Max(BestCombo, Combo);
                _p.State.stats.bestCombo = Mathf.Max(_p.State.stats.bestCombo, Combo);
                int gain = Mathf.RoundToInt(10 * CurrentMeta.tier * Multiplier);
                if (secs < 10) { gain += 5; r.swift = true; }
                if (Boost) gain *= 2;
                int lum = CurrentMeta.tier == 3 ? 2 : 0;
                if (Combo >= 5 && _rng.NextDouble() < 0.3) { lum += 3; r.starfall = true; }
                Xp += gain; Lumins += lum; _p.State.lumins += lum; r.xp = gain; r.lumins = lum;
                _p.GainXp(gain);
            }
            else
            {
                Combo = 0;
                if (Mode == SessionMode.Quest) Items.Add(new Item { skillId = CurrentMeta.skillId, tier = CurrentMeta.tier }); // missed problems return
            }
            if (Mode == SessionMode.Echo) { if (!PerSkill.TryGetValue(CurrentMeta.skillId, out var t)) PerSkill[CurrentMeta.skillId] = t = new Tally(); if (good) t.good++; else t.bad++; }
            _p.State.Save();
            return r;
        }
    }
}
