import fs from 'fs';
let s = fs.readFileSync('src/sahara.js', 'utf8');
function rep(a,b){const n=s.split(a).length-1;if(n!==1){console.error('FAIL('+n+'): '+a.slice(0,60));process.exit(1)}s=s.replace(a,()=>b)}
rep(`function sahBuildKhettara(game, root) {`,
`/**
 * THE TOWERS ON THE WALL, AND THE OLIVE GROVE OUTSIDE IT.
 *
 * The medina's rampart is eleven bays of battered pisé with merlons on top and
 * nothing else, which is a hundred and thirty metres of the same object. An
 * Almohad wall has a square tower every thirty metres or so — that is what
 * gives it a rhythm, and it is the only thing that stops a long wall reading as
 * a fence. Four of them, standing proud of the face and two metres higher than
 * the coping.
 *
 * And beyond it, the olive grove. Marrakech is ringed by them, they are the
 * first thing outside every gate, and the ground between the gate and the
 * hamada was bare. An olive is a short crooked trunk with a wide silver-grey
 * head — a completely different silhouette from the palms forty metres away,
 * which is the entire point of putting one here.
 */
function sahBuildTowers(game, root) {
  const M = sahMerger();
  const SG = sahStaticGroup(game);
  const gz = sahGATE.z;
  const at = [gz - sahGATE_OUT - 17, gz - sahGATE_OUT - 51, gz + sahGATE_OUT + 17,
              gz + sahGATE_OUT + 40];
  for (let i = 0; i < at.length; i++) {
    const z = at[i];
    // battered: 5.6 m at the foot, 4.4 at the coping, in five lifts
    for (let k = 0; k < 6; k++) {
      const t = k / 6;
      M.box(70.9, 0.95 + k * 1.9, z, 3.9 - t * 0.7, 1.9, 5.6 - t * 1.2,
            k % 2 ? PALETTE.sahOchre : PALETTE.sahOchreDk);
    }
    M.box(70.9, 12.1, z, 4.2, 0.8, 6.0, PALETTE.sahOchreDk);
    for (let k = 0; k < 5; k++) {
      M.box(70.9, 13.1, z - 2.2 + k * 1.1, 4.0, 1.2, 0.62, PALETTE.sahOchrePale);
    }
    // the putlog holes again, because it is the same wall by the same builders
    for (let k = 1; k < 5; k++) {
      M.cyl(72.9, 1.4 + k * 2.1, z, 0.09, 0.8, PALETTE.sahPalmTrunk, 0, 0, Math.PI * 0.5, 4);
    }
    SG.add(70.9, 6.0, z, 4.0, 12, 5.8, 0);
  }
  // ---- the olive grove -----------------------------------------------------
  for (let i = 0; i < 34; i++) {
    // between the wall and the hamada, in rows, because an olive grove is
    // planted and a palmeraie is planted and neither of them is a wood
    const row = i % 6, col = (i / 6) | 0;
    const x = 84 + col * 7.4 + (row % 2) * 2.2;
    const z = -18 + row * 8.2 + Math.sin(i * 1.7) * 1.4;
    if (Math.abs(x - sahGATE.x) < 12 && Math.abs(z - sahGATE.z) < 10) continue;
    const gy = sahTerrain(x, z);
    const h = 1.5 + ((i * 5) % 4) * 0.22;
    // a crooked trunk in two leans, which is what an old olive is
    M.cyl(x, gy + h * 0.32, z, 0.30, h * 0.7, PALETTE.sahCedarDk, 0.10, i, 0.08, 6);
    M.cyl(x + 0.14, gy + h * 0.78, z + 0.08, 0.22, h * 0.5, PALETTE.sahCedarDk,
          -0.14, i + 1, -0.10, 6);
    // and the head: three flattened lobes, silver-grey-green
    for (let k = 0; k < 3; k++) {
      const a = k * 2.094 + i;
      M.sph(x + Math.cos(a) * 0.85, gy + h * 1.24 + (k % 2) * 0.24,
            z + Math.sin(a) * 0.85, 1.35, 0.80, 1.25,
            k % 2 ? PALETTE.sahPalm : PALETTE.sahPalmDry);
    }
    SG.add(x, gy + h * 0.5, z, 0.8, h, 0.8, 0);
  }
  SG.done();
  const m = new THREE.Mesh(M.build(), sahVC());
  m.name = 'sahTowers';
  m.castShadow = true;
  m.receiveShadow = true;
  root.add(m);
}

function sahBuildKhettara(game, root) {`);
rep('  sahBuildKhettara(game, sahRoot);', '  sahBuildKhettara(game, sahRoot);\n  sahBuildTowers(game, sahRoot);');
rep(`    const nTh = erg ? 9 : 26;`, `    const nTh = erg ? 12 : 34;`);
fs.writeFileSync('src/sahara.js', s); console.log('ok');
