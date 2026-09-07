# Numera — The Shattered Isles of Number

A story-driven math-mastery game that carries a player from beginner arithmetic to
introductory calculus, built as a single-page web app with no dependencies and no
build step. Open `index.html` in any browser to play; progress saves to the browser
via `localStorage`.

## The story

The archipelago of Numera once hummed with living mathematics, its skies full of
tame number-spirits called **Numen**. Then **the Null** — a silence that "unsolves"
the world — drained the knowing from every isle. You are a **Mathfinder**: every
problem you solve returns a little light, every art you master calls its Numen home,
and restoring all twelve isles unsolves the Null itself.

## The curriculum: 12 islands, 37 arts

Each island is a math topic; each of its "arts" is a skill with its own procedural
problem generator and three difficulty tiers (Bronze / Silver / Gold trials):

| # | Island | Topic |
|---|--------|-------|
| 1 | Ember Shore | Addition, subtraction, multiplication, division |
| 2 | Hollow of Signs | Integers, negatives, order of operations |
| 3 | Fraction Cove | Simplifying, adding, multiplying fractions |
| 4 | The Glass Delta | Decimals, percents, percent change |
| 5 | Ratio Reef | Unit rates, proportions, scale |
| 6 | Exponent Peaks | Powers, roots, exponent laws, scientific notation |
| 7 | Algebra Vale | One-step, two-step, both-sides equations; expanding |
| 8 | Geometry Grove | Area, angles, the Pythagorean theorem |
| 9 | Function Falls | Linear functions, quadratics, systems |
| 10 | Trig Temple | Right-triangle trig, the unit circle, identities |
| 11 | Chance Mire | Probability, counting, statistics |
| 12 | Calculus Caldera | Limits, derivatives, integrals |

Problems are generated procedurally, so no two sessions repeat. All 37 generators
are fuzz-tested (900 runs each) for self-consistency.

## The learning engine

Every game mechanic maps to an evidence-backed learning principle:

- **Retrieval practice** — everything is active problem solving; there is no passive
  reading. Answering from memory is the single best-supported way to build durable
  knowledge (the "testing effect").
- **Spaced repetition** — the **Echo Tide**. Once you crown an art, it enters a
  Leitner queue (intervals of 1, 3, 7, 16, 35 days). Reviews you ace return later;
  ones you miss return sooner. This directly fights the forgetting curve and is what
  makes knowledge *compound* instead of decay.
- **Interleaving** — Echo Tide sessions mix problems from *different* due skills, which
  research shows beats blocked practice for transfer and discrimination.
- **Mastery learning** — the next island unlocks only when every art on the previous
  isle holds at least one crown; a crown requires ≈85% on a trial. You can't outrun
  gaps in your foundation.
- **Immediate corrective feedback** — a wrong answer shows the correct result *and* a
  one-line worked explanation, and the missed problem silently re-queues at the end of
  the same session (error-driven relearning).
- **Desirable difficulty** — three trial tiers per skill; the game nudges you down a
  tier after a rough session and forward when you're ready, keeping you in the zone
  of proximal development.
- **Goal-gradient & chunking** — crowns per art, arts per island, islands per world:
  progress bars at every scale, so the next milestone is always visibly close.

## The engagement engine

- **Variable-ratio rewards** — "Starfall" lumin drops trigger randomly on hot streaks
  (the same schedule slot machines use, aimed at algebra instead).
- **Combo multiplier** — consecutive correct answers push XP up to ×2, resetting on a
  miss; speed earns a swift-bonus without punishing slow, careful work.
- **Daily streaks with loss aversion** — a streak flame, a best-streak record, and a
  purchasable **Streak Shield** that protects one missed day.
- **Collection compulsion** — 37 procedurally-drawn constellation creatures (Numen),
  each with a name and lore line; two crowns catches one, a third crown evolves it
  into a golden **starform**. Gotta catch all 37.
- **Economy** — **lumins** flow from hard (Gold-tier) problems, flawless runs, island
  restorations, and medals; they buy hints, streak shields, and XP-doubling Comet
  Boosts, so the reward loop feeds back into the learning loop.
- **22 medals**, 16 level titles ("Novice of the Shore" → "Grand Mathfinder"),
  island-restoration story beats, level-up ceremonies, and an ending.

## Files

- `index.html` — page skeleton
- `style.css` — the "starlight cartography" theme
- `avatar.js` — the 3D Mathfinder avatar (Three.js) and the level-up ceremony
- `game.js` — world data, 37 problem generators, learning engine, UI

## Ideas for future expansions

1. **Boss trials** — a timed, mixed-topic "Null Shard" fight to fully seal each island
  once all its arts are gold-crowned.
2. **Worked-example mode** — a short interactive walkthrough before each new art
   (worked examples are the ideal on-ramp for novices before retrieval practice).
3. **An adaptive difficulty engine** — replace tier choice with an Elo-style rating
   per skill that serves each problem at your measured edge.
4. **Handwriting / sketch input** — a canvas scratchpad for working out, with steps.
5. **Explain-it-back prompts** — occasional "teach the Numen why" free-text moments
   (self-explanation is a top-tier learning intervention).
6. **Cloud saves + friend leagues** — weekly XP leagues like Duolingo's, streak
   duels, and shareable Numendex cards.
7. **Sound design** — combo pitch-risers, island ambience, a catch fanfare.
8. **More seas** — Linear Algebra Straits, Number Theory Deeps, Proof-Writing Peaks
   for the true expert endgame.
