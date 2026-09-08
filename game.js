'use strict';
/* ================================================================
   NUMERA — a math-mastery adventure
   Learning engine: mastery gates, retrieval practice, spaced
   repetition (Leitner), interleaving, adaptive tiers, immediate
   corrective feedback, variable-ratio rewards.
   ================================================================ */

/* ---------------- tiny utilities ---------------- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; }
function fmt(n) { // trim float dust
  const r = Math.round(n * 1e6) / 1e6;
  return String(r);
}
function fr(n, d) { return `<span class="fr"><b>${n}</b><i>${d}</i></span>`; }
function simp(n, d) { const g = gcd(n, d); n /= g; d /= g; if (d < 0) { n = -n; d = -d; } return [n, d]; }
function frStr(n, d) { [n, d] = simp(n, d); return d === 1 ? String(n) : `${n}/${d}`; }
// seeded pseudo-random for constellation art (stable per Numen)
function mulberry(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const DAY = 86400000;
const today = () => Math.floor(Date.now() / DAY);

/* answer parsing: accepts "-3", "2.5", "3/4", "1 1/2" */
function parseAns(str) {
  if (typeof str !== 'string') return null;
  str = str.trim().replace(/,/g, '');
  if (!str) return null;
  let m = str.match(/^(-?\d+)\s+(\d+)\s*\/\s*(\d+)$/); // mixed number
  if (m) { const w = +m[1], n = +m[2], d = +m[3]; if (!d) return null; return (Math.abs(w) + n / d) * (w < 0 ? -1 : 1); }
  m = str.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/);
  if (m) { const d = +m[2]; if (!d) return null; return +m[1] / d; }
  m = str.match(/^-?\d+(?:\.\d+)?$/);
  if (m) return +str;
  return null;
}
function numEq(guess, target, tol) {
  const v = parseAns(guess);
  if (v === null) return false;
  tol = tol === undefined ? 1e-6 : tol;
  return Math.abs(v - target) <= tol + Math.abs(target) * 1e-9;
}

/* ================================================================
   WORLD DATA — the archipelago
   ================================================================ */
const ISLANDS = [
  {
    id: 'ember', name: 'Ember Shore', arc: 'The Four Tides', x: 110, y: 545, hue: '#f2884e',
    lore: 'The first lantern-light falls here, where the four tides — joining, taking, folding, sharing — once kept the whole sea in rhythm. The Null silenced them first.',
    restored: 'The four tides breathe again. Far off, you hear the Null recoil — it did not expect anyone to remember how to count.',
    skills: [
      { id: 'add', name: 'Tide of Joining', desc: 'Addition, from shore-counting to triple swells.', numen: ['Summling', 'Hums two songs into one.'] },
      { id: 'sub', name: 'Tide of Taking', desc: 'Subtraction and what the ebb leaves behind.', numen: ['Minuel', 'Keeps what remains when the tide pulls out.'] },
      { id: 'mul', name: 'Tide of Folding', desc: 'Multiplication — tables, then towers.', numen: ['Loopwing', 'Beats its wings in perfect multiples.'] },
      { id: 'div', name: 'Tide of Sharing', desc: 'Division into fair and perfect piles.', numen: ['Quotil', 'Shares every catch into fair piles.'] },
    ]
  },
  {
    id: 'signs', name: 'Hollow of Signs', arc: 'Below the Zero-Line', x: 265, y: 470, hue: '#8b7cf6',
    lore: 'A cavern where the sea dips below zero. Lanterns here burn cold, and every number casts a mirrored twin on the dark water.',
    restored: 'The zero-line steadies. Positive and negative walk the hollow together now, politely, like old rivals who respect each other.',
    skills: [
      { id: 'negadd', name: 'Mirrorwalk', desc: 'Adding and subtracting across zero.', numen: ['Umbrant', 'Walks both sides of zero without falling.'] },
      { id: 'negmul', name: 'Twin Product', desc: 'Multiplying and dividing signed numbers.', numen: ['Polarix', 'Two wrongs, it insists, make a right.'] },
      { id: 'orderops', name: 'Rite of Order', desc: 'Order of operations — the sacred sequence.', numen: ['Ordinal', 'Never does anything out of turn.'] },
    ]
  },
  {
    id: 'fraction', name: 'Fraction Cove', arc: 'The Divided Waters', x: 150, y: 345, hue: '#45d6b5',
    lore: 'Every wave here breaks into perfect parts. The cove-folk once traded in halves and fifths the way others trade in shells.',
    restored: 'The divided waters flow whole again. A fifth of a wave, you now know, is still entirely a wave.',
    skills: [
      { id: 'fracsimp', name: 'Shedding Rite', desc: 'Simplifying and recognizing equivalent fractions.', numen: ['Simplifin', 'Sheds everything it doesn’t need.'] },
      { id: 'fracadd', name: 'Common Ground', desc: 'Adding and subtracting fractions.', numen: ['Commundra', 'Finds the ground two rivers share.'] },
      { id: 'fracmul', name: 'Somersault Rule', desc: 'Multiplying and dividing fractions.', numen: ['Flipperjack', 'Divides by turning somersaults.'] },
    ]
  },
  {
    id: 'delta', name: 'The Glass Delta', arc: 'Point and Percent', x: 330, y: 305, hue: '#6db3f2',
    lore: 'A river-mouth of glass where numbers refract into tenths and hundredths. Merchants here measure everything — including gratitude — in percent.',
    restored: 'The delta runs clear. You can read a price tag, a tip, and a trick discount at a glance, which frightens merchants everywhere.',
    skills: [
      { id: 'decops', name: 'Glasswork', desc: 'Decimal arithmetic with a steady hand.', numen: ['Dotessa', 'Carries her point wherever she drifts.'] },
      { id: 'percent', name: 'Hundredfold Eye', desc: 'Percent of a quantity, part and whole.', numen: ['Centavo', 'Sees every whole as a hundred sparks.'] },
      { id: 'percchange', name: 'Turning Tide', desc: 'Percent increase, decrease, and change.', numen: ['Deltoid', 'Measures how far the tide has turned.'] },
    ]
  },
  {
    id: 'ratio', name: 'Ratio Reef', arc: 'The Law of Proportion', x: 470, y: 395, hue: '#f2c14e',
    lore: 'Coral that grows in strict proportion — three arms of red for every five of gold. Break the ratio and the reef breaks you.',
    restored: 'The reef rebuilds itself arm by arm, three to five, exactly as the old law says. It hums when you swim past.',
    skills: [
      { id: 'unitrate', name: 'Price of One', desc: 'Unit rates — per one, per hour, per lumin.', numen: ['Perion', 'Asks the price of one, always.'] },
      { id: 'proportion', name: 'Reef Law', desc: 'Solving proportions.', numen: ['Analogos', 'If this is to that, it already knows the rest.'] },
      { id: 'scale', name: 'Cartography', desc: 'Scale, maps, and similar figures.', numen: ['Magnifex', 'Grows and shrinks but never distorts.'] },
    ]
  },
  {
    id: 'exponent', name: 'Exponent Peaks', arc: 'The Doubling Stairs', x: 615, y: 470, hue: '#e06fb2',
    lore: 'Mountains that double in height with every step of the climb. The peak-keepers wrote the width of the sea on a grain of sand, in a notation of their own.',
    restored: 'The doubling stairs stand firm. From the summit you can see numbers too large to say aloud — and now, how to write them small.',
    skills: [
      { id: 'powers', name: 'Staircount', desc: 'Powers, squares, cubes, and roots.', numen: ['Squarrel', 'Stacks its acorns in perfect squares.'] },
      { id: 'exponlaws', name: 'Keepers’ Laws', desc: 'The laws of exponents.', numen: ['Indicium', 'Adds journeys by multiplying steps.'] },
      { id: 'scinot', name: 'Grain-Script', desc: 'Scientific notation, vast and vanishing.', numen: ['Notarion', 'Writes the width of the sea on a grain of sand.'] },
    ]
  },
  {
    id: 'algebra', name: 'Algebra Vale', arc: 'The Hidden Letter', x: 765, y: 415, hue: '#f26b8a',
    lore: 'A green valley where one traveler is always missing from every story, known only as x. The vale-folk have hunted the hidden letter for a thousand years.',
    restored: 'The hidden letter steps out of the mist and bows. It was never hiding, it says — you simply hadn’t balanced the question.',
    skills: [
      { id: 'onestep', name: 'First Unmasking', desc: 'One-step equations.', numen: ['Xyphling', 'Hides in plain sight and waits to be found.'] },
      { id: 'twostep', name: 'The Balancing', desc: 'Two-step and both-sides equations.', numen: ['Balancioth', 'Sleeps only when both pans are level.'] },
      { id: 'distribute', name: 'Open Doors', desc: 'Distributing, expanding, combining like terms.', numen: ['Parenthea', 'Opens every door she is handed.'] },
    ]
  },
  {
    id: 'geometry', name: 'Geometry Grove', arc: 'Shape and Measure', x: 850, y: 290, hue: '#7ed67e',
    lore: 'Trees that grow in perfect polygons; a grove floor tiled without a single gap. The oldest tree is a right triangle, and it is very proud of its longest side.',
    restored: 'The grove measures itself again — every angle accounted for, every shortcut proven. The old triangle creaks approvingly.',
    skills: [
      { id: 'area', name: 'Tilewright', desc: 'Perimeter, area, and circles.', numen: ['Tessella', 'Tiles the shore without a single gap.'] },
      { id: 'angles', name: 'Degreecraft', desc: 'Angles in lines, triangles, polygons.', numen: ['Goniad', 'Bows at exactly the right degree.'] },
      { id: 'pythag', name: 'The Long Side', desc: 'The Pythagorean theorem and distance.', numen: ['Hypotenyx', 'Takes the shortcut, and proves it.'] },
    ]
  },
  {
    id: 'func', name: 'Function Falls', arc: 'The Machine of Rules', x: 700, y: 195, hue: '#6df2e0',
    lore: 'A waterfall that takes what you throw in and returns it transformed — always by the same rule. Feed it a 3, learn its secret.',
    restored: 'The falls run every rule you ask of them: lines, curves, and two truths crossing. The water applauds, which is unusual for water.',
    skills: [
      { id: 'linear', name: 'Line-Reading', desc: 'Linear functions, slope, evaluation.', numen: ['Slopern', 'Climbs the same rise for every run.'] },
      { id: 'quadratic', name: 'Arc of Falling', desc: 'Quadratics — factoring and roots.', numen: ['Parabelle', 'Falls, and turns falling into flight.'] },
      { id: 'systems', name: 'Two Truths', desc: 'Systems of equations.', numen: ['Twindle', 'Speaks two truths and lives where they cross.'] },
    ]
  },
  {
    id: 'trig', name: 'Trig Temple', arc: 'The Circle Dance', x: 520, y: 155, hue: '#f2a25c',
    lore: 'A ring-temple where monks dance the unit circle at dawn, each step a sixth of π. They measure the world with triangles and modesty.',
    restored: 'The circle dance turns unbroken, dawn after dawn. You know every step now — and every step’s sine.',
    skills: [
      { id: 'righttri', name: 'Triangle Sight', desc: 'Sine, cosine, tangent in right triangles.', numen: ['Triquetra', 'Sees the whole triangle in one angle.'] },
      { id: 'unitcircle', name: 'The Round Dance', desc: 'The unit circle, radians, exact values.', numen: ['Radian', 'Dances the circle in steps of π.'] },
      { id: 'trigsolve', name: 'Many Faces', desc: 'Identities and solving trig equations.', numen: ['Identra', 'Wears many faces, all of them equal.'] },
    ]
  },
  {
    id: 'chance', name: 'Chance Mire', arc: 'The Fog of Maybe', x: 330, y: 140, hue: '#b78ef2',
    lore: 'A marsh where nothing is certain and everything is likely. The mire-witches deal cards, roll bones, and are never, ever surprised.',
    restored: 'The fog thins to exactly the thickness you’d expect, on average. The witches deal you in; you know the odds before the cards land.',
    skills: [
      { id: 'probability', name: 'Bonecasting', desc: 'Probability of events, single and chained.', numen: ['Fortuna', 'Never certain, never surprised.'] },
      { id: 'counting', name: 'Every Way', desc: 'Counting, permutations, combinations.', numen: ['Permutox', 'Knows every way the story could go.'] },
      { id: 'statistics', name: 'Middle Ground', desc: 'Mean, median, and reading a crowd.', numen: ['Meridian', 'Stands in the middle of every crowd.'] },
    ]
  },
  {
    id: 'calculus', name: 'Calculus Caldera', arc: 'The Ever-Approaching', x: 745, y: 70, hue: '#f2c14e',
    lore: 'The volcano at the top of the world, where the Null has made its throne. Here motion itself is studied: the art of the instant, and the sum of infinite whispers.',
    restored: 'The caldera cools. The Null, unsolved at last, thins into ordinary night sky — and every star above Numera is a Numen, home. You are the Grand Mathfinder.',
    skills: [
      { id: 'limits', name: 'The Approach', desc: 'Limits — arriving without touching.', numen: ['Asymptoze', 'Forever arriving, never quite there.'] },
      { id: 'derivative', name: 'Art of the Instant', desc: 'Derivatives and rates of change.', numen: ['Fluxion', 'Feels the world change as it happens.'] },
      { id: 'integral', name: 'Infinite Whispers', desc: 'Integrals — gathering the whole.', numen: ['Summanta', 'Gathers infinite whispers into one voice.'] },
    ]
  },
];

const SKILLS = {}; // id -> {skill, island, idx}
ISLANDS.forEach((isl, ii) => isl.skills.forEach((sk, si) => { SKILLS[sk.id] = { sk, isl, ii, si, n: Object.keys(SKILLS).length }; }));
const TOTAL_SKILLS = Object.keys(SKILLS).length;

/* Mental-math whispers — shown before a question when the previous
   answer took too long. Two per art, attributed to its Numen. */
const TIPS = {
  add: ['Round, then repair: 297 + 58 → 300 + 58, then give back 3.', 'Add left to right: tens first, then ones. 47 + 38 → 70, then 15 → 85.', 'Make a ten: 8 + 7 → take 2 from the 7 to make 10, then 5 more → 15. Works for any size: 68 + 27 → 70 + 25.'],
  sub: ['Count up, not down: 83 − 47 → from 47, add 3 to reach 50, then 33 more.', 'Round what you subtract: −29 becomes −30, then hand 1 back.', 'Same distance, easier numbers: shift both by the same amount. 1000 − 637 = 999 − 636 (no borrowing!) = 363.'],
  mul: ['Break a factor apart: 7 × 46 = 7×40 + 7×6.', '×5 is ×10 then half. ×9 is ×10 minus one of them.', 'Double-and-halve: 16 × 25 = 8 × 50 = 4 × 100 = 400. Trade factors of 2 until one side is friendly.'],
  div: ['Divide in steps: ÷6 is ÷2, then ÷3.', 'Ask how many whole TENS of the divisor fit first, then finish the rest.', 'Check with the multiplication table backwards: 84 ÷ 7 asks “7 times what is 84?” — count 7×10 = 70, then 2 more.'],
  negadd: ['Think temperature: −7 + 10 is warming 10° from −7, landing at 3.', 'Subtracting a negative removes a debt — that always makes you richer.', 'Different signs? Subtract the sizes and keep the sign of the bigger one: −12 + 5 → 12 − 5 = 7, bigger was negative → −7.'],
  negmul: ['Count the minus signs: an even count turns positive, odd stays negative.', 'Ignore the signs, multiply the sizes, restore the sign at the very end.', 'Dividing follows the same sign rule as multiplying: −24 ÷ 6 = −4, −24 ÷ −6 = 4.'],
  orderops: ['Scan before you compute: circle every × and ÷ first; + and − wait their turn.', 'Exponents outrank everything except parentheses.', 'Left to right only breaks ties: 12 ÷ 3 × 2 is (12 ÷ 3) × 2 = 8, not 12 ÷ 6.'],
  fracsimp: ['Both even? Halve both. One ends in 0 or 5 and so does the other? Try 5.', 'Digit-sum trick: if both digit-sums divide by 3, the whole fraction does.', 'Divide by the biggest factor you can spot right away; one big cut beats three small ones. 24/36 → both ÷12 → 2/3.'],
  fracadd: ['Same bottom? Add only the tops — the bottom never adds.', 'A quick common bottom is one denominator times the other; simplify after.', 'Mixed numbers: add the wholes and the fractions separately, then carry if the fraction tops 1.'],
  fracmul: ['Cancel before you multiply: cross-simplify any top with any bottom.', 'To divide, flip the second fraction and multiply. Every time, no exceptions.', 'Multiplying by a fraction less than 1 shrinks; dividing by it grows. Use that to sanity-check the answer size.'],
  decops: ['Think in money: 3.4 + 2.8 is $3.40 + $2.80.', 'For ×, drop the points, multiply whole numbers, then place the decimals back.', 'Line up the decimal points, not the last digits — pad with zeros: 3.4 − 1.25 → 3.40 − 1.25.'],
  percent: ['Find 10% by sliding the point left; 5% is half of that, 20% is double.', 'p% of n equals n% of p: 8% of 50 = 50% of 8 = 4.', 'Build from 1%: slide the point two places left, then multiply. 7% of 300 → 1% is 3, so 21.'],
  percchange: ['+20% is one multiply: ×1.2. And −20% is ×0.8.', 'Chained changes multiply: +10% then −10% is ×1.1 × 0.9 = ×0.99 — not zero.', 'Percent change = (new − old) ÷ old. Always divide by where you STARTED.'],
  unitrate: ['Always price ONE first: total ÷ count, then scale.', 'Compare per-one prices, never the sticker prices.', 'Slide to a friendly count: 3 for $4.50 → 1 for $1.50, so 10 for $15.'],
  proportion: ['Cross-multiply: in a/b = c/d, the diagonals a·d and b·c are equal.', 'Ask how the known pair scaled; the unknown pair scales identically.', 'Simplify one ratio first: 12/18 = 2/3, then scale 2/3 up to the new bottom.'],
  scale: ['Scale factor = new ÷ old, always in that order.', 'Lengths scale by s, areas by s², volumes by s³.', 'Going smaller? The factor is below 1. Multiply by ½ rather than dividing by 2 — same thing, fewer mistakes.'],
  powers: ['Squares near round numbers: 19² = (20−1)² = 400 − 40 + 1.', 'Keep anchors in your pocket: 2¹⁰ = 1024, 15² = 225, 25² = 625.', 'Squares ending in 5: 35² → 3×4 = 12, then tack on 25 → 1225. Always.'],
  exponlaws: ['Same base multiplied? ADD exponents. A power of a power? MULTIPLY them.', 'x⁰ = 1 — a journey of zero steps still stands somewhere.', 'Same base divided? SUBTRACT exponents. A negative exponent just means “flip it under 1”.'],
  scinot: ['Count point-slides, not zeros. Slides left = positive exponent.', 'Multiply the fronts, add the exponents; re-slide once if the front reaches 10.', 'Sanity-check size: 10³ is a thousand, 10⁶ a million, 10⁹ a billion — say the word out loud.'],
  onestep: ['Don’t solve — UNDO. Whatever touches x, do the opposite to both sides.', 'Check by feeding the answer back in; it should balance in your head.', 'Fractions on x? Multiply both sides by the bottom first — clear the fraction before anything else.'],
  twostep: ['Peel in reverse order: undo + and − first, × and ÷ last.', 'x on both sides? Subtract the smaller x-term from each side first.', 'Read the equation as a story: x was multiplied by 3, then 5 was added. Undo the story backwards.'],
  distribute: ['The outside number multiplies EVERY term inside — count the terms.', '(x+a)(x+b): the middle number is a+b, the last is a·b.', 'Negative outside? It flips EVERY sign inside: −(2x − 7) = −2x + 7.'],
  area: ['Composite shape? Cut it into rectangles — or subtract the hole.', 'A triangle is half its bounding rectangle. That is the whole story of ½bh.', 'Circles: area is πr², circumference 2πr. The one with the square is the one measured in squares.'],
  angles: ['Anchor to three facts: line 180°, turn 360°, triangle 180°.', 'Regular n-gon: each exterior angle is 360/n; the interior is its supplement.', 'Parallel lines cut by a transversal make only two angle sizes — and they add to 180°.'],
  pythag: ['Know the families: 3-4-5, 5-12-13, 8-15-17 — and every multiple of them.', 'The hypotenuse sits alone: c² = a² + b², never mixed in with a leg.', 'Looking for a leg? Subtract: a² = c² − b². The hypotenuse is always the biggest number.'],
  linear: ['Slope is rise over run: subtract the y’s over the x’s, same order.', 'In y = mx + b: b is where you start, m is how you move.', 'Parallel lines share a slope; perpendicular slopes multiply to −1 (flip and negate).'],
  quadratic: ['Factoring x² + bx + c: find two numbers that MULTIPLY to c, ADD to b.', 'The vertex hides at x = −b/2a — symmetry gives it away.', 'Discriminant b² − 4ac: positive → two roots, zero → one, negative → none. Check it before you solve.'],
  systems: ['Stack the equations and subtract — one letter should vanish.', 'If an equation hands you y alone, substitute it in; don’t fight it.', 'Multiply one equation so a coefficient matches the other, then add or subtract to cancel it.'],
  righttri: ['SOH-CAH-TOA — pick the two sides your angle can actually see.', 'Ratios carry no units: a 3-4-5 answer holds at any size.', 'Need a side? Set up tan/sin/cos with the angle, cross-multiply, and keep the unknown on top.'],
  unitcircle: ['The 30-45-60 sines just count up: √1/2, √2/2, √3/2.', 'Cosine is the x-shadow, sine the y-shadow, of a point walking the circle.', 'Quadrant signs spell “All Students Take Calculus”: all, sin, tan, cos positive in I, II, III, IV.'],
  trigsolve: ['sin² + cos² = 1 turns either ratio into the other.', 'One answer per quadrant where the sign fits — sketch the circle first.', 'Reference angle first, then reflect it into every quadrant where the sign is right.'],
  probability: ['Probability = wanted ÷ possible. Count both before you divide.', '“And” multiplies; “or” adds (when the events can’t both happen).', 'Complement trick: P(at least one) = 1 − P(none). Often the easier side to count.'],
  counting: ['Draw a blank slot per choice, fill in the counts, multiply across.', 'Order matters → permutation. Only the group matters → divide the repeats out.', 'Choose-2 shortcut: n(n−1)/2. Ten people shake hands → 10×9/2 = 45.'],
  statistics: ['The mean is a balance point: total = mean × count. Use that backwards.', 'The median needs sorted data — sort first, then take the middle.', 'A new value above the mean pulls the mean up; the median only moves if it crosses the middle.'],
  limits: ['Try substituting first — most limits simply want the value there.', 'Got 0/0? Something cancels. Factor and look for the hole.', 'At infinity, only the highest powers matter — compare the top and bottom degrees.'],
  derivative: ['Power rule chant: bring it down in front, drop the power by one.', 'A derivative is a slope — sanity-check its sign against the graph in your head.', 'Constants vanish, and a constant multiplier just rides along: d/dx of 5x³ is 15x².'],
  integral: ['Integrate = reverse power rule: raise by one, divide by the new power.', 'A definite integral is area — estimate with a rectangle to sanity-check.', 'Never forget + C on an indefinite integral — and check by differentiating your answer back.'],
};

const LEVEL_NAMES = ['Novice of the Shore', 'Lantern Bearer', 'Tide Counter', 'Reef Apprentice', 'Chart Reader', 'Sign Walker', 'Ratio Warden', 'Peak Climber', 'Letter Hunter', 'Grove Surveyor', 'Fall Whisperer', 'Circle Dancer', 'Fog Piercer', 'Flux Adept', 'Null Challenger', 'Grand Mathfinder'];
const lvlName = l => LEVEL_NAMES[Math.min(LEVEL_NAMES.length - 1, Math.floor((l - 1) / 3))];
const xpNeed = l => Math.round(100 * Math.pow(l, 1.35));
const TIER_NAMES = ['', 'Bronze Trial', 'Silver Trial', 'Gold Trial'];
const LEITNER_DAYS = [0, 1, 3, 7, 16, 35]; // index by box 1..5
/* ================================================================
   PROBLEM GENERATORS — one per skill, three tiers each.
   Each returns:
     input: {q, hint, explain, type:'input', check(str), ansText}
     mc:    {q, hint, explain, type:'mc', choices, ai}
   ================================================================ */
function inQ(q, ans, hint, explain, tol) {
  return { q, hint, explain, type: 'input', ans, check: s => numEq(s, ans, tol), ansText: fmt(ans) };
}
function frQ(q, n, d, hint, explain) {
  [n, d] = simp(n, d);
  return { q, hint, explain, type: 'input', check: s => numEq(s, n / d, 1e-4), ansText: frStr(n, d) };
}
function mcQ(q, correct, wrongs, hint, explain) {
  const seen = new Set([String(correct)]);
  const w = [];
  for (const x of wrongs) { const k = String(x); if (!seen.has(k)) { seen.add(k); w.push(x); } if (w.length === 3) break; }
  const ch = shuffle([correct, ...w]);
  return { q, hint, explain, type: 'mc', choices: ch.map(String), ai: ch.indexOf(correct), ansText: String(correct) };
}
const nearInts = v => shuffle([v + 1, v - 1, v + 2, v - 2, v + 10, v - 10].filter(x => x !== v)).slice(0, 5);

const GEN = {
  /* ---------- Ember Shore ---------- */
  add(t) {
    if (t === 1) { const a = ri(12, 89), b = ri(12, 89); return inQ(`${a} + ${b} = ?`, a + b, 'Add the ones first, then the tens.', `${a} + ${b} = ${a + b}.`); }
    if (t === 2) { const a = ri(120, 899), b = ri(120, 899); return inQ(`${a} + ${b} = ?`, a + b, 'Stack them: ones, tens, hundreds — carry when a column passes 9.', `${a} + ${b} = ${a + b}.`); }
    const a = ri(45, 400), b = ri(45, 400), c = ri(45, 400);
    return inQ(`${a} + ${b} + ${c} = ?`, a + b + c, 'Add two of them first; a running total keeps the tide steady.', `${a} + ${b} = ${a + b}, then + ${c} = ${a + b + c}.`);
  },
  sub(t) {
    if (t === 1) { const b = ri(11, 60), a = b + ri(5, 39); return inQ(`${a} − ${b} = ?`, a - b, 'Count up from the smaller number to the larger.', `${a} − ${b} = ${a - b}.`); }
    if (t === 2) { const b = ri(120, 700), a = b + ri(80, 299); return inQ(`${a} − ${b} = ?`, a - b, 'Borrow from the next column when a digit is too small.', `${a} − ${b} = ${a - b}.`); }
    const b = ri(150, 800), c = ri(50, 300), a = b + c + ri(40, 200);
    return inQ(`${a} − ${b} − ${c} = ?`, a - b - c, 'Take one bite at a time, left to right.', `${a} − ${b} = ${a - b}, then − ${c} = ${a - b - c}.`);
  },
  mul(t) {
    if (t === 1) { const a = ri(3, 12), b = ri(3, 12); return inQ(`${a} × ${b} = ?`, a * b, `Think of ${a} rows of ${b}.`, `${a} × ${b} = ${a * b}.`); }
    if (t === 2) { const a = ri(13, 79), b = ri(3, 9); return inQ(`${a} × ${b} = ?`, a * b, `Split it: ${a} = ${Math.floor(a / 10) * 10} + ${a % 10}, multiply each part.`, `${Math.floor(a / 10) * 10}×${b} + ${a % 10}×${b} = ${a * b}.`); }
    const a = ri(12, 39), b = ri(12, 29);
    return inQ(`${a} × ${b} = ?`, a * b, `Fold it: ${a}×${b} = ${a}×${Math.floor(b / 10) * 10} + ${a}×${b % 10}.`, `${a}×${Math.floor(b / 10) * 10} = ${a * Math.floor(b / 10) * 10}, ${a}×${b % 10} = ${a * (b % 10)}; sum = ${a * b}.`);
  },
  div(t) {
    if (t === 1) { const b = ri(3, 12), q = ri(3, 12); return inQ(`${b * q} ÷ ${b} = ?`, q, `How many ${b}s make ${b * q}?`, `${b} × ${q} = ${b * q}, so the answer is ${q}.`); }
    if (t === 2) { const b = ri(3, 9), q = ri(21, 99); return inQ(`${b * q} ÷ ${b} = ?`, q, 'Divide the hundreds/tens first, then the rest.', `${b} × ${q} = ${b * q}.`); }
    const b = ri(11, 25), q = ri(12, 40);
    return inQ(`${b * q} ÷ ${b} = ?`, q, `Estimate: ${b} × 10 = ${b * 10}. How many more?`, `${b} × ${q} = ${b * q}.`);
  },

  /* ---------- Hollow of Signs ---------- */
  negadd(t) {
    if (t === 1) { const a = ri(2, 15), b = ri(2, 15); return inQ(`${-a} + ${b} = ?`, b - a, 'Start at −' + a + ' on the number line and walk right ' + b + '.', `${-a} + ${b} = ${b - a}.`); }
    if (t === 2) { const a = ri(5, 30), b = ri(5, 30); return inQ(`${-a} − ${b} = ?`, -a - b, 'Subtracting a positive walks further left.', `${-a} − ${b} = ${-a - b}.`); }
    const a = ri(3, 20), b = ri(3, 20);
    return inQ(`${a} − (−${b}) = ?`, a + b, 'Subtracting a negative is adding.', `${a} − (−${b}) = ${a} + ${b} = ${a + b}.`);
  },
  negmul(t) {
    if (t === 1) { const a = ri(2, 12), b = ri(2, 12), s = pick([-1, 1]); const x = s * a, y = -b; return inQ(`(${x}) × (${y}) = ?`, x * y, 'Same signs give +, different signs give −.', `Signs ${s < 0 ? 'match: positive' : 'differ: negative'} → ${x * y}.`); }
    if (t === 2) { const b = ri(2, 12), q = ri(2, 12), s1 = pick([-1, 1]), s2 = pick([-1, 1]); const a = s1 * b * q; const d = s2 * b; return inQ(`(${a}) ÷ (${d}) = ?`, a / d, 'Divide the sizes, then settle the sign.', `${Math.abs(a)} ÷ ${Math.abs(d)} = ${Math.abs(a / d)}, sign → ${a / d}.`); }
    const n = pick([2, 3]), a = ri(2, 5), v = Math.pow(-a, n);
    return inQ(`(−${a})<sup>${n}</sup> = ?`, v, n === 2 ? 'An even power of a negative is positive.' : 'An odd power of a negative stays negative.', `(−${a})${n === 2 ? '×(−' + a + ')' : '×(−' + a + ')×(−' + a + ')'} = ${v}.`);
  },
  orderops(t) {
    if (t === 1) { const a = ri(2, 12), b = ri(2, 9), c = ri(2, 9); return inQ(`${a} + ${b} × ${c} = ?`, a + b * c, 'Multiplication before addition — always.', `${b} × ${c} = ${b * c} first, then + ${a} = ${a + b * c}.`); }
    if (t === 2) { const a = ri(2, 9), b = ri(2, 9), c = ri(2, 6), d = ri(2, 15); return inQ(`(${a} + ${b}) × ${c} − ${d} = ?`, (a + b) * c - d, 'Parentheses first, then multiply, then subtract.', `(${a + b}) × ${c} = ${(a + b) * c}, − ${d} = ${(a + b) * c - d}.`); }
    const a = ri(2, 10), b = ri(2, 5), c = ri(2, 4), d = ri(1, 10);
    return inQ(`${a} + ${b} × ${c}<sup>2</sup> − ${d} = ?`, a + b * c * c - d, 'Exponents, then multiplication, then left-to-right.', `${c}² = ${c * c}; ${b}×${c * c} = ${b * c * c}; ${a} + ${b * c * c} − ${d} = ${a + b * c * c - d}.`);
  },

  /* ---------- Fraction Cove ---------- */
  fracsimp(t) {
    if (t <= 2) {
      const d0 = ri(2, t === 1 ? 6 : 9);
      let n0 = ri(1, d0 - 1);
      while (gcd(n0, d0) !== 1) n0 = ri(1, d0 - 1);
      const g = ri(2, t === 1 ? 4 : 7);
      const [sn, sd] = simp(n0, d0);
      if (t === 1 || pick([0, 1]) === 0) {
        const chk = s => { const m = String(s).trim().match(/^(-?\d+)\s*\/\s*(\d+)$/); if (!m) return sd === 1 && numEq(s, sn); return +m[1] === sn && +m[2] === sd; };
        return { q: `Simplify fully: ${fr(n0 * g, d0 * g)}`, hint: `Both parts divide by ${gcd(n0 * g, d0 * g)}.`, explain: `Divide top and bottom by ${gcd(n0 * g, d0 * g)}: ${frStr(n0, d0)}.`, type: 'input', check: chk, ansText: frStr(sn, sd) };
      }
      return inQ(`${fr(n0, d0)} = ${fr('?', d0 * g)} — find the missing top.`, n0 * g, `The bottom was multiplied by ${g}; do the same on top.`, `${n0} × ${g} = ${n0 * g}.`);
    }
    const d = pick([3, 4, 5, 6, 8]), fracs = shuffle([[1, d], [d - 1, d], [Math.ceil(d / 2), d]]).slice(0, 3);
    const best = fracs.reduce((m, f) => f[0] / f[1] > m[0] / m[1] ? f : m);
    return mcQ('Which fraction is largest?', frStr(best[0], best[1]), fracs.filter(f => f !== best).map(f => frStr(f[0], f[1])), 'Compare each to one half, or give them a common bottom.', `${frStr(best[0], best[1])} = ${fmt(best[0] / best[1])}, the largest.`);
  },
  fracadd(t) {
    if (t === 1) { const d = pick([5, 6, 7, 8, 9]), a = ri(1, d - 2), b = ri(1, d - 1 - a); return frQ(`${fr(a, d)} + ${fr(b, d)} = ?`, a + b, d, 'Same bottoms: just add the tops.', `${a} + ${b} = ${a + b}, so ${frStr(a + b, d)}.`); }
    if (t === 2) { const d1 = pick([2, 3, 4]), d2 = pick([3, 4, 5, 6].filter(x => x !== d1)), a = ri(1, d1 - 1 || 1), b = ri(1, d2 - 1); const L = d1 * d2 / gcd(d1, d2); const n = a * L / d1 + b * L / d2; return frQ(`${fr(a, d1)} + ${fr(b, d2)} = ?`, n, L, `A common bottom for ${d1} and ${d2} is ${L}.`, `${frStr(a * L / d1, L)} + ${frStr(b * L / d2, L)} = ${frStr(n, L)}.`); }
    const w1 = ri(1, 3), d = pick([3, 4, 5]), a = ri(1, d - 1), w2 = ri(1, 2), b = ri(1, d - 1);
    const n = (w1 * d + a) + (w2 * d + b);
    return frQ(`${w1} ${fr(a, d)} + ${w2} ${fr(b, d)} = ? <span class="ctx">(answer as a fraction or mixed number)</span>`, n, d, 'Turn each into an improper fraction first.', `${frStr(w1 * d + a, d)} + ${frStr(w2 * d + b, d)} = ${frStr(n, d)}.`);
  },
  fracmul(t) {
    if (t === 1) { const a = ri(1, 4), b = ri(2, 5), c = ri(1, 4), d = ri(2, 5); return frQ(`${fr(a, b)} × ${fr(c, d)} = ?`, a * c, b * d, 'Multiply straight across: tops together, bottoms together.', `${a}×${c} = ${a * c}, ${b}×${d} = ${b * d} → ${frStr(a * c, b * d)}.`); }
    if (t === 2) { const a = ri(1, 4), b = ri(2, 5), c = ri(1, 4), d = ri(2, 5); return frQ(`${fr(a, b)} ÷ ${fr(c, d)} = ?`, a * d, b * c, 'Dividing is multiplying by the flip (the somersault).', `${fr(a, b)} × ${fr(d, c)} → ${frStr(a * d, b * c)}.`); }
    const w = ri(1, 2), b2 = pick([2, 3, 4]), a2 = ri(1, b2 - 1), c = ri(2, 4), d2 = ri(2, 5);
    const n1 = w * b2 + a2;
    return frQ(`${w} ${fr(a2, b2)} × ${fr(c, d2)} = ?`, n1 * c, b2 * d2, 'Improper fraction first, then straight across.', `${frStr(n1, b2)} × ${frStr(c, d2)} = ${frStr(n1 * c, b2 * d2)}.`);
  },

  /* ---------- Glass Delta ---------- */
  decops(t) {
    if (t === 1) { const a = ri(11, 99) / 10, b = ri(11, 99) / 10; return inQ(`${fmt(a)} + ${fmt(b)} = ?`, Math.round((a + b) * 10) / 10, 'Line up the decimal points.', `${fmt(a)} + ${fmt(b)} = ${fmt(a + b)}.`, 1e-4); }
    if (t === 2) { const a = ri(11, 79) / 10, b = ri(2, 9); return inQ(`${fmt(a)} × ${b} = ?`, Math.round(a * b * 10) / 10, `Compute ${a * 10} × ${b}, then place one decimal digit back.`, `${a * 10} × ${b} = ${a * 10 * b}, so ${fmt(a * b)}.`, 1e-4); }
    const d = pick([0.2, 0.25, 0.4, 0.5, 0.8]), q = ri(3, 24), a = Math.round(d * q * 100) / 100;
    return inQ(`${fmt(a)} ÷ ${fmt(d)} = ?`, q, 'Multiply both numbers by 100 to clear the points.', `${fmt(a * 100)} ÷ ${fmt(d * 100)} = ${q}.`, 1e-4);
  },
  percent(t) {
    if (t === 1) { const p = pick([10, 20, 25, 50, 75, 5]), n = ri(2, 20) * 20; return inQ(`What is ${p}% of ${n}?`, n * p / 100, `${p}% means ${p} out of every 100.`, `${n} × ${p}/100 = ${n * p / 100}.`); }
    if (t === 2) { const b = pick([20, 25, 40, 50, 80, 200]), p = pick([10, 20, 25, 30, 40, 60, 75]), a = b * p / 100; return inQ(`${fmt(a)} is what percent of ${b}? <span class="ctx">(answer without the % sign)</span>`, p, `Divide the part by the whole: ${fmt(a)}/${b}.`, `${fmt(a)} ÷ ${b} = ${fmt(a / b)} = ${p}%.`); }
    const p = pick([20, 25, 40, 50, 10]), n = ri(2, 12) * 10, a = n * p / 100;
    return inQ(`${p}% of what number is ${fmt(a)}?`, n, `Work backward: divide ${fmt(a)} by ${p}/100.`, `${fmt(a)} ÷ 0.${p < 10 ? '0' + p : p} = ${n}.`);
  },
  percchange(t) {
    if (t === 1) { const n = ri(2, 12) * 50, p = pick([10, 20, 30, 50]); return inQ(`A relic worth ${n} lumins rises in value by ${p}%. New value?`, n * (100 + p) / 100, `Add ${p}% of ${n} to the original.`, `${n} + ${n * p / 100} = ${n * (100 + p) / 100}.`); }
    if (t === 2) { const a = ri(2, 10) * 20, p = pick([10, 25, 50, 75, 100]), b = a * (100 + p) / 100; return inQ(`A tide-marker rose from ${a} to ${fmt(b)}. What percent increase? <span class="ctx">(answer without the % sign)</span>`, p, 'Percent change = change ÷ original × 100.', `(${fmt(b)} − ${a}) ÷ ${a} × 100 = ${p}%.`); }
    const n = ri(2, 8) * 100, p = pick([10, 20, 50]), q = pick([10, 25, 50]);
    const v = n * (100 + p) / 100 * (100 - q) / 100;
    return inQ(`A pearl costs ${n} lumins, rises ${p}%, then falls ${q}%. Final price?`, v, 'Apply the changes one at a time — they don’t cancel.', `${n} → ${n * (100 + p) / 100} → ${fmt(v)}.`, 1e-3);
  },

  /* ---------- Ratio Reef ---------- */
  unitrate(t) {
    if (t === 1) { const k = ri(3, 9), u = ri(2, 15); return inQ(`${k} reef-shells cost ${k * u} lumins. Cost per shell?`, u, `Divide the total by ${k}.`, `${k * u} ÷ ${k} = ${u} lumins each.`); }
    if (t === 2) { const h = ri(2, 6), v = ri(3, 15) * 5; return inQ(`A current drifts ${h * v} leagues in ${h} hours. Leagues per hour?`, v, 'Rate = distance ÷ time.', `${h * v} ÷ ${h} = ${v}.`); }
    const u = ri(2, 9), k1 = ri(3, 6), k2 = ri(7, 12), p1 = k1 * (u + 1), p2 = k2 * u;
    return mcQ(`Which is the better buy for kelp-cakes?`, `${k2} for ${p2} lumins`, [`${k1} for ${p1} lumins`], `Compare the price of one cake in each offer.`, `${p2}÷${k2} = ${u} per cake beats ${p1}÷${k1} = ${u + 1}.`);
  },
  proportion(t) {
    if (t === 1) { const a = ri(2, 6), b = ri(2, 6), k = ri(2, 6); return inQ(`Solve for x:  ${fr(a, b)} = ${fr('x', b * k)}`, a * k, `The bottom grew ${k}×; the top must too.`, `x = ${a} × ${k} = ${a * k}.`); }
    if (t === 2) { const s = ri(2, 4), f = ri(2, 5), mult = ri(2, 4); return inQ(`A reef-broth for ${s} eels needs ${f} cups of brine. How many cups for ${s * mult} eels?`, f * mult, 'Scale both sides of the recipe equally.', `${s * mult}÷${s} = ${mult}× the recipe → ${f} × ${mult} = ${f * mult} cups.`); }
    const c = ri(2, 5), d = ri(2, 5), a = c * ri(2, 5);
    return inQ(`Solve for x:  ${fr(a, 'x')} = ${fr(c, d)}`, a * d / c, 'Cross-multiply: a×d = c×x.', `${a} × ${d} = ${c}x → x = ${a * d}/${c} = ${fmt(a * d / c)}.`);
  },
  scale(t) {
    if (t === 1) { const k = pick([5, 10, 20, 25, 50]), cm = ri(2, 9); return inQ(`A chart's scale is 1 cm : ${k} leagues. How many leagues is ${cm} cm?`, cm * k, 'Each centimeter stands for ' + k + ' leagues.', `${cm} × ${k} = ${cm * k} leagues.`); }
    if (t === 2) { const a = ri(2, 6), b = ri(3, 8), k = ri(2, 4); return inQ(`Two similar sails: one has sides ${a} and ${b}; the larger has shortest side ${a * k}. Its longer side?`, b * k, `The scale factor is ${a * k}÷${a}.`, `Factor ${k} → ${b} × ${k} = ${b * k}.`); }
    const s = ri(2, 5);
    return inQ(`A map is enlarged by scale factor ${s}. Area grows by what factor?`, s * s, 'Length scales by s, so area scales by s × s.', `${s}² = ${s * s}.`);
  },

  /* ---------- Exponent Peaks ---------- */
  powers(t) {
    if (t === 1) { if (pick([0, 1])) { const n = ri(3, 15); return inQ(`${n}<sup>2</sup> = ?`, n * n, `${n} × ${n}.`, `${n}² = ${n * n}.`); } const n = ri(2, 7); return inQ(`${n}<sup>3</sup> = ?`, n ** 3, `${n} × ${n} × ${n}.`, `${n}³ = ${n ** 3}.`); }
    if (t === 2) { if (pick([0, 1])) { const n = ri(4, 20); return inQ(`√${n * n} = ?`, n, `What number times itself gives ${n * n}?`, `${n} × ${n} = ${n * n}, so √${n * n} = ${n}.`); } const n = ri(2, 6); return inQ(`∛${n ** 3} = ?`, n, 'Which number cubed gives this?', `${n}³ = ${n ** 3}.`); }
    if (pick([0, 1])) { const a = ri(2, 200); return inQ(`${a}<sup>0</sup> = ?`, 1, 'Anything (nonzero) to the power 0…', 'Any nonzero number to the 0 is 1.'); }
    const a = pick([2, 3, 4, 5]), n = ri(1, 3);
    return frQ(`${a}<sup>−${n}</sup> = ? <span class="ctx">(answer as a fraction)</span>`, 1, a ** n, 'A negative exponent flips into a fraction.', `${a}⁻${n} = 1/${a}${n > 1 ? '^' + n : ''} = ${frStr(1, a ** n)}.`);
  },
  exponlaws(t) {
    if (t === 1) { const a = ri(2, 7), b = ri(2, 7); return inQ(`x<sup>${a}</sup> · x<sup>${b}</sup> = x<sup>?</sup> — find the exponent.`, a + b, 'Same base multiplied: add the exponents.', `${a} + ${b} = ${a + b}.`); }
    if (t === 2) { if (pick([0, 1])) { const b = ri(2, 6), a = b + ri(1, 6); return inQ(`x<sup>${a}</sup> ÷ x<sup>${b}</sup> = x<sup>?</sup> — find the exponent.`, a - b, 'Same base divided: subtract the exponents.', `${a} − ${b} = ${a - b}.`); } const a = ri(2, 5), b = ri(2, 4); return inQ(`(x<sup>${a}</sup>)<sup>${b}</sup> = x<sup>?</sup> — find the exponent.`, a * b, 'A power of a power: multiply the exponents.', `${a} × ${b} = ${a * b}.`); }
    const a = ri(2, 3), b = ri(2, 3), base = pick([2, 3]);
    return inQ(`${base}<sup>${a}</sup> · ${base}<sup>${b}</sup> = ?  <span class="ctx">(as a number)</span>`, base ** (a + b), `First combine: ${base}^${a + b}.`, `${base}^${a}·${base}^${b} = ${base}^${a + b} = ${base ** (a + b)}.`);
  },
  scinot(t) {
    if (t === 1) { const m = ri(11, 89) / 10, e = ri(3, 6), v = m * 10 ** e; return mcQ(`Write ${v.toLocaleString('en-US')} in scientific notation.`, `${fmt(m)} × 10^${e}`, [`${fmt(m)} × 10^${e + 1}`, `${fmt(m)} × 10^${e - 1}`, `${fmt(m * 10)} × 10^${e}`], 'Slide the point until one digit remains before it; count the slides.', `${v.toLocaleString('en-US')} = ${fmt(m)} × 10^${e}.`); }
    if (t === 2) { const m = ri(11, 89) / 10, e = ri(2, 5); return inQ(`${fmt(m)} × 10<sup>${e}</sup> = ?  <span class="ctx">(as an ordinary number)</span>`, m * 10 ** e, `Slide the decimal point ${e} places right.`, `= ${fmt(m * 10 ** e)}.`); }
    const a = ri(2, 4), b = ri(2, 4), e1 = ri(2, 5), e2 = ri(2, 5), mRaw = a * b;
    const norm = mRaw >= 10 ? `${fmt(mRaw / 10)} × 10^${e1 + e2 + 1}` : `${mRaw} × 10^${e1 + e2}`;
    return mcQ(`(${a} × 10<sup>${e1}</sup>) × (${b} × 10<sup>${e2}</sup>) = ?`, norm, [`${mRaw} × 10^${e1 + e2 + (mRaw >= 10 ? 0 : 1)}`, `${mRaw} × 10^${e1 * e2}`, `${fmt(mRaw / (mRaw >= 10 ? 1 : 10))} × 10^${e1 + e2 - 1}`], 'Multiply the fronts, add the exponents, then re-normalize if needed.', `${a}×${b} = ${mRaw}; 10^${e1}·10^${e2} = 10^${e1 + e2}${mRaw >= 10 ? '; normalize → ' + norm : ''}.`);
  },

  /* ---------- Algebra Vale ---------- */
  onestep(t) {
    const x = ri(2, t === 1 ? 12 : 25);
    if (t === 1) { const a = ri(2, 20); return pick([0, 1]) ? inQ(`x + ${a} = ${x + a}.  x = ?`, x, `Undo the +${a} by subtracting it from both sides.`, `x = ${x + a} − ${a} = ${x}.`) : inQ(`x − ${a} = ${x - a}.  x = ?`, x, `Undo the −${a} by adding it to both sides.`, `x = ${x - a} + ${a} = ${x}.`); }
    if (t === 2) { const a = ri(2, 9); return pick([0, 1]) ? inQ(`${a}x = ${a * x}.  x = ?`, x, `Undo the ×${a} by dividing both sides.`, `x = ${a * x} ÷ ${a} = ${x}.`) : inQ(`x ÷ ${a} = ${x}.  x = ?`, x * a, `Undo the ÷${a} by multiplying both sides.`, `x = ${x} × ${a} = ${x * a}.`); }
    const a = ri(2, 9), neg = ri(2, 30);
    return inQ(`${a}x = ${-a * neg}.  x = ?`, -neg, 'Divide both sides — mind the sign.', `x = ${-a * neg} ÷ ${a} = ${-neg}.`);
  },
  twostep(t) {
    const x = ri(2, 12);
    if (t === 1) { const a = ri(2, 8), b = ri(2, 20); return inQ(`${a}x + ${b} = ${a * x + b}.  x = ?`, x, `First subtract ${b}, then divide by ${a}.`, `${a}x = ${a * x} → x = ${x}.`); }
    if (t === 2) { const a = ri(2, 8), b = ri(2, 20); return inQ(`${a}x − ${b} = ${a * x - b}.  x = ?`, x, `First add ${b} to both sides.`, `${a}x = ${a * x} → x = ${x}.`); }
    const a = ri(3, 9), c = ri(1, a - 2), d = ri(2, 15);
    return inQ(`${a}x + ${d} = ${c}x + ${(a - c) * x + d}.  x = ?`, x, `Gather the x's on one side: subtract ${c}x from both.`, `${a - c}x + ${d} = ${(a - c) * x + d} → ${a - c}x = ${(a - c) * x} → x = ${x}.`);
  },
  distribute(t) {
    if (t === 1) { const a = ri(2, 8), b = ri(2, 9); return mcQ(`Expand:  ${a}(x + ${b})`, `${a}x + ${a * b}`, [`${a}x + ${b}`, `${a + b}x`, `${a}x + ${a + b}`], `Multiply ${a} by both things inside.`, `${a}·x + ${a}·${b} = ${a}x + ${a * b}.`); }
    if (t === 2) { const a = ri(2, 7), b = ri(2, 12), c = ri(2, 7), d = ri(2, 12); return mcQ(`Combine like terms:  ${a}x + ${b} + ${c}x + ${d}`, `${a + c}x + ${b + d}`, [`${a + c + b + d}x`, `${a + c}x + ${b * d}`, `${a * c}x + ${b + d}`], 'x-terms with x-terms, numbers with numbers.', `(${a}+${c})x + (${b}+${d}) = ${a + c}x + ${b + d}.`); }
    const a = ri(1, 6), b = ri(1, 6);
    return mcQ(`Expand:  (x + ${a})(x + ${b})`, `x² + ${a + b}x + ${a * b}`, [`x² + ${a * b}x + ${a + b}`, `x² + ${a + b}x + ${a + b}`, `x² + ${a * b}`], 'FOIL: firsts, outers, inners, lasts.', `x·x + ${b}x + ${a}x + ${a * b} = x² + ${a + b}x + ${a * b}.`);
  },

  /* ---------- Geometry Grove ---------- */
  area(t) {
    if (t === 1) { if (pick([0, 1])) { const l = ri(4, 15), w = ri(3, 12); return inQ(`A grove plot is ${l} by ${w} paces. Its area?`, l * w, 'Area of a rectangle = length × width.', `${l} × ${w} = ${l * w} square paces.`); } const b = ri(2, 10) * 2, h = ri(3, 12); return inQ(`A triangular sail has base ${b} and height ${h}. Its area?`, b * h / 2, 'Half of base × height.', `½ × ${b} × ${h} = ${b * h / 2}.`); }
    if (t === 2) { const r = ri(2, 12); return pick([0, 1]) ? mcQ(`A circle has radius ${r}. Its area?`, `${r * r}π`, [`${2 * r}π`, `${r}π`, `${r * r * 2}π`], 'Area = πr².', `π × ${r}² = ${r * r}π.`) : mcQ(`A circle has radius ${r}. Its circumference?`, `${2 * r}π`, [`${r * r}π`, `${r}π`, `${4 * r}π`], 'Circumference = 2πr.', `2π × ${r} = ${2 * r}π.`); }
    const a = ri(4, 10), b = ri(4, 10), c = ri(2, a - 1), d = ri(2, b - 1);
    return inQ(`<span class="ctx">An L-shaped terrace is a ${a} × ${b} rectangle with a ${c} × ${d} corner removed.</span>Area of the terrace?`, a * b - c * d, 'Whole rectangle minus the missing corner.', `${a}×${b} − ${c}×${d} = ${a * b} − ${c * d} = ${a * b - c * d}.`);
  },
  angles(t) {
    if (t === 1) { const s = pick([90, 180]), a = ri(15, s - 15); return inQ(`Two angles ${s === 90 ? 'are complementary (sum 90°)' : 'form a straight line (180°)'}. One is ${a}°. The other?`, s - a, `They must total ${s}°.`, `${s} − ${a} = ${s - a}°.`); }
    if (t === 2) { const a = ri(25, 80), b = ri(25, 80); return inQ(`A triangle has angles ${a}° and ${b}°. The third angle?`, 180 - a - b, 'Angles of a triangle total 180°.', `180 − ${a} − ${b} = ${180 - a - b}°.`); }
    if (pick([0, 1])) { const n = ri(5, 12); return inQ(`Sum of interior angles of a ${n}-sided polygon?`, (n - 2) * 180, '(n − 2) × 180°.', `(${n} − 2) × 180 = ${(n - 2) * 180}°.`); }
    const n = pick([3, 4, 5, 6, 8, 9, 10, 12]);
    return inQ(`Each interior angle of a regular ${n}-gon?`, 180 - 360 / n, 'Each exterior angle is 360°/n; interior = 180° − that.', `180 − 360/${n} = ${fmt(180 - 360 / n)}°.`);
  },
  pythag(t) {
    const T = pick([[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [6, 8, 10], [9, 12, 15]]);
    if (t === 1) { return inQ(`A right triangle has legs ${T[0]} and ${T[1]}. The hypotenuse?`, T[2], 'a² + b² = c².', `√(${T[0]}² + ${T[1]}²) = √${T[2] * T[2]} = ${T[2]}.`); }
    if (t === 2) { return inQ(`A right triangle has hypotenuse ${T[2]} and one leg ${T[0]}. The other leg?`, T[1], 'c² − a² = b².', `√(${T[2]}² − ${T[0]}²) = √${T[1] * T[1]} = ${T[1]}.`); }
    const x = ri(-5, 5), y = ri(-5, 5);
    return inQ(`Distance between (${x}, ${y}) and (${x + T[0]}, ${y + T[1]})?`, T[2], 'Build a right triangle from the horizontal and vertical gaps.', `√(${T[0]}² + ${T[1]}²) = ${T[2]}.`);
  },

  /* ---------- Function Falls ---------- */
  linear(t) {
    if (t === 1) { const a = ri(2, 7), b = ri(-9, 9), x = ri(2, 8); return inQ(`f(x) = ${a}x ${b < 0 ? '−' : '+'} ${Math.abs(b)}.  f(${x}) = ?`, a * x + b, `Feed ${x} into the machine.`, `${a}×${x} ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${a * x + b}.`); }
    if (t === 2) { const x1 = ri(-4, 3), y1 = ri(-6, 6), m = ri(-4, 4) || 2, dx = ri(1, 4); return inQ(`Slope of the line through (${x1}, ${y1}) and (${x1 + dx}, ${y1 + m * dx})?`, m, 'Slope = rise ÷ run.', `(${y1 + m * dx} − ${y1}) ÷ (${x1 + dx} − ${x1}) = ${m * dx}/${dx} = ${m}.`); }
    const m = ri(-4, 4) || 3, b = ri(-8, 8);
    const eq = `y = ${m}x ${b < 0 ? '−' : '+'} ${Math.abs(b)}`;
    return mcQ(`Which line has slope ${m} and y-intercept ${b}?`, eq, [`y = ${b}x ${m < 0 ? '−' : '+'} ${Math.abs(m)}`, `y = ${m}x ${b < 0 ? '+' : '−'} ${Math.abs(b)}`, `y = ${-m}x ${b < 0 ? '−' : '+'} ${Math.abs(b)}`], 'y = (slope)x + (intercept).', `${eq}.`);
  },
  quadratic(t) {
    if (t === 1) { const k = ri(2, 13); return inQ(`x² = ${k * k}.  The positive solution?`, k, 'Which number squared gives this?', `x = √${k * k} = ${k}.`); }
    if (t === 2) { const p = ri(1, 7), q = ri(1, 7); return mcQ(`Solve:  x² − ${p + q}x + ${p * q} = 0`, `x = ${p} or x = ${q}`.replace(`x = ${p} or x = ${p}`, `x = ${p} (double)`), [`x = ${-p} or x = ${-q}`, `x = ${p + q} or x = ${p * q}`, `x = ${p + 1} or x = ${q - 1 === p + 1 ? q - 2 : q - 1}`], `Two numbers that multiply to ${p * q} and add to ${p + q}.`, `(x − ${p})(x − ${q}) = 0 → x = ${p}, ${q}.`); }
    const a = pick([1, 2]), h = ri(-5, 5), b = -2 * a * h;
    return inQ(`The parabola y = ${a === 1 ? '' : a}x² ${b < 0 ? '−' : '+'} ${Math.abs(b)}x + ${ri(1, 9)} has its vertex at what x-value?`, h, 'Vertex x = −b / 2a.', `x = ${-b}/(2·${a}) = ${h}.`);
  },
  systems(t) {
    if (t === 1) { const x = ri(1, 8), d = ri(1, 6), b = 2 * x + d; return inQ(`y = x + ${d}  and  x + y = ${b}.  x = ?`, x, 'Substitute the first rule into the second.', `x + (x + ${d}) = ${b} → 2x = ${2 * x} → x = ${x}.`); }
    if (t === 2) { const x = ri(2, 9), y = ri(1, 8); return inQ(`x + y = ${x + y}  and  x − y = ${x - y}.  x = ?`, x, 'Add the two equations — y cancels.', `2x = ${2 * x} → x = ${x}.`); }
    const x = ri(2, 9), y = ri(1, 9);
    return inQ(`<span class="ctx">Two kelp-cakes and a shell cost ${2 * x + y} lumins; one of each costs ${x + y}.</span>Price of one kelp-cake?`, x, 'Subtract the smaller purchase from the larger.', `(2x + y) − (x + y) = x = ${x}.`);
  },

  /* ---------- Trig Temple ---------- */
  righttri(t) {
    const T = pick([[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]]);
    if (t === 1) { const which = pick(['sin', 'cos', 'tan']); const val = which === 'sin' ? [T[0], T[2]] : which === 'cos' ? [T[1], T[2]] : [T[0], T[1]]; return frQ(`<span class="ctx">In a right triangle, angle A's opposite side is ${T[0]}, adjacent is ${T[1]}, hypotenuse is ${T[2]}.</span>${which}(A) = ?  <span class="ctx">(as a fraction)</span>`, val[0], val[1], 'SOH-CAH-TOA.', `${which}(A) = ${frStr(val[0], val[1])}.`); }
    if (t === 2) { const k = ri(2, 4); return inQ(`sin(θ) = ${frStr(T[0], T[2])} and the hypotenuse is ${T[2] * k}. Length of the opposite side?`, T[0] * k, 'opposite = sin(θ) × hypotenuse.', `${frStr(T[0], T[2])} × ${T[2] * k} = ${T[0] * k}.`); }
    const cases = [['tan(θ) = 1', 45], ['sin(θ) = 1/2', 30], ['cos(θ) = 1/2', 60], ['sin(θ) = √3/2', 60], ['cos(θ) = √2/2', 45], ['tan(θ) = √3', 60], ['sin(θ) = √2/2', 45], ['cos(θ) = √3/2', 30]];
    const c = pick(cases);
    return mcQ(`${c[0]}, with θ acute.  θ = ?`, `${c[1]}°`, ['30°', '45°', '60°', '90°'].filter(x => x !== c[1] + '°'), 'These are the temple’s three sacred angles.', `θ = ${c[1]}°.`);
  },
  unitcircle(t) {
    const table = { 0: ['0', '1'], 30: ['1/2', '√3/2'], 45: ['√2/2', '√2/2'], 60: ['√3/2', '1/2'], 90: ['1', '0'], 180: ['0', '−1'], 270: ['−1', '0'] };
    if (t === 1) { const deg = pick([0, 30, 45, 60, 90, 180, 270]); const fn = pick(['sin', 'cos']); const v = table[deg][fn === 'sin' ? 0 : 1]; return mcQ(`${fn}(${deg}°) = ?`, v, ['0', '1/2', '√2/2', '√3/2', '1', '−1', '−1/2'].filter(x => x !== v), 'Walk the circle: x is cosine, y is sine.', `${fn}(${deg}°) = ${v}.`); }
    if (t === 2) { const pairs = [[30, 'π/6'], [45, 'π/4'], [60, 'π/3'], [90, 'π/2'], [120, '2π/3'], [180, 'π'], [270, '3π/2'], [360, '2π']]; const p = pick(pairs); return mcQ(`Convert ${p[0]}° to radians.`, p[1], pairs.filter(x => x[1] !== p[1]).map(x => x[1]), 'Multiply by π/180.', `${p[0]}° × π/180 = ${p[1]}.`); }
    const cases = [['sin(150°)', '1/2'], ['cos(120°)', '−1/2'], ['sin(210°)', '−1/2'], ['cos(135°)', '−√2/2'], ['sin(300°)', '−√3/2'], ['cos(240°)', '−1/2'], ['sin(135°)', '√2/2']];
    const c = pick(cases);
    return mcQ(`${c[0]} = ?`, c[1], ['1/2', '−1/2', '√2/2', '−√2/2', '√3/2', '−√3/2'].filter(x => x !== c[1]), 'Find the reference angle, then the quadrant’s sign.', `${c[0]} = ${c[1]}.`);
  },
  trigsolve(t) {
    if (t === 1) { const cases = [['sin(x) = 1/2', '30° and 150°'], ['cos(x) = 1/2', '60° and 300°'], ['sin(x) = √2/2', '45° and 135°'], ['tan(x) = 1', '45° and 225°'], ['cos(x) = −1/2', '120° and 240°']]; const c = pick(cases); return mcQ(`Solve on [0°, 360°):  ${c[0]}`, c[1], cases.filter(x => x[1] !== c[1]).map(x => x[1]), 'One angle per matching quadrant.', `x = ${c[1]}.`); }
    if (t === 2) { const T = pick([[3, 4, 5], [5, 12, 13], [8, 15, 17]]); return frQ(`θ is acute and sin(θ) = ${frStr(T[0], T[2])}.  cos(θ) = ?  <span class="ctx">(as a fraction)</span>`, T[1], T[2], 'sin² + cos² = 1 — or picture the right triangle.', `cos(θ) = √(1 − ${frStr(T[0] * T[0], T[2] * T[2])}) = ${frStr(T[1], T[2])}.`); }
    const T = pick([[3, 4, 5], [5, 12, 13], [8, 15, 17]]);
    return frQ(`θ is acute, sin(θ) = ${frStr(T[0], T[2])}, cos(θ) = ${frStr(T[1], T[2])}.  sin(2θ) = ?  <span class="ctx">(as a fraction)</span>`, 2 * T[0] * T[1], T[2] * T[2], 'sin(2θ) = 2 sin(θ) cos(θ).', `2 × ${frStr(T[0], T[2])} × ${frStr(T[1], T[2])} = ${frStr(2 * T[0] * T[1], T[2] * T[2])}.`);
  },

  /* ---------- Chance Mire ---------- */
  probability(t) {
    if (t === 1) { const r = ri(2, 5), b = ri(2, 5), g = ri(1, 4); return frQ(`<span class="ctx">A witch's pouch holds ${r} red, ${b} blue, and ${g} green bones.</span>P(drawing a red bone) = ?  <span class="ctx">(as a fraction)</span>`, r, r + b + g, 'Favorable over total.', `${r} red out of ${r + b + g} bones: ${frStr(r, r + b + g)}.`); }
    if (t === 2) { const f = pick([['rolling a 6 on a die', 1, 6], ['flipping heads', 1, 2], ['rolling an even number', 1, 2], ['rolling a 5 or 6', 1, 3]]); const g2 = pick([['then flipping heads', 1, 2], ['then rolling a 6', 1, 6], ['then rolling an odd number', 1, 2]]); return frQ(`P(${f[0]}, ${g2[0]}) = ?  <span class="ctx">(independent events; as a fraction)</span>`, f[1] * g2[1], f[2] * g2[2], 'Independent events: multiply the probabilities.', `${frStr(f[1], f[2])} × ${frStr(g2[1], g2[2])} = ${frStr(f[1] * g2[1], f[2] * g2[2])}.`); }
    const r = ri(3, 6), b = ri(2, 5), tot = r + b;
    return frQ(`<span class="ctx">A pouch holds ${r} red and ${b} blue bones. You draw two, without putting the first back.</span>P(both red) = ?  <span class="ctx">(as a fraction)</span>`, r * (r - 1), tot * (tot - 1), 'The second draw has one fewer red and one fewer total.', `${frStr(r, tot)} × ${frStr(r - 1, tot - 1)} = ${frStr(r * (r - 1), tot * (tot - 1))}.`);
  },
  counting(t) {
    if (t === 1) { const a = ri(2, 5), b = ri(2, 5), c = ri(2, 4); return inQ(`A Mathfinder owns ${a} cloaks, ${b} lanterns, and ${c} charms. How many different outfits?`, a * b * c, 'Multiply the choices at each step.', `${a} × ${b} × ${c} = ${a * b * c}.`); }
    if (t === 2) { const n = ri(4, 7), r = pick([2, 3]); let v = 1; for (let i = 0; i < r; i++) v *= (n - i); return inQ(`${n} witches; ${r} distinct seats (first, second${r === 3 ? ', third' : ''}). How many seatings?`, v, `Order matters: ${n} choices, then ${n - 1}…`, `${Array.from({ length: r }, (_, i) => n - i).join(' × ')} = ${v}.`); }
    const n = ri(5, 9), r = pick([2, 3]);
    const fact = k => k <= 1 ? 1 : k * fact(k - 1);
    const v = fact(n) / (fact(r) * fact(n - r));
    return inQ(`Choose ${r} of ${n} witches for a circle (order doesn't matter). How many ways?`, v, 'Count the ordered ways, then divide out the repeats.', `C(${n},${r}) = ${n}!/(${r}!·${n - r}!) = ${v}.`);
  },
  statistics(t) {
    if (t === 1) { const m = ri(4, 12), k = ri(4, 5); const xs = []; let s = 0; for (let i = 0; i < k - 1; i++) { const v = m + ri(-3, 3); xs.push(v); s += v; } xs.push(m * k - s); const shown = shuffle(xs); return inQ(`Mean of ${shown.join(', ')} ?`, m, 'Add them all, divide by how many.', `Sum = ${m * k}, ÷ ${k} = ${m}.`); }
    if (t === 2) { const xs = []; for (let i = 0; i < 5; i++) xs.push(ri(1, 30)); const sorted = xs.slice().sort((a, b) => a - b); return inQ(`Median of ${shuffle(xs).join(', ')} ?`, sorted[2], 'Sort them first; take the middle one.', `Sorted: ${sorted.join(', ')} → middle is ${sorted[2]}.`); }
    const m = ri(6, 15), k = 5; const xs = []; let s = 0;
    for (let i = 0; i < k - 1; i++) { const v = m + ri(-4, 4); xs.push(v); s += v; }
    const missing = m * k - s;
    return inQ(`<span class="ctx">Five bone-casts have mean ${m}. Four of them are ${xs.join(', ')}.</span>The fifth cast?`, missing, `All five must total ${m} × 5 = ${m * k}.`, `${m * k} − ${s} = ${missing}.`);
  },

  /* ---------- Calculus Caldera ---------- */
  limits(t) {
    if (t === 1) { const a = ri(2, 6), b = ri(1, 9), c = ri(1, 5); return inQ(`lim<sub>x→${c}</sub> (${a}x + ${b}) = ?`, a * c + b, 'A polynomial is continuous — just substitute.', `${a}(${c}) + ${b} = ${a * c + b}.`); }
    if (t === 2) { const a = ri(2, 7); return inQ(`lim<sub>x→${a}</sub> ${fr('x² − ' + a * a, 'x − ' + a)} = ?`, 2 * a, `Factor the top: x² − ${a * a} = (x−${a})(x+${a}).`, `Cancel (x − ${a}) → limit of x + ${a} = ${2 * a}.`); }
    const a = ri(2, 9), b = ri(2, 9);
    return frQ(`lim<sub>x→∞</sub> ${fr(a + 'x² + x', b + 'x² − 5')} = ?  <span class="ctx">(fraction ok)</span>`, a, b, 'At infinity only the leading terms matter.', `Ratio of leading coefficients: ${frStr(a, b)}.`);
  },
  derivative(t) {
    if (t === 1) { const a = ri(2, 7), n = ri(2, 5); return mcQ(`d/dx of ${a}x<sup>${n}</sup> = ?`, `${a * n}x^${n - 1 === 1 ? '1' : n - 1}`.replace('x^1', 'x'), [`${a}x^${n - 1}`.replace('x^1', 'x'), `${a * n}x^${n}`, `${a * (n + 1)}x^${n + 1}`], 'Bring the power down, lower it by one.', `${a}·${n}·x^${n - 1} = ${a * n}x${n - 1 > 1 ? '^' + (n - 1) : ''}.`); }
    if (t === 2) { const a = ri(1, 4), b = ri(2, 9), c = ri(1, 9), k = ri(1, 4); return inQ(`f(x) = ${a}x² + ${b}x + ${c}.  f′(${k}) = ?`, 2 * a * k + b, `f′(x) = ${2 * a}x + ${b}; substitute ${k}.`, `${2 * a}(${k}) + ${b} = ${2 * a * k + b}.`); }
    const a = ri(2, 5), b = ri(1, 9);
    return mcQ(`d/dx of (${a}x + ${b})² = ?`, `${2 * a}(${a}x + ${b})`, [`2(${a}x + ${b})`, `${a}(${a}x + ${b})`, `${2 * a}x + ${b}`], 'Chain rule: outer derivative × inner derivative.', `2(${a}x + ${b}) × ${a} = ${2 * a}(${a}x + ${b}).`);
  },
  integral(t) {
    if (t === 1) { const a = pick([2, 4, 6, 8]); return mcQ(`∫ ${a}x dx = ?`, `${a / 2}x² + C`, [`${a}x² + C`, `${a / 2}x + C`, `${2 * a}x² + C`], 'Raise the power by one, divide by the new power.', `${a}x → ${a}/2 · x² = ${a / 2}x² + C.`); }
    if (t === 2) { const a = pick([2, 4]), b = ri(1, 6), k = ri(1, 4); const v = a / 2 * k * k + b * k; return inQ(`∫<sub>0</sub><sup>${k}</sup> (${a}x + ${b}) dx = ?`, v, `Antiderivative: ${a / 2}x² + ${b}x; evaluate at ${k}.`, `${a / 2}(${k})² + ${b}(${k}) = ${v}.`); }
    const k = ri(1, 4);
    return frQ(`∫<sub>0</sub><sup>${k}</sup> x² dx = ?  <span class="ctx">(fraction ok)</span>`, k ** 3, 3, 'Antiderivative of x² is x³/3.', `${k}³/3 = ${frStr(k ** 3, 3)}.`);
  },
};
/* ================================================================
   STATE
   ================================================================ */
const SAVE_KEY = 'numera-save-v1';
function freshState() {
  return {
    name: '', xp: 0, level: 1, lumins: 0,
    streak: 0, lastDay: 0, bestStreak: 0,
    skills: {}, medals: [], numen: {},
    items: { hints: 3, shield: 0, boost: 0 },
    tips: {},
    stats: { solved: 0, sessions: 0, perfect: 0, bestCombo: 0, echoes: 0 },
    introSeen: false, seenIsle: {}, restoredSeen: {}, endingSeen: false,
  };
}
let S = freshState();
try { const raw = localStorage.getItem(SAVE_KEY); if (raw) S = Object.assign(freshState(), JSON.parse(raw)); } catch (e) { }
S.featSeen = S.featSeen || {};
function save() { S.savedAt = Date.now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { } if (window.NumeraCloud && NumeraCloud.enabled() && NumeraCloud.code) NumeraCloud.push(S); }
function skillState(id) { if (!S.skills[id]) S.skills[id] = { crowns: 0, box: 0, due: 0, attempts: 0, correct: 0 }; return S.skills[id]; }

const isleUnlocked = i => i === 0 || ISLANDS[i - 1].skills.every(sk => skillState(sk.id).crowns >= 1);
const isleRestored = i => ISLANDS[i].skills.every(sk => skillState(sk.id).crowns >= 2);
const dueSkills = () => Object.keys(SKILLS).filter(id => { const st = skillState(id); return st.crowns >= 1 && st.due <= today(); });

/* ================================================================
   HUD + NAV
   ================================================================ */
function updateHUD() {
  $('#lvlOrb').textContent = S.level;
  $('#lvlName').textContent = lvlName(S.level);
  const need = xpNeed(S.level);
  $('#xpText').textContent = `${S.xp} / ${need} XP`;
  $('#xpFill').style.width = Math.min(100, S.xp / need * 100) + '%';
  $('#luminsEl').textContent = S.lumins;
  $('#streakEl').textContent = S.streak;
  const due = dueSkills().length;
  const badge = $('#dueBadge');
  badge.hidden = due === 0;
  badge.textContent = due;
  updateNav();
}
/* Progressive disclosure: HUD features appear only once they mean something. */
const NAV_UNLOCKS = [
  ['echo', () => Object.keys(SKILLS).some(id => skillState(id).crowns >= 1), '≈ <b>Echo Tide</b> unlocked — your crowned arts will echo back for review.'],
  ['dex', () => Object.keys(S.numen).length > 0, '✦ <b>Numendex</b> unlocked — your gathered spirits live here.'],
  ['medals', () => S.medals.length > 0, '❖ <b>Hall of Medals</b> unlocked.'],
  ['shop', () => S.lumins >= 30 || S.level >= 3, '◈ <b>The Bazaar</b> has anchored offshore — spend your lumins.'],
];
function updateNav() {
  for (const [id, cond, msg] of NAV_UNLOCKS) {
    const btn = $(`.hud-nav button[data-nav="${id}"]`);
    if (!btn) continue;
    const open = cond();
    btn.hidden = !open;
    if (open && !S.featSeen[id]) {
      S.featSeen[id] = 1; save();
      if (!$('#hud').hidden) toast(msg);
    }
  }
}
function gainXP(amount) {
  S.xp += amount;
  let leveled = false;
  while (S.xp >= xpNeed(S.level)) { S.xp -= xpNeed(S.level); S.level++; leveled = true; }
  if (leveled && window.NumeraCloud && NumeraCloud.enabled() && !NumeraCloud.code && !S.featSeen.cloudNudge) { S.featSeen.cloudNudge = 1; setTimeout(() => toast('☁ Tip: tap <b>Save online</b> in the top bar to keep your progress safe on any device.', 9000), 2500); }
  if (leveled) {
    $('#lvlOrb').classList.add('pulse');
    setTimeout(() => $('#lvlOrb').classList.remove('pulse'), 600);
    if (window.NumeraAudio) NumeraAudio.levelUp();
    NumeraAvatar.levelUp(S.level, lvlName(S.level), () => {
      if ($('#screen-map').classList.contains('on')) renderMap();
    });
  } else {
    const w = $('.xpwrap');
    w.classList.add('pulse');
    setTimeout(() => w.classList.remove('pulse'), 500);
  }
}
function show(id) {
  if (id !== 'quest') stopBalloons();
  $$('.screen').forEach(s => s.classList.remove('on'));
  $('#screen-' + id).classList.add('on');
  $$('.hud-nav button').forEach(b => b.classList.toggle('active', b.dataset.nav === id));
  if (window.NumeraIsle) { id === 'home' ? NumeraIsle.resume() : NumeraIsle.stop(); }
  updateHUD();
}
$$('[data-nav]').forEach(b => b.addEventListener('click', () => {
  const dest = b.dataset.nav;
  if (dest === 'shop') { openShop(); return; }
  if ($('#screen-quest').classList.contains('on') && Q) { Q = null; toast('Trial abandoned. The problems will wait.'); }
  if (dest === 'home') renderHome();
  if (dest === 'map') renderMap();
  if (dest === 'echo') renderEcho();
  if (dest === 'dex') renderDex();
  if (dest === 'medals') renderMedals();
  show(dest);
}));

/* ================================================================
   MODALS + TOASTS
   ================================================================ */
function showModal(html, actions) {
  const card = $('#modalCard');
  card.innerHTML = html + '<div class="m-actions"></div>';
  const zone = card.querySelector('.m-actions');
  (actions || [{ label: 'Close', primary: true }]).forEach(a => {
    const btn = document.createElement('button');
    btn.className = a.primary ? 'btn-primary' : 'btn-ghost';
    btn.textContent = a.label;
    btn.onclick = () => { $('#modal').hidden = true; if (a.cb) a.cb(); };
    zone.appendChild(btn);
  });
  $('#modal').hidden = false;
  zone.querySelector('button').focus();
}
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
/* Any runtime error becomes a visible banner with the message, plus a way forward (lite mode = list view, no 3D). */
function showErrorBanner(msg) {
  let b = $('#errBanner');
  if (!b) {
    b = document.createElement('div'); b.id = 'errBanner';
    b.innerHTML = '<span id="errText"></span><button id="errLite" class="btn-primary">Continue in lite mode</button><button id="errClose" class="btn-ghost">✕</button>';
    document.body.appendChild(b);
    $('#errLite').addEventListener('click', () => { S.lite = true; save(); b.remove(); if (S.introSeen) { renderHome(); show('home'); } });
    $('#errClose').addEventListener('click', () => b.remove());
  }
  $('#errText').textContent = 'Something went wrong: ' + msg;
}
addEventListener('error', e => showErrorBanner((e.message || 'unknown error') + (e.filename ? ' @ ' + String(e.filename).split('/').pop() + ':' + e.lineno : '')));
addEventListener('unhandledrejection', e => showErrorBanner(e.reason && e.reason.message ? e.reason.message : String(e.reason)));
function spawnSparks(host, n, at) {
  if (REDUCED || !host) return;
  const colors = at && at.colors || ['#f2c14e', '#ffe9a8', '#45d6b5', '#ede6d3'];
  const w = host.clientWidth, h = host.clientHeight;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i');
    s.className = 'spark';
    const ang = Math.random() * Math.PI * 2, dist = 60 + Math.random() * 130;
    s.style.left = (at ? at.x : w / 2 + (Math.random() - 0.5) * 60) + 'px';
    s.style.top = (at ? at.y : h / 2) + 'px';
    s.style.background = pick(colors);
    s.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
    s.style.setProperty('--dy', Math.sin(ang) * dist - 40 + 'px');
    host.appendChild(s);
    setTimeout(() => s.remove(), 850);
  }
}
function toast(html, ms) {
  const t = document.createElement('div');
  t.className = 'toast'; t.innerHTML = html;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), ms || 4200);
}

/* ================================================================
   CONSTELLATION ART — each Numen is a small constellation
   ================================================================ */
function numenSVG(id, star) {
  const info = SKILLS[id];
  const rnd = mulberry(info.n * 7919 + 13);
  const pts = [];
  const count = 6 + Math.floor(rnd() * 3);
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + rnd() * 1.2;
    const rad = 18 + rnd() * 26;
    pts.push([50 + Math.cos(ang) * rad, 50 + Math.sin(ang) * rad * 0.9]);
  }
  const main = star ? '#f2c14e' : '#45d6b5';
  const dimc = star ? '#f2c14e88' : '#8b7cf688';
  let svg = `<svg viewBox="0 0 100 100" aria-hidden="true">`;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    if (i < pts.length - 1 || rnd() > .5) svg += `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${dimc}" stroke-width="0.8"/>`;
  }
  // one branch line for asymmetry
  svg += `<line x1="${pts[0][0].toFixed(1)}" y1="${pts[0][1].toFixed(1)}" x2="${pts[Math.floor(pts.length / 2)][0].toFixed(1)}" y2="${pts[Math.floor(pts.length / 2)][1].toFixed(1)}" stroke="${dimc}" stroke-width="0.6"/>`;
  pts.forEach((p, i) => {
    const r = i === 0 ? 3.4 : 1.4 + rnd() * 1.6;
    svg += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${r.toFixed(1)}" fill="${i === 0 ? main : '#ede6d3'}"/>`;
    if (i === 0) svg += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="6" fill="none" stroke="${main}" stroke-width="0.7" opacity="0.6"/>`;
  });
  svg += '</svg>';
  return svg;
}

/* ================================================================
   MAP
   ================================================================ */
function blobPath(cx, cy, seed, r) {
  const rnd = mulberry(seed * 31 + 7);
  const n = 9; let d = '';
  const pts = [];
  for (let i = 0; i < n; i++) {
    const ang = i / n * Math.PI * 2;
    const rad = r * (0.72 + rnd() * 0.5);
    pts.push([cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad * 0.62]);
  }
  d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i <= n; i++) {
    const p = pts[i % n], prev = pts[(i - 1) % n];
    const mx = (prev[0] + p[0]) / 2, my = (prev[1] + p[1]) / 2;
    d += ` Q ${prev[0].toFixed(1)} ${prev[1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  return d + ' Z';
}
/* The guide: always recommend exactly one next step. */
function computeGuide() {
  const due = dueSkills();
  if (due.length) return {
    desc: `<b>Ride the Echo Tide</b><span class="gd-sub">${due.length} mastered art${due.length > 1 ? 's are' : ' is'} echoing — reviewing now locks ${due.length > 1 ? 'them' : 'it'} deeper into memory.</span>`,
    label: 'Ride ▸',
    go: () => { renderEcho(); show('echo'); }
  };
  for (let i = 0; i < ISLANDS.length; i++) {
    if (!isleUnlocked(i) || isleRestored(i)) continue;
    const sk = ISLANDS[i].skills.find(s => skillState(s.id).crowns < 2);
    if (!sk) continue;
    const tier = skillState(sk.id).crowns + 1;
    return {
      desc: `<b>${TIER_NAMES[tier]} — ${sk.name}</b><span class="gd-sub">${ISLANDS[i].name} · ${sk.desc}</span>`,
      label: 'Begin ▸',
      go: () => { currentIsle = i; startQuest(sk.id, tier); }
    };
  }
  for (let i = 0; i < ISLANDS.length; i++) {
    const sk = ISLANDS[i].skills.find(s => skillState(s.id).crowns < 3);
    if (!sk) continue;
    return {
      desc: `<b>Gold Trial — ${sk.name}</b><span class="gd-sub">${ISLANDS[i].name} · a third crown will raise ${sk.numen[0]} to starform.</span>`,
      label: 'Begin ▸',
      go: () => { currentIsle = i; startQuest(sk.id, 3); }
    };
  }
  return { desc: `<b>The sky is full.</b><span class="gd-sub">Every crown won, every Numen a star. Ride the Echo Tide when it calls — memory is a garden, not a trophy.</span>`, label: 'Wander ▸', go: () => { } };
}
let guideGo = null;
function renderMap() {
  $('#mapGreet').textContent = S.name ? `${S.name}’s Archipelago` : 'The Archipelago';
  const restoredCount = ISLANDS.filter((_, i) => isleRestored(i)).length;
  $('#mapHint').textContent = restoredCount === 12 ? 'Every isle shines. You are the Grand Mathfinder.' : `${restoredCount} of 12 isles restored · select an isle to travel`;
  const svg = $('#mapsvg');
  let out = '';
  // sea route between islands
  for (let i = 0; i < ISLANDS.length - 1; i++) {
    const a = ISLANDS[i], b = ISLANDS[i + 1];
    out += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${isleUnlocked(i + 1) ? '#f2c14e55' : '#2b356566'}" stroke-width="2" stroke-dasharray="3 7"/>`;
  }
  // the Null vortex, until the end
  if (!S.endingSeen) {
    out += `<g opacity="0.9"><circle cx="920" cy="70" r="34" fill="none" stroke="#3a446f" stroke-width="1.5" stroke-dasharray="4 6"/><circle cx="920" cy="70" r="20" fill="none" stroke="#2b3565" stroke-width="1.5" stroke-dasharray="3 5"/><circle cx="920" cy="70" r="7" fill="#05081c"/><text x="920" y="122" text-anchor="middle" fill="#5a6488" font-size="11" letter-spacing="2">THE NULL</text></g>`;
  }
  ISLANDS.forEach((isl, i) => {
    const unlocked = isleUnlocked(i), restored = isleRestored(i);
    const crowns = isl.skills.reduce((s, sk) => s + skillState(sk.id).crowns, 0);
    const maxC = isl.skills.length * 3;
    const fill = restored ? '#1d4f43' : unlocked ? '#243059' : '#161d3d';
    const edge = restored ? '#45d6b5' : unlocked ? isl.hue : '#2b3565';
    out += `<g class="isl ${unlocked ? '' : 'locked'}" data-isle="${i}" tabindex="${unlocked ? 0 : -1}" role="button" aria-label="${isl.name}">
      <path class="blob" d="${blobPath(isl.x, isl.y, i + 1, 46)}" fill="${fill}" stroke="${edge}" stroke-width="1.6"${unlocked ? '' : ' stroke-dasharray="5 4"'}/>
      ${restored ? `<circle cx="${isl.x}" cy="${isl.y - 40}" r="3.5" fill="#45d6b5"/>` : ''}
      <text class="iname" x="${isl.x}" y="${isl.y - 4}" text-anchor="middle">${unlocked ? isl.name : '???'}</text>
      <text class="isub" x="${isl.x}" y="${isl.y + 14}" text-anchor="middle">${unlocked ? `${crowns} / ${maxC} crowns` : 'bound by the Null'}</text>
    </g>`;
  });
  svg.innerHTML = out;
  $$('#mapsvg .isl').forEach(g => {
    const i = +g.dataset.isle;
    if (!isleUnlocked(i)) { g.addEventListener('click', () => toast(`Restore <b>${ISLANDS[i - 1].name}</b> (1 crown per art) to lift the chains.`)); return; }
    const open = () => openIsland(i);
    g.addEventListener('click', open);
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });
}

/* ================================================================
   ISLAND DETAIL
   ================================================================ */
let currentIsle = 0;
function frontierIsle() {
  for (let i = 0; i < ISLANDS.length; i++) if (isleUnlocked(i) && !isleRestored(i)) return i;
  for (let i = ISLANDS.length - 1; i >= 0; i--) if (isleUnlocked(i)) return i;
  return 0;
}
function openIsland(i) {
  currentIsle = i;
  const isl = ISLANDS[i];
  if (!S.seenIsle[isl.id]) {
    S.seenIsle[isl.id] = 1; save();
    showModal(`<div class="m-eyebrow">${isl.arc}</div><h3>${isl.name}</h3><div class="m-body"><p>${isl.lore}</p><p><em>Earn crowns in each art: Bronze, Silver, Gold. Two crowns call an art’s Numen home; every art at two crowns restores the isle.</em></p></div>`,
      [{ label: 'Step Ashore', primary: true }]);
  }
  renderHome();
  show('home');
}
function renderHome() {
  const i = currentIsle, isl = ISLANDS[i];
  const guide = computeGuide();
  $('#guideDesc').innerHTML = guide.desc;
  $('#guideBtn').textContent = guide.label;
  guideGo = guide.go;
  const crowns = isl.skills.reduce((s, sk) => s + skillState(sk.id).crowns, 0);
  $('#ioArc').textContent = isl.arc;
  $('#ioName').textContent = isl.name;
  $('#ioCrowns').innerHTML = `${crowns} / ${isl.skills.length * 3} crowns${isleRestored(i) ? ' · <span style="color:var(--aqua)">✦ restored</span>' : ''}`;
  const skills = isl.skills.map(sk => ({ id: sk.id, name: sk.name, crowns: skillState(sk.id).crowns }));
  if (window.NumeraIsle && NumeraIsle.setCompanions) NumeraIsle.setCompanions(Object.keys(S.numen).length, Object.values(S.numen).filter(v => v === 2).length);
  let ok = false;
  if (!S.lite && window.NumeraIsle) {
    try { ok = NumeraIsle.mount($('#isle3d'), $('#isleLabels'), isl, i, skills, openSkill); }
    catch (e) { console.error(e); ok = false; showErrorBanner((e && e.message) || 'the 3D isle failed to start'); }
  }
  $('#isle3dWrap').classList.toggle('flat', !ok);
  if (ok && !S.featSeen.controls) { S.featSeen.controls = 1; save(); toast('<b>Tap</b> to walk · <b>drag</b> to look around · <b>pinch</b> to zoom · tap a <b>sigil</b> for its trials', 9000); }
  $('#skillList').hidden = !!ok;
  if (!ok) renderSkillList(i);
}
function openSkill(id) {
  const info = SKILLS[id], sk = info.sk, st = skillState(id);
  const caught = S.numen[id] || 0;
  const acc = st.attempts ? `${Math.round(st.correct / st.attempts * 100)}% lifetime accuracy` : 'untried';
  const tiers = [1, 2, 3].map(t => {
    const open = t <= st.crowns + 1, done = t <= st.crowns;
    return `<button class="btn-ghost ${!done && t === st.crowns + 1 ? 'rec' : ''}" data-qt="${t}" ${open ? '' : 'disabled'}>${done ? '✓ ' : '▸ '}${TIER_NAMES[t]}</button>`;
  }).join('');
  showModal(`
    <div class="m-eyebrow">${info.isl.name}</div>
    <h3>${sk.name} <span style="font-size:17px;color:var(--gold);letter-spacing:.15em">${'♛'.repeat(st.crowns)}</span></h3>
    <div class="m-body"><p>${sk.desc} · ${acc}</p>
    <p style="color:${caught ? 'var(--aqua)' : 'var(--violet)'}">${caught ? (caught === 2 ? '✦ ' + sk.numen[0] + ' shines here in starform.' : '✦ ' + sk.numen[0] + ' walks with you.') : '✧ A Numen stirs here — reach two crowns to call it home.'}</p>
    <div class="m-tiers">${tiers}</div></div>`,
    [{ label: 'Not yet' }]);
  $$('#modalCard [data-qt]').forEach(b => b.addEventListener('click', () => {
    $('#modal').hidden = true;
    startQuest(id, +b.dataset.qt);
  }));
}
function renderSkillList(i) {
  const isl = ISLANDS[i];
  $('#skillList').innerHTML = isl.skills.map(sk => {
    const st = skillState(sk.id);
    const caught = S.numen[sk.id] || 0;
    const crowns = '♛'.repeat(st.crowns) + '<span class="off">' + '♛'.repeat(3 - st.crowns) + '</span>';
    const acc = st.attempts ? Math.round(st.correct / st.attempts * 100) + '% lifetime accuracy' : 'untried';
    const tiers = [1, 2, 3].map(t => {
      const open = t <= st.crowns + 1;
      const done = t <= st.crowns;
      return `<button data-skill="${sk.id}" data-tier="${t}" ${open ? '' : 'disabled'}>${done ? '✓' : open ? '▸' : '⛓'} <b>${TIER_NAMES[t]}</b></button>`;
    }).join('');
    return `<div class="skillcard">
      <div class="sname">${sk.name} <span class="crowns">${crowns}</span></div>
      <div class="sdesc">${sk.desc} · ${acc}</div>
      <div class="numtag ${caught ? 'caught' : ''}">${caught ? (caught === 2 ? '✦ ' + sk.numen[0] + ' (starform)' : '✦ ' + sk.numen[0] + ' walks with you') : '✧ a Numen stirs here — reach two crowns'}</div>
      <div class="tierbtns">${tiers}</div>
    </div>`;
  }).join('');
  $$('#skillList button[data-skill]').forEach(b => b.addEventListener('click', () => startQuest(b.dataset.skill, +b.dataset.tier)));
  // spotlight the guided next step, if it lives on this island
  const rec = isl.skills.find(s => skillState(s.id).crowns < (isleRestored(i) ? 3 : 2));
  if (rec) {
    const btn = $(`#skillList button[data-skill="${rec.id}"][data-tier="${skillState(rec.id).crowns + 1}"]`);
    if (btn && !btn.disabled) btn.classList.add('rec');
  }
}



/* ================================================================
   TRICK SCROLLS — mental-math tips are bought per art with lumins.
   Cheaper than a heart, kept forever, whispered back after a miss.
   ================================================================ */
const TIP_COST = 15;
function ownedTips(id) { if (!S.tips) S.tips = {}; if (!S.tips[id]) S.tips[id] = []; return S.tips[id]; }
/* HTML for the whisper box: an owned trick (rotating), or a nudge to unlock one */
function whisperHTML(id) {
  const arr = TIPS[id]; if (!arr) return '';
  const own = ownedTips(id), numen = SKILLS[id].sk.numen[0];
  if (own.length) { Q.tipN = (Q.tipN || 0) + 1; const k = own[Q.tipN % own.length]; return `<b>✧ ${numen} whispers:</b> ${arr[k]}`; }
  return `<b>✧ ${numen} knows ${arr.length} tricks for this art.</b> <a href="#" class="tiplink" data-tips="${id}">Unlock one · ${TIP_COST} ◈</a>`;
}
function showWhisper(id) {
  const box = $('#qTipBox'); const html = whisperHTML(id);
  if (!html) { box.hidden = true; return; }
  box.innerHTML = html; box.hidden = false;
  const link = box.querySelector('.tiplink'); if (link) link.addEventListener('click', e => { e.preventDefault(); openTips(id); });
}
function tipsLabel() { if (!Q) return; const id = Q.curMeta ? Q.curMeta.skillId : Q.skillId; const arr = TIPS[id] || []; $('#qTips').textContent = `✧ Tricks (${ownedTips(id).length}/${arr.length})`; }
function openTips(id, reveal) {
  const arr = TIPS[id]; if (!arr) return;
  const own = ownedTips(id), sk = SKILLS[id].sk;
  if (Q && Q.balloon && Q.balloon.pause) Q.balloon.pause();
  const rows = arr.map((t, i) => own.includes(i)
    ? `<div class="tiprow owned ${reveal === i ? 'fresh' : ''}"><div class="tip-g">✧</div><div class="tip-t"><b>Trick ${i + 1}</b><span>${t}</span></div></div>`
    : `<div class="tiprow"><div class="tip-g">🔒</div><div class="tip-t"><b>Trick ${i + 1}</b><span>A mental-math trick, kept forever once unlocked.</span></div><button class="btn-ghost" data-tip="${i}" ${S.lumins < TIP_COST ? 'disabled' : ''}>${TIP_COST} ◈</button></div>`).join('');
  const resume = () => { if (Q && Q.balloon && Q.balloon.resume) Q.balloon.resume(); };
  showModal(`<div class="m-eyebrow">${sk.name} · Trick Scrolls</div><h3>${sk.numen[0]}’s Tricks</h3><div class="m-body"><p style="text-align:center;color:var(--dim)">You carry <b style="color:var(--gold)">◈ ${S.lumins}</b>. Tricks cost ${TIP_COST} ◈ each — less than a heart — and stay with you.</p>${rows}</div>`,
    [{ label: Q ? 'Back to the trial' : 'Close', primary: true, cb: resume }]);
  $$('#modalCard [data-tip]').forEach(b => b.addEventListener('click', () => {
    if (S.lumins < TIP_COST) return;
    const i = +b.dataset.tip; S.lumins -= TIP_COST; own.push(i);
    S.stats.tipsBought = (S.stats.tipsBought || 0) + 1;
    save(); updateHUD(); tipsLabel();
    if (window.NumeraAudio) NumeraAudio.tap();
    if (Q) { const box = $('#qTipBox'); box.innerHTML = `<b>✧ ${sk.numen[0]} whispers:</b> ${arr[i]}`; box.hidden = false; }
    $('#modal').hidden = true; openTips(id, i);
  }));
}

/* ================================================================
   BALLOON RUN — the arcade format for whole-number problems.
   Six balloons rise with the answer and five near misses; pop the
   right one. No pausing: the next equation launches at once. Three
   hearts per level, twenty pops to clear it, streaks of three or more
   pay bonus XP that turns into lumins at the end. Levels speed up.
   ================================================================ */
const RUN_LEN = 20, RUN_LIVES = 3, HEART_COST = 25;
const BALLOON_COUNT = 6;
const BALLOON_HUES = [
  ['#ff7a9a', '#c8324f'], ['#ffd166', '#d8921a'], ['#5be3d6', '#1e9c92'],
  ['#9d8cff', '#5b45d6'], ['#7cc6ff', '#2f7fd1'], ['#a7f07c', '#57a83a'], ['#ffa46b', '#d4602a']];
function balloonEligible(cur) {
  return cur && cur.type === 'input' && Number.isInteger(cur.ans) && Math.abs(cur.ans) <= 9999;
}
/* a skill/tier plays as a Balloon Run when most of its problems have whole-number answers */
function runEligible(skillId, tier) {
  let ok = 0; for (let i = 0; i < 6; i++) if (balloonEligible(GEN[skillId](tier))) ok++;
  return ok >= 4;
}
function genEligible(skillId, tier) {
  for (let i = 0; i < 60; i++) { const q = GEN[skillId](tier); if (balloonEligible(q)) return q; }
  return null;
}
/* plausible wrong answers: near misses, place-value slips, reversed digits, sign flips */
function balloonPool(ans) {
  const c = new Set();
  const add = v => { if (Number.isInteger(v) && v !== ans && (ans < 0 || v >= 0) && Math.abs(v) <= 99999) c.add(v); };
  [1, 2, 3, 10, 11, 9, 20].forEach(d => { add(ans + d); add(ans - d); });
  add(ans * 2); add(Math.round(ans / 2)); add(ans * 10); add(Math.round(ans / 10));
  const digits = String(Math.abs(ans));
  if (digits.length >= 2) add(Math.sign(ans || 1) * +[...digits].reverse().join(''));
  add(-ans);
  // mostly near misses (they make you actually compute), a couple of wild ones for variety
  const near = shuffle([...c].filter(v => Math.abs(v - ans) <= 11)), far = shuffle([...c].filter(v => Math.abs(v - ans) > 11));
  const out = [];
  while (near.length || far.length) { for (let k = 0; k < 3 && near.length; k++) out.push(near.shift()); if (far.length) out.push(far.shift()); }
  return out;
}
function stopBalloons() { if (Q && Q.balloon) { Q.balloon.stop(); } }
function floatText(host, x, y, text, cls) {
  const el = document.createElement('div'); el.className = 'bfloat ' + (cls || ''); el.textContent = text;
  el.style.left = x + 'px'; el.style.top = y + 'px'; host.appendChild(el); setTimeout(() => el.remove(), 900);
}
/* One field that hosts many launches. onResult(good, escaped, {x,y}) fires once per launch. */
function createBalloonField(zone, onResult) {
  const field = document.createElement('div');
  field.className = 'bfield';
  field.innerHTML = '<div class="bfield-hint">Pop the balloon with the answer before it floats away ✦</div>';
  zone.appendChild(field);
  const W = () => field.clientWidth, H = () => field.clientHeight;
  const size = () => W() < 420 ? 66 : 76;
  let balloons = [], running = false, paused = false, raf = 0, last = 0, done = true, cur = null, rise = 10, pool = [];
  const takeValue = () => { if (!pool.length) pool = balloonPool(cur.ans); return pool.shift(); };

  function makeBalloon(col, value, correct) {
    const el = document.createElement('button');
    el.type = 'button'; el.className = 'bl';
    const hue = pick(BALLOON_HUES);
    el.style.setProperty('--c1', hue[0]); el.style.setProperty('--c2', hue[1]);
    el.style.width = el.style.height = size() + 'px';
    el.innerHTML = `<span>${fmt(value)}</span>`;
    if (String(value).length > 3) el.classList.add('long');
    field.appendChild(el);
    const b = { el, value, correct, x: 0, y: 0, vy: 0, phase: Math.random() * 6.28, amp: 6 + Math.random() * 6, freq: 0.5 + Math.random() * 0.5, popped: false, col };
    el.addEventListener('pointerdown', e => { e.preventDefault(); pop(b); });
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pop(b); } });
    return b;
  }
  function place(b, y) {
    const sz = size(), margin = 14, lane = (W() - sz - margin * 2) / (BALLOON_COUNT - 1);   // balloon centres spread edge to edge
    b.x = margin + sz / 2 + lane * b.col + (Math.random() - 0.5) * Math.min(16, lane * 0.4);
    b.y = y;
    b.vy = (H() + sz * 1.2) / rise * (b.correct ? 1 : 0.88 + Math.random() * 0.24);
  }
  function draw(b, t) {
    const sz = size();
    const sway = REDUCED ? 0 : Math.sin(t * b.freq + b.phase) * b.amp;
    const tilt = REDUCED ? 0 : Math.cos(t * b.freq + b.phase) * 6;
    b.el.style.transform = `translate(${b.x + sway - sz / 2}px, ${H() - b.y - sz}px) rotate(${tilt}deg)`;
  }
  function tick(now) {
    if (!running) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0); last = now;
    const t = now / 1000, sz = size();
    for (const b of balloons) {
      if (b.popped) continue;
      b.y += b.vy * dt;
      if (b.y > H() + sz * 1.1) {
        if (b.correct) { escape(b); return; }
        // a wrong balloon that drifts off comes back from below with a fresh number
        b.value = takeValue(); b.el.querySelector('span').textContent = fmt(b.value); b.el.classList.toggle('long', String(b.value).length > 3);
        place(b, -sz * (1 + Math.random() * 1.5));
      }
      draw(b, t);
    }
    raf = requestAnimationFrame(tick);
  }
  function center(b) { const r = b.el.getBoundingClientRect(), f = field.getBoundingClientRect(); return { x: r.left - f.left + r.width / 2, y: r.top - f.top + r.height / 2 }; }
  function pop(b) {
    if (done || b.popped) return;
    b.popped = true; done = true;
    b.el.classList.add('pop');
    const at = center(b);
    spawnSparks(field, 14, { ...at, colors: [b.el.style.getPropertyValue('--c1'), '#fff', b.el.style.getPropertyValue('--c2')] });
    if (window.NumeraAudio) NumeraAudio.pop();
    settle(b.correct, false, at, b);
  }
  function escape(b) {
    if (done) return;
    done = true;
    b.el.classList.add('gone');
    settle(false, true, { x: b.x, y: 24 }, b);
  }
  function settle(good, escaped, at, hit) {
    running = false; cancelAnimationFrame(raf);
    for (const b of balloons) { b.el.disabled = true; if (b.correct && !b.popped) b.el.classList.add('reveal'); if (!good && b === hit && !b.correct) b.el.classList.add('miss'); }
    onResult(good, escaped, at);
  }
  function clear(fade) {
    const old = balloons; balloons = [];
    old.forEach(b => { if (fade) { b.el.classList.add('fade'); setTimeout(() => b.el.remove(), 450); } else b.el.remove(); });
  }
  return {
    field,
    launch(q, riseSecs) {
      clear(true);
      cur = q; rise = riseSecs; pool = balloonPool(q.ans); done = false; paused = false; last = 0;
      field.classList.remove('done');
      const cols = shuffle(Array.from({ length: BALLOON_COUNT }, (_, i) => i));
      const h = H(), sz = size();
      // launch slots from just inside the field down to well below it; the answer never rides the top two
      const slots = Array.from({ length: BALLOON_COUNT }, (_, i) => h * 0.28 - i * ((h * 0.28 + sz * 2.2) / (BALLOON_COUNT - 1)));
      const correctSlot = 2 + Math.floor(Math.random() * (BALLOON_COUNT - 2));
      for (let i = 0; i < BALLOON_COUNT; i++) {
        const correct = i === correctSlot;
        const b = makeBalloon(cols[i], correct ? q.ans : takeValue(), correct);
        place(b, slots[i]); draw(b, performance.now() / 1000);
        balloons.push(b);
      }
      running = true; raf = requestAnimationFrame(tick);
    },
    stop() { running = false; done = true; cancelAnimationFrame(raf); },
    pause() { if (running) { running = false; cancelAnimationFrame(raf); paused = true; } },
    resume() { if (paused && !done) { paused = false; last = 0; running = true; raf = requestAnimationFrame(tick); } },
    destroy() { running = false; cancelAnimationFrame(raf); field.remove(); }
  };
}

function startRun(skillId, tier) {
  const st = skillState(skillId);
  const level = (st.runLevel && st.runLevel[tier]) || 1;
  Q = { mode: 'run', skillId, tier, level, items: [], i: -1, correct: 0, misses: 0, lives: RUN_LIVES, combo: 0, best: 0, xp: 0, lum: 0, streakXP: 0, won: false, hinted: false, boost: S.items.boost > 0, answered: false, busy: false };
  if (Q.boost) { S.items.boost--; toast('☄ <b>Comet Boost</b> burns — double XP this run!'); }
  show('quest');
  const info = SKILLS[skillId];
  $('#qMetaSkill').textContent = `${info.isl.name} · ${info.sk.name}`;
  $('#qMetaTier').textContent = `${['', 'Bronze', 'Silver', 'Gold'][tier]} · Level ${level}`;
  $('#qDots').hidden = true; $('#qCombo').hidden = true; $('#runHud').hidden = false;
  $('#qFeedback').hidden = true; $('#qHintBox').hidden = true; $('#qTipBox').hidden = true;
  $('#qSubmit').hidden = true; $('#qNext').hidden = true;
  $('#qHint').textContent = `✧ Hint (${S.items.hints})`; $('#qHint').disabled = false;
  tipsLabel();
  const zone = $('#qAnswerZone');
  zone.classList.add('balloons'); zone.innerHTML = '';
  Q.balloon = createBalloonField(zone, runResult);
  runHud();
  Q.balloon.field.querySelector('.bfield-hint').textContent = `Level ${level} · pop ${RUN_LEN} answers before they float away`;
  if (!S.featSeen.runIntro) { S.featSeen.runIntro = 1; toast(`🎈 <b>Balloon Run</b>: pop the right balloon before it escapes. Three hearts per level; streaks of 3+ pay bonus XP that becomes lumins.`, 7000); }
  runNext();
}
function runRise() { return [0, 10, 12, 14][Q.tier] * Math.max(0.55, 1 - 0.07 * (Q.level - 1)) * (REDUCED ? 1.5 : 1); }
function runNext() {
  if (!Q || Q.mode !== 'run') return;
  const q = genEligible(Q.skillId, Q.tier);
  if (!q) { endRun(Q.correct >= RUN_LEN); return; }
  Q.cur = q; Q.curMeta = { skillId: Q.skillId, tier: Q.tier };
  Q.items.push({ skillId: Q.skillId, tier: Q.tier }); Q.i++;
  Q.t0 = Date.now(); Q.busy = false;
  const prompt = $('#qPrompt');
  prompt.innerHTML = q.q; prompt.classList.remove('swap'); void prompt.offsetWidth; prompt.classList.add('swap');
  $('#qHintBox').hidden = true;
  Q.balloon.launch(q, runRise());
}
function runHud() {
  if (!Q || Q.mode !== 'run') return;
  $('#runLives').innerHTML = '♥'.repeat(Q.lives) + `<i>${'♥'.repeat(Math.max(0, RUN_LIVES - Q.lives))}</i>`;
  $('#runProg').textContent = `${Q.correct}/${RUN_LEN}`;
  const sEl = $('#runStreak'); sEl.textContent = `🔥 ${Q.combo}`; sEl.classList.toggle('hot', Q.combo >= 3);
  $('#runScore').textContent = `+${Q.xp} XP`;
}
function runResult(good, escaped, at) {
  if (!Q || Q.mode !== 'run' || Q.busy) return;
  Q.busy = true;
  const cur = Q.cur, it = Q.items[Q.i]; it.good = good;
  const st = skillState(Q.skillId); st.attempts++;
  const field = Q.balloon.field;
  if (good) {
    st.correct++; S.stats.solved++;
    Q.correct++; Q.combo++; Q.best = Math.max(Q.best, Q.combo);
    S.stats.bestCombo = Math.max(S.stats.bestCombo, Q.combo);
    let gain = Math.round(10 * Q.tier * (1 + 0.1 * Math.min(Q.combo, 10)));
    let bonus = 0;
    if (Q.combo >= 3) { bonus = Math.min(15, 3 * (Q.combo - 2)); Q.streakXP += bonus; gain += bonus; }
    if (Q.boost) gain *= 2;
    Q.xp += gain;
    floatText(field, at.x, at.y, `+${gain}`, bonus ? 'hot' : '');
    if (Q.combo === 3) floatText(field, field.clientWidth / 2, field.clientHeight * 0.45, '🔥 Streak!', 'big');
    $('#qTipBox').hidden = true;
    if (window.NumeraAudio) NumeraAudio.correct(Q.combo);
  } else {
    Q.combo = 0; Q.misses++; Q.lives--;
    floatText(field, at.x, at.y, escaped ? `flew away · ${cur.ansText}` : `✗ it was ${cur.ansText}`, 'bad');
    const card = $('#qCard'); card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
    if (window.NumeraAudio) NumeraAudio.wrong();
    showWhisper(Q.skillId);   // an owned trick, or the offer to unlock one
  }
  runHud();
  if (Q.correct >= RUN_LEN) { setTimeout(() => endRun(true), 500); return; }
  if (Q.lives <= 0) { setTimeout(offerHeart, 450); return; }
  setTimeout(runNext, good ? 320 : 900);
}
function offerHeart() {
  if (!Q || Q.mode !== 'run') return;
  const spare = S.items.heart || 0;
  const body = `<div class="m-eyebrow">Balloon Run</div><h3>Out of Hearts</h3><div class="m-body m-center"><p>${Q.correct} of ${RUN_LEN} popped on Level ${Q.level}.</p><p>${spare ? `You carry <em>${spare} Spare Heart${spare > 1 ? 's' : ''}</em>.` : `A new heart costs <em>${HEART_COST} ◈</em> — you have <em>${S.lumins} ◈</em>.`}</p><p style="color:var(--dim);font-size:13px">Streaks of three or more pay bonus XP, and bonus XP becomes lumins when a level ends.</p></div>`;
  const acts = [];
  const revive = () => { Q.lives = 1; runHud(); toast('♥ A heart rekindles. Keep popping!'); runNext(); };
  if (spare) acts.push({ label: 'Use a Spare Heart', primary: true, cb: () => { S.items.heart--; save(); revive(); } });
  else if (S.lumins >= HEART_COST) acts.push({ label: `Buy a heart · ${HEART_COST} ◈`, primary: true, cb: () => { S.lumins -= HEART_COST; save(); updateHUD(); revive(); } });
  acts.push({ label: 'Give up the level', primary: !acts.length, cb: () => endRun(false) });
  showModal(body, acts);
}
function endRun(won) {
  if (!Q || Q.mode !== 'run') return;
  Q.won = won;
  const st = skillState(Q.skillId);
  st.runLevel = st.runLevel || {};
  if (won) st.runLevel[Q.tier] = Q.level + 1;
  st.runBest = Math.max(st.runBest || 0, Q.correct);
  Q.coins = Math.floor(Q.streakXP / 15) + (won ? 5 : 0);
  Q.lum = Q.coins;
  S.lumins += Q.coins;
  gainXP(Q.xp);
  endSession();
}

/* ================================================================
   QUEST SESSION (also used by Echo Tide)
   ================================================================ */
const QUEST_LEN = 8, ECHO_LEN = 6;
let Q = null;
function startQuest(skillId, tier) {
  if (runEligible(skillId, tier)) { startRun(skillId, tier); return; }
  Q = { mode: 'quest', items: Array.from({ length: QUEST_LEN }, () => ({ skillId, tier })), i: -1, correct: 0, combo: 0, best: 0, xp: 0, lum: 0, hinted: false, boost: S.items.boost > 0 };
  if (Q.boost) { S.items.boost--; toast('☄ <b>Comet Boost</b> burns — double XP this trial!'); }
  show('quest');
  nextQuestion();
}
function startEcho() {
  const due = dueSkills();
  if (!due.length) return;
  const items = [];
  for (let k = 0; items.length < ECHO_LEN; k++) {
    const id = due[k % due.length];
    items.push({ skillId: id, tier: Math.min(3, Math.max(1, skillState(id).crowns)) });
  }
  Q = { mode: 'echo', items: shuffle(items), i: -1, correct: 0, combo: 0, best: 0, xp: 0, lum: 0, hinted: false, boost: false, perSkill: {} };
  show('quest');
  nextQuestion();
}
function nextQuestion() {
  if (!Q) return;
  stopBalloons(); Q.balloon = null;
  Q.i++;
  if (Q.i >= Q.items.length) { endSession(); return; }
  const it = Q.items[Q.i];
  Q.cur = GEN[it.skillId](it.tier);
  Q.curMeta = it;
  Q.t0 = Date.now();
  Q.answered = false;
  const info = SKILLS[it.skillId];
  $('#qMetaSkill').textContent = `${info.isl.name} · ${info.sk.name}`;
  $('#qMetaTier').textContent = Q.mode === 'echo' ? 'Echo Tide' : TIER_NAMES[it.tier];
  $('#qDots').innerHTML = Q.items.map((_, j) => `<i class="${j === Q.i ? 'now' : j < Q.i ? (Q.items[j].good ? 'good' : 'bad') : ''}"></i>`).join('');
  if (Q.showTip && TIPS[it.skillId]) { showWhisper(it.skillId); Q.showTip = false; }
  else $('#qTipBox').hidden = true;
  tipsLabel();
  $('#qPrompt').innerHTML = Q.cur.q;
  $('#qFeedback').hidden = true;
  $('#qHintBox').hidden = true;
  $('#qNext').hidden = true;
  $('#qSubmit').hidden = Q.cur.type === 'mc';
  $('#qHint').textContent = `✧ Hint (${S.items.hints})`;
  $('#qHint').disabled = false;
  $('#qDots').hidden = false; $('#qCombo').hidden = false; $('#runHud').hidden = true;
  const zone = $('#qAnswerZone');
  zone.classList.remove('balloons');
  if (Q.cur.type === 'mc') {
    zone.innerHTML = `<div class="mc">${Q.cur.choices.map((c, j) => `<button data-c="${j}">${c}</button>`).join('')}</div>`;
    zone.querySelectorAll('button').forEach(b => b.addEventListener('click', () => submitAnswer(+b.dataset.c)));
  } else {
    zone.innerHTML = `<input id="ansInput" autocomplete="off" spellcheck="false" placeholder="your answer" aria-label="answer">`;
    $('#ansInput').focus();
  }
  updateCombo();
}
function updateCombo() {
  const el = $('#qCombo');
  const mult = 1 + 0.1 * Math.min(Q ? Q.combo : 0, 10);
  el.textContent = '×' + mult.toFixed(1);
  el.classList.toggle('hot', Q && Q.combo >= 3);
}
function submitAnswer(mcIdx) {
  if (!Q || Q.answered) return;
  const cur = Q.cur;
  let good;
  if (Q.balloon) return;                     // balloon runs score themselves
  if (cur.type === 'mc') {
    good = mcIdx === cur.ai;
    $$('#qAnswerZone .mc button').forEach((b, j) => {
      b.disabled = true;
      if (j === cur.ai) b.classList.add('hitR');
      else if (j === mcIdx) b.classList.add('hitW');
    });
  } else {
    const v = $('#ansInput').value;
    if (!v.trim()) return;
    good = cur.check(v);
    $('#ansInput').disabled = true;
  }
  Q.answered = true;
  Q.items[Q.i].good = good;
  const st = skillState(Q.curMeta.skillId);
  st.attempts++;
  const secs = (Date.now() - Q.t0) / 1000;
  // a long think earns a mental-math whisper before the NEXT question
  if (secs > 20 + 8 * (Q.curMeta.tier - 1)) Q.showTip = true;
  const fb = $('#qFeedback');
  if (good) {
    st.correct++; S.stats.solved++;
    Q.correct++; Q.combo++; Q.best = Math.max(Q.best, Q.combo);
    S.stats.bestCombo = Math.max(S.stats.bestCombo, Q.combo);
    let gain = Math.round(10 * Q.curMeta.tier * (1 + 0.1 * Math.min(Q.combo, 10)));
    if (secs < 10) gain += 5;
    if (Q.boost) gain *= 2;
    let lum = 0;
    if (Q.curMeta.tier === 3) lum += 2;
    if (Q.combo >= 5 && Math.random() < 0.3) { lum += 3; toast('✦ <b>Starfall!</b> +3 lumins from a grateful sky.'); }
    Q.xp += gain; Q.lum += lum;
    S.lumins += lum;
    gainXP(gain);
    fb.className = 'good';
    fb.innerHTML = `<div class="fb-head">${pick(['Solved.', 'The light returns.', 'Exactly so.', 'The Null flinches.', 'Radiant.'])}</div><div class="gain">+${gain} XP${secs < 10 ? ' · swift-bonus' : ''}${lum ? ` · +${lum} ◈` : ''}${Q.combo >= 3 ? ` · combo ×${(1 + 0.1 * Math.min(Q.combo, 10)).toFixed(1)}` : ''}</div>`;
    spawnSparks($('#qCard'), Math.min(8 + Q.combo * 2, 22));
    if (window.NumeraAudio) { NumeraAudio.correct(Q.combo); if (lum >= 3) NumeraAudio.starfall(); }
  } else {
    Q.combo = 0;
    const card = $('#qCard');
    card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
    if (window.NumeraAudio) NumeraAudio.wrong();
    fb.className = 'bad';
    fb.innerHTML = `<div class="fb-head">Not this time — the answer is ${cur.ansText}.</div><div class="fb-x">${cur.explain}</div><div class="fb-x" style="margin-top:6px">A stumble teaches more than a stroll. This one will return.</div>`;
    if (Q.mode === 'quest') Q.items.push({ ...Q.curMeta }); // missed problems come back at the end
  }
  if (Q.mode === 'echo') {
    const ps = Q.perSkill; const id = Q.curMeta.skillId;
    if (!ps[id]) ps[id] = { good: 0, bad: 0 };
    good ? ps[id].good++ : ps[id].bad++;
  }
  fb.hidden = false;
  updateCombo();
  $('#qSubmit').hidden = true;
  $('#qNext').hidden = false;
  $('#qNext').textContent = Q.i >= Q.items.length - 1 ? 'Finish ▸' : 'Continue ▸';
  $('#qNext').focus();
  updateHUD();
  save();
}
$('#qSubmit').addEventListener('click', () => submitAnswer());
$('#qNext').addEventListener('click', nextQuestion);
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || !$('#screen-quest').classList.contains('on') || !Q) return;
  if (Q.answered) { nextQuestion(); }
  else if (Q.cur.type === 'input' && !Q.balloon) submitAnswer();
});
$('#qTips').addEventListener('click', () => { if (!Q) return; openTips(Q.curMeta ? Q.curMeta.skillId : Q.skillId); });
$('#qHint').addEventListener('click', () => {
  if (!Q || Q.answered) return;
  if (S.items.hints <= 0) { toast('No hint-charges left. The <b>Bazaar</b> sells a Lens of Insight.'); return; }
  if (!$('#qHintBox').hidden) return;
  S.items.hints--; Q.hinted = true;
  $('#qHintBox').textContent = '✧ ' + Q.cur.hint;
  $('#qHintBox').hidden = false;
  $('#qHint').textContent = `✧ Hint (${S.items.hints})`;
  save();
});
$('#qQuit').addEventListener('click', () => { stopBalloons(); Q = null; renderHome(); show('home'); toast('Trial abandoned. The problems will wait.'); });

function endSession() {
  stopBalloons();
  const q = Q; Q = null;
  const run = q.mode === 'run';
  const total = run ? RUN_LEN : q.items.length;
  const acc = run ? Math.round(q.correct / Math.max(1, q.correct + q.misses) * 100) : Math.round(q.correct / total * 100);
  const firstPassPerfect = run ? q.won && q.misses === 0 : q.items.slice(0, q.mode === 'quest' ? QUEST_LEN : ECHO_LEN).every(it => it.good);
  let lines = [];
  S.stats.sessions++;
  // streak
  const t = today();
  if (S.lastDay !== t) {
    if (S.lastDay === t - 1 || S.lastDay === 0) S.streak++;
    else if (S.items.shield > 0 && S.lastDay === t - 2) { S.items.shield--; S.streak++; lines.push('🛡 A <b>Streak Shield</b> shattered to guard your flame.'); }
    else S.streak = 1;
    S.lastDay = t;
    S.bestStreak = Math.max(S.bestStreak, S.streak);
  }
  let bonusLum = 0;
  if (firstPassPerfect) { S.stats.perfect++; bonusLum += 15; lines.push('✦ <b>Flawless.</b> +15 lumins.'); }
  const newNumen = [], crowned = [];
  if (run) {
    if (q.streakXP) lines.push(`🔥 Streak bonus <b>+${q.streakXP} XP</b> → <b>+${Math.floor(q.streakXP / 15)} ◈</b> lumins${q.won ? ', and <b>+5 ◈</b> for clearing the level' : ''}.`);
    else lines.push('Pop three in a row to start a streak — streak XP becomes lumins when the level ends.');
    if (q.won) lines.push(`<em>Level ${q.level + 1}</em> unlocked — the balloons rise a little faster.`);
    else lines.push(`${q.correct} of ${RUN_LEN} popped. Hearts refill on every attempt; the Bazaar sells <b>Spare Hearts</b>.`);
  }
  if (q.mode === 'quest' || run) {
    const meta = run ? { skillId: q.skillId, tier: q.tier } : q.items[0];
    const st = skillState(meta.skillId);
    const passed = run ? q.won : q.correct >= Math.ceil(total * 0.85);
    if (passed && meta.tier === st.crowns + 1) {
      st.crowns = meta.tier;
      crowned.push(TIER_NAMES[meta.tier]);
      if (st.crowns === 1) { st.box = 1; st.due = today() + LEITNER_DAYS[1]; }
      const skInfo = SKILLS[meta.skillId];
      if (st.crowns === 2 && !S.numen[meta.skillId]) { S.numen[meta.skillId] = 1; newNumen.push([meta.skillId, false]); }
      if (st.crowns === 3 && S.numen[meta.skillId] === 1) { S.numen[meta.skillId] = 2; newNumen.push([meta.skillId, true]); }
    } else if (!passed && acc < 50 && meta.tier > 1) {
      lines.push('The trial pushed back hard — a lower trial will rebuild your footing. <em>Struggle is where learning lives.</em>');
    } else if (!passed && !run) {
      lines.push(`A crown asks for ${Math.ceil(total * 0.85)} of ${total}. The missed ones already returned once — try the trial again; it will feel shorter.`);
    }
  } else {
    S.stats.echoes++;
    for (const id in q.perSkill) {
      const st = skillState(id), r = q.perSkill[id];
      if (r.bad === 0) st.box = Math.min(5, st.box + 1); else st.box = Math.max(1, st.box - 1);
      st.due = today() + LEITNER_DAYS[st.box];
    }
    lines.push(`The echoes drift out again on the tide — the well-remembered ones for longer.`);
  }
  S.lumins += bonusLum;
  save();
  const html = `
    <div class="m-eyebrow">${q.mode === 'echo' ? 'Echo Tide' : run ? `Balloon Run · Level ${q.level}` : 'Trial Complete'}</div>
    <h3>${run ? (q.won ? (q.misses === 0 ? 'Flawless Level!' : 'Level Cleared!') : 'The Balloons Got Away') : acc === 100 ? 'Perfection' : acc >= 85 ? 'A Strong Light' : acc >= 60 ? 'The Light Holds' : 'The Null Resists'}</h3>
    <div class="m-stats">
      <div>${q.correct}/${total}<span>${run ? 'popped' : 'solved'}</span></div>
      <div>+${q.xp}<span>xp</span></div>
      <div>+${q.lum + bonusLum}<span>lumins</span></div>
      <div>×${q.best}<span>best ${run ? 'streak' : 'combo'}</span></div>
    </div>
    <div class="m-body">${crowned.map(c => `<p>♛ <em>${c} crown earned!</em></p>`).join('')}${lines.map(l => `<p>${l}</p>`).join('')}</div>`;
  const goHome = () => { if (q.mode === 'echo') { renderEcho(); show('echo'); } else { if (isleRestored(currentIsle)) currentIsle = frontierIsle(); renderHome(); show('home'); } updateHUD(); };
  const finishWith = then => () => {
      const queue = newNumen.slice();
      const afterNumen = () => checkRestores(() => { checkMedals(); then(); });
      const popNumen = () => {
        if (!queue.length) { afterNumen(); return; }
        const [id, star] = queue.shift();
        const sk = SKILLS[id].sk;
        if (window.NumeraAudio) NumeraAudio.catchNumen();
        showModal(`
          <div class="m-eyebrow">${star ? 'Starform Ascension' : 'A Numen Returns'}</div>
          <h3>${sk.numen[0]}</h3>
          <div class="m-center">${numenSVG(id, star)}</div>
          <div class="m-body m-center"><p><em>“${sk.numen[1]}”</em></p><p>${star ? 'Mastered in gold — its constellation blazes in your Numendex.' : 'The spirit of ' + sk.name + ' joins your lantern-light.'}</p></div>`,
          [{ label: star ? 'Shine On' : 'Welcome, friend', primary: true, cb: popNumen }]);
      };
      popNumen();
  };
  const actions = run
    ? [{ label: q.won ? `Level ${q.level + 1} ▸` : 'Try again ▸', primary: true, cb: finishWith(() => { updateHUD(); startRun(q.skillId, q.tier); }) }, { label: 'Back to the isle', cb: finishWith(goHome) }]
    : [{ label: 'Continue', primary: true, cb: finishWith(goHome) }];
  showModal(html, actions);
}
function checkRestores(done) {
  const idx = ISLANDS.findIndex((isl, i) => isleRestored(i) && !S.restoredSeen[isl.id]);
  if (idx === -1) {
    if (ISLANDS.every((_, i) => isleRestored(i)) && !S.endingSeen) {
      S.endingSeen = true; S.lumins += 200; save();
      showModal(`<div class="m-eyebrow">The Null, Unsolved</div><h3>Numera Shines Whole</h3><div class="m-body"><p>${ISLANDS[11].restored}</p><p><em>+200 lumins. The gold trials remain for those who would make every Numen a star.</em></p></div>`, [{ label: '✦', primary: true, cb: done }]);
      return;
    }
    done(); return;
  }
  const isl = ISLANDS[idx];
  S.restoredSeen[isl.id] = 1; S.lumins += 50; save();
  showModal(`<div class="m-eyebrow">Isle Restored</div><h3>${isl.name}</h3><div class="m-body"><p>${isl.restored}</p><p><em>+50 lumins.${idx < 11 ? ' The chains on the next isle loosen…' : ''}</em></p></div>`,
    [{ label: 'Onward', primary: true, cb: () => checkRestores(done) }]);
}

/* ================================================================
   ECHO TIDE
   ================================================================ */
function renderEcho() {
  const list = $('#echoList');
  const learned = Object.keys(SKILLS).filter(id => skillState(id).crowns >= 1)
    .sort((a, b) => skillState(a).due - skillState(b).due);
  if (!learned.length) {
    list.innerHTML = `<div class="echo-empty">The tide is empty — earn your first crown on <b>Ember Shore</b> and its echo will find you here.</div>`;
    $('#echoStart').disabled = true;
    return;
  }
  const t = today();
  list.innerHTML = learned.map(id => {
    const st = skillState(id), info = SKILLS[id];
    const d = st.due - t;
    return `<div class="echorow"><span>${info.sk.name} <span style="color:var(--dim)">· ${info.isl.name}</span></span>${d <= 0 ? `<span class="due">ECHOING NOW</span>` : `<span class="fresh">returns in ${d} day${d > 1 ? 's' : ''}</span>`}</div>`;
  }).join('');
  const due = dueSkills().length;
  $('#echoStart').disabled = due === 0;
  $('#echoStart').textContent = due ? `Ride the Tide (${due} echo${due > 1 ? 'es' : ''})` : 'No echoes today — the tide remembers for you';
}
$('#echoStart').addEventListener('click', startEcho);

/* ================================================================
   NUMENDEX + MEDALS
   ================================================================ */
function renderDex() {
  $('#dexTotal').textContent = TOTAL_SKILLS;
  $('#dexGrid').innerHTML = Object.keys(SKILLS).map(id => {
    const info = SKILLS[id], got = S.numen[id] || 0;
    if (!got) return `<div class="dexcard unknown"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="26" fill="none" stroke="#2b3565" stroke-width="1.5" stroke-dasharray="4 5"/><text x="50" y="57" text-anchor="middle" fill="#3a446f" font-size="22">?</text></svg><div class="dname">Unknown Numen</div><div class="dskill">${info.sk.name} · ${info.isl.name}</div></div>`;
    return `<div class="dexcard ${got === 2 ? 'star' : ''}">${numenSVG(id, got === 2)}<div class="dname">${info.sk.numen[0]}</div><div class="dskill">${info.sk.name}</div>${got === 2 ? '<div class="starform">✦ starform</div>' : ''}<div class="dlore">“${info.sk.numen[1]}”</div></div>`;
  }).join('');
}
const MEDALS = [
  ['spark', '❖', 'First Spark', 'Solve your first problem', () => S.stats.solved >= 1],
  ['ten', '✧', 'Kindling', 'Solve 10 problems', () => S.stats.solved >= 10],
  ['century', '✦', 'Century Flame', 'Solve 100 problems', () => S.stats.solved >= 100],
  ['fivehundred', '❂', 'Beacon', 'Solve 500 problems', () => S.stats.solved >= 500],
  ['perfect', '♛', 'Flawless', 'Complete a perfect trial', () => S.stats.perfect >= 1],
  ['perfect5', '♕', 'Untouchable', '5 perfect trials', () => S.stats.perfect >= 5],
  ['combo8', '⁂', 'Chain of Light', 'Reach an 8-combo', () => S.stats.bestCombo >= 8],
  ['combo15', '⁑', 'Meteor Chain', 'Reach a 15-combo', () => S.stats.bestCombo >= 15],
  ['streak3', '✹', 'Three Dawns', '3-day streak', () => S.bestStreak >= 3],
  ['streak7', '☀', 'Week of Light', '7-day streak', () => S.bestStreak >= 7],
  ['streak30', '❁', 'The Unbroken', '30-day streak', () => S.bestStreak >= 30],
  ['isle1', '⛵', 'First Landfall', 'Restore an island', () => ISLANDS.some((_, i) => isleRestored(i))],
  ['isle6', '🗺', 'Half the Sea', 'Restore 6 islands', () => ISLANDS.filter((_, i) => isleRestored(i)).length >= 6],
  ['isle12', '👑', 'Grand Mathfinder', 'Restore all 12 islands', () => ISLANDS.every((_, i) => isleRestored(i))],
  ['numen1', '✬', 'First Friend', 'A Numen returns to you', () => Object.keys(S.numen).length >= 1],
  ['numen10', '✭', 'Lantern Chorus', '10 Numen gathered', () => Object.keys(S.numen).length >= 10],
  ['numenall', '✮', 'The Full Sky', `All ${TOTAL_SKILLS} Numen gathered`, () => Object.keys(S.numen).length >= TOTAL_SKILLS],
  ['star1', '❋', 'Starmaker', 'Raise a Numen to starform', () => Object.values(S.numen).some(v => v === 2)],
  ['rich', '◈', 'Lumin-Laden', 'Hold 200 lumins at once', () => S.lumins >= 200],
  ['echo10', '≈', 'Tide Rider', 'Ride the Echo Tide 10 times', () => S.stats.echoes >= 10],
  ['lvl10', '➊', 'Tenth Lantern', 'Reach level 10', () => S.level >= 10],
  ['lvl25', '❶', 'High Mathfinder', 'Reach level 25', () => S.level >= 25],
];
function checkMedals() {
  for (const [id, glyph, name, desc, cond] of MEDALS) {
    if (!S.medals.includes(id) && cond()) {
      S.medals.push(id); S.lumins += 10;
      toast(`<b>${glyph} Medal struck: ${name}</b> · +10 ◈`);
    }
  }
  save();
}
function renderMedals() {
  $('#medalGrid').innerHTML = MEDALS.map(([id, glyph, name, desc]) => {
    const got = S.medals.includes(id);
    return `<div class="medal ${got ? '' : 'locked'}"><div class="mglyph">${glyph}</div><div class="mname">${got ? name : '???'}</div><div class="mdesc">${desc}</div></div>`;
  }).join('');
}

/* ================================================================
   BAZAAR
   ================================================================ */
const SHOP = [
  ['hints', '✧', 'Lens of Insight', 'Five hint-charges, ground from clear quartz.', 60, () => { S.items.hints += 5; }],
  ['shield', '🛡', 'Streak Shield', 'Guards your daily flame through one missed day. (max 2)', 120, () => { S.items.shield++; }],
  ['boost', '☄', 'Comet Boost', 'Double XP for your next trial.', 100, () => { S.items.boost++; }],
  ['heart', '♥', 'Spare Heart', 'One extra heart when a Balloon Run would end. (max 3)', 20, () => { S.items.heart = (S.items.heart || 0) + 1; }],
];
function openShop() {
  const rows = SHOP.map(([id, g, name, desc, cost]) => {
    const owned = id === 'hints' ? `${S.items.hints} charges` : id === 'shield' ? `${S.items.shield} held` : id === 'heart' ? `${S.items.heart || 0} held` : `${S.items.boost} ready`;
    const maxed = (id === 'shield' && S.items.shield >= 2) || (id === 'heart' && (S.items.heart || 0) >= 3);
    return `<div class="shoprow"><div class="sh-g">${g}</div><div class="sh-t"><b>${name}</b><span>${desc}</span><div class="owned">${owned}</div></div><button class="btn-ghost" data-buy="${id}" ${S.lumins < cost || maxed ? 'disabled' : ''}>${maxed ? 'Maxed' : cost + ' ◈'}</button></div>`;
  }).join('');
  showModal(`<div class="m-eyebrow">The Wandering Bazaar</div><h3>Spend Your Lumins</h3><div class="m-body"><p style="text-align:center;color:var(--dim)">You carry <b style="color:var(--gold)">◈ ${S.lumins}</b> — earned from gold trials, flawless runs, and starfalls.</p>${rows}</div>`,
    [{ label: 'Leave the Bazaar' }]);
  $$('#modalCard [data-buy]').forEach(b => b.addEventListener('click', () => {
    const item = SHOP.find(s => s[0] === b.dataset.buy);
    if (S.lumins < item[4]) return;
    S.lumins -= item[4]; item[5]();
    save(); updateHUD(); checkMedals();
    toast(`${item[1]} <b>${item[2]}</b> acquired.`);
    $('#modal').hidden = true; openShop();
  }));
}

/* ================================================================
   STARFIELD + INIT
   ================================================================ */
function drawStars() {
  const c = $('#stars'); const ctx = c.getContext('2d');
  c.width = innerWidth; c.height = innerHeight;
  ctx.clearRect(0, 0, c.width, c.height);
  const rnd = mulberry(42);
  for (let i = 0; i < 170; i++) {
    const x = rnd() * c.width, y = rnd() * c.height, r = rnd() * 1.3 + 0.2;
    ctx.globalAlpha = 0.25 + rnd() * 0.55;
    ctx.fillStyle = rnd() > 0.88 ? '#f2c14e' : '#ede6d3';
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
addEventListener('resize', drawStars);
drawStars();

$('#guideBtn').addEventListener('click', () => { if (guideGo) guideGo(); });

/* ---------- cloud saves: link-code account ---------- */
function cloudLabel() {
  const b = $('#cloudBtn'); if (!b) return;
  const on = window.NumeraCloud && NumeraCloud.enabled();
  b.hidden = !on; if (!on) return;
  const st = NumeraCloud.status, has = !!NumeraCloud.code;
  b.textContent = !has ? '☁ Save online' : st === 'syncing' ? '☁ …' : st === 'error' ? '☁ !' : '☁ ✓';
  b.classList.toggle('linked', has); b.title = !has ? 'Save your progress online and play on any device' : st === 'error' ? 'Sync problem: ' + NumeraCloud.lastError : 'Progress synced · tap for your link code';
}
function applyRemote(remote) {
  const chosen = NumeraCloud.pick(S, remote);
  if (chosen !== S) { S = Object.assign(freshState(), chosen); S.featSeen = S.featSeen || {}; save(); updateHUD(); if ($('#screen-home').classList.contains('on')) { currentIsle = frontierIsle(); renderHome(); } toast('☁ Progress restored from your link code.'); }
  else NumeraCloud.push(S);
}
function openCloud() {
  if (!window.NumeraCloud || !NumeraCloud.enabled()) return;
  const code = NumeraCloud.code;
  showModal(`
    <div class="m-eyebrow">Cloud Saves</div>
    <h3>${code ? 'Your Link Code' : 'Save Online'}</h3>
    <div class="m-body">
      ${code ? `<p>Your progress syncs to the cloud after every trial. To play on another device, open Numera there, choose <b>Save online → I have a code</b>, and enter:</p><p class="codebox" id="codeBox">${code}</p><p style="color:var(--dim);font-size:13px">Anyone with this code can load your save — treat it like a password.</p>`
             : `<p>Create a <b>link code</b> — a memorable four-word key that stores your progress online and lets you continue on any phone or computer. No email, no password.</p><div class="row" style="gap:8px;flex-wrap:wrap;justify-content:center"><input id="codeInput" placeholder="have a code? type it here" style="flex:1;min-width:200px;background:var(--ink-deep);border:1px solid var(--ink-line);border-radius:10px;color:var(--parchment);padding:10px 12px;font-family:var(--font-mono)"></div>`}
    </div>`,
    code ? [{ label: 'Copy code', primary: true, cb: () => { navigator.clipboard && navigator.clipboard.writeText(code).then(() => toast('Link code copied.'), () => { }); } }, { label: 'Unlink this device', cb: () => { NumeraCloud.setCode(null); cloudLabel(); toast('Unlinked. Progress stays on this device.'); } }, { label: 'Close' }]
         : [{ label: 'Create my code', primary: true, cb: async () => { NumeraCloud.setCode(NumeraCloud.genCode()); cloudLabel(); NumeraCloud.push(S); toast(`☁ Linked. Your code: <b>${NumeraCloud.code}</b>`, 9000); } },
            { label: 'Use my code', cb: async () => { const v = ($('#codeInput') && $('#codeInput').value || '').trim().toLowerCase(); if (!/^[a-z]+-[a-z]+-[a-z]+-\d{4}$/.test(v)) { toast('That doesn’t look like a link code (four words and a number).'); return; } NumeraCloud.setCode(v); cloudLabel(); const remote = await NumeraCloud.pull(); if (!remote) { toast(NumeraCloud.status === 'error' ? 'Could not reach the cloud: ' + NumeraCloud.lastError : 'No save found for that code — this device’s progress will now sync under it.'); NumeraCloud.push(S); } else applyRemote(remote); cloudLabel(); } },
            { label: 'Not now' }]);
  // keep the input alive even though the modal buttons close it
  const inp = $('#codeInput'); if (inp) { inp.addEventListener('keydown', e => { if (e.key === 'Enter') { const btn = [...$$('#modalCard .m-actions button')].find(b => b.textContent === 'Use my code'); if (btn) btn.click(); } }); setTimeout(() => inp.focus(), 50); }
}
$('#cloudBtn').addEventListener('click', openCloud);
if (window.NumeraCloud) { NumeraCloud.onChange(cloudLabel); cloudLabel(); if (NumeraCloud.enabled() && NumeraCloud.code) NumeraCloud.pull().then(remote => { if (remote) applyRemote(remote); }); }
function renderMute() { const b = $('#muteBtn'); if (!b) return; b.textContent = S.mute ? '🔇' : '🔊'; b.title = S.mute ? 'Sound off' : 'Sound on'; if (window.NumeraAudio) NumeraAudio.setMuted(!!S.mute); }
$('#muteBtn').addEventListener('click', () => { S.mute = !S.mute; save(); renderMute(); });
renderMute();
$('#setSail').addEventListener('click', () => { renderMap(); show('map'); });

function begin(lite) {
  S.name = $('#nameInput').value.trim() || 'Wanderer';
  S.introSeen = true; if (lite) S.lite = true; save();
  $('#hud').hidden = false;
  try { openIsland(frontierIsle()); }
  catch (e) { console.error(e); showErrorBanner((e && e.message) || 'could not open the isle'); S.lite = true; save(); try { renderHome(); } catch (e2) { } show('home'); }
  toast(`Welcome, <b>${S.name}</b>. Follow <b>Your Path</b> — it always knows the next step.`);
}
$('#beginBtn').addEventListener('click', () => begin(false));
$('#liteLink').addEventListener('click', e => { e.preventDefault(); begin(true); });
$('#liteToggle').addEventListener('click', () => { S.lite = !S.lite; save(); toast(S.lite ? 'Lite mode on — list view instead of the 3D isle.' : 'Lite mode off — the 3D isle returns.'); if ($('#screen-home').classList.contains('on')) renderHome(); });
$('#nameInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('#beginBtn').click(); });

if (S.introSeen) {
  $('#hud').hidden = false;
  currentIsle = frontierIsle();
  renderHome(); show('home');
  const due = dueSkills().length;
  if (due) toast(`≈ The <b>Echo Tide</b> carries ${due} echo${due > 1 ? 'es' : ''} today — ride it to keep them bright.`);
} else {
  show('title');
  NumeraAvatar.mount($('#avatarTitle'), 190);
  $('#nameInput').focus();
}
if (window.NumeraIsle && NumeraIsle.onFatal) NumeraIsle.onFatal(e => { showErrorBanner((e && e.message) || 'the 3D isle stopped'); S.lite = true; save(); if ($('#screen-home').classList.contains('on')) renderHome(); });
updateHUD();

if ('serviceWorker' in navigator && location.protocol.startsWith('http') && window.NUMERA_ASSETS) { addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { })); }
