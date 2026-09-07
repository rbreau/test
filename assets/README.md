# Character assets (optional)

Drop a rigged, animated glTF binary here as **`mathfinder.glb`** and the game will
use it instead of the procedural Mathfinder — on the title screen, in the level-up
ceremony, and walking the island. Nothing else needs to change.

Requirements:
- Any humanoid scale (auto-normalized to 1.8 units tall, feet on the ground).
- Animation clips whose names contain **idle**, **walk** (or run), and optionally
  **celebrate** / **dance** / **jump** / **wave**. Mixamo exports keep these names.
- Keep it small: under ~3 MB loads instantly; embed textures in the .glb.

Suggested free pipeline: pick a stylized character from Quaternius or Kenney (CC0), or
build one at readyplayer.me; retarget Mixamo "Idle", "Walking" and "Victory" clips in
Blender; export as glTF Binary with animations.

The file is only fetched when the game is served over HTTP (e.g. GitHub Pages or a
local server) — the single-file build in `dist/` always uses the procedural avatar.
