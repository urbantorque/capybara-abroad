import fs from 'fs';
let s = fs.readFileSync('src/sahara.js', 'utf8');
function rep(a,b){const n=s.split(a).length-1;if(n!==1){console.error('FAIL('+n+'): '+a.slice(0,60));process.exit(1)}s=s.replace(a,()=>b)}
rep(`  // DOUBLE-SIDED, because a quad has one face and half the grove is seen from
  // underneath. Three flips the normal for back faces in the fragment shader,
  // so the lighting is right on both without a second draw call.
  sahInstance(root, sahG.quad, PALETTE.sahPalm, fronds, true, false,
              { side: THREE.DoubleSide });`,
`  // DOUBLE-SIDED, because a quad has one face and half the grove is seen from
  // underneath. Three flips the normal for back faces in the fragment shader,
  // so the lighting is right on both without a second draw call.
  //
  // ---- AND THE FRONDS DO NOT CAST ---------------------------------------
  // Four thousand three hundred and twenty quads, all flagged castShadow, is
  // 8,640 triangles drawn twice in the chapter with the highest casting
  // proportion in the game — and what it BUYS, photographed standing in the
  // grove, is not dappled shade. The shadow map cannot resolve a 40 cm frond
  // at this range, so every palm lays a two-metre black STARFISH on the sand
  // and thirty of them overlapping is a dark blotchy mess that reads as damage
  // to the picture rather than as shade.
  //
  // The trunks and the leaf-base crowns above still cast, which gives each
  // palm the disc of shade it should have and gives the grove its shadow
  // without any of the noise.
  const fm2 = sahInstance(root, sahG.quad, PALETTE.sahPalm, fronds, false, false,
                          { side: THREE.DoubleSide });
  if (fm2) { fm2.name = 'sahFronds'; fm2.userData.noShadow = true; }`);
// the two families that were painted in sand tones on sand
rep(`    B(sahG.box, PALETTE.sahPalmDry, thorn, false, false, 'sahVar:thorn');
    B(sahG.box, PALETTE.sahSandDeep, thornDk, false, false, 'sahVar:thornDk');`,
`    // WATCH THE ALBEDO CEILING. This chapter runs the brightest ambient in the
    // game under a sun very nearly overhead, and measured off the rendered
    // frame of the hamada the ground comes back close to white. sahPalmDry
    // (0xa89a5f) and sahGravel (0xc4a882) are both sand tones ON sand: a thorn
    // bush painted in them is a thing you cannot see, which is the Antarctic
    // guano stain and the black beach for the third time. A dead thorn is
    // nearly black anyway, and so is the lag left in a scoured hollow.
    B(sahG.box, PALETTE.sahCedarDk, thorn, false, false, 'sahVar:thorn');
    B(sahG.box, PALETTE.sahStormDeep, thornDk, false, false, 'sahVar:thornDk');`);
rep(`    B(sahG.quad, PALETTE.sahGravel, lag, false, true, 'sahVar:lag');`,
    `    B(sahG.quad, PALETTE.sahSandShade, lag, false, true, 'sahVar:lag');`);
fs.writeFileSync('src/sahara.js', s); console.log('ok');
