import fs from 'fs';
let s = fs.readFileSync('src/iceland.js', 'utf8');
function rep(a,b){const n=s.split(a).length-1;if(n!==1){console.error('FAIL('+n+'): '+a.slice(0,60));process.exit(1)}s=s.replace(a,()=>b)}
rep(`      const s = 0.55 + ((k * 5 + c) % 7) * 0.16;
      icePush9(moss, x, y + s * 0.26, z, 0, (k + c) * 1.1, 0, s, s * 0.62, s * 0.92);`,
`      // ---- AND A SPHERE WITH FOUR RINGS IN IT HAS A FLAT TOP -------------
      // iceG.sph6 is SphereGeometry(0.5, 6, 4): six segments round and FOUR up,
      // so the cap is one big hexagon. Squash it to 0.62 of its height and what
      // this camera photographs is a green hexagonal plate lying in the grass —
      // which is the exact failure the cushions were drawn to avoid, arrived at
      // from the other direction. iceG.rock is a nudged icosahedron: twenty
      // triangles instead of thirty-six, no flat cap anywhere on it, and it is
      // already lumpy, which is what moss is.
      const s = 0.55 + ((k * 5 + c) % 7) * 0.16;
      icePush9(moss, x, y + s * 0.30, z, (k % 3) * 0.12, (k + c) * 1.1, (c % 3) * 0.1,
               s, s * 0.78, s * 0.94);`);
rep(`    mkBatch(iceG.sph6, PALETTE.iceMoss, moss, false, true, 'iceScat:moss:' + id);`,
    `    mkBatch(iceG.rock, PALETTE.iceMoss, moss, false, true, 'iceScat:moss:' + id);`);
rep(`    iceScatClumps(band, 30, [3, 8], 7.5, 'lava', (x, y, z, k, c) => {`,
    `    iceScatClumps(band, 46, [3, 9], 8.5, 'lava', (x, y, z, k, c) => {`);
rep(`    iceScatClumps(band, 24, [4, 10], 7.0, 'town', (x, y, z, k, c) => {`,
    `    iceScatClumps(band, 32, [4, 10], 7.5, 'town', (x, y, z, k, c) => {`);
fs.writeFileSync('src/iceland.js', s); console.log('ok');
