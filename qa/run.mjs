// ===========================================================================
// npm test
//
// Every check in this repo that can answer without a browser, run in one go,
// with a non-zero exit if any of them fails.
//
// THE DISTINCTION THAT MATTERS is between an audit that ASSERTS and one that
// merely REPORTS. An asserting audit calls process.exit on failure; a report
// prints its findings and exits 0 whatever it finds, which means it cannot fail
// a build and is not a test. Both kinds are run — the reports are worth reading
// — but only the asserting ones can turn the exit code red, and the listing
// below says which is which so that nobody mistakes a clean run of a report for
// a passing test.
//
// IT WAS SIX AND FIVE AND IS NOW NINE AND TWO. Three of the five reports each
// had a real zero-invariant buried inside a listing and no way to act on it:
// audit-tasks sat at one blocker for months (and it was a false positive it
// could not see past — read its 7c), p2-clues watched for a lone capital the
// control tables would eat, p3-glyph watched for a RECORDS key that is measured
// and shown nowhere. Each now exits non-zero on THAT invariant and only that
// one. What stayed a report stayed one for a reason: p7-tokens counts the HUD's
// radii and type steps, and p8-spawn measures a distance and says in its own
// output that it cannot see props a chapter builds itself. Neither has a right
// answer, and a check with no right answer must never be able to fail a build.
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
  // Promoted out of REPORTS. Each of the three had a genuine zero-invariant
  // buried in a listing and exited 0 whatever it found; audit-tasks stood at one
  // blocker for months, and the blocker was a false positive (see its 7c). They
  // now exit non-zero on THAT invariant only — the surrounding inventories are
  // descriptions of the game with no right answer and still cannot fail.
  ['qa/audit-tasks.mjs',  'tasks and finds: acts, arrivals, both award paths'],
  ['qa/p2-clues.mjs',     'every task has a clue and a place; no stray lone capital'],
  ['qa/p3-glyph.mjs',     'the measured-task glyph; no orphaned RECORDS key'],
];
const REPORTS = [
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
