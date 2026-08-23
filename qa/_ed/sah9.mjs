import fs from 'fs';
let s = fs.readFileSync('src/sahara.js', 'utf8');
function rep(a,b){const n=s.split(a).length-1;if(n!==1){console.error('FAIL('+n+'): '+a.slice(0,60));process.exit(1)}s=s.replace(a,()=>b)}

// ---- THE KHETTARA, which is the best object in the Sahara ----------------
rep(`function sahBuildKsar(game, root) {`,
`/**
 * THE KHETTARA. A DEAD STRAIGHT LINE OF HOLES ACROSS AN EMPTY PLAIN.
 *
 * The palmeraie at x = 96 is thirty metres above nothing and a hundred and
 * eighty metres from any water, and the reason it exists — the reason ANY of
 * them exist — is a khettara: a gently sloping tunnel driven for kilometres
 * from the water table under the hills to the grove, dug and maintained
 * through a line of vertical shafts sunk every fifteen metres. Each shaft has
 * a doughnut of spoil round its mouth, and from the air the whole system reads
 * as a chain of craters marching dead straight across bare gravel.
 *
 * It is the single most striking man-made object in this landscape, it is
 * invisible except for the holes, and it does the one job the middle of this
 * chapter needed doing: it is a LINE. A world you cross needs something to
 * cross it against, and a hundred and eighty metres of hamada with three thorn
 * bushes on it has nothing.
 *
 * The mouths are solid. A two-metre hole in the ground with a metre of spoil
 * round it that the animal walks straight through would be the most obvious
 * bug in the chapter.
 */
function sahBuildKhettara(game, root) {
  const M = sahMerger();
  const SG = sahStaticGroup(game);
  // from the foot of the hills west of the medina to the head of the grove,
  // and it does not deviate, because the whole engineering point is that it
  // does not
  const x0 = 88, x1 = 268, z0 = -74, z1 = -58;
  const N = 13;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const x = lerp(x0, x1, t), z = lerp(z0, z1, t);
    const gy = sahTerrain(x, z);
    // the spoil ring: twelve blocks round a hole, higher on the downwind side
    // because that is where it has drifted
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * 6.28318;
      const h = 0.55 + Math.max(0, Math.cos(a - 1.2)) * 0.45;
      M.box(x + Math.cos(a) * 2.15, gy + h * 0.45, z + Math.sin(a) * 2.15,
            1.25, h, 1.05,
            k % 3 ? PALETTE.sahGravel : PALETTE.sahSandDeep,
            0.05 * Math.sin(a), a, 0.05 * Math.cos(a));
      SG.add(x + Math.cos(a) * 2.15, gy + h * 0.45, z + Math.sin(a) * 2.15,
             1.3, h + 0.2, 1.1, a);
    }
    // the mouth itself, which is a dark disc and nothing else. It is a MARK —
    // flush, and it never casts, because a hole cannot throw a shadow.
    M.cyl(x, gy + 0.035, z, 1.35, 0.07, PALETTE.sahSandDeep, 0, 0, 0, 8);
    M.cyl(x, gy + 0.01, z, 1.05, 0.05, PALETTE.sahStormDeep, 0, 0, 0, 8);
    // and every third one still has its windlass over it
    if (i % 3 === 1) {
      for (let e = -1; e <= 1; e += 2) {
        M.cyl(x + e * 1.5, gy + 1.0, z, 0.10, 2.0, PALETTE.sahPalmTrunk, 0, 0, e * 0.16, 6);
      }
      M.cyl(x, gy + 1.95, z, 0.14, 3.0, PALETTE.sahPalmTrunk, 0, 0, Math.PI * 0.5, 6);
      M.cyl(x + 0.55, gy + 1.95, z, 0.24, 0.7, PALETTE.sahCedar, 0, 0, Math.PI * 0.5, 6);
      SG.add(x, gy + 1.0, z, 3.4, 2.2, 0.5, 0);
    }
  }
  SG.done();
  const m = new THREE.Mesh(M.build(), sahVC());
  m.name = 'sahKhettara';
  m.castShadow = true;
  m.receiveShadow = true;
  root.add(m);
}

function sahBuildKsar(game, root) {`);
rep('  sahBuildKsar(game, sahRoot);', '  sahBuildKsar(game, sahRoot);\n  sahBuildKhettara(game, sahRoot);');

// ---- and the plain needs more on it -------------------------------------
rep(`    const nTh = erg ? 5 : 16;`, `    const nTh = erg ? 9 : 26;`);
rep(`    for (let i = 0; i < (erg ? 22 : 14); i++) {`, `    for (let i = 0; i < (erg ? 34 : 24); i++) {`);
rep(`      for (let i = 0; i < 4; i++) {
        const x = rand(C[0], C[1]), z = rand(C[2], C[3]);
        if (sahVarBlocked(x, z)) continue;
        const y = sahTerrain(x, z);
        // a rib cage, which is four curved staves and nothing else`,
`      for (let i = 0; i < 6; i++) {
        const x = rand(C[0], C[1]), z = rand(C[2], C[3]);
        if (sahVarBlocked(x, z)) continue;
        const y = sahTerrain(x, z);
        // a rib cage, which is four curved staves and nothing else`);
rep(`    if (!erg && (c % 4) === 2) {`, `    if (!erg && (c % 3) === 2) {`);
fs.writeFileSync('src/sahara.js', s); console.log('ok');
