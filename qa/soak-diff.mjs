// ===========================================================================
// qa/soak-diff.mjs — has the soak moved? (L6, E8 / qa F5)
//
// Reads qa/soak-history.jsonl (one JSON line per `npm run soak`) and compares
// the LAST row against the median of the up-to-three rows before it, column
// by column, chapter by chapter. Exits non-zero when any column has moved by
// more than SOAK_TOL (30 %) — up or down, because a longest frame that
// halved is as much a change to explain as one that doubled.
//
// TWO FLOORS, or the report is noise. Frame time under headless moves 3 ms
// between two identical runs and the shorter columns here are single frames:
// 50 → 67 ms is +34 % and means nothing. So a move must also clear an
// absolute floor per column (a hundred milliseconds of frame, ten draw
// calls, a metre a second). `saves` has no floor: its median is zero and any
// count is a body being clamped every frame. `progAfter` likewise.
//
// With fewer than two rows there is nothing to compare against — SAID, and a
// FAIL (L7, E7: this used to exit 0, which is how "1 row — nothing to
// compare yet" sat green for eight commits after L6-5 without a second soak
// ever having been run). Registered in qa/run.mjs as a REPORT for the same
// reason as ever: a check that needs history it may not have cannot be
// allowed to fail a `npm test` build on an empty file — run.mjs prints a
// report's last line and ignores its exit code, so the non-zero exit here is
// for `npm run soak` and for anyone running this by hand, exactly as before;
// only the exit code on the empty-history path changed, not who reads it.
//
// THE ROW MUST BE FROM HERE (L7, E7). A stale history — checked out from an
// old branch, or carried across a rebase — compares today's build against a
// tree nobody is running, and every "no column moved" is true of nothing.
// The last row's `commit` (its short hash, with soak.mjs's own `+` dirty
// suffix stripped) must be HEAD or one of its two parents on this branch;
// `git log -3` is read fresh each run, so this never needs updating by hand.
// ===========================================================================
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HISTORY = join(ROOT, 'qa', 'soak-history.jsonl');
const SOAK_TOL = 0.30;
const COLS = {
  // column     absolute floor the move must also clear
  maxSpeed:  1.0,     // m/s
  saves:     0,       // any
  longest:   100,     // ms — the whole crossing's longest frame
  after:     100,     // ms — the longest frame after the white came off
  progAfter: 0,       // programs compiled on the first visible frames
  calls:     10,      // draw calls
  longest2:  100,     // ms — second entry
};

function rows() {
  if (!existsSync(HISTORY)) return [];
  return readFileSync(HISTORY, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
}
function median(a) {
  const s = a.filter(x => typeof x === 'number' && x === x).sort((x, y) => x - y);
  if (!s.length) return null;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const all = rows();
if (all.length < 2) {
  console.log('soak-diff: FAIL — ' + all.length + ' row' + (all.length === 1 ? '' : 's') + ' in qa/soak-history.jsonl — nothing to compare yet (npm run soak twice)');
  process.exit(1);
}
const last = all[all.length - 1];
{
  const hash = String(last.commit || '').replace(/\+$/, '');
  let recent = null;
  try { recent = execFileSync('git', ['log', '-3', '--format=%h'], { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').filter(Boolean); }
  catch (e) { console.log('soak-diff: could not read git history (' + e.message.split('\n')[0] + ') — skipping the ancestry check'); }
  if (recent && hash && !recent.includes(hash)) {
    console.log('soak-diff: FAIL — the last row is commit ' + hash + ', not HEAD or one of its two parents (' + recent.join(', ') + ') — this history is stale');
    process.exit(1);
  }
}
const base = all.slice(Math.max(0, all.length - 4), all.length - 1);
const moves = [];
for (const ch in last.chapters) {
  const now = last.chapters[ch];
  for (const col in COLS) {
    const v = now[col];
    if (typeof v !== 'number' || v !== v) continue;
    const m = median(base.map(r => r.chapters && r.chapters[ch] && r.chapters[ch][col]));
    if (m === null) continue;
    const abs = Math.abs(v - m);
    const rel = m === 0 ? (v === 0 ? 0 : Infinity) : abs / Math.abs(m);
    if (rel > SOAK_TOL && abs >= COLS[col] && abs > 0) moves.push({ ch, col, was: m, now: v, rel });
  }
}
const okNow = last.ok || {};
const okLine = Object.keys(okNow).map(k => k + ' ' + (okNow[k] ? 'ok' : 'FAIL')).join('  ');
console.log('soak-diff: ' + last.commit + ' (' + String(last.date).slice(0, 16).replace('T', ' ') + ') against the median of ' + base.length + ' earlier row' + (base.length === 1 ? '' : 's') + '  |  ' + okLine);
if (!moves.length) {
  console.log('soak-diff: no column moved more than ' + Math.round(SOAK_TOL * 100) + ' % — ' + Object.keys(last.chapters).length + ' chapters, ' + Object.keys(COLS).length + ' columns');
  process.exit(0);
}
moves.sort((a, b) => b.rel - a.rel);
for (const mv of moves) {
  console.log('  ' + mv.ch.padEnd(10) + mv.col.padEnd(10) + String(mv.was).padStart(9) + ' -> ' + String(mv.now).padStart(7) +
              '  ' + (mv.rel === Infinity ? 'from zero' : (mv.now > mv.was ? '+' : '-') + Math.round(mv.rel * 100) + ' %'));
}
console.log('soak-diff: ' + moves.length + ' column' + (moves.length === 1 ? '' : 's') + ' moved more than ' + Math.round(SOAK_TOL * 100) + ' %');
process.exit(1);
