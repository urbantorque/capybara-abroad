import fs from 'fs';
let s = fs.readFileSync('src/iceland.js', 'utf8');
function rep(a,b){const n=s.split(a).length-1;if(n!==1){console.error('FAIL('+n+'): '+a.slice(0,60));process.exit(1)}s=s.replace(a,()=>b)}
rep(`      iceUpdateSteam(dt);
      iceUpdateSpring(game, dt);`,
`      iceUpdateSteam(dt);
      iceUpdateSheep(game, dt);
      iceUpdateSpring(game, dt);`);
fs.writeFileSync('src/iceland.js', s); console.log('ok');
