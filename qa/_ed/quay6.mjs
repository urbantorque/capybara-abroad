import fs from 'fs';
let s = fs.readFileSync('src/quay.js', 'utf8');
function rep(a,b){const n=s.split(a).length-1;if(n!==1){console.error('FAIL('+n+'): '+a.slice(0,60));process.exit(1)}s=s.replace(a,()=>b)}
rep(`function quayBuildBush(root) {`,
`/**
 * THE NORFOLK ISLAND PINES ALONG MANLY BEACH.
 *
 * The voyage ENDS here. Ninety seconds of steering, a beach, a wharf, and the
 * one thing every photograph of Manly since 1880 has in it — the double row of
 * Norfolk pines down the front — was not drawn. They are the arrival, they are
 * visible from half way across the harbour, and a Norfolk pine is the easiest
 * tree in the world to draw: a dead straight mast with horizontal tiers coming
 * off it, each a little shorter than the one below, and nothing else.
 *
 * They go along the back of the dry sand at z = quayMANLY.z - 30, which
 * quayGroundY already answers 1.125 for — behind the beach, never between the
 * camera and the water, and clear of the wharf approach.
 */
function quayBuildPines(game, root) {
  const M = quayMerger();
  const F = quayPool();
  const MZ = quayMANLY.z - 31;
  for (let i = 0; i < 15; i++) {
    const px = quayMANLY.x - 42 + i * 6.1;
    // not across the wharf approach, which is the line the boat comes in on
    if (Math.abs(px - quayMANLY.x) < 11) continue;
    const gy = quayWATER_Y + 1.125;
    const h = rand(11, 15);
    // the mast: one straight trunk, and it does not taper much, which is the
    // whole silhouette
    M.cyl(px, gy + h * 0.5, MZ, 0.28, h, PALETTE.trunkDark, 0, 0, 0, 6);
    // the tiers: horizontal, evenly spaced, shortening to a point. Nine of
    // them, because eight reads as a Christmas tree and twelve reads as a fern.
    for (let k = 0; k < 9; k++) {
      const t = k / 8;
      const ty = gy + h * (0.30 + t * 0.68);
      const r = (1 - t) * (1 - t) * 3.4 + 0.35;
      M.cone(px, ty, MZ, r, 1.15 + (1 - t) * 0.5,
             k % 2 ? PALETTE.leafC : PALETTE.leafA, 0, k * 0.7, 0, 6);
    }
    M.cone(px, gy + h * 1.02, MZ, 0.42, 1.5, PALETTE.leafC, 0, 0, 0, 6);
    quayPoolBox(F, px, gy + h * 0.5, MZ, 0.32, h * 0.5, 0.32);
  }
  quayPoolDone(game, F);
  const m = new THREE.Mesh(M.build(), quayVC());
  m.name = 'quayPines';
  m.castShadow = true;
  m.receiveShadow = true;
  root.add(m);
}

function quayBuildBush(root) {`);
rep('  quayBuildBush(quayRoot);', '  quayBuildBush(quayRoot);\n  quayBuildPines(game, quayRoot);');
rep(`    const n = Math.round(H.r * H.r * (exposed ? 0.036 : 0.058));`,
    `    const n = Math.round(H.r * H.r * (exposed ? 0.040 : 0.064));`);
fs.writeFileSync('src/quay.js', s); console.log('ok');
