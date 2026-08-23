import fs from 'fs';
let s = fs.readFileSync('src/quay.js', 'utf8');
const block = fs.readFileSync('qa/_ed/quay1.txt', 'utf8');
function rep(a,b){const n=s.split(a).length-1;if(n!==1){console.error('FAIL('+n+'): '+a.slice(0,60));process.exit(1)}s=s.replace(a,()=>b)}
rep('function quayBuildShores(game, root) {', block + '\nfunction quayBuildShores(game, root) {');
rep('  quayBuildShores(game, quayRoot);',
    '  quayBuildShores(game, quayRoot);\n  quayBuildBush(quayRoot);\n  quayBuildApronDress(game, quayRoot);');
// cast === false has to survive registerShadowTarget here too
rep(`  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  im.castShadow = !!cast;
  im.receiveShadow = !!recv;`,
`  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  im.castShadow = !!cast;
  im.receiveShadow = !!recv;
  // registerShadowTarget answers with traverse(n => { if (n.isMesh) castShadow
  // = true }) and an InstancedMesh extends Mesh, so every \`false\` in this file
  // has been getting \`true\` four lines later since the chapter shipped. The
  // flag is the honest channel; quayNoShadow reads it.
  if (!cast) im.userData.noShadow = true;`);
fs.writeFileSync('src/quay.js', s); console.log('ok');
