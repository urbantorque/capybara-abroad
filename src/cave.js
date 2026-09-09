import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PALETTE, mat, EMIT_OVER, emitSet, rand, randInt, clamp, damp, lerp, grain, swayMesh, makeMerger } from './shared.js';

// ===========================================================================
// CHAPTER 16 — SƠN ĐOÒNG. AND THE ONLY LIGHT IS THE ONE YOU MAKE.
//
// Fifteen chapters and this game has never once turned the lights off. It has
// been night four times — Reykjavik, the Drift, Mong Kok, the hour before
// dawn over Göreme — and every one of those is a night with a SKY in it, which
// is to say a night you can see perfectly well. There has never been a place
// in it where the problem was not knowing where the floor is.
//
//   THE ONE NEW VERB, AND IT IS A KEY THE PLAYER HAS HAD SINCE CHAPTER ONE.
//
// Press Q in the dark and the cave answers. A pulse of light goes out from the
// animal, lights whatever it reaches, and dies — so the wheek, which for
// fifteen chapters has been a noise you make because it is funny, is the torch.
// That is not a new control and it is not a new button: CONTRACT.md, ONE
// VOICE — a capybara has one mouth and the CONTEXT decides what the noise
// means. It has meant hello, a condor, a ferry's horn, a burst of lift in the
// Drift and a ticket out of a chapter. Here it means "where am I".
//
// THREE THINGS MAKE LIGHT IN HERE AND THEY ARE THE WHOLE PALETTE:
//
//   1. THE ECHO. Yours, on a one-second clock, and it reaches forty metres.
//   2. THE GLOW-WORMS. Faint, permanent, and they are the map: they follow the
//      river, because that is where the insects are.
//   3. THE DOLINE. Two hundred and fifty metres up, the roof has fallen in,
//      and there is a jungle growing on the floor underneath the hole. That is
//      not invented — it is the single most photographed thing in Vietnam, and
//      it is the marquee.
//
// THE SHAPE OF THE CHAPTER IS A LINE, and every step of it is darker until the
// one that is not:
//
//   z  80..52   OUTSIDE. jungle, daylight, and a river going into a hole.
//   z  52..34   THE ENTRANCE. the last of the light, and a slope.
//   z  34..-28  THE GREAT PASSAGE. ninety metres across, sixty to the roof,
//               black. The river down one side and the Hand of Dog in it.
//   z -30..-66  THE DOLINE. the roof is gone and there is a forest in here.
//   z -66..-104 dark again, and then a wall of calcite across the whole thing.
//   z-104..-150 the far side: pearls, a roost, and a fish with no eyes.
//   z-150..-176 THE SLOT, which is daylight, and is the way out.
//
// Everything is prefixed `cav` (contract: the bundler flattens every module
// into one scope).
// ===========================================================================

// ---------------------------------------------------------------- geography --
const cavSPAWN = { x: 0, y: 4.0, z: 62 };
const cavWATER = -7.4;               // the river surface, and it is a long way down

const cavMOUTH_Z = 50;               // where the roof starts
const cavDOLINE = { x: 4, z: -48, r: 26 };
const cavHAND = { x: 16, z: -4 };    // the big stalagmite
const cavROOST = { x: -30, z: -126 };
const cavPEARLS = { x: 22, z: -132 };
// ...AND IT WAS IN THE RIVER. The river runs at x = cavRIVER_X (−20) with a
// half-width of cavRIVER_W (15), so it occupies x ∈ [−35, −5] for the whole
// length of the passage — and the phytokarst landmark was at x = −12, which is
// eight metres inside it. The hint arrow for 'Find the garden that leans'
// pointed at open water, the tick fired while you were swimming, and the first
// thing built there (a hundred rock fins) came out standing in the channel.
// East side, on the near rim of the doline, where the light actually reaches
// and where the animal is already walking on its way down from the Hand.
const cavPHYTO = { x: 15, z: -28 };
const cavEXIT_Z = -168;
// WHERE cavTerrain STOPS ANSWERING. See the domain note at the top of it.
const cavDOM_X0 = -110, cavDOM_X1 = 110;
const cavDOM_Z0 = -252, cavDOM_Z1 = 97;
const cavWALL = { z: -104, top: 13.5, foot: -10.5 };
const cavRIVER_X = -20;
const cavRIVER_W = 15;

// ------------------------------------------------------------------ state --
let cavGame = null;
let cavBuilt = false;
let cavRoot = null;
let cavTime = 0;

// THE ECHO
let cavEchoLight = null, cavEchoRing = null, cavEchoRingMat = null;
let cavEchoT = -1, cavEchoCool = 0;
let cavEchoX = 0, cavEchoY = 0, cavEchoZ = 0;
const cavECHO_LIFE = 2.3;
const cavECHO_REACH = 46;
const cavECHO_COOL = 1.05;

// the glow-worms
let cavWorms = null, cavWormMat = null;
// ...AND THEY GO OUT WHEN YOU SHOUT. Arachnocampa really do: the glow is a
// chemical lure and a larva that is disturbed drops it in about a second and
// takes half a minute to bring it back. So the one navigation aid in the
// chapter is switched OFF by the one verb the chapter is about, which is the
// best sentence in it and it had never been written.
let cavWormDim = 0;

// the drips, which is the sound and the sight of a cave and there were none
const cavDRIP_N = 26;
const cavDRIP_HIT = 1.15;   // m of the column that counts as under it — see soaking()
const cavSOAK_T   = 4.0;    // s under a drip to get as damp as a drip can make you
const cavSOAK_MAX = 0.62;   // ...and that is damp, never the 1.0 the river gives
let   cavSoakT    = 0;
const cavV3d = new THREE.Vector3();   // nearestDrip's OWN scratch
let cavDripMesh = null, cavDripData = null;
let cavRingMesh = null, cavRingMat = null;
const cavRING_N = 12;
const cavRingD = new Float32Array(cavRING_N * 4);   // x, y, z, t
let cavRingHead = 0;

// the crickets, and the palette has been carrying a colour for them all along
const cavCRICK_N = 40;
let cavCricks = null, cavCrickData = null;
let cavCrickScat = 0;

// the fall through the hole in the roof, and the spray at the bottom of it
let cavFallMesh = null, cavFallMist = null;

// THE MOTES IN THE SHAFT, and they are the whole reason a beam of light reads
// as a beam rather than as a painted cone. Every photograph anybody has taken
// of the doline is a column of dust two hundred metres tall — you cannot see
// air, you can only see what is floating in it, and the chapter's marquee had
// nothing floating in it at all. They also give the room a SIZE: a speck
// drifting past the lens and a speck drifting past the far wall are the same
// object at two very different scales, which is a depth cue nothing else here
// provides.
const cavMOTE_N = 260;
let cavMotes = null, cavMoteData = null, cavMoteStir = 0;

// the expedition. Nobody has ever been in this cave alone.
// ...and the stove, which is the only warm light in the chapter. See cavBuildCamp.
let cavStove = null, cavStoveFlame = null;
let cavWallLamp = null, cavWallLampMesh = null;   // the marker at the top of the Great Wall
const cavLampAt = [];
const cavLampCone = [];

// the returns off the walls, on the frame clock
const cavEchoBack = [-1, -1, -1];
const cavEchoBackV = [0, 0, 0];

// the shaft
let cavShaftMesh = null, cavSkyDisc = null, cavShaftLight = null, cavShaftLow = null;
let cavMist = null;

// ---------------------------------------------------------------------------
// ...AND THE CHAPTER LOOKS UP.
//
// Every vertical thing in this chapter — a hole a hundred and forty metres
// across, two hundred and ten metres of shaft standing on the floor under it,
// a two-hundred-metre waterfall, an arch with a cloud pouring out of it and a
// slot of daylight at the far end — is ABOVE the animal, and the follow rig
// looks forty-one degrees DOWN. Photographed standing on the hint arrow's own
// target, at the moment `the-doline` ticks and the banner goes up, the marquee
// of chapter 16 is a photograph of some ferns.
//
// systems.js has had the answer since chapter 7: publish `skyward()` and the
// rig cranes to eleven degrees and steps back. Iceland is the only chapter
// that ever asked. Three places here want it and one of them is the wow.
const cavSKY_DOLINE = 0.92;   // under the hole. The whole reason to be here.
const cavSKY_SLOT   = 0.34;   // the way out: a chink forty metres up a wall
const cavSKY_MOUTH  = 0.40;   // the arch, and the cloud coming out of it
let cavSkyK = 0;

// --- AND THERE IS SOMETHING IN THE COLUMN. See cavBuildShaftLife -----------
// The doline is a light with nothing in it. Sơn Đoòng's is not: swifts pour in
// and out of the hole all day, and what a two-hundred-metre column of lit air
// actually shows you is the litter of the forest two hundred metres up coming
// down through it, very slowly, one leaf at a time. Both are only readable at
// all now the rig cranes — and between them they are the difference between a
// beam and a place with weather in it.
const cavSWIRL_N = 16;
let cavSwirl = null, cavSwirlPh = null;
const cavFALL_N = 34;
let cavFallLeaf = null, cavFallLeafD = null;

// ---------------------------------------------------------------------------
// THE GARDEN THAT LEANS, WHICH DID NOT EXIST.
//
// `phytokarst` — 'Find the garden that leans' — was the only line on chapter
// 16's card with NO OBJECT BEHIND IT. It ticked at nine and a half metres from
// (−12, −34), the hint arrow pointed at (−12, −34), and there was nothing at
// (−12, −34) but doline floor: the note by the wood says the leaning trees are
// "also the answer to the phytokarst line", and they are twenty metres away
// and are trees. A player who followed the arrow walked to a patch of ground,
// heard a tick, and never found out what a phytokarst was.
//
// It is a real and very odd thing and it deserves its own object. Limestone
// that has been eaten by photosynthetic algae grows in thin blades and combs
// that all lean the same way — AT THE LIGHT — so a phytokarst garden is a
// field of rock fins, green on the side that faces the opening and bare grey
// on the side that does not, and the entire field is a compass needle pointing
// at a hole you cannot see yet. This one sits on the near rim of the doline,
// which is the first green thing you meet coming down the passage.
const cavPHY_N = 104;
let cavPhyBlades = null, cavPhyD = null;
let cavPhyShake = 0, cavPhyDone = false;
const cavSPORE_N = 54;
let cavSpores = null, cavSporeD = null;

// -- the slot at the far end, which is the way out. See cavBuildExit --------
let cavExitLight = null, cavExitBeam = null;
const cavSLOT_MOTE_N = 130;
let cavSlotMotes = null, cavSlotMoteD = null;
let cavSeenSlot = false;

// the river and what is on it
let cavBreath = null;             // the cloud pouring out of the mouth
let cavRiverMesh = null;
let cavLog = null, cavLogBody = null;
let cavLogT = 0, cavLogCarrying = false, cavLogRide = 0;
const cavLogTarget = { x: 0, y: 0, z: 0 };
const cavLogPrev = { x: 0, y: 0, z: 0 };
const cavLogFrame = { x: 0, z: 0 };
let cavFish = null, cavFishT = 0, cavFishBolt = 0;

// the swiftlets
let cavSwifts = null;
const cavSWIFT_N = 90;
let cavSwiftX = null, cavSwiftY = null, cavSwiftZ = null, cavSwiftPh = null;
let cavSwiftHX = null, cavSwiftHY = null, cavSwiftHZ = null;   // where each one lives
let cavSwiftUp = 0, cavSwiftBest = 0, cavSwiftPeak = 0, cavSwiftOwn = 24;
let cavSwiftClick = 0, cavRoostFace = -40, cavSwiftMine = false;
let cavRiverT = 0, cavFallT = 0;   // positional ambience clocks. See cavUpdateSound

// tasks
let cavSeenLight = false, cavDayK = 0;
let cavWallT = -1, cavWallDone = false;
let cavRiverSwum = 0;
let cavToldEcho = false, cavToldWorms = false, cavToldDim = false, cavToldOpen = false;
let cavToldPhyto = false;
let cavPearlOne = null, cavPearlTook = false;

// scratch
const cavV3 = new THREE.Vector3();
const cavV3b = new THREE.Vector3();
const cavQ = new THREE.Quaternion();
const cavAxisY = new THREE.Vector3(0, 1, 0);
const cavE = new THREE.Euler();
const cavSc = new THREE.Vector3();
const cavM = new THREE.Matrix4();
const cavCol = new THREE.Color();
const cavColB = new THREE.Color();
const cavSfx = { volume: 1, pitch: 1 };
const cavHold = { nx: 0, nz: 0, top: 0 };
const cavFlow = { x: 0, z: 0 };

function cavXform(x, y, z, rx, ry, rz, sx, sy, sz) {
  cavV3.set(x, y, z);
  cavE.set(rx, ry, rz);
  cavQ.setFromEuler(cavE);
  cavSc.set(sx, sy, sz);
  cavM.compose(cavV3, cavQ, cavSc);
  return cavM;
}

const cavG = { box: null, cyl6: null, cyl8: null, cyl4: null, cone6: null, cone8: null,
               sph6: null, sph8: null };
function cavInitGeos() {
  if (cavG.box) return;
  cavG.box = new THREE.BoxGeometry(1, 1, 1);
  cavG.cyl6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
  cavG.cyl8 = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
  cavG.cyl4 = new THREE.CylinderGeometry(0.5, 0.5, 1, 4);
  cavG.cone6 = new THREE.ConeGeometry(0.5, 1, 6);
  cavG.cone8 = new THREE.ConeGeometry(0.5, 1, 8);
  cavG.sph6 = new THREE.SphereGeometry(0.5, 6, 4);
  cavG.sph8 = new THREE.SphereGeometry(0.5, 8, 6);
}

/** CONTRACT: box() takes FULL extents, CANNON.Box takes HALF. */
function cavMerger() {
  return makeMerger(cavG, {
    xform: cavXform, cylSegs: [4, 8], coneSegs: [8], sphSegs: [8], normals: 'recompute',
  });
}

function cavVC() {
  return grain(mat(0xffffff, { vertexColors: true }),
               { scale: 0.32, amount: 0.14, warp: 0.6, near: 0.34, nearScale: 10, contact: 1 });
}
function cavVCG() {
  return grain(mat(0xffffff, { vertexColors: true }),
               { scale: 0.28, amount: 0.22, warp: 0.25, near: 0.70, nearScale: 11, contact: 1, broad: 0.11, broadM: 12 });
}
/**
 * ANYTHING IN HERE THAT GIVES OFF LIGHT IS BUILT WITH THIS.
 *
 * A Lambert box in a chapter whose ambient is 0.11 is a dark grey pebble, and
 * a glow-worm that is a dark grey pebble is not a glow-worm. The emissive term
 * IS what a light source is; it lives on MeshLambertMaterial, so this stays
 * inside the aesthetic law, and the composite pass blooms it because chapter
 * 16 has the lowest threshold in the game.
 */
function cavGlow(color, intensity, opacity) {
  const o = { emissive: color, emissiveIntensity: (intensity === undefined ? 1 : intensity) * EMIT_OVER };
  if (opacity !== undefined) { o.transparent = true; o.opacity = opacity; o.depthWrite = false; }
  return mat(color, o);
}

function cavSyncBody(b) {
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
  b.previousQuaternion.copy(b.quaternion);
  b.interpolatedQuaternion.copy(b.quaternion);
}
/**
 * ONE COMPOUND BODY PER CLUSTER, for the same reason every other chapter grew
 * one: forty doline trees, forty-four stalagmites and forty boulders is a
 * hundred and twenty broadphase entries done naively, and this chapter was
 * already the heaviest in the game at a hundred and thirty-nine bodies.
 */
function cavPoolBody(game) {
  const b = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC,
                              material: (game.mats && game.mats.ground) || undefined });
  b.allowSleep = true;
  return b;
}
function cavPoolBox(b, x, y, z, hx, hy, hz, ry) {
  // ...AND IT TAKES A YAW NOW. cannon's addShape has always accepted a per-
  // shape orientation and this helper threw it away, which is why every
  // collider in the chapter was axis-aligned — fine for a boulder, wrong for
  // anything round, because a box collider for a circular spire is either too
  // fat at its diagonals or too thin at its flats. Two boxes at forty-five
  // degrees is an octagon, and an octagon is within five per cent of a circle.
  if (ry) {
    cavQ.setFromAxisAngle(cavAxisY, ry);
    b.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)), new CANNON.Vec3(x, y, z),
               new CANNON.Quaternion(cavQ.x, cavQ.y, cavQ.z, cavQ.w));
    return b;
  }
  b.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)), new CANNON.Vec3(x, y, z));
  return b;
}
function cavPoolDone(game, b) {
  if (!b.shapes.length) return null;
  cavSyncBody(b);
  game.world.addBody(b);
  return b;
}
function cavStaticBox(game, x, y, z, sx, sy, sz, ry) {
  const b = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
  b.addShape(new CANNON.Box(new CANNON.Vec3(sx * 0.5, sy * 0.5, sz * 0.5)));
  b.position.set(x, y, z);
  if (ry) b.quaternion.setFromEuler(0, ry, 0);
  cavSyncBody(b);
  game.world.addBody(b);
  return b;
}
function cavSmooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

// ================================================================= TERRAIN ==
/**
 * THE FLOOR. It goes down, and then it goes up over a wall of calcite.
 *
 * The Great Wall is NOT in the heightfield and could not be: it is a vertical
 * face, and a heightfield at any sane cell size turns a vertical face into a
 * ramp that capybara.js's analytic backstop will happily levitate the animal
 * up at three metres a second — which would make the one climb in the chapter
 * a walk. Same decision as Palawan's karst and Hong Kong's tong lau: it is a
 * static box with rock drawn on it, and this function answers only for what
 * you can stand on either side of it.
 */
function cavTerrain(x, z) {
  // ---- A LAW HAS A DOMAIN (integrity 2, and the same bug as Manly) --------
  // This one had NO x term in its domain at all: every branch is a curve in z,
  // so the law described a floor for the entire infinite plane either side of
  // a passage that is 214 m wide. Past cavMOUTH_Z it also climbed a jungle
  // slope to 7 m and held it northward for ever, and past cavEXIT_Z it held
  // cavWALL.top - 6.5 southward for ever.
  //
  // Measured before this: 4 of 16 settle points within 62 m of the spawn had
  // NOTHING drawn beneath them, and the chapter's drawn world is the shortest
  // in the game at 72 m. A cave is an interior; a law that answers outside it
  // is describing rock that is not there.
  //
  // Rectangle from biome.boundsOf(): x -107..107, z -249..94, plus three.
  // NaN is the designed reply — see the longer note in manly.js.
  if (x < cavDOM_X0 || x > cavDOM_X1 || z < cavDOM_Z0 || z > cavDOM_Z1) return NaN;
  let h;
  if (z > cavMOUTH_Z) {
    // outside: jungle floor, sloping gently down to the hole in the cliff
    h = 2.0 + (z - cavMOUTH_Z) * 0.055;
    if (h > 7) h = 7 + (h - 7) * 0.2;
  } else if (z > 30) {
    // the entrance slope, and it is the last daylight
    h = lerp(2.0, -5.2, cavSmooth((cavMOUTH_Z - z) / 20));
  } else if (z > cavWALL.z) {
    // the great passage. Broad, uneven, and it drifts down as you go in.
    h = lerp(-5.2, -6.6, cavSmooth((30 - z) / 134));
    h += 1.4 * Math.sin(x * 0.038) * Math.cos(z * 0.026)
       + 0.7 * Math.sin((x * 0.6 + z) * 0.055 + 1.2);
    // the boulder chokes: two of them, and they are the only relief in here
    h += 3.2 * Math.exp(-((x - 26) * (x - 26) + (z + 76) * (z + 76)) / 400);
    h += 2.6 * Math.exp(-((x + 30) * (x + 30) + (z - 14) * (z - 14)) / 460);
    // the floor of the doline is a good deal higher: it is made of the roof
    const ddx = x - cavDOLINE.x, ddz = z - cavDOLINE.z;
    const dd = Math.sqrt(ddx * ddx + ddz * ddz);
    if (dd < cavDOLINE.r + 12) h += 3.4 * cavSmooth((cavDOLINE.r + 12 - dd) / 20);
  } else {
    // beyond the wall, and it is a great deal higher, which is why the wall
    h = lerp(cavWALL.top - 3.0, cavWALL.top - 6.5, cavSmooth((cavWALL.z - z) / 60));
    h += 1.1 * Math.sin(x * 0.05) * Math.cos(z * 0.031);
    if (z < cavEXIT_Z + 8) h = lerp(h, cavWALL.top - 1.0, cavSmooth((cavEXIT_Z + 8 - z) / 12));
  }
  // ---- THE RIVER, cut LAST, after everything else -----------------------
  // Cut the channel after every shelf or a shelf blend erases it — the Uji
  // rule, and it cost an hour there.
  if (z < 44 && z > -96) {
    const t = Math.abs(x - cavRIVER_X) / cavRIVER_W;
    if (t < 1.5) {
      const k = cavSmooth((1.5 - t) / 0.85);
      h = lerp(h, cavWATER - 2.6, k);
    }
  }
  return h;
}
function cavSlope(x, z) {
  const e = 1.5;
  const hx = cavTerrain(x + e, z) - cavTerrain(x - e, z);
  const hz = cavTerrain(x, z + e) - cavTerrain(x, z - e);
  return Math.sqrt(hx * hx + hz * hz) / (2 * e);
}
/** The roof, which is the sky here. Two hundred and fifty metres of it. */
function cavRoofH(x, z) {
  if (z > cavMOUTH_Z) return 400;
  let r = 44 + 16 * Math.sin(x * 0.021 + 1.4) + 9 * Math.sin(z * 0.018);
  if (z > 30) r = lerp(14, r, cavSmooth((cavMOUTH_Z - z) / 22));
  if (z < cavWALL.z) r = lerp(r, 30, cavSmooth((cavWALL.z - z) / 40));
  // TWENTY-SEVEN, NOT SIXTEEN, AND IT IS A CAMERA BUG RATHER THAN A TASTE ONE.
  // Beyond the wall the floor stands at 12.5 m and this used to bring the roof
  // down to 16, which is THREE AND A HALF METRES of room — and the follow rig
  // sits about eight metres above the animal. Photographed from inside the exit
  // zone, the LAST SHOT OF THE CHAPTER was a completely black frame, because
  // the camera was inside the ceiling. The slot is what makes this end read as
  // narrow; the roof does not have to do it as well.
  if (z < cavEXIT_Z + 14) r = lerp(r, 27, cavSmooth((cavEXIT_Z + 14 - z) / 16));
  return r;
}
/** Is this bit of roof missing? 1 inside the doline, 0 outside it. */
function cavHole(x, z) {
  const dx = x - cavDOLINE.x, dz = z - cavDOLINE.z;
  const d = Math.sqrt(dx * dx + dz * dz * 1.35);
  return cavSmooth((cavDOLINE.r - d) / 7);
}

function cavIsOverWater(x, z) {
  if (z > 44 || z < -96) return false;
  return cavWATER > cavTerrain(x, z) + 0.22;
}
function cavWaterHeightAt() { return cavWATER; }
/** It is going the same way you are, which is the only helpful thing in here. */
function cavFlowAt(x, z, out) {
  out.x = 0; out.z = 0;
  if (z < 44 && z > -94) {
    const t = Math.abs(x - cavRIVER_X) / cavRIVER_W;
    if (t < 1.0) out.z = -2.4 * cavSmooth((1.0 - t) / 0.7);
  }
  return out;
}

/**
 * HOW MUCH NATURAL LIGHT IS ON THIS SPOT. 0 in the passage, 1 outside, and 1
 * under the hole in the roof.
 *
 * systems.js reads this for the whole atmosphere — the fog, the hemisphere,
 * the ambient, the sun and the grade's threshold — so it is the one number
 * that says what this chapter LOOKS like at any moment, and there are exactly
 * three places in a hundred and seventy metres where it is not zero.
 */
function cavDaylightAt(x, z) {
  // outside, and the last of it at the entrance
  let d = cavSmooth((z - 30) / 22);
  // the doline
  const dx = x - cavDOLINE.x, dz = z - cavDOLINE.z;
  const dd = Math.sqrt(dx * dx + dz * dz * 1.2);
  d = Math.max(d, cavSmooth((cavDOLINE.r - 2 - dd) / 14));
  // and the slot at the far end
  d = Math.max(d, cavSmooth((cavEXIT_Z + 22 - z) / 20) * 0.85);
  return clamp(d, 0, 1);
}

function cavInZone(name, x, z) {
  switch (name) {
    case 'outside':  return z > cavMOUTH_Z;
    case 'passage':  return z < 30 && z > cavWALL.z;
    case 'doline': {
      const dx = x - cavDOLINE.x, dz = z - cavDOLINE.z;
      return dx * dx + dz * dz * 1.2 < (cavDOLINE.r - 4) * (cavDOLINE.r - 4);
    }
    case 'river':    return Math.abs(x - cavRIVER_X) < cavRIVER_W && z < 44 && z > -96;
    case 'wall':     return Math.abs(z - cavWALL.z) < 14;
    case 'roost':    return Math.abs(x - cavROOST.x) < 18 && Math.abs(z - cavROOST.z) < 18;
    case 'pearls':   return Math.abs(x - cavPEARLS.x) < 12 && Math.abs(z - cavPEARLS.z) < 12;
    case 'exit':     return z < cavEXIT_Z + 10 && Math.abs(x) < 20;
    case 'phyto': {
      const dx = x - cavPHYTO.x, dz = z - cavPHYTO.z;
      return dx * dx / (15 * 15) + dz * dz / (11 * 11) < 1;
    }
    default: return false;
  }
}
function cavNavBlocked(x, z, r) { return cavIsOverWater(x, z); }
/** < 0.9 soft, ~1.0 stone, > 1.15 hollow timber. It is a cave: it is stone. */
/**
 * FOUR ROWS FOR TWO HUNDRED AND FIFTY METRES OF CAVE, AND NINE LANDMARKS.
 *
 * A surface ladder must ask the chapter where things are (v25, the Quay), and
 * this asked about two places. Everything else — the river gravel, the guano
 * floor under the roost, the pearl rimstone, the phytokarst fins in the slot —
 * fell through to 1.0, bare rock, in the chapter whose whole subject is what
 * the ground sounds like when you cannot see it. Every zone below is one the
 * chapter already publishes.
 */
function cavSurfacePitch(x, z, y) {
  if (z > cavMOUTH_Z) return 0.82;                   // leaf litter, outside
  if (cavInZone('doline', x, z)) return 0.86;        // and under the hole
  if (cavInZone('river', x, z)) return 0.92;         // wet gravel, and it grinds
  if (cavInZone('roost', x, z)) return 0.70;         // guano, deep and soft
  if (cavInZone('pearls', x, z)) return 1.18;        // rimstone, and it is hollow
  if (cavInZone('phyto', x, z)) return 1.12;         // phytokarst, sharp and dry
  if (Math.abs(z - cavWALL.z) < 16) return 1.08;     // calcite rings
  return 1.0;
}

/**
 * THE CLIMB — the third chapter to publish it, after Mong Kok and Göreme.
 *
 * A biome answers with the outward normal of the face within reach and the
 * height clinging stops at; capybara.js owns everything else. Two things about
 * the band are not guessable and were both measured in chapter 11:
 *
 *   - IT MUST REACH THROUGH THE WALL. The cling pulls the animal toward the
 *     face and the collider stops it half a metre further in, so a band that
 *     ends AT the face lets go on the frame after it takes hold.
 *   - `top` MUST BE ABOVE THE DECK IT SERVES. Clinging stops the moment the
 *     animal is past it and hands over the last shove; a top level with the
 *     ledge leaves the animal airborne at 3.5 m/s, which under a full gravity
 *     buys twenty-six centimetres, and every successful climb ends in a slide
 *     back down.
 */
function cavClimbAt(x, y, z) {
  const dz = z - cavWALL.z;
  // SIX AND A HALF METRES, and it has to be: the wall collider is eight metres
  // deep, so its outer face is four from the middle, and a capybara pressed
  // against that face has its CENTRE another seventy centimetres out. A band
  // that stopped at the face never fired at all — measured, the animal walked
  // into the wall and stood there. It reaches through the rock as well, for
  // the reason in chapter 11: the cling pulls the animal INTO the face.
  if (Math.abs(dz) > 6.5) return null;
  if (Math.abs(x) > 44) return null;
  if (y < cavWALL.foot - 1.5 || y > cavWALL.top + 2.5) return null;
  // the face you can reach is the one you are on the outside of
  cavHold.nx = 0;
  cavHold.nz = dz >= 0 ? 1 : -1;
  cavHold.top = cavWALL.top + 1.6;
  return cavHold;
}

// ================================================================== BUILDING ==
function cavBuild(game) {
  if (cavBuilt) return;
  cavBuilt = true;
  cavInitGeos();

  cavRoot = new THREE.Group();
  cavRoot.name = 'cave';
  game.scene.add(cavRoot);

  cavBuildFloor(game, cavRoot);
  cavBuildCollision(game);
  cavBuildRoof(cavRoot);
  cavBuildWalls(game, cavRoot);
  cavBuildOutside(game, cavRoot);
  cavBuildFormations(game, cavRoot);
  cavBuildPassageFloor(game, cavRoot);
  cavBuildWall(game, cavRoot);
  cavBuildExit(game, cavRoot);
  cavBuildDoline(game, cavRoot);
  cavBuildWorms(cavRoot);
  cavBuildRiver(cavRoot);
  cavBuildLog(game, cavRoot);
  cavBuildFish(cavRoot);
  cavBuildRoost(game, cavRoot);
  cavBuildSwifts(cavRoot);
  cavBuildPearls(game, cavRoot);
  cavBuildDrips(cavRoot);
  cavBuildCrickets(cavRoot);
  cavBuildFall(cavRoot);
  cavBuildMotes(cavRoot);
  cavBuildCamp(game, cavRoot);
  cavBuildEcho(cavRoot);

  if (typeof game.registerShadowTarget === 'function') game.registerShadowTarget(cavRoot);
}

function cavBuildFloor(game, root) {
  // nx * EL, not X1 - X0 — see the note in monaco.js's monBuildGround
  // (integrity 10). 140 and 278 are neither of them divisible by 3, so this
  // plane used to step 2.9787 in x and 2.9892 in z while cavBuildCollision
  // stepped exactly 4: three lattices, no two of them the same surface.
  const X0 = -70, X1 = 70, Z0 = -186, Z1 = 92, EL = 3;
  const nx = Math.round((X1 - X0) / EL), nz = Math.round((Z1 - Z0) / EL);
  const W = nx * EL, H = nz * EL;
  const g = new THREE.PlaneGeometry(W, H, nx, nz);
  g.rotateX(-Math.PI / 2);
  g.translate(X0 + W * 0.5, 0, Z0 + H * 0.5);
  const p = g.attributes.position.array;
  const col = new Float32Array(p.length);
  const rock = new THREE.Color(PALETTE.cavRock);
  const rockDk = new THREE.Color(PALETTE.cavRockDk);
  const sand = new THREE.Color(PALETTE.cavSand);
  const mud = new THREE.Color(PALETTE.cavMud);
  const warm = new THREE.Color(PALETTE.cavRockWarm);
  const jungle = new THREE.Color(PALETTE.cavJungleDk);
  const soil = new THREE.Color(PALETTE.cavJungle);
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i], z = p[i + 2];
    const h = cavTerrain(x, z);
    p[i + 1] = h;
    if (z > cavMOUTH_Z) cavColOut(jungle, soil, x, z);
    else {
      const dl = cavDaylightAt(x, z);
      cavCol.copy(rock).lerp(rockDk, 0.5 + 0.5 * Math.sin(x * 0.07 + z * 0.05));
      // ---- AND THE FLOOR OF A RIVER PASSAGE IS NOT ONE GREY --------------
      // One sine of period ninety metres over fourteen thousand square metres
      // gave a floor that photographed as smooth grey plaster in every shot
      // taken between the entrance and the Great Wall. What is actually down
      // there is a mosaic laid by water at three different levels: dry silt
      // banks where the river used to be higher, damp mud where it still
      // floods, and a rind of flowstone wherever anything drips. Three fields,
      // no triangles, and it is the surface the player spends most of the
      // chapter looking at.
      const f1 = Math.sin(x * 0.128 + 0.7) * Math.cos(z * 0.096 - 1.1);
      const f2 = Math.sin((x * 0.55 - z) * 0.061 + 2.4);
      const f3 = Math.sin(x * 0.31) * Math.sin(z * 0.27 + 0.9);
      const mos = f1 * 0.58 + f2 * 0.32 + f3 * 0.16;
      cavCol.lerp(mud, clamp(-mos * 1.3, 0, 1) * 0.55);
      cavCol.lerp(sand, clamp(mos * 1.2, 0, 1) * 0.42);
      cavCol.lerp(warm, clamp(f3 * 1.5 - 0.55, 0, 1) * 0.50);
      // the beaches beside the river are real sand and they are the only place
      // in here that is not stone
      const rt = Math.abs(x - cavRIVER_X) / cavRIVER_W;
      if (rt < 2.4 && z < 44 && z > -96) cavCol.lerp(sand, clamp((2.4 - rt) / 1.2, 0, 0.75));
      if (h < cavWATER + 0.3 && cavIsOverWater(x, z)) cavCol.lerp(mud, 0.6);
      if (Math.abs(z - cavWALL.z) < 22) cavCol.lerp(warm, clamp((22 - Math.abs(z - cavWALL.z)) / 22, 0, 0.55));
      // ...and under the hole in the roof there is soil, because there is a
      // forest growing on it.
      //
      // ONLY UNDER THE HOLE. `dl > 0.05` is true at BOTH ends of the chapter,
      // and `cavDaylightAt` answers 0.85 for the last thirty metres before the
      // exit slot — so the final chamber, which is bare limestone with a rind
      // of algae on it, was painted 68 % forest soil. Photographed from the
      // exit zone it is a FLAT BRIGHT GREEN LAWN with black slabs lying on it,
      // and it is the last thing the player sees in the chapter. Soil is a
      // thing that happens under a collapse, where two hundred metres of
      // rainforest has been falling in for half a million years; at the slot
      // there is a film of green ON THE ROCK and nothing else.
      const dd2 = (x - cavDOLINE.x) * (x - cavDOLINE.x)
                + (z - cavDOLINE.z) * (z - cavDOLINE.z) * 1.2;
      const inHole = cavSmooth((cavDOLINE.r + 14 - Math.sqrt(dd2)) / 16);
      if (dl > 0.05 && inHole > 0.02) {
        // ...AND A FOREST FLOOR IS NOT GREEN. Seventy per cent of one flat
        // mid-green over eighteen hundred square metres photographed as a
        // LAWN — the same failure as the exit chamber below, arrived at from
        // the other direction. What is under a canopy is leaf litter and mud
        // with green only where a gap in it lets the light down, which is
        // exactly what `cavColOut` already says about the wood outside, and
        // the floor's own three mosaic fields already know where those gaps
        // are.
        const k = clamp(dl * 0.9, 0, 0.78) * inHole;
        cavCol.lerp(cavColB.set(PALETTE.cavMud), k * 0.62);
        cavCol.lerp(cavColB.set(PALETTE.cavJungleDk),
                    k * clamp(0.35 + f1 * 0.5 + f2 * 0.35, 0, 1));
        cavCol.lerp(soil, k * clamp(f2 * 1.3 + f3 * 0.6 - 0.15, 0, 1) * 0.85);
      }
      // the phytokarst rind: algae growing on limestone wherever any light
      // reaches it, which is thin, patchy and follows the mosaic rather than
      // covering it. `smoothstep`, not `clamp` — a linear ramp on a field this
      // wide draws a hard straight edge across the floor (the campo lesson).
      // ...AND IT IS A RIND, NOT A LAWN. At 0.30–0.56 of `cavPhyto` this made
      // exactly the flat green field it replaced. What grows on limestone in
      // a few hours of raking light a day is a stain you can see the ROCK
      // through, in patches, following the wet: a tenth to a fifth, weighted
      // by the floor's own mosaic, and it disappears completely outside the
      // fan of the beam because there is no light there to have made it.
      else if (dl > 0.04) {
        const fan = clamp(1 - Math.abs(x) / (16 + (z + 183) * 0.62), 0, 1);
        cavCol.lerp(cavColB.set(PALETTE.cavPhyto),
                    cavSmooth(dl * 1.15) * fan
                    * (0.07 + 0.15 * clamp(f3 * 1.6 + f1 * 0.6 + 0.35, 0, 1)));
      }
    }
    col[i] = cavCol.r; col[i + 1] = cavCol.g; col[i + 2] = cavCol.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, cavVCG());
  m.receiveShadow = true;
  m.frustumCulled = false;
  root.add(m);
}
/**
 * Outside the mouth the ground is leaf litter, and it is the only green.
 *
 * ...AND IT IS NOT ONE GREEN. Two nearly identical greens crossed with one
 * low-frequency sine gave a floor that photographed as a single flat sheet
 * across the whole arrival shot. A rainforest floor is mud and dead leaves
 * with green only where the light gets through, so there are three fields
 * here: the coarse one that says where the canopy is, a mud term under it,
 * and a fine one so the near ground is never flat.
 */
function cavColOut(a, b, x, z) {
  const c1 = Math.sin(x * 0.19) * Math.cos(z * 0.155);
  // HIGH ENOUGH FREQUENCY TO BE IN THE FRAME. The first cut ran at 0.041,
  // which is a hundred and fifty metres of period over a clearing thirty
  // metres across: the field was very nearly constant everywhere the camera
  // ever is, so the mosaic drew nothing at all.
  const c2 = Math.sin(x * 0.105 + 1.2) * Math.sin(z * 0.088 - 0.4);
  const c3 = Math.sin((x * 0.7 + z) * 0.27);
  cavCol.copy(a).lerp(b, clamp(0.5 + 0.34 * c1 + 0.30 * c2 + 0.10 * c3, 0, 1));
  // leaf litter and mud where the canopy is thickest, which is also where a
  // real one has no undergrowth at all
  cavCol.lerp(cavColB.set(PALETTE.cavMud), clamp(-c2 * 0.9 - c1 * 0.3, 0, 1) * 0.55);
  // ...and a wash of the bright green where a gap in it lets the sun down
  cavCol.lerp(cavColB.set(PALETTE.cavJungleLt), clamp(c2 * 1.1 + c3 * 0.2 - 0.25, 0, 1) * 0.45);
}

function cavBuildCollision(game) {
  // MIND WHICH WAY THE SECOND AXIS RUNS: local +y maps to world MINUS z, so j
  // walks BACK from the far edge.
  // ---- THE FLOOR'S OWN LATTICE, NOT ONE OF ITS OWN (integrity 10) -------
  // EL was 4 here and 3 in cavBuildFloor, over the same rectangle, so the
  // collider and the drawn floor were two different piecewise-linear surfaces
  // that met only every twelve metres. Matching it costs 2 520 heightfield
  // nodes to 4 512 and makes them the same surface. If cavBuildFloor's EL or
  // rectangle changes, THESE MUST CHANGE WITH IT.
  const X0 = -70, EL = 3;
  const NX = 47, NZ = 93;                      // = cavBuildFloor's nx, nz
  const Z0 = -186, Z1 = Z0 + NZ * EL;
  const data = [];
  for (let i = 0; i <= NX; i++) {
    const row = [];
    for (let j = 0; j <= NZ; j++) row.push(cavTerrain(X0 + i * EL, Z1 - j * EL));
    data.push(row);
  }
  const hf = new CANNON.Heightfield(data, { elementSize: EL });
  const b = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
  b.addShape(hf);
  b.position.set(X0, 0, Z1);
  b.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  cavSyncBody(b);
  game.world.addBody(b);
}

/**
 * THE ROOF, WITH A HOLE IN IT.
 *
 * A PlaneGeometry cannot have a hole, so this is hand-authored: quads are
 * emitted only where the roof is actually there, which is everywhere except a
 * fifty-metre ellipse over the doline. Looking up through that hole you see
 * the sky disc, which is the only bright thing in the chapter that is not
 * inside it.
 *
 * The faces point DOWN, because you are underneath them. Getting a ceiling's
 * winding backwards renders it invisible from the only side anybody will ever
 * see it from, and it is the same mistake as the Uji's riverbed.
 */
function cavBuildRoof(root) {
  const X0 = -74, X1 = 74, Z0 = -184, Z1 = cavMOUTH_Z + 2, EL = 3;
  const NX = Math.round((X1 - X0) / EL), NZ = Math.round((Z1 - Z0) / EL);
  const pos = [], col = [], idx = [];
  const grid = new Int32Array((NX + 1) * (NZ + 1)).fill(-1);
  const rock = new THREE.Color(PALETTE.cavRock);
  const dk = new THREE.Color(PALETTE.cavRockDk);
  const lt = new THREE.Color(PALETTE.cavRockLt);
  let n = 0;
  for (let j = 0; j <= NZ; j++) {
    for (let i = 0; i <= NX; i++) {
      const x = X0 + i * EL, z = Z0 + j * EL;
      if (cavHole(x, z) > 0.5) continue;
      // CLAMPED, because cavRoofH answers 400 outside the mouth and the grid
      // runs three metres past it: the last row of quads went from fourteen
      // metres at z = 50 to four hundred at z = 53, which is a three-hundred-
      // and-eighty-six-metre vertical curtain of DoubleSide rock standing
      // across the whole width of the cave mouth. It happens to look like a
      // mountain from outside, which is why nobody caught it, but it is a
      // twelve-thousand-triangle accident and it fights the arch that is
      // actually modelled there.
      const y = Math.min(cavRoofH(x, z), 92) + 4 * cavHole(x, z);
      grid[j * (NX + 1) + i] = n++;
      pos.push(x, y, z);
      cavCol.copy(dk).lerp(rock, clamp((y - 30) / 30, 0, 1));
      if ((i + j) % 3 === 0) cavCol.lerp(lt, 0.25);
      col.push(cavCol.r, cavCol.g, cavCol.b);
    }
  }
  for (let j = 0; j < NZ; j++) {
    for (let i = 0; i < NX; i++) {
      const a = grid[j * (NX + 1) + i], b = grid[j * (NX + 1) + i + 1];
      const c = grid[(j + 1) * (NX + 1) + i], d = grid[(j + 1) * (NX + 1) + i + 1];
      if (a < 0 || b < 0 || c < 0 || d < 0) continue;
      // wound so the normals point DOWN
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, mat(0xffffff, { vertexColors: true, side: THREE.DoubleSide }));
  m.frustumCulled = false;
  root.add(m);

  // stalactites, which are what makes it read as a roof rather than as a lid
  const S = cavMerger();
  for (let i = 0; i < 150; i++) {
    const x = rand(-64, 64), z = rand(-180, 44);
    if (cavHole(x, z) > 0.2) continue;
    const y = cavRoofH(x, z);
    // ...AND IT MUST STOP ABOVE THE FLOOR. Beyond the Great Wall the floor
    // stands at seven to twelve and a half metres and the roof comes down to
    // sixteen near the exit slot, so an eleven-metre stalactite hung off the
    // roof there reached SEVEN AND A HALF METRES BELOW THE GROUND — a cone of
    // limestone standing in the middle of the far chamber with its point in
    // the dirt, which is a stalagmite drawn upside down. The solidity probe
    // found them as un-collided rock within reach of forty walkable squares,
    // all of them past z = -150.
    const room = y - cavTerrain(x, z);
    const len = Math.min(rand(2, 11), Math.max(0.8, room - 2.4));
    S.cone(x, y - len * 0.5, z, rand(0.5, 1.9), len,
           i % 3 ? PALETTE.cavRockDk : PALETTE.cavRockWarm, Math.PI, 0, 0, 6);
  }
  // ---- THE SODA STRAWS, and they are the cheapest thing in the chapter ----
  //
  // A hundred and fifty stalactites over fourteen thousand square metres of
  // roof is one every ninety-odd metres: from underneath, the ceiling of the
  // Great Passage was a flat dark plane with the occasional cone on it. What
  // is actually up there is thousands of SODA STRAWS — five-millimetre calcite
  // tubes, a metre or two long, in dense patches wherever a joint in the rock
  // is wet, and they are the single most recognisable thing about the inside
  // of a limestone cave. Four-sided cylinders 4 cm across: eight triangles
  // apiece, they are lit by the echo as it goes past, and they turn the roof
  // from a lid into a surface. In PATCHES, following joints, because that is
  // where the water comes through — an even scatter of six hundred is a haze
  // and carries no information (the glow-worm rule).
  for (let seed = 0; seed < 46; seed++) {
    const jx = rand(-62, 62), jz = rand(-178, 42);
    if (cavHole(jx, jz) > 0.1) continue;
    const ja = rand(0, 3.14), per = 8 + (seed % 9);
    for (let k = 0; k < per; k++) {
      const t = rand(-9, 9);
      const x = jx + Math.cos(ja) * t + rand(-1.6, 1.6);
      const z = jz + Math.sin(ja) * t + rand(-1.6, 1.6);
      if (cavHole(x, z) > 0.1) continue;
      const y = Math.min(cavRoofH(x, z), 74);
      const room = y - cavTerrain(x, z);
      const len = Math.min(rand(0.5, 2.3), Math.max(0.4, room - 3));
      // NOT THE BRIGHTEST TWO COLOURS IN THE PALETTE. At `cavCalciteLt` and
      // `cavPearl` four hundred four-centimetre tubes on a black ceiling read
      // as vertical RAIN — the eye reads a bright thin vertical as motion.
      S.cyl(x, y - len * 0.5, z, 0.042, len,
            k % 4 ? PALETTE.cavCalcite : PALETTE.cavRockWarm, 0, 0, 0, 4);
    }
  }
  const sm = new THREE.Mesh(S.build(), cavVC());
  sm.frustumCulled = false;
  root.add(sm);
}

/**
 * THE SIDES OF IT, AND THE FIRST BUILD DID NOT HAVE ANY.
 *
 * A floor and a roof is not a cave, it is a canyon with a lid on: standing in
 * the doline and looking along the passage, the eye went straight past the
 * edge of the floor mesh and out into `scene.background`, which at that moment
 * was pale blue daylight. There was a wall of sky at eye level INSIDE A
 * MOUNTAIN. Drawn every eight metres so the rock has a shape, collided every
 * thirty-two so the body count stays inside its budget — nobody can tell the
 * difference from the inside, because the drawn face and the solid face are
 * within a metre of each other everywhere.
 */
function cavBuildWalls(game, root) {
  const M = cavMerger();
  const Z0 = -184, Z1 = 52;
  for (let s = -1; s <= 1; s += 2) {
    for (let z = Z0; z < Z1; z += 8) {
      const wob = 7 * Math.sin(z * 0.031 + (s > 0 ? 0 : 1.9)) + 3.4 * Math.sin(z * 0.097 + s);
      const x = s * (50 + wob);
      const floor = cavTerrain(x, z) - 6;
      const roof = Math.min(cavRoofH(x, z), 74) + 10;
      const h = roof - floor;
      M.box(x + s * 11, floor + h * 0.5, z, 24, h, 9.4,
            (Math.abs(z) | 0) % 24 < 8 ? PALETTE.cavRockLt : PALETTE.cavRock, 0, s * 0.05, 0);
      // and a few slabs leaning off it, so the face is not a plane
      if ((z | 0) % 24 === 0) {
        M.box(x, floor + h * 0.35, z + 3, 5, h * 0.5, 7, PALETTE.cavRockDk, 0.1, 0, s * 0.18);
      }
    }
    // THE SOLID WALL MUST BE THE WOBBLE THAT WAS DRAWN, AT THE CADENCE IT WAS
    // DRAWN AT. This loop had three separate disagreements with the one above
    // it and together they were the worst solidity failure in the game —
    // measured over a 5 m grid, a hundred and fifty-four of the cave's walkable
    // squares had rock within reach that the animal walked straight into.
    //   1. the drawn wobble has TWO terms and this one had only the slow one,
    //      so the collider could sit 3.4 m off the face it was standing in for;
    //   2. it stepped 32 m where the drawing steps 8, which aliases the fast
    //      term (65 m period) into nonsense between samples;
    //   3. it sat at s*13 where the drawing sits at s*11, putting the solid
    //      face two further metres inside the rock again.
    // Same formula, same step, same offset: sixty boxes instead of sixteen,
    // which is nothing at all to a broadphase and is the difference between a
    // cave and a corridor of painted air.
    for (let z = Z0; z < Z1; z += 8) {
      const wob = 7 * Math.sin(z * 0.031 + (s > 0 ? 0 : 1.9)) + 3.4 * Math.sin(z * 0.097 + s);
      const x = s * (50 + wob);
      const floor = cavTerrain(x, z) - 6;
      const roof = Math.min(cavRoofH(x, z), 74) + 10;
      cavStaticBox(game, x + s * 11, floor + (roof - floor) * 0.5, z, 24, roof - floor, 10);
    }
  }
  // ---- THE FAR END, AND IT HAS A HOLE IN IT NOW --------------------------
  // The world has to stop somewhere, and for the chapter's whole life it
  // stopped with an unbroken hundred-and-fifty-metre slab of `cavRockDk`. The
  // last line of the chapter's own header reads
  //
  //   z-150..-176  THE SLOT, which is daylight, and is the way out.
  //
  // and there was no slot. `cavDaylightAt` answered 0.85 down here, so the
  // atmosphere, the grade and the fog all lifted for a daylight that had no
  // source and no opening — the player walked to the end of a hundred and
  // seventy metres of mountain and found a wall. Two piers and a lintel, the
  // same three-box trick the Antarctic berg's arch uses, and the gap is filled
  // by cavBuildExit.
  for (let s = -1; s <= 1; s += 2) {
    M.box(s * 48, 20, Z0 - 6, 74, 90, 14, PALETTE.cavRockDk);
    cavStaticBox(game, s * 48, 20, Z0 - 6, 74, 90, 14);
  }
  M.box(0, 24 + 33, Z0 - 6, 24, 66, 14, PALETTE.cavRockDk);
  cavStaticBox(game, 0, 24 + 33, Z0 - 6, 24, 66, 14);
  // ...AND THE REVEAL UNDER IT IS THE WORLD'S OWN WALL.
  //
  // The first cut put the sill 0.4 m above the floor of the far chamber, which
  // is under a capybara's step: the solidity probe found the animal could walk
  // straight up onto it, into the fourteen-metre slot, and out of the far side
  // — past the end of the heightfield, which stops at z = -186, into the void.
  // The chapter does not END by walking out (the exit is systems.js's travel
  // trigger, standing in the zone), so the slot is a thing you see through and
  // stand under rather than a door. Two and a half metres of sill, which is a
  // wall to a rodent and nothing at all to the eye at eight metres up.
  M.box(0, 12.6, Z0 - 6, 24, 5.4, 14, PALETTE.cavRockDk);
  cavStaticBox(game, 0, 12.6, Z0 - 6, 24, 5.4, 14);
  const mesh = new THREE.Mesh(M.build(), cavVC());
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  root.add(mesh);
}

/** The jungle outside, and the hole in the cliff the river goes into. */
function cavBuildOutside(game, root) {
  const M = cavMerger();
  // THE CLIFF. It is four hundred metres of limestone and the only thing in it
  // is a hole with a river coming out.
  // THE SOLID BLOCK MUST BE THE BLOCK THAT WAS DRAWN. Every number here was
  // rolled twice — the drawn box got `rand(2, 10)` for its z and `rand(14, 30)`
  // by `rand(10, 22)` for its size, and the collider got a fixed +6 and a
  // fixed 20 by 14. Sixteen faces of a four-hundred-metre limestone cliff,
  // each one up to eight metres away from the thing standing in for it. Roll
  // once, into locals, and use them for both.
  let bC = cavPoolBody(game);
  for (let i = 0; i < 16; i++) {
    const x = rand(-70, 70);
    if (Math.abs(x) < 20) continue;
    const cz = cavMOUTH_Z + rand(2, 10);
    const cw = rand(14, 30), cd = rand(10, 22);
    M.box(x, 14, cz, cw, 60, cd, i % 2 ? PALETTE.cavRock : PALETTE.cavRockDk, 0, rand(0, 1.2), 0);
    cavPoolBox(bC, x, 14, cz, cw * 0.5, 30, cd * 0.5);
  }
  // ---- THE ARCH OVER THE MOUTH, AND IT IS AN ARCH NOW --------------------
  // One 60 × 34 box with its underside at nine metres, plus ten voussoirs that
  // only reached fourteen: photographed from the spawn the entrance was a
  // LETTERBOX — sixty metres of black band across the top third of the frame
  // with a five-metre gap under it — which is a cliff with a slot in it and
  // not the biggest cave passage on earth. The opening goes to the full height
  // of the roof behind it (`cavRoofH` answers 14 at z = 50), the springing
  // comes down to eight at the jambs, and the intrados is a row of rock TEETH
  // rather than a flat soffit, because the one thing a limestone entrance
  // never has is a straight edge.
  M.box(0, 31, cavMOUTH_Z + 4, 60, 32, 16, PALETTE.cavRock);
  cavStaticBox(game, 0, 31, cavMOUTH_Z + 4, 60, 32, 16);
  for (let i = 0; i < 16; i++) {
    const a = (i / 15) * Math.PI;
    const yy = 15.4 - Math.pow(Math.cos(a), 2) * 7.6;
    M.box(Math.cos(a) * 21, yy + 2.4, cavMOUTH_Z + 2, 5.2, 5.4, 14,
          i % 2 ? PALETTE.cavRockDk : PALETTE.cavRock, 0, 0, -Math.cos(a) * 0.55);
    // the teeth: a cone hanging off the lip, which is what the first six
    // metres of any cave roof in Quang Binh is made of
    if (i % 2 === 0) {
      const tl = rand(1.6, 4.4) * (0.4 + Math.sin(a));
      M.cone(Math.cos(a) * 21 + rand(-2, 2), yy - tl * 0.4, cavMOUTH_Z - 1.2,
             rand(0.5, 1.5), tl, PALETTE.cavRockDk, Math.PI, rand(0, 3), 0, 6);
    }
  }
  // ...and the cliff above it has a FACE. A four-hundred-metre wall of
  // limestone drawn as one box is a flat dark rectangle across the top of the
  // arrival shot; what is actually up there is bedding planes, a scree of
  // fallen blocks on every ledge and a great deal of vegetation hanging on.
  for (let i = 0; i < 34; i++) {
    const x = rand(-46, 46), y = rand(16, 52);
    const w = rand(6, 18), hh = rand(2.2, 6.0);
    M.box(x, y, cavMOUTH_Z - 1.6 + rand(0, 2), w, hh, 5.0,
          i % 3 ? PALETTE.cavRockDk : PALETTE.cavRock, 0, 0, rand(-0.12, 0.12));
    if (i % 3 === 0) {
      M.sph(x + rand(-4, 4), y + hh * 0.5 + 0.4, cavMOUTH_Z - 3.2,
            rand(1.2, 3.2), rand(0.6, 1.4), 1.1,
            i % 2 ? PALETTE.cavJungleDk : PALETTE.cavJungle, 6);
    }
  }
  // ---- THE JUNGLE, AND IT USED TO BE A LAWN ------------------------------
  //
  // This is the first frame of the chapter and the last green for two hundred
  // metres, and it was thirty-four trees and sixty ferns spread over a hundred
  // and twenty-eight metres by thirty-six — one tree every hundred and
  // thirty-five square metres. Photographed from the spawn, the arrival shot
  // of Sơn Đoòng was a flat green field the size of the screen with three
  // cones on it and a black band along the top. The whole point of putting a
  // rainforest outside a cave is the CONTRAST: it has to be so full that
  // walking into the mouth is a relief.
  //
  // A hundred and ten trees at four heights, so there is a canopy over the
  // camera and an understory under it; the tall ones get a buttress, because
  // that is the one thing everybody knows about the shape of a jungle tree and
  // it reads from directly above, which nothing else about a trunk does.
  //
  // TWO THINGS ABOUT THIS ARE NOT TASTE AND WERE BOTH MEASURED. First, the
  // camera is only about ten metres up, so anything with a crown above
  // fifteen metres puts a flat dark green slab across the frame every time you
  // walk under it — a jungle photographed from inside its own canopy is a
  // photograph of the underside of a leaf. One emergent in fourteen, and the
  // rest of the density is bought in the two storeys BELOW the lens. Second,
  // a wood with no way through it is a wall: there is a winding corridor from
  // the spawn to the mouth that nothing tall grows in, which is both the path
  // and the reason the black hole in the cliff is the first thing you see.
  //
  // ...AND THE CORRIDOR HAD A CEILING ON IT, WHICH IS WORSE THAN A WALL.
  //
  // Photographed from the actual spawn point with the actual follow rig, the
  // FIRST FRAME OF CHAPTER 16 was a green hexagon two metres from the lens with
  // a capybara wedged behind a trunk. Three things did it and all three are
  // arithmetic. The path was three and a half metres of half-width — seven
  // metres of corridor — and a sub-canopy crown is 2.4 m of radius, so two
  // trees standing at the legal minimum on opposite sides MEET over the middle
  // of it. The camera is about ten metres up, and a tier-2 tree tops out at
  // thirteen, so it films the underside of a leaf. And the path ran through
  // x = 3.4 at z = 62 while the animal is put down at x = 0, so the arrival was
  // half a corridor width off-centre in a wood.
  //
  // Wide enough that the crowns cannot close (6.5, and 8.5 at the spawn end),
  // centred on the spawn, and NOTHING TALL within twelve metres of it — which
  // is not a compromise, it is what a track through a forest looks like from
  // the air: the gap in the canopy is how you find one.
  const cavPath = function (x, z) {
    if (z > 86) return 99;
    return Math.abs(x - Math.sin((z - 62) * 0.055) * 6.5);
  };
  const cavPathW = function (z) { return z > 58 ? 8.5 : 6.5; };
  let nC = 0;
  for (let i = 0; i < 128; i++) {
    const x = rand(-68, 68), z = rand(cavMOUTH_Z + 3, 92);
    const pd = cavPath(x, z);
    if (pd < cavPathW(z)) continue;
    const h = cavTerrain(x, z);
    // four storeys: emergents, canopy, sub-canopy, and saplings you see over
    const tier = i % 14;
    let th = tier === 0 ? rand(15, 19) : tier < 4 ? rand(9.5, 13)
           : tier < 9 ? rand(5.0, 8.0) : rand(2.2, 4.0);
    // the verge: whatever is inside twelve metres of the track is held under
    // the lens, so the corridor keeps its lid off all the way to the mouth
    if (pd < 13) th = Math.min(th, 3.2 + (pd - cavPathW(z)) * 0.62);
    const rr = 0.16 + th * 0.019;
    M.cyl(x, h + th * 0.5, z, rr, th, i % 4 ? PALETTE.cavRockWarm : PALETTE.cavMud, 0, 0, 0, 6);
    // the buttress: three fins at the foot of anything big, and they are FINS
    // rather than slabs — the first cut ran to rr * 4.4, which is three and a
    // half metres of black plank lying in the leaf litter round every trunk.
    if (th > 9) {
      for (let b = 0; b < 3; b++) {
        const a = (b / 3) * Math.PI * 2 + i;
        M.box(x + Math.cos(a) * rr * 1.15, h + 0.62, z + Math.sin(a) * rr * 1.15,
              0.16, 1.24, rr * 2.3, PALETTE.cavRockWarm, 0, -a, 0);
      }
    }
    const blobs = th > 9 ? 3 : 2;
    const spread = 1.1 + th * 0.16;
    for (let k = 0; k < blobs; k++) {
      const a = (k / blobs) * Math.PI * 2 + i * 0.7;
      M.sph(x + Math.cos(a) * spread * 0.6, h + th - rand(0.2, 1.6) + k * 0.5,
            z + Math.sin(a) * spread * 0.6,
            spread, spread * 0.5, spread,
            k % 2 ? PALETTE.cavJungle : PALETTE.cavJungleDk, 6);
    }
    // ONE COMPOUND BODY PER SIXTEEN. A hundred and ten separate static bodies
    // is a hundred and ten broadphase entries for a wood you walk through in
    // fifteen seconds.
    cavPoolBox(bC, x, h + Math.min(th, 3.4) * 0.5, z, rr + 0.28, Math.min(th, 3.4) * 0.5, rr + 0.28);
    if (++nC >= 16) { cavPoolDone(game, bC); bC = cavPoolBody(game); nC = 0; }
  }
  // ---- and the floor of it ------------------------------------------------
  // Ferns, ground palms and the fallen stuff. A rainforest floor is not grass;
  // it is a metre of dead leaves with things sticking out of it, and this is
  // the layer that turns the ground plane into somewhere you are standing.
  //
  // FOUR SHAPES, NOT ONE. Two hundred and forty cones between 1.4 and 3.8 m
  // across, all in two greens, photographed as a field of traffic cones with
  // the odd sheet of paper lying in it. An understory is a set of very
  // DIFFERENT silhouettes at the same height — that is the whole reason it
  // reads as undergrowth and not as a texture — so there is a fan palm, a
  // heliconia (which is a stem with a few enormous flat leaves off it and is
  // the most tropical shape there is), a rattan clump, and the cones, small.
  for (let i = 0; i < 340; i++) {
    const x = rand(-70, 70), z = rand(cavMOUTH_Z, 92);
    // the path is trodden, not cleared: less grows on it, and what does is low
    const pd = cavPath(x, z);
    if (pd < 3.0 && i % 3 !== 0) continue;
    const h = cavTerrain(x, z);
    const sc = pd < 6 ? 0.55 : 1;
    const kind = i % 9;
    if (kind === 0) {
      // a ground palm: four blades out of one point.
      // PITCHED, NOT LAID DOWN. This camera looks down at about forty degrees,
      // so a leaf held within a quarter of a radian of horizontal presents its
      // whole top face to the lens and photographs as a GREEN PLAYING CARD
      // lying in the grass. The same mistake as Manly's rock pools and the
      // Pantanal's lily rims, and the same fix: turn the plate so the eye sees
      // it edge-on-ish, and let the silhouette do the work.
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + i;
        M.box(x + Math.cos(a) * 0.5 * sc, h + (0.55 + 0.34) * sc, z + Math.sin(a) * 0.5 * sc,
              0.34 * sc, 0.06, 1.4 * sc,
              k % 2 ? PALETTE.cavFern : PALETTE.cavPhyto, 0.72, -a, 0);
      }
    } else if (kind === 1 || kind === 2) {
      // heliconia: a stem and three paddles. Held at forty degrees and rather
      // narrower — see the note on the ground palm above.
      const a0 = rand(0, 6.28);
      M.cyl(x, h + 0.85 * sc, z, 0.05, 1.7 * sc, PALETTE.cavJungleDk, 0, 0, 0, 4);
      for (let k = 0; k < 3; k++) {
        const a = a0 + k * 2.1;
        M.box(x + Math.cos(a) * 0.72 * sc, h + (1.28 + k * 0.26) * sc, z + Math.sin(a) * 0.72 * sc,
              0.52 * sc, 0.05, 1.9 * sc,
              k % 2 ? PALETTE.cavJungleLt : PALETTE.cavFern, 0.62, -a, 0);
      }
    } else if (kind === 3) {
      // rattan: a clump of thin canes going up out of one root, the thing that
      // actually makes a Quang Binh hillside impossible to walk through
      for (let k = 0; k < 5; k++) {
        const a = rand(0, 6.28), th = rand(1.8, 4.2) * sc;
        M.cyl(x + Math.cos(a) * 0.3, h + th * 0.5, z + Math.sin(a) * 0.3, 0.045, th,
              k % 2 ? PALETTE.cavJungle : PALETTE.cavJungleDk,
              Math.sin(a) * 0.16, 0, -Math.cos(a) * 0.16, 4);
      }
    } else {
      M.cone(x, h + rand(0.4, 1.0) * sc, z, rand(0.5, 1.35) * sc, rand(1.0, 2.2) * sc,
             i % 3 ? PALETTE.cavFern : PALETTE.cavJungleLt, 0, rand(0, 3), 0, 6);
    }
  }
  // ---- the fallen ---------------------------------------------------------
  // Nine logs and a scatter of boulders off the cliff. A wood with nothing
  // lying down in it is a plantation.
  for (let i = 0; i < 9; i++) {
    const x = rand(-62, 62), z = rand(cavMOUTH_Z + 5, 88);
    if (cavPath(x, z) < 4.5) continue;
    const h = cavTerrain(x, z);
    const len = rand(5, 11), a = rand(0, 3.14);
    M.cyl(x, h + 0.42, z, rand(0.34, 0.56), len, PALETTE.cavMud, 0, a, Math.PI / 2, 6);
    M.sph(x, h + 0.62, z, 0.5, 0.16, 0.5, PALETTE.cavPhyto, 6);
    cavPoolBox(bC, x, h + 0.34, z, len * 0.5 * Math.abs(Math.cos(a)) + 0.5, 0.34,
               len * 0.5 * Math.abs(Math.sin(a)) + 0.5);
    if (++nC >= 16) { cavPoolDone(game, bC); bC = cavPoolBody(game); nC = 0; }
  }
  for (let i = 0; i < 22; i++) {
    const x = rand(-66, 66), z = rand(cavMOUTH_Z + 2, 90);
    if (cavPath(x, z) < 3.6) continue;
    const h = cavTerrain(x, z);
    const r = rand(0.8, 2.6);
    M.sph(x, h + r * 0.4, z, r, r * 0.7, r * rand(0.7, 1.3),
          i % 2 ? PALETTE.cavRock : PALETTE.cavRockDk, 6);
    cavPoolBox(bC, x, h + r * 0.26, z, r * 0.8, r * 0.30, r * 0.8);
    if (++nC >= 16) { cavPoolDone(game, bC); bC = cavPoolBody(game); nC = 0; }
  }
  // ---- the lianas off the arch --------------------------------------------
  // The lip of a cave mouth in Quang Binh is hung with them, and they are the
  // one thing that says the hole is a HOLE rather than a painted black patch:
  // they hang IN FRONT of the dark, so the dark gets a depth.
  for (let i = 0; i < 26; i++) {
    const x = rand(-27, 27);
    const y0 = 9 + Math.sin((x / 19) * Math.PI * 0.5 + 1.57) * 4 + 4;
    const len = rand(3, 11);
    M.cyl(x + rand(-1, 1), y0 - len * 0.5, cavMOUTH_Z - 3.6, 0.06, len,
          i % 3 ? PALETTE.cavJungleDk : PALETTE.cavRockWarm, 0, 0, rand(-0.06, 0.06), 4);
    if (i % 2 === 0) {
      M.sph(x, y0 - len, cavMOUTH_Z - 3.6, 0.42, 0.30, 0.42, PALETTE.cavJungle, 6);
    }
  }
  cavPoolDone(game, bC);
  const mesh = new THREE.Mesh(M.build(), cavVC());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);

  // ---- AND THE MOUNTAIN IS BREATHING OUT ---------------------------------
  //
  // The single most photographed fact about this cave — the one on every
  // postcard of it — is that cold air pours out of the entrance all morning
  // and condenses the moment it hits the outside, so the hole has a river of
  // cloud coming out of it and rolling downhill into the trees. It is also the
  // answer to the arrival problem the corridor note above is about: a black
  // patch in a green cliff is a painted black patch, and a black patch with
  // something POURING OUT OF IT is a hole two hundred metres deep. It is
  // twelve merged spheres and it is the first thing you see.
  {
    // NINE, LARGE, AND FAINT. Fourteen at 0.16 with hard hexagonal edges piled
    // one in front of another does not read as cloud, it reads as a stack of
    // grey windows: every overlap is a visible seam, and the seams are
    // straight. Fewer, bigger, flatter and half the alpha — the overlaps are
    // then below the threshold of the eye and what is left is a haze.
    const B = cavMerger();
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      B.sph(rand(-9, 9) * (0.4 + t), 1.6 + (1 - t) * 3.0 + rand(-0.4, 0.4), t * 24,
            rand(9, 16), rand(0.8, 1.5), rand(8, 14), PALETTE.cavMist, 6);
    }
    cavBreath = new THREE.Mesh(B.build(), mat(PALETTE.cavMist, {
      transparent: true, opacity: 0.075, depthWrite: false, fog: true,
    }).clone());
    cavBreath.position.set(0, cavTerrain(0, cavMOUTH_Z + 4), cavMOUTH_Z - 2);
    cavBreath.renderOrder = 5;
    cavBreath.frustumCulled = false;
    root.add(cavBreath);
  }
}

/**
 * THE SLOT, AND IT IS THE LAST THING ANYBODY SEES IN THIS CHAPTER.
 *
 * The header has promised it since the chapter shipped — "z -150..-176 THE
 * SLOT, which is daylight, and is the way out" — and `cavDaylightAt` has been
 * answering 0.85 down here for the fog, the hemisphere, the ambient and the
 * grade's threshold ever since. There was no opening. The player walked a
 * hundred and seventy metres of mountain, arrived at the place the checklist
 * sends them, and found an unbroken slab of rock lit by a daylight with no
 * source, standing on a floor painted like a lawn.
 *
 * Four things make an opening read as an opening rather than as a bright
 * rectangle, and this is all four:
 *
 *   IT IS A TUNNEL. The far wall is fourteen metres thick, so the slot is a
 *     hole THROUGH something. Lined, so the light rakes down its sides.
 *   THERE IS A WORLD BEHIND IT. A silhouette of jungle in front of the bright
 *     plane. A light with nothing in it is a light box; one thing in front of
 *     it is a landscape.
 *   THE LIGHT COMES IN. An additive wedge sloping down onto the floor, with
 *     dust in it — the doline's own trick, turned on its side, because at the
 *     far end of the mountain the sun is low and across rather than overhead.
 *   AND SOMETHING GROWS IN IT. Nothing has grown in five hundred metres and
 *     suddenly there is moss, then ferns, then a sapling standing in the gap.
 */
function cavBuildExit(game, root) {
  const M = cavMerger();
  const ZI = -183;                 // the inner face of the far wall
  const ZO = -197;                 // ...and the outer one
  const SILL = 15.3;               // the top of the reveal — see the note on it
  const HEAD = 24;                 // and the underside of the lintel
  const HW = 12;                   // half-width of the gap

  // ---- the reveal: the slot is a hole through fourteen metres of rock -----
  for (let s = -1; s <= 1; s += 2) {
    for (let k = 0; k < 6; k++) {
      const zz = lerp(ZI - 1, ZO + 1, k / 5);
      const inset = 0.8 * Math.sin(k * 1.3 + s);
      M.box(s * (HW + 1.2) + inset * s, (SILL + HEAD) * 0.5, zz,
            3.4, HEAD - SILL + 2, 3.2,
            k % 2 ? PALETTE.cavRockDk : PALETTE.cavRock, 0, 0, s * 0.04);
    }
    // and the jamb, worn smooth where two hundred thousand years of wind has
    // been through it
    M.cone(s * (HW - 0.6), SILL + 4.4, ZI - 3, 2.2, 9.0,
           PALETTE.cavFlow, 0, s, 0, 6);
  }
  // the soffit, so the lintel has a face and not an edge
  for (let k = 0; k < 5; k++) {
    M.box(rand(-9, 9), HEAD - 0.6, lerp(ZI, ZO, k / 4), rand(5, 9), 1.8, 3.0,
          k % 2 ? PALETTE.cavRock : PALETTE.cavRockWarm, 0, 0, rand(-0.06, 0.06));
  }

  // ---- WHAT IS OUTSIDE, and it is four hundred metres of Quang Binh ------
  // The bright plane first, then the silhouette in front of it.
  //
  // AND THEY ARE FOGGED. The first cut ran all three `fog: false` on the
  // argument that they are the horizon — and `cavDaylightAt` answers 1 at the
  // spawn, so systems.js opens the fog to five hundred metres out there, and
  // the head of the slot stands ten metres proud of the Great Wall.
  // Photographed from the arrival point, a bright rectangle with trees in it
  // was hanging in the middle of the FIRST FRAME OF THE CHAPTER, two hundred
  // and seventy metres away, through a mountain. Fogged, it is what it ought
  // to be from there — a chink you will not understand for twenty minutes —
  // and at the forty metres you actually stand at it the fog has not started
  // (near is 61 under that much daylight), so it is untouched where it counts.
  {
    const g = new THREE.PlaneGeometry(HW * 2 + 6, HEAD - SILL + 8);
    const sky = new THREE.Mesh(g, mat(PALETTE.cavDay, {
      emissive: PALETTE.cavDay, emissiveIntensity: 1.35,
    }).clone());
    sky.position.set(0, (SILL + HEAD) * 0.5 + 1, ZO - 5);
    sky.frustumCulled = false;
    // ---- NAMED, AND THE REASON IS AN AUDIT THAT COULD NOT ------------
    // ROADMAP-PHYSICS X9 left three wall-shaped faces whose "builders are
    // not identified", and the one it said mattered most was a 32 x 15.6 m
    // slab at z −200 in this chapter — which is the jungle silhouette forty
    // lines below. It could not be named because every mesh this function
    // adds went in anonymous, so the audit could only report
    // `Mesh < cave < Scene`. Göreme's rows in the same audit came back as
    // `gorValley` and `gorCliff`, because goreme.js names what it builds.
    // Four names, and the next audit answers its own question.
    sky.name = 'cavExitSky';
    root.add(sky);
    // a band of haze along the bottom of it, which is what a valley floor
    // seen from inside a mountain at eight in the morning actually is
    const hz = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2 + 6, 5),
                              mat(PALETTE.cavShaft, {
                                emissive: PALETTE.cavShaft, emissiveIntensity: 0.9,
                                transparent: true, opacity: 0.75,
                                depthWrite: false,
                              }).clone());
    hz.position.set(0, SILL + 2.4, ZO - 4.6);
    hz.renderOrder = 4;
    hz.frustumCulled = false;
    hz.name = 'cavExitHaze';
    root.add(hz);
  }
  {
    // the jungle on the far side, in silhouette. Dark, flat-lit, and standing
    // IN FRONT of the bright plane — one thing between you and the light is
    // the whole difference between a doorway and a lamp.
    const S = cavMerger();
    for (let i = 0; i < 26; i++) {
      const x = rand(-HW - 1, HW + 1);
      const th = rand(3, 11) * (1 - Math.abs(x) / (HW * 2.4));
      const y = SILL - 1.5 + th * 0.5;
      S.cyl(x, y, ZO - 3.2 + rand(-0.6, 0.6), rand(0.10, 0.26), th,
            PALETTE.cavJungleDk, 0, 0, 0, 4);
      for (let k = 0; k < 2; k++) {
        S.sph(x + rand(-1.2, 1.2), y + th * 0.5 + rand(-0.4, 0.9), ZO - 3.2,
              rand(0.9, 2.1), rand(0.5, 1.1), 0.5,
              k ? PALETTE.cavJungleDk : PALETTE.cavRockDk, 6);
      }
    }
    // and the lip of the hillside they are standing on
    S.box(0, SILL - 3.2, ZO - 3.0, HW * 2 + 8, 4.0, 1.2, PALETTE.cavRockDk, 0, 0, 0);
    const sm = new THREE.Mesh(S.build(), mat(0xffffff, { vertexColors: true }));
    sm.frustumCulled = false;
    // THIS IS X9's SLAB, and it is scenery on purpose. MEASURED
    // (`qa/px-cave-slab.js`, `qa/px-cave-sill.js`): it stands three metres
    // beyond the OUTER face of a fourteen-metre wall whose INNER face is
    // solid — driven at hard from the passage floor and from sill height,
    // the animal stops dead at z −182.3 every time. The gap over the sill is
    // 2.8 m above that floor and the best hop the game has peaks at 13.86,
    // 1.44 m short, from a standing start, a run and a long run alike. And
    // there is no collided floor out there at all: placed at z −198 the
    // animal falls and the rescue puts it back by the river. Colliding a
    // backdrop behind a solid wall would buy a static body and nothing else.
    sm.name = 'cavExitJungle';
    root.add(sm);
  }

  // ---- THE LIGHT COMING IN -----------------------------------------------
  // Additive, and it SLOPES: the doline's column stands up because the hole is
  // overhead, and this one lies down because the hole is in a wall. It is the
  // same argument about alpha — a translucent slab over a nearly black
  // background is a wall, so it adds, and it is faint.
  {
    const LEN = 46;
    const g = new THREE.CylinderGeometry(1, 1, 1, 4, 6, true);
    // a square section, opened out: the slot is a rectangle, so the beam is
    const pa = g.attributes.position.array;
    const ca = new Float32Array(g.attributes.position.count * 4);
    const c1 = new THREE.Color(PALETTE.cavDay);
    const c2 = new THREE.Color(PALETTE.cavShaftLo);
    for (let v = 0; v < g.attributes.position.count; v++) {
      const t = clamp(pa[v * 3 + 1] + 0.5, 0, 1);          // 0 slot, 1 inside
      const spread = 1 + t * 1.9;
      pa[v * 3] *= HW * 1.5 * spread;
      pa[v * 3 + 2] *= (HEAD - SILL) * 0.62 * spread;
      pa[v * 3 + 1] *= LEN;
      cavCol.copy(c1).lerp(c2, t);
      ca[v * 4] = cavCol.r; ca[v * 4 + 1] = cavCol.g; ca[v * 4 + 2] = cavCol.b;
      // brighter at the sill than the doline's column is at its roof, because
      // this one is looked at from ten metres rather than from a hundred, and
      // it goes to nothing by the time it is forty in — a beam you can see the
      // far end of is a searchlight, not a window
      ca[v * 4 + 3] = 0.185 * Math.pow(1 - t, 2.0) + 0.012;
    }
    g.attributes.position.needsUpdate = true;
    g.setAttribute('color', new THREE.BufferAttribute(ca, 4));
    g.computeVertexNormals();
    const beam = new THREE.Mesh(g, mat(0xffffff, {
      vertexColors: true, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false,
      side: THREE.DoubleSide, fog: false,
    }).clone());
    // lie it down the passage and tip it so it lands on the floor
    beam.rotation.set(Math.PI * 0.5 - 0.20, 0, 0);
    beam.position.set(0, (SILL + HEAD) * 0.5 + 0.5, ZI + LEN * 0.5 - 2);
    beam.renderOrder = 6;
    beam.frustumCulled = false;
    cavExitBeam = beam;
    root.add(beam);
  }
  // a real light, because a painted beam lights nothing. Long RANGE and a
  // modest intensity — the doline's own lesson: over forty metres it is the
  // falloff that matters and not the number in front of it.
  cavExitLight = new THREE.PointLight(PALETTE.cavDay, 3.4, 120, 1.1);
  cavExitLight.position.set(0, SILL + 5.5, ZI - 3);
  root.add(cavExitLight);

  // ---- AND SOMETHING GROWS IN IT -----------------------------------------
  // Five hundred metres of nothing, and then moss. The gradient is the point:
  // it starts as a rind on the wet rock forty metres out and it is a sapling
  // standing in the gap.
  let bE = cavPoolBody(game), nE = 0;
  for (let i = 0; i < 150; i++) {
    const x = rand(-30, 30), z = rand(ZI + 1, cavEXIT_Z + 30);
    // how near the light: 1 at the slot, 0 forty metres in
    const k = clamp((ZI + 44 - z) / 44, 0, 1);
    if (Math.random() > k * k * 0.95 + 0.05) continue;
    // inside the fan of the beam, which is what decides where anything can
    // photosynthesise: narrow at the sill, wide by the time it is forty
    // metres in and too dim to matter
    if (Math.abs(x) > 12 + (z - ZI) * 0.5) continue;
    const h = cavTerrain(x, z);
    if (i % 9 === 0 && k > 0.55) {
      // a sapling, leaning at the light. The one thing in the chapter that is
      // growing toward the way OUT rather than toward the hole in the roof.
      const th = rand(2.2, 5.5) * k;
      M.cyl(x, h + th * 0.5, z, 0.10 + th * 0.016, th, PALETTE.cavRockWarm, -0.16, 0, 0);
      for (let b = 0; b < 2; b++) {
        M.sph(x + rand(-0.9, 0.9), h + th + rand(-0.2, 0.7), z - th * 0.14,
              rand(0.8, 1.7), rand(0.5, 0.9), rand(0.8, 1.7),
              b ? PALETTE.cavJungle : PALETTE.cavJungleLt, 6);
      }
      cavPoolBox(bE, x, h + Math.min(th, 2.4) * 0.5, z, 0.34, Math.min(th, 2.4) * 0.5, 0.34);
      if (++nE >= 16) { cavPoolDone(game, bE); bE = cavPoolBody(game); nE = 0; }
    } else if (i % 3 === 0) {
      // ferns, leaning the same way
      M.cone(x, h + 0.55 + k * 0.5, z, rand(0.35, 0.95) * (0.5 + k), rand(0.9, 2.1) * (0.4 + k * 0.8),
             i % 2 ? PALETTE.cavFern : PALETTE.cavPhyto, -0.34 * k, rand(0, 3), 0, 6);
    } else {
      // ...and moss. A CUSHION, not a sheet: at 1.6 m across and ten
      // centimetres thick these photographed as flat green rhombuses lying on
      // the floor — pieces of paper again, which is the failure mode every
      // flat thing in this game has had at least once. Moss grows in small
      // domed clumps a hand across, so it is a lot of little ones.
      for (let k = 0; k < 4; k++) {
        const rr = rand(0.16, 0.42);
        M.sph(x + rand(-0.7, 0.7), h + rr * 0.22, z + rand(-0.7, 0.7),
              rr, rr * 0.42, rr, (i + k) % 3 ? PALETTE.cavPhyto : PALETTE.cavFern, 6);
      }
    }
  }
  // ---- the fangs that frame it -------------------------------------------
  // Photographed from the exit zone, a lit rectangle at the end of a dark
  // room is a doorway in a corridor. Two stalagmites standing IN the light,
  // in silhouette, make it a cave mouth.
  const fangs = [[-15.5, -168, 11], [13.5, -172, 9.5], [-9, -178, 6], [8, -177, 5]];
  for (let f = 0; f < fangs.length; f++) {
    const fx = fangs[f][0], fz = fangs[f][1], fh = fangs[f][2];
    const base = cavTerrain(fx, fz);
    let y = base, rr = 1.5;
    for (let k = 0; k < 4; k++) {
      const sh = fh / 4 * rand(0.85, 1.2);
      M.cone(fx + Math.sin(k * 1.7) * 0.4, y + sh * 0.5, fz + Math.cos(k * 2.1) * 0.4,
             rr, sh * 1.5, k % 2 ? PALETTE.cavFlow : PALETTE.cavRockWarm, 0, k, 0, 6);
      y += sh; rr *= 0.76;
    }
    cavStaticBox(game, fx, base + fh * 0.5, fz, 2.4, fh, 2.4);
  }
  // ---- and the rubble on the sill ----------------------------------------
  for (let i = 0; i < 40; i++) {
    const x = rand(-16, 16), z = rand(ZI, ZI + 16);
    const h = cavTerrain(x, z);
    const s = rand(0.5, 2.4);
    M.box(x, h + s * 0.16, z, s * 1.3, s * 0.4, s * 1.1,
          i % 3 ? PALETTE.cavRock : PALETTE.cavRockDk,
          rand(-0.3, 0.3), rand(0, 3), rand(-0.3, 0.3));
  }
  cavPoolDone(game, bE);
  const mesh = new THREE.Mesh(M.build(), cavVC());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  // The reveal, the lintel, the fangs and the rubble. Solid by the TERRAIN
  // rather than by a collider of its own — which is why the walk stops at the
  // inner face and not at the drawn one. Named for the audit's sake.
  mesh.name = 'cavExitRock';
  root.add(mesh);

  // ---- THE DUST IN IT ----------------------------------------------------
  // The doline's motes are the only thing in the chapter that says the air is
  // a thing rather than an absence, and the beam at this end had none. Same
  // five centimetres, blown ALONG the beam rather than falling down it,
  // because this air is moving: a cave with two openings at different heights
  // breathes through itself all day, and the draught out of the slot is the
  // single most commented-on thing about standing in one.
  const g = new THREE.BoxGeometry(0.055, 0.055, 0.055);
  cavSlotMotes = new THREE.InstancedMesh(g, cavGlow(PALETTE.cavDay, 0.95), cavSLOT_MOTE_N);
  cavSlotMotes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cavSlotMotes.frustumCulled = false;
  cavSlotMoteD = new Float32Array(cavSLOT_MOTE_N * 4);   // x, y, u, speed
  for (let i = 0; i < cavSLOT_MOTE_N; i++) {
    const o = i * 4;
    cavSlotMoteD[o] = rand(-13, 13);
    cavSlotMoteD[o + 1] = rand(SILL + 0.5, HEAD - 1);
    cavSlotMoteD[o + 2] = Math.random();
    cavSlotMoteD[o + 3] = rand(0.35, 1.15);
  }
  root.add(cavSlotMotes);
}

/** The draught blows them out of the slot and down the passage. */
function cavUpdateSlotMotes(dt) {
  if (!cavSlotMotes) return;
  const ZI = -183, SILL = 15.3;
  for (let i = 0; i < cavSLOT_MOTE_N; i++) {
    const o = i * 4;
    cavSlotMoteD[o + 2] += cavSlotMoteD[o + 3] * dt * 0.055;
    if (cavSlotMoteD[o + 2] > 1) {
      cavSlotMoteD[o + 2] -= 1;
      cavSlotMoteD[o] = rand(-13, 13);
      cavSlotMoteD[o + 1] = rand(SILL + 0.5, 23);
    }
    const u = cavSlotMoteD[o + 2];
    const spread = 1 + u * 1.9;
    const x = cavSlotMoteD[o] * spread + Math.sin(cavTime * 0.5 + i) * 0.6;
    const y = lerp(cavSlotMoteD[o + 1], cavSlotMoteD[o + 1] - 9, u)
            + Math.sin(cavTime * 0.8 + i * 2.1) * 0.4;
    const z = lerp(ZI - 2, ZI + 44, u);
    const s = 1 - u * 0.4;
    cavSlotMotes.setMatrixAt(i, cavXform(x, y, z, 0, cavTime * 0.4 + i, 0, s, s, s));
  }
  cavSlotMotes.instanceMatrix.needsUpdate = true;
}

/**
 * THE FORMATIONS. Every stalagmite in here is a cone on a cone on a cone,
 * because that is exactly how one grows: a drip at a time, and the drip does
 * not always land in the same place.
 */
function cavBuildFormations(game, root) {
  const M = cavMerger();
  const put = (x, z, h, r, col1, col2, solid) => {
    const base = cavTerrain(x, z);
    let y = base;
    let rr = r;
    const seg = Math.max(3, Math.round(h / 3.5));
    for (let k = 0; k < seg; k++) {
      const t = k / seg;
      const seg_h = h / seg * rand(0.85, 1.2);
      M.cone(x + Math.sin(t * 4.1) * r * 0.25, y + seg_h * 0.5, z + Math.cos(t * 3.3) * r * 0.25,
             rr, seg_h * 1.6, (k % 2) ? col1 : col2, 0, rand(0, 3), 0, 6);
      y += seg_h;
      rr *= 0.78;
    }
    if (solid) cavStaticBox(game, x, base + h * 0.5, z, r * 1.4, h, r * 1.4);
    return base + h;
  };

  // ---- THE HAND OF DOG. Twenty-six metres, and the way up it is a spiral of
  // flowstone ledges, because a chapter with a climb verb in it should not use
  // the climb verb for everything.
  //
  // ...AND FOR THE WHOLE LIFE OF THE CHAPTER IT COULD NOT BE CLIMBED.
  //
  // MEASURED. A capybara's standing hop in this chapter is 1.09 m — the animal
  // was put on the first ledge and told to jump, and it got 1.09. The ledges
  // were `base + 1.0 + k * 2.45`: TWO AND A HALF METRES between each one, on a
  // stalagmite whose task line is 'Top out on the biggest stalagmite'. Nothing
  // in this chapter publishes climbHold except the Great Wall, and the trunk
  // collider is a BOX with vertical sides, so there was no ramp either. The
  // second ledge of ten was unreachable by every verb the animal owns, and the
  // tick sits at base + 24 with the highest ledge at base + 19.1 — so even a
  // player who cheated their way up nine of them still could not have it.
  //
  // Two things were wrong underneath that, and both are the same mistake:
  //
  //   1. THE STEP WAS NEVER MEASURED AGAINST THE HOP. Nine shelves, and it is
  //      two and a half metres from each to the next.
  //   2. THE TRUNK COLLIDER WAS ONE BOX FOR A CONE. `7.0` half-width for the
  //      whole 24 m of a spire that tapers from 7.5 m of radius to 1.6 —
  //      five and a half metres of invisible rock round the top of it, which
  //      is also why the last four shelves were BURIED (their radius runs down
  //      to 3.0 and the box reaches 3.5).
  //
  // AND IT IS A RAMP NOW, NOT A STAIRCASE. The first fix was thirty-two
  // shelves at 0.78 — inside the hop, and measured as such — and it failed for
  // a third reason nobody had thought about: a spiral of two-metre discs at a
  // fixed angle per step OVERLAPS ITSELF at the top, where the spire is only
  // two metres across, so the animal stood on shelf twenty-four with shelf
  // twenty-five seventy-eight centimetres over its head. It could not stand up
  // to jump. **A helix has to be checked for HEADROOM as well as for rise**,
  // and the number that fixes both at once is the gradient: one continuous
  // flowstone shelf at twelve degrees, three and a half turns, a hundred and
  // fourteen metres of walking to gain twenty-four — which is what a stalagmite
  // with a skirt on it actually looks like, and you walk up it.
  {
    const x = cavHAND.x, z = cavHAND.z;
    const base = cavTerrain(x, z);
    const HAND_H = 24;
    // how wide the spire is at a given height above its foot
    const handR = function (dy) { return lerp(7.5, 1.8, clamp(dy / 25, 0, 1)); };
    for (let k = 0; k < 8; k++) {
      const t = k / 7;
      M.cone(x, base + t * HAND_H + 2, z, handR(t * HAND_H), 7.5,
             k % 2 ? PALETTE.cavFlow : PALETTE.cavRockWarm, 0, k * 0.8, 0, 8);
    }
    // ---- THE TRUNK, as an OCTAGON rather than as one fat box -------------
    // Two boxes per level at forty-five degrees. A square's corners reach
    // 1.414 of its half-width, so a box collider for a round spire is either
    // too fat at the diagonals (walk into thin air) or too thin at the flats
    // (walk into the rock); an octagon is 1.082, which is inside the five per
    // cent nobody can see.
    {
      // ...AND EVERY LEVEL IS SIZED FROM ITS OWN TOP, not from its middle.
      // Sized from the middle, the corner of each level is FATTER than the
      // flank over the upper half of it — and the ramp's inner edge follows
      // the flank exactly, so once a turn the animal walked into a corner of
      // invisible rock and was pushed off a shelf twelve metres up. Measured:
      // it made it a third of the way and then fell 3.2 m, which is one level.
      let bT = cavPoolBody(game), nT = 0;
      for (let k = 0; k < 12; k++) {
        const y0 = k * 2.15, y1 = y0 + 2.15;
        const rr = handR(y1) * 0.86;
        cavPoolBox(bT, x, base + (y0 + y1) * 0.5, z, rr, 1.08, rr);
        cavPoolBox(bT, x, base + (y0 + y1) * 0.5, z, rr, 1.08, rr, Math.PI / 4);
        nT += 2;
        if (nT >= 16) { cavPoolDone(game, bT); bT = cavPoolBody(game); nT = 0; }
      }
      cavPoolDone(game, bT);
    }
    // ---- THE RAMP ---------------------------------------------------------
    // A hundred and twenty short segments, and EVERY ONE OF THEM IS COLLIDED.
    // The first cut collided every other one to save bodies: 1.6 m boxes 1.9 m
    // apart along the path, so there was a thirty-centimetre hole in the floor
    // between each pair and the animal fell off the shelf on its fourth step,
    // measured, from a metre and a half up. **A ramp made of discrete boxes has
    // to have the boxes OVERLAP** — at 0.95 m of chord and 1.6 m of box they
    // overlap by two thirds, and the rise from one to the next is 0.20, which
    // is half a capybara's step height. The whole climb is therefore WALKED and
    // nothing about it can be missed by a hop that came up short. The shelf
    // always sits 0.9 m proud of the flank the spire actually has at that
    // height, so it is outside the octagon everywhere.
    const RAMP_N = 120, RAMP_RISE = 0.20, RAMP_CHORD = 0.95;
    let ra = 0;
    let bL = cavPoolBody(game), nL = 0;
    for (let k = 0; k < RAMP_N; k++) {
      const dy = 0.5 + k * RAMP_RISE;
      const rr = handR(dy) + 1.15;
      const lx = x + Math.cos(ra) * rr, lz = z + Math.sin(ra) * rr;
      M.cyl(lx, base + dy, lz, 0.88, 0.40,
            k % 7 === 0 ? PALETTE.cavCalcite : PALETTE.cavFlow, 0, ra, 0, 6);
      cavPoolBox(bL, lx, base + dy - 0.02, lz, 0.86, 0.20, 0.86);
      if (++nL >= 16) { cavPoolDone(game, bL); bL = cavPoolBody(game); nL = 0; }
      ra += RAMP_CHORD / rr;
    }
    cavPoolDone(game, bL);
    // the tip, which is what you are standing on when it ticks. The ramp tops
    // out at base + 24.3 and the tick is at base + 24, so arriving IS the
    // task; the tip is what you climb the last step onto.
    const tipY = base + 0.5 + (RAMP_N - 1) * RAMP_RISE + 0.36;
    M.cone(x, tipY + 1.2, z, 1.5, 3.2, PALETTE.cavCalcite, 0, 0, 0, 6);
    cavStaticBox(game, x, tipY, z, 2.8, 0.7, 2.8);
  }

  // ---- the rest of them, and there are a great many
  // EVERY ONE OF THEM IS SOLID NOW. `i % 4 === 0` collided eleven of the
  // forty-four; a three-to-fifteen-metre limestone column you can walk through
  // is the single most obviously wrong thing that can happen in a cave, and
  // the solidity probe put this mesh at three hundred and seventy-five
  // walkable squares with rock within reach and nothing in it.
  let bF = cavPoolBody(game), nF = 0;
  for (let i = 0; i < 44; i++) {
    const x = rand(-58, 58), z = rand(-160, 34);
    if (Math.abs(x - cavHAND.x) < 12 && Math.abs(z - cavHAND.z) < 12) continue;
    if (Math.abs(x - cavRIVER_X) < cavRIVER_W + 3 && z < 44 && z > -96) continue;
    if (Math.abs(z - cavWALL.z) < 18) continue;
    if (cavInZone('doline', x, z)) continue;
    const hh = rand(3, 15), rr = rand(1.2, 4.2);
    put(x, z, hh, rr, i % 3 ? PALETTE.cavRockWarm : PALETTE.cavFlow, PALETTE.cavCalcite, false);
    cavPoolBox(bF, x, cavTerrain(x, z) + hh * 0.5, z, rr * 0.68, hh * 0.5, rr * 0.68);
    if (++nF >= 16) { cavPoolDone(game, bF); bF = cavPoolBody(game); nF = 0; }
  }
  // and the boulders. Same argument: `r > 3` collided about a third of them,
  // and a one-and-a-half-metre rock in the dark is exactly the size of thing
  // that reads as a bug when you walk through it.
  for (let i = 0; i < 40; i++) {
    const x = rand(-60, 60), z = rand(-170, 40);
    if (Math.abs(x - cavRIVER_X) < cavRIVER_W && z < 44 && z > -96) continue;
    const h = cavTerrain(x, z);
    const r = rand(1.2, 5);
    M.sph(x, h + r * 0.45, z, r, r * 0.72, r * rand(0.7, 1.3),
          i % 2 ? PALETTE.cavRock : PALETTE.cavRockDk, 6);
    // ...but a small one is a STEP, so the box is short: a boulder you cannot
    // hop is a wall, and the way through this passage is over them.
    cavPoolBox(bF, x, h + r * 0.30, z, r * 0.78, r * 0.34, r * 0.78);
    if (++nF >= 16) { cavPoolDone(game, bF); bF = cavPoolBody(game); nF = 0; }
  }
  cavPoolDone(game, bF);
  const mesh = new THREE.Mesh(M.build(), cavVC());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);
}

/**
 * WHAT THE FLOOR OF A CAVE PASSAGE IS ACTUALLY MADE OF.
 *
 * Photographed from the gameplay rig anywhere between the entrance slope and
 * the Great Wall, chapter 16 was a smooth grey plane with a boulder on it —
 * forty boulders over fourteen thousand square metres is one every three
 * hundred and sixty, and the player spends more time on this floor than on any
 * other surface in the chapter. Four things go on it, and every one of them is
 * a real feature of a river passage that size rather than decoration:
 *
 *   BREAKDOWN — the roof comes down in slabs and they pile against the walls.
 *   GOURS — rimstone dams, which are the only standing water outside the river
 *     and the one thing in here that throws the echo back at you.
 *   FLOWSTONE BANKS — where the wall meets the floor there is a skirt of the
 *     stuff, because two hundred metres of limestone drains down it.
 *   COLUMNS — a stalactite that met its stalagmite. Forty metres of it, floor
 *     to roof, and it is the only object in the chapter that tells you at a
 *     glance how far away the roof is.
 */
function cavBuildPassageFloor(game, root) {
  // ---- BREAKDOWN. One instanced slab, angular, tipped every which way -----
  {
    const M = cavMerger();
    M.box(0, 0, 0, 1, 0.42, 0.86, PALETTE.cavRock);
    const N = 620;
    const m = new THREE.InstancedMesh(M.build(), cavVC(), N);
    m.frustumCulled = false;
    m.receiveShadow = true;
    let n = 0, nB = 0;
    let bB = cavPoolBody(game);
    for (let i = 0; i < N * 4 && n < N; i++) {
      // Against the walls, which is where a roof-fall ends up — but the tail
      // of the pile reaches the middle, and the middle is where the player
      // actually walks. The first cut stopped thirty-four metres in from the
      // wall and left a sixteen-metre lane of perfectly bare plaster straight
      // down the passage, which is the only part of the floor anybody sees.
      const side = Math.random() < 0.5 ? -1 : 1;
      const z = rand(-178, 40);
      const wob = 7 * Math.sin(z * 0.031 + (side > 0 ? 0 : 1.9)) + 3.4 * Math.sin(z * 0.097 + side);
      const wall = side * (50 + wob);
      const x = wall - side * Math.pow(Math.random(), 1.5) * 52;
      if (Math.abs(x - cavRIVER_X) < cavRIVER_W && z < 44 && z > -96) continue;
      if (cavInZone('doline', x, z)) continue;
      if (Math.abs(z - cavWALL.z) < 10) continue;
      const s = rand(0.7, 3.2);
      cavM.compose(cavV3.set(x, cavTerrain(x, z) + s * 0.14, z),
                   cavQ.setFromEuler(cavE.set(rand(-0.5, 0.5), rand(0, 6.28), rand(-0.5, 0.5))),
                   cavSc.set(s, s * rand(0.5, 1.1), s * rand(0.7, 1.3)));
      m.setMatrixAt(n++, cavM);
      // ...AND THE BIG ONES ARE SOLID. A two-metre slab of limestone you walk
      // through is exactly the size of thing that reads as a bug — it is the
      // same argument the chapter's own boulders were fixed under. The box is
      // LOW, because the way across a breakdown pile is over it and a
      // capybara steps 0.40; anything under a metre and a half is left as
      // rubble you scuff through.
      if (s > 1.5) {
        cavPoolBox(bB, x, cavTerrain(x, z) + s * 0.12, z, s * 0.46, s * 0.12, s * 0.42);
        if (++nB >= 16) { cavPoolDone(game, bB); bB = cavPoolBody(game); nB = 0; }
      }
    }
    cavPoolDone(game, bB);
    m.count = n;
    root.add(m);
  }

  const M = cavMerger();
  // ---- THE FLOWSTONE SKIRT along the foot of both walls -------------------
  // SOLID, and pooled. The lobes stand up to four metres out from the face,
  // and the wall collider is a box centred ELEVEN metres inside the rock — so
  // an un-collided skirt is four metres of painted air between the player and
  // the only thing stopping them leaving the cave sideways. Eleven walkable
  // squares on the probe, all of them in the far chamber where the floor comes
  // up to meet it.
  let bK = cavPoolBody(game), nK = 0;
  for (let s = -1; s <= 1; s += 2) {
    for (let z = -178; z < 42; z += 9) {
      const wob = 7 * Math.sin(z * 0.031 + (s > 0 ? 0 : 1.9)) + 3.4 * Math.sin(z * 0.097 + s);
      const wall = s * (50 + wob);
      const h = cavTerrain(wall, z);
      cavPoolBox(bK, wall - s * 2.6, h + 1.6, z, 3.2, 1.6, 4.8);
      if (++nK >= 16) { cavPoolDone(game, bK); bK = cavPoolBody(game); nK = 0; }
      // three lobes running down out of the wall, each shorter than the last
      for (let k = 0; k < 3; k++) {
        const out = 3.0 + k * 2.6;
        M.cone(wall - s * out * 0.5, h + 2.4 - k * 0.7, z + (k - 1) * 2.4,
               out * 0.9, 5.0 - k * 1.1,
               k % 2 ? PALETTE.cavRockWarm : PALETTE.cavFlow, 0, s * 0.4 + k, 0, 6);
      }
    }
  }
  cavPoolDone(game, bK);
  // ---- THE GOURS. Three staircases of rimstone dams, with water in them ---
  // They go where the flowstone is: two under the drip lines on the east side
  // and one on the terrace above the river.
  const gours = [[34, -24], [-40, -128], [30, 8]];
  // ONE BODY FOR ALL TWENTY-SEVEN DAMS. Twenty-centimetre steps are worth
  // being solid — you walk up them — and are not worth twenty-seven entries in
  // a broadphase that is already carrying a hundred and forty.
  const bG = cavPoolBody(game);
  for (let g = 0; g < gours.length; g++) {
    const gx = gours[g][0], gz = gours[g][1];
    const base = cavTerrain(gx, gz);
    // A GOUR DAM IS ANKLE-HIGH AND A METRE OR TWO ACROSS. The first cut ran to
    // 4.6 — nine metres of `cavCalcite` in the brightest colour the chapter
    // owns, in the darkest room in the game — and photographed from thirty
    // metres away the passage had a stack of enormous cream dinner plates in
    // it. Small, low, and mostly the honey colour of the flowstone they grow
    // out of; only the WATER in them is pale, and that is the whole read.
    for (let k = 0; k < 9; k++) {
      const rr = 2.3 - k * 0.16;
      const y = base + k * 0.20;
      const px = gx + Math.sin(k * 1.1) * 1.1, pz = gz - k * 1.5;
      M.cyl(px, y + 0.10, pz, rr, 0.20, k % 2 ? PALETTE.cavFlow : PALETTE.cavRockWarm, 0, k * 0.4, 0, 8);
      // the water: still, and it is the only mirror in a hundred and seventy
      // metres of mountain
      M.cyl(px, y + 0.19, pz, rr - 0.26, 0.05, PALETTE.cavWaterLt, 0, k * 0.4, 0, 8);
      cavPoolBox(bG, px, y + 0.10, pz, rr * 0.8, 0.10, rr * 0.8);
    }
  }
  cavPoolDone(game, bG);
  // ---- THE COLUMNS -------------------------------------------------------
  // Seven of them, and they are the scale of the room. A stalactite forty
  // metres long that has finally reached its stalagmite is not a rare thing in
  // a passage this old, and it is the only vertical line in here.
  const cols = [[-44, 24], [40, -8], [-38, -62], [46, -84], [-46, -140], [36, -150], [12, -170]];
  for (let c = 0; c < cols.length; c++) {
    const cx = cols[c][0], cz = cols[c][1];
    if (Math.abs(cx - cavRIVER_X) < cavRIVER_W + 4 && cz < 44 && cz > -96) continue;
    const base = cavTerrain(cx, cz);
    const roof = cavRoofH(cx, cz);
    const h = roof - base;
    if (h < 6) continue;
    // fat at both ends and narrow in the middle, which is exactly how one
    // grows: the drip built up from below and down from above and they met
    M.cone(cx, base + h * 0.22, cz, 2.6, h * 0.46, PALETTE.cavFlow, 0, c, 0, 8);
    M.cone(cx, roof - h * 0.22, cz, 2.4, h * 0.46, PALETTE.cavRockWarm, Math.PI, c * 0.7, 0, 8);
    M.cyl(cx, base + h * 0.5, cz, 0.85, h, PALETTE.cavCalcite, 0, 0, 0, 8);
    cavStaticBox(game, cx, base + h * 0.5, cz, 3.4, h, 3.4);
  }
  const mesh = new THREE.Mesh(M.build(), cavVC());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  root.add(mesh);
}

/** THE GREAT WALL OF VIETNAM. Seventy metres of calcite across the passage. */
function cavBuildWall(game, root) {
  const M = cavMerger();
  const zc = cavWALL.z;
  const base = cavWALL.foot;
  const top = cavWALL.top;
  // the barrier itself: a row of overlapping flowstone curtains, so the face
  // reads as a curve of creases rather than as a wall of one box
  for (let i = 0; i < 22; i++) {
    const x = -60 + i * 5.6;
    const h = top - base + rand(-1.2, 1.2);
    M.box(x, base + h * 0.5, zc + Math.sin(i * 0.8) * 1.2, 6.4, h, 6.0,
          i % 2 ? PALETTE.cavCalcite : PALETTE.cavCalciteLt, 0, 0, 0);
    // the drapery down the face
    for (let k = 0; k < 3; k++) {
      const dh = rand(4, h * 0.9);
      M.cone(x + rand(-2.4, 2.4), base + dh * 0.5 + rand(0, 2), zc + 4.6, rand(0.8, 2.0), dh,
             PALETTE.cavFlow, Math.PI, 0, 0, 6);
    }
  }
  // ONE collider, and it is a box: a vertical face is exactly what a heightfield
  // cannot hold, and it is exactly what a box is for.
  cavStaticBox(game, 0, base + (top - base) * 0.5, zc, 124, top - base, 8);
  // the rimstone pools on top of it, which is where you land
  for (let i = 0; i < 9; i++) {
    const x = -40 + i * 10;
    M.cyl(x, top + 0.3, zc - 1, rand(2.4, 4), 0.7, PALETTE.cavCalciteLt, 0, 0, 0, 8);
    cavStaticBox(game, x, top + 0.3, zc - 1, 6, 0.7, 6);
  }
  // ---- AND THERE IS SOMETHING AT THE TOP TO CLIMB TOWARD -----------------
  //
  // Seventy metres of calcite across the whole passage, in the dark, with a
  // hard flat line along the top and nothing whatever above it. Photographed
  // from the foot, the one climb in the chapter is a wall you cannot see the
  // top of and have no reason to believe has one — which is the difference
  // between a route and a dead end. Every party that has ever come this way
  // has rigged the pitch and left the rope on it, so: a rope over the lip, a
  // stake at the head of it, and a marker LAMP on the stake. The lamp is the
  // whole fix. It is the only light above the wall, it is visible from ninety
  // metres down the passage, and a player who has understood nothing else
  // walks at it.
  {
    const lx = 6;
    // the rope, hanging down the face from the stake
    for (let k = 0; k < 15; k++) {
      const t = k / 14;
      M.cyl(lx + Math.sin(t * 3.1) * 0.5, top - t * (top - base) * 0.94,
            zc + 4.2 + t * 1.4, 0.055, (top - base) * 0.075,
            k % 2 ? PALETTE.cavRope : PALETTE.cavRockWarm, 0, 0, 0.03, 4);
    }
    // a knot every three metres, because that is what makes a rope a LADDER
    for (let k = 0; k < 7; k++) {
      const t = (k + 0.5) / 7;
      M.sph(lx + Math.sin(t * 3.1) * 0.5, top - t * (top - base) * 0.94,
            zc + 4.2 + t * 1.4, 0.12, 0.10, 0.12, PALETTE.cavRope, 6);
    }
    // the stake, and the lamp on it
    M.cyl(lx, top + 1.3, zc - 0.6, 0.09, 2.0, PALETTE.cavRockDk, 0, 0, 0, 6);
    // CLONED — mat() hands back a shared cache entry and this one's emissive
    // is written every frame by the pulse below
    const lamp = new THREE.Mesh(cavG.sph6.clone(), cavGlow(PALETTE.cavTent, 2.8).clone());
    lamp.scale.set(0.20, 0.24, 0.20);
    lamp.position.set(lx, top + 2.35, zc - 0.6);
    root.add(lamp);
    cavWallLamp = new THREE.PointLight(PALETTE.cavTent, 2.2, 34, 1.3);
    cavWallLamp.position.set(lx, top + 2.5, zc - 0.6);
    root.add(cavWallLamp);
    cavWallLampMesh = lamp;
    // a cairn beside it — three stones, and it means somebody stood here
    for (let k = 0; k < 4; k++) {
      M.sph(lx + 2.2 + rand(-0.2, 0.2), top + 0.85 + k * 0.28, zc - 1.4,
            0.36 - k * 0.06, 0.20, 0.34 - k * 0.06,
            k % 2 ? PALETTE.cavRock : PALETTE.cavRockDk, 6);
    }
  }
  const mesh = new THREE.Mesh(M.build(), cavVC());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);
}

/**
 * THE DOLINE, AND IT IS THE ONLY REASON ANYBODY HAS EVER HEARD OF THIS PLACE.
 *
 * The roof has fallen in over fifty metres of the passage. There is therefore
 * a column of daylight two hundred and fifty metres tall standing on the floor
 * of a cave, and because there is daylight there is a FOREST, growing inside a
 * mountain, with a mist over it in the mornings. None of that is invented and
 * none of it needed to be.
 */
function cavBuildDoline(game, root) {
  const D = cavDOLINE;
  // 1. the sky, seen through the hole. It is up at 210 m and it is the
  //    brightest thing in the chapter by a very long way.
  {
    const g = new THREE.CircleGeometry(D.r * 1.3, 20);
    g.rotateX(Math.PI / 2);
    cavSkyDisc = new THREE.Mesh(g, cavGlow(PALETTE.cavShaft, 1.4));
    cavSkyDisc.position.set(D.x, 208, D.z);
    cavSkyDisc.frustumCulled = false;
    root.add(cavSkyDisc);
  }
  // 2. THE SHAFT. A cone of light standing on the floor — additive-ish, no
  //    depth write, drawn from the inside as well as the outside so walking
  //    into it is walking INTO something.
  {
    // ADDITIVE, AND IT FADES DOWNWARD. The first build was a plain transparent
    // cylinder at 0.17 and it rendered as a SOLID TAN SLAB standing in the
    // middle of the cave — because a translucent surface over a nearly black
    // background is exactly that: 17% of white on top of nothing is a wall.
    // Light does not occlude, it ADDS; and a shaft of daylight two hundred
    // metres tall is far brighter at the hole than it is by the time it
    // reaches the floor, which is what the vertex alpha is for.
    const floor = cavTerrain(D.x, D.z);
    const h = 206 - floor;
    const g = new THREE.CylinderGeometry(D.r * 1.15, D.r * 0.55, h, 20, 8, true);
    const n = g.attributes.position.count;
    const pa = g.attributes.position.array;
    const ca = new Float32Array(n * 4);
    const top = new THREE.Color(PALETTE.cavShaft);
    const low = new THREE.Color(PALETTE.cavShaftLo);
    for (let v = 0; v < n; v++) {
      const t = clamp((pa[v * 3 + 1] + h * 0.5) / h, 0, 1);      // 0 floor, 1 roof
      cavCol.copy(low).lerp(top, t);
      ca[v * 4] = cavCol.r; ca[v * 4 + 1] = cavCol.g; ca[v * 4 + 2] = cavCol.b;
      // ...and it is not NOTHING at the bottom. 0.025 of additive warm over the
      // floor of the doline is below the threshold of anything, so standing in
      // the marquee there was no column to stand in. Nearly double at the foot
      // and the same at the roof, which is still an eighth of white and is a
      // long way short of the tan slab this comment is about.
      ca[v * 4 + 3] = 0.046 + Math.pow(t, 1.6) * 0.115;
    }
    g.setAttribute('color', new THREE.BufferAttribute(ca, 4));
    cavShaftMesh = new THREE.Mesh(g, mat(0xffffff, {
      vertexColors: true, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide, fog: false,
      // CLONED, because mat() hands back a SHARED cached material and this one
      // has its opacity written every frame — a cache entry somebody else is
      // holding is not a thing to breathe on.
    }).clone());
    cavShaftMesh.position.set(D.x, floor + h * 0.5, D.z);
    cavShaftMesh.renderOrder = 6;
    cavShaftMesh.frustumCulled = false;
    root.add(cavShaftMesh);
  }
  // 3. A REAL LIGHT, because a painted shaft lights nothing. One point light,
  //    high up in the column, so everything under the hole is genuinely lit
  //    and everything ten metres outside it genuinely is not.
  // ...AND ONE LIGHT THIRTY METRES UP WITH A DECAY OF 1.5 DOES NOT LIGHT A
  // FLOOR THIRTY METRES BELOW IT. Photographed from the passage, the marquee
  // of the chapter — a forest growing inside a mountain — came out as a dark
  // green mass with a grey stripe beside it. Inverse-square over thirty metres
  // is a factor of nine hundred, so the number that matters is the RANGE and
  // not the intensity: a hundred and eighty metres of falloff with the source
  // high in the column is what a hole in a roof actually does.
  // ...AND A HUNDRED AND FORTY-FIVE, NOT A HUNDRED AND NINETY. At 190 the
  // column also lit the Great Wall, fifty-six metres away and built out of the
  // palest colour in the chapter: photographed from the passage, the approach
  // to the marquee had a flat cream band across the middle of it. The falloff
  // at the doline FLOOR is unchanged to two decimal places (0.977 against
  // 0.993) and the wall loses a third of what it was getting, which is what
  // makes the hole an ISLAND of light rather than a lamp in a room.
  cavShaftLight = new THREE.PointLight(PALETTE.cavShaft, 6.5, 145, 1.15);
  cavShaftLight.position.set(D.x, cavTerrain(D.x, D.z) + 46, D.z);
  root.add(cavShaftLight);
  // and a second, low and wide, which is the bounce off the floor of the
  // doline — half the light on anything under a hole has been off the ground
  cavShaftLow = new THREE.PointLight(PALETTE.cavJungleLt, 1.5, 60, 1.4);
  cavShaftLow.position.set(D.x, cavTerrain(D.x, D.z) + 5, D.z);
  root.add(cavShaftLow);

  // 4. THE FOREST. Everything under the hole leans toward the middle of it,
  //    because everything under the hole is growing toward the light — which
  //    is also the answer to the `phytokarst` line on the list.
  const M = cavMerger();
  // AND THE FOREST IS SOLID. Forty trees up to fourteen metres tall, growing
  // in the one lit room in the chapter — the room the marquee is set in — and
  // not one of them had a collider. Four hundred and ninety-eight walkable
  // squares with a trunk within reach and nothing in it, which is the second
  // worst number in the chapter.
  //
  // ...AND THERE IS A GLADE IN THE MIDDLE OF IT, WHICH IS THE WHOLE MARQUEE.
  //
  // Photographed standing at `game.cave.doline()` — the point the hint arrow
  // sends you to, the point 'the-doline' ticks at, the point the score holds a
  // swell for — chapter 16's marquee was a wall of bare trunks and green fern
  // cones with a haze over it. The trees grew from one metre out, they were
  // TALLEST at the middle (`lerp(11, 3.5, rr / D.r)`), and the follow rig is
  // about eight metres up: the player walks into the only lit room in a
  // hundred and seventy metres of mountain and stands underneath a canopy.
  //
  // A collapse doline does not work like that and never has. What lands on the
  // floor under a hole in a roof is THE ROOF — forty metres of limestone,
  // block by block — and nothing grows on the pile for a very long time. The
  // wood is a RING round the breakdown, it is tallest at the ring and not at
  // the middle, and the eleven-metre gap in it is where the column of light
  // stands. That is the shot, and it is also simply what is there.
  const GLADE = 11.5;
  let bD = cavPoolBody(game), nD = 0;
  for (let i = 0; i < 62; i++) {
    const a = rand(0, Math.PI * 2), rr = GLADE + Math.sqrt(Math.random()) * (D.r + 5 - GLADE);
    const x = D.x + Math.cos(a) * rr, z = D.z + Math.sin(a) * rr * 0.9;
    const h = cavTerrain(x, z);
    // tall at the ring, short again at the rim where the walls cut the light
    const th = lerp(6.5, 13.5, cavSmooth((rr - GLADE) / 9))
             * (1 - 0.42 * clamp((rr - D.r * 0.80) / 10, 0, 1)) * rand(0.78, 1.22);
    cavPoolBox(bD, x, h + Math.min(th, 3) * 0.5, z, 0.42, Math.min(th, 3) * 0.5, 0.42);
    if (++nD >= 20) { cavPoolDone(game, bD); bD = cavPoolBody(game); nD = 0; }
    // the lean, and it is real: `rr / D.r` of a radian toward the middle
    const lean = (rr / D.r) * 0.34;
    const lx = -Math.cos(a) * lean, lz = -Math.sin(a) * lean;
    M.cyl(x, h + th * 0.5, z, rand(0.18, 0.42), th, PALETTE.cavRockWarm, lz, 0, -lx);
    for (let k = 0; k < 3; k++) {
      M.sph(x - Math.cos(a) * lean * th + rand(-1.6, 1.6), h + th + rand(-0.6, 1.2),
            z - Math.sin(a) * lean * th + rand(-1.6, 1.6),
            rand(1.2, 2.6), rand(0.8, 1.4), rand(1.2, 2.6),
            k % 2 ? PALETTE.cavJungle : PALETTE.cavJungleLt, 6);
    }
  }
  cavPoolDone(game, bD);
  // ---- THE BREAKDOWN, WHICH IS WHAT THE FLOOR OF A DOLINE ACTUALLY IS ----
  // Forty metres of roof came down here, and it is still lying where it fell.
  // Big angular blocks, biggest at the middle where the arch failed and
  // smaller toward the rim — mossy on the top faces, because the only light in
  // the mountain lands on exactly these. It does three jobs at once: it gives
  // the shaft of light something to STAND ON (a column that lands on flat
  // ground has no scale), it fills the glade with silhouettes at the height
  // the camera actually sits, and it is the reason nothing grows in the middle.
  //
  // ...IN AN ANNULUS, AND SMALL. The first cut ran the biggest blocks at the
  // centre and up to eight metres across, which walled the capybara in and put
  // the camera inside a slab: the point of the glade is that the light column
  // has somewhere to LAND and the player has somewhere to stand in it. So the
  // very middle — five metres, which is the foot of the column — is left bare,
  // and nothing on the pile is more than about waist high on the animal.
  //
  // ...AND WHAT IS DRAWN IS WHAT IS SOLID, WHICH IT WAS NOT. The box was drawn
  // `s * 0.44` tall and collided `s * 0.15` half-height — so a block that
  // stood a metre and a half out of the floor was a knee-high kerb to
  // everything in the game that reasons about the world, and to one thing in
  // particular. MEASURED from the middle of the glade, which is the marquee:
  // a ray from the eye to the animal was blocked at 6.5 m in ALL FOUR compass
  // directions, by the same ring of blocks, on every yaw. systems.js pulls the
  // boom in when a BODY is in the way and there was no body in the way — the
  // clearance ray sailed over a 0.6 m collider and the 1.6 m mesh it belonged
  // to filled the frame. The one shot the whole chapter is for was a
  // photograph of a rock.
  //
  // Not by making them all tall and solid: forty-four full-height blocks in a
  // three-hundred-square-metre annulus is a wall round the glade, which is
  // the failure this note is already about. So the pile is what the comment
  // has always claimed it was — LOW rubble you scuff over, drawn at exactly
  // the height it is collided at — and the silhouettes come from nine proper
  // boulders out at the RIM, which are solid, are worth going round, and are
  // behind the camera rather than between it and the animal.
  let bR = cavPoolBody(game), nR = 0;
  for (let i = 0; i < 44; i++) {
    const a = rand(0, 6.283), rr = 5 + Math.sqrt(Math.random()) * (GLADE - 1);
    const x = D.x + Math.cos(a) * rr, z = D.z + Math.sin(a) * rr * 0.9;
    const h = cavTerrain(x, z);
    const s = lerp(3.6, 1.4, (rr - 5) / (GLADE - 1)) * rand(0.7, 1.2);
    const ry = rand(0, 3.14), tilt = rand(-0.16, 0.16);
    M.box(x, h + s * 0.15, z, s * 1.25, s * 0.30, s * 1.05,
          i % 3 ? PALETTE.cavRock : PALETTE.cavRockDk, tilt, ry, rand(-0.14, 0.14));
    // ...and the top of it is green, because that is the one surface in a
    // hundred and seventy metres of mountain with the sky over it. In PATCHES:
    // one green slab the size of the whole block is a snooker table.
    for (let k = 0; k < 3; k++) {
      M.box(x + Math.cos(k * 2.1 + i) * s * 0.32, h + s * 0.285,
            z + Math.sin(k * 2.1 + i) * s * 0.28,
            s * rand(0.16, 0.34), s * 0.06, s * rand(0.16, 0.34),
            (i + k) % 3 ? PALETTE.cavPhyto : PALETTE.cavJungleDk, tilt, ry + k, 0);
    }
    // LOW, because the way across a breakdown pile is over it and a capybara
    // steps 0.40 — the same argument the passage's own slabs are built on.
    cavPoolBox(bR, x, h + s * 0.15, z, s * 0.56, s * 0.15, s * 0.48);
    if (++nR >= 16) { cavPoolDone(game, bR); bR = cavPoolBody(game); nR = 0; }
  }
  cavPoolDone(game, bR);
  // ---- AND NINE PROPER BOULDERS, OUT AT THE RIM -------------------------
  // The silhouettes the pile was supposed to give and cannot any more, put
  // where they cost the marquee nothing: outside the boom, at the foot of the
  // wood, drawn and collided at the SAME height, and big enough that going
  // round one is a decision. This is the whole of the solid-or-drawn rule in
  // eight lines — if it is taller than the animal it is a thing, and a thing
  // is made of rock.
  {
    const bB = cavPoolBody(game);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * 6.283 + 0.4, rr = GLADE + 2.4 + rand(0, 5.5);
      const x = D.x + Math.cos(a) * rr, z = D.z + Math.sin(a) * rr * 0.9;
      const h = cavTerrain(x, z);
      const w = rand(3.0, 5.2), hh = rand(1.9, 3.4);
      const ry = rand(0, 3.14);
      M.box(x, h + hh * 0.5, z, w, hh, w * rand(0.7, 1.0),
            i % 3 ? PALETTE.cavRock : PALETTE.cavRockDk, rand(-0.10, 0.10), ry, rand(-0.10, 0.10));
      M.box(x + Math.cos(ry) * w * 0.2, h + hh * 0.94, z + Math.sin(ry) * w * 0.2,
            w * 0.42, hh * 0.10, w * 0.34, PALETTE.cavPhyto, 0, ry, 0);
      cavPoolBox(bB, x, h + hh * 0.5, z, w * 0.42, hh * 0.5, w * 0.36, ry);
    }
    cavPoolDone(game, bB);
  }
  // ferns and the phytokarst itself — the green film on the rock, and it is
  // combed toward the light like a lawn somebody has mown one way.
  // SMALL IN THE GLADE. At 1.4 m across and 2.6 m tall these are the size of
  // a capybara, and ninety of them standing in the one place the marquee is
  // photographed from filled the frame with green traffic cones.
  for (let i = 0; i < 130; i++) {
    const a = rand(0, Math.PI * 2), rr = rand(0, D.r + 11);
    const x = D.x + Math.cos(a) * rr, z = D.z + Math.sin(a) * rr * 0.9;
    const h = cavTerrain(x, z);
    const lean = clamp(rr / D.r, 0, 1.3) * 0.6;
    const near = clamp(rr / GLADE, 0.42, 1);     // half-size inside the glade
    M.cone(x, h + 0.55 * near, z, rand(0.4, 1.1) * near, rand(1.0, 2.2) * near,
           i % 3 ? PALETTE.cavFern : PALETTE.cavPhyto,
           -Math.sin(a) * lean, rand(0, 3), Math.cos(a) * lean, 6);
  }
  const mesh = new THREE.Mesh(M.build(), cavVC());
  mesh.castShadow = true;
  root.add(mesh);

  // 5. the mist that sits under it, which is what the cave breathing looks like
  {
    const MM = cavMerger();
    for (let i = 0; i < 22; i++) {
      const a = rand(0, 6.28), rr = rand(0, D.r);
      MM.sph(Math.cos(a) * rr, rand(0, 3.5), Math.sin(a) * rr * 0.9,
             rand(7, 14), rand(0.8, 1.6), rand(7, 14), PALETTE.cavMist, 6);
    }
    cavMist = new THREE.Mesh(MM.build(), mat(PALETTE.cavMist, {
      transparent: true, opacity: 0.055, depthWrite: false, fog: false,
    }));
    cavMist.position.set(D.x, cavTerrain(D.x, D.z) + 3, D.z);
    cavMist.renderOrder = 5;
    cavMist.frustumCulled = false;
    root.add(cavMist);
  }

  cavBuildShaftLife(root);
  cavBuildPhyto(game, root);
}

/** See cavPHY_N. A field of rock fins, all of them pointed at the hole. */
function cavBuildPhyto(game, root) {
  const P = cavPHYTO, D = cavDOLINE;
  // ---- one blade, built once, instanced a hundred times ------------------
  // A metre tall and unit-scaled, so every instance is a scale and a rotation.
  // The GREEN IS A SKIN ON ONE FACE, not a tint on the whole fin: that is the
  // entire visual fact about phytokarst and it is what makes the field read as
  // a direction rather than as a patch of moss. Walk round it and it goes grey.
  const M = cavMerger();
  // ...AND THE BACK OF IT IS STONE, NOT A HOLE. In an ambient of 0.11 a fin
  // in cavRockDk photographs as a black slab, and a hundred black slabs in the
  // one lit room in the chapter is a field of missing polygons. The unlit side
  // of a blade is limestone with no algae on it: pale, and it is the CONTRAST
  // with the green face that carries the read, not the darkness of the back.
  M.box(0, 0.50, 0, 0.17, 1.00, 0.86, PALETTE.cavRock);
  M.box(0, 0.62, 0.16, 0.13, 0.74, 0.62, PALETTE.cavRockWarm, 0, 0, 0.06);
  // the lit face
  M.box(0, 0.52, 0.45, 0.145, 0.94, 0.055, PALETTE.cavPhyto);
  M.box(0, 0.88, 0.42, 0.115, 0.30, 0.075, PALETTE.cavFern);
  // and the comb along the top edge, which is what a blade actually looks
  // like close to: it is dissolving, so it is serrated
  for (let k = 0; k < 3; k++) {
    M.cone(0, 1.02 + 0.05, (k - 1) * 0.26, 0.075, 0.20, PALETTE.cavPhyto, 0, 0, 0.22, 4);
  }
  cavPhyBlades = new THREE.InstancedMesh(M.build(), cavVC(), cavPHY_N);
  cavPhyBlades.castShadow = true;
  cavPhyBlades.receiveShadow = true;
  cavPhyBlades.frustumCulled = false;
  // ---- AND THE ONE PLACE IN THIS CHAPTER WHERE AIR MOVES (D3) ------------
  // `grep -c sway` in this file was 0, and mostly that is correct: a cave has
  // no weather and a stalagmite that swayed would be a bug. The phytokarst is
  // the exception and it is the exception for the reason it exists at all —
  // it grows only where the doline lets daylight in, which is the same hole
  // the draught comes down. Small, and slow: this is a draught, not a breeze,
  // and `swayTick`'s field is near zero underground anyway, so what this buys
  // is that the one lit room in the chapter is not a photograph.
  swayMesh(cavPhyBlades, { amount: 0.10, axis: 'y', auto: true, stiff: 3.2, hz: 0.31 });
  cavPhyD = new Float32Array(cavPHY_N * 6);   // x, y, z, yaw, scale, phase
  let n = 0;
  let bP = cavPoolBody(game), nP = 0;
  for (let i = 0; i < cavPHY_N * 3 && n < cavPHY_N; i++) {
    // an oval patch on the rim, longer along the passage than across it
    const a = rand(0, 6.283), rr = Math.sqrt(Math.random());
    const x = P.x + Math.cos(a) * rr * 13, z = P.z + Math.sin(a) * rr * 9;
    if (cavIsOverWater(x, z)) continue;
    const h = cavTerrain(x, z);
    // WHICH WAY THE LIGHT IS. Every blade points its green face at the middle
    // of the hole, and the further from the light it is the harder it leans —
    // which is both what a plant does and the reason the field reads as an
    // arrow when you are standing in the middle of it.
    const yaw = Math.atan2(D.x - x, D.z - z);
    const far = clamp(Math.hypot(D.x - x, D.z - z) / 34, 0, 1);
    const o = n * 6;
    cavPhyD[o] = x; cavPhyD[o + 1] = h; cavPhyD[o + 2] = z;
    cavPhyD[o + 3] = yaw;
    // KNEE HIGH, WITH A FEW OVER. Measured from the rig at the first cut
    // (0.35–1.15 m) the field photographed as green confetti lying on the
    // floor — the flat-mark failure again, because a blade seen from forty
    // degrees up is only a blade if it is TALL enough to present its face. A
    // capybara is about 0.6 m at the shoulder, so the field runs from half
    // that to three times it and every eighth one is a proper fin.
    cavPhyD[o + 4] = (n % 8 === 0 ? rand(1.5, 2.2) : rand(0.5, 1.35)) * (1 - far * 0.22);
    cavPhyD[o + 5] = rand(0, 6.283);
    n++;
    // the tall ones are solid, because a rock fin you walk through is a rock
    // fin that is not made of rock
    if (cavPhyD[o + 4] > 0.95) {
      cavPoolBox(bP, x, h + cavPhyD[o + 4] * 0.5, z, 0.30, cavPhyD[o + 4] * 0.5, 0.46);
      if (++nP >= 16) { cavPoolDone(game, bP); bP = cavPoolBody(game); nP = 0; }
    }
  }
  cavPoolDone(game, bP);
  cavPhyBlades.count = n;
  // WRITTEN ONCE, HERE. cavUpdatePhyto only touches the matrices while the
  // field is actually moving (it is a garden; it holds still), so a field that
  // has never been shouted at has to arrive already standing up.
  for (let i = 0; i < n; i++) {
    const o = i * 6;
    const s = cavPhyD[o + 4];
    cavM.compose(cavV3.set(cavPhyD[o], cavPhyD[o + 1], cavPhyD[o + 2]),
                 cavQ.setFromEuler(cavE.set(-0.10, cavPhyD[o + 3], 0, 'YXZ')),
                 cavSc.set(s, s, s));
    cavPhyBlades.setMatrixAt(i, cavM);
  }
  cavPhyBlades.instanceMatrix.needsUpdate = true;
  root.add(cavPhyBlades);

  // ---- AND IT LETS GO OF SOMETHING WHEN YOU SHOUT AT IT ------------------
  // A pressure wave off a shelf of damp algae puts a cloud of spores in the
  // air; the drips, the crickets, the dust in the shaft and the fish in the
  // river are all already written to that rule, and this is the fifth. It is
  // the payoff for the one task in the chapter that had none — and because
  // spores are pale and the echo is a real light, the cloud is lit by the
  // shout that made it and by nothing else.
  {
    const S = cavMerger();
    S.box(0, 0, 0, 0.10, 0.10, 0.10, PALETTE.cavPhyto);
    cavSpores = new THREE.InstancedMesh(S.build(), cavGlow(PALETTE.cavFern, 0.55, 0.85), cavSPORE_N);
    cavSpores.frustumCulled = false;
    cavSpores.visible = false;
    cavSporeD = new Float32Array(cavSPORE_N * 7);   // x,y,z, vx,vy,vz, t
    for (let i = 0; i < cavSPORE_N; i++) cavSporeD[i * 7 + 6] = 1e9;
    root.add(cavSpores);
  }
}

/** The garden, on the frame clock. Still unless something disturbs it. */
function cavUpdatePhyto(dt) {
  if (!cavPhyBlades) return;
  const had = cavPhyShake;
  cavPhyShake = damp(cavPhyShake, 0, 1.1, dt);
  // NOTHING IS WRITTEN WHILE IT IS STILL. A hundred instance matrices a frame
  // for a field of rock that is not moving is the whole cost of this feature
  // paid every frame for nothing; it is a garden, and a garden holds still.
  if (had > 0.004 || cavPhyShake > 0.004) {
    const k = cavPhyShake;
    for (let i = 0; i < cavPhyBlades.count; i++) {
      const o = i * 6;
      const s = cavPhyD[o + 4];
      const w = Math.sin(cavTime * 17 + cavPhyD[o + 5]) * k * 0.16;
      cavM.compose(cavV3.set(cavPhyD[o], cavPhyD[o + 1], cavPhyD[o + 2]),
                   cavQ.setFromEuler(cavE.set(-0.10 - k * 0.05, cavPhyD[o + 3], w, 'YXZ')),
                   cavSc.set(s, s, s));
      cavPhyBlades.setMatrixAt(i, cavM);
    }
    cavPhyBlades.instanceMatrix.needsUpdate = true;
  }
  if (!cavSpores) return;
  let live = 0;
  for (let i = 0; i < cavSPORE_N; i++) {
    const o = i * 7;
    if (cavSporeD[o + 6] > 4.2) continue;
    cavSporeD[o + 6] += dt;
    // they do not fall, they HANG — a spore is lighter than the air it is in
    // and this is a cave with a draught through it
    cavSporeD[o + 3] *= 1 - Math.min(1, 1.7 * dt);
    cavSporeD[o + 5] *= 1 - Math.min(1, 1.7 * dt);
    cavSporeD[o] += cavSporeD[o + 3] * dt;
    cavSporeD[o + 1] += cavSporeD[o + 4] * dt;
    cavSporeD[o + 2] += cavSporeD[o + 5] * dt;
    cavSporeD[o + 4] = damp(cavSporeD[o + 4], 0.16, 1.2, dt);
    const t = cavSporeD[o + 6];
    const sc = clamp(t / 0.25, 0, 1) * clamp((4.2 - t) / 1.6, 0, 1);
    cavM.compose(cavV3.set(cavSporeD[o], cavSporeD[o + 1], cavSporeD[o + 2]),
                 cavQ.setFromEuler(cavE.set(t * 1.4, t * 0.9, 0)),
                 cavSc.set(sc, sc, sc));
    cavSpores.setMatrixAt(i, cavM);
    live++;
  }
  if (live > 0) {
    cavSpores.visible = true;
    cavSpores.instanceMatrix.needsUpdate = true;
  } else if (cavSpores.visible) {
    cavSpores.visible = false;
  }
}

/** Put a cloud of spores in the air over the garden. See cavBuildPhyto. */
function cavPuffSpores(x, z) {
  if (!cavSporeD) return;
  let n = 0;
  for (let i = 0; i < cavSPORE_N && n < 26; i++) {
    const o = i * 7;
    if (cavSporeD[o + 6] < 4.2) continue;
    const a = rand(0, 6.283), rr = Math.sqrt(Math.random()) * 7;
    cavSporeD[o] = x + Math.cos(a) * rr;
    cavSporeD[o + 1] = cavTerrain(x + Math.cos(a) * rr, z + Math.sin(a) * rr) + rand(0.15, 1.1);
    cavSporeD[o + 2] = z + Math.sin(a) * rr;
    cavSporeD[o + 3] = rand(-1.1, 1.1);
    cavSporeD[o + 4] = rand(0.5, 1.6);
    cavSporeD[o + 5] = rand(-1.1, 1.1);
    cavSporeD[o + 6] = -rand(0, 0.22);       // a stagger, so it is a cloud
    n++;
  }
}

/**
 * WHAT IS ACTUALLY IN A TWO-HUNDRED-METRE COLUMN OF DAYLIGHT.
 *
 * Two things, and both of them are silhouettes — which is the only kind of
 * detail that survives being drawn against the brightest surface in the
 * chapter. A lit object in front of a lit disc is a smudge; a dark one is a
 * shape, and there is nothing else in a hundred and seventy metres of mountain
 * that gets to be a shape against anything.
 *
 *   THE SWIFTS. Not the swiftlets — those live at the far end in the dark and
 *     navigate on clicks. These are the ones that use the hole: they come in
 *     over the rim, drop the whole two hundred metres in a spiral inside the
 *     column, and go out again. It is the one thing that gives the shaft a
 *     SIZE, because a bird you can barely see at the top is the same bird you
 *     can count the wings on by the time it reaches the floor.
 *
 *   THE FALL. A forest grows round the rim of a collapse doline and everything
 *     it drops comes down the hole. From underneath that is a slow, sparse,
 *     endless drift of leaves through the beam, and it is the single cheapest
 *     way of saying that the bright thing overhead is an OPENING and not a
 *     lamp. They tumble (a leaf falls edge-over-edge, not like a stone) and
 *     they take the better part of a minute, because two hundred metres is a
 *     very long way and the whole point is that you have time to watch one.
 *
 * Neither is collided, neither makes a sound and neither is on any list. They
 * are two instanced meshes and they exist to be looked at.
 */
function cavBuildShaftLife(root) {
  const D = cavDOLINE;
  const floor = cavTerrain(D.x, D.z);
  // ---- the swifts --------------------------------------------------------
  {
    const M = cavMerger();
    // A DART AND TWO SWEPT WINGS. A swift's silhouette is the most recognisable
    // in the air and it is entirely in the wings: back-swept, thin, and much
    // longer than the body. Twelve triangles.
    M.box(0, 0, 0, 0.16, 0.14, 0.62, PALETTE.cavRockDk);
    for (let s = -1; s <= 1; s += 2) {
      M.box(s * 0.48, 0.02, -0.10, 0.86, 0.045, 0.20, PALETTE.cavRockDk, 0, s * 0.62, 0);
    }
    M.box(0, 0.01, -0.42, 0.20, 0.04, 0.26, PALETTE.cavRockDk);
    cavSwirl = new THREE.InstancedMesh(M.build(), cavVC(), cavSWIRL_N);
    cavSwirl.frustumCulled = false;
    cavSwirlPh = new Float32Array(cavSWIRL_N * 3);
    for (let i = 0; i < cavSWIRL_N; i++) {
      cavSwirlPh[i * 3] = Math.random();               // where round the drop it is
      cavSwirlPh[i * 3 + 1] = rand(0.055, 0.098);      // how fast it falls, 0..1/s
      cavSwirlPh[i * 3 + 2] = rand(0, 6.283);          // ...and which way round
    }
    root.add(cavSwirl);
  }
  // ---- and the litter coming down the hole -------------------------------
  {
    const M = cavMerger();
    M.box(0, 0, 0, 0.40, 0.02, 0.62, PALETTE.cavJungleLt);
    cavFallLeaf = new THREE.InstancedMesh(M.build(), cavVC(), cavFALL_N);
    cavFallLeaf.frustumCulled = false;
    cavFallLeafD = new Float32Array(cavFALL_N * 5);
    for (let i = 0; i < cavFALL_N; i++) {
      const o = i * 5;
      const a = rand(0, 6.283), rr = Math.sqrt(Math.random()) * D.r * 0.80;
      cavFallLeafD[o] = D.x + Math.cos(a) * rr;
      cavFallLeafD[o + 1] = floor + Math.random() * 200;   // seeded up the column
      cavFallLeafD[o + 2] = D.z + Math.sin(a) * rr * 0.9;
      cavFallLeafD[o + 3] = rand(2.6, 5.4);                // m/s down
      cavFallLeafD[o + 4] = rand(0, 6.283);                // tumble phase
    }
    root.add(cavFallLeaf);
  }
}

/**
 * The column, on the frame clock. Nothing here is rationed by distance because
 * the doline is a hundred and forty metres across and the whole point of both
 * populations is that they are visible from outside it.
 */
function cavUpdateShaftLife(dt) {
  const D = cavDOLINE;
  const floor = cavTerrain(D.x, D.z);
  if (cavSwirl) {
    for (let i = 0; i < cavSWIRL_N; i++) {
      const o = i * 3;
      cavSwirlPh[o] += cavSwirlPh[o + 1] * dt;
      if (cavSwirlPh[o] > 1) cavSwirlPh[o] -= 1;
      const u = cavSwirlPh[o];
      // down the column, and the spiral tightens as it comes: a bird arriving
      // through a hole a hundred and forty metres across is nowhere near the
      // middle at the top and is threading the trees by the bottom
      // ...AND THEY COME DOWN TO HEAD HEIGHT. At floor + 10 the whole flight
      // was ten metres over the animal, and with the crane the top of the
      // frame is only thirteen degrees above horizontal — so from inside the
      // glade the birds were above the picture for every metre of the drop.
      // A swift that has come in through the hole finishes by THREADING THE
      // TREES, which is both what they do and the only part of the flight
      // anybody standing underneath was ever going to see.
      const y = lerp(196, floor + 3.4, u);
      const turns = 3.4;
      const a = cavSwirlPh[o + 2] + u * turns * Math.PI * 2;
      const rr = lerp(D.r * 1.05, 5.5, cavSmooth(u));
      const x = D.x + Math.cos(a) * rr;
      const z = D.z + Math.sin(a) * rr * 0.9;
      // the tangent of that spiral IS the heading, and the bank is how hard it
      // is turning — which at the bottom, on a five-metre radius, is hard over
      const yaw = a + Math.PI * 0.5;
      const bank = -lerp(0.35, 1.15, cavSmooth(u));
      // ...and it FADES IN rather than popping: the last tenth of the drop is
      // spent leaving under the rim, so it is smallest exactly where it appears
      const sc = lerp(0.7, 1.25, cavSmooth(u)) * clamp(Math.min(u, 1 - u) / 0.07, 0.06, 1);
      cavM.compose(cavV3.set(x, y, z),
                   cavQ.setFromEuler(cavE.set(0.18, yaw, bank, 'YXZ')),
                   cavSc.set(sc, sc, sc));
      cavSwirl.setMatrixAt(i, cavM);
    }
    cavSwirl.instanceMatrix.needsUpdate = true;
  }
  if (cavFallLeaf) {
    for (let i = 0; i < cavFALL_N; i++) {
      const o = i * 5;
      cavFallLeafD[o + 1] -= cavFallLeafD[o + 3] * dt;
      cavFallLeafD[o + 4] += dt * (1.4 + (i % 5) * 0.4);
      // it does not fall straight: a leaf slips sideways on every flip, which
      // is why one takes so long to come down
      const ph = cavFallLeafD[o + 4];
      const x = cavFallLeafD[o] + Math.sin(ph * 0.62) * 3.4;
      const z = cavFallLeafD[o + 2] + Math.cos(ph * 0.47) * 3.0;
      if (cavFallLeafD[o + 1] < floor + 0.3) {
        // back up the hole. A leaf that lands is litter; there is already
        // litter on that floor and none of it needs to be an instance.
        const a = rand(0, 6.283), rr = Math.sqrt(Math.random()) * D.r * 0.80;
        cavFallLeafD[o] = D.x + Math.cos(a) * rr;
        cavFallLeafD[o + 1] = floor + rand(150, 205);
        cavFallLeafD[o + 2] = D.z + Math.sin(a) * rr * 0.9;
      }
      cavM.compose(cavV3.set(x, cavFallLeafD[o + 1], z),
                   cavQ.setFromEuler(cavE.set(ph, ph * 0.31, ph * 0.7)),
                   cavSc.set(1, 1, 1));
      cavFallLeaf.setMatrixAt(i, cavM);
    }
    cavFallLeaf.instanceMatrix.needsUpdate = true;
  }
}

/**
 * THE GLOW-WORMS, AND THEY ARE THE MAP.
 *
 * Arachnocampa hang from a cave roof on fishing lines and glow to bring things
 * up out of the water at them, which means they are always over the river and
 * never anywhere else. So a player who has understood nothing else about this
 * chapter can still follow the blue-green dots and get where they are going —
 * and the reason it works is not a design decision, it is entomology.
 */
function cavBuildWorms(root) {
  const M = cavMerger();
  // A BOX, NOT A SPHERE. At fourteen centimetres from thirty metres away in
  // the dark a glow-worm is one bloomed pixel and there is no silhouette to
  // get wrong — and a six-by-four sphere is thirty-six triangles against a
  // box's twelve. The whole point of the colony is that there are a great
  // many of them, so the count is where the money should go: four hundred and
  // twenty spheres cost 15 120 triangles, and nine hundred and sixty boxes
  // cost 11 520 and read as a Milky Way rather than as a handful of dots.
  M.box(0, 0, 0, 0.15, 0.15, 0.15, PALETTE.cavGlow);
  const N = 960;
  // CLONED, because the emissive on this material is written every frame when
  // the colony is disturbed and `mat()` hands back a SHARED cached entry — a
  // cache somebody else is holding is not a thing to breathe on.
  cavWormMat = cavGlow(PALETTE.cavGlow, 1.9).clone();
  cavWorms = new THREE.InstancedMesh(M.build(), cavWormMat, N);
  cavWorms.frustumCulled = false;
  // ...AND THEY HANG IN CONSTELLATIONS, NOT IN A HAZE. Arachnocampa build on
  // an overhang and every larva is within a few centimetres of the last one's
  // fishing lines, so a colony is a dense patch fifteen or twenty across with
  // black between the patches. An even scatter over two hundred metres of roof
  // is a spray of dots that carries no information; a chain of clusters
  // following the water is a THING TO FOLLOW, which is what the chapter says
  // they are for.
  let n = 0;
  for (let seed = 0; seed < 240 && n < N; seed++) {
    const sz = rand(-176, 42);
    const sx = cavRIVER_X + (Math.random() < 0.72 ? rand(-cavRIVER_W, cavRIVER_W)
                                                  : rand(-46, 46));
    if (cavHole(sx, sz) > 0.2) continue;
    if (sz < -96 && Math.abs(sx - cavRIVER_X) > 24) continue;
    const per = 2 + (seed % 4);
    for (let k = 0; k < per && n < N; k++) {
      const x = sx + rand(-4.5, 4.5), z = sz + rand(-4.5, 4.5);
      if (cavHole(x, z) > 0.2) continue;
      const roof = cavRoofH(x, z);
      const y = roof - rand(0.4, 7);
      const s = rand(0.5, 1.6);
      cavM.compose(cavV3.set(x, y, z), cavQ.setFromEuler(cavE.set(0, 0, 0)), cavSc.set(s, s, s));
      cavWorms.setMatrixAt(n++, cavM);
    }
  }
  cavWorms.count = n;
  root.add(cavWorms);
}

/**
 * THE DRIPS, AND A CAVE IS MADE OF THEM.
 *
 * Every formation in this chapter is drawn as "a cone on a cone on a cone,
 * because that is exactly how one grows: a drip at a time" — and there were no
 * drips. Twenty-six of them falling out of the roof on independent clocks,
 * each with a ring where it lands, and the sound is already in the ambience
 * (`tick`, pitched down, which is water on stone). Two things make this read
 * rather than sparkle: they are LONG (a drop falling forty metres is a streak,
 * not a dot) and they are EMISSIVE, because in a chapter whose ambient is 0.11
 * a Lambert drop is invisible.
 */
function cavBuildDrips(root) {
  const g = new THREE.BoxGeometry(0.055, 1.0, 0.055);
  cavDripMesh = new THREE.InstancedMesh(g, cavGlow(PALETTE.cavWaterLt, 0.85), cavDRIP_N);
  cavDripMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cavDripMesh.frustumCulled = false;
  cavDripData = new Float32Array(cavDRIP_N * 5);   // x, z, roofY, t, period
  for (let i = 0; i < cavDRIP_N; i++) {
    const o = i * 5;
    let x, z, tries = 0;
    do { x = rand(-52, 52); z = rand(-172, 40); } while (cavHole(x, z) > 0.2 && ++tries < 20);
    cavDripData[o] = x;
    cavDripData[o + 1] = z;
    cavDripData[o + 2] = cavRoofH(x, z) - rand(2, 10);
    cavDripData[o + 4] = rand(1.6, 5.5);
    cavDripData[o + 3] = rand(0, cavDripData[o + 4]);
  }
  root.add(cavDripMesh);

  // ...and the ring each one leaves. Cheap, and it is what turns a falling
  // speck into a thing that ARRIVED somewhere.
  const rg = new THREE.RingGeometry(0.62, 1.0, 14, 1);
  rg.rotateX(-Math.PI / 2);
  cavRingMat = mat(PALETTE.cavEcho, {
    emissive: PALETTE.cavEcho, emissiveIntensity: 0.9,
    transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide,
  }).clone();
  cavRingMesh = new THREE.InstancedMesh(rg, cavRingMat, cavRING_N);
  cavRingMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cavRingMesh.frustumCulled = false;
  cavRingMesh.renderOrder = 4;
  for (let i = 0; i < cavRING_N; i++) {
    cavRingD[i * 4 + 3] = 1e9;
    cavRingMesh.setMatrixAt(i, cavXform(0, -900, 0, 0, 0, 0, 0.01, 0.01, 0.01));
  }
  cavRingMesh.instanceMatrix.needsUpdate = true;
  root.add(cavRingMesh);
}
function cavRing(x, y, z) {
  if (!cavRingMesh) return;
  const i = cavRingHead;
  cavRingHead = (cavRingHead + 1) % cavRING_N;
  cavRingD[i * 4] = x; cavRingD[i * 4 + 1] = y; cavRingD[i * 4 + 2] = z; cavRingD[i * 4 + 3] = 0;
}

/**
 * THE CRICKETS. `cavCricket` has been in the palette since the chapter shipped
 * and nothing has ever used it.
 *
 * Rhaphidophoridae: pale, blind-ish, enormous antennae, and they sit on the
 * wall until something happens and then they are somewhere else. That is the
 * whole animation and it is the correct one — a cave cricket does not walk, it
 * TELEPORTS, and it is the only thing in here that reacts to the echo the way
 * a small animal reacts to a shout.
 */
function cavBuildCrickets(root) {
  const M = cavMerger();
  M.sph(0, 0, 0, 0.09, 0.07, 0.15, PALETTE.cavCricket, 6);
  M.sph(0, 0.05, 0.12, 0.06, 0.05, 0.06, PALETTE.cavCricket, 6);
  for (let s = -1; s <= 1; s += 2) {
    // THE ANTENNAE, and they are four times the length of the animal, which is
    // the only thing anybody remembers about one
    M.box(s * 0.14, 0.06, 0.30, 0.03, 0.02, 0.62, PALETTE.cavCricket, 0, s * 0.34, 0);
    M.box(s * 0.11, -0.02, -0.06, 0.05, 0.16, 0.05, PALETTE.cavCricket, 0.4, 0, s * 0.5);
    M.box(s * 0.09, -0.03, 0.06, 0.04, 0.12, 0.04, PALETTE.cavCricket, 0, 0, s * 0.3);
  }
  cavCricks = new THREE.InstancedMesh(M.build(), cavVC(), cavCRICK_N);
  cavCricks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cavCricks.frustumCulled = false;
  // x, z, yaw, hop, HOME x, HOME z — the last two are the fix, see cavCrickHome
  cavCrickData = new Float32Array(cavCRICK_N * 6);
  for (let i = 0; i < cavCRICK_N; i++) cavCrickHome(i);
  root.add(cavCricks);
}

/**
 * WHERE A CRICKET LIVES, AND IT IS NOT IN THE RIVER.
 *
 * Two things were wrong with the original scatter and both were measured.
 *
 *  1. It was `cavRIVER_X + rand(-26, 26)` with no test at all, and the channel
 *     is thirty metres wide — so TWENTY OF THE FORTY were standing on the
 *     riverbed under two and a half metres of water, in the one chapter where
 *     the river is a task. The comment above says "on the sand beside the
 *     river"; half of them were in it.
 *  2. The hop is a step in a random direction with nothing to come back to,
 *     which is a random walk: measured over six minutes of play with a wheek
 *     every thirty seconds, the colony drifted 8.5 m on average and 17.7 m at
 *     the worst. Same family as the Pantanal's grazing herd, and the same fix
 *     — a cricket has a crack it lives in and it does not leave it.
 */
function cavCrickHome(i) {
  const o = i * 6;
  let x = 0, z = 0;
  for (let k = 0; k < 24; k++) {
    // the guano bank is beside the water, not in it: the channel is 15 m of
    // half-width and the sand runs out to about 26
    const side = Math.random() < 0.5 ? -1 : 1;
    x = cavRIVER_X + side * rand(cavRIVER_W + 1.5, 27);
    z = rand(-160, 34);
    // ...and not in the doline either: the one lit room in the chapter has a
    // forest and a camp in it, and a cave cricket is a thing that lives in the
    // dark by definition.
    if (!cavIsOverWater(x, z) && Math.abs(x) < 56 && !cavInZone('doline', x, z)) break;
  }
  cavCrickData[o] = x;
  cavCrickData[o + 1] = z;
  cavCrickData[o + 2] = rand(0, 6.28);
  cavCrickData[o + 3] = 0;
  cavCrickData[o + 4] = x;
  cavCrickData[o + 5] = z;
}

/**
 * THE WATER COMING THROUGH THE HOLE IN THE ROOF.
 *
 * A doline is a collapse, and a collapse in a limestone mountain in a monsoon
 * country has a stream running off it. Every photograph of this place has a
 * column of water falling two hundred metres through the shaft of light, and
 * this chapter had a shaft with nothing in it. It costs one box and one merged
 * sphere cluster, and it is what makes the shaft read as a SPACE rather than
 * as a painted cone: something is falling through it, so it has depth.
 */
function cavBuildFall(root) {
  const D = cavDOLINE;
  // ...and the FALL goes on the other side, into the river, which is where a
  // stream coming off a collapsed roof actually ends up.
  const FX = D.x - 16, FZ = D.z + 4;
  const floor = cavTerrain(FX, FZ);
  const top = 196;
  const h = top - floor;
  // TWELVE SIDES, NOT SEVEN. A seven-sided column two hundred metres tall
  // photographs as a flat grey SLAB — the silhouette has to curve or it is a
  // wall, which is the same lesson the shaft above it paid for once already.
  const g = new THREE.CylinderGeometry(0.55, 3.4, h, 12, 8, true);
  const n = g.attributes.position.count;
  const pa = g.attributes.position.array;
  const ca = new Float32Array(n * 4);
  const c1 = new THREE.Color(PALETTE.cavShaft);
  const c2 = new THREE.Color(PALETTE.cavFoam);
  for (let v = 0; v < n; v++) {
    const t = clamp((pa[v * 3 + 1] + h * 0.5) / h, 0, 1);
    cavCol.copy(c2).lerp(c1, t);
    ca[v * 4] = cavCol.r; ca[v * 4 + 1] = cavCol.g; ca[v * 4 + 2] = cavCol.b;
    // A FALL IS BRIGHTER AT THE BOTTOM, which is the opposite of the shaft
    // above it: two hundred metres of fall is not a rope of water by the time
    // it lands, it is a cloud, and a cloud catches more light than a rope.
    // ...AND IT IS FAINT. 0.34 of white on a nearly black background under
    // additive blending is a solid bar of concrete, which is exactly what the
    // shaft's own note says and exactly what this made again. A fall this tall
    // is mostly air by the time it is halfway down.
    ca[v * 4 + 3] = 0.03 + Math.pow(1 - t, 1.5) * 0.13;
  }
  g.setAttribute('color', new THREE.BufferAttribute(ca, 4));
  cavFallMesh = new THREE.Mesh(g, mat(0xffffff, {
    vertexColors: true, transparent: true, opacity: 1,
    blending: THREE.AdditiveBlending, depthWrite: false,
    side: THREE.DoubleSide, fog: false,
  }).clone());
  cavFallMesh.position.set(FX, floor + h * 0.5, FZ);
  cavFallMesh.renderOrder = 6;
  cavFallMesh.frustumCulled = false;
  root.add(cavFallMesh);

  // the spray at the foot of it, which is the only white thing in the chapter
  const MM = cavMerger();
  for (let i = 0; i < 9; i++) {
    const a = rand(0, 6.28), rr = rand(0, 5.5);
    MM.sph(Math.cos(a) * rr, rand(0, 2.6), Math.sin(a) * rr,
           rand(2.2, 4.4), rand(1.0, 2.0), rand(2.2, 4.4), PALETTE.cavFoam, 6);
  }
  cavFallMist = new THREE.Mesh(MM.build(), mat(PALETTE.cavFoam, {
    transparent: true, opacity: 0.10, depthWrite: false, fog: false,
  }).clone());
  cavFallMist.position.set(FX, floor + 1.4, FZ);
  cavFallMist.renderOrder = 5;
  cavFallMist.frustumCulled = false;
  root.add(cavFallMist);
}

/** The dust in the light. See the note on cavMOTE_N. */
function cavBuildMotes(root) {
  // FIVE CENTIMETRES, NOT TWENTY. Photographed from the gameplay rig inside
  // the doline, motes at 0.10 scaled to 2.2 came out as squares of white paper
  // hanging in a wood. Dust is dust: the near ones have to be at the limit of
  // what a pixel can hold, and all the read comes from how many there are.
  const g = new THREE.BoxGeometry(0.055, 0.055, 0.055);
  cavMotes = new THREE.InstancedMesh(g, cavGlow(PALETTE.cavShaft, 0.95), cavMOTE_N);
  cavMotes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cavMotes.frustumCulled = false;
  cavMoteData = new Float32Array(cavMOTE_N * 5);   // a, r, y, fall, size
  for (let i = 0; i < cavMOTE_N; i++) {
    const o = i * 5;
    cavMoteData[o] = rand(0, 6.28);
    cavMoteData[o + 1] = Math.sqrt(Math.random()) * 21;
    cavMoteData[o + 2] = rand(0, 44);
    cavMoteData[o + 3] = rand(0.28, 0.95);
    cavMoteData[o + 4] = rand(0.35, 1.30);
  }
  root.add(cavMotes);
}

/**
 * They fall, very slowly, and the shout blows them about.
 *
 * A pulse of sound that moves the dust is the cheapest possible way of saying
 * the echo is a PRESSURE WAVE rather than a light — and it is the only thing
 * in the chapter that reacts to the wheek in the one room where the wheek is
 * not needed for seeing.
 */
function cavUpdateMotes(dt) {
  if (!cavMotes) return;
  cavMoteStir = damp(cavMoteStir, 0, 0.55, dt);
  const D = cavDOLINE;
  const floor = cavTerrain(D.x, D.z);
  for (let i = 0; i < cavMOTE_N; i++) {
    const o = i * 5;
    cavMoteData[o + 2] -= cavMoteData[o + 3] * dt * (1 - cavMoteStir * 0.7);
    cavMoteData[o] += (0.045 + cavMoteStir * 0.55) * dt * (i % 2 ? 1 : -1);
    if (cavMoteStir > 0.01) cavMoteData[o + 1] += cavMoteStir * 5.5 * dt;
    if (cavMoteData[o + 2] < 0 || cavMoteData[o + 1] > 25) {
      cavMoteData[o + 2] = rand(38, 48);
      cavMoteData[o + 1] = Math.sqrt(Math.random()) * 20;
      cavMoteData[o] = rand(0, 6.28);
    }
    // the shaft narrows toward the floor, so a mote low down is nearer the
    // middle — which is what makes the column read as a CONE
    const y = cavMoteData[o + 2];
    const taper = 0.42 + 0.58 * clamp(y / 46, 0, 1);
    const r = cavMoteData[o + 1] * taper;
    const s = cavMoteData[o + 4];
    cavMotes.setMatrixAt(i, cavXform(D.x + Math.cos(cavMoteData[o]) * r,
                                     floor + 0.6 + y,
                                     D.z + Math.sin(cavMoteData[o]) * r * 0.92,
                                     0, cavMoteData[o], 0, s, s, s));
  }
  cavMotes.instanceMatrix.needsUpdate = true;
}

/**
 * THE EXPEDITION, AND FOR ITS WHOLE LIFE THIS CHAPTER HAD NOBODY IN IT AT ALL.
 *
 * Zero locals. Sixteen chapters, and this is the only one where the capybara
 * is entirely alone with the geology — which sounds like an artistic decision
 * and is not, because the ONE THING everybody knows about Sơn Đoòng is that
 * you cannot go in it by yourself. It is a permit, a guide, a rope team and
 * twenty porters, camped for two nights, and the second camp is UNDER THE
 * DOLINE because that is the only place in a hundred and seventy metres of
 * mountain with light and drinking water.
 *
 * And in a chapter about darkness, a person is a LIGHT. Each of the two under
 * the hole carries a head torch — one real PointLight apiece, warm, short
 * range — so the camp is visible from the passage long before anything else
 * is, and walking toward the only two moving lights in a mountain is a better
 * signpost than any arrow.
 */
function cavBuildCamp(game, root) {
  const D = cavDOLINE;
  const M = cavMerger();
  // EAST OF THE HOLE, because west of it is the river: the first cut put the
  // camp at D.x - 11 and the channel runs from -35 to -5, so three tents and
  // five people were pitched in nine metres of water. The probe refused two of
  // them and drew the rest floating.
  const cx = D.x + 13, cz = D.z + 3;
  const gy = cavTerrain(cx, cz);
  // three tents, and they are the only saturated colour down here
  const tents = [[0, 0, 0.4], [4.6, 2.2, 1.1], [2.4, -3.6, 2.3]];
  for (let i = 0; i < tents.length; i++) {
    const tx = cx + tents[i][0], tz = cz + tents[i][1];
    const ty = cavTerrain(tx, tz);
    M.box(tx, ty + 0.62, tz, 2.5, 1.24, 2.2, i === 1 ? PALETTE.cavTentB : PALETTE.cavTent,
          0, tents[i][2], 0);
    M.cone(tx, ty + 1.5, tz, 1.7, 0.9, i === 1 ? PALETTE.cavTentB : PALETTE.cavTent,
           0, tents[i][2] + 0.78, 0, 4);
    M.box(tx, ty + 0.06, tz, 2.9, 0.12, 2.6, PALETTE.cavRockDk, 0, tents[i][2], 0);
    cavStaticBox(game, tx, ty + 0.7, tz, 2.6, 1.4, 2.3, tents[i][2]);
  }
  // the kit: barrels, a stove, a coil of rope and a stack of dry bags. A camp
  // with nothing loose in it is a model of a camp.
  for (let i = 0; i < 6; i++) {
    const bx = cx + rand(-6, 7), bz = cz + rand(-5, 5);
    const by = cavTerrain(bx, bz);
    M.cyl(bx, by + 0.32, bz, 0.28, 0.64, i % 2 ? PALETTE.cavTent : PALETTE.cavRockWarm,
          0, rand(0, 3), 0, 8);
  }
  M.cyl(cx + 5.6, gy + 0.12, cz - 1.4, 0.75, 0.24, PALETTE.cavRope, 0, 0, 0, 8);
  M.cyl(cx + 5.6, gy + 0.30, cz - 1.4, 0.60, 0.18, PALETTE.cavRope, 0, 0.4, 0, 8);
  // ---- THE STOVE, AND IT IS THE ONLY WARM THING IN THE MOUNTAIN ----------
  // Twenty porters carried this camp in and one of the locals has a line about
  // carrying the stove; there was no stove. In a chapter whose whole argument
  // is "the only light is the one you make", a second, ORANGE, permanent light
  // is worth more than any amount of geometry: it is visible from four hundred
  // metres down the passage, it is not yours, and it is the one place in here
  // where somebody is cooking. See also the head torches, which are the same
  // idea moving about.
  {
    const sx = cx - 2.6, sz = cz + 1.8;
    const sy = cavTerrain(sx, sz);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      M.cyl(sx + Math.cos(a) * 0.30, sy + 0.22, sz + Math.sin(a) * 0.30, 0.035, 0.44,
            PALETTE.cavRockDk, 0.2, 0, 0.2, 4);
    }
    M.cyl(sx, sy + 0.30, sz, 0.30, 0.22, PALETTE.cavRockDk, 0, 0, 0, 8);
    const flame = new THREE.Mesh(cavG.cone6.clone(), cavGlow(PALETTE.cavTent, 2.6));
    flame.scale.set(0.30, 0.42, 0.30);
    flame.position.set(sx, sy + 0.52, sz);
    root.add(flame);
    const L = new THREE.PointLight(PALETTE.cavTent, 3.4, 26, 1.4);
    L.position.set(sx, sy + 0.9, sz);
    root.add(L);
    cavStove = L;
    cavStoveFlame = flame;
    // a billy on it, because a stove with nothing on it is a fire pit
    M.cyl(sx, sy + 0.62, sz, 0.17, 0.24, PALETTE.cavRockDk, 0, 0, 0, 6);
  }
  // and a line strung between two tents with things drying on it, which is the
  // one detail that says people have SLEPT here
  M.box(cx + 2.3, gy + 1.85, cz + 1.1, 4.8, 0.035, 0.035, PALETTE.cavRope, 0, 0.4, 0);
  for (let i = 0; i < 5; i++) {
    M.box(cx + 0.5 + i * 0.95, gy + 1.55, cz + 1.1 + i * 0.16, 0.5, 0.62, 0.03,
          i % 2 ? PALETTE.cavTentB : PALETTE.cavJungleLt, 0, 0.4, 0);
  }
  const mesh = new THREE.Mesh(M.build(), cavVC());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);

  // ---- THE FIXED LINE down the entrance slope ----------------------------
  // The way in is a sixty-metre descent on a rope, and the game asks you to
  // walk down it as though it were a hill. The rope is not a mechanic — it is
  // the sentence "somebody rigged this", and it is the first thing you see.
  {
    const R = cavMerger();
    for (let z = 46; z > 24; z -= 2.6) {
      const y = cavTerrain(9, z);
      R.cyl(9, y + 0.85, z, 0.05, 1.7, PALETTE.cavRockDk, 0, 0, 0, 4);
      R.box(9, y + 1.62, z - 1.3, 0.05, 0.05, 2.6, PALETTE.cavRope, 0.28, 0, 0);
    }
    const rm = new THREE.Mesh(R.build(), cavVC());
    rm.castShadow = true;
    root.add(rm);
  }

  // ---- and the people ----------------------------------------------------
  if (typeof game.addLocal !== 'function') return;
  const put = function (x, z, o, lamp) {
    const h = cavTerrain(x, z);
    if (cavIsOverWater(x, z)) {
      console.warn('[cave] local at', x, z, 'is in the river (' + h.toFixed(2) + ') - skipped');
      return null;
    }
    o.biome = 'cave'; o.x = x; o.z = z; o.y = h;
    if (o.near === undefined) o.near = 9;
    const rec = game.addLocal(o);
    // THE HEAD TORCH. A real light, and it is why these two are worth putting
    // under the hole rather than outside it: the only two things in a hundred
    // and seventy metres of mountain that move AND glow.
    if (lamp && rec && rec.group) {
      const L = new THREE.PointLight(PALETTE.cavShaftLo, 1.9, 22, 1.6);
      L.position.set(0, 1.62, 0.30);
      rec.group.add(L);
      const bulb = new THREE.Mesh(cavG.sph6.clone(), cavGlow(PALETTE.cavShaftLo, 2.4));
      bulb.scale.set(0.11, 0.09, 0.09);
      bulb.position.set(0, 1.62, 0.16);
      rec.group.add(bulb);
      // ---- AND A HEAD TORCH HAS A BEAM ---------------------------------
      // The light was real and the SOURCE was invisible: a warm dot on a
      // forehead, in a chapter whose entire subject is what a light does to a
      // dark room. A caving lamp in air with any dust in it at all has a
      // visible cone, and in here there is a great deal of dust — one
      // additive cone, four sides, no depth write, and it swings with the
      // head, which is what makes the two people under the hole read as
      // people LOOKING at things rather than as figures with a bulb on.
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 1.05, 7.0, 4, 1, true),
        mat(PALETTE.cavShaftLo, {
          transparent: true, opacity: 0.055, depthWrite: false,
          blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
        }).clone());
      cone.rotation.x = Math.PI * 0.5;
      cone.position.set(0, 1.60, 3.55);
      cone.renderOrder = 6;
      cone.frustumCulled = false;
      rec.group.add(cone);
      cavLampAt.push(L);
      cavLampCone.push(cone);
    }
    // ---- WHAT THEY ARE HOLDING ------------------------------------------
    // Six people, and every one of them was a coloured box with a hat on. A
    // local is a person doing a JOB — that is the whole reason they are down
    // here and the whole content of what they say — and the thing in their
    // hands is the shortest way to say which job. One merged mesh each,
    // parented to the figure so it turns when they turn to watch you.
    if (o.kit && rec && rec.group) {
      const K = cavMerger();
      if (o.kit === 'rope') {
        // a coil over the shoulder
        for (let k = 0; k < 4; k++) {
          K.cyl(-0.30, 1.16 - k * 0.045, 0.10, 0.19 - k * 0.012, 0.05,
                PALETTE.cavRope, 0.35, 0, 0.30, 8);
        }
        K.box(0.30, 1.02, 0.14, 0.10, 0.42, 0.10, PALETTE.cavRockDk, 0.2, 0, 0);
      } else if (o.kit === 'survey') {
        // a tripod and an instrument, which is a leg at each corner and a
        // small box on top: the only object down here that says "nine hundred
        // metres of survey and three days of it left"
        for (let k = 0; k < 3; k++) {
          const a = (k / 3) * Math.PI * 2;
          K.cyl(0.62 + Math.cos(a) * 0.22, 0.62, 0.30 + Math.sin(a) * 0.22, 0.022, 1.30,
                PALETTE.cavRockDk, Math.sin(a) * 0.30, 0, -Math.cos(a) * 0.30, 4);
        }
        K.box(0.62, 1.32, 0.30, 0.20, 0.15, 0.24, PALETTE.cavTentB);
        K.cyl(0.62, 1.34, 0.42, 0.045, 0.14, PALETTE.cavRockDk, Math.PI / 2, 0, 0, 6);
      } else if (o.kit === 'load') {
        // forty kilos on a frame, and it is the one thing everybody who has
        // been to Sơn Đoòng talks about
        K.box(0, 1.16, -0.30, 0.52, 0.66, 0.34, PALETTE.cavTent, 0, 0, 0);
        K.box(0, 1.52, -0.30, 0.46, 0.16, 0.30, PALETTE.cavRope);
        for (let s = -1; s <= 1; s += 2) {
          K.box(s * 0.20, 1.20, -0.06, 0.05, 0.60, 0.05, PALETTE.cavRope, 0.16, 0, 0);
        }
      } else if (o.kit === 'camera') {
        // a body and a very fast lens on a tripod, pointed up at the hole
        for (let k = 0; k < 3; k++) {
          const a = (k / 3) * Math.PI * 2;
          K.cyl(0.55 + Math.cos(a) * 0.24, 0.60, 0.34 + Math.sin(a) * 0.24, 0.022, 1.24,
                PALETTE.cavRockDk, Math.sin(a) * 0.32, 0, -Math.cos(a) * 0.32, 4);
        }
        K.box(0.55, 1.30, 0.34, 0.24, 0.17, 0.16, PALETTE.cavRockDk, -0.55, 0, 0);
        K.cyl(0.55, 1.42, 0.42, 0.075, 0.26, PALETTE.cavRockDk, 0.90, 0, 0, 8);
      } else if (o.kit === 'pot') {
        // a billy in one hand and a ladle in the other
        K.cyl(0.34, 0.86, 0.16, 0.15, 0.20, PALETTE.cavRockDk, 0, 0, 0, 8);
        K.box(-0.34, 0.90, 0.18, 0.035, 0.40, 0.035, PALETTE.cavRope, 0.30, 0, 0.2);
        K.sph(-0.36, 0.72, 0.24, 0.08, 0.05, 0.08, PALETTE.cavRockDk, 6);
      }
      const km = new THREE.Mesh(K.build(), cavVC());
      km.castShadow = true;
      rec.group.add(km);
    }
    return rec;
  };
  // =========================================================================
  // ...AND THEY KNOW WHAT YOU HAVE DONE.
  //
  // Seven people, ninety-odd sentences between them, and for the chapter's
  // whole life every one of those sentences was true on the first frame and
  // true on the last. The man at the entrance says "shout if you get lost, it
  // is not a joke, it is the method" whether you have never made a noise in
  // your life or have just put ninety swiftlets off a wall with it. The
  // surveyor at the far end says "do not take the pearls, everybody takes the
  // pearls" — and then you take one, in front of him, and he says it again.
  //
  // npc.js has had the whole apparatus since v20 and this chapter used none of
  // it: a line may be `{ t, after: 'task-id' }` or `{ t, before: ... }` or
  // `{ t, when: fn }`; a person may carry `onTask` (what they say about a
  // specific thing you just did in front of them) and `praise` (their general
  // opinion); and the four reaction pools — startled, thief, rush, splash —
  // fall back on a deliberately chapter-neutral default that includes "Do you
  // mind?" and "Somebody is in a hurry", which are lines for a market square
  // and not for six people in the dark two kilometres inside a mountain.
  //
  // THE RULE FOR ALL OF IT: a caver is not a shopkeeper. Nobody down here is
  // offended by anything, because being startled underground is a thing that
  // happens forty times a day and everyone present has already agreed that
  // the capybara is the least strange thing about the situation.
  // =========================================================================
  const CAVE_STARTLED = ['Rock. That is just rock.', 'Everything does that in here.',
                         'Sound like that, you count to two and then you worry.',
                         'Fine. It is fine. It is all fine.',
                         'That was you, was it. Good.', 'Ah — that is a big one.'];
  const CAVE_SPLASH   = ['That is going to Laos.', 'Gone. That is the sump, that is.',
                         'It will come out somewhere. They usually do.',
                         'Eighty metres down and it is still going.',
                         'Do not go in after it.'];
  const CAVE_THIEF    = ['Take it. Nothing in here is anybody’s.',
                         'That has been growing since before the Romans, but go on.',
                         'Oh, we are doing that, are we.',
                         'Put it back. — you are not going to put it back.',
                         'Every single person. Every one.'];
  const CAVE_RUSH     = ['Walk! It is all holes!', 'Nobody runs in here. Nobody.',
                         'That is how people end up in the river.',
                         'Where. Where is it going.',
                         'Slow. Slow is fast in here.'];

  // 1 & 2 — the camp, under the hole
  const cavLocCamp = put(cx + 3.4, cz + 4.0, {
    face: 2.4, kit: 'survey',
    figure: { shirt: PALETTE.cavTentB, hat: PALETTE.cavTent, legs: PALETTE.cavRockDk },
    lines: ['Second camp. We are two days in and one day out.',
            'You do not get in here without a permit. I am choosing not to ask.',
            'That hole is a hundred and forty metres across. Look up.',
            'Everything you can see grew because the roof fell in. Everything.',
            'Nobody knew this was here until 2009. A man went in for the shade.',
            'The far end has weather. Actual weather. There is a cloud in there.',
            // ...and what he says depends on how far you have got, which is the
            // whole point of a man with a survey book: he is keeping score.
            { t: 'You came down the passage in the dark. On your own. Right.',
              after: 'first-echo' },
            { t: 'Nobody has been over that wall in four days. Well. Three now.',
              after: 'great-wall' },
            { t: 'Two hundred and twenty metres of passage past that wall. It goes on.',
              before: 'great-wall' },
            { t: 'You have been in the river. I can hear you dripping.',
              after: 'cave-river' },
            { t: 'When you get out the other end — and you will — tell them it is bigger.',
              after: 'the-doline' }],
    wheek: ['Hear that? Count it. Two seconds is a hundred metres of room.',
            'That is the loudest thing in this cave and it is a rodent.',
            'Nothing came back. You are standing under the hole — it went out.'],
    onTask: {
      'the-doline': ['There. That is the face everybody makes.',
                     'Everyone stops there. Everyone. Nobody has ever not.'],
      'great-wall': ['Over the Wall. Under two minutes, was it? Do not tell the porters.'],
      'hand-of-dog': ['You have been up the Hand. Nothing has been up the Hand.'],
      'phytokarst': ['That is rock. That is rock GROWING. Nobody believes me either.'],
    },
    praise: ['Noted. It all goes in the book.',
             'I am writing that down. I am not sure how.',
             'Right. Yes. That is new.'],
    startled: CAVE_STARTLED, splash: CAVE_SPLASH, thief: CAVE_THIEF, rush: CAVE_RUSH,
  }, true);
  const cavLocMap = put(cx - 1.4, cz - 5.4, {
    face: 1.0, kit: 'pot',
    figure: { shirt: PALETTE.cavJungleLt, legs: PALETTE.cavRockWarm, hat: PALETTE.cavRope },
    // the pot, and a lid going back on it
    beat: { kind: 'work', every: 5.2, dur: 0.85, sfx: 'clink', volume: 0.10, pitch: 0.8 },
    lines: ['Boil it. Everything. Even in here. Especially in here.',
            'Twenty of us carried this camp in. I carried the stove.',
            'Sleep with your boots inside the tent. Crickets.',
            'Dinner is at whatever o’clock it is. There is no o’clock.',
            'Do not eat anything green in here. It has never seen the sun properly.',
            { t: 'You are wet. Sit by the stove. No — sit by the stove.',
              after: 'cave-river' },
            { t: 'There is a wall down there. When you have done it, come back and eat.',
              before: 'great-wall' },
            { t: 'Sit down. You have earned a sit down. That is my professional opinion.',
              after: 'great-wall' }],
    wheek: ['If you are going to do that, do it at the wall. It is worth it.',
            'You will have every swiftlet at the far end awake. Good.'],
    onTask: {
      'cave-river': ['In the river. In THIS river. Get by the stove.'],
      'cave-pearl': ['I did not see that and I am not going to have seen it.'],
      'the-log': ['You RODE it. It goes to the sump, you know. It goes to the sump.'],
    },
    praise: ['Good. Eat something.', 'Lovely. Now eat something.',
             'That is very good and you still have not eaten.'],
    startled: ['That is my pan.', 'It is a cave. Things fall over in it.',
               'Fine. Nothing was in it.', 'Ah well.'],
    splash: CAVE_SPLASH,
    thief: ['That was going to be dinner.', 'Take it. There is more. There is always more.',
            'Oh, help yourself, honestly.'],
    rush: CAVE_RUSH,
  }, true);
  // 3 — the rope man at the entrance, where the daylight stops
  put(12, 33, {
    face: 3.3, near: 10, kit: 'rope',
    figure: { shirt: PALETTE.cavTent, hat: PALETTE.cavRockDk, legs: PALETTE.cavRockDk },
    // coiling it, which is his whole job and he said so
    beat: { kind: 'work', every: 4.5, dur: 0.9, sfx: 'rustle', volume: 0.10, pitch: 1.0 },
    lines: ['Rope is good. Rope is always good. That is my whole job.',
            'From here it is dark for four hundred metres. Genuinely dark.',
            'Eighty metres down and the river is still going. It started somewhere.',
            'Everybody stops here. Everybody. Then they go anyway.',
            // BEFORE you have worked out what the voice is for, this is the
            // instruction. After, it is a compliment — the same man, the same
            // subject, and the difference between them is the whole chapter.
            { t: 'Shout if you get lost. It is not a joke, it is the method.',
              before: 'first-echo' },
            { t: 'Make a noise and wait. That is all it is. That is the whole trick.',
              before: 'first-echo' },
            { t: 'You have got the hang of the shouting, then. That is the hard part done.',
              after: 'first-echo' },
            { t: 'Follow the little blue lights. They are only ever over water.',
              before: 'glow-trail' },
            { t: 'You found the river. Everything in here follows the river.',
              after: 'glow-trail' },
            { t: 'On your way back out, you will not believe how bright this is.',
              after: 'the-doline' }],
    wheek: ['THAT is the idea. Do it every ten steps and you will not fall in anything.',
            'Count the gap. That is how far away the next thing you can hit is.'],
    onTask: {
      'first-echo': ['There. Now you can see. That is the only lesson I have got.',
                     'Two seconds is a hundred metres. Now you have an instrument.'],
      'glow-trail': ['Told you. Blue lights, water, every time.'],
    },
    praise: ['That is one way of doing it.', 'Rope would have been easier.',
             'You are not going to use the rope at all, are you.'],
    startled: CAVE_STARTLED, splash: CAVE_SPLASH, thief: CAVE_THIEF,
    rush: ['You have got no rope on!',
           'I cannot belay something moving at that speed!',
           'That is a forty metre drop and you cannot see it.'],
  }, false);
  // 4 — the porter at the boulder choke, who is not carrying anything at the
  //     moment and would like that noted
  put(24, -70, {
    face: 0.8, near: 9, kit: 'load',
    figure: { shirt: PALETTE.cavJungle, legs: PALETTE.cavRockWarm },
    lines: ['Forty kilos over that. Twice. Today.',
            'It is warmer in here than outside. Everybody is surprised by that.',
            'The ones with the cameras go first. We go with the cameras.',
            'Up the flowstone at the side. Never up the middle. Ever.',
            { t: 'There is a wall up ahead. You will hear it before you see it.',
              before: 'great-wall' },
            { t: 'Seventy metres of it. And you went straight up the middle, did you.',
              after: 'great-wall' },
            { t: 'The rock that leans — back that way, on the rim. Shout at it.',
              before: 'phytokarst' }],
    wheek: ['Ha! Wait for it. Wait — there.',
            'Two and a bit. That is a very long way to the far side.'],
    onTask: {
      'great-wall': ['Straight up the middle. I said never up the middle.',
                     'Forty kilos, that wall. You did it with nothing on your back.'],
      'the-log': ['You got ON it? We use those to find out where the water goes.'],
    },
    praise: ['Carry something next time.',
             'Very good. Now do it with a stove on your back.',
             'You make it look easy. It is not easy.'],
    startled: CAVE_STARTLED, splash: CAVE_SPLASH, thief: CAVE_THIEF, rush: CAVE_RUSH,
  }, false);
  // 5 — the one at the far end who has been counting things
  put(-24, -136, {
    face: 1.9, near: 9, kit: 'survey',
    figure: { shirt: PALETTE.cavTentB, hat: PALETTE.cavTent, legs: PALETTE.cavRockDk },
    lines: ['Nine hundred metres of survey and I have three days of it left.',
            'The fish has no eyes and no pigment. It has never needed either.',
            'Keep going that way. There is a slot, and there is daylight in it.',
            'The nests on that wall are worth more per kilo than I am.',
            // The best line in the chapter, and it was said in both directions.
            { t: 'Do not take the pearls. Everybody takes the pearls.',
              before: 'cave-pearl' },
            { t: 'There is a gap in that pool now. I am not going to say anything.',
              after: 'cave-pearl' },
            { t: 'Something lives in that water and it has never seen anything. Ever.',
              before: 'blind-fish' },
            { t: 'You found it, then. Four million years and it still bolts.',
              after: 'blind-fish' },
            { t: 'Ninety of them on that wall. I count them twice and get two numbers.',
              before: 'swiftlets' }],
    wheek: ['The whole roost. Every time. I have stopped flinching.',
            'They answer, you know. Listen — clicks. They are doing what you are doing.'],
    onTask: {
      'cave-pearl': ['Everybody. Takes. The pearls.',
                     'I said. I said it out loud, to your face, with my mouth.'],
      'swiftlets': ['Well, now I have to count them again. Thank you.',
                    'Ninety. It was ninety. Now it is a cloud.'],
      'blind-fish': ['It has no idea what you are. It has no idea what anything is.'],
    },
    praise: ['That is not in the survey.', 'I have no column for that.',
             'Right. Yes. I will put it under “other”.'],
    startled: CAVE_STARTLED, splash: CAVE_SPLASH, thief: CAVE_THIEF, rush: CAVE_RUSH,
  }, true);
  // ---- 6 & 7 — AND TWO MORE, IN THE TWO PLACES THAT HAD NOBODY -----------
  // Five people over a hundred and seventy metres, and the two biggest rooms
  // in the chapter — the doline, which is the marquee, and the slot, which is
  // the way out — had one between them and none at all. A place with a person
  // in it is a place somebody has a reason to be.
  //
  // 6 — the photographer, standing in the column of light, waiting for the
  //     one hour a day it does what she came for
  put(cavDOLINE.x - 7, cavDOLINE.z + 8, {
    face: 5.6, near: 10, kit: 'camera',
    figure: { shirt: PALETTE.cavTent, legs: PALETTE.cavRockDk, hat: PALETTE.cavTentB },
    lines: ['Thirty seconds at f/8 and it still comes out looking like a lie.',
            'It moves. Eleven in the morning it is on the far bank, and then it goes.',
            'Do not walk through it. — no, do. Walk through it. Slowly.',
            'You cannot photograph a size. That is the entire problem with this place.',
            'Watch the leaves. They come all the way down. It takes about a minute.',
            'The birds come in over the rim and drop the whole two hundred metres.',
            { t: 'Stand in it. Go on. I need something in the frame for scale.',
              before: 'the-doline' },
            { t: 'You are in every one of the last forty of those. You are the scale.',
              after: 'the-doline' }],
    wheek: ['Perfect. Hold that. Hold — no, you moved. It is fine.',
            'Nothing came back at all, did it. It all went straight up the hole.'],
    onTask: {
      'the-doline': ['Got it. I have got it. Do not move — no, that is it, that is the one.',
                     'Eleven days I have been waiting for something to stand in that.'],
      'phytokarst': ['The green rock! Yes! Nobody ever photographs the green rock.'],
    },
    praise: ['Hold still — no. Gone.', 'That would have been a lovely picture.',
             'I got about a third of that.'],
    startled: ['Oh — thirty second exposure. That is thirty seconds of you.',
               'It is fine. It is all digital. It is fine.',
               'Well, that is that one ruined.'],
    splash: CAVE_SPLASH, thief: CAVE_THIEF,
    rush: ['Do not — the tripod —', 'You are a blur. You are a lovely brown blur.',
           'Slower! Slower is a photograph!'],
  }, false);
  // 7 — the one at the slot, who has been out and come back in, and is the
  //     only person in the chapter who knows what is on the other side
  put(-11, cavEXIT_Z + 14, {
    face: 0.3, near: 11, kit: 'rope',
    figure: { shirt: PALETTE.cavJungleLt, legs: PALETTE.cavRockWarm, hat: PALETTE.cavRope },
    lines: ['That is the way out. Ninety metres of ladder and then a hillside.',
            'You feel the draught? That is the mountain breathing out. All day.',
            'Everything green in here is pointed at that hole. Look at it. Everything.',
            'Six days in the dark and then a gap you could drive a bus through.',
            'Two more days and I go out through there and I do not come back in.',
            { t: 'You have not been under the roof-hole yet. Go back. Genuinely, go back.',
              before: 'the-doline' },
            { t: 'You stood under the hole. Then you have seen it. That is the cave.',
              after: 'the-doline' }],
    wheek: ['Straight out. No echo at all that way. That is how you know it is open.',
            'Save it. There is nothing left in here to shout at.'],
    praise: ['You are nearly out, you know.', 'Take it with you. Whatever it was.',
             'Do that outside. It is better outside.'],
    startled: CAVE_STARTLED, splash: CAVE_SPLASH, thief: CAVE_THIEF, rush: CAVE_RUSH,
  }, true);

  // ---- AND THE TWO IN THE CAMP TALK TO EACH OTHER --------------------
  // NO PAIR-CHAT ANYWHERE IN CHAPTER 16: `addExchange` occurs zero times in
  // this file, against seven in Marrakech and five each in Iceland, Rio,
  // Kyoto, Kowloon, Cappadocia and Cali. Seven people down here and not one
  // of them had ever spoken to another. These two share a tent under the
  // hole and have been underground for two days.
  if (typeof game.addExchange === 'function' && cavLocCamp && cavLocMap) {
    game.addExchange({ biome: 'cave', a: cavLocMap, b: cavLocCamp, gap: 32, lines: [
      ['Is that on the survey?', 'Nothing is on the survey. That is why we are here.'],
      ['What is the ceiling here?', 'Two hundred. Give or take a hundred.'],
      ['Something went past the tent.', 'Something goes past the tent every night.'],
      ['Battery?', 'Forty per cent. Do not ask again until tomorrow.'],
      ['I can hear the river from here.', 'You can hear the river from everywhere.'],
      ['Day two.', 'Day two of eight. Do not do that.'],
    ] });
  }
}

function cavBuildRiver(root) {
  const X0 = cavRIVER_X - cavRIVER_W - 3, X1 = cavRIVER_X + cavRIVER_W + 3;
  const Z0 = -96, Z1 = 44, EL = 3;
  const nx = Math.round((X1 - X0) / EL), nz = Math.round((Z1 - Z0) / EL);
  const g = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0, nx, nz);
  g.rotateX(-Math.PI / 2);
  g.translate((X0 + X1) * 0.5, 0, (Z0 + Z1) * 0.5);
  const p = g.attributes.position.array;
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 4);
  const wl = new THREE.Color(PALETTE.cavWaterLt);
  const wd = new THREE.Color(PALETTE.cavWater);
  for (let v = 0; v < n; v++) {
    const i = v * 3, o = v * 4;
    const x = p[i], z = p[i + 2];
    const h = cavTerrain(x, z);
    const d = cavWATER - h;
    p[i + 1] = cavWATER;
    cavCol.copy(wl).lerp(wd, clamp(d / 2.2, 0, 1));
    col[o] = cavCol.r; col[o + 1] = cavCol.g; col[o + 2] = cavCol.b;
    col[o + 3] = clamp(d / 0.25, 0, 1) * 0.82;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 4));
  g.computeVertexNormals();
  cavRiverMesh = new THREE.Mesh(g, grain(mat(0xffffff, {
    vertexColors: true, transparent: true, opacity: 1, depthWrite: false,
  }), { scale: 0.5, amount: 0.09, warp: 0,
        sparkle: 0.6, sparkleScale: 1.5, sparkleSpeed: 0.7,
        sparkleCut: 0.66, sparkleBand: 0.09, sparkleColor: PALETTE.cavEcho }));
  cavRiverMesh.frustumCulled = false;
  cavRiverMesh.renderOrder = 3;
  root.add(cavRiverMesh);
}

/** Something came down the river. It is going where you are going. */
function cavBuildLog(game, root) {
  cavLog = new THREE.Group();
  const M = cavMerger();
  M.cyl(0, 0, 0, 0.62, 7.5, PALETTE.cavRockWarm, 0, 0, Math.PI / 2, 8);
  M.cyl(0, 0, 0, 0.42, 8.4, PALETTE.cavMud, 0, 0, Math.PI / 2, 6);
  for (let i = 0; i < 5; i++) {
    M.cone(rand(-3, 3), rand(0.3, 0.6), rand(-0.4, 0.4), rand(0.16, 0.3), rand(0.8, 1.8),
           PALETTE.cavRockWarm, rand(-0.5, 0.5), rand(0, 3), rand(-0.5, 0.5), 4);
  }
  // and it has picked up a passenger already: a film of the green stuff
  for (let i = 0; i < 5; i++) {
    M.sph(rand(-3.2, 3.2), 0.55, rand(-0.35, 0.35), rand(0.2, 0.45), 0.12, rand(0.2, 0.4),
          PALETTE.cavPhyto, 6);
  }
  const mesh = new THREE.Mesh(M.build(), cavVC());
  mesh.castShadow = true;
  cavLog.add(mesh);
  root.add(cavLog);

  cavLogBody = new CANNON.Body({
    mass: 0, type: CANNON.Body.KINEMATIC,
    material: (game.mats && game.mats.ground) || undefined,
  });
  cavLogBody.addShape(new CANNON.Box(new CANNON.Vec3(4.0, 0.4, 0.8)));
  cavLogBody.allowSleep = false;
  cavLogBody.position.set(cavRIVER_X, cavWATER + 0.3, 40);
  cavSyncBody(cavLogBody);
  game.world.addBody(cavLogBody);
  cavLogTarget.x = cavRIVER_X; cavLogTarget.y = cavWATER + 0.3; cavLogTarget.z = 40;
  cavLogPrev.x = cavLogTarget.x; cavLogPrev.y = cavLogTarget.y; cavLogPrev.z = cavLogTarget.z;
}

function cavBuildFish(root) {
  // NO EYES, AND NO PIGMENT EITHER. It is the colour of a fingernail and it
  // has been down here long enough not to need either.
  const M = cavMerger();
  M.sph(0, 0, 0, 0.16, 0.15, 0.55, PALETTE.cavFish, 6);
  M.cone(0, 0, -0.7, 0.15, 0.5, PALETTE.cavFish, Math.PI / 2, 0, 0, 4);
  M.box(0, 0.18, 0, 0.04, 0.14, 0.5, PALETTE.cavFish);
  M.sph(0, 0.02, 0.5, 0.11, 0.1, 0.12, PALETTE.cavFish, 6);
  cavFish = new THREE.Mesh(M.build(), cavGlow(PALETTE.cavFish, 0.35));
  cavFish.position.set(cavRIVER_X, cavWATER - 1.4, -60);
  root.add(cavFish);
}

/**
 * THE ROOST, AND FOR THE CHAPTER'S WHOLE LIFE IT WAS A PLACE NAME.
 *
 * `cavROOST` is a landmark, a hint-arrow target and a task; ninety swiftlets
 * circled over it; and there was NOTHING THERE. Photographed from the roost
 * the frame is a wall, a floor and some glow-worms — a colony with no colony
 * in it, in a chapter where the roost is one of nine things on the list.
 *
 * What is actually there is the reason anybody in Quang Binh has ever climbed
 * one of these walls: Aerodramus glues a cup of its own saliva to the rock,
 * eight hundred of them on one overhang, in tiers, and directly underneath is
 * a cone of guano two metres deep with a whole insect ecology living in it.
 * Three merged pieces, no animation, and it is the difference between a bird
 * that is flying about and a bird that LIVES somewhere.
 */
function cavBuildRoost(game, root) {
  const M = cavMerger();
  const R = cavROOST;
  // the west wall's drawn face at this z — the same two-term wobble the wall
  // and its collider are both written from, so the cups are ON the rock
  const wobAt = function (z) {
    return 7 * Math.sin(z * 0.031 + 1.9) + 3.4 * Math.sin(z * 0.097 - 1);
  };
  const faceAt = function (z) { return -(50 + wobAt(z)) - 11 + 12; };

  // ---- the cups. Tiers, because a colony fills an overhang from the top ---
  for (let i = 0; i < 210; i++) {
    const z = R.z + rand(-15, 15);
    const fx = faceAt(z);
    const roof = Math.min(cavRoofH(fx, z), 74);
    const y = roof - Math.pow(Math.random(), 0.7) * 17 - 1.2;
    if (y < cavTerrain(fx, z) + 4) continue;
    const s = rand(0.9, 1.35);
    // a cup is a half-sphere with a lip, stuck edge-on to a vertical face
    M.sph(fx + 0.26, y, z, 0.15 * s, 0.13 * s, 0.17 * s, PALETTE.cavPearl, 6);
    M.sph(fx + 0.34, y + 0.07 * s, z, 0.11 * s, 0.05 * s, 0.13 * s, PALETTE.cavCalciteLt, 6);
    // and the streak under it, which is what actually makes a nesting wall
    // read as a nesting wall from thirty metres in the dark.
    // WIDE AND DULL. At 22 cm across, four metres long and painted in
    // `cavCalcite` — the second brightest colour the chapter owns — seventy of
    // these photographed as a rack of white sticks with a ball on top of each
    // one, which is a lollipop and not a stain. What runs down a nesting wall
    // is old guano: it is the colour of wet sand, it spreads as it goes, and
    // it is nothing like as long as it is in your imagination.
    if (i % 3 === 0) {
      const sl = rand(0.7, 2.6);
      M.box(fx + 0.14, y - sl * 0.5 - 0.1, z, 0.05, sl, rand(0.28, 0.55),
            i % 6 ? PALETTE.cavSand : PALETTE.cavMud, 0, 0, 0);
    }
  }
  // ---- the guano cone underneath, and it is a real landform ---------------
  {
    const gz = R.z, gx = faceAt(gz) + 4.5;
    const gy = cavTerrain(gx, gz);
    for (let k = 0; k < 4; k++) {
      M.cone(gx + rand(-2, 2), gy + 0.5 + k * 0.55, gz + rand(-4, 4),
             7.5 - k * 1.5, 2.2, k % 2 ? PALETTE.cavMud : PALETTE.cavSand, 0, k, 0, 8);
    }
    cavStaticBox(game, gx, gy + 0.9, gz, 12, 1.8, 13);
    // ...and the crickets and beetles that live in it are the reason the
    // colony is here at all. Twelve small pale specks, merged, no animation.
    for (let i = 0; i < 22; i++) {
      M.sph(gx + rand(-6, 6), gy + rand(1.0, 2.4), gz + rand(-6, 6),
            0.09, 0.07, 0.13, PALETTE.cavCricket, 6);
    }
  }
  // ---- the ladder somebody left, because people climb these --------------
  // A pole ladder of two canes and fourteen rungs, lashed and leaning on the
  // face. Nobody in the game can climb it; it is a sentence, and the sentence
  // is "the nests are worth more than you are".
  {
    const lz = R.z + 7, lx = faceAt(lz) + 1.4;
    const ly = cavTerrain(lx, lz);
    for (let s = -1; s <= 1; s += 2) {
      M.cyl(lx + 1.1, ly + 9.0, lz + s * 0.55, 0.07, 19, PALETTE.cavRope, 0, 0, -0.115, 4);
    }
    for (let k = 0; k < 14; k++) {
      M.box(lx + 1.1 - (k - 7) * 0.155, ly + 1.2 + k * 1.28, lz, 0.05, 0.05, 1.2,
            PALETTE.cavRope, 0, 0, 0);
    }
  }
  const mesh = new THREE.Mesh(M.build(), cavVC());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);
  cavRoostFace = faceAt(R.z);
}

function cavBuildSwifts(root) {
  const M = cavMerger();
  M.sph(0, 0, 0, 0.09, 0.08, 0.22, PALETTE.cavSwiftlet, 6);
  M.box(-0.22, 0.02, 0, 0.42, 0.03, 0.13, PALETTE.cavSwiftlet, 0, 0.3, 0);
  M.box(0.22, 0.02, 0, 0.42, 0.03, 0.13, PALETTE.cavSwiftlet, 0, -0.3, 0);
  cavSwifts = new THREE.InstancedMesh(M.build(), cavVC(), cavSWIFT_N);
  cavSwifts.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cavSwifts.frustumCulled = false;
  cavSwiftX = new Float32Array(cavSWIFT_N);
  cavSwiftY = new Float32Array(cavSWIFT_N);
  cavSwiftZ = new Float32Array(cavSWIFT_N);
  cavSwiftHX = new Float32Array(cavSWIFT_N);
  cavSwiftHY = new Float32Array(cavSWIFT_N);
  cavSwiftHZ = new Float32Array(cavSWIFT_N);
  cavSwiftPh = new Float32Array(cavSWIFT_N);
  // THEY REST ON THE WALL THEY NEST ON. Scattered over a 24 m box in mid-air
  // at the roof, a settled colony is ninety birds hovering in a room; a
  // settled colony is ninety birds CLINGING TO A FACE, which is also where
  // cavBuildRoost has just put two hundred nest cups.
  for (let i = 0; i < cavSWIFT_N; i++) {
    const z = cavROOST.z + rand(-14, 14);
    const face = -(50 + 7 * Math.sin(z * 0.031 + 1.9) + 3.4 * Math.sin(z * 0.097 - 1)) + 1;
    const hx = face + rand(0.5, 2.4);
    const hy = Math.min(cavRoofH(face, z), 74) - Math.pow(Math.random(), 0.7) * 17 - 1.2;
    cavSwiftHX[i] = hx; cavSwiftHY[i] = hy; cavSwiftHZ[i] = z;
    cavSwiftX[i] = hx; cavSwiftY[i] = hy; cavSwiftZ[i] = z;
    cavSwiftPh[i] = rand(0, 6.28);
  }
  root.add(cavSwifts);
}

/** Cave pearls: rimstone pools with something in them worth having. */
/**
 * CAVE PEARLS, AND THE WHOLE GROUP WAS PAINTED ONE COLOUR.
 *
 * `cavGlow()` returns `mat(color, {emissive})` and does NOT set
 * `vertexColors` — so the merged geometry this function has always built,
 * with its rims in `cavCalcite`, its water in `cavWaterLt` and its pearls in
 * `cavPearl`, was drawn as a single flat sheet of `cavPearl` with an emissive
 * on it. Photographed from four metres, the one treasure in chapter 16 is a
 * heap of enormous cream dinner plates with faint bumps on them: no rim, no
 * water, no pearls, no read at all. It is the same class of mistake as the
 * merged mesh in a chapter that forgets `vertexColors: true`, and the fix is
 * two meshes — the POOLS carry vertex colour, and only the PEARLS glow.
 *
 * And they are the wrong size. A gour pool in a passage floor is a puddle you
 * could put a hat in and the pearls in it are grapes; three-metre basins with
 * three-centimetre marbles in them read as crockery.
 */
function cavBuildPearls(game, root) {
  const M = cavMerger();          // the pools: rock, vertex-coloured
  const G = cavMerger();          // the pearls: emissive
  const P = cavPEARLS;
  for (let i = 0; i < 15; i++) {
    const a = rand(0, 6.283);
    const x = P.x + Math.cos(a) * rand(1.2, 9), z = P.z + Math.sin(a) * rand(1.2, 9);
    const h = cavTerrain(x, z);
    const r = rand(0.85, 2.1);
    // the rim is FLOWSTONE, honey-coloured, because that is what it grew out
    // of; the pale thing in a rimstone pool is the water, and only the water
    M.cyl(x, h + 0.24, z, r, 0.48, i % 2 ? PALETTE.cavRockWarm : PALETTE.cavFlow, 0, a, 0, 8);
    M.cyl(x, h + 0.44, z, r - 0.10, 0.12, PALETTE.cavCalcite, 0, a, 0, 8);
    // ...and the water in it is DARK. Twenty centimetres of still water over
    // wet limestone in a room with an ambient of 0.24 is nearly black, and it
    // is the black that makes the pearls in it read at all.
    M.cyl(x, h + 0.455, z, r - 0.22, 0.06, PALETTE.cavWater, 0, a, 0, 8);
    cavStaticBox(game, x, h + 0.22, z, r * 1.6, 0.44, r * 1.6);
    const n = 3 + randInt(0, 5);
    for (let k = 0; k < n; k++) {
      const b = rand(0, 6.28), rr = rand(0, Math.max(0.05, r - 0.42));
      const ps = rand(0.13, 0.24);
      G.sph(x + Math.cos(b) * rr, h + 0.47 + ps * 0.5, z + Math.sin(b) * rr,
            ps, ps * 0.86, ps, PALETTE.cavPearl, 6);
    }
  }
  // ...and the ones that have washed out of the pools and are lying about,
  // which is how anybody ever found out these existed
  for (let i = 0; i < 22; i++) {
    const a = rand(0, 6.283), rr = rand(2, 13);
    const x = P.x + Math.cos(a) * rr, z = P.z + Math.sin(a) * rr;
    const ps = rand(0.09, 0.17);
    G.sph(x, cavTerrain(x, z) + ps * 0.7, z, ps, ps * 0.8, ps, PALETTE.cavPearl, 6);
  }
  const mesh = new THREE.Mesh(M.build(), cavVC());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);
  const gm = new THREE.Mesh(G.build(), cavGlow(PALETTE.cavPearl, 0.30));
  gm.castShadow = true;
  root.add(gm);
  // THE ONE YOU TAKE, on its own node so it can stop existing. A cave pearl is
  // a calcite marble the size of a grape that has been rolled smooth by a drip
  // for a few thousand years, and there is only ever one worth the trouble.
  cavPearlOne = new THREE.Mesh(cavG.sph8.clone(), cavGlow(PALETTE.cavPearl, 0.9));
  cavPearlOne.scale.set(0.42, 0.38, 0.42);
  cavPearlOne.position.set(P.x, cavTerrain(P.x, P.z) + 0.78, P.z);
  cavPearlOne.castShadow = true;
  root.add(cavPearlOne);
}

/**
 * THE ECHO. A point light and a ring on the floor, and that is the whole of it.
 *
 * The light has to be REAL — a painted flash lights nothing, and the entire
 * point of the mechanic is that the pulse tells you where the walls are. So
 * there is one PointLight, its range grows outward at about the speed of
 * sound divided by eight, and it dies. The ring is what makes it read as a
 * SOUND rather than as a torch being switched on: it travels, it flattens
 * against the floor, and it goes over the top of everything.
 */
function cavBuildEcho(root) {
  cavEchoLight = new THREE.PointLight(PALETTE.cavEcho, 0, cavECHO_REACH, 1.35);
  cavEchoLight.position.set(0, 0, 0);
  root.add(cavEchoLight);

  const g = new THREE.RingGeometry(0.86, 1.0, 44);
  g.rotateX(-Math.PI / 2);
  cavEchoRingMat = mat(PALETTE.cavEcho, {
    emissive: PALETTE.cavEcho, emissiveIntensity: 2.2,
    transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
  }).clone();
  cavEchoRing = new THREE.Mesh(g, cavEchoRingMat);
  cavEchoRing.renderOrder = 7;
  cavEchoRing.frustumCulled = false;
  cavEchoRing.visible = false;
  root.add(cavEchoRing);
}

// =================================================================== UPDATE ==
function cavTask(game, id) { game.completeTask(id); }

/** Fire the echo. Bound to `capy:wheek`, which is the point. */
function cavWheek(game) {
  if (!game.biome.isActive('cave')) return;
  if (cavEchoCool > 0) return;
  const capy = game.capy;
  if (!capy || !capy.body) return;
  cavEchoT = 0;
  cavEchoCool = cavECHO_COOL;
  cavEchoX = capy.body.position.x;
  cavEchoY = capy.body.position.y;
  cavEchoZ = capy.body.position.z;
  if (cavEchoRing) cavEchoRing.visible = true;
  if (!cavToldEcho && cavDaylightAt(cavEchoX, cavEchoZ) < 0.25) {
    cavToldEcho = true;
    cavTask(game, 'first-echo');
    game.toast('it comes back. that is how you see in here.');
  }
  // the swiftlets steer on sound too, which is the joke and is also true
  if (cavInZone('roost', cavEchoX, cavEchoZ)) { cavSwiftUp = 1; cavSwiftMine = true; }

  // ---- AND THE LIGHTS GO OUT ---------------------------------------------
  // Arachnocampa glow to lure insects and a disturbed larva drops the lure in
  // about a second; it takes half a minute to come back. So the one navigation
  // aid in the chapter is switched OFF by the one verb the chapter is about —
  // shout to see where the walls are, and the map goes dark for twenty
  // seconds. It is the best consequence available here and it is free, because
  // it is simply what the animal does.
  cavWormDim = 1;
  if (!cavToldDim && cavDaylightAt(cavEchoX, cavEchoZ) < 0.2 && cavInZone('river', cavEchoX, cavEchoZ)) {
    cavToldDim = true;
    game.toast('they put themselves out. give them a minute.');
  }
  // ---- the crickets go somewhere else ------------------------------------
  cavCrickScat = 1;
  // ---- and the dust in the shaft is blown about, which is what a pressure
  //      wave does to dust ---------------------------------------------------
  if (cavInZone('doline', cavEchoX, cavEchoZ)) cavMoteStir = 1;
  // ---- AND THE GARDEN LETS GO -------------------------------------------
  // See cavBuildPhyto. The one line on this card that had no object behind it
  // now has an object AND a verb: a shout over a shelf of damp algae puts a
  // cloud of spores in the air, and because the echo is a real point light the
  // cloud is lit by the noise that made it. The blades themselves do not turn
  // — rock does not — and the joke is that they do not have to: every one of
  // them is already pointing at the light, and for two seconds you are it.
  if (cavInZone('phyto', cavEchoX, cavEchoZ)) {
    cavPhyShake = 1;
    cavPuffSpores(cavEchoX, cavEchoZ);
    cavSfx.volume = 0.16; cavSfx.pitch = 2.9;
    game.sfx('rustle', cavSfx);
    if (!cavPhyDone) {
      cavPhyDone = true;
      cavTask(game, 'phytokarst');
      game.toast('every blade of it is pointed at a hole you cannot see yet.');
    }
  }
  // ---- and the fish, which is blind and is therefore ALL lateral line -----
  if (cavFish && cavInZone('river', cavEchoX, cavEchoZ) &&
      Math.abs(cavEchoZ - cavFish.position.z) < 40) cavFishBolt = 1;
  // ---- and the room answers ----------------------------------------------
  // TWO RETURNS AND THE DELAY IS THE ROOM. A wall ninety metres away is a
  // return at 0.52 s; the roof at sixty is at 0.35; and past the Great Wall,
  // where the passage narrows to thirty metres, it comes back almost at once.
  // So the echo is not a flourish, it is a MEASUREMENT — the local's line
  // "count it, two seconds is a hundred metres of room" is a thing the player
  // can actually do, and it is the only instrument in the chapter.
  {
    const roomW = 50 + 7 * Math.sin(cavEchoZ * 0.031) + 3.4 * Math.sin(cavEchoZ * 0.097);
    const side = (roomW - Math.abs(cavEchoX)) + roomW;      // there and back
    const up = (cavRoofH(cavEchoX, cavEchoZ) - cavEchoY) * 2;
    const SPD = 343 * 0.55;   // slowed, because a cave is not a physics lesson
    // ---- A ROOM WITH NO CEILING DOES NOT ANSWER --------------------------
    // The echo is a MEASUREMENT — the local's "count it, two seconds is a
    // hundred metres of room" is a thing the player can actually do — and the
    // two places in the chapter with a hole in them were still answering as
    // though they were sealed. Standing in the doline, under a hundred and
    // forty metres of open sky, a shout goes STRAIGHT UP AND DOES NOT COME
    // BACK; standing in the slot it goes out sideways into a valley. That is
    // the loudest possible way of saying "you are nearly out", it is free, and
    // both people standing in those two rooms now have a line about it.
    const openUp = cavHole(cavEchoX, cavEchoZ);
    const openOut = cavSmooth((cavEXIT_Z + 30 - cavEchoZ) / 26);
    const open = clamp(Math.max(openUp, openOut), 0, 1);
    cavEchoBack[0] = open > 0.9 ? -1 : clamp(side / SPD, 0.16, 2.4);
    cavEchoBackV[0] = 0.16 * (1 - open);
    cavEchoBack[1] = openUp > 0.35 ? -1 : clamp(up / SPD, 0.10, 1.6);
    cavEchoBackV[1] = 0.10 * (1 - openUp);
    // and the long one, off the far end of the passage, which only exists
    // where there IS a far end
    const along = Math.abs(cavEchoZ - cavWALL.z) * 2;
    cavEchoBack[2] = (along / SPD < 3.2 && open < 0.6) ? clamp(along / SPD, 0.4, 3.2) : -1;
    cavEchoBackV[2] = 0.055 * (1 - open);
    if (!cavToldOpen && open > 0.85 && cavEchoT >= 0) {
      cavToldOpen = true;
      game.toast('nothing came back. there is a hole over you.');
    }
  }
}

/** The returns off the walls, on the frame clock. See cavWheek. */
function cavUpdateEchoBack(game, dt) {
  for (let i = 0; i < 3; i++) {
    if (cavEchoBack[i] < 0) continue;
    cavEchoBack[i] -= dt;
    if (cavEchoBack[i] > 0) continue;
    cavEchoBack[i] = -1;
    // a return that has been attenuated to nothing by an open roof is not a
    // quiet return, it is silence — and `volume: 0` through the dispatcher is
    // still a voice allocated and an envelope scheduled
    if (cavEchoBackV[i] < 0.012) continue;
    cavSfx.volume = cavEchoBackV[i];
    cavSfx.pitch = 0.86 - i * 0.07 + rand(-0.03, 0.03);
    game.sfx('wheek', cavSfx);
  }
}

/**
 * THE TWO THINGS IN HERE THAT MAKE A NOISE ALL DAY, AND NEITHER WAS AUDIBLE.
 *
 * systems.js gives chapter 16 four ambient sounds — a drip, a splash, a click
 * and a distant thud — on a six-to-seventeen-second clock, everywhere in the
 * chapter, at the same volume. That is the right SHAPE for a cave ("it is not
 * silent, it is EMPTY, and an empty place lets you hear how big it is") and it
 * is completely position-blind, so a hundred and forty metres of river and a
 * two-hundred-metre waterfall were both silent while you stood in them.
 *
 * Both are POSITIONAL, which is the rule the Sahara's medina and the Antarctic
 * pack are both written to: a place should sound like where you are standing.
 * The river is a wide, low hiss that comes up as you approach the water and is
 * loudest in it; the fall under the doline is the only loud thing in the
 * chapter, and it is the reason you can find the doline with your eyes shut.
 */
function cavUpdateSound(game, dt) {
  const capy = game.capy;
  if (!capy || !capy.position) return;
  const p = capy.position;

  // ---- the river ---------------------------------------------------------
  cavRiverT -= dt;
  if (cavRiverT <= 0) {
    const t = Math.abs(p.x - cavRIVER_X) / cavRIVER_W;
    const inRun = p.z < 46 && p.z > -98;
    const k = inRun ? clamp(1.45 - t, 0, 1) : 0;
    cavRiverT = lerp(3.4, 0.85, k);
    if (k > 0.06) {
      cavSfx.volume = clamp(0.035 + k * 0.085, 0.02, 0.13);
      cavSfx.pitch = rand(0.44, 0.78);
      game.sfx('rustle', cavSfx);
    }
  }
  // ---- and the fall under the hole ---------------------------------------
  // Two hundred metres of water arriving on rock is not a splash, it is a
  // continuous roar with the odd slab of it landing — so it is a `rustle` bed
  // with a `thud` through it, and it is loud enough at forty metres to be the
  // thing that tells you the doline is over there.
  cavFallT -= dt;
  if (cavFallT <= 0) {
    const fx = cavDOLINE.x - 16, fz = cavDOLINE.z + 4;
    const d = Math.sqrt((p.x - fx) * (p.x - fx) + (p.z - fz) * (p.z - fz));
    const k = clamp(1 - (d - 8) / 62, 0, 1);
    cavFallT = lerp(2.6, 0.55, k);
    if (k > 0.05) {
      cavSfx.volume = clamp(0.04 + k * k * 0.20, 0.02, 0.24);
      cavSfx.pitch = rand(0.26, 0.48);
      game.sfx('rustle', cavSfx);
      if (Math.random() < k * 0.22) {
        cavSfx.volume = clamp(k * 0.16, 0.02, 0.16);
        cavSfx.pitch = rand(0.22, 0.34);
        game.sfx('thud', cavSfx);
      }
    }
  }
}

function cavUpdateEcho(game, dt) {
  if (cavEchoCool > 0) cavEchoCool -= dt;
  if (cavEchoT < 0) {
    if (cavEchoLight) cavEchoLight.intensity = 0;
    if (cavEchoRing && cavEchoRing.visible) cavEchoRing.visible = false;
    return;
  }
  cavEchoT += dt;
  const t = cavEchoT / cavECHO_LIFE;
  if (t >= 1) {
    cavEchoT = -1;
    if (cavEchoLight) cavEchoLight.intensity = 0;
    if (cavEchoRing) cavEchoRing.visible = false;
    return;
  }
  // A HARD ATTACK AND A LONG TAIL. A light that fades UP is a torch; a light
  // that arrives all at once and goes is a noise.
  const env = t < 0.06 ? t / 0.06 : Math.pow(1 - (t - 0.06) / 0.94, 1.7);
  if (cavEchoLight) {
    cavEchoLight.position.set(cavEchoX, cavEchoY + 1.4, cavEchoZ);
    cavEchoLight.intensity = env * 11;
    cavEchoLight.distance = lerp(12, cavECHO_REACH, cavSmooth(t * 1.5));
  }
  if (cavEchoRing) {
    const r = lerp(1.5, cavECHO_REACH * 0.95, cavSmooth(t));
    cavEchoRing.position.set(cavEchoX, cavTerrain(cavEchoX, cavEchoZ) + 0.35, cavEchoZ);
    cavEchoRing.scale.set(r, 1, r);
    cavEchoRingMat.opacity = env * 0.42 * (1 - t * 0.4);
  }
}

function cavUpdateLog(game, dt) {
  if (!cavLogBody) return;
  // It comes down from the entrance to the sump at the wall and then it is
  // "another log", which is what a river does. Forty-six seconds a lap.
  //
  // ...AND IT DOES NOT WRAP WITH SOMEBODY ON IT. The wrap teleports the body a
  // hundred and thirty metres back up the river, and for the whole life of the
  // chapter it did that whether or not the capybara was standing on it: a ride
  // that ends by leaving you alone in the sump while your floor reappears in
  // the entrance. It now GROUNDS at the bottom of the run and stays there
  // until the passenger steps off, which is also the better ride — it ends
  // somewhere, and a ride that ends at a wall is a bug (the same rule the
  // Antarctic floes are written to).
  const held = cavLogCarrying && (cavLogT % 46) / 46 > 0.965;
  if (!held) cavLogT += dt;
  const u = held ? 0.965 : (cavLogT % 46) / 46;
  cavLogPrev.x = cavLogTarget.x; cavLogPrev.y = cavLogTarget.y; cavLogPrev.z = cavLogTarget.z;
  cavLogTarget.z = lerp(38, -92, u);
  cavLogTarget.x = cavRIVER_X + Math.sin(u * 7.1) * 4.5;
  cavLogTarget.y = cavWATER + 0.3;
  const inv = dt > 0.0001 ? 1 / dt : 0;
  // RULE 3: difference against the PREVIOUS TARGET, not against the body's own
  // position — cannon integrates a kinematic body inside world.step, which
  // runs before this, so (target - position) is the distance the LAST velocity
  // already carried it and the sign flips every frame.
  cavLogBody.velocity.set((cavLogTarget.x - cavLogPrev.x) * inv, 0,
                          (cavLogTarget.z - cavLogPrev.z) * inv);
  // the lap wraps: teleport it, and sync all four transforms. Only reachable
  // when nobody is aboard — see the `held` note above.
  if (u < 0.01 && Math.abs(cavLogTarget.z - cavLogPrev.z) > 20) {
    cavLogBody.position.set(cavLogTarget.x, cavLogTarget.y, cavLogTarget.z);
    cavLogBody.velocity.set(0, 0, 0);
    cavSyncBody(cavLogBody);
  }
  if (cavLog) {
    const ip = cavLogBody.interpolatedPosition;
    cavLog.position.set(ip.x, ip.y, ip.z);
    cavLog.rotation.set(0, Math.sin(cavLogT * 0.4) * 0.12, Math.sin(cavLogT * 0.9) * 0.06);
  }
  const capy = game.capy;
  cavLogCarrying = false;
  if (capy && capy.body) {
    const p = capy.body.position;
    const dx = p.x - cavLogBody.position.x, dz = p.z - cavLogBody.position.z;
    const dy = p.y - cavLogBody.position.y;
    if (Math.abs(dx) < 4.2 && Math.abs(dz) < 1.5 && dy > -0.2 && dy < 2.4) cavLogCarrying = true;
  }
  if (cavLogCarrying) {
    cavLogFrame.x = cavLogBody.velocity.x;
    cavLogFrame.z = cavLogBody.velocity.z;
    cavLogRide += Math.abs(cavLogBody.velocity.z) * dt;
    // ...and the metres are on the paper while the river has you (v36). In a
    // chapter where the only light is the one you make, a number climbing on
    // the card is also the only thing telling you the log is still moving.
    // Three metres is the record's own floor in the branch below.
    if (cavLogRide > 3 && game.recordLive) game.recordLive('the-log', cavLogRide);
    if (cavLogRide > 50) cavTask(game, 'the-log');
  } else if (cavLogRide > 0) {
    // ONCE, WHEN THE RIDE ENDS. `record` toasts on every improvement, so a
    // per-frame call on a climbing number is a personal best sixty times a
    // second.
    if (cavLogRide > 3) game.record('the-log', cavLogRide);
    cavLogRide = 0;
  }
}

function cavUpdateFish(game, dt) {
  if (!cavFish) return;
  // IT CANNOT SEE YOU AND IT CAN HEAR EVERYTHING. Cave fish have no eyes and
  // a lateral line that is doing all the work, so the one thing that WILL get
  // a reaction out of it is a pressure wave — which is to say, a shout. The
  // bolt is an offset on the clock it is already on, so the animal re-settles
  // by itself with no state machine (the Palawan schools rule).
  cavFishBolt = damp(cavFishBolt, 0, 0.9, dt);
  cavFishT += dt * (1 + cavFishBolt * 7);
  const z = -58 + Math.sin(cavFishT * 0.22) * 22;
  const x = cavRIVER_X + Math.sin(cavFishT * 0.55) * 7;
  cavFish.position.set(x, cavWATER - 1.3 - cavFishBolt * 0.8 + Math.sin(cavFishT * 1.1) * 0.35, z);
  cavFish.rotation.y = Math.atan2(Math.cos(cavFishT * 0.55) * 7 * 0.55,
                                  Math.cos(cavFishT * 0.22) * 22 * 0.22);
  cavFish.rotation.z = Math.sin(cavFishT * (4 + cavFishBolt * 14)) * (0.12 + cavFishBolt * 0.3);
  const capy = game.capy;
  // ...and it still has no idea you are there in the sense that matters:
  // nothing in this game has ever failed to notice a capybara before, and
  // this one never learns what you ARE.
  if (capy && capy.position.distanceTo(cavFish.position) < 4.5) cavTask(game, 'blind-fish');
}

/**
 * THE GLOW-WORM COLONY, AND IT IS THE MAP GOING OUT.
 *
 * One number on one cloned material. It drops to nothing in about a second
 * (the real larva takes rather less) and comes back over twenty-two, which is
 * long enough to matter and short enough not to be a punishment — and because
 * the worms are the only permanent light in the passage, the chapter briefly
 * becomes what it claims to be: a place where the only light is the one you
 * make, and you have just used it up.
 */
function cavUpdateWorms(dt) {
  if (!cavWormMat) return;
  // fast down, slow up. A recovery that is symmetric with the disturbance is
  // a dimmer switch; a hard drop and a long climb is an ANIMAL.
  cavWormDim = cavWormDim > 0.5 ? damp(cavWormDim, 0, 1.6, dt) : damp(cavWormDim, 0, 0.14, dt);
  const k = 1 - cavWormDim;
  emitSet(cavWormMat, 0.06 + k * 1.84);
  cavCol.set(PALETTE.cavGlowDim).lerp(cavColB.set(PALETTE.cavGlow), k);
  cavWormMat.emissive.copy(cavCol);
  cavWormMat.color.copy(cavCol);
}

/** Twenty-six drips and the ring each one leaves. A cave is made of these. */
function cavUpdateDrips(game, dt) {
  if (!cavDripMesh) return;
  const capy = game.capy;
  const px = capy && capy.position ? capy.position.x : 0;
  const pz = capy && capy.position ? capy.position.z : 0;
  for (let i = 0; i < cavDRIP_N; i++) {
    const o = i * 5;
    cavDripData[o + 3] += dt;
    const per = cavDripData[o + 4];
    const floor = cavTerrain(cavDripData[o], cavDripData[o + 1]);
    const top = cavDripData[o + 2];
    // s = ut + gt^2/2 with u = 0. A drop from forty metres takes 2.9 s and is
    // moving at twenty-eight when it lands, which is why it is drawn as a
    // STREAK: at 60 Hz it covers half a metre between frames.
    const fall = 0.5 * 9.8 * cavDripData[o + 3] * cavDripData[o + 3];
    const y = top - fall;
    if (y < floor + 0.05) {
      cavDripData[o + 3] = -rand(0, per);
      const dx = cavDripData[o] - px, dz = cavDripData[o + 1] - pz;
      const far = Math.sqrt(dx * dx + dz * dz);
      if (far < 34) {
        cavRing(cavDripData[o], floor + 0.06, cavDripData[o + 1]);
        // rationed by distance, exactly like every other ambient mover: 26 of
        // these unrationed is a leaking tap, not a cave
        if (far < 20 && Math.random() < 0.4) {
          cavSfx.volume = clamp(0.17 - far * 0.006, 0.02, 0.17);
          cavSfx.pitch = rand(0.34, 0.62);
          game.sfx('tick', cavSfx);
        }
      }
    }
    const live = cavDripData[o + 3] > 0 && y > floor;
    const len = live ? clamp(0.6 + fall * 0.09, 0.6, 3.4) : 0.001;
    cavDripMesh.setMatrixAt(i, cavXform(cavDripData[o], y + len * 0.5, cavDripData[o + 1],
                                        0, 0, 0, live ? 1 : 0.001, len, live ? 1 : 0.001));
  }
  cavDripMesh.instanceMatrix.needsUpdate = true;

  // ---- ...AND ONE OF THEM CAN LAND ON YOU (v20) --------------------------
  // Twenty-six drips have been falling out of this roof since the chapter was
  // built, ringing the floor and ticking, and a capybara could stand directly
  // underneath one for as long as it liked and stay bone dry. Same argument as
  // the Botanic Gardens sprinkler and the same optional hook: `soaking(x, z)`.
  //
  // It ACCUMULATES rather than snapping to a level, because a drip is not a
  // sprinkler — about four seconds under one to get properly damp — and it
  // gives back twice as fast as it takes, so stepping out from under it is
  // immediately the right move. It never reaches the level a swim gives.
  let near = 1e9;
  for (let i = 0; i < cavDRIP_N; i++) {
    const o = i * 5;
    const dx = cavDripData[o] - px, dz = cavDripData[o + 1] - pz;
    const d2 = dx * dx + dz * dz;
    if (d2 < near) near = d2;
  }
  cavSoakT = clamp(cavSoakT + (near < cavDRIP_HIT * cavDRIP_HIT ? dt : -dt * 2), 0, cavSOAK_T);

  if (cavRingMesh) {
    let anyLive = 0;
    for (let i = 0; i < cavRING_N; i++) {
      const o = i * 4;
      if (cavRingD[o + 3] > 1.2) {
        cavRingMesh.setMatrixAt(i, cavXform(0, -900, 0, 0, 0, 0, 0.01, 0.01, 0.01));
        continue;
      }
      cavRingD[o + 3] += dt;
      anyLive++;
      const r = 0.25 + cavRingD[o + 3] * 1.5;
      cavRingMesh.setMatrixAt(i, cavXform(cavRingD[o], cavRingD[o + 1], cavRingD[o + 2],
                                          0, 0, 0, r, 1, r));
    }
    cavRingMesh.instanceMatrix.needsUpdate = true;
    cavRingMesh.visible = anyLive > 0;
  }
}

/** The crickets, which are the only thing in here smaller than the capybara. */
function cavUpdateCrickets(dt) {
  if (!cavCricks) return;
  cavCrickScat = damp(cavCrickScat, 0, 1.1, dt);
  for (let i = 0; i < cavCRICK_N; i++) {
    const o = i * 6;
    // A CAVE CRICKET DOES NOT WALK, IT TELEPORTS. It sits perfectly still for
    // ten seconds and then it is forty centimetres to the left, and there is
    // no in-between — which is why this is a hop counter and not a velocity.
    if (cavCrickData[o + 3] > 0) {
      cavCrickData[o + 3] -= dt * 5;
      if (cavCrickData[o + 3] <= 0) {
        const jump = 0.5 + cavCrickScat * 2.6;
        // ...AND IT HOPS BACK TOWARD ITS OWN CRACK. An unbiased direction with
        // no anchor is a random walk (see cavCrickHome); one that leans home
        // harder the further out it is holds the colony inside about three
        // metres for ever, at the cost of one atan2 nobody can see.
        const hx = cavCrickData[o + 4] - cavCrickData[o];
        const hz = cavCrickData[o + 5] - cavCrickData[o + 1];
        const far = Math.sqrt(hx * hx + hz * hz);
        const pull = clamp((far - 1.2) / 2.4, 0, 0.85);
        let a = rand(0, 6.28);
        if (far > 0.05 && Math.random() < pull) a = Math.atan2(hz, hx) + rand(-0.7, 0.7);
        const nx = cavCrickData[o] + Math.cos(a) * jump;
        const nz = cavCrickData[o + 1] + Math.sin(a) * jump;
        // and never INTO the river, which is the other half of the fix
        if (!cavIsOverWater(nx, nz)) {
          cavCrickData[o] = nx; cavCrickData[o + 1] = nz;
        }
        cavCrickData[o + 2] = a;
      }
    } else if (Math.random() < dt * (0.09 + cavCrickScat * 3.2)) {
      cavCrickData[o + 3] = 1;
    }
    const h = cavTerrain(cavCrickData[o], cavCrickData[o + 1]);
    const hop = Math.max(0, Math.sin(cavCrickData[o + 3] * Math.PI)) * 0.55;
    cavCricks.setMatrixAt(i, cavXform(cavCrickData[o], h + 0.09 + hop, cavCrickData[o + 1],
                                      -hop * 0.6, cavCrickData[o + 2], 0, 1, 1, 1));
  }
  cavCricks.instanceMatrix.needsUpdate = true;
}

function cavUpdateSwifts(game, dt) {
  if (!cavSwifts) return;
  // THEY GO OUT WHETHER OR NOT ANYBODY SHOUTS AT THEM. A roost of ninety
  // swiftlets that only ever moves when the player presses a key is not a
  // roost, it is a switch — and the whole argument of the ambient-mover rules
  // is that a world is a place things happen IN. Every fifty seconds or so the
  // colony turns over on its own: not the full panic a wheek causes (that is
  // still yours, and it is still what the task is scored on) but a lift, a
  // circuit and a settle, which is what a cave roost does all day.
  // HOW FAR AWAY THE PLAYER IS, once, because every noise below is rationed on
  // it. The roost is at z = -126 and the entrance is at z = +50: an
  // unrationed colony is audible from a hundred and eighty metres away through
  // a mountain, which is the ambient-mover rule this file already keeps for
  // the drips and did not keep here.
  const capy = game.capy;
  const rdx = (capy && capy.position ? capy.position.x : 0) - cavROOST.x;
  const rdz = (capy && capy.position ? capy.position.z : 0) - cavROOST.z;
  const rFar = Math.sqrt(rdx * rdx + rdz * rdz);
  const rNear = clamp(1 - (rFar - 12) / 46, 0, 1);

  cavSwiftOwn -= dt;
  if (cavSwiftOwn <= 0) {
    cavSwiftOwn = rand(38, 66);
    cavSwiftUp = Math.max(cavSwiftUp, rand(0.30, 0.46));
    if (rNear > 0.02) {
      cavSfx.volume = 0.09 * rNear; cavSfx.pitch = rand(3.4, 4.4);
      game.sfx('pop', cavSfx);
    }
  }
  // ---- AND THEY ECHOLOCATE, WHICH IS THE JOKE AND IS ALSO TRUE ------------
  // Aerodramus is one of three birds on earth that does, and it does it with a
  // double click loud enough to hear across a room — which in a chapter whose
  // one new verb is "shout to see where the walls are" is the same sentence
  // said by something that has been doing it for four million years. It is the
  // only continuous sound at this end of the passage, so it is quiet, it is
  // rationed by distance, and it goes up sharply while the colony is airborne.
  if (rNear > 0.03) {
    cavSwiftClick -= dt;
    if (cavSwiftClick <= 0) {
      cavSwiftClick = rand(0.5, 1.9) / (1 + cavSwiftUp * 2.4);
      cavSfx.volume = clamp(0.030 + cavSwiftUp * 0.05, 0.01, 0.09) * rNear;
      cavSfx.pitch = rand(4.6, 5.6);
      game.sfx('tick', cavSfx);
    }
  }
  cavSwiftUp = damp(cavSwiftUp, 0, 0.45, dt);
  const roof = cavRoofH(cavROOST.x, cavROOST.z);
  let up = 0;
  for (let i = 0; i < cavSWIFT_N; i++) {
    const k = cavSwiftUp * clamp(1 - i / cavSWIFT_N * 0.4, 0, 1);
    const a = cavTime * (1.1 + (i % 7) * 0.09) + cavSwiftPh[i];
    // ---- SETTLED MEANS HOME, NOT MEANS "THE MIDDLE" ---------------------
    // The rest radius was 1.5 m about `cavROOST` for all ninety, and the live
    // X and Z were damped INTO it — so a colony that had finished its circuit
    // converged into a three-metre column of birds hanging in mid-air over the
    // floor, at ninety different heights, for ever. (The Y was never written
    // back at all, which is the only reason it was a column and not a ball.)
    // A settled swiftlet is on the wall it nests on, at the cup it owns, and
    // `cavSwiftHX/HY/HZ` is where that is.
    const rr = 13 + (i % 5) * 2.2;
    // the flight circle is pushed OFF the wall — a colony wheeling round a
    // centre ten metres from a rock face flies half of every lap inside it
    const tx = lerp(cavSwiftHX[i], cavROOST.x + 4 + Math.cos(a) * rr, k);
    const tz = lerp(cavSwiftHZ[i], cavROOST.z + Math.sin(a) * rr * 0.9, k);
    const ty = lerp(cavSwiftHY[i], roof - 12 - Math.sin(a * 1.7) * 8, k);
    cavSwiftX[i] = damp(cavSwiftX[i], tx, 3, dt);
    cavSwiftZ[i] = damp(cavSwiftZ[i], tz, 3, dt);
    cavSwiftY[i] = damp(cavSwiftY[i], ty, 3, dt);
    cavM.compose(cavV3.set(cavSwiftX[i], cavSwiftY[i], cavSwiftZ[i]),
                 cavQ.setFromEuler(cavE.set(k * 0.3,
                                            k > 0.05 ? a + 1.57 : cavSwiftPh[i] * 0.2 - 1.57,
                                            Math.sin(cavTime * 14 + i) * 0.5 * k)),
                 cavSc.set(1, 1, 1));
    cavSwifts.setMatrixAt(i, cavM);
    if (k > 0.3) up++;
  }
  cavSwifts.instanceMatrix.needsUpdate = true;
  // THE COUNT IS TAKEN WHILE THEY ARE UP AND FILED WHEN THEY SETTLE. Recording
  // on every new maximum fires a personal best ninety times as the roost lifts.
  if (up > cavSwiftPeak) cavSwiftPeak = up;
  // ...and the count is on the paper while they are off the wall (v36), but
  // ONLY for a lift the player caused — `cavSwiftMine` is the same latch that
  // stops the task ticking itself, and without it this line would come up on
  // its own every time the colony turned over on its own clock. The peak of
  // this lift, which is what gets filed when they settle.
  if (cavSwiftMine && cavSwiftPeak > 8 && game.recordLive) {
    game.recordLive('swiftlets', cavSwiftPeak);
  }
  if (cavSwiftUp < 0.06 && cavSwiftPeak > 0) {
    if (cavSwiftPeak > cavSwiftBest) {
      cavSwiftBest = cavSwiftPeak;
      game.record('swiftlets', cavSwiftBest);
    }
    cavSwiftPeak = 0;
  }
  // ---- AND THE TICK IS ONLY YOURS ----------------------------------------
  // 'put the roost up' was completing ITSELF, every single time, within forty
  // seconds of entering the chapter and from anywhere in it. The colony turns
  // over on its own clock (which is right — see the note above), and that lift
  // reaches `cavSwiftUp` = 0.46, which with the per-bird taper puts seventy-
  // eight of the ninety over the `k > 0.3` line: `up > 30` was satisfied by
  // the ambience. So the one task in chapter 16 that is a THING YOU DO was
  // ticked off the card before the player had walked ten metres, from four
  // hundred metres away, with the roost not yet in the frustum. A wheek in the
  // roost zone latches this; nothing else can.
  if (up > 30 && cavSwiftMine) {
    cavTask(game, 'swiftlets');
    if (Math.random() < dt * 6) {
      cavSfx.volume = rand(0.10, 0.20) * clamp(rNear + 0.25, 0, 1);
      cavSfx.pitch = rand(3.2, 4.6);
      game.sfx('pop', cavSfx);
    }
  }
  if (cavSwiftUp < 0.05) cavSwiftMine = false;
}

function cavUpdateTasks(game, dt) {
  const capy = game.capy;
  if (!capy || !capy.body) return;
  const p = capy.body.position;
  const input = game.input;

  cavDayK = damp(cavDayK, cavDaylightAt(p.x, p.z), 3.0, dt);

  // ---- AND THE RIG LOOKS UP, IN THE THREE PLACES THAT ARE UP -------------
  // See cavSKY_DOLINE. Computed here rather than inside skyward() because
  // systems.js asks for it once a frame and this is already the once-a-frame
  // function that has the animal's position in it; the damp is systems' own
  // (0.9 lambda, ~three seconds), so this is a hard target and it still
  // arrives as a slow crane.
  //
  // THE DOLINE IS THE ONLY ONE THAT GETS THE FULL CRANE, and it is gated on
  // being IN it rather than near it — a hundred and forty metres across, with
  // the column of light standing in the middle, is a room you walk into, and
  // the camera should come up as you do rather than from the far side of the
  // Great Passage. The other two are half-measures on purpose: at the slot and
  // under the arch there is something worth seeing forty metres up, not two
  // hundred, and taking the ground out of the frame at the exact moment the
  // player is trying to walk through a gap is a camera fighting the game.
  {
    const D = cavDOLINE;
    const ddx = p.x - D.x, ddz = p.z - D.z;
    const dd = Math.sqrt(ddx * ddx + ddz * ddz * 1.2);
    let want = cavSKY_DOLINE * cavSmooth((D.r + 2 - dd) / 10);
    // the slot: only once you are close enough that the chink is the subject
    want = Math.max(want, cavSKY_SLOT * cavSmooth((cavEXIT_Z + 34 - p.z) / 16));
    // and the arch on the way in, where the cloud comes out of the mountain
    want = Math.max(want, cavSKY_MOUTH * cavSmooth((14 - Math.abs(p.z - (cavMOUTH_Z - 2))) / 8));
    // ...AND NEVER WHILE THE ANIMAL IS DOING SOMETHING WITH THE GROUND. A
    // crane to eleven degrees while you are half-way up seventy metres of
    // calcite, swimming a river in the dark or riding a log takes the thing
    // you are standing on out of the picture, which is the one state in which
    // this camera has a job. (The wall is inside the doline's own falloff at
    // the top: cavWALL.z is -104 and the doline reaches -74.)
    if (capy.climbing || capy.swimming || cavLogCarrying) want = 0;
    cavSkyK = want;
  }

  // ---- the glow-worm trail: it has done its job when you reach the water --
  if (cavInZone('river', p.x, p.z) && p.z < 26) {
    cavTask(game, 'glow-trail');
    if (!cavToldWorms) {
      cavToldWorms = true;
      game.toast('they are only ever over the water. that is why they work.');
    }
  }
  // ---- swimming it -------------------------------------------------------
  if (capy.swimming && cavInZone('river', p.x, p.z)) {
    cavRiverSwum += Math.abs(capy.velocity.z) * dt;
    if (cavRiverSwum > 38) cavTask(game, 'cave-river');
  }
  // ---- the Hand of Dog ---------------------------------------------------
  {
    const dx = p.x - cavHAND.x, dz = p.z - cavHAND.z;
    if (dx * dx + dz * dz < 20 && p.y > cavTerrain(cavHAND.x, cavHAND.z) + 24) {
      cavTask(game, 'hand-of-dog');
    }
  }
  // ---- the pearls --------------------------------------------------------
  // ...AND ONE OF THEM ACTUALLY GOES. `cavPearlGone` was assigned at build
  // time and never read once: robbing the pool had a sound, a tick on a list
  // and no consequence you could see. One pearl is hidden, which is all it
  // takes — a rimstone pool with a gap in it is a pool somebody has been at,
  // and the surveyor at the far end has a line about exactly this.
  if (input.actionPressed && !capy.heldProp && cavInZone('pearls', p.x, p.z)) {
    if (!cavPearlTook) {
      cavPearlTook = true;
      if (cavPearlOne) cavPearlOne.visible = false;
      game.toast('he did say not to.');
    }
    cavTask(game, 'cave-pearl');
    cavSfx.volume = 0.4; cavSfx.pitch = 2.2;
    game.sfx('tick', cavSfx);
  }
  // ---- the garden that leans ---------------------------------------------
  // The tick is in cavWheek now — see cavBuildPhyto. What is left here is the
  // teach, once, because a player who walks into a field of rock fins has no
  // reason to guess that shouting at it does anything and the chapter's whole
  // grammar is that shouting at things is what you do.
  if (!cavPhyDone && !cavToldPhyto && cavInZone('phyto', p.x, p.z)) {
    cavToldPhyto = true;
    game.toast('rock, and it is growing. all of it leaning the same way.');
  }
  // ---- THE WALL ----------------------------------------------------------
  if (capy.climbing && cavInZone('wall', p.x, p.z)) {
    if (cavWallT < 0) cavWallT = 0;
    cavWallT += dt;
    // the clock, on the paper, while you are on the wall (v32)
    if (game.recordLive) game.recordLive('great-wall', cavWallT);
  }
  // TOPPED OUT means ABOVE THE WALL, not past it: the rimstone pools you land
  // in are on the crest, at z = wall.z − 1, so a test for "beyond" never fired.
  if (cavWallT >= 0 && p.y > cavWALL.top + 0.15 && p.z < cavWALL.z + 4) {
    if (!cavWallDone) { cavWallDone = true; cavTask(game, 'great-wall'); }
    game.record('great-wall', cavWallT);
    cavWallT = -1;
  } else if (cavWallT >= 0 && (p.y < cavWALL.foot - 1 || p.z > cavWALL.z + 16)) {
    cavWallT = -1;
  }
  // ---- THE DOLINE, and it is the only bright place in a hundred and
  // seventy metres of mountain ---------------------------------------------
  if (cavInZone('doline', p.x, p.z) && p.y < cavTerrain(p.x, p.z) + 8) {
    if (!cavSeenLight) {
      cavSeenLight = true;
      game.toast('there is a forest in here.');
      // ---- FRAMED, AND THE BEARING IS THE ONLY ONE THAT SURVIVES ------
      //
      // Two runs of the identical approach to this spot settled the camera at
      // yaw 0.0 and yaw 179.7 — OPPOSITE SIDES of the animal, from the same
      // walk — so the chapter’s marquee had no bearing at all, only whichever
      // way the rig happened to be pointing when you arrived.
      //
      // AND THE HOLE ITSELF CANNOT BE IN THE SHOT. It sits 61 to 86 degrees
      // above the stand point, and the lens is 48 degrees wide: the one frame
      // that contained the hole needed a look pitch of +65.7 and had no
      // capybara in it. What can be in the shot is the LIT FLOOR — a hundred
      // and fifty metres of forest growing under a hole in a mountain, with
      // the animal standing in the one patch of daylight for a mile.
      //
      // yaw 0 is the approach axis, and it is the only bearing that keeps its
      // length: asking for 0.55 rad collapsed the boom from 16 m to 3.3 m
      // against the doline wood.
      if (typeof game.frameShot === 'function')
        game.frameShot({ yaw: 0, dist: 16, pitch: 0.02, raise: 3, hold: 3.2 });
    }
    cavTask(game, 'the-doline');
    // the score holds up for the whole time you are standing in it, the way
    // Iceland's does for the aurora — this is a place, not a switch
    if (game.music && typeof game.music.swell === 'function') game.music.swell(0.9);
  }

  // ---- THE WAY OUT, and it is the last beat of the chapter ---------------
  // The exit at the head of the jetty in chapter 17 and the slot here are the
  // two places in the game where the checklist is finished and the player is
  // walking out; the Antarctic one has the whole bay in the frame and this one
  // used to have a black wall. A single hold on the score for the walk into
  // the light, the way the doline holds one — this is a place, not a switch.
  if (p.z < cavEXIT_Z + 30 && Math.abs(p.x) < 30) {
    if (!cavSeenSlot) {
      cavSeenSlot = true;
      game.toast('daylight. sideways, this time.');
    }
    if (game.music && typeof game.music.swell === 'function') game.music.swell(0.8);
  }

  // ---- the head torches, and they are LOOKING at things ------------------
  // Two real PointLights on two foreheads, and for the chapter's whole life
  // they pointed dead ahead and never moved. A caver's lamp is never still —
  // it is the only way a person in the dark has of paying attention — so each
  // one sweeps on its own slow clock, and the cone in front of it goes with it.
  for (let i = 0; i < cavLampCone.length; i++) {
    const c = cavLampCone[i];
    const a = cavTime * (0.29 + i * 0.07) + i * 2.1;
    const yaw = Math.sin(a) * 0.62 + Math.sin(a * 2.3) * 0.14;
    const pitch = -0.10 + Math.sin(a * 0.7 + 1.1) * 0.22;
    c.rotation.set(Math.PI * 0.5 + pitch, 0, -yaw);
    c.position.set(Math.sin(yaw) * 3.5, 1.60 - Math.sin(pitch) * 3.5, Math.cos(yaw) * 3.5);
    const L = cavLampAt[i];
    if (L) {
      L.position.set(Math.sin(yaw) * 0.3, 1.62, Math.cos(yaw) * 0.3);
      L.intensity = 1.9 * (0.94 + Math.sin(cavTime * 7.3 + i) * 0.06);
    }
  }

  // ---- the mist, and the shaft, both breathing ---------------------------
  if (cavMist) {
    cavMist.rotation.y = cavTime * 0.018;
    cavMist.position.y = cavTerrain(cavDOLINE.x, cavDOLINE.z) + 3 + Math.sin(cavTime * 0.19) * 1.1;
  }
  if (cavShaftMesh) {
    cavShaftMesh.rotation.y = cavTime * 0.011;
    cavShaftMesh.material.opacity = 0.86 + Math.sin(cavTime * 0.31) * 0.14;
  }
  // the mountain breathing out of its own mouth, and the draught at the slot:
  // two ends of the same column of air, so they move on the same slow clock
  if (cavBreath) {
    const b = 1 + Math.sin(cavTime * 0.13) * 0.16;
    cavBreath.scale.set(b, 1 + Math.sin(cavTime * 0.21) * 0.22, b);
    cavBreath.position.z = cavMOUTH_Z - 2 + Math.sin(cavTime * 0.09) * 3.5;
    cavBreath.material.opacity = 0.068 + Math.sin(cavTime * 0.17) * 0.022;
  }
  if (cavExitBeam) {
    cavExitBeam.material.opacity = 0.90 + Math.sin(cavTime * 0.23) * 0.10;
  }
  // the marker on the wall is a BATTERY LAMP left on a stake, so it is not a
  // flame: it does not flicker, it PULSES, very slowly, the way a beacon does
  if (cavWallLamp) {
    const k = 0.72 + 0.28 * Math.pow(Math.max(0, Math.sin(cavTime * 1.15)), 3);
    cavWallLamp.intensity = 2.2 * k;
    if (cavWallLampMesh) emitSet(cavWallLampMesh.material, 1.8 + k * 1.4);
  }
  // ---- and the stove is a FLAME, which means it is never the same twice --
  // Three sines that do not share a period, so it never repeats audibly to the
  // eye; the light and the cone move together, because a flame that flickers
  // while its glow holds still is a light bulb in a paper bag.
  if (cavStove) {
    const f = 0.80 + Math.sin(cavTime * 9.1) * 0.10 + Math.sin(cavTime * 3.7) * 0.07
                   + Math.sin(cavTime * 21.3) * 0.05;
    cavStove.intensity = 3.4 * f;
    if (cavStoveFlame) {
      cavStoveFlame.scale.set(0.30 * (0.9 + f * 0.2), 0.42 * f, 0.30 * (0.9 + f * 0.2));
      cavStoveFlame.rotation.y = cavTime * 2.1;
    }
  }
}

// ====================================================================== API ==
export function createCave(game) {
  cavGame = game;

  const onWheek = function () { cavWheek(game); };
  game.events.on('capy:wheek', onWheek);

  game.biome.register('cave', {
    ensureBuilt() { cavBuild(game); },
    onEnter() {
      cavTime = 0;
      cavEchoT = -1; cavEchoCool = 0;
      if (cavEchoLight) cavEchoLight.intensity = 0;
      if (cavEchoRing) cavEchoRing.visible = false;
      cavLogT = 0; cavLogCarrying = false; cavLogRide = 0;
      cavLogTarget.z = 38; cavLogPrev.z = 38;
      if (cavLogBody) {
        cavLogBody.position.set(cavRIVER_X, cavWATER + 0.3, 38);
        cavLogBody.velocity.set(0, 0, 0);
        cavSyncBody(cavLogBody);
      }
      cavSwiftUp = 0; cavSwiftOwn = rand(20, 40);
      cavWallT = -1;
      cavRiverSwum = 0;
      cavDayK = 1;
      cavWormDim = 0; cavCrickScat = 0; cavFishBolt = 0;
      cavMoteStir = 0;
      cavEchoBack[0] = -1; cavEchoBack[1] = -1; cavEchoBack[2] = -1;
      cavToldEcho = false; cavToldWorms = false; cavToldDim = false; cavToldOpen = false;
      cavToldPhyto = false; cavPhyShake = 0;
      cavSeenSlot = false; cavSwiftMine = false;
      cavRiverT = 0; cavFallT = 0;
      cavSkyK = 0;
    },
    onExit() {
      // anything stateful that could hold the player, cleared on the way out
      cavLogCarrying = false;
      cavWallT = -1;
      cavEchoT = -1;
      if (cavEchoLight) cavEchoLight.intensity = 0;
    },
  });

  const api = {
    built() { return cavBuilt; },
    terrainHeight: cavTerrain,
    slopeAt: cavSlope,
    waterLevel: cavWATER,
    isOverWater: cavIsOverWater,
    waterHeightAt: cavWaterHeightAt,
    inZone: cavInZone,
    // ---- AND THE CAVE HAS TWO ROOMS TOO (P4) ----------------------------
    // Everything from the mouth to the doline has daylight and a forest in it;
    // past the wall there is neither, and the chapter's whole second half is
    // bare rock in every direction. The one room for the whole chapter was
    // tuned for the first half, which is the half with the trees in it.
    room() {
      const p = cavGame && cavGame.capy && cavGame.capy.position;
      return (p && p.z < cavWALL.z) ? 'deepcave' : null;
    },
    navBlocked: cavNavBlocked,
    surfacePitch: cavSurfacePitch,
    SPAWN: cavSPAWN,
    flow(x, z) { return cavFlowAt(x, z, cavFlow); },
    /** THE THIRD CHAPTER TO PUBLISH IT. See cavClimbAt. */
    climbHold: cavClimbAt,
    /** A hop in here is over a boulder in the dark, and it wants steering. */
    airControl: 0.46,
    /** ...and the animal can go under the river, because the fish is under it. */
    canDive: true,
    carryFrame() { return cavLogCarrying ? cavLogFrame : null; },

    /** 0..1 — how hard the echo is ringing. systems.js lifts the room on it. */
    echo() { return cavEchoT < 0 ? 0 : Math.pow(clamp(1 - cavEchoT / cavECHO_LIFE, 0, 1), 1.6); },
    /**
     * 0..1 — HOW FAR THE RIG SHOULD CRANE UP. See cavSKY_DOLINE and CONTRACT.
     *
     * Chapter 7 wrote this contract for an aurora and was the only chapter
     * that ever used it. Everything worth seeing in this one is overhead.
     */
    skyward() { return cavSkyK; },
    /**
     * ...AND THE LENS FLOOR IS A NUMBER ABOUT SEA LEVEL, WHICH THIS IS NOT.
     *
     * `sysCAM_FLOOR` is 1.7 in WORLD Y, and the contract's own note says in so
     * many words that it "is right for every chapter whose ground is at zero
     * and wrong for the one whose ground is at minus eleven". This chapter's
     * ground runs from +4 at the spawn to −6.3 under the doline, −7.4 in the
     * river and −10.5 at the foot of the Great Wall — so for the whole of the
     * Great Passage and the whole of the doline the eye was PINNED eight to
     * twelve metres over an animal it is supposed to sit six behind, and the
     * lower the floor went the further above the capybara the camera rode.
     *
     * Measured standing in the marquee at (−4, −40): capybara at −6.31, eye at
     * 1.70 — the clamp, exactly — which is why the crane above could not get
     * the lens under the canopy and photographed the tops of the breakdown
     * blocks instead. Palawan published this for exactly the same reason and
     * was the only chapter that ever did.
     */
    camFloor(x, z) { return cavTerrain(x, z) + 1.1; },
    /**
     * ...and its mirror, because this chapter has a literal ceiling.
     *
     * The roof was RAISED to 27 m at the far end in an earlier pass because
     * the last shot of the chapter came out completely black — the camera was
     * inside it. That was a workaround for a missing hook; this is the hook.
     * The roof runs down to fourteen metres at the mouth and the rig rides
     * seven above the animal on a slope, which is the same collision by a
     * different door.
     */
    camCeil(x, z) { return cavRoofH(x, z) - 1.8; },
    /** 0..1 — how much natural light is on the animal. THE chapter number. */
    daylight() { return cavDayK; },
    /**
     * HOW WET THE DRIPS ARE MAKING YOU, 0..cavSOAK_MAX — capybara.js's optional
     * `soaking` hook. It ignores (x, z): the accumulator is already a function
     * of where the animal is standing, computed once a frame in cavUpdateDrips
     * against all twenty-six columns, and re-deriving it here would be the same
     * loop twice. See the note there.
     */
    soaking() { return cavSoakT / cavSOAK_T * cavSOAK_MAX; },
    /**
     * WHERE THE NEAREST DRIP LANDS, or null before the roof is built. Twenty-six
     * of them have been falling since the chapter was made and nothing could
     * ask where a single one of them was — the same shape as the Quay's Bridge.
     * It MOVES, in the sense that which one is nearest changes as you do, so it
     * is a function and it returns a scratch vector of its own.
     */
    nearestDrip() {
      if (!cavDripData) return null;
      const cp = cavGame && cavGame.capy && cavGame.capy.position;
      const px = cp ? cp.x : 0, pz = cp ? cp.z : 0;
      let best = -1, bd = Infinity;
      for (let i = 0; i < cavDRIP_N; i++) {
        const o = i * 5;
        const dx = cavDripData[o] - px, dz = cavDripData[o + 1] - pz;
        const d2 = dx * dx + dz * dz;
        if (d2 < bd) { bd = d2; best = o; }
      }
      if (best < 0) return null;
      cavV3d.set(cavDripData[best], cavTerrain(cavDripData[best], cavDripData[best + 1]),
                 cavDripData[best + 1]);
      return cavV3d;
    },
    seenLight() { return cavSeenLight; },
    echoReady() { return cavEchoCool <= 0; },

    // landmarks
    mouth: { x: 0, z: cavMOUTH_Z - 4 },
    river: { x: cavRIVER_X, z: 20 },
    hand: { x: cavHAND.x, z: cavHAND.z },
    doline: { x: cavDOLINE.x, z: cavDOLINE.z },
    wall: { x: 0, z: cavWALL.z + 8 },
    roost: { x: cavROOST.x, z: cavROOST.z },
    pearls: { x: cavPEARLS.x, z: cavPEARLS.z },
    phyto: { x: cavPHYTO.x, z: cavPHYTO.z },
    exit: { x: 0, z: cavEXIT_Z + 2 },
    /** It MOVES — ask, never cache. */
    fish() {
      if (!cavFish) return cavSPAWN;
      cavV3b.copy(cavFish.position);
      return cavV3b;
    },
    log() {
      if (!cavLogBody) return cavSPAWN;
      cavV3b.set(cavLogBody.position.x, cavLogBody.position.y, cavLogBody.position.z);
      return cavV3b;
    },

    update(dt) {
      if (!cavBuilt) return;
      if (!game.biome.isActive('cave')) return;
      cavTime += dt;
      cavUpdateEcho(game, dt);
      cavUpdateEchoBack(game, dt);
      cavUpdateWorms(dt);
      cavUpdateLog(game, dt);
      cavUpdateFish(game, dt);
      cavUpdateSwifts(game, dt);
      cavUpdateDrips(game, dt);
      cavUpdateCrickets(dt);
      cavUpdateMotes(dt);
      cavUpdateSlotMotes(dt);
      cavUpdateShaftLife(dt);
      cavUpdatePhyto(dt);
      cavUpdateSound(game, dt);
      cavUpdateTasks(game, dt);
    },
  };
  game.cave = api;
  return api;
}
