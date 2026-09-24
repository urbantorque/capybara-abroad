// T2b: print the newest (or every) qa/ten-t2b-helm-*.json.png result.
//   node qa/ten-t2b-read.mjs [all]
import { readFileSync, readdirSync } from 'node:fs';
const fs = readdirSync('qa').filter(f => /^ten-t2b-helm-\d+\.json\.png$/.test(f)).sort();
for (const f of process.argv[2] === 'all' ? fs : fs.slice(-1)) {
  const o = JSON.parse(readFileSync('qa/' + f, 'utf8'));
  console.log(f, JSON.stringify({ leadOff: o.leadOff, errs: o.errs, helm: o.helm, tick: o.tick, called: o.called,
    states: o.states, maxBoatPackWithPod: o.maxBoatPackWithPod, lastError: o.lastError, dbg: o.dbg }));
  if (process.argv[2] !== 'all') for (const l of o.log) console.log(JSON.stringify(l));
}
