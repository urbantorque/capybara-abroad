import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PALETTE, mat, TASKS, rand, randInt, clamp, damp, dampAngle, lerp, grain, swayMesh, leafMesh, makeMerger, mergeWearBand, warnOnce, skyDomeLit } from './shared.js';

// ===========================================================================
// AGENT A — ENVIRONMENT.  Sydney as low-poly stage dressing.
// Everything top-level is prefixed `env`.
// ===========================================================================

// Base multipliers for the vertex-coloured materials. shared.js has no neutral
// white, so instead of hardcoding one we take the two brightest PALETTE values
// and pre-divide every vertex colour by the base (envDeTint). base * (c/base)
// reproduces the intended PALETTE colour exactly, and no hex lives in this file.
const envVC_BASE  = PALETTE.foam;   // cool white — ground, water, sky, architecture
const envVC_BASE2 = PALETTE.sail;   // warm cream — the sails and the ground decals
const envBaseA = new THREE.Color(envVC_BASE);
const envBaseB = new THREE.Color(envVC_BASE2);

function envDeTint(c, base) {
  c.r = c.r < base.r ? c.r / base.r : 1;
  c.g = c.g < base.g ? c.g / base.g : 1;
  c.b = c.b < base.b ? c.b / base.b : 1;
  return c;
}

// ---------------------------------------------------------------- scratch --
const envV3    = new THREE.Vector3();
const envSc    = new THREE.Vector3();
const envQ     = new THREE.Quaternion();
const envEu    = new THREE.Euler(0, 0, 0, 'YXZ');
const envM     = new THREE.Matrix4();
const envCol   = new THREE.Color();
const envColA  = new THREE.Color();
const envColB  = new THREE.Color();

// ------------------------------------------------------------ module state --
let envGroundPhysMat = null;
let envWaterAttr = null;
let envCloudMesh = null;
let envCloudData = null;
let envTime = 0;
let envRippleT = 0;
let envAsleep = false;   // true once Sydney's update has parked itself for Pasto
// 0..1, how long the animal has been on the Opera House podium. The grade layer
// reads it through api.stageGlow(). Zeroed on the way out — see envUpdate.
let envStageT = 0;
// THE SECOND ASK (L6, F2): two led ibis on the podium with you, held a
// second so a bird trailing through the zone on its way past does not tick.
let envIbisParadeT = 0, envIbisParadeDone = false;
// ---- THE CONCERT (W1) -------------------------------------------------------
// The marquee was "stand on the podium for five seconds". It is now: get up
// on the podium and WHEEK, and the forecourt comes. Each wheek from the stage
// is a note — the sails pulse, the house is called on the first — and at
// envCONCERT_NOTES notes with envCONCERT_HOUSE people actually in place the
// house cheers, three of them photograph it, and the task ticks. Leaving the
// stage for envCONCERT_LEAVE seconds ends the concert and sends everybody back
// to their afternoon; the count starts again next time.
const envCONCERT_NOTES = 3;
const envCONCERT_HOUSE = 2;
const envCONCERT_LEAVE = 8;
let envConcertOn = false;
let envConcertNotes = 0;
let envConcertOff = 0;       // s off the stage while a concert is on
let envStagePulse = 0;       // 0..1, decays; a wheek from the stage lights the sails
let envConcertDone = false;  // this concert has paid out (the tick is idempotent; this gates the cheer)
// ---- THE HOUSE IS THE NUMBER (L4 E4) ---------------------------------------
// The marquee ticked at two listeners and stopped counting. The forecourt can
// send eight (npcCONCERT_N), and how many of them a wheek from the stage
// actually pulls over depends on who was within reach when the first note
// went — so the peak of the house IN PLACE, per concert, is the record. On the
// paper every frame the concert is on (recordLive), filed ONCE when the concert
// ends, whichever way it ends: the leave timer, or travel. Never per frame —
// see the record-spam note in the RECORDS table.
let envConcertPeak = 0;
function envConcertFile(game) {
  if (envConcertPeak > 0 && game && typeof game.record === 'function') {
    game.record('opera-stage', envConcertPeak);
  }
  envConcertPeak = 0;
}
// ---- THE ENCORE (L5) --------------------------------------------------------
// The house cheered and that was the end of it. For eight seconds after the
// cheer the stage is still yours: one more wheek with the house still there
// is the encore — a longer cheer, every camera in the crowd, confetti off the
// podium, and the score all the way up. Once per concert.
const envENCORE_WIN = 8;
let envEncoreT = 0, envEncoreDone = false;
// ---- THE HARBOUR ANSWERS (L5) ------------------------------------------------
// A note from the stage was a pulse on the sails and a count. Now it is a
// call, and things answer it a beat later: the house in place cheers back
// (scaled to how many are there — two people is two people), the ferry
// sounds her horn on the second note if she is in the harbour, and every
// note calls WIDER (game.concert.call takes the note number), so a podium
// with nobody near it is a podium whose third wheek reaches the quay. The
// state with nobody in reach is SAID now, on the paper and in the toast.
//
// THE ENCORE is the harbour's: the world at half speed, the lens from the
// opera shot with the house in the foreground, seven shells over the water
// behind the sails, and the sails held lit for ten seconds.
const envANSWER_LAG = 0.55;    // s between the note and the house's answer
const envENCORE_SHELLS = 7;
let envAnswerT = -1;           // countdown to the answer, -1 idle
let envAnswerNote = 0;
let envEncoreFwT = 0, envEncoreFwNext = 0, envEncoreFwN = 0, envEncoreGlowT = 0;
function envFireworkStep(game, dt) {
  if (envEncoreGlowT > 0) envEncoreGlowT -= dt;
  if (envEncoreFwN <= 0) return;
  envEncoreFwNext -= dt;
  if (envEncoreFwNext > 0) return;
  envEncoreFwNext = 0.42 + Math.random() * 0.3;
  envEncoreFwN--;
  if (typeof game.firework !== 'function') return;
  // over the harbour, north of the sails, high enough to clear them from the
  // forecourt: the sails' tallest tip is 11.6 m
  const fx = -34 + Math.random() * 68, fz = -34 - Math.random() * 22, fy = 15 + Math.random() * 9;
  const pal = [[2.4, 1.2, 0.7], [2.4, 1.9, 0.8], [1.2, 1.6, 2.4], [2.2, 1.0, 1.6]];
  game.firework(fx, fy, fz, { n: 56, size: 1.5, spd: 10, rgb: pal[envEncoreFwN % pal.length] });
}

// ---- Circular Quay (chapter 1) -----------------------------------------------
const envCafeTables = [];     // {x, z, top} — climbable café tables
const envPerches = [];        // {x, y, z} — bollard tops, rails, lamp caps, for gulls
const envSprinklers = [];     // published records, see envMakeSprinkler
let envSprayMesh = null;      // one InstancedMesh, the fan of water dashes
let envSprayAng = 0;          // rotor sweep phase, advanced in envSprayStep

// Sprinkler placement: x, z, and the compass angle the fan sweeps about
// (atan2(dz, dx) convention). Both sit on the lawn edge beside the promenade
// path, so a tourist walking the quay strolls straight through the arc.
const envSPRINK_SPOTS = [-21.0, 1.2, 2.60, -29.6, -5.0, -0.55];
const envSPRINK_REACH = 3.25;   // metres of throw
const envSPRINK_BURST = 12.0;   // seconds the valve stays open after a nudge
const envSPRINK_WET   = 0.92;   // how wet standing in it gets you — see soaking()
const envSPRAY_JETS  = 3;       // dashes fanned across the arc
const envSPRAY_SEGS  = 9;       // dashes along each ballistic jet
const envSPRAY_FAN   = 0.30;    // radians between adjacent jets
const envSPRAY_SWEEP = 1.05;    // half-angle of the rotor's back-and-forth
const envSPRAY_LIFT  = 0.62;    // apex of the arc above the nozzle

let envFerry = null;          // published record
let envFerryGroup = null;
let envFerryBody = null;
let envFerryLeg = 0;          // index of the node we are travelling TOWARD
let envFerryT = 0;            // seconds into the current leg
let envFerryPX = 0, envFerryPZ = 0;   // previous TARGET — see envUpdateFerry

let envFerryDwell = 0;        // seconds left of the dwell at the node we reached
let envFerryYaw = Math.PI;
const envFerryPos = new THREE.Vector3();

// The ferry's circuit. Five numbers per node:
//   x, z, seconds to travel here from the previous node, dwell on arrival,
//   astern (1 = she reverses along this leg and keeps the heading she had).
// Node 0 is the berth alongside the wharf; she lies bow-south (yaw ~ PI) there,
// which puts her PORT side — and the gangway gap in the bulwark — against the
// wharf edge at x = -43.5. Double-ended, so backing out is not a manoeuvre, it
// is just Tuesday.
const envFERRY_NODES = [
  -45.8, -19.0, 7.0, 20.0, 0,
  -46.8, -31.0, 5.0,  0.0, 1,
  -58.0, -39.0, 6.0,  0.0, 0,
  -71.0, -32.0, 6.0,  0.0, 0,
  -66.0, -22.0, 5.0,  0.0, 0,
  -47.0, -31.5, 7.0,  0.0, 0,
];
const envFERRY_N = envFERRY_NODES.length / 5;
const envFERRY_DECK_HX = 2.10;
const envFERRY_DECK_HZ = 5.30;
const envFERRY_DECK_Y  = 0.34;
// She is double-ended, so "bow" is a fiction: local +z is simply the A end and
// every heading is derived from the leg direction (reversed on an astern leg).
// Ferry scratch — allocated once, reused by onBoard() every frame.
const envFerryTmp  = new THREE.Vector3();
const envFerryQt   = new THREE.Quaternion();
const envFerryGang = new THREE.Vector3();
let envFerryDocked = false;
let envFerryVoyage = false;   // 'ferry:departed' already emitted for this trip

// ---------------------------------------------------------- MR WHIPPY -------
// A soft-serve van doing laps of the promenade path, and the one thing in the
// Botanic Gardens that is BOTH ambience and a task. It exists for two reasons
// that are really the same reason: Sydney had one moving object in it (the
// ferry, which is forty metres offshore), so the gardens themselves never
// changed while you stood in them; and eighteen tasks in chapter 1 were all
// some version of 'take a thing off a person'.
//
// The route is envPATHS[1] — the promenade path the game already draws, run
// east to west and back — so the van is on a road that was there before it was,
// and everything it passes was placed to be walked past.
const envVAN_ROUTE = [-2.0, 7.6, -9.0, 7.0, -15.0, 4.2, -20.5, 0.4, -26.0, -2.6,
                      -34.0, -4.6, -44.0, -5.4, -54.0, -4.6, -61.0, -3.3];
const envVAN_SPEED = 3.15;    // m/s. A van on a footpath, not a getaway.
// Her engine (A1), and the damped throttle behind it — she has no gearbox, so
// the ramp between parked and rolling is made here or it does not exist.
let envVanMover = null, envVanThr = 0;
// s parked at each end. EIGHT WAS TOO SHORT FOR THE THING IT IS FOR. The
// boarding window is the whole point of the stop — you have to get round to
// the port side, up onto the counter and onto the roof from a standing start —
// and eight seconds meant a missed step cost you a full lap of the promenade.
// It is also the window a queue has to form in; see npc.js's vanQueueOpen.
// Nothing about the ride itself changes: the twelve seconds on the roof only
// count while she is ROLLING.
const envVAN_DWELL = 11.0;
const envVAN_RIDE  = 12.0;    // s on the roof that count as 'the length of it'
const envVAN_HX = 1.02;       // half-width
const envVAN_HZ = 2.35;       // half-length (local +z is the front)
const envVAN_ROOF = 1.98;     // m — the deck you ride on
const envVAN_HATCH = 1.06;    // m — the serving counter, and the step up
const envVAN_CHIME = 5.4;     // s between chimes while she is rolling
let envVanGroup = null;
let envVanBody = null;
let envVanCone = null;        // the cone on the roof, which leans into the turns
let envVanU = 0;              // metres travelled along the route
let envVanDir = 1;            // +1 east->west, -1 back
let envVanDwell = envVAN_DWELL;
let envVanYaw = 0;
let envVanPX = 0, envVanPZ = 0;
let envVanChimeT = 0;
let envVanRideT = 0;      // s the capybara has been continuously on the roof
let envVanRideM = 0;      // metres of route covered on this one ride
let envVanRode = false;       // 'whippy-run' already ticked
const envVanPos = new THREE.Vector3();
const envVanTmp = new THREE.Vector3();
const envVanQt  = new THREE.Quaternion();
const envVanLen = [];         // cumulative arc length of envVAN_ROUTE

// ---- Circular Quay (chapter 1): the expansion, x [-46,-14] z [-10,10] ---------
// The boardwalk is one 0.17 rise above the paving — the same tread height the
// podium stair uses, which is the largest step the capybara reliably walks up —
// and it sits flush with the ferry wharf deck so the two read as one structure.
const envQUAY_DECK_Y = 0.17;
const envQUAY_Z0 = -9.90;     // seaward edge of the boardwalk
const envQUAY_Z1 = -7.40;     // landward edge (clear of the z = -7 lamp line)
// x0, x1, and the x span where the railing is BROKEN (0,0 for none). The west
// run's break is the wharf mouth: the boardwalk deck runs straight on across it
// and meets the wharf planking at the same 0.17, but a railing there would fence
// the ferry off and 'ferry-ride' would be unreachable.
const envQUAY_RUNS = [[-46.4, -34.2, -44.3, -35.7], [-19.6, -14.0, 0, 0]];
// Between the two runs sit the existing beach ramp (x -32..-24) and the new
// water stair, so the boardwalk is interrupted rather than fenced.
const envSTEP_X = -22.1, envSTEP_HX = 2.70;
const envKIOSK_X = -41.4, envKIOSK_Z = 3.0;
const envQUAY_TABLES = [-37.6, 1.6, -34.0, 3.4, -30.4, 1.8, -36.0, 5.2, -31.2, 5.4];
const envQUAY_TABLE_TOP = 0.79;
const envBUSKER_SPOT = { x: -25.6, z: 1.2 };
const envKIOSK_SPOT  = { x: -39.8, z: 3.0 };

// ------------------------------------------------------------- unit geoms --
const envG = {
  box: null, cyl6: null, cyl8: null, cyl4: null,
  sph6: null, sph5: null, cone6: null, cone4: null,
};

// Hand-authored hero tree positions. Rejection sampling only fills in behind
// these — the figs frame the Opera House and line the main path, the jacarandas
// mark the garden junctions.
const envFIG_SPOTS = [[-19, 5], [-25, 11], [18.5, 2.5], [27, 7.5], [34.5, 12],
                      [23, 21], [37, 31], [19.5, 35], [43, 53], [57.5, 29],
                      // …and three breaking the horizon over the spawn lawn
                      [-11.5, 17.5], [12.5, 30.5], [-13, 36.5],
                      // ---- THE EASTERN GARDEN (integrity 7) ---------------
                      // Everything above stops at x = 57 and z = 53, and the
                      // frame from (58, 50) is mown stripes and nothing else
                      // for eighty metres — see qa/b7-gardens-before.png. This
                      // is the same avenue carried on to the boundary rather
                      // than a new kind of thing: six more figs on the line the
                      // first ten already make, and two on the north lawn so
                      // the walk up to the railing has something in it.
                      [55, 47], [61.5, 38], [59, 57], [48, 62],
                      [33.5, 62], [17, 58.5], [3, 52], [-20, 50]];
const envJAC_SPOTS = [[30, 20], [40.5, 26], [47, 45], [26.5, 49], [54, 36], [21, 27],
                      [6, 22.5], [-6.5, 36],
                      // the junctions of the eastern walks
                      [58.5, 50.5], [51.5, 55], [40, 57.5], [62, 44], [24, 56],
                      [-27, 40], [-34, 55]];

// Fallen jacaranda blossom on the spawn lawn: cx, cz, radius.
const envBLOSSOM = [
  [6.0, 22.6, 2.5], [4.0, 25.2, 1.15], [8.5, 20.2, 0.9], [7.4, 25.8, 0.7],
  [-6.5, 36.0, 2.2], [-4.3, 34.1, 1.0], [-8.7, 38.3, 0.8],
  [-2.0, 28.6, 0.75], [1.6, 31.2, 0.55], [10.2, 27.4, 0.6],
];

function envInitGeos() {
  if (envG.box) return;
  envG.box   = new THREE.BoxGeometry(1, 1, 1);
  envG.cyl6  = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
  envG.cyl8  = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
  envG.cyl4  = new THREE.CylinderGeometry(0.5, 0.5, 1, 4);
  envG.sph6  = new THREE.SphereGeometry(0.5, 6, 4);
  envG.sph5  = new THREE.SphereGeometry(0.5, 5, 3);
  envG.cone6 = new THREE.ConeGeometry(0.5, 1, 6);
  envG.cone4 = new THREE.ConeGeometry(0.5, 1, 4);
}

// ======================================================= OPERA HOUSE SHELLS ==
// A vault is NOT one leaf. It is TWO mirrored spherical-triangle shells that
// meet along a sharp central RIDGE and sweep down to a wide base on both sides.
// The two halves are built as separate surfaces, so flat shading gives the
// ridge a genuine crease, and the deep valley where neighbouring vaults
// interpenetrate falls out for free.
//
//   u : 0 at the base chord (sitting on the podium) -> 1 at the apex
//   w : 0 at the ridge -> 1 at the free (outer) edge
//
// The cross-rib is a circular arc that starts at PHI0 rather than 0. That
// non-zero start angle is the whole trick: at w = 0 the surface is ALREADY
// falling away from the ridge, so the two halves meet at a crease instead of
// tangentially. The apex leans -z (north, out over the harbour) by L, the free
// edges trail back +z and droop by DROP*H — so the base of every vault is a
// wide open ARCH standing on the deck at y = 0, which is where the glass
// curtain wall and the dark interior go.
//
// PHI0 sets the crease: the ridge dihedral works out at ~142 degrees on the big
// vaults, sharp enough to catch a hard highlight under flat shading and still
// short of the paper-fold look a razor ridge would give.
const envSHELL_ARC  = 1.22;
const envSHELL_PHI0 = 0.46;
const envSHELL_DROP = 0.58;
const envSHELL_LEAN = 0.46;   // L / H
const envShSN = Math.sin(envSHELL_ARC) - Math.sin(envSHELL_PHI0);
const envShCN = Math.cos(envSHELL_PHI0) - Math.cos(envSHELL_ARC);
function envShPhi(w) { return envSHELL_PHI0 + w * (envSHELL_ARC - envSHELL_PHI0); }
function envShFX(w) { return (Math.sin(envShPhi(w)) - Math.sin(envSHELL_PHI0)) / envShSN; }
function envShFY(w) { return (Math.cos(envSHELL_PHI0) - Math.cos(envShPhi(w))) / envShCN; }
function envShLift(H) { return H * envSHELL_DROP; }
function envShBack(L) { return L * 0.34 + 0.35; }

/**
 * One HALF of one vault, hand-authored at final size (no non-uniform scale, so
 * the lean and the droop stay honest). side = -1 | +1.
 *
 * Carries its own `color` attribute: the roof is clad in a chevron of glossy
 * and matte tiles, which with no textures allowed becomes low-contrast chalky
 * rib banding between PALETTE.sail and PALETTE.sailShade, running along the
 * parametric v/w direction and mirrored across the ridge so it reads as a
 * chevron. `inset` pulls the copy in along the normal and darkens it: that is
 * the soffit, the underside of the vault seen through the open mouth.
 */
function envShellHalf(side, W, H, L, RU, RW, inset) {
  const lift = envShLift(H), back = envShBack(L);
  // Band count is capped hard against RU: a chevron period narrower than about
  // four rows aliases against the tessellation and turns into noise rather than
  // ribbing. Coarse and chalky is the brief anyway.
  const bands = clamp(Math.round(H * 0.7), 3, Math.max(3, Math.floor(RU / 4)));
  const pos = [], colr = [], idx = [];
  const c = new THREE.Color();
  const cSail = new THREE.Color(PALETTE.sail);
  const cShade = new THREE.Color(PALETTE.sailShade);
  const cDark = new THREE.Color(PALETTE.stoneDark);
  for (let i = 0; i <= RU; i++) {
    const u = i / RU;
    const a = u * Math.PI * 0.5;
    const ca = Math.cos(a), sa = Math.sin(a);
    const hw = (W * 0.5) * Math.pow(ca, 0.55);
    const dh = lift * Math.pow(ca, 0.80);
    const dz = back * Math.pow(ca, 0.90);
    for (let j = 0; j <= RW; j++) {
      const w = j / RW;
      const fx = envShFX(w), fy = envShFY(w);
      pos.push(side * hw * fx,
               lift + H * sa - dh * fy,
               -L * (1 - ca) + dz * fy);
      // chevron: bands along u, sheared by w, identical on both halves -> V
      const rib = 0.5 + 0.5 * Math.cos((u * bands - w) * Math.PI * 2);
      if (inset > 0) c.copy(cShade).lerp(cDark, 0.24 + 0.34 * (1 - w) + 0.06 * rib);
      else           c.copy(cSail).lerp(cShade, 0.05 + 0.22 * w * w + 0.50 * rib);
      colr.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < RU; i++) {
    for (let j = 0; j < RW; j++) {
      const a = i * (RW + 1) + j, b = a + 1, d = a + (RW + 1), e = d + 1;
      idx.push(a, b, d, b, e, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // the winding that puts the normal on the convex face flips with `side`;
  // rather than reason about it, measure it and flip if the sheet faces down.
  let sy = 0;
  const n0 = g.attributes.normal.array;
  for (let i = 1; i < n0.length; i += 3) sy += n0[i];
  if (sy < 0) {
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  if (inset > 0) {
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    for (let i = 0; i <= RU; i++) {
      // taper the offset toward the apex or the razor tip turns inside out
      const f = inset * (0.3 + 0.7 * Math.cos(i / RU * Math.PI * 0.5));
      for (let j = 0; j <= RW; j++) {
        const k = (i * (RW + 1) + j) * 3;
        p[k] -= n[k] * f; p[k + 1] -= n[k + 1] * f; p[k + 2] -= n[k + 2] * f;
      }
    }
    g.computeVertexNormals();
  }
  return g;
}

// ------------------------------------------------------------ tiny helpers --
let envSeed = 20240813;
function envRnd() { envSeed = (envSeed * 1664525 + 1013904223) >>> 0; return envSeed / 4294967296; }
function envRR(a, b) { return a + envRnd() * (b - a); }

function envXform(px, py, pz, rx, ry, rz, sx, sy, sz) {
  envEu.set(rx, ry, rz, 'YXZ');
  envQ.setFromEuler(envEu);
  envV3.set(px, py, pz);
  envSc.set(sx, sy, sz);
  envM.compose(envV3, envQ, envSc);
  return envM;
}

function envNoise(x, z) {
  return Math.sin(x + Math.sin(z * 0.7) * 1.3) * 0.5 + Math.sin(z * 1.3 + Math.cos(x * 0.9) * 1.1) * 0.5;
}

function envPush9(list, px, py, pz, rx, ry, rz, sx, sy, sz) {
  list.push(px, py, pz, rx, ry, rz, sx, sy, sz);
}

// ------------------------------------------------------------- the merger --
function envMerger(base) {
  // THE ONE MERGER IN THE GAME THAT DOES NOT RECOMPUTE ITS NORMALS, and the
  // only one with a colour hook. Both were already true; makeMerger just made
  // them sayable. The de-tint fades a colour toward the horizon with distance,
  // so it has to run over every colour this merger writes — including the
  // per-vertex ones in addC below.
  const M = makeMerger(envG, {
    xform: envXform, cylSegs: [4, 8], coneSegs: [], sphSegs: [],
    normals: 'keep', jitter: 0.050, tint: function (c) { envDeTint(c, base); },
  });
  const envC = new THREE.Color();
  /** like add(), but the geometry brings its own per-vertex `color`. */
  M.addC = function (geo, m4) {
    const g = geo.clone();
    g.applyMatrix4(m4);
    const p = g.attributes.position.array;
    const nm = g.attributes.normal.array;
    const cv = g.attributes.color.array;
    const start = M.n;
    for (let i = 0; i < p.length; i += 3) {
      M.pos.push(p[i], p[i + 1], p[i + 2]);
      M.nor.push(nm[i], nm[i + 1], nm[i + 2]);
      envC.setRGB(cv[i], cv[i + 1], cv[i + 2]);
      envDeTint(envC, base);
      M.col.push(envC.r, envC.g, envC.b);
    }
    const vc = p.length / 3;
    if (g.index) { const ia = g.index.array; for (let i = 0; i < ia.length; i++) M.idx.push(start + ia[i]); }
    else { for (let i = 0; i < vc; i++) M.idx.push(start + i); }
    M.n += vc;
    g.dispose();
    return M;
  };
  M.quad = function (x0, z0, x1, z1, y, color) {
    const a = M.vert(x0, y, z1, color), b = M.vert(x1, y, z1, color);
    const d = M.vert(x1, y, z0, color), e = M.vert(x0, y, z0, color);
    M.idx.push(a, b, d, a, d, e);
  };
  return M;
}

function envRibbon(M, pts, halfW, y, color) {
  const n = pts.length / 2;
  let p0 = -1, p1 = -1;
  for (let i = 0; i < n; i++) {
    let dx, dz;
    if (i === 0) { dx = pts[2] - pts[0]; dz = pts[3] - pts[1]; }
    else if (i === n - 1) { dx = pts[2 * i] - pts[2 * i - 2]; dz = pts[2 * i + 1] - pts[2 * i - 1]; }
    else { dx = pts[2 * i + 2] - pts[2 * i - 2]; dz = pts[2 * i + 3] - pts[2 * i - 1]; }
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const nx = -dz * halfW, nz = dx * halfW;
    const a = M.vert(pts[2 * i] + nx, y, pts[2 * i + 1] + nz, color);
    const b = M.vert(pts[2 * i] - nx, y, pts[2 * i + 1] - nz, color);
    if (i > 0) { M.tri(p0, p1, b); M.tri(p0, b, a); }
    p0 = a; p1 = b;
  }
}

// ===========================================================================
// FALLEN JACARANDA — AND WHY IT IS NOT A FLAT DISC ANY MORE.
//
// shared.js's own contact header calls these "the worst-looking thing in
// qa/na-sydney.png", and uses them as the argument against ever solving contact
// shadows with decals. Four separate things were wrong with them and all four
// are visible in a still:
//
//   1. ONE FLAT COLOUR over two and a half metres, on a lawn that carries a
//      three-octave noise field. The ground got grain, a near octave and a
//      broad hue octave over v45-v46 and the blossom got none of it, because
//      the decal mesh is built on matVC2 — which has no grain() at all. Every
//      improvement to the lawn made these stand out more.
//   2. A VISIBLE OCTAGON. Eight segments, and at two and a half metres across
//      you can count them.
//   3. FLOATING FIVE CENTIMETRES over a lawn that undulates by three. Blossom
//      lies ON grass.
//   4. A HARD EDGE. The disc simply stops, which is the one thing drifted
//      blossom never does.
//
// THE FIX IS THE RIM, and it costs nothing: the outer ring is given THE LAWN'S
// OWN COLOUR, computed with the same two noise fields the ground mesh uses, so
// the disc dissolves into the grass instead of ending on it. No alpha, no
// sorting, no z-fighting — the same reasoning that made the crease and the
// shore ramps work, one surface over.
//
// AND IT GOES ON THE GROUND'S MATERIAL, not the decals'. In exchange the
// blossom picks up the grain, the near octave, the broad hue field and the
// contact term that the lawn around it already has — so it is lit and textured
// as part of the same surface rather than as a sticker on top of one.
//
// COST, measured as a differential rather than asserted: one more mesh, and
// 480 triangles replacing 80, against a chapter that draws about 87 000. The
// draw-call count came back 140 against a baseline of 141 — i.e. INSIDE the
// run-to-run variance of what the frustum happens to cull on an arrival frame,
// which is worth knowing before quoting a "+1" that cannot be seen.
//
// PAINTING THE GROUND MESH INSTEAD WAS THE FIRST IDEA AND IT CANNOT WORK: that
// mesh is 64x46 over 220x160 m, so its cells are 3.44 m and eight of the ten
// drifts are SMALLER THAN ONE CELL. There is nothing there to paint with.
const envBL_SEG = 16;
const envBL_OFF = 0.022;   // metres above the lawn. Was 0.05 and flat.
const envColBl = new THREE.Color();
const envColGr = new THREE.Color();
/** The lawn's own height at a point — the ground mesh's rule, verbatim. */
function envLawnY(x, z) { return envNoise(x * 0.09, z * 0.09) * 0.03; }
/**
 * The lawn's own colour at a point.
 *
 * The ground loop's rule minus its sand and aerial-perspective terms, which is
 * EXACT here rather than an approximation: all ten drifts sit inside
 * x[-8.7, 10.2] z[20.2, 38.3], and both of those terms are identically zero
 * over that box (the sand needs x < -10 or x > 12, the haze needs |x| > 66 or
 * z > 62). Checked rather than assumed, because a rim that is nearly the grass
 * colour is worse than one that is obviously not.
 */
function envLawnColor(x, z, out) {
  const t1 = 0.5 + 0.5 * envNoise(x * 0.19 + 11, z * 0.17 - 4);
  const t2 = 0.5 + 0.5 * envNoise(x * 0.07 - 3, z * 0.06 + 7);
  out.set(PALETTE.grassDark).lerp(envColA.set(PALETTE.grass), t1);
  return out.lerp(envColA.set(PALETTE.grassPale), t2 * 0.55);
}
/**
 * One drift of fallen blossom. Centre and an inner ring carry the petal colour;
 * the outer ring carries the grass. Two rings rather than a plain fan because a
 * fan interpolates straight from the centre to the rim, which spends the whole
 * drift on the falloff and leaves it with no solid middle.
 */
function envBlossom(M, cx, cz, r) {
  const ci = M.vert(cx, envLawnY(cx, cz) + envBL_OFF, cz,
                    envColBl.set(PALETTE.petalPurple));
  const inner = [], outer = [];
  for (let i = 0; i < envBL_SEG; i++) {
    const a = i / envBL_SEG * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    // THE OUTLINE IS NOT A CIRCLE. Blossom drifts; a perfect disc reads as a
    // decal however soft its edge is.
    const wob = 0.80 + 0.34 * (0.5 + 0.5 * envNoise(cx + ca * 3.1, cz + sa * 3.1));
    const ri = r * 0.52 * wob, ro = r * wob;
    // ...and the petal colour is not one value either: a drift is thicker in
    // some places than others and the grass shows through the thin parts.
    const mixv = 0.5 + 0.5 * envNoise(cx * 1.7 + ca * 2.3, cz * 1.7 + sa * 2.3);
    envColBl.set(PALETTE.petalPurple).lerp(envColA.set(PALETTE.petalPink), mixv * 0.45);
    const ix = cx + ca * ri, iz = cz + sa * ri;
    inner.push(M.vert(ix, envLawnY(ix, iz) + envBL_OFF, iz,
                      envColBl.lerp(envLawnColor(ix, iz, envColGr), 0.18)));
    const ox = cx + ca * ro, oz = cz + sa * ro;
    outer.push(M.vert(ox, envLawnY(ox, oz) + envBL_OFF, oz,
                      envLawnColor(ox, oz, envColGr)));
  }
  // WOUND FOR A FRONT FACE, WHICH envDisc IS NOT.
  //
  // The blossom came back completely invisible the first time this ran, and the
  // reason is worth writing down: `envDisc` emits tri(centre, v[i-1], v[i]),
  // which with x = cos and z = sin puts the geometric normal at **-Y**. Every
  // ground disc in this chapter — the pond bed included — is therefore wound
  // face-DOWN, and they are only on screen at all because `matVC2` happens to
  // be `side: DoubleSide` for the Opera House sails. Move one of them onto a
  // front-faced material, which the ground's is, and it is culled.
  //
  // Cross product, not trial and error: for a = centre and b, c on the ring at
  // increasing angle, ((b-a) x (c-a)).y is -sin(θc - θb), so the outer pair has
  // to be listed in DECREASING angle for the face to point up.
  for (let i = 0; i < envBL_SEG; i++) {
    const j = (i + 1) % envBL_SEG;
    M.tri(ci, inner[j], inner[i]);
    M.tri(inner[j], outer[j], outer[i]);
    M.tri(inner[j], outer[i], inner[i]);
  }
}

/**
 * A flat disc on the ground. Used for the pond bed, the pond water and the
 * flower-bed pads.
 *
 * THE WINDING WAS BACKWARDS AND NOTHING EVER NOTICED, because every one of
 * these is drawn with `matVC2`, which is `side: DoubleSide` — for the Opera
 * House sails, not for these. It emitted tri(centre, v[i-1], v[i]), which with
 * x = cos and z = sin puts the geometric normal at -Y: face-down. It is fixed
 * here rather than left alone because it is a trap rather than a defect —
 * nothing looks different today (a double-sided material draws both, and the
 * merger writes a +Y normal attribute so the lighting was never affected), and
 * the day somebody moves a disc onto a front-faced material it vanishes. Which
 * is exactly what happened to the blossom, one function up.
 */
function envDisc(M, cx, cz, r, seg, y, color) {
  const ci = M.vert(cx, y, cz, color);
  let prev = -1;
  for (let i = 0; i <= seg; i++) {
    const a = i / seg * Math.PI * 2;
    const v = M.vert(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r, color);
    if (prev >= 0) M.tri(ci, v, prev);
    prev = v;
  }
}

// ------------------------------------------------------------------ zones --
// ---------------------------------------------------------- CANOPY CEILING --
// THE CAMERA HAS BEEN SITTING INSIDE EVERY FIG IN THE GARDENS.
//
// MEASURED from a rendered frame, standing the animal at (-19, 8) — which is
// under the fig at (-19, 5), one of thirteen: the eye ends up at y = 8.6 and a
// Moreton Bay fig's canopy is five overlapping spheres between y = 3.4 and
// y = 7.8. The entire frame is leaves. The capybara is not on screen at all.
//
// systems.js's occlusion ray cannot help here and should not be asked to: a
// canopy is RENDER-ONLY geometry — there is no body to ray against, and giving
// twenty-one trees one would be absurd — which is exactly the case camCeil
// exists for. The chapter says where its roofs are, and in a botanic garden the
// roofs are trees.
//
// The ceiling is the underside of the crown, not the top of the trunk: duck the
// eye to just under the lowest leaves and the shot becomes a capybara framed by
// a canopy, which is the nicest picture in the chapter rather than the worst.
// Outside every crown it answers Infinity and costs twenty-one distance tests.
const envCAM_FIG_R = 4.6;     // crown radius, figs — blobs out to ~4.1 plus a margin
const envCAM_FIG_Y = 3.15;    // underside of the crown; the trunk tops out at 3.4
const envCAM_JAC_R = 3.6;
const envCAM_JAC_Y = 2.65;
function envCamCeil(x, z) {
  for (let i = 0; i < envFIG_SPOTS.length; i++) {
    const dx = x - envFIG_SPOTS[i][0], dz = z - envFIG_SPOTS[i][1];
    if (dx * dx + dz * dz < envCAM_FIG_R * envCAM_FIG_R) return envCAM_FIG_Y;
  }
  for (let i = 0; i < envJAC_SPOTS.length; i++) {
    const dx = x - envJAC_SPOTS[i][0], dz = z - envJAC_SPOTS[i][1];
    if (dx * dx + dz * dz < envCAM_JAC_R * envCAM_JAC_R) return envCAM_JAC_Y;
  }
  return Infinity;
}

// The whole of the world that has a floor or a sea under it. See api.bounds().
//
// ---- THIS USED TO BE ONE RECTANGLE AND SYDNEY IS NOT ONE (integrity 1) -----
// It was `{ x0: -142, x1: 142, z0: -152, z1: 96 }`, described in the comment on
// api.bounds() as the UNION of the two places there is something under you.
// The description was accurate and the geometry was the bug: the land box and
// the harbour meet along a waterline, so their union is an L, and the smallest
// rectangle containing an L contains two large quadrants of NOTHING.
//
// Those quadrants are x 70..142 and x -142..-70 for z > -10 (east and west of
// the gardens, on the land side) plus z 70..96 across the full width. About
// 19 000 m2 of walkable nowhere, all of it inside the rectangle that was
// supposed to be keeping the player out of exactly that.
//
// Measured walking out of the gardens before this: the last collider is 52-72 m
// from the spawn and the rescue did not fire for another 40-80 m. That is the
// "you can walk out of the map in Sydney" this pass was started by.
//
// So it is the two rectangles it always was, said properly. systems.js's
// sysOutside() takes either form; inside ANY rectangle is inside, which is why
// they are allowed to overlap along z = -10 rather than having to abut exactly.
const envBOUNDS = {
  rects: [
    // THE LAND. The ground body is a box over x +/-70, z -10..70 and nothing at
    // all exists past it — the lawn MESH runs to z = 150 purely so the horizon
    // has no hard edge in it, which is what made walking north feel legal.
    { x0: -70, x1: 70, z0: -10, z1: 70 },
    // THE HARBOUR. The water mesh runs x +/-140, z -150..-10 and the seabed
    // body under it is wider still, so swimming to the far shore stays legal.
    { x0: -140, x1: 140, z0: -150, z1: -8 },
  ],
};

// The top of the red podium (L6, E4): the deck at 1.2 plus the block the
// carpet sits on. The 'opera-stage' height test (> 0.9) still passes on it;
// the zone is the carpet's own rectangle now rather than 2.5 m wider each
// side, so "on the red" and "in the zone" are the same fact — and a metre
// north of where the flat carpet lay, for the stair (see the block's note).
const envSTAGE_Y = 1.5;
const envZONES = {
  operaStage: { x0: -6.5, z0: 0.0, x1: 6.5, z1: 2.9 },
  gardens:    { x0: 14, z0: 4, x1: 62, z1: 58 },
  flowerbed:  { x0: 17, z0: 6, x1: 56, z1: 51 },
  promenade:  { x0: -62, z0: -9, x1: -14, z1: 12 },
  picnic:     { x0: 22, z0: 18, x1: 38, z1: 34 },
  // ---- Circular Quay (chapter 1) ----
  boardwalk:  { x0: -46.4, z0: -9.9, x1: -14.0, z1: -7.4 },
  terrace:    { x0: -42.6, z0: -0.6, x1: -26.4, z1: 6.8 },
};

const envBEDS = [
  { cx: 20.5, cz: 9.0,  hx: 2.6, hz: 1.9, prize: true,  a: PALETTE.petalRed,    b: PALETTE.petalPink },
  { cx: 30.0, cz: 8.5,  hx: 3.1, hz: 1.8, prize: false, a: PALETTE.petalYellow, b: PALETTE.petalWhite },
  { cx: 41.0, cz: 10.0, hx: 2.6, hz: 1.8, prize: false, a: PALETTE.petalPurple, b: PALETTE.petalPink },
  { cx: 52.0, cz: 23.0, hx: 2.3, hz: 3.0, prize: false, a: PALETTE.petalWhite,  b: PALETTE.petalYellow },
  { cx: 24.0, cz: 42.0, hx: 3.1, hz: 2.1, prize: false, a: PALETTE.petalPink,   b: PALETTE.petalPurple },
  { cx: 36.5, cz: 48.0, hx: 2.6, hz: 2.1, prize: false, a: PALETTE.petalYellow, b: PALETTE.petalPurple },
  // ---- THE EASTERN GARDEN (integrity 7) ---------------------------------
  // Four of the six above are west of x = 40 and none is past z = 48, which is
  // most of why the east half photographs as a field. These extend the same
  // table with the same two-colour scheme; the prize bed stays the one at
  // (20.5, 9) because the task points at it and there is only ever one.
  { cx: 51.0, cz: 44.5, hx: 2.9, hz: 2.0, prize: false, a: PALETTE.petalRed,    b: PALETTE.petalYellow },
  { cx: 59.5, cz: 33.0, hx: 2.2, hz: 3.2, prize: false, a: PALETTE.petalBlue,   b: PALETTE.petalWhite },
  { cx: 44.0, cz: 59.0, hx: 3.3, hz: 2.0, prize: false, a: PALETTE.petalPurple, b: PALETTE.petalWhite },
  { cx: 55.5, cz: 61.0, hx: 2.4, hz: 2.2, prize: false, a: PALETTE.petalYellow, b: PALETTE.petalPink },
  { cx: 29.0, cz: 58.0, hx: 2.7, hz: 1.9, prize: false, a: PALETTE.petalWhite,  b: PALETTE.petalBlue },
];
for (let i = 0; i < envBEDS.length; i++) {
  const b = envBEDS[i];
  b.x0 = b.cx - b.hx; b.x1 = b.cx + b.hx;
  b.z0 = b.cz - b.hz; b.z1 = b.cz + b.hz;
}
// NB: the beds are published as api.flowerBeds, NOT on zones — `zones` stays a
// flat map of plain {x0,z0,x1,z1} rects as the contract describes.

const envPOND = { x: 44, z: 40, r: 5.0 };

const envPATHS = [
  [0, 7.5, 6, 8.6, 13, 10.2, 19, 12.2, 26, 14.4, 32, 17.2, 38, 22, 42, 28, 44, 34],
  [-2, 7.6, -9, 7.0, -15, 4.2, -20.5, 0.4, -26, -2.6, -34, -4.6, -44, -5.4, -54, -4.6, -62, -3.2],
  [32, 17.2, 31, 21.5, 30, 26.5],
  [44, 34, 39.2, 36.4, 37.8, 41.5, 40.2, 45.6, 45.4, 46.4, 49.6, 43.4, 49.6, 38, 44, 34],
  [44, 34, 48, 42, 52, 48, 56, 52],
  // ---- THE EASTERN WALKS (integrity 7) ----------------------------------
  // Every path above dies at (56, 52) with nothing beyond it, which is most of
  // why the north-east quarter reads as a field rather than as a garden: there
  // is no route through it, so there is nothing to walk along. Two more legs
  // carry the last one up to the new boundary and back west along it, and a
  // spur runs down the eastern flank. A path is also what keeps the tree
  // scatter honest — envTreeSpotOk clears 3 m either side of every one of
  // these, so the walks stay walks.
  [56, 52, 58.5, 57, 57, 62.5, 51, 65, 43, 65.5, 34, 64.5, 26, 62, 20, 58.5],
  [56, 52, 60, 46, 61.5, 39, 60, 32, 56, 27],
];

// ------------------------------------------------------------- navigation --
const envNavC = [];   // cx, cz, r
const envNavR = [];   // x0, z0, x1, z1

function envNavBlocked(x, z, r) {
  const rr = r || 0;
  for (let i = 0; i < envNavC.length; i += 3) {
    const dx = x - envNavC[i], dz = z - envNavC[i + 1];
    const rad = envNavC[i + 2] + rr;
    if (dx * dx + dz * dz < rad * rad) return true;
  }
  for (let i = 0; i < envNavR.length; i += 4) {
    if (x > envNavR[i] - rr && x < envNavR[i + 2] + rr &&
        z > envNavR[i + 1] - rr && z < envNavR[i + 3] + rr) return true;
  }
  return false;
}

function envRectHit(rect, x, z, r) {
  const rr = r || 0;
  return x > rect.x0 - rr && x < rect.x1 + rr && z > rect.z0 - rr && z < rect.z1 + rr;
}

// ------------------------------------------------------------ instancing ---
function envInstance(root, geo, color, list, cast, recv) {
  const n = list.length / 9;
  if (n < 1) return null;
  const im = new THREE.InstancedMesh(geo, mat(color), n);
  for (let i = 0; i < n; i++) {
    const o = i * 9;
    im.setMatrixAt(i, envXform(list[o], list[o + 1], list[o + 2], list[o + 3], list[o + 4],
                               list[o + 5], list[o + 6], list[o + 7], list[o + 8]));
  }
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  im.castShadow = !!cast;
  im.receiveShadow = !!recv;
  root.add(im);
  return im;
}

// --------------------------------------------------------------- physics ---
function envStatic(game, shape, x, y, z, rx) {
  const b = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC, material: envGroundPhysMat });
  b.addShape(shape);
  b.position.set(x, y, z);
  if (rx) b.quaternion.setFromEuler(rx, 0, 0);
  // These bodies are written directly rather than simulated into place, so the
  // interpolation pair has to be seeded by hand or it stays at the origin. No
  // mesh in this module is driven from a body, but anything that later reads
  // interpolatedPosition on a collider must not get (0,0,0).
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
  b.previousQuaternion.copy(b.quaternion);
  b.interpolatedQuaternion.copy(b.quaternion);
  b.allowSleep = true;
  game.world.addBody(b);
  return b;
}

function envStaticBox(game, x, y, z, hx, hy, hz, rx) {
  return envStatic(game, new CANNON.Box(new CANNON.Vec3(hx, hy, hz)), x, y, z, rx);
}

// A compound static body: one broadphase entry for a whole cluster of quay
// furniture, so the boardwalk, five café tables, the counter and the water stair
// cost three bodies rather than thirty.
function envPoolBody() {
  const b = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC, material: envGroundPhysMat });
  b.allowSleep = true;
  return b;
}
function envPoolBox(b, x, y, z, hx, hy, hz, rx) {
  const q = new CANNON.Quaternion();
  if (rx) q.setFromEuler(rx, 0, 0);
  b.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)), new CANNON.Vec3(x, y, z), q);
  return b;
}
function envPoolDone(game, b) {
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
  b.previousQuaternion.copy(b.quaternion);
  b.interpolatedQuaternion.copy(b.quaternion);
  game.world.addBody(b);
  return b;
}

// ===================================================== CIRCULAR QUAY (ch. 2) ==
/** Ground decals for the quay. Runs into the shared decal merger `D`. */
function envQuayDecals(D) {
  // terrace apron and the stub that ties it back to the promenade kerb
  D.quad(-42.8, -0.8, -26.2, 7.0, 0.076, PALETTE.stone);
  D.quad(-37.4, -5.3, -30.6, -0.7, 0.076, PALETTE.stone);
  D.quad(-42.8, 6.6, -26.2, 7.0, 0.078, PALETTE.stoneDark);
  // arcade floor under the colonnade, a shade warmer than the terrace
  D.quad(-46.9, 5.0, -22.3, 11.4, 0.077, PALETTE.sandstone);
  for (let i = 0; i < 5; i++) {
    const jz = 5.8 + i * 1.3;
    D.quad(-46.9, jz - 0.05, -22.3, jz + 0.05, 0.079, PALETTE.sandstoneDark);
  }
  // wet flagstones at the head of the water stair
  D.quad(-25.4, -9.4, -18.8, -6.6, 0.079, PALETTE.stoneDark);
}

/**
 * Boardwalk, railing, water stair, dining terrace and colonnade.
 * `A` is the architecture merger (everything static and opaque lands in it, so
 * the whole quay costs zero extra draw calls beyond the six instanced sets).
 */
function envBuildQuay(game, root, A) {
  const posts = [];       // cyl6: railing posts, table pedestals, umbrella poles
  const tableTop = [], chairSeat = [], chairBack = [], chairLeg = [], brolly = [];
  const bDeck = envPoolBody();
  const bTerr = envPoolBody();

  // ----------------------------------------------------------- BOARDWALK ---
  const bz = (envQUAY_Z0 + envQUAY_Z1) * 0.5, bd = envQUAY_Z1 - envQUAY_Z0;
  const railZ = envQUAY_Z0 + 0.16;
  for (let r = 0; r < envQUAY_RUNS.length; r++) {
    const x0 = envQUAY_RUNS[r][0], x1 = envQUAY_RUNS[r][1];
    const w = x1 - x0, cx = (x0 + x1) * 0.5;
    A.box(cx, envQUAY_DECK_Y * 0.5, bz, w, envQUAY_DECK_Y, bd, PALETTE.wood);
    // skirt hanging over the water so the deck reads as raised, not painted on
    A.box(cx, -0.17, envQUAY_Z0 + 0.09, w, 0.68, 0.18, PALETTE.woodDark);
    // planking: every second board laid a hair proud. No textures allowed, so
    // the boards have to be geometry — 0.024 of relief is enough to catch the sun.
    const planks = Math.max(2, Math.floor(w / 0.86));
    const pw = w / planks;
    for (let i = 0; i < planks; i += 2) {
      A.box(x0 + (i + 0.5) * pw, envQUAY_DECK_Y + 0.012, bz, pw * 0.84, 0.024, bd - 0.12, PALETTE.woodDark);
    }
    envPoolBox(bDeck, cx, envQUAY_DECK_Y * 0.5, bz, w * 0.5, envQUAY_DECK_Y * 0.5, bd * 0.5);
    // railing: instanced posts + two merged rails, laid in one or two spans
    const g0 = envQUAY_RUNS[r][2], g1 = envQUAY_RUNS[r][3];
    const spans = (g1 > g0) ? [x0, g0, g1, x1] : [x0, x1];
    for (let s = 0; s < spans.length; s += 2) {
      const sx0 = spans[s], sx1 = spans[s + 1], sw = sx1 - sx0;
      if (sw < 0.6) continue;
      const scx = (sx0 + sx1) * 0.5;
      const n = Math.max(1, Math.round(sw / 1.7));
      for (let i = 0; i <= n; i++) {
        const x = sx0 + (i / n) * sw;
        envPush9(posts, x, envQUAY_DECK_Y + 0.40, railZ, 0, 0, 0, 0.13, 0.80, 0.13);
        envPerches.push({ x: x, y: envQUAY_DECK_Y + 0.82, z: railZ });
      }
      A.box(scx, envQUAY_DECK_Y + 0.78, railZ, sw, 0.10, 0.14, PALETTE.wood);
      A.box(scx, envQUAY_DECK_Y + 0.44, railZ, sw, 0.07, 0.09, PALETTE.woodDark);
      envPoolBox(bDeck, scx, envQUAY_DECK_Y + 0.42, railZ, sw * 0.5, 0.42, 0.09);
      envNavR.push(sx0, railZ - 0.35, sx1, railZ + 0.35);
    }
  }

  // ------------------------------------------- WIDE STEPS DOWN TO THE WATER --
  // Seven 0.22 treads from the quay top (y = 0) to y = -1.54, which puts three
  // of them under the waterline at -0.5. The sea wall is cut for them above.
  for (let i = 0; i < 7; i++) {
    const y = -i * 0.22, zc = -9.66 - i * 0.50;
    A.box(envSTEP_X, y - 0.11, zc, envSTEP_HX * 2, 0.22, 0.50,
          i % 2 ? PALETTE.sandstone : PALETTE.sandstoneDark);
    envPoolBox(bDeck, envSTEP_X, y - 0.11, zc, envSTEP_HX, 0.11, 0.25);
  }
  for (let s = -1; s <= 1; s += 2) {
    const cxk = envSTEP_X + s * (envSTEP_HX + 0.32);
    A.box(cxk, -0.70, -11.20, 0.60, 0.46, 4.10, PALETTE.sandstone, -0.414, 0, 0);
    A.box(cxk, 0.22, -9.55, 0.62, 0.44, 0.62, PALETTE.sandstoneDark);
    envPerches.push({ x: cxk, y: 0.44, z: -9.55 });
  }

  // ---------------------------------------------------- DINING TERRACE -----
  // serving counter with a canvas awning on two poles
  A.box(envKIOSK_X, 0.52, envKIOSK_Z, 1.30, 1.04, 5.00, PALETTE.wood);
  A.box(envKIOSK_X, 1.10, envKIOSK_Z, 1.62, 0.14, 5.40, PALETTE.stone);
  A.box(envKIOSK_X - 0.86, 1.38, envKIOSK_Z, 0.36, 2.76, 4.60, PALETTE.sandstone);
  A.box(envKIOSK_X - 0.86, 2.84, envKIOSK_Z, 0.52, 0.16, 4.90, PALETTE.sandstoneDark);
  A.box(envKIOSK_X + 0.94, 2.44, envKIOSK_Z, 2.30, 0.12, 5.40, PALETTE.cloth2, 0, 0, 0.16);
  for (let s = -1; s <= 1; s += 2) {
    envPush9(posts, envKIOSK_X + 1.92, 1.16, envKIOSK_Z + s * 2.5, 0, 0, 0, 0.11, 2.32, 0.11);
  }
  envPoolBox(bTerr, envKIOSK_X, 0.55, envKIOSK_Z, 0.75, 0.55, 2.60);
  envNavR.push(envKIOSK_X - 1.1, envKIOSK_Z - 2.8, envKIOSK_X + 1.1, envKIOSK_Z + 2.8);

  // round tables, three chairs apiece, folded umbrellas through alternate tables
  for (let i = 0; i < envQUAY_TABLES.length; i += 2) {
    const tx = envQUAY_TABLES[i], tz = envQUAY_TABLES[i + 1];
    A.cyl(tx, 0.03, tz, 0.32, 0.06, PALETTE.metal, 0, 0, 0, 6);
    envPush9(posts, tx, 0.38, tz, 0, 0, 0, 0.20, 0.72, 0.20);
    envPush9(tableTop, tx, 0.755, tz, 0, 0, 0, 1.24, 0.07, 1.24);
    envCafeTables.push({ x: tx, z: tz, top: envQUAY_TABLE_TOP });
    envPoolBox(bTerr, tx, 0.395, tz, 0.52, 0.395, 0.52);
    envNavC.push(tx, tz, 1.15);
    for (let c = 0; c < 3; c++) {
      const a = i * 0.31 + c * 2.0944;
      const ca = Math.cos(a), sa = Math.sin(a);
      const cxc = tx + ca * 1.02, czc = tz + sa * 1.02;
      const yaw = -a - Math.PI * 0.5;          // seat faces the table
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      envPush9(chairSeat, cxc, 0.44, czc, 0, yaw, 0, 0.46, 0.07, 0.46);
      envPush9(chairBack, cxc + ca * 0.21, 0.66, czc + sa * 0.21, 0, yaw, 0, 0.46, 0.44, 0.07);
      for (let l = 0; l < 4; l++) {
        const lx = l < 2 ? -0.17 : 0.17, lz = l % 2 ? 0.17 : -0.17;
        envPush9(chairLeg, cxc + lx * cy + lz * sy, 0.21, czc - lx * sy + lz * cy,
                 0, 0, 0, 0.075, 0.42, 0.075);
      }
    }
    if ((i / 2) % 2 === 0) {
      envPush9(posts, tx, 1.20, tz, 0, 0, 0, 0.09, 2.40, 0.09);
      // deliberately NOT envRR: the quay is built before the tree pass, and
      // drawing from the seeded stream here would reshuffle every tree and tuft
      envPush9(brolly, tx, 1.78, tz, 0, 0.6 + i * 0.37, 0, 0.46, 1.40, 0.46);
    }
  }

  // ------------------------------------------------------- COLONNADE ------
  // A shallow arc of sandstone piers with an entablature and a canvas awning,
  // standing in front of a blank terminal façade. NPCs walk between the piers,
  // so only the piers themselves go into the nav circles.
  //
  // CAMERA SIGHT LINE (this is why the numbers look the way they do). The rig
  // is a fixed 41-degree pitch, so the line from the eye to the capybara is
  //     y(z) = capyY + 0.869 * (z - capyZ)
  // — independent of zoom distance. Standing on the café table at (-34.0, 3.4)
  // ('cafe-table', a Circular Quay task) that is capyY ~ 1.13, capyZ 3.4, and nothing in
  // the camera rig knows about the quay: there is no pull-in outside the Opera
  // House box, so the colonnade has to clear the line geometrically.
  //   at z = 8.65 the line is at y 5.69  -> cornice top 4.09 clears by 1.6
  //   at z = 6.55 the line is at y 3.87  -> awning leading edge 3.55 clears
  // Hence: the arc sits BACK at z 8.65..9.9 (it used to bow forward to 6.8, at
  // which point the line is only y 4.08 and ran straight through the 3.76-4.20
  // entablature band), the whole entablature drops 0.26, and the awning is
  // shorter and no longer reaches over the tables at z 5.2-5.4.
  const colN = 12;
  let pcx = 0, pcz = 0;
  for (let i = 0; i < colN; i++) {
    const t = i / (colN - 1);
    const cx = -45.0 + t * 21.0;
    const cz = 9.90 - Math.sin(t * Math.PI) * 1.25;
    A.cyl(cx, 1.65, cz, 0.30, 3.14, PALETTE.sandstone, 0, 0, 0, 8);
    A.box(cx, 0.14, cz, 0.80, 0.28, 0.80, PALETTE.sandstoneDark);
    A.box(cx, 3.32, cz, 0.82, 0.24, 0.82, PALETTE.sandstone);
    envNavC.push(cx, cz, 0.58);
    if (i > 0) {
      const dx = cx - pcx, dz = cz - pcz;
      const len = Math.hypot(dx, dz);
      const yaw = Math.atan2(-dz, dx);
      const mx = (cx + pcx) * 0.5, mz = (cz + pcz) * 0.5;
      A.box(mx, 3.72, mz, len + 0.34, 0.44, 0.94, PALETTE.sandstone, 0, yaw, 0);
      A.box(mx, 4.01, mz, len + 0.34, 0.16, 1.16, PALETTE.sandstoneDark, 0, yaw, 0);
      // awning leaning out over the arcade mouth on the seaward side. 1.15 of
      // lean and 1.90 of depth put its leading edge at z ~ 6.55, clear of both
      // the sight line and the outer café tables.
      const ox = -1.15 * Math.sin(yaw), oz = -1.15 * Math.cos(yaw);
      A.box(mx + ox, 3.70, mz + oz, len + 0.34, 0.10, 1.90,
            i % 2 ? PALETTE.cloth3 : PALETTE.cloth6, 0.20, yaw, 0);
    }
    pcx = cx; pcz = cz;
  }
  // Terminal façade behind the arcade — pure backdrop, but it gives the quay a
  // back wall so the camera never looks straight through to the far shore.
  // Single storey, parapet at 5.16: at the old 6.36 the default-zoom eye for a
  // capybara anywhere on the terrace (eye y = capyY + 6.23, eye z = capyZ +
  // 7.17) skimmed the parapet by 0.3 m and was one step from being swallowed
  // by the wall. 5.16 leaves 1.5 m of daylight.
  A.box(-36.6, 2.50, 12.00, 19.6, 5.00, 1.30, PALETTE.sandstone);
  A.box(-36.6, 5.16, 12.00, 20.2, 0.32, 1.70, PALETTE.sandstoneDark);
  for (let i = 0; i < 7; i++) {
    const wx = -45.0 + i * 2.8;
    A.box(wx, 3.00, 11.32, 1.30, 1.70, 0.14, PALETTE.glass);
    A.box(wx, 3.96, 11.30, 1.56, 0.20, 0.20, PALETTE.sandstoneDark);
  }
  envPoolBox(bTerr, -36.6, 2.50, 12.00, 9.8, 2.50, 0.65);
  envNavR.push(-46.6, 11.2, -26.6, 12.8);

  // ------------------------------------------------------- SPRINKLERS -----
  for (let i = 0; i < envSPRINK_SPOTS.length; i += 3) {
    envMakeSprinkler(A, bTerr, envSPRINK_SPOTS[i], envSPRINK_SPOTS[i + 1], envSPRINK_SPOTS[i + 2]);
  }

  envInstance(root, envG.cyl6, PALETTE.woodDark, posts, true, false);
  envInstance(root, envG.cyl8, PALETTE.stone, tableTop, true, true);
  envInstance(root, envG.box, PALETTE.wood, chairSeat, true, false);
  envInstance(root, envG.box, PALETTE.woodDark, chairBack, true, false);
  envInstance(root, envG.cyl4, PALETTE.metal, chairLeg, false, false);
  envInstance(root, envG.cone6, PALETTE.cloth1, brolly, true, false);
  envPoolDone(game, bDeck);
  envPoolDone(game, bTerr);
  envBuildSpray(root);
}

// =============================================== SPRINKLER (Circular Quay) ======
/**
 * A chunky brass rotor sunk into the quay lawn. The body is merged static
 * geometry — only the water moves. The capybara treading on the valve plate
 * kicks it open for a burst; npc.js asks each published record `sprays(x, z)`
 * to decide whether a tourist has just been drenched.
 */
function envMakeSprinkler(A, bTerr, x, z, base) {
  A.cyl(x, 0.05, z, 0.46, 0.10, PALETTE.stoneDark, 0, 0, 0, 6);   // sunk collar
  A.cyl(x, 0.13, z, 0.31, 0.14, PALETTE.metal,     0, 0, 0, 6);   // valve plate
  A.cyl(x, 0.31, z, 0.12, 0.36, PALETTE.khaki,     0, 0, 0, 6);   // standpipe
  A.cyl(x, 0.51, z, 0.24, 0.18, PALETTE.khaki,     0, 0, 0, 6);   // rotor body
  A.cyl(x, 0.63, z, 0.13, 0.08, PALETTE.hiVis,     0, 0, 0, 6);   // brass cap
  envPoolBox(bTerr, x, 0.26, z, 0.24, 0.26, 0.24);
  envNavC.push(x, z, 0.46);
  const s = {
    x: x, y: 0.58, z: z,
    reach: envSPRINK_REACH,
    // the wetted sector is the jet fan plus a little slop either side
    spread: envSPRAY_FAN * (envSPRAY_JETS - 1) * 0.5 + 0.24,
    base: base, angle: base,
    on: false, timer: 0,
    sprays: null,
  };
  // closure, built once — never called with an allocation in the hot path
  s.sprays = function (px, pz) {
    if (!s.on) return false;
    const dx = px - s.x, dz = pz - s.z;
    const d2 = dx * dx + dz * dz;
    if (d2 > s.reach * s.reach || d2 < 0.16) return false;
    let da = Math.atan2(dz, dx) - s.angle;
    while (da >  Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    return da < s.spread && da > -s.spread;
  };
  envSprinklers.push(s);
  return s;
}

/** One InstancedMesh for every jet of every sprinkler. Built once, never resized. */
function envBuildSpray(root) {
  const n = envSprinklers.length * envSPRAY_JETS * envSPRAY_SEGS;
  if (n < 1) return;
  envSprayMesh = new THREE.InstancedMesh(
    envG.box, mat(PALETTE.foam, { transparent: true, opacity: 0.62 }), n);
  envSprayMesh.castShadow = false;
  envSprayMesh.receiveShadow = false;
  envSprayMesh.frustumCulled = false;   // instances move every frame
  envSprayMesh.visible = false;
  root.add(envSprayMesh);
}

/**
 * Sweep the rotors and fling the water. Every dash is placed on a ballistic
 * arc that lands back on the lawn at full reach. Zero allocations: envXform
 * writes the module scratch matrix and setMatrixAt copies out of it.
 */
function envSprayStep(game, dt) {
  const list = envSprinklers;
  if (!envSprayMesh || list.length < 1) return;
  envSprayAng += dt * 1.35;
  if (envSprayAng > Math.PI * 2) envSprayAng -= Math.PI * 2;
  const sweep = Math.sin(envSprayAng) * envSPRAY_SWEEP;
  const cp = game.capy && game.capy.position;
  let anyOn = false;
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    s.angle = s.base + sweep;
    if (cp) {
      const dx = cp.x - s.x, dz = cp.z - s.z;
      if (dx * dx + dz * dz < 1.3) {          // standing on the valve plate
        if (!s.on) { s.on = true; if (game.sfx) game.sfx('hiss'); }
        s.timer = envSPRINK_BURST;
      }
    }
    if (s.on) {
      s.timer -= dt;
      if (s.timer <= 0) { s.timer = 0; s.on = false; }
      else anyOn = true;
    }
  }
  if (!anyOn) { envSprayMesh.visible = false; return; }
  envSprayMesh.visible = true;
  let k = 0;
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    const live = s.on;
    for (let j = 0; j < envSPRAY_JETS; j++) {
      const a = s.angle + (j - (envSPRAY_JETS - 1) * 0.5) * envSPRAY_FAN;
      const ca = Math.cos(a), sa = Math.sin(a);
      // a box's local +z points along (sin yaw, cos yaw): yaw = PI/2 - a
      const yaw = Math.PI * 0.5 - a;
      for (let g = 0; g < envSPRAY_SEGS; g++) {
        if (!live) { envSprayMesh.setMatrixAt(k++, envXform(s.x, s.y, s.z, 0, 0, 0, 0, 0, 0)); continue; }
        const t = (g + 1) / envSPRAY_SEGS;
        const d = s.reach * t;
        const py = s.y * (1 - t) + envSPRAY_LIFT * 4 * t * (1 - t);
        const w = 0.055 + 0.085 * t;          // the jet breaks up as it flies
        envSprayMesh.setMatrixAt(k++, envXform(s.x + ca * d, py, s.z + sa * d,
                                               0, yaw, 0, w, w, 0.30 + 0.14 * t));
      }
    }
  }
  envSprayMesh.instanceMatrix.needsUpdate = true;
}

// ================================================================ MR WHIPPY ==
/** Cumulative arc length of the van's route, so speed is metres and not nodes. */
function envVanInitRoute() {
  envVanLen.length = 0;
  envVanLen.push(0);
  for (let i = 2; i < envVAN_ROUTE.length; i += 2) {
    envVanLen.push(envVanLen[envVanLen.length - 1] +
      Math.hypot(envVAN_ROUTE[i] - envVAN_ROUTE[i - 2], envVAN_ROUTE[i + 1] - envVAN_ROUTE[i - 1]));
  }
}

/** Point and heading at `u` metres along the route. Writes into `out`. */
function envVanAt(u, out) {
  const total = envVanLen[envVanLen.length - 1];
  const d = clamp(u, 0, total);
  let i = 1;
  while (i < envVanLen.length - 1 && envVanLen[i] < d) i++;
  const t = (d - envVanLen[i - 1]) / Math.max(0.001, envVanLen[i] - envVanLen[i - 1]);
  const x0 = envVAN_ROUTE[(i - 1) * 2], z0 = envVAN_ROUTE[(i - 1) * 2 + 1];
  const x1 = envVAN_ROUTE[i * 2], z1 = envVAN_ROUTE[i * 2 + 1];
  out.x = lerp(x0, x1, t);
  out.z = lerp(z0, z1, t);
  out.yaw = Math.atan2(x1 - x0, z1 - z0);
  return out;
}
const envVanAtTmp = { x: 0, z: 0, yaw: 0 };

function envBuildVan(game, root, material) {
  const V = envMerger(envBaseA);
  const HX = envVAN_HX, HZ = envVAN_HZ;
  // body: a high box for the servery, dropping to a lower bonnet at the front
  V.box(0, 1.16, -0.35, HX * 2, 1.56, HZ * 2 - 1.5, PALETTE.cloth6);
  V.box(0, 0.86, HZ - 0.62, HX * 2 - 0.10, 0.86, 1.24, PALETTE.cloth6);
  V.box(0, 1.40, HZ - 0.60, HX * 2 - 0.24, 0.52, 1.10, PALETTE.glass);
  V.box(0, 1.70, HZ - 0.70, HX * 2 - 0.28, 0.14, 0.90, PALETTE.cloth6);
  // The livery. One blue band at eye height, in the blue every van in the
  // country has on it, and a pink skirt under it so the silhouette is not three
  // whites in a row against the sail of the Opera House.
  V.box(0, 1.34, -0.35, HX * 2 + 0.06, 0.30, HZ * 2 - 1.42, PALETTE.cloth2);
  V.box(0, 0.56, -0.35, HX * 2 + 0.05, 0.26, HZ * 2 - 1.42, PALETTE.petalPink);
  // The roof, and it IS the deck: one flat plate, nothing on it to trip over.
  // FLUSH WITH THE SIDES, not proud of them — a five-centimetre lip over a flat
  // white wall at Sydney's sun angle is a shadow-map edge case, and it read as
  // herringbone down the entire side of the van.
  V.box(0, envVAN_ROOF - 0.05, -0.35, HX * 2 - 0.02, 0.14, HZ * 2 - 1.52, PALETTE.cloth3);
  // the serving hatch on the port side (local -x), propped open, and the
  // counter under it — that counter is the step, and it is the only way up
  V.box(-HX - 0.11, envVAN_HATCH - 0.06, -0.35, 0.56, 0.13, 2.10, PALETTE.metal);
  V.box(-HX - 0.20, 1.66, -0.35, 0.52, 0.07, 2.02, PALETTE.cloth3, 0, 0, 0.42);
  V.box(-HX + 0.02, 1.42, -0.35, 0.08, 0.52, 1.96, PALETTE.glass);
  // wheels
  for (let sx = -1; sx <= 1; sx += 2) {
    for (let sz = -1; sz <= 1; sz += 2) {
      V.cyl(sx * (HX - 0.06), 0.36, sz * (HZ - 0.85), 0.36, 0.24, PALETTE.ibisHead, 0, 0, Math.PI / 2, 8);
    }
  }
  V.box(0, 0.30, -HZ + 0.16, HX * 2 - 0.12, 0.22, 0.24, PALETTE.metal);

  const mesh = new THREE.Mesh(V.build(), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  envVanGroup = new THREE.Group();
  envVanGroup.name = 'whippy';
  envVanGroup.add(mesh);

  // The cone gets its own group so it can lean: a two-metre fibreglass 99 on
  // the roof that stays bolt upright through a corner is the one thing that
  // would make the whole van read as a static prop being slid about.
  const C = envMerger(envBaseA);
  // the wafer: a cone standing on its point, which the merger's cyl() cannot
  // make, so it goes through add() and envXform directly
  C.add(envG.cone6, envXform(0, 0.52, 0, Math.PI, 0, 0, 0.74, 1.04, 0.74), PALETTE.wood);
  // and the swirl on top of it, three turns and a flake
  C.cyl(0, 1.10, 0, 0.36, 0.30, PALETTE.cloth6, 0, 0, 0, 8);
  C.cyl(0, 1.35, 0, 0.28, 0.26, PALETTE.cloth6, 0, 0, 0, 8);
  C.cyl(0, 1.56, 0, 0.19, 0.22, PALETTE.cloth6, 0, 0, 0, 6);
  C.add(envG.cone6, envXform(0, 1.76, 0, 0, 0, 0, 0.26, 0.24, 0.26), PALETTE.cloth6);
  C.box(0.10, 1.90, 0, 0.07, 0.44, 0.07, PALETTE.cone, 0, 0, -0.22);
  const cone = new THREE.Mesh(C.build(), material);
  cone.castShadow = true;
  envVanCone = new THREE.Group();
  envVanCone.position.set(0, envVAN_ROOF, -1.10);
  envVanCone.add(cone);
  envVanGroup.add(envVanCone);
  root.add(envVanGroup);

  // Collision: the box you stand on, plus the counter you step up onto. Two
  // shapes and no more — the wheels and the cone are decoration, and a capybara
  // that can stand on a wing mirror is a capybara that gets stuck on one.
  const b = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, material: envGroundPhysMat });
  b.addShape(new CANNON.Box(new CANNON.Vec3(HX, envVAN_ROOF * 0.5, HZ)),
             new CANNON.Vec3(0, envVAN_ROOF * 0.5, 0));
  b.addShape(new CANNON.Box(new CANNON.Vec3(0.32, 0.07, 1.05)),
             new CANNON.Vec3(-HX - 0.13, envVAN_HATCH, -0.35));
  b.allowSleep = false;
  envVanInitRoute();
  envVanU = 0; envVanDir = 1; envVanDwell = envVAN_DWELL;
  envVanRideT = 0; envVanRideM = 0; envVanRode = false; envVanChimeT = 2.0;
  envVanAt(0, envVanAtTmp);
  envVanYaw = envVanAtTmp.yaw + Math.PI;   // she starts pointing west, down the run
  envVanPX = envVanAtTmp.x; envVanPZ = envVanAtTmp.z;
  b.position.set(envVanAtTmp.x, 0, envVanAtTmp.z);
  b.quaternion.setFromEuler(0, envVanYaw, 0);
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
  b.previousQuaternion.copy(b.quaternion);
  b.interpolatedQuaternion.copy(b.quaternion);
  game.world.addBody(b);
  envVanBody = b;
  envVanPos.set(b.position.x, 0, b.position.z);
  envVanGroup.position.copy(envVanPos);
  envVanGroup.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
  return b;
}

// ---------------------------------------------------------- THE QUEUE ------
// WHERE PEOPLE STAND WHEN SHE STOPS.
//
// Mr Whippy dwells eleven seconds at each end of the promenade and for the
// whole of that time she was the only van in the world nobody wanted anything
// from. npc.js reads these two: the spot is recomputed live off the van's own
// yaw, because she creeps for a second after the brake and a queue nailed to a
// stale transform stands in the road.
const envVanQ = { x: 0, z: 0 };
/** World point for the i-th place in the queue at the serving hatch. */
function envVanQueueSpot(i) {
  const cs = Math.cos(envVanYaw), sn = Math.sin(envVanYaw);
  // local: out to port of the hatch, then strung back along her own axis
  const lx = -(envVAN_HX + 1.55), lz = -0.35 + i * 1.15;
  envVanQ.x = envVanPos.x + sn * lz + cs * lx;
  envVanQ.z = envVanPos.z + cs * lz - sn * lx;
  return envVanQ;
}

/** True when `p` is standing on the van's ROOF, and not merely near the van. */
function envVanOnRoof(p) {
  const b = envVanBody;
  if (!b || !p) return false;
  envVanTmp.set(p.x - b.position.x, p.y - b.position.y, p.z - b.position.z);
  envVanQt.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w).invert();
  envVanTmp.applyQuaternion(envVanQt);
  return Math.abs(envVanTmp.x) < envVAN_HX + 0.34 && Math.abs(envVanTmp.z) < envVAN_HZ + 0.20 &&
         envVanTmp.y > envVAN_ROOF - 0.45 && envVanTmp.y < envVAN_ROOF + 2.2;
}

/**
 * Drive her up and down the promenade. Kinematic, moved by VELOCITY and never
 * by writing position — the same rule the ferry is on, and for the same reason:
 * it is the only thing cannon's friction will carry a passenger with.
 */
function envVanStep(game, dt) {
  const b = envVanBody;
  if (!b || dt <= 0) { if (b) { b.velocity.setZero(); b.angularVelocity.setZero(); } return; }
  const total = envVanLen[envVanLen.length - 1];

  if (envVanDwell > 0) {
    envVanDwell -= dt;
  } else {
    envVanU += envVAN_SPEED * dt * envVanDir;
    if (envVanU >= total) { envVanU = total; envVanDir = -1; envVanDwell = envVAN_DWELL; }
    else if (envVanU <= 0) { envVanU = 0; envVanDir = 1; envVanDwell = envVAN_DWELL; }
  }
  envVanAt(envVanU, envVanAtTmp);
  const tx = envVanAtTmp.x, tz = envVanAtTmp.z;
  // She drives the route BACKWARDS on the return leg, so the heading is the
  // tangent flipped — a van that reverses the length of the promenade is a
  // different and much worse joke.
  const tyaw = envVanAtTmp.yaw + (envVanDir > 0 ? Math.PI : 0);
  let d = tyaw - envVanYaw;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const turn = d * (1 - Math.exp(-2.2 * dt));
  envVanYaw += turn;

  envVanQt.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
  envEu.setFromQuaternion(envVanQt, 'YXZ');
  let dy = envVanYaw - envEu.y;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  b.angularVelocity.set(0, clamp(dy / dt, -2.0, 2.0), 0);
  // From the TARGET, not from the body — see the same note on envFerryStep.
  b.velocity.set(clamp((tx - envVanPX) / dt, -9, 9), 0, clamp((tz - envVanPZ) / dt, -9, 9));
  envVanPX = tx; envVanPZ = tz;

  envVanGroup.position.copy(b.interpolatedPosition);
  envVanGroup.quaternion.set(b.interpolatedQuaternion.x, b.interpolatedQuaternion.y,
                             b.interpolatedQuaternion.z, b.interpolatedQuaternion.w);
  envVanPos.copy(envVanGroup.position);
  // ---- ...AND SHE HAS AN ENGINE (A1) -------------------------------------
  // Chapter one's van has had a chime since the day it was written and has
  // never had a motor, so the one thing on the promenade that MOVES was a bell
  // sliding along a path with nothing under it. `b.velocity` is already the
  // world-space metres a second this kinematic body is driven on — see the
  // note above it — so the Doppler costs nothing to feed.
  if (!envVanMover && game.sfxMover) {
    envVanMover = game.sfxMover('diesel', { key: 'env:van', near: 12, far: 70 });
  }
  if (envVanMover) {
    envVanMover.at(envVanPos.x, envVanPos.y + 0.9, envVanPos.z);
    envVanMover.vel(b.velocity.x, 0, b.velocity.z);
    // She has no gearbox and no speed ramp — she is doing 3.15 or she is
    // parked — so the throttle is damped HERE rather than derived from a speed
    // that steps. It never reaches zero: a diesel at a stop is the most diesel
    // thing there is, and an idle that fades out is a van switched off.
    envVanThr = damp(envVanThr, envVanDwell > 0 ? 0.16 : 1, 2.4, dt);
    envVanMover.set(envVanThr);
  }
  // the cone leans out of the corner, and shivers on the paving
  if (envVanCone) {
    envVanCone.rotation.z = damp(envVanCone.rotation.z,
      clamp(-turn / Math.max(dt, 0.001) * 0.14, -0.30, 0.30), 6, dt);
    envVanCone.rotation.x = Math.sin(envTime * 5.1) * (envVanDwell > 0 ? 0.004 : 0.022);
  }

  // ---- the chime ---------------------------------------------------------
  // Only while she is rolling, and never while the player is a suburb away: an
  // ice cream van you cannot see is somebody else's ice cream van.
  envVanChimeT -= dt;
  const capy = game.capy;
  const riding = !!(capy && envVanOnRoof(capy.position));
  if (envVanChimeT <= 0) {
    const cp = capy && capy.position;
    const far = cp ? Math.hypot(cp.x - envVanPos.x, cp.z - envVanPos.z) : 999;
    if (envVanDwell <= 0 && far < 56) {
      envVanChimeT = riding ? envVAN_CHIME * 0.45 : envVAN_CHIME;
      // ...and it comes from the van. The hand-rolled rolloff was right about
      // distance and had no pan in it, so a van behind you and a van in front
      // of you sounded identical — and the ceiling was loud enough that a
      // chime every 5.4 s was competing with the score. Riding on the roof is
      // the one case that stays big, because then you ARE the ice cream van.
      // ...and it shifts with her, because it is ON her. The gates, the level
      // law and the roof case are exactly as they were — the only new thing is
      // that a chime coming toward you is a slightly higher chime, which is the
      // half of an ice cream van everybody can hear and nobody can name.
      game.sfx('chime', { volume: riding ? 0.50 : clamp(0.30 - far * 0.004, 0.05, 0.30),
                          pitch: 1.32 * (envVanMover ? envVanMover.rate() : 1),
                          at: { x: envVanPos.x, y: 1.6, z: envVanPos.z },
                          near: 12, far: 70 });
    } else {
      envVanChimeT = 1.5;
    }
  }

  // ---- 'whippy-run' ------------------------------------------------------
  // Twelve seconds ON THE ROOF, continuously. Not "reached the far end", which
  // would pay a two-second ride to anybody who climbed on at the last node, and
  // not "was ever aboard", which standing on the counter alone would satisfy.
  // AND HOW FAR, which is the better question. The tick is a switch and the
  // switch is thrown once; the promenade is sixty-two metres long and she
  // turns at both ends, so "how far did you ride in one go" is a number a
  // player can go back and beat. Measured in metres of ROUTE covered while
  // aboard and rolling, and posted when they get off — not while they are
  // still on, or the record board flickers all the way down the front.
  if (riding && envVanDwell <= 0) {
    envVanRideT += dt;
    envVanRideM += envVAN_SPEED * dt;
    // the metres, on the paper, while you are on the roof (v32). Eight is the
    // record's own floor four lines down — stepping on at a terminus and off
    // again is not a ride, and the line agrees with the record about that.
    if (game.recordLive && envVanRideM > 8) game.recordLive('whippy-run', envVanRideM);
    if (!envVanRode && envVanRideT >= envVAN_RIDE) {
      envVanRode = true;
      game.completeTask('whippy-run');
    }
  } else if (!riding) {
    // Eight metres, not one: stepping onto the roof at a terminus and off
    // again should not post a record, and the task is NOT the gate — a good
    // first run has to be allowed to be the first entry on the board.
    if (envVanRideM > 8 && typeof game.record === 'function') {
      game.record('whippy-run', envVanRideM);
    }
    envVanRideT = 0;
    envVanRideM = 0;
  }
}

// ============================================================== THE SEAPLANE ==
// NOT A TASK. Sydney had two things that moved — a van on the promenade and a
// ferry on a berth — and both of them are things you get ON. Nothing in this
// chapter ever simply happened somewhere else while you were busy.
//
// There has been a floatplane operation on this harbour since 1938 and there is
// one today: a yellow de Havilland Beaver that gets airborne off Rose Bay every
// twenty minutes or so and goes over the Bridge on the way north. You cannot
// board it, you cannot steal anything off it and it does not care that you are
// there. It taxis out, it runs, it comes unstuck, it does a wide circuit and it
// puts down again, and the only thing it asks of the player is that they look up.
//
// The whole cycle is ninety-four seconds so it is never the thing you are
// watching — it is the thing that turns out to have been happening.
const envPLANE_WATER = -0.5;
const envPLANE_MOOR = { x: -70, z: -34 };      // where she sits between runs
const envPLANE_RUN0 = { x: -66, z: -26 };      // start of the take-off run
const envPLANE_RUN1 = { x: -44, z: -14 };      // and unstuck about here
const envPLANE_CIRC = { x: -52, z: -22, r: 62 };
const envPLANE_CEIL = 58;
const envPLANE_TAXI = 13.0;                    // s idling at the mooring
const envPLANE_OUT = 7.0;                      // s taxiing to the start
const envPLANE_RUN = 8.0;                      // s of take-off run
const envPLANE_FLY = 48.0;                     // s of circuit
const envPLANE_LAND = 12.0;                    // s of approach and splashdown
let envPlaneGroup = null, envPlaneProp = null;
let envPlanePhase = 0;                         // 0 moored, 1 taxi, 2 run, 3 fly, 4 land
let envPlaneT = 0, envPlaneEng = 0;
// THE ATTITUDE IS DAMPED, THE PATH IS NOT. Each phase computes the yaw/pitch/
// roll it WANTS; these carry what is actually drawn. Every phase boundary is a
// step change in all three (the run leaves on the runway heading and the
// circuit's first tangent is 113 degrees off it; roll goes 0 to -0.30 in one
// frame), and while the aeroplane was also teleporting 45 m at the same instant
// nobody could see it. Fix the path and the snap is all that is left.
let envPlaneYawS = Math.PI, envPlanePitchS = 0, envPlaneRollS = 0;
let envPlaneMover = null;                      // her engine (A1)
let envPlaneAttInit = false;
const envPlanePos = new THREE.Vector3();

// ALWAYS through the dispatcher, never a bare synth: it is what supplies the
// default volume and pitch and what wraps every voice in a try/catch.
function envPlaneSfx(game, n, o) {
  if (game && typeof game.sfx === 'function') { try { game.sfx(n, o); } catch (e) { warnOnce('environment.sfx', e); } }
}

function envBuildSeaplane(root, material) {
  const P = envMerger(envBaseA);
  // A BEAVER IS A BOX WITH A HIGH WING AND TWO ENORMOUS FLOATS, and the floats
  // are half the read: from the gardens, at four hundred metres, what says
  // "seaplane" rather than "aeroplane" is the two white shoes under it.
  P.box(0, 0, -0.2, 1.10, 1.25, 6.40, PALETTE.planeYellow);
  P.box(0, 0.42, 1.35, 1.02, 0.60, 1.80, PALETTE.glass);
  P.box(0, -0.10, 3.30, 0.86, 0.92, 1.20, PALETTE.planeYellow, -0.18, 0, 0);
  P.box(0, 0.10, -3.30, 0.60, 0.70, 1.10, PALETTE.planeYellow);
  // the high wing, in one piece, and the struts down to the fuselage
  P.box(0, 1.02, 0.55, 10.40, 0.16, 1.65, PALETTE.planeYellow);
  P.box(0, 1.02, 0.55, 10.40, 0.06, 0.40, PALETTE.planeStripe);
  for (let s = -1; s <= 1; s += 2) {
    P.box(s * 1.30, 0.60, 0.55, 0.10, 0.90, 0.14, PALETTE.planeStrut, 0, 0, s * 0.22);
    P.box(s * 4.60, 1.06, 0.55, 0.90, 0.09, 1.10, PALETTE.planeStripe);
  }
  // tail: fin and a flat tailplane
  P.box(0, 1.10, -3.55, 0.12, 1.55, 1.30, PALETTE.planeYellow, -0.24, 0, 0);
  P.box(0, 0.42, -3.45, 3.40, 0.10, 0.85, PALETTE.planeYellow);
  P.box(0, 1.72, -3.85, 0.14, 0.55, 0.70, PALETTE.planeStripe, -0.24, 0, 0);
  // THE FLOATS. Long, boat-bottomed, and stepped a third of the way back —
  // that step is what lets one of these come unstuck at all.
  for (let s = -1; s <= 1; s += 2) {
    P.box(s * 1.28, -1.12, 0.10, 0.72, 0.52, 6.10, PALETTE.planeFloat);
    P.box(s * 1.28, -1.36, 0.90, 0.56, 0.22, 3.40, PALETTE.planeFloat);
    P.box(s * 1.28, -0.86, 3.05, 0.60, 0.44, 1.10, PALETTE.planeFloat, -0.30, 0, 0);
    P.box(s * 1.28, -0.42, 0.90, 0.11, 0.90, 0.11, PALETTE.planeStrut);
    P.box(s * 1.28, -0.42, -2.10, 0.11, 0.90, 0.11, PALETTE.planeStrut);
  }
  const mesh = new THREE.Mesh(P.build(), material);
  mesh.castShadow = true;
  envPlaneGroup = new THREE.Group();
  envPlaneGroup.name = 'seaplane';
  envPlaneGroup.add(mesh);

  // The propeller is its own group and it is drawn as a DISC, not as blades: at
  // any engine speed worth drawing, a propeller is a translucent grey circle,
  // and two spinning boxes at 30 fps is a strobe.
  const R = envMerger(envBaseA);
  R.cyl(0, 0, 0, 1.30, 0.05, PALETTE.planeDisc, Math.PI / 2, 0, 0, 8);
  R.box(0, 0, 0.03, 0.16, 2.55, 0.06, PALETTE.planeStrut);
  const disc = new THREE.Mesh(R.build(), material);
  envPlaneProp = new THREE.Group();
  envPlaneProp.position.set(0, -0.10, 3.95);
  envPlaneProp.add(disc);
  envPlaneGroup.add(envPlaneProp);
  root.add(envPlaneGroup);
  envPlanePhase = 0; envPlaneT = 0;
  envPlaneGroup.position.set(envPLANE_MOOR.x, envPLANE_WATER + 1.15, envPLANE_MOOR.z);
  envPlanePos.copy(envPlaneGroup.position);
}

function envPlaneStep(game, dt) {
  if (!envPlaneGroup) return;
  envPlaneT += dt;
  let x, y, z, yaw, pitch = 0, roll = 0, rpm = 0.2;
  const sit = envPLANE_WATER + 1.15;

  if (envPlanePhase === 0) {
    x = envPLANE_MOOR.x; z = envPLANE_MOOR.z;
    y = sit + Math.sin(envPlaneT * 0.9) * 0.05;
    yaw = 2.1;
    roll = Math.sin(envPlaneT * 0.7) * 0.03;
    if (envPlaneT > envPLANE_TAXI) { envPlanePhase = 1; envPlaneT = 0; }
  } else if (envPlanePhase === 1) {
    const u = clamp(envPlaneT / envPLANE_OUT, 0, 1);
    x = lerp(envPLANE_MOOR.x, envPLANE_RUN0.x, u);
    z = lerp(envPLANE_MOOR.z, envPLANE_RUN0.z, u);
    y = sit + Math.sin(envPlaneT * 1.4) * 0.04;
    yaw = Math.atan2(envPLANE_RUN1.x - x, envPLANE_RUN1.z - z);
    rpm = 0.45;
    if (u >= 1) {
      envPlanePhase = 2; envPlaneT = 0;
      envPlaneSfx(game, 'hiss', { volume: 0.30, pitch: 0.42 });
    }
  } else if (envPlanePhase === 2) {
    // THE RUN. She sits back on the step for the first half and then the nose
    // comes down, which is the one bit of aeroplane behaviour worth animating:
    // a floatplane getting away is nose-UP, then nose-down, then gone.
    const u = clamp(envPlaneT / envPLANE_RUN, 0, 1);
    const s = u * u;
    x = lerp(envPLANE_RUN0.x, envPLANE_RUN1.x, s);
    z = lerp(envPLANE_RUN0.z, envPLANE_RUN1.z, s);
    y = sit + Math.max(0, (u - 0.72) / 0.28) * 5.5 + Math.sin(envPlaneT * 12) * 0.05 * (1 - u);
    yaw = Math.atan2(envPLANE_RUN1.x - envPLANE_RUN0.x, envPLANE_RUN1.z - envPLANE_RUN0.z);
    pitch = u < 0.55 ? -0.16 * (u / 0.55) : -0.16 + 0.30 * ((u - 0.55) / 0.45);
    rpm = 1;
    if (u >= 1) { envPlanePhase = 3; envPlaneT = 0; }
  } else if (envPlanePhase === 3) {
    const u = clamp(envPlaneT / envPLANE_FLY, 0, 1);
    // one wide left-hand circuit, climbing for the first third and levelling
    const a = Math.atan2(envPLANE_RUN1.z - envPLANE_CIRC.z, envPLANE_RUN1.x - envPLANE_CIRC.x)
              + u * Math.PI * 2;
    const ex = envPLANE_CIRC.x + Math.cos(a) * envPLANE_CIRC.r;
    const ez = envPLANE_CIRC.z + Math.sin(a) * envPLANE_CIRC.r * 0.8;
    // ---- AND SHE HAS TO JOIN IT FROM WHERE SHE LEFT THE WATER --------------
    // The circuit's start angle is taken from RUN1's BEARING off the centre,
    // which is not the same thing as RUN1 being ON the circle: RUN1 is 11.3 m
    // from the centre and the radius is 62, so u = 0 sat 44.9 m away from the
    // point the take-off run had just ended on. She jumped that gap in one
    // frame at six metres over the gardens, and again at the top of the
    // circuit at fifty-eight, twice per ninety-four second cycle.
    //
    // The circuit itself is authored — centre, radius, the 0.8 squash and the
    // ceiling are all deliberate — so it is not moved. She flies ON to it over
    // the first tenth and OFF it over the last, which is what an aeroplane
    // joining and leaving a circuit does anyway.
    const join = clamp(u / 0.10, 0, 1);
    const leave = clamp((1 - u) / 0.10, 0, 1);
    const k = Math.min(join, leave);
    const ks = k * k * (3 - 2 * k);
    x = lerp(envPLANE_RUN1.x, ex, ks);
    z = lerp(envPLANE_RUN1.z, ez, ks);
    y = lerp(sit + 5.5, envPLANE_CEIL, clamp(u / 0.34, 0, 1));
    const a2 = a + 0.05;
    const nx = envPLANE_CIRC.x + Math.cos(a2) * envPLANE_CIRC.r;
    const nz = envPLANE_CIRC.z + Math.sin(a2) * envPLANE_CIRC.r * 0.8;
    yaw = Math.atan2(nx - ex, nz - ez);
    roll = -0.30;
    pitch = u < 0.34 ? 0.13 : 0.0;
    rpm = 1;
    if (u >= 1) { envPlanePhase = 4; envPlaneT = 0; }
  } else {
    const u = clamp(envPlaneT / envPLANE_LAND, 0, 1);
    // the approach: down the length of the run, backwards, and she flares
    x = lerp(envPLANE_RUN1.x, envPLANE_MOOR.x, u);
    z = lerp(envPLANE_RUN1.z, envPLANE_MOOR.z, u);
    y = lerp(envPLANE_CEIL, sit, u * u * (3 - 2 * u));
    yaw = Math.atan2(envPLANE_MOOR.x - envPLANE_RUN1.x, envPLANE_MOOR.z - envPLANE_RUN1.z);
    pitch = 0.10 - 0.22 * clamp((u - 0.72) / 0.28, 0, 1);
    rpm = 1 - u * 0.6;
    if (u >= 1) {
      envPlanePhase = 0; envPlaneT = 0;
      envPlaneSfx(game, 'splash', { volume: 0.42, pitch: 0.75 });
    }
  }

  envPlaneGroup.position.set(x, y, z);
  // The phase gives the attitude it WANTS; she turns on to it. First frame
  // snaps, or she would swing round from whatever the last chapter left here.
  if (!envPlaneAttInit) {
    envPlaneAttInit = true;
    envPlaneYawS = yaw; envPlanePitchS = pitch; envPlaneRollS = roll;
  } else {
    envPlaneYawS = dampAngle(envPlaneYawS, yaw, 2.2, dt);
    envPlanePitchS = damp(envPlanePitchS, pitch, 3.0, dt);
    envPlaneRollS = damp(envPlaneRollS, roll, 3.0, dt);
  }
  envPlaneGroup.rotation.set(envPlanePitchS, envPlaneYawS, envPlaneRollS, 'YXZ');
  // ---- ...AND SHE HOLDS A NOTE NOW (A1) ----------------------------------
  // The four rationed notes below are the right answer to the wrong problem: a
  // one-shot repeated on a timer is a pulse whatever you do to the gap, and the
  // thing an aeroplane actually does is hold ONE note and move it past you.
  //
  // The velocity is derived, because this phase machine computes an absolute
  // point every frame and stores no velocity at all — so it must be taken
  // BEFORE envPlanePos is overwritten on the next line, and it must be thrown
  // away when it is absurd: every phase boundary is a step change in the path
  // and a 45 m jump over one frame is not an aeroplane doing 2,700 m/s.
  if (!envPlaneMover && game.sfxMover) {
    envPlaneMover = game.sfxMover('prop', { key: 'env:plane', near: 20, far: 400 });
  }
  if (envPlaneMover) {
    let vx = 0, vy = 0, vz = 0;
    if (dt > 0.0005) {
      vx = (x - envPlanePos.x) / dt; vy = (y - envPlanePos.y) / dt; vz = (z - envPlanePos.z) / dt;
      if (vx * vx + vy * vy + vz * vz > 6400) { vx = 0; vy = 0; vz = 0; }
    }
    envPlaneMover.at(x, y, z);
    envPlaneMover.vel(vx, vy, vz);
    envPlaneMover.set(clamp(rpm, 0, 1));
    // At the mooring the engine is OFF, which is not the same as idling and is
    // what the note below has always claimed. `amp` is the switch; `set` is the
    // throttle. See THE MOVER.
    envPlaneMover.amp(envPlanePhase === 0 ? 0 : 1);
  }
  envPlanePos.set(x, y, z);
  if (envPlaneProp) envPlaneProp.rotation.z += (2 + rpm * 26) * dt;

  // ---- the engine --------------------------------------------------------
  // A radial at full power a hundred metres away is the loudest thing on this
  // harbour, and at four hundred it is nothing. One note every 1.4 s while she
  // is working, scaled by distance and silent at the mooring: a drone on a loop
  // is the fastest way to make a nice thing into an irritation.
  // ...AND THE COMMENT ABOVE WAS RIGHT ABOUT THE DANGER AND WRONG ABOUT THE
  // NUMBERS. One note every 1.4 s is not 'occasional', it is a pulse; and 150 m
  // is not 'nearby', it is the whole of Sydney - the harbour is 160 m across.
  // So the plane was audible for sixty-eight seconds out of every seventy-five,
  // wherever the player stood, at a note every 1.4 seconds. Measured idle for
  // fourteen seconds on the promenade: ELEVEN of them, which is far and away
  // the loudest thing in the chapter and the source of most of the 'something
  // keeps making a noise' in Sydney.
  //
  // Eighty-five metres, and the gap OPENS WITH DISTANCE rather than being flat:
  // overhead she is a machine you can hear working, and from the far side of
  // the gardens she is a sound you notice twice and then forget. Four notes in
  // fourteen seconds close in, one at the edge of earshot.
  //
  // ...AND THE MOVER ABOVE MADE THE WHOLE OF IT UNNECESSARY (A1). Every number
  // in the paragraph above is a workaround for the same missing thing: there
  // was no way to say "this engine is running" and so the gap between notes had
  // to carry the distance, the phase and the level at once. A continuous voice
  // says it directly, and the rationing that was protecting the player from a
  // pulse is protecting them from nothing now. The one-shot is gone; keeping it
  // under the mover would be the plane twice, and the four-note pulse is the
  // half a listener would notice.
  envPlaneEng = 0;
}

// ================================================================ LORIKEETS ==
// SYDNEY'S TREES WERE FURNITURE.
//
// Thirteen Moreton Bay figs and eight jacarandas, every one of them a silent
// green blob you walk under and never look at again. There are rainbow
// lorikeets in every one of those trees in life and they are the loudest thing
// in the Domain — they do not sing, they SCREAM, and they do it thirty at a
// time at four in the afternoon.
//
// So: a bird in a canopy is a thing that is simply there, and a bird that
// LEAVES when you walk under it is a thing you did. The flush is free — no
// task, no tick, no counter — it re-arms in nine seconds, and it is the only
// interaction in the chapter that costs the player nothing at all and pays out
// every single time. That ratio is the point; see the ambient-mover rules —
// repeatable, ignorable, and never in the way.
const envLORI_N = 26;                   // birds, total
const envLORI_R = 6.2;                  // m — walk this close to the trunk and they go
const envLORI_UP = 7.2;                 // s — perch to perch, the whole arc
const envLORI_STRIDE = 9;               // floats per bird
let envLoriMesh = null;
let envLoriData = null;
let envLoriTrees = null;                // x, z, canopy y, cooldown  (4 per tree)
let envLoriIn = null;                    // per tree: was the capybara inside its radius last frame
let envLoriSeen = false;

/** One bird: body, breast, head, beak, tail, two wings. */
function envLorikeetGeo() {
  const B = envMerger(envBaseA);
  B.add(envG.sph6, envXform(0, 0, 0, 0, 0, 0, 0.20, 0.17, 0.30), PALETTE.leafC);
  B.add(envG.sph6, envXform(0, -0.03, 0.06, 0, 0, 0, 0.18, 0.14, 0.20), PALETTE.petalRed);
  B.add(envG.sph6, envXform(0, 0.07, 0.15, 0, 0, 0, 0.15, 0.15, 0.15), PALETTE.petalBlue);
  B.add(envG.cone4, envXform(0, 0.05, 0.24, Math.PI * 0.5, 0, 0, 0.07, 0.10, 0.07), PALETTE.petalYellow);
  B.add(envG.box, envXform(0, 0.02, -0.24, 0, 0, 0, 0.09, 0.03, 0.26), PALETTE.leafA);
  B.add(envG.box, envXform(-0.13, 0.04, -0.02, 0, 0.16, 0.30, 0.07, 0.04, 0.26), PALETTE.leafA);
  B.add(envG.box, envXform(0.13, 0.04, -0.02, 0, -0.16, -0.30, 0.07, 0.04, 0.26), PALETTE.leafA);
  return B.build();
}

/**
 * Perches, drawn from the canopies that actually exist. Both spot tables are
 * module constants, so this cannot drift out of step with the trees the way a
 * hand-written list would.
 */
function envBuildLorikeets(root) {
  // x, z, perch height, cooldown, canopy radius — five per tree.
  //
  // THE FIRST CUT PUT THEM INSIDE THE LEAVES. A fig canopy here is five
  // overlapping spheres of radius ~2 centred 2.1 m out from the trunk at
  // y = 4.9, so a bird at the canopy CENTRE is buried in solid green and the
  // whole flock was invisible until it flushed. They sit on the outer shell,
  // a metre above the blob centres — which is also where a lorikeet actually
  // sits, out on the thin stuff at the end of a branch.
  const trees = [];
  for (let i = 0; i < envFIG_SPOTS.length; i++) trees.push(envFIG_SPOTS[i][0], envFIG_SPOTS[i][1], 6.3, 0, 3.1);
  for (let i = 0; i < envJAC_SPOTS.length; i++) trees.push(envJAC_SPOTS[i][0], envJAC_SPOTS[i][1], 4.4, 0, 2.2);
  envLoriTrees = trees;
  envLoriIn = new Uint8Array(trees.length / 5);
  const nT = trees.length / 5;

  envLoriData = new Float32Array(envLORI_N * envLORI_STRIDE);
  for (let i = 0; i < envLORI_N; i++) {
    const t = i % nT;                    // one each, then round again — never a bare tree
    const o = i * envLORI_STRIDE;
    const a = envRR(0, 6.283), r = trees[t * 5 + 4] * envRR(0.72, 1.06);
    envLoriData[o]     = trees[t * 5] + Math.cos(a) * r;
    envLoriData[o + 1] = trees[t * 5 + 2] + envRR(-0.55, 0.55);
    envLoriData[o + 2] = trees[t * 5 + 1] + Math.sin(a) * r;
    envLoriData[o + 3] = envRR(0, 6.283);
    envLoriData[o + 4] = -1;             // <0 = sitting; >=0 = seconds into the arc
    envLoriData[o + 5] = envRR(0, 6.283);
    envLoriData[o + 6] = envRR(0.85, 1.25);
    envLoriData[o + 7] = envRnd() < 0.5 ? -1 : 1;
    envLoriData[o + 8] = t;              // which tree it belongs to
  }

  const im = new THREE.InstancedMesh(envLorikeetGeo(),
    mat(envVC_BASE, { vertexColors: true }), envLORI_N);
  im.name = 'envLorikeets';
  im.castShadow = false;                 // 26 shadow casters for a 30 cm bird is not a trade
  im.receiveShadow = false;
  im.frustumCulled = false;
  envLoriMesh = im;
  root.add(im);
}

/** Everything in one tree leaves at once — that is what makes it read as a flock. */
function envFlushTree(game, t, loud) {
  const T = envLoriTrees;
  if (!T || T[t * 5 + 3] > 0) return false;
  let any = false;
  for (let i = 0; i < envLORI_N; i++) {
    const o = i * envLORI_STRIDE;
    if (envLoriData[o + 8] !== t || envLoriData[o + 4] >= 0) continue;
    envLoriData[o + 4] = 0;
    any = true;
  }
  if (!any) return false;
  T[t * 5 + 3] = envLORI_UP + 1.8;       // the arc, plus a beat to settle
  if (typeof game.sfx === 'function') {
    // A lorikeet is a gull's voice a fifth higher and half as long. Jittered on
    // both axes, because a flock that screeches on one pitch is a car alarm —
    // nothing in this game's ambience is allowed to be periodic.
    // ...AND IT COMES FROM THE TREE, NOT FROM INSIDE YOUR HEAD.
    // Two sounds at 0.42 and 0.50, both dead centre, ten times in ninety
    // seconds while the player stood perfectly still: between them the second
    // loudest thing in the chapter after the busker, and the reason a quiet
    // lawn read as a racket. The flock is a real event and it keeps its bite
    // when it is YOUR wheek that put them up (`loud`); what it stops being is
    // a thing that happens at full volume in the middle of your skull while
    // you are forty metres away doing nothing.
    // ...AND NOW THEY ACTUALLY GO SOMEWHERE (A3).
    // Everything above is still true and none of it changes: the event is
    // right, the arrival edge is right, the levels are right. What was missing
    // is that a flush is MOVEMENT — the two sounds happened AT the tree and
    // then it was over, so the one thing a scattering flock is for, telling you
    // which way something went, was the one thing it could not say. The burst
    // puts a wing-clap at eight instants along the arc the birds take, each one
    // placed where they actually are at that instant, and the cries ride the
    // same path. `spread` is smaller when it was not your wheek: birds that
    // went up because you wandered past do not clear the garden.
    const at = { x: T[t * 5], y: T[t * 5 + 2], z: T[t * 5 + 1] };   // x, canopy y, z
    const flaps = typeof game.wingburst === 'function'
      ? game.wingburst(at.x, at.y, at.z, { key: 'syd:fig' + t, near: 10, far: 90,
                                           n: loud ? 12 : 8, spread: loud ? 1 : 0.7,
                                           volume: loud ? 1 : 0.7, pitch: 1.18 })
      : 0;
    // The rustle stays and the gull does not: the burst carries its own cries
    // along the path, and the leaves are the one part of this that is genuinely
    // still at the tree. If the burst was culled or throttled, the old pair is
    // exactly what plays — silence is never the fallback for a payoff.
    if (!flaps) {
      game.sfx('gull', { volume: loud ? 0.34 : 0.20, pitch: rand(1.62, 1.86),
                         at: at, near: 10, far: 90 });
    }
    game.sfx('rustle', { volume: loud ? 0.28 : 0.17, pitch: rand(1.1, 1.35),
                         at: at, near: 10, far: 90 });
  }
  return true;
}

function envLoriStep(game, dt) {
  if (!envLoriMesh || !envLoriData) return;
  const T = envLoriTrees, nT = T.length / 5;
  const cp = game.capy && game.capy.position;
  // A wheek under the canopy takes the whole tree from further out; walking
  // under it takes it too, but the cooldown means a lap of the gardens is a
  // handful of separate flushes and not one continuous shriek.
  const wheeked = !!(game.input && game.input.honkPressed);
  for (let t = 0; t < nT; t++) {
    if (T[t * 5 + 3] > 0) { T[t * 5 + 3] -= dt; continue; }
    if (!cp) continue;
    const dx = cp.x - T[t * 5], dz = cp.z - T[t * 5 + 1];
    const r = wheeked ? envLORI_R * 2.6 : envLORI_R;
    const inside = dx * dx + dz * dz <= r * r;
    // ---- A FLUSH IS AN ARRIVAL, NOT A PLACE YOU CAN STAND ----------------
    // The test was `is the capybara within r`, so a player standing under a
    // fig — and the spawn is under one — put the same flock up every time the
    // cooldown expired, for ever: ten flushes in ninety seconds without
    // moving a centimetre, which is most of what Sydney's "random noise" was.
    // Birds that have been put up do not come back and get put up again by an
    // animal that has not moved. So it fires on the RISING EDGE of walking
    // into the canopy, and a wheek is always allowed to take them because
    // that is the player asking for it.
    const was = envLoriIn ? envLoriIn[t] : 0;
    if (envLoriIn) envLoriIn[t] = inside ? 1 : 0;
    if (!inside) continue;
    if (was && !wheeked) continue;
    if (envFlushTree(game, t, wheeked) && !envLoriSeen) {
      envLoriSeen = true;
      if (typeof game.toast === 'function') game.toast('the figs were full of lorikeets, apparently');
    }
  }

  for (let i = 0; i < envLORI_N; i++) {
    const o = i * envLORI_STRIDE;
    let x = envLoriData[o], y = envLoriData[o + 1], z = envLoriData[o + 2];
    let yaw = envLoriData[o + 5], roll = 0, sc = envLoriData[o + 6];
    const f = envLoriData[o + 4];
    if (f < 0) {
      // sitting: a shuffle along the branch, and a head that is never still
      const ph = envLoriData[o + 3];
      y += Math.sin(envTime * 1.9 + ph) * 0.035;
      yaw += Math.sin(envTime * 0.55 + ph) * 0.55;
      roll = Math.sin(envTime * 3.1 + ph) * 0.05;
    } else {
      const u = clamp(f / envLORI_UP, 0, 1);
      const arc = Math.sin(u * Math.PI);
      const spin = envLoriData[o + 7] * (u * 5.6) + envLoriData[o + 3];
      const rr = arc * (4.5 + (i % 5) * 2.2);
      x += Math.cos(spin) * rr;
      z += Math.sin(spin) * rr;
      y += arc * (3.4 + (i % 4) * 1.6);
      yaw = -spin + Math.PI * 0.5;
      roll = 0.55 * envLoriData[o + 7] * arc + Math.sin(envTime * 22 + i) * 0.30;
      sc *= 1 + arc * 0.10;
      const nf = f + dt;
      envLoriData[o + 4] = nf >= envLORI_UP ? -1 : nf;
    }
    envLoriMesh.setMatrixAt(i, envXform(x, y, z, roll, yaw, 0, sc, sc, sc));
  }
  envLoriMesh.instanceMatrix.needsUpdate = true;
}

// ============================================================== THE SUN PATH ==
// SYDNEY'S HARBOUR HAD NO LIGHT ON IT.
//
// The water is the biggest single surface in the chapter — a hundred and forty
// metres of it filling the top third of every shot out over the Opera House —
// and it was a flat ripple in two blues with nothing happening on it at all.
// Chapter 3 has had a sun path since it was written and it is the single
// biggest reason that harbour looks like water and this one looks like a
// tabletop.
//
// The same trick, and the same two lessons that were learned the expensive way
// over there:
//   - It must be laid on the ACTUAL surface, not on the datum. envWaterHeightAt
//     swings ±0.18 and a decal at a fixed height spends most of its life
//     behind the ripple mesh, chopped into flickering bands.
//   - The lozenges are LONG AND THIN and they follow the camera, so the path
//     always lies between the eye and the sun. Square patches at low opacity
//     read as litter on the water rather than as light on it.
const envGLIT_N = 96;
let envGlitter = null, envGlitData = null;

function envBuildGlitter() {
  const N = envGLIT_N;
  envGlitData = new Float32Array(N * 6);        // dx, dz, yaw, w, l, phase
  for (let i = 0; i < N; i++) {
    const d = 14 + i * 1.9;                     // out to ~200 m, thickening near
    const sp = 2.4 + i * 0.22;
    const o = i * 6;
    envGlitData[o] = envRR(-sp, sp);
    envGlitData[o + 1] = -d + envRR(-3.5, 3.5);
    envGlitData[o + 2] = envRR(-0.12, 0.12);
    envGlitData[o + 3] = envRR(0.3, 0.85);
    envGlitData[o + 4] = envRR(2.2, 6.4);
    envGlitData[o + 5] = envRR(0, Math.PI * 2);
  }
  const im = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    mat(PALETTE.seaGlitter, { transparent: true, opacity: 0.16, depthWrite: false, fog: false }),
    N);
  im.name = 'envGlitter';
  im.frustumCulled = false;
  im.castShadow = false; im.receiveShadow = false;
  im.renderOrder = 2;
  envGlitter = im;
  return im;
}

function envGlitStep(game) {
  const im = envGlitter;
  if (!im || !game.camera || !envGlitData) return;
  const cx = game.camera.position.x, cz = game.camera.position.z;
  for (let i = 0; i < envGLIT_N; i++) {
    const o = i * 6;
    const x = cx + envGlitData[o], z = cz + envGlitData[o + 1];
    // …and NOT on the land. The harbour is everything north of z = -10, and a
    // lozenge of sunlight lying across the Opera House podium is a bug you can
    // see from the far end of the gardens.
    if (z > -10.6 || !envIsOverWaterFast(x, z)) {
      im.setMatrixAt(i, envXform(0, -900, 0, 0, 0, 0, 0.001, 0.001, 0.001));
      continue;
    }
    const k = 0.55 + 0.45 * Math.sin(envTime * 1.7 + envGlitData[o + 5]);
    im.setMatrixAt(i, envXform(x, envWaterY(x, z) + 0.05, z,
                               -Math.PI / 2, envGlitData[o + 2], 0,
                               envGlitData[o + 3] * (0.6 + k * 0.7),
                               envGlitData[o + 4], 1));
  }
  im.instanceMatrix.needsUpdate = true;
}

/** The two solid things standing in the harbour, without the closure lookup. */
function envIsOverWaterFast(x, z) {
  if (x >= -13.4 && x <= 13.4 && z >= -12.4) return false;   // opera podium
  if (x >= -43.7 && x <= -36.3 && z >= -24.4) return false;  // ferry wharf
  return true;
}

/** Module-scope twin of the closure's envWaterHeightAt — identical maths. */
function envWaterY(x, z) {
  return -0.5 + Math.sin(x * 0.09 + envTime * 0.9) * 0.10
              + Math.sin(z * 0.14 - envTime * 0.7) * 0.08;
}

// ============================================================ HARBOUR TRAFFIC ==
// THE BIGGEST SURFACE IN THE CHAPTER HAD TWO THINGS ON IT.
//
// Sydney's harbour runs from z = -10 to the far shore at -126 and fills the top
// third of every shot that faces the Opera House. On it: one ferry, on a berth,
// and one seaplane, for ninety-four seconds out of every ninety-four. The rest
// is a hundred and sixteen metres of unbroken blue — and Sydney Harbour is one
// of the busiest stretches of water in the southern hemisphere.
//
// Nine sails and two small ferries, on slow independent reaches, all of them
// beyond z = -46, and no wakes to write. Two instanced draws for the lot.
//
// ---- "NO WAY FOR THE PLAYER TO REACH THEM" WAS NOT TRUE (X8) -------------
// That is what this comment used to say, and it is what justified drawing
// eleven hulls with no colliders in them. The chapter's own `bounds()` says
// otherwise: the harbour rectangle is x +/-140, z -150..-8, and the comment on
// THAT says "the seabed body under it is wider still, so swimming to the far
// shore stays legal". Every one of the eleven is inside it.
//
// Measured (qa/px-syd-traf.js): put down at z -140 the animal swims, is not
// out of bounds and the rescue does not fire; and swimming north from the sea
// wall on one held key for twenty seconds it reaches z -66.8 and passes within
// 6.8 m of a hull. So they are reachable in about the time it takes to get
// there, and a boat you can swim through is the failure the solid audit exists
// to catch.
//
// They are KINEMATIC and they write velocity AND position: velocity because
// that is the only thing cannon's friction carries a passenger with, position
// because the drawn instance is placed analytically from envTime and a
// velocity-only body drifts away from its own picture on any frame longer than
// five substeps. See A KINEMATIC CARRIER in CONTRACT.md.
//
// The periods are deliberately co-prime-ish and none of them is a multiple of
// another, so the fleet never lines up into a pattern the eye can catch —
// the same rule the ambience is on.
// ---- AND NO LEG LEAVES THE WORLD (X8) ------------------------------------
// The two ferries ran from x -150 to +150 and the harbour the player is allowed
// in is x +/-140, so both of them turned round 10 m outside it — which did not
// matter while they were scenery and matters the moment they are things you can
// climb onto: a ride to the end of that leg carries the animal out of bounds and
// into the rescue, and being teleported off your own boat is a worse bug than
// swimming through it. Found by a probe that put the animal at the ferry's
// centre and got back seven frames of "outside" and a rescue rather than a
// collision (qa/px-syd-traf4.js). 138, twice, and one sail that touched -140.
// At forty to a hundred metres out, twelve metres of turn is not a picture.
const envTRAF = [
  //  x0     z0     x1     z1   period  kind (0 sail, 1 ferry)
  [-108, -58,  -18, -74,  96, 0],
  [ -22, -70,   84, -56, 112, 0],
  [  72, -92,  -46, -80, 128, 0],
  [-120, -96,   16, -108, 104, 0],
  [  34, -104, 132, -88,  88, 0],
  [-138, -120, -20, -114, 146, 0],
  [ 118, -122,  -8, -130, 158, 0],
  [ -74, -46,   26, -52,  74, 0],
  [  92, -64,  -60, -68, 134, 0],
  [-138, -84,  138, -78, 172, 1],
  [ 138, -110, -138, -100, 196, 1],
];
let envTrafHull = null, envTrafSail = null;
// One kinematic hull per instance, plus the PREVIOUS TARGET each velocity is
// differenced against — never the body's own position, which cannon has already
// integrated by the time this module runs. Rule 3.
const envTrafBody = [];
const envTrafPX = [], envTrafPZ = [], envTrafYaw = [];
// The drawn hull is 1.6 x 0.66 x 6.6 at local y 0.10, with a boot down to -0.37
// and a deck up to 0.50 — so one box over local -0.37..0.50 is the whole of
// what a swimmer can meet. Scaled per instance exactly as the drawing is.
const envTRAF_HX = 0.80, envTRAF_HY = 0.435, envTRAF_HZ = 3.30, envTRAF_CY = 0.065;
const envTrafEu = new THREE.Euler();
const envTrafQt = new THREE.Quaternion();
/** The house idiom — monSyncBody, driSyncBody, quaySyncBody. A body whose
 *  position is written by hand must have its interpolation pair written too,
 *  or anything reading interpolatedPosition lerps from a stale previous. */
function envSyncBody(b) {
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
  b.previousQuaternion.copy(b.quaternion);
  b.interpolatedQuaternion.copy(b.quaternion);
}

function envBuildTraffic(game, root, material) {
  const n = envTRAF.length;
  // the hull: one shape, scaled per instance so a ferry is simply a bigger,
  // squarer version of the same silhouette at this distance
  const H = envMerger(envBaseA);
  H.box(0, 0.10, 0, 1.6, 0.66, 6.6, PALETTE.cloth4);
  H.box(0, -0.22, 0, 1.4, 0.30, 6.2, PALETTE.hiVis);
  H.box(0, 0.42, 0, 1.2, 0.16, 5.0, PALETTE.cloth3);
  H.box(0, 0.90, -0.9, 0.9, 0.80, 1.6, PALETTE.sail);
  envTrafHull = new THREE.InstancedMesh(H.build(), material, n);
  envTrafHull.name = 'envTraffic';
  envTrafHull.castShadow = false;      // forty to a hundred metres out; nothing to cast onto
  envTrafHull.receiveShadow = false;
  envTrafHull.frustumCulled = false;
  root.add(envTrafHull);

  const S = new THREE.BufferGeometry();
  S.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0.4, 0.4, 0, 7.6, 0.6, 0, 0.5, -3.2,
    0, 0.4, 0.7, 0, 6.0, 0.7, 0, 0.5, 3.1,
  ], 3));
  S.setIndex([0, 1, 2, 3, 4, 5]);
  S.computeVertexNormals();
  envTrafSail = new THREE.InstancedMesh(S, mat(PALETTE.sail, { side: THREE.DoubleSide, fog: true }), n);
  envTrafSail.name = 'envTrafficSails';
  envTrafSail.castShadow = false;
  envTrafSail.frustumCulled = false;
  root.add(envTrafSail);

  // ---- eleven hulls, one body each ---------------------------------------
  // allowSleep false, because a sleeping body is skipped in narrowphase and a
  // hull that stops existing under a swimmer is the worst version of this bug
  // rather than a fix for it. Rule 1.
  for (let i = 0; i < n; i++) {
    const sc = envTRAF[i][5] === 1 ? 2.1 : 1;
    const b = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC,
                                material: envGroundPhysMat });
    b.allowSleep = false;
    b.addShape(new CANNON.Box(new CANNON.Vec3(envTRAF_HX * sc,
                                              envTRAF_HY * sc * 0.9,
                                              envTRAF_HZ * sc)));
    b.position.set(envTRAF[i][0], -0.42, envTRAF[i][1]);
    game.world.addBody(b);
    envTrafBody.push(b);
    envTrafPX.push(envTRAF[i][0]);
    envTrafPZ.push(envTRAF[i][1]);
    envTrafYaw.push(0);
  }
  envTrafStep(game, 0);
}

function envTrafStep(game, dt) {
  if (!envTrafHull) return;
  const n = envTRAF.length;
  for (let i = 0; i < n; i++) {
    const T = envTRAF[i];
    const per = T[4], ferry = T[5] === 1;
    // there and back on a cosine, so she slows, turns and comes back rather
    // than teleporting to the start of her leg
    const u = 0.5 - 0.5 * Math.cos((envTime / per + i * 0.382) * Math.PI * 2);
    const x = lerp(T[0], T[2], u), z = lerp(T[1], T[3], u);
    // heading is the direction of travel, which reverses at each end
    const dir = Math.sin((envTime / per + i * 0.382) * Math.PI * 2) >= 0 ? 1 : -1;
    const yaw = Math.atan2((T[2] - T[0]) * dir, (T[3] - T[1]) * dir);
    const roll = Math.sin(envTime * 0.7 + i) * (ferry ? 0.02 : 0.06);
    const sc = ferry ? 2.1 : 1;
    const hy = -0.42 + Math.sin(envTime * 0.6 + i * 2.1) * 0.06;
    envTrafHull.setMatrixAt(i, envXform(x, hy, z, 0, yaw, roll, sc, sc * 0.9, sc));
    // a ferry has no sails: park them under the water rather than branching
    envTrafSail.setMatrixAt(i, ferry
      ? envXform(0, -900, 0, 0, 0, 0, 0.001, 0.001, 0.001)
      : envXform(x, -0.2, z, 0, yaw, roll * 1.6, 1, 1, 1));

    // ---- and the hull the swimmer meets, on the same numbers -------------
    // Position written as well as velocity, so the body cannot walk away from
    // the instance it is standing in for: the drawing above is analytic in
    // envTime and would not follow a body that had lost ground on a hitch.
    // Roll is NOT given to the body (rule 4): it is two degrees of theatre and
    // the box is what a passenger is standing on.
    const b = envTrafBody[i];
    if (b && dt > 1e-5) {
      const cy = hy + envTRAF_CY * sc * 0.9;
      b.velocity.set(clamp((x - envTrafPX[i]) / dt, -9, 9), 0,
                     clamp((z - envTrafPZ[i]) / dt, -9, 9));
      let dyaw = yaw - envTrafYaw[i];
      while (dyaw > Math.PI) dyaw -= Math.PI * 2;
      while (dyaw < -Math.PI) dyaw += Math.PI * 2;
      b.angularVelocity.set(0, clamp(dyaw / dt, -2.0, 2.0), 0);
      b.position.set(x, cy, z);
      envTrafEu.set(0, yaw, 0, 'YXZ');
      envTrafQt.setFromEuler(envTrafEu);
      b.quaternion.set(envTrafQt.x, envTrafQt.y, envTrafQt.z, envTrafQt.w);
      envSyncBody(b);
      envTrafPX[i] = x; envTrafPZ[i] = z; envTrafYaw[i] = yaw;
    }
  }
  envTrafHull.instanceMatrix.needsUpdate = true;
  envTrafSail.instanceMatrix.needsUpdate = true;
}

// ==================================================================== FERRY ==
/** Heading for the leg that ends at node `b`, starting from node `a`. */
function envFerryHeading(a, b) {
  const dx = envFERRY_NODES[b * 5] - envFERRY_NODES[a * 5];
  const dz = envFERRY_NODES[b * 5 + 1] - envFERRY_NODES[a * 5 + 1];
  return envFERRY_NODES[b * 5 + 4] ? Math.atan2(-dx, -dz) : Math.atan2(dx, dz);
}

function envBuildFerry(game, root, material) {
  const F = envMerger(envBaseA);
  const HX = envFERRY_DECK_HX, HZ = envFERRY_DECK_HZ, DY = envFERRY_DECK_Y;
  // Hull, boot topping, rubbing strake, deck.
  // The hull was painted leafC/leafA — the exact two greens instanced onto the
  // fig and pine canopies — so the largest moving object on the quay read as a
  // hedge adrift on the harbour. cloth4 is a pale sun-bleached sage (L 0.70,
  // well clear of leafA 0.51 and leafC 0.49, and light enough not to punch a
  // hole in PALETTE.water), with hiVis for the waterline band: the green-and-
  // gold Sydney livery, and no green in it that grows on anything.
  F.box(0, -0.06, 0, HX * 2, 0.80, HZ * 2, PALETTE.cloth4);
  F.box(0, -0.42, 0, HX * 2 + 0.08, 0.16, HZ * 2 - 0.30, PALETTE.hiVis);
  F.box(0, 0.28, 0, HX * 2 + 0.18, 0.13, HZ * 2 + 0.14, PALETTE.cloth3);
  F.box(0, 0.31, 0, HX * 2 - 0.14, 0.07, HZ * 2 - 0.14, PALETTE.wood);
  // raked ends
  for (let s = -1; s <= 1; s += 2) {
    F.box(0, -0.02, s * (HZ + 0.52), HX * 2 - 0.55, 0.72, 1.40, PALETTE.cloth4, s * 0.30, 0, 0);
  }
  // bulwarks. The gangway gap is on the A-end's STARBOARD side (local +x),
  // which at the berth heading faces the wharf edge at x = -43.5.
  F.box(-HX + 0.08, 0.66, 0, 0.16, 0.64, HZ * 2, PALETTE.cloth6);
  for (let s = -1; s <= 1; s += 2) {
    F.box(HX - 0.08, 0.66, s * (HZ - 1.9), 0.16, 0.64, 3.8, PALETTE.cloth6);
    F.box(0, 0.66, s * (HZ - 0.08), HX * 2, 0.64, 0.16, PALETTE.cloth6);
  }
  // cabin, window band, roof
  F.box(0, 1.06, 0, HX * 2 - 0.50, 1.42, HZ * 2 - 3.40, PALETTE.cloth6);
  F.box(0, 1.30, 0, HX * 2 - 0.34, 0.52, HZ * 2 - 3.28, PALETTE.glass);
  F.box(0, 1.84, 0, HX * 2 - 0.20, 0.16, HZ * 2 - 3.00, PALETTE.cloth3);
  for (let s = -1; s <= 1; s += 2) {
    F.box(0, 2.26, s * 2.55, 1.70, 0.70, 1.50, PALETTE.cloth6);
    F.box(0, 2.34, s * 3.30, 1.44, 0.44, 0.12, PALETTE.glass);
    // lifebuoy on the bulwark
    F.cyl(HX - 0.16, 0.72, s * 3.4, 0.30, 0.10, PALETTE.cloth1, 0, 0, Math.PI / 2, 6);
  }
  F.cyl(0, 2.58, 0, 0.42, 1.30, PALETTE.cloth6, 0, 0, 0, 6);
  F.cyl(0, 3.30, 0, 0.46, 0.20, PALETTE.stoneDark, 0, 0, 0, 6);
  F.cyl(0, 3.30, -1.30, 0.05, 2.60, PALETTE.metal, 0, 0, 0, 4);

  const mesh = new THREE.Mesh(F.build(), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  envFerryGroup = new THREE.Group();
  envFerryGroup.name = 'ferry';
  envFerryGroup.add(mesh);
  root.add(envFerryGroup);

  const b = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, material: envGroundPhysMat });
  b.addShape(new CANNON.Box(new CANNON.Vec3(HX, DY, HZ)));
  b.addShape(new CANNON.Box(new CANNON.Vec3(0.12, 0.34, HZ)), new CANNON.Vec3(-HX + 0.12, 0.68, 0));
  for (let s = -1; s <= 1; s += 2) {
    b.addShape(new CANNON.Box(new CANNON.Vec3(0.12, 0.34, 1.9)), new CANNON.Vec3(HX - 0.12, 0.68, s * (HZ - 1.9)));
    b.addShape(new CANNON.Box(new CANNON.Vec3(HX, 0.34, 0.12)), new CANNON.Vec3(0, 0.68, s * (HZ - 0.12)));
  }
  b.allowSleep = false;
  envFerryLeg = 1;
  envFerryT = 0;
  envFerryDwell = envFERRY_NODES[3];
  envFerryYaw = envFerryHeading(0, 1);
  b.position.set(envFERRY_NODES[0], 0, envFERRY_NODES[1]);
  // SEED THE PREVIOUS TARGET, exactly as the van does at envBuildVan. The step
  // below drives velocity from (target - previous target), so leaving this at
  // the origin made the very first frame read a 45 m move and hand the body a
  // clamped 12 m/s kick while she was still tied up. Open-loop from the target
  // means nothing ever corrected it: she spent the rest of the session that
  // far off her berth, with the gangway gap no longer against the wharf edge.
  envFerryPX = envFERRY_NODES[0]; envFerryPZ = envFERRY_NODES[1];
  b.quaternion.setFromEuler(0, envFerryYaw, 0);
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
  b.previousQuaternion.copy(b.quaternion);
  b.interpolatedQuaternion.copy(b.quaternion);
  game.world.addBody(b);
  envFerryBody = b;
  envFerryPos.set(b.position.x, b.position.y, b.position.z);
  envFerryGroup.position.copy(envFerryPos);
  envFerryGroup.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
  return b;
}

/** True when `p` (a world position) is standing inside the ferry's bulwarks. */
function envFerryOnBoard(p) {
  const b = envFerryBody;
  if (!b || !p) return false;
  envFerryTmp.set(p.x - b.position.x, p.y - b.position.y, p.z - b.position.z);
  envFerryQt.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w).invert();
  envFerryTmp.applyQuaternion(envFerryQt);
  return Math.abs(envFerryTmp.x) < envFERRY_DECK_HX &&
         Math.abs(envFerryTmp.z) < envFERRY_DECK_HZ &&
         envFerryTmp.y > envFERRY_DECK_Y - 0.55 && envFerryTmp.y < envFERRY_DECK_Y + 2.4;
}

/**
 * Drive the ferry round her circuit. She is KINEMATIC and moved by VELOCITY,
 * not by writing position: that is the only way cannon's friction carries a
 * capybara standing on the deck. The velocity is recomputed from the actual
 * body transform every frame, so it self-corrects and cannot drift.
 */
function envFerryStep(game, dt) {
  const b = envFerryBody;
  if (!b) return;
  if (dt <= 0) { b.velocity.setZero(); b.angularVelocity.setZero(); return; }

  const N = envFERRY_N;
  const prev = (envFerryLeg + N - 1) % N;
  const o = envFerryLeg * 5, po = prev * 5;
  let tx, tz;
  const tyaw = envFerryHeading(prev, envFerryLeg);
  if (envFerryDwell > 0) {
    envFerryDwell -= dt;
    tx = envFERRY_NODES[po]; tz = envFERRY_NODES[po + 1];
  } else {
    envFerryT += dt;
    const dur = envFERRY_NODES[o + 2];
    const u = clamp(envFerryT / dur, 0, 1);
    const s = u * u * (3 - 2 * u);            // ease in and out of every berth
    tx = lerp(envFERRY_NODES[po], envFERRY_NODES[o], s);
    tz = lerp(envFERRY_NODES[po + 1], envFERRY_NODES[o + 1], s);
    if (envFerryT >= dur) {
      envFerryT = 0;
      envFerryDwell = envFERRY_NODES[o + 3];
      envFerryLeg = (envFerryLeg + 1) % N;
    }
  }
  envFerryDocked = envFerryDwell > 0 && prev === 0;

  // yaw: damp the authoritative heading, then ask the solver for the rate that
  // gets the body there in one step
  let d = tyaw - envFerryYaw;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  envFerryYaw += d * (1 - Math.exp(-1.5 * dt));

  envFerryQt.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
  envEu.setFromQuaternion(envFerryQt, 'YXZ');
  let dy = envFerryYaw - envEu.y;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  b.angularVelocity.set(0, clamp(dy / dt, -1.6, 1.6), 0);
  // FROM THE TARGET, NOT FROM THE BODY — the fifth and last carrier in the game
  // to be put on the honest form. cannon integrates kinematic bodies in fixed
  // 1/60 substeps inside world.step, which runs BEFORE every module update, so
  // (target - body.position) is the ground the last velocity already covered
  // rather than the ground still to cover. On any panel that is not exactly
  // 60 Hz the number of substeps per frame alternates, the error changes sign
  // with it, and the deck shivers — and capybara.js reads this straight into
  // platVX/platVZ, so it shivers the passenger with it. This is the only way
  // out of Sydney.
  b.velocity.set(clamp((tx - envFerryPX) / dt, -12, 12), 0,
                 clamp((tz - envFerryPZ) / dt, -12, 12));
  envFerryPX = tx; envFerryPZ = tz;


  // render from the interpolated transform, never from body.position
  envFerryGroup.position.copy(b.interpolatedPosition);
  envFerryGroup.quaternion.set(b.interpolatedQuaternion.x, b.interpolatedQuaternion.y,
                               b.interpolatedQuaternion.z, b.interpolatedQuaternion.w);
  envFerryPos.copy(envFerryGroup.position);

  // gangway mouth, in world space, for npc.js boarding
  envFerryGang.set(envFERRY_DECK_HX + 0.35, envFERRY_DECK_Y, 0);
  envFerryGang.applyQuaternion(envFerryGroup.quaternion).add(envFerryPos);
  if (envFerry) {
    envFerry.docked = envFerryDocked;
    envFerry.gangwayX = envFerryGang.x;
    envFerry.gangwayZ = envFerryGang.z;
  }

  // ---- 'ferry:departed', exactly once per voyage --------------------------
  if (envFerryDocked) { envFerryVoyage = false; return; }
  if (envFerryVoyage) return;
  const capy = game.capy;
  if (!capy || !capy.position) return;
  const bx = envFerryPos.x - envFERRY_NODES[0], bz = envFerryPos.z - envFERRY_NODES[1];
  if (bx * bx + bz * bz < 16) return;         // still within 4 m of the berth
  if (!envFerryOnBoard(capy.position)) return;
  envFerryVoyage = true;
  game.events.emit('ferry:departed', {});
}

// ===========================================================================
export function createEnvironment(game) {
  envInitGeos();
  envSeed = 20240813;
  envNavC.length = 0;
  envNavR.length = 0;
  envCafeTables.length = 0;
  envPerches.length = 0;
  envSprinklers.length = 0;
  envSprayMesh = null;
  envSprayAng = 0;
  envTime = 0;
  envRippleT = 0;
  envLoriSeen = false;
  envFerryVoyage = false;
  envFerryDocked = true;
  envAsleep = false;
  envGroundPhysMat = (game.mats && game.mats.ground) || undefined;

  const root = new THREE.Group();
  root.name = 'environment';
  game.scene.add(root);

  /**
   * THE LAWN WAS ONE FLAT GREEN.
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
  const matVC   = grain(mat(envVC_BASE, { vertexColors: true }),
                        { scale: 0.45, amount: 0.085, warp: 0.55, near: 0.32, nearScale: 8, contact: 1 });
  // The lawn and the sand run to a hundred and sixty metres and Sydney is the
  // one chapter with no paving in it at all, so the ground carries twice the
  // whisper the buildings do.
  const matVCGnd = grain(mat(envVC_BASE, { vertexColors: true }),
                         { scale: 0.68, amount: 0.17, warp: 0, near: 1.00, speck: 0.70, nearScale: 8, contact: 1, broad: 0.11, broadM: 17,
                           // the mid octave (L6, E6): worn dry patches on the lawn
                           // in eight-metre pieces, yellowing toward grassPale
                           mid: 0.06, midM: 8, midColor: PALETTE.grassPale, midBase: PALETTE.grass });
  const matVC2  = mat(envVC_BASE2, { vertexColors: true, side: THREE.DoubleSide });
  // DoubleSide defaults shadowSide to DoubleSide -> the open sail surfaces would
  // sample their own depth and speckle. Front faces only.
  matVC2.shadowSide = THREE.FrontSide;

  // ---------------------------------------------------------------- SKY ----
  const skyGeo = new THREE.SphereGeometry(300, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.58);
  const skyPos = skyGeo.attributes.position;
  const skyCol = new Float32Array(skyPos.count * 3);
  envColA.set(PALETTE.skyTop);
  envColB.set(PALETTE.skyBottom);
  for (let i = 0; i < skyPos.count; i++) {
    const t = clamp(skyPos.getY(i) / 300, 0, 1);
    envCol.copy(envColB).lerp(envColA, Math.pow(t, 0.6));
    envDeTint(envCol, envBaseA);
    skyCol[i * 3] = envCol.r; skyCol[i * 3 + 1] = envCol.g; skyCol[i * 3 + 2] = envCol.b;
  }
  skyGeo.setAttribute('color', new THREE.BufferAttribute(skyCol, 3));
  // flatShading:false — a faceted Lambert dome bands badly under the sun.
  //
  // depthWrite:false — A SKYBOX IS NOT A PIECE OF WORLD, and this was the only
  // dome in the game still saying it was. The other four (the shared one in
  // systems.js, the Drift's stars and moon, Cappadocia's sunrise) have always
  // written no depth; this one wrote at a 300 m radius inside a 400 m frustum,
  // which silently depth-clipped anything the harbour put past three hundred
  // metres. It also made the v45 air term impossible to gate: the exemption
  // that keeps haze off a `fog:false` dome tests for an untouched depth buffer,
  // and this dome was the one sky in nineteen chapters that failed it — which
  // is why Sydney, and only Sydney, came back milky the first time the term
  // was switched on.
  // CLONED, for the reason grain() clones: mat() hands back a SHARED cached
  // material and writing a flag onto it writes it onto every other mesh that
  // asked for the same colour and options.
  // ...AND NOT LIT BY THE KEY (L4, E1): see skyDomeLit in shared.js. The dome
  // keeps the light it was painted under whatever the key does to the lawn.
  const skyMat = skyDomeLit(mat(envVC_BASE, { vertexColors: true, fog: false, side: THREE.BackSide, flatShading: false }).clone());
  skyMat.depthWrite = false;
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  root.add(sky);

  // -------------------------------------------------------------- CLOUDS ---
  const cloudCount = 9 * 3;
  envCloudData = new Float32Array(cloudCount * 7);
  // cool white, deliberately NOT PALETTE.sail — the shells must stay warm and separate.
  // A CLOUD IS LIT FROM INSIDE, and a Lambert one is not.
  //
  // These are spheres with the sun above them, so the half of every cloud the
  // player looks at from a park bench got nothing but the hemisphere light's
  // GROUND colour — a warm grey at half strength — and the whole layer read as
  // a dark slab pasted over the sky. It is the single worst thing in a wide
  // shot of this chapter and it has been there since the first build.
  //
  // The emissive term is the fix and it is not a cheat: what actually lights
  // the underside of a cumulus is light that has already been scattered inside
  // it, which no direct-lighting model has any way to produce. A third of the
  // sky colour, added flat, puts the base back where the eye expects it and
  // leaves the sunlit top over 1.0, where the composite pass blooms it.
  envCloudMesh = new THREE.InstancedMesh(envG.sph6,
    mat(PALETTE.foam, { fog: false, emissive: PALETTE.skyBottom, emissiveIntensity: 0.38 }),
    cloudCount);
  envCloudMesh.frustumCulled = false;
  envCloudMesh.castShadow = false;
  envCloudMesh.receiveShadow = false;
  for (let c = 0; c < 9; c++) {
    const cx = envRR(-140, 140), cy = envRR(38, 62), cz = envRR(-130, 60);
    const spd = envRR(0.45, 1.1);
    const big = envRR(7, 13);
    for (let b = 0; b < 3; b++) {
      const o = (c * 3 + b) * 7;
      const f = b === 0 ? 1 : envRR(0.5, 0.8);
      envCloudData[o]     = cx + (b === 0 ? 0 : envRR(-big, big));
      envCloudData[o + 1] = cy + (b === 0 ? 0 : envRR(-1.5, 2.2));
      envCloudData[o + 2] = cz + (b === 0 ? 0 : envRR(-4, 4));
      envCloudData[o + 3] = big * f * 2.0;
      envCloudData[o + 4] = big * f * 0.85;
      envCloudData[o + 5] = big * f * 1.4;
      envCloudData[o + 6] = spd;
    }
  }
  root.add(envCloudMesh);

  // -------------------------------------------------------------- GROUND ---
  // Playable box is x[-70,70] z[-10,70]; the mesh runs well past it so the lawn
  // never ends in a hard edge against the sky.
  const gGeo = new THREE.PlaneGeometry(220, 160, 64, 46);
  gGeo.rotateX(-Math.PI / 2);
  gGeo.translate(0, 0, 70);
  const gPos = gGeo.attributes.position;
  const gArr = gPos.array;
  const gCol = new Float32Array(gPos.count * 3);
  const cGrass = new THREE.Color(PALETTE.grass);
  const cGrassD = new THREE.Color(PALETTE.grassDark);
  const cGrassP = new THREE.Color(PALETTE.grassPale);
  const cSand = new THREE.Color(PALETTE.sand);
  for (let i = 0; i < gPos.count; i++) {
    const x = gArr[i * 3], z = gArr[i * 3 + 2];
    // shallow enough that every inset decal quad at y >= 0.07 stays on top
    gArr[i * 3 + 1] = envNoise(x * 0.09, z * 0.09) * 0.03;
    const t1 = 0.5 + 0.5 * envNoise(x * 0.19 + 11, z * 0.17 - 4);
    const t2 = 0.5 + 0.5 * envNoise(x * 0.07 - 3, z * 0.06 + 7);
    envCol.copy(cGrassD).lerp(cGrass, t1);
    envCol.lerp(cGrassP, t2 * 0.55);
    if (x < -10 && z < 7) {
      const s = clamp((7 - z) / 10, 0, 1) * clamp((-10 - x) / 6, 0, 1) * clamp((x + 82) / 14, 0, 1);
      envCol.lerp(cSand, s);
    }
    if (x > 12 && x < 26 && z < 2) {
      envCol.lerp(cSand, clamp((2 - z) / 7, 0, 1) * 0.8);
    }
    // aerial perspective on the skirt so the far edge recedes instead of ending
    const far = clamp((Math.max(Math.abs(x) - 66, z - 62)) / 40, 0, 1);
    envCol.lerp(cGrassP, far * 0.7);
    envDeTint(envCol, envBaseA);
    gCol[i * 3] = envCol.r; gCol[i * 3 + 1] = envCol.g; gCol[i * 3 + 2] = envCol.b;
  }
  gPos.needsUpdate = true;
  gGeo.setAttribute('color', new THREE.BufferAttribute(gCol, 3));
  gGeo.computeVertexNormals();
  const ground = new THREE.Mesh(gGeo, matVCGnd);
  ground.receiveShadow = true;
  ground.castShadow = false;
  root.add(ground);

  // The ground must be FINITE. An infinite CANNON.Plane here also floors the harbour,
  // so the capybara stood on invisible ground out at sea and nothing could ever get
  // below the waterline — which made 'swim', 'ball-harbour' and 'hat-harbour'
  // unreachable. This box covers exactly the land footprint (x -70..70, z -10..70)
  // with its top face at y = 0; past the quay there is simply nothing to stand on.
  const groundBody = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC, material: envGroundPhysMat });
  groundBody.addShape(new CANNON.Box(new CANNON.Vec3(70, 6, 40)));
  groundBody.position.set(0, -6, 30);
  groundBody.previousPosition.copy(groundBody.position);
  groundBody.interpolatedPosition.copy(groundBody.position);
  groundBody.allowSleep = true;
  game.world.addBody(groundBody);

  // Seabed catch well below the waterline (-0.5) so a body that sinks settles instead
  // of falling forever. Deep enough that floating/swimming still reads as floating.
  const seabedBody = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC, material: envGroundPhysMat });
  seabedBody.addShape(new CANNON.Box(new CANNON.Vec3(160, 4, 92)));
  seabedBody.position.set(0, -12, -92);
  seabedBody.previousPosition.copy(seabedBody.position);
  seabedBody.interpolatedPosition.copy(seabedBody.position);
  seabedBody.allowSleep = true;
  game.world.addBody(seabedBody);

  // --------------------------------------------------------------- WATER ---
  // 21x25 verts: the ripple wavelength is ~45-70 m so a coarse grid is plenty.
  const wGeo = new THREE.PlaneGeometry(280, 140, 20, 24);
  wGeo.rotateX(-Math.PI / 2);
  wGeo.translate(0, 0, -80);
  const wPos = wGeo.attributes.position;
  const wCol = new Float32Array(wPos.count * 3);
  const cWater = new THREE.Color(PALETTE.water);
  const cDeep = new THREE.Color(PALETTE.waterDeep);
  const cFoam = new THREE.Color(PALETTE.foam);
  for (let i = 0; i < wPos.count; i++) {
    const z = wPos.getZ(i);
    const t = clamp((-10 - z) / 70, 0, 1);
    envCol.copy(cWater).lerp(cDeep, t * 0.9);
    // foam band painted into the surface so it rides the ripple instead of
    // hanging off the quay as a rigid shelf
    const fz = clamp((-10 - z) / 7, 0, 1);
    envCol.lerp(cFoam, (1 - fz) * 0.8);
    envDeTint(envCol, envBaseA);
    wCol[i * 3] = envCol.r; wCol[i * 3 + 1] = envCol.g; wCol[i * 3 + 2] = envCol.b;
  }
  wGeo.setAttribute('color', new THREE.BufferAttribute(wCol, 3));
  // GLITTER, NOT WAVES. The mesh already has a ripple written into it and you
  // cannot see it from six metres up at 41 degrees; what makes water read as
  // water from there is a sparse field of moving points far brighter than the
  // surface. It costs four hash calls and it is the difference between a sea
  // and a sheet of coloured card. See grain() in shared.js.
  const matVCSea = grain(mat(envVC_BASE, { vertexColors: true }),
    { scale: 0.5, amount: 0.055, warp: 0,
      sparkle: 0.55, sparkleScale: 1.1, sparkleSpeed: 0.30, sparkleCut: 0.63, fresnel: 0.65,
      sparkleColor: PALETTE.foam });
  const water = new THREE.Mesh(wGeo, matVCSea);
  water.position.y = -0.5;
  water.receiveShadow = false;
  water.castShadow = false;
  water.frustumCulled = false;
  root.add(water);
  envWaterAttr = wPos;

  // ================================================================ DECALS ==
  const D = envMerger(envBaseB);

  // sandstone promenade strip + darker kerb
  D.quad(-64, -9.4, -13.2, -5.6, 0.07, PALETTE.sandstone);
  D.quad(-64, -5.6, -13.2, -5.15, 0.075, PALETTE.sandstoneDark);
  // opera forecourt — widened and run further south so the ceremonial stair
  // lands on paving rather than on the lawn
  D.quad(-13.4, 4.0, 13.4, 10.2, 0.07, PALETTE.sandstone);
  D.quad(-13.4, 10.2, 13.4, 10.6, 0.075, PALETTE.sandstoneDark);
  // beach / ramp sand wedges
  D.quad(-33.5, -9.6, -22.5, -5.5, 0.072, PALETTE.sand);
  D.quad(15, -9.6, 23, -6.5, 0.072, PALETTE.sand);
  // winding paths
  for (let i = 0; i < envPATHS.length; i++) {
    // envPATHS[1] is the promenade run, and Mr Whippy drives it — a 2.7 m
    // footpath under a 2.04 m van reads as a van parked on the lawn.
    envRibbon(D, envPATHS[i], i === 2 ? 1.0 : i === 1 ? 2.35 : 1.35, 0.08, PALETTE.path);
  }
  // mown lawn stripes on the picnic lawn
  for (let i = 0; i < 8; i++) {
    const x0 = 22 + i * 2;
    D.quad(x0, 18, x0 + 2, 34, 0.071, i % 2 ? PALETTE.grassPale : PALETTE.grassDark);
  }
  // second mown patch by the far gardens
  for (let i = 0; i < 6; i++) {
    const z0 = 46 + i * 1.8;
    D.quad(48, z0, 60, z0 + 1.8, 0.071, i % 2 ? PALETTE.grassPale : PALETTE.grass);
  }
  // duck pond: soil rim, stone lip, then two-tone water for a depth read
  envDisc(D, envPOND.x, envPOND.z, envPOND.r + 0.7, 14, 0.082, PALETTE.soil);
  envDisc(D, envPOND.x, envPOND.z, envPOND.r + 0.35, 14, 0.085, PALETTE.stoneDark);
  envDisc(D, envPOND.x, envPOND.z, envPOND.r, 14, 0.10, PALETTE.water);
  envDisc(D, envPOND.x, envPOND.z, envPOND.r - 1.1, 14, 0.102, PALETTE.waterDeep);
  // flower bed soil pads (visual base under the raised soil boxes)
  for (let i = 0; i < envBEDS.length; i++) {
    const b = envBEDS[i];
    D.quad(b.x0 - 0.35, b.z0 - 0.35, b.x1 + 0.35, b.z1 + 0.35, 0.078, PALETTE.soil);
  }
  // The fallen jacaranda used to be built HERE, as eight-segment discs at a
  // flat y = 0.05 in the decal merger. It is its own mesh on the ground's own
  // material now — see envBlossom, and the block above it for why.
  // podium deck paving joints. The deck plate is pale PALETTE.stone and the
  // forecourt below is sandstone, so the two surfaces already read apart; the
  // joints give the deck a scale and stop it looking like one poured slab.
  for (let i = 0; i < 5; i++) {
    const jx = -12.6 + i * 5.1;
    D.quad(jx - 0.07, -11.5, jx + 0.07, 3.5, 1.212, PALETTE.sandstoneDark);
  }
  for (let i = 0; i < 5; i++) {
    const jz = -10.4 + i * 3.5;
    D.quad(-12.6, jz - 0.07, 12.6, jz + 0.07, 1.212, PALETTE.sandstoneDark);
  }
  // the 'stage' — a red carpet on the podium top so the task target reads.
  // ON TOP OF THE RED PODIUM now (L6, E4 / play 3): the row says "up onto the
  // red podium" and the podium was a flat carpet, so the fresh player stood
  // on it, wheeked nine times, and could not tell whether they were on it.
  // The carpet sits on the block built under ARCHITECTURE at envSTAGE_Y.
  D.quad(-6.5, 0.0, 6.5, 2.9, envSTAGE_Y + 0.004, PALETTE.petalRed);
  // Circular Quay paving
  envQuayDecals(D);
  const decals = new THREE.Mesh(D.build(), matVC2);
  decals.receiveShadow = true;
  decals.castShadow = false;
  root.add(decals);

  // ---- the fallen blossom, on the GROUND's material ------------------------
  // envBaseA and matVCGnd, so it de-tints the way the lawn does and picks up
  // the same grain, near octave, broad hue field and contact term. One extra
  // draw call, and the whole reason these stopped reading as stickers.
  const BL = envMerger(envBaseA);
  for (let i = 0; i < envBLOSSOM.length; i++) {
    envBlossom(BL, envBLOSSOM[i][0], envBLOSSOM[i][1], envBLOSSOM[i][2]);
  }
  // ---- and the wear path (L6, E6): the lawn between the spawn and the
  // podium, worn 8 % darker along the line everybody walks — see
  // mergeWearBand. The lawn's own colour rule at every vertex, so it is the
  // lawn darker and not a stripe painted on it. In this mesh, on this
  // material, for the blossom's reason.
  mergeWearBand(BL, [0.0, 21.0, -0.6, 12.0, 0.2, 4.6], 1.5, envLawnY,
                function (x, z, out) { envLawnColor(x, z, out); }, 2.0, 0.05, 0.92);
  const blossom = new THREE.Mesh(BL.build(), matVCGnd);
  blossom.receiveShadow = true;
  blossom.castShadow = false;
  root.add(blossom);

  // ========================================================== ARCHITECTURE ==
  const A = envMerger(envBaseA);

  // ---- sea wall (with deliberate gaps: wharf, beach ramp, podium, boat ramp)
  // The gap at x -32 .. -19.4 now carries BOTH the old beach ramp and the new
  // wide water stair at x = -22.1; the wall used to run to -24 and would have
  // fenced the stair off from the harbour.
  const wallSegs = [[-70, -44], [-36, -32], [-19.4, -13.2], [13.2, 16], [22, 70]];
  for (let i = 0; i < wallSegs.length; i++) {
    const s = wallSegs[i], cx = (s[0] + s[1]) / 2, w = s[1] - s[0];
    A.box(cx, -0.4, -10, w, 1.7, 1.0, PALETTE.sandstone);
    A.box(cx, 0.5, -10, w, 0.22, 1.2, PALETTE.sandstoneDark);
    envStaticBox(game, cx, -0.4, -10, w / 2, 0.85, 0.5);
  }

  // ---- two comedy ramps down into the harbour
  const ramps = [[-28, PALETTE.sand], [19, PALETTE.stone]];
  for (let i = 0; i < ramps.length; i++) {
    const rx = ramps[i][0];
    A.box(rx, -0.55, -10.9, 8, 0.4, 3.8, ramps[i][1], -0.295, 0, 0);
    envStaticBox(game, rx, -0.55, -10.9, 4, 0.2, 1.9, -0.295);
  }

  // ---- ferry wharf at x = -40
  A.box(-40, 0.0, -16.9, 7, 0.34, 14.6, PALETTE.wood);
  A.box(-40, 0.2, -16.9, 7.3, 0.12, 14.9, PALETTE.woodDark);
  envStaticBox(game, -40, 0.0, -16.9, 3.5, 0.17, 7.3);
  const pilings = [];
  for (let i = 0; i < 4; i++) {
    const pz = -12 + i * -3.6;
    envPush9(pilings, -43.2, -0.8, pz, 0, 0, 0, 0.5, 2.2, 0.5);
    envPush9(pilings, -36.8, -0.8, pz, 0, 0, 0, 0.5, 2.2, 0.5);
  }
  envInstance(root, envG.cyl6, PALETTE.woodDark, pilings, true, false);
  // wharf shelter
  const bPosts = envPoolBody();
  for (let i = 0; i < 4; i++) {
    const px = -40 + (i < 2 ? -2.2 : 2.2), pz = -21.5 + (i % 2 ? 2.6 : -2.6);
    A.box(px, 1.4, pz, 0.24, 2.6, 0.24, PALETTE.wood);
    envPoolBox(bPosts, px, 1.4, pz, 0.12, 1.3, 0.12);
  }
  A.box(-40, 2.85, -21.5, 5.6, 0.3, 6.4, PALETTE.stone);
  A.box(-40, 3.15, -21.5, 4.4, 0.35, 5.2, PALETTE.stoneDark);
  envNavC.push(-40, -21.5, 3.0);

  // ---- bollards along the quay + wharf
  const bollards = [];
  for (let x = -58; x <= 62; x += 6) {
    if (x > -46 && x < -30) continue;   // wharf + beach ramp
    if (x > -34 && x < -12) continue;   // beach ramp, water stair, east boardwalk
    if (x > -14 && x < 14) continue;    // opera podium
    if (x > 14 && x < 24) continue;     // boat ramp
    envPush9(bollards, x, 0.35, -9.2, 0, 0, 0, 0.45, 0.75, 0.45);
  }
  envPush9(bollards, -43.6, 0.4, -14, 0, 0, 0, 0.45, 0.8, 0.45);
  envPush9(bollards, -36.4, 0.4, -14, 0, 0, 0, 0.45, 0.8, 0.45);
  envPush9(bollards, -43.6, 0.4, -24, 0, 0, 0, 0.45, 0.8, 0.45);
  envPush9(bollards, -36.4, 0.4, -24, 0, 0, 0, 0.45, 0.8, 0.45);
  envInstance(root, envG.cyl6, PALETTE.stoneDark, bollards, true, true);
  // ...and every one of them is solid, on the same body as the shelter posts.
  // A bollard is 45 cm across and 72 cm high: too tall to step over (the
  // animal manages 40) and too small to be a wall, which is exactly the size
  // of thing that reads as a bug when you walk through it.
  for (let i = 0; i < bollards.length; i += 9) {
    envPoolBox(bPosts, bollards[i], bollards[i + 1], bollards[i + 2],
               bollards[i + 6] * 0.5, bollards[i + 7] * 0.5, bollards[i + 8] * 0.5);
  }

  // ---- lamp posts along the promenade (4-sided lantern + a little cap)
  const lampPosts = [], lampHeads = [], lampCaps = [];
  for (let x = -60; x <= -18; x += 6) {
    envPush9(lampPosts, x, 2.1, -7.0, 0, 0, 0, 0.24, 4.2, 0.24);
    envPush9(lampHeads, x, 4.45, -7.0, 0, 0.79, 0, 0.62, 0.86, 0.62);
    envPush9(lampCaps, x, 4.95, -7.0, 0, 0.79, 0, 0.72, 0.34, 0.72);
    envNavC.push(x, -7.0, 0.8);
  }
  // forecourt lamps now FLANK the ceremonial stair (which reaches z = 7.35 and
  // |x| = 11.4) instead of standing in the middle of it
  for (let s = -1; s <= 1; s += 2) {
    const x = s * 12.9;
    envPush9(lampPosts, x, 2.1, 9.2, 0, 0, 0, 0.24, 4.2, 0.24);
    envPush9(lampHeads, x, 4.45, 9.2, 0, 0.79, 0, 0.62, 0.86, 0.62);
    envPush9(lampCaps, x, 4.95, 9.2, 0, 0.79, 0, 0.72, 0.34, 0.72);
    envNavC.push(x, 9.2, 0.8);
  }
  for (let i = 0; i < lampPosts.length; i += 9) {
    envPoolBox(bPosts, lampPosts[i], lampPosts[i + 1], lampPosts[i + 2],
               lampPosts[i + 6] * 0.5, lampPosts[i + 7] * 0.5, lampPosts[i + 8] * 0.5);
  }
  envInstance(root, envG.cyl6, PALETTE.metal, lampPosts, true, false);
  envInstance(root, envG.cyl4, PALETTE.sail, lampHeads, false, false);
  envInstance(root, envG.cone4, PALETTE.stoneDark, lampCaps, false, false);
  envPoolDone(game, bPosts);

  // ---- CIRCULAR QUAY (chapter 1) -------------------------------------------
  // Built here, before the tree pass, so the nav rects it registers keep the
  // rejection-sampled palms and pines out of the terrace and the arcade.
  envBuildQuay(game, root, A);
  envBuildFerry(game, root, matVC);
  envBuildVan(game, root, matVC);
  envBuildSeaplane(root, matVC);

  // ---- OPERA HOUSE podium --------------------------------------------------
  // A plinth, not a slab. Bottom to top:
  //   -1.80 .. 0.10  battered sandstone footing, wider than the deck; on the
  //                  seaward faces (z < -10) it rises straight out of the harbour
  //    0.00 .. 0.84  main plinth wall — this is the block the collider matches
  //    0.84 .. 1.06  RECESSED shadow band, inset 0.4 all round
  //    1.06 .. 1.20  overhanging cornice, so the deck edge throws a shadow line
  //    1.15 .. 1.20  pale stone deck plate, distinct from the sandstone forecourt
  // Deck top stays at EXACTLY y = 1.2: props.js (physPODIUM_Y) and the
  // 'opera-stage' height test in systems.js both depend on it.
  A.box(0, -0.85, -4, 26.8, 1.90, 16.8, PALETTE.sandstoneDark);
  A.box(0, 0.42, -4, 26.0, 0.84, 16.0, PALETTE.sandstone);
  A.box(0, 0.95, -4, 25.2, 0.22, 15.2, PALETTE.sandstoneDark);
  A.box(0, 1.13, -4, 26.1, 0.14, 16.1, PALETTE.sandstone);
  A.box(0, 1.175, -4, 25.3, 0.05, 15.3, PALETTE.stone);
  // `camSolid`: the lens's boom stops IN FRONT of this block rather than
  // passing its floor through it — see sysCAM_CLEAR_HARD in systems.js. The
  // plinth carries it for the animal at its foot with the eye over the deck
  // (the review's 70 %-slab frame); the three shell colliders below carry it
  // because the sails are DoubleSide and an eye inside them sees vault.
  envStaticBox(game, 0, 0.6, -4, 13, 0.6, 8).userData = { camSolid: true };
  envNavR.push(-13.2, -12.2, 13.2, 4.2);
  // ---- THE RED PODIUM IS A PODIUM (L6, E4 / play 3) ----------------------
  // A 0.3 m block under the carpet, x -6.5..6.5 z 1.05..3.9 (the zone), so
  // "up onto" is a thing that happens. 0.3 m is two of the stair's treads and
  // more than the animal walks up in one step (0.17, see envQUAY_DECK_Y), so
  // a half-step riser runs 0.6 m out from every side at 0.15: the animal
  // walks up two steps from any direction rather than hopping, and the
  // arrow-follower who arrives from the north edge is not stopped by a kerb.
  // Sandstone for the mass, the dark for the riser, the carpet on top.
  // The riser stops at z 4.05, INSIDE the deck edge (4.1): measured with the
  // first cut it ran to 4.5, over the top tread of the stair, and the animal
  // arriving up the stairs met a 0.32 m step and stood at the top for three
  // seconds (qa/l6-paper-podium.json, run 2).
  // ...and the whole thing sits 1.0 m further from the stair than the carpet
  // did (z 0..2.9, see envZONES), so there is a stride of deck (3.5..4.1)
  // between the stair's last tread and the first riser: two 0.15 steps a
  // stride apart walk; the same two steps in one place do not.
  A.box(0, 1.2 + (envSTAGE_Y - 1.2) * 0.5, 1.45, 13.0, envSTAGE_Y - 1.2, 2.9, PALETTE.sandstone);
  A.box(0, 1.2 + 0.075, 1.45, 14.2, 0.15, 4.1, PALETTE.sandstoneDark);
  envStaticBox(game, 0, 1.2 + (envSTAGE_Y - 1.2) * 0.5, 1.45, 6.5, (envSTAGE_Y - 1.2) * 0.5, 1.45);
  envStaticBox(game, 0, 1.2 + 0.075, 1.45, 7.1, 0.075, 2.05);

  // ---- the great ceremonial staircase up the southern face -----------------
  // Six broad treads, 0.171 rise on a 0.533 going — shallower than the old
  // stair, so the capybara still walks straight up. The flight stays inside
  // z 4.15 .. 7.36 and |x| <= 11.4, which is the rect props.js already keeps
  // clear of resting props, and every tread gets a matching collider.
  for (let i = 0; i < 6; i++) {
    const top = 1.2 - (i + 1) * (1.2 / 7);
    const zc = 4.42 + i * 0.533;
    const hw = 10.2 + i * 0.2;
    A.box(0, top / 2, zc, hw * 2, top, 0.545, i % 2 ? PALETTE.sandstone : PALETTE.sandstoneDark);
    envStaticBox(game, 0, top / 2, zc, hw, top / 2, 0.2725);
  }
  // stair cheeks — solid parapets stepping down beside the flight
  for (let s = -1; s <= 1; s += 2) {
    A.box(s * 11.9, 0.62, 4.9, 1.5, 1.24, 1.9, PALETTE.sandstone);
    A.box(s * 11.9, 1.29, 4.9, 1.6, 0.14, 2.0, PALETTE.stone);
    A.box(s * 12.1, 0.40, 6.6, 1.5, 0.80, 1.9, PALETTE.sandstone);
    A.box(s * 12.1, 0.85, 6.6, 1.6, 0.12, 2.0, PALETTE.stone);
    // z0 = 4.0 exactly: any further north and this lip would sit on the deck
    envStaticBox(game, s * 12.0, 0.62, 5.9, 0.85, 0.62, 1.9);
  }

  // stanchions marking the stage carpet
  for (let i = 0; i < 4; i++) {
    A.cyl(i < 2 ? -6.8 : 6.8, 1.6, i % 2 ? 0.9 : 4.05, 0.09, 0.8, PALETTE.metal, 0, 0, 0, 6);
  }

  // ---- OPERA HOUSE shells --------------------------------------------------
  const S = envMerger(envBaseB);
  const podTop = 1.2;

  /**
   * The open MOUTH at the wide end of a vault: a recessed dark interior and a
   * stepped glass curtain wall that leans back under the shell, so the vault
   * reads as hollow rather than as a solid blob. Everything is authored in the
   * vault's own frame and then yawed onto the deck by hand, because the boxes
   * carry their own lean-back tilt on top of the vault yaw.
   */
  function envMouthBox(bx, bz, cs, sn, yaw, lx, ly, lz, sx, sy, sz, color, tilt) {
    A.box(bx + lx * cs + lz * sn, podTop + ly, bz - lx * sn + lz * cs,
          sx, sy, sz, color, tilt, yaw, 0);
  }
  function envAddMouth(x, z, W, H, L, yaw, panels) {
    const lift = envShLift(H), back = envShBack(L);
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const tilt = -0.26, ct = Math.cos(tilt), st = Math.sin(tilt);
    // Everything inside the mouth is sized as a FRACTION of the vault depth L.
    // A fixed setback works for the big vaults and shoots straight out the back
    // of the little ones, whose whole shell is only a metre deep.
    const rec = 0.18 + L * 0.22;    // how far the glass sits back under the lip
    // the throat: a dark wall well inside the arch, plus a dark floor, both
    // narrow enough to stay hidden behind the shell from every outside angle
    envMouthBox(x, z, cs, sn, yaw, 0, lift * 0.46, -(L * 0.42 + 0.10),
                W * 0.48, lift * 0.92, 0.22, PALETTE.stoneDark, 0);
    envMouthBox(x, z, cs, sn, yaw, 0, 0.03, -L * 0.45,
                W * 0.45, 0.06, L * 0.55, PALETTE.stoneDark, 0);
    // `panels` glass leaves PER SIDE, laid out in the same w the shell uses, so
    // the wall follows the arch exactly and closes down to nothing at the feet.
    // The gap left at w = 0 is the central mullion under the ridge.
    for (let s = -1; s <= 1; s += 2) {
      for (let k = 0; k < panels; k++) {
        const w0 = k / panels, w1 = (k + 1) / panels, wm = (w0 + w1) * 0.5;
        const ph = lift * (1 - envShFY(wm)) - 0.10;   // arch height at this leaf
        const pw = (W * 0.5) * (envShFX(w1) - envShFX(w0)) - 0.07;
        if (ph < 0.30 || pw < 0.12) continue;
        const px = s * (W * 0.5) * envShFX(wm);
        // alternate leaves step a little further back — the real curtain wall
        // is a folded plan, not a single sheet
        const pz = back * envShFY(wm) - rec - (k % 2) * 0.09;
        envMouthBox(x, z, cs, sn, yaw, px, ph * 0.5 * ct, pz + ph * 0.5 * st,
                    pw, ph, 0.13, PALETTE.glass, tilt);
      }
    }
  }

  /**
   * One vault = two mirrored shells sharing a crisp ridge, each with a white
   * chevron-banded outer skin and a darker skin inset along the normal for the
   * soffit. `mouth` = glass leaves PER SIDE of the ridge, 0 for a blind vault.
   */
  function envAddVault(x, z, W, H, yaw, RU, RW, mouth) {
    const L = H * envSHELL_LEAN;
    for (let s = -1; s <= 1; s += 2) {
      const outer = envShellHalf(s, W, H, L, RU, RW, 0);
      S.addC(outer, envXform(x, podTop, z, 0, yaw, 0, 1, 1, 1));
      outer.dispose();
      const inner = envShellHalf(s, W, H, L, RU, RW, 0.13 + H * 0.012);
      S.addC(inner, envXform(x, podTop, z, 0, yaw, 0, 1, 1, 1));
      inner.dispose();
    }
    if (mouth) envAddMouth(x, z, W, H, L, yaw, mouth);
  }

  // CONCERT HALL — the big cluster, east of the podium axis. Four vaults
  // stepping DOWN toward the water along -z, each also fanned ~1.5 m further
  // out in +x with a little more yaw so no vault hides inside the silhouette
  // of the one in front, plus the counter-curved tip at the seaward end.
  // Tallest tip: 1.2 + 1.58*6.6 = 11.6, against a podium mass 3.0 deep — close
  // to the ~3.3:1 the real building keeps. Widest point x = 12.24, inside |x| <= 13.
  envAddVault(4.8, -1.4, 10.0, 6.6, -0.05, 20, 8, 6);
  envAddVault(6.6, -4.0, 8.4, 5.4, -0.14, 20, 8, 5);
  envAddVault(8.4, -6.2, 6.6, 4.2, -0.25, 20, 8, 4);
  envAddVault(9.7, -8.0, 5.0, 3.1, -0.36, 12, 5, 0);
  envAddVault(10.7, -9.4, 3.8, 2.2, Math.PI + 0.46, 9, 4, 0);

  // OPERA THEATRE — the smaller cluster, west, on the SAME axis and leaning
  // the same way (every yaw negative); it only fans the other way in x so the
  // two clusters part instead of merging. The 2.4 m gap between them at the
  // deck is the deep central valley.
  envAddVault(-6.4, -3.2, 7.8, 4.9, -0.06, 20, 8, 5);
  envAddVault(-8.1, -5.4, 6.3, 3.9, -0.15, 16, 7, 4);
  envAddVault(-9.6, -7.2, 4.8, 2.9, -0.26, 12, 5, 0);
  envAddVault(-10.8, -8.6, 3.6, 2.1, Math.PI + 0.42, 9, 4, 0);

  // RESTAURANT — low, small, set apart at the podium's south-west corner
  envAddVault(-10.7, 1.7, 3.4, 1.9, -0.30, 10, 4, 3);
  envAddVault(-9.8, 0.5, 2.6, 1.4, -0.52, 8, 4, 0);

  const shells = new THREE.Mesh(S.build(), matVC2);
  shells.castShadow = true;
  shells.receiveShadow = false;   // open double-sided surfaces self-shadow-acne
  root.add(shells);

  // One collider per cluster, measured off the vault footprints above and
  // still stopping well short of z = 1.05, so the whole stage carpet — and the
  // 'opera-stage' task that depends on standing there — stays walkable.
  // Measured cluster AABBs (x0 x1 z0 z1 / peak); each collider matches exactly.
  //   concert hall   -0.36  12.24  -11.00   0.20 / 11.63
  //   opera theatre -12.75  -2.47  -10.01  -1.85 /  8.94
  //   restaurant    -12.56  -8.82   -0.10   2.82 /  4.20
  // The 2.1 m corridor between the two clusters (x -2.47 .. -0.36) is the deep
  // central valley, and it stays walkable.
  // camSolid: see the plinth above, and sysCAM_CLEAR_HARD.
  envStaticBox(game, 5.94, 4.0, -5.40, 6.30, 4.0, 5.60).userData = { camSolid: true };
  envStaticBox(game, -7.61, 3.2, -5.93, 5.14, 3.2, 4.08).userData = { camSolid: true };
  envStaticBox(game, -10.69, 1.6, 1.36, 1.87, 1.6, 1.46).userData = { camSolid: true };

  const arch = new THREE.Mesh(A.build(), matVC);
  arch.castShadow = true;
  arch.receiveShadow = true;
  root.add(arch);

  // ========================================================= BOTANIC GARDENS
  const Gm = envMerger(envBaseA);

  // raised flower beds + flowers
  const stems = [];
  const petalLists = {};
  function envPetalList(c) {
    if (!petalLists[c]) petalLists[c] = [];
    return petalLists[c];
  }
  for (let i = 0; i < envBEDS.length; i++) {
    const b = envBEDS[i];
    Gm.box(b.cx, 0.09, b.cz, b.hx * 2, 0.18, b.hz * 2, PALETTE.soil);
    Gm.box(b.cx, 0.13, b.cz - b.hz - 0.1, b.hx * 2 + 0.3, 0.16, 0.2, PALETTE.stone);
    Gm.box(b.cx, 0.13, b.cz + b.hz + 0.1, b.hx * 2 + 0.3, 0.16, 0.2, PALETTE.stone);
    Gm.box(b.cx - b.hx - 0.1, 0.13, b.cz, 0.2, 0.16, b.hz * 2 + 0.4, PALETTE.stone);
    Gm.box(b.cx + b.hx + 0.1, 0.13, b.cz, 0.2, 0.16, b.hz * 2 + 0.4, PALETTE.stone);

    const n = 20 + Math.floor(b.hx * b.hz);
    for (let f = 0; f < n; f++) {
      const fx = envRR(b.x0 + 0.5, b.x1 - 0.5);
      const fz = envRR(b.z0 + 0.45, b.z1 - 0.45);
      const h = envRR(0.42, 0.62);
      envPush9(stems, fx, 0.18 + h * 0.5, fz, 0, 0, envRR(-0.12, 0.12), 0.06, h, 0.06);
      const col = envRnd() < 0.65 ? b.a : b.b;
      const s = envRR(0.26, 0.38);
      envPush9(envPetalList(col), fx, 0.2 + h, fz, 0, envRR(0, 3), 0, s, s * 0.85, s);
    }
    if (b.prize) {
      for (let f = 0; f < 3; f++) {
        const fx = b.cx + (f - 1) * 1.1, fz = b.cz;
        envPush9(stems, fx, 0.18 + 0.4, fz, 0, 0, 0, 0.09, 0.8, 0.09);
        envPush9(envPetalList(PALETTE.petalRed), fx, 0.98, fz, 0, 0, 0, 0.62, 0.5, 0.62);
      }
    }
  }
  // the flowerbeds, which are the other thing at capybara height in the gardens
  swayMesh(envInstance(root, envG.cyl4, PALETTE.leafC, stems, false, false),
           { leaf: 0.45, amount: 0.055, axis: 'y', auto: true, stiff: 2.0, hz: 1.5 });
  const petalKeys = Object.keys(petalLists);
  for (let i = 0; i < petalKeys.length; i++) {
    envInstance(root, envG.sph5, parseInt(petalKeys[i], 10), petalLists[petalKeys[i]], false, false);
  }

  // hedges — curved runs of instanced boxes
  const hedges = [];
  function envHedgeRun(fn, count, navEvery) {
    for (let i = 0; i < count; i++) {
      const p = fn(i / (count - 1));
      envPush9(hedges, p[0], 0.79 + envRR(-0.05, 0.07), p[1], 0, (p[2] || 0) + envRR(-0.13, 0.13), 0,
        envRR(1.16, 1.34), envRR(1.42, 1.76), envRR(1.26, 1.46));
      if (i % navEvery === 0) envNavC.push(p[0], p[1], 1.5);
    }
  }
  envHedgeRun(t => {
    const z = 14 + t * 38;
    return [15.6 + Math.sin(t * Math.PI) * 2.6, z, Math.sin(t * Math.PI) * 0.3];
  }, 28, 3);
  envHedgeRun(t => {
    const x = 18 + t * 40;
    return [x, 55.6 - Math.sin(t * Math.PI) * 2.2, Math.PI / 2 + Math.sin(t * Math.PI) * 0.25];
  }, 30, 3);
  envHedgeRun(t => {
    const a = -0.55 + t * 2.0;
    return [envPOND.x + Math.cos(a) * 9.2, envPOND.z + Math.sin(a) * 9.2, -a];
  }, 14, 3);
  envHedgeRun(t => [50.5, 16 + t * 10, 0], 8, 3);
  // ---- THE EASTERN WALKS (integrity 7) ----------------------------------
  // The four runs above enclose the western beds and stop at x = 58, z = 56.
  // These three carry the same shrubbery round the eastern quarter and up to
  // the new boundary, so the walk to the railing is a walk between things.
  envHedgeRun(t => {
    const z = 30 + t * 26;
    return [63.5 - Math.sin(t * Math.PI) * 2.4, z, Math.sin(t * Math.PI) * 0.28];
  }, 22, 3);
  envHedgeRun(t => {
    const x = 26 + t * 34;
    return [x, 63.5 - Math.sin(t * Math.PI) * 1.8, Math.PI / 2 + Math.sin(t * Math.PI) * 0.2];
  }, 26, 3);
  envHedgeRun(t => {
    const a = 0.4 + t * 1.7;
    return [52 + Math.cos(a) * 7.4, 50 + Math.sin(a) * 7.4, -a];
  }, 13, 3);
  envInstance(root, envG.box, PALETTE.hedge, hedges, true, true);
  envStaticBox(game, 16.6, 0.8, 33, 1.6, 0.8, 19);
  envStaticBox(game, 38, 0.8, 55.2, 20, 0.8, 1.4);
  envStaticBox(game, 50.5, 0.8, 21, 0.7, 0.8, 5);
  envStaticBox(game, 62.6, 0.8, 43, 1.5, 0.8, 13);
  envStaticBox(game, 43, 0.8, 63.1, 17, 0.8, 1.3);

  // ---- WHERE TO HIDE FROM THEM (L3, F1) -----------------------------------
  // See THE HIDE in systems.js. Sydney's people are npc.js's own roster and
  // the gardener has carried the animal out since chapter one, so no authority
  // is flagged here; this only says where the animal cannot be seen. Each spot
  // is beside a thing the gardens already draw, at the expression that draws
  // it: the outside of the first hedge run at its midpoint (its collider runs
  // to x 18.2), the middle of the pond's arc of hedge (the one run with no
  // collider), the fourth fig's buttress roots on the main path, the café
  // table the 'cafe-table' task stands on, and the back wall of the kiosk.
  if (typeof game.addHide === 'function') {
    game.addHide({ biome: 'sydney', x: 15.6 + 2.6 + 1.8, z: 14 + 0.5 * 38, r: 1.8, kind: 'the hedge' });
    game.addHide({ biome: 'sydney', x: envPOND.x + Math.cos(0.45) * 9.2, z: envPOND.z + Math.sin(0.45) * 9.2, r: 2.0, kind: 'the hedge' });
    game.addHide({ biome: 'sydney', x: envFIG_SPOTS[3][0] + 1.8, z: envFIG_SPOTS[3][1], r: 1.8, kind: 'the fig roots' });
    game.addHide({ biome: 'sydney', x: envQUAY_TABLES[2], z: envQUAY_TABLES[3], r: 1.6, kind: 'under the table' });
    game.addHide({ biome: 'sydney', x: envKIOSK_X - 1.1 - 1.2, z: envKIOSK_Z, r: 1.6, kind: 'behind the kiosk' });
  }

  // lily pads
  const lilies = [];
  envPush9(lilies, 42.4, 0.07, 38.6, 0, 0.4, 0, 1.15, 0.08, 1.15);
  envPush9(lilies, 45.8, 0.07, 41.6, 0, 1.1, 0, 0.9, 0.08, 0.9);
  envPush9(lilies, 44.2, 0.07, 43.2, 0, 2.2, 0, 0.7, 0.08, 0.7);
  leafMesh(envInstance(root, envG.cyl6, PALETTE.leafB, lilies, false, false), 0.55);
  envNavC.push(envPOND.x, envPOND.z, envPOND.r + 0.6);

  // benches
  function envAddBench(M, x, z, yaw) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    M.box(x, 0.52, z, 1.9, 0.13, 0.6, PALETTE.wood, 0, yaw, 0);
    // yaw ONLY — an rz here rolled the backrest and read as a tipped-over bench
    M.box(x - s * 0.26, 0.83, z - c * 0.26, 1.9, 0.5, 0.12, PALETTE.wood, 0, yaw, 0);
    for (let i = 0; i < 4; i++) {
      const ox = (i < 2 ? -0.78 : 0.78), oz = (i % 2 ? 0.22 : -0.22);
      M.box(x + ox * c - oz * s, 0.24, z + ox * -s + oz * c, 0.13, 0.48, 0.13, PALETTE.woodDark, 0, yaw, 0);
    }
    envNavC.push(x, z, 1.3);
  }
  envAddBench(Gm, 26, 14.5, 0.2);
  envAddBench(Gm, 46.5, 33.5, -0.7);
  envAddBench(Gm, -30, -6.5, Math.PI);
  envAddBench(Gm, -48, -6.5, Math.PI);
  // ---- and four in the east, all of them facing something (integrity 7):
  // two out at the harbour over the north lawn, one back down the fig avenue,
  // one at the corner where the two new hedge runs meet.
  envAddBench(Gm, 56.5, 52.0, -0.55);
  envAddBench(Gm, 38.0, 60.5, 0.0);
  envAddBench(Gm, 60.5, 40.0, -1.5);
  envAddBench(Gm, 20.0, 60.0, 0.35);
  envStaticBox(game, 26, 0.5, 14.5, 1.0, 0.5, 0.4);
  envStaticBox(game, 46.5, 0.5, 33.5, 1.0, 0.5, 0.4);
  envStaticBox(game, -30, 0.5, -6.5, 1.0, 0.5, 0.4);
  envStaticBox(game, -48, 0.5, -6.5, 1.0, 0.5, 0.4);
  envStaticBox(game, 56.5, 0.5, 52.0, 1.0, 0.5, 0.4);
  envStaticBox(game, 38.0, 0.5, 60.5, 1.0, 0.5, 0.4);
  envStaticBox(game, 60.5, 0.5, 40.0, 0.4, 0.5, 1.0);
  envStaticBox(game, 20.0, 0.5, 60.0, 1.0, 0.5, 0.4);

  // ------------------------------------------------- SPAWN LAWN FURNITURE --
  // Every piece has ONE explicit hand-chosen position — nothing here is
  // scattered — and every piece is yaw-only, flat on the ground, legs at y = 0.
  // The capy spawns at (0, 22) and walks -z to the podium steps, so the
  // corridor x [-3.5, 3.5] z [6, 21] is left completely empty.
  //
  //   bin stand    (-10.0, 12.6)   r 1.30      bench W  ( -6.2, 17.2)  r 1.00
  //   park sign    (  7.0, 13.5)   r 1.05      bubbler  (  4.8, 17.8)  r 0.40
  //   bench E      (  9.8, 20.6)   r 1.00      picnic   (-12.8, 23.6)  r 1.35
  //   bike rack    ( 12.8, 25.4)   r 0.95      bench N  (  2.8, 32.0)  r 1.00
  //   retaining edge  x [-14.6, -5.9]  z 28.5 +/- 0.4
  // Closest pair is bin stand <-> bench W (5.97 apart, 3.67 clear); every other
  // pair, and every path, tree trunk and lamp post, clears by more than 2.5.
  envAddBench(Gm, -6.2, 17.2, 0.30);
  envAddBench(Gm, 9.8, 20.6, -0.60);
  envAddBench(Gm, 2.8, 32.0, Math.PI);
  envStaticBox(game, -6.2, 0.5, 17.2, 1.0, 0.5, 0.5);
  envStaticBox(game, 9.8, 0.5, 20.6, 1.0, 0.5, 0.5);
  envStaticBox(game, 2.8, 0.5, 32.0, 1.0, 0.5, 0.5);

  // drinking fountain (bubbler) — pedestal from y = 0 to the basin
  const bubX = 4.8, bubZ = 17.8;
  Gm.cyl(bubX, 0.42, bubZ, 0.19, 0.84, PALETTE.stone, 0, 0, 0, 6);
  Gm.cyl(bubX, 0.90, bubZ, 0.34, 0.16, PALETTE.stoneDark, 0, 0, 0, 6);
  Gm.cyl(bubX, 0.99, bubZ, 0.24, 0.06, PALETTE.water, 0, 0, 0, 6);
  Gm.box(bubX, 1.06, bubZ + 0.20, 0.08, 0.22, 0.08, PALETTE.metal, -0.4, 0, 0);
  envNavC.push(bubX, bubZ, 0.75);
  envStaticBox(game, bubX, 0.45, bubZ, 0.3, 0.45, 0.3);

  // rubbish-bin stand: two bins under a little timber hood, open side south
  const binX = -10.0, binZ = 12.6;
  for (let i = 0; i < 2; i++) {
    const bnx = binX - 0.58 + i * 1.16;
    Gm.box(bnx, 0.41, binZ, 0.70, 0.82, 0.70, i ? PALETTE.binGreen : PALETTE.binRed);
    Gm.box(bnx, 0.87, binZ, 0.78, 0.10, 0.78, PALETTE.binLid);
  }
  Gm.box(binX, 0.52, binZ - 0.46, 2.3, 1.04, 0.10, PALETTE.woodDark);
  Gm.box(binX - 1.10, 0.52, binZ + 0.46, 0.10, 1.04, 0.10, PALETTE.woodDark);
  Gm.box(binX + 1.10, 0.52, binZ + 0.46, 0.10, 1.04, 0.10, PALETTE.woodDark);
  Gm.box(binX, 1.09, binZ, 2.4, 0.12, 1.06, PALETTE.wood);
  envNavC.push(binX, binZ, 1.5);
  envStaticBox(game, binX, 0.5, binZ, 1.2, 0.5, 0.55);

  // park sign board — two posts in the ground, painted face toward the spawn
  const sgnX = 7.0, sgnZ = 13.5, sgnYaw = 0.20;
  Gm.box(sgnX - 0.70, 0.62, sgnZ + 0.14, 0.15, 1.24, 0.15, PALETTE.woodDark, 0, sgnYaw, 0);
  Gm.box(sgnX + 0.70, 0.62, sgnZ - 0.14, 0.15, 1.24, 0.15, PALETTE.woodDark, 0, sgnYaw, 0);
  Gm.box(sgnX, 1.42, sgnZ, 2.0, 0.86, 0.14, PALETTE.wood, 0, sgnYaw, 0);
  Gm.box(sgnX + 0.02, 1.44, sgnZ + 0.09, 1.66, 0.60, 0.06, PALETTE.sail, 0, sgnYaw, 0);
  envNavC.push(sgnX, sgnZ, 1.2);

  // bike rack — three hoops, each leg standing on the lawn
  const brX = 12.8, brZ = 25.4;
  for (let i = 0; i < 3; i++) {
    const bkx = brX - 0.8 + i * 0.8;
    Gm.cyl(bkx, 0.34, brZ - 0.34, 0.055, 0.68, PALETTE.metal, 0, 0, 0, 6);
    Gm.cyl(bkx, 0.34, brZ + 0.34, 0.055, 0.68, PALETTE.metal, 0, 0, 0, 6);
    Gm.box(bkx, 0.68, brZ, 0.11, 0.11, 0.68, PALETTE.metal);
  }
  envNavC.push(brX, brZ, 1.3);

  // picnic table + its two attached seats. Yaw only. Four table legs AND four
  // seat legs, all reaching y = 0 — the seat planks used to float unsupported.
  const ptX = -12.8, ptZ = 23.6, ptYaw = 0.40;
  const ptC = Math.cos(ptYaw), ptS = Math.sin(ptYaw);
  Gm.box(ptX, 0.76, ptZ, 2.3, 0.12, 1.04, PALETTE.wood, 0, ptYaw, 0);
  for (let i = 0; i < 2; i++) {
    const lz = i ? 0.98 : -0.98;
    Gm.box(ptX + lz * ptS, 0.44, ptZ + lz * ptC, 2.3, 0.10, 0.42, PALETTE.woodDark, 0, ptYaw, 0);
  }
  for (let i = 0; i < 4; i++) {
    const lx = i < 2 ? -0.92 : 0.92, lz = i % 2 ? 0.44 : -0.44;
    Gm.box(ptX + lx * ptC + lz * ptS, 0.38, ptZ - lx * ptS + lz * ptC,
           0.14, 0.76, 0.14, PALETTE.woodDark, 0, ptYaw, 0);
  }
  for (let i = 0; i < 4; i++) {
    const lx = i < 2 ? -0.86 : 0.86, lz = i % 2 ? 0.98 : -0.98;
    Gm.box(ptX + lx * ptC + lz * ptS, 0.195, ptZ - lx * ptS + lz * ptC,
           0.12, 0.39, 0.12, PALETTE.woodDark, 0, ptYaw, 0);
  }
  envNavC.push(ptX, ptZ, 1.8);
  envStaticBox(game, ptX, 0.4, ptZ, 1.3, 0.4, 1.1);

  // low sandstone retaining edge terracing the north side of the lawn
  for (let i = 0; i < 5; i++) {
    const rex = -13.6 + i * 1.7;
    Gm.box(rex, 0.22, 28.5 + Math.sin(i * 0.9) * 0.16, 1.74, 0.44, 0.72,
           i % 2 ? PALETTE.sandstone : PALETTE.sandstoneDark);
  }
  Gm.box(-10.2, 0.48, 28.5, 8.7, 0.1, 0.88, PALETTE.stone);
  envNavR.push(-14.7, 27.9, -5.7, 29.1);
  envStaticBox(game, -10.2, 0.24, 28.5, 4.35, 0.24, 0.44);

  // garden shed
  const shedX = 56, shedZ = 12;
  Gm.box(shedX, 1.4, shedZ, 4.4, 2.8, 4.4, PALETTE.wood);
  Gm.box(shedX - 2.24, 1.35, shedZ, 0.2, 2.5, 1.8, PALETTE.woodDark);
  Gm.box(shedX - 1.6, 2.9, shedZ, 3.0, 0.35, 5.0, PALETTE.stoneDark, 0, 0, 0.42);
  Gm.box(shedX + 1.6, 2.9, shedZ, 3.0, 0.35, 5.0, PALETTE.stoneDark, 0, 0, -0.42);
  Gm.box(shedX, 3.55, shedZ, 0.5, 0.3, 5.0, PALETTE.stone);
  envStaticBox(game, shedX, 1.4, shedZ, 2.2, 1.4, 2.2);
  envNavR.push(shedX - 2.5, shedZ - 2.5, shedX + 2.5, shedZ + 2.5);

  // wheelbarrow
  Gm.box(39.6, 0.72, 15.2, 1.35, 0.62, 0.95, PALETTE.cone, 0, 0.4, 0.16);
  Gm.cyl(38.9, 0.32, 15.5, 0.32, 0.22, PALETTE.metal, 0, 0.4, Math.PI / 2, 6);
  Gm.box(40.5, 0.55, 15.0, 1.5, 0.1, 0.1, PALETTE.metal, 0, 0.4, -0.1);
  Gm.box(40.5, 0.55, 15.6, 1.5, 0.1, 0.1, PALETTE.metal, 0, 0.4, -0.1);
  envNavC.push(39.7, 15.2, 1.1);

  // hose reel
  Gm.cyl(53.6, 0.62, 16.6, 0.3, 0.78, PALETTE.metal, 0, 0, Math.PI / 2, 8);
  Gm.cyl(53.6, 0.62, 16.6, 0.55, 0.5, PALETTE.leafC, 0, 0, Math.PI / 2, 8);
  Gm.box(53.6, 0.3, 16.6, 0.9, 0.6, 0.12, PALETTE.metal);
  envNavC.push(53.6, 16.6, 0.9);

  // signpost
  Gm.cyl(19.2, 1.2, 7.2, 0.12, 2.4, PALETTE.woodDark, 0, 0, 0, 6);
  Gm.box(19.9, 2.1, 7.2, 1.7, 0.36, 0.1, PALETTE.wood, 0, 0.25, 0);
  Gm.box(18.6, 1.6, 7.2, 1.6, 0.32, 0.1, PALETTE.wood, 0, -1.9, 0);
  Gm.box(19.2, 2.42, 7.2, 0.34, 0.22, 0.34, PALETTE.stone);
  envNavC.push(19.2, 7.2, 0.7);

  // ================================================== THE GARDEN'S BOUNDARY
  //
  // Block 1 gave Sydney its two rectangles and the land one stops at z = 70,
  // because the ground BODY stops there. The lawn mesh does not — it runs to
  // z = 150 so the horizon has no hard edge in it — so the "that is not part of
  // the world" toast fired while the player was standing on visible grass with
  // nothing anywhere to say why. qa/b7-northlawn-before.png is the frame: at
  // (0, 66), the last legal step, there is lawn to the skyline and one fig.
  //
  // THE FIX IS NOT TO MOVE THE FENCE. Moving it out puts the animal back on
  // ground with no collider under it, which is the bug block 1 closed. The fix
  // is to make z = 70 LOOK like the end of the gardens, which in life it is:
  // the Royal Botanic Garden has a boundary, and it is a sandstone plinth with
  // an iron palisade on it and a pier every few metres.
  //
  // AND IT IS SOLID, which means the toast now almost never fires on the north
  // — you meet a railing at 68.6 instead of a message at 70. A wall you bump
  // into is a better answer than a sentence, and it is the same answer the
  // harbour gives on the other three sides.
  //
  // The lawn still runs past it to the skyline. That is the point: a boundary
  // you can see over reads as "the garden ends here", where a wall reads as a
  // box. Same reason the mesh was drawn long in the first place.
  {
    const bBody = envPoolBody();
    const bars = [];
    const BY = 1.62;                       // top of the palisade
    // one run: from (ax, az) to (bx, bz), piers every ~7.5 m
    function envBoundRun(ax, az, bx, bz) {
      const dx = bx - ax, dz = bz - az;
      const len = Math.hypot(dx, dz);
      const yaw = Math.atan2(dx, dz);
      const cx = (ax + bx) * 0.5, cz = (az + bz) * 0.5;
      const ux = dx / len, uz = dz / len;
      // the plinth — one merged box per run, sandstone, kerb-height
      Gm.box(cx, 0.26, cz, 0.46, 0.52, len, PALETTE.sandstone, 0, yaw, 0);
      Gm.box(cx, 0.55, cz, 0.56, 0.10, len, PALETTE.sandstoneDark, 0, yaw, 0);
      // the top rail, which is what actually draws the line at this distance
      Gm.box(cx, BY, cz, 0.10, 0.09, len, PALETTE.ironDark, 0, yaw, 0);
      // piers
      const piers = Math.max(2, Math.round(len / 7.5));
      for (let i = 0; i <= piers; i++) {
        const t = i / piers;
        const px = ax + dx * t, pz = az + dz * t;
        Gm.box(px, 0.95, pz, 0.62, 1.90, 0.62, PALETTE.sandstone, 0, yaw, 0);
        Gm.box(px, 1.95, pz, 0.74, 0.16, 0.74, PALETTE.sandstoneDark, 0, yaw, 0);
        envNavC.push(px, pz, 0.8);
      }
      // the palings, instanced — 55 cm apart, which is close enough to read as
      // a railing from the 35 degree camera and far enough to see the park
      // through. Skipped where a pier already stands.
      const n = Math.floor(len / 0.55);
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const px = ax + dx * t, pz = az + dz * t;
        let onPier = false;
        for (let k = 0; k <= piers; k++) {
          if (Math.abs(t - k / piers) * len < 0.62) { onPier = true; break; }
        }
        if (onPier) continue;
        envPush9(bars, px, 0.85, pz, 0, yaw, 0, 0.075, 1.55, 0.075);
      }
      // ONE COLLIDER PER SEGMENT, not per paling. Boxes of 6 m along the run,
      // so a diagonal run is a staircase of short boxes rather than one long
      // box that bulges away from the line it is drawn on.
      // envPoolBox has no yaw — only rx — so the half-extents have to be put on
      // the right axis by hand. Every run here is axis-aligned, which is why
      // that is allowed to be an if.
      const segs = Math.max(1, Math.round(len / 6));
      const half = len / segs * 0.5 + 0.05;
      const alongX = Math.abs(ux) > Math.abs(uz);
      for (let i = 0; i < segs; i++) {
        const t0 = (i + 0.5) / segs;
        envPoolBox(bBody, ax + dx * t0, 0.95, az + dz * t0,
                   alongX ? half : 0.30, 0.95, alongX ? 0.30 : half);
      }
      return [ux, uz];
    }
    // The north edge, and the two flanks as far south as the garden goes. The
    // flanks stop at z = 8 rather than running to the waterline: south of that
    // is the Opera House forecourt and the quay, which have their own edges and
    // do not want a park railing across them.
    envBoundRun(-66, 68.6, 66, 68.6);
    envBoundRun(66.6, 8, 66.6, 68.6);
    envBoundRun(-66.6, 8, -66.6, 68.6);
    envInstance(root, envG.box, PALETTE.ironDark, bars, true, false);
    envPoolDone(game, bBody);
  }

  const garden = new THREE.Mesh(Gm.build(), matVC);
  garden.castShadow = true;
  garden.receiveShadow = true;
  root.add(garden);

  // =================================================================== TREES
  const figTrunk = [], figRoot = [], canA = [], canB = [], canC = [];
  const pineTrunk = [], pineConeA = [], pineConeB = [];
  const palmTrunk = [], palmFrond = [];
  const jacTrunk = [], jacCan = [];
  const trunkShapes = [];

  function envTreeSpotOk(x, z) {
    if (z < -8.5 || z > 66 || x < -66 || x > 66) return false;
    if (x > -15 && x < 15 && z < 11) return false;   // widened opera forecourt
    if (envRectHit(envZONES.picnic, x, z, 1.6)) return false;
    if (envNavBlocked(x, z, 2.4)) return false;
    for (let i = 0; i < envBEDS.length; i++) {
      if (envRectHit(envBEDS[i], x, z, 2.0)) return false;
    }
    const dpx = x - envPOND.x, dpz = z - envPOND.z;
    if (dpx * dpx + dpz * dpz < 64) return false;
    for (let p = 0; p < envPATHS.length; p++) {
      const pts = envPATHS[p];
      for (let i = 0; i < pts.length; i += 2) {
        const dx = x - pts[i], dz = z - pts[i + 1];
        if (dx * dx + dz * dz < 9) return false;
      }
    }
    return true;
  }

  function envTreeSpot(x0, x1, z0, z1) {
    for (let t = 0; t < 60; t++) {
      const x = envRR(x0, x1), z = envRR(z0, z1);
      if (envTreeSpotOk(x, z)) return [x, z];
    }
    return null;
  }

  function envAddTrunkShape(x, z, r, h) {
    trunkShapes.push(x, z, r, h);
  }

  // Moreton Bay figs — thick buttressed trunk, broad blobby canopy
  for (let i = 0; i < envFIG_SPOTS.length; i++) {
    const sp = envFIG_SPOTS[i];
    const s = envRR(0.9, 1.25);
    const th = 3.4 * s;
    envPush9(figTrunk, sp[0], th * 0.5, sp[1], 0, envRR(0, 3), 0, 1.5 * s, th, 1.5 * s);
    for (let b = 0; b < 4; b++) {
      const a = b / 4 * Math.PI * 2 + envRR(0, 1);
      envPush9(figRoot, sp[0] + Math.cos(a) * 0.75 * s, 0.55 * s, sp[1] + Math.sin(a) * 0.75 * s,
        0, a, 0, 0.85 * s, 1.5 * s, 0.85 * s);
    }
    const canY = th + 1.5 * s;
    const blobs = [canA, canB, canC, canA, canB];
    for (let b = 0; b < 5; b++) {
      const a = b / 5 * Math.PI * 2;
      const rr = b === 0 ? 0 : 2.1 * s;
      envPush9(blobs[b],
        sp[0] + Math.cos(a) * rr, canY + envRR(-0.5, 0.7) * s, sp[1] + Math.sin(a) * rr,
        0, a, 0, envRR(3.4, 4.6) * s, envRR(2.6, 3.4) * s, envRR(3.4, 4.6) * s);
    }
    envAddTrunkShape(sp[0], sp[1], 0.8 * s, th);
    envNavC.push(sp[0], sp[1], 1.1 * s);
  }

  // Norfolk pines — stacked cones
  for (let i = 0; i < 8; i++) {
    const sp = envTreeSpot(-64, 64, -6, 64);
    if (!sp) continue;
    const s = envRR(0.9, 1.35);
    envPush9(pineTrunk, sp[0], 3.0 * s, sp[1], 0, 0, 0, 0.7 * s, 6.0 * s, 0.7 * s);
    for (let c = 0; c < 5; c++) {
      const t = c / 4;
      const list = c % 2 ? pineConeB : pineConeA;
      envPush9(list, sp[0], (1.6 + t * 5.4) * s, sp[1], 0, envRR(0, 3), 0,
        (4.4 - t * 3.0) * s, (2.6 - t * 1.1) * s, (4.4 - t * 3.0) * s);
    }
    envAddTrunkShape(sp[0], sp[1], 0.45 * s, 6 * s);
    envNavC.push(sp[0], sp[1], 0.7 * s);
  }

  // Palms — curved trunk of stacked segments + splayed fronds
  for (let i = 0; i < 10; i++) {
    const sp = i < 7 ? envTreeSpot(-64, -16, -7, 14) : envTreeSpot(14, 64, -6, 30);
    if (!sp) continue;
    const s = envRR(0.9, 1.2);
    const lean = envRR(-0.13, 0.13), leanZ = envRR(-0.11, 0.11);
    let px = sp[0], py = 0, pz = sp[1];
    for (let seg = 0; seg < 4; seg++) {
      const h = 1.5 * s;
      px += lean * seg * 0.55; pz += leanZ * seg * 0.55;
      envPush9(palmTrunk, px, py + h * 0.5, pz, leanZ * seg * 0.5, 0, -lean * seg * 0.5,
        (0.62 - seg * 0.05) * s, h, (0.62 - seg * 0.05) * s);
      py += h;
    }
    for (let f = 0; f < 7; f++) {
      const a = f / 7 * Math.PI * 2 + envRR(0, 0.5);
      const tilt = 1.15 + envRR(-0.2, 0.25);
      const half = 1.7 * s;
      // push the blade out along its own axis so it grows from the crown
      envPush9(palmFrond,
        px + Math.sin(tilt) * Math.sin(a) * half,
        py + 0.15 + Math.cos(tilt) * half,
        pz + Math.sin(tilt) * Math.cos(a) * half,
        tilt, a, 0, 0.9 * s, 3.4 * s, 0.22 * s);
    }
    envPush9(palmFrond, px, py + 1.05 * s, pz, 0.25, 0, 0, 0.7 * s, 1.6 * s, 0.2 * s);
    envAddTrunkShape(sp[0], sp[1], 0.35 * s, 5.6 * s);
    envNavC.push(sp[0], sp[1], 0.6 * s);
  }

  // Jacarandas in purple bloom
  for (let i = 0; i < envJAC_SPOTS.length; i++) {
    const sp = envJAC_SPOTS[i];
    const s = envRR(0.85, 1.1);
    envPush9(jacTrunk, sp[0], 1.5 * s, sp[1], 0, 0, 0, 0.75 * s, 3.0 * s, 0.75 * s);
    for (let b = 0; b < 3; b++) {
      const a = b / 3 * Math.PI * 2;
      envPush9(jacCan, sp[0] + Math.cos(a) * 1.2 * s, (3.4 + envRR(-0.3, 0.5)) * s,
        sp[1] + Math.sin(a) * 1.2 * s, 0, a, 0,
        envRR(2.8, 3.6) * s, envRR(2.0, 2.6) * s, envRR(2.8, 3.6) * s);
    }
    envAddTrunkShape(sp[0], sp[1], 0.4 * s, 3 * s);
    envNavC.push(sp[0], sp[1], 0.8 * s);
  }

  envInstance(root, envG.cyl6, PALETTE.trunk, figTrunk, true, true);
  envInstance(root, envG.cone6, PALETTE.trunkDark, figRoot, true, false);
  leafMesh(envInstance(root, envG.sph6, PALETTE.leafA, canA, true, false), 0.3);
  leafMesh(envInstance(root, envG.sph6, PALETTE.leafB, canB, true, false), 0.3);
  leafMesh(envInstance(root, envG.sph6, PALETTE.leafC, canC, true, false), 0.3);
  envInstance(root, envG.cyl6, PALETTE.trunkDark, pineTrunk, true, true);
  leafMesh(envInstance(root, envG.cone6, PALETTE.leafC, pineConeA, true, false), 0.34);
  leafMesh(envInstance(root, envG.cone6, PALETTE.leafA, pineConeB, true, false), 0.34);
  envInstance(root, envG.cyl6, PALETTE.trunk, palmTrunk, true, true);
  leafMesh(envInstance(root, envG.cone4, PALETTE.palmLeaf, palmFrond, true, false), 0.62);
  envInstance(root, envG.cyl6, PALETTE.trunkDark, jacTrunk, true, true);
  leafMesh(envInstance(root, envG.sph6, PALETTE.petalPurple, jacCan, true, false), 0.4);

  // ---- ground cover: low, wide grass tufts in irregular clumps
  function envTuftOk(x, z, r) {
    if (envNavBlocked(x, z, r)) return false;
    if (x > -13.8 && x < 13.8 && z < 10.8) return false;   // forecourt + podium
    if (z < -4.2) return false;                            // quay and sea wall
    if (x < -15 && z < 5.5) return false;                  // promenade sand + paving
    if (x > 13 && x < 24 && z < 1.5) return false;         // boat ramp sand
    for (let p = 0; p < envPATHS.length; p++) {
      const pts = envPATHS[p];
      for (let i = 0; i < pts.length; i += 2) {
        const dx = x - pts[i], dz = z - pts[i + 1];
        if (dx * dx + dz * dz < 4) return false;
      }
    }
    return true;
  }
  const tufts = [], tuftsPale = [];
  // A tuft is a squashed 4-sided cone: at most 0.14 high and 2-3x wider than it
  // is tall, so it reads as a clump of grass rather than a spike in the lawn.
  function envTuftClump(cx, cz, n, pale) {
    const list = pale ? tuftsPale : tufts;
    for (let i = 0; i < n; i++) {
      const a = envRR(0, 6.283), d = envRR(0.1, 1.0) * envRR(0.6, 2.1);
      const tx = cx + Math.cos(a) * d, tz = cz + Math.sin(a) * d;
      if (!envTuftOk(tx, tz, 0.35)) continue;
      const h = envRR(0.09, 0.14), w = envRR(0.26, 0.44);
      envPush9(list, tx, h * 0.5 + 0.01, tz,
        envRR(-0.07, 0.07), envRR(0, 1.55), envRR(-0.07, 0.07),
        w, h, w * envRR(0.8, 1.25));
    }
  }
  // clumps, with bare lawn between them and the spawn area thinned right down
  for (let i = 0; i < 110; i++) {
    const cx = envRR(-64, 64), cz = envRR(-3.5, 64);
    if (!envTuftOk(cx, cz, 1.0)) continue;
    if (envRectHit(envZONES.picnic, cx, cz, 0)) continue;
    const sdz = cz - 22;
    if (cx * cx + sdz * sdz < 380 && envRnd() < 0.78) continue;
    envTuftClump(cx, cz, 3 + Math.floor(envRR(0, 6)), envRnd() < 0.34);
  }
  // paler clumps hugging the hedge lines
  const hedgeN = hedges.length / 9;
  for (let i = 0; i < 34 && hedgeN > 0; i++) {
    const h = Math.floor(envRR(0, hedgeN)) * 9;
    const a = envRR(0, 6.283), d = envRR(1.2, 2.6);
    envTuftClump(hedges[h] + Math.cos(a) * d, hedges[h + 2] + Math.sin(a) * d, 3, true);
  }
  // ---- AND THE LAWN MOVES (v44) -----------------------------------------
  // See THE WAKE in shared.js. Chapter 1 is the first thing anybody sees and
  // the most static thing in it was the ground cover. A tuft is fourteen
  // centimetres tall, so the amount is small in absolute terms and large as a
  // fraction of the plant, which is what grass does; and the wake radius is
  // 1.75 m, so a capybara at a run opens a path through the lawn about its own
  // length across. `auto` reads the squashed cone rather than being told.
  swayMesh(envInstance(root, envG.cone4, PALETTE.grassDark, tufts, false, false),
           { leaf: 0.45, amount: 0.045, axis: 'y', auto: true, stiff: 1.3, hz: 1.7 });
  swayMesh(envInstance(root, envG.cone4, PALETTE.grassPale, tuftsPale, false, false),
           { leaf: 0.45, amount: 0.050, axis: 'y', auto: true, stiff: 1.3, hz: 1.7 });

  // trunk collision, bucketed so we stay well inside the body budget
  for (let i = 0; i < trunkShapes.length; i += 4 * 6) {
    const b = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC, material: envGroundPhysMat });
    for (let j = i; j < Math.min(i + 4 * 6, trunkShapes.length); j += 4) {
      const r = trunkShapes[j + 2], h = trunkShapes[j + 3];
      b.addShape(new CANNON.Box(new CANNON.Vec3(r, h * 0.5, r)),
        new CANNON.Vec3(trunkShapes[j], h * 0.5, trunkShapes[j + 1]));
    }
    b.allowSleep = true;
    game.world.addBody(b);
  }

  // ===================================================== DISTANT DECOR ONLY
  const B = envMerger(envBaseA);
  const bx = -34, bz = -62;
  // pylons
  B.box(bx - 24, 8, bz, 3.6, 16, 5.4, PALETTE.bridge);
  B.box(bx + 24, 8, bz, 3.6, 16, 5.4, PALETTE.bridge);
  B.box(bx - 24, 16.4, bz, 4.2, 1.0, 6.0, PALETTE.stone);
  B.box(bx + 24, 16.4, bz, 4.2, 1.0, 6.0, PALETTE.stone);
  // deck
  B.box(bx, 8.2, bz, 76, 1.0, 4.6, PALETTE.bridge);
  B.box(bx, 8.9, bz, 76, 0.35, 4.9, PALETTE.stoneDark);
  // shallow arch + hangers
  for (let i = 0; i < 13; i++) {
    const t = (i / 12) * 2 - 1;
    const ax = bx + t * 22;
    const ay = 8.2 + 11.5 * (1 - t * t);
    const slope = Math.atan2(-23 * t, 22);
    B.box(ax, ay, bz, 4.4, 1.2, 2.4, PALETTE.bridge, 0, 0, slope);
    if (i % 2 === 1 && ay > 9.6) B.box(ax, (ay + 8.2) * 0.5, bz, 0.35, ay - 8.2, 0.35, PALETTE.bridge);
  }
  // far shore closing the horizon — pale, so aerial perspective reads correctly
  B.box(0, 0.4, -126, 300, 2.4, 16, PALETTE.leafPale);
  B.box(-70, 1.6, -122, 40, 3.0, 8, PALETTE.grassPale);
  B.box(60, 1.4, -123, 50, 2.6, 8, PALETTE.grassPale);
  for (let i = 0; i < 14; i++) {
    const sx2 = envRR(-120, 120);
    const hh = envRR(3, 11);
    B.box(sx2, hh * 0.5, envRR(-128, -119), envRR(4, 9), hh, envRR(4, 8),
      i % 3 === 0 ? PALETTE.stone : i % 3 === 1 ? PALETTE.sandstone : PALETTE.stoneDark);
  }
  const bridge = new THREE.Mesh(B.build(), matVC);
  bridge.castShadow = false;
  bridge.receiveShadow = false;
  bridge.frustumCulled = false;
  root.add(bridge);

  // The flock goes in LAST, after every other envRR() consumer in the build,
  // so adding it cannot walk the shared seed and move a single palm or a
  // single block of the far skyline. See envBuildLorikeets.
  envBuildLorikeets(root);
  envBuildTraffic(game, root, matVC);
  root.add(envBuildGlitter());

  // ------------------------------------------------------- nav: the harbour
  envNavR.push(-260, -260, 260, -10.4);

  // ==================================================================== API
  function envIsOverWater(x, z) {
    if (z >= -10) return false;
    if (x >= -13.4 && x <= 13.4 && z >= -12.4) return false;   // opera podium
    if (x >= -43.7 && x <= -36.3 && z >= -24.4) return false;  // ferry wharf
    return true;
  }

  function envInZone(name, x, z) {
    if (name === 'flowerbed') {
      for (let i = 0; i < envBEDS.length; i++) {
        if (envRectHit(envBEDS[i], x, z, 0.35)) return true;
      }
      return false;
    }
    const r = envZONES[name];
    if (!r || r.x0 === undefined) return false;
    return envRectHit(r, x, z, 0);
  }

  function envRandomPointIn(name) {
    if (name === 'flowerbed') {
      // gardeners patrol to these — reject points buried in edging or a hedge
      for (let k = 0; k < 12; k++) {
        const b = envBEDS[Math.floor(Math.random() * envBEDS.length)];
        const x = rand(b.x0 + 0.3, b.x1 - 0.3), z = rand(b.z0 + 0.3, b.z1 - 0.3);
        if (!envNavBlocked(x, z, 0.5)) return { x, z };
      }
      const b = envBEDS[Math.floor(Math.random() * envBEDS.length)];
      return { x: rand(b.x0 + 0.3, b.x1 - 0.3), z: rand(b.z0 + 0.3, b.z1 - 0.3) };
    }
    const r = envZONES[name] || envZONES.gardens;
    const strict = name === 'gardens' || name === 'promenade' || name === 'picnic' ||
                   name === 'flowerbed' || name === 'operaStage' ||
                   name === 'boardwalk' || name === 'terrace';
    let x = (r.x0 + r.x1) * 0.5, z = (r.z0 + r.z1) * 0.5;
    for (let i = 0; i < 24; i++) {
      x = rand(r.x0 + 1, r.x1 - 1);
      z = rand(r.z0 + 1, r.z1 - 1);
      if (!strict || !envNavBlocked(x, z, 1.1)) return { x, z };
    }
    return { x, z };
  }

  // Buoyancy surface. Identical maths to the ripple written into the water mesh
  // below, so a prop floating here sits exactly on the visible swell. Amplitude
  // is capped at 0.10 + 0.08 = 0.18, which bobs a beach ball and launches nothing.
  function envWaterHeightAt(x, z) {
    return -0.5 + Math.sin(x * 0.09 + envTime * 0.9) * 0.10
                + Math.sin(z * 0.14 - envTime * 0.7) * 0.08;
  }

  function envUpdate(dt) {
    // Sydney costs nothing while the player is in Pasto: no ripple upload, no
    // cloud matrices, no ferry. envTime stops with it, so the harbour is exactly
    // where it was left on re-entry.
    if (game.biome && typeof game.biome.isActive === 'function' &&
        !game.biome.isActive('sydney')) {
      // Park the ferry once on the way out, or the stale velocity from the last
      // Sydney frame gets integrated for one step on re-entry and she jumps.
      if (envAsleep) return;
      envAsleep = true;
      if (envFerryBody) { envFerryBody.velocity.setZero(); envFerryBody.angularVelocity.setZero(); }
      if (envVanBody) { envVanBody.velocity.setZero(); envVanBody.angularVelocity.setZero(); }
      // ...and the eleven hulls, for exactly the same reason. Every biome
      // shares one coordinate space, so a boat left with a velocity in it is a
      // boat still sailing across whichever country the player travelled to.
      for (let i = 0; i < envTrafBody.length; i++) {
        envTrafBody[i].velocity.setZero();
        envTrafBody[i].angularVelocity.setZero();
      }
      // The stage weight must fall to zero on the way OUT, not hold whatever it
      // was when the player left. Every biome shares one coordinate space, so
      // the podium rectangle exists as bare ground in all seventeen of the
      // others and a held weight would light somebody else's chapter — the
      // same trap `opera-stage` itself is gated against in systems.js.
      envStageT = 0;
      envStagePulse = 0;
      if (envConcertOn) {
        envConcertOn = false; envConcertNotes = 0;
        if (game.concert && typeof game.concert.end === 'function') game.concert.end();
        envConcertFile(game);          // a concert cut short by travel still counts
      }
      return;
    }
    envAsleep = false;
    {
      const capy = game.capy;
      const on = !!(capy && capy.position && envInZone('operaStage', capy.position.x, capy.position.z) &&
                    capy.position.y > 0.9);
      envStageT += (( on ? 1 : 0) - envStageT) * (1 - Math.exp(-2.4 * dt));
      envStagePulse *= Math.exp(-1.6 * dt);
      // ---- THE SECOND ASK (L6, F2): `ibis-parade` reads game.herdCount() —
      // the herd skill the bin teaches, consumed here for the first time.
      // The led birds walk the trail behind the animal, so "on the podium
      // with you" is the animal on the red and two of them led, held 1 s.
      if (!envIbisParadeDone) {
        const led = on && typeof game.herdCount === 'function' ? game.herdCount() : 0;
        envIbisParadeT = led >= 2 ? envIbisParadeT + dt : 0;
        if (envIbisParadeT > 1.0) {
          envIbisParadeDone = true;
          if (typeof game.completeTask === 'function') game.completeTask('ibis-parade');
          if (typeof game.toast === 'function') game.toast('two ibis on the steps of the Opera House. nobody minds. nobody ever minds the ibis.');
        }
      }
      // ---- the concert's clock (W1). See stageNote above. -------------------
      if (envConcertOn) {
        envConcertOff = on ? 0 : envConcertOff + dt;
        const house = (game.concert && typeof game.concert.house === 'function') ? game.concert.house(false) : 0;
        const coming = (game.concert && typeof game.concert.house === 'function') ? game.concert.house(true) : 0;
        // ...and the house, on the paper, for as long as the concert is on —
        // through the tick and the encore, because the house keeps arriving
        // after the cheer and the number is the most of them at once. See
        // envConcertPeak. Not gated on envConcertDone: the record outlives it.
        if (house > envConcertPeak) envConcertPeak = house;
        if (typeof game.recordLive === 'function') {
          game.recordLive('opera-stage', envConcertPeak > 0 ? envConcertPeak : undefined);
        }
        if (!envConcertDone) {
          if (typeof game.wowLive === 'function') {
            const nn = Math.min(envConcertNotes, envCONCERT_NOTES);
            const line = 'on stage · ' + nn + ' of ' + envCONCERT_NOTES + ' wheeks · ' +
                         (house > 0 ? house + ' listening' : coming > 0 ? coming + ' coming over' : 'nobody yet');
            game.wowLive(line, 0.5 * nn / envCONCERT_NOTES + 0.5 * Math.min(house, 4) / 4);
          }
          if (envConcertNotes >= envCONCERT_NOTES && house >= envCONCERT_HOUSE && on) {
            envConcertDone = true;
            envStagePulse = 1;
            envEncoreT = envENCORE_WIN; envEncoreDone = false;
            if (game.concert && typeof game.concert.cheer === 'function') game.concert.cheer(4.5);
            if (typeof game.completeTask === 'function') game.completeTask('opera-stage');
            if (typeof game.toast === 'function') game.toast('they liked that. once more, while they are here — the encore.');
          }
        }
        if (envEncoreT > 0) {
          envEncoreT -= dt;
          if (typeof game.wowLive === 'function' && !envEncoreDone) game.wowLive('THE ENCORE · wheek once more · ' + Math.ceil(envEncoreT) + ' s', 1);
        }
        // ---- the answer, a beat after the note (L5) ------------------------
        if (envAnswerT >= 0) {
          envAnswerT -= dt;
          if (envAnswerT < 0) {
            const k = (game.concert && typeof game.concert.answer === 'function') ? game.concert.answer() : 0;
            if (k > 0 && typeof game.sfx === 'function') {
              game.sfx('cheer', { volume: 0.18 + 0.06 * Math.min(k, 8), pitch: 1.2 + 0.04 * Math.min(k, 8), force: true,
                                  at: { x: 0, y: 1.5, z: 8.4 }, near: 6, far: 60 });
            }
            // the second note: the ferry answers, if she is in the harbour
            if (envAnswerNote === 2 && envFerry && envFerry.position && typeof game.sfx === 'function') {
              const fp = envFerry.position;
              game.sfx('horn', { volume: 0.7, pitch: 0.95, at: { x: fp.x, y: fp.y + 3, z: fp.z }, near: 20, far: 300, force: true });
            }
          }
        }
        if (envConcertOff > envCONCERT_LEAVE) {
          envConcertOn = false;
          envConcertNotes = 0; envEncoreT = 0;
          if (game.concert && typeof game.concert.end === 'function') game.concert.end();
          envConcertFile(game);        // the house goes home: the number is final
        }
      }
    }
    envTime += dt;
    envFireworkStep(game, dt);
    envFerryStep(game, dt);
    envVanStep(game, dt);
    envPlaneStep(game, dt);
    envLoriStep(game, dt);
    envTrafStep(game, dt);
    envGlitStep(game);
    envSprayStep(game, dt);
    // harbour ripple — 30 Hz is plenty and halves the per-frame buffer upload
    envRippleT += dt;
    if (envRippleT >= 0.0333) {
      envRippleT = 0;
      const a = envWaterAttr.array;
      const t = envTime;
      for (let i = 0; i < a.length; i += 3) {
        a[i + 1] = Math.sin(a[i] * 0.09 + t * 0.9) * 0.10 + Math.sin(a[i + 2] * 0.14 - t * 0.7) * 0.08;
      }
      envWaterAttr.needsUpdate = true;
    }
    // drifting clouds
    const cd = envCloudData;
    envQ.identity();
    for (let i = 0; i < cd.length; i += 7) {
      let x = cd[i] + cd[i + 6] * dt;
      if (x > 155) x -= 310;
      cd[i] = x;
      envV3.set(x, cd[i + 1], cd[i + 2]);
      envSc.set(cd[i + 3], cd[i + 4], cd[i + 5]);
      envM.compose(envV3, envQ, envSc);
      envCloudMesh.setMatrixAt(i / 7, envM);
    }
    envCloudMesh.instanceMatrix.needsUpdate = true;
  }

  // The ferry record. `position` is a live THREE.Vector3 refreshed each frame
  // from the body's INTERPOLATED transform — read it, never keep it.
  envFerry = {
    onBoard: envFerryOnBoard,
    docked: envFerryDocked,
    position: envFerryPos,
    group: envFerryGroup,
    body: envFerryBody,
    deckY: envFERRY_DECK_Y,
    gangwayX: envFERRY_NODES[0] + envFERRY_DECK_HX + 0.35,
    gangwayZ: envFERRY_NODES[1],
  };

  const api = {
    group: root,
    /**
     * WHEN THE FERRY IS NEXT ALONGSIDE (D9).
     *
     * `ferry-ride` is a "be there when X happens" task and the ferry is on a
     * circuit the player cannot see: six nodes, five legs of five to seven
     * seconds, and a twenty-second dwell at the wharf. systems.js has had the
     * `nextIn` hook since P3 and six chapters publish it — this chapter,
     * chapter ONE, was not one of them, which meant the very first task in the
     * game that asks you to wait was also the only kind of waiting the paper
     * never explained.
     *
     * Returns 0 while she is alongside, otherwise the seconds until she is.
     * Summed off the node table rather than tracked, so it cannot drift out of
     * step with envUpdateFerry: `NODES[n*5+2]` is the DURATION of the leg into
     * node n and `NODES[n*5+3]` is the dwell once it is reached.
     *
     * It is an ESTIMATE while the animal is standing in the berth — the ferry
     * waits rather than shoves, exactly as the carroza does, and a stalled boat
     * makes any countdown wrong. That is the right trade: the number is there
     * to tell you whether to run, and the case where it is wrong is the case
     * where you are already standing on the spot.
     */
    nextIn(id) {
      // ---- AND THE OTHER THING IN THIS CHAPTER THAT MAKES YOU WAIT (F4) --
      // `whippy-run` is measured in METRES RIDDEN IN ONE GO, and metres only
      // accrue while she is actually driving (see the `envVanDwell <= 0` gate
      // on the ride). So a player who does the hard part — getting onto the
      // roof — at the wrong moment stands on a stationary van for up to
      // eleven seconds with the counter frozen and nothing anywhere saying
      // why. That is the same complaint the ferry hook below was written for,
      // in the same chapter, about the row directly under it.
      //
      // Zero while she is rolling: the window IS the leg.
      if (id === 'whippy-run') return envVanDwell > 0 ? envVanDwell : 0;
      if (id !== 'ferry-ride') return -1;
      if (envFerryDocked) return 0;
      const N = envFERRY_N;
      let s = 0, leg = envFerryLeg;
      if (envFerryDwell > 0) {
        s += envFerryDwell;
      } else {
        s += Math.max(0, envFERRY_NODES[leg * 5 + 2] - envFerryT);
        if (leg === 0) return s;
        s += envFERRY_NODES[leg * 5 + 3];
        leg = (leg + 1) % N;
      }
      for (let k = 0; k < N; k++) {
        s += envFERRY_NODES[leg * 5 + 2];
        if (leg === 0) break;
        s += envFERRY_NODES[leg * 5 + 3];
        leg = (leg + 1) % N;
      }
      return s;
    },
    // ---- WHERE THE WORLD ACTUALLY STOPS -----------------------------------
    // MEASURED: drop the animal at z = 200, or at x = ±140, and it does not
    // fall and it is never rescued — it stands at y = 0.18 on capybara.js's
    // soft floor, hundreds of metres outside anything that is drawn, for ever.
    // Sydney's ground BODY is a box over x ±70, z -10..70 and nothing at all
    // exists past it; the lawn MESH runs to z = 150 purely so the horizon has
    // no hard edge in it, and the soft floor answers for the whole infinite
    // plane. So walking north out of the gardens is a one-way trip into
    // featureless grey with no fall to trigger a rescue — the exact failure
    // Pasto was given bounds() for, in the one chapter every player walks in
    // first, and never fixed here.
    //
    // TWO rectangles, not their union — the land box and the harbour, tested
    // separately. Swimming to the far shore stays legal; walking off the north
    // end of the lawn does not, and neither does walking east or west off it,
    // which the old single-rectangle form allowed for 72 m. See envBOUNDS.
    // systems.js's backVoid adds its own four metres of grace on top of this —
    // see sysVOID_PAD.
    bounds() { return envBOUNDS; },
    // The trees are this chapter's roofs. See CANOPY CEILING.
    camCeil: envCamCeil,
    waterLevel: -0.5,
    waterEdgeZ: -10,
    isOverWater: envIsOverWater,
    waterHeightAt: envWaterHeightAt,
    inZone: envInZone,
    zones: envZONES,
    flowerBeds: envBEDS,
    prizeBed: envBEDS[0],
    pond: envPOND,
    navBlocked: envNavBlocked,
    randomPointIn: envRandomPointIn,
    ferry: envFerry,
    cafeTables: envCafeTables,
    perches: envPerches,
    // {x, y, z, reach, angle, on, sprays(x, z) -> bool} — the rotor is off until
    // the capybara treads on the valve plate, then runs for envSPRINK_BURST.
    sprinklers: envSprinklers,
    /**
     * HOW WET THIS SPOT IS MAKING YOU, 0..1 — capybara.js's optional `soaking`
     * hook. Only the sprinklers answer it, and only while the valve is open.
     * Deliberately just under a swim: a rotor at two metres gets you as wet as
     * you can get standing up, and the harbour still has to be worse.
     */
    soaking(x, z) {
      for (let i = 0; i < envSprinklers.length; i++) {
        const s = envSprinklers[i];
        if (s && s.on && s.sprays(x, z)) return envSPRINK_WET;
      }
      return 0;
    },
    buskerSpot: envBUSKER_SPOT,
    // Mr Whippy. `van()` is a live position — she MOVES, so ask, never cache.
    van: function () { return envVanPos; },
    vanParked: function () { return envVanDwell > 0; },
    vanRiding: function () { return !!(game.capy && envVanOnRoof(game.capy.position)); },
    // Where a queue forms while she is stopped. Live — see envVanQueueSpot.
    vanQueueSpot: envVanQueueSpot,
    // How long she has been stopped, so nobody joins a queue that is about to
    // watch the van drive off. envVAN_DWELL is the whole stop.
    vanDwellLeft: function () { return envVanDwell; },
    kioskSpot: envKIOSK_SPOT,
    /**
     * 0..1 — HOW MUCH OF THE STAGE YOU ARE STANDING ON, for the event grade
     * layer. Chapter 1 has never had a row in it: `lit` was not a channel the
     * first chapter of the game could use, and v25 wrote that down and moved on
     * because using it meant first adding a damped weight in three places.
     *
     * The sails are the brightest object in the chapter — warm cream, sunlit,
     * and the only large pale mass in a park — so standing between them is
     * genuinely a change in the light, not a decoration invented for a row.
     * Damped here rather than in the grade so the chapter owns the shape of its
     * own signal; the grade only decides what to do with it.
     */
    stageGlow: function () { return Math.min(1, envStageT + envStagePulse * 0.7 + (envEncoreGlowT > 0 ? 1 : 0)); },
    /**
     * A WHEEK FROM THE STAGE (W1). capybara.js calls this instead of ticking
     * the task itself. Returns the note count so the caller can toast.
     */
    stageNote: function () {
      if (!game.biome || !game.biome.isActive('sydney')) return 0;
      envStagePulse = 1;
      if (!envConcertOn) {
        envConcertOn = true;
        envConcertNotes = 0;
        envConcertDone = false;
        envConcertOff = 0;
        envConcertPeak = 0;            // a new concert is a new house
        // opened with no figure: the paper shows the standing best alone until
        // somebody is actually in place (the documented opening call)
        if (typeof game.recordLive === 'function') game.recordLive('opera-stage');
      }
      envConcertNotes++;
      // EVERY NOTE CALLS WIDER (L5): the first from the forecourt, the second
      // from the far end of it, the third from the quay
      const coming = (game.concert && typeof game.concert.call === 'function') ? game.concert.call(0, 2.5, envConcertNotes) : 0;
      if (envConcertNotes <= 3 && typeof game.toast === 'function') {
        game.toast(coming > 0 ? (envConcertNotes === 1 ? 'they are coming over. keep going' : coming + ' coming. again — louder carries further')
                              : envConcertNotes < 3 ? 'nobody in reach yet. again — a wheek carries further each time'
                              : 'nobody about at all. wheek from the podium with people on the forecourt');
      }
      // ...and the house answers, a beat later
      envAnswerT = envANSWER_LAG; envAnswerNote = envConcertNotes;
      // the encore (L5): a note after the cheer, inside the window
      if (envConcertDone && !envEncoreDone && envEncoreT > 0) {
        envEncoreDone = true; envEncoreT = 0;
        if (game.concert && typeof game.concert.cheer === 'function') game.concert.cheer(6.5);
        if (typeof game.confetti === 'function') { const cp = game.capy && game.capy.position; if (cp) game.confetti(cp.x, cp.y + 1.2, cp.z, 28); }
        if (game.music && typeof game.music.swell === 'function') game.music.swell(1.0);
        if (typeof game.sfx === 'function') game.sfx('cheer', { volume: 0.7, pitch: 1.1, force: true });
        if (typeof game.punch === 'function') game.punch(0.12);
        if (typeof game.toast === 'function') game.toast('AN ENCORE. the whole forecourt — and the harbour.');
        // ---- THE HARBOUR'S ENCORE (L5) -------------------------------------
        if (typeof game.slowmo === 'function') game.slowmo(0.5, 1.6);
        envEncoreFwN = envENCORE_SHELLS; envEncoreFwNext = 0.3; envEncoreGlowT = 10;
        if (typeof api.operaShot === 'function') api.operaShot(5.5);
      }
      return envConcertNotes;
    },
    /** The concert, for the harness: notes, house in place, on, done. */
    concertAudit: function () {
      const house = (game.concert && typeof game.concert.house === 'function') ? game.concert.house(false) : 0;
      return { on: envConcertOn, notes: envConcertNotes, house: house, done: envConcertDone, pulse: envStagePulse };
    },
    /**
     * FRAME THE PODIUM PAYOUT — the fourth channel, for the one silhouette
     * this whole game is most recognisable by.
     *
     * Batch 2 measured what `opera-stage` actually looked like when it fired:
     * walking onto the podium collapses the rig from 7.2 m at 45 degrees to
     * 3.05 m at 68.6 degrees, so the moment the task pays out the camera is
     * jammed against the shells looking DOWN at them, and it recovers to 45.6
     * about a metre further on. It recorded that as finding B and could not
     * close it, because `frameShot` did not exist until batch 3 built it. This
     * is that finding, closed.
     *
     * The bearing is COMPUTED from the two shell clusters, not written as a
     * literal. Both v26's aurora (0 of 336 vertices in frame, from writing 0
     * where pi belonged) and v27's Göreme sunrise (the obvious -pi/2 put the
     * sun behind the player's own basket) were sign errors in a hand-reasoned
     * bearing, and both were found from a projection test rather than from the
     * code. `yaw` is the bearing FROM the animal TO the camera, so putting the
     * camera on the OPPOSITE side of the animal from the shells is what leaves
     * the shells standing behind it.
     */
    operaShot: function (hold) {
      if (typeof game.frameShot !== 'function' || !game.capy) return false;
      const p = game.capy.position;
      // The visual mass of the building: the midpoint of the two clusters'
      // seaward halves, taken off the envAddVault calls above.
      const sx = 0, sz = -5.2;
      game.frameShot({
        yaw: Math.atan2(p.x - sx, p.z - sz),
        // 21 m and a low pitch: the tallest tip is 11.6 m and the podium mass
        // is 3.0 deep, so anything nearer or steeper cuts the sails off at the
        // top — which is precisely what the un-framed rig was doing.
        dist: 17, pitch: 13 * Math.PI / 180, raise: 2.8, hold: typeof hold === 'number' ? hold : 3.0
      });
      return true;
    },
    /** THE ENCORE, for the harness (L5). */
    encoreAudit: function () {
      return { encoreT: +envEncoreT.toFixed(2), encoreDone: envEncoreDone, shellsLeft: envEncoreFwN, glowT: +envEncoreGlowT.toFixed(2),
               answerT: +envAnswerT.toFixed(2), notes: envConcertNotes };
    },
    update: envUpdate,
  };
  game.env = api;
  return api;
}
