import fs from 'fs';
let s = fs.readFileSync('src/drift.js', 'utf8');
function rep(a, b) {
  const n = s.split(a).length - 1;
  if (n !== 1) { console.error('FAIL(' + n + '): ' + a.slice(0, 70)); process.exit(1); }
  s = s.replace(a, () => b);
}

// 1. driBlockedForAir: a mover carries its height on .def
rep(`  const isle = driIslandAt(x, z);
  if (isle && y > isle.y - 14 && y < isle.y + 10) return true;`,
`  const isle = driIslandAt(x, z);
  // driIslandAt is single-valued over TWO tables and they do not have the same
  // shape: a fixed island carries its own y, a wanderer carries it on .def.
  // Everything else in this file that asks the question goes through
  // driTerrain, which does the unwrapping; this one has to do it itself.
  if (isle) {
    const iy = isle.def ? isle.def.y : isle.y;
    if (y > iy - 14 && y < iy + 10) return true;
  }`);

// 2. the deep rank is a silhouette, so it gets no walls
rep(`  const WALLED = ['shelf', 'stepA', 'stepC', 'shoalA', 'orchard', 'farside', 'crown',
                  'pebC', 'pebE', 'deepA', 'deepB', 'deepE'];`,
`  // ---- AND NOT ON THE DEEP RANK -----------------------------------------
  // qa/audit-solid.js walks the whole world including the deep islands (deepA
  // sits at x = -110, which IS the edge of the playable box), and a wall out
  // there is either thirty more static bodies in the broadphase for scenery
  // nobody stands on, or three walk-through hits. driBuildFarDressing already
  // gives that rank a skyline, and a field boundary is a thing you read from
  // the island you are standing on.
  const WALLED = ['shelf', 'stepA', 'stepC', 'shoalA', 'orchard', 'farside', 'crown',
                  'pebC', 'pebE'];`);
rep(`    const deep = s.id.indexOf('deep') === 0;
    // one wall`, `    // one wall`);
rep(`      // A wall a metre high is a thing you walk into, and the deep rank is not
      // somewhere anybody stands — no body out there, and no broadphase entry
      // for a silhouette.
      if (!deep) driStaticBox(game, wx, s.y + 0.45, wz, 0.8, 0.90, 1.1, s.yaw);`,
`      // A wall a metre high is a thing you walk into.
      driStaticBox(game, wx, s.y + 0.45, wz, 0.8, 0.90, 1.1, s.yaw);`);

// 3. the deep rank's monoliths ARE inside the world, so they are solid
rep(`function driBuildFarDressing(root) {
  const M = driMerger();
  const E = driMerger();
  function dress(x, z, y, hx, hz, yaw, kind, seed) {`,
`function driBuildFarDressing(game, root) {
  const M = driMerger();
  const E = driMerger();
  // 'solid' is true only for the DEEP rank — deepA reaches x = -110, which is
  // the edge of the playable box, so a five-metre monolith out there is
  // something the player can genuinely walk into, and qa/audit-solid.js walks
  // it. The far rank and the third rank are two hundred to four hundred metres
  // out, past everything, and are silhouettes: a static body apiece would be
  // pure broadphase.
  function dress(x, z, y, hx, hz, yaw, kind, seed, solid) {`);
rep(`        M.oct(wx, y + h + 0.25, wz, 0.45, PALETTE.driStone, a * 0.3, a, 0.1);`,
`        M.oct(wx, y + h + 0.25, wz, 0.45, PALETTE.driStone, a * 0.3, a, 0.1);
        if (solid) driStaticBox(game, wx, y + h * 0.5, wz, 1.2, h, 1.0, a);`);
rep(`    dress(s.x, s.z, s.y, s.hx, s.hz, s.yaw, s.kind, i + 5);`,
`    dress(s.x, s.z, s.y, s.hx, s.hz, s.yaw, s.kind, i + 5, s.id.indexOf('deep') === 0);`);
rep(`    dress(f.x, f.z, f.y, f.hx, f.hz, i * 0.7, f.kind, 90 + i);`,
`    dress(f.x, f.z, f.y, f.hx, f.hz, i * 0.7, f.kind, 90 + i, false);`);
rep('  driBuildFarDressing(driRoot);', '  driBuildFarDressing(game, driRoot);');

// 4. re-entering a chapter you have already finished must not replay its ending
rep(`      driRideT = 0; driRideId = ''; driColIdx = -1;
      driWasGrounded = true;
    },`,
`      driRideT = 0; driRideId = ''; driColIdx = -1;
      driWasGrounded = true;
      // ---- AND THE ENDING DOES NOT PLAY TWICE -----------------------------
      // driLit is one of the few flags in this file that is MEANT to survive
      // travel — the lantern stays lit, and it should. driAnswerTheLantern
      // hangs its whole twenty-two second sequence off driAnswerT, which is
      // reset state; come back to the Drift after finishing it and the horizon
      // relights itself from scratch, twenty-six chimes and all, while you are
      // standing on the Shelf two hundred metres away. Snap it to done instead.
      // Same class exactly as the seed index below: a value armed for a moment
      // that outlives the moment.
      if (driLit) {
        driAnswerT = 999;
        driAnswerLit = driFARLAMP.length / 3;
        if (driFarLampMat) driFarLampMat.opacity = 0.90;
      }
    },`);

fs.writeFileSync('src/drift.js', s);
console.log('ok');
