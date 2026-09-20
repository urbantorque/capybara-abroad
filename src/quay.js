import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PALETTE, mat, rand, randInt, clamp, damp, lerp, grain, makeSolidIndex, swayMesh, makeMerger, hangThing } from './shared.js';
import { farLayer, farBundle, farTone } from './far.js';

// ===========================================================================
// CHAPTER 3 — SYDNEY HARBOUR: CIRCULAR QUAY TO MANLY
//
// The third biome, and the only one that is mostly WATER. Sydney (chapter 1)
// keeps the Botanic Gardens and the Opera House forecourt; this is the harbour
// itself — the ferry aprons at Circular Quay, the Bridge overhead, the islands,
// the two Heads, and seven hundred metres of open green water with Manly at the
// far end of it.
//
// The chapter's verb is not "walk". It is "steer". The capybara boards a small
// wooden ferry, stands at the wheel, and DRIVES: throttle on the forward stick,
// rudder on the sideways one, a turn rate that only exists while she has way on,
// and a hull that carries her momentum through the turn. The voyage is sized to
// take between sixty and ninety seconds at a sensible throttle, which is long
// enough to be a journey and short enough that nobody has to be told it is one.
//
// Everything in this file is prefixed `quay` (contract: the bundler flattens
// every module into one scope).
// ===========================================================================

// --------------------------------------------------------------- geography --
// One coordinate system, authored so that "north" (-z) is out to sea and Manly
// sits at the top of it. The numbers are the real harbour compressed about
// eight to one: far enough to be a voyage, close enough to hold in one fog.
const quayWATER_Y   = -0.5;          // the still waterline
const quayAPRON_Z   = 16;            // seaward edge of the Circular Quay apron
const quayAPRON_Z1  = 44;            // landward edge (the colonnade is behind it)
const quayAPRON_HX  = 48;            // half-width of the apron
const quayWHARF_X   = [-28, 0, 28];  // three finger wharves
const quayWHARF_Z0  = -4;            // seaward end of a finger
const quayWHARF_HX  = 4.0;
// The three walking surfaces of the terminal are deliberately a hand's width
// apart — apron 0.20, wharf 0.40, deck 0.49 — because a capybara steps over
// 0.2 m without noticing and a 0.6 m lip is a wall you have to be told about.
const quayWHARF_Y   = 0.33;          // deck top lands at quayWHARF_Y + 0.07

// BENNELONG POINT. The chapter is called Circular Quay and the most recognisable
// object on the planet stands two hundred metres east of the apron, and it was
// not drawn — the Freshwater's own route table calls her first waypoint "the
// Quay approach, off the Opera House" and there was no Opera House to be off.
// The point is a low sandstone podium with the shells on it; it is the first
// thing in frame when the boat's head comes round to the north, and it is what
// the whole east side of the picture was missing.
const quayBEN = { x: 78, z: 6, hx: 21, hz: 26, y: 3.1 };
const quayBEN_STEPS = 9;
// Nine risers from the podium to the apron. Derived, not typed: a hardcoded
// 0.29 left the bottom tread one centimetre BELOW the paving, which cannon
// turned into a Box with a negative half-extent and six console errors about
// face normals pointing into the shape.
const quayBEN_RISE = ((quayWATER_Y + quayBEN.y) - 0.20) / 9;
const quayBEN_TREAD = 0.85;
const quayBEN_STEP_Z0 = quayBEN.z + quayBEN.hz - 6.6;
const quayBEN_STEP_Z1 = quayBEN_STEP_Z0 + (quayBEN_STEPS - 1) * quayBEN_TREAD;
const quayBenStep = [];                    // {y, z} per tread, for terrainHeight

// The city. Not walkable — the colonnade is the back wall of the playable world
// and always was — but the colonnade is 8.7 m high and behind it there was SKY.
// Circular Quay is a hole in the bottom of a city; the towers are the reason the
// terminal is where it is. Drawn as silhouette with window bands, solid at the
// street frontage so nobody can get in among them.
const quayCITY_Z0 = 62;              // the street frontage behind the colonnade
// The last z a capybara may stand on, and it BUTTS the city's frontage wall
// (whose collider runs 61 to 65): a land test that stopped short of the wall
// left a strip of "water" at the foot of it with no ground under it.
const quayLAND_Z1 = 61;
const quayLAND_HX = 74;              // ...and the last x

// Alongside the middle finger, HEAD OUT.
//
// She used to lie with her bow at the apron, three and a half metres off a
// stone wall, and the first thing anybody does with a wheel is open the
// throttle: measured, that put fifty seconds of full ahead into an invisible
// clamp at z = 12 with no bump, no sound and no line, sliding a hundred and
// thirty metres sideways along a wall that is not drawn. The astern fix
// further down this file is real and it stays — you still need it to get
// alongside at Manly, and the deckhand still shouts about it — but a chapter
// whose verb is "steer" should not open with a manoeuvre nobody is told about.
const quayBERTH     = { x: 6.6, z: 6.0, yaw: Math.PI };
const quayBOAT_DECK = 0.55;                          // body origin above the waterline datum
const quayHELM      = { x: 0, z: 3.1 };              // helm station in boat-local metres

// The Bridge is the gate: it stands ACROSS the fairway a little north of the
// wharves, so leaving the Quay means going under it whether you meant to or not.
// A landmark you have to detour to look at is scenery; one you pass through is
// a beginning.
const quayBRIDGE = { x: 12, z: -58, span: 132, deck: 25, arch: 39, yaw: 0.07 };

// How far the deck runs each side of the arch, and where it comes ashore.
//
// THE BRIDGE USED TO END IN MID-AIR AT BOTH ENDS. The deck stopped 25 m
// outboard of each pylon and hung there over open water with nothing under it
// and nothing at the end of it — and there was nothing it COULD reach, because
// the bridge axis is water from x -267 to x +378, which is the whole width of
// the world. So the landfall is built: a bluff at each end for the road to
// arrive at, an abutment of sandstone where the deck meets it, and a viaduct
// on stone piers over the water in between. quayABUT is read by
// quayBuildLand (headlands are only solid if they go through quayHeadland)
// and quayDECK_HALF by both quayBuildBridge and the traffic that runs on it.
const quayDECK_HALF = 190;
const quayABUT = { u: 190, r: 42, h: 25 };

// Landmarks, in the order you meet them.
const quayFORT   = { x: 6, z: -126, r: 13 };         // Fort Denison, fine on the port bow
const quayBRAD   = { x: -76, z: -196, r: 40 };       // Bradleys Head
const quaySHARK  = { x: -46, z: -268, r: 17 };       // Shark Island
const quayMIDDLE = { x: -122, z: -404, r: 62 };      // Middle Head
const quayNORTH  = { x: 236, z: -498, r: 78 };       // North Head
const quayMANLY  = { x: 118, z: -556 };              // Manly wharf head

// Fairway buoys: x, z, colour index (0 red / 1 green / 2 yellow). Also where
// the gulls sit, and what the arrow on the paper points at.
// Laid in PAIRS, port and starboard of the rhumb line from the berth to Manly,
// so the fairway reads as a channel rather than as a row of decorations. Red to
// port, green to starboard, yellow on the last one, which is the turn.
const quayBUOYS = [
   2, -40, 0,   36, -40, 1,
  16, -150, 0,  62, -150, 1,
  46, -300, 0,  92, -300, 1,
  76, -440, 0, 122, -440, 1,
  100, -516, 2,
];

// The regatta. Each yacht runs a slow reach across the fairway on its own leg,
// so the fleet is genuinely in the way and genuinely moving.
// Legs chosen so the fleet crosses the fairway rather than decorating the edge
// of it: two of them are close-coupled on purpose, because 'Cut through the
// yacht race' has to be a thing that HAPPENS to you if you hold your course.
const quayFLEET = [
  //  x0    z0     x1    z1    period  hull
   -6, -212, 108, -244, 46, 0,
  118, -258,   4, -230, 53, 1,
   10, -320, 124, -346, 49, 2,
  132, -334,  18, -308, 51, 0,
   22, -424, 142, -456, 55, 1,
  148, -446,  28, -416, 44, 2,
];

const quayDOLPHIN_N = 5;

// ---------------------------------------------------------------- headlands --
/**
 * EVERY CLIFF ON THIS HARBOUR, IN ONE TABLE — because until this table existed
 * not one of them was solid.
 *
 * `quayHeadland` draws a sandstone bluff as a ring of radial prisms and nothing
 * else was ever done with the numbers: `quayIsOverWater` answered TRUE over all
 * thirteen of them, `quayGroundY` answered zero, and no collider was ever built.
 * Measured before this: at Bradleys Head — 40 m across and 21 m high, the first
 * landmark you pass — `isOverWater(-76,-196)` was true, `terrainHeight` was 0 and
 * there were zero static bodies within twelve metres. So a capybara that swam
 * out to it treaded water twenty metres inside a cliff, and the ferry drove
 * straight through the middle of it at ten knots. It is the same omission the
 * second pass found at Fort Denison, thirteen more times.
 *
 * `cf` is the COLLISION FRACTION of the drawn radius. The drawn footprint is an
 * 11-gon whose radii wander between 0.68 r and 1.18 r, so the solid part is
 * deliberately inside the silhouette — you should be able to get your nose into
 * a cove without the cliff arriving early. The two ridges behind the Corso carry
 * a smaller one still, because the last row of shops is built up against them.
 */
const quayHEADS = [];      // {x, z, r, h, cf} — filled by quayBuildLand
// The crown of a headland, as [radius fraction of the octagon, height multiple
// of h]. Read by BOTH the collider and quayGroundY, which is the only way the
// thing you stand on and the thing the game thinks you stand on stay the same
// shape. Matched to the drawn cap (h*1.07 average) and peak (h*1.20).
const quayHEAD_TIER = [[0.62, 1.07], [0.26, 1.16]];
const quayHARD = [];       // what the HULL may not pass through: {x, z, r}
const quayPYLON = [];      // the two bridge pylons: {x, z, hx, hz, ry}

// ------------------------------------------------------------- boat physics --
// A displacement hull, not a car. Three ideas do all the work:
//   1. Thrust is a target SPEED the engine chases, so the throttle has weight.
//   2. Turn rate is proportional to speed. Stopped, the rudder does nothing —
//      which is the entire reason berthing feels like berthing.
//   3. The hull keeps a little of its old heading through a turn (leeway), so
//      she carves rather than pivoting on the spot.
// Sized against the passage, not against a feeling: the rhumb line from the
// berth to Manly is 566 m, and 10.4 m/s makes that 64 seconds flat out on a
// dead straight course with no sightseeing. Real steering, the Bridge, the
// fleet and the last turn alongside put an ordinary passage at 70-90 s, which
// is the window this chapter was written for.
const quayBOAT_VMAX   = 10.4;        // m/s flat out (~20 knots)
const quayBOAT_VREV   = -3.2;
const quayBOAT_ACC    = 3.4;         // m/s^2 the engine can add
const quayBOAT_DRAG   = 0.55;        // 1/s of coast-down with the throttle shut
const quayBOAT_TURN   = 0.52;        // rad/s at full rudder AND full speed (~22 m radius)
const quayBOAT_RUDDER = 2.4;         // 1/s the rudder itself swings over
const quayBOAT_HX     = 2.35;        // half beam
const quayBOAT_HZ     = 6.40;        // half length
const quayHELM_R      = 2.6;         // how close you must stand to take the wheel
const quayGANG_HZ     = 3.2;         // half-length of the gangway gap in the bulwark
const quayGANG_OUT    = 0.55;        // how far the boarding platform stands proud

// ------------------------------------------------------------------ scratch --
const quayV3 = new THREE.Vector3();
const quayQ = new THREE.Quaternion();
const quayEu = new THREE.Euler();
const quaySc = new THREE.Vector3();
const quayM = new THREE.Matrix4();
const quayCol = new THREE.Color();

// ---------------------------------------------------------------- module ----
let quayGame = null;
let quayLocBusker = null, quayTuneMv = null;
let quayBuilt = false;
let quayRoot = null;
let quayFar = null;     // the Kirribilli roofs on the north abutment (far.js)
let quayTime = 0;

let quayWaterMesh = null, quayWaterAttr = null, quayRippleT = 0;
let quayGlitter = null;
let quayWakeMesh = null;
const quayWakeN = 26;
const quayWakeX = new Float32Array(quayWakeN);
const quayWakeZ = new Float32Array(quayWakeN);
const quayWakeL = new Float32Array(quayWakeN);
const quayWakeS = new Float32Array(quayWakeN);
const quayWakeYw = new Float32Array(quayWakeN);   // her heading when it was dropped
let quayWakeHead = 0, quayWakeT = 0;

let quayBoatGroup = null, quayBoatBody = null, quayWheelMesh = null, quayFlagMesh = null;
let quayPennant = null;             // the masthead sock: streams with the speed, leans with the helm
let quayBoatYaw = 0, quayBoatSpeed = 0, quayRudder = 0, quayThrottle = 0;
let quayBoatX = quayBERTH.x, quayBoatZ = quayBERTH.z;
let quayHelmOn = false, quayHelmCool = 0;

let quayFleetMesh = null, quayFleetSail = null;
let quayBuoyMesh = null;
let quayGullMesh = null;
const quayGullN = 22;
const quayGullData = new Float32Array(quayGullN * 6);   // x,y,z,ang,r,spd
const quayGullPerch = new Float32Array(quayGullN);      // s left sat on a buoy
const quayGullBuoy = new Int16Array(quayGullN);         // which buoy that is

let quayDolphins = null;
const quayDolphinData = new Float32Array(quayDolphin_len());
function quayDolphin_len() { return 5 * 4; }            // t, lead, side, phase
let quayDolphinT = 0, quayDolphinOn = 0;

let quayVoyaged = false, quayCastOff = false, quayBridged = false, quayWalled = false;
let quayRunT = -1;                  // s since she came off the wall; -1 = not away
// THE SECOND ASK (L6, F2): the cap the passage hands over, worn back at the
// wheel under way. Seconds at the helm above four metres a second, in it.
let quayCapHelmT = 0, quayCapHelmDone = false;

// --- the new furniture of the chapter, all of it declared in one place -------
let quayCatMesh = null, quayCatData = null;          // wind on the water
let quayCrowd = null, quayCrowdData = null;          // the people on the apron
let quayCarMesh = null, quayCarData = null;          // traffic over the Bridge
let quayPaxMesh = null, quayPaxHead = null, quayPaxData = null;   // her passengers
let quaySprayMesh = null, quaySprayData = null;      // bow spray + horn steam
let quayMoorMesh = null, quayMoorData = null;        // the swing moorings
let quayBridgeGull = null;                           // the flock under the arch
let quayLineMesh = null;                             // the heaving line at Manly
let quayBigWave = 0;                                 // s of waving left on her deck
let quayHornSteam = 0;                               // s of steam left at our funnel
let quayBridgeFlush = 0;                             // s since the gulls went up
let quayLineT = -1;                                  // s into the line being thrown
let quayOperaSeen = false;
let quayOperaLamp = null;

let quayRaceT = 0, quayRaceMask = 0, quayEscortT = 0, quayEscorted = false;
let quayCallMask = 0;               // which of the wharf hand's four calls have gone
let quayArrivalT = 0;
let quayHand = null;                // the deckhand, who watches you steal her
let quayLand = null;                // and the one at Manly, who takes the line
const quayCASTOFF = ['…that is not how any of this works!',
                     'Bring her back by six! SIX!',
                     'Right. Right. That is a first.',
                     'She takes a while to answer! Mind the Bridge!'];
// ---- THE APPROACH, CALLED FROM THE WHARF -------------------------------
// Seventy seconds of open water ended with one line of text and a rope. The
// last two hundred metres of a ferry passage is the part a wharf hand actually
// talks through — he can see you coming, he can see how fast you are coming,
// and he has opinions about both. Three ranges and a speed check, each fired
// once per passage, which turns the arrival from an event into an approach.
const quayCALL_FAR  = ['That is you, is it? Come on in then.',
                       'I see you! Line up on the wharf head!',
                       'Right. Nice and straight. Nice and straight.'];
const quayCALL_MID  = ['Ease her back now. She carries her way.',
                       'Take the way off. TAKE THE WAY OFF.',
                       'Lovely. Bit of port rudder and you are on it.'];
const quayCALL_NEAR = ['Alright — hold her there. Hold her.',
                       'Fenders. …we have no fenders. Never mind.',
                       'That will do! That will absolutely do!'];
const quayCALL_FAST = ['SLOW DOWN. Slow — no. No no no.',
                       'That is a WHARF, mate, not a ramp!',
                       'I am going to stand further back.'];
const quayARRIVE = ['Got it! …you are a capybara.',
                    'Nice bit of steering. Nobody is going to believe me.',
                    'Line! …thank you. Ropes on. Welcome to Manly.',
                    'Seventy-one seconds off the timetable and you cannot even reach the wheel.'];

// THE HEAVING LINE. A rope thrown from the boat to the wharf when she comes
// alongside: eleven segments on a catenary that flies across the gap over
// three quarters of a second and then goes slack between the two cleats. It is
// eleven boxes and it is the entire difference between "the passage is over"
// and "somebody has caught you".
const quayLINE_N = 11;

// ============================================================== small helpers

function quayXform(px, py, pz, rx, ry, rz, sx, sy, sz) {
  quayEu.set(rx, ry, rz, 'YXZ');
  quayQ.setFromEuler(quayEu);
  quayV3.set(px, py, pz);
  quaySc.set(sx, sy, sz);
  quayM.compose(quayV3, quayQ, quaySc);
  return quayM;
}

const quayG = { box: null, cyl6: null, cyl8: null, cyl4: null, cone6: null, cone4: null, sph6: null, sph5: null };
function quayInitGeos() {
  if (quayG.box) return;
  quayG.box = new THREE.BoxGeometry(1, 1, 1);
  quayG.cyl6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
  quayG.cyl8 = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
  quayG.cyl4 = new THREE.CylinderGeometry(0.5, 0.5, 1, 4);
  quayG.cone6 = new THREE.ConeGeometry(0.5, 1, 6);
  quayG.cone4 = new THREE.ConeGeometry(0.5, 1, 4);
  quayG.sph6 = new THREE.SphereGeometry(0.5, 6, 4);
  quayG.sph5 = new THREE.SphereGeometry(0.5, 5, 3);
}

/**
 * Vertex-colour merger. Everything static in this file goes through one of
 * these so a whole headland, or the whole quayside, is a single draw call.
 */
function quayMerger() {
  return makeMerger(quayG, {
    xform: quayXform, cylSegs: [4, 8], coneSegs: [4], sphSegs: [], normals: 'recompute', jitter: 0.055,
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
function quayVC() {
  return grain(mat(0xffffff, { vertexColors: true }),
               { scale: 0.45, amount: 0.09, warp: 0.5, near: 0.34, nearPale: 0.60, nearScale: 6, contact: 1, broad: 0.07, broadM: 14,
                 // THE WATER'S EDGE (D5). `grep -c foam` read six here, all of
                 // them the ferry's wake — the harbour itself met seven hundred
                 // metres of sandstone at a polygon join. Circular Quay has no
                 // beach in it: every metre of this shoreline is a vertical
                 // wall, a pontoon or a hull, so the lace is a LINE and not a
                 // wash — which is what a harbour has.
                 //
                 // ...AND THE SOAK IS THE HALF THAT READS HERE. The apron sits
                 // 70 cm above the water and the wall between them is the one
                 // surface in the chapter the term can reach; 45 cm of splash
                 // zone up a sandstone wall is a TIDE MARK, which is the thing
                 // you actually see at Circular Quay and which a 30 cm band
                 // measured as almost nothing (0.16 % of the frame at the east
                 // wharves, against 0.71 with this row).
                 shore: 0.38, shoreBand: 0.34, shoreWet: 0.45, shoreDark: 0.78,
                 shoreScale: 1.9, shoreColor: PALETTE.foam });
}

function quayInstance(root, geo, color, list, cast, recv) {
  const n = list.length / 9;
  if (n < 1) return null;
  const im = new THREE.InstancedMesh(geo, mat(color), n);
  for (let i = 0; i < n; i++) {
    const o = i * 9;
    im.setMatrixAt(i, quayXform(list[o], list[o + 1], list[o + 2], list[o + 3], list[o + 4],
                                list[o + 5], list[o + 6], list[o + 7], list[o + 8]));
  }
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  im.castShadow = !!cast;
  im.receiveShadow = !!recv;
  // This chapter only hands quayBoatGroup to registerShadowTarget, so unlike
  // the Drift, Iceland and the rest its `false` flags are actually honoured —
  // but the flag is stamped anyway, because the traverse is one line away in
  // every other biome in the project and a batch that carries its intent
  // survives being reparented.
  if (!cast) im.userData.noShadow = true;
  root.add(im);
  return im;
}
function quayPush9(l, px, py, pz, rx, ry, rz, sx, sy, sz) { l.push(px, py, pz, rx, ry, rz, sx, sy, sz); }

/** A pool of static shapes on ONE body. HALF extents, like quayStaticBox. */
function quayPool() {
  return new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC });
}
function quayPoolBox(b, x, y, z, hx, hy, hz) {
  b.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)), new CANNON.Vec3(x, y, z));
  return b;
}
function quayPoolDone(game, b) {
  if (game.mats && game.mats.ground) b.material = game.mats.ground;
  b.allowSleep = true;
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
  game.world.addBody(b);
  return b;
}
const quaySolids = makeSolidIndex();
function quayStaticBox(game, x, y, z, hx, hy, hz, ry) {
  quaySolids.add(x, y, z, hx, hy, hz, ry);
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

// ==================================================================== WATER ==
// One big grid, rippled on the CPU at 30 Hz exactly like the Sydney harbour, so
// a prop bobbing on it sits on the visible swell rather than near it. The grid
// is deliberately coarse — 2 800 quads across seven hundred metres — because at
// this scale the eye reads the horizon and the glitter, not the mesh.
const quaySEA_X0 = -420, quaySEA_X1 = 460;
const quaySEA_Z0 = -760, quaySEA_Z1 = 120;
// The same rectangle, published — see api.bounds(). It is exactly the extent
// of the drawn sea, because outside it there is neither water nor ground.
//
// ---- AND IT IS DELIBERATELY THE BIGGEST BOX IN THE GAME (integrity 1) ------
// 880 by 880 metres, against 264 for Pasto. The edges audit flagged that as
// "effectively unbounded on foot" and the flag was raised correctly; the
// decision is to KEEP it, for three reasons worth writing down so it is not
// re-opened every pass:
//
//   1. The sea is DRAWN across the whole rectangle. Every other chapter's
//      unbounded region was featureless nothing; this one is water, with the
//      headlands and the Bridge in sight from all of it. The player is never
//      lost in grey — which is the failure bounds() exists to prevent.
//   2. Out there `quayIsOverWater` is true, so the animal is SWIMMING, capped
//      at 2.6 m/s. Reaching the far edge on purpose takes four minutes and
//      nothing about it is a trap.
//   3. A tighter on-foot rectangle would have to be dropped the moment the
//      helm is taken and restored when it is given up. A bounds rectangle that
//      changes under the player is a rescue that can fire because you stepped
//      off a boat — a worse bug, and a much harder one to see, than the one it
//      would be fixing.
//
// So: chapter 3 is a boat chapter, the sea is the world, and the world is big.
const quayBOUNDS = { x0: quaySEA_X0, x1: quaySEA_X1, z0: quaySEA_Z0, z1: quaySEA_Z1 };
const quaySEA_STEP = 22;

function quayBuildWater() {
  const nx = Math.round((quaySEA_X1 - quaySEA_X0) / quaySEA_STEP);
  const nz = Math.round((quaySEA_Z1 - quaySEA_Z0) / quaySEA_STEP);
  const g = new THREE.PlaneGeometry(quaySEA_X1 - quaySEA_X0, quaySEA_Z1 - quaySEA_Z0, nx, nz);
  g.rotateX(-Math.PI / 2);
  g.translate((quaySEA_X0 + quaySEA_X1) * 0.5, quayWATER_Y, (quaySEA_Z0 + quaySEA_Z1) * 0.5);
  // Depth shading: pale in the shallows off the apron, deep green-blue out in
  // the stream. Baked into vertex colours, so the whole sea is one draw call
  // and one material and never needs a texture.
  const p = g.attributes.position.array;
  const col = new Float32Array(p.length);
  const near = new THREE.Color(PALETTE.seaNear);
  const mid = new THREE.Color(PALETTE.seaMid);
  const far = new THREE.Color(PALETTE.seaFar);
  for (let i = 0; i < p.length; i += 3) {
    const z = p[i + 2];
    // 0 at the quay, 1 out past the Heads
    const t = clamp((quayAPRON_Z - z) / 620, 0, 1);
    if (t < 0.5) quayCol.copy(near).lerp(mid, t * 2);
    else quayCol.copy(mid).lerp(far, (t - 0.5) * 2);
    col[i] = quayCol.r; col[i + 1] = quayCol.g; col[i + 2] = quayCol.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  // GLITTER, NOT WAVES. The mesh already has a ripple written into it and you
  // cannot see it from six metres up at 41 degrees; what makes water read as
  // water from there is a sparse field of moving points far brighter than the
  // surface. It costs four hash calls and it is the difference between a sea
  // and a sheet of coloured card. See grain() in shared.js.
  // ...AND THE HARBOUR IS A MIRROR (ROADMAP-WOW A1). The bridge eighty metres
  // out, the ferry on her berth and the wharves' piles doubled in the water
  // they stand in. The sheet's own ripple (quaySurfaceY, 0.29 m at the worst)
  // bends the sample per facet through the geometric normal, so out in the
  // stream the picture breaks up the way a harbour's does and in the lee of
  // the wharves it holds. sysREFLECT.quay carries the plane at quayWATER_Y.
  // Never clone this material after this call: the clone drops the hook.
  const m = new THREE.Mesh(g, grain(mat(0xffffff, { vertexColors: true }),
    { scale: 0.4, amount: 0.05, warp: 0,
      sparkle: 0.62, sparkleScale: 0.95, sparkleSpeed: 0.28, sparkleCut: 0.635, fresnel: 0.65,
      sparkleColor: PALETTE.foam,
      reflect: { k: 1.0, pow: 1.0, wobble: 1.0, blur: 0 } }));
  m.receiveShadow = true;
  m.castShadow = false;
  m.frustumCulled = false;
  quayWaterAttr = g.attributes.position;
  quayWaterMesh = m;
  return m;
}

/** The buoyancy/visual surface. Same maths as the ripple written into the mesh. */
function quaySurfaceY(x, z) {
  return quayWATER_Y + Math.sin(x * 0.035 + quayTime * 0.75) * 0.16
                     + Math.sin(z * 0.052 - quayTime * 0.58) * 0.13;
}

/**
 * The sun path. A long lozenge of pale gold laid on the water down the sun's
 * bearing, brightest near the camera. Additive-ish (transparent, depthWrite
 * off) so it never fights the ripple underneath it.
 */
const quayGLIT_N = 120;
let quayGlitData = null;
function quayBuildGlitter() {
  const N = quayGLIT_N;
  quayGlitData = new Float32Array(N * 6);        // dx, dz, yaw, w, l, phase
  for (let i = 0; i < N; i++) {
    const d = 12 + i * 6.6;
    const sp = 2.0 + i * 0.36;
    // LONG AND THIN, and aligned down the sun's bearing. Square patches at 30%
    // opacity read as litter on the water rather than as light on it.
    const o = i * 6;
    quayGlitData[o] = rand(-sp, sp);
    quayGlitData[o + 1] = -d + rand(-4, 4);
    quayGlitData[o + 2] = rand(-0.12, 0.12);
    quayGlitData[o + 3] = rand(0.35, 0.9);
    quayGlitData[o + 4] = rand(2.4, 7.0);
    quayGlitData[o + 5] = rand(0, Math.PI * 2);
  }
  const im = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    mat(PALETTE.seaGlitter, { transparent: true, opacity: 0.17, depthWrite: false }),
    N);
  im.frustumCulled = false;
  im.castShadow = false; im.receiveShadow = false;
  quayGlitter = im;
  return im;
}

/**
 * THE SUN PATH WAS DRAWN UNDER THE SEA.
 *
 * Every lozenge sat at the DATUM plus six centimetres — y = -0.44 — and
 * quaySurfaceY runs from -0.79 to -0.21, so for most of the harbour, most of
 * the time, the ripple mesh was in front of the light that is supposed to be
 * lying on it and the path was chopped into flickering bands. It is also the
 * reason it never read as bright: two thirds of it was never on screen.
 *
 * Now every quad is placed in WORLD space on the actual surface, once a frame,
 * for a hundred and twenty matrix writes — which also buys the thing it always
 * wanted, a sun path that BREATHES with the swell and pulses along its length
 * instead of lying there like a decal.
 */
function quayUpdateGlitter(game) {
  const im = quayGlitter;
  if (!im || !game.camera) return;
  const cx = game.camera.position.x, cz = game.camera.position.z;
  for (let i = 0; i < quayGLIT_N; i++) {
    const o = i * 6;
    const x = cx + quayGlitData[o], z = cz + quayGlitData[o + 1];
    const k = 0.55 + 0.45 * Math.sin(quayTime * 1.7 + quayGlitData[o + 5]);
    im.setMatrixAt(i, quayXform(x, quaySurfaceY(x, z) + 0.05, z,
                                -Math.PI / 2, quayGlitData[o + 2], 0,
                                quayGlitData[o + 3] * (0.6 + k * 0.7),
                                quayGlitData[o + 4], 1));
  }
  im.instanceMatrix.needsUpdate = true;
}

// ================================================================= QUAYSIDE ==
function quayBuildQuayside(game, root) {
  const A = quayMerger();
  // EVERY UPRIGHT ON THIS QUAY IS SOLID. Five of the eighteen walk-through
  // points in this biome were here — the shelter posts on all three finger
  // wharves, the berth boards, the lamp standards and the ticket stiles —
  // and every one of them is the same omission: a loop that draws a post and
  // does not collide it.
  const F = quayPool();

  // ---- the apron, AND IT WAS ONE BOX (the second beauty pass, item 5) ------
  //
  // Ninety-six metres by twenty-eight, in a single colour, and it is the thing
  // the player stands on for the whole chapter. Measured on a frame histogram
  // of all nineteen arrival frames, the Quay is the worst in the game for it:
  // 58 % of the picture sits within eight levels of one value, against 15 %
  // in Cali and 17 % in Rio. Grain, the near octave and the broad octave are
  // all on it already and none of them can help — they are a texture ON a
  // value, and the complaint is the value.
  //
  // So it is laid stone now: eleven bays by four courses, each one its own
  // box and therefore its own draw from the merger's colour jitter, with a
  // groove between them. That is what a stone apron IS, and the jitter that
  // item 3 put in the merger is what makes it cost one option rather than a
  // table of forty-four colours.
  //
  // The collider does not change: it was one box before this and it is one
  // box after, because a joint 12 mm deep is not a thing anybody can trip on.
  {
    const az0 = quayAPRON_Z, az1 = quayAPRON_Z1;
    const NX = 11, NZ = 4;
    const bw = (quayAPRON_HX * 2) / NX, bd = (az1 - az0) / NZ;
    for (let i = 0; i < NX; i++) {
      for (let j = 0; j < NZ; j++) {
        A.box(-quayAPRON_HX + (i + 0.5) * bw, -0.10, az0 + (j + 0.5) * bd,
              bw - 0.09, 0.60, bd - 0.09, PALETTE.path);
      }
    }
    // the grooves, one course lower so they read as a joint and not a line
    for (let i = 1; i < NX; i++) {
      A.box(-quayAPRON_HX + i * bw, -0.13, (az0 + az1) * 0.5, 0.10, 0.56, az1 - az0,
            PALETTE.sandstoneDark);
    }
    for (let j = 1; j < NZ; j++) {
      A.box(0, -0.13, az0 + j * bd, quayAPRON_HX * 2, 0.56, 0.10, PALETTE.sandstoneDark);
    }
  }
  A.box(0, 0.14, quayAPRON_Z + 0.35, quayAPRON_HX * 2, 0.12, 0.70, PALETTE.stone);
  quayStaticBox(game, 0, -0.20, (quayAPRON_Z + quayAPRON_Z1) * 0.5,
                quayAPRON_HX, 0.40, (quayAPRON_Z1 - quayAPRON_Z) * 0.5);
  // a batter into the water, so the apron does not read as a floating slab
  A.box(0, -1.05, quayAPRON_Z - 0.4, quayAPRON_HX * 2 + 1.2, 1.3, 1.6, PALETTE.sandstoneDark);

  // ---- three finger wharves, each with a shelter and a berth number
  for (let w = 0; w < quayWHARF_X.length; w++) {
    const wx = quayWHARF_X[w];
    const zc = (quayWHARF_Z0 + quayAPRON_Z) * 0.5;
    const zl = quayAPRON_Z - quayWHARF_Z0;
    A.box(wx, quayWHARF_Y - 0.12, zc, quayWHARF_HX * 2, 0.24, zl, PALETTE.wood);
    A.box(wx, quayWHARF_Y + 0.02, zc, quayWHARF_HX * 2 + 0.4, 0.10, zl + 0.4, PALETTE.woodDark);
    quayStaticBox(game, wx, quayWHARF_Y - 0.20, zc, quayWHARF_HX, 0.28, zl * 0.5);
    // piles
    for (let i = 0; i < 5; i++) {
      const pz = quayWHARF_Z0 + 1.5 + i * (zl - 3) / 4;
      for (let s = -1; s <= 1; s += 2) {
        A.cyl(wx + s * (quayWHARF_HX + 0.25), -0.9, pz, 0.28, 3.0, PALETTE.woodDark);
      }
    }
    // shelter: four posts and a hipped roof, at the LANDWARD end so it does not
    // sit over the berth and hide the boat you have come to steal
    for (let s = -1; s <= 1; s += 2) {
      for (let t = -1; t <= 1; t += 2) {
        A.box(wx + s * 2.3, quayWHARF_Y + 1.45, 12.2 + t * 2.3, 0.22, 2.9, 0.22, PALETTE.wharfIron);
        quayPoolBox(F, wx + s * 2.3, quayWHARF_Y + 1.45, 12.2 + t * 2.3, 0.11, 1.45, 0.11);
      }
    }
    // A HIPPED ROOF, which is what the comment above has always claimed and
    // what the geometry has never been: two flat plates stacked. Four pitched
    // planes meeting at a short ridge — from this game's one camera angle a
    // stack of slabs reads as a table, and there were three of them in the
    // middle of the first shot of the chapter.
    const SP = 0.38;
    for (let e = -1; e <= 1; e += 2) {
      A.box(wx + e * 1.55, quayWHARF_Y + 3.24, 12.2, 3.5, 0.20, 5.9,
            PALETTE.sail, 0, 0, -e * SP);
      A.box(wx, quayWHARF_Y + 3.24, 12.2 + e * 1.6, 5.7, 0.20, 3.6,
            PALETTE.sailShade, e * SP, 0, 0);
    }
    A.box(wx, quayWHARF_Y + 3.70, 12.2, 2.0, 0.18, 2.0, PALETTE.sailShade);
    // berth number board, out at the seaward end where you read it from a boat
    A.box(wx, quayWHARF_Y + 2.05, -1.0, 1.5, 0.75, 0.14, PALETTE.cloth2);
    A.box(wx, quayWHARF_Y + 2.05, -1.08, 0.42, 0.46, 0.06, PALETTE.sail);
    A.box(wx, quayWHARF_Y + 1.10, -1.0, 0.18, 1.9, 0.18, PALETTE.wharfIron);
    quayPoolBox(F, wx, quayWHARF_Y + 1.45, -1.0, 0.75, 1.6, 0.10);
  }

  // ---- the colonnade behind: an arcade of piers under a long awning. It is the
  // back wall of the picture, so it is deliberately flat and pale.
  const COZ = quayAPRON_Z1 - 1.2;
  for (let x = -44; x <= 44; x += 5.5) {
    A.box(x, 2.0, COZ, 1.0, 4.0, 1.0, PALETTE.sandstone);
    quayPoolBox(F, x, 2.0, COZ, 0.5, 2.0, 0.5);
    A.box(x, 0.35, COZ, 1.35, 0.30, 1.35, PALETTE.stone);          // the plinth
    A.box(x, 4.1, COZ, 1.35, 0.32, 1.35, PALETTE.sandstoneDark);   // the capital
    // AN ARCADE IS ARCHES. Nine chords per bay, springing off the capitals —
    // a rank of bare posts under a flat plate is a bus shelter, and it was the
    // back wall of every shot on the apron.
    if (x < 44) {
      const N = 7, R = 2.75;
      for (let i = 0; i < N; i++) {
        const a0 = Math.PI * (i / N), a1 = Math.PI * ((i + 1) / N);
        const x0 = x + 2.75 - Math.cos(a0) * R, y0 = 4.26 + Math.sin(a0) * R * 0.62;
        const x1 = x + 2.75 - Math.cos(a1) * R, y1 = 4.26 + Math.sin(a1) * R * 0.62;
        const dl = Math.hypot(x1 - x0, y1 - y0);
        A.box((x0 + x1) * 0.5, (y0 + y1) * 0.5, COZ, dl + 0.22, 0.46, 1.1,
              PALETTE.sandstone, 0, 0, Math.atan2(y1 - y0, x1 - x0));
      }
    }
  }
  A.box(0, 6.10, COZ, 92, 0.55, 4.2, PALETTE.sail);                // the awning
  A.box(0, 6.44, COZ - 2.0, 92, 0.22, 0.5, PALETTE.hullGreen);     // and its edge
  A.box(0, 7.6, quayAPRON_Z1 + 1.6, 92, 4.2, 3.0, PALETTE.sandstone);
  // an upper storey with windows in it, which is what makes the back wall a
  // BUILDING rather than a parapet
  for (let x = -44; x <= 44; x += 4.0) {
    A.box(x, 7.7, quayAPRON_Z1 + 0.05, 2.3, 2.4, 0.22, PALETTE.glass);
    A.box(x, 9.1, quayAPRON_Z1 + 0.02, 2.7, 0.28, 0.30, PALETTE.sandstoneDark);
  }
  A.box(0, 9.9, quayAPRON_Z1 + 1.6, 92, 0.5, 3.6, PALETTE.stone);
  A.box(0, 10.3, quayAPRON_Z1 + 1.6, 92.8, 0.3, 4.0, PALETTE.sandstoneDark);
  // THE TERMINAL CLOCK. Every ferry wharf on this harbour has one and the
  // biggest one is over the concourse; it is also the only thing in the chapter
  // that tells you the hour the chapter is set at.
  A.box(0, 8.4, quayAPRON_Z1 - 0.35, 5.0, 3.0, 0.5, PALETTE.sandstoneDark);
  A.cyl(0, 8.5, quayAPRON_Z1 - 0.68, 1.7, 0.24, PALETTE.sail, Math.PI / 2, 0, 0, 8);
  A.cyl(0, 8.5, quayAPRON_Z1 - 0.82, 1.5, 0.10, PALETTE.hullCream, Math.PI / 2, 0, 0, 8);
  A.box(0.0, 9.05, quayAPRON_Z1 - 0.90, 0.13, 1.05, 0.08, PALETTE.wharfIron);
  A.box(0.55, 8.5, quayAPRON_Z1 - 0.90, 1.05, 0.11, 0.08, PALETTE.wharfIron);
  for (let k = 0; k < 12; k++) {
    const a = k / 12 * Math.PI * 2;
    A.box(Math.sin(a) * 1.28, 8.5 + Math.cos(a) * 1.28, quayAPRON_Z1 - 0.86,
          0.12, 0.24, 0.06, PALETTE.wharfIron, 0, 0, -a);
  }
  // Wide enough to reach past both ends of the apron: the soak test walked round
  // the corner of a 46 m wall standing on a 48 m apron.
  quayStaticBox(game, 0, 2.2, quayAPRON_Z1 + 1.2, 62, 4.4, 2.6);
  // ---- THE REST OF THE PAVING, WHICH THE LAND TEST HAD ALWAYS CLAIMED -----
  // quayIsOverWater says land out to quayLAND_HX by quayLAND_Z1 and it now
  // means it, so all of that has to be DRAWN and all of it has to be solid: the
  // two wings east and west of the 96 m apron (the east one is the Opera House
  // forecourt and the west one is Campbells Cove) and the street behind. The
  // old version drew a 130 x 22 strip and the test claimed a quadrant.
  for (let s = -1; s <= 1; s += 2) {
    const w = quayLAND_HX - quayAPRON_HX;
    const cx = s * (quayAPRON_HX + w * 0.5);
    A.box(cx, -0.10, (quayAPRON_Z + quayLAND_Z1) * 0.5, w, 0.60, quayLAND_Z1 - quayAPRON_Z,
          PALETTE.path);
    quayStaticBox(game, cx, -0.20, (quayAPRON_Z + quayLAND_Z1) * 0.5,
                  w * 0.5, 0.40, (quayLAND_Z1 - quayAPRON_Z) * 0.5);
    // the sea wall along each wing, and a batter under it
    A.box(cx, 0.14, quayAPRON_Z + 0.35, w, 0.12, 0.70, PALETTE.stone);
    A.box(cx, -1.05, quayAPRON_Z - 0.4, w + 0.8, 1.3, 1.6, PALETTE.sandstoneDark);
  }
  A.box(0, -0.10, (quayAPRON_Z1 + quayLAND_Z1) * 0.5, quayAPRON_HX * 2, 0.60,
        quayLAND_Z1 - quayAPRON_Z1, PALETTE.path);
  quayStaticBox(game, 0, -0.20, (quayAPRON_Z1 + quayLAND_Z1) * 0.5,
                quayAPRON_HX, 0.40, (quayLAND_Z1 - quayAPRON_Z1) * 0.5);

  // ---- ticket gates: a rank of little stiles, because a ferry terminal is
  // mostly a machine for queueing
  for (let i = 0; i < 9; i++) {
    const x = -22 + i * 5.5;
    A.box(x, 0.55, quayAPRON_Z1 - 7.0, 0.34, 1.10, 1.7, PALETTE.wharfIron);
    quayPoolBox(F, x, 0.55, quayAPRON_Z1 - 7.0, 0.17, 0.55, 0.85);
    A.box(x, 1.16, quayAPRON_Z1 - 7.0, 0.44, 0.12, 1.9, PALETTE.metal);
  }

  // ---- bollards + cleats along the apron edge
  const bol = [];
  for (let x = -46; x <= 46; x += 5) {
    let onWharf = false;
    for (let w = 0; w < quayWHARF_X.length; w++) {
      if (Math.abs(x - quayWHARF_X[w]) < quayWHARF_HX + 1) onWharf = true;
    }
    if (onWharf) continue;
    quayPush9(bol, x, 0.42, quayAPRON_Z + 1.4, 0, 0, 0, 0.5, 0.84, 0.5);
    quayPoolBox(F, x, 0.42, quayAPRON_Z + 1.4, 0.25, 0.42, 0.25);
  }
  quayInstance(root, quayG.cyl6, PALETTE.stoneDark, bol, true, true);

  // ---- lamp standards
  const posts = [], heads = [];
  for (let x = -42; x <= 42; x += 12) {
    quayPush9(posts, x, 2.3, quayAPRON_Z + 3.4, 0, 0, 0, 0.22, 4.6, 0.22);
    quayPoolBox(F, x, 2.3, quayAPRON_Z + 3.4, 0.11, 2.3, 0.11);
    quayPush9(heads, x, 4.75, quayAPRON_Z + 3.4, 0, 0.79, 0, 0.6, 0.8, 0.6);
  }
  quayInstance(root, quayG.cyl6, PALETTE.metal, posts, true, false);
  quayInstance(root, quayG.cyl4, PALETTE.sail, heads, false, false);

  // ---- and the ninety-six metres of nothing in between --------------------
  // The apron is 96 m by 28 m of one flat sandstone value and it fills the
  // bottom third of the chapter's opening shot. The world-size audit's rule is
  // that no twenty-metre cell of a walking route should hold fewer than three
  // things; this one held a bollard. None of what follows is a mechanic — it is
  // the difference between a ferry terminal and a car park with a boat at it.
  const bench = [], back = [], legs = [], bin = [];
  for (let i = 0; i < 8; i++) {
    const bxp = -42 + i * 12;
    // benches face the water, backs to the colonnade, the way they always are
    quayPush9(bench, bxp, 0.62, quayAPRON_Z1 - 12.5, 0, 0, 0, 2.6, 0.14, 0.62);
    quayPush9(back, bxp, 0.95, quayAPRON_Z1 - 12.15, -0.20, 0, 0, 2.6, 0.60, 0.10);
    for (let s = -1; s <= 1; s += 2) {
      quayPush9(legs, bxp + s * 1.05, 0.40, quayAPRON_Z1 - 12.5, 0, 0, 0, 0.14, 0.44, 0.52);
    }
    if (i % 3 === 1) quayPush9(bin, bxp + 4.0, 0.66, quayAPRON_Z1 - 12.2, 0, 0, 0, 0.62, 0.92, 0.62);
  }
  quayInstance(root, quayG.box, PALETTE.deckTeak, bench, true, false);
  quayInstance(root, quayG.box, PALETTE.deckTeak, back, true, false);
  quayInstance(root, quayG.box, PALETTE.wharfIron, legs, false, false);
  quayInstance(root, quayG.cyl8, PALETTE.wharfIron, bin, true, false);
  // PAVING. One flat value under a high camera is the thing grain() cannot fix
  // on its own — it needs an edge to work against. Joints every four metres in
  // both directions, half a shade darker, and the whole apron acquires a scale.
  for (let x = -46; x <= 46; x += 4) {
    A.box(x, 0.205, (quayAPRON_Z + quayAPRON_Z1) * 0.5, 0.13, 0.02,
          quayAPRON_Z1 - quayAPRON_Z, PALETTE.stone);
  }
  for (let z = quayAPRON_Z + 2; z < quayAPRON_Z1; z += 4) {
    A.box(0, 0.205, z, quayAPRON_HX * 2, 0.02, 0.13, PALETTE.stone);
  }
  // and a route board at the head of each finger, which is the one thing a
  // terminal has that says which boat goes where
  for (let w = 0; w < quayWHARF_X.length; w++) {
    const wx = quayWHARF_X[w];
    A.box(wx - 3.2, 1.85, quayAPRON_Z + 2.6, 0.16, 3.3, 0.16, PALETTE.wharfIron);
    A.box(wx + 3.2, 1.85, quayAPRON_Z + 2.6, 0.16, 3.3, 0.16, PALETTE.wharfIron);
    // PALE FACE, DARK LINES. A seven-metre slab of wharfIron at the head of each
    // finger read as three blank grey billboards across the opening shot — the
    // face is the paper, not the frame.
    A.box(wx, 2.85, quayAPRON_Z + 2.6, 6.2, 1.35, 0.14, PALETTE.sail);
    A.box(wx, 3.44, quayAPRON_Z + 2.54, 6.4, 0.30, 0.10, PALETTE.hullGreen);
    for (let k = 0; k < 4; k++) {
      A.box(wx - 2.2 + k * 1.5, 2.62, quayAPRON_Z + 2.52, 1.15, 0.18, 0.06, PALETTE.wharfIron);
    }
    A.box(wx, 3.02, quayAPRON_Z + 2.52, 5.6, 0.06, 0.06, PALETTE.wharfIron);
    quayPoolBox(F, wx - 3.2, 1.85, quayAPRON_Z + 2.6, 0.08, 1.65, 0.08);
    quayPoolBox(F, wx + 3.2, 1.85, quayAPRON_Z + 2.6, 0.08, 1.65, 0.08);
  }

  // ---- AND THE THINGS THAT MAKE IT A TERMINAL ----------------------------
  // The apron measured one bollard per twenty-metre cell against a rule that
  // asks for three, and it is the opening shot of the chapter. None of what
  // follows is a mechanic either; all of it is the difference between a place
  // people leave from and a slab.

  // the queue maze at the gates: posts and a tape between them, folded twice
  const qp = [], tape = [];
  for (let lane = 0; lane < 3; lane++) {
    const zx = quayAPRON_Z1 - 10.6 + lane * 1.7;
    for (let x = -25; x <= -6; x += 3.1) {
      quayPush9(qp, x, 0.52, zx, 0, 0, 0, 0.12, 1.04, 0.12);
      if (x < -8) quayPush9(tape, x + 1.55, 0.86, zx, 0, 0, 0, 3.1, 0.07, 0.05);
    }
  }
  quayInstance(root, quayG.cyl6, PALETTE.wharfIron, qp, true, false);
  quayInstance(root, quayG.box, PALETTE.hullRed, tape, false, false);

  // the coffee cart, which is the single most Sydney object on this apron
  {
    const kx = 20, kz = quayAPRON_Z1 - 13.5;
    A.box(kx, 1.20, kz, 4.6, 2.30, 2.6, PALETTE.hullCream);
    A.box(kx, 2.48, kz, 5.2, 0.30, 3.2, PALETTE.hullGreen);
    A.box(kx, 2.86, kz, 1.5, 0.55, 1.5, PALETTE.hullGreen);           // the flue
    A.box(kx, 1.42, kz - 1.42, 3.4, 1.05, 0.16, PALETTE.glass);        // the window
    A.box(kx, 0.86, kz - 1.62, 3.8, 0.16, 0.60, PALETTE.deckTeak);     // the sill
    A.box(kx, 2.24, kz - 2.30, 4.4, 0.16, 1.60, PALETTE.awningManly, 0.22, 0, 0);
    for (let s = -1; s <= 1; s += 2) {
      A.box(kx + s * 2.1, 1.55, kz - 3.05, 0.10, 3.10, 0.10, PALETTE.wharfIron);
    }
    A.box(kx, 2.06, kz - 1.44, 2.6, 0.44, 0.10, PALETTE.hullRed);      // the board
    quayPoolBox(F, kx, 1.20, kz, 2.3, 1.15, 1.3);
    // two little tables outside it
    for (let i = 0; i < 3; i++) {
      const tx = kx + 4.6 + i * 3.0, tz = kz - 0.6 + (i % 2) * 2.2;
      A.cyl(tx, 0.45, tz, 0.11, 0.70, PALETTE.wharfIron, 0, 0, 0, 6);
      A.cyl(tx, 0.82, tz, 0.52, 0.08, PALETTE.deckTeakDark, 0, 0, 0, 8);
      for (let s = -1; s <= 1; s += 2) {
        A.box(tx + s * 1.05, 0.44, tz, 0.50, 0.08, 0.50, PALETTE.deckTeak);
        A.box(tx + s * 1.05, 0.24, tz, 0.10, 0.40, 0.44, PALETTE.wharfIron);
      }
    }
  }

  // the departures board, which is the only object here that says where the
  // boats go — and it is the thing you read before you steal one
  {
    const dz = quayAPRON_Z1 - 5.4;
    A.box(-34, 2.30, dz, 0.30, 4.60, 0.30, PALETTE.wharfIron);
    A.box(-24, 2.30, dz, 0.30, 4.60, 0.30, PALETTE.wharfIron);
    A.box(-29, 3.60, dz, 10.8, 2.60, 0.24, PALETTE.wharfIron);
    A.box(-29, 3.62, dz - 0.16, 10.2, 2.20, 0.06, PALETTE.hair2);
    for (let r = 0; r < 5; r++) {
      const y = 4.46 - r * 0.44;
      A.box(-32.4, y, dz - 0.22, 2.8, 0.16, 0.05, PALETTE.maiz);
      A.box(-27.4, y, dz - 0.22, 3.4, 0.16, 0.05, PALETTE.sail);
      A.box(-24.6, y, dz - 0.22, 1.1, 0.16, 0.05, PALETTE.buoyGreen);
    }
    quayPoolBox(F, -34, 2.30, dz, 0.15, 2.30, 0.15);
    quayPoolBox(F, -24, 2.30, dz, 0.15, 2.30, 0.15);
  }

  // planters: eight fig tubs down the middle of the concourse. Vegetation is
  // walk-through everywhere in this game; the TUBS are not.
  const tub = [], fig = [], figDk = [];
  for (let i = 0; i < 8; i++) {
    const px = -38 + i * 11, pz = quayAPRON_Z1 - 17.5 + (i % 2) * 1.4;
    quayPush9(tub, px, 0.46, pz, 0, 0.4, 0, 1.5, 0.92, 1.5);
    quayPoolBox(F, px, 0.46, pz, 0.66, 0.46, 0.66);
    A.cyl(px, 1.55, pz, 0.16, 1.9, PALETTE.trunkDark, 0, 0, 0, 6);
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * Math.PI * 2 + i;
      quayPush9(fig, px + Math.cos(a) * 0.72, 2.55 + Math.sin(a * 2.1) * 0.34,
                pz + Math.sin(a) * 0.72, 0, a, 0, 1.7, 1.25, 1.7);
    }
    quayPush9(figDk, px, 2.95, pz, 0, i, 0, 2.1, 1.5, 2.1);
  }
  quayInstance(root, quayG.cyl8, PALETTE.stoneDark, tub, true, true);
  quayInstance(root, quayG.sph6, PALETTE.leafC, fig, true, false);
  quayInstance(root, quayG.sph6, PALETTE.leafA, figDk, true, false);

  // luggage and a stack of crates against the colonnade, because a wharf is a
  // place where things are waiting
  const cases = [];
  for (let i = 0; i < 14; i++) {
    const px = -46 + rand(0, 92), pz = quayAPRON_Z1 - 3.4 + rand(-1.2, 1.2);
    quayPush9(cases, px, 0.42, pz, 0, rand(0, 3), 0, rand(0.5, 0.8), 0.62, rand(0.32, 0.5));
  }
  quayInstance(root, quayG.box, PALETTE.hair4, cases, true, false);

  // ...and gulls, standing on the bollards, judging. The flock out on the
  // buoys is four hundred metres away and this apron had no birds at all.
  quayBuildApronGulls(root);

  quayPoolDone(game, F);

  const m = new THREE.Mesh(A.build(), quayVC());
  m.castShadow = true;
  m.receiveShadow = true;
  root.add(m);
}

// ============================================================ BENNELONG POINT ==
/**
 * THE OPERA HOUSE, WHICH WAS NOT IN CIRCULAR QUAY.
 *
 * The chapter is named after the ferry terminal that faces it. The Freshwater's
 * own route table calls her first waypoint "the Quay approach, off the Opera
 * House". `quayIsOverWater` claimed the whole quadrant east of the apron as dry
 * land. And there was nothing there: a hundred and thirty metres of blank water
 * on the side of the picture the boat turns towards the moment she comes off
 * the wall, in the chapter with the lowest triangle count in the game.
 *
 * A shell is a SEGMENT OF A SPHERE, and that is the only thing about the
 * building that is hard to fake: two half-arch ribs leaning against each other
 * with a lofted skin between them, tilted off the podium's axis so that the
 * pair reads as a sail with a spine. Ten of them in two nested groups plus the
 * restaurant shell, all merged, all one draw call — and because they are
 * chorded rather than smooth they belong to the same world as the headlands.
 *
 * The podium is walkable: it is the only place in this chapter besides the two
 * islands where the capybara can climb out of the harbour onto something worth
 * standing on, and the steps down the west face are how she gets there.
 */
function quayShell(M, x0, y0, z, len, hgt, wid, col, colIn) {
  // ONE SHELL, AS A LOFTED SURFACE AND NOT A STACK OF SLABS.
  //
  // Boxes were tried first, one per chord, and they came out as a ziggurat:
  // stepped courses read as concentric stripes from the only camera angle this
  // game has, which is the same trap the Manly wharf shed's roof fell into.
  // A shell is a piece of a SPHERE, so it is built the way the headlands are —
  // rows of vertices and triangles between them — with three rows across it
  // (edge, ridge, edge) so the cross-section is curved rather than flat, and a
  // fourth underneath so the thing is a closed solid with a lip you can see.
  //
  // The profile is a quarter-ellipse from (x0, y0) to the apex at
  // (x0 + len, y0 + hgt). `len` may be negative, which is how the short back
  // half of a sail is drawn — the pair meet at the apex and lean on each other,
  // and the ASYMMETRY is what stops the group reading as a row of tents.
  const N = 15;
  const A = [], B = [], C = [], D = [], E = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const px = x0 + len * Math.sin(t * Math.PI * 0.5);
    const py = y0 + hgt * (1 - Math.cos(t * Math.PI * 0.5));
    const hw = wid * 0.5 * (1 - t * t * 0.88) + 0.22;
    A.push(M.vert(px, py, z - hw, colIn));                 // west edge
    B.push(M.vert(px, py + hw * 0.42, z - hw * 0.52, col)); // west haunch
    C.push(M.vert(px, py + hw * 0.62, z, col));             // the ridge
    D.push(M.vert(px, py + hw * 0.42, z + hw * 0.52, col)); // east haunch
    E.push(M.vert(px, py, z + hw, colIn));                  // east edge
  }
  const rows = [A, B, C, D, E];
  for (let r = 0; r < rows.length - 1; r++) {
    const p = rows[r], q = rows[r + 1];
    for (let i = 0; i < N; i++) {
      M.tri(p[i], q[i], q[i + 1]);
      M.tri(p[i], q[i + 1], p[i + 1]);
    }
  }
  // the soffit: the two edges closed straight across, so the shell has an
  // underside and a lip rather than being a sheet of paper
  for (let i = 0; i < N; i++) {
    M.tri(E[i], A[i], A[i + 1]);
    M.tri(E[i], A[i + 1], E[i + 1]);
  }
}

function quayBuildOpera(game, root) {
  const O = quayMerger();
  const bx = quayBEN.x, bz = quayBEN.z, top = quayWATER_Y + quayBEN.y;

  // ---- the point itself: a sandstone podium with a batter into the water ----
  // The DRAWN podium stops where its collider stops (at the foot of the top
  // step) and not a metre further: the audit walks a 5 m grid and a drawn slab
  // that overhangs its own collider by four metres is four metres of building
  // you walk through, on the one landmark in the chapter.
  const podZ1d = quayBEN_STEP_Z0 - quayBEN_TREAD * 0.5;
  const podZ0d = bz - quayBEN.hz;
  O.box(bx, top - 1.5, (podZ0d + podZ1d) * 0.5, quayBEN.hx * 2, 3.0, podZ1d - podZ0d,
        PALETTE.sandstone);
  O.box(bx, quayWATER_Y - 0.6, bz, quayBEN.hx * 2 + 2.4, 1.9, quayBEN.hz * 2 + 2.4,
        PALETTE.sandstoneDark);
  // THE MONUMENTAL STEPS, WHICH HAVE TO BE CLIMBABLE.
  // The podium stands 2.6 m over the apron it abuts, and a 2.6 m wall on the
  // one route onto the point makes the whole building scenery. Nine treads of
  // 0.29, which is under the 0.40 a capybara steps over without noticing, and
  // the podium's own collider is pulled back clear of them so they are not
  // buried inside it.
  for (let i = 0; i < quayBEN_STEPS; i++) {
    const ty = top - quayBEN_RISE * (i + 1);
    const zc = quayBEN_STEP_Z0 + i * quayBEN_TREAD;
    O.box(bx, (ty - 0.5) * 0.5, zc, quayBEN.hx * 2, ty + 0.5, quayBEN_TREAD, PALETTE.stone);
    quayBenStep.push({ y: ty, z: zc });
  }
  // and the broadwalk round the water's edge
  for (let s = -1; s <= 1; s += 2) {
    O.box(bx + s * (quayBEN.hx - 0.5), top + 0.05, bz, 1.0, 0.14, quayBEN.hz * 2, PALETTE.stoneDark);
  }
  // joints across the podium, the same trick as the apron
  for (let i = -6; i <= 6; i++) {
    O.box(bx + i * 3.2, top + 0.01, bz, 0.12, 0.02, quayBEN.hz * 2 - 1, PALETTE.stoneDark);
  }

  // ---- the shells -----------------------------------------------------------
  // Two ranks, the big one on the harbour side and the smaller behind, each a
  // descending series — and each shell is a PAIR leaning together, which is the
  // only way the silhouette comes out right.
  const SH = [
    // z offset, x offset, length, height, width
    [-18.5, -1.6, 16.0, 14.0,  9.2],
    [ -8.0,  0.4, 13.4, 11.6,  8.2],
    [  0.6,  1.8, 10.6,  9.2,  7.0],
    [  7.8,  2.8,  7.6,  6.6,  5.8],
  ];
  for (let i = 0; i < SH.length; i++) {
    const zc = bz + SH[i][0];
    const cx = bx + SH[i][1];
    const len = SH[i][2], hgt = SH[i][3], wid = SH[i][4];
    // the long sweep out of the podium to the north, and the short one behind
    // it — they meet at the apex, over cx. The pair is deliberately OFF-CENTRE
    // and each one is a little further east than the last: four sails on the
    // same axis is a row of tents, and four on a drifting axis is a building.
    quayShell(O, cx - len, top + 0.15, zc, len, hgt, wid, PALETTE.sail, PALETTE.sailShade);
    quayShell(O, cx + len * 0.72, top + 0.15, zc, -len * 0.72, hgt * 0.94, wid * 0.9,
              PALETTE.sailShade, PALETTE.stoneDark);
    // the glazed base under the shell's north lip, low and tucked in. A
    // full-height rectangle was tried first and it is a twenty-metre blue
    // hoarding standing in front of the building — you could not see the sails
    // at all. Glass belongs in the gap, and the gap is small.
    O.box(cx - len * 0.40, top + 1.15, zc - wid * 0.34, len * 0.95, 2.2, 0.30, PALETTE.glass);
    O.box(cx - len * 0.40, top + 2.32, zc - wid * 0.34, len * 0.99, 0.24, 0.42,
          PALETTE.stoneDark);
  }
  // the restaurant shell, low and off to the west, which is what stops the
  // group reading as a mirrored pair of anything
  quayShell(O, bx - 12.5, top + 0.15, bz + 15.5, 6.4, 5.8, 5.0, PALETTE.sail, PALETTE.sailShade);
  quayShell(O, bx - 2.4, top + 0.15, bz + 15.5, -3.7, 5.8, 4.7,
            PALETTE.sailShade, PALETTE.stoneDark);

  const m = new THREE.Mesh(O.build(), quayVC());
  m.castShadow = true;
  m.receiveShadow = true;
  m.frustumCulled = false;
  root.add(m);

  // ---- solid ----------------------------------------------------------------
  // The podium you may stand on; the shells you may not walk through. One pool.
  const P = quayPool();
  // the podium, PULLED BACK clear of the steps so they stand proud of it
  const podZ1 = quayBEN_STEP_Z0 - quayBEN_TREAD * 0.5;
  const podZ0 = bz - quayBEN.hz;
  quayPoolBox(P, bx, top - 1.5, (podZ0 + podZ1) * 0.5, quayBEN.hx, 1.5, (podZ1 - podZ0) * 0.5);
  for (let i = 0; i < quayBenStep.length; i++) {
    const st = quayBenStep[i];
    quayPoolBox(P, bx, (st.y - 0.5) * 0.5, st.z,
                quayBEN.hx, (st.y + 0.5) * 0.5, quayBEN_TREAD * 0.5);
  }
  for (let i = 0; i < SH.length; i++) {
    const zc = bz + SH[i][0];
    quayPoolBox(P, bx + SH[i][1], top + SH[i][3] * 0.44, zc,
                SH[i][2] * 0.98, SH[i][3] * 0.44, SH[i][4] * 0.48);
  }
  quayPoolBox(P, bx - 8.1, top + 2.4, bz + 15.5, 5.2, 2.4, 2.5);
  quayPoolDone(game, P);
  // and the hull is turned away from the point, which is a rock with a building
  // on it and the only thing in the fairway between the berth and the Bridge.
  quayHARD.push({ x: bx, z: bz, r: 24 + quayBOAT_HX, name: 'bennelong' });

  // The forecourt lamps. Four warm points on the podium at the one hour this
  // chapter is set — they do nothing at noon and they are the whole reason the
  // building reads as OCCUPIED from four hundred metres out.
  const lamps = [];
  for (let i = 0; i < 8; i++) {
    const lx = bx + (i % 2 ? 1 : -1) * (quayBEN.hx - 2.6);
    const lz = bz - 18 + Math.floor(i / 2) * 12;
    quayPush9(lamps, lx, top + 2.0, lz, 0, 0, 0, 0.18, 4.0, 0.18);
  }
  quayInstance(root, quayG.cyl6, PALETTE.metal, lamps, true, false);
  const heads = [];
  for (let i = 0; i < lamps.length / 9; i++) {
    quayPush9(heads, lamps[i * 9], lamps[i * 9 + 1] + 2.15, lamps[i * 9 + 2],
              0, 0.79, 0, 0.55, 0.55, 0.55);
  }
  quayOperaLamp = quayInstance(root, quayG.sph6, PALETTE.driLamp, heads, false, false);
  if (quayOperaLamp) {
    quayOperaLamp.material.transparent = true;
    quayOperaLamp.material.opacity = 0.85;
  }
}

// ====================================================================== CITY ==
/**
 * WHAT IS BEHIND A FERRY TERMINAL.
 *
 * The colonnade is 8.7 m high and 92 m wide and it is the back wall of the
 * playable world — that is right and it stays. But above it there was SKY, and
 * Circular Quay is a notch cut in the bottom of a city: the reason the terminal
 * is shaped the way it is, is that the office towers come down to within a
 * hundred metres of the water. Turn the camera south on the apron and the
 * chapter used to end.
 *
 * Twenty-six towers in four ranks, warm stone and glass rather than Kowloon's
 * night blues, each one a stack of two or three setback shafts with a crown —
 * and the tri budget goes on WINDOW BANDS, because a tower without them is a
 * box and a tower with them is a building. All instanced: three draws for
 * eleven hundred windows.
 *
 * Not walkable. The frontage is one continuous solid wall at z = 62 so there is
 * no gap between two towers to squeeze through, and the land test stops at 60.
 */
const quayTOWER_COL = [0xe8ddc8, 0xdcd3c2, 0xcfc9bd, 0xe2d6b8, 0xc9c8c4, 0xd8cbb0];
function quayBuildCity(game, root) {
  const C = quayMerger();
  let s = 20250821;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const win = [], winDk = [], mast = [];

  // the street frontage: an unbroken retaining wall with shopfronts in it, so
  // the city has a ground floor and the world has an edge
  C.box(0, 1.9, quayCITY_Z0 + 1.0, quayLAND_HX * 2 + 12, 5.4, 4.0, PALETTE.sandstoneDark);
  C.box(0, 4.8, quayCITY_Z0 + 1.0, quayLAND_HX * 2 + 13, 0.5, 4.6, PALETTE.stone);
  let shopI = 0;
  for (let x = -quayLAND_HX - 3; x <= quayLAND_HX + 3; x += 6.5) {
    C.box(x, 1.5, quayCITY_Z0 - 1.05, 3.6, 3.0, 0.22, PALETTE.glass);
    C.box(x, 3.3, quayCITY_Z0 - 1.1, 4.4, 0.6, 0.32,
          quayTOWER_COL[shopI++ % quayTOWER_COL.length]);
  }
  // the collider's front face lands at 60.6, IN FRONT of the shopfront glass it
  // stands behind (60.84): a wall whose skin is proud of its own collider is a
  // wall you can put your nose through, and the solidity audit says so.
  quayStaticBox(game, 0, 2.4, quayCITY_Z0 + 1.2, quayLAND_HX + 8, 6.0, 2.6);

  const RANK = [
    { z: 74,  n: 8, h0: 22, h1: 44, w0: 11, w1: 17 },
    { z: 104, n: 7, h0: 38, h1: 74, w0: 13, w1: 21 },
    { z: 140, n: 6, h0: 30, h1: 62, w0: 15, w1: 24 },
    { z: 186, n: 5, h0: 24, h1: 46, w0: 18, w1: 28 },
  ];
  for (let r = 0; r < RANK.length; r++) {
    const R = RANK[r];
    const span = quayLAND_HX * 2 + 44 + r * 30;
    for (let i = 0; i < R.n; i++) {
      const cx = -span * 0.5 + (i + 0.5) * span / R.n + (rnd() - 0.5) * 7;
      const w = R.w0 + rnd() * (R.w1 - R.w0);
      const d = w * (0.75 + rnd() * 0.5);
      // A TOWER MAY NOT STAND IN THE STREET. The front rank's z jitter is ±8
      // and a deep one is twenty metres across, so the nearest building's front
      // face could land at z = 55 — five metres in FRONT of the frontage wall,
      // out on the concourse, drawn and unsolid. The audit found one.
      const cz = Math.max(R.z + (rnd() - 0.5) * 16, quayCITY_Z0 + 5 + d * 0.5);
      const h = R.h0 + rnd() * (R.h1 - R.h0);
      const col = quayTOWER_COL[(rnd() * quayTOWER_COL.length) | 0];
      // two or three setbacks. A tower that is one prism is a domino.
      const tiers = rnd() < 0.45 ? 3 : 2;
      let y = 0, ww = w, dd = d;
      for (let t = 0; t < tiers; t++) {
        const th = h * (t === 0 ? 0.58 : (t === 1 ? 0.30 : 0.16));
        C.box(cx, y + th * 0.5, cz, ww, th, dd, col);
        // the windows: two banded columns a side, facing the water only —
        // nobody will ever see the back of these
        const rows = Math.max(2, Math.round(th / 3.4));
        for (let k = 0; k < rows; k++) {
          const wy = y + 2.0 + k * (th - 2.6) / Math.max(1, rows - 1);
          quayPush9(win, cx, wy, cz - dd * 0.5 - 0.06, 0, 0, 0, ww * 0.86, 1.5, 0.16);
          if (k % 2 === 0) {
            quayPush9(winDk, cx - ww * 0.5 - 0.06, wy, cz, 0, 0, 0, 0.16, 1.5, dd * 0.8);
            quayPush9(winDk, cx + ww * 0.5 + 0.06, wy, cz, 0, 0, 0, 0.16, 1.5, dd * 0.8);
          }
        }
        y += th;
        ww *= 0.80; dd *= 0.80;
      }
      // a crown, and one in five gets a mast — the skyline needs points in it
      C.box(cx, y + 0.5, cz, ww * 1.18, 1.0, dd * 1.18, PALETTE.stoneDark);
      if (rnd() < 0.34) quayPush9(mast, cx, y + 5.5, cz, 0, 0, 0, 0.5, 10, 0.5);
      // only the front rank has to stop anybody, and the frontage wall already
      // does; a body per tower is broadphase spent on scenery nobody touches.
    }
  }
  // Sydney Tower: one thing taller than everything, because a skyline needs a
  // subject and this one has had a golden bucket on a stick since 1981.
  {
    const tx = -26, tz = 152;
    C.cyl(tx, 44, tz, 2.1, 88, PALETTE.stone, 0, 0, 0, 8);
    C.cyl(tx, 82, tz, 6.4, 6.0, PALETTE.brassTrim, 0, 0, 0, 8);
    C.cyl(tx, 85.6, tz, 5.2, 2.0, PALETTE.goldDark, 0, 0, 0, 8);
    C.cyl(tx, 78.4, tz, 5.0, 1.4, PALETTE.stoneDark, 0, 0, 0, 8);
    quayPush9(mast, tx, 100, tz, 0, 0, 0, 0.7, 26, 0.7);
  }
  quayInstance(root, quayG.box, PALETTE.glass, win, false, false);
  quayInstance(root, quayG.box, PALETTE.stoneDark, winDk, false, false);
  quayInstance(root, quayG.cyl4, PALETTE.metal, mast, false, false);

  const m = new THREE.Mesh(C.build(), quayVC());
  m.castShadow = false;      // a 100 m tower in the shadow frustum costs the map
  m.receiveShadow = false;
  m.frustumCulled = false;
  root.add(m);
}

// =================================================================== BRIDGE ==
// Decorative and enormous — the arch is the gate of the voyage. The ARCH needs
// no collider: the deck stands 22 m over the water and nothing in this game can
// reach it. THE PYLONS DO, and did not have one. Each is eight and a half metres
// by twelve and a half of sandstone standing in the fairway a hundred and thirty
// metres apart, which makes them the two most obvious solid objects between the
// berth and the Heads — and the ferry drove through both of them.
function quayBuildBridge(game, root) {
  const B = quayMerger();
  const cx = quayBRIDGE.x, cz = quayBRIDGE.z, S = quayBRIDGE.span, D = quayBRIDGE.deck;
  const H = quayBRIDGE.arch, yaw = quayBRIDGE.yaw;
  const cs = Math.cos(yaw), sn = Math.sin(yaw);
  function place(u, y, v, sx, sy, sz, color, rz) {
    B.box(cx + u * cs + v * sn, y, cz - u * sn + v * cs, sx, sy, sz, color, 0, yaw, rz || 0);
  }
  // the arch: chords top and bottom, in segments
  const N = 16;
  for (let i = 0; i < N; i++) {
    const t0 = i / N, t1 = (i + 1) / N;
    const u0 = (t0 - 0.5) * S, u1 = (t1 - 0.5) * S;
    const y0 = D + Math.sin(t0 * Math.PI) * H, y1 = D + Math.sin(t1 * Math.PI) * H;
    const um = (u0 + u1) * 0.5, ym = (y0 + y1) * 0.5;
    const len = Math.hypot(u1 - u0, y1 - y0);
    const ang = Math.atan2(y1 - y0, u1 - u0);
    place(um, ym, 0, len, 1.5, 5.4, PALETTE.bridge, ang);
    // lower chord
    const l0 = D + Math.sin(t0 * Math.PI) * H * 0.42, l1 = D + Math.sin(t1 * Math.PI) * H * 0.42;
    const lm = (l0 + l1) * 0.5;
    const lang = Math.atan2(l1 - l0, u1 - u0);
    place(um, lm, 0, Math.hypot(u1 - u0, l1 - l0), 1.1, 4.6, PALETTE.bridge, lang);
    // web
    place(um, (ym + lm) * 0.5, 0, 0.7, ym - lm, 3.4, PALETTE.bridge);
    // hanger down to the deck
    if (ym > D + 2) place(um, (D + ym) * 0.5 - 1.5, 0, 0.42, ym - D, 0.42, PALETTE.bridge);
  }
  // deck + approach spans
  //
  // See quayABUT: the deck now runs from bluff to bluff instead of stopping
  // 25 m outboard of each pylon and hanging there over open water.
  //
  // ---- THE DECK IS DRAWN AND NOT SOLID, AND THAT IS CORRECT (X8) ---------
  // Deliberately checked, because thirty-eight cars and a three-carriage train
  // run along it and the last shelf item asked whether they should be colliders.
  // Measured (qa/px-bridge.js, qa/px-bridge5.js):
  //
  //   - the physics world holds NOTHING at deck height between u -150 and +150.
  //     Only the abutments answer, from |u| 168 out. Put the animal on the deck
  //     at u 0, 60 or 120 and it falls 26.4 m into the harbour and swims.
  //   - and it cannot get up there. Swimming at the landfall bluff, at a pylon
  //     and at an approach pier, from open water, on both keys, the highest it
  //     reaches against any of them is 2.20 m against a deck at 25. It is never
  //     grounded and never stops swimming: every face is sheer from the water.
  //   - this chapter publishes no `climbHold`. Only Hong Kong, Cappadocia and
  //     Son Doong do, so there is no climb verb here to find a way up with.
  //
  // So by the rule the moorings were done under — collide what a player can
  // reach — the deck needs no floor and the traffic needs no bodies.
  //
  // IF THAT EVER CHANGES, THIS IS THE FIRST THING THAT BREAKS. A bluff that
  // becomes climbable turns 300 m of drawn carriageway into a hole with cars
  // driving through it. Re-run qa/px-bridge5.js before adding any way up.
  const APPROACH = [105, 139];             // viaduct piers along the deck, per side
  const DECK_HALF = quayDECK_HALF;
  place(0, D - 1.4, 0, DECK_HALF * 2, 1.5, 12.0, PALETTE.stoneDark);
  place(0, D - 0.3, 0, DECK_HALF * 2, 0.7, 12.8, PALETTE.bridge);
  // pylons
  for (let s = -1; s <= 1; s += 2) {
    // The shaft runs the whole way to the underside of the cap. It used to stop
    // at y = 33 while the cap sat at 37.0, so every pylon wore its capital four
    // metres above its own head with harbour sky in the gap.
    place(s * (S * 0.5 + 5), (D + 12.0) * 0.5, 0, 8.5, D + 12.0, 12.5, PALETTE.sandstone);
    place(s * (S * 0.5 + 5), D + 12.6, 0, 9.4, 1.2, 13.4, PALETTE.sandstoneDark);
    // A FOOTING, because the drawn pylon stops at y = 0 and the harbour is at
    // -0.5: both of them were standing half a metre clear of the water they are
    // supposed to be founded in.
    place(s * (S * 0.5 + 5), -1.4, 0, 10.6, 3.0, 14.6, PALETTE.sandstoneDark);
    const u = s * (S * 0.5 + 5);
    quayPYLON.push({ x: cx + u * cs, z: cz - u * sn, hx: 5.3, hz: 7.3, ry: yaw });
  }
  // approach piers. Footing at the water, shaft, cap under the deck soffit —
  // the same three courses as a pylon at two thirds the size, so the viaduct
  // reads as the same structure getting smaller rather than as a second one.
  // Solid, and in quayHARD, for the reason the pylons are: they stand in
  // navigable water and the ferry would otherwise sail through all eight.
  for (let s = -1; s <= 1; s += 2) {
    for (let i = 0; i < APPROACH.length; i++) {
      const u = s * APPROACH[i];
      place(u, 11.2, 0, 5.0, 22.4, 9.0, PALETTE.sandstone);        // shaft: water to soffit
      place(u, 22.15, 0, 6.2, 1.4, 10.2, PALETTE.sandstoneDark);   // cap, up against D - 2.15
      place(u, -1.4, 0, 6.6, 3.0, 10.6, PALETTE.sandstoneDark);    // footing, in the water
      const px = cx + u * cs, pz = cz - u * sn;
      quayStaticBox(game, px, 10.0, pz, 3.3, 12.0, 5.3, yaw);
      quayHARD.push({ x: px, z: pz, r: 6.4 + quayBOAT_HX, name: 'pier' });
    }
  }
  // ...and the abutment the deck actually ends on. A block of sandstone wider
  // than the deck and taller than its parapet, buried in the bluff that
  // quayBuildLand puts around it, so the end face of the deck is never drawn
  // against sky however the bluff's own crown happens to fall.
  for (let s = -1; s <= 1; s += 2) {
    const u = s * (DECK_HALF - 11);
    place(u, 11.8, 0, 22.0, 27.6, 22.0, PALETTE.sandstone);
    place(u, 25.9, 0, 23.0, 1.2, 23.0, PALETTE.sandstoneDark);
    const ax = cx + u * cs, az = cz - u * sn;
    quayStaticBox(game, ax, 11.8, az, 11.0, 13.8, 11.0, yaw);
    quayHARD.push({ x: ax, z: az, r: 13.5 + quayBOAT_HX, name: 'abutment' });
  }
  // solid, and the hull is turned away from them by quayShore()
  for (let i = 0; i < quayPYLON.length; i++) {
    const p = quayPYLON[i];
    quayStaticBox(game, p.x, D * 0.5 + 2, p.z, p.hx, D * 0.5 + 4.5, p.hz, p.ry);
    quayHARD.push({ x: p.x, z: p.z, r: 8.4 + quayBOAT_HX, name: 'pylon' });
  }
  const m = new THREE.Mesh(B.build(), quayVC());
  m.castShadow = false;      // a 34 m arch in the shadow frustum costs more than it gives
  m.receiveShadow = false;
  m.frustumCulled = false;
  root.add(m);
}

// ================================================================ HEADLANDS ==
/**
 * A headland is a sandstone bluff with a scrubby top. Built as a ring of
 * radial prisms: cheap, chunky, and it silhouettes correctly from the water,
 * which is the only angle anybody will ever see it from.
 */
function quayHeadland(M, cx, cz, r, h, seed, cliff, scrub, cf, shadeIn) {
  const shade = shadeIn || (cliff === PALETTE.cliffRock ? PALETTE.cliffShade : PALETTE.sandstoneDark);
  // Registered as it is drawn, so a headland cannot be added to the picture
  // without also being added to the world. See quayHEADS.
  // cf 0.70: the octagon's flats land at 0.70 r and its points at 1.02 r, and
  // the drawn 11-gon's own radii run 0.68 r to 1.18 r — so the solid part
  // averages a little inside the silhouette, which is what you want (a nose
  // into a cove is fine; swimming through the headland is not). 0.62 left up to
  // twelve metres of Bradleys Head you could still get inside.
  quayHEADS.push({ x: cx, z: cz, r: r, h: h, cf: cf === undefined ? 0.70 : cf });
  const N = 11;
  let s = seed;
  function rnd() { s = (s * 9301 + 49297) % 233280; return s / 233280; }
  const rr = [], hh = [];
  for (let i = 0; i < N; i++) { rr.push(r * (0.68 + rnd() * 0.5)); hh.push(h * (0.55 + rnd() * 0.6)); }
  // sea-level base ring -> cliff top ring -> a rounded scrub cap
  // HAWKESBURY SANDSTONE IS STRATIFIED AND THIS WAS ONE FLAT VALUE.
  //
  // A cliff drawn as a single band from the water to the top is the same miss
  // as the apron before it got its paving joints: at the scale this chapter is
  // seen at, twenty-one metres of unbroken cliffRock has nothing in it for the
  // eye to measure against, and there are thirteen of them filling both banks
  // of the fairway. Four courses, each stepped in a few centimetres from the
  // one below and alternating between the rock colour and its shade, and the
  // headland acquires a height. It costs three extra rings of vertices.
  const COURSE = 4;
  const rings = [];
  for (let c = 0; c <= COURSE; c++) {
    const t = c / COURSE;
    const row = [];
    for (let i = 0; i < N; i++) {
      const a = i / N * Math.PI * 2;
      // each course sits a little inside the one below, so the face has an
      // overhang line at every band rather than being a smooth batter
      const k = 1 - t * 0.10 - (c % 2) * 0.022;
      const x = cx + Math.cos(a) * rr[i] * k, z = cz + Math.sin(a) * rr[i] * k;
      const y = lerp(quayWATER_Y - 1.5, hh[i], t);
      row.push(M.vert(x, y, z, c % 2 ? cliff : (c === 0 ? PALETTE.cliffShade : shade)));
    }
    rings.push(row);
  }
  const base = rings[0], top = rings[COURSE];
  const cap = [];
  for (let i = 0; i < N; i++) {
    const a = i / N * Math.PI * 2;
    const x = cx + Math.cos(a) * rr[i] * 0.90, z = cz + Math.sin(a) * rr[i] * 0.90;
    cap.push(M.vert(cx + (x - cx) * 0.80, hh[i] + h * 0.22, cz + (z - cz) * 0.80, scrub));
  }
  const peak = M.vert(cx, h * 1.20, cz, scrub);
  for (let c = 0; c < COURSE; c++) {
    const lo = rings[c], hi = rings[c + 1];
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      M.tri(lo[i], hi[i], hi[j]); M.tri(lo[i], hi[j], lo[j]);
    }
  }
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    M.tri(top[i], cap[i], cap[j]);  M.tri(top[i], cap[j], top[j]);
    M.tri(cap[i], peak, cap[j]);
  }
  void base;
}

// ---- ROADMAP-WOW2 V3, THE FAR PLANE: THE KIRRIBILLI ROOFS ------------------
// This chapter's far plane was the first one built: thirteen headlands out to
// Manly, Fort Denison, Shark Island, the Freshwater on her run to the Heads,
// six yachts on their reaches and the gulls over the buoys — nothing to add
// out there. What the bridge landed on was bare bluff. Where the Harbour
// Bridge comes ashore on the north side is Kirribilli, and Kirribilli is a
// roofline: terraces and a tower or two on the bluff, seen from the water
// under the deck. Fourteen little gables on the western abutment's cap
// (the arrival lens rests WNW, at that bluff, with the bridge across the
// bow), each standing on its own base at the bluff's height, in a roof tone
// pulled toward the harbour haze. 195 m under a 240–1250 m haze (never
// re-based) is inside the clear air — a skyline, not a silhouette. No
// mover: the ferry, the fleet and the gulls already cross the arrival frame.
function quayBuildFar(root) {
  const tone = farTone(PALETTE.caliRoof, PALETTE.harbourHaze, 0.35);
  const cs = Math.cos(quayBRIDGE.yaw), sn = Math.sin(quayBRIDGE.yaw);
  const ax = quayBRIDGE.x - quayABUT.u * cs, az = quayBRIDGE.z + quayABUT.u * sn;
  const top = quayABUT.h * 1.05;
  const wedges = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.3;
    const r = 10 + (i % 3) * 8;
    const h = 4 + (i % 4) * 1.4;
    wedges.push({ x: ax + Math.cos(a) * r, z: az + Math.sin(a) * r * 0.8, w: 9 + (i % 3) * 3, d: 7,
                  yaw: a + 0.6 * (i % 2), y: top, y0: top - 2.5, profile: [[-1, 0], [0, h], [1, 0]] });
  }
  // and one block of flats over the lot, the way there is
  wedges.push({ x: ax - 6, z: az + 10, w: 14, d: 12, yaw: 0.4, y: top, y0: top - 2.5,
                profile: [[-1, 0], [-0.9, 12], [0.9, 12], [1, 0]] });
  quayFar = farBundle({
    name: 'quay',
    layer: farLayer({ name: 'far-quay', color: tone, wedges }),
  });
  root.add(quayFar.group);
}

function quayBuildLand(game, root) {
  const L = quayMerger();

  // --- the shores that box the fairway in --------------------------------
  quayHeadland(L, quayBRAD.x, quayBRAD.z, quayBRAD.r, 21, 11, PALETTE.cliffRock, PALETTE.headScrub);
  quayHeadland(L, quayBRAD.x - 54, quayBRAD.z - 40, 46, 26, 29, PALETTE.cliffShade, PALETTE.headScrubDk);
  quayHeadland(L, quayMIDDLE.x, quayMIDDLE.z, quayMIDDLE.r, 30, 47, PALETTE.cliffRock, PALETTE.headScrub);
  quayHeadland(L, quayMIDDLE.x - 70, quayMIDDLE.z - 90, 74, 34, 71, PALETTE.cliffShade, PALETTE.headScrubDk);
  quayHeadland(L, quayNORTH.x, quayNORTH.z, quayNORTH.r, 44, 97, PALETTE.cliffRock, PALETTE.headScrub);
  quayHeadland(L, quayNORTH.x + 70, quayNORTH.z - 70, 70, 40, 113, PALETTE.cliffShade, PALETTE.headScrubDk);
  // the eastern shore of the harbour, so the fairway has two banks
  quayHeadland(L, 210, -180, 74, 20, 131, PALETTE.cliffShade, PALETTE.headScrubDk);
  quayHeadland(L, 240, -320, 66, 24, 149, PALETTE.cliffRock, PALETTE.headScrub);
  quayHeadland(L, -150, -130, 62, 17, 167, PALETTE.cliffShade, PALETTE.headScrubDk);

  // --- the two the bridge lands on ----------------------------------------
  // Dawes Point and Milsons Point, in effect. They are placed off quayBRIDGE
  // rather than written out as coordinates so they cannot drift away from the
  // thing they exist to carry, and both are close enough to the shore already
  // there (x -150 west, x 210 east) to merge with it — a bluff with a bridge
  // landing on it, not an island with a bridge sitting on it. See quayABUT.
  for (let s = -1; s <= 1; s += 2) {
    const u = s * quayABUT.u;
    const cs = Math.cos(quayBRIDGE.yaw), sn = Math.sin(quayBRIDGE.yaw);
    quayHeadland(L, quayBRIDGE.x + u * cs, quayBRIDGE.z - u * sn,
                 quayABUT.r, quayABUT.h, s < 0 ? 239 : 251,
                 PALETTE.cliffShade, PALETTE.headScrubDk);
  }

  // --- Fort Denison: a martello tower on a rock ---------------------------
  L.cyl(quayFORT.x, quayWATER_Y + 1.1, quayFORT.z, quayFORT.r, 3.4, PALETTE.cliffRock, 0, 0, 0, 8);
  // the rock, the gun platform and the tower, in that order
  // ...and the tops of both of these agree with the DRAWN slab at
  // quayWATER_Y + 3.3, which they did not: the rock stopped half a metre and
  // the gun platform three tenths below the flagstones you can see.
  quayStaticBox(game, quayFORT.x, quayWATER_Y - 0.1, quayFORT.z,
                quayFORT.r * 0.86, 3.4, quayFORT.r * 0.86);
  quayStaticBox(game, quayFORT.x, quayWATER_Y + 2.8, quayFORT.z, 7.5, 0.5, 7.5);
  quayStaticBox(game, quayFORT.x - 2, quayWATER_Y + 6.6, quayFORT.z, 4.1, 3.9, 4.1);
  quayStaticBox(game, quayFORT.x + 4.5, quayWATER_Y + 4.6, quayFORT.z + 1.5, 2.5, 1.3, 3.5);
  L.box(quayFORT.x, quayWATER_Y + 2.9, quayFORT.z, 15, 0.8, 15, PALETTE.stone);
  L.cyl(quayFORT.x - 2, quayWATER_Y + 6.4, quayFORT.z, 4.1, 7.0, PALETTE.sandstone, 0, 0, 0, 8);
  L.cyl(quayFORT.x - 2, quayWATER_Y + 10.2, quayFORT.z, 4.6, 0.8, PALETTE.sandstoneDark, 0, 0, 0, 8);
  L.box(quayFORT.x + 4.5, quayWATER_Y + 4.6, quayFORT.z + 1.5, 5, 2.6, 7, PALETTE.sandstone);

  // --- Shark Island: low, green, one pine ---------------------------------
  L.cyl(quaySHARK.x, quayWATER_Y + 0.9, quaySHARK.z, quaySHARK.r, 3.0, PALETTE.cliffRock, 0, 0, 0, 8);
  L.sph(quaySHARK.x, quayWATER_Y + 2.6, quaySHARK.z, quaySHARK.r * 0.78, 2.4, quaySHARK.r * 0.7, PALETTE.headScrub);
  quayStaticBox(game, quaySHARK.x, quayWATER_Y - 0.6, quaySHARK.z,
                quaySHARK.r * 0.86, 3.0, quaySHARK.r * 0.86);

  // --- Manly: a beach, a wharf, the Corso ---------------------------------
  const mx = quayMANLY.x, mz = quayMANLY.z;
  // The town needs something BEHIND it. Without a rise the sand slab sits on
  // the sea with sky above it and the whole destination reads as a raft: you
  // have sailed seven hundred metres to arrive at a table. Two bluffs flanking
  // the cove and a wooded ridge behind the Corso close the picture.
  quayHeadland(L, mx - 74, mz - 16, 30, 15, 181, PALETTE.cliffRock, PALETTE.headScrub);
  quayHeadland(L, mx + 74, mz - 16, 32, 17, 199, PALETTE.cliffRock, PALETTE.headScrub);
  // The two behind the Corso carry a tighter collision fraction: the last row
  // of shops is built up against them, and a bluff that reached its own drawn
  // radius would put a cliff through the back wall of a fish shop.
  quayHeadland(L, mx - 26, mz - 96, 54, 22, 211, PALETTE.cliffShade, PALETTE.headScrubDk, 0.50);
  quayHeadland(L, mx + 34, mz - 104, 58, 26, 223, PALETTE.cliffShade, PALETTE.headScrubDk, 0.50);
  // the cove floor and the sand
  L.box(mx, quayWATER_Y + 0.35, mz - 46, 150, 1.2, 84, PALETTE.manlySand);
  L.box(mx, quayWATER_Y + 0.95, mz - 20, 96, 0.35, 26, PALETTE.sand);
  // TWO SHELVES, BECAUSE TWO ARE DRAWN. One collider at quayWATER_Y + 1.25 was
  // holding the animal thirty centimetres over the cove floor and twelve over
  // the dry sand above it — the whole town is walked on at the wrong height,
  // which is the same half-metre-inside-the-flagstones miss as Fort Denison and
  // reads as the capybara hovering over its own shadow.
  quayStaticBox(game, mx, quayWATER_Y + 0.15, mz - 46, 75, 0.80, 42);
  quayStaticBox(game, mx, quayWATER_Y + 0.55, mz - 20, 48, 0.57, 13);
  // the wharf itself — a long timber deck out into the cove, the arrival berth
  L.box(mx, quayWATER_Y + 1.35, mz + 12, 17, 0.35, 34, PALETTE.wood);
  L.box(mx, quayWATER_Y + 1.55, mz + 12, 17.8, 0.12, 34.8, PALETTE.woodDark);
  // ...and the collider's top is the DECK CAP at 1.61, not the planking at 1.50.
  // Eleven centimetres is exactly the amount of hover that reads as the animal
  // standing beside its own shadow.
  quayStaticBox(game, mx, quayWATER_Y + 1.31, mz + 12, 8.5, 0.30, 17);
  for (let i = 0; i < 7; i++) {
    for (let s = -1; s <= 1; s += 2) {
      L.cyl(mx + s * 8.6, quayWATER_Y - 0.2, mz - 3 + i * 5, 0.34, 3.6, PALETTE.woodDark);
    }
  }
  // ---- AND THE WHARF HAS THINGS ON IT -------------------------------------
  // This is where the voyage ENDS: thirty-four metres of bare timber deck with
  // one shed on it, and the last shot of the chapter looks straight down it.
  // Bollards to throw the line to (the heaving line in quayUpdateLine goes to
  // one of these), a rail down each side, a bench, and the ranked mooring
  // cleats. It is also the difference between a jetty and a berth.
  for (let i = 0; i < 6; i++) {
    const bz = mz - 1 + i * 5.4;
    for (let s = -1; s <= 1; s += 2) {
      L.cyl(mx + s * 8.0, quayWATER_Y + 2.02, bz, 0.30, 0.90, PALETTE.wharfIron, 0, 0, 0, 6);
      L.sph(mx + s * 8.0, quayWATER_Y + 2.50, bz, 0.34, 0.20, 0.34, PALETTE.stoneDark);
    }
  }
  for (let s = -1; s <= 1; s += 2) {
    // the rail down the outer edge, which is the thing that says "walk here"
    L.box(mx + s * 8.55, quayWATER_Y + 2.55, mz + 12, 0.12, 0.10, 32, PALETTE.wharfIron);
    L.box(mx + s * 8.55, quayWATER_Y + 2.15, mz + 12, 0.10, 0.08, 32, PALETTE.wharfIron);
    for (let i = 0; i < 9; i++) {
      L.box(mx + s * 8.55, quayWATER_Y + 2.15, mz - 2 + i * 3.6, 0.12, 0.90, 0.12,
            PALETTE.wharfIron);
    }
  }
  // a bench, a bin and a life ring on a post — the whole vocabulary of a wharf
  L.box(mx + 5.4, quayWATER_Y + 2.05, mz + 4, 0.55, 0.12, 2.6, PALETTE.deckTeak);
  L.box(mx + 5.9, quayWATER_Y + 2.35, mz + 4, 0.10, 0.55, 2.6, PALETTE.deckTeak, 0, 0, 0.18);
  L.cyl(mx - 5.4, quayWATER_Y + 2.10, mz + 2, 0.34, 0.85, PALETTE.wharfIron, 0, 0, 0, 8);
  L.cyl(mx - 6.2, quayWATER_Y + 2.60, mz + 20, 0.09, 1.9, PALETTE.wharfIron, 0, 0, 0, 6);
  L.cyl(mx - 6.2, quayWATER_Y + 3.35, mz + 20, 0.44, 0.14, PALETTE.hullRed, Math.PI / 2, 0, 0, 8);
  L.cyl(mx - 6.2, quayWATER_Y + 3.35, mz + 20.02, 0.28, 0.18, PALETTE.sail, Math.PI / 2, 0, 0, 8);
  // and coils of rope, because there is always rope
  for (let i = 0; i < 4; i++) {
    L.cyl(mx + 6.6 - i * 0.2, quayWATER_Y + 1.75 + i * 0.09, mz + 17 + (i % 2) * 1.6,
          0.42 - i * 0.05, 0.16, PALETTE.iceRope, 0, i, 0, 8);
  }

  // ---- the wharf shed -----------------------------------------------------
  // THE FIRST THING YOU SEE AFTER SEVENTY SECONDS OF OPEN WATER, and it was two
  // flat slabs: a sixteen-by-twenty-metre white plate lying on four posts,
  // filling the middle of the arrival shot with nothing. A wharf shed on this
  // harbour is a gabled thing in green and cream with the name of the place
  // across the end of it in letters you can read from the fairway, and that is
  // what the last shot of the passage should be looking at.
  for (let s = -1; s <= 1; s += 2) {
    for (let t = -1; t <= 1; t += 2) {
      L.box(mx + s * 6.4, quayWATER_Y + 3.3, mz + 14 + t * 8, 0.3, 3.6, 0.3, PALETTE.wharfIron);
    }
    // the side walls, so it is a building and not a canopy
    L.box(mx + s * 6.9, quayWATER_Y + 3.6, mz + 14, 0.34, 3.2, 19.0, PALETTE.hullCream);
    L.box(mx + s * 6.9, quayWATER_Y + 4.4, mz + 14, 0.40, 0.36, 19.4, PALETTE.hullGreen);
  }
  // THE GABLE IS TWO TILTED PLANES, NOT A ZIGGURAT. Stepped courses were tried
  // first and they read as concentric stripes from the only camera angle this
  // game has — forty-one degrees down is very nearly a plan view of a roof.
  // Two slabs pitched about the ridge is one box each and it is unambiguous.
  const PITCH = Math.atan2(2.3, 7.8);
  for (let s = -1; s <= 1; s += 2) {
    L.box(mx + s * 3.9, quayWATER_Y + 6.40, mz + 14, 8.5, 0.42, 20.4,
          PALETTE.hullGreen, 0, 0, -s * PITCH);
    // the eave, standing proud, so the roof has an edge and throws a line
    L.box(mx + s * 7.6, quayWATER_Y + 5.32, mz + 14, 1.5, 0.30, 20.8,
          PALETTE.hullCream, 0, 0, -s * PITCH);
  }
  L.box(mx, quayWATER_Y + 7.62, mz + 14, 1.2, 0.34, 20.8, PALETTE.hullCream);
  // the end gable, facing the fairway, with a board across it
  L.box(mx, quayWATER_Y + 5.9, mz + 24.1, 12.4, 2.4, 0.34, PALETTE.hullCream);
  L.box(mx, quayWATER_Y + 5.55, mz + 23.9, 9.2, 1.05, 0.20, PALETTE.hullGreen);
  for (let i = 0; i < 5; i++) {
    L.box(mx - 3.4 + i * 1.7, quayWATER_Y + 5.55, mz + 23.75, 0.9, 0.62, 0.12, PALETTE.hullCream);
  }
  // ...and the clock every ferry wharf in Sydney has on that gable
  L.cyl(mx - 4.9, quayWATER_Y + 6.95, mz + 24.0, 0.85, 0.22, PALETTE.hullCream, Math.PI / 2, 0, 0, 8);
  L.cyl(mx - 4.9, quayWATER_Y + 6.95, mz + 24.15, 0.62, 0.10, PALETTE.sail, Math.PI / 2, 0, 0, 8);
  L.box(mx - 4.9, quayWATER_Y + 7.2, mz + 24.22, 0.09, 0.46, 0.06, PALETTE.wharfIron);
  L.box(mx - 4.6, quayWATER_Y + 6.95, mz + 24.22, 0.34, 0.08, 0.06, PALETTE.wharfIron);
  // ---- THE CORSO ----------------------------------------------------------
  // Fourteen identical cream boxes with a flat red lid on each, in two rows,
  // with a Norfolk pine growing up through six of them: that was the town you
  // sail seven hundred metres to reach, and it is the last two minutes of the
  // chapter. A shop is a FRONT — a verandah on posts, glazing under it, a door,
  // a sign band, and a parapet with a name on it — and no two of them are the
  // same height, because that is the only thing that turns a row of buildings
  // into a street.
  const MSHOP = [PALETTE.manShopA, PALETTE.manShopB, PALETTE.manShopC,
                 PALETTE.hullCream, PALETTE.adobeWall];
  const MAWN = [PALETTE.manAwning, PALETTE.manAwning2, PALETTE.awningManly,
                PALETTE.hullGreen, PALETTE.cloth2];
  for (let i = 0; i < 7; i++) {
    const z = mz - 12 - i * 9;
    for (let s = -1; s <= 1; s += 2) {
      const x = mx + s * 15;
      const k = (i * 2 + (s > 0 ? 1 : 0));
      const h = 4.6 + ((k * 7) % 5) * 0.55;                 // 4.6 .. 6.8
      const wall = MSHOP[k % MSHOP.length];
      const awn = MAWN[(k * 3) % MAWN.length];
      const yb = quayWATER_Y + 0.95;                        // the cove floor
      L.box(x, yb + h * 0.5, z, 12, h, 7.4, wall);
      // the parapet, which is the whole reason an Australian shop row has a
      // skyline: a wall standing above the roof with the name written on it
      L.box(x, yb + h + 0.62, z - s * 0.1, 12.4, 1.24, 7.0, wall);
      L.box(x, yb + h + 1.30, z - s * 0.1, 12.9, 0.24, 7.4, PALETTE.stone);
      L.box(x - s * 6.3, yb + h + 0.70, z, 0.22, 0.80, 5.6, PALETTE.hullGreen);
      L.box(x, yb + h + 0.02, z, 12.2, 0.30, 7.8, PALETTE.roofTileDark);
      // the shopfront: glazing, a door and a stall-riser, facing the Corso
      const fx = x - s * 6.3;
      L.box(fx, yb + 1.55, z, 0.26, 2.30, 6.2, PALETTE.glass);
      L.box(fx - s * 0.06, yb + 0.30, z, 0.30, 0.60, 6.4, PALETTE.deckTeakDark);
      L.box(fx - s * 0.10, yb + 1.20, z + 2.3, 0.34, 2.40, 1.2, wall);
      L.box(fx - s * 0.10, yb + 2.55, z, 0.34, 0.50, 6.6, awn);
      // the verandah: an awning on two posts over the footpath, which is what
      // every street in this country has and what none of these had
      L.box(fx - s * 1.5, yb + 3.05, z, 3.4, 0.20, 7.2, awn, 0, 0, s * 0.16);
      L.box(fx - s * 3.1, yb + 2.82, z, 0.36, 0.28, 7.3, PALETTE.stone);
      for (let p = -1; p <= 1; p += 2) {
        L.cyl(fx - s * 3.0, yb + 1.45, z + p * 3.0, 0.11, 2.90, PALETTE.stone, 0, 0, 0, 6);
      }
      // THE BACK OF A SHOP IS WHAT YOU ARRIVE AT. The whole of the detail above
      // faces the Corso, and the Corso runs away from the water — so the last
      // ninety seconds of the chapter is spent looking at fourteen blank
      // rectangles. Two windows, a service door and a stair rail on the seaward
      // face is nothing at all and it is the difference between a town and the
      // back of a set.
      const rx = x + s * 6.1;
      for (let w = -1; w <= 1; w += 2) {
        L.box(rx, yb + h * 0.62, z + w * 2.2, 0.20, 1.30, 1.50, PALETTE.glass);
        L.box(rx + s * 0.06, yb + h * 0.62 + 0.78, z + w * 2.2, 0.26, 0.24, 1.80,
              PALETTE.stone);
      }
      L.box(rx, yb + 1.05, z - s * 2.4, 0.22, 2.10, 1.05, PALETTE.deckTeakDark);
      L.box(rx + s * 0.22, yb + 1.30, z + 1.1, 0.60, 0.10, 4.4, PALETTE.wharfIron);
      L.box(rx + s * 0.45, yb + 0.65, z + 1.1, 0.10, 1.30, 0.10, PALETTE.wharfIron);
      // ...and the SEAWARD gable, which is the face the boat arrives at. Only
      // the first two in each row are ever in that shot, so only they get it.
      if (i < 2) {
        const gz = z + 3.75;
        for (let w = -1; w <= 1; w++) {
          L.box(x + w * 3.4, yb + h * 0.62, gz, 1.9, 1.35, 0.22, PALETTE.glass);
          L.box(x + w * 3.4, yb + h * 0.62 + 0.80, gz + 0.05, 2.3, 0.26, 0.30, PALETTE.stone);
        }
        L.box(x, yb + 1.30, gz, 11.6, 0.55, 0.30, MAWN[(k * 3 + 2) % MAWN.length]);
        L.box(x, yb + h + 0.62, gz - 0.1, 11.6, 1.10, 0.26, PALETTE.stone);
      }
      quayStaticBox(game, x, yb + h * 0.5, z, 6, h * 0.5, 3.7);
    }
  }
  // the chip shop, at the head of the Corso, unmistakable
  {
    const yb = quayWATER_Y + 0.95;
    L.box(mx, yb + 2.6, mz - 30, 11, 5.2, 8.0, PALETTE.hullCream);
    L.box(mx, yb + 5.55, mz - 30, 11.8, 0.7, 8.8, PALETTE.buoyRed);
    L.box(mx, yb + 6.15, mz - 30, 12.2, 0.5, 9.2, PALETTE.hullCream);
    L.box(mx, yb + 3.55, mz - 26.1, 7.6, 1.5, 0.34, PALETTE.awningManly);
    L.box(mx, yb + 2.40, mz - 26.05, 8.4, 1.70, 0.24, PALETTE.glass);
    L.box(mx, yb + 1.30, mz - 26.10, 8.8, 0.60, 0.34, PALETTE.deckTeakDark);
    // the awning over the counter, on two posts — the counter itself is at
    // quayCHIPS and it is the thing the whole set piece happens at
    L.box(mx + 2.6, yb + 3.05, mz - 27.6, 8.4, 0.22, 3.4, PALETTE.awningManly, -0.14, 0, 0);
    for (let p = -1; p <= 1; p += 2) {
      L.cyl(mx + 2.6 + p * 3.6, yb + 1.60, mz - 29.1, 0.11, 3.2, PALETTE.stone, 0, 0, 0, 6);
    }
    quayStaticBox(game, mx, yb + 2.6, mz - 30, 5.5, 2.6, 4.0);
  }
  // ---- and the beach, which is the other half of what Manly is -------------
  {
    const sy = quayWATER_Y + 1.125;      // the top of the dry sand
    // the lifeguard tower, on the sand, facing the water: the one tall pale
    // object in the arrival shot that is not a building
    const tx = mx - 34, tz = mz - 17;
    for (let a = -1; a <= 1; a += 2) for (let b = -1; b <= 1; b += 2) {
      L.box(tx + a * 1.5, sy + 1.5, tz + b * 1.5, 0.24, 3.0, 0.24, PALETTE.manTower);
    }
    L.box(tx, sy + 3.15, tz, 4.2, 0.30, 4.2, PALETTE.manTower);
    L.box(tx, sy + 3.95, tz, 3.6, 1.40, 3.6, PALETTE.manTower);
    L.box(tx, sy + 4.10, tz - 1.75, 3.4, 1.00, 0.20, PALETTE.glass);
    L.box(tx, sy + 4.80, tz, 4.6, 0.28, 4.6, PALETTE.manClubRoof);
    L.box(tx, sy + 2.30, tz + 1.9, 1.6, 1.90, 0.18, PALETTE.manTower, 0.55, 0, 0);
    quayStaticBox(game, tx, sy + 3.9, tz, 1.9, 1.0, 1.9);
    // the red-and-yellow flags, which is the only place in Australia you are
    // allowed to be
    for (let f = -1; f <= 1; f += 2) {
      const fx2 = mx - 34 + f * 13;
      L.cyl(fx2, sy + 1.6, mz - 9.5, 0.07, 3.2, PALETTE.manPole, 0, 0, 0, 6);
      L.box(fx2 + 0.62, sy + 2.75, mz - 9.5, 1.24, 0.42, 0.05, PALETTE.manFlagRed);
      L.box(fx2 + 0.62, sy + 2.32, mz - 9.5, 1.24, 0.42, 0.05, PALETTE.manFlagYel);
    }
    // the surf club, up the beach behind the flags
    L.box(mx - 52, sy + 2.6, mz - 24, 18, 5.2, 11, PALETTE.manClub);
    L.box(mx - 52, sy + 5.45, mz - 24, 18.8, 0.5, 11.8, PALETTE.manClubRoof);
    L.box(mx - 52, sy + 3.9, mz - 29.4, 18.4, 0.55, 0.4, PALETTE.manClubTrim);
    L.box(mx - 52, sy + 1.9, mz - 29.6, 13.0, 2.2, 0.26, PALETTE.glass);
    L.box(mx - 52, sy + 6.15, mz - 24, 4.4, 0.9, 4.4, PALETTE.manClub);
    quayStaticBox(game, mx - 52, sy + 2.6, mz - 24, 9, 2.6, 5.5);
    // a surfboat on its cradle outside it, absurdly long, as they are
    L.box(mx - 40, sy + 0.62, mz - 26, 1.5, 0.72, 9.2, PALETTE.manBoat);
    L.box(mx - 40, sy + 1.00, mz - 26, 1.1, 0.16, 8.6, PALETTE.manBoatTrim);
    for (let e = -1; e <= 1; e += 2) {
      L.box(mx - 40, sy + 0.62, mz - 26 + e * 5.0, 0.7, 0.66, 1.6, PALETTE.manBoat);
    }
  }

  const m = new THREE.Mesh(L.build(), quayVC());
  m.castShadow = true;
  m.receiveShadow = true;
  m.frustumCulled = false;
  root.add(m);

  // --- AND NOW THEY ARE SOLID ---------------------------------------------
  // An octagon per bluff, as TWO boxes on one shared body: a square of half
  // extent a and the same square turned forty-five degrees. Their union reaches
  // a at the flats and a*sqrt(2) at the eight points, which is a fair match for
  // an 11-gon whose own radii wander by half as much again — and it is two
  // shapes rather than the hundred and fifty a tiled disc would need.
  //
  // Thirteen bluffs, twenty-six shapes, ONE body. The whole quayside is already
  // pooled this way (see quayPool) and for the same reason: a broadphase entry
  // per rock is most of a frame budget spent on scenery nobody touches.
  const H = quayPool();
  const q = new CANNON.Quaternion();
  q.setFromEuler(0, Math.PI / 4, 0);
  for (let i = 0; i < quayHEADS.length; i++) {
    const hd = quayHEADS[i];
    const a = hd.r * hd.cf;
    const y0 = quayWATER_Y - 1.5, y1 = hd.h;
    const cy = (y0 + y1) * 0.5, hy = (y1 - y0) * 0.5;
    H.addShape(new CANNON.Box(new CANNON.Vec3(a, hy, a)), new CANNON.Vec3(hd.x, cy, hd.z));
    H.addShape(new CANNON.Box(new CANNON.Vec3(a, hy, a)), new CANNON.Vec3(hd.x, cy, hd.z), q);
    // ---- AND THE TOP IS A DOME, NOT A TABLE ------------------------------
    // The cliff ring is only the SKIRT of a headland: above it the drawn mesh
    // carries a scrub cap to h*1.07 and a peak to h*1.20, and the collider
    // stopped dead at h. So the top fifth of every hill in the chapter was
    // drawn and not solid — at Bradleys Head, a collider ending at 21 under a
    // peak drawn to 25.2, four metres of hill with nothing in it. Two more
    // tiers, matched to the drawn cap and to what quayGroundY answers, and the
    // hill is a hill.
    //
    // ---- WHAT THIS NOTE USED TO CLAIM, AND WHY IT WAS WRONG (X8) ---------
    // It said Bradleys Head is "the one you can actually swim to: the animal
    // stands on the rim at 21 m with four metres of hill over its head". The
    // four metres is arithmetic and stands. The animal standing there does not:
    // a swimmer cannot get onto any headland in this chapter. Measured
    // (qa/px-bridge6.js) from all four sides on all four keys, at Bradleys Head
    // and at the bridge's landfall bluff, the highest it ever reaches is
    // 2.07-2.29 m, and it is never grounded and never stops swimming — every
    // face here is sheer from the water and Circular Quay publishes no
    // `climbHold`. The boat cannot land one either; quayShore turns the hull
    // away at a*1.16 + the half-beam, outside the collider.
    //
    // So that sentence was written from a probe that PUT the animal on the rim,
    // which is the mistake this project keeps paying for and paid for again in
    // X8: three versions of the bridge probe reported a 25 m climb, no water
    // anywhere, and a swim in the wrong direction before one of them was worth
    // a number. A reachability claim needs a leg that starts where the chapter
    // agrees there is water.
    //
    // The tiers stay regardless, for the reason at the top and not for the one
    // that was written down: a collider four metres short of its own drawing is
    // wrong whether or not anything is standing on it. Two things read this
    // hill without a passenger — quayGroundY answers through quayHeadTop, which
    // is built from the same quayHEAD_TIER table these shapes are, and
    // sysCamClear's occlusion ray tests the collider and never the drawing.
    for (let t = 0; t < quayHEAD_TIER.length; t++) {
      const ta = a * quayHEAD_TIER[t][0], ty = hd.h * quayHEAD_TIER[t][1];
      const tcy = (y0 + ty) * 0.5, thy = (ty - y0) * 0.5;
      H.addShape(new CANNON.Box(new CANNON.Vec3(ta, thy, ta)), new CANNON.Vec3(hd.x, tcy, hd.z));
      H.addShape(new CANNON.Box(new CANNON.Vec3(ta, thy, ta)), new CANNON.Vec3(hd.x, tcy, hd.z), q);
    }
    // ...and the hull is stopped analytically, because the boat is a KINEMATIC
    // body and a kinematic body is not stopped by a static one. See quayShore().
    quayHARD.push({ x: hd.x, z: hd.z, r: a * 1.16 + quayBOAT_HX, name: 'shore' });
  }
  quayPoolDone(game, H);
  quayHARD.push({ x: quayFORT.x, z: quayFORT.z, r: quayFORT.r * 0.9 + quayBOAT_HX, name: 'fort' });
  quayHARD.push({ x: quaySHARK.x, z: quaySHARK.z, r: quaySHARK.r * 0.9 + quayBOAT_HX, name: 'shark' });

  // --- Norfolk Island pines: the Manly skyline, in two instanced draws -----
  // A NORFOLK PINE IS PLANTED IN A ROW ON A PROMENADE, NOT IN A SHOP.
  //
  // The old layout ran 26 of them across a 120 m arc centred on z = mz - 26,
  // which is exactly where the Corso is: measured, six of the fourteen shops
  // had a pine trunk coming up through the middle of the roof, and it is the
  // very first thing in the arrival shot. They belong in two lines — one along
  // the beachfront in front of the town, and one down each side of the Corso
  // OUTSIDE the shop rows (which end at |x - mx| = 21).
  const trunks = [], tiers = [];
  const plantPine = (px, pz, h) => {
    quayPush9(trunks, px, quayWATER_Y + 0.9 + h * 0.5, pz, 0, 0, 0, 0.7, h, 0.7);
    for (let k = 0; k < 4; k++) {
      const t = k / 4;
      quayPush9(tiers, px, quayWATER_Y + 1.4 + h * (0.30 + t * 0.62), pz, 0, rand(0, 3), 0,
                (1 - t) * 5.2 + 1.6, h * 0.30, (1 - t) * 5.2 + 1.6);
    }
  };
  // the beachfront row, skipping the wharf approach in the middle
  // ...and the middle of that row is LEFT OUT, because the fifty metres either
  // side of the wharf head is the only sightline the arrival has: a solid rank
  // of twenty-metre pines across it hid the whole Corso from the one camera
  // angle the last ninety seconds of the chapter is played through.
  for (let i = 0; i < 16; i++) {
    const px = mx - 60 + i * 8.0;
    if (Math.abs(px - mx) < 27) continue;
    plantPine(px + rand(-0.8, 0.8), mz - 7.4 + rand(-1.0, 1.0), rand(14, 21));
  }
  // and two lines flanking the Corso, clear of the shops
  for (let i = 0; i < 7; i++) {
    for (let s = -1; s <= 1; s += 2) {
      plantPine(mx + s * (24 + rand(-1.2, 1.2)), mz - 14 - i * 9 + rand(-1.6, 1.6),
                rand(12, 18));
    }
  }
  // ...and a stand on the rise behind the town, which is what closes the picture
  for (let i = 0; i < 10; i++) {
    plantPine(mx - 46 + i * 10 + rand(-3, 3), mz - 74 + rand(-6, 6), rand(15, 22));
  }
  quayInstance(root, quayG.cyl6, PALETTE.manTrunk, trunks, true, false);
  quayInstance(root, quayG.cone6, PALETTE.manPine, tiers, true, false);

  // ---- the beach itself has people's things on it -------------------------
  const brolly = [[], [], []], brollyPole = [], towel = [[], [], [], []], board = [[], [], [], []];
  const TOWEL = [PALETTE.manTowelA, PALETTE.manTowelB, PALETTE.manTowelC, PALETTE.manTowelD];
  const BOARD = [PALETTE.manBoardA, PALETTE.manBoardB, PALETTE.manBoardC, PALETTE.manBoardD];
  const BROL = [PALETTE.manAwning, PALETTE.manAwning2, PALETTE.manFlagYel];
  const sy = quayWATER_Y + 1.125;
  for (let i = 0; i < 26; i++) {
    const px = mx - 44 + rand(0, 88), pz = mz - 26 + rand(0, 17);
    if (Math.abs(px - mx) < 11) continue;                    // not on the wharf approach
    if (i % 3 === 0) {
      quayPush9(brollyPole, px, sy + 0.95, pz, 0, 0, 0, 0.08, 1.9, 0.08);
      quayPush9(brolly[i % 3], px, sy + 1.90, pz, rand(-0.12, 0.12), rand(0, 3),
                rand(-0.12, 0.12), 2.9, 0.85, 2.9);
    }
    quayPush9(towel[i % 4], px + rand(-2.4, 2.4), sy + 0.03, pz + rand(-2.0, 2.0),
              0, rand(0, 3), 0, 1.0, 0.06, 2.1);
  }
  for (let i = 0; i < 9; i++) {
    quayPush9(board[i % 4], mx - 30 + i * 7 + rand(-1, 1), sy + 1.0, mz - 12 + rand(-1.5, 1.5),
              rand(-0.25, 0.25), rand(0, 3), 1.32, 0.55, 2.4, 0.14);
  }
  quayInstance(root, quayG.cyl6, PALETTE.manPole, brollyPole, false, false);
  for (let c = 0; c < 3; c++) quayInstance(root, quayG.cone6, BROL[c], brolly[c], true, false);
  for (let c = 0; c < 4; c++) {
    quayInstance(root, quayG.box, TOWEL[c], towel[c], false, false);
    quayInstance(root, quayG.box, BOARD[c], board[c], true, false);
  }
}

// ============================================================== THE SHORES ==
/**
 * THIRTEEN HEADLANDS AND NOT A TREE ON ONE OF THEM.
 *
 * A `quayHeadland` is a base ring, a cliff-top ring and a scrub cap: three
 * bands of flat colour, and from the water they are chunky flat-topped mesas
 * with a hard green lid. That silhouette is fine — it is the right silhouette —
 * but it is the WHOLE of both banks of the fairway for seven hundred metres,
 * and it is what you look at for the entire voyage. Measured against the
 * world-size rule, the middle four hundred metres of this chapter is water,
 * mesa, water.
 *
 * Three passes, all instanced, all built off the same quayHEADS table the
 * colliders come from, so nothing can be decorated that is not also solid:
 *
 *  1. BUSH on the tops. Sydney's headlands are angophora and banksia — low,
 *     wind-shorn, grey-green, and DENSE. Two blobs per plant so the canopy has
 *     a light side and a dark one.
 *  2. A BOULDER SKIRT at the waterline, which is what makes the join between
 *     rock and water read as a shore rather than as a cut.
 *  3. The two things on this harbour that are not rock: the beacon on Bradleys
 *     Head and the lighthouse on the outer point, both of which are how a
 *     sailor actually knows where they are.
 */
// =================================================================== THE BUSH ==
/**
 * EVERY HEADLAND IN SYDNEY HARBOUR IS COVERED IN TREES AND THESE WERE BALD.
 *
 * quayHeadland draws a four-course sandstone cliff with a smooth scrub CAP on
 * top of it — one flat green colour over an eleven-sided dome — and that is
 * every piece of land in the chapter except the quay itself: Bradleys Head,
 * Shark Island, Middle Head, North Head, Fort Denison and both shores. Thirteen
 * of them, filling both banks of a seven-hundred-metre fairway that the player
 * spends a minute and a half looking straight down.
 *
 * The harbour's headlands are not lawns. They are Hawkesbury sandstone with
 * dry sclerophyll forest on them, and the three things that make that read at
 * two hundred metres are exactly the three things the cap had none of:
 *
 *   ANGOPHORA, which is the tree everybody photographs — a pale orange trunk
 *     that BENDS, a low fork, and a dark rounded crown. The trunk colour is
 *     the whole tell; a green blob on a brown stick is a lollipop.
 *   BANKSIA AND SCRUB, which fills between them and is what makes a wood a
 *     canopy rather than a plantation.
 *   SANDSTONE OUTCROP, breaking through the scrub at the top of every cliff,
 *     because a headland is rock with a thin skin of soil on it and the rock
 *     shows wherever the slope is over about thirty degrees.
 *
 * The brief for this pass was explicit that the investment goes on the
 * FORESHORE and not on the water, and this is the foreshore: it is the whole
 * silhouette of both banks and it is the thing you steer between.
 *
 * NONE OF IT IS SOLID and none of it needs to be. Every headland already
 * carries one octagonal collider at 0.70 of its radius (see quayHEADS), the
 * hull is stopped by quayHARD well outside that, and the player can only reach
 * the two the chapter lands on. Adding four hundred bodies to put bark on a
 * silhouette would be the most expensive way in the project to change nothing.
 *
 * The canopies do not cast either. The sun in this chapter is high and the
 * headlands are seen from the water: a shadow under a tree on a hill two
 * hundred metres away is four pixels, and there are four hundred of them.
 * The TRUNKS cast, because on the two headlands you can actually stand on
 * they are the only vertical thing in the frame.
 */
// ============================================================== THE COCKATOOS ==
/**
 * A THING THAT HAPPENS, WHICH IS NOT A TASK.
 *
 * The chapter has a marquee (the voyage) and three good minis (the dolphin
 * escort, the bridge echo, the gulls off the apron), and every one of them is
 * on or over the WATER. Now that both banks have a wood on them there is
 * somewhere for the other half of Sydney Harbour to live, and the other half of
 * Sydney Harbour is a hundred sulphur-crested cockatoos who are, without
 * exaggeration, the loudest birds on earth.
 *
 * Take the boat inside forty metres of a headland with way on and the canopy
 * goes up: eighteen white birds off the trees, out over the water, a wide turn
 * and back into the wood behind you. It costs one instanced mesh and a state
 * machine with three rungs, it has no task, no card entry and no beacon — it is
 * the gate in chapter 17 and the gentoos on the bow, and it is here for the
 * same reason. A wheek does it too, from anywhere within sixty metres, because
 * shouting at things is what this game is about.
 *
 * They ARE rationed by distance, which is the note the cave's roost got: a bird
 * that can be heard through a headland is not in a place.
 */
const quayCOCK_N = 18;
const quayCockData = new Float32Array(quayCOCK_N * 8);  // x,y,z,yaw,hx,hy,hz,phase
let quayCockMesh = null;
let quayCockT = -1;            // s since the flush, or -1 for "in the trees"
let quayCockHead = -1;         // which headland they came off
let quayCockCool = 0;
const quayCOCK_LIFE = 11.0;
const quayCOCK_R = 40;

function quayBuildCockatoos(root) {
  // one bird: a body, a swept wing either side, a crest and a tail. It is drawn
  // in the plane it flies in, so the instance matrix only ever has to carry a
  // heading and a bank.
  const B = quayMerger();
  B.sph(0, 0, 0, 0.19, 0.17, 0.30, PALETTE.sail);
  B.sph(0, 0.05, 0.26, 0.12, 0.11, 0.13, PALETTE.sail);
  // the crest, which is the only reason a white bird reads as this white bird
  B.box(0, 0.19, 0.28, 0.05, 0.20, 0.13, PALETTE.petalYellow, -0.5, 0, 0);
  for (let s = -1; s <= 1; s += 2) {
    B.box(s * 0.42, 0.02, -0.02, 0.62, 0.05, 0.26, PALETTE.sail, 0, s * 0.22, -s * 0.10);
    B.box(s * 0.78, -0.02, -0.10, 0.36, 0.04, 0.18, PALETTE.sailShade, 0, s * 0.42, -s * 0.16);
  }
  B.box(0, 0, -0.34, 0.16, 0.04, 0.30, PALETTE.sail);
  quayCockMesh = new THREE.InstancedMesh(B.build(), quayVC(), quayCOCK_N);
  quayCockMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  quayCockMesh.name = 'quayCockatoos';
  quayCockMesh.castShadow = false;
  quayCockMesh.userData.noShadow = true;
  quayCockMesh.frustumCulled = false;
  quayCockMesh.visible = false;
  root.add(quayCockMesh);
}

/** Put the flock in the canopy of headland `hi` and start the clock. */
function quayFlushCockatoos(game, hi) {
  if (!quayCockMesh || quayCockT >= 0 || quayCockCool > 0) return;
  const H = quayHEADS[hi];
  if (!H || H.r < 6) return;
  quayCockHead = hi;
  quayCockT = 0;
  quayCockMesh.visible = true;
  for (let i = 0; i < quayCOCK_N; i++) {
    const o = i * 8;
    const a = rand(0, 6.28318), u = Math.sqrt(Math.random()) * 0.7;
    quayCockData[o] = H.x + Math.cos(a) * H.r * u;
    quayCockData[o + 2] = H.z + Math.sin(a) * H.r * u;
    quayCockData[o + 1] = quayGroundY(quayCockData[o], quayCockData[o + 2]) + rand(4, 9);
    quayCockData[o + 3] = a;
    // where it is going: out over the water, on its own bearing, so the flock
    // FANS. Eighteen birds on one heading is a formation, and cockatoos have
    // never once flown in formation.
    quayCockData[o + 4] = H.x + Math.cos(a) * H.r * rand(1.5, 2.6);
    quayCockData[o + 5] = quayWATER_Y + rand(9, 22);
    quayCockData[o + 6] = H.z + Math.sin(a) * H.r * rand(1.5, 2.6);
    quayCockData[o + 7] = rand(0, 6.28318);
  }
  // A SCREECH, RATIONED. 'gull' at the bottom of its pitch range with a lot of
  // spread on it is the closest thing in the table to the noise, and the noise
  // is the entire point of the animal.
  const p = game.capy && game.capy.position;
  const d = p ? Math.hypot(p.x - H.x, p.z - H.z) : 999;
  const v = clamp(0.42 - d * 0.0035, 0.06, 0.42);
  game.sfx('gull', { volume: v, pitch: rand(0.52, 0.72), force: true });
  game.sfx('rustle', { volume: v * 0.6, pitch: rand(1.3, 1.8) });
}

function quayUpdateCockatoos(game, dt) {
  if (!quayCockMesh) return;
  if (quayCockCool > 0) quayCockCool -= dt;
  // ---- what sets them off ------------------------------------------------
  if (quayCockT < 0 && quayCockCool <= 0) {
    const p = game.capy && game.capy.position;
    if (p) {
      const wheeked = !!(game.input && game.input.honkPressed);
      for (let i = 0; i < quayHEADS.length; i++) {
        const H = quayHEADS[i];
        if (H.r < 6) continue;
        const d = Math.hypot(p.x - H.x, p.z - H.z) - H.r;
        // Passing CLOSE with way on, or shouting from further off. The speed
        // gate is what stops the flock going up every time the boat drifts;
        // birds do not care about a boat that is not doing anything.
        if (d < quayCOCK_R && (Math.abs(quayBoatSpeed) > 4.0 || (wheeked && d < 60))) {
          quayFlushCockatoos(game, i);
          break;
        }
      }
    }
  }
  if (quayCockT < 0) return;
  quayCockT += dt;
  if (quayCockT > quayCOCK_LIFE) {
    quayCockT = -1;
    quayCockHead = -1;
    quayCockCool = 26;
    quayCockMesh.visible = false;
    return;
  }
  const H = quayHEADS[quayCockHead];
  // three rungs: UP and out (0..3.2 s), a wide turn over the water
  // (3.2..7.5 s), and back into the wood (7.5..11 s)
  const u = quayCockT / quayCOCK_LIFE;
  for (let i = 0; i < quayCOCK_N; i++) {
    const o = i * 8;
    let tx, ty, tz;
    if (quayCockT < 3.2) {
      tx = quayCockData[o + 4]; ty = quayCockData[o + 5]; tz = quayCockData[o + 6];
    } else if (quayCockT < 7.5) {
      const a = quayCockData[o + 3] + (quayCockT - 3.2) * 0.55;
      const r = H.r * 1.9;
      tx = H.x + Math.cos(a) * r;
      tz = H.z + Math.sin(a) * r;
      ty = quayCockData[o + 5] + Math.sin(quayCockT * 1.3 + quayCockData[o + 7]) * 1.6;
    } else {
      tx = H.x + Math.cos(quayCockData[o + 3]) * H.r * 0.45;
      tz = H.z + Math.sin(quayCockData[o + 3]) * H.r * 0.45;
      ty = quayGroundY(tx, tz) + 5.5;
    }
    const lam = quayCockT < 3.2 ? 1.5 : 1.1;
    const k = 1 - Math.exp(-lam * dt);
    const px = quayCockData[o], py = quayCockData[o + 1], pz = quayCockData[o + 2];
    quayCockData[o] += (tx - px) * k;
    quayCockData[o + 1] += (ty - py) * k;
    quayCockData[o + 2] += (tz - pz) * k;
    // heading from where it actually went, a wingbeat, and a bank into the turn
    const vx = quayCockData[o] - px, vz = quayCockData[o + 2] - pz;
    const yaw = (vx * vx + vz * vz) > 1e-6 ? Math.atan2(vx, vz) : quayCockData[o + 3];
    const beat = Math.sin(quayCockT * 11 + quayCockData[o + 7]) * 0.42;
    const bank = quayCockT > 3.2 && quayCockT < 7.5 ? 0.5 : 0.12;
    // and it FADES rather than vanishing: the last second is a shrinking bird
    // going into a canopy, which is what stops the group popping out of
    // existence in the middle of the frame
    const sc = 1 - clamp((u - 0.92) / 0.08, 0, 1);
    quayCockMesh.setMatrixAt(i, quayXform(
      quayCockData[o], quayCockData[o + 1], quayCockData[o + 2],
      beat * 0.3, yaw, bank + beat, sc, sc, sc));
  }
  quayCockMesh.instanceMatrix.needsUpdate = true;
  // and they carry on shouting the whole way round, quietly, rationed
  if (quayCockT > 0.6 && Math.floor(quayCockT * 1.7) !== Math.floor((quayCockT - dt) * 1.7)) {
    const p = game.capy && game.capy.position;
    const d = p ? Math.hypot(p.x - H.x, p.z - H.z) : 999;
    if (d < 150) {
      game.sfx('gull', { volume: clamp(0.20 - d * 0.0011, 0.03, 0.20),
                         pitch: rand(0.48, 0.80) });
    }
  }
}

// ==================================================================== SOUND ==
/**
 * WHAT THE FORESHORE SOUNDS LIKE, WHICH IS NOT WHAT THE WATER SOUNDS LIKE.
 *
 * Everything audible in this chapter came off the water or off the boat: surf,
 * wake, gulls, the big ferry, the bridge echo. That is right for the middle of
 * the fairway and it is wrong at both ends of it, because the two places the
 * player actually STANDS are a ferry terminal and a beach, and neither of them
 * sounds like open water.
 *
 * Two positional beds, both rationed on distance the way the Sahara's medina
 * and the Antarctic's katabatic are — the biome computes the volume, which is
 * the only kind of positional this engine does.
 *
 *   THE TERMINAL. A crowd, a gate, and a departure. It is only audible on the
 *     apron, so the moment the boat clears the berth it is gone, which is the
 *     whole feeling of leaving.
 *   THE CICADAS. Sydney Harbour bushland in February is genuinely painful to
 *     stand in, and it is the sound of every one of these headlands. It comes
 *     up as you close a bank and goes as you pull off it, which turns the
 *     fairway into a place with two edges instead of a plane.
 */
let quaySndTerm = 3, quaySndBush = 2;

// ================================================================ THE ENGINE ==
// YOU HAVE BEEN DRIVING A FOUR-HUNDRED-TONNE DIESEL FERRY IN SILENCE.
//
// The chapter's whole body is one long run up the harbour at the wheel, and
// the only sounds attached to the boat were the horn and the spray. There is
// no feedback loop at all between the thing the player is doing — winding the
// throttle on and off — and what they hear, which is the single most important
// loop a vehicle can have.
//
// A slow-speed marine diesel is a BEAT, not a drone: a hard low thump at a few
// hertz with a rasp on top of it, and what changes with the throttle is mostly
// the RATE. So it is built out of what the table already has: 'thud' at the
// bottom of its pitch range, on an interval that shortens as the revs come up,
// with a 'hiss' every few beats for the exhaust. Both are placed AT the funnel,
// so the boat is a thing you can hear the direction of, and both are jittered
// on volume, pitch and interval so this never becomes the metronome that
// Cappadocia's burners were.
//
// It also idles. She is a running boat sitting at a wharf before you ever
// touch the wheel, and an engine that only exists above four knots is a motor,
// not a ship.
const quayENG_IDLE = 0.62;      // s between beats at rest
const quayENG_FULL = 0.20;      // ...and flat out
let quayEngT = 0, quayEngRpm = 0, quayEngPuff = 0;

function quayUpdateEngine(game, dt) {
  if (typeof game.sfx !== 'function') return;
  // Revs follow the THROTTLE, not the speed — that is the difference between
  // an engine and a speedometer, and it is what makes going astern audible.
  const want = clamp(Math.abs(quayThrottle) * 0.82 + Math.abs(quayBoatSpeed) / quayBOAT_VMAX * 0.18, 0, 1);
  quayEngRpm = damp(quayEngRpm, want, 2.4, dt);
  const rpm = quayEngRpm;
  quayEngT -= dt;
  if (quayEngT > 0) return;
  // interval, jittered — never the same gap twice
  quayEngT = lerp(quayENG_IDLE, quayENG_FULL, rpm) * rand(0.90, 1.12);
  // the funnel, in world coordinates, so the beat comes from the right place
  const cs = Math.cos(quayBoatYaw), sn = Math.sin(quayBoatYaw);
  const ex = quayBoatX - sn * 2.2, ez = quayBoatZ - cs * 2.2;
  const ey = quayWATER_Y + quayBOAT_DECK + 2.6;
  game.sfx('thud', {
    volume: (0.11 + rpm * 0.20) * rand(0.88, 1.12),
    pitch: (0.30 + rpm * 0.13) * rand(0.96, 1.05),
    at: { x: ex, y: ey, z: ez }, near: 14, far: 120,
  });
  // …and the stack clears its throat every few beats, harder the more you ask
  quayEngPuff -= 1;
  if (quayEngPuff <= 0) {
    quayEngPuff = randInt(3, 7);
    game.sfx('hiss', {
      volume: (0.05 + rpm * 0.13) * rand(0.85, 1.15),
      pitch: 0.42 + rpm * 0.24 + rand(-0.05, 0.05),
      at: { x: ex, y: ey, z: ez }, near: 12, far: 100,
    });
    // and you can see it, which is the other half of a diesel under load
    if (rpm > 0.25) quayHornSteam = Math.max(quayHornSteam, 0.16 + rpm * 0.22);
  }
}

function quayUpdateSound(game, dt) {
  const p = game.capy && game.capy.position;
  if (!p) return;
  quaySndTerm -= dt;
  if (quaySndTerm <= 0) {
    // the apron is z 16..44 over x ±48; measure to the middle of it
    const d = Math.hypot(p.x, p.z - (quayAPRON_Z + quayAPRON_Z1) * 0.5);
    if (d < 70) {
      const v = clamp(0.17 * (1 - d / 70), 0.02, 0.17);
      const r = Math.random();
      if (r < 0.45) game.sfx('cheer', { volume: v * 0.55, pitch: rand(0.9, 1.15) });
      else if (r < 0.72) game.sfx('tick', { volume: v, pitch: rand(2.2, 2.9) });
      else game.sfx('horn', { volume: v * 0.8, pitch: rand(0.7, 0.95) });
      quaySndTerm = rand(5, 12);
    } else quaySndTerm = rand(3, 6);
  }
  quaySndBush -= dt;
  if (quaySndBush <= 0) {
    let best = 1e9;
    for (let i = 0; i < quayHEADS.length; i++) {
      const H = quayHEADS[i];
      if (H.r < 6) continue;
      const d = Math.hypot(p.x - H.x, p.z - H.z) - H.r;
      if (d < best) best = d;
    }
    if (best < 55) {
      // A cicada chorus is a continuous rasp, not an event, so it is played as
      // overlapping hisses on a short timer with the volume doing all the work.
      game.sfx('hiss', { volume: clamp(0.16 * (1 - best / 55), 0.02, 0.16),
                         pitch: rand(1.7, 2.3) });
      quaySndBush = rand(1.6, 3.2);
    } else quaySndBush = rand(2.5, 4.5);
  }
}

/**
 * THE NORFOLK ISLAND PINES ALONG MANLY BEACH.
 *
 * The voyage ENDS here. Ninety seconds of steering, a beach, a wharf, and the
 * one thing every photograph of Manly since 1880 has in it — the double row of
 * Norfolk pines down the front — was not drawn. They are the arrival, they are
 * visible from half way across the harbour, and a Norfolk pine is the easiest
 * tree in the world to draw: a dead straight mast with horizontal tiers coming
 * off it, each a little shorter than the one below, and nothing else.
 *
 * They go along the back of the dry sand at z = quayMANLY.z - 30, which
 * quayGroundY already answers 1.125 for — behind the beach, never between the
 * camera and the water, and clear of the wharf approach.
 */
function quayBuildPines(game, root) {
  const M = quayMerger();
  const F = quayPool();
  const MZ = quayMANLY.z - 31;
  for (let i = 0; i < 15; i++) {
    const px = quayMANLY.x - 42 + i * 6.1;
    // not across the wharf approach, which is the line the boat comes in on
    if (Math.abs(px - quayMANLY.x) < 11) continue;
    const gy = quayWATER_Y + 1.125;
    const h = rand(11, 15);
    // the mast: one straight trunk, and it does not taper much, which is the
    // whole silhouette
    M.cyl(px, gy + h * 0.5, MZ, 0.28, h, PALETTE.trunkDark, 0, 0, 0, 6);
    // the tiers: horizontal, evenly spaced, shortening to a point. Nine of
    // them, because eight reads as a Christmas tree and twelve reads as a fern.
    for (let k = 0; k < 9; k++) {
      const t = k / 8;
      const ty = gy + h * (0.30 + t * 0.68);
      const r = (1 - t) * (1 - t) * 3.4 + 0.35;
      M.cone(px, ty, MZ, r, 1.15 + (1 - t) * 0.5,
             k % 2 ? PALETTE.leafC : PALETTE.leafA, 0, k * 0.7, 0, 6);
    }
    M.cone(px, gy + h * 1.02, MZ, 0.42, 1.5, PALETTE.leafC, 0, 0, 0, 6);
    quayPoolBox(F, px, gy + h * 0.5, MZ, 0.32, h * 0.5, 0.32);
  }
  quayPoolDone(game, F);
  const m = new THREE.Mesh(M.build(), quayVC());
  m.name = 'quayPines';
  m.castShadow = true;
  m.receiveShadow = true;
  // The Manly wharf pines are the one stand of trees in this chapter the
  // player walks past, and `grep -c sway` in this file was 0 (D3). The
  // headland woods across the water are deliberately NOT swayed: they are
  // fifty to two hundred metres off the fairway, they are instanced spheres
  // whose local origin is their own centre, and nothing at that distance
  // resolves a leaf moving.
  swayMesh(m, { leaf: 0.35, amount: 0.13, axis: 'y', auto: true, stiff: 2.6, hz: 0.44 });
  root.add(m);
}

/**
 * How far a headland is from the water the player actually travels: the berth
 * on the apron, then the fairway down to Manly. Sampled along the rhumb line
 * rather than from one point, because a headland abeam the middle of the ride
 * is close even though it is four hundred metres from the berth.
 */
function quayHeadRouteDist(x, z) {
  let best = 1e9;
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const rx = 0 + t * 118, rz = quayAPRON_Z + t * (-556 - quayAPRON_Z);
    const d = Math.hypot(x - rx, z - rz);
    if (d < best) best = d;
  }
  return best;
}

function quayBuildBush(root) {
  const trunk = [], fork = [], crownA = [], crownB = [], scrub = [], rock = [], grassT = [];
  // A headland's own numbers decide its wood: the exposed ocean ones (North
  // Head, Middle Head) are wind-shorn heath and the sheltered inner ones
  // (Bradleys, Shark) carry real trees. That is genuinely how the harbour
  // works and it is one number.
  for (let hI = 0; hI < quayHEADS.length; hI++) {
    const H = quayHEADS[hI];
    if (H.r < 6) continue;
    const exposed = H.z < -330;
    // ---- AND A HEADLAND ACROSS THE WATER IS A CANOPY, NOT A WOOD ---------
    // Every one of the thirteen headlands got the same tree: a leaning trunk,
    // a fork, two crowns, sandstone at every fourth plant and a grass tree at
    // every sixth. MEASURED, that made this one function 102,000 of the
    // chapter's 201,000 triangles — and NONE of these headlands is walkable.
    // The player is on the apron and then on the fairway; the nearest bank is
    // fifty metres off it and most are two hundred, across open water.
    //
    // What survives that distance is the CANOPY LINE and nothing else, so the
    // count stays exactly where it was — the wood is as thick as it ever was —
    // and each distant plant loses the parts that cannot resolve: the fork
    // inside its own crown, the second crown on top of the first, the
    // half-metre of sandstone at its foot and the grass tree beside it.
    // Distance is to the FAIRWAY, not to the apron: the ride down the harbour
    // is most of this chapter and it passes every one of these.
    // Measured to the NEAR EDGE of the headland, not its centre: North Head
    // is 130 m from the fairway and 78 m across, so its nose is 52 m away and
    // it keeps everything. So do both banks of Manly, which is where the ride
    // lands and where the player walks.
    const far = quayHeadRouteDist(H.x, H.z) - H.r > 60;
    // 0.085 measured out at 235,000 triangles for the chapter, thirty
    // thousand over the proven-safe ceiling of 205,000. A headland's area goes
    // as r², so North Head alone (r = 78) was carrying three hundred and
    // thirty-five trees; the number that matters is the CANOPY, and a canopy
    // closes well before it is a plantation.
    const n = Math.round(H.r * H.r * (exposed ? 0.040 : 0.064));
    for (let i = 0; i < n; i++) {
      // Sample inside the CAP, not inside the bounding box: the cap sits at
      // 0.72 of the radius and everything outside it is cliff face. Ten
      // chapters of this codebase have been bitten by sampling a rectangle.
      const a = rand(0, 6.28318), u = Math.sqrt(Math.random()) * 0.80;
      const x = H.x + Math.cos(a) * H.r * u, z = H.z + Math.sin(a) * H.r * u;
      const y = quayGroundY(x, z);
      if (y <= quayWATER_Y + 0.6) continue;
      const s = (exposed ? rand(0.5, 0.9) : rand(0.85, 1.5)) * (1 - u * 0.35);
      const lean = rand(-0.22, 0.22), ry = rand(0, 6.28318);
      if (!exposed && i % 3 !== 2 && far) {
        // the distant tree: one trunk, one crown. At two hundred metres the
        // fork is inside the crown and the second crown is the first one.
        quayPush9(trunk, x, y + s * 2.2, z, lean * 0.5, ry, 0, s * 0.34, s * 4.4, s * 0.34);
        quayPush9(crownA, x + lean * s * 2.4, y + s * 4.7, z, 0, ry, 0,
                  s * 3.1, s * 2.4, s * 3.0);
      } else if (!exposed && i % 3 !== 2) {
        // the tree: a leaning trunk, one fork, and two crowns of different
        // greens, because a canopy that is one colour is a hedge
        quayPush9(trunk, x, y + s * 1.6, z, lean * 0.5, ry, 0, s * 0.34, s * 3.2, s * 0.34);
        quayPush9(fork, x + lean * s * 1.9, y + s * 3.5, z, lean, ry + 0.7, 0,
                  s * 0.22, s * 1.9, s * 0.22);
        quayPush9(crownA, x + lean * s * 2.4, y + s * 4.5, z, 0, ry, 0,
                  s * 3.1, s * 2.0, s * 3.0);
        quayPush9(crownB, x + lean * s * 3.0, y + s * 5.4, z + s * 0.4, 0, ry + 1.3, 0,
                  s * 2.2, s * 1.5, s * 2.2);
      } else {
        // banksia and heath: no trunk worth drawing, all crown, and it is the
        // stuff that actually covers the ground between the trees
        quayPush9(scrub, x, y + s * 0.75, z, rand(-0.12, 0.12), ry, rand(-0.12, 0.12),
                  s * 2.4, s * 1.5, s * 2.3);
      }
      // sandstone breaking through, and a grass tree beside about a sixth of
      // them: the two things that say this soil is four centimetres deep
      if (i % 4 === 1 && !far) {
        const rs = rand(0.8, 2.3);
        quayPush9(rock, x + rand(-2.5, 2.5), y + rs * 0.22, z + rand(-2.5, 2.5),
                  rand(-0.2, 0.2), rand(0, 6.28), rand(-0.2, 0.2), rs * 1.5, rs * 0.6, rs * 1.2);
      }
      if (i % 6 === 3 && !far) {
        const gs = rand(0.6, 1.1);
        quayPush9(grassT, x + rand(-2, 2), y + gs * 0.55, z + rand(-2, 2),
                  0, ry, 0, gs * 1.7, gs * 1.5, gs * 1.7);
      }
    }
  }
  quayInstance(root, quayG.cyl6, PALETTE.trunk, trunk, true, false);
  quayInstance(root, quayG.cyl6, PALETTE.trunk, fork, false, false);
  quayInstance(root, quayG.sph5, PALETTE.leafC, crownA, false, true);
  quayInstance(root, quayG.sph5, PALETTE.leafA, crownB, false, true);
  quayInstance(root, quayG.sph5, PALETTE.leafB, scrub, false, true);
  quayInstance(root, quayG.sph5, PALETTE.cliffRock, rock, false, true);
  quayInstance(root, quayG.cone6, PALETTE.fernLeaf, grassT, false, true);
}

// ================================================================ THE APRON ==
/**
 * SIX GRABBABLE PROPS OVER EIGHTY THOUSAND SQUARE METRES.
 *
 * That was the lowest absolute count in the game, and this chapter's low
 * triangle density is largely honest — it IS a harbour, and the water is
 * supposed to be empty. What is not honest is the APRON: a hundred metres of
 * sandstone deck at the head of the busiest ferry terminal in the southern
 * hemisphere, carrying three shelters, three berth boards, some bollards and
 * nothing else. It is where the chapter starts, where the player spends the
 * first minute looking for a boat, and where they come back to.
 *
 * What actually stands on Circular Quay, and what is here now: the row of
 * Canary Island date palms along the promenade (the one piece of planting
 * everybody remembers), the ferry timetable pylons, the awnings over the
 * concourse, bench-and-bin pairs, a busker's pitch, luggage trolleys, and the
 * chain-and-bollard line along the water's edge.
 *
 * The palms are the only thing here tall enough to matter to the camera, so
 * they are the only thing set back from the walking line: the rig sits 7.2 m
 * behind the animal and a nine-metre palm on the water's edge would be in
 * every shot of the boat.
 */
function quayBuildApronDress(game, root) {
  const M = quayMerger();
  const F = quayPool();
  const fronds = [], crowns = [];

  // ---- the palms, in a row along the back of the promenade ----------------
  for (let i = 0; i < 13; i++) {
    const px = -44 + i * 7.3;
    // never in front of a berth: the three fingers are the sight lines the
    // whole first minute of the chapter runs along
    let clear = true;
    for (let w = 0; w < quayWHARF_X.length; w++) if (Math.abs(px - quayWHARF_X[w]) < 5.5) clear = false;
    if (!clear) continue;
    const pz = quayAPRON_Z + 8.5;
    const h = rand(6.4, 8.2);
    // a date palm's trunk is a stack of leaf scars and it tapers
    for (let k = 0; k < 7; k++) {
      const t = k / 7;
      M.cyl(px + Math.sin(k * 1.1) * 0.06, 0.20 + h * (t + 0.07), pz,
            0.42 - t * 0.13, h / 7 + 0.04,
            k % 2 ? PALETTE.trunk : PALETTE.woodDark, 0, k * 0.5, 0, 6);
    }
    M.cyl(px, 0.20 + h * 1.02, pz, 0.30, 0.5, PALETTE.woodDark, 0, 0, 0, 6);
    // eleven fronds, drooping, and a frond is a long thin box with a droop on
    // it rather than a cone: a cone is a party hat
    for (let f = 0; f < 11; f++) {
      const a = f / 11 * 6.28318 + i;
      quayPush9(fronds, px + Math.cos(a) * 1.5, 0.20 + h * 1.02 + 0.25 - (f % 3) * 0.14,
                pz + Math.sin(a) * 1.5, Math.sin(a) * 0.52, a, -Math.cos(a) * 0.52,
                0.55, 0.14, 3.4);
    }
    quayPush9(crowns, px, 0.20 + h * 1.02 + 0.1, pz, 0, i, 0, 1.5, 1.0, 1.5);
    quayPoolBox(F, px, 0.20 + h * 0.5, pz, 0.42, h * 0.5, 0.42);
    // and a ring of paving round the base, which is what a street tree gets
    M.cyl(px, 0.27, pz, 1.25, 0.10, PALETTE.stone, 0, 0, 0, 8);
  }

  // ---- benches, bins and the timetable pylons -----------------------------
  for (let i = 0; i < 9; i++) {
    const bx = -40 + i * 10.2, bz = quayAPRON_Z + 4.2;
    // bench: a plank seat, a back, and two cast ends. Facing the WATER, which
    // is the only thing anybody has ever sat on Circular Quay to look at.
    M.box(bx, 0.62, bz, 2.3, 0.12, 0.55, PALETTE.wood);
    M.box(bx, 0.92, bz + 0.28, 2.3, 0.55, 0.10, PALETTE.wood, 0.16, 0, 0);
    for (let e = -1; e <= 1; e += 2) {
      M.box(bx + e * 1.05, 0.36, bz, 0.12, 0.52, 0.52, PALETTE.wharfIron);
    }
    quayPoolBox(F, bx, 0.50, bz, 1.2, 0.55, 0.35);
    if (i % 2 === 0) {
      const nx = bx + 3.4;
      M.cyl(nx, 0.62, bz, 0.34, 0.85, PALETTE.wharfIron, 0, 0, 0, 8);
      M.cyl(nx, 1.07, bz, 0.38, 0.10, PALETTE.stoneDark, 0, 0, 0, 8);
      quayPoolBox(F, nx, 0.62, bz, 0.36, 0.45, 0.36);
    }
    if (i % 3 === 1) {
      // the timetable pylon: a lit sign on a post, and every terminal in the
      // world has one at the head of every finger
      const sx = bx - 2.0, sz = quayAPRON_Z + 1.6;
      M.cyl(sx, 1.35, sz, 0.11, 2.3, PALETTE.wharfIron, 0, 0, 0, 6);
      M.box(sx, 2.55, sz, 1.15, 1.5, 0.14, PALETTE.wharfIron, 0, 0.2, 0);
      M.box(sx, 2.55, sz - 0.10, 0.95, 1.25, 0.04, PALETTE.sail, 0, 0.2, 0);
      quayPoolBox(F, sx, 1.5, sz, 0.6, 1.6, 0.14);
    }
  }

  // ---- the chain line along the water's edge ------------------------------
  // A hundred metres of unguarded stone lip over deep water reads as an
  // unfinished world, and the chain is the cheapest possible sentence about
  // where the edge is. Nothing collides with it — it is 40 cm high and the
  // capybara is supposed to be able to get in the water.
  for (let i = 0; i < 27; i++) {
    const cx = -46 + i * 3.5;
    let clear = true;
    for (let w = 0; w < quayWHARF_X.length; w++) if (Math.abs(cx - quayWHARF_X[w]) < 6.5) clear = false;
    if (!clear) continue;
    M.cyl(cx, 0.44, quayAPRON_Z + 0.9, 0.11, 0.48, PALETTE.wharfIron, 0, 0, 0, 6);
    M.sph(cx, 0.70, quayAPRON_Z + 0.9, 0.14, 0.14, 0.14, PALETTE.stoneDark);
    // the chain: three sagging links to the next post
    for (let k = 0; k < 3; k++) {
      const t = (k + 0.5) / 3;
      const sag = Math.sin(t * Math.PI) * 0.13;
      M.box(cx + 1.17 + k * 1.17 - 1.17, 0.62 - sag, quayAPRON_Z + 0.9,
            1.2, 0.06, 0.06, PALETTE.stoneDark, 0, 0, (t - 0.5) * 0.5);
    }
  }

  // ---- the concourse awning, at the back --------------------------------
  // Set at z = APRON_Z1 - 3 so it is against the colonnade and can never be
  // between the camera and the water.
  for (let i = 0; i < 5; i++) {
    const ax = -36 + i * 18, az = quayAPRON_Z1 - 3.2;
    for (let e = -1; e <= 1; e += 2) {
      M.cyl(ax + e * 6.5, 1.7, az + 1.4, 0.16, 3.4, PALETTE.wharfIron, 0, 0, 0, 6);
      quayPoolBox(F, ax + e * 6.5, 1.7, az + 1.4, 0.18, 1.7, 0.18);
    }
    M.box(ax, 3.48, az - 0.6, 14.0, 0.16, 5.4, PALETTE.sail, -0.13, 0, 0);
    M.box(ax, 3.86, az - 3.2, 14.2, 0.22, 0.30, PALETTE.wharfIron);
  }

  quayPoolDone(game, F);
  const m = new THREE.Mesh(M.build(), quayVC());
  m.name = 'quayApronDress';
  m.castShadow = true;
  m.receiveShadow = true;
  root.add(m);
  quayInstance(root, quayG.box, PALETTE.palmLeaf, fronds, false, true);
  quayInstance(root, quayG.sph5, PALETTE.leafA, crowns, false, true);
}

function quayBuildShores(game, root) {
  const bushA = [], bushB = [], rock = [], grass = [];
  for (let i = 0; i < quayHEADS.length; i++) {
    const h = quayHEADS[i];
    let s = 1013 + i * 977;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    // ---- the scrub on the top -------------------------------------------
    // laid inside 0.62 r, which is inside the drawn cap (0.72 r) so nothing
    // hangs off the edge of its own hill
    // DENSITY IS THE WHOLE POINT. Twenty-five plants on a forty-metre hill read
    // as five shrubs on a lawn; coastal heath is a continuous grey-green MAT
    // with the odd angophora standing out of it, and a hundred of them is what
    // it takes to stop the cap being one flat value.
    // DENSITY BY DISTANCE FROM THE FAIRWAY. Thirteen headlands at one density
    // is thirty thousand triangles of scrub, most of it on the second rank of
    // hills that is never closer than two hundred metres and is read entirely
    // as silhouette. The rhumb line from the berth to Manly is where the
    // player actually is; plants are spent nearest it.
    const ft = clamp((quayAPRON_Z - h.z) / (quayAPRON_Z - quayMANLY.z), 0, 1);
    const lineX = lerp(quayBERTH.x, quayMANLY.x, ft);
    const off = Math.max(0, Math.abs(h.x - lineX) - h.r);
    const near = clamp(1 - off / 170, 0.40, 1);
    const n = Math.round(h.r * 0.78 * near);
    for (let k = 0; k < n; k++) {
      const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * h.r * 0.66;
      const px = h.x + Math.cos(a) * rr, pz = h.z + Math.sin(a) * rr;
      // the cap is a dome: highest in the middle, so a bush on the rim sits
      // lower than one at the peak or it floats off the side of the hill
      const py = h.h + h.h * 0.22 * (1 - (rr / (h.r * 0.72)) * 0.8) + 0.4;
      // one in seven is a TREE rather than a bush — an angophora standing out
      // of the heath is what gives a headland a skyline of its own
      const tall = k % 7 === 3;
      const sc = tall ? 4.2 + rnd() * 3.6 : 2.0 + rnd() * 3.6;
      quayPush9(bushA, px, py + sc * (tall ? 0.72 : 0.30), pz, 0, rnd() * 3, 0,
                sc * (tall ? 1.7 : 1.6), sc * (tall ? 1.25 : 0.95), sc * (tall ? 1.6 : 1.5));
      quayPush9(bushB, px + (rnd() - 0.5) * sc, py + sc * 0.18, pz + (rnd() - 0.5) * sc,
                0, rnd() * 3, 0, sc * 1.25, sc * 0.8, sc * 1.15);
      if (tall) {
        quayPush9(grass, px, py + sc * 0.36, pz, 0, 0, 0, sc * 0.16, sc * 0.9, sc * 0.16);
      }
    }
    // ---- the boulders at the waterline -----------------------------------
    const m = Math.max(7, Math.round(h.r * 0.55 * near));
    for (let k = 0; k < m; k++) {
      const a = k / m * Math.PI * 2 + rnd() * 0.3;
      // TIGHT IN. The drawn base ring's radii wander between 0.68 r and 1.18 r
      // per vertex, so a boulder laid at 0.88–1.10 lands in open water wherever
      // the cliff happens to be cut in — measured, one of them is floating on
      // its own thirty metres off the left headland in the widest shot in the
      // chapter. Inside the smallest sector, and mostly under the surface.
      const rr = h.r * (0.62 + rnd() * 0.14);
      const sc = 1.4 + rnd() * 3.2;
      quayPush9(rock, h.x + Math.cos(a) * rr, quayWATER_Y + rnd() * 1.2 - 0.5,
                h.z + Math.sin(a) * rr, rnd() * 0.5, rnd() * 3, rnd() * 0.5,
                sc, sc * 0.8, sc);
    }
  }
  // Fort Denison and Shark Island get the same skirt — they are the two rocks
  // you go closest to.
  for (const o of [{ x: quayFORT.x, z: quayFORT.z, r: quayFORT.r },
                   { x: quaySHARK.x, z: quaySHARK.z, r: quaySHARK.r }]) {
    for (let k = 0; k < 14; k++) {
      const a = k / 14 * Math.PI * 2;
      const sc = 1.0 + rand(0, 1.8);
      quayPush9(rock, o.x + Math.cos(a) * (o.r + 0.4), quayWATER_Y + rand(-0.2, 0.9),
                o.z + Math.sin(a) * (o.r + 0.4), rand(0, 0.5), rand(0, 3), rand(0, 0.5),
                sc, sc * 0.8, sc);
    }
  }
  quayInstance(root, quayG.sph5, PALETTE.headScrub, bushA, true, false);
  quayInstance(root, quayG.sph5, PALETTE.headScrubDk, bushB, false, false);
  quayInstance(root, quayG.cyl4, PALETTE.trunkDark, grass, false, false);
  quayInstance(root, quayG.sph5, PALETTE.cliffShade, rock, true, true);

  // ---- the two lights ------------------------------------------------------
  const K = quayMerger();
  // Bradleys Head: the mast off the old Sydney, standing on the point, which is
  // the first landmark you pass and had nothing on it at all
  K.cyl(quayBRAD.x + quayBRAD.r * 0.4, 21 + 9, quayBRAD.z + 4, 0.55, 18, PALETTE.metal, 0, 0, 0, 6);
  for (let k = 0; k < 3; k++) {
    K.box(quayBRAD.x + quayBRAD.r * 0.4, 21 + 4 + k * 5.5, quayBRAD.z + 4,
          8.5 - k * 2.2, 0.35, 0.35, PALETTE.metal);
  }
  K.cyl(quayBRAD.x + quayBRAD.r * 0.4, 21 + 1.2, quayBRAD.z + 4, 2.4, 2.4,
        PALETTE.stone, 0, 0, 0, 8);
  // and the lighthouse on the outer head, white and banded, which is the thing
  // that tells you where the Heads are from four hundred metres out
  {
    const lx = quayNORTH.x - 30, lz = quayNORTH.z + 26, ly = 44;
    K.cyl(lx, ly + 5.5, lz, 2.6, 11.0, PALETTE.sail, 0, 0, 0, 8);
    K.cyl(lx, ly + 11.4, lz, 2.9, 0.9, PALETTE.hullRed, 0, 0, 0, 8);
    K.cyl(lx, ly + 12.6, lz, 1.9, 1.6, PALETTE.glass, 0, 0, 0, 8);
    K.cone(lx, ly + 14.1, lz, 2.2, 1.5, PALETTE.hullRed, 0, 0, 0, 6);
    K.box(lx - 5.5, ly + 1.8, lz + 1, 6.0, 3.6, 7.0, PALETTE.sail);
    K.box(lx - 5.5, ly + 3.8, lz + 1, 6.6, 0.45, 7.6, PALETTE.hullRed);
  }
  // ...AND BOTH OF THEM ARE SOLID. The audit found the lighthouse and its
  // keeper's house standing on the top of North Head, drawn, with nothing under
  // them — which is the same omission that took thirteen headlands, fourteen
  // Corso shops and fifty Venetian palazzi, and it is the one that turns up
  // every single time something new is drawn. See quayHEADS.
  const K2 = quayPool();
  quayPoolBox(K2, quayBRAD.x + quayBRAD.r * 0.4, 21 + 1.2, quayBRAD.z + 4, 2.2, 1.2, 2.2);
  quayPoolBox(K2, quayNORTH.x - 30, 44 + 5.5, quayNORTH.z + 26, 2.4, 5.5, 2.4);
  quayPoolBox(K2, quayNORTH.x - 35.5, 44 + 1.8, quayNORTH.z + 27, 3.0, 1.8, 3.5);
  quayPoolDone(game, K2);

  const m = new THREE.Mesh(K.build(), quayVC());
  m.castShadow = true;
  m.frustumCulled = false;
  root.add(m);
}

// ================================================================ MOORINGS ==
/**
 * A HARBOUR IS FULL OF BOATS THAT ARE NOT GOING ANYWHERE.
 *
 * Six yachts were racing across the fairway and eleven buoys were floating in
 * it, and that was every hull on seven hundred metres of water. Every bay on
 * this harbour has forty boats swinging on moorings in it, all lying the same
 * way because they are all lying to the same tide — and that is the detail
 * that says "this water is used" without adding one thing you have to interact
 * with. They are laid in three fields tucked into coves OFF the fairway, so
 * they are scenery you steer past rather than an obstacle course.
 */
const quayMOOR_FIELD = [
  { x: -104, z: -172, rx: 34, rz: 26, n: 13, yaw: 0.35 },
  { x: 176, z: -262, rx: 30, rz: 34, n: 11, yaw: -0.25 },
  { x: -64, z: -330, rx: 26, rz: 22, n: 9, yaw: 0.2 },
];
function quayBuildMoorings(game, root) {
  const H = quayMerger();
  // a small yacht: hull, cabin, mast, boom — no sails, because she is moored
  H.box(0, 0.10, 0, 1.55, 0.72, 5.6, PALETTE.hullCream);
  H.box(0, -0.24, 0, 1.35, 0.36, 5.2, PALETTE.hullBoot);
  for (let s = -1; s <= 1; s += 2) {
    H.box(0, 0.10, s * 3.1, 1.55 * 0.5, 0.66, 0.9, PALETTE.hullCream);
  }
  H.box(0, 0.46, 0.3, 1.2, 0.12, 3.9, PALETTE.deckTeak);
  H.box(0, 0.70, -0.6, 1.05, 0.50, 1.9, PALETTE.sail);
  H.box(0, 0.92, -0.6, 1.12, 0.16, 2.0, PALETTE.hullGreen);
  H.cyl(0, 3.4, 0.45, 0.075, 6.4, PALETTE.sail, 0, 0, 0, 6);
  H.box(0, 1.15, -0.4, 0.09, 0.09, 2.6, PALETTE.sail);
  H.cyl(0, 0.30, 2.9, 0.09, 0.9, PALETTE.metal, 0, 0, 0, 6);      // the pulpit
  const geo = H.build();

  let n = 0;
  for (const f of quayMOOR_FIELD) n += f.n;
  quayMoorData = new Float32Array(n * 4);       // x, z, yaw, phase
  const im = new THREE.InstancedMesh(geo, quayVC(), n);
  im.castShadow = true;
  im.frustumCulled = false;
  let i = 0;
  const buoy = [];
  for (const f of quayMOOR_FIELD) {
    for (let k = 0; k < f.n; k++) {
      const a = (k / f.n) * Math.PI * 2;
      const rr = 0.35 + 0.65 * ((k * 7) % f.n) / f.n;
      // ---- AND EVERY ONE OF THEM IS ON WATER (X8) -----------------------
      // Two of these three ellipses are not. Sampled 20 x 20 across each
      // field's own extent (qa/px-moor4.js): field 1 is 247 cells of 400 DRY
      // with terrain up to 26 m, field 2 is 74 of 400 dry, field 3 is clean.
      // So thirteen yachts were drawn at the waterline twenty-one metres
      // inside a headland and eleven more were part-buried in another — and
      // nobody had ever seen it, because a boat inside a hill is a boat you
      // cannot see. It only surfaced when the hulls grew colliders and an
      // animal put down on one came to rest at y 21.34.
      //
      // The fields are NOT moved. Their centres are a composition — a mooring
      // field belongs tucked against a headland, off the fairway — and the wet
      // part of each ellipse is exactly the cove the author was aiming at.
      // What changes is that a boat now has to find water: up to twenty
      // candidates round its own arc, scored by how much clear water is at a
      // hull's length in four directions, so a hull is never half in a
      // hillside either. Ties break toward the field centre.
      let px = 0, pz = 0, best = -1e9;
      for (let t = 0; t < 20; t++) {
        const wob = t === 0 ? 0 : 1 + t * 0.25;   // widen the search, don't move the field
        const cx = f.x + Math.cos(a + t * 0.31) * f.rx * rr + rand(-4 * (1 + wob), 4 * (1 + wob));
        const cz = f.z + Math.sin(a + t * 0.31) * f.rz * rr + rand(-4 * (1 + wob), 4 * (1 + wob));
        if (!quayIsOverWater(cx, cz)) continue;
        // how much clear water is round her — four probes at a hull's length,
        // so a boat is never wedged against a bank she is drawn floating off
        let room = 0;
        for (let d = 0; d < 4; d++) {
          const th = d * Math.PI / 2;
          if (quayIsOverWater(cx + Math.cos(th) * 7, cz + Math.sin(th) * 7)) room++;
        }
        const score = room - Math.hypot(cx - f.x, cz - f.z) * 0.01;
        if (score > best) { best = score; px = cx; pz = cz; }
        if (room === 4) break;                    // good enough; stop rolling
      }
      if (best <= -1e8) {                         // no water anywhere in this arc
        px = f.x + Math.cos(a) * f.rx * rr;
        pz = f.z + Math.sin(a) * f.rz * rr;
      }
      quayMoorData[i * 4] = px;
      quayMoorData[i * 4 + 1] = pz;
      // ALL LYING THE SAME WAY. Boats on moorings point into the tide, and a
      // field of them at random headings is the tell that they were scattered
      // rather than moored.
      quayMoorData[i * 4 + 2] = f.yaw + rand(-0.22, 0.22);
      quayMoorData[i * 4 + 3] = rand(0, Math.PI * 2);
      // the mooring buoy she is lying to, a few metres off the bow
      quayPush9(buoy, px + Math.sin(f.yaw) * 5.2, quayWATER_Y + 0.1, pz + Math.cos(f.yaw) * 5.2,
                0, 0, 0, 0.5, 0.5, 0.5);
      // ---- AND SHE IS A HULL, NOT A PICTURE OF ONE (X8) -----------------
      // Thirty-three boats and not one of them was in the world: you swam
      // through them and you steered the ferry through them. The argument for
      // making them scenery was that they are off the fairway — but "off the
      // fairway" is not "out of the chapter", and every one of these fields is
      // deep inside bounds(), which is the published statement of where a
      // player is allowed to go. The berthed ferries two hundred lines down
      // already carry this exact reasoning and already have their boxes.
      //
      // The hull is 1.55 across and 7.1 long including the fore and aft
      // extensions, so those are the half-extents, and the box sits low enough
      // to stop a SWIMMER (whose head is at the waterline) as well as a boat.
      const yaw = quayMoorData[i * 4 + 2];
      quayStaticBox(game, px, quayWATER_Y + 0.30, pz, 0.85, 0.62, 3.60, yaw);
      // ...and one circle each for the hull test, not one for the field: a
      // single circle round a 34 m cove is 34 m WIDE and would push the boat
      // further out than thirteen yachts ever could. Same shape argument as
      // the three discs down the berthed ferries.
      quayHARD.push({ x: px, z: pz, r: 3.6 + quayBOAT_HX, name: 'mooring' });
      i++;
    }
  }
  quayInstance(root, quayG.sph6, PALETTE.buoyYellow, buoy, false, false);
  quayMoorMesh = im;
  root.add(im);
  quayUpdateMoorings();
}

function quayUpdateMoorings() {
  const im = quayMoorMesh;
  if (!im) return;
  const n = quayMoorData.length / 4;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const x = quayMoorData[o], z = quayMoorData[o + 1];
    const ph = quayMoorData[o + 3];
    // she rides the same sea everything else does, and she SHEERS about her
    // mooring — three degrees, very slowly, which is what a boat on a buoy does
    // all day and is the only thing that makes a mooring field look alive
    const yaw = quayMoorData[o + 2] + Math.sin(quayTime * 0.17 + ph) * 0.12;
    const gx = (quaySurfaceY(x + 1, z) - quaySurfaceY(x - 1, z)) * 0.5;
    const gz = (quaySurfaceY(x, z + 1) - quaySurfaceY(x, z - 1)) * 0.5;
    im.setMatrixAt(i, quayXform(x, quaySurfaceY(x, z) + 0.35, z,
                                gz * 3.0, yaw, -gx * 3.0 + Math.sin(quayTime * 0.8 + ph) * 0.03,
                                1, 1, 1));
  }
  im.instanceMatrix.needsUpdate = true;
}

// ==================================================================== SURF ==
/**
 * A WHITE LINE WHERE THE LAND MEETS THE WATER, and there was not one anywhere.
 *
 * Every cliff, island and beach in this chapter entered the harbour on a hard
 * flat edge — the tell that makes a stylised coast read as cardboard standing
 * in a bath, and it is doing it thirteen times across the widest view in the
 * game. Two hundred foam quads laid round the waterlines fixes it outright, for
 * one instanced draw, and it costs nothing at all to breathe them: the swell
 * that lifts the buoys is the same sine, so the surf on the far Heads and the
 * boat under your feet are on the same sea.
 *
 * Long and thin and TANGENTIAL, never square — the note in quayBuildGlitter
 * about patches reading as litter rather than as light applies exactly as much
 * to foam.
 */
let quaySurf = null, quaySurfData = null;
function quayBuildSurf(root) {
  const l = [];
  // OVERLAPPING AND FAINT. A row of quads at 0.42 laid edge to edge reads as
  // pale tiles floating on the harbour — measured, and it is worse than no surf
  // at all. Each one is now twice as long as its spacing and a third as strong,
  // so what you see is the SUM of three or four of them and the joins vanish.
  const ring = (cx, cz, r, step, w) => {
    const n = Math.max(10, Math.round(2 * Math.PI * r / step));
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + rand(-0.06, 0.06);
      const rr = r * rand(0.975, 1.05);
      quayPush9(l, cx + Math.cos(a) * rr, quayWATER_Y + 0.05, cz + Math.sin(a) * rr,
                -Math.PI / 2, -a + Math.PI / 2, 0,
                rand(0.75, 1.3) * w, step * rand(1.9, 2.6), 1);
    }
  };
  for (let i = 0; i < quayHEADS.length; i++) {
    const h = quayHEADS[i];
    // the drawn base ring wanders between 0.68 and 1.18 of r; the surf sits on
    // the average of that, which is what the eye reads as the shoreline
    ring(h.x, h.z, h.r * 0.93, 13, 3.4);
  }
  ring(quayFORT.x, quayFORT.z, quayFORT.r + 0.6, 6, 2.0);
  ring(quaySHARK.x, quaySHARK.z, quaySHARK.r + 0.8, 7, 2.2);
  // and the beach at Manly, which is a straight line and gets the widest band:
  // it is the last thing you look at and the only surf anybody stands next to
  for (let i = 0; i < 62; i++) {
    const x = quayMANLY.x - 70 + i * 2.3 + rand(-0.9, 0.9);
    quayPush9(l, x, quayWATER_Y + 0.05, quayMANLY.z - 4.2 + rand(-1.1, 1.1),
              -Math.PI / 2, rand(-0.10, 0.10), 0, rand(5.0, 8.4), rand(3.4, 5.2), 1);
  }
  const n = l.length / 9;
  const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1),
    mat(PALETTE.seaFoam, { transparent: true, opacity: 0.23, depthWrite: false }), n);
  im.frustumCulled = false;
  im.castShadow = false; im.receiveShadow = false;
  quaySurfData = new Float32Array(n * 10);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 9; k++) quaySurfData[i * 10 + k] = l[i * 9 + k];
    quaySurfData[i * 10 + 9] = rand(0, Math.PI * 2);      // its own place in the set
  }
  quaySurf = im;
  root.add(im);
  quayUpdateSurf();
}

function quayUpdateSurf() {
  if (!quaySurf) return;
  const d = quaySurfData;
  const n = d.length / 10;
  for (let i = 0; i < n; i++) {
    const o = i * 10;
    // A SET, NOT A SHIMMER. Waves arrive in groups: the envelope is one slow
    // sine with a second, slower one beating against it, so the line goes quiet
    // for a few seconds and then all of it breaks at once.
    const ph = quayTime * 0.62 + d[o + 9];
    const k = 0.34 + 0.66 * Math.max(0, Math.sin(ph)) * (0.55 + 0.45 * Math.sin(ph * 0.23));
    quaySurf.setMatrixAt(i, quayXform(d[o], quaySurfaceY(d[o], d[o + 2]) + 0.05, d[o + 2],
                                      d[o + 3], d[o + 4], d[o + 5],
                                      d[o + 6] * (0.5 + k * 0.75), d[o + 7], 1));
  }
  quaySurf.instanceMatrix.needsUpdate = true;
}

// ============================================================ WIND AND SPRAY ==
/**
 * WHAT THE HARBOUR WAS MISSING WAS WIND.
 *
 * The sea here is one vertex-coloured plane with a two-sine ripple in it and a
 * sparkle field over the top, and the ripple is 29 cm on a 700 m sheet — from
 * six metres up at forty-one degrees it is invisible. So the whole harbour is
 * one flat value with white dots on it, and it never MOVES: the glitter twinkles
 * in place and nothing crosses the water.
 *
 * A cat's-paw is the dark patch a gust drags across a bay, and it is the single
 * cheapest thing that turns painted water into weather: sixty long soft quads,
 * a shade deeper than the sea, drifting down the wind at two and a half metres a
 * second and fading in and out on their own clocks. They wrap: a patch that runs
 * off the top of the field comes back at the bottom, so sixty of them cover the
 * whole harbour for ever. One draw call, no state, and it is the difference
 * between a sea and a swimming pool.
 */
const quayCAT_N = 110;
const quayCAT_DIR = -0.62;      // the wind, in radians — a north-easter
function quayBuildCats(root) {
  quayCatData = new Float32Array(quayCAT_N * 4);      // x, z, size, phase
  for (let i = 0; i < quayCAT_N; i++) {
    quayCatData[i * 4] = rand(quaySEA_X0, quaySEA_X1);
    quayCatData[i * 4 + 1] = rand(quaySEA_Z0, quaySEA_Z1);
    quayCatData[i * 4 + 2] = rand(14, 40);
    quayCatData[i * 4 + 3] = rand(0, Math.PI * 2);
  }
  const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1),
    mat(PALETTE.seaFar, { transparent: true, opacity: 0.11, depthWrite: false }), quayCAT_N);
  im.frustumCulled = false;
  im.castShadow = false; im.receiveShadow = false;
  quayCatMesh = im;
  root.add(im);
  quayUpdateCats(0);
}

function quayUpdateCats(dt) {
  const im = quayCatMesh;
  if (!im) return;
  const vx = Math.sin(quayCAT_DIR) * 2.6, vz = Math.cos(quayCAT_DIR) * 2.6;
  const W = quaySEA_X1 - quaySEA_X0, D = quaySEA_Z1 - quaySEA_Z0;
  for (let i = 0; i < quayCAT_N; i++) {
    const o = i * 4;
    let x = quayCatData[o] + vx * dt, z = quayCatData[o + 1] + vz * dt;
    // wrap, so sixty patches cover seven hundred metres of harbour for ever
    if (x < quaySEA_X0) x += W; else if (x > quaySEA_X1) x -= W;
    if (z < quaySEA_Z0) z += D; else if (z > quaySEA_Z1) z -= D;
    quayCatData[o] = x; quayCatData[o + 1] = z;
    const s = quayCatData[o + 2];
    // a gust is a THING THAT ARRIVES: the envelope is slow and it spends most
    // of its life near zero, so the harbour goes quiet and then darkens over
    const k = Math.max(0, Math.sin(quayTime * 0.11 + quayCatData[o + 3]));
    // LONG AND THIN AND DOWN THE WIND. Square patches at low opacity read as
    // pale tiles floating on the harbour — the note in quayBuildGlitter about
    // litter rather than light, for the third time in this file. A gust track
    // is four or five times as long as it is wide.
    im.setMatrixAt(i, quayXform(x, quaySurfaceY(x, z) + 0.03, z,
                                -Math.PI / 2, quayCAT_DIR, 0,
                                s * (0.13 + k * 0.20), s * 4.4 * (0.5 + k * 0.6), 1));
  }
  im.instanceMatrix.needsUpdate = true;
}

/**
 * BOW SPRAY, TRANSOM BOIL, AND THE STEAM OFF THE WHISTLE.
 *
 * `quayHornT` has been set to 1.4 by the horn since the chapter was written and
 * read by NOTHING — a dead variable where the visible half of the loudest thing
 * in the game should have been. A ship's whistle is a jet of white off the
 * funnel that arrives before the sound does and hangs about after it, and the
 * player's own boat had a horn you could only hear.
 *
 * Same pool does the bow spray, because they are the same effect: a soft quad
 * that is born somewhere on the boat, rises, spreads and dies.
 */
const quaySPRAY_N = 22;
function quayBuildSpray(root) {
  quaySprayData = new Float32Array(quaySPRAY_N * 8);   // x,y,z, vx,vy,vz, life, size
  const im = new THREE.InstancedMesh(quayG.sph5,
    mat(PALETTE.foam, { transparent: true, opacity: 0.55, depthWrite: false }), quaySPRAY_N);
  im.frustumCulled = false;
  im.castShadow = false;
  for (let i = 0; i < quaySPRAY_N; i++) {
    im.setMatrixAt(i, quayXform(0, -900, 0, 0, 0, 0, 0.001, 0.001, 0.001));
  }
  im.instanceMatrix.needsUpdate = true;
  quaySprayMesh = im;
  root.add(im);
}

function quaySprayEmit(x, y, z, vx, vy, vz, size) {
  if (!quaySprayData) return;
  for (let i = 0; i < quaySPRAY_N; i++) {
    const o = i * 8;
    if (quaySprayData[o + 6] > 0) continue;
    quaySprayData[o] = x; quaySprayData[o + 1] = y; quaySprayData[o + 2] = z;
    quaySprayData[o + 3] = vx; quaySprayData[o + 4] = vy; quaySprayData[o + 5] = vz;
    quaySprayData[o + 6] = 1; quaySprayData[o + 7] = size;
    return;
  }
}

let quaySprayT = 0;
function quayUpdateSpray(dt) {
  const im = quaySprayMesh;
  if (!im) return;
  const sp = Math.abs(quayBoatSpeed);
  const cs = Math.cos(quayBoatYaw), sn = Math.sin(quayBoatYaw);
  // ---- the bow, which throws water once she has way on ---------------------
  quaySprayT -= dt;
  if (sp > 4.5 && quaySprayT <= 0) {
    quaySprayT = 0.14 - clamp(sp / quayBOAT_VMAX, 0, 1) * 0.07;
    const dir = quayBoatSpeed >= 0 ? 1 : -1;
    const side = Math.random() < 0.5 ? -1 : 1;
    const bx = quayBoatX + sn * (quayBOAT_HZ - 0.4) * dir + cs * side * quayBOAT_HX;
    const bz = quayBoatZ + cs * (quayBOAT_HZ - 0.4) * dir - sn * side * quayBOAT_HX;
    const k = clamp(sp / quayBOAT_VMAX, 0, 1);
    quaySprayEmit(bx, quayWATER_Y + 0.15, bz,
                  cs * side * (1.4 + k * 2.2) + sn * dir * sp * 0.25, 1.6 + k * 2.6,
                  -sn * side * (1.4 + k * 2.2) + cs * dir * sp * 0.25,
                  0.55 + k * 0.9);
  }
  // ---- and the whistle -----------------------------------------------------
  if (quayHornSteam > 0) {
    quayHornSteam -= dt;
    if (Math.random() < dt * 26) {
      quaySprayEmit(quayBoatX - sn * 2.6, quayWATER_Y + quayBOAT_DECK + 4.3, quayBoatZ - cs * 2.6,
                    rand(-0.5, 0.5) + sn * quayBoatSpeed * 0.4, rand(1.4, 2.6),
                    rand(-0.5, 0.5) + cs * quayBoatSpeed * 0.4, 0.9);
    }
  }
  let live = false;
  for (let i = 0; i < quaySPRAY_N; i++) {
    const o = i * 8;
    if (quaySprayData[o + 6] <= 0) continue;
    live = true;
    quaySprayData[o + 6] -= dt * 0.95;
    quaySprayData[o + 4] -= 5.2 * dt;
    quaySprayData[o] += quaySprayData[o + 3] * dt;
    quaySprayData[o + 1] += quaySprayData[o + 4] * dt;
    quaySprayData[o + 2] += quaySprayData[o + 5] * dt;
    const L = quaySprayData[o + 6];
    if (L <= 0 || quaySprayData[o + 1] < quayWATER_Y - 0.2) {
      quaySprayData[o + 6] = 0;
      im.setMatrixAt(i, quayXform(0, -900, 0, 0, 0, 0, 0.001, 0.001, 0.001));
      continue;
    }
    const s = quaySprayData[o + 7] * (0.7 + (1 - L) * 2.4);
    im.setMatrixAt(i, quayXform(quaySprayData[o], quaySprayData[o + 1], quaySprayData[o + 2],
                                0, i, 0, s, s * 0.8, s));
  }
  if (live) im.instanceMatrix.needsUpdate = true;
  im.material.opacity = 0.42;
}

// ================================================================ THE LINE ==
function quayBuildLine(root) {
  const im = new THREE.InstancedMesh(quayG.box, mat(PALETTE.iceRope || PALETTE.sail),
                                     quayLINE_N);
  im.castShadow = false;
  im.frustumCulled = false;
  im.visible = false;
  for (let i = 0; i < quayLINE_N; i++) {
    im.setMatrixAt(i, quayXform(0, -900, 0, 0, 0, 0, 0.001, 0.001, 0.001));
  }
  im.instanceMatrix.needsUpdate = true;
  quayLineMesh = im;
  root.add(im);
}

function quayUpdateLine(game, dt) {
  const im = quayLineMesh;
  if (!im) return;
  if (quayLineT < 0) { if (im.visible) im.visible = false; return; }
  quayLineT += dt;
  if (quayLineT > 9) { quayLineT = -1; im.visible = false; return; }
  im.visible = true;
  // from the boat's shoulder to the bollard on the wharf head
  const cs = Math.cos(quayBoatYaw), sn = Math.sin(quayBoatYaw);
  const ax = quayBoatX + sn * 3.4 + cs * quayBOAT_HX;
  const ay = quayWATER_Y + quayBOAT_DECK + 0.95;
  const az = quayBoatZ + cs * 3.4 - sn * quayBOAT_HX;
  const bx = quayMANLY.x + (ax > quayMANLY.x ? 8.4 : -8.4);
  const by = quayWATER_Y + 1.61 + 0.55;
  const bz = quayMANLY.z + 6.0;
  // 0.0-0.8 s: the throw, on a high arc. after that: made fast, and sagging.
  const fly = clamp(quayLineT / 0.8, 0, 1);
  const arc = quayLineT < 0.8 ? 2.6 : 0.9;
  for (let i = 0; i < quayLINE_N; i++) {
    const t = (i + 0.5) / quayLINE_N;
    const reach = Math.min(1, fly <= t ? 0 : 1);
    if (!reach) { im.setMatrixAt(i, quayXform(0, -900, 0, 0, 0, 0, 0.001, 0.001, 0.001)); continue; }
    const t0 = i / quayLINE_N, t1 = (i + 1) / quayLINE_N;
    const p0x = lerp(ax, bx, t0), p0z = lerp(az, bz, t0);
    const p0y = lerp(ay, by, t0) + Math.sin(t0 * Math.PI) * arc;
    const p1x = lerp(ax, bx, t1), p1z = lerp(az, bz, t1);
    const p1y = lerp(ay, by, t1) + Math.sin(t1 * Math.PI) * arc;
    const dl = Math.hypot(p1x - p0x, p1y - p0y, p1z - p0z) || 0.001;
    // the box's long axis is +Y; under the YXZ euler that quayXform uses, +Y
    // lands on (sin rx · sin ry, cos rx, sin rx · cos ry) — so rx is the angle
    // off vertical and ry is the compass bearing, in that order and no other.
    const rx = Math.acos(clamp((p1y - p0y) / dl, -1, 1));
    const ry = Math.atan2(p1x - p0x, p1z - p0z);
    im.setMatrixAt(i, quayXform((p0x + p1x) * 0.5, (p0y + p1y) * 0.5, (p0z + p1z) * 0.5,
                                rx, ry, 0, 0.09, dl * 1.15, 0.09));
  }
  im.instanceMatrix.needsUpdate = true;
  if (quayLineT < dt * 2 && typeof game.sfx === 'function') game.sfx('rustle', { volume: 0.5 });
}

// =============================================================== THE TRAFFIC ==
/**
 * THE BRIDGE IS THE GATE OF THE VOYAGE AND NOTHING WAS EVER ON IT.
 *
 * A hundred and thirty metres of steel arch standing across the fairway with a
 * deck twenty-two metres over the water, and the deck was empty — which is the
 * one thing that makes a bridge read as a monument instead of as a road. The
 * chapter's third task is to steer under it and sound off, and the payoff for
 * doing so was a line of text.
 *
 * Two lanes of cars each way and a train on the near side, instanced, wrapping
 * at each end of the approach spans. They are two hundred triangles apiece and
 * they are the reason the arch has a scale.
 */
// Thirty-eight, not twenty-two: the carriageway is 336 m long now rather than
// 190, and the old count spread over it leaves fifteen metres of empty road
// between cars on the busiest thing in the picture.
const quayCAR_N = 38;
const quayCAR_COL = [PALETTE.hullRed, PALETTE.sail, PALETTE.wharfIron, PALETTE.cloth2,
                     PALETTE.hair2, PALETTE.buoyGreen, PALETTE.maiz, PALETTE.stoneDark];
let quayTrainMesh = null, quayTrainU = 0.2, quayTrainDir = 1, quayTrainWait = 0;
function quayBuildTraffic(root) {
  const C = quayMerger();
  C.box(0, 0.34, 0, 1.9, 0.68, 4.4, 0xffffff);
  C.box(0, 0.86, -0.25, 1.7, 0.52, 2.3, PALETTE.glass);
  C.box(0, 0.30, 2.05, 1.6, 0.30, 0.30, PALETTE.sail);
  C.box(0, 0.30, -2.05, 1.6, 0.30, 0.30, PALETTE.hullRed);
  const c = new THREE.Color();
  const im = new THREE.InstancedMesh(C.build(), quayVC(), quayCAR_N);
  im.castShadow = false; im.receiveShadow = false;
  im.frustumCulled = false;
  im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(quayCAR_N * 3), 3);
  for (let i = 0; i < quayCAR_N; i++) {
    c.set(quayCAR_COL[i % quayCAR_COL.length]);
    im.setColorAt(i, c);
  }
  im.instanceColor.needsUpdate = true;
  quayCarMesh = im;
  root.add(im);
  quayCarData = new Float32Array(quayCAR_N * 3);       // u, lane, speed
  for (let i = 0; i < quayCAR_N; i++) {
    quayCarData[i * 3] = i / quayCAR_N + rand(-0.02, 0.02);
    quayCarData[i * 3 + 1] = (i % 4) - 1.5;
    quayCarData[i * 3 + 2] = rand(0.055, 0.085) * ((i % 4) < 2 ? 1 : -1);
  }

  // the train: three carriages on the eastern pair of tracks
  const T = quayMerger();
  for (let k = 0; k < 3; k++) {
    const z = (k - 1) * 15.5;
    T.box(0, 1.55, z, 2.9, 2.60, 14.4, PALETTE.hullCream);
    T.box(0, 2.05, z, 3.05, 1.05, 13.6, PALETTE.glass);
    T.box(0, 3.00, z, 3.05, 0.35, 14.6, PALETTE.hullRed);
    T.box(0, 0.28, z, 2.4, 0.35, 13.0, PALETTE.hair2);
  }
  quayTrainMesh = new THREE.Mesh(T.build(), quayVC());
  quayTrainMesh.castShadow = false;
  quayTrainMesh.frustumCulled = false;
  root.add(quayTrainMesh);
}

function quayUpdateTraffic(game, dt) {
  if (!quayCarMesh) return;
  const B = quayBRIDGE;
  const cs = Math.cos(B.yaw), sn = Math.sin(B.yaw);
  // The road is as long as the deck is, less the two abutments it runs into —
  // a carriageway that stopped at the old 190 m would have left the whole
  // viaduct at either end as empty tarmac. See quayDECK_HALF.
  const SPAN = (quayDECK_HALF - 22) * 2;
  const place = (mesh, idx, u, lane, ang) => {
    const uu = (u - 0.5) * SPAN;
    const x = B.x + uu * cs + lane * sn;
    const z = B.z - uu * sn + lane * cs;
    const m = quayXform(x, B.deck + 0.2, z, 0, B.yaw + ang, 0, 1, 1, 1);
    if (idx < 0) { mesh.position.set(x, B.deck + 0.2, z); mesh.rotation.y = B.yaw + ang; }
    else mesh.setMatrixAt(idx, m);
  };
  for (let i = 0; i < quayCAR_N; i++) {
    const o = i * 3;
    quayCarData[o] += quayCarData[o + 2] * dt;
    if (quayCarData[o] > 1) quayCarData[o] -= 1;
    else if (quayCarData[o] < 0) quayCarData[o] += 1;
    place(quayCarMesh, i, quayCarData[o], quayCarData[o + 1] * 2.5 - 1.0,
          quayCarData[o + 2] > 0 ? Math.PI * 0.5 : -Math.PI * 0.5);
  }
  quayCarMesh.instanceMatrix.needsUpdate = true;
  // THE TRAIN STAYS ON THE BRIDGE. It used to run from u = -0.35 to 1.35, and
  // the deck only exists between 0 and 1 — so three carriages spent a third of
  // every crossing hanging in mid-air over the harbour, which is exactly what
  // it looks like. It runs the deck, then waits offstage for the next service.
  if (quayTrainWait > 0) {
    quayTrainWait -= dt;
    if (quayTrainMesh.visible) quayTrainMesh.visible = false;
    return;
  }
  quayTrainMesh.visible = true;
  // 0.045 over the longer deck is the 15 m/s that 0.075 was over the old one.
  quayTrainU += 0.045 * quayTrainDir * dt;
  if (quayTrainU > 1) { quayTrainU = 1; quayTrainDir = -1; quayTrainWait = rand(14, 26); }
  else if (quayTrainU < 0) { quayTrainU = 0; quayTrainDir = 1; quayTrainWait = rand(14, 26); }
  place(quayTrainMesh, -1, quayTrainU, 5.0, Math.PI * 0.5);
}

// ================================================================= THE BOAT ==
/**
 * MV Wheek. A small double-ended timber ferry: green hull, cream house, a
 * varnished deck the capybara can actually stand on, and a wheel at the front
 * of the house. She is a KINEMATIC cannon body driven by velocity, which is the
 * same trick Sydney's ferry uses — capybara.js already solves in the frame of
 * whatever it is standing on, so the deck carries its passenger exactly.
 */
function quayBuildBoat(game, root) {
  const g = new THREE.Group();
  g.name = 'quayBoat';
  const B = quayMerger();
  const HX = quayBOAT_HX, HZ = quayBOAT_HZ;

  // hull: a boot-topped box with two tapered ends, so she has a bow at both
  // ends like a real harbour ferry
  B.box(0, -0.55, 0, HX * 2, 1.5, HZ * 2 - 2.6, PALETTE.hullGreen);
  B.box(0, -1.15, 0, HX * 2 - 0.35, 0.45, HZ * 2 - 2.2, PALETTE.hullBoot);
  for (let s = -1; s <= 1; s += 2) {
    // the tapered end: three stacked slabs narrowing to a stem
    for (let k = 0; k < 3; k++) {
      const t = k / 3;
      B.box(0, -0.55, s * (HZ - 1.3 + k * 0.45), HX * 2 * (1 - t * 0.55), 1.5 - t * 0.2, 0.9,
            PALETTE.hullGreen);
    }
    B.box(0, 0.28, s * (HZ - 0.6), 1.0, 0.5, 1.4, PALETTE.hullCream);
  }
  // deck + bulwarks. Deck top sits at y = 0.35 in boat-local space; the body's
  // origin rides quayBOAT_DECK above the waterline, so the walkable surface is
  // quayWATER_Y + quayBOAT_DECK + 0.35.
  B.box(0, 0.28, 0, HX * 2 - 0.3, 0.16, HZ * 2 - 2.4, PALETTE.deckTeak);
  // Bulwarks in two runs a side with a 3.4 m GANGWAY amidships. Without the gap
  // the rail is a 1.2 m wall and boarding her from the wharf needs a running
  // jump, which is not how anybody has ever got on a ferry.
  for (let s = -1; s <= 1; s += 2) {
    for (let e = -1; e <= 1; e += 2) {
      const len = (HZ - 1.2) - quayGANG_HZ;
      const zc = e * (quayGANG_HZ + len * 0.5);
      B.box(s * (HX - 0.12), 0.62, zc, 0.24, 0.85, len, PALETTE.hullCream);
      B.box(s * (HX - 0.12), 1.06, zc, 0.34, 0.10, len + 0.1, PALETTE.deckTeakDark);
    }
    // A boarding platform proud of the gangway, both sides — she is
    // double-ended and berths on either hand. It is also the thing that closes
    // the last three quarters of a metre between the wharf edge and the deck:
    // without it a capybara walking aboard steps into the harbour instead.
    B.box(s * (HX + quayGANG_OUT * 0.5), 0.30, 0, quayGANG_OUT + 0.1, 0.16, quayGANG_HZ * 2,
          PALETTE.deckTeak);
    B.box(s * (HX + quayGANG_OUT), 0.16, 0, 0.16, 0.30, quayGANG_HZ * 2, PALETTE.hullGreen);
  }
  // the house: cream, windowed, with a green roof and a little funnel
  B.box(0, 1.35, -1.2, HX * 2 - 1.0, 1.9, 5.2, PALETTE.hullCream);
  B.box(0, 1.62, -1.2, HX * 2 - 0.7, 0.75, 5.4, PALETTE.glass);
  B.box(0, 2.42, -1.2, HX * 2 - 0.4, 0.28, 5.8, PALETTE.hullGreen);
  B.cyl(0, 3.15, -2.6, 0.52, 1.6, PALETTE.hullCream, 0, 0, 0, 8);
  B.cyl(0, 3.98, -2.6, 0.56, 0.28, PALETTE.hullRed, 0, 0, 0, 8);
  // mast + rigging stub
  B.cyl(0, 3.4, -0.2, 0.10, 2.2, PALETTE.wood, 0, 0, 0, 6);
  // the binnacle the wheel stands on, at the fore end of the house
  B.cyl(quayHELM.x, 0.75, quayHELM.z, 0.22, 0.80, PALETTE.woodDark, 0, 0, 0, 6);
  B.box(quayHELM.x, 1.20, quayHELM.z, 0.9, 0.14, 0.5, PALETTE.deckTeakDark);
  // fenders
  for (let i = -2; i <= 2; i++) {
    for (let s = -1; s <= 1; s += 2) {
      B.sph(s * (HX + 0.05), 0.05, i * 2.1, 0.30, 0.30, 0.30, PALETTE.thong);
    }
  }
  const hull = new THREE.Mesh(B.build(), quayVC());
  hull.castShadow = true;
  hull.receiveShadow = true;
  g.add(hull);

  // the wheel itself, spun by the rudder — a rim, a hub and six spokes
  const W = quayMerger();
  W.cyl(0, 0, 0, 0.42, 0.07, PALETTE.brassTrim, Math.PI / 2, 0, 0, 8);
  W.cyl(0, 0, 0, 0.36, 0.09, PALETTE.woodDark, Math.PI / 2, 0, 0, 8);
  W.cyl(0, 0, 0, 0.09, 0.14, PALETTE.brassTrim, Math.PI / 2, 0, 0, 6);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    W.box(Math.cos(a) * 0.22, Math.sin(a) * 0.22, 0, 0.44, 0.06, 0.06, PALETTE.wood, 0, 0, a);
    W.sph(Math.cos(a) * 0.47, Math.sin(a) * 0.47, 0, 0.055, 0.055, 0.075, PALETTE.brassTrim);
  }
  quayWheelMesh = new THREE.Mesh(W.build(), quayVC());
  quayWheelMesh.position.set(quayHELM.x, 1.52, quayHELM.z);
  quayWheelMesh.castShadow = true;
  g.add(quayWheelMesh);

  // an ensign at the stern that streams with the speed
  quayFlagMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.9, 4, 1),
                                mat(PALETTE.cloth2, { side: THREE.DoubleSide }));
  quayFlagMesh.position.set(0, 3.55, -3.4);
  g.add(quayFlagMesh);
  const staff = new THREE.Mesh(quayG.cyl6, mat(PALETTE.wood));
  staff.scale.set(0.09, 1.6, 0.09);
  staff.position.set(0, 3.05, -3.4);
  g.add(staff);

  // ---- THE MASTHEAD PENNANT (ROADMAP-WOW Part C, the movers uplift) ------
  // The ensign at the stern streams with the speed and the wheel turns with
  // the rudder, and both are aft and low from the play angle. The mast is the
  // tallest thing on her and carried nothing. A sock from shared.js's
  // hangThing — red and cream, the house colours — hung from the truck: it
  // hangs limp at the berth, streams aft as she gets under way and leans into
  // the helm, which is the one read of "she is turning" that survives the
  // lens being behind and above the wheelhouse. Two draw calls, no texture.
  quayPennant = hangThing('sock', { a: PALETTE.hullRed, b: PALETTE.hullCream, c: PALETTE.woodDark, len: 0.95 });
  quayPennant.position.set(0, 4.52, -0.2);
  g.add(quayPennant);
  // ...AND ONE THING THAT IS NOT MIRRORED: a lifebuoy on the PORT bulwark
  // aft, and only there. Every other thing on her is built in s = -1..1
  // pairs; the rubric's "one asymmetry" is this ring.
  const buoy = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.075, 6, 10), mat(PALETTE.hullRed));
  buoy.position.set(-(HX - 0.12) - 0.19, 0.92, -3.6);
  buoy.rotation.y = Math.PI * 0.5;
  buoy.castShadow = true;
  g.add(buoy);

  root.add(g);
  quayBoatGroup = g;

  // ---- the body ----------------------------------------------------------
  // Kinematic: nothing may push her about, and she never falls. The collider is
  // the DECK slab plus two bulwark rails, so the capybara stands on her and
  // cannot walk off the side by accident.
  const body = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC,
                                 material: (game.mats && game.mats.ground) || undefined });
  body.addShape(new CANNON.Box(new CANNON.Vec3(HX, 0.34, HZ - 1.2)),
                new CANNON.Vec3(0, 0.10, 0));
  for (let s = -1; s <= 1; s += 2) {
    for (let e = -1; e <= 1; e += 2) {
      const len = (HZ - 1.2) - quayGANG_HZ;
      body.addShape(new CANNON.Box(new CANNON.Vec3(0.16, 0.62, len * 0.5)),
                    new CANNON.Vec3(s * (HX - 0.10), 0.85, e * (quayGANG_HZ + len * 0.5)));
    }
    body.addShape(new CANNON.Box(new CANNON.Vec3(quayGANG_OUT * 0.5 + 0.05, 0.14, quayGANG_HZ)),
                  new CANNON.Vec3(s * (HX + quayGANG_OUT * 0.5), 0.30, 0));
  }
  // and the house, so you can climb it but not walk through it
  body.addShape(new CANNON.Box(new CANNON.Vec3(HX - 0.5, 0.95, 2.6)),
                new CANNON.Vec3(0, 1.35, -1.2));
  // A KINEMATIC BODY AT REST FALLS ASLEEP. She is berthed with her velocity
  // explicitly zeroed (see onEnter and the idle branch of quayUpdateBoat) —
  // which is precisely what cannon's sleep heuristic is waiting for — and once
  // she is asleep she is skipped in narrowphase, stops being integrated, and
  // cannot be woken by sleepTick again at any speed, because that only ever
  // promotes SLEEPY. She is the deck the whole chapter is played on and the
  // only rideable kinematic body in the game that was missing this line.
  body.allowSleep = false;
  body.position.set(quayBERTH.x, quayWATER_Y + quayBOAT_DECK, quayBERTH.z);
  body.previousPosition.copy(body.position);

  body.interpolatedPosition.copy(body.position);
  body.previousQuaternion.copy(body.quaternion);
  body.interpolatedQuaternion.copy(body.quaternion);
  game.world.addBody(body);
  quayBoatBody = body;
  quayBoatX = quayBERTH.x; quayBoatZ = quayBERTH.z; quayBoatYaw = quayBERTH.yaw;
  g.position.set(quayBoatX, body.position.y, quayBoatZ);
}

// ==================================================================== WAKE ==
// A ring buffer of foam quads dropped behind the boat and left to spread and
// fade. One instanced draw for the whole wake and the bow spray together.
function quayBuildWake(root) {
  const im = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    mat(PALETTE.seaFoam, { transparent: true, opacity: 0.55, depthWrite: false }),
    quayWakeN);
  im.frustumCulled = false;
  im.castShadow = false; im.receiveShadow = false;
  for (let i = 0; i < quayWakeN; i++) {
    quayWakeL[i] = 0;
    im.setMatrixAt(i, quayXform(0, -900, 0, 0, 0, 0, 0.001, 0.001, 0.001));
  }
  im.instanceMatrix.needsUpdate = true;
  quayWakeMesh = im;
  root.add(im);
}

function quayUpdateWake(dt) {
  const im = quayWakeMesh;
  if (!im) return;
  const sp = Math.abs(quayBoatSpeed);
  quayWakeT -= dt;
  if (sp > 1.2 && quayWakeT <= 0) {
    quayWakeT = 0.10;
    const i = quayWakeHead;
    quayWakeHead = (quayWakeHead + 1) % quayWakeN;
    // dropped a little astern, alternating to port and starboard so the wake
    // reads as the two arms of a V rather than one smeared line
    const back = -Math.sin(quayBoatYaw) * (quayBOAT_HZ - 0.5);
    const backz = -Math.cos(quayBoatYaw) * (quayBOAT_HZ - 0.5);
    const side = (i % 2 ? 1 : -1) * 1.5;
    quayWakeX[i] = quayBoatX + back + Math.cos(quayBoatYaw) * side;
    quayWakeZ[i] = quayBoatZ + backz - Math.sin(quayBoatYaw) * side;
    quayWakeL[i] = 1;
    quayWakeS[i] = 1.6 + sp * 0.22;
    quayWakeYw[i] = quayBoatYaw;
  }
  let dirty = false;
  for (let i = 0; i < quayWakeN; i++) {
    if (quayWakeL[i] <= 0) continue;
    dirty = true;
    quayWakeL[i] -= dt * 0.42;
    if (quayWakeL[i] <= 0) {
      quayWakeL[i] = 0;
      im.setMatrixAt(i, quayXform(0, -900, 0, 0, 0, 0, 0.001, 0.001, 0.001));
      continue;
    }
    const age = 1 - quayWakeL[i];
    const s = quayWakeS[i] * (0.6 + age * 2.6);
    // ON the swell, not seven centimetres over the DATUM. quaySurfaceY runs
    // between -0.79 and -0.21 and every wake quad in this chapter was pinned to
    // -0.43, so the boat's own wake spent most of its life inside the sea and
    // was z-clipped away in bands — the most-looked-at effect in the chapter,
    // flickering, for want of one function call. Same fix as the buoys.
    // ALIGNED WITH HER TRACK. Every wake quad in this chapter was laid out
    // axis-aligned, so a boat crossing the harbour on any heading but due north
    // left a trail of rectangles lying square to the world — which is exactly
    // what it looks like: pale tiles rather than a wake. Once the plane is laid
    // flat by the -90 about X, the heading goes in the SECOND slot — the same
    // one quayBuildSurf uses to lay foam tangential to a shore.
    im.setMatrixAt(i, quayXform(quayWakeX[i], quaySurfaceY(quayWakeX[i], quayWakeZ[i]) + 0.07,
                                quayWakeZ[i], -Math.PI / 2, quayWakeYw[i], 0, s, s * 1.5, 1));
  }
  if (dirty) im.instanceMatrix.needsUpdate = true;
  im.material.opacity = 0.16 + clamp(sp / quayBOAT_VMAX, 0, 1) * 0.42;
}

// ============================================================== THE FRESHWATER ==
// THE MINI, and the only other thing on this harbour with an engine in it.
//
// Chapter 3 is the shortest list in the game — seven lines — and every one of
// them happens to the boat you are driving. Nothing else out there was going
// anywhere: eleven buoys, six yachts ping-ponging across their own legs, and
// four hundred metres of very empty water on the way to Manly.
//
// So there is a proper Manly ferry on the run now, north-east of the fairway,
// going the other way. She is 34 m long, she is on the same water you are, and
// the whole mini is one sentence of seamanship: get inside eighty metres, blow
// your horn, and SHE ANSWERS — a note four times lower than yours, four hundred
// tonnes of it — and then twelve seconds later her wash reaches you and rolls
// the boat over, because that is what actually happens and nobody ever tells
// you it is going to.
//
// She runs the far side of the channel on purpose. Getting the salute means
// steering for her, which is the difference between a set piece and a cutscene.
const quayBIG_A = { x: 44, z: -66 };      // the Quay approach, off the Opera House
const quayBIG_B = { x: 132, z: -524 };    // and the fairway off Manly
const quayBIG_SPEED = 8.6;                // m/s — a fraction faster than you
const quayBIG_DWELL = 11.0;               // s at each end, swinging on the wharf
const quayBIG_HX = 4.3;
const quayBIG_HZ = 17.0;
const quayBIG_HAIL = 82;                  // m inside which she can hear you
const quayBIG_ANSWER = 1.5;               // s before she answers — she is not quick
const quayBIG_WASH = 10.5;                // s after that before her wash arrives
let quayBigGroup = null;
let quayBigBody = null;
let quayBigSmoke = null;
let quayBigU = 0;                         // 0..1 along A -> B
let quayBigDir = 1;
let quayBigDwell = quayBIG_DWELL;
let quayBigMover = null, quayBigThr = 0;   // her engine, and its ramp (A1)
let quayBigYaw = 0;
let quayBigPX = 0, quayBigPZ = 0;
let quayBigAnswerT = -1;                  // counting down to her reply
let quayBigWashT = -1;                    // counting down to the wash arriving
let quayBigRoll = 0;                      // seconds of roll left in the boat
let quayBigSaluted = false;
let quayBigSmokeT = 0;
const quayBigPos = new THREE.Vector3();

function quayBuildBigFerry(game, root) {
  const F = quayMerger();
  const HX = quayBIG_HX, HZ = quayBIG_HZ;
  // hull, boot topping and a rubbing strake, double-ended like everything on
  // this harbour has been since 1901
  F.box(0, -1.05, 0, HX * 2, 2.90, HZ * 2 - 5.0, PALETTE.hullGreen);
  F.box(0, -2.25, 0, HX * 2 - 0.7, 0.80, HZ * 2 - 4.4, PALETTE.hullBoot);
  F.box(0, 0.34, 0, HX * 2 + 0.30, 0.26, HZ * 2 - 4.6, PALETTE.hullCream);
  for (let s = -1; s <= 1; s += 2) {
    for (let k = 0; k < 4; k++) {
      const t = k / 4;
      F.box(0, -1.05, s * (HZ - 2.5 + k * 0.62), HX * 2 * (1 - t * 0.62), 2.90 - t * 0.5, 1.24,
            PALETTE.hullGreen);
    }
    F.box(0, 0.72, s * (HZ - 1.1), 2.6, 0.9, 2.2, PALETTE.hullCream);
  }
  // main deck, saloon, promenade deck, upper saloon
  F.box(0, 0.62, 0, HX * 2 - 0.4, 0.30, HZ * 2 - 4.8, PALETTE.deckTeak);
  F.box(0, 2.10, 0, HX * 2 - 1.0, 2.70, HZ * 2 - 9.0, PALETTE.hullCream);
  F.box(0, 2.35, 0, HX * 2 - 0.6, 1.10, HZ * 2 - 8.6, PALETTE.glass);
  F.box(0, 3.60, 0, HX * 2 - 0.2, 0.26, HZ * 2 - 8.0, PALETTE.deckTeak);
  for (let s = -1; s <= 1; s += 2) {
    F.box(s * (HX - 0.5), 4.05, 0, 0.14, 0.90, HZ * 2 - 8.2, PALETTE.hullCream);
  }
  F.box(0, 5.00, 0, HX * 2 - 2.4, 2.50, HZ * 2 - 15.0, PALETTE.hullCream);
  F.box(0, 5.20, 0, HX * 2 - 2.0, 1.00, HZ * 2 - 14.6, PALETTE.glass);
  F.box(0, 6.35, 0, HX * 2 - 1.8, 0.24, HZ * 2 - 14.0, PALETTE.hullGreen);
  // wheelhouses, one at each end, because she never turns round
  for (let s = -1; s <= 1; s += 2) {
    F.box(0, 7.05, s * 3.2, 3.6, 1.40, 2.4, PALETTE.hullCream);
    F.box(0, 7.25, s * 3.2, 3.2, 0.70, 2.6, PALETTE.glass);
    F.box(0, 7.85, s * 3.2, 3.9, 0.20, 2.7, PALETTE.hullGreen);
  }
  // the funnel: the one red thing on her, and the thing you will see first
  F.cyl(0, 8.30, 0, 1.15, 3.40, PALETTE.hullCream, 0, 0, 0, 8);
  F.cyl(0, 10.15, 0, 1.22, 0.55, PALETTE.hullRed, 0, 0, 0, 8);
  F.cyl(0, 8.10, -2.60, 0.14, 5.20, PALETTE.metal, 0, 0, 0, 6);
  const hull = new THREE.Mesh(F.build(), quayVC());
  hull.castShadow = true;
  hull.receiveShadow = true;
  quayBigGroup = new THREE.Group();
  quayBigGroup.name = 'quayFreshwater';
  quayBigGroup.add(hull);

  // The puff off the funnel when she answers. One sphere, scaled and faded —
  // she is never closer than about thirty metres and this does not need to be
  // a particle system.
  quayBigSmoke = new THREE.Mesh(quayG.sph6,
    mat(PALETTE.sail, { transparent: true, opacity: 0.0, fog: true }));
  quayBigSmoke.position.set(0, 11.4, 0);
  quayBigSmoke.visible = false;
  quayBigGroup.add(quayBigSmoke);
  root.add(quayBigGroup);

  // She is SOLID. Four hundred tonnes you can drive through is worse than no
  // ferry at all, and the one body she needs is the hull.
  const b = new CANNON.Body({
    mass: 0, type: CANNON.Body.KINEMATIC,
    material: game.mats ? game.mats.ground : undefined,
  });
  b.addShape(new CANNON.Box(new CANNON.Vec3(HX, 1.9, HZ)), new CANNON.Vec3(0, 0.4, 0));
  b.allowSleep = false;
  quayBigU = 0.32; quayBigDir = 1; quayBigDwell = 0;
  quayBigAnswerT = -1; quayBigWashT = -1; quayBigRoll = 0; quayBigSaluted = false;
  quayBigYaw = Math.atan2(quayBIG_B.x - quayBIG_A.x, quayBIG_B.z - quayBIG_A.z);
  quayBigPX = lerp(quayBIG_A.x, quayBIG_B.x, quayBigU);
  quayBigPZ = lerp(quayBIG_A.z, quayBIG_B.z, quayBigU);
  b.position.set(quayBigPX, quayWATER_Y + 2.4, quayBigPZ);
  b.quaternion.setFromEuler(0, quayBigYaw, 0);
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
  b.previousQuaternion.copy(b.quaternion);
  b.interpolatedQuaternion.copy(b.quaternion);
  game.world.addBody(b);
  quayBigBody = b;
  quayBigPos.set(quayBigPX, quayWATER_Y + 2.4, quayBigPZ);
  quayBigGroup.position.copy(quayBigPos);
  quayBigGroup.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
}

/**
 * HER WAKE, AND HER FUNNEL.
 *
 * She is thirty-four metres of ship crossing the fairway at eight and a half
 * metres a second and she left the harbour exactly as she found it: no wash, no
 * smoke, nothing. The player's own six-metre launch has had a wake since the
 * chapter was written, so the largest moving object in the picture was also the
 * only one the water had not noticed.
 *
 * The wake is the same ring buffer the launch uses at twice the scale and half
 * the decay — a big ship's wash is still there a long time after she is. The
 * funnel is eight soft spheres rising and spreading off the top of her; it is
 * what makes her read as something with an engine in it from four hundred
 * metres, which is the range at which you first see her.
 */
const quayBigWakeN = 22;
const quayBigWakeX = new Float32Array(quayBigWakeN);
const quayBigWakeZ = new Float32Array(quayBigWakeN);
const quayBigWakeL = new Float32Array(quayBigWakeN);
const quayBigWakeYw = new Float32Array(quayBigWakeN);
let quayBigWakeHead = 0, quayBigWakeT = 0, quayBigWake = null;
const quayBigPuffN = 8;
const quayBigPuffData = new Float32Array(quayBigPuffN * 4);   // x, y, z, life
let quayBigPuff = null, quayBigPuffT = 0;

function quayBuildBigWake(root) {
  quayBigWake = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    mat(PALETTE.seaFoam, { transparent: true, opacity: 0.42, depthWrite: false }),
    quayBigWakeN);
  quayBigWake.frustumCulled = false;
  quayBigWake.castShadow = false; quayBigWake.receiveShadow = false;
  for (let i = 0; i < quayBigWakeN; i++) {
    quayBigWakeL[i] = 0;
    quayBigWake.setMatrixAt(i, quayXform(0, -900, 0, 0, 0, 0, 0.001, 0.001, 0.001));
  }
  quayBigWake.instanceMatrix.needsUpdate = true;
  root.add(quayBigWake);

  quayBigPuff = new THREE.InstancedMesh(quayG.sph6,
    mat(PALETTE.sail, { transparent: true, opacity: 0.30, depthWrite: false }), quayBigPuffN);
  quayBigPuff.frustumCulled = false;
  quayBigPuff.castShadow = false;
  for (let i = 0; i < quayBigPuffN; i++) {
    quayBigPuffData[i * 4 + 3] = 0;
    quayBigPuff.setMatrixAt(i, quayXform(0, -900, 0, 0, 0, 0, 0.001, 0.001, 0.001));
  }
  quayBigPuff.instanceMatrix.needsUpdate = true;
  root.add(quayBigPuff);
}

function quayUpdateBigWake(dt) {
  const moving = quayBigDwell <= 0;
  // ---- the wash -----------------------------------------------------------
  if (quayBigWake) {
    quayBigWakeT -= dt;
    if (moving && quayBigWakeT <= 0) {
      quayBigWakeT = 0.16;
      const i = quayBigWakeHead;
      quayBigWakeHead = (quayBigWakeHead + 1) % quayBigWakeN;
      const back = -Math.sin(quayBigYaw) * (quayBIG_HZ - 1);
      const backz = -Math.cos(quayBigYaw) * (quayBIG_HZ - 1);
      const side = (i % 2 ? 1 : -1) * 3.2;
      quayBigWakeX[i] = quayBigPos.x + back + Math.cos(quayBigYaw) * side;
      quayBigWakeZ[i] = quayBigPos.z + backz - Math.sin(quayBigYaw) * side;
      quayBigWakeL[i] = 1;
      quayBigWakeYw[i] = quayBigYaw;
    }
    let dirty = false;
    for (let i = 0; i < quayBigWakeN; i++) {
      if (quayBigWakeL[i] <= 0) continue;
      dirty = true;
      quayBigWakeL[i] -= dt * 0.22;
      if (quayBigWakeL[i] <= 0) {
        quayBigWakeL[i] = 0;
        quayBigWake.setMatrixAt(i, quayXform(0, -900, 0, 0, 0, 0, 0.001, 0.001, 0.001));
        continue;
      }
      const age = 1 - quayBigWakeL[i];
      const s = 4.2 * (0.55 + age * 3.4);
      quayBigWake.setMatrixAt(i, quayXform(quayBigWakeX[i],
                                           quaySurfaceY(quayBigWakeX[i], quayBigWakeZ[i]) + 0.07,
                                           quayBigWakeZ[i], -Math.PI / 2, quayBigWakeYw[i], 0,
                                           s, s * 1.4, 1));
    }
    if (dirty) quayBigWake.instanceMatrix.needsUpdate = true;
    quayBigWake.material.opacity = 0.10 + (moving ? 0.28 : 0.06);
  }

  // ---- the funnel ---------------------------------------------------------
  if (!quayBigPuff) return;
  quayBigPuffT -= dt;
  if (quayBigPuffT <= 0) {
    quayBigPuffT = moving ? 0.62 : 1.6;
    for (let i = 0; i < quayBigPuffN; i++) {
      if (quayBigPuffData[i * 4 + 3] > 0) continue;
      quayBigPuffData[i * 4] = quayBigPos.x;
      quayBigPuffData[i * 4 + 1] = quayWATER_Y + 12.6;
      quayBigPuffData[i * 4 + 2] = quayBigPos.z;
      quayBigPuffData[i * 4 + 3] = 1;
      break;
    }
  }
  let live = false;
  for (let i = 0; i < quayBigPuffN; i++) {
    const o = i * 4;
    if (quayBigPuffData[o + 3] <= 0) continue;
    live = true;
    quayBigPuffData[o + 3] -= dt * 0.14;
    // it rises and it falls ASTERN, because she is going somewhere
    quayBigPuffData[o + 1] += dt * 1.5;
    quayBigPuffData[o] -= Math.sin(quayBigYaw) * quayBIG_SPEED * 0.55 * dt;
    quayBigPuffData[o + 2] -= Math.cos(quayBigYaw) * quayBIG_SPEED * 0.55 * dt;
    const L = quayBigPuffData[o + 3];
    if (L <= 0) {
      quayBigPuff.setMatrixAt(i, quayXform(0, -900, 0, 0, 0, 0, 0.001, 0.001, 0.001));
      continue;
    }
    const s = 2.2 + (1 - L) * 11;
    quayBigPuff.setMatrixAt(i, quayXform(quayBigPuffData[o], quayBigPuffData[o + 1],
                                         quayBigPuffData[o + 2], 0, i, 0, s, s * 0.72, s));
  }
  if (live) quayBigPuff.instanceMatrix.needsUpdate = true;
  quayBigPuff.material.opacity = 0.18;
}

/** Metres from the player's boat to the Freshwater. */
function quayBigRange() {
  return Math.hypot(quayBoatX - quayBigPos.x, quayBoatZ - quayBigPos.z);
}

/** Called from the helm's horn: she may or may not be in earshot. */
function quayBigHail() {
  if (quayBigAnswerT >= 0 || quayBigWashT >= 0) return false;
  if (quayBigRange() > quayBIG_HAIL) return false;
  quayBigAnswerT = quayBIG_ANSWER;
  return true;
}

function quayUpdateBigFerry(game, dt) {
  const b = quayBigBody;
  if (!b || dt <= 0) { if (b) b.velocity.setZero(); return; }
  const total = Math.hypot(quayBIG_B.x - quayBIG_A.x, quayBIG_B.z - quayBIG_A.z);
  if (quayBigDwell > 0) {
    quayBigDwell -= dt;
  } else {
    quayBigU += quayBIG_SPEED / total * dt * quayBigDir;
    if (quayBigU >= 1) { quayBigU = 1; quayBigDir = -1; quayBigDwell = quayBIG_DWELL; }
    else if (quayBigU <= 0) { quayBigU = 0; quayBigDir = 1; quayBigDwell = quayBIG_DWELL; }
  }
  const tx = lerp(quayBIG_A.x, quayBIG_B.x, quayBigU);
  const tz = lerp(quayBIG_A.z, quayBIG_B.z, quayBigU);
  const tyaw = Math.atan2(quayBIG_B.x - quayBIG_A.x, quayBIG_B.z - quayBIG_A.z) +
               (quayBigDir > 0 ? 0 : Math.PI);
  let d = tyaw - quayBigYaw;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  quayBigYaw += d * (1 - Math.exp(-0.9 * dt));

  const swell = Math.sin(quayTime * 0.55 + tz * 0.01) * 0.09;
  b.position.set(tx, quayWATER_Y + 2.4 + swell, tz);
  quayEu.set(0, quayBigYaw, Math.sin(quayTime * 0.7) * 0.012, 'YXZ');
  quayQ.setFromEuler(quayEu);
  b.quaternion.set(quayQ.x, quayQ.y, quayQ.z, quayQ.w);
  b.velocity.set(clamp((tx - quayBigPX) / dt, -16, 16), 0, clamp((tz - quayBigPZ) / dt, -16, 16));
  quayBigPX = tx; quayBigPZ = tz;
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
  b.previousQuaternion.copy(b.quaternion);
  b.interpolatedQuaternion.copy(b.quaternion);
  quayBigGroup.position.copy(b.position);
  quayBigGroup.quaternion.set(quayQ.x, quayQ.y, quayQ.z, quayQ.w);
  quayBigPos.copy(quayBigGroup.position);
  // ---- ...AND YOU CAN HEAR HER COMING (A1) -------------------------------
  // The other ferry is the one thing in chapter three that crosses the whole
  // harbour, and she did it in silence: a hull, a wake and a horn at the
  // terminus. `quayBigBody.velocity` is already the world-space metres a second
  // she is driven on, differenced against the previous TARGET, so it is exactly
  // the number the Doppler wants.
  if (!quayBigMover && game.sfxMover) {
    quayBigMover = game.sfxMover('diesel', { key: 'quay:freshwater', near: 14, far: 260 });
  }
  if (quayBigMover) {
    quayBigMover.at(quayBigPos.x, quayBigPos.y + 1.6, quayBigPos.z);
    quayBigMover.vel(quayBigBody.velocity.x, 0, quayBigBody.velocity.z);
    // She is at 8.6 or she is alongside — the position integration has no ramp
    // in it, so putting one in the throttle would only desync it from `vel`.
    // Damped here, and never to zero: a ferry at a wharf is idling.
    quayBigThr = damp(quayBigThr, quayBigDwell > 0 ? 0.22 : 1, 1.6, dt);
    quayBigMover.set(quayBigThr);
  }

  // ---- the answer ---------------------------------------------------------
  if (quayBigAnswerT >= 0) {
    quayBigAnswerT -= dt;
    if (quayBigAnswerT < 0) {
      // A quarter of your pitch and all of the volume. a forced sfx is not needed:
      // the player's own horn was 1.5 s ago and the gap on 'horn' is 2.2, so
      // the reply has to WAIT for it — which is also how it should sound.
      //
      // ...AND IT COMES FROM HER. This was mono at full level: the Freshwater
      // answers from as far as quayBIG_HAIL (82 m) off your beam and it arrived
      // dead centre on the player's own foredeck, with no pan and no distance
      // in it — which is exactly what the arrival horn eighty lines down was
      // already fixed for, on a hull whose position is right here in
      // quayBigPos. Near/far are hers, not the player's: she is enormous and
      // she carries, so the far plane is the arrival horn's.
      if (typeof game.sfx === 'function') {
        game.sfx('horn', { volume: 1.0, pitch: 0.44,
                           at: { x: quayBigPos.x, y: quayWATER_Y + 6.0, z: quayBigPos.z },
                           near: 26, far: 260 });
      }
      if (typeof game.shake === 'function') game.shake(0.05);
      // AND FOURTEEN PEOPLE ON HER RAIL PUT A HAND UP. See quayBuildPax: the
      // salute was four hundred tonnes of sound and nothing that was a person.
      quayBigWave = 3.4;
      quayBigSmokeT = 2.6;
      quayBigWashT = quayBIG_WASH;
      if (!quayBigSaluted) {
        quayBigSaluted = true;
        quayTask('ferry-salute');
      }
    }
  }
  // ---- her wash, which arrives long after she does -------------------------
  if (quayBigWashT >= 0) {
    quayBigWashT -= dt;
    if (quayBigWashT < 0) {
      quayBigRoll = 6.0;
      if (typeof game.sfx === 'function') game.sfx('splash', { volume: 0.6, pitch: 0.7 });
      if (typeof game.toast === 'function') game.toast('here it comes');
    }
  }
  if (quayBigRoll > 0) quayBigRoll -= dt;
  if (quayBigWave > 0) quayBigWave -= dt;
  quayUpdatePax();
  // the funnel puff
  if (quayBigSmoke) {
    if (quayBigSmokeT > 0) {
      quayBigSmokeT -= dt;
      const t = clamp(1 - quayBigSmokeT / 2.6, 0, 1);
      quayBigSmoke.visible = true;
      quayBigSmoke.position.set(0, 11.4 + t * 6.5, 0);
      const sc = 2.4 + t * 7.0;
      quayBigSmoke.scale.set(sc, sc, sc);
      quayBigSmoke.material.opacity = 0.55 * (1 - t);
    } else if (quayBigSmoke.visible) {
      quayBigSmoke.visible = false;
    }
  }
}

/** Extra heel on the player's boat while the Freshwater's wash is under her. */
// ---- THE HEADS (W1) --------------------------------------------------------
// Seventy seconds of open water with one event in it (the Freshwater's wash,
// if she happens to pass). The passage has a middle now: between North and
// South Head the harbour is open to the Tasman and the swell comes in under
// her — a metre of lift on a nine-second period, a pitch you can see on the
// bow, spray over it at speed — and Manly Cove behind the Heads is flat again.
// A bell curve in z, 0 inside the harbour and in the cove, 1 in the gap.
const quayHEADS_Z0 = -230;   // where the swell starts to be felt
const quayHEADS_Z1 = -360;   // the middle of the gap
const quayHEADS_Z2 = -470;   // flat again, in the cove
const quayHEADS_LIFT = 0.85; // m, crest to trough is twice this
const quayHEADS_W = 0.68;    // rad/s — a nine-second ocean swell
let quayHeadsK = 0;          // 0..1, damped, how much sea is under her right now
function quayHeadsAt(z) {
  if (z > quayHEADS_Z0 || z < quayHEADS_Z2) return 0;
  const t = z > quayHEADS_Z1 ? (quayHEADS_Z0 - z) / (quayHEADS_Z0 - quayHEADS_Z1)
                             : (z - quayHEADS_Z2) / (quayHEADS_Z1 - quayHEADS_Z2);
  return t * t * (3 - 2 * t);
}

function quayWashHeel() {
  if (quayBigRoll <= 0) return 0;
  // A wash is two or three big ones and then nothing, so the envelope decays
  // and the period is long — this is a swell, not a shudder.
  return Math.sin(quayBigRoll * 3.4) * 0.13 * clamp(quayBigRoll / 6.0, 0, 1);
}

// ================================================================== REGATTA ==
function quayBuildFleet(root) {
  const n = quayFLEET.length / 6;
  const H = quayMerger();
  H.box(0, 0.05, 0, 1.7, 0.7, 7.2, PALETTE.hullCream);
  H.box(0, -0.28, 0, 1.5, 0.35, 6.8, PALETTE.hullBoot);
  H.box(0, 0.42, 0, 1.3, 0.16, 5.4, PALETTE.deckTeak);
  H.cyl(0, 4.4, 0.6, 0.09, 8.4, PALETTE.sail, 0, 0, 0, 6);
  const hullGeo = H.build();
  quayFleetMesh = new THREE.InstancedMesh(hullGeo, quayVC(), n);
  quayFleetMesh.castShadow = true;
  quayFleetMesh.frustumCulled = false;
  root.add(quayFleetMesh);

  // sails: two triangles per boat, one instanced draw
  const S = new THREE.BufferGeometry();
  S.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0.4, 0.4, 0, 8.1, 0.6, 0, 0.5, -3.4,       // main
    0, 0.4, 0.7, 0, 6.4, 0.7, 0, 0.5, 3.3,        // jib
  ], 3));
  S.setIndex([0, 1, 2, 3, 4, 5]);
  S.computeVertexNormals();
  quayFleetSail = new THREE.InstancedMesh(S, mat(PALETTE.sail, { side: THREE.DoubleSide }), n);
  quayFleetSail.castShadow = false;
  quayFleetSail.frustumCulled = false;
  root.add(quayFleetSail);
}

function quayUpdateFleet() {
  if (!quayFleetMesh) return;
  const n = quayFLEET.length / 6;
  for (let i = 0; i < n; i++) {
    const o = i * 6;
    const x0 = quayFLEET[o], z0 = quayFLEET[o + 1], x1 = quayFLEET[o + 2], z1 = quayFLEET[o + 3];
    const per = quayFLEET[o + 4];
    // a slow ping-pong along the leg, easing at each end like a boat tacking
    const u = 0.5 - 0.5 * Math.cos((quayTime / per + i * 0.37) * Math.PI * 2);
    const x = lerp(x0, x1, u), z = lerp(z0, z1, u);
    const dir = Math.sin((quayTime / per + i * 0.37) * Math.PI * 2) >= 0 ? 1 : -1;
    const yaw = Math.atan2((x1 - x0) * dir, (z1 - z0) * dir);
    const heel = 0.20 * dir + Math.sin(quayTime * 1.1 + i) * 0.05;
    const bob = Math.sin(quayTime * 1.6 + i * 2.1) * 0.14;
    quayFleetMesh.setMatrixAt(i, quayXform(x, quayWATER_Y + 0.35 + bob, z, 0, yaw, heel, 1, 1, 1));
    quayFleetSail.setMatrixAt(i, quayXform(x, quayWATER_Y + 0.35 + bob, z, 0, yaw, heel, 1, 1, 1));
  }
  quayFleetMesh.instanceMatrix.needsUpdate = true;
  quayFleetSail.instanceMatrix.needsUpdate = true;
}

// ==================================================================== BUOYS ==
/**
 * ELEVEN BUOYS, AND NOT ONE OF THEM MOVED.
 *
 * They were a single merged mesh at a fixed height, which is exactly right for
 * a headland and exactly wrong for the only objects in this chapter that are
 * FLOATING. The sea under them rises and falls twenty-nine centimetres and they
 * stood through it like bollards, which is the tell that made a moving harbour
 * read as a painted one — a buoy is the reference the eye uses to decide whether
 * water is water.
 *
 * So: one instance per buoy, three merged sub-meshes deep, riding quaySurfaceY
 * exactly as everything else on this water does, and LEANING — the tilt is the
 * gradient of the same surface, so a buoy nods into the trough it is in rather
 * than wobbling on a timer of its own.
 */
function quayBuildBuoys(root) {
  const n = quayBUOYS.length / 3;
  const cols = [PALETTE.buoyRed, PALETTE.buoyGreen, PALETTE.buoyYellow];
  quayBuoyMesh = [];
  for (let c = 0; c < 3; c++) {
    const M = quayMerger();
    M.cyl(0, 1.05, 0, 0.85, 1.9, cols[c], 0, 0, 0, 8);
    M.cone(0, 2.35, 0, 0.85, 0.9, cols[c], 0, 0, 0, 6);
    M.cyl(0, 3.10, 0, 0.10, 1.5, PALETTE.metal, 0, 0, 0, 6);
    M.sph(0, 3.90, 0, 0.26, 0.30, 0.26, PALETTE.sail);
    // the yellow one is the TURN, and a turning mark on this harbour carries a
    // bell — a cage of four ribs with the clapper swinging in it
    if (c === 2) {
      for (let k = 0; k < 4; k++) {
        const a = k / 4 * Math.PI * 2;
        M.box(Math.cos(a) * 0.30, 3.10, Math.sin(a) * 0.30, 0.07, 1.3, 0.07, PALETTE.metal);
      }
      M.cyl(0, 3.62, 0, 0.30, 0.44, PALETTE.brassTrim, 0, 0, 0, 8);
    }
    let count = 0;
    for (let i = 0; i < n; i++) if (quayBUOYS[i * 3 + 2] === c) count++;
    if (!count) continue;
    const im = new THREE.InstancedMesh(M.build(), quayVC(), count);
    im.castShadow = true;
    im.frustumCulled = false;
    const idx = [];
    for (let i = 0; i < n; i++) if (quayBUOYS[i * 3 + 2] === c) idx.push(i);
    im.userData.idx = idx;
    root.add(im);
    quayBuoyMesh.push(im);
  }
  quayUpdateBuoys();
}

// ---- WHAT HAPPENS WHEN YOU HIT ONE -------------------------------------
// Nine fairway marks strung up seven hundred metres of open water, and until
// now the only thing they did was hold gulls. quayHARD is deliberately hard —
// rock, pylons, the Freshwater — and a buoy is the opposite of hard: it is a
// float on a chain, and a ferry that clouts one pushes it clean under and
// leaves it bobbing back up behind her with the bell going.
//
// That is worth having because it is the one collision in the chapter that is
// FUNNY rather than a punishment. Bad steering into rock stops you dead and
// tells you off; bad steering into a mark makes a noise, rings a bell, throws
// water and costs you absolutely nothing. A boat chapter needs both.
const quayBuoyDunk = new Float32Array(quayBUOYS.length / 3);
let quayBuoyHitCd = 0;

function quayBuoyStrike(game, dt) {
  const n = quayBUOYS.length / 3;
  if (quayBuoyHitCd > 0) quayBuoyHitCd -= dt;
  for (let i = 0; i < n; i++) {
    if (quayBuoyDunk[i] > 0) quayBuoyDunk[i] = Math.max(0, quayBuoyDunk[i] - dt);
  }
  if (quayBuoyHitCd > 0 || Math.abs(quayBoatSpeed) < 1.4) return;
  for (let i = 0; i < n; i++) {
    if (quayBuoyDunk[i] > 0) continue;
    const dx = quayBoatX - quayBUOYS[i * 3], dz = quayBoatZ - quayBUOYS[i * 3 + 1];
    if (dx * dx + dz * dz > 4.6 * 4.6) continue;
    quayBuoyDunk[i] = 2.4;
    quayBuoyHitCd = 0.8;
    const k = clamp(Math.abs(quayBoatSpeed) / quayBOAT_VMAX, 0, 1);
    const bx = quayBUOYS[i * 3], bz = quayBUOYS[i * 3 + 1];
    if (typeof game.sfx === 'function') {
      // the bell on the cage, then the water closing over it
      game.sfx('clink', { volume: 0.55 + k * 0.35, pitch: 0.72,
                          at: { x: bx, y: quayWATER_Y + 1.4, z: bz }, near: 12, far: 140 });
      game.sfx('splash', { volume: 0.45 + k * 0.4, pitch: 0.85,
                           at: { x: bx, y: quayWATER_Y, z: bz }, near: 12, far: 140 });
    }
    for (let q = 0; q < 7; q++) {
      quaySprayEmit(bx + rand(-1.1, 1.1), quayWATER_Y + 0.3, bz + rand(-1.1, 1.1),
                    rand(-2.4, 2.4), rand(2.2, 5.0) * (0.6 + k), rand(-2.4, 2.4), 0.8);
    }
    if (typeof game.shake === 'function') game.shake(0.06 + k * 0.06);
    if (typeof game.toast === 'function' && k > 0.55) game.toast('that mark was there for a reason');
    // …AND WHOEVER WAS SITTING ON IT. quayUpdateGulls pins a perched bird to
    // the buoy's OWN bob and not to the dunk, so without this the mark goes a
    // metre and a half under and leaves its gull standing on the sea.
    for (let q = 0; q < quayGullN; q++) {
      if (quayGullPerch[q] <= 0 || quayGullBuoy[q] !== i) continue;
      const o = q * 6;
      quayGullPerch[q] = 0;
      quayGullData[o] = bx + rand(-10, 10);
      quayGullData[o + 1] = rand(6, 13);
      quayGullData[o + 2] = bz + rand(-10, 10);
      quayGullData[o + 4] = rand(8, 20);
      if (typeof game.sfx === 'function') {
        game.sfx('gull', { volume: 0.5, pitch: rand(0.95, 1.2),
                           at: { x: bx, y: quayWATER_Y + 2, z: bz }, near: 12, far: 140 });
      }
    }
    break;
  }
}

function quayUpdateBuoys() {
  if (!quayBuoyMesh) return;
  for (let m = 0; m < quayBuoyMesh.length; m++) {
    const im = quayBuoyMesh[m], idx = im.userData.idx;
    for (let k = 0; k < idx.length; k++) {
      const i = idx[k];
      const x = quayBUOYS[i * 3], z = quayBUOYS[i * 3 + 1];
      // …and one that has just been run down is still on its way back up. The
      // curve is a decaying bounce, not a ramp: under fast, up slow, overshoot
      // once, which is what a float on a chain actually does.
      const dk = quayBuoyDunk[i];
      const y = quaySurfaceY(x, z) - (dk > 0 ? Math.sin(dk / 2.4 * Math.PI) * 1.55 * Math.cos(dk * 4.4) : 0);
      // the LEAN is the slope of the water it is sitting in, sampled a metre
      // either side. Nothing to tune, and it is always in phase with the swell.
      const gx = (quaySurfaceY(x + 1, z) - quaySurfaceY(x - 1, z)) * 0.5;
      const gz = (quaySurfaceY(x, z + 1) - quaySurfaceY(x, z - 1)) * 0.5;
      im.setMatrixAt(k, quayXform(x, y - 0.55, z, gz * 2.6, i * 0.7, -gx * 2.6, 1, 1, 1));
    }
    im.instanceMatrix.needsUpdate = true;
  }
}

// ==================================================================== GULLS ==
/**
 * Put the flock back where it lives: circling the fairway buoys, at height, in
 * ones and twos. Called at build and again on every arrival, because
 * quayBurstChips takes the whole flock to Manly and it has to be able to go
 * home again.
 */
function quayScatterGulls() {
  for (let i = 0; i < quayGullN; i++) {
    const o = i * 6;
    const b = randInt(0, quayBUOYS.length / 3 - 1);
    quayGullData[o] = quayBUOYS[b * 3] + rand(-24, 24);
    quayGullData[o + 1] = rand(5, 17);
    quayGullData[o + 2] = quayBUOYS[b * 3 + 1] + rand(-24, 24);
    quayGullData[o + 3] = rand(0, Math.PI * 2);
    quayGullData[o + 4] = rand(7, 22);
    quayGullData[o + 5] = rand(0.25, 0.6);
    // SITTING, OR FLYING. A gull that only ever circles at a fixed radius is a
    // mobile, not a bird — about a third of any flock on this harbour is stood
    // on something, facing the wind, doing nothing whatever. `perch` counts
    // down: above zero it is on the buoy, and when it runs out it takes off.
    quayGullPerch[i] = Math.random() < 0.36 ? rand(3, 26) : 0;
    quayGullBuoy[i] = b;
  }
}

function quayBuildGulls(root) {
  const G = new THREE.BufferGeometry();
  // a two-triangle gull: a shallow V seen from below, which is all you get of a
  // seabird at any honest distance
  G.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, -0.35, -1.15, 0.30, 0.20, 0, 0.02, 0.30,
    0, 0, -0.35, 0, 0.02, 0.30, 1.15, 0.30, 0.20,
  ], 3));
  G.setIndex([0, 1, 2, 3, 4, 5]);
  G.computeVertexNormals();
  quayGullMesh = new THREE.InstancedMesh(G, mat(PALETTE.ibis, { side: THREE.DoubleSide }), quayGullN);
  quayGullMesh.castShadow = false;
  quayGullMesh.frustumCulled = false;
  quayScatterGulls();
  root.add(quayGullMesh);
}

function quayUpdateGulls(dt) {
  if (!quayGullMesh) return;
  for (let i = 0; i < quayGullN; i++) {
    const o = i * 6;
    // ---- the ones that are stood on a buoy -------------------------------
    if (quayGullPerch[i] > 0) {
      quayGullPerch[i] -= dt;
      const b = quayGullBuoy[i] * 3;
      const bx = quayBUOYS[b], bz = quayBUOYS[b + 1];
      // on the cone, riding the buoy's own bob — the buoy is bobbing now, so
      // a bird pinned to a fixed height would be standing beside it
      const bob = quaySurfaceY(bx, bz) - quayWATER_Y;
      // she shuffles round the top of it, and every so often shakes out
      const fac = quayGullData[o + 3] + Math.sin(quayTime * 0.31 + i) * 0.6;
      const ruffle = Math.sin(quayTime * 0.7 + i * 2.1) > 0.94 ? 0.5 : 0.06;
      // THE BUOY IS DRAWN AT `surface - 0.55`, AND THE BIRD WAS NOT.
      // 2.42 is the right height in the buoy's OWN space — it is exactly where
      // the cone's flank has the 0.34 m radius the bird is stood at — but the
      // instance sits 55 cm lower than its origin so that it floats correctly,
      // and the gull was pinned to the origin. Twenty-two seabirds hovering
      // half a metre over the marks, which is the one thing on this water that
      // is supposed to prove the water is real.
      quayGullMesh.setMatrixAt(i, quayXform(
        bx + Math.cos(fac) * 0.34, quayWATER_Y + 1.87 + bob, bz + Math.sin(fac) * 0.34,
        ruffle * 0.4, fac, ruffle, 0.72, 0.72, 0.72));
      if (quayGullPerch[i] <= 0) {
        // taking off: she rejoins the circuit round the buoy she was sat on
        quayGullData[o] = bx + rand(-14, 14);
        quayGullData[o + 1] = rand(5, 15);
        quayGullData[o + 2] = bz + rand(-14, 14);
        quayGullData[o + 4] = rand(7, 22);
      }
      continue;
    }
    quayGullData[o + 3] += quayGullData[o + 5] * dt;
    const a = quayGullData[o + 3], r = quayGullData[o + 4];
    const x = quayGullData[o] + Math.cos(a) * r;
    const z = quayGullData[o + 2] + Math.sin(a) * r;
    const y = quayGullData[o + 1] + Math.sin(a * 2.3) * 1.6;
    // banked into the turn, and the wings beat slowly
    const beat = Math.sin(quayTime * 5 + i) * 0.22;
    quayGullMesh.setMatrixAt(i, quayXform(x, y, z, beat, -a + Math.PI * 0.5, 0.42, 1, 1, 1));
    // ...and once in a while one of them decides to sit down. Only well away
    // from the chip shop: the flock that has just been given fourteen chips is
    // not going to perch, and that is the entire joke of the mini.
    if (!quayChipsGone && Math.random() < dt * 0.028) {
      const b = randInt(0, quayBUOYS.length / 3 - 1);
      quayGullBuoy[i] = b;
      quayGullPerch[i] = rand(6, 30);
      quayGullData[o] = quayBUOYS[b * 3];
      quayGullData[o + 2] = quayBUOYS[b * 3 + 1];
    }
  }
  quayGullMesh.instanceMatrix.needsUpdate = true;
}

// ============================================================== WAKE GULLS ==
// SEVEN HUNDRED METRES OF OPEN WATER AND NOTHING CAME WITH YOU.
//
// The dolphins are a reward — they only turn up over 6.5 m/s and they are the
// point of a task. The gulls on the buoys are scenery, and they stay on their
// buoys. Between the two there was nothing at all that simply CAME ALONG, and
// there is no ferry on this harbour without half a dozen silver gulls hanging
// off the stern hoping somebody drops a chip.
//
// They are not physics and they are not a task. They station-keep in the
// updraught over the transom while she has way on, they fan out and settle
// when she stops, and if you sound the horn under them they scatter and come
// straight back — which is the whole of what a gull thinks about anything.
//
// Deliberately the ONLY thing in the chapter that follows the boat without
// being asked: a reward you have to earn stops feeling like one if the world
// is full of things doing it for free.
const quayWG_N = 9;
const quayWG_STRIDE = 6;      // x, y, z, phase, lag, spook
let quayWakeGull = null;
let quayWGData = null;
let quayWGSpook = 0;

function quayBuildWakeGulls(root) {
  const G = new THREE.BufferGeometry();
  G.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, -0.35, -1.15, 0.30, 0.20, 0, 0.02, 0.30,
    0, 0, -0.35, 0, 0.02, 0.30, 1.15, 0.30, 0.20,
  ], 3));
  G.setIndex([0, 1, 2, 3, 4, 5]);
  G.computeVertexNormals();
  const im = new THREE.InstancedMesh(G, mat(PALETTE.ibis, { side: THREE.DoubleSide }), quayWG_N);
  im.name = 'quayWakeGulls';
  im.castShadow = false;
  im.frustumCulled = false;
  quayWakeGull = im;
  quayWGData = new Float32Array(quayWG_N * quayWG_STRIDE);
  for (let i = 0; i < quayWG_N; i++) {
    const o = i * quayWG_STRIDE;
    quayWGData[o]     = quayBERTH.x + rand(-16, 16);
    quayWGData[o + 1] = quayWATER_Y + rand(5, 12);
    quayWGData[o + 2] = quayBERTH.z + rand(6, 26);
    quayWGData[o + 3] = rand(0, Math.PI * 2);
    quayWGData[o + 4] = rand(0.9, 2.4);         // how far astern this one sits
    quayWGData[o + 5] = 0;
  }
  root.add(im);
}

/** The horn scatters them. Called from the same place the bridge echo is. */
function quayScareWakeGulls(hard) {
  if (!quayWGData) return;
  quayWGSpook = hard ? 2.6 : 1.6;
  for (let i = 0; i < quayWG_N; i++) quayWGData[i * quayWG_STRIDE + 5] = 1;
}

function quayUpdateWakeGulls(game, dt) {
  const im = quayWakeGull;
  if (!im || !quayWGData) return;
  if (quayWGSpook > 0) quayWGSpook -= dt;
  const sp = Math.abs(quayBoatSpeed);
  // Under way? Then the station is the wash behind the transom. Stopped, they
  // hold a loose circle over wherever she happens to be, so a boat left
  // alongside still has a few birds over it.
  const under = clamp((sp - 1.2) / 4.0, 0, 1);
  const cs = Math.cos(quayBoatYaw), sn = Math.sin(quayBoatYaw);
  for (let i = 0; i < quayWG_N; i++) {
    const o = i * quayWG_STRIDE;
    const ph = quayWGData[o + 3] + quayTime * (0.55 + (i % 4) * 0.11);
    const lag = quayWGData[o + 4];
    // station: astern and to one side, in the boat's own frame
    const side = ((i % 3) - 1) * 3.1 + Math.sin(ph) * 1.9;
    const back = -(5.0 + lag * 4.2) - Math.cos(ph * 0.7) * 1.6;
    let tx = quayBoatX + sn * back + cs * side;
    let tz = quayBoatZ + cs * back - sn * side;
    // MEASURED FROM THE PICTURE, not from the number that sounded right. At
    // 3.4 they sat in the plane of the wash and read as debris; the eye wants
    // them above the transom rail, which is at about 1.9.
    let ty = quayWATER_Y + 5.2 + lag * 1.8 + Math.sin(ph * 1.3) * 0.9;
    // stopped: widen out and climb, so they read as loitering rather than towed
    if (under < 1) {
      const w = 1 - under;
      const a = ph * 0.8 + i;
      tx = tx * under + (quayBoatX + Math.cos(a) * (11 + i * 1.7)) * w;
      tz = tz * under + (quayBoatZ + Math.sin(a) * (11 + i * 1.7)) * w;
      ty += w * (2.5 + (i % 5));
    }
    // …and the horn puts them straight up and out for a couple of seconds
    const sc = quayWGData[o + 5];
    if (sc > 0) {
      quayWGData[o + 5] = Math.max(0, sc - dt * 0.55);
      const k = quayWGData[o + 5];
      const a = i * 2.1 + quayTime * 3.2;
      tx += Math.cos(a) * 22 * k;
      tz += Math.sin(a) * 22 * k;
      ty += 12 * k;
    }
    // A gull does not teleport. Damped in all three axes, at a rate that is
    // slow enough to trail and fast enough to keep up with 10.4 m/s.
    const lam = 1.7 + under * 1.6;
    quayWGData[o]     = damp(quayWGData[o], tx, lam, dt);
    quayWGData[o + 1] = damp(quayWGData[o + 1], ty, lam * 0.8, dt);
    quayWGData[o + 2] = damp(quayWGData[o + 2], tz, lam, dt);
    const x = quayWGData[o], y = quayWGData[o + 1], z = quayWGData[o + 2];
    // heading: where they are going, which under way is simply the boat's head
    const yaw = quayBoatYaw + Math.PI + Math.sin(ph) * 0.4 * (1 - under);
    const beat = Math.sin(quayTime * (4.5 + under * 2.5) + i * 1.7) * (0.14 + 0.22 * (1 - under));
    im.setMatrixAt(i, quayXform(x, y, z, beat, yaw, 0.30 * (1 - under * 0.6), 1, 1, 1));
  }
  im.instanceMatrix.needsUpdate = true;
  // and they say so, now and then, while she is running
  if (under > 0.6 && quayWGSpook <= 0 && Math.random() < dt * 0.11) {
    if (typeof game.sfx === 'function') game.sfx('gull', { volume: rand(0.20, 0.34), pitch: rand(0.94, 1.14) });
  }
}

// ================================================================= DOLPHINS ==
// They only turn up when she has way on, and they run alongside the bow. Not
// physics: they are a reward for going fast, and rewards do not need colliders.
function quayBuildDolphins(root) {
  const D = quayMerger();
  D.sph(0, 0, 0, 0.42, 0.44, 1.35, PALETTE.wharfIron);
  D.sph(0, -0.10, 0.05, 0.36, 0.30, 1.15, PALETTE.hullCream);
  D.cone(0, 0, 1.45, 0.30, 0.9, PALETTE.wharfIron, Math.PI / 2, 0, 0);
  D.box(0, 0.44, -0.1, 0.10, 0.52, 0.55, PALETTE.wharfIron, 0.32, 0, 0);
  D.box(0, -0.05, -1.35, 1.05, 0.09, 0.42, PALETTE.wharfIron);
  const geo = D.build();
  quayDolphins = new THREE.InstancedMesh(geo, quayVC(), quayDOLPHIN_N);
  quayDolphins.castShadow = true;
  quayDolphins.frustumCulled = false;
  for (let i = 0; i < quayDOLPHIN_N; i++) {
    const o = i * 4;
    quayDolphinData[o] = 0;
    quayDolphinData[o + 1] = rand(-7, 9);                        // metres fore/aft of the bow
    quayDolphinData[o + 2] = (i % 2 ? 1 : -1) * rand(4.5, 8.5);  // metres abeam
    quayDolphinData[o + 3] = rand(0, Math.PI * 2);
    quayDolphins.setMatrixAt(i, quayXform(0, -900, 0, 0, 0, 0, 0.001, 0.001, 0.001));
  }
  quayDolphins.instanceMatrix.needsUpdate = true;
  root.add(quayDolphins);
}

function quayUpdateDolphins(dt) {
  if (!quayDolphins) return;
  const fast = quayHelmOn && quayBoatSpeed > 6.5;
  quayDolphinOn = damp(quayDolphinOn, fast ? 1 : 0, fast ? 0.7 : 1.4, dt);
  if (quayDolphinOn < 0.01) {
    if (quayDolphinT !== -1) {
      quayDolphinT = -1;
      for (let i = 0; i < quayDOLPHIN_N; i++) {
        quayDolphins.setMatrixAt(i, quayXform(0, -900, 0, 0, 0, 0, 0.001, 0.001, 0.001));
      }
      quayDolphins.instanceMatrix.needsUpdate = true;
    }
    return;
  }
  quayDolphinT = 0;
  const cs = Math.cos(quayBoatYaw), sn = Math.sin(quayBoatYaw);
  for (let i = 0; i < quayDOLPHIN_N; i++) {
    const o = i * 4;
    quayDolphinData[o + 3] += (1.5 + i * 0.13) * dt;
    const ph = quayDolphinData[o + 3];
    const fore = quayDolphinData[o + 1] + Math.sin(ph * 0.7) * 2.6;
    const side = quayDolphinData[o + 2] * (0.8 + 0.25 * Math.sin(ph * 0.41));
    // a porpoise: a sine that spends most of its time under, and a pitch that
    // is the derivative of the leap, so the animal enters and exits nose-first
    const arc = Math.sin(ph);
    const up = arc > 0 ? arc * arc : -0.35 * arc * arc;
    const y = quayWATER_Y - 0.30 + up * 2.3;
    const pitch = -Math.cos(ph) * (arc > 0 ? 0.85 : 0.30);
    const x = quayBoatX + sn * fore + cs * side;
    const z = quayBoatZ + cs * fore - sn * side;
    const s = quayDolphinOn;
    quayDolphins.setMatrixAt(i, quayXform(x, y, z, pitch, quayBoatYaw, 0, s, s, s));
    // ---- AND THE WATER NOTICES ------------------------------------------
    // A dolphin that comes out of the sea and goes back into it without
    // breaking the surface is a fish-shaped object being animated through a
    // plane. The tell is the RE-ENTRY: the leap itself is graceful and the
    // splash is what makes it weigh anything. `arc` crosses zero downward at
    // the moment she goes back in, so that is the frame to throw water.
    const prev = Math.sin(ph - (1.5 + i * 0.13) * dt);
    if (arc <= 0 && prev > 0 && quayDolphinOn > 0.55) {
      for (let k = 0; k < 2; k++) {
        quaySprayEmit(x + rand(-0.4, 0.4), quayWATER_Y + 0.1, z + rand(-0.4, 0.4),
                      rand(-1.6, 1.6), rand(2.2, 3.8), rand(-1.6, 1.6), 0.55);
      }
      if (i === 0 && quayGame && typeof quayGame.sfx === 'function') {
        quayGame.sfx('splash', { volume: 0.22, pitch: 1.35 });
      }
    }
  }
  quayDolphins.instanceMatrix.needsUpdate = true;
}

// ========================================================== THE APRON FLOCK ==
/**
 * THE GULLS THAT ARE ALWAYS ON THE BOLLARDS, AND WHAT HAPPENS WHEN YOU WALK AT
 * THEM.
 *
 * There is a flock four hundred metres out on the fairway buoys and there was
 * not one bird on the ninety-six metres of concourse the chapter opens on — on
 * a Sydney wharf, which is the single most seagull-infested surface in the
 * southern hemisphere. And a bird standing on a bollard is only half of it:
 * the whole pleasure of a wharf gull is that it lets you get to about three
 * metres and then, at the last possible moment, cannot be bothered any more.
 *
 * So: eleven of them, stood on the bollards and the bench backs, and they LIFT
 * when the capybara gets inside three and a half metres — or instantly, all of
 * them, if she wheeks. They circle for a few seconds and settle back on a
 * different perch. One draw call, one distance check, and it is the first
 * thing in the chapter that reacts to you at all.
 */
const quayAG_N = 11;
const quayAG_NEAR = 3.5;            // m off a bollard before she has had enough
let quayAGCrit = null;              // ...and the calm shrinks it. See THE CALM.
let quayApronGull = null, quayAGData = null;
const quayAG_PERCH = [
  [-46, 0.84, quayAPRON_Z + 1.4], [-36, 0.84, quayAPRON_Z + 1.4],
  [-21, 0.84, quayAPRON_Z + 1.4], [-11, 0.84, quayAPRON_Z + 1.4],
  [6, 0.84, quayAPRON_Z + 1.4],   [16, 0.84, quayAPRON_Z + 1.4],
  [36, 0.84, quayAPRON_Z + 1.4],  [46, 0.84, quayAPRON_Z + 1.4],
  [-30, 1.28, quayAPRON_Z1 - 12.1], [6, 1.28, quayAPRON_Z1 - 12.1],
  [30, 1.28, quayAPRON_Z1 - 12.1],
];
function quayBuildApronGulls(root) {
  // a standing gull, not the flying V: body, head, bill, tail
  const G = quayMerger();
  G.sph(0, 0.19, 0, 0.15, 0.14, 0.24, PALETTE.ibis);
  G.sph(0, 0.36, 0.17, 0.09, 0.10, 0.09, PALETTE.ibis);
  G.box(0, 0.35, 0.29, 0.04, 0.04, 0.13, PALETTE.awningManly);
  G.box(0, 0.20, -0.24, 0.11, 0.05, 0.22, PALETTE.stoneDark, -0.35, 0, 0);
  G.box(0.05, 0.06, 0.02, 0.03, 0.12, 0.03, PALETTE.awningManly);
  G.box(-0.05, 0.06, 0.02, 0.03, 0.12, 0.03, PALETTE.awningManly);
  const im = new THREE.InstancedMesh(G.build(), quayVC(), quayAG_N);
  im.castShadow = true;
  im.frustumCulled = false;
  quayApronGull = im;
  root.add(im);
  quayAGData = new Float32Array(quayAG_N * 4);      // perch, flight (0..1), yaw, phase
  for (let i = 0; i < quayAG_N; i++) {
    quayAGData[i * 4] = i;
    quayAGData[i * 4 + 1] = 0;
    quayAGData[i * 4 + 2] = rand(-2.6, 2.6);
    quayAGData[i * 4 + 3] = rand(0, Math.PI * 2);
  }
  quayUpdateApronGulls(null, 0);
}

/** Everything on the concourse goes up at once. Called by the wheek. */
function quayFlushApron(all) {
  if (!quayAGData) return;
  for (let i = 0; i < quayAG_N; i++) {
    if (all || Math.random() < 0.4) {
      if (quayAGData[i * 4 + 1] <= 0) quayAGData[i * 4 + 1] = 1;
    }
  }
}

function quayUpdateApronGulls(game, dt) {
  const im = quayApronGull;
  if (!im) return;
  const capy = game && game.capy && game.capy.position ? game.capy.position : null;
  if (!quayAGCrit && game && typeof game.addCritter === 'function') {
    // bold 0.9, the same as Manly's gulls, because they are the same birds and
    // a silver gull on a ferry apron is the least frightened animal in Sydney.
    // It was registered with NO bold at all, which the registry defaults to 0 —
    // so `appr` never left zero and the batch-1 inversion (a settled capybara
    // is approached rather than fled from) was dead for the only critter in the
    // chapter. Nothing reported it: a radius that never shrinks looks exactly
    // like a radius that is not supposed to. See THE LOAF and addCritter.
    quayAGCrit = game.addCritter({ biome: 'quay', r: quayAG_NEAR, bold: 0.9 });
  }
  // (THE SUN HAT's effect (L8, F5) lives in environment.js's fig-tree
  // lorikeets instead of here — see envLoriStep. These apron gulls are
  // chapter 3's own [`isActive('quay')` gates this whole file's update()],
  // not chapter 1's, and `steal-hat` [sunhat's earning task] is a generic
  // prop-theft check with nothing to do with this flock.)
  const agNear = quayAGCrit ? quayAGCrit.near : quayAG_NEAR;
  const agNear2 = agNear * agNear;
  for (let i = 0; i < quayAG_N; i++) {
    const o = i * 4;
    const p = quayAG_PERCH[quayAGData[o] | 0];
    let f = quayAGData[o + 1];
    if (f <= 0 && capy) {
      const dx = capy.x - p[0], dz = capy.z - p[2];
      // three and a half metres, and not a centimetre sooner — less than that
      // if you have stopped moving. See THE CALM in systems.js.
      if (dx * dx + dz * dz < agNear2 && Math.abs(capy.y - p[1]) < 3) {
        f = 1;
        if (game && typeof game.sfx === 'function' && Math.random() < 0.5) {
          game.sfx('gull', { volume: 0.4 });
        }
      }
    }
    if (f > 0) {
      f -= dt * 0.20;
      if (f <= 0) {
        f = 0;
        // she comes down on SOMEBODY ELSE'S bollard, which is the joke
        quayAGData[o] = (quayAGData[o] + 1 + Math.floor(Math.random() * 3)) % quayAG_N;
        quayAGData[o + 2] = rand(-2.6, 2.6);
      }
      quayAGData[o + 1] = f;
    }
    const q = quayAG_PERCH[quayAGData[o] | 0];
    if (f <= 0) {
      const fa = quayAGData[o + 2] + Math.sin(quayTime * 0.4 + i) * 0.35;
      const fidget = Math.sin(quayTime * 0.9 + i * 2.7) > 0.93 ? 0.35 : 0.03;
      im.setMatrixAt(i, quayXform(q[0], q[1] + Math.sin(quayTime * 1.6 + i) * 0.006, q[2],
                                  fidget * 0.5, fa, fidget, 1, 1, 1));
    } else {
      // up, round, and back down: a half-sine of height and a lazy circle
      const k = Math.sin((1 - f) * Math.PI);
      const a = (1 - f) * 6.5 + quayAGData[o + 3];
      const r = k * 5.5 + 0.4;
      im.setMatrixAt(i, quayXform(q[0] + Math.cos(a) * r, q[1] + k * 4.2 + 0.1,
                                  q[2] + Math.sin(a) * r,
                                  Math.sin(quayTime * 11 + i) * 0.30, -a + Math.PI * 0.5, 0.36,
                                  1.3, 1.3, 1.3));
    }
  }
  im.instanceMatrix.needsUpdate = true;
}

// ============================================================ THE OTHER TWO ==
/**
 * THREE FINGER WHARVES AND ONE BOAT.
 *
 * The terminal is drawn as a machine that runs three services and there was one
 * hull in it — which makes the two empty fingers read as a mistake rather than
 * as a timetable. Two more ferries, lying alongside, are the cheapest way to
 * make the Quay a working wharf: they bob, they never go anywhere, and they are
 * also the thing that tells you at a glance which of the three boats is YOURS,
 * because the other two are twice the size and painted the company's way round.
 */
// OUTBOARD, both of them. Lying on the inner faces of the outer fingers put a
// twenty-seven metre ferry nine metres from the middle berth, and backing MV
// Wheek off her wall — which is the only way she comes off it — drove straight
// into one. The water between the three fingers is the fairway you leave down
// and nothing may be parked in it.
const quayBERTHED = [
  { x: quayWHARF_X[0] - 8.6, z: 1.0, yaw: Math.PI, scale: 1.24 },
  { x: quayWHARF_X[2] + 8.6, z: 2.2, yaw: 0.02, scale: 1.12 },
];
let quayBerthed = [];
function quayBuildBerthed(game, root) {
  const F = quayMerger();
  const HX = 3.0, HZ = 11.0;
  F.box(0, -0.75, 0, HX * 2, 2.1, HZ * 2 - 3.6, PALETTE.hullGreen);
  F.box(0, -1.62, 0, HX * 2 - 0.5, 0.6, HZ * 2 - 3.2, PALETTE.hullBoot);
  F.box(0, 0.36, 0, HX * 2 + 0.24, 0.20, HZ * 2 - 3.4, PALETTE.hullCream);
  for (let s = -1; s <= 1; s += 2) {
    for (let k = 0; k < 3; k++) {
      const t = k / 3;
      F.box(0, -0.75, s * (HZ - 1.8 + k * 0.6), HX * 2 * (1 - t * 0.58), 2.1 - t * 0.35, 1.2,
            PALETTE.hullGreen);
    }
    F.box(0, 0.62, s * (HZ - 0.9), 1.8, 0.7, 1.6, PALETTE.hullCream);
  }
  F.box(0, 0.56, 0, HX * 2 - 0.4, 0.22, HZ * 2 - 3.8, PALETTE.deckTeak);
  F.box(0, 1.72, -0.4, HX * 2 - 0.9, 2.1, HZ * 2 - 8.0, PALETTE.hullCream);
  F.box(0, 1.92, -0.4, HX * 2 - 0.5, 0.9, HZ * 2 - 7.6, PALETTE.glass);
  F.box(0, 2.90, -0.4, HX * 2 - 0.2, 0.22, HZ * 2 - 7.2, PALETTE.hullGreen);
  for (let s = -1; s <= 1; s += 2) {
    F.box(0, 3.55, s * 2.4, 2.9, 1.1, 2.0, PALETTE.hullCream);
    F.box(0, 3.72, s * 2.4, 2.6, 0.55, 2.2, PALETTE.glass);
    F.box(0, 4.20, s * 2.4, 3.1, 0.18, 2.3, PALETTE.hullGreen);
  }
  F.cyl(0, 4.55, 0, 0.85, 2.5, PALETTE.hullCream, 0, 0, 0, 8);
  F.cyl(0, 5.95, 0, 0.90, 0.45, PALETTE.hullRed, 0, 0, 0, 8);
  for (let i = -3; i <= 3; i++) {
    for (let s = -1; s <= 1; s += 2) {
      F.sph(s * (HX + 0.06), -0.05, i * 2.6, 0.34, 0.34, 0.34, PALETTE.thong);
    }
  }
  const geo = F.build();
  quayBerthed = [];
  for (let i = 0; i < quayBERTHED.length; i++) {
    const b = quayBERTHED[i];
    const m = new THREE.Mesh(geo, quayVC());
    m.castShadow = true;
    m.receiveShadow = true;
    m.scale.setScalar(b.scale);
    // her DECK sits 55 cm over the waterline, fifteen above the wharf she is
    // lying against, because that is the one number a boat alongside is judged
    // by — the deck's local top is 0.67, so the origin is that far under it.
    m.position.set(b.x, quayWATER_Y + 0.55 - 0.67 * b.scale, b.z);
    m.rotation.y = b.yaw;
    root.add(m);
    quayBerthed.push({ mesh: m, def: b, phase: rand(0, 6.28) });
    // ...and they are SOLID, because a ferry alongside the next finger is the
    // most obvious thing in the world to run into on the way out of the berth,
    // and it is nine metres from the fairway you leave down.
    quayStaticBox(game, b.x, quayWATER_Y + 0.5, b.z, HX * b.scale, 1.6, (HZ - 1) * b.scale, b.yaw);
    // THREE DISCS DOWN HER LENGTH, NOT ONE ROUND THE MIDDLE. quayHARD is a
    // circle test, and one circle big enough to cover a twenty-seven metre hull
    // is twenty-seven metres WIDE as well — it reaches across the fairway and
    // stops you nine metres off her side. A chain of beam-sized discs is the
    // right shape for a boat and costs two more entries.
    for (let k = -1; k <= 1; k++) {
      quayHARD.push({ x: b.x, z: b.z + k * (HZ - 3.5) * b.scale * 0.9,
                      r: HX * b.scale + quayBOAT_HX + 0.4, name: 'berthed' });
    }
  }
}

function quayUpdateBerthed() {
  for (let i = 0; i < quayBerthed.length; i++) {
    const b = quayBerthed[i];
    b.mesh.position.y = quaySurfaceY(b.def.x, b.def.z) + 0.55 - 0.67 * b.def.scale;
    b.mesh.rotation.z = Math.sin(quayTime * 0.5 + b.phase) * 0.012;
    b.mesh.rotation.x = Math.sin(quayTime * 0.37 + b.phase * 1.7) * 0.008;
  }
}

// ================================================================ THE CROWD ==
/**
 * A FERRY TERMINAL IS MOSTLY A MACHINE FOR QUEUEING, AND NOBODY WAS IN IT.
 *
 * The chapter had five people in seven hundred metres — the deckhand, the
 * commuter, the gateman, the fisherman and the chip shop — and every one of
 * them is a LOCAL, which means every one of them is standing perfectly still.
 * A ninety-six metre concourse with five statues on it is emptier than one with
 * nobody, because the five tell you how big it is.
 *
 * These are not locals and they do not talk: they are the traffic. Three
 * instanced meshes — body, near leg, far leg — so eighteen people walking cost
 * three draw calls and about a thousand triangles, and the legs are the whole
 * point. A merged figure bobbing along a line is a chess piece being slid; a
 * figure whose legs alternate is a person, at four frames in, from thirty
 * metres, which is where all of these are seen from.
 *
 * They walk the three things people actually walk here: the concourse, the
 * gates-to-wharf run, and the waterfront.
 */
const quayCROWD_N = 30;
const quayCROWD_ROUTE = [
  // x0, z0, x1, z1  — laid on the apron, all of it clear of the colliders
  [-44, 30.5, 44, 30.5],
  [ 44, 33.5, -44, 33.5],
  [-40, 20.5, 40, 20.5],
  [-30, 37.0, -28, 6.0],
  [ 28, 6.0,  30, 37.0],
  [  2, 37.0,  0, 6.0],
  [ 40, 26.0, -20, 26.0],
  [-46, 18.5, 46, 18.5],
  [-56, 24.0, -20, 40.0],
  [ 58, 22.0, 20, 40.0],
  [-14, 40.0, -16, 20.0],
  [ 16, 20.0,  14, 40.0],
];
const quayCROWD_SHIRT = [PALETTE.cloth1, PALETTE.cloth2, PALETTE.cloth3, PALETTE.cloth4,
                         PALETTE.cloth5, PALETTE.cloth6, PALETTE.cloth7, PALETTE.cloth8,
                         PALETTE.hiVis, PALETTE.denim];
let quayCrowdLegA = null, quayCrowdLegB = null;
let quayCrowdArmA = null, quayCrowdArmB = null;   // L3-11, hung from the shoulder
let quayCrowdBodies = null;      // one box each — see ...AND THE CONCOURSE IS SOLID

// ---- ARMS, AND A HEIGHT (L3-11) ----
// Thirty people and every one of them 1.65 m to the millimetre, which from the
// apron camera is a picket fence; and their arms were welded to the shirt, so
// the legs alternated under a torso that was being carried. Two things, both
// cheap. A height per person — 0.92 to 1.08, hashed off the index so it is the
// same person every load — stored as the seventh float and put into the scale
// of the one compose that places every part, about the feet: the hip rises by
// it, the legs and body stretch by it, the shoes stay on the apron. And the
// arms come off both halves onto two more instanced draws (six, from four), a
// bare arm each hung from the shoulder like the legs are from the hip, driven
// off the leg phase and out of it — left arm forward with the right leg, which
// is the one thing a walk cannot be drawn without. The cap of the sleeve stays
// on the shirt at the pivot, where a quarter-radian moves it four centimetres:
// the tint multiplies every vertex, so a sleeve and a hand cannot share a
// swinging mesh, and a skin-coloured arm is the more legible one from thirty
// metres anyway. Standing people get the idle everyone has: a twentieth of a
// radian at half a hertz.
const quayCROWD_STRIDE = 7;      // route, u, dir, speed, phase, dwell, height
const quayCROWD_SHOULDER = 0.55; // above the hip, before the height scales it
const quayCrowdHeight = (i) => 0.92 + 0.16 * (((i * 7 + 3) % 11) / 10);

let quayCrowdShirt = null;
/**
 * INSTANCECOLOR MULTIPLIES EVERY VERTEX IN THE MESH, INCLUDING THE FACE.
 * So the shirt cannot live on the same instanced mesh as the head: give twenty
 * people ten shirt colours that way and you get ten people with denim-coloured
 * skin. The figure is split in two — everything that is a fixed colour on one
 * mesh, and the shirt (drawn white, tinted per instance) on another — which is
 * one extra draw call and the only way this works at all.
 */
function quayBuildCrowd(game, root) {
  // ---- the fixed half: head, hair, nose, hips. Hip is the origin. (The arms
  // used to be here too — L3-11 hung them from the shoulder instead.)
  const B = quayMerger();
  B.box(0, 0.78, 0, 0.25, 0.29, 0.24, PALETTE.skin2);
  B.box(0, 0.94, -0.01, 0.27, 0.10, 0.26, PALETTE.hair1);
  B.box(0, 0.78, 0.13, 0.05, 0.05, 0.05, PALETTE.skin2);
  B.box(0, 0.01, 0, 0.44, 0.20, 0.25, PALETTE.stoneDark);
  // ---- the shirt: drawn white so the instance tint is the whole of it. The
  // sleeve is a cap at the shoulder now, sitting on the arm's pivot.
  const S = quayMerger();
  S.box(0, 0.36, 0, 0.48, 0.52, 0.27, 0xffffff);
  S.box(0, 0.61, 0, 0.50, 0.06, 0.29, 0xffffff);
  for (let s = -1; s <= 1; s += 2) S.box(s * 0.29, 0.49, 0, 0.14, 0.12, 0.15, 0xffffff);
  // ---- a leg, hung from the hip so the pivot is at the top of it
  const L = quayMerger();
  L.box(0, -0.39, 0, 0.16, 0.74, 0.18, PALETTE.stoneDark);
  L.box(0, -0.78, 0.04, 0.17, 0.09, 0.26, PALETTE.hair2);
  const legGeo = L.build();
  // ---- an arm, hung from the shoulder the same way: bare, with a hand
  const A = quayMerger();
  A.box(0, -0.31, 0, 0.11, 0.44, 0.12, PALETTE.skin2);
  A.box(0, -0.56, 0.01, 0.12, 0.10, 0.13, PALETTE.skin2);
  const armGeo = A.build();

  const c = new THREE.Color();
  const mk = (geo, tint) => {
    const im = new THREE.InstancedMesh(geo, quayVC(), quayCROWD_N);
    im.castShadow = true;
    im.frustumCulled = false;
    if (tint) {
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(quayCROWD_N * 3), 3);
      for (let i = 0; i < quayCROWD_N; i++) {
        c.set(quayCROWD_SHIRT[(i * 3 + 1) % quayCROWD_SHIRT.length]);
        im.setColorAt(i, c);
      }
      im.instanceColor.needsUpdate = true;
    }
    root.add(im);
    return im;
  };
  quayCrowd = mk(B.build(), false);
  quayCrowdShirt = mk(S.build(), true);
  quayCrowdLegA = mk(legGeo, false);
  quayCrowdLegB = mk(legGeo, false);
  quayCrowdArmA = mk(armGeo, false);
  quayCrowdArmB = mk(armGeo, false);

  quayCrowdData = new Float32Array(quayCROWD_N * quayCROWD_STRIDE);
  for (let i = 0; i < quayCROWD_N; i++) {
    const o = i * quayCROWD_STRIDE;
    quayCrowdData[o] = i % quayCROWD_ROUTE.length;
    quayCrowdData[o + 1] = rand(0, 1);
    quayCrowdData[o + 2] = Math.random() < 0.5 ? -1 : 1;
    quayCrowdData[o + 3] = rand(0.85, 1.55);
    quayCrowdData[o + 4] = rand(0, Math.PI * 2);
    quayCrowdData[o + 5] = 0;
    quayCrowdData[o + 6] = quayCrowdHeight(i);
  }
  quayCrowdBodies = game && typeof game.addCrowdBodies === 'function'
    ? game.addCrowdBodies({ n: quayCROWD_N, at: quayCrowdFoot, moving: true })
    : null;
  quayUpdateCrowd(0);
}

// ---------------------------------------------------------------------------
// ...AND THE CONCOURSE IS SOLID (v36)
//
// Thirty commuters on the apron at Circular Quay, and `qa/CROWDS.md` measured
// 3% of them solid — which is to say the busiest square metre in chapter three
// was a slideshow. They walk their routes, so it is one box each and a `step()`
// in the update, and the foot height is the same GY the draw uses because the
// apron is flat.
//
// Recomputed from the route rather than cached: `quayCrowdData` is seven floats
// wide and everything in it is a parameter, not a position, so the position is
// derived in exactly one place — here and in the draw — off the same two lines.
// A cached copy is a second writer of the same fact, which is how a body ends
// up a frame behind a person.
// ---------------------------------------------------------------------------
function quayCrowdFoot(i, out) {
  if (!quayCrowdData) return false;
  const o = i * quayCROWD_STRIDE;
  const r = quayCROWD_ROUTE[quayCrowdData[o] | 0];
  const u = quayCrowdData[o + 1];
  out.x = lerp(r[0], r[2], u);
  out.y = 0.20;                       // GY, the top of the apron
  out.z = lerp(r[1], r[3], u);
  return true;
}

// How close the animal has to be before somebody standing on the apron turns
// to look at it (F4). Twelve metres, the same figure Venice's gawpers use, and
// for the same reason: it is "in my bit of the concourse", not "anywhere I
// could see", and a whole terminal turning at once is a different beat.
const quayLOOK_R = 12;

function quayUpdateCrowd(dt) {
  if (!quayCrowd) return;
  const GY = 0.20;                    // the top of the apron
  // Read once, not per person: fifty-two hypots is fine, fifty-two property
  // lookups through two objects is not the shape this loop is written in.
  const cpQ = quayGame && quayGame.capy ? quayGame.capy.position : null;
  for (let i = 0; i < quayCROWD_N; i++) {
    const o = i * quayCROWD_STRIDE;
    const r = quayCROWD_ROUTE[quayCrowdData[o] | 0];
    const len = Math.hypot(r[2] - r[0], r[3] - r[1]);
    let moving = 1;
    if (quayCrowdData[o + 5] > 0) {
      // STOPPED, AND STOPPED PROPERLY. A crowd in which everybody is walking is
      // a conveyor belt; a third of a station concourse is people standing
      // about looking at a board.
      quayCrowdData[o + 5] -= dt;
      moving = 0;
    } else {
      quayCrowdData[o + 1] += quayCrowdData[o + 2] * quayCrowdData[o + 3] / len * dt;
      if (quayCrowdData[o + 1] >= 1) {
        quayCrowdData[o + 1] = 1; quayCrowdData[o + 2] = -1; quayCrowdData[o + 5] = rand(2, 11);
      } else if (quayCrowdData[o + 1] <= 0) {
        quayCrowdData[o + 1] = 0; quayCrowdData[o + 2] = 1; quayCrowdData[o + 5] = rand(2, 11);
      }
    }
    const u = quayCrowdData[o + 1];
    const px = lerp(r[0], r[2], u), pz = lerp(r[1], r[3], u);
    let yaw = Math.atan2((r[2] - r[0]) * quayCrowdData[o + 2],
                         (r[3] - r[1]) * quayCrowdData[o + 2]);
    // ---- AND THE ONES STANDING ABOUT LOOK AT IT (F4) --------------------
    // A third of this concourse is stopped at any moment — that is the whole
    // point of the dwell above — and every one of them went on facing down
    // their own route while a capybara walked past. The busiest square in the
    // chapter, and nobody in it had ever noticed the animal.
    //
    // ONLY WHILE STOPPED. There is no separate head here: the yaw drives the
    // legs, so turning a walker would have it walking sideways across its own
    // route. Somebody standing still can face wherever they like.
    //
    // A STATELESS SHORTEST-ARC BLEND, because `quayCrowdData` is seven floats a
    // person with no spare for a damped yaw — and it wants no damper anyway.
    // The weight moves smoothly with the distance, so the head turns smoothly
    // as the animal approaches and follows it faster when it is running, which
    // is what a damper would have been trying to imitate. The `% 2π` is the
    // whole reason this is a subtraction rather than a lerp of two bearings: a
    // pair that straddles ±π lerps the long way round, every time.
    if (!moving && cpQ) {
      const lx = cpQ.x - px, lz = cpQ.z - pz;
      const ld = Math.hypot(lx, lz);
      if (ld < quayLOOK_R && ld > 0.4) {
        const w = clamp(1 - ld / quayLOOK_R, 0, 1);
        const want = Math.atan2(lx, lz);
        yaw += ((want - yaw + Math.PI * 3) % (Math.PI * 2) - Math.PI) * w;
      }
    }
    quayCrowdData[o + 4] += dt * quayCrowdData[o + 3] * 4.6 * moving;
    const ph = quayCrowdData[o + 4];
    const swing = moving ? Math.sin(ph) * 0.62 : Math.sin(quayTime * 0.9 + i) * 0.03;
    const bob = moving ? Math.abs(Math.cos(ph)) * 0.035 : Math.sin(quayTime * 1.2 + i) * 0.012;
    // ---- ARMS, AND A HEIGHT (L3-11): the height scales y about the feet, so
    // the hip goes up by it and every part hung off the hip stretches by it.
    // The arm on the +x side swings against the leg on the +x side.
    const h = quayCrowdData[o + 6];
    const hip = GY + (0.82 + bob) * h;
    const arm = moving ? -Math.sin(ph) * 0.45 : Math.sin(quayTime * Math.PI + i) * 0.05;
    const sx = Math.cos(yaw), sz = -Math.sin(yaw);       // the person's local +x
    const shoulder = hip + quayCROWD_SHOULDER * h;
    const m = quayXform(px, hip, pz, 0, yaw, 0, 1, h, 1);
    quayCrowd.setMatrixAt(i, m);
    quayCrowdShirt.setMatrixAt(i, m);
    quayCrowdLegA.setMatrixAt(i, quayXform(px + sx * 0.12, hip, pz + sz * 0.12,
                                           swing, yaw, 0, 1, h, 1));
    quayCrowdLegB.setMatrixAt(i, quayXform(px - sx * 0.12, hip, pz - sz * 0.12,
                                           -swing, yaw, 0, 1, h, 1));
    quayCrowdArmA.setMatrixAt(i, quayXform(px + sx * 0.29, shoulder, pz + sz * 0.29,
                                           arm, yaw, 0, 1, h, 1));
    quayCrowdArmB.setMatrixAt(i, quayXform(px - sx * 0.29, shoulder, pz - sz * 0.29,
                                           -arm, yaw, 0, 1, h, 1));
  }
  quayCrowd.instanceMatrix.needsUpdate = true;
  quayCrowdShirt.instanceMatrix.needsUpdate = true;
  quayCrowdLegA.instanceMatrix.needsUpdate = true;
  quayCrowdLegB.instanceMatrix.needsUpdate = true;
  quayCrowdArmA.instanceMatrix.needsUpdate = true;
  quayCrowdArmB.instanceMatrix.needsUpdate = true;
  // ...and every box goes where its commuter went, after the loop that moved
  // them and never before it.
  if (quayCrowdBodies) quayCrowdBodies.step();
}

// ============================================================== HER PASSENGERS ==
/**
 * FOUR HUNDRED TONNES OF SHIP AND NOBODY ON BOARD.
 *
 * The Freshwater is the best thing on this water and the mini of the chapter is
 * trading horns with her — and she was a hull. The salute went: you sound off,
 * she answers a fourth lower, her wash arrives twelve seconds later. All of it
 * is sound and physics and none of it is a PERSON, which is what a salute
 * actually is between two boats.
 *
 * So there are fourteen of them lining her promenade rail, and when she answers
 * you, they wave. Two instanced draws, in her own frame, and it is the only
 * moment in the chapter where somebody who is not standing on the ground
 * acknowledges the animal.
 */
const quayPAX_N = 14;
let quayPaxArm = null;
function quayBuildPax(root) {
  // one mesh, tinted per instance, and the head is the one thing on it that is
  // NOT the shirt — so it gets its own pass, same split as the concourse crowd
  const B = quayMerger();
  B.box(0, 0.30, 0, 0.42, 0.58, 0.24, 0xffffff);
  B.box(0, -0.14, 0, 0.30, 0.34, 0.20, 0xffffff);
  const H = quayMerger();
  H.box(0, 0.66, 0, 0.23, 0.26, 0.22, PALETTE.skin2);
  H.box(0, 0.81, -0.01, 0.25, 0.09, 0.24, PALETTE.hair1);
  H.box(0, 0.66, 0.12, 0.05, 0.05, 0.05, PALETTE.skin2);
  const A = quayMerger();
  A.box(0, -0.24, 0, 0.11, 0.50, 0.12, PALETTE.skin2);
  A.box(0, -0.54, 0, 0.12, 0.13, 0.13, PALETTE.skin2);
  const c = new THREE.Color();
  const mk = (geo, tint) => {
    const im = new THREE.InstancedMesh(geo, quayVC(), quayPAX_N);
    im.castShadow = false;
    im.frustumCulled = false;
    if (tint) {
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(quayPAX_N * 3), 3);
      for (let i = 0; i < quayPAX_N; i++) {
        c.set(quayCROWD_SHIRT[(i * 5 + 2) % quayCROWD_SHIRT.length]);
        im.setColorAt(i, c);
      }
      im.instanceColor.needsUpdate = true;
    }
    root.add(im);
    return im;
  };
  quayPaxMesh = mk(B.build(), true);
  quayPaxHead = mk(H.build(), false);
  quayPaxArm = mk(A.build(), false);
  quayPaxData = new Float32Array(quayPAX_N * 3);        // local x, local z, phase
  for (let i = 0; i < quayPAX_N; i++) {
    // along both promenade rails, and a few on the top deck
    const side = i % 2 ? 1 : -1;
    const along = -11 + Math.floor(i / 2) * 3.3;
    quayPaxData[i * 3] = side * (quayBIG_HX - 1.0);
    quayPaxData[i * 3 + 1] = along;
    quayPaxData[i * 3 + 2] = rand(0, Math.PI * 2);
  }
  quayUpdatePax();
}

// ======================================================= HER OWN PASSENGERS ==
/**
 * EIGHT PEOPLE ON MV WHEEK, WHICH HAD NONE.
 *
 * The marquee of this chapter is a seventy-second passage at the wheel of a
 * working Sydney ferry, and she sailed EMPTY — while the Freshwater went past
 * with fourteen people on her rail, and the hand at the Manly wharf called
 * "all ashore" to a boat with nobody on it. It is the largest hole in the
 * fiction of the strongest chapter in the game.
 *
 * PARENTED TO THE HULL, WHICH THE FRESHWATER'S ARE NOT. Hers are placed by
 * hand every frame out of quayBigPos/quayBigYaw because she has no group to
 * hang anything on. MV Wheek has one, and it is given a full quaternion every
 * frame — yaw, plus heel into the rudder, plus trim by the stern under power
 * — so a child of it gets all three for nothing. Eight instances placed ONCE
 * at build; the only per-frame work is a weight shift and an arm.
 *
 * WHERE THEY STAND is the deck, and the deck is at boat-local y 0.36 (the
 * teak box is 0.16 thick at y 0.28). This figure's feet are 0.31 below its
 * own origin, the same rig the Freshwater uses, so the origin goes at 0.67.
 * They keep out of z 2.2..4.0, because the helm is at (0, 3.1) and the one
 * thing worse than an empty ferry is a passenger standing inside the wheel.
 */
const quayWPAX_N = 8;
let quayWPaxMesh = null, quayWPaxHead = null, quayWPaxArm = null;
const quayWPaxData = new Float32Array(quayWPAX_N * 4);   // lx, lz, yaw, phase

function quayBuildWheekPax(group) {
  if (!group) return;
  const B = quayMerger();
  B.box(0, 0.30, 0, 0.42, 0.58, 0.24, 0xffffff);
  B.box(0, -0.14, 0, 0.30, 0.34, 0.20, 0xffffff);
  const H = quayMerger();
  H.box(0, 0.66, 0, 0.23, 0.26, 0.22, PALETTE.skin2);
  H.box(0, 0.81, -0.01, 0.25, 0.09, 0.24, PALETTE.hair1);
  H.box(0, 0.66, 0.12, 0.05, 0.05, 0.05, PALETTE.skin2);
  const A = quayMerger();
  A.box(0, -0.24, 0, 0.11, 0.50, 0.12, PALETTE.skin2);
  A.box(0, -0.54, 0, 0.12, 0.13, 0.13, PALETTE.skin2);
  const c = new THREE.Color();
  const mk = (geo, tint) => {
    const im = new THREE.InstancedMesh(geo, quayVC(), quayWPAX_N);
    im.castShadow = false;
    // A child of a moving hull whose own bounding sphere is computed at the
    // origin: cull it and the whole complement disappears the moment she
    // leaves the berth.
    im.frustumCulled = false;
    if (tint) {
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(quayWPAX_N * 3), 3);
      for (let i = 0; i < quayWPAX_N; i++) {
        c.set(quayCROWD_SHIRT[(i * 3 + 1) % quayCROWD_SHIRT.length]);
        im.setColorAt(i, c);
      }
      im.instanceColor.needsUpdate = true;
    }
    group.add(im);
    return im;
  };
  quayWPaxMesh = mk(B.build(), true);
  quayWPaxHead = mk(H.build(), false);
  quayWPaxArm = mk(A.build(), false);
  for (let i = 0; i < quayWPAX_N; i++) {
    const side = i % 2 ? 1 : -1;
    const row = Math.floor(i / 2);
    quayWPaxData[i * 4] = side * 1.72;                 // inboard of the rail
    quayWPaxData[i * 4 + 1] = -5.0 + row * 1.8;        // aft of the helm
    quayWPaxData[i * 4 + 2] = side > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
    quayWPaxData[i * 4 + 3] = rand(0, Math.PI * 2);
  }
  quayUpdateWheekPax();
}

function quayUpdateWheekPax() {
  if (!quayWPaxMesh) return;
  // ...and they wave back when the Freshwater answers, on the same clock her
  // own fourteen do — out of time with each other, which is the only way a
  // crowd waving has ever looked right.
  const wave = quayBigWave > 0 ? clamp(quayBigWave / 3.4, 0, 1) : 0;
  for (let i = 0; i < quayWPAX_N; i++) {
    const o = i * 4;
    const lx = quayWPaxData[o], lz = quayWPaxData[o + 1];
    const yaw = quayWPaxData[o + 2], ph = quayWPaxData[o + 3];
    const lean = Math.sin(quayTime * 0.7 + ph) * 0.035;
    const m = quayXform(lx, 0.67, lz, 0, yaw, lean, 1, 1, 1);
    quayWPaxMesh.setMatrixAt(i, m);
    quayWPaxHead.setMatrixAt(i, m);
    const up = wave > 0 ? (2.35 + Math.sin(quayTime * 7.5 + ph * 3) * 0.55) * wave : 0.05;
    quayWPaxArm.setMatrixAt(i, quayXform(lx + Math.cos(yaw) * 0.26 * (lx > 0 ? 1 : -1),
                                         1.19,
                                         lz - Math.sin(yaw) * 0.26 * (lx > 0 ? 1 : -1),
                                         0, yaw, up, 1, 1, 1));
  }
  quayWPaxMesh.instanceMatrix.needsUpdate = true;
  quayWPaxHead.instanceMatrix.needsUpdate = true;
  quayWPaxArm.instanceMatrix.needsUpdate = true;
}

function quayUpdatePax() {
  if (!quayPaxMesh) return;
  const cs = Math.cos(quayBigYaw), sn = Math.sin(quayBigYaw);
  const wave = quayBigWave > 0 ? clamp(quayBigWave / 3.4, 0, 1) : 0;
  for (let i = 0; i < quayPAX_N; i++) {
    const o = i * 3;
    const lx = quayPaxData[o], lz = quayPaxData[o + 1], ph = quayPaxData[o + 2];
    const x = quayBigPos.x + lx * cs + lz * sn;
    const z = quayBigPos.z - lx * sn + lz * cs;
    // ON the promenade deck, which is at local 3.73 — they were at 2.05, which
    // is a metre and a half below it, i.e. fourteen people standing inside the
    // saloon with their heads through the deckhead. The rail is at local 4.05
    // and their feet are 0.31 below their own origin.
    const y = quayBigPos.y + 4.04;
    // they face out over the rail, and they shift their weight
    const yaw = quayBigYaw + (lx > 0 ? Math.PI * 0.5 : -Math.PI * 0.5);
    const lean = Math.sin(quayTime * 0.7 + ph) * 0.035;
    const m = quayXform(x, y, z, 0, yaw, lean, 1, 1, 1);
    quayPaxMesh.setMatrixAt(i, m);
    quayPaxHead.setMatrixAt(i, m);
    // AND WHEN SHE ANSWERS YOU, THEY WAVE. Straight up, out of time with each
    // other, which is the only way a crowd waving has ever looked right.
    const up = wave > 0 ? (2.35 + Math.sin(quayTime * 7.5 + ph * 3) * 0.55) * wave : 0.05;
    quayPaxArm.setMatrixAt(i, quayXform(x + Math.cos(yaw) * 0.26 * (lx > 0 ? 1 : -1),
                                        y + 0.52,
                                        z - Math.sin(yaw) * 0.26 * (lx > 0 ? 1 : -1),
                                        0, yaw, up, 1, 1, 1));
  }
  quayPaxMesh.instanceMatrix.needsUpdate = true;
  quayPaxHead.instanceMatrix.needsUpdate = true;
  quayPaxArm.instanceMatrix.needsUpdate = true;
}

// ================================================================ THE CHIPS ==
// Ashore at Manly there is exactly one thing worth doing, and it is the thing
// every seagull in the southern hemisphere is already thinking about. A basket
// on the counter outside the chip shop; walk into it and the Corso becomes a
// crime scene. Deliberately NOT a props.js prop: props are biome-tagged and
// spawned from scatter tables, and this wants to be one specific basket in one
// specific doorway.
// y is the group origin, and the counter hangs 0.84 m BELOW it — so 1.15 put
// the whole thing eighty centimetres into the sand and left an eleven-centimetre
// ledge standing proud of the beach. The dry sand at Manly is at
// quayWATER_Y + 1.125; the counter's feet go there.
const quayCHIPS = { x: quayMANLY.x + 3.4, z: quayMANLY.z - 25.0, y: 1.965 };
const quayCHIP_R = 2.1;
let quayChipGroup = null, quayChipBits = null, quayChipsGone = false, quayChipT = 0;
const quayCHIP_N = 14;
const quayChipData = new Float32Array(quayCHIP_N * 6);   // x,y,z,vx,vy,vz

function quayBuildChips(root) {
  const g = new THREE.Group();
  const C = quayMerger();
  // the counter, the basket, and a paper cone of chips standing in it
  C.box(0, -0.42, 0, 2.6, 0.84, 1.0, PALETTE.hullCream);
  C.box(0, 0.03, 0, 2.8, 0.10, 1.15, PALETTE.deckTeakDark);
  C.box(0, 0.22, 0, 0.85, 0.30, 0.7, PALETTE.wharfIron);
  C.cone(0, 0.44, 0, 0.36, 0.62, PALETTE.sail, Math.PI, 0, 0);
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2;
    C.box(Math.cos(a) * 0.13, 0.62 + (i % 3) * 0.05, Math.sin(a) * 0.13,
          0.10, 0.34, 0.10, PALETTE.maiz, rand(-0.3, 0.3), a, rand(-0.3, 0.3));
  }
  const m = new THREE.Mesh(C.build(), quayVC());
  m.castShadow = true;
  g.add(m);
  g.position.set(quayCHIPS.x, quayWATER_Y + quayCHIPS.y, quayCHIPS.z);
  root.add(g);
  quayChipGroup = g;

  quayChipBits = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.10, 0.10, 0.34), mat(PALETTE.maiz), quayCHIP_N);
  quayChipBits.castShadow = true;
  quayChipBits.frustumCulled = false;
  for (let i = 0; i < quayCHIP_N; i++) {
    quayChipBits.setMatrixAt(i, quayXform(0, -900, 0, 0, 0, 0, 0.001, 0.001, 0.001));
  }
  quayChipBits.instanceMatrix.needsUpdate = true;
  root.add(quayChipBits);
}

function quayBurstChips(game) {
  quayChipsGone = true;
  quayChipT = 0;
  if (quayChipGroup) quayChipGroup.visible = false;
  const bx = quayCHIPS.x, by = quayWATER_Y + quayCHIPS.y + 0.6, bz = quayCHIPS.z;
  for (let i = 0; i < quayCHIP_N; i++) {
    const o = i * 6;
    const a = rand(0, Math.PI * 2), s = rand(1.6, 4.2);
    quayChipData[o] = bx; quayChipData[o + 1] = by; quayChipData[o + 2] = bz;
    quayChipData[o + 3] = Math.cos(a) * s;
    quayChipData[o + 4] = rand(3.0, 6.2);
    quayChipData[o + 5] = Math.sin(a) * s;
  }
  // every gull on the harbour now has business at Manly — including, and
  // especially, the ones that were sat on a buoy four hundred metres away
  for (let i = 0; i < quayGullN; i++) {
    const o = i * 6;
    quayGullPerch[i] = 0;
    quayGullData[o] = bx + rand(-9, 9);
    quayGullData[o + 1] = rand(3, 9);
    quayGullData[o + 2] = bz + rand(-9, 9);
    quayGullData[o + 4] = rand(3, 11);
    quayGullData[o + 5] = rand(0.9, 1.7);
  }
  if (typeof game.sfx === 'function') { game.sfx('gull'); game.sfx('rustle', { volume: 0.9 }); }
  if (typeof game.shake === 'function') game.shake(0.18);
  if (typeof game.toast === 'function') game.toast('every gull in New South Wales, immediately');
  quayTask('manly-pine');
}

function quayUpdateChips(game, dt) {
  if (!quayChipBits) return;
  if (!quayChipsGone) {
    const capy = game.capy;
    if (!capy || !capy.position || capy.atHelm) return;
    const dx = capy.position.x - quayCHIPS.x, dz = capy.position.z - quayCHIPS.z;
    const dy = capy.position.y - (quayWATER_Y + quayCHIPS.y);
    if (dx * dx + dz * dz < quayCHIP_R * quayCHIP_R && dy > -2 && dy < 2.4) quayBurstChips(game);
    return;
  }
  quayChipT += dt;
  const floor = quayWATER_Y + 1.125;      // the dry sand, not seventeen centimetres over it
  for (let i = 0; i < quayCHIP_N; i++) {
    const o = i * 6;
    quayChipData[o + 4] -= 22 * dt;
    quayChipData[o] += quayChipData[o + 3] * dt;
    quayChipData[o + 1] += quayChipData[o + 4] * dt;
    quayChipData[o + 2] += quayChipData[o + 5] * dt;
    if (quayChipData[o + 1] < floor) {
      quayChipData[o + 1] = floor;
      quayChipData[o + 4] = 0;
      quayChipData[o + 3] *= 0.72;
      quayChipData[o + 5] *= 0.72;
    }
    quayChipBits.setMatrixAt(i, quayXform(quayChipData[o], quayChipData[o + 1], quayChipData[o + 2],
                                          quayChipT * 2 + i, i * 0.7, 0, 1, 1, 1));
  }
  quayChipBits.instanceMatrix.needsUpdate = true;
}

// ============================================================== THE VOYAGE ===
/** Where the boat's helm station is, in WORLD coordinates. */
function quayHelmWorld(out) {
  const cs = Math.cos(quayBoatYaw), sn = Math.sin(quayBoatYaw);
  out.set(quayBoatX + sn * quayHELM.z + cs * quayHELM.x,
          quayWATER_Y + quayBOAT_DECK + 0.78,
          quayBoatZ + cs * quayHELM.z - sn * quayHELM.x);
  return out;
}

function quayTask(id) {
  const g = quayGame;
  if (g && typeof g.completeTask === 'function') g.completeTask(id);
}

function quayTakeHelm() {
  const g = quayGame;
  quayHelmOn = true;
  quayHelmCool = 0.35;
  g.state.sailing = true;
  // AT THE WHEEL capybara.js STOPS SOLVING — see the note over capyUpdate's
  // early return — so the contact sweep that normally publishes rideBody never
  // runs, and the camera's occlusion ray spends the whole voyage cutting its
  // twenty-one metre boom down to one-nine against MV Wheek's own wheelhouse.
  // Measured, holding full ahead: the eye ended up 4.7 m from the animal, which
  // is the back of a capybara's head and a cream bulkhead, not a harbour. The
  // deck you are steering is a floor; say so. See sysCamClear.
  if (g.capy) { g.capy.atHelm = true; g.capy.rideBody = quayBoatBody; }
  if (typeof g.sfx === 'function') g.sfx('chime', { volume: 0.7 });
  // ---- IN THE SCHEME THE PLAYER IS HOLDING (F1) -------------------------
  // The ferry's whole control scheme, said once, at the wheel — and it was
  // three keycaps a phone does not have and a pad does not have either. The
  // helm reads `input.x` and `input.z`, which is the abstract stick every
  // scheme fills, so the CONTROL was always right on all three and only the
  // sentence was wrong.
  //
  // D5.2: it named `game.say`, which is npc.js's `sayAt(x, y, z, text)` — the
  // sentence went into `x`, `text` was undefined, and `sayAt` returned at its
  // own guard. The `toast` fallback below it never ran either, because
  // `typeof g.say === 'function'` is true. This line has never been seen by
  // anybody. `game.control` is the door to the substitution table.
  const line = 'W/S throttle · A/D wheel · E to step away';
  if (typeof g.control === 'function') g.control(line);
  else if (typeof g.toast === 'function') g.toast(line);
  quayTask('take-helm');
}

function quayLeaveHelm() {
  const g = quayGame;
  quayHelmOn = false;
  quayHelmCool = 0.35;
  g.state.sailing = false;
  if (g.capy) g.capy.atHelm = false;
}

/**
 * The whole boat, once per frame. Position is integrated here and written
 * straight to the kinematic body — which means the interpolation history has to
 * be written with it (contract: "Rendering physics transforms"), or the deck
 * smears out from under its passenger at every speed above a walk.
 */
function quayStepBoat(game, dt) {
  const input = game.input;
  const capy = game.capy;
  if (quayHelmCool > 0) quayHelmCool -= dt;

  // ---- taking and leaving the wheel ---------------------------------------
  if (capy && capy.body && quayHelmCool <= 0 && input && input.actionPressed) {
    quayHelmWorld(quayV3);
    const dx = capy.body.position.x - quayV3.x;
    const dz = capy.body.position.z - quayV3.z;
    const dy = capy.body.position.y - quayV3.y;
    if (quayHelmOn) {
      quayLeaveHelm();
    } else if (dx * dx + dz * dz < quayHELM_R * quayHELM_R && dy > -2.2 && dy < 2.6) {
      quayTakeHelm();
    }
  }

  // ---- the controls -------------------------------------------------------
  let rudderWant = 0, throttleWant = quayThrottle;
  if (quayHelmOn && input) {
    // Camera-relative movement is wrong at a wheel: forward is where the SHIP
    // is pointing, not where the camera is. The stick is read raw.
    throttleWant = clamp(quayThrottle - input.z * dt * 0.85, -0.30, 1);
    rudderWant = clamp(input.x, -1, 1);
    if (input.honkPressed) {
      // A SHIP'S WHISTLE IS A THING YOU CAN SEE. quayHornT was written by this
      // line and read by nothing at all — now it puts a jet of white off the
      // funnel that arrives with the sound and hangs about after it.
      quayHornSteam = 1.1;
      if (typeof game.sfx === 'function') game.sfx('horn');
      // …and everything sitting in the wash goes straight up. See quayScareWakeGulls.
      quayScareWakeGulls(false);
      // ...and if the Freshwater is inside eighty metres, she has heard it.
      if (quayBigHail() && typeof game.toast === 'function') game.toast('she heard that.');
      // Under the arch, with the horn: the oldest joke on the harbour — and now
      // the arch answers. Fifty thousand tonnes of steel over your head gives
      // you back your own horn a beat late and half as loud, every gull on the
      // underside of it leaves at once, and that is the payoff for a task whose
      // reward used to be a line of text.
      if (quayNearBridge()) {
        quayBridgeEcho(game);
        if (!quayBridged) {
          quayBridged = true;
          quayTask('under-bridge');
          if (typeof game.toast === 'function') game.toast('every skipper does it. none of them admit it.');
        }
      }
    }
  } else {
    throttleWant = damp(quayThrottle, 0, 1.6, dt);
    // ashore, Q is the wheek — and a wheek on a Sydney wharf clears the
    // bollards. Every one of them, at once, which is the whole point.
    if (input && input.honkPressed) quayFlushApron(true);
  }
  quayThrottle = throttleWant;
  quayRudder = damp(quayRudder, rudderWant, quayBOAT_RUDDER, dt);

  // ---- longitudinal: the engine chases a target speed ---------------------
  // ASTERN IS A DOUBLE NEGATIVE, and it was only written once. quayThrottle is
  // clamped to [-0.30, 1], so on this branch `quayThrottle / 0.30` is in
  // [-1, 0) and multiplying it by quayBOAT_VREV — which is itself -3.2 —
  // produced +3.2 m/s AHEAD. Full astern drove her out of the berth bow-first,
  // quayBoatSpeed could never go negative through the throttle at all, and with
  // it went the reversed rudder below and the whole point of the design note at
  // the top of this file: you could not back off a wharf, so a bad approach to
  // Manly could only be fixed by going round again.
  const target = quayThrottle >= 0 ? quayThrottle * quayBOAT_VMAX
                                   : -quayThrottle / 0.30 * quayBOAT_VREV;

  if (Math.abs(quayThrottle) > 0.02) {
    const err = target - quayBoatSpeed;
    const step = quayBOAT_ACC * dt;
    quayBoatSpeed += clamp(err, -step * 2.2, step);
  } else {
    quayBoatSpeed = damp(quayBoatSpeed, 0, quayBOAT_DRAG, dt);
    if (Math.abs(quayBoatSpeed) < 0.05) quayBoatSpeed = 0;
  }

  // ---- lateral: rudder authority is bought with way -----------------------
  const auth = clamp(Math.abs(quayBoatSpeed) / 5.5, 0, 1);
  const sign = quayBoatSpeed < 0 ? -1 : 1;
  quayBoatYaw -= quayRudder * quayBOAT_TURN * auth * sign * dt;

  // ---- integrate ----------------------------------------------------------
  quayBoatX += Math.sin(quayBoatYaw) * quayBoatSpeed * dt;
  quayBoatZ += Math.cos(quayBoatYaw) * quayBoatSpeed * dt;
  // A WASH MOVES A BOAT. The Freshwater's wash rolled us and left us exactly
  // where we were, which is half of what a swell does: four hundred tonnes at
  // eight and a half metres a second puts a metre of water under you and it
  // takes you WITH it. Applied before quayShore, so a boat lifted onto a rock
  // by a swell is still pushed off it.
  if (quayBigRoll > 0) {
    const k = clamp(quayBigRoll / 6.0, 0, 1);
    const surge = Math.cos(quayBigRoll * 3.4) * 1.35 * k * dt;
    let wx = quayBoatX - quayBigPos.x, wz = quayBoatZ - quayBigPos.z;
    const wl = Math.hypot(wx, wz) || 1;
    quayBoatX += (wx / wl) * surge;
    quayBoatZ += (wz / wl) * surge;
    if (Math.random() < dt * 5) {
      quaySprayEmit(quayBoatX + rand(-2, 2) - Math.sin(quayBoatYaw) * rand(-4, 4),
                    quayWATER_Y + 0.2,
                    quayBoatZ + rand(-2, 2) - Math.cos(quayBoatYaw) * rand(-4, 4),
                    rand(-1, 1), rand(1.5, 2.8) * k, rand(-1, 1), 0.7);
    }
  }
  // keep her inside the painted sea rather than inventing an invisible wall
  quayBoatX = clamp(quayBoatX, quaySEA_X0 + 40, quaySEA_X1 - 40);
  quayBoatZ = Math.max(quayBoatZ, quaySEA_Z0 + 40);
  // ...and out of anything that is not water. See quayShore().
  quayShore(game, dt);

  const b = quayBoatBody;
  // ...and the ocean, in the Heads (W1). See quayHeadsAt.
  quayHeadsK = damp(quayHeadsK, quayHeadsAt(quayBoatZ), 1.2, dt);
  const hk = quayHeadsK;
  const hph = quayTime * quayHEADS_W + quayBoatZ * 0.012;
  const swell = Math.sin(quayTime * 0.85 + quayBoatX * 0.02) * 0.10 + Math.sin(hph) * quayHEADS_LIFT * hk;
  const y = quayWATER_Y + quayBOAT_DECK + swell;
  b.position.set(quayBoatX, y, quayBoatZ);
  // heel into the turn, and squat by the stern under power — and in the gap,
  // the swell's slope under the keel: the bow goes up the face and over.
  const heel = -quayRudder * auth * 0.16 + quayWashHeel() + Math.sin(hph * 0.5 + 1.1) * 0.045 * hk;
  const trim = -clamp(quayBoatSpeed / quayBOAT_VMAX, 0, 1) * 0.045 + Math.cos(hph) * 0.075 * hk;
  // Spray off the bow when she puts it into one at speed: the crest is where
  // cos(hph) is near 1 and the bow is going DOWN into the next one.
  if (hk > 0.25 && Math.abs(quayBoatSpeed) > 4 && Math.cos(hph) > 0.55 && Math.random() < dt * 9 * hk) {
    const fx = Math.sin(quayBoatYaw), fz = Math.cos(quayBoatYaw);
    quaySprayEmit(quayBoatX + fx * 6.5 + rand(-1.6, 1.6), quayWATER_Y + 0.9,
                  quayBoatZ + fz * 6.5 + rand(-1.6, 1.6),
                  fx * 2.5 + rand(-1.2, 1.2), rand(2.2, 3.6), fz * 2.5 + rand(-1.2, 1.2), 0.8);
  }
  quayEu.set(trim, quayBoatYaw, heel, 'YXZ');
  quayQ.setFromEuler(quayEu);
  b.quaternion.set(quayQ.x, quayQ.y, quayQ.z, quayQ.w);
  // Kinematic bodies keep a velocity so that capybara.js can solve in the
  // deck's frame — that is how a passenger rides her without friction.
  b.velocity.set(Math.sin(quayBoatYaw) * quayBoatSpeed, 0, Math.cos(quayBoatYaw) * quayBoatSpeed);
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
  b.previousQuaternion.copy(b.quaternion);
  b.interpolatedQuaternion.copy(b.quaternion);

  quayBoatGroup.position.set(quayBoatX, y, quayBoatZ);
  quayBoatGroup.quaternion.set(quayQ.x, quayQ.y, quayQ.z, quayQ.w);
  if (quayWheelMesh) quayWheelMesh.rotation.z = -quayRudder * 2.4;
  quayUpdateWheekPax();
  if (quayFlagMesh) {
    const st = clamp(Math.abs(quayBoatSpeed) / quayBOAT_VMAX, 0, 1);
    quayFlagMesh.rotation.y = Math.PI * 0.5;
    quayFlagMesh.rotation.z = -st * 0.9 + Math.sin(quayTime * 6) * 0.10 * st;
    quayFlagMesh.scale.set(0.35 + st * 0.65, 1, 1);
  }
  if (quayPennant) {
    // the sock streams AFT (-Z in boat space) with the speed, flutters a
    // little once it is lifted, and leans across with the rudder
    const st = clamp(Math.abs(quayBoatSpeed) / quayBOAT_VMAX, 0, 1);
    const dir = quayBoatSpeed < 0 ? -1 : 1;
    quayPennant.rotation.x = dir * (0.12 + st * 1.15) + Math.sin(quayTime * 7.3) * 0.09 * st;
    quayPennant.rotation.z = -quayRudder * 0.28 + Math.sin(quayTime * 4.1) * 0.05;
  }

  // ---- the passenger at the wheel -----------------------------------------
  // Parked, not simulated: a capybara solving contacts against a deck that is
  // being teleported eleven metres a second loses the argument, and the whole
  // point of standing at a wheel is that you stay at it.
  if (quayHelmOn && capy && capy.body) {
    quayHelmWorld(quayV3);
    const cb = capy.body;
    cb.position.set(quayV3.x - Math.sin(quayBoatYaw) * 1.05,
                    quayV3.y - 0.10,
                    quayV3.z - Math.cos(quayBoatYaw) * 1.05);
    cb.velocity.set(b.velocity.x, 0, b.velocity.z);
    cb.angularVelocity.set(0, 0, 0);
    cb.previousPosition.copy(cb.position);
    cb.interpolatedPosition.copy(cb.position);
    if (capy.position) capy.position.set(cb.position.x, cb.position.y, cb.position.z);
    if (capy.group) {
      capy.group.position.set(cb.position.x, cb.position.y, cb.position.z);
      capy.group.rotation.y = quayBoatYaw;
    }
  }

  quayCheckVoyage(game, dt);
}

// ------------------------------------------------------------- the ground ---
/**
 * THE ONE THING THE HULL COULD NOT DO WAS HIT ANYTHING.
 *
 * MV Wheek is a KINEMATIC body whose position is written every frame from
 * quayStepBoat's own integration, and cannon does not stop a kinematic body with
 * a static one — that is the whole contract of kinematic. So for the life of
 * this chapter the ferry has sailed through Fort Denison, Shark Island, both
 * pylons of the Harbour Bridge, thirteen sandstone headlands and up the beach at
 * Manly without so much as a bump. Seven hundred metres of open water with no
 * hard edge in it is not a passage, it is a corridor with the walls painted on.
 *
 * Analytic, because the hull is the one body in the game that has to be stopped
 * without a solver: push her back out to the obstacle's radius, delete the
 * component of her way that was carrying her in, and keep whatever was carrying
 * her along it — so a glancing blow on Bradleys Head SLIDES her round the point
 * instead of parking her, which is what actually happens to a boat and is also
 * the difference between a wall and a punishment.
 *
 * The Freshwater is in here too, as a moving oriented box. Four hundred tonnes
 * you can drive through is worse than no ferry at all — quayBuildBigFerry says
 * so in its own comment and then gave her a collider that the only other vessel
 * on the harbour was constitutionally incapable of noticing.
 */
const quayGROUND_LINE = ['aground. astern, and try that again.',
                         'you have found the bottom. it was always there.'];
let quayBumpCool = 0;

function quayBump(game, hard, aground) {
  if (quayBumpCool > 0) return;
  quayBumpCool = 1.1;
  if (typeof game.sfx === 'function') {
    game.sfx('thud', { volume: clamp(0.35 + hard * 0.6, 0.35, 1), pitch: 0.42 });
    if (hard > 0.45) game.sfx('splash', { volume: 0.5, pitch: 0.75 });
  }
  if (typeof game.shake === 'function') game.shake(clamp(0.08 + hard * 0.34, 0.08, 0.42));
  if (hard > 0.5 && typeof game.toast === 'function') {
    game.toast(aground ? quayGROUND_LINE[randInt(0, 1)] : 'that is rock. it does not move.');
  }
}

/** Push the hull out of anything solid. Called after the integration. */
function quayShore(game, dt) {
  if (quayBumpCool > 0) quayBumpCool -= dt;
  const vx = Math.sin(quayBoatYaw) * quayBoatSpeed;
  const vz = Math.cos(quayBoatYaw) * quayBoatSpeed;

  for (let i = 0; i < quayHARD.length; i++) {
    const o = quayHARD[i];
    let dx = quayBoatX - o.x, dz = quayBoatZ - o.z;
    const d2 = dx * dx + dz * dz;
    if (d2 >= o.r * o.r) continue;
    const d = Math.sqrt(d2) || 0.001;
    dx /= d; dz /= d;
    quayBoatX = o.x + dx * o.r;
    quayBoatZ = o.z + dz * o.r;
    // how much of her way was pointed INTO it
    const into = -(vx * dx + vz * dz);
    if (into > 0) {
      quayBump(game, clamp(into / quayBOAT_VMAX, 0, 1), false);
      quayBoatSpeed *= 0.42;
    }
    return;
  }

  // --- THE QUAY ITSELF, WHICH WAS AN INVISIBLE LINE -------------------------
  //
  // Two things at this end of the harbour were not there at all.
  //
  // The APRON EDGE was `quayBoatZ = clamp(..., quayAPRON_Z - 4)` at the bottom
  // of the integration: no bump, no sound, no shake, no line. Since the berth
  // faces the shore (yaw 0 — you are meant to back her off the wall, which is
  // the entire point of the astern fix further up this file), the very first
  // thing a player does is open the throttle and drive into it, and what
  // happens is nothing whatever. Measured: fifty seconds at full ahead, pinned
  // on z = 12, SLIDING a hundred and thirty metres west along a wall that is
  // not drawn. That is the worst thirty seconds in the chapter and it is the
  // first thirty.
  //
  // The THREE FINGER WHARVES had no collision of any kind. Nine hundred tonnes
  // of timber standing in the fairway you leave down, and the boat went through
  // all three of them lengthways.
  if (quayBoatZ > quayAPRON_Z - 4) {
    quayBoatZ = quayAPRON_Z - 4;
    if (quayBoatSpeed * Math.cos(quayBoatYaw) > 0.2) {
      quayBump(game, clamp(Math.abs(quayBoatSpeed) / quayBOAT_VMAX, 0, 1), false);
      // ...and the first time, somebody tells you which way a boat comes off a
      // wall, because nothing else in the chapter does.
      if (!quayWalled && !quayCastOff) {
        quayWalled = true;
        if (quayHand && quayHand.anchor) {
          quayHand.anchor.speak('ASTERN! She comes off the wall backwards!');
          quayHand.cd = 10;
        }
      }
      quayBoatSpeed *= 0.25;
    }
    return;
  }
  for (let w = 0; w < quayWHARF_X.length; w++) {
    // 6.45, and the berth is at 6.60: she lies ALONGSIDE the middle finger and
    // a stand-off wider than that would eject her from her own berth on the
    // first frame of the chapter.
    const HX = quayWHARF_HX + 0.10 + quayBOAT_HX;
    const dx = quayBoatX - quayWHARF_X[w];
    if (Math.abs(dx) >= HX) continue;
    const z0 = quayWHARF_Z0 - 1.2 - quayBOAT_HX, z1 = quayAPRON_Z;
    if (quayBoatZ <= z0 || quayBoatZ >= z1) continue;
    // out by the shorter axis — a boat that has got alongside a finger is
    // pushed off its side, not squirted out of the end of it
    const ox = HX - Math.abs(dx), oz = quayBoatZ - z0;
    if (ox <= oz) quayBoatX = quayWHARF_X[w] + Math.sign(dx || 1) * HX;
    else quayBoatZ = z0;
    quayBump(game, clamp(Math.abs(quayBoatSpeed) / quayBOAT_VMAX, 0, 1), false);
    quayBoatSpeed *= 0.30;
    return;
  }

  // --- Manly: a wharf you come ALONGSIDE, and sand you do not ---------------
  // The berth is the side of the wharf, not the top of it. The deck stands
  // 1.03 above the waterline and the boat's own deck at 0.40, so without this
  // an approach a few metres off drove a timber ferry lengthways over a pier
  // and out the other side into the Corso.
  const mdx = quayBoatX - quayMANLY.x;
  const WH = 9.5 + quayBOAT_HX;
  if (Math.abs(mdx) < WH && quayBoatZ > quayMANLY.z - 6 && quayBoatZ < quayMANLY.z + 29) {
    const ox = WH - Math.abs(mdx);
    const oz = quayMANLY.z + 29 - quayBoatZ;
    if (oz < ox) quayBoatZ = quayMANLY.z + 29;
    else quayBoatX = quayMANLY.x + Math.sign(mdx || 1) * WH;
    quayBump(game, clamp(Math.abs(quayBoatSpeed) / quayBOAT_VMAX, 0, 1), false);
    quayBoatSpeed *= 0.30;
    return;
  }
  // and the sand either side of it, which is where a bad approach ends
  if (Math.abs(mdx) < 76 && quayBoatZ < quayMANLY.z - 4) {
    quayBoatZ = quayMANLY.z - 4;
    if (Math.abs(quayBoatSpeed) > 0.2) {
      quayBump(game, clamp(Math.abs(quayBoatSpeed) / quayBOAT_VMAX, 0, 1), true);
      quayBoatSpeed *= 0.25;
    }
    return;
  }

  // --- and the Freshwater, in her own axes ---------------------------------
  if (!quayBigBody) return;
  const fx = quayBoatX - quayBigPos.x, fz = quayBoatZ - quayBigPos.z;
  if (fx * fx + fz * fz > 44 * 44) return;
  const cs = Math.cos(quayBigYaw), sn = Math.sin(quayBigYaw);
  const lx = fx * cs - fz * sn, lz = fx * sn + fz * cs;
  const HX = quayBIG_HX + quayBOAT_HX + 0.4, HZ = quayBIG_HZ + quayBOAT_HX + 0.4;
  if (Math.abs(lx) >= HX || Math.abs(lz) >= HZ) return;
  // out by the shorter axis — a boat that has got alongside a ferry is pushed
  // off her side, not squirted out of her bow
  const ox = HX - Math.abs(lx), oz = HZ - Math.abs(lz);
  let px = 0, pz = 0;
  if (ox < oz) { px = Math.sign(lx || 1) * ox; } else { pz = Math.sign(lz || 1) * oz; }
  quayBoatX += px * cs + pz * sn;
  quayBoatZ += -px * sn + pz * cs;
  quayBump(game, clamp(Math.abs(quayBoatSpeed) / quayBOAT_VMAX + 0.35, 0, 1), false);
  quayBoatSpeed *= 0.30;
}

function quayNearBridge() {
  const dx = quayBoatX - quayBRIDGE.x, dz = quayBoatZ - quayBRIDGE.z;
  return dx * dx + dz * dz < 46 * 46;
}

/**
 * THE ARCH GIVES IT BACK.
 *
 * Two things happen under a bridge that do not happen anywhere else, and the
 * chapter's third task is to go under it and make a noise: the sound comes
 * back, and everything living on the underside leaves. The reward for
 * 'under-bridge' used to be one toast line.
 */
const quayBRIDGE_GULL_N = 26;
function quayBuildBridgeGulls(root) {
  const G = new THREE.BufferGeometry();
  G.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, -0.42, -1.30, 0.34, 0.24, 0, 0.02, 0.34,
    0, 0, -0.42, 0, 0.02, 0.34, 1.30, 0.34, 0.24,
  ], 3));
  G.setIndex([0, 1, 2, 3, 4, 5]);
  G.computeVertexNormals();
  const im = new THREE.InstancedMesh(G, mat(PALETTE.ibis, { side: THREE.DoubleSide }),
                                     quayBRIDGE_GULL_N);
  im.castShadow = false;
  im.frustumCulled = false;
  quayBridgeGull = im;
  root.add(im);
  quayUpdateBridgeGulls(0);
}

function quayUpdateBridgeGulls(dt) {
  const im = quayBridgeGull;
  if (!im) return;
  if (quayBridgeFlush > 0) quayBridgeFlush -= dt;
  const B = quayBRIDGE;
  const cs = Math.cos(B.yaw), sn = Math.sin(B.yaw);
  // 0 = sitting on the lower chord, 1 = gone
  const f = quayBridgeFlush > 0 ? clamp(1 - quayBridgeFlush / 7.0, 0, 1) : 0;
  for (let i = 0; i < quayBRIDGE_GULL_N; i++) {
    const t = (i / quayBRIDGE_GULL_N - 0.5);
    const u = t * B.span * 0.86;
    const perch = B.deck + Math.sin((t + 0.5) * Math.PI) * B.arch * 0.42 - 0.9;
    const side = (i % 2 ? 1 : -1) * 2.2;
    let x = B.x + u * cs + side * sn;
    let z = B.z - u * sn + side * cs;
    let y = perch;
    let yaw = B.yaw + (i % 2 ? 0.2 : -0.2) + Math.PI * 0.5;
    let sc = 0.8;
    if (f > 0) {
      // up and away down the wind, spiralling, and back to the girder as the
      // flush decays — so the arch is repopulated by the time you come back
      const rise = Math.sin(f * Math.PI) * (7 + (i % 5) * 3);
      const a = f * (5.5 + (i % 4) * 0.9) + i;
      const r = Math.sin(f * Math.PI) * (9 + (i % 6) * 4);
      x += Math.cos(a) * r;
      z += Math.sin(a) * r;
      y += rise;
      yaw = -a + Math.PI * 0.5;
      sc = 0.8 + Math.sin(f * Math.PI) * 0.25;
    }
    im.setMatrixAt(i, quayXform(x, y, z, f > 0 ? Math.sin(quayTime * 9 + i) * 0.34 : 0.05,
                                yaw, f > 0 ? 0.42 : 0, sc, sc, sc));
  }
  im.instanceMatrix.needsUpdate = true;
}

function quayBridgeEcho(game) {
  if (quayBridgeFlush > 5.5) return;             // one flush per pass
  quayBridgeFlush = 7.0;
  if (typeof game.sfx === 'function') {
    // the reply off the steel: a beat late, half as loud, and a shade lower.
    // 'horn' has a 2.2 s throttle so this cannot be a second horn — 'hiss'
    // pitched down is what a hundred and thirty metres of arch gives back.
    game.sfx('hiss', { volume: 0.55, pitch: 0.35 });
    game.sfx('gull', { volume: 0.85 });
  }
}

// ============================================================== THE WHALE ==
// THE HUMPBACK (L5). Seventy honest seconds of helmsmanship — yachts, the
// bridge, dolphins over 6.5 m/s, the Heads under the keel — and no beat in
// the middle of it. Humpbacks come up the coast past Sydney Heads every
// winter and the ferries slow down for them. So: once per passage, in the
// gap (quayHeadsK over 0.5, under way), one comes up forty metres off the
// beam — the whole animal, nose first, over on its back, and the fall is a
// sheet of white water, a boom you feel in the hull, the world at half
// speed and the lens from the deck with the whale in the frame. Then it is
// gone, and the passage is still the passage. Built once, parked under the
// sea, animated over quayWHALE_T seconds; nothing collides with it.
const quayWHALE_T = 3.2;               // s, from the first sight to the last of the splash
const quayWHALE_OFF = 30;              // m off the beam
const quayWHALE_L = 13;                // m, nose to flukes
let quayWhaleGroup = null, quayWhaleT = -1, quayWhaleX = 0, quayWhaleZ = 0, quayWhaleYaw = 0, quayWhaleSplashed = false;
let quayWhaleSeen = false;             // this passage; reset at the cast-off
function quayBuildWhale(root) {
  const M = quayMerger();
  const dark = 0x2c3540, pale = 0xd8dde2;
  // the body, nose at +z, in eight slabs tapering to the tail
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    const w = 3.2 * (1 - 0.75 * t * t) * (t < 0.15 ? 0.6 + t * 2.6 : 1);
    const h = 2.6 * (1 - 0.8 * t * t) * (t < 0.15 ? 0.6 + t * 2.6 : 1);
    const z = quayWHALE_L * 0.5 - 0.2 - t * (quayWHALE_L - 2.4);
    M.box(0, 0, z, w, h, quayWHALE_L / 8 + 0.2, dark);
    M.box(0, -h * 0.32, z, w * 0.82, h * 0.42, quayWHALE_L / 8 + 0.22, pale);   // the white throat and belly
  }
  // the flukes, and the long pectorals a humpback is named by
  M.box(0, 0.1, -quayWHALE_L * 0.5 - 0.6, 5.2, 0.28, 1.6, dark, 0, 0, 0);
  for (let s = -1; s <= 1; s += 2) {
    M.box(s * 2.6, -0.5, 1.4, 4.4, 0.22, 1.1, pale, 0, 0, s * 0.35);
  }
  M.box(0, 1.35, -1.2, 0.5, 0.7, 1.4, dark);        // the dorsal hump
  const m = new THREE.Mesh(M.build(), quayVC());
  m.castShadow = true;
  m.scale.set(1.25, 1.25, 1.25);
  quayWhaleGroup = new THREE.Group();
  quayWhaleGroup.add(m);
  quayWhaleGroup.position.set(0, -30, 0);
  quayWhaleGroup.visible = false;
  root.add(quayWhaleGroup);
}
function quayUpdateWhale(game, dt) {
  if (!quayWhaleGroup) return;
  // the sighting: in the gap, under way, once a passage
  if (quayWhaleT < 0) {
    if (!quayWhaleSeen && quayHelmOn && quayHeadsK > 0.5 && Math.abs(quayBoatSpeed) > 3) {
      quayWhaleSeen = true;
      quayWhaleT = 0; quayWhaleSplashed = false;
      const cs = Math.cos(quayBoatYaw), sn = Math.sin(quayBoatYaw);
      // off the starboard beam, and facing the boat, so the breach is toward you
      quayWhaleX = quayBoatX + cs * quayWHALE_OFF;
      quayWhaleZ = quayBoatZ - sn * quayWHALE_OFF;
      quayWhaleYaw = Math.atan2(quayBoatX - quayWhaleX, quayBoatZ - quayWhaleZ);
      quayWhaleGroup.visible = true;
      const cp = game.capy && game.capy.position;
      if (typeof game.slowmo === 'function') game.slowmo(0.5, 2.0);
      if (typeof game.frameShot === 'function' && cp) {
        game.frameShot({ yaw: Math.atan2(cp.x - quayWhaleX, cp.z - quayWhaleZ), dist: 22, pitch: 4 * Math.PI / 180, raise: 3.0, hold: 3.4, over: true });
      }
      if (typeof game.sfx === 'function') game.sfx('gasp', { volume: 0.7, pitch: 0.35, at: { x: quayWhaleX, y: 0, z: quayWhaleZ }, near: 20, far: 200, force: true });
      if (game.music && typeof game.music.swell === 'function') game.music.swell(0.7);
      if (typeof game.toast === 'function') game.toast('A HUMPBACK. off the starboard beam — the whole of it.');
    }
    return;
  }
  quayWhaleT += dt;
  const u = clamp(quayWhaleT / quayWHALE_T, 0, 1);
  // up nose-first to a length clear of the water, over on to the back, and down
  const up = Math.sin(Math.PI * Math.min(1, u / 0.82));
  const y = quayWATER_Y - 9 + 15.5 * up;
  const pitch = lerp(-1.25, 0.55, u / 0.82 < 1 ? (u / 0.82) : 1);
  const roll = u > 0.42 ? (u - 0.42) / 0.4 * 1.1 : 0;
  quayWhaleGroup.position.set(quayWhaleX, y, quayWhaleZ);
  quayWhaleGroup.rotation.set(pitch, quayWhaleYaw, Math.min(roll, 1.1), 'YXZ');
  if (!quayWhaleSplashed && u > 0.66) {
    quayWhaleSplashed = true;
    if (typeof game.sparks === 'function') {
      game.sparks(quayWhaleX, quayWATER_Y + 0.5, quayWhaleZ, 60, { spd: 7.5, up: 4.5, grav: 9, drag: 0.5, life: 1.6, size: 0.6, rgb: [1.3, 1.5, 1.7] });
      game.sparks(quayWhaleX, quayWATER_Y + 0.3, quayWhaleZ, 30, { spd: 4, up: 6, grav: 9, drag: 0.4, life: 1.4, size: 0.45, rgb: [1.4, 1.55, 1.7] });
    }
    if (typeof game.sfx === 'function') {
      game.sfx('splash', { volume: 1.0, pitch: 0.45, at: { x: quayWhaleX, y: 0, z: quayWhaleZ }, near: 20, far: 300, force: true });
      game.sfx('thud', { volume: 0.8, pitch: 0.4, at: { x: quayWhaleX, y: 0, z: quayWhaleZ }, near: 20, far: 300, force: true });
    }
    if (typeof game.punch === 'function') game.punch(0.16);
    quayBigRoll = Math.max(quayBigRoll, 7);       // the wash reaches the hull
  }
  if (u >= 1) { quayWhaleT = -1; quayWhaleGroup.visible = false; quayWhaleGroup.position.y = -30; }
}

/** The three things worth turning the wheel for, and the arrival. */
function quayCheckVoyage(game, dt) {
  quayUpdateWhale(game, dt);
  // ---- THE SECOND ASK (L6, F2): `cap-at-the-helm` reads capy.worn ---------
  // The costume is granted by the marquee and applied by systems.js in this
  // chapter, so the row is the passage done again with the cap on: eight
  // seconds at the wheel above four metres a second (measured: full ahead
  // from the berth is 10.4 m/s inside two seconds, and the first wall is
  // about eleven seconds out — twelve was a passage nobody could make).
  if (!quayCapHelmDone && game.capy) {
    const inCap = game.capy.atHelm && game.capy.worn === 'ferrycap' && Math.abs(quayBoatSpeed) > 4.0;
    quayCapHelmT = inCap ? quayCapHelmT + dt : 0;
    if (quayCapHelmT > 8) {
      quayCapHelmDone = true;
      if (game.completeTask) game.completeTask('cap-at-the-helm');
      if (game.toast) game.toast('the cap fits. the skipper has stopped pretending it does not.');
    }
  }
  if (quayRunT >= 0 && !quayVoyaged) {
    quayRunT += dt;
    // ---- THE PASSAGE, ON THE PAPER, WHILE IT IS BEING MADE (v32) ----------
    // The same quantity the record takes, not the raw clock: `quayArrivalT` is
    // the second she has to sit still to count as alongside and it is
    // subtracted at the finish, so subtracting it here too means the figure the
    // player watches is the figure they end up with rather than one a second
    // adrift of it.
    if (game.recordLive) game.recordLive('manly-voyage', Math.max(0, quayRunT - quayArrivalT));
    // ...AND THE SIGNPOST SAYS WHERE SHE IS (W1). Metres to the wharf head
    // and the sea state, so the Heads announce themselves on the paper before
    // they do under the keel.
    if (typeof game.wowLive === 'function') {
      const dm = Math.hypot(quayBoatX - quayMANLY.x, quayBoatZ - (quayMANLY.z + 12));
      const total = Math.hypot(quayMANLY.x, quayMANLY.z + 12 - quayAPRON_Z);
      const sea = quayHeadsK > 0.55 ? ' · the Heads' : quayHeadsK > 0.2 ? ' · swell coming in' : '';
      game.wowLive('under way · ' + Math.round(dm / 10) * 10 + ' m to Manly · ' + Math.floor(quayRunT) + ' s' + sea,
                   clamp(1 - dm / total, 0, 1));
    }
  }

  if (!quayCastOff && quayHelmOn && quayBoatZ < quayAPRON_Z - 26) {
    quayCastOff = true;
    quayWhaleSeen = false;                       // one humpback a passage (L5)
    // AND SOMEBODY WATCHES YOU GO. The deckhand has stood on that apron with
    // three lines about the wheel being unlocked since the chapter was written
    // and has never once reacted to the wheel being taken — which made him a
    // sign rather than a man. He shouts after the boat instead. It is the only
    // thing in seven hundred metres of open water that knows what you have done.
    if (quayHand && quayHand.anchor) {
      quayHand.anchor.speak(quayCASTOFF[randInt(0, quayCASTOFF.length - 1)]);
      quayHand.cd = 14;
    }
    // THE PASSAGE IS THE CHAPTER, so the passage gets a clock. It starts when
    // she is genuinely off the wall rather than at the moment you touch the
    // wheel, because otherwise the record rewards a fast grab of the helm and
    // not a well-steered run up the harbour.
    quayRunT = 0;

    quayTask('to-quay');
  }

  // --- and the sails, on the way out ---------------------------------------
  // Not a task — the list is seven lines and it is the right length. But the
  // most recognisable object in the southern hemisphere is now standing two
  // hundred metres east of the berth, the boat's head comes round to the north
  // straight past it, and a landmark that says nothing when you pass it close
  // aboard is scenery. One line, once, the first time you go by with way on.
  if (!quayOperaSeen && quayHelmOn && Math.abs(quayBoatSpeed) > 2.5) {
    const dx = quayBoatX - quayBEN.x, dz = quayBoatZ - (quayBEN.z - 14);
    if (dx * dx + dz * dz < 62 * 62) {
      quayOperaSeen = true;
      if (typeof game.sfx === 'function') game.sfx('chime', { volume: 0.55, pitch: 1.25 });
      if (typeof game.toast === 'function') game.toast('a million tiles, and not one of them white');
    }
  }

  // --- threading the regatta ------------------------------------------------
  // Counted as DISTINCT yachts passed close aboard, not as "two of them at once
  // for a second and a bit": the fleet is on six independent legs with six
  // different periods, so a simultaneous pair is a matter of luck, and a task
  // you cannot deliberately do is not a task. Two different boats, at speed, and
  // the mark is yours.
  // THE MASK USED TO BE THROWN AWAY THE MOMENT THE TASK TICKED. Two yachts
  // and quayRaceMask went to -1, which shut the whole block off — so the
  // fleet is six boats on six different legs and the game stopped counting at
  // the second one, for ever. It keeps counting now, and the number is how
  // many of the six you got close aboard on one passage, which is a thing you
  // can go back and be better at. Nothing is gated on it.
  if (quayHelmOn && Math.abs(quayBoatSpeed) > 4) {
    const n = quayFLEET.length / 6;
    for (let i = 0; i < n; i++) {
      if (quayRaceMask & (1 << i)) continue;
      const o = i * 6;
      const per = quayFLEET[o + 4];
      const u = 0.5 - 0.5 * Math.cos((quayTime / per + i * 0.37) * Math.PI * 2);
      const x = lerp(quayFLEET[o], quayFLEET[o + 2], u);
      const z = lerp(quayFLEET[o + 1], quayFLEET[o + 3], u);
      const dx = x - quayBoatX, dz = z - quayBoatZ;
      if (dx * dx + dz * dz > 19 * 19) continue;
      quayRaceMask |= (1 << i);
      quayRaceT++;
      if (typeof game.sfx === 'function') game.sfx('gasp', { volume: 0.5 });
      if (quayRaceT === 2) {
        quayTask('yacht-race');
        if (typeof game.toast === 'function') game.toast('starboard! …probably');
        if (typeof game.shake === 'function') game.shake(0.12);
      } else if (quayRaceT > 2) {
        // …and every one after that is its own small thing, because six for
        // six on one run up the harbour is genuinely hard to steer.
        if (typeof game.toast === 'function') {
          game.toast(quayRaceT >= n ? 'the whole fleet. every one of them.'
                                    : quayRaceT + ' of ' + n + ', and still going');
        }
        if (typeof game.sfx === 'function') game.sfx('chime', { volume: 0.45, pitch: 1.1 + quayRaceT * 0.06 });
      }
      if (quayRaceT >= 2 && typeof game.record === 'function') game.record('yacht-race', quayRaceT);
      // ---- AND THE TALLY IS ON THE PAPER, FOR A BEAT (v36) ----------------
      // A count is not an attempt with a clock on it, so it does not want a
      // line that is up for the whole passage — that would take the voyage's
      // own clock off the card for seventy seconds to show a number that moved
      // six times. Called ONCE, here, on the frame it changes: the line's
      // watchdog (sysREC_STALE, 1.6 s) takes it down again by itself, so this
      // is a flash and not furniture, and it costs no timer and no new state.
      if (typeof game.recordLive === 'function') game.recordLive('yacht-race', quayRaceT);
      break;
    }
  }

  // --- the escort: hold better than 6.5 m/s for six seconds ----------------
  // …AND HOW LONG YOU KEPT THEM. The old shape set the timer to 1000 the
  // instant the task ticked, which both completed it and destroyed the only
  // number in it — hold a dolphin escort for a minute and a half and the game
  // could not tell you. It runs on now, and the run is posted when they leave.
  if (quayDolphinOn > 0.7) {
    quayEscortT += dt;
    // ...and the clock is on the paper while they are alongside (v36). This one
    // DOES take the line off the voyage, deliberately: the passage is seventy
    // seconds long and the escort is a handful, so for as long as there are
    // dolphins off the bow the specific thing happening is the interesting
    // number. It is below the voyage's own call in this file for exactly that
    // reason — the last caller in a frame owns the line.
    if (typeof game.recordLive === 'function') game.recordLive('dolphin-escort', quayEscortT);
    if (quayEscortT > 6 && !quayEscorted) {
      quayEscorted = true;
      quayTask('dolphin-escort');
      if (typeof game.toast === 'function') game.toast('they always know');
      if (typeof game.sfx === 'function') game.sfx('splash', { volume: 0.6 });
    }
  } else {
    if (quayEscortT > 6 && typeof game.record === 'function') game.record('dolphin-escort', quayEscortT);
    quayEscortT = 0;
  }

  // --- somebody on the wharf talks you in -----------------------------------
  // One call per range per passage (quayCallMask), and the fast one outranks
  // whichever range you are in, because "you are coming in too hot" is more
  // useful than "you are two hundred metres out".
  if (!quayVoyaged && quayLand && quayLand.anchor) {
    const ax = quayBoatX - quayMANLY.x, az = quayBoatZ - (quayMANLY.z + 12);
    const ad = Math.sqrt(ax * ax + az * az);
    const sp = Math.abs(quayBoatSpeed);
    let bit = -1, list = null;
    if (ad < 46 && sp > 7.5 && !(quayCallMask & 8)) { bit = 8; list = quayCALL_FAST; }
    else if (ad < 22 && !(quayCallMask & 4)) { bit = 4; list = quayCALL_NEAR; }
    else if (ad < 52 && !(quayCallMask & 2)) { bit = 2; list = quayCALL_MID; }
    else if (ad < 130 && !(quayCallMask & 1)) { bit = 1; list = quayCALL_FAR; }
    if (list && quayLand.cd <= 0) {
      quayCallMask |= bit;
      quayLand.anchor.speak(list[randInt(0, list.length - 1)]);
      quayLand.cd = 5.5;
      if (typeof game.sfx === 'function') {
        game.sfx('whistle', { volume: 0.34, pitch: bit === 8 ? 1.35 : 1.05,
                               at: { x: quayMANLY.x, y: quayWATER_Y + 2.2, z: quayMANLY.z + 6 },
                               near: 30, far: 220 });
      }
    }
  }

  // --- alongside at Manly ---------------------------------------------------
  const dx = quayBoatX - quayMANLY.x, dz = quayBoatZ - (quayMANLY.z + 12);
  const near = dx * dx + dz * dz < 34 * 34;
  if (near && Math.abs(quayBoatSpeed) < 4.5) {
    quayArrivalT += dt;
    if (!quayVoyaged && quayArrivalT > 1.0) {
      quayVoyaged = true;
      quayTask('manly-voyage');

      // FRAME THE ARRIVAL — the fourth channel, on the payout of this
      // chapter's wow. `over: true` for the same reason Antarctica's helm shot
      // needs it: this marquee happens ON a vehicle whose rig owns the lens, so
      // without it the weight is multiplied to nothing and the shot changes
      // the picture by zero. Batch 2 had no way to ask for a bearing at all;
      // batch 3 built one and did not come back for chapters 1-3.
      //
      // Astern and low, looking up the boat's own line at the beach: the
      // bearing is the hull's heading turned round, so the camera sits behind
      // the transom with Manly filling the frame ahead. Computed off
      // quayBoatYaw rather than written down, because the boat can come
      // alongside on any heading the player chose.
      if (typeof game.frameShot === 'function') {
        game.frameShot({ yaw: quayBoatYaw + Math.PI, dist: 24, pitch: 0.16,
                         raise: 4.2, hold: 3.2, over: true });
      }
      // Measured end to end, minus the second she has to sit still to count as
      // alongside — so the number is the passage and not the paperwork. An
      // ordinary run up the harbour is about 71 s.
      if (quayRunT > 0 && typeof game.record === 'function') {
        game.record('manly-voyage', Math.max(0, quayRunT - 1.0));
      }

      // FROM THE BOAT, not from the middle of the listener's head. The
      // approach calls seventy lines above already place themselves; the
      // arrival — the loudest moment in the chapter and the payout of its
      // wow — did not, on a hull whose position is right here. See THE SOUND
      // COMES FROM SOMEWHERE in CONTRACT.
      if (typeof game.sfx === 'function') {
        const at = { x: quayBoatX, y: 1.4, z: quayBoatZ };
        game.sfx('horn', { at: at, near: 12, far: 260 });
        game.sfx('chime', { volume: 0.9, at: at, near: 10, far: 120 });
      }
      if (typeof game.toast === 'function') game.toast('Manly. all ashore that’s going ashore.');
      // ...and the wharf is pleased to see her (L5)
      if (typeof game.sfx === 'function') game.sfx('cheer', { volume: 0.5, pitch: 1.1, at: { x: quayMANLY.x, y: quayWATER_Y + 2, z: quayMANLY.z + 6 }, near: 20, far: 160, force: true });
      if (typeof game.slowmo === 'function') game.slowmo(0.6, 1.0);
      // ...AND SOMEBODY TAKES THE LINE.
      // Seventy seconds of open water ended in a line of text. A ferry
      // arriving is a rope thrown across the gap and a person on the wharf who
      // catches it, and the wharf hand has been standing there the whole time.
      quayLineT = 0;
      quayHornSteam = 1.4;
      if (quayLand && quayLand.anchor) {
        quayLand.anchor.speak(quayARRIVE[randInt(0, quayARRIVE.length - 1)]);
        quayLand.cd = 16;
      }
    }
  } else {
    quayArrivalT = 0;
  }
}

// ================================================================= THE WORLD ==
function quayBuild(game) {
  if (quayBuilt) return;
  quayBuilt = true;
  quayInitGeos();

  quayRoot = new THREE.Group();
  quayRoot.name = 'quay';
  game.scene.add(quayRoot);

  quayRoot.add(quayBuildWater());
  quayRoot.add(quayBuildGlitter());
  quayBuildQuayside(game, quayRoot);
  quayBuildCity(game, quayRoot);
  quayBuildOpera(game, quayRoot);
  quayBuildBridge(game, quayRoot);
  quayBuildLand(game, quayRoot);
  quayBuildShores(game, quayRoot);
  quayBuildBush(quayRoot);
  quayBuildPines(game, quayRoot);
  quayBuildWhale(quayRoot);                      // the humpback in the Heads (L5)
  quayBuildCockatoos(quayRoot);
  quayBuildApronDress(game, quayRoot);
  quayBuildMoorings(game, quayRoot);
  quayBuildSurf(quayRoot);
  quayBuildBuoys(quayRoot);
  quayBuildFleet(quayRoot);
  quayBuildBigFerry(game, quayRoot);
  quayBuildBigWake(quayRoot);
  quayBuildGulls(quayRoot);
  quayBuildWakeGulls(quayRoot);
  quayBuildBridgeGulls(quayRoot);
  quayBuildDolphins(quayRoot);
  quayBuildWake(quayRoot);
  quayBuildCats(quayRoot);
  quayBuildSpray(quayRoot);
  quayBuildTraffic(quayRoot);
  quayBuildFar(quayRoot);
  quayBuildBerthed(game, quayRoot);
  quayBuildCrowd(game, quayRoot);
  quayBuildPax(quayRoot);
  quayBuildLine(quayRoot);
  quayBuildChips(quayRoot);
  quayBuildBoat(game, quayRoot);
  // ...and hers, parented to the hull rather than placed against it — so this
  // has to come AFTER quayBuildBoat, which is what makes quayBoatGroup. Called
  // before it, quayBuildWheekPax takes a null group and returns silently, and
  // MV Wheek sails empty exactly as she did before with nothing to show why.
  quayBuildWheekPax(quayBoatGroup);

  // ---- WHAT THEY SAY WHEN SOMETHING HAPPENS ------------------------------
  // addLocal takes four optional reaction lists — startled / splash / thief /
  // rush — and every one of the eleven people on this harbour was falling
  // through to npcLOC_SAY, which is deliberately chapter-neutral: it has to
  // work in a Venetian sacristy and inside a mountain, so it can never mention
  // a wharf, a ferry, a gull or the water. On a chapter that is ENTIRELY
  // wharf, ferry, gull and water, the most characterful cast in the game was
  // answering everything with "Mm." One table, shared by all of them, and
  // nobody has to be given their own.
  const W = {
    startled: ['Oi — watch it!', 'That is coming out of somebody’s wages.',
               'Mind the paintwork.', 'Regular as the ferry, that.',
               'Right on the timetable, that.', 'I did not see anything.'],
    splash:   ['Straight in the harbour.', 'That is the tide’s problem now.',
               'Twelve metres down, that is.', 'It will wash up at Kirribilli.',
               'The bream will love that.', 'Do not go in after it. Please.'],
    thief:    ['You have not paid for that.', 'That is wharf property.',
               'There is a form for that. There is always a form.',
               'Put it back before somebody official comes.',
               'I am going to write "seagull" in the book.'],
    rush:     ['No running on the wharf!', 'It is going somewhere.',
               'Slow down — the boards are wet!', 'Ferry’s not for ten minutes, mate.',
               'Somebody is late for the four fifteen.'],
  };

  // ---- THE PEOPLE WHO LIVE HERE ------------------------------------------
  // See npc.js, THE LOCALS. A deckhand at the berth and the chip shop at the
  // far end, which are the only two places in seven hundred metres of open
  // water where there is anybody to talk to at all.
  if (typeof game.addLocal === 'function') {
    // y = 0.20 is the top of the apron slab. It was 0.4, so the deckhand has
    // been standing twenty centimetres over his own wharf. Probe the surface;
    // never guess it — see the note on the Kyoto miller in npc.js.
    quayHand = game.addLocal({ biome: 'quay', x: 0, y: 0.20, z: 24, near: 7,
      // THE AUTHORITY (L3, F1): the deckhand is the one person on this apron
      // whose job it is to put a nuisance off the wharf. See npc.js.
      authority: true, role: 'the deckhand',
      figure: { shirt: PALETTE.hiVis, legs: PALETTE.denim },
      // ---- AND SOME OF THESE ONLY EXIST ONCE SOMETHING HAS HAPPENED -------
      // localResolve in npc.js has taken conditional lines since v20 and this
      // chapter used it nowhere, which meant the deckhand who unlocks the
      // wheel for you went on telling you the wheel was unlocked while you
      // were standing at Manly having driven the boat there yourself. A
      // `before:` line belongs to a stranger; an `after:` line can only be
      // said to somebody who was there.
      lines: [
              // ---- THEY HAVE HEARD ABOUT YOU (L3, E3): one line keyed on a wow elsewhere
              { t: 'The Opera House. I heard. This boat has a bell and it is not for you.', after: 'opera-stage' },
              'Mind the gap. Everybody minds the gap eventually.',
              { t: 'She goes when she goes. Wheel is unlocked.', before: 'take-helm' },
              { t: 'Thirty minutes across, if the harbour behaves.', before: 'manly-voyage' },
              { t: 'You have got the wheel. I am going to sit down.', after: 'take-helm' },
              { t: 'Alongside at Manly, first go. Thirty years I have been watching people not do that.', after: 'manly-voyage' }],
      startled: W.startled, splash: W.splash, thief: W.thief, rush: W.rush,
      wheek: ['That is the horn, near enough.'] });
    // ---- AND ONE PERSON YOU WILL SEE AGAIN (P6) -------------------------
    // On the wharf with a pack on, waiting for a boat, which is where a
    // person who is about to be in three more chapters ought to start. They
    // do not know you yet — every line here is what you say to a stranger —
    // and that is the whole of the setup.
    if (typeof game.addTraveller === 'function') {
      game.addTraveller({ biome: 'quay', x: -4.5, y: 0.20, z: 21, face: 0.5,
        lines: ['Six months. I have got six months and a very bad map.',
                'Everybody says start here and go west. So. West.',
                { t: 'Is that boat going anywhere? Is anybody driving it?', before: 'take-helm' },
                { t: 'Somebody IS driving it. That is somehow worse.', after: 'take-helm' }],
        wheek: ['Was that you? That was you.'] });
    }
    // ...AND HE WAS STANDING INSIDE HIS OWN SHOP. (quayMANLY.x, quayMANLY.z-30)
    // is the exact centre of the chip shop's footprint, walls, roof and all —
    // an eleven-metre building with a man in the middle of it. He belongs at
    // the counter, which is at quayCHIPS, two metres out of the doorway.
    game.addLocal({ biome: 'quay', x: quayCHIPS.x + 1.5, y: quayWATER_Y + 1.125,
      z: quayCHIPS.z + 1.6, near: 8, face: Math.PI,
      figure: { shirt: PALETTE.cloth6, hat: PALETTE.cloth6 },
      // THE ERRAND (L3-8): a cone of chips down the Corso to the first shop's verandah
      errand: { to: [1.1, 11.0], carry: 'chips', every: 34 },
      // the fryer basket, every few seconds
      beat: { kind: 'work', every: 6.5, dur: 0.8, sfx: 'rustle', volume: 0.11, pitch: 1.35 },
      lines: ['Chips are two minutes. They are always two minutes.',
              { t: 'Do not feed the seagulls. Do not even look at them.', before: 'manly-pine' },
              { t: 'You came the whole way across for chips. Respect.', after: 'manly-voyage' },
              { t: 'You did not feed them. You WERE them. Whole different thing.', after: 'manly-pine' }],
      startled: W.startled, splash: W.splash, thief: W.thief, rush: W.rush,
      wheek: ['Right, that has done it. Here they come.'] });
    // A FERRY TERMINAL IS MOSTLY A MACHINE FOR QUEUEING and there were two
    // people in the whole of it — one at each end of seven hundred metres.
    // Three more, all of them where somebody actually stands: under the shelter
    // on the middle finger, at the gates, and out on the head of the wharf
    // where the fishing is.
    game.addLocal({ biome: 'quay', x: quayWHARF_X[1] - 2.8, y: quayWHARF_Y + 0.07, z: 12.2,
      near: 6, face: 1.9,
      figure: { shirt: PALETTE.cloth4, legs: PALETTE.stoneDark },
      lines: ['The four fifteen has never once left at four fifteen.',
              'I do this crossing twice a day. It is still the best commute in the world.',
              { t: 'You are not on the timetable. I have checked.', before: 'take-helm' },
              { t: 'You are not on the timetable and you are DRIVING. I have checked twice.', after: 'take-helm' },
              { t: 'Twice a day since the Olympics and I have never once been under it that close.', after: 'under-bridge' }],
      startled: W.startled, splash: W.splash, thief: W.thief, rush: W.rush,
      wheek: ['Nobody even looked up. That is Sydney for you.'] });
    game.addLocal({ biome: 'quay', x: -11, y: 0.20, z: quayAPRON_Z1 - 9.2, near: 6, face: 0.2,
      // D2: a commuter on the apron, commuting. The paving here is the flattest
      // and busiest ground in the chapter and the crowd already walks through it.
      // SOUTH rather than north: +9 put the far end inside the finger sheds and
      // the nav probe refused the whole route (walkAudit `why: blocked`).
      walk: { dx: 0, dz: -9, dwell: 4 },
      figure: { shirt: PALETTE.cloth2, hat: PALETTE.wharfIron },
      lines: ['Tap on, tap off. There is no tap for whatever you are.',
              { t: 'Wharf three for Manly, wharf five for Taronga. Do not ask me why.', before: 'to-quay' },
              'If you are going to be sick, be sick on the outside deck.',
              { t: 'You did not tap on. You did not tap off. You took the boat.', after: 'take-helm' },
              { t: 'She came back alongside at Manly. Somebody owes somebody a form.', after: 'manly-voyage' }],
      startled: W.startled, splash: W.splash, thief: W.thief, rush: W.rush,
      wheek: ['Right through the barrier. Marvellous.'] });
    game.addLocal({ biome: 'quay', x: quayWHARF_X[0] - 1.4, y: quayWHARF_Y + 0.07, z: -3.0,
      near: 6, face: Math.PI,
      figure: { shirt: PALETTE.cloth5, hat: PALETTE.khaki },
      // four hours on a rail and nothing on the line
      beat: { kind: 'rock', every: 7.5, dur: 2.4 },
      lines: ['Yellowtail, mostly. Sometimes a bream that has made a mistake.',
              'Been coming here since before the tunnel. Water is cleaner now.',
              'You will scare them. …ah, they were not biting anyway.',
              { t: 'Dolphins came in off the Heads for you. They do not do that for me.', after: 'dolphin-escort' },
              { t: 'Whole harbour heard that horn. So did every fish under this wharf.', after: 'under-bridge' }],
      startled: W.startled, splash: W.splash, thief: W.thief, rush: W.rush,
      wheek: ['Well. That is the afternoon finished.'] });

    // ---- and five more, because the chapter had two ends and nothing in the
    // middle of either of them. Everybody below stands somewhere that exists:
    // the terrainHeight for each of these points was probed, which is the
    // whole lesson of the Kyoto miller (see THE LOCALS in npc.js).

    // the busker under the arcade, who is the reason the concourse has a sound
    quayLocBusker = game.addLocal({ biome: 'quay', x: 34, y: 0.20, z: quayAPRON_Z1 - 3.4, near: 7, face: -0.4,
      figure: { shirt: PALETTE.cloth7, hat: PALETTE.hair1 },
      // the busker, and he never stops
      beat: { kind: 'work', every: 4.2, dur: 0.9, sfx: 'strum', volume: 0.13 },
      lines: ['Four hours a day, six days. The acoustics under here are free.',
              'Everybody stops for the last eight bars and nobody stops for the first.',
              'You are the second capybara this month. The first one had a hat.',
              { t: 'I heard the horn under the arch. Right in my key, as it happens.', after: 'under-bridge' },
              { t: 'You left. You came back. Nobody comes back.', after: 'manly-voyage' }],
      startled: W.startled, splash: W.splash, thief: W.thief, rush: W.rush,
      wheek: ['That is a B flat. Do it again on the two.'] });

    // the woman photographing the Bridge, who is facing the wrong way on purpose
    game.addLocal({ biome: 'quay', x: -18, y: 0.20, z: quayAPRON_Z + 2.6, near: 6.5, face: 3.0,
      figure: { shirt: PALETTE.cloth1, legs: PALETTE.khaki },
      lines: ['Nine hundred photographs of the same arch. This one will be the one.',
              'You cannot get it and the Opera House in one shot. Everyone tries.',
              'The light goes gold at about five. Stay for it.',
              { t: 'Nine hundred and one, and there is a ferry under the arch in this one.', after: 'under-bridge' },
              { t: 'I got the whole yacht race with you going through the middle of it.', after: 'yacht-race' }],
      startled: W.startled, splash: W.splash, thief: W.thief, rush: W.rush,
      wheek: ['—and there it is. Best one all week.'] });

    // the man on the Opera House steps, on the podium she can actually reach
    game.addLocal({ biome: 'quay', x: quayBEN.x - 6, y: quayWATER_Y + quayBEN.y,
      z: quayBEN.z + 19, near: 8, face: 2.6,
      figure: { shirt: PALETTE.cloth6, legs: PALETTE.hair2 },
      lines: ['Second interval. Fourteen minutes and then it is the whole of act three.',
              'The shells are tiles. A million of them, and every one is a different white.',
              'You are not on the ticket. …nor is anyone, at these prices.',
              { t: 'A horn under the Bridge in the second interval. Best thing all evening.', after: 'under-bridge' },
              { t: 'Half of act three watched you go past the window instead.', after: 'manly-voyage' }],
      startled: W.startled, splash: W.splash, thief: W.thief, rush: W.rush,
      wheek: ['They will hear that from the Concert Hall.'] });

    // THE WHARF HAND AT MANLY, who is the other end of the voyage and who
    // catches the line when you finally get her alongside. See quayCheckVoyage.
    quayLand = game.addLocal({ biome: 'quay', x: quayMANLY.x - 6.4, y: quayWATER_Y + 1.61,
      z: quayMANLY.z + 6.0, near: 9, face: Math.PI * 0.5,
      figure: { shirt: PALETTE.hiVis, legs: PALETTE.denim },
      // THE ERRAND (L3-8): a coffee across the deck to the bench by the shed
      errand: { to: [10.8, -1.4], carry: 'coffee', every: 44 },
      lines: [{ t: 'She is not due for twenty minutes and she is not that colour.', before: 'manly-voyage' },
              { t: 'Throw us a line when you come alongside. If you come alongside.', before: 'manly-voyage' },
              'Everything on this wharf came off a boat. Including me.',
              { t: 'Alongside. On the wharf. That is a boat that has arrived, that is.', after: 'manly-voyage' },
              { t: 'Chip shop is up the Corso. You will not need directions, by the sound of it.', after: 'manly-pine' }],
      startled: W.startled, splash: W.splash, thief: W.thief, rush: W.rush,
      wheek: ['Heard you coming from the Heads, mate.'] });

    // the lifeguard on the tower, who has the only job at Manly
    game.addLocal({ biome: 'quay', x: quayMANLY.x - 34, y: quayWATER_Y + 1.125,
      z: quayMANLY.z - 13.5, near: 8, face: 0.1,
      figure: { shirt: PALETTE.manFlagYel, legs: PALETTE.manFlagRed },
      lines: ['Between the flags. That is the whole of the law down here.',
              'Rip out past the third bank all afternoon. You will be fine — you float.',
              'Bluebottles this morning. Nobody told the bluebottles about the flags.',
              { t: 'You came in on the boat, not the ferry. I had to look twice.', after: 'manly-voyage' },
              { t: 'The gulls are all up the Corso now. That is somebody’s doing.', after: 'manly-pine' }],
      startled: W.startled, splash: W.splash, thief: W.thief, rush: W.rush,
      wheek: ['…that is not a whistle I know.'] });
  }

  // ---- THE AUTHORITY, AND WHERE TO HIDE FROM THEM (L3, F1) ----------------
  // See THE HIDE in systems.js. Every one of these is a thing the apron already
  // draws, at the coordinates it draws it: under the shelter on the middle
  // finger, under the cafe tables outside the coffee cart, round the back of
  // the cart, behind the departures board, and against a fig tub.
  if (typeof game.addHide === 'function') {
    game.addHide({ biome: 'quay', x: quayWHARF_X[1], z: 12.2, r: 2.2, kind: 'the shelter' });
    game.addHide({ biome: 'quay', x: 20 + 4.6 + 3.0, z: quayAPRON_Z1 - 13.5 - 0.6 + 2.2, r: 1.8, kind: 'under the table' });
    game.addHide({ biome: 'quay', x: 20, z: quayAPRON_Z1 - 13.5 + 2.6, r: 1.8, kind: 'behind the coffee cart' });
    game.addHide({ biome: 'quay', x: -29, z: quayAPRON_Z1 - 5.4 + 1.2, r: 2.0, kind: 'behind the board' });
    game.addHide({ biome: 'quay', x: -38 + 3 * 11, z: quayAPRON_Z1 - 17.5 + 1.4 + 1.2, r: 1.8, kind: 'the fig tub' });
  }

  if (typeof game.registerShadowTarget === 'function') game.registerShadowTarget(quayBoatGroup);
}

// ------------------------------------------------------------------- API -----
function quayIsOverWater(x, z) {
  // EVERYTHING landward of the apron edge is land, not just the paved bit —
  // but only as far as the paving actually goes. `z >= 16 && |x| <= 130` was
  // an entire QUADRANT of open harbour reported as dry: measured, a capybara
  // dropped at (100, 20) — which is a hundred metres of clear water east of
  // the apron, with the Opera House now standing in the middle of it — stood
  // there, grounded, at y = 0.18, held up by nothing but capybara.js's
  // analytic backstop reading terrainHeight() = 0. Walking east along the
  // apron edge and carrying straight on was enough to do it. The same
  // expression also had no far edge, so the street behind the terminal ran
  // south for ever into unlit void.
  //
  // The rule now is the one it should always have been: land is the paving
  // that is drawn, and the paving that is drawn is `quayLAND_*`.
  if (z >= quayAPRON_Z && z <= quayLAND_Z1 && Math.abs(x) <= quayLAND_HX) return false;
  // ...and Bennelong Point, which is a podium you can swim to and climb out on.
  // VERIFIED in X8, because the same sentence about Bradleys Head turned out to
  // have been written from a teleport: swimming at this point from all four
  // sides on all four keys, the south approach grounds the animal at 2.96 —
  // above the podium's own 2.60 — while the north, east and west legs top out
  // at 1.4-2.3 and never ground. The difference is the nine steps: they run
  // from the podium at 2.60 down to 0.20, which is the waterline, so there is
  // somewhere to come out. A headland is a box from the seabed to its crown and
  // there is not.
  if (Math.abs(x - quayBEN.x) <= quayBEN.hx && Math.abs(z - quayBEN.z) <= quayBEN.hz) return false;
  if (z >= quayWHARF_Z0 && z < quayAPRON_Z) {
    for (let w = 0; w < quayWHARF_X.length; w++) {
      if (Math.abs(x - quayWHARF_X[w]) <= quayWHARF_HX + 0.6) return false;
    }
  }
  // Manly: the beach shelf and the wharf
  const mx = x - quayMANLY.x, mz = z - quayMANLY.z;
  if (Math.abs(mx) <= 75 && mz <= -4 && mz >= -88) return false;
  if (Math.abs(mx) <= 9 && mz <= 29 && mz >= -5) return false;
  // the islands and the headlands are land, and none of them is swimmable-to,
  // but a capybara that ends up on one should stand on it rather than tread
  if (quayInDisc(x, z, quayFORT.x, quayFORT.z, quayFORT.r)) return false;
  if (quayInDisc(x, z, quaySHARK.x, quaySHARK.z, quaySHARK.r)) return false;
  // ...and neither is a headland. Thirteen of them, and every one used to be
  // open water as far as this function was concerned — see quayHEADS.
  if (quayHeadAt(x, z)) return false;
  // NOT THE PYLONS. Their static box does the whole job and a disc round them
  // would not match it — the corners of a 10.6 x 14.6 footprint stick out of
  // any circle that fits inside it, so the ring between the two is water the
  // capybara would be told it can stand on with nothing under it. Worse, a
  // terrainHeight of thirty-one metres there feeds capybara.js's soft-floor
  // backstop, which adds upward velocity toward whatever the ground claims to
  // be: swim up to a pylon and levitate. Solid is solid; leave it at that.
  return true;
}

/**
 * The bluff whose solid part covers (x, z), or null. The same octagon the
 * collider is built from, so what you can stand on and what you cannot swim
 * into are the one shape.
 */
function quayInOct(dx, dz, a) {
  if (Math.abs(dx) > a * 1.42 || Math.abs(dz) > a * 1.42) return false;
  if (Math.abs(dx) <= a && Math.abs(dz) <= a) return true;
  const rx = (dx + dz) * 0.7071, rz = (dz - dx) * 0.7071;
  return Math.abs(rx) <= a && Math.abs(rz) <= a;
}
function quayHeadAt(x, z) {
  for (let i = 0; i < quayHEADS.length; i++) {
    const h = quayHEADS[i];
    if (quayInOct(x - h.x, z - h.z, h.r * h.cf)) return h;
  }
  return null;
}
/** How high the crown of `h` stands at (x, z). Same tiers as the collider. */
function quayHeadTop(h, x, z) {
  const a = h.r * h.cf, dx = x - h.x, dz = z - h.z;
  for (let t = quayHEAD_TIER.length - 1; t >= 0; t--) {
    if (quayInOct(dx, dz, a * quayHEAD_TIER[t][0])) return h.h * quayHEAD_TIER[t][1];
  }
  return h.h;
}
/**
 * THE HEIGHT OF THE GROUND, which in a chapter that is nine tenths water is
 * zero nearly everywhere and is not zero on the two islands.
 */
function quayGroundY(x, z) {
  // EVERY WALKING SURFACE IN THE CHAPTER, NOT JUST THE TWO ISLANDS.
  //
  // This used to answer a flat zero over the apron (top 0.20), the three
  // finger wharves (0.40), Bennelong Point (2.90), the Manly wharf (1.03),
  // the dry sand (0.63) and the cove floor (0.45) — six surfaces, every one
  // of them held up by a static box the function had never heard of. Nothing
  // fell through, because the boxes are real; but terrainHeight is what the
  // hint arrow, the stuck-rescue, the local anchors and capybara.js's
  // soft-floor backstop all read, so all four were being told the animal was
  // standing at sea level while it was standing on a wharf.
  // BENNELONG POINT FIRST, because it OVERLAPS the apron's east wing — the
  // point grows out of the quay, which is the whole reason it is a point, and
  // whichever of the two answers first is the one the hint arrow and the
  // stuck-rescue believe. The nine steps ramp between the two heights.
  if (Math.abs(x - quayBEN.x) <= quayBEN.hx &&
      z > quayBEN_STEP_Z0 - quayBEN_TREAD * 0.5 && z <= quayBEN_STEP_Z1 + quayBEN_TREAD) {
    const i = clamp(Math.floor((z - quayBEN_STEP_Z0 + quayBEN_TREAD * 0.5) / quayBEN_TREAD),
                    0, quayBEN_STEPS - 1);
    return quayWATER_Y + quayBEN.y - quayBEN_RISE * (i + 1);
  }
  if (Math.abs(x - quayBEN.x) <= quayBEN.hx &&
      z >= quayBEN.z - quayBEN.hz && z <= quayBEN_STEP_Z0 - quayBEN_TREAD * 0.5) {
    return quayWATER_Y + quayBEN.y;
  }
  if (z >= quayAPRON_Z && z <= quayLAND_Z1 && Math.abs(x) <= quayLAND_HX) {
    return 0.20;
  }
  if (z >= quayWHARF_Z0 && z < quayAPRON_Z) {
    for (let w = 0; w < quayWHARF_X.length; w++) {
      if (Math.abs(x - quayWHARF_X[w]) <= quayWHARF_HX + 0.6) return quayWHARF_Y + 0.07;
    }
  }
  {
    const mx = x - quayMANLY.x, mz = z - quayMANLY.z;
    if (Math.abs(mx) <= 9 && mz <= 29 && mz >= -5) return quayWATER_Y + 1.61;    // the wharf deck
    if (Math.abs(mx) <= 48 && mz <= -7 && mz >= -33) return quayWATER_Y + 1.125; // the dry sand
    if (Math.abs(mx) <= 75 && mz <= -4 && mz >= -88) return quayWATER_Y + 0.95;  // the cove floor
  }
  // THE GUN PLATFORM'S TOP IS 2.8, NOT 2.3. `L.box(..., WATER_Y + 2.9, ..., 0.8, ...)`
  // draws a slab whose top face is at quayWATER_Y + 3.3 - 0.5 = 2.8, and this
  // answered 2.3 — so a capybara that swam out to Fort Denison stood half a
  // metre inside the flagstones, which is the same class of miss as the two
  // metres it used to stand inside the rock.
  if (quayInDisc(x, z, quayFORT.x, quayFORT.z, quayFORT.r * 0.86)) return quayWATER_Y + 3.3;
  if (quayInDisc(x, z, quaySHARK.x, quaySHARK.z, quaySHARK.r * 0.86)) return quayWATER_Y + 2.4;
  const h = quayHeadAt(x, z);
  if (h) return quayHeadTop(h, x, z);
  return 0;
}
function quayInDisc(x, z, cx, cz, r) {
  const dx = x - cx, dz = z - cz;
  return dx * dx + dz * dz <= r * r;
}

function quayInZone(name, x, z) {
  if (name === 'apron') return z >= quayAPRON_Z && z <= quayAPRON_Z1 && Math.abs(x) <= quayAPRON_HX;
  if (name === 'manly') {
    const mx = x - quayMANLY.x, mz = z - quayMANLY.z;
    return Math.abs(mx) <= 70 && mz <= 0 && mz >= -80;
  }
  if (name === 'corso') {
    const mx = x - quayMANLY.x, mz = z - quayMANLY.z;
    return Math.abs(mx) <= 12 && mz <= -18 && mz >= -40;
  }
  if (name === 'deck') {
    const dx = x - quayBoatX, dz = z - quayBoatZ;
    const cs = Math.cos(quayBoatYaw), sn = Math.sin(quayBoatYaw);
    const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
    return Math.abs(lx) < quayBOAT_HX && Math.abs(lz) < quayBOAT_HZ;
  }
  return false;
}

function quayUpdateWater(dt) {
  // dt, not a hardcoded 1/60. The ripple upload is throttled to 30 Hz, but the
  // THROTTLE has to be measured in real seconds or the harbour ripples at
  // whatever the display happens to run at — 2.4x too fast on a 144 Hz panel.
  quayRippleT += dt;
  if (quayRippleT < 0.0333) return;
  quayRippleT = 0;
  const a = quayWaterAttr.array;
  const t = quayTime;
  for (let i = 0; i < a.length; i += 3) {
    a[i + 1] = quayWATER_Y + Math.sin(a[i] * 0.035 + t * 0.75) * 0.16
                           + Math.sin(a[i + 2] * 0.052 - t * 0.58) * 0.13;
  }
  quayWaterAttr.needsUpdate = true;
}

// ============================================================== LIFECYCLE ====
export function createQuay(game) {
  quayGame = game;

  game.biome.register('quay', {
    ensureBuilt() { quayBuild(game); },
    onEnter() {
      // A fresh arrival is always a fresh departure: she is alongside, stopped,
      // and nobody is at the wheel.
      quayBoatX = quayBERTH.x; quayBoatZ = quayBERTH.z; quayBoatYaw = quayBERTH.yaw;
      quayBoatSpeed = 0; quayThrottle = 0; quayRudder = 0;
      quayHelmOn = false; quayHelmCool = 0.6;
      // ...and a fresh departure is a fresh PASSAGE. These flags used to survive
      // re-entry, so the second time you came back to the Quay — which the travel
      // chain lets you do, via Sydney and the ferry — the boat was alongside and
      // ready but the voyage was already spent: arrived() answered true before you
      // had cast off, so the arrival never re-armed, the bridge horn had no joke in
      // it, the regatta mask was -1, and the dolphins had already been earned and
      // would not come back. The CHECKLIST stays ticked (that is systems.js's
      // business); the STAGING has to replay or the return trip is scenery.
      quayVoyaged = false; quayCastOff = false; quayBridged = false; quayWalled = false;
      quayRunT = -1;

      quayRaceT = 0; quayRaceMask = 0; quayEscortT = 0; quayEscorted = false; quayArrivalT = 0;
      quayCallMask = 0;
      quayDolphinT = 0; quayDolphinOn = 0;
      quayBumpCool = 0;
      // THE STAGING HAS TO REPLAY, AND TWO SET PIECES WERE NOT REPLAYING.
      //
      // The comment above says exactly this and then re-armed only the voyage.
      // `quayChipsGone` and the Freshwater's timers were set at BUILD and never
      // again, so the second time you came to the Quay — which the departures
      // board lets you do from anywhere — the counter outside the chip shop was
      // invisible, the basket was gone, and the best twelve seconds in the
      // chapter (every gull in New South Wales, at once) could not happen.
      // The CHECKLIST stays ticked; the basket comes back.
      quayChipsGone = false;
      quayChipT = 0;
      if (quayChipGroup) quayChipGroup.visible = true;
      if (quayChipBits) {
        for (let i = 0; i < quayCHIP_N; i++) {
          quayChipBits.setMatrixAt(i, quayXform(0, -900, 0, 0, 0, 0, 0.001, 0.001, 0.001));
        }
        quayChipBits.instanceMatrix.needsUpdate = true;
      }
      // ...and the gulls go back on the buoys. quayBurstChips moves all
      // twenty-two of them to the chip shop and nothing has ever moved them
      // back, so a second visit began with the entire flock already circling
      // a basket that was not there.
      quayScatterGulls();
      // …and the ones that ride the transom go back to loitering over the berth.
      quayWGSpook = 0;
      if (quayWGData) {
        for (let i = 0; i < quayWG_N; i++) {
          const o = i * quayWG_STRIDE;
          quayWGData[o]     = quayBERTH.x + rand(-16, 16);
          quayWGData[o + 1] = quayWATER_Y + rand(5, 12);
          quayWGData[o + 2] = quayBERTH.z + rand(6, 26);
          quayWGData[o + 5] = 0;
        }
      }
      // ...and the salute itself re-arms with everything else. `quayBigSaluted`
      // was set once at build and never cleared, so the second visit's horn got
      // the reply and the wash but the Freshwater had already been "met" — the
      // one flag in the set that was still living in the old world.
      quayBigAnswerT = -1; quayBigWashT = -1; quayBigRoll = 0; quayBigSaluted = false;
      quayEngT = 0; quayEngRpm = 0; quayEngPuff = 0;
      quayBuoyHitCd = 0;
      for (let i = 0; i < quayBuoyDunk.length; i++) quayBuoyDunk[i] = 0;
      quayBigWave = 0; quayHornSteam = 0; quayBridgeFlush = 0; quayLineT = -1; quayOperaSeen = false;
      game.state.sailing = false;
      if (game.capy) game.capy.atHelm = false;
      if (quayBoatBody) {
        quayBoatBody.position.set(quayBoatX, quayWATER_Y + quayBOAT_DECK, quayBoatZ);
        quayBoatBody.quaternion.setFromEuler(0, quayBoatYaw, 0);
        quayBoatBody.velocity.setZero();
        quayBoatBody.previousPosition.copy(quayBoatBody.position);
        quayBoatBody.interpolatedPosition.copy(quayBoatBody.position);
        quayBoatBody.previousQuaternion.copy(quayBoatBody.quaternion);
        quayBoatBody.interpolatedQuaternion.copy(quayBoatBody.quaternion);
      }
    },
    onExit() {
      quayHelmOn = false;
      game.state.sailing = false;
      if (game.capy) game.capy.atHelm = false;
      if (quayBoatBody) quayBoatBody.velocity.setZero();
    },
  });

  const api = {
    built() { return quayBuilt; },
    /**
     * 0..1 — HOW HARD SHE IS DRIVING, for the event grade layer. Chapter 3 has
     * never had a row in it either (v25's finding C covered all three of
     * chapters 1-3), so nothing that happens on this harbour has ever moved
     * bloom, threshold or vignette.
     *
     * The signal is the boat's speed, because the white water she throws is the
     * brightest thing in the chapter and the only one that varies: the harbour
     * is a flat blue-grey and the wake is the exception. That makes this a row
     * about the marquee — `manly-voyage` is a passage, and a passage is speed —
     * without needing a flag that only the payout sets.
     */
    wake() {
      if (!quayHelmOn) return 0;
      const k = Math.min(1, Math.abs(quayBoatSpeed) / quayBOAT_VMAX);
      return k * k;
    },
    // ---- AND WHERE IT STOPS -----------------------------------------------
    // MEASURED, the same way Sydney's was: put the animal at z = 200 or at
    // x = 400 and it neither falls nor is put back — quayGroundY answers zero
    // for the whole plane, so it simply treads water outside the drawn sea for
    // ever. The sea MESH is x -420..460, z -760..120 and there is nothing
    // beyond it in any direction, so that rectangle is the world. The boat is
    // already clamped forty metres inside it (see quayStepBoat); this is for
    // the swimmer, who was not clamped at all.
    bounds() { return quayBOUNDS; },
    // capybara.js reads these two through whichever biome is live
    waterLevel: quayWATER_Y,
    isOverWater: quayIsOverWater,
    waterHeightAt: quaySurfaceY,
    inZone: quayInZone,
    // NOT A CONSTANT ZERO ANY MORE. Two things in this chapter are land that
    // is not at sea level, and isOverWater has always agreed they are land;
    // without this the capybara that swims out to Fort Denison stands two
    // metres inside it, which is where it stood for sixteen chapters.
    terrainHeight: quayGroundY,
    // Built from the static boxes themselves — see makeSolidIndex in shared.js.
    navBlocked(x, z, r) { return quaySolids.blocked(x, z, r, quayGroundY); },
    /**
     * WHAT WOULD STOP THE HULL AT THIS POINT, by name, or null. Harness only —
     * nothing in the game reads it, and quayShore does its own sweep because it
     * needs the push direction as well as the answer.
     *
     * It exists because the mooring fields grew hard circles in X8 and there
     * was no way to ask whether the FAIRWAY had changed width as a result. A
     * hull test that nothing can query is a hull test nobody can regress.
     */
    hardAt(x, z) {
      for (let i = 0; i < quayHARD.length; i++) {
        const o = quayHARD[i];
        const dx = x - o.x, dz = z - o.z;
        if (dx * dx + dz * dz < o.r * o.r) return o.name || 'hard';
      }
      return null;
    },
    SPAWN: { x: 4, y: 1.0, z: 26 },
    MANLY: quayMANLY,
    // The Bridge, as a fixture: the deck's centre, how far it reaches and how
    // high it sits. It was drawn from quayBRIDGE and never published, so the
    // one landmark this chapter is named after was invisible to anything that
    // wanted to ask where it is. Read-only — a caller that writes into it
    // moves the geometry's source of truth.
    bridge: quayBRIDGE,
    // ---- THE CHIP SHOP COUNTER, WHICH NOTHING COULD ASK FOR ---------------
    // Same defect the Bridge had two lines up. `manly-pine` fires inside
    // quayCHIP_R (2.1 m) of quayCHIPS, and the card's beacon for it was the
    // hand-written literal (118, -586) — 5.9 m away, on the far side of the
    // Corso from the counter and comfortably outside the trigger. Walking to
    // the arrow put you next to nothing. Published so the hint can point at
    // the thing rather than at a remembered guess about where it is.
    // In WORLD y — quayCHIPS.y is measured off the waterline, and a beacon
    // handed the raw number would float half a metre high.
    chips: { x: quayCHIPS.x, y: quayWATER_Y + quayCHIPS.y, z: quayCHIPS.z },
    chipsGone() { return quayChipsGone; },
    // The Freshwater. She MOVES — ask, never cache.
    freshwater() { return quayBigPos; },
    freshwaterRange: quayBigRange,
    boat: {
      position: new THREE.Vector3(quayBERTH.x, quayWATER_Y + quayBOAT_DECK, quayBERTH.z),
      helm: new THREE.Vector3(),
      get speed() { return quayBoatSpeed; },
      get heading() { return quayBoatYaw; },
      get rudder() { return quayRudder; },
      get atHelm() { return quayHelmOn; },
      get throttle() { return quayThrottle; },
      get maxSpeed() { return quayBOAT_VMAX; },
    },
    /** Fraction of the passage to Manly, 0..1 — systems.js opens the score on it. */
    voyageProgress() {
      const total = quayAPRON_Z - (quayMANLY.z + 12);
      return clamp((quayAPRON_Z - quayBoatZ) / total, 0, 1);
    },
    arrived() { return quayVoyaged; },
    /** W1, the Heads: how much ocean is under her, 0..1. */
    headsK() { return quayHeadsK; },
    /** The harness's window on the passage: put her somewhere. Test hook. */
    boatDebugTo(x, z) { quayBoatX = x; quayBoatZ = z; },
    /** THE HUMPBACK, for the harness (L5). */
    whaleAudit() { return { t: +quayWhaleT.toFixed(2), seen: quayWhaleSeen, y: quayWhaleGroup ? +quayWhaleGroup.position.y.toFixed(2) : null, visible: !!(quayWhaleGroup && quayWhaleGroup.visible), splashed: quayWhaleSplashed, helm: quayHelmOn, speed: +quayBoatSpeed.toFixed(2), heads: +quayHeadsK.toFixed(2) }; },
    /** ...and the helm, taken from outside (the harness). */
    helmDebug(on) { if (on && !quayHelmOn) quayTakeHelm(); else if (!on && quayHelmOn) quayLeaveHelm(); return quayHelmOn; },

    update(dt) {
      if (!quayBuilt) return;
      if (!game.biome.isActive('quay')) return;
      quayTime += dt;
      if (quayFar) quayFar.update(game, dt);
      quayUpdateWater(dt);
      quayStepBoat(game, dt);
      quayUpdateWake(dt);
      quayUpdateFleet();
      quayUpdateBigFerry(game, dt);
      quayUpdateBigWake(dt);
      quayUpdateGulls(dt);
      quayUpdateWakeGulls(game, dt);
      quayUpdateCockatoos(game, dt);
      quayUpdateSound(game, dt);
      quayUpdateEngine(game, dt);
      quayUpdateApronGulls(game, dt);
      quayUpdateBridgeGulls(dt);
      quayBuoyStrike(game, dt);
      quayUpdateBuoys();
      quayUpdateMoorings();
      quayUpdateSurf();
      quayUpdateCats(dt);
      quayUpdateSpray(dt);
      quayUpdateTraffic(game, dt);
      quayUpdateBerthed();
      quayUpdateCrowd(dt);
      quayUpdateLine(game, dt);
      quayUpdateDolphins(dt);
      quayUpdateChips(game, dt);
      api.boat.position.set(quayBoatX, quayWATER_Y + quayBOAT_DECK, quayBoatZ);
      quayHelmWorld(api.boat.helm);
      // the sun path follows the camera so it always lies between eye and sun
      quayUpdateGlitter(game);
      // THE MUSICIAN (L7, F2): the arcade busker already stood there — just
      // the tune, on his own mallet voice.
      if (!quayTuneMv && typeof game.sfxMover === 'function') {
        quayTuneMv = game.sfxMover('tune', { key: 'quay:musician', biome: 'quay' });
      }
      if (quayTuneMv && quayLocBusker) {
        quayTuneMv.at(quayLocBusker.x, quayLocBusker.y + 1.0, quayLocBusker.z);
      }
    },
  };
  // MERGE, DO NOT REPLACE. npc.js runs before this module and publishes its own
  // Circular Quay record on the same name — the dog, its lead, the busker, the
  // owner and the gull flock — and assigning over it deleted all five. The
  // visible cost was the 'dog-loose' beacon, whose where() asks game.quay
  // .onLead() and therefore resolved to null for ever, and the busker's beacon
  // quietly falling back to a fixed spot instead of following him about.
  const quayPrev = game.quay;
  if (quayPrev) for (const k in quayPrev) if (!(k in api)) api[k] = quayPrev[k];
  game.quay = api;

  return api;
}
