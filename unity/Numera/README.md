# Numera — Unity client

The Unity 6 (URP) client for Numera. It shares content with the web prototype through
`Assets/Numera/Resources/numera_world.json` (regenerate with `node tools/export-content.js`
from the repo root whenever `game.js` content changes), and ports the whole learning
engine to C#: progression, Leitner spaced repetition, streaks, medals, economy, the
guide, and all 37 procedural problem generators.

The visual quality now comes from **assets you bring in** — the project is built around
a store-asset workflow rather than procedural geometry.

## 1. Open the project

1. Install **Unity 6 LTS (6000.0.x)** through Unity Hub with Android and/or iOS build support.
2. Hub → *Add project from disk* → select `unity/Numera`. First import takes a few minutes.
3. If Unity asks to enable the new Input System, click **Yes**. Set *Edit → Project Settings →
   Player → Active Input Handling* to **Both** if it isn't.
4. Menu **Numera → 1 · Setup Render Pipeline**, then **Numera → 2 · Build Scene**. Press Play:
   the game runs immediately with placeholder primitives.

## 2. Bring in art

Everything plugs into one ScriptableObject: **`Assets/Numera/Settings/AssetMap.asset`**.
Whatever you leave empty falls back to a placeholder, so you can upgrade piece by piece.

| Slot | What to buy / download | Notes |
|---|---|---|
| Character prefab | Synty **POLYGON Adventure / Explorer / Kids** character, or any humanoid (Mixamo, Ready Player Me) | Import, set Rig → Humanoid, drop the prefab in |
| Idle / Walk / Celebrate clips | **Mixamo** (free): "Idle", "Walking", "Victory" — download *without skin*, FBX for Unity | Set each FBX Rig → Humanoid; drag the clips into the map; run **Numera → 3 · Build Animator** |
| Trees, rocks, bushes, props | Synty **POLYGON Nature**, or **Quaternius / Kenney** (free, CC0) | Multiple prefabs per slot; the builder picks per island seed |
| House blocks | Synty POLYGON Town / Fantasy Kingdom, or leave empty for translucent blocks | Rim of the island, PoGo-style |
| Beacon prefab | Any shrine / crystal / lantern prop | Needs no script — the builder adds `Beacon` and a collider |
| Landmarks (per isle id) | One hero prop each: `ember` lighthouse, `trig` temple ring, `calculus` volcano… | Island ids are in `numera_world.json` |
| Materials | Optional overrides for ground, cliff, roads, plaza, water, sky | Defaults use the Numera shaders |

Tick **Apply Toon To Kit** to re-shade store assets with `Numera/Toon Lit` at spawn (keeps
their albedo textures), which unifies mixed packs into one look. Or convert permanently:
select materials → **Numera → 4 · Convert Selected Materials To Toon**.

Recommended shopping list for a Pokémon-Go-grade look, in order of impact:
1. A rigged stylized hero + 3 Mixamo clips (biggest single jump).
2. POLYGON Nature (trees, rocks, grass cards, flowers).
3. Twelve landmark props (one per island) — Fantasy Kingdom / Adventure packs cover most.
4. A particle pack (sparkles, dust, water splash) for beacons and level-ups.

## 3. What's in the project

- `Scripts/Core` — engine-agnostic logic: `WorldData`, `GameState`, `Progression`, `Session`,
  `ProblemGenerators` (37 skills × 3 tiers, faithful to the web version).
- `Scripts/World` — `IslandView` (builds the isle from the Asset Map), `MathfinderController`
  (wander + Animator), `FollowCamera` (PoGo framing), `DayNightCycle` (real-clock lighting,
  sky, fog, bloom, exposure), `Beacon`.
- `Scripts/Gameplay/GameManager` — bootstrap, screen routing, beacon taps.
- `Scripts/UI` + `UI/` — UI Toolkit document (`Numera.uxml` / `.uss`) and `UIController`
  (HUD, guide, quest loop with adaptive tips, modals, toasts, level-up, map, echo, dex,
  medals, shop).
- `Shaders/` — `Numera/Toon Lit` (stepped ramp, rim, shadows), `Numera/Water`, `Numera/Sky Gradient`.
- `Scripts/Editor/NumeraSetup` — the four menu items.

## 4. Build

*File → Build Profiles* → Android or iOS. Portrait orientation, target 60 fps. URP settings
are in `Settings/NumeraURP.asset` (drop MSAA to 2× and shadow distance to 40 for low-end phones).

## Known first-open caveats

This project was authored without an editor at hand, so expect a few compile nits on
first import — typically a renamed URP property or an API tweak between 6000.0 patch
versions. They are quick to fix; the logic itself mirrors the tested web engine.
