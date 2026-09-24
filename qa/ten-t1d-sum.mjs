// T1d: one line per passage run out of qa/ten-t1d-pass-<n>.json.png.
//   node qa/ten-t1d-sum.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const QA = dirname(fileURLToPath(import.meta.url));
const runs = readdirSync(QA).filter(f => /^ten-t1d-pass-\d+\.json\.png$/.test(f)).sort();
let ok = 0;
for (const f of runs) {
  const o = JSON.parse(readFileSync(join(QA, f), 'utf8'));
  const a = o.arrived;
  if (a) ok++;
  console.log(f, JSON.stringify({ byE: o.helmByE, arrived: !!a, runT: a ? a.runT : o.final.runT, fortMin: o.fortMin,
    headOnN: (a || o.final).headOnN, dolphinAt: o.dolphinAt || null, end: [o.final.x, o.final.z, o.final.speed], err: o.err }));
}
console.log(`arrived ${ok} of ${runs.length}`);
