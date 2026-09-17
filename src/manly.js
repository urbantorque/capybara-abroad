import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PALETTE, mat, rand, randInt, clamp, damp, dampAngle, lerp, grain, placeCue, swayMesh, makeMerger } from './shared.js';

// ===========================================================================
// CHAPTER 14 — MANLY. THE SEA HAS A SHAPE HERE.
//
// Three chapters of this game are in Sydney and two of them are played on the
// harbour, which is a flat pale sheet that exists to be fallen into. That is
// what harbour water IS. Seven hundred metres north-east of the last one, over
// a low sandstone spine and down the Corso, is the other kind, and the whole
// argument for a fourteenth chapter is that they are not the same thing and
// the game has never said so.
//
//   THE ONE NEW HOOK: `localWater`.
//
// For thirteen chapters `waterLevel` was a NUMBER — one height for the whole
// sea, which is why Venice could have a tide (the number moves) and nowhere
// could have a wave (the number is not a function of where you are). A biome
// may now declare `localWater: true`, and capybara.js asks `waterHeightAt(x,z)`
// instead. That is the entire change to the controller, thirteen chapters are
// untouched to the last decimal, and everything below falls out of it:
//
//   - the animal rides up and down on the swell, because the buoyancy spring
//     it has always had is now chasing a surface that moves;
//   - the swash picks you up off the sand, because `isOverWater` is
//     "is the water here above the ground here" and both sides move;
//   - a wave arriving is a thing that happens TO you rather than a thing drawn
//     near you.
//
// The push is the OTHER channel this game already has — `flow(x, z)`, built
// for the Uji. A wave is a patch of water that is itself going somewhere, and
// this is the fourth chapter to say so. Never a force (the swim cap eats it),
// never a velocity write (it deletes the only steering the player has out
// there). See CONTRACT.md, THE AIR IS A REFERENCE FRAME.
//
// THE SHAPE OF THE CHAPTER IS A CROSS-SECTION, and it is the only chapter in
// the game whose map is a graph:
//
//   z  78..40   THE CORSO. shops, awnings, the surf club, Norfolk pines.
//   z  40..24   THE BEACH. towels, a sandcastle, the flags, the boat.
//   z  24..-26  THE SURF ZONE. a bank at −26 that the swell trips over, and
//               fifty metres of white water between it and the sand.
//   x  −34      THE RIP. a gutter through the bank where nothing breaks and
//               everything drains. It is the trap AND it is the way out.
//   z −26..−80  OUT THE BACK, and one rock at (40, −46) that should not be
//               there — the bommie, which stands up every set.
//   x  56..104  THE POINT. Fairy Bower's ocean pool (flat water, ten metres
//               from water that is not), Shelly, and a very large fish.
//
// THE SET IS THE CLOCK. Nine crests in the pattern, 8.4 s apart: seventy-six
// seconds from one proper wave to the next, five of the nine big enough to
// break on the bank, and exactly one that is the wave. Nothing in this game is
// missable for ever, so the big one comes round whether anybody is watching.
//
// Everything is prefixed `man` (contract: the bundler flattens every module
// into one scope).
// ===========================================================================

// ---------------------------------------------------------------- geography --
const manSPAWN = { x: 0, y: 3.2, z: 46 };

// STILL WATER IS ZERO, like Palawan and unlike the other twelve. Every height
// in this file is therefore also a depth, and a chapter whose whole subject is
// the difference between the water level and the sand cannot afford an offset
// that has to be carried through the swell, the break, the swash and the rip.
const manWATER = 0;

const manSHORE_Z = 24;               // where the still waterline meets the sand
const manDUNE_Z = 34;                // top of the beach
const manPROM_Z = 41;                // the promenade
const manPROM_Y = 2.6;
// WHERE manTerrain STOPS ANSWERING. See the domain note at the top of it.
// The extent of the chapter's own colliders (biome.boundsOf: x -132..143,
// z -112..105) plus three metres, so the real edge of the world is never NaN.
const manDOM_X0 = -135, manDOM_X1 = 146;
// ...except in +z, where it is the DRAWN edge and not the collider box. The
// heightfield's last row is z = 100 and the drawn world ends there on every x
// measured; the collider box runs to 105 only because a static box overhangs.
// At z = 108 the profile answers manPROM_Y + 1.56 over nothing at all, which
// measured as the single worst float in the game (+4.00 m). 102 is the last
// row plus half an element.
const manDOM_Z0 = -115, manDOM_Z1 = 102;
const manSHOP_Z = 54;                // the shopfronts start
const manBEACH_X0 = -62;             // the beach between the two headlands
const manBEACH_X1 = 56;

// THE BANK. It is not straight, and that is the most important line in the
// file: a straight bank makes a straight wall of white water that arrives all
// at once, and there is nothing to read and nowhere to be. Bent, the wave
// trips at one point first and the break runs along the beach — so there IS a
// peak, it IS in a findable place, and standing in the right spot is the skill.
const manBANK_Z = -26;
const manBANK_D = 2.10;              // depth over the crest of it
function manBankZ(x) {
  return manBANK_Z + 5.5 * Math.sin(x * 0.030) + 2.4 * Math.sin(x * 0.071 + 1.2);
}

// THE RIP. A gutter cut through the bank at x = −34: two and a half metres
// deeper, so the swell rolls through it without tripping. Every litre the
// waves push over the bank has to get back out to sea and this is where it
// goes, at rather more than a capybara can swim. That is not a punishment —
// it is a lift, and it is the way the locals get out.
const manRIP_X = -34;
const manRIP_W = 13;
const manRIP_V = 4.2;                // m/s at the throat, against a 2.6 swim cap
function manRipK(x) {
  const t = (x - manRIP_X) / manRIP_W;
  return Math.exp(-t * t);
}

// THE SWELL.
const manPERIOD = 8.4;               // seconds between crests
const manWAVELEN = 66;               // metres between crests
// The deep-water speed, which is the FASTEST the swell ever goes: by the time
// it reaches the bank it is doing half of this. See the phase table below.
const manA0 = 1.50;                  // offshore amplitude, in deep water
const manDEEP = 9.5;                 // the depth manA0 is quoted at
// Nine crests, and the shape of them is the chapter's clock. Five clear 0.70,
// which is where a wave starts breaking on a 1.25 m bank; one is the wave.
const manSET = [0.42, 0.52, 0.70, 0.88, 1.00, 0.90, 0.72, 0.50, 0.36];
const manBREAK_K = 0.78;             // amplitude / depth at which it trips

// The bommie — a pinnacle out the back that stands the swell up on its own.
const manBOMMIE = { x: 40, z: -46, r: 7.5, top: -0.35 };

// The point, the ocean pool at Fairy Bower, and Shelly round the back.
const manPOOL = { x0: 60, x1: 82, z0: 8, z1: 22, y: 0.35, floor: -1.45, wall: 1.15 };
const manSHELLY = { x: 84, z: -20, r: 17 };
const manPOINT_X = 56;

const manFLAG_HOME = { x: 6, z: 30 };
const manBOAT_HOME = { x: -14, z: 29.5 };
const manPINE_Z = 39.5;

// ------------------------------------------------------------------ state --
let manGame = null;
let manBuilt = false;
let manRoot = null;
let manTime = 0;

// the drawn surf surface
let manSurfMesh = null, manSurfPos = null, manSurfCol = null;
let manSurfNX = 0, manSurfNZ = 0;
let manSurfX0 = 0, manSurfZ0 = 0, manSurfStep = 0;
// per-column constants, so the per-frame cost of the sea is one cosine a vertex
let manColBend = null, manColShelt = null, manColRip = null;

// foam streaks, advected by the real flow field
let manFoamMesh = null;
const manFOAM_N = 150;
let manFoamX = null, manFoamZ = null, manFoamLife = null, manFoamScale = null;

// spray off the lip
let manSprayMesh = null;
const manSPRAY_N = 96;
let manSprayX = null, manSprayY = null, manSprayZ = null;
let manSprayVX = null, manSprayVY = null, manSprayVZ = null, manSprayT = null;
let manSprayNext = 0;

// the bathers, who follow the flags
let manBathers = null;
const manBATHER_N = 22;
let manBathX = null, manBathZ = null, manBathTX = null, manBathTZ = null;
let manBathPh = null, manBathCol = null;
// WHO IS ACTUALLY IN THE WATER.
//
// The chapter's first spoken line is "swim between the flags, mate, that is the
// whole system" and for the whole life of this file every bather stood on dry
// sand: the scatter put them at flagZ +/- 5, the flags live at z = 30, and the
// waterline is at 24. The beach whose entire subject is WHERE YOU MAY SWIM had
// nobody swimming in it. Two thirds of them are in it now, they are held
// between the poles rather than round them, and they ride the swell — which is
// also what makes moving the flags read as a consequence rather than as
// sixteen people shuffling four metres up the sand.
let manBathWet = null;               // 1 = in the water
let manBathLook = 0;                 // 0..1 — everybody turned to watch the set
// ...and WHAT they are turned to. The horizon while a set is standing up, the
// rider once the water has somebody, and the flags the rest of the time.
let manBathAimX = manFLAG_HOME.x, manBathAimZ = -60;

// the flags
let manFlagA = null, manFlagB = null;
let manFlagX = manFLAG_HOME.x, manFlagZ = manFLAG_HOME.z;
let manFlagHeld = false, manFlagHeldB = false, manFlagMovedT = 0, manFlagCool = 0;
// where the pole was standing when it was picked up, so "moved the flags" can
// tell a hundred-metre relocation from putting it back in its own hole
let manFlagFromX = manFLAG_HOME.x, manFlagFromZ = manFLAG_HOME.z;
let manBathCheer = 0;                // 0..n s — twenty-two arms in the air

// the surfboat
let manBoatGroup = null, manBoatBody = null;
let manBoatT = 0, manBoatPhase = 'beached';
const manBoatTarget = { x: manBOAT_HOME.x, y: 0.55, z: manBOAT_HOME.z };
const manBoatPrev = { x: manBOAT_HOME.x, y: 0.55, z: manBOAT_HOME.z };
let manBoatCarrying = false, manBoatOut = false;
// the sweep calls it three seconds before they go. See manUpdateBoat.
let manBoatCalled = false;
let manBoatStroke = 0;
const manBoatFrame = { x: 0, z: 0 };

// the dolphins, who are on no list at all
let manDolphins = null;
const manDOLPH_N = 4;
let manDolphT = 0, manDolphActive = false, manDolphWait = 26;
// the note, on a countdown rather than on a modulo window — see manUpdateDolphins
let manDolphNote = 0;
let manDolphCrest = 0;
let manDolphX = -14;                 // where the line is, so it can move to a rider

// the pelican, ditto
let manPelican = null;
let manPelT = 0, manPelState = 'stand';
const manPelFrom = new THREE.Vector3();
const manPelTo = new THREE.Vector3();

// the groper
let manGroper = null;

// tasks / measured things
let manRideDist = 0, manRideBest = 0, manRideOff = 0, manRideTop = 0;
const manALL_THE_WAY = 24;   // m to the sand that is the marquee (W4); the record's par stays 34
// ---- D4.11: THE CARVE ------------------------------------------------------
// -1..1, the rider's lateral demand along the crest. Written once a frame by
// manUpdateSurfTasks and read by manFlowAt, which stays a pure field function.
let manCarve = 0;
let manCarveDist = 0;       // how far along the crest this ride has actually gone
const manCARVE_MIN  = 3.0;  // m of ride before the stick does anything — you have
                            // to be ON the wave before you can steer on it
const manCARVE_V    = 3.4;  // m/s of lateral at full lock on a full face
const manCARVE_GAIN = 0.55; // ...and the shoreward bonus for being angled
const manCARVE_L    = 3.2;  // how fast the demand follows the stick
let manRipT = -1, manRipDone = false;
let manGullBackT = 0, manGullBackDone = false;   // THE SECOND ASK (L6, F2)
let manTookOff = false, manTakeTop = 0;
// ...AND THE SAME FOR THE FULL RIDE. See the payout: the condition it tested was
// true of every qualifying ride, so the ceremony ran on all of them.
let manAllWayDone = false;
let manDuckT = 0;
let manPoolEnd = 0;
let manSeenSet = false;
let manToldRip = false, manToldSet = false;
let manSandcastle = null, manCastleGone = false;
// what is left of it once you have run through it. See manBuildBeachThings.
let manCastleRuin = null;
// the edge of the wave detonating on the bommie. See manUpdateSurfTasks.
let manBommieHit = false;
let manConeT = 0, manConeMesh = null;
let manBigNear = 0;                  // 0..1 — how close the wave of the set is
// the sound of the beach, which is a property of the BREAK and not of the
// wave the animal happens to be standing in. See the bed in manUpdateSurfTasks.
let manSurfBed = 0, manSurfT = 0, manSetToldT = 0;
let manSurfMover = null;             // the break, as a place (A1)
let manRideEndT = 0;                 // s of the tail after a ride that made the sand

// scratch (contract: zero allocation in update)
const manV3 = new THREE.Vector3();
const manV3b = new THREE.Vector3();
const manV3gull = new THREE.Vector3();   // gullAt()'s own — two getters, two vectors (F2)
const manQ = new THREE.Quaternion();
const manE = new THREE.Euler();
const manSc = new THREE.Vector3();
const manM = new THREE.Matrix4();
const manCol = new THREE.Color();
const manCol2 = new THREE.Color();
const manWave = { y: 0, amp: 0, face: 0, foam: 0, push: 0, depth: 0, brk: 0, ground: 0, f: 0 };
const manFlow = { x: 0, z: 0 };
const manFlowProbeOut = { x: 0, z: 0 };   // D4.11 instrument only
const manFoamFlow = { x: 0, z: 0 };   // the foam loop, never the api's object
const manSfx = { volume: 1, pitch: 1 };

function manXform(x, y, z, rx, ry, rz, sx, sy, sz) {
  manV3.set(x, y, z);
  manE.set(rx, ry, rz);
  manQ.setFromEuler(manE);
  manSc.set(sx, sy, sz);
  manM.compose(manV3, manQ, manSc);
  return manM;
}

const manG = { box: null, cyl6: null, cyl8: null, cyl4: null, cone6: null, cone8: null,
               sph6: null, sph8: null, plane: null };
function manInitGeos() {
  if (manG.box) return;
  manG.box = new THREE.BoxGeometry(1, 1, 1);
  manG.cyl6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
  manG.cyl8 = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
  manG.cyl4 = new THREE.CylinderGeometry(0.5, 0.5, 1, 4);
  manG.cone6 = new THREE.ConeGeometry(0.5, 1, 6);
  manG.cone8 = new THREE.ConeGeometry(0.5, 1, 8);
  manG.sph6 = new THREE.SphereGeometry(0.5, 6, 4);
  manG.sph8 = new THREE.SphereGeometry(0.5, 8, 6);
  manG.plane = new THREE.PlaneGeometry(1, 1);
}

/** CONTRACT: box() takes FULL extents, CANNON.Box takes HALF, and manStaticBox
 *  speaks THIS one so the drawn thing and the solid thing cannot differ by 2x. */
function manMerger() {
  return makeMerger(manG, {
    xform: manXform, cylSegs: [4, 8], coneSegs: [8], sphSegs: [8], normals: 'recompute', jitter: 0.052,
  });
}

function manVC() {
  return grain(mat(0xffffff, { vertexColors: true }),
               { scale: 0.45, amount: 0.085, warp: 0.55, near: 0.30, nearScale: 8, contact: 1 });
}
/** Ground strength, and no vertical shear: the sand is horizontal. */
function manVCG() {
  return grain(mat(0xffffff, { vertexColors: true }),
               { scale: 0.5, amount: 0.16, warp: 0, near: 0.44, speck: 0.65, nearScale: 8, contact: 1, broad: 0.1, broadM: 18 });
}
/**
 * THE SEA, AND IT IS THE BRIGHTEST WATER IN THE GAME.
 *
 * Every other chapter's sparkle is a sun path on a flat sheet. Here the sheet
 * has a metre and a half of relief on it and half of what the player has to
 * read is WHERE THE WHITE IS, so the glitter is turned up and — the part that
 * matters — the cut is raised, so it lands in patches on the faces rather than
 * dusting the whole bay. It goes over vertex colours that are already doing
 * the work; this is the shine on top of them.
 */
function manVCW() {
  // 1.35 AND 0.70, NOT 0.85 AND 0.64. Measured off a screenshot of the outer
  // bay: at 0.85 the sparkle cells are 1.18 m across, which from a lens six
  // metres up is a fifteen-pixel white blob — and a field of fifteen-pixel
  // white blobs on green water does not read as glitter, it reads as LITTER.
  // Finer cells and a higher cut is the same amount of light in twice as many
  // pieces, each of them small enough to be a glint. See THE PICTURE: 1 m is
  // the floor for a sea you look ACROSS; this one is also looked DOWN into.
  return grain(mat(0xffffff, { vertexColors: true }),
               { scale: 0.22, amount: 0.045, warp: 0,
                 sparkle: 0.62, sparkleScale: 1.35, sparkleSpeed: 0.5,
                 sparkleCut: 0.70, sparkleBand: 0.075, sparkleColor: 0xf2fbff, fresnel: 0.65 });
}

function manSyncBody(b) {
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
  b.previousQuaternion.copy(b.quaternion);
  b.interpolatedQuaternion.copy(b.quaternion);
}
function manStaticBox(game, x, y, z, sx, sy, sz, ry) {
  const b = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
  b.addShape(new CANNON.Box(new CANNON.Vec3(sx * 0.5, sy * 0.5, sz * 0.5)));
  b.position.set(x, y, z);
  if (ry) b.quaternion.setFromEuler(0, ry, 0);
  manSyncBody(b);
  game.world.addBody(b);
  return b;
}
/**
 * ONE COMPOUND BODY PER CLUSTER — the Sydney/Quay pattern.
 *
 * The solidity audit over this chapter reported 263 walk-through hits on the
 * point's mesh alone: twenty-two boulders up to 2.6 m across, nine more round
 * Shelly, a board rack, five bins, four bike racks and six umbrella poles, none
 * of which was solid. A bollard-sized object is exactly the wrong size to leave
 * open — too tall to step over (the animal manages 0.40) and too small to read
 * as a wall — so walking through one looks like a bug rather than like a
 * concession. But forty separate bodies is forty broadphase entries for street
 * furniture, so they go in as shapes on ONE body per cluster.
 */
function manPoolBody() {
  const b = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC });
  b.allowSleep = true;
  return b;
}
function manPoolBox(b, x, y, z, hx, hy, hz, ry) {
  const q = new CANNON.Quaternion();
  if (ry) q.setFromEuler(0, ry, 0);
  b.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)), new CANNON.Vec3(x, y, z), q);
  return b;
}
function manPoolDone(game, b) {
  if (!b.shapes.length) return b;
  b.material = (game.mats && game.mats.ground) || undefined;
  manSyncBody(b);
  game.world.addBody(b);
  return b;
}
function manSmooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

// ================================================================= TERRAIN ==
/**
 * THE GROUND, AND THE INTERESTING HALF OF IT IS UNDER THE WATER.
 *
 * Analytic, cheap and called several times a frame by four different modules.
 * The profile from the promenade out to sea is the whole chapter drawn as a
 * graph, so it is written that way: land, beach, the long shallow ramp, the
 * bank, and then away.
 */
function manTerrain(x, z) {
  // ---- A LAW HAS A DOMAIN, AND THIS ONE HAD NONE (integrity 2) -----------
  // Every branch below is a PROFILE — a curve in z, or a distance falloff —
  // and not one of them stopped. manHeadH ends with
  // `if (z > 30) h = Math.max(h, manPROM_Y)`, so for any x west of the beach
  // and any z past 30 it returned 2.6 m FOR EVER; manProfile climbs to
  // manPROM_Y + 3.4 past z = 82 and holds that to infinity.
  //
  // Measured: the drawn world ends at z = 100 on every x tested, and at
  // (-70, 110) the law returned exactly 2.60 with NOTHING drawn underneath.
  // The animal settled on capybara.js's soft floor and stood in an empty beige
  // void with no shadow (qa/rev-manly-float.png). That is what "terrainHeight
  // is out by a mean +1.29 m" turned out to mean — not a mis-shaped hill, a
  // law with no edge.
  //
  // NaN is the designed answer: capyAskNum() drops a non-finite reply and
  // falls back, and the hint arrow, the local anchors, prop placement and the
  // stuck-rescue all read this same function. Since integrity 1 the player is
  // also rescued out here, so this is the second line of that defence rather
  // than the only one.
  //
  // The rectangle is the extent of the chapter's own colliders, measured with
  // biome.boundsOf(): x -132..143, z -112..105, opened out by three metres so
  // that a legitimate edge of the world is never NaN.
  if (x < manDOM_X0 || x > manDOM_X1 || z < manDOM_Z0 || z > manDOM_Z1) return NaN;
  // ---- the point, and everything east of the beach -----------------------
  if (x > manPOINT_X - 2) {
    let h = manPointH(x, z);
    return h;
  }
  // ---- the western headland ----------------------------------------------
  if (x < manBEACH_X0 + 2) {
    return manHeadH(x, z);
  }
  return manProfile(x, z);
}

/** The cross-section of the beach itself, x-independent except for the bank. */
function manProfile(x, z) {
  if (z >= manSHORE_Z) {
    // dry land, and it only ever goes up
    if (z < manDUNE_Z) return (z - manSHORE_Z) * 0.155;
    if (z < manPROM_Z) return 1.55 + (z - manDUNE_Z) * 0.15;
    if (z < 82) return manPROM_Y;
    return manPROM_Y + Math.min((z - 82) * 0.06, 3.4);
  }
  // ---- under the water ----------------------------------------------------
  const bz = manBankZ(x);
  let depth;
  if (z >= bz) {
    // THE RAMP, and it is CONCAVE, not a straight line. A beach profile is
    // steep at the top and flattens out, so the shallow half of it — the part
    // where a broken wave is still a metre high and still shoving — is a wide
    // band rather than a hairline, and the last five metres before the sand
    // are where it dumps. The first cut was linear and it put fifty metres of
    // water under a uniform metre, which reads as a swimming pool.
    const t = clamp((manSHORE_Z - z) / (manSHORE_Z - bz), 0, 1);
    depth = manBANK_D * Math.pow(t, 0.55);
  } else {
    // ...AND THE SEAWARD SIDE IS A SLOPE, NOT A CLIFF. At the first build this
    // dropped 0.66 m per metre — a forty-degree wall — so the swell went from
    // ten metres of water to one in the space of ten metres and never shoaled
    // at all: the wave arrived at the bank exactly the height it was offshore
    // and there was nothing to watch it grow across. One in five for the face
    // of the bar and then away to the shelf, which is what a bar looks like.
    const s = bz - z;
    depth = manBANK_D + s * 0.20;
    if (s > 22) depth += (s - 22) * 0.30;
    if (depth > 11) depth = 11 + (depth - 11) * 0.10;
  }
  // THE GUTTER. It runs from the shore out through the bank and is what makes
  // the rip a rip rather than a decorative arrow.
  const rw = manRipK(x) * manSmooth((20 - z) / 8) * manSmooth((z + 40) / 14);
  depth += rw * 2.7;
  let y = -depth;
  // ...and the bommie, which is why there is anything out the back at all
  const dx = x - manBOMMIE.x, dz = z - manBOMMIE.z;
  const d2 = dx * dx + dz * dz;
  if (d2 < manBOMMIE.r * manBOMMIE.r * 4) {
    const k = Math.exp(-d2 / (manBOMMIE.r * manBOMMIE.r * 0.62));
    y = Math.max(y, lerp(y, manBOMMIE.top, k));
  }
  return y;
}

/** The point: a sandstone platform, the pool cut into it, Shelly behind. */
function manPointH(x, z) {
  // Shelly Beach — a crescent of sand in the lee, and the water in it is calm
  const sdx = x - manSHELLY.x, sdz = z - manSHELLY.z;
  const sd = Math.sqrt(sdx * sdx + sdz * sdz);
  if (sd < manSHELLY.r && x < 97) {
    // THE COVE FACES WEST, which is the whole reason it exists: it is fifty
    // metres round the corner from the surf and there is none in it. Sand
    // along its eastern rim, shelving out to three metres at the mouth, and
    // the rim closes so it reads as a cove rather than as a notch.
    const u = clamp((manSHELLY.x + 8 - x) / 22, 0, 1);
    let h = lerp(1.3, -3.0, u);
    h = lerp(h, 1.25, clamp((sd - manSHELLY.r * 0.74) / (manSHELLY.r * 0.26), 0, 1));
    return h;
  }
  // the ocean pool
  if (x > manPOOL.x0 - 1.4 && x < manPOOL.x1 + 1.4 && z > manPOOL.z0 - 1.4 && z < manPOOL.z1 + 1.4) {
    if (x > manPOOL.x0 && x < manPOOL.x1 && z > manPOOL.z0 && z < manPOOL.z1) return manPOOL.floor;
    return manPOOL.wall;
  }
  // the rock platform, which is nearly flat and always a little wet
  const edge = clamp((x - (manPOINT_X - 2)) / 8, 0, 1);
  let h = lerp(manProfile(manPOINT_X - 2, z), 1.35, edge);
  // and then North Head gets up out of it
  if (x > 92) {
    h = lerp(h, 6 + (x - 92) * 0.42, clamp((x - 92) / 12, 0, 1));
    if (h > 26) h = 26 + (h - 26) * 0.2;
  }
  // a notch of scrub-topped rock behind the pool
  if (z > 26) h = Math.max(h, 2.2 + clamp((z - 26) * 0.12, 0, 3.2));
  return h;
}

/** Queenscliff: the other end of the beach, and it stops the world. */
function manHeadH(x, z) {
  const edge = clamp(((manBEACH_X0 + 2) - x) / 9, 0, 1);
  let h = lerp(manProfile(manBEACH_X0 + 2, z), 1.5, edge);
  if (x < -76) {
    h = lerp(h, 5 + (-76 - x) * 0.46, clamp((-76 - x) / 12, 0, 1));
    if (h > 24) h = 24 + (h - 24) * 0.2;
  }
  if (z > 30) h = Math.max(h, manPROM_Y);
  return h;
}

function manSlope(x, z) {
  const e = 1.6;
  const hx = manTerrain(x + e, z) - manTerrain(x - e, z);
  const hz = manTerrain(x, z + e) - manTerrain(x, z - e);
  return Math.sqrt(hx * hx + hz * hz) / (2 * e);
}

// =================================================================== SWELL ==
/**
 * HOW EXPOSED A PATCH OF WATER IS. 1 out the front, 0 in the pool.
 *
 * The point is the reason Manly has a beach at all and it is also the reason
 * there is somewhere in this chapter to be that is NOT being tumbled: the
 * whole east end is in the lee of it, Shelly faces the wrong way entirely, and
 * the pool is a rectangle of water with a wall round it ten metres from water
 * with none. That contrast is the chapter's quiet half.
 */
function manShelter(x, z) {
  // the pool: flat, always
  if (x > manPOOL.x0 - 0.5 && x < manPOOL.x1 + 0.5 &&
      z > manPOOL.z0 - 0.5 && z < manPOOL.z1 + 0.5) return 0;
  let s = 1;
  // in the lee of the point — it grows as you go east and as you go south
  const k = manSmooth((x - 40) / 26) * manSmooth((20 - z) / 26);
  s *= 1 - 0.95 * k;
  // Shelly is behind the whole thing
  const sdx = x - manSHELLY.x, sdz = z - manSHELLY.z;
  if (sdx * sdx + sdz * sdz < manSHELLY.r * manSHELLY.r * 1.6) s = Math.min(s, 0.06);
  // and a little off the western rocks
  s *= 1 - 0.35 * manSmooth((-52 - x) / 18);
  // the swell does not exist on dry land
  s *= 1 - manSmooth((z - manSHORE_Z + 1) / 5);
  return clamp(s, 0, 1);
}

/**
 * WHICH CREST, AND HOW BIG IS IT. The set, in one function.
 *
 * The crest index is a signed integer that only ever increases as time runs,
 * so `manSET[n mod 9]` is a repeating pattern of wave heights marching up the
 * beach — which is what a set IS. Nothing here is random: the big one is
 * always index 4 of the nine, so the horizon can be made to tell you it is
 * coming, and it cannot be missed by looking away at the wrong moment.
 */
function manCrestAmp(n) {
  const L = manSET.length;
  return manSET[((n % L) + L) % L];
}

/** How much a wave grows as it shoals. Green's law, which is not a guess. */
function manShoal(depth) {
  const d = depth < 0.45 ? 0.45 : depth;
  return Math.pow(manDEEP / d, 0.25);
}

// ---------------------------------------------------------------------------
// THE PHASE TABLE, AND IT IS THE DIFFERENCE BETWEEN A SEA AND A CORRUGATED
// ROOF.
//
// The first build of this ran the swell at ONE speed everywhere: a crest every
// sixty-six metres from the horizon to the sand. It is wrong, and it is wrong
// in exactly the way you can see — across the hundred metres of water the
// player is looking at there was a wave and a half, so the whole surf zone was
// one broad gradient with no line in it anywhere.
//
// A wave in shallow water travels at sqrt(g*d) and NOTHING ELSE. So as it
// comes up the ramp it slows down, and because its period cannot change, it
// gets SHORTER: sixty-six metres out the back, thirty-two over the bank,
// nineteen in the shorebreak. The waves bunch up as they arrive, which is what
// a beach actually looks like from a beach, and it hands the chapter three or
// four separate lines of white to read instead of one.
//
// It is integrated once, at module load, into a table of accumulated phase
// against distance from the bank crest — and because every beach profile in
// this chapter is the SAME profile shifted by manBankZ(x), one 1-D table is
// exact for the whole bay. It also means the crest lines follow the bank, so
// the swell refracts round the bar without a line of code about refraction.
// ---------------------------------------------------------------------------
const manPH_S0 = -74;                // seaward end of the table, relative to the bank
const manPH_N = 130;                 // 1 m steps, so it reaches s = +55: the sand
const manPhaseTab = new Float32Array(manPH_N);
/** The nominal profile in bank-relative coordinates. Used for the table only. */
function manDepthAtS(s) {
  if (s >= 0) {
    const span = manSHORE_Z - manBANK_Z;          // 50 m of ramp, nominally
    return manBANK_D * Math.pow(clamp((span - s) / span, 0, 1), 0.55);
  }
  const q = -s;
  let d = manBANK_D + q * 0.20;
  if (q > 22) d += (q - 22) * 0.30;
  if (d > 11) d = 11 + (d - 11) * 0.10;
  return d;
}
(function manInitPhase() {
  const w = 2 * Math.PI / manPERIOD;
  const k0 = 2 * Math.PI / manWAVELEN;
  let acc = 0;
  manPhaseTab[0] = 0;
  for (let i = 1; i < manPH_N; i++) {
    const d = manDepthAtS(manPH_S0 + i - 0.5);
    let k = w / Math.sqrt(9.81 * (d > 0.08 ? d : 0.08));
    if (k < k0) k = k0;              // never longer than the deep-water wave
    acc += k;                        // 1 m steps, so dphi = k
    manPhaseTab[i] = acc;
  }
})();
function manPhaseAt(s) {
  const t = clamp(s - manPH_S0, 0, manPH_N - 1.001);
  const i = t | 0;
  return lerp(manPhaseTab[i], manPhaseTab[i + 1], t - i);
}
/**
 * The inverse: where is crest number `n` right now, in bank-relative metres?
 * A linear scan of a hundred and thirty floats, called about twice a frame.
 */
function manCrestS(n) {
  const want = (n + manTime / manPERIOD) * Math.PI * 2;
  if (want <= manPhaseTab[0]) return manPH_S0;
  for (let i = 1; i < manPH_N; i++) {
    if (manPhaseTab[i] >= want) {
      const a = manPhaseTab[i - 1], b = manPhaseTab[i];
      return manPH_S0 + (i - 1) + (b > a ? (want - a) / (b - a) : 0);
    }
  }
  return manPH_S0 + manPH_N - 1;
}

/**
 * THE WHOLE SEA, AT ONE POINT, AT ONE TIME. Everything else reads this.
 *
 * `out` is a module-level scratch — this is called several thousand times a
 * frame by the surface mesh and once or twice by the physics, and allocating
 * an object per call would be the single most expensive thing in the chapter.
 */
function manWaveAt(x, z, t, out, bendC, sheltC, ripC) {
  const shelt = sheltC === undefined ? manShelter(x, z) : sheltC;
  const ground = manTerrain(x, z);
  const gd = manWATER - ground;
  out.ground = ground;
  out.depth = gd < 0 ? 0 : gd;
  // THE WAVE DOES NOT STOP AT THE STILL WATERLINE, AND THIS IS THE WHOLE
  // REASON THE CHAPTER IS WORTH BUILDING.
  //
  // The first cut killed the swell wherever the sand was above zero, which is
  // correct arithmetic and quietly threw away the SWASH — the five metres of
  // beach that is dry, then wet, then dry again every eight seconds, and which
  // is the one place a player standing on the sand can watch the sea move.
  // Because capybara.js now asks this function where the water is, a swash
  // that exists is a swash that can pick the animal up off the beach.
  //
  // So the wave is shaped against a REFERENCE depth that never goes to zero,
  // and it is allowed to run up to seventy-five centimetres of dry sand.
  if (shelt <= 0.004 || ground > manWATER + 0.75) {
    out.y = manWATER;
    out.amp = 0; out.face = 0; out.foam = 0; out.push = 0; out.brk = 0; out.f = 0;
    return out;
  }
  const depth = gd > 0.30 ? gd : 0.30;
  // THE CREST LINE IS BENT, and it is bent by the bank itself: the phase is a
  // function of distance from the bar, so a crest is a contour of the
  // bathymetry and the swell refracts round the bar for free. `bendC` is the
  // per-column bank position, precomputed for the surface mesh.
  const bz = bendC === undefined ? manBankZ(x) : bendC;
  const u = manPhaseAt(z - bz) / (Math.PI * 2) - t / manPERIOD;
  const n = Math.round(u);
  const f = u - n;                                   // −0.5 .. 0.5
  out.f = f;
  const nb = f >= 0 ? n + 1 : n - 1;
  const a = lerp(manCrestAmp(n), manCrestAmp(nb), Math.abs(f));
  const A = manA0 * a * manShoal(depth) * shelt;
  out.amp = A;
  // HOW HARD IT IS TRIPPING. Above 1 the crest has nowhere left to go.
  const brk = A / (depth * manBREAK_K);
  out.brk = brk;
  const th = f * Math.PI * 2;
  const c = Math.cos(th);
  // A shoaling wave is a peaked crest and a long flat trough, not a sine. The
  // second harmonic is what makes it look like the sea rather than like a
  // corrugated roof, and it grows with how hard the wave is tripping.
  const peak = clamp(brk * 0.45, 0, 0.42);
  let eta = A * (c + peak * Math.cos(th * 2));
  // once it has broken there is no more height to have: the crest collapses
  // into a bore of about half the depth and runs.
  const cap = depth * 0.62;
  if (eta > cap) eta = cap + (eta - cap) * 0.22;
  out.y = manWATER + eta;
  // THE FACE IS THE SHOREWARD SIDE, and getting this backwards is the sort of
  // mistake that is invisible in code and unmistakable in a screenshot: `f`
  // grows toward the beach, so sin(2*pi*f) is positive on the side of the
  // crest the wave is travelling INTO. That is the face, it is the part that
  // is not showing you the sky, and it is the only part worth being on.
  out.face = Math.sin(th);
  // FOAM, AND IT HAS TO COME IN BANDS.
  //
  // The first cut of this made foam a function of DEPTH — anything under
  // eighty-five centimetres was white — and because the ramp from the bank to
  // the sand is fifty metres of water under a metre and a quarter, the whole
  // inner half of the bay went white and stayed white. Measured from a
  // screenshot: one flat sheet, no wave in it anywhere, nothing to read.
  //
  // A breaking wave is a LINE. So the foam is phase-locked: full at the crest
  // of anything that is tripping, trailing shoreward over about a third of a
  // wavelength and dying quickly behind. That leaves twenty-odd metres of
  // white and forty of green between one wave and the next, which is what a
  // beach looks like and — much more to the point — is a thing the player can
  // aim at.
  let foam = 0;
  if (brk > 1.0) {
    const strength = clamp((brk - 1.0) * 1.6, 0, 1);
    // Twenty-four metres of a sixty-six metre wavelength, straddling the crest
    // and mostly on the shoreward side of it, which is where the water that is
    // actually going somewhere is. That leaves forty metres of green between
    // one wave and the next — enough to see the NEXT one standing up in.
    const trail = f >= 0 ? clamp(1 - f * 4.5, 0, 1) : clamp(1 + f * 7.0, 0, 1);
    foam = strength * trail;
  }
  // and the last few centimetres of every wave is white regardless, because
  // that is what a swash is. Small, and it never reaches the bank.
  if (depth < 0.5) foam = Math.max(foam, clamp((0.5 - depth) / 0.5, 0, 1) * 0.35);
  out.foam = clamp(foam, 0, 1);
  // THE PUSH. Long-wave particle velocity, which for shallow water is
  // eta * sqrt(g / d) and is a real number rather than a tuned one; broken
  // water carries very much more than that, because a bore is the whole
  // column moving rather than a circle turning over.
  let push = eta * Math.sqrt(9.81 / Math.max(depth, 0.55));
  push *= 1 + out.foam * 0.95;
  // AND A BORE IS NOT AN ORBIT. Once a wave has broken it stops being a circle
  // of water turning over on the spot and becomes the whole column moving
  // shoreward at very nearly the speed of the wave itself — which is what a
  // surfer is actually keeping up with, and is the difference between a ride
  // that reads as being CARRIED and one that reads as bobbing. Measured before
  // this line existed: a capybara in the white water made three metres a
  // second, which is a fast walk. sqrt(g * (d + eta)) is the long-wave speed
  // and it is not a tuned number; the 0.75..1.25 either side of it is.
  //
  // AND THE COEFFICIENT MAKES THE RIDE A FIXED POINT, WHICH IS THE WHOLE
  // TRICK. `0.86 + 0.26 * foam` is slightly FASTER than the bore where the
  // white is thickest and slightly slower at its leading edge, so an animal
  // in the band is pushed forward through it until the two speeds match and
  // then stays exactly there — which is trim, it is stable without the player
  // doing anything, and it is why a ride runs the whole fifty metres to the
  // sand instead of the thirteen it managed before this line. Measured: 13.5 m
  // with a flat coefficient, the full ramp with this one.
  const fo = out.foam;
  if (fo > 0.06) {
    const c = Math.sqrt(9.81 * Math.max(depth + (eta > 0 ? eta : 0), 0.3));
    const bore = c * (0.86 + 0.26 * fo);
    push = lerp(push, bore, clamp((fo - 0.06) / 0.30, 0, 1));
  }
  out.push = clamp(push, -2.6, 7.4);
  return out;
}

/** The live surface at a point. THE ONE THING capybara.js ASKS FOR. */
function manSurfY(x, z) {
  if (x > manPOOL.x0 && x < manPOOL.x1 && z > manPOOL.z0 && z < manPOOL.z1) return manPOOL.y;
  manWaveAt(x, z, manTime, manWave);
  return manWave.y;
}
function manIsOverWater(x, z) {
  // The Venice rule, and for the Venice reason: 22 cm of slack is what keeps
  // two centimetres of swash a puddle to walk through rather than a hole to
  // fall into, because capybara.js switches its analytic floor backstop off
  // wherever this is true.
  return manSurfY(x, z) > manTerrain(x, z) + 0.22;
}

/**
 * THE WATER IS ITSELF GOING SOMEWHERE — `flow(x, z)`.
 *
 * The fourth chapter to use the moving-world channel, after a ferry's deck,
 * the Drift's air and the Uji's current. Three things live in here and they
 * are all real:
 *
 *   1. THE WAVE. Shoreward under a crest, seaward in a trough, and four times
 *      as much under white water as under green.
 *   2. THE RIP. A steady 4.2 m/s seaward in the gutter, against a swim cap of
 *      2.6 — so it CANNOT be beaten by swimming at it, only crossed. That is
 *      not a difficulty setting, it is the actual advice, and this chapter is
 *      the only place in the game that can teach it.
 *   3. THE FEEDER. The water the waves push over the bank has to get back out;
 *      along the beach it slides toward the gutter, which is how a player who
 *      has no idea any of this exists ends up in the rip anyway.
 *
 * AND THE UNDERTOW, which is what makes the duck-dive work: the bore is the
 * top metre of the column and nothing else, so an animal that is DOWN gets
 * almost none of the push and a little of the backwash.
 *
 * ---- AND WHOSE DEPTH IT IS, IS AN ARGUMENT (X8) ---------------------------
 * This used to read `manGame.capy.depth` off the global, which made the
 * undertow a property of THE PLAYER rather than of the point being asked
 * about. props.js's physFlowAt calls the same hook for every floating prop in
 * the chapter, so a thong bobbing forty metres up the beach lost its shoreward
 * push the instant the player duck-dived somewhere else entirely — and got it
 * back when they surfaced. The foam had the same problem and solved it by
 * keeping a whole second copy of the field (`manFlowAtStatic`), which is the
 * tell: the depth belonged in the signature, not in the body.
 *
 * `dep` is how deep THE THING BEING PUSHED is. Omit it and you get the surface
 * field, which is the right answer for a prop, for the foam, and for anything
 * that floats.
 */
function manFlowAt(x, z, out, dep) {
  manWaveAt(x, z, manTime, manWave);
  let vz = manWave.push;
  let vx = 0;
  dep = (typeof dep === 'number' && dep === dep) ? dep : 0;
  if (dep > 0.55) {
    // under the surface. The bore is a surface thing.
    const k = clamp(1 - (dep - 0.55) / 1.1, 0, 1);
    vz = vz > 0 ? vz * (0.18 + 0.82 * k) : vz;
    vz -= (1 - k) * 0.9;              // and the water down there is going back out
  }
  // the rip, and the feeder that fills it
  if (z < 18 && z > -44) {
    const rk = manRipK(x);
    const gate = manSmooth((20 - z) / 8) * manSmooth((z + 42) / 14);
    vz -= rk * manRIP_V * gate;
    // the feeder: everything within forty metres slides along the beach to it
    const dxr = x - manRIP_X;
    if (Math.abs(dxr) < 42 && z > -20) {
      const fk = (1 - rk) * manSmooth((22 - z) / 16) * clamp(1 - Math.abs(dxr) / 42, 0, 1);
      vx -= Math.sign(dxr) * fk * 1.5;
    }
  }
  // ---- D4.11: AND A RIDER CAN STEER (the carve) --------------------------
  //
  // `all-the-way` was thirty-four metres of shoreward drift, and the fastest
  // way to earn it was to point at the sand and do nothing. A wave is a thing
  // you go ALONG, and every surf photograph ever taken is of somebody doing
  // that; the chapter had a whole flow field and the only input to it was
  // whether you were in the water.
  //
  // `manCarve` is the rider's lateral demand, written once a frame by
  // manUpdateSurfTasks from the stick and damped there, so this stays a pure
  // field function with no game reference in it. It is applied HERE rather
  // than as a shove on the body for one reason: everything else that reads
  // this field — the foam, the boards, the bathers' drift — then agrees about
  // what the water is doing, and a carve that only the capybara can feel is a
  // carve that leaves no wake.
  //
  // THE ANGLE BONUS IS THE WHOLE MECHANIC. Angling across the face trades
  // shoreward speed for speed ALONG the crest, and the sum is bigger: a wave
  // pushes hardest on the part of you that is square to it, so a rider at
  // forty degrees covers more water than one pointed at the beach. That is
  // real and it is why the record is measured along the path now.
  if (manCarve !== 0 && manRideDist > manCARVE_MIN && dep <= 0.55) {
    const face = clamp(manWave.foam * 3.2, 0, 1);      // only where there IS a face
    vx += manCarve * manCARVE_V * face;
    vz += Math.abs(manCarve) * manCARVE_GAIN * face * (vz > 0 ? 1 : 0);
  }
  out.x = vx;
  out.z = vz;
  return out;
}

// ==================================================================== ZONES ==
function manInZone(name, x, z) {
  switch (name) {
    case 'flags':
      return Math.abs(x - manFlagX) < 13 && Math.abs(z - manFlagZ) < 8;
    case 'beach':   return z > manSHORE_Z - 2 && z < manDUNE_Z + 2 && x > manBEACH_X0 && x < manBEACH_X1;
    case 'prom':    return z > manDUNE_Z && z < manSHOP_Z && x > manBEACH_X0 - 8 && x < manBEACH_X1 + 8;
    case 'surf':    return z < manSHORE_Z && z > -46 && x > manBEACH_X0 - 12 && x < manPOINT_X;
    case 'back':    return z < manBankZ(x) - 5 && z > -84;
    case 'rip':     return Math.abs(x - manRIP_X) < 9 && z < 16 && z > -40;
    case 'pool':    return x > manPOOL.x0 && x < manPOOL.x1 && z > manPOOL.z0 && z < manPOOL.z1;
    case 'shelly': {
      const dx = x - manSHELLY.x, dz = z - manSHELLY.z;
      return dx * dx + dz * dz < manSHELLY.r * manSHELLY.r;
    }
    case 'bommie': {
      const dx = x - manBOMMIE.x, dz = z - manBOMMIE.z;
      return dx * dx + dz * dz < 64;
    }
    default: return false;
  }
}
function manNavBlocked(x, z, r) {
  // the NPCs here are bathers and they belong on the sand
  if (z < manSHORE_Z - 1) return true;
  if (z > manSHOP_Z - 2) return true;
  if (x < manBEACH_X0 + 3 || x > manBEACH_X1 - 3) return true;
  return false;
}
/** < 0.9 soft, ~1.0 stone, > 1.15 hollow timber. */
// The material beside the pitch (L4, audio #4): the last answer, read through
// surfaceMat() straight after surfacePitch(). Half this chapter is sand and
// it had the same lowpass as a lawn.
let manSurfMat = 'sand';
function manSurf(p, m) { manSurfMat = m; return p; }
function manSurfacePitch(x, z, y) {
  if (z > manSHOP_Z - 1) return manSurf(1.02, 'stone');          // the Corso is paving
  if (z > manDUNE_Z + 1) return manSurf(1.0, 'stone');           // the promenade
  // ---- ...AND EVERYTHING EAST OF THE POINT WAS ONE SOUND ------------------
  // `x > manPOINT_X` is 47% of the walkable map — 3,240 cells of 6,854 — and it
  // returned bare stone for all of it. Two of the chapter's best-drawn places
  // are in there: SHELLY, which has its own local, its own souvenir and its own
  // name on the card, and the OCEAN POOL, whose floor is tiled concrete under
  // half a metre of water and whose deck is worn sandstone with forty years of
  // feet on it. The headland is genuinely rock; those two are not, and they are
  // exactly the two places a player goes east to reach.
  if (manPoolDeck(x, z)) return manSurf(1.14, 'stone');          // hollow-sounding sandstone deck
  if (manInPool(x, z)) return manSurf(0.88, 'stone');            // tiled floor, under water
  {
    const sdx = x - manSHELLY.x, sdz = z - manSHELLY.z;
    // the cove itself is shell grit and coarse sand, not the platform round it
    if (sdx * sdx + sdz * sdz < manSHELLY.r * manSHELLY.r * 0.55) return manSurf(0.80, 'sand');
  }
  if (x > manPOINT_X || x < manBEACH_X0) return manSurf(1.04, 'stone'); // rock
  if (manBoatCarrying) return manSurf(1.22, 'timber');           // and the boat is timber
  return manSurf(0.72, 'sand');                                  // sand, which eats a footfall
}

/** Inside the ocean pool's water box. */
function manInPool(x, z) {
  return x > manPOOL.x0 && x < manPOOL.x1 && z > manPOOL.z0 && z < manPOOL.z1;
}
/** The walkable coping round it, 2.5 m of it, which is where people actually stand. */
function manPoolDeck(x, z) {
  return !manInPool(x, z) &&
         x > manPOOL.x0 - 3.2 && x < manPOOL.x1 + 3.2 &&
         z > manPOOL.z0 - 3.2 && z < manPOOL.z1 + 3.2;
}

// ================================================================== BUILDING ==
function manBuild(game) {
  if (manBuilt) return;
  manBuilt = true;
  manInitGeos();

  manRoot = new THREE.Group();
  manRoot.name = 'manly';
  game.scene.add(manRoot);

  manBuildGround(game, manRoot);
  manBuildCollision(game);
  manBuildTown(game, manRoot);
  manBuildPoint(game, manRoot);
  manBuildBeachThings(game, manRoot);
  manBuildFlags(manRoot);
  manBuildBoat(game, manRoot);
  manBuildBathers(manRoot);
  manBuildGulls(manRoot);
  manBuildBuoys(manRoot);
  manBuildDolphins(manRoot);
  manBuildPelican(manRoot);
  manBuildGroper(manRoot);
  manBuildFoam(manRoot);
  manBuildBarrel(manRoot);
  manBuildSpray(manRoot);
  manBuildHaze(manRoot);
  manBuildWater(manRoot);        // last: transparent, and it must sort over

  // ---- THE PEOPLE WHO LIVE HERE ------------------------------------------
  // See npc.js, THE LOCALS. Each of these is a point somebody is standing at,
  // a few things they might say when the capybara turns up, and a different
  // few for when it wheeks at them. Where the chapter owns a Group for the
  // figure, it is handed over too and the figure turns to watch.
  if (typeof game.addLocal === 'function') {
    // ---- AND THEY ARE KEPT, BECAUSE THEY HAVE TO BE ABLE TO NOTICE -------
    // npc.js reads a local's `lines` array LIVE, which is the whole mechanism
    // by which somebody can know what you have done — and this chapter threw
    // every reference away at the point of registration, so all eight of them
    // said the same three sentences whether the capybara had just walked past
    // or had moved the council's flags twenty-nine metres, flattened a child's
    // castle, gone out through the break in the surfboat and taken the wave of
    // the set the length of the beach. Cappadocia has had gorSaysNow since it
    // shipped. This is the same argument, one chapter along.
    //
    // The other half is `praise`/`onTask`, which nine chapters already use and
    // this one did not: without it the nearest person to any completed task
    // falls back on npc.js's chapter-neutral pool, so the reward for the
    // largest consequence any button press has in this game was a stranger
    // saying '…was that deliberate?'
    manLocals.guard = game.addLocal({ biome: 'manly', x: manFLAG_HOME.x, y: manTerrain(manFLAG_HOME.x, manFLAG_HOME.z),
      z: manFLAG_HOME.z, near: 8,
      // THE AUTHORITY (L3, F1): the lifeguard is the one who carries you off
      // the beach. See npc.js.
      authority: true, role: 'the lifeguard',
      figure: { shirt: PALETTE.hiVis, legs: PALETTE.cloth1, hat: PALETTE.hiVis },
      // ---- AND HALF OF IT IS CONDITIONAL NOW (see localResolve in npc.js).
      // `onTask` below is what somebody says the MOMENT you finish something
      // in front of them; this is what they say for the rest of the chapter.
      // Manly used the conditional-line system in nought places, so the
      // lifeguard warned an animal that had already been out the back in the
      // gutter and back in on the wave of the set not to fight the rip.
      lines: [
              // ---- THEY HAVE HEARD ABOUT YOU (L3, E3): one line keyed on a wow elsewhere
              { t: 'A balloon over Turkey. I am told it did not fall out. The water here does not care what you have done.', after: 'sunrise' },
              // ...and what it is wearing (L3-11)
              { t: 'That is a lifeguard cap. I am the lifeguard.', when: function () { return game.capy && game.capy.worn === 'surfcap'; } },
              'Swim between the flags, mate. That is the whole system.',
              { t: 'See that gutter? That is where you would go. Straight out.', before: 'the-rip' },
              { t: 'Do not fight it. Nobody wins that one. Swim across it.', before: 'the-rip' },
              { t: 'You have been out in it now. Told you it was quicker than walking.', after: 'the-rip' },
              { t: 'They are your flags now, as far as I am concerned.', after: 'move-flags' },
              { t: 'From the bank all the way to the sand. I have got it in the log.', after: 'all-the-way' }],
      wheek: ['Yeah, righto. Between the flags.',
              'Oi. You right?'],
      praise: ['Yeah, nah, that was all right.',
               'I am putting that in the log. I do not know what to write.',
               'Not against the rules. Not covered by the rules either.'],
      onTask: { 'move-flags': ['You MOVED them. Sixty years and nobody has moved them.'],
                'the-rip': ['That is the gutter. That is exactly what I told you.'],
                'duck-dive': ['Under it. Good. Everybody else gets rolled first.'],
                'all-the-way': ['All the way to the sand. From the bank. Yes, all right.'],
                'take-off': ['He caught one. He actually caught one.'],
                'sandcastle': ['I saw nothing. I was looking at the water.'] } });
    manLocals.club = game.addLocal({ biome: 'manly', x: 24, y: manTerrain(24, 47), z: 47, near: 7,
      // D2: along the promenade rather than down the beach, so the route holds
      // one contour instead of walking into the surf.
      walk: { dx: -9, dz: 0, dwell: 5 },
      figure: { shirt: PALETTE.cloth2 },
      lines: [{ t: 'Boat goes out at four if the bank holds.', before: 'the-surfboat' },
              'Nippers finish at eleven. It gets loud.',
              'You are dripping on the honour board.',
              { t: 'The crew are still arguing about who let you in the boat.', after: 'the-surfboat' },
              { t: 'Longest ride off that bank all week and it was not a member.', after: 'all-the-way' }],
      wheek: ['Half the beach just looked up.'],
      praise: ['That is going on the board. Somewhere on the board.',
               'We have a form for this. We do not have a form for this.',
               'Membership is thirty dollars and you are not eligible.'],
      onTask: { 'the-surfboat': ['You went out in the BOAT. In the boat!'],
                'all-the-way': ['Longest one anybody has had off that bank all week.'],
                'pine-cone': ['Council planted those in 1953 and you have just pruned one.'] } });

    // ---- AND SIX MORE, because two people on a beach with a Corso behind it
    // is the emptiest cast in the game. Venice has eight, Rio has eight, Mong
    // Kok has nine; this had the lifeguard and the club secretary and a
    // hundred and twenty metres of nobody between them.
    manLocals.chips = game.addLocal({ biome: 'manly', x: -13.5, y: manPROM_Y, z: manSHOP_Z - 0.5, near: 7.5,
      face: Math.PI,
      figure: { shirt: PALETTE.manClub, hat: PALETTE.manFlagRed, legs: PALETTE.cloth1 },
      // the basket, out and in
      beat: { kind: 'work', every: 6.0, dur: 0.8, sfx: 'rustle', volume: 0.10, pitch: 1.35 },
      lines: ['Flake and chips, minimum chips, and no I will not do half a scoop.',
              'The seagulls have worked out the awning. Do not sit under it.',
              'Everything is fried. That is the menu. That is the whole menu.',
              { t: 'My whole queue moved up the beach after you. Every one of them.', after: 'move-flags' },
              { t: 'The gulls had that castle before the kid got back. I did warn him.', after: 'sandcastle' }],
      wheek: ['Mate. There are people eating.',
              'You are not getting a chip. You are getting three chips.'],
      praise: ['Not in here. Whatever it was, not in here.',
               'Three chips. That is the whole conversation.',
               'I have seen worse on a Saturday.'],
      onTask: { 'pine-cone': ['That is going to be somebody’s windscreen one day.'],
                'move-flags': ['Everybody has moved. My whole queue has moved.'],
                'sandcastle': ['The gulls are going to have that. Watch.'] } });

    manLocals.pool = game.addLocal({ biome: 'manly', x: manPOOL.x0 + 2.5,
      y: manTerrain(manPOOL.x0 + 2.5, manPOOL.z1 + 2.6), z: manPOOL.z1 + 2.6, near: 7,
      // THE ERRAND (L3-8): a towel along the shoreward wall to the deep end (the strip z1 + 1.4..26 carries no rocks)
      errand: { to: [10.0, 0], carry: 'towel', every: 48 },
      figure: { shirt: PALETTE.manTowelD, skin: PALETTE.skin2, hat: PALETTE.manBoardC },
      lines: ['Sixty-one years I have swum this pool. Every day but one.',
              'The wall keeps the swell out. Mostly. Not always.',
              { t: 'Cold? It is not cold. You are just soft.', before: 'bower-pool' },
              { t: 'You did the length. You are not soft. I said what I said.', after: 'bower-pool' },
              { t: 'Bluey came to you. Sixty-one years and he has never come to me.', after: 'blue-groper' }],
      wheek: ['You will scare the pelican. He is very highly strung.'],
      praise: ['Sixty-one years and that is new.',
               'Hm. In my pool.',
               'You are not soft after all. I withdraw it.'],
      onTask: { 'bower-pool': ['End to end. Sixty-one years I have done that. Every day but one.'],
                'blue-groper': ['He came to YOU? He does not come to me.'] } });

    manLocals.fish = game.addLocal({ biome: 'manly', x: manPOINT_X + 4.6, y: manTerrain(manPOINT_X + 4.6, -12),
      z: -12, near: 7, face: 1.6,
      figure: { shirt: PALETTE.manScrub, hat: PALETTE.manSand },
      // and he is not going anywhere
      beat: { kind: 'rock', every: 6.8, dur: 2.5 },
      lines: ['Been here since five. Two bites. Both of them crabs.',
              'Do not stand there. That is the ledge that gets you.',
              { t: 'Groper comes past about now. Do not tell anyone.', before: 'blue-groper' },
              { t: 'You have met him. Right. Now you are in on it as well.', after: 'blue-groper' },
              { t: 'Nothing has come past this ledge since you sat on that bommie.', after: 'the-bommie' }],
      wheek: ['Right, well, that is the afternoon gone.'],
      praise: ['There goes the afternoon.',
               'Everything on this ledge just left. Everything.',
               'I am not going to say anything and neither are you.'],
      onTask: { 'blue-groper': ['Do not tell anyone. I mean it. Do not tell anyone.'],
                'the-bommie': ['On the bommie? While it was breaking? On the BOMMIE?'] } });

    manLocals.shelly = game.addLocal({ biome: 'manly', x: manSHELLY.x + 3.5, y: manTerrain(manSHELLY.x + 3.5, manSHELLY.z + 4),
      z: manSHELLY.z + 4, near: 7,
      // THE ERRAND (L3-8): an ice cream round the west side of the kiosk to the first picnic table (kx - 8, kz + 1.2)
      errand: { to: [-3.9, 4.6], carry: 'icecream', every: 40 },
      figure: { shirt: PALETTE.manAwning2, skin: PALETTE.skin3 },
      lines: ['Round the corner and the whole ocean gives up. Look at it.',
              'Kiosk has been there since nineteen thirty-two. So has the queue.',
              'People walk past the pool to get here. They are correct.',
              { t: 'You came round the corner the hard way. Through the water.', after: 'the-rip' },
              { t: 'Somebody filmed you on that rock. Somebody always films it.', after: 'the-bommie' }],
      wheek: ['Nothing wakes up over here. That is the point of over here.'],
      praise: ['Even round here. Even round here!',
               'Well. There goes the quiet side.',
               'Somebody has filmed that. Somebody always films it.'],
      onTask: { 'blue-groper': ['That is Bluey. Everybody knows Bluey. Now you know Bluey.'],
                'the-bommie': ['That rock has been standing that swell up since before the kiosk.'] } });

    manLocals.volley = game.addLocal({ biome: 'manly', x: 41, y: manTerrain(41, manSHORE_Z + 16), z: manSHORE_Z + 16,
      near: 7,
      figure: { shirt: PALETTE.manFlagYel, hat: PALETTE.manFlagYel, legs: PALETTE.manBoardC },
      lines: ['We are two down. You do not happen to play.',
              'Serve into the wind, it comes back. Every time.',
              { t: 'That ball has been in the rip twice this week.', before: 'the-rip' },
              { t: 'You went out in the gutter on purpose. The ball does it by accident.', after: 'the-rip' },
              { t: 'We are inside the flags now. We have never been inside the flags.', after: 'move-flags' }],
      wheek: ['Take it as a yes, shall we.'],
      praise: ['Right. Yes. Still two down, though.',
               'Was that a serve? I am counting that as a serve.',
               'You are on my team. You do not get a say.'],
      onTask: { 'sandcastle': ['Straight through it. That is a spike. That is technically a spike.'],
                'move-flags': ['You have moved the flags. You cannot just move the flags.'] } });

    // ---- THE OTHER HALF OF THE VOLLEYBALL GAME ------------------------
    //
    // NO PAIR-CHAT CAN EVER FIRE IN MANLY. Eight locals, and the closest two
    // are the surf club at (24, 47) and the volleyball player at (41, 40) —
    // 18.4 m apart against npcLOC_CHAT_R = 13.0. Every other pair is 24.8 to
    // 48.0 m. That is not a bug in the placement: a beach IS spread out, and
    // moving the club local off the clubhouse to satisfy a radius would be
    // fixing the number rather than the chapter.
    //
    // What the chapter already had was a volleyball court with three figures
    // standing on it and a man beside it saying "We are two down. You do not
    // happen to play." — a person whose lines are ABOUT the game he is in the
    // middle of, and no one to be in it with. The figure across the net was
    // already drawn; it is a local now instead, 8.0 m away, and the two of
    // them argue about the score. Nothing is added to the world.
    manLocals.partner = game.addLocal({ biome: 'manly', x: 37.6,
      y: manTerrain(37.6, manSHORE_Z + 8.8), z: manSHORE_Z + 8.8, near: 7,
      figure: { shirt: PALETTE.manBoardC, hat: PALETTE.manSand, legs: PALETTE.manFlagYel },
      lines: ['I am not two down. HE is two down. I am playing fine.',
              'Wind is straight down the court. Whoever serves into it loses.',
              'If you get under it, just put it up. Somebody will be there.',
              { t: 'Ball went out in the gutter. We are not going in after it.', before: 'the-rip' },
              { t: 'You went out THERE. On purpose. For fun.', after: 'the-rip' }],
      wheek: ['Right. Yes. You are in.'],
      praise: ['See, that is what I have been asking for all afternoon.',
               'And nobody was even looking. Typical.',
               'Do that again and I will put you on the other side.'],
      onTask: {
        'sandcastle': ['Straight through it. He did that last week and blamed the wind.'],
        'all-the-way': ['We stopped. The whole court stopped. Do you understand that?'] } });

    manLocals.ferry = game.addLocal({ biome: 'manly', x: -58, y: manPROM_Y, z: manSHOP_Z - 5.6, near: 7.5,
      figure: { shirt: PALETTE.manShopB, hat: PALETTE.manSand, skin: PALETTE.skin2 },
      lines: ['Ferry every half hour. Rough one today. Sit at the back.',
              'Forty minutes from the middle of the city to that.',
              'Manly. Seven miles from Sydney, a thousand miles from care.',
              { t: 'Half the boat was at the rail watching you come in on that.', after: 'all-the-way' },
              { t: 'In the surfboat. I told them on the four o’clock. Nobody believed me.', after: 'the-surfboat' }],
      wheek: ['They will hear that at the Quay.'],
      praise: ['Forty minutes from the city and this is what happens.',
               'I will mention it on the boat. Nobody will believe me.',
               'Seven miles from Sydney, a thousand miles from care.'],
      onTask: { 'to-manly': ['Over the hill and there it is. Gets everybody, that.'],
                'all-the-way': ['The whole ferry saw that. The WHOLE ferry.'],
                'the-surfboat': ['In the boat. With the crew. Forty minutes from Wynyard.'] } });
  }

  // THE MUSICIAN (L7, F2): between two Norfolk pines, off the trunk line so
  // no collision box sits under him — a busker on the Corso is the most
  // ordinary thing this beach has.
  manLocals.musician = game.addLocal({ biome: 'manly', x: -33.6, y: manPROM_Y,
    z: manPINE_Z + 2.6, near: 8, face: 1.2,
    beat: { kind: 'work', every: 4.2, dur: 0.9, sfx: 'chime', volume: 0.10 } });

  // ---- THE TRAVELLER, A CAMEO (L8) ---------------------------------------
  // Past the flags rather than between them — manFLAG_HOME, not the live
  // manFlagX/manFlagZ, because the flags move (move-flags) and the point
  // that matters here is the beach itself, not wherever the poles have
  // ended up. Ten metres out from manFLAG_HOME.x, which clears the poles
  // (they stand 5.5 m either side of centre) by about four and a half
  // metres, so this never overlaps move-flags' own hit-test. manTerrain is
  // asked rather than assumed. Hidden until this chapter's own first real
  // tick (gateChap).
  if (typeof game.addTraveller === 'function') {
    let tvx = manFLAG_HOME.x + 10, tvz = manFLAG_HOME.z;
    if (manNavBlocked(tvx, tvz, 0.6)) { tvx += 2; tvz += 2; }
    game.addTraveller({ biome: 'manly', x: tvx, y: manTerrain(tvx, tvz), z: tvz, face: 1.5,
      gateChap: 14,
      lines: ['Between the flags is apparently where you are supposed to swim. Nobody told me that in Sydney.',
              'I have been on more beaches this trip than in the rest of my life put together.'],
      wheek: ['That is the surf. It never really stops.'] });
  }

  // ---- THE AUTHORITY, AND WHERE TO HIDE FROM THEM (L3, F1) ---------------
  // See THE HIDE in systems.js. Still inside one of these and the lifeguard
  // walks to where you were and gives up. Every spot is beside a thing the
  // front already draws: the bus shelter, the fourth Norfolk pine, the last
  // cafe umbrella, the kiosk awning at Shelly, the picnic tables behind it.
  // The water is a hide on its own and needs nothing here.
  if (typeof game.addHide === 'function') {
    game.addHide({ biome: 'manly', x: 8, z: manSHOP_Z - 8.4, r: 2.0, kind: 'the bus shelter' });
    game.addHide({ biome: 'manly', x: -50.4 + 3 * 11.2 + 1.4, z: manPINE_Z, r: 2.2, kind: 'under the pines' });
    game.addHide({ biome: 'manly', x: 40 + 3 * 5.4, z: manSHOP_Z - 2.1, r: 1.8, kind: 'under the umbrella' });
    game.addHide({ biome: 'manly', x: manSHELLY.x + 7.5 - 1.2, z: manSHELLY.z + 9.0 - 4.3, r: 1.8, kind: 'under the kiosk awning' });
    game.addHide({ biome: 'manly', x: manSHELLY.x + 7.5 - 4.6, z: manSHELLY.z + 9.0 + 4.9, r: 2.0, kind: 'the picnic tables' });
  }

  if (typeof game.addExchange === 'function' && manLocals.volley && manLocals.partner) {
    game.addExchange({ biome: 'manly', a: manLocals.volley, b: manLocals.partner, gap: 26, lines: [
      ['That was out.', 'That was not out. That was ON the line.'],
      ['Six-four.', 'Five-four. And it is my serve.'],
      ['Are we playing to eleven?', 'We are playing until somebody goes home.'],
      ['There is a capybara on the court.', 'There is a capybara on the court, yes.'],
      ['Wind has swung.', 'The wind has not swung. You are just serving badly.'],
      ['Somebody has taken the ball again.', 'Somebody takes the ball every set.'],
    ] });
  }

  if (typeof game.registerShadowTarget === 'function') game.registerShadowTarget(manRoot);
}

function manBuildGround(game, root) {
  // 2.5 m cells. The sand is the surface the player spends the chapter looking
  // at from six metres up, and the seabed is the surface the wave model is
  // written against — a coarse ground here would put the bank in a different
  // place from the break.
  const X0 = -132, X1 = 140, Z0 = -112, Z1 = 100, EL = 2.5;
  const nx = Math.round((X1 - X0) / EL), nz = Math.round((Z1 - Z0) / EL);
  const g = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0, nx, nz);
  g.rotateX(-Math.PI / 2);
  g.translate((X0 + X1) * 0.5, 0, (Z0 + Z1) * 0.5);
  const p = g.attributes.position.array;
  const col = new Float32Array(p.length);
  const dry = new THREE.Color(PALETTE.manSand);
  const wet = new THREE.Color(PALETTE.manSandWet);
  const bank = new THREE.Color(PALETTE.manSandDeep);
  const rock = new THREE.Color(PALETTE.manRock);
  const rockDk = new THREE.Color(PALETTE.manRockDk);
  const cliff = new THREE.Color(PALETTE.manCliff);
  const scrub = new THREE.Color(PALETTE.manScrub);
  const prom = new THREE.Color(PALETTE.manPromenade);
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i], z = p[i + 2];
    const h = manTerrain(x, z);
    p[i + 1] = h;
    const onPoint = x > manPOINT_X - 2, onHead = x < manBEACH_X0 + 2;
    if (onPoint || onHead) {
      manCol.copy(h > 8 ? cliff : rock);
      if (h < 0.6) manCol.lerp(rockDk, clamp((0.6 - h) / 2.4, 0, 1));
      if (h > 14) manCol.lerp(scrub, clamp((h - 14) / 12, 0, 0.55));
      // Shelly is sand, not rock
      const sdx = x - manSHELLY.x, sdz = z - manSHELLY.z;
      if (sdx * sdx + sdz * sdz < manSHELLY.r * manSHELLY.r) {
        manCol.copy(h > 0.1 ? dry : wet);
      }
    } else if (z > manPROM_Z - 1) {
      manCol.copy(prom);
    } else if (h > 0.34) {
      manCol.copy(dry);
    } else if (h > -0.9) {
      manCol.copy(wet).lerp(dry, clamp(h / 0.34, 0, 1));
    } else {
      manCol.copy(bank).lerp(wet, clamp((h + 3.2) / 2.3, 0, 1));
      manCol.lerp(rockDk, clamp((-h - 4.5) / 5.5, 0, 0.6));
    }
    col[i] = manCol.r; col[i + 1] = manCol.g; col[i + 2] = manCol.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, manVCG());
  m.receiveShadow = true;
  m.frustumCulled = false;
  root.add(m);
}

function manBuildCollision(game) {
  // MIND WHICH WAY THE SECOND AXIS RUNS: a CANNON heightfield is authored in
  // its own xy plane and the Rx(−90) that stands it up maps local +y onto
  // world MINUS z, so j walks BACK from the far edge. Getting this wrong
  // leaves the biome with no collision floor at all and the capybara rides its
  // own analytic backstop, which hides it completely until something else
  // dynamic falls through the world. 4 m, which is what this relief needs.
  const X0 = -132, EL = 4;
  const NX = 68, NZ = 53;
  const Z0 = -112, Z1 = Z0 + NZ * EL;
  const data = [];
  for (let i = 0; i <= NX; i++) {
    const row = [];
    for (let j = 0; j <= NZ; j++) row.push(manTerrain(X0 + i * EL, Z1 - j * EL));
    data.push(row);
  }
  const hf = new CANNON.Heightfield(data, { elementSize: EL });
  const b = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
  b.addShape(hf);
  b.position.set(X0, 0, Z1);
  b.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  manSyncBody(b);
  game.world.addBody(b);
}

// --------------------------------------------------------------- the Corso --
/**
 * A PERSON, MERGED, IN ONE OF FIVE POSES.
 *
 * The Cappadocia argument, applied to a seafront: a LOCAL is somebody you talk
 * to and there are only ever seven or eight of those; a CROWD is geometry. The
 * Corso had a queue rail with no queue in it, four café tables with nobody at
 * them, six benches nobody was sitting on, a bus shelter nobody was waiting in
 * and a volleyball net with a ball on the sand next to a man saying "we are
 * two down" — every piece of equipment on the front was drawn and not one of
 * them was being used. Twenty-nine merged figures cost about 3 200 triangles
 * and no draw call at all, because they go into the town's own merger.
 *
 * Eleven boxes: two legs, a torso, a collar, two arms, a head, hair, a nose,
 * and a hat if it has one. Same parts list as npc.js's articulated locals, so
 * a person standing in the queue reads as the same species as the man behind
 * the counter — which is the whole point of doing it at all.
 */
const manCROWD_SHIRT = [0xe86a52, 0x4fa8c4, 0xf2c84a, 0xf0f0e6, 0x3f8fa0,
                        0xd4574c, 0xc8d2c2, 0xd8b9a8];
const manCROWD_LEG = [0x4a5560, 0x8a7a62, 0x2f4658, 0xb0a68e, 0x6a4e3a];
const manCROWD_SKIN = [0xc99a6e, 0x8a6a48, 0xe0b48a, 0x6d4a30, 0xa87a52];
const manCROWD_HAIR = [0x2f2620, 0x4a3a2c, 0x6b5a3a, 0x1f1a16, 0x8a7550];
/**
 * @param pose 0 stand · 1 sit · 2 lean (one arm out, at a counter)
 *             3 reach (both arms up) · 4 stride
 */
function manPutFigure(M, x, y, z, ry, pose, i) {
  const shirt = manCROWD_SHIRT[i % manCROWD_SHIRT.length];
  const legs = manCROWD_LEG[(i * 3) % manCROWD_LEG.length];
  const skin = manCROWD_SKIN[(i * 5) % manCROWD_SKIN.length];
  const hair = manCROWD_HAIR[(i * 7) % manCROWD_HAIR.length];
  const c = Math.cos(ry), s = Math.sin(ry);
  // local (lx, lz) -> world, so a pose is written facing +z and then turned
  const px = function (lx, lz) { return x + lx * c + lz * s; };
  const pz = function (lx, lz) { return z - lx * s + lz * c; };
  const seat = pose === 1;
  const hipY = seat ? 0.46 : 0.56;
  if (seat) {
    // thighs forward, shins down: a person on a bench is an L and nothing else
    for (let sd = -1; sd <= 1; sd += 2) {
      M.box(px(sd * 0.11, 0.20), y + hipY, pz(sd * 0.11, 0.20), 0.17, 0.17, 0.52, legs, 0, ry, 0);
      M.box(px(sd * 0.11, 0.42), y + hipY - 0.26, pz(sd * 0.11, 0.42), 0.16, 0.46, 0.17, legs, 0, ry, 0);
      M.box(px(sd * 0.11, 0.50), y + hipY - 0.47, pz(sd * 0.11, 0.50), 0.16, 0.08, 0.28, 0x3a3128, 0, ry, 0);
    }
  } else if (pose === 4) {
    // mid-stride, which is the only thing that says a standing crowd is not
    // a row of bollards
    M.box(px(-0.11, 0.16), y + 0.42, pz(-0.11, 0.16), 0.17, 0.84, 0.20, legs, 0.30, ry, 0);
    M.box(px(0.11, -0.16), y + 0.42, pz(0.11, -0.16), 0.17, 0.84, 0.20, legs, -0.26, ry, 0);
    M.box(px(-0.11, 0.34), y + 0.04, pz(-0.11, 0.34), 0.17, 0.08, 0.30, 0x3a3128, 0, ry, 0);
  } else {
    for (let sd = -1; sd <= 1; sd += 2) {
      M.box(px(sd * 0.11, 0), y + 0.40, pz(sd * 0.11, 0), 0.17, 0.80, 0.20, legs, 0, ry, 0);
      M.box(px(sd * 0.11, 0.06), y + 0.04, pz(sd * 0.11, 0.06), 0.17, 0.08, 0.30, 0x3a3128, 0, ry, 0);
    }
  }
  const tY = y + hipY + (seat ? 0.34 : 0.52);
  M.box(px(0, 0), tY, pz(0, 0), 0.50, 0.62, 0.28, shirt, seat ? -0.10 : 0, ry, 0);
  M.box(px(0, 0), tY + 0.34, pz(0, 0), 0.52, 0.07, 0.30, hair, 0, ry, 0);
  // arms
  const aY = tY + 0.22;
  if (pose === 2) {
    M.box(px(-0.30, 0.10), aY - 0.20, pz(-0.30, 0.10), 0.13, 0.56, 0.15, shirt, 0.30, ry, 0.10);
    M.box(px(0.30, 0.22), aY - 0.06, pz(0.30, 0.22), 0.13, 0.52, 0.15, shirt, 0.95, ry, -0.14);
    M.box(px(0.30, 0.44), aY - 0.24, pz(0.30, 0.44), 0.12, 0.13, 0.13, skin, 0, ry, 0);
  } else if (pose === 3) {
    for (let sd = -1; sd <= 1; sd += 2) {
      M.box(px(sd * 0.28, 0), aY + 0.30, pz(sd * 0.28, 0), 0.13, 0.56, 0.14, shirt, 0, ry, sd * 0.34);
      M.box(px(sd * 0.40, 0), aY + 0.58, pz(sd * 0.40, 0), 0.12, 0.13, 0.13, skin, 0, ry, 0);
    }
  } else {
    for (let sd = -1; sd <= 1; sd += 2) {
      M.box(px(sd * 0.30, seat ? 0.06 : 0), aY - 0.22, pz(sd * 0.30, seat ? 0.06 : 0),
            0.13, 0.56, 0.14, shirt, seat ? 0.22 : (pose === 4 ? sd * 0.34 : 0), ry, sd * 0.06);
      M.box(px(sd * 0.30, seat ? 0.20 : 0.02), aY - 0.50, pz(sd * 0.30, seat ? 0.20 : 0.02),
            0.12, 0.13, 0.13, skin, 0, ry, 0);
    }
  }
  // head, hair, and the nose that gives it a front
  const hY = tY + 0.54;
  M.box(px(0, 0), hY, pz(0, 0), 0.26, 0.30, 0.25, skin, 0, ry, 0);
  M.box(px(0, -0.01), hY + 0.15, pz(0, -0.01), 0.28, 0.11, 0.27, hair, 0, ry, 0);
  M.box(px(0, 0.14), hY, pz(0, 0.14), 0.05, 0.05, 0.05, skin, 0, ry, 0);
  if (i % 3 === 0) {
    M.cyl(px(0, 0), hY + 0.22, pz(0, 0), 0.28, 0.05,
          i % 2 ? PALETTE.manSand : PALETTE.manFlagYel, 0, ry, 0, 8);
    M.cyl(px(0, 0), hY + 0.26, pz(0, 0), 0.15, 0.13,
          i % 2 ? PALETTE.manSand : PALETTE.manFlagYel, 0, ry, 0, 8);
  }
}

function manBuildTown(game, root) {
  const M = manMerger();

  // the promenade wall along the top of the beach
  M.box(0, manPROM_Y - 0.25, manPROM_Z - 0.4, 128, 1.1, 0.8, PALETTE.manKerb);
  manStaticBox(game, 0, manPROM_Y - 0.25, manPROM_Z - 0.4, 128, 1.1, 0.8);

  // ---- the surf club: cream deco, one red stripe, and a flat roof you can
  // see the whole beach from. It is the only building on the sand side.
  const cx = 24, cz = 47;
  M.box(cx, manPROM_Y + 2.4, cz, 20, 4.8, 11, PALETTE.manClub);
  M.box(cx, manPROM_Y + 3.4, cz - 5.6, 20, 0.9, 0.5, PALETTE.manClubTrim);
  M.box(cx, manPROM_Y + 4.95, cz, 21, 0.4, 12, PALETTE.manClubRoof);
  M.box(cx, manPROM_Y + 5.5, cz + 4.6, 6, 1.7, 1.4, PALETTE.manClub);
  for (let i = -2; i <= 2; i++) M.box(cx + i * 3.6, manPROM_Y + 2.6, cz - 5.55, 2.0, 2.2, 0.3, PALETTE.manAwning2);
  manStaticBox(game, cx, manPROM_Y + 2.4, cz, 20, 4.8, 11);
  // the ramp down to the sand, so the roof and the club are not scenery.
  //
  // AND IT IS A RAMP, NOT A LADDER. Seven treads at 0.72 m of rise apiece:
  // the animal steps 0.40 by itself, so the "flat roof you can see the whole
  // beach from" cost seven separate hops, every one of which can be missed.
  // Fourteen at 0.36 is the same climb by walking up it, which is what a set
  // of steps outside a surf club is for.
  for (let i = 0; i < 14; i++) {
    const y = manPROM_Y + 0.30 + i * 0.36;
    const z = cz - 6.4 - i * 0.52;
    M.box(cx + 12.5, y, z, 3.4, 0.34, 0.62, PALETTE.manPromenade);
    manStaticBox(game, cx + 12.5, y, z, 3.4, 0.34, 0.62);
    // a handrail, because fourteen bare treads on the side of a building is a
    // fire escape
    if (i % 2 === 0) {
      for (let s = -1; s <= 1; s += 2) {
        M.cyl(cx + 12.5 + s * 1.6, y + 0.62, z, 0.05, 1.0, PALETTE.manPole, 0, 0, 0, 4);
        M.box(cx + 12.5 + s * 1.6, y + 1.06, z - 0.52, 0.06, 0.06, 1.24, PALETTE.manPole, 0.60, 0, 0);
      }
    }
  }
  M.box(cx + 12.5, manPROM_Y + 5.2, cz, 3.4, 0.4, 11, PALETTE.manClubRoof);
  manStaticBox(game, cx + 12.5, manPROM_Y + 5.0, cz, 3.4, 0.4, 11);

  // ---- the shopfronts of the Corso. Low, pastel, awninged, and every one of
  // them is a fish and chip shop or a place that sells thongs.
  const shopCols = [PALETTE.manShopA, PALETTE.manShopB, PALETTE.manShopC];
  const awnCols = [PALETTE.manAwning, PALETTE.manAwning2, PALETTE.manFlagYel];
  for (let i = 0; i < 9; i++) {
    const x = -46 + i * 11.5;
    if (x > 12 && x < 38) continue;              // the club is here
    const w = rand(8.4, 10.4), h = rand(4.6, 7.2);
    const z = manSHOP_Z + rand(2, 5);
    const c = shopCols[i % 3];
    M.box(x, manPROM_Y + h * 0.5, z, w, h, 10, c);
    M.box(x, manPROM_Y + h + 0.25, z, w + 0.8, 0.5, 10.6, PALETTE.manKerb);
    // the awning, and it leans
    M.box(x, manPROM_Y + 3.0, z - 5.9, w - 1.2, 0.25, 2.6, awnCols[i % 3], -0.16);
    // RECORDED, because the height and the depth come out of rand() in here and
    // there cannot be a second draw: the gulls perch on these parapets and an
    // independently re-rolled height puts thirty birds in mid-air over the
    // street. Same lesson as the crews in Cappadocia and the briccole in
    // Venice — if a build rolls it, the build has to publish it.
    manPerch.push(x - w * 0.3, manPROM_Y + h + 0.55, z - 4.9);
    manPerch.push(x + w * 0.3, manPROM_Y + h + 0.55, z - 4.9);
    manPerch.push(x, manPROM_Y + 3.2, z - 6.9);
    // windows
    for (let k = -1; k <= 1; k++) {
      M.box(x + k * (w * 0.28), manPROM_Y + 1.6, z - 5.05, w * 0.2, 2.0, 0.25, PALETTE.manClubRoof);
    }
    manStaticBox(game, x, manPROM_Y + h * 0.5, z, w, h, 10);
  }

  // ---- Norfolk Island pines. THE Manly skyline: a row of black-green
  // exclamation marks, all exactly as tall as each other, planted by somebody
  // in 1877 who was very sure about it.
  //
  // AND THE CROWN HAS TO START ABOVE THE LENS. The first build hung the lowest
  // whorl at manPROM_Y + 3.2 with a THREE AND A HALF METRE radius: the rig sits
  // 7.6 m over the animal and the promenade is at 2.6, so every one of these
  // put a dark green slab across a third to a half of the frame from the moment
  // you stepped onto the front — photographed from the Corso, the capybara was
  // completely hidden behind one. It is the cave-arrival lesson (a crown above
  // fifteen metres is a ceiling; here the ceiling was at six) and it is also
  // what a street Norfolk actually looks like, because the council takes the
  // bottom four whorls off every one of them. Bare pole to 8.4 m, canopy above.
  //
  // AND THE ROW IS OFFSET BY HALF A SPACING. It ran -56 + i*11.2, which puts a
  // tree at EXACTLY x = 0 — the beach's centreline, the spawn point and the
  // sightline of every shot down the middle of this chapter. The arrival frame
  // was two black cones with a capybara between them. Ten trees at
  // -50.4 + i*11.2 leaves the centre clear by 5.6 m either way.
  const trunkM = manMerger();
  for (let i = 0; i < 10; i++) {
    const x = -50.4 + i * 11.2;
    const h = rand(16, 20);
    const BR = manPROM_Y + 5.8;              // the lowest living whorl
    trunkM.cyl(x, manPROM_Y + h * 0.5, manPINE_Z, 0.42, h, PALETTE.manTrunk, 0, 0, 0, 6);
    // a Norfolk's trunk is RINGED — one node per whorl, and it is the only
    // thing that stops eight metres of bare pole reading as a lamp post
    for (let k = 0; k < 4; k++) {
      trunkM.cyl(x, manPROM_Y + 1.4 + k * 1.15, manPINE_Z, 0.50, 0.16,
                 PALETTE.manRockDk, 0, 0, 0, 6);
      // ...and the stubs of the whorls that were pruned off
      const a = k * 2.3;
      trunkM.box(x + Math.sin(a) * 0.55, manPROM_Y + 1.4 + k * 1.15, manPINE_Z + Math.cos(a) * 0.55,
                 0.18, 0.18, 0.9, PALETTE.manTrunk, 0, a, 0);
    }
    // the tiers. A Norfolk pine is a stack of flat discs and nothing else —
    // fourteen of them rather than nine, because at this height they are the
    // only thing in the frame and the steps between them are what it is made of.
    const tiers = 14;
    for (let k = 0; k < tiers; k++) {
      const t = k / (tiers - 1);
      // the widest whorl is a fifth of the way up the LIVE crown, not at its
      // foot: a cone tapering from the first branch is a Christmas tree.
      const r = (t < 0.22 ? lerp(2.0, 2.9, t / 0.22) : lerp(2.9, 0.45, (t - 0.22) / 0.78))
                * rand(0.92, 1.06);
      const y = BR + t * (manPROM_Y + h - 0.6 - BR);
      trunkM.cone(x, y, manPINE_Z, r, 1.75, k % 2 ? PALETTE.manPine : PALETTE.manPineLt, 0, 0, 0, 6);
      // every third whorl gets four branch tips out of it, which is the only
      // thing that breaks the silhouette of a stack of cones
      if (k % 3 === 1 && r > 1.2) {
        for (let b = 0; b < 4; b++) {
          const a = b * 1.571 + k * 0.4;
          trunkM.box(x + Math.sin(a) * r * 0.92, y - 0.15, manPINE_Z + Math.cos(a) * r * 0.92,
                     0.30, 0.22, r * 0.7, PALETTE.manPine, 0.10, a, 0);
        }
      }
    }
    manStaticBox(game, x, manPROM_Y + 2, manPINE_Z, 1.0, 4, 1.0);
  }
  const pines = new THREE.Mesh(trunkM.build(), manVC());
  pines.castShadow = true;
  // ---- AND THEY MOVE (D3) ------------------------------------------------
  // Manly is one of the windiest rows in `wxMOOD` and `grep -c sway` in this
  // file was 0: a nor'-easter coming across the ocean beach and eleven rigid
  // Norfolk pines standing in it. The window comes off the geometry — every
  // one of these is grown from manPROM_Y, so the merged mesh's own extent is
  // the right window and the trunk feet stay planted.
  //
  // 0.13 rather than the 0.20 the bamboo takes: a Norfolk pine is a mast with
  // whorls on it and the thing that moves is the tip, not the whole tree.
  swayMesh(pines, { leaf: 0.35, amount: 0.13, axis: 'y', auto: true, stiff: 2.6, hz: 0.44 });
  root.add(pines);

  // ---- a bin, a bubbler, a bike rack: the promenade needs to be furnished or
  // it is a car park
  const furn = manPoolBody();
  for (let i = 0; i < 5; i++) {
    const x = -50 + i * 25;
    M.cyl(x, manPROM_Y + 0.55, manPROM_Z + 2.2, 0.5, 1.1, PALETTE.manBin, 0, 0, 0, 8);
    M.cyl(x, manPROM_Y + 1.14, manPROM_Z + 2.2, 0.55, 0.14, PALETTE.manRockDk, 0, 0, 0, 8);
    manPoolBox(furn, x, manPROM_Y + 0.55, manPROM_Z + 2.2, 0.5, 0.55, 0.5);
  }
  for (let i = 0; i < 4; i++) {
    const x = -30 + i * 22;
    M.box(x, manPROM_Y + 0.24, manPROM_Z + 3.4, 3.6, 0.24, 0.5, PALETTE.manTrunk);
    M.box(x - 1.5, manPROM_Y + 0.1, manPROM_Z + 3.4, 0.3, 0.5, 0.5, PALETTE.manTrunk);
    M.box(x + 1.5, manPROM_Y + 0.1, manPROM_Z + 3.4, 0.3, 0.5, 0.5, PALETTE.manTrunk);
    manPoolBox(furn, x, manPROM_Y + 0.20, manPROM_Z + 3.4, 1.8, 0.20, 0.3);
  }

  // ---- AND THE REST OF A SEAFRONT, WHICH THIS ONE DID NOT HAVE ------------
  // Measured against the world-size audit: the Corso was nine boxes with three
  // windows each and eighty metres of empty paving in front of them, which is
  // a third of the density of the Plaza de Nariño over the same walking
  // distance. None of the following is a task. It is there so that the walk
  // from the ferry to the water goes through somewhere.

  // A ZEBRA CROSSING and a kerb line, because the Corso IS a road.
  // ...AND IT WAS PAINTED THE SAME COLOUR AS THE ROAD. Nine `manPromenade`
  // stripes six centimetres proud of a `manPromenade` pavement: photographed
  // from the middle of the Corso the crossing was nine faint shadows and
  // nothing else. A zebra crossing is the whitest thing on a street.
  for (let i = 0; i < 9; i++) {
    M.box(-1 + (i - 4) * 0.9, manPROM_Y + 0.035, manSHOP_Z - 6.4, 0.55, 0.07, 4.2, PALETTE.manClub);
  }
  M.box(0, manPROM_Y + 0.05, manSHOP_Z - 8.6, 116, 0.10, 0.22, PALETTE.manKerb);
  // ---- AND THE ROAD ITSELF, WHICH WAS ONE HUNDRED AND SIXTEEN METRES OF
  // ONE FLAT VALUE.
  //
  // The chapter draws the shopfronts, the awnings, the queue rail, the tables,
  // the shelter and the bollards — and then lays them on a single unbroken
  // sheet of manPromenade that is the lower half of every frame taken on the
  // Corso. It is the same failure the wrack line, the plaza and the campo have
  // all been fixed for, and this is the largest single surface left in the
  // three chapters. A street has a CENTRELINE, it has slab joints, it has
  // patches where somebody has been at the water main, and it has the dark
  // smear along the kerb where the gutter never dries.
  {
    const SY = manPROM_Y + 0.028;
    // the centreline: broken, and it wanders the way a repainted one does
    for (let i = 0; i < 26; i++) {
      const cx = -113 + i * 4.5 + Math.sin(i * 1.7) * 0.3;
      M.box(cx, SY, manSHOP_Z - 12.6 + Math.sin(i * 0.4) * 0.12, 2.4, 0.05, 0.13,
            PALETTE.manClub, 0, Math.sin(i * 2.1) * 0.006, 0);
    }
    // the gutter line, which is always a shade darker than the road
    M.box(0, SY - 0.004, manSHOP_Z - 8.95, 116, 0.05, 0.55, PALETTE.manKerbDk);
    M.box(0, SY - 0.004, manSHOP_Z - 16.1, 116, 0.05, 0.55, PALETTE.manKerbDk);
    // slab joints across the footpath, every two and a half metres, which is
    // the one thing that gives a pavement a scale
    // 2.4 m, not 5. A footpath slab is about eight feet; joints five metres
    // apart photographed as a chessboard rather than as paving.
    for (let i = 0; i < 95; i++) {
      const jx = -112 + i * 2.4;
      M.box(jx, SY, manSHOP_Z - 4.4, 0.07, 0.05, 7.4, PALETTE.manKerbDk);
    }
    // ...and the courses running the other way, which is what makes it slabs
    for (let k = 0; k < 3; k++) {
      M.box(0, SY, manSHOP_Z - 2.6 - k * 2.4, 116, 0.05, 0.07, PALETTE.manKerbDk);
    }
    M.box(0, SY, manSHOP_Z - 1.1, 116, 0.05, 0.09, PALETTE.manKerbDk);
    M.box(0, SY, manSHOP_Z - 7.6, 116, 0.05, 0.09, PALETTE.manKerbDk);
    // and the patches. A council road is a map of everything that has ever
    // been dug up in it, and no two of them are the same shape.
    for (let i = 0; i < 22; i++) {
      const px = rand(-108, 108), pz = manSHOP_Z - rand(9.4, 15.6);
      M.box(px, SY - 0.006, pz, rand(1.4, 3.8), 0.05, rand(0.9, 2.2),
            i % 3 === 0 ? PALETTE.manKerb : PALETTE.manKerbDk, 0, rand(-0.06, 0.06), 0);
    }
  }

  // THE FISH AND CHIP SHOP, and it is the loudest thing on the street: a
  // counter under a raised awning, a chalkboard, a stack of crates, and the
  // queue rail that is the only reason a queue is ever straight.
  {
    const fx = -13.5, fz = manSHOP_Z + 3.2, fy = manPROM_Y;
    M.box(fx, fy + 2.55, fz - 4.6, 9.0, 0.35, 0.4, PALETTE.manClubTrim);
    M.box(fx, fy + 1.15, fz - 4.9, 8.2, 1.0, 0.7, PALETTE.manPromenade);   // the counter
    M.box(fx, fy + 1.70, fz - 4.9, 8.2, 0.12, 0.9, PALETTE.manKerb);
    for (let i = 0; i < 4; i++) {
      M.box(fx - 3.2 + i * 2.1, fy + 2.05, fz - 5.3, 0.7, 0.9, 0.06, PALETTE.manFlagYel, 0, 0, 0.08);
    }
    // the chalkboard, which every one of them has and which is never right
    M.box(fx + 5.6, fy + 0.85, fz - 6.2, 0.9, 1.5, 0.1, PALETTE.manRockDk, 0, 0.4);
    M.box(fx + 5.6, fy + 0.10, fz - 6.2, 1.0, 0.2, 0.7, PALETTE.manTrunk, 0, 0.4);
    // crates of ice out the front
    for (let i = 0; i < 3; i++) {
      M.box(fx - 5.4 + i * 0.95, fy + 0.28, fz - 6.4, 0.85, 0.55, 0.65, PALETTE.manBoardC, 0, rand(-0.2, 0.2));
    }
    // the queue rail
    for (let i = 0; i < 5; i++) {
      const qx = fx - 4.4 + i * 2.2;
      M.cyl(qx, fy + 0.45, fz - 7.6, 0.05, 0.9, PALETTE.manPole, 0, 0, 0, 6);
      if (i < 4) M.box(qx + 1.1, fy + 0.86, fz - 7.6, 2.2, 0.05, 0.05, PALETTE.manPole);
    }
    manPoolBox(furn, fx, fy + 1.15, fz - 4.9, 4.1, 0.5, 0.35);
  }

  // OUTDOOR TABLES. Four of them, under umbrellas, on the paving.
  for (let i = 0; i < 4; i++) {
    const tx = 40 + i * 5.4, tz = manSHOP_Z - 3.4, ty = manPROM_Y;
    M.cyl(tx, ty + 0.36, tz, 0.06, 0.72, PALETTE.manPole, 0, 0, 0, 6);
    M.cyl(tx, ty + 0.75, tz, 0.62, 0.07, PALETTE.manClub, 0, 0, 0, 8);
    for (let s = 0; s < 3; s++) {
      const a = s * 2.09 + i;
      M.cyl(tx + Math.sin(a) * 1.05, ty + 0.22, tz + Math.cos(a) * 1.05, 0.22, 0.44,
            s % 2 ? PALETTE.manAwning2 : PALETTE.manAwning, 0, 0, 0, 6);
    }
    M.cyl(tx, ty + 1.4, tz, 0.05, 1.4, PALETTE.manPole, 0, 0, 0, 4);
    M.cone(tx, ty + 2.35, tz, 1.5, 0.55, i % 2 ? PALETTE.manAwning : PALETTE.manClubTrim, 0, 0, 0, 8);
    manPoolBox(furn, tx, ty + 0.4, tz, 0.7, 0.4, 0.7);
  }

  // THE FERRY SIGN at the west end, because everybody on this beach came in on
  // one and it is the only thing that says where this is.
  {
    const sx = -58, sz = manSHOP_Z - 7.0, sy = manPROM_Y;
    M.cyl(sx, sy + 1.6, sz, 0.09, 3.2, PALETTE.manPole, 0, 0, 0, 6);
    M.box(sx, sy + 3.15, sz, 4.4, 0.95, 0.14, PALETTE.manClub, 0, 0.18);
    M.box(sx, sy + 3.15, sz - 0.1, 3.9, 0.4, 0.06, PALETTE.manAwning2, 0, 0.18);
    manPoolBox(furn, sx, sy + 1.0, sz, 0.14, 1.0, 0.14);
  }

  // A BUS SHELTER, and four bollards along the kerb.
  {
    const bx = 8, bz = manSHOP_Z - 7.4, by = manPROM_Y;
    for (let s = -1; s <= 1; s += 2) M.cyl(bx + s * 2.2, by + 1.15, bz, 0.07, 2.3, PALETTE.manPole, 0, 0, 0, 4);
    M.box(bx, by + 2.36, bz, 5.2, 0.14, 1.9, PALETTE.manClubRoof);
    M.box(bx, by + 1.2, bz + 0.85, 5.0, 2.2, 0.08, PALETTE.manShopC);
    M.box(bx, by + 0.45, bz + 0.35, 4.2, 0.12, 0.5, PALETTE.manTrunk);
    manPoolBox(furn, bx, by + 0.5, bz + 0.85, 2.5, 0.5, 0.1);
  }
  for (let i = 0; i < 10; i++) {
    const x = -54 + i * 12;
    M.cyl(x, manPROM_Y + 0.34, manSHOP_Z - 9.2, 0.14, 0.68, PALETTE.manRockDk, 0, 0, 0, 6);
    manPoolBox(furn, x, manPROM_Y + 0.34, manSHOP_Z - 9.2, 0.16, 0.34, 0.16);
  }

  // =====================================================================
  // THE PEOPLE ON THE FRONT. See manPutFigure.
  //
  // Everything below is somebody USING a thing this file already drew, and
  // that is the test each of them had to pass: the queue rail gets a queue,
  // the counter gets a customer and somebody serving, the tables get people
  // at them, the benches get people on them facing the water (which is what
  // the entire population of that suburb does at this hour), the bus shelter
  // gets somebody waiting, and the volleyball net gets the two players the
  // local standing beside it has been asking for since the chapter shipped.
  // =====================================================================
  {
    const fx = -13.5, fz = manSHOP_Z + 3.2, fy = manPROM_Y;
    // behind the counter, leaning on it
    manPutFigure(M, fx - 1.2, fy, fz - 4.2, Math.PI, 2, 3);
    manPutFigure(M, fx + 2.4, fy, fz - 4.1, Math.PI, 0, 11);
    // ...and the queue, which the rail was built for. Not evenly spaced: a
    // queue bunches at the front and straggles at the back, always.
    const qz = [-5.9, -6.6, -7.1, -7.9, -8.9, -10.2];
    for (let i = 0; i < qz.length; i++) {
      manPutFigure(M, fx - 3.9 + i * 1.55 + (i % 2 ? 0.25 : -0.2), fy, fz + qz[i],
                   0.06 + (i % 3) * 0.18, i === 0 ? 2 : 0, i + 4);
    }
  }
  // the café tables, two to a table, one of them turned to talk to the other
  for (let i = 0; i < 4; i++) {
    const tx = 40 + i * 5.4, tz = manSHOP_Z - 3.4, ty = manPROM_Y;
    manPutFigure(M, tx - 1.05, ty + 0.44, tz + 0.15, 1.35 + i * 0.1, 1, i * 2 + 1);
    manPutFigure(M, tx + 0.95, ty + 0.44, tz - 0.55, -1.9 + i * 0.12, 1, i * 2 + 6);
  }
  // the benches, facing the water, which is south
  for (let i = 0; i < 6; i++) {
    const bx = -46 + i * 18, bz = manPROM_Z + 1.2;
    if (i === 2) continue;                       // one bench is always free
    manPutFigure(M, bx - 0.6, manPROM_Y + 0.42, bz - 0.10, Math.PI + 0.12, 1, i + 2);
    if (i % 2 === 0) manPutFigure(M, bx + 0.75, manPROM_Y + 0.42, bz - 0.10, Math.PI - 0.16, 1, i + 9);
  }
  // the bus shelter
  manPutFigure(M, 6.6, manPROM_Y, manSHOP_Z - 7.9, 0.4, 0, 2);
  manPutFigure(M, 9.4, manPROM_Y, manSHOP_Z - 7.7, 0.9, 0, 13);
  // ---- and the two the volleyball local is short of ----------------------
  {
    const vx = 40, vz = manSHORE_Z + 12;
    // ONE OF THESE THREE IS A PERSON NOW — see manLocals.partner. A merged
    // figure and a local would be drawn twice in the same place, so the one
    // at (vx - 2.4, vz - 3.2) is left out here and addLocal draws it instead.
    manPutFigure(M, vx + 1.9, manTerrain(vx + 1.9, vz + 3.4), vz + 3.4, Math.PI - 0.2, 0, 8);
    manPutFigure(M, vx + 4.4, manTerrain(vx + 4.4, vz + 2.0), vz + 2.0, Math.PI + 0.5, 3, 14);
  }
  // ---- somebody in the tower, because the flags are decided by a person ---
  {
    const tx = -2, tz = manDUNE_Z - 0.5;
    const h = manTerrain(tx, tz);
    manPutFigure(M, tx - 0.7, h + 2.75, tz + 0.3, Math.PI + 0.18, 2, 0);
  }
  // ---- and one person doing what the whole suburb does at four o'clock ----
  // Walking the front. Four of them, spread down two hundred metres, in a
  // stride rather than standing: a promenade with nobody moving on it is a
  // photograph of a promenade.
  for (let i = 0; i < 5; i++) {
    const wx = -50 + i * 24 + (i % 2 ? 3 : -3);
    manPutFigure(M, wx, manPROM_Y, manPROM_Z + 3.9 + (i % 2) * 1.1,
                 (i % 2 ? 1.57 : -1.57) + 0.06, 4, i * 3 + 1);
  }

  // ---- AND SOMETHING GREEN, which this seafront has never had ------------
  // `manGrass` has been in the palette since the chapter was written and has
  // never once been used: two hundred metres of paving, a kerb and a wall,
  // and not one living thing between the shopfronts and the sand. Every
  // ocean-beach promenade in Sydney has a strip of couch grass and a row of
  // scrubby coastal planting under the pines, and it is the only thing that
  // stops the front reading as a car park with a nice view.
  {
    const G = manMerger();
    // THE BED IS A SURFACE, NOT A PILE OF CUSHIONS. The first cut scattered
    // 0.32 m boxes up to two metres long down the row and photographed as
    // green foam blocks lying on the paving — a verge is a continuous strip
    // of turf a few centimetres proud of the kerb, and everything else grows
    // OUT of it. Two long slabs and one kerb line.
    for (let s = -1; s <= 1; s += 2) {
      G.box(0, manPROM_Y + 0.045, manPINE_Z + s * 1.75, 118, 0.09, 2.9, PALETTE.manGrass);
      G.box(0, manPROM_Y + 0.075, manPINE_Z + s * 3.20, 118, 0.15, 0.16, PALETTE.manKerb);
    }
    // ...and the couch grass on it, which is ankle-high and is the only thing
    // that stops a green slab reading as a green slab.
    // A HUNDRED AND FIFTY BLADES OVER TWO HUNDRED AND THIRTY SQUARE METRES is
    // one every metre and a half, which is not couch grass, it is a green slab
    // with debris on it — and off the rendered promenade that is exactly what
    // it read as: scattered chips. This is the Pantanal's grass lesson arriving
    // in a different chapter. Off a JITTERED GRID rather than a rand() over
    // the whole strip (a scatter clumps, a grid tiles, three quarters of a
    // cell of jitter does neither), five times as many, and in TUFTS of three
    // — because grass does not grow as individual blades a metre apart.
    {
      const CW = 2.05;                       // one seed every couple of metres
      const NX = Math.floor((manBEACH_X1 - manBEACH_X0) / CW);
      for (let gx = 0; gx < NX; gx++) {
        for (let gz = 0; gz < 4; gz++) {
          const bx = manBEACH_X0 + (gx + 0.5) * CW + rand(-CW * 0.36, CW * 0.36);
          const bz = manPINE_Z + [-2.5, -1.2, 1.2, 2.5][gz] + rand(-0.55, 0.55);
          for (let k = 0; k < 3; k++) {
            const hh = rand(0.13, 0.30);
            G.box(bx + rand(-0.22, 0.22), manPROM_Y + 0.06 + hh * 0.5, bz + rand(-0.18, 0.18),
                  0.045, hh, 0.14,
                  (gx + k) % 4 === 0 ? PALETTE.manScrub : PALETTE.manGrass,
                  0, rand(0, 3), rand(-0.34, 0.34));
          }
        }
      }
    }
    // ...and the low wind-shorn coastal scrub. Knee-high, so it never reaches
    // the lens, and clumped rather than sprayed down the row.
    for (let c = 0; c < 13; c++) {
      const cx = rand(manBEACH_X0 + 4, manBEACH_X1 - 4);
      const cz = manPINE_Z + (c % 2 ? rand(1.4, 2.6) : rand(-2.6, -1.2));
      for (let i = 0; i < 3; i++) {
        const x = cx + rand(-1.1, 1.1), z = cz + rand(-0.5, 0.5);
        const r = rand(0.30, 0.58);
        G.sph(x, manPROM_Y + 0.08 + r * 0.40, z, r, r * 0.55, r * 0.80,
              i === 1 ? PALETTE.manScrubDry : PALETTE.manScrub, 6);
      }
      // a fan of lomandra out of the middle of it — the one thing on this
      // coast that is genuinely spiky
      for (let k = 0; k < 5; k++) {
        const a = k * 1.26 + c;
        G.box(cx + Math.sin(a) * 0.16, manPROM_Y + 0.44, cz + Math.cos(a) * 0.16,
              0.06, 0.78, 0.09, k % 2 ? PALETTE.manGrass : PALETTE.manScrubDry,
              0.13, a, k % 2 ? 0.24 : -0.24);
      }
    }
    const gm = new THREE.Mesh(G.build(), manVC());
    gm.castShadow = true;
    gm.receiveShadow = true;
    root.add(gm);
  }
  manPoolDone(game, furn);

  const mesh = new THREE.Mesh(M.build(), manVC());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);
}

// ---------------------------------------------------------------- the point --
function manBuildPoint(game, root) {
  const M = manMerger();

  // ---- the ocean pool. A rectangle of flat water with a wall round it, ten
  // metres from water that is anything but — which is the whole reason it is
  // here and the reason people have built them along this coast for a century.
  const P = manPOOL;
  const cxp = (P.x0 + P.x1) * 0.5, czp = (P.z0 + P.z1) * 0.5;
  const w = P.x1 - P.x0, d = P.z1 - P.z0;
  // the seaward wall is thick and takes the swell over the top of it
  M.box(cxp, P.wall * 0.5, P.z0 - 1.1, w + 3.2, P.wall + 1.6, 2.2, PALETTE.manPoolWall);
  M.box(cxp, P.wall * 0.5, P.z1 + 1.1, w + 3.2, P.wall + 1.6, 2.2, PALETTE.manPoolWall);
  M.box(P.x0 - 1.1, P.wall * 0.5, czp, 2.2, P.wall + 1.6, d, PALETTE.manPoolWall);
  M.box(P.x1 + 1.1, P.wall * 0.5, czp, 2.2, P.wall + 1.6, d, PALETTE.manPoolWall);
  // THE COLLIDER TOP HAS TO BE THE DRAWN TOP. It was 60 cm lower than the
  // stone it is under — drawn 1.95, solid to 1.35 — so a capybara walking the
  // coping of the pool wall sank into it to the belly and a hop from the wall
  // into the pool started half a metre inside the wall.
  const pwTop = P.wall + 0.8, pwBot = -0.8;
  const pwC = (pwTop + pwBot) * 0.5, pwH = pwTop - pwBot;
  manStaticBox(game, cxp, pwC, P.z0 - 1.1, w + 3.2, pwH, 2.2);
  manStaticBox(game, cxp, pwC, P.z1 + 1.1, w + 3.2, pwH, 2.2);
  manStaticBox(game, P.x0 - 1.1, pwC, czp, 2.2, pwH, d);
  manStaticBox(game, P.x1 + 1.1, pwC, czp, 2.2, pwH, d);
  // a chain handrail along the seaward coping, which every one of these has and
  // which is the only thing that says the wall is a place people stand
  for (let i = 0; i <= 10; i++) {
    const hx = P.x0 + (w / 10) * i;
    M.cyl(hx, P.wall + 1.25, P.z0 - 1.1, 0.05, 0.9, PALETTE.manPole, 0, 0, 0, 4);
    if (i < 10) M.box(hx + w / 20, P.wall + 1.62, P.z0 - 1.1, w / 10, 0.045, 0.045, PALETTE.manPole);
  }
  // the floor, painted, with lane lines that are somebody's optimism
  M.box(cxp, P.floor - 0.15, czp, w, 0.3, d, PALETTE.manPoolFloor);
  for (let i = 0; i < 3; i++) {
    M.box(cxp, P.floor + 0.03, P.z0 + (i + 1) * (d / 4), w - 1, 0.06, 0.3, PALETTE.manClub);
  }
  // steps in at the shoreward corner
  for (let i = 0; i < 4; i++) {
    M.box(P.x0 + 2.2, P.floor + 0.3 + i * 0.42, P.z1 - 1.6, 3.0, 0.4, 0.9 + i * 0.35, PALETTE.manPoolWall);
    manStaticBox(game, P.x0 + 2.2, P.floor + 0.3 + i * 0.42, P.z1 - 1.6, 3.0, 0.4, 0.9 + i * 0.35);
  }

  // ---- rock pools and boulders on the platform, because a flat rock shelf is
  // a car park with a better colour.
  //
  // AND THEY ARE SOLID NOW. The solidity audit put 263 walk-through hits on
  // this mesh, and a two-and-a-half-metre boulder you stroll through is the
  // most visible failure of that kind in the chapter. One compound body for
  // the lot of them — see manPoolBody.
  const rocks = manPoolBody();
  for (let i = 0; i < 22; i++) {
    // A JITTERED GRID, NOT A SCATTER. Twenty-two independent rand() draws over
    // a 28 x 36 patch put nine of them in one heap and left the rest of the
    // shelf bare — measured on a screenshot of the point, where the boulders
    // read as a single rockfall. A grid with three quarters of a cell of
    // jitter is still random-looking and cannot clump.
    const x = manPOINT_X + 3 + (i % 5) * 6.0 + rand(-2.2, 2.2);
    const z = -6 + ((i / 5) | 0) * 8.0 + rand(-3.0, 3.0);
    if (x > P.x0 - 3 && x < P.x1 + 3 && z > P.z0 - 3 && z < P.z1 + 3) continue;
    const h = manTerrain(x, z);
    const r = rand(0.8, 2.6);
    M.sph(x, h + r * 0.35, z, r, r * 0.6, r * 0.9, i % 3 ? PALETTE.manRock : PALETTE.manRockDk, 6);
    // Only the ones worth noticing: under about half a metre proud the animal
    // steps over it and a collider there is a stubbed toe, not a rock.
    if (r * 0.6 > 0.55) manPoolBox(rocks, x, h + r * 0.30, z, r * 0.78, r * 0.5, r * 0.72);
  }
  // ---- ROCK POOLS. The whole reason anybody walks out on a shelf like this,
  // and the reason `manUrchin` has been sitting unused in the palette since the
  // chapter was built. A ring of dark rock, a disc of still green water lower
  // than everything round it, and three or four urchins in the bottom of it.
  for (let i = 0; i < 7; i++) {
    const x = manPOINT_X + 4 + (i % 4) * 6.5 + rand(-1.2, 1.2);
    const z = -2 + ((i / 4) | 0) * 9 + rand(-2.5, 2.5);
    if (x > P.x0 - 3 && x < P.x1 + 3 && z > P.z0 - 3 && z < P.z1 + 3) continue;
    const h = manTerrain(x, z);
    const rr = rand(1.3, 2.4);
    // the rim, in eight lumps, so it is a pool and not a drawn circle
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2;
      M.sph(x + Math.sin(a) * rr, h + 0.16, z + Math.cos(a) * rr, rr * 0.4, 0.24, rr * 0.4,
            k % 2 ? PALETTE.manRockDk : PALETTE.manRockWet, 6);
    }
    // A POOL IS FLAT WATER AND FLAT WATER IS A QUAD, not a box: a rock pool is
    // seen only from above, so eleven twelfths of a box is faces nobody can
    // reach. See the performance budget on sand ripples.
    //
    // AND IT HAS TO BE DARK. The first cut used manPoolFloor at rr * 1.7 and
    // photographed as a sheet of pale paper lying on the rock — bigger than
    // its own rim and brighter than the sandstone round it. A rock pool is a
    // hole full of shadowed green water: smaller than the ring, and the
    // darkest thing on the shelf.
    //
    // AND THE SPIN GOES IN rz, NOT ry. manXform builds its quaternion from an
    // 'XYZ' Euler, which three composes as Rx*Ry*Rz — so ry is applied BEFORE
    // the -90 about x that lays the quad down, and rotating an upright plane
    // about the vertical axis leaves it upright. Measured from a screenshot of
    // the ledge: every rock pool in the chapter was a green square standing on
    // edge in a ring of stones. rz is the in-plane spin and it is applied
    // first, which is exactly what a random rotation of a square wants.
    M.add(manG.plane, manXform(x, h + 0.09, z, -Math.PI / 2, 0, rand(0, 3), rr * 1.25, rr * 1.25, 1),
          PALETTE.manRockWet);
    M.add(manG.plane, manXform(x, h + 0.11, z, -Math.PI / 2, 0, rand(0, 3), rr * 0.85, rr * 0.85, 1),
          PALETTE.manKelp);
    for (let k = 0; k < 3; k++) {
      M.sph(x + rand(-rr * 0.45, rr * 0.45), h + 0.10, z + rand(-rr * 0.45, rr * 0.45),
            0.15, 0.11, 0.15, PALETTE.manUrchin, 6);
    }
  }
  // and kelp along the edge of the platform where it goes under
  for (let i = 0; i < 26; i++) {
    const x = manPOINT_X + rand(0, 8);
    const z = rand(-30, 4);
    const h = manTerrain(x, z);
    if (h > -0.4) continue;
    M.box(x, h + 0.7, z, 0.25, 1.5, 0.9, PALETTE.manKelp, rand(-0.4, 0.4), rand(0, 3), rand(-0.3, 0.3));
  }
  // ---- THE LEDGE, and somebody fishes off it every day of the year. Two rod
  // holders drilled into the rock, a bucket, and a coil of line — which is all
  // there ever is, and is the only thing on this shelf that says a person comes
  // out here.
  {
    // +7, not +3.5: at three and a half metres in from the platform edge the
    // whole set-up hung over the drop and the rods were planted in mid-air.
    const lx = manPOINT_X + 7, lz = -12;
    const h = manTerrain(lx, lz);
    for (let s = -1; s <= 1; s += 2) {
      // the holder, and the rod IN it — the butt at the holder's mouth and the
      // tip out over the water, which is one rotation and not two
      M.cyl(lx + s * 1.1, h + 0.35, lz, 0.06, 0.7, PALETTE.manRockDk, 0, 0, 0, 4);
      M.cyl(lx + s * 1.1 - 1.15, h + 1.35, lz - 0.15, 0.025, 3.4, PALETTE.manPole,
            0, 0, 0.60, 4);
    }
    M.cyl(lx + 0.2, h + 0.24, lz + 1.3, 0.28, 0.48, PALETTE.manBoardC, 0, 0, 0, 8);
    M.cyl(lx - 1.9, h + 0.09, lz + 0.9, 0.34, 0.13, PALETTE.manFlagYel, 0, 0, 0, 8);
    manPoolBox(rocks, lx + 0.2, h + 0.24, lz + 1.3, 0.3, 0.24, 0.3);
  }

  // ---- Shelly Beach: a scrap of sand facing entirely the wrong way, which is
  // why it is the only calm water on this side of the peninsula
  for (let i = 0; i < 9; i++) {
    const a = rand(0, Math.PI * 2), rr = rand(6, 15);
    const x = manSHELLY.x + Math.cos(a) * rr, z = manSHELLY.z + Math.sin(a) * rr;
    const h = manTerrain(x, z);
    if (h < 0.2) continue;
    const sx = rand(0.7, 1.5), sz2 = rand(0.7, 1.3);
    M.sph(x, h + 0.3, z, sx, 0.5, sz2, PALETTE.manRockDk, 6);
    manPoolBox(rocks, x, h + 0.26, z, sx * 0.8, 0.42, sz2 * 0.8);
  }
  // ---- AND A KIOSK ON IT. `shelly` is a published landmark that the map and
  // the to-do card point at, and what was there was nine rocks. There is a
  // café on that beach, it has been there since 1932, and it is the whole
  // reason people walk round the point rather than turning back at the pool.
  {
    const kx = manSHELLY.x + 7.5, kz = manSHELLY.z + 9.0;
    const h = manTerrain(kx, kz);
    M.box(kx, h + 1.55, kz, 8.0, 3.1, 5.0, PALETTE.manClub, 0, -0.34);
    M.box(kx, h + 3.25, kz, 8.6, 0.32, 5.6, PALETTE.manClubRoof, 0, -0.34);
    M.box(kx, h + 2.35, kz, 8.2, 0.5, 5.2, PALETTE.manClubTrim, 0, -0.34);
    M.box(kx - 1.2, h + 2.05, kz - 2.9, 5.4, 0.16, 2.4, PALETTE.manAwning2, -0.14, -0.34);
    M.box(kx - 1.2, h + 1.05, kz - 2.6, 4.6, 1.0, 0.5, PALETTE.manPromenade, 0, -0.34);
    manStaticBox(game, kx, h + 1.55, kz, 8.0, 3.1, 5.0, -0.34);
    // three picnic tables under the pines behind it
    for (let i = 0; i < 3; i++) {
      const tx = kx - 8 + i * 3.4, tz = kz + 1.2 + (i % 2) * 2.2;
      const th = manTerrain(tx, tz);
      M.box(tx, th + 0.72, tz, 2.2, 0.10, 1.0, PALETTE.manTrunk, 0, 0.3 * i);
      for (let s = -1; s <= 1; s += 2) {
        M.box(tx, th + 0.42, tz + s * 0.78, 2.2, 0.09, 0.34, PALETTE.manTrunk, 0, 0.3 * i);
        M.box(tx + s * 0.9, th + 0.35, tz, 0.14, 0.7, 1.5, PALETTE.manTrunk, 0, 0.3 * i);
      }
      manPoolBox(rocks, tx, th + 0.45, tz, 1.2, 0.45, 0.9, 0.3 * i);
    }
    // a boat ramp down to the sand, and a dinghy pulled up on it
    M.box(kx - 3.5, h - 0.3, kz - 8.5, 3.2, 0.3, 9.0, PALETTE.manPoolWall, -0.10);
    M.sph(kx - 6.5, manTerrain(kx - 6.5, kz - 10) + 0.42, kz - 10, 0.9, 0.42, 2.4,
          PALETTE.manBoardB, 6);
    M.box(kx - 6.5, manTerrain(kx - 6.5, kz - 10) + 0.7, kz - 10, 1.5, 0.10, 4.2,
          PALETTE.manBoatTrim);
  }
  manPoolDone(game, rocks);

  // ---- North Head. It is not a set piece, it is the eastern wall of the
  // world and it wants to look like two hundred metres of sandstone.
  // TWO HUNDRED METRES OF SANDSTONE HAS TO BE SANDSTONE. These twenty-eight
  // blocks are twelve metres tall, they stand on ground the capybara can walk
  // up, and not one of them was solid: sixty-five of Manly's walkable squares
  // — more than every other chapter's failures put together — had a cliff
  // within reach that the animal strolled through and out the far side of.
  // The extents are drawn ONCE into locals and used by both calls, because a
  // second rand() would give the solid block a different size from the seen
  // one, which is the same bug wearing a hat.
  for (let i = 0; i < 16; i++) {
    const x = 96 + rand(0, 34);
    const z = rand(-60, 30);
    const h = manTerrain(x, z);
    const w = rand(8, 18), d = rand(10, 22), ry = rand(0, 1.2);
    M.box(x, h - 3, z, w, 12, d, i % 2 ? PALETTE.manCliff : PALETTE.manCliffDk, 0, ry, 0);
    manStaticBox(game, x, h - 3, z, w, 12, d, ry);
    if (i % 3 === 0) M.sph(x, h + 1.2, z, rand(3, 7), 1.4, rand(3, 6), PALETTE.manScrub, 6);
  }
  // ...and the west one
  for (let i = 0; i < 12; i++) {
    const x = -84 - rand(0, 34);
    const z = rand(-40, 34);
    const h = manTerrain(x, z);
    const w = rand(8, 16), d = rand(10, 20), ry = rand(0, 1.2);
    M.box(x, h - 3, z, w, 12, d, i % 2 ? PALETTE.manCliff : PALETTE.manCliffDk, 0, ry, 0);
    manStaticBox(game, x, h - 3, z, w, 12, d, ry);
    if (i % 3 === 1) M.sph(x, h + 1.0, z, rand(3, 6), 1.2, rand(3, 5), PALETTE.manScrubDry, 6);
  }

  const mesh = new THREE.Mesh(M.build(), manVC());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);
}

// --------------------------------------------------------- things on the sand --
function manBuildBeachThings(game, root) {
  const M = manMerger();

  // ---- A BEACH IS NOT A SCATTER, IT IS A FIELD OF CAMPS -------------------
  //
  // Twenty-two towels and six umbrellas, each dropped at an independent
  // rand() over a hundred and twenty metres of sand: one object every four
  // metres, all of them alone, none of them related to any other. Photographed
  // from the promenade the dry half of this beach was pale sand with coloured
  // paper on it — and this chapter measures 72,000 triangles against 199,000
  // in Cappadocia and 212,000 in the Pantanal, so it is also the one place in
  // the three with room to fix it properly.
  //
  // What is actually on that sand at four in the afternoon is FAMILIES. A
  // towel, a second towel beside it at a slightly different angle, a bag, a
  // pair of thongs kicked off, an esky, and — for about half of them — an
  // umbrella leaning out of the vertical because nobody has ever put one in
  // straight. Sixteen of those reads as a full beach where seventy scattered
  // singles read as litter, and it costs the same order of geometry.
  //
  // ...AND A BEACH TOWEL IS 0.9 BY 1.7 METRES. These were 1.5-2.1 by 2.4-3.2,
  // which is a double bed. Against a capybara 1.1 m long they were the reason
  // the beach read as a card table from six metres up.
  const tow = [PALETTE.manTowelA, PALETTE.manTowelB, PALETTE.manTowelC, PALETTE.manTowelD];
  const bagC = [PALETTE.manBoardA, PALETTE.manBoardC, PALETTE.manAwning2, PALETTE.manClub];
  for (let i = 0; i < 16; i++) {
    // spread along the beach on a jittered spacing — a grid tiles and a scatter
    // clumps; three quarters of a cell of jitter does neither
    const cx = manBEACH_X0 + 7 + (i + 0.5) * ((manBEACH_X1 - manBEACH_X0 - 14) / 16) +
               rand(-2.6, 2.6);
    const cz = rand(manSHORE_Z + 4.0, manDUNE_Z + 0.5);
    const face = rand(-0.55, 0.55);          // the whole camp faces the water
    const n = 1 + (i % 3 === 0 ? 2 : 1);     // one, two or three towels
    for (let k = 0; k < n; k++) {
      const tx = cx + (k - (n - 1) * 0.5) * rand(1.15, 1.5);
      const tz = cz + rand(-0.4, 0.4);
      const h = manTerrain(tx, tz);
      if (h < 0.15) continue;
      M.box(tx, h + 0.025, tz, rand(0.82, 0.98), 0.05, rand(1.55, 1.85),
            tow[(i + k) % 4], 0, face + rand(-0.22, 0.22), 0);
    }
    // the bag at the head of it, which is where the bag always is
    {
      const bx = cx + rand(-1.4, 1.4), bz = cz + rand(0.9, 1.5);
      const h = manTerrain(bx, bz);
      if (h > 0.15) {
        M.box(bx, h + 0.16, bz, 0.44, 0.32, 0.26, bagC[i % 4], 0, rand(0, 3), 0);
        // ...and the thongs, kicked off, never together
        M.box(bx + rand(-0.7, 0.7), h + 0.02, bz + rand(-0.6, 0.2), 0.11, 0.03, 0.26,
              PALETTE.manRockDk, 0, rand(0, 3), 0);
        M.box(bx + rand(-0.7, 0.7), h + 0.02, bz + rand(-0.6, 0.2), 0.11, 0.03, 0.26,
              PALETTE.manRockDk, 0, rand(0, 3), 0);
      }
    }
    // ...and about half of them have got the umbrella up, and not one of them
    // is vertical
    if (i % 2 === 0) {
      const ux = cx + rand(-1.6, 1.6), uz = cz + rand(0.6, 1.6);
      const h = manTerrain(ux, uz);
      if (h > 0.2) {
        const tilt = rand(-0.16, 0.16), tilt2 = rand(-0.16, 0.16);
        M.cyl(ux, h + 1.05, uz, 0.055, 2.1, PALETTE.manPole, tilt, 0, tilt2, 4);
        const hx = ux + Math.sin(tilt2) * 2.0, hz = uz - Math.sin(tilt) * 2.0;
        // 1.06, NOT 1.42. cone() takes a RADIUS and scales it by two, so the
        // first cut was a two-metre-eighty canopy — a marquee, not a beach
        // umbrella, and with a contrasting underside cone inside it the thing
        // photographed as a fairground carousel in the middle of the beach.
        // A real one is about two metres across.
        M.cone(hx, h + 2.16, hz, 1.06, 0.52,
               i % 4 === 0 ? PALETTE.manAwning : PALETTE.manAwning2, tilt, rand(0, 1), tilt2, 8);
        // ...and NO second cone underneath it. A cone geometry already has a
        // base, and a contrasting disc inside the canopy turned every umbrella
        // on this beach into a dartboard seen from above — which is the one
        // angle this game's camera ever looks at anything from.
        // an esky in the shade, which is the only reason the umbrella is there
        M.box(hx + rand(-0.6, 0.6), h + 0.17, hz + rand(-0.6, 0.6), 0.52, 0.34, 0.36,
              PALETTE.manFoam, 0, rand(0, 3), 0);
      }
    }
  }
  // ---- AND SOMEBODY'S BOARD, STUCK IN THE SAND ---------------------------
  // The single most recognisable object on an Australian surf beach, and there
  // were none of them anywhere on the sand: the only boards in the chapter
  // were seven foamies stacked flat in the nippers' pile and six on the club
  // rack. A board goes in the sand nose-up beside its owner's towel while its
  // owner is out the back, and a row of them along the top of the beach is a
  // skyline in the one part of the frame that had nothing standing up in it.
  {
    const bc = [PALETTE.manBoardA, PALETTE.manBoardB, PALETTE.manBoardC, PALETTE.manBoardD];
    for (let i = 0; i < 11; i++) {
      const x = manBEACH_X0 + 10 + i * ((manBEACH_X1 - manBEACH_X0 - 20) / 10) + rand(-2.2, 2.2);
      const z = rand(manSHORE_Z + 7.5, manDUNE_Z + 1.2);
      const h = manTerrain(x, z);
      if (h < 0.3) continue;
      const lean = rand(-0.24, 0.24), lean2 = rand(-0.18, 0.18), yaw = rand(0, 3.14);
      // A BOARD IS A TAPER, NOT A BOX WITH A DART ON IT. The first cut put a
      // 0.52 m cone on the top of a 0.52 m plank, which from the promenade is
      // a lawn dart. The shape that reads as a surfboard at this distance is
      // the outline: narrow at the tail, widest a third of the way up, and
      // drawn to a point over the last quarter.
      M.box(x + Math.sin(lean2) * 0.22, h + 0.22, z - Math.sin(lean) * 0.22,
            0.30, 0.46, 0.075, bc[i % 4], lean, yaw, lean2);            // the tail
      M.box(x + Math.sin(lean2) * 0.90, h + 0.90, z - Math.sin(lean) * 0.90,
            0.48, 0.96, 0.075, bc[i % 4], lean, yaw, lean2);            // the widest part
      M.box(x + Math.sin(lean2) * 1.62, h + 1.62, z - Math.sin(lean) * 1.62,
            0.32, 0.52, 0.075, bc[i % 4], lean, yaw, lean2);            // and the nose
      // ...and the stripe down the deck, which every one of them has
      M.box(x + Math.sin(lean2) * 0.55, h + 1.00, z - Math.sin(lean) * 0.55,
            0.09, 1.9, 0.09, PALETTE.manRockDk, lean, yaw, lean2);
      // ...and the leg-rope, coiled at the foot of it
      M.cyl(x + rand(-0.3, 0.3), h + 0.04, z + rand(-0.3, 0.3), 0.20, 0.06,
            PALETTE.manRockDk, 0, 0, 0, 8);
    }
  }
  // a board rack outside the club
  for (let i = 0; i < 6; i++) {
    const cols = [PALETTE.manBoardA, PALETTE.manBoardB, PALETTE.manBoardC, PALETTE.manBoardD];
    const x = 36 + i * 1.1, z = manDUNE_Z + 1.5;
    const h = manTerrain(x, z);
    M.box(x, h + 1.05, z, 0.5, 2.1, 0.09, cols[i % 4], 0.22, 0, rand(-0.12, 0.12));
  }
  // the lifeguard tower, which is where the flags are decided
  {
    const x = -2, z = manDUNE_Z - 0.5;
    const h = manTerrain(x, z);
    for (let i = 0; i < 4; i++) {
      M.box(x + (i < 2 ? -1.3 : 1.3), h + 1.2, z + (i % 2 ? -1.2 : 1.2), 0.22, 2.4, 0.22, PALETTE.manTrunk);
    }
    M.box(x, h + 2.6, z, 3.4, 0.3, 3.2, PALETTE.manTower);
    M.box(x, h + 3.3, z, 3.2, 1.4, 3.0, PALETTE.manTower);
    M.box(x, h + 4.15, z, 3.8, 0.3, 3.4, PALETTE.manClubTrim);
    manStaticBox(game, x, h + 1.4, z, 3.0, 2.8, 2.8);
  }
  // ---- THE SHARK-NET BUOY LINE, AND IT HAS TO FLOAT ----------------------
  // Seven spheres pinned at y = 0.25 in the one chapter in this game whose
  // water is a FUNCTION: measured at (-30, -62) the live surface was already
  // 0.37 with an amplitude of about one and a half metres, so half the set
  // rolled straight over the top of them and the other half left them hanging
  // in the air. They are the only object out the back and the only thing that
  // gives the open water a scale, so they go on their own instanced mesh and
  // ride the swell like everything else out there. See manUpdateBuoys.

  // ---- AND WHAT IS ACTUALLY ON A SURF BEACH AT FOUR IN THE AFTERNOON ------
  // Twenty-two towels and six umbrellas over a hundred and twenty metres of
  // sand is one object every five metres in a frame thirty metres wide, which
  // is the emptiest beach in the game. None of this is collidable except the
  // shower and the net posts, and none of it is a task.
  const sandy = manPoolBody();

  // THE NIPPERS. Half of Manly is eight years old and in a coloured cap on a
  // Sunday morning, and the gear is still on the sand at four: a line of
  // markers, a stack of foam boards, and the club's beach flags in the sand.
  for (let i = 0; i < 9; i++) {
    const x = -44 + i * 3.1, z = manSHORE_Z + 2.2;
    const h = manTerrain(x, z);
    M.cone(x, h + 0.22, z, 0.20, 0.44, i % 2 ? PALETTE.manFlagYel : PALETTE.manAwning, 0, 0, 0, 6);
  }
  for (let i = 0; i < 7; i++) {
    const x = -36 + i * 0.34, z = manSHORE_Z + 6.5;
    const h = manTerrain(x, z);
    M.box(x, h + 0.09 + i * 0.07, z, 0.42, 0.07, 1.9,
          [PALETTE.manBoardA, PALETTE.manBoardB, PALETTE.manBoardC, PALETTE.manBoardD][i % 4],
          0, 0.06);
  }

  // A BEACH VOLLEYBALL NET at the north end, which is what the dry sand is for
  {
    const vx = 40, vz = manSHORE_Z + 12;
    for (let s = -1; s <= 1; s += 2) {
      const px = vx + s * 4.5;
      const h = manTerrain(px, vz);
      M.cyl(px, h + 1.25, vz, 0.07, 2.5, PALETTE.manPole, 0, 0, 0, 6);
      manPoolBox(sandy, px, h + 1.25, vz, 0.09, 1.25, 0.09);
    }
    const vh = manTerrain(vx, vz);
    M.box(vx, vh + 2.05, vz, 9.0, 0.85, 0.04, PALETTE.manTowelD);
    M.box(vx, vh + 2.45, vz, 9.0, 0.09, 0.06, PALETTE.manFlagYel);
    M.sph(vx + rand(-3, 3), vh + 0.20, vz + rand(2, 5), 0.21, 0.21, 0.21, PALETTE.manBoardD, 8);
  }

  // THE SHOWER at the top of the beach, and the puddle under it
  {
    const sx = -8, sz = manDUNE_Z + 0.8;
    const h = manTerrain(sx, sz);
    M.cyl(sx, h + 1.15, sz, 0.075, 2.3, PALETTE.manPole, 0, 0, 0, 6);
    M.box(sx, h + 2.24, sz + 0.25, 0.14, 0.14, 0.6, PALETTE.manPole);
    M.cyl(sx, h + 2.10, sz + 0.5, 0.16, 0.12, PALETTE.manKerb, 0, 0, 0, 8);
    M.add(manG.plane, manXform(sx, h + 0.03, sz + 0.5, -Math.PI / 2, 0, 0, 2.4, 2.4, 1),
          PALETTE.manSandWet);
    manPoolBox(sandy, sx, h + 1.15, sz, 0.10, 1.15, 0.10);
  }

  // A ROW OF BENCHES under the pines, facing the water, because that is what
  // the entire population of that suburb does at this hour
  for (let i = 0; i < 6; i++) {
    const bx = -46 + i * 18, bz = manPROM_Z + 1.2;
    const h = manPROM_Y;
    M.box(bx, h + 0.44, bz, 2.6, 0.10, 0.5, PALETTE.manTrunk);
    M.box(bx, h + 0.76, bz + 0.26, 2.6, 0.55, 0.09, PALETTE.manTrunk, 0.16);
    for (let s = -1; s <= 1; s += 2) M.box(bx + s * 1.1, h + 0.22, bz, 0.12, 0.44, 0.5, PALETTE.manRockDk);
    manPoolBox(sandy, bx, h + 0.36, bz, 1.35, 0.36, 0.32);
  }

  // and the umbrella poles and the board rack, which were the last two pieces
  // of furniture in this chapter you could walk straight through
  for (let i = 0; i < 6; i++) {
    const x = 36 + i * 1.1, z = manDUNE_Z + 1.5;
    manPoolBox(sandy, x, manTerrain(x, z) + 0.55, z, 0.3, 0.55, 0.14);
  }

  // ---- AND THE SAND ITSELF, WHICH WAS ONE COLOUR FOR A HUNDRED AND TWENTY
  // METRES. The ground mesh already fades dry to wet with height, but height
  // on this beach is a smooth ramp, so from six metres up the whole dry half
  // of it is a single flat sheet of manSand with objects standing on it. What
  // an ocean beach actually has at four in the afternoon is a WRACK LINE — a
  // ragged band of dried kelp, cuttlebone and blue-bottle at the top of the
  // last high tide — and, above that, the wind working the dry sand into
  // ripples running along the beach. Both are flat, both are one triangle
  // pair, and between them they are the only texture there is up there.
  const SD = manMerger();
  // 460 AND SHORTER, NOT 230 AND LONGER. The note below already says a wind
  // ripple wants to be "short, dense and barely a shade off the sand", and
  // then the numbers under it were 0.8-2.1 m long, 5.5 cm proud, and every
  // fifth one in manSandWet — which off the rendered beach is a scatter of
  // two-metre pale PLANKS lying on the dry sand, one every three square
  // metres, each one individually resolvable. A ripple field is a texture: at
  // half the length and twice the count the eye stops counting them.
  for (let i = 0; i < 460; i++) {
    // the ripples: LONG in x and short in z, because the wind here is a
    // southerly and they run with the beach. Drawn 2 cm proud so they catch
    // the low sun rather than being a colour on a flat plane.
    //
    // AND THEY ARE A TEXTURE, NOT A DECK. The first cut ran them to six metres
    // in `manKerb` — half a stop off white against dry sand — and photographed
    // as scaffold planks lying on the beach. A wind ripple is about a metre of
    // crest and the only thing you actually see is its SHADOW, so it wants to
    // be short, dense and barely a shade off the sand it is made of.
    const x = rand(manBEACH_X0 + 2, manBEACH_X1 - 2);
    const z = rand(manDUNE_Z - 5.5, manPROM_Z - 0.6);
    const h = manTerrain(x, z);
    if (h < 0.5) continue;
    SD.box(x, h + 0.022, z, rand(0.5, 1.15), 0.035, rand(0.10, 0.17),
           i % 9 === 0 ? PALETTE.manSandWet : PALETTE.manSand, 0, rand(-0.07, 0.07), 0);
  }
  for (let i = 0; i < 150; i++) {
    // the wrack line. It follows the last high tide, which on this profile is
    // about a metre of run-up above the still waterline — so it is a CONTOUR,
    // not a straight line, and it wanders the way a real one does.
    const x = rand(manBEACH_X0 + 1, manBEACH_X1 - 1);
    const zc = manSHORE_Z + 4.6 + Math.sin(x * 0.075) * 1.5 + Math.sin(x * 0.021 + 2) * 1.1;
    const z = zc + rand(-0.85, 0.85);
    const h = manTerrain(x, z);
    // AND IT IS A LINE, NOT CONFETTI. The first cut mixed white foam, teal
    // bluebottle and dark kelp at up to two metres a piece and rotated every
    // one of them freely: photographed from the promenade the top of the
    // beach was a scatter of coloured paper. Dried kelp is nearly the colour
    // of wet sand, it lies ALONG the tide line rather than across it, and the
    // one saturated thing in it is a bluebottle, which is the size of a thumb.
    // ---- AND IT IS STILL TOO BIG AND TOO GREEN --------------------------
    // Second pass on the same line. Pieces up to 2.2 m long in manKelp
    // (0x5a6b3a, a saturated olive) against manSand (0xe9dcb8, pale cream) is
    // a two-and-a-quarter-stop contrast at a length the eye resolves
    // individually from six metres up — measured off the beach, a hundred and
    // fifty dark green PLANKS scattered over the sand, and they were the most
    // conspicuous objects in the chapter. Dried kelp is 20-70 cm of ribbon,
    // it is closer to the colour of wet sand than to the colour of a leaf, and
    // two thirds of a wrack line is not kelp at all — it is cuttlebone,
    // shell grit and dry weed, all of which are the colour of the beach.
    const r = i % 7;
    const c = r < 3 ? PALETTE.manSandDeep : (r < 5 ? PALETTE.manSandWet : PALETTE.manKelp);
    SD.box(x, h + 0.026, z, rand(0.22, 0.72), 0.045, rand(0.07, 0.15), c,
           0, rand(-0.42, 0.42), 0);
    // ...and a bluebottle, which is the size of a thumb and is the ONE
    // saturated thing that belongs in a wrack line
    if (i % 13 === 0) {
      SD.sph(x + rand(-0.8, 0.8), h + 0.04, z + rand(-0.5, 0.5), 0.09, 0.045, 0.075,
             PALETTE.manAwning2, 6);
    }
  }
  // ...and the tracks of everybody who has walked down to the water today,
  // which is the one thing on a beach that says people came this way.
  // ---- AND A FOOTPRINT IS A HOLE, NOT A TILE -----------------------------
  // Seven tracks of twenty-two prints, each a 16 x 27 cm box drawn 12 mm PROUD
  // of the sand in manSandWet — which is a stop and a half off manSand — at a
  // dead-regular 52 cm pitch with a ±13 cm shuffle. Photographed from the
  // promenade those were not footprints, they were two rows of pale stepping
  // stones running down the beach, and they were the most legible thing in the
  // frame after the flags.
  //
  // Three things are wrong and all three are the same thing. A human stride is
  // 70-75 cm, not 52, and the left and right prints are 20 cm apart, so a
  // track is a staggered pair and not a dotted line. A print in dry sand is a
  // DEPRESSION: what you can see of it is the shadow inside it and the collapsed
  // rim round it, both of which are darker than the beach and neither of which
  // stands up off it. And a print is 26 cm long by 11 wide, not 16 by 27, which
  // was wider than it was long and pointing across the track.
  for (let t = 0; t < 9; t++) {
    const x0 = rand(manBEACH_X0 + 8, manBEACH_X1 - 8);
    const drift = rand(-0.14, 0.14);
    // some of them are walking up the beach and some down it, which is the
    // whole reason there are two rows of anything
    const dir = t % 3 === 0 ? -1 : 1;
    for (let k = 0; k < 17; k++) {
      const s = k * 0.73;
      const z = dir > 0 ? manDUNE_Z + 0.5 - s : manSHORE_Z + 1.5 + s;
      const x = x0 + drift * s;
      const h = manTerrain(x, z);
      if (h < -0.05 || h > 2.4) break;
      // sunk 8 mm rather than raised 12, and in the shadow tone rather than
      // the highlight one
      SD.box(x + (k % 2 ? 0.10 : -0.10), h - 0.008, z, 0.11, 0.03, 0.26,
             PALETTE.manSandDeep, 0, drift, 0);
    }
  }
  const sdm = new THREE.Mesh(SD.build(), manVCG());
  sdm.receiveShadow = true;
  root.add(sdm);
  manPoolDone(game, sandy);

  const mesh = new THREE.Mesh(M.build(), manVC());
  mesh.castShadow = true;
  root.add(mesh);

  // ---- THE SANDCASTLE. Its own mesh, because it has to be able to stop
  // existing, and a merged one cannot.
  {
    const S = manMerger();
    const x = 12, z = manSHORE_Z + 6.5;
    const h = manTerrain(x, z);
    S.box(x, h + 0.5, z, 2.6, 1.0, 2.6, PALETTE.manSandWet);
    for (let i = 0; i < 4; i++) {
      const dx = (i < 2 ? -1.1 : 1.1), dz = (i % 2 ? -1.1 : 1.1);
      S.cyl(x + dx, h + 1.35, z + dz, 0.42, 1.7, PALETTE.manSand, 0, 0, 0, 6);
      S.cone(x + dx, h + 2.35, z + dz, 0.5, 0.7, PALETTE.manSandWet, 0, 0, 0, 6);
    }
    S.box(x, h + 1.3, z, 1.4, 1.6, 1.4, PALETTE.manSand);
    S.cone(x, h + 2.45, z, 0.9, 1.0, PALETTE.manSandWet, 0, 0, 0, 6);
    manSandcastle = new THREE.Mesh(S.build(), manVC());
    manSandcastle.castShadow = true;
    manSandcastle.userData.at = { x: x, z: z, y: h };
    root.add(manSandcastle);

    // ---- AND WHAT IS LEFT OF IT AFTERWARDS ------------------------------
    // Built here and hidden, at the origin, so it can be dropped on the spot
    // the moment the castle goes: the keep slumped to a third of its height,
    // the four towers lying where they fell, and the moat still there, because
    // a moat is a hole and a hole survives being run through.
    const Rn = manMerger();
    Rn.box(0, 0.24, 0, 2.9, 0.46, 2.9, PALETTE.manSandWet, 0, 0.14, 0);
    Rn.box(0, 0.52, 0.1, 1.5, 0.34, 1.4, PALETTE.manSand, 0, 0.5, 0);
    for (let i = 0; i < 4; i++) {
      const a = i * 1.57 + 0.6, r = 1.5 + (i % 2) * 0.5;
      Rn.cyl(Math.cos(a) * r, 0.20, Math.sin(a) * r, 0.40, 0.85,
             PALETTE.manSand, 1.57, a + 0.4, 0, 6);
      Rn.cone(Math.cos(a) * (r + 0.7), 0.18, Math.sin(a) * (r + 0.7), 0.44, 0.6,
              PALETTE.manSandWet, 1.4, a, 0.3, 6);
    }
    manCastleRuin = new THREE.Mesh(Rn.build(), manVC());
    manCastleRuin.castShadow = true;
    manCastleRuin.receiveShadow = true;
    manCastleRuin.visible = false;
    root.add(manCastleRuin);
  }

  // ---- one pine cone, hidden until it is knocked down
  {
    const C = manMerger();
    C.sph(0, 0, 0, 0.22, 0.34, 0.22, PALETTE.manTrunk, 6);
    C.sph(0, 0.22, 0, 0.14, 0.18, 0.14, PALETTE.manPine, 6);
    manConeMesh = new THREE.Mesh(C.build(), manVC());
    manConeMesh.visible = false;
    manConeMesh.castShadow = true;
    root.add(manConeMesh);
  }
}

// ----------------------------------------------------------------- the flags --
/**
 * THE RED AND YELLOW FLAGS, AND THEY MOVE.
 *
 * Every swimmer on this beach is between them because a person in a yellow cap
 * decided where they should be that morning. Pick one up (E), walk somewhere
 * else, put it down (E), and the entire beach gets up and follows — which is
 * the largest consequence any single button press has in this game, and it
 * costs sixteen instanced matrices.
 *
 * Deliberately NOT a props.js prop. A prop is a thing with a mass and a body
 * that the physics owns; this is a pole in the sand that is either planted or
 * in a capybara's mouth, and giving it a rigid body would mean it could be
 * thrown into the sea and the beach would follow it there.
 */
function manBuildFlags(root) {
  for (let i = 0; i < 2; i++) {
    const M = manMerger();
    M.cyl(0, 1.3, 0, 0.055, 2.6, PALETTE.manPole, 0, 0, 0, 4);
    // the flag itself: half red, half yellow, on a diagonal, always
    M.box(0.62, 2.15, 0, 1.2, 0.42, 0.05, PALETTE.manFlagRed);
    M.box(0.62, 1.72, 0, 1.2, 0.44, 0.05, PALETTE.manFlagYel);
    const m = new THREE.Mesh(M.build(), manVC());
    m.castShadow = true;
    root.add(m);
    if (i === 0) manFlagA = m; else manFlagB = m;
  }
  manPlaceFlags();
}
function manPlaceFlags() {
  const h = manTerrain(manFlagX, manFlagZ);
  if (manFlagA) manFlagA.position.set(manFlagX - 5.5, h, manFlagZ);
  if (manFlagB) manFlagB.position.set(manFlagX + 5.5, h, manFlagZ);
}

// -------------------------------------------------------------- the surfboat --
/**
 * THE SURFBOAT. A KINEMATIC CARRIER, and every one of the seven rules applies.
 *
 * It is nine metres of clinker-built timber with four people in it and a
 * sweep on the back, and its entire purpose in life is to be rowed AT the
 * thing everybody else is swimming away from. It launches on its own clock
 * whether or not anybody is aboard — a rig that only moves when the player is
 * in it is a lift, not a festival.
 *
 * Vertical is ORDINARY CONTACT and not a biome-side write: the hull rises over
 * a wave at about two metres a second under an animal standing in it, which is
 * as honest a floor as this solver ever gets. See CONTRACT.md rule 6 — the
 * balloon needs the machinery because it rises at the animal's own rate; a
 * boat going over a swell does not.
 */
function manBuildBoat(game, root) {
  manBoatGroup = new THREE.Group();
  const M = manMerger();
  // the hull: a long shallow V, made of five tapering slabs so the sheer line
  // is a curve of creases rather than a plank
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const zz = -4.2 + t * 8.4;
    const wsh = 1.0 - Math.pow(Math.abs(t - 0.5) * 2, 2.1) * 0.62;
    M.box(0, 0.42, zz, 1.9 * wsh, 0.72, 1.05, PALETTE.manBoat);
    M.box(0, 0.86, zz, 1.95 * wsh, 0.14, 1.02, PALETTE.manBoatTrim);
  }
  M.cone(0, 0.55, -4.9, 0.85, 1.5, PALETTE.manBoat, Math.PI / 2, 0, 0, 6);
  M.cone(0, 0.55, 4.9, 0.8, 1.4, PALETTE.manBoat, -Math.PI / 2, 0, 0, 6);
  // thwarts, so there is somewhere to stand
  for (let i = 0; i < 4; i++) M.box(0, 0.78, -2.6 + i * 1.7, 1.6, 0.1, 0.4, PALETTE.manOar);
  // four rowers and a sweep, and none of them is going to notice a capybara.
  //
  // AND THEY ROW. A surfboat crew that holds its blades perfectly still while
  // the hull is driven at a breaking wave is four people in fancy dress, and it
  // was the single most obviously wrong thing in this chapter's best set piece.
  // The eight oars go into their OWN mesh, pivoted at the rowlocks, and the
  // whole assembly swings together — which is not a shortcut, it is what a
  // crew rowing in time actually looks like from thirty metres, and it is one
  // extra draw call rather than eight animated bones.
  const O = manMerger();
  for (let i = 0; i < 4; i++) {
    const zz = -2.6 + i * 1.7;
    // a torso, a head, and a cap — and the caps are the club's colours
    M.cyl(0, 1.28, zz, 0.3, 0.9, i % 2 ? PALETTE.manTowelB : PALETTE.manTowelA, 0, 0, 0, 6);
    M.sph(0, 1.88, zz, 0.28, 0.3, 0.28, PALETTE.manFlagYel, 6);
    M.box(0, 2.06, zz, 0.42, 0.07, 0.42, PALETTE.manClubTrim);
    for (let s = -1; s <= 1; s += 2) {
      // arms, out to the loom of the oar
      M.box(s * 0.36, 1.42, zz + 0.16, 0.5, 0.13, 0.13, PALETTE.manOar, 0, 0, s * 0.24);
      // the oars, and they are enormous. Authored about the rowlock at y 1.05.
      O.box(s * 1.9, 0.00, zz + 0.1, 0.14, 0.14, 4.6, PALETTE.manOar, 0.12, s * 0.30, 0);
      O.box(s * 3.2, -0.33, zz + 1.9, 0.1, 0.5, 1.1, PALETTE.manOar, 0.12, s * 0.30, 0);
    }
  }
  M.cyl(0, 1.35, 4.1, 0.3, 1.1, PALETTE.manTowelC, 0, 0, 0, 6);
  M.sph(0, 2.02, 4.1, 0.28, 0.3, 0.28, PALETTE.manFlagYel, 6);
  M.box(0, 2.20, 4.1, 0.42, 0.07, 0.42, PALETTE.manClubTrim);
  // the sweep oar, which is a rudder and is the reason the sweep stands up
  O.box(0, 0.15, 5.4, 0.13, 0.13, 3.4, PALETTE.manOar, 0.22, 0, 0);
  const mesh = new THREE.Mesh(M.build(), manVC());
  mesh.castShadow = true;
  manBoatGroup.add(mesh);
  const oars = new THREE.Mesh(O.build(), manVC());
  oars.castShadow = true;
  oars.position.y = 1.05;
  manBoatGroup.add(oars);
  manBoatGroup.userData.oars = oars;
  manBoatGroup.position.set(manBOAT_HOME.x, 0.55, manBOAT_HOME.z);
  root.add(manBoatGroup);

  manBoatBody = new CANNON.Body({
    mass: 0, type: CANNON.Body.KINEMATIC,
    material: (game.mats && game.mats.ground) || undefined,
  });
  // the FLOOR of the hull, which is the only part a passenger stands on, plus
  // two gunwales so a capybara cannot simply walk out of the side of it
  manBoatBody.addShape(new CANNON.Box(new CANNON.Vec3(0.95, 0.22, 4.4)),
                       new CANNON.Vec3(0, 0.62, 0));
  manBoatBody.addShape(new CANNON.Box(new CANNON.Vec3(0.16, 0.5, 4.4)),
                       new CANNON.Vec3(-1.05, 1.05, 0));
  manBoatBody.addShape(new CANNON.Box(new CANNON.Vec3(0.16, 0.5, 4.4)),
                       new CANNON.Vec3(1.05, 1.05, 0));
  manBoatBody.position.set(manBOAT_HOME.x, 0.55, manBOAT_HOME.z);
  // A SLEEPING BODY IS SKIPPED IN NARROWPHASE, and a floor that stops existing
  // under a passenger is the worst bug this game has.
  manBoatBody.allowSleep = false;
  manSyncBody(manBoatBody);
  game.world.addBody(manBoatBody);
}

// ------------------------------------------------------------- the bathers --
function manBuildBathers(root) {
  const M = manMerger();
  // THE HEAD MUST NOT BE THE SAME VALUE AS THE COSTUME, or every bather on the
  // beach reads as a skittle. An InstancedMesh multiplies its instance colour
  // BY the vertex colour, so a warm dark head stays darker than the body
  // whatever colour the towel-shop sold that one.
  //
  // AND A PERSON HAS LIMBS. One cylinder and one sphere is the shape of a
  // chess pawn, and next to npc.js's articulated cast — legs, torso, collar,
  // head, nose, two arms — a beach full of pawns is exactly the gap the second
  // pass over Sydney and Pasto was about. This is still ONE instanced draw
  // call; it is seven boxes instead of two primitives.
  M.box(-0.09, 0.28, 0, 0.15, 0.56, 0.17, 0x8a6a48);        // legs, darker than the costume
  M.box(0.09, 0.28, 0, 0.15, 0.56, 0.17, 0x8a6a48);
  M.box(0, 0.82, 0, 0.42, 0.54, 0.25, 0xffffff);            // the costume: takes the instance colour
  M.box(0, 1.10, 0, 0.44, 0.06, 0.27, 0xd8d0c0);            // a strap
  M.box(-0.27, 0.82, 0, 0.11, 0.50, 0.13, 0x9a7a58);        // arms
  M.box(0.27, 0.82, 0, 0.11, 0.50, 0.13, 0x9a7a58);
  M.sph(0, 1.27, 0, 0.115, 0.14, 0.12, 0x9a7a58, 6);        // head
  M.sph(0, 1.34, -0.02, 0.12, 0.09, 0.12, 0x4a3a2c, 6);     // and hair, so it has a front
  M.box(0, 1.26, 0.11, 0.04, 0.04, 0.04, 0x9a7a58);         // the nose. npc.js's trick.
  const g = M.build();
  manBathers = new THREE.InstancedMesh(g, manVC(), manBATHER_N);
  manBathers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  manBathers.castShadow = true;
  manBathers.frustumCulled = false;
  manBathX = new Float32Array(manBATHER_N);
  manBathZ = new Float32Array(manBATHER_N);
  manBathTX = new Float32Array(manBATHER_N);
  manBathTZ = new Float32Array(manBATHER_N);
  manBathPh = new Float32Array(manBATHER_N);
  manBathWet = new Float32Array(manBATHER_N);
  manBathCol = [PALETTE.manTowelA, PALETTE.manTowelB, PALETTE.manTowelC,
                PALETTE.manFlagYel, PALETTE.manAwning2, PALETTE.manTowelD];
  const ca = new Float32Array(manBATHER_N * 3);
  for (let i = 0; i < manBATHER_N; i++) {
    // deterministic rather than random, so a chapter you come back to has the
    // same fourteen people in the water it had the first time
    manBathWet[i] = (i % 3) === 2 ? 0 : 1;
    manBathPh[i] = rand(0, 6.28);
    manCol.set(manBathCol[i % manBathCol.length]);
    ca[i * 3] = manCol.r; ca[i * 3 + 1] = manCol.g; ca[i * 3 + 2] = manCol.b;
  }
  manBathers.instanceColor = new THREE.InstancedBufferAttribute(ca, 3);
  manScatterBathers(true);
  root.add(manBathers);
}
function manScatterBathers(snap) {
  for (let i = 0; i < manBATHER_N; i++) {
    // THE FLAGS ARE FIVE AND A HALF METRES EITHER SIDE OF manFlagX, and between
    // them is the only water anybody is allowed in. So the swimmers are laid
    // across that span and nowhere else — which is the rule the chapter is
    // about, drawn by the people obeying it.
    const wet = manBathWet[i] > 0.5;
    if (wet) {
      manBathTX[i] = manFlagX + rand(-4.6, 4.6);
      // in from the swash to about chest-deep, and never past the bank
      manBathTZ[i] = manSHORE_Z - rand(1.5, 13.0);
    } else {
      const a = (i / manBATHER_N) * Math.PI * 2;
      manBathTX[i] = manFlagX + Math.cos(a) * rand(3, 11) + rand(-1, 1);
      manBathTZ[i] = manFlagZ + rand(-2.0, 6.5);
    }
    if (snap) { manBathX[i] = manBathTX[i]; manBathZ[i] = manBathTZ[i]; }
  }
}

// ------------------------------------------------------------ the dolphins --
/**
 * THINGS THAT ARE SIMPLY THERE, no. 4.
 *
 * Manly gets dolphins in the face of a wave, which is a thing that genuinely
 * happens there and is the single best sight on that beach. They are on no
 * list, they cannot be ridden, robbed or completed, and — the rule that keeps
 * an ambient thing from becoming an irritation — they turn up on a long clock
 * and they do not announce themselves. Ninety-odd seconds apart, and they use
 * the wave the player is trying to catch, so the first time you see them you
 * are looking at the right part of the sea anyway.
 */
function manBuildDolphins(root) {
  const M = manMerger();
  M.sph(0, 0, 0, 0.42, 0.40, 1.35, PALETTE.manDolphin, 6);
  M.sph(0, -0.06, 0.5, 0.36, 0.30, 0.9, PALETTE.manDolphinPl, 6);
  M.cone(0, 0, -1.5, 0.24, 0.9, PALETTE.manDolphin, Math.PI / 2, 0, 0, 6);
  M.box(0, 0.42, 0.1, 0.10, 0.52, 0.5, PALETTE.manDolphin, 0.3);
  M.box(0, -0.02, 1.55, 0.9, 0.08, 0.35, PALETTE.manDolphin);
  manDolphins = new THREE.InstancedMesh(M.build(), manVC(), manDOLPH_N);
  manDolphins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  manDolphins.castShadow = true;
  manDolphins.frustumCulled = false;
  manDolphins.visible = false;
  root.add(manDolphins);
}

// ---------------------------------------------------------------- the gulls --
/**
 * THIRTY SILVER GULLS, AND THEY ARE ON NO LIST.
 *
 * Things that are simply there, and the rule that keeps them from becoming an
 * irritation: a long clock and no announcement. But these have a second job —
 * the chip-shop man's whole character is complaining about them, and a local
 * whose one line is about a thing that does not exist is the Venice seed man
 * again. So they LIVE on the Corso awnings, they come down onto the paving in
 * front of the counter every forty-odd seconds, and a wheek puts the lot of
 * them into the air at once.
 *
 * One instanced mesh, one box and two wings each, and the flap is a function of
 * whether the bird is on the ground — a standing gull is perfectly still and a
 * flying one is nothing but wings, and having both is most of the effect.
 */
const manGULL_N = 30;
let manGullMesh = null, manGullData = null;
// THE HERD and THE PERCH (N1): two short re-asked timers per gull. `held` is
// "this bird is following you, so it is on the ground and not up on its own
// awning"; `perch` is "it is on the capybara". Both see manUpdateGulls.
const manGullHeld  = new Float32Array(manGULL_N);
const manGullPerch = new Float32Array(manGULL_N);
let manGullUp = 0, manGullNext = 14;
const manGULL_HOME = { x: -13.5, z: 47.0 };
const manGULL_NEAR = 7;             // m — walk inside this and they go up
let manGullCrit = null;             // ...and the calm shrinks it. See THE CALM.
// the ledges they perch on, filled in by manBuildTown as it draws them
const manPerch = [];
/**
 * WHICH LEDGE BIRD `i` SITS ON, AND IT WAS STRIDING BY THREE.
 *
 * `((i * 3) % (manPerch.length / 3)) * 3` walks the list in steps of THREE
 * entries, and the list has twenty-one in it — gcd(3, 21) is 3, so the only
 * indices it can ever produce are 0, 3, 6, 9, 12, 15 and 18. Thirty gulls were
 * being sent to SEVEN points (the first parapet corner of each of the seven
 * shopfronts, four or five birds stacked in exactly the same place), and the
 * second parapet corner and the awning ridge of every shop — fourteen of the
 * twenty-one perches the build had gone to the trouble of recording — never
 * had a bird on them once. `i % entries` is the whole fix.
 */
function manPerchAt(i) {
  const n = manPerch.length / 3;
  return (((i % n) + n) % n) * 3;
}
/** ...and thirty birds on twenty-one ledges means nine doubles. Shuffle the
 *  second lap along the parapet rather than putting two gulls in one gull. */
function manPerchDX(i) {
  const n = manPerch.length / 3;
  return n > 0 ? ((i / n) | 0) * 0.62 : 0;
}
function manBuildGulls(root) {
  const M = manMerger();
  // WINGS FOLDED, NOT SPREAD. The first cut gave every gull a sixty-centimetre
  // span of flat plate — measured on a screenshot, a standing flock read as a
  // row of paper aeroplanes lying on the pavement, because a wing that is
  // spread is only ever right for the half of the time the bird is flying.
  // Folded along the body is right for BOTH: on the ground it is a gull, and in
  // the air the roll (see the flap below) is what Göreme's pigeons already use
  // and it reads from thirty metres, which is the only distance that matters.
  M.box(0, 0.06, 0, 0.13, 0.12, 0.30, PALETTE.manFoam);            // body
  M.box(-0.075, 0.07, -0.02, 0.05, 0.07, 0.26, PALETTE.manClubRoof);   // folded wings
  M.box(0.075, 0.07, -0.02, 0.05, 0.07, 0.26, PALETTE.manClubRoof);
  M.sph(0, 0.15, 0.13, 0.055, 0.06, 0.06, PALETTE.manFoam, 6);     // head
  M.box(0, 0.145, 0.21, 0.025, 0.025, 0.09, PALETTE.manBill);
  M.box(0, 0.055, -0.19, 0.09, 0.025, 0.11, PALETTE.manClubRoof);  // tail
  M.box(-0.035, 0, 0.02, 0.02, 0.09, 0.02, PALETTE.manBill);       // legs
  M.box(0.035, 0, 0.02, 0.02, 0.09, 0.02, PALETTE.manBill);
  manGullMesh = new THREE.InstancedMesh(M.build(), manVC(), manGULL_N);
  manGullMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  manGullMesh.frustumCulled = false;
  manGullMesh.castShadow = true;
  manGullData = new Float32Array(manGULL_N * 7);   // x,y,z, vx,vy,vz, phase
  for (let i = 0; i < manGULL_N; i++) {
    const o = i * 7;
    if (manPerch.length) {
      const o2 = manPerchAt(i);
      manGullData[o] = manPerch[o2] + manPerchDX(i);
      manGullData[o + 1] = manPerch[o2 + 1];
      manGullData[o + 2] = manPerch[o2 + 2];
    } else {
      manGullData[o] = manGULL_HOME.x + rand(-16, 16);
      manGullData[o + 1] = manPROM_Y + 3.05;
      manGullData[o + 2] = manGULL_HOME.z + rand(-3, 4);
    }
    manGullData[o + 6] = rand(0, 6.28);
  }
  root.add(manGullMesh);
}
function manUpdateGulls(game, dt) {
  if (!manGullMesh) return;
  const capy = game.capy;
  manGullNext -= dt;
  if (manGullNext <= 0) {
    // they come down for the chips, and they go back up when nothing happens
    manGullNext = rand(26, 48);
    manGullUp = manGullUp > 0.5 ? 0 : 0.35;
  }
  // a capybara that walks into the middle of them puts them up, and so does a
  // wheek — which is the only reason the chip-shop man's line is true
  if (!manGullCrit && typeof game.addCritter === 'function') {
    // bold 0.9: a Corso gull that has decided you are not a threat is standing
    // on your feet inside ten seconds, which is what a Corso gull is for. The
    // registry takes `near` to nothing on its own, so putting the birds up by
    // walking into them stops happening while you are sat down — and the WHEEK
    // path below is untouched and still reaches thirty-four metres, so the one
    // thing this chapter asks you to do with the gulls is unaffected either
    // way. See THE LOAF in systems.js.
    manGullCrit = game.addCritter({ biome: 'manly', r: manGULL_NEAR, bold: 0.9 });
    // ---- ...AND THEY WILL FOLLOW YOU, FOR A PRICE (see THE HERD) ---------
    // obey 2. A silver gull will mug a stranger for a chip without being asked
    // at all, and will not walk anywhere for anybody without being asked
    // twice — which is a different animal from a St Mark's pigeon and is why
    // the tier is not the same. Only the ones on the ground: a gull that is
    // already up is flying, and `manGullData[o + 4]` is its own vertical
    // velocity, so a bird in the air is left entirely alone.
    if (typeof game.herdOffer === 'function') {
      game.herdOffer({
        biome: 'manly', kind: 'silver gull', obey: 2, voice: 'gull', pitch: 1.15,
        count: function () { return manGULL_N; },
        at: function (i, o) {
          const q = i * 7;
          o.x = manGullData[q]; o.y = manGullData[q + 1]; o.z = manGullData[q + 2];
        },
        // ---- THE HEIGHT TEST WAS THE WRONG QUESTION, AND THIS FILE SAYS SO
        //
        // MEASURED 8 Sep 2026 (`qa/n1-perch.js`): ten gulls recruited on two
        // wheeks and then stood on their parapets for the whole run, `near`
        // 30.9 m and never falling. `manGullData[q + 1] > manPROM_Y + 0.6` is
        // TRUE for every gull on an awning — that is what an awning is — so
        // `put` returned early for all of them and a led gull could not be
        // moved a centimetre. The herd registered, the birds joined, and
        // nothing walked.
        //
        // The note forty lines below, on the draw, already had the answer:
        // "A PERCHED GULL IS FIVE METRES UP. Testing height for 'is it flying'
        // makes every bird on a shop parapet flap on the spot for ever; the
        // state is `up`, and the state is what has to be asked." The draw
        // learnt it; these two writers did not.
        // ...AND A PASSENGER IS NOT PART OF THE TAKE-OFF. `manGullUp` goes to 1
        // whenever the animal comes near the Corso, which during a walk is most
        // of the time — measured 8 Sep, a perched gull's position error climbed
        // 1.35 m, 3.35, 5.35, 7.35, 9.35 over four seconds of walking, at
        // exactly the walking speed, because `put` was refusing to write it
        // while `lift` went on writing its height. A gull on your back is not
        // in the wheel.
        put: function (i, x, z) {
          if (manGullUp > 0.5 && manGullPerch[i] <= 0) return;   // flying: leave it
          const q = i * 7;
          manGullHeld[i] = 0.25;                    // ...and off the awning
          manGullData[q] = x; manGullData[q + 2] = z;
        },
        // A SILVER GULL ON A CAPYBARA, outside a chip shop, is the most
        // Australian frame in this game. One seat: it is a small bird.
        // See THE PERCH in systems.js.
        span: 1,
        lift: function (i, y) {
          const q = i * 7;
          manGullHeld[i] = 0.25;
          manGullPerch[i] = 0.25;      // re-asked every frame — see manUpdateGulls
          manGullData[q + 1] = y;
        },
        // ---- ...AND ONE OF THEM MAY LEAVE THE BEACH (N3 → L6, F1) --------
        // See THE COMPANION in systems.js, which draws its own gull. A silver
        // gull that has worked out it can be carried is the most in-character
        // thing any animal in this game does.
        travels: true,
      });
    }
    // ---- ...AND THIS IS THE CHAPTER WITH THE CHIP SHOP IN IT -------------
    // See THE FLOCK in systems.js. Thirty silver gulls have stood on the
    // parapet above a chip shop for twenty versions, in a chapter whose second
    // task is about chips, and not one of them has ever noticed a dropped one.
    // Same three functions as the herd, because it is the same question.
    //
    // `scare` is the chapter's own take-off written as a call: putting them up
    // was reachable by standing near them or by wheeking, and never by running
    // through them, which is the one thing that ought to.
    if (typeof game.flockOffer === 'function') {
      game.flockOffer({
        biome: 'manly', kind: 'silver gull', voice: 'gull', pitch: 1.5, fleeR: 7.5,
        count: function () { return manGULL_N; },
        at: function (i, o) {
          const q = i * 7;
          o.x = manGullData[q]; o.y = manGullData[q + 1]; o.z = manGullData[q + 2];
        },
        // Same wrong question as the herd's, above, and the same answer: a bird
        // on an awning is not flying, it is five metres up. Nothing had ever
        // walked to a dropped chip either.
        put: function (i, x, z) {
          if (manGullUp > 0.5) return;
          const q = i * 7;
          manGullHeld[i] = 0.25;
          manGullData[q] = x; manGullData[q + 2] = z;
        },
        scare: function () {
          if (manGullUp > 0.5) return 0;
          manGullUp = 1;
          return manGULL_N;
        },
        // The come-down above, called by something that is actually a chip.
        land: function () { if (manGullUp < 0.02) manGullUp = 0.35; },
      });
    }
  }
  if (capy && capy.position) {
    const d = Math.hypot(capy.position.x - manGULL_HOME.x, capy.position.z - manGULL_HOME.z);
    // Seven metres, unless you have been standing still — in which case they
    // will let you stand in the middle of them. The WHEEK path below is
    // untouched and still reaches thirty-four metres, so the one thing in this
    // chapter a player is asked to do with the gulls cannot be made harder by
    // being calm. See THE CALM in systems.js.
    if (d < (manGullCrit ? manGullCrit.near : manGULL_NEAR) && manGullUp < 0.5) manGullUp = 1;
    // THE WHEEK REACHES FURTHER THAN THE CAPYBARA DOES, which is the whole
    // point of having one, and thirty gulls going up off a shopfront is the
    // largest thing in this chapter that one button can cause on dry land.
    if (game.input && game.input.honkPressed && d < 34 && manGullUp < 0.9) {
      manGullUp = 1;
      manSfx.volume = clamp(0.34 - d * 0.006, 0.06, 0.34);
      manSfx.pitch = rand(1.5, 1.9);
      game.sfx('gull', manSfx);
    }
  }
  const up = manGullUp;
  if (up > 0.5) manGullUp = Math.max(0.5, manGullUp - dt * 0.10);   // ~5 s in the air
  else if (up > 0.02) manGullUp = Math.max(0, manGullUp - dt * 0.02);
  for (let i = 0; i < manGULL_N; i++) {
    const o = i * 7;
    const ph = manGullData[o + 6];
    // ---- ...UNLESS IT IS ON THE CAPYBARA (N1) ---------------------------
    // Every branch below damps this bird toward a target — a parapet, a wheel
    // over the Corso, a spot on the sand — and a passenger has no target but
    // the animal's back. Skipped entirely; systems.js has already written x, y
    // and z. `manGullPerch` is re-asked every frame by `lift` on the herd
    // offer. See THE PERCH in systems.js.
    if (manGullPerch[i] > 0) {
      manGullPerch[i] = Math.max(0, manGullPerch[i] - dt);
      manM.compose(manV3.set(manGullData[o], manGullData[o + 1], manGullData[o + 2]),
                   manQ.setFromEuler(manE.set(0, Math.sin(manTime * 0.4 + ph) * 0.5, 0)),
                   manSc.set(1, 1, 1));
      manGullMesh.setMatrixAt(i, manM);
      continue;
    }
    let tx, ty, tz;
    // ---- A LED GULL IS ON THE GROUND (N1) -------------------------------
    // With the height test out of `put` (see the herd offer above) a recruited
    // gull's x and z are written every frame — and every branch below would
    // still be damping its Y back up onto the awning it started on, which is a
    // bird walking behind you eight metres in the air. `manGullHeld` is set by
    // `put` and re-asked every frame, exactly like the perch timer.
    if (manGullHeld[i] > 0) {
      manGullHeld[i] = Math.max(0, manGullHeld[i] - dt);
      tx = manGullData[o]; tz = manGullData[o + 2];
      ty = manTerrain(tx, tz) + 0.06;
    } else if (up > 0.5) {
      // a loose wheel over the Corso, each bird on its own radius
      const a = manTime * (0.7 + (i % 5) * 0.09) + ph;
      const r = 7 + (i % 7) * 2.4;
      tx = manGULL_HOME.x + Math.cos(a) * r;
      tz = manGULL_HOME.z - 5 + Math.sin(a) * r * 0.6;
      ty = manPROM_Y + 7 + Math.sin(a * 1.7 + ph) * 2.2;
    } else if (up > 0.02) {
      tx = manGULL_HOME.x + Math.sin(ph * 3.1) * 5.5;
      tz = manGULL_HOME.z - 6.5 + Math.cos(ph * 2.3) * 1.8;
      ty = manPROM_Y + 0.06;
    } else if (manPerch.length) {
      // back on the awnings and the shop parapets, and on the ones that are
      // actually there — see manPerch and manPerchAt
      const o2 = manPerchAt(i);
      tx = manPerch[o2] + manPerchDX(i); ty = manPerch[o2 + 1]; tz = manPerch[o2 + 2];
    } else {
      tx = manGULL_HOME.x + Math.sin(ph * 5.7) * 17;
      tz = manGULL_HOME.z + 0.6;
      ty = manPROM_Y + 3.05;
    }
    const k = 1 - Math.exp(-(up > 0.5 ? 2.6 : 1.5) * dt);
    manGullData[o] += (tx - manGullData[o]) * k;
    manGullData[o + 1] += (ty - manGullData[o + 1]) * k;
    manGullData[o + 2] += (tz - manGullData[o + 2]) * k;
    // A PERCHED GULL IS FIVE METRES UP. Testing height for "is it flying"
    // makes every bird on a shop parapet flap on the spot for ever; the state
    // is `up`, and the state is what has to be asked.
    const flying = up > 0.5;
    const flap = flying ? Math.sin(manTime * 11 + ph) * 0.55 : 0;
    const yaw = flying ? Math.atan2(tx - manGullData[o], tz - manGullData[o + 2])
                       : Math.sin(manTime * 0.4 + ph) * 1.4;
    manM.compose(manV3.set(manGullData[o], manGullData[o + 1], manGullData[o + 2]),
                 manQ.setFromEuler(manE.set(0, yaw, flap)),
                 manSc.set(1, 1, 1));
    manGullMesh.setMatrixAt(i, manM);
  }
  manGullMesh.instanceMatrix.needsUpdate = true;
}

// ---------------------------------------------------------- the buoy line --
const manBUOY_N = 11;
let manBuoyMesh = null;
const manBuoyX = new Float32Array(manBUOY_N);
function manBuildBuoys(root) {
  const M = manMerger();
  M.sph(0, 0, 0, 0.40, 0.34, 0.40, PALETTE.manFlagYel, 6);
  M.cyl(0, 0.30, 0, 0.06, 0.62, PALETTE.manPole, 0, 0, 0, 4);
  M.box(0.24, 0.52, 0, 0.46, 0.26, 0.04, PALETTE.manFlagRed);
  M.cyl(0, -0.24, 0, 0.10, 0.5, PALETTE.manRockDk, 0, 0, 0, 4);
  manBuoyMesh = new THREE.InstancedMesh(M.build(), manVC(), manBUOY_N);
  manBuoyMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  manBuoyMesh.frustumCulled = false;
  manBuoyMesh.castShadow = true;
  for (let i = 0; i < manBUOY_N; i++) manBuoyX[i] = -58 + i * 11.6;
  root.add(manBuoyMesh);
}
function manUpdateBuoys() {
  if (!manBuoyMesh) return;
  for (let i = 0; i < manBUOY_N; i++) {
    const x = manBuoyX[i];
    const z = -62 + Math.sin(x * 0.05) * 2.2;
    manWaveAt(x, z, manTime, manWave);
    // it is MOORED, so it does not run with the wave — it leans into the face
    // and comes up over the back, which is exactly the tell that says the
    // water out there is moving at all.
    manM.compose(manV3.set(x, manWave.y + 0.10, z),
                 manQ.setFromEuler(manE.set(manWave.face * 0.55, Math.sin(x) * 0.7,
                                            manWave.face * 0.18)),
                 manSc.set(1, 1, 1));
    manBuoyMesh.setMatrixAt(i, manM);
  }
  manBuoyMesh.instanceMatrix.needsUpdate = true;
}

function manBuildPelican(root) {
  const M = manMerger();
  M.sph(0, 0.5, 0, 0.42, 0.38, 0.72, PALETTE.manPelican, 6);
  M.box(0, 0.62, -0.55, 0.5, 0.34, 0.4, PALETTE.manPelicanBk);
  M.cyl(0, 0.92, 0.28, 0.13, 0.7, PALETTE.manPelican, 0.34, 0, 0, 6);
  M.sph(0, 1.22, 0.42, 0.2, 0.19, 0.24, PALETTE.manPelican, 6);
  M.cone(0, 1.10, 0.86, 0.16, 0.95, PALETTE.manBill, Math.PI / 2 + 0.24, 0, 0, 4);
  M.cyl(-0.13, 0.2, 0.05, 0.05, 0.42, PALETTE.manBill, 0, 0, 0, 4);
  M.cyl(0.13, 0.2, 0.05, 0.05, 0.42, PALETTE.manBill, 0, 0, 0, 4);
  manPelican = new THREE.Mesh(M.build(), manVC());
  manPelican.castShadow = true;
  manPelican.position.set(manPOOL.x1 + 1.1, manPOOL.wall + 0.9, manPOOL.z0 + 3);
  root.add(manPelican);
}

function manBuildGroper(root) {
  // THE BLUE GROPER. Everybody at Shelly knows him, he is a metre long, he is
  // an unbelievable colour, and he will come and look at you.
  const M = manMerger();
  M.sph(0, 0, 0, 0.42, 0.5, 0.95, PALETTE.manGroper, 8);
  M.sph(0, 0.06, 0.72, 0.34, 0.38, 0.4, PALETTE.manGroper, 6);
  M.box(0, 0.02, 0.98, 0.28, 0.16, 0.24, PALETTE.manRockDk);
  M.cone(0, 0, -1.15, 0.42, 0.7, PALETTE.manGroper, Math.PI / 2, 0, 0, 4);
  M.box(0, 0.46, -0.1, 0.06, 0.4, 0.9, PALETTE.manGroper, 0.2);
  M.box(-0.4, -0.1, 0.25, 0.42, 0.06, 0.34, PALETTE.manGroper, 0, 0, -0.3);
  M.box(0.4, -0.1, 0.25, 0.42, 0.06, 0.34, PALETTE.manGroper, 0, 0, 0.3);
  manGroper = new THREE.Mesh(M.build(), manVC());
  manGroper.position.set(manSHELLY.x - 8, -1.2, manSHELLY.z + 2);
  root.add(manGroper);
}

// ------------------------------------------------------------- foam streaks --
/**
 * A HUNDRED AND FIFTY STREAKS OF FOAM, ADVECTED BY THE REAL FLOW FIELD.
 *
 * The Uji taught this: an animal on a featureless surface with a chasing
 * camera has NO VISIBLE SPEED AT ALL. It is also the cheapest instruction this
 * chapter has — because the streaks ride the same field the player does, they
 * DRAW the fast line. Where they pile up is where the push is; where they run
 * seaward in a neat lane is the rip, and nobody had to be told.
 */
// ------------------------------------------------------------------ the barrel --
/**
 * THE LIP COMES OVER (W1).
 *
 * The carve (D4.11) let a rider hold the face instead of pointing at the
 * sand, and nothing in the picture said so: a diagonal ride looked like a
 * straight one from three metres further along. A wave held on its face
 * curls over the rider — that is what a face IS — so this is the lip: an arc
 * of foam, twelve metres along the crest, standing up behind the animal and
 * throwing over the top of it, present only while the ride is on the face
 * and gone (scaled to nothing) the moment it is not. Spray comes off the
 * lip, the sea's hiss comes in close, and the paper says IN THE BARREL with
 * the seconds. Not a task: it is what a good ride looks like.
 */
let manBarrelG = null, manBarrel = 0, manBarrelT = 0, manBarrelHiss = 0, manBarrelBest = 0;
let manBarrelForce = false;   // test hook: barrelDebug(true) stands the lip up wherever the animal is
// ---- THE BARREL IS A MOMENT, AND THE SAND IS A FRAME (L5) --------------------
// The barrel was the best thing on the beach and it was a hiss and a toast.
// Two seconds inside and the lens comes round to the wave's flank, close,
// with the lip over the animal, the world at 0.6x, spray off the face; the
// toast on the way out says the best. And the ride that makes the sand is
// SEEN from the sand: the lens ahead of the animal on the beach looking back
// at it and the wave behind, which is the photograph every surf beach has.
const manBARREL_BEAT = 2.0;   // s inside before it is a moment
let manBarrelBeat = false;
function manBuildBarrel(root) {
  const g = new THREE.Group();
  const M = manMerger();
  // the arc: centre 1.35 m up and 0.6 m seaward of the rider, radius 2.0,
  // from the water behind (seaward, -z) up and over toward the beach (+z)
  const R = 2.2, N = 12;
  for (let i = 0; i < N; i++) {
    // THE LIP ONLY. The face under it is the sea mesh's own; drawing a back
    // wall here put a sheet of foam between the chase camera and the animal
    // (measured: the rider seen through a slab). So the arc starts above and
    // behind the rider's head and curls over to hang ahead — the part of a
    // barrel you look up at — and never comes down to the water.
    const a0 = Math.PI * 0.70, a1 = Math.PI * 0.26;
    const a = a0 + (a1 - a0) * (i + 0.5) / N;
    const cz = -0.6 + Math.cos(a) * R, cy = 1.1 + Math.sin(a) * R;
    const thick = 0.20 + (1 - i / N) * 0.18;
    M.box(0, cy, cz, 12.5 - i * 0.5, thick, ((a0 - a1) * R / N) * 1.12, PALETTE.manFoam, -a - Math.PI / 2, 0, 0);
  }
  // the shoulders: the lip is highest over the rider and drops away along the crest
  const mesh = new THREE.Mesh(M.build(), mat(PALETTE.manFoam, { transparent: true, opacity: 0.74, depthWrite: false }));
  mesh.renderOrder = 4;
  mesh.castShadow = false;
  g.add(mesh);
  g.scale.setScalar(0.001);
  g.visible = false;
  manBarrelG = g;
  root.add(g);
}
function manUpdateBarrel(game, dt, p, riding, speed) {
  if (!manBarrelG) return;
  const carveShare = manRideDist > 4 ? manCarveDist / manRideDist : 0;
  const want = (manBarrelForce || (riding && manTookOff && carveShare > 0.38 && manWave.foam > 0.45 && speed > 4.2)) ? 1 : 0;
  manBarrel = damp(manBarrel, want, want ? 3.5 : 5.0, dt);
  const on = manBarrel > 0.02;
  if (on !== manBarrelG.visible) manBarrelG.visible = on;
  if (!on) {
    if (manBarrelT > 1.0) {
      const pb = manBarrelT > manBarrelBest;
      if (pb) manBarrelBest = manBarrelT;
      if (typeof game.toast === 'function') game.toast('a barrel · ' + manBarrelT.toFixed(1) + ' s' + (pb && manBarrelBest > manBarrelT + 0.01 ? '' : pb ? ' · your longest' : ' · best ' + manBarrelBest.toFixed(1)));
      game.sfx('cheer', { volume: 0.5, pitch: 1.1, force: true });
    }
    manBarrelT = 0; manBarrelBeat = false;
    return;
  }
  manBarrelG.position.set(p.x, manWave.y, p.z);
  manBarrelG.scale.set(manBarrel, manBarrel, manBarrel);
  if (manBarrel > 0.6) {
    // the lip closes over (L9): the first frame inside is held at half speed
    if (manBarrelT === 0 && typeof game.slowmo === 'function') game.slowmo(0.5, 1.3);
    manBarrelT += dt;
    manBarrelHiss -= dt;
    if (manBarrelHiss <= 0) {
      manBarrelHiss = 0.5;
      game.sfx('hiss', { volume: 0.32, pitch: 0.7, force: true });
    }
    if (Math.random() < dt * 14) manPuffSpray(p.x + rand(-4, 4), manWave.y + 3.0, p.z + 0.8, 2, 0.6);
    // THE BARREL IS A MOMENT (L5): two seconds in, the lens on the flank under the lip
    if (!manBarrelBeat && manBarrelT > manBARREL_BEAT) {
      manBarrelBeat = true;
      const v = game.capy && game.capy.velocity;
      const heading = v && (Math.abs(v.x) + Math.abs(v.z)) > 0.5 ? Math.atan2(v.x, v.z) : 0;
      if (typeof game.slowmo === 'function') game.slowmo(0.6, 0.9);
      if (typeof game.frameShot === 'function') game.frameShot({ yaw: heading + Math.PI * 0.5, dist: 9, pitch: 3 * Math.PI / 180, raise: 0.6, hold: 1.8, near: true });
      if (typeof game.sparks === 'function') game.sparks(p.x, manWave.y + 2.2, p.z, 30, { spd: 4, up: 2, grav: 9, drag: 0.6, life: 1.0, size: 0.26, rgb: [1.2, 1.45, 1.7] });
      if (game.music && typeof game.music.swell === 'function') game.music.swell(0.8);
      if (typeof game.toast === 'function') game.toast('INSIDE. the lip is over you.');
    }
    if (typeof game.wowLive === 'function' &&
        !(typeof game.taskDone === 'function' && game.taskDone('all-the-way'))) {
      game.wowLive('IN THE BARREL · ' + manBarrelT.toFixed(1) + ' s · ' + manRideDist.toFixed(0) + ' m of ' + manALL_THE_WAY,
                   clamp(manRideDist / manALL_THE_WAY, 0, 1));
    }
  }
}

function manBuildFoam(root) {
  const M = manMerger();
  M.box(0, 0, 0, 1, 0.06, 1, PALETTE.manFoam);
  manFoamMesh = new THREE.InstancedMesh(M.build(),
    mat(PALETTE.manFoam, { transparent: true, opacity: 0.34, depthWrite: false }), manFOAM_N);
  manFoamMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  manFoamMesh.frustumCulled = false;
  manFoamMesh.renderOrder = 3;
  manFoamX = new Float32Array(manFOAM_N);
  manFoamZ = new Float32Array(manFOAM_N);
  manFoamLife = new Float32Array(manFOAM_N);
  manFoamScale = new Float32Array(manFOAM_N);
  for (let i = 0; i < manFOAM_N; i++) manRespawnFoam(i, true);
  root.add(manFoamMesh);
}
function manRespawnFoam(i, initial) {
  manFoamX[i] = rand(manBEACH_X0 - 8, manPOINT_X + 4);
  manFoamZ[i] = initial ? rand(-40, manSHORE_Z) : rand(-38, -18);
  manFoamLife[i] = 0;
  manFoamScale[i] = rand(1.6, 4.2);
}

function manBuildSpray(root) {
  const M = manMerger();
  M.sph(0, 0, 0, 0.5, 0.5, 0.5, PALETTE.manSpray, 6);
  manSprayMesh = new THREE.InstancedMesh(M.build(),
    mat(PALETTE.manSpray, { transparent: true, opacity: 0.8, depthWrite: false }), manSPRAY_N);
  manSprayMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  manSprayMesh.frustumCulled = false;
  manSprayMesh.renderOrder = 4;
  manSprayX = new Float32Array(manSPRAY_N);
  manSprayY = new Float32Array(manSPRAY_N);
  manSprayZ = new Float32Array(manSPRAY_N);
  manSprayVX = new Float32Array(manSPRAY_N);
  manSprayVY = new Float32Array(manSPRAY_N);
  manSprayVZ = new Float32Array(manSPRAY_N);
  manSprayT = new Float32Array(manSPRAY_N);
  root.add(manSprayMesh);
}
// ------------------------------------------------------------ the lip haze --
/**
 * THE MIST THAT HANGS OVER A SHOREBREAK, AND WHY IT IS NOT SPRAY.
 *
 * Spray is ballistic — it goes up, it comes down, it lasts a second. The other
 * thing every surf photograph has is a low, wide, standing HAZE along the break
 * line: fifty metres of half-transparent white sitting a metre and a half over
 * the white water, put there by a hundred waves rather than by this one. It
 * cannot be made of particles at any sane count.
 *
 * So it is thirty-two flat quads laid along the crest of whichever wave is
 * breaking hardest, each one sampling the real break at its own x — so the
 * haze bends round the bank exactly the way the crest does, thickens where the
 * wave is tripping and vanishes where it is not, and costs one draw call and
 * sixty-four triangles.
 *
 * FLAT, NOT UPRIGHT. A vertical billboard needs to face the camera and a
 * horizontal one does not, and from a lens six metres up looking down at
 * thirty-five degrees a flat sheet at the right height reads as haze from
 * every bearing. The same argument as a ground decal, one metre in the air.
 */
const manHAZE_N = 32;
let manHazeMesh = null;
function manBuildHaze(root) {
  const g = new THREE.PlaneGeometry(1, 1);
  g.rotateX(-Math.PI / 2);
  manHazeMesh = new THREE.InstancedMesh(g,
    mat(PALETTE.manFoam, { transparent: true, opacity: 0.30, depthWrite: false }), manHAZE_N);
  manHazeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  manHazeMesh.frustumCulled = false;
  manHazeMesh.renderOrder = 5;
  // allocated up front rather than lazily by setColorAt, so the first frame is
  // not the one frame where every sheet is full strength
  manHazeMesh.instanceColor =
    new THREE.InstancedBufferAttribute(new Float32Array(manHAZE_N * 3), 3);
  manHazeMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  root.add(manHazeMesh);
}
function manUpdateHaze(dt) {
  if (!manHazeMesh) return;
  let live = 0;
  for (let i = 0; i < manHAZE_N; i++) {
    const x = -96 + (i / (manHAZE_N - 1)) * 192;
    // find the break at this x by walking shoreward from the bank: the crest
    // that is tripping is within twenty metres of the bar by definition
    let bestZ = 0, best = 0;
    const bz = manBankZ(x);
    for (let k = -4; k <= 8; k++) {
      const z = bz + k * 4;
      manWaveAt(x, z, manTime, manWave);
      if (manWave.foam > best) { best = manWave.foam; bestZ = z; }
    }
    if (best < 0.30) {
      manM.makeScale(0, 0, 0);
      manM.setPosition(0, -900, 0);
    } else {
      const s = clamp((best - 0.30) / 0.55, 0, 1);
      manWaveAt(x, bestZ, manTime, manWave);
      manM.makeScale(9.0, 1, 5.5 + s * 5.0);
      // the haze DRIFTS SHOREWARD off the lip and it sits over the white
      manM.setPosition(x, manWave.y + 0.9 + s * 0.7, bestZ + 3.5);
      // fade with the break, in the instance colour rather than the material,
      // so one sheet can be thick and its neighbour nothing
      manHazeMesh.setColorAt(i, manCol.setScalar(0.30 + s * 0.70));
      live++;
    }
    manHazeMesh.setMatrixAt(i, manM);
  }
  manHazeMesh.instanceMatrix.needsUpdate = true;
  if (manHazeMesh.instanceColor) manHazeMesh.instanceColor.needsUpdate = true;
  manHazeMesh.visible = live > 0;
}

function manPuffSpray(x, y, z, n, up) {
  for (let k = 0; k < n; k++) {
    const i = manSprayNext = (manSprayNext + 1) % manSPRAY_N;
    manSprayX[i] = x + rand(-1.2, 1.2);
    manSprayY[i] = y + rand(0, 0.5);
    manSprayZ[i] = z + rand(-1.0, 1.0);
    manSprayVX[i] = rand(-2.2, 2.2);
    manSprayVY[i] = rand(1.5, 4.5) * up;
    manSprayVZ[i] = rand(-1.4, 2.6);
    manSprayT[i] = rand(0.55, 1.1);
  }
}

// ------------------------------------------------------------------ the sea --
function manBuildWater(root) {
  // 1. THE OUTER OCEAN, AND IT IS THREE PLANES RATHER THAN ONE, WHICH COST AN
  //    HOUR TO WORK OUT.
  //
  //    The obvious build is a single enormous plane at the still-water level
  //    with the live surf mesh laid over it. It renders as a completely flat
  //    sea with the crests of the swell poking through it and nothing else,
  //    and the reason is embarrassingly simple: a TROUGH is below the still
  //    water level, so wherever the live surface dips the flat plane is ON TOP
  //    OF IT and you are looking at a uniform sheet of manSea. Half of every
  //    wave was being painted out by its own backdrop. Invisible in the code,
  //    unmistakable in a screenshot, and no amount of renderOrder fixes it —
  //    they are both opaque and the depth test is doing exactly its job.
  //
  //    So the flat water is cut around the live water instead: far, west and
  //    east of it, and never under it.
  const seaMat = grain(mat(PALETTE.manSea), {
    scale: 0.12, amount: 0.045, warp: 0,
    sparkle: 0.5, sparkleScale: 0.55, sparkleSpeed: 0.3,
    sparkleCut: 0.66, sparkleBand: 0.1, sparkleColor: 0xeaf6ff, fresnel: 0.65,
  });
  const seaPanels = [
    [0, -800, 1600, 1444],        // out to the horizon, seaward of the surf mesh
    [-450, -300, 700, 680],       // west of it, past Queenscliff
    [450, -300, 700, 680],        // and east, past North Head
  ];
  for (let i = 0; i < seaPanels.length; i++) {
    const s = seaPanels[i];
    const g = new THREE.PlaneGeometry(s[2], s[3], 1, 1);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, seaMat);
    m.position.set(s[0], manWATER - 0.05, s[1]);
    m.renderOrder = 1;
    root.add(m);
  }

  // 2. THE OCEAN POOL. Flat, and pointedly so.
  {
    const P = manPOOL;
    const g = new THREE.PlaneGeometry(P.x1 - P.x0, P.z1 - P.z0, 6, 4);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, grain(mat(PALETTE.manPoolWater, { transparent: true, opacity: 0.86 }), {
      scale: 0.9, amount: 0.08, warp: 0,
      // A POOL IS THE CALMEST WATER IN THE CHAPTER AND IT WAS THE BRIGHTEST.
      // At cut 0.58 the whole rectangle was under a solid crust of white —
      // measured from the point — which is the exact opposite of the thing
      // the pool is here to be: flat water, ten metres from water that is not.
      sparkle: 0.48, sparkleScale: 3.0, sparkleSpeed: 0.25,
      sparkleCut: 0.70, sparkleBand: 0.09, sparkleColor: 0xffffff,
    }));
    m.position.set((P.x0 + P.x1) * 0.5, P.y, (P.z0 + P.z1) * 0.5);
    m.renderOrder = 2;
    root.add(m);
  }

  // 3. THE SURF ZONE, and it is the only mesh in this game that is rebuilt
  //    every frame. 2.5 m cells over 200 x 104 m: 3 400 vertices, one cosine
  //    each, and every per-column constant is precomputed at build time so the
  //    inner loop does not touch a single transcendental it does not have to.
  const X0 = -100, X1 = 100, Z0 = -78, Z1 = 30, EL = 2.5;
  manSurfNX = Math.round((X1 - X0) / EL) + 1;
  manSurfNZ = Math.round((Z1 - Z0) / EL) + 1;
  manSurfX0 = X0; manSurfZ0 = Z0; manSurfStep = EL;
  const g = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0, manSurfNX - 1, manSurfNZ - 1);
  g.rotateX(-Math.PI / 2);
  g.translate((X0 + X1) * 0.5, 0, (Z0 + Z1) * 0.5);
  const n = g.attributes.position.count;
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  manSurfPos = g.attributes.position;
  manSurfCol = g.attributes.color;
  manSurfPos.setUsage(THREE.DynamicDrawUsage);
  manSurfCol.setUsage(THREE.DynamicDrawUsage);
  // PlaneGeometry rows run +z after the rotate, so vertex (i, j) is at
  // index j * NX + i with x = X0 + i*EL and z = Z0 + j*EL. Verified against
  // the attribute rather than assumed: getting this backwards draws the whole
  // sea running the wrong way and is invisible in a still.
  manColBend = new Float32Array(manSurfNX);
  manColShelt = new Float32Array(manSurfNX * manSurfNZ);
  manColRip = new Float32Array(manSurfNX);
  for (let i = 0; i < manSurfNX; i++) {
    const x = X0 + i * EL;
    manColBend[i] = manBankZ(x);
    manColRip[i] = manRipK(x);
    for (let j = 0; j < manSurfNZ; j++) {
      manColShelt[j * manSurfNX + i] = manShelter(x, Z0 + j * EL);
    }
  }
  manSurfMesh = new THREE.Mesh(g, manVCW());
  manSurfMesh.frustumCulled = false;
  manSurfMesh.renderOrder = 2;
  manSurfMesh.receiveShadow = false;
  root.add(manSurfMesh);
  manUpdateSurface(0);
}

const manSeaDeep = new THREE.Color(PALETTE.manSea);
const manSeaMid = new THREE.Color(PALETTE.manSeaMid);
const manSeaShal = new THREE.Color(PALETTE.manSeaShal);
const manFaceC = new THREE.Color(PALETTE.manFace);
const manFoamC = new THREE.Color(PALETTE.manFoam);
const manFoamDimC = new THREE.Color(PALETTE.manFoamDim);
const manSandDryC = new THREE.Color(PALETTE.manSand);
const manSandWetC = new THREE.Color(PALETTE.manSandWet);
// The sun through the back of a breaking crest. Over 1.0 on the green channel
// on purpose — see the note at the use site.
const manLipC = new THREE.Color(0.62, 1.18, 1.12);

function manUpdateSurface(dt) {
  if (!manSurfMesh) return;
  const pa = manSurfPos.array, ca = manSurfCol.array;
  const t = manTime;
  const NX = manSurfNX, NZ = manSurfNZ, EL = manSurfStep;
  for (let j = 0; j < NZ; j++) {
    const z = manSurfZ0 + j * EL;
    // the seaward taper, so the live surface meets the flat ocean at nothing
    const edge = clamp((z + 78) / 13, 0, 1);
    for (let i = 0; i < NX; i++) {
      const idx = j * NX + i;
      const o = idx * 3;
      const x = manSurfX0 + i * EL;
      const shelt = manColShelt[idx] * edge;
      manWaveAt(x, z, t, manWave, manColBend[i], shelt, manColRip[i]);
      // WHERE THE WATER IS BELOW THE SAND IT GOES UNDER THE SAND, six
      // centimetres of it, rather than being drawn as a hard edge somewhere
      // arbitrary. That is what makes the waterline MOVE: the mesh is the same
      // mesh every frame and the beach simply covers more or less of it.
      const gnd = manWave.ground;
      if (manWave.y < gnd - 0.05) {
        // ---- THE WET SAND, AND IT IS THE ONLY MOVING THING ON THE BEACH ---
        //
        // The mesh used to be buried six centimetres and painted manSeaShal,
        // which is a colour nobody ever sees. But sand the swash left ten
        // seconds ago is DARK AND SHINY and sand it left ten minutes ago is
        // not, and the line between them runs up and down the beach every
        // eight seconds. So the strip that the water has only just left is
        // drawn a centimetre and a half PROUD, in wet sand, fading out over
        // the twenty-five centimetres of drop behind the retreating edge —
        // and the beach gets its tide line back for two triangles a cell.
        const above = gnd - manWave.y;
        if (above < 0.30 && gnd > -0.6) {
          pa[o + 1] = gnd + 0.015;
          const k = 1 - above / 0.30;
          manCol.copy(manSandDryC).lerp(manSandWetC, k * k);
          // and the last few centimetres of it is still running back down
          if (k > 0.82) manCol.lerp(manFoamDimC, (k - 0.82) * 3.2);
        } else {
          pa[o + 1] = gnd - 0.06;
          manCol.copy(manSeaShal);
        }
        ca[o] = manCol.r; ca[o + 1] = manCol.g; ca[o + 2] = manCol.b;
        continue;
      }
      pa[o + 1] = manWave.y;
      // ---- the colour, which is most of the information in this chapter ----
      const depth = manWave.depth;
      manCol.copy(manSeaDeep).lerp(manSeaMid, clamp((9 - depth) / 5.5, 0, 1));
      manCol.lerp(manSeaShal, clamp((2.6 - depth) / 2.2, 0, 1));
      // ---- AND THIS IS WHERE THE SWELL BECOMES VISIBLE --------------------
      // A metre of relief over sixty-six metres of wavelength is a slope of
      // five degrees, and five degrees of Lambert against an overhead sun is
      // nothing at all: the first build of this rendered a two-metre swell as
      // a perfectly flat sheet. What makes a swell legible from a beach is not
      // its height, it is that the FACE is dark and the BACK is bright — one
      // is looking at the seabed and the other is looking at the sky — so the
      // colour carries it and the geometry only has to agree.
      // AND THE ORDER OF THESE THREE LINES IS THE WHOLE THING.
      //
      // The first build darkened the face and then whitened the foam over the
      // top of it, and because the two are in antiphase along a wave they
      // CANCELLED: measured off the vertex buffer, a crest came out at
      // (0.27, 0.40, 0.42) and the trough forty metres behind it at
      // (0.06, 0.35, 0.37), which is a difference nobody can see and is why
      // the surf zone rendered as one smooth gradient with a two-metre swell
      // running through it. The face term is gated on there being NO foam, so
      // the picture is a hard white band, then dark green, then white — which
      // is what a beach looks like from the sand and, much more usefully, is a
      // thing the player can aim at.
      const fc = manWave.face;
      const fo = manWave.foam;
      const k = clamp(manWave.amp / 0.85, 0, 1);
      if (fc > 0) manCol.lerp(manFaceC, fc * k * 0.92 * (1 - fo));
      else manCol.lerp(manSeaShal, -fc * k * 0.30 * (1 - fo));
      if (fo > 0.02) {
        manCol2.copy(manFoamC).lerp(manFoamDimC, clamp((1.2 - depth) / 1.6, 0, 0.24));
        manCol.lerp(manCol2, clamp(fo * 1.5, 0, 1));
      }
      // ---- AND THE LIP IS LIT FROM BEHIND ---------------------------------
      // The one thing every photograph of a breaking wave has and this one did
      // not. The sun is behind the swell here (it is four in the afternoon and
      // the beach faces east), so the last half-metre of a crest that is about
      // to throw is a THIN band of light coming through the water rather than
      // off it. Gated hard on `brk` — only a wave that is actually tripping
      // gets one — and confined to the seaward quarter of the crest, so it is
      // a line on the lip and not a wash over the whole face. The value is
      // allowed over 1: the composite pass blooms anything past the biome's
      // threshold, and that is what turns a bright pixel into a glint.
      if (manWave.brk > 0.94 && manWave.f < 0.02 && manWave.f > -0.12) {
        const lip = clamp((manWave.brk - 0.94) * 3.0, 0, 1) *
                    clamp(1 - Math.abs(manWave.f + 0.05) / 0.07, 0, 1);
        manCol.lerp(manLipC, lip * 0.85);
      }
      ca[o] = manCol.r; ca[o + 1] = manCol.g; ca[o + 2] = manCol.b;
    }
  }
  manSurfPos.needsUpdate = true;
  manSurfCol.needsUpdate = true;
}

// =================================================================== UPDATE ==
function manUpdateFoam(dt) {
  if (!manFoamMesh) return;
  for (let i = 0; i < manFOAM_N; i++) {
    // Foam floats: the surface field, which is manFlowAt with no depth. It used
    // to be a whole second copy of the field (manFlowAtStatic); now it is the
    // same function with the argument left off.
    //
    // ...ON ITS OWN SCRATCH, though, because `manFlow` is the object api.flow()
    // hands out, and pantanal.js's panRaftFlow carries the note: a shared vector
    // returned from an API is a trap this game has paid for twice. It was safe
    // here only because the two readers never interleave, and calling the
    // published function from inside the chapter is exactly how that stops
    // being true.
    manFlowAt(manFoamX[i], manFoamZ[i], manFoamFlow);
    manFoamX[i] += manFoamFlow.x * dt;
    manFoamZ[i] += manFoamFlow.z * dt;
    manWaveAt(manFoamX[i], manFoamZ[i], manTime, manWave);
    // a streak lives while there is white water under it and fades where
    // there is not, so the field IS the break rather than a decoration near it
    const want = manWave.foam;
    manFoamLife[i] = damp(manFoamLife[i], want, 2.4, dt);
    if (manFoamZ[i] > manSHORE_Z || manFoamZ[i] < -46 ||
        manFoamX[i] < manBEACH_X0 - 14 || manFoamX[i] > manPOINT_X + 8) manRespawnFoam(i, false);
    // A STREAK, NOT A TILE. The first cut scaled these nearly square and the
    // bay came out looking like a car park with the lines painted on. Foam
    // organises itself ALONG the crest, so they are five to fifteen metres of
    // x and about a metre of z, and they vanish entirely where the life is
    // low rather than sitting there at a quarter opacity.
    const s = manFoamLife[i];
    const sc = manFoamScale[i];
    const vis = clamp((s - 0.18) / 0.5, 0, 1);
    manM.makeScale(sc * (1.4 + s * 2.2) * vis, 1, (0.55 + s * 0.7) * vis);
    manM.setPosition(manFoamX[i], manWave.y + 0.05, manFoamZ[i]);
    manFoamMesh.setMatrixAt(i, manM);
  }
  manFoamMesh.instanceMatrix.needsUpdate = true;
}

/**
 * SPRAY OFF THE LIP, WHERE THE LIP ACTUALLY IS.
 *
 * The chapter's only spray came out of manUpdateSurfTasks, which fires it
 * within fourteen metres of the CAPYBARA — so a wave breaking forty metres up
 * the beach threw nothing at all, and standing on the sand watching the set
 * come in there was no spray in the picture anywhere. It is a property of the
 * WAVE, not of the observer: this walks the break line the haze already found
 * and throws off the hardest-breaking metre of it, at a rate that is a
 * function of how hard it is going, with a small bias toward the part of the
 * beach the player is looking at rather than the part they are standing on.
 */
let manLipT = 0;
function manUpdateLip(game, dt) {
  manLipT -= dt;
  if (manLipT > 0) return;
  // 0.19, NOT 0.075. Measured off a screenshot: at thirteen throws a second
  // into a sixty-four particle pool the whole bay was permanently dusted with
  // white spheres and the sea read as litter rather than as spray. Spray has
  // to be an EVENT — a handful of drops off one crest and then nothing.
  manLipT = 0.19;
  const capy = game.capy;
  const cx = capy && capy.position ? capy.position.x : 0;
  // six probes across the break, and the strongest one throws
  let bx = 0, bz = 0, best = 0;
  for (let i = 0; i < 6; i++) {
    const x = cx + (i - 2.5) * 15 + rand(-6, 6);
    if (x < manBEACH_X0 - 6 || x > manPOINT_X + 2) continue;
    const bzz = manBankZ(x);
    for (let k = -2; k <= 6; k++) {
      const z = bzz + k * 5;
      manWaveAt(x, z, manTime, manWave);
      const s = manWave.foam * clamp(manWave.brk - 0.9, 0, 1.4);
      if (s > best) { best = s; bx = x; bz = z; }
    }
  }
  if (best < 0.42) return;
  manWaveAt(bx, bz, manTime, manWave);
  // AND IT GOES SEAWARD. There is an offshore breeze on this coast at four in
  // the afternoon and it is why the lip feathers backwards off every crest —
  // the one detail that tells a surfer the wave is worth having.
  const n = best > 0.5 ? 3 : 2;
  for (let k = 0; k < n; k++) {
    manPuffSpray(bx + rand(-7, 7), manWave.y + 0.35 + rand(0, 0.5), bz - 1.4, 1, 1.35);
    const i = manSprayNext;
    manSprayVZ[i] = -rand(1.4, 3.6);          // back over the top of it
    manSprayT[i] = rand(0.8, 1.5);
  }
}

function manUpdateSpray(dt) {
  if (!manSprayMesh) return;
  let live = 0;
  for (let i = 0; i < manSPRAY_N; i++) {
    if (manSprayT[i] > 0) {
      manSprayT[i] -= dt;
      manSprayVY[i] -= 14 * dt;
      manSprayX[i] += manSprayVX[i] * dt;
      manSprayY[i] += manSprayVY[i] * dt;
      manSprayZ[i] += manSprayVZ[i] * dt;
      const s = clamp(manSprayT[i] * 1.4, 0, 1) * 0.55;
      manM.makeScale(s, s, s);
      manM.setPosition(manSprayX[i], manSprayY[i], manSprayZ[i]);
      live++;
    } else {
      manM.makeScale(0, 0, 0);
      manM.setPosition(0, -900, 0);
    }
    manSprayMesh.setMatrixAt(i, manM);
  }
  manSprayMesh.instanceMatrix.needsUpdate = true;
  manSprayMesh.visible = live > 0;
}

function manUpdateBathers(game, dt) {
  if (!manBathers) return;
  const capy = game.capy;
  for (let i = 0; i < manBATHER_N; i++) {
    // they walk to the flags, and they take their time about it
    const dx = manBathTX[i] - manBathX[i], dz = manBathTZ[i] - manBathZ[i];
    const d = Math.sqrt(dx * dx + dz * dz);
    let walking = 0;
    if (d > 0.4) {
      const sp = Math.min(2.0, d * 1.4);
      manBathX[i] += (dx / d) * sp * dt;
      manBathZ[i] += (dz / d) * sp * dt;
      walking = 1;
    }
    // and they get out of the way of a capybara, because everybody does.
    //
    // ...EXCEPT WHILE THEY ARE WALKING TO A NEW FLAG LINE, and that is not a
    // nicety. 'move-flags' is the chapter's headline task and it tests that
    // twenty of the twenty-two bathers have reached their own target within a
    // metre and a half. A capybara standing in the middle of the crowd it has
    // just relocated pushes the nearest two or three permanently off theirs at
    // 2.2 m/s — against a walk speed of 2.0, so the shove WINS — and the task
    // that fired at fifteen seconds in the clean case simply never fires. It
    // is the same silent never-completes the previous pass found in this task
    // for a different reason, arriving from the other side, and the player's
    // only clue is that they are standing where they were told to stand.
    if (capy && manFlagMovedT <= 0) {
      const cx = manBathX[i] - capy.position.x, cz = manBathZ[i] - capy.position.z;
      const cd = Math.sqrt(cx * cx + cz * cz);
      if (cd < 3.2 && cd > 0.01) {
        manBathX[i] += (cx / cd) * (3.2 - cd) * 2.2 * dt;
        manBathZ[i] += (cz / cd) * (3.2 - cd) * 2.2 * dt;
      }
    }
    const h = manTerrain(manBathX[i], manBathZ[i]);
    let y = h;
    let yaw = walking && d > 0.4 ? Math.atan2(dx, dz) : manBathPh[i];
    let sc = 1, pitch = 0;
    if (manBathWet[i] > 0.5) {
      // ---- THE ONES WHO ARE IN IT ----------------------------------------
      // They stand on the seabed in the shallows and they FLOAT once the water
      // is over about a metre, which is one comparison and is the whole
      // difference between people posed in the sea and people in it.
      manWaveAt(manBathX[i], manBathZ[i], manTime, manWave);
      const dep = manWave.y - h;
      if (dep > 1.0) {
        // floating: shoulders at the surface, sunk to the chest, and bobbing
        // on the actual swell rather than on a sine of its own
        y = manWave.y - 1.05;
        sc = 1;
        pitch = clamp(manWave.face * 0.28, -0.3, 0.3);
        // and the ones out the back turn to face it, because that is what
        // everybody in the water does for the whole of their time in it
        yaw = Math.PI;
        // ---- AND WHEN IT BREAKS ON THEM, THEY GO UNDER IT -----------------
        // The chapter has a whole task about this ('duck-dive') and for its
        // entire life the sixteen people standing in the same water simply
        // let two hundred tonnes of white water roll over their heads without
        // moving. Everybody in a line-up ducks; it is the single most
        // recognisable thing a person in surf does, and it costs one
        // comparison and a metre of y. They come back up behind it.
        if (manWave.foam > 0.42) {
          const d = clamp((manWave.foam - 0.42) / 0.30, 0, 1);
          y -= d * 1.15;
          pitch = -0.9 * d;
        }
      } else {
        y = h;
        // wading: they jump the small ones
        if (manWave.foam > 0.25) y += Math.abs(Math.sin(manTime * 3.4 + manBathPh[i])) * 0.22;
        yaw = manWave.amp > 0.35 ? Math.PI : yaw;
      }
      // AND THEY LEAVE IF THE FLAGS LEAVE. A swimmer whose target is now dry
      // land walks out; one whose target is water walks in. Handled by the
      // steering above — this only stops them wandering past the bank.
      if (manBathTZ[i] < manBankZ(manBathX[i]) + 4) manBathTZ[i] = manSHORE_Z - 8;
    } else {
      y = h + (walking ? Math.abs(Math.sin(manTime * 7 + manBathPh[i])) * 0.09 : 0);
    }
    // ---- and when the wave of the set stands up, the beach looks at it ----
    //
    // ...OR AT WHOEVER IS ON IT. `manBathAimX/Z` is the one thing they all
    // turn to: the horizon while a set is standing up, and the RIDER once
    // somebody is being carried in on it. A fifty-metre ride that ends in
    // front of twenty people who never once looked round is the same failure
    // as a marquee that ticks a box and makes no noise.
    if (manBathLook > 0.02 && !walking) {
      const want = Math.atan2(manBathAimX - manBathX[i], manBathAimZ - manBathZ[i]);
      let dy = want - yaw;
      while (dy > Math.PI) dy -= 6.283185;
      while (dy < -Math.PI) dy += 6.283185;
      yaw += dy * manBathLook;
    }
    // ---- AND THE BEACH CHEERS, which is one line and twenty-two hops -------
    // No arm can be raised on a merged instance, so the celebration is what a
    // crowd actually looks like from six metres up: everybody off the ground
    // at a slightly different moment. The wet ones do it too — a swimmer
    // jumping is a swimmer bobbing, which is the same read in the water.
    if (manBathCheer > 0) {
      const k = clamp(manBathCheer / 0.7, 0, 1);
      y += Math.abs(Math.sin(manTime * 7.5 + manBathPh[i] * 2.1)) * 0.34 * k;
      sc *= 1 + 0.05 * k;
    }
    manM.compose(manV3.set(manBathX[i], y, manBathZ[i]),
                 manQ.setFromEuler(manE.set(pitch, yaw, 0)),
                 manSc.set(sc, sc, sc));
    manBathers.setMatrixAt(i, manM);
  }
  manBathers.instanceMatrix.needsUpdate = true;
  if (manBathCheer > 0) manBathCheer -= dt;
  // manBigNear is written by manUpdateSurfTasks, which runs after this — one
  // frame of lag on a three-second damp, which nobody can see.
  // A RIDER OUTRANKS THE HORIZON. While the water is carrying the animal they
  // watch THAT, and the aim point is where it actually is; otherwise it is the
  // set, which is out to sea.
  const riding = manRideDist > 5 && capy && capy.position;
  let look = clamp((manBigNear - 0.30) / 0.35, 0, 1);
  // `manBathCheer > 0` used to be enough to enter this branch on its own, and
  // the branch dereferences capy.position — one frame with no capybara (the
  // frame a chapter is entered on, and every frame of the end card) and the
  // whole beach throws.
  if ((riding || manBathCheer > 0) && capy && capy.position) {
    look = 1;
    manBathAimX = damp(manBathAimX, capy.position.x, 2.5, dt);
    manBathAimZ = damp(manBathAimZ, capy.position.z, 2.5, dt);
  } else {
    manBathAimX = damp(manBathAimX, manFlagX, 1.2, dt);
    manBathAimZ = damp(manBathAimZ, -60, 1.2, dt);
  }
  manBathLook = damp(manBathLook, look, 2.2, dt);
}

/**
 * THE DOLPHINS. Four of them, in a line, in the face of a wave — which means
 * the wave has to be found first: they wait for a crest of the set that is
 * actually going to break, and then they are IN it, at its own speed, half
 * out of the water.
 */
function manUpdateDolphins(game, dt) {
  if (!manDolphins) return;
  if (!manDolphActive) {
    manDolphWait -= dt;
    if (manDolphWait <= 0) {
      // pick the next crest whose amplitude is worth swimming in. The crest
      // index that is at the seaward end of the table right now is the one
      // about to arrive; walk forward from it until the set offers a big one.
      let n = Math.ceil(manPhaseAt(manPH_S0) / (Math.PI * 2) - manTime / manPERIOD) - 1;
      for (let k = 0; k < 12; k++) { if (manCrestAmp(n - k) > 0.78) { n = n - k; break; } }
      manDolphCrest = n;
      manDolphActive = true;
      manDolphins.visible = true;
      manDolphT = 0;
    }
    return;
  }
  manDolphT += dt;
  // where is that crest now
  const crestZ = manCrestS(manDolphCrest) + manBankZ(-4);
  if (crestZ > manSHORE_Z + 2 || manDolphT > 34) {
    manDolphActive = false;
    manDolphins.visible = false;
    manDolphWait = rand(70, 120);
    return;
  }
  // ---- AND IF SOMEBODY IS ON THE SAME WAVE, THEY COME AND HAVE A LOOK -----
  // The one thing that turns an ambient event into a moment. The line sits at
  // x = -14..+2 whatever happens, so a capybara taking the wave of the set
  // forty metres away never once shared a frame with them. They slide along
  // the crest toward a rider — slowly, over about five seconds, because a
  // pod that teleports is a cutscene — and they never come closer than four
  // metres, because being nudged by a dolphin would be a physics event and
  // this is not one.
  const capy = game.capy;
  const riding = manRideDist > 5 && capy && capy.position;
  if (riding) {
    const want = clamp(capy.position.x - 7.8, manBEACH_X0 + 8, manPOINT_X - 22);
    manDolphX = damp(manDolphX, want, 0.55, dt);
  } else {
    manDolphX = damp(manDolphX, -14, 0.35, dt);
  }
  for (let i = 0; i < manDOLPH_N; i++) {
    const x = manDolphX + i * 5.2 + Math.sin(manTime * 0.7 + i) * 1.1;
    const z = crestZ - 1.4 + Math.sin(manTime * 1.3 + i * 1.7) * 0.8;
    manWaveAt(x, z, manTime, manWave);
    // porpoising: they come clear of the face on a cycle of their own
    const ph = manTime * 1.9 + i * 1.05;
    const air = Math.max(0, Math.sin(ph));
    const y = manWave.y - 0.25 + air * 1.25;
    const pitch = -0.55 + Math.cos(ph) * 0.5;
    manM.compose(manV3.set(x, y, z),
                 manQ.setFromEuler(manE.set(pitch, 0.06 * Math.sin(manTime + i), 0)),
                 manSc.set(1, 1, 1));
    manDolphins.setMatrixAt(i, manM);
    if (air > 0.96 && Math.random() < 0.25) manPuffSpray(x, y, z, 1, 1);
  }
  manDolphins.instanceMatrix.needsUpdate = true;
  // ONE NOTE, RATIONED, AND SCALED BY DISTANCE — the plane in Sydney's rule.
  //
  // ...ON A COUNTDOWN, NOT ON A WINDOW. `manDolphT % 3 < dt` is the exact
  // shape that made the Antarctic skua cry nine times per dive and the
  // Pantanal otters bark like a smoke alarm: it is a test on a clock that
  // advances by a variable amount, so at a frame time that straddles the
  // boundary it is true twice and at one that steps over it it is true never.
  // A countdown redrawn from a range cannot do either, and it also stops four
  // dolphins sounding like a metronome.
  manDolphNote -= dt;
  if (manDolphNote <= 0 && game.capy) {
    manDolphNote = rand(2.2, 4.1);
    const far = Math.abs(game.capy.position.z - crestZ);
    manSfx.volume = clamp(0.22 - far * 0.0035, 0.02, 0.22);
    manSfx.pitch = rand(2.1, 2.6);
    if (manSfx.volume > 0.03) game.sfx('pop', manSfx);
  }
}

function manUpdatePelican(game, dt) {
  if (!manPelican) return;
  manPelT += dt;
  const capy = game.capy;
  const near = capy ? capy.position.distanceTo(manPelican.position) : 99;
  if (manPelState === 'stand') {
    manPelican.position.y = manPOOL.wall + 0.9 + Math.sin(manTime * 0.8) * 0.03;
    manPelican.rotation.y = damp(manPelican.rotation.y,
      Math.sin(manTime * 0.3) * 0.9, 1.2, dt);
    if (manPelT > 30 || near < 6) {
      manPelState = 'fly'; manPelT = 0;
      // TWO VECTORS ALLOCATED EVERY TIME THE PELICAN MOVES, and it moves every
      // thirty seconds for the whole chapter. The contract's rule is zero
      // allocations in update(); this is the only place in the file that broke
      // it. They are module-level scratch now — declared once, written here.
      manPelFrom.copy(manPelican.position);
      manPelTo.set(
        manPelFrom.x > manPOOL.x0 + 8 ? manPOOL.x0 - 1.1 : manPOOL.x1 + 1.1,
        manPOOL.wall + 0.9,
        manPOOL.z0 + rand(2, 11));
      manSfx.volume = 0.16; manSfx.pitch = 0.62;
      game.sfx('gull', manSfx);
    }
  } else {
    const t = clamp(manPelT / 3.4, 0, 1);
    manPelican.position.lerpVectors(manPelFrom, manPelTo, manSmooth(t));
    manPelican.position.y += Math.sin(t * Math.PI) * 4.5;
    manPelican.rotation.y = Math.atan2(manPelTo.x - manPelFrom.x, manPelTo.z - manPelFrom.z);
    manPelican.rotation.z = Math.sin(manPelT * 6) * 0.14 * (1 - t);
    if (t >= 1) { manPelState = 'stand'; manPelT = 0; manPelican.rotation.z = 0; }
  }
}

function manUpdateGroper(game, dt) {
  if (!manGroper) return;
  const capy = game.capy;
  const t = manTime * 0.4;
  let tx = manSHELLY.x - 8 + Math.cos(t) * 5;
  let tz = manSHELLY.z + 2 + Math.sin(t * 1.3) * 5;
  // he comes and has a look at you, which is exactly what he does in real life
  if (capy && manInZone('shelly', capy.position.x, capy.position.z)) {
    tx = damp(tx, capy.position.x, 1, 1);
    tz = damp(tz, capy.position.z + 2, 1, 1);
  }
  tx = clamp(tx, manSHELLY.x - 15, manSHELLY.x + 2);
  tz = clamp(tz, manSHELLY.z - 11, manSHELLY.z + 11);
  const bed = manTerrain(tx, tz);
  let gy = bed + 0.7;
  if (gy > -0.55) gy = Math.max(bed + 0.25, -0.55);
  manGroper.position.x = damp(manGroper.position.x, tx, 1.2, dt);
  manGroper.position.z = damp(manGroper.position.z, tz, 1.2, dt);
  manGroper.position.y = damp(manGroper.position.y, gy, 1.6, dt);
  manGroper.rotation.y = dampAngle(manGroper.rotation.y,
    Math.atan2(tx - manGroper.position.x, tz - manGroper.position.z), 2, dt);
  manGroper.rotation.z = Math.sin(manTime * 3) * 0.08;
}

/**
 * THE BOAT'S CLOCK. Beached, then out through the break, then a turn out the
 * back, then back in on a wave, then beached again. Fifty-five seconds, and it
 * runs whether or not anybody is in it.
 */
function manUpdateBoat(game, dt) {
  if (!manBoatBody) return;
  manBoatT += dt;

  manBoatPrev.x = manBoatTarget.x;
  manBoatPrev.y = manBoatTarget.y;
  manBoatPrev.z = manBoatTarget.z;

  const H = manBOAT_HOME;
  let yaw = 0;
  if (manBoatPhase === 'beached') {
    manBoatTarget.x = H.x; manBoatTarget.z = H.z;
    // ---- THE CREW CALL IT, AND UNTIL NOW THEY DID NOT ------------------
    // Fourteen seconds beached, then seventeen out through the break, on a
    // clock that runs whether or not anybody is aboard — and the ONLY line
    // about it fired once the boat was already moving, which is a second and
    // a bit after the last moment you could have got into it. From the
    // player's side a nine-metre boat sat on the sand doing nothing for
    // fourteen seconds and then left without them, four times in a row, with
    // no way at all of knowing when.
    //
    // A surfboat crew does not leave silently. Three seconds out the sweep
    // calls it and they take the gunwales, which is both the warning and the
    // most recognisable thing on that beach.
    if (manBoatT > 11 && !manBoatCalled) {
      manBoatCalled = true;
      manSfx.volume = 0.34; manSfx.pitch = 1.15;
      game.sfx('cheer', manSfx);
      manCall(game, 'launch', H.x, manTerrain(H.x, H.z + 2) + 0.7, H.z + 2,
              'Boat! Hands on! Three, two —', 30);
    }
    if (manBoatT > 14) { manBoatPhase = 'out'; manBoatT = 0; manBoatOut = false; manBoatCalled = false; }
  } else if (manBoatPhase === 'out') {
    // straight at it. A surfboat does not go round.
    const t = clamp(manBoatT / 17, 0, 1);
    manBoatTarget.x = H.x - 3 * t;
    manBoatTarget.z = lerp(H.z, -40, manSmooth(t));
    if (t >= 1) { manBoatPhase = 'turn'; manBoatT = 0; }
  } else if (manBoatPhase === 'turn') {
    // A NINE-SECOND TURN AND A FIVE-METRE ARC, and both numbers are about the
    // passenger. The first cut swung seven metres in seven, which is a lateral
    // acceleration of about a third of a gravity — it tipped the capybara over
    // the gunwale on every single run, thirty seconds into the best ride out
    // of this beach. A carrier that throws its passenger is not a carrier.
    const t = clamp(manBoatT / 9, 0, 1);
    manBoatTarget.x = H.x - 3 + Math.sin(t * Math.PI) * 5;
    manBoatTarget.z = -40 - Math.sin(t * Math.PI) * 3;
    yaw = t * Math.PI;
    if (t >= 1) { manBoatPhase = 'in'; manBoatT = 0; }
  } else {
    const t = clamp(manBoatT / 13, 0, 1);
    manBoatTarget.x = lerp(H.x - 3, H.x, manSmooth(t));
    manBoatTarget.z = lerp(-40, H.z, manSmooth(t));
    yaw = Math.PI;
    if (t >= 1) { manBoatPhase = 'beached'; manBoatT = 0; }
  }
  // the hull rides the sea it is in
  manWaveAt(manBoatTarget.x, manBoatTarget.z, manTime, manWave);
  const float = Math.max(manWave.y, manTerrain(manBoatTarget.x, manBoatTarget.z));
  manBoatTarget.y = float + 0.55;

  // RULE 3: difference against the PREVIOUS TARGET, on all three axes. cannon
  // integrates a kinematic body inside world.step, which runs before this — so
  // (target − body.position) is the distance the LAST velocity already carried
  // it, the sign flips every frame, and the passenger is shaken off the moment
  // the boat stops. Measured on every carrier in this game at some point.
  const inv = dt > 0.0001 ? 1 / dt : 0;
  let vy = (manBoatTarget.y - manBoatPrev.y) * inv;
  if (vy > 3.4) vy = 3.4; else if (vy < -3.4) vy = -3.4;
  manBoatBody.velocity.set((manBoatTarget.x - manBoatPrev.x) * inv, vy,
                           (manBoatTarget.z - manBoatPrev.z) * inv);
  manBoatBody.quaternion.setFromEuler(0, yaw, 0);
  manBoatBody.angularVelocity.set(0, 0, 0);

  // render from interpolatedPosition, and pitch on the MESH only (rule 4)
  if (manBoatGroup) {
    const ip = manBoatBody.interpolatedPosition;
    manBoatGroup.position.set(ip.x, ip.y, ip.z);
    const pitch = clamp(-manWave.face * manWave.amp * 0.38, -0.55, 0.55);
    manBoatGroup.rotation.set(pitch, yaw, Math.sin(manTime * 1.7) * 0.05);
    // THE STROKE. Hard and fast on the way out through the break, half rate on
    // the way in (they are surfing it, not rowing it), and stopped on the sand.
    const oars = manBoatGroup.userData.oars;
    if (oars) {
      const rate = manBoatPhase === 'out' ? 3.1 : manBoatPhase === 'in' ? 1.5 :
                   manBoatPhase === 'turn' ? 2.2 : 0;
      if (rate > 0) {
        const was = manBoatStroke;
        manBoatStroke += rate * dt;
        // a stroke is not a sine: the catch and the drive are quick, the
        // recovery is slow, which is the whole rhythm of a crew boat
        const s = manBoatStroke % (Math.PI * 2);
        const drive = s < Math.PI * 0.7 ? (s / (Math.PI * 0.7)) : 1 - (s - Math.PI * 0.7) / (Math.PI * 1.3);
        oars.rotation.x = -0.34 + drive * 0.68;
        // ---- AND YOU CAN HEAR IT. Four blades going in together is the
        // loudest thing on this beach after the surf, and a nine-metre boat
        // being driven at a breaking wave in total silence was the one part
        // of the chapter's second set piece that had no sound at all. The
        // catch is an EDGE CROSSING of the stroke phase, never a window on a
        // clock that advances by dt.
        const lap = Math.floor(manBoatStroke / (Math.PI * 2));
        if (lap !== Math.floor(was / (Math.PI * 2)) && game.capy) {
          const far = Math.hypot(game.capy.position.x - manBoatTarget.x,
                                 game.capy.position.z - manBoatTarget.z);
          manSfx.volume = clamp(0.26 - far * 0.0042, 0.0, 0.26);
          manSfx.pitch = rand(0.72, 0.86);
          if (manSfx.volume > 0.03) game.sfx('splash', manSfx);
        }
      } else {
        oars.rotation.x = damp(oars.rotation.x, 0.12, 2.5, dt);
      }
    }
  }

  // is the capybara in the hull
  const capy = game.capy;
  manBoatCarrying = false;
  if (capy && capy.body) {
    const p = capy.body.position;
    // A LOCAL-SPACE TEST MUST BE A ROTATION, not a reflection: cos(−yaw)/
    // sin(−yaw) silently swaps which tolerance guards which axis.
    const dx = p.x - manBoatBody.position.x, dz = p.z - manBoatBody.position.z;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    const dy = p.y - manBoatBody.position.y;
    if (Math.abs(lx) < 1.5 && Math.abs(lz) < 4.6 && dy > -0.3 && dy < 2.8) manBoatCarrying = true;
  }
  if (manBoatCarrying) {
    manBoatFrame.x = manBoatBody.velocity.x;
    manBoatFrame.z = manBoatBody.velocity.z;
    if (manBoatPhase === 'out' && manBoatTarget.z < -12) manBoatOut = true;
    if (manBoatOut && manBoatTarget.z < -30) manTask(game, 'the-surfboat');
  } else {
    manBoatOut = false;
  }
  // spray off the bow when it punches something
  if (manWave.foam > 0.4 && manBoatPhase === 'out' && Math.random() < 0.4) {
    manPuffSpray(manBoatTarget.x, manBoatTarget.y + 0.6, manBoatTarget.z - 4.4, 2, 1.4);
  }
}

// ------------------------------------------------------------- flags & tasks --
function manTask(game, id) { game.completeTask(id); }

/**
 * SOMEBODY SAYS SOMETHING ABOUT WHAT IS ACTUALLY HAPPENING.
 *
 * `game.say(x, y, z, text)` has existed in npc.js since the locals were
 * written, is documented in main.js as "biomes call game.say() from their
 * update", and IS NOT CALLED BY A SINGLE CHAPTER IN THE GAME. It is the same
 * shape as the eleven Pantanal landmark getters nothing read: a published API
 * with no consumer.
 *
 * A local's `lines` are a shuffle bag — they are what a person says when you
 * walk up to them, and they cannot know anything. This is the other half: a
 * line about the thing that is going on RIGHT NOW, from a fixed point on the
 * beach, on a per-key cooldown so a lifeguard shouting about the rip is a
 * lifeguard and not a smoke alarm. The rules are the ambient-mover rules —
 * long clocks, never twice for the same event, and never while it is already
 * saying something.
 */
/**
 * ...AND THE PEOPLE WHO REMEMBER IT AFTERWARDS.
 *
 * The other half of the same idea, and the half Cappadocia has had since it
 * shipped and this chapter never did. `say` is a line about NOW, from a point;
 * `lines` is what somebody says when you walk up to them, and npc.js reads
 * that array live — so a chapter that keeps its references can change what a
 * person says the moment the world changes under them.
 *
 * Everything below is hung on a task that has actually completed, so nobody is
 * ever congratulating you for something you have not done. Deliberately not
 * everybody for everything: the lifeguard gets the flags and the rip, the club
 * secretary gets the boat, the pool swimmer gets the pool, and the fisherman
 * gets the groper — each of them the thing they were standing in front of.
 */
const manLocals = {};
let manTuneMv = null;
// Additive, not destructive (M3). This was `r.lines = lines`, which deleted six
// of this chapter's nine locals' authored pools — including every `{ after: }`
// payoff — the first time a set piece fired, permanently. See the long note on
// `gorSaysNow` in goreme.js for why the destructive version was ever right and
// what stopped being true about it.
function manSaysNow(who, lines, wheek) {
  const r = manLocals[who];
  if (!r) return;
  if (r.lines0 === undefined) { r.lines0 = r.lines || []; r.wheek0 = r.wheekLines || []; }
  if (lines) r.lines = lines.concat(r.lines0);
  if (wheek) r.wheekLines = wheek.concat(r.wheek0);
}

const manSaid = {};
let manSayCool = 0;
function manCall(game, key, x, y, z, text, cool) {
  if (manSayCool > 0) return false;
  const t = manSaid[key];
  if (t !== undefined && manTime - t < (cool || 40)) return false;
  if (typeof game.say !== 'function') return false;
  manSaid[key] = manTime;
  manSayCool = 3.2;                 // one voice on this beach at a time
  game.say(x, y, z, text);
  return true;
}

function manUpdateFlags(game, dt) {
  const capy = game.capy;
  if (!capy || !capy.body) return;
  const input = game.input;
  if (manFlagCool > 0) manFlagCool -= dt;
  const p = capy.body.position;

  if (manFlagHeld) {
    // the pole rides in front of the animal, dragging in the sand.
    //
    // AND IT IS THE POLE YOU PICKED UP. Both poles are tested for the grab —
    // that was fixed once already — but the drag only ever animated manFlagA,
    // so walking up to the EASTERN flag and pressing E teleported the western
    // one into the capybara's mouth from eleven metres away while the one you
    // were standing next to stayed in the sand.
    const held = manFlagHeldB ? manFlagB : manFlagA;
    const yaw = capy.group ? capy.group.rotation.y : 0;
    const fx = p.x + Math.sin(yaw) * 1.1, fz = p.z + Math.cos(yaw) * 1.1;
    const h = manTerrain(fx, fz);
    if (held) {
      held.position.set(fx, h + 0.15, fz);
      held.rotation.set(0.85, yaw, 0);
    }
    if (input.actionPressed && manFlagCool <= 0 && p.y < manTerrain(p.x, p.z) + 1.4) {
      manFlagHeld = false; manFlagCool = 0.5;
      manFlagX = clamp(p.x, manBEACH_X0 + 10, manBEACH_X1 - 10);
      manFlagZ = clamp(p.z, manSHORE_Z + 2, manDUNE_Z);
      manPlaceFlags();
      if (manFlagA) manFlagA.rotation.set(0, 0, 0);
      if (manFlagB) manFlagB.rotation.set(0, 0, 0);
      manScatterBathers(false);
      // ...and only if they actually WENT somewhere. Putting a pole back in
      // its own hole is not moving the flags, and with the arrival test above
      // it would tick in a second and a half.
      const moved = Math.hypot(manFlagX - manFlagFromX, manFlagZ - manFlagFromZ);
      manFlagMovedT = moved > 6 ? 0.001 : 0;
      manSfx.volume = 0.5; manSfx.pitch = 0.9;
      game.sfx('thud', manSfx);
      game.toast(moved > 6 ? 'the whole beach is getting up.' : 'nobody moved.');
    }
    return;
  }
  if (manFlagMovedT > 0) {
    manFlagMovedT += dt;
    // they have to actually ARRIVE before it counts. A task that ticks on the
    // button press is a task about the button.
    //
    // ...AT THEIR OWN TARGET, NOT AT THE POLE, AND THIS COULD NOT BE COMPLETED
    // AT ALL. The test was "twenty of the twenty-two are within twelve metres
    // of the flag point", and it was written when every bather on this beach
    // stood on dry sand round the poles. Two thirds of them are IN THE WATER
    // now — held across the span between the flags and 1.5 to 13 m seaward of
    // the still waterline, which is z 11..22 against a flag line the drop
    // clamps to z 26..34. Measured at rest with the flags at home: TEN of the
    // twenty-two are inside twelve metres and the other twelve never can be,
    // so the headline task of the chapter — the one the chapter is named for,
    // the largest consequence any button press has in this game — silently
    // never fired. The swimmers obeying the flags are the whole point of them;
    // the test has to be "everybody has finished moving to where the new flags
    // put them", which is a question about each bather's OWN target.
    let there = 0;
    for (let i = 0; i < manBATHER_N; i++) {
      const dx = manBathX[i] - manBathTX[i], dz = manBathZ[i] - manBathTZ[i];
      if (dx * dx + dz * dz < 2.25) there++;
    }
    if (there >= manBATHER_N - 2 && manFlagMovedT > 1.5) {
      manFlagMovedT = 0;
      manBathCheer = 2.6;
      manSfx.volume = 0.30; manSfx.pitch = 1.35;
      game.sfx('cheer', manSfx);
      manTask(game, 'move-flags');
      manSaysNow('guard',
        ['You moved them. I am not saying I approve. I am saying nobody drowned.',
         'Everyone followed. The whole beach. That is what the flags are for.',
         'Sixty years those poles have gone in the same two holes.',
         'Right. New holes. I will have to redo the board.'],
        ['Yes, all right, I have moved. Everybody has moved.']);
    }
  }
  // pick one up — EITHER of them. The first build only tested the western
  // pole, so walking up to the eastern one and pressing E did nothing at all,
  // which from the player's side is indistinguishable from the mechanic not
  // existing.
  if (input.actionPressed && manFlagCool <= 0 && !capy.heldProp && manFlagA && manFlagB) {
    const dA = manFlagA.position.distanceTo(manV3.set(p.x, manFlagA.position.y, p.z));
    const dB = manFlagB.position.distanceTo(manV3.set(p.x, manFlagB.position.y, p.z));
    const d = Math.min(dA, dB);
    if (d < 3.0) {
      manFlagHeld = true; manFlagHeldB = dB < dA; manFlagCool = 0.5;
      manFlagFromX = manFlagX; manFlagFromZ = manFlagZ;
      manSfx.volume = 0.5; manSfx.pitch = 1.3;
      game.sfx('rustle', manSfx);
      game.toast('nobody is going to like this.');
    }
  }
}

/** The Norfolk pines, and the one thing in them worth having. */
function manUpdateCone(game, dt) {
  const capy = game.capy;
  if (!capy || !capy.body) return;
  if (manConeT > 0) {
    manConeT -= dt;
    if (manConeMesh && manConeMesh.visible) {
      const g = manTerrain(manConeMesh.position.x, manConeMesh.position.z);
      if (manConeMesh.position.y > g + 0.24) {
        manConeMesh.userData.vy = (manConeMesh.userData.vy || 0) - 24 * dt;
        manConeMesh.position.y += manConeMesh.userData.vy * dt;
        manConeMesh.rotation.x += dt * 6;
      } else {
        // IT LANDS. Thirteen metres of fall and it arrived in silence, which
        // is the one frame of the whole business the player is watching.
        if (!manConeMesh.userData.landed) {
          manConeMesh.userData.landed = true;
          manConeMesh.rotation.x = 1.4;
          manSfx.volume = 0.42; manSfx.pitch = 1.45;
          game.sfx('thud', manSfx);
          manPuffSpray(manConeMesh.position.x, g + 0.15, manConeMesh.position.z, 3, 0.5);
          // ---- AND THIRTY GULLS ARE STANDING RIGHT THERE ----------------
          // The pines are on the promenade, the gulls live on the shopfronts
          // twelve metres behind them, and a pine cone arriving out of a
          // thirteen-metre tree is the loudest thing that has happened on the
          // Corso all afternoon. They went on standing there. A world that
          // does not react to the one physical event a task produces is the
          // same failure as a marquee that ticks a box and makes no noise —
          // and the gull scatter is already built, already the chip-shop
          // man's entire character, and cost one line to cause.
          if (Math.abs(manConeMesh.position.x - manGULL_HOME.x) < 34 && manGullUp < 0.5) {
            manGullUp = 1;
            manSfx.volume = 0.30; manSfx.pitch = rand(1.05, 1.3);
            game.sfx('gull', manSfx);
          }
        }
        manConeMesh.position.y = g + 0.24;
      }
    }
    return;
  }
  if (!game.input.actionPressed || capy.heldProp) return;
  const p = capy.body.position;
  if (Math.abs(p.z - manPINE_Z) > 3.2) return;
  // THE SAME ROW THE BUILD DREW. It was 11 pines at -56 + i*11.2 in both
  // places; the row moved to clear the chapter's centreline and a shake test
  // against the OLD arithmetic is a tree you can rattle from four metres away
  // and one you cannot rattle standing under it.
  for (let i = 0; i < 10; i++) {
    const x = -50.4 + i * 11.2;
    if (Math.abs(p.x - x) > 2.4) continue;
    manConeT = 4;
    if (manConeMesh) {
      // ...AND THE LAST ONE DOES NOT SIMPLY BLINK OUT OF EXISTENCE. There is
      // exactly one cone mesh, so rattling a second tree teleported the cone
      // that was lying on the sand into the top of the new one — a small brown
      // object vanishing from where the player put it, in plain sight. A puff
      // of sand where it was is the whole cost of it looking like a gull took
      // it rather than like a bug.
      if (manConeMesh.visible && manConeMesh.userData.landed) {
        manPuffSpray(manConeMesh.position.x, manConeMesh.position.y + 0.1,
                     manConeMesh.position.z, 3, 0.6);
      }
      manConeMesh.visible = true;
      manConeMesh.position.set(x + rand(-0.6, 0.6), manPROM_Y + 13, manPINE_Z + rand(-0.5, 0.5));
      manConeMesh.userData.vy = 0;
      manConeMesh.userData.landed = false;
    }
    game.shake(0.25);
    manSfx.volume = 0.55; manSfx.pitch = 0.8;
    game.sfx('rustle', manSfx);
    manTask(game, 'pine-cone');
    break;
  }
}

/**
 * EVERYTHING THAT IS MEASURED, AND THE ONE THING THAT IS THE CHAPTER.
 *
 * A ride is not a switch. It has a start, a length and an end, and the game
 * has to be able to tell the difference between "carried three metres by the
 * shorebreak" and "took the fifth wave of the set from the bank to the sand",
 * which is fifty. So the ride is TRACKED: it opens when the water under the
 * animal is genuinely going somewhere, it accumulates shoreward distance, and
 * it closes when the wave leaves. What it closed AT is the number.
 */
function manUpdateSurfTasks(game, dt) {
  const capy = game.capy;
  if (!capy || !capy.body) return;
  const p = capy.body.position;
  manWaveAt(p.x, p.z, manTime, manWave);
  const swimming = !!capy.swimming || (capy.depth || 0) > 0.02;
  const push = manWave.push;
  const speed = Math.sqrt(capy.velocity.x * capy.velocity.x + capy.velocity.z * capy.velocity.z);

  // ---- the ride --------------------------------------------------------
  // THE RIDE IS OPEN WHILE THE WATER IS STILL DOING THE WORK, and where that
  // threshold sits was measured rather than chosen: at push > 3.0 the counter
  // shut off at z = 15 while the animal was still being carried to z = 24, so
  // a twenty-six metre ride measured fifteen and the wave of the set could
  // never have reached forty. A capybara swims at 2.6; anything over that is
  // the sea.
  const riding = swimming && push > 2.2 && manWave.foam > 0.12 && p.z < manSHORE_Z + 3;
  // ---- D4.11: the stick, in the wave's frame ----------------------------
  // Camera-relative, exactly as capybara.js resolves ordinary movement — a
  // carve that is in world x would reverse itself every time the player swung
  // the camera round, which is the reference-frame fault this repository has
  // made three times. The crest runs along x here, so the wave-frame lateral
  // is the x component of the resolved stick.
  const inp = game.input;
  let want = 0;
  if (riding && inp && !(game.state && game.state.noCarve)) {
    const cy = Math.cos(inp.camYaw || 0), sy = Math.sin(inp.camYaw || 0);
    want = clamp((inp.x || 0) * cy + (inp.z || 0) * sy, -1, 1);
  }
  manCarve = damp(manCarve, want, manCARVE_L, dt);
  if (Math.abs(manCarve) < 0.004) manCarve = 0;
  manUpdateBarrel(game, dt, p, riding, speed);
  if (riding) {
    manRideOff = 0;
    // ---- ALONG THE PATH, NOT TOWARD THE BEACH (D4.11) -------------------
    // `velocity.z` measures how fast you are approaching the sand, which is
    // exactly the quantity a rider gives up in exchange for going along the
    // wave — so the old record paid for pointing at the beach and doing
    // nothing, and a carve would have made the number go DOWN. The ride is
    // how much water you covered.
    const along = Math.hypot(capy.velocity.x, Math.max(0, capy.velocity.z)) * dt;
    manRideDist += along;
    manCarveDist += Math.abs(capy.velocity.x) * dt;
    if (speed > manRideTop) manRideTop = speed;
    if (speed > manTakeTop) manTakeTop = speed;
    // ---- WHICH OF THE TWO NUMBERS A RIDE IS ABOUT (v32) ------------------
    // A ride carries two records and the paper shows one attempt at a time, so
    // it shows the one still open: until the take-off has been made it is the
    // speed, and after that a ride is a distance and nothing else. Both are
    // filed by game.record exactly as before — this only chooses what to WATCH.
    // ...and the same two-metre floor Rio's wave has, for the same measured
    // reason: `riding` is true of any swim in the shore break, so without it
    // the line was up on 310 of 605 samples of ordinary play. A ride starts
    // when the water has actually taken you somewhere.
    if (game.recordLive && manRideDist > 2) {
      if (!manTookOff) game.recordLive('take-off', manTakeTop);
      else game.recordLive('all-the-way', manRideDist);
    }
    // ...and on the signpost (W1): the ride against the 34 m the sand is at,
    // and how much of it was along the face rather than straight in.
    if (manTookOff && manRideDist > 2 && typeof game.wowLive === 'function' &&
        !(typeof game.taskDone === 'function' && game.taskDone('all-the-way'))) {
      const carveShare = manRideDist > 0 ? manCarveDist / manRideDist : 0;
      game.wowLive('riding · ' + manRideDist.toFixed(0) + ' m of ' + manALL_THE_WAY +
                   (carveShare > 0.35 ? ' · on the face' : '') + ' · ' + speed.toFixed(1) + ' m/s',
                   clamp(manRideDist / manALL_THE_WAY, 0, 1));
    }
    // THE MINI. Not standing up — a capybara does not stand up. The moment is
    // the second and a half where the water stops going past you and starts
    // taking you with it, and four and a half metres a second is a speed the
    // animal cannot reach on its own in water at all (the swim cap is 2.6).
    if (!manTookOff && speed > 4.0 && manRideDist > 4) {
      manTookOff = true;
      manTask(game, 'take-off');
      game.record('take-off', manTakeTop);
      // ---- AND IT IS THE MOMENT, SO IT GETS ONE ------------------------
      // The mini is the second and a half where the water stops going past
      // you and starts taking you with it — and it fired a tick on the card
      // and nothing else. It is a physical event: the animal is suddenly
      // doing four and a half metres a second in water it can only swim at
      // 2.6 in, so it throws a sheet of white off its own shoulders. The
      // score opens with it and the beach turns round (manBathAim).
      manPuffSpray(p.x, manWave.y + 0.35, p.z + 0.9, 8, 1.0);
      game.shake(0.16);
      manSfx.volume = 0.55; manSfx.pitch = 0.9;
      game.sfx('splash', placeCue(manSfx, p.x, manWave.y + 0.3, p.z, 70));
      manRideEndT = Math.max(manRideEndT, 2.2);
    }
  } else if (manRideDist > 0) {
    manRideOff += dt;
    if (manRideOff > 0.9) {
      // THE RIDE IS OVER. Where did it end?
      const onSand = manTerrain(p.x, p.z) > -0.35 && p.z > manSHORE_Z - 12;
      if (manRideDist > manRideBest) manRideBest = manRideDist;
      // ---- ONCE, THE WAY manTookOff IS ONCE -----------------------------
      // `manRideDist >= 34 && onSand` is true of EVERY qualifying ride, so
      // the chapter’s ceremony ran again on every one of them. Measured over
      // eight drift runs from the bank: five identical "all the way to the
      // sand. that is the one." toasts, five forced cheers off a throttle that
      // exists to protect exactly this cue, and five camera shakes. A marquee
      // that happens five times is not a marquee. The RECORD still runs every
      // ride, because a personal best is a thing you beat.
      // 24, NOT 34 (W4). Thirty-four metres is a very good ride — the harness
      // never once reached it, and a stick-and-term run measured nineteen —
      // and the tick is a marquee, not the record. Twenty-four is a wave you
      // took to the sand; the number you rode still files against the par.
      if (manRideDist >= manALL_THE_WAY && onSand) {
        game.record('all-the-way', manRideBest);
        if (!manAllWayDone) {
        manAllWayDone = true;
        manTask(game, 'all-the-way');
        // ---- AND THE CHAPTER'S MARQUEE HAS TO LAND ----------------------
        // It ticked a box on the card and made no noise. A fifty-metre ride
        // that ends with the animal sliding up the sand in front of twenty
        // people is the best thing that happens on this beach and it got less
        // ceremony than knocking a pine cone down. The set piece ends where
        // it ends: a wash of white round the animal, a shake, and the swell
        // taken up for four seconds rather than fired at the tick.
        manPuffSpray(p.x, manWave.y + 0.4, p.z + 1.2, 12, 0.9);
        manRideEndT = 4.0;
        if (typeof game.slowmo === 'function') game.slowmo(0.6, 1.0);
        // SEEN FROM THE SAND (L5): the lens ahead on the beach, the wave behind
        if (typeof game.frameShot === 'function') {
          const v = capy.velocity;
          const heading = v && (Math.abs(v.x) + Math.abs(v.z)) > 0.5 ? Math.atan2(v.x, v.z) : 0;
          game.frameShot({ yaw: heading, dist: 14, pitch: 6 * Math.PI / 180, raise: 1.0, hold: 3.0 });
        }
        if (typeof game.sparks === 'function') game.sparks(p.x, manWave.y + 0.6, p.z, 36, { spd: 4.5, up: 2.5, grav: 9, drag: 0.6, life: 1.1, size: 0.28, rgb: [1.2, 1.45, 1.7] });
        if (typeof game.confetti === 'function') game.confetti(p.x, p.y + 1.0, p.z, 18);
        game.sfx('cheer', { volume: 0.7, pitch: 1.05, force: true });
        manSaysNow('guard',
          ['From the bank to the sand. I timed it. I am not telling you what I got.',
           'That is the wave of the set and you had it the whole way.',
           'You do not stand up, do you. You just... go.'],
          ['Everybody heard. Everybody on the front heard.']);
        manSaysNow('ferry',
          ['The whole boat saw that. They will be talking about it at Circular Quay.',
           'Forty minutes from the middle of the city to a rodent doing THAT.',
           'I am going to describe it badly and nobody is going to believe me.'],
          ['They will hear that at the Quay.']);
        // M4: THE WAVE. This chapter's marquee, and it shook and nothing else.
        if (typeof game.punch === 'function') game.punch(0.30, 0.07); else game.shake(0.30);
        // AND THE WHOLE CHAPTER WAS MONO. 48 game.sfx calls in the file, none
        // carrying an `at:` — the largest audio surface in the game and not one
        // panner in it, against seven positional sites in the Quay. The two cues
        // of the marquee are the ones it costs most: the wash is AT THE ANIMAL,
        // and the beach cheering is at the BEACH, which is behind and above you
        // when you come up the sand.
        manSfx.volume = 0.9; manSfx.pitch = 0.55;
        game.sfx('splash', placeCue(manSfx, p.x, manWave.y + 0.3, p.z, 70));
        // ...AND TWENTY PEOPLE SAW IT. The bathers have been turned to watch
        // the rider all the way in (manBathAim); this is the half-second at
        // the end where the whole beach comes off the ground. `force`,
        // because 'cheer' is on a three-second throttle shared with three
        // other chapters' ambience and this is the one cheer the player is
        // owed — see the note on sfxGap.
        manBathCheer = 2.8;
        manSfx.volume = 0.55; manSfx.pitch = 1.15; manSfx.force = true;
        game.sfx('cheer', placeCue(manSfx, p.x, 1.4, manSHORE_Z + 8, 90));
        manSfx.force = false;
        game.toast('all the way to the sand. that is the one.');
        // ---- FRAMED, AND THE LENS IS TAKEN BACK BEFORE THE MOMENT -------
        //
        // The ride rig releases 0.9 s BEFORE this fires — manRideOff has to
        // clear before the end is judged — so the chapter’s marquee is shot
        // from the STANDING rig, not the surfing one. Measured at the payout:
        // yaw 179.5 degrees (dead astern), 10.9 m out, raised 7.5 m, pitched
        // 43.4 degrees DOWN, framing() 0.00 — two thirds empty sand, looking
        // down on the animal’s back, with no sea, no whitewater and none of
        // the twenty people in it. During the ride itself the rig is giving
        // 22-30 degrees at 11.2-12.9 m, which is the picture this wants.
        //
        // Astern is right — a wave comes in behind you and so does the beach
        // — so it is the DOWN-ANGLE that is wrong. 0.22 rad puts the lens near
        // the animal’s own height with the whitewater and the beach behind it.
        if (typeof game.frameShot === 'function')
          game.frameShot({ yaw: Math.PI, dist: 13.5, pitch: 0.22, raise: 1.8, hold: 2.6 });
        }
      } else if (manRideDist >= 12) {
        game.record('all-the-way', manRideBest);
      }
      manRideDist = 0; manRideOff = 0; manRideTop = 0;
      manCarve = 0; manCarveDist = 0;
    }
  }

  // ---- the rip ---------------------------------------------------------
  const inRip = manInZone('rip', p.x, p.z) && swimming;
  if (inRip && manRipT < 0 && p.z > -12) { manRipT = 0; }
  else if (manRipT >= 0) {
    manRipT += dt;
    // the clock, on the paper, while the rip has hold of you (v32). It is the
    // only live line in this chapter that can be up at the same time as the
    // ride's — and it cannot, because the rip runs out and the ride runs in.
    if (game.recordLive) game.recordLive('the-rip', manRipT);
    if (p.z < manBankZ(p.x) - 6) {
      if (!manRipDone) {
        manRipDone = true;
        manTask(game, 'the-rip');
      }
      game.record('the-rip', manRipT);
      manRipT = -1;
    } else if (!inRip && p.z > 14) manRipT = -1;
    else if (manRipT > 70) manRipT = -1;
  }
  if (!manToldRip && inRip && p.z > 4) {
    manToldRip = true;
    game.toast('this bit is going the other way. do not fight it.');
  }
  // ---- THE SECOND ASK (L6, F2): `gull-out-back` reads perchCount() --------
  // Swimming beyond the bank with a bird on. The perch survives a swim (it
  // is the dive that puts one off, see the perch's own list in systems.js),
  // so the whole row is: keep it on through the white, and do not go under.
  if (!manGullBackDone && swimming && p.z < manBankZ(p.x) - 6 &&
      typeof game.perchCount === 'function' && game.perchCount() >= 1) {
    manGullBackT += dt;
    if (manGullBackT > 1.0) {
      manGullBackDone = true;
      manTask(game, 'gull-out-back');
      game.toast('out the back, with a gull on. it has been out the back before. it is unimpressed.');
    }
  } else manGullBackT = 0;

  // ---- under it, not over it -------------------------------------------
  if (capy.diving && manWave.foam > 0.30 && (capy.depth || 0) > 0.8) {
    manDuckT += dt;
    if (manDuckT > 0.45) { manDuckT = 0; manTask(game, 'duck-dive'); }
  } else if (!capy.diving) manDuckT = 0;

  // ---- the bommie -------------------------------------------------------
  // AND IT IS A DETONATION, NOT A CHECKBOX. A bommie is a rock out the back
  // that stands a swell on end and blows it up, and the task is to be sitting
  // on the thing while that happens to you. For the chapter's whole life it
  // ticked a box in silence: the one set piece in Manly that is a physical
  // event happening TO the player, and it had less feedback than the pine
  // cone. Every time it goes over now — not only the first — because the
  // pleasure of the bommie is that it keeps doing it.
  {
    const onIt = manInZone('bommie', p.x, p.z) && p.y < manWave.y + 1.6;
    const hit = onIt && manWave.foam > 0.4;
    if (hit) manTask(game, 'the-bommie');
    if (hit && !manBommieHit) {
      manBommieHit = true;
      manPuffSpray(manBOMMIE.x + rand(-2, 2), manWave.y + 0.9, manBOMMIE.z + rand(-2, 2), 14, 2.4);
      manPuffSpray(manBOMMIE.x + rand(-4, 4), manWave.y + 0.5, manBOMMIE.z - 3, 8, 1.8);
      game.shake(0.26);
      manSfx.volume = 0.72; manSfx.pitch = 0.48;
      game.sfx('splash', manSfx);
      manSfx.volume = 0.30; manSfx.pitch = 0.36;
      game.sfx('thud', manSfx);
      manRideEndT = Math.max(manRideEndT, 1.8);
    } else if (!hit && manWave.foam < 0.2) manBommieHit = false;
  }

  // ---- the ocean pool ---------------------------------------------------
  if (manInZone('pool', p.x, p.z) && swimming) {
    if (p.z > manPOOL.z1 - 3.5) manPoolEnd = 1;
    else if (p.z < manPOOL.z0 + 3.5 && manPoolEnd === 1) {
      manPoolEnd = 2;
      manTask(game, 'bower-pool');
      manSaysNow('pool',
        ['End to end. Sixty-one years I have swum that. You did it in one breath.',
         'The wall keeps the swell out. Mostly. You would know, you were in it.',
         'Same time tomorrow. I am here whatever the weather does.'],
        ['In MY pool. At this hour.']);
    }
  }

  // ---- the groper -------------------------------------------------------
  if (manGroper && capy.position.distanceTo(manGroper.position) < 3.2) {
    if (!game.taskDone || !game.taskDone('blue-groper')) {
      manSaysNow('fish',
        ['He came to you. He does not come to me and I have been here since five.',
         'Blue means he is old and he is a he. They all start out the other way.',
         'Do not tell anybody. I mean it. Do not tell anybody about Bluey.'],
        ['You will not scare him. Nothing scares him. That is his problem.']);
      manSaysNow('shelly',
        ['That is Bluey. Everybody round here knows Bluey.',
         'He follows the snorkellers about. He is looking for somebody to turn a rock over.',
         'Protected since seventy-four. Somebody speared one and the whole beach lost its mind.'],
        ['Nothing wakes up over here. Not even for that.']);
    }
    manTask(game, 'blue-groper');
  }

  // ---- the sandcastle ---------------------------------------------------
  if (manSandcastle && !manCastleGone) {
    const at = manSandcastle.userData.at;
    const dx = p.x - at.x, dz = p.z - at.z;
    if (dx * dx + dz * dz < 20 && speed > 1.6) {
      manCastleGone = true;
      manSandcastle.visible = false;
      // M4: the sandcastle. A latched one-shot (manCastleGone).
      if (typeof game.punch === 'function') game.punch(0.35); else game.shake(0.35);
      manSfx.volume = 0.6; manSfx.pitch = 0.7;
      game.sfx('thud', manSfx);
      // ---- A CASTLE DOES NOT STOP EXISTING, IT FALLS OVER ----------------
      // `visible = false` and ten motes of spray: the best-modelled small
      // object on this beach — a keep, four towers, four cones — blinked out
      // of the world in one frame and left bare sand. The task's own clue is
      // 'run at it, do not be polite about it', and the entire payoff for
      // doing so was that the thing was suddenly not there.
      //
      // It is a HEAP now: the mound stays, and the towers become four lumps of
      // wet sand lying where they landed, which is what a demolished
      // sandcastle looks like from six metres up and is the only evidence the
      // player has that they were the one who did it.
      if (manCastleRuin) {
        manCastleRuin.visible = true;
        manCastleRuin.position.set(at.x, at.y, at.z);
      }
      manPuffSpray(at.x, at.y + 0.6, at.z, 16, 1.1);
      manPuffSpray(at.x + 1.1, at.y + 0.4, at.z - 1.1, 6, 0.7);
      manPuffSpray(at.x - 1.1, at.y + 0.4, at.z + 1.1, 6, 0.7);
      manTask(game, 'sandcastle');
      // ...and somebody built it. The beach has twenty-nine merged figures on
      // it and not one of them had an opinion about this.
      manCall(game, 'castle', at.x + 3.2, at.y + 0.7, at.z + 2.4,
              'Oh, that took ALL AFTERNOON. That took all afternoon!', 999);
    }
  }

  // ---- the set is coming, and the horizon says so -----------------------
  // The big crest is index 4 of nine, always. `manBigNear` is 0..1 as it
  // approaches the bank, and systems.js reads it for the score and the grade.
  {
    // where the crest that is currently AT the bank would be indexed
    const u = manPhaseAt(0) / (Math.PI * 2) - manTime / manPERIOD;
    let best = 0;
    for (let k = -1; k <= 2; k++) {
      const n = Math.round(u) + k;
      if (manCrestAmp(n) < 0.99) continue;
      // in bank-relative metres: 0 is the crest of the bar, negative is still
      // out the back, positive is already broken and running in
      const s = manCrestS(n);
      const k2 = clamp(1 - Math.abs(s) / 55, 0, 1);
      if (k2 > best) best = k2;
    }
    manBigNear = damp(manBigNear, best, 3, dt);
    if (!manToldSet && best > 0.55 && p.z < manSHORE_Z) {
      manToldSet = true;
      game.toast('that one is bigger than the others.');
    }
    if (best > 0.35) manSeenSet = true;
  }

  // THE LIFT, HELD. The same construction the aurora, the bloom and the
  // sunrise use: swell() takes the max of the live envelope, so calling it
  // every frame of a four-second tail is the documented way to hold one.
  if (manRideEndT > 0) {
    manRideEndT -= dt;
    if (game.music && typeof game.music.swell === 'function') {
      game.music.swell(clamp(manRideEndT / 4.0, 0, 1) * 0.85);
    }
  }

  // ---- and the noise the sea makes, rationed ---------------------------
  if (manWave.foam > 0.55 && Math.random() < dt * 2.2) {
    const far = clamp(Math.abs(p.z - manBANK_Z) / 60, 0, 1);
    manSfx.volume = clamp(0.30 - far * 0.2, 0.05, 0.30);
    manSfx.pitch = rand(0.5, 0.75);
    game.sfx('splash', manSfx);
    if (Math.abs(p.z - manBANK_Z) < 30) {
      manPuffSpray(p.x + rand(-14, 14), manWave.y + 0.5, manBankZ(p.x) + rand(-3, 3), 2, 1.2);
    }
  }

  // =====================================================================
  // THE SOUND OF THE BEACH, AND IT WAS ONLY EVER THE WAVE YOU WERE IN.
  //
  // The one splash above fires off `manWave` at the CAPYBARA'S OWN POSITION,
  // so standing on the dry sand watching a two-metre set unload forty metres
  // away this chapter was completely silent except for the gulls: the sound
  // of surf is not the wave that is touching you, it is the fifty metres of
  // white water either side of you, all the time. The same argument that
  // moved the spray off the observer and onto the break.
  //
  // So: sample the break line at four points across the bay, take how hard it
  // is going and how far away it is, and hold a BED — one 'hiss' on the
  // sound's own 1.2 s throttle, at a level and a pitch that are both
  // functions of the break. It is the only continuous sound in the chapter
  // and it has to be, because a surf beach never stops.
  // =====================================================================
  {
    let loud = 0;
    for (let i = 0; i < 4; i++) {
      const bx = clamp(p.x + (i - 1.5) * 26, manBEACH_X0 + 4, manPOINT_X - 4);
      const bz = manBankZ(bx) + 6;
      manWaveAt(bx, bz, manTime, manWave);
      const d = Math.hypot(bx - p.x, bz - p.z);
      const k = manWave.foam * clamp(1 - d / 95, 0, 1);
      if (k > loud) loud = k;
    }
    // ...and it is LOUDER AND CLOSER when you are in it, which is the only
    // thing that says being out the back is a different place.
    manSurfBed = damp(manSurfBed, loud, 1.4, dt);
    // ---- ...AND THE BREAK IS SOMEWHERE (A1) ---------------------------
    // The driest room in the game, on a beach, and the surf was one-shots on a
    // 1.25-1.85 s throttle — so the sea got BUSIER as it got louder instead of
    // getting NEARER. A shoreline you can walk toward is the most legible
    // spatial cue an open world has, and nineteen of them had none.
    //
    // The bank is single-valued in x, so the nearest point on it is directly
    // offshore of wherever you are standing; the +6 m is the same offset the
    // loop above already uses to sit in the white water rather than on the
    // crest. A bed has no velocity — the sea is not going past you.
    if (!manSurfMover && game.sfxMover) {
      manSurfMover = game.sfxMover('surf', { key: 'man:break', near: 40, far: 220 });
    }
    if (manSurfMover) {
      const sx = clamp(p.x, manBEACH_X0 + 4, manPOINT_X - 4);
      manSurfMover.at(sx, manWATER + 0.5, manBankZ(sx) + 6);
      // The SET clock, not the foam under your feet: what a break does is
      // swell and fall on its own period, and manBigNear is that period as a
      // number the chapter already trusts.
      manSurfMover.set(clamp(0.45 + manBigNear * 0.55, 0, 1));
    }
    manSurfT -= dt;
    if (manSurfT <= 0 && manSurfBed > 0.06) {
      manSurfT = rand(1.25, 1.85);
      manSfx.volume = clamp(0.05 + manSurfBed * 0.20, 0.04, 0.26);
      // deep where it is heavy, thin where it is a wash on the sand
      manSfx.pitch = clamp(1.35 - manSurfBed * 0.75, 0.55, 1.4);
      game.sfx('hiss', manSfx);
    }
  }
  // ---- AND THE SET ANNOUNCES ITSELF ------------------------------------
  // `manBigNear` has run the sky, the grade and the score since the chapter
  // shipped and has never made a sound. The wave of the set standing up out
  // the back is the event the whole eight-and-a-half-second clock is for, and
  // a player looking the other way had no way at all of knowing. One low note
  // as it crosses the bar — once per crest, on an EDGE (a window on a clock
  // that advances by dt is the bug that made the Antarctic skua cry nine
  // times a dive) — and the score opens with it.
  if (manBigNear > 0.62 && manSetToldT <= 0) {
    manSetToldT = manPERIOD * 3.4;
    manSfx.volume = 0.34; manSfx.pitch = 0.44;
    game.sfx('thud', manSfx);
    manSfx.volume = 0.20; manSfx.pitch = 0.52;
    game.sfx('splash', manSfx);
  }
  if (manSetToldT > 0) manSetToldT -= dt;
  if (manBigNear > 0.30 && game.music && typeof game.music.swell === 'function') {
    game.music.swell(clamp((manBigNear - 0.30) / 0.70, 0, 1) * 0.45);
  }

  // ---- AND SOMEBODY SAYS SOMETHING ABOUT IT ----------------------------
  // See manCall. Six lines, all of them about the live state of the chapter,
  // none of them on a timer of its own: they are caused.
  if (manSayCool > 0) manSayCool -= dt;
  const lgX = manFlagX, lgZ = manFlagZ, lgY = manTerrain(lgX, lgZ) + 0.6;
  if (inRip && p.z > -6) {
    // the one thing a lifeguard on this beach exists to shout
    manCall(game, 'rip', lgX, lgY, lgZ,
            'OI! Not there! Come across, not against it!', 26);
  } else if (manRideEndT > 2.2) {
    // ---- THE MARQUEE OUTRANKS THE WEATHER REPORT -----------------------
    // This sat THIRD, behind 'Set! Outside!', in an else-if chain that is
    // further gated by a 3.2 s one-voice lock and a 40 s per-key cooldown —
    // and a big set is exactly what is happening on the frame a big ride
    // ends, because it is the wave you rode. Measured: two ride bubbles
    // across five payouts. The lifeguard announcing the surf while the
    // capybara slides up the sand in front of him is the wrong sentence.
    manCall(game, 'ride', lgX, lgY, lgZ, 'Did anyone else see that?', 40);
  } else if (manBigNear > 0.66 && p.z < manSHORE_Z + 4) {
    manCall(game, 'set', lgX, lgY, lgZ, 'Set! Outside!', manPERIOD * 9);
  } else if (manBoatPhase === 'out' && manBoatT < 1.2 && Math.abs(p.x - manBOAT_HOME.x) < 40) {
    manCall(game, 'boat', -14, manTerrain(-14, 33) + 0.6, 33, 'Boat going out! Heads up!', 70);
  } else if (manGullUp > 0.9 && Math.abs(p.z - manSHOP_Z) < 16) {
    manCall(game, 'gulls', -13.5, manPROM_Y + 0.6, manSHOP_Z + 1.0,
            'That is it. That is the last time.', 55);
  } else if (manFlagHeld) {
    manCall(game, 'flag', lgX, lgY, lgZ, 'Mate. MATE. That is council property.', 50);
  }
}

// ====================================================================== API ==
export function createManly(game) {
  manGame = game;

  game.biome.register('manly', {
    ensureBuilt() { manBuild(game); },
    onEnter() {
      // The sea is put back to twenty seconds before the wave of the set, so a
      // chapter you come back to opens the way it opened the first time — the
      // big one on the horizon and eighty metres of open water to get to it.
      manTime = 4 * manPERIOD - 20;
      manRideDist = 0; manRideOff = 0; manRideTop = 0;
      manCarve = 0; manCarveDist = 0;
      manRipT = -1;
      manDuckT = 0; manPoolEnd = 0; manBigNear = 0; manBommieHit = false;
      manFlagHeld = false; manFlagHeldB = false; manFlagCool = 0; manFlagMovedT = 0;
      manFlagX = manFLAG_HOME.x; manFlagZ = manFLAG_HOME.z;
      manFlagFromX = manFLAG_HOME.x; manFlagFromZ = manFLAG_HOME.z;
      manPlaceFlags();
      manScatterBathers(true);
      manBathLook = 0; manBathCheer = 0;
      manBathAimX = manFLAG_HOME.x; manBathAimZ = -60;
      manSurfBed = 0; manSetToldT = 0;
      manRideEndT = 0; manDolphX = -14; manBoatStroke = 0;
      manGullUp = 0; manGullNext = rand(10, 20); manLipT = 0;
      manSayCool = 0;
      for (const k in manSaid) delete manSaid[k];
      manBoatPhase = 'beached'; manBoatT = 0; manBoatCalled = false;
      manBoatCarrying = false; manBoatOut = false;
      manBoatTarget.x = manBOAT_HOME.x; manBoatTarget.z = manBOAT_HOME.z; manBoatTarget.y = 0.55;
      manBoatPrev.x = manBoatTarget.x; manBoatPrev.y = manBoatTarget.y; manBoatPrev.z = manBoatTarget.z;
      if (manBoatBody) {
        manBoatBody.position.set(manBoatTarget.x, manBoatTarget.y, manBoatTarget.z);
        manBoatBody.velocity.set(0, 0, 0);
        manSyncBody(manBoatBody);
      }
      manDolphActive = false; manDolphWait = rand(22, 40); manDolphNote = 0;
      if (manDolphins) manDolphins.visible = false;
      manPelState = 'stand'; manPelT = 0;
      manConeT = 0;
      if (manConeMesh) manConeMesh.visible = false;
      manUpdateSurface(0);
    },
    onExit() {
      // Anything stateful that could hold the player, cleared on the way out.
      manFlagHeld = false;
      manBoatCarrying = false; manBoatOut = false;
      manRideDist = 0; manRipT = -1; manCarve = 0; manCarveDist = 0;
    },
  });

  const api = {
    /**
     * D4.11, measured. `carve` is the rider's live lateral demand,
     * `carveDist` how much of this ride has been along the crest rather than
     * at the sand, and `rideDist` the record as it now stands.
     */
    /**
     * The flow field at a point, with a carve of your choosing. The ride
     * itself is set-dependent and hard to land from a script; the FIELD is
     * not, and the field is what the mechanic is.
     */
    flowProbe(x, z, carve, dep) {
      const was = manCarve, wasD = manRideDist;
      manCarve = carve || 0;
      manRideDist = Math.max(manRideDist, manCARVE_MIN + 1);   // pretend a ride
      manFlowAt(x, z, manFlowProbeOut, dep || 0);
      const r = { x: Math.round(manFlowProbeOut.x * 1000) / 1000,
                  z: Math.round(manFlowProbeOut.z * 1000) / 1000,
                  foam: Math.round(manWave.foam * 1000) / 1000 };
      manCarve = was; manRideDist = wasD;
      return r;
    },
    surfDebug() {
      return { riding: manRideDist > 0, rideDist: Math.round(manRideDist * 100) / 100,
               carve: Math.round(manCarve * 1000) / 1000,
               carveDist: Math.round(manCarveDist * 100) / 100,
               best: Math.round(manRideBest * 100) / 100,
               top: Math.round(manRideTop * 100) / 100 };
    },
    built() { return manBuilt; },
    terrainHeight: manTerrain,
    slopeAt: manSlope,

    /**
     * THE ONE NEW THING, AND IT IS ONE WORD.
     *
     * capybara.js reads `waterHeightAt(x, z)` instead of the scalar
     * `waterLevel` wherever a biome says so. Thirteen chapters do not say so
     * and cost one property miss. `waterLevel` is still published because
     * everything that only wants to know roughly where the sea is — the fog,
     * the minimap, a prop's rest height on a still day — should get the still
     * water level and not whatever a wave happens to be doing this frame.
     */
    localWater: true,
    waterLevel: manWATER,
    isOverWater: manIsOverWater,
    waterHeightAt: manSurfY,
    /** THE WATER IS GOING SOMEWHERE. The Uji's channel, on a beach. `dep` is
     *  how deep the thing being pushed is; omit it and you get the surface. */
    flow(x, z, dep) { return manFlowAt(x, z, manFlow, dep); },
    /**
     * THE SECOND CHAPTER TO PUBLISH IT, and here it is not a sightseeing verb
     * but the answer to a specific question: what do you do about two hundred
     * tonnes of white water coming at you. You go under it. Every surfer on
     * that beach does it forty times an hour.
     */
    canDive: true,
    airControl: 0.38,

    inZone: manInZone,
    navBlocked: manNavBlocked,
    surfacePitch: manSurfacePitch,
    surfaceMat: function () { return manSurfMat; },
    SPAWN: manSPAWN,

    /**
     * THE LENS, AND IT ONLY MOVES FOR ONE THING. A ride is fast, low and
     * shoreward, and the standing rig looks down at it from six metres up
     * where a wave is a pale stripe. Asked for only while the water is
     * actually carrying the animal: back a little, down a lot.
     */
    rig() {
      const capy = game.capy;
      if (!capy || !capy.body) return null;
      const sp = Math.sqrt(capy.velocity.x * capy.velocity.x + capy.velocity.z * capy.velocity.z);
      const w = clamp((sp - 3.6) / 2.6, 0, 1) * clamp(manRideDist / 6, 0, 1);
      if (w <= 0.01) return null;
      return { w: w, dist: 12.5, pitch: 0.26, raise: 0.2, lambda: 2.0 };
    },

    // landmarks — the beacons, the minimap and the to-do card read these
    beach: { x: 0, z: manSHORE_Z + 5 },
    flags() { manV3b.set(manFlagX, manTerrain(manFlagX, manFlagZ), manFlagZ); return manV3b; },
    pines: { x: 0, z: manPINE_Z },
    club: { x: 24, z: 47 },
    rip: { x: manRIP_X, z: 6 },
    bank() { manV3b.set(0, 0, manBankZ(0)); return manV3b; },
    /** The nearest silver gull, for `gull-out-back` (L6, F2). Its own scratch vector. */
    gullAt() {
      const cp = manGame && manGame.capy && manGame.capy.position;
      if (!manGullData) return null;
      let bq = -1, bd = Infinity;
      for (let i = 0; i < manGULL_N; i++) {
        const q = i * 7;
        const d = cp ? (manGullData[q] - cp.x) * (manGullData[q] - cp.x) + (manGullData[q + 2] - cp.z) * (manGullData[q + 2] - cp.z) : 0;
        if (d < bd) { bd = d; bq = q; }
      }
      if (bq < 0) return null;
      manV3gull.set(manGullData[bq], manGullData[bq + 1], manGullData[bq + 2]);
      return manV3gull;
    },
    bommie: { x: manBOMMIE.x, z: manBOMMIE.z },
    pool: { x: (manPOOL.x0 + manPOOL.x1) * 0.5, z: (manPOOL.z0 + manPOOL.z1) * 0.5 },
    shelly: { x: manSHELLY.x, z: manSHELLY.z },
    castle: { x: 12, z: manSHORE_Z + 6.5 },

    /** The boat MOVES — ask, never cache. */
    boat() {
      if (!manBoatBody) return manBOAT_HOME;
      manV3b.set(manBoatBody.position.x, manBoatBody.position.y, manBoatBody.position.z);
      return manV3b;
    },
    /** ...and it is a declared reference frame while you are standing in it. */
    carryFrame() { return manBoatCarrying ? manBoatFrame : null; },

    /**
     * THE WHOLE SEA AT ONE POINT, for anything that needs more than its
     * height: how big it is, whether it is breaking, which way its face is
     * looking and how hard it is pushing. It hands back the module's own
     * scratch — read it, do not keep it.
     */
    wave(x, z) { return manWaveAt(x, z, manTime, manWave); },
    /** 0..1 — the wave of the set, coming. systems.js lifts the score on it. */
    setNear() { return manBigNear; },
    seenSet() { return manSeenSet; },
    riding() { return manRideDist > 3; },
    rideDist() { return manRideDist; },
    /** Where the flags are, for the exit test. */
    atFlags(x, z) { return manInZone('flags', x, z); },
    surfHeight(x, z) { return manSurfY(x, z); },

    /** W1: the barrel, for the harness — force it up, or read it. */
    barrelDebug(force) { if (force !== undefined) manBarrelForce = !!force; return { k: +manBarrel.toFixed(2), t: +manBarrelT.toFixed(2), best: +manBarrelBest.toFixed(2), beat: manBarrelBeat }; },
    update(dt) {
      if (!manBuilt) return;
      if (!game.biome.isActive('manly')) return;
      manTime += dt;

      manUpdateSurface(dt);
      manUpdateFoam(dt);
      manUpdateHaze(dt);
      manUpdateLip(game, dt);
      manUpdateSpray(dt);
      manUpdateBoat(game, dt);
      manUpdateBathers(game, dt);
      manUpdateGulls(game, dt);
      manUpdateBuoys();
      manUpdateDolphins(game, dt);
      manUpdatePelican(game, dt);
      manUpdateGroper(game, dt);
      manUpdateFlags(game, dt);
      manUpdateCone(game, dt);
      manUpdateSurfTasks(game, dt);
      // THE MUSICIAN (L7, F2): the mallet, on the Corso.
      if (!manTuneMv && typeof game.sfxMover === 'function') {
        manTuneMv = game.sfxMover('tune', { key: 'manly:musician', biome: 'manly' });
      }
      if (manTuneMv && manLocals.musician) {
        manTuneMv.at(manLocals.musician.x, manLocals.musician.y + 1.0, manLocals.musician.z);
      }
    },
  };
  game.manly = api;
  return api;
}
