// ===========================================================================
// HAVOC (ROADMAP-TEN U1a + U1g, 26 Sep 2026) — Free Roam's own game.
//
// The author, on the T4 build: "Free Roam needs to be a bit more chaotic,
// short attention span grabbing, and distinct to the Story Mode, eg. like a
// 'Deathmatch' style concept or timer based concept with smaller challenges
// or streaks... it seems a bit boring." And then: "introduce a few aggressive
// enemies (that you can take out with projectiles and a 3 heart system (you
// can die or lose if you get caught or hit too many times)", and "dont make
// the rising music pitch (it sounds too sharp)".
//
// So Free Roam is a playground with a clock in it, and three things live
// here, all of them Free Roam only (game.state.journeyMode === 'free', read
// through game.havocOK), none of them ever in the story:
//
//   THE STREAK   every piece of mischief the animal causes — a knock-over, a
//                spill, a theft, a hat, something in the water, a bang, a
//                yuzu off the ground, a pest knocked out, a chase begun —
//                chains within 4 s of the last. x2, x3, up to x8. Each link
//                is a soft tick at ONE pitch (the author's note). When the
//                chain breaks, a chain of three or more cashes in as yuzu.
//                Cut: noStreak.
//   THE RUNS     a gold ring near every place's arrival starts a 60 s run:
//                seven kinds (knock things over, a yuzu rain, light paws,
//                stay chased, make a splash, pest control, mayhem), each with
//                bronze/silver/gold, a countdown, a results card, and Enter
//                for another go. A place's best is the save's `havoc` field
//                (systems.js owns the file: game.havocStore). Cut: noHavoc.
//   THE PESTS    two or three aggressive pests per place: the GULL dives
//                (its shadow on the ground first), the WARDEN winds up and
//                charges with a net, the DOG runs in bursts and gives up. A
//                hit costs one of three hearts; three and the animal is
//                CAUGHT — the streak is lost, five yuzu are dropped, it goes
//                back to where the place put it down, and a run in progress
//                is lost. V flicks a yuzu pip (aim-assist in a 25 degree cone)
//                and a hit knocks a pest out with a tumble, a puff and a
//                yuzu. Cut: noPests.
//
// Talks to the rest of the game the way rival.js does — through `game` doors
// and the event bus, never another module's state:
//   in:  'capy:mischief' {kind,x,z,type} (systems.js, props.js),
//        'yuzu:got' {n,x,z} (systems.js), 'npc:chase' / 'npc:gaveup' /
//        'npc:caught' / 'npc:lost' (npc.js, wrapped as {npc: payload})
//   out: 'havoc:hit' {hearts}, 'havoc:caught', 'havoc:ko' {kind},
//        'havoc:run' {kind, medal, score}
//   doors: game.havocOK, game.havocHome, game.havocStore, game.yuzuGive,
//          game.yuzuHave, game.dropGive, game.groundY, game.sparks, game.sfx,
//          game.punch/shake, game.music, game.biome.spawnOf, capy.shove
// Everything it draws is its own and hidden when HAVOC is not live.
// ===========================================================================
import * as THREE from 'three';
import { PALETTE, matRound, matEmit, clamp, rand, chapterOf } from './shared.js';

// ---- the streak -------------------------------------------------------------
const hvLINK_WIN = 4.0;        // s a chain waits for its next link
const hvMULT_MAX = 8;
const hvLINK_PTS = 10;         // points per link, times the multiplier
const hvCASH_MIN = 3;          // links before a broken chain pays anything
// ---- the runs ---------------------------------------------------------------
const hvRUN_T = 60;            // s
const hvRING_R = 1.5;          // m, step inside to start
const hvRING_OFF = 7;          // m from the arrival spot
const hvRING_WAIT = 3;         // s after an arrival before the ring shows
const hvKINDS = {
  knock:  { name: 'KNOCKDOWN',     goal: 'knock things over',                 t: [5, 8, 12] },
  rain:   { name: 'YUZU RAIN',     goal: 'catch the yuzu before it fades',    t: [6, 10, 13] },
  theft:  { name: 'LIGHT PAWS',    goal: 'take things that belong to people', t: [2, 3, 5] },
  chase:  { name: 'CATCH ME',      goal: 'seconds with somebody after it',    t: [10, 20, 35] },
  splash: { name: 'MAKE A SPLASH', goal: 'spill it, or sink it',              t: [2, 4, 6] },
  pests:  { name: 'PEST CONTROL',  goal: 'knock pests out with V',            t: [3, 6, 9] },
  mayhem: { name: 'MAYHEM',        goal: 'anything at all, fast',             t: [8, 15, 25] },
};
const hvORDER = ['knock', 'pests', 'rain', 'mayhem', 'theft', 'chase', 'splash'];
// Places a kind cannot be won in: no water to put anything into.
const hvNO_SPLASH = { sahara: 1, drift: 1, goreme: 1 };
const hvRAIN_N = 14;
// ---- the pests ----------------------------------------------------------------
const hvHEARTS = 3;
const hvINVULN = 1.2;          // s after a hit
const hvHOME_GRACE = 2.0;      // s after being caught
const hvARRIVE_QUIET = 20;     // s after an arrival before any pest
const hvPEST_ALIVE = 2;        // alive at once, ordinarily
const hvPEST_ALIVE_RUN = 3;    // ...during any run
const hvPEST_ALIVE_HUNT = 4;   // ...during PEST CONTROL
const hvPEST_RESPAWN = 20;     // s after a knock-out before another comes
const hvPEST_NEAR = 25, hvPEST_FAR = 40;
const hvKNOCK_MAX = 6;         // m/s of shove at most: the monPACK_SHOVE_MAX lesson
// ---- the pip -----------------------------------------------------------------
const hvPIP_N = 16;
const hvPIP_SPEED = 21;        // m/s
const hvPIP_G = 6;             // m/s^2 — an arc you can see, not a bullet
const hvPIP_LIFE = 1.5;        // s
const hvPIP_COOL = 0.35;       // s between flicks
const hvPIP_CONE = 25 * Math.PI / 180;
const hvPIP_R = 0.6;           // m, a pip's reach on top of a pest's own

const hvHex = c => '#' + ('000000' + (c >>> 0).toString(16)).slice(-6);
const hvRgba = (c, a) => 'rgba(' + ((c >> 16) & 255) + ',' + ((c >> 8) & 255) + ',' + (c & 255) + ',' + a + ')';

export function createHavoc(game) {
  const st = game.state;
  let biome = '';
  let arriveT = 0;             // s in this place (live frames only)
  // streak
  let links = 0, linkT = 0, chainPts = 0, cashT = 0, cashN = 0, bestMult = 0;
  // run
  let runState = 'idle';       // idle | intro | live | result
  let runKind = 'knock', runT = 0, runCount = 0, runPts = 0, runIntroT = 0, runResultT = 0;
  let runMedal = 0, runScore = 0, runBest = 0, runNew = false, runLost = false;
  let rainLeft = 0, rainT = 0;
  const kindAt = Object.create(null);   // biome -> index into hvORDER, this session
  // hearts and pests
  let hearts = hvHEARTS, invulnT = 0, graceT = 0, blinkOn = false;
  let chasers = 0;
  let koT = 0;                 // s since the last knock-out (respawn clock)
  let pipCool = 0;
  const pests = [];
  const pips = [];

  // ===========================================================================
  // THE DRAWING. One group in the scene, never captured by a biome; a pest is
  // a small group of smooth primitives (the living breathe: matRound), made
  // on first use and pooled. Nothing casts a shadow: the gull's own shadow is
  // the telegraph, and it is drawn on purpose.
  // ===========================================================================
  const root = new THREE.Group();
  root.name = 'havoc';
  root.visible = false;
  if (game.scene) game.scene.add(root);
  const geoSph = new THREE.SphereGeometry(1, 14, 10);
  const geoCyl = new THREE.CylinderGeometry(1, 1, 1, 12);
  const geoCone = new THREE.ConeGeometry(1, 1, 10);
  function part(geo, mat, sx, sy, sz, x, y, z, parent) {
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(sx, sy, sz); m.position.set(x, y, z);
    m.castShadow = false; m.receiveShadow = false;
    parent.add(m);
    return m;
  }
  function buildGull() {
    const g = new THREE.Group();
    const white = matRound(PALETTE.pestGull), grey = matRound(PALETTE.pestGullWing), beak = matRound(PALETTE.pestBeak);
    const eye = matRound(PALETTE.ibisHead);
    part(geoSph, white, 0.26, 0.22, 0.5, 0, 0, 0, g);                 // body
    part(geoSph, white, 0.17, 0.16, 0.18, 0, 0.14, 0.4, g);            // head
    const bk = part(geoCone, beak, 0.05, 0.2, 0.05, 0, 0.12, 0.62, g); bk.rotation.x = Math.PI / 2;
    part(geoSph, eye, 0.028, 0.028, 0.028, 0.1, 0.19, 0.49, g);
    part(geoSph, eye, 0.028, 0.028, 0.028, -0.1, 0.19, 0.49, g);
    part(geoSph, grey, 0.14, 0.06, 0.2, 0, 0.03, -0.52, g);            // tail
    const wl = new THREE.Group(), wr = new THREE.Group();
    part(geoSph, grey, 0.55, 0.035, 0.2, -0.5, 0, 0, wl);
    part(geoSph, grey, 0.55, 0.035, 0.2, 0.5, 0, 0, wr);
    wl.position.set(-0.14, 0.08, 0.02); wr.position.set(0.14, 0.08, 0.02);
    g.add(wl); g.add(wr);
    g.userData.wings = [wl, wr];
    g.scale.setScalar(1.25);
    return g;
  }
  function buildWarden() {
    const g = new THREE.Group();
    const uni = matRound(PALETTE.pestWarden), skin = matRound(PALETTE.skin2), dark = matRound(PALETTE.ibisHead);
    const net = matRound(PALETTE.pestNet), hv = matRound(PALETTE.hiVis);
    const legs = [];
    for (let s = -1; s <= 1; s += 2) {
      const lg = new THREE.Group(); lg.position.set(0.11 * s, 0.82, 0);
      part(geoCyl, uni, 0.075, 0.8, 0.075, 0, -0.4, 0, lg);
      part(geoSph, dark, 0.09, 0.06, 0.14, 0, -0.82, 0.04, lg);        // shoe
      g.add(lg); legs.push(lg);
    }
    part(geoSph, uni, 0.24, 0.36, 0.17, 0, 1.12, 0, g);                // torso
    part(geoCyl, hv, 0.245, 0.07, 0.175, 0, 1.02, 0, g);               // the hi-vis band
    part(geoCyl, skin, 0.06, 0.1, 0.06, 0, 1.48, 0, g);                 // neck
    part(geoSph, skin, 0.14, 0.16, 0.14, 0, 1.64, 0, g);                // head
    part(geoSph, skin, 0.03, 0.04, 0.04, 0, 1.63, 0.14, g);             // nose
    part(geoCyl, uni, 0.16, 0.08, 0.16, 0, 1.78, 0, g);                 // cap
    part(geoCyl, dark, 0.17, 0.02, 0.2, 0, 1.745, 0.06, g);             // brim
    const arm = new THREE.Group(); arm.position.set(0.28, 1.36, 0);
    part(geoCyl, uni, 0.06, 0.5, 0.06, 0, -0.22, 0, arm);
    part(geoSph, skin, 0.06, 0.07, 0.06, 0, -0.48, 0, arm);
    const pole = new THREE.Group(); pole.position.set(0, -0.48, 0);
    part(geoCyl, dark, 0.025, 1.4, 0.025, 0, 0.1, 0.55, pole).rotation.x = 1.2;
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.025, 6, 16), dark);
    hoop.position.set(0, 0.42, 1.2); hoop.rotation.x = 0.35; pole.add(hoop);
    part(geoCone, net, 0.3, 0.45, 0.3, 0, 0.25, 1.26, pole).rotation.x = 0.35 + Math.PI;
    arm.add(pole); g.add(arm);
    const armL = new THREE.Group(); armL.position.set(-0.28, 1.36, 0);
    part(geoCyl, uni, 0.06, 0.5, 0.06, 0, -0.22, 0, armL);
    part(geoSph, skin, 0.06, 0.07, 0.06, 0, -0.48, 0, armL);
    g.add(armL);
    // the tell: a coral bar and dot over the head while it winds up
    const tell = new THREE.Group(); tell.position.set(0, 2.15, 0);
    part(new THREE.BoxGeometry(1, 1, 1), matEmit(PALETTE.havocMeter, 0.9), 0.07, 0.26, 0.07, 0, 0.1, 0, tell);
    part(geoSph, matEmit(PALETTE.havocMeter, 0.9), 0.05, 0.05, 0.05, 0, -0.12, 0, tell);
    tell.visible = false; g.add(tell);
    g.userData.legs = legs; g.userData.arm = arm; g.userData.armL = armL; g.userData.tell = tell;
    return g;
  }
  function buildDog() {
    const g = new THREE.Group();
    const fur = matRound(PALETTE.pestDog), dark = matRound(PALETTE.ibisHead), pale = matRound(PALETTE.pestNet);
    part(geoSph, fur, 0.19, 0.18, 0.4, 0, 0.42, 0, g);                  // body
    part(geoSph, fur, 0.15, 0.15, 0.16, 0, 0.62, 0.38, g);              // head
    part(geoSph, pale, 0.08, 0.07, 0.11, 0, 0.57, 0.53, g);             // muzzle
    part(geoSph, dark, 0.035, 0.03, 0.03, 0, 0.6, 0.64, g);             // nose
    for (let s = -1; s <= 1; s += 2) {
      const ear = part(geoCone, dark, 0.06, 0.13, 0.04, 0.09 * s, 0.78, 0.36, g); ear.rotation.z = -0.3 * s;
    }
    const tail = part(geoCyl, fur, 0.03, 0.26, 0.03, 0, 0.56, -0.42, g); tail.rotation.x = -0.7;
    const legs = [];
    const lx = [0.1, -0.1, 0.1, -0.1], lz = [0.22, 0.22, -0.22, -0.22];
    for (let i = 0; i < 4; i++) {
      const lg = new THREE.Group(); lg.position.set(lx[i], 0.34, lz[i]);
      part(geoCyl, fur, 0.045, 0.34, 0.045, 0, -0.17, 0, lg);
      g.add(lg); legs.push(lg);
    }
    g.userData.legs = legs; g.userData.tail = tail;
    return g;
  }
  // the gull's telegraph: its shadow on the ground, growing as it commits
  const shadowMat = new THREE.MeshBasicMaterial({ color: PALETTE.ibisHead, transparent: true, opacity: 0, depthWrite: false });
  const shadowGeo = new THREE.CircleGeometry(1, 20); shadowGeo.rotateX(-Math.PI / 2);

  // the ring: a gold hoop on the ground, a soft column of light, a slow spin
  const ring = new THREE.Group();
  const ringHoop = new THREE.Mesh(new THREE.TorusGeometry(hvRING_R, 0.09, 8, 40), matEmit(PALETTE.havocGold, 1.1));
  ringHoop.rotation.x = Math.PI / 2; ringHoop.position.y = 0.12; ring.add(ringHoop);
  const ringInner = new THREE.Mesh(new THREE.TorusGeometry(hvRING_R * 0.62, 0.05, 6, 32), matEmit(PALETTE.havocMeter, 0.9));
  ringInner.rotation.x = Math.PI / 2; ringInner.position.y = 0.1; ring.add(ringInner);
  const beamMat = new THREE.MeshBasicMaterial({ color: PALETTE.havocGold, transparent: true, opacity: 0.22,
    depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(hvRING_R * 0.35, hvRING_R * 0.7, 7, 20, 1, true), beamMat);
  beam.position.y = 3.5; ring.add(beam);
  ring.visible = false;
  root.add(ring);
  let ringX = 0, ringY = 0, ringZ = 0, ringOn = false;

  // the pips: one instanced draw
  const pipMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 8, 6), matEmit(PALETTE.pestPip, 0.6), hvPIP_N);
  pipMesh.frustumCulled = false; pipMesh.castShadow = false; pipMesh.count = 0;
  root.add(pipMesh);
  for (let i = 0; i < hvPIP_N; i++) pips.push({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, t: 0 });
  const pipM = new THREE.Matrix4();

  // ===========================================================================
  // THE HUD. Its own elements under #hud, its own style sheet, the game's own
  // paper and ink: PALETTE.sail and PALETTE.ibisHead, the capyui font.
  // ===========================================================================
  const hudRoot = document.getElementById('hud');
  const css = document.createElement('style');
  const ink = hvHex(PALETTE.ibisHead), paper = hvRgba(PALETTE.sail, 0.95);
  const shadow = '0 1px 3px ' + hvRgba(PALETTE.ibisHead, 0.22) + ',0 6px 18px ' + hvRgba(PALETTE.ibisHead, 0.16);
  css.textContent = [
    '.hv{position:absolute;pointer-events:none;color:' + ink + ';font-family:"Trebuchet MS","Segoe UI",system-ui,sans-serif;z-index:57;}',
    '.hv-hearts{right:14px;top:14px;display:flex;gap:4px;padding:6px 10px;border-radius:999px;background:' + paper + ';box-shadow:' + shadow + ';opacity:0;transition:opacity .4s ease;}',
    '.hv-hearts.show{opacity:1;}',
    '.hv-hearts svg{width:20px;height:18px;display:block;transition:transform .25s cubic-bezier(.3,1.6,.5,1);}',
    '.hv-hearts svg.gone path{fill:' + hvRgba(PALETTE.ibisHead, 0.18) + ';}',
    '.hv-hearts svg path{fill:' + hvHex(PALETTE.havocHeart) + ';}',
    '.hv-hearts.hit svg{animation:hv-shake .35s ease;}',
    '@keyframes hv-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-3px)}75%{transform:translateX(3px)}}',
    '.hv-streak{left:50%;bottom:92px;transform:translate(-50%,10px);opacity:0;display:flex;align-items:center;gap:10px;',
    '  padding:7px 16px 7px 12px;border-radius:999px;background:' + paper + ';box-shadow:' + shadow + ';',
    '  transition:opacity .25s ease,transform .25s cubic-bezier(.3,1.5,.5,1);}',
    '.hv-streak.show{opacity:1;transform:translate(-50%,0);}',
    '.hv-streak b{font-size:26px;font-weight:800;font-variant-numeric:tabular-nums;min-width:44px;text-align:center;line-height:1;}',
    '.hv-streak.pop b{animation:hv-pop .22s cubic-bezier(.3,1.8,.5,1);}',
    '@keyframes hv-pop{0%{transform:scale(1)}40%{transform:scale(1.35)}100%{transform:scale(1)}}',
    '.hv-streak .bar{width:120px;height:6px;border-radius:3px;background:' + hvRgba(PALETTE.ibisHead, 0.14) + ';overflow:hidden;}',
    '.hv-streak .bar i{display:block;height:100%;background:' + hvHex(PALETTE.havocMeter) + ';border-radius:3px;}',
    '.hv-streak.m8 .bar i{background:' + hvHex(PALETTE.havocGold) + ';}',
    '.hv-streak span{font-size:13px;font-weight:700;font-variant-numeric:tabular-nums;min-width:56px;}',
    '.hv-streak.cash span{color:' + hvHex(PALETTE.leafC) + ';}',
    '.hv-run{left:50%;top:14px;transform:translate(-50%,-8px);opacity:0;display:flex;align-items:center;gap:14px;',
    '  padding:8px 18px;border-radius:16px;background:' + paper + ';box-shadow:' + shadow + ';transition:opacity .3s ease,transform .3s ease;}',
    '.hv-run.show{opacity:1;transform:translate(-50%,0);}',
    '.hv-run .k{font-size:11px;letter-spacing:.14em;font-weight:800;}',
    '.hv-run .t{font-size:28px;font-weight:800;font-variant-numeric:tabular-nums;min-width:62px;text-align:center;}',
    '.hv-run .t.low{color:' + hvHex(PALETTE.havocHeart) + ';}',
    '.hv-run .c{font-size:18px;font-weight:800;font-variant-numeric:tabular-nums;}',
    '.hv-run .m{display:flex;gap:4px;}',
    '.hv-run .m i{width:12px;height:12px;border-radius:50%;background:' + hvRgba(PALETTE.ibisHead, 0.14) + ';box-shadow:inset 0 -2px 0 rgba(0,0,0,.12);transition:background .3s ease,transform .3s cubic-bezier(.3,1.8,.5,1);}',
    '.hv-run .m i.on{transform:scale(1.25);}',
    '.hv-run .m i.m1.on{background:' + hvHex(PALETTE.havocBronze) + ';}',
    '.hv-run .m i.m2.on{background:' + hvHex(PALETTE.havocSilver) + ';}',
    '.hv-run .m i.m3.on{background:' + hvHex(PALETTE.havocGold) + ';}',
    '.hv-card{left:50%;top:40%;transform:translate(-50%,-50%) scale(.94);opacity:0;min-width:260px;max-width:min(88vw,380px);',
    '  padding:18px 24px 16px;border-radius:18px;background:' + paper + ';box-shadow:' + shadow + ';text-align:center;',
    '  transition:opacity .3s ease,transform .35s cubic-bezier(.3,1.5,.5,1);}',
    '.hv-card.show{opacity:1;transform:translate(-50%,-50%) scale(1);}',
    '.hv-card .k{font-size:12px;letter-spacing:.18em;font-weight:800;opacity:.75;}',
    '.hv-card h3{margin:6px 0 4px;font-size:30px;font-weight:800;letter-spacing:.04em;line-height:1.05;}',
    '.hv-card p{margin:4px 0;font-size:15px;line-height:1.4;}',
    '.hv-card .tiers{display:flex;justify-content:center;gap:14px;margin-top:8px;font-size:14px;font-weight:700;font-variant-numeric:tabular-nums;}',
    '.hv-card .tiers i{display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:5px;vertical-align:-1px;}',
    '.hv-card .medal{width:64px;height:64px;border-radius:50%;margin:8px auto 6px;box-shadow:inset 0 -5px 0 rgba(0,0,0,.18),0 2px 8px ' + hvRgba(PALETTE.ibisHead, 0.25) + ';}',
    '.hv-card .score{font-size:34px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1;}',
    '.hv-card .best{font-size:13px;font-weight:700;opacity:.75;margin-top:4px;}',
    '.hv-card .best.new{color:' + hvHex(PALETTE.leafC) + ';opacity:1;}',
    '.hv-card .keys{margin-top:10px;font-size:12px;letter-spacing:.08em;font-weight:700;opacity:.7;}',
    '.hv-count{left:50%;top:40%;transform:translate(-50%,-50%);font-size:96px;font-weight:900;color:' + hvHex(PALETTE.sail) + ';',
    '  text-shadow:0 3px 0 ' + hvRgba(PALETTE.ibisHead, 0.5) + ',0 8px 24px ' + hvRgba(PALETTE.ibisHead, 0.35) + ';opacity:0;}',
    '.hv-count.show{animation:hv-count .7s cubic-bezier(.3,1.6,.5,1) forwards;}',
    '@keyframes hv-count{0%{opacity:0;transform:translate(-50%,-50%) scale(1.6)}30%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-50%) scale(.9)}}',
    '.hv-tag{transform:translate(-50%,-100%);padding:4px 10px;border-radius:999px;background:' + paper + ';box-shadow:' + shadow + ';',
    '  font-size:12px;font-weight:800;letter-spacing:.12em;white-space:nowrap;opacity:0;transition:opacity .3s ease;}',
    '.hv-tag.show{opacity:1;}',
    '.hv-fling{right:18px;bottom:150px;width:64px;height:64px;border-radius:50%;background:' + paper + ';box-shadow:' + shadow + ';',
    '  display:none;align-items:center;justify-content:center;font-size:13px;font-weight:800;letter-spacing:.06em;pointer-events:auto;touch-action:none;}',
    '.hv-fling.show{display:flex;}',
  ].join('\n');
  document.head.appendChild(css);
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
  const HEART = '<svg viewBox="0 0 20 18" aria-hidden="true"><path d="M10 17.2 1.9 9.4A4.9 4.9 0 0 1 9 2.6l1 1 1-1a4.9 4.9 0 0 1 7.1 6.8Z"/></svg>';
  const heartsEl = el('div', 'hv hv-hearts');
  heartsEl.innerHTML = HEART + HEART + HEART;
  heartsEl.setAttribute('role', 'status'); heartsEl.setAttribute('aria-label', '3 hearts');
  const streakEl = el('div', 'hv hv-streak');
  const streakB = el('b', null, 'x2'), streakBar = el('div', 'bar'), streakFill = el('i'), streakPts = el('span', null, '');
  streakBar.appendChild(streakFill); streakEl.appendChild(streakB); streakEl.appendChild(streakBar); streakEl.appendChild(streakPts);
  const runEl = el('div', 'hv hv-run');
  const runK = el('span', 'k'), runTm = el('span', 't'), runC = el('span', 'c'), runM = el('span', 'm');
  for (let i = 1; i <= 3; i++) runM.appendChild(el('i', 'm' + i));
  runEl.appendChild(runK); runEl.appendChild(runTm); runEl.appendChild(runC); runEl.appendChild(runM);
  const cardEl = el('div', 'hv hv-card');
  const countEl = el('div', 'hv hv-count');
  const tagEl = el('div', 'hv hv-tag', 'HAVOC');
  const flingEl = el('div', 'hv hv-fling', 'FLING');
  flingEl.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); fling(); });
  if (hudRoot) for (const e of [heartsEl, streakEl, runEl, cardEl, countEl, tagEl, flingEl]) hudRoot.appendChild(e);
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

  function sfx(name, vol, pitch) {
    try { if (typeof game.sfx === 'function') game.sfx(name, { volume: vol, pitch: pitch || 1 }); } catch (e) { /* optional */ }
  }
  function capy() { return game.capy; }
  function gy(x, z, fb) {
    let y = NaN;
    try { if (typeof game.groundY === 'function') y = game.groundY(x, z); } catch (e) { y = NaN; }
    return (typeof y === 'number' && y === y) ? y : fb;
  }
  function free() { return st.journeyMode === 'free'; }
  function live() { return free() && typeof game.havocOK === 'function' && game.havocOK(); }
  function streakOn() { return !st.noStreak; }
  function runsOn() { return !st.noHavoc; }
  function pestsOn() { return !st.noPests; }

  // ===========================================================================
  // THE STREAK
  // ===========================================================================
  function link(pts) {
    if (!free() || !streakOn()) return;
    links++;
    linkT = hvLINK_WIN;
    const mult = Math.min(hvMULT_MAX, Math.max(1, links));
    const p = (pts || hvLINK_PTS) * mult;
    chainPts += p;
    if (runState === 'live') runPts += p;
    if (mult > bestMult) bestMult = mult;
    // ONE PITCH, every link (the author: "dont make the rising music pitch").
    // The multiplier is said by the number and the bar, not by the ear.
    sfx('blip', links >= 2 ? 0.34 : 0.24, 1.0);
    if (links >= 2) {
      streakB.textContent = 'x' + mult;
      streakPts.textContent = chainPts + ' pts';
      streakEl.classList.remove('cash');
      streakEl.classList.toggle('m8', mult >= hvMULT_MAX);
      streakEl.classList.add('show');
      streakEl.classList.remove('pop'); void streakEl.offsetWidth; streakEl.classList.add('pop');
    }
  }
  function streakBreak(lost) {
    const n = links, pts = chainPts;
    links = 0; chainPts = 0; linkT = 0;
    if (lost || n < hvCASH_MIN) {
      streakEl.classList.remove('show');
      return;
    }
    // A chain of three or more pays: a yuzu for every two links, up to twelve.
    const y = Math.min(12, Math.floor(n / 2));
    cashN = y; cashT = 1.6;
    streakB.textContent = 'x' + Math.min(hvMULT_MAX, n);
    streakPts.textContent = '+' + y + ' yuzu';
    streakEl.classList.add('cash', 'show');
    const c = capy(), p = c && c.position;
    if (typeof game.yuzuGive === 'function' && y > 0) game.yuzuGive(y, null, p ? p.x : 0, p ? p.y + 1 : 0, p ? p.z : 0);
    sfx('yuzu', 0.5, 1.0);
    void pts;
  }

  // ===========================================================================
  // THE RUNS
  // ===========================================================================
  function kindFor(b) {
    let i = kindAt[b] | 0;
    for (let k = 0; k < hvORDER.length; k++) {
      const kind = hvORDER[(i + k) % hvORDER.length];
      if (kind === 'splash' && hvNO_SPLASH[b]) continue;
      if (kind === 'pests' && !pestsOn()) continue;
      return kind;
    }
    return 'knock';
  }
  function placeRing() {
    ringOn = false;
    const sp = game.biome && typeof game.biome.spawnOf === 'function' ? game.biome.spawnOf(biome) : null;
    if (!sp) return;
    const y0 = gy(sp.x, sp.z, sp.y);
    // eight bearings, the first whose ground sits within 0.8 m of the spawn's
    let best = null;
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4 + 0.35;
      const x = sp.x + Math.sin(a) * hvRING_OFF, z = sp.z + Math.cos(a) * hvRING_OFF;
      const y = gy(x, z, NaN);
      if (y === y && Math.abs(y - y0) < 0.8) { best = { x: x, y: y, z: z }; break; }
    }
    if (!best) best = { x: sp.x + 3, y: y0, z: sp.z + 3 };
    ringX = best.x; ringY = best.y; ringZ = best.z; ringOn = true;
    ring.position.set(ringX, ringY, ringZ);
  }
  function tiersHtml(t) {
    return '<i style="background:' + hvHex(PALETTE.havocBronze) + '"></i>' + t[0] +
           '<span></span><i style="background:' + hvHex(PALETTE.havocSilver) + '"></i>' + t[1] +
           '<span></span><i style="background:' + hvHex(PALETTE.havocGold) + '"></i>' + t[2];
  }
  function runStart() {
    runKind = kindFor(biome);
    const K = hvKINDS[runKind];
    runState = 'intro'; runIntroT = 0; runT = hvRUN_T; runCount = 0; runPts = 0; runLost = false;
    cardEl.innerHTML = '';
    cardEl.appendChild(el('div', 'k', 'HAVOC'));
    cardEl.appendChild(el('h3', null, K.name));
    cardEl.appendChild(el('p', null, K.goal));
    const tiers = el('div', 'tiers'); tiers.innerHTML = tiersHtml(K.t); cardEl.appendChild(tiers);
    cardEl.classList.add('show');
    ring.visible = false;
    sfx('whistle', 0.5, 1.0);
    if (game.music && typeof game.music.swell === 'function') { try { game.music.swell(0.7); } catch (e) { /* optional */ } }
  }
  function count(n) {
    if (runState !== 'live') return;
    runCount += n;
    const t = hvKINDS[runKind].t;
    // counted against the next medal it has not reached, gold once it has them all
    const next = runCount < t[0] ? t[0] : runCount < t[1] ? t[1] : t[2];
    runC.textContent = (runKind === 'chase' ? Math.floor(runCount) : runCount) + ' / ' + next;
    const ms = runM.children;
    for (let i = 0; i < 3; i++) {
      const on = runCount >= t[i];
      if (on && !ms[i].classList.contains('on')) { ms[i].classList.add('on'); sfx('bell', 0.45, 1.0); }
    }
    // gold ends it early, and the seconds left are worth something
    if (runCount >= t[2]) runEnd(false);
  }
  function rainDrop() {
    const c = capy(), p = c && c.position;
    if (!p || typeof game.dropGive !== 'function') return;
    for (let k = 0; k < 6; k++) {
      const a = rand(0, Math.PI * 2), r = rand(6, 20);
      const x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r;
      const y = gy(x, z, NaN);
      if (!(y === y) || Math.abs(y - p.y) > 3) continue;
      if (game.dropGive(x, z, rainLeft === 1 ? 3 : 1)) { rainLeft--; return; }
    }
  }
  function runEnd(lost) {
    if (runState !== 'live') return;
    const K = hvKINDS[runKind], t = K.t;
    runLost = !!lost;
    runMedal = lost ? 0 : (runCount >= t[2] ? 3 : runCount >= t[1] ? 2 : runCount >= t[0] ? 1 : 0);
    runScore = lost ? 0 : Math.round(runCount * 100 + runPts + (runMedal === 3 ? Math.max(0, runT) * 10 : 0));
    const n = chapterOf(biome);
    const store = game.havocStore;
    const was = store && typeof store.get === 'function' ? store.get(n) : null;
    runBest = was ? was.best : 0;
    runNew = false;
    if (!lost && runScore > 0 && store && typeof store.put === 'function') {
      runNew = runScore > runBest;
      store.put(n, runScore, runMedal);
      if (runNew) runBest = runScore;
    }
    runState = 'result'; runResultT = 0;
    kindAt[biome] = ((kindAt[biome] | 0) + 1) % hvORDER.length;
    runEl.classList.remove('show');
    cardEl.innerHTML = '';
    cardEl.appendChild(el('div', 'k', K.name));
    if (lost) {
      cardEl.appendChild(el('h3', null, 'caught.'));
      cardEl.appendChild(el('p', null, 'the run is over. the ring is still there.'));
    } else {
      const medal = el('div', 'medal');
      medal.style.background = runMedal ? hvHex([0, PALETTE.havocBronze, PALETTE.havocSilver, PALETTE.havocGold][runMedal]) : hvRgba(PALETTE.ibisHead, 0.14);
      cardEl.appendChild(medal);
      cardEl.appendChild(el('div', 'score', String(runScore)));
      cardEl.appendChild(el('p', null, (runKind === 'chase' ? Math.floor(runCount) + ' s' : runCount + ' done') + ' · best streak x' + bestMult));
      cardEl.appendChild(el('div', 'best' + (runNew ? ' new' : ''), runNew ? 'a new best here' : 'best here ' + runBest));
    }
    cardEl.appendChild(el('div', 'keys', 'ENTER · again'));
    cardEl.classList.add('show');
    sfx(runMedal >= 2 ? 'cheer' : 'pop', 0.6, 1.0);
    if (runMedal === 3 && typeof game.confetti === 'function') { try { game.confetti(); } catch (e) { /* optional */ } }
    try { game.events.emit('havoc:run', { kind: runKind, medal: runMedal, score: runScore }); } catch (e) { /* bus */ }
  }
  function runCancel() {
    runState = 'idle'; runEl.classList.remove('show'); cardEl.classList.remove('show'); countEl.classList.remove('show');
  }
  let countShown = -1;
  function runTick(dt) {
    const c = capy(), p = c && c.position;
    if (runState === 'idle') {
      const show = runsOn() && ringOn && arriveT > hvRING_WAIT && !!p;
      ring.visible = show;
      if (show) {
        const tt = st.time || 0;
        ringHoop.scale.setScalar(1 + Math.sin(tt * 3) * 0.04);
        ringInner.rotation.z = tt * 0.8;
        // the column is a beacon from across the square and nothing up close:
        // it fades out as the lens comes inside 14 m, gone by 6
        const cam = game.camera;
        const cd = cam ? Math.hypot(cam.position.x - ringX, cam.position.z - ringZ) : 99;
        beamMat.opacity = (0.14 + Math.sin(tt * 2.2) * 0.04) * clamp((cd - 6) / 8, 0, 1);
        const d = Math.hypot(p.x - ringX, p.z - ringZ);
        if (d < hvRING_R && Math.abs(p.y - ringY) < 2.2) runStart();
      }
      return;
    }
    ring.visible = false;
    if (runState === 'intro') {
      runIntroT += dt;
      // the card for 1.6 s, then 3, 2, 1, go — 0.6 s each
      const step = Math.floor((runIntroT - 1.6) / 0.6);
      if (runIntroT > 1.6 && step !== countShown && step <= 3) {
        countShown = step;
        cardEl.classList.remove('show');
        countEl.textContent = step < 3 ? String(3 - step) : 'go';
        countEl.classList.remove('show'); void countEl.offsetWidth; countEl.classList.add('show');
        sfx('click', 0.5, 1.0);
      }
      if (runIntroT > 1.6 + 0.6 * 3) {
        runState = 'live'; countShown = -1;
        runK.textContent = hvKINDS[runKind].name;
        for (const m of runM.children) m.classList.remove('on');
        runC.textContent = '0 / ' + hvKINDS[runKind].t[0];
        runEl.classList.add('show');
        if (runKind === 'rain') { rainLeft = hvRAIN_N; rainT = 0; rainDrop(); rainDrop(); }
      }
      return;
    }
    if (runState === 'live') {
      runT -= dt;
      const s = Math.max(0, Math.ceil(runT));
      runTm.textContent = Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
      const low = runT <= 10;
      runTm.classList.toggle('low', low);
      // the last ten seconds tick, at one pitch
      if (low && Math.ceil(runT) !== Math.ceil(runT + dt)) sfx('click', 0.35, 1.0);
      if (runKind === 'chase' && chasers > 0) count(dt);
      if (runKind === 'rain' && rainLeft > 0) { rainT += dt; if (rainT > 4) { rainT = 0; rainDrop(); } }
      if (runT <= 0) runEnd(false);
      return;
    }
    if (runState === 'result') {
      runResultT += dt;
      if (runResultT > 9) { cardEl.classList.remove('show'); runState = 'idle'; }
    }
  }

  // ===========================================================================
  // THE PESTS
  // ===========================================================================
  function pestMake(kind) {
    const g = kind === 'gull' ? buildGull() : kind === 'warden' ? buildWarden() : buildDog();
    g.visible = false;
    root.add(g);
    let sh = null;
    if (kind === 'gull') { sh = new THREE.Mesh(shadowGeo, shadowMat.clone()); sh.visible = false; root.add(sh); }
    const pe = { kind: kind, g: g, shadow: sh, on: false, state: 'in', t: 0, x: 0, y: 0, z: 0, vx: 0, vz: 0, yaw: 0,
                 tx: 0, tz: 0, ty: 0, life: 0, spin: 0, r: kind === 'gull' ? 0.55 : kind === 'warden' ? 0.5 : 0.45, orbitA: 0 };
    pests.push(pe);
    return pe;
  }
  function pestAlive() { let n = 0; for (const pe of pests) if (pe.on && pe.state !== 'ko') n++; return n; }
  function pestSpawn(kind) {
    const c = capy(), p = c && c.position;
    if (!p) return;
    let pe = null;
    for (const q of pests) if (!q.on && q.kind === kind) { pe = q; break; }
    if (!pe) pe = pestMake(kind);
    for (let k = 0; k < 10; k++) {
      const a = rand(0, Math.PI * 2), r = rand(hvPEST_NEAR, hvPEST_FAR);
      const x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r;
      const y = gy(x, z, NaN);
      if (kind !== 'gull' && (!(y === y) || Math.abs(y - p.y) > 4)) continue;
      pe.x = x; pe.z = z; pe.y = kind === 'gull' ? (y === y ? y : p.y) + 9 : y;
      pe.on = true; pe.state = kind === 'gull' ? 'circle' : 'in'; pe.t = 0; pe.life = 0; pe.spin = 0;
      pe.orbitA = Math.atan2(x - p.x, z - p.z);
      pe.g.visible = true; pe.g.rotation.set(0, 0, 0); pe.g.scale.setScalar(kind === 'gull' ? 1.25 : 1);
      if (pe.g.userData.tell) pe.g.userData.tell.visible = false;
      return;
    }
  }
  function pestOff(pe) {
    pe.on = false; pe.g.visible = false;
    if (pe.shadow) pe.shadow.visible = false;
  }
  function pestsClear() { for (const pe of pests) pestOff(pe); }
  function pestHitsCapy(pe, reach) {
    const c = capy(), p = c && c.position;
    if (!p || invulnT > 0 || graceT > 0) return false;
    const dx = p.x - pe.x, dz = p.z - pe.z, dy = (p.y + 0.4) - pe.y;
    if (dx * dx + dz * dz > reach * reach || Math.abs(dy) > 1.6) return false;
    hurt(dx, dz);
    return true;
  }
  function hurt(dx, dz) {
    const c = capy();
    hearts = Math.max(0, hearts - 1);
    invulnT = hvINVULN;
    const d = Math.hypot(dx, dz) || 1;
    if (c && typeof c.shove === 'function') c.shove(dx / d * hvKNOCK_MAX, dz / d * hvKNOCK_MAX, 'pest');
    sfx('thud', 0.8, 0.9); sfx('grunt', 0.5, 1.0);
    try { if (typeof game.punch === 'function') game.punch(0.18, 0.04); else if (typeof game.shake === 'function') game.shake(0.3); } catch (e) { /* optional */ }
    heartsDraw(true);
    try { game.events.emit('havoc:hit', { hearts: hearts }); } catch (e) { /* bus */ }
    if (hearts <= 0) caught();
  }
  function caught() {
    try { game.events.emit('havoc:caught', {}); } catch (e) { /* bus */ }
    streakBreak(true);
    const have = typeof game.yuzuHave === 'function' ? game.yuzuHave() : 0;
    const lose = Math.min(5, have | 0);
    const c = capy(), p = c && c.position;
    if (lose > 0 && typeof game.yuzuGive === 'function') game.yuzuGive(-lose, null, p ? p.x : 0, p ? p.y + 1 : 0, p ? p.z : 0);
    if (runState === 'live') runEnd(true);
    else {
      cardEl.innerHTML = '';
      cardEl.appendChild(el('div', 'k', 'HAVOC'));
      cardEl.appendChild(el('h3', null, 'caught.'));
      cardEl.appendChild(el('p', null, lose > 0 ? 'it drops ' + lose + ' yuzu on the way back.' : 'back to the start with it.'));
      cardEl.classList.add('show');
      setTimeout(function () { if (runState === 'idle') cardEl.classList.remove('show'); }, 2200);
    }
    if (typeof game.havocHome === 'function') game.havocHome();
    hearts = hvHEARTS; graceT = hvHOME_GRACE; koT = 0;
    pestsClear();
    heartsDraw(false);
    sfx('whistle', 0.5, 0.8);
  }
  function ko(pe, vx, vz) {
    pe.state = 'ko'; pe.t = 0;
    const d = Math.hypot(vx, vz) || 1;
    pe.vx = vx / d * 5; pe.vz = vz / d * 5; pe.ty = 6;   // up and away
    pe.spin = rand(-9, 9);
    if (pe.g.userData.tell) pe.g.userData.tell.visible = false;
    if (pe.shadow) pe.shadow.visible = false;
    try { if (typeof game.sparks === 'function') game.sparks(pe.x, pe.y + 0.6, pe.z, 18, { spd: 3.5, up: 1.5, grav: 6, life: 0.7, size: 0.22, rgb: [2.2, 2.0, 1.6] }); } catch (e) { /* optional */ }
    sfx('pop', 0.7, 0.8); sfx(pe.kind === 'gull' ? 'gull' : 'grunt', 0.5, 1.2);
    if (typeof game.dropGive === 'function') game.dropGive(pe.x, pe.z, 1);
    koT = 0;
    link(15);
    if (runState === 'live' && (runKind === 'pests' || runKind === 'mayhem')) count(1);
    try { game.events.emit('havoc:ko', { kind: pe.kind }); } catch (e) { /* bus */ }
  }
  function faceTo(pe, dx, dz, dt, rate) {
    const want = Math.atan2(dx, dz);
    let d = want - pe.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    pe.yaw += d * Math.min(1, dt * (rate || 8));
  }
  function pestTick(pe, dt, p) {
    pe.t += dt; pe.life += dt;
    const g = pe.g;
    if (pe.state === 'pose') {
      if (pe.kind === 'gull') { const w = g.userData.wings, f = Math.sin(pe.life * 11) * 0.6; w[0].rotation.z = f; w[1].rotation.z = -f; }
      g.rotation.set(0, pe.yaw, 0); g.position.set(pe.x, pe.y, pe.z);
      return;
    }
    if (pe.state === 'ko') {
      pe.x += pe.vx * dt; pe.z += pe.vz * dt; pe.ty -= 14 * dt; pe.y += pe.ty * dt;
      g.rotation.x += pe.spin * dt; g.rotation.z += pe.spin * 0.7 * dt;
      g.scale.multiplyScalar(pe.t > 0.8 ? 0.9 : 1);
      g.position.set(pe.x, pe.y, pe.z);
      if (pe.t > 1.3) pestOff(pe);
      return;
    }
    const dx = p.x - pe.x, dz = p.z - pe.z, dist = Math.hypot(dx, dz);
    if (dist > 70) { pestOff(pe); return; }
    if (pe.kind === 'gull') {
      const wings = g.userData.wings, flap = pe.state === 'dive' ? 0.1 : Math.sin(pe.life * 11) * 0.6;
      wings[0].rotation.z = flap; wings[1].rotation.z = -flap;
      if (pe.state === 'circle') {
        // circle the animal at 11 m, 8 m up, and close in; after 3-5 s, commit
        pe.orbitA += dt * 0.9;
        const tx = p.x + Math.sin(pe.orbitA) * 11, tz = p.z + Math.cos(pe.orbitA) * 11, ty = p.y + 8;
        pe.x += (tx - pe.x) * Math.min(1, dt * 1.6); pe.z += (tz - pe.z) * Math.min(1, dt * 1.6);
        pe.y += (ty - pe.y) * Math.min(1, dt * 1.2);
        faceTo(pe, tx - pe.x, tz - pe.z, dt, 5);
        if (pe.t > 3 + (pe.life % 2) && graceT <= 0) {
          pe.state = 'aim'; pe.t = 0;
          const v = capy().body ? capy().body.velocity : null;
          pe.tx = p.x + (v ? v.x * 0.5 : 0); pe.tz = p.z + (v ? v.z * 0.5 : 0);
          pe.ty = gy(pe.tx, pe.tz, p.y);
          if (pe.shadow) { pe.shadow.visible = true; pe.shadow.position.set(pe.tx, pe.ty + 0.05, pe.tz); }
          sfx('gull', 0.45, 1.1);
        }
      } else if (pe.state === 'aim') {
        // hang for 0.8 s, the shadow grows: that is the whole tell
        const k = clamp(pe.t / 0.8, 0, 1);
        if (pe.shadow) { pe.shadow.scale.setScalar(0.4 + k * 0.9); pe.shadow.material.opacity = 0.12 + k * 0.33; }
        faceTo(pe, pe.tx - pe.x, pe.tz - pe.z, dt, 10);
        if (pe.t > 0.8) { pe.state = 'dive'; pe.t = 0; }
      } else if (pe.state === 'dive') {
        const ddx = pe.tx - pe.x, ddz = pe.tz - pe.z, ddy = (pe.ty + 0.5) - pe.y;
        const dd = Math.hypot(ddx, ddy, ddz);
        const step = Math.min(dd, 17 * dt);
        if (dd > 0.01) { pe.x += ddx / dd * step; pe.y += ddy / dd * step; pe.z += ddz / dd * step; }
        pestHitsCapy(pe, 1.1);
        if (dd < 0.3 || pe.t > 2) { pe.state = 'climb'; pe.t = 0; if (pe.shadow) pe.shadow.visible = false; }
      } else if (pe.state === 'climb') {
        pe.y += 7 * dt;
        pe.x += Math.sin(pe.yaw) * 6 * dt; pe.z += Math.cos(pe.yaw) * 6 * dt;
        if (pe.t > 1.4) { pe.state = 'circle'; pe.t = 0; pe.orbitA = Math.atan2(pe.x - p.x, pe.z - p.z); }
      }
      g.rotation.set(pe.state === 'dive' ? 0.6 : 0, pe.yaw, 0);
      g.position.set(pe.x, pe.y, pe.z);
      return;
    }
    const legs = g.userData.legs;
    if (pe.kind === 'warden') {
      const tell = g.userData.tell, arm = g.userData.arm;
      if (pe.state === 'in') {
        faceTo(pe, dx, dz, dt, 6);
        if (dist > 8.5) {
          const s = 2.4;
          pe.x += dx / dist * s * dt; pe.z += dz / dist * s * dt;
          for (let i = 0; i < legs.length; i++) legs[i].rotation.x = Math.sin(pe.life * 7 + i * Math.PI) * 0.5;
        } else if (graceT <= 0) { pe.state = 'wind'; pe.t = 0; tell.visible = true; sfx('whistle', 0.4, 1.3); }
        arm.rotation.x = -0.3;
      } else if (pe.state === 'wind') {
        // a second with the net up and the bar over its head
        faceTo(pe, dx, dz, dt, 10);
        arm.rotation.x = -0.3 - clamp(pe.t, 0, 1) * 1.6;
        tell.scale.setScalar(1 + Math.sin(pe.t * 18) * 0.15);
        if (pe.t > 1.0) {
          pe.state = 'charge'; pe.t = 0; tell.visible = false;
          const d = dist || 1;
          pe.vx = dx / d * 8.5; pe.vz = dz / d * 8.5;
        }
      } else if (pe.state === 'charge') {
        pe.x += pe.vx * dt; pe.z += pe.vz * dt;
        arm.rotation.x = -1.9 + clamp(pe.t * 4, 0, 1) * 1.7;
        for (let i = 0; i < legs.length; i++) legs[i].rotation.x = Math.sin(pe.life * 16 + i * Math.PI) * 0.8;
        if (pestHitsCapy(pe, 1.2) || pe.t > 1.2) { pe.state = 'tired'; pe.t = 0; }
      } else if (pe.state === 'tired') {
        arm.rotation.x = -0.1;
        for (let i = 0; i < legs.length; i++) legs[i].rotation.x *= 0.9;
        if (pe.t > 1.6) pe.state = 'in';
      }
    } else {
      // THE DOG: bursts of 6.5 m/s (the animal sprints at 7.4), a pause, a
      // bark, and after twelve seconds it has had enough.
      if (pe.state === 'in' || pe.state === 'run') {
        faceTo(pe, dx, dz, dt, 9);
        const run = (pe.t % 2.5) < 1.5;
        const s = run ? 6.5 : 0;
        if (dist > 0.6) { pe.x += dx / dist * s * dt; pe.z += dz / dist * s * dt; }
        for (let i = 0; i < legs.length; i++) legs[i].rotation.x = run ? Math.sin(pe.life * 22 + (i % 2) * Math.PI + (i > 1 ? 1.2 : 0)) * 0.9 : 0;
        g.userData.tail.rotation.z = Math.sin(pe.life * 20) * 0.6;
        if (!run && (pe.t % 2.5) > 1.5 && (pe.t % 2.5) - dt <= 1.5) sfx('grunt', 0.4, 1.8);
        pestHitsCapy(pe, 0.95);
        if (pe.life > 12) { pe.state = 'leave'; pe.t = 0; }
      } else if (pe.state === 'leave') {
        faceTo(pe, -dx, -dz, dt, 6);
        pe.x -= dx / (dist || 1) * 4 * dt; pe.z -= dz / (dist || 1) * 4 * dt;
        for (let i = 0; i < legs.length; i++) legs[i].rotation.x = Math.sin(pe.life * 18 + (i % 2) * Math.PI) * 0.7;
        if (pe.t > 5) pestOff(pe);
      }
    }
    pe.y = gy(pe.x, pe.z, pe.y);
    g.rotation.set(0, pe.yaw, 0);
    g.position.set(pe.x, pe.y, pe.z);
  }
  function pestsTick(dt) {
    const c = capy(), p = c && c.position;
    if (!p) return;
    koT += dt;
    const want = runState === 'live' ? (runKind === 'pests' ? hvPEST_ALIVE_HUNT : hvPEST_ALIVE_RUN) : hvPEST_ALIVE;
    const hunt = runState === 'live' && runKind === 'pests';
    if (arriveT > hvARRIVE_QUIET && graceT <= 0 && pestAlive() < want && (koT > (hunt ? 2 : hvPEST_RESPAWN) || pestAlive() === 0 && koT > 6)) {
      const kinds = ['gull', 'warden', 'dog'];
      // one of each before any twice: count who is out
      let pick = kinds[Math.floor(rand(0, 3)) % 3];
      for (const k of kinds) { let has = false; for (const pe of pests) if (pe.on && pe.kind === k) has = true; if (!has) { pick = k; break; } }
      pestSpawn(pick);
      koT = hunt ? 0 : hvPEST_RESPAWN * 0.6;
    }
    for (const pe of pests) if (pe.on) pestTick(pe, dt, p);
  }

  // ===========================================================================
  // THE PIP (V)
  // ===========================================================================
  function fling() {
    if (!live() || !pestsOn() || pipCool > 0) return;
    const c = capy(), p = c && c.position;
    if (!p || !c.group) return;
    pipCool = hvPIP_COOL;
    const yaw = c.group.rotation.y;
    let fx = Math.sin(yaw), fz = Math.cos(yaw);
    // aim-assist: the nearest live pest inside 25 degrees of the nose and 32 m
    let best = null, bd = 32;
    for (const pe of pests) {
      if (!pe.on || pe.state === 'ko') continue;
      const dx = pe.x - p.x, dz = pe.z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.5 || d > bd) continue;
      const cos = (dx * fx + dz * fz) / d;
      if (cos < Math.cos(hvPIP_CONE)) continue;
      best = pe; bd = d;
    }
    const ox = p.x + fx * 0.5, oy = p.y + 0.6, oz = p.z + fz * 0.5;
    let vx = fx * hvPIP_SPEED, vz = fz * hvPIP_SPEED, vy = 2.5;
    if (best) {
      // lead it a little, and loft for the drop over the distance
      const tt = bd / hvPIP_SPEED;
      const tx = best.x + (best.state === 'charge' ? best.vx * tt : 0), tz = best.z + (best.state === 'charge' ? best.vz * tt : 0);
      const ty = best.y + (best.kind === 'gull' ? 0 : best.kind === 'warden' ? 1.1 : 0.45);
      const dx = tx - ox, dz = tz - oz, dh = Math.hypot(dx, dz) || 1;
      const t = dh / hvPIP_SPEED;
      vx = dx / t; vz = dz / t; vy = (ty - oy) / t + 0.5 * hvPIP_G * t;
    }
    for (const pp of pips) {
      if (pp.on) continue;
      pp.on = true; pp.t = 0; pp.x = ox; pp.y = oy; pp.z = oz; pp.vx = vx; pp.vy = vy; pp.vz = vz;
      break;
    }
    sfx('pop', 0.45, 1.35);
  }
  function pipsTick(dt) {
    let n = 0;
    for (const pp of pips) {
      if (!pp.on) continue;
      pp.t += dt;
      pp.vy -= hvPIP_G * dt;
      pp.x += pp.vx * dt; pp.y += pp.vy * dt; pp.z += pp.vz * dt;
      let hit = false;
      for (const pe of pests) {
        if (!pe.on || pe.state === 'ko') continue;
        const cy = pe.y + (pe.kind === 'gull' ? 0 : pe.kind === 'warden' ? 1.1 : 0.45);
        const dx = pp.x - pe.x, dy = pp.y - cy, dz = pp.z - pe.z;
        const r = pe.r + hvPIP_R;
        if (dx * dx + dz * dz < r * r && Math.abs(dy) < (pe.kind === 'warden' ? 1.2 : 0.8)) { ko(pe, pp.vx, pp.vz); hit = true; break; }
      }
      const gyv = gy(pp.x, pp.z, -1e9);
      if (hit || pp.t > hvPIP_LIFE || pp.y < gyv - 0.2) {
        if (!hit && pp.y < gyv + 0.3) { try { if (typeof game.sparks === 'function') game.sparks(pp.x, gyv + 0.1, pp.z, 5, { spd: 1.5, up: 1, life: 0.4, size: 0.12, rgb: [2.2, 1.8, 0.6] }); } catch (e) { /* optional */ } }
        pp.on = false; continue;
      }
      pipM.makeTranslation(pp.x, pp.y, pp.z);
      pipMesh.setMatrixAt(n++, pipM);
    }
    pipMesh.count = n;
    if (n) pipMesh.instanceMatrix.needsUpdate = true;
  }

  function heartsDraw(hit) {
    const svgs = heartsEl.querySelectorAll('svg');
    for (let i = 0; i < svgs.length; i++) svgs[i].classList.toggle('gone', i >= hearts);
    heartsEl.setAttribute('aria-label', hearts + (hearts === 1 ? ' heart' : ' hearts'));
    if (hit) { heartsEl.classList.remove('hit'); void heartsEl.offsetWidth; heartsEl.classList.add('hit'); }
  }
  function blink(dt) {
    const c = capy(), g = c && c.group;
    if (!g) return;
    if (invulnT > 0) {
      invulnT -= dt;
      const on = invulnT <= 0 || Math.floor(invulnT * 12) % 2 === 0;
      g.visible = on; blinkOn = true;
    } else if (blinkOn) { g.visible = true; blinkOn = false; }
  }

  // ===========================================================================
  // THE PROPS (U2g, noHavocProps): once per place per session, near the ring,
  // a small kit for the animal to ruin — two crates of yuzu that burst when
  // they go over, a barrel on the highest ground nearby, three water balloons
  // and a line of six deck chairs stood up like dominoes. props.js builds
  // them; they are the live chapter's runtime spawns, so they stay with it.
  // ===========================================================================
  const placedProps = Object.create(null);
  const placedList = [];   // this place's kit, for a probe
  function placeProps() {
    if (st.noHavocProps || placedProps[biome] || !game.physics || typeof game.physics.spawnProp !== 'function') return;
    const sp = game.biome && typeof game.biome.spawnOf === 'function' ? game.biome.spawnOf(biome) : null;
    if (!sp) return;
    placedProps[biome] = true;
    const y0 = gy(sp.x, sp.z, sp.y);
    const pts = [];
    for (let k = 0; k < 24 && pts.length < 12; k++) {
      const a = k * 2.399 + 0.6, rr = 8 + (k % 5) * 2.2;
      const x = sp.x + Math.sin(a) * rr, z = sp.z + Math.cos(a) * rr;
      const y = gy(x, z, NaN);
      if (y === y && Math.abs(y - y0) < 1.5 && Math.hypot(x - ringX, z - ringZ) > hvRING_R + 1.5) pts.push({ x: x, y: y, z: z });
    }
    if (pts.length < 6) return;
    placedList.length = 0;
    const spawn = (t, p, yaw) => { let pr = null; try { pr = game.physics.spawnProp(t, p.x, p.z, undefined, yaw || 0); } catch (e) { pr = null; } if (pr) placedList.push(pr); return pr; };
    spawn('yuzucrate', pts[0], 0.3); spawn('yuzucrate', pts[1], 1.1);
    // the barrel goes on the highest of the candidates, so it has somewhere to go
    let hi = pts[2];
    for (const p of pts) if (p.y > hi.y) hi = p;
    spawn('barrel', hi);
    spawn('balloon', pts[3]); spawn('balloon', pts[4]); spawn('balloon', pts[5]);
    // the dominoes: six deck chairs in a line, 0.8 m apart, all facing along it
    const d0 = pts[6] || pts[0], yaw = Math.atan2(sp.x - d0.x, sp.z - d0.z) + Math.PI / 2;
    for (let i = 0; i < 6; i++) {
      const x = d0.x + Math.sin(yaw) * i * 0.8, z = d0.z + Math.cos(yaw) * i * 0.8;
      spawn('deckchair', { x: x, z: z }, yaw);
    }
  }
  // a crate that goes over is six live yuzu on the ground
  game.events.on('prop:impact', function (e) {
    if (!e || !e.spill || !e.prop || e.prop.type !== 'yuzucrate' || !free()) return;
    const p = e.position;
    for (let i = 0; i < 6; i++) {
      const a = i * 1.047 + 0.3;
      if (typeof game.dropGive === 'function') game.dropGive(p.x + Math.sin(a) * 1.1, p.z + Math.cos(a) * 1.1, i === 0 ? 3 : 1);
    }
    try { if (typeof game.sparks === 'function') game.sparks(p.x, p.y + 0.4, p.z, 22, { spd: 3.5, up: 2, grav: 8, life: 0.8, size: 0.2, rgb: [2.4, 2.0, 0.5] }); } catch (err) { /* optional */ }
    sfx('pop', 0.7, 1.0);
  });
  // a balloon that breaks is a splash where it broke
  game.events.on('prop:destroy', function (e) {
    const pr = e && e.prop;
    if (!pr || pr.type !== 'balloon' || !pr.body || !free()) return;
    const b = pr.body.position;
    try { if (typeof game.sparks === 'function') game.sparks(b.x, b.y + 0.2, b.z, 26, { spd: 4, up: 2.5, grav: 12, life: 0.6, size: 0.18, rgb: [1.2, 1.9, 2.4] }); } catch (err) { /* optional */ }
    try { game.events.emit('prop:water', { prop: pr, position: { x: b.x, y: b.y, z: b.z } }); } catch (err) { /* bus */ }
  });

  // ===========================================================================
  // THE EVENTS
  // ===========================================================================
  const KNOCK = { tip: 1, bang: 1, break: 1 }, SPLASH = { spill: 1, water: 1 }, THEFT = { theft: 1, hat: 1 };
  game.events.on('capy:mischief', function (e) {
    if (!e || !free() || !live()) return;
    link();
    if (runState !== 'live') return;
    const k = e.kind;
    if (runKind === 'knock' && KNOCK[k]) count(1);
    else if (runKind === 'splash' && SPLASH[k]) count(1);
    else if (runKind === 'theft' && THEFT[k]) count(1);
    else if (runKind === 'mayhem') count(1);
  });
  game.events.on('yuzu:got', function () {
    if (!free() || !live()) return;
    link(5);
    if (runState === 'live' && runKind === 'rain') count(1);
  });
  function un(e) { return (e && e.npc) || e; }
  game.events.on('npc:chase', function (e) { if (!free()) return; chasers++; if (live()) { link(); if (runState === 'live' && runKind === 'mayhem') count(1); } void un(e); });
  const unchase = function () { chasers = Math.max(0, chasers - 1); };
  game.events.on('npc:gaveup', unchase);
  game.events.on('npc:caught', unchase);
  game.events.on('npc:lost', unchase);

  addEventListener('keydown', function (e) {
    if (e.repeat) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.code === 'KeyV') { if (live()) fling(); return; }
    if ((e.code === 'Enter' || e.code === 'NumpadEnter') && runState === 'result' && live()) {
      e.preventDefault(); e.stopPropagation();
      cardEl.classList.remove('show');
      runStart();
    }
  }, true);

  // ===========================================================================
  // THE FRAME
  // ===========================================================================
  let padPrev = false;
  function padTick() {
    // RB (button 5) flicks a pip on a pad
    let down = false;
    try {
      const pads = navigator.getGamepads ? navigator.getGamepads() : null;
      if (pads) for (const pd of pads) if (pd && pd.buttons && pd.buttons[5] && pd.buttons[5].pressed) down = true;
    } catch (e) { down = false; }
    if (down && !padPrev) fling();
    padPrev = down;
  }
  function hideAll() {
    root.visible = false;
    heartsEl.classList.remove('show'); streakEl.classList.remove('show'); runEl.classList.remove('show');
    tagEl.classList.remove('show'); flingEl.classList.remove('show');
  }
  // ONE COMPILE, UP FRONT. Every pest, the ring and the pip are programs the
  // chapter's own warm pass never sees (they belong to no chapter), so the
  // first gull would link its shaders on the frame it appeared: a stall at the
  // worst moment. One of each is made, shown for one compile, and hidden.
  let warmed = false;
  function warm() {
    warmed = true;
    try {
      for (const k of ['gull', 'warden', 'dog']) { let has = false; for (const pe of pests) if (pe.kind === k) has = true; if (!has) pestMake(k); }
      const was = [];
      root.traverse(function (o) { was.push([o, o.visible]); o.visible = true; });
      if (game.renderer && game.camera && typeof game.renderer.compile === 'function') game.renderer.compile(root, game.camera);
      for (const w of was) w[0].visible = w[1];
    } catch (e) { /* the draw compiles on first use, as before */ }
  }
  function reset() {
    streakBreak(true); runCancel(); pestsClear();
    for (const pp of pips) pp.on = false; pipMesh.count = 0;
    hearts = hvHEARTS; invulnT = 0; graceT = 0; chasers = 0; koT = 0; arriveT = 0;
    heartsDraw(false);
    const c = capy(); if (c && c.group && blinkOn) { c.group.visible = true; blinkOn = false; }
  }
  const tagV = new THREE.Vector3();
  function tagTick() {
    const cam = game.camera, canvas = game.renderer && game.renderer.domElement;
    const c = capy(), p = c && c.position;
    if (!ring.visible || !cam || !canvas || !p || Math.hypot(p.x - ringX, p.z - ringZ) > 40) { tagEl.classList.remove('show'); return; }
    tagV.set(ringX, ringY + 3.2, ringZ).project(cam);
    if (tagV.z > 1) { tagEl.classList.remove('show'); return; }
    const r = canvas.getBoundingClientRect();
    tagEl.style.left = (r.left + (tagV.x * 0.5 + 0.5) * r.width).toFixed(1) + 'px';
    tagEl.style.top = (r.top + (0.5 - tagV.y * 0.5) * r.height).toFixed(1) + 'px';
    tagEl.textContent = 'HAVOC · ' + hvKINDS[kindFor(biome)].name;
    tagEl.classList.add('show');
  }

  function update(dt) {
    if (!(dt > 0)) return;
    const b = (game.biome && game.biome.current) || '';
    if (b !== biome) { biome = b; reset(); if (free()) placeRing(); }
    if (!free() || st.started === false) { if (root.visible || heartsEl.classList.contains('show')) { reset(); hideAll(); } return; }
    if (!live()) {
      // the world is not the player's (a menu, a crossing, a ride): freeze,
      // and keep the pests and the ring out of any shot that is not play
      root.visible = false; tagEl.classList.remove('show'); flingEl.classList.remove('show');
      return;
    }
    if (!ringOn) placeRing();
    if (arriveT > 1 && !placedProps[biome]) placeProps();
    if (!warmed) warm();
    root.visible = true;
    arriveT += dt;
    if (graceT > 0) graceT -= dt;
    if (pipCool > 0) pipCool -= dt;
    // the streak's window, drawn as a draining bar
    if (links > 0) {
      linkT -= dt;
      streakFill.style.width = (clamp(linkT / hvLINK_WIN, 0, 1) * 100).toFixed(1) + '%';
      if (linkT <= 0) streakBreak(false);
    } else if (cashT > 0) {
      cashT -= dt;
      if (cashT <= 0) streakEl.classList.remove('show', 'cash');
    }
    runTick(dt);
    const hvPests = pestsOn();
    heartsEl.classList.toggle('show', hvPests && arriveT > 2);
    flingEl.classList.toggle('show', hvPests && touch);
    if (hvPests) { pestsTick(dt); pipsTick(dt); padTick(); blink(dt); }
    else { pestsClear(); pipMesh.count = 0; }
    tagTick();
  }

  // ---- A PROBE'S VIEW (qa/ten-u1a-havoc.mjs) --------------------------------
  game.havoc = {
    hearts: function () { return hearts; },
    audit: function () {
      return {
        live: live(), links: links, mult: Math.min(hvMULT_MAX, links), chainPts: chainPts, bestMult: bestMult,
        run: runState, kind: runKind, count: runCount, t: runT, medal: runMedal, score: runScore, best: runBest,
        ring: ringOn ? { x: ringX, y: ringY, z: ringZ, visible: ring.visible } : null,
        hearts: hearts, invuln: invulnT, grace: graceT, chasers: chasers,
        pests: pests.filter(function (pe) { return pe.on; }).map(function (pe) { return { kind: pe.kind, state: pe.state, x: +pe.x.toFixed(2), y: +pe.y.toFixed(2), z: +pe.z.toFixed(2) }; }),
        pips: pips.filter(function (pp) { return pp.on; }).length,
        props: placedList.map(function (p) { return p.type; }),
      };
    },
    fling: fling,
    placed: function () { return placedList; },
    // test doors: start a run where the animal stands; put a pest in front of it
    qaStart: function (kind) { if (kind && hvKINDS[kind]) kindAt[biome] = hvORDER.indexOf(kind); runStart(); },
    qaPest: function (kind, dist) {
      const c = capy(), p = c && c.position; if (!p || !c.group) return false;
      const yaw = c.group.rotation.y, d = dist || 10;
      pestSpawn(kind || 'warden');
      const pe = pests[pests.length - 1];
      for (const q of pests) if (q.on && q.kind === (kind || 'warden')) { q.x = p.x + Math.sin(yaw) * d; q.z = p.z + Math.cos(yaw) * d;
        q.y = kind === 'gull' ? p.y + 8 : gy(q.x, q.z, p.y); q.state = kind === 'gull' ? 'circle' : 'in'; q.t = 0; return true; }
      return !!pe;
    },
    // a pest stood still where a photograph wants it, facing the lens
    qaPose: function (kind, x, z, yUp) {
      pestSpawn(kind);
      for (const q of pests) if (q.on && q.kind === kind && q.state !== 'pose') {
        q.x = x; q.z = z; q.y = gy(x, z, 0) + (yUp || 0); q.state = 'pose';
        const cam = game.camera; q.yaw = cam ? Math.atan2(cam.position.x - x, cam.position.z - z) : 0;
        if (kind === 'warden' && q.g.userData.tell) q.g.userData.tell.visible = true;
        return true;
      }
      return false;
    },
    qaShadow: function (x, z) { for (const q of pests) if (q.on && q.kind === 'gull' && q.shadow) { q.shadow.visible = true; q.shadow.position.set(x, gy(x, z, 0) + 0.05, z); q.shadow.scale.setScalar(1.2); q.shadow.material.opacity = 0.4; return true; } return false; },
    qaQuiet: function () { arriveT = hvARRIVE_QUIET + 1; graceT = 0; koT = hvPEST_RESPAWN + 1; },
  };

  return { update: update };
}
