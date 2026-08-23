import fs from 'fs';
let s = fs.readFileSync('src/iceland.js', 'utf8');
const aud = fs.readFileSync('qa/_ed/ice-audio.txt', 'utf8');
function rep(a,b){const n=s.split(a).length-1;if(n!==1){console.error('FAIL('+n+'): '+a.slice(0,60));process.exit(1)}s=s.replace(a,()=>b)}

rep(`function iceUpdateGeyser(game, dt) {`, aud + `\nfunction iceUpdateGeyser(game, dt) {`);
rep(`      iceUpdateSheep(game, dt);`, `      iceUpdateSheep(game, dt);\n      iceUpdateSound(game, dt);`);

// ---- and two more people, in the two places the chapter had nobody -------
rep(`      wheek: ['There is nothing up here to hear you but me.'] });
  }`,
`      wheek: ['There is nothing up here to hear you but me.'] });
    // ---- AND TWO MORE, WITH THE THINGS THAT ARE NEW ----------------------
    // The six above are all inside forty metres of the town or standing at a
    // set piece. The two hundred metres between the last house and the moraine
    // — the walk everybody makes twice — had nobody in it at all, which is the
    // half of this chapter's emptiness that is an oversight rather than the
    // point. One with the flock and one at the racks: both of them are the
    // reason the thing beside them exists.
    game.addLocal({ biome: 'iceland', x: iceFLOCKS[0].x + 9,
      y: iceTerrain(iceFLOCKS[0].x + 9, iceFLOCKS[0].z + 4), z: iceFLOCKS[0].z + 4, near: 9,
      figure: { shirt: PALETTE.iceHouse6, legs: PALETTE.iceMoraineDk, hat: PALETTE.iceRoofGrey },
      lines: ['Round-up is September. Until then they go where they like.',
              'There are more of them than us. There have always been more of them than us.',
              'Do not walk at them. Walk past them and they will come to you.',
              'The cairns take you to the ice. Follow them, do not follow the ground.'],
      wheek: ['Now look what you have done.',
              'They will be halfway to the lagoon by morning. Thank you.'] });
    game.addLocal({ biome: 'iceland', x: iceRACK[0][0] - 4,
      y: iceTerrain(iceRACK[0][0] - 4, iceRACK[0][1] - 3), z: iceRACK[0][1] - 3, near: 8,
      figure: { shirt: PALETTE.iceHull, legs: PALETTE.iceBasaltDk },
      lines: ['Six weeks in the wind and it will keep for three years.',
              'You can smell it from the church. That is how you know it is working.',
              'No, you cannot have one.',
              'That rock out there is the oldest thing you will see today.'],
      wheek: ['Everything on this shore heard that.',
              'The birds will be up. Go and watch, it is worth it.'] });
  }`);
fs.writeFileSync('src/iceland.js', s); console.log('ok');
