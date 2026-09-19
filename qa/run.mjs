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
  // THE ARTEFACT IS BUILT, EVERY TIME (L4, qa #11). The two failures this
  // build has had — the `$'` splice and the worklet that would not load from
  // file:// — were visible only by opening the file, because nothing here ever
  // made it. build.mjs exits 1 on a contract violation (a collision, a module
  // it cannot wrap, a splice it cannot anchor) and writes dist/ on success;
  // ~10 s, which is half of what this suite took before it. What it still
  // cannot do is BOOT the file: that needs a browser, and qa/l4-ks.js is the
  // step that opens dist/ from file:// and asserts started and musAudit().ks.
  // THE VOICE (L4, E5): no line lives in two pools, and the two regulars
  // found by kind rather than by their first line are still on the table.
  ['qa/l4-lines-dups.mjs', 'dialogue pools: no line in two pools'],
  ['qa/l4-pal-static.cjs',  'the two regulars found by kind (Sydney, Pasto)'],
  // THE VOICE'S TICS (L6, E7): no author's phrase in more than three files.
  ['qa/l6-tics.mjs',        'dialogue literals: no phrase in more than three files'],
  // ONE SENTENCE PER SURFACE (L7, E6): the place card's sub is said neither
  // by the notebook's first line nor by the departure card; no "chapter" in
  // the past tense; at most five `left` lines end on "You…"; no percentage
  // on the paper; every chapter answers a returner.
  ['qa/l7-echo.mjs',        'CHAPTERS: sub~nb[0] and sub~left share no trigram; no "chapter"; the again lines'],
  // THE VOCABULARY OF A PLACE (L7, E2): generic voices played half an octave
  // off their recipe, counted; a ratchet, so the number cannot go back up.
  ['qa/l7-voices.mjs',      'generic sfx voices transposed half an octave: the count does not rise'],
  // THE ANIMAL GETS BETTER (L8, F3): every sysUPGRADES id read somewhere, the
  // everyday six sum to 730, the three capstones add 1020, the hop apex's own
  // two constants never multiplied by a mod.
  ['qa/l8-catalogue.mjs',   'sysUPGRADES: ids read, the everyday/capstone sums, the apex untouched'],
  // ONE PERSON (ROADMAP-WOW, Part C): npcPERSON exported once with its
  // numbers pinned, the roster reads it, every crowd builder (Marrakech, Rio)
  // imports it and builds through it, and nobody puts a sphere on a body.
  ['qa/wow-person.mjs',     'npcPERSON: exported, pinned, read by the roster and every crowd builder'],
  // HANOI, SMOOTHED (L9, T): hanLaneYawAt is a real 3 m central difference,
  // hanLaneAtS's own position/yaw outputs are untouched, all five read sites
  // (bikes, the ride, the folk) actually call it, and the open-lane recycle
  // is distance-gated rather than an unconditional teleport.
  ['qa/l9-hanoi-smooth.js', 'Hanoi lane heading: the smoothing wiring and the recycle gate'],
  // THE YUZU, SEEN (L9, V): the ×1.6 scale and its leaf nubs, the 0.85-1.0
  // lift, the pooled aura's size/colour/pulse, the shaft's borrowed geometry
  // gated to three biomes, the widened sparkle radius, the minimap dot.
  ['qa/l9-yuzu-visible.js', 'the yuzu scale/lift/aura/shaft/sparkle/minimap wiring'],
  // THE PAPER, TUCKED and THE CHART, READ AT A GLANCE (L9, H/M): the tuck
  // rule's inversion and its two folds, the item pill's hide-vs-dim split,
  // the phone-width home collision fix; the chart's resize, hover-only door
  // label, deepened frame, narrowed cone, five distinct glyphs, hover/hold
  // legend, hold-to-zoom, live/quiet fade, single-band trail, and the
  // `mapMarkPos` `live` resolver contract Wave 3's shop will read.
  ['qa/l9-hud-map.js',    'the paper\'s tuck/fold/pill fixes and the chart\'s M1-M9 pass'],
  // A SHOP, EVERY BIOME, ON THE MAP (L9, S): the shared stall (posts/table,
  // a static body, never a physTYPES prop), the per-chapter angle/dist
  // escape hatch Kyoto's bridge deck needed, the map's live-resolved sixth
  // glyph and its off-map arrow, the paper's sysSHOP_ID row gated on
  // chapDoneHere and cheapestUnowned(), and no new save key.
  ['qa/l9-shop-static.mjs', 'the shop: the shared stall, the map glyph, the paper row, no new save key'],
  ['build.mjs',           'the one-file build: wraps, splices, no collisions, writes dist/'],
];
const REPORTS = [
  ['qa/p7-tokens.cjs',    'the HUD vocabulary: radii, type steps, shadows'],
  ['qa/p8-spawn.cjs',     'is there anything loose where the player lands'],
  // THE PROBES ALIVE (L7, E7): which browser probes still open on a raw
  // pixel click instead of qa/_boot.js's keyboard door.
  ['qa/probes-alive.mjs', 'browser probes: raw pixel clicks, state.started reads'],
  // THE SOAK HAS A HISTORY (L6, E8 / qa F5). `npm run soak` boots the game
  // under playwright and appends one line to qa/soak-history.jsonl; this
  // reads it back and says which columns moved more than 30 % against the
  // last three rows. A REPORT and not an assert on purpose: it needs a
  // history this checkout may not have, and a check that cannot run must
  // not be a check that fails. It exits non-zero on a move for `npm run
  // soak`, which is the run that has just added the row it is judging.
  ['qa/soak-diff.mjs',    'the soak against its last three rows'],
];

function run(file) {
  if (!existsSync(file)) return { missing: true };
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [file], { encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || ''), ms: Date.now() - t0 };
}

let failed = 0, ran = 0;
console.log('--- asserting ---');
for (const [f, what] of ASSERTS) {
  const r = run(f);
  ran++;
  if (r.missing) { console.log('MISSING  ' + f); failed++; continue; }
  const ok = r.code === 0;
  if (!ok) failed++;
  console.log((ok ? 'pass  ' : 'FAIL  ') + f.padEnd(22) + what + (r.ms >= 3000 ? '  (' + (r.ms / 1000).toFixed(1) + ' s)' : ''));
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
