import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PALETTE, mat, rand, randInt, clamp, damp, lerp, grain, grainOwn, swayMesh, makeMerger, makeMover } from './shared.js';

// ===========================================================================
// CHAPTER 8 — MARRAKECH AND THE ERG
//
// Iceland is the emptiest place in the game. This is deliberately the next one
// you go to, because the two halves of chapter 8 are the densest and then the
// emptiest thing in it, forty minutes apart, and that contrast is the chapter.
//
// Three things here that exist nowhere else:
//
//  1. A TASK YOU CAN LOSE. Everything in seven chapters is a thing you keep
//     doing until it works. `souk-escape` is a thing that is done TO YOU until
//     you get out of it: rob the square and six traders come after you, and the
//     only tool you have is a covered maze that they know better than you do.
//     It is third on the list because a chapter should show its new verb early.
//
//  2. WEATHER. Not a mood — a mechanic. The sandstorm takes the visibility down
//     to nothing, leans on the capybara hard enough to move it, and the task is
//     simply to still be standing in the erg when it passes. Nothing else in
//     this game has ever pushed back.
//
//  3. THE SUN GOES DOWN INSIDE THE CHAPTER. The storm arrives in a white noon
//     and leaves in a red evening, and the last thing on the list happens at a
//     fire, in the dark, with a band round it. No other biome changes the time
//     of day while you are standing in it.
//
// West to east, because that is the only direction anything here goes:
//
//   x -70..70   THE MEDINA. Jemaa el-Fnaa in the middle (spawn), the Koutoubia
//               over the west end, and the covered souk filling the north.
//   x 78        Bab Agnaou — the gate. Everything past it is out of town.
//   x 92..150   the palmeraie: irrigation, date palms, mud walls.
//   x 150..180  the hamada. Stone, and then no stone.
//   x 180..280  THE GREAT DUNE, a hundred metres of windward face rising 42 m
//   x 280..340  and the lee side, which is where the world ends.
//               the camp sits at (192, 20), in front of it.
//
// Everything is prefixed `sah` (contract: the bundler flattens every module
// into one scope).
// ===========================================================================

// ---------------------------------------------------------------- geography --
const sahSPAWN   = { x: 0, y: 1.4, z: 8 };
const sahSQ_X0 = -26, sahSQ_X1 = 26, sahSQ_Z0 = -14, sahSQ_Z1 = 22;   // Jemaa el-Fnaa
const sahKOUTOUBIA = { x: -52, z: 4, h: 38 };
const sahCART    = { x: 9, z: 1 };                    // the orange juice cart
const sahSNAKE   = { x: -10, z: 13 };                 // and the basket
const sahGATE    = { x: 78, z: 14 };                  // Bab Agnaou
// The half-width of the opening in the medina wall, and the arch's radius.
// EVERYTHING about the gate is derived from these two — see sahBuildSquare for
// what happened the one time the wall and the arch were authored separately.
const sahGATE_HW  = 4.9;
const sahGATE_OUT = sahGATE_HW + 4.8;                 // outer face of the piers
// the souk: a grid of eight by four blocks with three-metre alleys between them
const sahSOUK_X0 = -48, sahSOUK_Z0 = -62;
// The alley width is CELL - BLOCK. At 8.6 that was 3.4 m, which is very close
// to the real thing and about a metre too narrow for a third-person camera —
// an instrumented run spent most of the chase wedged against a corner. 7.2
// gives 4.8 m, still a squeeze, and the roofs overhead do the rest of the work
// of making it feel tight.
const sahSOUK_NX = 8, sahSOUK_NZ = 4, sahSOUK_CELL = 12, sahSOUK_BLOCK = 7.2;
const sahCAMP    = { x: 182, z: 20 };
const sahDUNE_X  = 280;             // the crest
const sahDUNE_W  = 88;              // windward run, west of the crest
const sahDUNE_L  = 58;              // the lee slipface, east of it
const sahDUNE_H  = 42;
const sahDUNE_LIP = 0.9;            // m — the avalanche lobes on the slipface
const sahDUNE_Z  = 10, sahDUNE_HZ = 78;               // where the ridge runs, and how long
const sahERG_X   = 165;             // east of this you are in the erg proper

// --- the chase ---------------------------------------------------------------
// Six of them. Slower than a capybara at a dead run and faster than one that
// stops to think, which is the only interesting place to put a pursuer.
const sahPURSUER_N = 6;
// SLOWER THAN A CAPYBARA AT A DEAD RUN (7.4) AND FASTER THAN ONE THAT WALKS.
// Measured at 6.4 first, which sounds like the same thing and is not: stamina
// means nobody actually runs flat out for a hundred metres, so the real gap was
// about half a metre a second and the souk stopped being a chance and became a
// countdown.
const sahPUR_SPEED = 5.9;
const sahPUR_CATCH = 1.5;           // m
// A chase needs a BEAT before it starts. Six traders standing ten metres away
// who begin sprinting on the same frame as the theft is not a chase, it is a
// verdict — the instrumented run was caught in 1.4 s from a standing start,
// every time, and there was nothing the player could have done about it. They
// now look up first, from further away, which is what people do.
const sahCHASE_DELAY = 1.3;         // s of them realising
// A GRAZE IS NOT AN ARREST. Instant capture on contact means any moment the
// capybara is not moving — a corner taken badly, a doorway, a half second of
// deciding — ends the run, and six men converging from twelve metres give you
// about two seconds of that per chase. They have to keep a hand on it.
const sahCATCH_HOLD = 0.45;         // s inside the catch radius
// LOSING THEM IS ABOUT SIGHT, NOT DISTANCE. The first cut wanted 22 m AND no
// line of sight, which meant hiding round a corner did nothing at all and the
// only way out was to be FASTER than six men — in a maze, which is the one
// place being faster is worth least. Now it is: nobody can see you, and nobody
// is breathing down your neck.
const sahLOSE_NEAR = 8;             // m — closer than this, hidden or not
// 3.0 WAS UNWINNABLE, AND THE REASON IS STAMINA. A scripted escape opened a
// 31 m gap deep in the souk and was still caught at 0.5 m: the run blows at
// 10.0 s and drops the animal to 7.4 m/s — above the pursuers' 5.9 — but three
// unbroken seconds out of sight is longer than any corner in the souk buys you
// once you are walking. Two seconds is one corner, which is what the chase is
// about. The pursuers' speed is deliberately NOT the thing lowered: chasing the
// last SEEN position is the good part of this set piece.
const sahLOSE_TIME = 2.0;           // s of it, and you are gone
const sahSIGHT = 34;                // m — how far a trader can pick you out at all
const sahCHASE_REARM = 7.0;         // s before they will rise to it again

// --- the storm ---------------------------------------------------------------
const sahSTORM_WARN = 22;           // s in the erg before you can see it coming
const sahSTORM_BUILD = 7;           // s of it arriving
const sahSTORM_HOLD = 20;           // s of it being here
const sahSTORM_FADE = 9;            // s of it leaving
const sahSTORM_TASK = 11;           // s standing in it that the task wants
const sahWIND_F  = 6.2;             // m/s of lean at full storm

const sahSURF_TOP  = 272;           // x east of which arms the run down the dune
const sahSURF_END  = 202;           // and west of which finishes it
// The slip band down the middle of the dune, as a fraction of the ridge's
// half-length. Outside it the sand is firm and you can walk up — see
// sahGroundSlip, and the whole reason the band exists.
const sahSURF_BAND = 0.70;
const sahSURF_SLIP = 0.72;
const sahSURF_STALL_V = 3.2;
const sahSURF_STALL_T = 1.8;

const sahCARAVAN_N = 5;
const sahDUST_N = 150;
const sahSTAR_N = 200;
const sahPALM_N = 90;

// ------------------------------------------------------------------ scratch --
const sahV3 = new THREE.Vector3();
const sahQ  = new THREE.Quaternion();
const sahEu = new THREE.Euler();
const sahSc = new THREE.Vector3();
const sahM  = new THREE.Matrix4();

// ---------------------------------------------------------------- module -----
let sahGame = null;
let sahBuilt = false;
let sahRoot = null;
let sahTime = 0;

let sahDust = null;
const sahDustData = new Float32Array(sahDUST_N * 8);      // x,y,z,vx,vy,vz,life,scale
let sahStars = null, sahStarMat = null;
let sahStormWall = null;
let sahPursuerMesh = null, sahPursuerHeads = null;
// x, z, homeX, homeZ, yaw, state, lastSeenX, lastSeenZ
const sahPurData = new Float32Array(sahPURSUER_N * 8);
// One latch per trader for THE NEAR MISS (see sahUpdateChase), cleared the
// moment they see you again and on every fresh chase.
// ---- M3: WHICH PEOPLE ARE COVER ------------------------------------------
// The index range sahBuildSouk wrote into the shared people roster — the stall
// fronts and the alley walkers, which is everybody inside the maze. Nothing
// else recorded a subset of that roster except sahCarPeople; this is the
// second, and it exists because sahLineOfSight cannot afford to sweep all two
// hundred and fifty. Set at build, and zero until then.
let sahSoukPpl0 = 0, sahSoukPplN = 0;
const sahLOS_BODY  = 0.38;              // m — see sahLineOfSight
const sahLOS_BODY2 = sahLOS_BODY * sahLOS_BODY;
const sahLOS_END   = 1.30;              // m of either end that is not cover
const sahPurMiss = new Uint8Array(sahPURSUER_N);
// ---- M2: WHO CAN SEE IT, AND WHO HAS BEEN TOLD ---------------------------
// `sahPurTellSeen` is written by the sense loop each frame (canSee), and
// `sahPurTell` is the SNAPSHOT of it the relay pass reads, so a shout cannot
// be relayed on by the person who has just heard it in the same frame.
const sahPurTellSeen = new Uint8Array(sahPURSUER_N);
const sahPurTell = new Uint8Array(sahPURSUER_N);
let sahPurTold = 0;
let sahTellPairs = 0, sahTellNear = 0, sahTellLos = 0;   // M2 instrument only              // how many hand-offs this chase — for the toast
const sahPUR_TELL_R = 20;        // m. A shout across a souk lane, not a radio.
let sahMissN = 0;
const sahPUR_MISS_R = 4.2;     // m of "and he did not look"
let sahCamelMesh = null, sahCamelLegs = null;
// The three people travelling with the caravan, by index into sahPplData.
const sahCarPeople = [];
let sahCaravanBody = null, sahCarPX = 0, sahCarPY = 0, sahCarPZ = 0;
// THE SADDLE'S OWN GROUND SPEED — see carryFrame() at the foot of this file.
const sahCarFrame = { x: 0, z: 0 };
let sahCartGroup = null, sahBasketGroup = null;
// The ten people who live here, kept so addExchange can pair them up. See
// THE PEOPLE WHO LIVE HERE at the foot of sahBuild.
let sahLocCart = null, sahLocSnake = null, sahLocAcro = null, sahLocHalqa = null;
let sahLocDyer = null, sahLocWater = null, sahLocMaalem = null, sahLocGate = null;
let sahLocPalm = null, sahLocDune = null;
let sahStallLamps = null;      // the fourteen lamps over the food stalls
let sahCobraGroup = null;      // the cobra that lives in the basket you sit in
let sahCobraUp = 0;            // 0..1 of the way out of it
let sahBasketSit = 0;          // s the animal has been inside the ring
let sahFireGroup = null, sahFireLight = 0, sahFirePool = null;
let sahSoukRoofs = null;
let sahSeguia = null;

// --- state ---
// x, y, z of every brazier on the square, filled in by sahBuildSquare.
const sahBRAZIER = [];
let sahSmokeMesh = null, sahSmokeMat = null;
const sahSMOKE_PER = 5;            // puffs in the air over each brazier at once
const sahSMOKE_RISE = 5.4;         // m a puff climbs before it is gone
// The three halqa rings: x, z, radius. sahHalqaBeat is where each one is in
// its own sentence this frame, written once per frame by sahUpdatePeople.
const sahHALQA = [];
const sahHalqaBeat = [0, 0, 0];

let sahChase = 0;                  // 0 idle, 1 running, 2 cooling down
let sahChaseT = 0, sahLoseT = 0, sahRearm = 0, sahChaseDelay = 0;
let sahStormPhase = 0, sahStormT = 0, sahStorm = 0, sahErgT = 0, sahStormStood = 0;
let sahDuskOn = false;              // the evening, once it has come, does not go

let sahDusk = 0;
let sahCaravanT = 0, sahRiding = false;
let sahSurfT = -1, sahSurfStall = 0, sahSurfBest = 0;
// ---- AIR (W1). D4.6 gave the face three lobes to leave the ground on and
// nothing counted it: the best thing that can happen on the run went by as
// a slightly quieter half-second. Time off the sand is accumulated per hop,
// said on the landing when it was worth saying, and the run's biggest hop
// goes on the signpost beside the speed.
let sahSurfAir = 0, sahSurfAirBest = 0, sahSurfAirWas = false;
// The dune BOOMS while the sand is moving — see sahUpdateSurf.
let sahBoom = 0, sahBoomT = 0;
let sahCartDone = false, sahSnakeDone = false, sahEscapeDone = false;
let sahCaravanDone = false, sahSurfDone = false, sahStormDone = false, sahFireDone = false;
let sahFireTakeover = 0;
let sahChaseNear = 999;
let sahCatchT = 0;

// ============================================================== helpers ======
function sahXform(px, py, pz, rx, ry, rz, sx, sy, sz) {
  sahEu.set(rx, ry, rz, 'YXZ');
  sahQ.setFromEuler(sahEu);
  sahV3.set(px, py, pz);
  sahSc.set(sx, sy, sz);
  sahM.compose(sahV3, sahQ, sahSc);
  return sahM;
}

const sahG = { box: null, cyl6: null, cyl8: null, cyl4: null, cone6: null, cone4: null, sph6: null, tet: null, quad: null };
function sahInitGeos() {
  if (sahG.box) return;
  sahG.box = new THREE.BoxGeometry(1, 1, 1);
  sahG.cyl6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
  sahG.cyl8 = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
  sahG.cyl4 = new THREE.CylinderGeometry(0.5, 0.5, 1, 4);
  sahG.cone6 = new THREE.ConeGeometry(0.5, 1, 6);
  sahG.cone4 = new THREE.ConeGeometry(0.5, 1, 4);
  sahG.sph6 = new THREE.SphereGeometry(0.5, 6, 4);
  sahG.tet = new THREE.TetrahedronGeometry(0.5);
  // A FLAT QUAD LYING IN XZ, and it exists for one thing: the ripple field.
  // Two thousand three hundred sand ripples as boxes is 28,000 triangles —
  // twenty per cent of the chapter, and the chapter was over the 130k hard
  // limit at 143,564. A ripple is a facet of the ground seen from above and
  // never from below or from the side, so eleven twelfths of a box is spent
  // drawing faces that cannot be seen. 4,680 triangles instead.
  sahG.quad = new THREE.PlaneGeometry(1, 1);
  sahG.quad.rotateX(-Math.PI / 2);
  // AND AN OPEN CYLINDER. A palm trunk has a crown of dead leaf-bases sitting
  // on top of it and a metre of sand round the foot: neither cap is ever seen,
  // and 180 trunk instances were spending a third of their triangles on two
  // discs nobody can look at. 12 triangles instead of 24.
  sahG.cylO6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6, 1, true);
  // AND A CHEAP SPHERE. Smoke, dust and a wall of airborne sand are never
  // resolved as a shape at all — they are a value with a soft edge — so they do
  // not get the 36-triangle six-by-four. 20 triangles, and at these opacities
  // the difference is not visible in a still frame at 1280 x 760.
  sahG.sphLo = new THREE.SphereGeometry(0.5, 5, 3);
}

/**
 * THE TRAVERSE THAT UNDOES EVERY `castShadow = false` IN THIS FILE.
 *
 * `registerShadowTarget` is the last line of the build and systems.js answers it
 * with `o3d.traverse(n => { if (n.isMesh) n.castShadow = true })` — so every
 * `castShadow = false` written anywhere above is silently reverted four lines
 * later. Measured here: the 150 airborne dust spheres, the fire, the star field
 * and the 4,680 sand-ripple quads (all explicitly authored NOT to cast) were in
 * the shadow pass, which is 125,616 of the chapter's 126,820 triangles rendered
 * twice. Rio and Iceland have both had this; Marrakech had not.
 *
 * Two rules. Anything see-through is a GHOST and casts nothing — a hard grey
 * hexagon where the smoke is, which is exactly what the hot spring in chapter 7
 * photographed as. And anything flagged `userData.noShadow` is ground detail:
 * a ripple is a facet OF the dune, so a shadow from one falls on the dune it is
 * part of and comes back as dirt.
 */
function sahNoShadowOnGhosts(root) {
  root.traverse(function (n) {
    if (!n.isMesh && !n.isInstancedMesh) return;
    if (n.userData && n.userData.noShadow) { n.castShadow = false; return; }
    const m = Array.isArray(n.material) ? n.material[0] : n.material;
    if (!m) return;
    if (m.transparent || m.depthWrite === false || m.blending === THREE.AdditiveBlending) {
      n.castShadow = false;
    }
  });
}

// ============================================================ THE HANDCART ===
/**
 * SOMETHING ON WHEELS IN THE MEDINA.
 *
 * The chapter has a hundred and seventy-odd people in it and the only thing
 * that moves across the ground is a camel string eighty metres east of the
 * gate. Jemaa el-Fnaa's defining quality is people ON THEIR WAY somewhere,
 * and a handcart is what everything in that souk is moved on.
 *
 * Along the south edge of the square, which is open ground: the stalls are
 * north of it and the acrobats' mat is at z 20.
 */
let sahSquareBed = null;   // M13: the square's own floor of sound
const sahCART_X = 30;         // the wrap, past both ends of the square
const sahCART_V = 1.5;        // m/s — a man pushing a barrow
let sahCart = null, sahCartMover = null;

function sahBuildHandcart(game, root) {
  sahCart = new THREE.Group();
  const M = sahMerger();
  M.box(0, 0.62, 0, 1.30, 0.10, 2.00, PALETTE.sahCedar);
  for (let sgn = -1; sgn <= 1; sgn += 2)
    M.box(sgn * 0.63, 0.80, 0, 0.06, 0.30, 1.96, PALETTE.sahCedar);
  M.box(0, 0.86, -0.30, 1.10, 0.42, 1.10, PALETTE.sahOrange);   // the load
  for (let sgn = -1; sgn <= 1; sgn += 2)
    M.cyl(sgn * 0.66, 0.40, -0.20, 0.40, 0.09, PALETTE.sahCedarDk, 0, 0, Math.PI / 2, 8);
  for (let sgn = -1; sgn <= 1; sgn += 2)
    M.box(sgn * 0.44, 0.74, 1.30, 0.06, 0.06, 1.20, PALETTE.sahCedar);
  // the man on the handles
  M.box(0, 0.92, 2.05, 0.44, 0.66, 0.28, PALETTE.cloth5);
  M.box(0, 1.36, 2.05, 0.24, 0.26, 0.23, PALETTE.skin3);
  const mesh = new THREE.Mesh(M.build(), sahVC());
  mesh.castShadow = true;
  sahCart.add(mesh);
  root.add(sahCart);
  const cb = new CANNON.Body({
    mass: 0, type: CANNON.Body.KINEMATIC,
    material: (game.mats && game.mats.ground) || undefined,
  });
  cb.addShape(new CANNON.Box(new CANNON.Vec3(0.7, 0.5, 1.2)),
              new CANNON.Vec3(0, 0.62, 0));
  cb.allowSleep = false;
  sahSyncBody(cb);
  game.world.addBody(cb);

  const zRun = sahSQ_Z0 + 3.5;
  const span = sahCART_X * 2;
  sahCartMover = makeMover({
    body: cb, group: sahCart,
    at: function (t) {
      const u = ((t * sahCART_V) % span + span) % span;
      const x = -sahCART_X + u;
      return { x: x, z: zRun, y: sahTerrain(x, zRun), yaw: Math.PI * 0.5 };
    },
  });
}

function sahMerger() {
  return makeMerger(sahG, {
    xform: sahXform, cylSegs: [4, 8], coneSegs: [4], sphSegs: [], normals: 'recompute', jitter: 0.058,
  });
}
/**
 * EVERY SURFACE IN THIS CHAPTER WAS ONE FLAT VALUE.
 *
 * See grain() in shared.js. The world here is one enormous mesh in a handful of
 * colours and the camera sits six metres above it: without this, two thirds of
 * every frame is a single unbroken value, which is the difference between a
 * stylised world and an unfinished one. It costs no draw call, no triangle and
 * no memory — it is ten instructions in a fragment shader — and it is applied
 * at two strengths: a whisper over everything the biome merges, and a real one
 * on the ground, which is the surface the player actually spends the chapter
 * looking at.
 */
function sahVC() {
  return grain(mat(0xffffff, { vertexColors: true }),
               { scale: 0.4, amount: 0.09, warp: 0.55, near: 0.30, nearPale: 0.60, nearScale: 9, contact: 1 });
}
/** The same thing at ground strength, and flat: the ground is horizontal,
 *  so it wants no vertical shear in the sample at all. */
function sahVCG() {
  return grain(mat(0xffffff, { vertexColors: true }),
               { scale: 0.45, amount: 0.15, warp: 0, near: 0.48, nearPale: 0.55, nearScale: 8, contact: 1, broad: 0.12, broadM: 20 });
}
function sahPush9(l, px, py, pz, rx, ry, rz, sx, sy, sz) { l.push(px, py, pz, rx, ry, rz, sx, sy, sz); }
function sahInstance(root, geo, color, list, cast, recv, opts) {
  const n = list.length / 9;
  if (n < 1) return null;
  const im = new THREE.InstancedMesh(geo, opts ? mat(color, opts) : mat(color), n);
  for (let i = 0; i < n; i++) {
    const o = i * 9;
    im.setMatrixAt(i, sahXform(list[o], list[o + 1], list[o + 2], list[o + 3], list[o + 4],
                               list[o + 5], list[o + 6], list[o + 7], list[o + 8]));
  }
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  im.castShadow = !!cast;
  im.receiveShadow = !!recv;
  root.add(im);
  return im;
}
function sahStaticBox(game, x, y, z, sx, sy, sz, ry) {
  const b = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
  b.addShape(new CANNON.Box(new CANNON.Vec3(sx * 0.5, sy * 0.5, sz * 0.5)));
  b.position.set(x, y, z);
  if (ry) b.quaternion.setFromEuler(0, ry, 0);
  sahSyncBody(b);
  game.world.addBody(b);
  return b;
}
/**
 * ONE BODY PER ROW OF THINGS.
 *
 * `sahStaticBox` spends a whole `CANNON.Body` per box and Marrakech was at 122
 * against a hard 130 — and it was not one big thing, it was 32 souk blocks, 14
 * food stalls, 12 wall segments, 14 pisé walls, 8 sluice gates and 9 arcade
 * piers. A CANNON.Body takes any number of shapes with offsets and a compound
 * body is ONE broadphase entry, so a whole terrace of buildings costs what a
 * bollard used to. Same fix Rio and Iceland took (rioStaticGroup); the shapes
 * are identical, so nothing about what is solid changes.
 *
 * Returns a collector: `.add(x, y, z, sx, sy, sz, ry)` in FULL extents, then
 * `.done()`.
 */
function sahStaticGroup(game) {
  const b = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
  const q = new CANNON.Quaternion();
  const G = {
    n: 0,
    add(x, y, z, sx, sy, sz, ry) {
      const s = new CANNON.Box(new CANNON.Vec3(sx * 0.5, sy * 0.5, sz * 0.5));
      if (ry) { q.setFromEuler(0, ry, 0); b.addShape(s, new CANNON.Vec3(x, y, z), q.clone()); }
      else b.addShape(s, new CANNON.Vec3(x, y, z));
      G.n++;
      return G;
    },
    done() {
      if (!G.n) return null;
      sahSyncBody(b);
      game.world.addBody(b);
      return b;
    },
  };
  return G;
}
function sahSyncBody(b) {
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
  b.previousQuaternion.copy(b.quaternion);
  b.interpolatedQuaternion.copy(b.quaternion);
}

// ================================================================= TERRAIN ==
/**
 * The medina is flat, because a city built on an alluvial fan is, and because
 * a maze on a slope is unreadable. Everything east of the palmeraie is sand,
 * and sand has ONE shape: a long gentle windward face and a short steep lee
 * face at the angle of repose, which is 34 degrees and not negotiable.
 *
 * The great dune is written as those two faces explicitly rather than as a
 * bump, because the whole surf task depends on the windward gradient being a
 * constant twenty-three degrees for a hundred metres. A cosine dome would give
 * a slide that is flat at the top, terrifying in the middle and flat again at
 * the bottom, which is not a run, it is a bell curve.
 */
/**
 * WHERE THE BRINK IS, AT THIS z.
 *
 * The crest was a straight line at x = 280 for a hundred and fifty-six metres,
 * which is the one thing a dune crest is never: a seif's brink WANDERS, and the
 * scallops in it are what give an otherwise featureless slope a top edge you can
 * see from the bottom. The first attempt at this hung fifteen cornice boxes
 * along the ridge and they photographed as loose white paving slabs lying in the
 * air over the slipface — the same failure as Rio's breaking wave, and the same
 * cure: it is not an object ON the surface, it is the shape OF the surface.
 *
 * Four metres of amplitude on two incommensurable periods. The collider samples
 * sahTerrain, so it follows; sahGroundSlip's band is in z and is unaffected; and
 * sahSURF_TOP (272) is eight metres clear of the westernmost the crest ever
 * goes, so the run still arms where it always did.
 */
function sahCrest(z) {
  return Math.sin(z * 0.061) * 2.6 + Math.sin(z * 0.027 + 1.1) * 1.6;
}

function sahTerrain(x, z) {
  let y = 0;

  // --- the hamada begins lifting once the palms stop -------------------------
  if (x > 150) y += clamp((x - 150) / 34, 0, 1) * 5;

  // --- the dune field: long ridges running north-south, which is what an erg
  //     under a prevailing wind actually looks like from the air
  if (x > sahERG_X) {
    const t = clamp((x - sahERG_X) / 60, 0, 1);
    y += t * (5.5 + 4.5 * Math.sin(x * 0.055) * Math.cos(z * 0.031));
  }

  // --- THE GREAT DUNE --------------------------------------------------------
  const dx = x - sahDUNE_X - sahCrest(z);
  const zt = clamp(1 - Math.pow((z - sahDUNE_Z) / sahDUNE_HZ, 2), 0, 1);
  if (zt > 0) {
    let h = 0;
    if (dx <= 0 && dx > -sahDUNE_W) {
      const u = (dx + sahDUNE_W) / sahDUNE_W;      // 0 at the foot, 1 at the crest
      // a touch of ease at both ends so the foot and the crest are not creases
      h = sahDUNE_H * (u * u * (3 - 2 * u) * 0.22 + u * 0.78);
    } else if (dx > 0 && dx < sahDUNE_L) {
      h = sahDUNE_H * (1 - dx / sahDUNE_L);        // the slipface, 36 degrees
      // ---- AND IT IS NOT A RAMP (D4.6) ---------------------------------
      // The marquee of this chapter was a hundred metres of straight, on the
      // same groundSlip verb Iceland introduced four chapters earlier, with
      // nothing to steer round and nothing to do. A real slipface is not a
      // plane: sand avalanches off the brink in lobes and leaves a chain of
      // convex rolls down the face, and they are what a board or a sledge
      // leaves the ground on.
      //
      // A sine down the face, skewed by z so the lips are not a row of steps
      // across it. Fourteen metres of wavelength and 0.9 m of amplitude, which
      // is a slope contribution of +/-0.405 against the face's own 0.724 --
      // so every part of the face still falls AWAY (0.319 at the flattest) and
      // there is nowhere on it to stall. The convex halves are the launches.
      //
      // Tapered off the brink and off the runout, so the drop-in is clean and
      // the landing is flat. sahGroundSlip's band is in z and is untouched;
      // the walk-up track is on the shoulders where zt has already faded this
      // whole term away.
      const lip = clamp(dx / 8, 0, 1) * clamp((sahDUNE_L - dx) / 14, 0, 1);
      h += Math.sin(dx * 0.45 + z * 0.05) * sahDUNE_LIP * lip;
    } else if (dx <= -sahDUNE_W) h = 0;
    y += h * zt;
  }

  return y;
}

function sahSlope(x, z) {
  const h = 1.5;
  return Math.sqrt(
    Math.pow(sahTerrain(x + h, z) - sahTerrain(x - h, z), 2) +
    Math.pow(sahTerrain(x, z + h) - sahTerrain(x, z - h), 2)) / (2 * h);
}

/**
 * WHERE THE SAND LETS GO — and it is a PLACE, not a gradient.
 *
 * The first version of this derived slip from the local slope, which is the
 * obvious thing and was wrong twice over. Every ripple in the erg cleared the
 * threshold, so the whole desert crept underfoot; and the great dune's own
 * windward face is only twenty-five degrees, which did not clear it by enough
 * to matter, so the one slope the mechanic exists for was the one slope that
 * did nothing. A derived rule that gets the general case slightly wrong and the
 * special case completely wrong is worse than a named exception.
 *
 * So: the middle seventy per cent of the great dune's windward face slides, and
 * nothing else in Marrakech does. The other thirty per cent — the two shoulders
 * — is firm, and that is the way UP. It is the same shape as Iceland's moraine
 * and for the same reason: a slope you cannot climb is not a slide, it is a
 * wall, and every run needs a walk back to the top of it.
 */
function sahGroundSlip(x, z) {
  if (x < sahERG_X) return 0;
  const dx = x - sahDUNE_X - sahCrest(z);
  if (dx <= -sahDUNE_W || dx >= sahDUNE_L) return 0;
  // how far into the ridge, across it: 1 on the centre line, 0 at the tips
  const zt = clamp(1 - Math.pow((z - sahDUNE_Z) / sahDUNE_HZ, 2), 0, 1);
  if (zt <= sahSURF_BAND) return 0;                       // the firm shoulders
  const band = clamp((zt - sahSURF_BAND) / 0.18, 0, 1);
  // and feather the foot and the crest, so neither is a step change
  const ends = clamp(Math.min(dx + sahDUNE_W, sahDUNE_L - dx) / 10, 0, 1);
  return sahSURF_SLIP * band * ends;
}

// ============================================================== THE SOUK ====
/**
 * Eight blocks by four, twelve metres apart, eight and a half metres square:
 * three and a half metres of alley between any two of them, covered, which is
 * exactly the geometry that makes the real one impossible to hold a bearing in.
 *
 * The blocked test is arithmetic rather than a list, so the pursuers can call it
 * three times each per steering step without anybody noticing.
 */
function sahSoukBlocked(x, z, r) {
  if (x < sahSOUK_X0 - 4 || x > sahSOUK_X0 + sahSOUK_NX * sahSOUK_CELL + 4) return false;
  if (z < sahSOUK_Z0 - 4 || z > sahSOUK_Z0 + sahSOUK_NZ * sahSOUK_CELL + 4) return false;
  const i = Math.round((x - sahSOUK_X0 - sahSOUK_CELL * 0.5) / sahSOUK_CELL);
  const j = Math.round((z - sahSOUK_Z0 - sahSOUK_CELL * 0.5) / sahSOUK_CELL);
  if (i < 0 || i >= sahSOUK_NX || j < 0 || j >= sahSOUK_NZ) return false;
  if (sahSoukOpen(i, j)) return false;
  const cx = sahSOUK_X0 + (i + 0.5) * sahSOUK_CELL;
  const cz = sahSOUK_Z0 + (j + 0.5) * sahSOUK_CELL;
  const h = sahSOUK_BLOCK * 0.5 + (r || 0);
  return Math.abs(x - cx) < h && Math.abs(z - cz) < h;
}
// ---- WHERE THE LENS MAY NOT GO ABOVE (v20) ---------------------------------
// The souk is roofed at 6.6 m over every alley — see the ROOF note in
// sahBuildSouk — and the roof is drawn geometry with no rigid body, which is
// right for a palm-frond mat nobody will ever stand on and fatal for a camera
// that decides its height from the GROUND. Measured in a north-south lane: the
// eye at y = 7.6, the mats at 6.6, and the whole frame filled with the top of a
// market the capybara was somewhere underneath.
//
// systems.js asks for this by name, per frame, at the position the eye WANTS
// rather than at the animal's — the boom reaches eight metres back and it is
// the far end of it that comes up through the roof. Outside the souk footprint
// there is no answer and the camera keeps every bit of the sky it had.
const sahROOF_Y = 6.6;
const sahCAM_CEIL = sahROOF_Y - 0.35;
function sahCamCeil(x, z) {
  if (x < sahSOUK_X0 - 3 || x > sahSOUK_X0 + sahSOUK_NX * sahSOUK_CELL + 3) return Infinity;
  if (z < sahSOUK_Z0 - 3 || z > sahSOUK_Z0 + sahSOUK_NZ * sahSOUK_CELL + 3) return Infinity;
  return sahCAM_CEIL;
}

/** Four of the thirty-two cells are little squares rather than blocks, because
 *  a perfectly regular grid is a car park and reads as one. */
function sahSoukOpen(i, j) {
  return (i === 2 && j === 1) || (i === 5 && j === 0) || (i === 6 && j === 2) || (i === 1 && j === 3);
}

function sahNavBlocked(x, z, r) {
  if (sahSoukBlocked(x, z, r)) return true;
  // the medina wall, with the gate cut in it
  // The wall now runs from the gate outward — 7 bays south, 4 north — so the
  // span here is derived from the same numbers the geometry uses rather than
  // being a round figure that happened to agree with it.
  const rr = r || 0;
  const zLo = sahGATE.z - sahGATE_OUT - 7 * 11.5, zHi = sahGATE.z + sahGATE_OUT + 4 * 11.5;
  if (Math.abs(x - 70) < 2 + rr && z > zLo && z < zHi &&
      Math.abs(z - sahGATE.z) > sahGATE_HW - 0.6 + rr) return true;
  return false;
}

/**
 * Can A see B? Six samples along the segment — cheap, and the souk is convex
 * blocks so more would not buy anything.
 *
 * ---- M3: AND A CROWD IS COVER, WHICH THIS FILE HAS CLAIMED TWICE ----------
 *
 * The stall-front note says "the souk is a chase arena and a crowd is also the
 * only cover in it" and the alley-walker note says "a lane with thirty people
 * in it is a lane where a corner is worth taking". Neither was true. This
 * function tested souk BLOCKS and nothing else, so sixty people in the maze
 * were scenery with colliders and the only thing that ever broke a sight line
 * was a wall. The one chapter in the game with a losable task had exactly one
 * cover mechanic and it was architecture.
 *
 * A person is a disc on the segment — point-to-segment distance, not another
 * six samples, because a sample every seventh of the way misses a 0.38 m
 * target at any range over about five metres and would have made this a
 * lottery rather than a mechanic.
 *
 * THREE THINGS THAT KEEP IT HONEST:
 *  - only the souk's own crowd counts. `sahSoukPpl0`/`sahSoukPplN` is the
 *    index range sahBuildSouk wrote, recorded there for this. The square's
 *    hundred and forty are in the open, and hiding behind one of them across
 *    forty metres of Jemaa el-Fnaa is not a thing that should work.
 *  - nobody within sahLOS_END of either end blocks. The trader's own
 *    neighbour at the next stall is not cover, and neither is somebody
 *    standing on top of the capybara.
 *  - it is ONE person deep and you have to actually be behind them. 0.38 m
 *    against a 0.26 m-wide figure is the width of the person and a hand
 *    either side, which is what "behind" means.
 */
function sahLineOfSight(ax, az, bx, bz, ignoreCrowd) {
  for (let k = 1; k <= 6; k++) {
    const t = k / 7;
    if (sahSoukBlocked(ax + (bx - ax) * t, az + (bz - az) * t, 0)) return false;
  }
  // ---- AND SOUND IS NOT LIGHT (found by measuring M2 after M3) ------------
  //
  // M2's shout is gated on this same function, on the reasoning that a shout
  // does not go round corners — which is true of the WALLS and false of the
  // people. With the crowd term in, a bystander standing between two traders
  // stopped one of them shouting to the other, and the relay measured ZERO
  // hand-offs anywhere in the souk: sixty-four people in a maze is a person on
  // nearly every line, so M3 had silently switched M2 off. Caught because the
  // number went from 1382 to 0 rather than from 1382 to something sensible.
  //
  // `ignoreCrowd` is the one caller that wants walls only.
  if (!ignoreCrowd && sahSoukPplN > 0 &&
      !(sahGame && sahGame.state && sahGame.state.noCover)) {
    const ex = bx - ax, ez = bz - az;
    const len2 = ex * ex + ez * ez;
    if (len2 > 1e-6) {
      const inv = 1 / len2;
      const endT = sahLOS_END / Math.sqrt(len2);
      const t0 = endT, t1 = 1 - endT;
      if (t1 > t0) {
        for (let i = sahSoukPpl0; i < sahSoukPpl0 + sahSoukPplN; i++) {
          const o = i * sahPPL_STRIDE;
          const t = ((sahPplData[o] - ax) * ex + (sahPplData[o + 2] - az) * ez) * inv;
          if (t < t0 || t > t1) continue;
          const qx = ax + ex * t - sahPplData[o];
          const qz = az + ez * t - sahPplData[o + 2];
          if (qx * qx + qz * qz < sahLOS_BODY2) return false;
        }
      }
    }
  }
  return true;
}

function sahBuildSouk(game, root) {
  // M3: everybody this function adds to the shared roster is inside the maze,
  // and inside the maze is where a person is cover. See sahLineOfSight.
  sahSoukPpl0 = sahPplN;
  const M = sahMerger();
  const RM = sahMerger();
  // ONE BODY FOR THE WHOLE SOUK. Thirty-two blocks and four fountain rims were
  // thirty-six separate CANNON.Bodies in a chapter that was at 122 against a
  // hard 130; a compound body is one broadphase entry and the shapes are
  // identical, so nothing about what is solid changes. See sahStaticGroup.
  const G = sahStaticGroup(game);
  const wallCols = [PALETTE.sahOchre, PALETTE.sahOchreDk, PALETTE.sahOchrePale, PALETTE.sahOchreDust];
  const dyes = [PALETTE.sahDye1, PALETTE.sahDye2, PALETTE.sahDye3, PALETTE.sahDye4, PALETTE.sahDye5];
  for (let i = 0; i < sahSOUK_NX; i++) {
    for (let j = 0; j < sahSOUK_NZ; j++) {
      const cx = sahSOUK_X0 + (i + 0.5) * sahSOUK_CELL;
      const cz = sahSOUK_Z0 + (j + 0.5) * sahSOUK_CELL;
      if (sahSoukOpen(i, j)) {
        // a little square with a fountain and a tree in it — a landmark, which
        // is the only thing that makes a maze navigable at all
        M.cyl(cx, 0.3, cz, 2.6, 0.6, PALETTE.sahTileBlue, 0, 0, 0, 8);
        M.cyl(cx, 0.75, cz, 1.6, 0.9, PALETTE.sahTileWhite, 0, 0, 0, 8);
        M.cyl(cx, 1.4, cz, 0.35, 1.4, PALETTE.sahTileGreen, 0, 0, 0, 6);
        // The fountain is the LANDMARK — "the only thing that makes a maze
        // navigable at all" — and it was a picture of one. It is also the only
        // obstacle in an open cell, so it changes the chase: rounding a
        // fountain is a real thing you can do to somebody chasing you.
        G.add(cx, 0.6, cz, 3.4, 1.2, 3.4);
        // and a tree in it, and two people sitting on the rim, which is what
        // every one of these squares actually has
        for (let k = 0; k < 5; k++) {
          const a2 = k / 5 * 6.283;
          M.box(cx + Math.cos(a2) * 1.1, 2.5, cz + Math.sin(a2) * 1.1,
                2.2, 0.14, 0.5, PALETTE.sahPalm, 0, -a2, 0.3);
        }
        sahAddPerson(cx + 2.9, 0, cz + 0.6, -1.4, sahPPL_SIT);
        sahAddPerson(cx - 2.6, 0, cz - 1.2, 1.9, sahPPL_STAND);
        continue;
      }
      const s = sahSOUK_BLOCK;
      const h = rand(5.2, 7.4);
      M.box(cx, h * 0.5, cz, s, h, s, wallCols[(i + j) % wallCols.length]);
      M.box(cx, h + 0.35, cz, s + 0.6, 0.7, s + 0.6, PALETTE.sahOchreDk);
      // a door, and every good door in this city is carved cedar
      const face = j < 2 ? 1 : -1;
      M.box(cx, 1.5, cz + face * (s * 0.5 + 0.08), 1.6, 3.0, 0.16, PALETTE.sahCedar);
      M.box(cx, 3.1, cz + face * (s * 0.5 + 0.10), 1.9, 0.3, 0.2, PALETTE.sahCedarDk);
      // the stall in front of it: an awning and a hanging wall of something dyed
      M.box(cx + face * 0, 3.2, cz + face * (s * 0.5 + 1.0), s * 0.9, 0.1, 2.0,
        PALETTE.sahAwning, face * 0.18, 0, 0);
      for (let k = 0; k < 4; k++) {
        M.box(cx - s * 0.34 + k * (s * 0.22), 2.1, cz + face * (s * 0.5 + 1.7),
          s * 0.18, 2.0, 0.10, dyes[(i * 3 + j * 5 + k) % dyes.length]);
      }
      // brass lanterns strung between the blocks
      if ((i + j) % 2 === 0) {
        M.cyl(cx + s * 0.4, 4.4, cz, 0.22, 0.5, PALETTE.sahBrass, 0, 0, 0, 6);
        M.cone(cx + s * 0.4, 4.8, cz, 0.24, 0.5, PALETTE.sahBrassDk, 0, 0, 0, 6);
      }
      // ---- THE ROOF OF A MEDINA IS WHERE IT LIVES -------------------------
      // Thirty-two blocks with dead flat empty tops, and the player spends a
      // chase looking down on them from a camera at forty-one degrees. What is
      // actually up there is a parapet, a water tank, a dish, and somebody's
      // washing — and all four are one merged box each.
      //
      // ...AND THE DECK ITSELF WAS THE COLOUR OF THE WALL. Rendered from above
      // — which is where this camera lives — thirty-two blocks with a rim round
      // the top and the same value inside it read as thirty-two open crates,
      // not as a roofscape. A flat roof in that city is lime-washed and it is
      // the palest surface in the medina by a long way. One box, and it is what
      // makes the shot from the chase read as a city.
      M.box(cx, h + 0.09, cz, s - 0.1, 0.18, s - 0.1, PALETTE.sahPlaster);
      // and the stair-head hut every one of them has, which is the only way up
      if ((i * 7 + j) % 3 !== 2) {
        M.box(cx + s * 0.30, h + 0.90, cz + s * 0.30, 1.5, 1.6, 1.5, PALETTE.sahOchrePale);
        M.box(cx + s * 0.30, h + 1.78, cz + s * 0.30, 1.8, 0.2, 1.8, PALETTE.sahOchreDk);
        M.box(cx + s * 0.30, h + 0.85, cz + s * 0.30 - 0.78, 0.7, 1.5, 0.1, PALETTE.sahCedar);
      }
      M.box(cx, h + 1.05, cz, s + 0.6, 0.7, 0.24, PALETTE.sahOchrePale);
      M.box(cx, h + 1.05, cz - s * 0.5 - 0.18, s + 0.6, 0.7, 0.24, PALETTE.sahOchrePale);
      M.box(cx, h + 1.05, cz + s * 0.5 + 0.18, s + 0.6, 0.7, 0.24, PALETTE.sahOchrePale);
      for (let e = -1; e <= 1; e += 2) {
        M.box(cx + e * (s * 0.5 + 0.18), h + 1.05, cz, 0.24, 0.7, s + 0.6, PALETTE.sahOchrePale);
      }
      if ((i * 3 + j) % 3 === 0) {
        M.cyl(cx - s * 0.28, h + 1.35, cz + s * 0.24, 0.42, 1.0, PALETTE.sahTileBlue, 0, 0, 0, 8);
        M.cyl(cx - s * 0.28, h + 1.88, cz + s * 0.24, 0.44, 0.10, PALETTE.sahBrassDk, 0, 0, 0, 8);
      }
      if ((i * 5 + j) % 4 === 0) {
        M.cyl(cx + s * 0.30, h + 1.10, cz - s * 0.22, 0.55, 0.12, PALETTE.sahTileWhite, 1.05, 0.6, 0, 8);
        M.cyl(cx + s * 0.30, h + 0.86, cz - s * 0.22, 0.05, 0.5, PALETTE.sahCedarDk);
      }
      if ((i + j * 3) % 3 === 1) {
        // a washing line, and four things on it
        M.cyl(cx, h + 1.55, cz, 0.03, s * 0.8, PALETTE.sahRope, 0, 0, Math.PI / 2);
        for (let k = 0; k < 4; k++) {
          M.box(cx - s * 0.3 + k * (s * 0.2), h + 1.20, cz, s * 0.14, 0.65, 0.03,
            [PALETTE.sahDye1, PALETTE.sahDye3, PALETTE.sahTileWhite, PALETTE.sahDye4][k]);
        }
      }
      G.add(cx, h * 0.5, cz, s, h, s);
      // ---- AND SOMEBODY AT THE STALL -------------------------------------
      // Every block has a door, an awning and a wall of dyed cloth hanging in
      // front of it, and nobody had ever stood behind any of it. The souk is a
      // chase arena and a crowd is also the only cover in it.
      sahAddPerson(cx + rand(-1.4, 1.4), 0, cz + face * (s * 0.5 + 1.15),
                   face > 0 ? 0 : Math.PI, sahPPL_STAND);
      if ((i + j) % 2 === 0) {
        sahAddPerson(cx + rand(-2.0, 2.0), 0, cz + face * (s * 0.5 + 2.6),
                     face > 0 ? Math.PI : 0, sahPPL_STAND);
      }
    }
  }
  // --- THE ROOF. The souk is covered in slatted palm-frond mats and the light
  //     comes through them in stripes. It is the single most photographed thing
  //     in the city and it costs one merged mesh and the shadow map that is
  //     already switched on.
  // THE MATS GO OVER THE ALLEYS. THEY DO NOT GO OVER THE ROOFS.
  //
  // The north-south runs were already right — they sit on the cell boundaries,
  // which is where the alleys are. The east-west runs were laid across the
  // WHOLE width at a constant y = 6.6, straight through thirty-two blocks that
  // are between 5.2 and 7.4 m tall: the shot from above is a grid of green
  // slats floating over a heap of boxes, with the tall ones sticking through
  // it. A slat over a roof is not shading anything, and the striped light on
  // the alley floor — which is the single most photographed thing in that city
  // and the whole reason this mesh exists — is unaffected by removing them.
  //
  // The height stays one number — the medina is flat and the blocks are all
  // between 5.2 and 7.4, so 6.6 is under every roof that matters and over
  // every alley — but the ROOFSCAPE now has parapets on it (see the block
  // loop), which is what actually stops the mats reading as a grid floating
  // over a heap of boxes.
  // The one number, and it is now shared with sahCamCeil — a roof the camera
  // has to stay under is the same roof the mats are laid at.
  const ROOF_Y = sahROOF_Y;
  for (let i = 0; i <= sahSOUK_NX; i++) {
    const x = sahSOUK_X0 + i * sahSOUK_CELL;
    for (let k = 0; k < 34; k++) {
      const z = sahSOUK_Z0 + k * (sahSOUK_NZ * sahSOUK_CELL / 34);
      RM.box(x, ROOF_Y, z, 4.4, 0.16, 0.55, PALETTE.sahPalmDry);
    }
  }
  for (let j = 0; j <= sahSOUK_NZ; j++) {
    const z = sahSOUK_Z0 + j * sahSOUK_CELL;
    for (let k = 0; k < 60; k++) {
      const x = sahSOUK_X0 + k * (sahSOUK_NX * sahSOUK_CELL / 60);
      // skip any slat that is over a block rather than over an alley
      if (sahSoukBlocked(x, z, -1.2)) continue;
      RM.box(x, ROOF_Y, z, 0.55, 0.16, 4.4, PALETTE.sahPalmDry);
    }
  }
  // and the beams the mats are laid on, which is what stops the lattice
  // reading as a grid hanging in mid-air
  for (let i = 0; i <= sahSOUK_NX; i++) {
    const x = sahSOUK_X0 + i * sahSOUK_CELL;
    RM.box(x, 6.86, sahSOUK_Z0 + sahSOUK_NZ * sahSOUK_CELL * 0.5,
           0.36, 0.36, sahSOUK_NZ * sahSOUK_CELL, PALETTE.sahCedarDk);
  }
  G.done();

  // ---- AND SOMEBODY IN THE ALLEYS ----------------------------------------
  // The stall fronts alternate along z, so everybody in the souk stands in the
  // east–west lanes and the north–south ones — which is half the maze and
  // includes the run in from the square — had nobody in them at all. Measured
  // off a ground-level frame: the alley the chase starts in is empty.
  //
  // This matters mechanically, not only visually. The chapter's own note says
  // "a crowd is also the only cover in it": the traders lose sight of you round
  // corners, and a lane with thirty people in it is a lane where a corner is
  // worth taking. Twenty-eight of them, on the open lanes only, and never
  // within a metre and a half of a wall.
  for (let i = 0; i < 28; i++) {
    const gx = sahSOUK_X0 + rand(1, sahSOUK_NX * sahSOUK_CELL - 1);
    const gzz = sahSOUK_Z0 + rand(1, sahSOUK_NZ * sahSOUK_CELL - 1);
    if (sahSoukBlocked(gx, gzz, 1.5)) continue;
    sahAddPerson(gx, 0, gzz, rand(0, 6.283), sahPPL_STAND);
  }
  // ...and that is the cover roster closed. Counted rather than assumed: the
  // loop above `continue`s on a blocked sample and does not retry, so "28" is
  // a ceiling and not a count.
  sahSoukPplN = sahPplN - sahSoukPpl0;

  const mesh = new THREE.Mesh(M.build(), sahVC());
  mesh.castShadow = true; mesh.receiveShadow = true;
  root.add(mesh);
  const rm = new THREE.Mesh(RM.build(), sahVC());
  rm.castShadow = true;
  sahSoukRoofs = rm;
  root.add(rm);
}

// ============================================================ THE MEDINA ====
// ============================================================== THE ACROBATS ==
// THE MINI. Jemaa el-Fnaa has, on any given evening, the storytellers, the
// snake charmers, the Gnawa, the juice carts and the acrobats of Amizmiz, and
// four of those five were already in this chapter.
//
// It is also the only mini in the thirteen that uses capy.launch(). Everything
// else here either carries you or leans on you; this THROWS you, which is the
// third and last of the three channels in the contract and the one the geyser
// uses. Twenty-two metres of Marrakech from above, and then you come down in
// the middle of the square with a hundred people watching, which is exactly
// what the trick is for.
//
// The tumblers bob on the spot the whole time the chapter is live, which makes
// this the only permanently ANIMATED group of people in the medina — the square
// reads as somewhere something is going on rather than as a model of one.
const sahACRO = { x: -16, z: 20 };     // between the storytellers' rings
const sahACRO_WIND = 1.25;             // s of crouch before they let go
// v^2 / 2g, and g here is 24: 17.5 m/s is 6.4 m, which was under the mark this
// same block set. Measured at 6.2. 22 m/s is 10.1 m, which is over the top of
// the food stalls and about level with the minaret's first band.
const sahACRO_V = 22.0;                // m/s straight up — about 10.1 m at this g
const sahACRO_OUT = 3.2;               // m/s of drift out over the square
const sahACRO_COOL = 3.0;              // s before they will do it again
const sahACRO_MARK = 7.5;              // m of apex that count as 'thrown'
let sahAcroGroup = null;
let sahAcroMen = [];
let sahAcroWind = -1;
let sahAcroCool = 0;
let sahAcroTop = 0;                    // apex of the throw in progress
let sahAcroFlying = false;
let sahAcroFly = 0;                    // s since the throw
let sahAcroDone = false;
let sahAcroY0 = 0;
let sahAcroPuff = 0;                   // s of the tumblers holding the extension
const sahAcroPos = new THREE.Vector3();

function sahBuildAcrobats(game, root) {
  sahAcroY0 = sahTerrain(sahACRO.x, sahACRO.z);
  sahAcroGroup = new THREE.Group();
  sahAcroGroup.name = 'sahAcrobats';
  sahAcroGroup.position.set(sahACRO.x, sahAcroY0, sahACRO.z);
  root.add(sahAcroGroup);

  // the bare patch and the mat they land on
  const G = sahMerger();
  G.cyl(0, 0.03, 0, 5.0, 0.06, PALETTE.sahOchrePale, 0, 0, 0, 8);
  G.box(0, 0.09, 0, 3.0, 0.10, 3.0, PALETTE.sahDye1);
  G.box(0, 0.16, 0, 2.4, 0.06, 2.4, PALETTE.sahCanvas);
  const mat0 = new THREE.Mesh(G.build(), sahVC());
  mat0.receiveShadow = true;
  sahAcroGroup.add(mat0);

  // Four of them in a ring round the mat, arms braced overhead. Each is its own
  // group so it can crouch — the crouch IS the wind-up, and without it the
  // launch reads as the ground going wrong rather than as being thrown.
  sahAcroMen = [];
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + 0.4;
    const M = sahMerger();
    M.cyl(0, 0.44, 0, 0.17, 0.88, PALETTE.sahCanvas, 0, 0, 0, 6);
    M.cyl(0.10, 0.44, 0, 0.10, 0.86, PALETTE.sahDye2, 0, 0, 0, 4);
    M.box(0, 1.02, 0, 0.52, 0.42, 0.30, PALETTE.sahTileWhite);
    M.sph(0, 1.36, 0, 0.15, 0.17, 0.15, PALETTE.sahOchreDk);
    M.cyl(0, 1.50, 0, 0.16, 0.10, PALETTE.sahDye1, 0, 0, 0, 6);
    // the arms, up and reaching in — this is what they are for
    // FROM THE SHOULDER. At (0.30, 1.32, -0.34) they started a third of a metre
    // behind and above the body and read as two batons hanging in the air.
    for (let s2 = -1; s2 <= 1; s2 += 2) {
      M.box(s2 * 0.27, 1.18, -0.06, 0.11, 0.70, 0.11, PALETTE.sahTileWhite, -0.42, 0, s2 * 0.30);
    }
    const mesh = new THREE.Mesh(M.build(), sahVC());
    mesh.castShadow = true;
    const gg = new THREE.Group();
    gg.add(mesh);
    gg.position.set(Math.cos(a) * 1.55, 0, Math.sin(a) * 1.55);
    gg.rotation.y = -a + Math.PI * 0.5;
    sahAcroGroup.add(gg);
    sahAcroMen.push(gg);
  }
  sahAcroPos.set(sahACRO.x, sahAcroY0 + 0.6, sahACRO.z);
}

/** True when the capybara is standing on the mat. */
function sahOnMat(p) {
  if (!p) return false;
  const dx = p.x - sahACRO.x, dz = p.z - sahACRO.z;
  return dx * dx + dz * dz < 1.6 * 1.6 && p.y < sahAcroY0 + 2.2;
}

function sahUpdateAcrobats(game, dt) {
  if (!sahAcroGroup) return;
  const capy = game.capy;
  const cp = capy && capy.position;
  if (sahAcroCool > 0) sahAcroCool -= dt;

  // ---- the crouch ---------------------------------------------------------
  let crouch = 0;
  if (sahAcroWind >= 0) {
    sahAcroWind -= dt;
    crouch = Math.sin(clamp(1 - sahAcroWind / sahACRO_WIND, 0, 1) * Math.PI) * 0.34;
    if (sahAcroWind < 0) {
      sahAcroWind = -1;
      sahAcroCool = sahACRO_COOL;
      if (cp && sahOnMat(cp) && capy.launch) {
        const a = Math.atan2(-sahACRO.x, 4 - sahACRO.z);   // out over the middle of the square
        capy.launch(Math.sin(a) * sahACRO_OUT, sahACRO_V, Math.cos(a) * sahACRO_OUT);
        sahAcroFlying = true;
        sahAcroTop = 0;
        sahAcroFly = 0;
        if (game.sfx) {
          game.sfx('cheer', { volume: 0.85, pitch: 1.05, force: true });
          game.sfx('thud', { volume: 0.6, pitch: 1.4 });
        }
        if (game.shake) game.shake(0.16);
        // ---- THE THROW LEAVES A MARK -----------------------------------
        // The one mini in the thirteen that uses capy.launch(), and all it did
        // was change a velocity: a capybara silently departing upward off a
        // patch of canvas. Every other verb in this game leaves something
        // behind — the puff has a ring, the grab has a prop, the wave has
        // foam. Twenty-two puffs of the square's own dust kicked out sideways
        // off the mat is what a hundred and fifty kilos leaving at twenty-two
        // metres a second actually does to eight hundred years of packed
        // earth, and it is also the only frame in which the player can see
        // WHERE they left from.
        sahAcroPuff = 0.45;
        for (let k = 0; k < 22; k++) {
          const pa = k / 22 * 6.283 + rand(-0.2, 0.2);
          sahDustSpawn(sahACRO.x + Math.cos(pa) * 1.4, sahAcroY0 + rand(0.1, 0.5),
            sahACRO.z + Math.sin(pa) * 1.4, Math.cos(pa) * rand(2.5, 5.5),
            rand(0.25, 0.6), rand(0.5, 1.1));
        }
      } else if (game.toast) {
        game.toast('you have to be ON the mat.');
      }
    }
  } else if (sahAcroCool <= 0 && cp && game.input && game.input.actionPressed && sahOnMat(cp)) {
    sahAcroWind = sahACRO_WIND;
    if (game.sfx) game.sfx('rustle', { volume: 0.6 });
  }

  // they bob on the spot the rest of the time, which is what makes the square
  // read as somewhere something is going on
  //
  // ...AND WHEN THEY LET GO, THEY LET GO. The crouch was the whole of the
  // animation: four men squatted, and then the capybara was in the air and they
  // were back to bobbing on the same frame. What sells a throw is the extension
  // AFTER it — arms straight up, on their toes, holding it for half a second
  // and looking at where you went. Same clock as the dust puff.
  if (sahAcroPuff > 0) sahAcroPuff -= dt;
  const thr = sahAcroPuff > 0 ? Math.sin(clamp(sahAcroPuff / 0.45, 0, 1) * Math.PI * 0.85) : 0;
  for (let i = 0; i < sahAcroMen.length; i++) {
    const g = sahAcroMen[i];
    const bob = Math.sin(sahTime * 2.3 + i * 1.7) * 0.045;
    g.position.y = bob - crouch + thr * 0.30;
    g.scale.y = 1 - crouch * 0.30 + thr * 0.16;
    g.rotation.x = -thr * 0.26;
  }

  // ---- how high did it go -------------------------------------------------
  if (sahAcroFlying && cp) {
    sahAcroFly += dt;
    const h = cp.y - sahAcroY0;
    if (h > sahAcroTop) sahAcroTop = h;
    // ...and how far up they have put you, while you are up there (v36). The
    // apex so far, which is the quantity the record takes three screens down —
    // the instantaneous height would fall back through the arc and report the
    // wrong thing on the way down. Two metres of floor: stepping off the mat is
    // not being thrown by anybody.
    if (sahAcroTop > 2 && game.recordLive) game.recordLive('acrobats', sahAcroTop);
    // A TIMER AS WELL AS THE LANDING. Waiting on `grounded` alone is waiting on
    // a flight that ends where you left it, and this one very often does not:
    // an awning is 2.7 m up, the gate is eight, and a capybara that comes down
    // on either of those never satisfies the height test and never gets paid.
    // Two seconds is already past the apex either way.
    // AND NOT ON THE FRAME AFTER THE THROW. sahara.js updates BEFORE
    // capybara.js, so on the very next frame `capy.grounded` is still the value
    // it had while the animal was standing on the mat and `h` is still half a
    // metre: the flight was resolved instantly, with an apex of 0.5 m, and the
    // ten metres that followed were never looked at. Measured: apex 9.8, task
    // not paid, and nothing in the log.
    if (sahAcroFly > 0.4 && ((capy.grounded && h < 2.5) || sahAcroFly > 3.6)) {
      sahAcroFlying = false;
      if (game.record) game.record('acrobats', sahAcroTop);
      if (!sahAcroDone && sahAcroTop >= sahACRO_MARK) {
        sahAcroDone = true;
        sahTask('acrobats');
      }
    }
  }
}

function sahBuildSquare(game, root) {
  const M = sahMerger();
  // ---- the ground of the square: packed earth, PALER WHERE IT IS WALKED ----
  //
  // It was one sixty-by-forty-four metre plate in exactly the colour the
  // terrain under it already is, which buys nothing and costs a ruled line
  // sixty metres long across the middle of the picture — the plate's own edge,
  // catching the light a hair differently from the ground it is lying on. The
  // instrumented shot of Jemaa el-Fnaa has it running diagonally through the
  // whole foreground.
  //
  // What the comment was after is real, though: a square that has had eight
  // hundred years of feet on it is not one colour, it is polished where people
  // walk and dusty where they do not. So: no plate, and instead a scatter of
  // overlapping worn patches, which has no edge anywhere because every edge is
  // under another patch.
  // ...AND IT IS NOT DRAWN HERE ANY MORE. Fifty-six eight-sided discs at 2–9 m
  // radius, laid flat on the ground in a paler tone, render as fifty-six
  // OCTAGONS — the note above them claims "no edge anywhere because every edge
  // is under another patch" and the instrumented shot of the square is covered
  // in visible corners, which is the third time this family of chapters has
  // learned that eight sides is a shape. The wear now lives in the ground
  // mesh's own vertex colours (see sahBuildGround), where it costs nothing and
  // cannot have a polygon edge at all.

  // --- the food stalls. At dusk a hundred of them go up in an hour; there are
  //     twelve here and they ring the square, which is the arrangement.
  // ---- FOURTEEN STALLS AND ONE COLOUR BETWEEN THEM -----------------------
  // `awn` was [sahCanvas 0xe4d5b8, sahAwning 0xd9c9a4, sahTileWhite 0xf2ece0]
  // — three shades of the same cream, four values apart, cycled by index. So
  // the fourteen brightest objects in the busiest square in Africa were, to the
  // eye, ONE object drawn fourteen times, and the ring of them round the
  // capybara read as a ring of identical white tables.
  //
  // Two things fix it and neither costs a triangle. The canvas keeps its cream
  // — a food stall in Jemaa el-Fnaa really is white canvas and painting them
  // all in dye colours would be a lie and a mess — but the VALANCE, the
  // number board and the ridge are struck in the souk's own dye palette, one
  // per stall, so each pitch has an identity from across the square. And every
  // third stall carries a striped tarp over the cream, which is the other
  // thing the real ones have.
  const awn = [PALETTE.sahCanvas, PALETTE.sahAwning, PALETTE.sahTileWhite];
  const trim = [PALETTE.sahDye1, PALETTE.sahDye2, PALETTE.sahDye3, PALETTE.sahDye4,
                PALETTE.sahTileGreen, PALETTE.sahBrass, PALETTE.sahMint];
  // The lamps hang in their own merged mesh under an emissive material: a
  // Lambert bulb in a chapter that ends after dark is a grey pebble. Their
  // intensity follows sahDusk — see sahUpdateTasks.
  const LAMP = sahMerger();
  const stallGrp = sahStaticGroup(game);
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * 6.283;
    const x = Math.cos(a) * 22, z = 4 + Math.sin(a) * 15;
    M.box(x, 1.1, z, 3.4, 0.14, 2.4, PALETTE.sahCedar);                 // the trestle
    for (let k = -1; k <= 1; k += 2) {
      M.cyl(x + k * 1.5, 1.3, z - 1.0, 0.07, 2.6, PALETTE.sahCedarDk);
      M.cyl(x + k * 1.5, 1.3, z + 1.0, 0.07, 2.6, PALETTE.sahCedarDk);
    }
    // ---- AN AWNING SAGS, AND THIS CAMERA LOOKS DOWN ON IT ------------------
    // Fourteen 4.2 x 3.4 m slabs of flat cream, seen from a rig at forty-one
    // degrees: from the square they are fourteen white TABLES floating over the
    // trestles. A canvas awning on two poles has a ridge along the middle and
    // falls away on both sides, and that one fold is the entire difference
    // between a tarpaulin and a plank — it puts a lit face and a shaded face on
    // every one of them, which is also what stops the square's brightest object
    // being one unbroken value.
    for (let s2 = -1; s2 <= 1; s2 += 2) {
      M.box(x, 2.62, z + s2 * 0.88, 4.3, 0.09, 1.85, awn[i % 3], s2 * 0.13, 0, 0);
    }
    const tc = trim[i % trim.length];
    M.box(x, 2.80, z, 4.35, 0.12, 0.34, tc);          // the ridge, in the pitch's colour
    // every third pitch has a striped tarp thrown over the cream, which is the
    // one thing that stops fourteen white slabs being one white slab
    if (i % 3 === 1) {
      for (let s3 = -1; s3 <= 1; s3 += 2) {
        for (let k = 0; k < 3; k++) {
          M.box(x - 1.4 + k * 1.4, 2.66, z + s3 * 0.88, 0.62, 0.05, 1.9, tc, s3 * 0.13, 0, 0);
        }
      }
    }
    // a valance along the front of the awning, which every one of them has and
    // which is the difference between a market stall and a trestle under a slab
    const zf = z + (z > 4 ? -1.72 : 1.72);          // the edge facing the crowd
    for (let k = 0; k < 6; k++) {
      M.box(x - 1.75 + k * 0.7, 2.51, zf, 0.6, 0.32, 0.05, k % 2 ? tc : awn[(i + k) % 3]);
    }
    // the numbered board every stall on that square carries, and it really is
    // a number — there are a hundred of them and they are licensed
    M.box(x - 1.5, 2.30, z - 1.6, 0.7, 0.44, 0.06, PALETTE.sahTileWhite);
    M.box(x - 1.5, 2.30, z - 1.62, 0.28, 0.26, 0.02, tc);
    // ---- AND A LAMP UNDER EVERY ONE ---------------------------------------
    // The chapter ends after dark at the desert camp and its third act begins
    // with the storm, so the medina is seen under a dusk sky for a good part of
    // the playing time — and there was not one light source in the whole
    // square except fourteen discs of ember paint in the braziers. A pressure
    // lamp hung off the ridge pole is what every one of these actually has.
    M.cyl(x + 0.9, 2.44, zf, 0.03, 0.30, PALETTE.sahBrassDk);      // the flex
    M.cyl(x + 0.9, 2.16, zf, 0.17, 0.10, PALETTE.sahBrassDk, 0, 0, 0, 6);
    LAMP.sph(x + 0.9, 2.05, zf, 0.13, 0.15, 0.13, 0xffffff);
    // a brazier, and the smoke off them is why the square is a photograph
    M.cyl(x + 1.9, 0.4, z + 1.4, 0.4, 0.8, PALETTE.sahBrassDk, 0, 0, 0, 6);
    M.cyl(x + 1.9, 0.85, z + 1.4, 0.36, 0.2, PALETTE.sahEmber, 0, 0, 0, 6);
    // ...AND IT SMOKES. The line above has said "the smoke off them is why the
    // square is a photograph" since the chapter was written, and there has
    // never been any: fourteen tin drums with a disc of ember paint in them.
    // Jemaa el-Fnaa at dusk is famously a wall of white smoke lit from
    // underneath, and it is the single cheapest thing this square can be given.
    sahBRAZIER.push(x + 1.9, 0.9, z + 1.4);
    // a stack of glasses and a samovar, because the other half of that square
    // is mint tea
    M.cyl(x - 1.9, 1.36, z + 1.3, 0.20, 0.52, PALETTE.sahBrass, 0, 0, 0, 6);
    M.cone(x - 1.9, 1.72, z + 1.3, 0.19, 0.24, PALETTE.sahBrassDk, 0, 0, 0, 6);
    M.cyl(x - 1.9, 1.06, z + 1.3, 0.30, 0.08, PALETTE.sahBrassDk, 0, 0, 0, 6);
    // and a bunch of mint on the counter, which is the only green in the square
    M.box(x + 0.4, 1.34, z - 0.9, 0.42, 0.22, 0.34, PALETTE.sahMint, 0.2, i * 0.7, 0);
    // AND SOMETHING ON THE TABLE. A trestle with a bare white top is a trestle;
    // what makes it a food stall is that it is covered in things — the tagines
    // in a row, the tea glasses, the tin of coriander nobody has moved in years.
    for (let k = 0; k < 5; k++) {
      const tx = x - 1.3 + k * 0.65;
      M.cyl(tx, 1.24, z - 0.35, 0.22, 0.14, PALETTE.sahBrassDk, 0, 0, 0, 6);
      M.cone(tx, 1.46, z - 0.35, 0.22, 0.42, PALETTE.sahCedarDk, 0, 0, 0, 6);
    }
    for (let k = 0; k < 4; k++) {
      M.cyl(x - 0.9 + k * 0.6, 1.24, z + 0.55, 0.07, 0.16, PALETTE.sahTileGreen, 0, 0, 0, 6);
    }
    M.box(x + 1.3, 1.30, z + 0.4, 0.34, 0.26, 0.34, PALETTE.sahDye3);
    // THE BOX STARTED SIXTY CENTIMETRES OFF THE GROUND. 1.1 +/- 0.5 is y
    // 0.6 to 1.6, so the trestle a stall stands on had nothing behind it and
    // the audit's chest ray at terrain + 0.55 passed five centimetres UNDER the
    // whole thing — which is why six of Marrakech's walk-through hits are on
    // the square and why the capybara, whose collider tops out at 0.68, only
    // just caught the underside of the counter. A stall reaches the floor.
    stallGrp.add(x, 1.15, z, 3.4, 2.3, 2.4);
    // the man behind it, and the two people eating at it
    sahAddPerson(x - Math.cos(a) * 1.4, 0, z - Math.sin(a) * 1.4,
                 Math.atan2(Math.cos(a), Math.sin(a)), sahPPL_STAND);
    if (i % 2 === 0) {
      sahAddPerson(x + Math.cos(a) * 1.9 + rand(-0.6, 0.6), 0,
                   z + Math.sin(a) * 1.9 + rand(-0.6, 0.6),
                   Math.atan2(-Math.cos(a), -Math.sin(a)), sahPPL_STAND);
    }
  }

  stallGrp.done();

  // the fourteen lamps, self-illuminated, one draw call, never a caster
  {
    const lm = new THREE.Mesh(LAMP.build(),
      mat(0x000000, { emissive: PALETTE.sahLamp, emissiveIntensity: 0.5 }));
    lm.castShadow = false;
    lm.receiveShadow = false;
    lm.userData.noShadow = true;
    root.add(lm);
    sahStallLamps = lm;
  }

  // --- the storytellers' rings ---------------------------------------------
  // A halqa is a RING OF PEOPLE. Drawn as "a bare patch with a drum in the
  // middle" it is a bare patch with a drum in the middle, which is what the
  // instrumented shot of the square shows three of.
  for (let i = 0; i < 3; i++) {
    const x = -14 + i * 14, z = 16;
    // no bare disc under it any more: the wear is painted into the ground mesh
    M.cyl(x, 0.4, z, 0.7, 0.8, PALETTE.sahTent, 0, 0, 0, 6);
    M.cyl(x, 0.82, z, 0.72, 0.08, PALETTE.sahCanvas, 0, 0, 0, 6);
    // and the props of the trade: a lantern on a stick, a satchel, a stool
    M.cyl(x - 1.4, 0.9, z - 0.6, 0.05, 1.8, PALETTE.sahCedarDk);
    M.cyl(x - 1.4, 1.86, z - 0.6, 0.20, 0.34, PALETTE.sahBrass, 0, 0, 0, 6);
    M.cone(x - 1.4, 2.12, z - 0.6, 0.22, 0.26, PALETTE.sahBrassDk, 0, 0, 0, 6);
    M.box(x + 1.6, 0.22, z - 0.9, 0.5, 0.44, 0.34, PALETTE.sahDye4, 0, 0.6, 0);
    // the storyteller himself, standing at the drum, and the ring round him
    sahAddPerson(x + 0.9, 0, z + 0.3, -1.2, sahPPL_STAND);
    // THE RING IS A ROOM AND A ROOM HAS A BEAT. Every sitter in this chapter
    // was one breathing loop on its own phase, which is right for the alleys
    // and wrong for a halqa: a storyteller's ring is thirteen people all
    // listening to the SAME sentence, and what they do — lean in at the turn,
    // rock back and laugh at the end of it — they do together. So the ring is
    // registered here and sahUpdatePeople gives everybody inside it the ring's
    // own clock on top of their own. Three rings, three different clocks, so
    // the square still has no metronome in it.
    sahHALQA.push(x, z, 4.4 + i * 1.9);
    const n = 11 + i * 2;
    for (let k = 0; k < n; k++) {
      const a2 = k / n * 6.283 + rand(-0.12, 0.12);
      const r = 2.6 + rand(0, 1.5);
      // they sit facing IN, which is the only thing that makes a ring a ring
      sahAddPerson(x + Math.cos(a2) * r, 0, z + Math.sin(a2) * r,
                   Math.atan2(-Math.cos(a2), -Math.sin(a2)), sahPPL_SIT);
    }
    // and the two or three at the back who are standing to see over them
    for (let k = 0; k < 3; k++) {
      const a2 = rand(0, 6.283), r = 4.4 + rand(0, 1.4);
      sahAddPerson(x + Math.cos(a2) * r, 0, z + Math.sin(a2) * r,
                   Math.atan2(-Math.cos(a2), -Math.sin(a2)), sahPPL_STAND);
    }
  }
  // and the loose traffic across the rest of the square, which is most of what
  // a square is: people on their way somewhere else
  for (let i = 0; i < 16; i++) {
    const a2 = rand(0, 6.283), r = rand(4, 24);
    const x = Math.cos(a2) * r, z = 4 + Math.sin(a2) * r * 0.7;
    if (Math.abs(x - sahACRO.x) < 4 && Math.abs(z - sahACRO.z) < 4) continue;
    if (Math.abs(x - sahCART.x) < 3 && Math.abs(z - sahCART.z) < 3) continue;
    sahAddPerson(x, 0, z, rand(0, 6.283), sahPPL_STAND);
  }

  // --- the wall and the gate -------------------------------------------------
  // BAB AGNAOU WAS THREE METRES AWAY FROM THE HOLE IN ITS OWN WALL.
  //
  // The wall was laid at `z = -60 + i * 11` with a `continue` on
  // `|z - sahGATE.z| < 7`, which skips exactly one segment — the one at z = 17.
  // An 11 m box centred at 17 is skipped, so the gap in the masonry runs
  // z 11.5 → 22.5 and its centre is 17. The gate is authored at z = 14. So:
  // the south pier (z 5.0–10.2) stood ENTIRELY INSIDE the wall segment at z = 6,
  // invisible, collider and all; the north pier (17.8–23.0) stood in the middle
  // of the opening and swallowed half of it; and the horseshoe ring, centred on
  // 14 with a 4.6 m radius, sprang from 9.4 and 18.6 — off the hole at both
  // ends. Measured from the rendered frame: the arch is visibly shunted to one
  // side of its own doorway and the usable gap is 6.3 m of the 11 that were
  // drawn. The only way out of the city on foot.
  //
  // The wall is now laid FROM the piers outward — 7 bays south toward the souk
  // and 4 north — so the opening is where the gate is by construction, and
  // sahGATE_HW / sahGATE_OUT are the only place either is defined.
  const gz = sahGATE.z;
  const wallSpans = [];
  for (let i = 0; i < 7; i++) wallSpans.push(gz - sahGATE_OUT - 5.75 - i * 11.5);
  for (let i = 0; i < 4; i++) wallSpans.push(gz + sahGATE_OUT + 5.75 + i * 11.5);
  const wallGrp = sahStaticGroup(game);
  for (let i = 0; i < wallSpans.length; i++) {
    const z = wallSpans[i];
    M.box(70, 4.4, z, 3.0, 8.8, 11.4, i % 2 ? PALETTE.sahOchre : PALETTE.sahOchreDk);
    M.box(70, 9.1, z, 3.4, 0.9, 11.4, PALETTE.sahOchreDk);
    // ---- MERLONS. An Almohad wall is finished with stepped square teeth and
    // this one had a plain coping: eleven segments of rounded-off box, which
    // from the square reads as a garden wall a hundred and thirty metres long.
    for (let k = 0; k < 5; k++) {
      M.box(70, 10.1, z - 4.6 + k * 2.3, 3.0, 1.1, 1.1, PALETTE.sahOchrePale);
      M.box(70, 10.9, z - 4.6 + k * 2.3, 2.2, 0.6, 0.7, PALETTE.sahOchreDk);
    }
    // and a square tower every third bay, which is what actually stops a
    // hundred and thirty metres of wall reading as one extruded rectangle
    if (i % 3 === 1) {
      M.box(70, 6.2, z, 5.0, 12.4, 5.0, PALETTE.sahOchre);
      M.box(70, 12.7, z, 5.6, 0.8, 5.6, PALETTE.sahOchreDk);
      for (let k = 0; k < 3; k++) {
        for (let e = -1; e <= 1; e += 2) {
          M.box(70 + e * 2.2, 13.7, z - 1.7 + k * 1.7, 0.8, 1.2, 0.9, PALETTE.sahOchrePale);
        }
      }
      wallGrp.add(70, 6.2, z, 5.0, 12.4, 5.0);
    }
    wallGrp.add(70, 4.4, z, 3.0, 8.8, 11.4);
  }
  // the gate: two piers that stand at the EDGES of the opening, a horseshoe of
  // voussoirs sprung from exactly those piers, and a decorated spandrel over it
  for (let s = -1; s <= 1; s += 2) {
    M.box(70, 4.4, gz + s * (sahGATE_HW + 2.4), 5.2, 8.8, 4.8, PALETTE.sahOchrePale);
    wallGrp.add(70, 4.4, gz + s * (sahGATE_HW + 2.4), 5.2, 8.8, 4.8);
  }
  // ---- EVERY ARCH IN THIS CHAPTER WAS ROTATED IN THE WRONG PLANE ----------
  //
  // A voussoir is a box whose local +Y must point radially out of the arch's
  // centre. sahXform composes Ry·Rx·Rz, and `Rz` turns a vector about the world
  // Z AXIS — it maps +Y to (−sinθ, cosθ, 0), which always lies in the XY plane.
  // Bab Agnaou's ring stands in the YZ plane (it varies in y and z, x is the
  // wall's thickness), so no value of rz can ever point a voussoir along it:
  // every block in the ring was rolled sideways out of the wall instead of
  // being turned round the arch, and the rendered gate is a pile of slabs
  // leaning at the camera.
  //
  //   arch in the YZ plane, position (X, CY + sin a·R, CZ − cos a·R):
  //     radial = (0, sin a, −cos a)   ->  Rx(a − π/2).  rx, NOT rz.
  //   arch in the XY plane, position (CX − cos a·R, CY + sin a·R, Z):
  //     radial = (−cos a, sin a, 0)   ->  Rz(π/2 − a).
  //
  // The Drift's arch got this right for the XY case and left a note about it
  // (drift.js, "THE ROLL GOES THE OTHER WAY"); nothing in Marrakech ever did,
  // and there are four arches here — the gate, its spandrel band, the mosque
  // arcade and twenty panels of blind arcading up the minaret.
  //
  // The horseshoe's widest point is at aa = -0.34, i.e. cos(0.34) * GR = 0.943
  // GR — so with GR = the half-opening the arch's feet land 28 cm inside the
  // pier faces, which is a jamb and not a gap of daylight.
  const GR = sahGATE_HW;
  for (let k = 0; k <= 16; k++) {
    const a = Math.PI * (k / 16);
    // a horseshoe arch continues PAST the semicircle, which is the whole
    // difference between a Moorish arch and a Roman one
    const aa = -0.34 + a * (1 + 0.68 / Math.PI);
    M.box(70, 4.6 + Math.sin(aa) * GR, gz - Math.cos(aa) * GR, 3.5, 1.15, 1.30,
      k % 2 ? PALETTE.sahOchrePale : PALETTE.sahOchreDk, aa - Math.PI / 2, 0, 0);
  }
  // the interlacing band that frames every Almohad gate: a second ring one
  // metre out, and then the rectangular alfiz round the lot of it
  for (let k = 0; k <= 22; k++) {
    const a = -0.42 + (k / 22) * (Math.PI + 0.84);
    M.box(68.2, 4.6 + Math.sin(a) * (GR + 1.15), gz - Math.cos(a) * (GR + 1.15),
          0.5, 0.62, 1.15, PALETTE.sahOchreDust, a - Math.PI / 2, 0, 0);
  }
  for (let s = -1; s <= 1; s += 2) {
    M.box(68.2, 7.0, gz + s * (GR + 1.95), 0.5, 9.6, 0.7, PALETTE.sahOchreDust);
  }
  M.box(68.2, 11.6, gz, 0.5, 0.7, (GR + 2.3) * 2, PALETTE.sahOchreDust);
  // the merlons over the gate itself, standing higher than the wall's
  for (let k = 0; k < 7; k++) {
    M.box(70, 12.3, gz - 6.9 + k * 2.3, 3.4, 1.3, 1.2, PALETTE.sahOchrePale);
    M.box(70, 13.2, gz - 6.9 + k * 2.3, 2.6, 0.7, 0.8, PALETTE.sahOchreDk);
  }
  M.box(70, 11.9, gz, 4.4, 2.4, (GR + 3.0) * 2, PALETTE.sahOchre);
  wallGrp.done();

  const mesh = new THREE.Mesh(M.build(), sahVC());
  mesh.castShadow = true; mesh.receiveShadow = true;
  root.add(mesh);
}

/**
 * THE KOUTOUBIA. Twelfth century, seventy-seven metres, and every minaret built
 * in the western half of the Islamic world since is a copy of it — Seville's
 * Giralda and the Hassan Tower in Rabat are the same drawing. The band of green
 * faience near the top and the four copper spheres on the finial are the two
 * things that make it unmistakable, so both are here and everything else is a
 * rectangle.
 */
function sahBuildKoutoubia(game, root) {
  const M = sahMerger();
  const H = sahKOUTOUBIA.h;
  M.box(0, H * 0.5, 0, 8.4, H, 8.4, PALETTE.sahOchre);
  // the blind arcading up each face — one recessed band per storey
  for (let k = 0; k < 5; k++) {
    const y = 4 + k * (H - 10) / 5;
    for (let s = -1; s <= 1; s += 2) {
      M.box(s * 4.3, y, 0, 0.3, 4.0, 5.0, PALETTE.sahOchreDk);
      M.box(0, y, s * 4.3, 5.0, 4.0, 0.3, PALETTE.sahOchreDk);
      // ...AND THE ARCH AT THE TOP OF EACH PANEL. What the Koutoubia actually
      // is, from two hundred metres, is a grid of interlocking lobed arches:
      // five recessed rectangles per face is a filing cabinet. Four voussoirs
      // over each panel is the whole difference, and there are twenty panels.
      // rx for the pair that stand in the YZ plane, rz = π/2 − a for the pair
      // in XY — see the derivation at Bab Agnaou. Every arch in this chapter
      // was rolled about the world Z axis regardless of which plane it was in.
      for (let v = 0; v <= 5; v++) {
        const va = Math.PI * (v / 5), aa = -0.28 + va * (1 + 0.56 / Math.PI);
        const R2 = 2.3;
        M.box(s * 4.32, y + 1.35 + Math.sin(aa) * R2, -Math.cos(aa) * R2,
              0.30, 0.50, 1.45, PALETTE.sahOchreDust, aa - Math.PI * 0.5, 0, 0);
        M.box(-Math.cos(aa) * R2, y + 1.35 + Math.sin(aa) * R2, s * 4.32,
              1.45, 0.50, 0.30, PALETTE.sahOchreDust, 0, 0, Math.PI * 0.5 - aa);
      }
    }
  }
  // the merlons that ring the shaft under the lantern
  for (let k = 0; k < 4; k++) {
    for (let s = -1; s <= 1; s += 2) {
      M.box(s * 4.4, H + 0.6, -3.3 + k * 2.2, 0.9, 1.2, 0.9, PALETTE.sahOchrePale);
      M.box(-3.3 + k * 2.2, H + 0.6, s * 4.4, 0.9, 1.2, 0.9, PALETTE.sahOchrePale);
    }
  }
  // the faience band
  M.box(0, H - 3.4, 0, 8.9, 2.0, 8.9, PALETTE.sahTileGreen);
  M.box(0, H - 2.0, 0, 8.9, 0.5, 8.9, PALETTE.sahTileWhite);
  // the lantern and the finial
  M.box(0, H + 2.6, 0, 4.6, 5.2, 4.6, PALETTE.sahOchrePale);
  M.box(0, H + 5.5, 0, 5.2, 0.7, 5.2, PALETTE.sahOchreDk);
  M.cyl(0, H + 7.6, 0, 0.22, 4.0, PALETTE.sahBrassDk);
  for (let k = 0; k < 4; k++) {
    M.sph(0, H + 6.4 + k * 0.9, 0, 0.9 - k * 0.17, 0.9 - k * 0.17, 0.9 - k * 0.17, PALETTE.sahBrass);
  }
  // ---- AND THE MOSQUE UNDER IT --------------------------------------------
  // The Koutoubia is not a tower. It is a seventeen-aisle hypostyle prayer
  // hall with a minaret on the corner of it, and this chapter had the minaret
  // standing on its own in the middle of an empty orange plain — which is
  // both wrong and, more to the point, leaves the biggest landmark in the
  // medina with nothing at its foot to give it a scale. A low mass of roofs
  // with a courtyard beside it costs one merge and fixes both.
  {
    const hw = 26, hd = 21;
    M.box(-hw * 0.5 - 5, 4.4, -hd * 0.5 + 3, hw, 8.8, hd, PALETTE.sahOchre);
    M.box(-hw * 0.5 - 5, 9.1, -hd * 0.5 + 3, hw + 1.2, 0.7, hd + 1.2, PALETTE.sahOchreDk);
    // the aisles read as a ridged roof, which is what a hypostyle hall is from
    // the air and is the only thing that separates it from a warehouse
    for (let k = 0; k < 7; k++) {
      M.box(-hw * 0.5 - 5, 9.9, -hd * 0.5 + 3 - hd * 0.5 + 1.8 + k * 2.9,
            hw + 0.6, 1.0, 1.6, PALETTE.sahOchrePale);
    }
    // the arcade along the courtyard side, which is where the shade is
    const arc = sahStaticGroup(game);
    for (let k = 0; k < 9; k++) {
      const ax = -hw - 5 + 1.5 + k * 3.0;
      M.box(ax, 3.0, 5.4, 1.2, 6.0, 1.2, PALETTE.sahOchrePale);
      arc.add(sahKOUTOUBIA.x + ax, 3.0, sahKOUTOUBIA.z + 5.4, 1.2, 6.0, 1.2);
      // A COLONNADE WITHOUT ARCHES IS A ROW OF POSTS. Nine square piers with a
      // lintel over them, in the one building in this chapter whose entire
      // vocabulary is the horseshoe arch — see Bab Agnaou, forty metres east.
      // Five voussoirs a bay, sprung off the piers, is what turns it into a
      // riwaq and it is the shot from the spawn point.
      if (k < 8) {
        // this ring stands in the XY plane, so rz = π/2 − a. It was aa + π/2,
        // which is the same slabs turned a hundred and eighty degrees out.
        for (let v = 0; v <= 5; v++) {
          const va = Math.PI * (v / 5), aa = -0.3 + va * (1 + 0.6 / Math.PI);
          const R2 = 1.15;
          M.box(ax + 1.5 - Math.cos(aa) * R2, 5.0 + Math.sin(aa) * R2, 5.4,
                Math.PI * R2 / 5 + 0.3, 0.62, 1.3,
                v % 2 ? PALETTE.sahOchreDk : PALETTE.sahOchrePale, 0, 0, Math.PI * 0.5 - aa);
        }
      }
      M.box(ax + 1.5, 6.4, 5.4, 1.9, 0.5, 1.3, PALETTE.sahOchreDk, 0, 0, 0);
    }
    arc.done();
    M.box(-hw * 0.5 - 5, 7.0, 5.4, hw, 0.9, 1.8, PALETTE.sahOchreDk);
    // the crenellation along the hall's parapet, which every Almohad roof has
    for (let k = 0; k < 11; k++) {
      M.box(-hw - 5 + 1.2 + k * 2.4, 9.85, 6.1, 0.9, 0.9, 0.9, PALETTE.sahOchrePale);
    }
    sahStaticBox(game, sahKOUTOUBIA.x - hw * 0.5 - 5, 4.4,
                 sahKOUTOUBIA.z - hd * 0.5 + 3, hw, 8.8, hd);
  }

  const mesh = new THREE.Mesh(M.build(), sahVC());
  mesh.position.set(sahKOUTOUBIA.x, 0, sahKOUTOUBIA.z);
  mesh.castShadow = true; mesh.receiveShadow = true;
  root.add(mesh);
  sahStaticBox(game, sahKOUTOUBIA.x, H * 0.5, sahKOUTOUBIA.z, 8.4, H, 8.4);

  // the walled garden at its foot, which is the only shade in the medina
  const GM = sahMerger();
  GM.box(0, 0.03, 0, 44, 0.06, 30, PALETTE.sahOchreDust);
  // the wall it is walled by, which the name promised and nothing delivered
  // ...and it is solid. A garden wall you walk through is the same joke as a
  // pise wall you walk through, and the audit found twenty-seven samples of it.
  const gx = sahKOUTOUBIA.x, gz = sahKOUTOUBIA.z + 26;
  for (let s = -1; s <= 1; s += 2) {
    GM.box(0, 0.85, s * 15, 44, 1.7, 0.6, PALETTE.sahOchreDk);
    GM.box(s * 22, 0.85, 0, 0.6, 1.7, 30.6, PALETTE.sahOchreDk);
    sahStaticBox(game, gx, 0.85, gz + s * 15, 44, 1.7, 0.7);
    sahStaticBox(game, gx + s * 22, 0.85, gz, 0.7, 1.7, 30.6);
  }
  // the water channel down the middle, which is what a riad garden is FOR
  GM.box(0, -0.10, 0, 34, 0.30, 1.4, PALETTE.sahTileBlue);
  GM.box(0, 0.10, 0, 34.8, 0.14, 2.2, PALETTE.sahTileWhite);
  GM.box(0, -0.06, 0, 8.0, 0.26, 8.0, PALETTE.sahTileBlue);
  for (let i = 0; i < 20; i++) {
    const x = rand(-20, 20), z = rand(-13, 13);
    if (Math.abs(z) < 2.2) continue;                 // not in the channel
    GM.cyl(x, 2.2, z, 0.32, 4.4, PALETTE.sahPalmTrunk);
    // ...and the trunk is solid (V1): twenty palms in a walled garden whose
    // wall was made solid and whose trees were not. World space — the merged
    // mesh is positioned at the garden's centre below, and a body is not.
    sahStaticBox(game, sahKOUTOUBIA.x + x, 2.2, sahKOUTOUBIA.z + 26 + z, 0.52, 4.4, 0.52);
    // THE SAME FOUNTAIN, NOT A PROPELLER — see sahBuildPalmeraie. These are the
    // twenty palms directly behind the spawn and they were the flattest thing
    // in the frame.
    GM.cyl(x, 4.25, z, 0.62, 0.7, PALETTE.sahPalmTrunk, 0, rand(0, 6.28), 0, 6);
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * 6.283 + i;
      const ca = Math.cos(a), sa = Math.sin(a);
      GM.box(x + ca * 0.95, 4.85, z + sa * 0.95, 2.1, 0.13, 0.48,
        PALETTE.sahPalm, 0, -a, -0.32);
      GM.box(x + ca * 2.45, 4.55, z + sa * 2.45, 2.2, 0.11, 0.38,
        PALETTE.sahPalm, 0, -a, 0.58);
    }
  }
  const gm = new THREE.Mesh(GM.build(), sahVC());
  gm.position.set(sahKOUTOUBIA.x, 0, sahKOUTOUBIA.z + 26);
  gm.castShadow = true; gm.receiveShadow = true;
  root.add(gm);
}

/** The orange juice cart, of which there are ninety on the square and they are
 *  numbered, and the snake charmer's basket, which is his own problem. */
function sahBuildProps(game, root) {
  const g = new THREE.Group();
  const M = sahMerger();
  M.box(0, 0.9, 0, 3.2, 0.16, 1.8, PALETTE.sahCanvas);
  M.box(0, 0.45, 0, 3.0, 0.8, 1.6, PALETTE.sahDye1);
  M.cyl(-1.3, 0.3, 0.9, 0.32, 0.16, PALETTE.sahCedarDk, Math.PI / 2, 0, 0, 8);
  M.cyl(1.3, 0.3, 0.9, 0.32, 0.16, PALETTE.sahCedarDk, Math.PI / 2, 0, 0, 8);
  // the pyramid of oranges, which is the entire point of the cart
  for (let r = 0; r < 4; r++) {
    const n = 5 - r;
    for (let a = 0; a < n; a++) {
      for (let b = 0; b < n; b++) {
        M.sph(-0.5 + (a - (n - 1) / 2) * 0.30, 1.12 + r * 0.26, (b - (n - 1) / 2) * 0.30,
          0.16, 0.16, 0.16, PALETTE.sahOrange);
      }
    }
  }
  M.box(0, 2.3, 0, 3.6, 0.10, 2.2, PALETTE.sahCanvas);
  M.cyl(-1.6, 1.65, 0, 0.06, 1.4, PALETTE.sahBrassDk);
  M.cyl(1.6, 1.65, 0, 0.06, 1.4, PALETTE.sahBrassDk);
  const mesh = new THREE.Mesh(M.build(), sahVC());
  mesh.castShadow = true; mesh.receiveShadow = true;
  g.add(mesh);
  g.position.set(sahCART.x, sahTerrain(sahCART.x, sahCART.z), sahCART.z);
  root.add(g);
  sahCartGroup = g;
  // A CART IS A CART. The audit walked through it, which is a poor advertisement
  // for the object the whole souk chase is triggered by robbing — you cannot
  // steal from something you can stand inside. Body only, not the awning: a
  // canopy you bounce off at head height would be worse than one you do not.
  sahStaticBox(game, sahCART.x, sahTerrain(sahCART.x, sahCART.z) + 0.62,
               sahCART.z, 3.2, 1.24, 1.8);

  // --- the basket ------------------------------------------------------------
  // ======= AND IT HAD A LID ON IT, WHICH IS THE ICELAND BUG AGAIN ==========
  //
  // The task is 'Sit in the snake charmer's basket'. What stood here was a
  // SOLID cylinder 1.44 m across and 85 cm tall with a cone dead-centre on top
  // of it — the comment says "the lid, off to one side" and the geometry puts
  // it at (0, 1.16, 0), i.e. on. There was no hole, no floor and no way in, and
  // `sahUpdateTasks` ticked the row the moment the animal came within 2.2 m of
  // the middle with no input at all. So the chapter's third line — the one it
  // gives you before it shows you the chase — was 'walk within two metres of a
  // sealed drum'. Exactly the shape of Iceland's hot spring, whose silica rim
  // was a plate over the whole pool.
  //
  // A basket is a RING. Sixteen staves round an open middle, a floor sunk to
  // ankle height, a rim at 45 cm (the animal steps 0.4 and hops 1.4, so getting
  // in is a deliberate hop and getting out can never fail), and the lid where
  // the comment always said it was: on the sand, leaning against the side.
  const bg = new THREE.Group();
  const B = sahMerger();
  const bR = 0.98;                       // inside radius: a capybara is 0.9 long
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * 6.283;
    const lean = 0.05 + (i % 3) * 0.015;   // it bulges, because it is woven
    B.box(Math.cos(a) * bR, 0.24, Math.sin(a) * bR, 0.30, 0.48, 0.13,
          i % 2 ? PALETTE.sahRope : PALETTE.sahCedar, 0, -a, lean);
  }
  // two woven hoops, which is what stops sixteen staves reading as a fence
  B.cyl(0, 0.14, 0, bR + 0.07, 0.09, PALETTE.sahCedarDk, 0, 0, 0, 8);
  B.cyl(0, 0.44, 0, bR + 0.09, 0.10, PALETTE.sahCedarDk, 0, 0, 0, 8);
  // the floor, sunk, so the inside is a place and not a hole in the ground
  B.cyl(0, 0.06, 0, bR - 0.02, 0.12, PALETTE.sahTent, 0, 0, 0, 8);
  // the lid, OFF and leaning against the side, which is how you know it is open
  // (small, and nearly flat on the sand: the first cut was a 1.3 m cone stood
  //  on end beside the basket and it photographed as a boulder.)
  B.cyl(bR + 0.62, 0.09, -0.46, 0.60, 0.13, PALETTE.sahRope, 0.34, 0.4, 0.16, 8);
  B.cyl(bR + 0.66, 0.17, -0.50, 0.22, 0.10, PALETTE.sahCedarDk, 0.34, 0.4, 0.16, 6);
  // the man, his flute, and a cobra that has heard this tune before
  B.cyl(-1.9, 0.5, 0.4, 0.42, 1.0, PALETTE.sahCanvas, 0, 0, 0, 6);
  B.sph(-1.9, 1.25, 0.4, 0.28, 0.30, 0.28, PALETTE.sahOchreDk);
  B.cyl(-1.4, 1.1, 0.4, 0.05, 0.9, PALETTE.sahCedar, 0, 0, 1.1);
  const bm = new THREE.Mesh(B.build(), sahVC());
  bm.castShadow = true;
  bg.add(bm);
  // ---- THE COBRA, WHICH IS THE WHOLE JOKE AND WAS NOT DRAWN --------------
  // Its own group, because it comes up out of the basket when something sits
  // in it and goes back down when whatever it is leaves. Seven segments on a
  // taper with a hood and two eyes, and it sways: see sahUpdateTasks.
  const cg2 = new THREE.Group();
  const C = sahMerger();
  for (let i = 0; i < 7; i++) {
    const u = i / 6;
    C.cyl(Math.sin(u * 3.1) * 0.10, 0.10 + u * 0.62, 0, 0.13 - u * 0.045, 0.16,
          i % 2 ? PALETTE.sahTileGreen : PALETTE.sahCedarDk, 0, 0, 0, 6);
  }
  C.box(0.02, 0.80, 0, 0.34, 0.30, 0.10, PALETTE.sahTileGreen);      // the hood
  C.sph(0.02, 0.86, 0, 0.11, 0.10, 0.13, PALETTE.sahCedarDk);        // the head
  C.sph(0.06, 0.89, 0.07, 0.03, 0.03, 0.03, PALETTE.sahTileWhite);
  C.sph(0.06, 0.89, -0.07, 0.03, 0.03, 0.03, PALETTE.sahTileWhite);
  const cm = new THREE.Mesh(C.build(), sahVC());
  cm.castShadow = false;
  cm.userData.noShadow = true;      // this file's own flag; see sahNoShadowOnGhosts
  cg2.add(cm);
  cg2.position.set(0, -0.9, 0);          // asleep, below the rim
  cg2.visible = false;
  bg.add(cg2);
  sahCobraGroup = cg2;
  // THE RIM IS SOLID. Eight small boxes on one body — you have to hop in, which
  // is the entire difference between a task and a proximity switch. Nothing is
  // taller than 48 cm, so the hop out is never in doubt.
  {
    const rg = sahStaticGroup(game);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * 6.283;
      rg.add(sahSNAKE.x + Math.cos(a) * bR, sahTerrain(sahSNAKE.x, sahSNAKE.z) + 0.24,
             sahSNAKE.z + Math.sin(a) * bR, 0.62, 0.48, 0.22, -a);
    }
    rg.done();
  }
  bg.position.set(sahSNAKE.x, sahTerrain(sahSNAKE.x, sahSNAKE.z), sahSNAKE.z);
  root.add(bg);
  sahBasketGroup = bg;
  // and the audience, sitting round him at a respectful distance, which on
  // that square means about two metres
  for (let i = 0; i < 8; i++) {
    const a = 1.1 + i / 8 * 4.3;
    const r = 3.0 + rand(0, 1.2);
    const px = sahSNAKE.x + Math.cos(a) * r, pz = sahSNAKE.z + Math.sin(a) * r;
    sahAddPerson(px, 0, pz, Math.atan2(sahSNAKE.x - px, sahSNAKE.z - pz), sahPPL_SIT);
  }
}

// =================================================================== PEOPLE ==
/**
 * JEMAA EL-FNAA, AND THERE WAS NOBODY IN IT.
 *
 * The busiest square in Africa: fourteen food stalls with nobody behind them,
 * three storytellers' rings drawn as a bare patch with a drum in the middle
 * and nobody round it, a souk of thirty-two blocks with a stall front on every
 * one and nobody at any of them, and a gnawa camp at the foot of the dune with
 * a guembri, a tbel and a heap of qraqeb lying on the sand — for a task whose
 * whole premise is TAKING OVER THE BAND from a band that did not exist.
 *
 * The census before this was six pursuers (idle, and white boxes), four
 * acrobats, and three locals. The instrumented shot of the square is a car
 * park with trestle tables in it.
 *
 * Same shape as Rio's cast, and for the same reasons: one merged figure, two
 * instanced meshes, a djellaba colour and a skin colour per person, and a pose
 * chosen once with a motion that runs every frame.
 *
 *   STAND  at a stall, in the alleys, along the wall. Shifts its weight.
 *   SIT    round a storyteller's ring and on the camp's carpets, cross-legged
 *          and leaning in, which is the entire posture of that square at dusk.
 *   PLAY   the gnawa at the fire. They rock on the beat, and when the capybara
 *          takes the band over they come UP — see sahFireTakeover.
 */
const sahPPL_MAX = 250;
const sahPPL_STAND = 0, sahPPL_SIT = 1, sahPPL_PLAY = 2;
// ---- A CROWD THAT MOVES LESS THAN A PIXEL IS A CROWD OF STATUES (v20) -----
// The idle motion in sahUpdatePeople was a 1.4 cm bob at 0.9 rad/s and a 0.16
// rad sway at 0.23 rad/s — a twenty-seven second period on the only term big
// enough to see. MEASURED, from the chapter's own spawn, for the ninety-eight
// people inside thirty metres: the median person moved 0.58 PIXELS in seven
// tenths of a second and only 163 of 588 samples cleared one pixel at all.
// Every number in there was defensible on its own and the sum of them was a
// waxwork, which is exactly what "a lot of them do not animate at all" is.
//
// The fix is not a bigger sine. A person standing in a market square does not
// sway continuously — they stand still for several seconds and then MOVE:
// shift their weight, turn a quarter of the way round, lean in. So each person
// gets a decision clock, and between decisions they are as still as they
// always were. Staggered by construction (the interval is re-drawn per person
// per fidget), so the square can never beat in time with itself — which is the
// failure the original amplitudes were chosen to avoid, and it is avoided here
// by the stagger instead of by being too small to see.
const sahFID_A = 2.6, sahFID_B = 8.5;   // s between one person's decisions
const sahFID_STAND = 0.42;              // rad they turn through, either way
const sahFID_SIT   = 0.30;              // ...and a seated rock is smaller
const sahFID_L     = 2.6;               // damping: a fidget takes about 0.4 s
// ---- ...AND WHETHER ANYBODY HAS NOTICED YOU (D1) -------------------------
// The square held about a hundred and seventy people and the ONLY inputs to any
// of them were sahStorm, sahFireTakeover and sahTime. Not one read the animal's
// position. Jemaa el-Fnaa is the densest crowd in the game and it was the least
// alive place in it, which is the whole finding of ROADMAP-DEPTH.
//
// A TURN AND A LEAN, AND DELIBERATELY NOT A STEP. Every one of these people
// carries their own static box (see sahBuildPeopleBodies) placed once at build,
// and moving the drawn figure without moving the body is the exact fault this
// file already names — "a figure that slides across the ground without moving".
// Backing away half a metre would need 170 body writes and a desync risk for
// the smallest half of the effect. The turn is the large half: a figure that
// tracks you across a square stops being scenery in about four frames.
// ---- A PLATEAU, NOT A RAMP, AND IT WAS MEASURED WRONG FIRST -------------
// The first cut wrote want = 1 - d/R, which reads as "notices you more the
// closer you get" and is not how noticing works: somebody six metres away has
// either seen a giant rodent or has not. That shape put full attention only
// at arm's length — at 6 m of a 7.5 m radius it is 0.2, so a fifth of a turn —
// and it measured as nothing. Mean |bearing error| over the near band came
// back at 1.363 rad against a far-band control of 1.478, where a crowd facing
// away at random scores pi/2 = 1.571 and one that has turned scores near 0.
// So: full inside (R - EDGE), falling off across the last EDGE metres, with
// the damp still doing all the smoothing in time.
const sahNOT_R       = 7.5;    // m — inside this, a person has noticed
const sahNOT_EDGE    = 2.2;    // m of falloff at the rim
const sahNOT_L       = 3.2;    // damping — about half a second to come round
const sahNOT_LEAN    = 0.13;   // rad of lean AWAY at full notice (+rx is back)
const sahNOT_WHEEK   = 3.1;    // s — a shout holds the radius open this long
const sahNOT_WHEEK_K = 2.4;    // ...and multiplies it by this
// How far round each kind actually comes. Somebody sitting cross-legged in a
// halqa does not swing their whole body at you; they turn from the waist.
const sahNOT_TURN = [1.0, 0.55, 0.5];   // STAND, SIT, PLAY
let sahNotWheek = 0;

// 15, not 14: index 14 is the damped notice above.
// 16, not 15: index 15 is M4's shove, and see the note above index 14.
const sahPPL_STRIDE = 16;
// ---- M4: SOMEBODY JUST PUSHED PAST ME ------------------------------------
// Under the souk roof you cannot see a trader coming. You can see the crowd
// he is coming THROUGH, and until this term you could not: sixty people stood
// perfectly still while six men ran between them. A pursuer inside sahPART_R
// of a person writes a SIGNED impulse into slot 15 — the sign is which side he
// went past on — and it damps back out over about a second. The chase now has
// a wake, and the wake is the only thing that tells you where the chase is
// when the mats are over your head.
const sahPART_R  = 1.7;         // m — arm's length plus a shoulder
const sahPART_R2 = sahPART_R * sahPART_R;
const sahPART_L  = 2.4;         // how fast it lets go
const sahPART_YAW = 0.62;       // rad at full — a turn, not a pirouette
const sahPART_LEAN = 0.20;      // ...and the sway that goes with it
let sahPplBody = null, sahPplHead = null, sahPplN = 0;
const sahPplBodies = [];        // one static box per instanced person
// x, y, z, yaw, kind, phase, rate, halqa (index+1 or 0), height,
// fidget clock, fidget now, fidget target, step distance this frame, gait phase,
// damped notice (14, D1), signed shove (15, M4)
const sahPplData = new Float32Array(sahPPL_MAX * sahPPL_STRIDE);
let sahPplBodyCol = null, sahPplHeadCol = null;
const sahPplCol = new THREE.Color();
// A MEDINA IS NOT A CARNIVAL. Marrakech's palette is earth with two or three
// saturated things allowed in it, and a crowd in fourteen bright shirts would
// undo the whole chapter — so the djellabas are the ochres, the canvas and the
// dyes the souk already sells, and nothing else.
const sahROBE = [PALETTE.sahCanvas, PALETTE.sahAwning, PALETTE.sahOchrePale,
                 PALETTE.sahPlaster, PALETTE.sahTileWhite, PALETTE.sahOchreDust,
                 PALETTE.sahDye1, PALETTE.sahDye2, PALETTE.sahDye3,
                 PALETTE.sahDye4, PALETTE.sahDye5, PALETTE.sahTent];
const sahSKIN = [PALETTE.skin3, PALETTE.skin4, PALETTE.skin2, PALETTE.skin3];

function sahBuildPeople(root) {
  const M = sahMerger();
  // A DJELLABA IS A CONE WITH A HOOD ON IT. That is not a simplification for
  // the poly budget — it is what the garment is, and it is why a crowd here
  // reads completely differently from a crowd in Rio at the same vertex count.
  M.cyl(0, 0.44, 0, 0.20, 0.88, 0xffffff, 0, 0, 0, 6);
  M.cyl(0, 1.02, 0, 0.26, 0.62, 0xffffff, 0, 0, 0, 6);
  M.cyl(0, 1.34, 0, 0.19, 0.18, 0xdedede, 0, 0, 0, 6);
  // the sleeves, which hang
  for (let s = -1; s <= 1; s += 2) {
    M.box(s * 0.26, 1.06, 0.02, 0.14, 0.58, 0.16, 0xffffff, -0.14, 0, s * 0.16);
  }
  // ---- AND FEET, WHICH ARE WHAT SAY WHICH WAY SOMEBODY IS FACING ----------
  // A hundred and seventy cones with a ball on top: from this camera the only
  // cue to a person's heading was the hood, and the hood is 19 cm across. Rio's
  // crowd learned the same thing about a nose. ONE box, not two — at 172 people
  // a second foot is 2,064 triangles in a chapter with three thousand to spare,
  // and at this camera height the pair reads as one pale slab under the hem
  // anyway.
  M.box(0, 0.035, 0.11, 0.28, 0.07, 0.27, 0xd8d0c4);
  const bodyGeo = M.build();
  const H = sahMerger();
  H.sph(0, 0, 0, 0.135, 0.155, 0.135, 0xffffff);
  // and the hood, thrown back, which is the whole silhouette
  H.cone(0, 0.13, -0.10, 0.19, 0.36, 0xe8e8e8, -0.55, 0, 0, 6);
  // A NOSE AND A BEARD, and nothing else — 24 triangles across 172 people.
  // instanceColor MULTIPLIES vColor, so both are authored as a fraction of
  // white and come out as a darker version of whatever skin the person got,
  // which is the only way a shared head mesh can carry a feature at all. The
  // nose is what makes the head a face at fifteen metres and it is the entire
  // reason a crowd of hooded figures has a direction; Rio's crowd learned this
  // and the medina's never did.
  H.box(0, -0.005, 0.135, 0.055, 0.075, 0.075, 0xcbb2a2);
  H.box(0, -0.098, 0.085, 0.135, 0.075, 0.105, 0x8f7a68);
  const headGeo = H.build();

  sahPplBody = new THREE.InstancedMesh(bodyGeo, sahVC(), sahPPL_MAX);
  sahPplHead = new THREE.InstancedMesh(headGeo, sahVC(), sahPPL_MAX);
  // Named like sahStorks and sahFronds are, because an anonymous InstancedMesh
  // is invisible to every audit that walks the scene graph — and the crowd is
  // the thing most worth measuring in this chapter.
  sahPplBody.name = 'sahPeople';
  sahPplHead.name = 'sahPeopleHeads';
  sahPplBodyCol = new Float32Array(sahPPL_MAX * 3);
  sahPplHeadCol = new Float32Array(sahPPL_MAX * 3);
  sahPplBody.instanceColor = new THREE.InstancedBufferAttribute(sahPplBodyCol, 3);
  sahPplHead.instanceColor = new THREE.InstancedBufferAttribute(sahPplHeadCol, 3);
  sahPplBody.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  sahPplHead.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  sahPplBody.castShadow = true;
  // ---- AND A HEAD DOES NOT CAST ITS OWN SHADOW ---------------------------
  // Measured: 174 people at 108 triangles a body and 72 a head is 31,320
  // triangles, all of it flagged castShadow, in the chapter that flags the
  // highest proportion of its geometry as casting in the whole project (91 %).
  // A crowd needs its shadow — a person with no shadow floats, and this square
  // is lit from very nearly straight overhead — but the HEAD is directly above
  // the shoulders under exactly that light, so all 12,528 triangles of it were
  // drawn a second time to lay a shadow inside the one the body was already
  // laying. Twelve and a half thousand triangles off the shadow pass, and the
  // rendered frame of the square is bit-for-bit what it was.
  sahPplHead.castShadow = false;
  sahPplHead.userData.noShadow = true;
  sahPplBody.frustumCulled = false;
  sahPplHead.frustumCulled = false;
  sahPplBody.count = 0;
  sahPplHead.count = 0;
  root.add(sahPplBody);
  root.add(sahPplHead);
}

function sahAddPerson(x, y, z, yaw, kind) {
  if (!sahPplBody || sahPplN >= sahPPL_MAX) return;
  const i = sahPplN++;
  const o = i * sahPPL_STRIDE;
  sahPplData[o] = x; sahPplData[o + 1] = y; sahPplData[o + 2] = z;
  sahPplData[o + 3] = yaw; sahPplData[o + 4] = kind;
  sahPplData[o + 5] = rand(0, 6.283);
  sahPplData[o + 6] = rand(0.8, 1.3);
  // which storyteller's ring this person is sitting in, if any — see sahHALQA
  sahPplData[o + 7] = 0;
  for (let h = 0; h < sahHALQA.length; h += 3) {
    const dx = x - sahHALQA[h], dz = z - sahHALQA[h + 1], rr = sahHALQA[h + 2];
    if (dx * dx + dz * dz < rr * rr) { sahPplData[o + 7] = h / 3 + 1; break; }
  }
  // AND NOT EVERYBODY IS THE SAME HEIGHT. A hundred and seventy figures at
  // exactly 1.55 m reads as a production run; the eye picks up the repeat long
  // before it picks up the model. Eight per cent either way is invisible as a
  // measurement and obvious as a crowd.
  sahPplData[o + 8] = 0.92 + ((i * 37) % 17) / 17 * 0.17;
  // The decision clock, seeded across the whole interval so the square is not
  // silent for three seconds and then entirely in motion. See sahFID_A.
  sahPplData[o + 9] = rand(0, sahFID_B);
  sahPplData[o + 10] = 0; sahPplData[o + 11] = 0;
  sahPplData[o + 12] = 0; sahPplData[o + 13] = rand(0, 6.283);
  sahPplCol.set(sahROBE[randInt(0, sahROBE.length - 1)]);
  sahPplBodyCol[i * 3] = sahPplCol.r;
  sahPplBodyCol[i * 3 + 1] = sahPplCol.g;
  sahPplBodyCol[i * 3 + 2] = sahPplCol.b;
  sahPplCol.set(sahSKIN[randInt(0, sahSKIN.length - 1)]);
  sahPplHeadCol[i * 3] = sahPplCol.r;
  sahPplHeadCol[i * 3 + 1] = sahPplCol.g;
  sahPplHeadCol[i * 3 + 2] = sahPplCol.b;
  sahPplBody.count = sahPplN;
  sahPplHead.count = sahPplN;
  sahPplBody.instanceColor.needsUpdate = true;
  sahPplHead.instanceColor.needsUpdate = true;
}

/**
 * MOVE ONE OF THE CROWD. Everybody in the medina stands still for ever, which
 * is why sahPplData is written once at build; the three people walking with the
 * caravan are the exception, and they are the same instanced djellaba as
 * everybody else rather than three more draw calls. Writing the data is enough:
 * sahUpdatePeople composes the matrix from it on the same frame.
 */
function sahMovePerson(i, x, y, z, yaw) {
  if (i === undefined || i < 0 || i >= sahPplN) return;
  const o = i * sahPPL_STRIDE;
  // ---- ...AND HOW FAR THEY WENT, WHICH IS WHAT A GAIT IS MADE OF (v20) ----
  // A djellaba has no legs to swing — it is a cone, deliberately — so the only
  // thing that can say "this person is walking" is that they rise and fall on
  // the stride. Without it the caravan's three cameleers slide across the sand
  // at walking pace like chess pieces, which is the same tell sahPursuerSync's
  // own comment names ("a figure that slides across the ground without moving")
  // and the three people who actually travel in this chapter never got it.
  // Recorded here rather than differenced in the update, because this is the
  // only writer and it already has both positions in hand.
  sahPplData[o + 12] = Math.hypot(x - sahPplData[o], z - sahPplData[o + 2]);
  sahPplData[o] = x; sahPplData[o + 1] = y; sahPplData[o + 2] = z; sahPplData[o + 3] = yaw;
  // ...and the body goes with them. All three of cannon's position fields, or
  // the cameleer is solid where he was standing a second ago — the same rule
  // localsStep follows for the registered people, for the same reason.
  const pb = sahPplBodies[i];
  if (pb) {
    pb.position.set(x, y + 0.85, z);
    pb.previousPosition.copy(pb.position);
    pb.interpolatedPosition.copy(pb.position);
    pb.aabbNeedsUpdate = true;
  }
}

/**
 * A BODY FOR EVERY PERSON IN THE SQUARE.
 *
 * `addLocal` in npc.js gives every REGISTERED person a static box and keeps it
 * where they are. Instanced background crowds are a different population and
 * they had nothing: measured with a chest-height ray through each instance,
 * Marrakech's hundred and seventy figures were 21 per cent solid, and the six
 * of them that were solid only happened to be standing next to a stall.
 *
 * The same box as a local — (0.26, 0.85, 0.24) on game.mats.npc — so a person
 * is a person whichever rig drew them. Called once, at the end of the build,
 * because sahAddPerson is invoked from a dozen builders and the roster is not
 * complete until all of them have run.
 *
 * ONE BODY EACH, not one pooled body with a hundred and seventy shapes, and
 * that is not laziness: three of these people TRAVEL — sahMovePerson carries
 * the caravan's cameleers across the erg — and a compound body cannot move one
 * of its shapes. A body that is solid where somebody used to be standing is a
 * worse bug than one that is not solid at all.
 */
function sahBuildPeopleBodies(game) {
  if (!sahPplBody || sahPplN < 1) return;
  sahPplBodies.length = 0;
  for (let i = 0; i < sahPplN; i++) {
    const o = i * sahPPL_STRIDE;
    const b = new CANNON.Body({
      mass: 0, type: CANNON.Body.STATIC,
      material: (game.mats && game.mats.npc) || undefined,
    });
    b.addShape(new CANNON.Box(new CANNON.Vec3(0.26, 0.85, 0.24)));
    b.position.set(sahPplData[o], sahPplData[o + 1] + 0.85, sahPplData[o + 2]);
    b.previousPosition.copy(b.position);
    b.interpolatedPosition.copy(b.position);
    b.allowSleep = true;
    sahSyncBody(b);
    game.world.addBody(b);
    sahPplBodies[i] = b;
  }
}

function sahUpdatePeople(dt) {
  if (!sahPplBody || sahPplN < 1) return;
  // the storm leans on everybody, not only on the capybara
  const lean = sahStorm * 0.22;
  // ...and so, now, does the capybara. One hypot per person per frame against a
  // squared radius; the branch below it is worth nothing at all for everybody
  // who is not near, which on a 340 m map is almost all of them.
  if (sahNotWheek > 0) sahNotWheek -= dt;
  // ---- AND IT CUTS (the house rule) ------------------------------------
  // Every term added to the picture in this repository carries a state flag
  // that removes it, so it can be measured against its own absence rather
  // than against a memory of last week. game.state.noNotice is that flag for
  // the whole D1 crowd term, in all four chapters that carry one.
  const capy = sahGame && sahGame.capy;
  const cp = (sahGame && sahGame.state && sahGame.state.noNotice)
           ? null : (capy && capy.position);
  const notR = sahNOT_R * (sahNotWheek > 0 ? sahNOT_WHEEK_K : 1);
  const notR2 = notR * notR;
  // M4's gate. Only while somebody is actually running: the six pursuers sit
  // at their own stalls the rest of the time, and a crowd that parts around a
  // man standing still selling oranges is not a chase wake, it is a bug. The
  // cut is `noPart`, on the same footing as `noNotice` above.
  const parting = sahChase === 1 &&
                  !(sahGame && sahGame.state && sahGame.state.noPart);
  const band = sahFireTakeover > 0 ? 1 : 0;
  // THE THREE HALQA CLOCKS. Each ring is one sentence being told to thirteen
  // people, so it gets one number: a slow build to the turn (they lean in) and
  // a short sharp release at the end of it (they rock back). Three rings on
  // three different periods, so the square never beats in time with itself.
  for (let h = 0; h < 3; h++) {
    const per = 9.4 + h * 3.1;
    const u = ((sahTime + h * 4.3) % per) / per;
    // lean in over the first four fifths, laugh out over the last fifth
    sahHalqaBeat[h] = u < 0.8 ? Math.pow(u / 0.8, 2.2) * 0.85
                              : 0.85 - Math.sin((u - 0.8) / 0.2 * Math.PI) * 1.5;
  }
  for (let i = 0; i < sahPplN; i++) {
    const o = i * sahPPL_STRIDE;
    const kind = sahPplData[o + 4];
    const ph = sahPplData[o + 5], rate = sahPplData[o + 6];
    const ring = sahPplData[o + 7], tall = sahPplData[o + 8] || 1;
    const x = sahPplData[o], z = sahPplData[o + 2];
    let y = sahPplData[o + 1], yaw = sahPplData[o + 3];
    let rx = 0, rz = -lean, sy = tall;
    // ---- THE DECISION CLOCK. See sahFID_A ---------------------------------
    // Three floats and a damp per person. Between decisions `fid` is a
    // constant and this whole block is worth nothing at all, which is the
    // point: the crowd is still, and then somebody moves.
    let fid = 0;
    if (kind !== sahPPL_PLAY) {
      sahPplData[o + 9] -= dt;
      if (sahPplData[o + 9] <= 0) {
        sahPplData[o + 9] = rand(sahFID_A, sahFID_B);
        sahPplData[o + 11] = rand(-1, 1) * (kind === sahPPL_SIT ? sahFID_SIT : sahFID_STAND);
      }
      sahPplData[o + 10] = damp(sahPplData[o + 10], sahPplData[o + 11], sahFID_L, dt);
      fid = sahPplData[o + 10];
    }
    // ---- AND THE STRIDE, for the three people who go anywhere -------------
    // sahMovePerson records the distance; here it becomes a bob and a lean, and
    // it decays to nothing the moment they stop. `step` is metres this frame,
    // so the phase advances with distance covered rather than with time and the
    // gait cannot moonwalk when the caravan slows for the dune.
    const step = sahPplData[o + 12];
    sahPplData[o + 12] = 0;
    if (step > 1e-5) {
      sahPplData[o + 13] += step * 3.2;
      const g = Math.abs(Math.sin(sahPplData[o + 13]));
      y += g * 0.055;
      rz -= 0.10 + Math.sin(sahPplData[o + 13]) * 0.035;
    }
    if (kind === sahPPL_SIT) {
      y -= 0.44 * tall;
      sy = 0.62 * tall;
      rx = -0.16;
      // leaning in, and every so often somebody shifts
      y += Math.sin(sahTime * 0.7 * rate + ph) * 0.012;
      yaw += Math.sin(sahTime * 0.31 * rate + ph) * 0.09;
      // ...and the rock. A seated fidget is forward and back at the waist
      // rather than a turn — that is what somebody sitting cross-legged in a
      // ring actually does — with a little yaw carried along with it.
      rx += fid * 0.55;
      yaw += fid * 0.5;
      y -= Math.abs(fid) * 0.02;
      if (ring > 0) {
        // ...and the ring does it TOGETHER, a beat apart round the circle so it
        // travels rather than switching
        const b = sahHalqaBeat[(ring | 0) - 1] * (0.85 + (i % 5) * 0.06);
        rx -= b * 0.20;
        y += b * 0.05;
      }
    } else if (kind === sahPPL_PLAY) {
      // THE GNAWA. They rock from the waist on the beat, and when the animal
      // takes the band over they are up on their feet inside a second.
      const k = 1 + band * 0.9;
      rx = Math.sin(sahTime * (2.6 + band * 2.2) * rate + ph) * 0.15 * k;
      y += Math.abs(Math.sin(sahTime * (2.6 + band * 2.2) * rate + ph)) * (0.02 + band * 0.09);
      sy = tall * (1 + band * 0.05);
    } else {
      // standing: a breath, and then whatever the decision clock last decided.
      // The breath is the old continuous term and is still deliberately tiny —
      // a crowd that all bobs in time is a chorus line. What carries the
      // motion now is `fid`: a real quarter-turn onto the other foot, taken
      // once every few seconds, at a moment nobody else has chosen.
      y += Math.sin(sahTime * 0.9 * rate + ph) * 0.014;
      yaw += Math.sin(sahTime * 0.23 * rate + ph) * 0.16 + fid;
      // the weight goes onto the foot they turned toward, and they settle a
      // centimetre or two onto it — which is the half of a weight shift that
      // actually reads at fifteen metres
      rz -= Math.sin(sahTime * 0.41 * rate + ph) * 0.02 + fid * 0.22;
      y -= Math.abs(fid) * 0.028;
    }
    // ---- AND THEN SOMEBODY LOOKS UP (D1) ---------------------------------
    // Applied last, so it wins over the fidget and the halqa lean rather than
    // being averaged with them: a ring that has stopped listening to the story
    // is the picture, and the story's own lean is what it stops doing.
    let not = sahPplData[o + 14];
    if (cp) {
      const ndx = cp.x - x, ndz = cp.z - z;
      const nd2 = ndx * ndx + ndz * ndz;
      const want = nd2 < notR2 ? clamp((notR - Math.sqrt(nd2)) / sahNOT_EDGE, 0, 1) : 0;
      not = damp(not, want, sahNOT_L, dt);
      sahPplData[o + 14] = not;
      if (not > 0.004) {
        let dy = Math.atan2(ndx, ndz) - yaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        yaw += dy * not * sahNOT_TURN[kind];
        rx += not * sahNOT_LEAN;
      }
    } else if (not !== 0) { sahPplData[o + 14] = 0; }
    // ---- ...AND SOMEBODY PUSHED PAST THEM (M4) ---------------------------
    // Applied after the notice for the same reason the notice is applied after
    // the fidget: being shouldered out of the way outranks looking at a
    // rodent. `part` carries its own sign, so the crowd opens along the line
    // the trader actually took instead of flinching symmetrically.
    let part = sahPplData[o + 15];
    if (parting) {
      for (let q = 0; q < sahPURSUER_N; q++) {
        const qo = q * 8;
        const qdx = sahPurData[qo] - x, qdz = sahPurData[qo + 1] - z;
        const qd2 = qdx * qdx + qdz * qdz;
        if (qd2 > sahPART_R2) continue;
        // which side he came past on, in the person's own frame
        const side = qdx * Math.cos(yaw) - qdz * Math.sin(yaw);
        const k = 1 - Math.sqrt(qd2) / sahPART_R;
        const want = (side >= 0 ? -k : k);
        if (Math.abs(want) > Math.abs(part)) part = want;
      }
    }
    if (part !== 0) {
      part = damp(part, 0, sahPART_L, dt);
      if (Math.abs(part) < 0.002) part = 0;
      sahPplData[o + 15] = part;
      yaw += part * sahPART_YAW;
      rz  += part * sahPART_LEAN;
    }
    sahPplBody.setMatrixAt(i, sahXform(x, y, z, rx, yaw, rz, tall, sy, tall));
    sahPplHead.setMatrixAt(i, sahXform(x - rz * 1.3 * tall, y + 1.42 * sy, z + rx * 1.3 * tall,
                                       rx, yaw, rz, tall, tall, tall));
  }
  sahPplBody.instanceMatrix.needsUpdate = true;
  sahPplHead.instanceMatrix.needsUpdate = true;
}

// ============================================================ THE PURSUIT ====
/**
 * Six traders. They are not clever — they walk straight at you and slide along
 * whatever they hit — and they do not need to be, because the interesting
 * decision is entirely on the player's side: an open square is death and a
 * covered alley is a chance, and every corner you turn is a bet on whether they
 * saw it.
 *
 * The steering is axis-separated: try the whole move, then x only, then z only.
 * On a rectilinear grid of convex blocks that is indistinguishable from
 * pathfinding and costs three tests.
 */
function sahBuildPursuers(root) {
  // THEY WERE SIX IDENTICAL BOXES WITH A BALL ON TOP, and they are the cast of
  // the one task in the chapter you can LOSE — the thing the player spends
  // ninety seconds looking over their shoulder at. A pursuer that reads as a
  // crate is not frightening, it is confusing.
  //
  // Same djellaba as everybody else in the medina (one merged cone-and-hood, so
  // the men chasing you are visibly the men whose stalls you just robbed), plus
  // two arms swinging forward — because the ONE thing that has to read at
  // twenty metres in a covered alley is that they are running.
  const PM = sahMerger();
  PM.cyl(0, 0.46, 0, 0.22, 0.92, PALETTE.sahCanvas, 0, 0, 0, 6);
  PM.cyl(0, 1.06, 0, 0.28, 0.62, PALETTE.sahCanvas, 0, 0, 0, 6);
  PM.cyl(0, 1.38, 0, 0.20, 0.18, PALETTE.sahOchreDust, 0, 0, 0, 6);
  // the arms, out in front — a man at six metres a second is reaching
  PM.box(-0.28, 1.12, 0.22, 0.13, 0.56, 0.16, PALETTE.sahCanvas, -0.85, 0, 0.22);
  PM.box(0.28, 1.05, -0.14, 0.13, 0.56, 0.16, PALETTE.sahCanvas, 0.55, 0, -0.22);
  // and a leg forward, so the silhouette is mid-stride rather than standing
  PM.box(-0.10, 0.30, 0.26, 0.15, 0.62, 0.18, PALETTE.sahOchreDust, -0.42, 0, 0);
  const im = new THREE.InstancedMesh(PM.build(), sahVC(), sahPURSUER_N);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.castShadow = true;
  im.frustumCulled = false;
  const HM = sahMerger();
  HM.sph(0, 0, 0, 0.14, 0.16, 0.14, PALETTE.skin3);
  HM.cone(0, 0.14, -0.10, 0.20, 0.38, PALETTE.sahCanvas, -0.55, 0, 0, 6);
  const hd = new THREE.InstancedMesh(HM.build(), sahVC(), sahPURSUER_N);
  hd.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  hd.castShadow = true;
  hd.frustumCulled = false;
  root.add(hd);
  sahPursuerHeads = hd;
  // THEY STAND ON THE SOUTH SIDE OF THE SQUARE, NOT ALL ROUND IT.
  // A full ring reads as fair and is not: the souk is north, so a ring puts one
  // trader directly across the only door out and the chase is decided before it
  // starts (measured — caught at 2.7 s, every run, on the same man). A fan
  // across the southern half leaves the way in open and makes the first three
  // seconds a sprint rather than a coin toss.
  for (let i = 0; i < sahPURSUER_N; i++) {
    const o = i * 8;
    const a = -0.35 + (i / (sahPURSUER_N - 1)) * 3.83;
    sahPurData[o + 2] = Math.cos(a) * 28;          // home: their own stall
    sahPurData[o + 3] = 6 + Math.sin(a) * 19;
    sahPurData[o] = sahPurData[o + 2];
    sahPurData[o + 1] = sahPurData[o + 3];
    sahPurData[o + 4] = 0;
    sahPurData[o + 5] = 0;
    sahPurData[o + 6] = sahPurData[o];
    sahPurData[o + 7] = sahPurData[o + 1];
    sahPurMiss[i] = 0;
  }
  sahMissN = 0;
  root.add(im);
  sahPursuerMesh = im;
  sahPursuerSync();
}
function sahPursuerSync() {
  if (!sahPursuerMesh) return;
  const running = sahChase === 1 && sahChaseDelay <= 0;
  for (let i = 0; i < sahPURSUER_N; i++) {
    const o = i * 8;
    const x = sahPurData[o], z = sahPurData[o + 1];
    const gy = sahTerrain(x, z);
    // the run: a bob and a forward lean, both of which stop dead when they do.
    // A figure that slides across the ground at six metres a second without
    // moving is the tell that turns a chase into a screensaver.
    const bob = running ? Math.abs(Math.sin(sahTime * 9.5 + i * 1.7)) * 0.10 : 0;
    const lean = running ? 0.20 + Math.sin(sahTime * 9.5 + i * 1.7) * 0.05 : 0;
    const yaw = sahPurData[o + 4];
    sahPursuerMesh.setMatrixAt(i, sahXform(x, gy + bob, z, lean, yaw, 0, 1, 1, 1));
    if (sahPursuerHeads) {
      sahPursuerHeads.setMatrixAt(i, sahXform(x + Math.sin(yaw) * lean * 1.5, gy + 1.46 + bob,
        z + Math.cos(yaw) * lean * 1.5, lean, yaw, 0, 1, 1, 1));
    }
    // and the dust off their feet, which is the other half of "they are moving"
    // and the only thing in the souk that tells you where they are when you
    // cannot see them
    if (running && Math.random() < 0.06) {
      sahDustSpawn(x + rand(-0.3, 0.3), gy + 0.15, z + rand(-0.3, 0.3),
                   rand(-1.2, 1.2), rand(0.18, 0.34), rand(0.4, 0.8));
    }
  }
  sahPursuerMesh.instanceMatrix.needsUpdate = true;
  if (sahPursuerHeads) sahPursuerHeads.instanceMatrix.needsUpdate = true;
}

function sahStartChase(game) {
  sahChase = 1;
  sahChaseT = 0;
  sahLoseT = 0;
  sahChaseDelay = sahCHASE_DELAY;
  sahCatchT = 0;
  // ---- AND THE NEAR MISSES ARE PER CHASE, WHICH THEY WERE NOT ----------
  // The block in sahUpdateChase says "once per pursuer per chase" for the
  // sound and "once per chase" for the line, and both counters were only ever
  // cleared in the BUILD. So the second time you rob the cart — which the cart
  // explicitly re-arms, so it is the expected way to play this — five traders
  // walk past the end of your alley in silence and neither line is ever said
  // again for the life of the page.
  sahMissN = 0;
  // ...and M2's counter with them, for the reason the paragraph above gives.
  sahPurTold = 0; sahTellPairs = 0; sahTellNear = 0; sahTellLos = 0;
  for (let i = 0; i < sahPURSUER_N; i++) { sahPurMiss[i] = 0; sahPurTellSeen[i] = 0; }
  for (let i = 0; i < sahPURSUER_N; i++) {
    const o = i * 8;
    sahPurData[o] = sahPurData[o + 2];
    sahPurData[o + 1] = sahPurData[o + 3];
    sahPurData[o + 5] = 1;
    sahPurData[o + 6] = sahPurData[o];
    sahPurData[o + 7] = sahPurData[o + 1];
  }
  if (typeof game.toast === 'function') game.toast('the whole square saw that. GO.');
  if (typeof game.sfx === 'function') game.sfx('gasp', { volume: 0.9 });
  game.state.chaos = Math.min(1, (game.state.chaos || 0) + 0.5);
}

function sahUpdateChase(game, dt) {
  const capy = game.capy;
  if (!capy || !capy.position) return;
  const p = capy.position;

  if (sahRearm > 0) sahRearm -= dt;

  if (sahChase !== 1) {
    sahChaseNear = 999;
    // drift home
    let moved = false;
    for (let i = 0; i < sahPURSUER_N; i++) {
      const o = i * 8;
      const dx = sahPurData[o + 2] - sahPurData[o], dz = sahPurData[o + 3] - sahPurData[o + 1];
      const d = Math.hypot(dx, dz);
      if (d > 0.4) {
        moved = true;
        const s = Math.min(d, 3.0 * dt) / d;
        sahPurData[o] += dx * s; sahPurData[o + 1] += dz * s;
        sahPurData[o + 4] = Math.atan2(dx, dz);
      }
    }
    if (moved) sahPursuerSync();
    return;
  }

  sahChaseT += dt;
  // ...and the clock is on the paper while they are behind you (v32). This one
  // is `better: 'lower'`, so the live figure climbing toward the standing best
  // is a pressure gauge rather than a score — which is what a chase is.
  if (game.recordLive) game.recordLive('souk-escape', sahChaseT);
  // the beat before it starts: they are looking at you, and they have not moved
  if (sahChaseDelay > 0) {
    sahChaseDelay -= dt;
    const capyX = p.x, capyZ = p.z;
    for (let i = 0; i < sahPURSUER_N; i++) {
      const o = i * 8;
      sahPurData[o + 4] = Math.atan2(capyX - sahPurData[o], capyZ - sahPurData[o + 1]);
      sahPurData[o + 6] = capyX; sahPurData[o + 7] = capyZ;
    }
    sahPursuerSync();
    if (sahChaseDelay <= 0 && typeof game.sfx === 'function') game.sfx('cheer', { volume: 0.5, pitch: 0.8 });
    return;
  }
  // THEY CHASE WHERE THEY LAST SAW YOU, NOT WHERE YOU ARE.
  //
  // This is the single line that turns a maze from scenery into a tool. A
  // pursuer that always knows the player's position cannot be hidden from, so
  // every wall in the souk is decoration and the only variable left is top
  // speed. Giving each of them one remembered point — updated only on the
  // frames they can actually see you — means turning a corner genuinely costs
  // them something, and they arrive at the place you WERE and start looking
  // about, which is also the only way the player ever gets to watch the trick
  // work.
  let nearest = 1e9, seen = false;
  for (let i = 0; i < sahPURSUER_N; i++) {
    const o = i * 8;
    const px = sahPurData[o], pz = sahPurData[o + 1];
    const dx = p.x - px, dz = p.z - pz;
    const d = Math.hypot(dx, dz);
    if (d < nearest) nearest = d;
    const canSee = d < sahSIGHT && sahLineOfSight(px, pz, p.x, p.z);
    sahPurTellSeen[i] = canSee ? 1 : 0;      // M2: only a witness has news
    if (canSee) {
      seen = true;
      sahPurData[o + 6] = p.x; sahPurData[o + 7] = p.z;
      sahPurMiss[i] = 0;
    } else if (d < sahPUR_MISS_R && sahPurMiss[i] <= 0) {
      // ---- THE NEAR MISS -------------------------------------------------
      // The one thing a chase through a maze has that a chase across a square
      // does not is the moment somebody goes past the end of your alley and
      // does not look down it. It was happening constantly and the game said
      // nothing about it at all — the whole payout was a tick, thirty seconds
      // later, for the escape. So: the first time each trader gets within four
      // metres of the animal WITHOUT a line of sight, a very small sound and,
      // once per chase, a line. Once per pursuer per chase, because a maze
      // that congratulates you every second is a maze you stop reading.
      sahPurMiss[i] = 1;
      sahMissN++;
      sahSfx('rustle', { volume: 0.22 + 0.16 * (1 - d / sahPUR_MISS_R), pitch: 1.5 });
      if (sahMissN === 2) sahToast('he went straight past the end of the alley.');
      else if (sahMissN === 5) sahToast('five of them, and not one of them has looked up.');
    }
    const tx = sahPurData[o + 6], tz = sahPurData[o + 7];
    let gx = tx - px, gz = tz - pz;
    let gd = Math.hypot(gx, gz);
    if (gd < 1.2) {
      // arrived at the last place they saw it, and it is not there. Cast about.
      const a = sahTime * 1.4 + i * 2.1;
      gx = Math.sin(a); gz = Math.cos(a); gd = 1;
    }
    const step = sahPUR_SPEED * (canSee ? 1 : 0.72) * dt;
    const nx = px + gx / gd * step, nz = pz + gz / gd * step;
    if (!sahNavBlocked(nx, nz, 0.6)) { sahPurData[o] = nx; sahPurData[o + 1] = nz; }
    else if (!sahNavBlocked(nx, pz, 0.6)) { sahPurData[o] = nx; }
    else if (!sahNavBlocked(px, nz, 0.6)) { sahPurData[o + 1] = nz; }
    sahPurData[o + 4] = Math.atan2(gx, gz);
  }
  // ---- M2: AND THEY TELL EACH OTHER ---------------------------------------
  //
  // Six pursuers, and until this line each of them ran its own private chase.
  // A trader who lost you kept walking to the last place IT had seen you, and
  // the one forty metres away who could see you perfectly well never said so.
  // The souk's whole promise — that a maze full of people is a maze full of
  // people who can shout — was unbuilt, and the chase read as six independent
  // pathfinders rather than as a market closing on one animal.
  //
  // A SHOUT, NOT TELEPATHY, and the three constraints are what make it read
  // that way rather than as omniscience:
  //
  //  - only somebody who can SEE you passes it on. `sahPurTell` is written on
  //    this frame's `canSee`, so a trader who has lost you has nothing to say.
  //  - it carries about twenty metres, and a shout does not go round corners:
  //    the same `sahLineOfSight` the sight test uses gates the hearing too, so
  //    a souk block between two traders is a souk block between two traders.
  //  - it is a POSITION, not a lock. The listener adopts the shouter's
  //    `lastSeen` and then goes there on its own legs; if you have moved, it
  //    arrives at an empty alley and casts about exactly as before.
  //
  // Two passes, and they cannot be one: a listener that updates in the same
  // sweep it is read in would relay the shout across the whole square in one
  // frame, which is the difference between six people shouting and a hive.
  // ...and it cuts, per the house rule. game.state.noTell removes the whole
  // relay so the chase can be measured against six private pathfinders.
  const telling = !(sahGame && sahGame.state && sahGame.state.noTell);
  const tellR2 = sahPUR_TELL_R * sahPUR_TELL_R;
  for (let i = 0; i < sahPURSUER_N; i++) sahPurTell[i] = sahPurTellSeen[i] ? 1 : 0;
  for (let i = 0; telling && i < sahPURSUER_N; i++) {
    if (!sahPurTell[i]) continue;
    const o = i * 8, sx = sahPurData[o], sz = sahPurData[o + 1];
    for (let j = 0; j < sahPURSUER_N; j++) {
      if (j === i || sahPurTell[j]) continue;      // he can see it himself
      sahTellPairs++;
      const oj = j * 8;
      const hx = sahPurData[oj] - sx, hz = sahPurData[oj + 1] - sz;
      if (hx * hx + hz * hz > tellR2) continue;
      sahTellNear++;
      // walls only — see AND SOUND IS NOT LIGHT in sahLineOfSight
      if (!sahLineOfSight(sx, sz, sahPurData[oj], sahPurData[oj + 1], true)) continue;
      sahTellLos++;
      // ---- AND A HAND-OFF IS NEWS, NOT A FRAME ---------------------------
      // Measured on the first cut: 1382 "hand-offs" in fifteen seconds, which
      // is one per listener per frame — the counter was ticking every frame a
      // shouter was in range, so the toast below fired on the frame the chase
      // started and said nothing about anything. A relay only counts when it
      // MOVES the listener's belief: if he is already walking to within three
      // metres of where you are, he does not need telling.
      const news = Math.hypot(sahPurData[oj + 6] - sahPurData[o + 6],
                              sahPurData[oj + 7] - sahPurData[o + 7]) > 3;
      sahPurData[oj + 6] = sahPurData[o + 6];
      sahPurData[oj + 7] = sahPurData[o + 7];
      if (!news) continue;
      sahPurTold++;
      // ONCE PER CHASE, and only when it is worth hearing: the third time a
      // trader is redirected by somebody else, the market says so.
      if (sahPurTold === 3) sahToast('one of them shouted. now they all know.');
    }
  }
  sahPursuerSync();
  sahChaseNear = nearest;

  // --- caught ----------------------------------------------------------------
  if (nearest < sahPUR_CATCH) sahCatchT += dt; else sahCatchT = 0;
  if (sahCatchT >= sahCATCH_HOLD) {
    sahCatchT = 0;
    sahChase = 2;
    sahRearm = sahCHASE_REARM;
    if (typeof game.toast === 'function') game.toast('caught. they want their oranges back.');
    if (typeof game.sfx === 'function') game.sfx('thud', { volume: 0.8, pitch: 0.6 });
    if (typeof game.shake === 'function') game.shake(0.3);
    // a shove, not a teleport: being picked up and moved is the one thing a
    // player never forgives, and being flung across an alley is funny
    // THROUGH launch(), the third instance of this class in this file and the
    // last: the biome updates before capybara.js and the animal is still
    // grounded on this frame, so the horizontal half of the shove went into the
    // grip damper (lambda 60) and then into the snap-to-zero under 0.9 m/s. A
    // caught run at 7.4 m/s travelled about three centimetres backwards; only
    // the vertical survived, so the whole punishment read as a small hop on the
    // spot. launch() clears the frame, lifts clear of the live contact and
    // refuses to be grounded for capyLAUNCH_HOLD, so the throw lands.
    if (capy.body && typeof capy.launch === 'function') {
      capy.launch(capy.body.velocity.x * -0.4, 5.5, capy.body.velocity.z * -0.4);
    } else if (capy.body) {
      capy.body.velocity.x *= -0.4;
      capy.body.velocity.z *= -0.4;
      capy.body.velocity.y = 5.5;
    }

    if (game.capy.heldProp && game.physics && game.physics.release) {
      try { game.physics.release(null); } catch (e) {}
    }
    return;
  }

  // --- lost them -------------------------------------------------------------
  if (!seen && nearest > sahLOSE_NEAR) {
    sahLoseT += dt;
    if (sahLoseT > sahLOSE_TIME) {
      sahChase = 2;
      sahRearm = sahCHASE_REARM;
      if (typeof game.record === 'function') game.record('souk-escape', sahChaseT);
      if (!sahEscapeDone) {
        sahEscapeDone = true;
        sahTask('souk-escape');
        if (typeof game.toast === 'function') {
          game.toast('gone. ' + sahChaseT.toFixed(0) + ' seconds, and they are still looking.');
        }
        if (typeof game.sfx === 'function') game.sfx('chime', { volume: 0.9 });
      } else if (typeof game.toast === 'function') game.toast('lost them again.');
    }
  } else sahLoseT = 0;
}

// ============================================================== THE PALMS ===
function sahBuildPalmeraie(game, root) {
  const M = sahMerger();
  // ---- THE SEGUIA ---------------------------------------------------------
  // The irrigation channel that is the only reason any of this is here. It was
  // ONE FLAT BLUE BOX sixty-two metres long — the only water in the chapter,
  // and the one surface in the game that had never been given the treatment
  // every other water in it has. It is now a cut channel: two banks, a bed, and
  // a moving surface with glitter on it. The date palm used to stand at
  // (104, 14), which is the middle of this — see sahDATE.
  const sgZ = 14;
  for (let s = -1; s <= 1; s += 2) {
    M.box(120, 0.10, sgZ + s * 1.65, 62, 0.44, 1.1, PALETTE.sahOchreDust);
    M.box(120, 0.30, sgZ + s * 2.05, 62, 0.14, 0.5, PALETTE.sahOchreDk);
    // and it is WET along the lip, which is the only reason a channel in a
    // desert reads as running rather than as a painted stripe
    M.box(120, 0.33, sgZ + s * 1.20, 62, 0.06, 0.5, PALETTE.sahSandDeep);
  }
  M.box(120, -0.42, sgZ, 62, 0.40, 2.4, PALETTE.sahSandDeep);      // the bed
  const sluiceGrp = sahStaticGroup(game);
  for (let i = 0; i < 8; i++) {
    // the sluice gates down the channel. Waist-high concrete, and the audit
    // walked through every one of them.
    M.box(92 + i * 8, 0.35, sgZ, 1.0, 1.2, 3.4, PALETTE.sahOchreDk);
    // a paddle and a handwheel on each, because a sluice is a machine
    M.box(92 + i * 8, 0.98, sgZ, 0.18, 0.9, 1.9, PALETTE.sahCedarDk);
    M.cyl(92 + i * 8, 1.50, sgZ, 0.30, 0.09, PALETTE.sahBrassDk, 0, 0, Math.PI / 2, 8);
    sluiceGrp.add(92 + i * 8, 0.35, sgZ, 1.0, 1.2, 3.4);
  }
  sluiceGrp.done();
  // ---- pisé walls ---------------------------------------------------------
  // Rammed earth, and they melt in the rain, which they know. FIFTY-TWO of the
  // audit's ninety hits in this chapter were these: twelve walls, two and a
  // half metres high and up to twenty metres long, standing across the one
  // place the caravan and the sandstorm both drive you through — and the
  // capybara walked through every one of them. A wall is the most obviously
  // solid thing there is; a wall you can walk through is the single loudest
  // way a world can tell you it is not real.
  const wallGrp = sahStaticGroup(game);
  for (let i = 0; i < 14; i++) {
    const x = rand(96, 148), z = rand(-30, 50);
    const w = rand(8, 20);
    const a = rand(0, 3.14);
    if (Math.abs(z - sgZ) < 4) continue;             // never across the channel
    M.box(x, 1.3, z, w, 2.6, 0.7, PALETTE.sahOchreDust, 0, a, 0);
    // the coping, which is what stops a mud wall dissolving, and the buttress
    // every few metres, which is what stops it falling over
    M.box(x, 2.68, z, w + 0.3, 0.22, 1.0, PALETTE.sahOchreDk, 0, a, 0);
    const n = Math.max(2, Math.round(w / 5));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n - 0.5;
      M.box(x + Math.cos(a) * t * w, 0.9, z - Math.sin(a) * t * w,
            0.8, 1.8, 1.5, PALETTE.sahOchreDust, 0, a, 0);
      // RAMMED EARTH IS RAMMED IN LIFTS, and the horizontal seam between them
      // is the only thing that makes a pisé wall read as pisé rather than as a
      // long brown box. Two lines per wall, and they cost two boxes.
      if (k === 0) {
        for (let L = 1; L <= 2; L++) {
          M.box(x, L * 0.85, z, w + 0.06, 0.07, 0.78, PALETTE.sahOchreDk, 0, a, 0);
        }
      }
    }
    wallGrp.add(x, 1.3, z, w, 2.6, 0.9, a);
  }
  wallGrp.done();
  const mesh = new THREE.Mesh(M.build(), sahVC());
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  root.add(mesh);

  // The water itself, and it is its OWN mesh with its OWN material: the one
  // place in this chapter that is not dust. grainOwn, not grain(...).clone() —
  // the clone throws the shader hook away and five seas in this game were flat
  // for a month because of it (see shared.js).
  {
    const wg = new THREE.PlaneGeometry(62, 2.3, 40, 2);
    wg.rotateX(-Math.PI / 2);
    wg.translate(120, -0.16, sgZ);
    const wm = new THREE.Mesh(wg, grainOwn(mat(PALETTE.sahTileBlue), {
      scale: 0.9, amount: 0.14, warp: 0,
      sparkle: 0.85, sparkleScale: 1.1, sparkleSpeed: 0.55, fresnel: 0.65,
      sparkleCut: 0.60, sparkleBand: 0.12, sparkleColor: PALETTE.sahSun,
    }));
    wm.receiveShadow = true;
    wm.castShadow = false;
    wm.userData.noShadow = true;
    wm.name = 'sahSeguia';
    root.add(wm);
    sahSeguia = wm.geometry.attributes.position;
  }

  // ---- NINETY PROPELLERS MADE OF PLANKS -----------------------------------
  //
  // The fronds were 2.5 x 0.14 x 0.55 m BOXES — eighteen per palm, 1,620 of
  // them, 19,440 triangles, fifteen per cent of the whole chapter — and the
  // instrumented shot from under the grove is a stand of thick green planks
  // nailed to poles. Two things are wrong and they fix each other.
  //
  // A frond is a FLAT thing seen from above and below and never from the side,
  // so it is a quad, not a box: 2 triangles instead of 12. And what a frond
  // actually is, is a keeled midrib with leaflets hanging off both sides at an
  // angle — so it is drawn as two quads meeting in a shallow V, which is both
  // the correct section AND the reason it does not vanish edge-on the way a
  // single plate would. Three segments along its length arch it over.
  //
  // Ten fronds x 3 segments x 2 halves is 60 quads a palm against 18 boxes:
  // 10,800 triangles against 19,440, and the grove reads as a grove.
  const trunks = [], crowns = [], fronds = [];
  for (let i = 0; i < sahPALM_N; i++) {
    const x = rand(90, 152), z = rand(-46, 56);
    const y = sahTerrain(x, z);
    const h = rand(5.5, 10.5);
    const yaw0 = rand(0, 6.28), tilt = rand(-0.05, 0.05);
    // A TRUNK IS NOT A DOWEL. Three stacked open cylinders, each a little
    // narrower than the one under it, give a date palm its taper and the
    // shoulder where the old leaf-bases start — and an open cylinder is 12
    // triangles against a capped one's 24, so all three cost less than the one
    // they replace. Neither cap is ever visible: the foot is in the sand and
    // the top is under the crown.
    for (let k = 0; k < 3; k++) {
      const hs = h / 3;
      sahPush9(trunks, x + tilt * (k * hs) * 2, y + hs * (k + 0.5), z,
               0, yaw0 + k * 0.5, tilt, 0.62 - k * 0.07, hs * 1.02, 0.62 - k * 0.07);
    }
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * 6.283 + i;
      const L = 0.82 + ((k * 37) % 10) / 10 * 0.4;
      const ca = Math.cos(a), sa = Math.sin(a);
      // three stations along the arc: up out of the crown, over the top, and
      // the tip of an old one hanging BELOW it
      const st = [[1.05, 0.42, -0.46, 2.1, 0.50],
                  [2.75, 0.22, 0.28, 2.4, 0.42],
                  [4.35, -0.62, 0.88, 2.1, 0.30]];
      for (let s2 = 0; s2 < 3; s2++) {
        const q = st[s2];
        for (let e = -1; e <= 1; e += 2) {
          sahPush9(fronds,
            x + ca * q[0] * L - sa * e * q[4] * 0.24 * L,
            y + h + q[1] * L,
            z + sa * q[0] * L + ca * e * q[4] * 0.24 * L,
            e * 0.34, -a, q[2], q[3] * L, 1, q[4] * L);
        }
      }
    }
    // the crown of old leaf-bases the trunk is actually made of — a stepped
    // collar rather than one drum, because that is what the scar pattern is
    sahPush9(crowns, x + tilt * h * 2, y + h - 0.52, z, 0, yaw0, tilt, 1.32, 0.62, 1.32);
    sahPush9(crowns, x + tilt * h * 2, y + h - 0.05, z, 0, yaw0 + 0.5, tilt, 1.05, 0.55, 1.05);
  }
  sahInstance(root, sahG.cylO6, PALETTE.sahPalmTrunk, trunks, true, true);
  sahInstance(root, sahG.cylO6, PALETTE.sahPalmDry, crowns, true, true);
  // DOUBLE-SIDED, because a quad has one face and half the grove is seen from
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
  if (fm2) {
    fm2.name = 'sahFronds'; fm2.userData.noShadow = true;
    // AND THEY MOVE. sahG.quad is a unit plane laid flat, scaled so x is the
    // frond's LENGTH and z its width, and the segments are placed radiating
    // outward — so +x is the tip and the window is the whole quad.
    //
    // These do not cast (see the starfish note above), which means swayMesh
    // builds no depth material for them and there is no shadow to come adrift.
    // That is the one place in this pass where an earlier decision made a later
    // one free.
    swayMesh(fm2, { amount: 0.14, axis: 'x', lo: -0.5, hi: 0.5, stiff: 1.8, hz: 1.2 });
  }
}

// ================================================================ THE ERG ===
/**
 * The two firm shoulders, which are the only way to the top of the dune, drawn
 * as a track of packed sand so that the way up is a thing you can SEE rather
 * than a thing you find out by falling over. Every slide in this game has one
 * of these: Iceland's is a rock moraine with a cairn on the end of it.
 */
function sahBuildDuneTrack(root) {
  const M = sahMerger();
  for (let side = -1; side <= 1; side += 2) {
    // the edge of the slip band, in z, at the ridge's widest
    const z = sahDUNE_Z + side * sahDUNE_HZ * Math.sqrt(1 - sahSURF_BAND) * 1.06;
    for (let i = 0; i < 40; i++) {
      const x = sahDUNE_X - sahDUNE_W + 3 + i * (sahDUNE_W / 40);
      const zz = z + Math.sin(i * 0.5) * 0.7;
      const y = sahTerrain(x, zz);
      // ---- AND IT HAS TO LIE ALONG THE SLOPE, IN BOTH DIRECTIONS ---------
      // Eighty 2.6 m plates laid at a CONSTANT y on a face that climbs
      // twenty-five degrees: over each plate's own length the sand rises 1.2 m,
      // so one end is buried and the other is sixty centimetres in the air.
      // The shot from the crest shows the walk-up track as a line of pale
      // planks projecting off the side of the dune. Same class as Iceland's
      // road north, which was one slab across a basin.
      //
      // AND THE PITCH ALONE IS NOT ENOUGH. The track runs along the edge of the
      // slip band, i.e. out where the ridge's own z-profile is falling away at
      // about a third of a metre per metre — so a 3.4 m-deep plate corrected
      // only in x still hangs a metre in the air on its downhill side. Two
      // gradients, sampled over the plate's own footprint, and there is nowhere
      // left for it to float.
      const pitch = -Math.atan2(sahTerrain(x + 1.5, zz) - sahTerrain(x - 1.5, zz), 3.0);
      const bank = Math.atan2(sahTerrain(x, zz + 1.7) - sahTerrain(x, zz - 1.7), 3.4);
      // packed and darker than the loose sand, but NOT sahSandDeep — at that
      // value the walk-up track photographs as a line of brown chevrons cut
      // into the dune rather than as ground somebody has trodden flat.
      M.box(x, y + 0.04, zz, 3.1, 0.1, 4.0, i % 2 ? PALETTE.sahSandShade : PALETTE.sahGravel,
        bank, 0.1 * side, pitch);
    }
    // ---- AND SOMEBODY IS ALREADY UP THERE ----------------------------------
    // A hundred and eighty metres of erg with the chapter's marquee on it, and
    // the only living things east of the palmeraie were five camels and
    // fourteen people at the camp. Two sand-boarders at the top of the walk-up
    // track on the south shoulder — the side the run starts from — is the whole
    // fix: it says somebody has done this before, it marks the top of the run
    // from the bottom of it, and it puts a human figure on the one slope in
    // this game that has no scale reference of any kind on it.
    if (side > 0) {
      for (let k = 0; k < 2; k++) {
        const bx = sahDUNE_X - 8 - k * 5, bz = z - 2.5 + k * 4.4;
        sahAddPerson(bx, sahTerrain(bx, bz), bz, -1.9 + k * 0.5, sahPPL_STAND);
        // the board propped against his leg, which is what he is here for
        M.box(bx + 0.5, sahTerrain(bx + 0.5, bz) + 0.72, bz + 0.2,
              0.34, 1.55, 0.10, k ? PALETTE.sahDye3 : PALETTE.sahDye1, 0, 0.4, 0.30);
      }
    }
    // a line of stakes, because a desert track always has one and because it is
    // the only vertical thing for two hundred metres
    for (let i = 0; i < 9; i++) {
      const x = sahDUNE_X - sahDUNE_W + 6 + i * (sahDUNE_W / 9);
      const y = sahTerrain(x, z);
      M.cyl(x, y + 0.8, z, 0.08, 1.6, PALETTE.sahCedarDk);
      M.box(x, y + 1.6, z, 0.5, 0.3, 0.12, PALETTE.sahDye1);
      // and a cairn every third one, which is how a desert track is actually
      // marked and is the only thing on the walk up that says how far is left
      if (i % 3 === 0) {
        for (let k = 0; k < 4; k++) {
          M.sph(x + Math.sin(k * 2.1) * 0.16, y + 0.16 + k * 0.26, z + 1.4 + Math.cos(k * 1.7) * 0.16,
                0.30 - k * 0.05, 0.24 - k * 0.04, 0.30 - k * 0.05,
                k % 2 ? PALETTE.sahOchreDk : PALETTE.sahGravel);
        }
      }
    }
  }
  const m = new THREE.Mesh(M.build(), sahVC());
  m.receiveShadow = true;
  root.add(m);
}

// ================================================================ THE TRADES ==
/**
 * A SOUK IS NOT A GRID OF STALLS. IT IS SIX TRADES, AND THEY ARE NOT MIXED.
 *
 * The census says this chapter is "a lot of one thing repeated over the biggest
 * land area in the project" — second-highest instance count, second-lowest
 * triangle density, 24th percentile for object density. The souk is where that
 * shows worst: eight by four cells of identical booth, in the one place in the
 * chapter where the whole point is that every alley smells different from the
 * last one.
 *
 * Marrakech's souks are organised by trade and always have been — the
 * dyers, the leather, the brass, the spice, the baskets and the carpets each
 * have their own lanes — so each cell gets ONE of six, decided by its own
 * coordinates so the trades come in runs rather than a chessboard, and each
 * trade is a different family of object:
 *
 *   DYERS      skeins of wool over a pole, in six colours, dripping.
 *   BRASS      lanterns strung on wires across the alley, which is the one
 *              thing that changes the shape of the SPACE rather than filling it.
 *   SPICE      cones. Nothing else in this game is a cone of powder and
 *              nothing else looks remotely like one.
 *   LEATHER    stacked slippers and hides over a rail.
 *   BASKETS    stacked, nested, and hung up the posts.
 *   CARPETS    hung flat down the front of the booth, which is the only object
 *              in the medina that is a big flat coloured rectangle and is the
 *              reason the alleys read as colourful at all.
 *
 * All six are batched per TRADE rather than per cell: a trade runs in a lane,
 * so its batch is already a long thin box and culls about as well as a cell
 * would, and six batches beat thirty-two.
 *
 * None of it casts. It is all under an awning that already does, in an alley
 * three metres wide, and a hanging carpet's shadow lands on the wall nine
 * inches behind it.
 */
function sahBuildTrades(game, root) {
  const wool = [], woolPole = [], lantern = [], wire = [], spice = [], hide = [];
  const basket = [], carpet = [], carpetTrim = [];
  for (let ix = 0; ix < sahSOUK_NX; ix++) {
    for (let iz = 0; iz < sahSOUK_NZ; iz++) {
      // Trades come in RUNS. (ix + iz*2) walks along a lane before it changes,
      // so the dyers are three booths together and then the brass starts —
      // which is what a souk is and what a chessboard is not.
      const trade = ((ix + iz * 2) / 2 | 0) % 6;
      const cx = sahSOUK_X0 + ix * sahSOUK_CELL + sahSOUK_BLOCK * 0.5;
      const cz = sahSOUK_Z0 + iz * sahSOUK_CELL + sahSOUK_BLOCK * 0.5;
      const gy = sahTerrain(cx, cz);
      // the stall front faces the alley, which runs in +x
      const fz = cz + sahSOUK_BLOCK * 0.5 + 0.35;
      if (trade === 0) {
        // the dyers' skeins over a pole
        sahPush9(woolPole, cx, gy + 2.05, fz, 0, 0, Math.PI * 0.5, 0.09, 5.6, 0.09);
        for (let k = 0; k < 11; k++) {
          const x = cx - 2.4 + k * 0.48;
          sahPush9(wool, x, gy + 1.52, fz, 0, k * 0.4, 0, 0.34, 1.05, 0.26);
          sahPush9(wool, x, gy + 0.98, fz + 0.05, 0.2, k * 0.4, 0, 0.30, 0.55, 0.22);
        }
      } else if (trade === 1) {
        // lanterns on a wire across the alley — the one object here that hangs
        // in the SPACE rather than standing in it
        sahPush9(wire, cx, gy + 3.4, fz + 1.6, 0, 0, Math.PI * 0.5, 0.035, 6.4, 0.035);
        for (let k = 0; k < 9; k++) {
          const x = cx - 2.7 + k * 0.68;
          const drop = 0.28 + ((k * 5) % 4) * 0.12;
          sahPush9(wire, x, gy + 3.4 - drop * 0.5, fz + 1.6, 0, 0, 0, 0.03, drop, 0.03);
          sahPush9(lantern, x, gy + 3.4 - drop - 0.22, fz + 1.6, 0, k * 0.6, 0,
                   0.34, 0.46, 0.34);
        }
      } else if (trade === 2) {
        // spice, in cones, in a rank, and the cones are the whole picture
        for (let k = 0; k < 8; k++) {
          const x = cx - 2.1 + (k % 4) * 1.35, z = fz - ((k / 4) | 0) * 0.85;
          const s = 0.36 + (k % 3) * 0.09;
          sahPush9(spice, x, gy + 0.92 + s * 0.5, z, 0, k, 0, s * 2.0, s * 1.7, s * 2.0);
        }
      } else if (trade === 3) {
        // leather: a rail of hides and four stacks of slippers
        sahPush9(woolPole, cx, gy + 1.95, fz, 0, 0, Math.PI * 0.5, 0.07, 5.2, 0.07);
        for (let k = 0; k < 7; k++) {
          sahPush9(hide, cx - 2.1 + k * 0.72, gy + 1.30, fz, 0.06, k * 0.3, 0,
                   0.62, 1.20, 0.09);
        }
        for (let k = 0; k < 12; k++) {
          sahPush9(hide, cx - 2.0 + (k % 4) * 1.3, gy + 0.94 + ((k / 4) | 0) * 0.13,
                   fz - 0.55, 0, k * 0.5, 0, 0.44, 0.12, 0.30);
        }
      } else if (trade === 4) {
        // baskets, stacked and nested and hung up the post
        for (let k = 0; k < 13; k++) {
          const col = k % 4;
          const x = cx - 2.2 + col * 1.5;
          const lev = (k / 4) | 0;
          const s = 0.52 - lev * 0.06;
          sahPush9(basket, x, gy + 0.95 + lev * 0.42, fz - 0.3, 0.04, k * 0.7, 0.03,
                   s * 2, s * 0.8, s * 2);
        }
      } else {
        // and the carpets, hung flat, which is the only large flat colour in
        // the medina and the reason the alleys photograph the way they do
        for (let k = 0; k < 4; k++) {
          const x = cx - 2.1 + k * 1.42;
          sahPush9(carpet, x, gy + 1.62, fz, 0.05, 0, 0, 1.24, 2.35, 0.08);
          sahPush9(carpetTrim, x, gy + 2.78, fz, 0.05, 0, 0, 1.30, 0.14, 0.11);
        }
      }
    }
  }
  const B = (geo, col, list, nm, opts) => {
    const m = sahInstance(root, geo, col, list, false, true, opts);
    if (m) { m.name = nm; m.userData.noShadow = true; }
    return m;
  };
  B(sahG.cyl6, PALETTE.sahCedarDk, woolPole, 'sahTrade:pole');
  B(sahG.cyl6, PALETTE.sahTileBlue, wool, 'sahTrade:wool');
  B(sahG.box, PALETTE.sahCedarDk, wire, 'sahTrade:wire');
  B(sahG.sphLo, PALETTE.sahBrass, lantern, 'sahTrade:lantern');
  B(sahG.cone6, PALETTE.sahOrange, spice, 'sahTrade:spice');
  B(sahG.box, PALETTE.sahCedar, hide, 'sahTrade:hide');
  B(sahG.cyl8, PALETTE.sahRope, basket, 'sahTrade:basket');
  B(sahG.box, PALETTE.sahTileGreen, carpet, 'sahTrade:carpet');
  B(sahG.box, PALETTE.sahBrassDk, carpetTrim, 'sahTrade:carpetTrim');
}

// ============================================================ THE PALMERAIE ==
/**
 * A PALM GROVE IS AN IRRIGATION SYSTEM WITH TREES IN IT.
 *
 * sahBuildPalmeraie draws ninety beautiful palms on bare sand. Nothing else in
 * it exists — and a palmeraie is not a wood, it is the single most engineered
 * landscape in North Africa: every tree in it stands beside an open channel
 * cut in the ground, every plot is walled in pisé to stop the sand walking
 * into it, and the dates come off it onto racks. Take those three away and
 * what is left is a car park with palms in it, which is what this was.
 *
 *   THE SEGUIA. Open channels, ankle deep, running dead straight between the
 *     rows and turning at right angles, because water does not meander when
 *     somebody has cut the ditch. They are MARKS — flush, 6 cm of relief,
 *     never casting — with a low bank of spoil on each side, which is a THING
 *     and does.
 *   THE PISÉ WALLS. Rammed earth, half collapsed, half repaired, about
 *     shoulder height, dividing the grove into plots. This is the object that
 *     gives the grove a plan.
 *   THE DRYING RACKS AND THE FALLEN FRONDS, because a palm grove floor is
 *     ankle deep in what the palms have dropped.
 */
const sahPALM_X0 = 96, sahPALM_Z0 = -34;

// ================================================================ THE GOATS ==
/**
 * M5 — THE ONE CHAPTER IN THE GAME WITH NO ANIMALS IN IT.
 *
 * Measured before this: `grep` for a critter registration in this file returns
 * nothing. Five camels on a fixed loop, twelve storks that perch, and a cobra
 * in a basket — none of them registered, none of them addressable, and the
 * word "goat" appearing only as the material of the nomads' tents. Marrakech
 * is a city with a working agricultural belt round it and the belt was empty.
 *
 * A HERD, NOT SCENERY, which is the whole point: `game.herdOffer` at obey 1 is
 * the same contract Iceland's sheep take, so the wheek finally does something
 * west of the gate. Twenty-two goats in the palmeraie, in three loose groups
 * on the plots that already have walls round them.
 *
 * WHY GOATS AND WHY IN THE TREES. A Moroccan goat climbs an argan and this is
 * a date palmeraie, so they are on the ground — but the reason they belong
 * here at all is the seguia: four irrigated plots with pisé walls and gaps
 * somebody made in them is a picture of animals getting in, which the walls
 * already say and nothing was ever doing.
 *
 * Deliberately NOT given: a flee state of their own, a chase, a task. The herd
 * contract owns the wheek and the calm owns the approach; a chapter whose one
 * losable task is a chase does not need a second thing running away from you.
 */
const sahGOAT_STRIDE = 6;        // x, z, yaw, phase, home angle, chew
const sahGOAT_PENS = [
  { x: 110, z: -18, r: 7.5, n: 8 },
  { x: 140, z: 6,   r: 6.5, n: 7 },
  { x: 116, z: 22,  r: 8.0, n: 7 },
];
let sahGoatBody = null, sahGoatHead = null, sahGoatData = null, sahGoatN = 0;
let sahGoatCrit = null;
const sahGOAT_NEAR = 5.4;        // m of shuffle round the group's own centre
const sahGOAT_APPR_STOP = 2.4;   // ...and how close one comes to a sat capybara

function sahBuildGoats(game, root) {
  let n = 0;
  for (let p = 0; p < sahGOAT_PENS.length; p++) n += sahGOAT_PENS[p].n;
  sahGoatN = n;
  sahGoatData = new Float32Array(n * sahGOAT_STRIDE);
  const bodies = [], heads = [];
  let k = 0;
  for (let p = 0; p < sahGOAT_PENS.length; p++) {
    const P = sahGOAT_PENS[p];
    for (let i = 0; i < P.n; i++, k++) {
      const a = rand(0, 6.28318), r = Math.sqrt(Math.random()) * P.r;
      const x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r;
      const o = k * sahGOAT_STRIDE;
      sahGoatData[o] = x; sahGoatData[o + 1] = z;
      sahGoatData[o + 2] = rand(0, 6.28318);
      sahGoatData[o + 3] = rand(0, 6.28318);
      sahGoatData[o + 4] = a;
      sahGoatData[o + 5] = rand(0, 6.28318);
      const gy = sahTerrain(x, z);
      sahPush9(bodies, x, gy + 0.40, z, 0, sahGoatData[o + 2], 0, 0.46, 0.44, 0.78);
      sahPush9(heads, x, gy + 0.62, z, 0, sahGoatData[o + 2], 0, 0.22, 0.22, 0.30);
    }
  }
  // Two browns and no white: a herd of white goats in an ochre palmeraie is
  // the one thing in this chapter that would read as snow. See A MEDINA IS
  // NOT A CARNIVAL above.
  sahGoatBody = sahInstance(root, sahG.sph6, PALETTE.sahOchreDk, bodies, true, true);
  sahGoatHead = sahInstance(root, sahG.box, PALETTE.sahOchreDust, heads, true, false);
  if (sahGoatBody) {
    sahGoatBody.name = 'sahGoats';
    sahGoatBody.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }
  if (sahGoatHead) {
    sahGoatHead.name = 'sahGoatHeads';
    sahGoatHead.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }
  // The calm reads THIS — the herd offer returns its own record and does not
  // carry `near` or `appr`. bold 0.55: a goat will come and look at you, and
  // it makes its mind up slower than a sheep and much faster than it looks.
  // See THE LOAF in systems.js.
  if (typeof game.addCritter === 'function') {
    sahGoatCrit = game.addCritter({ biome: 'sahara', r: sahGOAT_NEAR, bold: 0.55 });
  }
  if (typeof game.herdOffer === 'function') {
    game.herdOffer({
      biome: 'sahara', kind: 'goat', obey: 1, voice: 'wheek', pitch: 1.55,
      count: function () { return sahGoatN; },
      at: function (i, out) {
        const o = i * sahGOAT_STRIDE;
        out.x = sahGoatData[o]; out.z = sahGoatData[o + 1];
        out.y = sahTerrain(out.x, out.z);
      },
      put: function (i, x, z, yaw) {
        const o = i * sahGOAT_STRIDE;
        sahGoatData[o] = x; sahGoatData[o + 1] = z; sahGoatData[o + 2] = yaw;
      },
    });
  }
}

function sahUpdateGoats(dt) {
  if (!sahGoatBody || !sahGoatN) return;
  const near = sahGoatCrit && sahGoatCrit.near ? sahGoatCrit.near : sahGOAT_NEAR;
  const appr = sahGoatCrit && sahGoatCrit.appr ? sahGoatCrit.appr : 0;
  let k = 0;
  for (let p = 0; p < sahGOAT_PENS.length; p++) {
    const P = sahGOAT_PENS[p];
    for (let i = 0; i < P.n; i++, k++) {
      const o = k * sahGOAT_STRIDE;
      let x = sahGoatData[o], z = sahGoatData[o + 1];
      // ---- the shuffle round the group's own centre ---------------------
      // The herd system owns them whenever it wants them (`put` writes x and
      // z straight in), so this only has to be what a goat does when nobody
      // is asking: drift back toward its own place on the ring, slowly.
      const ha = sahGoatData[o + 4];
      const hx = P.x + Math.cos(ha) * P.r * 0.72, hz = P.z + Math.sin(ha) * P.r * 0.72;
      const dx = hx - x, dz = hz - z;
      const d = Math.hypot(dx, dz);
      if (d > near) {
        const s = Math.min(d, 0.55 * dt) / d;
        x += dx * s; z += dz * s;
        sahGoatData[o + 2] = Math.atan2(dx, dz);
      }
      sahGoatData[o] = x; sahGoatData[o + 1] = z;
      // ---- and the head, which is the whole of the animation -------------
      // A goat grazing is a head going down and coming up, and nothing else
      // moves. `chew` runs on its own clock so twenty-two of them are never
      // in phase. `appr` is the calm's approach term: a goat walking up to a
      // capybara that has sat down keeps its head UP, which is the difference
      // between an animal grazing near you and an animal interested in you.
      sahGoatData[o + 5] += dt * (1.4 + Math.sin(sahGoatData[o + 3]) * 0.5);
      const graze = appr > 0.02 ? 0 : (0.5 + Math.sin(sahGoatData[o + 5]) * 0.5);
      const gy = sahTerrain(x, z);
      const yaw = sahGoatData[o + 2];
      const bob = Math.sin(sahGoatData[o + 5] * 0.5 + sahGoatData[o + 3]) * 0.012;
      sahGoatBody.setMatrixAt(k, sahXform(x, gy + 0.40 + bob, z,
                                          graze * 0.22, yaw, 0, 0.46, 0.44, 0.78));
      // the head hangs off the front of the body along its own yaw
      const hxo = Math.sin(yaw) * 0.34, hzo = Math.cos(yaw) * 0.34;
      sahGoatHead.setMatrixAt(k, sahXform(x + hxo, gy + 0.62 - graze * 0.30 + bob, z + hzo,
                                          graze * 0.85, yaw, 0, 0.22, 0.22, 0.30));
    }
  }
  sahGoatBody.instanceMatrix.needsUpdate = true;
  if (sahGoatHead) sahGoatHead.instanceMatrix.needsUpdate = true;
}

function sahBuildSeguia(game, root) {
  const M = sahMerger();
  const chan = [], bank = [], frond = [];
  const SG = sahStaticGroup(game);
  // four plots, each with its own wall and its own channel down the middle
  for (let p = 0; p < 4; p++) {
    const x0 = sahPALM_X0 + (p % 2) * 31, x1 = x0 + 27;
    const z0 = sahPALM_Z0 + ((p / 2) | 0) * 35, z1 = z0 + 31;
    // ---- the pisé wall round the plot ------------------------------------
    // Not a continuous box: a rammed-earth wall is built in LIFTS, in a
    // shuttering about two metres wide, and where it has fallen it has fallen
    // in whole lifts. Every fourth panel is missing, which is what makes it
    // read as old rather than as a fence.
    for (let side = 0; side < 4; side++) {
      const horiz = side % 2 === 0;
      const len = horiz ? (x1 - x0) : (z1 - z0);
      const n = Math.round(len / 2.2);
      for (let k = 0; k < n; k++) {
        if ((k + side * 3 + p) % 7 === 3) continue;           // a gap somebody made
        if ((k + side + p) % 11 === 5) continue;              // and one that fell in
        const t = (k + 0.5) / n;
        const x = horiz ? lerp(x0, x1, t) : (side === 1 ? x1 : x0);
        const z = horiz ? (side === 0 ? z0 : z1) : lerp(z0, z1, t);
        const gy = sahTerrain(x, z);
        const h = 1.55 + ((k * 5 + p) % 4) * 0.16;
        M.box(x, gy + h * 0.5, z, horiz ? 2.15 : 0.55, h, horiz ? 0.55 : 2.15,
              (k + p) % 3 ? PALETTE.sahOchreDust : PALETTE.sahOchreDk);
        // the lift line: pisé is poured in half-metre courses and the join
        // shows as a dark band all the way along
        M.box(x, gy + h * 0.55, z, horiz ? 2.2 : 0.60, 0.07, horiz ? 0.60 : 2.2,
              PALETTE.sahOchreDk);
        SG.add(x, gy + h * 0.5, z, horiz ? 2.2 : 0.6, h, horiz ? 0.6 : 2.2, 0);
      }
    }
    // ---- the seguia, down the middle and across the head ------------------
    for (let k = 0; k < 26; k++) {
      const t = k / 25;
      const x = lerp(x0 + 2, x1 - 2, t), z = (z0 + z1) * 0.5;
      const gy = sahTerrain(x, z);
      sahPush9(chan, x, gy + 0.03, z, 0, 0, 0, 1.2, 1, 0.95);
      for (let e = -1; e <= 1; e += 2) {
        sahPush9(bank, x, gy + 0.13, z + e * 0.72, 0, 0, 0, 1.2, 0.26, 0.42);
      }
    }
    for (let k = 0; k < 14; k++) {
      const t = k / 13;
      const x = x0 + 2.5, z = lerp(z0 + 2, z1 - 2, t);
      const gy = sahTerrain(x, z);
      sahPush9(chan, x, gy + 0.03, z, 0, 1.5708, 0, 1.2, 1, 0.95);
      for (let e = -1; e <= 1; e += 2) {
        sahPush9(bank, x + e * 0.72, gy + 0.13, z, 0, 1.5708, 0, 1.2, 0.26, 0.42);
      }
    }
    // ---- what the palms have dropped --------------------------------------
    for (let k = 0; k < 26; k++) {
      const x = rand(x0, x1), z = rand(z0, z1);
      const gy = sahTerrain(x, z);
      // A FALLEN FROND LIES ON ITS SIDE, which is the one orientation that
      // makes it read as fallen: flat on the sand it is a green playing card,
      // and this camera looks down 0.7 rad. Rolled to about a radian, it shows
      // its edge.
      sahPush9(frond, x, gy + 0.16, z, rand(0.8, 1.3), rand(0, 6.28), rand(-0.3, 0.3),
               0.42, 1, rand(1.5, 2.6));
    }
    // ---- and one drying rack per plot -------------------------------------
    {
      const rx = x0 + 6 + p, rz = z0 + 4;
      const gy = sahTerrain(rx, rz);
      for (let e = -1; e <= 1; e += 2) {
        M.cyl(rx + e * 2.0, gy + 0.85, rz, 0.11, 1.7, PALETTE.sahPalmTrunk, 0, 0, 0, 6);
        M.cyl(rx + e * 2.0, gy + 0.85, rz + 2.6, 0.11, 1.7, PALETTE.sahPalmTrunk, 0, 0, 0, 6);
      }
      for (let k = 0; k < 5; k++) {
        M.cyl(rx, gy + 1.68, rz + k * 0.65, 0.06, 4.2, PALETTE.sahPalmDry, 0, 0, Math.PI * 0.5, 4);
      }
      for (let k = 0; k < 22; k++) {
        M.box(rx - 1.7 + (k % 6) * 0.68, gy + 1.78, rz + ((k / 6) | 0) * 0.65,
              0.5, 0.12, 0.5, k % 3 ? PALETTE.sahCedar : PALETTE.sahCedarDk, 0, k * 0.4, 0);
      }
      SG.add(rx, gy + 0.9, rz + 1.3, 4.4, 1.8, 3.2, 0);
    }
  }
  SG.done();
  const m = new THREE.Mesh(M.build(), sahVC());
  m.name = 'sahSeguia';
  m.castShadow = true;
  m.receiveShadow = true;
  root.add(m);
  // The channel is a MARK. It is flush, it is 3 cm proud, and 160 of them each
  // casting a hard-edged shadow across a grove floor is the builder's-yard
  // failure the Antarctic glacier's crevasse lips were re-cut for.
  const cm = sahInstance(root, sahG.quad, PALETTE.sahSandShade, chan, false, true);
  if (cm) { cm.name = 'sahSeguiaWater'; cm.userData.noShadow = true; }
  const bm = sahInstance(root, sahG.box, PALETTE.sahOchreDust, bank, false, true);
  if (bm) bm.name = 'sahSeguiaBank';
  const fm = sahInstance(root, sahG.quad, PALETTE.sahPalmDry, frond, false, true,
                         { side: THREE.DoubleSide });
  if (fm) { fm.name = 'sahFallenFronds'; fm.userData.noShadow = true; }
}

// ================================================================== THE KSAR ==
/**
 * A LANDMARK IN THE ERG, WHICH HAD NONE.
 *
 * Everything east of the palmeraie is sand, the caravan, the camp and the dune.
 * The dune is a hundred and eighty metres away and forty-two metres high, so
 * from anywhere in the middle of that plain there is exactly one thing to
 * navigate by and it is the thing you are walking to. A world you cross needs
 * something at the half way point, and in the pre-Sahara that something is
 * always the same: a KSAR — a fortified mud village — abandoned and half
 * filled with sand.
 *
 * It is drawn as three things and no more: a corner tower still standing to
 * full height, two runs of curtain wall coming off it that die away into the
 * dune, and the roofless shells of five rooms inside. The sand is up to the
 * lintels, which is the fact that makes it read as abandoned rather than as
 * built small.
 */
const sahKSAR = { x: 212, z: -48 };

/**
 * THE KHETTARA. A DEAD STRAIGHT LINE OF HOLES ACROSS AN EMPTY PLAIN.
 *
 * The palmeraie at x = 96 is thirty metres above nothing and a hundred and
 * eighty metres from any water, and the reason it exists — the reason ANY of
 * them exist — is a khettara: a gently sloping tunnel driven for kilometres
 * from the water table under the hills to the grove, dug and maintained
 * through a line of vertical shafts sunk every fifteen metres. Each shaft has
 * a doughnut of spoil round its mouth, and from the air the whole system reads
 * as a chain of craters marching dead straight across bare gravel.
 *
 * It is the single most striking man-made object in this landscape, it is
 * invisible except for the holes, and it does the one job the middle of this
 * chapter needed doing: it is a LINE. A world you cross needs something to
 * cross it against, and a hundred and eighty metres of hamada with three thorn
 * bushes on it has nothing.
 *
 * The mouths are solid. A two-metre hole in the ground with a metre of spoil
 * round it that the animal walks straight through would be the most obvious
 * bug in the chapter.
 */
/**
 * THE TOWERS ON THE WALL, AND THE OLIVE GROVE OUTSIDE IT.
 *
 * The medina's rampart is eleven bays of battered pisé with merlons on top and
 * nothing else, which is a hundred and thirty metres of the same object. An
 * Almohad wall has a square tower every thirty metres or so — that is what
 * gives it a rhythm, and it is the only thing that stops a long wall reading as
 * a fence. Four of them, standing proud of the face and two metres higher than
 * the coping.
 *
 * And beyond it, the olive grove. Marrakech is ringed by them, they are the
 * first thing outside every gate, and the ground between the gate and the
 * hamada was bare. An olive is a short crooked trunk with a wide silver-grey
 * head — a completely different silhouette from the palms forty metres away,
 * which is the entire point of putting one here.
 */
function sahBuildTowers(game, root) {
  const M = sahMerger();
  const SG = sahStaticGroup(game);
  const gz = sahGATE.z;
  const at = [gz - sahGATE_OUT - 17, gz - sahGATE_OUT - 51, gz + sahGATE_OUT + 17,
              gz + sahGATE_OUT + 40];
  for (let i = 0; i < at.length; i++) {
    const z = at[i];
    // battered: 5.6 m at the foot, 4.4 at the coping, in five lifts
    for (let k = 0; k < 6; k++) {
      const t = k / 6;
      M.box(70.9, 0.95 + k * 1.9, z, 3.9 - t * 0.7, 1.9, 5.6 - t * 1.2,
            k % 2 ? PALETTE.sahOchre : PALETTE.sahOchreDk);
    }
    M.box(70.9, 12.1, z, 4.2, 0.8, 6.0, PALETTE.sahOchreDk);
    for (let k = 0; k < 5; k++) {
      M.box(70.9, 13.1, z - 2.2 + k * 1.1, 4.0, 1.2, 0.62, PALETTE.sahOchrePale);
    }
    // the putlog holes again, because it is the same wall by the same builders
    for (let k = 1; k < 5; k++) {
      M.cyl(72.9, 1.4 + k * 2.1, z, 0.09, 0.8, PALETTE.sahPalmTrunk, 0, 0, Math.PI * 0.5, 4);
    }
    SG.add(70.9, 6.0, z, 4.0, 12, 5.8, 0);
  }
  // ---- the olive grove -----------------------------------------------------
  for (let i = 0; i < 34; i++) {
    // between the wall and the hamada, in rows, because an olive grove is
    // planted and a palmeraie is planted and neither of them is a wood
    const row = i % 6, col = (i / 6) | 0;
    const x = 84 + col * 7.4 + (row % 2) * 2.2;
    const z = -18 + row * 8.2 + Math.sin(i * 1.7) * 1.4;
    if (Math.abs(x - sahGATE.x) < 12 && Math.abs(z - sahGATE.z) < 10) continue;
    const gy = sahTerrain(x, z);
    const h = 1.5 + ((i * 5) % 4) * 0.22;
    // a crooked trunk in two leans, which is what an old olive is
    M.cyl(x, gy + h * 0.32, z, 0.30, h * 0.7, PALETTE.sahCedarDk, 0.10, i, 0.08, 6);
    M.cyl(x + 0.14, gy + h * 0.78, z + 0.08, 0.22, h * 0.5, PALETTE.sahCedarDk,
          -0.14, i + 1, -0.10, 6);
    // and the head: three flattened lobes, silver-grey-green
    for (let k = 0; k < 3; k++) {
      const a = k * 2.094 + i;
      M.sph(x + Math.cos(a) * 0.85, gy + h * 1.24 + (k % 2) * 0.24,
            z + Math.sin(a) * 0.85, 1.35, 0.80, 1.25,
            k % 2 ? PALETTE.sahPalm : PALETTE.sahPalmDry);
    }
    SG.add(x, gy + h * 0.5, z, 0.8, h, 0.8, 0);
  }
  SG.done();
  const m = new THREE.Mesh(M.build(), sahVC());
  m.name = 'sahTowers';
  m.castShadow = true;
  m.receiveShadow = true;
  root.add(m);
}

function sahBuildKhettara(game, root) {
  const M = sahMerger();
  const SG = sahStaticGroup(game);
  // from the foot of the hills west of the medina to the head of the grove,
  // and it does not deviate, because the whole engineering point is that it
  // does not
  const x0 = 88, x1 = 268, z0 = -74, z1 = -58;
  const N = 13;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const x = lerp(x0, x1, t), z = lerp(z0, z1, t);
    const gy = sahTerrain(x, z);
    // the spoil ring: twelve blocks round a hole, higher on the downwind side
    // because that is where it has drifted
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * 6.28318;
      const h = 0.55 + Math.max(0, Math.cos(a - 1.2)) * 0.45;
      M.box(x + Math.cos(a) * 2.15, gy + h * 0.45, z + Math.sin(a) * 2.15,
            1.25, h, 1.05,
            k % 3 ? PALETTE.sahGravel : PALETTE.sahSandDeep,
            0.05 * Math.sin(a), a, 0.05 * Math.cos(a));
      SG.add(x + Math.cos(a) * 2.15, gy + h * 0.45, z + Math.sin(a) * 2.15,
             1.3, h + 0.2, 1.1, a);
    }
    // the mouth itself, which is a dark disc and nothing else. It is a MARK —
    // flush, and it never casts, because a hole cannot throw a shadow.
    M.cyl(x, gy + 0.035, z, 1.35, 0.07, PALETTE.sahSandDeep, 0, 0, 0, 8);
    M.cyl(x, gy + 0.01, z, 1.05, 0.05, PALETTE.sahStormDeep, 0, 0, 0, 8);
    // and every third one still has its windlass over it
    if (i % 3 === 1) {
      for (let e = -1; e <= 1; e += 2) {
        M.cyl(x + e * 1.5, gy + 1.0, z, 0.10, 2.0, PALETTE.sahPalmTrunk, 0, 0, e * 0.16, 6);
      }
      M.cyl(x, gy + 1.95, z, 0.14, 3.0, PALETTE.sahPalmTrunk, 0, 0, Math.PI * 0.5, 6);
      M.cyl(x + 0.55, gy + 1.95, z, 0.24, 0.7, PALETTE.sahCedar, 0, 0, Math.PI * 0.5, 6);
      SG.add(x, gy + 1.0, z, 3.4, 2.2, 0.5, 0);
    }
  }
  SG.done();
  const m = new THREE.Mesh(M.build(), sahVC());
  m.name = 'sahKhettara';
  m.castShadow = true;
  m.receiveShadow = true;
  root.add(m);
}

function sahBuildKsar(game, root) {
  const M = sahMerger();
  const SG = sahStaticGroup(game);
  const KX = sahKSAR.x, KZ = sahKSAR.z;
  const gy = sahTerrain(KX, KZ);
  // ---- the tower ---------------------------------------------------------
  // Battered — a pisé tower is always wider at the foot, and that taper is
  // the whole silhouette of the form.
  for (let k = 0; k < 6; k++) {
    const t = k / 6;
    const w = 5.4 - t * 1.5;
    M.box(KX, gy + 1.2 + k * 2.0, KZ, w, 2.0, w,
          k % 2 ? PALETTE.sahOchreDust : PALETTE.sahOchreDk);
    // the putlog holes: the ends of the scaffolding poles are left in the wall
    // and they stick out, and they are the single most recognisable detail on
    // any earth building in the Sahara
    if (k > 1 && k < 5) {
      for (let s2 = 0; s2 < 4; s2++) {
        const a = s2 * 1.5708;
        M.cyl(KX + Math.cos(a) * (w * 0.5 + 0.22), gy + 1.2 + k * 2.0,
              KZ + Math.sin(a) * (w * 0.5 + 0.22),
              0.09, 0.7, PALETTE.sahPalmTrunk, 0, -a, Math.PI * 0.5, 4);
      }
    }
  }
  // the crenellated top, and the tapering finials that go on the corners
  M.box(KX, gy + 13.4, KZ, 4.4, 0.5, 4.4, PALETTE.sahOchrePale);
  for (let c = 0; c < 4; c++) {
    const sx = (c & 1) ? 1 : -1, sz = (c & 2) ? 1 : -1;
    M.box(KX + sx * 1.75, gy + 14.1, KZ + sz * 1.75, 0.75, 1.0, 0.75, PALETTE.sahOchreDust);
    M.cone(KX + sx * 1.75, gy + 15.1, KZ + sz * 1.75, 0.36, 1.0, PALETTE.sahOchrePale, 0, 0, 0, 4);
  }
  SG.add(KX, gy + 6.5, KZ, 5.4, 13, 5.4, 0);
  // ---- two runs of curtain wall, dying into the sand ---------------------
  for (let d = 0; d < 2; d++) {
    const dx = d ? 1 : 0, dz = d ? 0 : 1;
    for (let k = 1; k < 13; k++) {
      const x = KX + dx * k * 2.4, z = KZ + dz * k * 2.4;
      // the sand is UP the wall: the further from the tower, the less of it is
      // left showing, and the last three panels are a ridge in the ground
      const h = Math.max(0.25, 6.2 - k * 0.52 - ((k * 7) % 3) * 0.4);
      const g2 = sahTerrain(x, z);
      M.box(x, g2 + h * 0.5, z, dx ? 2.5 : 0.7, h, dx ? 0.7 : 2.5,
            (k % 3) ? PALETTE.sahOchreDust : PALETTE.sahOchreDk);
      if (h > 1.0) SG.add(x, g2 + h * 0.5, z, dx ? 2.5 : 0.8, h, dx ? 0.8 : 2.5, 0);
      // and the drift piled against the windward face of it
      if (h > 0.8) {
        M.sph(x + (dx ? 0 : 1.1), g2 + 0.25, z + (dx ? 1.1 : 0),
              dx ? 1.9 : 1.5, 0.55, dx ? 1.5 : 1.9, PALETTE.sahSand);
      }
    }
  }
  // ---- five roofless rooms inside -----------------------------------------
  for (let r = 0; r < 5; r++) {
    const rx = KX + 5.5 + (r % 3) * 6.2, rz = KZ + 5.0 + ((r / 3) | 0) * 6.4;
    const g2 = sahTerrain(rx, rz);
    const w = 4.2, dp = 3.6, h = 2.1 - (r % 3) * 0.3;
    for (let side = 0; side < 4; side++) {
      const horiz = side % 2 === 0;
      // one wall of every room is down to a stub, because they always are
      const hh = (side === (r % 4)) ? h * 0.35 : h;
      M.box(rx + (horiz ? 0 : (side === 1 ? w * 0.5 : -w * 0.5)), g2 + hh * 0.5,
            rz + (horiz ? (side === 0 ? -dp * 0.5 : dp * 0.5) : 0),
            horiz ? w : 0.45, hh, horiz ? 0.45 : dp,
            (r + side) % 3 ? PALETTE.sahOchreDust : PALETTE.sahOchreDk);
      if (hh > 1.0) {
        SG.add(rx + (horiz ? 0 : (side === 1 ? w * 0.5 : -w * 0.5)), g2 + hh * 0.5,
               rz + (horiz ? (side === 0 ? -dp * 0.5 : dp * 0.5) : 0),
               horiz ? w : 0.5, hh, horiz ? 0.5 : dp, 0);
      }
    }
    // the sand that has come in and is now most of the room
    M.sph(rx, g2 + 0.3, rz, w * 0.42, 0.55, dp * 0.42, PALETTE.sahSand);
    // a palm-beam lintel over the doorway, which is the only wood in the ruin
    M.cyl(rx, g2 + h * 0.86, rz - dp * 0.5, 0.13, 1.5, PALETTE.sahPalmTrunk,
          0, 0, Math.PI * 0.5, 4);
  }
  SG.done();
  const m = new THREE.Mesh(M.build(), sahVC());
  m.name = 'sahKsar';
  m.castShadow = true;
  m.receiveShadow = true;
  root.add(m);
}

// ================================================================= VARIETY ==
/**
 * SEVEN THOUSAND EIGHT HUNDRED AND FORTY-EIGHT INSTANCES, AND IT IS A LOT OF
 * ONE THING.
 *
 * The Sahara is the odd one out in the whole census. It carries the second
 * highest instance count in the game and the second LOWEST triangle density,
 * and it sits in the 24th percentile for objects per thousand square metres.
 * That combination has exactly one meaning: the world is enormous (94,128 m²
 * of walkable ground, the biggest in the project) and it is covered in
 * repetitions of a very small number of things. Four thousand three hundred
 * and twenty palm fronds, two thousand two hundred and fifty-two sand ripples,
 * two hundred and seventy scrub tetrahedra — three families, and past the
 * medina wall that is the entire contents of a hundred and eighty metres of
 * desert.
 *
 * So this pass is not more scatter. It is VARIETY: eleven new families of
 * object spread across the three grounds the chapter actually has, each of them
 * a thing that is genuinely there and none of them a repetition of something
 * that already is.
 *
 *   ON THE HAMADA (the gravel plain between the medina and the erg), which had
 *     nothing at all on it: camel-thorn, dead acacia, a nomad's dry-stone
 *     windbreak, bleached bone, and the line of telegraph poles that runs
 *     beside every road in the south.
 *   IN THE PALMERAIE: the SEGUIA — the open irrigation channels that are the
 *     only reason a palm grove exists — and the pisé garden walls between the
 *     plots, and the date-drying racks.
 *   IN THE ERG: barchan horns, a wind-scoured hollow with the gravel lag left
 *     in the bottom of it, and the one thing every photograph of the Sahara
 *     has and this chapter did not: TRACKS.
 *
 * PER-CELL, AND ALMOST NONE OF IT CASTS. The chapter flags 91 % of its
 * geometry castShadow — the highest in the game — under a sun that is
 * effectively overhead, so a 30 cm thorn bush casts a shadow the size of
 * itself and is drawn twice to do it. The poles, the acacias and the
 * windbreaks cast, because a long shadow across bare gravel is the only thing
 * in that part of the chapter with any scale in it at all.
 */
const sahVAR_CELLS = (function () {
  // The hamada and the erg, cut into cells of about fifty metres. The medina
  // and the souk are not in this: they are built, they are dense already, and
  // dropping a thorn bush inside a stall is the one failure mode here.
  const XS = [36, 84, 132, 180, 228, 276, 324];
  const ZS = [-96, -56, -18, 20, 58, 96];
  const out = [];
  for (let i = 0; i < XS.length - 1; i++) {
    for (let k = 0; k < ZS.length - 1; k++) out.push([XS[i], XS[i + 1], ZS[k], ZS[k + 1]]);
  }
  return out;
})();

/** Nothing may be planted on the caravan's line, in the camp, or on the run. */
function sahVarBlocked(x, z) {
  if (Math.hypot(x - sahCAMP.x, z - sahCAMP.z) < 22) return true;
  if (Math.abs(x - sahGATE.x) < 16 && Math.abs(z - sahGATE.z) < 14) return true;
  // the dune's windward face and its slipface are the surf run and must stay
  // completely clean — a bush on it at nineteen metres a second is a wall
  if (x > sahDUNE_X - sahDUNE_W - 6 && x < sahDUNE_X + sahDUNE_L + 6 &&
      Math.abs(z - sahDUNE_Z) < sahDUNE_HZ + 6) return true;
  return false;
}

function sahBuildVariety(game, root) {
  const SB = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
  let solid = false;
  for (let c = 0; c < sahVAR_CELLS.length; c++) {
    const C = sahVAR_CELLS[c];
    const thorn = [], thornDk = [], bone = [], lag = [], acaciaT = [], acaciaC = [];
    const poleT = [], poleArm = [], stone = [], track = [], horn = [];
    const erg = C[0] > sahERG_X;

    // ---- CAMEL-THORN, which is what actually grows on a hamada ------------
    // Not a tetrahedron. A thorn bush is a tangle with nothing solid in the
    // middle of it: five thin crossed spines round a common centre, which at
    // this size is five boxes and reads as a bush from anywhere.
    const nTh = erg ? 12 : 34;
    for (let i = 0; i < nTh; i++) {
      const x = rand(C[0], C[1]), z = rand(C[2], C[3]);
      if (sahVarBlocked(x, z)) continue;
      const y = sahTerrain(x, z);
      const s = rand(0.5, 1.15);
      for (let k = 0; k < 5; k++) {
        const a = k * 1.257 + i;
        sahPush9(k % 2 ? thorn : thornDk,
                 x + Math.cos(a) * s * 0.22, y + s * 0.34, z + Math.sin(a) * s * 0.22,
                 Math.sin(a) * 0.5, a, -Math.cos(a) * 0.5,
                 s * 0.09, s * 0.95, s * 0.09);
      }
    }

    // ---- THE DEAD ACACIA ---------------------------------------------------
    // One tree every couple of hundred metres, dead, and it is the only thing
    // in the erg that gives the eye a height. It casts, and its shadow is the
    // best thing in that half of the chapter.
    if ((c % 3) === 1) {
      const x = rand(C[0] + 8, C[1] - 8), z = rand(C[2] + 8, C[3] - 8);
      if (!sahVarBlocked(x, z)) {
        const y = sahTerrain(x, z);
        const h = rand(2.6, 4.2);
        sahPush9(acaciaT, x, y + h * 0.42, z, 0.06, rand(0, 6.28), 0.05, 0.34, h * 0.85, 0.34);
        // an acacia is a FLAT TOP — it is browsed to a table by everything that
        // can reach it, and that silhouette is the whole tree
        for (let k = 0; k < 5; k++) {
          const a = k * 1.257 + c;
          sahPush9(acaciaC, x + Math.cos(a) * h * 0.42, y + h * (0.80 + (k % 2) * 0.08),
                   z + Math.sin(a) * h * 0.42, Math.sin(a) * 0.85, a, -Math.cos(a) * 0.85,
                   0.13, h * 0.72, 0.13);
        }
        sahStaticBox(game, x, y + h * 0.42, z, 0.6, h * 0.85, 0.6, 0);
      }
    }

    // ---- THE WINDBREAK, which is how anybody sleeps out here --------------
    // A crescent of dry stone about waist high, opening away from the wind.
    // It is the only built thing on the hamada and it is what says somebody
    // crosses this.
    if (!erg && (c % 3) === 2) {
      const cx = rand(C[0] + 10, C[1] - 10), cz = rand(C[2] + 10, C[3] - 10);
      if (!sahVarBlocked(cx, cz)) {
        const gy = sahTerrain(cx, cz);
        for (let k = 0; k < 13; k++) {
          const a = -1.5 + k * 0.25;
          const x = cx + Math.cos(a) * 3.4, z = cz + Math.sin(a) * 3.4;
          for (let r = 0; r < 3; r++) {
            sahPush9(stone, x, gy + 0.16 + r * 0.28, z,
                     0.05 * (r - 1), a + Math.sin(k + r) * 0.2, 0.05 * ((k + r) % 2 ? 1 : -1),
                     0.85 - r * 0.11, 0.30, 0.62 - r * 0.06);
          }
          SB.addShape(new CANNON.Box(new CANNON.Vec3(0.5, 0.45, 0.4)),
                      new CANNON.Vec3(x, gy + 0.45, z));
          solid = true;
        }
        // the fire ring in the lee of it, which is the point of the wall
        for (let k = 0; k < 8; k++) {
          const a = k * 0.785;
          sahPush9(stone, cx + Math.cos(a) * 0.85, gy + 0.11, cz + Math.sin(a) * 0.85,
                   0.1, a, 0.1, 0.34, 0.22, 0.30);
        }
      }
    }

    // ---- THE TELEGRAPH LINE -------------------------------------------------
    // It runs east-west across the middle of the map beside the piste, because
    // that is where it runs in the world, and it is the one thing out here that
    // is a straight line. A pole every twenty-eight metres: from the ground it
    // gives the plain a scale, and from the top of the dune it draws the way
    // back.
    if (!erg && C[2] <= 20 && C[3] > 20) {
      for (let px = C[0] + 6; px < C[1]; px += 28) {
        const pz = 30 + Math.sin(px * 0.02) * 3;
        if (sahVarBlocked(px, pz)) continue;
        const gy = sahTerrain(px, pz);
        sahPush9(poleT, px, gy + 3.1, pz, 0.03, 0, 0.02, 0.28, 6.2, 0.28);
        for (let k = 0; k < 2; k++) {
          sahPush9(poleArm, px, gy + 5.5 - k * 0.55, pz, 0, 0, Math.PI * 0.5, 0.14, 1.7, 0.14);
        }
        sahStaticBox(game, px, gy + 3.1, pz, 0.5, 6.2, 0.5, 0);
      }
    }

    // ---- BONE, GRAVEL LAG AND TRACKS ---------------------------------------
    // Three ground MARKS, so all three are flat quads at 3 cm of relief and
    // none of them casts: the rule this codebase has paid for six times is that
    // a mark is flush and a thing is three-dimensional, and mixing them is what
    // turns a desert floor into a builder's yard.
    for (let i = 0; i < (erg ? 34 : 24); i++) {
      const x = rand(C[0], C[1]), z = rand(C[2], C[3]);
      if (sahVarBlocked(x, z)) continue;
      const y = sahTerrain(x, z);
      const s = rand(1.1, 3.4);
      sahPush9(lag, x, y + 0.03, z, 0, rand(0, 6.28), 0, s, 1, s * 0.72);
    }
    if (!erg) {
      for (let i = 0; i < 6; i++) {
        const x = rand(C[0], C[1]), z = rand(C[2], C[3]);
        if (sahVarBlocked(x, z)) continue;
        const y = sahTerrain(x, z);
        // a rib cage, which is four curved staves and nothing else
        for (let k = 0; k < 5; k++) {
          sahPush9(bone, x + k * 0.22, y + 0.16 + Math.sin(k * 0.8) * 0.10, z,
                   0.2, 0.3 + k * 0.06, 1.1 - k * 0.14, 0.07, 0.95, 0.07);
        }
      }
    }
    // TRACKS. Every photograph of this desert has a set of tyre tracks or a
    // camel line across it and this chapter had neither, which is most of why
    // the erg reads as untouched rather than as crossed. Two parallel bands,
    // running the way the caravan runs.
    if (erg) {
      for (let i = 0; i < 3; i++) {
        const z0 = rand(C[2], C[3]);
        for (let px = C[0]; px < C[1]; px += 2.2) {
          const pz = z0 + Math.sin(px * 0.05 + i) * 2.6;
          if (sahVarBlocked(px, pz)) continue;
          for (let e = -1; e <= 1; e += 2) {
            sahPush9(track, px, sahTerrain(px, pz + e * 0.7) + 0.025, pz + e * 0.7,
                     0, Math.cos(px * 0.05 + i) * 0.13, 0, 2.3, 1, 0.42);
          }
        }
      }
      // and the HORNS of a barchan: every dune out here trails two, and they
      // are the shape that makes a dune field read as a dune field.
      for (let i = 0; i < 2; i++) {
        const hx = rand(C[0] + 10, C[1] - 10), hz = rand(C[2] + 8, C[3] - 8);
        if (sahVarBlocked(hx, hz)) continue;
        const gy = sahTerrain(hx, hz);
        for (let e = -1; e <= 1; e += 2) {
          for (let k = 0; k < 7; k++) {
            const t = k / 6;
            sahPush9(horn, hx + t * 13, gy + (1 - t) * 1.9 * 0.5,
                     hz + e * (2.5 + t * 7),
                     0, e * 0.4 + t * 0.3, 0, 7 - t * 4.5, (1 - t) * 1.9 + 0.25, 4.5 - t * 2.6);
          }
        }
      }
    }

    const id = 'c' + c;
    const B = (geo, col, list, cast, recv, nm, opts) => {
      const m = sahInstance(root, geo, col, list, cast, recv, opts);
      if (m) { m.name = nm + ':' + id; if (!cast) m.userData.noShadow = true; }
      return m;
    };
    // WATCH THE ALBEDO CEILING. This chapter runs the brightest ambient in the
    // game under a sun very nearly overhead, and measured off the rendered
    // frame of the hamada the ground comes back close to white. sahPalmDry
    // (0xa89a5f) and sahGravel (0xc4a882) are both sand tones ON sand: a thorn
    // bush painted in them is a thing you cannot see, which is the Antarctic
    // guano stain and the black beach for the third time. A dead thorn is
    // nearly black anyway, and so is the lag left in a scoured hollow.
    B(sahG.box, PALETTE.sahCedarDk, thorn, false, false, 'sahVar:thorn');
    B(sahG.box, PALETTE.sahStormDeep, thornDk, false, false, 'sahVar:thornDk');
    B(sahG.box, PALETTE.sahPlaster, bone, false, true, 'sahVar:bone');
    B(sahG.quad, PALETTE.sahSandShade, lag, false, true, 'sahVar:lag');
    B(sahG.quad, PALETTE.sahSandShade, track, false, true, 'sahVar:track');
    B(sahG.cylO6, PALETTE.sahCedarDk, acaciaT, true, true, 'sahVar:acaciaT');
    B(sahG.cylO6, PALETTE.sahCedarDk, acaciaC, true, false, 'sahVar:acaciaC');
    B(sahG.cyl6, PALETTE.sahCedar, poleT, true, true, 'sahVar:poleT');
    B(sahG.cyl6, PALETTE.sahCedarDk, poleArm, true, false, 'sahVar:poleArm');
    B(sahG.box, PALETTE.sahGravel, stone, true, true, 'sahVar:stone');
    B(sahG.sphLo, PALETTE.sahSandShade, horn, false, true, 'sahVar:horn');
  }
  if (solid) { sahSyncBody(SB); game.world.addBody(SB); }
}

function sahBuildErg(root) {
  // ---- THE RIPPLES, AND THEY WERE LYING DOWN THE WIND -------------------
  //
  // "A dune surface is corrugated at about a metre and it is what gives an
  // otherwise featureless slope any sense of scale at all." Correct, and the
  // implementation was corrugated along the WRONG AXIS: the wind in this
  // chapter blows west (the storm pushes -x, the dune's windward face is its
  // west side), and the ripples were 2.2–5.0 m long in X and 0.4–0.8 m wide in
  // Z — i.e. lying PARALLEL to the wind, at a random yaw each, four hundred and
  // twenty of them scattered over eleven thousand square metres. What the shot
  // of the great dune shows is not corrugation, it is litter: a few hundred
  // pale wedges lying about on a featureless dome.
  //
  // Sand ripples form ACROSS the wind, they are close together, they are
  // parallel to each other over enormous distances, and they read entirely by
  // the shadow on their lee side — which a flat 0.1 m plate lying on the
  // ground cannot cast. So: long in Z, thin in X, dense, all at the same yaw
  // give or take a couple of degrees, and TILTED, so one face takes the light
  // and the other does not.
  // ...AND ON A GRID, NOT AT RANDOM. Fifteen hundred scattered five-metre
  // plates at eleven per cent coverage is not corrugation either — it is
  // planks lying about on a beach, which is what the second shot of the camp
  // shows. Ripples are CONTINUOUS and they are PARALLEL, so they are laid on a
  // grid: a line every metre and a half across the wind, in long segments with
  // staggered joints so the lines do not read as one repeated object.
  //
  // And they are the colour of the sand they are on. The corrugation is not a
  // paint job, it is a light effect: a plate tilted twenty degrees toward the
  // sun takes more light than the ground beside it and its neighbour tilted
  // the other way takes less, which is exactly how the real thing reads and
  // is the reason a dune has a texture at two hundred metres and no texture at
  // two metres.
  // ...AND VERY QUIETLY. A metre-and-a-half pitch of eleven-metre plates
  // tilted twenty degrees, with a shade-coloured trough between every pair,
  // turned the whole erg into corrugated iron — the shot of the camp is a
  // venetian blind three hundred metres across. The correct amount of this
  // effect is the amount you do not notice: the ripples are the SAME COLOUR as
  // the sand, tilted eleven degrees, at a two-and-a-half metre pitch, so all
  // they do is give the light somewhere to catch. There is no trough. The
  // shade colour was doing the work of the geometry, and doing it far too
  // loudly.
  // ...AND ONLY WHERE ANYBODY CAN SEE THEM. The field ran x 165 → 344 and
  // z −104 → 124: 4,680 quads, nearly a thousand of which are behind the lee of
  // the great dune or a hundred metres off either shoulder of a ridge that
  // tapers to nothing at z = 10 ± 78. Trimming it to the ground the chapter
  // actually crosses costs nothing visible and buys back 2,800 triangles for
  // the crest below.
  const rip = [];
  // AND THEY HAVE TO TOUCH. At a 2.5 m pitch and 0.62 m wide the coverage is a
  // quarter, which is not corrugation, it is slats — the shot of the great dune
  // reads as a field of loose wedges. A sawtooth needs its teeth to MEET: at a
  // two-metre pitch and 1.75 m wide they overlap slightly, so what the eye gets
  // is one continuous surface that is alternately tilted toward and away from
  // the sun, which is all a ripple field is.
  for (let x = sahERG_X; x < 330; x += 2.0) {
    for (let z = -86; z < 108; z += 11) {
      const zz = z + ((Math.round(x * 7) % 5) / 5) * 11;      // staggered joints
      const y = sahTerrain(x, zz);
      if (y < 1) continue;
      // ---- AND NEVER ON THE SLIPFACE -------------------------------------
      // A slipface stands at the angle of repose and is the one surface in an
      // erg that is SMOOTH: nothing ripples on it, because everything on it is
      // sliding. Drawing the field straight across the crest also renders very
      // badly, and for a reason worth writing down — an eleven-metre plate
      // lying on a face falling at thirty-six degrees is seen nearly EDGE ON
      // from below, so the shot from the foot of the lee side is a hillside of
      // enormous pale spikes. Same failure as the first cut of this field
      // ("a venetian blind three hundred metres across"), arriving from the
      // other direction: it is not the amount of the effect that is wrong, it
      // is the angle it is being read at.
      const ztR = clamp(1 - Math.pow((zz - sahDUNE_Z) / sahDUNE_HZ, 2), 0, 1);
      if (ztR > 0.04 && x - sahDUNE_X - sahCrest(zz) > -3) continue;
      // a gentle sweep in the line, because a ripple field bends round a dune
      const yaw = Math.sin(x * 0.013 + zz * 0.006) * 0.20;
      // a little jitter in the pitch and the length, or a regular grid of
      // identical plates reads as brickwork rather than as sand
      const j = ((Math.round(x * 13 + zz) % 7) / 7 - 0.5);
      // A ZIGZAG, NOT A ROW OF PLATES. A quad has no side faces, so a single
      // set of them all tilted the same way gives no dark half at all and the
      // ripples vanished entirely the moment the box became a plane. What a
      // corrugation IS is two facets alternating: one turned toward the light
      // and the next turned away. Two quads per pitch, opposite tilts, meeting
      // in the middle — which is also, exactly, a sand ripple in section.
      // ...AND THE ROWS HAVE TO TOUCH ALONG THE RIPPLE TOO. The pitch across
      // the wind was right (1.15 wide on a 2.0 m step, so consecutive teeth
      // overlap) and the LENGTH was not: 6.4 ± 2 m segments laid on a 9 m grid
      // in z is seventy per cent coverage, so every row had two and a half
      // metres of bare sand between it and the next one along its own line.
      // Measured off the shot of the camp, that is a field of pale playing
      // cards, which is the fourth time this chapter has drawn a texture as a
      // scatter of objects. 11 ± 3 m on the same 9 m grid always overlaps.
      const len = 14.0 + j * 3.0;
      // ---- AND THEY HAVE TO LIE ON THE DUNE, NOT ACROSS IT -----------------
      // The plate is fifteen metres long and was laid FLAT at the terrain height
      // of its own centre. On a dune face that is a fifteen-metre plank resting
      // on a hillside: measured, the uphill end stood up to 1.05 m clear of the
      // sand, and since the plates are the same colour as the face they are on,
      // what the player sees is not a floating plate — it is GROUND, a metre
      // above the ground they are walking on, with the capybara buried in it to
      // the shoulders. That is this chapter's "falling below the ground".
      //
      // Fitted to the CHORD, not to the centre: sample the terrain at the
      // plate's own two ends, pitch it to the line between them and hang it from
      // the midpoint of that line. Both ends then sit exactly on the sand and
      // only the middle can deviate — by the sagitta of the dune over fifteen
      // metres, which on a convex face puts the middle UNDER the sand, where it
      // cannot be seen. -atan2, because with the 'YXZ' order Rx sends the local
      // +z end DOWN for a positive angle.
      // A chord alone is not enough: fitting the two ENDS leaves the middle
      // standing proud of anything concave and buried in anything convex, and
      // the toe of a slipface is concave — measured, that still left plates
      // 0.81 m over the sand. So the chord is fitted and then the whole plate is
      // DROPPED by the worst amount it stands above the ground along its own
      // length. It can then only ever be at or under the sand, which is the
      // right way round to be wrong: a buried ripple is a missing ripple, and a
      // floating one is a metre of false ground with the animal inside it.
      const hl = len * 0.5, ax = Math.sin(yaw), az = Math.cos(yaw);
      for (let s = -1; s <= 1; s += 2) {
        const px = x + s * 0.5;
        const y0 = sahTerrain(px - ax * hl, zz - az * hl);
        const y1 = sahTerrain(px + ax * hl, zz + az * hl);
        const mid = (y0 + y1) * 0.5;
        let over = 0;
        for (let k = -3; k <= 3; k++) {
          const f = k / 6;                       // -0.5 .. 0.5 of the length
          const gy = sahTerrain(px + ax * f * len, zz + az * f * len);
          const py = mid + (y1 - y0) * f;
          if (py - gy > over) over = py - gy;
        }
        sahPush9(rip, px, mid - over + 0.02, zz,
                 -Math.atan2(y1 - y0, len), yaw, s * 0.30, 1.15, 1, len);
      }
    }
  }
  // sahSandLit, NOT sahSand. sahBuildGround lerps the whole windward face
  // toward sahSandLit (that is what the east-gradient test is for), so plates
  // in the base sand colour are DARKER than the ground they are lying on and
  // the field reads as a scatter of dark wedges rather than as corrugation.
  // The ripples have to be the colour of the face they are on and let the
  // tilt do all the work.
  const ripMesh = sahInstance(root, sahG.quad, PALETTE.sahSandLit, rip, false, true);
  // ...AND IT MUST NOT CAST. Four thousand flat plates lying ON the dune, each
  // tilted seventeen degrees, throwing four thousand shadows onto the dune they
  // are a facet OF: at this sun angle that is a field of dirt. `castShadow` was
  // already false here and systems.js turns it straight back on — see
  // sahNoShadowOnGhosts, which reads this flag.
  if (ripMesh) { ripMesh.userData.noShadow = true; ripMesh.name = 'sahRipples'; }

  // ---- THE BRINK IS THE SHAPE OF THE GROUND, NOT A THING ON IT -----------
  // First attempt: fifteen cornice boxes hung along the ridge. Measured off the
  // rendered frame, five metres of box laid at one height across a face falling
  // at thirty-six degrees puts its far edge two and a half metres in the air —
  // a line of loose white paving slabs floating over the slipface, which is
  // exactly what Rio's breaking wave photographed as before it became a lofted
  // ribbon. A crest is not an object; it is where the surface turns over. So
  // the wander went into sahCrest() and into sahTerrain itself, where the
  // ground mesh and the collision heightfield both get it for nothing.

  // ---- AND A HORIZON MADE OF DUNES ---------------------------------------
  // East of the crest the world simply stopped: the shot from the top of the
  // run is one dune against a flat sky. An erg is not one dune, it is a
  // hundred, and the far ones are what give the near one a size. Twenty-six
  // barchans out on the lee plain and behind the ridge, instanced, flat cones
  // in the shade colour so they read as distance rather than as objects.
  {
    const far = [];
    for (let i = 0; i < 26; i++) {
      const a = (i * 2.39996) % 6.283;
      const r = 120 + ((i * 7919) % 100) / 100 * 190;
      const x = sahDUNE_X + 40 + Math.cos(a) * r * 0.55;
      const z = sahDUNE_Z + Math.sin(a) * r;
      if (x < sahDUNE_X + 30) continue;
      const w = 34 + ((i * 104729) % 100) / 100 * 62;
      sahPush9(far, x, sahTerrain(x, z) - 2, z, 0, a * 1.7, 0.0,
               w, 7 + w * 0.16, w * 0.62);
    }
    sahInstance(root, sahG.cone6, PALETTE.sahSand, far, false, false);
  }

  // a scatter of dry scrub on the hamada, and then absolutely nothing
  //
  // THIRD GO, AND THE FIRST TWO WERE WRONG IN OPPOSITE DIRECTIONS. Pale green
  // pyramids read as a field of little tents in a chapter that has real ones;
  // cedar-dark ones read, in the shot of the camp, as a hundred and ten sharp
  // BLACK CHIPS lying on pale sand — litter, which is exactly what the sand
  // ripples were the first time round and for the same reason: ground detail
  // must be the colour of the ground it is on, and the darkest value in the
  // frame is never a small object. The tell for both is that a thing which
  // should be scenery is the first thing the eye lands on.
  //
  // Dead hamada scrub is a low khaki tangle three shades off the gravel. Two
  // tetrahedra per bush — one wide and flat, one small and darker inside it —
  // so it has a bit of depth without ever being a silhouette.
  const scrub = [], scrubDk = [];
  for (let i = 0; i < 110; i++) {
    const x = rand(150, 208), z = rand(-70, 90);
    const w = rand(0.8, 1.6);
    const y = sahTerrain(x, z);
    sahPush9(scrub, x, y + 0.13, z, rand(-0.18, 0.18), rand(0, 6.28),
             rand(-0.18, 0.18), w, 0.30, w);
    if (i % 2 === 0) {
      sahPush9(scrubDk, x + rand(-0.3, 0.3), y + 0.22, z + rand(-0.3, 0.3),
               rand(-0.3, 0.3), rand(0, 6.28), rand(-0.3, 0.3), w * 0.58, 0.36, w * 0.58);
    }
  }
  sahInstance(root, sahG.tet, PALETTE.sahPalmDry, scrub, true, false);
  sahInstance(root, sahG.tet, PALETTE.sahSandDeep, scrubDk, false, false);
}

/**
 * WHERE THE GROUND'S TRIANGLES GO.
 *
 * A uniform 120 x 78 grid over 500 x 280 m is 18,720 triangles, fifteen per cent
 * of the chapter, and it spends exactly as many of them on the empty forty
 * metres behind the world's east edge as on Jemaa el-Fnaa. Palawan's lesson
 * (CONTRACT.md): WARP the grid rather than shrink it.
 *
 * In x it is a table, because this world is not symmetric — the medina wants the
 * finest cells (the square's wear is painted into these vertices now, see
 * below), the crest of the great dune wants the second finest because it is a
 * kink in the surface, and x > 340 is off the end of everything.
 *
 * In z it is a cubic blend, monotone by construction and mapping ±1 to itself,
 * so the mesh still ends exactly where the world does. 2.3 m cells through
 * |z| < 40, where the whole chapter is, against 3.6 m before.
 */
const sahGX = [-120, -80, 90, 160, 250, 340, 380];
const sahGN = [8, 44, 16, 20, 22, 4];              // cells per span; 114 total
function sahGridX(i) {
  let k = i;
  for (let s = 0; s < sahGN.length; s++) {
    if (k <= sahGN[s]) return lerp(sahGX[s], sahGX[s + 1], k / sahGN[s]);
    k -= sahGN[s];
  }
  return sahGX[sahGX.length - 1];
}
function sahGridZ(t) {                              // t in -1..1
  const k = 0.55;
  return t * (1 - k) + t * t * t * k;
}

function sahBuildGround() {
  const Z0 = -140, Z1 = 140;
  const NX = 114, NZ = 52;
  const g = new THREE.PlaneGeometry(1, 1, NX, NZ);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position.array;
  // PlaneGeometry lays its vertices out row-major from -0.5 to +0.5 in both
  // axes; both are remapped in place before anything else touches them.
  for (let j = 0; j <= NZ; j++) {
    for (let i = 0; i <= NX; i++) {
      const o = (j * (NX + 1) + i) * 3;
      p[o] = sahGridX(i);
      p[o + 2] = (Z0 + Z1) * 0.5 + sahGridZ((j / NZ) * 2 - 1) * (Z1 - Z0) * 0.5;
    }
  }
  const col = new Float32Array(p.length);
  const c = new THREE.Color();
  const ochre = new THREE.Color(PALETTE.sahOchreDust);
  const gravel = new THREE.Color(PALETTE.sahGravel);
  const sand = new THREE.Color(PALETTE.sahSand);
  const lit = new THREE.Color(PALETTE.sahSandLit);
  const shade = new THREE.Color(PALETTE.sahSandShade);
  const green = new THREE.Color(PALETTE.sahPalm);
  const worn = new THREE.Color(PALETTE.sahOchrePale);
  const polish = new THREE.Color(PALETTE.sahPlaster);
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i], z = p[i + 2];
    const y = sahTerrain(x, z);
    p[i + 1] = y;
    if (x < 86) {
      c.copy(ochre);
      // ---- EIGHT HUNDRED YEARS OF FEET, AND IT IS PAINT, NOT GEOMETRY -----
      // The square's wear used to be fifty-six flat eight-sided discs laid on
      // the ground at 3.5–9 m radius. Rendered, that is a scatter of pale
      // OCTAGONS with visible corners — the comment above them promised "no
      // edge anywhere because every edge is under another patch" and the
      // instrumented shot of Jemaa el-Fnaa shows every one of them. A square
      // that has been walked on is a colour, and this mesh is the surface it
      // is a colour OF, so it goes in the vertex colours: no triangles, no
      // draw call, and a polygon edge is not a thing it can have.
      //
      // Two terms. A broad radial bowl centred on the middle of the square,
      // and the two routes everybody takes across it — the gate in the east
      // and the Koutoubia in the west — both as soft bands rather than paths,
      // because at a 3.9 m cell a three-metre path is a staircase.
      const rw = Math.hypot((x - 0) / 30, (z - 4) / 22);
      let w = clamp(1.25 - rw, 0, 1);
      const eastBand = clamp(1 - Math.abs(z - lerp(sahGATE.z, 6, clamp((60 - x) / 56, 0, 1))) / 9, 0, 1);
      const westBand = clamp(1 - Math.abs(z - (7 + Math.sin((x + 44) * 0.08) * 2)) / 7, 0, 1);
      w = Math.max(w, eastBand * clamp((x + 6) / 20, 0, 1) * clamp((66 - x) / 10, 0, 1) * 0.9);
      w = Math.max(w, westBand * clamp((x + 46) / 12, 0, 1) * clamp((-4 - x) / 10, 0, 1) * 0.8);
      // and it is blotchy, because feet are
      w *= 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(x * 0.21 + z * 0.13) * Math.cos(z * 0.17 - x * 0.07));
      if (w > 0) {
        c.lerp(worn, clamp(w, 0, 1) * 0.85);
        c.lerp(polish, clamp(w - 0.55, 0, 1) * 0.5);
      }
    } else if (x < 152) {
      c.copy(gravel).lerp(green, clamp(0.35 + Math.sin(x * 0.09) * Math.sin(z * 0.07) * 0.3, 0, 0.5));
    } else if (x < sahERG_X) {
      c.copy(gravel);
    } else {
      // On a dune the lit face and the lee face are different COLOURS, not
      // different brightnesses — the shadowed side goes brown and the lit side
      // goes nearly white, and the crest line between them is the only edge in
      // the whole landscape.
      const east = sahTerrain(x + 3, z) - sahTerrain(x - 3, z);
      c.copy(sand);
      if (east > 0.1) c.lerp(lit, clamp(east * 1.6, 0, 0.85));
      else if (east < -0.1) c.lerp(shade, clamp(-east * 1.1, 0, 0.9));
      // ---- THE BRINK, WHICH IS THE ONLY EDGE IN THE LANDSCAPE ------------
      // The great dune is the chapter's marquee (`dune-surf`, the `wow`) and the
      // instrumented shot of it is a single unbroken pale mass with no crest
      // line at all — a slope you cannot see the top of, which is exactly the
      // one thing the player needs to see before committing to a hundred metres
      // of it. The east-gradient rule cannot draw it, because the gradient is
      // sampled over six metres and the crest is a kink, not a slope: three
      // metres either side of it the terrain is going UP on one side and DOWN
      // on the other and the two very nearly cancel.
      //
      // So the crest is named, the same way the slip band is named in
      // sahGroundSlip and for the same reason — a derived rule that gets the
      // one case the mechanic exists for wrong is worse than an exception.
      const zt = clamp(1 - Math.pow((z - sahDUNE_Z) / sahDUNE_HZ, 2), 0, 1);
      if (zt > 0.02) {
        const dxb = x - sahDUNE_X - sahCrest(z);
        // a hard bright lip in the last few metres of the windward face...
        if (dxb > -9 && dxb <= 0) c.lerp(lit, clamp((dxb + 9) / 9, 0, 1) * 0.92 * zt);
        // ...and the slipface, which is a different planet the moment you are
        // over it: no sun on it at all until the evening
        else if (dxb > 0 && dxb < sahDUNE_L) {
          c.lerp(shade, clamp(1 - dxb / (sahDUNE_L * 0.8), 0, 1) * 0.85 * zt);
        }
        // and the wind streaks the windward face along the flow, which is the
        // only thing that gives a hundred metres of one colour a direction
        if (dxb <= 0 && dxb > -sahDUNE_W) {
          // 31 m and 17 m periods against a ~3 m cell through the middle of the
          // grid: coarse enough that the mesh can carry it, fine enough that a
          // hundred metres of windward face is not one value.
          const st = Math.sin(z * 0.20 + dxb * 0.035) * Math.sin(z * 0.037 + 1.3) +
                     Math.sin(z * 0.37 + dxb * 0.02) * 0.45;
          c.lerp(st > 0 ? lit : shade, clamp(Math.abs(st), 0, 1) * 0.22 * zt);
        }
      }
    }
    col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, sahVCG());
  m.receiveShadow = true;
  m.frustumCulled = false;
  return m;
}

/** MIND WHICH WAY THE SECOND AXIS RUNS — anchored at the FAR z edge, j walking
 *  back toward Z0. See CONTRACT.md; getting this wrong leaves the whole biome
 *  with no collision floor and it is nearly invisible from the capybara. */
function sahBuildGroundBody(game) {
  const NX = 100, NZ = 56, X0 = -120, Z0 = -140, EL = 5;
  const Z1 = Z0 + NZ * EL;
  const data = [];
  for (let i = 0; i <= NX; i++) {
    const row = [];
    for (let j = 0; j <= NZ; j++) row.push(sahTerrain(X0 + i * EL, Z1 - j * EL));
    data.push(row);
  }
  const hf = new CANNON.Heightfield(data, { elementSize: EL });
  const b = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
  b.addShape(hf);
  b.position.set(X0, 0, Z1);
  b.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  sahSyncBody(b);
  game.world.addBody(b);
}

// ================================================================ THE CAMP ==
/**
 * A gnawa camp at the foot of the dune. Black goat-hair tents, a fire, and the
 * three instruments the whole music of this chapter is made of: a guembri (a
 * three-string bass lute with a camel-skin face), a tbel, and a pile of iron
 * qraqeb that nobody puts down.
 *
 * This is also the way out of the chapter — every biome gets exactly one, and
 * it is always somewhere obvious that you are going to end up anyway.
 */
/**
 * THE WHOLE CAMP WAS BUILT ON A FLAT DATUM, AND IT IS ON A DUNE.
 *
 * Every piece of it — four tents, three carpets, the fire ring, the guembri,
 * the tbel, the qraqeb and fourteen people — was authored in a local frame and
 * the frame's origin is `sahTerrain(182, 20)`, ONE NUMBER. The camp sits at the
 * foot of the great dune where the hamada has already lifted the ground four
 * metres and the erg's own ridges add another five with a period of about
 * thirty metres, so over the sixteen-metre crescent the real ground moves by
 * more than two metres. Measured off the rendered frame: the eastern tents hang
 * in mid-air with daylight under the eaves, the western ones are buried to the
 * eaves, and the man standing at the north tent is a HEAD AND SHOULDERS
 * sticking out of the sand.
 *
 * The mesh cannot be one flat group any more, so it is not: everything is
 * authored in world coordinates and every object asks `sahTerrain` where it is
 * actually standing. Same class as Kyoto's miller, the Pantanal drover, Rio's
 * bondinho man and this chapter's own maalem — the fourth time, and the first
 * time it has been a whole set piece rather than one person.
 */
function sahBuildCamp(game, root) {
  const M = sahMerger();
  const cx = sahCAMP.x, cz = sahCAMP.z;
  const gy = sahTerrain(cx, cz);
  /** Height of the sand at a point in the camp's LOCAL frame, relative to gy. */
  const dy = (lx, lz) => sahTerrain(cx + lx, cz + lz) - gy;
  // four tents in a crescent, opening onto the fire
  // ---- THE TENTS WERE SHEDS -----------------------------------------------
  // A khaima is woven goat hair thrown over two ridge poles and pegged out
  // wide: it is LOW, it SAGS between the poles, the roof overhangs a long way
  // past the walls, and the whole front is open. Drawn as `M.box(7.0, 3.0,
  // 5.0)` with a flat lid on it, four of them read as a row of garden sheds in
  // the middle of the Erg Chebbi — which is what the instrumented shot of the
  // camp shows.
  // SPREAD, or they are one building. Four tents at 13 m radius over 1.8 rad
  // sit 7.8 m apart centre to centre, and a khaima with its eaves is eight
  // metres across — so the crescent photographed as a single continuous dark
  // canopy. Sixteen metres and a wider step puts eleven between them.
  for (let i = 0; i < 4; i++) {
    const a = -1.05 + i * 0.70;
    const x = Math.cos(a) * 16, z = Math.sin(a) * 16;
    // AND THIS IS THE HEIGHT OF THE SAND WHERE THIS TENT ACTUALLY IS. Every
    // vertical in the block below is offset by it; without it the crescent is
    // four sheds hanging at four different heights over a slope.
    const ty = dy(x, z);
    // two ridge poles, and the ridge between them
    for (let s = -1; s <= 1; s += 2) {
      M.cyl(x + Math.cos(a + 1.57) * 2.4 * s, ty + 1.35, z + Math.sin(a + 1.57) * 2.4 * s,
            0.09, 2.7, PALETTE.sahCedarDk, 0, -a, 0);
    }
    // The roof: three panels, each sagging a little lower than the ridge. It
    // overhangs, but ONLY A LITTLE — the first cut spilled 2.8 m past the walls
    // on each side and 8 m fore and aft, so four tents thirteen metres apart
    // ran into each other and the camp photographed as one continuous dark
    // canopy rather than as four separate dwellings.
    // ---- THE ROOF SAGS, AND THAT IS THE WHOLE DIFFERENCE ------------------
    // A khaima was three flat plates: a lid and two shallow wings, all rigid,
    // all at one height. Rendered on the foot of a dune the crescent is four
    // brown card tables with daylight under them. Goat hair thrown over two
    // poles and pegged out wide does exactly one thing — it SAGS, hard, between
    // every support — and that catenary is the only reason anybody looking at a
    // black tent knows it is cloth. Five panels along the ridge, each dropping
    // toward the middle of its own bay.
    for (let k = -2; k <= 2; k++) {
      const sag = 0.30 - Math.abs(k) * 0.13;
      M.box(x + Math.cos(a + 1.57) * k * 1.28, ty + 2.58 - sag,
            z + Math.sin(a + 1.57) * k * 1.28,
            3.4, 0.11, 1.42, PALETTE.sahTent, 0, -a, 0);
    }
    for (let s = -1; s <= 1; s += 2) {
      for (let k = -2; k <= 2; k++) {
        const sag = 0.26 - Math.abs(k) * 0.11;
        M.box(x + Math.cos(a) * 1.55 * s + Math.cos(a + 1.57) * k * 1.28,
              ty + 2.20 - sag, z - Math.sin(a) * 1.55 * s + Math.sin(a + 1.57) * k * 1.28,
              1.9, 0.11, 1.42, PALETTE.sahTentDk, 0, -a, s * 0.42);
      }
      // the wall under it — LOW, and it now reaches the eaves rather than
      // stopping half a metre short of them, which is where the daylight was
      M.box(x + Math.cos(a) * 2.30 * s, ty + 0.92, z - Math.sin(a) * 2.30 * s,
            0.14, 1.84, 5.2, PALETTE.sahTent, 0, -a, 0);
      // AND A SKIRT OF SAND BANKED AGAINST IT. A khaima is not set on the sand,
      // it is dug into it — and it is also what closes the gap of daylight that
      // a straight-edged wall leaves on ground that is not level.
      M.box(x + Math.cos(a) * 2.40 * s, ty - 0.14, z - Math.sin(a) * 2.40 * s,
            0.86, 0.72, 5.6, PALETTE.sahSandLit, 0, -a, s * 0.22);
    }
    // the back wall; the front is open, because that is the point of a tent
    M.box(x + Math.cos(a + 1.57) * 2.7, ty + 1.05, z + Math.sin(a + 1.57) * 2.7,
          5.4, 2.1, 0.16, PALETTE.sahTentDk, 0, -a, 0);
    // a rug hung over the ridge to dry, because every one of them has one
    if (i % 2 === 0) {
      M.box(x, ty + 2.30, z + 0.9, 2.2, 0.06, 2.6,
            [PALETTE.sahRug1, PALETTE.sahRug2, PALETTE.sahRug3][i % 3], 0, -a, 0);
    }
    // ---- AND SOMEBODY LIVES IN IT -----------------------------------------
    // Four tents, open at the front, and the inside of every one of them was
    // bare sand. A khaima's floor is carpet from wall to wall with the bedding
    // rolled against the back of it and a tea tray in the middle, and that is
    // the entire reason the front is open: you are meant to be able to see in.
    M.box(x + Math.cos(a + 1.57) * 0.9, ty + 0.07, z + Math.sin(a + 1.57) * 0.9,
          4.4, 0.10, 3.6, [PALETTE.sahRug2, PALETTE.sahRug1, PALETTE.sahRug3][i % 3], 0, -a, 0);
    for (let k = -1; k <= 1; k++) {
      M.box(x + Math.cos(a + 1.57) * 2.2 + Math.cos(a) * k * 1.3,
            ty + 0.30, z + Math.sin(a + 1.57) * 2.2 - Math.sin(a) * k * 1.3,
            1.1, 0.44, 0.7, k ? PALETTE.sahCanvas : PALETTE.sahDye4, 0, -a, 0);
    }
    M.cyl(x + Math.cos(a + 1.57) * 0.4, ty + 0.20, z + Math.sin(a + 1.57) * 0.4,
          0.44, 0.10, PALETTE.sahBrass, 0, 0, 0, 8);
    M.cyl(x + Math.cos(a + 1.57) * 0.4, ty + 0.38, z + Math.sin(a + 1.57) * 0.4,
          0.16, 0.28, PALETTE.sahBrassDk, 0, 0, 0, 6);
    // guy ropes and pegs, because a tent that is not tied down is a box
    for (let s = -1; s <= 1; s += 2) {
      for (let k = -1; k <= 1; k += 2) {
        const ox = Math.cos(a) * 4.6 * s + Math.cos(a + 1.57) * 2.6 * k;
        const oz = -Math.sin(a) * 4.6 * s + Math.sin(a + 1.57) * 2.6 * k;
        M.cyl(x + ox * 0.6, ty + 1.35, z + oz * 0.6, 0.035, 3.4, PALETTE.sahRope,
              0.62 * s, -a, 0);
        M.cyl(x + ox, dy(x + ox, z + oz) + 0.16, z + oz, 0.05, 0.34,
              PALETTE.sahCedarDk, 0.3, 0, 0);
      }
    }
    sahStaticBox(game, cx + x, gy + ty + 1.4, cz + z, 5.6, 2.8, 5.4, -a);
  }
  // the fire, and a ring of stones round it
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * 6.283;
    const sx = Math.cos(a) * 2.4, sz = Math.sin(a) * 2.4;
    M.sph(sx, dy(sx, sz) + 0.18, sz, 0.34, 0.28, 0.34, PALETTE.sahOchreDk);
  }
  for (let i = 0; i < 7; i++) {
    M.cyl(rand(-0.7, 0.7), 0.3, rand(-0.7, 0.7), 0.12, 1.6, PALETTE.sahCedarDk,
      rand(0.6, 1.1), rand(0, 6.28), 0);
  }
  // carpets, cushions and the instruments
  for (let i = 0; i < 3; i++) {
    const a = 2.0 + i * 1.1;
    const rx = Math.cos(a) * 4.6, rz = Math.sin(a) * 4.6;
    M.box(rx, dy(rx, rz) + 0.06, rz, 3.4, 0.10, 2.4,
      [PALETTE.sahRug1, PALETTE.sahRug2, PALETTE.sahRug3][i], 0, -a, 0);
    // and cushions on it, because nobody sits on a bare carpet in a desert
    for (let k = -1; k <= 1; k += 2) {
      M.box(rx + Math.cos(a) * k * 1.0, dy(rx, rz) + 0.24, rz + Math.sin(a) * k * 1.0,
            0.9, 0.30, 0.7, [PALETTE.sahDye4, PALETTE.sahDye1][(i + (k > 0 ? 1 : 0)) % 2],
            0, -a, 0);
    }
  }
  // ---- THE INSTRUMENTS. They are in five people's HANDS, not on the sand ----
  // The chapter's last line is "take over the fire circle" and the joke needs
  // somebody to be interrupted — which the pass that added the five gnawa got
  // right, except that it left the guembri, the tbel and the pile of qraqeb
  // lying three metres away on the ground where they had always been. Five
  // people miming at nothing, next to a heap of instruments. The tbel and the
  // qraqeb are placed at the players now (see the loop below) and what is left
  // out here is the spares, which every band has.
  M.cyl(-5.6, dy(-5.6, 4.2) + 0.55, 4.2, 0.55, 0.7, PALETTE.sahTentDk, 0.35, 0.4, 0, 8);
  for (let i = 0; i < 4; i++) {
    const qx = rand(-1, 1) + 1.0, qz = rand(-1, 1) - 3.4;
    M.cyl(qx, dy(qx, qz) + 0.1, qz, 0.24, 0.12, PALETTE.sahBrassDk, 0, 0, 0, 6);
  }
  // and a teapot on the coals, and the glasses, because that is what a fire in
  // the Erg Chebbi is actually for
  M.cyl(1.5, dy(1.5, 1.5) + 0.26, 1.5, 0.26, 0.34, PALETTE.sahBrass, 0, 0, 0, 8);
  M.cone(1.5, dy(1.5, 1.5) + 0.52, 1.5, 0.20, 0.22, PALETTE.sahBrassDk, 0, 0, 0, 6);
  M.cyl(2.2, dy(2.2, 1.9) + 0.20, 1.9, 0.30, 0.06, PALETTE.sahBrassDk, 0, 0, 0, 8);
  for (let i = 0; i < 4; i++) {
    M.cyl(2.2 + Math.cos(i * 1.6) * 0.17, dy(2.2, 1.9) + 0.30, 1.9 + Math.sin(i * 1.6) * 0.17,
          0.07, 0.16, PALETTE.sahTileGreen, 0, 0, 0, 6);
  }

  // ---- AND THE BAND THE TASK IS ABOUT TAKING OVER -------------------------
  // `fire-circle` is the last line of the chapter and the toast reads "nobody
  // asked it to play. nobody is stopping it either." — of a fire circle with
  // three instruments lying on the sand and NOBODY SITTING AT THEM. The whole
  // joke needs somebody to be interrupted.
  //
  // Five gnawa on the carpets, facing the fire, and they play. They are
  // sahPPL_PLAY, so sahUpdatePeople rocks them on the beat and lifts them the
  // moment sahFireTakeover goes up. Seven more round the outside, sitting.
  // ...AND EVERY ONE OF THEM ASKS THE SAND WHERE IT IS. `gy` is the height at
  // the middle of the camp and nowhere else; passing it to fourteen people
  // spread over sixteen metres of dune buried the western half to the neck.
  for (let i = 0; i < 5; i++) {
    const a = 1.7 + i * 0.62;
    const r = 4.0 + (i % 2) * 0.7;
    const px = cx + Math.cos(a) * r, pz = cz + Math.sin(a) * r;
    const py = sahTerrain(px, pz);
    sahAddPerson(px, py, pz, Math.atan2(cx - px, cz - pz), sahPPL_PLAY);
    // AND THE INSTRUMENT IS IN FRONT OF HIM. One per player, in the camp's
    // local frame, facing the fire the way he does.
    const lx = px - cx, lz = pz - cz, ly = py - gy;
    const fa = Math.atan2(cx - px, cz - pz);
    const ix = lx + Math.sin(fa) * 0.62, iz = lz + Math.cos(fa) * 0.62;
    if (i === 2) {
      // the maalem, and the guembri across his knees: a soundbox, a camel-skin
      // face and a neck that goes over his shoulder
      M.box(ix, ly + 0.62, iz, 1.4, 0.44, 0.62, PALETTE.sahCedar, 0.2, fa, 0);
      M.box(ix, ly + 0.80, iz, 1.2, 0.06, 0.52, PALETTE.sahCanvas, 0.2, fa, 0);
      M.cyl(ix - Math.cos(fa) * 1.0, ly + 1.05, iz + Math.sin(fa) * 1.0,
            0.06, 1.9, PALETTE.sahCedarDk, 1.24, fa, 0);
    } else if (i === 0 || i === 4) {
      // a tbel between the knees, tipped toward him
      M.cyl(ix, ly + 0.46, iz, 0.42, 0.72, PALETTE.sahTentDk, 0.34, fa, 0, 8);
      M.cyl(ix + Math.sin(fa) * 0.11, ly + 0.80, iz + Math.cos(fa) * 0.11,
            0.43, 0.06, PALETTE.sahCanvas, 0.34, fa, 0, 8);
    } else {
      // and qraqeb, which are two pairs of iron castanets and nobody puts them
      // down for the whole of a lila
      for (let s2 = -1; s2 <= 1; s2 += 2) {
        M.cyl(ix + Math.cos(fa) * s2 * 0.34, ly + 0.78, iz - Math.sin(fa) * s2 * 0.34,
              0.20, 0.10, PALETTE.sahBrassDk, 1.3, fa, 0, 6);
        M.cyl(ix + Math.cos(fa) * s2 * 0.34, ly + 0.94, iz - Math.sin(fa) * s2 * 0.34,
              0.20, 0.10, PALETTE.sahBrass, 1.3, fa, 0, 6);
      }
    }
  }
  for (let i = 0; i < 7; i++) {
    const a = -1.2 + i * 0.42;
    const r = 5.6 + rand(-0.6, 1.4);
    const px = cx + Math.cos(a) * r, pz = cz + Math.sin(a) * r;
    sahAddPerson(px, sahTerrain(px, pz), pz, Math.atan2(cx - px, cz - pz), sahPPL_SIT);
  }
  // and two standing at the tents, watching whatever is about to happen
  for (let i = 0; i < 2; i++) {
    const a = -0.6 + i * 0.9;
    const px = cx + Math.cos(a) * 10, pz = cz + Math.sin(a) * 10;
    sahAddPerson(px, sahTerrain(px, pz), pz,
                 Math.atan2(-Math.cos(a), -Math.sin(a)), sahPPL_STAND);
  }

  const mesh = new THREE.Mesh(M.build(), sahVC());
  mesh.position.set(cx, gy, cz);
  mesh.castShadow = true; mesh.receiveShadow = true;
  root.add(mesh);

  // ---- the flame itself, and it is the last picture in the chapter ---------
  // It was two cones at 35% opacity in broad daylight: invisible in the shot of
  // the camp, and it is the object the chapter's final task is named after. A
  // fire is three things — a hot core, a ragged tongue and a column of light on
  // everything round it — and only the first of those was drawn.
  const F = sahMerger();
  F.cone(0, 0.34, 0, 0.95, 0.8, PALETTE.sahEmber, 0, 0, 0, 6);
  F.cone(0, 0.80, 0, 0.66, 1.7, PALETTE.sahFire, 0, 0, 0, 6);
  F.cone(0, 1.45, 0, 0.34, 1.5, PALETTE.sahSun, 0, 0.7, 0, 6);
  // and the licks off the side, which are what make it ragged
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * 6.283;
    F.cone(Math.cos(a) * 0.45, 0.62 + (i % 3) * 0.26, Math.sin(a) * 0.45,
           0.22, 0.9 + (i % 2) * 0.5, i % 2 ? PALETTE.sahFire : PALETTE.sahEmber,
           Math.sin(a) * 0.24, a, -Math.cos(a) * 0.24, 4);
  }
  const fm = new THREE.Mesh(F.build(), mat(0x000000, {
    vertexColors: true, emissive: 0xffffff, emissiveIntensity: 1.25,
    fog: false, transparent: true, opacity: 0.95, depthWrite: false,
  }).clone());
  fm.position.set(cx, gy + 0.2, cz);
  fm.castShadow = false;
  fm.userData.noShadow = true;
  fm.renderOrder = 2;
  sahFireGroup = fm;
  root.add(fm);

  // THE POOL IT THROWS. Nothing in this game casts light, so a fire that is not
  // painted onto the sand round it is a lit object rather than a light — the
  // lesson Venice's arcade and the Drift's lamp both had to learn. Six rings of
  // a sixteen-sided cylinder with the brightness written per VERTEX on a
  // squared curve, additive: no step anywhere, and no octagon.
  {
    const P = sahMerger();
    for (let k = 5; k >= 0; k--) {
      const u = (k + 1) / 6;
      const f2 = (1 - u) * (1 - u) * 0.92 + 0.08;
      const g2 = Math.max(0, Math.min(255, Math.round(f2 * 255)));
      P.cyl(0, -k * 0.005, 0, 7.5 * u, 0.02, (g2 << 16) | (g2 << 8) | g2, 0, 0, 0, 16);
    }
    const pm = new THREE.Mesh(P.build(), new THREE.MeshBasicMaterial({
      vertexColors: true, color: PALETTE.sahFire, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    pm.position.set(cx, gy + 0.10, cz);
    pm.renderOrder = 2;
    pm.frustumCulled = false;
    pm.castShadow = false;
    pm.userData.noShadow = true;
    sahFirePool = pm;
    root.add(pm);
  }
}

/** The caravan. Five camels on a fixed route from the gate to the camp, and the
 *  lead one carries a kinematic platform, which is the ride. */
/**
 * A CAMEL WAS THREE BOXES.
 *
 * `BoxGeometry(1.1, 1.5, 3.0)` for the body and two scaled copies of the same
 * box for the neck and the head — and the comment said "at this scale that is a
 * camel", which it is not: the shot of the caravan is five brown crates
 * shuffling across the hamada, and one of them is a task you RIDE. A camel is
 * the most recognisable silhouette in this chapter and it is made of four
 * things — a deep barrel, a hump, a neck that goes UP and then forward on an S,
 * and long legs with a visible knee — none of which a box can do.
 *
 * It is one merged body mesh per animal in a single instanced draw call, plus a
 * second instanced mesh for the legs, which have to swing. Nine hundred
 * triangles for the whole caravan, against three hundred for the crates.
 */
function sahCamelGeo() {
  const M = sahMerger();
  // the barrel — deep, narrow, and tucked up at the flank
  M.box(0, 1.72, 0.05, 0.95, 1.02, 2.45, PALETTE.sahCamel);
  M.box(0, 1.30, -0.85, 0.80, 0.62, 0.95, PALETTE.sahCamelDk);      // the rump
  M.box(0, 1.90, 0.95, 0.86, 0.80, 0.80, PALETTE.sahCamel);         // the chest
  // THE HUMP, which is the whole animal, and it leans back
  M.sph(0, 2.42, -0.12, 0.52, 0.50, 0.72, PALETTE.sahCamelDk);
  M.sph(0, 2.62, -0.20, 0.34, 0.30, 0.44, PALETTE.sahCamel);
  // the neck: up out of the chest on an S, not straight out in front
  M.cyl(0, 2.34, 1.30, 0.28, 1.10, PALETTE.sahCamel, -0.42, 0, 0, 6);
  M.cyl(0, 2.92, 1.62, 0.22, 0.80, PALETTE.sahCamel, 0.30, 0, 0, 6);
  // the head, and the long lower jaw that is the tell at any distance
  M.box(0, 3.24, 1.86, 0.30, 0.34, 0.62, PALETTE.sahCamelDk);
  M.box(0, 3.12, 2.20, 0.24, 0.20, 0.44, PALETTE.sahCamel);
  for (let s = -1; s <= 1; s += 2) {
    M.cone(s * 0.13, 3.48, 1.74, 0.09, 0.20, PALETTE.sahCamelDk, 0, 0, s * 0.3, 4);
  }
  // the tail
  M.cyl(0, 1.44, -1.34, 0.05, 0.72, PALETTE.sahCamelDk, 0.5, 0, 0, 4);
  // the tassels and the blanket, because every camel on that route is dressed
  M.box(0, 2.30, 0.10, 1.02, 0.10, 1.60, PALETTE.sahRug1);
  M.box(0, 2.36, 0.10, 0.70, 0.10, 1.20, PALETTE.sahRug2);
  for (let s = -1; s <= 1; s += 2) {
    M.box(s * 0.52, 2.02, 0.10, 0.08, 0.60, 1.50, PALETTE.sahDye1);
  }
  // the head-collar and the lead rope going forward to a hand
  M.cyl(0, 3.26, 1.98, 0.19, 0.10, PALETTE.sahDye3, 1.4, 0, 0, 6);
  return M.build();
}
function sahCamelLegGeo() {
  const M = sahMerger();
  M.cyl(0, -0.42, 0, 0.13, 0.86, PALETTE.sahCamel, 0, 0, 0, 4);      // upper
  M.cyl(0, -1.10, 0.06, 0.10, 0.62, PALETTE.sahCamelDk, 0.16, 0, 0, 4);  // shank
  M.box(0, -1.44, 0.10, 0.26, 0.14, 0.34, PALETTE.sahCamelDk);       // the pad
  return M.build();
}

function sahBuildCaravan(game, root) {
  const im = new THREE.InstancedMesh(sahCamelGeo(), sahVC(), sahCARAVAN_N);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.castShadow = true;
  im.frustumCulled = false;
  root.add(im);
  sahCamelMesh = im;
  // four legs each, their own mesh because they swing
  const lm = new THREE.InstancedMesh(sahCamelLegGeo(), sahVC(), sahCARAVAN_N * 4);
  lm.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  lm.castShadow = true;
  lm.frustumCulled = false;
  root.add(lm);
  sahCamelLegs = lm;

  // ---- AND SOMEBODY IS LEADING IT ----------------------------------------
  // Five camels on a fixed route with NOBODY WITH THEM. A caravan is a group of
  // people; the animals are the luggage. Three: a cameleer walking at the head
  // with the lead rope, one riding the third, and one at the back keeping the
  // string together. They are the same instanced djellaba everybody else in the
  // chapter is, moved every frame — sahCarPeople holds their indices.
  for (let i = 0; i < 3; i++) {
    sahCarPeople.push(sahPplN);
    sahAddPerson(sahGATE.x + 8, sahTerrain(sahGATE.x + 8, sahGATE.z), sahGATE.z, 0,
                 i === 1 ? sahPPL_SIT : sahPPL_STAND);
  }

  // the platform on the lead camel: a saddle you can actually stand on
  const b = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC,
    material: (game.mats && game.mats.ground) || undefined });
  b.addShape(new CANNON.Box(new CANNON.Vec3(0.9, 0.18, 1.5)));
  b.position.set(sahGATE.x + 8, 2.6, sahGATE.z);
  // A kinematic body with zero velocity FALLS ASLEEP, and a sleeping body is
  // skipped in narrowphase: the floor of the ride silently stops existing.
  b.allowSleep = false;
  sahSyncBody(b);
  game.world.addBody(b);
  sahCaravanBody = b;
  sahCarPX = b.position.x; sahCarPY = b.position.y; sahCarPZ = b.position.z;
}

/** Where the caravan is at parameter t (0 at the gate, 1 at the camp). */
function sahCaravanPoint(t, out) {
  const x = lerp(sahGATE.x + 8, sahCAMP.x - 8, t);
  const z = lerp(sahGATE.z, sahCAMP.z, t) + Math.sin(t * 3.4) * 9;
  out.set(x, sahTerrain(x, z), z);
  return out;
}

function sahUpdateCaravan(game, dt) {
  sahCaravanT += dt * 0.026;
  if (sahCaravanT > 1.18) sahCaravanT = -0.18;
  if (sahCamelMesh) {
    for (let i = 0; i < sahCARAVAN_N; i++) {
      const t = clamp(sahCaravanT - i * 0.045, -0.2, 1.2);
      sahCaravanPoint(clamp(t, 0, 1), sahV3);
      const x = sahV3.x, y = sahV3.y, z = sahV3.z;
      sahCaravanPoint(clamp(t + 0.01, 0, 1), sahSc);
      const yaw = Math.atan2(sahSc.x - x, sahSc.z - z);
      // A CAMEL PACES: both legs on one side go together, which is why a rider
      // rolls side to side instead of bouncing. The body's roll and the legs'
      // swing come off the same phase, so they cannot disagree.
      const ph = sahTime * 2.05 + i * 1.31;
      const bob = Math.abs(Math.sin(ph)) * 0.055;
      const roll = Math.sin(ph) * 0.055;
      sahCamelMesh.setMatrixAt(i, sahXform(x, y + bob, z, 0, yaw, roll, 1, 1, 1));
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      if (sahCamelLegs) {
        for (let L = 0; L < 4; L++) {
          const side = (L & 1) ? 1 : -1;         // which side of the animal
          const fore = (L & 2) ? 1 : -1;         // fore or hind
          // pacing: same side in phase, fore and hind a hair apart
          const sw = Math.sin(ph + (side > 0 ? 0 : Math.PI) + (fore > 0 ? 0.35 : 0)) * 0.42;
          const lx = side * 0.40, lz = fore * 0.86;
          sahCamelLegs.setMatrixAt(i * 4 + L, sahXform(
            x + lx * cy + lz * sy, y + 1.55 + bob, z - lx * sy + lz * cy,
            sw, yaw, roll, 1, 1, 1));
        }
      }
      // the people travelling with it: at the head, on the third animal, and
      // at the tail
      if (i === 0 && sahCarPeople.length === 3) {
        const hx = x + sy * 2.6, hz = z + cy * 2.6;
        sahMovePerson(sahCarPeople[0], hx, sahTerrain(hx, hz), hz, yaw);
      }
      if (i === 2 && sahCarPeople.length === 3) {
        // Riding, so his datum is the blanket and not the sand — and a sitter
        // is drawn 44 cm BELOW the y it is given (sahUpdatePeople), so the
        // saddle height has that added back or he rides inside the animal.
        sahMovePerson(sahCarPeople[1], x, y + 2.84 + bob, z, yaw);
      }
      if (i === sahCARAVAN_N - 1 && sahCarPeople.length === 3) {
        const tx = x - sy * 3.4, tz = z - cy * 3.4;
        sahMovePerson(sahCarPeople[2], tx, sahTerrain(tx, tz), tz, yaw);
      }
    }
    sahCamelMesh.instanceMatrix.needsUpdate = true;
    if (sahCamelLegs) sahCamelLegs.instanceMatrix.needsUpdate = true;
  }

  if (!sahCaravanBody) return;
  sahCaravanPoint(clamp(sahCaravanT, 0, 1), sahV3);
  const nx = sahV3.x, ny = sahV3.y + 2.9, nz = sahV3.z;
  const dx = nx - sahCarPX, dy = ny - sahCarPY, dz = nz - sahCarPZ;
  sahCaravanBody.position.set(nx, ny, nz);
  sahSyncBody(sahCaravanBody);
  // ---- THE VELOCITY IS THE CARRY, AND ZERO WAS THE WHOLE BUG -------------
  //
  // This body used to be moved the way rio.js's cable car is: velocity pinned
  // to zero, position written by hand, and the passenger dragged along by
  // adding the saddle's displacement to `capy.body.position` every frame. It
  // does not work at this speed. MEASURED (qa/rb-car2.js): the animal sits
  // perfectly still on the blanket for as long as the string is standing at
  // the gate, and slides off the back the instant it starts walking — 1.39 m
  // of relative drift in 1.1 s, which is 55% of the camel's own 2.3 m/s, over
  // the tail and on the sand four seconds later. So `caravan` — 'Ride out with
  // the caravan', which wants sahCaravanT past 0.72, some hundred and sixty
  // metres up the track — could not be completed from any starting point.
  //
  // The reason is the one this project has now written down five times: a body
  // whose velocity is zero is SOLID GROUND to capybara.js's contact sweep, so
  // the controller holds the animal's world velocity at zero — which is the
  // exact opposite of what standing on a moving camel means — and the hand
  // carry then fights that solve for whatever is left of the ±0.9 m saddle and
  // loses. The chiva, the bonde, the snowcat and the Drift's wandering islands
  // are all the same object and all four carry a passenger without a single
  // line of hand-carrying, because all four write an HONEST VELOCITY and let
  // the solver do it. Differenced against the PREVIOUS TARGET, never against
  // the body's own position, which is where the last velocity already put it.
  const inv = dt > 1e-5 ? 1 / dt : 60;
  sahCaravanBody.velocity.set(clamp(dx * inv, -12, 12), clamp(dy * inv, -12, 12),
                              clamp(dz * inv, -12, 12));
  // ...and the same number on the declared channel, which is what capybara.js
  // asks for by name and prefers to anything it can sniff off a contact. Seven
  // other chapters answer carryFrame() and this one never did.
  sahCarFrame.x = dx * inv;
  sahCarFrame.z = dz * inv;

  const capy = game.capy;
  sahRiding = false;
  if (capy && capy.position && capy.body) {
    const ox = capy.position.x - nx, oz = capy.position.z - nz;
    const oy = capy.position.y - ny;
    // 1.4, NOT 2.4. The band was two metres and seventy centimetres tall on a
    // blanket the animal stands 52 cm above, and the caravan sets off from the
    // gate — so an animal on top of the gate's own masonry, a metre and eighty
    // clear of the camel, read as ABOARD. That was harmless while `sahRiding`
    // only gated a task line; it is not harmless now that it also publishes a
    // reference frame, because a frame handed to somebody standing on a wall
    // drags them along it. A hop off the saddle still keeps it (capybara.js
    // holds the frame through capyPLAT_AIR on its own).
    if (Math.abs(ox) < 1.4 && Math.abs(oz) < 2.0 && oy > -0.3 && oy < 1.4) {
      sahRiding = true;
      if (!sahCaravanDone && sahCaravanT > 0.72) {
        sahCaravanDone = true;
        sahTask('caravan');
        sahToast('four days to Timbuktu. this one is going about two hundred metres.');
        sahSfx('chime', { volume: 0.9 });
      }
    }
  }
  sahCarPX = nx; sahCarPY = ny; sahCarPZ = nz;
}

// ================================================================ THE DUST ==
/**
 * AIRBORNE SAND, AND IT MUST NOT LOOK LIKE CARDBOARD.
 *
 * The first build used seventy boxes at 42% opacity and up to five and a half
 * metres across, and the instrumented shot of the great dune has a stack of
 * clearly readable brown CUBES hanging over it. Three changes fix it and none
 * of them is a texture: many more particles, each far smaller and far more
 * transparent, and a squashed six-segment sphere rather than a box, because the
 * one thing a low-poly sphere is genuinely good at is having no corners.
 */
function sahBuildDust(root) {
  // FIVE BY THREE, NOT SIX BY FOUR. A grain of airborne sand at 16% opacity is
  // never resolved as a shape at all, and 150 of them at 36 triangles each is
  // 5,400 in a chapter with no headroom: 3,000 buys back the brink.
  const geo = new THREE.SphereGeometry(0.5, 5, 3);
  const im = new THREE.InstancedMesh(geo, mat(PALETTE.sahStorm, {
    transparent: true, opacity: 0.16, depthWrite: false,
  }), sahDUST_N);
  im.frustumCulled = false;
  root.add(im);
  sahDust = im;
  sahDustSync();
}
function sahDustSpawn(x, y, z, vx, scale, life) {
  for (let i = 0; i < sahDUST_N; i++) {
    const o = i * 8;
    if (sahDustData[o + 6] > 0) continue;
    sahDustData[o] = x; sahDustData[o + 1] = y; sahDustData[o + 2] = z;
    sahDustData[o + 3] = vx; sahDustData[o + 4] = rand(-0.4, 1.4); sahDustData[o + 5] = rand(-2, 2);
    sahDustData[o + 6] = life; sahDustData[o + 7] = scale;
    return;
  }
}
function sahDustSync() {
  if (!sahDust) return;
  for (let i = 0; i < sahDUST_N; i++) {
    const o = i * 8;
    const life = sahDustData[o + 6];
    const s = life > 0 ? sahDustData[o + 7] : 0;
    // stretched along the wind, which is what a grain of sand at thirty metres
    // a second actually looks like to an eye that cannot resolve it
    sahDust.setMatrixAt(i, sahXform(sahDustData[o], sahDustData[o + 1], sahDustData[o + 2],
      0, sahDustData[o] * 0.1, 0, s * 3.4, s * 0.8, s * 0.8));
  }
  sahDust.instanceMatrix.needsUpdate = true;
}
function sahUpdateDust(game, dt) {
  for (let i = 0; i < sahDUST_N; i++) {
    const o = i * 8;
    if (sahDustData[o + 6] <= 0) continue;
    sahDustData[o] += sahDustData[o + 3] * dt;
    sahDustData[o + 1] += sahDustData[o + 4] * dt;
    sahDustData[o + 2] += sahDustData[o + 5] * dt;
    sahDustData[o + 6] -= dt;
  }
  // it is spawned AROUND THE PLAYER, not at a fixed emitter: a sandstorm has no
  // source, it is simply the air you are in, and the only honest way to draw
  // that with seventy boxes is to keep them where the camera is
  const capy = game.capy;
  if (sahStorm > 0.05 && capy && capy.position) {
    const p = capy.position;
    const n = Math.round(sahStorm * 14);
    for (let k = 0; k < n; k++) {
      sahDustSpawn(p.x + rand(10, 44), sahTerrain(p.x, p.z) + rand(0.1, 8), p.z + rand(-26, 26),
        -rand(18, 34) * (0.4 + sahStorm), rand(0.5, 1.7), rand(1.2, 2.2));
    }
  }
  // ---- AND YOU CAN SEE IT COMING ------------------------------------------
  // "That brown line on the horizon is not a hill." The toast said so; nothing
  // in the world did. Everything the storm draws is spawned within forty-four
  // metres of the animal, so during the whole seven-second build there was
  // nothing to the east at all and the weather simply switched on around you.
  // A haboob is a WALL, and the wall is the entire reason anybody who has seen
  // one remembers it. Thirty tall slow particles two hundred metres out, from
  // the first frame of the warning — so the line arrives, gets nearer, and
  // then it is on top of you.
  if (sahStormPhase === 1 && capy && capy.position) {
    const p = capy.position;
    if (Math.random() < dt * 26) {
      const t = clamp(sahStormT / sahSTORM_BUILD, 0, 1);
      const far = lerp(210, 60, t);
      sahDustSpawn(p.x + far + rand(-16, 16), sahTerrain(p.x, p.z) + rand(1, 34),
                   p.z + rand(-90, 90), -rand(6, 14), rand(3.5, 9.0), rand(3.0, 5.0));
    }
  }
  sahDustSync();
}

/**
 * THE SMOKE OFF THE BRAZIERS, WHICH THE SQUARE HAS BEEN PROMISED SINCE IT WAS
 * WRITTEN.
 *
 * "a brazier, and the smoke off them is why the square is a photograph" — and
 * there was none: fourteen tin drums with a disc of ember paint in them. Jemaa
 * el-Fnaa at dusk is a wall of white smoke lit from underneath and it is the
 * one thing everybody who has been there remembers.
 *
 * Five puffs per brazier, all in one instanced mesh with no per-frame state at
 * all: the height a puff is at is a pure function of the clock and its index,
 * so it wraps for free, allocates nothing, and cannot drift. It is EMISSIVE and
 * not Lambert for the reason Iceland's steam had to learn — a diffuse surface
 * under a nearly overhead sun comes back near-black on every facet pointing
 * away, and the shot of that is pale hexagons with dark grey ones interleaved.
 */
function sahBuildSmoke(root) {
  const n = (sahBRAZIER.length / 3) * sahSMOKE_PER;
  if (!n) return;
  sahSmokeMat = mat(0x000000, {
    emissive: PALETTE.sahSmokeDust, emissiveIntensity: 0.95,
    transparent: true, opacity: 0.30, depthWrite: false,
  }).clone();
  const im = new THREE.InstancedMesh(sahG.sphLo, sahSmokeMat, n);
  im.frustumCulled = false;
  im.castShadow = false;
  im.userData.noShadow = true;
  im.renderOrder = 1;
  root.add(im);
  sahSmokeMesh = im;
}

function sahUpdateSmoke() {
  if (!sahSmokeMesh) return;
  const nb = sahBRAZIER.length / 3;
  // it leans downwind, and the wind in this chapter blows west; in the storm it
  // is torn flat off the top of the coals
  const drift = -0.55 - sahStorm * 3.2;
  for (let b = 0; b < nb; b++) {
    const bx = sahBRAZIER[b * 3], by = sahBRAZIER[b * 3 + 1], bz = sahBRAZIER[b * 3 + 2];
    for (let k = 0; k < sahSMOKE_PER; k++) {
      const i = b * sahSMOKE_PER + k;
      const seed = (b * 7 + k * 13) % 17;
      const u = ((sahTime * (0.26 + seed * 0.006) + k / sahSMOKE_PER + b * 0.13) % 1);
      const h = u * sahSMOKE_RISE;
      // a puff swells as it cools and thins as it goes; the last third is gone
      // SMALL. The first cut swelled to 1.65 and, at 30 cm of a metre across
      // fourteen braziers, the shot of the square is a scatter of pale discs
      // hanging over it like lens flare. Smoke off a coal brazier is a thin
      // ribbon a metre wide, not a cloud.
      const s = (0.28 + u * 1.00) * clamp(u * 7, 0, 1) * clamp((1 - u) * 2.4, 0, 1);
      sahSmokeMesh.setMatrixAt(i, sahXform(
        bx + drift * h * 0.32 + Math.sin(sahTime * 0.7 + seed) * h * 0.10,
        by + 0.35 + h,
        bz + Math.cos(sahTime * 0.53 + seed * 1.7) * h * 0.13,
        0, seed * 0.4 + sahTime * 0.15, 0, s, s * 0.72, s));
    }
  }
  sahSmokeMesh.instanceMatrix.needsUpdate = true;
  // AND IT IS LIT FROM UNDERNEATH AT DUSK, which is the whole photograph. It
  // also has to thicken in the storm, or the one moment the air is full of
  // something is the one moment the smoke goes missing.
  if (sahSmokeMat) {
    sahSmokeMat.opacity = 0.155 + sahDusk * 0.24 + sahStorm * 0.08;
    sahSmokeMat.emissiveIntensity = 0.62 + sahDusk * 0.75;
  }
}

/**
 * THE HABOOB, AND IT HAS TO BE A WALL.
 *
 * "east. that brown line on the horizon is not a hill." The toast has said so
 * since the chapter was written and the only thing the world did about it was
 * spawn thirty extra dust particles two hundred metres out — which, at 16%
 * opacity and half a metre across, is nothing at all. The seven-second build
 * was the weather quietly switching on around the animal.
 *
 * A haboob is a single unbroken FACE of sand, taller than anything, travelling
 * at you. That is a wall, not a particle system: three nested curved shells,
 * emissive so it holds its value from any angle (Iceland's steam, again),
 * scaled and walked west by sahUpdateStorm. It is the biggest single object in
 * the chapter and it exists for about twelve seconds.
 */
function sahBuildStormWall(root) {
  const W = sahMerger();
  for (let s = 0; s < 3; s++) {
    const R = 150 + s * 26;
    const hgt = 62 - s * 10;
    const col = s === 0 ? PALETTE.sahStormDeep : s === 1 ? PALETTE.sahStorm : PALETTE.sahSmokeDust;
    for (let k = 0; k < 15; k++) {
      const a = (k / 14 - 0.5) * 1.35;
      // the front of a haboob is a row of lobes, not a curtain: each one is a
      // separate roll of air and the boundary between them is what makes it
      // read as something rotating rather than as a painted backdrop
      const lobe = 1 + Math.sin(k * 1.9) * 0.22;
      W.add(sahG.sphLo, sahXform(Math.cos(a) * R * 0.30 + s * 12, hgt * 0.42 * lobe,
            Math.sin(a) * R, 0, 0, 0,
            (26 + s * 8) * 2, hgt * lobe, (16 + s * 6) * 2), col);
    }
    // and the boil at its foot, which is the part that is actually on the ground
    for (let k = 0; k < 11; k++) {
      const a = (k / 10 - 0.5) * 1.4;
      W.add(sahG.sphLo, sahXform(Math.cos(a) * R * 0.30 + s * 12 - 6, 7 + (k % 3) * 4,
            Math.sin(a) * R * 1.02, 0, 0, 0,
            (22 + s * 6) * 2, (9 + (k % 3) * 3) * 2, (14 + s * 4) * 2), PALETTE.sahStormDeep);
    }
  }
  const m = new THREE.Mesh(W.build(), mat(0x000000, {
    emissive: 0xffffff, emissiveIntensity: 0.62, vertexColors: true,
    transparent: true, opacity: 0, depthWrite: false, fog: false,
  }).clone());
  m.frustumCulled = false;
  m.visible = false;
  m.castShadow = false;
  m.userData.noShadow = true;
  m.renderOrder = -1;
  m.name = 'sahStormWall';
  sahStormWall = m;
  root.add(m);
}

/** Where the front is, how solid, and how big — all off the phase clock. */
function sahSyncStormWall(game) {
  if (!sahStormWall) return;
  const p = game.capy && game.capy.position;
  // it exists from the first frame of the warning to the middle of the hold,
  // by which time it is on top of you and the dust IS the storm
  let lead = 0, op = 0;
  if (sahStormPhase === 1) {
    const t = clamp(sahStormT / sahSTORM_BUILD, 0, 1);
    lead = lerp(300, 42, t * t);
    op = clamp(t * 1.5, 0, 1) * 0.85;
  } else if (sahStormPhase === 2 && sahStormT < 5) {
    lead = lerp(42, -120, sahStormT / 5);
    op = clamp(1 - sahStormT / 5, 0, 1) * 0.85;
  } else if (sahStormPhase === 3) {
    // it goes away west, and you watch it go
    lead = lerp(-140, -420, clamp(sahStormT / sahSTORM_FADE, 0, 1));
    op = clamp(1 - sahStormT / sahSTORM_FADE, 0, 1) * 0.55;
  }
  const vis = op > 0.01;
  if (vis !== sahStormWall.visible) sahStormWall.visible = vis;
  if (!vis) return;
  sahStormWall.material.opacity = op;
  const bx = (p ? p.x : sahCAMP.x) + lead;
  sahStormWall.position.set(bx, sahTerrain(clamp(bx, -100, 340), p ? p.z : 0), p ? p.z : 0);
  // it breathes, because a wall of sand is boiling the whole time
  const br = 1 + Math.sin(sahTime * 0.42) * 0.05;
  sahStormWall.scale.set(br, br * (1 + Math.sin(sahTime * 0.31 + 1.2) * 0.06), 1);
  sahStormWall.rotation.y = Math.sin(sahTime * 0.13) * 0.05;
}

function sahBuildStars(root) {
  const M = sahMerger();
  // TETRAHEDRA, NOT SPHERES. A six-by-four sphere is 36 triangles and a star is
  // one to two pixels: two hundred of them were 7,200 triangles that appear the
  // moment the storm passes and the evening comes up — which is to say, the
  // chapter's peak triangle count was 7,200 higher than anything ever measured
  // it at, because every measurement was taken at noon with `sahStars.visible`
  // false. 800 now, and the Drift's sky has always done it this way.
  for (let i = 0; i < sahSTAR_N; i++) {
    const u = rand(0.10, 1), a = rand(0, 6.283);
    const r = Math.sqrt(1 - u * u), R = 320;
    M.add(sahG.tet, sahXform(180 + Math.cos(a) * r * R, u * R * 0.85 + 40,
      Math.sin(a) * r * R, a, a * 1.7, 0,
      rand(1.0, 2.6), rand(1.0, 2.6), rand(1.0, 2.6)), PALETTE.sahStarSky);
  }
  const mesh = new THREE.Mesh(M.build(), mat(0x000000, {
    vertexColors: true, emissive: PALETTE.sahStarSky, fog: false,
    transparent: true, opacity: 0.0, depthWrite: false,
  }));
  mesh.frustumCulled = false;
  mesh.renderOrder = -2;
  mesh.visible = false;
  sahStarMat = mesh.material;
  sahStars = mesh;
  root.add(mesh);
}

// ============================================================== GAMEPLAY ====
// =============================================================== THE STORKS ==
// NOT A TASK. Marrakech has the densest place in the game and the emptiest, one
// straight after the other, and both of them are made entirely of things that
// want something from you: a juice cart, a snake basket, a souk full of people
// chasing you, a caravan, a fire circle. Everything in the chapter has an
// AGENDA.
//
// White storks nest on the Koutoubia, and on every other flat thing in that
// city, and they have done since before it was the Koutoubia. They want nothing
// at all. Five of them: four wheeling the minaret on a thermal that comes off
// eight hundred years of warm stone, and one standing on the parapet clattering
// its bill, which is the only noise a stork can make — they have no voice.
const sahSTORK_N = 5;
const sahSTORK_R0 = 15, sahSTORK_R1 = 27;      // the spread of the gyre
const sahSTORK_LO = 8, sahSTORK_HI = 17;       // and how far above the tower
const sahSTORK_CLAT = 11.0;                    // s between bill-clatters
let sahStorkMesh = null, sahStorkSeed = null;
let sahStorkT = 0, sahStorkClat = 4;

function sahBuildStorks(root) {
  const M = sahMerger();
  // A STORK IN THE AIR IS A CROSS: neck straight out in front (which is what
  // separates it from a heron at any distance), legs straight out behind, and
  // two very long black-tipped wings held dead flat. It barely ever flaps.
  M.box(0, 0, 0, 0.26, 0.24, 0.86, PALETTE.sahStork);
  M.box(0, 0.02, 0.72, 0.14, 0.14, 0.62, PALETTE.sahStork);        // the neck, OUT
  M.box(0, 0.02, 1.10, 0.07, 0.08, 0.34, PALETTE.sahStorkBill);
  M.box(0, -0.04, -0.78, 0.08, 0.08, 0.78, PALETTE.sahStorkBill);  // the legs, BACK
  M.box(0, 0.04, -0.52, 0.30, 0.10, 0.44, PALETTE.sahStorkDark);   // the tail
  for (let s = -1; s <= 1; s += 2) {
    M.box(s * 0.62, 0.02, -0.05, 1.05, 0.05, 0.52, PALETTE.sahStork, 0, 0, s * 0.05);
    M.box(s * 1.42, 0.00, -0.14, 0.62, 0.05, 0.40, PALETTE.sahStorkDark, 0, s * 0.16, s * 0.09);
  }
  sahStorkMesh = new THREE.InstancedMesh(M.build(), sahVC(), sahSTORK_N);
  sahStorkMesh.name = 'sahStorks';
  sahStorkMesh.frustumCulled = false;
  sahStorkMesh.castShadow = false;      // shadows at 50 m over a medina are noise
  sahStorkMesh.userData.noShadow = true;   // ...and this is what makes it stick
  root.add(sahStorkMesh);
  sahStorkSeed = [];
  for (let i = 0; i < sahSTORK_N; i++) {
    sahStorkSeed.push({
      a: (i / sahSTORK_N) * Math.PI * 2,
      r: sahSTORK_R0 + ((i * 7919) % 100) / 100 * (sahSTORK_R1 - sahSTORK_R0),
      y: sahSTORK_LO + ((i * 65537) % 100) / 100 * (sahSTORK_HI - sahSTORK_LO),
      w: 0.055 + ((i * 31337) % 100) / 100 * 0.030,
      b: ((i * 104729) % 628) / 100,
    });
  }
  sahStorkT = 0; sahStorkClat = 4;
}

function sahUpdateStorks(game, dt) {
  if (!sahStorkMesh) return;
  sahStorkT += dt;
  const cx = sahKOUTOUBIA.x, cz = sahKOUTOUBIA.z, h = sahKOUTOUBIA.h;
  for (let i = 0; i < sahSTORK_N; i++) {
    const sd = sahStorkSeed[i];
    if (i === 0) {
      // THE ONE ON THE PARAPET. It stands, and every eleven seconds it throws
      // its head right back and clatters, which is the whole of a stork's
      // vocabulary — they have no syrinx and cannot call at all.
      const clat = clamp(1 - (sahStorkClat / 0.9), 0, 1);
      sahStorkMesh.setMatrixAt(i, sahXform(cx + 4.4, h + 1.05, cz + 0.6,
        -clat * 1.25, 2.3, 0, 1, 1, 1));
      continue;
    }
    // the gyre: a slow circle, rising and falling on its own long period, and
    // banked into the turn because a bird that circles flat is a kite
    const a = sd.a + sahStorkT * sd.w;
    const rr = sd.r * (1 + Math.sin(sahStorkT * 0.09 + sd.b) * 0.12);
    const x = cx + Math.cos(a) * rr;
    const z = cz + Math.sin(a) * rr;
    const y = h + sd.y + Math.sin(sahStorkT * 0.13 + sd.b) * 3.2;
    // tangent of the circle, and the bank that goes with it
    const yaw = Math.atan2(-Math.sin(a), Math.cos(a)) + Math.PI * 0.5;
    const flap = Math.sin(sahStorkT * 0.6 + sd.b * 3) > 0.86
                 ? Math.sin(sahStorkT * 7.0) * 0.34 : 0;
    sahStorkMesh.setMatrixAt(i, sahXform(x, y, z, flap * 0.2, yaw, 0.30 + flap, 1, 1, 1));
  }
  sahStorkMesh.instanceMatrix.needsUpdate = true;

  // ---- the clatter -------------------------------------------------------
  sahStorkClat -= dt;
  if (sahStorkClat <= -0.9) {
    sahStorkClat = sahSTORK_CLAT;
    const cp = game.capy && game.capy.position;
    const far = cp ? Math.hypot(cp.x - cx, cp.z - cz) : 999;
    if (far < 70) {
      // Six ticks in three hundred milliseconds is a bill-clatter. It is not a
      // loop and it does not repeat — the throttle on 'tick' is 0.12 s, which
      // is why they are 60 ms apart in intent and land wherever they land.
      const v = clamp(0.30 - far * 0.0032, 0.05, 0.30);
      sahSfx('tick', { volume: v, pitch: 2.3 });
      sahSfx('tick', { volume: v * 0.9, pitch: 2.1 });
      sahSfx('tick', { volume: v * 0.8, pitch: 2.5 });
    }
  }
}

// ================================================================ THE DATES ==
// NINETY PALMS, AND NOT ONE OF THEM HAS EVER HAD ANYTHING ON IT.
//
// The palmeraie is the softest forty metres in this chapter and the player only
// ever crosses it on the way somewhere: the caravan goes through it eastbound
// and the sandstorm chases you back through it westbound, and in between it is
// scenery with an irrigation channel in it.
//
// So one palm has a crop. It stands on its own by the seguia where the channel
// turns, it is the only trunk in the grove with a ladder of climbing notches cut
// into it, and there are four bunches of dates up under the fronds. Lean on it
// (E) and the lot comes down.
//
// It is deliberately the SIMPLEST kind of task in the game — a thing you press E
// at — because the two either side of it in this chapter are a foot chase and a
// sandstorm, and a list that is all set pieces has no shape.
// IT WAS STANDING IN THE CHANNEL. The seguia runs the length of the palmeraie
// along z = 14 and is 2.4 m wide, and this palm — the one the chapter asks you
// to pick out of ninety, with a collider on it — was at z = 14 exactly: trunk,
// notch ladder, task marker and all, planted in the middle of the only water in
// Marrakech. It stands ON THE BANK now, which is where the comment above always
// said it was.
const sahDATE = { x: 104, z: 17.6 };
const sahDATE_H = 8.2;
let sahDateGroup = null, sahDateBunch = null;
let sahDateDone = false, sahDateT = -1;

function sahBuildDates(game, root) {
  const y = sahTerrain(sahDATE.x, sahDATE.z);
  const M = sahMerger();
  // the trunk, with the notch ladder that says CLIMB ME in every oasis on earth
  M.cyl(sahDATE.x, y + sahDATE_H * 0.5, sahDATE.z, 0.34, sahDATE_H, PALETTE.sahPalmTrunk, 0, 0, 0, 6);
  for (let k = 0; k < 9; k++) {
    const a = k * 1.9;
    M.box(sahDATE.x + Math.cos(a) * 0.36, y + 0.9 + k * 0.78, sahDATE.z + Math.sin(a) * 0.36,
          0.62, 0.16, 0.28, PALETTE.sahPalmDry, 0, -a, 0.2);
  }
  // the crown: more fronds than the instanced ones get, because this is the one
  // palm the player is meant to pick out of ninety
  for (let k = 0; k < 11; k++) {
    const a = k / 11 * 6.283;
    M.box(sahDATE.x + Math.cos(a) * 1.9, y + sahDATE_H - 0.15, sahDATE.z + Math.sin(a) * 1.9,
          4.0, 0.16, 0.62, PALETTE.sahPalm, 0, -a, 0.26 + (k % 3) * 0.08);
  }
  const mesh = new THREE.Mesh(M.build(), sahVC());
  mesh.castShadow = true;
  root.add(mesh);
  sahStaticBox(game, sahDATE.x, y + sahDATE_H * 0.5, sahDATE.z, 0.7, sahDATE_H, 0.7);

  // THE BUNCHES, in their own group so they can come down in one piece. A date
  // bunch is a hanging spray of a couple of thousand fruit and at this palette
  // it is one fat drooping wedge per bunch, in the one orange nothing else here
  // is allowed to be.
  const B = sahMerger();
  for (let b = 0; b < 4; b++) {
    const a = b / 4 * 6.283 + 0.4;
    const bx = Math.cos(a) * 1.15, bz = Math.sin(a) * 1.15;
    B.box(bx * 0.5, 0.22, bz * 0.5, 0.14, 0.5, 0.14, PALETTE.sahPalmDry, 0, -a, 0.5);
    for (let k = 0; k < 3; k++) {
      const t = k / 2;
      B.sph(bx * (0.9 + t * 0.5), -0.28 - t * 0.42, bz * (0.9 + t * 0.5),
            0.46 - t * 0.11, 0.34 - t * 0.08, 0.46 - t * 0.11, PALETTE.sahOrange);
    }
  }
  const bunch = new THREE.Mesh(B.build(), sahVC());
  bunch.castShadow = true;
  sahDateBunch = new THREE.Group();
  sahDateBunch.position.set(sahDATE.x, y + sahDATE_H - 0.9, sahDATE.z);
  sahDateBunch.add(bunch);
  root.add(sahDateBunch);
  sahDateGroup = { y: y };
  sahDateDone = false; sahDateT = -1;
}

function sahUpdateDates(game, dt) {
  if (!sahDateBunch || !sahDateGroup) return;
  const gy = sahDateGroup.y;

  // ---- the fall ----------------------------------------------------------
  if (sahDateT >= 0) {
    sahDateT += dt;
    const y = Math.max(gy + 0.35,
                       gy + sahDATE_H - 0.9 - 0.5 * 9.0 * sahDateT * sahDateT);
    sahDateBunch.position.y = y;
    sahDateBunch.rotation.z = Math.min(1.35, sahDateT * 2.2);
    sahDateBunch.rotation.x = Math.sin(sahDateT * 6) * 0.10 * clamp(1 - sahDateT, 0, 1);
    if (y <= gy + 0.36 && sahDateT < 9) {
      sahDateT = 9;                      // landed; hold it there for good
      sahSfx('thud', { volume: 0.55, pitch: 0.9 });
      sahSfx('rustle', { volume: 0.4, pitch: 0.8 });
      if (typeof game.shake === 'function') game.shake(0.09);
    }
    return;
  }

  if (sahDateDone) return;
  const capy = game.capy;
  const input = game.input;
  if (!capy || !capy.position || !input || !input.actionPressed) return;
  const p = capy.position;
  const dx = p.x - sahDATE.x, dz = p.z - sahDATE.z;
  if (dx * dx + dz * dz > 2.9 * 2.9) return;
  sahDateDone = true;
  sahDateT = 0;
  sahTask('date-palm');
  sahSfx('rustle', { volume: 0.8, pitch: 0.7 });
  sahToast('a hundred and twenty kilos a year off one of these. you took the lot.');
}

function sahTask(id) {
  const g = sahGame;
  if (g && typeof g.completeTask === 'function') g.completeTask(id);
}
function sahToast(t) {
  const g = sahGame;
  if (g && typeof g.toast === 'function') g.toast(t);
}
function sahSfx(n, o) {
  const g = sahGame;
  if (g && typeof g.sfx === 'function') g.sfx(n, o);
}

/**
 * THE STORM.
 *
 * A four-phase state machine on a clock that only runs while the capybara is
 * actually out in the erg, so it can never happen to somebody who is still in
 * the souk and never hear about it. It arrives, it stays, it goes, and it
 * leaves the sun somewhere else — the only time-of-day change inside a chapter
 * in this game, and the reason the last task happens at a fire.
 */
function sahUpdateStorm(game, dt) {
  const capy = game.capy;
  const p = capy && capy.position;
  // ERG_X, NOT ERG_X − 20. The palmeraie runs to x = 152 and the old threshold
  // was 145, so the clock that ends in a sandstorm started UNDER THE PALMS —
  // and the task, which asks you to still be standing in the erg when it
  // passes, could be ticked from inside the grove. The chapter's own zone test
  // (`sahInZone('erg')`) has always said x > sahERG_X; this now agrees with it.
  const out = !!(p && p.x > sahERG_X);

  if (sahStormPhase === 0) {
    if (!out) {
      // ---- AND IT BLEEDS BACK ---------------------------------------------
      // The accumulator only ever went up. Walk out into the erg for twenty
      // seconds, come back to the palmeraie for ten minutes, step past the
      // line again and the storm arrived in TWO — the warning toast and the
      // brown line on the horizon fired on a second visit that had not earned
      // either. `sahStormStood` twenty lines below has bled back at 2 dt since
      // it was written, for exactly this reason; this is that rule applied to
      // the term it should always have been applied to.
      //
      // Half rate on the way down, not equal: the desert does not forget you
      // were out in it as fast as you walked back, and a player who ducks
      // behind the gate for four seconds should not get a clean slate for it.
      if (sahErgT > 0) sahErgT = Math.max(0, sahErgT - dt * 0.5);
    } else {
      sahErgT += dt;
      if (sahErgT > sahSTORM_WARN) {
        sahStormPhase = 1; sahStormT = 0;
        sahToast('east. that brown line on the horizon is not a hill.');
        sahSfx('hiss', { volume: 0.4, pitch: 0.4 });
      }
    }
  } else if (sahStormPhase === 1) {
    sahStormT += dt;
    sahStorm = clamp(sahStormT / sahSTORM_BUILD, 0, 1);
    if (sahStormT > sahSTORM_BUILD) {
      sahStormPhase = 2; sahStormT = 0;
      sahToast('do not go anywhere. it is quicker than you.');
      // M4: the storm front arriving (sahStormPhase 1 -> 2, once).
      if (typeof game.punch === 'function') game.punch(0.3, false);
      else if (typeof game.shake === 'function') game.shake(0.3);
    }
  } else if (sahStormPhase === 2) {
    sahStormT += dt;
    sahStorm = 1;
    if (out && p) {
      sahStormStood += dt;
      if (!sahStormDone && sahStormStood > sahSTORM_TASK) {
        sahStormDone = true;
        sahTask('sandstorm');
        sahToast('still here. still a capybara.');
        sahSfx('cheer', { volume: 0.7 });
      }
    } else sahStormStood = Math.max(0, sahStormStood - dt * 2);
    if (sahStormT > sahSTORM_HOLD) { sahStormPhase = 3; sahStormT = 0; }
  } else if (sahStormPhase === 3) {
    sahStormT += dt;
    sahStorm = clamp(1 - sahStormT / sahSTORM_FADE, 0, 1);
    if (sahStormT > sahSTORM_FADE) {
      sahStorm = 0;
      // The evening arrives with the storm's departure and STAYS. It has to be
      // latched rather than derived from the phase, because the phase is about
      // to be re-armed below and the desert camp — this chapter's only way out
      // — only exists once `dusk() > 0.25`.
      sahDuskOn = true;
      sahToast('and then it is somewhere else, and it is evening.');
      if (sahStormDone) {
        sahStormPhase = 4;
      } else {
        // NOTHING HERE MAY BE MISSABLE FOR EVER. Phase 4 was terminal and
        // nothing — not onEnter, not onExit — ever left it. Only phase 0 is
        // gated on the player being out east, so triggering the warning and
        // then walking back to the palmeraie ran the whole 36 s cycle without
        // you and parked the chapter in phase 4 for the rest of the save:
        // `sandstorm` became uncompletable while its beacon still pointed east
        // and its clue still read "go east and wait. it will find you."
        // It comes round again instead, on exactly the approach rule that
        // brought the first one.
        sahStormPhase = 0; sahStormT = 0; sahErgT = 0; sahStormStood = 0;
      }
    }
  }


  // the evening comes up behind the storm and stays
  sahDusk = damp(sahDusk, (sahDuskOn || sahStormPhase >= 3) ? 1 : 0, 0.32, dt);

  if (sahStars) {
    const vis = sahDusk > 0.06;
    if (vis !== sahStars.visible) sahStars.visible = vis;
    if (vis && sahStarMat) sahStarMat.opacity = clamp((sahDusk - 0.06) * 1.1, 0, 0.9);
  }

  // --- the lean --------------------------------------------------------------
  // THROUGH capy.shove(), and it has to be. Writing body.velocity here — which
  // is what this did — put the push in front of capybara.js's own movement
  // solve, and that solve deletes it: the grip damper is lambda 60 (63% of any
  // injected velocity gone in one frame) and everything left under
  // capyGRIP_SNAP, 0.9 m/s, is then set to exactly zero. This pushes 0.103 m/s
  // per frame at full storm, so it never once cleared the snap and the headline
  // weather mechanic of the chapter moved the animal a measured nothing.
  // shove() is added AFTER the damper and after the snap, and widens the speed
  // cap by its own size, so it is the one channel a lean survives.
  if (sahStorm > 0.15 && capy && typeof capy.shove === 'function' && out) {
    const push = sahWIND_F * sahStorm * dt;
    capy.shove(-push, Math.sin(sahTime * 1.7) * push * 0.4);
  }

}

/** Coming down the great dune, which is a hundred metres of 23 degrees. */
function sahUpdateSurf(game, dt) {
  const capy = game.capy;
  // NOT `|| sahSurfDone`. The tick fires once; the RUN is repeatable, and the
  // firm shoulders and the staked walk-up track exist for no other reason —
  // "every run needs a walk back to the top of it". Returning here after the
  // first descent meant `dune-surf`, a `better: 'higher'` record, could only
  // ever hold the speed of the very first attempt.
  if (!capy || !capy.position) return;

  const p = capy.position;
  const sp = capy.velocity ? Math.hypot(capy.velocity.x, capy.velocity.z) : 0;
  // Attempt-local, like the glacier run: sample only while armed, reset on arm.
  if (sahSurfT >= 0 && sp > sahSurfBest) sahSurfBest = sp;
  // ...and on the paper while the slipface is moving (v32). The run's own best
  // so far, which is the quantity the record holds — see the glacier.
  if (sahSurfT >= 0 && game.recordLive) game.recordLive('dune-surf', sahSurfBest);

  if (sahSurfT < 0) {
    // Arm only on the slip face itself, like the glacier gates on onIce: the
    // firm walk-up track also crosses x > sahSURF_TOP, and running back down
    // it must not count as surfing the dune.
    if (p.x > sahSURF_TOP && sahGroundSlip(p.x, p.z) > 0.3 &&
        p.y > sahTerrain(p.x, p.z) - 2) {
      sahSurfT = 0; sahSurfStall = 0; sahSurfBest = 0;
      sahSurfAir = 0; sahSurfAirBest = 0; sahSurfAirWas = false;
      sahBoom = 0;
      sahToast('down the windward face. do not stop.');
      // ---- DROPPING IN ---------------------------------------------------
      // The `wow` of this chapter is a hundred metres of sand and it started
      // with a line of text. A run needs a moment of COMMITMENT at the top of
      // it: a lip of sand kicked out over the face, a thump, and the camera
      // moving. Sydney's stage, Rio's wave and Iceland's glacier all have one;
      // this had nothing at all between deciding and arriving.
      for (let k = 0; k < 22; k++) {
        sahDustSpawn(p.x + rand(-2.2, 1.0), sahTerrain(p.x, p.z) + rand(0.1, 1.4),
          p.z + rand(-2.4, 2.4), -rand(3, 9), rand(0.35, 0.9), rand(0.6, 1.3));
      }
      sahSfx('rustle', { volume: 0.85, pitch: 0.55 });
      sahSfx('thud', { volume: 0.45, pitch: 0.7 });
      if (typeof game.shake === 'function') game.shake(0.12);
    }
    return;
  }
  sahSurfT += dt;
  // ---- air (W1) -------------------------------------------------------------
  {
    const inAir = !capy.grounded && p.y > sahTerrain(p.x, p.z) + 0.55;
    if (inAir) sahSurfAir += dt;
    else if (sahSurfAirWas && sahSurfAir > 0) {
      if (sahSurfAir > 0.45) {
        if (sahSurfAir > sahSurfAirBest) sahSurfAirBest = sahSurfAir;
        sahToast('air · ' + sahSurfAir.toFixed(1) + ' s');
        for (let k = 0; k < 14; k++) {
          sahDustSpawn(p.x + rand(-1.6, 1.6), sahTerrain(p.x, p.z) + rand(0.1, 0.8),
            p.z + rand(-1.6, 1.6), -rand(2, 6), rand(0.5, 1.3), rand(0.5, 1.0));
        }
        sahSfx('thud', { volume: 0.5, pitch: 0.8 });
        if (typeof game.punch === 'function') game.punch(0.1);
      }
      sahSurfAir = 0;
    }
    sahSurfAirWas = inAir;
  }
  // ...and the run, on the signpost (W1): the speed and the biggest hop.
  if (!sahSurfDone && typeof game.wowLive === 'function') {
    game.wowLive((sahSurfAir > 0.1 ? 'AIR · ' : 'on the face · ') + sp.toFixed(0) + ' m/s' +
                 (sahSurfAirBest > 0.45 ? ' · best hop ' + sahSurfAirBest.toFixed(1) + ' s' : ''),
                 clamp((sahSURF_TOP - p.x) / (sahSURF_TOP - sahSURF_END), 0, 1));
  }
  // ---- AND THE DUNE SINGS -------------------------------------------------
  // Erg Chebbi is one of about thirty places on earth where a slipface BOOMS —
  // a low organ note you feel through your feet, for as long as the sand is
  // moving. It is the single most memorable thing about the real place and it
  // costs one damped number and one looping sound: the note comes up with the
  // speed, so the player hears how fast they are going, which on a hundred
  // metres of featureless sand is the only other instrument besides the spray.
  const boomWant = clamp((sp - 3.0) / 9.0, 0, 1);
  sahBoom = damp(sahBoom, boomWant, 2.4, dt);
  sahBoomT -= dt;
  if (sahBoom > 0.10 && sahBoomT <= 0) {
    // `organ` at the bottom of its range is the only sustained tone in the
    // table, and its throttle is four seconds — which is exactly the case
    // `force` exists for (systems.js). Overlapping voices a second apart is
    // what makes it a drone rather than a series of notes.
    sahBoomT = 1.05;
    sahSfx('organ', { volume: 0.16 + sahBoom * 0.42, pitch: 0.42 + sahBoom * 0.10, force: true });
    sahSfx('hiss', { volume: 0.10 + sahBoom * 0.30, pitch: 0.55 });
  }
  if (sp < sahSURF_STALL_V) {
    sahSurfStall += dt;
    if (sahSurfStall > sahSURF_STALL_T) {
      sahSurfT = -1;
      sahToast('bogged. walk back up and take a straighter line.');
    }
  } else sahSurfStall = 0;

  if (p.x < sahSURF_END) {
    if (!sahSurfDone) { sahSurfDone = true; sahTask('dune-surf'); }
    sahSurfT = -1; sahSurfStall = 0;       // disarm, so the next descent re-arms
    sahBoom = 0;
    if (typeof game.record === 'function') game.record('dune-surf', sahSurfBest);

    sahToast('a hundred metres of sand at ' + sahSurfBest.toFixed(0) + ' metres a second.');
    // 31 sfx sites in this file and NOT ONE passes a position. This is the
    // loudest of them, and the people cheering are the camp at the foot of the
    // dune, which is a place.
    sahSfx('cheer', { volume: 0.85, force: true,
                      at: { x: sahCAMP.x, y: sahTerrain(sahCAMP.x, sahCAMP.z) + 1.4, z: sahCAMP.z } });
    if (typeof game.punch === 'function') game.punch(0.18);
    else if (typeof game.shake === 'function') game.shake(0.18);
    // ---- FRAMED (v26) -----------------------------------------------------
    // The payout frame was empty sand: measured at t 8.03 s the rig sat 8.5 m
    // back and 9.6 m up — a 48-degree downward look at the runout — and the
    // rendered PNG contains no dune, no horizon, no camp and no sky. A hundred
    // metres of descent, and at the bottom of it the chapter shows you the
    // ground you are standing on.
    //
    // West of the animal looking back east up the fall line, low, so the
    // forty-four metre face you have just come down is the whole frame.
    if (typeof game.frameShot === 'function') {
      game.frameShot({ yaw: -Math.PI * 0.5, dist: 16, pitch: 8 * Math.PI / 180,
                       raise: 2.4, hold: 3.5 });
    }
    // ---- AND THE RUN OUT ---------------------------------------------------
    // A hundred metres of sand and it ended on a toast. Whatever speed the
    // animal arrives at goes into the sand: a fan of spray thrown forward and
    // sideways off the foot of the run, sized by how fast it was going, which
    // is also the only thing at the bottom that tells you the run is OVER.
    const n = Math.round(clamp(sahSurfBest * 3.4, 12, 46));
    for (let k = 0; k < n; k++) {
      const spread = rand(-1, 1);
      sahDustSpawn(p.x - rand(0.5, 3.5), sahTerrain(p.x, p.z) + rand(0.1, 1.9),
        p.z + spread * 4.5, -rand(4, 6 + sahSurfBest * 0.7),
        rand(0.35, 1.05), rand(0.8, 1.7));
    }
    sahSfx('rustle', { volume: 0.9, pitch: 0.5 });
    // the camp is at the foot of the dune, and if anybody is close enough to
    // have watched that, they say so
    if (Math.hypot(p.x - sahCAMP.x, p.z - sahCAMP.z) < 60) {
      sahSfx('cheer', { volume: 0.4, pitch: 1.2 });
    }
  }
  // ---- the spray, and it is the only speedometer on a hundred metres of
  // featureless sand. Rationed by speed rather than fired at a fixed rate:
  // at the top it is a trickle and at the bottom it is a rooster tail, which
  // is the whole read on how the run is going.
  if (sp > 4 && Math.random() < dt * clamp(sp * 7, 0, 55)) {
    // BEHIND the animal, not around it: a plume that comes off the board goes
    // backwards and up, and one centred on the rider reads as fog
    const vx = capy.velocity ? capy.velocity.x : 0, vz = capy.velocity ? capy.velocity.z : 0;
    const l = Math.max(0.5, Math.hypot(vx, vz));
    sahDustSpawn(p.x - vx / l * 1.1 + rand(-0.7, 0.7), sahTerrain(p.x, p.z) + 0.30,
      p.z - vz / l * 1.1 + rand(-0.7, 0.7),
      -vx / l * (2 + sp * 0.5), rand(0.25, 0.7), rand(0.4, 1.0));
  }
}

function sahUpdateTasks(game, dt) {
  const capy = game.capy;
  if (!capy || !capy.position) return;
  const p = capy.position;
  const input = game.input;

  // --- the orange cart, which is also the trigger for the whole chase ---------
  const dxc = p.x - sahCART.x, dzc = p.z - sahCART.z;
  if (dxc * dxc + dzc * dzc < 3.2 * 3.2 && input && input.actionPressed) {
    if (!sahCartDone) {
      sahCartDone = true;
      sahTask('orange-cart');
      sahToast('four dirhams. he is not getting them.');
      sahSfx('pop', { volume: 0.95 });
      if (sahCartGroup) sahCartGroup.rotation.z = 0.24;
      sahStartChase(game);
    } else if (sahChase !== 1 && sahRearm <= 0) {
      // it re-arms, so a lost chase is never a dead end
      sahStartChase(game);
    }
  }

  // --- the basket ------------------------------------------------------------
  // IN IT, not near it. The old test was a 2.2 m circle on the ground with no
  // height term and no input, over a sealed drum — see the note in the builder.
  // The basket is open now and the rim is solid, so 'in' means what it says:
  // inside a 98 cm ring and standing on its floor rather than on its edge.
  {
    const dx = p.x - sahSNAKE.x, dz = p.z - sahSNAKE.z;
    const ground = sahTerrain(sahSNAKE.x, sahSNAKE.z);
    const inIt = dx * dx + dz * dz < 0.92 * 0.92 && p.y < ground + 0.85;
    if (inIt) {
      sahBasketSit += dt;
      if (!sahSnakeDone && sahBasketSit > 0.35) {
        sahSnakeDone = true;
        sahTask('snake-basket');
        sahToast('the cobra has gone to look for somewhere quieter.');
        sahSfx('rustle', { volume: 0.8, pitch: 1.4 });
        sahSfx('gasp', { volume: 0.5, pitch: 1.1 });
      }
    } else if (sahBasketSit > 0) {
      sahBasketSit = 0;
    }
    // ---- AND THE COBRA COMES UP TO SEE WHO IT IS ------------------------
    // The cheapest good joke in the chapter: something else lives in there, it
    // is displaced, and it takes it personally. It rises whenever the basket is
    // occupied — every time, not once — and it sways to the flute the rest of
    // the time from just under the rim, so you can see a bit of it moving
    // before you ever decide to get in.
    if (sahCobraGroup) {
      const wantUp = inIt ? 1 : 0;
      sahCobraUp = damp(sahCobraUp, wantUp, inIt ? 4.5 : 2.0, dt);
      const vis = sahCobraUp > 0.02;
      if (sahCobraGroup.visible !== vis) sahCobraGroup.visible = vis;
      if (vis) {
        // BESIDE whatever is in the basket, not through it: at 0.34 m the
        // cobra came up out of the capybara's back.
        sahCobraGroup.position.set(Math.cos(sahTime * 0.9) * 0.66,
                                   -0.86 + sahCobraUp * 1.34,
                                   Math.sin(sahTime * 0.9) * 0.66);
        // it looks at whatever is in its basket
        sahCobraGroup.rotation.y = Math.atan2(p.x - sahSNAKE.x, p.z - sahSNAKE.z) +
                                   Math.sin(sahTime * 1.7) * 0.30;
        sahCobraGroup.rotation.z = Math.sin(sahTime * 2.3) * 0.10 * sahCobraUp;
      }
    }
  }

  // --- the fire circle -------------------------------------------------------
  if (sahFireTakeover > 0) sahFireTakeover -= dt;
  const dxf = p.x - sahCAMP.x, dzf = p.z - sahCAMP.z;
  const atFire = dxf * dxf + dzf * dzf < 6.5 * 6.5;
  if (atFire && input && input.actionPressed && sahFireTakeover <= 0) {
    sahFireTakeover = 9;
    if (!sahFireDone) {
      sahFireDone = true;
      sahTask('fire-circle');
      sahToast('nobody asked it to play. nobody is stopping it either.');
      sahSfx('strum', { volume: 1.0, pitch: 0.5 });
      if (typeof game.shake === 'function') game.shake(0.14);
    } else {
      sahSfx('strum', { volume: 0.8, pitch: 0.5 });
    }
    // ---- AND THE BAND COMES WITH IT ---------------------------------------
    // The five gnawa on the carpets are sahPPL_PLAY and sahUpdatePeople reads
    // sahFireTakeover: for the nine seconds the capybara has the guembri they
    // are on their feet and going twice as hard. This is the last line of the
    // chapter and it used to end on a toast and one sound.
    sahSfx('cheer', { volume: 0.8, pitch: 0.9, force: true });
    if (game.music && typeof game.music.swell === 'function') game.music.swell(0.75);
    // the fire takes it too: a column of sparks off the top, which is the one
    // moment in this chapter that happens after dark
    for (let k = 0; k < 22; k++) {
      sahDustSpawn(sahCAMP.x + rand(-1, 1), sahTerrain(sahCAMP.x, sahCAMP.z) + rand(1, 5),
        sahCAMP.z + rand(-1, 1), rand(-2, 2), rand(0.15, 0.4), rand(0.8, 2.0));
    }
  }

  // the stall lamps come up as the light goes, and they gutter — one shared
  // material, so it is one number a frame for all fourteen
  if (sahStallLamps) {
    sahStallLamps.material.emissiveIntensity =
      0.28 + sahDusk * 1.45 + Math.sin(sahTime * 5.7) * 0.05 * sahDusk;
  }

  // the fire itself, which grows when the capybara is running the band
  const want = 1 + (sahFireTakeover > 0 ? 0.9 : 0) + Math.sin(sahTime * 9.1) * 0.09;
  sahFireLight = damp(sahFireLight, want, 5, dt);
  if (sahFireGroup) {
    sahFireGroup.scale.set(sahFireLight, sahFireLight * (1 + Math.sin(sahTime * 13) * 0.12), sahFireLight);
    sahFireGroup.rotation.y = sahTime * 0.7;
    // IT IS VISIBLE AT NOON TOO. At 0.35 opacity under a nearly-white sky the
    // object the chapter's last task is named after did not appear in the shot
    // of the camp at all. It is dimmer by day than by night, which is true, and
    // it is never transparent enough to disappear.
    sahFireGroup.material.opacity = clamp(0.72 + sahDusk * 0.28, 0, 1);
    sahFireGroup.material.emissiveIntensity = 1.0 + sahDusk * 0.9 +
      (sahFireTakeover > 0 ? 0.7 : 0);
  }
  if (sahFirePool) {
    // the pool on the sand only really exists once the sun has gone, which is
    // exactly when the fire circle happens
    sahFirePool.material.opacity = clamp(sahDusk * 0.55, 0, 1) *
      (0.86 + Math.sin(sahTime * 6.3) * 0.08 + Math.sin(sahTime * 2.1) * 0.06) *
      (sahFireTakeover > 0 ? 1.45 : 1);
    const s = sahFireLight * 0.92;
    sahFirePool.scale.set(s, 1, s);
  }
}

// ==================================================================== API ====
function sahInZone(name, x, z) {
  if (name === 'square') return x > sahSQ_X0 && x < sahSQ_X1 && z > sahSQ_Z0 && z < sahSQ_Z1;
  if (name === 'souk') {
    return x > sahSOUK_X0 - 2 && x < sahSOUK_X0 + sahSOUK_NX * sahSOUK_CELL + 2 &&
           z > sahSOUK_Z0 - 2 && z < sahSOUK_Z0 + sahSOUK_NZ * sahSOUK_CELL + 2;
  }
  if (name === 'medina') return x < 72 && Math.abs(z) < 68;
  if (name === 'palmeraie') return x > 88 && x < 154;
  if (name === 'erg') return x > sahERG_X;
  if (name === 'dune') return x > sahDUNE_X - sahDUNE_W && x < sahDUNE_X + sahDUNE_L;
  if (name === 'camp') {
    const dx = x - sahCAMP.x, dz = z - sahCAMP.z;
    return dx * dx + dz * dz < 8 * 8;
  }
  return false;
}

// =============================================================== LIFECYCLE ===
export function createSahara(game) {
  sahGame = game;

  // ---- THE SHOUT (D1) ----------------------------------------------------
  // THE GATE, as monaco.js and cave.js keep it: registered on the global event
  // and never removed, so it must test the live chapter or a wheek in Iceland
  // opens the radius on a square nobody is standing in.
  game.events.on('capy:wheek', function () {
    if (!game.biome.isActive('sahara')) return;
    sahNotWheek = sahNOT_WHEEK;
  });

  game.biome.register('sahara', {
    ensureBuilt() { sahBuild(game); },
    onEnter() {
      sahChase = 0; sahChaseT = 0; sahLoseT = 0; sahRearm = 0;
      sahSurfT = -1;
      // the caravan is put where the player can see it coming, not wherever it
      // happened to be standing when they left
      sahCaravanT = -0.14;
    },
    onExit() {
      sahChase = 0; sahRiding = false; sahSurfT = -1;
      // ARMED FLAGS DO NOT SURVIVE TRAVEL, and the acrobats' throw was not on
      // the list. Leave Marrakech in the two seconds after being launched off
      // the mat and `sahAcroFlying` stays true with a live `sahAcroTop`; the
      // next visit's first frame resolves it against an apex measured in
      // whatever country you went to. Same class exactly as Iceland's geyser
      // ride and Rio's wave. The tumblers' crouch is the same: it would still
      // be half-way down.
      sahAcroFlying = false; sahAcroTop = 0; sahAcroFly = 0;
      sahAcroWind = -1; sahAcroCool = 0;
      sahCatchT = 0; sahChaseDelay = 0; sahChaseNear = 999;
      // the cobra goes back in its basket, and the basket forgets you were in it
      sahBasketSit = 0; sahCobraUp = 0;
      if (sahCobraGroup) sahCobraGroup.visible = false;
      sahBoom = 0; sahBoomT = 0; sahFireTakeover = 0; sahAcroPuff = 0;
      // ---- AND THE WEATHER DOES NOT TRAVEL WITH YOU ------------------------
      // `sahStorm` is a plain 0..1 that only sahUpdateStorm writes and
      // sahUpdateStorm only runs while this biome is live — so leaving
      // Marrakech in the middle of a sandstorm parks that number at 1.0 for
      // ever. systems.js reads it on the first frame you come BACK
      // (`stormT = inSah && game.sahara ? clamp(game.sahara.storm()...)`), so
      // the chapter reopens with the fog down, the wind leaning on the animal
      // and the band stripped out — in Jemaa el-Fnaa, forty metres from the
      // spawn, with no warning and no brown line on the horizon. The whole
      // point of the phase-0 gate is that the storm is an ERG event.
      //
      // It is parked, not cancelled: `sahStormDone` is untouched, so a ticked
      // task stays ticked, and phase 0 re-arms it on exactly the approach rule
      // that brought the first one (see the end of phase 3, which already does
      // this for the other way of missing it).
      if (sahStormPhase !== 0 && sahStormPhase !== 4) {
        sahStormPhase = 0; sahStormT = 0; sahErgT = 0; sahStormStood = 0;
        sahStorm = 0;
      }
    },
  });

  const api = {
    built() { return sahBuilt; },
    terrainHeight: sahTerrain,
    /**
     * M2, M3 and M4, measured. `told` is how many hand-offs the shout has
     * made this chase, `cover` how many of the souk crowd are registered as
     * cover, `shoved` how many people are being pushed past right now, and
     * `seeing` how many of the six pursuers have a live sight line.
     */
    chaseDebug() {
      let shoved = 0;
      for (let i = 0; i < sahPplN; i++) {
        if (Math.abs(sahPplData[i * sahPPL_STRIDE + 15]) > 0.02) shoved++;
      }
      let seeing = 0;
      for (let i = 0; i < sahPURSUER_N; i++) if (sahPurTellSeen[i]) seeing++;
      return { chase: sahChase, told: sahPurTold, cover: sahSoukPplN,
               tellPairs: sahTellPairs, tellNear: sahTellNear, tellLos: sahTellLos,
               cover0: sahSoukPpl0, shoved: shoved, seeing: seeing,
               ppl: sahPplN, goats: sahGoatN, near: Math.round(sahChaseNear * 10) / 10 };
    },
    /** Start one from a probe, so the chase can be measured without a theft. */
    forceChase() { if (sahChase !== 1) sahStartChase(sahGame); return sahChase; },
    /** Is A's sight line to B clear? The instrument M3 is measured with. */
    losTest(ax, az, bx, bz) { return sahLineOfSight(ax, az, bx, bz); },
    /** Where the souk crowd is, so a probe can stand behind one of them. */
    coverAt(k) {
      const i = sahSoukPpl0 + k;
      if (k < 0 || k >= sahSoukPplN) return null;
      const o = i * sahPPL_STRIDE;
      return { x: sahPplData[o], z: sahPplData[o + 2] };
    },
    /** The storm's own accumulators, so the bleed-back can be measured. */
    stormDebug() {
      return { erg: +sahErgT.toFixed(2), phase: sahStormPhase,
               storm: +sahStorm.toFixed(3), stood: +sahStormStood.toFixed(2),
               warnAt: sahSTORM_WARN };
    },
    slopeAt: sahSlope,
    groundSlip: sahGroundSlip,
    // There is no standing water anywhere in this chapter, which is the point of
    // it. The three names are still published, because every biome publishes
    // them and a missing one is a crash in capybara.js rather than a dry country.
    waterLevel: -400,
    isOverWater() { return false; },
    waterHeightAt() { return -400; },
    inZone: sahInZone,
    navBlocked: sahNavBlocked,
    /** The lead camel's blanket, for anything standing on it. See sahUpdateCaravan. */
    carryFrame() { return sahRiding ? sahCarFrame : null; },
    // The lens may not climb out through the souk's roof. See sahCamCeil —
    // this is camFloor's mirror and systems.js asks for it by name.
    camCeil: sahCamCeil,
    SPAWN: sahSPAWN,
    // the acrobats of Amizmiz, and the mat they throw you off
    acrobats: sahACRO,
    acrobatMat() { return sahAcroPos; },
    acrobatTop() { return sahAcroTop; },
    acrobatFlying() { return sahAcroFlying; },

    // landmarks, for the task beacons
    cart: sahCART,
    basket: sahSNAKE,
    gate: sahGATE,
    koutoubia: sahKOUTOUBIA,
    /** The one palm in the grove with a crop on it. */
    datePalm: sahDATE,
    camp: sahCAMP,
    duneTop: { x: sahDUNE_X - 4, z: sahDUNE_Z },
    /** The souk's centre, which is where 'lose them' actually means. */
    souk: { x: sahSOUK_X0 + sahSOUK_NX * sahSOUK_CELL * 0.5,
            z: sahSOUK_Z0 + sahSOUK_NZ * sahSOUK_CELL * 0.5 },
    /** The caravan MOVES, so ask; never cache. */
    caravan() { sahCaravanPoint(clamp(sahCaravanT, 0, 1), sahV3); return sahV3; },

    /** 0..1 — read by systems.js for the fog, the light and the band. */
    storm() { return sahStorm; },
    dusk() { return sahDusk; },
    chasing() { return sahChase === 1 && sahChaseDelay <= 0; },
    chaseTime() { return sahChaseT; },
    /** How close the nearest trader is right now, in metres. */
    chaseNear() { return sahChaseNear; },
    /** How close the nearest trader is, for the HUD line. */
    pursuers: sahPURSUER_N,
    riding() { return sahRiding; },
    surfing() { return sahSurfT >= 0; },
    /** true while the capybara is running the band, which the score answers. */
    onFire() { return sahFireTakeover > 0; },

    update(dt) {
      if (sahCartMover) sahCartMover.step(dt);
      if (!sahBuilt) return;
      if (!game.biome.isActive('sahara')) return;
      // ---- JEMAA EL-FNAA MAKES A NOISE (M13) --------------------------
      // The `crowd` recipe's own comment names this square as the thing it
      // was written for, and it was never wired here: the loudest place in
      // the game had four hundred one-shots and no floor under them.
      //
      // Clamped INTO the rectangle rather than pinned at its centre, because
      // a square is an area and the nearest point of it is what you walk
      // toward. Standing in the middle it is all round you; from the souk it
      // is a direction, which is the whole point of a bed.
      if (!sahSquareBed && game.sfxMover) {
        sahSquareBed = game.sfxMover('crowd', { key: 'sah:square', near: 26, far: 190 });
      }
      if (sahSquareBed && game.capy && game.capy.position) {
        const sp = game.capy.position;
        sahSquareBed.at(clamp(sp.x, sahSQ_X0, sahSQ_X1), 1.4,
                        clamp(sp.z, sahSQ_Z0, sahSQ_Z1));
        sahSquareBed.set(0.68);
      }
      sahTime += dt;

      sahUpdateChase(game, dt);
      // BEFORE sahUpdatePeople, not after: the caravan's three cameleers are
      // members of the crowd's instanced mesh and it is sahUpdatePeople that
      // composes their matrices from the data the caravan has just written.
      sahUpdateCaravan(game, dt);
      sahUpdatePeople(dt);
      sahUpdateStorm(game, dt);
      sahSyncStormWall(game);
      sahUpdateAcrobats(game, dt);
      sahUpdateSurf(game, dt);
      sahUpdateDust(game, dt);
      sahUpdateSmoke();
      sahUpdateStorks(game, dt);
      sahUpdateGoats(dt);
      sahUpdateDates(game, dt);
      sahUpdateTasks(game, dt);

      // the roofs of the souk sway, which is the only thing in the medina that
      // moves on its own and is worth the one line it costs
      if (sahSoukRoofs) sahSoukRoofs.position.y = Math.sin(sahTime * 0.8) * 0.05;
    },
  };
  game.sahara = api;
  return api;
}

function sahBuild(game) {
  if (sahBuilt) return;
  sahBuilt = true;
  sahInitGeos();

  sahRoot = new THREE.Group();
  sahRoot.name = 'sahara';
  game.scene.add(sahRoot);

  sahRoot.add(sahBuildGround());
  sahBuildGroundBody(game);
  // The cast is built FIRST and filled in by everything after it — the square,
  // the souk and the camp all call sahAddPerson, and the two instanced meshes
  // have to exist before any of them does.
  sahBuildPeople(sahRoot);
  sahBuildSquare(game, sahRoot);
  sahBuildAcrobats(game, sahRoot);
  sahBuildSouk(game, sahRoot);
  sahBuildKoutoubia(game, sahRoot);
  sahBuildStorks(sahRoot);
  sahBuildProps(game, sahRoot);
  sahBuildPursuers(sahRoot);
  sahBuildPalmeraie(game, sahRoot);
  sahBuildDates(game, sahRoot);
  sahBuildErg(sahRoot);
  sahBuildVariety(game, sahRoot);
  sahBuildSeguia(game, sahRoot);
  // M5: the palmeraie has animals in it now. AFTER the seguia, because the
  // pens sit inside the plots it walls.
  sahBuildGoats(game, sahRoot);
  sahBuildKsar(game, sahRoot);
  sahBuildKhettara(game, sahRoot);
  sahBuildTowers(game, sahRoot);
  sahBuildTrades(game, sahRoot);
  sahBuildDuneTrack(sahRoot);
  sahBuildCamp(game, sahRoot);
  sahBuildCaravan(game, sahRoot);
  sahBuildDust(sahRoot);
  // AFTER the square, which is where the braziers are registered.
  sahBuildSmoke(sahRoot);
  sahBuildStormWall(sahRoot);
  sahBuildStars(sahRoot);
  sahBuildHandcart(game, sahRoot);
  // LAST, because sahAddPerson is called from a dozen builders above and the
  // roster is not complete until every one of them has run.
  sahBuildPeopleBodies(game);

  // ---- THE PEOPLE WHO LIVE HERE ------------------------------------------
  // See npc.js, THE LOCALS. Each of these is a point somebody is standing at,
  // a few things they might say when the capybara turns up, and a different
  // few for when it wheeks at them.
  //
  // ---- THREE OF THEM WERE STANDING INSIDE THEIR OWN FURNITURE (v21) ------
  // Measured with a body-overlap audit rather than by eye, which is the only
  // way this class is ever found: `addLocal` gives every person a 0.52 x 1.70 x
  // 0.48 collider at their feet, and
  //
  //   * the juice seller was authored at sahCART — the exact centre of a 3.2 x
  //     1.24 x 1.8 solid cart. Invisible from every angle, his collider inside
  //     its collider. This is the fourth instance of the class (Rio's kiosk
  //     vendor, Iceland's harbourmaster, the pylsa man) and it keeps happening
  //     for the same reason: the landmark constant is the thing you want the
  //     BEACON to point at, and it is never a place a person can stand.
  //   * the snake charmer was authored at sahSNAKE — which, now that the basket
  //     is a basket you can get into rather than a sealed drum, is the middle
  //     of the task. A capybara hopping in landed on a man.
  //   * the dyer was authored at (sahSOUK_X0 + 3.5·CELL, sahSOUK_Z0 + 1.2·CELL),
  //     and 3.5 cells is exactly a BLOCK CENTRE: he was in the shop wall, half
  //     in the alley and half in the masonry.
  //
  // Every one of them is placed off its landmark now, facing it.
  //
  // ---- AND THEY KNOW WHAT YOU HAVE DONE ----------------------------------
  // Ten people, thirty sentences, and none of them changed from the first
  // second of the chapter to the last: the man whose cart you had just emptied
  // was still inviting you to look, for free. See localResolve in npc.js —
  // `before`/`after` a task id, `when` for anything else, `onTask` for the
  // moment itself. Chapters 4, 5 and 6 have had this since their passes and
  // this one never got it.
  if (typeof game.addLocal === 'function') {
    const storming = function () { return sahStorm > 0.35; };
    const chased = function () { return sahChase === 1 && sahChaseDelay <= 0; };
    // BESIDE THE CART, NOT IN IT. See the note above.
    sahLocCart = game.addLocal({ biome: 'sahara', x: sahCART.x - 2.4, y: 0, z: sahCART.z + 0.5,
      near: 7, face: 1.78,
      figure: { shirt: PALETTE.cloth8, skin: PALETTE.skin3 },
      lines: [{ t: 'Four dirham! Fresh! Squeezed while you watch!', before: 'orange-cart' },
              { t: 'My friend. My friend. Only look. Looking is free.', before: 'orange-cart' },
              'Same price for everyone. Almost everyone.',
              { t: 'You did not even pretend to reach for a pocket.', after: 'orange-cart' },
              { t: 'Four dirham. FOUR. It is written on the cart.', after: 'orange-cart' },
              { t: 'They are still out looking for you. I told them where you went.',
                after: 'souk-escape' },
              { t: 'Run. Do not stand there telling me about it. RUN.', when: chased },
              { t: 'Nothing is fresh in this. Come back when it has blown through.',
                when: storming }],
      wheek: ['Ha! A voice like that belongs in the square.',
              'Take the orange. Take it. Go on.',
              { t: 'Do not shout at me. You have had quite enough from me.', after: 'orange-cart' }],
      onTask: { 'orange-cart': ['THAT IS MY CART.',
                                'Ya latif. Ya LATIF.'],
                'souk-escape': ['Six of them. Six grown men.'],
                'acrobats': ['Sixty dirham to be thrown in the air. He does it for nothing.'] },
      praise: ['I am not paying for whatever that was either.'] });
    // BESIDE THE BASKET, NOT IN IT — and where the drawn figure has always
    // stood, which is 1.9 m west of it. The old record put an invisible person
    // and a solid box in the middle of the thing the task asks you to sit in.
    // ---- ...AND THE SAME PERSON, TWO CHAPTERS LATER (P6) ---------------
    // See THE TRAVELLER in npc.js. Two chapters and half a world on, and
    // they are the first person in the game to notice that you are also
    // somewhere you were not before.
    if (typeof game.addTraveller === 'function') {
      game.addTraveller({ biome: 'sahara', x: sahSNAKE.x + 3.6, y: 0, z: sahSNAKE.z - 2.2,
        face: 2.4,
        lines: ['Hold on. I know you. Sydney. The gardens.',
                'You are a long way from those gardens.',
                'How are you getting about? Genuinely. How.',
                { t: 'I have been on four buses. You have been on none.', after: 'to-sahara' }],
        wheek: ['Yes. That is the noise. That is definitely the noise.'] });
    }
    sahLocSnake = game.addLocal({ biome: 'sahara', x: sahSNAKE.x - 1.9, y: 0, z: sahSNAKE.z + 0.4,
      near: 6, face: 1.78,
      figure: { shirt: PALETTE.cloth7, skin: PALETTE.skin3 },
      lines: [{ t: 'Do not sit in the basket. Everyone sits in the basket.', before: 'snake-basket' },
              { t: 'The lid is off. That is not an invitation.', before: 'snake-basket' },
              'He is not deaf. He simply has no ears.',
              'The pipe is for me, not for him. He cannot hear a note of it.',
              { t: 'He has been in a very bad mood since you did that.', after: 'snake-basket' },
              { t: 'Forty years that basket. Nobody has ever fitted.', after: 'snake-basket' },
              { t: 'He is out. He is always out when you are in.',
                when: function () { return sahCobraUp > 0.5; } },
              { t: 'Get out of my basket and go and get out of THEIRS.', when: chased }],
      wheek: ['Now THAT he felt. Through the ground.',
              { t: 'Two of you in there and both of you shouting.',
                when: function () { return sahCobraUp > 0.5; } }],
      onTask: { 'snake-basket': ['OUT. Out of the — he LIVES in there.',
                                 'You have taken a cobra’s house. In front of everybody.'],
                'orange-cart': ['I saw nothing. I am a busy man.'] },
      praise: ['Mm. The snake is unimpressed. So am I.'] });
    // BESIDE THE MAT, NOT ON IT. sahOnMat is a 1.6 m circle round sahACRO and
    // his collider was in the middle of it: the mini of this chapter asked the
    // player to stand exactly where a solid person was standing.
    sahLocAcro = game.addLocal({ biome: 'sahara', x: sahACRO.x - 2.3, y: 0, z: sahACRO.z - 1.4,
      near: 7, face: 2.1,
      figure: { shirt: PALETTE.cloth1, skin: PALETTE.skin3, legs: PALETTE.cloth6 },
      lines: [{ t: 'Hands here, feet there, and trust us. Mostly trust us.', before: 'acrobats' },
              { t: 'On the mat. ON the mat. We are not chasing you round the square.',
                before: 'acrobats' },
              'We have thrown heavier. Not much heavier.',
              'Ready? Nobody is ever ready.',
              { t: 'Again? We can go again. We can always go again.', after: 'acrobats' },
              { t: 'Straight up and straight down. Textbook. Unnerving, but textbook.',
                after: 'acrobats' },
              { t: 'Not while it is blowing. We would lose you over the wall.',
                when: storming }],
      wheek: ['Yalla! He is ready!',
              'That is the count. That is exactly the count.'],
      onTask: { 'acrobats': ['TEN METRES. Did anybody get that? Did ANYBODY get that?',
                             'We are putting that in the show. That is the show now.'],
                'orange-cart': ['We saw. We are saying nothing, we are performers.'] },
      praise: ['Amizmiz! We are from Amizmiz! Tell people!'] });
    // FOUR MORE. Three people in the busiest square in Africa is a census, not
    // a chapter — and two of the four places the chapter actually stops you
    // (the storytellers' ring and the fire at the camp) had nobody to talk to
    // at all. One at a halqa, one dyer in the souk, the guerrab everybody
    // photographs and does not buy from, and the maalem at the fire.
    sahLocHalqa = game.addLocal({ biome: 'sahara', x: -14, y: 0, z: 12.6, near: 8,
      figure: { shirt: PALETTE.sahCanvas, skin: PALETTE.skin4, hat: PALETTE.sahOchreDk },
      lines: ['Sit down. It is a long one and it is not free.',
              'Same story since my grandfather. He got it wrong too.',
              'You have come in at the part where everybody dies.',
              { t: 'There is a story about a rodent that emptied a juice cart. It is new.',
                after: 'orange-cart' },
              { t: 'And then it went into the souk, and then — well. You know how it ends.',
                after: 'souk-escape' },
              { t: 'Tonight I am doing the one about the dune that sings. Come back for it.',
                before: 'dune-surf' },
              { t: 'The dune sang for you. It does not do that for everybody.',
                after: 'dune-surf' },
              { t: 'Nobody listens to a story in this. Come back after.', when: storming }],
      wheek: ['Do not interrupt the halqa.',
              'Right. YOU tell it, then.'],
      onTask: { 'souk-escape': ['Six of them! Round the dyers and out by the gate!'],
                'acrobats': ['I shall need a word for the noise it made.'],
                'snake-basket': ['I am writing this down. I am actually writing this down.'] },
      praise: ['Everything is material. Even that.'] });
    // IN THE ALLEY, NOT IN THE WALL. 3.5 cells from the origin is a block
    // CENTRE and 1.2 cells is the block's own face — see the note above.
    sahLocDyer = game.addLocal({ biome: 'sahara', x: sahSOUK_X0 + 3.5 * sahSOUK_CELL,
      y: 0, z: sahSOUK_Z0 + 1.0 * sahSOUK_CELL, near: 7, face: 0,
      figure: { shirt: PALETTE.sahDye2, skin: PALETTE.skin3 },
      // lifting a hank out of the vat
      beat: { kind: 'work', every: 4.4, dur: 0.9, sfx: 'thud', volume: 0.09, pitch: 0.7 },
      lines: ['Saffron, indigo, cochineal. And one of them is beetroot.',
              'Do not touch. It takes a week to come off.',
              'You would look very good in blue. Everyone does.',
              { t: 'If you are being followed, go left, then left, then straight. Do not run at a wall.',
                when: chased },
              { t: 'They came through here shouting. I sent them the other way.',
                after: 'souk-escape' },
              { t: 'Four alleys and a roof over all of them. Nobody finds anybody in here.',
                before: 'souk-escape' }],
      wheek: ['In here? That will come back to you three times.',
              { t: 'Quiet! They are two alleys away and they can hear you.', when: chased }],
      onTask: { 'souk-escape': ['This is the best souk in Morocco for exactly that reason.'] },
      praise: ['Whatever colour that was, it was not one of mine.'] });
    sahLocWater = game.addLocal({ biome: 'sahara', x: 16, y: 0, z: -4, near: 7,
      // D2: a guerrab has no pitch. Walking the square is the whole trade, and
      // this is the flattest ground in the chapter.
      walk: { dx: -9, dz: 5.5, dwell: 3.5 },
      figure: { shirt: PALETTE.sahDye1, skin: PALETTE.skin3, hat: PALETTE.sahDye1 },
      lines: ['Water! Cold water! Photograph is five dirham, water is free.',
              'Everybody wants the hat. Nobody wants the water.',
              'The bell is brass. The cups are brass. The water is water.',
              { t: 'You have been out east. I can see the sand on you.', after: 'dune-surf' },
              { t: 'Take some before you go through the gate. There is nothing out there.',
                before: 'caravan' },
              { t: 'Now everybody wants the water. Now. Of course.', when: storming }],
      wheek: ['THAT is a bell. Mine is only a bell.'],
      onTask: { 'orange-cart': ['He charges four dirham for that. FOUR.'],
                'caravan': ['Four days to the wells. Take the water. Take the WATER.'] },
      praise: ['Five dirham for a photograph of that. Anybody?'] });
    // sahTerrain, NOT ZERO. Everything west of the palmeraie is at y = 0 and
    // the three locals that were already here could get away with the literal;
    // the camp is at x = 182, where the hamada has lifted the ground four
    // metres, so a maalem anchored at zero is a maalem buried to the shoulders.
    sahLocMaalem = game.addLocal({ biome: 'sahara', x: sahCAMP.x - 4.6,
      y: sahTerrain(sahCAMP.x - 4.6, sahCAMP.z + 3.2), z: sahCAMP.z + 3.2, near: 9,
      figure: { shirt: PALETTE.sahTileWhite, skin: PALETTE.skin4, legs: PALETTE.sahTent },
      // three strings, and it has never needed a fourth
      beat: { kind: 'work', every: 3.8, dur: 0.85, sfx: 'strum', volume: 0.12, pitch: 0.9 },
      lines: ['Three strings. That is all it has ever needed.',
              'We play until it is finished. It is never finished.',
              'Sit by the fire. Everything east of here is colder than it looks.',
              { t: 'Wait for it to pass. Nothing here is going anywhere.', when: storming },
              { t: 'You came down the big one. We heard it from here.', after: 'dune-surf' },
              { t: 'Take the low end. I will take the high end. Nobody will notice.',
                before: 'fire-circle' },
              { t: 'You can have it again whenever you like. It is not my guembri either.',
                after: 'fire-circle' }],
      wheek: ['Ha! Put that on the two and you are in the band.',
              { t: 'On the TWO. Not on the one. Never on the one.', after: 'fire-circle' }],
      onTask: { 'fire-circle': ['Somebody give it the qraqeb. Give it the QRAQEB.',
                                'Three strings and a rodent. That is the whole tradition, that.'],
                'dune-surf': ['A hundred metres of sand and it is still standing up.'],
                'sandstorm': ['You stood in it. Nobody stands in it.'] },
      praise: ['Put it in the second half. Everything goes in the second half.'] });
    // ---- AND THREE MORE, BECAUSE THE HALF OF THE CHAPTER EAST OF THE GATE
    // HAD ONE PERSON IN IT. Marrakech's cast was seven locals and every one of
    // them stood inside a forty-metre circle round the spawn, except the maalem
    // — so the gate, the caravan, the palmeraie and the entire erg, which is
    // half the chapter's playing time and where the `wow` is, had nobody to
    // talk to at all.
    sahLocGate = game.addLocal({ biome: 'sahara', x: 74, y: 0, z: sahGATE.z - 7.4, near: 8,
      figure: { shirt: PALETTE.sahOchreDust, skin: PALETTE.skin4, hat: PALETTE.sahTileWhite },
      lines: [{ t: 'They go out at four. They come back when they come back.', before: 'caravan' },
              'Four days to Timbuktu, my grandfather said. He never went.',
              // THE SADDLE IS ON THE LEAD CAMEL. This line used to say 'ride the
              // third', which is a good joke and was flatly wrong: sahBuildCaravan
              // puts the one kinematic platform in the chapter on the FIRST animal,
              // and the task card says so. A local may be rude about a task; a local
              // may not send the player to the wrong animal.
              { t: 'The saddle is on the lead one. It bites. That is the deal.', before: 'caravan' },
              { t: 'You got up on the lead one. It bit you and you stayed. Good.', after: 'caravan' },
              { t: 'There is a brown line on the horizon. Get behind something.',
                when: function () { return sahStorm > 0.05 && sahStorm < 0.5; } },
              { t: 'Do not go out in this. Do not — well. Off he goes.', when: storming },
              { t: 'Nothing out there but the dune, and the dune is worth it.',
                before: 'dune-surf' }],
      wheek: ['Do not do that near the camels. Do it near the camels.'],
      onTask: { 'caravan': ['Forty years of tourists and not one of them got on the THIRD one.'],
                'dune-surf': ['From here it looked like the dune was coming apart.'] },
      praise: ['The camels saw. The camels forget nothing.'] });
    // by the seguia, where the one palm with a crop on it stands
    sahLocPalm = game.addLocal({ biome: 'sahara', x: sahDATE.x - 3.4, y: 0, z: sahDATE.z + 2.8, near: 8,
      figure: { shirt: PALETTE.sahMint, skin: PALETTE.skin3, legs: PALETTE.sahCanvas },
      lines: ['Water comes down that channel from the mountains. It has done for eight hundred years.',
              'A hundred and twenty kilos a year off one tree. And it asks for nothing.',
              { t: 'You want the tall one with the notches. Everybody wants the tall one.',
                before: 'date-palm' },
              { t: 'Ninety trees out here and you found the one. Somebody told you.',
                after: 'date-palm' },
              { t: 'There are dates all over my channel now. Thank you for that.',
                after: 'date-palm' },
              { t: 'Get under a tree. It will be over in a few minutes.', when: storming }],
      wheek: ['The whole grove heard that. So did the dates.'],
      onTask: { 'date-palm': ['ALL of them. It brought down ALL of them.',
                              'Eight hundred years of irrigation and a rodent shakes the tree.'] },
      praise: ['Do that in the channel and we will have words.'] });
    // AT THE TOP OF THE WALK-UP TRACK, which is the last thing you pass before
    // committing to the chapter's marquee.
    {
      const tz = sahDUNE_Z + sahDUNE_HZ * Math.sqrt(1 - sahSURF_BAND) * 1.06;
      sahLocDune = game.addLocal({ biome: 'sahara', x: sahDUNE_X - 10, z: tz + 1.8, near: 10,
        y: sahTerrain(sahDUNE_X - 10, tz + 1.8),
        figure: { shirt: PALETTE.sahDye3, skin: PALETTE.skin4, hat: PALETTE.sahCanvas },
        lines: [{ t: 'Straight down the middle. The sides are where it holds you.',
                  before: 'dune-surf' },
                'It makes a noise. Everybody thinks it is them. It is the dune.',
                { t: 'Walk up on the hard track, go down anywhere you like.', before: 'dune-surf' },
                { t: 'Nobody has ever done it once.', after: 'dune-surf' },
                { t: 'Faster than that. It will go faster than that.', after: 'dune-surf' },
                { t: 'Hear it? That is you. That is the sand under you.',
                  when: function () { return sahSurfT >= 0; } },
                { t: 'Not now. Get off the top of it and get down.', when: storming }],
        wheek: ['Save it. You will want it on the way down.',
                { t: 'The dune is louder. The dune is always louder.',
                  when: function () { return sahSurfT >= 0; } }],
        onTask: { 'dune-surf': ['A HUNDRED METRES. And it sang the whole way.',
                                'I have watched four thousand people do that. Not like that.'],
                  'sandstorm': ['You stayed out in it. On the top. On purpose.'] },
        praise: ['The dune does not care. I care a bit.'] });
    }

    // ---- AND FOUR CONVERSATIONS THAT ARE NOT WITH YOU --------------------
    // See addExchange in npc.js. Every voice in the busiest square in Africa
    // was addressed to the capybara, so a square with three pitches inside
    // twenty metres of each other was SILENT unless the player walked up and
    // stood in front of somebody. Jemaa el-Fnaa is a place made entirely of
    // people talking to each other over your head; this is the only mechanism
    // in the game that can say so.
    if (typeof game.addExchange === 'function') {
      if (sahLocCart && sahLocWater) {
        game.addExchange({ biome: 'sahara', a: sahLocCart, b: sahLocWater, lines: [
          ['Four dirham is not expensive.', 'Mine is free and nobody takes it.'],
          ['Quiet today.', 'It is forty-one degrees. Everybody is under something.'],
          ['Something has been at my cart.', 'Something has been at everything.'],
          ['Is that thing coming back?', 'It always comes back.'],
          ['They are chasing something through the souk again.', 'They are always chasing something.'],
        ] });
      }
      if (sahLocSnake && sahLocHalqa) {
        game.addExchange({ biome: 'sahara', a: sahLocHalqa, b: sahLocSnake, gap: 33, lines: [
          ['Your snake is asleep.', 'My snake is listening.'],
          ['How many today?', 'Two. And one of them was a rodent.'],
          ['You are on my pitch.', 'I have been on this pitch since 1988.'],
          ['Give me a better ending.', 'They all end the same way. Somebody sits in the basket.'],
        ] });
      }
      if (sahLocAcro && sahLocHalqa) {
        game.addExchange({ biome: 'sahara', a: sahLocAcro, b: sahLocHalqa, gap: 38, lines: [
          ['Watch this one.', 'I have watched nine hundred of them.'],
          ['We are from Amizmiz.', 'Everybody is from Amizmiz.'],
          ['Who is catching?', 'Nobody is catching. Nobody has ever been catching.'],
        ] });
      }
      if (sahLocGate && sahLocDune) {
        game.addExchange({ biome: 'sahara', a: sahLocGate, b: sahLocDune, gap: 44, lines: [
          ['Anything moving out there?', 'Sand. Just the sand.'],
          ['Wind is getting up.', 'Wind is always getting up. This one means it.'],
          ['Caravan is late.', 'Caravan is four days late. That is on time.'],
        ] });
      }
    }
  }

  if (typeof game.registerShadowTarget === 'function') game.registerShadowTarget(sahRoot);
  // ...and then take it back off the things that must never have had it.
  sahNoShadowOnGhosts(sahRoot);
}
