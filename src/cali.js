import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PALETTE, mat, rand, randInt, clamp, damp, lerp, grain, makeSolidIndex, swayMesh, makeMerger, makeMover } from './shared.js';

// ===========================================================================
// CHAPTER 5 — SANTIAGO DE CALI, VALLE DEL CAUCA
//
// The fifth biome, and the only one built around a BEAT.
//
// Cali is the salsa capital of the world. Not "a city with salsa in it" — the
// whole place runs on it: Juanchito across the river, Barrio Obrero, the
// salsotecas that open at ten and shut at six, and a local footwork so fast
// that dancers from anywhere else spend their first night watching. So the
// centrepiece of this chapter is not a set-piece you walk to, it is a floor you
// have to move on IN TIME, judged against the audio clock the band is actually
// playing to (see game.music in systems.js). It is the one task in the game you
// cannot brute-force by standing in the right rectangle.
//
// Everything else here is the city those dancers walk home through:
//
//        Cristo Rey on his ridge, west, arms out over the whole valley
//                    \
//   ~~~~~~~~~~~ Río Cali ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~   z = 0
//     El Gato de Tejada and his painted girlfriends | La Ermita
//        the riverside walk, the lulada stand       |
//   -------------------------------------------------------  z = 22
//     San Antonio: painted houses, grilles, the chiva
//     the salsoteca and its floor                            z = 26..64
//   -------------------------------------------------------
//                             sugarcane, east, forever       x > 60
//
// Everything is prefixed `cali` (contract: the bundler flattens every module
// into one scope).
// ===========================================================================

// ---------------------------------------------------------------- geography --
const caliRIVER_Z = 0;              // the Río Cali runs east-west
const caliRIVER_HZ = 9;             // half-width of the channel
const caliRIVER_Y = -1.5;           // water surface (the channel is cut below 0)
const caliGATO = { x: -34, z: -14 };
const caliERMITA = { x: 30, z: -20 };
const caliBRIDGE_X = -6;
const caliLULADA = { x: -20, z: -17 };
const caliSTREET_Z = 40;            // the painted street of San Antonio
// THE STOP. This used to be (20, 33), which is inside a house: the south row of
// San Antonio runs from z = 24.7 to 33.3 and there has been a bus in the middle
// of one of them since the chapter was built. It never showed, because both were
// static boxes that only ever had to hold a capybara up. It shows the moment the
// bus is a vehicle with a road drawn under it.
const caliCHIVA = { x: 30, z: 40 };
const caliFLOOR = { x: -22, z: 52, r: 11 };   // the salsoteca floor
const caliCANE = { x0: 62, x1: 168, z0: -46, z1: 74 };
const caliCRISTO = { x: -122, z: -84, h: 46 };
const caliCRUCES = { x: 58, z: -152 };
const caliSPAWN = { x: -16.5, y: 1.4, z: -19.5 };  // see CALI_SPAWN in main.js — it carries the arrival heading
// The lookout the chiva climbs to, on the flank below Cristo Rey. Belalcázar in
// all but name: forty metres short of the statue, seventeen metres over the
// valley, and pointed at the whole city. The statue is visible from it, up and
// to the left, which is the entire reason it is HERE and not on the summit —
// a mirador you can see the landmark from is worth more than the landmark.
const caliMIRADOR = { x: -84, z: -46 };
const caliBRIDGE_DECK = 1.03;       // top of the bridge's collider, and its road level

// --- the dance ---------------------------------------------------------------
// A step counts when the capybara CHANGES what it is doing within
// caliBEAT_WINDOW of a beat: a direction change, a hop, or a wheek. Standing
// still on the beat is not dancing and neither is running in a straight line.
const caliBEAT_WINDOW = 0.19;       // beats — ~114 ms at 100 bpm, a generous 8th
const caliDANCE_TARGET = 8;         // consecutive good steps to pass
const caliDANCE_DROP = 2.6;         // s off the floor before the combo lapses
const caliSTEP_MIN_TURN = 1.1;      // rad of heading change that counts as a step
const caliSTEP_COOL = 0.28;         // s between steps — no mashing

// --- MERCY (R6) --------------------------------------------------------------
// The salsa floor is the hardest thing in the game and it had no assist at all:
// eight consecutive steps inside 114 ms, and one miss puts you back to nothing.
// It gates 100%, not progression — but a wall that a player simply cannot climb
// is a wall whether or not it is on the critical path.
//
// The answer is the one difficulty is supposed to have: it SATURATES. The
// window opens by 15% every time a streak is broken, four times and no further,
// and shuts back to 114 ms the moment the eight land. The TARGET never moves —
// it is eight steps for everybody, and the player is never told any of this.
// A skip button says "you could not do this"; a window nobody can see says
// nothing at all.
//
// TWO THINGS THIS DELIBERATELY DOES NOT DO.
//
//   1. It does not count being knocked off the floor. caliDANCE_DROP lapsing
//      the combo is already documented as "not a punishment", and a mercy that
//      rewards standing in the road would be measuring the wrong thing.
//   2. It stops existing once the task is ticked. `salsa-dance` is one of the
//      twenty measured records, and the floor keeps scoring for ever after the
//      tick precisely so the number can be improved on. A record set through a
//      200 ms window is not the same number as one set through 114 ms, and two
//      players comparing them would be comparing nothing. Mercy is how you get
//      IN; the record is what you do once you are.
const caliMERCY_STEP = 0.15;        // the window opens 15% per broken streak...
const caliMERCY_MAX = 4;            // ...four times and no further: x1.75, 199 ms

// --- THE CHIVA (the chapter's set piece) -------------------------------------
// A chiva is a wooden-bodied bus with the sides cut out, painted like a parrot,
// with a sound system in it and a luggage rack you are absolutely not supposed
// to sit on. The set piece is that you sit on it anyway, for four hundred and
// sixty-five metres, up out of the city to a mirador on the ridge, while the
// sun goes down.
//
// Mechanically it is the ferry's proven rideable-kinematic-platform, and
// deliberately so — it is the one of the four marquee moments that did NOT
// need a new verb. What is new is what is done to you while you ride:
//
//   THE WIRES. Every barrio street in Colombia has a tangle of cable slung
//   across it at roughly the height of the roof of a bus. Each one sweeps the
//   luggage rack front-to-back as the chiva passes under. Hop them. Miss one
//   and it sweeps you off into the road, and then you have to catch a bus.
//
//   The tutorial for that is not a line of text, it is THE BAND: the three
//   musicians riding up front duck about a second before each wire reaches
//   them. Nobody has ever needed to be told what that means.
const caliCHIVA_V0 = 5.6;           // the deadhead speed the return leg uses
const caliCHIVA_V_FLAT = 7.2;       // m/s on the level — about 26 km/h, which is plenty
const caliCHIVA_V_HILL = 4.4;       // m/s at 10% and worse; a chiva climbs in first
const caliCHIVA_ACC = 2.6;          // m/s^2 the engine can add or take away
const caliCHIVA_STOP_T = 5.0;       // s stood at a stop, collecting
const caliCHIVA_PULL_T = 1.3;       // s on the roof before she pulls away
// ---- D4.15: the return leg ------------------------------------------------
// How long she stands at the mirador with nobody on her before turning round,
// and how much quicker she is coming back down empty.
//
// MEASURED at the first values (22 s and 1.75): arrived at t 0.4, returning at
// 22.0, parked again at 69.5 — a sixty-nine second wait for a second run at a
// four-hundred-and-sixty-five metre set piece. That is a player standing about,
// which is what the roadmap item exists to stop. 15 s and 2.10 make it about
// fifty-three, and 2.10 x 5.6 is 11.8 m/s, which is forty-two km/h for an empty
// wooden bus coming down a hill in low gear. Fast, and not silly.
const caliCHIVA_TURN   = 15.0;
const caliCHIVA_DOWN_K = 2.10;
let caliTurnT = 0, caliToldAgain = false;
const caliCHIVA_L = 9.5, caliCHIVA_W = 2.9;
const caliROOF_TOP = 3.70;          // top of the roof collider, in chiva-local metres
// Wire height above the ROAD, not above the bus: the bus pitches on the grades,
// and a wire that pitched with it would be unhoppable on a climb and free on a
// descent.
//
// EVERY NUMBER HERE IS MEASURED, and the first guesses at all three were wrong
// in the same direction. Standing on the rack the capybara's body centre rides
// at road + 4.02; its feet are 0.42 below that and its back 0.38 above. The
// luggage rails top out at road + 4.02 and the bus's own roof at 3.68.
//
// So the cable sits at 4.20: eighteen centimetres of clearance for the bus,
// straight through the chest of anything sat on top of it. Clearing it needs
// 0.60 m of hop.
//
// MEASURED, against the first cable, by sweeping the moment of the press:
//
//     tap (90 ms)    clears from 0.20 s to 0.44 s out   apex 1.4 m
//     held (240 ms)  clears from 0.28 s to 0.52 s out   apex 1.7 m
//
// A quarter of a second either way. That is wider than this chapter's own salsa
// window (0.19 of a beat, 114 ms — 199 ms at the far end of caliMERCY_MAX, and
// still narrower than this) and it is telegraphed twice — by a row of
// pennants you can see forty metres off, and by three musicians going flat a
// second before it arrives. Failing it costs you a bus, not a chapter.
const caliWIRE_Y = 4.20;
const caliWIRE_BAND = [-0.42, 0.38]; // feet to shoulders, signed wire-minus-centre
const caliWIRE_WARN = 0.95;         // s before contact that the band ducks
// Once a cable has had you, it has had you. Without this the arc drops you back
// on the tail of a 9.5 m roof still in front of the same wire, and it takes you
// again on the way past — measured, twice from one cable, 1.6 s apart.
const caliWIRE_OFF = 1.30;          // s during which the roof does not count as a roof

const caliCANE_N = 620;
const caliPALM_N = 46;
const caliCAT_N = 9;                // the Gato's painted girlfriends

// ------------------------------------------------------------------ scratch --
const caliV3 = new THREE.Vector3();
const caliQ = new THREE.Quaternion();
const caliEu = new THREE.Euler();
const caliSc = new THREE.Vector3();
const caliM = new THREE.Matrix4();

// ---------------------------------------------------------------- module ----
// The people this chapter needs a HANDLE on, because they talk to each other.
// See the addExchange block at the foot of caliBuild.
let caliLocTeach = null, caliLocBar = null, caliLocCart = null, caliLocLean = null;
let caliGame = null;
let caliBuilt = false;
let caliRoot = null;
let caliTime = 0;

let caliRiverMesh = null, caliRiverAttr = null, caliRipT = 0;
let caliCaneMesh = null, caliCaneList = null, caliCanePhase = null, caliCaneLast = -1;
let caliFloorMesh = null, caliFloorMat = null;
let caliLampMesh = null;
let caliChivaGroup = null;
let caliGatoGroup = null;
let caliLuladaMesh = null, caliLuladaGone = false, caliLuladaT = 0;
let caliSpark = null;
const caliSPARK_N = 28;
const caliSparkData = new Float32Array(caliSPARK_N * 7);   // x,y,z,vx,vy,vz,life

// --- task / dance state ---
let caliOnFloor = false, caliFloorT = 0;
let caliCombo = 0, caliBestCombo = 0, caliStepCool = 0, caliOffFloorT = 0;
let caliMercy = 0;                  // broken streaks so far — see caliWindow()
let caliLastYaw = 0, caliLastBeat = -1;
let caliDanceDone = false, caliGatoDone = false, caliChivaDone = false;
let caliCaneDone = false, caliCristoDone = false;
let caliCaneEnterX = 0, caliCaneIn = false, caliCaneT = 0;
let caliFlash = 0;                  // 0..1 floor flash on a good step

// --- the ride ---
let caliRX = null, caliRZ = null, caliRY = null, caliRS = null;  // the route, resampled
let caliRouteLen = 0;
let caliChivaBody = null;           // one kinematic compound: deck, roof, ladder
let caliChivaState = 'parked';      // 'parked' | 'rolling' | 'stopped' | 'arrived'
let caliChivaS = 0, caliChivaV = 0, caliChivaYaw = 0.32, caliChivaHold = 0;
let caliChivaX = 0, caliChivaY = 0, caliChivaZ = 0, caliChivaPitch = 0, caliChivaRoll = 0;
let caliRoofT = 0;                  // s the capybara has been stood on the rack
let caliOnRoof = false;
let caliStopIdx = 0;
let caliMiradorDone = false;
let caliNightT = 0, caliVistaT = 0;
let caliWires = null;               // [{ s, x0, z0, x1, z1, y, hit, side }]
// How many cables this ride has been got under cleanly. Scored at the mirador.
let caliWireClear = 0;
let caliWireMesh = null;
let caliBandGroup = null, caliBandDuck = 0, caliBandMembers = null;
let caliCityLights = null, caliCityMat = null;
let caliMiradorGlow = null, caliMiradorPool = null;
let caliRoadMesh = null;
let caliHornT = 0;
let caliSweptT = 0;                 // s left of "a cable has just had you"
const caliMusOut = { x: 0, y: 0, z: 0 };
const caliChivaOut = { x: 0, y: 0, z: 0, yaw: 0, v: 0 };

// ============================================================== helpers ======
function caliXform(px, py, pz, rx, ry, rz, sx, sy, sz) {
  caliEu.set(rx, ry, rz, 'YXZ');
  caliQ.setFromEuler(caliEu);
  caliV3.set(px, py, pz);
  caliSc.set(sx, sy, sz);
  caliM.compose(caliV3, caliQ, caliSc);
  return caliM;
}

const caliG = { box: null, cyl6: null, cyl8: null, cyl4: null, cone6: null, cone4: null, sph6: null, plane: null };
function caliInitGeos() {
  if (caliG.box) return;
  caliG.box = new THREE.BoxGeometry(1, 1, 1);
  caliG.cyl6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
  caliG.cyl8 = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
  caliG.cyl4 = new THREE.CylinderGeometry(0.5, 0.5, 1, 4);
  caliG.cone6 = new THREE.ConeGeometry(0.5, 1, 6);
  caliG.cone4 = new THREE.ConeGeometry(0.5, 1, 4);
  caliG.sph6 = new THREE.SphereGeometry(0.5, 6, 4);
  caliG.plane = new THREE.PlaneGeometry(1, 1);
}

// =================================================================== THE MOTO ==
/**
 * A CITY OF TWO AND A HALF MILLION WITH ONE VEHICLE IN IT.
 *
 * The chiva drives four hundred and sixty-five metres of town street with
 * absolutely nothing else on the road. A moto is the most common vehicle in
 * Colombia by a distance, and this one runs the chiva's own route the other
 * way — so it costs one route function, it is always somewhere plausible, and
 * it passes the bus rather than following it.
 */
const caliMOTO_V = 8.5;
let caliMoto = null, caliMotoMover = null;

// ========================================================== THE PASSENGERS ===
/**
 * A PARTY BUS WITH NO PARTY.
 *
 * The chiva is the chapter's marquee: ninety to a hundred and twenty seconds
 * on the roof of a moving bus, with a band on the rack behind you playing the
 * chapter's own salsa. And the benches under that roof were empty for the
 * whole ride. A chiva that nobody is on is a lorry.
 *
 * On the BENCHES, not the rack. The roof is where the player goes and where
 * the cables are, and the one thing worse than an empty bus is a bus so full
 * the hop you came for is blocked.
 */
const caliPAX_N = 8;
let caliPaxBody = null, caliPaxHead = null;
const caliPaxData = new Float32Array(caliPAX_N * 3);   // lx, lz, phase

function caliBuildPax(group) {
  if (!group) return;
  const B = caliMerger();
  B.box(0, 0.30, 0, 0.42, 0.58, 0.24, 0xffffff);
  B.box(0, -0.14, 0, 0.30, 0.34, 0.20, 0xffffff);
  const H = caliMerger();
  H.box(0, 0.66, 0, 0.23, 0.26, 0.22, PALETTE.skin2);
  H.box(0, 0.81, -0.01, 0.25, 0.09, 0.24, PALETTE.hair1);
  const c = new THREE.Color();
  const SH = [PALETTE.caliNeonPink, PALETTE.caliNeonCyan, PALETTE.caliNeonGold, PALETTE.caliWall1];
  const mk = (geo, tint) => {
    const im = new THREE.InstancedMesh(geo, caliVC(), caliPAX_N);
    im.castShadow = false;
    // A child of a moving vehicle whose bounding sphere is computed at the
    // origin: cull it and the whole load vanishes the moment it pulls away.
    im.frustumCulled = false;
    if (tint) {
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(caliPAX_N * 3), 3);
      for (let i = 0; i < caliPAX_N; i++) { c.set(SH[i % SH.length]); im.setColorAt(i, c); }
      im.instanceColor.needsUpdate = true;
    }
    return im;
  };
  caliPaxBody = mk(B.build(), true);
  caliPaxHead = mk(H.build(), false);
  group.add(caliPaxBody); group.add(caliPaxHead);
  for (let i = 0; i < caliPAX_N; i++) {
    caliPaxData[i * 3] = (i % 2 ? 1 : -1) * 0.86;
    caliPaxData[i * 3 + 1] = -3.4 + Math.floor(i / 2) * 2.2;
    caliPaxData[i * 3 + 2] = rand(0, Math.PI * 2);
  }
  caliUpdatePax();
}

function caliUpdatePax() {
  if (!caliPaxBody) return;
  // The chassis top is at local 0.87 and this figure's feet are 0.31 below
  // its own origin; seated, it is scaled to two thirds. They face out through
  // the open sides, which is the whole point of a chiva.
  const beat = (caliGame && caliGame.music && typeof caliGame.music.beats === 'function')
    ? caliGame.music.beats() : 0;
  for (let i = 0; i < caliPAX_N; i++) {
    const o = i * 3;
    const lx = caliPaxData[o], lz = caliPaxData[o + 1], ph = caliPaxData[o + 2];
    const yaw = lx > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
    // ...and they are on the same beat the band is. Half a bar apart from
    // each other, because a bus that bobs in unison is a chorus line.
    const bob = Math.abs(Math.sin(beat * Math.PI + ph)) * 0.05;
    const m = caliXform(lx, 1.18 + bob, lz, 0, yaw, 0, 1, 0.66, 1);
    caliPaxBody.setMatrixAt(i, m);
    caliPaxHead.setMatrixAt(i, m);
  }
  caliPaxBody.instanceMatrix.needsUpdate = true;
  caliPaxHead.instanceMatrix.needsUpdate = true;
}

function caliBuildMoto(game, root) {
  caliMoto = new THREE.Group();
  const M = caliMerger();
  M.box(0, 0.46, -0.06, 0.30, 0.24, 1.16, PALETTE.caliNeonPink);
  M.box(0, 0.74, -0.40, 0.28, 0.32, 0.30, PALETTE.caliNeonPink);
  M.box(0, 0.88, 0.46, 0.46, 0.07, 0.09, PALETTE.stoneDark);
  for (let i = 0; i < 2; i++)
    M.cyl(0, 0.27, i ? 0.56 : -0.64, 0.27, 0.09, PALETTE.stoneDark, 0, 0, Math.PI / 2, 8);
  M.box(0, 1.00, -0.10, 0.40, 0.60, 0.26, PALETTE.caliNeonCyan);
  M.box(0, 1.42, -0.10, 0.25, 0.26, 0.24, PALETTE.denim);
  const mesh = new THREE.Mesh(M.build(), caliVC());
  mesh.castShadow = true;
  caliMoto.add(mesh);
  root.add(caliMoto);
  const cb = new CANNON.Body({
    mass: 0, type: CANNON.Body.KINEMATIC,
    material: (game.mats && game.mats.ground) || undefined,
  });
  cb.addShape(new CANNON.Box(new CANNON.Vec3(0.32, 0.45, 0.9)),
              new CANNON.Vec3(0, 0.5, 0));
  cb.allowSleep = false;
  cb.previousPosition.copy(cb.position);
  cb.interpolatedPosition.copy(cb.position);
  game.world.addBody(cb);

  caliMotoMover = makeMover({
    body: cb, group: caliMoto,
    at: function (t) {
      // caliRouteAt CLAMPS rather than wrapping, so the parameter is folded
      // into a there-and-back triangle by hand: a moto that stopped dead at
      // the end of the route and stayed there is worse than none.
      const len = caliRouteLen || 1;
      const cyc = len * 2;
      let u = ((t * caliMOTO_V) % cyc + cyc) % cyc;
      const back = u > len;
      if (back) u = cyc - u;
      const o = caliRouteAt(u);
      return { x: o.x, y: o.y + 0.02, z: o.z, yaw: o.yaw + (back ? Math.PI : 0) };
    },
  });
}

function caliMerger() {
  return makeMerger(caliG, {
    xform: caliXform, cylSegs: [4, 8], coneSegs: [4], sphSegs: [], normals: 'recompute', jitter: 0.055,
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
function caliVC() {
  return grain(mat(0xffffff, { vertexColors: true }),
               { scale: 0.45, amount: 0.09, warp: 0.55, near: 0.32, nearPale: 0.60, nearScale: 8, contact: 1 });
}
/** The same thing at ground strength, and flat: the ground is horizontal,
 *  so it wants no vertical shear in the sample at all. */
function caliVCG() {
  return grain(mat(0xffffff, { vertexColors: true }),
               { scale: 0.62, amount: 0.17, warp: 0, near: 0.72, nearPale: 0.55, speck: 0.65, nearScale: 7, contact: 1, broad: 0.1, broadM: 16 });
}
function caliPush9(l, px, py, pz, rx, ry, rz, sx, sy, sz) { l.push(px, py, pz, rx, ry, rz, sx, sy, sz); }
function caliInstance(root, geo, color, list, cast, recv) {
  const n = list.length / 9;
  if (n < 1) return null;
  const im = new THREE.InstancedMesh(geo, mat(color), n);
  for (let i = 0; i < n; i++) {
    const o = i * 9;
    im.setMatrixAt(i, caliXform(list[o], list[o + 1], list[o + 2], list[o + 3], list[o + 4],
                                list[o + 5], list[o + 6], list[o + 7], list[o + 8]));
  }
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  im.castShadow = !!cast;
  im.receiveShadow = !!recv;
  root.add(im);
  return im;
}
const caliSolids = makeSolidIndex();
function caliStaticBox(game, x, y, z, hx, hy, hz, ry) {
  caliSolids.add(x, y, z, hx, hy, hz, ry);
  const b = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
  b.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)));
  b.position.set(x, y, z);
  if (ry) b.quaternion.setFromEuler(0, ry, 0);
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
  b.previousQuaternion.copy(b.quaternion);
  b.interpolatedQuaternion.copy(b.quaternion);
  game.world.addBody(b);
  return b;
}

// ================================================================= TERRAIN ==
/**
 * The valley floor is essentially flat — Cali sits on a plain and the drama is
 * all at the edges — so this is cheap: a river channel cut through it, and the
 * western ridge that Cristo Rey stands on climbing out of it.
 */
function caliTerrain(x, z) {
  let y = 0;
  // ---- the river channel ---------------------------------------------------
  // THE WATER HAS TO HAVE SOMEWHERE TO BE.
  //
  // This was one dish — 3.4 m deep at the centre, falling off over a half width
  // of HZ + 5 — and it only got below the waterline out to rz ~ 4.6. But
  // caliIsOverWater calls everything inside rz < HZ (9 m) river, and the water
  // plane is drawn to 9 m as well, so four and a half metres of each bank was
  // water painted over ground standing up to a metre PROUD of it. Measured at
  // z = 8: terrain -0.62 against a surface at -1.50. What that cost: the animal
  // swam on dry land there (and capybara.js switches its analytic floor backstop
  // off wherever isOverWater is true), and a prop dropped in took the harbour
  // seabed fallback instead of the terrain and sank straight through the bed.
  //
  // So the channel is a trough now, not a dish: a bed that stays under the
  // waterline for the full width the water is drawn at, and banks that climb out
  // of it in the 5 m between the water's edge and the embankment footing.
  const rz = Math.abs(z - caliRIVER_Z);
  if (rz < caliRIVER_HZ + 5) {
    const t = clamp((caliRIVER_HZ + 5 - rz) / 5, 0, 1);
    const bank = t * t * (3 - 2 * t);                       // 1 across the channel, 0 at the footing
    const bed = 0.62 + 0.38 * clamp(1 - rz / caliRIVER_HZ, 0, 1);  // deepest mid-stream
    y -= 3.4 * bank * bed;
  }
  // the ridge, west. A long shoulder rather than a cone: the Farallones are a
  // wall on the horizon, not a volcano.
  const dx = x - caliCRISTO.x, dz = z - caliCRISTO.z;
  const d = Math.sqrt(dx * dx + dz * dz * 0.55);
  if (d < 84) {
    const t = d / 84;
    y += caliCRISTO.h * (0.5 + 0.5 * Math.cos(t * Math.PI)) * (1 - t * 0.12);
  }
  // Las Tres Cruces, north — smaller, and only a silhouette
  const cx = x - caliCRUCES.x, cz = z - caliCRUCES.z;
  const cd = Math.sqrt(cx * cx + cz * cz);
  if (cd < 62) y += 30 * (0.5 + 0.5 * Math.cos(cd / 62 * Math.PI));
  // the cane is on a very slight rise east, which is why you cannot see over it
  if (x > caliCANE.x0 - 12) y += clamp((x - caliCANE.x0 + 12) * 0.02, 0, 2.2);
  // the town shelf is flat, by construction
  if (z > 18 && z < 72 && x > -70 && x < 60) y = lerp(y, 0.2, 0.9);
  // ---- AND SO IS THE MIRADOR, WHICH IT WAS NOT -------------------------
  //
  // caliRoadY has always blended to caliMIR_DECK over the terrace footprint,
  // because the bus has to arrive on the deck rather than climb a kerb — but
  // caliTerrain, which is what the ground MESH and the CANNON heightfield are
  // both built from, knew nothing about it. So the flank ran straight through
  // the terrace: measured on a grid, the raw hillside crosses the deck level
  // about 0.9 m inboard of the centreline, which buries the whole inland half
  // of an eighteen-by-twelve deck and leaves seven metres of standable stone at
  // the end of the chapter's marquee ride. Everything placed up there had to be
  // crowded onto the outboard strip, and the first two positions of the
  // chontaduro cart were inside the hill.
  //
  // A mirador is a BENCH CUT into a flank and now it is one: the same footprint
  // and the same 2.5 m feather caliRoadY already uses, so the two functions
  // agree everywhere by construction instead of by coincidence.
  {
    // ...to 30 cm BELOW the deck, not to the deck. The terrace is a drawn slab
    // whose top face IS caliMIR_DECK, so cutting the ground to the same number
    // makes the two coplanar and the flank z-fights across the whole terrace —
    // it renders as a translucent green wedge lying over the paving. Thirty
    // centimetres of daylight is also just what a laid slab has under it.
    // ...AND THE CUT IS WIDER THAN THE DECK, which caliMiradorT is not.
    // caliMiradorT feathers over the last 2.5 m INSIDE the footprint, because
    // its job is to blend a bus onto a kerb; used as a terrain cut it leaves a
    // 2.5 m strip of the deck's own inland edge with hillside still standing
    // over it — a green wedge lying across the paving, which is what the first
    // cut rendered. The bench is cut 3.2 m PROUD of the slab on every side and
    // feathered outside it, so the deck is clear edge to edge.
    const mdx = x - caliMIRADOR.x, mdz = z - caliMIRADOR.z;
    const mc = Math.cos(caliMIR_YAW), ms = Math.sin(caliMIR_YAW);
    const mlx = mdx * mc - mdz * ms, mlz = mdx * ms + mdz * mc;
    const mt = clamp((caliMIR_HX + 3.2 - Math.abs(mlx)) / 3.2, 0, 1)
             * clamp((caliMIR_HZ + 3.2 - Math.abs(mlz)) / 3.2, 0, 1);
    if (mt > 0) y = lerp(y, caliMIR_DECK - 0.30, mt);
  }
  return y;
}

function caliSlope(x, z) {
  const h = 1.5;
  return Math.sqrt(
    Math.pow(caliTerrain(x + h, z) - caliTerrain(x - h, z), 2) +
    Math.pow(caliTerrain(x, z + h) - caliTerrain(x, z - h), 2)) / (2 * h);
}

function caliBuildGroundMesh() {
  // Z1 IS THE HEIGHTFIELD'S Z1, NOT A ROUND NUMBER. The collider runs to 170
  // (caliBuildGroundBody: Z0 -220 + NZ 78 * EL 5) and the picture used to stop
  // at 150, leaving a 20 x 420 m shelf of invisible floor you could walk out
  // onto and stand on with nothing drawn under you. Extended rather than
  // trimmed, because trimming turns standable ground into void unless the
  // world bounds move with it. 93 segments keeps the ~4.2 m step it had.
  const X0 = -210, X1 = 210, Z0 = -220, Z1 = 170;
  const NX = 96, NZ = 93;
  const g = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0, NX, NZ);
  g.rotateX(-Math.PI / 2);
  g.translate((X0 + X1) * 0.5, 0, (Z0 + Z1) * 0.5);
  const p = g.attributes.position.array;
  const col = new Float32Array(p.length);
  const c = new THREE.Color();
  const grass = new THREE.Color(PALETTE.caliGrass);
  const dry = new THREE.Color(PALETTE.caliGrassDry);
  const earth = new THREE.Color(PALETTE.caliEarth);
  const ridge = new THREE.Color(PALETTE.caliRidge);
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i], z = p[i + 2];
    const y = caliTerrain(x, z);
    p[i + 1] = y;
    const rz = Math.abs(z - caliRIVER_Z);
    if (rz < caliRIVER_HZ + 4) c.copy(earth);
    else if (y > 8) c.copy(ridge).lerp(dry, clamp((y - 8) / 30, 0, 0.4));
    else {
      // sun-baked patches: the valley is green but it is not a lawn
      const t = clamp(0.5 + Math.sin(x * 0.07) * 0.3 + Math.sin(z * 0.09 + 1.3) * 0.3, 0, 1);
      c.copy(grass).lerp(dry, t);
    }
    col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, caliVCG());
  m.receiveShadow = true;
  m.frustumCulled = false;
  return m;
}

function caliBuildGroundBody(game) {
  // Same two faults Kyoto had, and the same fix. 14 m cells could not follow the
  // ridge up to Cristo Rey at all, and sampling the second axis forwards from Z0
  // put the whole collision floor 400 m south of the city. See the contract,
  // "WHICH WAY THE SECOND AXIS RUNS".
  const NX = 84, NZ = 78, X0 = -210, Z0 = -220, EL = 5;
  const Z1 = Z0 + NZ * EL;
  const data = [];
  for (let i = 0; i <= NX; i++) {
    const row = [];
    for (let j = 0; j <= NZ; j++) row.push(caliTerrain(X0 + i * EL, Z1 - j * EL));
    data.push(row);
  }
  const hf = new CANNON.Heightfield(data, { elementSize: EL });
  const b = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
  b.addShape(hf);
  b.position.set(X0, 0, Z1);
  b.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
  b.previousQuaternion.copy(b.quaternion);
  b.interpolatedQuaternion.copy(b.quaternion);
  game.world.addBody(b);
}

// =================================================================== RIVER ==
function caliBuildRiver() {
  const g = new THREE.PlaneGeometry(420, caliRIVER_HZ * 2, 84, 6);
  g.rotateX(-Math.PI / 2);
  g.translate(0, caliRIVER_Y, caliRIVER_Z);
  const p = g.attributes.position.array;
  const col = new Float32Array(p.length);
  const c = new THREE.Color(), a = new THREE.Color(PALETTE.caliRiver), b = new THREE.Color(PALETTE.caliRiverDeep);
  for (let i = 0; i < p.length; i += 3) {
    c.copy(a).lerp(b, clamp(1 - Math.abs(p[i + 2] - caliRIVER_Z) / caliRIVER_HZ, 0, 1));
    col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  // GLITTER, NOT WAVES. The mesh already has a ripple written into it and you
  // cannot see it from six metres up at 41 degrees; what makes water read as
  // water from there is a sparse field of moving points far brighter than the
  // surface. It costs four hash calls and it is the difference between a sea
  // and a sheet of coloured card. See grain() in shared.js.
  const m = new THREE.Mesh(g, grain(mat(0xffffff, { vertexColors: true, transparent: true, opacity: 0.9 }),
    { scale: 0.6, amount: 0.05, warp: 0,
      sparkle: 0.40, sparkleScale: 1.7, sparkleSpeed: 0.52, sparkleCut: 0.655, fresnel: 0.65,
      sparkleColor: PALETTE.caliHaze }));
  m.receiveShadow = true;
  m.frustumCulled = false;
  caliRiverAttr = g.attributes.position;
  caliRiverMesh = m;
  return m;
}

// ------------------------------------------------------------- the current --
/**
 * THE RÍO CALI WAS A BAND OF PAINT.
 *
 * It is the axis the whole chapter is laid out along — the Gato on one bank,
 * La Ermita on the other, the chiva crossing it, and a task that asks you to
 * swim right through the arches of the Ortiz — and there was nothing on it. No
 * foam, no drift, nothing floating: a rippled plane whose ripple you cannot see
 * from six metres up at forty-one degrees, which is the exact problem the Uji's
 * hundred and twenty streaks exist to solve two chapters earlier.
 *
 * This river is straight and its flow is constant, so it needs none of Kyoto's
 * machinery: one instanced draw, a fixed speed east, and streaks that are
 * longest and thinnest in the middle of the channel where the water is quickest.
 * It costs eighty quads and it is the difference between a river and a moat.
 */
const caliFLOW = 1.9;                 // m/s down the channel, west to east
const caliDRIFT_N = 80;
let caliDrift = null, caliDriftData = null;
function caliBuildDrift(root) {
  const g = new THREE.PlaneGeometry(1, 1);
  g.rotateX(-Math.PI / 2);
  caliDrift = new THREE.InstancedMesh(g, mat(PALETTE.caliCanePale, {
    transparent: true, opacity: 0.40, depthWrite: false,
  }), caliDRIFT_N);
  caliDrift.frustumCulled = false;
  caliDrift.castShadow = false;
  caliDriftData = new Float32Array(caliDRIFT_N * 4);   // x, across, life, len
  for (let i = 0; i < caliDRIFT_N; i++) caliDriftRespawn(i, true);
  root.add(caliDrift);
}
function caliDriftRespawn(i, anywhere) {
  const o = i * 4;
  caliDriftData[o] = anywhere ? rand(-190, 190) : rand(-200, -180);
  caliDriftData[o + 1] = rand(-0.92, 0.92);
  caliDriftData[o + 2] = rand(2.0, 7.0);
  caliDriftData[o + 3] = rand(1.1, 3.6);
}
function caliUpdateDrift(dt) {
  if (!caliDrift) return;
  for (let i = 0; i < caliDRIFT_N; i++) {
    const o = i * 4;
    // fastest down the middle, and the bank barely moves at all — the same
    // quadratic falloff the Uji uses, without the centreline it does not need
    const across = Math.abs(caliDriftData[o + 1]);
    const lane = lerp(1, 0.22, across * across);
    caliDriftData[o] += caliFLOW * lane * dt;
    caliDriftData[o + 2] -= dt;
    if (caliDriftData[o + 2] <= 0 || caliDriftData[o] > 200) { caliDriftRespawn(i, false); continue; }
    const x = caliDriftData[o];
    const z = caliRIVER_Z + caliDriftData[o + 1] * (caliRIVER_HZ - 0.8);
    // under the bridge it is dark and there is nothing to see, so they go out
    const lit = Math.abs(x - caliBRIDGE_X) < 5.2 ? 0.05 : 1;
    const len = caliDriftData[o + 3] * (0.4 + lane * 1.5);
    caliDrift.setMatrixAt(i, caliXform(x, caliSurfaceY(x, z) + 0.05, z, 0, 0, 0,
                                       len, 1, (0.34 + (1 - lane) * 0.6) * lit));
  }
  caliDrift.instanceMatrix.needsUpdate = true;
}

function caliSurfaceY(x, z) {
  return caliRIVER_Y + Math.sin(x * 0.30 + caliTime * 2.2) * 0.06
                     + Math.sin(z * 0.4 - caliTime * 1.7) * 0.04;
}

// ================================================== EL GATO DE TEJADA ======
/**
 * The Cat of Tejada: a very round bronze cat on the north bank, three and a
 * half metres of it, and along the walk beside him a parade of painted cats —
 * "las novias del gato", one by each of a dozen different artists. Anybody who
 * has been to Cali will recognise it before they read this comment, which is
 * the entire reason it is the first thing in the biome.
 */
function caliBuildGato(game, root) {
  const G = caliMerger();
  const x = caliGATO.x, z = caliGATO.z, y = caliTerrain(x, z);
  // plinth
  G.cyl(x, y + 0.35, z, 3.4, 0.7, PALETTE.caliStoneDark, 0, 0, 0, 8);
  G.cyl(x, y + 0.76, z, 3.1, 0.14, PALETTE.caliStone, 0, 0, 0, 8);
  caliStaticBox(game, x, y + 0.4, z, 3.0, 0.45, 3.0);
  // the cat: a fat sphere body, a fat sphere head, tiny legs, a curled tail.
  // Roundness is the whole joke of the sculpture and the model has to commit.
  const by = y + 2.55;
  G.sph(x, by, z, 1.85, 1.62, 1.55, PALETTE.caliGato);
  G.sph(x, by - 0.35, z + 0.5, 1.55, 1.25, 1.25, PALETTE.caliGatoDark);
  G.sph(x, by + 1.45, z + 0.35, 1.02, 0.92, 0.95, PALETTE.caliGato);
  // ears — flat triangles, well apart
  for (let s = -1; s <= 1; s += 2) {
    G.cone(x + s * 0.62, by + 2.35, z + 0.28, 0.42, 0.9, PALETTE.caliGato, 0, 0, s * 0.16, 4);
  }
  // face: two eyes and a blunt muzzle
  for (let s = -1; s <= 1; s += 2) {
    G.sph(x + s * 0.36, by + 1.55, z + 1.18, 0.15, 0.19, 0.10, PALETTE.caliGatoDark);
  }
  G.sph(x, by + 1.16, z + 1.20, 0.32, 0.24, 0.18, PALETTE.caliGatoDark);
  // whiskers, because at this scale they read
  for (let s = -1; s <= 1; s += 2) {
    for (let k = 0; k < 3; k++) {
      G.box(x + s * 0.85, by + 1.2 + k * 0.12, z + 1.05, 1.1, 0.05, 0.05,
            PALETTE.caliGatoDark, 0, 0, (k - 1) * 0.16);
    }
  }
  // legs and the curled tail
  for (let a = -1; a <= 1; a += 2) {
    for (let b2 = -1; b2 <= 1; b2 += 2) {
      G.cyl(x + a * 1.0, y + 1.15, z + b2 * 0.85, 0.42, 1.0, PALETTE.caliGato);
    }
  }
  for (let k = 0; k < 6; k++) {
    const a = k / 6 * Math.PI * 1.4;
    G.sph(x - 1.7 - Math.sin(a) * 1.1, by - 0.9 + Math.cos(a) * 0.9 + k * 0.12, z - 1.3,
          0.30 - k * 0.02, 0.30 - k * 0.02, 0.30 - k * 0.02, PALETTE.caliGato);
  }
  const m = new THREE.Mesh(G.build(), caliVC());
  m.castShadow = true;
  m.receiveShadow = true;
  root.add(m);
  caliGatoGroup = m;

  // --- las novias: the painted girlfriends along the riverside walk ---------
  // Each is the same little cat in a different colour, which is exactly what
  // the real row is: one silhouette, a dozen painters.
  const C = caliMerger();
  const coats = [PALETTE.caliWall1, PALETTE.caliWall2, PALETTE.caliWall3, PALETTE.caliWall5,
                 PALETTE.caliWall6, PALETTE.caliNeonPink, PALETTE.caliChivaTrim,
                 PALETTE.caliNeonCyan, PALETTE.caliWall4];
  for (let i = 0; i < caliCAT_N; i++) {
    const cx = caliGATO.x + 10 + i * 7.5;
    const cz = caliGATO.z + (i % 2 ? 1.6 : -1.6);
    const cy = caliTerrain(cx, cz);
    const col = coats[i % coats.length];
    C.cyl(cx, cy + 0.22, cz, 1.05, 0.44, PALETTE.caliStoneDark, 0, 0, 0, 6);
    C.sph(cx, cy + 1.05, cz, 0.68, 0.60, 0.58, col);
    C.sph(cx, cy + 1.85, cz + 0.14, 0.42, 0.40, 0.40, col);
    for (let s = -1; s <= 1; s += 2) {
      C.cone(cx + s * 0.26, cy + 2.28, cz + 0.10, 0.19, 0.42, col, 0, 0, s * 0.2, 4);
      C.sph(cx + s * 0.15, cy + 1.92, cz + 0.48, 0.06, 0.08, 0.05, PALETTE.caliGrille);
    }
    // a tail, up, because a cat's tail is up
    C.cyl(cx, cy + 1.5, cz - 0.62, 0.09, 1.3, col, 0.3, 0, 0);
    caliStaticBox(game, cx, cy + 0.9, cz, 0.7, 0.9, 0.7);
  }
  const cm = new THREE.Mesh(C.build(), caliVC());
  cm.castShadow = true;
  cm.receiveShadow = true;
  root.add(cm);
}

// ================================================================ LA ERMITA ==
/**
 * La Ermita: a small neo-gothic church by the river, blue and white, with one
 * slender spire. It is the most photographed building in Cali and it looks like
 * nothing else in the city, which is why it is worth the geometry.
 */
function caliBuildErmita(game, root) {
  const E = caliMerger();
  const x = caliERMITA.x, z = caliERMITA.z, y = caliTerrain(x, z);
  // nave
  E.box(x, y + 4.5, z, 11, 9, 17, PALETTE.caliErmita);
  E.box(x, y + 9.3, z, 12, 0.7, 18, PALETTE.caliErmitaRf);
  caliStaticBox(game, x, y + 4.5, z, 5.5, 4.5, 8.5);
  // buttresses and the vertical white ribs that make it gothic
  for (let i = -3; i <= 3; i++) {
    for (let s = -1; s <= 1; s += 2) {
      E.box(x + s * 5.6, y + 4.2, z + i * 2.4, 0.7, 8.4, 0.7, PALETTE.caliErmitaTr);
      E.cone(x + s * 5.6, y + 8.8, z + i * 2.4, 0.5, 1.1, PALETTE.caliErmitaTr, 0, 0.4, 0, 4);
    }
  }
  // the west front, the rose window and the door
  E.box(x, y + 5.6, z + 8.8, 9.2, 11.2, 0.8, PALETTE.caliErmita);
  E.box(x, y + 3.0, z + 9.3, 2.6, 5.2, 0.4, PALETTE.caliErmitaTr);
  E.cyl(x, y + 8.0, z + 9.3, 1.5, 0.4, PALETTE.caliErmitaTr, Math.PI / 2, 0, 0, 8);
  E.cyl(x, y + 8.0, z + 9.4, 1.15, 0.3, PALETTE.caliErmitaRf, Math.PI / 2, 0, 0, 8);
  // the tower and its spire
  E.box(x, y + 9.0, z + 6.5, 4.6, 18, 4.6, PALETTE.caliErmita);
  for (let s = -1; s <= 1; s += 2) {
    E.box(x + s * 2.4, y + 9.0, z + 6.5, 0.55, 18, 0.55, PALETTE.caliErmitaTr);
    E.box(x, y + 9.0, z + 6.5 + s * 2.4, 0.55, 18, 0.55, PALETTE.caliErmitaTr);
  }
  E.box(x, y + 18.4, z + 6.5, 5.4, 0.6, 5.4, PALETTE.caliErmitaTr);
  // the belfry openings
  for (let s = -1; s <= 1; s += 2) {
    E.box(x + s * 2.35, y + 16.3, z + 6.5, 0.2, 3.2, 2.0, PALETTE.caliErmitaRf);
    E.box(x, y + 16.3, z + 6.5 + s * 2.35, 2.0, 3.2, 0.2, PALETTE.caliErmitaRf);
  }
  E.cone(x, y + 22.0, z + 6.5, 3.1, 7.2, PALETTE.caliErmitaRf, 0, 0.79, 0, 4);
  E.cyl(x, y + 26.2, z + 6.5, 0.12, 1.6, PALETTE.caliErmitaTr);
  E.box(x, y + 27.2, z + 6.5, 0.7, 0.12, 0.12, PALETTE.caliErmitaTr);
  E.box(x, y + 27.2, z + 6.5, 0.12, 0.7, 0.12, PALETTE.caliErmitaTr);
  caliStaticBox(game, x, y + 9.0, z + 6.5, 2.4, 9, 2.4);

  const m = new THREE.Mesh(E.build(), caliVC());
  m.castShadow = true;
  m.receiveShadow = true;
  root.add(m);
}

// ============================================================ THE RIVERSIDE ==
function caliBuildRiverside(game, root) {
  const R = caliMerger();
  // stone embankments on both sides, stepped down to the water
  for (let s = -1; s <= 1; s += 2) {
    // + 2.7, not + 2.4, and the 2.7 is the wall's own half-depth: at 2.4 the
    // inner face landed at z = +-8.7 while caliIsOverWater calls everything
    // inside +-9 river, so 30 cm of both banks was water you could not swim in
    // with a two-and-a-quarter-metre wall standing up out of it. The face now
    // meets the waterline exactly.
    const zc = caliRIVER_Z + s * (caliRIVER_HZ + 2.7);
    R.box(0, -0.4, zc, 420, 2.2, 5.4, PALETTE.caliStone);
    R.box(0, 0.62, zc, 420, 0.22, 5.8, PALETTE.caliStoneDark);
    caliStaticBox(game, 0, -0.5, zc, 210, 1.24, 2.7);
    // the steps down to the water where people sit
    for (let k = 0; k < 3; k++) {
      R.box(0, -0.75 - k * 0.42, caliRIVER_Z + s * (caliRIVER_HZ - 0.4 - k * 0.8),
            420, 0.42, 0.85, PALETTE.caliStone);
    }
    // a low parapet, broken at the bridge
    for (let x = -200; x < 200; x += 8) {
      if (Math.abs(x - caliBRIDGE_X) < 9) continue;
      R.box(x + 4, 1.25, zc + s * 2.3, 7.4, 1.0, 0.5, PALETTE.caliStoneDark);
    }
  }
  // --- the bridge -----------------------------------------------------------
  const bx = caliBRIDGE_X;
  R.box(bx, 0.75, caliRIVER_Z, 9, 0.55, (caliRIVER_HZ + 4) * 2, PALETTE.caliStone);
  caliStaticBox(game, bx, 0.62, caliRIVER_Z, 4.5, 0.42, caliRIVER_HZ + 4);
  // ---- ...AND THE PARAPETS ARE SOLID ---------------------------------------
  // They were drawn and not collided, along their whole length, both sides:
  // measured, eighteen rays out of eighteen found stone at 2.05 m and nothing
  // at all in the physics world. A bridge with a waist-high wall you walk
  // straight through is worse than a bridge with no wall, because the wall is
  // the game telling you it is safe to stand there.
  //
  // Same rule as this chapter's own chiva ("THE LUGGAGE RAILS ARE SOLID... They
  // are drawn already; they were not collided") and Hanoi's Huc bridge. The
  // chiva is KINEMATIC, so making these solid cannot stop the bus crossing —
  // and the deck collider is 9 m wide against the bus's own width, so it never
  // touched them anyway.
  for (let s = -1; s <= 1; s += 2) {
    R.box(bx + s * 4.3, 1.55, caliRIVER_Z, 0.5, 1.2, (caliRIVER_HZ + 4) * 2, PALETTE.caliStoneDark);
    caliStaticBox(game, bx + s * 4.3, 1.55, caliRIVER_Z, 0.25, 0.6, caliRIVER_HZ + 4);
    for (let k = -2; k <= 2; k++) {
      R.cyl(bx + s * 4.3, 1.9, caliRIVER_Z + k * 3.6, 0.22, 0.7, PALETTE.caliStone, 0, 0, 0, 6);
    }
  }
  // two arches under it
  for (let s = -1; s <= 1; s += 2) {
    R.cyl(bx, -0.4, caliRIVER_Z + s * 4.5, 2.2, 8.6, PALETTE.caliStoneDark, 0, 0, Math.PI / 2, 6);
  }

  // --- the lulada stand -----------------------------------------------------
  // Lulada is crushed lulo, ice, lime and sugar, and it is sold from a cart on
  // this exact stretch of riverbank by somebody who has been doing it for years.
  const lx = caliLULADA.x, lz = caliLULADA.z, ly = caliTerrain(lx, lz);
  R.box(lx, ly + 0.55, lz, 3.2, 1.1, 1.7, PALETTE.caliWall4);
  R.box(lx, ly + 1.16, lz, 3.4, 0.14, 1.9, PALETTE.caliStoneDark);
  for (let s = -1; s <= 1; s += 2) {
    R.cyl(lx + s * 1.4, ly + 1.9, lz, 0.09, 1.5, PALETTE.caliGrille);
  }
  R.box(lx, ly + 2.66, lz, 4.0, 0.16, 2.6, PALETTE.caliWall2);
  R.box(lx, ly + 2.52, lz, 4.0, 0.16, 2.6, PALETTE.caliWall4, 0, 0, 0);
  for (let s = -1; s <= 1; s += 2) {
    R.cyl(lx + s * 1.4, ly + 0.36, lz + 0.9, 0.34, 0.72, PALETTE.caliGrille, Math.PI / 2, 0, 0, 8);
  }
  caliStaticBox(game, lx, ly + 0.55, lz, 1.6, 0.6, 0.9);

  const m = new THREE.Mesh(R.build(), caliVC());
  m.castShadow = true;
  m.receiveShadow = true;
  root.add(m);

  // the jug of lulada itself: the thing you actually steal
  const J = caliMerger();
  J.cyl(0, 0.28, 0, 0.30, 0.56, PALETTE.caliCanePale, 0, 0, 0, 8);
  J.cyl(0, 0.44, 0, 0.31, 0.22, PALETTE.caliGrass, 0, 0, 0, 8);
  J.box(0, 0.30, 0.34, 0.10, 0.30, 0.10, PALETTE.caliCanePale);
  J.cyl(0, 0.62, 0, 0.05, 0.5, PALETTE.caliNeonPink, 0.2, 0, 0.25);
  caliLuladaMesh = new THREE.Mesh(J.build(), caliVC());
  caliLuladaMesh.position.set(lx + 0.6, ly + 1.24, lz - 0.1);
  caliLuladaMesh.castShadow = true;
  root.add(caliLuladaMesh);
}

// ============================================================== SAN ANTONIO ==
/**
 * The painted street. San Antonio is a hill of small colonial houses in
 * saturated colours with iron grilles over the windows and a lot of doors
 * standing open, and it is the best-looking thing in the city at street level.
 */
function caliBuildStreet(game, root) {
  const S = caliMerger();
  const walls = [PALETTE.caliWall1, PALETTE.caliWall2, PALETTE.caliWall3,
                 PALETTE.caliWall4, PALETTE.caliWall5, PALETTE.caliWall6];
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 9; i++) {
      const x = -44 + i * 11 + (side > 0 ? 4 : 0);
      const z = caliSTREET_Z + side * 11;
      const y = caliTerrain(x, z);
      const w = rand(8.2, 10.2), h = rand(4.6, 6.4);
      // THE SALSOTECA IS BUILT INSIDE THIS TERRACE, and nobody noticed for five
      // chapters because both of them were only ever static boxes holding a
      // capybara up. Measured on a one-metre grid at chest height: FORTY-THREE
      // PER CENT of the dance floor was solid — three houses of the south row
      // stand in it, one of them almost on the centre. So the chapter's marquee
      // mechanic, the one thing in this game that cannot be brute-forced, was
      // being played in a circle that was nearly half wall.
      //
      // The floor does not move; the houses do. An open-air salsa spot in San
      // Antonio IS a gap in the terrace — a plot where three houses used to be
      // — so declining to build the three that overlap it is not a workaround,
      // it is the thing that was meant to be there.
      const nx = clamp(caliFLOOR.x, x - w * 0.5, x + w * 0.5);
      const nz = clamp(caliFLOOR.z, z - 4.3, z + 4.3);
      if (Math.hypot(nx - caliFLOOR.x, nz - caliFLOOR.z) < caliFLOOR.r + 2.2) continue;
      const col = walls[(i + (side > 0 ? 3 : 0)) % walls.length];
      S.box(x, y + h * 0.5, z, w, h, 8.6, col);
      // THE ROOF: PANTILES, AND THEY ARE PITCHED. Three stacked slabs read as a
      // tray from forty-one degrees down, which is the only angle this game
      // has — eighteen painted houses with flat red trays on them was the last
      // and largest of the same miss the Manly wharf shed and Gion's machiya
      // both carried. A white cornice under the eave, two planes over it, and a
      // ridge tile: three boxes a side instead of three flat ones, and the
      // street acquires a skyline.
      S.box(x, y + h + 0.10, z, w + 0.5, 0.34, 9.0, PALETTE.caliWall4);
      const RISE = 1.15, HD = 5.3;
      const PIT = Math.atan2(RISE, HD);
      for (let e = -1; e <= 1; e += 2) {
        // ONE PLANE A SIDE, DEEP ENOUGH TO BE ITS OWN EAVE. A separate eave
        // course under a pitched plane is a second box that has to agree with
        // the first about two rotations and a width, and it did not: it read as
        // a loose plank floating off each roof edge. Width w + 0.6 keeps it
        // inside the 11 m house spacing, so no roof crosses its neighbour's.
        S.box(x, y + h + 0.44 + RISE * 0.5, z + e * HD * 0.5, w + 0.6, 0.42, HD + 1.7,
              PALETTE.caliRoof, -e * PIT, 0, 0);
      }
      S.box(x, y + h + 1.68, z, w + 0.4, 0.30, 0.62, PALETTE.caliRoofDark);
      // the door, standing open, with the dark inside showing
      const dz = z - side * 4.4;
      S.box(x - w * 0.22, y + 1.5, dz, 1.7, 3.0, 0.22, PALETTE.caliGrille);
      S.box(x - w * 0.22, y + 1.5, dz - side * 0.16, 1.5, 2.8, 0.16, PALETTE.caliShutter);
      // two windows behind iron grilles
      for (let k = 0; k < 2; k++) {
        const wx = x + w * (0.10 + k * 0.26);
        S.box(wx, y + 2.1, dz, 1.5, 1.7, 0.2, PALETTE.caliWall4);
        S.box(wx, y + 2.1, dz - side * 0.14, 1.25, 1.45, 0.1, PALETTE.caliShutter);
        for (let b = 0; b < 5; b++) {
          S.box(wx - 0.5 + b * 0.25, y + 2.1, dz - side * 0.24, 0.07, 1.5, 0.07, PALETTE.caliGrille);
        }
      }
      caliStaticBox(game, x, y + h * 0.5, z, w * 0.5, h * 0.5, 4.3);
    }
  }
  // the street itself: worn stone with a crown and gutters
  const sy = caliTerrain(0, caliSTREET_Z);
  S.box(0, sy + 0.08, caliSTREET_Z, 120, 0.16, 13, PALETTE.caliStone);
  for (let s = -1; s <= 1; s += 2) {
    S.box(0, sy + 0.04, caliSTREET_Z + s * 6.2, 120, 0.14, 1.1, PALETTE.caliStoneDark);
  }
  caliStaticBox(game, 0, sy - 0.2, caliSTREET_Z, 60, 0.3, 6.5);
  // bunting across the street, because there is always bunting
  for (let x = -40; x < 44; x += 12) {
    for (let k = 0; k < 9; k++) {
      const t = k / 8;
      const zz = caliSTREET_Z - 6 + t * 12;
      const sag = Math.sin(t * Math.PI) * 1.1;
      S.box(x, sy + 7.4 - sag, zz, 0.5, 0.55, 0.06,
            walls[(k + x) % walls.length], 0, 0, 0.5);
    }
  }
  const m = new THREE.Mesh(S.build(), caliVC());
  m.castShadow = true;
  m.receiveShadow = true;
  root.add(m);
}

// ==================================================================== CHIVA ==
/**
 * A chiva: a wooden-bodied bus painted in the colours of the flag with the
 * whole side open, benches instead of seats, and a ladder up the back to the
 * roof rack. In Cali it is a party that drives.
 */
function caliBuildChiva(game, root) {
  const g = new THREE.Group();
  const C = caliMerger();
  const L = 9.5, W = 2.9;
  // chassis and wheels
  C.box(0, 0.62, 0, W, 0.5, L, PALETTE.caliGrille);
  for (let s = -1; s <= 1; s += 2) {
    for (let k = -1; k <= 1; k += 2) {
      C.cyl(s * (W * 0.5 - 0.1), 0.55, k * (L * 0.32), 0.55, 0.42, PALETTE.caliGrille,
            0, 0, Math.PI / 2, 8);
      C.cyl(s * (W * 0.5 - 0.1), 0.55, k * (L * 0.32), 0.26, 0.46, PALETTE.caliChivaTrim,
            0, 0, Math.PI / 2, 6);
    }
  }
  // the body: red, with yellow and blue bands, and the roof on posts
  C.box(0, 1.30, 0, W, 0.9, L, PALETTE.caliChiva);
  C.box(0, 1.78, 0, W + 0.06, 0.2, L, PALETTE.caliChivaTrim);
  C.box(0, 0.95, 0, W + 0.06, 0.2, L, PALETTE.caliChivaBlue);
  // benches, visible because the sides are open
  for (let k = -2; k <= 2; k++) {
    C.box(0, 1.95, k * 1.7, W - 0.2, 0.16, 0.7, PALETTE.caliChivaTrim);
    C.box(0, 2.35, k * 1.7 - 0.35, W - 0.2, 0.8, 0.12, PALETTE.caliChivaGrn);
  }
  // the roof, on posts
  for (let s = -1; s <= 1; s += 2) {
    for (let k = -2; k <= 2; k++) {
      C.box(s * (W * 0.5 - 0.12), 2.6, k * 2.0, 0.16, 1.5, 0.16, PALETTE.caliChivaTrim);
    }
  }
  C.box(0, 3.42, 0, W + 0.7, 0.22, L + 0.5, PALETTE.caliChivaGrn);
  C.box(0, 3.60, 0, W + 0.3, 0.16, L, PALETTE.caliChivaTrim);
  // roof rack rails, which is where the capybara is going to end up, and which
  // are collided (see the note on the body below) — they are what keeps a
  // passenger aboard through the corner at the bridge
  for (let s = -1; s <= 1; s += 2) {
    C.box(s * (W * 0.5 + 0.2), 3.87, 0, 0.14, 0.34, L, PALETTE.caliChivaBlue);
    for (let k = -2; k <= 2; k++) {
      C.box(s * (W * 0.5 + 0.2), 3.76, k * 2.1, 0.16, 0.12, 0.16, PALETTE.caliChivaTrim);
    }
  }
  C.box(0, 3.87, L * 0.5 - 0.07, W + 0.4, 0.34, 0.14, PALETTE.caliChivaBlue);
  // the cab
  C.box(0, 1.85, L * 0.5 + 0.4, W - 0.2, 2.0, 1.4, PALETTE.caliChiva);
  C.box(0, 2.35, L * 0.5 + 1.05, W - 0.6, 0.9, 0.2, PALETTE.caliErmita);
  C.box(0, 0.95, L * 0.5 + 1.2, W - 0.3, 0.5, 0.4, PALETTE.caliChivaTrim);
  // The ladder up the back. Deeper treads than it had — 0.10 m of tread was a
  // ledge you caught by luck, and this is now the only way onto a moving
  // vehicle, which makes climbing it a thing that has to work every time.
  C.box(0, 0.72, -L * 0.5 - 0.52, 1.5, 0.14, 0.62, PALETTE.caliChivaTrim);   // the bottom step, wide
  for (let k = 0; k < 5; k++) {
    C.box(0, 1.28 + k * 0.60, -L * 0.5 - 0.42, 1.1, 0.12, 0.30, PALETTE.caliChivaTrim);
  }
  for (let s = -1; s <= 1; s += 2) {
    C.box(s * 0.52, 2.35, -L * 0.5 - 0.42, 0.10, 3.2, 0.10, PALETTE.caliChivaBlue);
  }
  const m = new THREE.Mesh(C.build(), caliVC());
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  caliBuildBand(g);
  // She is parked at the head of the route, pointing the way she is going to
  // go. Reading the pose off caliRouteAt(0) rather than hardcoding it is what
  // stops the bus and the road disagreeing by half a bus width the day somebody
  // moves a waypoint.
  const start = caliRouteAt(0);
  g.position.set(start.x, start.y, start.z);
  g.rotation.y = start.yaw;
  root.add(g);
  caliChivaGroup = g;

  // ---- the colliders, as ONE KINEMATIC BODY --------------------------------
  // She used to be seven static boxes bolted to the terrain, which was correct
  // while she was scenery. She is a vehicle now, so it is the ferry's body:
  // mass 0 + KINEMATIC so nothing can push her about and she never falls, every
  // shape in chiva-local space so the whole bus moves as one, and allowSleep
  // off — a kinematic body at rest falls asleep, a sleeping body is skipped in
  // narrowphase, and the floor of the thing you are stood on silently stops
  // existing. That one has bitten this project before.
  const body = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC,
                                 material: (game.mats && game.mats.ground) || undefined });
  body.allowSleep = false;
  body.addShape(new CANNON.Box(new CANNON.Vec3(W * 0.5, 0.9, L * 0.5)),
                new CANNON.Vec3(0, 1.55, 0));                                  // the deck
  body.addShape(new CANNON.Box(new CANNON.Vec3(W * 0.5 + 0.35, 0.2, L * 0.5)),
                new CANNON.Vec3(0, 3.5, 0));                                   // the roof
  // THE LUGGAGE RAILS ARE SOLID, and they are the reason the ride is a ride
  // rather than a coin flip. They are drawn already; they were not collided.
  //
  // A bus turns about its own origin here, so the back of a nine-and-a-half
  // metre roof sweeps sideways through every corner, and a passenger — who
  // quite correctly keeps going straight — gets left behind by it. Measured, the
  // right-angle at the bridge foot put the animal in the road every single run.
  // That is not a mechanic, it is a dice roll with no warning and no verb to
  // answer it, and this chapter already HAS its hazard. So: a rail a side, plus
  // one across the front over the cab. The back stays open, because the back is
  // the ladder, and because a cable is supposed to throw you out of it.
  for (let s = -1; s <= 1; s += 2) {
    body.addShape(new CANNON.Box(new CANNON.Vec3(0.07, 0.17, L * 0.5)),
                  new CANNON.Vec3(s * (W * 0.5 + 0.2), 3.87, 0));
  }
  body.addShape(new CANNON.Box(new CANNON.Vec3(W * 0.5 + 0.2, 0.17, 0.07)),
                new CANNON.Vec3(0, 3.87, L * 0.5 - 0.07));
  body.addShape(new CANNON.Box(new CANNON.Vec3(0.75, 0.07, 0.31)),
                new CANNON.Vec3(0, 0.72, -(L * 0.5 + 0.52)));                  // the bottom step
  for (let k = 0; k < 5; k++) {
    body.addShape(new CANNON.Box(new CANNON.Vec3(0.55, 0.06, 0.15)),
                  new CANNON.Vec3(0, 1.28 + k * 0.60, -(L * 0.5 + 0.42)));
  }
  body.position.set(start.x, start.y, start.z);
  body.quaternion.setFromEuler(0, start.yaw, 0);
  body.previousPosition.copy(body.position);
  body.interpolatedPosition.copy(body.position);
  body.previousQuaternion.copy(body.quaternion);
  body.interpolatedQuaternion.copy(body.quaternion);
  game.world.addBody(body);
  caliChivaBody = body;
  caliChivaX = start.x; caliChivaY = start.y; caliChivaZ = start.z;
  caliChivaYaw = start.yaw;
}

/**
 * THE BAND, ON THE ROOF, FACING BACKWARDS.
 *
 * Three of them at the forward end of the luggage rack: congas, a timbal, and a
 * trumpet. They are here for two reasons and only one of them is decoration.
 *
 * The first is that this chapter's music has been a score for five tasks and
 * the set piece is where it stops being one — the salsa you have been dancing
 * to is coming out of the back of this bus, and systems.js pans and muffles it
 * with distance from the moment she pulls away (see musSource()). Fall off the
 * roof and the band drives away from you, and you hear that happen.
 *
 * The second is the tutorial. They duck a second before every wire. That is the
 * whole of the teaching for the only new mechanic in the set piece, and it
 * costs one line of animation.
 */
function caliBuildBand(g) {
  const grp = new THREE.Group();
  caliBandMembers = [];
  const KIT = [
    { x: -0.95, z: 2.9,  shirt: PALETTE.caliWall4, skin: PALETTE.skin3, hair: PALETTE.hair2, kind: 'conga' },
    { x: 0.00,  z: 3.55, shirt: PALETTE.caliWall1, skin: PALETTE.skin2, hair: PALETTE.hair1, kind: 'timbal' },
    { x: 0.95,  z: 2.9,  shirt: PALETTE.caliWall3, skin: PALETTE.skin4, hair: PALETTE.hair2, kind: 'horn' },
  ];
  for (let i = 0; i < KIT.length; i++) {
    const k = KIT[i];
    const B = caliMerger();
    // seated, because nobody stands up on a luggage rack: legs forward, body up
    B.box(0, 0.20, 0.16, 0.44, 0.22, 0.62, PALETTE.denim);
    B.box(0, 0.62, 0, 0.52, 0.72, 0.36, k.shirt);
    B.sph(0, 1.14, 0, 0.20, 0.22, 0.20, k.skin);
    B.sph(0, 1.22, -0.02, 0.21, 0.16, 0.21, k.hair);
    for (let s = -1; s <= 1; s += 2) {
      B.box(s * 0.33, 0.66, 0.10, 0.14, 0.50, 0.14, k.skin, 0.5, 0, 0);
    }
    if (k.kind === 'conga') {
      for (let s = -1; s <= 1; s += 2) {
        B.cyl(s * 0.34, 0.30, 0.60, 0.21, 0.62, PALETTE.caliChivaBlue, 0, 0, 0, 8);
        B.cyl(s * 0.34, 0.62, 0.60, 0.22, 0.05, PALETTE.caliWall4, 0, 0, 0, 8);
      }
    } else if (k.kind === 'timbal') {
      for (let s = -1; s <= 1; s += 2) {
        B.cyl(s * 0.30, 0.44, 0.58, 0.24, 0.20, PALETTE.caliNeonGold, 0, 0, 0, 8);
        B.cyl(s * 0.30, 0.55, 0.58, 0.25, 0.04, PALETTE.caliWall4, 0, 0, 0, 8);
      }
      B.cyl(0, 0.78, 0.72, 0.26, 0.03, PALETTE.caliNeonGold, 0.25, 0, 0, 8);   // the cowbell's cousin
    } else {
      B.cyl(0, 0.98, 0.42, 0.07, 0.70, PALETTE.caliNeonGold, Math.PI / 2 - 0.35, 0, 0, 6);
      B.cone(0, 1.10, 0.76, 0.19, 0.28, PALETTE.caliNeonGold, Math.PI / 2 - 0.35, 0, 0, 6);
    }
    const mesh = new THREE.Mesh(B.build(), caliVC());
    mesh.castShadow = true;
    const holder = new THREE.Group();
    holder.add(mesh);
    holder.position.set(k.x, caliROOF_TOP, k.z);
    holder.rotation.y = Math.PI;         // facing aft, at the passengers
    grp.add(holder);
    caliBandMembers.push({ holder, mesh, phase: i * 0.37 });
  }
  g.add(grp);
  caliBandGroup = grp;
}

// ================================================================== THE ROAD ==
// The lookout deck, half a metre proud of the flank it is cut into. Read by
// caliRoadY, so it has to be a plain number and not a call — the terrace and the
// road that arrives on it must agree exactly or the bus climbs a kerb.
const caliMIR_DECK = 17.72;
// Local +z points OUT over the valley; local +x runs along the contour. Derived
// from the gradient of the ridge at the terrace: the flank falls away at nearly
// 60% here, which is why there is a retaining wall under it and a railing on it.
const caliMIR_YAW = 1.068;

/**
 * THE HEIGHT OF THE ROAD SURFACE at (x, z), which is the terrain everywhere
 * except the two places the road is not lying on the ground.
 *
 * The bus, the drawn ribbon and the wires all read this one function, which is
 * the only way three things stay on the same surface. The bridge is the reason
 * it exists: the Rio Cali's channel bottoms out 3.4 m below the valley and the
 * deck of the bridge over it stands 1.03 m above, so a bus following the terrain
 * across x = -6 would drive through the water and out of the far bank.
 */
function caliRoadY(x, z) {
  const base = caliTerrain(x, z);
  // --- the bridge ---
  // Blended in BOTH axes. Gating it on |x - bridge| alone put a vertical step in
  // the road where the riverside approach crossed the window; the x term now
  // fades over three metres, so the approach climbs onto the deck instead of
  // arriving at the side of it.
  const dz = Math.abs(z - caliRIVER_Z), dx = Math.abs(x - caliBRIDGE_X);
  if (dz < 24 && dx < 14) {
    const t = clamp((24 - dz) / 10, 0, 1) * clamp((14 - dx) / 3, 0, 1);
    if (t > 0) return lerp(base, caliBRIDGE_DECK, t);
  }
  // --- the mirador terrace ---
  const mt = caliMiradorT(x, z);
  if (mt > 0) return lerp(base, caliMIR_DECK, mt);
  // --- San Antonio's own paving ---
  // The painted street was laid long before this road was, and it stands 16 cm
  // proud of the valley floor. Sixteen centimetres of a 1.1 m wheel is a bus
  // buried to its hubs, so the road climbs onto the cobbles rather than through
  // them, and caliBuildRoad declines to paint asphalt over them.
  const st = caliStreetT(x, z);
  if (st > 0) return base + caliSTREET_TOP * st;
  return base;
}

const caliMIR_HX = 9, caliMIR_HZ = 6;
/**
 * 1 on the lookout deck, 0 off it, blended over the outer 2.5 m.
 *
 * IN THE TERRACE'S OWN AXES, not as a circle about its middle. The terrace is
 * eighteen metres by twelve and the bus parks at one end of it — a radial blend
 * big enough to reach that end also reaches four metres out over a 60% flank,
 * which puts a tongue of road hanging in mid-air off the side of the hill.
 */
function caliMiradorT(x, z) {
  const mx = x - caliMIRADOR.x, mz = z - caliMIRADOR.z;
  const c = Math.cos(caliMIR_YAW), s = Math.sin(caliMIR_YAW);
  const lx = mx * c - mz * s, lz = mx * s + mz * c;
  if (Math.abs(lx) > caliMIR_HX || Math.abs(lz) > caliMIR_HZ) return 0;
  return clamp((caliMIR_HX - Math.abs(lx)) / 2.5, 0, 1)
       * clamp((caliMIR_HZ - Math.abs(lz)) / 2.5, 0, 1);
}

const caliSTREET_HZ = 6.5;
const caliSTREET_TOP = 0.16;
/** 1 on the old paving, 0 off it, blended over the last two metres of each. */
function caliStreetT(x, z) {
  if (Math.abs(z - caliSTREET_Z) > caliSTREET_HZ || Math.abs(x) > 60) return 0;
  return clamp((caliSTREET_HZ - Math.abs(z - caliSTREET_Z)) / 2.2, 0, 1)
       * clamp((60 - Math.abs(x)) / 2.2, 0, 1);
}

// --- the route -------------------------------------------------------------
// Two halves, authored two different ways because they are two different kinds
// of road.
//
// THE TOWN is a list of corners, because a city street is a list of corners: out
// of San Antonio, west along the painted houses, down to the river, east along
// the embankment, over the bridge, and west again past the Gato and out. It is a
// lap of everything this chapter has already made you care about.
const caliROUTE_TOWN = [
  [30, 40], [12, 40], [-12, 41], [-36, 40], [-50, 34], [-52, 25], [-44, 21],
  [-20, 22], [-6, 24], [-6, 8], [-6, -8], [-6, -22], [-18, -25], [-40, -23], [-56, -26],
];
// THE FLANK is authored in POLAR COORDINATES ABOUT CRISTO REY, because the ridge
// is an ellipse centred on him and a switchback is a thing that follows a
// contour. Each knot is [bearing in degrees, ellipse radius in metres]; the
// bearing swings back and forth while the radius shrinks, and the hairpins fall
// out where the bearing reverses.
//
// Authoring it in world x/z was tried first and is a trap: a straight line
// between two points on the same contour cuts INSIDE it, so the middle of every
// traverse runs up the fall line. Measured, that route peaked at a 74% grade.
// This one peaks at 8.9%, which a bus can actually climb, and it did not need a
// single number tuned by hand — it is the same five knots, sampled along the arc
// instead of chorded across it.
const caliROUTE_FLANK = [
  [35.6, 71.3],   // the foot of the ridge, where the last houses stop
  [-8, 65],       // first hairpin
  [38, 58],
  [-6, 52],       // second hairpin
  [36.6, 47.3],   // onto the terrace
];
// AND THEN SHE PARKS OUT OF THE WAY.
//
// The last waypoint used to be the middle of the lookout, which meant a nine and
// a half metre bus came to rest across the exact spot the whole set piece exists
// to look out of — thirty seconds of climbing for a view of a luggage rack. She
// pulls up along the inland edge instead, six metres to one side and two back
// from the parapet, so the terrace reads as a terrace with a bus on it. In the
// terrace's own axes, converted at build.
const caliROUTE_PARK = [-6.0, -2.0];
const caliROUTE_STEP = 2.0;         // m between resampled points
const caliROUTE_SMOOTH = 4;         // passes of [1,2,1] — about an 8 m corner radius
// Two stops, as fractions of the route. A chiva collects; that is the whole
// premise of the vehicle, and it is also two five-second windows to get back on
// after a wire has had you off.
const caliSTOPS = [0.205, 0.455];
// The wires, as fractions of the route. All of them are in the town half: the
// tangle over the street is a barrio thing, and the climb is deliberately clear
// so that the last ninety seconds are for looking at the view.
const caliWIRE_AT = [0.09, 0.16, 0.24, 0.33, 0.40, 0.47, 0.53];

/**
 * Resample both halves into one dense polyline, round the corners, and measure
 * it. Called once, at build.
 */
function caliBuildRoute() {
  const K = 1 / Math.sqrt(0.55);            // the ridge ellipse's z stretch
  const pts = caliROUTE_TOWN.map(p => [p[0], p[1]]);
  for (let i = 1; i < caliROUTE_FLANK.length; i++) {
    const a = caliROUTE_FLANK[i - 1], b = caliROUTE_FLANK[i];
    const N = 18;
    for (let k = 1; k <= N; k++) {
      const u = k / N;
      const th = lerp(a[0], b[0], u) * Math.PI / 180;
      const d = lerp(a[1], b[1], u);
      pts.push([caliCRISTO.x + d * Math.cos(th), caliCRISTO.z + d * K * Math.sin(th)]);
    }
  }
  // the last few metres, across the deck to where she stands all night
  {
    const c = Math.cos(caliMIR_YAW), s = Math.sin(caliMIR_YAW);
    const lx = caliROUTE_PARK[0], lz = caliROUTE_PARK[1];
    pts.push([caliMIRADOR.x + lx * c + lz * s, caliMIRADOR.z - lx * s + lz * c]);
  }
  // Resample at a fixed spacing so the smoothing kernel means the same thing
  // everywhere — the town corners are 9 m apart and the flank samples are 4 m,
  // and a fixed-tap filter over uneven samples rounds the wrong corners.
  const rx = [], rz = [];
  rx.push(pts[0][0]); rz.push(pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const ax = pts[i - 1][0], az = pts[i - 1][1], bx = pts[i][0], bz = pts[i][1];
    const seg = Math.hypot(bx - ax, bz - az);
    if (seg < 1e-4) continue;
    const n = Math.max(1, Math.round(seg / caliROUTE_STEP));
    for (let k = 1; k <= n; k++) {
      rx.push(lerp(ax, bx, k / n));
      rz.push(lerp(az, bz, k / n));
    }
  }
  // Round the corners. The ENDPOINTS ARE PINNED: the first point is where she is
  // parked and the last is the middle of the mirador terrace, and neither is
  // allowed to drift — the terrace is 12 m deep and the road has to end on it.
  for (let pass = 0; pass < caliROUTE_SMOOTH; pass++) {
    const ox = rx.slice(), oz = rz.slice();
    for (let i = 1; i < rx.length - 1; i++) {
      rx[i] = ox[i - 1] * 0.25 + ox[i] * 0.5 + ox[i + 1] * 0.25;
      rz[i] = oz[i - 1] * 0.25 + oz[i] * 0.5 + oz[i + 1] * 0.25;
    }
  }
  const n = rx.length;
  caliRX = new Float32Array(n);
  caliRZ = new Float32Array(n);
  caliRY = new Float32Array(n);
  caliRS = new Float32Array(n);
  let s = 0;
  for (let i = 0; i < n; i++) {
    caliRX[i] = rx[i]; caliRZ[i] = rz[i];
    caliRY[i] = caliRoadY(rx[i], rz[i]);
    if (i) s += Math.hypot(rx[i] - rx[i - 1], rz[i] - rz[i - 1]);
    caliRS[i] = s;
  }
  caliRouteLen = s;
}

function caliRouteSeg(s) {
  const n = caliRX.length;
  let lo = 0, hi = n - 1;
  s = clamp(s, 0, caliRouteLen);
  while (lo + 1 < hi) { const mid = (lo + hi) >> 1; if (caliRS[mid] <= s) lo = mid; else hi = mid; }
  const span = caliRS[hi] - caliRS[lo];
  caliSegOut.lo = lo; caliSegOut.hi = hi;
  caliSegOut.t = span > 1e-5 ? (s - caliRS[lo]) / span : 0;
  return caliSegOut;
}
const caliSegOut = { lo: 0, hi: 0, t: 0 };
function caliRouteXAt(s) { const i = caliRouteSeg(s); return lerp(caliRX[i.lo], caliRX[i.hi], i.t); }
function caliRouteZAt(s) { const i = caliRouteSeg(s); return lerp(caliRZ[i.lo], caliRZ[i.hi], i.t); }
function caliRouteYawAt(s) {
  const a = clamp(s - 2, 0, caliRouteLen), b = clamp(s + 2, 0, caliRouteLen);
  return Math.atan2(caliRouteXAt(b) - caliRouteXAt(a), caliRouteZAt(b) - caliRouteZAt(a));
}

const caliRouteOut = { x: 0, y: 0, z: 0, yaw: 0, grade: 0, curve: 0 };
/**
 * Where the road is at arclength `s`, and which way it is pointing.
 *
 * Heading and grade are both taken over a SIX METRE BASELINE rather than between
 * adjacent samples, because a bus is nine and a half metres long and does not
 * care about a two-metre pothole — that baseline is what makes her nose lift
 * onto the bridge ramp and settle again instead of twitching once per sample.
 */
function caliRouteAt(s) {
  const o = caliRouteOut;
  s = clamp(s, 0, caliRouteLen);
  const i = caliRouteSeg(s);
  o.x = lerp(caliRX[i.lo], caliRX[i.hi], i.t);
  o.z = lerp(caliRZ[i.lo], caliRZ[i.hi], i.t);
  o.y = caliRoadY(o.x, o.z);
  const sa = clamp(s - 3, 0, caliRouteLen), sb = clamp(s + 3, 0, caliRouteLen);
  const ax = caliRouteXAt(sa), az = caliRouteZAt(sa);
  const bx = caliRouteXAt(sb), bz = caliRouteZAt(sb);
  o.yaw = Math.atan2(bx - ax, bz - az);
  const base = Math.max(1e-3, Math.hypot(bx - ax, bz - az));
  o.grade = (caliRoadY(bx, bz) - caliRoadY(ax, az)) / base;
  let d = caliRouteYawAt(sb) - caliRouteYawAt(sa);
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  o.curve = d / base;                                  // signed, 1/m
  return o;
}

/**
 * The drawn ribbon. A strip of asphalt with a dashed line down the middle, five
 * centimetres over whatever caliRoadY says, so that the bus and the picture of
 * the road it drives on can never disagree.
 */
function caliBuildRoad(game, root) {
  const HW = 3.6;                        // half width: two lanes, barely
  const M = caliMerger();
  const asphalt = PALETTE.caliRoad, line = PALETTE.caliRoadLine, kerb = PALETTE.caliStoneDark;
  const n = caliRX.length;
  let pl = -1, pr = -1, pkl = -1, pkr = -1;
  for (let i = 0; i < n; i++) {
    const yaw = caliRouteYawAt(caliRS[i]);
    const nx = Math.cos(yaw), nz = -Math.sin(yaw);          // the road's left hand
    const x = caliRX[i], z = caliRZ[i], y = caliRY[i] + 0.05;
    const l = M.vert(x + nx * HW, y, z + nz * HW, asphalt);
    const r = M.vert(x - nx * HW, y, z - nz * HW, asphalt);
    // a shoulder that drops away, so the ribbon does not read as a decal
    const kl = M.vert(x + nx * (HW + 0.7), y - 0.24, z + nz * (HW + 0.7), kerb);
    const kr = M.vert(x - nx * (HW + 0.7), y - 0.24, z - nz * (HW + 0.7), kerb);
    // NOT OVER SAN ANTONIO. The painted street already has a surface — stone,
    // crowned, with gutters — and it is the best-looking thing at street level in
    // this chapter. Laying tarmac on it to show where a bus goes would be a
    // straight trade of the view for a diagram.
    const paved = caliStreetT(x, z) > 0.5 || caliMiradorT(x, z) > 0.5;
    if (i && !paved && caliStreetT(caliRX[i - 1], caliRZ[i - 1]) < 0.5
        && caliMiradorT(caliRX[i - 1], caliRZ[i - 1]) < 0.5) {
      M.tri(pl, pr, r); M.tri(pl, r, l);
      M.tri(pkl, l, pl); M.tri(pkl, kl, l);
      M.tri(pr, pkr, kr); M.tri(pr, kr, r);
    }
    pl = l; pr = r; pkl = kl; pkr = kr;

    // ---- AND WHERE THE ROAD LEAVES THE GROUND, IT HAS TO BE SOLID ---------
    // caliRoadY is not caliTerrain, and caliTerrain is what the biome publishes
    // as terrainHeight — so anywhere the two differ, the ribbon is drawn at one
    // height and the animal walks at the other. The Puente Ortiz approach is the
    // bad one: caliRoadY blends to the 1.03 m deck over |z| < 24 and the deck's
    // own collider stops at |z| = 13, so eleven metres of ramp on the main route
    // between the two halves of this chapter was tarmac drawn up to 64 cm over
    // the animal's head. Measured at (-6.6, -18.3): drawn 0.64, terrain 0, feet
    // 0. The bridge is the loud one; San Antonio's 16 cm of cobble and the
    // approach to the mirador are the same defect quieter.
    //
    // Emitted from the ribbon itself rather than written out per landmark, so a
    // road that is later routed over something else cannot acquire the bug
    // again — and only where it is actually needed, which on the flat is
    // nowhere, so the whole run costs a handful of boxes.
    const lift = y - caliTerrain(x, z);
    if (i && lift > 0.10) {
      const px = (x + caliRX[i - 1]) * 0.5, pz = (z + caliRZ[i - 1]) * 0.5;
      const dx = x - caliRX[i - 1], dz = z - caliRZ[i - 1];
      const seg = Math.hypot(dx, dz);
      if (seg > 0.01) {
        const top = (caliRY[i] + caliRY[i - 1]) * 0.5 + 0.05;
        const hy = 0.30;
        caliStaticBox(game, px, top - hy, pz, HW + 0.7, hy, seg * 0.5 + 0.15,
                      Math.atan2(dx, dz));
      }
    }
  }
  // the dashed centre line, laid on top as short slabs
  for (let s = 6; s < caliRouteLen - 6; s += 9) {
    const a = caliRouteAt(s);
    if (caliStreetT(a.x, a.z) > 0.5 || caliMiradorT(a.x, a.z) > 0.5) continue;
    M.box(a.x, a.y + 0.08, a.z, 0.22, 0.03, 3.4, line, 0, a.yaw, 0);
  }
  const m = new THREE.Mesh(M.build(), caliVC());
  m.receiveShadow = true;
  m.frustumCulled = false;
  root.add(m);
  caliRoadMesh = m;
}

// ============================================================== THE CARRETILLA ==
// THE MINI, and it solves a pacing problem as well as being one.
//
// The chiva takes ninety seconds to climb to the mirador and that climb IS the
// marquee — but what goes up has to come down, and coming down was a hundred and
// sixty metres of walking back along a road you have just watched go past. Every
// long chapter in this game that measures well has something at the far end that
// returns you (the caravan, the Star Ferry); Cali did not.
//
// So there is a fruit barrow parked on the terrace with a stone under its wheel.
// Kick the stone out and it rolls, and it rolls DOWN THE CHIVA'S OWN ROAD, which
// is the one route in the chapter already guaranteed to be a driveable surface
// all the way to the town — caliRouteAt() is the single authority and this reads
// it exactly as the bus does.
//
// TWO THINGS ARE NOT DECORATION. The speed cap is 9.5 m/s and not more, because
// the flank's hairpins turn on about an eight-metre radius and v squared over r
// at ten metres a second is already a third of a gravity sideways. And the tray
// has WALLS — you do not stand on this one, you sit in it among the mangoes,
// which is what actually keeps the passenger aboard through the second hairpin.
const caliCART_VMAX = 9.5;      // m/s, and see above
const caliCART_DRAG = 0.055;    // 1/m — quadratic, so she settles rather than diverging
// A barrow on tarmac is about 1.5% rolling resistance, which at this world's
// gravity is 0.36 m/s^2. The first cut used 1.15 and the barrow never moved at
// all: she is parked on a FLAT terrace and eighteen metres of flat at 1.15 eats
// every metre per second the kick can give her.
const caliCART_ROLL = 0.36;     // m/s^2 of rolling resistance and axle friction
const caliCART_KICK = 3.4;      // m/s the shove is worth — enough to cross the deck
const caliCART_GRAV = 24;       // the world's own g; this is a gravity ride
const caliCART_HX = 0.80, caliCART_HZ = 1.42;
const caliCART_TRAY = 0.70;     // m — the floor of the barrow
const caliCART_WALL = 0.78;     // m of crate side, which is what holds you in.
                                // 0.46 was not: the passenger went over the side
                                // on the first hairpin, measured, every run.
let caliCartGroup = null;
let caliCartBody = null;
let caliCartS = 0;              // arclength along the chiva's road
let caliCartV = 0;
let caliCartRolling = false;
let caliCartTopV = 0;
// s before a spent barrow is walked back up to the ridge. Long enough that the
// player sees it stop where it stopped; short enough to try again. See the
// stop branch in caliUpdateCart.
const caliCART_BACK = 5.0;
let caliCartBack = 0;
let caliCartDone = false;
let caliCartRattle = 0;
let caliCartPX = 0, caliCartPZ = 0, caliCartPY = 0;
const caliCartPos = new THREE.Vector3();
const caliCartTmp = new THREE.Vector3();
const caliCartQt = new THREE.Quaternion();
const caliCartEu = new THREE.Euler();

function caliBuildCart(game, root) {
  const M = caliMerger();
  const HX = caliCART_HX, HZ = caliCART_HZ;
  // the tray, and four crate walls. A barrow with sides is a barrow you can
  // put a capybara in.
  M.box(0, caliCART_TRAY - 0.06, 0, HX * 2, 0.12, HZ * 2, PALETTE.balconyWood);
  for (let s2 = -1; s2 <= 1; s2 += 2) {
    M.box(s2 * (HX - 0.05), caliCART_TRAY + caliCART_WALL * 0.5, 0,
          0.10, caliCART_WALL, HZ * 2, PALETTE.caliWall1);
    M.box(0, caliCART_TRAY + caliCART_WALL * 0.5, s2 * (HZ - 0.05),
          HX * 2, caliCART_WALL, 0.10, PALETTE.caliWall4);
  }
  // the fruit. Four crates of it, and it is what you are sitting in.
  for (let i = 0; i < 16; i++) {
    const a = i * 2.399963;
    const rx = Math.cos(a) * (HX - 0.22), rz = ((i * 7 % 13) / 13 - 0.5) * (HZ * 2 - 0.5);
    M.sph(rx, caliCART_TRAY + 0.16, rz, 0.13, 0.12, 0.13,
          i % 3 === 0 ? PALETTE.caliWall2 : i % 3 === 1 ? PALETTE.caliWall1 : PALETTE.caliGrass);
  }
  // two big spoked wheels and a pair of handles
  for (let s2 = -1; s2 <= 1; s2 += 2) {
    M.cyl(s2 * (HX + 0.10), 0.42, -0.15, 0.42, 0.10, PALETTE.balconyWood, 0, 0, Math.PI / 2, 8);
    M.cyl(s2 * (HX + 0.10), 0.42, -0.15, 0.10, 0.16, PALETTE.caliGrille, 0, 0, Math.PI / 2, 6);
    M.box(s2 * (HX - 0.10), 0.80, HZ + 0.52, 0.09, 0.09, 1.10, PALETTE.balconyWood, 0.16, 0, 0);
  }
  M.box(0, 0.52, 0, HX * 2 - 0.20, 0.14, HZ * 2 - 0.30, PALETTE.balconyWood);
  const mesh = new THREE.Mesh(M.build(), caliVC());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  caliCartGroup = new THREE.Group();
  caliCartGroup.name = 'caliCarretilla';
  caliCartGroup.add(mesh);
  root.add(caliCartGroup);

  const b = new CANNON.Body({
    mass: 0, type: CANNON.Body.KINEMATIC,
    material: game.mats ? game.mats.ground : undefined,
  });
  b.addShape(new CANNON.Box(new CANNON.Vec3(HX, caliCART_TRAY * 0.5, HZ)),
             new CANNON.Vec3(0, caliCART_TRAY * 0.5, 0));
  for (let s2 = -1; s2 <= 1; s2 += 2) {
    b.addShape(new CANNON.Box(new CANNON.Vec3(0.06, caliCART_WALL * 0.5, HZ)),
               new CANNON.Vec3(s2 * (HX - 0.05), caliCART_TRAY + caliCART_WALL * 0.5, 0));
    b.addShape(new CANNON.Box(new CANNON.Vec3(HX, caliCART_WALL * 0.5, 0.06)),
               new CANNON.Vec3(0, caliCART_TRAY + caliCART_WALL * 0.5, s2 * (HZ - 0.05)));
  }
  b.allowSleep = false;
  game.world.addBody(b);
  caliCartBody = b;
  caliCartReset();
}

/**
 * Park her chocked at the TOP OF THE DESCENT, found rather than guessed.
 *
 * The obvious placement — a fixed few metres back from where the bus parks —
 * put her in the middle of an eighteen-metre FLAT terrace, where the whole of
 * the shove is eaten by rolling resistance before the road starts to fall. She
 * moved four and a half metres and stopped, every time. So walk back down the
 * road from the parking spot until the grade genuinely tips over, and stand her
 * three metres above that: on the lip, which is where a chocked barrow belongs.
 */
function caliCartReset() {
  let s0 = Math.max(0, caliRouteLen - 3);
  for (let ss = caliRouteLen - 3; ss > 8; ss -= 1) {
    if (caliRouteAt(ss).grade > 0.035) { s0 = Math.min(caliRouteLen - 3, ss + 3); break; }
  }
  caliCartS = s0;
  caliCartV = 0;
  caliCartRolling = false;
  caliCartTopV = 0;
  const a = caliRouteAt(caliCartS);
  caliCartPX = a.x; caliCartPZ = a.z; caliCartPY = a.y;
  caliCartPos.set(a.x, a.y, a.z);
  if (caliCartBody) {
    caliCartBody.position.set(a.x, a.y, a.z);
    caliCartBody.quaternion.setFromEuler(0, a.yaw + Math.PI, 0);
    caliCartBody.previousPosition.copy(caliCartBody.position);
    caliCartBody.interpolatedPosition.copy(caliCartBody.position);
    caliCartBody.previousQuaternion.copy(caliCartBody.quaternion);
    caliCartBody.interpolatedQuaternion.copy(caliCartBody.quaternion);
    caliCartBody.velocity.setZero();
  }
  if (caliCartGroup) {
    caliCartGroup.position.copy(caliCartPos);
    caliCartGroup.quaternion.copy(caliCartBody ? caliCartBody.quaternion : caliCartGroup.quaternion);
  }
}

/** True when the capybara is IN the barrow. */
function caliInCart(p) {
  const b = caliCartBody;
  if (!b || !p) return false;
  caliCartTmp.set(p.x - b.position.x, p.y - b.position.y, p.z - b.position.z);
  caliCartQt.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w).invert();
  caliCartTmp.applyQuaternion(caliCartQt);
  return Math.abs(caliCartTmp.x) < caliCART_HX + 0.35 && Math.abs(caliCartTmp.z) < caliCART_HZ + 0.35 &&
         caliCartTmp.y > caliCART_TRAY - 0.55 && caliCartTmp.y < caliCART_TRAY + 1.9;
}

function caliUpdateCart(game, dt) {
  const b = caliCartBody;
  if (!b || dt <= 0 || !caliRouteLen) { if (b) b.velocity.setZero(); return; }
  const capy = game.capy;
  const cp = capy && capy.position;
  const aboard = caliInCart(cp);

  // ---- ...and here is the walk back up. See the note in the stop branch. ---
  // It will not do it while the animal is standing in it: yanking the barrow
  // out from under a passenger is a teleport with somebody on board, which is
  // the one thing the carrier rules in CONTRACT.md forbid outright.
  if (caliCartBack > 0) {
    if (aboard) { caliCartBack = caliCART_BACK; }
    else {
      caliCartBack -= dt;
      if (caliCartBack <= 0) {
        caliCartReset();
        if (game.sfx) game.sfx('thud', { volume: 0.28, pitch: 1.15,
                                         at: { x: caliCartPos.x, y: caliCartPos.y + 0.5, z: caliCartPos.z } });
      }
    }
  }

  // ---- kick the chock out -------------------------------------------------
  if (!caliCartRolling && game.input && game.input.actionPressed && cp) {
    const dx = cp.x - caliCartPos.x, dz = cp.z - caliCartPos.z;
    if (dx * dx + dz * dz < 3.4 * 3.4) {
      caliCartRolling = true;
      caliCartV = caliCART_KICK;
      if (game.sfx) game.sfx('thud', { volume: 0.7, pitch: 1.3 });
      if (game.toast) game.toast('get in.');
    }
  }

  if (caliCartRolling) {
    const here = caliRouteAt(caliCartS);
    // A GRAVITY RIDE. grade is dy/ds along INCREASING s and s climbs toward
    // the mirador, so the barrow — which runs toward decreasing s — accelerates
    // at +g*grade, and is held back by rolling resistance and by a quadratic
    // drag that gives it a terminal speed rather than a divergent one.
    const acc = here.grade * caliCART_GRAV - caliCART_ROLL
              - caliCART_DRAG * caliCartV * Math.abs(caliCartV);
    caliCartV = clamp(caliCartV + acc * dt, 0, caliCART_VMAX);
    caliCartS -= caliCartV * dt;
    if (caliCartV > caliCartTopV) caliCartTopV = caliCartV;
    // the run's own top speed, on the paper, while the barrow is moving — and
    // only if you are ON it, because a barrow that went without you is a joke
    // and not an attempt (v32)
    if (aboard && game.recordLive) game.recordLive('cart-run', caliCartTopV);
    if (caliCartS <= 0.5) { caliCartS = 0.5; caliCartV = 0; }
    // rolled to a stop on the flat, or ran out of road
    // She has stopped. Either she made it down — or she never really got going,
    // in which case say nothing, put the chock back, and let it be tried again.
    if (caliCartV <= 0.02) {
      caliCartRolling = false;
      // ---- SOMEBODY PUSHES IT BACK UP (v20) -----------------------------
      //
      // THE CHAPTER'S MINI COULD BE SPENT IN THREE SECONDS AND NEVER COME BACK.
      // The comment above says a barrow that never got going has "the chock put
      // back and can be tried again", and it was not true of the position: this
      // branch cleared the flags and left the barrow wherever it had rolled to.
      // And the far worse case is the ordinary one — the toast literally says
      // "get in." AFTER the chock is out, so the first thing most players do is
      // watch it leave without them. caliCartReset() is called from exactly one
      // place in this file and that place is the build, so from that moment
      // 'Run the fruit barrow off the ridge' was uncompletable for the life of
      // the page and the hint arrow pointed at a barrow parked at the bottom of
      // a hill it cannot climb.
      //
      // So it goes back. Not instantly — that is a teleport and it reads as a
      // bug — but after a beat, which is how long it takes a chontaduro seller
      // to walk down the road swearing and push it back up. The task keeps its
      // tick either way; what comes back is the OBJECT.
      if (caliCartTopV <= 4) { caliCartTopV = 0; caliCartBack = caliCART_BACK; return; }
      if (game.sfx) game.sfx('thud', { volume: 0.5, pitch: 0.8 });
      // ---- THE RUN IS FILED EVERY TIME, THE TICK ONLY ONCE (v32) --------
      // `!caliCartDone && aboard` meant the barrow's top speed was banked on
      // the first successful run and never again, so `cart-run` — a
      // `better: 'higher'` record on the one gravity ride in the chapter —
      // could not be improved by pushing the barrow back up and taking a
      // straighter line, which is the entire replay loop the push-back-up
      // above exists to enable.
      if (aboard && game.record) game.record('cart-run', caliCartTopV);
      if (!caliCartDone && aboard) {
        caliCartDone = true;
        caliTask('cart-run');
        // AND THE RUN HAD NO NUMBER ON IT. A gravity ride whose whole content
        // is how fast it got is worth saying out loud.
        if (game.toast) game.toast(Math.round(caliCartTopV * 3.6) + ' km/h in a fruit barrow');
      } else if (!caliCartDone) {
        // it went without you, which is the joke and should be said as one
        if (game.toast) game.toast(aboard ? 'it stopped. that is a hill, not a road.'
                                          : 'it went without you. it is very good at that.');
      }
      caliCartBack = caliCART_BACK;
    }
  }

  const a = caliRouteAt(caliCartS);
  // ---- WRITING position ON A CARRIER THROWS THE PASSENGER OFF ------------
  // This is the same rule the ferry, the van and the carroza are on and it was
  // the whole bug: a kinematic body whose position is ASSIGNED every frame is a
  // body cannon never integrates, so the contact under the capybara is remade
  // from scratch each step and there is no relative velocity for friction to
  // act on. Set velocity and yaw RATE and let the solver move it. Measured, the
  // passenger left the barrow on the first corner, every run.
  //
  // The pitch and the bank go on the MESH only. Rate-integrating three axes to
  // hold a body on a switchback is a lot of machinery to make a collision box
  // 8 degrees out of level, and the box is what the passenger stands in.
  b.velocity.set(clamp((a.x - caliCartPX) / dt, -20, 20),
                 clamp((a.y - caliCartPY) / dt, -20, 20),
                 clamp((a.z - caliCartPZ) / dt, -20, 20));
  caliCartPX = a.x; caliCartPY = a.y; caliCartPZ = a.z;
  const tyaw = a.yaw + Math.PI;
  caliCartEu.setFromQuaternion(caliCartQt.set(b.quaternion.x, b.quaternion.y,
                                              b.quaternion.z, b.quaternion.w), 'YXZ');
  let dy = tyaw - caliCartEu.y;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  b.angularVelocity.set(0, clamp(dy / dt, -3.2, 3.2), 0);
  caliCartGroup.position.copy(b.interpolatedPosition);
  caliEu.set(-Math.atan(a.grade), tyaw,
             clamp(-a.curve * caliCartV * caliCartV * 0.020, -0.14, 0.14), 'YXZ');
  caliQ.setFromEuler(caliEu);
  caliCartGroup.quaternion.copy(caliQ);
  caliCartPos.copy(caliCartGroup.position);

  // the noise, and the shake — both proportional to how fast this has got
  if (caliCartV > 1 && aboard) {
    caliCartRattle -= dt;
    if (caliCartRattle <= 0) {
      caliCartRattle = 0.42 - clamp(caliCartV / caliCART_VMAX, 0, 1) * 0.24;
      if (game.sfx) game.sfx('rustle', { volume: 0.35 + caliCartV * 0.035, pitch: 0.8 + caliCartV * 0.05 });
    }
    if (game.shake) game.shake(0.012 + caliCartV * 0.004);
  }
}

// ================================================================= THE WIRES ==
const caliWIRE_LINES = [
  'the band saw it coming',
  'that one was at head height for a reason',
  'clothesline. literally.',
  'the chiva does not stop. the chiva collects.',
];

/**
 * Seven of them, over the town half of the route.
 *
 * The hit test is analytic and never touches the solver. Each wire keeps the
 * SIGNED DISTANCE from the capybara to its vertical plane; a hit is a sign
 * change while the animal's body straddles the cable's height. That is exact, it
 * is four multiplies, and — unlike a thin collider — it cannot be tunnelled
 * through at seven metres a second, which is precisely the speed this happens at.
 */
function caliBuildWires(game, root) {
  caliWires = [];
  const M = caliMerger();
  for (let i = 0; i < caliWIRE_AT.length; i++) {
    const s = caliWIRE_AT[i] * caliRouteLen;
    const a = caliRouteAt(s);
    const nx = Math.cos(a.yaw), nz = -Math.sin(a.yaw);      // across the road
    const SPAN = 6.2;
    const y = a.y + caliWIRE_Y;
    const x0 = a.x + nx * SPAN, z0 = a.z + nz * SPAN;
    const x1 = a.x - nx * SPAN, z1 = a.z - nz * SPAN;
    caliWires.push({ s: s, x: a.x, z: a.z, dx: Math.sin(a.yaw), dz: Math.cos(a.yaw), y: y,
                     prev: 0, has: false, hit: 0 });
    // the two poles, leaning the way tired poles lean
    for (let e = -1; e <= 1; e += 2) {
      const px = a.x + nx * SPAN * e, pz = a.z + nz * SPAN * e;
      const py = caliRoadY(px, pz);
      M.cyl(px, py + 3.3, pz, 0.17, 6.6, PALETTE.caliCable, 0, 0, e * 0.035, 6);
      M.box(px, py + 5.9, pz, 1.5, 0.12, 0.12, PALETTE.caliCable, 0, a.yaw, 0);
      if (e > 0) M.cyl(px + nx * 0.5, py + 5.2, pz + nz * 0.5, 0.30, 0.7, PALETTE.caliStoneDark, 0, 0, 0, 6);
    }
    // the cable itself: a six-segment catenary sagging to caliWIRE_Y, plus two
    // slacker companions above it, because it is never one cable
    const TOP0 = a.y + caliWIRE_Y + 1.42;
    for (let c = 0; c < 3; c++) {
      const top = TOP0 + c * 0.30;
      const sag = c === 0 ? (top - y) : (top - y) * 0.62;
      let px = x0, pz = z0, py = top;
      for (let k = 1; k <= 6; k++) {
        const u = k / 6;
        const qx = lerp(x0, x1, u), qz = lerp(z0, z1, u);
        const qy = top - sag * (1 - Math.pow(2 * u - 1, 2));
        const flat = Math.hypot(qx - px, qz - pz);
        const len = Math.hypot(flat, qy - py);
        M.box((px + qx) * 0.5, (py + qy) * 0.5, (pz + qz) * 0.5, 0.075, 0.075, len,
              PALETTE.caliCable, -Math.atan2(qy - py, flat), a.yaw + Math.PI / 2, 0);
        px = qx; pz = qz; py = qy;
      }
    }
    // AND THE THING THAT MAKES YOU LOOK AT IT. A cable at four and a half metres
    // against a dark street is two pixels wide; a row of little triangular flags,
    // or somebody's washing, is not. This is the whole of the telegraphing, and
    // it is why the wires are readable at all at seven metres a second.
    const kind = i % 3;
    for (let k = -3; k <= 3; k++) {
      const u = (k + 3) / 6;
      const qx = lerp(x0, x1, u), qz = lerp(z0, z1, u);
      const qy = TOP0 - (TOP0 - y) * (1 - Math.pow(2 * u - 1, 2));
      if (kind === 0) {
        const cols = [PALETTE.caliChiva, PALETTE.caliChivaTrim, PALETTE.caliChivaBlue, PALETTE.caliChivaGrn];
        M.cone(qx, qy - 0.36, qz, 0.20, 0.62, cols[(k + 3) % 4], Math.PI, a.yaw, 0, 4);
      } else if (kind === 1) {
        const cols = [PALETTE.caliWall4, PALETTE.caliWall3, PALETTE.caliWall5, PALETTE.caliWall1];
        M.box(qx, qy - 0.46, qz, 0.62, 0.86, 0.05, cols[(k + 3) % 4], 0, a.yaw, 0);
      } else if (Math.abs(k) === 2) {
        // the pair of shoes somebody threw up there years ago
        M.box(qx, qy - 0.54, qz, 0.16, 0.16, 0.40, PALETTE.caliGrille, 0, a.yaw, 0);
      }
    }
    // poles are solid, so that a capybara that has been swept off can walk into one
    for (let e = -1; e <= 1; e += 2) {
      const px = a.x + nx * SPAN * e, pz = a.z + nz * SPAN * e;
      caliStaticBox(game, px, caliRoadY(px, pz) + 3.3, pz, 0.2, 3.3, 0.2, 0);
    }
  }
  const m = new THREE.Mesh(M.build(), caliVC());
  m.castShadow = true;
  m.frustumCulled = false;
  root.add(m);
  caliWireMesh = m;
}

/** Taken off the roof by a cable, at speed, in front of a band. */
function caliWireSweep(game, w) {
  const capy = game.capy;
  if (!capy || !capy.body) return;
  w.hit = 1.5;
  caliOnRoof = false;
  caliRoofT = 0;
  caliSweptT = caliWIRE_OFF;
  // BACKWARDS ALONG THE BUS, AND UP — she is scooped off, not shoved sideways.
  //
  // Through capy.launch and not by writing the velocity, because writing the
  // velocity on a moving platform does NOTHING: the controller solves in the
  // roof's frame and its grip damper is 60, so a frame later the throw is gone
  // and the animal has hopped politely on the spot. launch() clears the frame,
  // lifts her off the contact and holds her un-grounded for a fifth of a second,
  // which is the difference between a mechanic and a shrug.
  //
  // Expressed RELATIVE TO THE BUS and then converted, because that is the frame
  // the mechanic lives in: the truthful answer for being clotheslined is that
  // you stop and the bus keeps going, so the relative speed has to be the bus's
  // own plus enough to clear four and three quarter metres of roof behind you
  // before the arc lands. Written as a world velocity it read fine at a walking
  // pace and dropped you neatly back onto the luggage rack at seven.
  const rel = caliChivaV + 5.5;
  const away = caliChivaV - rel;                 // = -5.5: backwards down the road
  capy.launch(Math.sin(caliChivaYaw) * away + rand(-1.4, 1.4), 6.4,
              Math.cos(caliChivaYaw) * away + rand(-1.4, 1.4));
  capy.body.angularVelocity.set(rand(-4, 4), rand(-6, 6), rand(-4, 4));
  caliBurstSparks(w.x, w.y, w.z, 10, 0.4);
  if (typeof game.shake === 'function') game.shake(0.30);
  if (typeof game.sfx === 'function') {
    game.sfx('thud', { volume: 0.9 });
    game.sfx('wheek', { pitch: 1.25, volume: 0.8 });
  }
  if (typeof game.toast === 'function') game.toast(caliWIRE_LINES[randInt(0, caliWIRE_LINES.length - 1)]);
}

/**
 * Did a cable just take the capybara off the roof? And, a second earlier, does
 * the band know one is coming?
 */
function caliCheckWires(game, dt) {
  if (!caliWires) return;
  const capy = game.capy;
  const p = capy && capy.position;
  const rolling = caliChivaState === 'rolling';
  let duckWant = 0;
  for (let i = 0; i < caliWires.length; i++) {
    const w = caliWires[i];
    if (w.hit > 0) w.hit -= dt;
    if (rolling) {
      // The BAND DUCKS FIRST. They are 3 m forward of the middle of the roof and
      // they have done this route every night for years, so they go down about a
      // second out. It is the only tutorial the mechanic gets and it is enough.
      const lead = (w.s - caliChivaS - 3.2) / Math.max(1.5, caliChivaV);
      if (lead > -0.35 && lead < caliWIRE_WARN) duckWant = 1;
    }
    // A WIRE IS A SEGMENT, NOT A PLANE, AND IT IS ONLY THERE WHEN YOU ARE.
    //
    // Both of these gates are load-bearing and the first version had neither.
    // The route doubles back on itself twice: the painted street runs west at
    // z = 41 and the riverside runs east at z = 22, so a cable strung across the
    // riverside has an INFINITE PLANE that the bus crosses twenty metres away on
    // a completely different street, at exactly the same height. Measured: the
    // fourth wire took the animal off the roof on the first straight, half a
    // minute before you could see it. The arclength gate is the honest
    // statement of the mechanic — a cable can only have you while the bus is
    // passing under it — and the span gate keeps it a twelve-metre object.
    if (Math.abs(w.s - caliChivaS) > 14) { w.has = false; continue; }
    if (!rolling || !p || !caliOnRoof) { w.has = false; continue; }
    const d = (p.x - w.x) * w.dx + (p.z - w.z) * w.dz;
    const lat = (p.x - w.x) * -w.dz + (p.z - w.z) * w.dx;
    if (Math.abs(lat) > 7) { w.has = false; continue; }
    if (!w.has) { w.has = true; w.prev = d; continue; }
    const crossed = (w.prev < 0 && d >= 0) || (w.prev > 0 && d <= 0);
    w.prev = d;
    if (!crossed || w.hit > 0) continue;
    const dy = w.y - p.y;
    if (dy < caliWIRE_BAND[0] || dy > caliWIRE_BAND[1]) {
      // ---- AND CLEARING ONE WAS WORTH NOTHING AT ALL (v20) --------------
      // Seven cables over four hundred and sixty-five metres, and the ONLY
      // thing the mechanic could ever do to you was take you off the roof.
      // A skill test that has a punishment and no reward is a hazard, not a
      // game — the player who reads the band's duck and gets under it in time
      // got precisely the same silence as the player who was not looking.
      //
      // So a clean one answers: the cable whips overhead, and the tally is
      // spoken at the end of the ride rather than per wire, because seven
      // toasts in forty seconds is a notification feed.
      caliWireClear++;
      w.hit = 1.4;                      // the same latch a strike uses: once per pass
      if (game.sfx) {
        game.sfx('hiss', { volume: clamp(0.16 + caliChivaV * 0.02, 0.16, 0.34),
                           pitch: 1.5 + Math.min(caliWireClear, 7) * 0.08,
                           at: { x: w.x, y: w.y, z: w.z } });
      }
      if (caliWireClear === 3 && game.toast) game.toast('three. the band has stopped watching you.');
      continue;
    }
    caliWireSweep(game, w);
  }
  caliBandDuck = duckWant ? Math.min(1, caliBandDuck + dt * 9) : damp(caliBandDuck, 0, 6, dt);
}

// =============================================================== THE MIRADOR ==
/**
 * A terrace cut into a 60% flank, forty metres below Cristo Rey, with the whole
 * valley over the wall.
 *
 * The parapet is HALF A METRE of stone with iron railings above it, and that is
 * a framing decision before it is a period one. A solid 1.1 m wall is exactly
 * the wrong height for this camera: 9.5 m back and 41 degrees down, it fills the
 * lower third of the frame and hides the city, which is the only thing anybody
 * has climbed up here to look at. You can see through railings, and a capybara
 * can stand on the stone.
 */
function caliBuildMirador(game, root) {
  const M = caliMerger();
  const cx = caliMIRADOR.x, cz = caliMIRADOR.z, yaw = caliMIR_YAW, D = caliMIR_DECK;
  const HX = caliMIR_HX, HZ = caliMIR_HZ;
  const ox = Math.sin(yaw), oz = Math.cos(yaw);            // outward, over the valley
  const ax = Math.cos(yaw), az = -Math.sin(yaw);           // along the contour
  M.box(cx, D - 0.25, cz, HX * 2, 0.5, HZ * 2, PALETTE.caliMirador, 0, yaw, 0);
  // the retaining wall under the downhill lip, stepping down the flank
  for (let k = 0; k < 5; k++) {
    const t = k / 5;
    M.box(cx + ox * (HZ - 0.2 - t * 0.9), D - 0.9 - k * 1.05, cz + oz * (HZ - 0.2 - t * 0.9),
          HX * 2 - k * 1.1, 1.1, 1.2, k % 2 ? PALETTE.caliStone : PALETTE.caliStoneDark, 0, yaw, 0);
  }
  // the parapet: knee-high stone, and railings you can see the city through
  M.box(cx + ox * HZ, D + 0.26, cz + oz * HZ, HX * 2, 0.52, 0.44, PALETTE.caliStone, 0, yaw, 0);
  for (let k = -8; k <= 8; k++) {
    M.cyl(cx + ox * HZ + ax * k * 1.05, D + 0.94, cz + oz * HZ + az * k * 1.05,
          0.045, 0.86, PALETTE.caliGrille, 0, 0, 0, 4);
  }
  M.box(cx + ox * HZ, D + 1.38, cz + oz * HZ, HX * 2, 0.10, 0.14, PALETTE.caliGrille, 0, yaw, 0);
  // the two lamp standards, which are most of the reason the terrace reads at
  // all once it is dark. Their GLASS is a separate mesh with its own emissive
  // material — the Drift's idiom, and the right one: this game has three lights
  // in it and no local ones, so a lamp is a thing that is bright rather than a
  // thing that brightens, and the pool it throws is painted, not computed.
  const L = caliMerger();      // the glass: bright, and small
  const P = caliMerger();      // the pool it throws: faint, and wide
  for (let i = -1; i <= 1; i += 2) {
    const px = cx + ax * i * 6.2 + ox * (HZ - 1.6);
    const pz = cz + az * i * 6.2 + oz * (HZ - 1.6);
    M.cyl(px, D + 1.9, pz, 0.10, 3.8, PALETTE.caliGrille, 0, 0, 0, 6);
    M.box(px, D + 4.06, pz, 0.74, 0.16, 0.74, PALETTE.caliGrille);
    L.box(px, D + 3.76, pz, 0.54, 0.44, 0.54, PALETTE.caliCityLite);
    // The pool on the flags. THESE HAVE TO BE ALMOST NOTHING. At full emissive
    // and full opacity two of them read as white paint spilt on the terrace —
    // brighter than the city they are supposed to be a foreground for — so the
    // glass keeps the emissive and the pool is a thin warm wash with none.
    P.cyl(px, D + 0.035, pz, 3.1, 0.02, PALETTE.caliCityLite, 0, 0, 0, 8);
    P.cyl(px, D + 0.045, pz, 1.7, 0.02, PALETTE.caliCityLite, 0, 0, 0, 8);
  }
  const lampMesh = new THREE.Mesh(L.build(), mat(0x000000, {
    vertexColors: true, emissive: 0xffffff,
  }).clone());
  lampMesh.material.emissiveIntensity = 0;
  lampMesh.frustumCulled = false;
  lampMesh.visible = false;
  root.add(lampMesh);
  const poolMesh = new THREE.Mesh(P.build(), mat(0x000000, {
    vertexColors: true, transparent: true, opacity: 0.14, depthWrite: false,
  }).clone());
  poolMesh.frustumCulled = false;
  poolMesh.visible = false;
  root.add(poolMesh);
  caliMiradorGlow = lampMesh;
  caliMiradorPool = poolMesh;
  // a bench, and the tiled sign that names the mountains you are looking at
  M.box(cx + ax * 3.4 - ox * 2.4, D + 0.42, cz + az * 3.4 - oz * 2.4, 3.0, 0.16, 0.7,
        PALETTE.caliChivaTrim, 0, yaw, 0);
  for (let s = -1; s <= 1; s += 2) {
    M.box(cx + ax * (3.4 + s * 1.2) - ox * 2.4, D + 0.2, cz + az * (3.4 + s * 1.2) - oz * 2.4,
          0.2, 0.44, 0.6, PALETTE.caliStoneDark, 0, yaw, 0);
  }
  M.box(cx - ax * 6.6 + ox * (HZ - 1.1), D + 0.80, cz - az * 6.6 + oz * (HZ - 1.1),
        1.9, 0.9, 0.10, PALETTE.caliWall3, -0.55, yaw, 0);
  const m = new THREE.Mesh(M.build(), caliVC());
  m.castShadow = true;
  m.receiveShadow = true;
  root.add(m);

  // the deck's collider, and a kerb so a bus cannot roll off the front
  caliStaticBox(game, cx, D - 0.25, cz, HX, 0.25, HZ, yaw);
  caliStaticBox(game, cx + ox * HZ, D + 0.26, cz + oz * HZ, HX, 0.26, 0.22, yaw);
}

// ============================================================= THE CITY, LIT ==
/**
 * Nine hundred and forty windows.
 *
 * The mirador exists to be looked out of, and in daylight what it looks at is a
 * set of pale boxes 120 m away that the haze is already eating. At night it is
 * this, and this is cheap: two instanced meshes of small cubes whose emissive is
 * driven straight off caliNight(). They are `visible = false` until night 0.02,
 * so they cost exactly nothing until the chiva has done its job.
 *
 * Half of them are outside the playable world on purpose. Cali is two and a half
 * million people and the part of it you can walk on is two hundred metres
 * across; the far field is what stops the view ending where the collision does.
 */
function caliBuildCityLights(root) {
  const warm = [], cool = [];
  let seed = 20250819;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const push = (l, x, y, z, s) => caliPush9(l, x, y, z, 0, 0, 0, s, s, s);
  // ---- NEAR: ON THE BUILDINGS, NEVER IN THE AIR --------------------------
  // The first pass scattered these at random over the town rectangle, which is
  // fine from a mirador a hundred and twenty metres up and absurd from the
  // pavement: half of them hung in the middle of the street at head height like
  // ice cubes. Anything the player can walk past has to be ON something, so the
  // near field is authored from the same formula San Antonio's houses are.
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 9; i++) {
      const hx = -44 + i * 11 + (side > 0 ? 4 : 0);
      const hz = caliSTREET_Z + side * 11;
      const y0 = caliTerrain(hx, hz);
      // the two windows and the open door, on the street face
      const fz = hz - side * 4.5;
      if (rnd() < 0.78) push(warm, hx - 2.0, y0 + 1.5, fz, 0.34);       // the doorway
      for (let k = 0; k < 2; k++) {
        if (rnd() > 0.62) continue;
        push(rnd() < 0.8 ? warm : cool, hx + 1.0 + k * 2.4, y0 + 2.1, fz, 0.40);
      }
      // and a light in the back room, over the eaves line
      if (rnd() < 0.5) push(warm, hx + rand(-3, 3), y0 + rand(5.4, 6.6), hz + side * rand(-3, 3), 0.34);
    }
  }
  // the lamps along both embankments, which is what actually lights the river
  for (let x = -66; x <= 66; x += 11) {
    for (let s = -1; s <= 1; s += 2) {
      if (Math.abs(x - caliBRIDGE_X) < 8) continue;
      const z = caliRIVER_Z + s * (caliRIVER_HZ + 4.6);
      push(warm, x, caliTerrain(x, z) + 4.4, z, 0.42);
    }
  }
  // La Ermita is floodlit, because it is the prettiest building in the city and
  // everybody who has ever been there has photographed it after dark
  for (let k = 0; k < 7; k++) {
    const a = k / 7 * Math.PI * 2;
    push(cool, caliERMITA.x + Math.cos(a) * 5.5, caliTerrain(caliERMITA.x, caliERMITA.z) + 2.2 + (k % 3) * 3.4,
         caliERMITA.z + Math.sin(a) * 5.5, 0.44);
  }
  // ---- FAR: the two and a half million people you cannot walk to ----------
  for (let i = 0; i < 520; i++) {
    const x = lerp(-40, 210, rnd()), z = lerp(-190, 145, rnd());
    if (x < 62 && z > -40 && z < 76) continue;                       // that is the cane, and it is dark
    if (x > -74 && x < 74 && z > -40 && z < 80) continue;            // and that is the walkable city, above
    const y = caliTerrain(x, z) + lerp(1.0, 9.0, rnd() * rnd());
    if (y > 22) continue;                                            // nobody lives up the ridge
    push(rnd() < 0.72 ? warm : cool, x, y, z, lerp(0.40, 0.95, rnd()));
  }
  caliCityMat = [];
  caliCityLights = [];
  const mk = (list, color) => {
    const im = caliInstance(root, caliG.box, color, list, false, false);
    if (!im) return;
    // mat() caches by colour, and a mutated shared material is how Iceland's
    // aurora once tinted this river. Clone before touching emissiveIntensity.
    const m = im.material.clone();
    m.emissive = new THREE.Color(color);
    m.emissiveIntensity = 0;
    im.material = m;
    im.frustumCulled = false;
    im.visible = false;
    caliCityMat.push(m);
    caliCityLights.push(im);
  };
  mk(warm, PALETTE.caliCityLite);
  mk(cool, PALETTE.caliCityCool);
}

// ==================================================================== THE RIDE ==
/** Is the capybara stood on the luggage rack right now? */
function caliRoofCheck(game) {
  const capy = game.capy;
  if (!capy || !capy.position || !caliChivaGroup) return false;
  const p = capy.position;
  const dx = p.x - caliChivaX, dz = p.z - caliChivaZ;
  // CHIVA-LOCAL. Local +z is the way she is pointing, (sin yaw, cos yaw), and
  // local +x is (cos yaw, -sin yaw); inverting an orthonormal pair is its
  // transpose, so this is cos(yaw)/sin(yaw) and NOT cos(-yaw)/sin(-yaw). The
  // minus-yaw form is a reflection, not a rotation: it silently swaps which
  // tolerance guards which axis, so the test was 5.3 m wide and 2.3 m long on a
  // bus that is 3.6 m wide and 9.5 m long. Symptom: the animal slid off the side
  // and the game went on believing it was aboard.
  const c = Math.cos(caliChivaYaw), s = Math.sin(caliChivaYaw);
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  if (Math.abs(lx) > caliCHIVA_W * 0.5 + 0.9) return false;
  if (Math.abs(lz) > caliCHIVA_L * 0.5 + 0.6) return false;
  const dy = p.y - (caliChivaY + caliROOF_TOP);
  // THE CEILING HAS TO CLEAR A HOP, and the first number here did not.
  // Standing puts the animal 0.32 above the rack; a held hop is 1.5 m, which
  // took it to 1.82 and out of a 1.8 ceiling — so for a third of a second in
  // the middle of every successful jump the game believed it was not on the bus.
  // That switched the cable test off exactly when it mattered (hop early, come
  // down in front of the wire, and nothing happened), and it made the HUD flicker.
  return dy > -0.20 && dy < 2.6;
}

/**
 * ONE FRAME OF THE BUS.
 *
 * The whole set piece lives in here: parked, rolling, two stops, and the
 * mirador. Everything it does to the world it does through the ferry's contract
 * — a KINEMATIC body moved by hand with an honest velocity written on it, so
 * that capybara.js solves the passenger in the deck's frame of reference and she
 * rides without any friction being involved at all.
 */
function caliStepChiva(game, dt) {
  if (!caliChivaBody || !caliRX) return;
  if (caliSweptT > 0) caliSweptT -= dt;
  caliOnRoof = caliSweptT <= 0 && caliRoofCheck(game);

  // ---- D4.15: AND SHE GOES BACK DOWN --------------------------------------
  //
  // `arrived` was TERMINAL. A chiva that reaches the mirador stayed at the
  // mirador for the rest of the visit, which means the chapter's best set
  // piece — four hundred and sixty-five metres of climb with seven cables to
  // hop on the way — could be ridden exactly ONCE per visit, and the seven-of-
  // seven tally it scores you on could be attempted exactly once. A verb you
  // may practise once is not a verb, it is a cutscene with a score attached.
  //
  // She waits at the top for `caliCHIVA_TURN` with nobody on her, and then she
  // deadheads back down. Empty, at `caliCHIVA_DOWN_K` times her climbing
  // speed, because a chiva coming down a hill in low gear with no passengers
  // is faster than one grinding up it with fourteen — and because the return
  // leg is not the set piece and should not take another forty seconds of
  // anybody's evening.
  //
  // NOBODY ON HER, which is what makes this safe. If the animal is on the roof
  // the clock does not run at all: a bus that pulls away from under you as a
  // reward for reaching the top would be a punishment for winning.
  if (caliChivaState === 'arrived') {
    if (caliOnRoof) caliTurnT = 0;
    else caliTurnT += dt;
    if (caliTurnT > caliCHIVA_TURN) {
      caliChivaState = 'returning';
      caliTurnT = 0;
      caliHornT = 1.4;
      if (typeof game.sfx === 'function') game.sfx('horn', { pitch: 0.8, volume: 0.6 });
    }
  } else if (caliChivaState === 'returning') {
    // straight back down the same polyline. No stops: the four 5 s halts are
    // for picking people up and there is nobody at the top to pick up.
    caliChivaV = caliCHIVA_V0 * caliCHIVA_DOWN_K;
    caliChivaS -= caliChivaV * dt;
    if (caliChivaS <= 0.05) {
      caliChivaS = 0;
      caliChivaV = 0;
      caliChivaReset();          // parked, wires re-armed, ready to be ridden
      if (!caliToldAgain && typeof game.toast === 'function') {
        caliToldAgain = true;
        game.toast('she does the route all evening. get back on.');
      }
    }
  }

  // ---- parked: she waits for a passenger, and then she stops waiting -------
  if (caliChivaState === 'parked') {
    if (caliOnRoof) {
      caliRoofT += dt;
      if (caliRoofT > caliCHIVA_PULL_T) {
        caliChivaState = 'rolling';

        caliHornT = 1.6;
        caliStopIdx = 0;
        if (typeof game.sfx === 'function') { game.sfx('horn', { pitch: 1.15 }); game.sfx('strum'); }
        if (typeof game.toast === 'function') game.toast('hold on to something');
      }
    } else caliRoofT = 0;
  }

  // ---- the drive ----------------------------------------------------------
  if (caliChivaState === 'rolling' || caliChivaState === 'stopped') {

    const now = caliRouteAt(caliChivaS);
    let want;
    if (caliChivaState === 'stopped') {
      want = 0;
      caliChivaHold -= dt;
      if (caliChivaHold <= 0) {
        caliChivaState = 'rolling';
        if (typeof game.sfx === 'function') game.sfx('horn', { pitch: 1.35, volume: 0.55 });
      }
    } else {
      // A chiva climbs in first gear. Speed is a function of the GRADE and of
      // the corner and of nothing else — there is no throttle and no player
      // input, because she is not a vehicle you drive. She is a floor that is
      // going somewhere, which is a different and better thing to be stood on.
      want = lerp(caliCHIVA_V_FLAT, caliCHIVA_V_HILL, clamp(now.grade / 0.10, 0, 1));
      want *= lerp(1, 0.60, clamp(Math.abs(now.curve) * 26, 0, 1));
      const left = caliRouteLen - caliChivaS;
      if (left < 22) want = Math.min(want, 1.0 + left * 0.30);
      if (caliStopIdx < caliSTOPS.length) {
        const ds = caliSTOPS[caliStopIdx] * caliRouteLen - caliChivaS;
        if (ds < 18) want = Math.min(want, 0.8 + Math.max(0, ds) * 0.34);
        if (ds <= 0.25) {
          caliChivaState = 'stopped';
          caliChivaHold = caliCHIVA_STOP_T;
          caliStopIdx++;
          if (typeof game.sfx === 'function') game.sfx('thud', { volume: 0.30, pitch: 0.7 });
        }
      }
    }
    const acc = caliCHIVA_ACC * dt * (want < caliChivaV ? 1.8 : 1);
    caliChivaV += clamp(want - caliChivaV, -acc, acc);
    caliChivaS += caliChivaV * dt;
    if (caliChivaS >= caliRouteLen - 0.05) {
      caliChivaS = caliRouteLen;
      caliChivaV = 0;
      caliChivaState = 'arrived';
      caliTurnT = 0;              // D4.15: the turn-round clock starts here
      caliHornT = 2.2;
      if (typeof game.sfx === 'function') game.sfx('horn', { pitch: 0.9, volume: 0.9 });
      // ---- AND THE CABLES ARE SCORED AT THE TOP ------------------------
      // Seven of them over four hundred and sixty-five metres. The tally is
      // spoken here rather than per wire, because seven toasts in forty
      // seconds is a notification feed — and it only counts if you were still
      // on the roof at the end, which is the whole point of them.
      if (caliOnRoof && typeof game.toast === 'function') {
        if (caliWireClear >= caliWires.length) {
          game.toast('every cable, clean. the band would like a word.');
        } else if (caliWireClear > 0) {
          game.toast(caliWireClear + ' of ' + caliWires.length + ' cables. the rest of them got you.');
        }
      }
      caliWireClear = 0;
    }
  }

  // ---- where that puts her ------------------------------------------------
  const at = caliRouteAt(caliChivaS);
  caliChivaX = at.x; caliChivaZ = at.z;
  const idle = caliChivaState === 'arrived' || caliChivaState === 'parked' || caliChivaState === 'stopped';
  const bob = idle ? Math.sin(caliTime * 5.2) * 0.030 + Math.sin(caliTime * 2.1) * 0.020
                   : Math.sin(caliTime * 9.1) * 0.035 * clamp(caliChivaV / 4, 0, 1);
  caliChivaY = at.y + bob;
  caliChivaYaw = at.yaw;
  // pitch off the road under the axles, roll into the bend; both damped, because
  // an undamped attitude read off a smoothed polyline is a shiver
  const sa = clamp(caliChivaS - 3.1, 0, caliRouteLen), sb = clamp(caliChivaS + 3.1, 0, caliRouteLen);
  const ya = caliRoadY(caliRouteXAt(sa), caliRouteZAt(sa));
  const yb = caliRoadY(caliRouteXAt(sb), caliRouteZAt(sb));
  const pitchWant = -Math.atan2(yb - ya, Math.max(1, sb - sa));
  const rollWant = clamp(at.curve * caliChivaV * caliChivaV * 0.035, -0.16, 0.16);
  caliChivaPitch = damp(caliChivaPitch, pitchWant, 5, dt);
  caliChivaRoll = damp(caliChivaRoll, rollWant, 4, dt);

  caliEu.set(caliChivaPitch, caliChivaYaw, caliChivaRoll, 'YXZ');
  caliQ.setFromEuler(caliEu);
  caliChivaGroup.position.set(caliChivaX, caliChivaY, caliChivaZ);
  caliChivaGroup.quaternion.copy(caliQ);

  const b = caliChivaBody;
  b.position.set(caliChivaX, caliChivaY, caliChivaZ);
  b.quaternion.set(caliQ.x, caliQ.y, caliQ.z, caliQ.w);
  // THE VELOCITY IS THE POINT. capybara.js reads it off whatever it is stood on
  // and solves everything in that frame; without it the roof slides out from
  // under the animal at seven metres a second.
  b.velocity.set(Math.sin(caliChivaYaw) * caliChivaV, 0, Math.cos(caliChivaYaw) * caliChivaV);
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
  b.previousQuaternion.copy(b.quaternion);
  b.interpolatedQuaternion.copy(b.quaternion);

  // ---- the band -----------------------------------------------------------
  if (caliBandMembers) {
    const music = game.music;
    // game.music publishes playing / beatLen / beats() / off() / beatInBar() /
    // swell() and has never published phase(), so this was a property lookup
    // that always missed: ph stayed 0, swing stayed 0, and the three musicians
    // on the roof of the chiva never moved to the music at all. beats() is a
    // float, and its fractional part is exactly the beat phase this wanted.
    const ph = (music && music.playing) ? ((music.beats() % 1) + 1) % 1 : 0;

    const swing = Math.sin(ph * Math.PI * 2);
    for (let i = 0; i < caliBandMembers.length; i++) {
      const m = caliBandMembers[i];
      m.holder.position.y = caliROOF_TOP - caliBandDuck * 0.62
        + Math.abs(Math.sin((ph + m.phase) * Math.PI)) * 0.07;
      m.holder.rotation.x = caliBandDuck * 0.75;
      m.holder.rotation.z = swing * 0.07;
    }
  }

  // ---- night falls as she climbs ------------------------------------------
  // Not on a timer: on PROGRESS ALONG THE ROUTE. The sun goes down over the
  // ride whether you spend ninety seconds on it or four minutes chasing a bus
  // you fell off, and it never goes back up.
  if (caliChivaState !== 'parked') {
    const prog = clamp(caliChivaS / (caliRouteLen * 0.72), 0, 1);
    caliNightT = Math.max(caliNightT, prog * prog * (3 - 2 * prog));
  }
  if (caliMiradorDone) caliNightT = 1;

  // ---- arrival ------------------------------------------------------------
  if (caliChivaState === 'arrived' && !caliMiradorDone) {
    const capy = game.capy;
    const p = capy && capy.position;
    // ON THE TERRACE, not necessarily still on the roof. If a wire had you off
    // and you ran the last two hundred metres up the hill after her, you have
    // earned this at least as much as the people who sat down.
    const onTerrace = !!p && Math.abs(p.x - caliMIRADOR.x) < 13 && Math.abs(p.z - caliMIRADOR.z) < 13
                      && p.y > caliMIR_DECK - 1.6;
    if (caliOnRoof || onTerrace) {
      caliMiradorDone = true;
      caliVistaT = 0;
      caliTask('chiva-mirador');
      caliBurstSparks(caliChivaX, caliChivaY + 4.4, caliChivaZ, 18, 1.4);
      if (typeof game.punch === 'function') game.punch(0.12);
      else if (typeof game.shake === 'function') game.shake(0.12);
      // THE WHOLE RIDE IS MONO: 0 of 70 sfx calls across the 121 s up the hill
      // pass a position, and these two are the loudest of them. `musSource()`
      // in this file already proves the chapter knows how to place audio.
      if (typeof game.sfx === 'function') {
        const at = { x: caliMIRADOR.x, y: caliMIR_DECK + 1.2, z: caliMIRADOR.z };
        game.sfx('chime', { volume: 1, at: at });
        game.sfx('strum', { at: at });
      }
      // ---- FRAMED (v26) --------------------------------------------------
      // The payout is a view, and the view was 128 degrees behind the camera.
      // Measured at the arrival frame: yaw -45.5, pitch -41.3 (looking DOWN),
      // dist 10.6 — while the thing the chapter has spent two minutes climbing
      // toward, the city-light field, lies at yaw +82.6. `skyward()` already
      // asks for the pitch and the distance and is honoured; the bearing was
      // the one number nothing could set.
      //
      // Seven seconds, which is the length of the existing vista beat before
      // its five-second ease.
      if (typeof game.frameShot === 'function') {
        game.frameShot({ yaw: 82 * Math.PI / 180, dist: 15,
                         pitch: 6 * Math.PI / 180, raise: 2.2, hold: 7.0 });
      }
      if (typeof game.toast === 'function') {
        game.toast('two and a half million people, and every one of them is down there');
      }
    }
  }
  if (caliMiradorDone) caliVistaT += dt;
  if (caliHornT > 0) caliHornT -= dt;
}

/**
 * Put her back on the kerb outside the salsoteca.
 *
 * Called when the player leaves the biome mid-ride. A bus abandoned two thirds
 * of the way up a hill is not a bug you could ever find from the symptom: you
 * come back to Cali, the chiva is not where the task hint says it is, and the
 * only way onto it is to catch it. The night does NOT reset — the sun has
 * already gone down and putting it back would be the stranger of the two.
 */
function caliChivaReset() {
  caliChivaState = 'parked';
  caliTurnT = 0;
  caliChivaS = 0;
  caliChivaV = 0;
  caliStopIdx = 0;
  caliChivaHold = 0;
  caliRoofT = 0;
  caliChivaPitch = 0;
  caliChivaRoll = 0;
  if (caliWires) for (let i = 0; i < caliWires.length; i++) { caliWires[i].has = false; caliWires[i].hit = 0; }
  if (caliRX) {
    const a = caliRouteAt(0);
    caliChivaX = a.x; caliChivaY = a.y; caliChivaZ = a.z; caliChivaYaw = a.yaw;
  }
}

/** The city lights, and the two lamps on the terrace, come up with the dark. */
function caliUpdateNight() {
  const on = caliNightT > 0.02;
  if (caliMiradorGlow) {
    if (caliMiradorGlow.visible !== on) caliMiradorGlow.visible = on;
    caliMiradorGlow.material.emissiveIntensity = caliNightT * 0.92;
  }
  if (caliMiradorPool) {
    if (caliMiradorPool.visible !== on) caliMiradorPool.visible = on;
    caliMiradorPool.material.opacity = caliNightT * 0.13;
  }
  // THE COALS. The only fire in the chapter, and the one warm thing at the top
  // of the climb — so it does not just switch on, it BREATHES: charcoal under a
  // draught brightens and dims a couple of times a second and never sits still.
  if (caliBrazierMat) {
    if (caliBrazier.visible !== on) caliBrazier.visible = on;
    const puff = 0.78 + 0.22 * Math.sin(caliTime * 3.1) * Math.sin(caliTime * 1.37 + 1.1);
    caliBrazierMat.emissiveIntensity = caliNightT * puff;
  }
  if (!caliCityLights) return;
  for (let i = 0; i < caliCityLights.length; i++) {
    if (caliCityLights[i].visible !== on) caliCityLights[i].visible = on;
  }
  for (let i = 0; i < caliCityMat.length; i++) {
    // The far field has to sit UNDER the fog, not over it — an emissive that
    // reaches 1 puts a hard white grid on the horizon. 0.86 is where the near
    // windows read as lit and the far ones still recede.
    caliCityMat[i].emissiveIntensity = caliNightT * 0.86;
  }
}

// ================================================================ SALSOTECA ==
/**
 * The floor. A sprung board circle under a roof of coloured lamps, open on
 * every side, at the bottom of the street. This is the only lit interior in the
 * game and the only place where the score is the mechanic.
 */
function caliBuildSalsoteca(game, root) {
  const S = caliMerger();
  const x = caliFLOOR.x, z = caliFLOOR.z, R = caliFLOOR.r;
  const y = caliTerrain(x, z);
  // the low wall the floor sits inside, open to the street
  const SEG = 16;
  for (let i = 0; i < SEG; i++) {
    const a = i / SEG * Math.PI * 2;
    // THE WAY IN, AND IT WAS FACING THE WRONG WAY. The street is at z = 40 and
    // the floor at z = 52, so the street is on the MINUS z side — and the gap
    // was cut at a = 1.1..2.4, which is plus z. You arrived at the back of it
    // every time, and the wall you met instead was standing across the road the
    // chiva drives down. Turned to face the street, which is also the direction
    // the music is coming from.
    if (a > 4.06 && a < 5.36) continue;               // the way in
    // A box sitting on a circle has to be TANGENT to it. Its local +X maps to
    // (cos ry, -sin ry) and the tangent at angle a is (-sin a, cos a), which
    // solves to ry = -a - PI/2 — not -a, which is ninety degrees out and turns
    // a ring wall into a cartwheel of spokes.
    const ry = -a - Math.PI / 2;
    S.box(x + Math.cos(a) * (R + 1.2), y + 0.55, z + Math.sin(a) * (R + 1.2),
          (R + 1.2) * 2 * Math.PI / SEG + 0.4, 1.1, 0.6,
          i % 2 ? PALETTE.caliWall2 : PALETTE.caliWall1, 0, ry, 0);
    caliStaticBox(game, x + Math.cos(a) * (R + 1.4), y + 0.55, z + Math.sin(a) * (R + 1.4),
                  (R + 1.2) * Math.PI / SEG + 0.2, 0.6, 0.35, ry);
  }
  // NO ROOF. This started as a tiled cone and then as a ring, and both of them
  // did the same thing: the game has exactly one camera angle — about 40 degrees
  // down — so anything solid over an eleven-metre floor hides the one place in
  // the biome where the mechanic actually lives. What an open-air salsa spot in
  // Cali has over it anyway is not a roof, it is FESTOON LIGHTING: a ring of
  // posts with cables slung between them and coloured bulbs along the cables.
  // Nothing to see through, and it says "this is where the dancing is" from
  // three streets away.
  const POSTS = 8;
  for (let i = 0; i < POSTS; i++) {
    const a = i / POSTS * Math.PI * 2 + 0.4;
    const px = x + Math.cos(a) * (R + 1.9), pz = z + Math.sin(a) * (R + 1.9);
    S.cyl(px, y + 2.9, pz, 0.22, 5.8, PALETTE.caliChiva, 0, 0, 0, 6);
    S.cyl(px, y + 5.85, pz, 0.30, 0.24, PALETTE.caliChivaTrim, 0, 0, 0, 6);
    // the cable to the next post, sagging, as a short chain of segments
    const a2 = (i + 1) / POSTS * Math.PI * 2 + 0.4;
    const qx = x + Math.cos(a2) * (R + 1.9), qz = z + Math.sin(a2) * (R + 1.9);
    const N = 5;
    for (let k = 0; k < N; k++) {
      const t0 = k / N, t1 = (k + 1) / N;
      const sag = 0.85;
      const y0 = y + 5.7 - Math.sin(t0 * Math.PI) * sag;
      const y1 = y + 5.7 - Math.sin(t1 * Math.PI) * sag;
      const cx0 = lerp(px, qx, t0), cz0 = lerp(pz, qz, t0);
      const cx1 = lerp(px, qx, t1), cz1 = lerp(pz, qz, t1);
      const len = Math.hypot(cx1 - cx0, cz1 - cz0, y1 - y0);
      S.box((cx0 + cx1) * 0.5, (y0 + y1) * 0.5, (cz0 + cz1) * 0.5,
            len + 0.06, 0.055, 0.055, PALETTE.caliGrille,
            0, Math.atan2(cx1 - cx0, cz1 - cz0) + Math.PI / 2,
            Math.atan2(y1 - y0, Math.hypot(cx1 - cx0, cz1 - cz0)));
    }
  }
  // one cable straight across the middle, because there always is one
  for (let k = 0; k < 9; k++) {
    const t0 = k / 9, t1 = (k + 1) / 9;
    const y0 = y + 6.1 - Math.sin(t0 * Math.PI) * 1.2;
    const y1 = y + 6.1 - Math.sin(t1 * Math.PI) * 1.2;
    const cx0 = x - (R + 1.9) + t0 * (R + 1.9) * 2, cx1 = x - (R + 1.9) + t1 * (R + 1.9) * 2;
    S.box((cx0 + cx1) * 0.5, (y0 + y1) * 0.5, z, Math.hypot(cx1 - cx0, y1 - y0) + 0.06,
          0.055, 0.055, PALETTE.caliGrille, 0, 0, Math.atan2(y1 - y0, cx1 - cx0));
  }
  // the boards. Laid as radial planks, because a dance floor is a floor.
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2;
    S.box(x + Math.cos(a) * R * 0.5, y + 0.10, z + Math.sin(a) * R * 0.5,
          R, 0.2, R * 2 * Math.PI / 24 - 0.06,
          i % 2 ? PALETTE.caliFloor : PALETTE.caliFloorLit, 0, -a, 0);
  }
  caliStaticBox(game, x, y - 0.1, z, R + 1.0, 0.3, R + 1.0);
  // a bar along the back — which is now the far side from the street, since
  // the way in moved
  S.box(x + R * 0.1, y + 0.6, z + R + 0.2, 7.0, 1.2, 1.0, PALETTE.caliWall3);
  S.box(x + R * 0.1, y + 1.26, z + R + 0.2, 7.4, 0.14, 1.3, PALETTE.caliStoneDark);
  for (let i = 0; i < 9; i++) {
    S.cyl(x + R * 0.1 - 3.0 + i * 0.75, y + 1.55, z + R + 0.35, 0.11, 0.46,
          i % 3 ? PALETTE.caliCanePale : PALETTE.caliWall3, 0, 0, 0, 6);
  }
  const m = new THREE.Mesh(S.build(), caliVC());
  m.castShadow = true;
  m.receiveShadow = true;
  root.add(m);

  // The lit floor disc. Its own mesh with its own material, so the dance can
  // brighten the whole floor on the beat with a single colour write.
  const disc = new THREE.CircleGeometry(R - 0.2, 40).rotateX(-Math.PI / 2);
  caliFloorMat = mat(PALETTE.caliFloorLit, { transparent: true, opacity: 0.0 });
  // a private clone: mat() caches by colour, and this one is animated
  caliFloorMat = caliFloorMat.clone();
  caliFloorMesh = new THREE.Mesh(disc, caliFloorMat);
  caliFloorMesh.position.set(x, y + 0.22, z);
  caliFloorMesh.receiveShadow = false;
  root.add(caliFloorMesh);

  // the coloured lamps under the roof — one instanced draw, and they chase
  // Bulbs ON the cables — round the ring and along the one across the middle,
  // hung at the sag so the string reads as a string.
  const lamps = [];
  const POSTS2 = 8;
  for (let i = 0; i < POSTS2; i++) {
    const a = i / POSTS2 * Math.PI * 2 + 0.4;
    const a2 = (i + 1) / POSTS2 * Math.PI * 2 + 0.4;
    const px = x + Math.cos(a) * (R + 1.9), pz = z + Math.sin(a) * (R + 1.9);
    const qx = x + Math.cos(a2) * (R + 1.9), qz = z + Math.sin(a2) * (R + 1.9);
    for (let k = 1; k <= 3; k++) {
      const t = k / 4;
      caliPush9(lamps, lerp(px, qx, t), y + 5.7 - Math.sin(t * Math.PI) * 0.85 - 0.24,
                lerp(pz, qz, t), 0, 0, 0, 0.34, 0.42, 0.34);
    }
  }
  for (let k = 1; k <= 6; k++) {
    const t = k / 7;
    caliPush9(lamps, x - (R + 1.9) + t * (R + 1.9) * 2,
              y + 6.1 - Math.sin(t * Math.PI) * 1.2 - 0.24, z, 0, 0, 0, 0.34, 0.42, 0.34);
  }
  caliLampMesh = caliInstance(root, caliG.sph6, PALETTE.caliNeonGold, lamps, false, false);
  if (caliLampMesh) {
    caliLampMesh.material = caliLampMesh.material.clone();
    caliLampMesh.material.transparent = true;
    // FESTOON LIGHTING IS NOT ONE COLOUR AND IT DOES NOT BLINK IN UNISON.
    // Every bulb was the same gold and the whole string faded together on the
    // beat, which from three streets away is a lamp rather than a party. Four
    // colours round the ring and a CHASE — each bulb's brightness is keyed to
    // its own place in the string, so the light runs round the floor once a bar
    // and the floor has a direction to it.
    const N = lamps.length / 9;
    caliLampMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    const bulbs = [PALETTE.caliNeonGold, PALETTE.caliNeonPink,
                   PALETTE.caliNeonCyan, PALETTE.caliChivaGrn];
    const c = new THREE.Color();
    caliLampBase = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      c.set(bulbs[i % bulbs.length]);
      caliLampMesh.setColorAt(i, c);
      caliLampBase[i * 3] = c.r; caliLampBase[i * 3 + 1] = c.g; caliLampBase[i * 3 + 2] = c.b;
    }
    caliLampMesh.instanceColor.needsUpdate = true;
  }
}
let caliLampBase = null;

/** The chase round the string, once a bar. */
function caliUpdateLamps(game) {
  if (!caliLampMesh || !caliLampBase || !caliLampMesh.instanceColor) return;
  const mus = game.music;
  const beats = (mus && mus.playing) ? mus.beats() : caliTime * (100 / 60);
  const arr = caliLampMesh.instanceColor.array;
  const N = caliLampBase.length / 3;
  const head = (beats / 8) * N;
  for (let i = 0; i < N; i++) {
    // distance round the ring from the running head, wrapped
    let d = (i - head) % N;
    if (d < 0) d += N;
    if (d > N * 0.5) d = N - d;
    const k = 0.55 + 0.45 * clamp(1 - d / (N * 0.22), 0, 1);
    arr[i * 3] = caliLampBase[i * 3] * k;
    arr[i * 3 + 1] = caliLampBase[i * 3 + 1] * k;
    arr[i * 3 + 2] = caliLampBase[i * 3 + 2] * k;
  }
  caliLampMesh.instanceColor.needsUpdate = true;
}

// ============================================================== THE DANCERS ==
/**
 * THE SALSA CAPITAL OF THE WORLD HAD NOBODY DANCING IN IT.
 *
 * This chapter's whole thesis is in its opening comment — "the centrepiece is
 * not a set-piece you walk to, it is a floor you have to move on IN TIME" — and
 * the floor it built was an empty ring of boards with one teacher stood in the
 * middle of it saying "on the ONE". The player arrived at the marquee mechanic
 * of chapter five, was told to dance, and was the only thing on the floor.
 *
 * Five couples, and they are three things at once:
 *
 *   1. THE TUTORIAL. They step off game.music — the same AudioContext clock the
 *      player's own combo is judged against — so the answer to "when is the
 *      beat" is standing in front of you doing it. That is the chiva band's
 *      trick (they duck a second before each wire) applied to the one mechanic
 *      in the game that cannot be brute-forced.
 *   2. THE FIGURE. Cali's step is on 1-2-3, hold, 5-6-7, hold: eight counts with
 *      two gaps in it, and those gaps are what makes salsa look like salsa
 *      rather than like marching. The gaps are in the table below.
 *   3. THE ROOM. Nobody dances in the middle of a floor. They are on a ring at
 *      three quarters of the radius, which leaves the middle — where the whisk,
 *      the flash and the player's own combo all live — completely clear.
 *
 * One instanced draw for all ten of them, with a per-instance colour so the
 * floor is not ten copies of one shirt.
 */
const caliDANCE_COUPLES = 5;
const caliDANCERS = caliDANCE_COUPLES * 2;
// which of the eight counts carries a step. 3 and 7 are the holds.
const caliSTEP_ON = [1, 1, 1, 0, 1, 1, 1, 0];
let caliDancerMesh = null, caliDancerData = null;
let caliDanceCheer = 0;

function caliBuildDancers(root) {
  const D = caliMerger();
  // A DANCER IS A LINE AND A LEAN. Legs together and slightly apart, a torso
  // that is mostly shoulder, a head, and two arms held up and forward — a
  // couple in closed position is two people with their arms in a box, and at
  // ten metres that box is the entire silhouette.
  D.box(0, 0.30, 0, 0.16, 0.62, 0.17, PALETTE.caliGrille);
  D.box(0, 0.30, 0, 0.15, 0.62, 0.16, PALETTE.caliGrille, 0, 0, 0.10);
  D.box(0, 0.86, 0, 0.44, 0.60, 0.27, PALETTE.caliWall4);
  D.box(0, 1.16, 0, 0.46, 0.10, 0.29, PALETTE.caliWall4);
  D.sph(0, 1.34, 0, 0.13, 0.15, 0.13, PALETTE.skin3);
  D.sph(0, 1.40, -0.02, 0.135, 0.11, 0.135, PALETTE.hair2);
  for (let s = -1; s <= 1; s += 2) {
    D.box(s * 0.26, 1.02, 0.16, 0.11, 0.42, 0.11, PALETTE.skin3, -0.85, 0, -s * 0.30);
    D.box(s * 0.30, 1.10, 0.42, 0.10, 0.10, 0.30, PALETTE.skin3);
  }
  caliDancerMesh = new THREE.InstancedMesh(D.build(), caliVC(), caliDANCERS);
  caliDancerMesh.castShadow = true;
  caliDancerMesh.frustumCulled = false;
  caliDancerMesh.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(caliDANCERS * 3), 3);
  const shirts = [PALETTE.caliWall1, PALETTE.caliWall2, PALETTE.caliWall3,
                  PALETTE.caliWall5, PALETTE.caliWall6, PALETTE.caliNeonPink,
                  PALETTE.caliNeonCyan, PALETTE.caliChivaTrim, PALETTE.caliNeonGold,
                  PALETTE.caliChivaGrn];
  const c = new THREE.Color();
  caliDancerData = new Float32Array(caliDANCE_COUPLES * 3);   // angle, radius, phase
  for (let i = 0; i < caliDANCE_COUPLES; i++) {
    caliDancerData[i * 3] = i / caliDANCE_COUPLES * Math.PI * 2 + 0.5;
    caliDancerData[i * 3 + 1] = caliFLOOR.r * (0.58 + (i % 3) * 0.10);
    caliDancerData[i * 3 + 2] = i * 1.31;
  }
  for (let i = 0; i < caliDANCERS; i++) {
    c.set(shirts[i % shirts.length]);
    caliDancerMesh.setColorAt(i, c);
  }
  if (caliDancerMesh.instanceColor) caliDancerMesh.instanceColor.needsUpdate = true;
  root.add(caliDancerMesh);
}

function caliUpdateDancers(game, dt) {
  if (!caliDancerMesh) return;
  if (caliDanceCheer > 0) caliDanceCheer -= dt;
  const mus = game.music;
  // FALL BACK TO A CLOCK, NEVER TO STILLNESS. Before the first gesture unlocks
  // the AudioContext there is no music at all, and a floor of five couples
  // standing perfectly still is worse than an empty one — it reads as a bug.
  // 100 bpm is the palette's own tempo.
  const beats = (mus && mus.playing) ? mus.beats() : caliTime * (100 / 60);
  const y = caliTerrain(caliFLOOR.x, caliFLOOR.z) + 0.22;
  for (let i = 0; i < caliDANCE_COUPLES; i++) {
    const o = i * 3;
    const ph = caliDancerData[o + 2];
    const cx = caliFLOOR.x + Math.cos(caliDancerData[o]) * caliDancerData[o + 1];
    const cz = caliFLOOR.z + Math.sin(caliDancerData[o]) * caliDancerData[o + 1];
    // where in the eight are we, and how far through this count
    const b = beats + ph;
    const count = ((Math.floor(b) % 8) + 8) % 8;
    const f = b - Math.floor(b);
    const stepping = caliSTEP_ON[count];
    // The couple's own facing turns a little every bar, and a whole half turn
    // on the last count of every other bar, which is the figure that makes a
    // social floor read as a floor rather than as a row.
    const bar = Math.floor(b / 8);
    const turn = bar * Math.PI + Math.sin(b * 0.11 + ph) * 0.5;
    const spin = (count === 7 && bar % 2 === 1) ? Math.PI * f : 0;
    const face = turn + spin;
    // the weight change: a lateral shove on the beat that eases out over the
    // count, and a small drop with it — hips first, which is the whole style
    const swing = stepping ? Math.sin(f * Math.PI) : Math.sin(f * Math.PI) * 0.18;
    const dir = count < 3 ? 1 : -1;
    const drop = stepping ? Math.sin(f * Math.PI) * 0.055 : 0;
    const cheer = caliDanceCheer > 0 ? Math.sin(caliDanceCheer * 12) * 0.10 : 0;
    for (let k = 0; k < 2; k++) {
      const s = k ? 1 : -1;
      const a = face + (k ? Math.PI : 0);
      const px = cx + Math.sin(face) * s * 0.42 + Math.cos(face) * dir * swing * 0.30;
      const pz = cz + Math.cos(face) * s * 0.42 - Math.sin(face) * dir * swing * 0.30;
      caliDancerMesh.setMatrixAt(i * 2 + k, caliXform(
        px, y + drop * -1 + Math.abs(cheer) * 0.6, pz,
        0, a, dir * swing * 0.14 + cheer, 1, 1, 1));
    }
  }
  caliDancerMesh.instanceMatrix.needsUpdate = true;
}

// =========================================================== THE BACK ROWS ==
/**
 * SAN ANTONIO IS A HILL, AND THE CHAPTER BUILT TWO ROWS OF IT ON A LAWN.
 *
 * Eighteen painted houses face each other across the street and then the world
 * stops: eight and a half metres behind each frontage the terrace ends and
 * there is open grass all the way to the sugarcane. From the dance floor — the
 * chapter's marquee mechanic, and the one place the player is asked to stand
 * still and look around — the town reads as a film set with the flats seen from
 * behind.
 *
 * The real barrio climbs. So: a second row on each side, SET BACK and STEPPED
 * UP, smaller and plainer than the frontage because the good houses are the
 * ones on the street; and then a scatter of roofs beyond that, drawn only as
 * roof and gable, which is all you can see of a house one street further up.
 *
 * No colliders on the far scatter. It is past the walkable edge of the chapter
 * and a hundred and forty extra bodies to hold up a capybara that can never
 * reach them is exactly the trade [[capy3-solid-or-drawn]] says not to make —
 * but the near back row IS solid, because you can walk round the end of the
 * terrace and into it.
 */
/**
 * IS THERE ROOM FOR THIS HERE, OR IS THAT THE BUS'S ROAD?
 *
 * Four hundred and sixty-five metres of chiva route wander the whole biome —
 * down the street, along the south bank, over the Ortiz, west along the north
 * bank and then five switchbacks up the ridge — and nothing outside
 * caliBuildRoad has ever had to know where it goes. The moment anything new is
 * PLACED (a back row of houses, a line of samán, a stall), that stops being
 * true: the first cut of the back rows put a terrace 25 cm off the near side of
 * a bus doing seven metres a second, and the first cut of the tree line planted
 * samán on the road's centreline.
 *
 * The route is already resampled into caliRX/caliRZ at about a metre a step by
 * caliBuildRoute, which caliBuild runs FIRST for exactly this family of reason.
 * So the test is four lines, and every placer should use it.
 */
function caliOffRoute(x, z, m) {
  if (!caliRX) return true;
  const m2 = m * m;
  for (let i = 0; i < caliRX.length; i++) {
    const dx = x - caliRX[i], dz = z - caliRZ[i];
    if (dx * dx + dz * dz < m2) return false;
  }
  return true;
}

function caliBuildBackRows(game, root) {
  const B = caliMerger();
  const walls = [PALETTE.caliWall1, PALETTE.caliWall2, PALETTE.caliWall3,
                 PALETTE.caliWall4, PALETTE.caliWall5, PALETTE.caliWall6];
  for (let side = -1; side <= 1; side += 2) {
    // ---- the near back row: solid, and you can get behind it ---------------
    for (let i = 0; i < 8; i++) {
      const x = -46 + i * 12 + (side > 0 ? 6 : 0);
      const z = caliSTREET_Z + side * 23;
      // THE DANCE FLOOR IS NOT NEGOTIABLE. caliBuildStreet declines to build
      // any house that overlaps it, for the reason its own comment gives at
      // length, and a back row eleven metres further out has to make the same
      // refusal or the fix is undone one row up.
      if (Math.hypot(x - caliFLOOR.x, z - caliFLOOR.z) < caliFLOOR.r + 8) continue;
      // half a house plus half a bus plus a metre — see caliOffRoute
      if (!caliOffRoute(x, z, 8.0)) continue;
      const y = caliTerrain(x, z);
      const w = rand(7.4, 9.4), h = rand(3.8, 5.2);
      const col = walls[(i + (side > 0 ? 4 : 1)) % walls.length];
      B.box(x, y + h * 0.5, z, w, h, 7.6, col);
      B.box(x, y + h + 0.10, z, w + 0.4, 0.30, 8.0, PALETTE.caliWall4);
      const RISE = 1.0, HD = 4.7;
      const PIT = Math.atan2(RISE, HD);
      for (let e = -1; e <= 1; e += 2) {
        B.box(x, y + h + 0.40 + RISE * 0.5, z + e * HD * 0.5, w + 0.5, 0.38, HD + 1.5,
              PALETTE.caliRoof, -e * PIT, 0, 0);
      }
      B.box(x, y + h + 1.50, z, w + 0.3, 0.26, 0.56, PALETTE.caliRoofDark);
      // one door and one grilled window on the street side, and a water tank on
      // the roof, which every house in Colombia has and nobody ever draws
      const fz = z - side * 3.9;
      B.box(x - w * 0.2, y + 1.3, fz, 1.4, 2.6, 0.18, PALETTE.caliShutter);
      B.box(x + w * 0.2, y + 2.0, fz, 1.3, 1.4, 0.18, PALETTE.caliWall4);
      for (let b2 = 0; b2 < 4; b2++) {
        B.box(x + w * 0.2 - 0.45 + b2 * 0.3, y + 2.0, fz - side * 0.16, 0.06, 1.25, 0.06, PALETTE.caliGrille);
      }
      B.cyl(x + w * 0.28, y + h + 2.0, z + side * 1.2, 0.52, 1.0, PALETTE.caliErmita, 0, 0, 0, 8);
      caliStaticBox(game, x, y + h * 0.5, z, w * 0.5, h * 0.5, 3.8);
    }
    // ---- and the roofs of the street after that ---------------------------
    // Drawn only from the eaves up, because that is genuinely all you can see of
    // a house one street further up a hill at forty-one degrees down.
    for (let i = 0; i < 11; i++) {
      const x = -52 + i * 10.5 + (side > 0 ? 3 : 0);
      const z = caliSTREET_Z + side * (34 + (i % 3) * 4.5);
      // THE NORTH SIDE OF THE STREET RUNS OUT OF LAND. Thirty-four metres north
      // of z = 40 is z = 6, which is the Río Cali — the first cut of this put a
      // dozen tiled roofs floating in the middle of the river. The far scatter
      // only exists uphill; the far bank has the Gato, La Ermita and the
      // riverside walk on it and does not want a second row of anything.
      if (side < 0) continue;
      if (!caliOffRoute(x, z, 8.0)) continue;
      const y = caliTerrain(x, z) + 2.2 + (i % 3) * 0.7;
      const w = rand(6.4, 8.6);
      B.box(x, y + 0.9, z, w, 1.8, 7.0, walls[(i * 3 + side) % walls.length]);
      const RISE = 0.9, HD = 4.4;
      const PIT = Math.atan2(RISE, HD);
      for (let e = -1; e <= 1; e += 2) {
        B.box(x, y + 1.8 + 0.32 + RISE * 0.5, z + e * HD * 0.5, w + 0.5, 0.34, HD + 1.3,
              PALETTE.caliRoof, -e * PIT, 0, 0);
      }
      B.box(x, y + 3.2, z, w + 0.3, 0.24, 0.5, PALETTE.caliRoofDark);
    }
  }
  const m = new THREE.Mesh(B.build(), caliVC());
  m.castShadow = true;
  m.receiveShadow = true;
  root.add(m);
}

// ============================================================== THE PASEO ===
/**
 * FOUR HUNDRED METRES OF STONE EMBANKMENT WITH NOTHING ON IT.
 *
 * caliBuildRiverside builds both banks, a parapet, and three steps down to the
 * water it describes in its own comment as "where people sit". What it never
 * built is the thing that makes the Paseo Bolívar the best-looking half-mile in
 * Cali: the SAMÁN. They are enormous, they are flat-topped, they are planted in
 * a line about eleven metres apart, and the whole walk is in their shade.
 *
 * Plus the furniture that goes under them, which is what tells you it is a
 * promenade and not a flood defence: benches facing the water, bins, and the
 * lamp standards the city lights already pretend are there — caliBuildCityLights
 * puts a warm window at terrain + 4.4 every eleven metres along both banks and
 * there has never been a post under any of them.
 */
function caliBuildPaseo(game, root) {
  const P = caliMerger();
  const trunks = [], crowns = [];
  for (let x = -66; x <= 66; x += 11) {
    for (let s = -1; s <= 1; s += 2) {
      const bz = caliRIVER_Z + s * (caliRIVER_HZ + 4.6);
      const by = caliTerrain(x, bz);
      const nearBridge = Math.abs(x - caliBRIDGE_X) < 8;
      // ---- the lamp standard the city lights have always been hanging on ---
      if (!nearBridge) {
        P.cyl(x, by + 2.2, bz, 0.11, 4.4, PALETTE.caliGrille, 0, 0, 0, 6);
        P.box(x, by + 4.42, bz, 0.9, 0.12, 0.24, PALETTE.caliGrille);
        P.box(x, by + 4.30, bz, 0.42, 0.22, 0.34, PALETTE.caliCityLite);
        caliStaticBox(game, x, by + 1.4, bz, 0.16, 1.4, 0.16);
      }
      // ---- a samán, set back off the walk ---------------------------------
      // EVERY OTHER BAY, AND SET BACK FURTHER. A samán crown is twelve to
      // seventeen metres across; planted every eleven they close into an
      // unbroken green ceiling over the walk, the road AND the water, and the
      // promenade rendered as a wall of leaf with a river somewhere behind it.
      // At twenty-two the shade is dappled, which is what a line of them is for.
      const tx = x + 5.5, tz = caliRIVER_Z + s * (caliRIVER_HZ + 12.5);
      const ty = caliTerrain(tx, tz);
      // AND NOT IN THE ROAD. Twelve and a half metres off the centreline is the
      // chiva's own lane on the south bank going out and on the north bank
      // coming back, so the first line of samán was planted down the middle of
      // it. A samán trunk is 2.3 m across; 4.6 m of clearance is a tree at the
      // kerb, which is where they are.
      if (Math.abs(tx - caliBRIDGE_X) > 9 && caliOffRoute(tx, tz, 4.6) &&
          ((x / 11) | 0) % 2 === (s > 0 ? 0 : 1)) {
        const h = rand(9.5, 13.5);
        caliPush9(trunks, tx, ty + h * 0.42, tz, 0, rand(0, 3), 0, 1.15, h * 0.86, 1.15);
        // A SAMÁN IS A PARASOL. It is much wider than it is tall and the
        // underside is dead flat — four overlapping discs at almost the same
        // height, not a ball, and not the ceiba's stepped tiers.
        for (let k = 0; k < 4; k++) {
          const a = k / 4 * Math.PI * 2;
          caliPush9(crowns, tx + Math.cos(a) * h * 0.17, ty + h * (0.92 + (k % 2) * 0.05),
                    tz + Math.sin(a) * h * 0.17, 0, rand(0, 3), 0,
                    h * 0.46, h * 0.12, h * 0.46);
        }
      }
      // ---- a bench facing the water, and a bin beside it ------------------
      if (!nearBridge && ((x / 11) | 0) % 2 === 0) {
        const wx = x + 2.4, wz = caliRIVER_Z + s * (caliRIVER_HZ + 3.4);
        const wy = caliTerrain(wx, wz);
        // it faces the river, so its back is on the landward side
        P.box(wx, wy + 0.44, wz, 2.4, 0.14, 0.62, PALETTE.caliChivaTrim, 0, 0, 0);
        P.box(wx, wy + 0.78, wz + s * 0.28, 2.4, 0.56, 0.10, PALETTE.caliChivaTrim, s * 0.22, 0, 0);
        for (let k = -1; k <= 1; k += 2) {
          P.box(wx + k * 1.0, wy + 0.22, wz, 0.16, 0.44, 0.58, PALETTE.caliStoneDark);
        }
        P.cyl(wx + 2.2, wy + 0.44, wz, 0.34, 0.88, PALETTE.caliChivaGrn, 0, 0, 0, 8);
        P.cyl(wx + 2.2, wy + 0.90, wz, 0.36, 0.06, PALETTE.caliGrille, 0, 0, 0, 8);
      }
    }
  }
  const m = new THREE.Mesh(P.build(), caliVC());
  m.castShadow = true;
  m.receiveShadow = true;
  root.add(m);
  caliInstance(root, caliG.cyl6, PALETTE.caliCaneStem, trunks, true, false);
  caliInstance(root, caliG.cyl6, PALETTE.caliSaman, crowns, true, false);
}

// ================================================= WHAT IS AT THE TOP OF IT ==
/**
 * THE MARQUEE MOMENT ENDS ON A BARE CONCRETE SLAB.
 *
 * Four hundred and sixty-five metres of chiva, three cables to hop, the sun
 * going down and nine hundred and forty windows coming on underneath you — and
 * what you actually step off onto is a terrace with two unlit lamp posts, a
 * bench and a sign. Nobody is there. Nothing is happening. The best twenty
 * seconds in the chapter arrives at an empty car park.
 *
 * What is at a Cali mirador at seven in the evening: somebody selling chontaduro
 * and arepas off a cart with a charcoal brazier under it, a coin-operated
 * viewer nobody has fed since 2011, and a railing with a few hundred padlocks
 * and ribbons wired to it. All three of them are things that say OTHER PEOPLE
 * COME HERE, which is the one thing the arrival needed and did not have.
 *
 * The brazier is the only fire in the chapter and it is its own emissive mesh,
 * the Drift's idiom — a light is a thing that is BRIGHT, because nothing in this
 * game lights anything.
 */
let caliBrazier = null, caliBrazierMat = null;
function caliBuildMiradorLife(game, root) {
  const M = caliMerger();
  const F = caliMerger();
  const cx = caliMIRADOR.x, cz = caliMIRADOR.z, yaw = caliMIR_YAW, D = caliMIR_DECK;
  const ox = Math.sin(yaw), oz = Math.cos(yaw);            // outward, over the valley
  const ax = Math.cos(yaw), az = -Math.sin(yaw);           // along the contour

  // ---- the cart -----------------------------------------------------------
  // NOT AGAINST THE INLAND EDGE. The terrace is cut into a flank that falls at
  // nearly sixty per cent, so the hillside stands well above the deck on the
  // uphill side: a cart parked 3.4 m in from the valley rail is BEHIND the
  // shoulder of the hill from the arrival camera, and what rendered was an
  // awning floating over grass with nothing under it. Measured from the frame.
  // Along the contour at the far end from the bench, and only just in off the
  // rail, where the chiva's road does not run and the hill cannot hide it.
  //
  // AND HALF THE TERRACE IS INSIDE THE HILL. caliMiradorT blends caliRoadY to
  // the deck over the whole 18 x 12 footprint, but caliTerrain — which is what
  // the ground MESH is built from and what everything else probes — knows
  // nothing about the terrace. Measured on a grid: the raw flank crosses the
  // deck level at about 0.9 m INBOARD of the terrace centreline, so the inland
  // half of the deck is buried and the outboard half is the only part anybody
  // can stand on. Anything placed here has to be on the valley side of that
  // line, and the cart's first two positions were not.
  const kx = cx - ax * 6.6 + ox * 1.7, kz = cz - az * 6.6 + oz * 1.7;
  M.box(kx, D + 0.86, kz, 2.9, 0.16, 1.5, PALETTE.caliStoneDark, 0, yaw, 0);
  M.box(kx, D + 0.50, kz, 2.7, 0.62, 1.3, PALETTE.caliWall2, 0, yaw, 0);
  for (let s = -1; s <= 1; s += 2) {
    M.cyl(kx + ax * s * 1.2, D + 0.34, kz + az * s * 1.2, 0.34, 0.14,
          PALETTE.caliGrille, 0, 0, Math.PI / 2, 8);
  }
  // the awning, on two poles, tilted the way a tarpaulin tilts
  for (let s = -1; s <= 1; s += 2) {
    M.cyl(kx + ax * s * 1.3, D + 1.5, kz + az * s * 1.3, 0.06, 1.3, PALETTE.caliGrille);
    M.cyl(kx + ax * s * 1.3 + ox * 1.5, D + 1.4, kz + az * s * 1.3 + oz * 1.5,
          0.06, 1.1, PALETTE.caliGrille);
  }
  M.box(kx + ox * 0.7, D + 2.16, kz + oz * 0.7, 3.2, 0.08, 2.1, PALETTE.caliChivaTrim, -0.10, yaw, 0);
  // the stock: a heap of chontaduro in a basin, a stack of arepas, a jar
  M.cyl(kx - ax * 0.7, D + 0.98, kz - az * 0.7, 0.44, 0.22, PALETTE.caliGrille, 0, 0, 0, 8);
  for (let k = 0; k < 7; k++) {
    const a2 = k / 7 * Math.PI * 2;
    M.sph(kx - ax * 0.7 + Math.cos(a2) * 0.20, D + 1.10, kz - az * 0.7 + Math.sin(a2) * 0.20,
          0.09, 0.10, 0.09, PALETTE.caliChontaduro);
  }
  for (let k = 0; k < 4; k++) {
    M.cyl(kx + ax * 0.5, D + 0.98 + k * 0.055, kz + az * 0.5, 0.24, 0.05,
          PALETTE.caliArepa, 0, 0, 0, 8);
  }
  M.cyl(kx + ax * 1.05, D + 1.08, kz + az * 1.05, 0.16, 0.40, PALETTE.caliNeonGold, 0, 0, 0, 8);
  // ---- the brazier, under the near end -----------------------------------
  const bx = kx - ax * 1.5, bz2 = kz - az * 1.5;
  M.cyl(bx, D + 0.22, bz2, 0.32, 0.44, PALETTE.caliGrille, 0, 0, 0, 8);
  M.cyl(bx, D + 0.46, bz2, 0.34, 0.05, PALETTE.caliStoneDark, 0, 0, 0, 8);
  F.sph(bx, D + 0.48, bz2, 0.24, 0.10, 0.24, PALETTE.caliEmber);
  F.cone(bx, D + 0.62, bz2, 0.16, 0.34, PALETTE.caliEmber);

  // ---- the viewer, at the rail -------------------------------------------
  const vx = cx - ax * 4.2 + ox * (caliMIR_HZ - 1.5);
  const vz = cz - az * 4.2 + oz * (caliMIR_HZ - 1.5);
  M.cyl(vx, D + 0.55, vz, 0.13, 1.1, PALETTE.caliGrille, 0, 0, 0, 6);
  M.box(vx, D + 1.16, vz, 0.5, 0.16, 0.5, PALETTE.caliGrille);
  M.cyl(vx, D + 1.42, vz, 0.13, 1.00, PALETTE.caliChivaBlue, -1.25, yaw, 0, 8);
  M.cyl(vx + ox * 0.34, D + 1.10, vz + oz * 0.34, 0.17, 0.10, PALETTE.caliStoneDark, -1.25, yaw, 0, 8);

  // ---- the padlocks and ribbons on the rail -------------------------------
  // The rail is 17 posts at 1.05 m along the contour — see caliBuildMirador.
  const cols = [PALETTE.caliNeonPink, PALETTE.caliNeonCyan, PALETTE.caliNeonGold,
                PALETTE.caliWall1, PALETTE.caliWall3, PALETTE.caliChivaGrn];
  for (let k = -7; k <= 7; k++) {
    const px = cx + ox * caliMIR_HZ + ax * k * 1.05;
    const pz = cz + oz * caliMIR_HZ + az * k * 1.05;
    for (let q = 0; q < 3; q++) {
      const t = 1.05 + q * 0.14;
      M.box(px + ax * (q - 1) * 0.24, D + t, pz + az * (q - 1) * 0.24,
            0.09, 0.13, 0.05, PALETTE.caliGrille, 0, yaw, 0);
    }
    if (k % 2 === 0) {
      // a ribbon, hanging and blowing the one way the wind goes up here
      M.box(px + ax * 0.3, D + 0.78, pz + az * 0.3, 0.06, 0.62, 0.05,
            cols[(k + 8) % cols.length], 0.22, yaw, 0);
    }
  }
  // ---- and a string of bulbs along the rail -------------------------------
  // Two lamp standards light a terrace; a string of bulbs says somebody meant
  // it to be somewhere you STAY after dark. It rides the same emissive mesh as
  // the coals, so it comes up with the ride at no extra draw call, and the wire
  // it hangs on is on the opaque mesh with everything else.
  for (let k = -6; k < 6; k++) {
    const p0 = k * 1.5, p1 = (k + 1) * 1.5;
    const sag = 0.22;
    const y0 = D + 1.72 - Math.sin(((k + 6) % 2) * 0.5 * Math.PI) * 0;
    void y0;
    const mx2 = cx + ax * (p0 + p1) * 0.5 + ox * (caliMIR_HZ - 0.15);
    const mz2 = cz + az * (p0 + p1) * 0.5 + oz * (caliMIR_HZ - 0.15);
    M.box(mx2, D + 1.66 - sag * 0.5, mz2, 1.55, 0.04, 0.04, PALETTE.caliGrille, 0, yaw, 0);
    F.sph(cx + ax * p1 + ox * (caliMIR_HZ - 0.15), D + 1.52,
          cz + az * p1 + oz * (caliMIR_HZ - 0.15), 0.10, 0.13, 0.10,
          (k % 3 === 0) ? PALETTE.caliNeonGold : (k % 3 === 1 ? PALETTE.caliCityLite : PALETTE.caliNeonPink));
  }
  const m = new THREE.Mesh(M.build(), caliVC());
  m.castShadow = true;
  m.receiveShadow = true;
  root.add(m);
  // the coals and the bulbs: their own mesh, their own emissive, and they come
  // up with the dark exactly the way the two lamp standards do
  const fm = new THREE.Mesh(F.build(), mat(0x000000, {
    vertexColors: true, emissive: 0xffffff,
  }).clone());
  fm.material.emissiveIntensity = 0;
  fm.frustumCulled = false;
  root.add(fm);
  caliBrazier = fm;
  caliBrazierMat = fm.material;
  void game;
  return { kx: kx, kz: kz, ax: ax, az: az, ox: ox, oz: oz };
}

// ========================================================== THE RINGSIDE ====
/**
 * TEN PEOPLE DANCING AND NOBODY WATCHING THEM.
 *
 * caliBuildDancers put five couples on the floor and its own comment explains
 * exactly why — the tutorial, the figure, the room. What it left is a floor
 * where every single person present is dancing, which is not what a salsoteca
 * is. Most of the room is at the edge of it: at the bar with a drink, leaning
 * on the ring wall, waiting for somebody, and CLAPPING — on 2 and on 6, which
 * is where a caleño audience claps and is the same eight the dancers are
 * stepping to.
 *
 * They matter mechanically as well as decoratively. The player's combo is
 * judged on the beat, the dancers demonstrate it with their feet, and eighteen
 * pairs of hands doing it at head height is the same information again in the
 * one channel a player looking at their own animal can still see.
 */
const caliWATCH_N = 18;
let caliWatchMesh = null, caliWatchHead = null, caliWatchArm = null, caliWatchData = null;
function caliBuildWatchers(game, root) {
  const B = caliMerger();
  B.box(-0.10, 0.34, 0, 0.16, 0.68, 0.18, 0xffffff);
  B.box(0.10, 0.34, 0, 0.16, 0.68, 0.18, 0xffffff);
  B.box(0, 0.94, 0, 0.46, 0.58, 0.27, 0xffffff);
  B.box(0, 1.24, 0, 0.48, 0.08, 0.29, 0xffffff);
  caliWatchMesh = new THREE.InstancedMesh(B.build(), caliVC(), caliWATCH_N);
  caliWatchMesh.castShadow = true;
  caliWatchMesh.frustumCulled = false;
  caliWatchMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(caliWATCH_N * 3), 3);

  const H = caliMerger();
  H.sph(0, 0, 0, 0.13, 0.15, 0.13, PALETTE.skin3);
  H.sph(0, 0.07, -0.02, 0.135, 0.11, 0.135, PALETTE.hair2);
  H.box(0, 0, 0.13, 0.05, 0.05, 0.05, PALETTE.skin3);
  caliWatchHead = new THREE.InstancedMesh(H.build(), caliVC(), caliWATCH_N);
  caliWatchHead.frustumCulled = false;

  // THE HANDS ARE THEIR OWN INSTANCE. A clap is two hands coming together in
  // front of the chest, and the only way to get it out of one merged figure is
  // to scale the gap — so the pair is a separate mesh whose x scale goes to
  // nearly nothing on the beat. One extra draw for the thing the whole crowd
  // is for.
  const A = caliMerger();
  for (let s = -1; s <= 1; s += 2) {
    A.box(s * 0.5, 0, 0, 0.13, 0.13, 0.30, PALETTE.skin3);
  }
  caliWatchArm = new THREE.InstancedMesh(A.build(), caliVC(), caliWATCH_N);
  caliWatchArm.frustumCulled = false;

  const shirts = [PALETTE.caliWall1, PALETTE.caliWall2, PALETTE.caliWall3,
                  PALETTE.caliWall5, PALETTE.caliWall6, PALETTE.caliNeonPink,
                  PALETTE.caliNeonCyan, PALETTE.caliChivaTrim, PALETTE.caliNeonGold];
  const c = new THREE.Color();
  const y = caliTerrain(caliFLOOR.x, caliFLOOR.z) + 0.20;
  caliWatchData = new Float32Array(caliWATCH_N * 4);        // x, z, yaw, phase
  for (let i = 0; i < caliWATCH_N; i++) {
    let px, pz, face;
    if (i < 6) {
      // at the bar, which caliBuildSalsoteca puts across the back
      px = caliFLOOR.x + caliFLOOR.r * 0.1 - 3.0 + i * 1.2;
      pz = caliFLOOR.z + caliFLOOR.r - 0.9;
      face = Math.PI;                                       // facing the bar
    } else {
      // round the ring wall, and NOT across the way in — the gap the street
      // arrives through is at a = 4.06..5.36 (see caliBuildSalsoteca)
      const a = 5.45 + (i - 6) * (4.00 - 5.45 + Math.PI * 2) / 11;
      px = caliFLOOR.x + Math.cos(a) * (caliFLOOR.r + 0.35);
      pz = caliFLOOR.z + Math.sin(a) * (caliFLOOR.r + 0.35);
      face = Math.atan2(caliFLOOR.x - px, caliFLOOR.z - pz);  // facing in
    }
    caliWatchData[i * 4] = px;
    caliWatchData[i * 4 + 1] = pz;
    caliWatchData[i * 4 + 2] = face;
    caliWatchData[i * 4 + 3] = (i * 1.7) % 6.28;
    c.set(shirts[i % shirts.length]);
    caliWatchMesh.setColorAt(i, c);
  }
  caliWatchY = y;
  if (caliWatchMesh.instanceColor) caliWatchMesh.instanceColor.needsUpdate = true;
  root.add(caliWatchMesh);
  root.add(caliWatchHead);
  root.add(caliWatchArm);
  // ---- ...AND THE RINGSIDE IS SOLID (v36) -------------------------------
  //
  // THE RING, AND DELIBERATELY NOT THE FLOOR. `qa/CROWDS.md` left Cali open
  // because "the ten dancers move on the floor the player has to dance on, and
  // making the crowd solid changes how the chapter PLAYS" — which is true of
  // the dancers and is not true of these eighteen. They stand at the bar and
  // around the outside of the ring wall, they never move after this loop, and
  // every one of them is at `caliFLOOR.r + 0.35` or behind the bar: outside
  // the circle `salsa-dance` is scored in. So the edge of the salsoteca stops
  // being a mural and the floor itself is untouched.
  //
  // One pooled body, because nothing here moves. The dancers keep their
  // ghosthood on purpose and that is the open call, still open.
  if (game && typeof game.addCrowdBodies === 'function') {
    game.addCrowdBodies({ n: caliWATCH_N, at: function (i, out) {
      out.x = caliWatchData[i * 4];
      out.y = caliWatchY;
      out.z = caliWatchData[i * 4 + 1];
      return true;
    } });
  }
  caliUpdateWatchers(null);
}
let caliWatchY = 0;

/** The ringside, on the beat. Two claps a bar, on 2 and on 6. */
function caliUpdateWatchers(game) {
  if (!caliWatchMesh) return;
  const mus = game && game.music;
  // the same fallback the dancers use: a floor of people frozen solid before
  // the first gesture unlocks the AudioContext reads as a bug, not as a room
  const beats = (mus && mus.playing) ? mus.beats() : caliTime * (100 / 60);
  const cheer = caliDanceCheer > 0 ? caliDanceCheer : 0;
  for (let i = 0; i < caliWATCH_N; i++) {
    const o = i * 4;
    const ph = caliWatchData[o + 3];
    const b = beats + ph * 0.06;
    const count = ((Math.floor(b) % 8) + 8) % 8;
    const f = b - Math.floor(b);
    // 1 at the instant of the clap, gone over the next third of a beat
    const on = (count === 1 || count === 5) ? clamp(1 - f * 3.2, 0, 1) : 0;
    // and when the capybara gets its eight in a row, everybody claps
    const hit = Math.max(on, cheer > 0 ? clamp(Math.sin(cheer * 20) * 0.5 + 0.5, 0, 1) : 0);
    const sway = Math.sin(b * Math.PI + ph) * 0.055;
    const y = caliWatchY + hit * 0.035 + cheer * 0.06;
    const yaw = caliWatchData[o + 2] + sway;
    caliWatchMesh.setMatrixAt(i, caliXform(caliWatchData[o], y, caliWatchData[o + 1],
                                           0, yaw, sway * 0.5, 1, 1, 1));
    caliWatchHead.setMatrixAt(i, caliXform(caliWatchData[o], y + 1.38, caliWatchData[o + 1],
                                           0, yaw, sway * 0.5, 1, 1, 1));
    // the hands: apart at rest, together on the clap, and up a little with it
    const gap = 1 - hit * 0.86;
    caliWatchArm.setMatrixAt(i, caliXform(
      caliWatchData[o] + Math.sin(yaw) * 0.30, y + 1.02 + hit * 0.09,
      caliWatchData[o + 1] + Math.cos(yaw) * 0.30, 0, yaw, 0, gap, 1, 1));
  }
  caliWatchMesh.instanceMatrix.needsUpdate = true;
  caliWatchHead.instanceMatrix.needsUpdate = true;
  caliWatchArm.instanceMatrix.needsUpdate = true;
}

// ========================================================= THE STREET'S OWN ==
/**
 * WHAT IS ACTUALLY ON A SAN ANTONIO PAVEMENT.
 *
 * The painted street was eighteen houses, a stone road, two gutters and some
 * bunting — and nothing between the wall and the kerb. A barrio street in Cali
 * is never that empty: there is a bougainvillea over every second doorway, a
 * paint tin with a plant in it beside the step, a stool somebody left out, and
 * a power pole every fourth house with far more cable on it than any building
 * on that street could possibly need.
 *
 * The poles matter for a second reason. This chapter's hazard is a CABLE at the
 * height of a bus roof, three of them, up on the hill road — and the player
 * meets that mechanic cold. A street already strung with wire teaches the shape
 * of the thing forty seconds before it is asked to be hopped.
 */
function caliBuildStreetLife(game, root) {
  const S = caliMerger();
  const leaves = [], fronds = [];   // bougainvillea, and plantain
  const sy0 = caliTerrain(0, caliSTREET_Z);
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 9; i++) {
      const hx = -44 + i * 11 + (side > 0 ? 4 : 0);
      const hz = caliSTREET_Z + side * 11;
      // the salsoteca's plot has no house on it and must have no furniture
      // either — see caliBuildStreet
      const nx = clamp(caliFLOOR.x, hx - 5, hx + 5);
      const nz = clamp(caliFLOOR.z, hz - 4.3, hz + 4.3);
      if (Math.hypot(nx - caliFLOOR.x, nz - caliFLOOR.z) < caliFLOOR.r + 2.2) continue;
      const fz = hz - side * 5.2;                 // just off the frontage
      const fy = caliTerrain(hx, fz);
      if (i % 2 === 0) {
        // BOUGAINVILLEA over the door. It is the loudest plant in the world and
        // half of San Antonio is under one.
        const bx = hx - 2.4;
        S.cyl(bx, fy + 1.1, fz + side * 0.3, 0.10, 2.2, PALETTE.caliCaneStem, 0, 0, 0.08, 6);
        for (let k = 0; k < 5; k++) {
          const a = k / 5 * Math.PI * 2;
          caliPush9(leaves, bx + Math.cos(a) * 0.9, fy + 2.3 + (k % 2) * 0.32,
                    fz + side * 0.3 + Math.sin(a) * 0.7, rand(-0.3, 0.3), rand(0, 3), rand(-0.3, 0.3),
                    1.5, 0.5, 1.4);
        }
      } else {
        // a paint tin with something in it, and a plastic stool
        S.cyl(hx + 2.6, fy + 0.26, fz, 0.30, 0.52, PALETTE.caliWall3, 0, 0, 0, 8);
        for (let k = 0; k < 3; k++) {
          caliPush9(fronds, hx + 2.6 + rand(-0.3, 0.3), fy + 0.75 + k * 0.18, fz + rand(-0.3, 0.3),
                    rand(-0.4, 0.4), rand(0, 3), rand(-0.4, 0.4), 0.8, 0.32, 0.75);
        }
        S.cyl(hx + 3.9, fy + 0.22, fz, 0.22, 0.44, PALETTE.caliWall1, 0, 0, 0, 6);
        S.cyl(hx + 3.9, fy + 0.45, fz, 0.26, 0.06, PALETTE.caliWall2, 0, 0, 0, 6);
      }
      // ---- the pole, every third house, and the mess on it -----------------
      if (i % 3 === 1 && side < 0) {
        const px = hx + 5.5, pz = caliSTREET_Z - 6.8;
        const py = caliTerrain(px, pz);
        S.cyl(px, py + 4.2, pz, 0.17, 8.4, PALETTE.caliStoneDark, 0, 0, 0, 6);
        for (let k = 0; k < 2; k++) {
          S.box(px, py + 7.4 - k * 0.7, pz, 0.14, 0.12, 1.7, PALETTE.caliGrille);
        }
        // a transformer, a meter box, and the coil of slack every pole carries
        S.cyl(px + 0.42, py + 6.2, pz, 0.30, 0.7, PALETTE.caliGrille, 0, 0, 0, 6);
        S.box(px - 0.34, py + 2.4, pz, 0.34, 0.5, 0.24, PALETTE.caliShutter);
        for (let k = 0; k < 5; k++) {
          const a = k / 5 * Math.PI * 2;
          S.box(px + Math.cos(a) * 0.34, py + 5.2, pz + Math.sin(a) * 0.34,
                0.06, 0.06, 0.7, PALETTE.caliGrille, 0, a, 0);
        }
        // and the span across the road, sagging, to the opposite kerb
        const qz = caliSTREET_Z + 6.8, qy = caliTerrain(px, qz) + 7.2;
        for (let k = 0; k < 5; k++) {
          const t0 = k / 5, t1 = (k + 1) / 5;
          const z0 = lerp(pz, qz, t0), z1 = lerp(pz, qz, t1);
          const h0 = lerp(py + 7.4, qy, t0) - Math.sin(t0 * Math.PI) * 0.45;
          const h1 = lerp(py + 7.4, qy, t1) - Math.sin(t1 * Math.PI) * 0.45;
          S.box(px, (h0 + h1) * 0.5, (z0 + z1) * 0.5, 0.05,
                Math.hypot(z1 - z0, h1 - h0) + 0.04, 0.05, PALETTE.caliGrille,
                Math.atan2(z1 - z0, h1 - h0), 0, 0);
        }
        caliStaticBox(game, px, py + 2.0, pz, 0.2, 2.0, 0.2);
      }
    }
  }
  // ---- and the strip between the town and the cane ------------------------
  // From the dance floor, the east side of the chapter is a hundred metres of
  // unbroken lawn and then the cane starts: the world visibly stops. A plantain
  // grove is what is actually between a Valle town and its cane, and a plantain
  // is four enormous leaves on a stem — twelve triangles that read from sixty
  // metres. The strip runs from the east end of the terraces (x = 50) to the
  // first row of cane (x0 = 62), so it fills the seam rather than the field.
  for (let i = 0; i < 90; i++) {
    const x = rand(50, 61), z = rand(-30, 92);
    if (!caliOffRoute(x, z, 6)) continue;
    if (Math.hypot(x - caliFLOOR.x, z - caliFLOOR.z) < caliFLOOR.r + 12) continue;
    if (Math.abs(x - caliKITE.x) < 14 && Math.abs(z - caliKITE.z) < 14) continue;
    if (Math.abs(z - caliRIVER_Z) < caliRIVER_HZ + 6) continue;
    const y = caliTerrain(x, z);
    const h = rand(2.2, 3.4);
    S.cyl(x, y + h * 0.45, z, 0.16, h * 0.9, PALETTE.caliCaneStem, 0, 0, 0, 6);
    for (let k = 0; k < 4; k++) {
      const a = k / 4 * Math.PI * 2 + rand(-0.2, 0.2);
      caliPush9(fronds, x + Math.cos(a) * 0.9, y + h - 0.25, z + Math.sin(a) * 0.9,
                0, -a, -0.5, 2.6, 0.10, 0.95);
    }
  }
  const m = new THREE.Mesh(S.build(), caliVC());
  m.castShadow = true;
  m.receiveShadow = true;
  root.add(m);
  // TWO LISTS, TWO COLOURS. A bougainvillea is magenta and a plantain is
  // green, and one instanced draw cannot be both — the first cut had ninety
  // plantains in the east field rendering as fuchsia.
  swayMesh(caliInstance(root, caliG.box, PALETTE.caliBougain, leaves, true, false),
           { leaf: 0.55, amount: 0.09, axis: 'y', auto: true, stiff: 2.0, hz: 1.2 });
  // ---- AND THE PLANTAINS MOVE (v44) -------------------------------------
  // See THE WAKE in shared.js. A plantain leaf is two metres of unsupported
  // membrane and it is the loosest thing in this chapter; the bougainvillea
  // beside it is woody and gets a third of the travel.
  swayMesh(caliInstance(root, caliG.box, PALETTE.caliPlantain, fronds, true, false),
           { leaf: 0.55, amount: 0.30, axis: 'y', auto: true, stiff: 1.3, hz: 0.85 });
  void sy0;
}

// ================================================================ SUGARCANE ==
function caliBuildCane(root) {
  const stems = [], tops = [];
  caliCanePhase = new Float32Array(caliCANE_N);
  for (let i = 0; i < caliCANE_N; i++) {
    // planted in ROWS, because that is what a cane field is
    const row = Math.floor(i / 14);
    const x = caliCANE.x0 + (row * 3.1) % (caliCANE.x1 - caliCANE.x0) + rand(-0.5, 0.5);
    const z = caliCANE.z0 + ((i % 14) / 14) * (caliCANE.z1 - caliCANE.z0) + rand(-2.4, 2.4);
    const y = caliTerrain(x, z);
    const h = rand(4.2, 5.6);
    caliCanePhase[i] = rand(0, Math.PI * 2);
    caliPush9(stems, x, y + h * 0.5, z, 0, rand(0, 3), 0, 0.16, h, 0.16);
    for (let k = 0; k < 3; k++) {
      caliPush9(tops, x, y + h * (0.62 + k * 0.16), z, rand(-0.5, 0.5), rand(0, 3), rand(-0.5, 0.5),
                1.5, 1.5, 0.14);
    }
  }
  caliCaneList = stems;
  caliCaneMesh = caliInstance(root, caliG.cyl6, PALETTE.caliCaneStem, stems, true, false);
  // the cane tops. The STEMS are left alone: caliUpdateCane already solves
  // them, and two writers on one transform is the trap this codebase keeps
  // relearning.
  swayMesh(caliInstance(root, caliG.plane, PALETTE.caliCane, tops, false, false),
           { leaf: 0.55, amount: 0.22, axis: 'y', auto: true, stiff: 1.4, hz: 1.0 });
}

function caliUpdateCane() {
  if (!caliCaneMesh) return;
  // 20 Hz is plenty for a breeze through 620 stems, and it is the most
  // expensive thing in the biome by an order of magnitude
  const tick = caliTime * 20 | 0;
  if (tick === caliCaneLast) return;
  caliCaneLast = tick;
  const l = caliCaneList;
  for (let i = 0; i < caliCANE_N; i++) {
    const o = i * 9;
    const w = Math.sin(caliTime * 1.3 + caliCanePhase[i]) * 0.07;
    caliCaneMesh.setMatrixAt(i, caliXform(l[o], l[o + 1], l[o + 2], w, l[o + 4], w * 0.6,
                                          l[o + 6], l[o + 7], l[o + 8]));
  }
  caliCaneMesh.instanceMatrix.needsUpdate = true;
}

// ================================================================ CRISTO REY ==
function caliBuildCristo(game, root) {
  const C = caliMerger();
  const x = caliCRISTO.x, z = caliCRISTO.z, y = caliTerrain(x, z);
  // the plinth and its steps
  C.box(x, y + 1.2, z, 14, 2.4, 14, PALETTE.caliStoneDark);
  C.box(x, y + 2.5, z, 11, 0.4, 11, PALETTE.caliStone);
  caliStaticBox(game, x, y + 1.2, z, 7, 1.35, 7);
  for (let k = 0; k < 4; k++) {
    C.box(x, y + 0.2 + k * 0.35, z + 8 - k * 1.1, 12 - k, 0.35, 2.2, PALETTE.caliStone);
    caliStaticBox(game, x, y + 0.2 + k * 0.35, z + 8 - k * 1.1, (12 - k) * 0.5, 0.22, 1.1);
  }
  // the figure: 26 m of it, arms straight out. Blocky on purpose — this is a
  // silhouette seen from four hundred metres away, and detail would be noise.
  const by = y + 2.7;
  C.box(x, by + 8.5, z, 4.4, 17, 2.6, PALETTE.caliCristo);           // robe
  C.box(x, by + 3.2, z, 5.6, 6.4, 3.0, PALETTE.caliCristo);          // the hem, wider
  C.box(x, by + 18.6, z, 2.4, 3.2, 2.4, PALETTE.caliCristo);         // head
  C.box(x, by + 20.4, z, 2.8, 0.5, 2.8, PALETTE.caliCristo);
  for (let s = -1; s <= 1; s += 2) {
    C.box(x + s * 6.4, by + 15.4, z, 9.0, 1.7, 1.7, PALETTE.caliCristo);   // arms
    C.box(x + s * 10.8, by + 15.0, z, 1.2, 1.2, 1.6, PALETTE.caliCristo);  // hands
  }
  const m = new THREE.Mesh(C.build(), caliVC());
  m.castShadow = true;
  m.receiveShadow = true;
  m.frustumCulled = false;
  root.add(m);

  // Las Tres Cruces, on the other ridge. Three crosses, and nothing else.
  const T = caliMerger();
  const tx = caliCRUCES.x, tz = caliCRUCES.z, ty = caliTerrain(tx, tz);
  for (let i = -1; i <= 1; i++) {
    const h = i === 0 ? 15 : 11;
    T.box(tx + i * 11, ty + h * 0.5, tz, 1.5, h, 1.5, PALETTE.caliStone);
    T.box(tx + i * 11, ty + h * 0.76, tz, 7.0, 1.5, 1.5, PALETTE.caliStone);
  }
  const tm = new THREE.Mesh(T.build(), caliVC());
  tm.castShadow = false;
  // registerShadowTarget turns an opaque refusal back on unless it is flagged.
  tm.userData.noShadow = true;
  tm.frustumCulled = false;
  root.add(tm);
}

// ==================================================================== FLORA ==
function caliBuildFlora(root) {
  const trunks = [], fronds = [], canopy = [];
  for (let i = 0; i < caliPALM_N; i++) {
    let x = 0, z = 0, ok = false;
    for (let k = 0; k < 24 && !ok; k++) {
      x = rand(-90, 60); z = rand(-70, 100);
      if (caliSlope(x, z) > 0.5) continue;
      if (Math.abs(z - caliRIVER_Z) < caliRIVER_HZ + 6) continue;
      if (Math.abs(z - caliSTREET_Z) < 17) continue;
      // + 14, not + 6: a palm's fronds reach eight metres out from its trunk,
      // so a tree rejected at seventeen metres still hangs its crown over half
      // the dance floor from above — which is the only angle this game has.
      if (Math.hypot(x - caliFLOOR.x, z - caliFLOOR.z) < caliFLOOR.r + 14) continue;
      if (Math.hypot(x - caliERMITA.x, z - caliERMITA.z) < 16) continue;
      // AND NOT ON THE MIRADOR. The flank up there used to fall at nearly sixty
      // per cent, so the slope test rejected it for free; cutting the terrace
      // into caliTerrain made it the flattest ground on the ridge and the very
      // next build put a ceiba through the middle of the terrace. A shelf that
      // becomes flat becomes attractive to every placer that tests slope.
      // A RADIUS, NOT THE FOOTPRINT. caliMiradorT is zero at the edge of the
      // deck and the bench is cut 3.2 m proud of it on every side, so testing
      // the footprint still allowed a ceiba on the shelf immediately outside
      // the paving — whose canopy is eight metres across and fills the frame
      // you arrive into. Twenty-two metres clears the terrace and its cut.
      if (Math.hypot(x - caliMIRADOR.x, z - caliMIRADOR.z) < 22) continue;
      ok = true;
    }
    if (!ok) continue;
    const y = caliTerrain(x, z);
    if (i % 3 === 0) {
      // a ceiba: enormous, flat-topped, the tree of the valley
      // A ceiba is broad, but a 22 m flat disc of green parked next to the
      // camera is a wall, not a tree: four smaller overlapping crowns at
      // different heights read as one big canopy and never fill the frame.
      const h = rand(9, 13);
      caliPush9(trunks, x, y + h * 0.45, z, 0, rand(0, 3), 0, 1.3, h, 1.3);
      for (let k = 0; k < 4; k++) {
        const rr = h * (0.62 - k * 0.10);
        caliPush9(canopy, x + rand(-2.6, 2.6), y + h * (0.84 + k * 0.075), z + rand(-2.6, 2.6),
                  0, rand(0, 3), 0, rr, h * 0.22, rr);
      }
    } else {
      // a palm
      const h = rand(8, 14);
      caliPush9(trunks, x, y + h * 0.5, z, 0, rand(0, 3), 0, 0.42, h, 0.42);
      // fronds droop, and they are long: a palm read as a starburst of flat
      // planks is the tell of a placeholder
      for (let k = 0; k < 8; k++) {
        const a = k / 8 * Math.PI * 2 + rand(-0.12, 0.12);
        caliPush9(fronds, x + Math.cos(a) * 2.6, y + h - 0.5, z + Math.sin(a) * 2.6,
                  0, -a, -0.34, 5.6, 0.12, 1.05);
        caliPush9(fronds, x + Math.cos(a) * 4.6, y + h - 1.5, z + Math.sin(a) * 4.6,
                  0, -a, -0.72, 3.4, 0.10, 0.8);
      }
    }
  }
  caliInstance(root, caliG.cyl6, PALETTE.caliCaneStem, trunks, true, false);
  caliInstance(root, caliG.box, PALETTE.caliPalm, fronds, true, false);
  caliInstance(root, caliG.cyl6, PALETTE.caliCeiba, canopy, true, false);
}

// ===================================================================== FX ====
function caliBuildSparks(root) {
  caliSpark = new THREE.InstancedMesh(
    caliG.plane, mat(PALETTE.caliNeonGold, { transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    caliSPARK_N);
  caliSpark.frustumCulled = false;
  caliSpark.castShadow = false;
  for (let i = 0; i < caliSPARK_N; i++) {
    caliSpark.setMatrixAt(i, caliXform(0, -900, 0, 0, 0, 0, 0.001, 0.001, 0.001));
  }
  caliSpark.instanceMatrix.needsUpdate = true;
  root.add(caliSpark);
}

function caliBurstSparks(x, y, z, n, up) {
  for (let k = 0; k < n; k++) {
    let slot = -1;
    for (let i = 0; i < caliSPARK_N; i++) if (caliSparkData[i * 7 + 6] <= 0) { slot = i; break; }
    if (slot < 0) return;
    const o = slot * 7;
    const a = rand(0, Math.PI * 2), s = rand(1.4, 4.0);
    caliSparkData[o] = x; caliSparkData[o + 1] = y; caliSparkData[o + 2] = z;
    caliSparkData[o + 3] = Math.cos(a) * s;
    caliSparkData[o + 4] = rand(2.0, 5.0) * (up || 1);
    caliSparkData[o + 5] = Math.sin(a) * s;
    caliSparkData[o + 6] = 1;
  }
}

function caliUpdateSparks(dt) {
  if (!caliSpark) return;
  let live = false;
  for (let i = 0; i < caliSPARK_N; i++) {
    const o = i * 7;
    if (caliSparkData[o + 6] <= 0) continue;
    live = true;
    caliSparkData[o + 6] -= dt * 1.5;
    caliSparkData[o + 4] -= 14 * dt;
    caliSparkData[o] += caliSparkData[o + 3] * dt;
    caliSparkData[o + 1] += caliSparkData[o + 4] * dt;
    caliSparkData[o + 2] += caliSparkData[o + 5] * dt;
    const L = caliSparkData[o + 6];
    if (L <= 0) {
      caliSpark.setMatrixAt(i, caliXform(0, -900, 0, 0, 0, 0, 0.001, 0.001, 0.001));
      continue;
    }
    const s = 0.22 * L + 0.06;
    caliSpark.setMatrixAt(i, caliXform(caliSparkData[o], caliSparkData[o + 1], caliSparkData[o + 2],
                                       caliTime * 5 + i, i, 0, s, s, s));
  }
  if (live) caliSpark.instanceMatrix.needsUpdate = true;
}

// ================================================================ THE DANCE ==
// ================================================================ THE KITES ==
// NOT A TASK, AND NOT REACHABLE, WHICH IS THE POINT.
//
// Everything that moves in Cali moves because the player is doing something to
// it: the chiva leaves when you get on the roof, the barrow goes when you kick
// the chock out, the salsa floor scores you, the wires are a route. There is
// nothing in this chapter that is simply GOING ON.
//
// In Colombia August is the month of the wind and every hill in the country has
// cometas on it. There are five over San Antonio, on strings a good forty metres
// long, and they do the thing kites do — hang, sulk, take a gust, dive, and get
// hauled back up by somebody the player cannot see.
const caliKITE_N = 5;
const caliKITE = { x: -6, z: caliSTREET_Z + 26 };   // anchored over the hill, downwind
let caliKiteMesh = null, caliKiteLineMesh = null, caliKiteSeed = null;
let caliKiteT = 0;

// ============================================================ THE PARAKEETS ==
/**
 * CALI HAD NOTHING IN THE AIR.
 *
 * Sixteen chapters and this was the only one of the three cities with no
 * flying thing in it at all: Kyoto has its cormorants and its swallows, Rio has
 * seventy frigatebirds over the point, and the whole sky over a valley of two
 * and a half million people was five kites on strings and nothing else. From
 * this camera the upper third of most frames is air, and air with nothing in it
 * is the single cheapest way for a world to read as a diorama.
 *
 * The right bird here is not a gull. It is the loro — the green parakeet flock
 * that goes over Cali twice a day, and does it in a shrieking ragged line about
 * twenty metres up. Two things that matter:
 *
 *   1. THEY FLAP. Constantly, fast, and slightly out of phase with each other.
 *      A frigatebird soars and Rio's rig is built for that; a parakeet that
 *      soars is a paper aeroplane.
 *   2. THEY GO OVER AT DUSK. This chapter is the one that puts the sun down
 *      itself — see caliNight() — so the flock has something to do with the
 *      chapter's own clock rather than being weather. When the lights come on,
 *      the whole flock crosses the valley at once and says so, which turns a
 *      lighting change into an EVENT that happens in the world.
 *
 * One instanced draw, no allocation after the build, no collider, no shadow.
 */
const caliLORO_N = 38;
let caliLoroMesh = null, caliLoroSeed = null, caliLoroT = 0;
let caliLoroCall = 6, caliLoroDusk = 0, caliLoroWas = 0;

function caliBuildLoros(root) {
  const M = caliMerger();
  // A parakeet in plan is a dart: a short fat body, a very long tail and two
  // stubby swept wings. The tail is the only part anybody would name.
  M.box(0, 0, 0, 0.16, 0.15, 0.34, PALETTE.caliPlantain);
  M.box(0, 0.03, 0.22, 0.11, 0.10, 0.14, PALETTE.caliCane);
  M.cone(0, 0.01, 0.31, 0.045, 0.14, PALETTE.caliChivaTrim, Math.PI / 2, 0, 0, 4);
  M.box(0, 0, -0.42, 0.075, 0.045, 0.62, PALETTE.caliCeiba);
  for (let side = -1; side <= 1; side += 2) {
    M.box(side * 0.26, 0.05, -0.02, 0.42, 0.04, 0.22, PALETTE.caliPlantain, 0, side * 0.30, 0);
  }
  caliLoroMesh = new THREE.InstancedMesh(M.build(), caliVC(), caliLORO_N);
  caliLoroMesh.name = 'caliLoros';
  caliLoroMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  caliLoroMesh.frustumCulled = false;
  caliLoroMesh.castShadow = false;
  caliLoroMesh.userData.noShadow = true;   // a flock laying grey discs on a lawn
  root.add(caliLoroMesh);
  caliLoroSeed = [];
  for (let i = 0; i < caliLORO_N; i++) {
    // two loose flocks: one over the river, one over the painted street
    const g = i % 2;
    caliLoroSeed.push({
      cx: g ? -18 : 22, cz: g ? caliSTREET_Z - 8 : caliRIVER_Z + 4,
      a: (i / caliLORO_N) * 6.283 * 2.7,
      r: 12 + ((i * 7919) % 100) / 100 * 22,
      y: 17 + ((i * 65537) % 100) / 100 * 11,
      w: 0.30 + ((i * 31337) % 100) / 100 * 0.16,
      b: ((i * 104729) % 628) / 100,
      f: 17 + ((i * 40507) % 100) / 100 * 7,     // wingbeat, fast and per-bird
    });
  }
}

function caliUpdateLoros(game, dt) {
  if (!caliLoroMesh) return;
  caliLoroT += dt;

  // ---- THE DUSK CROSSING ------------------------------------------------
  // One shot, on the rising edge of the lights coming on. caliNightT only ever
  // climbs within a visit and is forced to 1 on a revisit where the mirador is
  // already ticked, so the edge has to be a real crossing rather than a level.
  const nt = (game.cali && typeof game.cali.night === 'function') ? game.cali.night() : 0;
  if (nt > 0.30 && caliLoroWas <= 0.30 && caliLoroDusk <= 0) {
    caliLoroDusk = 9.0;
    if (typeof game.sfx === 'function') {
      game.sfx('pop', { volume: 0.5, pitch: 2.9 });
      game.sfx('pop', { volume: 0.4, pitch: 3.3 });
    }
    if (typeof game.toast === 'function') game.toast('the loros are going home. all of them, at once, loudly.');
  }
  caliLoroWas = nt;
  if (caliLoroDusk > 0) caliLoroDusk -= dt;
  // 0 while they are circling, 1 while the whole flock is crossing the valley
  const cross = clamp(caliLoroDusk / 9.0, 0, 1);
  const drift = (1 - cross) * 0 + cross * (9.0 - caliLoroDusk) * 26;

  for (let i = 0; i < caliLORO_N; i++) {
    const sd = caliLoroSeed[i];
    const a = sd.a + caliLoroT * sd.w;
    const rr = sd.r * (1 + Math.sin(caliLoroT * 0.21 + sd.b) * 0.14);
    // circling, plus the whole flock sliding west across the valley at dusk
    const x = sd.cx + Math.cos(a) * rr - drift + (cross > 0 ? 0 : 0);
    const z = sd.cz + Math.sin(a) * rr * 0.7 + cross * Math.sin(sd.b) * 6;
    const y = sd.y + Math.sin(caliLoroT * 0.5 + sd.b) * 2.4 + cross * 5;
    const yaw = cross > 0.02 ? -1.5708
              : Math.atan2(-Math.sin(a), Math.cos(a) * 0.7) + Math.PI * 0.5;
    // A parakeet flaps the whole time. The wing angle rides on the roll so the
    // body rocks with the beat, which is what makes a dart read as a bird.
    const flap = Math.sin(caliLoroT * sd.f + sd.b * 5);
    caliLoroMesh.setMatrixAt(i, caliXform(x, y, z, flap * 0.10, yaw, flap * 0.34, 1, 1, 1));
  }
  caliLoroMesh.instanceMatrix.needsUpdate = true;

  // ---- and they are never quiet for long -------------------------------
  caliLoroCall -= dt;
  if (caliLoroCall <= 0) {
    caliLoroCall = (caliLoroDusk > 0 ? 0.55 : 9) + Math.random() * (caliLoroDusk > 0 ? 0.6 : 9);
    const cp = game.capy && game.capy.position;
    if (!cp || typeof game.sfx !== 'function') return;
    // over the river, which is the middle of the chapter
    const far = Math.hypot(cp.x - 0, cp.z - caliRIVER_Z);
    if (far > 120) return;
    game.sfx('pop', { volume: clamp(0.24 - far * 0.0014, 0.03, 0.24),
                      pitch: 2.5 + Math.random() * 0.9 });
  }
}

function caliBuildKites(root) {
  // A COMETA IS A DIAMOND AND A TAIL. Two triangles' worth of box, a cross spar
  // that catches the light differently, and six paper bows down forty
  // centimetres of tail — which is the part that actually reads at fifty metres,
  // because it is the part that moves independently.
  const M = caliMerger();
  M.box(0, 0, 0, 1.55, 0.05, 1.55, PALETTE.caliWall2, 0, Math.PI * 0.25, 0);
  M.box(0, 0.04, 0, 0.10, 0.05, 2.05, PALETTE.caliWall4, 0, Math.PI * 0.25, 0);
  M.box(0, 0.04, 0, 2.05, 0.05, 0.10, PALETTE.caliWall4, 0, Math.PI * 0.25, 0);
  for (let k = 0; k < 6; k++) {
    M.box(0, -0.02 - k * 0.02, -1.15 - k * 0.62, 0.34 - k * 0.03, 0.03, 0.26,
          k % 2 ? PALETTE.caliWall5 : PALETTE.caliWall3);
  }
  caliKiteMesh = new THREE.InstancedMesh(M.build(), caliVC(), caliKITE_N);
  caliKiteMesh.name = 'caliKites';
  caliKiteMesh.frustumCulled = false;
  caliKiteMesh.castShadow = false;
  caliKiteMesh.userData.noShadow = true;
  root.add(caliKiteMesh);

  // THE STRING, and it has to be drawn or five diamonds are hanging in the sky
  // for no reason. One long thin box per kite, scaled and aimed down at the
  // anchor every frame — a line the renderer would antialias into nothing.
  const L = caliMerger();
  L.box(0, 0, 0.5, 0.035, 0.035, 1.0, PALETTE.caliStoneDark);
  caliKiteLineMesh = new THREE.InstancedMesh(L.build(), caliVC(), caliKITE_N);
  caliKiteLineMesh.frustumCulled = false;
  caliKiteLineMesh.castShadow = false;
  caliKiteLineMesh.userData.noShadow = true;
  root.add(caliKiteLineMesh);

  caliKiteSeed = [];
  for (let i = 0; i < caliKITE_N; i++) {
    caliKiteSeed.push({
      ax: caliKITE.x + ((i * 7919) % 100) / 100 * 34 - 17,
      az: caliKITE.z + ((i * 65537) % 100) / 100 * 22 - 11,
      len: 26 + ((i * 31337) % 100) / 100 * 18,
      b: ((i * 104729) % 628) / 100,
      w: 0.30 + ((i * 2749) % 100) / 100 * 0.24,
    });
  }
  caliKiteT = 0;
}

function caliUpdateKites(dt) {
  if (!caliKiteMesh) return;
  caliKiteT += dt;
  for (let i = 0; i < caliKITE_N; i++) {
    const s = caliKiteSeed[i];
    const gy = caliTerrain(s.ax, s.az);
    // A KITE ON A STRING IS A PENDULUM WITH LIFT, so it is written as an angle
    // off the vertical and an angle round it, both wandering. The dive is the
    // interesting part: about once every twenty seconds it loses the wind, the
    // lean goes to nearly horizontal and the height falls, and then it catches
    // and climbs. Two sines beating gives that for free and never repeats.
    const gust = Math.sin(caliKiteT * s.w + s.b) * Math.sin(caliKiteT * 0.17 + s.b * 2);
    const lean = 0.55 + gust * 0.40;                 // rad off vertical
    const round = s.b + caliKiteT * 0.11 + Math.sin(caliKiteT * 0.23 + s.b) * 0.5;
    const len = s.len * (0.82 + gust * 0.16);
    const x = s.ax + Math.sin(round) * Math.sin(lean) * len;
    const z = s.az + Math.cos(round) * Math.sin(lean) * len;
    const y = gy + 2.0 + Math.cos(lean) * len;
    // it faces down its own string, and it flutters about that
    const dx = s.ax - x, dy = gy + 1.4 - y, dz = s.az - z;
    const d = Math.max(0.001, Math.sqrt(dx * dx + dy * dy + dz * dz));
    const yaw = Math.atan2(-dx, -dz);
    const pitch = Math.asin(clamp(-dy / d, -1, 1)) - 1.15;
    caliKiteMesh.setMatrixAt(i, caliXform(x, y, z,
      pitch + Math.sin(caliKiteT * 3.1 + s.b) * 0.09, yaw,
      Math.sin(caliKiteT * 2.3 + s.b * 3) * 0.22, 1, 1, 1));
    // and the string: one unit box stretched along the chord
    caliKiteLineMesh.setMatrixAt(i, caliXform(x, y, z, pitch + 1.15, yaw, 0, 1, 1, d));
  }
  caliKiteMesh.instanceMatrix.needsUpdate = true;
  caliKiteLineMesh.instanceMatrix.needsUpdate = true;
}

function caliTask(id) {
  const g = caliGame;
  if (g && typeof g.completeTask === 'function') g.completeTask(id);
}

/**
 * THE FLOOR.
 *
 * A step counts when the capybara does something DELIBERATE — turns hard,
 * hops, or wheeks — within caliBEAT_WINDOW of a beat of the actual salsa the
 * band is playing. The judgement runs off game.music, which is derived from
 * the AudioContext clock the notes themselves are scheduled on, so it cannot
 * drift out of sync with what the player is hearing however long they stay.
 *
 * Two things keep it fair rather than fiddly:
 *   - one step per beat, at most, and a cooldown under the beat length, so
 *     mashing cannot score;
 *   - the combo LAPSES rather than resets when you step off the floor, so
 *     being bumped by a dancer is not a punishment.
 */
/**
 * HOW WIDE THE WINDOW IS RIGHT NOW, in beats. 0.19 for everybody who has not
 * missed, and for everybody at all once the eight have landed — see the note
 * at caliMERCY_STEP for why the record does not get this.
 */
function caliWindow() {
  if (caliMercy <= 0) return caliBEAT_WINDOW;
  const n = Math.min(caliMercy, caliMERCY_MAX);
  return caliBEAT_WINDOW * Math.pow(1 + caliMERCY_STEP, n);
}

function caliUpdateDance(game, dt) {
  const capy = game.capy;
  if (!capy || !capy.position) return;
  const dx = capy.position.x - caliFLOOR.x, dz = capy.position.z - caliFLOOR.z;
  const on = (dx * dx + dz * dz) < caliFLOOR.r * caliFLOOR.r &&
             Math.abs(capy.position.y - caliTerrain(caliFLOOR.x, caliFLOOR.z)) < 3;

  if (on !== caliOnFloor) {
    caliOnFloor = on;
    if (on) {
      caliOffFloorT = 0;
      if (!caliDanceDone && typeof game.toast === 'function') {
        game.toast(game.music && game.music.playing
          ? 'on the beat: turn, hop or wheek'
          : 'turn, hop or wheek — on the beat');
      }
    }
  }
  if (!on) {
    caliOffFloorT += dt;
    if (caliOffFloorT > caliDANCE_DROP && caliCombo > 0) caliCombo = 0;
  }

  if (caliStepCool > 0) caliStepCool -= dt;
  caliFlash = damp(caliFlash, 0, 6, dt);
  caliFloorT += dt;

  // ---- THE HEADING IS SAMPLED WHETHER OR NOT YOU ARE ON THE FLOOR -------
  // onEnter clears caliLastYaw so a heading cannot cross a border (see the
  // note there), and this is the same bug one scale down: the yaw was only
  // read after the early-out below, so it held whatever the animal was facing
  // the last frame it was ON the floor. Step off, turn round, step back on,
  // and the first frame differences two headings seconds apart — a guaranteed
  // "acted", and a free step if it lands inside the window.
  if (!caliOnFloor) caliLastYaw = capy.group ? capy.group.rotation.y : 0;

  // the floor breathes with the beat whether or not anybody is on it
  const mus = game.music;
  const beatPhase = (mus && mus.playing) ? (1 - Math.abs(mus.off()) * 2) : 0;
  if (caliFloorMat) {
    const base = caliOnFloor ? 0.22 : 0.10;
    caliFloorMat.opacity = clamp(base + Math.max(0, beatPhase) * 0.20 + caliFlash * 0.55, 0, 1);
  }
  if (caliLampMesh) {
    caliLampMesh.material.opacity = clamp(0.45 + Math.max(0, beatPhase) * 0.5, 0, 1);
  }

  // ---- THE FLOOR DOES NOT CLOSE WHEN THE TICK LANDS (v32) -----------------
  // This used to be `if (!caliOnFloor || caliDanceDone) return`, which stopped
  // the scoring dead the moment the task was ticked — so `salsa-dance`, one of
  // the twenty measured runs and the only number in this chapter worth coming
  // back for, could never be improved on after the first eight-step run that
  // set it. A record that cannot be beaten is not a record. Now the floor keeps
  // counting for ever and it is only the TASK that happens once, which is what
  // `caliDanceDone` was always for.
  if (!caliOnFloor) { if (game.recordEnd) game.recordEnd('salsa-dance'); return; }
  // ...and the number is on the paper while it is being set. The current run,
  // against the standing best — see recordLive in systems.js.
  if (game.recordLive) game.recordLive('salsa-dance', caliCombo);

  // --- did the player just DO something? ---
  const yaw = capy.group ? capy.group.rotation.y : 0;
  let turned = Math.abs(yaw - caliLastYaw);
  while (turned > Math.PI) turned = Math.abs(turned - Math.PI * 2);
  const input = game.input;
  const acted = turned > caliSTEP_MIN_TURN * dt * 12 ||
                (input && (input.jumpPressed || input.honkPressed));
  caliLastYaw = yaw;
  if (!acted || caliStepCool > 0) return;

  // --- was it on the beat? ---
  if (!mus || !mus.playing) return;
  const beatIdx = Math.round(mus.beats());
  if (beatIdx === caliLastBeat) return;            // one step per beat
  const off = Math.abs(mus.off());
  caliStepCool = caliSTEP_COOL;
  caliLastBeat = beatIdx;

  if (off <= caliWindow()) {
    caliCombo++;
    if (caliCombo > caliBestCombo) {
      caliBestCombo = caliCombo;
      if (typeof game.record === 'function') game.record('salsa-dance', caliBestCombo);
    }
    caliFlash = 1;
    const y = caliTerrain(caliFLOOR.x, caliFLOOR.z) + 0.3;
    caliBurstSparks(capy.position.x, y + 0.2, capy.position.z, 4 + Math.min(6, caliCombo), 1);
    if (typeof game.sfx === 'function') {
      // the tighter the step, the brighter the answer
      game.sfx('tick', { volume: clamp(0.5 + caliCombo * 0.06, 0.5, 1), pitch: 1 + caliCombo * 0.03 });
    }
    // ---- THE ROOM COMES WITH YOU (v20) ---------------------------------
    // The combo paid out in one place — a tick, four sparks, and then nothing
    // at all until eight, when ten people whooped at once. Everything in
    // between, which is most of the mechanic, was a run of identical clicks.
    //
    // From the fourth step the floor starts answering: one voice at a time,
    // quiet, from where the dancers actually are, and a step brighter each
    // beat. It is the same escalation the torii tunnel got and it is the whole
    // difference between counting to eight and being carried to eight.
    if (caliCombo >= 3 && typeof game.sfx === 'function') {
      const k = Math.min(caliCombo - 2, 6);
      game.sfx('cheer', { volume: 0.10 + k * 0.055, pitch: 1.05 + k * 0.05,
                          at: { x: caliFLOOR.x + Math.cos(caliCombo * 2.4) * 7,
                                y: caliTerrain(caliFLOOR.x, caliFLOOR.z) + 1.2,
                                z: caliFLOOR.z + Math.sin(caliCombo * 2.4) * 7 } });
      caliDanceCheer = Math.max(caliDanceCheer, 0.30 + k * 0.09);
    }
    if (caliCombo === 4 && typeof game.toast === 'function') game.toast('¡eso!');
    if (caliCombo >= caliDANCE_TARGET && !caliDanceDone) {
      caliDanceDone = true;
      caliMercy = 0;              // the window shuts on the way through the door

      // AND THE FLOOR ANSWERS. Ten people have been dancing three metres away
      // the whole time; the moment the capybara gets eight in a row they all
      // whoop, which is the only acknowledgement this task has ever had that
      // was not a line of text in the corner.
      caliDanceCheer = 1.6;
      if (typeof game.sfx === 'function') game.sfx('cheer', { volume: 0.75, pitch: 1.15 });
      caliTask('salsa-dance');
      caliBurstSparks(capy.position.x, y + 0.6, capy.position.z, 18, 1.4);
      if (typeof game.shake === 'function') game.shake(0.2);
      if (typeof game.toast === 'function') game.toast('four feet, no hips, and eight in a row.');
    }
  } else if (caliCombo > 0) {
    caliCombo = 0;
    // ...and the floor gives a little. Only a MISS counts, only before the tick,
    // and the player is told nothing.
    if (!caliDanceDone && caliMercy < caliMERCY_MAX) caliMercy++;
    if (typeof game.sfx === 'function') game.sfx('thud', { volume: 0.22, pitch: 0.7 });
  }
}

// =============================================================== THE REST ====
let caliOrtizDone = false, caliOrtizIn = false, caliOrtizFrom = 0;

function caliUpdateTasks(game, dt) {
  const capy = game.capy;
  if (!capy || !capy.position) return;
  const p = capy.position;

  // --- sitting on the Gato ---------------------------------------------------
  if (!caliGatoDone) {
    const dx = p.x - caliGATO.x, dz = p.z - caliGATO.z;
    if (dx * dx + dz * dz < 3.6 * 3.6 && p.y > caliTerrain(caliGATO.x, caliGATO.z) + 0.6) {
      caliGatoDone = true;
      caliTask('gato-sit');
      if (typeof game.toast === 'function') game.toast('he has seen worse');
      if (typeof game.sfx === 'function') game.sfx('chime', { volume: 0.8 });
    }
  }
  // --- under the Puente Ortiz ------------------------------------------------
  // THE RIVER RUNS THROUGH THE WHOLE CHAPTER AND NOTHING EVER ASKED YOU INTO IT.
  // The Rio Cali is the axis this place is laid out along — the Gato is on one
  // bank, La Ermita on the other, the chiva crosses it — and in nine tasks the
  // water was scenery with a bridge over it.
  //
  // Two arches under the Ortiz, and the far side is the payment: it is not
  // "touch the water", it is "go all the way through", which means committing to
  // about nine metres you cannot see the end of from the bank.
  if (!caliOrtizDone) {
    const near = Math.abs(p.x - caliBRIDGE_X) < 6 && Math.abs(p.z - caliRIVER_Z) < caliRIVER_HZ;
    if (near && p.y < caliRIVER_Y + 0.7) {
      if (!caliOrtizIn) { caliOrtizIn = true; caliOrtizFrom = p.z; }
    } else if (caliOrtizIn && Math.abs(p.x - caliBRIDGE_X) > 6.5) {
      caliOrtizIn = false;
    }
    // out the other side, and it has to BE the other side
    if (caliOrtizIn && Math.abs(p.z - caliOrtizFrom) > caliRIVER_HZ * 0.9 &&
        Math.sign(p.z - caliRIVER_Z) !== Math.sign(caliOrtizFrom - caliRIVER_Z)) {
      caliOrtizDone = true;
      caliTask('puente-ortiz');
      if (typeof game.sfx === 'function') game.sfx('splash', { volume: 0.6, pitch: 0.9 });
      if (typeof game.toast === 'function') game.toast('it comes off the Farallones. it is colder than it looks.');
    }
  }
  // --- the lulada ------------------------------------------------------------
  if (!caliLuladaGone && caliLuladaMesh) {
    const q = caliLuladaMesh.position;
    if (Math.abs(p.x - q.x) < 1.5 && Math.abs(p.z - q.z) < 1.5 && Math.abs(p.y - q.y) < 2.0) {
      caliLuladaGone = true;
      caliLuladaT = 0;
      caliTask('lulada');
      caliBurstSparks(q.x, q.y + 0.3, q.z, 8, 1);
      if (typeof game.sfx === 'function') game.sfx('splash', { volume: 0.5, pitch: 1.4 });
      if (typeof game.toast === 'function') game.toast('lulo, lime, ice, and no receipt');
    }
  }
  if (caliLuladaGone && caliLuladaMesh && caliLuladaMesh.visible) {
    caliLuladaT += dt;
    caliLuladaMesh.position.y += dt * 1.4;
    caliLuladaMesh.rotation.z += dt * 6;
    if (caliLuladaT > 0.7) caliLuladaMesh.visible = false;
  }
  // --- the chiva -------------------------------------------------------------
  // Tested against WHERE SHE IS, not against where she was parked. She is a
  // vehicle now, and a position test against a constant is exactly the bug this
  // project keeps finding.
  if (!caliChivaDone && caliChivaGroup && caliOnRoof) {
    caliChivaDone = true;
    caliTask('chiva-ride');
    caliBurstSparks(p.x, p.y + 0.5, p.z, 12, 1.2);
    if (typeof game.sfx === 'function') { game.sfx('horn', { pitch: 1.4 }); game.sfx('strum'); }
    if (typeof game.toast === 'function') game.toast('the chiva does not stop. the chiva collects.');
  }
  // --- lost in the cane ------------------------------------------------------
  // ---- IT DOES NOT STOP HAPPENING WHEN IT IS TICKED (v53) -------------------
  // This was `if (!caliCaneDone) { ... }` around the whole mechanism — the same
  // one line that made Kyoto's torii tunnel and bamboo grove inert scenery the
  // moment they paid out (see kyoCheckTorii). A hundred and six metres of cane
  // is a thing you run THROUGH, and it is the only measurable set piece in a
  // chapter that had two numbers in it. The task keeps its latch; the run
  // re-arms and now carries a clock. See 'cane-run' in RECORDS.
  {
    const inside = p.x > caliCANE.x0 && p.x < caliCANE.x1 && p.z > caliCANE.z0 && p.z < caliCANE.z1;
    if (inside) {
      if (!caliCaneIn) { caliCaneIn = true; caliCaneEnterX = p.x; caliCaneT = 0; }
      caliCaneT += dt;
      // ABS, AND IT WAS NOT. The cane block runs east-west and the road down
      // the ridge comes at it from the EAST, so a player who entered from that
      // side ran the whole hundred metres of it in -x and the task never fired.
      // Nothing said so; the field simply does not end.
      const caneGone = Math.abs(p.x - caliCaneEnterX);
      // The line waits until it is a crossing rather than a step inside, for
      // the reason the bamboo grove's does: a clock on the paper every time
      // somebody walks past a field is furniture.
      if (caneGone > 12 && typeof game.recordLive === 'function') {
        game.recordLive('cane-run', caliCaneT);
      }
      if (caneGone > 34) {
        const again = caliCaneDone;
        caliCaneDone = true;
        if (typeof game.record === 'function') game.record('cane-run', caliCaneT);
        if (typeof game.recordEnd === 'function') game.recordEnd('cane-run');
        // Re-armed where you are, so turning round and going back is the next
        // attempt and not a free one — it is the same thirty-four metres either
        // way.
        caliCaneEnterX = p.x; caliCaneT = 0;
        if (typeof game.sfx === 'function') game.sfx('rustle', { volume: 1 });
        if (!again) {
          caliTask('cane-run');
          if (typeof game.toast === 'function') game.toast('nobody can see you. nobody at all.');
        }
      }
    } else {
      if (caliCaneIn && typeof game.recordEnd === 'function') game.recordEnd('cane-run');
      caliCaneIn = false;
      caliCaneT = 0;
    }
  }
  // --- Cristo Rey ------------------------------------------------------------
  if (!caliCristoDone) {
    const dx = p.x - caliCRISTO.x, dz = p.z - caliCRISTO.z;
    if (dx * dx + dz * dz < 14 * 14 && p.y > caliTerrain(caliCRISTO.x, caliCRISTO.z) + 1.0) {
      caliCristoDone = true;
      caliTask('cristo-rey');
      if (typeof game.shake === 'function') game.shake(0.16);
      if (typeof game.sfx === 'function') game.sfx('chime', { volume: 1 });
      if (typeof game.toast === 'function') game.toast('the whole valley, and a capybara in it');
    }
  }
}

// ==================================================================== API ====
function caliIsOverWater(x, z) {
  if (Math.abs(z - caliRIVER_Z) > caliRIVER_HZ) return false;
  // The deck AND its two approach spans — the lamp standards at x 0 and -12 sit
  // on those, and at 4.6 they were lamp posts standing in open water.
  if (Math.abs(x - caliBRIDGE_X) < 6.8) return false;
  // ...and the same terrain test every other biome uses. The band alone said
  // "river" for the whole 420 m length of it, including where the valley climbs
  // toward Cristo Rey in the west and the bed comes up out of the water. The
  // channel now holds water across its full drawn width (see caliTerrain), so
  // this agrees with the band everywhere it should and only trims the ends.
  return caliRIVER_Y > caliTerrain(x, z) + 0.22;
}

function caliInZone(name, x, z) {
  if (name === 'dancefloor') {
    const dx = x - caliFLOOR.x, dz = z - caliFLOOR.z;
    return dx * dx + dz * dz < caliFLOOR.r * caliFLOOR.r;
  }
  if (name === 'street') return Math.abs(z - caliSTREET_Z) < 7 && Math.abs(x) < 60;
  if (name === 'cane') {
    return x > caliCANE.x0 && x < caliCANE.x1 && z > caliCANE.z0 && z < caliCANE.z1;
  }
  if (name === 'river') return Math.abs(z - caliRIVER_Z) < caliRIVER_HZ + 4;
  // The mirador's own deck — a timber terrace 17.72 m up a hill, and the place
  // the chapter's marquee is paid out on. It had no zone, so it footfalled as
  // the 0.82 soil default along with the road and the paseo: the ladder covered
  // two of this chapter's six surfaces.
  if (name === 'terrace') {
    const dx = x - caliMIRADOR.x, dz = z - caliMIRADOR.z;
    const c = Math.cos(caliMIR_YAW), s = Math.sin(caliMIR_YAW);
    const lx = dx * c + dz * s, lz = -dx * s + dz * c;
    return lx > -caliMIR_HX - 1 && lx < caliMIR_HX + 1 && lz > -caliMIR_HZ - 1 && lz < caliMIR_HZ + 1;
  }
  return false;
}

// =============================================================== LIFECYCLE ===
export function createCali(game) {
  caliGame = game;

  game.biome.register('cali', {
    ensureBuilt() { caliBuild(game); },
    // Any stateful actor that can hold the player must let go on the way in and
    // on the way out — a bus that is halfway up a hill with the capybara's
    // reference frame attached to it is exactly that. She resets to the kerb if
    // the ride was abandoned; once the mirador is ticked she stays parked up
    // there, because that is where she now lives and the road down is walkable.
    onEnter() {
      caliCombo = 0; caliLastBeat = -1; caliOnFloor = false;
      // ---- AND THE REST OF THE FLOOR'S STATE (v20) ---------------------
      // caliLastYaw holds the capybara's heading from wherever it was standing
      // when it left, so the first frame back on the floor differences a Cali
      // yaw against a Rio one and scores a step the player did not take;
      // caliOffFloorT and caliFlash are a lapse timer and a lit board carried
      // in from another country. Three lines, same rule as the latches below.
      caliLastYaw = 0; caliOffFloorT = 0; caliStepCool = 0; caliFlash = 0;
      caliRoofT = 0; caliOnRoof = false; caliBandDuck = 0; caliWireClear = 0;
      // SAYING SHE HAS ARRIVED IS NOT THE SAME AS PUTTING HER THERE.
      // This set the state and left `caliChivaS` alone, and caliStepChiva
      // places her from the arclength — so a player who ticked the mirador on
      // foot (which the terrace test explicitly allows) came back to a chiva
      // parked at the kerb, in a state that can never start a ride again: the
      // pull-away only fires from 'parked'. Put her where the comment says she
      // is.
      caliToldAgain = false;   // D4.15: the come-back line, once per visit
      if (caliMiradorDone) {
        caliNightT = 1;
        caliChivaState = 'arrived';
        caliChivaS = caliRouteLen; caliChivaV = 0;
        caliStopIdx = caliSTOPS.length;
      } else if (caliChivaState !== 'parked') caliChivaReset();
      // AND THE JUG COMES BACK. caliLuladaGone hides the lulada and is set once
      // for the life of the page, so a second visit found a stand with a vendor
      // shouting "Lulada! Con hielo!" over an empty counter. Quay's chip basket
      // and Kyoto's matcha heap were the same omission; this is the third.
      // AND THE BARROW IS AT THE TOP. Same family as the jug below: the object
      // is a thing in the world and it does not stay where a previous visit
      // left it, thirty metres down a hill it cannot climb.
      caliCartBack = 0;
      caliCartReset();
      caliLuladaGone = false;
      caliLuladaT = 0;
      if (caliLuladaMesh) {
        caliLuladaMesh.visible = true;
        caliLuladaMesh.position.set(caliLULADA.x + 0.6,
          caliTerrain(caliLULADA.x, caliLULADA.z) + 1.24, caliLULADA.z - 0.1);
        caliLuladaMesh.rotation.z = 0;
      }
      caliUpdateNight();
    },
    onExit() {
      // ARMED FLAGS DO NOT SURVIVE TRAVEL. Every biome shares one coordinate
      // space, and a latch left set is a task that ticks in the wrong country.
      caliOrtizIn = false;
      caliCombo = 0;
      caliOnRoof = false; caliRoofT = 0; caliWireClear = 0;
      caliCaneIn = false; caliCaneT = 0;
      caliCartBack = 0;
      caliDanceCheer = 0;
      if (!caliMiradorDone && caliChivaState !== 'parked') caliChivaReset();
    },
  });

  const api = {
    /** D4.15, measured: whether the set piece can be ridden more than once. */
    /** Put her at the mirador, so the return leg needs no 465 m ride first. */
    chivaToTop() {
      caliChivaState = 'arrived'; caliChivaS = caliRouteLen; caliChivaV = 0;
      caliTurnT = 0; caliStopIdx = caliSTOPS.length;
      if (caliWires) for (let i = 0; i < caliWires.length; i++) caliWires[i].has = true;
      return caliChivaState;
    },
    chivaDebug() {
      let clear = 0, armed = 0;
      if (caliWires) for (let i = 0; i < caliWires.length; i++) {
        if (caliWires[i].has) clear++;
        if (!caliWires[i].has) armed++;
      }
      return { st: caliChivaState, s: Math.round(caliChivaS * 10) / 10,
               x: Math.round(caliChivaX * 10) / 10, y: Math.round(caliChivaY * 10) / 10,
               z: Math.round(caliChivaZ * 10) / 10,
               len: Math.round(caliRouteLen * 10) / 10,
               v: Math.round(caliChivaV * 100) / 100,
               turnT: Math.round(caliTurnT * 10) / 10, turnAt: caliCHIVA_TURN,
               onRoof: caliOnRoof, wires: caliWires ? caliWires.length : 0,
               wiresTouched: clear, wiresArmed: armed,
               clearScore: caliWireClear };
    },
    built() { return caliBuilt; },
    terrainHeight: caliTerrain,
    // Built from the static boxes themselves — see makeSolidIndex in shared.js.
    navBlocked(x, z, r) { return caliSolids.blocked(x, z, r, caliTerrain); },
    slopeAt: caliSlope,
    waterLevel: caliRIVER_Y,
    /** The Ortiz, for the beacon: the only two arches in the chapter. */
    bridge: { x: caliBRIDGE_X, z: caliRIVER_Z },
    isOverWater: caliIsOverWater,
    waterHeightAt: caliSurfaceY,
    inZone: caliInZone,
    SPAWN: caliSPAWN,
    gato: caliGATO,
    ermita: caliERMITA,
    lulada: caliLULADA,
    chiva: caliCHIVA,
    // the fruit barrow on the terrace. It MOVES — ask, never cache.
    cart() { return caliCartPos; },
    cartRolling() { return caliCartRolling; },
    cartSpeed() { return caliCartV; },
    inCart() { return !!(caliGame && caliGame.capy && caliInCart(caliGame.capy.position)); },
    floor: caliFLOOR,
    cristo: caliCRISTO,
    cane: { x: (caliCANE.x0 + caliCANE.x1) * 0.5, z: (caliCANE.z0 + caliCANE.z1) * 0.5 },
    mirador: caliMIRADOR,
    /** For the HUD: how the dance is going, 0..1. */
    combo() { return caliCombo; },
    comboTarget: caliDANCE_TARGET,
    onFloor() { return caliOnFloor; },
    /**
     * HOW MUCH THE FLOOR HAS GIVEN, 0..caliMERCY_MAX, and the window it buys.
     * Nothing in the game draws these — they are here so the widening can be
     * MEASURED rather than inferred from a clear rate, which is the only way to
     * tell a working assist from a lucky seed.
     */
    mercy() { return caliMercy; },
    window() { return caliWindow(); },

    // ---- what the chiva publishes to the rest of the game ------------------
    /** 0 = afternoon, 1 = the city is lit. Read by systems.js's night blend. */
    night() { return caliNightT; },
    /** Where the ride is up to: for the HUD, and for anything that has to wait. */
    riding() { return caliChivaState === 'rolling' || caliChivaState === 'stopped'; },
    onChiva() { return caliOnRoof; },
    chivaState() { return caliChivaState; },
    /**
     * THE HEADING THE RIG SHOULD SIT BEHIND while you are a passenger, or NaN.
     *
     * The ground rig only tidies itself up when you are STOOD STILL, and it
     * measures that in world speed — so on a bus doing seven metres a second it
     * never tidies at all, and you ride the whole set piece looking at whatever
     * you happened to leave the camera pointed at. Which is not a small thing
     * here: the cables are only readable if you are looking down the street.
     *
     * This is the ferry's helm case and it is safe for the same reason. The
     * runaway that makes chasing the direction of travel dangerous needs the
     * stick to be turning the rig which is turning the stick; the target here is
     * the BUS, which does not care what the player is pressing.
     */
    rideYaw() {
      if (!caliOnRoof || (caliChivaState !== 'rolling' && caliChivaState !== 'stopped')) return NaN;
      return caliChivaYaw;
    },
    /** WHERE SHE IS, for the hint arrow — she is the only thing in this chapter
     *  that moves, and an arrow pointing at the kerb she left is worse than no
     *  arrow at all. */
    chivaAt() {
      caliChivaOut.x = caliChivaX; caliChivaOut.y = caliChivaY; caliChivaOut.z = caliChivaZ;
      caliChivaOut.yaw = caliChivaYaw; caliChivaOut.v = caliChivaV;
      return caliChivaOut;
    },
    /** 0..1 along the route, for the HUD's little climb bar. */
    rideProgress() { return caliRouteLen > 0 ? clamp(caliChivaS / caliRouteLen, 0, 1) : 0; },
    /**
     * Seconds until the next cable reaches the middle of the roof, or -1 when
     * there is not one coming. The band's duck is driven off the same number,
     * and it is the honest measure of "is this hoppable" — a mechanic whose
     * timing you cannot read out is a mechanic you cannot tune.
     */
    wireLead() {
      if (!caliWires || caliChivaState !== 'rolling') return -1;
      let best = -1;
      for (let i = 0; i < caliWires.length; i++) {
        const d = caliWires[i].s - caliChivaS;
        if (d < -1 || d > 60) continue;
        const t = d / Math.max(1.5, caliChivaV);
        if (best < 0 || t < best) best = t;
      }
      return best;
    },
    /**
     * WHERE THE MUSIC IS COMING FROM, or null while it is still a score.
     *
     * From the moment she pulls away the salsa in this chapter stops being
     * something the game is playing at you and becomes something a band on the
     * roof of a bus is playing. systems.js pans and muffles it by distance from
     * this point — so being swept off the roof is a thing you HEAR happen, and
     * catching her up is a thing you hear too.
     */
    musSource() {
      if (caliChivaState === 'parked' || !caliBuilt) return null;
      caliMusOut.x = caliChivaX; caliMusOut.y = caliChivaY + 3.4; caliMusOut.z = caliChivaZ;
      return caliMusOut;
    },
    /**
     * Ask the rig to look up. Only at the mirador, and only for the first few
     * seconds of it: the whole point of the terrace is a view with a horizon in
     * it, and the standing rig's top edge points 17 degrees BELOW horizontal.
     * It eases back off so that the player gets the camera back.
     */
    skyward() {
      if (!caliMiradorDone) return 0;
      return clamp(1 - Math.max(0, caliVistaT - 7) / 5, 0, 1) * 0.62;
    },

    update(dt) {
      caliUpdatePax();
      if (caliMotoMover) caliMotoMover.step(dt);
      if (!caliBuilt) return;
      if (!game.biome.isActive('cali')) return;
      caliTime += dt;
      caliRipT += dt;
      if (caliRipT >= 0.0333 && caliRiverAttr) {
        caliRipT = 0;
        const a = caliRiverAttr.array;
        for (let i = 0; i < a.length; i += 3) {
          a[i + 1] = caliRIVER_Y + Math.sin(a[i] * 0.30 + caliTime * 2.2) * 0.06
                                 + Math.sin(a[i + 2] * 0.4 - caliTime * 1.7) * 0.04;
        }
        caliRiverAttr.needsUpdate = true;
      }
      caliUpdateCane();
      caliUpdateDrift(dt);
      caliUpdateSparks(dt);
      caliUpdateDance(game, dt);
      caliUpdateDancers(game, dt);
      caliUpdateWatchers(game);
      caliUpdateLamps(game);
      caliUpdateTasks(game, dt);
      caliStepChiva(game, dt);
      caliUpdateCart(game, dt);
      caliCheckWires(game, dt);
      caliUpdateKites(dt);
      caliUpdateLoros(game, dt);
      caliUpdateNight();
    },
  };
  game.cali = api;
  return api;
}

// ============================================================== SCATTER ======
/**
 * CALI HAD ONE SCATTER IN THE WHOLE CHAPTER.
 *
 * Counted across the game: the Pantanal lays down twenty-five and Circular Quay
 * sixteen; this chapter had one, and it is a chapter whose two best shots — the
 * painted street of San Antonio and the ground in front of the Ermita — are both
 * of a floor. The near-field octave in grain() breaks the value up, but a shader
 * term casts no shadow and passes under nothing: what says "real surface" at four
 * metres is a small object lying on it.
 *
 * It is seven in the evening in the Valle del Cauca and everything on the ground
 * here comes off a tree: samán and mango leaves on the paving, dry grass at the
 * verge, and — because this is the chapter with a dance in it — a few scraps of
 * paper that have been on the street since whatever happened last night.
 *
 * Quads, not boxes; a jittered grid, not a scatter; a PER-CELL budget rather
 * than a global cap tested inside the sweep. All three rules are the Pantanal's
 * and all three were paid for there.
 */
/**
 * A TUFT IS THE ONE PIECE THAT STANDS UP, so it is the one that has to be sure
 * it is on soil. A leaf lying at five centimetres over a slab is a leaf on the
 * slab; a half-metre blade in the same place is a blade growing THROUGH the
 * paving, and photographed off the first pass that is exactly what the promenade
 * had — three of them coming up out of grey stone beside the lawn.
 *
 * This is the ground mesh's own colour rule read back: caliBuildGroundMesh
 * paints earth inside the river band and ridge above eight metres, and grass
 * everywhere else. The promenade and the road are DRAWN OVER that grass rather
 * than cut into it, so the band is widened to clear both of them.
 */
function caliTuftHere(x, z, h) {
  if (h > 8) return false;                                  // the ridge to Cristo Rey
  if (Math.abs(z - caliRIVER_Z) < caliRIVER_HZ + 16) return false;  // channel, walk, road
  if (caliInZone('street', x, z) || caliInZone('dancefloor', x, z)) return false;
  if (caliInZone('terrace', x, z) || caliInZone('cane', x, z)) return false;
  return true;
}

function caliBuildScatter(root) {
  const flat = new THREE.PlaneGeometry(1, 1);
  flat.rotateX(-Math.PI / 2);
  // Two crossed quads, seen from both sides: four triangles that read as a
  // tuft from any heading. A cone4 at this size is a pyramid — see the note on
  // the first pass in qa/POLISH-PASS.md.
  const bladeGeo = (() => {
    const a = new THREE.PlaneGeometry(1, 1);
    a.translate(0, 0.5, 0);
    const b = a.clone();
    b.rotateY(Math.PI / 2);
    const g2 = new THREE.BufferGeometry();
    const pa = a.attributes.position.array, pb = b.attributes.position.array;
    const na = a.attributes.normal.array, nb = b.attributes.normal.array;
    const P = new Float32Array(pa.length + pb.length);
    P.set(pa, 0); P.set(pb, pa.length);
    const N = new Float32Array(na.length + nb.length);
    N.set(na, 0); N.set(nb, na.length);
    g2.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g2.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    const ia = a.index.array, n0 = pa.length / 3;
    const I = [];
    for (let i = 0; i < ia.length; i++) I.push(ia[i]);
    for (let i = 0; i < ia.length; i++) I.push(n0 + ia[i]);
    g2.setIndex(I);
    a.dispose(); b.dispose();
    return g2;
  })();
  const X0 = -90, X1 = 90, Z0 = -70, Z1 = 80, CELL = 3.2;
  const NX = Math.ceil((X1 - X0) / CELL), NZ = Math.ceil((Z1 - Z0) / CELL);
  const leaf = [], dry = [], paper = [], tuft = [];
  for (let gz = 0; gz < NZ; gz++) {
    for (let gx = 0; gx < NX; gx++) {
      const per = 2 + ((gx * 5 + gz * 9) % 3);
      for (let k = 0; k < per; k++) {
        const x = X0 + (gx + rand(0.05, 0.95)) * CELL;
        const z = Z0 + (gz + rand(0.05, 0.95)) * CELL;
        if (caliIsOverWater(x, z)) continue;
        const h = caliTerrain(x, z);
        // The street of San Antonio is its own slab at +0.16 over the terrain,
        // and the road ribbon is laid over it too; anything placed on the
        // analytic height inside either is UNDER the surface it belongs on.
        const onStreet = Math.abs(z - caliSTREET_Z) < caliSTREET_HZ;
        const y = (onStreet ? h + caliSTREET_TOP : h) + 0.05;
        if (onStreet) {
          // Paper is RARE. One scrap in six on the street and none off it: a
          // dozen of them says last night, and a field of them says the bins
          // were tipped over.
          const w = rand(0.13, 0.26);
          (k % 6 === 0 ? paper : leaf).push(x, y, z, 0, rand(0, 6.283), 0, w, 1, w * rand(0.5, 0.8));
        } else if (k % 5 === 0 && caliTuftHere(x, z, h)) {
          const s2 = rand(0.22, 0.48);
          tuft.push(x, h, z, 0, rand(0, 6.283), 0, s2 * 0.9, s2, s2 * 0.9);
        } else {
          const w = rand(0.14, 0.30);
          (k & 1 ? leaf : dry).push(x, y, z, 0, rand(0, 6.283), 0, w, 1, w * rand(0.5, 0.85));
        }
      }
    }
  }
  const put = (list, geo, color, cast) => {
    const n = list.length / 9;
    if (n < 1) return;
    const im = new THREE.InstancedMesh(geo, mat(color, geo === bladeGeo ? { side: THREE.DoubleSide } : undefined), n);
    for (let i = 0; i < n; i++) {
      const o = i * 9;
      im.setMatrixAt(i, caliXform(list[o], list[o + 1], list[o + 2], list[o + 3], list[o + 4],
                                  list[o + 5], list[o + 6], list[o + 7], list[o + 8]));
    }
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    im.castShadow = !!cast;
    im.receiveShadow = false;
    if (!cast) im.userData.noShadow = true;
    root.add(im);
  };
  // caliMango is a DARK GREEN and on pale paving a field of it reads as
  // confetti rather than as leaf litter. What falls off a samán and lies on a
  // Cali pavement at seven in the evening is dry and the colour of the earth.
  put(leaf, flat, PALETTE.caliEarth, false);
  put(dry, flat, PALETTE.caliGrassDry, false);
  put(paper, flat, PALETTE.caliWall4, false);
  put(tuft, bladeGeo, PALETTE.caliGrass, false);
}

function caliBuild(game) {
  if (caliBuilt) return;
  caliBuilt = true;
  caliInitGeos();

  caliRoot = new THREE.Group();
  caliRoot.name = 'cali';
  game.scene.add(caliRoot);

  // The route is measured FIRST: the road ribbon, the wires and the chiva's
  // starting pose are all derived from it, and caliRoadY has to be answering
  // correctly before anything is placed on the road.
  caliBuildRoute();

  caliRoot.add(caliBuildGroundMesh());
  caliBuildGroundBody(game);
  caliBuildScatter(caliRoot);
  caliRoot.add(caliBuildRiver());
  caliBuildDrift(caliRoot);
  caliBuildRoad(game, caliRoot);
  caliBuildRiverside(game, caliRoot);
  caliBuildGato(game, caliRoot);
  caliBuildErmita(game, caliRoot);
  caliBuildStreet(game, caliRoot);
  // the hill behind the two rows, and the promenade the river has never had
  caliBuildBackRows(game, caliRoot);
  caliBuildStreetLife(game, caliRoot);
  caliBuildPaseo(game, caliRoot);
  caliBuildKites(caliRoot);
  caliBuildLoros(caliRoot);
  caliBuildMirador(game, caliRoot);
  // ...and somebody selling chontaduro on it, which is what the end of the
  // chapter's marquee ride was missing
  const caliMirLife = caliBuildMiradorLife(game, caliRoot);
  caliBuildWires(game, caliRoot);
  caliBuildCart(game, caliRoot);
  caliBuildChiva(game, caliRoot);
  caliBuildCityLights(caliRoot);
  caliBuildSalsoteca(game, caliRoot);
  caliBuildDancers(caliRoot);
  caliBuildWatchers(game, caliRoot);
  caliBuildCane(caliRoot);
  caliBuildCristo(game, caliRoot);
  caliBuildFlora(caliRoot);
  caliBuildSparks(caliRoot);
  caliBuildMoto(game, caliRoot);
  // ...and somebody on the benches. AFTER caliBuildChiva, which is what makes
  // the group; called before it this takes a null and returns in silence.
  caliBuildPax(caliChivaGroup);

  // ---- THE PEOPLE WHO LIVE HERE ------------------------------------------
  // See npc.js, THE LOCALS. Each of these is a point somebody is standing at,
  // a few things they might say when the capybara turns up, and a different
  // few for when it wheeks at them. Where the chapter owns a Group for the
  // figure, it is handed over too and the figure turns to watch.
  // ALL THREE OF THESE WERE STANDING INSIDE SOMETHING. Each was anchored on
  // the landmark constant it belongs to — the cart, the bus stop, the middle of
  // the dance floor — and every one of those constants is the CENTRE of a solid
  // object. A vendor is behind his cart, a bus conductor is beside his bus, and
  // a dance teacher is at the edge of the floor, not standing in the one place
  // the player has been asked to dance.
  if (typeof game.addLocal === 'function') {
    game.addLocal({ biome: 'cali', x: caliLULADA.x - 0.4,
      y: caliTerrain(caliLULADA.x - 0.4, caliLULADA.z - 1.9),
      z: caliLULADA.z - 1.9, near: 6, face: 0,
      figure: { shirt: PALETTE.cloth3, skin: PALETTE.skin3 },
      // ---- AND THEY KNOW WHAT HAS HAPPENED (v20) -------------------------
      // Every person in this chapter said the same three sentences whether the
      // sun was up, the bus was at the kerb and the jug was on the counter — or
      // whether it was dark, the chiva was on the ridge and the jug was gone.
      // See localResolve in npc.js: a line may now carry `before`/`after` a
      // task id or a `when` predicate, and `onTask` is what they say at the
      // moment you do it in front of them.
      lines: [{ t: 'Lulada! Con hielo! Two thousand!', before: 'lulada' },
              'Crushed, not blended. There is a difference and it is everything.',
              { t: 'Mi amor, that cup is bigger than your head.', before: 'lulada' },
              { t: 'You have had one. I saw you have one. Two thousand.', after: 'lulada' },
              { t: 'The lulo comes down from Nariño on the bus, with everything else.', after: 'lulada' },
              { t: 'Nobody buys lulada at night. Everybody buys lulada at night.',
                when: function () { return !!(caliGame && caliGame.cali && caliGame.cali.night() > 0.5); } }],
      wheek: ['Ay! The whole Ermita heard you.',
              'Take it, take it. Go and be loud somewhere else.'],
      onTask: { 'lulada': ['That is two thousand pesos of lulada in a rodent.',
                           'Con hielo. It had ICE in it.'],
                'gato-sit': ['You are ON him. Nobody sits on the Gato.'] } });
    game.addLocal({ biome: 'cali', x: caliCHIVA.x,
      y: caliRoadY(caliCHIVA.x, caliCHIVA.z + 4.6),
      z: caliCHIVA.z + 4.6, near: 7, face: Math.PI,
      figure: { shirt: PALETTE.cloth2, skin: PALETTE.skin3, hat: PALETTE.khaki },
      lines: [{ t: 'Chiva leaves when it leaves. Sit on the roof if you like.', before: 'chiva-ride' },
              { t: 'Hold on going up. The road remembers nothing.', before: 'chiva-mirador' },
              { t: 'Mirador in twenty minutes. Or forty. Depends.', before: 'chiva-mirador' },
              { t: 'Cables at head height the whole way. That is not my department.', before: 'chiva-mirador' },
              { t: 'She sleeps up there now. She has earned it.', after: 'chiva-mirador' },
              { t: 'You walked back DOWN? There is a barrow for that.', after: 'chiva-mirador' },
              { t: 'She is going. She is going NOW. Get on or do not.',
                when: function () { return !!(caliGame && caliGame.cali && caliGame.cali.riding()); } }],
      wheek: ['That is the horn taken care of, then.'],
      onTask: { 'chiva-ride': ['On the ROOF. Everybody on the roof.'],
                'chiva-mirador': ['Four hundred and sixty-five metres. Nobody rides the whole way.',
                                  'You did not fall off. Most people fall off.'] } });
    caliLocTeach = game.addLocal({ biome: 'cali', x: caliFLOOR.x + Math.cos(2.2) * 9.0,
      y: caliTerrain(caliFLOOR.x, caliFLOOR.z) + 0.20,
      z: caliFLOOR.z + Math.sin(2.2) * 9.0, near: 9, face: -0.94,
      figure: { shirt: PALETTE.cloth1, skin: PALETTE.skin3 },
      lines: [{ t: 'On the ONE. Everybody comes in on the one.', before: 'salsa-dance' },
              { t: 'Feet small. Feet small! Cali is all feet.', before: 'salsa-dance' },
              { t: 'You have the hips for it. I did not expect that.', before: 'salsa-dance' },
              { t: 'Nobody learns this in a week. Nobody.', before: 'salsa-dance' },
              { t: 'You learned that in a week. I am not talking about it.', after: 'salsa-dance' },
              { t: 'Again. From the top. You are not tired, you have four legs.', after: 'salsa-dance' },
              { t: 'Yes! Yes. No. Yes.',
                when: function () { return !!(caliGame && caliGame.cali && caliGame.cali.onFloor()); } }],
      wheek: ['Eso! Now dance.'],
      onTask: { 'salsa-dance': ['Eso! ESO! Somebody get the trumpet.',
                                'A capybara. On the clave. In Cali.'] } });
    // ---- and three more, because a city of two and a half million had three --
    // THE KITE HAD NOBODY ON THE END OF IT. caliBuildKites' own comment says
    // the cometas get "hauled back up by somebody the player cannot see", which
    // was true and is the wrong kind of true: five strings ran forty metres
    // down out of the sky to a patch of empty grass. One of them now ends in a
    // pair of hands.
    game.addLocal({ biome: 'cali', x: caliKITE.x + 3.5,
      y: caliTerrain(caliKITE.x + 3.5, caliKITE.z - 2), z: caliKITE.z - 2, near: 7, face: 0.6,
      // D2: this was the embankment man first, and the nav probe refused his
      // route in BOTH directions -- the shelf he stands on is level for nine
      // metres each way and solid at both ends. Flying a kite is the one job in
      // this chapter that is done by walking about, and the ground under him is
      // the open bank he needs for forty metres of string.
      // The offset is swept, not guessed: navBlocked and terrainHeight are both
      // public on the biome api, so the harness can ask the same two questions
      // the rig's probe asks. Seventy of ninety-six candidates round him are
      // clear and level; this is one of them.
      walk: { dx: 0, dz: -9, dwell: 5 },
      figure: { shirt: PALETTE.caliNeonCyan, legs: PALETTE.denim },
      lines: ['August is the month of the wind. Everybody knows this.',
              'Forty metres of string. My father made this one.',
              'If it dives, you let it. You do not pull. Pulling is how you lose it.',
              { t: 'You can see her from the mirador. She is the only thing up there that is ours.', after: 'chiva-mirador' },
              { t: 'She flies better at night. Nobody believes me.',
                when: function () { return !!(caliGame && caliGame.cali && caliGame.cali.night() > 0.5); } }],
      wheek: ['She felt that! Look — look at her go!'],
      praise: ['Ha! Did you see that? No — you did it. You saw it.'] });
    // somebody on the steps down to the water, which caliBuildRiverside builds
    // and describes as "where people sit", and where nobody has ever sat
    // ON THE EMBANKMENT, NOT ON THE STEPS. The steps are drawn inside
    // caliIsOverWater's channel and carry no collider of their own, so a figure
    // on them is a man standing in the river again. The embankment's collider
    // tops out at 0.74 and that is where he leans.
    game.addLocal({ biome: 'cali', x: 16, y: 0.74,
      z: caliRIVER_Z + caliRIVER_HZ + 2.4, near: 7, face: -1.5,
      figure: { shirt: PALETTE.caliWall5, hat: PALETTE.caliWall2 },
      lines: ['It comes down off the Farallones. It is always this cold.',
              { t: 'I sit here every afternoon. It is free and it is the best thing in Cali.',
                when: function () { return !!(caliGame && caliGame.cali && caliGame.cali.night() < 0.5); } },
              { t: 'I am still here. Where else would I be.',
                when: function () { return !!(caliGame && caliGame.cali && caliGame.cali.night() >= 0.5); } },
              'The Gato has a girlfriend for every artist in the city. Count them.',
              { t: 'You went UNDER the Ortiz. There are two arches and you took the wrong one.', after: 'puente-ortiz' },
              { t: 'Cold, is it not. I did say.', after: 'puente-ortiz' }],
      wheek: ['The whole river heard that.'],
      onTask: { 'puente-ortiz': ['All the way through. In THAT.'],
                'gato-sit': ['Sixty years that cat has sat there and now something is sitting on it.'] } });
    // and a woman in a doorway on the painted street, which is eighteen houses
    // with the doors standing open and nobody behind any of them
    game.addLocal({ biome: 'cali', x: -29, y: caliRoadY(-29, caliSTREET_Z - 6.6),
      z: caliSTREET_Z - 6.6, near: 6, face: 0,
      figure: { shirt: PALETTE.caliWall6, skin: PALETTE.skin2 },
      lines: ['Blue was my mother’s idea. The whole street argued for a year.',
              'They dance down there until six. SIX. And then they go to work.',
              { t: 'Sit in the shade, mijo. Whatever you are.',
                when: function () { return !!(caliGame && caliGame.cali && caliGame.cali.night() < 0.5); } },
              { t: 'There it is. The whole valley, all at once. Every night.',
                when: function () { return !!(caliGame && caliGame.cali && caliGame.cali.night() >= 0.5); } },
              { t: 'You were on the roof of the chiva. My cousin drives that chiva.', after: 'chiva-ride' }],
      wheek: ['Ay! Not before eleven!'],
      praise: ['Mm. In MY street.', 'I have seen everything now. Everything.'] });    // ---- AND THREE MORE, ONE OF THEM AT THE END OF THE CHAPTER ----------
    // THE MIRADOR HAD NOBODY ON IT. Four hundred and sixty-five metres of
    // chiva, three cables, the sun going down and the whole city coming on
    // underneath you — and you stepped off onto an empty concrete slab. The one
    // thing a marquee arrival cannot be is unattended, and the man behind the
    // chontaduro cart is the cheapest possible fix: somebody was already here,
    // and he is not remotely impressed.
    // Behind the cart, not in it — see caliBuildMiradorLife for where it stands.
    caliLocCart = game.addLocal({ biome: 'cali',
      x: caliMirLife.kx - caliMirLife.ox * 1.25, y: caliMIR_DECK + 0.02,
      z: caliMirLife.kz - caliMirLife.oz * 1.25, near: 9,
      face: Math.atan2(caliMirLife.ox, caliMirLife.oz),
      figure: { shirt: PALETTE.caliWall1, legs: PALETTE.denim, hat: PALETTE.caliWall2 },
      // the knife on the board
      beat: { kind: 'work', every: 4.8, dur: 0.75, sfx: 'tick', volume: 0.10, pitch: 1.2, tool: 'cuencobowl' },  // B12: chontaduro con miel y sal, and the bowl it is served in
      lines: ['Chontaduro con miel y sal. Do not argue, just eat it.',
              'Everybody comes up on the chiva and everybody says the same thing.',
              { t: 'Wait for the lights. Another ten minutes. It is worth ten minutes.',
                when: function () { return !!(caliGame && caliGame.cali && caliGame.cali.night() < 0.6); } },
              { t: 'There. Two million people, and every one of them has a light on.',
                when: function () { return !!(caliGame && caliGame.cali && caliGame.cali.night() >= 0.6); } },
              { t: 'The barrow is not a toy. …the barrow is a little bit of a toy.', before: 'cart-run' },
              { t: 'My barrow. My BARROW. It is at the bottom of the hill again.', after: 'cart-run' }],
      wheek: ['Ay! You will have the whole ridge awake.',
              'The dogs down in Siloé heard that.'],
      onTask: { 'chiva-mirador': ['Everybody says the same thing. You have not said anything.'],
                'cart-run': ['THAT IS MY BARROW.', 'Sixty kilos of chontaduro. Gone. Down a hill.'] } });
    // THE BAR AT THE SALSOTECA. caliBuildSalsoteca draws seven metres of
    // counter, a stone top and nine bottles on it, and there has never been
    // anybody behind it — which is the empty-awning failure the locals system
    // exists to fix, sitting in the middle of the chapter's marquee mechanic.
    caliLocBar = game.addLocal({ biome: 'cali', x: caliFLOOR.x + caliFLOOR.r * 0.1,
      y: caliTerrain(caliFLOOR.x, caliFLOOR.z) + 0.20,
      z: caliFLOOR.z + caliFLOOR.r + 1.4, near: 7, face: Math.PI,
      figure: { shirt: PALETTE.caliWall4, skin: PALETTE.skin4 },
      // pouring, and he does not measure it
      beat: { kind: 'reach', every: 7.0, dur: 1.2, sfx: 'clink', volume: 0.10 },
      lines: ['Aguardiente or nothing. There is no third thing.',
              'They started at ten. They will still be here at six.',
              { t: 'You want to dance? Watch the feet. Never watch the face.', before: 'salsa-dance' },
              { t: 'I watched the feet. I do not know what I watched.', after: 'salsa-dance' },
              { t: 'Nine bottles. Do not.', after: 'lulada' }],
      wheek: ['That is the loudest thing in here and the band has a trumpet.'],
      praise: ['Mm-hm.', 'I have worked here nineteen years and that is new.'] });
    // CRISTO REY. Forty-six metres of statue on a ridge with a task on it and
    // not one person at the foot — and the whole of what that place is, is the
    // people who walked up.
    game.addLocal({ biome: 'cali', x: caliCRISTO.x + 8.5,
      y: caliTerrain(caliCRISTO.x + 8.5, caliCRISTO.z + 5.5) , z: caliCRISTO.z + 5.5,
      near: 9, face: -2.2,
      figure: { shirt: PALETTE.caliWall5, legs: PALETTE.khaki },
      lines: ['Twenty-six metres of him, on a plinth, on a mountain. It adds up.',
              'My mother walked up here every year. I drive. She would have something to say.',
              { t: 'On a clear day you can see the whole valley to the Cauca.',
                when: function () { return !!(caliGame && caliGame.cali && caliGame.cali.night() < 0.5); } },
              { t: 'At night you cannot see the valley. You can see where everybody in it is.',
                when: function () { return !!(caliGame && caliGame.cali && caliGame.cali.night() >= 0.5); } },
              { t: 'You came up on the bus. Everybody comes up on the bus.', after: 'chiva-mirador' }],
      wheek: ['…the echo off the plinth. Do it again. No — do not do it again.'],
      onTask: { 'cristo-rey': ['All the way up. On four legs.',
                               'He has seen a lot from up here. Not that.'] } });

    // ---- AND SOMEBODY TO LEAN ON THE PARAPET WITH ------------------------
    // The mirador is where the chapter's marquee ride ENDS and it had exactly
    // one person on it, which is one person short of the thing everybody
    // actually does up there: stand at the wall with somebody and not say very
    // much. She is also the other half of the only conversation at four hundred
    // and sixty-five metres — see the exchange below.
    // On the deck, at the wall, three metres along from the cart.
    caliLocLean = game.addLocal({ biome: 'cali',
      x: caliMirLife.kx - caliMirLife.ox * 1.25 + caliMirLife.oz * 4.2,
      y: caliMIR_DECK + 0.02,
      z: caliMirLife.kz - caliMirLife.oz * 1.25 - caliMirLife.ox * 4.2,
      near: 8, face: Math.atan2(caliMirLife.ox, caliMirLife.oz),
      figure: { shirt: PALETTE.caliWall3, legs: PALETTE.denim },
      lines: ['I come up on the last chiva and I walk down. It is better that way.',
              'Everything you can see was a cane field. All of it.',
              { t: 'The lights go on street by street. You can watch it happen.',
                when: function () { return !!(caliGame && caliGame.cali && caliGame.cali.night() >= 0.5); } },
              { t: 'Give it an hour. It is worth the hour.',
                when: function () { return !!(caliGame && caliGame.cali && caliGame.cali.night() < 0.5); } },
              { t: 'You rode up on the roof. I saw you on the roof.', after: 'chiva-mirador' }],
      wheek: ['…listen. It comes back off the ridge.'],
      praise: ['Mm. From up here it looked like a plan.'] });

    // ---- AND TWO CONVERSATIONS THAT ARE NOT WITH YOU (v20) --------------
    // See addExchange in npc.js. A salsoteca with a teacher and a barman in it
    // was silent unless the player stood between them; a terrace with two
    // people on it was two people looking at a view in total silence. These
    // run when you are near enough to read both bubbles and far enough not to
    // be the subject, so what you catch is something already going on.
    if (typeof game.addExchange === 'function') {
      if (caliLocTeach && caliLocBar) {
        game.addExchange({ biome: 'cali', a: caliLocTeach, b: caliLocBar, lines: [
          ['Turn the trumpet down.', 'The trumpet is a man. Tell the man.'],
          ['Who let the animal in?', 'It is not drinking. It is fine.'],
          ['Four couples. On a Tuesday.', 'It is Thursday.'],
          ['One more and then I am going home.', 'You said that at ten.'],
          ['That floor needs waxing.', 'That floor needs a new roof. Wax is further down.'],
        ] });
      }
      if (caliLocCart && caliLocLean) {
        game.addExchange({ biome: 'cali', a: caliLocCart, b: caliLocLean, gap: 36, lines: [
          ['Chontaduro?', 'Not tonight.'],
          ['She is late again.', 'She is always late. That is the timetable.'],
          ['Clear all the way to the Cauca.', 'Mm. It was clearer in July.'],
          ['Do you ever get tired of it?', '…no.'],
          ['There goes Siloé.', 'There goes everything.'],
        ] });
      }
    }
  }

  if (typeof game.registerShadowTarget === 'function') game.registerShadowTarget(caliRoot);
}
