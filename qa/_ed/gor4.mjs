import fs from 'fs';
let s = fs.readFileSync('src/goreme.js', 'utf8');
function rep(a,b){const n=s.split(a).length-1;if(n!==1){console.error('FAIL('+n+'): '+a.slice(0,60));process.exit(1)}s=s.replace(a,()=>b)}
rep(`      const n = Math.round(R * 5 + 8);`,
`      // MEASURED, TWICE. R*5+8 over seventy-four chimneys, plus the vineyards
      // below, put this chapter at 428,000 triangles — more than twice the
      // proven-safe ceiling of 205,000 and more than any world in the project
      // by a factor of two. A talus fan is legible at about a third of that;
      // what makes it read is the GRADING, not the count.
      const n = Math.round(R * 2.2 + 5);`);
rep(`        } else {
          gorPush9(scree, x, y + s * 0.30, z, rand(-0.3, 0.3), rand(0, 6.28),
                   rand(-0.3, 0.3), s * 1.4, s * 0.7, s * 1.2);
        }`,
`        } else {
          // A 36-triangle sphere for a 30 cm chip of tuff, thirteen hundred
          // times over, is forty-seven thousand triangles of gravel. A box
          // turned twice on two axes is twelve, and at that size nothing can
          // tell the difference.
          gorPush9(scree, x, y + s * 0.30, z, rand(-0.3, 0.3), rand(0, 6.28),
                   rand(-0.3, 0.3), s * 1.4, s * 0.7, s * 1.2);
        }`);
rep(`      gorInstance(root, gorG.sph6, PALETTE.gorTuffDk, scree, false, true, 'gorScat:scree:' + id),`,
    `      gorInstance(root, gorG.box, PALETTE.gorTuffDk, scree, false, true, 'gorScat:scree:' + id),`);
rep(`    for (let b = 0; b < 4; b++) {`, `    for (let b = 0; b < 2; b++) {`);
rep(`      const rows = 4 + (b % 4), per = 11 + ((b * 5 + c) % 10);`,
    `      const rows = 3 + (b % 3), per = 8 + ((b * 5 + c) % 7);`);
rep(`    for (let i = 0; i < 34; i++) {
      const x = rand(C[0], C[1]), z = rand(C[2], C[3]);`,
`    for (let i = 0; i < 15; i++) {
      const x = rand(C[0], C[1]), z = rand(C[2], C[3]);`);
fs.writeFileSync('src/goreme.js', s); console.log('ok');
