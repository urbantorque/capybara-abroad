import fs from 'fs';
let s = fs.readFileSync('src/sahara.js', 'utf8');
const block = fs.readFileSync('qa/_ed/sah6.txt', 'utf8');
function rep(a,b){const n=s.split(a).length-1;if(n!==1){console.error('FAIL('+n+'): '+a.slice(0,60));process.exit(1)}s=s.replace(a,()=>b)}
rep('// ============================================================ THE PALMERAIE ==', block + '\n// ============================================================ THE PALMERAIE ==');
rep('  sahBuildKsar(game, sahRoot);', '  sahBuildKsar(game, sahRoot);\n  sahBuildTrades(game, sahRoot);');
// ---- and a head does not cast its own shadow onto its own shoulders ------
rep(`  const headGeo = H.build();`,
`  const headGeo = H.build();`);
fs.writeFileSync('src/sahara.js', s); console.log('ok');
