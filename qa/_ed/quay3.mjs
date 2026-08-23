import fs from 'fs';
let s = fs.readFileSync('src/quay.js', 'utf8');
function rep(a,b){const n=s.split(a).length-1;if(n!==1){console.error('FAIL('+n+'): '+a.slice(0,60));process.exit(1)}s=s.replace(a,()=>b)}
rep(`  // registerShadowTarget answers with traverse(n => { if (n.isMesh) castShadow
  // = true }) and an InstancedMesh extends Mesh, so every \`false\` in this file
  // has been getting \`true\` four lines later since the chapter shipped. The
  // flag is the honest channel; quayNoShadow reads it.
  if (!cast) im.userData.noShadow = true;`,
`  // This chapter only hands quayBoatGroup to registerShadowTarget, so unlike
  // the Drift, Iceland and the rest its \`false\` flags are actually honoured —
  // but the flag is stamped anyway, because the traverse is one line away in
  // every other biome in the project and a batch that carries its intent
  // survives being reparented.
  if (!cast) im.userData.noShadow = true;`);
fs.writeFileSync('src/quay.js', s); console.log('ok');
