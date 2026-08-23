import fs from 'fs';
let s = fs.readFileSync('src/goreme.js', 'utf8');
const block = fs.readFileSync('qa/_ed/gor1.txt', 'utf8');
function rep(a,b){const n=s.split(a).length-1;if(n!==1){console.error('FAIL('+n+'): '+a.slice(0,60));process.exit(1)}s=s.replace(a,()=>b)}
// record where the chimneys actually went, so the talus can be put at their feet
rep(`const gorCHIM_N = 74;`,
`const gorCHIM_N = 74;
// WHERE THE CHIMNEYS ACTUALLY WENT. They are placed by a seeded random walk
// inside gorBuildValley and, until now, nothing outside that function could
// ever know where any of them was — which is why the valley floor between them
// was bare. x, z, base radius, three floats each. See gorBuildScatter.
const gorCHIM_POS = [];`);
rep(`      gorPoolBox(pool(cz), cx, g + h * 0.5, cz, rb * 1.5, h, rb * 1.5);
    }
  }`,
`      gorPoolBox(pool(cz), cx, g + h * 0.5, cz, rb * 1.5, h, rb * 1.5);
    }
    gorCHIM_POS.push(cx, cz, rb);
  }`);
rep(`function gorBuildTown(game, root) {`, block + `\nfunction gorBuildTown(game, root) {`);
fs.writeFileSync('src/goreme.js', s); console.log('ok');
