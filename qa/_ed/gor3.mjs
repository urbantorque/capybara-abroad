import fs from 'fs';
let s = fs.readFileSync('src/goreme.js', 'utf8');
function rep(a,b){const n=s.split(a).length-1;if(n!==1){console.error('FAIL('+n+'): '+a.slice(0,60));process.exit(1)}s=s.replace(a,()=>b)}
rep('  gorBuildTown(game, gorRoot);', '  gorBuildTown(game, gorRoot);\n  gorBuildScatter(game, gorRoot);');
rep(`  // gorNoShadowOnGhosts only recognises TRANSPARENT materials, and every batch
  // below is opaque — so without this flag the traverse behind
  // registerShadowTarget puts castShadow back on all of it.
  if (!cast) im.userData.noShadow = true;`,
`  // registerShadowTarget answers with traverse(n => { if (n.isMesh) castShadow
  // = true }) and an InstancedMesh extends Mesh, so a bare \`false\` would be
  // reverted four lines later. This chapter's gorNoShadowOnGhosts already reads
  // userData.noShadow — it is one of the two in the project that does — so the
  // flag is all that is needed.
  if (!cast) im.userData.noShadow = true;`);
fs.writeFileSync('src/goreme.js', s); console.log('ok');
