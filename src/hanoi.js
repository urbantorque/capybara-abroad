import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PALETTE, mat, matEmit, rand, randInt, clamp, damp, lerp, grain, placeCue, swayMesh, makeMerger } from './shared.js';

// ===========================================================================
// CHAPTER 19 — HANOI
//
// The nineteenth place, and the first one where the GROUND IS MOVING and it is
// not water, wind, ice or a deck. It is two hundred and forty scooters.
//
// Every chapter in this game has an obstacle you go round and a floor you walk
// on. This one has a THIRD THING, which is the single most famous fact about
// the city and which nothing in eighteen chapters resembles: a continuous,
// unbroken, unstopping river of motorbikes that you cross by WALKING INTO IT
// AT A STEADY PACE. Not by waiting for a gap — there is no gap, there has
// never been a gap, and a player who waits for one will still be standing on
// that kerb at the end of the chapter. You step off, you hold your line, and
// two hundred people you will never meet go round you.
//
// THREE THINGS MAKE THIS CHAPTER AND NOT ONE:
//
//  1. THE FLOW. `hanLaneAt(x, z)` is a distance field over four street
//     centrelines, and every scooter on the map is a parameter along one of
//     them. Each one can SEE the capybara: inside `hanSEE` it swings its
//     lateral offset away and lifts off. What decides whether that works is
//     the animal's own speed and heading — hold both and the river parts; stop
//     dead, or turn back, and the nearest rider is already committed to where
//     you were going to be, and you get a horn, a shove and a wobble. It is
//     never damage. Nobody in this game has ever taken damage. It is the
//     indignity of being the one thing on that street that could not commit.
//
//  2. TRAIN STREET. A metre-gauge line runs down an alley a metre and a half
//     wider than the train, with a hundred people living in it. Twice in the
//     chapter a horn sounds up the line and the ENTIRE STREET FOLDS ITSELF
//     AWAY — awnings in, stools in, tables in, everybody flat against their own
//     front door — and eleven seconds later a train comes through at eleven
//     metres a second with forty-five centimetres to spare. Standing in it is
//     the marquee, and it is deliberately a thing you do by NOT MOVING, which
//     is the opposite of the chapter's other two.
//
//  3. THE LAKE. Hoan Kiem is the hole in the middle of the noise: eighty
//     metres of still green water with a tower on an island in it, a red
//     bridge, and a ring road round the outside that never stops. Every quiet
//     thing in this chapter is inside that ring and everything loud is outside
//     it, which is a whole city's worth of design done by a lake.
//
// Everything here is prefixed `han` (contract: the bundler flattens every
// module into one scope).
// ===========================================================================

// --------------------------------------------------------------- geography --
// Hanoi is FLAT, which after eighteen chapters of heightfields is worth saying
// out loud: this terrain has three features in it and two of them are holes.
const hanWATER  = -0.5;           // the lake, and it does not move much either
const hanGROUND = 1.2;            // ...and the street, which is nearly all of it

// Hoan Kiem. An ellipse, and the whole chapter is arranged round it.
const hanLAKE   = { cx: 0, cz: -58, rx: 58, rz: 38, bed: -2.6 };
const hanTOWER  = { x: -8, z: -58 };          // Thap Rua, on its own islet
// ...AND NGOC SON IS ON THE SHORE SIDE, WHICH IS THE ONLY PLACE IT CAN BE.
// The first version put the islet at (34, -50) and ran the red bridge from
// (18, -34) — both of which are two-thirds of the way into an ellipse 116 m
// across, so the whole of the Huc, gate and all, stood in open water and the
// task was "walk out onto a bridge that starts in a lake". The east shore at
// z = -46 is at x = 55; that is where a bridge to an island has to begin.
const hanNGOC   = { x: 26, z: -46 };          // Ngoc Son, on the other one
const hanHUC    = { x0: 55, z0: -44, x1: 39, z1: -46 };   // the red bridge

// The Red River, and the dyke that keeps it out of the city. The dyke is the
// only ground in the chapter that is not at 1.2 m, and it is there because the
// old bridge has to start somewhere.
const hanDYKE   = { cz: 168, h: 5.0, halfz: 10 };
const hanBRIDGE = { x: 44, z0: 168, z1: 250 };

// The Old Quarter: everything north of the lake, and it is a grid.
const hanOQ     = { x0: -96, x1: 96, z0: -18, z1: 130 };

// Train Street, and it runs east-west across the west side of the quarter.
// ...AND THE ALLEY IS SIX AND A HALF METRES WIDE, NOT FOUR AND THREE
// QUARTERS. The real one is about four; at that width the chapter is
// unplayable, because a third-person camera twelve metres behind the animal
// at thirty-five degrees is inside somebody’s first floor and the marquee
// happens off screen. Three metres two either side of the rail gives the lens
// somewhere to be.
// This used to claim the TRAIN'S own clearance was left untouched at 45 cm.
// It is not: widening the alley widened the clearance with it. The hull is
// 1.45 m in a 6.4 m street, which leaves about 2.6 m either side, and 2.6 m —
// hanTRAIN_WOW, below — is what the in-pass payout and the despawn net both
// actually read. The 45 cm constant was a leftover from before the widening,
// was read by no line of code, and has been removed.
const hanTRAIN  = { z: 46, x0: -130, x1: -34, gauge: 1.0, half: 3.2 };

// The bia hoi corner, the market, the puppet theatre and the barber.
const hanBIA    = { x: 62, z: 18 };
const hanMARKET = { x: -54, z: 88 };
const hanPUPPET = { x: 44, z: -22 };
const hanBARBER = { x: -30, z: 8 };
const hanCAU    = { x: -18, z: -96 };         // the shuttlecock circle, lakeside

const hanSEA_X0 = -230, hanSEA_X1 = 230, hanSEA_Z0 = -200, hanSEA_Z1 = 270;

/**
 * WHERE THE CITY STOPS — see api.bounds() (integrity 9).
 *
 * The ground mesh and its heightfield are the full hanSEA rectangle, 460 m by
 * 470, because a city needs a horizon and the dyke needs somewhere to be. The
 * BUILT city is about a third of that, so `biome.boundsOf()` — which is the
 * union of the colliders, and the heightfield is one of them — put the edge of
 * the world at x = ±230. Measured before this: from the spawn at (-60, -78) a
 * player heading west walks a hundred and seventy metres of empty concrete
 * before anything notices.
 *
 * Two rectangles rather than one, for the same reason Sydney needs two: the
 * Chuong Duong bridge runs north off the dyke to z = 250 and a single box
 * containing it would hand back sixty metres of river either side of it.
 *
 * The first rectangle is drawn from the things in it, not chosen: the surround
 * band reaches x = ±148 and z = -152, the Old Quarter backdrop z = 156, and
 * the dyke crest is x = ±140 at z = 182.
 */
const hanBOUNDS = { rects: [
  { x0: -155, x1: 155, z0: -158, z1: 186 },      // the city, the lake, the dyke
  { x0: 30, x1: 58, z0: 180, z1: 256 },          // ...and the bridge over the river
] };

// ------------------------------------------------------------- the traffic --
// FOUR CENTRELINES, and every scooter in the chapter is a distance along one
// of them. Same machinery as the Monte Carlo circuit and the chiva road: one
// polyline is the tarmac, the kerbs, the buildings' setback, the pedestrian
// crossing test and the riders' rails, so none of the five can disagree.
const hanLANES = [
  // 0 — Hang Ngang / Hang Dao. North out of the lake, the busiest street.
  { closed: false, w: 5.2, pts: [[0, -22], [0, 8], [2, 44], [0, 82], [-2, 122]] },
  // 1 — the east-west artery across the middle of the quarter
  { closed: false, w: 5.2, pts: [[-98, 32], [-40, 28], [10, 30], [58, 26], [104, 30]] },
  // 2 — the ring round the lake, and it never stops
  { closed: true, w: 4.6, pts: [[0, -12], [34, -18], [58, -38], [62, -60], [52, -84],
                                [24, -100], [-14, -102], [-46, -90], [-62, -66],
                                [-58, -40], [-36, -20]] },
  // 3 — the north street, past the market
  { closed: false, w: 4.6, pts: [[-100, 84], [-52, 80], [4, 86], [56, 82], [102, 86]] },
];
const hanBIKE_N    = 240;         // ...and how many of them there are
const hanBIKE_V    = [5.4, 9.6];  // m/s. Fifteen to thirty-five kilometres an hour.
const hanSEE       = 15.0;        // m ahead a rider can see you
const hanSWERVE    = 3.4;         // m of lateral offset they will give you
const hanHOLD_V    = 0.85;        // m/s under which you have stopped committing
const hanTURN_MAX  = 1.9;         // rad of heading change that counts as a dither

// ------------------------------------------------------------- train street --
const hanTRAIN_V    = 11.0;       // m/s through the alley
const hanTRAIN_WARN = 11.0;       // s between the horn and the train
const hanTRAIN_GAP2 = 96;         // s between one and the next
// How close counts as "in the alley when it comes through". One number, read by
// the in-pass payout and by the despawn safety net, so the moment and the
// fallback can never disagree about what earned it.
const hanTRAIN_WOW  = 2.6;        // m of clearance, after the 1.45 m hull
const hanTRAIN_LEN  = 4;          // carriages

// ------------------------------------------------------------------ scratch --
const hanV3  = new THREE.Vector3();
const hanV3b = new THREE.Vector3();
const hanV3c = new THREE.Vector3();
const hanV3d = new THREE.Vector3();
const hanQ   = new THREE.Quaternion();
const hanE   = new THREE.Euler();
const hanSc  = new THREE.Vector3();
const hanM   = new THREE.Matrix4();
const hanCol = new THREE.Color();
const hanFrame = { x: 0, z: 0 };
const hanOpt = {};                // see placeCue: copied, never written into

// ---------------------------------------------------------------- module ----
let hanGame = null;
let hanBuilt = false;
let hanRoot = null;
let hanTime = 0;

// the lake
let hanLakeMesh = null, hanLakeAttr = null;

// the flow
const hanBikeMeshes = [];         // one per body colour — see the note above
const hanBikeGroups = [];         // ...and which bikes are in each
let hanBikeN = 0;
let hanJamPin = -1, hanJamWas = -1;   // jamTest's pin — see the api
let hanBikeData = null;           // lane, s, dir, off, offWant, v, vWant, colour, phase
// ...and slot 9 is "this one is currently going round the capybara", which is
// what makes the record a COUNT OF PEOPLE rather than an integral of time.
// Measured with the time integral: a clean four-second crossing of the busiest
// street in the chapter scored ONE, because the accumulator only ran while a
// rider was inside a nine-metre window and at this density that is about a
// second and a half of the whole crossing. Counting the rising edge instead
// gives eleven to nineteen, which is both the truth and the joke.
const hanBIKE_STRIDE = 10;
let hanSwerved = 0;               // how many have had to go round you, this crossing
let hanSwervedBest = 0;
let hanBumpT = 0;
let hanHornT = 0;
let hanCrossFrom = 0;             // which side of the lane the crossing started on
let hanCrossLane = -1;
let hanCrossOk = false;
let hanCrossDone = false;
let hanYawWas = 0, hanDither = 0;
let hanRider = -1;                // which scooter is carrying the animal
let hanRideT = 0, hanRideDist = 0, hanRideBest = 0, hanRideDone = false;
let hanRideGrace = 0;

// train street
let hanTrainG = null, hanTrainBody = null;
let hanTrainS = -1;               // metres along the alley, or -1 when it is away
let hanTrainT = hanTRAIN_GAP2 * 0.35;
let hanFoldK = 0;                 // 0 open, 1 everything folded away
let hanTrainNear = 99;            // closest the animal has been to it, this pass
let hanTrainBest = 99;
let hanTrainDone = false, hanFoldDone = false;
let hanTrainCount = 0;
const hanFolders = [];            // {m, ox, oy, oz, fx, fy, fz, or, fr}
let hanTrainWarned = false;

// the lake set
let hanHucG = null;
const hanPuppets = [];
let hanCauN = 5, hanCauT = 0, hanCauDone = false;
// THE RALLY IS A CHAIN, so it has to be remembered rather than recomputed: the
// shuttle leaves the player it last landed on. See hanUpdateCau.
let hanCauFrom = 0, hanCauTo = 1, hanCauLeg = -1;
const hanCauFolk = [];
let hanShuttle = null;

// the stools
let hanStoolMesh = null, hanStoolData = null;
let hanStoolDown = 0, hanStoolBest = 0, hanStoolDone = false;
const hanSTOOL_N = 96;

// props and people
let hanPhoProp = null, hanPhoGone = false;
let hanCoffeeProp = null, hanCoffeeGone = false;
let hanFlowerBike = null, hanFlowerDone = false;
const hanFlowerProps = [];
let hanMirror = null, hanMirrorDone = false;
let hanLocPho = null, hanLocBia = null, hanLocRail = null, hanLocFlower = null;
let hanLocBarber = null, hanLocPuppet = null, hanLocMarket = null;

// instanced fields
let hanWinMesh = null;
// ================================================================ THE PHO RUN ==
// THE MARQUEE, AND IT IS A SCOOTER (X5).
//
// Two hundred and forty engines are the medium of this chapter and the animal
// could only ever be a passenger in them. The pho stall has a Honda Cub with
// three bowls on the rack, and E at the seat makes it yours: W/S throttle and
// brake, A/D to steer, and the road is the road — the four centrelines are the
// only tarmac, and the kerb is a wall that costs you your speed. Three
// deliveries round the quarter, each a lantern on a pole with a ring under it,
// lit one at a time: the bia hoi corner, the market, the water puppets. The
// bowls come off the rack as they go. The pho cools, and the time is the
// record.
//
// The traffic is what makes it a game: the riders swerve for the animal as
// they always did, but only ahead of themselves, so a scooter coming up
// behind one is held to its speed until it moves over. Kinematic, parked at
// the helm, like every vehicle in this game.
const hanCUB = { x: 6.0, z: 15.5, yaw: 0 };          // parked at the pho stall, on the road's edge
const hanCUB_DOOR_R = 3.2;
const hanCUB_VMAX  = 12.5;      // m/s — a Cub, ridden hard
const hanCUB_ACC   = 6.5;
const hanCUB_BRAKE = 11.0;
const hanCUB_DRAG  = 2.0;
const hanCUB_REV   = 2.0;       // m/s astern
const hanCUB_TURN  = 2.4;       // rad/s at full lock, with way
const hanCUB_KERB  = 1.2;       // m past the lane's half-width the wheels may go
const hanCUB_HOLD  = 1.7;       // m to a rider ahead that holds you to their speed
const hanCUB_DROP_R = 6.0;      // m from a lantern, stopped, that delivers
const hanCUB_DROP_V = 2.5;      // ...and "stopped" is under this
const hanCUB_COLD  = 150;       // s the pho takes to go cold — the timer, not a fail
// the three drops, each at a road's edge: x, z, name
const hanDROPS = [[60, 22.5, 'the bia hoi corner'], [-52, 83.5, 'the market'], [40, -24.5, 'the water puppets']];
let hanCubG = null, hanCubBowls = null, hanCubOn = false, hanCubCool = 0;
let hanCubX = hanCUB.x, hanCubZ = hanCUB.z, hanCubYaw = hanCUB.yaw, hanCubV = 0, hanCubLean = 0;
let hanCubNext = 0, hanCubDone = false, hanCubT = 0, hanCubHold = -1, hanCubHornT = 0, hanCubKerbT = 0;
let hanCubMover = null, hanDropMeshes = null, hanDropMats = null, hanDropT = 0, hanCubBest = 0;
let hanSignMesh = null;
const hanFolkMeshes = [];
const hanFolkGroups = [];
let hanFolkData = null;
let hanFolkBodies = null;        // one box each — see ...AND SEVENTY OF THEM ARE THERE
const hanFOLK_N = 70;
// ---- AND WHETHER ANY OF THEM HAS NOTICED YOU (D1) ------------------------
// Seventy people on the pavement, and the only thing any of them read was
// their own lane parameter. The two hundred and forty riders have seen the
// animal since the chapter was built — they swerve, they brake, they jam,
// they line up under it in the air — and the people standing three metres
// away on the kerb did not know it was there.
//
// A WALKER GLANCES AND A SITTER TURNS ROUND. The figure has one yaw and no
// neck, so a full turn on somebody who is still walking their lane is a
// moonwalk; they get less than half of it, which reads as a look over the
// shoulder. The stool-sitters face a wall with nothing to do and get most of
// it, which is what somebody on a plastic stool on Ta Hien actually does.
const hanFolkNot = new Float32Array(hanFOLK_N);
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
const hanNOT_R       = 6.5;    // m
const hanNOT_EDGE    = 2.0;    // m of falloff at the rim
const hanNOT_L       = 3.4;    // damping
const hanNOT_WALK    = 0.42;   // how far round a walker comes
const hanNOT_SIT     = 0.85;   // ...and somebody on a stool
const hanNOT_WHEEK   = 3.0;    // s a shout holds the radius open
const hanNOT_WHEEK_K = 2.2;
let hanFolkWheek = 0;
let hanLanternMesh = null;

// bookkeeping
let hanArrived = false;
// ONE FLAG PER THING SAID, and hanToldFlow used to be two. It gated both the
// clip toast ("do not stop") and the wheek-answer toast ("everybody answered"),
// so whichever happened to you first permanently silenced the other — and the
// one most often lost was the chapter's core instruction, to a player who had
// simply wheeked in traffic before anybody clipped them.
let hanToldFlow = false, hanToldHorn = false, hanToldTrain = false, hanToldLake = false;
let hanAmbT = 0;
let hanBridgeDone = false, hanHucDone = false, hanTowerDone = false;
let hanPuppetDone = false;
let hanQuietT = 0;

// ---------------------------------------------------------------- helpers ---
function hanXform(px, py, pz, rx, ry, rz, sx, sy, sz) {
  hanE.set(rx, ry, rz, 'YXZ');
  hanQ.setFromEuler(hanE);
  hanV3.set(px, py, pz);
  hanSc.set(sx, sy, sz);
  hanM.compose(hanV3, hanQ, hanSc);
  return hanM;
}

const hanG = { box: null, cyl4: null, cyl6: null, cyl8: null, cyl12: null,
               cone4: null, cone6: null, sph6: null, sph8: null };
function hanInitGeos() {
  if (hanG.box) return;
  hanG.box = new THREE.BoxGeometry(1, 1, 1);
  hanG.cyl4 = new THREE.CylinderGeometry(0.5, 0.5, 1, 4);
  hanG.cyl6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
  hanG.cyl8 = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
  hanG.cyl12 = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
  hanG.cone4 = new THREE.ConeGeometry(0.5, 1, 4);
  hanG.cone6 = new THREE.ConeGeometry(0.5, 1, 6);
  hanG.sph6 = new THREE.SphereGeometry(0.5, 6, 4);
  hanG.sph8 = new THREE.SphereGeometry(0.5, 8, 6);
}

/**
 * CONTRACT: box() takes FULL extents; CANNON.Box takes HALF.
 *
 * AND ROTATIONS ARE +yaw. A box turned about Y by theta sends its local +z to
 * (sin theta, cos theta), which is the convention every heading in this file is
 * in — so a kerb, a rail or a shopfront laid along a street takes the heading
 * UNCHANGED. Chapter 18 negated it and put a hundred metres of crash barrier
 * across the road like a cattle grid.
 */
function hanMerger() {
  const M = makeMerger(hanG, {
    xform: hanXform, cylSegs: [4, 8, 12], coneSegs: [4], sphSegs: [8], normals: 'recompute', jitter: 0.060,
  });
  /** Four corners in order, as one flat quad. The shared merger cannot express
   *  this: every shape it has is a unit primitive under a transform, and this
   *  one is given world-space vertices. So it writes the buffers itself. */
  M.quad = function (ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, color) {
    hanCol.set(color);
    const s = M.n;
    const v = [ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz];
    for (let i = 0; i < 12; i += 3) {
      M.pos.push(v[i], v[i + 1], v[i + 2]);
      M.nor.push(0, 1, 0);
      M.col.push(hanCol.r, hanCol.g, hanCol.b);
    }
    M.idx.push(s, s + 1, s + 2, s, s + 2, s + 3);
    M.n += 4;
    return M;
  };
  return M;
}

function hanVC() {
  return grain(mat(0xffffff, { vertexColors: true }),
               { scale: 0.24, amount: 0.09, warp: 0.7, near: 0.30, nearPale: 0.60, nearScale: 13, contact: 1 });
}
/** THE GROUND, AND ONLY THE GROUND — hanVC() is on the tube houses as well,
 *  and a near octave scaled for wet concrete reads as damp on a shopfront.
 *  Flat, because the ground is horizontal and wants no vertical shear. */
function hanVCG() {
  return grain(mat(0xffffff, { vertexColors: true }),
               { scale: 0.24, amount: 0.09, warp: 0, near: 0.56, nearPale: 0.55, nearScale: 14, contact: 1, broad: 0.08, broadM: 16 });
}
function hanVCF() {
  return grain(mat(0xffffff, { vertexColors: true }), { scale: 0.08, amount: 0.055, warp: 1.0 });
}
function hanGlow(color, intensity) {
  return matEmit(color, intensity === undefined ? 1 : intensity);
}

function hanSyncBody(b) {
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
  b.previousQuaternion.copy(b.quaternion);
  b.interpolatedQuaternion.copy(b.quaternion);
}
function hanPoolBody(game) {
  const b = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC,
                              material: (game.mats && game.mats.ground) || undefined });
  b.allowSleep = true;
  return b;
}
function hanPoolBox(b, x, y, z, sx, sy, sz, ry) {
  const q = new CANNON.Quaternion();
  if (ry) q.setFromEuler(0, ry, 0);
  b.addShape(new CANNON.Box(new CANNON.Vec3(sx * 0.5, sy * 0.5, sz * 0.5)), new CANNON.Vec3(x, y, z), q);
  return b;
}
function hanPoolDone(game, b) {
  if (!b.shapes.length) return null;
  hanSyncBody(b);
  game.world.addBody(b);
  return b;
}
function hanSmooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
function hanTask(id) {
  const g = hanGame;
  if (g && typeof g.completeTask === 'function') g.completeTask(id);
}
function hanToast(s) {
  const g = hanGame;
  if (g && typeof g.toast === 'function') g.toast(s);
}
function hanSfx(name, opts) {
  const g = hanGame;
  if (g && typeof g.sfx === 'function') g.sfx(name, opts);
}
/** See placeCue in shared.js — it copies rather than writes, for a reason. */
function hanCue(name, x, y, z, volume, pitch, far) {
  const g = hanGame;
  if (!g || typeof g.sfx !== 'function') return;
  hanOpt.volume = volume;
  if (pitch !== undefined) hanOpt.pitch = pitch; else delete hanOpt.pitch;
  g.sfx(name, placeCue(hanOpt, x, y, z, far === undefined ? 150 : far));
}
function hanRecord(id, v) {
  const g = hanGame;
  if (g && typeof g.record === 'function') g.record(id, v);
}

// ------------------------------------------------------------- centrelines --
let hanSegT = 0;
function hanSegD(x, z, ax, az, bx, bz) {
  const ex = bx - ax, ez = bz - az;
  const L2 = ex * ex + ez * ez;
  let t = L2 > 1e-9 ? ((x - ax) * ex + (z - az) * ez) / L2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const px = ax + ex * t, pz = az + ez * t;
  hanSegT = t;
  return Math.hypot(x - px, z - pz);
}

// cumulative arc length per lane, so a rider is driven in METRES
const hanLaneLen = [];
const hanLaneTotal = [];
function hanInitLanes() {
  if (hanLaneLen.length) return;
  for (let L = 0; L < hanLANES.length; L++) {
    const lane = hanLANES[L];
    const cum = [];
    let s = 0;
    const n = lane.closed ? lane.pts.length : lane.pts.length - 1;
    for (let i = 0; i < n; i++) {
      cum.push(s);
      const a = lane.pts[i], b = lane.pts[(i + 1) % lane.pts.length];
      s += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    cum.push(s);
    hanLaneLen.push(cum);
    hanLaneTotal.push(s);
  }
}

/** Where lane L is at `s` metres. Writes x, z, yaw into `out`. */
function hanLaneAtS(L, s, out) {
  hanInitLanes();
  const lane = hanLANES[L];
  const cum = hanLaneLen[L], total = hanLaneTotal[L];
  let d = s;
  if (lane.closed) { d %= total; if (d < 0) d += total; }
  else d = clamp(d, 0, total - 0.001);
  let i = 0;
  for (let k = 0; k < cum.length - 1; k++) if (d >= cum[k]) i = k;
  const a = lane.pts[i], b = lane.pts[(i + 1) % lane.pts.length];
  const seg = cum[i + 1] - cum[i];
  const t = seg > 1e-6 ? (d - cum[i]) / seg : 0;
  out.x = a[0] + (b[0] - a[0]) * t;
  out.z = a[1] + (b[1] - a[1]) * t;
  out.yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
  return out;
}
const hanTmp = { x: 0, z: 0, yaw: 0 };
const hanTmp2 = { x: 0, z: 0, yaw: 0 };

/**
 * WHICH STREET AM I IN, AND WHICH WAY IS IT GOING.
 *
 * The one question this chapter asks more than any other. Cached on (x, z)
 * because the terrain build asks it a hundred thousand times and the crossing
 * test, the scooters, the buildings and the pavements all ask it again every
 * frame about the same point.
 */
let hanLaneD = 0, hanLaneI = -1, hanLaneS = 0, hanLaneYaw = 0, hanLaneW = 5.2;
let hanLaneCx = 1e9, hanLaneCz = 1e9;
function hanLaneAt(x, z) {
  if (x === hanLaneCx && z === hanLaneCz) return hanLaneD;
  hanLaneCx = x; hanLaneCz = z;
  hanInitLanes();
  let best = 1e9, bi = -1, bs = 0, byaw = 0, bw = 5.2;
  for (let L = 0; L < hanLANES.length; L++) {
    const lane = hanLANES[L];
    const n = lane.closed ? lane.pts.length : lane.pts.length - 1;
    for (let i = 0; i < n; i++) {
      const a = lane.pts[i], b = lane.pts[(i + 1) % lane.pts.length];
      const d = hanSegD(x, z, a[0], a[1], b[0], b[1]);
      if (d < best) {
        best = d; bi = L;
        bs = hanLaneLen[L][i] + (hanLaneLen[L][i + 1] - hanLaneLen[L][i]) * hanSegT;
        byaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
        bw = lane.w;
      }
    }
  }
  hanLaneD = best; hanLaneI = bi; hanLaneS = bs; hanLaneYaw = byaw; hanLaneW = bw;
  return best;
}

// ---------------------------------------------------------------- terrain ---
/**
 * THE GROUND, AND IT IS ONE NUMBER WITH TWO HOLES IN IT.
 *
 * After eighteen chapters of volcanoes, glaciers, karst and terraces this one
 * is genuinely flat, and that is not laziness — it is the reason the traffic
 * reads. A river of two hundred and forty moving things only works if the
 * player can see the whole of it at once, and a hill is the one thing that
 * takes that away.
 */
function hanTerrain(x, z) {
  // the Red River, past the dyke
  if (z > hanDYKE.cz) {
    const t = clamp((z - hanDYKE.cz) / 26, 0, 1);
    const dyk = hanDYKE.h * (1 - Math.abs(z - hanDYKE.cz) / hanDYKE.halfz);
    let h = lerp(hanGROUND, -3.4, hanSmooth(t));
    if (dyk > 0) h = Math.max(h, hanGROUND + dyk);
    return h;
  }
  let h = hanGROUND;
  // ...and the dyke's inner face
  if (z > hanDYKE.cz - hanDYKE.halfz) {
    const dyk = hanDYKE.h * (1 - Math.abs(z - hanDYKE.cz) / hanDYKE.halfz);
    if (dyk > 0) h = hanGROUND + dyk;
  }
  // the lake
  const dx = (x - hanLAKE.cx) / hanLAKE.rx, dz = (z - hanLAKE.cz) / hanLAKE.rz;
  const r = Math.sqrt(dx * dx + dz * dz);
  if (r < 1) {
    // ...with the two islets standing out of it
    const k = hanSmooth(clamp((1 - r) / 0.10, 0, 1));
    h = h + (hanLAKE.bed - h) * k;
    // FLAT ON TOP AND STEEP AT THE EDGE. As a plain cone these two islets had
    // no walkable surface at all: the height only reached the task's gate
    // within about a metre and a half of the exact centre, which is inside the
    // tower, so "get out to the tower" could not be completed by getting out
    // to the tower.
    const d1 = Math.hypot(x - hanTOWER.x, z - hanTOWER.z);
    const t1 = 1 - Math.max(0, d1 - 5.5) / 2.6;
    if (t1 > 0) h = Math.max(h, lerp(hanLAKE.bed, hanGROUND + 0.5, hanSmooth(t1)));
    const d2 = Math.hypot(x - hanNGOC.x, z - hanNGOC.z);
    const t2 = 1 - Math.max(0, d2 - 10.5) / 3.0;
    if (t2 > 0) h = Math.max(h, lerp(hanLAKE.bed, hanGROUND + 0.4, hanSmooth(t2)));
  }
  return h;
}
function hanSlope(x, z) {
  const e = 1.6;
  const hx = hanTerrain(x + e, z) - hanTerrain(x - e, z);
  const hz = hanTerrain(x, z + e) - hanTerrain(x, z - e);
  return Math.hypot(hx, hz) / (2 * e);
}
function hanIsOverWater(x, z) { return hanTerrain(x, z) < hanWATER - 0.05; }
function hanWaterHeightAt(x, z) {
  return hanWATER + Math.sin(hanTime * 0.8 + x * 0.10 + z * 0.07) * 0.025;
}

// ------------------------------------------------------------------- slip ---
// Nothing in Hanoi is slippery in the Iceland sense. What IS true is that
// pavements here are used for everything except walking, roads are hot smooth
// asphalt, and the lake steps are green.
const hanSLIP_ROAD  = 0.02;
const hanSLIP_KERB  = 0.00;
const hanSLIP_STEPS = 0.22;       // the algae on the lake steps
function hanGroundSlip(x, z) {
  const d = hanLaneAt(x, z);
  if (d < hanLaneW + 0.4) return hanSLIP_ROAD;
  const dx = (x - hanLAKE.cx) / (hanLAKE.rx + 3), dz = (z - hanLAKE.cz) / (hanLAKE.rz + 3);
  if (Math.sqrt(dx * dx + dz * dz) < 1.06) return hanSLIP_STEPS;
  return hanSLIP_KERB;
}
/** < 0.9 soft ground, ~1.0 stone, > 1.15 hollow timber. */
// THE LADDER, which was three rungs for eleven zones (v30).
//
// A chapter's ground is one of the few things the player hears every single
// second, and this one answered "asphalt, ballast, or the same tile everywhere
// else" for a city that has a timber bridge, an iron one, a wet market floor
// and a lake shore in it. Three of eleven is the same shortfall batch 3 found
// in Cali at two of six.
//
// ORDER MATTERS AND THE NARROW TESTS COME FIRST — the quay ladder in chapter 3
// was found returning wharf timber for the whole of Manly because a broad test
// sat above a narrow one. Every rect below is checked before the fallbacks.
function hanSurfacePitch(x, z) {
  // The Huc: lacquered timber over water, and the most hollow thing here.
  if (x <= hanHUC.x0 + 2 && x >= hanHUC.x1 - 2 &&
      Math.abs(z - (hanHUC.z0 + hanHUC.z1) * 0.5) < 3) return 1.30;
  // Long Bien: a hundred and twenty years of riveted steel deck.
  if (hanInRect(hanZ.bridge, x, z)) return 1.22;
  // The market: wet boards, cardboard and leaf. The deadest floor in the city.
  if (hanInRect(hanZ.market, x, z)) return 0.86;
  // The bia hoi corner: spilt beer on tile, and ninety-six plastic stools.
  if (hanInRect(hanZ.bia, x, z)) return 1.12;
  if (hanLaneAt(x, z) < hanLaneW + 0.4) return 0.94;
  if (Math.abs(z - hanTRAIN.z) < hanTRAIN.half && x > hanTRAIN.x0 && x < hanTRAIN.x1) return 1.10;
  // The dyke path round the lake: packed earth, not pavement.
  if (hanInRect(hanZ.dyke, x, z)) return 0.90;
  return 1.02;
}

// ------------------------------------------------------------------ zones ---
const hanZ = {
  lake:    { x0: -62, x1: 62, z0: -100, z1: -16 },
  quarter: { x0: hanOQ.x0, x1: hanOQ.x1, z0: hanOQ.z0, z1: hanOQ.z1 },
  rails:   { x0: hanTRAIN.x0, x1: hanTRAIN.x1, z0: hanTRAIN.z - hanTRAIN.half,
             z1: hanTRAIN.z + hanTRAIN.half },
  alley:   { x0: hanTRAIN.x0 - 4, x1: hanTRAIN.x1 + 4, z0: hanTRAIN.z - 6, z1: hanTRAIN.z + 6 },
  bia:     { x0: hanBIA.x - 16, x1: hanBIA.x + 16, z0: hanBIA.z - 14, z1: hanBIA.z + 14 },
  market:  { x0: hanMARKET.x - 20, x1: hanMARKET.x + 20, z0: hanMARKET.z - 14, z1: hanMARKET.z + 14 },
  bridge:  { x0: hanBRIDGE.x - 10, x1: hanBRIDGE.x + 10, z0: hanBRIDGE.z0, z1: hanBRIDGE.z1 },
  dyke:    { x0: -140, x1: 140, z0: hanDYKE.cz - 14, z1: hanDYKE.cz + 14 },
  ngoc:    { x0: hanNGOC.x - 13, x1: hanNGOC.x + 13, z0: hanNGOC.z - 13, z1: hanNGOC.z + 13 },
  puppet:  { x0: hanPUPPET.x - 12, x1: hanPUPPET.x + 12, z0: hanPUPPET.z - 10, z1: hanPUPPET.z + 10 },
};
function hanInRect(r, x, z) { return x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1; }
function hanInZone(name, x, z) {
  if (name === 'traffic') return hanLaneAt(x, z) < hanLaneW;
  if (name === 'tower') return Math.hypot(x - hanTOWER.x, z - hanTOWER.z) < 8;
  const r = hanZ[name];
  return r ? hanInRect(r, x, z) : false;
}
function hanRandomPointIn(name) {
  const r = hanZ[name];
  if (!r) return { x: 0, z: 0 };
  for (let i = 0; i < 24; i++) {
    const x = rand(r.x0, r.x1), z = rand(r.z0, r.z1);
    if (hanTerrain(x, z) > hanWATER + 0.2) return { x: x, z: z };
  }
  return { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 };
}

// -------------------------------------------------------------- navBlocked --
const hanBLOCK = [];
function hanBlock(x, z, r) { hanBLOCK.push({ x: x, z: z, r: r }); }
function hanNavBlocked(x, z, radius) {
  const r = radius || 0.5;
  if (hanTerrain(x, z) < hanWATER + 0.15) return true;
  for (let i = 0; i < hanBLOCK.length; i++) {
    const b = hanBLOCK[i];
    const dx = x - b.x, dz = z - b.z;
    if (dx * dx + dz * dz < (b.r + r) * (b.r + r)) return true;
  }
  return false;
}

// ============================================================= THE GROUND ====
/**
 * ONE MESH, AND ALMOST ALL OF IT IS ONE HEIGHT.
 *
 * Sampled at 4 m, which is finer than a flat plain needs and exactly what the
 * lake's rim and the dyke's crest do need. Vertex colour carries the whole
 * read: hot pale concrete over most of it, asphalt down every centreline, the
 * green of the lake bed where there is water over it, and the red mud of the
 * river past the dyke.
 */
function hanBuildGround(game, root) {
  // FIVE METRES, NOT FOUR. This terrain has three features in it and two of
  // them are holes; the road surface is a mesh of its own, so the grid only
  // has to resolve the lake's rim and the dyke's crest, and both of those are
  // twenty metres wide. Ten thousand triangles for nothing.
  const X0 = hanSEA_X0, X1 = hanSEA_X1, Z0 = hanSEA_Z0, Z1 = hanSEA_Z1, EL = 5;
  const NX = Math.round((X1 - X0) / EL), NZ = Math.round((Z1 - Z0) / EL);
  const g = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0, NX, NZ);
  g.rotateX(-Math.PI / 2);
  g.translate((X0 + X1) / 2, 0, (Z0 + Z1) / 2);
  const p = g.attributes.position.array;
  const col = new Float32Array(p.length);
  const c = new THREE.Color();
  const conc = new THREE.Color(PALETTE.hanConcrete);
  const concDk = new THREE.Color(PALETTE.hanConcreteDk);
  const road = new THREE.Color(PALETTE.hanAsphalt);
  const bed = new THREE.Color(PALETTE.hanLakeBed);
  const mud = new THREE.Color(PALETTE.hanMud);
  const dust = new THREE.Color(PALETTE.hanDust);
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i], z = p[i + 2];
    const h = hanTerrain(x, z);
    p[i + 1] = h;
    if (h < hanWATER && z < hanDYKE.cz) {
      c.copy(bed);
    } else if (z > hanDYKE.cz + 6) {
      c.copy(mud);
    } else {
      c.copy(conc).lerp(concDk, clamp(hanSlope(x, z) * 3.0, 0, 1) * 0.8);
      c.lerp(dust, 0.20 + 0.25 * Math.abs(Math.sin(x * 0.07) * Math.cos(z * 0.05)));
      const d = hanLaneAt(x, z);
      if (d < hanLaneW + 1.2) c.lerp(road, clamp(1 - (d - hanLaneW) / 1.2, 0, 1));
    }
    col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, hanVCG());
  m.receiveShadow = true; m.castShadow = false;
  m.frustumCulled = false;
  root.add(m);
}

function hanBuildGroundBody(game) {
  const EL = 5, X0 = hanSEA_X0, Z0 = hanSEA_Z0;
  const NX = Math.round((hanSEA_X1 - X0) / EL), NZ = Math.round((hanSEA_Z1 - Z0) / EL);
  const Z1 = Z0 + NZ * EL;
  const data = [];
  for (let i = 0; i <= NX; i++) {
    const row = [];
    for (let j = 0; j <= NZ; j++) row.push(hanTerrain(X0 + i * EL, Z1 - j * EL));
    data.push(row);
  }
  const hf = new CANNON.Heightfield(data, { elementSize: EL });
  const b = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
  b.addShape(hf);
  b.position.set(X0, 0, Z1);
  b.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  hanSyncBody(b);
  game.world.addBody(b);
}

// ============================================================== THE LAKE =====
/**
 * EIGHTY METRES OF STILL GREEN WATER, and the whole chapter is arranged round
 * the fact that it is quiet.
 *
 * It is not blue and it must not be. Hoan Kiem is a jade-green shallow lake
 * with three metres of visibility and a great deal of algae in it, and drawing
 * it as harbour water would make the one calm place in this chapter look like
 * a swimming pool. The colour ramp goes green to a deeper green, never toward
 * a blue at all, which is the single thing that makes it read as fresh water.
 */
function hanBuildLake(root) {
  const g = new THREE.CircleGeometry(1, 46);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const lt = new THREE.Color(PALETTE.hanLake);
  const dp = new THREE.Color(PALETTE.hanLakeDeep);
  for (let i = 0; i < pos.count; i++) {
    // the unit circle is scaled into the ellipse HERE rather than by a
    // matrix, so the shore is where the terrain's own cut is and the two can
    // never be one metre out
    const u = pos.getX(i), v = pos.getZ(i);
    const r = Math.min(1, Math.hypot(u, v));
    pos.setX(i, u * hanLAKE.rx + hanLAKE.cx);
    pos.setZ(i, v * hanLAKE.rz + hanLAKE.cz);
    pos.setY(i, hanWATER);
    // deep in the middle, pale at the edge, and NEVER toward a blue: three
    // metres of visibility and a great deal of algae is what makes fresh water
    // read as fresh water instead of as a swimming pool.
    c.copy(dp).lerp(lt, hanSmooth(r));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  pos.needsUpdate = true;
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, grain(mat(0xffffff, { vertexColors: true }),
                                    { scale: 0.05, amount: 0.05, warp: 1.1 }));
  m.receiveShadow = true; m.castShadow = false;
  m.frustumCulled = false;
  hanLakeMesh = m;
  hanLakeAttr = pos;
  root.add(m);

  // ...and the Red River, past the dyke, which is a different colour entirely
  const rg = new THREE.PlaneGeometry(460, 150, 1, 1);
  rg.rotateX(-Math.PI / 2);
  rg.translate(0, hanWATER - 0.6, hanDYKE.cz + 92);
  const rm = new THREE.Mesh(rg, grain(mat(PALETTE.hanRiver), { scale: 0.04, amount: 0.06 }));
  rm.receiveShadow = true; rm.castShadow = false;
  rm.frustumCulled = false;
  root.add(rm);
}

function hanUpdateLake(dt) {
  if (!hanLakeAttr) return;
  const a = hanLakeAttr;
  for (let i = 0; i < a.count; i++) {
    const x = a.getX(i), z = a.getZ(i);
    a.setY(i, hanWATER + Math.sin(hanTime * 0.8 + x * 0.10 + z * 0.07) * 0.025);
  }
  a.needsUpdate = true;
}

// ============================================================ THE STREETS ====
/**
 * THE ASPHALT, THE KERBS AND THE PAINT.
 *
 * Generated by walking the four centrelines, exactly as chapter 18's circuit
 * is. What is different is what a Hanoi street HAS on it: no lane markings
 * worth the name, a kerb you can barely see, and a pavement that is not a
 * pavement — it is a car park, a kitchen, a barber's shop and somebody's front
 * room, which is why crossing the road here is done in the road.
 */
function hanBuildStreets(game, root) {
  hanInitLanes();
  const K = hanMerger();
  const KB = hanMerger();
  const body = hanPoolBody(game);
  for (let L = 0; L < hanLANES.length; L++) {
    const lane = hanLANES[L];
    const total = hanLaneTotal[L];
    const HALF = lane.w + 0.5;
    const n = Math.ceil(total / 3.0);
    let px = 0, pz = 0, pnx = 0, pnz = 0, have = false;
    for (let i = 0; i <= n; i++) {
      const s = (i / n) * total;
      hanLaneAtS(L, s, hanTmp);
      const nx = Math.cos(hanTmp.yaw), nz = -Math.sin(hanTmp.yaw);
      const x = hanTmp.x, z = hanTmp.z;
      if (have) {
        const y = hanGROUND + 0.04;
        K.quad(px - pnx * HALF, y, pz - pnz * HALF,
               px + pnx * HALF, y, pz + pnz * HALF,
               x + nx * HALF, y, z + nz * HALF,
               x - nx * HALF, y, z - nz * HALF, PALETTE.hanAsphalt);
      }
      // the kerb, both sides, and it is fifteen centimetres of nothing
      for (let sd = -1; sd <= 1; sd += 2) {
        KB.box(x + nx * (HALF + 0.35) * sd, hanGROUND + 0.09, z + nz * (HALF + 0.35) * sd,
               0.7, 0.30, 3.1, PALETTE.hanKerb, 0, hanTmp.yaw, 0);
      }
      px = x; pz = z; pnx = nx; pnz = nz; have = true;
    }
  }
  const m = new THREE.Mesh(K.build(), hanVC());
  m.receiveShadow = true; m.castShadow = false;
  root.add(m);
  const mb = new THREE.Mesh(KB.build(), hanVC());
  mb.receiveShadow = true; mb.castShadow = false;
  root.add(mb);
  hanPoolDone(game, body);
}

// ============================================================ THE QUARTER ====
/**
 * THE TUBE HOUSES, and the reason this city looks like nowhere else.
 *
 * A nha ong is three and a half metres wide, twenty deep and five storeys
 * high, because for two hundred years the tax was on the FRONTAGE. So a street
 * here is a row of things that are all the same width and none of the same
 * height, painted mustard, ochre and a green that has been in the sun for
 * forty years, with a shop open to the pavement on the ground floor and
 * somebody's washing on every balcony above it.
 *
 * That is four rules and they generate the whole city: same width, random
 * height, three colours, and a shop at the bottom. Everything else here is the
 * cables.
 */
const hanHOUSE_W = 3.6;
const hanWinPos = [];
const hanSignPos = [];
function hanWindowAt(x, y, z, yaw, w, h) { hanWinPos.push(x, y, z, yaw, w, h); }

function hanHouse(K, x, z, yaw, h, style, deep) {
  const d = deep === undefined ? 11 : deep;
  const body = style === 0 ? PALETTE.hanMustard : style === 1 ? PALETTE.hanOchre
             : style === 2 ? PALETTE.hanJade : style === 3 ? PALETTE.hanPeach
             : PALETTE.hanPlaster;
  const cs = Math.sin(yaw), cc = Math.cos(yaw);
  K.box(x, hanGROUND + h * 0.5, z, hanHOUSE_W, h, d, body, 0, yaw, 0);
  // the shopfront: the ground floor is OPEN, which is the other half of why a
  // pavement here is not a pavement
  K.box(x, hanGROUND + 1.7, z - (d * 0.5 - 0.1) * cc, hanHOUSE_W - 0.3, 3.4, 0.4,
        PALETTE.hanShopDk, 0, yaw, 0);
  K.box(x - (d * 0.5) * cs, hanGROUND + 1.7, z - (d * 0.5) * cc, hanHOUSE_W, 0.35, 0.5,
        PALETTE.hanTrim, 0, yaw, 0);
  // the awning over it, in a blue tarpaulin, and there is one on every shop
  // ...and it alternates on a RANDOM draw rather than on the integer part of
  // x. Houses are 3.72 m apart, so (x | 0) % 3 produced runs of eight and nine
  // identical awnings and the street had a thirty-metre red roof on it.
  K.box(x - (d * 0.5 + 0.9) * cs, hanGROUND + 3.2, z - (d * 0.5 + 0.9) * cc,
        hanHOUSE_W - 0.15, 0.10, 2.2,
        Math.random() < 0.55 ? PALETTE.hanTarp : PALETTE.hanTarpRed, -0.13, yaw, 0);
  // the cornice, the parapet and the water tank
  K.box(x, hanGROUND + h + 0.22, z, hanHOUSE_W + 0.5, 0.44, d + 0.5, PALETTE.hanTrim, 0, yaw, 0);
  K.box(x, hanGROUND + h + 0.75, z, hanHOUSE_W + 0.2, 0.62, d * 0.9, body, 0, yaw, 0);
  K.cyl(x + 0.7, hanGROUND + h + 1.6, z + 1.2, 0.42, 1.1, PALETTE.hanTank, 0, 0, 0, 8);
  // the balconies. One per floor above the shop, each with something on it.
  const floors = Math.max(1, Math.floor((h - 4.2) / 3.1));
  for (let f = 0; f < floors; f++) {
    const fy = hanGROUND + 4.4 + f * 3.1;
    const bz = z - (d * 0.5 + 0.42) * cc, bx = x - (d * 0.5 + 0.42) * cs;
    K.box(bx, fy - 0.06, bz, hanHOUSE_W - 0.2, 0.12, 0.9, PALETTE.hanTrim, 0, yaw, 0);
    K.box(bx - 0.42 * cs, fy + 0.42, bz - 0.42 * cc, hanHOUSE_W - 0.2, 0.85, 0.08,
          PALETTE.hanRail, 0, yaw, 0);
    // THREE BALUSTERS, NOT FIVE. Measured: at five, four hundred houses with
    // four floors each spent fifty-seven thousand triangles on twelve-triangle
    // sticks nobody can resolve past eight metres, which was a fifth of the
    // whole chapter.
    for (let r = 0; r < 3; r++) {
      K.box(bx - 0.42 * cs + (r - 1) * 1.0 * cc, fy + 0.42, bz - 0.42 * cc - (r - 1) * 1.0 * -cs,
            0.06, 0.85, 0.06, PALETTE.hanRail, 0, yaw, 0);
    }
    // washing, which is the one thing that makes a facade look inhabited
    if (Math.random() < 0.75) {
      const col = [PALETTE.hanWash1, PALETTE.hanWash2, PALETTE.hanWash3, PALETTE.hanWash4];
      for (let w = 0; w < 3; w++) {
        if (Math.random() < 0.35) continue;
        K.box(bx - 0.62 * cs + (w - 1) * 0.9 * cc, fy + 0.55, bz - 0.62 * cc + (w - 1) * 0.9 * cs,
              0.62, 0.9, 0.03, col[randInt(0, 3)], 0, yaw, 0);
      }
    }
    hanWindowAt(x - (d * 0.5 + 0.06) * cs, fy + 1.5, z - (d * 0.5 + 0.06) * cc, yaw + Math.PI, 1.5, 1.9);
    // the shutters either side of it, which are always green
    for (let sd = -1; sd <= 1; sd += 2) {
      K.box(x - (d * 0.5 + 0.10) * cs + sd * 1.05 * cc, fy + 1.5, z - (d * 0.5 + 0.10) * cc - sd * 1.05 * -cs,
            0.5, 1.9, 0.08, PALETTE.hanShutter, 0, yaw, 0);
    }
  }
  // the sign. Vertical, painted, and there are thousands of them.
  if (Math.random() < 0.55) {
    hanSignPos.push(x - (d * 0.5 + 0.55) * cs, hanGROUND + 4.0, z - (d * 0.5 + 0.55) * cc,
                    yaw, rand(0.55, 0.85), rand(1.6, 2.8));
  }
  hanBlock(x, z, Math.max(hanHOUSE_W, d) * 0.42);
}

/**
 * A TERRACE OF THEM DOWN ONE SIDE OF A STREET.
 *
 * `off` is which side (the sign of the lane normal) and `set` is how far back
 * from the centreline the FRONTS stand — so the pavement's width is one number
 * and the whole quarter can be widened or narrowed from here.
 */
// THE PLACES A TERRACE MAY NOT STAND IN, and they are not decoration: a
// junction, a market and a corner with a hundred stools on it are HOLES in the
// frontage, and a generator that lays houses along a centreline has no idea
// that the next centreline crosses it.
//
// Measured before this: lane 0's terrace was placed twelve metres either side
// of a street that crosses lane 1 at right angles, so eight houses stood IN
// the east-west road. navBlocked said X for the whole width of it, the
// crossing task was unreachable, and the bia hoi corner — the chapter's second
// mini — was inside a building.
const hanKEEPOUT = [];
function hanKeepOut(x, z, r) { hanKEEPOUT.push({ x: x, z: z, r: r }); }
function hanTerraceOk(x, z) {
  // ...at least seven metres from any centreline. Its OWN lane is 8.4 away by
  // construction, so this can only ever be triggered by a different street.
  if (hanLaneAt(x, z) < 7.0) return false;
  for (let i = 0; i < hanKEEPOUT.length; i++) {
    const k = hanKEEPOUT[i];
    const dx = x - k.x, dz = z - k.z;
    if (dx * dx + dz * dz < k.r * k.r) return false;
  }
  return true;
}

function hanTerrace(K, L, s0, s1, off, set, body, game) {
  hanInitLanes();
  const step = hanHOUSE_W + 0.12;
  for (let s = s0; s < s1; s += step) {
    hanLaneAtS(L, s, hanTmp);
    const nx = Math.cos(hanTmp.yaw), nz = -Math.sin(hanTmp.yaw);
    const d = rand(9, 13);
    const h = rand(9, 19);
    const bx = hanTmp.x + nx * (set + d * 0.5) * off;
    const bz = hanTmp.z + nz * (set + d * 0.5) * off;
    if (hanTerrain(bx, bz) < hanWATER + 0.3) continue;
    // THREE POINTS, not one: the shopfront, the middle and the back wall. A
    // twelve-metre-deep house whose centre is clear can still have its back
    // half standing in the next street.
    if (!hanTerraceOk(bx, bz)) continue;
    if (!hanTerraceOk(hanTmp.x + nx * set * off, hanTmp.z + nz * set * off)) continue;
    if (!hanTerraceOk(hanTmp.x + nx * (set + d) * off, hanTmp.z + nz * (set + d) * off)) continue;
    // the house faces the road, so its -z looks at the centreline
    const yaw = hanTmp.yaw + (off > 0 ? Math.PI / 2 : -Math.PI / 2);
    hanHouse(K, bx, bz, yaw, h, randInt(0, 4), d);
    hanPoolBox(body, bx, hanGROUND + h * 0.5 + 1, bz, hanHOUSE_W, h + 2, d, yaw);
    // ...AND A HOUSE IS AN OBSTACLE (integrity 9). Every terrace in the chapter
    // was bodied and none of them was ever registered with hanNavBlocked, so
    // the backdrop, the stools, the oddments and the locals were all placed as
    // if the frontage were not there. It did not show while the ring's frontage
    // was being silently discarded into the lake; the moment that came back it
    // was one instanced block per house, standing inside it.
    hanBlock(bx, bz, Math.max(hanHOUSE_W, d) * 0.45);
  }
}

function hanBuildQuarter(game, root) {
  const K = hanMerger();
  const body = hanPoolBody(game);
  hanInitLanes();
  // the five holes in the frontage, and every one of them is somewhere the
  // chapter puts a task
  hanKeepOut(hanBIA.x, hanBIA.z, 19);
  hanKeepOut(hanMARKET.x, hanMARKET.z, 26);
  hanKeepOut(hanBARBER.x, hanBARBER.z, 13);
  hanKeepOut(hanPUPPET.x, hanPUPPET.z, 22);
  hanKeepOut(-8, -4, 12);
  hanKeepOut(hanTRAIN.x1 + 6, hanTRAIN.z, 16);
  // ...and a sixth, at the spawn (integrity 9). The arrival puts the lens
  // twelve metres out on the bearing in HANOI_SPAWN.yaw, which is west-south-
  // west, which is the ring's outer side — so the moment that frontage came
  // back the chapter opened with the camera inside a shophouse, looking at the
  // lake through the gap between two of them. The rig's occlusion ray would
  // have hauled the boom in to a metre and a half; that is a bug being masked,
  // not a shot. The corner of Hoan Kiem the player lands on is a junction in
  // life, so: fifteen metres of open pavement, and the terrace resumes.
  hanKeepOut(hanSPAWN.x, hanSPAWN.z, 15);
  // both sides of the two big streets, and the outside of the ring
  hanTerrace(K, 0, 26, hanLaneTotal[0] - 4, 1, 8.4, body, game);
  hanTerrace(K, 0, 26, hanLaneTotal[0] - 4, -1, 8.4, body, game);
  hanTerrace(K, 1, 4, 74, 1, 8.4, body, game);
  hanTerrace(K, 1, 4, 74, -1, 8.4, body, game);
  hanTerrace(K, 1, 108, hanLaneTotal[1] - 4, 1, 8.4, body, game);
  hanTerrace(K, 1, 108, hanLaneTotal[1] - 4, -1, 8.4, body, game);
  hanTerrace(K, 3, 4, 78, 1, 8.0, body, game);
  hanTerrace(K, 3, 116, hanLaneTotal[3] - 4, -1, 8.0, body, game);
  // ...and the outer side of the lake ring, which is the one continuous
  // frontage in the chapter and the reason the lake feels enclosed.
  //
  // OFF = -1, NOT +1 (integrity 9). hanTerrace's normal is (cos yaw, -sin yaw)
  // with yaw = atan2(dx, dz), which is (dz, -dx) — and this polyline is wound
  // so that points INTO the lake at every one of its eleven segments. So the
  // whole of the "one continuous frontage" was laid in the water, where
  // hanTerrace's own `hanTerrain < hanWATER + 0.3` test then threw almost all
  // of it away in silence. Measured before this: twenty-four stations round the
  // ring, sampled at 10, 16 and 24 m outside it, and twenty-one of them read
  // bare ground at 1.2 m. The lake was enclosed by nothing at all, which is
  // most of why the spawn at (-60, -78) had an empty plain at its back.
  hanTerrace(K, 2, 0, hanLaneTotal[2], -1, 8.6, body, game);
  // ...AND A SECOND ROW ON THE ARC THE PLAYER LANDS ON. The ring is 340 m
  // round; s = 196..304 is its west and south-west, which is the whole of the
  // spawn's outlook. One frontage plus a backdrop is enough where the backdrop
  // is only ever seen over a roof, but here it is walked up to, so this is the
  // far side of the boulevard: real houses with shutters, awnings and lit
  // windows, facing back at the road, rather than the blank side of an
  // instanced box. Twenty-nine of them, about nine thousand triangles.
  hanTerrace(K, 2, 196, 304, -1, 34, body, game);

  const m = new THREE.Mesh(K.build(), hanVCF());
  m.castShadow = true; m.receiveShadow = true;
  root.add(m);
  hanPoolDone(game, body);
  hanBuildBackdrop(game, root);
}

/**
 * THE BLOCK BEHIND THE STREET, and without it the Old Quarter is four rows of
 * houses on an empty plain.
 *
 * The terraces are generated along the four centrelines, which is right and
 * which means the map has buildings exactly where the roads are and nowhere
 * else. What is actually behind a Hanoi frontage is another two hundred metres
 * of exactly the same thing down alleys a metre wide, so: one instanced box
 * per building, filling the quarter rectangle wherever a terrace has not
 * already put something, in the same five colours. One draw call, one pooled
 * body, and from the street it is a wall of roofs behind the roofs.
 */
/**
 * ...AND THE BLOCK WENT ROUND THREE SIDES OF THE LAKE AND NOT THE FOURTH
 * (integrity 9).
 *
 * The rectangle below used to be hanOQ alone, which is the Old Quarter, which
 * is everything NORTH of z = -24. South, west and east of Hoan Kiem there was
 * the ring road's own frontage — one building deep, and correct — and behind
 * it a pale concrete plain to the horizon. The spawn is at (-60, -78), on the
 * lake's south-west shore, so this was the near half of the first frame of the
 * chapter: thirty metres west of where the player lands, the world is empty
 * out to x = -230. `qa/b9-hanoi-w30-before.png`.
 *
 * Two regions, then, sampled independently so the surround cannot be starved
 * by a lucky run of rejections in the quarter. The surround is deliberately
 * NOT more Old Quarter: south of Hoan Kiem is the French Quarter, so its boxes
 * are wider, lower and further apart, and the ring's frontage stays the only
 * dense thing in the frame.
 */
const hanBACK_REGIONS = [
  // the Old Quarter, exactly as it was
  { x0: hanOQ.x0 - 34, x1: hanOQ.x1 + 34, z0: hanOQ.z0 - 6, z1: hanOQ.z1 + 26,
    n: 260, w: [7, 13], h: [8, 21], clear: 7 },
  // the surround: everything outside the lake ring, on the other three sides
  // ...and it keeps THIRTY metres off a centreline, not sixteen. Sixteen is
  // right behind a frontage, where the block is only ever seen over a roof;
  // out here it is walked up to, and an eight-metre blank wall a stride from
  // the animal's nose is the one thing worse than the plain it replaced. At
  // thirty it is the far side of the boulevard that runs outside the ring, it
  // reads as the next quarter, and — being bodied — it is a wall you can see
  // over rather than a sentence, which is what block 7 learned on Sydney's
  // north lawn.
  { x0: -148, x1: 148, z0: -152, z1: -18, n: 220, w: [7, 11], h: [7, 17], clear: 3,
    grid: 11.5, street: 3, laneMin: 46 },
];
const hanBACK_N = 460;
let hanBackMesh = null;
function hanBuildBackdrop(game, root) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const m = new THREE.InstancedMesh(geo, grain(mat(0xffffff), { scale: 0.08, amount: 0.055 }),
                                    hanBACK_N);
  m.castShadow = true; m.receiveShadow = true;
  m.frustumCulled = false;
  const body = hanPoolBody(game);
  const col = new Float32Array(hanBACK_N * 3);
  const pal = [PALETTE.hanMustard, PALETTE.hanOchre, PALETTE.hanJade,
               PALETTE.hanPeach, PALETTE.hanPlaster];
  let n = 0;
  // one placement, wherever the point came from
  function put(x, z, R, ry) {
    // not on a street, not on the railway, not in the lake, and not on top of
    // anything a terrace or a set piece has already claimed
    if (hanLaneAt(x, z) < (R.laneMin || 16)) return false;
    if (Math.abs(z - hanTRAIN.z) < 18 && x > hanTRAIN.x0 - 6 && x < hanTRAIN.x1 + 6) return false;
    if (hanTerrain(x, z) < hanWATER + 0.4) return false;
    if (hanNavBlocked(x, z, R.clear)) return false;
    if (!hanTerraceOk(x, z)) return false;
    const w = rand(R.w[0], R.w[1]), d = rand(R.w[0], R.w[1]), h = rand(R.h[0], R.h[1]);
    hanE.set(0, ry, 0, 'YXZ');
    hanM.compose(hanV3.set(x, hanGROUND + h * 0.5, z), hanQ.setFromEuler(hanE),
                 hanSc.set(w, h, d));
    m.setMatrixAt(n, hanM);
    hanCol.set(pal[randInt(0, pal.length - 1)]);
    col[n * 3] = hanCol.r; col[n * 3 + 1] = hanCol.g; col[n * 3 + 2] = hanCol.b;
    hanPoolBox(body, x, hanGROUND + h * 0.5, z, w, h, d, hanE.y);
    hanBlock(x, z, Math.max(w, d) * 0.45);
    n++;
    return true;
  }
  for (let ri = 0; ri < hanBACK_REGIONS.length; ri++) {
    const R = hanBACK_REGIONS[ri];
    const stop = Math.min(hanBACK_N, n + R.n);
    if (!R.grid) {
      // ...behind a frontage, where nothing is ever seen end-on, rejection
      // sampling at any rotation is exactly right.
      for (let g = 0; g < 6000 && n < stop; g++) put(rand(R.x0, R.x1), rand(R.z0, R.z1), R, rand(0, 6.28));
      continue;
    }
    // ...BUT THE SURROUND IS WALKED THROUGH, AND SCATTER IS NOT A CITY.
    // A first cut sampled this region the same way and read, from the ground,
    // as boxes dropped on a plain: no two of them lined up, so there was
    // nothing to walk ALONG. A jittered lattice with a gap every fourth row
    // makes blocks and the spaces between them into streets, which is what is
    // actually south of Hoan Kiem.
    const p = R.grid;
    const nx = Math.floor((R.x1 - R.x0) / p), nz = Math.floor((R.z1 - R.z0) / p);
    for (let i = 0; i <= nx && n < stop; i++) {
      if (R.street && i % R.street === R.street - 1) continue;
      for (let k = 0; k <= nz && n < stop; k++) {
        if (R.street && k % R.street === R.street - 1) continue;
        put(R.x0 + p * (i + 0.5) + rand(-1.6, 1.6),
            R.z0 + p * (k + 0.5) + rand(-1.6, 1.6), R, rand(-0.09, 0.09));
      }
    }
  }
  m.count = n;
  m.instanceColor = new THREE.InstancedBufferAttribute(col, 3);
  m.instanceMatrix.needsUpdate = true;
  hanBackMesh = m;
  root.add(m);
  hanPoolDone(game, body);
}

/** Every lit interior and every shop light, in one instanced draw. */
function hanBuildWindows(root) {
  const n = hanWinPos.length / 6;
  if (!n) return;
  const geo = new THREE.PlaneGeometry(1, 1);
  const m = new THREE.InstancedMesh(geo, hanGlow(PALETTE.hanWindow, 0.34), n);
  m.castShadow = false; m.receiveShadow = false;
  m.frustumCulled = false;
  m.userData.noShadow = true;
  const col = new Float32Array(n * 3);
  const glass = new THREE.Color(PALETTE.hanGlass);
  const lit = new THREE.Color(PALETTE.hanWindow);
  for (let i = 0; i < n; i++) {
    hanM.compose(hanV3.set(hanWinPos[i * 6], hanWinPos[i * 6 + 1], hanWinPos[i * 6 + 2]),
                 hanQ.setFromEuler(hanE.set(0, hanWinPos[i * 6 + 3], 0, 'YXZ')),
                 hanSc.set(hanWinPos[i * 6 + 4], hanWinPos[i * 6 + 5], 1));
    m.setMatrixAt(i, hanM);
    // IT IS THE MORNING, so most of them are dark glass and a few are on. The
    // opposite of chapter 18, and deliberately: two chapters in a row whose
    // skyline is a wall of lit rectangles would be one chapter twice.
    hanCol.copy(Math.random() < 0.22 ? lit : glass);
    const k = 0.8 + Math.random() * 0.4;
    col[i * 3] = hanCol.r * k; col[i * 3 + 1] = hanCol.g * k; col[i * 3 + 2] = hanCol.b * k;
  }
  m.instanceColor = new THREE.InstancedBufferAttribute(col, 3);
  m.instanceMatrix.needsUpdate = true;
  hanWinMesh = m;
  root.add(m);
}

/** The signs. Vertical, painted, hung off every shopfront in the quarter. */
function hanBuildSigns(root) {
  const n = hanSignPos.length / 6;
  if (!n) return;
  // A PLAIN material. hanVCF asks for vertexColors and a BoxGeometry has no
  // colour attribute, so every sign in the quarter rendered BLACK.
  const geo = new THREE.BoxGeometry(1, 1, 0.06);
  const m = new THREE.InstancedMesh(geo, grain(mat(0xffffff), { scale: 0.08, amount: 0.05 }), n);
  m.castShadow = false; m.receiveShadow = false;
  m.frustumCulled = false;
  const col = new Float32Array(n * 3);
  const pal = [PALETTE.hanSign1, PALETTE.hanSign2, PALETTE.hanSign3, PALETTE.hanSign4];
  for (let i = 0; i < n; i++) {
    hanM.compose(hanV3.set(hanSignPos[i * 6], hanSignPos[i * 6 + 1], hanSignPos[i * 6 + 2]),
                 hanQ.setFromEuler(hanE.set(0, hanSignPos[i * 6 + 3], 0, 'YXZ')),
                 hanSc.set(hanSignPos[i * 6 + 4], hanSignPos[i * 6 + 5], 1));
    m.setMatrixAt(i, hanM);
    hanCol.set(pal[randInt(0, pal.length - 1)]);
    col[i * 3] = hanCol.r; col[i * 3 + 1] = hanCol.g; col[i * 3 + 2] = hanCol.b;
  }
  m.instanceColor = new THREE.InstancedBufferAttribute(col, 3);
  m.instanceMatrix.needsUpdate = true;
  hanSignMesh = m;
  root.add(m);
}

/**
 * THE CABLES, and they are as much of this city's silhouette as the houses.
 *
 * A pole every twenty-two metres down both sides of every street, and between
 * each pair a BALL of them — nine or ten sagging lines drawn as thin boxes
 * pitched to their own sag. Nothing else in eighteen chapters looks like this
 * and it costs one merged mesh.
 */
function hanBuildCables(game, root) {
  const K = hanMerger();
  const body = hanPoolBody(game);
  hanInitLanes();
  for (let L = 0; L < hanLANES.length; L++) {
    const total = hanLaneTotal[L];
    const HALF = hanLANES[L].w + 1.9;
    for (let sd = -1; sd <= 1; sd += 2) {
      let prev = null;
      for (let s = 0; s <= total; s += 22) {
        hanLaneAtS(L, s, hanTmp);
        const nx = Math.cos(hanTmp.yaw), nz = -Math.sin(hanTmp.yaw);
        const x = hanTmp.x + nx * HALF * sd, z = hanTmp.z + nz * HALF * sd;
        if (hanTerrain(x, z) < hanWATER + 0.3) { prev = null; continue; }
        K.cyl(x, hanGROUND + 4.2, z, 0.13, 8.4, PALETTE.hanPole, 0, 0, 0, 6);
        K.box(x, hanGROUND + 7.6, z, 1.5, 0.10, 0.10, PALETTE.hanPole, 0, hanTmp.yaw + 1.5708, 0);
        K.box(x, hanGROUND + 6.9, z, 1.1, 0.10, 0.10, PALETTE.hanPole, 0, hanTmp.yaw + 1.5708, 0);
        hanPoolBox(body, x, hanGROUND + 2.0, z, 0.4, 4.0, 0.4);
        hanBlock(x, z, 0.4);
        if (prev) {
          const L2 = Math.hypot(x - prev[0], z - prev[1]);
          const yaw = Math.atan2(x - prev[0], z - prev[1]);
          const mx = (x + prev[0]) / 2, mz = (z + prev[1]) / 2;
          for (let c = 0; c < 7; c++) {
            const sag = 0.35 + c * 0.11;
            const yy = hanGROUND + 7.4 - c * 0.16;
            // three segments, so the sag reads as a sag and not as a straight
            for (let k = 0; k < 3; k++) {
              const t0 = k / 3, t1 = (k + 1) / 3;
              const y0 = yy - sag * 4 * t0 * (1 - t0);
              const y1 = yy - sag * 4 * t1 * (1 - t1);
              const sx = lerp(prev[0], x, (t0 + t1) / 2);
              const sz = lerp(prev[1], z, (t0 + t1) / 2);
              K.box(sx + (c - 4) * 0.09 * Math.cos(yaw), (y0 + y1) / 2,
                    sz - (c - 4) * 0.09 * Math.sin(yaw),
                    0.035, 0.035, L2 / 3 + 0.1, PALETTE.hanCable,
                    Math.atan2(y1 - y0, L2 / 3), yaw, 0);
            }
          }
        }
        prev = [x, z];
      }
    }
  }
  const m = new THREE.Mesh(K.build(), hanVCF());
  // AND IT DOES NOT CAST. Two thousand three-centimetre wires over every
  // street in the quarter put a black hatch across the whole road surface: a
  // shadow map cannot resolve a 3 cm wire, so what it draws is a smear, and
  // the tarmac came out looking like a cattle grid. Cables read perfectly
  // well as a silhouette against the sky, which is the only place anybody
  // ever looks at them.
  m.castShadow = false; m.receiveShadow = false;
  root.add(m);
  hanPoolDone(game, body);
}

// ============================================================== THE FLOW =====
/**
 * TWO HUNDRED AND FORTY SCOOTERS, IN ONE DRAW CALL, EACH OF WHICH CAN SEE YOU.
 *
 * The record per rider is nine floats and there is no object anywhere:
 *
 *   0 lane   1 s (metres along it)   2 dir (+1/-1)   3 off (lateral, live)
 *   4 offWant   5 v (live)   6 vWant   7 colour index   8 phase
 *
 * `off` is the whole mechanic. A rider rides at ±1.6 m of the centreline and
 * damps toward `offWant`; every frame, any rider whose next `hanSEE` metres
 * would take it within `hanSWERVE` of the capybara sets `offWant` to the far
 * side and `vWant` down. Two hundred and forty of those, damped, IS a river
 * parting — and the whole of it is arithmetic on a Float32Array.
 *
 * WHAT DECIDES WHETHER IT WORKS IS YOU. A rider commits to a line about a
 * second and a half ahead, which is what `hanSEE` at nine metres a second is;
 * so it swerves round where you ARE GOING, not round where you are. Keep going
 * and that is the same place. Stop, or turn back, and it is not, and the
 * nearest one is already there.
 */
const hanBIKE_COL = ['hanBike1', 'hanBike2', 'hanBike3', 'hanBike4', 'hanBike5', 'hanBike6'];

const hanRIDER_COL = ['hanWash1', 'hanWash2', 'hanWash3', 'hanCrowdC', 'hanShirtW', 'hanCrowdE'];
function hanBikeGeo(bodyCol, riderCol, helmCol) {
  const K = hanMerger();
  // the machine: a step-through, because that is what ninety per cent of them
  // are, with a rider on it and a box on the back
  // SIX SEGMENTS AND A SIX-BY-FOUR SPHERE. There are two hundred and forty of
  // these and the difference between a ten-segment wheel and a six-segment one
  // is invisible at any distance a scooter is ever seen from in this chapter
  // and is thirty-two thousand triangles.
  K.cyl(0, 0.30, 0.62, 0.30, 0.12, PALETTE.hanTyre, 0, 0, Math.PI / 2, 6);
  K.cyl(0, 0.30, -0.60, 0.30, 0.12, PALETTE.hanTyre, 0, 0, Math.PI / 2, 6);
  K.box(0, 0.40, 0, 0.26, 0.26, 1.30, bodyCol);
  K.box(0, 0.62, -0.34, 0.34, 0.20, 0.62, PALETTE.hanSeat);
  K.box(0, 0.60, 0.30, 0.30, 0.34, 0.34, bodyCol);
  K.box(0, 0.88, 0.46, 0.62, 0.06, 0.08, PALETTE.hanChrome);        // the bars
  K.cyl(0, 0.74, 0.52, 0.07, 0.44, PALETTE.hanChrome, 0.35, 0, 0, 4);
  K.box(0, 0.94, 0.56, 0.16, 0.12, 0.10, PALETTE.hanLampGlass);
  K.box(0, 0.78, -0.78, 0.44, 0.36, 0.34, PALETTE.hanCrate);        // the box on the back
  // ...and the rider
  K.box(0, 1.00, -0.22, 0.38, 0.66, 0.30, riderCol, -0.16, 0, 0);
  K.box(0, 1.42, -0.14, 0.20, 0.24, 0.20, PALETTE.hanSkin);
  K.sph(0, 1.60, -0.10, 0.20, 0.21, 0.21, helmCol, 6);
  K.box(0, 1.58, 0.07, 0.24, 0.10, 0.06, PALETTE.hanVisor);
  for (let s = -1; s <= 1; s += 2) {
    K.box(s * 0.21, 1.10, 0.14, 0.11, 0.11, 0.58, riderCol, -0.62, 0, 0);
    K.box(s * 0.15, 0.60, -0.10, 0.14, 0.34, 0.16, PALETTE.hanRiderLeg, 0.5, 0, 0);
    K.box(s * 0.15, 0.36, 0.18, 0.14, 0.36, 0.14, PALETTE.hanRiderLeg, 0.25, 0, 0);
  }
  return K.build();
}

function hanBuildBikes(game, root) {
  hanInitLanes();
  hanBikeData = new Float32Array(hanBIKE_N * hanBIKE_STRIDE);
  // spread over the four lanes in proportion to how long they are, so a street
  // twice the length of another has twice the traffic on it and none of them
  // is a queue
  let tot = 0;
  for (let L = 0; L < hanLANES.length; L++) tot += hanLaneTotal[L];
  let n = 0;
  for (let L = 0; L < hanLANES.length && n < hanBIKE_N; L++) {
    const want = L === hanLANES.length - 1 ? hanBIKE_N - n
               : Math.round(hanBIKE_N * hanLaneTotal[L] / tot);
    for (let i = 0; i < want && n < hanBIKE_N; i++) {
      const o = n * hanBIKE_STRIDE;
      hanBikeData[o] = L;
      hanBikeData[o + 1] = rand(0, hanLaneTotal[L]);
      hanBikeData[o + 2] = (i & 1) ? 1 : -1;
      const side = hanBikeData[o + 2] > 0 ? 1 : -1;
      hanBikeData[o + 3] = side * rand(0.8, 2.6);
      hanBikeData[o + 4] = hanBikeData[o + 3];
      hanBikeData[o + 5] = rand(hanBIKE_V[0], hanBIKE_V[1]);
      hanBikeData[o + 6] = hanBikeData[o + 5];
      hanBikeData[o + 7] = randInt(0, hanBIKE_COL.length - 1);
      hanBikeData[o + 8] = rand(0, 6.28);
      hanBikeData[o + 9] = 0;
      n++;
    }
  }
  hanBikeN = n;
  hanFollowInit();      // the per-lane rank arrays — see THE FOLLOWING TERM
  // ...and now one mesh per body colour. See the note above: instanceColor
  // would have tinted the tyres, the helmet and the rider's face as well.
  for (let c = 0; c < hanBIKE_COL.length; c++) {
    const idx = [];
    for (let i = 0; i < n; i++) if ((hanBikeData[i * hanBIKE_STRIDE + 7] | 0) === c) idx.push(i);
    hanBikeGroups.push(idx);
    const mm = new THREE.InstancedMesh(
      hanBikeGeo(PALETTE[hanBIKE_COL[c]], PALETTE[hanRIDER_COL[c]],
                 c % 2 ? PALETTE.hanHelmet : PALETTE.hanCrowdLeg),
      hanVCF(), Math.max(1, idx.length));
    mm.count = idx.length;
    mm.castShadow = true; mm.receiveShadow = false;
    mm.frustumCulled = false;
    hanBikeMeshes.push(mm);
    root.add(mm);
  }
  hanSyncBikes();
}

function hanSyncBikes() {
  if (!hanBikeMeshes.length) return;
  for (let c = 0; c < hanBikeMeshes.length; c++) {
    const idx = hanBikeGroups[c], mm = hanBikeMeshes[c];
    for (let k = 0; k < idx.length; k++) {
      const o = idx[k] * hanBIKE_STRIDE;
      const L = hanBikeData[o] | 0;
      hanLaneAtS(L, hanBikeData[o + 1], hanTmp);
      const nx = Math.cos(hanTmp.yaw), nz = -Math.sin(hanTmp.yaw);
      const dir = hanBikeData[o + 2];
      const yaw = dir > 0 ? hanTmp.yaw : hanTmp.yaw + Math.PI;
      const off = hanBikeData[o + 3];
      const lean = clamp((hanBikeData[o + 4] - off) * 0.28, -0.22, 0.22);
      hanE.set(0, yaw, lean * dir, 'YXZ');
      hanM.compose(hanV3.set(hanTmp.x + nx * off, hanGROUND + 0.04, hanTmp.z + nz * off),
                   hanQ.setFromEuler(hanE), hanSc.set(1, 1, 1));
      mm.setMatrixAt(k, hanM);
    }
    mm.instanceMatrix.needsUpdate = true;
  }
}

/** Where rider `i` is right now. Its own scratch vector — see the api note. */
// ---------------------------------------------------------------------------
// THE NEAREST SCOOTER, ONCE A FRAME AND NOT TWICE.
//
// hanUpdateRide wanted it to answer "am I standing in one", and api.bike()
// wanted it to point the beacon at one, and each of them walked all 240
// independently — every walk a lane resample plus trig per scooter. Stamped
// with hanTime, which advances once per frame in update(), so whichever asks
// first pays and the other reads the answer.
// ---------------------------------------------------------------------------
let hanNearBikeI = -1, hanNearBikeD = 1e9, hanNearBikeT = -1;
function hanNearestBike(px, pz) {
  if (hanNearBikeT === hanTime) return hanNearBikeI;
  hanNearBikeT = hanTime;
  let bi = -1, bd = 1e9;
  for (let i = 0; i < hanBikeN; i++) {
    hanBikeAt(i, hanV3b);
    const d = Math.hypot(hanV3b.x - px, hanV3b.z - pz);
    if (d < bd) { bd = d; bi = i; }
  }
  hanNearBikeI = bi; hanNearBikeD = bd;
  return bi;
}

function hanBikeAt(i, out) {
  const o = i * hanBIKE_STRIDE;
  const L = hanBikeData[o] | 0;
  hanLaneAtS(L, hanBikeData[o + 1], hanTmp2);
  const nx = Math.cos(hanTmp2.yaw), nz = -Math.sin(hanTmp2.yaw);
  out.set(hanTmp2.x + nx * hanBikeData[o + 3], hanGROUND + 0.9,
          hanTmp2.z + nz * hanBikeData[o + 3]);
  return out;
}

// ============================================================== THE ENGINES ==
// HANOI IS A CHAPTER WHOSE MEDIUM IS TRAFFIC AND IT HAD NO ENGINES IN IT.
//
// Two hundred and forty scooters, a room described in sysROOMS as "a street
// four and a half metres wide with six-storey walls both sides and a hundred
// and fifty engines in it", and the only sounds this file has ever made are a
// dog, a horn, a whistle, a stool and the pho stall. The reason was structural
// rather than an oversight: until A1 there was no way to say "this thing is
// running", only "this thing just happened", and an engine is not an event.
//
// TWO LAYERS, AND THEY ANSWER DIFFERENT QUESTIONS. Three movers follow the
// three NEAREST bikes, because those are the ones the ear can actually track
// and the ones that go past you; one bed sits on the nearest street and carries
// the other two hundred and thirty-seven, because a wall of traffic is a place
// and not a list of vehicles.
//
// THE SLOT SWAP IS THE WHOLE DIFFICULTY. Re-pointing a mover at a different
// scooter mid-pass moves it several metres in one frame, which is a click and a
// chirp. So a candidate has to be a clear six metres nearer than the bike being
// held before it may steal the slot, the question is only asked twice a second,
// and the handover is faded rather than cut.
const hanBIKE_MOVERS = 3;
const hanBIKE_REPICK = 0.5;    // s between "who is nearest" questions
const hanBIKE_SWAP   = 6;      // m nearer a candidate must be to take a slot
const hanBIKE_FADE   = 0.15;   // s of duck across the handover
const hanTRAF_R      = 40;     // m the bed counts bikes inside
const hanTRAF_FULL   = 26;     // ...and how many of them is a full street
const hanBikeMoverH = [null, null, null];
const hanBikeMoverI = [-1, -1, -1];   // the bike each slot is following
const hanBikeMoverP = [-1, -1, -1];   // ...the one it is about to follow
const hanBikeMoverA = [1, 1, 1];      // ...and the fade between them
let hanBikeRepickT = 0, hanTrafficH = null;
// Its own scratch: hanBikeAt writes hanTmp2 and hanLaneAtS is called by both,
// so borrowing either would have this reading a lane point that a bike had
// already overwritten. The shared-scratch bug this repo has paid for twice.
const hanMovTmp = { x: 0, z: 0, yaw: 0 };
const hanMovV3 = new THREE.Vector3();

function hanUpdateTraffic(game, dt, p) {
  if (!game.sfxMover || !hanBikeN) return;
  // ---- who is nearest, asked twice a second ------------------------------
  hanBikeRepickT -= dt;
  if (hanBikeRepickT <= 0 && p) {
    hanBikeRepickT = hanBIKE_REPICK;
    const ni = [-1, -1, -1], nd = [1e9, 1e9, 1e9];
    for (let i = 0; i < hanBikeN; i++) {
      hanBikeAt(i, hanMovV3);
      const d = Math.hypot(hanMovV3.x - p.x, hanMovV3.z - p.z);
      if (d < nd[0]) { nd[2] = nd[1]; ni[2] = ni[1]; nd[1] = nd[0]; ni[1] = ni[0]; nd[0] = d; ni[0] = i; }
      else if (d < nd[1]) { nd[2] = nd[1]; ni[2] = ni[1]; nd[1] = d; ni[1] = i; }
      else if (d < nd[2]) { nd[2] = d; ni[2] = i; }
    }
    for (let j = 0; j < hanBIKE_MOVERS; j++) {
      const held = hanBikeMoverI[j];
      if (held < 0 || held >= hanBikeN) { hanBikeMoverI[j] = ni[j]; continue; }
      if (ni[j] === held || ni[j] < 0) continue;
      // A bike another slot is already following is not a candidate, or two
      // movers would end up on one scooter and the third on nothing.
      if (ni[j] === hanBikeMoverI[0] || ni[j] === hanBikeMoverI[1] ||
          ni[j] === hanBikeMoverI[2]) continue;
      hanBikeAt(held, hanMovV3);
      const dHeld = Math.hypot(hanMovV3.x - p.x, hanMovV3.z - p.z);
      if (dHeld - nd[j] >= hanBIKE_SWAP) hanBikeMoverP[j] = ni[j];
    }
  }
  // ---- the three that are near you ---------------------------------------
  for (let j = 0; j < hanBIKE_MOVERS; j++) {
    if (!hanBikeMoverH[j]) {
      hanBikeMoverH[j] = game.sfxMover('twostroke', { key: 'han:bike' + j, near: 8, far: 60 });
    }
    const h = hanBikeMoverH[j];
    if (!h) continue;
    if (hanBikeMoverP[j] >= 0) {
      hanBikeMoverA[j] -= dt / hanBIKE_FADE;
      if (hanBikeMoverA[j] <= 0) {
        hanBikeMoverA[j] = 0;
        hanBikeMoverI[j] = hanBikeMoverP[j];
        hanBikeMoverP[j] = -1;
      }
    } else if (hanBikeMoverA[j] < 1) {
      hanBikeMoverA[j] = Math.min(1, hanBikeMoverA[j] + dt / hanBIKE_FADE);
    }
    const bi = hanBikeMoverI[j];
    if (bi < 0 || bi >= hanBikeN) { h.amp(0); continue; }
    const o = bi * hanBIKE_STRIDE;
    const L = hanBikeData[o] | 0, dir = hanBikeData[o + 2], v = hanBikeData[o + 5];
    hanBikeAt(bi, hanMovV3);
    h.at(hanMovV3.x, hanMovV3.y, hanMovV3.z);
    // Analytic, not a delta: the lane tangent at the bike's own arclength is
    // exactly the direction it is travelling, and a differenced position would
    // spike every time the swerve damper moved it sideways.
    hanLaneAtS(L, hanBikeData[o + 1], hanMovTmp);
    h.vel(Math.sin(hanMovTmp.yaw) * v * dir, 0, Math.cos(hanMovTmp.yaw) * v * dir);
    h.set(clamp(v / hanBIKE_V[1], 0, 1));
    h.amp(hanBikeMoverA[j]);
  }
  // ---- ...and the other two hundred and thirty-seven ---------------------
  if (!hanTrafficH) {
    hanTrafficH = game.sfxMover('traffic', { key: 'han:traffic', near: 30, far: 160 });
  }
  if (hanTrafficH && p) {
    hanLaneAt(p.x, p.z);
    if (hanLaneI >= 0) {
      hanLaneAtS(hanLaneI, hanLaneS, hanMovTmp);
      hanTrafficH.at(hanMovTmp.x, hanGROUND + 1.2, hanMovTmp.z);
      // Every third one, times three. An estimate is the right shape here: the
      // answer feeds a filter cutoff on a nine-tenths-of-a-second constant and
      // nobody can hear the difference between twenty-four bikes and twenty-six.
      let n = 0;
      for (let i = 0; i < hanBikeN; i += 3) {
        hanBikeAt(i, hanMovV3);
        if (Math.abs(hanMovV3.x - p.x) < hanTRAF_R &&
            Math.abs(hanMovV3.z - p.z) < hanTRAF_R) n += 3;
      }
      hanTrafficH.set(clamp(n / hanTRAF_FULL, 0.15, 1));
    }
  }
}

// ---- THE FOLLOWING TERM (D5.9) --------------------------------------------
//
// Four constants, and each is a measurement rather than a taste.
//
//   hanFOLLOW_D    how far ahead a rider looks. Six metres at 11 m/s is a
//                  little over half a second, which is about right for a city
//                  where nobody has ever used a brake in anger.
//   hanFOLLOW_OFF  how far across the lane two riders have to be before they
//                  are not in each other's way. 1.2 m against a lane whose
//                  offsets run 0.8 to 2.6, so a rider follows roughly the two
//                  nearest lines to its own and ignores the far side.
//   hanFOLLOW_MIN  the gap it will actually sit at, stopped. 1.5 m, which is
//                  the same standoff the capybara brake uses, so a machine
//                  jammed behind another and one jammed behind a capybara
//                  come to rest the same distance off.
//   hanFOLLOW_K    1.6 m/s per metre — the capybara brake law's own gain, on
//                  purpose. A jam that decays at a different rate from the
//                  thing that caused it reads as two mechanics.
//
// hanFOLLOW_SCAN caps the walk so a solid lane cannot make this quadratic:
// six neighbours is more than can fit inside six metres at any density this
// chapter builds, and if it ever were, the sixth is the one that matters.
const hanFOLLOW_D    = 6.0;
const hanFOLLOW_OFF  = 1.2;
const hanFOLLOW_MIN  = 1.5;
// The deceleration the braking law is built on, m/s^2. Six is brisk for a
// city scooter and not a panic stop, and it is what sets how far back the
// tail of a jam reaches: a rider needs sqrt(2*6*room) metres of warning.
const hanFOLLOW_A    = 6.0;
// ...and how fast a rider can shed speed, against the 2.2 the rest of the loop
// damps at. See the note at the apply site.
const hanFOLLOW_LAG  = 9.0;
const hanFOLLOW_SCAN = 6;
const hanFollowRank = [];       // one Int16Array per lane, sorted by arclength
const hanFollowOf   = [];       // ...and bike index -> its rank in that array
let hanFollowGap    = null;     // m to the machine ahead, or -1
let hanFollowLeadV  = null;     // ...and how fast that machine is going

/** Build the per-lane rank arrays once, after hanBikeData is filled. */
function hanFollowInit() {
  hanFollowRank.length = 0;
  hanFollowOf.length = 0;
  hanFollowGap = new Float32Array(hanBikeN);
  hanFollowLeadV = new Float32Array(hanBikeN);
  for (let L = 0; L < hanLANES.length; L++) {
    const idx = [];
    for (let i = 0; i < hanBikeN; i++) if ((hanBikeData[i * hanBIKE_STRIDE] | 0) === L) idx.push(i);
    idx.sort(function (a, b) {
      return hanBikeData[a * hanBIKE_STRIDE + 1] - hanBikeData[b * hanBIKE_STRIDE + 1];
    });
    hanFollowRank.push(Int16Array.from(idx));
    const of = new Int16Array(hanBikeN);
    for (let r = 0; r < idx.length; r++) of[idx[r]] = r;
    hanFollowOf.push(of);
  }
}

/** Insertion sort each lane by arclength. Nearly sorted already, so linear. */
function hanFollowSort() {
  if (!hanFollowGap) return;
  for (let L = 0; L < hanFollowRank.length; L++) {
    const a = hanFollowRank[L], of = hanFollowOf[L], n = a.length;
    for (let r = 1; r < n; r++) {
      const v = a[r], s = hanBikeData[v * hanBIKE_STRIDE + 1];
      let k = r - 1;
      while (k >= 0 && hanBikeData[a[k] * hanBIKE_STRIDE + 1] > s) { a[k + 1] = a[k]; k--; }
      a[k + 1] = v;
    }
    for (let r = 0; r < n; r++) of[a[r]] = r;
  }
}

/**
 * The nearest machine ahead of bike i in its own lane and direction, inside
 * hanFOLLOW_D and hanFOLLOW_OFF. Writes its speed into hanFollowLeadV and
 * returns the gap in metres, or -1.
 *
 * TWO THINGS THAT ARE EASY TO GET WRONG HERE, both written down because the
 * first cut got both of them wrong:
 *
 *  - "Ahead" depends on `dir`. For dir > 0 it is the next higher arclength,
 *    for dir < 0 the next lower — a rider coming the other way down the same
 *    lane is not in front of you, it is a near miss, and this function must
 *    not brake for it. Same `dir` is required as well as the right side.
 *  - A CLOSED lane wraps. Without the wrap the first rider on a ring gets no
 *    lead at all and a ring jam always has one hole in it, which reads as a
 *    bug rather than as traffic.
 */
function hanFollowScan(i) {
  const o = i * hanBIKE_STRIDE;
  const L = hanBikeData[o] | 0;
  const a = hanFollowRank[L];
  if (!a || a.length < 2) return -1;
  const of = hanFollowOf[L];
  const dir = hanBikeData[o + 2];
  const s = hanBikeData[o + 1], off = hanBikeData[o + 3];
  const total = hanLaneTotal[L], closed = !!hanLANES[L].closed;
  const step = dir > 0 ? 1 : -1;
  let r = of[i];
  for (let k = 0; k < hanFOLLOW_SCAN; k++) {
    r += step;
    if (r < 0 || r >= a.length) {
      if (!closed) return -1;
      r = r < 0 ? a.length - 1 : 0;
    }
    const j = a[r];
    if (j === i) return -1;
    const oj = j * hanBIKE_STRIDE;
    let d = (hanBikeData[oj + 1] - s) * step;
    if (closed && d < 0) d += total;      // it is ahead, round the ring
    if (d < 0) return -1;
    if (d > hanFOLLOW_D) return -1;
    if (hanBikeData[oj + 2] !== dir) continue;                 // oncoming
    if (Math.abs(hanBikeData[oj + 3] - off) > hanFOLLOW_OFF) continue;  // another line
    hanFollowLeadV[i] = hanBikeData[oj + 5];
    return d;
  }
  return -1;
}

function hanUpdateBikes(game, dt) {
  if (!hanBikeN || dt <= 0) return;
  const capy = game.capy;
  const p = capy && capy.position;
  const sp = capy && capy.velocity
    ? Math.hypot(capy.velocity.x, capy.velocity.z) : 0;
  // ---- THE ANIMAL'S OWN COMMITMENT --------------------------------------
  // Two numbers, and they are what the whole mechanic reads. `committed` is
  // "you are going somewhere at a walk or better"; `hanDither` is how much you
  // have changed your mind in the last second and a half, decayed, which is
  // the thing a rider a second and a half ahead of you cannot allow for.
  let committed = false;
  if (p && sp > 0.05) {
    const yaw = Math.atan2(capy.velocity.x, capy.velocity.z);
    let d = yaw - hanYawWas;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    hanYawWas = yaw;
    hanDither = clamp(hanDither + Math.abs(d) - dt * 0.9, 0, 4);
    committed = sp > hanHOLD_V && hanDither < hanTURN_MAX;
  } else {
    hanDither = clamp(hanDither - dt * 0.9, 0, 4);
  }
  // ---- AND A CAPYBARA IN THE AIR IS NOT SOMETHING ANYBODY PLANNED FOR ----
  //
  // This is the line that makes the chapter's first mini possible at all. The
  // flow PARTS for you — that is the whole mechanic, and it works — which
  // means that on the ground you can never get within three and a half metres
  // of a machine, and "get on a scooter" is unreachable. Measured: sixty-six
  // seconds standing in the middle of the busiest street in the chapter and
  // the nearest rider never came inside 2.2 m once.
  //
  // A rider commits to a line about a second and a half ahead, on the ground
  // the animal is on. It has not allowed for the animal being a metre and a
  // half above that ground, and it cannot: so while you are AIRBORNE, anything
  // inside seven metres carries straight on, and where it carries on to is a
  // footwell. Hop into the traffic. That is the verb.
  const airborne = !!(capy && !capy.grounded && p && p.y > hanGROUND + 0.55);

  // ---- AND THEY CAN SEE EACH OTHER (D5.9) ---------------------------------
  //
  // This loop was forty independent brakes. Every rider read the capybara and
  // NOTHING ELSE — no inner loop over bikes anywhere in the function — so the
  // fan of stopped machines the comment below describes could only ever be as
  // wide as the animal's own nine-metre window. A rider two metres behind a
  // stopped one carried straight through it at full cruise.
  //
  // The jam has to PROPAGATE, and that is what makes it a jam rather than a
  // clearing: you stop one rider, the one behind stops, and thirty seconds
  // later the street is solid for forty metres in both directions. It is also
  // what finally gives the horn something to be about.
  //
  // O(n), not O(n^2). `hanFollowRank` is a per-lane index sorted by arclength,
  // insertion-sorted in place each frame — the order barely changes between
  // frames at 11 m/s and 1/60 s, so the sort is linear in practice — and each
  // rider then walks at most hanFOLLOW_SCAN neighbours in its own direction of
  // travel. Measured cost is below the noise floor of the frame timer.
  // ...and it cuts, which is the house rule: game.state.noJam removes the
  // whole term so it can be measured against its own absence rather than
  // against a memory of what the street looked like last week.
  const jamOn = !(game.state && game.state.noJam);
  if (jamOn) {
    hanFollowSort();
    for (let i = 0; i < hanBikeN; i++) hanFollowGap[i] = hanFollowScan(i);
  } else if (hanFollowGap) {
    for (let i = 0; i < hanBikeN; i++) hanFollowGap[i] = -1;
  }

  let clipped = -1;
  for (let i = 0; i < hanBikeN; i++) {
    const o = i * hanBIKE_STRIDE;
    const L = hanBikeData[o] | 0;
    const dir = hanBikeData[o + 2];
    // ---- do I need to go round anything ---------------------------------
    let want = dir > 0 ? Math.abs(hanBikeData[o + 4]) : -Math.abs(hanBikeData[o + 4]);
    let vWant = hanBikeData[o + 6];
    if (p && i !== hanRider) {
      hanBikeAt(i, hanV3b);
      const dx = p.x - hanV3b.x, dz = p.z - hanV3b.z;
      const dd = Math.hypot(dx, dz);
      if (dd < hanSEE) {
        hanLaneAtS(L, hanBikeData[o + 1], hanTmp2);
        const fx = Math.sin(hanTmp2.yaw) * dir, fz = Math.cos(hanTmp2.yaw) * dir;
        const ahead = dx * fx + dz * fz;
        const side = dx * Math.cos(hanTmp2.yaw) + dz * -Math.sin(hanTmp2.yaw);
        // ---- AND IF YOU ARE IN THE AIR, THEY DRIVE STRAIGHT UNDER YOU ----
        //
        // This is the line that makes the chapter's first mini possible at
        // all. The flow PARTS for you on the ground — that is the whole
        // mechanic and it works — which means you can never get within three
        // and a half metres of a machine and "get on a scooter" is an
        // unreachable task. Measured: sixty-six seconds standing in the
        // middle of the busiest street in the chapter and the nearest rider
        // never came inside 2.2 m once.
        //
        // A rider commits to a line about a second and a half ahead, on the
        // GROUND the animal is on. It has not allowed for the animal being a
        // metre and a half above that ground, and it cannot — so it aims at
        // the gap where you were, holds its speed, and the gap where you were
        // is where you are coming down. Hop into the traffic. That is the
        // verb, and the reason it works is that nobody is looking up.
        if (airborne && dd < 7 && ahead > -0.6 && ahead < 7) {
          want = clamp(side, -4.2, 4.2);
          vWant = hanBikeData[o + 6];
          hanBikeData[o + 3] = damp(hanBikeData[o + 3], want, 7.0, dt);
          hanBikeData[o + 5] = damp(hanBikeData[o + 5], vWant, 3.0, dt);
          hanBikeData[o + 1] += hanBikeData[o + 5] * dir * dt;
          const tot0 = hanLaneTotal[L];
          if (hanLANES[L].closed) hanBikeData[o + 1] = ((hanBikeData[o + 1] % tot0) + tot0) % tot0;
          else if (hanBikeData[o + 1] > tot0 || hanBikeData[o + 1] < 0) {
            hanBikeData[o + 1] = hanBikeData[o + 1] > tot0 ? 0 : tot0;
          }
          continue;
        }
        if (ahead > -1.2 && Math.abs(side - hanBikeData[o + 3]) < hanSWERVE) {
          // go round the side there is more room on
          const away = side > hanBikeData[o + 3] ? -1 : 1;
          want = clamp(hanBikeData[o + 3] + away * hanSWERVE, -4.2, 4.2);
          // ONE PER RIDER, on the rising edge. See hanBIKE_STRIDE.
          if (ahead > 0 && ahead < 12 && hanBikeData[o + 9] < 0.5) {
            hanBikeData[o + 9] = 1; hanSwerved++;
          }
          // ---- AND IF THEY CANNOT GET ROUND, THEY STOP -------------------
          //
          // This is the half of the mechanic that took four attempts to get
          // right, and the two wrong answers are worth writing down.
          //
          // The first was that a rider who could not clear you CLIPPED you: a
          // shove and a horn. It is the obvious reading of "do not stop" and
          // it is wrong twice over — it made standing still cost twelve metres
          // of being pushed down the street, which is a punishment rather than
          // a joke, and it made the chapter's own first mini UNREACHABLE,
          // because a flow that parts for you at three and a half metres and
          // shoves you when it cannot is a flow you can never touch. Measured:
          // sixty-six seconds in the middle of the busiest street and the
          // nearest machine never came inside 2.08 m.
          //
          // The second was to let them through you. No.
          //
          // What a Hanoi street actually does to somebody who plants
          // themselves in the middle of it is JAM. Everybody brakes, nobody
          // says anything, and thirty seconds later there are forty of them
          // stopped in a fan round one capybara. That is funnier than a shove,
          // it is what really happens, and it is what makes the mini possible:
          // a stopped scooter is a thing you can hop into.
          const brake = Math.max(0, ahead - 1.5) * 1.6;
          if (ahead > -0.4 && ahead < 6 && Math.abs(side - want) < 1.9) {
            vWant = Math.min(vWant, brake);
          } else if (ahead > -0.4 && ahead < 5) {
            vWant = lerp(hanBikeData[o + 6] * 0.34, hanBikeData[o + 6], clamp(ahead / 5, 0, 1));
          }
          // ...and the clip is reserved for CHANGING YOUR MIND, which is the
          // one thing a rider a second and a half behind you cannot allow for.
          // Merely being slow is not it; turning round in the road is.
          if (hanDither > hanTURN_MAX && dd < 2.4 && ahead > -0.6 && ahead < 3.4) clipped = i;
        } else if (dd > hanSWERVE + 4) hanBikeData[o + 9] = 0;
      } else hanBikeData[o + 9] = 0;
    }
    // ---- ...and the rider in front of me (D5.9) --------------------------
    // Exactly the shape of the brake law above: close the gap to `gap - 1.5`
    // at 1.6 m/s per metre, and never ask for more than the machine ahead is
    // doing plus a little — a rider does not overtake through the back of the
    // one in front. `hanFollowGap` is -1 when nothing is in range.
    const gap = hanFollowGap ? hanFollowGap[i] : -1;
    let vLag = 2.2;
    if (gap >= 0) {
      // ---- A BRAKING-DISTANCE LAW, AND IT HAD TO BE (D5.9) ---------------
      //
      // The first cut used the capybara brake's own linear shape —
      // `(gap - 1.5) * 1.6` — on the reasoning that a jam should decay at the
      // same rate as the thing that caused it. MEASURED, with one machine
      // pinned to a stop: two riders piled up behind it at 0.0 m and 0.1 m.
      // They were inside it. A linear cap asks for zero speed only once the
      // gap is already gone, and a follower damping at 2.2/s carries 2.7 m
      // through the standoff before it can answer.
      //
      // sqrt(2 a room) is the distance a body needs to stop at deceleration
      // `a`, which is the honest law and is self-correcting: at six metres it
      // asks for 7.3 m/s and does nothing, at three it asks for 4.2, at two
      // for 2.4, and it reaches zero AT the standoff rather than past it.
      //
      // ...and the brake is quicker than the throttle. hanFOLLOW_LAG against
      // the 2.2 everything else in this loop uses: a rider who has to stop
      // stops, and a rider whose road has opened up rolls away gently, which
      // is also the difference between a jam that clears and one that snaps.
      const lead = hanFollowLeadV[i];
      const cap = Math.sqrt(2 * hanFOLLOW_A * Math.max(0, gap - hanFOLLOW_MIN)) + lead * 0.92;
      if (cap < vWant) { vWant = cap; if (cap < hanBikeData[o + 5]) vLag = hanFOLLOW_LAG; }
    }
    hanBikeData[o + 3] = damp(hanBikeData[o + 3], want, 3.4, dt);
    hanBikeData[o + 5] = damp(hanBikeData[o + 5], vWant, vLag, dt);
    // ---- and along the street --------------------------------------------
    hanBikeData[o + 1] += hanBikeData[o + 5] * dir * dt;
    const total = hanLaneTotal[L];
    if (hanLANES[L].closed) {
      hanBikeData[o + 1] = ((hanBikeData[o + 1] % total) + total) % total;
    } else if (hanBikeData[o + 1] > total || hanBikeData[o + 1] < 0) {
      // off the end of an open street: come back on at the other end, which is
      // the whole of this chapter's traffic management
      hanBikeData[o + 1] = hanBikeData[o + 1] > total ? 0 : total;
    }
  }
  hanSyncBikes();
  hanUpdateTraffic(game, dt, p);

  // ---- the clip ---------------------------------------------------------
  if (clipped >= 0 && hanBumpT <= 0 && p && capy && hanRider < 0) {
    hanBumpT = 1.6;
    hanBikeAt(clipped, hanV3b);
    const dx = p.x - hanV3b.x, dz = p.z - hanV3b.z;
    const d = Math.hypot(dx, dz) || 1;
    if (typeof capy.shove === 'function') capy.shove(dx / d * 3.4, dz / d * 3.4);
    if (typeof game.punch === 'function') game.punch(0.20);
    hanCue('bark', hanV3b.x, hanV3b.y, hanV3b.z, 0.5, 2.6);
    hanSwerved = 0;
    hanCrossLane = -1;
    if (!hanToldFlow) {
      hanToldFlow = true;
      hanToast('do not stop. nobody here has ever stopped.');
    }
  }
  if (hanBumpT > 0) hanBumpT -= dt;

  // ---- the horns, which are punctuation and not a warning ---------------
  hanHornT -= dt;
  if (hanHornT <= 0 && p) {
    hanHornT = rand(0.5, 2.1);
    let bi = -1, bd = 1e9;
    for (let i = 0; i < hanBikeN; i += 7) {
      hanBikeAt(i, hanV3b);
      const d = Math.hypot(hanV3b.x - p.x, hanV3b.z - p.z);
      if (d < bd) { bd = d; bi = i; }
    }
    if (bi >= 0 && bd < 60) {
      hanBikeAt(bi, hanV3b);
      hanCue('bark', hanV3b.x, hanV3b.y, hanV3b.z, clamp(0.26 - bd * 0.003, 0.05, 0.26),
             rand(2.1, 3.2), 90);
    }
  }
}

/**
 * THE CROSSING, and it is the one task in this game that is failed by
 * HESITATING rather than by getting anything wrong.
 *
 * It starts when you step off a kerb into a lane and it ends when you reach the
 * far kerb. It is thrown away by stopping, by turning round, or by being
 * clipped — all three of which are the same thing said three ways. What is
 * recorded is not the time: it is HOW MANY OF THEM HAD TO GO ROUND YOU, which
 * is the funnier number and the one that actually measures the crossing.
 */
function hanUpdateCrossing(game, dt) {
  const capy = game.capy;
  if (!capy || !capy.position) return;
  const p = capy.position;
  const d = hanLaneAt(p.x, p.z);
  const w = hanLaneW;
  const inLane = d < w + 0.6 && capy.grounded && !capy.carriedBy && hanRider < 0;
  // which side of the centreline are we on
  const nx = Math.cos(hanLaneYaw), nz = -Math.sin(hanLaneYaw);
  hanLaneAtS(hanLaneI, hanLaneS, hanTmp2);
  const side = (p.x - hanTmp2.x) * nx + (p.z - hanTmp2.z) * nz > 0 ? 1 : -1;
  const sp = Math.hypot(capy.velocity.x, capy.velocity.z);

  if (hanCrossLane < 0) {
    if (inLane && sp > hanHOLD_V) {
      hanCrossLane = hanLaneI; hanCrossFrom = side; hanSwerved = 0; hanCrossOk = true;
      // ...AND THE DITHER STARTS AT ZERO. It is an accumulator over the last
      // second and a half of heading changes, and TURNING TO FACE THE ROAD is
      // a heading change: measured, every crossing began with hanDither at
      // about 2.0 — over the limit — so hanCrossOk was set false on the frame
      // after the run started and not one crossing in the chapter could ever
      // have been completed. The question is whether you change your mind
      // DURING the crossing.
      hanDither = 0;
      if (hanBikeData) for (let i = 0; i < hanBikeN; i++) hanBikeData[i * hanBIKE_STRIDE + 9] = 0;
    }
    return;
  }
  if (hanLaneI !== hanCrossLane) { hanCrossLane = -1; return; }
  if (sp < hanHOLD_V * 0.6 || hanDither > hanTURN_MAX) hanCrossOk = false;
  // ---- HOW MANY HAVE GONE ROUND YOU, WHILE THEY ARE DOING IT (v36) -------
  // The best question in the game — not how fast you crossed, HOW MANY OF THEM
  // HAD TO GO ROUND YOU — and it was answered on the far kerb, after the only
  // moment it could have changed what you did. The whole instruction of this
  // chapter is "do not stop, do not flinch"; a figure climbing on the card
  // while a hundred and forty scooters part in front of you is that
  // instruction, said in the only language the crossing has.
  //
  // Only while the crossing is still GOOD: a run you have already dithered out
  // of is not going to file anything, and a live line on it would be a lie.
  if (hanCrossOk && game.recordLive) game.recordLive('cross-the-road', Math.round(hanSwerved));
  // THE FAR KERB, and it is w + 1.8 rather than w + 3.0. Measured: a clean
  // crossing of the widest street in the chapter ends about seven and a half
  // metres from the centreline, because that is where the pavement is, and at
  // a three-metre margin the run never terminated at all.
  if (d > w + 1.8) {
    // out the other side
    if (hanCrossOk && side !== hanCrossFrom) {
      const n = Math.round(hanSwerved);
      if (n > hanSwervedBest) { hanSwervedBest = n; hanRecord('cross-the-road', n); }
      if (!hanCrossDone) {
        hanCrossDone = true;
        hanTask('cross-the-road');
        if (typeof game.punch === 'function') game.punch(0.22);
        hanToast('not one of them stopped. that is how it is done.');
      }
    }
    hanCrossLane = -1;
  }
}

/**
 * GETTING ON ONE — the chapter's first mini, and the fourteenth thing in this
 * game that carries the animal.
 *
 * A scooter is not a kinematic BODY here and deliberately so: there are two
 * hundred and forty of them and giving every one a cannon box would put two
 * hundred and forty shapes in the broadphase for a mechanic that involves
 * exactly one of them at a time. Instead ONE body follows whichever rider the
 * animal is closest to when it lands, which is the same trick the manta in
 * Palawan uses and is invisible from outside.
 */
let hanRideBody = null;
/** The Cub at the stall, the three bowls on its rack, and the three lanterns (X5). */
function hanBuildCub(game, root) {
  const g = new THREE.Group();
  const K = hanMerger();
  const body = PALETTE.hanLantern, chrome = PALETTE.hanChrome;
  K.cyl(0, 0.30, 0.62, 0.30, 0.12, PALETTE.hanTyre, 0, 0, Math.PI / 2, 8);
  K.cyl(0, 0.30, -0.60, 0.30, 0.12, PALETTE.hanTyre, 0, 0, Math.PI / 2, 8);
  K.box(0, 0.40, 0, 0.26, 0.26, 1.30, body);
  K.box(0, 0.62, -0.34, 0.34, 0.20, 0.62, PALETTE.hanSeat);
  K.box(0, 0.60, 0.30, 0.30, 0.34, 0.34, body);
  K.box(0, 0.88, 0.46, 0.62, 0.06, 0.08, chrome);
  K.cyl(0, 0.74, 0.52, 0.07, 0.44, chrome, 0.35, 0, 0, 4);
  K.box(0, 0.94, 0.56, 0.16, 0.12, 0.10, PALETTE.hanLampGlass);
  K.box(0, 0.74, -0.80, 0.50, 0.06, 0.40, chrome);                    // the rack
  const m = new THREE.Mesh(K.build(), hanVC());
  m.castShadow = true; m.receiveShadow = true;
  g.add(m);
  // three bowls on the rack, stacked; one comes off per delivery
  hanCubBowls = [];
  for (let i = 0; i < 3; i++) {
    const B = hanMerger();
    B.cyl(0, 0.84 + i * 0.16, -0.80, 0.20, 0.14, 0xf2ead8, 0, 0, 0, 8);
    B.cyl(0, 0.91 + i * 0.16, -0.80, 0.16, 0.03, 0xd9a25a, 0, 0, 0, 8);
    const bm = new THREE.Mesh(B.build(), hanVC());
    bm.castShadow = true;
    g.add(bm);
    hanCubBowls.push(bm);
  }
  g.position.set(hanCubX, hanGROUND, hanCubZ);
  g.rotation.y = hanCubYaw;
  root.add(g);
  hanCubG = g;
  // the lanterns: a pole, a red lantern, a ring on the road
  hanDropMeshes = []; hanDropMats = [];
  for (let i = 0; i < hanDROPS.length; i++) {
    const d = hanDROPS[i];
    const P = hanMerger();
    P.cyl(d[0], hanGROUND + 2.2, d[1], 0.08, 4.4, 0x4a4038, 0, 0, 0, 6);
    const pm = new THREE.Mesh(P.build(), hanVC());
    root.add(pm);
    const mat = new THREE.MeshLambertMaterial({ color: PALETTE.hanLantern, emissive: PALETTE.hanLantern, emissiveIntensity: 0.3 });
    const lan = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), mat);
    lan.position.set(d[0], hanGROUND + 4.6, d[1]);
    root.add(lan);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.14, 4, 20), mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(d[0], hanGROUND + 0.05, d[1]);
    root.add(ring);
    hanDropMeshes.push(lan); hanDropMats.push(mat);
  }
}
function hanCubTake(game) {
  const capy = game.capy;
  hanCubOn = true; hanCubCool = 0.4;
  if (capy) { capy.atHelm = true; capy.rideBody = null; }
  hanCubV = 0;
  if (!hanCubDone) { hanCubNext = 0; hanCubT = 0; if (hanCubBowls) for (let i = 0; i < 3; i++) hanCubBowls[i].visible = true; }
  hanSfx('chime', { volume: 0.6, pitch: 1.0 });
  if (typeof game.control === 'function') game.control('W throttle · S brake · A/D steer · the lit lantern is the drop: stop inside its ring · E to get off');
  else hanToast('W throttle · S brake · A/D steer');
}
function hanCubLeave(game) {
  const capy = game.capy;
  hanCubOn = false; hanCubCool = 0.4;
  if (capy) capy.atHelm = false;
  if (capy && capy.body) {
    const ox = hanCubX + 1.3 * Math.cos(hanCubYaw), oz = hanCubZ - 1.3 * Math.sin(hanCubYaw);
    capy.body.position.set(ox, hanGROUND + 0.9, oz);
    capy.body.velocity.set(0, 0, 0);
    capy.body.previousPosition.copy(capy.body.position);
    capy.body.interpolatedPosition.copy(capy.body.position);
    if (capy.position) capy.position.set(ox, hanGROUND + 0.9, oz);
  }
}
function hanUpdateCub(game, dt) {
  if (!hanCubG || dt <= 0) return;
  const input = game.input, capy = game.capy;
  if (hanCubCool > 0) hanCubCool -= dt;
  // ---- on and off ---------------------------------------------------------
  if (capy && capy.body && input && input.actionPressed && hanCubCool <= 0) {
    if (hanCubOn) {
      if (Math.abs(hanCubV) > 3) { if (typeof game.control === 'function') game.control('S to stop first'); }
      else hanCubLeave(game);
    } else if (!capy.carriedBy && !capy.atHelm && !capy.climbing && hanRider < 0) {
      const dx = capy.body.position.x - hanCubX, dz = capy.body.position.z - hanCubZ;
      const dy = capy.body.position.y - hanGROUND;
      if (dx * dx + dz * dz < hanCUB_DOOR_R * hanCUB_DOOR_R && dy > -1 && dy < 3) hanCubTake(game);
    }
  }
  // the lanterns: the next one bright and breathing
  hanDropT += dt;
  if (hanDropMats) {
    for (let i = 0; i < hanDropMats.length; i++) {
      const next = hanCubOn && !hanCubDone && i === hanCubNext;
      const done = hanCubDone || i < hanCubNext;
      const want = next ? 1.6 + Math.sin(hanDropT * 5) * 0.8 : done ? 0.9 : 0.3;
      hanDropMats[i].emissiveIntensity = damp(hanDropMats[i].emissiveIntensity, want, 6, dt);
    }
  }
  if (!hanCubMover && game.sfxMover) hanCubMover = game.sfxMover('twostroke', { key: 'han:cub', near: 6, far: 70 });
  if (hanCubMover) {
    hanCubMover.at(hanCubX, hanGROUND + 0.6, hanCubZ);
    hanCubMover.vel(Math.sin(hanCubYaw) * hanCubV, 0, Math.cos(hanCubYaw) * hanCubV);
    hanCubMover.set(hanCubOn ? 0.25 + 0.75 * clamp(Math.abs(hanCubV) / hanCUB_VMAX, 0, 1) : 0);
  }
  if (!hanCubOn) {
    if (hanCubV !== 0) { hanCubV = 0; }
    hanCubG.position.set(hanCubX, hanGROUND, hanCubZ);
    hanCubG.rotation.set(0, hanCubYaw, 0);
    return;
  }
  hanCubT += dt;
  // ---- the throttle, the bars ---------------------------------------------
  const gas = input ? clamp(-input.z, 0, 1) : 0;
  const brake = input ? clamp(input.z, 0, 1) : 0;
  if (gas > 0) hanCubV = Math.min(hanCUB_VMAX, hanCubV + hanCUB_ACC * gas * dt);
  else if (brake > 0) hanCubV = hanCubV > 0.2 ? Math.max(0, hanCubV - hanCUB_BRAKE * brake * dt) : Math.max(-hanCUB_REV, hanCubV - 2.0 * dt);
  else hanCubV = hanCubV > 0 ? Math.max(0, hanCubV - hanCUB_DRAG * dt) : Math.min(0, hanCubV + hanCUB_DRAG * dt);
  const steer = input ? clamp(input.x, -1, 1) : 0;
  // a Cub turns at walking pace: a third of the lock from standing, the rest
  // bought with way — so a rider who has stopped facing a wall can get out
  const auth = clamp(0.35 + Math.abs(hanCubV) / 3.5, 0, 1);
  hanCubYaw -= steer * hanCUB_TURN * auth * (hanCubV < -0.2 ? -1 : 1) * dt;
  // ---- the traffic: a rider ahead in your line holds you ------------------
  hanCubHold = -1;
  if (hanBikeN && hanCubV > 1) {
    const fx = Math.sin(hanCubYaw), fz = Math.cos(hanCubYaw);
    let bestD = 1e9;
    for (let i = 0; i < hanBikeN; i++) {
      hanBikeAt(i, hanV3b);
      const dx = hanV3b.x - hanCubX, dz = hanV3b.z - hanCubZ;
      const along = dx * fx + dz * fz, across = Math.abs(dx * fz - dz * fx);
      if (along > 0.4 && along < 3.2 && across < hanCUB_HOLD && along < bestD) { bestD = along; hanCubHold = i; }
    }
    if (hanCubHold >= 0) {
      const bv = hanBikeData[hanCubHold * hanBIKE_STRIDE + 5];
      if (hanCubV > bv * 0.9) hanCubV = Math.max(0, bv * 0.9);
      hanCubHornT -= dt;
      if (hanCubHornT <= 0) { hanCubHornT = 1.6; hanSfx('horn', { volume: 0.16, pitch: 1.6, force: true }); }
    }
  }
  // ---- along, and the kerb ------------------------------------------------
  const nx = hanCubX + Math.sin(hanCubYaw) * hanCubV * dt;
  const nz = hanCubZ + Math.cos(hanCubYaw) * hanCubV * dt;
  const d = hanLaneAt(nx, nz);
  const w = hanLaneW;
  if (d > w + hanCUB_KERB) {
    // THE KERB IS A WALL: slide back onto the road, and it costs the way
    hanLaneAtS(hanLaneI, hanLaneS, hanTmp);
    const vx = hanTmp.x - nx, vz = hanTmp.z - nz, vl = Math.hypot(vx, vz) || 1;
    const push = d - (w + hanCUB_KERB);
    hanCubX = nx + vx / vl * push; hanCubZ = nz + vz / vl * push;
    hanCubV *= Math.max(0, 1 - 4.0 * dt);
    hanCubKerbT -= dt;
    if (hanCubKerbT <= 0 && Math.abs(hanCubV) > 2) {
      hanCubKerbT = 0.5;
      hanSfx('thud', { volume: 0.22, pitch: 1.2, force: true });
      if (typeof game.shake === 'function') game.shake(0.04);
    }
  } else { hanCubX = nx; hanCubZ = nz; }
  // ---- the drops ----------------------------------------------------------
  if (!hanCubDone && hanCubNext < hanDROPS.length) {
    const dr = hanDROPS[hanCubNext];
    const dd = Math.hypot(hanCubX - dr[0], hanCubZ - dr[1]);
    if (dd < hanCUB_DROP_R && Math.abs(hanCubV) < hanCUB_DROP_V) {
      if (hanCubBowls && hanCubBowls[2 - hanCubNext]) hanCubBowls[2 - hanCubNext].visible = false;
      hanCubNext++;
      hanSfx('chime', { volume: 0.5, pitch: 1.0 + hanCubNext * 0.12, force: true });
      hanCue('cheer', dr[0], hanGROUND + 1.4, dr[1], 0.35, 1.1, 60);
      if (typeof game.confetti === 'function') game.confetti(hanCubX, hanGROUND + 1.4, hanCubZ, 10);
      if (typeof game.punch === 'function') game.punch(0.06);
      if (hanCubNext >= hanDROPS.length) {
        hanCubDone = true;
        hanTask('pho-run');
        hanRecord('pho-run', +hanCubT.toFixed(1));
        hanToast('three bowls, ' + (hanCubT < hanCUB_COLD ? 'still hot. ' : 'gone cold, but delivered. ') + hanCubT.toFixed(0) + ' seconds round the quarter.');
        if (game.music && typeof game.music.swell === 'function') game.music.swell(1.0);
        if (typeof game.punch === 'function') game.punch(0.14);
        if (typeof game.frameShot === 'function') game.frameShot({ yaw: hanCubYaw + Math.PI + 0.5, dist: 12, pitch: 0.22, raise: 1.0, hold: 2.4, over: true });
      } else {
        hanToast(dr[2] + ' — one down. next: ' + hanDROPS[hanCubNext][2]);
      }
    }
  }
  // ---- the pose, the passenger, the line ----------------------------------
  hanCubLean = damp(hanCubLean, -steer * auth * 0.22, 6, dt);
  hanCubG.position.set(hanCubX, hanGROUND, hanCubZ);
  hanCubG.rotation.set(0, hanCubYaw, hanCubLean);
  if (capy && capy.body) {
    const cb = capy.body;
    cb.position.set(hanCubX - Math.sin(hanCubYaw) * 0.3, hanGROUND + 1.42, hanCubZ - Math.cos(hanCubYaw) * 0.3);
    cb.velocity.set(Math.sin(hanCubYaw) * hanCubV, 0, Math.cos(hanCubYaw) * hanCubV);
    cb.angularVelocity.set(0, 0, 0);
    cb.previousPosition.copy(cb.position);
    cb.interpolatedPosition.copy(cb.position);
    if (capy.position) capy.position.set(cb.position.x, cb.position.y, cb.position.z);
    if (capy.group) {
      capy.group.position.set(cb.position.x, cb.position.y, cb.position.z);
      capy.group.rotation.y = hanCubYaw;
    }
  }
  hanFrame.x = 0; hanFrame.z = 0;
  if (typeof game.wowLive === 'function' && !hanCubDone) {
    const dr = hanDROPS[hanCubNext];
    const dd = Math.round(Math.hypot(hanCubX - dr[0], hanCubZ - dr[1]));
    const heat = clamp(1 - hanCubT / hanCUB_COLD, 0, 1);
    game.wowLive((hanCubHold >= 0 ? 'behind one — go round · ' : '') + dr[2] + ' · ' + dd + ' m · ' +
                 Math.round(Math.abs(hanCubV) * 3.6) + ' km/h · pho ' + (heat > 0.66 ? 'hot' : heat > 0.33 ? 'warm' : 'cooling'),
                 hanCubNext / hanDROPS.length);
  }
}
function hanBuildRideBody(game) {
  const b = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC,
                              material: (game.mats && game.mats.prop) || undefined });
  b.allowSleep = false;
  // the footwell: a floor and a wall at each end, so it is a TRAY. Chapter 18
  // measured what a flat deck does to a passenger at speed and it is not this.
  // A LITTLE BIGGER THAN THE THING IT IS DRAWN AS, and on purpose. The
  // footwell of a Honda Wave is genuinely about sixty centimetres square and a
  // capybara is 1.1 m long; a tray built to the drawing held a passenger for
  // twenty-seven frames. This one is 0.86 by 1.6 inside, which from the
  // outside is invisible — the mesh has not changed — and from the inside is
  // the difference between a mini and a bug.
  b.addShape(new CANNON.Box(new CANNON.Vec3(0.43, 0.09, 0.80)), new CANNON.Vec3(0, 0.50, 0.02));
  b.addShape(new CANNON.Box(new CANNON.Vec3(0.43, 0.34, 0.10)), new CANNON.Vec3(0, 0.88, 0.78));
  b.addShape(new CANNON.Box(new CANNON.Vec3(0.43, 0.34, 0.10)), new CANNON.Vec3(0, 0.88, -0.80));
  b.addShape(new CANNON.Box(new CANNON.Vec3(0.10, 0.34, 0.80)), new CANNON.Vec3(-0.45, 0.88, 0.02));
  b.addShape(new CANNON.Box(new CANNON.Vec3(0.10, 0.34, 0.80)), new CANNON.Vec3(0.45, 0.88, 0.02));
  b.position.set(0, -900, 0);
  hanSyncBody(b);
  game.world.addBody(b);
  hanRideBody = b;
}

let hanRideTX = 0, hanRideTZ = 0, hanRideYaw = 0, hanRideHave = false;
let hanRidePark = -1;             // which machine the tray is parked under
function hanUpdateRide(game, dt) {
  if (!hanRideBody || !hanBikeN || dt <= 0) return;
  const capy = game.capy;
  const p = capy && capy.position;
  if (!p) return;
  // ---- NOT WHILE YOU ARE ON THE LAKE ------------------------------------
  // Two hundred and forty scooters, each one a lane resample and a pair of
  // trig calls, walked every frame to find the nearest — and then asked
  // whether it is within 1.6 m. Off the lanes entirely there is no answer
  // worth having, and half this map is lake, bridge and temple.
  if (hanRider < 0 && hanLaneAt(p.x, p.z) > hanLaneW + 6) return;
  // which rider is nearest, and is the animal on it
  const bi = hanNearestBike(p.x, p.z);
  const bd = hanNearBikeD;
  if (bi < 0) return;
  // ---- AM I *IN* ONE, AND THE HEIGHT IS THE WHOLE TEST ------------------
  //
  // The footwell floor is at 0.59 over the road, so an animal standing in it
  // has its centre at about 2.05 and an animal standing on the ROAD beside it
  // has its centre at 1.70. The first version of this took anything above
  // hanGROUND + 0.30, which is 1.50 — so simply walking past a scooter counted
  // as riding it.
  const on = (bd < 1.6 && p.y > hanGROUND + 0.85 && p.y < hanGROUND + 2.6) ? bi : -1;
  // ...and whether there is anything to land ON. See below.
  const overIt = bd < 3.2 && p.y > hanGROUND + 0.75;
  if (on < 0 && hanRider >= 0) {
    hanRideGrace += dt;
    if (hanRideGrace > 0.55) {
      if (hanRideDist > 12) {
        if (hanRideDist > hanRideBest) { hanRideBest = hanRideDist; hanRecord('ride-the-flow', hanRideDist); }
      }
      hanRider = -1; hanRideT = 0; hanRideDist = 0; hanRidePark = -1;
      hanRideBody.position.set(0, -900, 0);
      hanRideBody.velocity.setZero();
      hanSyncBody(hanRideBody);
      hanRideHave = false;
      hanFrame.x = 0; hanFrame.z = 0;
    }
    return;
  }
  hanRideGrace = 0;
  if (on >= 0 && hanRider < 0) {
    hanRider = on;
    hanRideT = 0; hanRideDist = 0;
    hanToast('hold on to something.');
    hanCue('thud', p.x, p.y, p.z, 0.30, 1.5);
  }
  if (hanRider < 0) {
    // ---- THE TRAY ONLY EXISTS WHEN THERE IS SOMETHING TO LAND ON --------
    //
    // It has to exist BEFORE you land on it — a mechanic you can only start by
    // landing on a thing that is not there until you land is not a mechanic —
    // but it may not exist the rest of the time, and the first version of this
    // parked it under the nearest scooter permanently. That is a kinematic
    // box with four walls doing nine metres a second welded to whichever bike
    // happens to be closest, and it spends the whole chapter ramming the
    // player down the street. Measured: a crossing that should have taken four
    // seconds ended thirty-nine metres from the target, sideways.
    //
    // So it is armed only while the animal is genuinely ABOVE a machine —
    // which, given a hop peaks at 1.37 m of rise, means exactly the moment it
    // is being aimed at.
    if (overIt) {
      // ...AND IF IT IS A DIFFERENT MACHINE FROM LAST FRAME, IT TELEPORTS.
      // hanPlaceRideBody drives the tray by VELOCITY against its previous
      // target, which is right for following one scooter and catastrophic for
      // hopping between two: the delta is then eight metres in a sixtieth of a
      // second, the body reports ninety-nine metres a second — over main.js's
      // own sanity cap — and it would fire a capybara across the district.
      // Measured in a ninety-second random-input soak.
      if (hanRidePark !== bi) { hanRideHave = false; hanRidePark = bi; }
      hanBikeAt(bi, hanV3b);
      hanLaneAtS(hanBikeData[bi * hanBIKE_STRIDE] | 0,
                 hanBikeData[bi * hanBIKE_STRIDE + 1], hanTmp2);
      const dir = hanBikeData[bi * hanBIKE_STRIDE + 2];
      const yaw = dir > 0 ? hanTmp2.yaw : hanTmp2.yaw + Math.PI;
      hanPlaceRideBody(hanV3b.x, hanV3b.z, yaw, dt);
    } else if (hanRideHave) {
      hanRidePark = -1;
      hanRideBody.position.set(0, -900, 0);
      hanRideBody.velocity.setZero();
      hanRideBody.angularVelocity.setZero();
      hanSyncBody(hanRideBody);
      hanRideHave = false;
    }
    return;
  }
  hanRideT += dt;
  const o = hanRider * hanBIKE_STRIDE;
  hanRideDist += hanBikeData[o + 5] * dt;
  // the metres through the quarter, on the paper, while you are on the bike
  // (v32). Twelve is the record's own floor two branches up — a scooter you
  // were on for half a second is not a ride.
  if (game.recordLive && hanRideDist > 12) game.recordLive('ride-the-flow', hanRideDist);
  hanBikeAt(hanRider, hanV3b);
  hanLaneAtS(hanBikeData[o] | 0, hanBikeData[o + 1], hanTmp2);
  const dir = hanBikeData[o + 2];
  const yaw = dir > 0 ? hanTmp2.yaw : hanTmp2.yaw + Math.PI;
  hanPlaceRideBody(hanV3b.x, hanV3b.z, yaw, dt);
  hanFrame.x = hanRideBody.velocity.x;
  hanFrame.z = hanRideBody.velocity.z;
  if (hanRideT > 6 && !hanRideDone) {
    hanRideDone = true;
    hanTask('ride-the-flow');
    if (typeof game.punch === 'function') game.punch(0.26);
  }
}
/** Rule 2 and rule 3 for a carrier: velocity, against the PREVIOUS TARGET. */
function hanPlaceRideBody(tx, tz, yaw, dt) {
  const b = hanRideBody;
  if (!hanRideHave) {
    b.position.set(tx, hanGROUND, tz);
    b.quaternion.setFromEuler(0, yaw, 0);
    b.velocity.setZero(); b.angularVelocity.setZero();
    hanSyncBody(b);
    hanRideTX = tx; hanRideTZ = tz; hanRideYaw = yaw; hanRideHave = true;
    return;
  }
  b.velocity.set((tx - hanRideTX) / dt, 0, (tz - hanRideTZ) / dt);
  let dy = yaw - hanRideYaw;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  b.angularVelocity.set(0, dy / dt, 0);
  hanRideTX = tx; hanRideTZ = tz; hanRideYaw = yaw;
}

// =========================================================== TRAIN STREET ====
/**
 * AN ALLEY FOUR AND A HALF METRES WIDE WITH A RAILWAY DOWN THE MIDDLE OF IT.
 *
 * The houses stand 2.35 m from the centre of the track and the train is 1.45 m
 * to each side of it, so there is forty-five centimetres of daylight and a
 * hundred people live in it. Everything about how this is built comes off that
 * one number.
 *
 * THE FOLD is the half that makes it a set piece rather than a hazard. Every
 * awning, stool, table, crate and drying rack in the alley is registered in
 * `hanFolders` with an OPEN transform and a FOLDED one, and `hanFoldK` — driven
 * by the clock, not by the player — lerps every one of them between the two
 * over about four seconds. So the street does not get out of the way at the
 * last second: it starts getting out of the way when the horn goes, eleven
 * seconds out, and by the time you can hear the train there is nothing left in
 * the alley but you.
 */
function hanFolder(mesh, ox, oy, oz, fx, fy, fz, fr) {
  // `or` is the OPEN yaw, read off the mesh as it is registered (every caller
  // has already placed it). Without it there was nothing to fold back TO, and
  // the rotation could only ever travel one way — see hanUpdateTrain.
  hanFolders.push({ m: mesh, ox: ox, oy: oy, oz: oz, fx: fx, fy: fy, fz: fz,
                    or: mesh.rotation.y, fr: fr || 0 });
}

function hanBuildTrainStreet(game, root) {
  const K = hanMerger();
  const body = hanPoolBody(game);
  const z = hanTRAIN.z, half = hanTRAIN.half;
  const x0 = hanTRAIN.x0, x1 = hanTRAIN.x1;

  // ---- the ballast and the track ---------------------------------------
  K.box((x0 + x1) / 2, hanGROUND - 0.02, z, x1 - x0, 0.24, 4.0, PALETTE.hanBallast);
  for (let x = x0; x < x1; x += 0.62) {
    K.box(x, hanGROUND + 0.10, z, 0.28, 0.16, 2.4, PALETTE.hanSleeper);
  }
  for (let s = -1; s <= 1; s += 2) {
    K.box((x0 + x1) / 2, hanGROUND + 0.22, z + s * hanTRAIN.gauge * 0.5,
          x1 - x0, 0.14, 0.12, PALETTE.hanRail2);
  }

  // ---- the houses, both sides, right up against it ----------------------
  for (let side = -1; side <= 1; side += 2) {
    for (let x = x0 + 2; x < x1 - 2; x += hanHOUSE_W + 0.1) {
      const d = rand(8, 12);
      const h = rand(6.5, 13);
      const bz = z + side * (half + d * 0.5);
      const yaw = side > 0 ? 0 : Math.PI;
      hanHouse(K, x, bz, yaw, h, randInt(0, 4), d);
      hanPoolBox(body, x, hanGROUND + h * 0.5 + 1, bz, hanHOUSE_W, h + 2, d, yaw);
      // ---- and everything the street keeps in front of its own door -----
      // A stool, a table, a rack or a crate, at 2.05 m from the centreline —
      // which is INSIDE the train's envelope by sixty centimetres, which is
      // why it all has to move.
      const kind = randInt(0, 3);
      const S = hanMerger();
      const px = x + rand(-1.0, 1.0);
      const oz = z + side * rand(1.75, 2.15);
      if (kind === 0) {          // a low plastic table and two stools
        S.box(0, 0.24, 0, 0.62, 0.06, 0.62, PALETTE.hanStoolA);
        for (let l = 0; l < 4; l++) {
          S.box((l & 1 ? 0.26 : -0.26), 0.11, (l & 2 ? 0.26 : -0.26), 0.05, 0.22, 0.05, PALETTE.hanStoolA);
        }
        S.box(0.5, 0.16, 0.2, 0.30, 0.05, 0.30, PALETTE.hanStoolB);
        S.box(-0.5, 0.16, -0.2, 0.30, 0.05, 0.30, PALETTE.hanStoolB);
      } else if (kind === 1) {   // a drying rack
        S.cyl(-0.5, 0.5, 0, 0.04, 1.0, PALETTE.hanPole, 0, 0, 0, 4);
        S.cyl(0.5, 0.5, 0, 0.04, 1.0, PALETTE.hanPole, 0, 0, 0, 4);
        S.box(0, 0.98, 0, 1.1, 0.04, 0.04, PALETTE.hanPole);
        S.box(-0.28, 0.66, 0, 0.34, 0.62, 0.03, PALETTE.hanWash1);
        S.box(0.20, 0.70, 0, 0.34, 0.54, 0.03, PALETTE.hanWash3);
      } else if (kind === 2) {   // crates of something
        S.box(0, 0.18, 0, 0.52, 0.36, 0.42, PALETTE.hanCrate);
        S.box(0.1, 0.52, 0.05, 0.46, 0.32, 0.38, PALETTE.hanCrate2);
      } else {                   // a motorbike, parked, obviously
        S.cyl(0, 0.26, 0.5, 0.26, 0.10, PALETTE.hanTyre, 0, 0, Math.PI / 2, 8);
        S.cyl(0, 0.26, -0.5, 0.26, 0.10, PALETTE.hanTyre, 0, 0, Math.PI / 2, 8);
        S.box(0, 0.38, 0, 0.24, 0.24, 1.10, PALETTE[hanBIKE_COL[randInt(0, 5)]]);
        S.box(0, 0.58, -0.28, 0.30, 0.18, 0.54, PALETTE.hanSeat);
        S.box(0, 0.82, 0.38, 0.54, 0.05, 0.07, PALETTE.hanChrome);
      }
      const sm = new THREE.Mesh(S.build(), hanVCF());
      sm.castShadow = true;
      sm.position.set(px, hanGROUND, oz);
      sm.rotation.y = rand(-0.4, 0.4);
      root.add(sm);
      // folded: back against the wall and turned side-on
      hanFolder(sm, px, hanGROUND, oz,
                px, hanGROUND, z + side * (half + 1.15), sm.rotation.y + side * 0.9);
      // ...and the awning over the door, which goes UP rather than back
      const A = hanMerger();
      A.box(0, 0, 0, hanHOUSE_W + 0.1, 0.08, 1.9, side > 0 ? PALETTE.hanTarp : PALETTE.hanTarpRed);
      const am = new THREE.Mesh(A.build(), hanVCF());
      am.castShadow = true;
      am.position.set(x, hanGROUND + 2.9, z + side * (half + 0.55));
      am.rotation.x = side * 0.16;
      root.add(am);
      hanFolder(am, x, hanGROUND + 2.9, z + side * (half + 0.55),
                x, hanGROUND + 3.5, z + side * (half + 1.5), 0);
    }
  }

  // ---- THE WAY UP (D4.9) -------------------------------------------------
  // The train's collider is a chain of boxes 1.7 m half-height centred at 1.7,
  // so its ROOF is a solid surface at 3.4 m -- and it is kinematic with an
  // honest velocity, which means the carrier contract already applies to it.
  // Everything needed to ride the train out of Train Street was in place and
  // there was simply no way to get up there: the awnings that fold to 3.5 m are
  // draw-only (and they MOVE, so a static collider on one would desync), and
  // measured in the running game the animal against a house front rises 0.68 m
  // and stops -- Hanoi publishes no climbHold and the generic wall climb does
  // not engage on these.
  //
  // So: a stack, which is the most Train Street object there is. Five crates in
  // a stair against the north houses, 0.68 m a tread, topping out at 3.40 --
  // level with a passing roof. It stands at dz 2.5 from the centreline, which
  // is a metre outside the train's own 1.45 half-width, so it is not something
  // the train hits and not something that has to fold.
  {
    const sx = (x0 + x1) * 0.5 + 6;
    const sz = z - 2.5;
    for (let i = 0; i < 5; i++) {
      const ty = hanGROUND + 0.34 + i * 0.68;
      const w = 1.30 - i * 0.06;
      K.box(sx - i * 0.30, ty, sz, w, 0.68, 1.15,
            i % 2 ? PALETTE.hanCrate : PALETTE.hanCrate2, 0, 0.06 * i, 0);
      hanPoolBox(body, sx - i * 0.30, ty, sz, w, 0.68, 1.15, 0.06 * i);
    }
    // ...and a pallet on the top one, so the last tread is a place to stand
    // rather than a ledge to balance on.
    K.box(sx - 1.35, hanGROUND + 3.44, sz, 1.6, 0.10, 1.5, PALETTE.hanCrate);
    hanPoolBox(body, sx - 1.35, hanGROUND + 3.44, sz, 1.6, 0.10, 1.5, 0);
  }

  // ---- the two crossing gates, which are the alley's own way in ---------
  for (let s = 0; s < 2; s++) {
    const gx = s ? x1 + 1.5 : x0 - 1.5;
    K.cyl(gx, hanGROUND + 1.3, z + 3.4, 0.11, 2.6, PALETTE.hanGate, 0, 0, 0, 6);
    K.cyl(gx, hanGROUND + 1.3, z - 3.4, 0.11, 2.6, PALETTE.hanGate, 0, 0, 0, 6);
    K.box(gx, hanGROUND + 2.5, z, 0.16, 0.7, 7.2, PALETTE.hanGate);
    K.box(gx, hanGROUND + 2.5, z, 0.20, 0.55, 1.0, PALETTE.hanGateRed);
    K.box(gx, hanGROUND + 2.5, z + 2.4, 0.20, 0.55, 1.0, PALETTE.hanGateRed);
    K.box(gx, hanGROUND + 2.5, z - 2.4, 0.20, 0.55, 1.0, PALETTE.hanGateRed);
  }

  const m = new THREE.Mesh(K.build(), hanVCF());
  m.castShadow = true; m.receiveShadow = true;
  root.add(m);
  hanPoolDone(game, body);

  hanBuildTrain(game, root);
}

/**
 * THE TRAIN. Four carriages and a locomotive, and it is a KINEMATIC CARRIER
 * that nobody is ever going to ride — which is the only one in this game.
 *
 * It is a body rather than a mesh because the rule this chapter is built on is
 * that a solid thing is solid: an animal standing on the rails when it comes
 * through is SHOVED ALONG THE ALLEY, at eleven metres a second, which is
 * exactly what would happen and is very funny. It is not damage. It has never
 * been damage.
 */
function hanBuildTrain(game, root) {
  const K = hanMerger();
  const H = 3.4, W = 2.9;
  // the loco
  K.box(0, H * 0.5, 0, W, H, 12, PALETTE.hanLoco);
  K.box(0, H + 0.22, 0, W + 0.2, 0.44, 12.2, PALETTE.hanLocoDk);
  K.box(0, 1.1, 6.3, W - 0.4, 1.6, 0.6, PALETTE.hanLocoRed);
  K.box(0, 2.4, 5.6, W - 0.6, 1.1, 0.4, PALETTE.hanGlass);
  for (let s = -1; s <= 1; s += 2) {
    K.box(s * (W * 0.5 + 0.02), 2.1, 0, 0.10, 1.0, 10, PALETTE.hanGlass);
    K.cyl(s * 0.95, 0.42, 4.2, 0.42, 0.24, PALETTE.hanTyre, 0, 0, Math.PI / 2, 8);
    K.cyl(s * 0.95, 0.42, -4.2, 0.42, 0.24, PALETTE.hanTyre, 0, 0, Math.PI / 2, 8);
  }
  K.cyl(0, 1.1, 6.6, 0.24, 0.30, PALETTE.hanLampGlass, Math.PI / 2, 0, 0, 8);
  // the carriages
  for (let c = 1; c <= hanTRAIN_LEN; c++) {
    const cz = -13.6 * c;
    K.box(0, H * 0.5, cz, W, H, 12.4, c % 2 ? PALETTE.hanCar1 : PALETTE.hanCar2);
    K.box(0, H + 0.22, cz, W + 0.2, 0.44, 12.6, PALETTE.hanLocoDk);
    K.box(0, 0.5, cz, W + 0.1, 0.5, 12.6, PALETTE.hanLocoDk);
    for (let s = -1; s <= 1; s += 2) {
      for (let w = 0; w < 5; w++) {
        K.box(s * (W * 0.5 + 0.03), 2.2, cz - 4.4 + w * 2.2, 0.08, 1.1, 1.5, PALETTE.hanGlass);
      }
      K.cyl(s * 0.95, 0.42, cz + 4.4, 0.42, 0.24, PALETTE.hanTyre, 0, 0, Math.PI / 2, 8);
      K.cyl(s * 0.95, 0.42, cz - 4.4, 0.42, 0.24, PALETTE.hanTyre, 0, 0, Math.PI / 2, 8);
    }
    K.box(0, 1.7, cz + 6.4, 0.4, 0.5, 1.4, PALETTE.hanLocoDk);
  }
  const g = new THREE.Group();
  const m = new THREE.Mesh(K.build(), hanVCF());
  m.castShadow = true; m.receiveShadow = true;
  g.add(m);
  g.visible = false;
  hanTrainG = g;
  root.add(g);

  const b = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC,
                              material: (game.mats && game.mats.prop) || undefined });
  b.allowSleep = false;
  b.addShape(new CANNON.Box(new CANNON.Vec3(1.45, 1.7, 6.2)), new CANNON.Vec3(0, 1.7, 0));
  for (let c = 1; c <= hanTRAIN_LEN; c++) {
    b.addShape(new CANNON.Box(new CANNON.Vec3(1.45, 1.7, 6.3)),
               new CANNON.Vec3(0, 1.7, -13.6 * c));
  }
  b.position.set(0, -900, 0);
  hanSyncBody(b);
  game.world.addBody(b);
  hanTrainBody = b;
}

/** How far the train has come along the alley, and everything that follows. */
let hanTrainTX = 0, hanTrainHave = false;
function hanUpdateTrain(game, dt) {
  const capy = game.capy;
  const p = capy && capy.position;
  const inAlley = p ? hanInRect(hanZ.alley, p.x, p.z) : false;

  // ---- the alley, on the signpost (W1) --------------------------------------
  // Standing in the alley is the whole of the task and the only thing that
  // told you how long to stand there was a horn. The countdown to the next
  // one, and then the gap as it passes, in the same place the paper says
  // what the big thing here is.
  if (!hanTrainDone && inAlley && typeof game.wowLive === 'function') {
    if (hanTrainS < 0) {
      game.wowLive('in the alley · the train in ' + Math.ceil(Math.max(0, hanTrainT)) + ' s · stand still',
                   clamp(1 - hanTrainT / 40, 0, 0.6));
    } else {
      const x = hanTRAIN.x1 + 60 - hanTrainS;
      const gap = p ? Math.max(0, Math.hypot(0, p.z - hanTRAIN.z) - 1.45) : 9;
      const coming = x > (p ? p.x : hanTRAIN.x1) + 8;
      game.wowLive(coming ? 'HERE IT COMES · ' + Math.round(x - p.x) + ' m · ' + gap.toFixed(1) + ' m of clearance'
                          : 'THE TRAIN · ' + gap.toFixed(1) + ' m of clearance · stand still',
                   coming ? 0.6 + 0.4 * clamp(1 - (x - p.x) / 60, 0, 1) : 1);
    }
  }

  if (hanTrainS < 0) {
    // THE TRAIN HURRIES FOR YOU (W4). Ninety-six seconds between trains and
    // the task is to stand still: in the alley with the marquee open, the gap
    // runs at three times until the horn is due, and the horn's own eleven
    // seconds run at one, so the warning is still a warning.
    hanTrainT -= dt * ((!hanTrainDone && inAlley && hanTrainT > hanTRAIN_WARN + 3) ? 3 : 1);
    // the horn, eleven seconds out, and the street starts folding on it
    if (hanTrainT <= hanTRAIN_WARN && !hanTrainWarned) {
      hanTrainWarned = true;
      hanCue('whistle', hanTRAIN.x1 + 40, hanGROUND + 3, hanTRAIN.z, 0.55, 0.55, 220);
      if (inAlley) {
        hanToast('that is the horn. it is eleven seconds away. stay where you are.');
      } else if (!hanToldTrain) {
        hanToldTrain = true;
        hanToast('something has just sounded a horn over on the west side.');
      }
    }
    if (hanTrainT <= 0) {
      hanTrainS = 0;
      hanTrainNear = 99;
      hanTrainCount++;
      hanTrainG.visible = true;
      hanTrainHave = false;
      hanCue('whistle', hanTRAIN.x1 + 20, hanGROUND + 3, hanTRAIN.z, 0.7, 0.5, 220);
    }
  } else {
    hanTrainS += hanTRAIN_V * dt;
    // it comes in from the east and runs out of the west end
    const x = hanTRAIN.x1 + 60 - hanTrainS;
    hanTrainG.position.set(x, hanGROUND, hanTRAIN.z);
    hanTrainG.rotation.y = -Math.PI / 2;
    const b = hanTrainBody;
    if (!hanTrainHave) {
      b.position.set(x, hanGROUND, hanTRAIN.z);
      b.quaternion.setFromEuler(0, -Math.PI / 2, 0);
      b.velocity.setZero();
      hanSyncBody(b);
      hanTrainTX = x; hanTrainHave = true;
    } else {
      b.velocity.set((x - hanTrainTX) / dt, 0, 0);
      hanTrainTX = x;
    }
    // how close it has come to the animal, this pass
    if (p && inAlley) {
      // the nose-to-tail extent, so a carriage counts as much as the loco
      const back = x + 13.6 * hanTRAIN_LEN + 7;
      const along = clamp(p.x, x - 7, back);
      const d = Math.max(0, Math.hypot(p.x - along, p.z - hanTRAIN.z) - 1.45);
      if (d < hanTrainNear) hanTrainNear = d;
      // ...and how close it HAS come, while it is still coming (v36). The
      // closest approach so far and not the instantaneous gap: `hanTrainNear`
      // is the quantity filed when the train has gone, and a figure that
      // climbed again as the last carriage went past would be telling you the
      // opposite of what you just did. Ninety is the same ceiling the filing
      // branch uses for "it was never really near you".
      if (hanTrainNear < 90 && game.recordLive) game.recordLive('the-train', hanTrainNear);
      // ---- THE MARQUEE PAYS OUT HERE, WHILE THE TRAIN IS ON TOP OF YOU ----
      //
      // It used to pay out in the despawn branch below, and that branch runs
      // when `hanTrainS` has passed 300 m — sixty metres of run-in, the
      // ninety-six metre alley, four carriages and then NINETY MORE METRES of
      // clearance. Measured: the card, the music swell and the camera shot all
      // fired 17.7 s after the train passed the player, at which point three
      // lines above them had already set `hanTrainG.visible = false` and put
      // the body at y = -900.
      //
      // So chapter 19's wow — "Be in the alley when it comes through" — showed
      // its card and asked for its camera with the train INVISIBLE AND NINE
      // HUNDRED METRES UNDERGROUND, pointing at an empty alley. Measured at the
      // payout frame: body y -900, and `trainGlow()` 0.00 for the whole
      // fourteen seconds before it.
      //
      // The RECORD still files at despawn — it is the closest approach over the
      // whole pass, and that is not known until the pass is over. The moment is
      // not the same thing as the score.
      // ...AND THE MOMENT IS THE NOSE GOING PAST (W1). `d` is measured to the
      // whole length of the train, so it dropped under hanTRAIN_WOW with the
      // loco still eight or nine metres up the alley, and the banner, the
      // 0.55x beat and the shot were all spent before the thing arrived. The
      // nose is at `x` and it runs west, so "past" is x under the animal.
      if (!hanTrainDone && d < hanTRAIN_WOW && x <= p.x + 1.0) {
        hanTrainDone = true;
        hanTask('the-train');
        if (typeof game.frameShot === 'function') {
          // ALONG THE ALLEY, AND ONLY ALONG IT.
          //
          // The literal 1.5708 that was here was across the tracks, and so was
          // the computed bearing that first replaced it: `atan2(p.x - along,
          // p.z - z)` has a z term, and any z term at all points the lens at a
          // wall. THIS ALLEY IS 6.4 m WIDE with a 1.45 m train down the middle
          // of it — about 2.6 m of daylight either side, which is hanTRAIN_WOW
          // and is the one thing the chapter is about. Asking for thirteen
          // metres of distance on a
          // diagonal put the camera INSIDE the building: the marquee frame was
          // a flat beige wall with the card over it, no train and no capybara.
          // Found from the PNG. Nothing in the numbers said so — the train was
          // present, visible and 82% inside the frustum at the time.
          //
          // So: the sign of x only. The alley is ninety-six metres long and
          // three wide, and a shot down its length is the only shot it has.
          // `x` is the nose in this scope — the local the mesh is driven from,
          // a few lines above. Not `nose`, which is the api getter's name for
          // the same quantity and is not in scope here; that would have been
          // `undefined`, atan2(NaN, 0), and a shot silently discarded by
          // frameShot's own NaN guard.
          const away = p.x < x ? -1 : 1;
          // A BEARING AND NOTHING ELSE, because this alley will not give a
          // distance to anybody. Measured at the payout with `dist: 11`
          // requested: the camera sat 1.4 m from the animal. The rig's own
          // wall-avoidance collapses it — the alley is three metres of open air
          // between two terraces and there is nowhere for a lens to stand — so
          // every dist/pitch/raise this shot asked for was overridden and the
          // frame was the inside of a house with the wow card over it.
          //
          // frameShot is documented to take a yaw alone and keep the distance
          // and pitch it had, and that is the only request this geometry can
          // honour: the camera stays wherever the alley has let it be and TURNS
          // to look down the line at the train. Which is also the right picture
          // — the chapter is about forty-five centimetres of clearance, and a
          // wide establishing shot would be a lie about the place.
          //
          // A raise was tried too and is NOT honoured either: 6.4 m asked,
          // 2.7 m delivered. The mechanism is the occlusion ray in systems.js,
          // and it is RIGHT — the alley is walled on both sides and roofed by
          // overhanging terraces, so a lens that backs off or climbs is a lens
          // that cannot see the animal. The framed channel is not fully
          // available in Train Street and the reason is the chapter working
          // exactly as designed. A bearing is the whole of what it can give,
          // and the bearing is worth having: it turns the lens onto the train
          // instead of leaving it wherever the player last dragged it.
          //
          // A raise was tried too and is NOT honoured either: 6.4 m requested,
          // 2.7 m delivered. The mechanism is the occlusion ray in systems.js,
          // and it is right — the alley is walled on both sides and roofed by
          // overhanging terraces, so a lens that backs off or climbs is a lens
          // that cannot see the animal. The framed channel is simply not
          // available in Train Street, and the reason is the chapter working
          // exactly as designed. A bearing is the whole of what it can give.
          //
          // A raise was tried too and is NOT honoured either: 6.4 m requested,
          // 2.7 m delivered. The mechanism is the occlusion ray in systems.js,
          // and it is right — the alley is walled on both sides and roofed by
          // overhanging terraces, so a lens that backs off or climbs is a lens
          // that cannot see the animal. The framed channel is simply not
          // available in Train Street, and the reason is the chapter working
          // exactly as designed. A bearing is the whole of what it can give.
          game.frameShot({ yaw: Math.atan2(away, 0), hold: 2.6 });
        }
        if (game.music && typeof game.music.swell === 'function') game.music.swell(1.0);
      }
    }
    if (hanTrainS > 60 + (hanTRAIN.x1 - hanTRAIN.x0) + 13.6 * hanTRAIN_LEN + 90) {
      // gone. Score whatever happened, and stand the street back up.
      hanTrainS = -1;
      hanTrainT = hanTRAIN_GAP2;
      hanTrainWarned = false;
      hanTrainG.visible = false;
      hanTrainBody.position.set(0, -900, 0);
      hanTrainBody.velocity.setZero();
      hanSyncBody(hanTrainBody);
      if (hanTrainNear < 90) {
        if (hanTrainNear < hanTrainBest) {
          hanTrainBest = hanTrainNear;
          hanRecord('the-train', hanTrainNear);
        }
        // The task, the shot and the swell have MOVED UP into the pass itself —
        // see THE MARQUEE PAYS OUT HERE above. This branch keeps only the
        // record, which is a property of the whole pass rather than of a
        // moment. A safety net stays: if the closest approach qualified and the
        // in-pass test somehow did not fire (a frame skipped over the
        // threshold at 11 m/s), the task still ticks — silently, with no card
        // pointed at an empty alley.
        if (!hanTrainDone && hanTrainNear < hanTRAIN_WOW) {
          hanTrainDone = true;
          hanTask('the-train');
        }
      }
    }
  }

  // ---- THE FOLD --------------------------------------------------------
  // Driven by the clock and NOT by the player: a street that folds up because
  // you walked into it is a street reacting to you, and the entire point of
  // this one is that it is not.
  const want = (hanTrainS >= 0) ? 1 : (hanTrainT <= hanTRAIN_WARN ? 1 : 0);
  const was = hanFoldK;
  hanFoldK = damp(hanFoldK, want, 1.4, dt);
  // ---- THE MARQUEE IS THE STREET BEING FOLDED, NOT THE FRAME IT CROSSES ----
  // This was `was < 0.5 && hanFoldK >= 0.5 && inAlley`: a rising EDGE, and the
  // fold is damped at 1.4/s, so the crossing lasts a few frames and happens
  // once every hanTRAIN_GAP2 — ninety-six seconds. Walk into the alley two
  // seconds after the horn and the street has already folded; nothing ticks,
  // and the next chance is a minute and a half away with no way to know that.
  //
  // Exactly the shape kowloon.js removed from the Symphony ("the marquee is the
  // show, not the first frame of it"): the thing to be present for is the
  // street being SHUT, which is a state that lasts as long as the train is
  // coming and passing. Being in the alley at any point while it holds is
  // having seen it.
  if (hanFoldK >= 0.5 && inAlley && !hanFoldDone) {
    hanFoldDone = true;
    hanTask('fold-the-street');
    hanToast(was < 0.5
      ? 'every table on this street has just gone indoors.'
      : 'every table on this street is already indoors. it knew before you did.');
  }
  for (let i = 0; i < hanFolders.length; i++) {
    const f = hanFolders[i];
    f.m.position.set(lerp(f.ox, f.fx, hanFoldK), lerp(f.oy, f.fy, hanFoldK),
                     lerp(f.oz, f.fz, hanFoldK));
    // ON hanFoldK, exactly like the position above it. This used to chase f.fr
    // every frame regardless of the fold, off its own value — so within about
    // two seconds of arriving, every stool, table, crate and parked bike in the
    // street had turned side-on as if folded, and nothing ever turned it back.
    if (f.fr) f.m.rotation.y = lerp(f.or, f.fr, hanFoldK);
  }
  // ...and the shake, because eleven metres a second of train a metre away is
  // not a quiet thing
  if (hanTrainS >= 0 && p && inAlley) {
    const d = Math.abs(p.x - (hanTRAIN.x1 + 60 - hanTrainS));
    if (d < 30 && typeof game.shake === 'function') game.shake(0.10 * (1 - d / 30));
    if (Math.random() < dt * 9) {
      hanCue('thud', hanTRAIN.x1 + 60 - hanTrainS, hanGROUND + 1, hanTRAIN.z,
             rand(0.16, 0.30), rand(0.35, 0.55), 140);
    }
  }
}

// ============================================================== THE LAKE SET =
/**
 * THE TOWER, THE RED BRIDGE, THE TEMPLE AND THE PUPPETS.
 *
 * Everything inside the ring road, which is everything in this chapter that is
 * not moving. It is deliberately the only part of the map with straight lines
 * and symmetry in it.
 */
function hanBuildLakeSet(game, root) {
  const K = hanMerger();
  const body = hanPoolBody(game);

  // ---- Thap Rua. Three storeys of nineteenth-century folly on an islet.
  const tx = hanTOWER.x, tz = hanTOWER.z;
  K.cyl(tx, hanGROUND + 0.2, tz, 6.4, 1.2, PALETTE.hanIslet, 0, 0, 0, 12);
  K.box(tx, hanGROUND + 1.6, tz, 6.0, 1.4, 5.0, PALETTE.hanTowerSt);
  K.box(tx, hanGROUND + 3.6, tz, 5.0, 2.6, 4.0, PALETTE.hanTowerSt);
  K.box(tx, hanGROUND + 5.1, tz, 5.6, 0.4, 4.6, PALETTE.hanTowerDk);
  K.box(tx, hanGROUND + 6.6, tz, 3.8, 2.6, 3.0, PALETTE.hanTowerSt);
  K.box(tx, hanGROUND + 8.1, tz, 4.4, 0.4, 3.6, PALETTE.hanTowerDk);
  K.box(tx, hanGROUND + 9.4, tz, 2.6, 2.2, 2.2, PALETTE.hanTowerSt);
  K.cone(tx, hanGROUND + 11.4, tz, 2.2, 1.8, PALETTE.hanTowerDk, 0, 0.78, 0, 4);
  K.cyl(tx, hanGROUND + 12.6, tz, 0.16, 0.9, PALETTE.hanTowerDk, 0, 0, 0, 6);
  for (let f = 0; f < 3; f++) {
    const fy = hanGROUND + 2.6 + f * 3.0;
    for (let s = -1; s <= 1; s += 2) {
      K.box(tx + s * 1.4, fy, tz + 2.1 - f * 0.5, 0.7, 1.5, 0.14, PALETTE.hanTowerArch);
      K.box(tx + s * 1.4, fy, tz - 2.1 + f * 0.5, 0.7, 1.5, 0.14, PALETTE.hanTowerArch);
    }
  }
  // THE TOWER IS NOT THE ISLET. At six by five the collider covered the whole
  // top of the island and there was nowhere to stand on it.
  hanPoolBox(body, tx, hanGROUND + 5, tz, 4.6, 12, 3.8);
  hanBlock(tx, tz, 3.4);

  // ---- Ngoc Son, on the other islet, and the gate in front of it
  const nx = hanNGOC.x, nz = hanNGOC.z;
  K.cyl(nx, hanGROUND + 0.2, nz, 12.0, 1.2, PALETTE.hanIslet, 0, 0, 0, 12);
  K.box(nx, hanGROUND + 2.2, nz, 11, 4.0, 8.0, PALETTE.hanTempleW);
  K.box(nx, hanGROUND + 4.6, nz, 12.4, 0.8, 9.4, PALETTE.hanTempleR);
  K.box(nx, hanGROUND + 5.4, nz, 10.0, 0.9, 7.6, PALETTE.hanTempleR);
  for (let s = -1; s <= 1; s += 2) {
    K.box(nx + s * 6.4, hanGROUND + 5.4, nz, 1.8, 0.5, 9.0, PALETTE.hanTempleR, 0, 0, s * 0.5);
  }
  K.box(nx, hanGROUND + 2.0, nz - 4.2, 2.4, 3.6, 0.3, PALETTE.hanTempleDoor);
  for (let i = 0; i < 6; i++) {
    K.cyl(nx - 4.5 + i * 1.8, hanGROUND + 2.2, nz - 4.4, 0.24, 4.0, PALETTE.hanTempleCol, 0, 0, 0, 8);
  }
  hanPoolBox(body, nx, hanGROUND + 2.4, nz, 11, 5, 8.0);
  hanBlock(nx, nz, 8);
  // the banyan, which is the other thing on that island
  K.cyl(nx - 7, hanGROUND + 2.2, nz + 5, 0.7, 4.4, PALETTE.hanTrunk, 0, 0, 0, 8);
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9;
    K.sph(nx - 7 + Math.cos(a) * 2.4, hanGROUND + 5.6 + Math.sin(a * 2) * 0.9,
          nz + 5 + Math.sin(a) * 2.4, 2.1, 1.5, 2.1, i % 2 ? PALETTE.hanLeaf : PALETTE.hanLeafDk, 6);
  }

  // ---- The Huc bridge. Red, timber, and it is the picture of this city.
  const bx0 = hanHUC.x0, bz0 = hanHUC.z0, bx1 = hanHUC.x1, bz1 = hanHUC.z1;
  const blen = Math.hypot(bx1 - bx0, bz1 - bz0);
  const byaw = Math.atan2(bx1 - bx0, bz1 - bz0);
  const N = 18;
  const bg = new THREE.Group();
  const BK = hanMerger();
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = lerp(bx0, bx1, t), z = lerp(bz0, bz1, t);
    // an arch: it rises a metre and a quarter in the middle, which is what
    // makes a bridge a bridge rather than a plank
    const y = hanGROUND + 0.55 + Math.sin(t * Math.PI) * 1.25;
    BK.box(x, y, z, 3.0, 0.20, blen / N + 0.2, PALETTE.hanHucDeck, 0, byaw, 0);
    for (let s = -1; s <= 1; s += 2) {
      BK.box(x + Math.cos(byaw) * 1.45 * s, y + 0.62, z - Math.sin(byaw) * 1.45 * s,
             0.14, 1.05, blen / N + 0.2, PALETTE.hanHuc, 0, byaw, 0);
      // AND THE RAILING IS SOLID. A three-metre arched deck over eighty
      // metres of lake with a balustrade that was drawn and not collided is a
      // plank: measured, every attempt to cross it ended underneath it.
      hanPoolBox(body, x + Math.cos(byaw) * 1.55 * s, y + 0.75, z - Math.sin(byaw) * 1.55 * s,
                 0.40, 1.5, blen / N + 0.3, byaw);
      if (i % 3 === 0) {
        BK.cyl(x + Math.cos(byaw) * 1.45 * s, y + 0.55, z - Math.sin(byaw) * 1.45 * s,
               0.12, 1.3, PALETTE.hanHucDk, 0, 0, 0, 6);
      }
    }
    if (i % 3 === 0) {
      BK.cyl(x, y - 1.4, z, 0.16, 2.6, PALETTE.hanHucDk, 0, 0, 0, 6);
    }
    hanPoolBox(body, x, y - 0.35, z, 3.2, 0.7, blen / N + 0.3, byaw);
  }
  // the gate at the near end, which is where everybody stops for a photograph
  BK.cyl(bx0 - 1.7, hanGROUND + 2.4, bz0 + 0.4, 0.28, 4.8, PALETTE.hanHucDk, 0, 0, 0, 8);
  BK.cyl(bx0 + 1.7, hanGROUND + 2.4, bz0 - 0.4, 0.28, 4.8, PALETTE.hanHucDk, 0, 0, 0, 8);
  BK.box(bx0, hanGROUND + 4.9, bz0, 5.0, 0.5, 1.0, PALETTE.hanHuc, 0, byaw, 0);
  BK.box(bx0, hanGROUND + 5.5, bz0, 4.2, 0.6, 1.4, PALETTE.hanTempleR, 0, byaw, 0);
  const bm = new THREE.Mesh(BK.build(), hanVCF());
  bm.castShadow = true; bm.receiveShadow = true;
  bg.add(bm);
  hanHucG = bg;
  root.add(bg);

  // ---- the water puppet theatre, and the pool in front of it
  const px = hanPUPPET.x, pz = hanPUPPET.z;
  K.box(px, hanGROUND + 3.0, pz + 7, 18, 6.0, 8, PALETTE.hanTempleW);
  K.box(px, hanGROUND + 6.4, pz + 7, 19.6, 0.9, 9.4, PALETTE.hanTempleR);
  K.box(px, hanGROUND + 2.2, pz + 2.6, 12, 4.4, 0.4, PALETTE.hanCurtain);
  hanPoolBox(body, px, hanGROUND + 3.2, pz + 7.4, 18, 7, 8);
  hanBlock(px, pz + 7, 9);
  // the pool: a shallow tank of green water with the puppets standing in it
  K.box(px, hanGROUND - 0.28, pz - 1.4, 15, 0.72, 8.4, PALETTE.hanPoolWall);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(14.2, 7.6).rotateX(-Math.PI / 2),
                              grain(mat(PALETTE.hanLake), { scale: 0.06, amount: 0.05 }));
  pool.position.set(px, hanGROUND + 0.02, pz - 1.4);
  pool.receiveShadow = true; pool.castShadow = false;
  root.add(pool);
  for (let s = -1; s <= 1; s += 2) {
    K.box(px + s * 7.4, hanGROUND + 0.20, pz - 1.4, 0.5, 0.40, 8.4, PALETTE.hanPoolWall);
    hanPoolBox(body, px + s * 7.4, hanGROUND + 0.20, pz - 1.4, 0.6, 0.40, 8.4);
  }
  // ...and the near wall is a STEP. At 0.68 it was a kerb the animal stopped
  // dead at six metres short of the pool, which is where the task is.
  K.box(px, hanGROUND + 0.20, pz - 5.6, 15, 0.40, 0.5, PALETTE.hanPoolWall);
  hanPoolBox(body, px, hanGROUND + 0.20, pz - 5.6, 15, 0.40, 0.6);
  // ...and the puppets themselves: lacquered, waist-deep, and they turn
  const PP = [[-4.5, 0], [-2.2, 1.4], [0.3, -0.6], [2.6, 1.1], [4.8, -0.2], [1.4, 2.4]];
  for (let i = 0; i < PP.length; i++) {
    const P = hanMerger();
    const col = i % 3 === 0 ? PALETTE.hanPup1 : i % 3 === 1 ? PALETTE.hanPup2 : PALETTE.hanPup3;
    P.cyl(0, 0.34, 0, 0.22, 0.68, col, 0, 0, 0, 8);
    P.box(0, 0.80, 0, 0.44, 0.30, 0.34, col);
    P.sph(0, 1.06, 0, 0.19, 0.21, 0.19, PALETTE.hanPupFace, 8);
    P.cone(0, 1.32, 0, 0.24, 0.34, PALETTE.hanPupHat, 0, 0, 0, 6);
    for (let s = -1; s <= 1; s += 2) {
      P.box(s * 0.30, 0.86, 0.10, 0.11, 0.30, 0.11, col, -0.6, 0, 0);
    }
    const pm = new THREE.Mesh(P.build(), hanVCF());
    pm.castShadow = true;
    pm.position.set(px + PP[i][0], hanGROUND - 0.05, pz - 1.4 + PP[i][1]);
    root.add(pm);
    hanPuppets.push({ m: pm, x: px + PP[i][0], z: pz - 1.4 + PP[i][1], ph: rand(0, 6.28) });
  }

  const m = new THREE.Mesh(K.build(), hanVCF());
  m.castShadow = true; m.receiveShadow = true;
  root.add(m);
  hanPoolDone(game, body);
}

function hanUpdatePuppets(game, dt) {
  for (let i = 0; i < hanPuppets.length; i++) {
    const p = hanPuppets[i];
    const t = hanTime * 1.1 + p.ph;
    p.m.position.x = p.x + Math.sin(t) * 0.55;
    p.m.position.z = p.z + Math.sin(t * 0.7 + 1.2) * 0.42;
    p.m.position.y = hanGROUND - 0.05 + Math.abs(Math.sin(t * 2.2)) * 0.09;
    p.m.rotation.y = Math.sin(t * 0.9) * 0.9;
  }
  const capy = game.capy;
  if (!hanPuppetDone && capy && capy.position) {
    const q = capy.position;
    if (hanInRect(hanZ.puppet, q.x, q.z) && q.y < hanGROUND + 1.4 &&
        Math.abs(q.z - (hanPUPPET.z - 1.4)) < 5.6 && Math.abs(q.x - hanPUPPET.x) < 8) {
      hanPuppetDone = true;
      hanTask('water-puppets');
      if (typeof game.punch === 'function') game.punch(0.20);
      hanToast('eleven hundred years of this, and nobody has ever been IN it.');
    }
  }
}

// ============================================================== THE STOOLS ===
/**
 * NINETY-SIX PLASTIC STOOLS, TWENTY CENTIMETRES HIGH, ON A CORNER.
 *
 * Bia hoi is drunk sitting on a stool the size of a saucepan on a pavement at a
 * junction, and there are about a hundred of them out at any one time. They are
 * one instanced mesh with a per-stool velocity, and they are knocked over by
 * BEING RUN THROUGH: no bodies, because ninety-six dynamic props for a gag is
 * how you lose a frame, and a ballistic arc off a floor at kerb height is
 * indistinguishable at this size. Same argument as chapter 18's champagne.
 *
 * The record is the most you have had down AT ONCE, which is the only honest
 * measure of a run through a bia hoi corner: they stand back up after eight
 * seconds, so a hundred one at a time is not the same thing at all.
 */
function hanBuildStools(game, root) {
  const K = hanMerger();
  // WHITE, deliberately: a stool is one colour of plastic all through, so the
  // instance colour is allowed to BE the colour. See the note at the top of
  // hanBikeGeo for the rule.
  K.box(0, 0.19, 0, 0.30, 0.035, 0.30, 0xffffff);
  for (let l = 0; l < 4; l++) {
    K.box((l & 1 ? 0.115 : -0.115), 0.095, (l & 2 ? 0.115 : -0.115), 0.032, 0.19, 0.032, 0xffffff);
  }
  K.box(0, 0.10, 0.13, 0.26, 0.028, 0.028, 0xffffff);
  K.box(0, 0.10, -0.13, 0.26, 0.028, 0.028, 0xffffff);
  const geo = K.build();
  const m = new THREE.InstancedMesh(geo, hanVCF(), hanSTOOL_N);
  m.castShadow = true; m.receiveShadow = false;
  m.frustumCulled = false;
  hanStoolData = new Float32Array(hanSTOOL_N * 8);   // x z downT vx vz spin roll colour
  const col = new Float32Array(hanSTOOL_N * 3);
  const pal = [PALETTE.hanStoolA, PALETTE.hanStoolB, PALETTE.hanStoolC, PALETTE.hanStoolD];
  for (let i = 0; i < hanSTOOL_N; i++) {
    // clustered in eights round little tables, which is how they are used
    const g = Math.floor(i / 6);
    const a = (g * 2.4) % 6.283;
    const gr = 3.2 + (g % 5) * 2.6;
    const gx = hanBIA.x + Math.cos(a) * gr, gz = hanBIA.z + Math.sin(a) * gr;
    const b = (i % 6) * 1.05;
    hanStoolData[i * 8] = gx + Math.cos(b) * rand(0.5, 1.1);
    hanStoolData[i * 8 + 1] = gz + Math.sin(b) * rand(0.5, 1.1);
    hanStoolData[i * 8 + 2] = 0;
    hanCol.set(pal[randInt(0, pal.length - 1)]);
    col[i * 3] = hanCol.r; col[i * 3 + 1] = hanCol.g; col[i * 3 + 2] = hanCol.b;
  }
  m.instanceColor = new THREE.InstancedBufferAttribute(col, 3);
  hanStoolMesh = m;
  root.add(m);
  hanSyncStools();
  hanBlock(hanBIA.x, hanBIA.z, 3);

  // ...and the little tables they are round, and the keg, and the crates
  const T = hanMerger();
  for (let g = 0; g < 16; g++) {
    const a = (g * 2.4) % 6.283;
    const gr = 3.2 + (g % 5) * 2.6;
    const gx = hanBIA.x + Math.cos(a) * gr, gz = hanBIA.z + Math.sin(a) * gr;
    T.cyl(gx, hanGROUND + 0.30, gz, 0.44, 0.06, PALETTE.hanTableTop, 0, 0, 0, 8);
    T.cyl(gx, hanGROUND + 0.15, gz, 0.06, 0.30, PALETTE.hanTableLeg, 0, 0, 0, 4);
    for (let s = 0; s < 4; s++) {
      T.cyl(gx + Math.cos(s * 1.57) * 0.15, hanGROUND + 0.34, gz + Math.sin(s * 1.57) * 0.15,
            0.055, 0.13, PALETTE.hanBeer, 0, 0, 0, 6);
    }
  }
  T.cyl(hanBIA.x - 3.5, hanGROUND + 0.42, hanBIA.z - 3.5, 0.42, 0.84, PALETTE.hanKeg, 0, 0, 0, 10);
  T.cyl(hanBIA.x - 3.5, hanGROUND + 0.86, hanBIA.z - 3.5, 0.44, 0.06, PALETTE.hanChrome, 0, 0, 0, 10);
  for (let c = 0; c < 5; c++) {
    T.box(hanBIA.x + 5 + (c % 2) * 0.55, hanGROUND + 0.16 + Math.floor(c / 2) * 0.32,
          hanBIA.z - 5, 0.5, 0.3, 0.36, PALETTE.hanCrate2);
  }
  const tm = new THREE.Mesh(T.build(), hanVCF());
  tm.castShadow = true;
  root.add(tm);
}
function hanSyncStools() {
  if (!hanStoolMesh) return;
  for (let i = 0; i < hanSTOOL_N; i++) {
    const o = i * 8;
    const down = hanStoolData[o + 2] > 0 ? 1 : 0;
    hanE.set(down ? hanStoolData[o + 6] : 0, hanStoolData[o + 5], down ? hanStoolData[o + 6] * 0.6 : 0, 'YXZ');
    hanM.compose(hanV3.set(hanStoolData[o], hanGROUND + (down ? 0.10 : 0), hanStoolData[o + 1]),
                 hanQ.setFromEuler(hanE), hanSc.set(1, 1, 1));
    hanStoolMesh.setMatrixAt(i, hanM);
  }
  hanStoolMesh.instanceMatrix.needsUpdate = true;
}
function hanUpdateStools(game, dt) {
  if (!hanStoolMesh) return;
  const capy = game.capy;
  const p = capy && capy.position;
  const sp = capy && capy.velocity ? Math.hypot(capy.velocity.x, capy.velocity.z) : 0;
  let down = 0, moved = false;
  for (let i = 0; i < hanSTOOL_N; i++) {
    const o = i * 8;
    if (hanStoolData[o + 2] > 0) {
      down++;
      hanStoolData[o + 2] -= dt;
      // it slides for a moment and then it is just a stool lying on a pavement
      hanStoolData[o] += hanStoolData[o + 3] * dt;
      hanStoolData[o + 1] += hanStoolData[o + 4] * dt;
      hanStoolData[o + 3] *= (1 - dt * 4.5);
      hanStoolData[o + 4] *= (1 - dt * 4.5);
      hanStoolData[o + 6] = damp(hanStoolData[o + 6], 1.45, 6, dt);
      moved = true;
      if (hanStoolData[o + 2] <= 0) { hanStoolData[o + 6] = 0; moved = true; }
      continue;
    }
    if (!p || sp < 1.4) continue;
    const dx = hanStoolData[o] - p.x, dz = hanStoolData[o + 1] - p.z;
    if (dx * dx + dz * dz > 0.9 * 0.9) continue;
    if (p.y > hanGROUND + 1.4) continue;
    const d = Math.hypot(dx, dz) || 1;
    hanStoolData[o + 2] = 8.0;
    hanStoolData[o + 3] = dx / d * sp * 0.55 + capy.velocity.x * 0.30;
    hanStoolData[o + 4] = dz / d * sp * 0.55 + capy.velocity.z * 0.30;
    hanStoolData[o + 5] = rand(0, 6.28);
    hanStoolData[o + 6] = 0.2;
    down++;
    moved = true;
    hanCue('pop', hanStoolData[o], hanGROUND + 0.2, hanStoolData[o + 1], 0.24, rand(2.4, 3.4));
  }
  if (moved) hanSyncStools();
  // ...and the tally is on the paper while they are going over (v36). Called
  // only on the frame the count MOVES — a flash, not a line, the same shape the
  // yacht count and the chip stack use, so a street with three stools on their
  // side does not carry a permanent readout. The live line's own watchdog takes
  // it down a second and a half after the last one falls.
  if (down !== hanStoolDown && down > 0 && game.recordLive) {
    game.recordLive('the-stools', down);
  }
  hanStoolDown = down;
  if (down > hanStoolBest) {
    hanStoolBest = down;
    hanRecord('the-stools', down);
    if (down >= 14 && !hanStoolDone) {
      hanStoolDone = true;
      hanTask('the-stools');
      if (typeof game.punch === 'function') game.punch(0.32);
      hanToast('nobody has stood up. they are still holding the glasses.');
    }
  }
}

// ============================================== THE MARKET, THE BRIDGE, THE ==
// ============================================== SHUTTLECOCK AND THE BARBER ===
function hanBuildOddments(game, root) {
  const K = hanMerger();
  const body = hanPoolBody(game);

  // ---- the wet market: forty stalls under one long awning ---------------
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 10; c++) {
      const sx = hanMARKET.x - 17 + c * 3.8, sz = hanMARKET.z - 9 + r * 6.0;
      K.box(sx, hanGROUND + 0.42, sz, 2.4, 0.10, 1.4, PALETTE.hanStallTop);
      for (let l = 0; l < 4; l++) {
        K.box(sx + (l & 1 ? 1.0 : -1.0), hanGROUND + 0.21, sz + (l & 2 ? 0.55 : -0.55),
              0.09, 0.42, 0.09, PALETTE.hanStallLeg);
      }
      // ...and what is on it, which is what a wet market is
      const what = (r * 10 + c) % 5;
      const col = what === 0 ? PALETTE.hanHerb : what === 1 ? PALETTE.hanChilli
                : what === 2 ? PALETTE.hanFish : what === 3 ? PALETTE.hanFruit
                : PALETTE.hanRice;
      for (let k = 0; k < 5; k++) {
        K.sph(sx - 0.9 + k * 0.45, hanGROUND + 0.55, sz + rand(-0.4, 0.4),
              0.20, 0.13, 0.20, col, 6);
      }
      hanPoolBox(body, sx, hanGROUND + 0.3, sz, 2.4, 0.6, 1.4);
      hanBlock(sx, sz, 1.3);
    }
    // the awning over the row, on poles
    K.box(hanMARKET.x, hanGROUND + 2.5, hanMARKET.z - 9 + r * 6.0, 40, 0.09, 3.2,
          r % 2 ? PALETTE.hanTarp : PALETTE.hanTarpRed);
    for (let c = 0; c < 6; c++) {
      K.cyl(hanMARKET.x - 18 + c * 7.2, hanGROUND + 1.25, hanMARKET.z - 9 + r * 6.0,
            0.06, 2.5, PALETTE.hanPole, 0, 0, 0, 4);
    }
  }

  // ---- Long Bien: a hundred years of French lattice over the Red River ---
  const bx = hanBRIDGE.x;
  for (let z = hanBRIDGE.z0; z < hanBRIDGE.z1; z += 8) {
    const t = (z - hanBRIDGE.z0) / (hanBRIDGE.z1 - hanBRIDGE.z0);
    const y = hanGROUND + hanDYKE.h - t * 1.5;
    K.box(bx, y, z, 9.0, 0.34, 8.2, PALETTE.hanDeck);
    hanPoolBox(body, bx, y - 0.4, z, 9.2, 0.9, 8.2);
    // ...AND A PARAPET, WHICH IS NOT DECORATION. A nine-metre deck twenty-six
    // metres above the Red River with nothing down either side of it is a
    // walkway you fall off, and the chapter's way OUT is at the far end of it.
    // Measured without them: every attempt to reach the head of the bridge
    // ended in the water.
    for (let sd = -1; sd <= 1; sd += 2) {
      K.box(bx + sd * 4.3, y + 0.62, z, 0.30, 1.06, 8.2, PALETTE.hanSteel);
      hanPoolBox(body, bx + sd * 4.55, y + 0.70, z, 0.45, 1.5, 8.2);
    }
    // the lattice: a truss that rises and falls, which is the whole silhouette
    const rise = 3.2 + Math.abs(Math.sin(t * Math.PI * 3.2)) * 5.4;
    for (let s = -1; s <= 1; s += 2) {
      K.box(bx + s * 4.4, y + rise * 0.5, z, 0.22, rise, 0.30, PALETTE.hanSteel);
      K.box(bx + s * 4.4, y + rise, z, 0.26, 0.30, 8.2, PALETTE.hanSteel);
      K.box(bx + s * 4.4, y + rise * 0.5, z, 0.16, 0.20, rise * 2.3, PALETTE.hanSteel,
            0.9, 0, 0);
      K.box(bx + s * 4.4, y + rise * 0.5, z, 0.16, 0.20, rise * 2.3, PALETTE.hanSteel,
            -0.9, 0, 0);
    }
    if (((z - hanBRIDGE.z0) / 8) % 3 === 0) {
      for (let s = -1; s <= 1; s += 2) {
        K.cyl(bx + s * 4.4, y - 4, z, 0.5, 8, PALETTE.hanPier, 0, 0, 0, 8);
      }
    }
  }
  hanBlock(bx, (hanBRIDGE.z0 + hanBRIDGE.z1) / 2, 6);

  // ---- the barber, on a wall, with a mirror nailed to a tree ------------
  K.cyl(hanBARBER.x, hanGROUND + 2.6, hanBARBER.z, 0.42, 5.2, PALETTE.hanTrunk, 0, 0, 0, 8);
  for (let i = 0; i < 6; i++) {
    const a = i * 1.05;
    K.sph(hanBARBER.x + Math.cos(a) * 2.0, hanGROUND + 5.8 + Math.sin(a * 2) * 0.7,
          hanBARBER.z + Math.sin(a) * 2.0, 1.9, 1.3, 1.9,
          i % 2 ? PALETTE.hanLeaf : PALETTE.hanLeafDk, 6);
  }
  K.box(hanBARBER.x + 0.5, hanGROUND + 1.55, hanBARBER.z, 0.06, 0.90, 0.62, PALETTE.hanMirrorFrame);
  K.box(hanBARBER.x + 0.54, hanGROUND + 1.55, hanBARBER.z, 0.03, 0.78, 0.52, PALETTE.hanMirror);
  K.box(hanBARBER.x + 1.6, hanGROUND + 0.44, hanBARBER.z, 0.5, 0.10, 0.5, PALETTE.hanChair);
  K.box(hanBARBER.x + 1.85, hanGROUND + 0.75, hanBARBER.z, 0.10, 0.62, 0.5, PALETTE.hanChair);
  hanPoolBox(body, hanBARBER.x, hanGROUND + 2, hanBARBER.z, 0.9, 4, 0.9);
  hanBlock(hanBARBER.x, hanBARBER.z, 1.2);

  // ---- the flower bicycle. Somebody's whole shop on two wheels. ---------
  const F = hanMerger();
  F.cyl(0, 0.34, 0.58, 0.34, 0.06, PALETTE.hanTyre, 0, 0, Math.PI / 2, 10);
  F.cyl(0, 0.34, -0.58, 0.34, 0.06, PALETTE.hanTyre, 0, 0, Math.PI / 2, 10);
  F.box(0, 0.52, 0, 0.07, 0.07, 1.20, PALETTE.hanBikeBody);
  F.box(0, 0.72, -0.30, 0.07, 0.45, 0.07, PALETTE.hanBikeBody, 0.25, 0, 0);
  F.box(0, 0.86, 0.42, 0.07, 0.62, 0.07, PALETTE.hanBikeBody, -0.2, 0, 0);
  F.box(0, 1.10, 0.44, 0.50, 0.05, 0.06, PALETTE.hanChrome);
  F.box(0, 0.96, -0.28, 0.22, 0.07, 0.34, PALETTE.hanSeat);
  // the load: two panniers and a tower of it over the back wheel
  const fcol = [PALETTE.hanFlow1, PALETTE.hanFlow2, PALETTE.hanFlow3, PALETTE.hanFlow4];
  for (let i = 0; i < 26; i++) {
    const a = i * 0.9, rr = 0.30 + (i % 4) * 0.13;
    F.sph(Math.cos(a) * rr, 1.10 + (i % 7) * 0.10, -0.55 + Math.sin(a) * rr * 0.7,
          0.17, 0.15, 0.17, fcol[i % 4], 6);
  }
  F.box(0, 0.62, -0.58, 0.78, 0.42, 0.44, PALETTE.hanBasket);
  const fm = new THREE.Mesh(F.build(), hanVCF());
  fm.castShadow = true;
  fm.position.set(-8, hanGROUND, -4);
  fm.rotation.y = 0.9;
  hanFlowerBike = fm;
  root.add(fm);
  hanBlock(-8, -4, 1.0);

  // ---- the shuttlecock circle, on the lake's west walk ------------------
  for (let i = 0; i < hanCauN; i++) {
    const a = i * (6.283 / hanCauN);
    const P = hanMerger();
    P.box(0, 0.42, 0, 0.34, 0.84, 0.24, PALETTE.hanCauLeg);
    P.box(0, 1.10, 0, 0.42, 0.56, 0.28, i % 2 ? PALETTE.hanWash1 : PALETTE.hanWash3);
    P.box(0, 1.46, 0, 0.20, 0.18, 0.20, PALETTE.hanSkin);
    P.sph(0, 1.64, 0, 0.19, 0.20, 0.19, PALETTE.hanSkin, 8);
    P.sph(0, 1.71, -0.02, 0.20, 0.15, 0.20, PALETTE.hanHair, 6);
    for (let s = -1; s <= 1; s += 2) P.box(s * 0.28, 1.06, 0, 0.11, 0.54, 0.16, PALETTE.hanSkin);
    const pm = new THREE.Mesh(P.build(), hanVCF());
    pm.castShadow = true;
    pm.position.set(hanCAU.x + Math.cos(a) * 3.4, hanGROUND, hanCAU.z + Math.sin(a) * 3.4);
    pm.rotation.y = a + Math.PI;
    root.add(pm);
    hanCauFolk.push({ m: pm, a: a, ph: rand(0, 6.28) });
  }
  const S = hanMerger();
  S.cyl(0, 0.02, 0, 0.055, 0.05, PALETTE.hanCauBase, 0, 0, 0, 8);
  for (let i = 0; i < 4; i++) {
    S.box(0, 0.10, 0, 0.02, 0.18, 0.09, PALETTE.hanCauFeather, 0.2, i * 0.78, 0);
  }
  const sm = new THREE.Mesh(S.build(), hanVCF());
  sm.castShadow = false;
  sm.position.set(hanCAU.x, hanGROUND + 1.4, hanCAU.z);
  hanShuttle = sm;
  root.add(sm);
  hanBlock(hanCAU.x, hanCAU.z, 2.6);

  const m = new THREE.Mesh(K.build(), hanVCF());
  m.castShadow = true; m.receiveShadow = true;
  root.add(m);
  hanPoolDone(game, body);
}

/**
 * THE SHUTTLECOCK. Five people in a ring keeping one thing in the air, and it
 * is the only thing on this map that is neither traffic nor still.
 *
 * Da cau is played with the FEET, so the ball never goes above about three
 * metres and the whole circle rotates on it. Standing in the middle of them is
 * the task, and what happens then is that they keep playing THROUGH you, which
 * is the joke: the rally does not stop for a capybara.
 */
function hanUpdateCau(game, dt) {
  if (!hanShuttle) return;
  hanCauT += dt;
  const leg = 1.35;
  const k = (hanCauT % leg) / leg;
  // WHERE IT LANDED, NOT WHERE THE CLOCK SAYS. Both ends used to be derived
  // from hanCauT independently: `to` skipped a player on alternate rounds
  // while `from` only ever advanced by one, so on five legs in every ten the
  // shuttle started three metres from where it had just been caught and the
  // kick animation fired on somebody who never touched it.
  const legI = Math.floor(hanCauT / leg);
  if (hanCauLeg < 0) {
    hanCauLeg = legI;
  } else if (legI !== hanCauLeg) {
    // Walk the chain forward one leg at a time. Capped, because a backgrounded
    // tab can hand this a very large jump and the rally is ambient either way.
    const steps = Math.min(legI - hanCauLeg, hanCauN * 2);
    for (let s = 0; s < steps; s++) {
      hanCauFrom = hanCauTo;
      // every full round the circle switches between passing to a neighbour
      // and passing across it, which is what the round counter is for
      const across = Math.floor((legI - steps + 1 + s) / hanCauN) % 2;
      hanCauTo = (hanCauFrom + 1 + across) % hanCauN;
    }
    hanCauLeg = legI;
  }
  const from = hanCauFrom, to = hanCauTo;
  const a0 = from * (6.283 / hanCauN), a1 = to * (6.283 / hanCauN);
  const x0 = hanCAU.x + Math.cos(a0) * 3.0, z0 = hanCAU.z + Math.sin(a0) * 3.0;
  const x1 = hanCAU.x + Math.cos(a1) * 3.0, z1 = hanCAU.z + Math.sin(a1) * 3.0;
  hanShuttle.position.set(lerp(x0, x1, k), hanGROUND + 0.55 + Math.sin(k * Math.PI) * 2.1,
                          lerp(z0, z1, k));
  hanShuttle.rotation.set(Math.sin(hanCauT * 6) * 0.4, hanCauT * 3, 0);
  for (let i = 0; i < hanCauFolk.length; i++) {
    const f = hanCauFolk[i];
    const kick = (i === from && k < 0.18) ? 1 - k / 0.18 : 0;
    f.m.position.y = hanGROUND + kick * 0.16;
    f.m.rotation.y = f.a + Math.PI + Math.sin(hanTime * 1.4 + f.ph) * 0.18 - kick * 0.4;
  }
  if (k < dt * 2 && hanGame) {
    hanCue('tick', hanShuttle.position.x, hanShuttle.position.y, hanShuttle.position.z,
           0.16, rand(2.6, 3.4), 60);
  }
  const capy = game.capy;
  if (!hanCauDone && capy && capy.position) {
    const p = capy.position;
    if (Math.hypot(p.x - hanCAU.x, p.z - hanCAU.z) < 2.6 && capy.grounded) {
      hanQuietT += dt;
      if (hanQuietT > 4.5) {
        hanCauDone = true;
        hanTask('shuttlecock');
        if (typeof game.punch === 'function') game.punch(0.20);
        hanToast('nobody has dropped it. nobody has mentioned you either.');
      }
    } else hanQuietT = 0;
  }
}

// ============================================================== THE PEOPLE ===
/**
 * SIXTY-FOUR OF THEM ON THE PAVEMENTS, plus the eight who talk.
 *
 * The instanced crowd does one thing that no other crowd in this game does: it
 * SITS. Half of them are on a stool at eighteen centimetres, facing a wall,
 * eating; the rest are walking, and the walkers are the only ones that move.
 * That ratio is the whole of what a Hanoi pavement looks like and it costs one
 * draw call.
 */
const hanFOLK_COL = ['hanCrowdA', 'hanCrowdB', 'hanCrowdC', 'hanCrowdD', 'hanCrowdE'];
function hanFolkGeo(shirt, hat) {
  const K = hanMerger();
  K.box(0, 0.40, 0, 0.32, 0.80, 0.22, PALETTE.hanCrowdLeg);
  K.box(0, 1.06, 0, 0.42, 0.54, 0.26, shirt);
  K.box(0, 1.40, 0, 0.19, 0.18, 0.19, PALETTE.hanSkin);
  K.sph(0, 1.57, 0, 0.18, 0.19, 0.18, PALETTE.hanSkin, 6);
  K.sph(0, 1.64, -0.02, 0.19, 0.14, 0.19, PALETTE.hanHair, 6);
  for (let s = -1; s <= 1; s += 2) K.box(s * 0.27, 1.02, 0, 0.10, 0.50, 0.14, shirt);
  // ...and the non la, which about a third of them are wearing
  if (hat) K.cone(0, 1.76, 0, 0.34, 0.26, PALETTE.hanConical, 0, 0, 0, 8);
  return K.build();
}
function hanBuildFolk(game, root) {
  hanInitLanes();
  hanFolkData = new Float32Array(hanFOLK_N * 6);   // lane s dir speed sit phase
  for (let i = 0; i < hanFOLK_N; i++) {
    const L = randInt(0, hanLANES.length - 1);
    hanFolkData[i * 6] = L;
    hanFolkData[i * 6 + 1] = rand(0, hanLaneTotal[L]);
    hanFolkData[i * 6 + 2] = (i & 1) ? 1 : -1;
    hanFolkData[i * 6 + 3] = rand(0.8, 1.5);
    hanFolkData[i * 6 + 4] = Math.random() < 0.5 ? 1 : 0;
    hanFolkData[i * 6 + 5] = rand(0, 6.28);
  }
  // ten variants: five shirts, with and without the hat. See the note at the
  // top of this block for why this is not one mesh with an instanceColor.
  for (let v = 0; v < 10; v++) {
    const idx = [];
    for (let i = 0; i < hanFOLK_N; i++) if (i % 10 === v) idx.push(i);
    hanFolkGroups.push(idx);
    const mm = new THREE.InstancedMesh(hanFolkGeo(PALETTE[hanFOLK_COL[v % 5]], v >= 5),
                                       hanVCF(), Math.max(1, idx.length));
    mm.count = idx.length;
    mm.castShadow = true; mm.receiveShadow = false;
    mm.frustumCulled = false;
    hanFolkMeshes.push(mm);
    root.add(mm);
  }
  hanFolkBodies = game && typeof game.addCrowdBodies === 'function'
    ? game.addCrowdBodies({ n: hanFOLK_N, at: hanFolkFoot, moving: true })
    : null;
  hanUpdateFolk(0);
}

// ---------------------------------------------------------------------------
// ...AND SEVENTY OF THEM ARE THERE (v36)
//
// `qa/CROWDS.md` measured Hanoi's ten `hanFolk` variants at 8% solid — the
// worst reading of the six chapters it left open, in the chapter whose entire
// argument is that the street is full of people who are not going to stop for
// you. The pavement was a mural.
//
// They walk their lanes, so it is one box each and a `step()` in the update.
// TWO THINGS THIS HAS TO GET RIGHT AND BOTH ARE JUST "READ THE DRAW":
//
//  - the sitters are lower. A person on a plastic stool is drawn at
//    hanGROUND − 0.52 and scaled to two thirds, and a box standing at
//    hanGROUND would put a head-height wall over somebody eating soup.
//  - the offset is the pavement, not the lane. `off` is the same expression
//    the draw uses, so nobody acquires a body out in the traffic — which
//    would be the one thing that could make `cross-the-road` harder, and it
//    does not.
// ---------------------------------------------------------------------------
function hanFolkFoot(i, out) {
  if (!hanFolkData) return false;
  const o = i * 6;
  const L = hanFolkData[o] | 0;
  const sit = hanFolkData[o + 4] > 0.5;
  hanLaneAtS(L, hanFolkData[o + 1], hanTmp);
  const nx = Math.cos(hanTmp.yaw), nz = -Math.sin(hanTmp.yaw);
  const off = (i & 2 ? 1 : -1) * (hanLANES[L].w + (sit ? 2.9 : 1.7));
  out.x = hanTmp.x + nx * off;
  out.y = hanGROUND - (sit ? 0.52 : 0);
  out.z = hanTmp.z + nz * off;
  return true;
}
function hanUpdateFolk(dt) {
  if (!hanFolkMeshes.length) return;
  if (hanFolkWheek > 0) hanFolkWheek -= dt;
  // ---- AND IT CUTS (the house rule) ------------------------------------
  // Every term added to the picture in this repository carries a state flag
  // that removes it, so it can be measured against its own absence rather
  // than against a memory of last week. game.state.noNotice is that flag for
  // the whole D1 crowd term, in all four chapters that carry one.
  const capy = hanGame && hanGame.capy;
  const cp = (hanGame && hanGame.state && hanGame.state.noNotice)
           ? null : (capy && capy.position);
  const notR = hanNOT_R * (hanFolkWheek > 0 ? hanNOT_WHEEK_K : 1);
  const notR2 = notR * notR;
  for (let v = 0; v < hanFolkMeshes.length; v++) {
   const idx = hanFolkGroups[v], mm = hanFolkMeshes[v];
   for (let k = 0; k < idx.length; k++) {
    const i = idx[k];
    const o = i * 6;
    const L = hanFolkData[o] | 0;
    const sit = hanFolkData[o + 4] > 0.5;
    if (!sit) {
      hanFolkData[o + 1] += hanFolkData[o + 3] * hanFolkData[o + 2] * dt;
      const total = hanLaneTotal[L];
      if (hanLANES[L].closed) hanFolkData[o + 1] = ((hanFolkData[o + 1] % total) + total) % total;
      else if (hanFolkData[o + 1] > total || hanFolkData[o + 1] < 0) hanFolkData[o + 2] *= -1;
    }
    hanLaneAtS(L, hanFolkData[o + 1], hanTmp);
    const nx = Math.cos(hanTmp.yaw), nz = -Math.sin(hanTmp.yaw);
    // ON THE PAVEMENT, and the sitters are further out and facing the wall
    const off = (i & 2 ? 1 : -1) * (hanLANES[L].w + (sit ? 2.9 : 1.7));
    let yaw = sit ? (hanTmp.yaw + (off > 0 ? Math.PI / 2 : -Math.PI / 2))
                  : (hanFolkData[o + 2] > 0 ? hanTmp.yaw : hanTmp.yaw + Math.PI);
    // ---- ...UNLESS SOMETHING IS GOING PAST THAT IS NOT A MOPED (D1) ----
    // The drawn position is computed below from the lane and is NOT touched:
    // hanFolkBodies.step() puts each box where its walker went, and a figure
    // that is drawn off its own collider is worse than one that does not move.
    if (cp) {
      const fx = hanTmp.x + nx * off, fz = hanTmp.z + nz * off;
      const ndx = cp.x - fx, ndz = cp.z - fz;
      const nd2 = ndx * ndx + ndz * ndz;
      const want = nd2 < notR2 ? clamp((notR - Math.sqrt(nd2)) / hanNOT_EDGE, 0, 1) : 0;
      const not = damp(hanFolkNot[i], want, hanNOT_L, dt);
      hanFolkNot[i] = not;
      if (not > 0.004) {
        let d = Math.atan2(ndx, ndz) - yaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        yaw += d * not * (sit ? hanNOT_SIT : hanNOT_WALK);
      }
    }
    const bob = sit ? 0 : Math.abs(Math.sin(hanTime * 3.4 + hanFolkData[o + 5])) * 0.045;
    hanE.set(0, yaw, 0, 'YXZ');
    hanM.compose(hanV3.set(hanTmp.x + nx * off, hanGROUND + bob - (sit ? 0.52 : 0),
                           hanTmp.z + nz * off),
                 hanQ.setFromEuler(hanE), hanSc.set(1, sit ? 0.66 : 1, 1));
    mm.setMatrixAt(k, hanM);
   }
   mm.instanceMatrix.needsUpdate = true;
  }
  // ...and every box goes where its walker went. After the loop that advanced
  // `hanFolkData`, so the two read the same `s`.
  if (hanFolkBodies) hanFolkBodies.step();
}

/** The lanterns, over the lake walk and the puppet theatre. */
function hanBuildLanterns(root) {
  const K = hanMerger();
  K.cyl(0, 0, 0, 0.17, 0.30, PALETTE.hanLantern, 0, 0, 0, 8);
  K.cyl(0, 0.17, 0, 0.07, 0.08, PALETTE.hanLanternDk, 0, 0, 0, 6);
  K.cyl(0, -0.17, 0, 0.06, 0.08, PALETTE.hanLanternDk, 0, 0, 0, 6);
  K.box(0, 0.30, 0, 0.03, 0.28, 0.03, PALETTE.hanLanternDk);
  // IT IS TEN IN THE MORNING. At 0.35 of emissive under a white sky these
  // came out as pink barrels a metre across, which is what an emissive term
  // does when there is nothing for it to be brighter THAN. A lantern in
  // daylight is a red paper object, and that is all it is.
  const m = new THREE.InstancedMesh(K.build(),
    grain(mat(0xffffff, { vertexColors: true, emissive: 0xffffff, emissiveIntensity: 0.10 }),
          { amount: 0 }), 60);
  m.castShadow = false; m.receiveShadow = false;
  m.frustumCulled = false;
  m.userData.noShadow = true;
  let n = 0;
  for (let i = 0; i < 36 && n < 60; i++) {
    const a = i / 36 * 6.283;
    const x = hanLAKE.cx + Math.cos(a) * (hanLAKE.rx + 5), z = hanLAKE.cz + Math.sin(a) * (hanLAKE.rz + 5);
    if (hanTerrain(x, z) < hanWATER + 0.3) continue;
    hanM.compose(hanV3.set(x, hanGROUND + 3.2, z), hanQ.identity(), hanSc.set(1, 1, 1));
    m.setMatrixAt(n++, hanM);
  }
  for (let i = 0; i < 12 && n < 60; i++) {
    hanM.compose(hanV3.set(hanPUPPET.x - 8 + i * 1.5, hanGROUND + 3.6, hanPUPPET.z + 2.4),
                 hanQ.identity(), hanSc.set(1, 1, 1));
    m.setMatrixAt(n++, hanM);
  }
  for (let i = 0; i < 12 && n < 60; i++) {
    hanM.compose(hanV3.set(hanHUC.x0 - 2 + i * 1.4, hanGROUND + 4.2, hanHUC.z0 + 1.2),
                 hanQ.identity(), hanSc.set(1, 1, 1));
    m.setMatrixAt(n++, hanM);
  }
  m.count = n;
  m.instanceMatrix.needsUpdate = true;
  hanLanternMesh = m;
  root.add(m);
}

// ================================================================ LOCALS =====
/**
 * SEVEN PEOPLE, AND EVERY ONE OF THEM IS SITTING DOWN.
 *
 * That is the chapter's line on itself. In eighteen places the locals have
 * stood on a jetty, a quay, a plaza or a beach and looked at the animal; here
 * the entire population is on an eighteen-centimetre stool facing a wall with a
 * bowl in their hands, and a capybara is the fourth strangest thing to come
 * down that pavement this morning.
 *
 * Every anchor is probed against terrainHeight rather than guessed.
 */
function hanBuildLocals(game) {
  if (typeof game.addLocal !== 'function') return;
  const put = function (x, z, o) {
    const h = hanTerrain(x, z);
    if (h < hanWATER + 0.3) {
      console.warn('[hanoi] local at', x, z, 'is in the lake (' + h.toFixed(2) + ') - skipped');
      return null;
    }
    o.biome = 'hanoi';
    o.x = x; o.z = z; o.y = h;
    // ...through addTraveller if this is the one who keeps turning up, so
    // the terrain probe above still runs for them. See THE TRAVELLER.
    if (o.trav && typeof game.addTraveller === 'function') {
      delete o.trav;
      return game.addTraveller(o);
    }
    delete o.trav;
    return game.addLocal(o);
  };

  // ---- ...AND THE LAST TIME (P6). See THE TRAVELLER in npc.js. ---------
  // Four chapters and about six months of their life. The joke only pays
  // here, and it only pays if the three before it were quiet about it.
  put(9, 19, {
    face: -2.6,
    trav: true,
    lines: ['Right. I am not even going to say it.',
            'Four countries. Four. I have counted.',
            'Are you following me or am I following you?',
            { t: 'Whatever you did in that cave, I heard about it in Laos.', after: 'to-cave' }],
    wheek: ['Yeah. All right. Yeah.'] });
  hanLocPho = put(12, 14, {
    figure: { shirt: PALETTE.hanWash1, hat: PALETTE.hanConical }, face: -2.2, near: 8,
    // ---- AND WHAT THEY SAY CHANGES (v30) -------------------------------
    // Chapter 19 shipped with no conditional line in it at all. `onTask`
    // fires once and is gone, so the woman who watched you put your whole
    // face in her pho greeted you afterwards exactly as she had before.
    // the ladle, into the bowl, all morning
    beat: { kind: 'work', every: 4.4, dur: 0.85, sfx: 'bowls', volume: 0.11, tool: 'phobowl' },  // B12: the ladle needs a bowl at the end of it
    lines: ['Sit. There is a stool. There is always a stool.',
            'You are in the way of the bikes. Everybody is in the way of the bikes.',
            'It is beef. It is always beef before eleven.',
            { t: 'You do not cross by waiting. Nobody has ever crossed by waiting.', before: 'cross-the-road' },
            { t: 'You walked straight through it. Like somebody who lives here.', after: 'cross-the-road' },
            { t: 'It is too hot. Everybody says that and everybody burns their mouth.', before: 'pho-raid' },
            { t: 'The whole face. I have seen a lot and I have not seen the whole face.', after: 'pho-raid' }],
    wheek: ['Yes. Very good. Sit down.'],
    onTask: { 'cross-the-road': ['You did not stop. Good.'] },
  });
  hanLocBia = put(hanBIA.x - 4.5, hanBIA.z + 3.5, {
    figure: { shirt: PALETTE.hanWash3 }, face: -0.7, near: 9,
    // the tap, and the glass under it
    beat: { kind: 'work', every: 6.0, dur: 0.8, sfx: 'pop', volume: 0.09, pitch: 1.2, tool: 'coffee' },  // B12: the tap, and the glass under it
    lines: ['Four thousand a glass. It has been four thousand since 1994.',
            'Do not knock the stools over. Everybody knocks the stools over.',
            'That corner has been like this since my grandmother.',
            { t: 'Ninety-six stools. I count them at close. Do not.', before: 'the-stools' },
            { t: 'Ninety-six. I counted. You owe me an evening.', after: 'the-stools' },
            { t: 'You have been on a scooter. Somebody is missing a scooter.', after: 'ride-the-flow' }],
    wheek: ['Mot hai ba, YO.'],
    onTask: { 'the-stools': ['I said do not. Nobody has ever not.'] },
  });
  hanLocRail = put(hanTRAIN.x1 - 12, hanTRAIN.z + 3.6, {
    figure: { shirt: PALETTE.hanWash2, hat: PALETTE.hanConical }, face: 3.0, near: 10,
    lines: ['Twice a day. You get used to it. You do not get used to it.',
            'When the horn goes, get in a doorway. Any doorway.',
            'Forty-five centimetres. I have measured it. Twice.',
            { t: 'When it comes, the whole street folds up. Watch the awnings.', before: 'fold-the-street' },
            { t: 'You saw it fold. Everybody should see it fold once.', after: 'fold-the-street' },
            { t: 'The old bridge still walks. It does not drive any more.', before: 'long-bien' },
            { t: 'You walked out on the old bridge. That is the whole century, that walk.', after: 'long-bien' }],
    wheek: ['Not now. In a minute you will want to be quiet.'],
    onTask: { 'the-train': ['I saw where you were standing. Do not do it again.'] },
  });
  hanLocFlower = put(-8, -7.5, {
    // D2: a flower seller with a bicycle sells them by pushing it round the
    // quarter; hers was parked and so was she.
    walk: { dx: 0, dz: 9, dwell: 4.5 },
    figure: { shirt: PALETTE.hanWash4, hat: PALETTE.hanConical }, face: 0.4, near: 8,
    // tying them, which is two hands
    beat: { kind: 'reach', every: 6.4, dur: 1.2, tool: 'flowers' },  // B12: tying them, and they are the thing being tied
    lines: ['Lotus in the morning, chrysanthemum after. Nothing after four.',
            'The whole shop is on the bicycle. It has to be.',
            'Do not lean on it. Please do not lean on it.',
            { t: 'It is balanced. It took me eleven years to learn how balanced.', before: 'flower-bike' },
            { t: 'You unloaded it. I did not ask you to unload it.', after: 'flower-bike' },
            { t: 'There is coffee on a balcony somewhere that is not where it was.', after: 'egg-coffee' }],
    wheek: ['Everything on that bicycle is somebody’s Tuesday.'],
  });
  hanLocBarber = put(hanBARBER.x + 2.6, hanBARBER.z + 1.2, {
    figure: { shirt: PALETTE.hanShirtW }, face: -1.6, near: 7,
    // the scissors, on the pavement, in a mirror on a wall
    beat: { kind: 'work', every: 2.4, dur: 0.6, sfx: 'tick', volume: 0.08, pitch: 1.5 },
    lines: ['Sit. Twenty minutes. You will look completely different.',
            'The mirror has been on that tree for thirty-one years.',
            'I do not do animals. I have never been asked.',
            { t: 'Look in it. Everybody looks in it. That is what it is for.', before: 'barber' },
            { t: 'You looked. Thirty-one years and that is the first time it has done THAT.', after: 'barber' }],
    wheek: ['You do not need a haircut. You need a WASH.'],
  });
  hanLocPuppet = put(hanPUPPET.x - 7, hanPUPPET.z + 2.8, {
    figure: { shirt: PALETTE.hanWash1 }, face: -0.2, near: 9,
    lines: ['They are standing in the water. The people are standing in the water.',
            'Eleven hundred years. Nobody knows who started it.',
            'You may look. You may not get in.',
            { t: 'The red bridge is that way. Everybody photographs the red bridge.', before: 'the-huc' },
            { t: 'You crossed the Huc. Now you have to come back over it.', after: 'the-huc' },
            { t: 'The tower is on the island. There is no boat.', before: 'turtle-tower' },
            { t: 'You got out to the tower. There is no boat. I am not asking.', after: 'turtle-tower' }],
    wheek: ['The dragon does that too. It is not as good at it.'],
    onTask: { 'water-puppets': ['I did say.'] },
  });
  hanLocMarket = put(hanMARKET.x + 19, hanMARKET.z - 2, {
    figure: { shirt: PALETTE.hanWash3, hat: PALETTE.hanConical }, face: -1.5708, near: 9,
    // the cleaver, and it is six in the morning somewhere
    beat: { kind: 'work', every: 3.4, dur: 0.7, sfx: 'cleaver', volume: 0.12, pitch: 0.95 },
    lines: ['Everything here was alive at six. Some of it still is.',
            'Herbs at the front, fish at the back. Follow your nose.',
            'You are the largest thing in this market and you are not for sale.',
            { t: 'They play da cau by the lake. You will not get in the circle.', before: 'shuttlecock' },
            { t: 'They let you in the circle. They do not let ME in the circle.', after: 'shuttlecock' },
            { t: 'The whole market heard about the train alley. The whole market.', after: 'the-train' }],
    wheek: ['Yes yes. Everybody has an opinion.'],
  });

  // ---- ...AND TWO ON THE LAKE WALL, WHERE THE PLAYER LANDS (B5) ----------
  //
  // MEASURED: Hanoi was the only chapter in the game with nobody within
  // twenty-six metres of its spawn and nothing loose within sixteen. Every
  // local above is ninety-odd metres away round the lake, and the two hundred
  // and forty bikes are an instanced crowd — not one of them can witness
  // anything. So the incident chain, which refuses outright when nobody sees,
  // was dead for the whole walk in, in a chapter whose arrival line is "seven
  // million people and six million of them are on a moped".
  //
  // The lake wall is where Hanoi sits down, so that is what these two are
  // doing. They face the ROAD, which is the thing the chapter is about and the
  // thing the player is looking at over their shoulder on the arrival frame.
  put(-56, -71, {
    figure: { shirt: PALETTE.hanWash2, hat: PALETTE.hanConical }, face: 1.9, near: 9,
    // the fan, all morning, because it is that kind of morning
    beat: { kind: 'idle', every: 5.2, dur: 1.1 },
    lines: ['Sit down. Everybody sits down here. It is the only flat thing.',
            'You are watching the road. Everybody watches the road.',
            'Do not run at it. Running is how you get hit.',
            { t: 'Go on then. Walk. Do not stop.', before: 'cross-the-road' },
            { t: 'You walked it. You did not even look. Very good.', after: 'cross-the-road' }],
    wheek: ['Yes. Loud. We heard.'],
  });
  put(-63, -73.5, {
    figure: { shirt: PALETTE.hanWash1 }, face: 2.4, near: 8,
    lines: ['Tea. It is always tea. It is too hot for tea and it is always tea.',
            'That is a lot of animal for one stool.',
            'The lake is that way and it is green. That is all the lake does.',
            { t: 'The pho is round the other side. Follow the smell, not me.', before: 'pho-raid' }],
    wheek: ['Ha. All right.'],
  });

  if (typeof game.addExchange === 'function' && hanLocPho && hanLocBia) {
    game.addExchange({ biome: 'hanoi', a: hanLocPho, b: hanLocBia, gap: 28, lines: [
      ['There is a very large rodent on the pavement.', 'There is a very large rodent on every pavement.'],
      ['It crossed the road.', 'Standing still?'],
      ['Walking. It just walked.', 'Then it is not a tourist.'],
      ['Somebody should tell the trains.', 'Somebody should tell the trains a lot of things.'],
      ['Four thousand.', 'It is always four thousand.'],
    ] });
  }
}

/** The wheek. It does one thing here, and it is not being polite. */
function hanWheek(game) {
  // THE GATE. This is on the global 'capy:wheek' and is never taken off it, so
  // without this line a wheek anywhere in the game ran Hanoi's position tests
  // against the live capybara — and the chapters share a coordinate space. In
  // another world standing at the alley's numbers it answered with Hanoi's
  // bells, fired the train toast and burned the one-shot hanToldFlow, so the
  // instruction was spent before you ever arrived. Every other chapter's wheek
  // handler opens with exactly this (cave.js, antarctic.js, pantanal.js).
  if (!game.biome.isActive('hanoi')) return;
  const capy = game.capy;
  if (!capy || !capy.position) return;
  const p = capy.position;
  // ...and on the pavement it is a noise, so heads come round further and for
  // longer than a walk-past earns. See hanUpdateFolk (D1).
  hanFolkWheek = hanNOT_WHEEK;
  // in the traffic it is a HORN, and horns are answered
  if (hanLaneAt(p.x, p.z) < hanLaneW + 2 && hanBikeN) {
    let n = 0;
    for (let i = 0; i < hanBikeN; i += 3) {
      hanBikeAt(i, hanV3b);
      const d = Math.hypot(hanV3b.x - p.x, hanV3b.z - p.z);
      if (d < 34) {
        n++;
        hanCue('bark', hanV3b.x, hanV3b.y, hanV3b.z, clamp(0.28 - d * 0.006, 0.05, 0.28),
               rand(1.9, 3.3), 80);
      }
      if (n > 9) break;
    }
    if (n > 3 && !hanToldHorn) {
      hanToldHorn = true;
      hanToast('everybody answered. that is what a horn is FOR here.');
    }
  }
  // ...and in the alley, ten seconds before a train, it is a very bad idea
  if (hanTrainS >= 0 && hanInRect(hanZ.alley, p.x, p.z)) {
    hanToast('nobody can hear you. there is a train.');
  }
}

// ================================================================ TASKS ======
function hanUpdateTasks(game, dt) {
  const capy = game.capy;
  if (!capy || !capy.position) return;
  const p = capy.position;

  if (!hanArrived) {
    hanArrived = true;
    if (game.biome && game.biome.current === 'hanoi') hanTask('to-hanoi');
  }

  // ---- the red bridge ---------------------------------------------------
  if (!hanHucDone) {
    const bx = (hanHUC.x0 + hanHUC.x1) / 2, bz = (hanHUC.z0 + hanHUC.z1) / 2;
    if (Math.hypot(p.x - bx, p.z - bz) < 5 && p.y > hanGROUND + 1.1) {
      hanHucDone = true;
      hanTask('the-huc');
      hanToast('the bridge of the morning sunlight, and it is a hundred and thirty years old.');
    }
  }
  // ---- the tower on the islet ------------------------------------------
  if (!hanTowerDone && Math.hypot(p.x - hanTOWER.x, p.z - hanTOWER.z) < 7.5 &&
      p.y > hanGROUND && capy.grounded) {
    hanTowerDone = true;
    hanTask('turtle-tower');
    if (typeof game.punch === 'function') game.punch(0.24);
    hanToast('there is supposed to be a turtle under there. there was, until 2016.');
  }
  // ---- the old bridge ---------------------------------------------------
  if (!hanBridgeDone && hanInRect(hanZ.bridge, p.x, p.z) && p.z > hanBRIDGE.z0 + 24 &&
      p.y > hanGROUND + 4) {
    hanBridgeDone = true;
    hanTask('long-bien');
    hanToast('nineteen hundred and two, and it is still the only way across on foot.');
  }
  // ---- the barber's mirror ---------------------------------------------
  if (!hanMirrorDone && Math.hypot(p.x - (hanBARBER.x + 1.2), p.z - hanBARBER.z) < 3.0 &&
      p.y < hanGROUND + 2.6) {
    hanMirrorDone = true;
    hanTask('barber');
    hanSfx('pop', { volume: 0.4, pitch: 1.6 });
    hanToast('it has been looked into by thirty-one years of Hanoi and never by that.');
  }
  // ---- the flower bicycle ----------------------------------------------
  if (!hanFlowerDone && hanFlowerBike) {
    for (let i = 0; i < hanFlowerProps.length; i++) {
      if (hanFlowerProps[i] && hanFlowerProps[i].held) {
        hanFlowerDone = true;
        hanTask('flower-bike');
        hanToast('that was somebody’s whole Tuesday.');
        break;
      }
    }
  }
  // ---- the pho and the egg coffee --------------------------------------
  if (hanPhoProp && !hanPhoGone && hanPhoProp.held) {
    hanPhoGone = true;
    hanTask('pho-raid');
    hanSfx('splash', { volume: 0.4, pitch: 1.5 });
    hanToast('it is a big bowl. you are a big rodent. it works out.');
  }
  if (hanCoffeeProp && !hanCoffeeGone && hanCoffeeProp.held) {
    hanCoffeeGone = true;
    hanTask('egg-coffee');
    hanToast('there is an egg in it. that is not a mistake.');
  }
  // ---- the first thing the chapter says about itself --------------------
  if (!hanToldLake && Math.hypot(p.x - hanLAKE.cx, p.z - hanLAKE.cz) <
      Math.max(hanLAKE.rx, hanLAKE.rz) + 8 && hanTime > 3) {
    hanToldLake = true;
    hanToast('inside the ring road it is quiet. that is the only rule this city has.');
  }
}

// ============================================================== AMBIENCE =====
/**
 * WHAT THIS PLACE SOUNDS LIKE, and it is the loudest bed in the game.
 *
 * Two hundred and forty two-stroke engines, a horn about once a second
 * somewhere, and about four hundred people talking. The horns come out of
 * hanUpdateBikes, positioned; this is everything else, and it changes in three
 * places: on the lake walk it drops away to birds and a shuttlecock, in the
 * alley it is nearly silent until it very much is not, and in the market it is
 * all voices.
 */
function hanUpdateAmbience(game, dt) {
  hanAmbT -= dt;
  const capy = game.capy;
  const p = capy && capy.position;
  if (!p) return;
  // the engines. Always, from wherever the nearest few are: this is the bed.
  if (hanBikeN && Math.random() < dt * 7) {
    const i = randInt(0, hanBikeN - 1);
    hanBikeAt(i, hanV3b);
    const d = Math.hypot(hanV3b.x - p.x, hanV3b.z - p.z);
    if (d < 70) {
      hanCue('hiss', hanV3b.x, hanV3b.y, hanV3b.z, clamp(0.16 - d * 0.0018, 0.02, 0.16),
             rand(0.7, 1.4), 90);
    }
  }
  if (hanAmbT > 0) return;
  const onLake = Math.hypot(p.x - hanLAKE.cx, p.z - hanLAKE.cz) <
                 Math.max(hanLAKE.rx, hanLAKE.rz) + 6;
  const inAlley = hanInRect(hanZ.alley, p.x, p.z);
  const inMkt = hanInRect(hanZ.market, p.x, p.z);
  const r = Math.random();
  if (inAlley && hanTrainS < 0) {
    // the quietest place in the chapter, and it is nine metres from the loudest
    if (r < 0.4) hanCue('tick', p.x + rand(-8, 8), p.y + 2, p.z + rand(-4, 4), rand(0.05, 0.10), rand(1.8, 2.6));
    else if (r < 0.75) hanCue('rustle', p.x + rand(-9, 9), p.y, p.z + rand(-4, 4), rand(0.05, 0.10), rand(1.1, 1.6));
    else hanCue('pop', p.x + rand(-10, 10), p.y, p.z + rand(-4, 4), rand(0.04, 0.09), rand(1.4, 2.2));
    hanAmbT = rand(2.2, 5.5);
  } else if (onLake) {
    if (r < 0.34) hanCue('gull', p.x + rand(-24, 24), p.y + 8, p.z + rand(-24, 24), rand(0.05, 0.10), rand(1.9, 2.6));
    else if (r < 0.62) hanCue('rustle', p.x + rand(-14, 14), p.y + 3, p.z + rand(-14, 14), rand(0.05, 0.11), rand(0.9, 1.4));
    else if (r < 0.84) hanCue('splash', hanLAKE.cx + rand(-30, 30), hanWATER, hanLAKE.cz + rand(-20, 20), rand(0.04, 0.09), rand(0.9, 1.4));
    else hanCue('chime', hanNGOC.x, hanGROUND + 5, hanNGOC.z, rand(0.05, 0.10), rand(0.8, 1.1));
    hanAmbT = rand(3, 8);
  } else if (inMkt) {
    if (r < 0.5) hanCue('bark', p.x + rand(-16, 16), p.y + 1, p.z + rand(-10, 10), rand(0.06, 0.12), rand(1.2, 1.9));
    else if (r < 0.8) hanCue('rustle', p.x + rand(-14, 14), p.y, p.z + rand(-9, 9), rand(0.06, 0.12), rand(1.0, 1.5));
    else hanCue('pop', p.x + rand(-12, 12), p.y, p.z + rand(-9, 9), rand(0.05, 0.10), rand(1.6, 2.4));
    hanAmbT = rand(1.4, 3.6);
  } else {
    if (r < 0.30) hanCue('bark', p.x + rand(-20, 20), p.y + 1, p.z + rand(-20, 20), rand(0.05, 0.11), rand(1.3, 2.1));
    else if (r < 0.56) hanCue('tick', p.x + rand(-16, 16), p.y + 3, p.z + rand(-16, 16), rand(0.04, 0.09), rand(2.0, 3.0));
    else if (r < 0.80) hanCue('rustle', p.x + rand(-16, 16), p.y, p.z + rand(-16, 16), rand(0.05, 0.10), rand(1.0, 1.6));
    else hanCue('pop', p.x + rand(-18, 18), p.y, p.z + rand(-18, 18), rand(0.05, 0.10), rand(1.5, 2.3));
    hanAmbT = rand(1.6, 4.2);
  }
}

// ============================================================== THE BUILD ====
// THE SPAWN. On the south-west walk of Hoan Kiem, five metres off the ring
// road, facing north-east across the water at the tower.
//
// It has BOTH halves of the chapter in one frame and that is why it is here:
// eighty metres of still green water in front of you, and the traffic going
// past your shoulder. The first version of it was at (-44, -74), which is
// inside the lake — swept for, this time, against terrainHeight, navBlocked
// and the traffic test rather than picked off the map, which is what chapter
// 18 learned the hard way after four spawns inside four different objects.
const hanSPAWN = { x: -60, y: 2.4, z: -78 };

let hanSpawned = false;

// ============================================================== SCATTER ======
/**
 * THE BUSIEST STREET IN THE GAME HAD NOTHING LYING ON IT.
 *
 * Counted across the chapters, the Pantanal puts down twenty-five separate
 * scatters and Circular Quay sixteen; Hanoi and Monte Carlo had ZERO. On this
 * chapter that is the most conspicuous of the two, because the Old Quarter is
 * the one place in the game whose whole character is CLUTTER — and every last
 * piece of it was above ankle height.
 *
 * Three things, and they are sorted by where the city puts them:
 *   - LEAF LITTER and scraps of packaging on the pavement, which is swept into
 *     the gutter and never further;
 *   - GRIT on the carriageway, which is the surface with the near-field grain on
 *     it and nothing else;
 *   - WEED at the kerb line and on the dyke, which is the only unswept ground
 *     in the chapter.
 *
 * Quads, not boxes: a leaf lying flat has no side anybody can see from six
 * metres up, so two triangles buys what twelve would. The layout is the
 * Pantanal's jittered grid with a PER-CELL budget — never a global cap tested
 * inside a spatial sweep, which truncates the map geographically and in silence.
 */
function hanBuildScatter(root) {
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
  // ...AND THE LITTER STOPPED WHERE THE CITY USED TO (integrity 9). This
  // rectangle was the Old Quarter's, so the pavement south and west of Hoan
  // Kiem — which is where the chapter puts the player down — had not one leaf,
  // one weed or one scrap of grit on it. That is most of what made the walk out
  // of the spawn read as a sheet rather than as a street.
  const X0 = -124, X1 = 124, Z0 = -128, Z1 = 185, CELL = 3.4;
  const NX = Math.ceil((X1 - X0) / CELL), NZ = Math.ceil((Z1 - Z0) / CELL);
  const leaf = [], scrap = [], grit = [], weed = [];
  for (let gz = 0; gz < NZ; gz++) {
    for (let gx = 0; gx < NX; gx++) {
      const per = 1 + ((gx * 5 + gz * 11) % 3);
      for (let k = 0; k < per; k++) {
        const x = X0 + (gx + rand(0.05, 0.95)) * CELL;
        const z = Z0 + (gz + rand(0.05, 0.95)) * CELL;
        const h = hanTerrain(x, z);
        if (h < hanWATER + 0.3) continue;                 // Hoan Kiem and the river
        const d = hanLaneAt(x, z);
        const w0 = hanLaneW;
        if (d < w0 - 0.6) {
          // the carriageway. Grit only, and not much of it.
          if (k & 1) continue;
          const w = rand(0.10, 0.20);
          grit.push(x, h + 0.05, z, 0, rand(0, 6.283), 0, w, 1, w * rand(0.6, 1.0));
        } else if (d < w0 + 1.6) {
          // the kerb line, which is where everything the city sweeps ends up
          const s2 = rand(0.20, 0.42);
          if (k % 3 === 0) weed.push(x, h, z, 0, rand(0, 6.283), 0, s2 * 0.9, s2, s2 * 0.9);
          else {
            const w = rand(0.16, 0.30);
            leaf.push(x, h + 0.05, z, 0, rand(0, 6.283), 0, w, 1, w * rand(0.5, 0.8));
          }
        } else {
          // ONE SCRAP IN FIVE, and the rest is leaf. The first pass split it
          // evenly and put a near-white quad on every second cell: the Old
          // Quarter photographed as the morning after a wedding.
          const w = rand(0.15, 0.30);
          (k % 5 === 0 ? scrap : leaf).push(x, h + 0.05, z, 0, rand(0, 6.283), 0, w, 1, w * rand(0.5, 0.85));
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
      im.setMatrixAt(i, hanXform(list[o], list[o + 1], list[o + 2], list[o + 3], list[o + 4],
                                 list[o + 5], list[o + 6], list[o + 7], list[o + 8]));
    }
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    im.castShadow = !!cast;
    im.receiveShadow = false;
    if (!cast) im.userData.noShadow = true;
    // ---- AND THE WEEDS MOVE (v44) ---------------------------------------
    // See THE WAKE in shared.js. Only the blades: leaf, scrap and grit are
    // litter lying FLAT on the road, and a ramp along the y of a flat card
    // slides the whole thing sideways instead of bending it. The weeds coming
    // up through the kerb are the one growing thing in this scatter.
    if (geo === bladeGeo) {
      swayMesh(im, { leaf: 0.45, amount: 0.055, axis: 'y', auto: true, stiff: 1.4, hz: 1.8 });
    }
    root.add(im);
  };
  put(leaf, flat, PALETTE.hanMud, false);
  put(scrap, flat, PALETTE.hanTrim, false);
  put(grit, flat, PALETTE.hanConcreteDk, false);
  put(weed, bladeGeo, PALETTE.hanShutter, false);
}

function hanBuild(game) {
  if (hanBuilt) return;
  hanBuilt = true;
  hanInitGeos();
  hanInitLanes();

  hanRoot = new THREE.Group();
  hanRoot.name = 'hanoi';
  game.scene.add(hanRoot);

  hanBuildGround(game, hanRoot);
  hanBuildGroundBody(game);
  hanBuildScatter(hanRoot);
  hanBuildLake(hanRoot);
  hanBuildStreets(game, hanRoot);
  hanBuildQuarter(game, hanRoot);
  hanBuildTrainStreet(game, hanRoot);
  hanBuildLakeSet(game, hanRoot);
  hanBuildOddments(game, hanRoot);
  hanBuildStools(game, hanRoot);
  hanBuildCables(game, hanRoot);
  hanBuildBikes(game, hanRoot);
  hanBuildCub(game, hanRoot);   // X5: the marquee is a scooter
  hanBuildRideBody(game);
  hanBuildFolk(game, hanRoot);
  hanBuildLanterns(hanRoot);
  // LAST, because everything above may have asked for a lit window or a sign
  // and these are the two draw calls all of them land in.
  hanBuildWindows(hanRoot);
  hanBuildSigns(hanRoot);
  hanBuildLocals(game);

  if (typeof game.registerShadowTarget === 'function' && hanTrainG) {
    game.registerShadowTarget(hanTrainG);
  }
}

// ============================================================== CREATE =======
export function createHanoi(game) {
  hanGame = game;

  game.events.on('capy:wheek', function () { hanWheek(game); });

  const api = {
    built() { return hanBuilt; },
    terrainHeight: hanTerrain,
    /**
     * THE JAM, MEASURED (D5.9). Not a feature — an instrument, on the same
     * footing as `game.walkAudit`. `stopped` is how many machines are under a
     * walking pace, `following` how many are inside somebody else's six
     * metres, and `run` the longest unbroken chain of stopped riders in one
     * lane, which is the number that says whether the jam PROPAGATED or
     * whether forty riders independently arrived at the same conclusion.
     */
    bikeDebug() {
      let stopped = 0, following = 0, run = 0, best = 0, lastL = -1;
      const order = [];
      for (let L = 0; L < hanFollowRank.length; L++) {
        const a = hanFollowRank[L];
        for (let r = 0; r < a.length; r++) order.push([L, a[r]]);
      }
      for (let k = 0; k < order.length; k++) {
        const L = order[k][0], i = order[k][1], o = i * hanBIKE_STRIDE;
        if (hanFollowGap && hanFollowGap[i] >= 0) following++;
        const slow = hanBikeData[o + 5] < 1.2;
        if (slow) stopped++;
        if (L !== lastL) { run = 0; lastL = L; }
        run = slow ? run + 1 : 0;
        if (run > best) best = run;
      }
      // ...and the number the claim actually rests on: a rider WITH somebody
      // in front of it must be slower than one with an open road, and the two
      // means must separate. If they do not, the term is decorative.
      let sAll = 0, sLed = 0, nLed = 0, sFree = 0, nFree = 0, sGap = 0;
      for (let i = 0; i < hanBikeN; i++) {
        const v = hanBikeData[i * hanBIKE_STRIDE + 5];
        sAll += v;
        if (hanFollowGap && hanFollowGap[i] >= 0) { sLed += v; nLed++; sGap += hanFollowGap[i]; }
        else { sFree += v; nFree++; }
      }
      const r3 = x => Math.round(x * 1000) / 1000;
      return { n: hanBikeN, stopped, following, longestRun: best,
               meanV: r3(hanBikeN ? sAll / hanBikeN : 0),
               meanVLed: r3(nLed ? sLed / nLed : 0),
               meanVFree: r3(nFree ? sFree / nFree : 0),
               meanGap: r3(nLed ? sGap / nLed : 0) };
    },
    // ---- NINETY-SIX SECONDS, AND THE PAPER NEVER SAID (P3) ---------------
    // Both of act three's rows are the same event: the street folds because the
    // train is coming, and then the train comes. `hanTrainS >= 0` is it being
    // here, which is the window for both — so while it is running these report
    // 0 and the paper says "now" rather than counting down to something that is
    // already past the window's start.
    nextIn(id) {
      if (id !== 'the-train' && id !== 'fold-the-street') return -1;
      if (hanTrainS >= 0) return 0;
      return hanTrainT > 0 ? hanTrainT : 0;
    },
    /**
     * ONE MACHINE STOPS. WHO ELSE DOES? (D5.9)
     *
     * The ambient street never comes to a halt on its own — it bunches into
     * platoons and rolls — so "the jam propagates" cannot be read off a free-
     * running road. This pins one rider's cruise to zero and reports the chain
     * behind it: how many riders in the same lane, within thirty metres
     * upstream, are under a walking pace, and the slowest one's distance back.
     * Pass 0 to release. A test hook, like walkAudit — nothing in the game
     * calls it.
     */
    jamTest(i, on) {
      if (!hanBikeN) return null;
      const idx = Math.max(0, Math.min(hanBikeN - 1, i | 0));
      const o = idx * hanBIKE_STRIDE;
      if (on === false) { hanBikeData[o + 6] = hanJamWas < 0 ? 7 : hanJamWas; hanJamPin = -1; return null; }
      if (hanJamPin !== idx) { hanJamWas = hanBikeData[o + 6]; hanJamPin = idx; }
      hanBikeData[o + 6] = 0;
      const L = hanBikeData[o] | 0, dir = hanBikeData[o + 2];
      const s0 = hanBikeData[o + 1], total = hanLaneTotal[L], closed = !!hanLANES[L].closed;
      let chain = 0, deepest = 0;
      const near = [];
      for (let j = 0; j < hanBikeN; j++) {
        if (j === idx) continue;
        const oj = j * hanBIKE_STRIDE;
        if ((hanBikeData[oj] | 0) !== L || hanBikeData[oj + 2] !== dir) continue;
        // BEHIND, which is the opposite sense to hanFollowScan's "ahead"
        let back = (s0 - hanBikeData[oj + 1]) * dir;
        if (closed && back < 0) back += total;
        if (back <= 0 || back > 30) continue;
        if (hanBikeData[oj + 5] < 1.2) { chain++; if (back > deepest) deepest = back; }
        near.push([Math.round(back * 10) / 10,
                   Math.round(hanBikeData[oj + 5] * 100) / 100,
                   Math.round((hanBikeData[oj + 3] - hanBikeData[o + 3]) * 100) / 100,
                   hanFollowGap ? Math.round(hanFollowGap[j] * 10) / 10 : -1]);
      }
      near.sort((a, b) => a[0] - b[0]);
      return { pinned: idx, lane: L, dir, chain, deepestM: Math.round(deepest * 10) / 10,
               pinnedV: Math.round(hanBikeData[o + 5] * 100) / 100,
               pinnedOff: Math.round(hanBikeData[o + 3] * 100) / 100,
               // [metres behind, its speed, its offset minus mine, its own gap]
               behind: near.slice(0, 8) };
    },
    slopeAt: hanSlope,
    waterLevel: hanWATER,
    isOverWater: hanIsOverWater,
    waterHeightAt: hanWaterHeightAt,
    groundSlip: hanGroundSlip,
    surfacePitch: hanSurfacePitch,
    inZone: hanInZone,
    navBlocked: hanNavBlocked,
    randomPointIn: hanRandomPointIn,
    bounds() { return hanBOUNDS; },
    SPAWN: hanSPAWN,
    /**
     * THREE METRES OF GREEN WATER WITH A TOWER IN THE MIDDLE OF IT, and you
     * can go under it. It is the shallowest divable water in the game and
     * that is exactly right: you can see the bottom of Hoan Kiem from the
     * bank, which is most of why anybody stands on the bank.
     */
    canDive: true,
    /**
     * A DECLARED FRAME while the animal is on a scooter. Horizontal only —
     * NOTHING here assigns the passenger's vertical, because the floor of a
     * footwell does not rise and a declared frame plus an assigned velocity is
     * the Volo bug written down in CONTRACT.md.
     */
    carryFrame() { return hanRider >= 0 ? hanFrame : null; },

    // ---- what the rest of the game asks about this chapter ---------------
    /** 0..1 — how far the street has folded itself away. 1 is a train coming. */
    folded() { return hanFoldK; },
    /** Is there a train in the alley right now, and how far along. */
    trainOut() { return hanTrainS >= 0; },
    /**
     * 0..1 — HOW MUCH OF THE LIGHT IN THIS ALLEY IS THE TRAIN'S, for the event
     * grade layer. Chapter 19 shipped with no row in it at all, so `lit` — the
     * second of the four channels — was not something this chapter could use
     * for anything, least of all for `the-train`, which is its wow.
     *
     * A boolean will not do here. The moment is an approach: a lamp at the far
     * end of a 96 m alley is a point, and the same lamp at four metres is the
     * only thing in the frame. So this is the train's NEARNESS, not its
     * presence, squared to keep the whole first half of the run quiet, and
     * gated on the player actually being in the alley — the grade is about what
     * the player can see, and from the lake this is somebody else's train.
     */
    trainGlow() {
      if (hanTrainS < 0) return 0;
      const capy = hanGame && hanGame.capy; if (!capy) return 0;
      const p = capy.position;
      if (Math.abs(p.z - hanTRAIN.z) > 9) return 0;
      // THE SAME EXPRESSION hanStepTrain DRIVES THE MESH WITH, not a
      // re-derivation. The first version of this row read `x0 + hanTrainS` —
      // the train runs the other way, from `x1 + 60` DOWNWARD — so it put the
      // lamp at the wrong end of the alley and measured 0.00 at the exact
      // moment the marquee paid out. A grade row keyed on a position must take
      // that position from whatever moves the thing.
      const nose = hanTRAIN.x1 + 60 - hanTrainS;
      const back = nose + 13.6 * hanTRAIN_LEN + 7;
      const along = clamp(p.x, nose - 7, back);
      const d = Math.abs(p.x - along);
      const k = 1 - Math.min(1, d / 34);
      return k * k;
    },
    /** How many of them have had to go round you on this crossing. */
    swerved() { return Math.round(hanSwerved); },
    /** The crossing state machine, for the harness: [lane, ok, from, dither]. */
    crossState() { return [hanCrossLane, hanCrossOk ? 1 : 0, hanCrossFrom, +hanDither.toFixed(2)]; },
    /** Which scooter is carrying you, or -1. */
    riding() { return hanRider; },
    /** How many stools are down right now. */
    stools() { return hanStoolDown; },
    /** 0..1 — how much you are in the traffic. The harness and the score read it. */
    inTraffic() {
      const capy = hanGame && hanGame.capy;
      if (!capy || !capy.position) return 0;
      const d = hanLaneAt(capy.position.x, capy.position.z);
      return clamp(1 - (d - hanLaneW) / 4, 0, 1);
    },

    // ---- landmarks. A fixture is an object, a thing that moves is a call. --
    lake: { x: hanLAKE.cx, z: hanLAKE.cz + 18 },
    tower: { x: hanTOWER.x, z: hanTOWER.z },
    ngoc: { x: hanNGOC.x, z: hanNGOC.z },
    huc: { x: (hanHUC.x0 + hanHUC.x1) / 2, z: (hanHUC.z0 + hanHUC.z1) / 2 },
    puppet: { x: hanPUPPET.x, z: hanPUPPET.z - 3 },
    bia: { x: hanBIA.x, z: hanBIA.z },
    market: { x: hanMARKET.x, z: hanMARKET.z },
    barber: { x: hanBARBER.x + 1.6, z: hanBARBER.z },
    rails: { x: (hanTRAIN.x0 + hanTRAIN.x1) / 2, z: hanTRAIN.z },
    bridge: { x: hanBRIDGE.x, z: hanBRIDGE.z0 + 30 },
    cau: { x: hanCAU.x, z: hanCAU.z },
    flowers: { x: -8, z: -4 },
    /** These MOVE — ask, never cache. Each gets its OWN scratch vector. */
    crossing() {
      // the nearest point on the nearest lane, which is where a crossing starts
      const capy = hanGame && hanGame.capy;
      const px = capy && capy.position ? capy.position.x : 0;
      const pz = capy && capy.position ? capy.position.z : 0;
      hanLaneAt(px, pz);
      hanLaneAtS(hanLaneI, hanLaneS, hanTmp2);
      hanV3c.set(hanTmp2.x, hanGROUND, hanTmp2.z);
      return hanV3c;
    },
    bike() {
      const capy = hanGame && hanGame.capy;
      if (!hanBikeN || !capy || !capy.position) return api.crossing();
      // Shared with hanUpdateRide — see hanNearestBike.
      const bi = hanNearestBike(capy.position.x, capy.position.z);
      hanBikeAt(bi < 0 ? 0 : bi, hanV3d);
      return hanV3d;
    },
    pho() {
      if (!hanPhoProp || hanPhoGone) return api.bia;
      hanV3.set(hanPhoProp.body.position.x, hanPhoProp.body.position.y, hanPhoProp.body.position.z);
      return hanV3;
    },

    update(dt) {
      if (!hanBuilt) return;
      if (!game.biome.isActive('hanoi')) return;
      hanTime += dt;
      // the props are staged on the first LIVE frame: props.js may not exist
      // when a lazily-built chapter is built.
      if (!hanSpawned && game.physics && typeof game.physics.spawnProp === 'function') {
        hanSpawned = true;
        if (!hanPhoProp && !hanPhoGone) {
          hanPhoProp = game.physics.spawnProp('phobowl', 11.2, 15.4, hanGROUND + 0.55);
        }
        if (!hanCoffeeProp && !hanCoffeeGone) {
          // ...on a first-floor balcony, which is the whole task
          hanCoffeeProp = game.physics.spawnProp('coffee', 6.2, 21.0, hanGROUND + 5.2);
        }
        if (!hanFlowerProps.length) {
          for (let i = 0; i < 3; i++) {
            const pr = game.physics.spawnProp('flowers', -8 + rand(-0.6, 0.6),
                                              -4 + rand(-0.6, 0.6), hanGROUND + 1.5);
            if (pr) hanFlowerProps.push(pr);
          }
        }
      }
      hanUpdateLake(dt);
      hanUpdateBikes(game, dt);
      hanUpdateCub(game, dt);   // X5
      if (!hanCubOn) hanUpdateRide(game, dt);   // ...and nobody's footwell takes a rider off her own scooter
      hanUpdateCrossing(game, dt);
      hanUpdateTrain(game, dt);
      hanUpdateStools(game, dt);
      hanUpdatePuppets(game, dt);
      hanUpdateCau(game, dt);
      hanUpdateFolk(dt);
      hanUpdateTasks(game, dt);
      hanUpdateAmbience(game, dt);
    },
  };

  game.biome.register('hanoi', {
    ensureBuilt() { hanBuild(game); },
    onEnter() {
      // A fresh arrival is a fresh morning. Everything STAGED replays; the
      // checklist is systems.js's business and stays ticked.
      hanTime = 0;
      hanSwerved = 0; hanBumpT = 0; hanHornT = 0;
      if (hanBikeData) for (let i = 0; i < hanBikeN; i++) hanBikeData[i * hanBIKE_STRIDE + 9] = 0;
      hanCrossLane = -1; hanCrossOk = false; hanDither = 0;
      hanRider = -1; hanRideT = 0; hanRideDist = 0; hanRideGrace = 0; hanRideHave = false;
      hanFrame.x = 0; hanFrame.z = 0;
      // X5: the Cub is back at the stall with its bowls
      if (hanCubG && !hanCubOn) { hanCubX = hanCUB.x; hanCubZ = hanCUB.z; hanCubYaw = hanCUB.yaw; hanCubV = 0; if (!hanCubDone) { hanCubNext = 0; if (hanCubBowls) for (let i = 0; i < 3; i++) hanCubBowls[i].visible = true; } }
      if (hanRideBody) {
        hanRideBody.position.set(0, -900, 0);
        hanRideBody.velocity.setZero();
        hanSyncBody(hanRideBody);
      }
      // THE TRAIN IS AWAY AGAIN, and its clock is reset to a third of the gap
      // — near enough that a player who walks straight to the alley is not
      // waiting ninety-six seconds, far enough that it is not there already.
      hanTrainS = -1;
      hanTrainT = hanTRAIN_GAP2 * 0.30;
      hanTrainWarned = false; hanTrainNear = 99; hanTrainHave = false;
      hanFoldK = 0;
      if (hanTrainG) hanTrainG.visible = false;
      if (hanTrainBody) {
        hanTrainBody.position.set(0, -900, 0);
        hanTrainBody.velocity.setZero();
        hanSyncBody(hanTrainBody);
      }
      // ...and every stool is standing up again, for the same reason the
      // champagne is stacked again in chapter 18: the tick on the list stays
      // ticked and the SHOW replays.
      if (hanStoolData) {
        for (let i = 0; i < hanSTOOL_N; i++) {
          hanStoolData[i * 8 + 2] = 0;
          hanStoolData[i * 8 + 3] = 0; hanStoolData[i * 8 + 4] = 0;
          hanStoolData[i * 8 + 6] = 0;
        }
        hanStoolDown = 0;
        hanSyncStools();
      }
      hanArrived = false;
      hanToldFlow = false; hanToldHorn = false; hanToldTrain = false; hanToldLake = false;
      hanAmbT = 0; hanQuietT = 0;
      hanSpawned = false;
    },
    onExit() {
      hanRider = -1;
      // X5: nobody rides out of a country
      if (hanCubOn) { hanCubOn = false; if (game.capy) game.capy.atHelm = false; }
      if (hanCubMover) hanCubMover.set(0);
      hanFrame.x = 0; hanFrame.z = 0;
      if (hanRideBody) hanRideBody.velocity.setZero();
      if (hanTrainBody) hanTrainBody.velocity.setZero();
    },
  });

  // ---- THE PHO RUN (X5) --------------------------------------------------
  api.cub = function () { return { on: hanCubOn, x: hanCubX, z: hanCubZ, yaw: hanCubYaw, v: hanCubV, next: hanCubNext, done: hanCubDone, t: hanCubT, hold: hanCubHold }; };
  api.cubAt = function () { return { x: hanCubX, y: hanGROUND, z: hanCubZ }; };
  api.dropAt = function (i) { const d = hanDROPS[Math.max(0, Math.min(hanDROPS.length - 1, i | 0))]; return { x: d[0], y: hanGROUND + 1, z: d[1], name: d[2] }; };
  api.cubDebug = function (o) {
    if (o && o.take && !hanCubOn) hanCubTake(game);
    if (o && typeof o.x === 'number') { hanCubX = o.x; hanCubZ = o.z; hanCubV = 0; if (typeof o.yaw === 'number') hanCubYaw = o.yaw; }
    return api.cub();
  };
  api.rideYaw = function () { return hanCubOn ? hanCubYaw : NaN; };
  // above the awnings (ground + 3.2, 2.2 m deep off every shop): a chase
  // camera at three metres was a red tarpaulin for most of the run
  api.rig = function () { return hanCubOn ? { w: 1, dist: 7.5, pitch: 0.55, raise: 0.9, lambda: 3.0 } : null; };
  game.hanoi = api;
  return api;
}
