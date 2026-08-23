import fs from 'fs';
let s = fs.readFileSync('src/iceland.js', 'utf8');
function rep(a,b){const n=s.split(a).length-1;if(n!==1){console.error('FAIL('+n+'): '+a.slice(0,60));process.exit(1)}s=s.replace(a,()=>b)}
rep(`  for (let i = 0; i < 200; i++) {
    const x = rand(-180, 180), z = rand(-60, 130);
    const y = iceTerrain(x, z);
    if (y < 0.1 || iceGroundSlip(x, z) > 0.05) continue;
    icePush9(moss, x, y + 0.16, z, 0, rand(0, 6.28), 0, rand(1.4, 3.6), 0.32, rand(1.4, 3.6));
  }`,
`  // ---- AND THESE WERE TWO HUNDRED GREEN PLAYING CARDS --------------------
  // rand(1.4, 3.6) wide by 0.32 tall on iceG.cyl6 is a hexagonal PLATE up to
  // three and a half metres across lying flat on the ground, under a camera
  // that looks down about 0.7 rad. It is the most repeated mistake in this
  // codebase — Manly's rock pools, the Pantanal's lily rims, the cave's moss
  // discs, the Antarctic sastrugi, the Drift's ferns — and it has been sitting
  // in the one green thing in Iceland since the chapter shipped.
  //
  // Woolly fringe moss grows in DOMES the size of a football that merge into a
  // mattress of them. Same count, same draw call, a third the width, and
  // drawn on iceG.rock, which has no flat cap on it anywhere.
  for (let i = 0; i < 200; i++) {
    const x = rand(-180, 180), z = rand(-60, 130);
    const y = iceTerrain(x, z);
    if (y < 0.1 || iceGroundSlip(x, z) > 0.05) continue;
    const s2 = rand(0.6, 1.5);
    icePush9(moss, x, y + s2 * 0.30, z, rand(0, 0.3), rand(0, 6.28), rand(0, 0.3),
             s2, s2 * 0.78, s2 * 0.95);
  }`);
rep(`  iceInstance(root, iceG.cyl6, PALETTE.iceMoss, moss, false, true);`,
    `  iceInstance(root, iceG.rock, PALETTE.iceMoss, moss, false, true);`);
fs.writeFileSync('src/iceland.js', s); console.log('ok');
