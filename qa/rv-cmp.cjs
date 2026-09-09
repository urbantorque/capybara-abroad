// Compare geometry fingerprints from qa/rv-geom.js runs.
//
//   node qa/rv-cmp.cjs base1.json base2.json base3.json -- after.json
//
// WHY THIS IS A MULTISET TEST AND NOT A ROW-BY-ROW ONE. The world build is not
// fully deterministic even with Math.random seeded — about 23 of 1556 merged
// batches move between two otherwise identical runs — and scene paths are not
// unique (hundreds of batches are all 'Scene/Group/Group/Mesh'). So a row key
// built from the path is ambiguous and a strict row-for-row diff throws away
// two thirds of the evidence.
//
// Instead each batch is identified by a FINGERPRINT OF ITS OWN GEOMETRY:
// vertex count, index count, and hashes of the position, normal and colour
// arrays. Two runs of the same code produce almost exactly the same multiset of
// fingerprints. A change to the merger — which every one of these batches goes
// through — moves essentially all of them at once.
//
// THE CONTROL IS THE POINT. The script reports the same overlap figure for one
// of the BASELINE runs against the baseline intersection. That number is the
// noise floor. An 'after' run that scores the same as the control is
// behaviour-preserving; one that scores near zero is not. Without the control
// a 98 % overlap looks like a pass and a 98 % overlap is also exactly what a
// broken run looks like if you have no idea what a clean one scores.
//
// WHAT THIS CANNOT JUDGE, AND IT IS MOST CHANGES. This tool answers exactly one
// question: "did a refactor that must change nothing change nothing". It is
// useless the moment a change ADDS GEOMETRY OR CONSUMES A RANDOM NUMBER.
//
// Measured 9 Sep 2026, adding an approach ramp to Kyoto's bridge: nine chapters
// that the diff never touched came back with different vertex counts —
// Antarctica 116 644 -> 115 108, Hanoi 300 654 -> 303 538 — and it reproduced
// across runs, so it was not the bad-sample mode below. Every one of them is
// built AFTER Kyoto. Their scatter is procedural and reads from the same
// Math.random stream, so twenty new boxes upstream re-rolls everything
// downstream. Building Kyoto LAST did not fix it either; it just re-rolled a
// different set.
//
// AND THAT IS NOT A DEFECT. In real play the stream is not seeded at all and
// chapters build on first entry, so a player who goes to Venice before Iceland
// already gets different scatter in both. The variation this tool reports for
// such a change is the game working. Use it for refactors; for a change that
// adds anything, verify the affected chapters directly instead.
//
// A SINGLE FAIL IS NOT A FAIL. RE-RUN IT BEFORE BELIEVING IT. Measured on
// 9 Sep 2026: immediately after rewriting eight source files, one run came back
// 94.60 % — sixty-one batches below the floor — with a plausible-looking
// per-chapter breakdown. The next four runs, with NOT ONE CHARACTER changed in
// between, all came back at exactly 98.52 %. The bad sample was the browser
// serving a half-cached module set (harness traps 3 and 25 in the QA notes),
// and it cost a diagnosis that had already started attributing the fault to
// particular chapters.
//
// The tell that it is a bad sample rather than a defect: the noise is
// EXTREMELY stable when it is honest. Three baselines and every clean run
// score 1533/1556, and the twenty-three that move are the same twenty-three
// batches in the same six chapters every time. A real change moves batches in
// the chapter you touched; a bad sample sprays them everywhere, including
// chapters the diff never went near. Close the browser session and open it
// again before drawing any conclusion from a red run.
const fs = require('fs');
const argv = process.argv.slice(2);
const sep = argv.indexOf('--');
const baseFiles = sep < 0 ? argv : argv.slice(0, sep);
const afterFile = sep < 0 ? null : argv[sep + 1];

const load = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const fp = r => r.n + '|' + r.idx + '|' + r.p + '|' + r.nrm + '|' + r.c;

function bag(rows) {
  const m = new Map();
  for (const r of rows) { const k = fp(r); m.set(k, (m.get(k) || 0) + 1); }
  return m;
}
/** Multiset intersection: min count per fingerprint. */
function inter(a, b) {
  const m = new Map();
  for (const [k, n] of a) if (b.has(k)) m.set(k, Math.min(n, b.get(k)));
  return m;
}
function size(m) { let s = 0; for (const n of m.values()) s += n; return s; }
/** How many of `x`'s members are covered by `ref`. */
function overlap(x, ref) {
  let hit = 0, tot = 0;
  for (const [k, n] of x) { tot += n; hit += Math.min(n, ref.get(k) || 0); }
  return { hit, tot, pct: tot ? 100 * hit / tot : 0 };
}

const bags = baseFiles.map(f => bag(load(f).rows));
let ref = bags[0];
for (let i = 1; i < bags.length; i++) ref = inter(ref, bags[i]);

console.log('baseline runs        : ' + bags.length);
console.log('batches per run      : ' + bags.map(size).join(', '));
console.log('baseline intersection: ' + size(ref) + ' batches');

const control = overlap(bags[0], ref);
console.log('CONTROL (base1 vs intersection): ' +
            control.hit + '/' + control.tot + '  = ' + control.pct.toFixed(2) + '%');

if (!afterFile) { console.log('\n(no after-file given)'); process.exit(0); }

const a = bag(load(afterFile).rows);
const got = overlap(a, ref);
console.log('\nafter file           : ' + afterFile);
console.log('AFTER   (after vs intersection): ' +
            got.hit + '/' + got.tot + '  = ' + got.pct.toFixed(2) + '%');

// The after run must sit at the control's own noise floor. A whole percentage
// point below it is thirty-odd batches that changed shape, which is not noise.
const slack = 1.0;
const ok = got.pct >= control.pct - slack;
console.log('\n' + (ok
  ? 'PASS — the after run matches the baseline within the control noise floor ' +
    '(' + got.pct.toFixed(2) + '% vs ' + control.pct.toFixed(2) + '%).'
  : 'FAIL — the after run is ' + (control.pct - got.pct).toFixed(2) +
    ' points below the control. The merged geometry changed.'));
process.exit(ok ? 0 : 1);
