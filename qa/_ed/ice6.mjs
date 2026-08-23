import fs from 'fs';
let s = fs.readFileSync('src/iceland.js', 'utf8');
function rep(a,b){const n=s.split(a).length-1;if(n!==1){console.error('FAIL('+n+'): '+a.slice(0,60));process.exit(1)}s=s.replace(a,()=>b)}

// ---- MANY SMALL CLUMPS, NOT A FEW BIG ONES ------------------------------
rep(`function iceBuildScatter(game, root) {
  iceScatMeshes = [];`,
`function iceBuildScatter(game, root) {
  iceScatMeshes = [];
  // Everything in this pass that is taller than about a metre is SOLID, and
  // it is all one body: iceStaticGroup exists because this chapter was already
  // two bodies over a hard budget of 130 when it shipped. An erratic you can
  // walk through is a walk-through hit in qa/audit-solid.js and, worse, it is
  // the only object on the moraine that reads as an obstacle.
  const SG = iceStaticGroup(game);`);
rep(`    mkBatch(iceG.rock, PALETTE.iceMoraine, erratic, true, true, 'iceScat:erratic:' + id);`,
    `    mkBatch(iceG.rock, PALETTE.iceMoraine, erratic, true, true, 'iceScat:erratic:' + id);`);
rep(`  }
}

function iceBuildFlora(game_, root) {`,
`  }
  SG.done();
}

function iceBuildFlora(game_, root) {`);

// erratics: smaller, and the big ones are solid
rep(`    iceScatClumps(band, 30, [4, 10], 8.0, 'moraine', (x, y, z, k, c) => {
      const s = 0.7 + ((k * 7 + c) % 6) * 0.55;
      icePush9(erratic, x, y + s * 0.30, z, (k % 4) * 0.22, k * 1.9, (c % 4) * 0.19,
               s, s * 0.68, s * 1.05);
    });`,
`    iceScatClumps(band, 64, [3, 7], 9.5, 'moraine', (x, y, z, k, c) => {
      // 0.7 to 3.45 m put four-metre boulders all along the one bank the player
      // walks up to the glacier, and every one of them was walk-through.
      // Erratics come in every size; the ones over a metre are furniture and
      // are solid, and the rest are gravel.
      const s = 0.45 + ((k * 7 + c) % 6) * 0.28;
      icePush9(erratic, x, y + s * 0.30, z, (k % 4) * 0.22, k * 1.9, (c % 4) * 0.19,
               s, s * 0.68, s * 1.05);
      if (s > 1.0) SG.add(x, y + s * 0.30, z, s * 0.86, s * 0.68, s * 0.90, k * 1.9);
    });`);
rep(`            const h = 1.1 + ((c * 5) % 4) * 0.35;
            icePush9(post, x, y + h * 0.5, z, 0.04 * ((c % 3) - 1), c * 0.9, 0.03, 0.13, h, 0.13);`,
`            const h = 1.1 + ((c * 5) % 4) * 0.35;
            icePush9(post, x, y + h * 0.5, z, 0.04 * ((c % 3) - 1), c * 0.9, 0.03, 0.13, h, 0.13);
            SG.add(x, y + h * 0.5, z, 0.34, h, 0.34, 0);`);

// ---- and the clumps have to TILE the ground, not dot it ------------------
rep(`    iceScatClumps(band, 40, [10, 22], 6.0, 'lava', (x, y, z, k, c) => {`,
`    // MANY SMALL CLUMPS RATHER THAN A FEW BIG ONES. Measured off the render
    // standing in the middle of the lava field: forty clumps of up to twenty-two
    // over a fifty-metre band is six dense islands and forty metres of bare
    // green between them, and the frame is an empty plane with some scenery in
    // the top corner. Three times as many clumps of a third the size covers the
    // same budget and covers the GROUND.
    iceScatClumps(band, 130, [3, 8], 7.5, 'lava', (x, y, z, k, c) => {`);
rep(`    iceScatClumps(band, 22, [18, 38], 4.6, 'lava', (x, y, z, k, c) => {`,
`    // The lupins are the exception and stay clumped: they really do grow in
    // stands with clear ground between them, and a stand is the whole picture.
    iceScatClumps(band, 26, [16, 34], 5.0, 'lava', (x, y, z, k, c) => {`);
rep(`    iceScatClumps(band, 34, [10, 22], 5.2, 'town', (x, y, z, k, c) => {`,
    `    iceScatClumps(band, 96, [4, 10], 7.0, 'town', (x, y, z, k, c) => {`);
rep(`    iceScatClumps(band, 32, [8, 18], 5.0, 'geo', (x, y, z, k, c) => {`,
    `    iceScatClumps(band, 78, [4, 10], 6.5, 'geo', (x, y, z, k, c) => {`);
rep(`    iceScatClumps(band, 26, [6, 14], 8.0, 'ice', (x, y, z, k, c) => {`,
    `    iceScatClumps(band, 54, [4, 9], 9.0, 'ice', (x, y, z, k, c) => {`);
fs.writeFileSync('src/iceland.js', s); console.log('ok');
