// Player save state. JsonUtility-friendly (arrays, not dictionaries).
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEngine;

namespace Numera.Core
{
    [Serializable] public class SkillRecord { public string id; public int crowns, box, attempts, correct; public long due; }
    [Serializable] public class NumenRecord { public string id; public int form; } // 1 = caught, 2 = starform
    [Serializable] public class Items { public int hints = 3, shield = 0, boost = 0; }
    [Serializable] public class Stats { public int solved, sessions, perfect, bestCombo, echoes; }

    [Serializable]
    public class GameState
    {
        public string name = ""; public int xp, level = 1, lumins;
        public int streak, bestStreak; public long lastDay;
        public List<SkillRecord> skills = new(); public List<string> medals = new(); public List<NumenRecord> numen = new();
        public Items items = new(); public Stats stats = new();
        public bool introSeen, endingSeen; public List<string> seenIsles = new(), restoredSeen = new(), featSeen = new();

        public static long Today => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() / 86400000L;

        public SkillRecord Skill(string id)
        {
            var r = skills.FirstOrDefault(s => s.id == id);
            if (r == null) { r = new SkillRecord { id = id }; skills.Add(r); }
            return r;
        }
        public int NumenForm(string id) => numen.FirstOrDefault(n => n.id == id)?.form ?? 0;
        public void SetNumen(string id, int form) { var n = numen.FirstOrDefault(x => x.id == id); if (n == null) numen.Add(new NumenRecord { id = id, form = form }); else n.form = form; }

        static string Path => System.IO.Path.Combine(Application.persistentDataPath, "numera_save_v1.json");
        public static GameState Load()
        {
            try { if (File.Exists(Path)) return JsonUtility.FromJson<GameState>(File.ReadAllText(Path)) ?? new GameState(); }
            catch (Exception e) { Debug.LogWarning("Save unreadable, starting fresh: " + e.Message); }
            return new GameState();
        }
        public void Save() { try { File.WriteAllText(Path, JsonUtility.ToJson(this)); } catch (Exception e) { Debug.LogWarning("Save failed: " + e.Message); } }
    }
}
