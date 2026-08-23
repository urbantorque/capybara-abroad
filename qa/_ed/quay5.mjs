import fs from 'fs';
let s = fs.readFileSync('src/quay.js', 'utf8');
const block = fs.readFileSync('qa/_ed/quay-cockatoo.txt', 'utf8');
function rep(a,b){const n=s.split(a).length-1;if(n!==1){console.error('FAIL('+n+'): '+a.slice(0,60));process.exit(1)}s=s.replace(a,()=>b)}
rep('function quayBuildBush(root) {', block + '\nfunction quayBuildBush(root) {');
rep('  quayBuildBush(quayRoot);', '  quayBuildBush(quayRoot);\n  quayBuildCockatoos(quayRoot);');
rep(`      quayUpdateGulls(dt);
      quayUpdateApronGulls(game, dt);`,
`      quayUpdateGulls(dt);
      quayUpdateCockatoos(game, dt);
      quayUpdateSound(game, dt);
      quayUpdateApronGulls(game, dt);`);
fs.writeFileSync('src/quay.js', s); console.log('ok');
