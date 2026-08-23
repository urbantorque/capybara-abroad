import fs from 'fs';
let s = fs.readFileSync('src/iceland.js', 'utf8');
function rep(a,b){const n=s.split(a).length-1;if(n!==1){console.error('FAIL('+n+'): '+a.slice(0,60));process.exit(1)}s=s.replace(a,()=>b)}
rep(`    iceScatClumps(band, 6, [16, 34], 5.0, 'lava', (x, y, z, k, c) => {`,
    `    iceScatClumps(band, 11, [18, 38], 5.4, 'lava', (x, y, z, k, c) => {`);
rep(`    iceScatClumps(band, 46, [3, 9], 8.5, 'lava', (x, y, z, k, c) => {`,
    `    iceScatClumps(band, 56, [3, 10], 8.5, 'lava', (x, y, z, k, c) => {`);
rep(`    iceScatClumps(band, 20, [4, 10], 6.5, 'geo', (x, y, z, k, c) => {`,
    `    iceScatClumps(band, 26, [4, 11], 6.5, 'geo', (x, y, z, k, c) => {`);
rep(`    iceScatClumps(band, 18, [3, 7], 9.5, 'moraine', (x, y, z, k, c) => {`,
    `    iceScatClumps(band, 24, [3, 8], 9.5, 'moraine', (x, y, z, k, c) => {`);
fs.writeFileSync('src/iceland.js', s); console.log('ok');
