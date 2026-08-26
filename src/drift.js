import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PALETTE, mat, rand, randInt, clamp, damp, lerp, grain, grainOwn } from './shared.js';

// ===========================================================================
// CHAPTER 9 — THE DRIFT
//
// Eight chapters in, every place in this game is a place: somewhere a capybara
// can be a nuisance to somebody, laid out flat, with a horizon on it. The ninth
// is not a place at all, and it is built on three things nothing else here has.
//
//  1. THE GROUND IS OPTIONAL. Gravity is a third of what it is anywhere else
//     and there is far more air than there is island. Every other chapter is
//     walked; this one is JUMPED, and a hop that clears a kerb in Sydney clears
//     eleven metres of nothing up here. There is no floor to fall back to —
//     only a cloud, and it is kind about it.
//
//  2. THE WHEEK IS A WING. Press the voice key with your feet off the ground
//     and the animal squeaks and BOUNCES — one puff per flight, recharged the
//     moment anything solid is under it again. Nine chapters of the noise
//     startling people, calling birds and buying ferry tickets, and this is the
//     first time it has ever moved the capybara itself. One mouth, one button,
//     and the context decides: see CONTRACT.md, "ONE VOICE".
//
//  3. THE WIND TURNS. A slow current runs through the void — you can read it in
//     the seed-fluff, which is the only reason it is legible at all — and it
//     swings all the way over and back on a thirty-eight second breath. A gap
//     you cannot cross now, you can cross in twenty seconds. That is the whole
//     pacing of the place: it is a chapter that asks you to WAIT, which is a
//     thing this game has asked for exactly once before (a hot spring, seven
//     seconds, chapter seven) and got a lot of mileage out of.
//
// Everything else follows from those. There is nobody up here to rob, so the
// list is made of movement: puff, fall, column, wanderer, the long crossing,
// and then the lantern. There is no fail state and no drowning — falling off
// is not a punishment, it is a slow lovely twelve seconds through the dark and
// a soft landing in cloud that then hands you back up. A chapter about leaping
// between rocks with nothing underneath cannot ALSO be a chapter about being
// punished for missing; you would stop leaping, and leaping is the chapter.
//
// The archipelago, from the bottom:
//
//   y = -0.5 ....... THE CLOUD SEA. It fills the whole world, it is the only
//                    'water' in the biome, and everything that falls ends here.
//   y = 0 .......... THE SHELF. Spawn: a big drowned meadow with a lamp-post
//                    on it, a broken jetty pointing at nothing, and mist over
//                    the edges. Two lampflies live here, which is the tutorial.
//   y = 3 -> 11 .... THE STAIRS. Five small islands stepping north-west.
//   y = 11 ......... THE ANVIL, and beside it the first COLUMN.
//   y = 46 -> 58 ... THE SHOALS. The orchard (where the lampflies are), the
//                    arch, two wandering islands, and THE LONG GAP.
//   y = 78 ......... THE CROWN, the lantern, and the way out.
//
// Everything is prefixed `dri` (contract: the bundler flattens every module
// into one scope).
// ===========================================================================

// ------------------------------------------------------------- the numbers --
const driSPAWN   = { x: 2, y: 31.6, z: 42 };
const driCLOUD_Y = -0.5;             // the cloud top == this game's water level
const driGRAVITY = -8.6;             // against -24 everywhere else: 0.36 g
const driAIR_CTRL = 0.64;            // against 0.35 everywhere else

// THE PUFF. One per flight. 4.9 m/s at g = 8.6 buys 1.4 m of rise and about
// 1.1 s of extra hang, which at a run is another eight metres of gap — enough
// that it is always the difference between making a jump and not, and never so
// much that the archipelago becomes flat.
const driPUFF_V     = 4.9;
const driPUFF_LOCK  = 0.12;          // s after a hop before the puff will arm
const driPUFF_FWD   = 1.5;           // m/s of nudge along the stick

// THE WIND. Read by capybara.js as the velocity of the parcel of air the animal
// is in — exactly the way the ferry deck is read — so it is free of the speed
// cap for the same reason the deck is: it is the frame, not the animal.
const driWIND_MAX   = 2.75;          // m/s at the top of the breath
const driBREATH     = 38;            // s for a full swing over and back
const driWIND_TURN  = 0.041;         // rad/s the axis itself rotates
const driGUST       = 0.30;          // m/s of texture on top

// THE COLUMNS. Rising air, and the only lift in the chapter that is not a jump.
const driCOL_LIFT   = 11.0;          // m/s the column wants you doing
const driCOL_LAMBDA = 4.0;           // how fast it gets you there
const driCOL_FADE   = 7.0;           // m of taper at the top, so it sets you down

// THE BLOOM. Fall in the cloud and after a beat it gathers under you and hands
// you back. The disc it forms also STOPS BEING WATER for as long as it lasts,
// which is what ends the swim — see driIsOverWater.
const driBLOOM_WAIT = 1.15;          // s in the cloud before it gathers
const driBLOOM_LIFE = 5.6;
const driBLOOM_R    = 7.0;
const driBLOOM_N    = 26;            // puffs of cloud in the thing
const driBLOOM_TOP  = 38;

const driLONG_GAP   = 20;            // m of a single flight that counts as a crossing
const driCOL_CLIMB  = 26;            // m of rise in one column that counts as a ride
const driFLIES_NEED = 6;             // lampflies awake before the lantern will take
const driWAKE_R     = 9.5;           // wheek reach for a sleeping lampfly
const driRIDE_T     = 6.0;           // s aboard a wanderer

const driFLY_N      = 46;
const driMOTE_N     = 150;
const driCOLM_N     = 132;           // column motes, all three columns in one mesh
const driSTAR_N     = 300;
const driWISP_N     = 48;

// --------------------------------------------------------------- the world --
// hx / hz are HALF extents, because that is what CANNON.Box takes and the
// footprint test wants; the merger below takes FULL extents and every call
// site doubles explicitly. One convention per file — CONTRACT.md, "SIZES".
//
// `kind`: 'green' meadow, 'pale' the orchard's bleached grass, 'bare' stone.
const driISLES = [
  // ---- the Shelf: spawn, and the only island half in the cloud ----------
  { id: 'shelf',   x:   0, z:  30, y:    30, hx: 20, hz: 14, yaw:  0.00, kind: 'green', drop:  9 },
  // ---- the Stairs. The gaps open out deliberately: nine metres, then
  //      twelve, then fourteen, then fifteen. Nine is a hop you cannot fail;
  //      fifteen is a running hop held to the top of the arc and is the last
  //      thing on this route you can do without the puff.
  { id: 'stepA',   x:  -4, z:  -2, y:  33, hx:  6, hz:  5, yaw:  0.22, kind: 'green', drop:  7 },
  { id: 'stepB',   x: -25, z: -15, y:  35.8, hx: 5.5, hz:  5, yaw: -0.30, kind: 'green', drop:  7 },
  { id: 'stepC',   x:  -3, z: -35, y:  38.6, hx:  6, hz:  5, yaw:  0.14, kind: 'green', drop:  8 },
  { id: 'anvil',   x: -38, z: -47, y: 41.5, hx:  9, hz:  8, yaw: -0.10, kind: 'bare',  drop: 11 },
  // ---- the Shoals, thirty-five metres higher, reached by the first column
  { id: 'shoalA',  x: -56, z: -80, y:   76, hx: 10, hz:  9, yaw:  0.18, kind: 'green', drop: 10 },
  { id: 'orchard', x: -38, z: -114, y:  80, hx: 15, hz: 12, yaw: -0.08, kind: 'pale',  drop: 13 },
  { id: 'arch',    x:   3, z: -103, y:   84, hx:  9, hz:  8, yaw:  0.26, kind: 'bare',  drop: 10 },
  // ---- and THE LONG GAP -------------------------------------------------
  // Twenty-five metres across and TWELVE METRES DOWN, and the drop is the only
  // reason it is possible. The first cut had the far side four metres HIGHER,
  // which quietly made it unclearable: a held running hop is airborne for 2.2 s
  // if it has to arrive four metres up, and even a perfect puff on a perfect
  // tailwind measured 22.6 m against the 24.7 it needed. Falling twelve buys
  // 3.6 s instead, which is 26.6 m at a run — so in dead calm the puff is
  // exactly what makes it, a tailwind makes it comfortable, and into the wind
  // you cannot do it at all and have to wait for the breath to come round.
  // That last sentence is the entire chapter.
  { id: 'farside', x:  42, z: -137, y:   72, hx: 12, hz: 10, yaw: -0.20, kind: 'green', drop: 12 },
  // ---- the Crown -------------------------------------------------------
  { id: 'crown',   x:  36, z: -184, y:   108, hx: 16, hz: 14, yaw:  0.06, kind: 'pale',  drop: 16 },
  // ---- grace notes: one tree, one stone, somewhere unnecessary to stand --
  { id: 'pebA',    x:  24, z:  -6, y:  36, hx:  3, hz:  3, yaw:  0.50, kind: 'green', drop:  5 },
  { id: 'pebB',    x: -70, z: -24, y:  39, hx: 3.5, hz:  3, yaw: -0.70, kind: 'bare',  drop:  6 },
  { id: 'pebC',    x:  16, z: -60, y:   64, hx:  3, hz: 2.5, yaw:  0.90, kind: 'green', drop:  5 },
  { id: 'pebD',    x: -72, z: -150, y:   92, hx:  4, hz: 3.5, yaw: -0.40, kind: 'pale',  drop:  7 },
  { id: 'pebE',    x:  66, z: -96, y:   70, hx: 3.5, hz:  3, yaw:  0.30, kind: 'green', drop:  6 },
  { id: 'pebF',    x:   6, z: -150, y:   96, hx:  4, hz: 3.5, yaw:  0.15, kind: 'bare',  drop:  6 },
  // ---- the deep field. You will almost certainly never stand on any of
  //      these; they are there so that the horizon is a place rather than a
  //      colour, and so that a fall has something to fall PAST.
  { id: 'deepA',   x: -110, z:  40, y:  34, hx:  9, hz:  8, yaw:  0.40, kind: 'green', drop: 12 },
  { id: 'deepB',   x:  92, z:  20, y:  32.5, hx:  8, hz:  7, yaw: -0.50, kind: 'green', drop: 11 },
  { id: 'deepC',   x: 110, z: -70, y:   47, hx: 10, hz:  8, yaw:  0.20, kind: 'bare',  drop: 14 },
  { id: 'deepD',   x: -116, z: -160, y:  60, hx: 11, hz:  9, yaw: -0.25, kind: 'pale',  drop: 15 },
  { id: 'deepE',   x: -10, z: -234, y:   84, hx: 12, hz: 10, yaw:  0.10, kind: 'green', drop: 16 },
  { id: 'deepF',   x: 100, z: -186, y:   74, hx: 10, hz:  9, yaw: -0.15, kind: 'bare',  drop: 13 },
  // ---- AND A SECOND RANK BEHIND THAT ------------------------------------
  // Six deep islands over a world four hundred metres across is a horizon with
  // six things on it, and from the Crown — a hundred and eight metres up, which
  // is where the chapter ends — you can see all of them at once and count them.
  // The far field is the only thing in this biome that gives a fall a SIZE (the
  // wisps do altitude; these do distance) and the only thing standing between
  // the archipelago and the fog. Eight more, further out, smaller, and well
  // above or below the route so none of them reads as somewhere you were meant
  // to go. They never overlap in plan: driIslandAt is single-valued and every
  // spatial question in this file resolves to it.
  { id: 'farA',    x: -178, z:  -18, y:   26, hx:  8, hz:  7, yaw:  0.55, kind: 'green', drop: 13 },
  { id: 'farB',    x:  172, z:  -34, y:   58, hx:  9, hz:  7, yaw: -0.35, kind: 'bare',  drop: 15 },
  { id: 'farC',    x: -150, z: -246, y:   44, hx: 10, hz:  8, yaw:  0.15, kind: 'pale',  drop: 16 },
  { id: 'farD',    x:  158, z: -262, y:   96, hx:  8, hz:  7, yaw: -0.60, kind: 'green', drop: 12 },
  { id: 'farE',    x:  -62, z:  110, y:   40, hx:  9, hz:  8, yaw:  0.30, kind: 'green', drop: 14 },
  { id: 'farF',    x:   84, z:  104, y:   22, hx:  7, hz:  6, yaw: -0.20, kind: 'bare',  drop: 11 },
  { id: 'farG',    x: -196, z: -128, y:   78, hx:  7, hz:  6, yaw:  0.45, kind: 'pale',  drop: 12 },
  { id: 'farH',    x:  200, z: -140, y:   34, hx:  8, hz:  7, yaw: -0.10, kind: 'green', drop: 13 },
];

// The wanderers. Kinematic, driven by VELOCITY (never by writing position), so
// capybara.js picks them up as a moving floor exactly the way it picks up the
// ferry — everything the animal does is then solved in the island's own frame
// and standing still means standing still ON THE ISLAND. allowSleep is off:
// a sleeping body is skipped in narrowphase and the floor would stop existing.
// Precomputed at load rather than at build: systems.js asks driTerrain() for
// the camera clearance and the task beacon, and it may well ask before the
// biome has ever been attached.
for (let i = 0; i < driISLES.length; i++) {
  driISLES[i].cos = Math.cos(driISLES[i].yaw);
  driISLES[i].sin = Math.sin(driISLES[i].yaw);
}

const driWANDER = [
  // wander1 crosses the south side of the LONG GAP, and it is the chapter's
  // one act of mercy: twenty-five metres in a single leap is the hardest thing
  // in the biome, and this turns it into two hops of about twelve for anybody
  // who would rather not. It is deliberately NOT on the line — you still have
  // to leave the arch and commit to something — and it is deliberately slow
  // enough that taking it is the longer way round.
  { id: 'wander1', x0:  12, z0: -132, x1:  32, z1: -108, y: 86, hx: 6, hz: 5, period: 31, phase: 0.00, kind: 'green', drop: 8 },
  { id: 'wander2', x0: -14, z0: -54, x1: -14, z1: -88, y: 58, hx: 6, hz: 5, period: 27, phase: 0.35, kind: 'green', drop: 7 },
  { id: 'wander3', x0:   4, z0: -166, x1:  4, z1: -200, y: 100, hx: 5, hz: 4.5, period: 24, phase: 0.62, kind: 'bare', drop: 6 },
];

// The columns. r is the full-strength radius; lift tapers to nothing at 1.35r
// so the edge is a shoulder rather than a wall you bounce off.
const driCOLS = [
  // The bases sit just over the cloud on purpose: a column is not only the way
  // UP from the island below it, it is the way BACK from anywhere you fall, and
  // a lift that starts thirty metres in the air would be no use to a capybara
  // paddling about at the bottom of the world.
  { id: 'col1', x: -59, z:  -58, r: 8.0, base: 0.4, top:  96 },   // shoalA is at 76
  { id: 'col2', x:  34, z: -159, r: 8.0, base: 0.4, top: 128 },   // the Crown is at 108
  { id: 'col3', x: -72, z: -128, r: 6.5, base: 0.4, top: 108 },   // pebD is at 92
];

const driLANTERN = { x: 36, z: -190, y: 108 };
const driJETTY   = { x: 28, z: 34 };          // the broken end of it
const driLAMP    = { x: -9, z: 34 };
const driARCH    = { x: 5, z: -106, y: 84 };  // and the near lip of the Long Gap
const driARCH_MARK = [];     // the warm points on the gateway and on both lips
const driPENNANTS  = [];     // x, y, z of each rag on a pole
const driPEN_SEG = 3;
let driPennantMesh = null;

// ------------------------------------------------------------------ scratch --
const driV3 = new THREE.Vector3();
const driQ  = new THREE.Quaternion();
const driEu = new THREE.Euler();
const driSc = new THREE.Vector3();
const driM  = new THREE.Matrix4();
const driWindOut = { x: 0, z: 0 };

// -------------------------------------------------------------------- state --
let driGame = null;
let driBuilt = false;
let driRoot = null;
let driTime = 0;
let driPrevGravity = -24;

let driCloudMesh = null, driCloudAttr = null, driRipT = 0;
let driSkyRig = null, driStars = null, driMoon = null;
const driRibbons = [];               // { mesh, attr, base, phase, speed, wave, amp, peak, col }

let driMoteMesh = null;
const driMoteData = new Float32Array(driMOTE_N * 6);   // x,y,z,spin,size,drift
let driColMesh = null;
let driColStones = null, driColStoneMat = null;
let driColWas = false, driColRing = 0;
const driColData = new Float32Array(driCOLM_N * 5);    // col, ang, t, radius, size
let driFlyMesh = null, driFlyMat = null;
let driFlyHalo = null, driFlyHaloMat = null;
const driFlyData = new Float32Array(driFLY_N * 11);
// per lampfly: 0 x, 1 y, 2 z, 3 homeX, 4 homeY, 5 homeZ, 6 phase, 7 awake(0/1),
//              8 slot (its place in the tail), 9 bob rate, 10 the time it woke
let driWispMesh = null;
const driWispData = new Float32Array(driWISP_N * 5);   // x,y,z,scale,rate

let driLanternGroup = null, driLanternPaper = null, driLanternMat = null;
let driLanternHalo = null, driLanternPool = null;
let driHearthPool = null;
let driEmberMesh = null, driEmberMat = null;
const driEMBER_N = 40;
const driEmberData = new Float32Array(driEMBER_N * 4);   // bearing, radius, height, rise
let driVaneGroup = null;
const driBOWLS = [];
let driBowlMat = null;
const driMovers = [];                // { def, mesh, body, x, z, t }

let driWindX = 0, driWindZ = 0, driWindAng = 0;
let driShelter = 1;                  // 1 in open air, 0.2 inside a column
let driPuffReady = true, driPuffT = 0, driAirT = 0;
let driWasGrounded = true;
let driFlightX = 0, driFlightZ = 0, driFlightOn = false, driFlightBest = 0;
let driInCloud = 0;                  // s continuously in the cloud
// ---- AND THE CLOUD ANSWERS THE WHEEK ------------------------------------
// The wheek does four things in this chapter — it wakes a lampfly, it flushes
// the roost, it holds you up in mid-air, and two people at the far end answer
// it — and the fifth place a player uses it constantly is the one place it did
// nothing at all: sitting in the cloud at the bottom of the world, having just
// fallen off something, waiting for the bloom. That is a low moment by
// construction (it is the chapter's own apology for the drop) and it is
// exactly where a world should say something back. A ring runs out across the
// whole sheet, which is four multiplies a vertex on a mesh that is already
// being rewritten every other frame.
let driWhoopT = -1, driWhoopX = 0, driWhoopZ = 0, driWhoopSaid = false;
const driWHOOP_LIFE = 4.2;
let driBloomOn = false, driBloomT = 0, driBloomX = 0, driBloomZ = 0;
let driBloomMesh = null;
const driBloomData = new Float32Array(driBLOOM_N * 4);   // ang, radius, yOff, scale
let driRideT = 0, driRideId = '';
let driColPeak = 0, driColIdx = -1, driColFoot = 0;
let driFliesAwake = 0;
let driLit = false, driLitT = 0, driGlow = 0;
let driPuffDone = false, driFlyDone = false, driDiveDone = false;
let driColDone = false, driRideDone = false, driGapDone = false, driLanternDone = false;
let driHintPuff = false, driHintWind = false, driHintFlies = false;
let driLastGlow = -1, driLastTint = -1;

// ============================================================== primitives ==
function driXform(px, py, pz, rx, ry, rz, sx, sy, sz) {
  driEu.set(rx, ry, rz, 'YXZ');
  driQ.setFromEuler(driEu);
  driV3.set(px, py, pz);
  driSc.set(sx, sy, sz);
  driM.compose(driV3, driQ, driSc);
  return driM;
}

const driG = { box: null, cyl16: null, cyl6: null, cyl8: null, cyl4: null, cone6: null, cone4: null, sph6: null, tet: null, oct: null, quad: null };
function driInitGeos() {
  if (driG.box) return;
  driG.box = new THREE.BoxGeometry(1, 1, 1);
  driG.cyl6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
  driG.cyl8 = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
  driG.cyl4 = new THREE.CylinderGeometry(0.5, 0.5, 1, 4);
  // AND ONE ROUND ONE. Everything else in this file is faceted on purpose;
  // a fifteen-metre disc of light is the one thing that cannot be, because at
  // that size eight sides is a visible octagon lying on the grass.
  driG.cyl16 = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
  driG.cone6 = new THREE.ConeGeometry(0.5, 1, 6);
  driG.cone4 = new THREE.ConeGeometry(0.5, 1, 4);
  driG.sph6 = new THREE.SphereGeometry(0.5, 6, 4);
  driG.tet = new THREE.TetrahedronGeometry(0.5);
  driG.oct = new THREE.OctahedronGeometry(0.5);
  // A FLAT QUAD LYING IN XZ. Ground detail seen from above and below and never
  // from the side — a fern blade, a leaf — is 2 triangles, not 12. Same
  // argument as Marrakech's sand ripples (CONTRACT.md).
  driG.quad = new THREE.PlaneGeometry(1, 1);
  driG.quad.rotateX(-Math.PI / 2);
}

/** Vertex-coloured geometry merger — one draw call per merged batch. */
function driMerger() {
  const pos = [], nor = [], col = [], idx = [];
  const c = new THREE.Color();
  const M = {
    n: 0,
    add(geo, m4, color) {
      const g = geo.clone();
      g.applyMatrix4(m4);
      const p = g.attributes.position.array;
      const nm = g.attributes.normal.array;
      c.set(color);
      const start = M.n;
      for (let i = 0; i < p.length; i += 3) {
        pos.push(p[i], p[i + 1], p[i + 2]);
        nor.push(nm[i], nm[i + 1], nm[i + 2]);
        col.push(c.r, c.g, c.b);
      }
      const vc = p.length / 3;
      if (g.index) { const ia = g.index.array; for (let i = 0; i < ia.length; i++) idx.push(start + ia[i]); }
      else { for (let i = 0; i < vc; i++) idx.push(start + i); }
      M.n += vc;
      g.dispose();
      return M;
    },
    // FULL extents in. CANNON.Box takes HALF; driStaticBox does the halving.
    box(cx, cy, cz, sx, sy, sz, color, rx, ry, rz) {
      return M.add(driG.box, driXform(cx, cy, cz, rx || 0, ry || 0, rz || 0, sx, sy, sz), color);
    },
    cyl(cx, cy, cz, r, h, color, rx, ry, rz, seg) {
      const g = seg === 4 ? driG.cyl4 : seg === 8 ? driG.cyl8
              : seg === 16 ? driG.cyl16 : driG.cyl6;
      return M.add(g, driXform(cx, cy, cz, rx || 0, ry || 0, rz || 0, r * 2, h, r * 2), color);
    },
    cone(cx, cy, cz, r, h, color, rx, ry, rz, seg) {
      const g = seg === 4 ? driG.cone4 : driG.cone6;
      return M.add(g, driXform(cx, cy, cz, rx || 0, ry || 0, rz || 0, r * 2, h, r * 2), color);
    },
    sph(cx, cy, cz, rx2, ry2, rz2, color) {
      return M.add(driG.sph6, driXform(cx, cy, cz, 0, 0, 0, rx2 * 2, ry2 * 2, rz2 * 2), color);
    },
    oct(cx, cy, cz, s, color, rx, ry, rz) {
      return M.add(driG.oct, driXform(cx, cy, cz, rx || 0, ry || 0, rz || 0, s, s, s), color);
    },
    tet(cx, cy, cz, s, color, rx, ry, rz) {
      return M.add(driG.tet, driXform(cx, cy, cz, rx || 0, ry || 0, rz || 0, s, s, s), color);
    },
    /**
     * Take geometry that ALREADY carries its own colour attribute, in world
     * space. `add` above writes one flat colour over everything it is given,
     * which is right for a primitive and wrong for a painted deck — see
     * driDeck. Same buffers, same draw call.
     */
    addPainted(g) {
      const p = g.attributes.position.array;
      const nm = g.attributes.normal.array;
      const gc = g.attributes.color.array;
      const start = M.n;
      for (let i = 0; i < p.length; i += 3) {
        pos.push(p[i], p[i + 1], p[i + 2]);
        nor.push(nm[i], nm[i + 1], nm[i + 2]);
        col.push(gc[i], gc[i + 1], gc[i + 2]);
      }
      const vc = p.length / 3;
      if (g.index) { const ia = g.index.array; for (let i = 0; i < ia.length; i++) idx.push(start + ia[i]); }
      else { for (let i = 0; i < vc; i++) idx.push(start + i); }
      M.n += vc;
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
function driVC() {
  return grain(mat(0xffffff, { vertexColors: true }),
               { scale: 0.3, amount: 0.07, warp: 0.5 });
}
function driPush9(l, px, py, pz, rx, ry, rz, sx, sy, sz) { l.push(px, py, pz, rx, ry, rz, sx, sy, sz); }
function driInstance(root, geo, material, list, cast, recv) {
  const n = list.length / 9;
  if (n < 1) return null;
  const im = new THREE.InstancedMesh(geo, material, n);
  for (let i = 0; i < n; i++) {
    const o = i * 9;
    im.setMatrixAt(i, driXform(list[o], list[o + 1], list[o + 2], list[o + 3], list[o + 4],
                               list[o + 5], list[o + 6], list[o + 7], list[o + 8]));
  }
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  im.castShadow = !!cast;
  im.receiveShadow = !!recv;
  // ---- AND `cast === false` HAS TO SURVIVE THE TRAVERSE -------------------
  // systems.js answers registerShadowTarget with
  // `traverse(n => { if (n.isMesh) n.castShadow = true })`, and an
  // InstancedMesh extends Mesh, so `isMesh` is true on every batch in this
  // file. driNoShadowOnGhosts undoes that again — but only for materials it
  // can RECOGNISE as a ghost (transparent, additive, no depth write, no fog).
  // An opaque Lambert batch authored `cast = false` sailed straight through
  // both: measured, 172 fern quads and 78 emissive blossom octahedra were
  // casting hard shadows onto the one orchard the chapter asks you to spend
  // the longest on, and both call sites had said `false` since the day they
  // were written. The flag is the honest channel; the material sniff is the
  // fallback.
  if (!cast) im.userData.noShadow = true;
  root.add(im);
  return im;
}
/**
 * THE TRAVERSE THAT UNDOES EVERY `castShadow = false` IN THIS FILE.
 *
 * `registerShadowTarget` is the last line of the build and systems.js answers
 * it with `o3d.traverse(n => { if (n.isMesh) n.castShadow = true })`, so every
 * `castShadow = false` above is silently reverted four lines later. Measured
 * here: 300 stars three hundred metres out, the moon and its three halo discs,
 * five aurora ribbons, fifteen additive column shells, 150 motes, 46 lampflies,
 * 34 wisps, the bloom, the puff ring, the embers, both light pools, the five
 * seed-heads (8,820 triangles of dandelion clock, explicitly authored NOT to
 * cast) and the skein. Iceland and Rio have both had this; the Drift had not,
 * and it is a NIGHT chapter — a shadow cast by a star is nothing, but a shadow
 * cast by a three-metre ball of fluff onto the one meadow the chapter opens on
 * is a grey disc on the grass.
 */
function driNoShadowOnGhosts(root) {
  root.traverse(function (n) {
    if (!n.isMesh && !n.isInstancedMesh) return;
    if (n.userData && n.userData.noShadow) { n.castShadow = false; return; }
    const m = Array.isArray(n.material) ? n.material[0] : n.material;
    if (!m) return;
    if (m.transparent || m.depthWrite === false || m.blending === THREE.AdditiveBlending ||
        m.fog === false) {
      n.castShadow = false;
    }
  });
}

/** Contract, "Rendering physics transforms": carry the history forward by hand. */
function driSyncBody(b) {
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
  b.previousQuaternion.copy(b.quaternion);
  b.interpolatedQuaternion.copy(b.quaternion);
}
/** Full extents in, half extents to CANNON — one convention per file. */
function driStaticBox(game, x, y, z, sx, sy, sz, ry) {
  const b = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
  b.addShape(new CANNON.Box(new CANNON.Vec3(sx * 0.5, sy * 0.5, sz * 0.5)));
  b.position.set(x, y, z);
  if (ry) b.quaternion.setFromEuler(0, ry, 0);
  driSyncBody(b);
  game.world.addBody(b);
  return b;
}
/**
 * ONE BODY PER ROW OF THINGS — AND THIS CHAPTER WAS FIFTY PER CENT OVER.
 *
 * MEASURED, by walking `world.bodies` with the biome live: 197 static bodies
 * against CONTRACT.md's hard limit of 130, and every one of them carrying
 * exactly one Box because `driStaticBox` spends a whole `CANNON.Body` per call.
 * It is not one big thing: SEVENTY-FIVE of them are the field walls, one body
 * per stone, on nine islands. The rest are the twenty-nine island decks, the
 * column monoliths, the two camps and the keepers' furniture.
 *
 * Rio, Iceland and Marrakech all took this fix during their own passes
 * (`rioStaticGroup`, `iceStaticGroup`, `sahStaticGroup`) and the Drift is the
 * one chapter that never got the helper, which is exactly why it is the one
 * chapter over the budget. A CANNON.Body takes any number of shapes with
 * offsets and a compound body is ONE broadphase entry.
 *
 * IT IS DELIBERATELY GROUPED PER ISLAND, not per file. A compound body's AABB
 * is the union of its shapes, so one body holding all seventy-five wall stones
 * would have an AABB spanning four hundred metres of sky and would be tested
 * against everything, every step, for ever — which is the trap noted against
 * `qa/audit-solid.js` in the Rio/Iceland pass. Grouped per island the AABBs
 * stay the size of an island, which is what the broadphase wants.
 *
 * Returns a collector: `.add(x, y, z, sx, sy, sz, ry)` in FULL extents, then
 * `.done()`.
 */
function driStaticGroup(game) {
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
      driSyncBody(b);
      game.world.addBody(b);
      return b;
    },
  };
  return G;
}

// ================================================================ GEOGRAPHY ==
/**
 * WHICH ISLAND IS UNDER (x, z), OR NOTHING AT ALL.
 *
 * This is the whole of the biome's geography and every other spatial question
 * in the file resolves to it. Islands never overlap in plan, so a single-valued
 * answer is honest — which matters, because `terrainHeight` is a scalar
 * contract that every other biome in the game satisfies with a landscape and
 * this one has to satisfy with holes.
 *
 * The wanderers are tested against where they ARE this frame, not against where
 * they were authored. A moving island whose footprint is stale is a floor the
 * capybara falls through at one end and stands on thin air at the other.
 */
function driIslandAt(x, z) {
  for (let i = 0; i < driISLES.length; i++) {
    const s = driISLES[i];
    const dx = x - s.x, dz = z - s.z;
    const c = s.cos, sn = s.sin;
    const lx = dx * c + dz * sn, lz = -dx * sn + dz * c;
    if (lx > -s.hx && lx < s.hx && lz > -s.hz && lz < s.hz) return s;
  }
  for (let i = 0; i < driMovers.length; i++) {
    const m = driMovers[i], d = m.def;
    const lx = x - m.x, lz = z - m.z;
    if (lx > -d.hx && lx < d.hx && lz > -d.hz && lz < d.hz) return m;
  }
  // THE JETTY IS PART OF THE SHELF. Its planks run out to x = 30.5 and the
  // Shelf's own footprint stops at x = 20, so for the last ten metres of the
  // one walkway in the chapter this function answered "no island here" — which
  // made isOverWater TRUE on solid decking (switching off the analytic floor
  // backstop, which the whole chapter leans on), and put driTerrain at the
  // cloud sea, thirty metres below the boards. The `cloud-dive` beacon is
  // planted at driTerrain(jetty), so the marker for the chapter's third task
  // was floating in the cloud under the jetty rather than standing on the end
  // of it.
  if (x > 13.5 && x < 30.5 && z > 32.3 && z < 35.7) return driISLES[0];
  return null;
}


/**
 * The ground height at (x, z). Over an island it is that island's deck; over
 * the void it is the cloud, which is the bottom of the world and the answer the
 * camera's clearance test and the task beacon both want.
 */
function driTerrain(x, z) {
  const s = driIslandAt(x, z);
  return s ? (s.def ? s.def.y : s.y) : driCLOUD_Y;
}
/** Flat decks, all of them. Nothing in this chapter slides. */
function driSlope() { return 0; }

/**
 * IS THERE CLOUD UNDER YOU?
 *
 * Everywhere that is not an island, which is most of the biome. capybara.js
 * uses this for three separate things and each of them is load-bearing here:
 * it decides whether to swim, it switches the analytic floor backstop OFF (so
 * a gap is genuinely a gap and not an invisible ledge at cloud height), and it
 * arms the clamber that gets you back out.
 *
 * The bloom is the exception, and it is the trick that makes falling pleasant:
 * while the cloud is gathering under the animal that patch of it STOPS being
 * water, which ends the swim, hands control back, and lets the column below
 * lift a capybara that would otherwise be pinned to the waterline by its own
 * buoyancy spring.
 */
function driIsOverWater(x, z) {
  if (driBloomOn) {
    const bx = x - driBloomX, bz = z - driBloomZ;
    if (bx * bx + bz * bz < driBLOOM_R * driBLOOM_R) return false;
  }
  return !driIslandAt(x, z);
}
function driSurfaceY() { return driCLOUD_Y; }

function driInZone(name, x, z) {
  const s = driIslandAt(x, z);
  const id = s ? (s.def ? s.def.id : s.id) : '';
  if (name === 'island') return !!s;
  if (name === 'wander') return !!(s && s.def);
  if (name === 'cloud') return !s;
  if (name === 'crown') return id === 'crown';
  if (name === 'orchard') return id === 'orchard';
  if (name === 'shelf') return id === 'shelf';
  // the way out: the lantern's plinth, and only once it is burning
  if (name === 'plinth') {
    if (!driLit) return false;
    const dx = x - driLANTERN.x, dz = z - driLANTERN.z;
    return dx * dx + dz * dz < 8 * 8;
  }
  return false;
}
function driNavBlocked() { return false; }

/** Which column contains (x, y, z), or -1. Also fills driColStrength. */
let driColStrength = 0;
function driColumnAt(x, y, z) {
  driColStrength = 0;
  let best = -1;
  for (let i = 0; i < driCOLS.length; i++) {
    const c = driCOLS[i];
    if (y < c.base || y > c.top) continue;
    const dx = x - c.x, dz = z - c.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    const outer = c.r * 1.35;
    if (d > outer) continue;
    // full strength in the core, a shoulder to the edge, and a taper at the top
    // so the column sets you down instead of holding you against a ceiling
    let s = d <= c.r ? 1 : 1 - (d - c.r) / (outer - c.r);
    const head = c.top - y;
    if (head < driCOL_FADE) s *= clamp(head / driCOL_FADE, 0, 1);
    if (s > driColStrength) { driColStrength = s; best = i; }
  }
  return best;
}
/** The temporary one the cloud makes under a fallen capybara. */
function driBloomLift(x, y, z) {
  if (!driBloomOn || y > driBLOOM_TOP) return 0;
  const dx = x - driBloomX, dz = z - driBloomZ;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d > driBLOOM_R) return 0;
  const head = driBLOOM_TOP - y;
  return (1 - d / driBLOOM_R) * clamp(head / driCOL_FADE, 0, 1);
}

// =================================================================== BUILD ==
/**
 * AN ISLAND IS A SLAB WITH A ROOT.
 *
 * Flat on top and rectangular in plan, and both of those are deliberate rather
 * than lazy: the collider is ONE CANNON.Box whose footprint is exactly the
 * footprint `driIslandAt` tests, so there is never a frame where the geometry
 * says ground and the solver says air, or the other way round. Everything that
 * makes it read as a torn-off piece of a country — the crag hanging under it,
 * the rim boulders, the grass overhanging the edge — is decoration outside the
 * collider, where being wrong by twenty centimetres costs nothing.
 */
function driIsleColours(kind) {
  if (kind === 'pale') return [PALETTE.driGrassPale, PALETTE.driMoss, PALETTE.driRockPale, PALETTE.driRock];
  if (kind === 'bare') return [PALETTE.driStone, PALETTE.driRockPale, PALETTE.driRock, PALETTE.driRockDark];
  return [PALETTE.driGrass, PALETTE.driGrassDark, PALETTE.driRock, PALETTE.driRockDark];
}

/**
 * THE DECK, AND IT IS A PAINTED SURFACE NOW RATHER THAN ONE BOX.
 *
 * Every island's top was a single `M.box` in one flat value with a scatter of
 * EIGHT-SIDED discs of a second tone laid on it for grain. Rendered — and most
 * of this chapter is rendered from above, because most of this chapter is a
 * fall — that is a green rectangle with visible octagons lying on it, and on
 * the Crown and the arch island (where the marquee and the hardest jump are)
 * they are the first thing the eye lands on. The fourth time this family of
 * chapters has learned that eight sides is a shape at anything over three
 * metres across.
 *
 * A grid instead: nine by seven cells over the deck, with the colour written
 * per VERTEX. That buys three things the box could not have at any price —
 * mottling with no edge anywhere, a darker band round the rim where the grass
 * thins toward the tear, and moss pooling in the middle — for 126 triangles
 * against 12, which across twenty-five islands is 2,850 in a chapter with
 * sixty thousand of headroom. It also stays exactly flat, so the collider (one
 * CANNON.Box whose top face IS this plane) still cannot disagree with it.
 */
function driDeck(M, x, z, y, hx, hz, yaw, top, top2, moss, seed) {
  // ---- AND THE DECK HAS TO STOP BEING A SHEET OF PAPER --------------------
  // Nine by seven segments and DEAD FLAT. This camera looks down at about
  // forty degrees, and a perfectly horizontal plate presents its whole top
  // face — which is why Manly's rock pools, the Pantanal's lily rims and the
  // Antarctic sastrugi all had to be re-cut. Every island in this chapter is
  // seen from above, most of them from a long way above, and thirty of them
  // came out as thirty flat green rectangles no amount of vertex grain could
  // rescue.
  //
  // Relief, and it is allowed to be SMALL: the collider is one CANNON.Box
  // whose top face is exactly `y`, so the painted deck may never rise above
  // it. It hangs between y and y − 0.10 instead, tapered to flush at the rim
  // (a dip at the very edge would be a visible slot all the way round), which
  // is under the ten centimetres of relief a surface mark is allowed and is
  // still enough for the moon to find an edge in it.
  const NX = 13, NZ = 10;
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cA = new THREE.Color(), cB = new THREE.Color(top2), cM = new THREE.Color(moss);
  const g = new THREE.PlaneGeometry(hx * 2 - 0.3, hz * 2 - 0.3, NX, NZ);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position.array;
  const col = new Float32Array(p.length);
  for (let i = 0; i < p.length; i += 3) {
    const lx = p[i], lz = p[i + 2];
    {
      const rr = Math.max(Math.abs(lx) / hx, Math.abs(lz) / hz);
      const w = Math.sin(lx * 0.55 + seed * 1.3) * Math.sin(lz * 0.47 - seed) * 0.6 +
                Math.sin(lx * 0.23 - lz * 0.31 + seed) * 0.4;
      p[i + 1] = (-0.05 + w * 0.05) * clamp((0.94 - rr) * 3.2, 0, 1);
    }
    cA.set(top);
    // two incommensurable waves, so nothing tiles, plus the seed so no two
    // islands in the archipelago carry the same pattern
    const n = Math.sin(lx * 0.42 + seed) * Math.sin(lz * 0.31 - seed * 0.7) +
              Math.sin(lx * 0.17 - lz * 0.23 + seed * 1.9) * 0.7;
    cA.lerp(cB, clamp(0.30 + n * 0.30, 0, 0.72));
    // moss pools where nothing walks, which is the middle
    const r = Math.max(Math.abs(lx) / hx, Math.abs(lz) / hz);
    cA.lerp(cM, clamp((0.62 - r) * 0.9, 0, 0.42) * (0.5 + 0.5 * Math.sin(lx * 0.27 + lz * 0.19)));
    // and it thins to bare ground at the torn edge
    cA.lerp(cB, clamp((r - 0.72) * 2.6, 0, 0.55));
    col[i] = cA.r; col[i + 1] = cA.g; col[i + 2] = cA.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  // the merger's `add` takes a matrix and a colour; the colour it would write is
  // thrown away here because the geometry already carries one, so it is passed
  // white and multiplied through.
  const mm = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0, 'YXZ'));
  // FIVE MILLIMETRES UNDER THE COLLIDER'S TOP FACE, and the rock cap below is
  // raised to meet it. The collider is one CANNON.Box whose top IS y, so the
  // painted plane may not sit above it (the animal would stand inside the
  // grass) and may not sit far below it (a visible slot round the whole rim).
  mm.compose(new THREE.Vector3(x, y - 0.005, z), q, new THREE.Vector3(1, 1, 1));
  g.applyMatrix4(mm);
  M.addPainted(g);
  g.dispose();
  return cy + sy * 0;   // keep the signature honest; the caller ignores it
}

/**
 * `MN` is the SHADOW-FREE half of an island and it is the reason this chapter
 * can afford to be three times denser than it was.
 *
 * A casting triangle is drawn twice, and 72 % of the Drift's geometry was
 * flagged `castShadow` — including the whole underside of every island, which
 * is a cone and five tetrahedra hanging BELOW a deck, in a world whose only
 * light is a moon thirteen degrees up. Nothing under a floating island can
 * shadow anything: there is no floor. The lips, the corner slabs and the crag
 * are pure silhouette. So they go into a second merged mesh that never casts,
 * exactly the way antarctic.js splits the glacier's marks off its seracs.
 *
 * The DECK, the rim boulders and the tufts stay in the casting mesh, because
 * they are the surface the player and the trees stand on and their shadows
 * land on the deck itself.
 *
 * Callers that hand one merger twice (the wanderers, which are small, move,
 * and are their own mesh anyway) get the old behaviour for free.
 */
/**
 * ...AND A SILHOUETTE MAY NOT PAY A NEAR-FIELD PRICE.
 *
 * `det` is the detail term: 1 for the islands you land on, less for the ranks
 * you only ever see. Every island in this chapter was built with the same torn
 * lip, the same spike fringe and the same three ribs whether it was the
 * six-metre pebble under your feet or a far-field island four hundred metres
 * out — and MEASURED, that made `dri:under` fifty thousand triangles, a
 * quarter of the chapter, for twenty-six islands nobody can resolve. This
 * scales the COUNTS only; the shape is untouched, so the lip still goes all
 * the way round and the crag is still torn rather than conical. At 110 m a lip
 * plate is under a pixel wide.
 */
function driAddIsle(M, x, z, y, hx, hz, yaw, kind, drop, tufts, seed, MN, det) {
  if (!MN) MN = M;
  if (!(det > 0)) det = 1;
  const c = driIsleColours(kind);
  const top = c[0], top2 = c[1], rock = c[2], rockDk = c[3];
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  // the deck: a painted grid over a metre of rock, top face exactly at y
  // ...and the second tone has to BE a second tone. The first cut passed
  // driRockPale and driStone for 'bare', which are four values apart and one
  // of which is the top colour itself — so the stone islands (the Anvil, and
  // the arch where the hardest jump in the chapter starts) came out as one
  // unbroken pale grey rectangle, which is worse than the octagons it replaced.
  driDeck(M, x, z, y, hx, hz, yaw, top,
          kind === 'bare' ? PALETTE.driRock : top2,
          kind === 'bare' ? PALETTE.driRockPale : PALETTE.driMoss, seed);
  M.box(x, y - 0.18, z, hx * 2 - 0.3, 0.34, hz * 2 - 0.3, top, 0, yaw, 0);
  MN.box(x, y - 0.85, z, hx * 2, 1.05, hz * 2, rock, 0, yaw, 0);
  // the crag: a ragged inverted cone plus a few tetrahedra hanging off it
  const rad = Math.max(hx, hz);
  MN.cone(x, y - 1.35 - drop * 0.5, z, rad * 1.02, drop, rock, Math.PI, yaw * 0.5, 0, 6);
  for (let i = 0; i < 5; i++) {
    const a = seed * 1.7 + i * 1.257;
    const rr = rad * (0.35 + 0.34 * ((i * 7 + seed) % 5) / 5);
    const dy = -1.6 - drop * (0.18 + 0.12 * i);
    MN.tet(x + Math.cos(a) * rr, y + dy, z + Math.sin(a) * rr,
           rad * (0.34 + 0.16 * ((i + seed) % 3)), i % 2 ? rockDk : rock, a, a * 0.6, a * 0.3);
  }
  // ---- AND THE CRAG IS NOT A CONE ---------------------------------------
  // One six-sided cone and five tetrahedra is what a floating island looks
  // like in a diagram. It is TORN OFF something, and the thing you see most of
  // in this chapter is exactly this face: you fall past it, you look up at it
  // from the cloud, and you approach every island in the biome from below
  // because the route climbs. Three ribs of rock stepping down the cone, a
  // fringe of spikes round its shoulder, and a broken keel under the deepest
  // point. All in MN, all silhouette, none of it casting anything.
  {
    const ribK = Math.max(2, Math.round(4 * det));
    for (let rib = 0; rib < 3; rib++) {
      const a = seed * 0.9 + rib * 2.094;
      const ca = Math.cos(a), sa = Math.sin(a);
      for (let k = 0; k < ribK; k++) {
        const f = 0.82 - k * 0.19;                     // in toward the axis
        const dy = -1.2 - drop * (0.16 + k * 0.21);
        MN.box(x + ca * rad * f, y + dy, z + sa * rad * f,
               rad * (0.52 - k * 0.09), drop * 0.30, rad * (0.44 - k * 0.08),
               k % 2 ? rockDk : rock, sa * 0.34, a + k * 0.3, -ca * 0.34);
      }
    }
    const spN = Math.max(det < 1 ? 5 : 7, Math.round(rad * 1.3 * det));
    for (let i = 0; i < spN; i++) {
      const a = i / spN * 6.28318 + seed * 1.3;
      const rr = rad * (0.72 + ((i * 11 + seed) % 5) * 0.055);
      const ln = drop * (0.22 + ((i * 7 + seed) % 4) * 0.09);
      MN.cone(x + Math.cos(a) * rr, y - 1.5 - ln * 0.5, z + Math.sin(a) * rr,
              rad * 0.13, ln, i % 3 ? rock : rockDk, Math.PI, a, 0, 4);
    }
    // the keel: the deepest tooth, always on the long axis, which gives the
    // island an up and a down from four hundred metres away
    MN.cone(x, y - 1.4 - drop * 0.92, z, rad * 0.30, drop * 0.8, rockDk,
            Math.PI, yaw, 0, 6);
  }
  // ---- THE TORN EDGE ------------------------------------------------------
  // Every island in this chapter is a rectangle, and it has to be: the collider
  // is one CANNON.Box and driIslandAt tests exactly that footprint, so the plan
  // may not lie. Rendered from above, though, sixteen sharp-cornered green
  // rectangles hanging in a violet sky read as placeholders — a floating island
  // is a piece TORN OFF something.
  //
  // The fix has to stay honest: these plates hang BELOW the deck and slope
  // DOWNWARD, so they are visibly not ground. Nobody tries to stand on a lip
  // that is already falling away, and if they do, the drop is what the whole
  // chapter is about.
  {
    // TWICE AS MANY, AND THEY HAVE TO OVERLAP. At 0.7 per metre of half-extent
    // the Crown got twenty-one plates round a hundred and twenty metres of
    // perimeter — one every five and a half metres, each about two and a half
    // wide — so between every pair of them there were three metres of dead
    // straight machined edge. Rendered from anywhere above the deck (which is
    // most of this chapter, because most of this chapter is a fall) the
    // archipelago was sixteen green rectangles. A torn edge is torn ALL THE
    // WAY ROUND or it is a rectangle with some decoration on it.
    const lipN = Math.max(det < 1 ? 10 : 16, Math.round((hx + hz) * 1.7 * det));
    for (let i = 0; i < lipN; i++) {
      const t = i / lipN * 6.28318 + seed * 0.7;
      const ex = Math.cos(t), ez = Math.sin(t);
      // walk out to the rectangle's edge along this bearing
      const k = Math.min(hx / Math.max(0.0001, Math.abs(ex)), hz / Math.max(0.0001, Math.abs(ez)));
      const out = 0.7 + ((i * 19 + seed) % 7) * 0.28;
      const px = ex * (k + out * 0.5), pz2 = ez * (k + out * 0.5);
      const wx = x + px * cy - pz2 * sy, wz = z + px * sy + pz2 * cy;
      // AND IT MAY NOT COME BACK UP THROUGH THE DECK. A 3.9 m plate tilted
      // half a radian lifts a corner a metre above its own centre, which put
      // the far corner of the lip ABOVE the island it hangs off — a shelf of
      // grass standing proud of the ground with no collider under it, which is
      // the exact thing this was drawn to avoid. Smaller, flatter, lower: the
      // highest corner now finishes level with the deck.
      const drp = 0.26 + out * 0.2;
      MN.box(wx, y - 0.45 - drp * 0.5, wz,
             out * 1.2 + 1.5, 0.28, out * 1.2 + 1.5, i % 4 ? top : top2,
             ez * 0.24, t, -ex * 0.24);
      // a second, deeper plate under every third one, so the edge has a
      // THICKNESS to it rather than being one sheet of green with a fringe
      if (i % 3 === 0) {
        MN.box(wx + ex * 0.5, y - 1.35 - drp, wz + ez * 0.5,
               out * 1.4 + 1.8, 0.36, out * 1.4 + 1.8, i % 6 ? rock : rockDk,
               ez * 0.42, t + 0.3, -ex * 0.42);
      }
    }
    // ---- AND THE CORNERS, because a corner is what a rectangle IS ---------
    // Four right angles is the entire tell. Each one gets a slab hanging off
    // it at a different angle, big enough to break the line and low enough
    // that nothing about it looks like ground.
    for (let c = 0; c < 4; c++) {
      const sx2 = (c & 1) ? 1 : -1, sz2 = (c & 2) ? 1 : -1;
      const px = sx2 * hx, pz2 = sz2 * hz;
      const wx = x + px * cy - pz2 * sy, wz = z + px * sy + pz2 * cy;
      const sz3 = Math.min(hx, hz) * 0.55 + 1.4;
      MN.box(wx + sx2 * sz3 * 0.22, y - 0.75 - sz3 * 0.10, wz + sz2 * sz3 * 0.22,
             sz3 * 1.5, 0.4, sz3 * 1.5, c % 2 ? top2 : rock,
             sz2 * 0.30, seed + c, -sx2 * 0.30);
      MN.tet(wx + sx2 * sz3 * 0.55, y - 1.9 - sz3 * 0.2, wz + sz2 * sz3 * 0.55,
             sz3 * 1.1, c % 2 ? rock : rockDk, seed + c, c * 1.4, seed * 0.4);
    }
  }
  // rim boulders, so the edge is torn rather than sawn
  const per = Math.max(det < 1 ? 6 : 10, Math.round((hx + hz) * 1.1 * det));
  for (let i = 0; i < per; i++) {
    const t = i / per * 6.28318 + seed;
    const ex = Math.cos(t) * hx * 0.99, ez = Math.sin(t) * hz * 0.99;
    const wx = x + ex * cy - ez * sy, wz = z + ex * sy + ez * cy;
    const s = 0.55 + ((i * 13 + seed) % 7) * 0.13;
    M.oct(wx, y - 0.42 - s * 0.12, wz, s, i % 3 ? rock : rockDk, t * 0.7, t, t * 0.4);
  }
  // ...AND NO PATCHES. What used to be here was `Math.max(6, hx * hz * 0.12)`
  // eight-sided discs of a second tone laid flat on the deck for grain — on the
  // Crown that is twenty-six visible OCTAGONS on the island the chapter's `wow`
  // stands on, and on the arch island three of them fill the frame from which
  // the hardest jump in the game is taken. Grain with no edge on it belongs in
  // the vertex colours of the surface it is grain OF: see driDeck.
  // tufts and pebbles on the deck, scattered but never on the very edge
  if (tufts) {
    const n = Math.round(hx * hz * (kind === 'bare' ? 0.30 : 0.16));
    for (let i = 0; i < n; i++) {
      const a = seed * 3.1 + i * 2.399;
      const u = ((i * 17 + seed * 3) % 100) / 100;
      const ex = (Math.cos(a) * u) * (hx - 1.4), ez = (Math.sin(a) * u) * (hz - 1.4);
      const wx = x + ex * cy - ez * sy, wz = z + ex * sy + ez * cy;
      if (kind === 'bare') M.oct(wx, y + 0.16, wz, rand(0.3, 0.6), i % 2 ? rock : PALETTE.driStone, a, a, 0);
      else M.cone(wx, y + 0.26, wz, rand(0.22, 0.4), rand(0.5, 0.9), i % 3 ? top2 : top, 0, a, 0, 4);
    }
  }
}

/**
 * THE THIRD RANK, WHICH IS ONLY A HORIZON.
 *
 * The far field (`farA`..`farH`) is the outermost thing the player can reach a
 * conclusion about; beyond it the chapter was fog and eight stars. These are
 * two hundred and sixty to four hundred metres out — three times the width of
 * the playable archipelago — and they exist for one reason: a fall in this
 * chapter is twelve seconds long, and for eleven of them you want to be
 * passing something.
 *
 * They are NOT in driISLES and they get no collider, deliberately. driIslandAt
 * is the whole geography of the biome and it must stay single-valued and
 * honest; a silhouette that answered terrainHeight would be a floor the animal
 * could never actually reach. Nothing here is inside the 210 m the camera and
 * the minimap bound, so nothing here is ever something the player tries to
 * jump to.
 */
const driFARFIELD = [
  { x: -300, z:   60, y:  10, hx: 14, hz: 11, kind: 'bare',  drop: 22 },
  { x:  286, z:   96, y:  62, hx: 12, hz: 10, kind: 'green', drop: 20 },
  { x: -262, z: -330, y:  18, hx: 16, hz: 12, kind: 'pale',  drop: 26 },
  { x:  318, z: -260, y: 122, hx: 13, hz: 11, kind: 'bare',  drop: 21 },
  { x:  -74, z:  268, y:  74, hx: 15, hz: 12, kind: 'green', drop: 24 },
  { x:  156, z:  246, y:   6, hx: 11, hz:  9, kind: 'bare',  drop: 18 },
  { x: -348, z: -104, y:  96, hx: 12, hz: 10, kind: 'green', drop: 19 },
  { x:  372, z:  -40, y:  30, hx: 14, hz: 11, kind: 'pale',  drop: 23 },
  { x:   30, z: -368, y:  56, hx: 17, hz: 13, kind: 'bare',  drop: 28 },
  { x: -196, z:  216, y:  38, hx: 10, hz:  9, kind: 'bare',  drop: 17 },
  { x:  240, z: -390, y:  86, hx: 12, hz: 10, kind: 'green', drop: 20 },
  { x: -400, z:  -18, y: 132, hx:  9, hz:  8, kind: 'pale',  drop: 15 },
];

/**
 * ROOTS, WHICH ARE THE HALF OF A FLOATING ISLAND THIS CHAPTER NEVER DREW.
 *
 * Every island up here came off something. What that leaves is not a cone: it
 * is a torn root plate with a curtain of it hanging out of the wound, and it
 * is the face of the archipelago the player sees MOST — the route climbs, so
 * you approach every island from underneath, and the chapter's one failure
 * state is a twelve-second fall past all of them.
 *
 * Instanced tapered cylinders in three lengths plus a fringe of double-sided
 * quads for the fine stuff. `cast` is false on all of it: there is nothing
 * under a floating island for a shadow to land on, and 900 root segments each
 * drawn twice would have paid for the whole of the rest of this pass.
 */
function driBuildRoots(root) {
  const thick = [], thin = [], hairs = [];
  function curtain(s, y, hx, hz, yaw, drop, dens, seed) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const n = Math.max(9, Math.round((hx + hz) * dens));
    for (let i = 0; i < n; i++) {
      const t = i / n * 6.28318 + seed * 0.61;
      const u = 0.30 + ((i * 23 + seed) % 9) * 0.072;         // in from the rim
      const ex = Math.cos(t) * hx * u, ez = Math.sin(t) * hz * u;
      const wx = s.x + ex * cy - ez * sy, wz = s.z + ex * sy + ez * cy;
      // Longest under the middle, shortest at the rim: a root plate is deepest
      // where the tree that made it was, and a curtain of equal-length rods is
      // a comb.
      const len = drop * (0.45 + (1 - u) * 0.85) * (0.72 + ((i * 13 + seed) % 5) * 0.13);
      const lean = 0.10 + ((i * 7 + seed) % 4) * 0.05;
      // three segments, each thinner and more slanted than the last, so a root
      // TAPERS and WANDERS rather than being a peg
      let py = y - 1.1, r = 0.22 + (1 - u) * 0.18, a = t;
      for (let k = 0; k < 3; k++) {
        const sl = len * (0.44 - k * 0.09);
        py -= sl * 0.5;
        driPush9(k === 0 ? thick : thin,
                 wx + Math.cos(a) * k * lean * len * 0.30, py,
                 wz + Math.sin(a) * k * lean * len * 0.30,
                 Math.sin(a) * lean, a, -Math.cos(a) * lean,
                 r, sl, r);
        py -= sl * 0.5;
        r *= 0.62; a += 0.9;
      }
      // and the hair: two crossed blades on the end of every other root, which
      // is what stops the curtain reading as cutlery
      if (i % 2 === 0) {
        for (let h = 0; h < 2; h++) {
          driPush9(hairs, wx + Math.cos(a) * 0.3, py - 0.5, wz + Math.sin(a) * 0.3,
                   1.35, a + h * 1.4, 0, 0.5, 1, len * 0.30);
        }
      }
    }
  }
  for (let i = 0; i < driISLES.length; i++) {
    const s = driISLES[i];
    // the deep and far ranks get a thinner one — they are silhouettes, and a
    // full curtain on all thirty is four thousand instances for a horizon
    const deep = s.id.indexOf('deep') === 0 || s.id.indexOf('far') === 0;
    curtain(s, s.y, s.hx, s.hz, s.yaw, s.drop, deep ? 0.50 : 1.45, i + 3);
  }
  const mRoot = mat(PALETTE.driBark);
  driInstance(root, driG.cyl6, mRoot, thick, false, false);
  driInstance(root, driG.cyl4, mat(PALETTE.driSoil), thin, false, false);
  driInstance(root, driG.quad, mat(PALETTE.driSoil, { side: THREE.DoubleSide }),
              hairs, false, false);
}

function driBuildIslands(game, root) {
  const M = driMerger();     // the deck and what stands on it: casts
  const MN = driMerger();    // everything below the deck: silhouette, never casts
  for (let i = 0; i < driISLES.length; i++) {
    const s = driISLES[i];
    s.cos = Math.cos(s.yaw); s.sin = Math.sin(s.yaw);
    // The DEEP and FAR ranks never cast at all. They are a hundred and ten to
    // two hundred metres out with nothing under them and nothing beside them;
    // every triangle of theirs in the shadow pass was drawn twice for a
    // shadow that lands in the void.
    const deep = s.id.indexOf('deep') === 0 || s.id.indexOf('far') === 0;
    driAddIsle(deep ? MN : M, s.x, s.z, s.y, s.hx, s.hz, s.yaw, s.kind, s.drop, true,
               i + 1, MN, deep ? 0.45 : 1);
    // The collider is six metres deep so nothing can tunnel through a deck at
    // terminal velocity, and its top face is exactly the deck. Nothing else in
    // the biome is allowed to disagree with this box.
    driStaticBox(game, s.x, s.y - 3, s.z, s.hx * 2, 6, s.hz * 2, s.yaw);
  }
  for (let i = 0; i < driFARFIELD.length; i++) {
    const f = driFARFIELD[i];
    driAddIsle(MN, f.x, f.z, f.y, f.hx, f.hz, i * 0.7, f.kind, f.drop, false, 90 + i, MN,
               0.28);
  }
  const mesh = new THREE.Mesh(M.build(), driVC());
  mesh.name = 'dri:isles';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);
  const under = new THREE.Mesh(MN.build(), driVC());
  under.name = 'dri:under';
  under.castShadow = false;
  under.receiveShadow = true;
  under.userData.noShadow = true;
  root.add(under);
}

/**
 * THE WANDERERS. Their own meshes, because they move; kinematic bodies driven
 * by VELOCITY, because that is the only way capybara.js can solve in their
 * frame; and allowSleep off, because a sleeping body is skipped in narrowphase
 * and the floor of a moving platform silently stops existing.
 */
function driBuildWanderers(game, root) {
  for (let i = 0; i < driWANDER.length; i++) {
    const d = driWANDER[i];
    const M = driMerger();
    driAddIsle(M, 0, 0, 0, d.hx, d.hz, 0, d.kind, d.drop, true, 40 + i);
    // a ring of trailing seed-fluff so you can see it coming from a long way off
    for (let k = 0; k < 7; k++) {
      const a = k / 7 * 6.28318;
      M.oct(Math.cos(a) * (d.hx + 2.4), rand(0.6, 2.2), Math.sin(a) * (d.hz + 2.2),
            rand(0.22, 0.4), PALETTE.driSeed, a, a, 0);
    }
    // ---- AND YOU CAN HEAR IT COMING ---------------------------------------
    // A wandering island is a moving platform in a chapter where a missed step
    // is a twelve-second fall, and the only way to know one was on its way was
    // to be looking at it. wander1 crosses the south side of the Long Gap and
    // is the chapter's one act of mercy on the hardest jump in it — a player
    // waiting on the lip for the breath to come round should be able to hear
    // the alternative arriving. Somebody hung a bell on each of them: a post,
    // a yoke and a clapper, and driUpdateWanderers rings it at the ends of the
    // run, which is exactly when the island changes direction.
    M.cyl(0, 3.4, 0, 0.11, 6.8, PALETTE.driTimber, 0, 0, 0, 6);
    M.box(0, 6.7, 0, 1.5, 0.20, 0.20, PALETTE.driBark);
    M.cyl(0, 6.05, 0, 0.46, 1.0, PALETTE.driStone, 0, 0, 0, 8);
    M.cyl(0, 6.58, 0, 0.30, 0.14, PALETTE.driRockPale, 0, 0, 0, 8);
    M.oct(0, 5.45, 0, 0.22, PALETTE.driRockPale, 0, 0.5, 0);
    // (no beacon on it: driBEACON is sampled once at build and a wanderer's
    // position is not a constant, so a mark here would hang over the island's
    // starting point for the rest of the chapter.)
    const mesh = new THREE.Mesh(M.build(), driVC());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);

    const body = new CANNON.Body({
      mass: 0, type: CANNON.Body.KINEMATIC,
      material: (game.mats && game.mats.ground) || undefined,
    });
    body.addShape(new CANNON.Box(new CANNON.Vec3(d.hx, 3, d.hz)));
    body.allowSleep = false;
    body.position.set(d.x0, d.y - 3, d.z0);
    driSyncBody(body);
    game.world.addBody(body);

    driMovers.push({ def: d, mesh, body, x: d.x0, z: d.z0, t: d.phase * d.period, y: d.y });
  }
}

// =================================================================== CLOUD ==
/**
 * THE CLOUD SEA. It is this biome's water — the one surface capybara.js already
 * knows how to swim in — and it is also the floor of the world, the safety net
 * and the reason there is no fail state. Two hundred and forty metres of it in
 * each direction, so that from the top of the crown, seventy-eight metres up,
 * it still runs out past the fog rather than ending in a visible edge.
 */
function driBuildCloud(root) {
  const g = new THREE.PlaneGeometry(560, 620, 56, 62);
  g.rotateX(-Math.PI / 2);
  g.translate(0, driCLOUD_Y, -60);
  const p = g.attributes.position.array;
  const col = new Float32Array(p.length);
  const c = new THREE.Color(), near = new THREE.Color(PALETTE.driCloudLit), far = new THREE.Color(PALETTE.driCloudDeep);
  for (let i = 0; i < p.length; i += 3) {
    const d = Math.sqrt(p[i] * p[i] + (p[i + 2] + 60) * (p[i + 2] + 60));
    c.copy(near).lerp(far, clamp(d / 230, 0, 1));
    col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  // A PRIVATE material: the lantern lifts this one's colour every frame once it
  // is lit, and mat() caches by colour + options — sharing the instance would
  // leave some other biome's water permanently gold.
  // The Shelf is five hundred metres of one colour with nothing on it. It gets
  // grain at cloud scale — long, soft, low-frequency — which is what stops it
  // reading as a painted floor. Grained BEFORE the clone so the lantern still
  // owns its own material instance; see the note above.
  // A SEA OF CLOUD IS STILL A SEA. It gets the glitter every other water in
  // this game gets — sparse, slow, cold, and only just over the threshold, so
  // it reads as vapour catching the moon rather than as a lake. grainOwn, not
  // grain(...).clone(): see shared.js. The clone was throwing the hook away and
  // the floor of this chapter has been one flat value ever since it was written.
  const m = new THREE.Mesh(g, grainOwn(mat(0xffffff, { vertexColors: true }),
                                    { scale: 0.26, amount: 0.10, warp: 0,
                                      sparkle: 0.30, sparkleScale: 0.55, sparkleSpeed: 0.10,
                                      sparkleCut: 0.665, sparkleBand: 0.13,
                                      sparkleColor: PALETTE.driCloudLit }));
  m.receiveShadow = true;
  m.frustumCulled = false;
  driCloudAttr = g.attributes.position;
  driCloudMesh = m;
  root.add(m);

  // ---- THE TOP OF A CLOUD SEA, AND IT WAS A BEACH ------------------------
  // "Lumps sitting on the deck, so the cloud has a top rather than being a
  // sheet" — 120 squashed spheres 6 to 20 m across at driCloud, which is four
  // steps darker than the sheet they sit on. Measured off the frame from the
  // Anvil: a scatter of small grey STONES lying on a lilac floor, two hundred
  // metres below the only thing in the chapter that is supposed to be soft.
  //
  // Three things, and the first is the one that matters: a cloud top is LIGHTER
  // than the cloud beside it, never darker, because the light is coming from
  // above. Then: bigger and fewer overlapping masses rather than many separate
  // ones (the same argument as the sand ripples — either it is dense enough
  // that the eye stops resolving individuals, or every one of them is an
  // object), and each mass built of three offset lobes so it has no silhouette
  // of its own. 76 masses, 228 lobes, and no stones.
  const L = driMerger();
  for (let i = 0; i < 76; i++) {
    const a = rand(0, 6.283), rr = Math.sqrt(rand(0.02, 1)) * 250;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr - 60;
    const s = rand(16, 44);
    const pale = i % 4 ? PALETTE.driCloudLit : PALETTE.driCloud;
    for (let k = 0; k < 3; k++) {
      const ka = a * 1.7 + k * 2.1;
      L.sph(x + Math.cos(ka) * s * 0.34, driCLOUD_Y + 0.3 + k * 0.55,
            z + Math.sin(ka) * s * 0.30,
            s * (0.62 - k * 0.13), s * (0.11 - k * 0.02), s * (0.50 - k * 0.10), pale);
    }
  }
  const lm = new THREE.Mesh(L.build(), driVC());
  lm.receiveShadow = true;
  lm.castShadow = false;
  lm.userData.noShadow = true;
  lm.frustumCulled = false;
  root.add(lm);
}

/**
 * WISPS. Thin sheets of vapour strung between the islands at every altitude.
 * They are the only thing in the void that tells you how high up you are —
 * without them a leap from seventy-eight metres and a leap from three look
 * identical, because there is nothing in the frame to measure against.
 */
function driBuildWisps(root) {
  for (let i = 0; i < driWISP_N; i++) {
    const a = rand(0, 6.283), rr = 78 + Math.sqrt(rand(0, 1)) * 150;   // never near the route
    const o = i * 5;
    driWispData[o] = Math.cos(a) * rr;
    driWispData[o + 1] = rand(6, 118);
    driWispData[o + 2] = Math.sin(a) * rr - 60;
    driWispData[o + 3] = rand(16, 44);
    driWispData[o + 4] = rand(0.05, 0.16);
  }
  const m = mat(PALETTE.driCloud, { transparent: true, opacity: 0.30, depthWrite: false });
  const im = new THREE.InstancedMesh(driG.sph6, m, driWISP_N);
  im.frustumCulled = false;
  im.renderOrder = 1;
  driWispMesh = im;
  root.add(im);
}

/**
 * THE BLOOM, MADE VISIBLE.
 *
 * A soundless invisible force lifting the animal out of the cloud would read as
 * a bug, and it is the single most reassuring thing in the chapter — the moment
 * the player learns that falling is not a punishment. So it gets a body: a
 * couple of dozen puffs of the cloud itself, gathered under the capybara and
 * carried up with it, swelling as they take hold and thinning as they let go.
 */
function driBuildBloom(root) {
  for (let i = 0; i < driBLOOM_N; i++) {
    const o = i * 4;
    driBloomData[o] = rand(0, 6.283);
    driBloomData[o + 1] = Math.sqrt(rand(0.05, 1)) * driBLOOM_R * 0.85;
    driBloomData[o + 2] = rand(-2.6, 1.2);
    driBloomData[o + 3] = rand(2.6, 6.2);
  }
  const m = mat(0x000000, { emissive: PALETTE.driCloudLit, emissiveIntensity: 0.55,
                            transparent: true, opacity: 0.7, depthWrite: false });
  const im = new THREE.InstancedMesh(driG.sph6, m, driBLOOM_N);
  im.frustumCulled = false;
  im.visible = false;
  driBloomMesh = im;
  root.add(im);
}

function driSyncBloom(game) {
  if (!driBloomMesh) return;
  if (driBloomMesh.visible !== driBloomOn) driBloomMesh.visible = driBloomOn;
  if (!driBloomOn) return;
  const capy = game.capy;
  const y = capy && capy.position ? capy.position.y : 0;
  // swell over the first fifth of the life, thin away over the last third
  const u = 1 - clamp(driBloomT / driBLOOM_LIFE, 0, 1);
  const grow = clamp(u / 0.2, 0, 1) * clamp((1 - u) / 0.34, 0, 1);
  for (let i = 0; i < driBLOOM_N; i++) {
    const o = i * 4;
    const a = driBloomData[o] + driTime * 0.5;
    const r = driBloomData[o + 1] * (0.45 + 0.55 * grow);
    const sc = driBloomData[o + 3] * (0.3 + 0.7 * grow);
    driBloomMesh.setMatrixAt(i, driXform(
      driBloomX + Math.cos(a) * r, y + driBloomData[o + 2] * (0.5 + grow), driBloomZ + Math.sin(a) * r,
      0, a, 0, sc, sc * 0.42, sc));
  }
  driBloomMesh.instanceMatrix.needsUpdate = true;
}

// ===================================================================== SKY ==
/**
 * THE SKY RIDES WITH YOU — the same trick Iceland's aurora uses, and for the
 * same reason. The rig looks DOWN (41 degrees, 48 degree FOV: the top of the
 * frame points seventeen degrees below horizontal), so anything hung at a fixed
 * point is overhead from one end of the world and under the horizon at the
 * other. Parented to a group that tracks the capybara in x and z only, the moon
 * sits at the same low elevation wherever you stand.
 */
/**
 * A tapered strip: full height in the middle, nothing at either end, so its
 * ends feather instead of stopping. Two triangles per segment, no texture, and
 * the ripple in driUpdateRibbons walks its vertices exactly as before.
 */
function driRibbonGeo(len, h, seg) {
  const pos = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const u = i / seg;
    const x = (u - 0.5) * len;
    const taper = Math.pow(Math.sin(Math.PI * u), 0.7);
    pos.push(x, 0, 0);
    pos.push(x, h * taper, 0);
  }
  for (let i = 0; i < seg; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function driBuildSky(root) {
  driSkyRig = new THREE.Group();
  root.add(driSkyRig);

  // stars: tetrahedra a long way out with the emissive turned all the way up
  const M = driMerger();
  for (let i = 0; i < driSTAR_N; i++) {
    const u = rand(0.012, 1), a = rand(0, 6.283);
    const r = Math.sqrt(1 - u * u), R = 330;
    M.tet(Math.cos(a) * r * R, u * R * 0.75 + 10, Math.sin(a) * r * R, rand(1.1, 3.0), PALETTE.driStar);
  }
  const stars = new THREE.Mesh(M.build(), mat(0x000000, {
    vertexColors: true, emissive: PALETTE.driStar, fog: false,
    transparent: true, opacity: 0.9, depthWrite: false,
  }));
  stars.frustumCulled = false;
  stars.renderOrder = -3;
  driStars = stars;
  driSkyRig.add(stars);

  // THE MOON. Twelve degrees up and a long way off, which is low enough to sit
  // in the top of an un-craned frame — it is the one thing in the chapter that
  // is visible from everywhere, and the whole palette is lit off it.
  const mg = new THREE.CircleGeometry(38, 26);
  const moon = new THREE.Mesh(mg, mat(0x000000, {
    emissive: PALETTE.driMoon, fog: false, depthWrite: false,
    transparent: true, opacity: 0.96,
  }));
  const ang = -0.62;
  moon.position.set(Math.sin(ang) * 320, 28, -Math.cos(ang) * 320);
  moon.lookAt(0, 16, 0);
  moon.renderOrder = -2;
  moon.frustumCulled = false;
  driMoon = moon;
  driSkyRig.add(moon);
  // ---- THE HALO IS A CURVE, NOT THREE STEPS -----------------------------
  // Three flat discs at 0.10 / 0.055 / 0.03 render as three concentric rings
  // with a hard edge at every boundary, on the one object in this chapter that
  // is in frame from everywhere. Exactly the note Iceland's sodium pools, the
  // Drift's own light pools and Venice's arcade lamps have all had: however
  // many rings you draw, each one is a flat value and there is a step at every
  // join. One disc, fourteen rings deep, with the brightness written PER VERTEX
  // on a squared falloff - no edge anywhere, and one draw call instead of three.
  {
    const HR = 92, RINGS = 14, SEG = 28;
    const hpos = [], hcol = [], hidx = [];
    hpos.push(0, 0, 0); hcol.push(1, 1, 1);
    for (let r = 1; r <= RINGS; r++) {
      const u = r / RINGS;
      const f = Math.pow(1 - u, 2.6);
      for (let k = 0; k < SEG; k++) {
        const a = k / SEG * 6.28318;
        hpos.push(Math.cos(a) * HR * u, Math.sin(a) * HR * u, 0);
        hcol.push(f, f, f);
      }
    }
    for (let k = 0; k < SEG; k++) hidx.push(0, 1 + k, 1 + (k + 1) % SEG);
    for (let r = 1; r < RINGS; r++) {
      const a0 = 1 + (r - 1) * SEG, b0 = 1 + r * SEG;
      for (let k = 0; k < SEG; k++) {
        const k2 = (k + 1) % SEG;
        hidx.push(a0 + k, b0 + k, a0 + k2, a0 + k2, b0 + k, b0 + k2);
      }
    }
    const hgeo = new THREE.BufferGeometry();
    hgeo.setAttribute('position', new THREE.Float32BufferAttribute(hpos, 3));
    hgeo.setAttribute('color', new THREE.Float32BufferAttribute(hcol, 3));
    hgeo.setIndex(hidx);
    const halo = new THREE.Mesh(hgeo, new THREE.MeshBasicMaterial({
      color: PALETTE.driMoon, vertexColors: true, fog: false, depthWrite: false,
      transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending,
    }));
    halo.position.copy(moon.position).multiplyScalar(1.03);
    halo.lookAt(0, 16, 0);
    halo.renderOrder = -3;
    halo.frustumCulled = false;
    halo.castShadow = false;
    halo.userData.noShadow = true;
    driSkyRig.add(halo);
  }

  // RIBBONS. Faint always, and the lantern is what turns them up. Hung LOW —
  // six to eighteen degrees of elevation — because that band is the only part
  // of the sky a downward-looking rig ever renders, and a ribbon at sixty
  // degrees is a ribbon nobody will ever see.
  const cols = [PALETTE.driRibbonA, PALETTE.driRibbonB, PALETTE.driRibbonC,
                PALETTE.driRibbonA, PALETTE.driRibbonB];
  for (let i = 0; i < cols.length; i++) {
    const len = 300, h = 40;
    const a2 = -1.5 + (i / (cols.length - 1)) * 3.0;
    const rad = 300 + (i % 3) * 55;
    const cx = Math.sin(a2) * rad, cz = -Math.cos(a2) * rad;
    const g = driRibbonGeo(len, h, 40);
    g.translate(0, 14, 0);
    const m = new THREE.Mesh(g, mat(0x000000, {
      emissive: cols[i],
      transparent: true,
      opacity: 0.0001 * (i + 1),        // a distinct mat() cache key per ribbon
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending,
    }));
    m.position.set(cx, 0, cz);
    m.rotation.y = -a2 + rand(-0.15, 0.15);
    m.frustumCulled = false;
    m.renderOrder = -1;
    driSkyRig.add(m);
    driRibbons.push({
      mesh: m, attr: g.attributes.position, base: Float32Array.from(g.attributes.position.array),
      phase: rand(0, 6.283), speed: rand(0.05, 0.13) * (i % 2 ? -1 : 1),
      wave: rand(0.005, 0.011), amp: 11 + i * 2.5, peak: 0.30 + (i % 2) * 0.14,
    });
  }
}

// ================================================================= COLUMNS ==
/**
 * The columns are invisible physics, so they are given a body: a slow helix of
 * seed-husks climbing each one. This is the only signpost in the chapter — you
 * are meant to see a spiral of light going up out of the dark and understand,
 * without a word of UI, that it is a lift.
 */
function driBuildColumnMotes(root) {
  const per = Math.floor(driCOLM_N / driCOLS.length);
  for (let i = 0; i < driCOLM_N; i++) {
    const ci = Math.min(driCOLS.length - 1, Math.floor(i / per));
    const o = i * 5;
    driColData[o] = ci;
    driColData[o + 1] = rand(0, 6.283);
    driColData[o + 2] = Math.random();
    driColData[o + 3] = rand(0.35, 1.0);
    driColData[o + 4] = rand(0.55, 1.25);
  }
  const m = mat(0x000000, { emissive: PALETTE.driSeed, transparent: true, opacity: 0.9, depthWrite: false });
  const im = new THREE.InstancedMesh(driG.oct, m, driCOLM_N);
  im.frustumCulled = false;
  driColMesh = im;
  root.add(im);

  // the shaft: an open cone of almost nothing, additive, so overlapping air
  // genuinely gets brighter and the column has a body at any distance
  // ---- ONE SHELL IS A BAND WITH AN EDGE ON IT -----------------------------
  // A single double-sided additive cylinder is exactly TWICE the sky brightness
  // everywhere inside its silhouette and exactly the sky brightness one pixel
  // outside it, because a thin wall is the same thickness whichever way you
  // look through it. So a column of rising air rendered as a hard-edged grey
  // slab with a vertical line down each side — ninety metres tall, and it is in
  // frame from most of the chapter's second half.
  //
  // Three nested shells fixes it for two more draw calls: the cross-section
  // then steps 2 / 4 / 6 from the rim to the middle, which is a ramp, and a
  // ramp is what a shaft of lit air looks like. The vertex colour takes it out
  // at the very top as well, so the lift ENDS rather than being cut off.
  // ---- AND THE OUTERMOST SHELL STILL HAD AN EDGE ON IT --------------------
  // Three nested shells at the SAME opacity is a three-step ramp, and the
  // bottom step is still 0.032 against the sky's zero: measured off a frame
  // from the Anvil, the two nearest columns are ninety metres of soft grey with
  // a crisp vertical line down each side. What a shell can never do is know
  // where its own silhouette is — so the fix is not more shells, it is that the
  // OUTER ones contribute almost nothing. Five now, on a squared ramp from
  // 0.008 to 0.044, so the step at the rim is a fifth of what it was and the
  // total through the middle is unchanged.
  for (let i = 0; i < driCOLS.length; i++) {
    const c = driCOLS[i];
    const h = c.top - c.base;
    const SH = 5;
    for (let k = 0; k < SH; k++) {
      const kr = 1 - k * 0.175;
      const sg = new THREE.CylinderGeometry(c.r * 0.95 * kr, c.r * 0.62 * kr, h, 16, 6, true);
      // top fade, written per vertex, so it is free
      const p = sg.attributes.position.array;
      const col = new Float32Array(p.length);
      for (let v = 0; v < p.length; v += 3) {
        const u = (p[v + 1] / h) + 0.5;                 // 0 bottom, 1 top
        const f2 = Math.min(1, u * 6) * (1 - Math.max(0, (u - 0.68) / 0.32) * 0.85);
        col[v] = col[v + 1] = col[v + 2] = f2;
      }
      sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const sm = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({
        color: PALETTE.driSeed,
        vertexColors: true,
        transparent: true,
        opacity: 0.008 + Math.pow(k / (SH - 1), 2) * 0.036,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }));
      sm.position.set(c.x, c.base + h * 0.5, c.z);
      sm.renderOrder = 1;
      sm.frustumCulled = false;
      root.add(sm);
    }
  }

  // and a ring of standing stones at the foot of each, so the base of the lift
  // is a PLACE and not merely a coordinate
  const M = driMerger();
  for (let i = 0; i < driCOLS.length; i++) {
    const c = driCOLS[i];
    for (let k = 0; k < 9; k++) {
      const a = k / 9 * 6.28318 + i;
      const rr = c.r * 1.1;
      const h = rand(2.2, 5.4);
      // they float, because everything here does
      M.box(c.x + Math.cos(a) * rr, c.base + 1.2 + k * 0.9, c.z + Math.sin(a) * rr,
            1.1, h, 1.1, k % 2 ? PALETTE.driStone : PALETTE.driRockPale, 0, a, 0);
    }
  }
  const stones = new THREE.Mesh(M.build(), driVC());
  stones.castShadow = true;
  root.add(stones);

  // the light IN the stones, which comes up while somebody is riding the shaft.
  // Unlit and additive, on the same geometry, so it costs one draw call and
  // cannot ever be out of register with the stones it is lighting.
  {
    const S = driMerger();
    for (let i = 0; i < driCOLS.length; i++) {
      const c = driCOLS[i];
      for (let k = 0; k < 9; k++) {
        const a = k / 9 * 6.28318 + i;
        const rr = c.r * 1.1;
        const h = 2.2 + ((k * 37) % 10) / 10 * 3.2;
        S.box(c.x + Math.cos(a) * rr, c.base + 1.2 + k * 0.9, c.z + Math.sin(a) * rr,
              1.22, h * 0.34, 1.22, PALETTE.driSeed, 0, a, 0);
      }
    }
    driColStoneMat = new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending });
    const sm = new THREE.Mesh(S.build(), driColStoneMat);
    sm.frustumCulled = false;
    sm.castShadow = false;
    sm.userData.noShadow = true;
    sm.renderOrder = 2;
    driColStones = sm;
    root.add(sm);
  }
}

// ==================================================================== MOTES ==
/**
 * SEED-FLUFF. A hundred and fifty of them in a box that follows the capybara
 * and wraps, all moving with the wind. This is not decoration: the wind is the
 * chapter's clock and it is completely invisible without them. Everything the
 * player learns about which way the air is going, they learn from this mesh.
 */
function driBuildMotes(root) {
  for (let i = 0; i < driMOTE_N; i++) {
    const o = i * 6;
    driMoteData[o] = rand(-45, 45);
    driMoteData[o + 1] = rand(-4, 30);
    driMoteData[o + 2] = rand(-45, 45);
    driMoteData[o + 3] = rand(0, 6.283);
    driMoteData[o + 4] = rand(0.12, 0.27);
    driMoteData[o + 5] = rand(0.7, 1.35);
  }
  // SMALLER AND FAINTER. The seed-fluff is the chapter's wind gauge and it is
  // not supposed to be the brightest small thing in the sky - a sleeping
  // lampfly is, and at 0.17-0.40 in near-white the two were the same object.
  const m = mat(0x000000, { emissive: PALETTE.driSeed, transparent: true, opacity: 0.62, depthWrite: false });
  const im = new THREE.InstancedMesh(driG.tet, m, driMOTE_N);
  im.frustumCulled = false;
  driMoteMesh = im;
  root.add(im);
}

// ================================================================ LAMPFLIES ==
/**
 * LAMPFLIES. The only living things up here, and the chapter's one social verb.
 * Asleep they are dim and they hang in slow orbits round the tree they were
 * born under. Wheek at one and it wakes, brightens, and falls in behind you for
 * good — and six of them following is what the lantern will take.
 *
 * They are deliberately NOT collectables you walk into. Everything else in this
 * game that you acquire, you STEAL; this is the one thing you have to ask for,
 * and asking is the noise you have been making since the first ten seconds of
 * chapter one.
 */
function driBuildLampflies(root) {
  // most of them in the orchard, a couple on the shelf where you start, and a
  // few scattered so the void is never entirely empty
  const homes = [
    // Two on the Shelf, at head height, three steps from where you wake up.
    // This is the tutorial for the whole verb and it has to be impossible to
    // walk past — everything else up here is a long way from everything else.
    { x: driLAMP.x + 4, y: 32.6, z: driLAMP.z - 3, n: 1, r: 3 },
    { x: 7, y: 32.8, z: 27, n: 1, r: 4 },
    // and then the wood, which is where the chapter expects you to find six
    { x: -38, y: 82.6, z: -114, n: 22, r: 13 },
    { x: -56, y: 78.6, z: -80, n: 5, r: 8 },
    { x: 3, y: 86.6, z: -103, n: 4, r: 7 },
    { x: 42, y: 74.6, z: -137, n: 6, r: 9 },
    { x: 36, y: 110.6, z: -184, n: 7, r: 11 },
  ];
  let i = 0;
  for (let h = 0; h < homes.length && i < driFLY_N; h++) {
    const H = homes[h];
    for (let k = 0; k < H.n && i < driFLY_N; k++, i++) {
      const a = rand(0, 6.283), rr = rand(1.5, H.r);
      const o = i * 11;
      driFlyData[o + 3] = H.x + Math.cos(a) * rr;
      driFlyData[o + 4] = H.y + rand(-0.8, 1.9);
      driFlyData[o + 5] = H.z + Math.sin(a) * rr;
      driFlyData[o] = driFlyData[o + 3];
      driFlyData[o + 1] = driFlyData[o + 4];
      driFlyData[o + 2] = driFlyData[o + 5];
      driFlyData[o + 6] = rand(0, 6.283);
      driFlyData[o + 7] = 0;
      driFlyData[o + 8] = 0;
      driFlyData[o + 9] = rand(0.7, 1.5);
      driFlyData[o + 10] = -99;
    }
  }
  // ---- ONE SWARM, ONE BRIGHTNESS, AND THAT WAS THE PROBLEM ---------------
  // The emissive lived on a SHARED material, so waking a lampfly brightened
  // every lampfly in the world — including the twenty-two you had not touched,
  // three islands away. The chapter's gate is "wake six of them" and there was
  // no way to look at the orchard and see which six. Per-instance colour on an
  // UNLIT material: a lampfly is a light, it does not receive one, and this is
  // cheaper than the Lambert it replaces as well as being right.
  // instanceColor MULTIPLIES vColor, and vColor only exists if the geometry
  // carries a colour attribute — a raw OctahedronGeometry with vertexColors on
  // renders BLACK, which is how forty-six lampflies became forty-six holes in
  // the orchard. Merge one octahedron so it has a white colour attribute, and
  // the per-instance tint has something to multiply.
  const flyGeo = (() => { const F = driMerger(); F.oct(0, 0, 0, 1, 0xffffff, 0, 0, 0); return F.build(); })();
  driFlyMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95 });
  const im = new THREE.InstancedMesh(flyGeo, driFlyMat, driFLY_N);
  im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(driFLY_N * 3), 3);
  im.frustumCulled = false;
  driFlyMesh = im;
  root.add(im);

  // ---- AND A LAMPFLY ASLEEP LOOKED EXACTLY LIKE A PIECE OF SEED-FLUFF ----
  // Measured, not guessed: a sleeping fly is a 33 cm octahedron at 0x9a8fb0
  // and a mote is a 17-40 cm tetrahedron at 0xe8e0f6, and they share the sky.
  // From the orchard's own deck, twelve metres out, there is nothing in the
  // frame that separates the twenty-two creatures the chapter's second task is
  // about from the hundred and fifty pieces of ambient fluff drifting past
  // them. A previous pass fixed the BRIGHTNESS of this (they had been dimmed
  // into the sky) and left the confusion with the motes standing.
  //
  // Two things, and neither is brightness. A lampfly is a LIGHT, so it gets
  // the one thing no mote has: a halo - a second instance three times the size
  // at a fifth of the strength, additive, which is how every other light in
  // this game is made to read as one. And it BREATHES in size, visibly, which
  // nothing inanimate in this sky does.
  const hg = (() => { const F = driMerger(); F.oct(0, 0, 0, 1, 0xffffff, 0, 0, 0); return F.build(); })();
  driFlyHaloMat = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.24,
    depthWrite: false, blending: THREE.AdditiveBlending });
  const hm = new THREE.InstancedMesh(hg, driFlyHaloMat, driFLY_N);
  hm.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(driFLY_N * 3), 3);
  hm.frustumCulled = false;
  hm.castShadow = false;
  hm.userData.noShadow = true;
  hm.renderOrder = 2;
  driFlyHalo = hm;
  root.add(hm);
}

// ================================================================== LANTERN ==
/**
 * THE LANTERN. Nine metres of paper and split timber on the highest island in
 * the world, and the whole chapter points at it. Dark, it is the colour of an
 * old newspaper; lit, it is the only warm thing for two hundred metres in any
 * direction and it takes the ribbons, the cloud and the entire swarm with it.
 */
/**
 * A POOL OF LIGHT ON GRASS, and the two ways the first version of it was wrong.
 *
 * Both light pools in this chapter were two eight-sided cylinders — a bright
 * one inside a dim one — laid flat with normal blending. Rendered, that is a
 * visible OCTAGON with a second visible octagon round it and a hard step
 * between them, on the two objects the chapter most wants you to look at. Two
 * things fix it and neither is expensive: RINGS (five of them, each a little
 * wider and a lot dimmer, so the falloff is a curve rather than a step) and
 * SIXTEEN SIDES (an octagon at nine metres across is a shape; a hexadecagon is
 * a circle). Additive, because it is light lying on grass and not paint.
 *
 * Returns the mesh; the caller owns its opacity.
 */
function driLightPool(r, color, rings) {
  const P = driMerger();
  const n = rings || 5;
  for (let k = n - 1; k >= 0; k--) {
    const u = (k + 1) / n;
    const f2 = (1 - u) * (1 - u) * 0.92 + 0.08;
    const g2 = Math.max(0, Math.min(255, Math.round(f2 * 255)));
    P.cyl(0, -k * 0.004, 0, r * u, 0.02, (g2 << 16) | (g2 << 8) | g2, 0, 0, 0, 16);
  }
  const m = new THREE.Mesh(P.build(), new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, color: color }));
  m.renderOrder = 2;
  m.frustumCulled = false;
  return m;
}

function driBuildLantern(game, root) {
  const g = new THREE.Group();
  g.position.set(driLANTERN.x, driLANTERN.y, driLANTERN.z);
  root.add(g);

  const M = driMerger();
  // a stepped stone plinth — this is also the way out, so it has to look like
  // somewhere you would stand and shout
  M.cyl(0, 0.18, 0, 5.4, 0.36, PALETTE.driStone, 0, 0, 0, 8);
  M.cyl(0, 0.52, 0, 4.4, 0.36, PALETTE.driRockPale, 0, 0, 0, 8);
  M.cyl(0, 0.86, 0, 3.5, 0.36, PALETTE.driStone, 0, 0, 0, 8);
  // four splayed legs
  for (let i = 0; i < 4; i++) {
    const a = i * 1.5708 + 0.7854;
    M.box(Math.cos(a) * 2.5, 2.4, Math.sin(a) * 2.5, 0.44, 3.4, 0.44,
          PALETTE.driTimber, Math.sin(a) * 0.16, 0, -Math.cos(a) * 0.16);
  }
  M.box(0, 4.2, 0, 5.6, 0.34, 5.6, PALETTE.driTimber);
  // and a cap over the paper
  M.cone(0, 9.6, 0, 3.9, 1.7, PALETTE.driTimber, 0, 0.4, 0, 8);
  M.box(0, 10.6, 0, 0.3, 0.9, 0.3, PALETTE.driTimber);
  const frame = new THREE.Mesh(M.build(), driVC());
  frame.castShadow = true;
  frame.receiveShadow = true;
  g.add(frame);

  // the paper itself: its own mesh and its own material, because its emissive
  // is written every frame from driGlow
  //
  // SIXTEEN SIDES, NOT EIGHT. It is five and a half metres across and it is the
  // object the whole chapter points at; rendered from the plinth it was a
  // visible OCTAGON, which is the same note the light pools, the moon's halo
  // and the island decks have all now had. Sixteen costs 96 triangles.
  const pg = new THREE.CylinderGeometry(2.4, 2.9, 4.6, 16, 1, true);
  driLanternMat = mat(PALETTE.driPaperDim, { emissive: PALETTE.driLamp, emissiveIntensity: 0.0 }).clone();
  const paper = new THREE.Mesh(pg, driLanternMat);
  paper.position.y = 6.7;
  paper.castShadow = false;
  driLanternPaper = paper;
  g.add(paper);
  // AND THE RIBS. A nine-metre paper lantern is paper stretched over split
  // bamboo hoops, and the hoops are the only thing that says which of the two
  // it is: unlit, a smooth drum is a grain silo. Five hoops and six verticals,
  // in the frame's own timber, on the merged mesh so they cost no draw call.
  {
    const RM = driMerger();
    for (let k = 0; k < 5; k++) {
      const u = k / 4;
      RM.cyl(0, 4.42 + u * 4.55, 0, lerp(2.98, 2.48, u), 0.10, PALETTE.driBark, 0, 0, 0, 16);
    }
    for (let k = 0; k < 6; k++) {
      const a = k / 6 * 6.28318;
      RM.box(Math.cos(a) * 2.78, 6.7, Math.sin(a) * 2.78, 0.10, 4.7, 0.10,
             PALETTE.driBark, 0, -a, 0);
    }
    const rm = new THREE.Mesh(RM.build(), driVC());
    rm.castShadow = false;
    g.add(rm);
  }

  // ---- WHAT IT DOES WHEN IT CATCHES ---------------------------------------
  // Lighting this is the last thing in the chapter and it was one emissive
  // going from 0 to 1.15 over two seconds, on an object nine metres tall, at
  // night, in a world whose whole palette is already violet-and-warm. The
  // moment needs to leave the lantern: forty embers going UP out of the paper
  // and away downwind, a halo round the light itself, and a pool of it on the
  // grass — the same three things the little lamp on the Shelf got, at ten
  // times the size, because this is the paragraph that one was the sentence for.
  {
    const E = driMerger();
    E.oct(0, 0, 0, 1, PALETTE.driLamp, 0, 0.6, 0);
    driEmberMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0 });
    const em = new THREE.InstancedMesh(E.build(), driEmberMat, driEMBER_N);
    em.frustumCulled = false;
    em.visible = false;
    g.add(em);
    driEmberMesh = em;
    for (let i = 0; i < driEMBER_N; i++) {
      const o = i * 4;
      driEmberData[o] = rand(0, 6.283);            // bearing
      driEmberData[o + 1] = rand(0.4, 2.6);        // radius
      driEmberData[o + 2] = rand(0, 26);           // height, seeded across the run
      driEmberData[o + 3] = rand(1.5, 3.4);        // rise
    }
    // A SIX-SEGMENT SPHERE IS A POLYGON. driG.sph6 is 6 x 4 and at nine metres
    // across it reads as a grey heptagon standing behind the lantern rather
    // than as air with light in it.
    driLanternHalo = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), new THREE.MeshBasicMaterial({
      color: PALETTE.driLampGlow, transparent: true, opacity: 0, depthWrite: false }));
    driLanternHalo.position.y = 6.7;
    driLanternHalo.scale.setScalar(9.0);
    driLanternHalo.renderOrder = 3;
    g.add(driLanternHalo);
    driLanternPool = driLightPool(15.0, PALETTE.driLamp, 6);
    driLanternPool.position.y = 1.1;
    g.add(driLanternPool);
  }

  driLanternGroup = g;
}

/**
 * THE SHELF'S FURNITURE. Somebody lived here, once, and then the ground they
 * lived on came off. There is a lamp-post still burning, a jetty that ends in
 * mid-air over a two-hundred-metre drop, a bench facing it, and a pond that has
 * no business still being full. Nothing here is a puzzle; it is all there so
 * that the first thirty seconds of the chapter has something to be about.
 */
function driBuildShelf(game, root) {
  // Everything here is authored with the deck at y = 0 and hung under a group
  // at the Shelf's real height, so the furniture cannot drift out of step with
  // the island if the archipelago is ever moved again.
  const SY = driISLES[0].y;
  const g0 = new THREE.Group();
  g0.position.y = SY;
  root.add(g0);
  const M = driMerger();

  // --- THE BROKEN JETTY -------------------------------------------------
  // East off the deck: it leaves at x = 16 and stops in mid-air at x = 30,
  // fourteen metres out over the whole depth of the world. The planks are flush
  // with the meadow (top face at y = 0) so walking onto it is not a step, and
  // it has a real collider, because the entire point of the thing is that you
  // can get to the end of it, look down, and then decide.
  for (let i = 0; i < 15; i++) {
    const x = 14 + i * 1.15;
    M.box(x, -0.12, 34, 1.0, 0.24, 3.4, PALETTE.driTimber);
    if (i % 3 === 0 && x > 20) {
      M.box(x, -0.74, 32.6, 0.3, 1.4, 0.3, PALETTE.driTimber);
      M.box(x, -0.74, 35.4, 0.3, 1.4, 0.3, PALETTE.driTimber);
    }
  }
  // the last two planks are snapped and hang
  M.box(31.4, -0.39, 33.6, 1.0, 0.22, 2.6, PALETTE.driTimber, 0, 0, -0.34);
  M.box(32.6, -1.14, 34.8, 0.9, 0.2, 1.6, PALETTE.driTimber, 0.2, 0.3, -0.7);
  // hand rails, one side only, because one side came off
  for (let i = 0; i < 6; i++) {
    M.box(16 + i * 2.6, 0.46, 32.4, 0.16, 1.0, 0.16, PALETTE.driTimber);
  }
  M.box(22.5, 0.94, 32.4, 13.5, 0.14, 0.14, PALETTE.driTimber);

  // --- the lamp-post: the one warm thing on the island -------------------
  M.cyl(driLAMP.x, 2.1, driLAMP.z, 0.14, 4.2, PALETTE.driTimber);
  M.box(driLAMP.x, 4.62, driLAMP.z, 0.9, 0.14, 0.9, PALETTE.driTimber);
  // THE SHADE WAS OVER THE BULB. The cone sat at 4.8 with a 70 cm drop, i.e.
  // from 4.45 to 5.15, and the bulb was a 33 cm sphere at 4.62 — entirely
  // inside it. Rendered, the one warm thing on the island the chapter opens on
  // was an unlit brown cone at the top of a stick, at night, on a world made of
  // dark violet. The shade goes up; the bulb hangs under it.
  M.cone(driLAMP.x, 5.05, driLAMP.z, 0.66, 0.72, PALETTE.driTimber, 0, 0.4, 0, 4);
  M.cyl(driLAMP.x, 4.62, driLAMP.z, 0.06, 0.34, PALETTE.driTimber, 0, 0, 0, 4);

  // --- a bench, facing the drop -----------------------------------------
  // With a collider, because a bench is 90 cm high and 70 wide: too tall for
  // the capybara's 40 cm step and too small to read as architecture, which is
  // the size of thing that looks like a bug when you walk through it. It is
  // also three metres from where the chapter begins.
  const driShelfGrp = driStaticGroup(game);        // the Shelf's own furniture, one body
  driShelfGrp.add(13, SY + 0.45, 30, 1.0, 0.9, 2.8, 0.5);
  M.box(13, 0.5, 30, 0.7, 0.16, 2.6, PALETTE.driTimber, 0, 0.5, 0);
  M.box(13.5, 0.9, 30, 0.14, 0.7, 2.6, PALETTE.driTimber, 0, 0.5, 0);
  M.box(13, 0.25, 29, 0.6, 0.5, 0.16, PALETTE.driTimber, 0, 0.5, 0);
  M.box(13, 0.25, 31, 0.6, 0.5, 0.16, PALETTE.driTimber, 0, 0.5, 0);

  // --- the pond, which by rights should have drained years ago ----------
  // It was an eight-sided disc of flat colour: an octagon of dark teal lying on
  // the grass, on the one island the chapter opens on. A pond is the only water
  // in this biome besides the cloud, and the cloud has had glitter on it since
  // grainOwn was written — so this gets the same treatment, sixteen sides, and
  // a shelving margin of stones half in it. The moon is the brightest thing in
  // the chapter and it is thirteen degrees up: the sparkle is what puts it on
  // the water.
  for (let i = 0; i < 11; i++) {
    const a = i / 11 * 6.283;
    M.oct(-13 + Math.cos(a) * 3.9, 0.10, 26 + Math.sin(a) * 3.9, rand(0.4, 0.7), PALETTE.driRockPale, a, a, 0);
    M.oct(-13 + Math.cos(a + 0.3) * 3.2, -0.06, 26 + Math.sin(a + 0.3) * 3.2,
          rand(0.3, 0.5), PALETTE.driRock, a, a * 1.3, 0);
  }

  const mesh = new THREE.Mesh(M.build(), driVC());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g0.add(mesh);

  // the pond's surface, its own mesh and its own material: sixteen sides, and
  // the glitter every other water in this game has. grainOwn, not
  // grain(...).clone() — the clone throws the shader hook away (shared.js).
  {
    const pg = new THREE.CircleGeometry(3.6, 16);
    pg.rotateX(-Math.PI / 2);
    pg.translate(-13, 0.06, 26);
    const pm = new THREE.Mesh(pg, grainOwn(mat(PALETTE.driPond), {
      scale: 0.55, amount: 0.16, warp: 0,
      sparkle: 0.55, sparkleScale: 1.05, sparkleSpeed: 0.14,
      sparkleCut: 0.655, sparkleBand: 0.12, sparkleColor: PALETTE.driMoon,
    }));
    pm.receiveShadow = true;
    pm.castShadow = false;
    pm.userData.noShadow = true;
    g0.add(pm);
  }

  // the lamp's glass is its own emissive mesh
  const bulb = new THREE.Mesh(driG.sph6, new THREE.MeshBasicMaterial({ color: PALETTE.driLampGlow }));
  bulb.position.set(driLAMP.x, 4.28, driLAMP.z);
  bulb.scale.setScalar(0.54);
  g0.add(bulb);
  // a halo, and a pool of it on the meadow. Nothing in this biome casts light,
  // so a lamp that is not painted onto the things around it is a lit object
  // rather than a light — the same trick the neon plays on Mong Kok's tarmac.
  {
    const halo = new THREE.Mesh(driG.sph6, new THREE.MeshBasicMaterial({
      color: PALETTE.driLampGlow, transparent: true, opacity: 0.11, depthWrite: false }));
    halo.position.set(driLAMP.x, 4.28, driLAMP.z);
    halo.scale.setScalar(2.2);
    halo.renderOrder = 3;
    g0.add(halo);
    const pool = driLightPool(5.4, PALETTE.driLamp, 5);
    pool.position.set(driLAMP.x, 0.06, driLAMP.z);
    pool.material.opacity = 0.30;
    g0.add(pool);
  }

  // --- THE VANE. The wind is this chapter's clock. The motes are how you read
  //     it in flight; this is how you read it standing still, which is what you
  //     will be doing while you wait for the breath to turn.
  // ---- AND IT HAS TO BE BIG ENOUGH TO READ ------------------------------
  // `weathervane` asks the player to stand here and watch the wind come all the
  // way over and back, which is nineteen seconds — and the instrument they are
  // being asked to watch was a 10 x 50 x 160 cm paper flag and a 28 cm cone on
  // a stick, measured off the frame from the jetty as an unidentifiable tan
  // rectangle at head height. An instrument the chapter has a TASK about is
  // allowed to be the second tallest thing on the island.
  const vg = new THREE.Group();
  vg.position.set(11, 0, 31);
  const VM = driMerger();
  VM.cyl(0, 2.0, 0, 0.13, 4.0, PALETTE.driTimber);
  // a stepped stone foot, so it is planted rather than pushed in
  VM.cyl(0, 0.10, 0, 0.62, 0.20, PALETTE.driStone, 0, 0, 0, 8);
  VM.cyl(0, 0.26, 0, 0.44, 0.16, PALETTE.driRockPale, 0, 0, 0, 8);
  // THE CARDINALS. Four fixed arms under the vane: without them a rotating
  // arrow has nothing to rotate AGAINST and 'it has gone all the way round' is
  // not a thing the eye can see. They are the reason this reads as an
  // instrument rather than as a flag.
  for (let k = 0; k < 4; k++) {
    const a = k * 1.5708;
    VM.box(Math.cos(a) * 0.62, 3.35, Math.sin(a) * 0.62, 1.24, 0.07, 0.07,
           PALETTE.driRockPale, 0, -a, 0);
    VM.oct(Math.cos(a) * 1.20, 3.35, Math.sin(a) * 1.20, 0.16,
           k === 0 ? PALETTE.driLamp : PALETTE.driStone, 0, -a, 0);
  }
  const post = new THREE.Mesh(VM.build(), driVC());
  post.castShadow = true;
  vg.add(post);
  const AM = driMerger();
  // the tail: two fletches at an angle, which is what actually makes a vane
  // point downwind and is the half of it that is legible from behind
  for (let s = -1; s <= 1; s += 2) {
    AM.box(s * 0.16, 4.28, -0.95, 0.06, 0.86, 1.9, PALETTE.driPaper, 0, s * 0.16, 0);
  }
  AM.box(0, 4.28, -0.2, 0.09, 0.22, 3.4, PALETTE.driBark);          // the shaft
  AM.cone(0, 4.28, 1.62, 0.34, 1.0, PALETTE.driLamp, Math.PI * 0.5, 0, 0, 4);
  // and a counterweight, because a vane that is not balanced does not turn
  AM.oct(0, 4.28, 0.55, 0.24, PALETTE.driRockPale, 0, 0.6, 0);
  const arrow = new THREE.Mesh(AM.build(), driVC());
  arrow.castShadow = true;
  vg.add(arrow);
  driVaneGroup = arrow;
  g0.add(vg);
  // The vane's own post, which is a 22 cm timber standing three metres up on
  // the island the chapter opens on and had no collider on it at all.
  driShelfGrp.add(11, SY + 2.0, 31, 0.40, 4.0, 0.40, 0);

  // The jetty is the only walkable thing in the biome that is not an island, so
  // it is the only collider that does not come out of driISLES. Deep enough
  // (1.2 m) that a capybara arriving at terminal velocity cannot tunnel it.
  driShelfGrp.add(22, SY - 0.6, 34, 17, 1.2, 3.4, 0);       // x 13.5 .. 30.5, matching the planks
  driShelfGrp.done();
}

/**
 * FLORA. Pale, wind-bent trees on the meadows and a proper little wood on the
 * orchard, all instanced. The trunks lean the same way on every island, because
 * the wind up here has only ever blown along one axis and everything that grew
 * knows it.
 */
function driBuildFlora(root) {
  // A TRUNK 12 CM ACROSS AND FOUR AND A HALF METRES TALL IS A POLE, and two
  // flat octahedra on the top of it are a diamond on a stick. Rendered on the
  // orchard — the island the chapter asks you to spend the longest on — the
  // wood was nine dark sticks against the moon. Same instanced meshes and the
  // same draw calls: a taper (a fatter section at the root), three branch stubs
  // going up into the canopy, and a crown of three octahedra with a shoulder.
  const trunks = [], crowns = [], blossom = [], branches = [];
  function tree(x, y, z, s, lean, pale) {
    const ry = rand(0, 6.28);
    driPush9(trunks, x, y + s * 0.7, z, lean * 0.12, ry, 0, s * 0.26, s * 1.6, s * 0.26);
    driPush9(trunks, x + lean * s * 0.35, y + s * 2.4, z, lean * 0.34, ry, 0, s * 0.145, s * 2.6, s * 0.145);
    driPush9(trunks, x + lean * s * 1.1, y + s * 4.0, z, lean * 0.5, ry, 0, s * 0.1, s * 1.2, s * 0.1);
    for (let b = 0; b < 3; b++) {
      const a = ry + b * 2.1;
      driPush9(branches, x + lean * s * (0.9 + b * 0.12) + Math.cos(a) * s * 0.55,
               y + s * (3.2 + b * 0.62), z + Math.sin(a) * s * 0.55,
               Math.sin(a) * 0.7, a, -Math.cos(a) * 0.7, s * 0.07, s * 1.3, s * 0.07);
    }
    driPush9(crowns, x + lean * s * 1.3, y + s * 4.15, z, 0, ry, 0, s * 2.1, s * 1.1, s * 2.1);
    driPush9(crowns, x + lean * s * 1.6, y + s * 4.9, z + s * 0.2, 0, ry + 0.8, 0, s * 1.7, s * 1.15, s * 1.7);
    driPush9(crowns, x + lean * s * 1.9, y + s * 5.6, z - s * 0.15, 0, ry + 1.9, 0, s * 1.1, s * 0.95, s * 1.1);
    if (pale) {
      driPush9(blossom, x + lean * s * 1.45, y + s * 4.55, z, 0, ry + 0.4, 0, s * 1.85, s * 0.5, s * 1.85);
      driPush9(blossom, x + lean * s * 1.8, y + s * 5.35, z, 0, ry + 1.4, 0, s * 1.25, s * 0.4, s * 1.25);
    }
  }
  // ---- AND THE WOOD HAS TO BE A WOOD -------------------------------------
  // The orchard is the island the chapter asks the player to spend the longest
  // on — it is where six lampflies have to be gathered, it holds the only
  // building in the biome and one of the only two people — and it had EIGHT
  // TREES on three hundred and sixty square metres. Rendered, it is a lawn with
  // some poles on it. Doubling the density everywhere and trebling it on the
  // orchard is 8,000 triangles in a chapter with sixty thousand of headroom,
  // and it is the difference between an orchard and a field.
  //
  // Undergrowth matters more than the trees, though, and cost almost nothing:
  // a wood is not trunks and a canopy, it is what is between them. Ferns in
  // clumps, a fallen trunk with a root plate, and mossy boulders — all in the
  // same instanced batches the trees already use.
  const ferns = [], logs = [], stumps = [];
  for (let i = 0; i < driISLES.length; i++) {
    const s = driISLES[i];
    if (s.kind === 'bare') continue;
    // The deep and far ranks are driBuildFarDressing's now. They used to get
    // two or three of these apiece — full-detail trees, with branch stubs and
    // ferns, at a hundred and forty metres, every triangle of them CASTING —
    // which bought nothing at that range and paid for it twice.
    if (s.id.indexOf('deep') === 0 || s.id.indexOf('far') === 0) continue;
    const pale = s.kind === 'pale';
    // ---- AND THE DENSITY IS STILL A FIELD WITH SOME POLES IN IT --------
    // The last pass doubled these and called it a wood. Measured against the
    // whole seventeen-chapter census the Drift was still bottom of the game
    // for objects per thousand square metres by a factor of two, and the
    // orchard — the island the chapter asks you to spend the longest on —
    // was carrying twenty trees over three hundred and sixty square metres.
    // Nothing about the shape was wrong; the number was.
    const dens = s.id === 'orchard' ? 0.145 : (pale ? 0.135 : 0.058);
    const n = clamp(Math.round(s.hx * s.hz * dens), 3, 46);
    for (let k = 0; k < n; k++) {
      const a = rand(0, 6.283), u = Math.sqrt(Math.random());
      const ex = Math.cos(a) * u * (s.hx - 2.2), ez = Math.sin(a) * u * (s.hz - 2.2);
      const wx = s.x + ex * s.cos - ez * s.sin, wz = s.z + ex * s.sin + ez * s.cos;
      // and never within eight metres of where the player wakes up, because a
      // tree you spawn underneath is a tree you are looking at instead of a world
      if (s.id === 'shelf' && Math.abs(wx - driSPAWN.x) < 8 && Math.abs(wz - driSPAWN.z) < 9) continue;
      // ---- THE CROWN IS WHERE THE CHAPTER ENDS, AND IT HAS TO BE CLEAR ---
      // The follow rig sits about eight metres above the animal and these
      // trees are nine and a half tall. Photographed from the flagged approach
      // — the last twenty metres of the chapter, walking up to the lantern with
      // the bench beside it — the marquee was BEHIND A CANOPY, which is
      // precisely the note chapter 16's doline got. Thirteen metres of clear
      // ground round a nine-metre lantern is not a clearing, it is a hole in a
      // hedge. Twenty-four, and the wood on this island is capped below the
      // lens so that even outside it nothing crosses the shot.
      if (s.id === 'crown') {
        const lx = wx - driLANTERN.x, lz = wz - driLANTERN.z;
        if (lx * lx + lz * lz < 24 * 24) continue;
        // and not through the bench, the rail or the stack of paper
        const kx2 = wx - driCROWN_KEEP.x, kz2 = wz - driCROWN_KEEP.z;
        if (kx2 * kx2 + kz2 * kz2 < 6 * 6) continue;
      }
      // NOR THROUGH THE LAMPFLY HOUSE. driBuildFlora scatters at random and
      // driBuildKeepers runs after it, so without this a nine-metre tree grows
      // up through the middle of the one roof in the biome about a third of
      // the time. Everything else in this file avoids that by not overlapping;
      // this is the one pair that can.
      if (s.id === 'orchard') {
        const ox2 = wx - (driORCH_KEEP.x + 1.6), oz2 = wz - (driORCH_KEEP.z + 2.4);
        if (ox2 * ox2 + oz2 * oz2 < 6.5 * 6.5) continue;
      }
      // s = 2.3 puts the top of the crown 12.9 m over the deck and the middle
      // of it at 9.5 — the height of the camera. On the two islands that ARE a
      // shot (the Crown, and the arch where the Long Gap starts) the wood is
      // scrub: under the lens, and it stays a silhouette rather than a wall.
      const low = s.id === 'crown' || s.id === 'farside';
      tree(wx, s.y, wz, low ? rand(0.9, 1.35) : rand(1.5, 2.3), 0.16, pale);
      // a clump of ferns at the foot of about half of them, and a fallen trunk
      // or a stump every fifth — the floor of a wood, which costs two triangles
      // a blade and is the whole reason a wood does not read as a lawn
      if (k % 2 === 0) {
        // Same correction as the blades above, and this one has been wrong
        // since the ferns were added: a 2 m frond at 0.34 rad under a camera
        // that looks down 0.70 is a pale green playing card lying on the deck,
        // four to a tree, on every island the player walks. Nearly upright, and
        // narrower, so a clump reads as a shuttlecock rather than a doily.
        for (let f = 0; f < 4; f++) {
          const fa = a + f * 1.6, fr = 0.9 + (f % 3) * 0.5;
          driPush9(ferns, wx + Math.cos(fa) * fr, s.y + 0.44, wz + Math.sin(fa) * fr,
                   1.02 + (f % 3) * 0.10, fa, 0, 0.62 + (f % 3) * 0.18, 1, 0.92);
        }
      }
      if (k % 5 === 2) {
        // ...AND A FALLEN TRUNK IS SIX METRES LONG, SO IT HAS TO BE PUT DOWN
        // WHERE THERE IS SIX METRES OF ISLAND. The tree it came off is already
        // placed up to hx − 2.2 from the middle; a log two and a half metres
        // further out along a random bearing, lying half its own length again
        // past that, hangs over the edge and off the world. It is pulled back
        // toward the middle instead — which is also where a tree that fell
        // would have fallen from.
        const la = a + 1.1;
        const len = 3.6 + (k % 3) * 1.4;
        const lu = -(len * 0.5 + 1.2);          // toward the island's middle
        const lex = ex + Math.cos(la) * lu * 0.4, lez = ez + Math.sin(la) * lu * 0.4;
        const cl = Math.min(1, (s.hx - 1.0) / Math.max(0.001, Math.abs(lex)),
                               (s.hz - 1.0) / Math.max(0.001, Math.abs(lez)));
        const lx2 = s.x + lex * cl * s.cos - lez * cl * s.sin;
        const lz2 = s.z + lex * cl * s.sin + lez * cl * s.cos;
        driPush9(logs, lx2, s.y + 0.34, lz2, 0, la, Math.PI * 0.5, 0.62, len, 0.62);
        driPush9(stumps, wx, s.y + 0.36, wz, 0.1, la * 1.7, 0.06, 1.05, 0.72, 1.05);
      }
    }
  }
  const mTrunk = mat(PALETTE.driBark);
  const mCrown = mat(PALETTE.driLeafA);
  const mBloss = mat(0x000000, { emissive: PALETTE.driBlossom, emissiveIntensity: 0.42 });
  driInstance(root, driG.cyl6, mTrunk, trunks, true, false);
  if (branches.length) driInstance(root, driG.cyl4, mTrunk, branches, true, false);
  driInstance(root, driG.oct, mCrown, crowns, true, true);
  if (blossom.length) driInstance(root, driG.oct, mBloss, blossom, false, false);
  // DOUBLE-SIDED: a fern blade is a quad and half a wood is seen from the far
  // side of it. Three flips the normal for back faces in the fragment shader,
  // so it lights correctly both ways for no second draw call.
  if (ferns.length) {
    driInstance(root, driG.quad, mat(PALETTE.driLeafB, { side: THREE.DoubleSide }),
                ferns, false, false);
  }
  if (logs.length) driInstance(root, driG.cyl6, mat(PALETTE.driSoil), logs, true, true);
  if (stumps.length) driInstance(root, driG.cyl6, mat(PALETTE.driMoss), stumps, true, true);
}

// =============================================================== THE WEATHER ==
/**
 * CLOUD BANKS — the thing a fall in this chapter falls PAST.
 *
 * driBuildCloud draws the cloud SEA: one enormous rippling sheet at y = -0.5
 * that is the floor of the world. Between the archipelago and that sheet there
 * were a hundred and fifty motes and forty-eight wisps, and that was the entire
 * contents of a hundred and eight vertical metres. A twelve-second fall through
 * it read as a fade to violet — which is why the chapter header had to promise
 * that the far field was "the only thing that gives a fall a SIZE".
 *
 * So: thirty-one banks of cloud standing off the sheet, between four and
 * twenty-six metres tall, arranged in a ring OUTSIDE the route and under it,
 * never in the corridor between two islands the player has to jump.
 *
 * Squashed spheres, never stacked boxes — a bank built out of boxes is a stack
 * of white paper with a hard edge on every layer, which is the note the
 * Antarctic hut drifts got twice. Transparent, and they never cast: the whole
 * point of them is that you go through them.
 */
const driBANK_N = 46;
let driBankMesh = null, driBankMat = null;

function driBuildBanks(root) {
  const M = driMerger();
  for (let i = 0; i < driBANK_N; i++) {
    // A ring, thickening outward, with the middle sixty metres left empty: the
    // route runs up the spine of the map and a cumulus standing in it would be
    // a wall you cannot see through on the one jump that matters.
    const a = i * 2.399 + 0.4;
    const rr = 62 + ((i * 29) % 11) * 13;
    const bx = Math.cos(a) * rr, bz = -70 + Math.sin(a) * rr * 0.92;
    // ---- AND A CUMULUS IS WIDER THAN IT IS TALL --------------------------
    // First cut: up to twenty-five metres of height with five to eight spheres
    // stacked up it, which puts three to five metres between sphere centres
    // against radii that taper from nine down to four. They stop overlapping
    // about half way up, and what you photograph is a ZIGGURAT of hard-edged
    // hexagonal plates — the stack-of-white-paper failure the Antarctic hut
    // drifts got twice, in the sky this time. Half the height, twice the
    // spread, and the spacing is now always under the local radius.
    const h = 3 + ((i * 17) % 9) * 1.15;
    const w = 15 + ((i * 13) % 7) * 5.5;
    // five to eight squashed spheres, the big one low and the small ones piled
    // toward one shoulder, because a cumulus has a base and a top and the top
    // leans downwind
    const n = 5 + (i % 4);
    for (let k = 0; k < n; k++) {
      const u = k / n;
      const ka = a * 1.7 + k * 2.2;
      const sc = 1 - u * 0.55;
      M.sph(bx + Math.cos(ka) * w * 0.34, driCLOUD_Y + 0.4 + u * h,
            bz + Math.sin(ka) * w * 0.30,
            w * 0.46 * sc, h * 0.42 * sc + 1.6, w * 0.42 * sc,
            k === 0 ? PALETTE.driCloudDeep : (k % 2 ? PALETTE.driCloud : PALETTE.driCloudLit));
    }
  }
  // ---- AND A CLOUD IS NOT A WINDOW ---------------------------------------
  // First cut: one merged mesh of two hundred and eighty squashed spheres in a
  // transparent material with depthWrite off. Three sorts TRANSPARENCY PER
  // OBJECT, and this is one object, so forty-six banks and every sphere inside
  // every one of them are drawn in buffer order with no depth test between
  // them. Photographed from the Crown looking north over the whole
  // archipelago, that is not weather: it is half a dozen enormous washed-out
  // parallelograms lying across the frame, each one the far side of a bank
  // painted over the near side of it, with the islands showing through.
  //
  // A cumulus is opaque. It is the most opaque thing in the sky. Flat-shaded
  // and opaque it sorts itself for free, it reads as folded paper the way
  // everything else in this game does, and falling INTO one is then a thing
  // that happens rather than a thing you can see through.
  driBankMat = driVC();
  const m = new THREE.Mesh(M.build(), driBankMat);
  m.name = 'dri:banks';
  m.castShadow = false;
  m.receiveShadow = false;
  m.userData.noShadow = true;
  m.frustumCulled = false;
  driBankMesh = m;
  root.add(m);
}

/**
 * THE AIRFIELD — rock and turf that never landed.
 *
 * If the ground came off, not all of it came off in island-sized pieces. Two
 * hundred small things hang in the void between the islands: stones, plates of
 * turf still green side up, and chips off the bottom of both. They are the
 * PARALLAX of the chapter — in a hundred metres of empty air they are the only
 * thing that tells the eye how fast it is going — and they cost eight
 * triangles each.
 *
 * `driG.oct` and `driG.box` in a PLAIN `mat()`, never a `vertexColors` one:
 * three feeds the shader a missing colour attribute and the whole field
 * renders BLACK. That is six hundred sun cups in Antarctica, and it is
 * written down.
 */
const driAIR_N = 280;
let driAirMesh = null, driAirTurf = null, driAirChip = null;
const driAirData = new Float32Array(driAIR_N * 4);   // baseY, phase, rate, spin

/**
 * True when a point is close enough to an island — in plan AND in height — for
 * a drifting rock to be seen inside it. Ten metres of vertical margin covers
 * the deck, the crag under it and the root curtain hanging off that.
 */
function driBlockedForAir(x, y, z) {
  const isle = driIslandAt(x, z);
  // driIslandAt is single-valued over TWO tables and they do not have the same
  // shape: a fixed island carries its own y, a wanderer carries it on .def.
  // Everything else in this file that asks the question goes through
  // driTerrain, which does the unwrapping; this one has to do it itself.
  if (isle) {
    const iy = isle.def ? isle.def.y : isle.y;
    if (y > iy - 14 && y < iy + 10) return true;
  }
  // and the wandering islands, tested against the whole of the lane they sweep
  for (let i = 0; i < driWANDER.length; i++) {
    const d = driWANDER[i];
    if (y < d.y - 12 || y > d.y + 8) continue;
    const lo = Math.min(d.x0, d.x1) - d.hx - 3, hi = Math.max(d.x0, d.x1) + d.hx + 3;
    const lz = Math.min(d.z0, d.z1) - d.hz - 3, hz2 = Math.max(d.z0, d.z1) + d.hz + 3;
    if (x > lo && x < hi && z > lz && z < hz2) return true;
  }
  return false;
}

function driBuildAirfield(root) {
  const stones = [], turfs = [], chips = [];
  for (let i = 0; i < driAIR_N; i++) {
    const a = i * 2.399;
    const rr = 24 + ((i * 37) % 23) * 7.2;
    let x = Math.cos(a) * rr * 0.9;
    let z = -66 + Math.sin(a) * rr * 1.25;
    let y = 4 + ((i * 19) % 47) * 2.3;
    const s = 0.5 + ((i * 11) % 9) * 0.20;
    // ---- AND IT MAY NOT BE BUILT INSIDE AN ISLAND ------------------------
    // Measured off the render, standing on the Shelf: half a dozen plates of
    // turf and a stone were sitting IN the meadow at deck height, because the
    // field is authored over an annulus that covers the whole archipelago and
    // its vertical band (4 to 112 m) covers every island in it. Walk it out
    // along its own bearing until driIslandAt has nothing to say about it —
    // never up, because up is where the route is.
    for (let g2 = 0; g2 < 14 && driBlockedForAir(x, y, z); g2++) {
      x += Math.cos(a) * 7.5;
      z += Math.sin(a) * 7.5;
    }
    driAirData[i * 4] = y;
    driAirData[i * 4 + 1] = i * 0.71;
    driAirData[i * 4 + 2] = 0.16 + ((i * 7) % 5) * 0.05;
    driAirData[i * 4 + 3] = ((i % 2) ? 1 : -1) * (0.05 + (i % 5) * 0.018);
    driPush9(stones, x, y, z, a, a * 0.7, a * 0.3, s, s * 0.8, s * 0.9);
    // every third one carries its turf, which is the detail that says these are
    // pieces of the same country the islands are
    if (i % 3 === 0) {
      // 10 cm of turf on a 1.5 m plate is a green playing card seen from
      // above, which is nine tenths of the angles this thing is seen from.
      driPush9(turfs, x, y + s * 0.40, z, a * 0.2, a * 0.7, a * 0.1,
               s * 1.15, 0.34, s * 1.05);
    }
    if (i % 4 === 1) {
      driPush9(chips, x + s * 0.9, y - s * 0.5, z, a, a * 1.3, a * 0.6,
               s * 0.5, s * 0.5, s * 0.5);
    }
  }
  driAirMesh = driInstance(root, driG.oct, mat(PALETTE.driRock), stones, false, false);
  driAirTurf = driInstance(root, driG.box, mat(PALETTE.driGrassDark), turfs, false, false);
  driAirChip = driInstance(root, driG.tet, mat(PALETTE.driRockDark), chips, false, false);
  if (driAirMesh) driAirMesh.frustumCulled = false;
  if (driAirTurf) driAirTurf.frustumCulled = false;
  if (driAirChip) driAirChip.frustumCulled = false;
}

/**
 * GROUND COVER, which is the difference between a meadow and a lawn.
 *
 * Three crossed quads to a clump, one draw call, two triangles a blade, and
 * pitched to about 0.6 rad — a blade held within a quarter of a radian of
 * horizontal shows this camera its whole top face and photographs as a green
 * playing card. Double-sided, for the same reason the ferns are: half a meadow
 * is seen from the far side of it.
 *
 * Laid only on the islands the player stands on. The deep and far ranks get
 * none: nothing at a hundred and forty metres reads a 40 cm blade, and their
 * budget is better spent on silhouette.
 */
function driBuildGroundCover(root) {
  const blades = [], stalks = [], pebbles = [];
  for (let i = 0; i < driISLES.length; i++) {
    const s = driISLES[i];
    if (s.id.indexOf('deep') === 0 || s.id.indexOf('far') === 0) continue;
    const bare = s.kind === 'bare';
    const n = Math.round(s.hx * s.hz * (bare ? 0.9 : 2.6));
    for (let k = 0; k < n; k++) {
      const a = rand(0, 6.28318), u = Math.sqrt(Math.random());
      const ex = Math.cos(a) * u * (s.hx - 0.8), ez = Math.sin(a) * u * (s.hz - 0.8);
      const wx = s.x + ex * s.cos - ez * s.sin, wz = s.z + ex * s.sin + ez * s.cos;
      if (bare || (k % 5) === 4) {
        const ps = 0.14 + (k % 4) * 0.06;
        driPush9(pebbles, wx, s.y + ps * 0.3, wz, a, a * 1.7, a * 0.4, ps, ps * 0.7, ps);
        if (bare) continue;
      }
      // ---- AND A BLADE OF GRASS STANDS UP --------------------------------
      // driG.quad lies in XZ, so rx IS the pitch off horizontal, and the first
      // cut used 0.62 rad on the strength of the palm-frond note. Measured off
      // the render: this camera looks down about 0.70 rad, so a plate at 0.62
      // is within a tenth of a radian of face-on to it and a meadow of them
      // photographs as a field of pale crosses lying in the grass. 0.62 is the
      // right pitch for a LEAF, which is a thing you are meant to see the top
      // of; a blade is a thing you are meant to see the EDGE of.
      const hgt = 0.34 + (k % 5) * 0.09;
      for (let b = 0; b < 3; b++) {
        const ba = a + b * 1.05;
        driPush9(blades, wx + Math.cos(ba) * 0.10, s.y + hgt * 0.40, wz + Math.sin(ba) * 0.10,
                 1.30 - (b % 2) * 0.12, ba, 0, 0.075, 1, hgt);
      }
      // and a seed-stalk in every sixth clump, so the meadow has a height as
      // well as a floor
      // driSeed (0xe8e0f6) is the fluff colour and it is nearly white. Two
      // hundred of them standing on a dark meadow were the brightest thing in
      // the frame and read as a scatter of dropped chalk. A seed head is a pale
      // GRASS, not a piece of the sky.
      if (k % 6 === 3) {
        driPush9(stalks, wx, s.y + 0.44, wz, 0.10, a, 0.06, 0.028, 0.88, 0.028);
      }
    }
  }
  // driGrassPale against driGrass is four values of lightness apart, and at
  // 16 cm wide the first cut photographed as a churchyard: two thousand pale
  // upright rectangles standing in a dark meadow. driMoss is one step, which
  // is what grain wants — see driVC.
  driInstance(root, driG.quad, mat(PALETTE.driMoss, { side: THREE.DoubleSide }),
              blades, false, false);
  if (stalks.length) driInstance(root, driG.cyl4, mat(PALETTE.driGrassPale), stalks, false, false);
  if (pebbles.length) driInstance(root, driG.oct, mat(PALETTE.driStone), pebbles, false, true);
}

/**
 * A COLUMN IS THE ONLY LIFT IN THE CHAPTER THAT IS NOT A JUMP, AND YOU COULD
 * NOT SEE ONE.
 *
 * Three shafts of rising air, eight metres across and up to a hundred and
 * twenty-eight tall. They are the way up from the Anvil, the way up to the
 * Crown, and — because their bases sit just over the cloud — the way BACK from
 * anywhere you fall, which makes them the single most important navigational
 * fact in the biome. What marked them was a scatter of motes inside the shaft
 * and a few stones at the foot, neither of which reads from more than about
 * twenty metres, in a world where the distance between two places you can
 * stand is twenty-five.
 *
 * A ring of monoliths at the base, tallest on the side the route arrives from,
 * and above it a SPIRAL of the bigger stuff the column has picked up and never
 * managed to put down — climbing, thinning, and stopping at the shaft's top
 * where the lift tapers out. That last part is the one that matters: it draws
 * the height of the thing, which is the number the player actually needs.
 *
 * All of it is in the round: a monolith is three-dimensional and casts, the
 * spiral is forty metres up in the air over nothing and does not.
 */
function driBuildColumnMarks(game, root) {
  const M = driMerger();
  const spiral = [];
  for (let i = 0; i < driCOLS.length; i++) {
    const c = driCOLS[i];
    // one body per column's ring of monoliths — see driStaticGroup
    const RG = driStaticGroup(game);
    const ring = 9 + i;
    for (let k = 0; k < ring; k++) {
      const a = k / ring * 6.28318 + i * 0.7;
      // The base of a column sits at 0.4 — over the cloud, not over an island —
      // so the ring has to stand on the CLOUD, which is what makes it read from
      // above as a circle drawn on the sea.
      const rr = c.r * 1.45;
      const x = c.x + Math.cos(a) * rr, z = c.z + Math.sin(a) * rr;
      const h = 2.2 + Math.abs(Math.sin(a * 0.5 + i)) * 2.6;
      M.box(x, driCLOUD_Y + h * 0.5, z, 1.05, h, 0.85,
            k % 3 ? PALETTE.driRock : PALETTE.driRockDark,
            0.05 * Math.sin(a), a, 0.04 * Math.cos(a));
      M.oct(x, driCLOUD_Y + h + 0.3, z, 0.5, PALETTE.driStone, a * 0.3, a, 0.1);
      driAddBeacon(x, driCLOUD_Y + h + 0.75, z);
      RG.add(x, driCLOUD_Y + h * 0.5, z, 1.3, h, 1.1, a);
    }
    RG.done();
    // the spiral. Two and a half turns from the ring to the top, thinning all
    // the way, so the shaft has a HEIGHT you can read off the sky.
    const turns = 2.5, nStone = 40;
    for (let k = 0; k < nStone; k++) {
      const u = k / (nStone - 1);
      const a = u * turns * 6.28318 + i * 1.3;
      const rr = c.r * (1.25 - u * 0.55);
      const sz = (1.5 - u * 1.05) * (0.7 + ((k * 7 + i) % 4) * 0.14);
      spiral.push(c.x + Math.cos(a) * rr, driCLOUD_Y + 5 + u * (c.top - 8),
                  c.z + Math.sin(a) * rr,
                  a, a * 0.7, a * 0.4, sz, sz * 0.8, sz * 0.9);
    }
  }
  const mesh = new THREE.Mesh(M.build(), driVC());
  mesh.name = 'dri:colmarks';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);
  // A plain mat(), never a vertexColors one: a bare driG.oct in a
  // vertexColors material renders BLACK — three feeds the shader a missing
  // attribute and it reads as zero.
  driInstance(root, driG.oct, mat(PALETTE.driRock), spiral, false, false);
}

/**
 * SOMEBODY FARMED UP HERE.
 *
 * The fiction of the chapter is that the ground came off and took everything
 * with it, and the evidence for that was a croft, a lamp-post, a jetty and a
 * hoist: four objects on four islands and nothing at all on the other
 * twenty-six. A drystone wall is the cheapest possible sentence about somebody
 * having OWNED a field, it survives being torn off a country better than
 * anything else people build, and it gives a green rectangle a line across it
 * that is not the rectangle.
 *
 * Walls cast. They are a metre of stone standing on a deck and the shadow is
 * most of what makes them read as three-dimensional under a moon this low.
 */
function driBuildWalls(game, root) {
  const M = driMerger();
  // ---- AND NOT ON THE DEEP RANK -----------------------------------------
  // qa/audit-solid.js walks the whole world including the deep islands (deepA
  // sits at x = -110, which IS the edge of the playable box), and a wall out
  // there is either thirty more static bodies in the broadphase for scenery
  // nobody stands on, or three walk-through hits. driBuildFarDressing already
  // gives that rank a skyline, and a field boundary is a thing you read from
  // the island you are standing on.
  const WALLED = ['shelf', 'stepA', 'stepC', 'shoalA', 'orchard', 'farside', 'crown',
                  'pebC', 'pebE'];
  for (let i = 0; i < driISLES.length; i++) {
    const s = driISLES[i];
    if (WALLED.indexOf(s.id) < 0) continue;
    // ONE BODY PER ISLAND. Seventy-five wall stones were seventy-five separate
    // CANNON bodies — more than half of a chapter that was measured at 197
    // against a hard limit of 130. See driStaticGroup, and note that the group
    // is per island and never per file: a compound body's AABB is the union of
    // its shapes, and one holding the whole archipelago's walls would be tested
    // against everything, every step.
    const WG = driStaticGroup(game);
    // one wall, running across the short axis, offset off centre so it never
    // reads as an axis of symmetry
    const off = ((i % 3) - 1) * s.hx * 0.42;
    const len = s.hz * 1.55;
    const segs = Math.max(5, Math.round(len * 0.9));
    const gapAt = 2 + (i % Math.max(1, segs - 4));    // a gate, because a field has one
    for (let k = 0; k < segs; k++) {
      if (k === gapAt || k === gapAt + 1) continue;
      const t = (k / (segs - 1) - 0.5) * len;
      const ex = off + Math.sin(k * 1.9) * 0.22, ez = t;
      const wx = s.x + ex * s.cos - ez * s.sin, wz = s.z + ex * s.sin + ez * s.cos;
      // never through the spawn, and never inside the lantern's apron
      if (s.id === 'shelf' && Math.abs(wx - driSPAWN.x) < 6 && Math.abs(wz - driSPAWN.z) < 6) continue;
      if (s.id === 'crown') {
        const lx = wx - driLANTERN.x, lz = wz - driLANTERN.z;
        if (lx * lx + lz * lz < 15 * 15) continue;
      }
      // three courses, each narrower and rotated a little, so it is a wall
      // built out of stones and not an extruded rectangle
      for (let c = 0; c < 3; c++) {
        M.box(wx + Math.sin(k * 2.3 + c) * 0.07, s.y + 0.16 + c * 0.30,
              wz + Math.cos(k * 1.7 + c) * 0.07,
              0.62 - c * 0.09, 0.30, 1.06 - c * 0.05,
              (k + c) % 3 ? PALETTE.driRockPale : PALETTE.driStone,
              0.03 * (c - 1), s.yaw + Math.sin(k + c) * 0.10, 0.03 * ((c + k) % 2 ? 1 : -1));
      }
      if (k % 2 === 0) M.oct(wx, s.y + 1.02, wz, 0.30, PALETTE.driStone, k * 0.3, k * 0.7, 0.1);
      // A wall a metre high is a thing you walk into.
      WG.add(wx, s.y + 0.45, wz, 0.8, 0.90, 1.1, s.yaw);
    }
    // and the gate: two posts and a rail that has slipped
    {
      const t = (gapAt / Math.max(1, segs - 1) - 0.5) * len + len / Math.max(1, segs - 1) * 0.5;
      for (let g2 = -1; g2 <= 1; g2 += 2) {
        const ez2 = t + g2 * 1.1;
        const wx2 = s.x + off * s.cos - ez2 * s.sin, wz2 = s.z + off * s.sin + ez2 * s.cos;
        M.cyl(wx2, s.y + 0.62, wz2, 0.11, 1.24, PALETTE.driTimber, 0, 0, 0, 6);
      }
      const wx3 = s.x + off * s.cos - t * s.sin, wz3 = s.z + off * s.sin + t * s.cos;
      M.box(wx3, s.y + 0.44, wz3, 0.09, 0.09, 2.1, PALETTE.driTimber, 0.22, s.yaw, 0);
      WG.done();
    }
  }
  const mesh = new THREE.Mesh(M.build(), driVC());
  mesh.name = 'dri:walls';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);
}

// ================================================================ TRAVELLERS ==
/**
 * THE SIX PEOPLE WHO ARE ALSO WAITING.
 *
 * The Drift shipped with two locals — the fewest of any chapter by a factor of
 * three — on the argument that the solitude IS the chapter. That argument is
 * right about the first two thirds and wrong about the world: there is a lamp
 * still burning on the Shelf, a hearth still warm under it, a jetty, a hoist
 * with a rope paid out into the cloud, a drying rack of empty paper cases and a
 * nine-metre lantern somebody used to light. Nobody built all that and left.
 *
 * The fix is not a village. Every one of these six is ALONE, on an island of
 * their own, and every one of them is doing the same thing the player is doing:
 * WAITING FOR THE BREATH TO COME ROUND. That is the whole pacing of the
 * chapter — a gap you cannot cross now you can cross in twenty seconds — and
 * putting a person at the near end of each of the hard ones turns a pause into
 * a place, which is exactly the job the roost does on the gateway.
 *
 * The one at the arch is the important one. She reads the wind out loud, off
 * the real driWindAng, and she is the only thing in the chapter that ever says
 * the mechanic in words.
 *
 * Their kit is built here and merged into ONE mesh with one draw call. A voice
 * with nothing round it is a ghost story: see npc.js, THE LOCALS.
 */
// ---- AND THEY KNOW HOW FAR YOU HAVE GOT (v21) -----------------------------
// Six people strung out along a route, each of them alone on an island, each
// of them saying the same four sentences from the first minute of the chapter
// to the last. In a place with nobody else in it that is a much bigger loss
// than it is in a city: the ONLY thing that can tell a solitary player they
// are getting somewhere is the next solitary person, and every one of them was
// outside time.
//
// See localResolve in npc.js — `before`/`after` a task id, `when` for anything
// else, `onTask` for the moment it happens. Deliberately NO addExchange here,
// unlike chapters 5 through 8: the design of this chapter is one voice per
// island and forty metres of sky between them, and two people talking would
// mean two people standing together, which is the one thing the Drift has
// spent nine tasks not having.
const driLitNow = function () { return !!(driGame && driGame.drift && driGame.drift.lit() > 0.4); };
const driTRAVELLERS = [
  // 1 — THE JETTY. The end of a broken pier over four hundred metres of
  // nothing, and somebody sitting on it with a line paid out into the cloud.
  { id: 'jetty', x: driJETTY.x - 1.6, y: 30, z: driJETTY.z - 1.2, face: -2.2, near: 8,
    kit: 'rod',
    figure: { shirt: PALETTE.driPaperDim, legs: PALETTE.driTimber },
    lines: ['There is nothing down there. I have been at it eleven years.',
            'It is not about the fish. There are no fish. It is about the sitting.',
            'Lamp is my grandfather’s. It has not gone out. Nobody knows why.',
            'Wind is coming round. You will feel it before you see it.',
            { t: 'Go on. Off the end. It is the only way anybody finds out.',
              before: 'cloud-dive' },
            { t: 'You went off my jetty. Eleven years and nobody has done that.',
              after: 'cloud-dive' },
            { t: 'It gave you back. It always gives you back. I did check.',
              after: 'handed-back' },
            { t: 'There is a lit thing at the top now. I can see it from here.',
              when: driLitNow }],
    wheek: ['Do you mind. I am concentrating on nothing.',
            'That is the first noise anybody has made out here since spring.',
            { t: 'You have got a lot louder since the top of the world lit up.',
              when: driLitNow }],
    onTask: { 'cloud-dive': ['THAT is the way to find out.',
                             'Eleven years I have looked at that. Never once got in it.'],
              'handed-back': ['I told you. Nothing up here falls all the way.'],
              'puff-up': ['Do that at the top of a jump and see what happens.'] },
    praise: ['Mm. Do it quietly, the fish are — there are no fish.'] },
  // 2 — THE STAIRS. A surveyor with a board, counting the islands, and the
  // count keeps changing because two of them move.
  { id: 'survey', x: -1.5, y: 38.6, z: -36.5, face: 1.1, near: 8,
    kit: 'board',
    figure: { shirt: PALETTE.driRibbonC, legs: PALETTE.driRockDark, hat: PALETTE.driStone },
    lines: ['Thirty-one. No. Thirty-three. Two of them will not hold still.',
            'I am making a map. The map is wrong by the time I have drawn it.',
            'If you find the edge of it, come back and tell me where.',
            'Go up. Everything up here goes up.',
            { t: 'Two of them wander. Stand on one and it will take you somewhere.',
              before: 'wander-isle' },
            { t: 'You rode one. Which one? WHICH ONE? I need to know which one.',
              after: 'wander-isle' },
            { t: 'The column at the far end of the Anvil. That is the lift. Take it.',
              before: 'updraft' },
            { t: 'You went up the column. Add a hundred metres to my map.',
              after: 'updraft' },
            { t: 'I have got as far as the gap. Nobody has ever surveyed past the gap.',
              before: 'long-gap' },
            { t: 'You crossed the gap. I am putting a line on the map. A dotted line.',
              after: 'long-gap' }],
    wheek: ['Right. Yes. I shall put that down as one.',
            'Do that again by the far one and I can measure how long it takes.'],
    onTask: { 'wander-isle': ['THAT ONE. It is that one. It has always been that one.'],
              'long-gap': ['Twenty-three metres. I measured it. TWENTY-THREE.'],
              'lantern': ['Well, now I have to redraw the whole thing.'] },
    praise: ['I shall not be recording that.'] },
  // 3 — THE ANVIL. The hoist has a rope paid out into the cloud and somebody at
  // the other end of it, still hauling.
  { id: 'winch', x: -35.2, y: 41.5, z: -49.6, face: 0.6, near: 8,
    kit: 'coil',
    figure: { shirt: PALETTE.driLamp, legs: PALETTE.driSoil },
    lines: ['Something is on the end of this. Has been for a while.',
            'Do not lean on the frame. The frame is the newest thing here.',
            { t: 'Up the column when it comes. It will not ask twice.', before: 'updraft' },
            { t: 'You took the column. Everybody takes the column eventually.',
              after: 'updraft' },
            'I have hauled eleven metres this year. I am ahead of schedule.',
            { t: 'If you are going to fall, fall on purpose. It is nicer.',
              before: 'cloud-dive' },
            { t: 'Shout in the air. Halfway up, not at the top. Halfway.',
              before: 'puff-up' },
            { t: 'You have worked out the shout, then. That is the chapter, that.',
              after: 'puff-up' }],
    wheek: ['Every time. Every single time somebody does that.',
            'Save it. You will want it for the pale ones up the top.'],
    onTask: { 'updraft': ['Straight up. On a noise and a lot of nerve.'],
              'puff-up': ['THERE it is. Did you feel it hold you?'],
              'driftseed': ['A seed. You crossed on a SEED. I have a rope and I am here.'] },
    praise: ['I am not stopping hauling for that.'] },
  // 4 — THE SHOALS. Asleep, in a blanket, under a stone. Wakes if you wheek.
  { id: 'sleeper', x: -54.5, y: 76, z: -83, face: 2.7, near: 8,
    kit: 'camp',
    figure: { shirt: PALETTE.driMoss, legs: PALETTE.driBark },
    lines: ['Mm. Is it turned yet.',
            'Wake me when it goes southerly. Not before.',
            'Thirty-eight seconds. It is always thirty-eight seconds.',
            'You are the first thing to come up that column in a month.',
            { t: 'There are lights in the orchard. Go and be introduced.',
              before: 'lampfly' },
            { t: 'You have been at the lampflies. You smell of paper.',
              after: 'lampfly' },
            { t: 'Somebody has lit the top of the world. Marvellous. Now go away.',
              when: driLitNow }],
    wheek: ['I am AWAKE. I have been awake since you were on the stairs.',
            'Yes. Yes. Very good. Go and do it at the gateway, they love it.'],
    onTask: { 'lampfly': ['They only come for people who ask nicely. You shouted.'],
              'lantern': ['Fine. FINE. I am up.'],
              'long-gap': ['From here that looked like a mistake that worked.'] },
    praise: ['Mm. Congratulations. Good night.'] },
  // 5 — THE ARCH. She reads the wind, and this is the one line in the chapter
  // that says what the chapter is. driUpdateTravellers rewrites the FIRST FOUR
  // of these every 1.4 s off the real driWindAng — so nothing conditional may
  // be put in those four slots, and everything conditional goes after them.
  { id: 'reader', x: 6.5, y: 84, z: -99.5, face: -0.7, near: 9,
    kit: 'vane',
    figure: { shirt: PALETTE.driBlossom, legs: PALETTE.driRockDark, hat: PALETTE.driPaper },
    lines: ['Wait for it.', 'Wait for it.', 'Wait for it.', 'Wait for it.',
            { t: 'Watch the vane go all the way round once. Then you will know.',
              before: 'weathervane' },
            { t: 'You watched it round. Now you are reading it instead of guessing.',
              after: 'weathervane' },
            { t: 'Twenty-three metres and twelve down. Wait for the turn and it is nothing.',
              before: 'long-gap' },
            { t: 'You went on the turn. That is the only way it has ever been done.',
              after: 'long-gap' },
            { t: 'There is a slower way. The seed-heads go over on the same breath.',
              before: 'driftseed' }],
    wheek: ['Shh. Listen to it instead.',
            'The birds do that when it turns as well. They are better at it.'],
    onTask: { 'long-gap': ['ON THE TURN. Did everybody see that? There is nobody. I saw it.'],
              'weathervane': ['Round it goes. Thirty-eight seconds, over and back.'],
              'driftseed': ['You let a SEED do the waiting for you. That is cheating and it is lovely.'] },
    praise: ['The wind does not care. I noticed, though.'] },
  // 6 — THE FAR SIDE. Somebody who has just made the crossing, sitting down
  // very suddenly, absolutely delighted about it.
  { id: 'crosser', x: 39.5, y: 72, z: -133, face: 2.9, near: 8,
    kit: 'pack',
    figure: { shirt: PALETTE.driRibbonA, legs: PALETTE.driTimber },
    lines: ['I made it. I want you to know that I made it.',
            'Twelve metres down. That is the trick. You fall the difference.',
            'Do not go back. There is nothing back there but the way you came.',
            { t: 'One more island and it is the lantern and then I am going to sit down.',
              before: 'lantern' },
            { t: 'It is lit. Somebody lit it. I am not moving for a week.',
              after: 'lantern' },
            { t: 'You came the same way I did. Nobody believes me about the drop.',
              after: 'long-gap' },
            { t: 'There is a column past the Crown that puts you straight back. Straight back.',
              after: 'updraft' }],
    wheek: ['HA. Yes. That is exactly the noise I made.',
            'Careful, you will have the whole gateway up.'],
    onTask: { 'lantern': ['THE WHOLE SKY. Look at it. LOOK at it.'],
              'long-gap': ['I KNOW. I know. Sit down. Sit down here a minute.'],
              'handed-back': ['It does that. It is the kindest thing up here.'] },
    praise: ['Everything is astonishing today. Including that.'] },
];

/**
 * The kit. One merged mesh, one draw call, and it is what stops six voices
 * being six voices standing in a field. Each piece is placed relative to the
 * traveller and rotated to their facing, so a rod points out over the drop and
 * a coil of rope lies at the winch-man's feet rather than behind him.
 */
function driBuildCamps(game, root) {
  const M = driMerger();
  const E = driMerger();          // anything that is a LIGHT, drawn unlit
  for (let i = 0; i < driTRAVELLERS.length; i++) {
    const t = driTRAVELLERS[i];
    const c = Math.cos(t.face), s = Math.sin(t.face);
    // local (right, forward) -> world, so every camp is authored facing +z
    const P = (rx, fz) => [t.x + rx * c + fz * s, t.z - rx * s + fz * c];
    if (t.kit === 'rod') {
      // a rod over the edge, a creel, and a lamp on the boards
      const [ax, az] = P(0.45, 0.5);
      M.cyl(ax, t.y + 0.95, az, 0.035, 3.4, PALETTE.driTimber, 0.62, t.face, 0, 4);
      const [bx, bz] = P(-0.7, -0.2);
      M.cyl(bx, t.y + 0.22, bz, 0.34, 0.44, PALETTE.driSeed, 0, 0.4, 0, 8);
      M.cyl(bx, t.y + 0.45, bz, 0.36, 0.06, PALETTE.driBark, 0, 0.4, 0, 8);
      driStaticBox(game, bx, t.y + 0.22, bz, 0.7, 0.5, 0.7, 0);
      const [lx, lz] = P(0.9, -0.5);
      M.cyl(lx, t.y + 0.18, lz, 0.16, 0.36, PALETTE.driRockPale, 0, 0, 0, 6);
      E.cyl(lx, t.y + 0.40, lz, 0.13, 0.20, PALETTE.driLampGlow, 0, 0, 0, 6);
      driAddBeacon(lx, t.y + 0.50, lz, true);
    } else if (t.kit === 'board') {
      // a plane table on three legs, a roll of paper, and a stack of markers
      const [tx, tz] = P(0.0, 0.75);
      M.box(tx, t.y + 0.92, tz, 0.86, 0.06, 0.64, PALETTE.driPaper, 0.10, t.face, 0);
      for (let l = 0; l < 3; l++) {
        const a2 = t.face + l * 2.094;
        M.cyl(tx + Math.cos(a2) * 0.26, t.y + 0.45, tz + Math.sin(a2) * 0.26,
              0.035, 0.90, PALETTE.driTimber, Math.cos(a2) * 0.16, 0, Math.sin(a2) * 0.16, 4);
      }
      driStaticBox(game, tx, t.y + 0.50, tz, 0.9, 1.0, 0.7, 0);
      const [rx2, rz2] = P(-0.8, 0.3);
      M.cyl(rx2, t.y + 0.10, rz2, 0.09, 0.86, PALETTE.driPaper, 0, 0.5, Math.PI * 0.5, 6);
      for (let k = 0; k < 4; k++) {
        M.oct(rx2 + 0.3 + k * 0.16, t.y + 0.12, rz2 - 0.4, 0.13,
              k % 2 ? PALETTE.driStone : PALETTE.driRock, k, k * 1.3, 0);
      }
    } else if (t.kit === 'coil') {
      // a coil of rope, a hook, and a tally cut into a post
      const [cx2, cz2] = P(0.6, 0.4);
      for (let k = 0; k < 4; k++) {
        M.cyl(cx2, t.y + 0.07 + k * 0.11, cz2, 0.42 - k * 0.06, 0.10, PALETTE.driSeed,
              0.02, k * 0.7, 0.02, 8);
      }
      M.cyl(cx2 + 0.5, t.y + 0.08, cz2 - 0.3, 0.05, 0.5, PALETTE.driStone, 0.4, 1.1, 1.3, 4);
      const [px, pz] = P(-0.9, 0.2);
      M.cyl(px, t.y + 0.62, pz, 0.10, 1.24, PALETTE.driTimber, 0, 0, 0, 6);
      for (let k = 0; k < 7; k++) {
        M.box(px + 0.10, t.y + 0.30 + k * 0.11, pz, 0.06, 0.02, 0.14, PALETTE.driRockDark);
      }
      driStaticBox(game, px, t.y + 0.62, pz, 0.3, 1.24, 0.3, 0);
    } else if (t.kit === 'camp') {
      // a bedroll, a pack, a mug, and a brazier that is still going
      const [bx2, bz2] = P(0.0, -0.55);
      M.cyl(bx2, t.y + 0.20, bz2, 0.30, 1.85, PALETTE.driMoss, 0, t.face, Math.PI * 0.5, 6);
      M.sph(bx2 + s * 0.85, t.y + 0.26, bz2 + c * 0.85, 0.28, 0.24, 0.28, PALETTE.driSeed);
      const [kx2, kz2] = P(0.95, 0.15);
      M.sph(kx2, t.y + 0.28, kz2, 0.34, 0.30, 0.26, PALETTE.driBark);
      driStaticBox(game, kx2, t.y + 0.28, kz2, 0.7, 0.6, 0.55, 0);
      M.cyl(kx2 + 0.4, t.y + 0.07, kz2 + 0.3, 0.08, 0.14, PALETTE.driRockPale, 0, 0, 0, 6);
      const [fx, fz] = P(-1.0, 0.5);
      M.cyl(fx, t.y + 0.16, fz, 0.30, 0.32, PALETTE.driRockDark, 0, 0, 0, 8);
      E.cyl(fx, t.y + 0.33, fz, 0.24, 0.06, PALETTE.driLamp, 0, 0, 0, 8);
      driAddBeacon(fx, t.y + 0.42, fz, true);
    } else if (t.kit === 'vane') {
      // A WIND VANE ON A POST, and it is the only object in the chapter that
      // tells you the answer rather than making you feel for it. It turns —
      // see driUpdateTravellers — so it is its own node, not part of the merge.
      const [vx, vz] = P(1.1, 0.2);
      M.cyl(vx, t.y + 1.05, vz, 0.075, 2.1, PALETTE.driTimber, 0, 0, 0, 6);
      driStaticBox(game, vx, t.y + 1.05, vz, 0.26, 2.1, 0.26, 0);
      const g = new THREE.Group();
      g.position.set(vx, t.y + 2.16, vz);
      const V = driMerger();
      V.box(0, 0, -0.36, 0.05, 0.30, 0.62, PALETTE.driPaper);        // the tail
      V.cone(0, 0, 0.42, 0.10, 0.44, PALETTE.driLampGlow, Math.PI * 0.5, 0, 0, 4);
      V.cyl(0, 0, 0, 0.06, 0.80, PALETTE.driTimber, Math.PI * 0.5, 0, 0, 4);
      const vm = new THREE.Mesh(V.build(), driVC());
      vm.castShadow = true;
      g.add(vm);
      root.add(g);
      driVaneNode = g;
      // a stool, and a slate with the count of breaths on it
      const [sx2, sz2] = P(-0.7, -0.3);
      M.cyl(sx2, t.y + 0.20, sz2, 0.24, 0.40, PALETTE.driTimber, 0, 0, 0, 6);
      driStaticBox(game, sx2, t.y + 0.20, sz2, 0.52, 0.40, 0.52, 0);
      M.box(sx2 - 0.5, t.y + 0.30, sz2 + 0.2, 0.5, 0.60, 0.04, PALETTE.driRockDark, 0.3, t.face, 0);
    } else if (t.kit === 'pack') {
      // a pack put down very suddenly, a hat, and a flask on its side
      const [px2, pz2] = P(0.75, -0.3);
      M.sph(px2, t.y + 0.30, pz2, 0.36, 0.32, 0.30, PALETTE.driRibbonB);
      M.cyl(px2 + 0.1, t.y + 0.58, pz2, 0.14, 0.34, PALETTE.driSeed, 0.4, 0.7, 0.2, 6);
      driStaticBox(game, px2, t.y + 0.30, pz2, 0.75, 0.65, 0.65, 0);
      const [hx2, hz2] = P(-0.8, 0.55);
      M.cyl(hx2, t.y + 0.06, hz2, 0.34, 0.06, PALETTE.driPaperDim, 0.08, 0.4, 0.05, 8);
      M.cyl(hx2, t.y + 0.14, hz2, 0.17, 0.16, PALETTE.driPaperDim, 0.08, 0.4, 0.05, 8);
      M.cyl(hx2 + 0.7, t.y + 0.09, hz2 - 0.4, 0.09, 0.30, PALETTE.driStone,
            Math.PI * 0.5, 0.9, 0, 6);
    }
  }
  const mesh = new THREE.Mesh(M.build(), driVC());
  mesh.name = 'dri:camps';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);
  // The warm things are LIGHTS, so they are unlit — a warm Lambert in a biome
  // whose only light is a moon thirteen degrees up comes back near-black on
  // every facet not pointing at it. Iceland's steam and Venice's arcade lamps,
  // twice in three chapters.
  if (!E.empty()) {
    const em = new THREE.Mesh(E.build(), new THREE.MeshBasicMaterial({ vertexColors: true }));
    em.castShadow = false;
    em.userData.noShadow = true;
    root.add(em);
  }
}

let driVaneNode = null;
const driTravRecs = Object.create(null);
let driTravT = 0;

/**
 * The wind-reader reads the wind. Her line is rewritten off the real
 * driWindAng and driWindX/Z, so the one person in the chapter who talks about
 * the mechanic is never wrong about it — and the vane on the post beside her
 * turns to match, which is the same fact said twice, once for people who read
 * and once for people who look.
 */
function driUpdateTravellers(dt) {
  driTravT += dt;
  if (driVaneNode) {
    // The SAME sense as the arrow on the Shelf's post (driVaneGroup, which is
    // slaved to atan2(windX, windZ) and shows where the wind is GOING): two
    // instruments in one chapter that disagree about the wind is worse than
    // one. This one has inertia, though — a vane that snaps is a pointer.
    const want = Math.atan2(driWindX, driWindZ);
    driVaneNode.rotation.y = driAngleDamp(driVaneNode.rotation.y, want, 2.4, dt);
  }
  const rec = driTravRecs.reader;
  if (!rec || !rec.lines) return;
  if (driTravT < 1.4) return;
  driTravT = 0;
  const spd = Math.hypot(driWindX, driWindZ);
  // Where in the breath we are: the cycle is driBREATH seconds over and back,
  // so the wind is at its calmest as the sign changes.
  const ph = (driTime % driBREATH) / driBREATH;
  const turning = Math.abs(Math.sin(ph * 6.28318)) < 0.28;
  const toGap = Math.abs(ph - 0.25) * driBREATH;
  if (turning) {
    rec.lines[0] = 'There. Feel that? It has let go. Go now, go now, go now.';
    rec.lines[1] = 'It is turning. Whatever you were waiting to do, do it.';
  } else if (spd > 2.1) {
    rec.lines[0] = 'Hard from the ' + driBearing(driWindX, driWindZ) +
                   '. Nobody crosses into that.';
    rec.lines[1] = 'Sit down. It has ' + Math.max(1, Math.round(toGap)) +
                   ' seconds of that in it yet.';
  } else {
    rec.lines[0] = 'Light, from the ' + driBearing(driWindX, driWindZ) + '. It is building.';
    rec.lines[1] = 'Thirty-eight seconds, over and back. You could set a clock by it.';
  }
  rec.lines[2] = 'The gateway is the place to jump from. Not the corner. The gateway.';
  rec.lines[3] = 'Everybody up here is waiting for the same thing. You get used to it.';
}
/** Eight points, because sixteen is a compass and this is a person talking. */
function driBearing(wx, wz) {
  const a = Math.atan2(wx, wz);
  const i = ((Math.round(a / 0.7853982) % 8) + 8) % 8;
  return ['south', 'south-west', 'west', 'north-west',
          'north', 'north-east', 'east', 'south-east'][i];
}
/** damp() on the shortest arc. A heading may never take the long way round. */
function driAngleDamp(cur, tgt, lambda, dt) {
  let d = tgt - cur;
  while (d > Math.PI) d -= 6.283185;
  while (d < -Math.PI) d += 6.283185;
  return cur + d * (1 - Math.exp(-lambda * dt));
}

// ============================================================== THE HORIZON ==
/**
 * THE DEEP AND FAR RANKS WERE BARE DECKS.
 *
 * Twenty-six islands — the whole horizon of the chapter, and the only thing
 * standing between the archipelago and the fog — carried a painted rectangle,
 * a crag and nothing else. driBuildFlora skipped them by accident (it walks
 * driISLES and the deep rank happens to be mostly 'green', so it got two or
 * three trees each) and driBuildGroundCover skips them on purpose. Seen from
 * the Crown, a hundred and eight metres up, which is where the chapter ends
 * and where you are explicitly invited to sit down and look, that is fourteen
 * flat green cards and eight grey ones.
 *
 * An island reads as a PLACE at that distance for exactly three reasons, and
 * none of them is detail: a broken skyline (trees, and they have to be
 * different heights), something vertical and man-made (a standing stone, a
 * gable), and a LIGHT. All three, none of it casting, all of it in two merged
 * meshes.
 */
const driFARLAMP = [];        // x, y, z of every lamp on the horizon

function driBuildFarDressing(game, root) {
  const M = driMerger();
  const E = driMerger();
  // 'solid' is true only for the DEEP rank — deepA reaches x = -110, which is
  // the edge of the playable box, so a five-metre monolith out there is
  // something the player can genuinely walk into, and qa/audit-solid.js walks
  // it. The far rank and the third rank are two hundred to four hundred metres
  // out, past everything, and are silhouettes: a static body apiece would be
  // pure broadphase.
  // `det` again, and for the same reason as driAddIsle: the third rank is two
  // to four hundred metres out, so its wood is a SKYLINE and not a wood. What
  // reads at that distance is the crown line, so the crowns stay and the count
  // comes down; the trunk under a crown 300 m away is a six-sided cylinder
  // nobody has ever seen.
  function dress(x, z, y, hx, hz, yaw, kind, seed, solid, det) {
    if (!(det > 0)) det = 1;
    // one body per island, never one for the whole rank: see driStaticGroup
    const DG = solid ? driStaticGroup(game) : null;
    const c = driIsleColours(kind);
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const dark = kind === 'bare';
    const n = Math.max(4, Math.round((dark ? 7 : Math.round(hx * hz * 0.17) + 5) * det));
    for (let k = 0; k < n; k++) {
      const a = seed * 1.7 + k * 2.399;
      const u = 0.25 + ((k * 13 + seed) % 7) * 0.10;
      const ex = Math.cos(a) * u * (hx - 1.4), ez = Math.sin(a) * u * (hz - 1.4);
      const wx = x + ex * cy - ez * sy, wz = z + ex * sy + ez * cy;
      if (dark) {
        // stone islands get monoliths rather than a wood: three or four
        // uprights of different heights is the same broken skyline for a
        // quarter of the triangles, and it is the right silhouette for the
        // colour they are painted.
        const h = 2.6 + ((k * 7 + seed) % 5) * 1.3;
        M.box(wx, y + h * 0.5, wz, 0.9 + (k % 3) * 0.3, h, 0.7 + (k % 2) * 0.3,
              k % 2 ? c[2] : c[3], 0.04 * (k - 2), a, 0.03 * ((k % 2) ? 1 : -1));
        M.oct(wx, y + h + 0.25, wz, 0.45, PALETTE.driStone, a * 0.3, a, 0.1);
        if (DG) DG.add(wx, y + h * 0.5, wz, 1.2, h, 1.0, a);
      } else {
        // and the wood: a trunk, a shoulder and a crown, at four heights, so
        // the top edge of the island is a line that goes up and down
        const s = 1.4 + ((k * 11 + seed) % 6) * 0.55;
        M.cyl(wx, y + s * 0.75, wz, s * 0.13, s * 1.6, PALETTE.driBark, 0.05, a, 0,
              det < 1 ? 4 : 6);
        M.oct(wx, y + s * 1.9, wz, s * 1.5, kind === 'pale' ? PALETTE.driLeafB : PALETTE.driLeafA,
              0, a, 0);
        if (det >= 1 || k % 2 === 0) {
          M.oct(wx + s * 0.14, y + s * 2.55, wz, s * 0.95,
                kind === 'pale' ? PALETTE.driLeafA : PALETTE.driLeafB, 0, a + 0.9, 0);
        }
      }
    }
    // ---- AND ONE LIGHT, WHICH IS THE WHOLE POINT ------------------------
    // A lamp on a horizon island is worth more than everything above it put
    // together: it is the difference between scenery and somewhere with
    // somebody in it, and it is what makes the end of the chapter work — see
    // driAnswerTheLantern.
    const lx = x + hx * 0.42 * cy, lz = z + hx * 0.42 * sy;
    for (let k = 0; k < 4; k++) {
      const r = 0.55 - k * 0.09;
      M.oct(lx + Math.sin(k * 2.1) * 0.12, y + 0.28 + k * 0.44, lz + Math.cos(k * 1.7) * 0.12,
            r, k % 2 ? c[2] : PALETTE.driStone, k * 0.4, k * 1.1, k * 0.2);
    }
    M.cyl(lx, y + 2.35, lz, 0.10, 1.9, PALETTE.driTimber, 0, 0, 0, 6);
    M.cyl(lx, y + 3.45, lz, 0.34, 0.44, PALETTE.driRockPale, 0, 0, 0, 6);
    // driLampGlow (0xffe9c2) is a hair off white and the composite runs a box
    // bloom: twenty-six of these coming up at once photographed as twenty-six
    // hard-edged glowing SQUARES, which is the kernel and not the lamp. Half
    // the emitter and the warmer of the two lamp colours.
    E.cyl(lx, y + 3.45, lz, 0.15, 0.22, PALETTE.driLamp, 0, 0, 0, 6);
    driFARLAMP.push(lx, y + 3.45, lz);
    if (DG) DG.done();
  }
  for (let i = 0; i < driISLES.length; i++) {
    const s = driISLES[i];
    if (s.id.indexOf('deep') !== 0 && s.id.indexOf('far') !== 0) continue;
    dress(s.x, s.z, s.y, s.hx, s.hz, s.yaw, s.kind, i + 5, s.id.indexOf('deep') === 0);
  }
  for (let i = 0; i < driFARFIELD.length; i++) {
    const f = driFARFIELD[i];
    dress(f.x, f.z, f.y, f.hx, f.hz, i * 0.7, f.kind, 90 + i, false, 0.55);
  }
  const m = new THREE.Mesh(M.build(), driVC());
  m.name = 'dri:fardress';
  m.castShadow = false;
  m.receiveShadow = false;
  m.userData.noShadow = true;
  root.add(m);
  // The lamps are LIGHTS. Unlit, and DARK to begin with — see below.
  driFarLampMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true,
                                                depthWrite: false, opacity: 0.0 });
  const em = new THREE.Mesh(E.build(), driFarLampMat);
  em.castShadow = false;
  em.userData.noShadow = true;
  em.frustumCulled = false;
  driFarLampMesh = em;
  root.add(em);
}

let driFarLampMesh = null, driFarLampMat = null;
let driAnswerT = -1;              // s since the lantern was lit, or -1
let driAnswerLit = 0;             // how many of them have come up

/**
 * THE ANSWER, which is the end of chapter nine.
 *
 * Lighting the lantern already does a great deal: the ribbons take it, the
 * cloud takes it, the whole swarm takes it, and a wave of warmth runs outward
 * through every mark in the archipelago at 55 m/s (driUpdateBeacons). All of
 * that happens on the island you are standing on and within about four seconds.
 *
 * What it did not do was change the WORLD. You climb a hundred and eight metres
 * through an empty sky, light the last lit thing before the dark bit, and the
 * empty sky is exactly as empty as it was.
 *
 * So: over the twenty-two seconds after it takes, the twenty-six islands on the
 * horizon light their own lamps, one at a time, furthest first — because the
 * furthest one has the furthest to have seen you. It is not a task, it has no
 * line on the card, and by the time it finishes the banner has gone. It is the
 * chapter answering.
 *
 * The lamps are drawn from the first frame at zero opacity rather than being
 * built when the moment arrives: a merged mesh authored mid-chapter is a hitch,
 * and a hitch is the one thing this moment cannot have.
 */
function driAnswerTheLantern(dt) {
  if (!driFarLampMat) return;
  if (!driLit) { driAnswerT = -1; driAnswerLit = 0; driFarLampMat.opacity = 0; return; }
  if (driAnswerT < 0) driAnswerT = 0;
  driAnswerT += dt;
  const n = driFARLAMP.length / 3;
  // The first one comes up two and a half seconds in — long enough that the
  // wave of beacons on the Crown has finished and the player has looked up.
  const want = clamp((driAnswerT - 2.5) / 22, 0, 1) * n;
  while (driAnswerLit < want && driAnswerLit < n) {
    const i = driAnswerLit;
    driAnswerLit++;
    // A NOISE PER LAMP, RATIONED BY DISTANCE, and the far ones are quieter and
    // lower — which is the only reason twenty-six chimes in twenty-two seconds
    // is a chord and not an alarm clock.
    const p = driGame && driGame.capy ? driGame.capy.position : null;
    if (p) {
      const d = Math.hypot(driFARLAMP[i * 3] - p.x, driFARLAMP[i * 3 + 2] - p.z);
      driSfx('chime', { volume: clamp(0.30 - d * 0.0007, 0.05, 0.30),
                        pitch: clamp(1.45 - d * 0.0016, 0.55, 1.45) });
    }
  }
  // One material, so they come up together once they are all alight. The ramp
  // is what makes each new one read as a new one: it rises fast to the group
  // level and the group level rises slowly.
  const k = driAnswerLit / Math.max(1, n);
  driFarLampMat.opacity = damp(driFarLampMat.opacity, 0.30 + k * 0.38, 3.0, dt);
}

/** The stone arch, and the two posts either side of the Long Gap. */
function driBuildArch(game, root) {
  const M = driMerger();
  const AX = driARCH.x, AZ = driARCH.z, AY = driARCH.y;
  // ---- IT WAS CALLED AN ARCH AND IT WAS A DOORFRAME ------------------------
  // Two rectangular posts and a lintel, square to the world, standing in the
  // middle of an island. It did not read as an arch and, worse, it did not
  // POINT anywhere: the hardest jump in the game starts on this island and the
  // one piece of architecture on it stood at forty degrees to the crossing.
  // A gateway is a sentence about which way to go, so this one now says it — a
  // real ring of voussoirs, turned so that walking through it puts the far side
  // dead ahead and standing under it frames the landing.
  //
  // The heading is measured, not eyeballed: arch island to `farside` is
  // (+37, -31), and the arch's local +z (its through-axis) is set to it.
  const dxg = 42 - AX, dzg = -137 - AZ;
  const gLen = Math.hypot(dxg, dzg);
  const yaw = Math.atan2(dxg / gLen, dzg / gLen);
  const cy2 = Math.cos(yaw), sy2 = Math.sin(yaw);
  const AXf = (u, v) => AX + u * cy2 + v * sy2;
  const AZf = (u, v) => AZ - u * sy2 + v * cy2;
  const SPRING = 3.6, R = 2.6, LEG = R + 0.55;
  for (let side = -1; side <= 1; side += 2) {
    M.box(AXf(side * LEG, 0), AY + SPRING * 0.5, AZf(side * LEG, 0),
          1.1, SPRING, 1.5, PALETTE.driRockPale, 0, yaw, 0);
    M.box(AXf(side * LEG, 0), AY + 0.28, AZf(side * LEG, 0),
          1.6, 0.56, 2.0, PALETTE.driStone, 0, yaw, 0);
  }
  // THE ROLL GOES THE OTHER WAY. driXform composes Ry.Rx.Rz, so rz turns the
  // voussoir about world +z BEFORE the yaw — and a box whose local +y must end
  // up radial at angle a needs rz = a - PI/2, not PI/2 - a. With the sign
  // inverted the ring came apart into nine slabs leaning the wrong way, which
  // is what an arch looks like the moment before it is not an arch.
  for (let k = 0; k < 9; k++) {
    const a = (k + 0.5) / 9 * Math.PI;
    const rr = R + 0.55;
    const u = Math.cos(a) * rr, hgt = Math.sin(a) * rr;
    M.box(AXf(u, 0), AY + SPRING + hgt, AZf(u, 0),
          Math.PI * rr / 9 + 0.16, 0.86, 1.5, PALETTE.driStone, 0, yaw, a - Math.PI * 0.5);
  }
  M.box(AXf(0, 0), AY + SPRING + R + 1.25, AZf(0, 0), 1.3, 1.1, 1.8, PALETTE.driRockPale, 0, yaw, 0);
  driARCH_MARK.push(AXf(0, 0.85), AY + SPRING + R + 0.6, AZf(0, 0.85));

  // THE LONG GAP. Two carved posts, one on each lip, leaning at each other
  // across twenty-five metres of nothing. They are not a mechanic — they are
  // a sentence: somebody used to do this on purpose, and they went that way.
  M.box(11, AY + 1.7, -110, 0.7, 3.4, 0.7, PALETTE.driStone, 0.24, 0.55, 0);
  M.oct(11, AY + 3.6, -110, 0.9, PALETTE.driPaper, 0.3, 0.5, 0);
  M.box(34, 73.7, -130, 0.7, 3.4, 0.7, PALETTE.driStone, -0.24, 0.55, 0);
  M.oct(34, 75.6, -130, 0.9, PALETTE.driPaper, -0.3, 0.5, 0);
  // AND BOTH POSTS CARRY A LIGHT. A jump you cannot see the end of is a leap of
  // faith, and this chapter has never once asked for one of those: the far lip
  // is twelve metres DOWN, so from the near side the landing is below the
  // horizon of its own island and there was nothing at all to aim at.
  driARCH_MARK.push(11, AY + 3.6, -110);
  driARCH_MARK.push(34, 75.6, -130);
  M.cyl(38, 72.6, -130.5, 0.16, 2.4, PALETTE.driStone, 0, 0, 0, 6);
  driARCH_MARK.push(38, 74.1, -130.5);
  // AND A PENNANT ON EACH LIP. The wind is this chapter's clock and the ONE
  // place the player has to read it is standing on the near lip deciding
  // whether to go now or wait twenty seconds — and the only wind indicator in
  // the biome was a vane on the Shelf, a hundred and eighty metres away and
  // three islands back. The motes drift, but they drift everywhere and they do
  // not tell you which way is downwind at a glance. A rag on a pole does.
  driPENNANTS.push(11, AY + 4.6, -110);
  driPENNANTS.push(34, 76.6, -130);
  driPENNANTS.push(AXf(0, 0), AY + SPRING + R + 2.6, AZf(0, 0));

  // ---- THE MASTS. AND THEY WERE NOT THERE. --------------------------------
  // These three cylinders used to be pushed into M *after* M.build() had
  // already been called eight lines below — so they went into an array nothing
  // ever read, and the chapter's three wind pennants (the only way to read the
  // wind while standing still, which is the whole pacing of the place) hung in
  // mid-air on nothing at all. Silent: the merger is happy to take geometry
  // after it has been built, it just never draws it. Built BEFORE the build now,
  // which is the only order that can be right.
  for (let i = 0; i < driPENNANTS.length; i += 3) {
    // PALE, AND THICK ENOUGH TO SEE. A 7 cm dark-timber pole against a violet
    // sky is invisible, so all three pennants read as tan rags floating in mid
    // air — and the whole point of them is to tell you which way the wind is
    // going while you stand on the lip and decide whether to go.
    M.cyl(driPENNANTS[i], driPENNANTS[i + 1] - 1.1, driPENNANTS[i + 2], 0.11, 2.2,
          PALETTE.driRockPale, 0, 0, 0, 6);
    // a finial, so the top of the mast is a thing and not a cut cylinder
    M.oct(driPENNANTS[i], driPENNANTS[i + 1] + 0.16, driPENNANTS[i + 2], 0.18,
          PALETTE.driRockPale, 0, 0.6, 0);
  }

  const mesh = new THREE.Mesh(M.build(), driVC());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);

  // the pennants: one instanced mesh, three segments each, turned downwind by
  // driUpdatePennants every frame
  if (driPENNANTS.length) {
    const P = driMerger();
    P.box(0, 0, 0.5, 0.06, 0.7, 1.0, PALETTE.driPaper, 0, 0, 0);
    const n = (driPENNANTS.length / 3) * driPEN_SEG;
    const pm = new THREE.InstancedMesh(P.build(), driVC(), n);
    pm.frustumCulled = false;
    pm.castShadow = true;
    root.add(pm);
    driPennantMesh = pm;
  }

  // THE MARKS ARE BEACONS. They used to be a static unlit mesh, on for ever at
  // one value; they are the same four points, drawn by driBuildBeacons with the
  // rest of them, so the front that runs down the archipelago when the lantern
  // catches passes through the gateway and both lips of the Long Gap on its way
  // to the Shelf. See driUpdateBeacons.
  for (let i = 0; i < driARCH_MARK.length; i += 3) {
    driAddBeacon(driARCH_MARK[i], driARCH_MARK[i + 1], driARCH_MARK[i + 2], true);
  }

  // the arch legs are solid; the ring is over four metres up and out of reach
  // THE COLLIDER HAS TO COVER THE PLINTH, NOT THE SHAFT. Each leg stands on a
  // 1.6 x 2.0 base and the body was sized from the 1.1 x 1.5 shaft above it —
  // so twenty-five centimetres of stone stuck out all the way round at exactly
  // the height the capybara is, on the island the hardest jump in the game
  // starts from. Two bodies per leg: the plinth and the shaft.
  const RG2 = driStaticGroup(game);         // the gateway, one body
  for (let side = -1; side <= 1; side += 2) {
    RG2.add(AXf(side * LEG, 0), AY + SPRING * 0.5 + 0.3, AZf(side * LEG, 0),
            1.1, SPRING, 1.5, yaw);
    RG2.add(AXf(side * LEG, 0), AY + 0.28, AZf(side * LEG, 0),
            1.6, 0.56, 2.0, yaw);
  }
  RG2.add(11, AY + 1.7, -110, 0.8, 3.4, 0.8, 0.55);
  RG2.done();
  // AND SO ARE THE TWO POSTS ON THE LIPS. Seventy centimetres across and three
  // and a half metres tall, standing on the two square metres of ground the
  // player spends the longest looking at in this chapter — deciding whether the
  // wind will let them go. That is exactly the size of thing (too tall to step
  // over at 40 cm, too small to read as architecture) that looks like a bug the
  // moment you walk through it. Sydney's bollards, again.
  // the far lip's post and the little one beside it: their own body, because
  // the far side of the Long Gap is forty-five metres from the near side and a
  // compound AABB spanning the gap would be tested against everything in it.
  const FG = driStaticGroup(game);
  FG.add(34, 73.7, -130, 0.8, 3.4, 0.8, 0.55);
  FG.add(38, 72.6, -130.5, 0.4, 2.4, 0.4, 0);
  FG.done();
}

// ================================================== WHO USED TO LIVE HERE ===
/**
 * THE DRIFT WAS THE THINNEST CHAPTER IN THE GAME AND IT WAS THE ONE ABOUT AN
 * ABANDONED PLACE, which are not the same thing.
 *
 * Measured against the two chapters this pass is held to: Pasto draws 98 000
 * triangles and Rio 120 000; the Drift drew 51 000 across twenty-seven islands,
 * and twenty-two of them had nothing on them at all except grass and a tree.
 * A floating rock with nothing on it is not lonely, it is unfinished — what
 * makes an empty place read as ABANDONED is the things somebody left.
 *
 * So: five islands get their furniture, and every piece of it is by the same
 * two people. The one on the Shelf lived in a house and it came off with the
 * rock. The one on the Orchard keeps the lampflies. Both of them are still
 * here, at the far end, and everything in this function is the argument for
 * that.
 *
 * All of it is one merged mesh and a handful of compound colliders.
 */
const driORCH_KEEP = { x: -30.4, y: 80, z: -110.2 };
const driCROWN_KEEP = { x: 28.6, y: 108, z: -186.8 };

function driBuildKeepers(game, root) {
  const M = driMerger();

  // ---- THE SHELF: the house, and it is a ruin ----------------------------
  // Three walls and a chimney, roofless, standing fifteen seconds' walk from
  // where the chapter begins. It is the first thing in the game that says
  // somebody used to be up here.
  {
    const SY = driISLES[0].y, hx = -15, hz = 36;
    const W = 3.0, D = 2.6;                     // half extents
    M.box(hx, SY + 1.5, hz - D, W * 2, 3.0, 0.34, PALETTE.driRockPale);
    M.box(hx - W, SY + 1.5, hz - D * 0.55, 0.34, 3.0, D * 0.9, PALETTE.driRockPale);
    M.box(hx - W, SY + 2.4, hz + D * 0.45, 0.34, 1.2, D * 1.1, PALETTE.driRockPale);
    M.box(hx + W, SY + 1.3, hz - D * 0.6, 0.34, 2.6, D * 0.8, PALETTE.driRockPale);
    M.box(hx + W, SY + 0.7, hz + D * 0.2, 0.34, 1.4, D * 0.6, PALETTE.driRock);
    M.box(hx + W - 0.4, SY + 0.28, hz + D * 0.9, 0.5, 0.56, 1.0, PALETTE.driRock, 0, 0.3, 0.2);
    // the south wall is gone. There are four stones where it was.
    for (let i = 0; i < 4; i++) {
      M.oct(hx - W + 0.6 + i * 1.7, SY + 0.24, hz + D + 0.2, 0.42 + (i % 2) * 0.16,
            i % 2 ? PALETTE.driRock : PALETTE.driRockDark, i, i * 1.3, 0.2);
    }
    // the chimney, which is the tallest thing on the island after the lamp
    M.box(hx - W - 0.5, SY + 2.2, hz - D + 0.9, 1.3, 4.4, 1.3, PALETTE.driStone);
    M.box(hx - W - 0.5, SY + 4.6, hz - D + 0.9, 1.6, 0.4, 1.6, PALETTE.driRockPale);
    driAddBeacon(hx - W - 0.5, SY + 5.15, hz - D + 0.9);
    M.box(hx - W + 0.5, SY + 0.16, hz - D + 0.9, 1.4, 0.32, 1.2, PALETTE.driRockDark);
    // ---- AND THE HEARTH IS STILL WARM ------------------------------------
    // A roofless croft, a chimney, a stone hearth — and nothing in it. This is
    // the first thing in the whole game that says somebody used to be up here,
    // and it says it in three shades of grey fifteen seconds from where the
    // chapter begins. Whoever lit the lamp on the post outside lit this too,
    // and it is the second warm thing on the island: a bank of embers with a
    // couple of half-burnt logs across it, and a pool of it on the flags.
    // Nothing in this biome casts light, so the pool is PAINTED — the lesson
    // this family of chapters has now had five times.
    // AND THE EMBERS ARE UNLIT. A warm Lambert in a biome whose only light is
    // a moon thirteen degrees up comes back near-BLACK on every facet that is
    // not pointing at it — which is how Iceland's steam became grey hexagons
    // and Venice's arcade lamps became dark blobs, twice in three chapters. An
    // ember is a light. It gets a MeshBasicMaterial, like the lamp's bulb four
    // lines further down this same file.
    {
      const E = driMerger();
      for (let k = 0; k < 5; k++) {
        E.box(hx - W + 0.15 + k * 0.34, SY + 0.30, hz - D + 0.7 + (k % 2) * 0.34,
              0.30, 0.14, 0.30, k % 2 ? PALETTE.driLamp : PALETTE.driLampGlow, 0, k * 0.5, 0);
      }
      const em = new THREE.Mesh(E.build(), new THREE.MeshBasicMaterial({ vertexColors: true }));
      em.castShadow = false;
      em.userData.noShadow = true;
      root.add(em);
    }
    for (let k = 0; k < 3; k++) {
      M.cyl(hx - W + 0.55, SY + 0.44 + k * 0.10, hz - D + 0.9 + (k - 1) * 0.28,
            0.09, 1.05, PALETTE.driBark, 0, 0.2 + k * 0.5, Math.PI * 0.5, 4);
    }
    driAddBeacon(hx - W + 0.5, SY + 0.44, hz - D + 0.9);
    {
      const hp = driLightPool(3.4, PALETTE.driLamp, 5);
      hp.position.set(hx - W + 0.5, SY + 0.14, hz - D + 0.9);
      hp.material.opacity = 0.26;
      root.add(hp);
      driHearthPool = hp;
    }
    // a floor of flags, so the inside is a room and not a patch of meadow
    for (let i = 0; i < 8; i++) {
      const fx = hx - W + 0.7 + (i % 4) * 1.5, fz = hz - D + 0.7 + ((i / 4) | 0) * 1.8;
      M.box(fx, SY + 0.05, fz, 1.3, 0.10, 1.5, i % 3 ? PALETTE.driStone : PALETTE.driRockPale,
            0, (i % 5) * 0.04, 0);
    }
    // ONE COMPOUND BODY FOR THE HOUSE. Three walls and a chimney is five
    // broadphase entries done naively; the contract asks for one.
    const b = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
    b.addShape(new CANNON.Box(new CANNON.Vec3(W, 1.5, 0.17)), new CANNON.Vec3(hx, SY + 1.5, hz - D));
    b.addShape(new CANNON.Box(new CANNON.Vec3(0.17, 1.5, D)), new CANNON.Vec3(hx - W, SY + 1.5, hz));
    b.addShape(new CANNON.Box(new CANNON.Vec3(0.17, 1.3, D * 0.7)), new CANNON.Vec3(hx + W, SY + 1.3, hz - D * 0.6));
    b.addShape(new CANNON.Box(new CANNON.Vec3(0.65, 2.2, 0.65)), new CANNON.Vec3(hx - W - 0.5, SY + 2.2, hz - D + 0.9));
    driSyncBody(b);
    game.world.addBody(b);
  }

  // ---- THE STAIRS: three cairns ------------------------------------------
  // The stepping islands were bare grass, and they are the first five minutes
  // of the chapter. A cairn on each is the cheapest thing that turns a rock
  // into somewhere somebody has been — and it doubles as a mark, because the
  // route through this archipelago is otherwise unsigned.
  const cairns = [driISLES[1], driISLES[2], driISLES[3]];
  for (let c = 0; c < cairns.length; c++) {
    const s2 = cairns[c];
    const cx = s2.x + (c % 2 ? 2.2 : -2.4), cz = s2.z + (c === 1 ? 1.8 : -1.6);
    let yy = s2.y;
    for (let k = 0; k < 5; k++) {
      const r = 0.62 - k * 0.09;
      M.oct(cx + Math.sin(k * 2.1) * 0.10, yy + r * 0.5, cz + Math.cos(k * 1.7) * 0.10,
            r, k % 2 ? PALETTE.driRock : PALETTE.driStone, k * 0.4, k * 1.1, k * 0.2);
      yy += r * 0.86;
    }
    driAddBeacon(cx, yy + 0.30, cz);
    driStaticBox(game, cx, s2.y + 0.9, cz, 1.1, 1.8, 1.1, 0);
  }

  // ---- AND THE FIRST FIVE MINUTES HAD NOTHING IN THEM ---------------------
  //
  // The Stairs are the chapter's opening: four leaps, nine metres then twelve
  // then fourteen then fifteen, and they are where a player learns that the
  // ground here is a series of decisions. Each of those islands is 12 x 10 m of
  // grass carrying THREE trees (driBuildFlora's green density is 0.058 and the
  // clamp floor is 3) and one cairn. Rendered, the first five minutes of the
  // Drift is a lawn with some poles on it, and it is the emptiest ground in the
  // chapter at exactly the moment the chapter is making its first impression.
  //
  // The fix is not more scenery, it is the same fix the Crown's flagged
  // approach got: mark the ROUTE. Everybody who has ever crossed these gaps
  // took off from the same square metre and landed on the same one, so both are
  // worn to bare rock, and somebody has driven a marker at each with a rag on
  // it. It reads as a used path from thirty metres, it is four hundred
  // triangles, and it does a second job that is worth more than the first:
  // THE PLAYER CAN NOW SEE WHERE TO JUMP FROM. Standing on the wrong corner of
  // stepB is the difference between clearing fourteen metres and not.
  {
    const legs = [[driISLES[0], driISLES[1]], [driISLES[1], driISLES[2]],
                  [driISLES[2], driISLES[3]], [driISLES[3], driISLES[4]]];
    for (let L = 0; L < legs.length; L++) {
      const a = legs[L][0], b = legs[L][1];
      const dx = b.x - a.x, dz = b.z - a.z;
      const d = Math.max(0.001, Math.hypot(dx, dz));
      const ux = dx / d, uz = dz / d;
      // the lip of each island on the line between them, pulled 1.4 m inboard
      // so the mark is on the deck rather than hanging over the torn edge
      const reach = function (s2, sign) {
        const r = Math.min(s2.hx, s2.hz) - 1.4;
        return [s2.x + ux * r * sign, s2.z + uz * r * sign, s2.y];
      };
      const ends = [reach(a, 1), reach(b, -1)];
      for (let e = 0; e < 2; e++) {
        const px = ends[e][0], pz = ends[e][1], py = ends[e][2];
        // the worn patch: three flat overlapping plates, so it has no rim
        for (let k = 0; k < 3; k++) {
          const ka = L * 1.9 + k * 2.1;
          M.cyl(px + Math.cos(ka) * 0.35, py + 0.012 + k * 0.004, pz + Math.sin(ka) * 0.35,
                1.05 - k * 0.22, 0.03,
                k === 1 ? PALETTE.driRockPale : PALETTE.driRock, 0, ka, 0, 8);
        }
        // the marker: a leaning post with a rag, and a hand-sized stack beside
        // it. Set OFF the line, so it frames the jump rather than standing in
        // the middle of the run-up.
        const ox = -uz * 1.5, oz = ux * 1.5;
        M.cyl(px + ox, py + 0.78, pz + oz, 0.065, 1.56, PALETTE.driTimber,
              ux * 0.10, 0, uz * 0.10, 6);
        M.box(px + ox + ux * 0.22, py + 1.34, pz + oz + uz * 0.22, 0.42, 0.30, 0.03,
              L % 2 ? PALETTE.driRibbonA : PALETTE.driRibbonC,
              0.12, Math.atan2(ux, uz), 0.2);
        for (let k = 0; k < 3; k++) {
          M.oct(px - ox * 0.8 + Math.sin(k * 2.3) * 0.14, py + 0.10 + k * 0.16,
                pz - oz * 0.8 + Math.cos(k * 1.9) * 0.14, 0.20 - k * 0.04,
                k % 2 ? PALETTE.driStone : PALETTE.driRockPale, k, k * 1.4, 0);
        }
        // and a warm point on the take-off side only, so the line the beacons
        // draw when the lantern catches runs UP the stairs rather than round
        // both sides of every gap
        if (e === 0) driAddBeacon(px + ox, py + 1.62, pz + oz);
      }
    }
  }

  // ---- THE ANVIL: it is called the Anvil ---------------------------------
  // A bare stone island with the first column beside it and, until now, six
  // pebbles on it. Somebody put a hoist here: a block, a frame over it and a
  // windlass, all leaning toward the column, because the way up from here is
  // the column.
  {
    const AG = driStaticGroup(game);          // one body for the hoist
    const s3 = driISLES[4], ax = s3.x + 1.5, az = s3.z - 1.0, ay = s3.y;
    M.box(ax, ay + 0.55, az, 2.6, 1.1, 1.8, PALETTE.driRockDark, 0, 0.3, 0);
    M.box(ax, ay + 1.24, az, 2.9, 0.28, 2.1, PALETTE.driStone, 0, 0.3, 0);
    AG.add(ax, ay + 0.7, az, 2.9, 1.4, 2.1, 0.3);
    for (let side = -1; side <= 1; side += 2) {
      M.box(ax + side * 2.4, ay + 1.7, az + side * 0.7, 0.30, 3.4, 0.30,
            PALETTE.driTimber, 0, 0.3, -side * 0.10);
      AG.add(ax + side * 2.4, ay + 1.7, az + side * 0.7, 0.44, 3.4, 0.44, 0);
    }
    M.box(ax, ay + 3.4, az, 5.6, 0.28, 0.34, PALETTE.driTimber, 0, 0.3, 0);
    AG.done();
    driAddBeacon(ax - 2.0, ay + 3.75, az - 0.6);
    M.cyl(ax + 0.9, ay + 3.2, az + 0.3, 0.34, 1.2, PALETTE.driTimber, 0, 0, Math.PI * 0.5, 6);
    // the rope, gone slack and hanging down into nothing
    for (let k = 0; k < 5; k++) {
      M.cyl(ax + 0.9 + Math.sin(k * 0.6) * 0.22, ay + 2.7 - k * 0.85, az + 0.3 + k * 0.12,
            0.05, 0.9, PALETTE.driSeed, 0.12, 0, Math.sin(k * 0.6) * 0.16, 4);
    }
  }

  // ---- THE ORCHARD: the lampfly house ------------------------------------
  // Open on all four sides, because the things it is for fly. Under it a drying
  // rack of empty paper cases, three baskets and a low table. This is the
  // island the chapter asks you to spend the longest on and the only thing on
  // it was nine trees.
  {
    const OG = driStaticGroup(game);          // one body for the whole yard
    const ox = driORCH_KEEP.x + 1.6, oy = driORCH_KEEP.y, oz = driORCH_KEEP.z + 2.4;
    for (let i = 0; i < 4; i++) {
      const px = ox + (i & 1 ? 2.3 : -2.3), pz = oz + (i & 2 ? 2.0 : -2.0);
      M.cyl(px, oy + 1.35, pz, 0.13, 2.7, PALETTE.driTimber, 0, 0, 0, 6);
      OG.add(px, oy + 1.35, pz, 0.34, 2.7, 0.34, 0);
    }
    M.box(ox - 1.2, oy + 2.95, oz, 3.0, 0.16, 4.6, PALETTE.driTimber, 0, 0, 0.24);
    M.box(ox + 1.2, oy + 2.95, oz, 3.0, 0.16, 4.6, PALETTE.driTimber, 0, 0, -0.24);
    M.box(ox, oy + 3.32, oz, 0.34, 0.28, 4.8, PALETTE.driBark);
    driAddBeacon(ox, oy + 3.72, oz);
    // the rack, and eleven paper cases hanging off it waiting for an occupant
    M.cyl(ox, oy + 2.2, oz, 0.07, 4.2, PALETTE.driBark, Math.PI * 0.5, 0, 0, 4);
    for (let k = 0; k < 11; k++) {
      const kz = oz - 1.9 + k * 0.38;
      M.cyl(ox + Math.sin(k * 1.3) * 0.18, oy + 1.86, kz, 0.015, 0.6, PALETTE.driSeed, 0, 0, 0, 4);
      M.cyl(ox + Math.sin(k * 1.3) * 0.18, oy + 1.44, kz, 0.16, 0.34,
            k % 3 ? PALETTE.driPaperDim : PALETTE.driPaper, 0, k * 0.4, 0, 6);
    }
    // a low table, three baskets and a stool
    M.box(ox - 1.6, oy + 0.52, oz + 1.5, 1.5, 0.10, 0.9, PALETTE.driTimber, 0, 0.3, 0);
    for (let i = 0; i < 4; i++) {
      M.box(ox - 1.6 + (i & 1 ? 0.6 : -0.6), oy + 0.26, oz + 1.5 + (i & 2 ? 0.32 : -0.32),
            0.09, 0.52, 0.09, PALETTE.driTimber);
    }
    OG.add(ox - 1.6, oy + 0.30, oz + 1.5, 1.5, 0.60, 0.9, 0.3);
    for (let i = 0; i < 3; i++) {
      const bx = ox + 1.7 + (i % 2) * 0.9, bz = oz - 1.4 + i * 1.1;
      M.cyl(bx, oy + 0.26, bz, 0.44 - i * 0.05, 0.52, PALETTE.driSeed, 0, i * 0.7, 0, 8);
      M.cyl(bx, oy + 0.52, bz, 0.46 - i * 0.05, 0.06, PALETTE.driBark, 0, i * 0.7, 0, 8);
      // A basket is 90 cm across and 52 tall: too tall to step over (the animal
      // manages 40) and too small to read as architecture, which is precisely
      // the size of thing that looks like a bug when you walk through it.
      OG.add(bx, oy + 0.26, bz, 0.92 - i * 0.1, 0.52, 0.92 - i * 0.1, 0);
    }
    M.cyl(ox + 0.2, oy + 0.22, oz + 1.9, 0.26, 0.44, PALETTE.driTimber, 0, 0, 0, 6);
    OG.add(ox + 0.2, oy + 0.22, oz + 1.9, 0.56, 0.44, 0.56, 0);
    OG.done();
  }

  // ---- THE CROWN: the approach to the lantern ----------------------------
  // The way out of the chapter stood on sixteen metres of empty pale grass. A
  // low rail, a stack of the lanterns nobody has lit yet, three bowls and a
  // bench facing the drop — so the last thing in the biome is somewhere to
  // arrive at rather than an object on a lawn.
  {
    const kx = driCROWN_KEEP.x, ky = driCROWN_KEEP.y, kz = driCROWN_KEEP.z;
    for (let i = 0; i < 8; i++) {
      const a = -2.5 + i * 0.30;
      const rx = driLANTERN.x + Math.cos(a) * 8.6, rz = driLANTERN.z + Math.sin(a) * 8.6;
      M.cyl(rx, ky + 0.55, rz, 0.09, 1.1, PALETTE.driTimber, 0, 0, 0, 4);
      if (i) {
        const a0 = -2.5 + (i - 1) * 0.30;
        const px = driLANTERN.x + Math.cos(a0) * 8.6, pz = driLANTERN.z + Math.sin(a0) * 8.6;
        M.box((rx + px) * 0.5, ky + 1.0, (rz + pz) * 0.5,
              0.08, 0.08, Math.hypot(rx - px, rz - pz) + 0.05, PALETTE.driTimber,
              0, Math.atan2(rx - px, rz - pz), 0);
      }
    }
    // the bench, facing out over the edge, with a collider on it
    M.box(kx - 0.6, ky + 0.48, kz + 1.2, 2.4, 0.14, 0.62, PALETTE.driTimber, 0, 0.4, 0);
    M.box(kx - 0.6, ky + 0.86, kz + 1.5, 2.4, 0.60, 0.12, PALETTE.driTimber, 0, 0.4, 0);
    M.box(kx - 1.5, ky + 0.24, kz + 1.2, 0.14, 0.48, 0.55, PALETTE.driTimber, 0, 0.4, 0);
    M.box(kx + 0.3, ky + 0.24, kz + 1.2, 0.14, 0.48, 0.55, PALETTE.driTimber, 0, 0.4, 0);
    const KG = driStaticGroup(game);          // one body for the Crown's furniture
    KG.add(kx - 0.6, ky + 0.45, kz + 1.3, 2.5, 0.90, 0.9, 0.4);
    // the ones nobody has lit: a stack of six, folded flat
    for (let k = 0; k < 6; k++) {
      M.cyl(kx + 2.3, ky + 0.10 + k * 0.13, kz - 0.9, 0.62 - k * 0.03, 0.12,
            k % 2 ? PALETTE.driPaperDim : PALETTE.driPaper, 0.04, k * 0.5, 0.03, 8);
    }
    KG.add(kx + 2.3, ky + 0.42, kz - 0.9, 1.3, 0.84, 1.3, 0);
    driAddBeacon(driLANTERN.x + Math.cos(-2.5) * 8.6, ky + 1.35, driLANTERN.z + Math.sin(-2.5) * 8.6);
    driAddBeacon(driLANTERN.x + Math.cos(-0.4) * 8.6, ky + 1.35, driLANTERN.z + Math.sin(-0.4) * 8.6);
    // three bowls, on the line between the bench and the plinth
    for (let k = 0; k < 3; k++) {
      const bx = kx + 1.4 + k * 1.9, bz = kz + 2.6 - k * 0.5;
      M.cyl(bx, ky + 0.12, bz, 0.34, 0.24, PALETTE.driRockPale, 0, 0, 0, 8);
      driBOWLS.push(bx, ky + 0.24, bz);
    }
    // ---- AND A WAY UP TO IT --------------------------------------------
    // The way out of the chapter stands on the biggest island in the world and
    // you arrive at it across sixteen metres of unmarked grass, from whichever
    // direction you happened to come. Every other significant place in this
    // archipelago is signed — the cairns on the Stairs, the standing stones at
    // the foot of each column, the gateway on the arch island — and the one at
    // the END of it was not. A flagged path from the plinth to the south-east
    // lip, where the column sets you down, and two standing stones at the head
    // of it: the last twenty metres of the chapter is now an approach.
    {
      const px0 = driLANTERN.x + 3.4, pz0 = driLANTERN.z + 5.2;
      const px1 = driLANTERN.x + 12.5, pz1 = driLANTERN.z + 12.5;
      for (let k = 0; k < 13; k++) {
        const u = k / 12;
        const fx = lerp(px0, px1, u) + Math.sin(u * 4.1) * 0.5;
        const fz = lerp(pz0, pz1, u) + Math.cos(u * 3.3) * 0.5;
        M.cyl(fx, ky + 0.04, fz, 0.72 - u * 0.16, 0.12,
              k % 3 ? PALETTE.driStone : PALETTE.driRockPale, 0.02, k * 0.6, 0.02, 8);
        // and a smaller one beside every other flag, because a laid path is
        // never one stone wide
        if (k % 2 === 0) {
          M.cyl(fx + Math.sin(k) * 0.85, ky + 0.03, fz + Math.cos(k) * 0.85, 0.38, 0.10,
                PALETTE.driRock, 0, k * 0.9, 0, 8);
        }
      }
      for (let s2 = -1; s2 <= 1; s2 += 2) {
        const sx = px1 + s2 * 2.4, sz = pz1 - s2 * 2.4;
        M.box(sx, ky + 1.35, sz, 0.78, 2.7, 0.62, PALETTE.driRockPale, 0.05, s2 * 0.4, s2 * 0.06);
        M.oct(sx, ky + 2.95, sz, 0.42, PALETTE.driStone, 0.2, s2 * 0.5, 0);
        KG.add(sx, ky + 1.35, sz, 0.9, 2.7, 0.9, s2 * 0.4);
        driAddBeacon(sx, ky + 3.2, sz);
      }
    }
    KG.done();
  }

  const mesh = new THREE.Mesh(M.build(), driVC());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);

  // The bowls' own light. UNLIT material, because a bowl with a flame in it is
  // a light and not a surface receiving one — the lesson this family of
  // chapters has now learned five times — and they come up WITH the lantern
  // rather than being on from the start, so the Crown gets darker as you climb
  // to it and then all of it lights at once.
  if (driBOWLS.length) {
    const B = driMerger();
    for (let i = 0; i < driBOWLS.length; i += 3) {
      B.cyl(driBOWLS[i], driBOWLS[i + 1], driBOWLS[i + 2], 0.27, 0.05,
            PALETTE.driLamp, 0, 0, 0, 8);
    }
    driBowlMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.12 });
    const bm = new THREE.Mesh(B.build(), driBowlMat);
    bm.frustumCulled = false;
    root.add(bm);
  }
}

// ================================================================ THE ROOST ==
/**
 * SOMETHING SMALL THAT LIVES ON THE GATEWAY.
 *
 * The wheek is this chapter's one social verb and, after the pass that gave the
 * skein an ear, it had three things in the whole biome that answer it: a
 * lampfly within 9.5 m, a skein of birds within 150 m WHILE ONE IS CROSSING
 * (which is about a third of the time), and the two people at the far end. On
 * the arch island — where the player stands longest in the whole chapter,
 * because the Long Gap is solved by WAITING for the breath to come round —
 * there is nothing at all to shout at.
 *
 * So: eleven small dark birds asleep on the ring of the gateway and along both
 * lip posts. Wheek and they all go up at once, wheel twice, and come back down
 * on the stone one at a time over about six seconds. They are not a mechanic
 * and they are not a task; they are the thing that happens while you are
 * waiting, and they make the wait a place rather than a pause.
 */
const driROOST_N = 11;
let driRoostMesh = null;
const driRoostData = new Float32Array(driROOST_N * 7);   // hx,hy,hz, x,y,z, phase
let driRoostUp = 0;                  // 1 the moment they flush, decays to 0
let driRoostSettle = 0;              // s since the flush
const driROOST_HEAR = 22;

function driBuildRoost(root) {
  const M = driMerger();
  // a bird asleep is a fold of shoulders and a beak; two wings that only
  // exist when it is in the air is not worth a second mesh at this size
  M.oct(0, 0, 0, 0.34, PALETTE.driRockDark, 0, 0.4, 0);
  M.box(0, 0.06, 0.20, 0.10, 0.09, 0.22, PALETTE.driBark);
  for (let s = -1; s <= 1; s += 2) {
    M.box(s * 0.15, 0.02, -0.04, 0.42, 0.05, 0.20, PALETTE.driRockDark, 0, 0, s * 0.12);
  }
  driRoostMesh = new THREE.InstancedMesh(M.build(), driVC(), driROOST_N);
  driRoostMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  driRoostMesh.frustumCulled = false;
  driRoostMesh.castShadow = false;
  driRoostMesh.name = 'driRoost';
  root.add(driRoostMesh);
  // where they sit: along the arch's ring, and a couple on each lip post
  const AY = driARCH.y, SPRING = 3.6, R = 2.6;
  const dxg = 42 - driARCH.x, dzg = -137 - driARCH.z;
  const gl = Math.hypot(dxg, dzg), yaw = Math.atan2(dxg / gl, dzg / gl);
  const cy2 = Math.cos(yaw), sy2 = Math.sin(yaw);
  for (let i = 0; i < driROOST_N; i++) {
    const o = i * 7;
    let hx, hy, hz;
    if (i < 7) {
      const a = 0.30 + (i / 6) * (Math.PI - 0.60);
      const u = Math.cos(a) * (R + 0.55);
      hx = driARCH.x + u * cy2; hz = driARCH.z - u * sy2;
      hy = AY + SPRING + Math.sin(a) * (R + 0.55) + 0.62;
    } else if (i < 9) {
      hx = 11 + (i - 7) * 0.5; hy = AY + 4.15; hz = -110 + (i - 7) * 0.4;
    } else {
      hx = 34 + (i - 9) * 0.5; hy = 76.15; hz = -130 + (i - 9) * 0.4;
    }
    driRoostData[o] = hx; driRoostData[o + 1] = hy; driRoostData[o + 2] = hz;
    driRoostData[o + 3] = hx; driRoostData[o + 4] = hy; driRoostData[o + 5] = hz;
    driRoostData[o + 6] = (i * 2.39996) % 6.283;
  }
}

function driUpdateRoost(game, dt) {
  if (!driRoostMesh) return;
  const p = game.capy && game.capy.position;
  const inp = game.input;
  if (inp && inp.honkPressed && p) {
    const dx = p.x - driARCH.x, dz = p.z - driARCH.z;
    if (dx * dx + dz * dz < driROOST_HEAR * driROOST_HEAR) {
      driRoostUp = 1;
      driRoostSettle = 0;
      driSfx('rustle', { volume: 0.42, pitch: 1.55 });
      driSfx('tick', { volume: 0.18, pitch: 2.2 });
    }
  }
  if (driRoostUp > 0) {
    driRoostSettle += dt;
    // THEY COME BACK ONE AT A TIME. A flock that lands in unison is a switch;
    // a flock that trickles back over six seconds is eleven animals, and the
    // order is a function of the index so no two flushes settle the same way.
    driRoostUp = clamp(1 - (driRoostSettle - 1.4) / 4.6, 0, 1);
  }
  for (let i = 0; i < driROOST_N; i++) {
    const o = i * 7;
    const ph = driRoostData[o + 6];
    // each bird's own share of the flush, staggered by its phase
    const own = clamp(driRoostUp * 1.35 - (ph / 6.283) * 0.45, 0, 1);
    const a = driTime * (1.5 + (i % 3) * 0.25) + ph;
    const r = own * (2.6 + (i % 4) * 1.1);
    const tx = driRoostData[o] + Math.cos(a) * r;
    const ty = driRoostData[o + 1] + own * (2.2 + (i % 5) * 0.9) +
               Math.sin(a * 1.7) * own * 0.7;
    const tz = driRoostData[o + 2] + Math.sin(a) * r;
    driRoostData[o + 3] = damp(driRoostData[o + 3], tx, own > 0.02 ? 6 : 2.4, dt);
    driRoostData[o + 4] = damp(driRoostData[o + 4], ty, own > 0.02 ? 6 : 2.4, dt);
    driRoostData[o + 5] = damp(driRoostData[o + 5], tz, own > 0.02 ? 6 : 2.4, dt);
    // heading comes from where it actually went, and it beats only in the air
    const beat = own > 0.02 ? Math.sin(driTime * 13 + ph) * 0.55 : 0;
    const yaw = own > 0.02 ? a + Math.PI * 0.5
              : Math.atan2(driARCH.x - driRoostData[o], driARCH.z - driRoostData[o + 2]);
    driRoostMesh.setMatrixAt(i, driXform(driRoostData[o + 3], driRoostData[o + 4],
      driRoostData[o + 5], -own * 0.2, yaw, beat, 1, 1, 1));
  }
  driRoostMesh.instanceMatrix.needsUpdate = true;
}

// ============================================================== THE BEACONS ==
/**
 * WHAT LIGHTING THE LANTERN DOES TO THE REST OF THE WORLD.
 *
 * `lantern` is the chapter's `wow` and it was, honestly, a good one already:
 * embers, a halo, a pool on the grass, three bowls, the ribbons coming up and a
 * skein called across the Crown. But every one of those happens WHERE YOU ARE
 * STANDING, and the chapter you have just spent ten minutes on is two hundred
 * and twenty metres of archipelago behind you, in the dark, and it never hears
 * about it.
 *
 * So the light travels. Somebody left a mark on every island they used — the
 * cairns on the Stairs, the hoist on the Anvil, the ridge of the lampfly house,
 * the chimney of the drowned croft, the posts on both lips of the Long Gap —
 * and every one of them catches in turn as a front runs back down the route at
 * fifty-five metres a second, so the last four seconds of the chapter is the
 * whole of it lighting up in the order you walked it. One instanced mesh, one
 * unlit material, one float.
 */
const driBEACON = [];              // x, y, z triples, in build order
let driBeaconMesh = null;
let driBeaconWave = -1;            // m the front has travelled, or -1
const driBeaconDist = [];          // each mark's distance from the lantern
const driBeaconLit = [];           // 0..1 per mark, its own flare envelope
const driBEACON_SPEED = 55;
const driBeaconCol = new THREE.Color();
const driBeaconWarm = new THREE.Color(PALETTE.driLampGlow);
const driBeaconCold = new THREE.Color(PALETTE.driRockPale);

const driBeaconOn = [];            // true for the marks that burn from the start
/**
 * The fourth argument marks a beacon that is ALREADY LIT when the chapter
 * begins. It matters for exactly four of them: the gateway's keystone and the
 * three marks on the lips of the Long Gap. Those exist because the far lip is
 * twelve metres DOWN and is therefore below the horizon of its own island from
 * the near side — "a jump you cannot see the end of is a leap of faith, and
 * this chapter has never once asked for one of those". Folding them into the
 * wave would put that light out until the last twenty seconds of the chapter,
 * which is well after the jump they exist for.
 */
function driAddBeacon(x, y, z, warm) { driBEACON.push(x, y, z); driBeaconOn.push(!!warm); }

function driBuildBeacons(root) {
  if (!driBEACON.length) return;
  const B = driMerger();
  B.oct(0, 0, 0, 1, 0xffffff, 0, 0.6, 0);
  const n = driBEACON.length / 3;
  const im = new THREE.InstancedMesh(B.build(), new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false }), n);
  im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.frustumCulled = false;
  im.castShadow = false;
  im.userData.noShadow = true;
  im.renderOrder = 2;
  root.add(im);
  driBeaconMesh = im;
  for (let i = 0; i < n; i++) {
    const dx = driBEACON[i * 3] - driLANTERN.x, dz = driBEACON[i * 3 + 2] - driLANTERN.z;
    driBeaconDist.push(Math.hypot(dx, dz));
    driBeaconLit.push(0);
  }
}

/** Set one mark alight on its own, out of sequence — the Long Gap uses this. */
function driFlareBeaconsNear(x, z, r) {
  for (let i = 0; i < driBeaconLit.length; i++) {
    const dx = driBEACON[i * 3] - x, dz = driBEACON[i * 3 + 2] - z;
    if (dx * dx + dz * dz < r * r) driBeaconLit[i] = Math.max(driBeaconLit[i], 1.6);
  }
}

function driUpdateBeacons(dt) {
  if (!driBeaconMesh) return;
  if (driBeaconWave >= 0) driBeaconWave += driBEACON_SPEED * dt;
  const n = driBeaconLit.length;
  for (let i = 0; i < n; i++) {
    // the steady state: cold until the front has passed, then warm for good
    const passed = driBeaconOn[i] || (driBeaconWave >= 0 && driBeaconWave > driBeaconDist[i]);
    // ...and one that was already burning does not CATCH: only the ones the
    // front reaches do, which is what makes the wave read as a wave.
    if (passed && !driBeaconOn[i] && driBeaconLit[i] < 0.001) driBeaconLit[i] = 1.7;
    if (driBeaconLit[i] > 0) driBeaconLit[i] = Math.max(0, driBeaconLit[i] - dt * 1.6);
    const base = passed ? 0.72 + Math.sin(driTime * 2.3 + i * 1.9) * 0.09 : 0.13;
    const lvl = base + driBeaconLit[i] * 0.9;
    driBeaconCol.copy(passed || driBeaconLit[i] > 0 ? driBeaconWarm : driBeaconCold)
                .multiplyScalar(lvl);
    driBeaconMesh.instanceColor.setXYZ(i, driBeaconCol.r, driBeaconCol.g, driBeaconCol.b);
    const s = 0.34 + (passed ? 0.10 : 0) + driBeaconLit[i] * 0.55;
    driBeaconMesh.setMatrixAt(i, driXform(driBEACON[i * 3], driBEACON[i * 3 + 1],
      driBEACON[i * 3 + 2], 0, driTime * 0.4 + i, 0, s, s, s));
  }
  driBeaconMesh.instanceMatrix.needsUpdate = true;
  driBeaconMesh.instanceColor.needsUpdate = true;
}

// ================================================================== HELPERS ==
function driTask(id) { if (driGame && typeof driGame.completeTask === 'function') driGame.completeTask(id); }
function driToast(t) { if (driGame && typeof driGame.toast === 'function') driGame.toast(t); }
function driSfx(n, o) { if (driGame && typeof driGame.sfx === 'function') driGame.sfx(n, o); }
function driRecord(id, v) { if (driGame && typeof driGame.record === 'function') driGame.record(id, v); }

// ==================================================================== WIND ===
/**
 * ONE NUMBER, SWINGING. The magnitude is a sine on the breath, so it goes all
 * the way over and all the way back and passes through dead calm twice a cycle;
 * the AXIS turns slowly underneath that, so two breaths are never quite the
 * same and it never becomes a metronome you can ignore. The gust is texture on
 * top and is small enough that it can never be the difference between making a
 * jump and not — the breath must be the only thing that decides that, or the
 * player cannot plan and the whole mechanic is noise.
 */
function driUpdateWind(dt) {
  driShelter = 1;
  driWindAng += driWIND_TURN * dt;
  const swing = Math.sin(driTime * 6.28318 / driBREATH);
  const gust = Math.sin(driTime * 0.83) * Math.sin(driTime * 0.37 + 1.1) * driGUST;
  const mag = swing * driWIND_MAX + gust * (0.4 + Math.abs(swing) * 0.6);
  driWindX = Math.cos(driWindAng) * mag;
  driWindZ = Math.sin(driWindAng) * mag;
}

// ================================================================= THE PUFF ==
/**
 * THE WHEEK, IN MID-AIR.
 *
 * This runs in the biome's own update, which the contract schedules BEFORE
 * capybara.js — so the velocity written here is the velocity capybara.js reads
 * and solves against, and nothing in that module touches vertical velocity for
 * an airborne animal. No change to the controller was needed and none was made.
 *
 * The charge comes back the instant anything solid is underfoot, which includes
 * the cloud: there is no arithmetic to do in the air, only the question "have I
 * spent it yet", and the animal answers that by squeaking or not squeaking.
 */
// ================================================================= THE VANE ==
// THE CHAPTER'S ONE INSTRUMENT, AND NOTHING HAS EVER ASKED YOU TO READ IT.
//
// The Drift's hardest task is 'long-gap', and the reason it is hard is that it
// is impossible into the wind, marginal in dead calm and easy with the breath
// behind you — so it is solved by WAITING, which is a thing this game has asked
// for exactly once before. The weathervane on the spawn island is the only way
// to know which of those three you are in, and a player who never notices it
// experiences the whole chapter as a jump that sometimes works.
//
// So: stand at the vane and watch it come all the way round. It costs at most
// one half-breath — nineteen seconds — and what it buys is the mechanic.
const driVANE = { x: 11, y: 30, z: 31 };
let driVaneSign = 0, driVaneDone = false, driVaneT = 0;
// THE WATCH. See driCheckVane: the task can ask for nineteen seconds of
// standing still and none of it used to be visible from anywhere.
let driVaneWatch = 0, driVaneSlack = 0, driVaneHint = false;

function driCheckVane(game, dt) {
  if (driVaneDone) return;
  const capy = game.capy;
  if (!capy || !capy.position) return;
  const p = capy.position;
  const near = Math.abs(p.x - driVANE.x) < 3.6 && Math.abs(p.z - driVANE.z) < 3.6 &&
               p.y > driVANE.y - 2 && p.y < driVANE.y + 4;
  // THE SIGN OF THE BREATH, not of the vane's heading: the axis turns slowly
  // underneath the swing, so the arrow is never still and "it moved" would tick
  // on the first frame. What the player is being shown is the wind dropping to
  // nothing and coming back the other way, and that is a sign change on `swing`.
  const swing = Math.sin(driTime * 6.28318 / driBREATH);
  const sign = swing >= 0 ? 1 : -1;
  if (!near) { driVaneSign = 0; driVaneT = 0; driVaneWatch = 0; return; }
  driVaneT += dt;
  // ---- AND IT WAS NINETEEN SECONDS OF NOTHING ---------------------------
  // MEASURED: `sign` flips on a half breath, so standing at the post can ask
  // for anything up to nineteen seconds — and the whole of that was a task
  // that had not ticked yet. No count, no sound, no change in the world;
  // `driVaneT` was accumulated and then never read by anything. A player who
  // walked up, stood for eight seconds and wandered off had no way of knowing
  // they had been doing it right, and the reset on leaving the circle meant
  // they then had to do the whole thing again.
  //
  // Three things, and none of them says a number out loud: a line once you have
  // clearly settled, a ripple of paper off the post as the wind goes slack
  // (which is the moment, and it is the same puff ring the seed-head uses), and
  // `vaneToTurn()` on the API so the task card can count it down — the same
  // treatment 'souk-escape' has had since Marrakech was written.
  driVaneWatch = driVaneT;
  if (driVaneT > 2.6 && !driVaneHint) {
    driVaneHint = true;
    driToast('stay there. it comes all the way round every thirty-eight seconds.');
  }
  const slack = Math.abs(swing) < 0.13;
  if (slack && driVaneSlack <= 0) {
    driVaneSlack = 2.0;
    driRingT = 0;
    driRingX = driVANE.x; driRingY = driVANE.y + 2.2; driRingZ = driVANE.z;
    driSfx('rustle', { volume: 0.30, pitch: 1.25 });
  } else if (!slack && driVaneSlack > 0) {
    driVaneSlack -= dt;
  }
  if (driVaneSign === 0) { driVaneSign = sign; return; }
  if (sign !== driVaneSign) {
    driVaneDone = true;
    driTask('weathervane');
    driSfx('chime', { volume: 0.55, pitch: 1.15 });
    driToast('all the way over, and all the way back, every thirty-eight seconds.');
  }
}
/** Seconds until the breath next goes slack, for the task card. */
function driSecondsToTurn() {
  const ph = (driTime % (driBREATH * 0.5)) / (driBREATH * 0.5);
  return (1 - ph) * driBREATH * 0.5;
}

// ============================================================== THE CROSSING ==
// NOT A TASK, AND IT NEVER COMES CLOSE ENOUGH TO BE ONE.
//
// The Drift has plenty going on — lampflies, motes, seed-heads, two wandering
// islands — and every one of those is something the player can catch, follow or
// stand on. What the place had nothing of was SCALE: no way to tell whether the
// gap to the next island is fifteen metres or fifty, and nothing at all in the
// middle distance to measure the void against.
//
// So, every couple of minutes, a skein of long birds crosses it. They pass a
// long way off and a long way down, they are never within reach, and the only
// thing they do is give the emptiness a size.
const driSKEIN_N = 17;
const driSKEIN_GAP = 96;              // s between crossings
const driSKEIN_RUN = 62;              // s to get from one side of the sky to the other
const driSKEIN_SPAN = 620;            // m of crossing, which is well outside the map
let driSkeinMesh = null, driSkeinT = -18;
// SET AT BUILD, NOT ONLY WHEN A CROSSING ENDS. The lane, the height and the
// heading are all chosen at the END of each crossing so the next one differs —
// which left the FIRST one at whatever the initialisers said, and the
// initialisers said zero. Measured: skein one flew at y 0.6, through the cloud
// sea, along z = 0. The islands are at 30 to 108.
let driSkeinA = 0.7, driSkeinY = 44, driSkeinZ = -70;
// AND THE SKEIN CAN HEAR YOU. Every other chapter answers the wheek with
// somebody looking round; this one had exactly one response to it in the whole
// biome (a lampfly, within nine and a half metres, and only while grounded), so
// out on the Stairs and over the Long Gap the chapter's own verb did nothing
// at all. Seventeen birds breaking formation two hundred metres up and taking
// four seconds to get back into a V is the biggest thing in this sky that the
// player can cause, and it costs one float.
let driSkeinScat = 0;             // 0..1, decays
let driSkeinCalled = false;       // the lantern has asked for a crossing
const driSKEIN_HEAR = 150;        // m. It is a very quiet place.

function driBuildSkein(root) {
  // ONE BOX AND TWO WINGS, and no more, because at two hundred metres a bird is
  // a mark. What sells it is the V and the fact that they are not in step.
  const M = driMerger();
  M.box(0, 0, 0, 0.22, 0.16, 1.30, PALETTE.driTimber);
  for (let s = -1; s <= 1; s += 2) {
    M.box(s * 1.05, 0.06, -0.10, 1.90, 0.07, 0.44, PALETTE.driTimber,
          0, 0, s * 0.16);
  }
  driSkeinMesh = new THREE.InstancedMesh(M.build(), driVC(), driSKEIN_N);
  driSkeinMesh.name = 'driSkein';
  driSkeinMesh.frustumCulled = false;
  driSkeinMesh.castShadow = false;
  driSkeinMesh.visible = false;
  root.add(driSkeinMesh);
  driSkeinT = -18;
}

function driUpdateSkein(game, dt) {
  if (!driSkeinMesh) return;
  driSkeinT += dt;
  driSkeinScat = Math.max(0, driSkeinScat - dt * 0.28);

  // the wheek, if there is anything up there to hear it
  const inp = game && game.input;
  if (inp && inp.honkPressed && driSkeinT >= 0 && driSkeinT < driSKEIN_RUN) {
    const p = game.capy && game.capy.position;
    if (p) {
      const u0 = driSkeinT / driSKEIN_RUN;
      const hx0 = -driSKEIN_SPAN * 0.5 + driSKEIN_SPAN * u0;
      const cx0 = hx0 * Math.cos(driSkeinA);
      const cz0 = driSkeinZ + hx0 * Math.sin(driSkeinA);
      const dd = (p.x - cx0) * (p.x - cx0) + (p.z - cz0) * (p.z - cz0) +
                 (p.y - driSkeinY) * (p.y - driSkeinY);
      if (dd < driSKEIN_HEAR * driSKEIN_HEAR) {
        driSkeinScat = 1;
        driSfx('chime', { volume: 0.16, pitch: 1.9 });
      }
    }
  }

  if (driSkeinT < 0) { driSkeinMesh.visible = false; return; }
  if (driSkeinT > driSKEIN_RUN) {
    driSkeinMesh.visible = false;
    driSkeinT = -driSKEIN_GAP;
    // a different heading, height and lane every time, so it is never the same
    // aeroplane on the same circuit
    driSkeinA = (driSkeinA + 2.399) % 6.28318;
    // 30 is the lowest island and 108 is the highest, so the band is chosen to
    // sit among them rather than over or under the whole archipelago
    driSkeinY = 30 + ((driSkeinA * 37) % 1) * 56;
    driSkeinZ = -170 + ((driSkeinA * 91) % 1) * 210;
    return;
  }

  driSkeinMesh.visible = true;
  const u = driSkeinT / driSKEIN_RUN;
  const ca = Math.cos(driSkeinA), sa = Math.sin(driSkeinA);
  // the head of the skein, running along its own heading
  const hx = -driSKEIN_SPAN * 0.5 + driSKEIN_SPAN * u;
  for (let i = 0; i < driSKEIN_N; i++) {
    // A V, and a LOPSIDED one: a real skein has more birds on one arm than the
    // other and the arms are never the same length. The trail offset is what
    // makes it a formation rather than a comb.
    const k = (i + 1) >> 1;
    const side = (i % 2) ? 1 : -1;
    const trail = k * (i % 3 === 0 ? 7.4 : 6.1);
    const wide = k * (side > 0 ? 4.6 : 5.4) * side;
    const lag = Math.sin(driSkeinT * 1.6 + i * 0.9) * 1.1;
    const lx = hx - trail;
    // SCATTER, and it has to be per bird and it has to come back. A shout
    // pushes each of them out along its own bearing and they beat twice as
    // hard for a second; the V re-forms in about three and a half, because
    // driSkeinScat decays rather than being switched. What sells it is that
    // the offsets are trigonometric functions of i, so no two birds go the
    // same way and the formation comes back together in a different order.
    const sc = driSkeinScat * driSkeinScat;
    const ox2 = Math.sin(i * 2.7) * 11 * sc;
    const oy2 = Math.sin(i * 1.9 + 1.1) * 7 * sc;
    const oz2 = Math.cos(i * 3.1) * 11 * sc;
    const x = lx * ca - wide * sa + ox2;
    const z = driSkeinZ + lx * sa + wide * ca + oz2;
    const y = driSkeinY + Math.sin(driSkeinT * 0.22 + i * 0.3) * 3.0 + lag * 0.4 + oy2;
    // the beat: slow, and OUT OF PHASE down the line, which is the thing that
    // makes a skein read as seventeen animals instead of one object
    const beat = Math.sin(driSkeinT * (2.3 + sc * 4.5) - i * 0.55);
    driSkeinMesh.setMatrixAt(i, driXform(x, y, z, beat * 0.05, driSkeinA + Math.PI * 0.5,
                                         beat * 0.34, 1, 1, 1));
  }
  driSkeinMesh.instanceMatrix.needsUpdate = true;
}

// ============================================================= HANDED BACK ==
// THE ONE THING THIS CHAPTER PROMISES AND NEVER SAYS OUT LOUD.
//
// The Drift is a place with far more air than island, and the entire design
// leans on falling off not being a punishment: you drop for several seconds
// through the dark, you land in cloud, and the cloud gathers underneath you and
// hands you back up. A chapter about leaping between rocks with nothing under
// them cannot ALSO be a chapter about being punished for missing — you would
// stop leaping, and leaping is the chapter.
//
// 'cloud-dive' pays for the falling. Nothing paid for the part that matters,
// which is the ten seconds afterwards when the floor you do not have picks you
// up. So: go all the way in, wait, and let it.
//
// THE FIRST DRAFT OF THIS TASK WAS 'get underneath an island', and it cannot be
// done. Every island footprint answers driTerrain with the island's TOP, and
// capybara.js's analytic ground backstop levitates anything below it straight
// up: measured, a capybara teleported to twelve metres under the Shelf, under
// the Anvil and under the Arch arrived on all three of their upper surfaces
// inside a frame. The keels are drawn and they are not a place.
const driHAND_RISE = 11;             // m of lift that count as having been handed back
let driHandDone = false, driHandLow = 1e9;

function driCheckHand(game) {
  if (driHandDone) return;
  const capy = game.capy;
  const body = capy && capy.body;
  if (!body) return;
  const y = body.position.y;
  // the low-water mark is only armed once the animal is genuinely IN the cloud,
  // so an ordinary hop off a high island cannot bank a low number to rise from
  if (driInCloud > 0.2) { if (y < driHandLow) driHandLow = y; return; }
  if (driHandLow > 1e8) return;
  if (!driBloomOn) { if (y > driHandLow + driHAND_RISE + 6) driHandLow = 1e9; return; }
  if (y > driHandLow + driHAND_RISE) {
    driHandDone = true;
    driTask('handed-back');
    driSfx('chime', { volume: 0.5, pitch: 0.85 });
    driToast('nothing up here can hurt you. that is the whole arrangement.');
  }
}

/**
 * THE ONE VERB THIS CHAPTER OWNS HAD NOTHING ON SCREEN.
 *
 * Nine chapters of the wheek startling people, calling birds and buying ferry
 * tickets, and here it is a wing — and the whole of it was two sounds and a
 * change of velocity. Every other verb in this game leaves a mark: the grab has
 * a prop in the mouth, the climb has a grip, the swim has a wake. A puff should
 * leave a ring of cloud hanging in the air behind the animal, because that is
 * what it is: a capybara shoving a hole in the sky and standing on the edge of
 * it. Fourteen puffs on one instanced mesh, 0.55 s each, one draw call, and it
 * is also the only feedback the player gets that the puff has been SPENT.
 */
const driRING_N = 14;
let driRingMesh = null, driRingMat = null;
let driRingT = -1, driRingX = 0, driRingY = 0, driRingZ = 0, driRingYaw = 0;
const driRingData = new Float32Array(driRING_N * 3);   // bearing, radius, size

function driBuildPuffRing(root) {
  const R = driMerger();
  R.oct(0, 0, 0, 1, PALETTE.driCloudLit, 0, 0.5, 0);
  driRingMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0 });
  const im = new THREE.InstancedMesh(R.build(), driRingMat, driRING_N);
  im.frustumCulled = false;
  im.visible = false;
  root.add(im);
  driRingMesh = im;
  for (let i = 0; i < driRING_N; i++) {
    const o = i * 3;
    driRingData[o] = i / driRING_N * 6.283 + rand(-0.2, 0.2);
    driRingData[o + 1] = rand(0.8, 1.25);
    driRingData[o + 2] = rand(0.55, 1.15);
  }
}

function driUpdatePuffRing(dt) {
  if (!driRingMesh) return;
  if (driRingT < 0) {
    if (driRingMesh.visible) driRingMesh.visible = false;
    return;
  }
  driRingT += dt;
  const LIFE = 0.55;
  if (driRingT > LIFE) { driRingT = -1; driRingMesh.visible = false; return; }
  if (!driRingMesh.visible) driRingMesh.visible = true;
  const u = driRingT / LIFE;
  driRingMat.opacity = (1 - u) * (1 - u) * 0.85;
  for (let i = 0; i < driRING_N; i++) {
    const o = i * 3;
    const a = driRingData[o];
    // it spreads outward and SINKS, because the animal went up off it
    const rr = driRingData[o + 1] * (0.35 + u * 3.1);
    const sc = driRingData[o + 2] * (0.5 + u * 0.9);
    driRingMesh.setMatrixAt(i, driXform(
      driRingX + Math.cos(a) * rr, driRingY - 0.25 - u * 1.4, driRingZ + Math.sin(a) * rr,
      a, a * 1.7 + u, 0, sc, sc * 0.55, sc));
  }
  driRingMesh.instanceMatrix.needsUpdate = true;
}

function driUpdatePuff(game, dt) {
  const capy = game.capy;
  const body = capy && capy.body;
  if (!body) return;
  const input = game.input;
  const grounded = !!capy.grounded;
  const inCloud = body.position.y < 0.15 && driIsOverWater(body.position.x, body.position.z);

  if (grounded || inCloud) {
    driPuffReady = true;
    driAirT = 0;
  } else {
    driAirT += dt;
  }
  if (driPuffT > 0) driPuffT -= dt;

  if (!grounded && !inCloud && driAirT > driPUFF_LOCK && driPuffReady &&
      input && input.honkPressed && !capy.carriedBy) {
    driPuffReady = false;
    driPuffT = 0.45;
    if (body.velocity.y < driPUFF_V) body.velocity.y = driPUFF_V;
    else body.velocity.y += driPUFF_V * 0.35;
    // a shove along the stick, so a puff can also be a course correction
    const cy = Math.cos(input.camYaw), sy = Math.sin(input.camYaw);
    const dx = input.x * cy + input.z * sy, dz = -input.x * sy + input.z * cy;
    const m = Math.sqrt(dx * dx + dz * dz);
    // THROUGH shove(). The vertical write above is safe because nothing in
    // capybara.js touches an airborne animal's velocity.y — but the horizontal
    // is a different story, and this nudge only exists when the stick is held,
    // which is exactly the condition that routes the frame into the airborne
    // steering solve. That solve pulls the velocity toward the WALK target at
    // capyACCEL * airControl * dt, so an animal already at running speed is
    // over target the instant the nudge lands and the whole of it is erased
    // inside three frames. shove() is added after the solve and widens the cap
    // by its own size, so a puff can genuinely be a course correction.
    if (m > 0.05) {
      if (typeof capy.shove === 'function') {
        capy.shove((dx / m) * driPUFF_FWD, (dz / m) * driPUFF_FWD);
      } else {
        body.velocity.x += (dx / m) * driPUFF_FWD;
        body.velocity.z += (dz / m) * driPUFF_FWD;
      }
    }

    driRingT = 0;
    driRingX = body.position.x; driRingY = body.position.y; driRingZ = body.position.z;
    driSfx('pop', { volume: 0.5, pitch: 1.55 });
    driSfx('chime', { volume: 0.16, pitch: 1.9 });
    if (!driPuffDone) {
      driPuffDone = true;
      driTask('puff-up');
      driToast('a capybara is mostly air anyway.');
    }
  }
}

// =============================================================== THE SEED ====
// THE MINI, and it is the only thing up here you have to CATCH.
//
// The Drift's whole list is movement, and every line of it is movement you
// generate: a hop, a puff, a column, a gap. The wind is the one thing in the
// chapter that moves you without being asked, and until now the only way to use
// it was to wait for it — 'long-gap' is famously a task you solve by standing
// still for thirty seconds.
//
// So: seed-heads, three metres across, drifting through the void on that same
// wind. Grab one and you STOP FALLING — not fly, fall at a fifth of a metre a
// second, which under a third of a gravity is a very long time in the air — and
// the wind carries you wherever it happens to be going. Let go and you drop.
//
// It is written from inside the biome, like the puff and for the same reason:
// drift.js updates BEFORE capybara.js, nothing in the controller touches an
// airborne animal's velocity.y, and the horizontal is left entirely alone
// because the wind frame is already doing exactly the right thing with it.
const driSEED_N = 5;
const driSEED_R = 2.3;               // m of fluff
const driSEED_SINK = 0.55;           // m/s — the terminal velocity of a seed
const driSEED_GRAB = 3.0;            // m you can reach one from
const driSEED_RIDE = 50;             // m carried that count as 'crossed on one'
const driSEED_Y0 = 16, driSEED_Y1 = 46;   // the band they live in
let driSeedMesh = null;
let driSeeds = [];                   // {x, y, z, spin}
let driSeedHeld = -1;
let driSeedFromX = 0, driSeedFromZ = 0;
let driSeedLastX = 0, driSeedLastZ = 0;
let driSeedRide = 0;
let driSeedBest = 0;
let driSeedDone = false;
let driSeedCool = 0;
const driSeedPos = new THREE.Vector3();

function driBuildSeeds(root) {
  const M = driMerger();
  // A dandelion clock is a ball of spokes with a tuft on the end of each, and
  // at this scale that is exactly what to draw: thirty-six of them, no sphere.
  M.sph(0, 0, 0, 0.24, 0.26, 0.24, PALETTE.driTimber);
  for (let i = 0; i < 36; i++) {
    // a spiral so they distribute rather than banding at the poles
    const y = 1 - (i / 35) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = i * 2.39996;
    const dx = Math.cos(th) * r, dy = y, dz = Math.sin(th) * r;
    M.box(dx * driSEED_R * 0.5, dy * driSEED_R * 0.5, dz * driSEED_R * 0.5,
          0.05, driSEED_R, 0.05, PALETTE.driSeed,
          Math.atan2(Math.hypot(dx, dz), dy) * (dz >= 0 ? 1 : -1), Math.atan2(dx, dz), 0);
    // AN OCTAHEDRON, NOT A SPHERE. Thirty-six six-by-four spheres is 1,296
    // triangles a seed and five seeds is 8,820 - thirteen per cent of the whole
    // chapter, spent on a 20 cm tuft that is never seen closer than arm's
    // length. Eight triangles each hands 4,600 of it back, which is most of
    // what the painted decks and the moon's halo cost.
    M.oct(dx * driSEED_R * 0.52, dy * driSEED_R * 0.52, dz * driSEED_R * 0.52,
          0.42, PALETTE.driSeed, th, th * 0.7, 0);
  }
  driSeedMesh = new THREE.InstancedMesh(M.build(), driVC(), driSEED_N);
  driSeedMesh.castShadow = false;
  driSeedMesh.frustumCulled = false;
  driSeedMesh.name = 'driSeeds';
  root.add(driSeedMesh);
  driSeeds = [];
  for (let i = 0; i < driSEED_N; i++) driSeeds.push(driSeedRespawn({}, i));
}

/** Put a seed back on the windward side of the archipelago. */
function driSeedRespawn(sd, i) {
  const a = (i * 2.39996) % 6.283;
  const w = Math.atan2(driWindX, driWindZ);
  const d = 120;
  sd.x = Math.sin(w + Math.PI) * d + Math.cos(a) * 40;
  sd.z = Math.cos(w + Math.PI) * d + Math.sin(a) * 40;
  sd.y = driSEED_Y0 + ((i * 7919) % 100) / 100 * (driSEED_Y1 - driSEED_Y0);
  sd.spin = 0.2 + ((i * 104729) % 100) / 100 * 0.5;
  return sd;
}

function driUpdateSeeds(game, dt) {
  if (!driSeedMesh) return;
  const capy = game.capy;
  const body = capy && capy.body;
  const cp = capy && capy.position;
  if (driSeedCool > 0) driSeedCool -= dt;

  // ---- they drift, on the same wind everything else here reads -------------
  // THE GUARD HAS TO BE ABOVE THE LOOP. `if (!body || !cp) return;` was four
  // lines BELOW this, and the held branch dereferences `cp` — so a single frame
  // with no capybara position (the first frame of a build, or a reload landing
  // mid-attach) throws inside systems.update, and one throw in there takes the
  // whole module out for the rest of the session: the animal keeps walking and
  // nothing else in the world updates again. See capy3-module-drop-failure.
  if (!cp) { if (driSeedHeld >= 0) driSeedHeld = -1; return; }
  for (let i = 0; i < driSeeds.length; i++) {
    const sd = driSeeds[i];
    if (i === driSeedHeld) {
      // held: it rides over the animal's head, which is where you would hold it
      sd.x = cp.x; sd.z = cp.z; sd.y = cp.y + driSEED_R * 0.62 + 0.5;
    } else {
      sd.x += driWindX * dt;
      sd.z += driWindZ * dt;
      sd.y -= driSEED_SINK * 0.35 * dt;
      if (sd.y < driSEED_Y0 - 8 || Math.hypot(sd.x, sd.z) > 260) driSeedRespawn(sd, i);
    }
    driSeedMesh.setMatrixAt(i, driXform(sd.x, sd.y, sd.z,
      Math.sin(driTime * sd.spin) * 0.2, driTime * sd.spin, Math.cos(driTime * sd.spin * 0.7) * 0.2,
      1, 1, 1));
  }
  driSeedMesh.instanceMatrix.needsUpdate = true;
  if (!body) return;

  // ---- catch one ----------------------------------------------------------
  const input = game.input;
  if (driSeedHeld < 0 && driSeedCool <= 0 && input && input.actionPressed) {
    let best = -1, bd = driSEED_GRAB * driSEED_GRAB;
    for (let i = 0; i < driSeeds.length; i++) {
      const sd = driSeeds[i];
      const dx = sd.x - cp.x, dy = sd.y - (cp.y + 0.8), dz = sd.z - cp.z;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bd) { bd = d; best = i; }
    }
    if (best >= 0) {
      driSeedHeld = best;
      driSeedFromX = cp.x; driSeedFromZ = cp.z;
      driSeedLastX = cp.x; driSeedLastZ = cp.z;
      driSeedRide = 0;
      driSfx('rustle', { volume: 0.5, pitch: 1.4 });
      driToast('do not let go.');
      // ---- AND IT SHEDS ---------------------------------------------------
      // Catching a three-metre dandelion clock at a third of a gravity is the
      // chapter's mini and the whole of it was a sound and a change of fall
      // rate. A seed-head that is grabbed LOSES florets — which is the only
      // frame in which the player can see that the thing they are now hanging
      // off is made of the same stuff as the hundred and fifty motes drifting
      // past them. The puff ring already exists and is exactly the right shape
      // for it: one instanced burst, half a second, no new mesh.
      driRingT = 0;
      driRingX = driSeeds[best].x; driRingY = driSeeds[best].y; driRingZ = driSeeds[best].z;
    }
  } else if (driSeedHeld >= 0 && input && input.actionPressed) {
    driSeedLetGo(game);
  }

  // ---- and then you stop falling -----------------------------------------
  if (driSeedHeld >= 0) {
    // The vertical write is the puff's trick and is safe for the puff's reason:
    // this module runs before capybara.js and nothing in the controller touches
    // an airborne animal's velocity.y. The HORIZONTAL is deliberately untouched
    // — wind() is already a reference frame and is already carrying the animal
    // exactly as it carries the seed.
    // ASSIGNED, NOT DAMPED. A damper at lambda 7 removes 11% of the error per
    // frame and a third of a gravity puts 0.143 m/s back into it every step, so
    // the two balance at 1.85 m/s down — measured, three times the terminal
    // velocity this is supposed to be, and the seed fell out of the sky. The
    // puff assigns for the same reason and it is safe for the same reason.
    if (body.velocity.y < -driSEED_SINK) body.velocity.y = -driSEED_SINK;
    // PATH LENGTH, not displacement from the start. The wind swings all the way
    // over and back on a thirty-eight second breath, so a straight-line measure
    // can go DOWN while you are still being carried, and a crossing that ends
    // where it began — which up here is a perfectly good crossing — measures
    // zero.
    driSeedRide += Math.hypot(cp.x - driSeedLastX, cp.z - driSeedLastZ);
    driSeedLastX = cp.x; driSeedLastZ = cp.z;
    if (driSeedRide > driSeedBest) driSeedBest = driSeedRide;
    // THIS crossing, on the paper, while you are hanging off the seed (v32) —
    // the path length so far, which is the quantity driSeedBest takes its
    // maximum of and therefore the quantity the record holds.
    if (game.recordLive) game.recordLive('driftseed', driSeedRide);
    if (!driSeedDone && driSeedRide >= driSEED_RIDE) {
      driSeedDone = true;
      if (game.record) game.record('driftseed', driSeedBest);
      driTask('driftseed');
    }
    if (capy.grounded) driSeedLetGo(game);
  }
  driSeedPos.set(driSeeds.length ? driSeeds[0].x : 0, driSeeds.length ? driSeeds[0].y : 30,
                 driSeeds.length ? driSeeds[0].z : 0);
  // point the beacon at the nearest one, not at the first
  let bi = -1, bd2 = Infinity;
  for (let i = 0; i < driSeeds.length; i++) {
    const sd = driSeeds[i];
    const d = (sd.x - cp.x) * (sd.x - cp.x) + (sd.z - cp.z) * (sd.z - cp.z);
    if (d < bd2) { bd2 = d; bi = i; }
  }
  if (bi >= 0) driSeedPos.set(driSeeds[bi].x, driSeeds[bi].y, driSeeds[bi].z);
}

function driSeedLetGo(game) {
  if (driSeedHeld < 0) return;
  if (game && game.record && driSeedBest > 6) game.record('driftseed', driSeedBest);
  driSeedRespawn(driSeeds[driSeedHeld], driSeedHeld);
  driSeedHeld = -1;
  driSeedRide = 0;
  driSeedCool = 0.45;
  driSfx('pop', { volume: 0.35, pitch: 1.2 });
}

// ================================================================= COLUMNS ===
function driUpdateColumns(game, dt) {
  const capy = game.capy;
  const body = capy && capy.body;
  if (!body) return;
  const p = body.position;

  // THE CLOUD'S OWN TEMPORARY COLUMN, AND IT FOLLOWS YOU.
  // A fixed disc was measured at fourteen metres of lift: the wind walks the
  // animal out of a seven-metre circle in under three seconds and the strength
  // falls off with the radius, so the thing quit less than half way home and
  // dropped you straight back in. It is the cloud gathering UNDER the capybara,
  // not a spot on the map, so it goes where the capybara goes — damped, so it
  // still reads as something heavy being dragged along rather than as a
  // rectangle stapled to the animal.
  if (driBloomOn) {
    driBloomT -= dt;
    driBloomX = damp(driBloomX, p.x, 3.5, dt);
    driBloomZ = damp(driBloomZ, p.z, 3.5, dt);
    if (driBloomT <= 0) driBloomOn = false;
  }
  const bloom = driBloomLift(p.x, p.y, p.z);

  const ci = driColumnAt(p.x, p.y, p.z);
  const s = Math.max(bloom, ci >= 0 ? driColStrength : 0);
  // A COLUMN IS A PARCEL OF AIR, NOT A HOLE IN ONE.
  // Without this the crosswind simply walked the capybara out of the shaft:
  // eight seconds of climb against 2.75 m/s of drift is twenty-two metres, and
  // the shaft is ten and a half wide, so measured, col1 quit at 74.7 m — below
  // the island it exists to serve. Inside the column the air is going UP and it
  // is going up together, so the sideways component nearly stops. It also feels
  // right: stepping into one is stepping out of the weather.
  driShelter = 1 - 0.8 * clamp(s, 0, 1);
  // ---- STEPPING INTO ONE IS AN EVENT ------------------------------------
  // A column is ninety metres of invisible physics with a helix of seed-husks
  // round it, and the moment of ENTERING one — which is the chapter's third
  // verb and the only lift in it that is not a jump — was a velocity change and
  // nothing else: no sound, no mark, nothing that tells the player the thing
  // they were aiming at has taken. Every other verb here got one (the puff has
  // its ring, the seed has its catch, the cloud has its bloom). This is the
  // rising note and the nine standing stones at the foot of the shaft coming up
  // for as long as you are in it — so from anywhere else in the sky, a lit ring
  // of stones means somebody is going up.
  const inCol = s > 0.10;
  if (inCol && !driColWas) {
    driSfx('hiss', { volume: 0.30, pitch: 1.5 });
    driSfx('chime', { volume: 0.26, pitch: 1.55 });
  }
  driColWas = inCol;
  driColRing = damp(driColRing, inCol ? 1 : 0, inCol ? 6 : 1.4, dt);
  // opacity only — the glow mesh is authored in WORLD space, so scaling it
  // would walk nine standing stones away from the shaft they stand round.
  if (driColStoneMat) {
    driColStoneMat.opacity = driColRing *
      (0.44 + Math.sin(driTime * 4.1) * 0.06 + Math.sin(driTime * 1.7) * 0.05);
  }
  if (s > 0.02) {
    const want = driCOL_LIFT * s;
    if (body.velocity.y < want) {
      body.velocity.y = damp(body.velocity.y, want, driCOL_LAMBDA, dt);
    }
    if (ci >= 0) {
      if (ci !== driColIdx) { driColIdx = ci; driColPeak = p.y; driColFoot = p.y; }
      if (p.y > driColPeak) driColPeak = p.y;
      if (p.y < driColFoot) driColFoot = p.y;
      if (!driColDone && driColPeak - driColFoot > driCOL_CLIMB) {
        driColDone = true;
        driTask('updraft');
        driToast('the air up here goes somewhere.');
        driSfx('chime', { volume: 0.4, pitch: 1.2 });
      }
    }
  } else if (driColIdx >= 0) {
    if (driColDone) driRecord('updraft', driColPeak);
    driColIdx = -1;
  }
}

// ================================================================== CLOUD ====
function driUpdateCloud(game, dt) {
  const capy = game.capy;
  const body = capy && capy.body;
  if (!body) return;
  const p = body.position;
  const inCloud = p.y < 0.12 && !driIslandAt(p.x, p.z);

  if (inCloud) {
    if (driInCloud === 0) {
      driSfx('splash', { volume: 0.55, pitch: 0.52 });
      if (!driDiveDone) {
        driDiveDone = true;
        driTask('cloud-dive');
        driToast('see? nothing to it. the cloud has you.');
      }
    }
    driInCloud += dt;
    // shout at four hundred metres of cloud and four hundred metres of cloud
    // shouts back. On a cooldown, because a ring you can retrigger every frame
    // is a texture rather than an event.
    const inp = game.input;
    if (inp && inp.honkPressed && (driWhoopT < 0 || driWhoopT > 1.1)) {
      driWhoopT = 0; driWhoopX = p.x; driWhoopZ = p.z;
      // AND A BURST YOU CAN SEE FROM INSIDE IT. The sheet's wave is the thing
      // that reads from thirty metres up; down here the animal's eye is ten
      // centimetres over the vapour and the whole horizon is cloud lumps, so
      // the ring on the mesh is invisible from exactly the place the shout came
      // from. The puff ring — the same instanced burst the seed-head sheds —
      // costs nothing and lands on the frame the noise does.
      driRingT = 0;
      driRingX = p.x; driRingY = driCLOUD_Y + 0.35; driRingZ = p.z;
      driSfx('hiss', { volume: 0.24, pitch: 0.7 });
      driSfx('chime', { volume: 0.18, pitch: 0.62 });
      if (!driWhoopSaid) {
        driWhoopSaid = true;
        driToast('the whole sea of it heard that.');
      }
    }
    if (driInCloud > driBLOOM_WAIT && !driBloomOn) {
      driBloomOn = true;
      driBloomT = driBLOOM_LIFE;
      driBloomX = p.x; driBloomZ = p.z;
      driSfx('chime', { volume: 0.34, pitch: 0.78 });
      driSfx('hiss', { volume: 0.20, pitch: 1.35 });
    }
  } else {
    driInCloud = 0;
  }
  if (driWhoopT >= 0) { driWhoopT += dt; if (driWhoopT > driWHOOP_LIFE) driWhoopT = -1; }
}

// ================================================================ THE FLIGHT ==
/**
 * HOW FAR THAT ONE WAS.
 *
 * Measured from the last frame the animal had ground under it to the first
 * frame it has ground again, horizontally only — a column ride is not a
 * crossing, and neither is a fall. Twenty metres is the bar and it is set by
 * the Long Gap, which is twenty-three; anything shorter and the record would be
 * something you set by accident on the stairs.
 */
function driUpdateFlight(game, dt) {
  const capy = game.capy;
  const body = capy && capy.body;
  if (!body) return;
  const p = body.position;
  const grounded = !!capy.grounded;
  const inCloud = p.y < 0.15 && !driIslandAt(p.x, p.z);
  const solid = grounded && !inCloud;

  if (driBloomOn || driColumnAt(p.x, p.y, p.z) >= 0) driFlightOn = false;

  if (solid) {
    if (!driWasGrounded && driFlightOn) {
      const dx = p.x - driFlightX, dz = p.z - driFlightZ;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > driFlightBest) driFlightBest = d;
      if (d >= driLONG_GAP) {
        if (!driGapDone) {
          driGapDone = true;
          driTask('long-gap');
          driToast(d.toFixed(1) + ' metres of nothing, and you are still here.');
          driSfx('cheer', { volume: 0.5, pitch: 1.25 });
        }
        driRecord('long-gap', d);
        // ---- AND THE TWO POSTS SAY SO -------------------------------------
        // The hardest thing in the chapter — twenty-five metres of nothing that
        // is impossible into the wind and marginal in dead calm — paid out in a
        // line of text and one sound, and the two carved posts leaning at each
        // other across the gap, which are the only reason anybody knew it was a
        // crossing at all, did nothing. They catch. It is the same light the
        // lantern will send back down here later, borrowed early.
        driFlareBeaconsNear(p.x, p.z, 26);
        driSfx('chime', { volume: 0.42, pitch: 0.9 });
      }
      driFlightOn = false;
    }
    driFlightX = p.x; driFlightZ = p.z;
    driFlightOn = true;
  } else if (inCloud) {
    driFlightOn = false;      // a fall is not a crossing
  }
  driWasGrounded = solid;
}

// =============================================================== WANDERERS ===
function driUpdateWanderers(game, dt) {
  for (let i = 0; i < driMovers.length; i++) {
    const m = driMovers[i], d = m.def;
    m.t += dt;
    // a cosine ease so the ends are a turn rather than a bounce — and the
    // VELOCITY is the derivative of exactly that, because capybara.js solves in
    // this body's frame and a velocity that disagrees with the motion would
    // slide the animal off the deck every time the island changed direction
    const w = 6.28318 / d.period;
    const ph = m.t * w;
    const u = 0.5 - 0.5 * Math.cos(ph);
    const du = 0.5 * Math.sin(ph) * w;
    m.x = lerp(d.x0, d.x1, u);
    m.z = lerp(d.z0, d.z1, u);
    const vx = (d.x1 - d.x0) * du, vz = (d.z1 - d.z0) * du;
    m.body.velocity.set(vx, 0, vz);
    m.body.position.set(m.x, d.y - 3, m.z);
    driSyncBody(m.body);
    m.mesh.position.set(m.x, d.y, m.z);
    m.mesh.rotation.z = Math.sin(m.t * 0.4 + i) * 0.012;
    // THE BELL. It rings at the ends of the run, where `du` changes sign —
    // which is both the moment the island turns round and, for a player waiting
    // on the lip of the Long Gap, the moment it is coming back. Its volume
    // falls off with distance the way the storks' bill-clatter does, so it is
    // a place in the sky rather than a sound in the room.
    const sw = du >= 0 ? 1 : -1;
    if (m.sw === undefined) m.sw = sw;
    if (sw !== m.sw) {
      m.sw = sw;
      const cp0 = game.capy && game.capy.position;
      const far = cp0 ? Math.hypot(cp0.x - m.x, cp0.z - m.z) : 999;
      if (far < 170) {
        const v = clamp(0.34 - far * 0.0017, 0.04, 0.34);
        driSfx('chime', { volume: v, pitch: 0.72 + i * 0.11 });
        driSfx('tick', { volume: v * 0.5, pitch: 0.9 });
      }
    }
  }

  // riding one
  const capy = game.capy;
  const p = capy && capy.position;
  if (!p) return;
  const isle = driIslandAt(p.x, p.z);
  const onMover = !!(isle && isle.def && capy.grounded && p.y > isle.def.y - 1.5);
  if (onMover) {
    const id = isle.def.id;
    if (id !== driRideId) { driRideId = id; driRideT = 0; }
    driRideT += dt;
    if (!driRideDone && driRideT > driRIDE_T) {
      driRideDone = true;
      driTask('wander-isle');
      driToast('no idea where it is going. neither has it.');
      driSfx('chime', { volume: 0.36, pitch: 1.05 });
    }
  } else {
    driRideId = '';
    driRideT = 0;
  }
}

// ================================================================ LAMPFLIES ==
function driUpdateLampflies(game, dt) {
  const capy = game.capy;
  const p = capy && capy.position;
  if (!p || !driFlyMesh) return;
  const input = game.input;

  // --- the wheek wakes them ------------------------------------------------
  // Deliberately generous, and deliberately capped at four per shout: the
  // orchard should feel like it ANSWERS, and it should still take three or four
  // goes to get the six the lantern wants.
  if (input && input.honkPressed && capy.grounded) {
    let woke = 0;
    for (let i = 0; i < driFLY_N && woke < 4; i++) {
      const o = i * 11;
      if (driFlyData[o + 7] !== 0) continue;
      const dx = driFlyData[o] - p.x, dy = driFlyData[o + 1] - p.y, dz = driFlyData[o + 2] - p.z;
      if (dx * dx + dy * dy + dz * dz > driWAKE_R * driWAKE_R) continue;
      driFlyData[o + 7] = 1;
      driFlyData[o + 10] = driTime;
      driFlyData[o + 8] = driFliesAwake;
      driFliesAwake++;
      woke++;
    }
    if (woke > 0) {
      driSfx('chime', { volume: 0.30 + woke * 0.05, pitch: 1.35 + woke * 0.14 });
      if (!driFlyDone) {
        driFlyDone = true;
        driTask('lampfly');
        driToast('it has decided you are worth following.');
      } else if (driFliesAwake >= driFLIES_NEED && !driHintFlies) {
        driHintFlies = true;
        driToast(driFliesAwake + ' of them now. something up there should be lit.');
      }
    }
  }

  // --- move them -----------------------------------------------------------
  const t = driTime;
  for (let i = 0; i < driFLY_N; i++) {
    const o = i * 11;
    const ph = driFlyData[o + 6], rate = driFlyData[o + 9];
    const state = driFlyData[o + 7];
    if (state === 1) {
      // FOLLOWING: a loose constellation carried overhead, each one at its own
      // radius and its own lag, so six of them read as six creatures and twelve
      // still read as a sky rather than as a formation.
      const slot = driFlyData[o + 8];
      const a = t * (0.42 + rate * 0.16) + slot * 1.37 + ph;
      const rr = 3.4 + (slot % 6) * 1.1;
      const tx = p.x + Math.cos(a) * rr;
      const ty = p.y + 1.9 + (slot % 5) * 0.55 + Math.sin(t * rate + ph) * 0.4;
      const tz = p.z + Math.sin(a) * rr;
      driFlyData[o] = damp(driFlyData[o], tx, 1.7 + (slot % 3) * 0.4, dt);
      driFlyData[o + 1] = damp(driFlyData[o + 1], ty, 2.2, dt);
      driFlyData[o + 2] = damp(driFlyData[o + 2], tz, 1.7 + (slot % 3) * 0.4, dt);
    } else if (state === 2) {
      // LIT WHERE IT STANDS: the lantern's doing. A wider, slower orbit than a
      // sleeping one, and a little higher, so an island you have already been to
      // is visible from three hundred metres away as a small cloud of light.
      const a = t * 0.11 * rate + ph;
      driFlyData[o] = damp(driFlyData[o], driFlyData[o + 3] + Math.cos(a) * 3.6, 1.0, dt);
      driFlyData[o + 1] = damp(driFlyData[o + 1], driFlyData[o + 4] + 1.8 + Math.sin(a * 1.3) * 1.2, 1.0, dt);
      driFlyData[o + 2] = damp(driFlyData[o + 2], driFlyData[o + 5] + Math.sin(a) * 3.6, 1.0, dt);
    } else {
      // ASLEEP: a slow orbit of the tree it was born under
      const a = t * 0.14 * rate + ph;
      let tx = driFlyData[o + 3] + Math.cos(a) * 2.2;
      let ty2 = driFlyData[o + 4] + Math.sin(a * 1.7) * 0.7;
      let tz = driFlyData[o + 5] + Math.sin(a) * 2.2;
      // ---- BUT IT NOTICES YOU WALK PAST -----------------------------------
      // Waking a lampfly is the chapter's one social verb and the only way to
      // find out it exists was to shout at one and see what happened. A
      // creature that ignores a hundred and fifty kilos of capybara standing
      // over it, and then answers a squeak, is a switch with wings. So: inside
      // three and a half metres it lifts and drifts AWAY, slowly and only a
      // little — which is both what something asleep does when it is disturbed
      // and, mechanically, the thing that makes the player try the noise.
      const nx = driFlyData[o] - p.x, nz = driFlyData[o + 2] - p.z;
      const nd = Math.sqrt(nx * nx + nz * nz);
      if (nd < 3.6 && Math.abs(driFlyData[o + 1] - p.y) < 4) {
        const k = (1 - nd / 3.6);
        tx += (nx / Math.max(0.3, nd)) * k * 2.2;
        tz += (nz / Math.max(0.3, nd)) * k * 2.2;
        ty2 += k * 1.1;
      }
      driFlyData[o] = damp(driFlyData[o], tx, 1.4, dt);
      driFlyData[o + 1] = damp(driFlyData[o + 1], ty2, 1.4, dt);
      driFlyData[o + 2] = damp(driFlyData[o + 2], tz, 1.4, dt);
    }
    // A SLEEPING ONE BREATHES; A WOKEN ONE FLARES AND THEN SETTLES. The flare
    // is 0.9 s long, which is just long enough to look at. It used to be the
    // ONLY acknowledgement the wheek got in this biome; there are three more
    // now (the skein breaks, and the two people at the far end answer back).
    const since = t - driFlyData[o + 10];
    const flare = since >= 0 && since < 0.9 ? (1 - since / 0.9) * (1 - since / 0.9) : 0;
    const breathe = state === 0 ? 0.55 + Math.sin(t * 1.15 + ph) * 0.45 : 1;
    // A SLEEPING ONE BREATHES IN SIZE, and it has to be big enough to see: the
    // old 0.30 + breathe * 0.06 is a six-centimetre swing on a thirty-three
    // centimetre object, which at fifteen metres is a pixel and a half. 0.26 to
    // 0.50 is a creature; a mote never changes size at all.
    const s = (state === 1 ? 0.46 + Math.sin(t * 5 + ph) * 0.06
             : state === 2 ? 0.42 + Math.sin(t * 3.4 + ph) * 0.06
             : 0.26 + breathe * 0.24) * (1 + flare * 1.3);
    driFlyMesh.setMatrixAt(i, driXform(driFlyData[o], driFlyData[o + 1], driFlyData[o + 2],
                                       t * 0.7 + ph, t * 1.1 + ph, 0, s, s, s));
    if (driFlyMesh.instanceColor) {
      // AND A SLEEPING ONE IS STILL A LIGHT. Dimmed to a third, driFlyDim
      // (0x9a8fb0) resolves to almost exactly the value of this chapter's sky,
      // and twenty-two lampflies in the orchard vanished. What separates asleep
      // from awake here is not brightness, it is TEMPERATURE: cold violet
      // against warm gold. Keep both bright and let the hue do the work.
      const lit = state === 0 ? 0.85 + breathe * 0.35 : 1 + flare * 0.9;
      driFlyCol.copy(state === 0 ? driFlyDimC : driFlyColour).multiplyScalar(lit);
      driFlyMesh.instanceColor.setXYZ(i, driFlyCol.r, driFlyCol.g, driFlyCol.b);
    }
    // the halo: same place, three times the size, a fifth of the strength, and
    // it swells with the breath rather than with the body
    if (driFlyHalo) {
      const hs = s * (2.2 + breathe * 0.9);
      driFlyHalo.setMatrixAt(i, driXform(driFlyData[o], driFlyData[o + 1], driFlyData[o + 2],
                                         0, t * 0.3 + ph, 0, hs, hs, hs));
      driFlyCol.multiplyScalar(state === 0 ? 0.19 + breathe * 0.10 : 0.30 + flare * 0.4);
      driFlyHalo.instanceColor.setXYZ(i, driFlyCol.r, driFlyCol.g, driFlyCol.b);
    }
  }
  driFlyMesh.instanceMatrix.needsUpdate = true;
  if (driFlyMesh.instanceColor) driFlyMesh.instanceColor.needsUpdate = true;
  if (driFlyHalo) {
    driFlyHalo.instanceMatrix.needsUpdate = true;
    driFlyHalo.instanceColor.needsUpdate = true;
  }
}

// ================================================================== LANTERN ==
const driFlyColour = new THREE.Color(PALETTE.driFly);
const driFlyDimC = new THREE.Color(PALETTE.driFlyDim);
const driFlyCol = new THREE.Color();
const driWarm = new THREE.Color(PALETTE.driLamp);
const driPaperC = new THREE.Color(PALETTE.driPaper);

function driUpdateLantern(game, dt) {
  const capy = game.capy;
  const p = capy && capy.position;
  if (!p) return;
  const input = game.input;
  const dx = p.x - driLANTERN.x, dz = p.z - driLANTERN.z;
  const near = dx * dx + dz * dz < 7.5 * 7.5;

  if (!driLit && near && input && input.actionPressed) {
    if (driFliesAwake >= driFLIES_NEED) {
      driLit = true;
      driLitT = 12;
      driTask('lantern');
      driToast('there. now the whole sky knows where you are.');
      // THE TWO LOUDEST CUES IN THE CHAPTER, AND BOTH WERE MONO. 0 of 30
      // driSfx calls in this file passed a position, in a biome whose whole
      // subject is distance across empty air.
      driSfx('chime', { volume: 1.0, pitch: 0.62, at: driLANTERN });
      driSfx('organ', { volume: 0.5, at: driLANTERN });
      if (typeof game.shake === 'function') game.shake(0.12);
      // ---- FRAMED (v26) ---------------------------------------------------
      // The payout frame was a blown-out white wall of paper: the camera sat
      // 8.0 m from a nine-metre lantern at 61.9 degrees of pitch, so the shot
      // was seventy per cent lit paper with no sky, no archipelago and not even
      // the keeper standing 2.4 m away. The lantern is the last thing in the
      // chapter and it is the only thing you cannot see at it.
      //
      // Backed off to 36 m and dropped to ten degrees, looking back down the
      // arrival route over the plinth. Held seven seconds — long enough for the
      // beacon front to reach the Shelf 220 m behind you and for the skein,
      // called six seconds out on the line above, to actually arrive.
      if (typeof game.frameShot === 'function') {
        game.frameShot({ yaw: 168 * Math.PI / 180, dist: 16,
                         pitch: 10 * Math.PI / 180, raise: 4.5, hold: 7.0 });
      }
      // AND THE SKY COMES OVER TO LOOK. The crossing runs on a ninety-six
      // second gap of its own, so on most playthroughs the last thing in the
      // chapter happened in an empty sky. Lighting the lantern starts one now,
      // on a heading that brings it across the Crown at the height of the
      // paper — which is the only time in this biome the two biggest things in
      // it are in the same frame.
      // AND THE WHOLE ARCHIPELAGO ANSWERS. See driUpdateBeacons: a front at
      // fifty-five metres a second, so the Crown's own marks catch inside a
      // fifth of a second and the croft on the Shelf — two hundred and twenty
      // metres and ten minutes of play behind you — catches four seconds later.
      driBeaconWave = 0;
      if (!driSkeinCalled) {
        driSkeinCalled = true;
        driSkeinT = -6;                       // six seconds out, so it arrives
        driSkeinA = 1.05;                     // roughly along the crossing
        driSkeinY = driLANTERN.y + 9;
        driSkeinZ = driLANTERN.z - 4;
      }
      // EVERY LAMPFLY IN THE WORLD LIGHTS — where it is, not behind you.
      for (let i = 0; i < driFLY_N; i++) {
        const o = i * 11;
        if (driFlyData[o + 7] !== 0) continue;
        driFlyData[o + 7] = 2;
        driFlyData[o + 10] = driTime;
      }
    } else {
      driSfx('tick', { volume: 0.5, pitch: 0.7 });
      driToast('it wants light to start with. ' + driFliesAwake + ' of ' + driFLIES_NEED + '.');
    }
  }
  if (driLitT > 0) driLitT -= dt;
  driGlow = damp(driGlow, driLit ? 1 : 0, 0.55, dt);

  if (driLanternMat) {
    // a flame is never steady; a paper lantern with one in it least of all
    const flick = 1 + Math.sin(driTime * 7.3) * 0.05 + Math.sin(driTime * 2.7) * 0.04;
    driLanternMat.emissiveIntensity = driGlow * 1.15 * flick;
  }
  if (driLanternHalo) driLanternHalo.material.opacity = driGlow * 0.085;
  if (driLanternPool) driLanternPool.material.opacity = driGlow * 0.42;
  // and the three bowls take it, a beat behind and each on its own clock, so
  // the Crown lights in four places rather than one
  if (driBowlMat) {
    driBowlMat.opacity = 0.10 + driGlow * 0.72 *
      (0.82 + Math.sin(driTime * 3.1) * 0.10 + Math.sin(driTime * 1.3) * 0.08);
  }
  if (driEmberMesh) {
    const vis = driGlow > 0.02;
    if (vis !== driEmberMesh.visible) driEmberMesh.visible = vis;
    if (vis) {
      driEmberMat.opacity = driGlow * 0.9;
      for (let i = 0; i < driEMBER_N; i++) {
        const o = i * 4;
        let h = driEmberData[o + 2] + driEmberData[o + 3] * dt;
        if (h > 30) h -= 30;
        driEmberData[o + 2] = h;
        const a = driEmberData[o] + h * 0.09;
        // they lean downwind as they climb, which is the only place in the
        // chapter the wind is drawn on something that is not a mote
        const rr = driEmberData[o + 1] + h * 0.16;
        const fade = h < 3 ? h / 3 : clamp(1 - (h - 3) / 24, 0, 1);
        const sc = (0.16 + fade * 0.3) * (h < 3 ? 0.6 + h * 0.13 : 1);
        driEmberMesh.setMatrixAt(i, driXform(
          Math.cos(a) * rr + driWindX * h * 0.14, 8.4 + h,
          Math.sin(a) * rr + driWindZ * h * 0.14,
          a, a * 1.3, 0, sc, sc, sc));
      }
      driEmberMesh.instanceMatrix.needsUpdate = true;
    }
  }
  // The swarm and the cloud both take the light, which is what makes it read as
  // a light rather than as a glowing object — nothing in this biome casts, so
  // everything that ought to be lit by it has to be tinted by hand.
  //
  // THE SWARM'S TINT HAS ITS OWN TRIGGER. It used to be folded into the glow
  // guard, which meant it was recomputed exactly once — on the first frame,
  // with nought lampflies awake and nought glow — and then never again, so the
  // swarm you had spent five minutes gathering stayed the colour of a swarm you
  // had not. Two numbers drive it and both of them have to be watched.
  // The swarm's colour is PER LAMPFLY now (see driUpdateLampflies), so the
  // global tint that used to live here is gone with the shared emissive it was
  // written into. What is left is the paper and the cloud.
  if (Math.abs(driGlow - driLastGlow) > 0.004) {
    driLastGlow = driGlow;
    if (driLanternMat) driLanternMat.color.setHex(PALETTE.driPaperDim).lerp(driPaperC, driGlow);
    // The cloud sea takes a third of the lantern's colour, not a fifth: it is
    // the largest surface in the chapter and the only one big enough to say
    // that something has happened to the whole world rather than to one island.
    // (The sky ribbons already ride driGlow inside driUpdateRibbons — writing
    // their opacity here as well would be two hands on one number.)
    if (driCloudMesh) driCloudMesh.material.color.setHex(0xffffff).lerp(driWarm, driGlow * 0.24);
  }
}
// ==================================================================== MOTES ==
/**
 * The mote box follows the capybara and WRAPS: a mote that leaves one face
 * re-enters through the opposite one at a fresh random height, so a hundred and
 * fifty of them cover a world three hundred metres across for the cost of a
 * hundred and fifty matrix composes. Nothing is allocated per frame.
 */
/**
 * THE AIRFIELD TURNS OVER AND GOES WITH THE WIND.
 *
 * Two hundred rocks bobbing on their own sine would be a screensaver. They are
 * in the same parcel of air the capybara is, so they carry driWindX/Z at a
 * fraction of it — heavier things move less, which is what makes a field of
 * them read as having WEIGHT — and they wrap round the animal on a generous
 * box, the way the motes do, so the field is always where the player is.
 *
 * The wrap is the part that has bitten this codebase before: a recycled thing
 * has to respect the player's furniture. It cannot here — nothing in the
 * airfield is solid, none of it is ever reported as ground, and the wrap box is
 * eighty metres across — but the rule stands and the reason it is safe is
 * written down rather than assumed.
 */
function driUpdateAirfield(game, dt) {
  if (!driAirMesh) return;
  const p = game.capy && game.capy.position;
  const cx = p ? p.x : 0, cy = p ? p.y : 0, cz = p ? p.z : 0;
  const HX = 80, HY = 52;
  let ti = 0, ci = 0;
  for (let i = 0; i < driAIR_N; i++) {
    const o = i * 4;
    const rate = driAirData[o + 2];
    driAirData[o + 1] += dt * driAirData[o + 3] * 3.0;
    let y = driAirData[o];
    // read the instance's own x/z back off the matrix rather than keeping a
    // third copy of them: one source of truth per number.
    driAirMesh.getMatrixAt(i, driM);
    let x = driM.elements[12], z = driM.elements[14];
    const nx = x + driWindX * rate * dt;
    const nz = z + driWindZ * rate * dt;
    // ---- SCATTER RECYCLING MUST RESPECT THE PLAYER'S FURNITURE -----------
    // A field that wraps round the animal on an eighty-metre box will be put
    // down inside an island sooner or later, and the wind walks it into one
    // even if the build was clean. The step is REFUSED rather than the rock
    // being teleported: a stone that stops at the rim and eddies there for
    // twenty seconds until the breath comes round reads as weather, and a
    // stone that vanishes reads as a bug. Same rule as the Antarctic floe that
    // could be dropped on the moored tender, in the cheap direction.
    if (!driBlockedForAir(nx, y, nz)) { x = nx; z = nz; }
    y += Math.sin(driTime * 0.31 + driAirData[o + 1]) * 0.22 * dt;
    let wx2 = x, wz2 = z, wy2 = y, wrapped = false;
    if (x - cx > HX) { wx2 = cx - HX; wrapped = true; } else if (cx - x > HX) { wx2 = cx + HX; wrapped = true; }
    if (z - cz > HX) { wz2 = cz - HX; wrapped = true; } else if (cz - z > HX) { wz2 = cz + HX; wrapped = true; }
    if (y - cy > HY) { wy2 = cy - HY; wrapped = true; } else if (cy - y > HY) { wy2 = cy + HY; wrapped = true; }
    // A wrap is the one move that can put a rock anywhere, so it is the one
    // move that has to check. If the far side of the box is inside an island,
    // drop the rock eighteen metres and take that instead — below every deck
    // in the chapter is always somewhere legal.
    if (wrapped) {
      if (driBlockedForAir(wx2, wy2, wz2)) wy2 -= 18;
      x = wx2; z = wz2; y = wy2;
    }
    driAirData[o] = y;
    const spin = driAirData[o + 1];
    const s = 0.5 + ((i * 11) % 9) * 0.20;
    driAirMesh.setMatrixAt(i, driXform(x, y, z, spin * 0.3, spin, spin * 0.17, s, s * 0.8, s * 0.9));
    if (i % 3 === 0 && driAirTurf) {
      driAirTurf.setMatrixAt(ti++, driXform(x, y + s * 0.40, z, spin * 0.3, spin, spin * 0.17,
                                            s * 1.15, 0.34, s * 1.05));
    }
    if (i % 4 === 1 && driAirChip) {
      driAirChip.setMatrixAt(ci++, driXform(x + s * 0.9, y - s * 0.5, z,
                                            spin, spin * 1.3, spin * 0.6, s * 0.5, s * 0.5, s * 0.5));
    }
  }
  driAirMesh.instanceMatrix.needsUpdate = true;
  if (driAirTurf) driAirTurf.instanceMatrix.needsUpdate = true;
  if (driAirChip) driAirChip.instanceMatrix.needsUpdate = true;
}

/**
 * The banks go with the breath as one mass — they are the air, so they cannot
 * lag it — but at a twentieth of the speed, because a cumulus a hundred metres
 * across that visibly slides is a matte painting on rails. What actually reads
 * is the OPACITY: a bank thins as the wind gets into it and thickens in the
 * calm at the turn, which is the same fact the seed-fluff carries, said at the
 * scale of the sky.
 */
function driUpdateBanks(dt) {
  if (!driBankMesh) return;
  driBankMesh.position.x += driWindX * 0.05 * dt;
  driBankMesh.position.z += driWindZ * 0.05 * dt;
  // and it never wanders far: the drift is a texture, not a journey
  driBankMesh.position.x *= 1 - 0.06 * dt;
  driBankMesh.position.z *= 1 - 0.06 * dt;
  // The banks used to thin and thicken with the breath, which was an opacity
  // animation on a shared material — and driVC() hands back a cached one, so
  // writing on it would have taken the islands, the walls, the camps and the
  // far dressing with it. The wind is legible in the seed-fluff, the pennants
  // and the vane; the sky does not have to say it a fourth time.
}

// ==================================================================== SOUND ==
/**
 * THE TURN OF THE BREATH IS THE CHAPTER, AND IT MADE NO NOISE.
 *
 * Everything about the Drift is arranged round one fact: a gap you cannot
 * cross now, you can cross in twenty seconds. The wind swings all the way over
 * and back on a thirty-eight second cycle and the only way to know where in
 * that cycle you are was to watch the seed-fluff — which means the chapter's
 * central mechanic was legible in exactly one sense, in a chapter whose
 * ambience is deliberately the quietest in the game.
 *
 * So the sky says it. At the moment `swing` changes sign the whole archipelago
 * goes over: a single low bell, the pennants snap across, and the roost stirs
 * without flushing. It is the same event driCheckVane already watches for the
 * task, said out loud, once a cycle, and it costs one sign comparison.
 *
 * It is NOT positional — the turn is the air, and the air is everywhere. What
 * is positional is everything else in this block.
 */
let driBreathSign = 0;
let driTurnT = 999;

function driUpdateBreathSound(game, dt) {
  driTurnT += dt;
  const swing = Math.sin(driTime * 6.28318 / driBREATH);
  const sign = swing >= 0 ? 1 : -1;
  if (driBreathSign === 0) { driBreathSign = sign; return; }
  if (sign === driBreathSign) return;
  driBreathSign = sign;
  driTurnT = 0;
  // A bell nobody is ringing is already this chapter's ambient signature (see
  // systems.js, the drift branch). This is the same bell, lower and certain,
  // and it is the only sound in the biome that is always exactly on time.
  driSfx('chime', { volume: 0.30, pitch: 0.42, force: true });
  driSfx('rustle', { volume: 0.16, pitch: 0.55 });
  // ---- AND THE BIRDS NOTICE ---------------------------------------------
  // A stir, not a flush. The first cut of this only wound driRoostSettle back,
  // which does nothing at all: driUpdateRoost recomputes driRoostUp INSIDE
  // `if (driRoostUp > 0)`, so once the colony has settled that whole block is
  // dead and the settle clock is never read again. The flush amplitude is the
  // live variable and it has to be the one that is written.
  //
  // 0.30 with the clock at 4.6 puts every bird up about half a metre and back
  // down inside a second and a half — a shuffle along the stone, which is what
  // eleven birds actually do when the wind goes round, and nothing like the
  // full wheel a wheek buys.
  if (driRoostUp < 0.30) { driRoostUp = 0.30; driRoostSettle = 4.6; }
}

/**
 * THE COLUMNS, WHICH YOU COULD NOT HEAR UNTIL YOU WERE IN ONE.
 *
 * Three shafts of rising air, eight metres across, the only lift in the
 * chapter that is not a jump, and the way back up from anywhere you fall. They
 * announced themselves with a single hiss on the frame you ENTERED one — by
 * which time you had already found it. A column is a thing you should be able
 * to hear across a gap you are deciding whether to jump.
 *
 * Rationed by distance from the nearest one, which is the Sahara rule and the
 * only kind of positional this engine does: the biome computes the volume.
 */
let driColSoundT = 0;

function driUpdateColumnSound(game, dt) {
  driColSoundT -= dt;
  if (driColSoundT > 0) return;
  const p = game.capy && game.capy.position;
  if (!p) { driColSoundT = 1.5; return; }
  let best = 1e9, bi = -1;
  for (let i = 0; i < driCOLS.length; i++) {
    const c = driCOLS[i];
    // the horizontal distance to the shaft, and how far up its length you are:
    // a column is audible from beside it and from below it, and not at all
    // from a hundred metres above its top.
    const d = Math.hypot(p.x - c.x, p.z - c.z);
    const over = p.y > c.top ? p.y - c.top : 0;
    const dd = d + over * 1.6;
    if (dd < best) { best = dd; bi = i; }
  }
  if (bi < 0 || best > 62) { driColSoundT = rand(2.0, 3.5); return; }
  // It is quiet, and it gets quiet FAST — 62 m of reach on a chapter whose
  // islands are twenty apart means it is a hint about the island you are on
  // and never a hum over the whole sky.
  const v = clamp(0.15 * (1 - best / 62) * (1 - best / 62), 0.012, 0.15);
  driSfx('hiss', { volume: v, pitch: rand(0.62, 0.86) });
  driColSoundT = rand(1.6, 3.0);
}

/**
 * THE CAMPS, WHICH ARE THE ONLY PLACES IN THE CHAPTER WITH ANYBODY IN THEM.
 *
 * Six people on six islands, each doing one thing, and each of those things
 * makes a noise: a winch ratchets, a line goes out, somebody asleep breathes,
 * a vane creaks round, a pack gets sorted through. Every one of them is
 * rationed on the distance to that camp, so they arrive before the figure does
 * — which is the whole reason to have them. You hear the winch a jump before
 * you see the man.
 *
 * One at a time, on a long timer, and never while the player is more than
 * thirty metres from all of them: the chapter's ambience is mostly the sound
 * of nobody being there and that has to stay true between the islands.
 */
const driCAMP_SFX = ['tick', 'rustle', 'hiss', 'rustle', 'tick', 'rustle'];
const driCAMP_PITCH = [0.9, 1.25, 0.30, 1.05, 0.55, 1.4];
let driCampT = 3;

function driUpdateCampSound(game, dt) {
  driCampT -= dt;
  if (driCampT > 0) return;
  const p = game.capy && game.capy.position;
  if (!p) { driCampT = 3; return; }
  let best = 1e9, bi = -1;
  for (let i = 0; i < driTRAVELLERS.length; i++) {
    const t = driTRAVELLERS[i];
    const d = Math.hypot(p.x - t.x, p.z - t.z) + Math.abs(p.y - t.y) * 0.7;
    if (d < best) { best = d; bi = i; }
  }
  if (bi < 0 || best > 34) { driCampT = rand(3, 6); return; }
  const v = clamp(0.20 * (1 - best / 34), 0.02, 0.20);
  driSfx(driCAMP_SFX[bi], { volume: v, pitch: driCAMP_PITCH[bi] * rand(0.94, 1.06) });
  driCampT = rand(2.6, 6.5);
}

function driUpdateMotes(game, dt) {
  if (!driMoteMesh) return;
  const capy = game.capy;
  const p = capy && capy.position;
  const cx = p ? p.x : 0, cy = p ? p.y : 0, cz = p ? p.z : 0;
  const HX = 46, HY = 26;
  for (let i = 0; i < driMOTE_N; i++) {
    const o = i * 6;
    const dr = driMoteData[o + 5];
    driMoteData[o] += driWindX * dr * dt;
    driMoteData[o + 2] += driWindZ * dr * dt;
    driMoteData[o + 1] += Math.sin(driTime * 0.7 + driMoteData[o + 3]) * 0.35 * dt;
    driMoteData[o + 3] += dt * 0.8;
    let x = driMoteData[o], y = driMoteData[o + 1], z = driMoteData[o + 2];
    if (x - cx > HX) { driMoteData[o] = x = cx - HX; driMoteData[o + 1] = y = cy + rand(-HY, HY); }
    else if (cx - x > HX) { driMoteData[o] = x = cx + HX; driMoteData[o + 1] = y = cy + rand(-HY, HY); }
    if (z - cz > HX) { driMoteData[o + 2] = z = cz - HX; driMoteData[o + 1] = y = cy + rand(-HY, HY); }
    else if (cz - z > HX) { driMoteData[o + 2] = z = cz + HX; driMoteData[o + 1] = y = cy + rand(-HY, HY); }
    if (y - cy > HY) { driMoteData[o + 1] = y = cy - HY; }
    else if (cy - y > HY) { driMoteData[o + 1] = y = cy + HY; }
    const s = driMoteData[o + 4];
    driMoteMesh.setMatrixAt(i, driXform(x, y, z, driMoteData[o + 3], driMoteData[o + 3] * 0.7, 0, s, s, s));
  }
  driMoteMesh.instanceMatrix.needsUpdate = true;
}

function driUpdateColumnMotes(dt) {
  if (!driColMesh) return;
  for (let i = 0; i < driCOLM_N; i++) {
    const o = i * 5;
    const c = driCOLS[driColData[o] | 0];
    driColData[o + 2] += dt * (0.055 + driColData[o + 4] * 0.06);
    if (driColData[o + 2] > 1) driColData[o + 2] -= 1;
    const u = driColData[o + 2];
    const y = lerp(c.base, c.top, u);
    const a = driColData[o + 1] + u * 7.0;
    const rr = c.r * driColData[o + 3] * (0.35 + 0.65 * (1 - u * 0.55));
    const s = driColData[o + 4] * (1 - u * 0.35);
    driColMesh.setMatrixAt(i, driXform(c.x + Math.cos(a) * rr, y, c.z + Math.sin(a) * rr,
                                       a, a * 1.3, 0, s, s, s));
  }
  driColMesh.instanceMatrix.needsUpdate = true;
}

function driUpdatePennants() {
  if (!driPennantMesh) return;
  const wa = Math.atan2(driWindX, driWindZ);
  const spd = Math.hypot(driWindX, driWindZ) / driWIND_MAX;
  for (let f = 0; f < driPENNANTS.length / 3; f++) {
    const px = driPENNANTS[f * 3], py = driPENNANTS[f * 3 + 1], pz = driPENNANTS[f * 3 + 2];
    for (let k = 0; k < driPEN_SEG; k++) {
      const t = (k + 0.5) / driPEN_SEG;
      const ph = driTime * 3.1 - t * 3.4 + f * 1.9;
      const amp = spd * t * t;
      const run = t * 2.2 * (0.25 + spd * 0.75);
      driPennantMesh.setMatrixAt(f * driPEN_SEG + k, driXform(
        px + Math.sin(wa) * run, py - (1 - spd) * t * 0.9, pz + Math.cos(wa) * run,
        0, wa + Math.sin(ph) * amp * 0.55, Math.sin(ph * 1.2) * amp * 0.3,
        1, 1, 1));
    }
  }
  driPennantMesh.instanceMatrix.needsUpdate = true;
}

function driUpdateWisps(dt) {
  if (!driWispMesh) return;
  for (let i = 0; i < driWISP_N; i++) {
    const o = i * 5;
    driWispData[o] += driWindX * driWispData[o + 4] * dt;
    driWispData[o + 2] += driWindZ * driWispData[o + 4] * dt;
    if (driWispData[o] > 240) driWispData[o] -= 480;
    else if (driWispData[o] < -240) driWispData[o] += 480;
    if (driWispData[o + 2] > 180) driWispData[o + 2] -= 480;
    else if (driWispData[o + 2] < -300) driWispData[o + 2] += 480;
    const s = driWispData[o + 3];
    driWispMesh.setMatrixAt(i, driXform(driWispData[o], driWispData[o + 1], driWispData[o + 2],
                                        0, i * 0.7 + driTime * 0.01, 0, s, s * 0.22, s * 0.72));
  }
  driWispMesh.instanceMatrix.needsUpdate = true;
}

function driUpdateRibbons(dt) {
  const lvl = 0.12 + driGlow * 0.88;
  for (let i = 0; i < driRibbons.length; i++) {
    const c = driRibbons[i];
    c.phase += c.speed * dt;
    const a = c.attr.array, b = c.base;
    for (let k = 0; k < a.length; k += 3) {
      const s = Math.sin(b[k] * c.wave + c.phase);
      a[k + 1] = b[k + 1] + s * c.amp * (b[k + 1] > 34 ? 0.5 : 1);
      a[k + 2] = b[k + 2] + Math.cos(b[k] * c.wave * 0.7 + c.phase * 1.3) * c.amp * 0.4;
    }
    c.attr.needsUpdate = true;
    c.mesh.material.opacity = c.peak * lvl;
  }
}

// ==================================================================== HINTS ==
/**
 * THREE LINES, AND ONLY EVER ONCE EACH. A chapter whose verbs are all new needs
 * to say so; a chapter that keeps saying so is a tutorial. Each of these fires
 * on the first frame the player is in a position for it to be USEFUL rather
 * than at some point on a timer.
 */
function driUpdateHints(game, dt) {
  const capy = game.capy;
  const p = capy && capy.position;
  if (!p) return;
  if (!driHintPuff && !driPuffDone && !capy.grounded && capy.body && capy.body.velocity.y < -1.2 &&
      p.y > 1.5 && driAirT > 0.5) {
    driHintPuff = true;
    driToast('WHEEK on the way down. go on.');
  }
  if (!driHintWind && driPuffDone && Math.abs(driWindX) + Math.abs(driWindZ) > driWIND_MAX * 1.2) {
    driHintWind = true;
    driToast('the air is going somewhere. it will turn round in a bit.');
  }
}

// ==================================================================== BUILD ==
function driBuild(game) {
  if (driBuilt) return;
  driBuilt = true;
  driInitGeos();

  driRoot = new THREE.Group();
  driRoot.name = 'drift';
  game.scene.add(driRoot);

  driBuildCloud(driRoot);
  driBuildBanks(driRoot);
  driBuildIslands(game, driRoot);
  driBuildRoots(driRoot);
  driBuildWanderers(game, driRoot);
  driBuildFlora(driRoot);
  driBuildGroundCover(driRoot);
  driBuildWalls(game, driRoot);
  driBuildFarDressing(game, driRoot);
  driBuildColumnMarks(game, driRoot);
  driBuildAirfield(driRoot);
  driBuildShelf(game, driRoot);
  driBuildArch(game, driRoot);
  driBuildPuffRing(driRoot);
  driBuildLantern(game, driRoot);
  driBuildColumnMotes(driRoot);
  driBuildSeeds(driRoot);
  driBuildMotes(driRoot);
  driBuildBloom(driRoot);
  driBuildWisps(driRoot);
  driBuildLampflies(driRoot);
  driBuildSkein(driRoot);
  driBuildSky(driRoot);
  driBuildKeepers(game, driRoot);
  driBuildCamps(game, driRoot);
  // LAST: every mark in the chapter has registered itself by now.
  driBuildRoost(driRoot);
  driBuildBeacons(driRoot);

  // ---- AND THERE ARE TWO PEOPLE UP HERE -----------------------------------
  // Nine chapters in, this was the only place in the game with nobody in it at
  // all — deliberately, because the premise is that the ground came off and
  // took everything with it. But the chapter is FULL of somebody: a lamp still
  // burning on the Shelf, a bench facing the drop, a jetty, a pond, two carved
  // posts on the lips of the Long Gap and a nine-metre paper lantern on the
  // Crown that somebody used to light. Nobody built any of that and left.
  //
  // So: two, and only two, and both of them at the far end. You cross an
  // entire empty sky on your own — the solitude is the first two thirds of the
  // chapter and it stays — and then, on the two islands the list actually
  // sends you to, there is somebody. It is the same rule Venice uses: nobody
  // is a detour. See npc.js, THE LOCALS.
  if (typeof game.addLocal === 'function') {
    // ON THE ORCHARD, with the lampflies. She is the reason there are forty-six
    // of them and the reason six of them is the number.
    game.addLocal({ biome: 'drift', x: driORCH_KEEP.x, y: driORCH_KEEP.y, z: driORCH_KEEP.z,
      near: 8, face: 2.3,
      figure: { shirt: PALETTE.driLampGlow, legs: PALETTE.driBark, hat: PALETTE.driPaper },
      lines: ['They sleep in the day. There is no day. They sleep anyway.',
              { t: 'Shout at one and it wakes. Shout at six and you can go on.',
                before: 'lampfly' },
              'Do not carry them. They come if they want to come.',
              'The wind was southerly for eleven years. Then it was not.',
              // she counts them out loud while you are collecting, which is the
              // only progress read the task has outside the card
              { t: 'Six. That will do it. Take them up and do not look back at me.',
                when: function () {
                  return !!(driGame && driGame.drift && !driGame.taskDone('lampfly') &&
                            driGame.drift.lampflies() >= driGame.drift.lampfliesNeeded);
                } },
              { t: 'Two so far. Keep going, they are all out there.',
                when: function () {
                  const d = driGame && driGame.drift;
                  return !!(d && d.lampflies() > 0 && d.lampflies() < d.lampfliesNeeded);
                } },
              { t: 'You have got them all up. They will not settle for an hour now.',
                after: 'lampfly' },
              { t: 'It is lit. I can stop counting. Eleven years I have been counting.',
                when: function () { return !!(driGame && driGame.drift && driGame.drift.lit() > 0.4); } }],
      wheek: ['There. That is the noise. Do it at the pale ones.',
              'Every one of them heard that. Two of them cared.',
              { t: 'Not at me. At THEM. They are the ones with the lights on.',
                before: 'lampfly' }],
      onTask: { 'lampfly': ['All six. In one go. Nobody does it in one go.',
                            'Look at them. Look at what you have started.'],
                'lantern': ['Oh — oh, that is what they were FOR.'],
                'updraft': ['You came up the column. Everything comes up the column.'] },
      praise: ['Careful. Half of what is up here is asleep.'] });
    // ON THE CROWN, beside the lantern, and this is the last thing in the
    // chapter. Nine tasks of absolute solitude and then somebody says hello.
    // BESIDE the bench, not behind it. driCROWN_KEEP is where the FURNITURE is
    // anchored and the bench back is 60 cm of dark timber standing exactly
    // between that point and anyone walking up from the plinth — measured off
    // the rendered frame, she was a pale column with a head on it.
    game.addLocal({ biome: 'drift', x: driCROWN_KEEP.x - 2.2, y: driCROWN_KEEP.y,
      z: driCROWN_KEEP.z - 2.0, near: 9, face: -1.9,
      figure: { shirt: PALETTE.driPaper, legs: PALETTE.driTimber },
      lines: [{ t: 'I light it when there are enough of them. There are never enough of them.',
                before: 'lantern' },
              'You came the long way. Everybody comes the long way. There is no other way.',
              { t: 'It is not for anybody. It is just the last lit thing before the dark bit.',
                before: 'lantern' },
              'Sit down. The breath turns in about twenty seconds and you will want to see it.',
              { t: 'You have got six of them with you. Go on then. Go on.',
                when: function () {
                  return !!(driGame && driGame.drift && !driGame.taskDone('lantern') &&
                            driGame.drift.lampflies() >= driGame.drift.lampfliesNeeded);
                } },
              { t: 'You are two short. They are down in the orchard, in the pale trees.',
                when: function () {
                  const d = driGame && driGame.drift;
                  return !!(d && !driGame.taskDone('lantern') &&
                            d.lampflies() < d.lampfliesNeeded);
                } },
              { t: 'There. Now every island in the world can see this one.', after: 'lantern' },
              { t: 'Look south. They are all coming up. One at a time, look.', after: 'lantern' },
              { t: 'Stay as long as you like. The plinth is the way down when you want it.',
                after: 'lantern' }],
      wheek: ['I know. I heard you three islands ago.',
              'Careful. Half of what is up here is only up here out of politeness.',
              { t: 'That is the second loudest thing that has ever happened up here.',
                after: 'lantern' }],
      onTask: { 'lantern': ['Nine metres of paper and a rodent.',
                            'Eleven years. Eleven years and it took you an afternoon.'],
                'lampfly': ['Six. Bring them here. Straight here, do not stop.'],
                'long-gap': ['I watched that from the bench. I could not look.'],
                'driftseed': ['You came the SLOW way. Hardly anybody finds the slow way.'] },
      praise: ['Mm. Sit down, you are making the place untidy.'] });
    // ---- AND THE SIX WHO ARE ALSO WAITING ---------------------------------
    // See driTRAVELLERS. Registered here, inside the biome's own build, so the
    // capture in main.js tags every figure to chapter nine and detaches it with
    // the rest — a local registered outside a build follows the player around
    // the world for ever.
    //
    // Their `lines` arrays are handed over BY REFERENCE and driUpdateTravellers
    // writes into the wind-reader's, which is the whole point of her.
    for (let i = 0; i < driTRAVELLERS.length; i++) {
      const t = driTRAVELLERS[i];
      driTravRecs[t.id] = game.addLocal({
        biome: 'drift', x: t.x, y: t.y, z: t.z, near: t.near, face: t.face,
        figure: t.figure, lines: t.lines, wheek: t.wheek });
    }
  }

  if (typeof game.registerShadowTarget === 'function') game.registerShadowTarget(driRoot);
  // ...and then take it back off the things that must never have had it.
  driNoShadowOnGhosts(driRoot);
  if (driSeedMesh) driSeedMesh.castShadow = false;
}

// =============================================================== LIFECYCLE ===
export function createDrift(game) {
  driGame = game;

  game.biome.register('drift', {
    ensureBuilt() { driBuild(game); },
    /**
     * GRAVITY IS THE CHAPTER, so it is set here rather than faked per-body: one
     * number, and every loose prop, every hop and every fall in the biome gets
     * the same physics the capybara does. It is put back on the way out — a
     * world that stays at a third of a g after you have left it would make the
     * Opera House steps unclimbable in a way nobody would ever diagnose.
     */
    onEnter() {
      if (game.world && game.world.gravity) {
        driPrevGravity = game.world.gravity.y;
        game.world.gravity.y = driGRAVITY;
      }
      driPuffReady = true; driAirT = 0; driPuffT = 0;
      driInCloud = 0; driBloomOn = false; driBloomT = 0;
      driFlightOn = false; driWasGrounded = true;
      driRideT = 0; driRideId = ''; driColIdx = -1;
      driWasGrounded = true;
      // ---- AND THE ENDING DOES NOT PLAY TWICE -----------------------------
      // driLit is one of the few flags in this file that is MEANT to survive
      // travel — the lantern stays lit, and it should. driAnswerTheLantern
      // hangs its whole twenty-two second sequence off driAnswerT, which is
      // reset state; come back to the Drift after finishing it and the horizon
      // relights itself from scratch, twenty-six chimes and all, while you are
      // standing on the Shelf two hundred metres away. Snap it to done instead.
      // Same class exactly as the seed index below: a value armed for a moment
      // that outlives the moment.
      if (driLit) {
        driAnswerT = 999;
        driAnswerLit = driFARLAMP.length / 3;
        if (driFarLampMat) driFarLampMat.opacity = 0.68;
      }
    },
    onExit() {
      // ARMED FLAGS DO NOT SURVIVE TRAVEL. Every biome shares one coordinate
      // space, and a latch left set is a task that ticks in the wrong country.
      driVaneSign = 0; driVaneT = 0; driVaneWatch = 0; driVaneSlack = 0;
      if (game.world && game.world.gravity) game.world.gravity.y = driPrevGravity || -24;
      driBloomOn = false;
      driFlightOn = false;
      driRideT = 0; driRideId = '';
      // ---- AND THE SEED. It was not on this list ---------------------------
      // driSeedHeld is an index, not a flag, and nothing cleared it: travel
      // while holding a seed-head and the animal arrives in the next chapter
      // still "holding" one. The consequences are all on the way BACK — the
      // held seed snaps to the capybara's head on the first frame of the next
      // visit, the vertical velocity clamp that stops you falling is live
      // before you have caught anything, and driSeedRide carries whatever
      // distance was banked before you left, so `driftseed` (fifty metres
      // carried) can tick from a walk you took in Venice. Same class exactly as
      // the acrobats' throw in chapter 8 and Iceland's geyser ride: an armed
      // latch that does not survive travel because it is never told not to.
      if (driSeedHeld >= 0) driSeedRespawn(driSeeds[driSeedHeld], driSeedHeld);
      driSeedHeld = -1; driSeedRide = 0; driSeedCool = 0;
      driRingT = -1; driInCloud = 0; driWhoopT = -1;
      driRoostUp = 0; driRoostSettle = 0;
      driColWas = false; driColRing = 0;
    },
  });

  const api = {
    built() { return driBuilt; },
    terrainHeight: driTerrain,
    /**
     * WHAT THE ISLAND UNDER (x, z) IS MADE OF — green, bare or pale, or null
     * over open air. The footfall ladder in capybara.js had one hard-coded
     * rectangle for the jetty and gave the other twenty-nine islands grass;
     * the kinds have been in driISLES since the archipelago was laid out and
     * nothing outside this file could read them.
     */
    islandKind(x, z) { const s2 = driIslandAt(x, z); return s2 ? ((s2.def || s2).kind || null) : null; },
    slopeAt: driSlope,
    waterLevel: driCLOUD_Y,
    isOverWater: driIsOverWater,
    waterHeightAt: driSurfaceY,
    inZone: driInZone,
    navBlocked: driNavBlocked,
    SPAWN: driSPAWN,

    /**
     * THE AIR ITSELF MOVES. capybara.js reads this as the velocity of the
     * parcel of air the animal is in and solves everything else relative to it
     * — the identical treatment the ferry deck gets, which is why it is exempt
     * from the speed cap and why the transition on landing is seamless: the
     * world velocity is continuous across the frame the frame changes.
     */
    wind() {
      driWindOut.x = driWindX * driShelter;
      driWindOut.z = driWindZ * driShelter;
      return driWindOut;
    },
    /** The weather, not what you personally are feeling — the HUD wants this one. */
    windSpeed() { return Math.sqrt(driWindX * driWindX + driWindZ * driWindZ); },
    /** Read by capybara.js: nearly twice the airborne steering of anywhere else. */
    airControl: driAIR_CTRL,
    gravity: driGRAVITY,

    lit() { return driLit; },
    glow() { return driGlow; },
    lampflies() { return driFliesAwake; },
    lampfliesNeeded: driFLIES_NEED,
    puffReady() { return driPuffReady; },
    /** The seeds MOVE — ask, never cache. */
    seed() { return driSeedPos; },
    onSeed() { return driSeedHeld >= 0; },
    seedRide() { return driSeedRide; },
    /**
     * HOW FAR THE CAMERA SHOULD CRANE UP. Full for the twelve seconds after the
     * lantern takes, because the payoff of the chapter is a sky and the rig
     * cannot see the sky at its working pitch; then a third, permanently,
     * because from then on the ribbons ARE the lighting and they should stay in
     * the top of the picture. See CONTRACT.md, "the sky is never in the frame".
     */
    skyward() {
      if (!driLit) return 0;
      return driLitT > 0 ? 1 : 0.36;
    },

    // landmarks, for the task beacons
    shelf: { x: 0, z: 30 },
    jetty: driJETTY,
    lamp: driLAMP,
    column: { x: driCOLS[0].x, z: driCOLS[0].z },
    column2: { x: driCOLS[1].x, z: driCOLS[1].z },
    orchard: { x: -38, z: -114 },
    arch: { x: 10, z: -109 },
    crown: { x: driLANTERN.x, z: driLANTERN.z },
    lantern: driLANTERN,
    /** The weathervane on the spawn island: the chapter's only instrument. */
    vane: { x: driVANE.x, z: driVANE.z },
    /** > 0 while the animal is standing at the post, in seconds. */
    vaneWatch() { return driVaneWatch; },
    /** Seconds until the breath next goes slack — the task card counts it down. */
    vaneToTurn() { return driSecondsToTurn(); },
    /** The wanderers MOVE — ask, never cache. */
    wanderer() {
      const m = driMovers[0];
      return m ? { x: m.x, z: m.z } : { x: 0, z: -70 };
    },

    update(dt) {
      if (!driBuilt) return;
      if (!game.biome.isActive('drift')) return;
      driTime += dt;

      driUpdateWind(dt);

      // the cloud breathes
      driRipT += dt;
      if (driRipT >= 0.0333) {
        driRipT = 0;
        if (driCloudAttr) {
          const a = driCloudAttr.array;
          // ---- AND THE SEA ANSWERS WHEN IT CATCHES YOU --------------------
          // 'handed-back' is the promise the whole chapter rests on: falling
          // off is not a punishment, and the cloud gathers under you and gives
          // you back. The bloom draws that with twenty-six puffs a few metres
          // across — right at the animal, and completely invisible from twenty
          // metres away or from anywhere above. This is a SEA. When something
          // that large decides to do something, the surface of it moves: a ring
          // running out from the point, on the mesh that is already being
          // rewritten every other frame, for four multiplies a vertex.
          const bl = driBloomOn ? clamp(driBloomT / driBLOOM_LIFE, 0, 1) : 0;
          const bAge = driBLOOM_LIFE - driBloomT;
          for (let i = 0; i < a.length; i += 3) {
            let y = driCLOUD_Y + Math.sin(a[i + 2] * 0.035 + driTime * 0.33) * 0.55
                               + Math.sin(a[i] * 0.021 - driTime * 0.21) * 0.35;
            if (driWhoopT >= 0) {
              // the same shape as the bloom's crest, half the height and twice
              // the reach: a shout goes further than a body does
              const wx = a[i] - driWhoopX, wz = a[i + 2] - driWhoopZ;
              const wd = Math.sqrt(wx * wx + wz * wz);
              const front = driWhoopT * 13.0;
              const ww = Math.exp(-Math.abs(wd - front) * 0.075) * Math.exp(-wd * 0.007) *
                         clamp(1 - driWhoopT / driWHOOP_LIFE, 0, 1);
              y += Math.sin((wd - front) * 0.26) * ww * 2.3;
            }
            if (bl > 0) {
              const dx = a[i] - driBloomX, dz = a[i + 2] - driBloomZ;
              const d = Math.sqrt(dx * dx + dz * dz);
              // one crest, travelling out at nine metres a second and dying
              // with distance, so it never reaches the horizon and never tiles
              const w = Math.exp(-Math.abs(d - bAge * 9.0) * 0.10) * Math.exp(-d * 0.012);
              y += Math.sin((d - bAge * 9.0) * 0.30) * w * 2.6 * bl;
            }
            a[i + 1] = y;
          }
          driCloudAttr.needsUpdate = true;
        }
      }

      // THE SKY RIDES WITH THE ANIMAL — see driBuildSky. Unlike Iceland's, this
      // rig tracks Y as well, and it has to: the playable world is a hundred and
      // ten metres tall, so a moon hung at a fixed sixty-eight would be high in
      // the sky from the Shelf and UNDER YOUR FEET from the Crown. Tracking all
      // three axes keeps it at one elevation from everywhere, and at three
      // hundred metres out nothing about the parallax is detectable.
      if (driSkyRig && game.capy && game.capy.position) {
        driSkyRig.position.copy(game.capy.position);
      }
      // the vane reads the wind, and it is the only instrument in the chapter
      if (driVaneGroup) driVaneGroup.rotation.y = Math.atan2(driWindX, driWindZ);

      driUpdateWanderers(game, dt);
      driUpdatePuff(game, dt);
      driUpdatePuffRing(dt);
      driCheckVane(game, dt);
      driCheckHand(game);
      driUpdateSkein(game, dt);
      driUpdateColumns(game, dt);
      driUpdateSeeds(game, dt);
      driUpdateCloud(game, dt);
      driUpdateFlight(game, dt);
      driUpdateLampflies(game, dt);
      driUpdateLantern(game, dt);
      driSyncBloom(game);
      driUpdateMotes(game, dt);
      driUpdateAirfield(game, dt);
      driUpdateBanks(dt);
      driAnswerTheLantern(dt);
      driUpdateBreathSound(game, dt);
      driUpdateColumnSound(game, dt);
      driUpdateCampSound(game, dt);
      driUpdateTravellers(dt);
      driUpdateColumnMotes(dt);
      driUpdateWisps(dt);
      driUpdatePennants();
      driUpdateRoost(game, dt);
      driUpdateBeacons(dt);
      // the croft hearth breathes on its own clock, slower than a flame and
      // faster than nothing, because it is embers and not fire
      if (driHearthPool) {
        driHearthPool.material.opacity = 0.20 +
          Math.sin(driTime * 1.35) * 0.045 + Math.sin(driTime * 0.51 + 1.9) * 0.035;
      }
      driUpdateRibbons(dt);
      driUpdateHints(game, dt);
    },
  };
  game.drift = api;
  return api;
}
