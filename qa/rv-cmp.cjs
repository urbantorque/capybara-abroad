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
