import fs from 'fs';
let q = fs.readFileSync('src/quay.js', 'utf8');
function rq(a,b){const n=q.split(a).length-1;if(n!==1){console.error('FAILQ('+n+'): '+a.slice(0,60));process.exit(1)}q=q.replace(a,()=>b)}
rq(`    const n = Math.round(H.r * H.r * (exposed ? 0.055 : 0.085));`,
`    // 0.085 measured out at 235,000 triangles for the chapter, thirty
    // thousand over the proven-safe ceiling of 205,000. A headland's area goes
    // as r², so North Head alone (r = 78) was carrying three hundred and
    // thirty-five trees; the number that matters is the CANOPY, and a canopy
    // closes well before it is a plantation.
    const n = Math.round(H.r * H.r * (exposed ? 0.036 : 0.058));`);
fs.writeFileSync('src/quay.js', q);

let p = fs.readFileSync('src/props.js', 'utf8');
function rp(a,b){const n=p.split(a).length-1;if(n!==1){console.error('FAILP('+n+'): '+a.slice(0,60));process.exit(1)}p=p.replace(a,()=>b)}
rp(`  quay:      { x: 4, z: 26, r0: 4, r1: 18, props: [['bin', 1], ['cone', 2], ['sign', 1], ['esky', 1], ['basket', 1]] },`,
`  // SIX GRABBABLE PROPS OVER EIGHTY THOUSAND SQUARE METRES — the lowest
  // absolute count in the game, on the apron of the busiest ferry terminal in
  // the southern hemisphere. Four more, and they are all the same four things:
  // what a person waiting for a boat is carrying and puts down. The chips are
  // not decoration — quayBuildApronGulls has a flock standing on this paving
  // and quayBurstChips is already written; a dropped packet is what it is for.
  quay:      { x: 4, z: 26, r0: 4, r1: 20,
               props: [['bin', 1], ['cone', 2], ['sign', 1], ['esky', 1], ['basket', 1],
                       ['coffee', 1], ['camera', 1], ['handbag', 1], ['chips', 1]] },`);
fs.writeFileSync('src/props.js', p);
console.log('ok');
