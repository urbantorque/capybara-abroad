// qa/probes-alive.mjs — which probes are still pressing a card blind (L7, E7)
//
// Two questions, both static (no browser, no server): every browser probe at
// the top level of qa/ — the re-runnable instruments qa/README.md names, not
// the 1396 one-shots frozen under qa/probes/, which nothing maintains on
// purpose and this file does not touch —
//
//   1. does it open the game with a raw pixel click (`mouse.click(400, 400)`
//      or `(640, 400)`) instead of the keyboard door qa/_boot.js documents?
//      That is the exact shape of bug qa/fuzz.js regressed on once already
//      (L4, qa #1): a resize puts the pixel on the title card instead of its
//      backdrop, and the probe runs its whole sweep against a screen that
//      never started.
//   2. does it ever read `window.__capy.state.started` at all? A probe that
//      never reads it cannot know whether step 1 happened to it.
//
// A REPORT, not an ASSERT (npm test's distinction, see run.mjs's own
// header): most of qa/'s ~90 top-level probes are read-only instruments for
// a person to run by hand, not code this repository's build depends on, and
// a probe written five sessions ago for a question that is now answered is
// not a defect — see qa/README.md's "kept... but not maintained". This
// prints the count and flags the five named audits the roadmap called out
// (npchealth, props, pointers, audio2, kine) by name, because those five are
// the ones something else (qa/README.md itself) still points at.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const QA = join(ROOT, 'qa');
const NAMED = ['npchealth.js', 'props.js', 'pointers.js', 'audio2.js', 'kine.js'];

const files = readdirSync(QA).filter(f => (f.endsWith('.js') || f.endsWith('.mjs')) &&
  !f.startsWith('_') && f !== 'run.mjs');

const rawClick = [];
const noStartedRead = [];
for (const f of files) {
  const src = readFileSync(join(QA, f), 'utf8');
  if (/mouse\.click\(\s*(400|640)\s*,\s*400\s*\)/.test(src)) rawClick.push(f);
  if (/state\.started/.test(src) === false) noStartedRead.push(f);
}

console.log('probes-alive: ' + files.length + ' top-level probe' + (files.length === 1 ? '' : 's') +
            ' in qa/ (qa/probes/ is not counted — see its own README section)');
console.log('  ' + rawClick.length + ' still open on a raw pixel click: ' + (rawClick.join(', ') || '(none)'));
console.log('  ' + noStartedRead.length + ' never read state.started: ' +
            (noStartedRead.length <= 20 ? noStartedRead.join(', ') : noStartedRead.length + ' files — most are static/menu probes that have no reason to'));

const namedBad = NAMED.filter(f => rawClick.includes(f) || noStartedRead.includes(f));
if (namedBad.length) {
  console.log('FAIL-shaped (report only): the five named audits still include ' + namedBad.join(', '));
} else {
  console.log('the five named audits (npchealth, props, pointers, audio2, kine) all go through the door and write started');
}
