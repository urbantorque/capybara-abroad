// Which tasks carry a RECORDS row, per chapter — the table the paper's timed
// glyph is drawn from. A static cross-check, so a glyph that appears on the
// wrong row is caught without reading nineteen screenshots.
import fs from 'fs';
const s = fs.readFileSync('src/shared.js', 'utf8');

const ri = s.indexOf('export const RECORDS');
const rseg = s.slice(ri, s.indexOf('\nexport ', ri + 10));
const recs = new Set([...rseg.matchAll(/^ {2}'?([a-z0-9-]+)'?\s*:\s*\{/gm)].map(m => m[1]));

const ti = s.indexOf('export const TASKS');
const tseg = s.slice(ti, s.indexOf('\nexport ', ti + 10));
const rows = [...tseg.matchAll(/\{\s*id:\s*'([a-z0-9-]+)',\s*text:\s*'([^']*)'[^}]*?chapter:\s*(\d+)/g)];

const per = {};
let timed = 0;
for (const m of rows) {
  const [, id, text, ch] = m;
  (per[ch] = per[ch] || []).push({ id, text, timed: recs.has(id) });
  if (recs.has(id)) timed++;
}
console.log('tasks parsed:', rows.length, ' of which timed:', timed, ' (RECORDS rows:', recs.size + ')');
const want = process.argv[2];
for (const ch of Object.keys(per).sort((a, b) => a - b)) {
  if (want && ch !== want) continue;
  const n = per[ch].filter(r => r.timed).length;
  console.log('chapter ' + ch + ' — ' + n + ' timed of ' + per[ch].length);
  if (want) for (const r of per[ch]) console.log('   ' + (r.timed ? '[timed] ' : '        ') + r.id.padEnd(16) + r.text.slice(0, 42));
}
// Any RECORDS key that is not a task id at all is invisible on the board AND
// on the paper — the fault capy3-names-nothing-publishes records.
const ids = new Set(rows.map(m => m[1]));
const orphans = [...recs].filter(k => !ids.has(k));
console.log('RECORDS keys that are not task ids:', orphans.length, orphans.join(' '));

// THIS ONE INVARIANT FAILS THE BUILD; the per-chapter listing above does not.
// An orphaned RECORDS key is measured, stored and shown nowhere — the exact
// silent failure capy3-names-nothing-publishes is about, and the kind that only
// ever gets found by someone reading a report they had no reason to open. The
// count above (how many tasks are timed per chapter) is a description of the
// game and has no target, so it stays a listing.
if (orphans.length) process.exit(1);
