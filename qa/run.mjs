// ===========================================================================
// npm test
//
// Every check in this repo that can answer without a browser, run in one go,
// with a non-zero exit if any of them fails.
//
// THE DISTINCTION THAT MATTERS is between an audit that ASSERTS and one that
// merely REPORTS. Four of the seven static audits that existed before this
// runner call process.exit on failure; three print their findings and exit 0
// whatever they find, which means they cannot fail a build and are not tests.
// Both kinds are run — the reports are worth reading — but only the asserting
// ones can turn the exit code red, and the listing below says which is which
// so that nobody mistakes a clean run of a report for a passing test.
// ===========================================================================
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const ASSERTS = [
  ['qa/strip-test.mjs',   'the comment stripper: 16 cases plus every source file re-parsed'],
  ['qa/p6-static.cjs',    'CHAPTERS and TASKS: acts, notes, arrivals, the souvenir exception'],
  ['qa/xmodule.mjs',      'cross-module contract: imports, exports, name collisions'],
  ['qa/channels.mjs',     'the four channels of "that landed"'],
  ['qa/lines.mjs',        'dialogue pools: shape and duplication'],
  ['qa/verbs.mjs',        'the verb table against what the chapters actually use'],
];
const REPORTS = [
  ['qa/audit-tasks.mjs',  'task coverage per chapter'],
  ['qa/p2-clues.mjs',     'every task has a clue and a place'],
  ['qa/p3-glyph.mjs',     'the measured-task glyph'],
  ['qa/p7-tokens.cjs',    'the HUD vocabulary: radii, type steps, shadows'],
  ['qa/p8-spawn.cjs',     'is there anything loose where the player lands'],
];

function run(file) {
  if (!existsSync(file)) return { missing: true };
  const r = spawnSync(process.execPath, [file], { encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

let failed = 0, ran = 0;
console.log('--- asserting ---');
for (const [f, what] of ASSERTS) {
  const r = run(f);
  ran++;
  if (r.missing) { console.log('MISSING  ' + f); failed++; continue; }
  const ok = r.code === 0;
  if (!ok) failed++;
  console.log((ok ? 'pass  ' : 'FAIL  ') + f.padEnd(22) + what);
  if (!ok) console.log(r.out.split('\n').filter(Boolean).slice(-12).map(l => '        ' + l).join('\n'));
}
console.log('\n--- reports (cannot fail the build) ---');
for (const [f, what] of REPORTS) {
  const r = run(f);
  ran++;
  if (r.missing) { console.log('missing  ' + f); continue; }
  const last = r.out.split('\n').filter(Boolean).pop() || '';
  console.log('      ' + f.padEnd(22) + what + '\n        ' + last.trim());
}

console.log('\n' + ran + ' checks, ' + failed + ' failed');
if (failed) {
  console.log('\nThe browser suites are not in here and cannot be: they need a server and a');
  console.log('real frame clock. Run them with:');
  console.log('  npm start                       (or PORT=5188 node server.mjs)');
  console.log('  npm run soak');
}
process.exit(failed ? 1 : 0);
