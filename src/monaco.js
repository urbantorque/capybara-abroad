import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PALETTE, mat, rand, randInt, clamp, damp, lerp, grain, placeCue } from './shared.js';

// ===========================================================================
// CHAPTER 18 — MONTE CARLO
//
// The eighteenth place, and the first one where BEING SEEN COSTS YOU ANYTHING.
//
// Seventeen chapters have been a sandbox with a list on it: everything in them
// can be done in any order, from anywhere, with anybody watching, and the only
// thing wariness has ever bought is that somebody looks at you for longer. That
// is the right rule for a garden and it is the wrong rule for the one building
// on earth whose entire business model is a man on a door deciding whether you
// come in.
//
// THREE THINGS MAKE THIS CHAPTER AND NOT ONE:
//
//  1. THE EYE. Inside the Casino there are five people whose job is to look at
//     the room, and they sweep. `monSeen` fills while you are inside a cone and
//     drains fast outside one, and at 1.0 two croupiers pick you up under the
//     forelegs and put you back on the steps. THAT IS THE WHOLE PENALTY: you
//     lose about ten seconds and whatever was in your mouth, and NOTHING
//     becomes impossible — you may walk straight back in. It is a chapter about
//     dignity, not about failure, and the rule the other seventeen keep
//     (nothing is ever denied) is kept here too.
//
//     And it is built out of verbs the player already has. THE LOAF — sitting
//     down and doing nothing, which this game has rewarded exactly once before
//     — halves the range at which a cone finds you. RUNNING doubles it. So the
//     stealth layer taught itself in chapter 1 and nobody has to be told.
//
//  2. THE STACK. The only economy in the game. A plaque is a real prop you can
//     carry in your mouth; the roulette wheel is a real turning kinematic disc;
//     and dropping a plaque into a moving wheel pays you what the pocket it
//     lands in says. Red pays two, black pays one, and the zero pays eight and
//     the whole salon stops talking. Nothing is gated on the stack — it is one
//     task and one record — but it is the first thing in this game you can have
//     MORE of, and the first thing you can lose.
//
//  3. THE CIRCUIT. The Grand Prix runs on the streets, so the streets are the
//     circuit: Sainte-Devote, the climb to the Casino, Mirabeau, the Fairmont
//     hairpin, and then a hundred and eleven metres of TUNNEL before the light
//     comes back over the harbour. Three cars lap it on their own clock whether
//     anybody is watching or not, and the roof of one of them is somewhere you
//     can be. The tunnel is the marquee: a dark bore at twenty-six metres a
//     second with the score ducked to a hum, and then the whole port at once.
//
// Everything here is prefixed `mon` (contract: the bundler flattens every
// module into one scope).
// ===========================================================================

// --------------------------------------------------------------- geography --
// One coordinate system, and it is the real map turned so that the sea is at
// -z and the mountain is at +z, which is the convention every coastal chapter
// in this game already keeps. West (-x) is the Rock; east (+x) is Monte-Carlo
// on its terrace, twenty-eight metres above the water.
const monWATER   = -0.6;          // the Mediterranean, and it does not move much

// You arrive on the west quay, at the bottom, looking across the basin at a
// hundred and thirty feet of somebody else's money. Deliberately at the BOTTOM:
// the whole shape of this chapter is a climb, and a player put down on the
// terrace would never find out that the terrace is up.
const monSPAWN     = { x: -34, y: 3.4, z: -28 };
const monSPAWN_YAW = 1.15;        // ...looking across the basin, not up the hill

// Port Hercule. A rectangle of still water with the town on three sides of it.
const monPORT     = { x0: -52, x1: 54, z0: -96, z1: -8 };
const monPORT_BED = -6.4;         // the basin floor. Shallow: you can see it
const monQUAY_Y   = 2.4;          // ...and every quay round it is at this height

// La Condamine — the flat behind the port, and the bottom of the hill.
const monCOND    = { cx: 0, cz: 26, rx: 84, rz: 44, h: 6.0, soft: 22 };

// The terrace at Monte-Carlo. The Casino stands on it and the square in front
// of it is the second most photographed piece of tarmac in motorsport.
const monTERR    = { cx: 116, cz: 82, rx: 62, rz: 46, h: 28.0, soft: 26 };
const monSQUARE  = { x: 96, z: 74, r: 30 };
const monCASINO  = { x: 118, z: 104, w: 48, d: 34, y: 28.0 };
const monFLOOR_Y = 28.4;                    // the gaming floor, one step up
const monSTEPS   = { x: 118, z: 84 };       // the front steps, and the only door
const monDOOR    = { x: 118, z: 87.6 };

// The hillside behind the town: the Moyenne Corniche, and the reason a place
// this size feels like the bottom of something.
const monHILL    = { cx: 70, cz: 216, rx: 250, rz: 104, h: 94.0, soft: 84 };

// Le Rocher. A limestone plateau with the Palace on it, fifty-eight metres up
// and vertical on the sea side, which is why anybody built anything on it.
const monROCK    = { cx: -152, cz: -46, rx: 58, rz: 52, h: 58.0, soft: 11 };
const monPALACE  = { x: -146, z: -24, y: 58.0 };
const monNECK    = { cx: -98, cz: -2, rx: 48, rz: 30, h: 22.0, soft: 26 };

// The eastern headland, toward Larvotto. Backdrop, and the far end of the map.
const monEAST    = { cx: 212, cz: 30, rx: 62, rz: 78, h: 44.0, soft: 34 };

// The hill the tunnel goes through. In life it is the Fairmont hotel; here it
// is the shoulder the road disappears into and comes out of.
const monTHILL   = { cx: 134, cz: -40, rx: 54, rz: 44, h: 27.0, soft: 20 };

// The two moles that make the port a port.
const monMOLE    = { cx: 2, cz: -104, rx: 66, rz: 6, h: 2.8, soft: 5 };
const monCONTRE  = { cx: -62, cz: -70, rx: 6, rz: 28, h: 2.8, soft: 5 };

const monPADS = [monCOND, monTERR, monHILL, monROCK, monNECK, monEAST, monTHILL,
                 monMOLE, monCONTRE];

const monSEA_X0 = -270, monSEA_X1 = 270, monSEA_Z0 = -330, monSEA_Z1 = 220;

// ------------------------------------------------------------- the circuit --
// A CLOSED POLYLINE, and the terrain conforms to it rather than the other way
// round. This is the pattern the chiva road and the Uji run already use: one
// list of (x, z, y) nodes is the road's height, the cars' rails, the kerb
// layout and the tarmac mesh, so none of the four can drift out of agreement
// with the others.
//
// Read it as a lap. It starts at Sainte-Devote, climbs, turns round at the
// hairpin, drops to the sea, goes into the dark for a hundred and eleven
// metres, and comes back along the water.
const monTRACK = [
  [-18,  44,  8.2],   //  0 Sainte-Devote, at the bottom of the ravine
  [ 14,  60, 13.4],   //  1 Beau Rivage, the climb
  [ 52,  76, 21.6],   //  2 ...still climbing
  [ 84,  90, 27.4],   //  3 Casino Square, past the hotel
  [118,  98, 28.0],   //  4 in front of the Casino itself
  [148,  86, 26.6],   //  5 Mirabeau
  [164,  58, 22.0],   //  6 the drop to the hairpin
  [172,  36, 17.6],   //  7 the Fairmont hairpin — the apex
  [154,  28, 16.2],   //  8 ...and out of it, eighteen metres from where you went in
  [150,   6, 10.4],   //  9 Portier
  [152, -12,  6.8],   // 10 TUNNEL IN
  [ 74, -84,  3.4],   // 11 TUNNEL OUT
  [ 46, -92,  3.0],   // 12 the Nouvelle Chicane
  [  8, -95,  2.8],   // 13 Tabac
  [-26, -87,  2.8],   // 14 the swimming pool section
  [-48, -66,  2.8],   // 15 La Rascasse
  [-54, -38,  3.2],   // 16 Anthony Noghes
  [-46,   4,  5.0],   // 17 the west quay, and back up to the start
  [-32,  28,  6.6],   // 18
];
const monTRACK_HALF = 4.8;        // half the tarmac
const monTRACK_SHLD = 3.6;        // ...and the shoulder the terrain blends over
const monTUNNEL_A   = 10;         // node index the tunnel starts at
const monTUNNEL_B   = 11;         // ...and ends at
const monTUNNEL_H   = 6.4;        // clear height under the roof
const monTUNNEL_W   = 7.6;        // half width inside

// The cars. Fast enough that the tunnel is over in four seconds and slow enough
// that a capybara can get onto the roof of one at the hairpin, which is the
// whole design: the ONE place on the lap where they are doing under nine metres
// a second is the one place with a name everybody already knows.
const monCAR_VMAX  = 26.5;
const monCAR_VMIN  = 8.0;         // ...at the apex of the hairpin
const monCAR_ACC   = 8.5;
const monCAR_BRAKE = 15.0;
const monCAR_N     = 3;
const monROOF_Y    = 1.44;        // the deck of the roof above the road
const monROOF_HX   = 0.94, monROOF_HZ = 2.10;
const monCAR_HY    = 0.72;

// ------------------------------------------------------------------ the eye --
// Five people looking at one room. See THE EYE at the top of the file.
const monEYE_RANGE = 15.0;        // metres a sweep reaches
const monEYE_HALF  = 0.46;        // radians either side of where they are facing
const monEYE_FILL  = 0.60;        // per second, at the middle of the cone
const monEYE_DRAIN = 0.95;        // ...and how fast it goes away when it does not
const monEYE_LOAF  = 0.50;        // range multiplier while sat down doing nothing
const monEYE_RUN   = 1.55;        // ...and while running, because of course
const monEYE_WARN  = 0.42;        // where the room starts to say something
const monEYE_OUT   = 2.4;         // seconds of being carried out
const monEYE_COOL  = 4.5;         // ...and how long before anybody looks again

// ------------------------------------------------------------------ the wheel
const monWHEEL      = { x: 134, z: 112, y: 28.46, r: 2.20 };
const monWHEEL_W    = 1.05;       // rad/s, and it never stops
const monWHEEL_RIDE = 6.0;        // seconds on it that is the mini
const monPAY_R      = 2;          // what a red pocket pays
const monPAY_K      = 1;          // ...a black one
const monPAY_Z      = 8;          // ...and the zero
const monSTACK_WIN  = 10;         // the number on the task

// ------------------------------------------------------------------ scratch --
const monV3  = new THREE.Vector3();
const monV3b = new THREE.Vector3();
const monV3c = new THREE.Vector3();
const monV3d = new THREE.Vector3();
const monQ   = new THREE.Quaternion();
const monE   = new THREE.Euler();
const monSc  = new THREE.Vector3();
const monM   = new THREE.Matrix4();
const monCol = new THREE.Color();
const monFrame = { x: 0, z: 0 };
// A PLACED CUE. See placeCue in shared.js: it COPIES rather than writes, so a
// positioned sound can never leak its position into the next mono call through
// the one shared options object this file reuses.
const monOpt = {};

// ---------------------------------------------------------------- module ----
let monGame = null;
let monBuilt = false;
let monRoot = null;
let monTime = 0;

// the sea and the basin
let monSeaMesh = null, monSeaAttr = null, monSeaBase = null;

// the cars
const monCarG = [];               // THREE.Group per car
const monCarBody = [];            // CANNON kinematic box per car
const monCarU = [];               // lap parameter, in metres along the lap
const monCarV = [];               // m/s
const monCarTX = [];              // the PREVIOUS TARGET, for rule 3 of the carrier
const monCarTZ = [];
const monCarTY = [];
const monCarYaw = [];
let monCarRoot = null;
let monRider = -1;                // which car the animal is standing on, or -1
let monRideT = 0;                 // ...and for how long
let monTunnelIn = -1;             // metres-along at which the rider entered the bore
let monTunnelBest = 0;            // the fastest pass this visit
let monTunnelDone = false;
let monHairpinDone = false;
let monRideDist = 0;
let monTunnelK = 0;               // 0..1 how enclosed the CAMERA is right now

// the eye
const monEyes = [];               // {x, z, base, amp, hz, phase, yaw, mesh, mat}
let monSeen = 0;
let monOutT = -1;                 // > 0 while being carried out
let monCoolT = 0;
let monWarned = false;
let monFloorRun = -1;             // the clock on 'cross the floor unseen'
let monFloorBest = 0;
let monFloorDone = false;
let monInside = false;            // is the animal on the gaming floor right now
let monEverIn = false;
let monPassDone = false;
let monEyeTick = 0;

// the stack
let monStack = 0;
let monStackBest = 0;
let monBrokeT = 0;                // seconds spent at the table with nothing left
let monStackDone = false;
const monPlaqueProps = [];        // live plaque props on the floor
let monPlaqueT = 0;
let monWheelG = null, monWheelBody = null, monWheelA = 0;
let monWheelRideT = 0, monWheelDone = false;
let monBallA = 0;
let monPayT = -1, monPayKind = 0;
let monEverWon = false;

// the yacht
let monYachtG = null;
let monDiveBest = 0, monDiveDone = false;
let monTuxProp = null, monTuxGone = false;
let monAboard = false, monAboardT = 0, monAboardDone = false;

// the salon
let monPianoG = null;
const monPianoKey = [];           // {x, z, mesh, y0, v, hit}
let monPianoRun = 0, monPianoLast = -1, monPianoT = 0, monPianoDone = false;
let monToweG = null, monToweT = -1, monToweDone = false;
const monToweBits = [];

// the palace
let monGuardG = null, monGuardBreak = 0, monGuardDone = false;

// the chicane
let monChicaneDone = false;
const monChicaneBlk = [];

// instanced fields
let monWinMesh = null;            // the lit windows of the whole town
let monBoatMesh = null;           // the small craft in the basin
let monBoatData = null;
let monPalmMesh = null;
let monWatchMesh = null;          // the crowd on the fence at the square
let monWatchPh = null;
let monWakeMesh = null;
let monWakeData = null;

// people
let monLocDoor = null, monLocPit = null, monLocQuay = null;
let monLocDeck = null, monLocCroup = null, monLocMarshal = null, monLocBar = null;

// the chapter's own bookkeeping
let monArrived = false;
let monToldEye = false, monToldTrack = false, monToldStack = false;
let monAmbT = 0;
let monGullT = 0;

// ---------------------------------------------------------------- helpers ---
function monXform(px, py, pz, rx, ry, rz, sx, sy, sz) {
  monE.set(rx, ry, rz, 'YXZ');
  monQ.setFromEuler(monE);
  monV3.set(px, py, pz);
  monSc.set(sx, sy, sz);
  monM.compose(monV3, monQ, monSc);
  return monM;
}

const monG = { box: null, cyl4: null, cyl6: null, cyl8: null, cyl12: null,
               cone4: null, cone6: null, sph6: null, sph8: null };
function monInitGeos() {
  if (monG.box) return;
  monG.box = new THREE.BoxGeometry(1, 1, 1);
  monG.cyl4 = new THREE.CylinderGeometry(0.5, 0.5, 1, 4);
  monG.cyl6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
  monG.cyl8 = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
  monG.cyl12 = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
  monG.cone4 = new THREE.ConeGeometry(0.5, 1, 4);
  monG.cone6 = new THREE.ConeGeometry(0.5, 1, 6);
  monG.sph6 = new THREE.SphereGeometry(0.5, 6, 4);
  monG.sph8 = new THREE.SphereGeometry(0.5, 8, 6);
}

/** CONTRACT: box() takes FULL extents; CANNON.Box takes HALF. */
function monMerger() {
  const pos = [], nor = [], col = [], idx = [];
  const M = {
    n: 0,
    add(geo, m4, color) {
      const g = geo.clone();
      g.applyMatrix4(m4);
      const p = g.attributes.position.array;
      const nm = g.attributes.normal.array;
      monCol.set(color);
      const start = M.n;
      for (let i = 0; i < p.length; i += 3) {
        pos.push(p[i], p[i + 1], p[i + 2]);
        nor.push(nm[i], nm[i + 1], nm[i + 2]);
        col.push(monCol.r, monCol.g, monCol.b);
      }
      const vc = p.length / 3;
      if (g.index) { const ia = g.index.array; for (let i = 0; i < ia.length; i++) idx.push(start + ia[i]); }
      else { for (let i = 0; i < vc; i++) idx.push(start + i); }
      M.n += vc;
      g.dispose();
      return M;
    },
    box(cx, cy, cz, sx, sy, sz, color, rx, ry, rz) {
      return M.add(monG.box, monXform(cx, cy, cz, rx || 0, ry || 0, rz || 0, sx, sy, sz), color);
    },
    cyl(cx, cy, cz, r, h, color, rx, ry, rz, seg) {
      const g = seg === 4 ? monG.cyl4 : seg === 8 ? monG.cyl8 : seg === 12 ? monG.cyl12 : monG.cyl6;
      return M.add(g, monXform(cx, cy, cz, rx || 0, ry || 0, rz || 0, r * 2, h, r * 2), color);
    },
    cone(cx, cy, cz, r, h, color, rx, ry, rz, seg) {
      const g = seg === 4 ? monG.cone4 : monG.cone6;
      return M.add(g, monXform(cx, cy, cz, rx || 0, ry || 0, rz || 0, r * 2, h, r * 2), color);
    },
    sph(cx, cy, cz, sx, sy, sz, color, seg) {
      return M.add(seg === 8 ? monG.sph8 : monG.sph6,
                   monXform(cx, cy, cz, 0, 0, 0, sx * 2, sy * 2, sz * 2), color);
    },
    /** A quad, wound so the normal is +y before the transform. Roofs and roads. */
    quad(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, color) {
      monCol.set(color);
      const s = M.n;
      const v = [ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz];
      // one flat normal for all four, recomputed by computeVertexNormals below
      for (let i = 0; i < 12; i += 3) {
        pos.push(v[i], v[i + 1], v[i + 2]);
        nor.push(0, 1, 0);
        col.push(monCol.r, monCol.g, monCol.b);
      }
      idx.push(s, s + 1, s + 2, s, s + 2, s + 3);
      M.n += 4;
      return M;
    },
    empty() { return M.n === 0; },
    build() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      g.computeBoundingSphere();
      return g;
    },
  };
  return M;
}

function monVC() {
  return grain(mat(0xffffff, { vertexColors: true }), { scale: 0.26, amount: 0.085, warp: 0.6 });
}
/** Stone and plaster take a finer grain than rock: at 0.26 a wall reads as brick. */
function monVCF() {
  return grain(mat(0xffffff, { vertexColors: true }), { scale: 0.09, amount: 0.05, warp: 0.9 });
}
/**
 * ANYTHING IN THIS CHAPTER THAT IS SWITCHED ON IS BUILT WITH THIS.
 *
 * It is eight in the evening in April and the sun has just gone. Every read in
 * the place is a warm rectangle against a cold blue, and a warm-coloured
 * Lambert box under a hemisphere that has been turned down does not read as a
 * lamp at all — the emissive term IS what a light source is. It lives on
 * MeshLambertMaterial, so this stays inside the aesthetic law. Same helper the
 * cave and the Antarctic grew, for exactly the same reason.
 */
function monGlow(color, intensity) {
  return mat(color, { emissive: color, emissiveIntensity: intensity === undefined ? 1 : intensity });
}

function monSyncBody(b) {
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
  b.previousQuaternion.copy(b.quaternion);
  b.interpolatedQuaternion.copy(b.quaternion);
}
function monPoolBody(game) {
  const b = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC,
                              material: (game.mats && game.mats.ground) || undefined });
  b.allowSleep = true;
  return b;
}
/** FULL extents in, halves to CANNON. */
function monPoolBox(b, x, y, z, sx, sy, sz, ry) {
  const q = new CANNON.Quaternion();
  if (ry) q.setFromEuler(0, ry, 0);
  b.addShape(new CANNON.Box(new CANNON.Vec3(sx * 0.5, sy * 0.5, sz * 0.5)), new CANNON.Vec3(x, y, z), q);
  return b;
}
function monPoolDone(game, b) {
  if (!b.shapes.length) return null;
  monSyncBody(b);
  game.world.addBody(b);
  return b;
}
function monStaticBox(game, x, y, z, sx, sy, sz, ry) {
  const b = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
  b.addShape(new CANNON.Box(new CANNON.Vec3(sx * 0.5, sy * 0.5, sz * 0.5)));
  b.position.set(x, y, z);
  if (ry) b.quaternion.setFromEuler(0, ry, 0);
  monSyncBody(b);
  game.world.addBody(b);
  return b;
}
function monSmooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
function monTask(id) {
  const g = monGame;
  if (g && typeof g.completeTask === 'function') g.completeTask(id);
}
function monToast(s) {
  const g = monGame;
  if (g && typeof g.toast === 'function') g.toast(s);
}
function monSfx(name, opts) {
  const g = monGame;
  if (g && typeof g.sfx === 'function') g.sfx(name, opts);
}
/**
 * A CUE THAT COMES FROM WHERE IT HAPPENED, without being attenuated twice.
 *
 * `at:` alone is not the fix — sfx() applies its own inverse-distance law on
 * top of whatever this file has already done with the volume. placeCue sets
 * `near` to the chapter's own audible radius so audioPlace's gain is exactly 1
 * everywhere this chapter thinks the sound carries, and leaves PAN as the only
 * thing it contributes.
 */
function monCue(name, x, y, z, volume, pitch, far) {
  const g = monGame;
  if (!g || typeof g.sfx !== 'function') return;
  monOpt.volume = volume;
  if (pitch !== undefined) monOpt.pitch = pitch; else delete monOpt.pitch;
  g.sfx(name, placeCue(monOpt, x, y, z, far === undefined ? 150 : far));
}
function monRecord(id, v) {
  const g = monGame;
  if (g && typeof g.record === 'function') g.record(id, v);
}
function monTaskDone(id) {
  const g = monGame;
  return !!(g && typeof g.taskDone === 'function' && g.taskDone(id));
}

// ---------------------------------------------------------------- terrain ---
/**
 * THE SEA FLOOR, and it is shallow because you can see it.
 *
 * The one thing everybody who has ever looked at that coast notices is that
 * the water is clear enough to read the bottom out to about thirty metres, and
 * the chapter draws the basin floor for exactly that reason. Beyond the mole it
 * falls away properly, because the Mediterranean does: there is a two-thousand
 * metre trench eight kilometres offshore.
 */
function monSeabed(x, z) {
  const out = Math.max(0, -z - 104);
  let h = -7.0 - out * 0.085;
  const ex = Math.max(0, Math.abs(x) - 170);
  h -= ex * 0.075;
  return Math.max(-34, h);
}

/**
 * ONE PLATEAU, WITH A SOFT RIM, FALLING TO WHATEVER IS UNDERNEATH IT.
 *
 * The rim falls to the SEABED and not to zero. A pad that eases to y = 0 leaves
 * a shelf of dry land at sea level all the way round every hill in the chapter,
 * which is how a town on a cliff ends up with a beach it never had.
 */
function monPad(x, z, p, floor) {
  const dx = (x - p.cx) / p.rx, dz = (z - p.cz) / p.rz;
  const r = Math.sqrt(dx * dx + dz * dz);
  if (r <= 1) return p.h;
  const fall = p.soft / Math.min(p.rx, p.rz);
  const t = 1 - (r - 1) / fall;
  if (t <= 0) return floor;
  return floor + (p.h - floor) * monSmooth(t);
}

/** Distance from (x, z) to a segment, and how far along it that lands, 0..1. */
function monSegD(x, z, ax, az, bx, bz) {
  const ex = bx - ax, ez = bz - az;
  const L2 = ex * ex + ez * ez;
  let t = L2 > 1e-9 ? ((x - ax) * ex + (z - az) * ez) / L2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const px = ax + ex * t, pz = az + ez * t;
  const dx = x - px, dz = z - pz;
  monSegT = t;
  return Math.sqrt(dx * dx + dz * dz);
}
let monSegT = 0;

// The lap, precomputed: cumulative arc length so the cars can be driven in
// METRES rather than in a normalised parameter that stretches over the long
// legs and bunches over the short ones.
const monTrackLen = [];
let monTrackTotal = 0;
function monInitTrack() {
  if (monTrackLen.length) return;
  let s = 0;
  for (let i = 0; i < monTRACK.length; i++) {
    monTrackLen.push(s);
    const a = monTRACK[i], b = monTRACK[(i + 1) % monTRACK.length];
    s += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  monTrackTotal = s;
}

/** Where the road is at `s` metres round the lap. Writes into `out`. */
function monTrackAt(s, out) {
  monInitTrack();
  let d = s % monTrackTotal;
  if (d < 0) d += monTrackTotal;
  let i = monTRACK.length - 1;
  for (let k = 0; k < monTRACK.length; k++) {
    const nxt = k + 1 < monTRACK.length ? monTrackLen[k + 1] : monTrackTotal;
    if (d < nxt) { i = k; break; }
  }
  const a = monTRACK[i], b = monTRACK[(i + 1) % monTRACK.length];
  const seg = (i + 1 < monTRACK.length ? monTrackLen[i + 1] : monTrackTotal) - monTrackLen[i];
  const t = seg > 1e-6 ? (d - monTrackLen[i]) / seg : 0;
  out.x = a[0] + (b[0] - a[0]) * t;
  out.z = a[1] + (b[1] - a[1]) * t;
  out.y = a[2] + (b[2] - a[2]) * t;
  out.yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
  out.i = i;
  out.t = t;
  return out;
}
const monTrackTmp = { x: 0, y: 0, z: 0, yaw: 0, i: 0, t: 0 };
const monTrackTmp2 = { x: 0, y: 0, z: 0, yaw: 0, i: 0, t: 0 };

/**
 * DISTANCE FROM THE TARMAC, and the road height there.
 *
 * Two numbers, one loop, and every one of the four things that needs the road
 * asks this: the terrain (blend toward `y`), the kerbs (draw at `d` ~ half),
 * the tunnel (which segment am I on) and the marshals. Cached on (x, z) because
 * the terrain build calls it a hundred and twenty thousand times.
 */
let monRoadD = 0, monRoadY = 0, monRoadI = -1, monRoadS = 0;
function monRoad(x, z) {
  monInitTrack();
  let best = 1e9, by = 0, bi = -1, bs = 0;
  for (let i = 0; i < monTRACK.length; i++) {
    const a = monTRACK[i], b = monTRACK[(i + 1) % monTRACK.length];
    const d = monSegD(x, z, a[0], a[1], b[0], b[1]);
    if (d < best) {
      best = d; bi = i;
      by = a[2] + (b[2] - a[2]) * monSegT;
      const seg = (i + 1 < monTRACK.length ? monTrackLen[i + 1] : monTrackTotal) - monTrackLen[i];
      bs = monTrackLen[i] + seg * monSegT;
    }
  }
  monRoadD = best; monRoadY = by; monRoadI = bi; monRoadS = bs;
  return best;
}

/**
 * THE GROUND. One authority, and it is cheap: nine plateaus, one road blend and
 * one basin cut. No raycasts, no lookups, no allocation.
 */
function monTerrain(x, z) {
  const bed = monSeabed(x, z);
  let h = bed;
  for (let i = 0; i < monPADS.length; i++) {
    const p = monPad(x, z, monPADS[i], bed);
    if (p > h) h = p;
  }
  // ---- THE ROAD PULLS THE GROUND TO IT ---------------------------------
  // Blended over the shoulder rather than stamped, so the tarmac is a ribbon
  // laid across a hillside and not a trench cut into one. Inside the half
  // width the road wins outright, which is what makes a lap driveable.
  const d = monRoad(x, z);
  if (d < monTRACK_HALF + monTRACK_SHLD) {
    const k = d <= monTRACK_HALF ? 1
            : monSmooth(1 - (d - monTRACK_HALF) / monTRACK_SHLD);
    h = h + (monRoadY - h) * k;
  }
  // ---- AND THE BASIN IS CUT OUT OF IT ----------------------------------
  // A harbour is a hole with a wall round it. The rim is four metres wide,
  // which at a five-metre heightfield cell is one ramp — steep enough to read
  // as a quay and shallow enough that an animal that has fallen in can get out
  // anywhere rather than only at the two slipways.
  if (x > monPORT.x0 - 6 && x < monPORT.x1 + 6 && z > monPORT.z0 - 6 && z < monPORT.z1 + 6) {
    const ix = Math.min(x - monPORT.x0, monPORT.x1 - x);
    const iz = Math.min(z - monPORT.z0, monPORT.z1 - z);
    const inn = Math.min(ix, iz);
    if (inn > 0) {
      const k = monSmooth(clamp(inn / 4.0, 0, 1));
      h = h + (monPORT_BED - h) * k;
    }
  }
  return h;
}
/** Land only — the terrain with the sea taken out. Used to place people. */
function monLandOnly(x, z) {
  const h = monTerrain(x, z);
  return h;
}

function monSlope(x, z) {
  const e = 1.6;
  const hx = monTerrain(x + e, z) - monTerrain(x - e, z);
  const hz = monTerrain(x, z + e) - monTerrain(x, z - e);
  return Math.sqrt(hx * hx + hz * hz) / (2 * e);
}

function monIsOverWater(x, z) {
  return monTerrain(x, z) < monWATER - 0.05;
}

// --------------------------------------------------------------------- slip --
// Four surfaces and they are places on the map, not a global setting. Nothing
// here is Iceland — you are never going to fall over in Monaco — but a marble
// atrium under a wet animal that has just climbed out of the harbour should not
// hold it like a lawn, and a tarmac road in April should.
const monSLIP_ROAD  = 0.00;
const monSLIP_STONE = 0.04;
const monSLIP_QUAY  = 0.10;       // salt and diesel
const monSLIP_DECK  = 0.16;       // varnished teak
const monSLIP_MARB  = 0.30;       // the atrium, and it is polished every night
function monGroundSlip(x, z) {
  if (monInCasino(x, z)) return monSLIP_MARB;
  if (monRoad(x, z) < monTRACK_HALF + 0.6) return monSLIP_ROAD;
  if (monOnQuay(x, z)) return monSLIP_QUAY;
  return monSLIP_STONE;
}
/**
 * A BIOME MAY ANSWER FOR ITS OWN FOOTSTEPS. < 0.9 soft, ~1.0 stone, > 1.15
 * hollow timber. Monaco is stone with two exceptions and both of them matter:
 * the pontoons are timber over water and the atrium is a drum.
 */
function monSurfacePitch(x, z, y) {
  if (monInCasino(x, z)) return 1.22;
  if (monOnPontoon(x, z)) return 1.30;
  if (monRoad(x, z) < monTRACK_HALF + 0.4) return 0.96;
  return 1.04;
}

// ----------------------------------------------------------------- the zones
const monZ = {
  quay:     { x0: -60, x1: 62, z0: -104, z1: -2 },
  port:     { x0: monPORT.x0, x1: monPORT.x1, z0: monPORT.z0, z1: monPORT.z1 },
  condamine:{ x0: -66, x1: 60, z0: -4, z1: 56 },
  square:   { x0: 62, x1: 156, z0: 46, z1: 96 },
  casino:   { x0: monCASINO.x - monCASINO.w * 0.5, x1: monCASINO.x + monCASINO.w * 0.5,
              z0: monCASINO.z - monCASINO.d * 0.5, z1: monCASINO.z + monCASINO.d * 0.5 },
  salon:    { x0: 108, x1: 142, z0: 100, z1: 120 },
  rock:     { x0: -206, x1: -98, z0: -96, z1: 4 },
  palace:   { x0: -172, x1: -118, z0: -44, z1: -4 },
  hairpin:  { x0: 152, x1: 190, z0: 20, z1: 52 },
  tunnel:   { x0: 66, x1: 162, z0: -94, z1: -4 },
  mole:     { x0: -62, x1: 66, z0: -112, z1: -96 },
};
function monInRect(r, x, z) { return x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1; }
function monInCasino(x, z) {
  return monInRect(monZ.casino, x, z) || monInRect(monZ.salon, x, z);
}
function monOnQuay(x, z) {
  if (!monInRect(monZ.quay, x, z)) return false;
  return !monInRect(monZ.port, x, z);
}
function monInZone(name, x, z) {
  if (name === 'casino') return monInCasino(x, z);
  if (name === 'tunnel') return monUnderTunnel(x, z);
  if (name === 'quay') return monOnQuay(x, z);
  const r = monZ[name];
  return r ? monInRect(r, x, z) : false;
}
function monRandomPointIn(name) {
  const r = monZ[name];
  if (!r) return { x: 0, z: 0 };
  for (let i = 0; i < 24; i++) {
    const x = rand(r.x0, r.x1), z = rand(r.z0, r.z1);
    if (monTerrain(x, z) > monWATER + 0.2) return { x: x, z: z };
  }
  return { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 };
}
