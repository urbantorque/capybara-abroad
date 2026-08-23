import fs from 'fs';
let s = fs.readFileSync('src/iceland.js', 'utf8');
function rep(a, b) { const n = s.split(a).length - 1; if (n !== 1) { console.error('FAIL(' + n + '): ' + a.slice(0,70)); process.exit(1) } s = s.replace(a, () => b) }

rep(`  im.castShadow = true;
  im.frustumCulled = false;
  root.add(im);
  icePuffinMesh = im;
  icePuffinSync();`,
`  // ---- AND A PUFFIN DOES NOT CAST A SHADOW --------------------------------
  // Measured: 150 birds at 184 triangles apiece is 27,600 triangles — 23 % of
  // the whole chapter, and the single largest object in it — and every one of
  // them was flagged castShadow, so the shadow pass drew all of it a second
  // time. A puffin is 25 cm long, it is on a vertical basalt face over the sea
  // or on the grass above it, and this chapter is lit by a sun that never comes
  // up: there is no frame in the game in which any of those shadows is a pixel.
  //
  // It was a quarter of the shadow budget of the world that flags the highest
  // proportion of its geometry as casting (84 %) and has the least scatter of
  // any chapter in the project by a factor of six. This one flag paid for the
  // whole of iceBuildScatter below.
  im.castShadow = false;
  im.receiveShadow = true;
  im.frustumCulled = false;
  root.add(im);
  icePuffinMesh = im;
  icePuffinSync();`);
fs.writeFileSync('src/iceland.js', s); console.log('ok');
