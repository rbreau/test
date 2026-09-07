// Content tables shared with the web client (exported by tools/export-content.js).
using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace Numera.Core
{
    [Serializable] public class SkillDef { public string id, name, desc, numenName, numenLore; public string[] tips; }
    [Serializable] public class IslandDef { public string id, name, arc, hue, lore, restored; public float x, y; public SkillDef[] skills; public Color Tint => ColorUtility.TryParseHtmlString(hue, out var c) ? c : Color.white; }
    [Serializable] public class MedalDef { public string id, glyph, name, desc; }
    [Serializable] public class ShopDef { public string id, glyph, name, desc; public int cost; }

    [Serializable]
    public class WorldData
    {
        public string[] levelNames; public string[] tierNames; public int[] leitnerDays;
        public IslandDef[] islands; public MedalDef[] medals; public ShopDef[] shop;

        Dictionary<string, (SkillDef skill, IslandDef island, int islandIndex)> _skills;
        public IReadOnlyDictionary<string, (SkillDef skill, IslandDef island, int islandIndex)> Skills
        {
            get
            {
                if (_skills == null)
                {
                    _skills = new Dictionary<string, (SkillDef, IslandDef, int)>();
                    for (int i = 0; i < islands.Length; i++) foreach (var s in islands[i].skills) _skills[s.id] = (s, islands[i], i);
                }
                return _skills;
            }
        }
        public int TotalSkills => islands.Sum(i => i.skills.Length);
        public string LevelName(int level) => levelNames[Mathf.Min(levelNames.Length - 1, (level - 1) / 3)];
        public static int XpNeed(int level) => Mathf.RoundToInt(100f * Mathf.Pow(level, 1.35f));

        public static WorldData Load()
        {
            var text = Resources.Load<TextAsset>("numera_world");
            if (text == null) throw new Exception("numera_world.json missing from Resources — run tools/export-content.js");
            return JsonUtility.FromJson<WorldData>(text.text);
        }
    }
}
