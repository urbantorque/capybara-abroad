import fs from 'fs';
let s = fs.readFileSync('src/iceland.js', 'utf8');
function rep(a,b){const n=s.split(a).length-1;if(n!==1){console.error('FAIL('+n+'): '+a.slice(0,60));process.exit(1)}s=s.replace(a,()=>b)}
rep(`function iceNoShadowOnGhosts(root) {
  root.traverse(function (n) {
    if (!n.isMesh && !n.isInstancedMesh) return;
    const m = Array.isArray(n.material) ? n.material[0] : n.material;
    if (!m) return;`,
`/**
 * THE TRAVERSE THAT UNDOES EVERY castShadow = false IN THIS FILE, AND THE ONE
 * CASE IT COULD NOT SEE.
 *
 * registerShadowTarget answers with traverse(n => { if (n.isMesh) n.castShadow
 * = true }), so every false above is silently reverted; this puts it back. But
 * it only recognised GHOSTS — transparent, additive, depth-write-off — which
 * covers the aurora, the steam and the light pools and covers nothing else.
 *
 * An OPAQUE mesh authored castShadow = false sailed through both. Measured:
 * the puffin colony, 27,600 triangles and the largest single object in the
 * chapter, said false and cast anyway. So did every instanced batch in
 * iceBuildFlora that said false. userData.noShadow is the honest channel and
 * the material sniff is the fallback.
 */
function iceNoShadowOnGhosts(root) {
  root.traverse(function (n) {
    if (!n.isMesh && !n.isInstancedMesh) return;
    if (n.userData && n.userData.noShadow) { n.castShadow = false; return; }
    const m = Array.isArray(n.material) ? n.material[0] : n.material;
    if (!m) return;`);
rep(`  im.castShadow = false;
  im.receiveShadow = true;
  im.frustumCulled = false;
  root.add(im);
  icePuffinMesh = im;`,
`  im.castShadow = false;
  im.userData.noShadow = true;
  im.receiveShadow = true;
  im.frustumCulled = false;
  root.add(im);
  icePuffinMesh = im;`);
fs.writeFileSync('src/iceland.js', s); console.log('ok');
