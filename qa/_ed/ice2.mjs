import fs from 'fs';
let s = fs.readFileSync('src/iceland.js', 'utf8');
const block = fs.readFileSync('qa/_ed/ice2.txt', 'utf8');
function rep(a, b) { const n = s.split(a).length - 1; if (n !== 1) { console.error('FAIL(' + n + '): ' + a.slice(0,70)); process.exit(1) } s = s.replace(a, () => b) }

// a flat quad, for the one thing this chapter had no geometry for: a blade
rep(`  iceG.rock = new THREE.IcosahedronGeometry(0.5, 0);`,
`  // A FLAT QUAD LYING IN XZ. A blade of grass seen from above and below and
  // never from the side is 2 triangles, not 12 — the same argument as the
  // Sahara's sand ripples and the Drift's ferns. It is scaled and PITCHED UP
  // by its instance: a quad left near horizontal under this camera is a card.
  iceG.quad = new THREE.PlaneGeometry(1, 1);
  iceG.quad.rotateX(-Math.PI / 2);
  iceG.rock = new THREE.IcosahedronGeometry(0.5, 0);`);
rep(`const iceG = { box: null, cyl6: null, cyl8: null, cyl4: null, cone6: null, cone4: null, sph6: null, tet: null, cyl16: null, disc: null, rock: null };`,
`const iceG = { box: null, cyl6: null, cyl8: null, cyl4: null, cone6: null, cone4: null, sph6: null, tet: null, cyl16: null, disc: null, rock: null, quad: null };`);

// iceInstance gains a double-sided option, and honours cast === false
rep(`function iceInstance(root, geo, color, list, cast, recv) {
  const n = list.length / 9;
  if (n < 1) return null;
  const im = new THREE.InstancedMesh(geo, mat(color), n);`,
`function iceInstance(root, geo, color, list, cast, recv, twoSided) {
  const n = list.length / 9;
  if (n < 1) return null;
  // DOUBLE-SIDED: a blade is a quad and half a field of them is seen from the
  // far side. Three flips the normal for back faces in the fragment shader, so
  // it lights correctly both ways for no second draw call.
  const im = new THREE.InstancedMesh(geo, twoSided ? mat(color, { side: THREE.DoubleSide }) : mat(color), n);`);
rep(`  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  im.castShadow = !!cast;
  im.receiveShadow = !!recv;
  root.add(im);
  return im;
}
/** Full extents in, half extents to CANNON — one convention per file. */`,
`  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  im.castShadow = !!cast;
  im.receiveShadow = !!recv;
  // ---- AND \`cast === false\` HAS TO SURVIVE THE TRAVERSE --------------------
  // registerShadowTarget answers with traverse(n => { if (n.isMesh) castShadow
  // = true }), and an InstancedMesh extends Mesh. Every batch in this file that
  // says false has been getting true four lines later since the chapter
  // shipped — which in a world about to carry four thousand pieces of moss is
  // the difference between a scatter pass that is free and one that doubles the
  // shadow budget. iceNoShadowOnGhosts reads this flag.
  if (!cast) im.userData.noShadow = true;
  root.add(im);
  return im;
}
/** Full extents in, half extents to CANNON — one convention per file. */`);

// the block itself, in front of iceBuildFlora
rep(`function iceBuildFlora(game_, root) {`, block + `\nfunction iceBuildFlora(game_, root) {`);

fs.writeFileSync('src/iceland.js', s);
console.log('ok');
