import fs from 'fs';
let s = fs.readFileSync('src/drift.js', 'utf8');
function rep(a, b) {
  const n = s.split(a).length - 1;
  if (n !== 1) { console.error('FAIL(' + n + '): ' + a.slice(0, 70)); process.exit(1); }
  s = s.replace(a, () => b);
}

rep(`    const n = Math.round(s.hx * s.hz * (bare ? 0.55 : 1.5));`,
`    const n = Math.round(s.hx * s.hz * (bare ? 0.9 : 2.6));`);

// ---- the columns are landmarks and were marked by nothing --------------
rep(`/**
 * SOMEBODY FARMED UP HERE.`,
`/**
 * A COLUMN IS THE ONLY LIFT IN THE CHAPTER THAT IS NOT A JUMP, AND YOU COULD
 * NOT SEE ONE.
 *
 * Three shafts of rising air, eight metres across and up to a hundred and
 * twenty-eight tall. They are the way up from the Anvil, the way up to the
 * Crown, and — because their bases sit just over the cloud — the way BACK from
 * anywhere you fall, which makes them the single most important navigational
 * fact in the biome. What marked them was a scatter of motes inside the shaft
 * and a few stones at the foot, neither of which reads from more than about
 * twenty metres, in a world where the distance between two places you can
 * stand is twenty-five.
 *
 * A ring of monoliths at the base, tallest on the side the route arrives from,
 * and above it a SPIRAL of the bigger stuff the column has picked up and never
 * managed to put down — climbing, thinning, and stopping at the shaft's top
 * where the lift tapers out. That last part is the one that matters: it draws
 * the height of the thing, which is the number the player actually needs.
 *
 * All of it is in the round: a monolith is three-dimensional and casts, the
 * spiral is forty metres up in the air over nothing and does not.
 */
function driBuildColumnMarks(game, root) {
  const M = driMerger();
  const spiral = [];
  for (let i = 0; i < driCOLS.length; i++) {
    const c = driCOLS[i];
    const ring = 9 + i;
    for (let k = 0; k < ring; k++) {
      const a = k / ring * 6.28318 + i * 0.7;
      // The base of a column sits at 0.4 — over the cloud, not over an island —
      // so the ring has to stand on the CLOUD, which is what makes it read from
      // above as a circle drawn on the sea.
      const rr = c.r * 1.45;
      const x = c.x + Math.cos(a) * rr, z = c.z + Math.sin(a) * rr;
      const h = 2.2 + Math.abs(Math.sin(a * 0.5 + i)) * 2.6;
      M.box(x, driCLOUD_Y + h * 0.5, z, 1.05, h, 0.85,
            k % 3 ? PALETTE.driRock : PALETTE.driRockDark,
            0.05 * Math.sin(a), a, 0.04 * Math.cos(a));
      M.oct(x, driCLOUD_Y + h + 0.3, z, 0.5, PALETTE.driStone, a * 0.3, a, 0.1);
      driAddBeacon(x, driCLOUD_Y + h + 0.75, z);
      driStaticBox(game, x, driCLOUD_Y + h * 0.5, z, 1.3, h, 1.1, a);
    }
    // the spiral. Two and a half turns from the ring to the top, thinning all
    // the way, so the shaft has a HEIGHT you can read off the sky.
    const turns = 2.5, nStone = 40;
    for (let k = 0; k < nStone; k++) {
      const u = k / (nStone - 1);
      const a = u * turns * 6.28318 + i * 1.3;
      const rr = c.r * (1.25 - u * 0.55);
      const sz = (1.5 - u * 1.05) * (0.7 + ((k * 7 + i) % 4) * 0.14);
      spiral.push(c.x + Math.cos(a) * rr, driCLOUD_Y + 5 + u * (c.top - 8),
                  c.z + Math.sin(a) * rr,
                  a, a * 0.7, a * 0.4, sz, sz * 0.8, sz * 0.9);
    }
  }
  const mesh = new THREE.Mesh(M.build(), driVC());
  mesh.name = 'dri:colmarks';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);
  // A plain mat(), never a vertexColors one: a bare driG.oct in a
  // vertexColors material renders BLACK — three feeds the shader a missing
  // attribute and it reads as zero.
  driInstance(root, driG.oct, mat(PALETTE.driRock), spiral, false, false);
}

/**
 * SOMEBODY FARMED UP HERE.`);
rep('  driBuildFarDressing(game, driRoot);',
    '  driBuildFarDressing(game, driRoot);\n  driBuildColumnMarks(game, driRoot);');

fs.writeFileSync('src/drift.js', s);
console.log('ok');
