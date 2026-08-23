import fs from 'fs';
let s = fs.readFileSync('src/iceland.js', 'utf8');
function rep(a,b){const n=s.split(a).length-1;if(n!==1){console.error('FAIL('+n+'): '+a.slice(0,60));process.exit(1)}s=s.replace(a,()=>b)}

// ---- the colonnade: four ranks, and only the front one casts -------------
rep(`function iceBuildColumns(game, root) {
  const M = iceMerger();
  const SG = iceStaticGroup(game);`,
`function iceBuildColumns(game, root) {
  const M = iceMerger();     // the front rank: casts, because the shadow of a
                             // colonnade on its own talus IS the picture
  const MN = iceMerger();    // and the three behind it, which cast onto rock
                             // that is already in the shadow of the rank in
                             // front — 8,000 triangles drawn twice for nothing
  const SG = iceStaticGroup(game);`);
rep(`  for (let ring = 0; ring < 5; ring++) {`, `  for (let ring = 0; ring < 4; ring++) {`);
rep(`      M.cyl(x, iceSEA_Y + h * 0.5, z, PITCH * 0.5, h,
            (k + ring) % 3 ? PALETTE.iceBasalt : PALETTE.iceBasaltDk,
            0, a * 0.3 + k, 0, 6);`,
`      const T = ring === 0 ? M : MN;
      T.cyl(x, iceSEA_Y + h * 0.5, z, PITCH * 0.5, h,
            (k + ring) % 3 ? PALETTE.iceBasalt : PALETTE.iceBasaltDk,
            0, a * 0.3 + k, 0, 6);`);
rep(`      M.cyl(x, iceSEA_Y + h + 0.09, z, PITCH * 0.48, 0.18,
            (k % 2) ? PALETTE.iceMoraineDk : PALETTE.iceBasalt,
            0.06 * Math.sin(k * 1.7), a, 0.06 * Math.cos(k * 1.3), 6);`,
`      T.cyl(x, iceSEA_Y + h + 0.09, z, PITCH * 0.48, 0.18,
            (k % 2) ? PALETTE.iceMoraineDk : PALETTE.iceBasalt,
            0.06 * Math.sin(k * 1.7), a, 0.06 * Math.cos(k * 1.3), 6);`);
rep(`  const m = new THREE.Mesh(M.build(), iceVC());
  m.name = 'iceColumns';
  m.castShadow = true; m.receiveShadow = true;
  root.add(m);
}`,
`  const m = new THREE.Mesh(M.build(), iceVC());
  m.name = 'iceColumns';
  m.castShadow = true; m.receiveShadow = true;
  root.add(m);
  if (!MN.empty()) {
    const mn = new THREE.Mesh(MN.build(), iceVC());
    mn.name = 'iceColumnsBack';
    mn.castShadow = false;
    mn.userData.noShadow = true;
    mn.receiveShadow = true;
    root.add(mn);
  }
}`);

// ---- gravel does not cast ------------------------------------------------
rep(`      const s = 0.45 + ((k * 7 + c) % 6) * 0.28;
      icePush9(erratic, x, y + s * 0.30, z, (k % 4) * 0.22, k * 1.9, (c % 4) * 0.19,
               s, s * 0.68, s * 1.05);
      if (s > 1.0) SG.add(x, y + s * 0.30, z, s * 0.86, s * 0.68, s * 0.90, k * 1.9);`,
`      const s = 0.45 + ((k * 7 + c) % 6) * 0.28;
      // A BOULDER CASTS AND GRAVEL DOES NOT. Every stone on the moraine went
      // into one casting batch, so a 45 cm pebble under a sun eight degrees up
      // was drawn twice to lay a smear on the shingle beside it. The ones the
      // animal has to walk round cast; the ones it walks over do not, and it
      // is the same line as the one that decides which of them are solid.
      icePush9(s > 1.0 ? erratic : rubble, x, y + s * 0.30, z,
               (k % 4) * 0.22, k * 1.9, (c % 4) * 0.19, s, s * 0.68, s * 1.05);
      if (s > 1.0) SG.add(x, y + s * 0.30, z, s * 0.86, s * 0.68, s * 0.90, k * 1.9);`);
fs.writeFileSync('src/iceland.js', s); console.log('ok');
