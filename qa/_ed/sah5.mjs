import fs from 'fs';
let s = fs.readFileSync('src/sahara.js', 'utf8');
const block = fs.readFileSync('qa/_ed/sah4.txt', 'utf8');
function rep(a,b){const n=s.split(a).length-1;if(n!==1){console.error('FAIL('+n+'): '+a.slice(0,60));process.exit(1)}s=s.replace(a,()=>b)}
rep('// ================================================================= VARIETY ==', block + '\n// ================================================================= VARIETY ==');
rep('  sahBuildVariety(game, sahRoot);',
    '  sahBuildVariety(game, sahRoot);\n  sahBuildSeguia(game, sahRoot);\n  sahBuildKsar(game, sahRoot);');
fs.writeFileSync('src/sahara.js', s); console.log('ok');
