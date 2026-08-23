import fs from 'fs';
let s = fs.readFileSync('src/goreme.js', 'utf8');
const extra = fs.readFileSync('qa/_ed/gor-extra.txt', 'utf8');
function rep(a,b){const n=s.split(a).length-1;if(n!==1){console.error('FAIL('+n+'): '+a.slice(0,60));process.exit(1)}s=s.replace(a,()=>b)}
rep(`      wheek: ['She has heard worse. She has heard me.'] });
  }`,
`      wheek: ['She has heard worse. She has heard me.'] });
` + extra + `  }`);

// ---- positional sound on the ground the balloon drifts over --------------
rep(`function gorUpdatePigeons(dt) {`,
`/**
 * TWO THINGS ON THE GROUND THAT MAKE A NOISE, BOTH RATIONED BY DISTANCE.
 *
 * The chapter's soundscape is the burners, and it is right — a hundred and
 * fifty of them going off across a dark valley is the sound of the place, and
 * everything else falls away as you climb (see systems.js, the goreme branch).
 * What it left is a valley floor with no voice at all, which matters because
 * the whole second half of the chapter is spent LOOKING AT the valley floor
 * from a hundred metres up, listening to it go quiet.
 *
 *   THE DOVECOTE. Four hundred holes and two hundred and sixty birds in a
 *     cliff. A loft is a continuous low murmur and it is audible across a
 *     valley at five in the morning, which is exactly the range that makes the
 *     cliff a PLACE rather than a wall with dots on it.
 *   THE POPLARS. The only tall green thing in the chapter, and the only thing
 *     in it that the dawn breeze can get into.
 *
 * Both are multiplied by the same \`sky\` fall-off the ambience uses, because a
 * sound that stayed the same volume at a hundred and twenty metres would undo
 * the one idea the chapter's audio is built on.
 */
let gorSndDove = 3, gorSndPoplar = 5;

function gorUpdateGroundSound(game, dt) {
  const p = game.capy && game.capy.position;
  if (!p) return;
  // 0 on the ground, 1 by 120 m — the same curve the ambience uses, so nothing
  // here can be louder than the village it is standing in.
  const sky = 1 - clamp((p.y - 12) / 108, 0, 1);
  gorSndDove -= dt;
  if (gorSndDove <= 0) {
    const d = Math.hypot(p.x - gorCLIFF.x, p.z - gorCLIFF.z);
    if (d < 90) {
      gorSfx('rustle', { volume: clamp(0.15 * (1 - d / 90) * sky, 0.015, 0.15),
                         pitch: rand(1.5, 2.1) });
      gorSndDove = rand(2.6, 5.5);
    } else gorSndDove = rand(3, 6);
  }
  gorSndPoplar -= dt;
  if (gorSndPoplar <= 0) {
    // the poplars are scattered, so this measures to the valley floor rather
    // than to any one of them: below twenty metres and inside the valley you
    // are among them, and above that you are not.
    const inValley = p.z < gorTOWN_Z && p.z > -100 && Math.abs(p.x) < 90;
    if (inValley && p.y < 22) {
      gorSfx('hiss', { volume: clamp(0.10 * sky, 0.015, 0.10), pitch: rand(0.9, 1.3) });
      gorSndPoplar = rand(5, 11);
    } else gorSndPoplar = rand(4, 8);
  }
}

function gorUpdatePigeons(dt) {`);
rep(`      gorUpdatePigeons(dt);`, `      gorUpdatePigeons(dt);\n      gorUpdateGroundSound(game, dt);`);
fs.writeFileSync('src/goreme.js', s); console.log('ok');
