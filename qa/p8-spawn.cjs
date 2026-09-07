// ---------------------------------------------------------------------------
// qa/p8-spawn.cjs — IS THERE ANYTHING WHERE THE PLAYER LANDS? (B6)
//
// B5 found Hanoi with nothing loose within sixteen metres of its spawn and
// nobody within twenty-six, in a city whose arrival line is "seven million
// people and six million of them are on a moped". Its two scatter clusters
// were 88 m and 154 m away. That took a nineteen-chapter browser sweep to
// find, and it did not have to: `physBIOME_SCATTER`'s annuli and main.js's
// `*_SPAWN` constants are both static, and the distance between them is
// arithmetic.
//
// This is that arithmetic. **It cannot see chapter-owned props**, and there is
// a measured example of exactly that: Marrakech's only scatter cluster is 40 m
// from its spawn and this file says so, while `qa/gag-ring.js` — which asks the
// live world — counts six loose props there, the nearest at 7 m, because
// sahara.js builds its own square. So this is a REPORT and never a blocker, and
// a line in it is a question ("is there really nothing there?") rather than a
// finding. `qa/gag-ring.js` is the authority; this is the cheap thing that runs
// on every build and would have caught Hanoi without a browser at all.
//
// Run: node qa/p8-spawn.cjs
// ---------------------------------------------------------------------------
const fs = require('fs');

const props = fs.readFileSync('src/props.js', 'utf8');
const main = fs.readFileSync('src/main.js', 'utf8');
const shared = fs.readFileSync('src/shared.js', 'utf8');

// ---- the spawns -----------------------------------------------------------
const SPAWN = {};
for (const m of main.matchAll(/^\s+([A-Z]+)_SPAWN: \{ x: (-?[\d.]+), y: (-?[\d.]+), z: (-?[\d.]+)/gm)) {
  SPAWN[m[1].toLowerCase()] = { x: +m[2], z: +m[4] };
}

// ---- the chapters, so the report is in chapter order ----------------------
const CH = [];
for (const m of shared.matchAll(/\{ n: (\d+), biome: '([a-z]+)'/g)) CH.push({ n: +m[1], biome: m[2] });

// ---- the scatter annuli ---------------------------------------------------
// One entry per chapter, each `{ x, z, r0, r1 }`, including every `also` —
// which may be one object or a list of them.
function ringsOf(seg) {
  const out = [];
  for (const m of seg.matchAll(/x: (-?[\d.]+), z: (-?[\d.]+), r0: ([\d.]+), r1: ([\d.]+)/g)) {
    out.push({ x: +m[1], z: +m[2], r0: +m[3], r1: +m[4] });
  }
  return out;
}
const si = props.indexOf('const physBIOME_SCATTER');
const sseg = props.slice(si, props.indexOf('\nconst physBiomeScattered'));
// Split on the top-level keys: two spaces, a name, a colon, a brace.
const parts = sseg.split(/\n  ([a-z]+):\s+\{/);
const RINGS = {};
for (let i = 1; i < parts.length; i += 2) RINGS[parts[i]] = ringsOf(parts[i + 1]);

/** Closest a scattered prop could possibly land to the spawn, in metres. */
function nearest(sp, ring) {
  const d = Math.hypot(ring.x - sp.x, ring.z - sp.z);
  // The annulus is every point between r0 and r1 of the centre.
  if (d < ring.r0) return ring.r0 - d;
  if (d > ring.r1) return d - ring.r1;
  return 0;
}

const LOUD = 25;          // metres; past this the spawn ring is empty of scatter
const rows = [], warn = [];
for (const c of CH) {
  const sp = SPAWN[c.biome];
  const rings = RINGS[c.biome];
  if (!sp) { warn.push('ch' + c.n + ' ' + c.biome + ': no *_SPAWN found'); continue; }
  if (!rings || !rings.length) { rows.push({ c: c, d: null }); continue; }
  let best = Infinity;
  for (const r of rings) best = Math.min(best, nearest(sp, r));
  rows.push({ c: c, d: best, rings: rings.length });
  if (best > LOUD) {
    warn.push('ch' + c.n + ' ' + c.biome + ': nearest SCATTERED prop could be ' +
              best.toFixed(0) + ' m from the spawn (' + rings.length + ' cluster' +
              (rings.length === 1 ? '' : 's') + ') — check qa/gag-ring.js before ' +
              'believing it; this cannot see props the chapter builds itself');
  }
}

console.log('spawn-to-scatter, metres (null = this chapter scatters nothing):');
console.log(rows.map((r) => r.c.n + ':' + (r.d === null ? '-' : r.d.toFixed(0))).join(' '));
for (const w of warn) console.log('warn  ' + w);
console.log(warn.length ? warn.length + ' chapters land away from their own scatter'
                        : 'every chapter that scatters does it where the player lands');
