/**
 * THE TWO REGULARS WHO WALK, CHECKED WITHOUT A BROWSER (L4, E5).
 *
 * qa/o1-static.cjs reads npcPAL and checks the seventeen `find:` rows; its
 * row regex requires `find:` and so it does not see a row that names its
 * person by `kind:` — the shape Sydney's waiter and Pasto's woman with the
 * broom use, because the steering cast has a `kind` field and no first line.
 * This is the same check for those two rows: five tiers, the name in tier
 * three, a gift that is a real prop type, and a `kind` that the roster
 * actually pushes — exactly once for Sydney, and at least once for Pasto,
 * where there are two abuelas and the first is the regular.
 *
 * Run: node qa/l4-pal-static.cjs
 */
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', 'src');
const npc = fs.readFileSync(path.join(SRC, 'npc.js'), 'utf8');

let bad = 0;
const fail = (m) => { console.log('FAIL  ' + m); bad++; };

const tStart = npc.indexOf('const npcPAL = {');
if (tStart < 0) { fail('npcPAL is not in npc.js'); process.exit(1); }
let depth = 0, tEnd = -1;
for (let i = npc.indexOf('{', tStart); i < npc.length; i++) {
  if (npc[i] === '{') depth++;
  else if (npc[i] === '}') { depth--; if (depth === 0) { tEnd = i + 1; break; } }
}
const body = npc.slice(npc.indexOf('{', tStart), tEnd);
const rows = {};
const rowRe = /(\w+):\s*\{\s*who:\s*'([^']*)',\s*kind:\s*'([^']*)',\s*call:\s*'([^']*)',\s*gift:\s*'([^']*)',\s*giftSay:\s*'((?:[^'\\]|\\.)*)',\s*tiers:\s*\[([\s\S]*?)\]\s*\}/g;
let m;
while ((m = rowRe.exec(body))) {
  const lines = [];
  const lRe = /'((?:[^'\\]|\\.)*)'/g;
  let q;
  while ((q = lRe.exec(m[7]))) lines.push(q[1]);
  rows[m[1]] = { who: m[2], kind: m[3], call: m[4], gift: m[5], giftSay: m[6], tiers: lines };
}
const keys = Object.keys(rows);
console.log('cast regulars in the table: ' + keys.length + ' (' + keys.join(', ') + ')');
if (!rows.sydney) fail('sydney has no kind: row');
if (!rows.pasto) fail('pasto has no kind: row');
if (keys.length !== 2) fail('expected exactly two kind: rows (sydney, pasto), got ' + keys.length);

for (const k of keys) {
  const r = rows[k];
  if (r.tiers.length !== 5) fail(k + ': ' + r.tiers.length + ' tier lines, expected 5');
  for (let i = 0; i < r.tiers.length; i++) {
    const t = r.tiers[i];
    if (!t || t.length < 8) fail(k + ' tier ' + (i + 1) + ': line is too short to be one');
    if (/\b(press|button|key|click)\b/i.test(t)) fail(k + ' tier ' + (i + 1) + ': names a control');
    if (/!/.test(t)) fail(k + ' tier ' + (i + 1) + ': the regulars never shout');
  }
  if (r.tiers[2] && r.tiers[2].indexOf(r.call) < 0) fail(k + ': tier 3 does not use the name "' + r.call + '"');
  if (!/^the /.test(r.who)) fail(k + ': `who` reads oddly on the board — "' + r.who + '"');
  if (!r.giftSay || r.giftSay.length < 8) fail(k + ': gift has no line');
}

// ---- the kind is one the roster builds ------------------------------------
if (rows.sydney) {
  const n = npc.split("roster.push('" + rows.sydney.kind + "')").length - 1;
  if (n !== 1) fail('sydney: roster pushes kind "' + rows.sydney.kind + '" ' + n + ' times, expected exactly 1');
}
if (rows.pasto) {
  const n = npc.split("R.push('" + rows.pasto.kind + "')").length - 1;
  if (n < 1) fail('pasto: the Pasto roster never pushes kind "' + rows.pasto.kind + '"');
}

// ---- the gift is a real prop type -----------------------------------------
{
  const props = fs.readFileSync(path.join(SRC, 'props.js'), 'utf8');
  const tS = props.indexOf('const physTYPES = {');
  let dd = 0, tE = -1;
  for (let i = props.indexOf('{', tS); i < props.length; i++) {
    if (props[i] === '{') dd++;
    else if (props[i] === '}') { dd--; if (dd === 0) { tE = i + 1; break; } }
  }
  const tBody = props.slice(tS, tE);
  const defs = {};
  for (const line of tBody.split(/\r?\n/)) {
    const mm = line.match(/^  ([a-z0-9-]+):\s*\{/);
    if (mm) defs[mm[1]] = line;
  }
  for (const k of keys) {
    const g = rows[k].gift;
    if (!defs[g]) { fail(k + ': gift "' + g + '" is not a physTYPES entry'); continue; }
    if (/grabbable:\s*false/.test(defs[g])) fail(k + ': gift "' + g + '" cannot be picked up');
    if (/planted:\s*true/.test(defs[g])) fail(k + ': gift "' + g + '" is planted');
  }
}

// ---- and the wiring the cast rows depend on --------------------------------
const need = [
  ['function npcPalSeek(live)', 'npc.js has no kind: lookup'],
  ['function npcPalFree(rec)', 'npc.js has no cast-or-local free test'],
  ['function npcPalSay(rec, text)', 'npc.js has no cast-or-local mouth'],
  ['if (rec && npcPalIsCast(rec)) {', 'the cast regular never earns fam'],
  ['if (r.fam !== undefined) r.fam = 0;', 'the cast fam is not cleared on arrival'],
  ['rec.alarm * capyQuiet * npcPalSoft(rec)', 'the cast wary does not read the favour'],
  ["el.className = 'capynpc-bubble';", 'the bubbles have no class for the soak to watch'],
  ['if (!npcRec.bags) npcRec.bags = {};', 'pickLine does not draw from a bag'],
  ["npcRumFrom === 'sydney' && npcRumTo === 'pasto'", 'the first crossing does not arm a rumour'],
];
for (const [needle, why] of need) if (npc.indexOf(needle) < 0) fail(why);

console.log(bad ? bad + ' FAILURES' : 'both cast regulars check out');
process.exit(bad ? 1 : 0);
