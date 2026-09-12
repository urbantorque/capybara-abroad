// NO LINE LIVES IN TWO POOLS (L4, E5).
//
//   node qa/l4-lines-dups.mjs
//
// qa/lines.mjs checks that every conditional line names a real task; it has
// never looked at the lines themselves. The writing review counted three
// strings that appeared in two pools of npc.js by reading it, and a scan found
// twenty-eight — including npcWIT_CHAIN, a byte-for-byte copy of npcLOC_CHAIN
// under a comment explaining why the two chapters needed pools of their own.
//
// A duplicate is invisible in play until it is not: the bag-and-ring picker
// guarantees a person does not repeat WITHIN a pool, so the one way a line can
// still be heard twice in a minute is from two pools. This reads every pool
// table in npc.js — npcLINES, npcLOC_SAY, npcPLACE_SAY, npcLOC_CHAT,
// npcCHAT_CALM and every `const npcXXX = [ ... ]` whose entries are strings or
// `{ t }` objects — and exits 1 on any string present in more than one of
// them, or twice in one. Conditional entries count by their text.
//
// It evaluates the literals rather than regexing them, so a `when:` closure
// is stubbed and a line with a comma or a quote in it is read correctly.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(ROOT, 'src', 'npc.js'), 'utf8');
const pools = {};

/** The balanced literal starting at `at`, skipping strings and // comments. */
function grab(at, open, close) {
  let depth = 0, inStr = null;
  for (let i = at; i < src.length; i++) {
    const c = src[i];
    if (inStr) { if (c === '\\') { i++; continue; } if (c === inStr) inStr = null; continue; }
    if (c === "'" || c === '"') { inStr = c; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return src.slice(at, i + 1); }
  }
  return null;
}
function evalLiteral(text) {
  text = text.replace(/when:\s*[^,}\n]+/g, 'when: 1');
  try { return Function('return (' + text + ')')(); } catch (e) { return null; }
}
const isPool = (v) => Array.isArray(v) && v.length > 0 &&
  v.every((e) => typeof e === 'string' || (e && typeof e.t === 'string'));
function walk(name, v) {
  if (isPool(v)) pools[name] = v;
  else if (v && typeof v === 'object' && !Array.isArray(v)) for (const k in v) walk(name + '.' + k, v[k]);
}

let bad = 0;
for (const nm of ['npcLINES', 'npcLOC_SAY', 'npcPLACE_SAY', 'npcLOC_CHAT', 'npcCHAT_CALM']) {
  const at = src.indexOf('const ' + nm + ' = {');
  if (at < 0) { console.log('BLOCKER  ' + nm + ' is not in npc.js'); bad++; continue; }
  const obj = evalLiteral(grab(src.indexOf('{', at), '{', '}'));
  if (!obj) { console.log('BLOCKER  ' + nm + ' did not evaluate'); bad++; continue; }
  walk(nm, obj);
}
for (const m of src.matchAll(/const (npc[A-Za-z_]*[A-Z_]{3,}[A-Za-z_]*)\s*=\s*\[/g)) {
  const arr = evalLiteral(grab(m.index + m[0].length - 1, '[', ']'));
  if (isPool(arr)) pools[m[1]] = arr;
}

const where = new Map();
for (const p in pools) {
  const seen = new Set();
  for (const e of pools[p]) {
    const t = typeof e === 'string' ? e : e.t;
    if (seen.has(t)) { console.log('BLOCKER  ' + p + ' has "' + t + '" twice'); bad++; }
    seen.add(t);
    if (!where.has(t)) where.set(t, []);
    where.get(t).push(p);
  }
}
for (const [t, ps] of where) {
  if (ps.length > 1) { console.log('BLOCKER  "' + t + '" is in ' + ps.join(' and ')); bad++; }
}
let n = 0;
for (const p in pools) n += pools[p].length;
console.log(Object.keys(pools).length + ' pools, ' + n + ' lines, ' + bad + ' duplicates');
process.exit(bad ? 1 : 0);
