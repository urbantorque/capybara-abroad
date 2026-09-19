import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PALETTE, mat, matEmit, rand, randInt, clamp, damp, lerp, grain, placeCue, makeMerger } from './shared.js';

// ===========================================================================
// CHAPTER 17 — THE ANTARCTIC PENINSULA
//
// The seventeenth place, and the first one where WALKING is the exception.
// Everywhere else in this game the animal's feet are the chapter and a vehicle
// is a set piece; here it is the other way round. The land is four rocks and a
// glacier, they are eleven hundred metres apart, and it is minus nine — so the
// verb is STEER, the same verb chapter 3 taught on a warm harbour, and this is
// what it looks like when the water is trying to stop you.
//
// THREE THINGS MAKE THIS CHAPTER AND NOT ONE:
//
//  1. THE PACK. The sea is not empty. `antIceAt(x, z)` is a density field, and
//     the tender's top speed is a function of it — full ahead into half a metre
//     of brash is four knots and a lot of noise. Threaded through it is a LEAD,
//     a wandering trough of open water, and finding the lead is the difference
//     between a nine-minute crossing and a two-minute one. Nothing tells you
//     where it is. You can see it: open water is dark and the pack is white.
//
//  2. THE ICE UNDERFOOT. Four different frictions, and they are regions of the
//     map rather than a global setting: station rock holds you completely, snow
//     holds you nearly, an iced timber deck does not quite, the polished blue
//     tongue of the glacier does not at all. Every one of the slippery places
//     has a grippy way back to the top of it — the shoulder beside the blue
//     ice, the rock beside the highway — because a slope you cannot climb is a
//     wall and not a run.
//
//  3. THE POD. Six orcas patrolling the deep, on their own clock, whether or
//     not anybody is watching. Wheek at them from the boat and they come; they
//     form on the quarters and stay there; and a hull sitting in that much
//     moving water goes faster than it has any right to. That is the marquee,
//     and it is deliberately not a cutscene — it is a formation you have to
//     HOLD, at speed, in the pack, which means it is made of the two mechanics
//     the chapter has already taught you.
//
// Everything here is prefixed `ant` (contract: the bundler flattens every
// module into one scope).
// ===========================================================================

// --------------------------------------------------------------- geography --
// One coordinate system. South (+z) is the station and the only land you start
// on; north (-z) is the channel, the gate between the two bastions, the berg
// and finally the shelf, which is where the world stops.
const antWATER   = -0.6;          // the still waterline
// ...and it stands on ROCK, not on snow. Measured from a real title-card
// start: the first spawn was 10 m up the face where slip is 0.18, and six
// seconds after arriving — with nobody touching anything — the animal had
// drifted eight metres down the hill. The snow line here is 6.5 m; below it
// the shore is bare rock and holds you completely, which is where somebody
// who has just been put down should be put down.
const antSPAWN   = { x: 0, y: 7.1, z: 52 };

// The station, on a rocky point. An ellipse: the summit ridge at the back, the
// colony on the terrace, and the whole north face falling into the bay.
const antSTN     = { x: 0, z: 96, rx: 72, rz: 54, h: 19 };
const antCOLONY  = { x: 24, z: 92, r: 17 };
const antHUTS    = { x: -17, z: 58 };
const antJETTY   = { x: 0, z0: 39, z1: 18, hx: 1.30, y: 0.62 };
const antBERTH   = { x: 3.6, z: 22.0, yaw: Math.PI };

// The penguin highway: the packed track the colony wears into the snow between
// where they sleep and where they eat. Four control points, top to bottom.
const antHIGH = [24, 92, 18, 74, 12, 58, 6, 42];
const antHIGH_W  = 3.4;           // half-width of the polished part

// The glacier, on the west side. One long ramp out of the ice cap down to the
// water — 110 m of run for 46 m of rise, which is 23 degrees, which is the
// same angle as the great dune and is not an accident.
const antGLAC    = { xToe: -86, xTop: -196, h: 46, z0: -212, z1: 34 };
const antBLUE    = { z0: -158, z1: -62, xIn: -96 };   // the polished tongue
const antCALVE   = { x: -88, z: -112 };

// The black beach where the whalers left everything they had, and it is all
// still there, because nothing rots down here.
const antWHAL    = { x: 122, z: 30, rx: 50, rz: 42, h: 8 };
const antBONES   = { x: 114, z: 14 };

// The gate. Two bastions squeezing the fairway to about a hundred and sixty
// metres — you cannot get north without going between them, which is the same
// trick the Harbour Bridge plays in chapter 3.
const antWBAST   = { x: -168, z: -336, rx: 76, rz: 96, h: 62 };
const antEBAST   = { x: 168, z: -336, rx: 76, rz: 96, h: 62 };
const antGATE_Z  = -336;

// The tabular berg, with a melt arch through it. Beam of the tender is 3.8 m
// and the arch is fourteen wide: a thing you steer through, not a thing you
// thread.
const antBERG    = { x: 74, z: -412, hx: 34, hz: 19, top: 13, archW: 14, archH: 9 };

const antSEA_X0 = -212, antSEA_X1 = 212, antSEA_Z0 = -512, antSEA_Z1 = 122;

// ------------------------------------------------------------- the tender ---
// A displacement hull again, and deliberately the same three ideas as chapter
// 3's ferry so that a player who drove that one already knows this one:
// throttle is a target speed, rudder authority is bought with way, the hull
// carries its old heading through a turn. What is NEW is that her top speed is
// a function of WHERE SHE IS.
const antTEN_VMAX   = 12.6;       // m/s in clear water (~24 knots; she is small)
const antTEN_VREV   = -3.4;
const antTEN_ACC    = 3.8;
const antTEN_DRAG   = 0.62;
const antTEN_TURN   = 0.62;       // rad/s at full rudder AND full speed
const antTEN_RUDDER = 2.7;
const antTEN_HX     = 1.90;       // half beam
const antTEN_HZ     = 4.20;       // half length
const antTEN_DECK   = 0.44;       // body origin above the waterline datum
const antHELM       = { x: 0, z: -2.15 };   // the tiller, and it is aft
const antHELM_R     = 2.7;
// Ice takes this fraction of her legs at full density, and this fraction of
// her acceleration. Both sized against the passage: down the lead the gate is
// two minutes away, and through the pack either side of it, nearer seven.
const antICE_DRAG   = 0.70;
const antICE_ACC    = 0.55;
// ...and the pod gives it back. A hull sitting in six orcas' worth of moving
// water is a hull going downhill; this is the only speed bonus in the game and
// it exists to make the marquee a thing you DO rather than a thing you watch.
const antWAKE_GAIN  = 3.1;

// ------------------------------------------------------------------ slip -----
// See capybara.js: slip is linear in TERMINAL VELOCITY, so these read the way
// they look. 0.18 is a snow slope you can walk up; 0.66 is a polished track you
// steer down badly; 0.93 is blue ice and it owns you.
const antSLIP_ROCK  = 0.00;
const antSLIP_SNOW  = 0.18;
const antSLIP_DECK  = 0.34;       // iced timber. Enough to notice, never enough to hurt
const antSLIP_FLOE  = 0.48;
const antSLIP_HIGH  = 0.66;
const antSLIP_BLUE  = 0.93;

// ------------------------------------------------------------------ floes ----
const antFLOE_N     = 15;
const antFLOE_TOP   = 0.34;       // freeboard: how far a pan stands out of the sea
const antFLOE_SOLID = 0.16;       // and how far inside its edge it stops being ground

// ------------------------------------------------------------------- pod -----
const antPOD_N      = 6;
const antPOD_CALL   = 185;        // metres a wheek carries to them
const antPOD_HOLD   = 16.5;       // how close is "with the pod"
const antPOD_RIDE   = 9.0;        // seconds of it that is the marquee
const antPOD_LEAVE  = 64;         // ...and how long they will put up with you
// ---- D4.12: the run -------------------------------------------------------
// How long the escort lasts before they break, how fast they go when they do,
// and how long you may be outside antPOD_HOLD before they are gone. 11.0
// against a hull that does 12.6 in clear water: catchable, and only in the
// lead, which is the whole point of putting them on antLeadX.
const antPOD_RUN_AT = 8.0;
const antPOD_RUN_V  = 11.0;
const antPOD_LOSE   = 6.0;
let antPodRunPX = 0, antPodRunPZ = 0, antPodGap = 0, antPodToldGap = false;

// ------------------------------------------------------------------ scratch --
const antV3 = new THREE.Vector3();
const antV3b = new THREE.Vector3();
const antQ = new THREE.Quaternion();
const antE = new THREE.Euler();
const antSc = new THREE.Vector3();
const antM = new THREE.Matrix4();
const antCol = new THREE.Color();

// ---------------------------------------------------------------- module ----
let antGame = null;
let antBuilt = false;
let antRoot = null;
let antTime = 0;

let antSeaMesh = null, antSeaAttr = null, antSeaT = 0;
let antPackMesh = null;                     // the brash, one instanced mesh
// FOURTEEN HUNDRED, NOT FOUR HUNDRED AND SIXTY.
//
// The pack is the chapter — the tender's legs, her acceleration and her noise
// are all a function of `antIceAt` — and it is meant to be read two ways: as
// the colour of the sea from a hundred metres, and as lumps of ice under the
// bow. The first half worked. The second did not: 460 lumps over the
// two-hundred-and-thirty-thousand square metres of sea that carries ice is one
// every five hundred square metres, and measured in a two-hundred-metre box
// across the middle of the channel there were seventy-two of them. Full ahead
// into "half a metre of brash" put two or three white boxes past the camera in
// nine seconds. Density is what makes ice ICE, so the count is where the
// budget goes: twelve triangles apiece, one draw call, and it is still under
// twenty thousand triangles in a chapter that was running at eighty-six.
const antPACK_N = 1400;
let antPackData = null;                     // x, z, r, spin, phase
let antWakeMesh = null;
const antWakeN = 30;
const antWakeX = new Float32Array(antWakeN);
const antWakeZ = new Float32Array(antWakeN);
const antWakeL = new Float32Array(antWakeN);
const antWakeS = new Float32Array(antWakeN);
let antWakeHead = 0, antWakeT = 0;

let antBoatGroup = null, antBoatBody = null, antTillerMesh = null, antFlagMesh = null;
let antBoatYaw = 0, antBoatSpeed = 0, antRudder = 0, antThrottle = 0;
let antBoatX = antBERTH.x, antBoatZ = antBERTH.z;
let antHelmOn = false, antHelmCool = 0;
let antCrunchT = 0, antHornT = 0, antBoatIce = 0, antDetent = 0;

let antFloeMesh = null, antFloeBodies = null;
let antFloeX = null, antFloeZ = null, antFloeR = null, antFloePh = null;
let antFloeTX = null, antFloeTZ = null;      // the PREVIOUS TARGET, per carrier rule 3
let antOnFloe = -1, antFloeRideX = 0, antFloeRideZ = 0, antFloeRide = 0, antFloeBest = 0;
let antHauled = false;

let antPodGroup = null, antPodParts = null;
// ROADMAP-WOW Part C: per animal, the flukes on a hinge and the dorsal on a
// hinge — the two parts of an orca that move that are not the whole orca.
let antPodFlukes = null, antPodFins = null;
let antPodX = null, antPodZ = null, antPodPh = null, antPodOffX = null, antPodOffZ = null;
let antPodCX = 0, antPodCZ = -300, antPodYaw = 0, antPodU = 0;
let antPodState = 'patrol';
let antPodStateT = 0, antPodRide = 0, antPodBest = 0, antPodBlow = 0;
let antSpyT = -1, antSpyIdx = 0, antSlowT = 0, antSeenPod = false;
let antSpyTold = false;   // the toast is once per spy-hop, not once per frame of one

let antWinLight = [], antWinPane = [];   // the lit windows. See antBuildStation
let antPengMesh = null, antPengData = null, antPengScale = null;
// THE HERD and THE PERCH (N1), for the birds past antPENG_COL only — the ones
// the herd offer addresses. `held` takes a bird off the penguin highway;
// `perch` is the re-asked timer that says it is on the capybara's back.
const antPengHeld  = new Float32Array(64);
const antPengPerch = new Float32Array(64);
const antPengPerchY = new Float32Array(64);
// ...and where the nests are, written by antBuildStation and read by
// antBuildPenguins, so that every bird in the colony is standing on one.
const antNests = [];
const antPENG_N = 174;
// A ROOKERY IS CROWDED. Thirty-four birds over a seventeen-metre radius
// photographed as a scatter; a gentoo colony is nests at one neck-length,
// which is the ONE thing everybody knows about the shape of one, and the
// walkers on the highway went up with them because a track with four birds on
// it is not a track that four thousand of them wore.
// ...AND THEY STAND ON THE NESTS. Sixty birds and eighty-two nests scattered
// independently gave a colony in which no bird was on a nest and no nest had a
// bird — a hundred in the rookery now, the first half of them one to a nest
// and the rest standing between, and a quarter of THOSE are chicks.
const antPENG_COL = 132;   // ...of which this many are in the rookery
// The stride of antPengData. Six until the pebble raid needed a home and a
// target: x, z, yaw, mode, disp, spd, homeX, homeZ, tgtX, tgtZ.
const antPENG_S = 10;
let antSwimPeng = null;
const antSWIM_N = 18;
let antSwimData = null;
let antSkua = null, antSkuaT = 0;
// ---- Tier 5: the first predator in the game -------------------------------
// `antSkuaNest` is which nest this lap is aimed at, `antSkuaLap` the lap it was
// chosen on, `antSkuaGot` whether this lap's strike has already resolved, and
// `antSkuaHeavy` a 0..1 that flies it out low and slow afterwards. The two
// counters are the only score this keeps, and neither is a task.
let antSkuaNest = 0, antSkuaLap = -1, antSkuaGot = false, antSkuaHeavy = 0;
let antSkuaTook = 0, antSkuaSaved = 0;
let antSkuaSaid = false;   // the colony line, once, in sight (L7, E5)
// How much flush counts as having put it off. Not "any flush at all": a wheek
// from ninety metres that happens to land on a dive should not save a chick.
// antSkuaFlush is written 1 and decays at 1.2/s, so 0.35 is about nine tenths
// of a second of having actually been there.
const antSKUA_SPOIL = 0.35;
let antPetrels = null;
const antPETREL_N = 26;
const antCAPE_N = 54;                // the cape petrels round the gate
let antPetrelData = null;
let antCapes = null, antCapeData = null, antCapeScat = 0;
let antSealGroup = null, antSealJaw = null, antSealHead = null;
let antSealFloe = 3, antSealLook = 0, antSealSeen = false;
// ---------------------------------------------------------------------------
// ...AND SHE COMES IN AFTER YOU, WHICH IS THE WHOLE ANIMAL.
//
// 'Be looked at by a leopard seal' was a PROXIMITY CHECK — get within thirteen
// metres of a three-hundred-kilo mesh lying on a floe and the line ticks. That
// is the same task as 'walk past a rock', and it is the one line on chapter
// 17's card about the only thing in Antarctica that has ever thought about
// eating anybody. Everyone who has been in a small boat down there has the
// same story and it is never 'I saw one on some ice': it is that she slid off,
// went under the hull, and came up on the other side to have a proper look at
// you, and did it again, and then lost interest and left.
//
// Four states and one timer. Nothing about it can fail: she gives up on her
// own clock, she is steered to deep water every frame like the pod (a leopard
// seal that follows you up a beach is the same bug the orcas had), and the
// task ticks the first time she surfaces beside you — which she always does,
// within about six seconds of going in.
const antSEAL_NOTICE = 24;    // m — how close before she takes an interest
const antSEAL_ABEAM  = 7.4;   // m — how far off she runs when she is on you
const antSEAL_MIN    = 5.6;   // ...and how close she is ever allowed to get
const antSEAL_SPD    = 6.4;   // m/s — faster than the animal, slower than the boat
const antSEAL_BORED  = 30;    // s — and then she has seen enough
const antSEAL_CYCLE  = 4.6;   // s per dive-and-surface
let antSealState = 'hauled';  // hauled | watching | in | leaving
let antSealT = 0, antSealX = 0, antSealZ = 0, antSealY = 0, antSealYaw = 0;
let antSealSurf = 0, antSealTold = false, antSealBr = 0;
let antWeddell = null;

let antCalveT = 16, antCalveBits = null, antCalveData = null, antCalveLive = 0;
// ---- THE WINDOW (L6, F2 / design 2.5) -------------------------------------
// The Peninsula had no event a player could be late for, and it had one all
// along: the face calves on antCalveT and nothing asked you to be there.
// `the-calving` is the tiller inside antCALVE_SEE_R of the block that comes
// off; the countdown is the live line inside 140 m of the face; the wait is
// seconds held at the helm inside the ring before it went — the figure the
// record files (shared.js RECORDS, WINDOWS).
const antCALVE_SEE_R = 70;
let antCalveWait = 0, antCalvingDone = false;
let antCrackT = -1, antCrackV = 0;   // the rumble that follows the crack
let antGateDone = false;
let antScrapeT = 0, antToldFloe = false;   // leaning on a pan. See antStepBoat
let antWindT = 0;                    // the katabatic. See antUpdateWind
let antPengEsc = 0, antToldPeng = false;   // the gentoos that ride the bow
const antGateEcho = [-1, -1];        // the two returns off the bastions
let antMugGone = false;
let antMugWanted = false, antMugProp = null;
const antMugSpot = { x: 0, y: 0, z: 0 };
let antBoneSitT = 0;
let antLeadT = 0, antLeadDone = false;
let antHighT = -1, antHighFrom = false, antHighOff = 0;
let antBlueT = -1, antBlueTop = 0, antBlueHold = 0;
let antArchDone = false, antArchSide = 0;
let antToldPack = false, antToldSlip = false, antToldNeutral = false, antToldColony = false;

// what the wheek does on LAND, which for the chapter's whole life was nothing
let antColonyCall = 0, antSkuaFlush = 0, antPetrelScat = 0, antEchoT = -1;
let antColonyBurst = 0;                   // s of lockout on the wing burst (A3)
let antColonyMover = null;                // ten thousand of them, as a place (A1)
// ---------------------------------------------------------------------------
// ...AND THE CHORUS IS A WAVE, WHICH IS THE ONLY THING THAT MAKES IT A CHORUS.
//
// The whole design note on the colony answer says it out loud — "a colony
// answering is not a sound, it is a WAVE: one bird starts, its neighbours
// join, and it goes up the hill" — and it was true of the AUDIO only. Three
// calls at 0.10, 0.55 and 1.25 s spread outward beautifully in the mix, and
// what the eye saw was `Math.random() < dt * (0.012 + antColonyCall * 2.4)`
// applied identically to all hundred and seventy-four birds: the entire
// rookery threw its head back on the same frame, everywhere, at once. The
// colony local's line is 'do it again, I want to see if it goes all the way up
// the hill' — a promise about the picture that only the speakers ever kept.
//
// One front, expanding from wherever the noise came from at the speed a bird
// notices its neighbour, with a tail behind it: a bird joins when the front
// reaches it and goes on calling for a couple of seconds afterwards, which is
// what makes it read as a wave passing rather than as a ring.
const antCALL_SPD  = 13.5;   // m/s the front travels. Slower than sound, faster than a walk.
const antCALL_TAIL = 17;     // m of still-calling colony behind the front
const antCALL_MAX  = 78;     // how far it carries before it has died out
let antCallX = 0, antCallZ = 0, antCallR = -1;
const antCallT = [-1, -1, -1];
// the spindrift: the wind off a glacier, which is the signature picture of the
// place and the one thing in it that is always moving
const antDRIFT_N = 120;
let antDriftMesh = null, antDriftData = null;
// the bow spray, and a boat at twelve and a half metres a second threw none
// FIFTY-SIX, NOT TWENTY-SIX. The pool is shared between the bow and the pod
// now (see antUpdatePod), and a formation of six orcas at speed will empty a
// twenty-six-slot ring buffer in under half a second, which means the boat
// stops throwing anything at exactly the moment the chapter is at its loudest.
const antSPRAY_N = 56;
let antSprayMesh = null, antSprayData = null;
let antSprayT = 0;
// the breach: once, at the top of the ride, and it is the marquee's marquee
let antBreachT = -1, antBreachIdx = 0, antBreachDone = false;
// ---- AND THEN THE REST OF THEM (W1) ----------------------------------------
// The bull breaches once, at two thirds of the hold, and the tick at the end
// of it was a chime and a card. Now the tick is answered by the pod: three
// more come out one after the other alongside the boat, six tenths of a
// second apart, so the moment the paper says THE ORCA POD is the moment the
// water round the tender is full of them. A queue, drained by the same breach
// animation, so nothing about how a breach looks changed.
const antBreachQueue = [];
let antBreachWait = 0;
function antPodAnswers() {
  antBreachQueue.length = 0;
  antBreachQueue.push(1, 2, 3);
  antBreachWait = 0.3;
  // the first breach is held (L10): three orcas coming out of the water beside
  // a four-metre tender is the picture, and it was over in a second
  const g = antGame;
  if (g && typeof g.slowmo === 'function') g.slowmo(0.55, 1.4);
}
// A ONE-SHOT PAYOUT NEEDS A STATE MEANING ALREADY PAID. See antPodRide.
let antRideDone = false;
// the wave off a calving face, which lifts the boat
let antCalveWave = 0, antCalveWaveX = 0, antCalveWaveZ = 0, antCalveLift = 0;

// ============================================================== small helpers

function antXform(px, py, pz, rx, ry, rz, sx, sy, sz) {
  antE.set(rx, ry, rz, 'YXZ');
  antQ.setFromEuler(antE);
  antV3.set(px, py, pz);
  antSc.set(sx, sy, sz);
  antM.compose(antV3, antQ, antSc);
  return antM;
}

const antG = { box: null, cyl6: null, cyl8: null, cyl4: null, cyl12: null,
               cone6: null, cone4: null, sph6: null, sph8: null };
function antInitGeos() {
  if (antG.box) return;
  antG.box = new THREE.BoxGeometry(1, 1, 1);
  antG.cyl6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
  antG.cyl8 = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
  antG.cyl4 = new THREE.CylinderGeometry(0.5, 0.5, 1, 4);
  antG.cyl12 = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
  antG.cone6 = new THREE.ConeGeometry(0.5, 1, 6);
  antG.cone4 = new THREE.ConeGeometry(0.5, 1, 4);
  antG.sph6 = new THREE.SphereGeometry(0.5, 6, 4);
  antG.sph8 = new THREE.SphereGeometry(0.5, 8, 6);
}

/** CONTRACT: box() takes FULL extents; CANNON.Box takes HALF. */
function antMerger() {
  return makeMerger(antG, {
    xform: antXform, cylSegs: [4, 8, 12], coneSegs: [4], sphSegs: [8], normals: 'recompute', jitter: 0.030,
  });
}

function antVC() {
  return grain(mat(0xffffff, { vertexColors: true }), { scale: 0.30, amount: 0.10, warp: 0.5 });
}
/** Snow and ice take a MUCH finer grain than rock: at 0.30 it reads as gravel. */
/**
 * ANYTHING DOWN HERE THAT GIVES OFF LIGHT IS BUILT WITH THIS.
 *
 * The chapter runs the highest bright-pass threshold in the game (0.94) so
 * that a world made entirely of white things does not bloom into one sheet of
 * paper — which also means a warm-coloured Lambert box does not read as a lamp
 * at all. The emissive term IS what a light source is; it lives on
 * MeshLambertMaterial, so this stays inside the aesthetic law. Same helper as
 * cave.js grew for exactly the same reason.
 */
function antGlow(color, intensity) {
  return matEmit(color, intensity === undefined ? 1 : intensity);
}
function antVCI() {
  return grain(mat(0xffffff, { vertexColors: true }),
               { scale: 0.10, amount: 0.055, warp: 0.9, near: 0.30, nearPale: 0.50, nearScale: 34, contact: 1, broad: 0.09, broadM: 22,
                 // THE WATER'S EDGE (D5), AND THIS IS THE CHAPTER THE REVIEW
                 // NAMED. `qa/rv-antarctic.png`: fifteen floes sitting ON a
                 // flat grey wash rather than IN it, because a floe is a slab
                 // with vertical sides and nothing anywhere said where the
                 // surface crossed them. The band is a horizontal LINE round
                 // every floe, every rock and the shelving beach, at the one
                 // height the sea is — and because this material is the ground
                 // AND the floes, the fifteen that drift get it for free and it
                 // travels with them.
                 //
                 // AND IN THIS CHAPTER THE WATERLINE IS THE DARK HALF, WHICH
                 // COST TWO TUNINGS TO ACCEPT. The first build gave Antarctica
                 // the same bright lace as everywhere else — 0.34 of foam white
                 // on `antFoam` — and photographed at the jetty, settled, it
                 // was not there at all. It is the albedo ceiling this chapter
                 // has been hitting since the fourth pass: the beach is snow,
                 // the grade's threshold is the highest in the game (1.10) so
                 // that a world of white things does not bloom into one sheet
                 // of paper, and a white line added to a white surface under a
                 // flat overcast has nowhere left to go. What reads at an
                 // Antarctic shoreline is the WET: dark slush and dark ice
                 // where the sea has been over it. So the soak is deep (0.55 m
                 // and down to 0.70) and the lace is a whisper on top of it.
                 shore: 0.22, shoreBand: 0.34, shoreWet: 0.55, shoreDark: 0.70,
                 shoreScale: 2.1, shoreColor: PALETTE.antFoam });
}

function antSyncBody(b) {
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
  b.previousQuaternion.copy(b.quaternion);
  b.interpolatedQuaternion.copy(b.quaternion);
}
/** FULL extents in, halves to CANNON. Same convention as cavStaticBox. */
/** One compound body per cluster; see the furniture note in the second-pass. */
function antPoolBody(game) {
  const b = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC,
                              material: (game.mats && game.mats.ground) || undefined });
  b.allowSleep = true;
  return b;
}
function antPoolBox(b, x, y, z, hx, hy, hz, ry) {
  const q = new CANNON.Quaternion();
  if (ry) q.setFromEuler(0, ry, 0);
  b.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)), new CANNON.Vec3(x, y, z), q);
  return b;
}
function antPoolDone(game, b) {
  if (!b.shapes.length) return null;
  antSyncBody(b);
  game.world.addBody(b);
  return b;
}
function antStaticBox(game, x, y, z, sx, sy, sz, ry) {
  const b = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
  b.addShape(new CANNON.Box(new CANNON.Vec3(sx * 0.5, sy * 0.5, sz * 0.5)));
  b.position.set(x, y, z);
  if (ry) b.quaternion.setFromEuler(0, ry, 0);
  antSyncBody(b);
  game.world.addBody(b);
  return b;
}
function antSmooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
function antTask(id) {
  const g = antGame;
  if (g && typeof g.completeTask === 'function') g.completeTask(id);
}
function antToast(s) {
  const g = antGame;
  if (g && typeof g.toast === 'function') g.toast(s);
}
/**
 * THE SAME LINE, IN THE SCHEME THE PLAYER IS HOLDING (F1).
 *
 * The tiller line is the whole control scheme of the only vehicle in a chapter
 * whose subtitle is "and you are not walking anywhere", so it is the single
 * worst string in the game to write in keycaps a device may not have.
 *
 * D5.2: this used to call `g.say(s)`. `game.say` is npc.js's
 * `sayAt(x, y, z, text)` — the sentence landed in `x`, `text` was undefined,
 * and `sayAt` returned at its own `if (!text)`. The `antToast` fallback was
 * skipped too, because `typeof g.say === 'function'` is true. So the tiller
 * line — the only instruction this chapter ever gives — had never once been
 * drawn. `game.control` is the narrow door to systems.js's substitution
 * table, whose first two rows were written for this exact sentence.
 * (The old comment said "See palSay"; there is no palSay in the tree.)
 */
function antSay(s) {
  const g = antGame;
  if (g && typeof g.control === 'function') g.control(s);
  else antToast(s);
}
function antSfx(name, opts) {
  const g = antGame;
  if (g && typeof g.sfx === 'function') g.sfx(name, opts);
}
function antRecord(id, v) {
  const g = antGame;
  if (g && typeof g.record === 'function') g.record(id, v);
}
/** The same thing while it is still happening — see recordLive in systems.js. */
function antLive(id, v) {
  const g = antGame;
  if (g && typeof g.recordLive === 'function') g.recordLive(id, v);
}

// ================================================================= TERRAIN ==
/**
 * A DOME THAT KEEPS GOING DOWN.
 *
 * Every piece of land here is one of these. The important half is what happens
 * OUTSIDE d = 1: it does not stop at zero, it carries on into the water, so
 * every shoreline in the chapter is a slope you can walk out of the sea onto
 * rather than a one-cell cliff you can only be teleported off.
 */
function antDome(x, z, cx, cz, rx, rz, peak) {
  const u = (x - cx) / rx, v = (z - cz) / rz;
  const d2 = u * u + v * v;
  if (d2 > 2.6) return -1e9;
  const d = Math.sqrt(d2);
  const cone = 0.86 * clamp(1.12 - d, 0, 1) + 0.14 * antSmooth(1.16 - d);
  return peak * (cone - 0.85 * clamp(d - 1.04, 0, 1));
}

/** The bed under the water: shallow round the point, deep down the channel. */
function antSeabed(z) {
  return -4.5 - 27 * antSmooth((34 - z) / 260);
}

/**
 * THE GLACIER, and it is one ramp.
 *
 * Height is a function of x alone over the slab, which is what makes it a fall
 * line you can point a capybara down and forget about. The toe goes a few
 * metres UNDER the water, so arriving at the bottom of a slide is a splash and
 * not a wall.
 */
function antGlacierH(x, z) {
  if (x > antGLAC.xToe + 14) return -1e9;
  if (z < antGLAC.z0 - 26 || z > antGLAC.z1 + 26) return -1e9;
  const u = clamp((antGLAC.xToe - x) / (antGLAC.xToe - antGLAC.xTop), -0.25, 1.4);
  let h = antGLAC.h * (u <= 0 ? u * 3.0 : Math.pow(u, 0.92));
  // the ends of the slab taper into the sea rather than ending in a wall
  const ez = Math.min(antSmooth((z - (antGLAC.z0 - 26)) / 28),
                      antSmooth(((antGLAC.z1 + 26) - z) / 28));
  h = h * ez + (ez - 1) * 6;
  // crevasse field: shallow, and only in the upper half, so it is texture and
  // never a hole a player can be lost in
  if (u > 0.35) {
    const s = Math.max(0, Math.sin(z * 0.09 + x * 0.02));
    h -= 0.9 * Math.pow(s, 8) * (u - 0.35) * 3;
  }
  return h;
}

function antTerrain(x, z) {
  let h = antSeabed(z);
  const stn = antDome(x, z, antSTN.x, antSTN.z, antSTN.rx, antSTN.rz, antSTN.h);
  if (stn > h) h = stn;
  const wh = antDome(x, z, antWHAL.x, antWHAL.z, antWHAL.rx, antWHAL.rz, antWHAL.h);
  if (wh > h) h = wh;
  const wb = antDome(x, z, antWBAST.x, antWBAST.z, antWBAST.rx, antWBAST.rz, antWBAST.h);
  if (wb > h) h = wb;
  const eb = antDome(x, z, antEBAST.x, antEBAST.z, antEBAST.rx, antEBAST.rz, antEBAST.h);
  if (eb > h) h = eb;
  const gl = antGlacierH(x, z);
  if (gl > h) h = gl;
  // the highway is a WORN track: 40 cm of hollow, which is what makes it read
  // as a path from above and what keeps a sliding animal in it
  if (h > antWATER) {
    const hw = antHighwayD(x, z);
    if (hw >= 0 && hw < antHIGH_W * 1.25) h -= 0.90 * antSmooth((antHIGH_W * 1.25 - hw) / 1.6);
  }
  // ...and a floe is ground while it is a floe. See the note on antFloeTop.
  const ft = antFloeTop(x, z);
  if (ft > h) h = ft;
  return h;
}

function antSlope(x, z) {
  const e = 1.6;
  const hx = antTerrain(x + e, z) - antTerrain(x - e, z);
  const hz = antTerrain(x, z + e) - antTerrain(x, z - e);
  return Math.sqrt(hx * hx + hz * hz) / (2 * e);
}

/**
 * DISTANCE TO THE PENGUIN HIGHWAY, or -1 if you are nowhere near it.
 *
 * The track is a four-point polyline and this is the ordinary segment
 * distance, walked once. It is asked by the terrain, by the slip field and by
 * the task, so it is written once and it is cheap: three segments, one square
 * root at the end, and a bounding box in front of the whole thing because it
 * is called from antTerrain and antTerrain is called from everywhere.
 */
function antHighwayD(x, z) {
  if (x < -4 || x > 40 || z < 30 || z > 104) return -1;
  let best = 1e9;
  for (let i = 0; i < 3; i++) {
    const ax = antHIGH[i * 2], az = antHIGH[i * 2 + 1];
    const bx = antHIGH[i * 2 + 2], bz = antHIGH[i * 2 + 3];
    const dx = bx - ax, dz = bz - az;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    const px = ax + dx * t - x, pz = az + dz * t - z;
    const d2 = px * px + pz * pz;
    if (d2 < best) best = d2;
  }
  return Math.sqrt(best);
}

/**
 * DISTANCE TO THE PATH THE PEOPLE HAVE WORN, or -1.
 *
 * Three segments: hut to the jetty head, hut to the rookery, hut to the bar.
 * Same shape as antHighwayD and for the same reason — it is drawn by the
 * ground mesh and nothing else asks, so it can be simple and it can be exact.
 */
const antPATH = [antHUTS.x, antHUTS.z, antJETTY.x, antJETTY.z0 - 1,
                 antHUTS.x, antHUTS.z, antCOLONY.x - 3, antCOLONY.z - 12];
function antStationPathD(x, z) {
  if (x < -30 || x > 34 || z < 12 || z > 106) return -1;
  let best = 1e9;
  for (let i = 0; i < 2; i++) {
    const ax = antPATH[i * 4], az = antPATH[i * 4 + 1];
    const bx = antPATH[i * 4 + 2], bz = antPATH[i * 4 + 3];
    const dx = bx - ax, dz = bz - az;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    const px = ax + dx * t - x, pz = az + dz * t - z;
    const d2 = px * px + pz * pz;
    if (d2 < best) best = d2;
  }
  return Math.sqrt(best);
}

// ============================================================ WATER AND ICE ==
/**
 * HOW MUCH BROKEN ICE IS ON THE WATER AT (x, z), 0..1.
 *
 * This is the chapter's map. It is drawn (the pack is 460 instanced lumps
 * whose density follows this exact field), it is felt (the tender's legs are a
 * function of it), and it is heard (she grinds). Three terms:
 *
 *   north   the shelf is up there and everything calving off it comes south
 *   west    and the wind puts what is loose against the western wall
 *   lead    a trough of open water that wanders down the middle
 *
 * The lead is what makes the crossing a piece of navigation instead of a
 * straight line. It is not marked, it is not on the minimap, and it does not
 * need to be: open water is dark and the pack is white, from a hundred metres.
 */
function antLeadX(z) {
  return 24 * Math.sin((z + 70) * 0.0069) + 14 * Math.sin((z - 40) * 0.0026) + 16;
}
function antIceAt(x, z) {
  const south = clamp((26 - z) / 46, 0, 1);
  if (south <= 0) return 0;
  const north = clamp((-z - 20) / 300, 0, 1);
  const west = clamp((-x - 30) / 150, 0, 1);
  let d = 0.30 + 0.46 * north + 0.30 * west;
  d += 0.15 * Math.sin(x * 0.021 + z * 0.013) + 0.10 * Math.sin(z * 0.037 - x * 0.0081);
  const dl = (x - antLeadX(z)) / 44;
  d *= 1 - 0.94 * Math.exp(-dl * dl);
  return clamp(d, 0, 1) * south;
}

/**
 * THE TOP OF WHATEVER FLOE YOU ARE OVER, or -1e9.
 *
 * THIS IS THE PANTANAL LESSON AND IT IS NOT OPTIONAL. capybara.js decides
 * whether the animal is swimming from isOverWater, and isOverWater is written
 * against terrainHeight — so a capybara standing on a pan of sea ice over
 * thirty metres of water is told it is IN the water unless the pan is reported
 * as ground. It was, for one build, and 'haul out on a floe' could not be
 * completed at all, because the moment you arrived you started swimming.
 *
 * The pan stops being ground `antFLOE_SOLID` inside its own edge, which is the
 * same handful of centimetres of slack that lets you wade the flooded campo.
 */
function antFloeTop(x, z) {
  if (!antFloeX) return -1e9;
  for (let i = 0; i < antFLOE_N; i++) {
    const dx = x - antFloeX[i], dz = z - antFloeZ[i];
    const r = antFloeR[i] - antFLOE_SOLID;
    if (dx * dx + dz * dz <= r * r) return antWATER + antFLOE_TOP;
  }
  return -1e9;
}
/** Which floe (index) is under (x, z), or -1. */
function antFloeAt(x, z) {
  if (!antFloeX) return -1;
  for (let i = 0; i < antFLOE_N; i++) {
    const dx = x - antFloeX[i], dz = z - antFloeZ[i];
    const r = antFloeR[i] - antFLOE_SOLID;
    if (dx * dx + dz * dz <= r * r) return i;
  }
  return -1;
}

/**
 * HOW FAST THE WATER IS GOING NORTH at z. The bay barely moves; the gate is a
 * tidal race, because a hundred and sixty metres of gap is what the whole
 * channel has to get through. This is what makes riding a floe a set piece
 * instead of a wait: you step on in still water and the world speeds up.
 */
function antDriftAt(z) {
  const g = (z - antGATE_Z) / 155;
  return 1.05 + 2.45 * Math.exp(-g * g);
}

/**
 * HOW HIGH THE SEA ACTUALLY IS AT (x, z), AND FOUR THINGS WERE FLOATING ON A
 * NUMBER RATHER THAN ON IT.
 *
 * `antUpdateSea` gives the sheet twenty-three centimetres of relief — two
 * sines, one across and one along — and everything that sits on the water was
 * written against the flat datum `antWATER` instead:
 *
 *   the wake rings at antWATER + 0.06, which is UNDER the crest of the swell
 *     for about half of every cycle, so a tender doing twelve metres a second
 *     left a wake that flickered in and out of the sea behind her;
 *   the brash at antWATER + r * 0.10, which for the small stuff (r ≈ 0.8) is
 *     eight centimetres and does the same thing;
 *   the bow spray, thrown from a fixed height;
 *   and the tender herself, who rode a THIRD, unrelated sine that agreed with
 *     the sea she was on nowhere at all.
 *
 * One function, four callers, and the whole surface of the chapter stops
 * arguing with itself. Same shape as Manly's `waterHeightAt` — see the
 * localWater note in capybara.js — except that here it is only the DRAWING
 * that needs it, because nothing swims.
 */
function antSwellAt(x, z) {
  return antWATER + Math.sin(x * 0.030 + antTime * 0.62) * 0.13
                  + Math.sin(z * 0.046 - antTime * 0.48) * 0.10;
}

function antIsOverWater(x, z) {
  return antTerrain(x, z) < antWATER - 0.22;
}
function antWaterHeightAt() { return antWATER; }

function antInZone(name, x, z) {
  if (name === 'jetty') {
    return Math.abs(x - antJETTY.x) <= antJETTY.hx + 1.4 &&
           z >= antJETTY.z1 - 1.5 && z <= antJETTY.z0 + 1.5;
  }
  if (name === 'station') {
    const u = (x - antSTN.x) / antSTN.rx, v = (z - antSTN.z) / antSTN.rz;
    return u * u + v * v < 1.05;
  }
  if (name === 'colony') {
    const dx = x - antCOLONY.x, dz = z - antCOLONY.z;
    return dx * dx + dz * dz < antCOLONY.r * antCOLONY.r;
  }
  if (name === 'whalers') {
    const u = (x - antWHAL.x) / antWHAL.rx, v = (z - antWHAL.z) / antWHAL.rz;
    return u * u + v * v < 1.05;
  }
  if (name === 'bones') {
    const dx = x - antBONES.x, dz = z - antBONES.z;
    return dx * dx + dz * dz < 25;
  }
  if (name === 'glacier') return antGlacierH(x, z) > antWATER;
  if (name === 'highway') { const d = antHighwayD(x, z); return d >= 0 && d < antHIGH_W; }
  if (name === 'deck') {
    const dx = x - antBoatX, dz = z - antBoatZ;
    const cs = Math.cos(antBoatYaw), sn = Math.sin(antBoatYaw);
    const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
    return Math.abs(lx) < antTEN_HX && Math.abs(lz) < antTEN_HZ;
  }
  return false;
}

/**
 * THE SIX FRICTIONS, AND THEY ARE PLACES.
 *
 * Read the note at the top of capybara.js before touching any of these
 * numbers: slip is linear in the speed a slide SETTLES AT, not in the damper,
 * so 0.48 really is half of 0.93 and a surface is allowed to be a BIT
 * slippery. That is the whole reason this chapter can have four of them.
 */
function antGroundSlip(x, z) {
  const gh = antGlacierH(x, z);
  if (gh > antWATER) {
    // the blue tongue: old, polished, and the only thing here with no grip at
    // all. It fades out at its own edges, so the shoulders either side of it
    // are the grippy way back to the top — a slope you cannot climb is a wall.
    if (x <= antBLUE.xIn && z >= antBLUE.z0 - 16 && z <= antBLUE.z1 + 16) {
      const e = Math.min(antSmooth((z - (antBLUE.z0 - 16)) / 18),
                         antSmooth(((antBLUE.z1 + 16) - z) / 18));
      return lerp(antSLIP_SNOW, antSLIP_BLUE, e);
    }
    return antSLIP_SNOW;
  }
  const hd = antHighwayD(x, z);
  if (hd >= 0 && hd < antHIGH_W * 1.5) {
    return lerp(antSLIP_HIGH, antSLIP_SNOW,
                clamp((hd - antHIGH_W * 0.7) / (antHIGH_W * 0.8), 0, 1));
  }
  if (antFloeAt(x, z) >= 0) return antSLIP_FLOE;
  if (antInZone('jetty', x, z)) return antSLIP_DECK;
  // the whalers' beach is black volcanic sand and it is the grippiest thing in
  // the chapter, which is exactly why the wreck is somewhere you can climb on
  if (antInZone('whalers', x, z)) return antSLIP_ROCK;
  // the station's summit is under snow; its shore is bare rock
  const h = antTerrain(x, z);
  if (h > 6.5) return antSLIP_SNOW * antSmooth((h - 6.5) / 3.5);
  return antSLIP_ROCK;
}

/**
 * ...AND THE LADDER HAS TO NAME EVERY GROUND THE SLIP TABLE NAMES.
 *
 * `antGroundSlip` above names six surfaces — rock 0, snow .18, jetty .34, floe
 * .48, penguin highway .66, blue ice .93 — and this named five. The two it left
 * out are the two the chapter is proudest of.
 *
 * The HIGHWAY is the fastest ground in the game (measured 8.8 m/s) and it runs
 * from the colony down to the water, crossing the 6.5 m snow line on the way —
 * so the footfall of a run down a single continuous path CHANGED HALFWAY DOWN
 * ITSELF, from 0.90 snow to 1.0 rock, for no reason a player could see. A
 * highway is polished by ten thousand birds a day: it is glassier than the snow
 * beside it, not the same as bare rock.
 *
 * The BLUE TONGUE shared 1.06 with the whole snow-covered glacier, which is the
 * one surface in the chapter whose entire character is that it is different
 * from the snow around it.
 */
// The material beside the pitch (L4, audio #4): the last answer, read by
// capybara.js through surfaceMat() straight after surfacePitch(). This is the
// chapter the materials were built for — four of its six grounds are ice or
// snow and every one of them played as a plank or a cobble.
let antSurfMat = 'stone';
function antSurf(p, m) { antSurfMat = m; return p; }
function antSurfacePitch(x, z, y) {
  if (antInZone('deck', x, z) && y > antWATER - 0.2) return antSurf(1.30, 'metal');   // an aluminium hull
  if (antInZone('jetty', x, z)) return antSurf(1.26, 'timber');                       // hollow timber
  if (antFloeAt(x, z) >= 0) return antSurf(1.12, 'ice');                              // sea ice is drummy
  if (antGlacierH(x, z) > antWATER) {
    // the blue tongue, on the same test antGroundSlip uses so the two tables
    // can never disagree about where it is
    if (x <= antBLUE.xIn && z >= antBLUE.z0 - 16 && z <= antBLUE.z1 + 16) return antSurf(1.34, 'ice');
    return antSurf(1.06, 'ice');
  }
  const hd = antHighwayD(x, z);
  if (hd >= 0 && hd < antHIGH_W * 1.5) return antSurf(1.22, 'ice');                   // polished guano ice
  if (antTerrain(x, z) > 6.5) return antSurf(0.90, 'snow');                           // snow
  return antSurf(1.0, 'stone');                                                       // rock
}

function antNavBlocked(x, z) { return antIsOverWater(x, z); }

// ================================================================= THE WORLD ==
function antBuild(game) {
  if (antBuilt) return;
  antBuilt = true;
  antInitGeos();

  antRoot = new THREE.Group();
  antRoot.name = 'antarctic';
  game.scene.add(antRoot);

  antBuildGround(game, antRoot);
  antBuildGroundBody(game);
  antBuildSea(antRoot);
  antBuildBergs(game, antRoot);
  antBuildStation(game, antRoot);
  antBuildWhalers(game, antRoot);
  antBuildShore(game, antRoot);
  antBuildGlacier(game, antRoot);
  antBuildGate(game, antRoot);
  antBuildFloes(game, antRoot);
  antBuildPack(antRoot);
  antBuildWake(antRoot);
  antBuildBoat(game, antRoot);
  antBuildPod(antRoot);
  antBuildBirds(antRoot);
  antBuildSeals(game, antRoot);
  antBuildCalving(antRoot);
  antBuildDrift(antRoot);
  antBuildSpray(antRoot);
  antBuildLocals(game);

  if (typeof game.registerShadowTarget === 'function') game.registerShadowTarget(antBoatGroup);
}

// ------------------------------------------------------------------ ground --
/**
 * ONE MESH FOR THE WHOLE PENINSULA.
 *
 * Sampled at 4 m, which is finer than most chapters and has to be: half of
 * what this terrain does is a 23-degree ramp, and a ramp is the one shape a
 * coarse grid turns into a staircase. Vertex colour carries the entire read —
 * rock where it is steep and low, snow where it is flat and high, blue where
 * the glacier is old, and a stain of guano across the colony, which is the one
 * thing about a penguin rookery that is visible from a mile offshore.
 */
function antBuildGround(game, root) {
  const X0 = -212, X1 = 212, Z0 = -502, Z1 = 122, EL = 4;
  const NX = Math.round((X1 - X0) / EL), NZ = Math.round((Z1 - Z0) / EL);
  const g = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0, NX, NZ);
  g.rotateX(-Math.PI / 2);
  g.translate((X0 + X1) / 2, 0, (Z0 + Z1) / 2);
  const p = g.attributes.position.array;
  const col = new Float32Array(p.length);
  const c = new THREE.Color();
  const rock = new THREE.Color(PALETTE.antRock);
  const rockLt = new THREE.Color(PALETTE.antRockLt);
  const rockDk = new THREE.Color(PALETTE.antRockDk);
  const snow = new THREE.Color(PALETTE.antIce);
  const snowLt = new THREE.Color(PALETTE.antIceLt);
  const blue = new THREE.Color(PALETTE.antBlue);
  // ...AND THE STAIN HAS TO BE MIXED DARK TO COME OUT BROWN.
  //
  // `antGuano` is 0xb98b62, which is a perfectly good mid brown as a NUMBER
  // and is not one on this ground. The lighting header in systems.js sizes
  // sunlit surfaces here at about 1.2 albedo by design, and this chapter runs
  // the highest hemisphere in the game (1.24) with a white ground bounce and
  // an ambient of 0.36 — so a mid tone is multiplied up past white and
  // saturates. Photographed from the rookery, the one thing about a gentoo
  // colony that is visible from a mile offshore came out as clean snow.
  // MEASURED: the ground mesh at the middle of the rookery carried a vertex
  // colour of (0.48, 0.43, 0.39) and rendered as clean snow, while the
  // whalers beach at (0.04, 0.04, 0.04) rendered as the black shingle it is —
  // so on this ground anything much over about 0.25 of albedo saturates. At
  // 28 % the stain lands around 0.24 and comes out the warm dirty brown the
  // number always meant. The falloff is squarer as well, so it covers the
  // colony rather than a disc in the middle of it.
  const guano = new THREE.Color(PALETTE.antGuano).multiplyScalar(0.38);
  const scree = new THREE.Color(PALETTE.antScree);
  const shade = new THREE.Color(PALETTE.antIceSh);
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i], z = p[i + 2];
    // NOTE: the drawn ground must NOT include the floes — they move, and a
    // static mesh with a floe baked into it is a hole in the sea the moment
    // that floe drifts away. antTerrain reports them; this samples land alone.
    const h = antLandOnly(x, z);
    p[i + 1] = h;
    const sl = antSlope(x, z);
    const gh = antGlacierH(x, z);
    if (gh > antWATER - 1.5) {
      // the glacier: white on top, blue where it has been polished, and it is
      // bluest exactly where the tongue is, which is also where it is fastest
      const bl = (x <= antBLUE.xIn && z >= antBLUE.z0 - 16 && z <= antBLUE.z1 + 16)
        ? Math.min(antSmooth((z - (antBLUE.z0 - 16)) / 18), antSmooth(((antBLUE.z1 + 16) - z) / 18))
        : 0;
      c.copy(snowLt).lerp(blue, bl * 0.78);
      c.lerp(rockDk, clamp((sl - 0.55) * 0.5, 0, 0.22));
    } else if (h < antWATER + 0.3) {
      c.copy(rockDk).lerp(scree, antSmooth((h + 8) / 9));
    } else {
      // snow above the line and where it is flat; rock where it is steep.
      // ...EXCEPT ON THE WHALERS' BEACH, which is bare basalt right over the
      // top of its own dome (`antWHAL.h` is only 8 m and the snow line is at
      // 4.5, so the general rule buried the one dark landform in the chapter
      // under snow from the strandline up). See the note further down.
      const wu0 = (x - antWHAL.x) / antWHAL.rx, wv0 = (z - antWHAL.z) / antWHAL.rz;
      const wsup = clamp((1.14 - Math.sqrt(wu0 * wu0 + wv0 * wv0)) / 0.26, 0, 1);
      const sn = clamp(antSmooth((h - 4.5) / 7) * (1 - clamp((sl - 0.42) / 0.5, 0, 1)), 0, 1)
               * (1 - wsup * 0.94);
      c.copy(rock).lerp(rockLt, antSmooth((h - 1) / 12) * 0.7);
      c.lerp(snow, sn);
    }
    // ---- THE WHALERS' BEACH IS BLACK, AND IT WAS WHITE --------------------
    //
    // `antGroundSlip` has said since the chapter shipped that this beach is
    // "black volcanic sand and it is the grippiest thing in the chapter, which
    // is exactly why the wreck is somewhere you can climb on" — and the ground
    // mesh painted it with the same snow-above-4.5-metres rule as everywhere
    // else, so the one dark landform in a world made entirely of white things
    // came out as another white dome. Photographed from the bones, the place a
    // hundred and ten blue whales were cut up in one season is a pale grey
    // slope. It is a beach of basalt shingle: it is nearly black, it is coarse
    // (so it is mottled rather than flat), and the drift only lies on it above
    // the storm line.
    {
      const wu = (x - antWHAL.x) / antWHAL.rx, wv = (z - antWHAL.z) / antWHAL.rz;
      const wd = Math.sqrt(wu * wu + wv * wv);
      // NOT GATED ON HEIGHT. The first cut faded this out above 7.2 m — and
      // the dome PEAKS at 8, so the term was clamped to zero over most of the
      // beach and the whole thing photographed grey again.
      const wk = clamp((1.12 - wd) / 0.26, 0, 1);
      if (wk > 0.002 && h > antWATER - 3) {
        const grit = 0.5 + 0.5 * Math.sin(x * 0.9 + z * 0.55)
                         * Math.sin(z * 0.71 - x * 0.33);
        c.lerp(rockDk, wk * 0.92);
        c.lerp(scree, wk * grit * 0.34);
      }
    }
    // ---- THE TRACK, and it goes UNDER the stain now ----------------------
    // Order matters and it was the wrong way round. `antHIGH` starts AT the
    // middle of the rookery — [24, 92] is antCOLONY exactly — so a five-metre
    // stripe of `antIceSh` (0xb4cbd6, a cool pale blue) was painted over the
    // strongest part of the guano and then never repainted. MEASURED off the
    // ground mesh: the colony centre carried (0.448, 0.558, 0.614), which is
    // ice-shade with a hint of brown in it, in the one place in the chapter
    // that is supposed to be brown. Below the sea a gentoo highway is polished
    // blue snow; through a rookery it is polished GUANO, and it is the dirtiest
    // strip of ground on the continent.
    const hd = antHighwayD(x, z);
    if (hd >= 0 && hd < antHIGH_W * 1.5 && h > antWATER) {
      c.lerp(shade, antSmooth(1 - hd / (antHIGH_W * 1.5)) * 0.85);
    }
    // ---- AND THE STAIN, WHICH IS THE POINT OF A ROOKERY ------------------
    //
    // MEASURED, and it is the fourth time this chapter has hidden something in
    // plain sight. The falloff was `1 - d / (r * 1.35)` — LINEAR from the
    // exact centre — so a bird standing nine metres out (which is most of
    // them; the nests fill 0.94 of the radius) sat on gk = 0.45, and after
    // `pow(1.2)` and the blotch that is about a quarter of the way from snow
    // to brown. Sampled off the mesh: (0.675, 0.721, 0.723) nine metres out
    // and (0.722, 0.783, 0.792) at the rim — that is white, twice. Photographed
    // from the rig, a hundred and seventy gentoos and a hundred and thirty-six
    // nests are standing on clean plaster.
    //
    // A colony stain is not a radial gradient. It is FLAT across the ground the
    // birds actually stand on and it stops, more or less, where they do — so
    // this is a plateau out to the nest field with ten metres of ragged edge
    // on it, and the edge is ragged at two different sizes because that is
    // what makes it read as a stain rather than as a painted disc.
    const dcx = x - antCOLONY.x, dcz = z - antCOLONY.z;
    const dCol = Math.sqrt(dcx * dcx + dcz * dcz);
    if (dCol < antCOLONY.r * 1.9 && h > antWATER) {
      // ragged at the edge: the wobble is on the RADIUS, so the outline is
      // lobed rather than circular
      const wob = 1.5 * Math.sin(Math.atan2(dcz, dcx) * 3.1 + 0.7)
                + 0.9 * Math.sin(Math.atan2(dcz, dcx) * 7.3 - 2.1);
      // FLAT to the edge of the nest field, then out over eight and a half
      // metres. Written as `(r*0.98 - d)/10` the plateau only reached 6.7 m
      // and it was the same gradient as before by another name — measured at
      // (0.781, 0.855, 0.869) nine metres out, which is whiter than the bug it
      // replaced. R_out and the width, not R_in and a slope.
      const gk = clamp((antCOLONY.r * 1.52 + wob - dCol) / 9.5, 0, 1);
      if (gk > 0) {
        // blotchy at two sizes: the size of a nest, and the size of a group
        const mot = (0.72 + 0.28 * Math.sin(x * 0.42 + z * 0.31) * Math.sin(z * 0.55 - x * 0.19))
                  * (0.84 + 0.16 * Math.sin(x * 0.13 - z * 0.09));
        c.lerp(guano, antSmooth(gk) * 0.97 * mot);
      }
    }
    // ...AND THE PEOPLE HAVE WORN ONE TOO. The penguins got a track drawn into
    // the hill and the nine humans who live here did not, so the station apron
    // photographed as two hundred square metres of undifferentiated white with
    // three huts standing on it. Two hundred days of walking between a hut, a
    // jetty and a rookery leaves exactly this, and it is the same three lines
    // of code the highway already uses.
    const sd = antStationPathD(x, z);
    if (sd >= 0 && sd < 2.6 && h > antWATER) {
      c.lerp(shade, antSmooth(1 - sd / 2.6) * 0.55);
    }
    col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, antVCI());
  m.receiveShadow = true;
  m.frustumCulled = false;
  root.add(m);
}

/** antTerrain minus the floes. See the note in antBuildGround. */
function antLandOnly(x, z) {
  let h = antSeabed(z);
  const stn = antDome(x, z, antSTN.x, antSTN.z, antSTN.rx, antSTN.rz, antSTN.h);
  if (stn > h) h = stn;
  const wh = antDome(x, z, antWHAL.x, antWHAL.z, antWHAL.rx, antWHAL.rz, antWHAL.h);
  if (wh > h) h = wh;
  const wb = antDome(x, z, antWBAST.x, antWBAST.z, antWBAST.rx, antWBAST.rz, antWBAST.h);
  if (wb > h) h = wb;
  const eb = antDome(x, z, antEBAST.x, antEBAST.z, antEBAST.rx, antEBAST.rz, antEBAST.h);
  if (eb > h) h = eb;
  const gl = antGlacierH(x, z);
  if (gl > h) h = gl;
  if (h > antWATER) {
    const hw = antHighwayD(x, z);
    if (hw >= 0 && hw < antHIGH_W * 1.25) h -= 0.90 * antSmooth((antHIGH_W * 1.25 - hw) / 1.6);
  }
  return h;
}

/**
 * MIND WHICH WAY THE SECOND AXIS RUNS — the heightfield trap, written out in
 * rio.js and re-learnt twice since. A CANNON Heightfield is authored in its own
 * xy plane and the Rx(-90 deg) that stands it up maps local +y onto world MINUS
 * z, so the body is anchored at the FAR z edge and j walks back toward Z0.
 *
 * Five-metre cells over the whole world, which is coarser than the drawn mesh
 * (4 m) and costs nothing where it matters: the glacier is LINEAR in x, and
 * linear interpolation of a linear ramp is exact at any cell size. The curved
 * things — the station dome, the two bastions — are off by centimetres.
 */
function antBuildGroundBody(game) {
  const NX = 85, NZ = 125, X0 = -212, Z0 = -502, EL = 5;
  const Z1 = Z0 + NZ * EL;
  const data = [];
  for (let i = 0; i <= NX; i++) {
    const row = [];
    for (let j = 0; j <= NZ; j++) row.push(antLandOnly(X0 + i * EL, Z1 - j * EL));
    data.push(row);
  }
  const hf = new CANNON.Heightfield(data, { elementSize: EL });
  const b = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
  b.addShape(hf);
  b.position.set(X0, 0, Z1);
  b.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  antSyncBody(b);
  game.world.addBody(b);
}

// --------------------------------------------------------------------- sea --
/**
 * THE SEA, AND WHY ITS COLOUR IS THE MINIMAP.
 *
 * Vertex colour here is a straight read-out of `antIceAt` — dark where the
 * water is open, white where the pack is thick. That is not decoration: it is
 * the only navigation aid in the chapter, and it is the reason the lead can be
 * found by looking rather than by being told. The 460 instanced lumps on top of
 * it are the same field again, so what you see from ten metres and what you see
 * from a hundred agree.
 */
function antBuildSea(root) {
  // SIXTY-SIX BY NINETY-TWO, NOT EIGHTY-FOUR BY A HUNDRED AND EIGHTEEN. Every
  // term this sheet carries is long: the swell has a period of two hundred
  // metres, the ice field a hundred and seventy, and the narrowest feature on
  // it is the lead at forty-four across. Six-and-a-half-metre cells hold all
  // of that exactly, and the sheet drops from twenty thousand triangles to
  // twelve — which is what pays for the pack that floats on it. Same argument
  // as the Pantanal flood sheet, and nothing about it looks different.
  const g = new THREE.PlaneGeometry(antSEA_X1 - antSEA_X0, antSEA_Z1 - antSEA_Z0, 66, 92);
  g.rotateX(-Math.PI / 2);
  g.translate((antSEA_X0 + antSEA_X1) / 2, antWATER, (antSEA_Z0 + antSEA_Z1) / 2);
  const p = g.attributes.position.array;
  const col = new Float32Array(p.length);
  const c = new THREE.Color();
  const near = new THREE.Color(PALETTE.antSeaLt);
  const deep = new THREE.Color(PALETTE.antSeaDeep);
  const brash = new THREE.Color(PALETTE.antBrash);
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i], z = p[i + 2];
    const d = clamp((antWATER - antSeabed(z)) / 30, 0, 1);
    c.copy(near).lerp(deep, antSmooth(d));
    c.lerp(brash, antIceAt(x, z) * 0.80);
    col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  // `fresnel` is the horizon — see skyTick in shared.js. This sea carries no
  // sparkle (opaque, by design, so the pack can sit on it) and until the
  // beauty pass it was the one flat sheet in the chapter; now the far channel
  // goes to the colour of the sky the way the near water does not.
  // ...AND THE SEA BETWEEN THE FLOES IS A MIRROR (ROADMAP-WOW A1): the pack,
  // the glacier face, the jetty and the boat doubled in the black water,
  // which is what a polar sea in still air does better than any other water
  // in the game — cold, dark, and flat between the swells. The sheet's own
  // swell (antSwellAt, 0.23 m) bends the sample per facet; out in the lead it
  // is nearly still. sysREFLECT.antarctic carries the plane at antWATER (a
  // constant: this chapter has no tide). Never clone this material after
  // this call: the clone drops the hook.
  const m = new THREE.Mesh(g, grain(mat(0xffffff, { vertexColors: true }),
                                    { scale: 0.06, amount: 0.05, warp: 1.1, fresnel: 0.55,
                                      reflect: { k: 1.0, pow: 1.0, wobble: 1.0, blur: 0 } }));
  m.frustumCulled = false;
  m.receiveShadow = true;
  antSeaMesh = m;
  antSeaAttr = g.attributes.position;
  root.add(m);
}

/** The brash itself: 460 lumps, distributed by antIceAt, on one draw call. */
function antBuildPack(root) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const m = new THREE.InstancedMesh(geo, mat(PALETTE.antBrash, { flatShading: true }), antPACK_N);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.receiveShadow = true;
  m.frustumCulled = false;
  // ...AND IT IS NOT ALL ONE WHITE. `antBrashDk` has been in the palette since
  // the chapter shipped with a comment saying what it is for and has never
  // been used once: brash is broken ice, so a third of every lump is the face
  // that has rolled over and is wet, and a field of fourteen hundred boxes all
  // painted 0xd3e3e8 is a field of sugar cubes. One vertex colour per
  // instance, which costs nothing and is the difference between ice and paper.
  const cols = new Float32Array(antPACK_N * 3);
  antPackData = new Float32Array(antPACK_N * 5);
  let n = 0, guard = 0;
  while (n < antPACK_N && guard++ < antPACK_N * 60) {
    const x = rand(antSEA_X0 + 10, antSEA_X1 - 10);
    const z = rand(antSEA_Z0 + 10, 24);
    const d = antIceAt(x, z);
    if (Math.random() > d * d) continue;
    if (antLandOnly(x, z) > antWATER - 0.5) continue;
    const o = n * 5;
    antPackData[o] = x;
    antPackData[o + 1] = z;
    // ...and the SIZES sort themselves the way a real pack does: a lot of
    // small stuff everywhere and the big pans only where it is thick.
    antPackData[o + 2] = rand(0.8, 2.6) * (0.6 + d * 1.2) * (Math.random() < 0.14 ? 2.1 : 1);
    antPackData[o + 3] = rand(0, 6.28);
    antPackData[o + 4] = rand(0, 6.28);
    antCol.set(Math.random() < 0.34 ? PALETTE.antBrashDk : PALETTE.antBrash);
    if (Math.random() < 0.10) antCol.set(PALETTE.antBlue);
    cols[n * 3] = antCol.r; cols[n * 3 + 1] = antCol.g; cols[n * 3 + 2] = antCol.b;
    n++;
  }
  m.instanceColor = new THREE.InstancedBufferAttribute(cols, 3);
  // whatever is left over is parked at a zero scale rather than at the origin,
  // where it would be a pile of ice cubes on the station's doorstep
  for (let i = n; i < antPACK_N; i++) {
    const o = i * 5;
    antPackData[o] = 0; antPackData[o + 1] = 0; antPackData[o + 2] = 0;
  }
  antPackMesh = m;
  antSyncPack();
  root.add(m);
}

let antPackDt = 0;
function antSyncPack() {
  if (!antPackMesh) return;
  for (let i = 0; i < antPACK_N; i++) {
    const o = i * 5;
    const r = antPackData[o + 2];
    if (r <= 0) { antPackMesh.setMatrixAt(i, antXform(0, -900, 0, 0, 0, 0, 0.001, 0.001, 0.001)); continue; }
    antPackData[o + 1] -= antDriftAt(antPackData[o + 1]) * 0.55 * antPackDt;
    if (antPackData[o + 1] < antSEA_Z0 + 6) antPackData[o + 1] = 22 + rand(0, 14);
    const bob = Math.sin(antTime * 0.75 + antPackData[o + 4]) * 0.06;
    antPackMesh.setMatrixAt(i, antXform(antPackData[o], antSwellAt(antPackData[o], antPackData[o + 1]) + r * 0.10 + bob, antPackData[o + 1],
                                        0, antPackData[o + 3] + antTime * 0.03, 0,
                                        r, r * 0.40, r * 0.78));
  }
  antPackMesh.instanceMatrix.needsUpdate = true;
}

// ------------------------------------------------------------------- bergs --
/**
 * THE BIG BERG, AND THE ARCH THROUGH IT.
 *
 * The arch is a hole between three static boxes rather than a carved shape:
 * two piers and a lintel. That is the only way to get a passage a boat can go
 * through and a solid thing everywhere else, and it means the drawn thing and
 * the solid thing are literally the same numbers, which is the trap in the
 * contract's extents note.
 */
function antBuildBergs(game, root) {
  const M = antMerger();
  const B = antBERG;
  const lt = PALETTE.antBergLt, bl = PALETTE.antBlue;
  const y0 = antWATER - 2.4;
  const half = (B.hx - B.archW / 2) / 2;
  for (let s = -1; s <= 1; s += 2) {
    const cx = B.x + s * (B.archW / 2 + half);
    M.box(cx, y0 + B.top / 2, B.z, half * 2, B.top, B.hz * 2, lt);
    M.box(cx, y0 + B.top - 0.6, B.z, half * 2 - 1.2, 1.4, B.hz * 2 - 1.4, PALETTE.antIceLt);
    M.box(cx, y0 + 1.2, B.z, half * 2 + 0.6, 2.4, B.hz * 2 + 0.6, bl);
    antStaticBox(game, cx, y0 + B.top / 2, B.z, half * 2, B.top, B.hz * 2);
  }
  M.box(B.x, y0 + B.archH + (B.top - B.archH) / 2, B.z, B.archW, B.top - B.archH, B.hz * 2, lt);
  antStaticBox(game, B.x, y0 + B.archH + (B.top - B.archH) / 2, B.z,
               B.archW, B.top - B.archH, B.hz * 2);
  // ...and the arch's own soffit, which is where the blue lives
  M.box(B.x, y0 + B.archH - 0.3, B.z, B.archW - 0.8, 0.7, B.hz * 2 - 1.0, PALETTE.antBlueDeep);

  // Five smaller bergs, purely to give the channel a middle distance. They are
  // SOLID: a growler you can drive straight through is worse than no growler.
  const small = antSMALL;
  for (let i = 0; i < small.length; i++) {
    const x = small[i][0], z = small[i][1], hx = small[i][2], hz = small[i][3], top = small[i][4];
    M.box(x, y0 + top / 2, z, hx * 2, top, hz * 2, lt, 0, rand(-0.4, 0.4), 0);
    M.box(x, y0 + top - 0.5, z, hx * 1.6, 1.2, hz * 1.6, PALETTE.antIceLt);
    M.box(x, y0 + 1.0, z, hx * 2.1, 2.0, hz * 2.1, bl);
    antStaticBox(game, x, y0 + top / 2, z, hx * 2, top, hz * 2);
  }

  // The shelf at the north end: the wall the world stops at. Deliberately NOT a
  // collider — the boat is clamped well short of it and nothing else ever gets
  // there, so thirty-two static boxes would be thirty-two bodies for a horizon.
  for (let x = antSEA_X0; x < antSEA_X1; x += 26) {
    M.box(x + 13, y0 + 11, antSEA_Z0 + 8, 26, 22, 22, lt);
    M.box(x + 13, y0 + 1.4, antSEA_Z0 - 3, 26, 3.0, 8, bl);
  }
  const mesh = new THREE.Mesh(M.build(), antVCI());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  root.add(mesh);
}

/** The floes: fifteen kinematic pans of sea ice, and they go somewhere. */
function antBuildFloes(game, root) {
  antFloeX = new Float32Array(antFLOE_N);
  antFloeZ = new Float32Array(antFLOE_N);
  antFloeR = new Float32Array(antFLOE_N);
  antFloePh = new Float32Array(antFLOE_N);
  antFloeTX = new Float32Array(antFLOE_N);
  antFloeTZ = new Float32Array(antFLOE_N);
  antFloeBodies = [];

  const F = antMerger();
  F.cyl(0, -0.28, 0, 0.50, 0.56, PALETTE.antBergSh, 0, 0, 0, 12);   // the draught
  F.cyl(0, 0.02, 0, 0.50, 0.30, PALETTE.antIceSh, 0, 0, 0, 12);     // the rim at the waterline
  F.cyl(0, 0.14, 0, 0.46, 0.14, PALETTE.antIceLt, 0, 0.3, 0, 9);    // the snow on top
  // ...and a low pressure ridge across it, because sea ice is never flat:
  // it is broken and refrozen, and the ridge is what says so from above.
  F.box(0, 0.24, 0.10, 0.86, 0.16, 0.13, PALETTE.antIceLt, 0, 0.42, 0);
  F.box(-0.14, 0.23, -0.20, 0.52, 0.12, 0.11, PALETTE.antIce, 0, -0.7, 0);
  const geo = F.build();
  const m = new THREE.InstancedMesh(geo, antVCI(), antFLOE_N);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.castShadow = true;
  m.receiveShadow = true;
  m.frustumCulled = false;

  for (let i = 0; i < antFLOE_N; i++) {
    // Laid down the fairway rather than scattered: they are a chain of
    // stepping stones from the bay to the gate, which is what makes 'ride one
    // down the channel' something a player finds by accident and then does on
    // purpose.
    const t = i / (antFLOE_N - 1);
    const z = lerp(-14, -458, t) + rand(-15, 15);
    const x = antLeadX(z) + rand(-50, 50);
    antFloeX[i] = x; antFloeZ[i] = z;
    antFloeR[i] = i === antSealFloe ? 9.5 : rand(5.4, 11.0);
    antFloePh[i] = rand(0, 6.28);
    antFloeTX[i] = x; antFloeTZ[i] = z;

    const b = new CANNON.Body({
      mass: 0, type: CANNON.Body.KINEMATIC,
      material: (game.mats && game.mats.ground) || undefined,
    });
    // A CYLINDER, not a box: a pan you can walk onto from any bearing, and the
    // 0.7 m of draught means a capybara that misses the edge falls in the sea
    // rather than being launched off a wall.
    b.addShape(new CANNON.Cylinder(antFloeR[i], antFloeR[i], 0.7, 9));
    // ...AND THE ONE WITH THE LEOPARD SEAL ON IT HAS A SEAL ON IT.
    //
    // Three metres of the only thing at sixty-five south that nobody is
    // relaxed about, and a capybara walked through the middle of it. It cannot
    // be a static box like the Weddell on the beach, because this floe is a
    // KINEMATIC carrier and it goes down the channel — so the seal is a second
    // shape on the pan's own body and it goes wherever the pan goes, for free.
    // Offset in the pan's local frame, which is the same frame the drawn
    // animal sits in at the centre.
    if (i === antSealFloe) {
      // ROUGHLY ROUND, because the animal TURNS to watch you and the pan does
      // not: a 3.7 m box that stays axis-aligned under a seal that swings
      // through ninety degrees is solid in the wrong place half the time.
      // The barrel of it is solid at any bearing; the head and the tail are
      // not, and nobody will ever notice which.
      b.addShape(new CANNON.Box(new CANNON.Vec3(1.05, 0.42, 1.05)),
                 new CANNON.Vec3(0, 0.72, 0));
    }
    b.position.set(x, antWATER + antFLOE_TOP - 0.35, z);
    // RULE 1: a sleeping body is skipped in narrowphase, and a floor that stops
    // existing is the worst bug in this game.
    b.allowSleep = false;
    antSyncBody(b);
    game.world.addBody(b);
    antFloeBodies.push(b);
  }
  antFloeMesh = m;
  antSyncFloeMatrices();
  root.add(m);
}

function antSyncFloeMatrices() {
  if (!antFloeMesh) return;
  for (let i = 0; i < antFLOE_N; i++) {
    const r = antFloeR[i];
    const bob = Math.sin(antTime * 0.6 + antFloePh[i]) * 0.05;
    // the unit shape has its snow top at +0.21, so the pan floats with
    // antFLOE_TOP of freeboard whatever its radius
    antFloeMesh.setMatrixAt(i, antXform(antFloeX[i], antWATER + antFLOE_TOP - 0.21 + bob, antFloeZ[i],
                                        Math.sin(antTime * 0.5 + antFloePh[i]) * 0.012,
                                        antFloePh[i],
                                        Math.cos(antTime * 0.43 + antFloePh[i]) * 0.012,
                                        r * 2, 1.0, r * 2));
  }
  antFloeMesh.instanceMatrix.needsUpdate = true;
}

// ------------------------------------------------------------------- wake ---
function antBuildWake(root) {
  const g = new THREE.RingGeometry(0.66, 1.0, 16, 1);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.InstancedMesh(g, mat(PALETTE.antFoam, {
    transparent: true, opacity: 0.42, depthWrite: false,
  }), antWakeN);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.frustumCulled = false;
  m.renderOrder = 2;
  m.material.opacity = 0.24;
  for (let i = 0; i < antWakeN; i++) {
    antWakeL[i] = 1e9;
    m.setMatrixAt(i, antXform(0, -900, 0, 0, 0, 0, 0.01, 0.01, 0.01));
  }
  m.instanceMatrix.needsUpdate = true;
  antWakeMesh = m;
  root.add(m);
}

// ---------------------------------------------------------------- station ---
/**
 * THE STATION, and every building in it is SOLID.
 *
 * See the walk-through-buildings audit: five separate chapters shipped a loop
 * that drew a building and did not carry the line that made it solid. Every
 * `M.box` below that is taller than about a metre and a half has an
 * `antStaticBox` on the same numbers, hoisted into locals where the size is
 * computed, so the seen thing and the solid thing cannot drift apart.
 */
function antBuildStation(game, root) {
  const M = antMerger();
  const h0 = antLandOnly(antHUTS.x, antHUTS.z);

  // --- the huts. Three, red, on stilts, because everything down here is on
  // stilts so the drift blows under it instead of burying it.
  const huts = [
    { x: antHUTS.x, z: antHUTS.z, w: 9.0, d: 6.0, hh: 3.2, bar: true },
    { x: antHUTS.x - 13, z: antHUTS.z + 7, w: 6.4, d: 5.0, hh: 2.8, bar: false },
    { x: antHUTS.x - 11, z: antHUTS.z - 8, w: 5.2, d: 4.4, hh: 2.6, bar: false },
  ];
  for (let i = 0; i < huts.length; i++) {
    const H = huts[i];
    const gy = antLandOnly(H.x, H.z);
    const fy = gy + 0.85;                       // the floor, on its stilts
    for (let sx = -1; sx <= 1; sx += 2) {
      for (let sz = -1; sz <= 1; sz += 2) {
        M.box(H.x + sx * (H.w / 2 - 0.5), gy + 0.42, H.z + sz * (H.d / 2 - 0.5),
              0.32, 0.9, 0.32, PALETTE.antTimber);
      }
    }
    M.box(H.x, fy - 0.1, H.z, H.w, 0.30, H.d, PALETTE.antTimber);
    M.box(H.x, fy + H.hh / 2, H.z, H.w, H.hh, H.d, PALETTE.antHutRed);
    // the roof: a shallow gable, two slabs, so it is not a flat lid from above
    M.box(H.x, fy + H.hh + 0.42, H.z - H.d * 0.25, H.w + 0.5, 0.34, H.d * 0.60,
          PALETTE.antHutRoof, -0.20, 0, 0);
    M.box(H.x, fy + H.hh + 0.42, H.z + H.d * 0.25, H.w + 0.5, 0.34, H.d * 0.60,
          PALETTE.antHutRoof, 0.20, 0, 0);
    // two windows on the north face, and they are LIT, because it is the only
    // warm thing for eleven hundred metres.
    //
    // ...AND THEY WERE NOT LIT. A box painted `antWindow` in a merged Lambert
    // mesh, under an ambient of 0.36 and a hemisphere of 1.24 with a white
    // ground bounce, is a slightly yellow rectangle — it does not glow, it
    // does not bloom (the chapter runs the highest bright-pass threshold in
    // the game precisely so that white things do not), and it puts out no
    // light. Photographed from the apron, the three huts are plain red boxes.
    // An emissive pane on its own node and one small warm point source apiece
    // is the difference between a shed and somewhere nine people are sitting.
    for (let w = -1; w <= 1; w += 2) {
      const wx = H.x + w * H.w * 0.24, wz = H.z - H.d / 2 - 0.03;
      const pane = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.85, 0.10),
                                  antGlow(PALETTE.antWindow, 1.9));
      pane.position.set(wx, fy + H.hh * 0.62, wz);
      root.add(pane);
      // the frame round it, so the glow has an edge and reads as a WINDOW
      M.box(wx, fy + H.hh * 0.62, wz + 0.02, 1.24, 1.04, 0.08, PALETTE.antTimber);
      const L = new THREE.PointLight(PALETTE.antWindow, 1.15, 11, 1.6);
      L.position.set(wx, fy + H.hh * 0.62, wz - 0.5);
      root.add(L);
      antWinLight.push(L);
      antWinPane.push(pane);
    }
    // ---- AND THE DRIFT IS PILED AGAINST IT --------------------------------
    // Everything down here is on stilts so the drift blows UNDER it, which
    // this file already knows and says — and there was no drift. A hut in a
    // katabatic wind grows a tail of snow downwind of itself within a day, and
    // it is the one thing that says the wind is a permanent condition rather
    // than weather. Downwind is +x here, which is the way the flag line
    // streams and the spindrift blows.
    //
    // SPHERES, NOT BOXES. Five flat boxes stepping downwind photographed as a
    // stack of white paper with a hard edge on every layer — which is the
    // failure the sastrugi, the moss cushions and the lily rims have all had
    // in this codebase already. A drift is an AERODYNAMIC shape: it has no
    // edges anywhere, it is long and low and it tapers to nothing, and a
    // squashed six-by-four sphere is exactly that for eighteen triangles.
    for (let k = 0; k < 6; k++) {
      const t = k / 5;
      M.sph(H.x + H.w * 0.5 + 1.4 + t * 6.5, gy + 0.10,
            H.z + Math.sin(k * 1.7) * 1.1,
            3.4 - t * 2.0, 0.62 - t * 0.34, H.d * (0.62 - t * 0.24),
            k % 2 ? PALETTE.antIceLt : PALETTE.antIce, 6);
    }
    // ...and a smaller one on the windward side, scoured out at the corners
    M.sph(H.x - H.w * 0.5 - 0.9, gy + 0.06, H.z, 1.5, 0.34, H.d * 0.44,
          PALETTE.antIce, 6);
    // the door, on the lee side
    M.box(H.x, fy + 1.0, H.z + H.d / 2 + 0.04, 1.0, 2.0, 0.12, PALETTE.antTimber);
    // steps up to it — a capybara steps 0.4 m, and the floor is 0.85 up
    M.box(H.x, fy - 0.42, H.z + H.d / 2 + 0.55, 1.4, 0.30, 1.0, PALETTE.antTimber);
    antStaticBox(game, H.x, fy + H.hh / 2, H.z, H.w, H.hh + 1.0, H.d);
  }

  // --- the mast, the wind vane and the fuel drums
  const mx = antHUTS.x - 5, mz = antHUTS.z + 28;
  const my = antLandOnly(mx, mz);
  M.cyl(mx, my + 6.5, mz, 0.22, 13, PALETTE.antMast, 0, 0, 0, 8);
  antStaticBox(game, mx, my + 6.5, mz, 0.9, 13, 0.9);
  for (let i = 0; i < 3; i++) {
    M.box(mx, my + 4.4 + i * 2.6, mz, 3.4, 0.14, 0.14, PALETTE.antMast);
  }
  // ONE COMPOUND BODY FOR THE YARD. Seven fuel drums, the sledge and the bar's
  // two lamp posts: a 200-litre drum is 84 cm across and 90 cm high, which is
  // precisely the size the second-pass memory calls out — too tall to step
  // over (the animal manages 0.40) and too small to read as a wall. Nine
  // pieces of furniture, one broadphase entry.
  const bY = antPoolBody(game);
  for (let i = 0; i < 7; i++) {
    const dx = antHUTS.x - 6 + (i % 4) * 1.5, dz = antHUTS.z + 15 + Math.floor(i / 4) * 1.6;
    const dy = antLandOnly(dx, dz);
    M.cyl(dx, dy + 0.45, dz, 0.42, 0.9, i === 2 ? PALETTE.antHull : PALETTE.antDrum,
          0, rand(0, 3), 0, 8);
    antPoolBox(bY, dx, dy + 0.45, dz, 0.40, 0.45, 0.40);
  }
  // the sledge, which is the only thing here anybody actually uses
  const sy = antLandOnly(antHUTS.x + 5, antHUTS.z + 16);
  M.box(antHUTS.x + 5, sy + 0.34, antHUTS.z + 16, 1.3, 0.12, 3.4, PALETTE.antTimber, 0, 0.4, 0);
  for (let s = -1; s <= 1; s += 2) {
    M.box(antHUTS.x + 5 + s * 0.55, sy + 0.14, antHUTS.z + 16, 0.16, 0.28, 3.6,
          PALETTE.antMast, 0, 0.4, 0);
  }
  // ...and the sledge is a LOW step, not a wall: 40 cm, which is exactly what
  // a capybara clears, so it is a thing you get on rather than go round
  antPoolBox(bY, antHUTS.x + 5, sy + 0.20, antHUTS.z + 16, 0.72, 0.20, 1.8, 0.4);

  // --- THE MUG. The southernmost bar on earth is a real thing and it is in a
  // hut exactly this size; you get in by handing over a bra, which is not a
  // mechanic this game is going to build, so the price here is being a rodent.
  const bar = huts[0];
  const bz = bar.z - bar.d / 2 - 1.5;                 // a step out from the north wall
  const bgy = antLandOnly(bar.x, bz);
  // the counter: a plank on two drums, and it is 0.95 m high, which is a bar
  M.box(bar.x, bgy + 0.98, bz, 5.4, 0.16, 0.85, PALETTE.antTimber);
  for (let sx = -1; sx <= 1; sx += 2) {
    M.cyl(bar.x + sx * 2.1, bgy + 0.45, bz, 0.42, 0.9, PALETTE.antDrum, 0, 0, 0, 8);
  }
  M.box(bar.x, bgy + 0.55, bz - 0.30, 5.0, 0.80, 0.20, PALETTE.antHullDk);
  // a lamp on a post at each end, which is the only thing standing up here
  for (let sx = -1; sx <= 1; sx += 2) {
    M.cyl(bar.x + sx * 2.9, bgy + 1.1, bz + 0.1, 0.07, 2.2, PALETTE.antMast, 0, 0, 0, 6);
    M.box(bar.x + sx * 2.9, bgy + 2.28, bz + 0.1, 0.26, 0.22, 0.24, PALETTE.antWindow);
    antPoolBox(bY, bar.x + sx * 2.9, bgy + 1.1, bz + 0.1, 0.13, 1.1, 0.13);
    // AND THEY ARE REAL LIGHTS. Two bulbs at the southernmost bar on earth,
    // and the chapter has drawn them as `antWindow`-coloured boxes since it
    // shipped without either of them putting out a photon — in the flattest,
    // coldest light in the game, where one warm point source at head height is
    // worth more than any amount of geometry.
    const L = new THREE.PointLight(PALETTE.antWindow, 1.5, 15, 1.5);
    L.position.set(bar.x + sx * 2.9, bgy + 2.28, bz + 0.1);
    root.add(L);
  }
  // four bottles, a lamp and a stack of enamel mugs
  for (let i = 0; i < 4; i++) {
    M.cyl(bar.x - 1.9 + i * 0.42, bgy + 1.22, bz - 0.18, 0.065, 0.32,
          i === 2 ? PALETTE.antDrum : PALETTE.antHullDk, 0, 0, 0, 6);
  }
  // and a board with the only price list south of sixty
  // ...and the board, laid back so you can read it from the air
  M.box(bar.x - 1.5, bgy + 1.28, bz - 0.55, 1.5, 0.08, 1.0, PALETTE.antTimber, -0.55, 0, 0);
  antStaticBox(game, bar.x, bgy + 0.55, bz, 5.4, 1.1, 0.9);
  // THE MUG IS AN OBJECT, NOT A PICTURE OF ONE.
  // It used to be a scaled clone of the shared cylinder with no collider and no
  // body, and "robbing the southernmost bar on earth" was a proximity check that
  // set visible = false. You could not pick it up, carry it out, drop it in the
  // sea or knock it off the counter — all of which are things a capybara in a
  // bar is for. It is a real prop now, put down on the counter top rather than
  // on the ice, and the task fires when it is actually taken.
  antMugSpot.x = bar.x + 1.15;
  antMugSpot.y = bgy + 1.1;
  antMugSpot.z = bz + 0.05;
  antMugWanted = true;

  // --- the jetty. Iced timber, and it is the one place on the station where
  // slip is a thing you notice before it is a thing that matters.
  const J = antJETTY;
  for (let z = J.z1; z <= J.z0; z += 2.4) {
    M.box(J.x, J.y, z, J.hx * 2, 0.22, 2.3, PALETTE.antTimber);
    for (let s = -1; s <= 1; s += 2) {
      M.cyl(J.x + s * (J.hx - 0.3), (J.y + antWATER) / 2 - 0.6, z, 0.20,
            J.y - antWATER + 1.4, PALETTE.antTimber, 0, 0, 0, 6);
    }
  }
  antStaticBox(game, J.x, J.y - 0.11, (J.z0 + J.z1) / 2, J.hx * 2, 0.22, J.z0 - J.z1 + 2.3);
  // a rail on the west side only, so the east side is where you get on the boat
  for (let z = J.z1; z <= J.z0; z += 3.2) {
    M.cyl(J.x - J.hx + 0.2, J.y + 0.55, z, 0.07, 1.0, PALETTE.antMast, 0, 0, 0, 6);
  }
  M.box(J.x - J.hx + 0.2, J.y + 1.02, (J.z0 + J.z1) / 2, 0.10, 0.10, J.z0 - J.z1, PALETTE.antMast);
  // and a marker at the head of it, which is where the chapter ends
  M.cyl(J.x + 1.5, J.y + 1.1, J.z1 + 0.6, 0.13, 2.0, PALETTE.antHull, 0, 0, 0, 6);
  M.box(J.x + 1.5, J.y + 2.1, J.z1 + 0.6, 0.6, 0.5, 0.10, PALETTE.antHull);

  // --- THE SIGNPOST, and it is the second most Antarctic object there is.
  //
  // Every base on the continent has one: a post at the landing with a dozen
  // painted boards nailed to it pointing at places nobody there is going to
  // see for another eight months, each with a number on it. It goes at the
  // shore end of the jetty because that is where the chapter STARTS — the
  // first frame of Antarctica was a smooth grey slope with a pier on it, and
  // this is one object that says everything the three locals' dialogue says.
  {
    const px = antJETTY.x - 4.2, pz = antJETTY.z0 + 3.4;
    const py = antLandOnly(px, pz);
    M.cyl(px, py + 1.55, pz, 0.11, 3.1, PALETTE.antTimber, 0, 0, 0, 6);
    antStaticBox(game, px, py + 1.55, pz, 0.5, 3.1, 0.5);
    const boards = [
      [2.55, 0.9, PALETTE.antHutRed], [2.24, 2.4, PALETTE.antIceLt],
      [1.95, 4.0, PALETTE.antDrum], [1.66, 5.3, PALETTE.antHull],
      [1.37, 0.2, PALETTE.antIceLt], [1.08, 3.3, PALETTE.antHutRoof],
      [0.79, 1.6, PALETTE.antTimber],
    ];
    for (let b = 0; b < boards.length; b++) {
      const yy = py + boards[b][0], a = boards[b][1];
      // the arrow: a long thin board pointing off to one side of the post,
      // with a dark stripe on it that reads as writing from ten metres up
      M.box(px + Math.sin(a) * 0.62, yy, pz + Math.cos(a) * 0.62,
            1.24, 0.19, 0.05, boards[b][2], 0, a, 0);
      M.box(px + Math.sin(a) * 0.62, yy, pz + Math.cos(a) * 0.62,
            0.86, 0.05, 0.07, PALETTE.antRockDk, 0, a, 0);
    }
    // a Zodiac hauled up beside it, upside down on two timbers, because that
    // is where the second boat always is
    // A ZODIAC UPSIDE DOWN IS TWO TUBES AND A FLOOR, and that is the entire
    // silhouette: two nested boxes photographed as an orange plank lying in
    // the snow. The tubes are what makes an inflatable an inflatable.
    const zx = antJETTY.x - 10.5, zz = antJETTY.z0 + 1.0;
    const zy = antLandOnly(zx, zz);
    const za = 0.55, zc = Math.cos(za), zs = Math.sin(za);
    M.box(zx, zy + 0.46, zz, 1.55, 0.20, 4.0, PALETTE.antRockDk, 0, za, 0);
    for (let s = -1; s <= 1; s += 2) {
      M.cyl(zx + zc * s * 0.76, zy + 0.34, zz - zs * s * 0.76, 0.34, 3.9,
            PALETTE.antHullDk, Math.PI / 2, za, 0, 6);
    }
    // the transom, which is the flat end an outboard bolts to
    M.box(zx - zs * 1.95, zy + 0.34, zz - zc * 1.95, 1.7, 0.62, 0.16, PALETTE.antTimber, 0, za, 0);
    for (let s = -1; s <= 1; s += 2) {
      M.box(zx + zc * s * 0.62, zy + 0.09, zz - zs * s * 0.62, 0.22, 0.18, 4.5,
            PALETTE.antTimber, 0, za, 0);
    }
    antStaticBox(game, zx, zy + 0.36, zz, 2.1, 0.72, 4.4, za);
  }

  // --- THE LANDING, WHICH IS WHERE THE CHAPTER STARTS AND HAD NOTHING ON IT
  //
  // `antSPAWN` is (0, 7.1, 52). The signpost is at z = 42.4, the Zodiac at 40,
  // the huts at 58 and fourteen metres west, and between them is sixty metres
  // of undisturbed plaster — so the FIRST FRAME OF CHAPTER 17, photographed
  // from the real spawn with the real rig, is a grey-white slope with one
  // traffic cone on it. The world-size audit has caught this chapter twice
  // already and it keeps coming back in the one place it matters most,
  // because everything that was added went to the places the tasks are.
  //
  // What is at the landing of a base is not decoration and it is not scenery:
  // it is the CARGO. Everything that comes off a ship comes off here and then
  // sits on the ice until somebody has a reason to move it, which is why every
  // photograph of every base on the continent has this exact heap in it.
  {
    const lx = antJETTY.x + 7, lz = antJETTY.z0 + 6;
    // a pallet of drums under a net
    for (let i = 0; i < 8; i++) {
      const dx = lx + (i % 4) * 0.95 - 1.4, dz = lz + Math.floor(i / 4) * 1.0;
      const dy = antLandOnly(dx, dz);
      M.cyl(dx, dy + 0.45, dz, 0.42, 0.9, i % 3 === 0 ? PALETTE.antHull : PALETTE.antDrum,
            0, rand(0, 3), 0, 8);
      antPoolBox(bY, dx, dy + 0.45, dz, 0.40, 0.45, 0.40);
    }
    // the fuel bladder: a big soft orange sausage on a bed of timber, which is
    // the one object at every landing in Antarctica that nobody can identify
    {
      const fx = lx + 6, fz = lz + 2.4, fy = antLandOnly(fx, fz);
      M.box(fx, fy + 0.12, fz, 4.6, 0.24, 3.0, PALETTE.antTimber, 0, 0.2, 0);
      M.sph(fx, fy + 0.62, fz, 2.1, 0.52, 1.25, PALETTE.antHull, 8);
      M.cyl(fx + 1.9, fy + 0.66, fz, 0.10, 0.5, PALETTE.antRockDk, 0, 0, Math.PI / 2, 6);
      antStaticBox(game, fx, fy + 0.55, fz, 4.4, 1.1, 2.6, 0.2);
    }
    // a stack of cases under a tarpaulin, strapped down, because nothing here
    // stays where you put it
    {
      const cx3 = lx - 7, cz3 = lz + 1.6, cy3 = antLandOnly(cx3, cz3);
      for (let k = 0; k < 6; k++) {
        M.box(cx3 + (k % 3) * 1.15 - 1.1, cy3 + 0.34 + Math.floor(k / 3) * 0.68, cz3,
              1.05, 0.66, 1.3, k % 2 ? PALETTE.antDrum : PALETTE.antTimber, 0, rand(-0.1, 0.1), 0);
      }
      M.box(cx3, cy3 + 1.42, cz3, 4.0, 0.14, 1.9, PALETTE.antHutRed, 0, 0, 0.03);
      for (let s = -1; s <= 1; s += 2) {
        M.box(cx3 + s * 1.3, cy3 + 0.72, cz3, 0.08, 1.5, 2.0, PALETTE.antRockDk);
      }
      antStaticBox(game, cx3, cy3 + 0.7, cz3, 3.8, 1.5, 1.6);
    }
    // ...and a hand-painted board on two legs, which is what a base puts at
    // its landing instead of a sign
    {
      const sx3 = antJETTY.x + 4.6, sz3 = antJETTY.z0 + 2.0, sy3 = antLandOnly(sx3, sz3);
      for (let s = -1; s <= 1; s += 2) {
        M.box(sx3 + s * 0.9, sy3 + 0.62, sz3, 0.10, 1.24, 0.10, PALETTE.antTimber);
      }
      M.box(sx3, sy3 + 1.10, sz3, 2.2, 0.72, 0.08, PALETTE.antHutRed, -0.12, 0, 0);
      M.box(sx3, sy3 + 1.14, sz3 - 0.05, 1.7, 0.10, 0.06, PALETTE.antIceLt, -0.12, 0, 0);
      M.box(sx3, sy3 + 0.98, sz3 - 0.05, 1.2, 0.09, 0.06, PALETTE.antIceLt, -0.12, 0, 0);
      antStaticBox(game, sx3, sy3 + 0.9, sz3, 2.2, 1.8, 0.4);
    }
    // a coil of mooring line and two mushroom bollards at the head of the ramp
    M.cyl(antJETTY.x - 2.6, antLandOnly(antJETTY.x - 2.6, antJETTY.z0 + 1) + 0.16,
          antJETTY.z0 + 1, 0.62, 0.32, PALETTE.antBone, 0, 0, 0, 8);
    for (let s = -1; s <= 1; s += 2) {
      const bx2 = antJETTY.x + s * 2.4, bz2 = antJETTY.z0 + 0.4;
      const by2 = antLandOnly(bx2, bz2);
      M.cyl(bx2, by2 + 0.26, bz2, 0.20, 0.52, PALETTE.antRockDk, 0, 0, 0, 6);
      M.cyl(bx2, by2 + 0.56, bz2, 0.30, 0.16, PALETTE.antRockDk, 0, 0, 0, 6);
    }
  }

  // --- THE FLAG LINE, and it is the most Antarctic object there is.
  //
  // Every base on the continent marks its safe routes with bamboo canes and a
  // scrap of flag every twenty metres, because in a whiteout a footprint is
  // gone in four minutes and a cane is not. Photographed, the station's apron
  // was two hundred square metres of undifferentiated white with three huts on
  // it — this is one line of canes, it costs nothing, and it does three jobs
  // at once: it gives the snow a SCALE, it says people live here, and it is a
  // navigation aid a player can follow to the head of the glacier without ever
  // being told to.
  {
    // ...AND IT STARTS AT THE LANDING NOW. The line ran from the huts out to
    // the glacier and left the sixty metres between the jetty head and the
    // front door — which is the ONE stretch of this station anybody actually
    // walks, and the stretch the player is put down in the middle of — with
    // nothing on it at all. Two more canes, and the arrival has a direction.
    const route = [[antJETTY.x + 1.5, antJETTY.z0 + 2], [antHUTS.x + 6, antHUTS.z - 3],
                   [antHUTS.x + 3, antHUTS.z + 2], [antHUTS.x - 14, antHUTS.z - 14],
                   [-38, 34], [-56, 8], [-70, -20], [-80, -54]];
    for (let s = 0; s < route.length - 1; s++) {
      const ax = route[s][0], az = route[s][1];
      const bx = route[s + 1][0], bz = route[s + 1][1];
      const seg = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.round(seg / 9));
      for (let k = 0; k < n; k++) {
        const t = k / n;
        const fx = lerp(ax, bx, t), fz = lerp(az, bz, t);
        const fy = antLandOnly(fx, fz);
        if (fy < antWATER + 0.4) continue;
        M.cyl(fx, fy + 0.85, fz, 0.035, 1.7, PALETTE.antTimber, 0, 0, 0, 4);
        // the flag itself, always streaming the same way, because the wind
        // down here always comes off the ice
        M.box(fx + 0.24, fy + 1.52, fz, 0.44, 0.30, 0.02,
              (s + k) % 3 === 0 ? PALETTE.antHutRed : PALETTE.antHull, 0, 0.35, 0.06);
      }
    }
  }

  // --- the yard: crates, a timber stack and a fuel bladder, because a base is
  // ninety per cent things waiting to be moved somewhere
  {
    const cy0 = antLandOnly(antHUTS.x + 9, antHUTS.z + 4);
    for (let i = 0; i < 5; i++) {
      const cx2 = antHUTS.x + 8 + (i % 3) * 1.5;
      const cz2 = antHUTS.z + 3 + Math.floor(i / 3) * 1.7;
      const cy = antLandOnly(cx2, cz2);
      M.box(cx2, cy + 0.42, cz2, 1.3, 0.84, 1.1,
            i % 2 ? PALETTE.antDrum : PALETTE.antTimber, 0, rand(-0.3, 0.3), 0);
      antPoolBox(bY, cx2, cy + 0.42, cz2, 0.65, 0.42, 0.55);
    }
    // a stack of timber under a tarpaulin, which is the same thing on every
    // base on the continent
    M.box(antHUTS.x + 12, cy0 + 0.35, antHUTS.z + 9, 4.2, 0.7, 1.6, PALETTE.antTimber, 0, 0.3, 0);
    M.box(antHUTS.x + 12, cy0 + 0.76, antHUTS.z + 9, 4.6, 0.16, 2.0, PALETTE.antHutRed, 0, 0.3, 0);
    antPoolBox(bY, antHUTS.x + 12, cy0 + 0.42, antHUTS.z + 9, 2.2, 0.42, 0.9, 0.3);
  }

  // --- THE WINDSOCK, on the mast, which has carried three bare spars and no
  // instrument since the chapter shipped. It is the only thing in the frame
  // that says which way the wind is, in a place defined by the wind.
  {
    M.cyl(mx + 0.9, my + 12.2, mz, 0.30, 0.9, PALETTE.antHull, 0, 0, Math.PI / 2, 6);
    M.cyl(mx + 1.9, my + 12.2, mz, 0.46, 1.1, PALETTE.antPengW, 0, 0, Math.PI / 2, 6);
    M.cyl(mx + 3.0, my + 12.2, mz, 0.56, 1.1, PALETTE.antHull, 0, 0, Math.PI / 2, 6);
    // and a cup anemometer above it, spinning is not required: three cups on
    // a cross reads as an instrument at any distance
    for (let a = 0; a < 3; a++) {
      const ang = (a / 3) * Math.PI * 2;
      M.box(mx + Math.cos(ang) * 0.55, my + 13.4, mz + Math.sin(ang) * 0.55,
            0.16, 0.16, 0.16, PALETTE.antRockDk);
      M.box(mx + Math.cos(ang) * 0.28, my + 13.4, mz + Math.sin(ang) * 0.28,
            0.55, 0.03, 0.03, PALETTE.antMast, 0, -ang, 0);
    }
  }

  // --- THE APRON, and it is the ground the player is put down on ----------
  //
  // Measured from the real spawn with the real rig after everything above was
  // in: three rocks in a forty-by-twenty-five-metre frame, which is one per
  // three hundred and thirty square metres. The outcrop scatter cannot fix it,
  // because it rejects flat ground on purpose (`sl * 1.9` clamped at 0.34) and
  // the apron is the flattest ground in the chapter — which is exactly why it
  // is where the huts are.
  //
  // What is on two hundred days of trodden ground round a base is not outcrop.
  // It is GRIT — the gravel that comes up through the snow wherever anybody
  // walks — plus the small stuff that gets dropped and never picked up. Three
  // hundred pieces over about six thousand square metres, all of it under
  // thirty centimetres, none of it collided, and it is the difference between
  // a floor and a landscape.
  {
    const A = antMerger();
    for (let i = 0; i < 430; i++) {
      const a = rand(0, 6.283), r = Math.sqrt(Math.random()) * 44;
      const gx = antHUTS.x + 7 + Math.cos(a) * r, gz = antHUTS.z - 6 + Math.sin(a) * r;
      const gy2 = antLandOnly(gx, gz);
      if (gy2 < antWATER + 0.5 || antInZone('jetty', gx, gz)) continue;
      if (Math.hypot(gx - antCOLONY.x, gz - antCOLONY.z) < antCOLONY.r) continue;
      // ...AND BIG ENOUGH TO SEE. At 16 to 62 centimetres from a rig ten
      // metres up this was a dusting the eye could not resolve; the apron
      // photographed as plaster again with a few specks on it. Every fifth
      // one is a proper cobble.
      const s = i % 5 === 0 ? rand(0.7, 1.5) : rand(0.22, 0.72);
      A.box(gx, gy2 + s * 0.22, gz, s, s * 0.5, s * 0.85,
            i % 4 === 0 ? PALETTE.antRockDk : i % 4 === 1 ? PALETTE.antScree
            : i % 4 === 2 ? PALETTE.antRock : PALETTE.antIceSh,
            rand(-0.3, 0.3), rand(0, 6.28), rand(-0.3, 0.3));
    }
    // ...and the things nobody has moved. A cable drum on its side, a broken
    // sledge runner, a length of pipe, an oil stain of a tarpaulin.
    {
      const dx2 = antHUTS.x + 17, dz2 = antHUTS.z - 2, dy2 = antLandOnly(dx2, dz2);
      A.cyl(dx2, dy2 + 0.85, dz2, 0.85, 1.1, PALETTE.antTimber, 0, 0, Math.PI / 2, 8);
      A.cyl(dx2, dy2 + 0.85, dz2, 0.45, 1.2, PALETTE.antRockDk, 0, 0, Math.PI / 2, 8);
      antStaticBox(game, dx2, dy2 + 0.8, dz2, 1.4, 1.7, 1.8);
    }
    {
      const rx2 = antHUTS.x - 4, rz2 = antHUTS.z - 13, ry2 = antLandOnly(rx2, rz2);
      A.box(rx2, ry2 + 0.10, rz2, 0.18, 0.14, 2.6, PALETTE.antMast, 0.04, 0.9, 0);
      A.box(rx2 + 1.1, ry2 + 0.07, rz2 - 0.6, 2.2, 0.10, 0.14, PALETTE.antMast, 0, 0.4, 0);
      A.box(rx2 - 2.2, ry2 + 0.05, rz2 + 1.4, 1.9, 0.06, 1.4, PALETTE.antHutRoof, 0, 0.7, 0.02);
    }
    const am = new THREE.Mesh(A.build(), antVC());
    am.castShadow = true;
    am.receiveShadow = true;
    root.add(am);
  }

  // --- the colony. Nests are stone, they are hard-won, and the birds steal
  // them off each other constantly, so a rookery from above is a lattice of
  // little grey rings exactly one neck-length apart.
  // ...AND A NEST IS A RING OF PEBBLES WITH A BIRD SITTING ON IT.
  //
  // Two discs, one inside the other, photographed from twelve metres up as a
  // flat brown coin lying in the snow — and the eighty-two coins and the sixty
  // penguins were scattered INDEPENDENTLY, so nothing in the colony was on a
  // nest and every nest was empty. A gentoo rookery is nests at one
  // neck-length with a bird on every single one; that is the whole shape of
  // it, and it is why they are all exactly the same distance apart. The
  // positions are kept and handed to antBuildPenguins, which stands a bird on
  // each of them.
  antNests.length = 0;
  for (let i = 0; i < 136; i++) {
    const a = rand(0, 6.283), r = Math.sqrt(Math.random()) * antCOLONY.r * 0.94;
    const nx = antCOLONY.x + Math.cos(a) * r, nz = antCOLONY.z + Math.sin(a) * r;
    const ny = antLandOnly(nx, nz);
    if (ny < antWATER + 1) continue;
    // ...and the ring is PEBBLES, not a disc: seven of them round a scrape,
    // and every one was stolen off a neighbour, which is the fact the colony
    // local has a line about.
    for (let k = 0; k < 7; k++) {
      const pa = (k / 7) * Math.PI * 2 + i;
      M.box(nx + Math.cos(pa) * 0.34, ny + 0.07, nz + Math.sin(pa) * 0.34,
            0.19, 0.14, 0.19, k % 2 ? PALETTE.antScree : PALETTE.antRock, 0, pa, 0);
    }
    M.cyl(nx, ny + 0.05, nz, 0.30, 0.10, PALETTE.antGuano, 0, 0, 0, 6);
    antNests.push(nx, nz);
  }

  antPoolDone(game, bY);
  const mesh = new THREE.Mesh(M.build(), antVC());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  root.add(mesh);

  antBuildPenguins(root);
}

// ---------------------------------------------------------------- whalers ---
function antBuildWhalers(game, root) {
  const M = antMerger();
  const W = antWHAL;
  // ---- THE WRECK, AND IT WAS A STAIRCASE --------------------------------
  //
  // Nine boxes, each 1.6 m tall, stepping up a straight line at 1.9 m centres
  // with 1.7 m of depth apiece — so they did not even touch. Photographed from
  // the beach, the "wooden whaleboat, half buried, bow up" that this chapter's
  // one piece of archaeology is built on was a BROWN ZIGGURAT: a flight of
  // nine steps standing in the snow, and comfortably the worst object in
  // chapter 17.
  //
  // A boat is three things and none of them is a step: a KEEL line that curves
  // up at both ends, a HULL that is widest amidships and comes to a point at
  // the bow, and a GUNWALE — one continuous rail round the top of it, which is
  // the line the eye actually reads. Twelve stations, overlapping, each a
  // single box rolled to the local deadrise, with ribs standing out of the one
  // side that has fallen open. She is half full of shingle and you can walk in
  // over the broken side, which is what the collider leaves room for.
  const bx = W.x - 14, bz = W.z + 6;
  const by = antLandOnly(bx, bz);
  const BA = 0.5, BC = Math.cos(BA), BS = Math.sin(BA);
  const BLEN = 9.2;
  for (let i = 0; i < 13; i++) {
    const t = i / 12;
    const u = t - 0.5;                       // -0.5 stern, +0.5 bow
    // the sheer: a boat rises at both ends and it rises MORE at the bow
    const sheer = 0.62 + 2.6 * u * u * (u > 0 ? 1.35 : 1);
    // the beam: widest a little aft of amidships, and a point at the bow
    const w = 2.15 * Math.pow(Math.cos(u * 2.5), 1.6) + 0.16;
    const px = bx + BC * u * BLEN, pz = bz + BS * u * BLEN;
    const py = by + 0.15 + sheer * 0.62;
    // the hull: rolled to starboard, because she fell over when the ice took
    // her and nothing here has moved since
    M.box(px, py, pz, w, 1.05 + sheer * 0.30, BLEN / 11,
          i % 2 ? PALETTE.antTimber : PALETTE.antRockDk, 0, BA, 0.16);
    // the gunwale: ONE continuous rail, and it is the line the eye reads
    M.box(px - BS * w * 0.5 * 0.92, py + (1.05 + sheer * 0.30) * 0.5 + 0.06,
          pz + BC * w * 0.5 * 0.92, 0.17, 0.16, BLEN / 10,
          PALETTE.antHullDk, 0, BA, 0.16);
    // ...and the ribs on the side that has gone. Every third one, standing
    // clear, which is what says "wooden" from twenty metres.
    if (i % 2 === 0 && Math.abs(u) < 0.42) {
      M.box(px + BS * w * 0.46, py + 0.55 + sheer * 0.22, pz - BC * w * 0.46,
            0.13, 1.5 + sheer * 0.5, 0.13, PALETTE.antTimber, 0, BA, 0.34);
    }
  }
  // the stem post: a whaleboat is double-ended and the post is the tallest
  // thing on her
  M.box(bx + BC * BLEN * 0.54, by + 2.6, bz + BS * BLEN * 0.54, 0.24, 3.0, 0.34,
        PALETTE.antTimber, 0, BA, 0.30);
  // the keel, exposed where the shingle has washed out from under her
  M.box(bx, by + 0.10, bz, 0.30, 0.34, BLEN * 0.9, PALETTE.antRockDk, 0, BA, 0.16);
  // and the shingle she is half full of
  for (let i = 0; i < 7; i++) {
    const u = rand(-0.34, 0.34);
    M.sph(bx + BC * u * BLEN + rand(-0.5, 0.5), by + 0.5,
          bz + BS * u * BLEN + rand(-0.5, 0.5),
          rand(0.5, 1.2), 0.22, rand(0.5, 1.0), PALETTE.antRockDk, 6);
  }
  antStaticBox(game, bx, by + 1.1, bz, 2.6, 2.2, BLEN + 1.4, BA);

  // three boilers, rusted through, which is what a whaling station IS.
  // ...AND THEY HAVE STAVES AND A RIVET LINE. A four-metre plain cylinder is a
  // grain silo; a blubber boiler is a riveted iron drum with its top open, a
  // firebox door in the side and a chimney stub, and all three of those read
  // at twenty metres.
  for (let i = 0; i < 3; i++) {
    const tx = W.x + 6 + i * 9, tz = W.z + 18 - i * 4;
    const ty = antLandOnly(tx, tz);
    const ta = rand(0, 3);
    // NOT THE TENDER'S ORANGE. `antHullDk` is the hull colour and the hull is
    // "the one warm thing on the water" — three four-metre drums painted in it
    // put a row of bright orange silos on the beach and stole the boat's
    // identity from four hundred metres away. Rusted iron is a DARK thing with
    // rust on it: the body is rock, the bands are the rust.
    M.cyl(tx, ty + 2.0, tz, 2.3, 4.0, PALETTE.antRockDk, 0, ta, 0, 8);
    M.cyl(tx, ty + 1.5, tz, 2.33, 1.1, PALETTE.antHullDk, 0, ta, 0, 8);
    M.cyl(tx, ty + 4.1, tz, 2.4, 0.3, PALETTE.antHullDk, 0, 0, 0, 8);
    // two hoops, which is what makes a drum a drum
    for (let k = 0; k < 2; k++) {
      M.cyl(tx, ty + 1.0 + k * 1.9, tz, 2.42, 0.26, PALETTE.antHullDk, 0, ta, 0, 8);
    }
    // the firebox, at the foot, on the seaward side
    M.box(tx + Math.sin(ta) * 2.2, ty + 0.65, tz + Math.cos(ta) * 2.2, 1.3, 1.1, 0.3,
          PALETTE.antRockDk, 0, ta, 0);
    // the chimney stub, bent
    M.cyl(tx + 1.1, ty + 5.2, tz - 0.6, 0.36, 2.4, PALETTE.antRockDk, 0.16, 0, 0.13, 6);
    // and the brick base it stands on, half sunk
    M.box(tx, ty + 0.22, tz, 5.6, 0.44, 5.6, PALETTE.antRockDk, 0, ta * 0.4, 0);
    antStaticBox(game, tx, ty + 2.0, tz, 4.6, 4.0, 4.6);
  }

  // ---- AND THE REST OF WHAT THEY LEFT, WHICH IS EVERYTHING ---------------
  //
  // "Nothing rots down here. That is the whole problem with the place" is one
  // of the archaeologist's four lines, and the beach had a boat, three drums
  // and a whale on it. What is actually on one of these beaches — South
  // Georgia, Deception, Whalers Bay, any of them — is a HUNDRED YEARS OF
  // ABANDONED INDUSTRY lying exactly where it was dropped: barrel staves by
  // the thousand, chain, riveted tanks, the frame of a shed with no walls
  // left, and a row of graves with wooden crosses, because a lot of them did
  // not go home.
  {
    // the barrel field: staves and hoops, in drifts, downwind of the boilers
    for (let i = 0; i < 54; i++) {
      const a = rand(0, 6.283), r = Math.sqrt(Math.random()) * 26;
      const sx = W.x + 4 + Math.cos(a) * r, sz = W.z + 8 + Math.sin(a) * r;
      const sy = antLandOnly(sx, sz);
      if (sy < antWATER + 0.3) continue;
      if (i % 5 === 0) {
        // a whole cask on its side
        M.cyl(sx, sy + 0.42, sz, 0.42, 1.05, PALETTE.antTimber, Math.PI / 2, rand(0, 3), 0, 8);
        M.cyl(sx, sy + 0.42, sz, 0.45, 0.12, PALETTE.antRockDk, Math.PI / 2, rand(0, 3), 0, 8);
      } else {
        // a stave, which is a curved plank and reads as one at any distance
        M.box(sx, sy + 0.09, sz, 0.17, 0.06, rand(0.7, 1.3),
              i % 3 ? PALETTE.antTimber : PALETTE.antRockDk,
              rand(-0.1, 0.1), rand(0, 6.28), rand(-0.1, 0.1));
      }
    }
    // three riveted tanks lying where they toppled
    for (let i = 0; i < 3; i++) {
      const tx = W.x - 26 + i * 7, tz = W.z - 12 + i * 5;
      const ty = antLandOnly(tx, tz);
      if (ty < antWATER + 0.4) continue;
      M.cyl(tx, ty + 1.1, tz, 1.1, 4.2, PALETTE.antRockDk, Math.PI / 2, rand(0, 3), 0, 8);
      M.cyl(tx, ty + 1.1, tz, 1.16, 0.20, PALETTE.antHullDk, Math.PI / 2, rand(0, 3), 0, 8);
      antStaticBox(game, tx, ty + 1.0, tz, 4.4, 2.0, 2.4, rand(0, 3));
    }
    // the chain: forty links out of the shingle and into the sea, which is
    // where the catchers were made fast
    for (let k = 0; k < 26; k++) {
      const t = k / 25;
      const cx2 = W.x - 6 + t * 22, cz2 = W.z + 30 + t * 14;
      const cy2 = Math.max(antLandOnly(cx2, cz2), antWATER - 0.15);
      M.box(cx2, cy2 + 0.14, cz2, 0.42, 0.20, 0.62, PALETTE.antRockDk, 0, 0.57 + (k % 2) * 1.57, 0);
    }
    // the shed: four posts, two rafters, no walls, because the wind took them
    {
      const hx2 = W.x + 22, hz2 = W.z - 4;
      const hy2 = antLandOnly(hx2, hz2);
      for (let sx2 = -1; sx2 <= 1; sx2 += 2) {
        for (let sz2 = -1; sz2 <= 1; sz2 += 2) {
          M.box(hx2 + sx2 * 3.4, hy2 + 1.5, hz2 + sz2 * 2.6, 0.26, 3.0, 0.26,
                PALETTE.antTimber, 0, 0, sx2 * 0.03);
          antStaticBox(game, hx2 + sx2 * 3.4, hy2 + 1.5, hz2 + sz2 * 2.6, 0.5, 3.0, 0.5);
        }
        M.box(hx2, hy2 + 3.1, hz2 + sx2 * 2.6, 7.2, 0.22, 0.22, PALETTE.antTimber);
      }
      M.box(hx2, hy2 + 3.5, hz2, 0.22, 0.22, 5.4, PALETTE.antTimber);
      // one sheet of iron still nailed to it, banging in the wind for a
      // hundred years
      M.box(hx2 - 3.4, hy2 + 2.1, hz2 + 1.2, 0.06, 1.6, 2.0, PALETTE.antHullDk, 0, 0, 0.12);
    }
    // ---- and the graves. Five, in a line, above the storm line ----------
    // The single most affecting object on any of these beaches, and it is four
    // boxes each. They face the sea, because everything down here does.
    for (let i = 0; i < 5; i++) {
      const gx = W.x - 34, gz = W.z + 22 - i * 3.4;
      const gy = antLandOnly(gx, gz);
      if (gy < antWATER + 1.2) continue;
      M.box(gx, gy + 0.62, gz, 0.14, 1.24, 0.12, PALETTE.antTimber, 0, 0.3, i * 0.03 - 0.04);
      M.box(gx, gy + 0.98, gz, 0.14, 0.11, 0.66, PALETTE.antTimber, 0, 0.3, i * 0.03 - 0.04);
      // the stones round the foot of it, which is all anybody could do
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * 6.283;
        M.box(gx + Math.cos(a) * 0.5, gy + 0.09, gz + Math.sin(a) * 0.42,
              0.24, 0.16, 0.22, k % 2 ? PALETTE.antScree : PALETTE.antRock, 0, a, 0);
      }
    }
  }

  // --- THE BONES. Nine ribs and a jaw, and they are the only thing in this
  // chapter that is a place to SIT rather than a thing to do. A blue whale's
  // ribcage is a room; the task is to notice that.
  const oy = antLandOnly(antBONES.x, antBONES.z);
  // A RIBCAGE IS A ROOM, AND A ROOM HAS WALLS. The task is 'sit down INSIDE
  // the whale' and for the chapter's whole life the ribs were a hologram: the
  // solidity probe put this mesh at forty-one walkable squares with bone
  // within reach and nothing in it, and walking out through the side of a blue
  // whale is not the moment the list is asking for. One compound body, one box
  // per rib, and the mouth of the ribcage is left open at both ends because
  // that is how you get in.
  const bB = antPoolBody(game);
  for (let i = 0; i < 9; i++) {
    const t = (i - 4) / 4;
    const zz = antBONES.z + t * 7.5;
    const hh = 4.4 * Math.sqrt(Math.max(0.05, 1 - t * t)) + 0.6;
    // ---- AND A RIB IS A CURVE, NOT A PROP -----------------------------
    // One straight cylinder leaning in at 0.42 rad, twice per station, is an
    // A-FRAME: photographed from the beach the ribcage of a blue whale read as
    // a row of trestles. A rib comes almost vertically out of the spine, bows
    // out through the widest part of the body and turns back IN at the bottom,
    // which is why a ribcage is a room and a trestle is not. Three segments
    // with the tilt increasing as it goes is the whole of it.
    for (let s = -1; s <= 1; s += 2) {
      let rx0 = antBONES.x + s * 0.30, ry0 = oy + 0.10;
      for (let k = 0; k < 3; k++) {
        const seg = hh * 0.40;
        // out hard at the bottom, nearly upright at the top
        const lean = s * lerp(0.85, 0.12, k / 2);
        const dx = Math.sin(lean) * seg, dy = Math.cos(lean) * seg;
        M.cyl(rx0 + dx * 0.5, ry0 + dy * 0.5, zz, 0.205, seg * 1.06,
              PALETTE.antBone, 0, 0, lean, 6);
        antPoolBox(bB, rx0 + dx * 0.5, ry0 + dy * 0.5, zz,
                   Math.max(0.26, Math.abs(dx) * 0.6), dy * 0.55, 0.42);
        rx0 += dx; ry0 += dy;
      }
      // the head of it, where it met the spine
      M.sph(rx0, ry0, zz, 0.30, 0.26, 0.34, PALETTE.antBone, 6);
    }
  }
  antPoolDone(game, bB);
  // the two halves of the jaw, lying where they fell
  for (let s = -1; s <= 1; s += 2) {
    M.cyl(antBONES.x + 8 + s * 1.6, oy + 0.35, antBONES.z - 5, 0.34, 9.0,
          PALETTE.antBone, 1.57, s * 0.12, 0, 6);
  }
  // a vertebra to sit on, which is what the game wants you to do
  M.cyl(antBONES.x, oy + 0.55, antBONES.z, 0.95, 1.0, PALETTE.antBone, 1.57, 0, 0, 8);
  // ...AND THE REST OF THE ANIMAL. Nine ribs, a jaw and one vertebra is a
  // display case; what is on a whaling beach is the whole skeleton, taken
  // apart where it lay and never tidied. A spine running away from the ribcage
  // (a blue whale's is sixty-odd vertebrae and each is the size of a stool), a
  // scapula like a dinner table, and the skull, which is a third of the length
  // of the animal and is the single most surprising fact about one.
  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    const vx = antBONES.x - 1.2 - t * 3.0 + Math.sin(t * 5) * 0.7;
    const vz = antBONES.z - 9 - t * 15;
    const vy = antLandOnly(vx, vz);
    const vr = lerp(0.86, 0.30, t);
    M.cyl(vx, vy + vr * 0.55, vz, vr, vr * 1.25, PALETTE.antBone, 1.57, t * 1.2, 0, 8);
    // the neural spine on top, which is what makes a vertebra read as one
    if (i % 2 === 0) {
      M.box(vx, vy + vr * 1.5, vz, 0.16, vr * 1.5, 0.48, PALETTE.antBone, 0, t * 1.2, 0.12);
    }
  }
  // the scapula, lying flat where somebody dragged it out of the way
  M.box(antBONES.x - 11, oy + 0.20, antBONES.z + 3, 3.4, 0.30, 2.6,
        PALETTE.antBone, 0.06, 0.8, 0.04);
  // ---- THE SKULL, and it is the size of a car ---------------------------
  {
    const sx = antBONES.x + 13, sz = antBONES.z + 9;
    const sy = antLandOnly(sx, sz);
    const sa = 2.2;
    // LONG, LOW AND POINTED. Five stubby boxes 1.35 m tall stepping over five
    // metres photographed as a white chest freezer lying on the beach. A
    // rorqual skull is a third of the length of the animal and almost none of
    // its height: eight metres of it here, tapering to a point at the tip of
    // the rostrum and only waist high on a capybara, which is the proportion
    // that makes people refuse to believe it is a head.
    for (let k = 0; k < 7; k++) {
      const t = k / 6;
      const w = (2.9 - 2.55 * t) * 0.9;
      M.box(sx + Math.sin(sa) * (t - 0.15) * 8.0, sy + 0.52 - t * 0.20,
            sz + Math.cos(sa) * (t - 0.15) * 8.0,
            w, 0.92 - t * 0.46, 8.0 / 6.4, PALETTE.antBone, 0, sa, 0.04);
    }
    // the braincase at the back of it, which is the only tall part
    M.box(sx - Math.sin(sa) * 1.4, sy + 0.78, sz - Math.cos(sa) * 1.4,
          2.7, 1.6, 1.7, PALETTE.antBone, 0, sa, 0.03);
    // the two jaw sockets, which are the eye of it from above
    for (let s = -1; s <= 1; s += 2) {
      M.box(sx + Math.cos(sa) * s * 1.15 - Math.sin(sa) * 0.4,
            sy + 0.50, sz - Math.sin(sa) * s * 1.15 - Math.cos(sa) * 0.4,
            0.55, 0.55, 1.0, PALETTE.antRockDk, 0, sa, 0);
    }
    antStaticBox(game, sx + Math.sin(sa) * 2.4, sy + 0.6, sz + Math.cos(sa) * 2.4,
                 2.6, 1.2, 8.0, sa);
  }

  const mesh = new THREE.Mesh(M.build(), antVC());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  root.add(mesh);
}

// ------------------------------------------------------------------- boat ---
/**
 * THE TENDER. Orange, aluminium, four metres of freeboard-less workboat with
 * an outboard on the back — the only kind of boat anybody actually goes
 * anywhere in down there.
 *
 * The deck sits 0.44 m over the waterline and the jetty is at 0.62, so getting
 * aboard is a STEP DOWN and getting back is a 0.18 m step up. Both are inside
 * what a capybara does without being told (0.40 m); see the note in
 * capy3's carrier rules about the snowcat that was authored at 2.7 m and could
 * only ever be admired.
 */
function antBuildBoat(game, root) {
  const M = antMerger();
  const hx = antTEN_HX, hz = antTEN_HZ, d = antTEN_DECK;
  // the hull: a flat bottom, a chine, and a bow that comes to a point
  M.box(0, -0.30, 0, hx * 2, 0.62, hz * 1.75, PALETTE.antHullDk);
  M.box(0, 0.02, 0, hx * 2.02, 0.34, hz * 1.85, PALETTE.antHull);
  M.box(0, -0.10, hz * 0.80, hx * 1.35, 0.72, hz * 0.55, PALETTE.antHull, 0, 0, 0);
  M.box(0, 0.06, hz * 1.02, hx * 0.62, 0.50, hz * 0.42, PALETTE.antHull);
  // the deck she stands on
  M.box(0, 0.20, -0.2, hx * 1.80, 0.10, hz * 1.62, PALETTE.antDeck);
  // the bulwark, with a GAP on the starboard side amidships so there is a way
  // aboard. A boat you cannot step into is scenery.
  for (let s = -1; s <= 1; s += 2) {
    if (s > 0) {
      M.box(s * hx * 0.95, 0.44, hz * 0.62, 0.16, 0.48, hz * 1.0, PALETTE.antHull);
      M.box(s * hx * 0.95, 0.44, -hz * 0.72, 0.16, 0.48, hz * 0.8, PALETTE.antHull);
    } else {
      M.box(s * hx * 0.95, 0.44, 0, 0.16, 0.48, hz * 1.85, PALETTE.antHull);
    }
  }
  M.box(0, 0.44, hz * 1.10, hx * 1.1, 0.48, 0.16, PALETTE.antHull);
  M.box(0, 0.44, -hz * 1.12, hx * 1.6, 0.48, 0.16, PALETTE.antHull);
  // two thwarts and a locker
  M.box(0, 0.44, hz * 0.36, hx * 1.7, 0.14, 0.42, PALETTE.antTimber);
  M.box(0, 0.52, -hz * 0.30, hx * 1.2, 0.34, 0.70, PALETTE.antDrum);
  // the outboard, which is where the noise comes from
  M.box(0, 0.42, -hz * 1.25, 0.52, 0.72, 0.46, PALETTE.antRockDk);
  M.cyl(0, -0.35, -hz * 1.32, 0.10, 1.30, PALETTE.antMast, 0, 0, 0, 6);
  M.box(0, -0.92, -hz * 1.32, 0.34, 0.16, 0.60, PALETTE.antMast);
  // a jerrycan and a coil of line, because a boat with nothing loose in it
  // reads as a model of a boat
  M.box(hx * 0.5, 0.40, -hz * 0.66, 0.34, 0.42, 0.26, PALETTE.antDrum);
  M.cyl(-hx * 0.5, 0.32, hz * 0.62, 0.30, 0.14, PALETTE.antBone, 0, 0, 0, 8);

  const g = new THREE.Group();
  const hull = new THREE.Mesh(M.build(), antVC());
  hull.castShadow = true;
  hull.receiveShadow = true;
  g.add(hull);

  // the tiller: a bar you can see move, which is the only feedback the rudder
  // has, because there is no wheel on a boat like this
  const T = antMerger();
  T.box(0, 0, 0.55, 0.09, 0.09, 1.20, PALETTE.antTimber);
  T.box(0, 0, 1.16, 0.16, 0.16, 0.26, PALETTE.antRockDk);
  antTillerMesh = new THREE.Mesh(T.build(), antVC());
  antTillerMesh.position.set(0, 0.86, -hz * 1.16);
  g.add(antTillerMesh);

  // a flag, so you can see which way the wind is and which way she is
  const F = antMerger();
  F.cyl(0, 0.9, 0, 0.05, 1.8, PALETTE.antMast, 0, 0, 0, 6);
  antFlagMesh = new THREE.Mesh(F.build(), antVC());
  antFlagMesh.position.set(0, 0.42, hz * 1.02);
  g.add(antFlagMesh);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55),
                               mat(PALETTE.antHull, { side: THREE.DoubleSide }));
  cloth.position.set(0.45, 1.55, 0);
  antFlagMesh.add(cloth);

  g.position.set(antBERTH.x, antWATER + antTEN_DECK, antBERTH.z);
  antBoatGroup = g;
  root.add(g);

  const b = new CANNON.Body({
    mass: 0, type: CANNON.Body.KINEMATIC,
    material: (game.mats && game.mats.ground) || undefined,
  });
  b.addShape(new CANNON.Box(new CANNON.Vec3(hx, 0.34, hz)), new CANNON.Vec3(0, 0.02, 0));
  // the two bulwarks, so she has SIDES and a capybara at the wheel of a boat
  // doing eleven metres a second does not simply walk off her
  b.addShape(new CANNON.Box(new CANNON.Vec3(0.10, 0.34, hz)), new CANNON.Vec3(-hx * 0.95, 0.52, 0));
  b.addShape(new CANNON.Box(new CANNON.Vec3(0.10, 0.34, hz * 0.5)), new CANNON.Vec3(hx * 0.95, 0.52, hz * 0.6));
  b.addShape(new CANNON.Box(new CANNON.Vec3(0.10, 0.34, hz * 0.4)), new CANNON.Vec3(hx * 0.95, 0.52, -hz * 0.7));
  b.addShape(new CANNON.Box(new CANNON.Vec3(hx, 0.34, 0.10)), new CANNON.Vec3(0, 0.52, -hz));
  b.position.set(antBERTH.x, antWATER + antTEN_DECK, antBERTH.z);
  b.allowSleep = false;
  antSyncBody(b);
  game.world.addBody(b);
  antBoatBody = b;
}

// -------------------------------------------------------------------- pod ---
/**
 * SIX ORCAS.
 *
 * SILHOUETTE FIRST, because this game is played from above: what reads from a
 * camera 9.5 m behind and 41 degrees down is the SADDLE PATCH and the DORSAL,
 * and nothing else. So the back is black, the saddle is a pale grey slab
 * behind the fin, the eye patch is a white wedge, and the bull's fin is 1.8 m
 * of it — a triangle you can identify from two hundred metres, which is
 * exactly what it is for in real life too.
 */
function antBuildPod(root) {
  antPodGroup = new THREE.Group();
  antPodParts = [];
  antPodFlukes = []; antPodFins = [];
  antPodGroup.name = 'antPod';         // findable from the harness (qa/wow-movers.js)
  antPodX = new Float32Array(antPOD_N);
  antPodZ = new Float32Array(antPOD_N);
  antPodPh = new Float32Array(antPOD_N);
  antPodOffX = new Float32Array(antPOD_N);
  antPodOffZ = new Float32Array(antPOD_N);

  // station-keeping offsets: two on the bows, two on the quarters, the bull
  // out on the port beam and the calf tucked in beside its mother. That layout
  // is the picture — the marquee shot is the animal in the middle of them.
  const off = [-6.0, 5.2, 6.0, 5.2, -6.9, -4.6, 6.9, -4.6, -10.0, 0.6, -8.2, -2.4];
  for (let i = 0; i < antPOD_N; i++) {
    antPodOffX[i] = off[i * 2];
    antPodOffZ[i] = off[i * 2 + 1];
    // ...AND THEY DO NOT ALL DO IT AT ONCE. `i * 1.04` is a phase in CYCLES,
    // not radians, so six animals got fractions 0, .04, .08, .12, .16 and .20 —
    // all six peaks inside 0.44 s of a 2.2 s cycle instead of 1.83 s apart, and
    // a photograph of the escort had all six in an identical pose. Same family
    // as the colony chorus's flashbulb. Spread them across the whole cycle.
    antPodPh[i] = i / antPOD_N;
    const bull = i === 4;
    const calf = i === 5;
    const s = bull ? 1.28 : calf ? 0.62 : 1.0;

    const M = antMerger();
    const L = 7.2 * s;
    // the body: five slabs tapering to the flukes, so the back is a CURVE of
    // creases rather than one long box
    for (let k = 0; k < 5; k++) {
      const t = k / 4;
      const w = (1.55 - 1.05 * t * t) * s;
      M.box(0, 0, (0.5 - t) * L * 0.86, w, w * 0.86, L * 0.23, PALETTE.antOrca);
    }
    M.sph(0, 0, L * 0.44, 0.72 * s, 0.62 * s, 0.86 * s, PALETTE.antOrca, 8);
    // the white: chin, flank flash and eye patch. Three pieces, all of them
    // low on the body, because from above you should see almost none of it.
    M.box(0, -0.52 * s, L * 0.30, 1.10 * s, 0.34 * s, L * 0.44, PALETTE.antOrcaW);
    // the chin, which is what is pointed at you in a spy-hop
    M.box(0, -0.30 * s, L * 0.46, 0.78 * s, 0.44 * s, 0.62 * s, PALETTE.antOrcaW);
    for (let sd = -1; sd <= 1; sd += 2) {
      // the eye patch: an oval above and behind the eye, and it is the one
      // marking anybody can name
      M.box(sd * 0.58 * s, 0.20 * s, L * 0.375, 0.26 * s, 0.24 * s, 0.66 * s, PALETTE.antOrcaW);
      // ...and the flank flash, which sweeps UP the side behind the belly
      M.box(sd * 0.66 * s, -0.26 * s, -L * 0.14, 0.20 * s, 0.34 * s, 1.0 * s,
            PALETTE.antOrcaW, 0, 0, sd * 0.30);
    }
    // the saddle, immediately behind the fin, and it is the read from above
    M.box(0, 0.52 * s, -L * 0.10, 1.02 * s, 0.16 * s, 1.5 * s, PALETTE.antOrcaSaddle);
    // pectorals
    for (let sd = -1; sd <= 1; sd += 2) {
      M.box(sd * 0.95 * s, -0.34 * s, L * 0.20, 1.30 * s, 0.14 * s, 0.85 * s,
            PALETTE.antOrca, 0, sd * 0.32, sd * 0.22);
    }

    const mesh = new THREE.Mesh(M.build(), antVC());
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    antPodGroup.add(mesh);
    antPodParts.push(mesh);

    // THE DORSAL, ON A HINGE (ROADMAP-WOW Part C). A bull's is 1.8 m and it
    // is straight; a female's is half that and it hooks. Its own mesh on a
    // pivot at the back, so it can lean through the breach's roll the way
    // two metres of unsupported cartilage does when the animal leaves the
    // water — the one thing on a breaching orca that moves against the body.
    const D = antMerger();
    if (bull) {
      D.box(0, 1.05 * s, 0, 0.20 * s, 2.10 * s, 0.90 * s, PALETTE.antOrca, 0.10, 0, 0);
    } else {
      D.box(0, 0.58 * s, 0, 0.18 * s, 1.15 * s, 0.80 * s, PALETTE.antOrca, 0.30, 0, 0);
    }
    const fin = new THREE.Mesh(D.build(), mesh.material);
    fin.position.set(0, (bull ? 0.05 : 0.12) * s, -L * 0.02);
    fin.castShadow = true; fin.frustumCulled = false;
    mesh.add(fin);
    antPodFins.push(fin);
    // ...AND THE FLUKES BEAT. The tail was a slab baked on the end of the
    // body; it is on a hinge at the tail-stock now and pitches on the same
    // porpoising phase the body rises on, a quarter ahead of it — the stroke
    // that drives the rise, drawn.
    const F = antMerger();
    F.box(0, 0, -0.40 * s, 2.30 * s, 0.16 * s, 0.75 * s, PALETTE.antOrca);
    const fl = new THREE.Mesh(F.build(), mesh.material);
    fl.position.set(0, 0, -L * 0.50 + 0.40 * s);
    fl.castShadow = true; fl.frustumCulled = false;
    mesh.add(fl);
    antPodFlukes.push(fl);
  }
  root.add(antPodGroup);

  // the blow: one puff of vapour, reused by whichever animal surfaced last
  const blow = new THREE.Mesh(antG.sph6.clone(),
    mat(PALETTE.antPetrel, { transparent: true, opacity: 0.5, depthWrite: false }));
  blow.scale.set(1.2, 2.2, 1.2);
  blow.visible = false;
  blow.name = 'antBlow';
  antPodGroup.add(blow);
}

// ------------------------------------------------------------------ birds ---
function antBuildPenguins(root) {
  // ONE instanced mesh for fifty-six gentoos. A penguin is a bowling pin with
  // a black back, and at this camera distance that is genuinely all it is.
  const M = antMerger();
  M.box(0, 0.30, 0, 0.34, 0.60, 0.30, PALETTE.antPeng);
  M.box(0, 0.30, 0.10, 0.28, 0.52, 0.16, PALETTE.antPengW);
  M.box(0, 0.66, 0.02, 0.26, 0.20, 0.26, PALETTE.antPeng);
  M.box(0, 0.66, 0.06, 0.15, 0.11, 0.20, PALETTE.antPengW);
  M.box(0, 0.64, 0.17, 0.06, 0.06, 0.14, PALETTE.antPengBill);
  M.box(0, 0.74, 0.02, 0.20, 0.05, 0.16, PALETTE.antPengW);   // the eye stripe
  for (let s = -1; s <= 1; s += 2) {
    M.box(s * 0.19, 0.32, 0, 0.06, 0.34, 0.16, PALETTE.antPeng, 0, 0, s * 0.18);
    M.box(s * 0.08, 0.03, 0.03, 0.10, 0.06, 0.20, PALETTE.antPengBill);
  }
  const geo = M.build();
  const m = new THREE.InstancedMesh(geo, antVC(), antPENG_N);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.castShadow = true;
  m.frustumCulled = false;
  // ...AND A THIRD OF A ROOKERY IN JANUARY IS CHICKS. They are grey, they are
  // two thirds the size, they never leave the nest and they are the single
  // most obvious thing about a colony in the one month anybody visits one.
  // One instanceColor multiplies the whole bird, so a chick comes out grey
  // where the adult is white and near-black where it is black, which is
  // exactly what a gentoo chick looks like.
  const pc = new Float32Array(antPENG_N * 3);
  for (let i = 0; i < antPENG_N * 3; i++) pc[i] = 1;
  // x, z, yaw, mode (0 stand, 1 walk the highway, 2 toboggan), u along track, speed,
  // and then FOUR MORE, which are the pebble raid: where this bird lives and
  // where it has gone to steal from. See the note in antUpdatePenguins.
  antPengData = new Float32Array(antPENG_N * antPENG_S);
  antPengScale = new Float32Array(antPENG_N);
  for (let i = 0; i < antPENG_N; i++) antPengScale[i] = 1;
  for (let i = 0; i < antPENG_N; i++) {
    const o = i * antPENG_S;
    if (i < antPENG_COL) {
      // ON THE NESTS, in order, and the ones past the end of the list are the
      // birds standing about between them — which is also what a rookery looks
      // like, because a third of them are away at sea and their mates are not.
      // ---- AND THE CHICKS NEVER EXISTED --------------------------------
      //
      // `antNests` holds an x AND a z per nest, so `antNests.length / 2` is
      // the NUMBER OF NESTS — about a hundred and four of them — and this loop
      // runs to `antPENG_COL`, which is a hundred. `spare = i >= 104` was
      // therefore false on every single iteration for the whole life of the
      // chapter. Nothing below it ever ran: no bird ever stood BETWEEN the
      // nests, and the quarter of them that are meant to be chicks — grey,
      // two thirds the size, "the single most obvious thing about a colony in
      // the one month anybody visits one" — were never once drawn. One
      // instanceColor array and one scale array, both allocated, both written
      // to nothing but 1.
      //
      // The count is what decides it now: a third of the colony are the birds
      // standing about between the nests, and the nest list is walked with a
      // modulus so it does not matter which is longer.
      const nests = Math.max(1, Math.floor(antNests.length / 2));
      const spare = i >= Math.min(nests, Math.floor(antPENG_COL * 0.66));
      const ni = i % nests;
      const nx = antNests.length ? antNests[(ni | 0) * 2] : antCOLONY.x;
      const nz = antNests.length ? antNests[(ni | 0) * 2 + 1] : antCOLONY.z;
      if (spare) {
        const a = rand(0, 6.283), r = rand(0.7, 1.9);
        antPengData[o] = nx + Math.cos(a) * r;
        antPengData[o + 1] = nz + Math.sin(a) * r;
        // ...and half of those is a chick, standing beside its parent. In
        // January a gentoo colony is very nearly half chicks and they are the
        // reason anybody goes in January.
        if (i % 2 === 1) {
          antPengScale[i] = rand(0.52, 0.70);
          antCol.set(PALETTE.antScree);
          pc[i * 3] = antCol.r; pc[i * 3 + 1] = antCol.g; pc[i * 3 + 2] = antCol.b;
        }
      } else {
        antPengData[o] = nx;
        antPengData[o + 1] = nz;
      }
      antPengData[o + 2] = rand(0, 6.283);
      antPengData[o + 3] = 0;
      // where it lives, and the neighbour it is going to rob. Both are fixed
      // for the life of the chapter — a gentoo has ONE nest and it steals from
      // whoever is next to it, every day, for the whole season.
      antPengData[o + 6] = antPengData[o];
      antPengData[o + 7] = antPengData[o + 1];
      const tn = (ni + 3 + (i % 5)) % nests;
      antPengData[o + 8] = antNests.length ? antNests[(tn | 0) * 2] : antCOLONY.x;
      antPengData[o + 9] = antNests.length ? antNests[(tn | 0) * 2 + 1] : antCOLONY.z;
      antPengData[o + 5] = 0;                 // not on a raid
    } else {
      antPengData[o + 3] = i % 3 === 0 ? 2 : 1;
      antPengData[o + 4] = rand(0, 1);
      antPengData[o + 5] = (i % 2 ? 1 : -1) * (antPengData[o + 3] === 2 ? rand(0.09, 0.15) : rand(0.028, 0.05));
    }
  }
  m.instanceColor = new THREE.InstancedBufferAttribute(pc, 3);
  antPengMesh = m;
  root.add(m);

  // ...and a dozen of them in the water, which is where a gentoo is actually
  // fast. They porpoise, which is the only reason anybody knows what they are.
  const S = antMerger();
  S.box(0, 0, 0, 0.30, 0.28, 0.80, PALETTE.antPeng);
  S.box(0, -0.10, 0.06, 0.24, 0.14, 0.66, PALETTE.antPengW);
  S.box(0, 0.02, 0.46, 0.18, 0.16, 0.24, PALETTE.antPeng);
  S.box(0, 0.02, 0.60, 0.06, 0.06, 0.14, PALETTE.antPengBill);
  const sm = new THREE.InstancedMesh(S.build(), antVC(), antSWIM_N);
  sm.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  sm.frustumCulled = false;
  antSwimData = new Float32Array(antSWIM_N * 3);   // phase along the line, lane, speed
  for (let i = 0; i < antSWIM_N; i++) {
    antSwimData[i * 3] = rand(0, 1);
    antSwimData[i * 3 + 1] = rand(-7, 7);
    antSwimData[i * 3 + 2] = rand(0.030, 0.044);
  }
  antSwimPeng = sm;
  root.add(sm);
}

function antBuildBirds(root) {
  // SNOW PETRELS. Pure white, and there is nothing else in the world that is.
  // They are here to give the glacier a SIZE — a forty-metre wall of ice with
  // nothing in front of it could be four metres or four hundred.
  const M = antMerger();
  M.box(0, 0, 0, 0.14, 0.10, 0.42, PALETTE.antPetrel);
  M.box(0, 0.01, 0.24, 0.09, 0.07, 0.14, PALETTE.antPetrel);
  for (let s = -1; s <= 1; s += 2) {
    M.box(s * 0.36, 0.03, -0.02, 0.62, 0.04, 0.20, PALETTE.antPetrel, 0, s * 0.16, s * 0.10);
  }
  const m = new THREE.InstancedMesh(M.build(), antVC(), antPETREL_N);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.frustumCulled = false;
  antPetrelData = new Float32Array(antPETREL_N * 4);   // ang, r, y, spd
  for (let i = 0; i < antPETREL_N; i++) {
    const o = i * 4;
    antPetrelData[o] = rand(0, 6.283);
    antPetrelData[o + 1] = rand(16, 54);
    antPetrelData[o + 2] = rand(9, 26);
    antPetrelData[o + 3] = rand(0.20, 0.36) * (i % 2 ? 1 : -1);
  }
  antPetrels = m;
  root.add(m);

  // ---- CAPE PETRELS, AND THE GATE HAD NOTHING ALIVE IN IT ----------------
  //
  // The snow petrels are on the glacier because that is where a scale
  // reference was needed. The gate — the one piece of pilotage in the chapter,
  // the place the world closes in and the tide runs at three knots — was two
  // headlands and a gap. Every cliff at sixty-five south has a colony on it,
  // and the one anybody who has been on that water can name is the cape petrel:
  // pied, chequered black and white on the upper wing, and they do not soar,
  // they FLICK — a few fast beats and then a glide, in a loose swarm, round
  // and round the headland all day. It gives the gate a size, it gives the
  // narrows a sound, and it is the reason the passage feels like arriving
  // somewhere rather than driving past a rock.
  const C = antMerger();
  C.box(0, 0, 0, 0.13, 0.09, 0.36, PALETTE.antPeng);
  C.box(0, -0.02, 0.04, 0.10, 0.06, 0.28, PALETTE.antPengW);
  C.box(0, 0.01, 0.21, 0.08, 0.07, 0.13, PALETTE.antPeng);
  for (let s = -1; s <= 1; s += 2) {
    // the chequer: the wing is half black and half white, in two pieces,
    // which is the entire identification and reads from thirty metres
    C.box(s * 0.20, 0.03, -0.01, 0.34, 0.035, 0.19, PALETTE.antPengW, 0, s * 0.14, s * 0.08);
    C.box(s * 0.46, 0.04, -0.02, 0.30, 0.035, 0.15, PALETTE.antPeng, 0, s * 0.18, s * 0.14);
  }
  const cm = new THREE.InstancedMesh(C.build(), antVC(), antCAPE_N);
  cm.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cm.frustumCulled = false;
  antCapeData = new Float32Array(antCAPE_N * 4);   // ang, r, y, spd
  for (let i = 0; i < antCAPE_N; i++) {
    const o = i * 4;
    antCapeData[o] = rand(0, 6.283);
    antCapeData[o + 1] = rand(24, 96);
    antCapeData[o + 2] = rand(6, 44);
    antCapeData[o + 3] = rand(0.12, 0.26) * (i % 2 ? 1 : -1);
  }
  antCapes = cm;
  root.add(cm);

  // THE SKUA. One. It works the colony, it is a bully, and it is the only
  // thing in this chapter that is actively up to something.
  const S = antMerger();
  S.box(0, 0, 0, 0.26, 0.20, 0.62, PALETTE.antSkua);
  S.box(0, 0.03, 0.36, 0.16, 0.14, 0.22, PALETTE.antSkua);
  S.box(0, 0.02, 0.50, 0.07, 0.07, 0.14, PALETTE.antRockDk);
  for (let s = -1; s <= 1; s += 2) {
    S.box(s * 0.48, 0.05, -0.04, 0.82, 0.05, 0.28, PALETTE.antSkua, 0, s * 0.20, s * 0.12);
  }
  S.box(0, 0, -0.40, 0.22, 0.05, 0.32, PALETTE.antSkua);
  antSkua = new THREE.Mesh(S.build(), antVC());
  antSkua.castShadow = true;
  antSkua.frustumCulled = false;
  root.add(antSkua);
}

// ------------------------------------------------------------------ seals ---
/**
 * THE LEOPARD SEAL, and it is the wrong shape on purpose.
 *
 * Everything else on the ice down there is a barrel with a face. This is three
 * metres of neck with a head like a snake's on the end of it, and the whole
 * reason it is frightening is the proportion — so the head is nearly as wide
 * as the shoulders and the jaw is on its own node, because the gape IS the
 * animal. It never attacks. It looks at you, which is worse.
 */
function antBuildSeals(game, root) {
  const g = new THREE.Group();
  const M = antMerger();
  for (let k = 0; k < 5; k++) {
    const t = k / 4;
    const w = 1.05 - 0.62 * t;
    M.box(0, 0, (0.5 - t) * 3.4, w, w * 0.80, 0.90, PALETTE.antSealHide);
  }
  M.box(0, -0.28, 0.3, 0.90, 0.36, 2.4, PALETTE.antSealBelly);
  M.box(0, 0, -1.85, 1.30, 0.14, 0.70, PALETTE.antSealHide);
  for (let s = -1; s <= 1; s += 2) {
    M.box(s * 0.60, -0.18, 0.55, 0.70, 0.12, 0.44, PALETTE.antSealHide, 0, s * 0.4, 0);
  }
  const body = new THREE.Mesh(M.build(), antVC());
  body.castShadow = true;
  g.add(body);

  const H = antMerger();
  H.box(0, 0, 0.42, 0.66, 0.46, 1.10, PALETTE.antSealHide);
  H.box(0, 0.18, 0.98, 0.44, 0.26, 0.42, PALETTE.antSealHide);
  for (let s = -1; s <= 1; s += 2) {
    H.box(s * 0.20, 0.20, 0.72, 0.09, 0.09, 0.09, PALETTE.antRockDk);
  }
  antSealHead = new THREE.Mesh(H.build(), antVC());
  antSealHead.position.set(0, 0.30, 1.55);
  g.add(antSealHead);

  const J = antMerger();
  J.box(0, -0.16, 0.50, 0.50, 0.20, 1.02, PALETTE.antSealHide);
  J.box(0, -0.06, 0.52, 0.40, 0.06, 0.94, PALETTE.antSealBelly);
  antSealJaw = new THREE.Mesh(J.build(), antVC());
  antSealHead.add(antSealJaw);

  g.visible = true;
  antSealGroup = g;
  root.add(g);

  // A WEDDELL SEAL, on the beach, asleep, and it stays asleep. It is on no
  // list, it wants nothing, and it is the only thing in the chapter that is
  // having a nicer time than you are.
  const W = antMerger();
  for (let k = 0; k < 5; k++) {
    const t = k / 4;
    const w = 1.20 - 0.55 * t;
    W.box(0, 0, (0.5 - t) * 2.9, w, w * 0.72, 0.78, PALETTE.antWeddell);
  }
  W.sph(0, 0.12, 1.55, 0.46, 0.40, 0.52, PALETTE.antWeddell, 8);
  W.box(0, 0.06, 1.92, 0.24, 0.12, 0.18, PALETTE.antRockDk);
  W.box(0, 0, -1.60, 1.10, 0.12, 0.60, PALETTE.antWeddell);
  antWeddell = new THREE.Mesh(W.build(), antVC());
  antWeddell.castShadow = true;
  const wy = antLandOnly(antWHAL.x - 4, antWHAL.z - 16);
  antWeddell.position.set(antWHAL.x - 4, wy + 0.55, antWHAL.z - 16);
  antWeddell.rotation.y = 1.1;
  root.add(antWeddell);
  // ...AND THREE HUNDRED KILOS OF SEAL IS A SOLID OBJECT. It was a hologram:
  // the one thing in the chapter that is having a nicer time than you are, and
  // you walked straight through the middle of it on the way to the whale bones
  // eighteen metres away. Low, because it is a thing you could step onto and
  // it would rather you did not.
  antStaticBox(game, antWHAL.x - 4, wy + 0.45, antWHAL.z - 16, 1.5, 0.9, 3.6, 1.1);
}

/**
 * WHAT IS ACTUALLY ON THE GROUND DOWN THERE, AND FOR ITS WHOLE LIFE THERE WAS
 * NOTHING ON IT AT ALL.
 *
 * Photographed from the spawn, from the rookery and from the top of the
 * glacier, the land in this chapter is a perfectly smooth grey-white dome the
 * size of the screen. Three huts, a mast, a line of flags and four thousand
 * penguins are standing on two hundred thousand square metres of undisturbed
 * plaster — which is the world-size failure this game has measured in five
 * chapters already, and it is worse here than anywhere because there is
 * nothing to hide it: no trees, no buildings and no colour.
 *
 * Three populations, and each one is a real feature of the place rather than
 * filler:
 *
 *   OUTCROP — the peninsula is bare rock wherever the wind keeps the snow off,
 *     which is every ridge and every steep face. It is the only dark thing in
 *     the chapter and it is what the penguins build their nests out of.
 *   SASTRUGI — the wind carves the snow into hard parallel ridges, always
 *     aligned with it, and they are the single most recognisable thing about
 *     the surface of Antarctica from above. They also give the slip fields a
 *     grain, so a slide down the snow reads as a slide.
 *   STRANDLINE — everything the tide brings in ends up on the shore and stays
 *     there, because nothing melts. A rim of stranded growlers is the line
 *     between the sea and the land, and the shore had no line at all.
 */
function antBuildShore(game, root) {
  // ---- the keep-outs, once ------------------------------------------------
  const clear = function (x, z) {
    if (antHighwayD(x, z) >= 0 && antHighwayD(x, z) < antHIGH_W * 2.0) return false;
    if (antStationPathD(x, z) >= 0 && antStationPathD(x, z) < 3.4) return false;
    const dc = Math.hypot(x - antCOLONY.x, z - antCOLONY.z);
    if (dc < antCOLONY.r + 2) return false;
    if (Math.hypot(x - antHUTS.x, z - antHUTS.z) < 12) return false;
    if (antInZone('jetty', x, z)) return false;
    if (Math.hypot(x - antBONES.x, z - antBONES.z) < 14) return false;
    if (Math.hypot(x - (antWHAL.x - 14), z - (antWHAL.z + 6)) < 12) return false;
    // ...AND NO SNOW ON THE BLACK BEACH. The sastrugi test is "above the snow
    // line or on the ice cap", and the whalers dome peaks at eight metres —
    // one and a half above the line — so eight-metre white ridges were being
    // carved into a beach of basalt shingle that the ground mesh has just
    // been taught to paint nearly black. Photographed from the bones, a plank
    // of snow lying across the middle of it.
    const wu2 = (x - antWHAL.x) / antWHAL.rx, wv2 = (z - antWHAL.z) / antWHAL.rz;
    if (wu2 * wu2 + wv2 * wv2 < 1.20) return false;
    if (antGlacierH(x, z) > antWATER - 1.0) return false;      // the ramp stays clean
    return true;
  };

  // ---- OUTCROP ------------------------------------------------------------
  //
  // SAMPLED INSIDE THE THREE PLACES THERE IS LAND, not over the whole
  // four-hundred-by-five-hundred-metre world. Ninety-five per cent of this
  // map is sea, so rejection-sampling the box put one rock every three hundred
  // and forty square metres of the ground anybody ever stands on — which,
  // measured from the standard rig, is one and a bit in the frame, and one
  // rock in a frame is a rock rather than a landscape.
  //
  // And it is two BOXES rather than two spheres: Antarctic rock is
  // frost-shattered, so it is angular, and twenty-four triangles buys the same
  // read as seventy-two.
  {
    const M = antMerger();
    M.box(0, 0, 0, 1, 0.66, 0.88, PALETTE.antRock, 0.12, 0.4, 0.1);
    M.box(0.30, 0.18, -0.22, 0.66, 0.44, 0.60, PALETTE.antScree, -0.2, 1.1, 0.16);
    // FOUR HUNDRED AND EIGHTY, AND WEIGHTED HARDER ONTO THE STATION. The
    // station is the only dome the player walks the whole of, and it was
    // sharing a three-in-seven weight with three headlands nobody lands on.
    const N = 480;
    const m = new THREE.InstancedMesh(M.build(), antVC(), N);
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    const spots = [[antSTN, 5], [antWHAL, 3], [antWBAST, 1], [antEBAST, 1]];
    let wsum = 0;
    for (let k = 0; k < spots.length; k++) wsum += spots[k][1];
    let bR = antPoolBody(game), nB = 0, n = 0;
    for (let i = 0; i < N * 10 && n < N; i++) {
      let pick = Math.random() * wsum, D = spots[0][0];
      for (let k = 0; k < spots.length; k++) { pick -= spots[k][1]; if (pick <= 0) { D = spots[k][0]; break; } }
      const a = rand(0, 6.283), r = Math.sqrt(Math.random()) * 1.06;
      const x = D.x + Math.cos(a) * r * D.rx, z = D.z + Math.sin(a) * r * D.rz;
      const h = antLandOnly(x, z);
      if (h < antWATER + 0.6 || !clear(x, z)) continue;
      // where the wind keeps it bare: the steep ground and the ridges
      const sl = antSlope(x, z);
      if (Math.random() > clamp(sl * 1.9, 0.34, 1)) continue;
      const s = rand(0.5, 2.2);
      antM.compose(antV3.set(x, h + s * 0.16, z),
                   antQ.setFromEuler(antE.set(rand(-0.2, 0.2), rand(0, 6.28), rand(-0.2, 0.2))),
                   antSc.set(s, s * rand(0.6, 1.1), s * rand(0.8, 1.3)));
      m.setMatrixAt(n++, antM);
      // a low box, so it is a STEP and not a wall: the way up this hill is
      // over them, and a capybara clears 0.40
      antPoolBox(bR, x, h + s * 0.13, z, s * 0.82, s * 0.13, s * 0.82);
      if (++nB >= 16) { antPoolDone(game, bR); bR = antPoolBody(game); nB = 0; }
    }
    antPoolDone(game, bR);
    m.count = n;
    root.add(m);
  }

  // ---- SASTRUGI -----------------------------------------------------------
  {
    const g = new THREE.BoxGeometry(1, 1, 1);
    // FIVE HUNDRED. Three hundred sastrugi over two hundred thousand square
    // metres of snow is one every six hundred and fifty — from the standard
    // rig that is under one in the frame, and one ridge in a frame is a stick
    // lying in the snow rather than a surface with a grain.
    const N = 500;
    const m = new THREE.InstancedMesh(g, mat(PALETTE.antIce, { flatShading: true }), N);
    m.receiveShadow = true;
    m.frustumCulled = false;
    let n = 0;
    for (let i = 0; i < N * 6 && n < N; i++) {
      const x = rand(-206, 206), z = rand(-430, 120);
      const h = antLandOnly(x, z);
      // snow only: above the snow line, or anywhere on the ice cap
      const onIce = antGlacierH(x, z) > antWATER;
      if (!onIce && (h < 6.5 || !clear(x, z))) continue;
      if (onIce && Math.random() < 0.5) continue;
      const len = rand(2.5, 8), wide = rand(0.55, 1.30);
      // A SASTRUGA IS A RIDGE, NOT A PLANK. A flat box eight metres long with
      // a horizontal top face catches the light across its whole width and
      // photographs as a white batten lying in the snow — measured twice, from
      // the rookery and from the landing. A diamond cross-section buried to
      // two thirds of its depth leaves a soft triangular ridge with one lit
      // flank and one shaded one, which is what the wind actually carves and
      // what makes a snowfield read as a surface rather than as a sheet.
      //
      // ALIGNED WITH THE WIND, which down here always comes off the ice cap —
      // the same wind the flag line streams in and the spindrift blows down.
      // Sastrugi that point in random directions are dunes, not sastrugi.
      antM.compose(antV3.set(x, (onIce ? antGlacierH(x, z) : h) - wide * 0.30, z),
                   antQ.setFromEuler(antE.set(0, 1.32 + rand(-0.16, 0.16), Math.PI / 4, 'YXZ')),
                   antSc.set(wide, wide, len));
      m.setMatrixAt(n++, antM);
    }
    m.count = n;
    root.add(m);
  }

  // ---- THE STRANDLINE -----------------------------------------------------
  {
    const M = antMerger();
    M.box(0, 0, 0, 1, 0.72, 0.86, PALETTE.antBergLt);
    M.box(0.2, 0.34, 0.1, 0.7, 0.34, 0.6, PALETTE.antIceLt);
    M.box(0, -0.30, 0, 1.06, 0.30, 0.92, PALETTE.antBlue);
    const N = 130;
    const m = new THREE.InstancedMesh(M.build(), antVC(), N);
    m.castShadow = true;
    m.frustumCulled = false;
    let bS = antPoolBody(game), nB = 0, n = 0;
    for (let i = 0; i < N * 10 && n < N; i++) {
      const x = rand(-212, 212), z = rand(-430, 120);
      const h = antLandOnly(x, z);
      // the band the tide reaches, and nothing here ever melts out of it
      if (h < antWATER - 0.1 || h > antWATER + 1.5) continue;
      if (antInZone('jetty', x, z)) continue;
      if (antGlacierH(x, z) > antWATER - 1.0) continue;
      const s = rand(0.7, 2.6);
      antM.compose(antV3.set(x, h + s * 0.28, z),
                   antQ.setFromEuler(antE.set(rand(-0.3, 0.3), rand(0, 6.28), rand(-0.3, 0.3))),
                   antSc.set(s, s * rand(0.6, 1.0), s * rand(0.8, 1.2)));
      m.setMatrixAt(n++, antM);
      if (s > 1.5) {
        antPoolBox(bS, x, h + s * 0.24, z, s * 0.5, s * 0.24, s * 0.45);
        if (++nB >= 16) { antPoolDone(game, bS); bS = antPoolBody(game); nB = 0; }
      }
    }
    antPoolDone(game, bS);
    m.count = n;
    root.add(m);
  }
}

/**
 * THE GATE, AND IT WAS TWO SMOOTH GREY MOUNDS.
 *
 * "Two bastions squeezing the fairway to about a hundred and sixty metres —
 * you cannot get north without going between them, which is the same trick the
 * Harbour Bridge plays in chapter 3." It is the one piece of pilotage in the
 * chapter and the one moment on the passage where the world closes in, and
 * both sixty-two-metre headlands were drawn by `antDome` and then left
 * entirely alone: photographed from the fairway, the gate is two bare
 * hemispheres with a scatter of pebbles on them.
 *
 * What makes a headland at sixty-five south read as one is four things, and
 * not one of them is expensive:
 *
 *   THE CLIFF. It does not slope into the sea, it stops. A band of near-black
 *     rock at the waterline all the way round the seaward face, which is also
 *     the only dark thing between the station and the shelf.
 *   THE CORNICE. Two hundred days of wind off the ice cap builds an overhang
 *     of snow along the leeward crest, and it is the silhouette everybody
 *     recognises.
 *   THE TALUS. Everything the cliff drops piles at its own foot at the angle
 *     of repose, in a fan.
 *   THE STACKS. Where the cliff has failed completely there is a pillar left
 *     standing offshore. It is the thing that tells you the gap is a GAP.
 */
function antBuildGate(game, root) {
  const M = antMerger();
  const both = [antWBAST, antEBAST];
  for (let b = 0; b < 2; b++) {
    const B = both[b];
    const inward = b === 0 ? 1 : -1;         // toward the fairway
    // ---- the sea cliff, round the whole seaward quadrant ----------------
    for (let i = 0; i < 30; i++) {
      const a = -1.2 + (i / 29) * 2.4;       // the face that looks at the boat
      const ax = B.x + inward * Math.cos(a) * B.rx * 0.99;
      const az = B.z + Math.sin(a) * B.rz * 0.99;
      const h = antLandOnly(ax, az);
      if (h < antWATER - 2) continue;
      const ch = clamp(h * 0.9 + 4, 5, 26);
      M.box(ax, antWATER + ch * 0.42, az, 16, ch, 16,
            i % 3 ? PALETTE.antRockDk : PALETTE.antRock,
            0, -a * inward, inward * 0.06);
      // the wave-cut notch at the waterline, which is the line the eye reads
      M.box(ax, antWATER + 0.5, az, 17.5, 1.6, 17.5, PALETTE.antRockDk, 0, -a * inward, 0);
    }
    // ---- the cornice along the crest ------------------------------------
    for (let i = 0; i < 14; i++) {
      const a = -0.9 + (i / 13) * 1.8;
      const cxp = B.x + inward * Math.cos(a) * B.rx * 0.34;
      const czp = B.z + Math.sin(a) * B.rz * 0.34;
      const h = antLandOnly(cxp, czp);
      if (h < 20) continue;
      M.box(cxp, h + 1.6, czp, 22, 3.2, 20, PALETTE.antIceLt, 0, -a * inward, inward * 0.10);
      // the lip of it, hanging out over the drop
      M.box(cxp + inward * 11, h + 2.6, czp, 7, 1.6, 18, PALETTE.antBergLt,
            0, -a * inward, inward * 0.22);
    }
    // ---- the talus fan at the foot --------------------------------------
    let bT = antPoolBody(game), nT = 0;
    for (let i = 0; i < 110; i++) {
      const a = rand(-1.4, 1.4);
      const r = 0.86 + Math.random() * 0.30;
      const tx = B.x + inward * Math.cos(a) * B.rx * r;
      const tz = B.z + Math.sin(a) * B.rz * r;
      const h = antLandOnly(tx, tz);
      if (h < antWATER - 0.6 || h > 30) continue;
      const s = rand(1.0, 5.0);
      M.box(tx, h + s * 0.24, tz, s, s * 0.62, s * 0.9,
            i % 3 ? PALETTE.antScree : PALETTE.antRockDk,
            rand(-0.25, 0.25), rand(0, 6.28), rand(-0.25, 0.25));
      if (s > 3) {
        antPoolBox(bT, tx, h + s * 0.22, tz, s * 0.5, s * 0.22, s * 0.45);
        if (++nT >= 16) { antPoolDone(game, bT); bT = antPoolBody(game); nT = 0; }
      }
    }
    antPoolDone(game, bT);
    // ---- and two stacks standing off it in the fairway ------------------
    for (let k = 0; k < 2; k++) {
      const sx = B.x + inward * (B.rx * 1.02 + 14 + k * 26);
      const sz = B.z + (k ? 34 : -28);
      const sh = 15 - k * 4;
      // TAPERED, in three lifts. One box is a monolith; a sea stack is a
      // column the sea has been undercutting for ten thousand years, so it is
      // narrowest at the bottom and it has a bedding ledge or two on it.
      const sw = 9 - k * 2, sd = 8 - k * 2;
      const yaw = rand(0, 3);
      for (let m = 0; m < 3; m++) {
        const t = m / 2;
        M.box(sx, antWATER + sh * (0.16 + t * 0.36), sz,
              sw * (0.80 + t * 0.26), sh * 0.40, sd * (0.80 + t * 0.26),
              m === 1 ? PALETTE.antRock : PALETTE.antRockDk, 0, yaw + m * 0.22, 0.03);
      }
      // the ledge the birds sit on, and the snow cap
      M.box(sx, antWATER + sh * 0.66, sz, sw * 1.18, 0.6, sd * 1.18,
            PALETTE.antScree, 0, yaw + 0.4, 0);
      M.box(sx, antWATER + sh + 0.6, sz, sw * 0.92, 1.2, sd * 0.92, PALETTE.antIceLt, 0, yaw, 0);
      // and the wave-cut notch at its own foot
      M.box(sx, antWATER + 0.4, sz, sw * 0.72, 1.2, sd * 0.72, PALETTE.antRockDk, 0, yaw, 0);
      antStaticBox(game, sx, antWATER + sh * 0.5, sz, 9 - k * 2, sh, 8 - k * 2);
      // ...AND THE TENDER MUST KNOW IT IS THERE. She is kinematic and cannon
      // does not resolve kinematic against static, so a stack she can drive
      // straight through is a hologram — see antBlockedAt, which is the one
      // place the boat tests the world.
      antSTACKS.push(sx, sz, (9 - k * 2) * 0.5 + 1.2, (8 - k * 2) * 0.5 + 1.2);
    }
  }
  const mesh = new THREE.Mesh(M.build(), antVC());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  root.add(mesh);
}

/**
 * WHAT IS ACTUALLY ON A GLACIER, AND THERE WAS NOTHING ON THIS ONE AT ALL.
 *
 * Photographed standing on the blue tongue — which is one of the chapter's two
 * marquee RUNS, the ten-and-a-half-metre slide the glaciologist has a line
 * about — chapter 17 was a perfectly smooth pale blue plane filling the whole
 * frame, with four faint white scratches on it. A hundred and ten metres of
 * fall line and forty-six metres of rise, and the only thing telling you you
 * were moving was the number on the clock.
 *
 * `antGlacierH` does carry a crevasse term, and it cannot possibly show: it is
 * `pow(sin, 8)`, which is about four metres wide, sampled on a four-metre grid
 * and collided on a five-metre one. A feature narrower than the cell it is
 * drawn in does not exist. So the crevasses are GEOMETRY laid on the surface
 * instead — which is also correct, because what you see of a crevasse from
 * above is not a dip, it is a BLACK LINE with a white lip on either side of it.
 *
 * Five populations, and every one is a real thing on a real glacier:
 *
 *   CREVASSES — transverse, across the flow, opening where the slope steepens.
 *     The dark line is the whole read and it is what makes a slope a SLOPE.
 *   RUNNELS — meltwater cuts a channel straight down the fall line and
 *     polishes it, which is exactly where the blue comes from.
 *   SERACS — where the tongue reaches the sea it breaks up into blocks the
 *     size of houses. That is the calving face, and the calving event has been
 *     happening in front of a blank wall since the chapter shipped.
 *   MORAINE — a stripe of black rock down each margin, which is the only dark
 *     thing on the west side of the map and gives the eye something to
 *     measure forty metres of white against.
 *   ERRATICS — the boulders it has carried down and dropped.
 */
function antBuildGlacier(game, root) {
  const G = antGLAC;
  // TWO MESHES, AND THE SPLIT IS THE WHOLE LESSON OF THE FIRST CUT.
  //
  // Everything below is either a MARK ON THE SURFACE or a THING STANDING ON
  // IT, and they want opposite treatment. The first attempt put the lot in one
  // merged mesh with `castShadow = true` and gave the crevasse lips
  // thirty-four centimetres of relief and the runnels two metres of width — so
  // a hundred and thirty crevasses and twenty-six channels came out as a
  // scaffolding of white planks lying across a blue floor, each one throwing a
  // hard black shadow of its own. Photographed from the run it was a builder's
  // yard.
  //
  // A mark on a glacier is FLUSH: a change of colour with a couple of
  // centimetres of edge on it, and it never casts. What stands on one — the
  // seracs, the moraine, the erratics — is genuinely three-dimensional and
  // genuinely does. Two meshes, and the numbers on the first are about a fifth
  // of what they were.
  const D = antMerger();        // decals: flush, no shadow
  const M = antMerger();        // objects: solid, shadowed

  // ---- CREVASSES ---------------------------------------------------------
  // Transverse: they open across the flow, and the flow is in +x, so they run
  // in z. Denser where the ramp is steepest, which on a linear ramp with a
  // toe means the top two thirds.
  for (let i = 0; i < 118; i++) {
    const u = 0.10 + Math.pow(Math.random(), 0.75) * 0.88;
    const cx = G.xToe - u * (G.xToe - G.xTop);
    // BIASED ONTO THE TONGUE. The slab is two hundred and fifty metres of z
    // and the player only ever slides the ninety-six between antBLUE.z0 and
    // z1: an even scatter puts two thirds of the work where nobody goes.
    const cz = Math.random() < 0.62
      ? rand(antBLUE.z0 - 12, antBLUE.z1 + 12)
      : rand(G.z0 - 10, G.z1 + 10);
    const gh = antGlacierH(cx, cz);
    if (gh < antWATER + 1.5) continue;
    const len = rand(12, 38);
    const wide = rand(0.55, 1.5);
    // a crevasse leans with the ice: never quite square to the flow
    const yaw = rand(-0.30, 0.30) + 0.10;
    // the slot itself — dark, SUNK, and it is the whole thing
    D.box(cx, gh - 0.30, cz, wide, 0.72, len, PALETTE.antBlueDeep, 0, yaw, 0);
    // ...and the two lips, which is what says it is a HOLE and not a stripe.
    // Ten centimetres. At 0.34 they were kerbstones and they cast like them.
    for (let s = -1; s <= 1; s += 2) {
      D.box(cx + Math.cos(yaw) * s * (wide * 0.5 + 0.16), gh + 0.045,
            cz - Math.sin(yaw) * s * (wide * 0.5 + 0.16),
            0.34, 0.10, len * 0.96, PALETTE.antIceLt, 0, yaw, 0);
    }
    // and a bridge over part of it, half fallen in, which is the thing every
    // glaciologist in the world is frightened of
    if (i % 5 === 0) {
      D.box(cx, gh + 0.03, cz + rand(-len * 0.2, len * 0.2),
            wide * 1.4, 0.12, rand(2.0, 4.5), PALETTE.antIce, 0, yaw, 0);
    }
  }

  // ---- MELTWATER RUNNELS -------------------------------------------------
  // Down the fall line, so they run in +x. Shallow, polished, and the bluest
  // thing on the slab — which is also the honest explanation of why the tongue
  // is blue at all.
  for (let i = 0; i < 22; i++) {
    const rz = rand(G.z0, G.z1);
    const x0 = G.xTop + rand(24, 110);
    // NOT `antBlue`. The tongue's own vertex colour IS very nearly antBlue
    // (`snowLt.lerp(blue, 0.78)`), so half of every runnel was painted the
    // colour of the thing it was drawn on and vanished. A meltwater channel is
    // a dark slot with a POLISHED PALE LIP either side of it, and the lip is
    // most of what you see from above. Both of them NARROW: two metres of
    // channel with three quarters of a metre of lip on each side is a
    // four-and-a-half-metre ribbon, and twenty-two of those laid down the fall
    // line is a set of tram lines.
    //
    // AND IT WANDERS. Nine straight thirteen-metre boxes end to end is a
    // hundred and twenty metres of perfectly straight white line — a road
    // marking, not a stream. Water finds the fall line but never in a straight
    // line, so each segment is yawed to point at the next one and the channel
    // bends.
    let px = x0, pz = rz;
    for (let k = 0; k < 12; k++) {
      const nx = px + 7.5;
      const nz = rz + Math.sin(k * 0.62 + i) * 4.6 + Math.sin(k * 1.9 + i * 2) * 1.4;
      if (nx > G.xToe - 2) break;
      const cx = (px + nx) * 0.5, cz = (pz + nz) * 0.5;
      const gh = antGlacierH(cx, cz);
      if (gh < antWATER + 0.6) break;
      const yaw = -Math.atan2(nz - pz, nx - px);
      const len = Math.hypot(nx - px, nz - pz) * 1.08;
      D.box(cx, gh + 0.02, cz, len, 0.10, rand(0.45, 0.85),
            PALETTE.antBlueDeep, 0, yaw, 0);
      for (let s2 = -1; s2 <= 1; s2 += 2) {
        D.box(cx - Math.sin(yaw) * s2 * 0.62, gh + 0.05, cz - Math.cos(yaw) * s2 * 0.62,
              len * 0.98, 0.10, 0.30, PALETTE.antIceLt, 0, yaw, 0);
      }
      px = nx; pz = nz;
    }
  }

  // ---- THE GRAIN OF THE SURFACE -----------------------------------------
  //
  // The two runs in this chapter are the penguin highway at 8.8 m/s and the
  // blue tongue at 10.6, and a slide is only fast if there is something to be
  // fast PAST. A crevasse every twenty metres is a landmark; what makes the
  // ten seconds in between read as speed is the small stuff going by — sun
  // cups (which is what a melting ice surface actually turns into: a field of
  // shallow scallops a metre or two across), wind ripple, and the dust the
  // wind has laid in the hollows. Six hundred flat marks, twelve triangles
  // apiece, and it is the cheapest possible motion parallax.
  {
    // NOT `antVCI()`. That material carries `vertexColors: true`, and a bare
    // BoxGeometry has no colour attribute at all — so three feeds the shader a
    // missing attribute, which reads as zero, and six hundred sun cups came
    // out as SOLID BLACK QUADS scattered across the blue tongue. (Every other
    // instanced field in this file is a merged geometry that does carry one,
    // which is why it has never bitten before; the pack, which is also a bare
    // box, correctly uses a plain `mat()`.) White, and `instanceColor`
    // multiplies it, which is the whole point of the array below.
    const g2 = new THREE.BoxGeometry(1, 1, 1);
    const N = 950;
    const im = new THREE.InstancedMesh(g2, mat(0xffffff, { flatShading: true }), N);
    im.receiveShadow = true;
    im.frustumCulled = false;
    const cols = new Float32Array(N * 3);
    let n = 0;
    for (let i = 0; i < N * 5 && n < N; i++) {
      const cx = rand(G.xTop + 20, G.xToe + 6);
      const cz = Math.random() < 0.55 ? rand(antBLUE.z0 - 18, antBLUE.z1 + 18)
                                      : rand(G.z0 - 14, G.z1 + 14);
      const gh = antGlacierH(cx, cz);
      if (gh < antWATER + 0.8) continue;
      // SMALL. At up to 4.6 m across and near-white these read as sheets of
      // paper lying on the ice — the same failure as the sastrugi. A sun cup
      // is about a metre and there are thousands: the read is the STIPPLE.
      const s = rand(0.9, 2.4);
      antM.compose(antV3.set(cx, gh + 0.03, cz),
                   antQ.setFromEuler(antE.set(0, rand(0, 6.28), 0)),
                   antSc.set(s, 0.08, s * rand(0.5, 1.0)));
      im.setMatrixAt(n, antM);
      const r = Math.random();
      antCol.set(r < 0.36 ? PALETTE.antIceLt : r < 0.64 ? PALETTE.antBergLt
                : r < 0.92 ? PALETTE.antIceSh : PALETTE.antScree);
      cols[n * 3] = antCol.r; cols[n * 3 + 1] = antCol.g; cols[n * 3 + 2] = antCol.b;
      n++;
    }
    im.instanceColor = new THREE.InstancedBufferAttribute(cols, 3);
    im.count = n;
    root.add(im);
  }

  // ---- THE SERAC FACE AT THE TOE ----------------------------------------
  // Where the ice reaches the water it is not a ramp any more, it is a
  // forty-metre wall that falls over about once a minute — and `antUpdateCalving`
  // has been throwing twenty-four blocks off a smooth white slope since the
  // chapter shipped. This is the thing they come off.
  let bS = antPoolBody(game), nS = 0;
  for (let i = 0; i < 70; i++) {
    const cz = rand(G.z0 - 16, G.z1 + 16);
    const cx = G.xToe - rand(-2, 16);
    const gh = antGlacierH(cx, cz);
    if (gh < antWATER + 0.2 || gh > 22) continue;
    const s = rand(2.2, 6.5);
    const yaw = rand(0, 6.28);
    M.box(cx, gh - s * 0.15 + s * 0.5, cz, s * 0.9, s, s * 0.9,
          i % 3 ? PALETTE.antBergLt : PALETTE.antIceLt, rand(-0.18, 0.18), yaw, rand(-0.18, 0.18));
    // the blue at the foot of every one of them, because that is where the
    // old ice is exposed
    M.box(cx, gh - s * 0.15 + 0.5, cz, s * 0.95, 1.0, s * 0.95, PALETTE.antBlue, 0, yaw, 0);
    if (s > 3.6) {
      antPoolBox(bS, cx, gh + s * 0.28, cz, s * 0.45, s * 0.5, s * 0.45, yaw);
      if (++nS >= 16) { antPoolDone(game, bS); bS = antPoolBody(game); nS = 0; }
    }
  }
  antPoolDone(game, bS);
  // ...and the growlers in the water at the foot of it, which is where they
  // end up and stay
  for (let i = 0; i < 40; i++) {
    const cz = rand(G.z0 - 24, G.z1 + 24);
    const cx = G.xToe + rand(2, 30);
    if (antLandOnly(cx, cz) > antWATER - 0.4) continue;
    const s = rand(1.2, 4.2);
    M.box(cx, antWATER + s * 0.16, cz, s, s * 0.5, s * 0.86,
          i % 2 ? PALETTE.antBergLt : PALETTE.antBrash, rand(-0.2, 0.2), rand(0, 6.28), rand(-0.2, 0.2));
    M.box(cx, antWATER - 0.14, cz, s * 1.05, 0.34, s * 0.92, PALETTE.antBlue, 0, 0, 0);
  }

  // ---- THE MORAINE, down both margins -----------------------------------
  let bM = antPoolBody(game), nM = 0;
  for (let s = -1; s <= 1; s += 2) {
    const edge = s < 0 ? G.z0 - 18 : G.z1 + 18;
    for (let i = 0; i < 90; i++) {
      const cz = edge + rand(-11, 11);
      const cx = rand(G.xTop + 30, G.xToe + 6);
      const gh = antGlacierH(cx, cz);
      if (gh < antWATER + 0.4) continue;
      const rs = rand(0.5, 2.8);
      M.box(cx, gh + rs * 0.22, cz, rs, rs * 0.6, rs * 0.9,
            i % 3 ? PALETTE.antRockDk : PALETTE.antScree,
            rand(-0.2, 0.2), rand(0, 6.28), rand(-0.2, 0.2));
      if (rs > 2.0) {
        antPoolBox(bM, cx, gh + rs * 0.20, cz, rs * 0.5, rs * 0.20, rs * 0.46);
        if (++nM >= 16) { antPoolDone(game, bM); bM = antPoolBody(game); nM = 0; }
      }
    }
  }
  antPoolDone(game, bM);

  // ---- and the erratics it has carried down and dropped on the tongue ----
  for (let i = 0; i < 22; i++) {
    const cx = rand(G.xTop + 50, G.xToe - 8), cz = rand(G.z0, G.z1);
    const gh = antGlacierH(cx, cz);
    if (gh < antWATER + 1) continue;
    const rs = rand(0.8, 2.4);
    M.box(cx, gh + rs * 0.30, cz, rs, rs * 0.7, rs * 1.1,
          PALETTE.antRock, rand(-0.2, 0.2), rand(0, 6.28), rand(-0.2, 0.2));
    // a pedestal of ice under it, because a dark rock melts its own plinth
    D.cyl(cx, gh + 0.10, cz, rs * 0.7, 0.22, PALETTE.antIceSh, 0, 0, 0, 6);
  }

  const dm = new THREE.Mesh(D.build(), antVCI());
  dm.castShadow = false;
  dm.receiveShadow = true;
  dm.frustumCulled = false;
  root.add(dm);
  const mesh = new THREE.Mesh(M.build(), antVCI());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  root.add(mesh);
}

/**
 * THE SPINDRIFT, AND IT IS THE PICTURE OF THE PLACE.
 *
 * Every photograph anybody has ever taken of an Antarctic glacier has a metre
 * of snow streaming off the top of it, and this chapter's forty-metre ramp had
 * nothing moving on it at all — which is why, photographed, it could be four
 * metres tall or four hundred. The petrels were put in for exactly this reason
 * ("to give the glacier a SIZE") and twenty-six birds over a slab that big is
 * not enough. A hundred and twenty flat streaks blowing downhill, biased to
 * the crests where a real one comes off, is the cheapest scale reference there
 * is and it costs one instanced draw of two triangles apiece.
 */
function antBuildDrift(root) {
  const g = new THREE.PlaneGeometry(1, 1);
  g.rotateX(-Math.PI / 2);
  // FAINT AND NARROW. At 0.30 opacity and a metre and a half across, a hundred
  // and twenty of these photographed as sheets of paper blowing down a hill —
  // hard-edged, evenly spaced, and each one about the size of a penguin. Snow
  // in a katabatic wind is a THREAD: it is mostly transparent, it is twenty
  // times longer than it is wide, and the only reason you can see it at all is
  // that there are thousands of them.
  antDriftMesh = new THREE.InstancedMesh(g, mat(PALETTE.antIceLt, {
    transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide, fog: true,
  }).clone(), antDRIFT_N);
  antDriftMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  antDriftMesh.frustumCulled = false;
  antDriftMesh.renderOrder = 3;
  antDriftData = new Float32Array(antDRIFT_N * 4);   // x, z, t, life
  for (let i = 0; i < antDRIFT_N; i++) {
    const o = i * 4;
    antDriftData[o] = rand(antGLAC.xTop + 20, antGLAC.xToe - 6);
    antDriftData[o + 1] = rand(antGLAC.z0, antGLAC.z1);
    antDriftData[o + 3] = rand(2.2, 5.5);
    antDriftData[o + 2] = rand(0, antDriftData[o + 3]);
  }
  root.add(antDriftMesh);
}

/**
 * THE BOW SPRAY. Twelve and a half metres a second and she threw nothing.
 *
 * The wake was there from the start — thirty rings behind her — and the wake is
 * what she LEAVES. What was missing is what she throws: a hull with no
 * freeboard doing twenty-four knots into a following swell puts water over the
 * bow constantly, and in this chapter it also puts brash over it, which is why
 * the rate is scaled by `antIceAt` as well as by speed.
 */
function antBuildSpray(root) {
  const M = antMerger();
  M.sph(0, 0, 0, 0.42, 0.34, 0.42, PALETTE.antFoam, 6);
  M.sph(0.34, 0.10, -0.18, 0.26, 0.22, 0.26, PALETTE.antFoam, 6);
  antSprayMesh = new THREE.InstancedMesh(M.build(), mat(PALETTE.antFoam, {
    transparent: true, opacity: 0.62, depthWrite: false,
  }).clone(), antSPRAY_N);
  antSprayMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  antSprayMesh.frustumCulled = false;
  antSprayMesh.renderOrder = 3;
  antSprayData = new Float32Array(antSPRAY_N * 7);   // x,y,z,vx,vy,vz,t
  for (let i = 0; i < antSPRAY_N; i++) antSprayData[i * 7 + 6] = 1e9;
  root.add(antSprayMesh);
}
function antSpray(x, y, z, vx, vy, vz) {
  if (!antSprayData) return;
  for (let i = 0; i < antSPRAY_N; i++) {
    const o = i * 7;
    if (antSprayData[o + 6] < 1.1) continue;
    antSprayData[o] = x; antSprayData[o + 1] = y; antSprayData[o + 2] = z;
    antSprayData[o + 3] = vx; antSprayData[o + 4] = vy; antSprayData[o + 5] = vz;
    antSprayData[o + 6] = 0;
    return;
  }
}

// ---------------------------------------------------------------- calving ---
function antBuildCalving(root) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const m = new THREE.InstancedMesh(geo, mat(PALETTE.antIceLt, { flatShading: true }), 24);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.frustumCulled = false;
  m.visible = false;
  antCalveData = new Float32Array(24 * 7);   // x,y,z,vx,vy,vz,r
  antCalveBits = m;
  root.add(m);
}

// ----------------------------------------------------------------- locals ---
/**
 * THREE PEOPLE, and there are only ever three people here.
 *
 * A base is not a village. The whole population of the place fits in one hut
 * and they have all been here nine months, which is the joke every line below
 * is built on — they are not surprised to see a capybara, they are pleased to
 * see ANYTHING.
 *
 * Every anchor is probed against terrainHeight rather than guessed, because
 * two of the thirty locals in the game shipped standing in a river.
 */
function antBuildLocals(game) {
  if (typeof game.addLocal !== 'function') return;
  const put = function (x, z, o, deck) {
    // PROBE, AND REFUSE. Two of the game's thirty locals shipped standing
    // on a riverbed with their speech bubble under the water, because a
    // landmark constant was trusted as a place to stand. Anything that is
    // not on a deck has to be on land, and if it is not, it does not exist.
    const h = antLandOnly(x, z);
    if (deck === undefined && h < antWATER + 0.2) {
      console.warn('[antarctic] local at', x, z, 'is in the water (' + h.toFixed(2) + ') - skipped');
      return null;
    }
    o.biome = 'antarctic';
    o.x = x; o.z = z;
    o.y = deck === undefined ? h : deck;
    const rec = game.addLocal(o);
    // ---- WHAT THEY ARE HOLDING ------------------------------------------
    // Six people on a continent, and every one of them was a coloured box in
    // a hat. The whole joke the dialogue is built on is that these are the
    // ONLY nine people for eleven hundred kilometres and they all have exactly
    // one job — so the thing in their hands is the shortest way to say which
    // one, and it is the difference between a person and a bollard. One merged
    // mesh each, parented to the figure so it turns when they turn to watch
    // you go past.
    if (o.kit && rec && rec.group) {
      const K = antMerger();
      if (o.kit === 'clipboard') {
        K.box(0.30, 1.05, 0.26, 0.30, 0.40, 0.03, PALETTE.antTimber, -0.9, 0, 0.2);
        K.box(0.30, 1.06, 0.24, 0.24, 0.32, 0.02, PALETTE.antIceLt, -0.9, 0, 0.2);
        K.cyl(0.36, 1.16, 0.30, 0.015, 0.16, PALETTE.antHull, -0.6, 0, 0.4, 4);
      } else if (o.kit === 'counter') {
        // a tally counter and a pair of binoculars, which is the whole of
        // "four thousand two hundred and six, give or take, mostly give"
        K.box(-0.30, 1.02, 0.24, 0.09, 0.12, 0.07, PALETTE.antRockDk, 0, 0, 0.3);
        for (let s = -1; s <= 1; s += 2) {
          K.cyl(0.30 + s * 0.07, 1.28, 0.22, 0.045, 0.24, PALETTE.antRockDk,
                Math.PI / 2, 0, 0, 6);
        }
        K.box(0.30, 1.28, 0.16, 0.20, 0.10, 0.06, PALETTE.antRockDk);
      } else if (o.kit === 'stake') {
        // an ablation stake and a mallet: the glaciologist's entire year
        K.cyl(-0.34, 0.90, 0.16, 0.022, 1.90, PALETTE.antHull, 0, 0, 0.10, 4);
        for (let k = 0; k < 4; k++) {
          K.box(-0.34 + k * 0.02, 0.35 + k * 0.42, 0.16, 0.05, 0.03, 0.05,
                PALETTE.antRockDk, 0, 0, 0.10);
        }
        K.cyl(0.34, 0.82, 0.20, 0.05, 0.30, PALETTE.antTimber, 0.4, 0, 0.5, 6);
        K.box(0.40, 0.94, 0.24, 0.10, 0.10, 0.22, PALETTE.antRockDk, 0.4, 0, 0.5);
      } else if (o.kit === 'trowel') {
        // the archaeologist, who is a hundred years too late
        K.box(0.32, 0.88, 0.22, 0.06, 0.06, 0.24, PALETTE.antTimber, 0.5, 0, 0.3);
        K.box(0.34, 0.78, 0.34, 0.10, 0.02, 0.20, PALETTE.antMast, 0.5, 0, 0.3);
        K.box(-0.32, 0.96, 0.20, 0.26, 0.30, 0.10, PALETTE.antDrum, 0, 0, 0.1);
      } else if (o.kit === 'mug') {
        // and the barman, holding the one thing in the chapter you steal
        K.cyl(0.32, 0.94, 0.22, 0.055, 0.13, PALETTE.antIceLt, 0, 0, 0.25, 8);
        K.box(0.32, 0.72, 0.24, 0.34, 0.06, 0.26, PALETTE.antTimber, 0, 0, 0.1);
      } else if (o.kit === 'rope') {
        for (let k = 0; k < 4; k++) {
          K.cyl(-0.30, 1.14 - k * 0.05, 0.10, 0.19 - k * 0.012, 0.05,
                PALETTE.antBone, 0.35, 0, 0.30, 8);
        }
      }
      const km = new THREE.Mesh(K.build(), antVC());
      km.castShadow = true;
      rec.group.add(km);
    }
    return rec;
  };
  // =========================================================================
  // ...AND THEY KNOW WHAT YOU HAVE DONE.
  //
  // Six people, seventy-odd sentences, and every one of them was true on the
  // first frame of the chapter and true on the last. The boatman says 'take
  // the tender if you like, everyone does' after you have taken it, brought it
  // back, and been escorted by six orcas. The barman says 'you are the
  // southernmost customer we have ever had' while you are holding his mug. The
  // glaciologist says 'you can slide it, everybody slides it' to somebody who
  // has just come down it at ten and a half metres a second.
  //
  // npc.js has carried the whole apparatus since v20 — `{ t, after: 'task-id' }`,
  // `{ t, before }`, `onTask` for the specific thing you just did in front of
  // them, `praise` for their general opinion, and four reaction pools — and
  // this chapter used none of it. The four defaults are chapter-neutral by
  // design and include 'Do you mind?' and 'Somebody is in a hurry', which are
  // lines for a market square. There is no square. There are nine people and
  // eleven hundred kilometres.
  //
  // THE RULE FOR ALL OF IT: nobody down here is surprised and nobody down here
  // is annoyed. They have been in one hut since March, the wind has not
  // stopped since the eleventh of May, and a capybara is comfortably the best
  // thing that has happened all season. Everything is DELIGHTED and DEADPAN,
  // and every single one of them wants to talk for longer than you do.
  // =========================================================================
  const ANT_STARTLED = ['Nothing breaks down here that was not already broken.',
                        'Leave it. It has been there since 1957.',
                        'Ha! Do that again.', 'That is the most exciting thing since March.',
                        'The wind does worse. Every night.',
                        'Right. Yes. I saw that.'];
  const ANT_SPLASH   = ['That is minus one point eight. It is gone.',
                        'Well, it floats. That is something.',
                        'It will be off the Falklands by Thursday.',
                        'We are not getting that back.',
                        'Ooh. Cold. Very cold.'];
  const ANT_THIEF    = ['Take it. Nine of us and two hundred of everything.',
                        'That is station property. That is a joke. Take it.',
                        'Sign for it. — no, do not, there is nobody to sign to.',
                        'Everything down here belongs to whoever is holding it.',
                        'Oh, we are looting now. Fine.'];
  const ANT_RUSH     = ['Careful! It is all ice under that!',
                        'You will end up in the water!',
                        'Nothing runs down here. Nothing has to.',
                        'Where. Where is it going. There is nowhere to go.',
                        'That is how the doctor got the doctor’s knee.'];

  const antLocBoss = put(antHUTS.x - 3.4, antHUTS.z + 4.2, {
    near: 8, face: 0.4, kit: 'clipboard',
    // THE AUTHORITY (L3, F1): the one with the clipboard is the one who
    // carries a nuisance off the station. put() hands the row to addLocal.
    authority: true, role: 'the station leader',
    figure: { shirt: PALETTE.antHull, legs: PALETTE.antHutRoof, hat: PALETTE.antHutRed },
    lines: [
            // ---- THEY HAVE HEARD ABOUT YOU (L3, E3): one line keyed on a wow elsewhere
            { t: 'Dropped through a cave in Vietnam, the report says. We have no caves. We have a bar hut. Same rules.', after: 'the-column' },
            // ...and what it is wearing (L3-11)
            { t: 'The parka is ours. Fine. Keep it. It suits it.', when: function () { return game.capy && game.capy.worn === 'parka'; } },
            'You are the first new face since March. Do not take that as praise.',
            'The bar opens at six. The bar is also the kitchen. And the library.',
            'Nine months. I have read the back of the cereal box in four languages.',
            'Sign in. Everyone signs in. It is the only paperwork we have left.',
            'That wind does not stop. It has not stopped since the eleventh of May.',
            'Do not go anywhere the flags do not go. That is the whole of the rules.',
            // A base commander keeps a log, so the log is what the lines are.
            { t: 'The orange boat at the end of the jetty. Take her. Everyone takes her.',
              before: 'take-tiller' },
            { t: 'You have got the tender out. Bring her back on the same side she left on.',
              after: 'take-tiller' },
            { t: 'Nobody has been past the gate in six weeks. There is nothing past it.',
              before: 'orca-ride' },
            { t: 'Six of them. On your beam. I am putting it in the log and nobody will believe it.',
              after: 'orca-ride' },
            { t: 'If something very large comes up alongside, that is normal. Sort of.',
              before: 'spy-hop' }],
    wheek: ['ARGENTINA! No? Worth a try.',
            'Listen — off the hill behind us. It comes back. It always comes back.'],
    onTask: {
      'take-tiller': ['There she goes. Two hundred days and somebody finally took her out.'],
      'orca-ride': ['I am going to have to write that down and I do not know how.',
                    'Nobody at home is going to believe one word of this.'],
      'station-mug': ['That is — yes. Fine. It is a mug. We have eleven.'],
      'floe-drift': ['You went down the channel on a piece of the sea. Right.'],
    },
    praise: ['That is going in the log.', 'Right. Noted. It all goes in the log.',
             'The log is getting strange this season.'],
    startled: ANT_STARTLED, splash: ANT_SPLASH, thief: ANT_THIEF, rush: ANT_RUSH,
  });
  put(antJETTY.x - 0.55, antJETTY.z0 - 7.0, {
    near: 8, face: 3.0, kit: 'rope',
    figure: { shirt: PALETTE.antDrum, legs: PALETTE.antHutRoof },
    lines: ['Watch the pack. Full ahead into brash is how you lose a propeller.',
            'Dark water is open water. That is all the chart you are getting.',
            'Sound your horn in the narrows. You will hear how wide it is.',
            { t: 'Take the tender if you like. Everyone does. Bring her back.',
              before: 'take-tiller' },
            { t: 'She handles all right, does she? She is forty years old.',
              after: 'take-tiller' },
            { t: 'There is a lane of open water out there. Find it and you will fly.',
              before: 'the-lead' },
            { t: 'You found the lead. Twelve knots. There is nothing else out there that does twelve knots.',
              after: 'the-lead' },
            { t: 'If something big comes up alongside, hold your speed. Do not slow down.',
              before: 'orca-ride' },
            { t: 'You held your speed. Good. Most people do not hold their speed.',
              after: 'orca-ride' },
            { t: 'There is a hole through the big berg. It is nine metres. It is plenty.',
              before: 'berg-arch' }],
    wheek: ['That is not a noise I have heard down here before.',
            'Save it for out there. Something out there is listening.'],
    onTask: {
      'the-lead': ['Twelve knots. In a forty-year-old tender. Listen to her.'],
      'berg-arch': ['Through the arch. In MY boat. With MY propeller.',
                    'Nine metres of headroom and you used about two of it.'],
      'orca-ride': ['I have been here four seasons and I have never had that.'],
      'spy-hop': ['It stood up and looked at you. They do that. It never stops being awful.'],
      'floe-drift': ['That is not a boat. I want to be clear that that is not a boat.'],
    },
    praise: ['Bring her back in one piece and we will say no more about it.',
             'Mm. Fine. She is a tough old thing.',
             'That is not what she is for, but go on.'],
    startled: ANT_STARTLED, splash: ANT_SPLASH, thief: ANT_THIEF, rush: ANT_RUSH,
  }, antJETTY.y + 0.11);
  put(antCOLONY.x - 8, antCOLONY.z - 9, {
    near: 8, face: 1.6, kit: 'counter',
    // D2: a colony count is a transect walked at the same pace every day, and a
    // transect runs OUT from the edge rather than along it — which is lucky,
    // because the colony sits on a rise and the tangent this was first written
    // as failed the ground probe by more than a metre and a half. Swept the
    // terrain round his feet at three lengths and twelve bearings: this is the
    // one that both leads away from eleven hundred nesting birds and is level
    // to 0.3 m over nine metres.
    walk: { dx: -7.8, dz: -4.5, dwell: 6 },
    figure: { shirt: PALETTE.antHutRed, legs: PALETTE.antMast, hat: PALETTE.antIceLt },
    lines: ['Four thousand two hundred and six. Give or take. Mostly give.',
            'Do not stand between a gentoo and the sea. You will lose.',
            'Every stone in every one of those nests was stolen. Every one.',
            'Watch that one. Watch — there. Straight into next door and out again.',
            'The grey ones are this year. Half of them will not see next year.',
            'The brown on the snow is what four thousand of anything does to a hill.',
            { t: 'They walk that track every single day. They wore it into the hill.',
              before: 'penguin-highway' },
            { t: 'You went down their road. On your back, most of it. They noticed.',
              after: 'penguin-highway' },
            { t: 'Make a noise near them. Go on. I will wait. It is worth waiting for.',
              before: 'colony-chorus' },
            { t: 'Four thousand of them, and it went all the way up the hill. Every time.',
              after: 'colony-chorus' },
            { t: 'Half of them are in the water right now. That is where the food is.' }],
    wheek: ['Right, well, now they are all looking at you. Thank you for that.',
            'Do it again. I want to see if it goes all the way up the hill.'],
    onTask: {
      'colony-chorus': ['THERE it goes. Up the hill. Every single one of them.',
                        'You have set off four thousand penguins. How do you feel.'],
      'penguin-highway': ['That is their road. You are not a penguin. It did not care.',
                          'They do that twice a day and they do not fall over.'],
      'leopard-seal': ['You have met her, then. She eats about six of mine a week.'],
    },
    praise: ['I have lost count. I have completely lost count.',
             'Four thousand two hundred and — no. Gone.',
             'That is going to unsettle them for an hour.'],
    startled: ANT_STARTLED, splash: ANT_SPLASH, thief: ANT_THIEF,
    rush: ['Not through the middle! Not through the MIDDLE —',
           'You will have them off their nests!',
           'I had a number. I had an actual number.'],
  });
  // ---- THREE MORE, and the chapter has three PLACES it had nobody in -----
  // A base is not a village, which is why there were only ever three — but
  // the whalers' beach, the glacier and the bar are each a scene with a
  // person-shaped hole in them, and 'a base is small' is not an argument for
  // a whaling station with no archaeologist on it.
  //
  // 4 — the one at the bones, who is a hundred years too late to stop any of it
  put(antBONES.x - 5, antBONES.z + 8, {
    near: 9, face: 3.5, kit: 'trowel',
    figure: { shirt: PALETTE.antDrum, legs: PALETTE.antTimber, hat: PALETTE.antHutRoof },
    lines: ['A hundred and ten blue whales out of this bay in one season.',
            'Nineteen twenty-two. Then there were none left and they went home.',
            'Nothing rots down here. That is the whole problem with the place.',
            'Five graves up the beach. Four names. One of them we never worked out.',
            'Black sand, in Antarctica. It is a volcano. Everybody forgets that.',
            { t: 'Those ribs are load-bearing. Somebody lived in that for a winter.',
              before: 'whale-bones' },
            { t: 'You sat inside it. Everybody does, in the end. It is the size.',
              after: 'whale-bones' },
            { t: 'The skull is a third of the animal. People never believe me until they see it.',
              before: 'whale-bones' },
            { t: 'There are six of them out there again, you know. Alive. It took a century.',
              after: 'orca-ride' }],
    wheek: ['First noise off that beach in about eighty years, I should think.'],
    onTask: {
      'whale-bones': ['Now put your paw on a rib and tell me how big it was.',
                      'Everybody goes quiet in there. Every single person.'],
      'orca-ride': ['They came back. That is the only good sentence about this beach.'],
    },
    praise: ['Do not move anything. — you have moved something.',
             'This is a protected site, technically. Technically.',
             'A hundred years and you are the first one to do that.'],
    startled: ANT_STARTLED, splash: ANT_SPLASH,
    thief: ['That is a historic artefact. It is also a bit of a barrel.',
            'Put it — no. Fine. It is fine.',
            'Somebody left that in 1911 and you are the first to move it.'],
    rush: ANT_RUSH,
  });
  // 5 — the glaciologist, on the moraine at the toe, watching a stake
  put(antGLAC.xToe - 10, antBLUE.z1 + 26, {
    near: 10, face: 1.1, kit: 'stake',
    figure: { shirt: PALETTE.antHull, legs: PALETTE.antHutRoof, hat: PALETTE.antHutRed },
    // a stake, and a number written down
    beat: { kind: 'rock', every: 6.5, dur: 2.4 },
    lines: ['Eleven metres this year. It was four when I started.',
            'The blue is the old stuff. All the air has been squeezed out of it.',
            'The dark lines are holes. The white lines are water. Learn the difference.',
            'It lets go about once a minute. You will hear it before you see it.',
            'Every stone on that black stripe was carried here. By the ice. Slowly.',
            { t: 'You can slide it. Everybody slides it. I have slid it.',
              before: 'blue-ice' },
            { t: 'Do not go up the middle. Go up the edge and come down the middle.',
              before: 'blue-ice' },
            { t: 'Ten and a half metres a second. I timed you. I time everything.',
              after: 'blue-ice' },
            { t: 'The pans go north through the gate. All of them. Every day.',
              before: 'floe-drift' },
            { t: 'You rode one out. That is sea ice, that is. It is going to Argentina.',
              after: 'floe-drift' }],
    wheek: ['That is going to come back off the wall in about two seconds. Listen.'],
    onTask: {
      'blue-ice': ['Ten point six. I have it on the board. Nobody has beaten it.',
                   'Nothing on that hill has any grip and you found that out at speed.'],
      'floe-drift': ['That floe is a MEASUREMENT. You have ridden a measurement.'],
      'haul-out': ['Out on a pan. Like a seal. You are not a seal.'],
    },
    praise: ['I will put a stake in wherever that was.',
             'That is data. I do not know of what.',
             'Everything down here is data if you look at it long enough.'],
    startled: ANT_STARTLED, splash: ANT_SPLASH, thief: ANT_THIEF, rush: ANT_RUSH,
  });
  // 6 — and the one behind the bar, because a bar with nobody behind it is a
  //     plank on two drums
  const antLocBar = put(antHUTS.x + 0.4, antHUTS.z - 6.1, {
    near: 7, face: 0.05, kit: 'mug',
    figure: { shirt: PALETTE.antHutRed, legs: PALETTE.antTimber },
    // the bar, and it is open
    beat: { kind: 'work', every: 6.0, dur: 0.85, sfx: 'clink', volume: 0.11, pitch: 1.1 },
    lines: ['We open at six. It is always six somewhere. It is six.',
            'Rule one: you bring something to hang on the wall. Rule two: no rule two.',
            'Nine of us, one bar, two hundred days. You do the arithmetic.',
            'No roof. There was a roof. The wind had opinions about the roof.',
            { t: 'The mugs are enamel because everything glass has already broken.',
              before: 'station-mug' },
            { t: 'You are the southernmost customer we have ever had. Probably.',
              before: 'station-mug' },
            { t: 'That is my mug. That was my mug. It is going to Brazil, is it.',
              after: 'station-mug' },
            { t: 'Rule one, remember. You bring something back for the wall.',
              after: 'station-mug' },
            { t: 'Whatever happens out there, it is all anybody talks about at six.',
              before: 'orca-ride' },
            { t: 'Six orcas. Right. Drinks are on the rodent and the rodent has no money.',
              after: 'orca-ride' }],
    wheek: ['Right! One for the rodent. Do not tell the doctor.'],
    onTask: {
      'station-mug': ['THAT IS THE MUG. — no, take it. Take it. It is a good story.',
                      'Eleven mugs. Ten mugs. This is how it starts.'],
      'orca-ride': ['Sit down. Start at the beginning. We have got all winter.'],
      'spy-hop': ['It looked at you? Properly looked? Oh, that is a drink, that is.'],
      'colony-chorus': ['We heard that from here. We hear everything from here.'],
    },
    praise: ['That is worth a drink. Everything is worth a drink.',
             'Go on then. Tell me about it. I have got nowhere to be.',
             'You are the most interesting thing that has happened since the resupply.'],
    startled: ['Nothing behind the bar is breakable any more. It has all been broken.',
               'That is the second glass this season. The first one was me.',
               'Do that again and it goes on the board.'],
    splash: ANT_SPLASH,
    thief: ['Help yourself. Everybody else does.',
            'That is coming out of your tab. You do not have a tab.',
            'I will put it under shrinkage. We have a column for shrinkage.'],
    rush: ANT_RUSH,
  });
  // ---- THE TRAVELLER (L8, F2) --------------------------------------------
  // A little inboard of the jetty's head end (antJETTY runs z:39 to z:18, and
  // z1:18 is the tip, closer to open water) rather than out on the very end
  // of it. antNavBlocked is asked rather than assumed, because the water
  // either side of the jetty is exactly what a landmark constant would miss.
  // Hidden until Antarctica's own first real tick (gateChap).
  if (typeof game.addTraveller === 'function') {
    let travX = 2, travZ = 22;
    if (antNavBlocked(travX, travZ)) { travX = 2; travZ = 27; }
    const travY = antTerrain(travX, travZ);
    game.addTraveller({ biome: 'antarctic', x: travX, y: travY, z: travZ, face: -0.3,
      gateChap: 17,
      lines: ['The head of the jetty, and it is colder than anywhere else I have stood on this trip.',
              'I did not pack for this continent. Nobody packs for this continent.'],
      wheek: ['That is the ice again. Cracking, probably.'] });
  }

  // ---- THE AUTHORITY, AND WHERE TO HIDE FROM THEM (L3, F1) ---------------
  // See THE HIDE in systems.js. Still inside one of these and the station
  // leader walks to where you were and gives up. Every spot is beside a
  // thing the chapter already draws: the drift tail in the lee of the bar
  // hut, the far side of the fuel drums, the middle of the rookery — a
  // hundred and thirty penguins are a better screen than any rock — the lee
  // of the wreck, and behind the second boiler. The sea is a hide on its own.
  if (typeof game.addHide === 'function') {
    game.addHide({ biome: 'antarctic', x: antHUTS.x + 9.0 * 0.5 + 1.4, z: antHUTS.z, r: 2.2, kind: 'the drift' });
    game.addHide({ biome: 'antarctic', x: antHUTS.x - 6 + 1.5 * 1.5, z: antHUTS.z + 15 + 1.6 + 1.3, r: 1.8, kind: 'behind the drums' });
    game.addHide({ biome: 'antarctic', x: antCOLONY.x, z: antCOLONY.z, r: 3.0, kind: 'among the penguins' });
    game.addHide({ biome: 'antarctic', x: antWHAL.x - 14 - 1.2, z: antWHAL.z + 6 + 2.2, r: 2.0, kind: 'the lee of the wreck' });
    game.addHide({ biome: 'antarctic', x: antWHAL.x + 6 + 9, z: antWHAL.z + 18 - 4 + 3.5, r: 1.8, kind: 'behind the boiler' });
  }

  // ---- AND THE ONLY TWO PEOPLE FOR ELEVEN HUNDRED KILOMETRES TALK TO EACH
  // ---- OTHER, WHICH UNTIL NOW THEY DID NOT ------------------------------
  // Zero `addExchange` rows in the whole chapter, against four in Venice and
  // five in Kowloon — in the one place in the game where the joke is that
  // there is nobody else. The base commander and the person behind the bar
  // stand 10.98 m apart at the huts, inside the 13 m chat radius, and have
  // spent nine months with only each other.
  if (typeof game.addExchange === 'function' && antLocBoss && antLocBar) {
    game.addExchange({ biome: 'antarctic', a: antLocBar, b: antLocBoss, gap: 30, lines: [
      ['Someone has signed in as a rodent.', 'Someone has signed in as a rodent, yes.'],
      ['Wind is dropping.', 'The wind is not dropping. The wind has never dropped.'],
      ['Are we counting it in the census?', 'We are counting everything. That is the census.'],
      ['Two hundred and eleven days.', 'Two hundred and twelve. You always miss one.'],
      ['The boat has gone out again.', 'Good. Somebody should be using her.'],
      ['Do you want the last of the coffee?', 'I want the FIRST of the next coffee.'],
    ] });
  }
}

// ============================================================== THE PASSAGE ==
// The five small bergs, declared once and used twice: antBuildBergs draws and
// collides them, antBlockedAt keeps the tender out of them. Two lists of the
// same rocks is how you get a growler you can drive straight through.
// The stacks off the gate, filled in by antBuildGate and read by antBlockedAt.
// Declared here beside antSMALL because it is exactly the same contract: one
// list, drawn and collided and steered round from the same numbers.
const antSTACKS = [];
const antSMALL = [[-52, -246, 13, 9, 7], [118, -290, 10, 7, 5.5], [-24, -466, 16, 11, 9],
                  [92, -186, 9, 6, 4.6], [-132, -400, 12, 8, 6.4]];

/**
 * IS THERE SOMETHING SOLID AT (x, z) AS FAR AS THE TENDER IS CONCERNED?
 *
 * The hull is a KINEMATIC body, and cannon does not resolve kinematic against
 * static — so every berg in this chapter would be a hologram to the one thing
 * in it that is moving fast enough to care. The boat therefore tests the world
 * analytically before it goes there, exactly as it tests the shoreline, and
 * the arch is a GAP in this function rather than a special case anywhere else.
 */
function antBlockedAt(x, z) {
  if (antLandOnly(x, z) > antWATER - 0.35) return true;
  const B = antBERG;
  if (Math.abs(z - B.z) < B.hz + 1.1) {
    const dx = Math.abs(x - B.x);
    if (dx > B.archW / 2 - 0.1 && dx < B.hx + 1.1) return true;
  }
  for (let i = 0; i < antSMALL.length; i++) {
    const s = antSMALL[i];
    if (Math.abs(x - s[0]) < s[2] + 1.1 && Math.abs(z - s[1]) < s[3] + 1.1) return true;
  }
  // and the four stacks off the gate. Same argument as the bergs: they are
  // static, she is kinematic, and cannon will not put them together.
  for (let i = 0; i < antSTACKS.length; i += 4) {
    if (Math.abs(x - antSTACKS[i]) < antSTACKS[i + 2] &&
        Math.abs(z - antSTACKS[i + 1]) < antSTACKS[i + 3]) return true;
  }
  return false;
}

/**
 * SLIDE THE PROPOSED STEP AROUND EVERY FLOE IT WOULD ENTER.
 *
 * Writes the corrected target into antSlide. The correction is a straight
 * projection back onto the circle, applied once per pan and in order, which
 * is exact for one and near enough for the (rare) case of two. Returns how
 * far the step had to be moved, so the caller can decide whether that was a
 * scrape or a collision.
 */
const antSlide = { x: 0, z: 0 };
function antFloeSlide(tx, tz) {
  antSlide.x = tx; antSlide.z = tz;
  if (!antFloeX) return 0;
  let moved = 0;
  for (let i = 0; i < antFLOE_N; i++) {
    const r = antFloeR[i] + antTEN_HX * 0.85;
    const dx = antSlide.x - antFloeX[i], dz = antSlide.z - antFloeZ[i];
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    const d = Math.sqrt(d2) || 0.0001;
    const push = r - d;
    antSlide.x += (dx / d) * push;
    antSlide.z += (dz / d) * push;
    moved += push;
  }
  return moved;
}

/** Where the tiller is, in WORLD coordinates. */
function antHelmWorld(out) {
  const cs = Math.cos(antBoatYaw), sn = Math.sin(antBoatYaw);
  out.set(antBoatX + sn * antHELM.z + cs * antHELM.x,
          antWATER + antTEN_DECK + 0.70,
          antBoatZ + cs * antHELM.z - sn * antHELM.x);
  return out;
}

function antTakeHelm() {
  const g = antGame;
  antHelmOn = true;
  antHelmCool = 0.35;
  g.state.sailing = true;
  // The same line chapter 3 needs, for the same reason: at the tiller the
  // capybara's own contact sweep does not run, so nothing else would tell the
  // camera that the tender between the lens and the animal is the floor.
  // Measured before this: 14.0 m of boom asked for, and the eye pulled in to
  // the tender's own coaming. See capy.rideBody and sysCamClear.
  if (g.capy) { g.capy.atHelm = true; g.capy.rideBody = antBoatBody; }
  antSfx('chime', { volume: 0.7 });
  antSay('W/S throttle · A/D tiller · Q to call · E to step off');
  antTask('take-tiller');
}

function antLeaveHelm() {
  const g = antGame;
  antHelmOn = false;
  antHelmCool = 0.35;
  g.state.sailing = false;
  if (g.capy) g.capy.atHelm = false;
}

/**
 * THE TENDER, ONCE PER FRAME.
 *
 * Same three ideas as the ferry in chapter 3 — throttle is a target speed,
 * rudder authority is bought with way, the hull carries its heading through a
 * turn — plus the one this chapter is about: HER LEGS ARE A FUNCTION OF WHERE
 * SHE IS. Full ahead in the lead is twelve and a half metres a second; full
 * ahead in the thick of the pack is under four, and it is LOUD.
 */
function antStepBoat(game, dt) {
  const input = game.input;
  const capy = game.capy;
  if (antHelmCool > 0) antHelmCool -= dt;

  // ---- taking and leaving the tiller --------------------------------------
  if (capy && capy.body && antHelmCool <= 0 && input && input.actionPressed) {
    antHelmWorld(antV3);
    const dx = capy.body.position.x - antV3.x;
    const dz = capy.body.position.z - antV3.z;
    const dy = capy.body.position.y - antV3.y;
    if (antHelmOn) {
      antLeaveHelm();
    } else if (dx * dx + dz * dz < antHELM_R * antHELM_R && dy > -2.2 && dy < 2.6) {
      antTakeHelm();
    }
  }

  // ---- the controls -------------------------------------------------------
  let rudderWant = 0, throttleWant = antThrottle;
  if (antHelmOn && input) {
    throttleWant = clamp(antThrottle - input.z * dt * 0.85, -0.30, 1);
    rudderWant = clamp(input.x, -1, 1);
    if (input.honkPressed) {
      antHornT = 1.4;
      antSfx('horn');
      // ...AND THE GATE GIVES IT BACK. The two bastions are 168 m either side
      // of the fairway, so a horn sounded in the gap comes back off the near
      // wall and then off the far one, and the two delays between them are
      // the width of the narrows. Sound is slowed here for the same reason
      // chapter 16 slows its echo: a cave is not a physics lesson and neither
      // is a channel. Only inside the gate, because it is the only place with
      // a wall on both sides.
      if (Math.abs(antBoatZ - antGATE_Z) < 90) {
        const near = 168 - Math.abs(antBoatX), far = 168 + Math.abs(antBoatX);
        const SPD = 343 * 0.6;
        antGateEcho[0] = clamp(near * 2 / SPD, 0.35, 2.2);
        antGateEcho[1] = clamp(far * 2 / SPD, 0.6, 3.0);
        // ...and every bird on both cliffs comes off them, which is the other
        // half of what a horn in a narrows does and is the reason anybody
        // sounds one there twice
        antCapeScat = 1;
        antSfx('gull', { volume: 0.19, pitch: 2.3 });
      }
    }
  } else {
    throttleWant = damp(antThrottle, 0, 1.6, dt);
  }
  if (antDetent > 0) {
    throttleWant = 0;
    if (!(antHelmOn && input && Math.abs(input.z) > 0.1)) antDetent -= dt;
  } else if (antThrottle * throttleWant < 0) {
    throttleWant = 0;
    antDetent = 0.30;
    if (!antToldNeutral && antHelmOn) {
      antToldNeutral = true;
      antToast('neutral. let go of the stick to take her astern.');
    }
  }
  antThrottle = throttleWant;
  antRudder = damp(antRudder, rudderWant, antTEN_RUDDER, dt);

  // ---- what the water is doing to her -------------------------------------
  const ice = antIceAt(antBoatX, antBoatZ);
  antBoatIce = damp(antBoatIce, ice, 3.0, dt);
  // ...and in `run` the gain is the SAME function, which already falls off
  // with the gap — so a boat that has dropped out of antPOD_HOLD gets none of
  // it, which is what makes holding the lead worth doing.
  const wake = antPodTight() ? antPodWakeK() : 0;
  const vmax = antTEN_VMAX * (1 - antICE_DRAG * antBoatIce) + antWAKE_GAIN * wake;
  const acc = antTEN_ACC * (1 - antICE_ACC * antBoatIce);

  // THE THROTTLE IS SIGNED AND ASTERN IS A DOUBLE NEGATIVE. antThrottle is
  // clamped to [-0.30, 1], so on the astern branch the ratio is in [-1, 0) and
  // multiplying it by a negative VREV would produce speed AHEAD — which is the
  // exact bug chapter 3 shipped with, and the reason it is written out here.
  const target = antThrottle >= 0 ? antThrottle * vmax
                                  : -antThrottle / 0.30 * antTEN_VREV;
  if (Math.abs(antThrottle) > 0.02) {
    const err = target - antBoatSpeed;
    const step = acc * dt;
    antBoatSpeed += clamp(err, -step * 2.2, step);
  } else {
    antBoatSpeed = damp(antBoatSpeed, 0, antTEN_DRAG + antBoatIce * 1.5, dt);
    if (Math.abs(antBoatSpeed) < 0.05) antBoatSpeed = 0;
  }
  // ...and the pack does not only slow her down, it holds her back HARD once
  // she is in it, which is why a hull that is already stopped in thick brash
  // takes a moment to get going again.
  if (antBoatIce > 0.55) antBoatSpeed = damp(antBoatSpeed, target, 1.2, dt);

  // ---- lateral: rudder authority is bought with way -----------------------
  const auth = clamp(Math.abs(antBoatSpeed) / 5.0, 0, 1);
  const sign = antBoatSpeed < 0 ? -1 : 1;
  antBoatYaw -= antRudder * antTEN_TURN * auth * sign * dt;

  // ---- integrate, and DO NOT DRIVE THROUGH THINGS -------------------------
  let nx = antBoatX + Math.sin(antBoatYaw) * antBoatSpeed * dt;
  let nz = antBoatZ + Math.cos(antBoatYaw) * antBoatSpeed * dt;
  // the ice first, because it is a circle and circles are exact
  const shove = antFloeSlide(nx, nz);
  if (shove > 0) {
    nx = antSlide.x; nz = antSlide.z;
    // only a HEAD-ON hit costs her anything: the deeper the correction the
    // more of her way was pointed into the pan rather than along it
    const bite = clamp(shove / Math.max(0.05, Math.abs(antBoatSpeed) * dt), 0, 1);
    antBoatSpeed *= 1 - clamp(bite * bite * 3.2 * dt, 0, 0.5);
    if (bite > 0.5 && Math.abs(antBoatSpeed) > 2.5 && antCrunchT <= 0) {
      antCrunchT = 0.7;
      antSfx('thud', { volume: 0.34, pitch: 0.7 });
      if (typeof game.shake === 'function') game.shake(0.09);
    }
    // ---- AND SAY SO, ONCE ------------------------------------------------
    // Measured on a straight run out of the berth with the throttle wide open:
    // she settles at about three metres a second and stays there, because the
    // pans are laid down the fairway on purpose ("a chain of stepping stones
    // from the bay to the gate") and a hull leaning on one is losing five per
    // cent of its way every frame. That is correct — she is a four-metre
    // workboat and she does not push ice out of the way — but from the tiller
    // it is indistinguishable from a broken throttle. There is already a toast
    // for thick BRASH; this is the other thing that stops her, and it is the
    // one a player meets first.
    antScrapeT += dt;
    if (!antToldFloe && antScrapeT > 2.6 && antThrottle > 0.75) {
      antToldFloe = true;
      antToast('she will not move a pan of ice. go round them.');
    }
  } else if (antScrapeT > 0) {
    antScrapeT = Math.max(0, antScrapeT - dt * 2);
  }
  if (!antBlockedAt(nx, nz)) {
    antBoatX = nx; antBoatZ = nz;
  } else if (!antBlockedAt(nx, antBoatZ)) {
    antBoatX = nx;                                  // slide along the shore
    antBoatSpeed *= 1 - clamp(2.6 * dt, 0, 0.4);
  } else if (!antBlockedAt(antBoatX, nz)) {
    antBoatZ = nz;
    antBoatSpeed *= 1 - clamp(2.6 * dt, 0, 0.4);
  } else {
    if (Math.abs(antBoatSpeed) > 3.5) {
      antSfx('thud', { volume: 0.5, pitch: 0.6 });
      if (typeof game.shake === 'function') game.shake(0.16);
    }
    antBoatSpeed *= -0.12;                          // she stops, and she bounces
  }
  const cx = clamp(antBoatX, antSEA_X0 + 26, antSEA_X1 - 26);
  const cz = clamp(antBoatZ, antSEA_Z0 + 42, antSEA_Z1 - 40);
  if (cx !== antBoatX || cz !== antBoatZ) {
    antBoatX = cx; antBoatZ = cz;
    antBoatSpeed = damp(antBoatSpeed, 0, 6, dt);
  }

  // ---- write the body, and the interpolation history with it --------------
  const b = antBoatBody;
  // SHE RIDES THE SEA SHE IS ON. This was its own sine with its own period
  // and its own phase, so the hull heaved on one swell while the sheet under
  // her heaved on another — see antSwellAt.
  const y = antSwellAt(antBoatX, antBoatZ) + antTEN_DECK + antCalveLift;
  b.position.set(antBoatX, y, antBoatZ);
  const heel = -antRudder * auth * 0.17 + Math.sin(antTime * 1.3) * 0.02;
  const trim = -clamp(antBoatSpeed / antTEN_VMAX, 0, 1) * 0.05;
  antE.set(trim, antBoatYaw, heel, 'YXZ');
  antQ.setFromEuler(antE);
  b.quaternion.set(antQ.x, antQ.y, antQ.z, antQ.w);
  b.velocity.set(Math.sin(antBoatYaw) * antBoatSpeed, 0, Math.cos(antBoatYaw) * antBoatSpeed);
  antSyncBody(b);

  antBoatGroup.position.set(antBoatX, y, antBoatZ);
  antBoatGroup.quaternion.set(antQ.x, antQ.y, antQ.z, antQ.w);
  if (antTillerMesh) antTillerMesh.rotation.y = antRudder * 0.55;
  if (antFlagMesh) {
    const st = clamp(Math.abs(antBoatSpeed) / antTEN_VMAX, 0, 1);
    antFlagMesh.rotation.y = -Math.PI / 2;
    antFlagMesh.rotation.z = -st * 0.85 + Math.sin(antTime * 7) * 0.10 * st;
  }

  // ---- the grinding -------------------------------------------------------
  // Rationed and scaled with the thing that causes it: the pack is only loud
  // when you are actually pushing through it. See the ambient-mover rules —
  // a loop is the fastest way to turn a good idea into a thing to be muted.
  if (antCrunchT > 0) antCrunchT -= dt;
  if (antBoatIce > 0.34 && Math.abs(antBoatSpeed) > 1.6 && antCrunchT <= 0) {
    const k = antBoatIce * clamp(Math.abs(antBoatSpeed) / 6, 0.3, 1);
    antSfx('rustle', { volume: clamp(0.08 + k * 0.20, 0.06, 0.28), pitch: rand(0.42, 0.66) });
    antCrunchT = lerp(1.5, 0.42, antBoatIce);
    if (antBoatIce > 0.62 && typeof game.shake === 'function') game.shake(0.05 * k);
  }

  // ---- the passenger at the tiller ----------------------------------------
  // Parked, not simulated, and for exactly the reason chapter 3 gives: a
  // capybara solving contacts against a deck that is being teleported twelve
  // metres a second loses the argument, and the point of standing at a tiller
  // is that you stay at it.
  if (antHelmOn && capy && capy.body) {
    antHelmWorld(antV3);
    const cb = capy.body;
    cb.position.set(antV3.x + Math.sin(antBoatYaw) * 0.55,
                    antV3.y - 0.08,
                    antV3.z + Math.cos(antBoatYaw) * 0.55);
    cb.velocity.set(b.velocity.x, 0, b.velocity.z);
    cb.angularVelocity.set(0, 0, 0);
    cb.previousPosition.copy(cb.position);
    cb.interpolatedPosition.copy(cb.position);
    if (capy.position) capy.position.set(cb.position.x, cb.position.y, cb.position.z);
    if (capy.group) {
      capy.group.position.set(cb.position.x, cb.position.y, cb.position.z);
      capy.group.rotation.y = antBoatYaw;
    }
  }
  if (antHornT > 0) antHornT -= dt;
}

// ------------------------------------------------------------------- wake ---
function antUpdateWake(dt) {
  if (!antWakeMesh) return;
  const moving = Math.abs(antBoatSpeed) > 1.2;
  antWakeT -= dt;
  if (moving && antWakeT <= 0) {
    antWakeT = 0.16;
    const i = antWakeHead;
    antWakeHead = (antWakeHead + 1) % antWakeN;
    antWakeX[i] = antBoatX - Math.sin(antBoatYaw) * antTEN_HZ;
    antWakeZ[i] = antBoatZ - Math.cos(antBoatYaw) * antTEN_HZ;
    antWakeL[i] = 0;
    antWakeS[i] = 0.9 + Math.abs(antBoatSpeed) * 0.075;
  }
  for (let i = 0; i < antWakeN; i++) {
    if (antWakeL[i] > 1.5) {
      antWakeMesh.setMatrixAt(i, antXform(0, -900, 0, 0, 0, 0, 0.01, 0.01, 0.01));
      continue;
    }
    antWakeL[i] += dt;
    const t = antWakeL[i] / 1.5;
    const s = antWakeS[i] * (1 + t * 1.9);
    antWakeMesh.setMatrixAt(i, antXform(antWakeX[i], antSwellAt(antWakeX[i], antWakeZ[i]) + 0.09, antWakeZ[i],
                                        0, 0, 0, s, 1, s * 1.15));
  }
  antWakeMesh.instanceMatrix.needsUpdate = true;
}

// ------------------------------------------------------------------ floes ---
/**
 * FIFTEEN PANS OF SEA ICE, AND THEY ARE CARRIERS.
 *
 * Every rule in the contract's carrier note applies and all five are here:
 * kinematic, never asleep, moved by VELOCITY and never by assigning position,
 * and the velocity differenced against the PREVIOUS TARGET rather than against
 * the body's own position — cannon has already integrated the body by the time
 * this runs, so its position is where the last velocity put it and the sign
 * flips every frame if you difference against it.
 */
function antUpdateFloes(game, dt) {
  if (!antFloeBodies) return;
  for (let i = 0; i < antFLOE_N; i++) {
    const b = antFloeBodies[i];
    // read back what the solver did with it: this is what the terrain, the
    // slip field and the seal all ask about for the rest of the frame
    antFloeX[i] = b.position.x;
    antFloeZ[i] = b.position.z;

    let tz = antFloeTZ[i] - antDriftAt(antFloeTZ[i]) * dt;
    let tx = antFloeTX[i] + Math.sin(antTime * 0.06 + antFloePh[i]) * 0.22 * dt;
    if (tz < -430) {
      // out of the race and into the eddy behind the big berg, where it stops.
      // A ride that ENDS somewhere is a ride; one that ends at a wall is a bug.
      tz = antFloeTZ[i] - 0.10 * dt;
      tx = antFloeTX[i] + (antBERG.x + 46 - antFloeTX[i]) * 0.06 * dt;
      // ...and if nobody is on it, it goes round again from the top of the bay
      //
      // AND THE VELOCITY MUST NOT BE WRITTEN ON THE FRAME IT WRAPS. This cost
      // the chapter every floe it has.
      //
      // The wrap teleports the body four hundred and eighty metres north, and
      // the line below then differenced the NEW target against the OLD one and
      // handed the body `482 / dt` — twenty-nine THOUSAND metres a second —
      // which cannon duly integrated for one step. So a pan that reached the
      // shelf was moved to the top of the bay and then flung another four
      // hundred and eighty metres straight out of the world, where it stopped
      // and stayed for the rest of the session. Measured by `qa/kine.js` on a
      // two-second sample: floe fourteen sitting at z = +553, four hundred and
      // thirty metres past the northern edge of the map.
      //
      // It is invisible for about four minutes and then it is the whole
      // chapter: the leopard seal lives on floe three, 'haul out on a floe'
      // and 'ride one down the channel' are both on this chain, and one by one
      // every pan leaves the world and does not come back. The wrap is the one
      // frame where the carrier rules' "difference against the previous
      // target" is wrong, because there IS no previous target — it is a new
      // object in a new place, standing still.
      // ...AND IT GOES ROUND PROMPTLY UNLESS SOMEBODY IS ON IT. The eddy
      // creeps at ten centimetres a second and the wrap was at -452, so an
      // empty pan spent about three minutes in it — measured over a
      // ten-minute soak, TEN OF THE FIFTEEN were stacked between -430 and -450
      // within two minutes of arriving, and the "chain of stepping stones from
      // the bay to the gate" that the whole haul-out is built on had become a
      // raft of ice behind the berg with nothing anywhere else. The eddy is
      // for the ride to END in; it is not a car park.
      if (antOnFloe !== i && tz < -436) {
        // ---- AND IT MUST NOT COME BACK ON TOP OF THE JETTY ----------------
        //
        // The recycle drops a pan at z between 18 and 44 with x anywhere in a
        // ninety-six-metre band about the lead — and the tender lies at
        // (3.6, 22) with the jetty running from z = 18 to 39 at x = 0. So a
        // floe that reached the shelf could be put back down ON the berth.
        // Measured by `qa/kine.js`: the moored tender teleporting 4.8 m in one
        // frame with zero velocity, because `antFloeSlide` was shoving her out
        // from under a nine-metre pan that had materialised around her. Worse
        // than the boat: a pan is reported as GROUND by `antFloeTop`, so one
        // landing over the jetty puts a floor at the waterline across the one
        // place in the chapter the player is guaranteed to be standing.
        //
        // Roll until it is clear of both. Eight tries is plenty — the band is
        // ninety-six metres wide and the keep-out is thirty — and the fallback
        // puts it out on the west side, where there is nothing at all.
        let ok = false;
        for (let k = 0; k < 8 && !ok; k++) {
          tz = 18 + rand(0, 26);
          tx = antLeadX(tz) + rand(-48, 48);
          const dJ = Math.abs(tx - antJETTY.x);
          const dB = Math.hypot(tx - antBoatX, tz - antBoatZ);
          ok = dJ > antFloeR[i] + 12 && dB > antFloeR[i] + 12;
        }
        if (!ok) { tz = 18 + rand(0, 26); tx = antJETTY.x - antFloeR[i] - 26; }
        b.position.set(tx, b.position.y, tz);
        b.velocity.set(0, 0, 0);
        antSyncBody(b);
        antFloeX[i] = tx; antFloeZ[i] = tz;
        antFloeTX[i] = tx; antFloeTZ[i] = tz;
        continue;
      }
    }
    b.velocity.set((tx - antFloeTX[i]) / dt, 0, (tz - antFloeTZ[i]) / dt);
    antFloeTX[i] = tx;
    antFloeTZ[i] = tz;
  }
  antSyncFloeMatrices();

  // ---- who is standing on one ---------------------------------------------
  const capy = game.capy;
  const prev = antOnFloe;
  antOnFloe = -1;
  if (capy && capy.position && !antHelmOn && !capy.swimming) {
    const i = antFloeAt(capy.position.x, capy.position.z);
    if (i >= 0 && capy.position.y > antWATER - 0.2) antOnFloe = i;
  }
  if (antOnFloe >= 0) {
    if (prev !== antOnFloe) {
      antFloeRideX = antFloeX[antOnFloe];
      antFloeRideZ = antFloeZ[antOnFloe];
      antFloeRide = 0;
    } else {
      const dx = antFloeX[antOnFloe] - antFloeRideX;
      const dz = antFloeZ[antOnFloe] - antFloeRideZ;
      antFloeRide += Math.sqrt(dx * dx + dz * dz);
      antFloeRideX = antFloeX[antOnFloe];
      antFloeRideZ = antFloeZ[antOnFloe];
      if (antFloeRide > antFloeBest) antFloeBest = antFloeRide;
    }
    if (!antHauled) {
      antHauled = true;
      antTask('haul-out');
      antToast('sea ice. it is going somewhere, and now so are you.');
    }
    // ...and the metres are on the paper while the ice carries you (v36). THIS
    // ride, not `antFloeBest`: a figure stuck at the best of the afternoon says
    // nothing about the floe you are standing on. Six metres of floor, because
    // stepping onto one and off again is not a drift.
    if (antFloeRide > 6) antLive('floe-drift', antFloeRide);
    if (antFloeRide > 45) {
      antRecord('floe-drift', antFloeBest);
      antTask('floe-drift');
    }
  } else if (prev >= 0) {
    antFloeRide = 0;
  }
}

// -------------------------------------------------------------------- pod ---
/**
 * SHOULDER A POINT OUT INTO WATER DEEP ENOUGH TO HOLD AN ORCA.
 *
 * Three steps down the gradient of the land field, six metres apart, which
 * is enough to clear any shoreline in this chapter from any direction. It is
 * the only thing standing between the pod and the beach, and the pod is the
 * chapter, so it runs on the centre AND on every animal.
 */
const antDeep = { x: 0, z: 0 };
/**
 * PUSH A POINT OUT INTO WATER DEEP ENOUGH FOR SIX TONNES OF ANIMAL.
 *
 * AND A FLOE IS NOT LAND. This walked the LAND height field only, so it happily
 * declared a spot clear that had a two-hundred-tonne pan of sea ice sitting on
 * it — and the escort, whose formation is fixed relative to the boat, drove
 * straight through the pack. Photographed at the marquee (`qa/b4ant-payout.png`)
 * there were two orcas drawn ON TOP of a pan and a third clipping its edge, in
 * frame, at the tick.
 *
 * The floes are the one thing in this chapter that MOVE — they are on the drift
 * — so this cannot be baked; it has to be asked every frame, which is what
 * `antFloeAt` is for and why it is cheap.
 */
function antToDeep(px, pz) {
  antDeep.x = px; antDeep.z = pz;
  for (let k = 0; k < 4; k++) {
    const shallow = antLandOnly(antDeep.x, antDeep.z) >= antWATER - 3.5;
    const fi = antFloeAt(antDeep.x, antDeep.z);
    if (!shallow && fi < 0) return antDeep;
    if (fi >= 0) {
      // Straight out of the pan, along the line from its centre. A floe is a
      // disc, so there is no gradient to follow and nothing to be clever with.
      let dx = antDeep.x - antFloeX[fi], dz = antDeep.z - antFloeZ[fi];
      let m = Math.sqrt(dx * dx + dz * dz);
      if (m < 1e-4) { dx = 1; dz = 0; m = 1; }
      const out = antFloeR[fi] + 3.5;
      antDeep.x = antFloeX[fi] + (dx / m) * out;
      antDeep.z = antFloeZ[fi] + (dz / m) * out;
      continue;
    }
    const e = 6;
    const gx = antLandOnly(antDeep.x + e, antDeep.z) - antLandOnly(antDeep.x - e, antDeep.z);
    const gz = antLandOnly(antDeep.x, antDeep.z + e) - antLandOnly(antDeep.x, antDeep.z - e);
    const m = Math.sqrt(gx * gx + gz * gz);
    if (m < 1e-4) return antDeep;
    antDeep.x -= (gx / m) * 15;
    antDeep.z -= (gz / m) * 15;
  }
  return antDeep;
}

/** 0..1 — how much of the pod's moving water the hull is actually sitting in. */
/**
 * IS THE POD RUNNING WITH THE BOAT? Six sites tested `antPodState === 'escort'`
 * directly, so D4.12's `run` state would have been drawn as a loose patrol —
 * wide formation, slow porpoising, no wake gain and no `withPod()` — during
 * the one part of the chapter that it is the subject of. One predicate, so a
 * fifth state cannot be half-admitted the same way.
 */
function antPodTight() {
  return antPodState === 'escort' || antPodState === 'run';
}

function antPodWakeK() {
  const dx = antPodCX - antBoatX, dz = antPodCZ - antBoatZ;
  const d = Math.sqrt(dx * dx + dz * dz);
  return clamp(1 - d / antPOD_HOLD, 0, 1);
}

function antPodSummon() {
  if (antPodTight() || antPodState === 'coming') return false;
  const dx = antPodCX - antBoatX, dz = antPodCZ - antBoatZ;
  if (dx * dx + dz * dz > antPOD_CALL * antPOD_CALL) return false;
  antPodState = 'coming';
  antPodStateT = 0;
  antToast('something out there heard that.');
  // AND IT COMES FROM SOMEWHERE. The whole line is "something out there heard
  // that" — a cue whose entire content is a BEARING, fired in mono.
  antSfx('gull', placeCue({ volume: 0.22, pitch: 0.30 }, antPodCX, antWATER, antPodCZ, 260));
  return true;
}

/**
 * THE POD.
 *
 * They patrol whether or not anybody is watching — a loop of the deep channel
 * at about three and a half metres a second, blowing when they surface, and
 * from two hundred metres away all you can see is the bull's fin, which is
 * exactly the point. Wheek from the boat and they come; hold your speed and
 * they stay; stop, and one of them will come up and look at you.
 */
/**
 * THE RIDE IS OVER. Bank the best of it and stop the live line.
 *
 * The note inside the marquee branch says "antPodBest is banked above and
 * flushed when the ride ends — see antPodEndRide", and antPodEndRide has never
 * existed: nothing anywhere called it and nothing anywhere did the flush. It
 * did not matter while `escort` was the only state, because the orcas could
 * not be lost and the ride only ever ended by the pod giving up on a boat that
 * had already stopped. D4.12 makes losing them a thing that happens at speed,
 * which is exactly the case where a ride worth recording is thrown away.
 */
function antPodEndRide(game) {
  if (antPodRide > antPodBest) antPodBest = antPodRide;
  if (antPodBest > 0.5 && !antRideDone) antRecord('orca-ride', antPodBest);
  antPodRide = 0;
  if (typeof game.recordLive === 'function') {
    try { game.recordLive('orca-ride', 0); } catch (e) { /* optional hook */ }
  }
}

function antUpdatePod(game, dt) {
  if (!antPodGroup) return;
  antPodStateT += dt;

  let yaw = antPodYaw;
  if (antPodState === 'patrol') {
    antPodU += dt / 172;                       // ~604 m of loop at 3.5 m/s
    const a = antPodU * Math.PI * 2;
    const px = 42 * Math.sin(a) + 8;
    const pz = -300 + 132 * Math.cos(a);
    yaw = Math.atan2(px - antPodCX, pz - antPodCZ);
    antPodCX = px; antPodCZ = pz;
  } else if (antPodState === 'coming') {
    const dx = antBoatX - antPodCX, dz = antBoatZ - antPodCZ;
    const d = Math.sqrt(dx * dx + dz * dz) || 1;
    // FIFTEEN AND A HALF, AND IT HAS TO BE FASTER THAN THE BOAT.
    //
    // This was 7.6 and the tender's top speed in the lead is 12.6, so a pod
    // summoned at full ahead was CHASING a hull it could not catch: the gap
    // opened at five metres a second, the twenty-six-second patience ran out,
    // and they went home. Measured over a full run down the channel — wheek at
    // the tiller, hold full ahead, and `withPod()` stayed at zero for four
    // hundred and seventy metres, which is the entire chapter. The marquee is
    // 'call them, then HOLD YOUR SPEED', so the one state in which the summon
    // has to work is the one in which it could not.
    //
    // An orca is the fastest thing in the sea and does about fifteen metres a
    // second in a burst, which is comfortably more than a four-metre workboat
    // — so the honest number is also the one that makes it work.
    const v = 15.5;
    antPodCX += (dx / d) * v * dt;
    antPodCZ += (dz / d) * v * dt;
    yaw = Math.atan2(dx, dz);
    if (d < antPOD_HOLD * 0.72) {
      antPodState = 'escort';
      antPodStateT = 0;
      antPodRide = 0;
      antSlowT = 0;
      if (!antSeenPod) {
        antSeenPod = true;
        antToast('they have formed up on you. do not slow down.');
      }
      // the pod surfacing beside you is a mass of water going past, not a
      // thing falling in (L7, E2): `swell`, which was `splash` at 0.5
      antSfx('swell', placeCue({ volume: 0.6, pitch: 0.9 },
                               antPodCX, antWATER, antPodCZ, 150));
    }
    if (antPodStateT > 26) antPodState = 'patrol';    // they gave up on you
  } else if (antPodState === 'run') {
    // ---- D4.12: THE POD LEADS ------------------------------------------
    //
    // `escort` damps the pod centre onto the boat at 5.0/s, which means the
    // orcas are GLUED to you: they cannot be lost except by stopping, they go
    // wherever you go, and the marquee — the one moment in this chapter that
    // is about keeping up with something — was a throttle test with the thing
    // you are keeping up with welded to your bow.
    //
    // After `antPOD_RUN_AT` seconds of escort they break north and run the
    // lead. `antLeadX(z)` is the wandering trough of open water this whole
    // chapter navigates by; six orcas going up it at eleven metres a second
    // is a line through the pack that you have to read as well as chase,
    // because the boat's twelve and a half is only twelve and a half IN
    // CLEAR WATER and the lead is the only clear water there is.
    //
    // Catchable, and only just: 11.0 against a hull that does 12.6 clean and
    // rather less in brash, plus whatever the wake is worth — which is why
    // the wake gain and the ride clock now accrue ONLY inside antPOD_HOLD.
    // Falling out of that for antPOD_LOSE seconds and they are gone.
    antPodCZ -= antPOD_RUN_V * dt;
    const wantX = antLeadX(antPodCZ);
    antPodCX = damp(antPodCX, wantX, 1.6, dt);
    yaw = Math.atan2(antPodCX - antPodRunPX, antPodCZ - antPodRunPZ);
    antPodRunPX = antPodCX; antPodRunPZ = antPodCZ;
    const gap = Math.hypot(antBoatX - antPodCX, antBoatZ - antPodCZ);
    antPodGap = gap;
    if (gap < antPOD_HOLD) {
      antSlowT = 0;
      antPodRide += dt;
      if (antPodRide > antPodBest) antPodBest = antPodRide;
      antLive('orca-ride', antPodRide);
      if (!antRideDone && typeof game.wowLive === 'function') {
        game.wowLive('with the pod, running · ' + antPodRide.toFixed(1) + ' s of ' + antPOD_RIDE + ' · ' +
                     gap.toFixed(0) + ' m off them', clamp(antPodRide / antPOD_RIDE, 0, 1));
      }
      if (antPodRide >= antPOD_RIDE && !antRideDone) {
        antRideDone = true;
        antRecord('orca-ride', antPodBest);
        antTask('orca-ride');
        antPodAnswers();                                   // W1
        if (typeof game.frameShot === 'function')
          game.frameShot({ yaw: antBoatYaw + Math.PI, dist: 26, pitch: 0.24,
                           raise: 6.5, hold: 3.2, over: true });
      }
      // ---- THE BREACH, ONCE, AND SEEN FROM THE BOAT (L5) ---------------
      // Six tonnes of animal leaving the water at two thirds of the run —
      // and now the lens comes off the wake and on to it: the world at half
      // speed, the camera on the far side of the boat from the bull so the
      // tender is in the foreground and the breach fills the frame behind.
      if (!antBreachDone && antPodRide > antPOD_RIDE * 0.62 && antBreachT < 0) {
        antBreachDone = true;
        antBreachT = 0;
        antBreachIdx = 4;                                   // the bull
        const bx = antPodX[antBreachIdx] || antPodCX, bz = antPodZ[antBreachIdx] || antPodCZ;
        // six tonnes landing: the swell, hard, with the slap of it (L7, E2)
        antSfx('swell', placeCue({ volume: 1.0, pitch: 0.8, force: true }, bx, antWATER, bz, 150));
        antSfx('thud', placeCue({ volume: 0.5, pitch: 0.7, force: true }, bx, antWATER, bz, 150));
        if (typeof game.shake === 'function') game.shake(0.10);
        antToast('all of it. out of the water. all of it.');
        if (game.music && typeof game.music.swell === 'function') game.music.swell(1.0);
        if (typeof game.slowmo === 'function') game.slowmo(0.5, 1.3);
        if (typeof game.frameShot === 'function') {
          const cp = game.capy && game.capy.position;
          const yaw = cp ? Math.atan2(cp.x - bx, cp.z - bz) : antBoatYaw + Math.PI;
          game.frameShot({ yaw: yaw, dist: 20, pitch: 5 * Math.PI / 180, raise: 2.2, hold: 2.4, over: true });
        }
        if (typeof game.sparks === 'function') game.sparks(bx, antWATER + 0.4, bz, 44, { spd: 5.5, up: 3.5, grav: 9, drag: 0.6, life: 1.3, size: 0.34, rgb: [1.2, 1.4, 1.6] });
      }
    } else {
      // ---- AND YOU CAN LOSE THEM, WHICH IS NEW --------------------------
      // Not instantly: a boat that drops to seventeen metres for half a
      // second on a turn has not lost anything, and a marquee that punishes
      // one bad rudder input is a marquee nobody finishes.
      antSlowT += dt;
      if (!antPodToldGap && antSlowT > 1.6) {
        antPodToldGap = true;
        antToast('they are pulling away. the lead is the only fast water.');
      }
      if (antSlowT > antPOD_LOSE) {
        antPodState = 'patrol';
        antPodStateT = 0;
        antPodU = 0.5;
        antPodEndRide(game);
        antToast('gone. they were never waiting for you.');
      }
    }
    // ...and they do not run for ever either. Sixty-four seconds is the same
    // patience `escort` always had.
    if (antPodStateT > antPOD_LEAVE || antPodCZ < -520) {
      antPodState = 'patrol';
      antPodStateT = 0;
      antPodU = 0.5;
      antPodEndRide(game);
      antToast('they have gone on. they were always going to.');
    }
  } else {
    // escort (and spy-hop, which is an escort with one of them standing up)
    antPodCX = damp(antPodCX, antBoatX, 5.0, dt);
    antPodCZ = damp(antPodCZ, antBoatZ, 5.0, dt);
    yaw = antBoatYaw;
    const sp = Math.abs(antBoatSpeed);
    // ---- ...AND THEN THEY GO (D4.12) -----------------------------------
    // The escort is the introduction, not the event: they form up, they let
    // you settle into it, and then they leave and you find out whether you
    // meant it. Gated on the helm and on speed, so it cannot fire at a boat
    // sitting still with nobody driving it.
    if (antPodStateT > antPOD_RUN_AT && antHelmOn && sp > 4.0 &&
        !(game.state && game.state.noPodRun)) {
      antPodState = 'run';
      antPodStateT = 0;
      antSlowT = 0;
      antPodToldGap = false;
      // THE RUN IS THE RIDE (L5): the escort's seconds do not count toward the
      // tick — measured, eight seconds of escort plus one of the run ticked
      // the marquee before the pod had led anywhere
      antPodRide = 0;
      antPodRunPX = antPodCX; antPodRunPZ = antPodCZ;
      antToast('they have broken north. that is the lead. GO.');
      antSfx('swell', placeCue({ volume: 0.7, pitch: 0.85 },
                               antPodCX, antWATER, antPodCZ, 180));
    }

    // --- the marquee: HOLD IT, at speed -----------------------------------
    if (sp > 5.5 && antHelmOn) {
      antPodRide += dt;
      if (antPodRide > antPodBest) antPodBest = antPodRide;
      // this hold, on the paper, while it lasts (v32)
      antLive('orca-ride', antPodRide);
      // ...and on the signpost (W1): the hold against the 18 s it asks for,
      // and whether the pod is running or still escorting.
      if (!antRideDone && typeof game.wowLive === 'function') {
        game.wowLive((antPodState === 'run' ? 'with the pod, running · ' : 'in the pod · ') +
                     antPodRide.toFixed(1) + ' s of ' + antPOD_RIDE + ' · ' + sp.toFixed(1) + ' m/s',
                     clamp(antPodRide / antPOD_RIDE, 0, 1));
      }
      // ---- ONCE. `antPodRide >= antPOD_RIDE` IS A CONDITION, NOT AN EVENT --
      //
      // It stayed true for every frame of the rest of the ride, so the
      // chapter's marquee called record() and completeTask() on EVERY ONE OF
      // THEM. Measured over a single hold: 208 record() calls with the value
      // climbing 9.03 → 9.05 → 9.08 …, and because game.record() toasts and
      // chimes whenever the number improves, TWENTY-NINE live "personal best"
      // cards stacked over the animal's head through the whole of the one
      // moment the chapter is for. Exactly Kyoto's bug in batch 3 and the
      // Göreme cowbird's before it, and the same fix every time: a flag whose
      // meaning is ALREADY PAID, distinct from the value the clock idles at.
      //
      // The record still gets the best of the ride, because antPodBest is
      // banked above and flushed when the ride ends — see antPodEndRide.
      // (L5) the tick is the RUN's — see the run block above; the escort only
      // keeps the clock warm on the paper
      // ---- THE BREACH, ONCE ----------------------------------------------
      //
      // The pod porpoises and it spy-hops, and both of those are things it
      // does WHILE you are looking at it. Neither of them is a moment. Six
      // tonnes of animal leaving the water completely, at the top of the one
      // ride the chapter is built around, is the picture — and it only ever
      // happens once, which is what makes it one. (A thing that happens every
      // forty seconds is scenery; a thing that happens once is a memory —
      // the same argument the Pantanal's egrets are built on.)
      // (L5) the bull's breach is the run's too — see antPodBreach
    } else {
      antPodRide = Math.max(0, antPodRide - dt * 0.8);
    }
    // --- ...or stop, and get looked at ------------------------------------
    if (sp < 2.0) {
      antSlowT += dt;
      if (antSlowT > 1.6 && antSpyT < 0) {
        antSpyT = 0;
        antSpyTold = false;
        antSpyIdx = 1;
        antSfx('swell', placeCue({ volume: 0.55, pitch: 1.0 },
                                 antPodX[antSpyIdx] || antPodCX, antWATER,
                                 antPodZ[antSpyIdx] || antPodCZ, 150));
      }
    } else {
      antSlowT = 0;
    }
    // --- and they do not stay for ever ------------------------------------
    if (antPodStateT > antPOD_LEAVE || antBoatZ > -40) {
      antPodState = 'patrol';
      antPodU = 0.5;
      antPodCX = antBoatX; antPodCZ = antBoatZ;
      if (antPodStateT > 6) antToast('they have gone on. they were always going to.');
    }
  }
  antToDeep(antPodCX, antPodCZ);
  antPodCX = antDeep.x; antPodCZ = antDeep.z;
  antPodYaw = yaw;

  if (antSpyT >= 0) {
    antSpyT += dt;
    if (antSpyT > 4.6) antSpyT = -1;
  }
  if (antBreachT >= 0) {
    antBreachT += dt;
    if (antBreachT > 2.6) antBreachT = -1;
  }
  // the queue (W1): the next one goes when the last is clear of the water
  if (antBreachQueue.length && antBreachT < 0) {
    antBreachWait -= dt;
    if (antBreachWait <= 0) {
      antBreachIdx = antBreachQueue.shift();
      antBreachT = 0;
      antBreachWait = 0.6;
      antSfx('swell', placeCue({ volume: 0.9, pitch: 0.85, force: true },
                               antPodX[antBreachIdx] || antPodCX, antWATER,
                               antPodZ[antBreachIdx] || antPodCZ, 150));
      if (typeof game.shake === 'function') game.shake(0.08);
    }
  }

  // ---- each animal --------------------------------------------------------
  const cs = Math.cos(antPodYaw), sn = Math.sin(antPodYaw);
  const spread = antPodTight() ? 1.0 : 1.9;
  for (let i = 0; i < antPOD_N; i++) {
    const mesh = antPodParts[i];
    const ox = antPodOffX[i] * spread, oz = antPodOffZ[i] * spread;
    antToDeep(antPodCX + ox * cs + oz * sn, antPodCZ - ox * sn + oz * cs);
    const wx = antDeep.x, wz = antDeep.z;
    antPodX[i] = damp(antPodX[i] || wx, wx, 4.5, dt);
    antPodZ[i] = damp(antPodZ[i] || wz, wz, 4.5, dt);

    // porpoising: the back breaks the surface for about a third of the cycle,
    // and the pitch is the DERIVATIVE of that, so the nose comes up before the
    // body does and goes down after it. That is the whole animation.
    const per = antPodTight() ? 2.2 : 4.2;
    const ph = (antTime / per + antPodPh[i]) * Math.PI * 2;
    const escort = antPodTight();
    let rise = Math.sin(ph);
    let y = (escort ? antWATER - 0.34 : antWATER - 0.85) +
            Math.max(0, rise) * (escort ? 1.15 : 1.35);
    let pitch = -Math.cos(ph) * 0.42 * (rise > -0.2 ? 1 : 0.2);

    // the spy-hop: straight up, vertical, and it holds there and looks at you
    if (antSpyT >= 0 && i === antSpyIdx) {
      const u = antSpyT < 1.0 ? antSmooth(antSpyT)
              : antSpyT < 3.2 ? 1
              : 1 - antSmooth((antSpyT - 3.2) / 1.4);
      y = antWATER - 0.34 + u * 4.9;
      pitch = -1.16 * u;
      antPodX[i] = damp(antPodX[i], antBoatX + 5.2 * cs, 3.0, dt);
      antPodZ[i] = damp(antPodZ[i], antBoatZ - 5.2 * sn, 3.0, dt);
      // ...AND ONCE, NOT TWELVE TIMES. `antSpyT > 1.2 && antSpyT < 1.4` is a
      // two-hundred-millisecond WINDOW on a sixty-hertz clock, evaluated every
      // frame the bull is up — so the marquee beat of act three fired twelve
      // toasts, of which the wrapper keeps the last four, and the player was
      // told 'it is looking AT you' four times in a stack while a six-tonne
      // animal stood up out of the sea in front of them. `completeTask` is
      // idempotent and covered for the tick; nothing covers `toast`.
      if (!antSpyTold && antSpyT > 1.2) {
        antSpyTold = true;
        antTask('spy-hop');
        antToast('it is looking AT you. not at the boat.');
      }
    }
    // ---- THE BREACH ------------------------------------------------------
    // Out at forty-five degrees, over the top, and down on its side. Two and a
    // half seconds; the arc is a straight ballistic and the roll is what makes
    // it read as an animal rather than as a jump.
    let roll = Math.sin(ph * 0.5) * 0.12;
    if (antBreachT >= 0 && i === antBreachIdx) {
      const u = clamp(antBreachT / 2.6, 0, 1);
      // 4 sin(pi u) is 4 m of air at the top, which for a 9 m animal is most
      // of it clear — a full breach is not higher than that and looks wrong if
      // it is
      const rise = Math.sin(u * Math.PI);
      y = antWATER - 0.5 + rise * 6.4;
      pitch = Math.cos(u * Math.PI) * 0.95;
      roll = antSmooth((u - 0.45) / 0.55) * 1.9;
      // out ahead and to port of the boat, so the camera behind the tiller has
      // it dead centre
      antPodX[i] = damp(antPodX[i], antBoatX + 11 * sn - 7 * cs, 2.4, dt);
      antPodZ[i] = damp(antPodZ[i], antBoatZ + 11 * cs + 7 * sn, 2.4, dt);
      if (u > 0.93 && u - dt / 2.6 <= 0.93) {
        antSfx('swell', placeCue({ volume: 1.0, pitch: 0.75, force: true },
                                 antPodX[i], antWATER, antPodZ[i], 150));
        for (let k = 0; k < 6; k++) {
          antSpray(antPodX[i] + rand(-3, 3), antWATER + 0.6, antPodZ[i] + rand(-3, 3),
                   rand(-5, 5), rand(4, 9), rand(-5, 5));
        }
        if (typeof game.shake === 'function') game.shake(0.14);
      }
    }
    mesh.position.set(antPodX[i], y, antPodZ[i]);
    mesh.rotation.set(pitch, antPodYaw, roll, 'YXZ');
    // the flukes drive the rise: pitched a quarter ahead of the body, and
    // harder in the escort's 2.2 s cycle than the patrol's 4.2
    if (antPodFlukes) antPodFlukes[i].rotation.x = Math.cos(ph) * (escort ? 0.42 : 0.30);
    // the dorsal leans against the roll — flat on a porpoising back, well
    // over on a breaching one (roll up to 1.9 rad there)
    if (antPodFins) antPodFins[i].rotation.z = clamp(-roll * 0.45, -0.85, 0.85);

    // ---- AND SIX TONNES OF ANIMAL MOVES SOME WATER ----------------------
    //
    // The marquee of the chapter is 'call them, then hold your speed', and the
    // whole physical claim it rests on is that a hull sitting in that much
    // moving water goes faster than it has any right to (`antWAKE_GAIN`). The
    // player was being given the speed and shown NOTHING: six orcas at fifteen
    // metres a second either side of the boat and the sea was glass. The
    // spray system is already here for the bow, and a back breaking the
    // surface at that speed throws exactly this — so it is four lines and it
    // is the difference between a formation and six decals.
    if (escort && rise > 0.35 && y > antWATER - 0.55 && Math.random() < dt * 9) {
      const fs = Math.sin(antPodYaw), fc = Math.cos(antPodYaw);
      antSpray(antPodX[i] + fs * 2.6 + rand(-0.8, 0.8), antWATER + 0.25,
               antPodZ[i] + fc * 2.6 + rand(-0.8, 0.8),
               fs * 2.4 + rand(-1.6, 1.6), rand(1.4, 3.4), fc * 2.4 + rand(-1.6, 1.6));
    }
    // the blow, on the way up, once per surfacing
    if (rise > 0.97 && antPodBlow <= 0) {
      antPodBlow = 0.9;
      const blow = antPodGroup.getObjectByName('antBlow');
      if (blow) {
        blow.position.set(antPodX[i], antWATER + 1.3, antPodZ[i]);
        blow.visible = true;
      }
      if (antPodTight() || Math.random() < 0.35) {
        antSfx('hiss', { volume: antPodTight() ? 0.20 : 0.10, pitch: rand(0.30, 0.42) });
      }
    }
  }
  if (antPodBlow > 0) {
    antPodBlow -= dt;
    const blow = antPodGroup.getObjectByName('antBlow');
    if (blow) {
      const k = clamp(antPodBlow / 0.9, 0, 1);
      blow.scale.set(1.0 + (1 - k) * 1.6, 2.0 + (1 - k) * 2.2, 1.0 + (1 - k) * 1.6);
      blow.material.opacity = k * 0.5;
      blow.position.y = antWATER + 1.3 + (1 - k) * 1.4;
      if (antPodBlow <= 0) blow.visible = false;
    }
  }
}

// -------------------------------------------------------------- the locals --
function antUpdatePenguins(game, dt) {
  if (!antPengMesh) return;
  const capy = game.capy;
  const px = capy && capy.position ? capy.position.x : 0;
  const pz = capy && capy.position ? capy.position.z : 0;
  if (!antColonyCrit && typeof game.addCritter === 'function') {
    // 20 m is the look radius the birds already had; bold 0.8 rather than 1
    // because a gentoo standing on its own nest is committed to the nest and
    // will only turn its head. See THE CALM REGISTRY above antUpdateSeal.
    antColonyCrit = game.addCritter({ biome: 'antarctic', r: 20, bold: 0.8 });
    // ---- ...AND THEY WILL FOLLOW YOU (see THE HERD in systems.js) ---------
    // obey 1. A gentoo colony has worn a polished track down a hillside by
    // walking in single file behind whichever bird set off first, which is the
    // entire mechanic already, and the chapter has a task about that track.
    // A line of them behind a capybara is the joke this whole system exists
    // for and it costs ten lines.
    //
    // The birds ON NESTS are not offered: `antPENG_COL` of them are sitting on
    // eggs and a bird that walks off its nest to follow a rodent is a bird
    // that has abandoned an egg. The index is shifted past them, so `count`
    // reports only the ones standing about — which is also the third of the
    // colony that is genuinely at a loose end.
    if (typeof game.herdOffer === 'function') {
      // ---- THIS OFFER HAD NEVER WORKED, AND IT MEASURED AS FORTY-TWO ------
      //
      // MEASURED 8 Sep 2026 (`qa/n1-herd-y.js`, all nineteen chapters):
      // `herdDebug()` reported `{ kind: 'gentoo', n: 42 }` here and gave the
      // first one's position as **x 0, z 0** — the origin, out in the bay,
      // fifty to ninety metres from where any of them are drawn. Every other
      // chapter that offers an animal reported a live position.
      //
      // The cause is in the update above. The forty-two birds this offer
      // addresses are the ones past `antPENG_COL`, whose `mode` is 1 or 2 —
      // the penguin highway — and that branch computes x and z into LOCALS off
      // `antHIGH` and the walk parameter, and writes neither back. So the pair
      // this offer reads has been zero since the chapter was built, and the
      // pair it writes is read by nothing. A wheek near the spawn recruited
      // birds at the origin and dragged nothing; the herd soak saw no error
      // because there was none to see.
      //
      // Two lines fix it: the highway branch now stores the position it drew
      // at (which is what the rookery branch has always done), and a led or
      // perched bird is taken OFF the highway rather than being teleported
      // back onto it every frame. See antPengHeld.
      game.herdOffer({
        biome: 'antarctic', kind: 'gentoo', obey: 1, voice: 'gull', pitch: 1.35,
        count: function () { return Math.max(0, antPENG_N - antPENG_COL); },
        at: function (i, o) {
          const q = (i + antPENG_COL) * antPENG_S;
          o.x = antPengData[q]; o.z = antPengData[q + 1];
          o.y = antLandOnly(antPengData[q], antPengData[q + 1]);
        },
        put: function (i, x, z, yaw) {
          const q = (i + antPENG_COL) * antPENG_S;
          antPengHeld[i] = 0.25;                             // off the highway
          antPengData[q] = x; antPengData[q + 1] = z; antPengData[q + 2] = yaw;
          antPengData[q + 6] = x; antPengData[q + 7] = z;   // ...and its own target
        },
        // A GENTOO, ON A CAPYBARA, ON AN ORCA. Two seats — a gentoo is 75 cm
        // and stands upright, so one seat would have it filling the frame from
        // the shoulder. See THE PERCH in systems.js.
        span: 2,
        lift: function (i, y) {
          const q = (i + antPENG_COL) * antPENG_S;
          antPengHeld[i] = 0.25;
          antPengPerch[i] = 0.25;      // re-asked every frame — see antUpdatePeng
          antPengPerchY[i] = y;
        },
        // ---- ...AND ONE OF THEM MAY LEAVE THE CONTINENT (N3 → L6, F1) ----
        // See THE COMPANION in systems.js, which draws its own gentoo. A
        // gentoo in Venice is the best sentence this mechanic can produce.
        travels: true,
      });
    }
  }
  // ...and the whole colony looks up from further when the animal has settled.
  // Squared, because the test below is squared. 400 is 20 m.
  const pengLook2 = (function () {
    const r = 20 * (1 + (antColonyCrit ? antColonyCrit.appr : 0) * 0.6);
    return r * r;
  })();
  // ---- ...AND THE NEAR EDGE OF IT GOES UP (A3) --------------------------
  // antColonyCall has been the colony's answer to a wheek since it was written
  // and it has driven nothing audible but a level. On the rising edge — the
  // frame antWheek sets it to 1 — the birds nearest the noise actually leave
  // the ground. The ones on nests do not, which is correct and is why this is a
  // burst at the colony rather than the whole rookery going up.
  if (antColonyCall > 0.92 && antColonyBurst <= 0 && typeof game.wingburst === 'function') {
    antColonyBurst = 6.0;
    game.wingburst(antCOLONY.x, antTerrain(antCOLONY.x, antCOLONY.z) + 1.2, antCOLONY.z,
                   { key: 'ant:colony', near: 30, far: 320, n: 13,
                     spread: 1.2, pitch: 0.88, volume: 0.95 });
  }
  if (antColonyBurst > 0) antColonyBurst -= dt;
  // ---- ...AND THE ROOKERY IS A PLACE YOU WALK TOWARD (A1) --------------
  // A hundred and thirty-two birds on nests, ten thousand implied, and one
  // anchored `bark` rung between them. A colony is the loudest thing in
  // Antarctica and it is loud CONTINUOUSLY — which is exactly the thing this
  // game had no way to say until there were beds.
  if (!antColonyMover && game.sfxMover) {
    antColonyMover = game.sfxMover('colony', { key: 'ant:colony-bed', near: 40, far: 300 });
  }
  if (antColonyMover) {
    antColonyMover.at(antCOLONY.x, antTerrain(antCOLONY.x, antCOLONY.z) + 1.0, antCOLONY.z);
    // It answers a wheek like everything else down here does.
    antColonyMover.set(clamp(0.7 + antColonyCall * 0.3, 0, 1));
  }
  antColonyCall = damp(antColonyCall, 0, 0.9, dt);
  // ---- AND THE FRONT MOVES OUTWARD. See antCALL_SPD ---------------------
  if (antCallR >= 0) {
    antCallR += antCALL_SPD * dt;
    if (antCallR > antCALL_MAX + antCALL_TAIL) antCallR = -1;
  }
  // ---- THE ROLL, and it is three calls rather than one -------------------
  // A colony answering is not a sound, it is a WAVE: one bird starts, its
  // neighbours join, and it goes up the hill. Three at 0.10, 0.55 and 1.25 s,
  // getting quieter and further away, is the whole effect for three lines.
  for (let i = 0; i < 3; i++) {
    if (antCallT[i] < 0) continue;
    antCallT[i] -= dt;
    if (antCallT[i] > 0) continue;
    antCallT[i] = -1;
    // a penguin, which is a penguin (L7, E2) — it was `bark` at 1.5–2.3
    antSfx('penguin', { volume: 0.30 - i * 0.07, pitch: rand(0.9, 1.2), force: i === 0 });
  }
  // ...and the animal's own voice off the dome behind the station
  if (antEchoT >= 0) {
    antEchoT -= dt;
    if (antEchoT < 0) antSfx('wheek', { volume: 0.10, pitch: rand(0.82, 0.92) });
  }
  for (let i = 0; i < antPENG_N; i++) {
    const o = i * antPENG_S;
    const mode = antPengData[o + 3];
    let x, z, yaw, y, roll = 0, pitch = 0, stretch = 1;
    if (mode === 0) {
      // ---- THE PEBBLE RAID -----------------------------------------------
      //
      // The colony local's fourth line is "Every stone in every one of those
      // nests was stolen. Every one." — which is true, is the single most
      // famous thing about gentoo domestic life, and was a claim about a field
      // of birds that had never moved a centimetre in their lives. A rookery
      // is not a field of statues that occasionally throws its head back: at
      // any moment about one bird in eight is WALKING, and nearly all of them
      // are walking to or from somebody else's nest with a stone in mind.
      //
      // Out and back on one number: 1 at the start, 0 at home again, and the
      // half-way mark is the moment of the theft. No pathfinding — a gentoo
      // does not path-find either, it walks straight at the thing it wants and
      // gets shouted at all the way there.
      let ex = antPengData[o + 5];
      if (ex > 0) {
        ex = Math.max(0, ex - dt * 0.11);
        antPengData[o + 5] = ex;
        const out = ex > 0.5;
        const u = out ? (1 - ex) * 2 : ex * 2;        // 0 at home, 1 at the target
        const k = antSmooth(u);
        const tx = antPengData[o + 8], tz = antPengData[o + 9];
        x = lerp(antPengData[o + 6], tx, k);
        z = lerp(antPengData[o + 7], tz, k);
        antPengData[o] = x; antPengData[o + 1] = z;
        const hx = out ? tx - antPengData[o + 6] : antPengData[o + 6] - tx;
        const hz = out ? tz - antPengData[o + 7] : antPengData[o + 7] - tz;
        antPengData[o + 2] = Math.atan2(hx, hz);
        yaw = antPengData[o + 2];
        y = antLandOnly(x, z);
        // a walking gentoo is the funniest thing on the continent and the
        // reason is the ROLL: it has its feet at the very back of a body it
        // cannot balance, so it rocks about twelve degrees a step
        roll = Math.sin(antTime * 7.5 + i) * 0.21;
        pitch = 0.06;
        // ...and it stops dead in the middle, which is the theft
        if (ex > 0.48 && ex < 0.52) { roll *= 0.2; pitch = 0.42; }
      } else {
        x = antPengData[o]; z = antPengData[o + 1];
        // they turn to face whatever is nearest and largest, which down there
        // is usually another penguin and today is you
        const dx = px - x, dz = pz - z;
        const d2 = dx * dx + dz * dz;
        if (d2 < pengLook2) antPengData[o + 2] = Math.atan2(dx, dz);
        else antPengData[o + 2] += Math.sin(antTime * 0.4 + i) * dt * 0.5;
        yaw = antPengData[o + 2];
        y = antLandOnly(x, z);
        // the rock-in-place: a standing gentoo is never actually still
        roll = Math.sin(antTime * 1.7 + i * 0.9) * 0.10;
        // and every so often one of them goes shopping. Not while the colony
        // is answering a wheek — a bird in the middle of a chorus is not going
        // anywhere — and never the chicks, which do not leave the nest.
        if (antColonyCall < 0.2 && antPengScale[i] > 0.9 &&
            Math.random() < dt * 0.020) {
          antPengData[o + 5] = 1;
        }
      }
      // ---- THE ECSTATIC DISPLAY ------------------------------------------
      // Head straight back, bill at the sky, flippers out, and a noise like a
      // donkey being sawn in half. It is what a gentoo does when it is pleased,
      // when it is annoyed, when its mate comes home and — crucially — when
      // something makes an unfamiliar noise nearby, which one bird starts and
      // the rest of the colony joins. A colony that only ever TURNS is a field
      // of bowling pins; this is the one animation that makes it a rookery.
      //
      // It runs on its own all day at a low rate and goes to nearly all of
      // them for a couple of seconds when the capybara shouts.
      // ...and ONLY when it is at home. The display block below writes the
      // pitch, the roll, the height and the stretch, so a bird that started one
      // on its way across the colony froze in mid-stride with its head back.
      if (antPengData[o + 5] > 0) {
        // walking: nothing else to do
      } else if (antPengData[o + 4] > 0) {
        antPengData[o + 4] -= dt;
        const u = clamp(antPengData[o + 4] / 1.5, 0, 1);
        // in fast, hold, out slow — a bird throwing its head back does it in
        // about a fifth of a second and comes down over most of a second
        const k = u > 0.86 ? antSmooth((1 - u) / 0.14) : antSmooth(u / 0.86);
        // TWENTY-THREE DEGREES, NOT FIFTY-FOUR. This model is a bowling pin
        // with no neck, so a pitch big enough to read as "head thrown back"
        // simply lies the whole bird down — photographed at -0.95 the rookery
        // was a field of penguins having a nap. A small lean plus a vertical
        // STRETCH is the same read: the bird gets taller and points up, which
        // is what an ecstatic display looks like from twelve metres.
        pitch = -0.40 * k;
        y = antLandOnly(x, z) + 0.05 * k;
        roll = Math.sin(antTime * 22 + i) * 0.13 * k;
        stretch = 1 + 0.16 * k;
      } else {
        // THE BASELINE, plus whatever the front is doing HERE. A bird joins
        // when the wave arrives at IT — so what the eye sees is a crescent of
        // heads going back sweeping out of the colony and up the hill, which
        // is the thing the sound has always done and the picture never did.
        // Behind the front there is a tail, because a gentoo that has started
        // does not stop for a couple of seconds.
        let want = 0.012;
        if (antCallR >= 0) {
          const cdx = x - antCallX, cdz = z - antCallZ;
          const cd = Math.sqrt(cdx * cdx + cdz * cdz);
          // 1 exactly as the front passes, falling away over the tail behind
          // it, and nothing at all in front of it
          const behind = antCallR - cd;
          if (behind > 0 && behind < antCALL_TAIL) {
            want += 4.2 * (1 - behind / antCALL_TAIL) * clamp(1 - cd / antCALL_MAX, 0, 1);
          }
        }
        if (Math.random() < dt * want) antPengData[o + 4] = rand(1.1, 1.9);
      }
    } else {
      // ---- THE HIGHWAY, AND THE TWO WAYS OFF IT (N1) --------------------
      // `hi` is the index this bird has in the herd offer, which addresses the
      // birds past antPENG_COL. A HELD bird — one following you, or one riding
      // on you — is off the highway for as long as systems.js goes on saying
      // so, and its position is whatever it was last put at. Everything else
      // walks the polyline exactly as before.
      const hi = i - antPENG_COL;
      const held = hi >= 0 && antPengHeld[hi] > 0;
      if (held) {
        antPengHeld[hi] = Math.max(0, antPengHeld[hi] - dt);
        x = antPengData[o]; z = antPengData[o + 1];
        yaw = antPengData[o + 2];
        if (antPengPerch[hi] > 0) {
          antPengPerch[hi] = Math.max(0, antPengPerch[hi] - dt);
          // ON THE BACK. No toboggan, no waddle roll, no ground: a rider's
          // height comes from systems.js and the little rock-in-place is what
          // stops it reading as a statue glued on.
          y = antPengPerchY[hi];
          roll = Math.sin(antTime * 1.7 + i * 0.9) * 0.08;
        } else {
          y = antLandOnly(x, z) - 0.42;
          roll = Math.sin(antTime * 7 + i) * 0.22;
        }
      } else {
      antPengData[o + 4] += antPengData[o + 5] * dt * (mode === 2 ? 1 : 0.5);
      if (antPengData[o + 4] > 1) { antPengData[o + 4] = 1; antPengData[o + 5] *= -1; }
      if (antPengData[o + 4] < 0) { antPengData[o + 4] = 0; antPengData[o + 5] *= -1; }
      const u = antPengData[o + 4];
      const seg = clamp(Math.floor(u * 3), 0, 2);
      const t = u * 3 - seg;
      x = lerp(antHIGH[seg * 2], antHIGH[seg * 2 + 2], t);
      z = lerp(antHIGH[seg * 2 + 1], antHIGH[seg * 2 + 3], t);
      x += Math.sin(u * 22 + i) * 0.9;
      y = antLandOnly(x, z) - 0.42;
      yaw = Math.atan2(antHIGH[seg * 2 + 2] - antHIGH[seg * 2],
                       antHIGH[seg * 2 + 3] - antHIGH[seg * 2 + 1]);
      if (antPengData[o + 5] > 0) yaw += Math.PI;
      // A TOBOGGANING PENGUIN IS ON ITS FRONT. A resting pose is not a moving
      // pose with the speed set to zero, and a walking pose slid down a hill
      // is a penguin water-skiing.
      if (mode === 2) { pitch = 1.35; y -= 0.22; }
      else roll = Math.sin(antTime * 7 + i) * 0.22;
      // THE ONE LINE THE OFFER NEEDED. `at` reads this pair and it had never
      // been written for these birds; see the note on the herd offer below.
      antPengData[o] = x; antPengData[o + 1] = z; antPengData[o + 2] = yaw;
      }
    }
    // ...at ITS OWN SIZE, because a quarter of the birds standing between the
    // nests are chicks (see antPENG_COL) and the only difference between a
    // gentoo and its chick that survives this camera is the height of it.
    const ps = antPengScale ? antPengScale[i] : 1;
    antPengMesh.setMatrixAt(i, antXform(x, y, z, pitch, yaw, roll, ps, ps * stretch, ps));
  }
  antPengMesh.instanceMatrix.needsUpdate = true;

  // the ones in the water: a line of them porpoising out from the beach, which
  // is the fastest a gentoo ever moves and the only time they look like this
  if (antSwimPeng) {
    // ---- AND THEY WILL RIDE THE BOW WAVE --------------------------------
    //
    // The one thing everybody who has ever been in a Zodiac down there comes
    // back talking about: a dozen gentoos appear from nowhere, form up on the
    // bow at fourteen knots, and porpoise alongside for half a minute for no
    // reason anybody has ever established. It costs one timer and it is the
    // chapter's cheapest possible moment of delight — the orcas are the
    // marquee and they have to be summoned, held and earned; this just
    // HAPPENS, on the way out of the bay, the first time you open the
    // throttle.
    const bsp = Math.abs(antBoatSpeed);
    if (antPengEsc > 0) antPengEsc -= dt;
    else if (bsp > 4.5 && antHelmOn) {
      // near the colony's own water, which is the bay: they are not going to
      // follow you fifteen hundred metres to the shelf
      const d = Math.hypot(antBoatX - 4, antBoatZ + 34);
      if (d < 110 && Math.random() < dt * 0.55) {
        antPengEsc = rand(11, 18);
        if (!antToldPeng) {
          antToldPeng = true;
          antToast('they do this. nobody knows why they do this.');
        }
        antSfx('splash', placeCue({ volume: 0.26, pitch: 1.5 },
                                  antBoatX, antWATER, antBoatZ, 120));
      }
    }
    const esc = clamp(antPengEsc > 1 ? 1 : antPengEsc, 0, 1);
    const cs = Math.cos(antBoatYaw), sn = Math.sin(antBoatYaw);
    for (let i = 0; i < antSWIM_N; i++) {
      const o = i * 3;
      antSwimData[o] += antSwimData[o + 2] * dt * (1 + esc * 3.2);
      if (antSwimData[o] > 1) antSwimData[o] -= 1;
      const u = antSwimData[o];
      let x = lerp(16, -28, u) + antSwimData[o + 1];
      let z = lerp(6, -80, u) + antSwimData[o + 1] * 0.5;
      let yaw = Math.atan2(-44, -86);
      if (esc > 0.01) {
        // station on the bow quarters, alternating sides, staggered fore and
        // aft — the same layout idea as the pod, at a tenth of the scale
        const side = (i % 2 ? 1 : -1) * (3.4 + (i % 3) * 1.5);
        const along = antTEN_HZ * 0.9 + ((i * 5) % 7) * 1.9;
        const tx = antBoatX + sn * along + cs * side;
        const tz = antBoatZ + cs * along - sn * side;
        x = lerp(x, tx, esc); z = lerp(z, tz, esc);
        yaw = antBoatYaw;
      }
      // ...and the porpoise is faster when they are working
      const ph = u * 46 * (1 + esc * 1.6) + i;
      const rise = Math.sin(ph);
      const y = antSwellAt(x, z) + 0.26 + Math.max(0, rise) * (0.44 + esc * 0.34);
      antSwimPeng.setMatrixAt(i, antXform(x, y, z, -Math.cos(ph) * (0.26 + esc * 0.22),
                                          yaw, 0, 1, 1, 1));
      // one splash apiece as they break out, rationed hard
      if (esc > 0.5 && rise > 0.96 && Math.random() < dt * 2.2) {
        antSpray(x, antWATER + 0.2, z, rand(-1.5, 1.5), rand(1.2, 2.6), rand(-1.5, 1.5));
      }
    }
    antSwimPeng.instanceMatrix.needsUpdate = true;
  }
}

function antUpdateBirds(game, dt) {
  antPetrelScat = damp(antPetrelScat, 0, 0.8, dt);
  if (antPetrels) {
    for (let i = 0; i < antPETREL_N; i++) {
      const o = i * 4;
      // a scattered flock goes FASTER and WIDER, which is two multipliers on
      // numbers that already exist — no state, and it re-forms by itself
      antPetrelData[o] += antPetrelData[o + 3] * dt * (1 + antPetrelScat * 2.4);
      const a = antPetrelData[o], r = antPetrelData[o + 1] * (1 + antPetrelScat * 0.35);
      const x = antCALVE.x - 22 + Math.cos(a) * r;
      const z = antCALVE.z + Math.sin(a) * r * 1.4;
      // ---- AND THEY WERE FLYING INSIDE THE GLACIER --------------------
      // `antPetrelData[o + 2]` is an ABSOLUTE height of 9 to 26 m, and the
      // ring these birds fly is centred on x = -110 with a radius of up to 54,
      // which reaches x = -164 — where the ice cap is thirty-three metres
      // thick. Measured: SEVEN OF THE TWENTY-SIX were below the ice surface at
      // any moment, up to twenty-one metres under it. They are the chapter's
      // only scale reference for a forty-metre wall of ice ("a wall with
      // nothing in front of it could be four metres or four hundred"), and a
      // quarter of them were inside the wall. A petrel flies over the ground,
      // whatever the ground is doing.
      const gh = Math.max(antGlacierH(x, z), antWATER);
      const y = gh + antPetrelData[o + 2] * 0.55 + 6
              + antPetrelScat * 7 + Math.sin(antTime * 0.9 + i) * 1.2;
      antPetrels.setMatrixAt(i, antXform(x, y, z, Math.sin(antTime * 2 + i) * 0.12,
                                         a + (antPetrelData[o + 3] > 0 ? -1.57 : 1.57),
                                         Math.sin(antTime * 1.6 + i) * 0.5, 1, 1, 1));
    }
    antPetrels.instanceMatrix.needsUpdate = true;
  }
  // ---- THE CAPE PETRELS ROUND THE GATE -----------------------------------
  // Two flocks, one on each bastion, on the same field so they cost one draw.
  // They fly OVER THE GROUND — the same lesson the snow petrels paid for, and
  // it matters more here, because a sixty-two-metre headland is twice as tall
  // as the ice cap they learnt it on.
  if (antCapes) {
    antCapeScat = damp(antCapeScat, 0, 0.7, dt);
    for (let i = 0; i < antCAPE_N; i++) {
      const o = i * 4;
      const B = (i % 2) ? antEBAST : antWBAST;
      antCapeData[o] += antCapeData[o + 3] * dt * (1 + antCapeScat * 2.2);
      const a = antCapeData[o], r = antCapeData[o + 1] * (1 + antCapeScat * 0.3);
      const x = B.x + Math.cos(a) * r * 0.9;
      const z = B.z + Math.sin(a) * r;
      const gh = Math.max(antLandOnly(x, z), antWATER);
      const y = gh + antCapeData[o + 2] * 0.5 + 5 + antCapeScat * 9
              + Math.sin(antTime * 1.4 + i) * 1.6;
      // ...AND A CAPE PETREL FLICKS. It is the one thing about the flight
      // anybody remembers: three or four very fast beats and then a glide, so
      // the roll is a HIGH-frequency term with a slow envelope on it, not one
      // smooth sine like the snow petrels' soar.
      const beat = Math.max(0, Math.sin(antTime * 0.9 + i * 1.7));
      antCapes.setMatrixAt(i, antXform(x, y, z,
        Math.sin(antTime * 2.2 + i) * 0.10,
        a + (antCapeData[o + 3] > 0 ? -1.57 : 1.57),
        Math.sin(antTime * 13 + i) * 0.55 * beat + Math.sin(antTime * 0.7 + i) * 0.22,
        1, 1, 1));
    }
    antCapes.instanceMatrix.needsUpdate = true;
  }
  // ---- THE SKUA, AND IT ACTUALLY HUNTS NOW (Tier 5) ----------------------
  //
  // The note that stood here said the skua "drops on a nest, gets shouted at,
  // and goes round again", and BOTH halves were false. It flew a fixed
  // 22 x 15 ellipse and dipped at a fixed phase, consulting `antNests` never
  // and targeting nobody; and nothing in antUpdatePenguins read `antSkuaT`,
  // `antSkuaFlush` or the dive at all, so a hundred and thirty-two birds sat
  // through it in silence. A second note thirty lines up called it "the only
  // thing in this chapter that is actively up to something."
  //
  // NOTHING IN THIS GAME HUNTS. Verified across the whole tree before
  // building: `addCritter` is a flee registry measured against the player,
  // `herdOffer` is a follow-the-leader solver whose leader is always the
  // capybara, and the one real chase solver is in npc.js and is a person
  // chasing you about a sandwich. There is no predator-prey coupling
  // anywhere. This is the first.
  //
  // THREE PHASES, AND THE MIDDLE ONE IS THE POINT.
  //
  //   pick   — it chooses a NEST, not a phase of a circle, and it works
  //            round to be upwind of it. Which nest is a function of the
  //            clock, so it is not the same one every time.
  //   stoop  — it commits. Once committed the geometry is a fall at a fixed
  //            point on the ground, which is what makes it readable from a
  //            hundred metres and what makes it interruptible.
  //   after  — it lands, and the colony goes up FROM THE POINT IT LANDED.
  //
  // THE COLONY REACTION COST FOUR LINES, because `antCallX/Z/R` is already a
  // wave front parameterised by an arbitrary point — it was built for the
  // wheek and it never occurred to anyone to fire it from anything else. The
  // penguins update BEFORE the birds do, so the shout lands on the next
  // frame, which is correct: they see it hit, and then they shout.
  //
  // AND THE PLAYER CAN STOP IT. `antSkuaFlush` already broke off a stoop
  // when you wheeked inside forty metres, on the reasoning that this is what
  // a bird half way down does when something unexpected happens under it.
  // That was a cosmetic flinch on a dive that was going nowhere. It is now
  // the difference between a chick and no chick, and it is the only place in
  // nineteen chapters where the animal can spend its voice on somebody
  // else's behalf.
  if (antSkua) {
    const wasFlush = antSkuaFlush;
    antSkuaFlush = damp(antSkuaFlush, 0, 1.2, dt);
    antSkuaT += dt;
    const T = 26;
    const u = (antSkuaT % T) / T;
    // Which nest this lap. The golden ratio off the lap number, so a player
    // who watches four laps sees four different corners of the colony and
    // never learns a spot to stand in.
    const lap = Math.floor(antSkuaT / T);
    if (lap !== antSkuaLap) {
      antSkuaLap = lap;
      antSkuaGot = false;
      if (antNests.length >= 2) {
        const nn = antNests.length / 2;
        antSkuaNest = Math.floor(((lap * 0.6180339887) % 1) * nn) % nn;
      }
    }
    const tnx = antNests.length ? antNests[antSkuaNest * 2] : antCOLONY.x;
    const tnz = antNests.length ? antNests[antSkuaNest * 2 + 1] : antCOLONY.z;
    // The approach: the same slow figure it always flew, but centred so that
    // the low point of it passes over the nest it has picked rather than over
    // whatever happened to be at phase 0.62.
    const a = u * Math.PI * 2;
    const cx = lerp(antCOLONY.x, tnx, 0.5), cz = lerp(antCOLONY.z, tnz, 0.5);
    const rx = 22, rz = 15;
    let x = cx + Math.cos(a) * rx;
    let z = cz + Math.sin(a) * rz;
    const dive = clamp(1 - Math.abs(u - 0.62) / 0.10, 0, 1) * (1 - antSkuaFlush);
    // ...and inside the stoop it stops flying the ellipse and falls at the
    // nest. A circle that happens to be low is a bird doing a circuit; a line
    // that ends on one nest is a bird that has chosen something.
    if (dive > 0) {
      const k = antSmooth(dive);
      x = lerp(x, tnx, k);
      z = lerp(z, tnz, k);
    }
    const y = antLandOnly(x, z) + lerp(11, 1.4, antSmooth(dive)) + antSkuaFlush * 9;
    antSkua.position.set(x, y, z);
    antSkua.rotation.set(dive * -0.7, a + 1.57, Math.sin(a) * 0.35 + antSkuaFlush * 0.7, 'YXZ');
    // ---- THE STRIKE, once per lap, and only if it was not broken off -----
    // The edge is the same 0.618 crossing the cry has always used, so the
    // scream and the hit are the same event rather than two near ones.
    const prevU = ((antSkuaT - dt) % T) / T;
    const crossed = prevU < 0.618 && u >= 0.618;
    if (crossed) antSfx('gull', { volume: 0.15, pitch: 1.9 });
    // ...and the whole strike cuts, on the shared Tier 5 flag. With it set
    // the skua flies its old cosmetic circuit and the colony never hears it,
    // which is exactly what this chapter did before.
    if (crossed && !antSkuaGot && !(game.state && game.state.noHunt)) {
      antSkuaGot = true;
      if (antSkuaFlush > antSKUA_SPOIL) {
        // ---- YOU PUT IT OFF -------------------------------------------
        antSkuaSaved++;
        antSfx('gull', { volume: 0.22, pitch: 2.3 });
        if (antSkuaSaved === 1) {
          antToast('it pulled out. the colony is still shouting about it.');
        }
        // the colony still goes up — they do not know why, only that
        // something came at them and left
        antSkuaShout(tnx, tnz, 0.7);
      } else {
        // ---- IT GOT ONE -----------------------------------------------
        // NOT DRAWN, and that is a decision rather than a shortcut. This is
        // a game about a capybara knocking things over; a chick being eaten
        // on screen is a different game. What is drawn is the fall, the
        // colony going up, and the bird leaving heavy and low — which is
        // how anybody actually watching a skua works out what happened.
        antSkuaTook++;
        antSkuaHeavy = 1;
        antSfx('gull', { volume: 0.26, pitch: 1.6 });
        antSkuaShout(tnx, tnz, 1);
        // ...said once, the first time it happens where the player can see it
        // (L7, E5 / play 7): the line went up with no penguin in frame.
        const scp = game.capy && game.capy.position;
        if (!antSkuaSaid && scp && Math.hypot(scp.x - tnx, scp.z - tnz) < 30) {
          antSkuaSaid = true;
          antToast('the whole colony went up at once. one of them did not.');
        }
      }
    }
    // it flies out heavy — low, slow, and straight, for about four seconds
    if (antSkuaHeavy > 0) antSkuaHeavy = Math.max(0, antSkuaHeavy - dt * 0.25);
    if (wasFlush > 0.75 && antSkuaFlush <= 0.75) {
      antSfx('gull', { volume: 0.18, pitch: 2.2 });
    }
  }
}

/**
 * A HUNDRED AND THIRTY-TWO BIRDS ANSWER A POINT ON THE GROUND.
 *
 * `antCallX/Z/R` is the colony's ecstatic-display wave front and it has been
 * a general "something happened at (x, z)" channel since it was written — it
 * simply had exactly one caller, the wheek. The skua fires it now, which is
 * the entire cost of the reaction the file has been claiming for months.
 */
function antSkuaShout(x, z, k) {
  antCallX = x; antCallZ = z; antCallR = 0;
  antColonyCall = Math.max(antColonyCall, k);
}

/**
 * THE LEOPARD SEAL. It lives on one particular floe and it goes where that
 * floe goes, which is the only reason a hauled-out seal can be in a chapter
 * whose ground is all moving.
 */
// ---------------------------------------------------------------------------
// THE CALM REGISTRY, AND WHY THIS CHAPTER'S TWO ANIMALS USE THE OTHER HALF OF IT
//
// `game.addCritter` publishes two numbers. `near` is a FLEE radius shrunk by
// how settled the player is, and every one of the six chapters that had
// registered anything before this reads that one: `if (d < cr.near) spook()`.
// `appr` is the other half, published since v23 and read by nobody outside
// Iceland — 0..1, how much this animal has decided to come over.
//
// Nothing on the Peninsula flees. A Weddell seal hauled out on a pan and a
// colony of gentoos are the two least frightened animals in the game: they
// look AT you, and what stillness should buy is that they notice you from
// further away, not that they let you closer. So both of these register bold
// and read `appr`, and neither one touches `near` — which is the first time in
// the game the approaching half of the inversion has been used for what the
// comment in systems.js says it is for.
//
// It is one multiplier on a radius that already existed. Nothing new is drawn,
// nothing moves that did not move, and at appr 0 both are the chapter that
// shipped.
// ---------------------------------------------------------------------------
let antSealCrit = null, antColonyCrit = null;

function antUpdateSeal(game, dt) {
  if (!antSealGroup) return;
  if (!antSealCrit && typeof game.addCritter === 'function') {
    antSealCrit = game.addCritter({ biome: 'antarctic', r: antSEAL_NOTICE, bold: 1 });
    // ---- THE LEOPARD SEAL IS NOT OFFERED, AND SHE WAS ---------------------
    // She was the second animal at obey 3, to stand beside the Kyoto heron,
    // and she had to come out. Her whole state machine is built around GOING
    // INTO THE WATER when anything approaches: antSEAL_NOTICE is 24 m and puts
    // her to watching, and closing further puts her to in. The herd carries
    // fifteen metres, so there is no distance at which she is both on the floe
    // and inside earshot — measured n: 0 on every wheek of every attempt,
    // first gating the offer on hauled and then on hauled-or-watching.
    //
    // Widening it would mean overriding the chapter own marquee — the whole of
    // leopard-seal is her leaving the ice to come and inspect you — which is
    // the same reason the Pantanal capybaras are not offered (they have a
    // native follower system) and its caimans are not either: a caiman is a
    // load-bearing FLOOR with a collider baked at build time, and moving one
    // desyncs the two. An offer that cannot be completed is the exact bug this
    // whole pass exists to find, so it is a comment instead of an offer.
  }
  const i = antSealFloe;
  const fx = antFloeX[i], fz = antFloeZ[i];
  const fy = antWATER + antFLOE_TOP + 0.32;

  // ---- WHO SHE IS LOOKING AT ---------------------------------------------
  // Whichever of the two is nearer — a leopard seal is interested in a boat
  // and in a swimming rodent for exactly the same reason.
  const capy = game.capy;
  let px = antBoatX, pz = antBoatZ;
  if (!antHelmOn && capy && capy.position) {
    const dbx = antBoatX - antSealX, dbz = antBoatZ - antSealZ;
    const dcx = capy.position.x - antSealX, dcz = capy.position.z - antSealZ;
    if (dcx * dcx + dcz * dcz <= dbx * dbx + dbz * dbz) { px = capy.position.x; pz = capy.position.z; }
  }
  const dFloe = Math.hypot(px - fx, pz - fz);

  // ---- THE STATE MACHINE. See antSEAL_NOTICE -----------------------------
  antSealT += dt;
  if (antSealState === "watching") {
    antSealX = fx; antSealZ = fz; antSealY = fy;
    if (dFloe > antSEAL_NOTICE * 1.35) { antSealState = "hauled"; antSealT = 0; }
    // she looks at you for a moment, and then she is simply not on the ice
    // any more, which is the thing everybody says about them
    else if (antSealT > 1.9) {
      antSealState = "in"; antSealT = 0; antSealSurf = 0;
      antSfx("splash", { volume: 0.34, pitch: 0.62, at: { x: fx, y: antWATER, z: fz } });
      for (let k = 0; k < 5; k++) {
        antSpray(fx + rand(-1.4, 1.4), antWATER + 0.3, fz + rand(-1.4, 1.4),
                 rand(-2, 2), rand(1.4, 3.2), rand(-2, 2));
      }
    }
  } else if (antSealState === "in") {
    // STATION: abeam of whatever she is following and a little astern of it,
    // and the side she picks is the side she is already on — so she does not
    // cut across the bow to swap every time the helm moves.
    const hdg = antHelmOn ? antBoatYaw : Math.atan2(px - antSealX, pz - antSealZ);
    const cs = Math.cos(hdg), sn = Math.sin(hdg);
    const side = ((antSealX - px) * cs - (antSealZ - pz) * sn) >= 0 ? 1 : -1;
    let sx = px + side * antSEAL_ABEAM * cs - 2.4 * sn;
    let sz = pz - side * antSEAL_ABEAM * sn - 2.4 * cs;
    // ...AND SHE KEEPS HER DISTANCE. `hdg` is her own bearing to the target
    // when the target is not under way, so the station point rotates with her
    // and the whole thing is a pursuit spiral: measured against a swimming
    // capybara she converged to 2.6 m and sat there, which is inside the
    // camera boom. Push the station back out to a minimum standoff and the
    // spiral has a floor.
    {
      let ox = sx - px, oz = sz - pz;
      const od = Math.hypot(ox, oz);
      if (od < antSEAL_MIN) {
        const k = od > 0.01 ? antSEAL_MIN / od : 0;
        sx = px + ox * k; sz = pz + oz * k;
        if (od <= 0.01) { sx = px + antSEAL_MIN; sz = pz; }
      }
    }
    // ...AND SHE DOES NOT FOLLOW YOU ONTO A BEACH. Same rule as the pod, for
    // the same reason: the target is a point and nothing had ever asked
    // whether the point was wet.
    antToDeep(sx, sz);
    sx = antDeep.x; sz = antDeep.z;
    const mvx = sx - antSealX, mvz = sz - antSealZ;
    const md = Math.hypot(mvx, mvz) || 1;
    const step = Math.min(md, antSEAL_SPD * dt);
    antSealX += (mvx / md) * step;
    antSealZ += (mvz / md) * step;
    antSealYaw = Math.atan2(px - antSealX, pz - antSealZ);
    // ---- the cycle: down, along, up, LOOK, and down again ---------------
    // A TRIANGLE IS NOT A SURFACING. The first cut peaked for an instant at
    // the middle of each cycle and this sea is OPAQUE — the same trap the pod
    // fell into, where six orcas at waterLevel - 0.85 broke the surface for a
    // third of each porpoise and the photograph of the escort had none in it.
    // A seal that comes up to look at you HOLDS there while it looks. So the
    // profile is a trapezoid: nine tenths of a second up, a second and a half
    // with her back and her head clear of the water and her eye on you, and
    // nine tenths back down. Just over half the cycle, and every bit of the
    // half is the half that is worth seeing.
    const u = (antSealT % antSEAL_CYCLE) / antSEAL_CYCLE;
    const upK = clamp((0.26 - Math.abs(u - 0.5)) / 0.10, 0, 1);
    antSealY = antWATER - 1.55 + upK * 1.45;
    antSealSurf = upK;
    // AND SHE IS AUDIBLE WHEN SHE IS NOT VISIBLE, which is the whole feeling.
    // One breath as she comes up, once per cycle, positioned — so what you get
    // standing in the water is a noise behind you and then nothing, four or
    // five times, and a very large animal you can only see half the time.
    if (upK > 0.02 && antSealBr <= 0) {
      antSealBr = antSEAL_CYCLE * 0.5;
      antSfx('hiss', { volume: 0.20, pitch: rand(0.34, 0.44),
                       at: { x: antSealX, y: antWATER, z: antSealZ } });
    }
    if (upK <= 0.02) antSealBr = 0;
    if (upK > 0.9 && md < antSEAL_ABEAM * 2.4) {
      if (!antSealSeen) {
        antSealSeen = true;
        antTask("leopard-seal");
        antSfx("hiss", { volume: 0.28, pitch: 0.30, at: { x: antSealX, y: antWATER, z: antSealZ } });
        antToast("it is smiling. it is not smiling.");
      } else if (!antSealTold && antSealT > antSEAL_CYCLE * 2.4) {
        antSealTold = true;
        antToast("she is going to keep doing that until she is bored.");
      }
    }
    if (antSealT > antSEAL_BORED || dFloe > 210) { antSealState = "leaving"; antSealT = 0; }
  } else if (antSealState === "leaving") {
    // ---- BACK TO WHATEVER PAN IS NEAREST, WHICH IS NOT NECESSARILY HERS --
    // Her floe is on the same conveyor as the other fourteen: it drifts south
    // to the shelf and is then RECYCLED four hundred and eighty metres north
    // to the top of the bay (see antUpdateFloes). Only the capybara blocks
    // that recycle, so a seal three hundred metres down the channel could be
    // sent home to a piece of ice that had just teleported past her — a
    // seventy-five-second swim north through the middle of the chapter with
    // her head coming up every four and a half seconds all the way. A seal
    // hauls out on whatever ice is handy; so does this one, and the pan she
    // picks becomes the one she lives on.
    if (antFloeX) {
      let bi = antSealFloe, bd = 1e18;
      for (let k = 0; k < antFLOE_N; k++) {
        const ddx = antFloeX[k] - antSealX, ddz = antFloeZ[k] - antSealZ;
        const d2 = ddx * ddx + ddz * ddz;
        if (d2 < bd) { bd = d2; bi = k; }
      }
      antSealFloe = bi;
    }
    const mvx = antFloeX[antSealFloe] - antSealX, mvz = antFloeZ[antSealFloe] - antSealZ;
    const md = Math.hypot(mvx, mvz) || 1;
    const step = Math.min(md, antSEAL_SPD * 0.8 * dt);
    antSealX += (mvx / md) * step;
    antSealZ += (mvz / md) * step;
    antSealYaw = Math.atan2(mvx, mvz);
    antSealY = damp(antSealY, md < 4 ? antWATER + antFLOE_TOP + 0.32 : antWATER - 0.9, 2.2, dt);
    antSealSurf = clamp(1 - md / 12, 0, 1);
    if (md < 2.2) { antSealState = "hauled"; antSealT = 0; antSealTold = false; }
  } else {
    // hauled out, and she goes where her pan goes
    antSealX = fx; antSealZ = fz; antSealY = fy;
    // ...and she notices from FURTHER when you have been still. `appr` is the
    // registry's approach term (see THE CALM REGISTRY above); at 1 it is half
    // as far again, which on a pan out in the pack is the difference between
    // being ignored and being come over to.
    const notice = antSEAL_NOTICE * (1 + (antSealCrit ? antSealCrit.appr : 0) * 0.5);
    if (dFloe < notice) { antSealState = "watching"; antSealT = 0; }
  }

  antSealGroup.position.set(antSealX, antSealY, antSealZ);

  // ---- what she is doing with her head -----------------------------------
  const onIce = antSealState === "hauled" || antSealState === "watching";
  const near = Math.hypot(px - antSealX, pz - antSealZ);
  // 22 is the head-turn's own reach and it moves with the notice radius, or a
  // seal who has come over because you sat still arrives and looks past you.
  const lookR = 22 * (1 + (antSealCrit ? antSealCrit.appr : 0) * 0.5);
  const want = onIce ? (near < lookR ? clamp(1 - (near - 6) / (lookR - 6), 0, 1) : 0) : antSealSurf;
  antSealLook = damp(antSealLook, want, 2.4, dt);
  const faceYaw = onIce ? Math.atan2(px - antSealX, pz - antSealZ) : antSealYaw;
  antSealGroup.rotation.y = damp(antSealGroup.rotation.y,
                                 (!onIce || near < 30) ? faceYaw : antSealGroup.rotation.y,
                                 onIce ? 1.6 : 4.0, dt);
  // ...and in the water she is NOSE-UP, which is how one looks at you — in
  // 'YXZ', because the default XYZ order applies the pitch about the WORLD x
  // axis after the yaw, so a seal heading east came up ROLLED ONTO HER SIDE.
  // Same order the pod uses, for the same reason.
  antSealGroup.rotation.set(onIce ? 0 : -antSealSurf * 0.34,
                            antSealGroup.rotation.y, 0, 'YXZ');
  if (antSealHead) {
    antSealHead.rotation.x = -0.15 - antSealLook * 0.30;
    antSealHead.position.y = 0.30 + antSealLook * 0.42;
  }
  // THE GAPE. It is the whole animal, and it is the reason this is the one
  // thing down here that nobody is relaxed about.
  if (antSealJaw) antSealJaw.rotation.x = antSealLook * antSealLook * 0.62;
  // ...and she moves water. A three-hundred-kilo animal surfacing at six
  // metres a second throws exactly this, and it is the only warning you get.
  if (!onIce && antSealSurf > 0.55 && Math.random() < dt * 7) {
    antSpray(antSealX + rand(-0.9, 0.9), antWATER + 0.2, antSealZ + rand(-0.9, 0.9),
             rand(-1.4, 1.4), rand(1.0, 2.4), rand(-1.4, 1.4));
  }

  // ---- AND THE WEDDELL ON THE BEACH IS BREATHING ------------------------
  // "It is on no list, it wants nothing, and it is the only thing in the
  // chapter having a nicer time than you are" — and for its whole life it was
  // a mesh placed once and never touched again, which is not asleep, it is
  // taxidermy. Three hundred kilos of seal takes a very slow, very obvious
  // breath, and every eleven seconds or so it rolls a bit and goes back to
  // sleep. Two sines and a scale, and it is the single cheapest thing in this
  // pass that turns an object into an animal.
  if (antWeddell) {
    const br = Math.sin(antTime * 0.34);
    antWeddell.scale.set(1 + br * 0.020, 1 + br * 0.028, 1);
    antWeddell.rotation.z = Math.sin(antTime * 0.11) * 0.035;
    // ...and once in a while it lifts its head, looks at nothing, and puts it
    // down again, which is the whole of a Weddell seal's day
    const roll = (antTime % 23) / 23;
    antWeddell.rotation.x = roll < 0.10 ? -Math.sin(roll / 0.10 * Math.PI) * 0.22 : 0;
  }

}

// ---------------------------------------------------------------- calving ---
/**
 * THE GLACIER LETS GO, ON A CLOCK, WHETHER OR NOT ANYBODY IS WATCHING.
 *
 * Ambient-mover rule 1: ration it and scale it by distance. Every forty-odd
 * seconds, twenty-four blocks come off the front and go in the water, and the
 * crack arrives a beat before the splash because sound is slow and this is the
 * only place in the game where the player is far enough away for that to be
 * true.
 */
function antUpdateCalving(game, dt) {
  antCalveT -= dt;
  // ---- THE WINDOW (L6, F2): the wait, and the countdown on the line ------
  {
    const cp = game.capy && game.capy.position;
    const df = cp ? Math.hypot(cp.x - antGLAC.xToe, cp.z - antCALVE.z) : 999;
    antCalveWait = antHelmOn && df < antCALVE_SEE_R + 20 ? antCalveWait + dt : 0;
    if (df < 140 && game.recordLive) game.recordLive('the-calving', Math.max(0, antCalveT));
  }
  if (antCalveT <= 0) {
    antCalveT = rand(38, 62);
    antCalveLive = 6.0;
    // ---- IT COMES OFF THE FACE NOW ---------------------------------------
    // `antCALVE.x ± 30` spans x = -118 to -58, and the toe is at -86: half of
    // every calving happened THIRTY METRES INLAND, up the ramp, and the other
    // half happened out in open water. Twenty-four blocks appearing in the
    // middle of a snowfield and rolling downhill is a landslide, not a
    // calving. antBuildGlacier has just put a serac face along x = xToe; this
    // is the thing that falls off it, and it starts at the top of the wall
    // rather than at ground level.
    const cz = antCALVE.z + rand(-46, 46);
    const cx = antGLAC.xToe + rand(-7, 1);
    const faceH = Math.max(antGlacierH(cx - 6, cz), antWATER + 3);
    for (let i = 0; i < 24; i++) {
      const o = i * 7;
      antCalveData[o] = cx + rand(-3, 5);
      antCalveData[o + 1] = antWATER + rand(0.5, 1) + Math.random() * faceH;
      antCalveData[o + 2] = cz + rand(-11, 11);
      // OUT and DOWN: a block leaving a face has the wall's own outward push
      // on it and nothing else
      antCalveData[o + 3] = rand(2.5, 8.0);
      antCalveData[o + 4] = rand(-1, 2);
      antCalveData[o + 5] = rand(-3, 3);
      antCalveData[o + 6] = rand(1.0, 3.4);
    }
    antCalveBits.visible = true;
    const capy = game.capy;
    const far = capy && capy.position
      ? Math.sqrt(Math.pow(capy.position.x - cx, 2) + Math.pow(capy.position.z - cz, 2)) : 300;
    // ---- AND IT IS TWO SOUNDS, WHICH IS THE WHOLE OF WHY IT IS FRIGHTENING
    // The crack is the ice failing and it is a sharp, high, enormous noise; the
    // rumble is a million tonnes arriving in the water and it comes a beat
    // later. This is the one place in the game the player is far enough away
    // for the delay to be real, and the file's own comment has said so since it
    // shipped — there was one thud.
    const v = clamp(0.46 - far * 0.0011, 0.05, 0.46);
    // the crack is a crack (L7, E2): thirty milliseconds at 3 kHz with the
    // face's own rumble under it, where a `thud` at 0.62 was standing in
    antSfx('calve', { volume: v, pitch: 1.0 });
    antCrackT = 0.55 + far * 0.0018;
    // ---- THE WINDOW (L6, F2): `the-calving` — at the tiller, inside the
    // ring of the block that came off, on the frame it comes off.
    if (!antCalvingDone && antHelmOn && far < antCALVE_SEE_R) {
      antCalvingDone = true;
      antTask('the-calving');
      if (typeof game.record === 'function') game.record('the-calving', Math.round(antCalveWait));
      if (typeof game.recordEnd === 'function') game.recordEnd('the-calving');
      if (game.toast) game.toast('a million tonnes, from seventy metres. hold on: the wave is next.');
    }
    antCrackV = v * 0.85;
    // the ice cloud off the face, which is what you actually see first
    for (let i = 0; i < 10; i++) {
      antSpray(cx + rand(-4, 4), antWATER + rand(1, faceH * 0.7), cz + rand(-12, 12),
               rand(1, 6), rand(0.5, 3), rand(-4, 4));
    }
    // ...and it makes a WAVE, which is the half of this event that was never
    // built. See antUpdateSpray.
    antCalveWave = 6.0;
    antCalveWaveX = cx; antCalveWaveZ = cz;
    // and the birds go up off the face, which is the tell a second before the
    // crack arrives if you happen to be looking that way
    antPetrelScat = 1;
  }
  // the rumble, a beat behind the crack — sound is fast, a million tonnes of
  // ice arriving in the sea is not
  if (antCrackT > 0) {
    antCrackT -= dt;
    if (antCrackT <= 0) {
      // ...and what arrives a beat later is the WATER (L7, E2): a swell,
      // which is a mass of sea going past, where a `thud` at 0.24 and a
      // `splash` at 0.30 were standing in for it
      antSfx('swell', { volume: antCrackV * 1.4, pitch: 0.75 });
    }
  }
  if (antCalveLive > 0) {
    antCalveLive -= dt;
    for (let i = 0; i < 24; i++) {
      const o = i * 7;
      antCalveData[o + 4] -= 22 * dt;
      antCalveData[o] += antCalveData[o + 3] * dt;
      antCalveData[o + 1] += antCalveData[o + 4] * dt;
      antCalveData[o + 2] += antCalveData[o + 5] * dt;
      if (antCalveData[o + 1] < antWATER + 0.2) {
        antCalveData[o + 1] = antWATER + 0.2;
        antCalveData[o + 4] = 0;
        antCalveData[o + 3] *= 0.90;
        antCalveData[o + 5] *= 0.90;
      }
      const r = antCalveData[o + 6];
      antCalveBits.setMatrixAt(i, antXform(antCalveData[o], antCalveData[o + 1], antCalveData[o + 2],
                                           antCalveLive * 1.4 + i, i * 0.7, 0, r, r * 0.7, r * 0.9));
    }
    antCalveBits.instanceMatrix.needsUpdate = true;
    if (antCalveLive <= 0) antCalveBits.visible = false;
  }
}

/**
 * THE SPINDRIFT. A hundred and twenty streaks blowing down a forty-metre ramp.
 *
 * Each one is a flat quad lying ON the slope (so it never floats and never
 * needs a shadow), sliding downhill and fading. The bias toward the crests is
 * the whole realism of it: a real one comes off a break of slope, so the
 * spawn rejects any point where the ground is not steepening.
 */
function antUpdateDrift(dt) {
  if (!antDriftMesh) return;
  for (let i = 0; i < antDRIFT_N; i++) {
    const o = i * 4;
    antDriftData[o + 2] += dt;
    if (antDriftData[o + 2] > antDriftData[o + 3]) {
      antDriftData[o + 2] = 0;
      antDriftData[o + 3] = rand(2.2, 5.5);
      antDriftData[o] = rand(antGLAC.xTop + 20, antGLAC.xToe - 6);
      antDriftData[o + 1] = rand(antGLAC.z0, antGLAC.z1);
    }
    const t = antDriftData[o + 2] / antDriftData[o + 3];
    // DOWNHILL IS +x on this slab, because height is a function of x alone —
    // which is the same fact that makes the glacier a fall line at all.
    const x = antDriftData[o] + t * 26;
    const z = antDriftData[o + 1] + Math.sin(t * 4 + i) * 3.5;
    const gh = antGlacierH(x, z);
    if (gh < antWATER) {
      antDriftMesh.setMatrixAt(i, antXform(0, -900, 0, 0, 0, 0, 0.01, 0.01, 0.01));
      continue;
    }
    // in fast, out slow, and it stretches as it goes. One material means the
    // fade has to be baked into the SCALE — a streak that is thinning is a
    // streak that is going away, and it costs nothing.
    const fade = t < 0.10 ? t / 0.10 : 1 - (t - 0.10) / 0.90;
    const len = 5 + t * 22;
    const wide = (0.16 + t * 0.34) * fade;
    antDriftMesh.setMatrixAt(i, antXform(x, gh + 0.20 + t * 0.9, z,
                                         0, 0, 0, len, 1, wide));
  }
  antDriftMesh.instanceMatrix.needsUpdate = true;
}

/** The bow spray, and the wave off a calving face. */
function antUpdateSpray(game, dt) {
  if (!antSprayMesh) return;
  // ---- throw some ---------------------------------------------------------
  antSprayT -= dt;
  const sp = Math.abs(antBoatSpeed);
  if (antSprayT <= 0 && sp > 4.5) {
    // rationed by speed AND by what she is going through: full ahead in brash
    // throws far more than full ahead in the lead, which is also why it is
    // loud there
    antSprayT = clamp(0.30 - sp * 0.016 - antBoatIce * 0.10, 0.07, 0.30);
    const cs = Math.cos(antBoatYaw), sn = Math.sin(antBoatYaw);
    for (let k = -1; k <= 1; k += 2) {
      const bx = antBoatX + sn * antTEN_HZ * 0.95 + cs * k * antTEN_HX * 0.9;
      const bz = antBoatZ + cs * antTEN_HZ * 0.95 - sn * k * antTEN_HX * 0.9;
      antSpray(bx, antSwellAt(bx, bz) + 0.3, bz,
               sn * sp * 0.35 + cs * k * (1.6 + antBoatIce * 1.4),
               2.2 + sp * 0.16,
               cs * sp * 0.35 - sn * k * (1.6 + antBoatIce * 1.4));
    }
  }
  // ---- and step them ------------------------------------------------------
  for (let i = 0; i < antSPRAY_N; i++) {
    const o = i * 7;
    if (antSprayData[o + 6] > 1.1) {
      antSprayMesh.setMatrixAt(i, antXform(0, -900, 0, 0, 0, 0, 0.01, 0.01, 0.01));
      continue;
    }
    antSprayData[o + 6] += dt;
    antSprayData[o + 4] -= 11 * dt;
    antSprayData[o] += antSprayData[o + 3] * dt;
    antSprayData[o + 1] += antSprayData[o + 4] * dt;
    antSprayData[o + 2] += antSprayData[o + 5] * dt;
    const t = clamp(antSprayData[o + 6] / 1.1, 0, 1);
    const s = (0.5 + t * 1.5) * (1 - t * 0.55);
    antSprayMesh.setMatrixAt(i, antXform(antSprayData[o], antSprayData[o + 1], antSprayData[o + 2],
                                         0, i * 0.7, 0, s, s * 0.8, s));
  }
  antSprayMesh.instanceMatrix.needsUpdate = true;

  // ---- THE WAVE OFF A CALVING FACE ---------------------------------------
  // A million tonnes of ice going in the water makes a wave, and for the whole
  // life of this chapter the only consequence of the marquee-adjacent event
  // was twenty-four boxes and a noise. It arrives at the boat a beat after the
  // crack — sound is fast, water is not — and it LIFTS her, which is the only
  // way the player is ever told that a thing four hundred metres away was big.
  if (antCalveWave > 0) {
    antCalveWave -= dt;
    const dx = antBoatX - antCalveWaveX, dz = antBoatZ - antCalveWaveZ;
    const far = Math.sqrt(dx * dx + dz * dz);
    // 12 m/s, which is about right for a shallow-water wave over thirty metres
    const front = (6.0 - antCalveWave) * 12;
    if (Math.abs(far - front) < 14 && far > 8) {
      const k = clamp(1 - far / 320, 0, 1) * clamp(1 - Math.abs(far - front) / 14, 0, 1);
      antCalveLift = Math.max(antCalveLift, k * 1.15);
      if (k > 0.35 && typeof game.shake === 'function') game.shake(0.06 * k);
    }
  }
  antCalveLift = damp(antCalveLift, 0, 1.6, dt);
}

/**
 * THE WIND, AND IT IS THE ONE SOUND THE PLACE IS ACTUALLY MADE OF.
 *
 * systems.js gives chapter 17 the emptiest ambience in the game, which is
 * right — "sea ice grinding against itself, a colony a long way upwind, and a
 * very long gap" — and there is one thing missing from that list that anybody
 * who has been within a thousand miles of the continent would name first. The
 * katabatic comes off the ice cap all day, every day, and it never stops. It
 * is the reason the flag line exists, the reason the sastrugi point the way
 * they do, the reason the drift piles where it does and the reason the huts
 * are on stilts — four things this chapter already draws and none of which
 * were audible.
 *
 * POSITIONAL, which is the rule this file already keeps for the pack and the
 * pod. It is loudest high up and out on the glacier (which is where it comes
 * from and where there is nothing to slow it down), it drops in the lee of the
 * station dome, and it is almost gone down at the water. Two voices on one
 * clock: a low bed and, when it is really blowing, the thin note it makes over
 * an edge.
 */
function antUpdateWind(game, dt) {
  const capy = game.capy;
  const px = antHelmOn ? antBoatX : (capy && capy.position ? capy.position.x : 0);
  const pz = antHelmOn ? antBoatZ : (capy && capy.position ? capy.position.z : 0);
  const py = capy && capy.position ? capy.position.y : 0;

  antWindT -= dt;
  if (antWindT > 0) return;
  // how exposed this spot is, 0..1
  const onIce = antGlacierH(px, pz) > antWATER ? 1 : 0;
  const high = clamp((py - antWATER) / 26, 0, 1);
  const open = antIsOverWater(px, pz) ? 0.42 : 0;
  const k = clamp(0.16 + onIce * 0.55 + high * 0.45 + open, 0, 1);
  antWindT = lerp(6.5, 2.2, k);
  antSfx('hiss', { volume: clamp(0.045 + k * 0.135, 0.03, 0.19), pitch: rand(0.16, 0.30) });
  // and the thin note over an edge, only where it is really moving
  if (k > 0.62 && Math.random() < 0.45) {
    antWindT *= 0.7;
    antSfx('hiss', { volume: clamp(k * 0.075, 0.02, 0.09), pitch: rand(1.5, 2.4) });
  }
  // ...and the pan you are standing on is grinding against its neighbours,
  // which is the only sound a floe makes and the only one that says the floor
  // is not attached to anything
  if (antOnFloe >= 0 && Math.random() < 0.55) {
    antSfx('rustle', { volume: rand(0.06, 0.13), pitch: rand(0.22, 0.38) });
  }
}

// ================================================================== TASKS ====
function antUpdateSea(dt) {
  antSeaT += dt;
  if (antSeaT < 0.0333 || !antSeaAttr) return;
  antSeaT = 0;
  const a = antSeaAttr.array;
  const t = antTime;
  for (let i = 0; i < a.length; i += 3) {
    a[i + 1] = antWATER + Math.sin(a[i] * 0.030 + t * 0.62) * 0.13
                        + Math.sin(a[i + 2] * 0.046 - t * 0.48) * 0.10;
  }
  antSeaAttr.needsUpdate = true;
  antPackDt = 0.0333;
  antSyncPack();
}

function antUpdateTasks(game, dt) {
  const capy = game.capy;
  if (!capy || !capy.position) return;
  const p = capy.position;
  const sp = capy.body ? Math.sqrt(capy.body.velocity.x * capy.body.velocity.x +
                                   capy.body.velocity.z * capy.body.velocity.z) : 0;

  // ---- the lead ------------------------------------------------------------
  if (!antLeadDone && antHelmOn && antBoatZ < -20) {
    if (antBoatIce < 0.13 && Math.abs(antBoatSpeed) > 7.5) {
      antLeadT += dt;
      if (antLeadT > 9) {
        antLeadDone = true;
        antTask('the-lead');
        antToast('that is the lead. stay in it.');
      }
    } else {
      antLeadT = Math.max(0, antLeadT - dt * 1.4);
    }
    if (!antToldPack && antBoatIce > 0.55 && Math.abs(antThrottle) > 0.7) {
      antToldPack = true;
      antToast('full ahead into brash is four knots and a lot of noise.');
    }
  }

  // ---- THE GATE ------------------------------------------------------------
  //
  // "You cannot get north without going between them, which is the same trick
  // the Harbour Bridge plays in chapter 3" — and going through it was silent,
  // unremarked and identical to any other hundred and sixty metres of water.
  // It is the one place on the passage where the world closes in, it is where
  // the tide runs hardest (`antDriftAt` peaks here by a factor of three), and
  // it is the only spot in eleven hundred metres with a hard surface on BOTH
  // sides of the boat. So: it answers. A horn between two sixty-metre
  // headlands comes back twice, once off each of them, and the delay is the
  // width of the gap — which is exactly the instrument chapter 16 makes its
  // whole verb out of, arriving here for one beat and never explained.
  //
  // No task and no tick: the chapter has thirteen already, and a moment does
  // not need a line on a card to be a moment.
  if (antHelmOn && !antGateDone && Math.abs(antBoatZ - antGATE_Z) < 26 &&
      Math.abs(antBoatX) < 130) {
    antGateDone = true;
    antToast('the narrows. it is running three knots through here.');
    if (game.music && typeof game.music.swell === 'function') game.music.swell(0.75);
  }
  // and the two returns off the walls, whenever she sounds off in the gap
  for (let i = 0; i < 2; i++) {
    if (antGateEcho[i] < 0) continue;
    antGateEcho[i] -= dt;
    if (antGateEcho[i] > 0) continue;
    antGateEcho[i] = -1;
    antSfx('horn', { volume: 0.16 - i * 0.05, pitch: 0.94 - i * 0.04 });
  }

  // ---- the arch ------------------------------------------------------------
  if (!antArchDone) {
    const B = antBERG;
    const inside = Math.abs(antBoatX - B.x) < B.archW / 2 && Math.abs(antBoatZ - B.z) < B.hz;
    const side = antBoatZ > B.z ? 1 : -1;
    if (inside) {
      if (antArchSide === 0) antArchSide = side;
    } else if (antArchSide !== 0) {
      if (side !== antArchSide) {
        antArchDone = true;
        antTask('berg-arch');
        antToast('nine metres of headroom. it was plenty.');
      }
      antArchSide = 0;
    }
  }

  // ---- the penguin highway -------------------------------------------------
  const hd = antHighwayD(p.x, p.z);
  const onTrack = hd >= 0 && hd < antHIGH_W * 1.9 && p.y > antWATER;
  if (onTrack) {
    antHighOff = 0;
    if (p.z > 84 && antHighT < 0) { antHighT = 0; antHighFrom = true; }
    else if (antHighT >= 0) antHighT += dt;
    if (!antToldSlip && capy.slip > 0.5 && sp > 5) {
      antToldSlip = true;
      antToast('they polished this. four thousand of them, twice a day.');
    }
  } else if (antHighT >= 0) {
    antHighT += dt;
    antHighOff += dt;
    if (antHighOff > 2.5) { antHighT = -1; antHighFrom = false; }
  }
  // the clock, on the paper, while you are on their road (v32)
  if (antHighT >= 0) antLive('penguin-highway', antHighT);
  if (antHighFrom && antHighT >= 0 && p.z < 50 && p.x > -14 && p.x < 32) {
    antRecord('penguin-highway', antHighT);
    antTask('penguin-highway');
    antToast('that is how they do it. every day. both ways.');
    antHighT = -1; antHighFrom = false;
  }

  // ---- the blue ice --------------------------------------------------------
  const onGlacier = antGlacierH(p.x, p.z) > antWATER && p.y > antWATER;
  if (onGlacier && capy.slip > 0.7) {
    if (antBlueT < 0) { antBlueT = 0; antBlueTop = 0; }
    antBlueT += dt;
    if (sp > antBlueTop) antBlueTop = sp;
    // the run's own top speed, on the paper, while the hill has you (v32)
    antLive('blue-ice', antBlueTop);
  } else if (antBlueT >= 0) {
    // off the blue: hold the run open across the runout rather than
    // throwing it away on the frame the friction changes
    antBlueHold = 6.0;
    antBlueT = -1;
  }
  if (antBlueHold > 0) {
    antBlueHold -= dt;
    if (antBlueTop > 8.5 && (capy.swimming || antIsOverWater(p.x, p.z))) {
      antBlueHold = 0;
      antRecord('blue-ice', antBlueTop);
      antTask('blue-ice');
      antToast('nothing on that hill has any grip. including you.');
    }
  }

  // ---- the mug -------------------------------------------------------------
  // Put out once, on the counter, as soon as physics is up. Taking it is a
  // normal grab — the task is ticked from the 'capy:grab' handler below.
  if (antMugWanted && !antMugProp && game.physics && typeof game.physics.spawnProp === 'function') {
    antMugWanted = false;
    antMugProp = game.physics.spawnProp('mug', antMugSpot.x, antMugSpot.z, antMugSpot.y);
  }

  // ---- the bones -----------------------------------------------------------
  // ...AND THE SPEED GATE IS MEASURED AGAINST A VELOCITY THAT INCLUDES THE
  // SOLVER'S OWN SHOVE. MEASURED at the exact centre of the skeleton — the
  // point `api.bones` sends the hint arrow to — the animal stood perfectly
  // still for eight and a half seconds with every condition on this line
  // reading true from outside, and the task never ticked: cannon is ejecting
  // it from the spine collider on every step, this function runs on the far
  // side of that step, and capybara.js damps the ejection away before anything
  // else can see it. So `sp` here spikes over 0.6 every frame, `antBoneSitT`
  // is reset to zero every frame, and 'Sit down inside the whale' is
  // uncompletable in the one place the card points at. Two fixes and they are
  // both needed: the landmark moved off the backbone and into the rib cage
  // (which is where you would sit anyway), and a tolerance that survives being
  // nudged. 1.2 m/s is still a great deal slower than a walk.
  if (antInZone('bones', p.x, p.z) && p.y > antWATER && sp < 1.2) {
    antBoneSitT += dt;
    if (antBoneSitT > 2.4 && antBoneSitT < 900) {
      antBoneSitT = 1000;
      antTask('whale-bones');
      antToast('a hundred and ten of them, in one season, out of this bay.');
    }
  } else if (antBoneSitT < 900) {
    antBoneSitT = 0;
  }
}

// ================================================================ LIFECYCLE ==
/**
 * THE WHEEK, AND FOR ITS WHOLE LIFE IT DID NOTHING UNLESS YOU WERE DRIVING.
 *
 * `if (antHelmOn) antPodSummon()` — one line, and off the tiller the loudest
 * animal at sixty-five south was completely inaudible to four thousand
 * penguins, a skua, twenty-six petrels and a leopard seal. The colony local
 * has a wheek line reading "now they are all looking at you, thank you for
 * that" which was a promise nothing in the chapter kept: the birds did not
 * turn, did not call and did not move.
 *
 * Same shape as the Cappadocia pass, which found a valley that would not
 * answer: the reply has to come from the thing that is THERE. A gentoo colony
 * answers everything with a colony, which is the loudest sound in Antarctica
 * and is genuinely how they respond to a strange noise — one bird starts and
 * four thousand join in, and it rolls across the hill.
 */
function antWheek(game) {
  if (!game.biome.isActive('antarctic')) return;
  if (antHelmOn) { antPodSummon(); return; }
  const capy = game.capy;
  if (!capy || !capy.position) return;
  const p = capy.position;

  // ---- THE COLONY ANSWERS -------------------------------------------------
  const dcx = p.x - antCOLONY.x, dcz = p.z - antCOLONY.z;
  const dCol = Math.sqrt(dcx * dcx + dcz * dcz);
  if (dCol < 62) {
    // the roll: it starts near you and it goes UP the hill, which is the whole
    // sound. Three calls on the frame clock, spreading outward.
    antColonyCall = 1;
    antCallT[0] = 0.10; antCallT[1] = 0.55; antCallT[2] = 1.25;
    // ...and the FRONT starts where you are standing, not at the middle of the
    // colony: shout from the beach and it goes up the hill away from you,
    // shout from the top and it runs down past you to the sea. See antCALL_SPD.
    antCallX = p.x; antCallZ = p.z; antCallR = 0;
    if (!antToldColony && dCol < 30) {
      antToldColony = true;
      antToast('four thousand of them. all at once. every time.');
    }
    antTask('colony-chorus');
  }
  // ---- the skua breaks off ------------------------------------------------
  if (antSkua && Math.abs(p.x - antSkua.position.x) < 40 && Math.abs(p.z - antSkua.position.z) < 40) {
    antSkuaFlush = 1;
  }
  // ---- the petrels scatter ------------------------------------------------
  if (Math.abs(p.x - antCALVE.x) < 90 && Math.abs(p.z - antCALVE.z) < 110) antPetrelScat = 1;
  // ---- and the seal lifts its head, which is worse ------------------------
  if (antFloeX) {
    const dsx = p.x - antFloeX[antSealFloe], dsz = p.z - antFloeZ[antSealFloe];
    if (dsx * dsx + dsz * dsz < 44 * 44) antSealLook = 1;
  }
  // ---- and the cliff behind the station gives it back ----------------------
  // The station sits under a nineteen-metre dome and the whalers' beach under
  // an eight-metre one. Sound in the cleanest, coldest air on earth carries
  // absurdly, and there is nothing else down here to hear.
  antEchoT = 0.42;
}

export function createAntarctic(game) {
  antGame = game;

  const onWheek = function () { antWheek(game); };
  game.events.on('capy:wheek', onWheek);

  // Robbing the bar is a grab now, not a proximity check, so it is ticked where
  // every other theft in the game is ticked: the moment the thing is in the mouth.
  game.events.on('capy:grab', function (e) {
    if (antMugGone || !antMugProp) return;
    if (!e || e.prop !== antMugProp) return;
    antMugGone = true;
    antTask('station-mug');
    antSfx('pop', { volume: 0.6 });
    antToast('the southernmost bar on earth is now one mug down.');
  });

  game.biome.register('antarctic', {
    ensureBuilt() { antBuild(game); },
    onEnter() {
      // A fresh arrival is a fresh departure: the tender is alongside, stopped,
      // and nobody is on the tiller. Everything STAGED replays; the checklist
      // itself is systems.js's business and stays ticked. (Chapter 3 shipped
      // without this and a second visit to the Quay was scenery.)
      antTime = 0;
      antBoatX = antBERTH.x; antBoatZ = antBERTH.z; antBoatYaw = antBERTH.yaw;
      antBoatSpeed = 0; antThrottle = 0; antRudder = 0; antBoatIce = 0;
      antHelmOn = false; antHelmCool = 0.6; antDetent = 0;
      game.state.sailing = false;
      if (game.capy) game.capy.atHelm = false;
      if (antBoatBody) {
        antBoatBody.position.set(antBoatX, antWATER + antTEN_DECK, antBoatZ);
        antBoatBody.quaternion.setFromEuler(0, antBoatYaw, 0);
        antBoatBody.velocity.setZero();
        antSyncBody(antBoatBody);
      }
      antPodState = 'patrol'; antPodU = 0; antPodStateT = 0;
      antPodRide = 0; antSpyT = -1; antSpyTold = false; antSlowT = 0;
      antPodCX = 8; antPodCZ = -168;
      antOnFloe = -1; antFloeRide = 0;
      // the seal is back on her pan, watching nothing. See antSEAL_NOTICE.
      antSealState = 'hauled'; antSealT = 0; antSealSurf = 0; antSealTold = false; antSealBr = 0;
      antSealLook = 0;
      if (antFloeX) { antSealX = antFloeX[antSealFloe]; antSealZ = antFloeZ[antSealFloe]; }
      antSealY = antWATER + antFLOE_TOP + 0.32;
      // ...AND THE CHAIN OF PANS IS RE-LAID. They are a line of stepping
      // stones from the bay to the gate — that is what makes riding one
      // something a player finds by accident — and after ten minutes of
      // drifting they are a heap in the eddy behind the berg. A fresh arrival
      // is a fresh departure: the tender is alongside, the show has not
      // happened yet, and the ice is where the ice starts.
      if (antFloeBodies) {
        for (let i = 0; i < antFLOE_N; i++) {
          const t = i / (antFLOE_N - 1);
          const z = lerp(-14, -458, t) + rand(-15, 15);
          const x = antLeadX(z) + rand(-50, 50);
          antFloeX[i] = x; antFloeZ[i] = z;
          antFloeTX[i] = x; antFloeTZ[i] = z;
          const b = antFloeBodies[i];
          b.position.set(x, antWATER + antFLOE_TOP - 0.35, z);
          b.velocity.setZero();
          antSyncBody(b);
        }
        antSyncFloeMatrices();
      }
      antLeadT = 0; antHighT = -1; antHighFrom = false; antHighOff = 0; antBlueT = -1;
      antArchSide = 0; antBoneSitT = 0; antBlueHold = 0;
      antCalveT = 16; antCalveLive = 0; antCrackT = -1;
      antCalveWave = 0; antCalveLift = 0;
      antColonyCall = 0; antSkuaFlush = 0; antPetrelScat = 0; antEchoT = -1;
      // Tier 5: a fresh visit is a fresh lap. The two counters are NOT reset —
      // how many chicks this player has saved is the kind of thing a place
      // should remember about them, and it is the only number in the chapter
      // that is about somebody else.
      antSkuaLap = -1; antSkuaGot = false; antSkuaHeavy = 0; antSkuaT = 0;
      // D4.12: and the run does not survive travel either
      antPodToldGap = false; antPodGap = 0; antPodRunPX = 0; antPodRunPZ = 0;
      antCallR = -1;
      antCallR = -1;
      antCallT[0] = -1; antCallT[1] = -1; antCallT[2] = -1;
      // ONCE PER VISIT, not once per session. The tick on the list stays
      // ticked (that is systems.js's business); the SHOW replays, for the same
      // reason the tender is alongside and stopped again — a second visit that
      // is scenery is the bug chapter 3 shipped with.
      antBreachT = -1; antBreachDone = false; antRideDone = false; antBreachQueue.length = 0;
      antSprayT = 0;
      if (antSprayData) for (let i = 0; i < antSPRAY_N; i++) antSprayData[i * 7 + 6] = 1e9;
      if (antCalveBits) antCalveBits.visible = false;
      antToldPack = false; antToldSlip = false;
      antGateDone = false; antGateEcho[0] = -1; antGateEcho[1] = -1;
      antPengEsc = 0; antWindT = 0; antCapeScat = 0; antScrapeT = 0;
    },
    onExit() {
      // anything stateful that could hold the player, cleared on the way out
      antHelmOn = false;
      game.state.sailing = false;
      if (game.capy) game.capy.atHelm = false;
      antOnFloe = -1;
      antSpyT = -1;
      if (antBoatBody) antBoatBody.velocity.setZero();
      if (antFloeBodies) for (let i = 0; i < antFloeBodies.length; i++) antFloeBodies[i].velocity.setZero();
    },
  });

  const api = {
    /**
     * TIER 5, measured. `took` and `saved` are the two outcomes of a strike;
     * `callR` is the colony's wave-front radius, which is the whole of the
     * reaction the file used to claim and not have.
     */
    skuaDebug() {
      let displaying = 0;
      if (antPengData) {
        for (let i = 0; i < antPENG_COL; i++) {
          if (antPengData[i * antPENG_S + 4] > 0.05) displaying++;
        }
      }
      return { nest: antSkuaNest, lap: antSkuaLap, got: antSkuaGot,
               flush: Math.round(antSkuaFlush * 100) / 100,
               heavy: Math.round(antSkuaHeavy * 100) / 100,
               took: antSkuaTook, saved: antSkuaSaved,
               callR: Math.round(antCallR * 10) / 10,
               callX: Math.round(antCallX * 10) / 10,
               callZ: Math.round(antCallZ * 10) / 10,
               displaying: displaying, nests: antNests.length / 2,
               y: antSkua ? Math.round(antSkua.position.y * 100) / 100 : null,
               x: antSkua ? Math.round(antSkua.position.x * 10) / 10 : null,
               z: antSkua ? Math.round(antSkua.position.z * 10) / 10 : null,
               phase: Math.round(((antSkuaT % 26) / 26) * 1000) / 1000 };
    },
    /** D4.12, measured. `gap` is metres to the pod; `hold` is antPOD_HOLD. */
    /** Put them on the boat now, so the run needs no summon and no helm. */
    podForce() {
      antPodCX = antBoatX; antPodCZ = antBoatZ;
      antPodState = 'escort'; antPodStateT = 0; antPodRide = 0; antSlowT = 0;
      return antPodState;
    },
    /** The harness (ROADMAP-WOW Part C): breach animal i now, through the same queue antPodAnswers uses. */
    podBreach(i) { antBreachQueue.length = 0; antBreachQueue.push(Math.max(0, Math.min(antPOD_N - 1, i | 0))); antBreachWait = 0.05; return true; },
    /** The harness (L6, F2): put the tender at (x, z) now — the calving window is 140 m from the berth. */
    boatForce(x, z) { antBoatX = x; antBoatZ = z; antBoatSpeed = 0; return [antBoatX, antBoatZ]; },
    podDebug() {
      return { st: antPodState, stateT: Math.round(antPodStateT * 10) / 10,
               gap: Math.round(Math.hypot(antBoatX - antPodCX, antBoatZ - antPodCZ) * 10) / 10,
               hold: antPOD_HOLD, ride: Math.round(antPodRide * 100) / 100,
               best: Math.round(antPodBest * 100) / 100,
               wake: Math.round(api.withPod() * 1000) / 1000,
               podZ: Math.round(antPodCZ * 10) / 10,
               podX: Math.round(antPodCX * 10) / 10,
               leadX: Math.round(antLeadX(antPodCZ) * 10) / 10,
               boatZ: Math.round(antBoatZ * 10) / 10,
               boatSp: Math.round(antBoatSpeed * 100) / 100,
               slowT: Math.round(antSlowT * 10) / 10, helm: antHelmOn };
    },
    /** Wind the skua's clock to just before a strike, so a probe need not wait. */
    skuaTo(u) {
      // NEXT lap, not this one. Winding within the current lap leaves
      // antSkuaGot true, so a second measured strike silently never fires and
      // the probe reports the FIRST strike's outcome twice. Cost one run.
      const lap = Math.floor(antSkuaT / 26) + 1;
      antSkuaT = lap * 26 + clamp(u, 0, 0.999) * 26;
      return antSkuaT;
    },
    /** Put it off, the way a wheek inside forty metres does. */
    skuaFlush() { antSkuaFlush = 1; return antSkuaFlush; },
    built() { return antBuilt; },
    terrainHeight: antTerrain,
    slopeAt: antSlope,
    waterLevel: antWATER,
    isOverWater: antIsOverWater,
    waterHeightAt: antWaterHeightAt,
    groundSlip: antGroundSlip,
    surfacePitch: antSurfacePitch,
    surfaceMat: function () { return antSurfMat; },
    inZone: antInZone,
    navBlocked: antNavBlocked,
    SPAWN: antSPAWN,
    /** A hop on ice wants steering — you are going to need it on the way down. */
    airControl: 0.44,

    // ---- what the rest of the game asks about this chapter ----------------
    /** 0..1 — how much pack ice is on the water at (x, z). The chapter's map. */
    packAt: antIceAt,
    /** 0..1 — how much of it the boat is in right now. systems.js scores on it. */
    pack() { return antBoatIce; },
    /** Have the orcas ever formed up on you? The exit opens on this. */
    seenPod() { return antSeenPod; },
    /** 0..1 — are they on you NOW. The score and the ambience both read it. */
    withPod() { return antPodTight() ? antPodWakeK() : 0; },
    atHelm() { return antHelmOn; },

    boat: {
      position: new THREE.Vector3(antBERTH.x, antWATER + antTEN_DECK, antBERTH.z),
      helm: new THREE.Vector3(),
      get speed() { return antBoatSpeed; },
      get heading() { return antBoatYaw; },
      get atHelm() { return antHelmOn; },
      get maxSpeed() { return antTEN_VMAX; },
    },

    // landmarks, for the minimap and the hint arrow
    jetty: { x: antJETTY.x, z: antJETTY.z1 + 1 },
    huts: { x: antHUTS.x, z: antHUTS.z },
    colony: { x: antCOLONY.x, z: antCOLONY.z },
    highTop: { x: antHIGH[0], z: antHIGH[1] },
    whalers: { x: antWHAL.x, z: antWHAL.z },
    // OFF THE BACKBONE. See the note by the 'bones' task in antUpdateTasks:
    // the middle of the skeleton is inside the spine collider, and the arrow
    // was sending the player to stand in it.
    bones: { x: antBONES.x + 2.8, z: antBONES.z + 1.4 },
    berg: { x: antBERG.x, z: antBERG.z },
    gate: { x: 0, z: antGATE_Z },
    blueIce: { x: antBLUE.xIn - 44, z: (antBLUE.z0 + antBLUE.z1) / 2 },
    /** THE WINDOW (L6, F2): the serac face the blocks come off, and seconds until the next one. */
    calveFace: { x: antGLAC.xToe + 6, z: antCALVE.z },
    calveIn() { return Math.max(0, antCalveT); },
    glacierToe: { x: antGLAC.xToe - 6, z: (antBLUE.z0 + antBLUE.z1) / 2 },
    /** These MOVE — ask, never cache. */
    mug() {
      if (!antMugProp || antMugGone) return api.huts;
      const b = antMugProp.body.position;
      antV3b.set(b.x, b.y, b.z);
      return antV3b;
    },
    pod() { antV3b.set(antPodCX, antWATER, antPodCZ); return antV3b; },
    /**
     * SHE MOVES NOW, AND SHE DOES NOT ONLY MOVE WITH HER PAN.
     *
     * This used to answer the FLOE's position, which was correct for as long
     * as a leopard seal was a mesh lying on one — and the hint arrow for
     * 'Be looked at by a leopard seal' would have gone on pointing at a bare
     * piece of ice for the whole of the encounter. See antSEAL_NOTICE.
     */
    seal() { antV3b.set(antSealX, antWATER, antSealZ); return antV3b; },
    nearestFloe() {
      const capy = antGame && antGame.capy;
      const px = capy && capy.position ? capy.position.x : antBoatX;
      const pz = capy && capy.position ? capy.position.z : antBoatZ;
      let bi = 0, bd = 1e18;
      for (let i = 0; i < antFLOE_N; i++) {
        const dx = antFloeX[i] - px, dz = antFloeZ[i] - pz;
        const d = dx * dx + dz * dz;
        if (d < bd) { bd = d; bi = i; }
      }
      antV3b.set(antFloeX[bi], antWATER, antFloeZ[bi]);
      return antV3b;
    },

    update(dt) {
      if (!antBuilt) return;
      if (!game.biome.isActive('antarctic')) return;
      antTime += dt;
      antUpdateSea(dt);
      antStepBoat(game, dt);
      antUpdateWake(dt);
      antUpdateFloes(game, dt);
      antUpdatePod(game, dt);
      antUpdatePenguins(game, dt);
      antUpdateBirds(game, dt);
      antUpdateSeal(game, dt);
      antUpdateCalving(game, dt);
      antUpdateDrift(dt);
      antUpdateSpray(game, dt);
      antUpdateWind(game, dt);
      antUpdateTasks(game, dt);
      api.boat.position.set(antBoatX, antWATER + antTEN_DECK, antBoatZ);
      antHelmWorld(api.boat.helm);
    },
  };
  game.antarctic = api;
  return api;
}
