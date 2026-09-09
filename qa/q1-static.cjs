/**
 * THE REPERTOIRE, CHECKED WITHOUT A BROWSER (Q1).
 *
 * A pattern that names a prop no chapter builds, or asks for a spill from
 * something that cannot spill, is a silhouette FOR EVER — and it fails in
 * exactly the way nothing in the game can report, because a name that is never
 * awarded looks identical to a name nobody has earned yet.
 *
 * So the table is checked against props.js's own two tables: `physTYPES` for
 * what a prop can do, and `physBIOME_SCATTER` for where it is.
 *
 * Run: node qa/q1-static.cjs
 */
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', 'src');
const sys = fs.readFileSync(path.join(SRC, 'systems.js'), 'utf8');
const props = fs.readFileSync(path.join(SRC, 'props.js'), 'utf8');

let bad = 0, warn = 0;
const fail = (m) => { console.log('FAIL  ' + m); bad++; };
const note = (m) => { console.log('warn  ' + m); warn++; };

function literal(src, decl) {
  const a = src.indexOf(decl);
  if (a < 0) return null;
  const open = src.indexOf(decl.indexOf('[') >= 0 ? '[' : '{', a);
  const oc = src[open], cc = oc === '[' ? ']' : '}';
  let d = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === oc) d++;
    else if (src[i] === cc) { d--; if (d === 0) return src.slice(open, i + 1); }
  }
  return null;
}

// ---- the pattern table ----------------------------------------------------
const tbl = literal(sys, 'const sysREP = [');
if (!tbl) { fail('sysREP is not in systems.js'); process.exit(1); }
// PARSED BY BRACE MATCHING AND NOT BY ONE REGEX. The first cut used a single
// pattern with a lazy body and it stopped at the first `}` INSIDE `want`, so
// every row with more than one requirement parsed as having none — eighteen
// false failures, all of them saying the opposite of the truth.
const pats = [];
{
  let i = 0;
  while ((i = tbl.indexOf('{ id:', i)) >= 0) {
    let d = 0, end = -1;
    for (let j = i; j < tbl.length; j++) {
      if (tbl[j] === '{') d++;
      else if (tbl[j] === '}') { d--; if (d === 0) { end = j + 1; break; } }
    }
    if (end < 0) break;
    const row = tbl.slice(i, end);
    i = end;
    const id = (row.match(/id:\s*'([^']+)'/) || [])[1];
    const nm = (row.match(/name:\s*'((?:[^'\\]|\\.)*)'/) || row.match(/name:\s*"([^"]*)"/) || [])[1];
    if (!id || !nm) continue;
    const biome = (row.match(/biome:\s*'([a-z]+)'/) || [])[1] || null;
    const want = [];
    const wantBlock = row.slice(row.indexOf('want:'));
    for (const w of wantBlock.matchAll(/\{([^{}]*)\}/g)) {
      const body = w[1];
      want.push({
        k: (body.match(/\bk:\s*'([a-z]+)'/) || [])[1] || null,
        t: (body.match(/\bt:\s*'([a-z0-9-]+)'/) || [])[1] || null,
        n: +(body.match(/\bn:\s*(\d+)/) || [])[1] || null,
        any: +(body.match(/\bany:\s*(\d+)/) || [])[1] || null,
        kinds: +(body.match(/\bkinds:\s*(\d+)/) || [])[1] || null,
        same: +(body.match(/\bsame:\s*(\d+)/) || [])[1] || null,
      });
    }
    pats.push({ id, name: nm.replace(/\\'/g, "'"), biome, want });
  }
}
console.log('patterns in the table: ' + pats.length);
if (pats.length < 30) fail('only ' + pats.length + ' patterns parsed — the regex or the table has moved');

// ---- props.js's two tables ------------------------------------------------
const tBody = literal(props, 'const physTYPES = {');
const defs = {};
for (const line of tBody.split(/\r?\n/)) {
  const mm = line.match(/^  ([a-z0-9-]+):\s*\{/);
  if (mm) defs[mm[1]] = line;
}
const scatBody = literal(props, 'const physBIOME_SCATTER = {');
const palette = {};
{
  let cur = null;
  for (const line of scatBody.split(/\r?\n/)) {
    const mm = line.match(/^  ([a-z]+):\s*\{/);
    if (mm) { cur = mm[1]; palette[cur] = new Set(); }
    if (!cur) continue;
    for (const x of line.matchAll(/\['([a-z0-9-]+)', *\d+\]/g)) palette[cur].add(x[1]);
  }
}
const anywhere = new Set();
for (const b in palette) for (const t of palette[b]) anywhere.add(t);

// ---- the checks -----------------------------------------------------------
const ids = new Set(), names = new Set();
const KINDS = new Set(['bang', 'spill', 'water', 'break', 'theft']);
let longest = '';
for (const p of pats) {
  if (ids.has(p.id)) fail('duplicate id: ' + p.id);
  ids.add(p.id);
  if (names.has(p.name)) fail('duplicate name: ' + p.name);
  names.add(p.name);
  if (p.name !== p.name.toUpperCase()) fail(p.id + ': the card sets names in capitals');
  if (p.name.length > longest.length) longest = p.name;
  if (!p.want.length) { fail(p.id + ': no requirements'); continue; }
  if (p.biome && !palette[p.biome] && p.biome !== 'sydney' && p.biome !== 'pasto') {
    fail(p.id + ': locked to "' + p.biome + '", which is not a chapter');
  }
  // A pattern can never be longer than the chain's own ceiling: five events
  // make A SCENE and the ring holds eight, but nothing beyond five can ever
  // be in a chain at the moment the card is decided.
  let need = 0;
  for (const w of p.want) need += (w.n || w.any || w.same || 0) || (w.kinds ? w.kinds : 1);
  if (need > 5) fail(p.id + ': needs ' + need + ' events; a chain cards at 3 and tops out at 5');
  for (const w of p.want) {
    if (w.k && !KINDS.has(w.k)) fail(p.id + ': "' + w.k + '" is not one of the five kinds');
    if (w.kinds && w.kinds > KINDS.size) fail(p.id + ': asks for ' + w.kinds + ' kinds; there are ' + KINDS.size);
    if (!w.t) continue;
    if (!defs[w.t]) { fail(p.id + ': "' + w.t + '" is not a physTYPES entry'); continue; }
    if (w.k === 'spill' && !/spill:/.test(defs[w.t])) {
      fail(p.id + ': "' + w.t + '" cannot spill');
    }
    if (w.k === 'break' && !/fragile:\s*true/.test(defs[w.t])) {
      fail(p.id + ': "' + w.t + '" is not fragile, so it cannot break');
    }
    // ...and it has to be somewhere. A type in no chapter's scatter can still
    // be hand-placed by a biome file, so this is a warning and not a failure —
    // and it is skipped entirely for Sydney and Pasto, which have no scatter
    // entry at all: they are the two oldest chapters and every prop in them is
    // placed by hand.
    if (p.biome === 'sydney' || p.biome === 'pasto') continue;
    const where = p.biome ? (palette[p.biome] && palette[p.biome].has(w.t))
                          : anywhere.has(w.t);
    if (!where) note(p.id + ': "' + w.t + '" is in no' + (p.biome ? ' ' + p.biome : '') + ' scatter list');
  }
  // ...and a locked pattern has to be possible in the chapter it is locked to
  if (p.biome && palette[p.biome]) {
    for (const w of p.want) {
      if (w.k === 'break' && ![...palette[p.biome]].some(t => /fragile:\s*true/.test(defs[t] || ''))) {
        fail(p.id + ': nothing in ' + p.biome + "'s palette can break");
      }
      if (w.k === 'spill' && ![...palette[p.biome]].some(t => /spill:/.test(defs[t] || ''))) {
        fail(p.id + ': nothing in ' + p.biome + "'s palette can spill");
      }
    }
  }
}
// THE LONGEST NAME, against the width that was measured rather than guessed.
// qa/q1-width.js: at a 360 px viewport the card is 254 px wide, the name sets
// at 14 px, and "THE GONDOLIER'S FAREWELL" (24) renders on ONE line. 26 is the
// budget that leaves, and it is asserted here so the thirty-seventh name
// cannot quietly wrap the card on a phone.
console.log('longest name: "' + longest + '" (' + longest.length + ')');
if (longest.length > 26) fail('"' + longest + '" is ' + longest.length + ' chars; 26 is the measured budget at 360 px');

// ---- HOW MANY OF THEM EACH CHAPTER CAN EVEN ASK ---------------------------
// "Forty silhouettes is forty questions" only holds if the questions have
// answers where the player is standing. Optimistic — a splash and a theft are
// assumed possible anywhere, because whether a chapter has water and whether a
// prop has an owner are runtime facts — so a number here is a CEILING, and a
// chapter with a low one is a chapter where the wall stays grey.
{
  const rows = [];
  for (const b of Object.keys(palette).concat(['sydney', 'pasto'])) {
    const pal = palette[b] || new Set();
    const canSpill = [...pal].some(t => /spill:/.test(defs[t] || ''));
    const canBreak = [...pal].some(t => /fragile:\s*true/.test(defs[t] || ''));
    let n = 0;
    for (const p of pats) {
      if (p.biome && p.biome !== b) continue;
      let ok = true;
      for (const w of p.want) {
        if (w.t && !pal.has(w.t) && b !== 'sydney' && b !== 'pasto') { ok = false; break; }
        if (w.k === 'spill' && !canSpill && b !== 'sydney' && b !== 'pasto') { ok = false; break; }
        if (w.k === 'break' && !canBreak && b !== 'sydney' && b !== 'pasto') { ok = false; break; }
      }
      if (ok) n++;
    }
    rows.push([b, n]);
  }
  rows.sort((a, b) => a[1] - b[1]);
  console.log('reachable per chapter (ceiling): ' +
    rows.map(r => r[0] + ' ' + r[1]).join(', '));
  for (const [b, n] of rows) if (n < 8) note(b + ' can only ever reach ' + n + ' of ' + pats.length);
}

// ---- and the wiring -------------------------------------------------------
const need = [
  [sys, 'function repMatch(ev)', 'there is no matcher'],
  [sys, 'const named = repName(x, z);', 'the card never asks for a name'],
  [sys, 'rep: jrRep,', 'the names are not written to the save'],
  [sys, 'const rp = jrFile.rep || {};', 'the names are not read back'],
  [sys, 'momentNote', 'the card has no third line'],
  [sys, "incAdd(x, z, key, kind, type)".replace('incAdd', 'function incAdd'), 'incAdd does not take a kind'],
  [sys, "'bang', p.prop.type", 'the bang handler does not say what it was'],
  [sys, "'spill', p.prop.type", 'the spill handler does not say what it was'],
  [sys, "'water', wp.type", 'the water handler does not say what it was'],
  [sys, "'break', dp.type", 'the destroy handler does not say what it was'],
  [sys, "'theft', gp.type", 'the grab handler does not say what it was'],
];
for (const [hay, needle, why] of need) if (hay.indexOf(needle) < 0) fail(why);

console.log(bad ? bad + ' FAILURES' : 'the repertoire checks out' + (warn ? ' (' + warn + ' warnings)' : ''));
process.exit(bad ? 1 : 0);
