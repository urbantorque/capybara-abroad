// THE PEOPLE OF THIS SQUARE, COUNTED (L7, E6 / writing W8).
//
//   node qa/l7-e6-walk.mjs
//
// Reads the bubbles qa/l7-e6-walk.js logged on a 90 s naive walk per chapter
// (qa/l7-e6-walk-*.json.png) and says, per chapter, what share came from the
// chapter's own mouths. "Neutral" is every string in npc.js's chapter-blind
// tables — npcLOC_SAY, npcLOC_CHAT, the npcLOC_* arrays, npcLEAVE — and
// everything else is the chapter's: npcPLACE_SAY, a local's own `lines`, the
// Sydney and Pasto rosters. The bar is 50 % in 19/19; the review measured
// Venice at 38 % and Marrakech at 0 % before `passing` existed.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(ROOT, 'src', 'npc.js'), 'utf8');
const LIT = /'((?:[^'\\\n]|\\.)*)'/g;

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
const neutral = new Set();
const addLits = (text) => { let m; LIT.lastIndex = 0; while ((m = LIT.exec(text))) neutral.add(m[1].replace(/\\'/g, "'")); };
for (const nm of ['npcLOC_SAY', 'npcLOC_CHAT']) {
  const at = src.indexOf('const ' + nm + ' = {');
  if (at >= 0) addLits(grab(src.indexOf('{', at), '{', '}'));
}
const arr = /const (npcLOC_[A-Z_]+|npcLEAVE) = \[/g;
let m;
while ((m = arr.exec(src))) addLits(grab(m.index + m[0].length - 1, '[', ']'));
console.log('neutral lines: ' + neutral.size);

const files = readdirSync(join(ROOT, 'qa')).filter((f) => /^l7-e6-walk.*\.json\.png$/.test(f)).sort();
let chapters = 0, met = 0;
const rows = [];
for (const f of files) {
  const j = JSON.parse(readFileSync(join(ROOT, 'qa', f), 'utf8'));
  for (const w of j.walks || []) {
    chapters++;
    const own = w.lines.filter((l) => !neutral.has(l.x));
    const share = w.lines.length ? own.length / w.lines.length : NaN;
    const ok = w.lines.length === 0 ? false : share >= 0.5;
    if (ok) met++;
    rows.push({ biome: w.biome, n: w.lines.length, own: own.length, share, ok, err: w.err,
                neutralSaid: w.lines.filter((l) => neutral.has(l.x)).map((l) => l.x) });
  }
}
for (const r of rows) {
  console.log((r.ok ? 'ok    ' : 'SHORT ') + r.biome.padEnd(10) + String(r.own).padStart(3) + ' of ' + String(r.n).padStart(3) +
              ' own  ' + (isNaN(r.share) ? '  n/a' : (r.share * 100).toFixed(0).padStart(4) + ' %') +
              (r.err ? '   ' + r.err : '') +
              (r.neutralSaid.length ? '   neutral: ' + r.neutralSaid.slice(0, 4).map((s) => '"' + s + '"').join(', ') : ''));
}
console.log('\n' + met + '/' + chapters + ' chapters at >= 50 % chapter-own bubbles (bar 19/19)');
