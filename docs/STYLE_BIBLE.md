# Numera — Style Bible

The single reference for every visual decision. When in doubt, this document wins.

## 1. One sentence

**A luminous, hand-built archipelago at golden hour — stylized, soft, and clean, where math
is a living light you carry into the dark.**

Reference points: Pokémon Go's map (clean geometry, saturated pastels, yellow-edged paths),
Monument Valley (composed silhouettes, one bold idea per screen), Alto's Odyssey (gradient
skies, color-driven time of day). Not: realism, grit, noise, texture detail.

## 2. Shape language

- **Rounded and chunky.** Trunks are thick, canopies are lumps, rocks are dodecahedra. No
  thin fragile detail — every object must read at 40 px tall on a phone.
- **Big / medium / small** in every cluster: one hero form, two supporting, filler. Never a
  row of equal-sized things.
- **Silhouette first.** If an object is not recognizable as a flat black shape, it is too detailed.
- Proportions: character 1.8 units tall; trees 2.4–2.8; houses 1.7; the island plateau
  radius 9. Keep the world small enough that the camera always sees the sea.

## 3. Palette

| Token | Hex | Use |
|---|---|---|
| Midnight ink | `#0a0e23` | UI ground, night sky |
| Ink raised | `#1b2450` | Panels |
| Parchment | `#ede6d3` | Text |
| Moonlight | `#93a5c4` | Secondary text |
| **Starlight gold** | `#f2c14e` | The accent. Rewards, beacons, lamps, the lantern. Spend it sparingly. |
| Tide aqua | `#45d6b5` | Mastery, restored, success |
| Coral | `#f26b8a` | Misses, danger — never decoration |
| Arcane violet | `#8b7cf6` | Hints, whispers, the Null's edge |
| Day sky | `#3f8fe0 → #a9d6f5 → #d9ebf5` | Top → horizon → below |
| Grass | island tint lerped 70% toward `#7fcf9f` | Each island reads as its own hue |
| Road | `#5b6474` with `#f4d36a` edges | The PoGo signature |

Rule: surfaces are **desaturated pastels**; light and emissives carry the saturation.
Semantic colors (aqua / coral) never appear as ornament.

## 4. Materials and light

- Everything is **toon-shaded** through one 4-step ramp (`assets.js → toonRamp`). Imported
  kits are re-shaded automatically; this is what makes Synty + Kenney + Quaternius sit
  together.
- Albedo textures are allowed only if they are flat-color atlases (Kenney/Quaternius style).
  No photo textures, no normal maps.
- One warm sun, one cool sky fill, soft shadows. Bloom only on emissives (lamps, beacons,
  the lantern, the lava). Vignette 0.5.
- Time of day is a feature: dusk is the hero hour. Night turns the world indigo and lets
  the gold glow do the talking.

## 5. Per-island mood board

| Isle | Tint | Landmark | Props | Feeling |
|---|---|---|---|---|
| Ember Shore | warm orange | red-and-white lighthouse | driftwood, palms | first morning |
| Hollow of Signs | violet | obsidian monoliths, mirror pool | dead trees, dark rocks | cold, mirrored |
| Fraction Cove | aqua | tide pools, split boulders | shells, low bushes | playful, wet |
| Glass Delta | sky blue | glass shards | reeds, lanterns | crystalline |
| Ratio Reef | gold | red/gold coral 3:5 | coral fans | tropical |
| Exponent Peaks | magenta | doubling stairs | scree, pines | vertical, vast |
| Algebra Vale | rose | crossed stones of x | meadow flowers | pastoral mystery |
| Geometry Grove | leaf green | polygon pillars | tidy trees | orderly |
| Function Falls | cyan | waterfall + pool | ferns, mist | motion |
| Trig Temple | amber | ring temple | columns, incense | ceremonial |
| Chance Mire | lavender | dice in the mist | dead reeds, fog | uncertain |
| Calculus Caldera | gold on black | glowing caldera | ash rocks, embers | finale |

## 6. Composition rules (island layout)

- The **landmark faces the camera's default heading** and sits in a spoke gap at radius ~4.
- **Groves frame, never block**: clusters go in the gaps beside the landmark, big tree nearest
  the center.
- **Town is an arc**, not a scatter — outside the ring, doors toward the plaza, one lamp.
- **Rocks live on the rim**; bushes flank plazas; a lamp stands at every beacon.
- Roads are always visible from the camera; nothing taller than 0.4 within 0.5 of a road.
- The character spawns on the center plaza facing away from the camera.

## 7. Camera

Low, behind the shoulder, fixed compass heading, slow lerp (2.5 s to settle). Field of view
50°. Portrait phones pull back 1.6 units and up 0.7. The horizon sits in the upper third;
the character's feet in the lower third.

## 8. Motion and feel

- Idle: breathing, blinks every ~4 s, look-around every ~9 s, lantern raise every ~13 s.
- Walk: 1.35 u/s with 0.6 s ease-in; turns ease over ~0.3 s.
- Correct answer: spark burst scaled by combo; wrong: card shake; level-up: full-screen
  rays + 110-particle burst + avatar leap. Never more than one big effect at a time.
- Respect `prefers-reduced-motion`: static frames, no particles.

## 9. UI

Fraunces (display), Atkinson Hyperlegible (body), Spline Sans Mono (numbers). Panels are
midnight glass over the world; one gold button per screen; progressive disclosure — a new
player sees Map only.

## 10. Free asset shopping list (CC0 / free-to-use)

1. **Quaternius — Ultimate Animated Character Pack** → `assets/mathfinder.glb` (pick one, export
   with clips; names already contain Idle / Walk / Wave).
2. **Quaternius — Ultimate Nature Pack** or **Kenney — Nature Kit** → `kit/tree-*.glb`,
   `bush-1.glb`, `rock-*.glb`.
3. **Kenney — Fantasy Town Kit** → `kit/house-*.glb`, `lamp-1.glb`, `prop-1.glb`.
4. Landmarks (`kit/landmark-<isle>.glb`): lighthouse (Kenney Pirate Kit), ruins/columns
   (Kenney Fantasy Town / Quaternius Ruins), crystals (Quaternius Nature), volcano (sculpt
   or reuse a rock at scale 4).

Both sites export glTF directly; no Blender needed. Drop files in, refresh, done.

## 11. Definition of "professional" for this project

A screenshot at dusk on a phone that a stranger would assume came from a shipped game:
one hero silhouette, one accent color glowing, nothing random, nothing thin, nothing noisy.
