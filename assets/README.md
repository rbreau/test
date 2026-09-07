# Assets — drop real models here

**Current character**: `mathfinder.glb` is assembled from the Synty **SIDEKICK Starter** pack
(preset Starter_02: sci-fi civilian outfit, backpack, blue mohawk) — 31 skinned parts re-bound
to one shared 88-bone skeleton, palette texture applied, exported to glTF. The game animates the
real bones procedurally (walk cycle, idle breathing, look-around, lantern raise, celebrate) because
the pack ships no clips. Rebuild with `tools/build-character.md` notes. Synty assets are licensed
to the purchaser, not for redistribution — keep this repository private if the model stays in it.


The game reads **`manifest.json`** in this folder (only when served over HTTP — GitHub Pages,
or `python3 -m http.server` locally). Every model it names is preloaded, grounded, scaled to
a per-kind height, re-shaded with the toon ramp, and placed by the island composer.
**Anything missing is skipped silently** and the stylized placeholder is used instead, so
you can add models one at a time and watch the world upgrade.

## File map

| Put here | Kind | Suggested source |
|---|---|---|
| `mathfinder.glb` | The player character (rigged, with clips named idle / walk / celebrate) | Quaternius *Ultimate Animated Character Pack* (CC0), or Mixamo retarget |
| `kit/tree-1.glb`, `tree-2.glb` | Trees | Quaternius *Ultimate Nature Pack* / Kenney *Nature Kit* |
| `kit/bush-1.glb` | Bushes | same |
| `kit/rock-1.glb`, `rock-2.glb` | Rocks | same |
| `kit/house-1.glb`, `house-2.glb` | Small houses (the rim town) | Kenney *Fantasy Town Kit* / Quaternius village packs |
| `kit/lamp-1.glb` | Lamp post (lit at night) | Kenney Fantasy Town Kit |
| `kit/prop-1.glb` | Crate, barrel, cart… | any |
| `kit/landmark-<isle>.glb` | One hero prop per island (see manifest for the twelve ids) | mix of the above; a lighthouse, ruins, a shrine… |

Add more variants by extending the arrays in `manifest.json`. Formats: `.glb` (binary glTF)
with embedded textures. Keep each under ~1 MB; the whole kit under ~15 MB.

The three `kit/*.glb` files that ship in the repo are tiny generated stand-ins that prove the
pipeline works — replace them.

## Character clip names

The loader looks for animation clips whose names contain **idle** (or stand/breath), **walk**
(or run/jog), and **celebrate** (or dance/jump/cheer/wave/victory). Quaternius and Mixamo
exports already use these words.
