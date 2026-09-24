// Prints the newest (or every, with --all) qa/ten-t1e-<prefix>-*.json.png result.
//   node qa/ten-t1e-read.mjs condor [--all] [--brief]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const QA = dirname(fileURLToPath(import.meta.url));
const pre = 'ten-t1e-' + (process.argv[2] || 'condor') + '-';
const all = process.argv.includes('--all'), brief = process.argv.includes('--brief');
const files = readdirSync(QA).filter(f => f.startsWith(pre) && f.endsWith('.json.png'))
  .sort((a, b) => statSync(join(QA, a)).mtimeMs - statSync(join(QA, b)).mtimeMs);
for (const f of all ? files : files.slice(-1)) {
  const o = JSON.parse(readFileSync(join(QA, f), 'utf8'));
  console.log('==', f, o.errs && o.errs.length ? o.errs : '', JSON.stringify(o.result));
  if (brief) continue;
  for (const l of o.shot || []) console.log('shot', l.t, l.st, 'r' + l.rung, l.by, l.framing, l.inShot, l.a && l.a.shots);
  for (const l of o.log || []) console.log('log', l.t, l.st, 'r' + l.rung, l.by, l.agl, l.reach, l.mounted, l.a && JSON.stringify(l.a));
}
