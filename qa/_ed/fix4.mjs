import fs from 'fs';
let s = fs.readFileSync('src/drift.js', 'utf8');
function rep(a, b) { const n = s.split(a).length - 1; if (n !== 1) { console.error('FAIL(' + n + '): ' + a.slice(0,60)); process.exit(1) } s = s.replace(a, () => b) }

rep(`  // mat() returns a SHARED cached material. Clone before writing anything on it.
  driBankMat = mat(0xffffff, { vertexColors: true }).clone();
  driBankMat.transparent = true;
  driBankMat.opacity = 0.58;
  driBankMat.depthWrite = false;
  const m = new THREE.Mesh(M.build(), driBankMat);`,
`  // ---- AND A CLOUD IS NOT A WINDOW ---------------------------------------
  // First cut: one merged mesh of two hundred and eighty squashed spheres in a
  // transparent material with depthWrite off. Three sorts TRANSPARENCY PER
  // OBJECT, and this is one object, so forty-six banks and every sphere inside
  // every one of them are drawn in buffer order with no depth test between
  // them. Photographed from the Crown looking north over the whole
  // archipelago, that is not weather: it is half a dozen enormous washed-out
  // parallelograms lying across the frame, each one the far side of a bank
  // painted over the near side of it, with the islands showing through.
  //
  // A cumulus is opaque. It is the most opaque thing in the sky. Flat-shaded
  // and opaque it sorts itself for free, it reads as folded paper the way
  // everything else in this game does, and falling INTO one is then a thing
  // that happens rather than a thing you can see through.
  driBankMat = driVC();
  const m = new THREE.Mesh(M.build(), driBankMat);`);
rep(`  m.renderOrder = -1;                        // behind the motes and the wisps
  m.frustumCulled = false;`, `  m.frustumCulled = false;`);
rep(`  if (driBankMat) {
    const spd = Math.hypot(driWindX, driWindZ) / driWIND_MAX;
    driBankMat.opacity = 0.62 - spd * 0.14;
  }`,
`  // The banks used to thin and thicken with the breath, which was an opacity
  // animation on a shared material — and driVC() hands back a cached one, so
  // writing on it would have taken the islands, the walls, the camps and the
  // far dressing with it. The wind is legible in the seed-fluff, the pennants
  // and the vane; the sky does not have to say it a fourth time.`);

// the horizon lamps bloom into squares at 26-at-once; smaller and warmer
rep(`    E.cyl(lx, y + 3.45, lz, 0.27, 0.36, PALETTE.driLampGlow, 0, 0, 0, 6);`,
`    // driLampGlow (0xffe9c2) is a hair off white and the composite runs a box
    // bloom: twenty-six of these coming up at once photographed as twenty-six
    // hard-edged glowing SQUARES, which is the kernel and not the lamp. Half
    // the emitter and the warmer of the two lamp colours.
    E.cyl(lx, y + 3.45, lz, 0.15, 0.22, PALETTE.driLamp, 0, 0, 0, 6);`);
rep(`  driFarLampMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true,
                                                opacity: 0.0 });`,
`  driFarLampMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true,
                                                depthWrite: false, opacity: 0.0 });`);
rep(`  driFarLampMat.opacity = damp(driFarLampMat.opacity, 0.35 + k * 0.55, 3.0, dt);`,
`  driFarLampMat.opacity = damp(driFarLampMat.opacity, 0.30 + k * 0.38, 3.0, dt);`);
rep(`        if (driFarLampMat) driFarLampMat.opacity = 0.90;`,
`        if (driFarLampMat) driFarLampMat.opacity = 0.68;`);

fs.writeFileSync('src/drift.js', s); console.log('ok');
