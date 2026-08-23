import fs from 'fs';
let s = fs.readFileSync('src/iceland.js', 'utf8');
function rep(a,b){const n=s.split(a).length-1;if(n!==1){console.error('FAIL('+n+'): '+a.slice(0,60));process.exit(1)}s=s.replace(a,()=>b)}
rep(`iceScatClumps(band, 11, [18, 38], 5.4, 'lava'`, `iceScatClumps(band, 8, [18, 36], 5.4, 'lava'`);
rep(`iceScatClumps(band, 56, [3, 10], 8.5, 'lava'`, `iceScatClumps(band, 50, [3, 9], 8.5, 'lava'`);
rep(`iceScatClumps(band, 26, [4, 11], 6.5, 'geo'`, `iceScatClumps(band, 22, [4, 10], 6.5, 'geo'`);
rep(`iceScatClumps(band, 24, [3, 8], 9.5, 'moraine'`, `iceScatClumps(band, 20, [3, 7], 9.5, 'moraine'`);
fs.writeFileSync('src/iceland.js', s); console.log('ok');
