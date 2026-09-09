/**
 * THE REGULARS, CHECKED WITHOUT A BROWSER (O1).
 *
 * A regular is identified by `find`, a substring of that person's own first
 * line in their chapter file — which is the only honest way to point at a
 * local, because a local record has no id, no name and no key (see the block
 * in npc.js). The cost of that choice is that a chapter reword can quietly
 * take a regular away, and a chapter with no regular is the whole item
 * switched off in that place with nothing anywhere saying so.
 *
 * So this is the check that has to exist. It reads the table out of npc.js and
 * the seventeen chapter files, and asserts that every `find` matches EXACTLY
 * ONE person, in the right chapter, who is not the traveller.
 *
 * Run: node qa/o1-static.cjs
 */
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', 'src');
const npc = fs.readFileSync(path.join(SRC, 'npc.js'), 'utf8');

let bad = 0, warn = 0;
const fail = (m) => { console.log('FAIL  ' + m); bad++; };
const note = (m) => { console.log('warn  ' + m); warn++; };

// ---- the table, read out of the source rather than imported ---------------
// npc.js is a module with a factory in it and importing it needs a THREE, a
// game and a scene. The table is a literal, so it is parsed.
const tStart = npc.indexOf('const npcPAL = {');
if (tStart < 0) { fail('npcPAL is not in npc.js'); process.exit(1); }
let depth = 0, tEnd = -1;
for (let i = npc.indexOf('{', tStart); i < npc.length; i++) {
  if (npc[i] === '{') depth++;
  else if (npc[i] === '}') { depth--; if (depth === 0) { tEnd = i + 1; break; } }
}
const body = npc.slice(npc.indexOf('{', tStart), tEnd);
const rows = {};
const rowRe = /(\w+):\s*\{\s*who:\s*'([^']*)',\s*find:\s*'([^']*)',\s*call:\s*'([^']*)',\s*tiers:\s*\[([\s\S]*?)\]\s*\}/g;
let m;
while ((m = rowRe.exec(body))) {
  const lines = [];
  const lRe = /'((?:[^'\\]|\\.)*)'/g;
  let q;
  while ((q = lRe.exec(m[5]))) lines.push(q[1]);
  rows[m[1]] = { who: m[2], find: m[3], call: m[4], tiers: lines };
}
const keys = Object.keys(rows);
console.log('regulars in the table: ' + keys.length);
if (keys.length !== 17) fail('expected 17 rows, got ' + keys.length);

// ---- the shape of a row ---------------------------------------------------
for (const k of keys) {
  const r = rows[k];
  if (r.tiers.length !== 5) fail(k + ': ' + r.tiers.length + ' tier lines, expected 5');
  for (let i = 0; i < r.tiers.length; i++) {
    const t = r.tiers[i];
    if (!t || t.length < 8) fail(k + ' tier ' + (i + 1) + ': line is too short to be one');
    // The house rule for every pool in npc.js: a line has to work on a person
    // standing still, said out loud, with no verb for the player in it.
    if (/\b(press|button|key|click)\b/i.test(t)) fail(k + ' tier ' + (i + 1) + ': names a control');
  }
  // The nickname arrives at tier three and it has to actually be in the line,
  // or the item's one running joke is a field nobody ever hears.
  if (r.tiers[2] && r.tiers[2].indexOf(r.call) < 0) {
    fail(k + ': tier 3 does not use the name "' + r.call + '"');
  }
  if (!/^the /.test(r.who)) note(k + ': `who` reads oddly on the board — "' + r.who + '"');
}

// ---- and every `find` matches exactly one person in that chapter ----------
// The chapter files call addLocal (or a local helper that forwards to it) with
// a `lines` array whose first entry is what this points at. Rather than parse
// seventeen different call shapes, the file is searched for the string: a
// `find` that appears once in its own chapter file and nowhere else in src is
// unambiguous, which is the property the runtime lookup depends on.
const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.js'));
for (const k of keys) {
  const f = path.join(SRC, k + '.js');
  if (!fs.existsSync(f)) { fail(k + ': no src/' + k + '.js'); continue; }
  const src = fs.readFileSync(f, 'utf8');
  const n = src.split(rows[k].find).length - 1;
  if (n === 0) fail(k + ': nobody in src/' + k + '.js says "' + rows[k].find + '"');
  else if (n > 1) fail(k + ': "' + rows[k].find + '" appears ' + n + ' times in src/' + k + '.js');
  // ...and it must not also be somebody else's line in another chapter, which
  // would not break the runtime lookup (it is scoped by biome) but would mean
  // the row below is lying about who it names.
  for (const g of files) {
    if (g === k + '.js' || g === 'npc.js') continue;
    if (fs.readFileSync(path.join(SRC, g), 'utf8').indexOf(rows[k].find) >= 0) {
      note(k + ': "' + rows[k].find + '" also appears in ' + g);
    }
  }
}

// ---- the two chapters that have no regular, on purpose --------------------
if (rows.sydney) fail('sydney has a regular row and registers no locals');
if (rows.pasto) fail('pasto has a regular row and registers no locals');

// ---- and the wiring both sides of the split ------------------------------
const sys = fs.readFileSync(path.join(SRC, 'systems.js'), 'utf8');
const main = fs.readFileSync(path.join(SRC, 'main.js'), 'utf8');
const need = [
  [npc, 'npcPalStep(dt)', 'npc.js never steps the regulars'],
  [npc, "game.events.emit('pal:warm'", 'npc.js never reports a warming'],
  [npc, 'if (r.talkCd > 0) r.talkCd -= dt;', 'the local mouth clock is not being run'],
  [npc, 'L.fam = 0; L.famWas = false;', 'familiarity is not cleared on arrival'],
  [main, 'game.palArm = npcs.palArm;', 'main.js does not publish palArm'],
  [sys, "game.events.on('pal:warm'", 'systems.js never counts a warming'],
  [sys, 'pal: jrChapPal,', 'the tier is not written to the save'],
  [sys, 'const pl = jrFile.pal || {};', 'the tier is not read back from the save'],
  [sys, "'the regular: '", 'the record board has no line for the regular'],
];
for (const [hay, needle, why] of need) if (hay.indexOf(needle) < 0) fail(why);

console.log(bad ? bad + ' FAILURES' : 'all regulars check out' + (warn ? ' (' + warn + ' warnings)' : ''));
process.exit(bad ? 1 : 0);
