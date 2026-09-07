#!/usr/bin/env node
/* Exports the game's content tables (islands, skills, Numen, tips, medals, shop,
   level names) from game.js into JSON for the Unity client, so both clients share
   one source of truth. Usage: node tools/export-content.js */
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
const cut = src.indexOf('   STATE');
const head = src.slice(0, src.lastIndexOf('/*', cut)); // utils + data + generators, no DOM
const { ISLANDS, TIPS, LEVEL_NAMES, TIER_NAMES, LEITNER_DAYS } = eval(head + '\n;({ISLANDS, TIPS, LEVEL_NAMES, TIER_NAMES, LEITNER_DAYS})');
// medal + shop tables live after the STATE marker; pull them by regex-free slicing
const medalsSrc = src.slice(src.indexOf('const MEDALS = ['), src.indexOf('];', src.indexOf('const MEDALS = [')) + 2);
const shopSrc = src.slice(src.indexOf('const SHOP = ['), src.indexOf('];', src.indexOf('const SHOP = [')) + 2);
const SKILLS_STUB = {}; ISLANDS.forEach(i => i.skills.forEach(s => SKILLS_STUB[s.id] = 1));
const MEDALS = eval('(function(){ const S={}; const ISLANDS=[]; const TOTAL_SKILLS=' + Object.keys(SKILLS_STUB).length + '; const isleRestored=()=>0; const skillState=()=>({}); ' + medalsSrc + ' return MEDALS; })()');
const SHOP = eval('(function(){ const S={items:{}}; ' + shopSrc + ' return SHOP; })()');
const out = {
  levelNames: LEVEL_NAMES, tierNames: TIER_NAMES, leitnerDays: LEITNER_DAYS,
  islands: ISLANDS.map(i => ({ id: i.id, name: i.name, arc: i.arc, hue: i.hue, lore: i.lore, restored: i.restored, x: i.x, y: i.y,
    skills: i.skills.map(s => ({ id: s.id, name: s.name, desc: s.desc, numenName: s.numen[0], numenLore: s.numen[1], tips: TIPS[s.id] || [] })) })),
  medals: MEDALS.map(m => ({ id: m[0], glyph: m[1], name: m[2], desc: m[3] })),
  shop: SHOP.map(s => ({ id: s[0], glyph: s[1], name: s[2], desc: s[3], cost: s[4] })),
};
const dest = path.join(__dirname, '..', 'unity', 'Numera', 'Assets', 'Numera', 'Resources', 'numera_world.json');
fs.writeFileSync(dest, JSON.stringify(out, null, 2));
console.log('wrote', path.relative(process.cwd(), dest), `(${out.islands.length} islands, ${out.islands.reduce((n, i) => n + i.skills.length, 0)} skills, ${out.medals.length} medals)`);
