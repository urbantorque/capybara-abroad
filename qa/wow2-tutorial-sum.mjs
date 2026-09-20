// ROADMAP-WOW2, T — fold the bot's runs into the table.
//
//   node qa/wow2-tutorial-sum.mjs
//
// Reads every qa/wow2-tut-run-*.json.png (the /shot sink's spelling of a JSON
// file) that qa/wow2-tutorial.js wrote — one per run-code invocation — and
// prints the per-run row (time to beat 8, how it ended, beats hit of eight,
// which beats timed out), then the median and the worst against the
// roadmap's 180 s, and writes qa/wow2-tutorial.json.png with the same.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const QA = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(QA).filter((f) => /^wow2-tut-run-\d+\.json\.png$/.test(f)).sort();
const rows = [];
for (const f of files) {
  let o;
  try { o = JSON.parse(readFileSync(join(QA, f), 'utf8')); } catch (e) { continue; }
  const missed = o.beats.filter((b) => b.hit === false && !/stall/.test(b.pill)).map((b) => b.beat);
  rows.push({
    file: f, started: !!o.started, how: o.endHow, t: o.beat8At != null ? o.beat8At : o.endAt,
    hits: o.hits, missed, err: o.err || null,
    counters: o.counters ? { wheeks: o.counters.wheeks, grabs: o.counters.grabs, yuzu: o.counters.yuzu, tabs: o.counters.tabs, bumps: o.counters.bumps } : null,
  });
}
const done = rows.filter((r) => r.how === 'walked' && typeof r.t === 'number').map((r) => r.t).sort((a, b) => a - b);
const median = done.length ? done[Math.floor(done.length / 2)] : null;
const worst = done.length ? done[done.length - 1] : null;
console.log('run  ended    beat8 s  hits  missed beats');
rows.forEach((r, i) => console.log(String(i + 1).padStart(3) + '  ' + String(r.how).padEnd(8) + ' ' +
  String(r.t).padStart(6) + '   ' + r.hits + '/8   ' + (r.missed.length ? r.missed.join(',') : '-') + (r.err ? '   ERR ' + r.err : '')));
console.log('\nruns ' + rows.length + ', walked to beat 8: ' + done.length + ', median ' + median + ' s, worst ' + worst +
  ' s (target <= 180)');
const out = { runs: rows, median, worst, n: rows.length, walked: done.length, target: 180 };
writeFileSync(join(QA, 'wow2-tutorial.json.png'), JSON.stringify(out, null, 1));
process.exit(rows.length && worst !== null && worst <= 180 && done.length === rows.length ? 0 : 1);
