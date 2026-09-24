import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PALETTE, mat, rand, randInt, clamp, damp, dampAngle, lerp, grain, grainOwn, placeCue, swayMesh, makeMerger } from './shared.js';
import { farLayer, farMover, farBundle, farTone } from './far.js';

// ===========================================================================
// CHAPTER 15 — THE PANTANAL. WHERE YOU ARE, AS IT HAPPENS, FROM.
//
// Fourteen places and the animal has never once been anywhere it belongs. That
// is the joke the whole game is built on — a capybara in an opera house, a
// capybara in a souk, a capybara in a hot air balloon — and it is a joke that
// only works because there is somewhere it would NOT be a joke. This is that
// place, and the difference shows up in every line of the list:
//
//   nothing here is startled by you. nothing here chases you. nobody takes
//   your photograph. You are not the strangest thing in the frame; you are
//   about the fourth strangest, behind a bird the size of a person, a lizard
//   the length of a car and something with a tail like a broom.
//
//   THE ONE NEW MECHANIC: THE HERD.
//
// Fourteen chapters in which the world got out of the way, and one in which it
// falls in behind. Wheek near another capybara and it comes; wheek again and
// the next one comes. They string out behind you in a line — a real line, off
// a trail of where you have actually been, so it bends round a termite mound
// because YOU bent round it — and the marquee is not a stunt. It is being at
// the front of nine of your own kind going into a river at sundown.
//
// THE SHAPE OF THE CHAPTER IS A ROAD. The Transpantaneira is a hundred and
// forty-seven kilometres of dirt on an embankment with a hundred and twenty-two
// wooden bridges on it, and the real one is missing planks too:
//
//   z  90..40   THE FAZENDA. the only high ground, a corral, a mango tree.
//   z  40..-10  THE CAMPO. flooded grass, termite mounds, capybaras, and the
//               dead tree the jabiru nests in.
//   x -95..-15  THE BAIA, and the floating meadow across it. The mats hold a
//               capybara for about two and a half seconds each.
//   z -10..-30  THE BAD BRIDGE, and the palm the macaws are shouting in.
//   z -55..-80  THE RIVER. caimans asleep on the bank, otters that are not
//               asleep, a sandbar, and the crossing.
//   z -80..-110 THE LAST BRIDGE, which is the way out.
//
// Everything is prefixed `pan` (contract: the bundler flattens every module
// into one scope).
// ===========================================================================

// ---------------------------------------------------------------- geography --
const panSPAWN = { x: 0, y: 3.0, z: 62 };
const panWATER = 0.25;               // the flood, and it does not move

const panROAD_W = 3.4;               // half-width of the causeway
const panROAD_Y = 1.75;
function panRoadX(z) { return 2.6 * Math.sin(z * 0.012) + 1.2 * Math.sin(z * 0.031 + 0.7); }

// The bridges. Each is a length of the road that is timber rather than dirt;
// one of them is missing a plank, and that one is a task.
const panBRIDGES = [
  { z: 22, len: 9, gap: 0 },
  { z: -20, len: 11, gap: 1.25 },    // THE ONE. A hop, and only just.
  { z: -46, len: 9, gap: 0 },
  { z: -68, len: 15, gap: 0 },       // over the river
  { z: -96, len: 11, gap: 0 },       // the last one: the way out
];
const panLAST_BRIDGE = { z: -96 };

const panBAIA = { x: -55, z: 6, r: 40 };
const panRIVER = { z0: -80, z1: -56, bed: -4.2 };
let panRiverBed = null;              // M13
let panTuneMv = null;                 // (L7, F2) the viola caipira, on the porch
let panMarshBed = null;              // ...and the wetland itself, at the animal (L6, E3)
const panSANDBAR = { x: 34, z: -68, r: 13 };
const panFAZENDA = { x: 36, z: 76, r: 24 };
// the corral, in one place: panBuildFazenda draws it and panUpdateCattle has
// to keep the eleven inside it. Two copies of these three numbers is how a
// penned nelore ends up on the wrong side of its own fence.
const panPEN = { x: 36 - 22, z: 76, r: 13 };
const panNEST = { x: 50, z: 18 };            // the dead tree
const panPALM = { x: -19, z: -30 };          // the acuri, and the macaws in it
const panOTTERS = { x: -54, z: -66 };
const panCROSS = { x: -34, z0: -54, z1: -84 };  // where the herd goes over

// ------------------------------------------------------------------ state --
let panGame = null;
let panBuilt = false;
let panRoot = null;
let panFar = null;      // the tree line at 300 m and the ibis (far.js)
let panTime = 0;

// the herd
const panHERD_N = 9;
let panHerdMesh = null;
// One InstancedMesh per LEG PAIR  see THE LEGS COME OFF THE BODY.
let panHerdLegF = null, panHerdLegR = null;
// panHERD_LEG  the numbers the split needs. HIP is where the pairs pivot (the
// top of a 0.34 m leg whose foot is at 0.01 below the ground plane), FZ/RZ are
// where the two pairs sit fore and aft, and the two SWINGs are the amplitude
// at a graze and flat out. See THE GAIT.
const panHERD_HIP = 0.33;
const panHERD_FZ = 0.36;
const panHERD_RZ = -0.34;
const panHERD_SWING0 = 0.34;
const panHERD_SWING1 = 0.70;
const panHerd = [];                   // {x,z,yaw,st,order,ph,vy}
let panFollowing = 0, panBestString = 0;
let panHerdChat = 4;                  // the contact call a line of them keeps up
let panShakeT = 0;                    // s — every follower shaking off, on the far bank
// A TRAIL OF WHERE THE PLAYER HAS ACTUALLY BEEN. The line bends because you
// bent; a follower steering at the leader's CURRENT position cuts every corner
// and the herd walks through the termite mound you just went round.
const panTRAIL_N = 420;
const panTrailX = new Float32Array(panTRAIL_N);
const panTrailZ = new Float32Array(panTRAIL_N);
let panTrailHead = 0, panTrailCount = 0;
const panTRAIL_STEP = 0.35;           // metres between samples
const panFOLLOW_GAP = 2.6;            // metres of line per animal

// the floating meadow
const panMAT_N = 11;
// How far a mat may sink and still hold a capybara up. Past this it stops
// being ground and the animal is swimming — which is the entire mechanic, and
// the reason it is a NUMBER rather than a contact test is that isOverWater is
// a question about a POSITION and has no idea what is standing there.
const panMAT_SOLID = 0.14;
let panMatMesh = null;
const panMats = [];                   // {x,z,r,y,load,body,idx}
let panMatRun = 0, panMatLast = -1;

// the termite mounds, flat: x, z, r. Written by panBuildForest, read by the
// anteater — because an anteater walking PAST ninety termite mounds without
// once putting its nose in one is a two-metre animal doing a lap.
const panMoundAt = [];
// ...and the caranda palms, flat: x, z. The only vertical thing on open campo.
const panCaranda = [];

// the anteater
let panAnt = null, panAntBody = null;
// ---- THE TRUCK THE CHAPTER HAS BEEN TALKING ABOUT (Tier 2c) --------------
// Three people mention it -- the boss, the cattleman and the road crew all
// say the truck cannot get over the bad bridge -- and the road has worn tyre
// bands drawn down the middle of it. There was no truck. There was no vehicle
// of any kind in this chapter, and it is one of four chapters in the game
// with nothing on wheels or hooves moving anywhere in it.
//
// AND IT STOPS AT THE BRIDGE, which is the entire point of building it. It
// runs the causeway south, pulls up short of the missing plank at z -20,
// stands there with the engine going, gives up, and reverses all the way
// back north. Nothing scores it and nothing points at it; it is the
// "things that are simply there" rule -- a 70 s cycle so it is never the
// thing you are watching, only the thing that turns out to have been
// happening. What it buys is that the dialogue stops being a lie.
let panTruck = null, panTruckBody = null;
let panTruckT = 0;
const panTruckTarget = { x: 0, y: 0, z: 0 };
const panTruckPrev = { x: 0, y: 0, z: 0 };
const panTRUCK_Z0 = 92;        // the north end of the run
const panTRUCK_Z1 = -13.5;     // ...and short of panBRIDGES[1], the bad one at -20
const panTRUCK_V  = 6.0;       // m/s south, which is fast for a dirt causeway
const panTRUCK_VR = 3.6;       // ...and slower backwards, because it is reversing
const panTRUCK_WAIT = 11;      // s at the bridge, thinking about it
const panTRUCK_REST = 8;       // s at the top before it tries again
let panAntT = 0, panAntCarrying = false, panAntRide = 0;
let panAntDig = 0, panAntDigAt = -1, panAntDigCool = 8;
const panAntTarget = { x: 0, y: 0, z: 0 };
const panAntPrev = { x: 0, y: 0, z: 0 };
const panAntFrame = { x: 0, z: 0 };

// the cattle, which is why there is a corral and why there is a cowbird
const panCOW_N = 24;   // eleven in the pen and thirteen out on the campo
let panCattle = null;
const panCows = [];

// vitoria-regia. The pads never move; the flowers are a clock.
const panLILY_N = 84;
const panFLOWER_N = 9;
let panLilyMesh = null, panLilyFlower = null;
const panLilies = [];

// THE CAMALOTE ON THE RIVER, and the marquee is taken from the middle of it.
//
// Chapter 15's one big shot is the crossing: the lens at the waterline, in the
// stream, four of your own kind behind you. Photographed, the whole frame was
// one flat olive plane — the reeds gave the banks an edge but the WATER ITSELF
// had nothing on it at all, and a river with nothing on it has no speed, no
// scale and no direction. A Pantanal river in the wet always has hyacinth
// coming down it; the same plant the floating meadow in the baia is made of,
// in the pieces that broke off. Fifty-eight of them going past at a metre and
// a third a second, and a jam of them stacked up on the upstream side of the
// sandbar because that is where a drifting mat stops.
const panRAFT_N = 150;
const panRAFT_JAM = 44;               // ...of which this many are aground
let panRaftMesh = null;
const panRaftX = new Float32Array(panRAFT_N);
const panRaftZ = new Float32Array(panRAFT_N);
const panRaftS = new Float32Array(panRAFT_N);
const panRaftP = new Float32Array(panRAFT_N);
// ...on its own scratch, because `panFlow` is the object api.flow() hands out
// and a shared vector returned from an API is the trap this game has paid for
// twice already.
const panRaftFlow = { x: 0, z: 0 };

// the ripple pool: the flood is a MIRROR and for its whole life nothing had
// ever disturbed it
const panRIP_N = 34;
let panRipMesh = null, panRipMat = null;
const panRipX = new Float32Array(panRIP_N);
const panRipZ = new Float32Array(panRIP_N);
const panRipT = new Float32Array(panRIP_N);
const panRipS = new Float32Array(panRIP_N);
let panRipHead = 0, panRipCool = 0;

// the insects, which is what makes a wetland read as a wetland
const panBUG_N = 90;
let panBugs = null, panBugData = null;

// the egrets: the picture of the place, and they only ever fly at sundown
const panEGRET_N = 13;
let panEgrets = null;
let panEgretT = -1;
// ...and the birds that are STANDING, which is a different model. See panBuildEgrets.
let panEgretStand = null;
// ...and once the line has gone up it is gone. See panUpdateEgrets.
let panEgretGone = false;

// the caimans, the birds, the otters
let panCaimans = null;
const panCAIMAN_N = 14;
const panCaimanAt = [];
let panCaimanBody = null;
let panMacawFly = 0, panMacawHome = 1;
// the two returns off the gallery forest, on the frame clock
const panEchoT = [-1, -1];
let panJabiru = null, panJabT = 0, panJabState = 'nest';
// the bill-clatter and the macaw call, on countdowns rather than on modulo
// windows — see the notes at their call sites
let panJabNote = 0, panMacawNote = 0;
let panJabStep = 0, panJabTx = 0, panJabTz = 0;
const panJabFrom = { x: 0, z: 0, a: 0 };
// ---- THE WINDOW (L6, F2 / design 2.5) -------------------------------------
// The Pantanal had no event a player could be late for. The stork's circuit
// is one: twenty-four seconds on the ground, eight and a half round, and it
// lands on its own feet (panJabFrom). `jabiru-home` is being inside
// panJAB_HOME_R of that spot on the landing frame; the countdown is on the
// live line inside forty metres; `panJabWait` is how long you stood there
// first, which is the figure the record files (shared.js RECORDS, WINDOWS).
const panJAB_HOME_R = 8;
const panJAB_GROUND = 24, panJAB_FLIGHT = 8.5;       // the two halves of the circuit, as coded below
let panJabWait = 0, panJabHomeDone = false;
const panV3jab = new THREE.Vector3();               // jabiruHome()'s own scratch
let panMacaws = null, panMacawT = 0;
let panOtterMesh = null, panOtterT = 0, panOtterUp = 0;
// ...and the telling-off, which is a volley and not a metronome. See panUpdateOtters.
let panOtterArmed = false, panOtterVolley = 0, panOtterNext = 0, panToldOtter = false;
let panCowbird = null, panCowState = 'ground', panCowT = 0, panCowRide = 0;
// the bird's patrol up and down the back, and the peck. See panUpdateCowbird.
let panCowWalk = 0, panCowPeck = 0, panCowDip = 0;
// ...and which nelore it is sitting on, or -1. See panCowPerch.
let panCowOn = -1;
let panCowHome = { x: 12, z: 30 };

// the dusk, which the crossing switches on
let panDusk = 0, panDuskGo = false;
// ...and the one place it lands: the fazenda's windows. See panBuildFazenda.
let panFazWin = null, panFazWinMat = null, panFazLamp = null;
let panCrossT = 0, panCrossN = 0;
let panSeenHerd = false;
let panToldWheek = false, panToldMat = false, panToldCaiman = false;
let panCaimanSit = 0;
// which one you are on, and the beat before it opens an eye. See panUpdateTasks.
let panCaimanSat = -1, panCaimanNotice = 0;
// ---- THE ONE IN THE WATER (W1) ---------------------------------------------
// Fourteen jacarés and every one of them was scenery: they slide off the bank
// when the line goes past and lie on the bottom. A crossing needs something
// in the water that wants the last one in the line. Once per crossing, with
// the herd mid-river, the nearest jacaré comes off the bank and closes on the
// tail of the line at panBOSS_V[round] — eyes and back out, a V of ripples — and
// either takes the last follower off the line (a splash, and it is gone to
// graze on the far bank, your fault) or is turned by the voice: a wheek
// inside panHUNT_HEAR sends it under and it does not come back this tide.
// The same shape as the onça and the skua — the animal's voice spent on
// somebody else's behalf — in the one place the chapter is for.
const panHUNT_HEAR = 20;        // m: a wheek nearer than this turns it
const panHUNT_TAKE = 1.5;       // m from the last follower: it has it
// ---- ...AND IT IS O GRANDÃO NOW (X4): a mini-boss, in three rounds ---------
// The one in the water was a single beat: a wheek and it was gone. Now it is
// THE BIG ONE — drawn at twice the size of the fourteen on the banks — and it
// takes three. Each wheek inside panHUNT_HEAR sends it under; it comes back
// up a few seconds later from a different side, closer and quicker; the third
// sends it down for good, with a splash the whole line turns round for. If it
// reaches the tail it takes one and dives for a breath, and comes back for
// the next — so the cost of ignoring it is the line getting shorter, and the
// way to keep the line is the voice.
const panBOSS_LIVES = 3;
const panBOSS_SCALE = 2.0;
const panBOSS_UNDER = [3.2, 2.6, 0];     // s under after the 1st, 2nd hit
const panBOSS_BACK_R = [22, 16];         // m from the tail it comes back up
const panBOSS_V = [2.7, 3.3, 3.9];       // m/s in each round
const panBOSS_BREATH = 4.5;              // s under after a take
let panHuntI = -1, panHuntOn = false, panHuntDone = false, panHuntT = 0, panHuntRip = 0;
let panHuntTook = 0, panHuntSaved = 0;
// ---- THE LUNGE, AND THE LAST OF HIM (L5) -------------------------------------
// The best-blended marquee in the game and its two sharpest moments were a
// toast: O Grandão closing on the tail, and the third wheek that finishes
// him. THE LUNGE: inside panLUNGE_R of the last follower the world drops to
// 0.7x for half a second, once a round, with the jaws under the surface —
// the beat that says "now". THE LAST OF HIM: the third wheek holds the
// world at half speed, throws the river up where he goes under, and swings
// the lens to the line's flank so the whole herd and the thrash are in the
// one frame.
const panLUNGE_R = 7.5;
let panLungeRound = -1;
let panBossLives = panBOSS_LIVES, panBossRound = 0, panBossUnder = 0, panBossBeaten = false, panBossHits = 0;
/** The last capybara on the line, or null. */
function panLastFollower() {
  let best = null;
  for (let i = 0; i < panHERD_N; i++) {
    const r = panHerd[i];
    if (r.st !== 'follow') continue;
    if (!best || r.order > best.order) best = r;
  }
  return best;
}
function panHuntStart(game) {
  const tail = panLastFollower();
  if (!tail) return;
  // a LINE, in the river: the tail within thirty metres of the animal and wet
  const cp = game.capy && game.capy.body ? game.capy.body.position : null;
  if (!cp || Math.hypot(tail.x - cp.x, tail.z - cp.z) > 30 || tail.z > panRIVER.z1 + 1 || tail.z < panRIVER.z0 - 1) { panHuntDone = false; return; }
  let bi = -1, bd = 1e9;
  for (let i = 0; i < panCaimanAt.length; i++) {
    const c = panCaimanAt[i];
    if (c.slide > 0 || c.hunt || c.gone > 0) continue;
    const dx = c.x - tail.x, dz = c.z - tail.z;
    const d = dx * dx + dz * dz;
    if (d < bd && d < 60 * 60) { bd = d; bi = i; }
  }
  if (bi < 0) return;
  const c = panCaimanAt[bi];
  c.hunt = 1; c.hx = c.x; c.hz = c.z; c.hyaw = c.yaw0;
  panHuntI = bi; panHuntOn = true; panHuntT = 0; panLungeRound = -1;
  panBossLives = panBOSS_LIVES; panBossRound = 0; panBossUnder = 0; panBossBeaten = false; panBossHits = 0;
  panRipple(c.x, c.z, 2.6);
  panSfx.volume = 0.5; panSfx.pitch = 0.45;
  game.sfx('splash', placeCue(panSfx, c.x, panWATER, c.z, 80));
  if (typeof game.punch === 'function') game.punch(0.10);
  if (typeof game.toast === 'function') game.toast('O GRANDÃO. the big one is in the water behind the last of them. wheek at it — it takes three.');
}
function panHuntEnd(game, how) {
  const c = panHuntI >= 0 ? panCaimanAt[panHuntI] : null;
  panHuntOn = false; panBossUnder = 0;
  if (c) { c.hunt = 0; c.gone = how === 'beaten' ? 12.0 : 3.0; }   // under, then back on its bank
  if (how === 'took') panHuntTook++; else if (how === 'turned' || how === 'beaten') panHuntSaved++;
}
/** Where O Grandão comes back up: r metres from the tail, off to one side. */
function panBossResurface(game, r) {
  const c = panCaimanAt[panHuntI];
  const tail = panLastFollower();
  const cp = game.capy && game.capy.body ? game.capy.body.position : null;
  const ax = tail ? tail.x : (cp ? cp.x : c.x), az = tail ? tail.z : (cp ? cp.z : c.z);
  // upstream or down, whichever side it was not on; never on the banks
  const side = Math.random() < 0.5 ? -1 : 1;
  c.hx = clamp(ax + side * r, -120, 120);
  c.hz = clamp(az + rand(-4, 4), panRIVER.z0 + 3, panRIVER.z1 - 3);
  c.hunt = 1;
  panRipple(c.hx, c.hz, 2.6);
  panSfx.volume = 0.45; panSfx.pitch = 0.5;
  game.sfx('splash', placeCue(panSfx, c.hx, panWATER, c.hz, 80));
}
function panUpdateHunt(game, dt, p) {
  if (!panHuntOn) {
    // once per crossing, with the line in the water and past the near bank
    if (!panHuntDone && panCrossT > 2.5 && panFollowing >= 3 && p && p.z < panRIVER.z1 - 5 && p.z > panRIVER.z0 + 4) {
      panHuntDone = true;
      panHuntStart(game);
    }
    return;
  }
  const c = panCaimanAt[panHuntI];
  panHuntT += dt;
  const tail = panLastFollower();
  // ...and it does not follow the line up the bank: out of the water, out of reach
  if (!tail || panCrossT <= 0 || tail.z > panRIVER.z1 + 1 || tail.z < panRIVER.z0 - 1) { panHuntEnd(game, 'lost'); return; }
  const across = clamp((panRIVER.z1 - p.z) / (panRIVER.z1 - panRIVER.z0), 0, 1);
  let hearts = '';
  for (let i = 0; i < panBOSS_LIVES; i++) hearts += i < panBossLives ? '♥' : '♡';
  const wl = typeof game.wowLive === 'function' && !(typeof game.taskDone === 'function' && game.taskDone('the-crossing'));
  // ---- under, between rounds ------------------------------------------
  if (panBossUnder > 0) {
    panBossUnder -= dt;
    if (wl) game.wowLive('O GRANDÃO ' + hearts + ' · under · back in ' + Math.ceil(panBossUnder) + ' s', across);
    if (panBossUnder <= 0) panBossResurface(game, panBOSS_BACK_R[Math.min(panBossRound, panBOSS_BACK_R.length - 1)]);
    return;
  }
  const dx = tail.x - c.hx, dz = tail.z - c.hz;
  const d = Math.hypot(dx, dz) || 1;
  const step = Math.min(d, panBOSS_V[Math.min(panBossRound, panBOSS_V.length - 1)] * dt);
  c.hx += dx / d * step; c.hz += dz / d * step;
  c.hyaw = Math.atan2(dx, dz);
  panHuntRip -= dt;
  if (panHuntRip <= 0) { panHuntRip = 0.18; panRipple(c.hx, c.hz, 1.4); }
  if (wl) {
    game.wowLive('O GRANDÃO ' + hearts + ' · ' + Math.round(d) + ' m behind the last one · WHEEK at it', across);
  }
  // THE LUNGE (L5): once a round, the beat before the take
  if (d < panLUNGE_R && panLungeRound !== panBossRound) {
    panLungeRound = panBossRound;
    if (typeof game.slowmo === 'function') game.slowmo(0.7, 0.5);
    panSfx.volume = 0.5; panSfx.pitch = 0.42;
    game.sfx('thud', placeCue(panSfx, c.hx, panWATER, c.hz, 80));
    panRipple(c.hx, c.hz, 2.4);
    if (typeof game.punch === 'function') game.punch(0.06);
  }
  if (d < panHUNT_TAKE) {
    // it has the last one: off the line, a splash, and away to the far bank
    tail.st = 'graze'; tail.order = -1;
    tail.tx = tail.x; tail.tz = panRIVER.z0 - 8; tail.restT = rand(8, 12); tail.look = 1;
    panRipple(tail.x, tail.z, 2.2);
    panSfx.volume = 0.6; panSfx.pitch = 0.5;
    game.sfx('splash', placeCue(panSfx, tail.x, panWATER, tail.z, 80));
    if (typeof game.punch === 'function') game.punch(0.12);
    if (typeof game.toast === 'function') game.toast('it took the last one. it will be on the far bank, sulking — and the big one is coming back for the next.');
    panHuntTook++;
    // a breath, and it comes back for the next one: the line is the stake
    c.hunt = 0; panBossUnder = panBOSS_BREATH;
  }
}
/** A wheek near the hunter turns it. Called from panWheek. */
function panHuntHear(game, p) {
  if (!panHuntOn || !p || panBossUnder > 0) return false;
  const c = panCaimanAt[panHuntI];
  const dx = c.hx - p.x, dz = c.hz - p.z;
  if (dx * dx + dz * dz > panHUNT_HEAR * panHUNT_HEAR) return false;
  panBossLives--; panBossHits++;
  panRipple(c.hx, c.hz, 3.0);
  panSfx.volume = 0.5; panSfx.pitch = 0.5;
  game.sfx('splash', placeCue(panSfx, c.hx, panWATER, c.hz, 90));
  if (typeof game.punch === 'function') game.punch(0.08);
  if (panBossLives > 0) {
    // under, and back from the other side, quicker
    c.hunt = 0; panBossUnder = panBOSS_UNDER[Math.min(panBossRound, panBOSS_UNDER.length - 1)]; panBossRound++;
    if (typeof game.toast === 'function') game.toast(panBossLives === 2 ? 'it went under. that is one — it comes back.' : 'two. it is coming back quicker. once more.');
    return true;
  }
  // THE THIRD: gone for good, and the whole line turns round for it
  panBossBeaten = true;
  panRipple(c.hx, c.hz, 4.5);
  // ...AND IT IS SEEN (L5): the world held, the river thrown up, the lens on the flank
  if (typeof game.slowmo === 'function') game.slowmo(0.5, 1.4);
  if (typeof game.sparks === 'function') game.sparks(c.hx, panWATER + 0.3, c.hz, 50, { spd: 5.5, up: 3.5, grav: 9, drag: 0.6, life: 1.3, size: 0.32, rgb: [1.15, 1.35, 1.5] });
  if (typeof game.frameShot === 'function') {
    game.frameShot({ yaw: Math.atan2(p.x - c.hx, p.z - c.hz) + 0.5, dist: 15, pitch: 7 * Math.PI / 180, raise: 1.2, hold: 2.6 });
  }
  panSfx.volume = 0.7; panSfx.pitch = 0.42;
  game.sfx('splash', placeCue(panSfx, c.hx, panWATER, c.hz, 120));
  game.sfx('whistle', { volume: 0.3, pitch: 1.3, force: true });
  for (let i = 0; i < panHERD_N; i++) if (panHerd[i].st === 'follow') panHerd[i].look = 1;
  if (typeof game.confetti === 'function') game.confetti(p.x, p.y + 0.6, p.z, 16);
  if (typeof game.punch === 'function') game.punch(0.16);
  if (game.music && typeof game.music.swell === 'function') game.music.swell(1.0);
  if (typeof game.toast === 'function') game.toast('O GRANDÃO is gone. the river is yours — get them across.');
  panHuntEnd(game, 'beaten');
  return true;
}

// scratch
const panV3 = new THREE.Vector3();
const panV3b = new THREE.Vector3();
const panQ = new THREE.Quaternion();
const panE = new THREE.Euler();
const panSc = new THREE.Vector3();
const panM = new THREE.Matrix4();
// A second matrix, for a thing hung off the first one: the leg pairs are the
// bodys transform times an offset-and-swing of their own.
const panM2 = new THREE.Matrix4();
const panLegV = new THREE.Vector3();
const panOne = new THREE.Vector3(1, 1, 1);
const panCol = new THREE.Color();
const panCol2 = new THREE.Color();
const panSfx = { volume: 1, pitch: 1 };
const panPt = { x: 0, z: 0 };
const panPt2 = { x: 0, z: 0 };   // the trail reader, so it cannot alias the route

function panXform(x, y, z, rx, ry, rz, sx, sy, sz) {
  panV3.set(x, y, z);
  panE.set(rx, ry, rz);
  panQ.setFromEuler(panE);
  panSc.set(sx, sy, sz);
  panM.compose(panV3, panQ, panSc);
  return panM;
}

const panG = { box: null, cyl6: null, cyl8: null, cyl4: null, cone6: null, cone8: null,
               sph6: null, sph8: null, quad: null };
function panInitGeos() {
  if (panG.box) return;
  panG.box = new THREE.BoxGeometry(1, 1, 1);
  // A BLADE OF GRASS IS TWO TRIANGLES, NOT TWELVE. The note on panBuildGrass
  // already worked out that "a blade is a box whose two narrow faces nobody
  // can see" and then went on drawing the box: at 0.04 by 0.16 in section,
  // four of the six faces of every blade in this chapter were four
  // centimetres wide and edge-on from every camera the game has. A quad with
  // the material on both sides is the same picture for a sixth of the
  // triangles, and the sixth that is left is what buys the density back.
  panG.quad = new THREE.PlaneGeometry(1, 1);
  panG.cyl6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
  panG.cyl8 = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
  panG.cyl4 = new THREE.CylinderGeometry(0.5, 0.5, 1, 4);
  panG.cone6 = new THREE.ConeGeometry(0.5, 1, 6);
  panG.cone8 = new THREE.ConeGeometry(0.5, 1, 8);
  panG.sph6 = new THREE.SphereGeometry(0.5, 6, 4);
  panG.sph8 = new THREE.SphereGeometry(0.5, 8, 6);
}

/** CONTRACT: box() takes FULL extents, CANNON.Box takes HALF; panStaticBox
 *  speaks this one so the drawn thing and the solid thing cannot differ by 2x. */
function panMerger() {
  const M = makeMerger(panG, {
    xform: panXform, cylSegs: [4, 8], coneSegs: [8], sphSegs: [8], normals: 'recompute', jitter: 0.050,
  });
  /** A flat quad standing upright, w wide and h tall, centred on (cx,cy,cz).
   *  Only ever useful on a DoubleSide material — see panVCL.
   *  This stays here rather than moving into makeMerger because panG.quad is
   *  the ONE quad in the game that is NOT rotated flat: the other five are
   *  ground decals and this one is a standing sheet. Same name, different
   *  geometry, and sharing it would have laid this chapter's quads down. */
  M.quad = function (cx, cy, cz, w, h, color, rx, ry, rz) {
    return M.add(panG.quad, panXform(cx, cy, cz, rx || 0, ry || 0, rz || 0, w, h, 1), color);
  };
  return M;
}
// THE ROUNDED ANIMAL (AAA pass). A merger that draws every call twice, the
// second time with makeMerger's `round` on, and hangs the second geometry on
// the first as `roundTwin`; panRoundOn hands it to the rounded person's switch
// (npc.js, game.personRound), so a caiman is the same animal with its edges
// off, on the same flag and the same rung. Boxes under 4.5 cm (wings, bills,
// feet on a bird) come out as they went in.
function panTwin(rf) {
  const A = panMerger(), B = panMerger(), T = {};
  B.round = rf || 0.4;
  for (const k in A) {
    if (typeof A[k] !== 'function' || k === 'build') continue;
    T[k] = function () { const r = A[k].apply(A, arguments); B[k].apply(B, arguments); return r === A ? T : r; };
  }
  T.build = function () { const g = A.build(); g.userData.roundTwin = B.build(); return g; };
  return T;
}
function panRoundOn(m, twin) {
  const tw = twin || (m && m.geometry.userData.roundTwin);
  if (m && tw && panGame && panGame.personRound) { panGame.personRound(m, tw); m.userData.roundAnimal = true; }
  return m;
}

function panVC() {
  return grain(mat(0xffffff, { vertexColors: true }),
               { scale: 0.5, amount: 0.09, warp: 0.5, near: 0.32, nearScale: 8, contact: 1 });
}
function panVCG() {
  return grain(mat(0xffffff, { vertexColors: true }),
               { scale: 0.42, amount: 0.19, warp: 0, near: 0.75, nearScale: 9, contact: 1, broad: 0.12, broadM: 20,
                 // THE DAPPLE (ROADMAP-WOW G2): light through the canopies on the
                 // ground under them. The gallery forest itself is rand()-placed
                 // at build and cannot be named; what CAN be is the mango tree
                 // (the one tree everything on the farm sits under) and the
                 // capoes, which are fixed woods with a centre and a radius —
                 // trees to 0.75 r, crowns ~3 m past. Seven nearest the spawn.
                 dapple: { cells: panDAPPLE, k: 0.33, scale: 3.2 } });
}
/** THE LEAF MATERIAL: the same grain, seen from both sides. Everything built
 *  out of `M.quad` needs this and nothing else may use it, or half the
 *  chapter starts drawing its own back faces for nothing. */
function panVCL() {
  return grain(mat(0xffffff, { vertexColors: true, side: THREE.DoubleSide }),
               { scale: 0.5, amount: 0.09, warp: 0.5 });
}
/**
 * THE FLOOD, AND IT IS A MIRROR.
 *
 * Every other water in this game is something to be in. This one is mostly two
 * inches deep over grass, so what it DOES is throw the sky back at you across
 * half the map — which is the single most recognisable thing about the place
 * and is entirely a lighting effect. Lambert has no specular term, so it is
 * the sparkle helper doing it, turned right down in amount and right up in
 * patch size: not glitter, a SHEEN.
 */
function panVCW(own) {
  // AND THE SCALE OF THE SPARKLE IS THE WHOLE DIFFERENCE BETWEEN A SHEEN AND A
  // MESS. At 0.34 a noise cell is three metres across, so every "speck" was a
  // three-metre white blob and the river came out looking like a car park after
  // a hailstorm. Small cells, a narrow band and a slow drift is a sheen.
  // AND THE PHOTOGRAPH FROM WATER LEVEL IS THE ONE THAT JUDGES IT. Everything
  // above was tuned from the standing camera, six metres up and looking down;
  // the crossing is taken SWIMMING, with the rig at the waterline, and from
  // there a 1.6-scale sparkle cell subtends fifteen degrees. Measured from the
  // middle of the river: a screen of white splotches like a hailstorm, over
  // three-quarters of the frame, in the one shot the chapter is built around.
  // Smaller cells, a much narrower band and a higher cut is the same sheen in
  // four times as many pieces, which from six metres up is glitter and from
  // the waterline is a shine.
  // ...AND THE SHEET NEEDS ITS OWN COPY, because panUpdateWater writes `.color`
  // on it every frame for the sundown and mat() caches by colour+options — see
  // grainOwn in shared.js, and the five seas that lost their glitter to a
  // clone applied one step too late.
  const base = mat(0xffffff, { vertexColors: true, transparent: true, opacity: 1, depthWrite: false });
  // ...AND THE MIRROR ITSELF (ROADMAP-WOW A1). The header above says what
  // the flood IS, and until now the sheen and the Fresnel were standing in
  // for it. The gallery trees, the jabiru and the fireflies at dusk are
  // doubled by the planar pass; the sheet's vertex alpha still fades it to
  // nothing at the shore (grain() scales the alpha push by it).
  const o = { scale: 0.35, amount: 0.05, warp: 0,
              sparkle: 0.17, sparkleScale: 3.1, sparkleSpeed: 0.16, fresnel: 0.65,
              sparkleCut: 0.76, sparkleBand: 0.055, sparkleColor: 0xfff0d4,
              reflect: { k: 1.0, pow: 1.0, wobble: 1.0, blur: 0 } };
  return own ? grainOwn(base, o) : grain(base, o);
}

function panSyncBody(b) {
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
  b.previousQuaternion.copy(b.quaternion);
  b.interpolatedQuaternion.copy(b.quaternion);
}
function panStaticBox(game, x, y, z, sx, sy, sz, ry) {
  const b = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
  b.addShape(new CANNON.Box(new CANNON.Vec3(sx * 0.5, sy * 0.5, sz * 0.5)));
  b.position.set(x, y, z);
  if (ry) b.quaternion.setFromEuler(0, ry, 0);
  panSyncBody(b);
  game.world.addBody(b);
  return b;
}
/**
 * ONE COMPOUND BODY PER CLUSTER.
 *
 * Ninety termite mounds, a hundred and forty trees and a corral fence is three
 * hundred broadphase entries done naively, and this chapter was already at
 * seventy bodies. A mound is 1 to 3 m across and 1 to 3 m tall — which is
 * exactly the size of thing that is too tall to step over (the animal manages
 * 0.4) and too small to read as a wall, and therefore exactly the size of
 * thing that looks like a BUG when you walk through it. See the furniture note
 * in the second-pass memory: the residue is always the middle-sized things.
 */
function panPoolBody(game) {
  const b = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC,
                              material: (game.mats && game.mats.ground) || undefined });
  b.allowSleep = true;
  return b;
}
function panPoolBox(b, x, y, z, hx, hy, hz, ry) {
  const q = new CANNON.Quaternion();
  if (ry) q.setFromEuler(0, ry, 0);
  b.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)), new CANNON.Vec3(x, y, z), q);
  return b;
}
function panPoolDone(game, b) {
  if (!b.shapes.length) return null;
  panSyncBody(b);
  game.world.addBody(b);
  return b;
}
function panSmooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

// ================================================================= TERRAIN ==
/**
 * THE BED. The road is NOT in here and that is deliberate.
 *
 * A CANNON heightfield sampled at four metres cannot hold a metre-and-a-quarter
 * hole in a seven-metre causeway — it would interpolate the gap away and leave
 * an invisible floor across the one task in the chapter that is a jump. So the
 * heightfield answers for the ground and the causeway is a row of static boxes
 * on top of it, exactly the way Palawan's karst and Hong Kong's tong lau are.
 * `panTerrain` then reports whichever is higher, which is what everything else
 * in the game means by "the ground".
 */
function panBedH(x, z) {
  // the campo: a mosaic, and the whole look of the place is that about a third
  // of it is under two inches of water and the rest is not
  let h = 0.42
        + 0.42 * Math.sin(x * 0.026) * Math.cos(z * 0.021)
        + 0.22 * Math.sin((x * 0.7 + z) * 0.014 + 1.1)
        + 0.10 * Math.sin(x * 0.09 + z * 0.07);
  // corixos — the shallow channels that drain it, and they are where the fish
  // and therefore everything else is
  const c1 = Math.abs(Math.sin((x + z * 0.6) * 0.021 + 0.4));
  h -= 0.55 * Math.exp(-c1 * c1 * 26);
  // the baia
  {
    const dx = x - panBAIA.x, dz = z - panBAIA.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < panBAIA.r + 8) {
      const k = panSmooth((panBAIA.r + 8 - d) / 16);
      h = lerp(h, -2.3, k);
    }
  }
  // the river
  {
    const cz = (panRIVER.z0 + panRIVER.z1) * 0.5;
    const half = (panRIVER.z1 - panRIVER.z0) * 0.5;
    const t = Math.abs(z - cz) / half;
    if (t < 1.6) {
      const k = panSmooth((1.6 - t) / 0.9);
      h = lerp(h, panRIVER.bed, k);
    }
    // ---- AND THE SANDBAR, WHICH IS WHERE EVERYTHING SLEEPS --------------
    // IT IS A PLATEAU, NOT A DOME. `lerp(0.75, bed, smooth(sd / r))` from the
    // middle out means the bar is above the waterline only where
    // smooth(sd/r) < 0.75/4.95 — that is sd < 3.3 m of a THIRTEEN metre
    // feature. The sand COLOUR is painted over the whole ellipse (that test
    // is on sd alone, not on height), so what the chapter drew was a
    // twenty-six metre beach of which twenty-two metres was under water, and
    // the eight jacarés hauled out on it were floating flat on the surface in
    // a heap in the middle. A river bar in the dry is a flat-topped bank with
    // a steep face: the top half of the radius is a plateau, and the drop is
    // in the outer 45 %.
    const sdx = x - panSANDBAR.x, sdz = z - panSANDBAR.z;
    const sd = Math.sqrt(sdx * sdx + sdz * sdz * 2.2);
    if (sd < panSANDBAR.r) {
      const u = clamp((sd / panSANDBAR.r - 0.55) / 0.45, 0, 1);
      h = Math.max(h, lerp(0.95, panRIVER.bed, panSmooth(u)));
    }
  }
  // the fazenda — the only real high ground for eighty kilometres, which is
  // why there is a house on it
  {
    const dx = x - panFAZENDA.x, dz = z - panFAZENDA.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < panFAZENDA.r) h = Math.max(h, lerp(3.1, 0.5, panSmooth(d / panFAZENDA.r)));
  }
  // the capoes: little wooded islands, and there are hundreds of them
  for (let i = 0; i < panCAPOES.length; i++) {
    const c = panCAPOES[i];
    const dx = x - c.x, dz = z - c.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < c.r * c.r) h = Math.max(h, lerp(c.h, 0.35, panSmooth(Math.sqrt(d2) / c.r)));
  }
  return h;
}
const panCAPOES = [
  { x: 24, z: 40, r: 13, h: 1.9 }, { x: -22, z: 44, r: 10, h: 1.6 },
  { x: 48, z: -6, r: 15, h: 2.1 }, { x: -12, z: -6, r: 9, h: 1.5 },
  { x: 26, z: -34, r: 12, h: 1.8 }, { x: -46, z: -40, r: 11, h: 1.7 },
  { x: 62, z: 44, r: 12, h: 1.8 }, { x: -70, z: -22, r: 10, h: 1.6 },
  { x: 14, z: 8, r: 8, h: 1.4 },   { x: -30, z: 20, r: 9, h: 1.5 },
];
// THE DAPPLED CANOPIES (ROADMAP-WOW G2): grain() bakes at most eight circles
// into the ground's fragment source. The mango tree at the fazenda (its five
// crown blobs reach ~6.5 m from the trunk — see panBuildFazenda) and the seven
// capoes nearest the spawn at (0, 62), at the wood's own footprint: trees to
// 0.75 r and a crown about three metres past the outermost trunk.
const panDAPPLE = [{ x: panFAZENDA.x + 16, z: panFAZENDA.z + 6, r: 6.5 }]
  .concat([0, 1, 9, 8, 6, 3, 2].map(i => ({ x: panCAPOES[i].x, z: panCAPOES[i].z, r: panCAPOES[i].r * 0.75 + 3 })));

/** Is (x, z) on the causeway at all, and is it over the missing plank? */
function panOnRoad(x, z) {
  if (z > 96 || z < -112) return 0;
  const dx = Math.abs(x - panRoadX(z));
  if (dx > panROAD_W + 0.6) return 0;
  for (let i = 0; i < panBRIDGES.length; i++) {
    const b = panBRIDGES[i];
    if (b.gap > 0 && Math.abs(z - b.z) < b.gap * 0.5) return 0;   // the hole
  }
  return dx < panROAD_W ? 1 : panSmooth((panROAD_W + 0.6 - dx) / 0.6);
}

/**
 * WHICH FLOATING MAT IS AT (x, z), IF ANY. Called from panTerrain, so it is
 * called a great many times a frame and is deliberately eleven distance tests
 * and nothing else.
 */
function panMatAtXZ(x, z) {
  for (let i = 0; i < panMats.length; i++) {
    const m = panMats[i];
    const dx = x - m.x, dz = z - m.z;
    if (dx * dx + dz * dz < m.r * m.r) return m;
  }
  return null;
}

/**
 * THE TOP OF WHATEVER JACARE YOU ARE OVER, or -1e9.
 *
 * THIS IS THE CHAPTER'S OWN LESSON, APPLIED TO THE OTHER THING YOU STAND ON.
 * The floating mats are reported here because capybara.js decides whether the
 * animal is swimming from `isOverWater` and `isOverWater` reads `terrainHeight`
 * — and exactly the same is true of a three-and-a-half-metre reptile lying in
 * eight inches of water. Measured: dropped onto one of the shallow-water
 * jacares the animal was told it was IN the water on the frame it landed, and
 * 'sit on a sleeping jacare' could not be completed on any of the six that are
 * not on the sandbar.
 *
 * It is called from panTerrain, which is called from everywhere, so it is one
 * bounding-box reject in front of at most eight distance tests. The two groups
 * live in two small boxes and the reject throws out the whole rest of the map.
 */
const panCaimanBB = { x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9 };
function panCaimanTop(x, z) {
  if (x < panCaimanBB.x0 || x > panCaimanBB.x1 || z < panCaimanBB.z0 || z > panCaimanBB.z1) return -1e9;
  for (let i = 0; i < panCaimanAt.length; i++) {
    const c = panCaimanAt[i];
    if (c.slide > 0) continue;                 // it is in the water; it is not a floor
    const dx = x - c.x, dz = z - c.z;
    const cs = Math.cos(c.yaw0), sn = Math.sin(c.yaw0);
    const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
    // the SOLID part is a little inside the drawn outline, the same handful of
    // centimetres of slack the mats and the Antarctic floes both use
    if (Math.abs(lx) < 0.52 && Math.abs(lz) < 1.52) return c.y + 0.32;
  }
  return -1e9;
}

function panTerrain(x, z) {
  const bed = panBedH(x, z);
  const jac = panCaimanTop(x, z);
  if (jac > -1e8) return Math.max(bed, jac);
  // A MAT THAT IS STILL FLOATING IS GROUND, and it has to be ground HERE
  // rather than merely being a collider, because capybara.js decides whether
  // the animal is swimming from `isOverWater` and `isOverWater` reads this. A
  // capybara standing on a raft over two metres of water was being told it was
  // in the water — measured, and it is why the first build of the crossing
  // could not be completed at all.
  const m = panMatAtXZ(x, z);
  if (m && m.y > panWATER - panMAT_SOLID) return Math.max(bed, m.y + 0.25);
  const r = panOnRoad(x, z);
  if (r <= 0) return bed;
  return Math.max(bed, lerp(bed, panROAD_Y, r));
}

/**
 * WHERE A PERSON CAN STAND — the STATIC ground, and the difference matters.
 *
 * panTerrain answers "what would the capybara stand on here", which includes
 * the floating meadow mats and a sleeping caiman. Both move. Anything placed
 * once, at build time, against panTerrain is therefore placed against wherever
 * a raft happened to be drifting on that frame — see the note at put() in the
 * locals block, and the six-of-seven it was quietly costing.
 */
function panStandH(x, z) {
  const bed = panBedH(x, z);
  const r = panOnRoad(x, z);
  return r > 0 ? Math.max(bed, lerp(bed, panROAD_Y, r)) : bed;
}

function panSlope(x, z) {
  const e = 1.4;
  const hx = panTerrain(x + e, z) - panTerrain(x - e, z);
  const hz = panTerrain(x, z + e) - panTerrain(x, z - e);
  return Math.sqrt(hx * hx + hz * hz) / (2 * e);
}

/**
 * THE 22 CM OF SLACK IS DOING REAL WORK HERE.
 *
 * The whole argument for this chapter's ground is that a third of it is under
 * two inches of water, and two inches of water is a thing you walk through.
 * `isOverWater` switches OFF capybara.js's analytic floor backstop, so if this
 * answered true wherever the flood is drawn, the animal would be swimming
 * across half the map at 2.6 m/s. It is true only where the water is properly
 * deep — the corixos, the baia and the river — which is the same rule Venice
 * uses to keep a flooded piazza walkable.
 */
function panIsOverWater(x, z) { return panWATER > panTerrain(x, z) + 0.22; }
function panWaterHeightAt() { return panWATER; }

/** The river is going somewhere. Gently: this is not the Uji. */
const panFlow = { x: 0, z: 0 };
function panFlowAt(x, z, out) {
  out.x = 0; out.z = 0;
  const cz = (panRIVER.z0 + panRIVER.z1) * 0.5;
  const half = (panRIVER.z1 - panRIVER.z0) * 0.5;
  const t = Math.abs(z - cz) / half;
  if (t < 1.0) out.x = 1.35 * panSmooth((1.0 - t) / 0.6);
  return out;
}

function panInZone(name, x, z) {
  switch (name) {
    case 'road':     return panOnRoad(x, z) > 0.2;
    case 'fazenda': {
      const dx = x - panFAZENDA.x, dz = z - panFAZENDA.z;
      return dx * dx + dz * dz < panFAZENDA.r * panFAZENDA.r;
    }
    case 'baia': {
      const dx = x - panBAIA.x, dz = z - panBAIA.z;
      return dx * dx + dz * dz < panBAIA.r * panBAIA.r;
    }
    case 'river':    return z > panRIVER.z0 - 4 && z < panRIVER.z1 + 4;
    case 'sandbar': {
      const dx = x - panSANDBAR.x, dz = z - panSANDBAR.z;
      return dx * dx + dz * dz * 2.2 < panSANDBAR.r * panSANDBAR.r;
    }
    case 'otters':   return Math.abs(x - panOTTERS.x) < 16 && Math.abs(z - panOTTERS.z) < 12;
    case 'crossing': return Math.abs(x - panCROSS.x) < 20 && z < -50 && z > -88;
    case 'lastbridge': return Math.abs(z - panLAST_BRIDGE.z) < 7 && Math.abs(x - panRoadX(panLAST_BRIDGE.z)) < 5;
    case 'campo':    return !panInZone('baia', x, z) && !panInZone('river', x, z);
    default: return false;
  }
}
function panNavBlocked(x, z, r) { return panTerrain(x, z) < panWATER - 0.1; }
/** < 0.9 soft, ~1.0 stone, > 1.15 hollow timber. */
// The material beside the pitch (L4, audio #4): the last answer, read through
// surfaceMat() straight after surfacePitch(). Everything soft here is grass
// but the sandbar, which is the one bright ground in the chapter.
let panSurfMat = 'grass';
function panSurf(p, m) { panSurfMat = m; return p; }
function panSurfacePitch(x, z, y) {
  for (let i = 0; i < panBRIDGES.length; i++) {
    const b = panBRIDGES[i];
    if (Math.abs(z - b.z) < b.len * 0.5 && panOnRoad(x, z) > 0.2) return panSurf(1.24, 'timber');
  }
  if (panOnRoad(x, z) > 0.2) return panSurf(0.94, 'grass');      // packed dirt
  if (panAntCarrying) return panSurf(0.78, 'grass');
  // ---- ...AND THREE OF THE CHAPTER'S OWN NAMED GROUNDS FELL THROUGH -------
  // A surface ladder must ask the chapter where things are (v25, the Quay) and
  // this one asked about two of six. Measured with api.surfacePitch: the
  // SANDBAR — which is the ground the caiman-nap task happens on, and the only
  // bright thing in the chapter from a hundred metres — read 0.68 wet grass,
  // as did the CAMALOTE MATS, which are the ground the camalote task happens
  // on, and the FAZENDA YARD, which is swept dirt with three people standing
  // on it. Every one of those already has a test written for something else.
  if (panInZone('sandbar', x, z)) return panSurf(1.05, 'sand');    // dry river sand
  if (panMatAtXZ(x, z)) return panSurf(0.60, 'grass');             // a raft of vegetation, over water
  if (panInZone('fazenda', x, z)) return panSurf(0.90, 'grass');   // swept, packed, walked on daily
  return panSurf(0.68, 'grass');                                   // wet grass, which eats a footfall
}

// ================================================================== BUILDING ==
function panBuild(game) {
  if (panBuilt) return;
  panBuilt = true;
  panInitGeos();

  panRoot = new THREE.Group();
  panRoot.name = 'pantanal';
  game.scene.add(panRoot);

  panBuildGround(game, panRoot);
  panBuildCollision(game);
  panBuildRoad(game, panRoot);
  panBuildFazenda(game, panRoot);
  panBuildForest(game, panRoot);
  panBuildScrub(panRoot);
  panBuildGrass(panRoot);
  panBuildNest(game, panRoot);
  panBuildPalm(game, panRoot);
  panBuildCattle(panRoot);
  panBuildMats(game, panRoot);
  panBuildRafts(panRoot);
  panBuildHerd(panRoot);
  panBuildCaimans(game, panRoot);
  panBuildOtters(panRoot);
  // Tier 5: the onca. AFTER the otters, because she is what they shout at.
  panBuildJaguar(game, panRoot);
  panBuildJabiru(panRoot);
  panBuildMacaws(panRoot);
  panBuildCowbird(panRoot);
  panBuildAnteater(game, panRoot);
  panBuildTruck(game, panRoot);
  panBuildBugs(panRoot);
  panBuildEgrets(panRoot);
  panBuildCrossing(game, panRoot);
  panBuildFar(panRoot);
  panBuildWater(panRoot);          // last: transparent, sorts over
  panBuildLilies(panRoot);         // ...and these sit ON it
  panBuildRipples(panRoot);

  // ---- THE PEOPLE WHO LIVE HERE ------------------------------------------
  // See npc.js, THE LOCALS. Each of these is a point somebody is standing at,
  // a few things they might say when the capybara turns up, and a different
  // few for when it wheeks at them. Where the chapter owns a Group for the
  // figure, it is handed over too and the figure turns to watch.
  // SEVEN, NOT TWO. Two people on a two-hundred-metre road through the largest
  // ranch country in South America is not a place, it is a diorama — and the
  // comparable chapters (Venice 8, Rio 8, Kowloon 9, Palawan 7) had all been
  // brought up to this standard already. Every anchor is PROBED against the
  // live terrain rather than guessed, because two of the game's locals once
  // shipped standing on a riverbed.
  if (typeof game.addLocal === 'function') {
    // ---- AND THE RECORD COMES BACK, BECAUSE IT HAS TO ---------------------
    // put() threw away everything addLocal handed it, so not one of these
    // seven people could ever be told anything. npc.js reads `lines` LIVE —
    // that is the entire mechanism by which a chapter's cast can know what the
    // player has done — and Cappadocia has used it since it shipped. Here the
    // cattleman said the same four sentences whether the capybara had walked
    // past him or had just taken nine of his neighbours across the river at
    // sundown, which is the thing the whole chapter exists for.
    // ---- AND IT MUST NOT ASK panTerrain (R10) -----------------------------
    // panTerrain answers "what would the capybara stand on here", and that
    // includes the floating meadow mats and a sleeping caiman, both of which
    // MOVE. So whether a local was placed at all depended on where a mat
    // happened to be drifting on the frame the chapter was built — which is
    // why this warning is intermittent, and why every previous soak reported a
    // clean console while the chapter was shipping six people instead of seven.
    //
    // A person stands on GROUND: the bed, or the road laid over it. Not on a
    // raft, and not on a caiman.
    const standH = function (x, z) {
      const bed = panBedH(x, z);
      const r = panOnRoad(x, z);
      return r > 0 ? Math.max(bed, lerp(bed, panROAD_Y, r)) : bed;
    };
    const put = function (key, x, z, o) {
      const h = panStandH(x, z);
      if (h < panWATER + 0.05) {
        console.warn('[pantanal] local at', x, z, 'is in the water (' + h.toFixed(2) + ') - skipped');
        return null;
      }
      o.biome = 'pantanal'; o.x = x; o.z = z; o.y = h;
      if (o.near === undefined) o.near = 9;
      const r = game.addLocal(o);
      if (r) panLocals[key] = r;
      return r;
    };
    put('boss', panFAZENDA.x - 6, panFAZENDA.z, {
      face: 3.0,
      // THE AUTHORITY (L3, F1): it is his fazenda, so he is the one who
      // carries a nuisance off it. put() hands the row straight to addLocal.
      authority: true, role: 'the fazendeiro',
      figure: { shirt: PALETTE.cloth6, hat: PALETTE.khaki, skin: PALETTE.skin3 },
      // ---- AND WHAT THEY SAY MOVES WITH THE CHAPTER (see localResolve in
      // npc.js). The note above is about the RECORD being kept; this is the
      // other half of the same argument, and the Pantanal used it nowhere. A
      // `before:` line is what a stranger is told and an `after:` line is what
      // only somebody who was there can be told.
      lines: [
              // ---- THEY HAVE HEARD ABOUT YOU (L3, E3): one line keyed on a wow elsewhere
              { t: 'Rode a wave at Manly, I heard. My river does not have waves. It has teeth.', after: 'all-the-way' },
              'Road floods in March. Road floods in April. Road floods.',
              { t: 'Do not take the second bridge. Take the third.', before: 'missing-plank' },
              { t: 'You are not the strangest thing on this road today.', before: 'the-crossing' },
              'Ninety centimetres of water on the campo and the cattle do not mind.',
              'My grandfather built this. The water has taken it back four times.',
              { t: 'You went over the gap on the second one anyway. Of course you did.', after: 'missing-plank' },
              { t: 'You took them across. I have not stopped thinking about it.', after: 'the-crossing' }],
      wheek: ['Half the fazenda just looked up.',
              'You want to be careful. Something always answers out here.'],
      praise: ['Hm. Write that one down, somebody.',
               'Nothing surprises me on this road. That surprised me.',
               'You are still not the strangest thing here. Close, though.'],
      onTask: { 'the-crossing': ['You took them OVER. My grandfather would have paid to see that.'],
                'gather': ['They have gone with you. Just like that. Just like that!'],
                'tamandua': ['On the tamandua. It has not noticed. It never notices.'],
                'missing-plank': ['You went over the gap. The truck still cannot.'] } });
    // THE MUSICIAN (L7, F2): the porch's other side from the boss, clear of
    // the hammock too — a viola caipira, at dusk.
    put('musician', panFAZENDA.x - 6, panFAZENDA.z + 14, {
      face: 2.0,
      beat: { kind: 'work', every: 4.0, dur: 1.0, sfx: 'strum', volume: 0.11, pitch: 0.75 },
    });
    // ---- HE WAS NEVER THERE (R10) -----------------------------------------
    // Found by the shipping soak, which is the only pass that ever entered all
    // nineteen chapters and READ THE CONSOLE: `[pantanal] local at -33 -48 is
    // in the water (0.27) - skipped`. The chapter has been shipping SIX locals
    // and not seven, and the missing one is the man whose four lines are the
    // only place anything says you took the herd across — the thing the whole
    // chapter exists for, per the note twenty lines up.
    //
    // The guard was right and the anchor was wrong: `panCROSS.z0 + 6` is six
    // metres into a river crossing, and the ground around a river crossing IS
    // the flood — 0.269 there, three centimetres under the line, with no mat
    // involved either way.
    //
    // THE FIRST FIX WAS MEASURED AGAINST panTerrain AND WAS ALSO WRONG, which
    // is the reason panStandH now exists: it chose (-24, -51), which reads 0.56
    // while a floating meadow is passing and -0.11 when it is not. Measured on
    // the STATIC ground over a 68 x 68 m grid, the nearest real bank is
    // (-41, -47) at 0.51, ten metres back up the west approach — which is
    // where somebody watching a herd go over would stand anyway. He faces the
    // water.
    put('cattleman', -41, -47, {
      face: 2.36,
      // THE ERRAND (L3-8): a mug of tereré up the capão (panCAPOES[5], dry all the way) to the boatman at (-46, -40)
      errand: { to: [-3.2, 4.0], carry: 'mug', every: 58 },   // stops 3 m short of him: his body is solid and the leg stalled at his feet
      figure: { shirt: PALETTE.cloth4, hat: PALETTE.khaki, skin: PALETTE.skin3 },
      lines: ['They go over here. Same place every evening.',
              { t: 'Let them go first. They will not wait for you.', before: 'gather' },
              { t: 'Count them. There are always more than you counted.', before: 'the-crossing' },
              'Jacare in the water and nobody minds. They eat fish. Mostly.',
              { t: 'They wait for you now. I have never seen them wait for anybody.', after: 'gather' },
              { t: 'One extra at the front tonight. I counted twice.', after: 'the-crossing' }],
      wheek: ['Now they will follow you. That is on you.',
              'Do that at the water and see who comes.'],
      praise: ['I have been standing at this crossing for thirty years. That is new.',
               'Right. Yes. Carry on.',
               'Somebody is going to ask me about that and I will not have an answer.'],
      onTask: { 'the-crossing': ['Every evening, same place. Tonight there was one extra at the front.'],
                'gather': ['Count them again. There is always one more than you counted.'],
                'caiman-nap': ['On a jacare. It knew. It decided not to care.'] } });
    // THE PEAO, at the gate of his own corral, and he is the only person here
    // who is actually working.
    put('peao', panFAZENDA.x - 22 + 13.6, panFAZENDA.z + 1.5, {
      // D2: a hundred and forty kilometres of raised dirt and nobody on it. The
      // campo is the flattest ground in the game after Venice.
      walk: { dx: 10, dz: 4, dwell: 5 },
      face: 3.4, near: 8,
      figure: { shirt: PALETTE.cloth2, hat: PALETTE.panFence, legs: PALETTE.denim, skin: PALETTE.skin4 },
      // counting them again
      beat: { kind: 'rock', every: 6.0, dur: 2.4 },
      lines: ['Eleven in the pen. Six out there somewhere. Six is optimistic.',
              'Cattle first, road second, everything else whenever.',
              { t: 'You are the wrong shape to help and the right shape to watch.', before: 'gather' },
              { t: 'You are the wrong shape to help and you are helping anyway.', after: 'gather' },
              { t: 'The bird has picked you over eleven nelore. Eleven!', after: 'cowbird' }],
      wheek: ['The whole pen turned round. Do it again, I liked that.'],
      praise: ['Cattle first, road second, whatever that was third.',
               'You are the wrong shape to help and the right shape to watch.',
               'Six still out there. Still six.'],
      onTask: { 'cowbird': ['It has picked you. It usually picks the fattest nelore in the pen.'],
                'gather': ['Nine of them behind one. That is a lead animal, that is.'],
                'the-locals': ['They did not look up. They never look up. Do not take it badly.'] } });
    // THE GUIDE, under the dead tree, with binoculars and a list. Every person
    // who has ever been to this place professionally has a list.
    put('guide', panNEST.x - 7, panNEST.z - 5, {
      face: 1.2, near: 9,
      figure: { shirt: PALETTE.cloth7, hat: PALETTE.khaki, skin: PALETTE.skin2 },
      lines: ['Tuiuiu. The big one. It is on the state flag and it is up there.',
              { t: 'Two chicks this year. Last year, none. That is how it goes.', before: 'jabiru-nest' },
              'Six hundred and fifty species of bird. I have four hundred and two.',
              { t: 'The nest is older than I am. They keep adding to it.', before: 'jabiru-nest' },
              { t: 'Two chicks. You have seen them. I have not seen them.', after: 'jabiru-nest' },
              { t: 'Four hundred and three. I have added a column for you.', after: 'macaw-nut' }],
      wheek: ['You have just cost me a heron. Thank you.',
              'Write it down: capybara, one, extremely loud.'],
      praise: ['That is going on the list. I do not have a column for it.',
               'Four hundred and two species and none of them do that.',
               'I am writing "unusual behaviour" and leaving it there.'],
      onTask: { 'jabiru-nest': ['You looked IN it. Nobody has looked in it. I have not looked in it.'],
                'macaw-nut': ['Hyacinth macaw, one nut, stolen. I will have to word that carefully.'],
                'the-crossing': ['Thirteen egrets up in a line. That is the photograph. That is it.'] } });
    // THE BOATMAN, on the bank above the otters, who has views about the otters.
    // ...on the capao above the river rather than on the bank. `z1 + 4` looks
    // like the bank and is not: the river's blend reaches 1.6 half-widths, so
    // -52 is still 77 cm UNDER the water. Probed, not guessed.
    put('boatman', -46, -40, {
      face: 3.6, near: 10,
      figure: { shirt: PALETTE.cloth1, skin: PALETTE.skin3, legs: PALETTE.khaki },
      lines: ['Ariranha. Giant otter. Loudest animal on this river by a mile.',
              { t: 'They will shout at a jaguar. They will certainly shout at you.', before: 'the-otters' },
              'Five in that family. There were seven. There will be seven again.',
              { t: 'They shouted at you. You are on the list now, with the jaguars.', after: 'the-otters' }],
      wheek: ['Now you have started something.'],
      praise: ['The river heard that. The river hears everything.',
               'Ariranha will have opinions. They always have opinions.',
               'Hm. Yes. That happened.'],
      onTask: { 'the-otters': ['All five of them, at once, at you. That is a family, that is.'],
                'the-crossing': ['Straight across, at dusk, with the whole family behind. That is how it is done.'] } });
    // THE ROAD CREW. A hundred and twenty-two bridges and every one of them is
    // somebody's problem this week.
    put('crew', panRoadX(panBRIDGES[1].z) + 4.6, panBRIDGES[1].z + 5, {
      face: 3.1, near: 8,
      figure: { shirt: PALETTE.cloth5, hat: PALETTE.khaki, skin: PALETTE.skin4 },
      // a hammer, on the hundred and twentieth bridge
      beat: { kind: 'work', every: 3.6, dur: 0.8, sfx: 'thud', volume: 0.13, pitch: 0.85 },
      lines: ['One plank. I have had one plank on order since February.',
              { t: 'You can jump it. The truck cannot jump it.', before: 'missing-plank' },
              'A hundred and twenty-two bridges on this road. This is number sixty.',
              { t: 'You jumped it. Still one plank short. Still February.', after: 'missing-plank' },
              { t: 'On the camalote. Those go down. You are the first one they did not.', after: 'camalote' }],
      wheek: ['Right. Yes. Very good. Still one plank short.'],
      praise: ['Not my department. Whatever that was, not my department.',
               'A hundred and twenty-two bridges. This is number sixty. Do the sums.',
               'If it broke, it was already broken.'],
      onTask: { 'missing-plank': ['Over the gap. You did not even slow down. The truck slows down.'],
                'camalote': ['On the camalote? Those go DOWN. Everybody finds that out.'] } });
    // AND THE ONE WHO IS NOT WORKING, in a hammock under the mango tree, which
    // is the correct response to four in the afternoon in the Pantanal.
    put('hammock', panFAZENDA.x + 13, panFAZENDA.z + 8, {
      face: 4.4, near: 8,
      figure: { shirt: PALETTE.cloth3, skin: PALETTE.skin1, legs: PALETTE.stoneDark },
      lines: [{ t: 'It is four o clock. Nothing happens here at four o clock.', before: 'the-crossing' },
              'Sit down. Something will come past. Something always comes past.',
              'That is a good tree. That is the best tree for forty kilometres.',
              { t: 'It is gone six. That is the whole difference between four and six.', after: 'the-crossing' },
              { t: 'You slept on a jacare. I have been doing this wrong.', after: 'caiman-nap' }],
      wheek: ['...no. Not at four o clock.'],
      praise: ['Mm. Something came past. I said something always comes past.',
               'That is the most that has happened here since March.',
               'I am not getting up for that. I am not getting up for anything.'],
      onTask: { 'caiman-nap': ['Now THAT is the correct attitude to four o clock.'],
                'the-crossing': ['Ah. It is that time. Listen — the frogs start in about ten minutes.'],
                'tamandua': ['Slowest ride in South America. Very sensible.'] } });
    // ---- THE TRAVELLER (L8, F2) --------------------------------------------
    // Just off the last bridge (panBRIDGES' final crossing, the map's `way`
    // mark at x:-3.3 z:-96) rather than on the deck itself, which is a narrow
    // strip with its own collider. panNavBlocked is asked rather than assumed,
    // because the ground either side of a bridge in this chapter is the flood.
    // Hidden until Pantanal's own first real tick (gateChap).
    if (typeof game.addTraveller === 'function') {
      let travX = 0, travZ = -93;
      if (panNavBlocked(travX, travZ, 0.6)) travZ = -90;
      const travY = panTerrain(travX, travZ);
      game.addTraveller({ biome: 'pantanal', x: travX, y: travY, z: travZ, face: 2.5,
        gateChap: 15,
        lines: ['The last bridge. I counted. There have been a great many bridges.',
                'I have seen more wildlife in this one wetland than in four other countries combined.'],
        wheek: ['Something in the water did that. Not me.'] });
    }
  }

  // ---- THE AUTHORITY, AND WHERE TO HIDE FROM THEM (L3, F1) ---------------
  // See THE HIDE in systems.js. Still inside one of these and the fazendeiro
  // walks to where you were and gives up. Every spot is beside a thing the
  // chapter already draws: the veranda between its posts, the mango tree
  // the hammock hangs from, the foot of the acuri, the far side of the dead
  // tree, and the middle of the pen — eleven nelore are a better screen than
  // any bush. The flood is a hide on its own and needs nothing here.
  if (typeof game.addHide === 'function') {
    game.addHide({ biome: 'pantanal', x: panFAZENDA.x + 3.75, z: panFAZENDA.z - 5.9, r: 1.8, kind: 'the veranda' });
    game.addHide({ biome: 'pantanal', x: panFAZENDA.x + 16 + 1.4, z: panFAZENDA.z + 6, r: 2.4, kind: 'under the mango tree' });
    game.addHide({ biome: 'pantanal', x: panPALM.x + 1.6, z: panPALM.z, r: 2.0, kind: 'under the palm' });
    game.addHide({ biome: 'pantanal', x: panNEST.x - 1.6, z: panNEST.z + 0.3, r: 1.8, kind: 'behind the dead tree' });
    game.addHide({ biome: 'pantanal', x: panPEN.x, z: panPEN.z, r: 3.0, kind: 'among the cattle' });
  }

  if (typeof game.registerShadowTarget === 'function') game.registerShadowTarget(panRoot);
}

function panBuildGround(game, root) {
  const X0 = -132, X1 = 132, Z0 = -128, Z1 = 108, EL = 3;
  const nx = Math.round((X1 - X0) / EL), nz = Math.round((Z1 - Z0) / EL);
  const g = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0, nx, nz);
  g.rotateX(-Math.PI / 2);
  g.translate((X0 + X1) * 0.5, 0, (Z0 + Z1) * 0.5);
  const p = g.attributes.position.array;
  const col = new Float32Array(p.length);
  const grass = new THREE.Color(PALETTE.panGrass);
  const grassLt = new THREE.Color(PALETTE.panGrassLt);
  const dry = new THREE.Color(PALETTE.panGrassDry);
  const dk = new THREE.Color(PALETTE.panGrassDk);
  const silt = new THREE.Color(PALETTE.panSilt);
  const deep = new THREE.Color(PALETTE.panRiverDeep);
  const sand = new THREE.Color(PALETTE.panSand);
  const road = new THREE.Color(PALETTE.panMud);
  const forest = new THREE.Color(PALETTE.panForest);
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i], z = p[i + 2];
    const h = panBedH(x, z);
    p[i + 1] = h;
    if (h > 1.7) panCol.copy(dry).lerp(grassLt, 0.35);
    else if (h > panWATER) panCol.copy(grass).lerp(grassLt, clamp((h - panWATER) / 1.2, 0, 1));
    else if (h > -0.6) panCol.copy(silt).lerp(grass, clamp((h + 0.6) / 0.9, 0, 1));
    else panCol.copy(deep).lerp(silt, clamp((h + 3.6) / 3.0, 0, 1));
    // ---- THE CAMPO IS A MOSAIC, AND IT IS NOT A MOSAIC OF HEIGHTS ---------
    // Every colour above is a function of h alone, and h on the open campo
    // moves by about a metre over a hundred — so photographed from the
    // standard rig the largest wetland on earth came out as one flat sheet of
    // 0x84a04a with a few tufts on it, right across the frame. The place is
    // not one green: it is grazed-off pale patches, sour dark green where the
    // water stood longest, dry standing grass on the sandy rises and a rim of
    // silt wherever the flood ends. None of that is a height, so none of it
    // was ever drawn. Two sines and no triangles.
    if (h > panWATER - 0.15) {
      const m1 = Math.sin(x * 0.037 + 0.6) * Math.cos(z * 0.029 - 1.3);
      const m2 = Math.sin((x * 0.62 - z) * 0.049 + 2.2);
      const m3 = Math.sin(x * 0.115 - 0.4) * Math.sin(z * 0.098 + 1.9);
      const mos = m1 * 0.62 + m2 * 0.30 + m3 * 0.18;
      // grazed off and going over: pale, dry, and it is where the cattle are
      panCol.lerp(dry, panSmooth(mos * 1.4) * 0.46);
      // ...and sour where it lies wet, which is most of the low ground.
      // SMOOTHSTEP, NOT A CLAMP. The first cut used `clamp(-mos * 1.4, 0, 1)`,
      // which ramps linearly and therefore has a CORNER at mos = 0: measured
      // from the standard rig it drew a forty-metre band of near-black green
      // with a hard straight edge across the campo, which reads as a shadow
      // from something that is not there. Half the weight, and both ends of
      // the ramp round off.
      panCol.lerp(dk, panSmooth(-mos * 1.25) * 0.26 * clamp((1.9 - h) / 1.4, 0.25, 1));
      // THE RIM. A flood edge is a band of bare silt about a metre wide and it
      // is the one line that tells you where the water actually stops.
      panCol.lerp(silt, clamp(1 - Math.abs(h - panWATER) / 0.30, 0, 1) * 0.45);
    }
    // ---- AND A CAPAO IS A WOOD, so the ground inside one is leaf litter and
    // shade rather than pasture. Ten distance tests at build time, and it is
    // what makes the wooded islands read as islands from a hundred metres
    // instead of as a scatter of trees on a lawn.
    for (let k = 0; k < panCAPOES.length; k++) {
      const c = panCAPOES[k];
      const cdx = x - c.x, cdz = z - c.z;
      const cd2 = cdx * cdx + cdz * cdz;
      if (cd2 < c.r * c.r) {
        panCol.lerp(forest, panSmooth((c.r - Math.sqrt(cd2)) / (c.r * 0.55)) * 0.62);
      }
    }
    // ---- THE LANDING, and the marquee is aimed straight at it ------------
    // The crossing is swum toward one particular fifteen metres of the far
    // bank, and photographed from the water that bank was the same green as
    // the water in front of it: the shot the chapter is built around had no
    // destination in it. A hundred capybaras a night going up the same slot
    // wear the grass off it, so it is bare silt with a fan of mud below the
    // waterline, and from the middle of the river it is the only thing that is
    // not olive. Colour, not geometry.
    {
      const ldx = Math.abs(x - panCROSS.x);
      const ldz = z - panRIVER.z0;
      if (ldx < 13 && ldz > -9 && ldz < 7) {
        const k = clamp(1 - ldx / 13, 0, 1) * clamp(1 - Math.abs(ldz - 1) / 8, 0, 1);
        panCol.lerp(silt, panSmooth(k * 1.6) * 0.85);
      }
    }
    // the sandbar is sand and reads as the only bright thing down there
    const sdx = x - panSANDBAR.x, sdz = z - panSANDBAR.z;
    if (sdx * sdx + sdz * sdz * 2.2 < panSANDBAR.r * panSANDBAR.r && h > -1) panCol.copy(sand);
    // and the shoulders of the causeway are bare earth
    const rd = panOnRoad(x, z);
    if (rd > 0) panCol.lerp(road, rd * 0.7);
    else if (Math.abs(x - panRoadX(z)) < panROAD_W + 4 && z < 96 && z > -112) {
      panCol.lerp(road, 0.35);
    }
    if (h < 0.05 && h > -0.6) panCol.lerp(dk, 0.2);
    col[i] = panCol.r; col[i + 1] = panCol.g; col[i + 2] = panCol.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, panVCG());
  m.receiveShadow = true;
  // THE FLOOR DOES NOT CAST. 13,904 triangles of terrain in the shadow map,
  // producing a shadow of the ground ON the ground: nothing but acne along
  // every slope in the chapter. Receiving is all it ever needed to do.
  m.userData.noShadow = true;
  m.frustumCulled = false;
  root.add(m);
}

function panBuildCollision(game) {
  // MIND WHICH WAY THE SECOND AXIS RUNS: local +y maps to world MINUS z, so j
  // walks BACK from the far edge. The wrong form leaves the biome with no
  // collision floor at all and nothing but the capybara's own analytic backstop
  // holding anything up, which hides it completely until a prop falls through
  // the world.
  const X0 = -132, EL = 4;
  const NX = 66, NZ = 59;
  const Z0 = -128, Z1 = Z0 + NZ * EL;
  const data = [];
  for (let i = 0; i <= NX; i++) {
    const row = [];
    for (let j = 0; j <= NZ; j++) row.push(panBedH(X0 + i * EL, Z1 - j * EL));
    data.push(row);
  }
  const hf = new CANNON.Heightfield(data, { elementSize: EL });
  const b = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
  b.addShape(hf);
  b.position.set(X0, 0, Z1);
  b.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  panSyncBody(b);
  game.world.addBody(b);
}

// ------------------------------------------------------ the Transpantaneira --
function panBuildRoad(game, root) {
  const M = panMerger();
  const SEG = 4;
  for (let z = -110; z < 96; z += SEG) {
    const zc = z + SEG * 0.5;
    // is this length of it a bridge, and is it the one with the hole
    let bridge = null;
    for (let i = 0; i < panBRIDGES.length; i++) {
      const b = panBRIDGES[i];
      if (Math.abs(zc - b.z) < b.len * 0.5) bridge = b;
    }
    if (bridge && bridge.gap > 0 && Math.abs(zc - bridge.z) < bridge.gap * 0.5 + SEG * 0.5) {
      // THE MISSING PLANK. Two shortened segments either side of a hole you can
      // see the water through — which is the point, because a hole you cannot
      // see is a hole you fall in.
      const half = (SEG - bridge.gap) * 0.25;
      for (let s = -1; s <= 1; s += 2) {
        const zz = zc + s * (bridge.gap * 0.5 + half);
        const cx = panRoadX(zz);
        M.box(cx, panROAD_Y - 0.15, zz, panROAD_W * 2, 0.3, half * 2, PALETTE.panPlank);
        panStaticBox(game, cx, panROAD_Y - 0.15, zz, panROAD_W * 2, 0.3, half * 2);
      }
      continue;
    }
    const cx = panRoadX(zc);
    if (bridge) {
      M.box(cx, panROAD_Y - 0.15, zc, panROAD_W * 2, 0.3, SEG, PALETTE.panPlank);
      // ---- THE DECK, AND IT WAS FIVE WIDE BANDS ------------------------
      // Five 55 cm planks on 80 cm centres, alternating two colours, over a
      // four-metre bay: photographed from the spawn — which is ON one of these
      // bridges, so it is the FIRST FRAME OF CHAPTER 15 and the lower half of
      // it — that is not a timber deck, it is a floor with five stripes ruled
      // across it. A Transpantaneira bridge is thirty or forty separate baulks
      // of hardwood laid loose on two stringers: no two the same colour, no two
      // quite the same width, gaps you can see the water through, and the two
      // strips where every wheel for sixty years has gone worn pale.
      //
      // Twelve to a bay at 33 cm centres, seeded off the world position so the
      // pattern is stable across a rebuild and does not tile.
      {
        const NP = 12, PITCH = SEG / NP;
        for (let k = 0; k < NP; k++) {
          const pz = zc - SEG * 0.5 + PITCH * (k + 0.5);
          const hsh = ((pz * 977.13) | 0) & 7;
          // the wheel tracks: two pale bands where the timber is polished
          const wide = panROAD_W * 2 - 0.16;
          const col = hsh < 2 ? PALETTE.panPost : (hsh < 5 ? PALETTE.panPlank : PALETTE.panMudRut);
          M.box(cx, panROAD_Y + 0.02 + (hsh === 6 ? 0.035 : 0), pz,
                wide, 0.07, PITCH * (0.62 + (hsh % 3) * 0.07), col,
                0, 0, hsh === 3 ? 0.012 : 0);
          // ...and where the tyres run, it is worn to the pale wood
          if (hsh !== 6) {
            for (let s = -1; s <= 1; s += 2) {
              M.box(cx + s * 1.30, panROAD_Y + 0.058, pz, 0.66, 0.02,
                    PITCH * (0.62 + (hsh % 3) * 0.07) * 0.92, PALETTE.panFence);
            }
          }
        }
        // the two stringers underneath, which is what says it is laid loose
        for (let s = -1; s <= 1; s += 2) {
          M.box(cx + s * 1.34, panROAD_Y - 0.06, zc, 0.22, 0.16, SEG, PALETTE.panPost);
        }
      }
      // handrails, which the real ones mostly do not have and which look
      // wonderful when a capybara goes under them
      for (let s = -1; s <= 1; s += 2) {
        M.box(cx + s * panROAD_W, panROAD_Y + 0.62, zc, 0.16, 0.16, SEG, PALETTE.panPost);
        M.box(cx + s * panROAD_W, panROAD_Y + 0.3, zc - 1.4, 0.14, 0.7, 0.14, PALETTE.panPost);
        // ROADMAP-WOW Part C (Heroes): a post every TWO metres, not four —
        // one post a bay is a kerb with a stick in it; at two the rail reads
        // as a rail from the campo. And THE PILES: a bridge is a deck on
        // something, and from the water or the bank these had nothing under
        // them. Two hardwood piles a bay from the bed to the stringers, one
        // cross-brace between them, panTrunk against the panPost stringers.
        M.box(cx + s * panROAD_W, panROAD_Y + 0.3, zc + 0.6, 0.14, 0.7, 0.14, PALETTE.panPost);
        const pb = panBedH(cx + s * (panROAD_W - 0.5), zc);
        const ptop = panROAD_Y - 0.14;
        M.cyl(cx + s * (panROAD_W - 0.5), (pb + ptop) * 0.5, zc, 0.15, ptop - pb, PALETTE.panTrunk, 0, 0, 0, 4);
      }
      {
        const bl = panBedH(cx - (panROAD_W - 0.5), zc), br = panBedH(cx + (panROAD_W - 0.5), zc);
        const yb = Math.max(bl, br) + 0.3, yt = panROAD_Y - 0.3, span = (panROAD_W - 0.5) * 2;
        M.box(cx, (yb + yt) * 0.5, zc, Math.hypot(span, yt - yb), 0.10, 0.10, PALETTE.panTrunk,
              0, 0, Math.atan2(yt - yb, span));
      }
      panStaticBox(game, cx, panROAD_Y - 0.15, zc, panROAD_W * 2, 0.3, SEG);
    } else {
      const bed = panBedH(cx, zc);
      const h = panROAD_Y - bed;
      M.box(cx, bed + h * 0.5, zc, panROAD_W * 2 + 1.6, h, SEG, PALETTE.panMud);
      M.box(cx, panROAD_Y - 0.06, zc, panROAD_W * 2, 0.14, SEG, PALETTE.panFence);
      // THE RUTS, AND THE ROAD HAD NONE. Eight and a half metres of flat brown
      // filling half the opening shot of the chapter is not a road, it is a
      // slab — and this is a DIRT road in the wet season, which means two
      // wheel tracks worn thirty centimetres into it, water standing in them,
      // and a crown between them the grass is coming back through.
      for (let s = -1; s <= 1; s += 2) {
        // ON TOP OF THE DECK, NOT INSIDE IT. The first cut put the ruts at
        // `panROAD_Y - 0.045` with a height of 0.10, so their top face was a
        // centimetre and a half UNDER the deck plank they were meant to be
        // worn into, and the road came out perfectly blank again.
        // A RUT IS THE WIDTH OF A TYRE. One 1.35 m band each side, painted the
        // same colour for two hundred metres, photographs as four hard-edged
        // parallel STRIPES — which is what a runway looks like, not a dirt
        // road. A truck leaves two tracks about forty centimetres apart with a
        // hump of loose stuff between them, and the whole thing is patchy,
        // because the mud dries at different rates.
        const wear = ((zc * 0.31) | 0) + (s > 0 ? 0 : 5);
        M.box(cx + s * 1.28, panROAD_Y + 0.012, zc, 0.62, 0.05, SEG,
              wear % 4 === 0 ? PALETTE.panMud : PALETTE.panMudRut);
        M.box(cx + s * 1.94, panROAD_Y + 0.012, zc, 0.50, 0.05, SEG,
              wear % 3 === 0 ? PALETTE.panMud : PALETTE.panMudRut);
        // ...and standing water in them. A PUDDLE IS DARK, which is the whole
        // reason it is a puddle: the first cut painted these `panWaterLit` at
        // 1.15 by 3.3 metres and they photographed as sheets of A4 lying on
        // the road. Two or three short ones, the colour of what is under them,
        // and none of them the full width of the rut.
        const key = ((zc * 0.25) | 0) + (s > 0 ? 0 : 2);
        if (key % 3 === 0) {
          for (let k = 0; k < 2; k++) {
            // ...and a puddle sits IN a track, so it is the width of one
            const w = 0.34 + ((key + k) % 3) * 0.14;
            M.box(cx + s * (1.28 + ((key + k) % 2) * 0.66), panROAD_Y + 0.042,
                  zc - SEG * 0.24 + k * SEG * 0.48, w, 0.03, 0.7 + ((key + k) % 2) * 0.5,
                  PALETTE.panRiverDeep);
          }
        }
      }
      // THE CROWN IS GRASS, NOT A PAINTED STRIPE. A box of `panGrassDk` down
      // the middle of a dirt road photographs as a road marking — measured,
      // three times. The strip nothing drives on is drawn by letting the
      // chapter's own grass grow there; see the note in panBuildGrass.
      // DRAWN EVERY FOUR METRES, COLLIDED EVERY TWELVE. A causeway a hundred
      // and forty metres long at one static box per drawn segment is fifty
      // bodies on its own and put this chapter at a hundred and eighty-five,
      // well past the budget. The road bends by 2.6 m over its whole length,
      // so a twelve-metre box is never more than a few centimetres from the
      // drawn edge and nobody can tell from on top of it.
      //
      // AT THE WIDTH IT WAS DRAWN AT, THOUGH. The embankment is drawn
      // `panROAD_W*2 + 1.6` across (that is what an embankment IS — a road on
      // a bank of earth wider than itself) and was collided at `panROAD_W*2`,
      // so eighty centimetres of a one-and-three-quarter-metre earth bank stood
      // either side of this road for its whole two hundred metres with nothing
      // in it. Measured by the solidity probe: it was the single worst
      // offender in the chapter at five hundred and fifty-six squares.
      // ...AND IT IS COLLIDED AT THE WIDTH IT WAS DRAWN AT. The embankment is
      // drawn `panROAD_W*2 + 1.6` across and was collided at `panROAD_W*2`, so
      // eighty centimetres of a one-and-three-quarter-metre earth bank stood
      // either side of this road for its whole two hundred metres with nothing
      // in it. Measured by the solidity probe: five hundred and fifty-six of
      // the chapter's walkable squares had road within reach that the animal
      // walked straight into. The deck stays at the deck's width — that is the
      // bit you stand on — and the bank gets its own, lower, wider box.
      if (Math.round((zc - SEG * 0.5 - -110) / SEG) % 3 === 0) {
        panStaticBox(game, panRoadX(zc + SEG), panROAD_Y - 0.5, zc + SEG,
                     panROAD_W * 2 + 1.6, 1.0, SEG * 3);
      }
    }
  }
  // ---- THE BRIDGE HEADS (ROADMAP-WOW Part C, Heroes) ------------------------
  // Every Transpantaneira bridge starts and ends with a pair of heavy posts
  // where the timber meets the dirt — the thing that tells a driver at night
  // where the deck begins. Taller than the rail by a metre, panTrunk, one
  // pooled body for all twenty. And the ONE ASYMMETRY per bridge: a spare
  // baulk leaning on the rail at the north end of every bridge that has all
  // its planks — the one that is missing one has no spare, which is the joke
  // the peao has been making since February.
  {
    const bh = panPoolBody(game);
    for (let i = 0; i < panBRIDGES.length; i++) {
      const b = panBRIDGES[i];
      for (let e = -1; e <= 1; e += 2) {
        const z = b.z + e * (b.len * 0.5 + 0.3), cx = panRoadX(z);
        for (let s = -1; s <= 1; s += 2) {
          const px = cx + s * (panROAD_W + 0.05);
          M.cyl(px, panROAD_Y + 0.75, z, 0.17, 2.3, PALETTE.panTrunk, 0, 0, 0, 5);
          M.box(px, panROAD_Y + 1.92, z, 0.42, 0.10, 0.42, PALETTE.panPost);
          panPoolBox(bh, px, panROAD_Y + 0.75, z, 0.18, 1.15, 0.18);
        }
      }
      if (b.gap === 0) {
        const z = b.z + b.len * 0.5 - 1.2, cx = panRoadX(z);
        // one end on the deck, the other on the rail: pitched about x
        M.box(cx - panROAD_W + 0.45, panROAD_Y + 0.38, z, 0.26, 0.07, 2.6,
              PALETTE.panPlank, 0.27, 0.22, 0);
      }
    }
    panPoolDone(game, bh);
  }
  // ---- THE MARKER POSTS ---------------------------------------------------
  // The Transpantaneira is 147 km long and every kilometre of it has a post
  // with a number on it. Three things at once: it is the only vertical thing
  // on the causeway, it tells you which way you have come, and — because the
  // bridges are numbered — it is the reason the fazenda's line about "do not
  // take the second bridge, take the third" is a thing you can act on.
  {
    const P = panMerger();
    for (let i = 0; i < panBRIDGES.length + 4; i++) {
      const z = 88 - i * 24;
      if (z < -108) break;
      const s = (i % 2) ? 1 : -1;
      const px = panRoadX(z) + s * (panROAD_W + 1.2);
      P.cyl(px, panROAD_Y - 0.2, z, 0.09, 3.0, PALETTE.panPost, 0, 0, 0, 4);
      P.box(px, panROAD_Y + 1.05, z, 0.5, 0.42, 0.07, PALETTE.panWall, 0, 0.25 * s, 0);
      P.box(px, panROAD_Y + 1.05, z, 0.3, 0.10, 0.09, PALETTE.panCaimanDk, 0, 0.25 * s, 0);
      panStaticBox(game, px, panROAD_Y - 0.2, z, 0.24, 3.0, 0.24);
    }
    const pm = new THREE.Mesh(P.build(), panVC());
    pm.castShadow = true;
    root.add(pm);
  }
  const mesh = new THREE.Mesh(M.build(), panVC());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);
}

function panBuildFazenda(game, root) {
  const M = panMerger();
  const F = panFAZENDA;
  const hy = panBedH(F.x, F.z);
  // the house: whitewashed, a red roof, and a veranda all the way round
  M.box(F.x, hy + 1.9, F.z, 15, 3.8, 10, PALETTE.panWall);
  M.box(F.x, hy + 4.2, F.z, 17.5, 0.5, 12.5, PALETTE.panRoof);
  M.cone(F.x, hy + 5.3, F.z, 10.5, 2.2, PALETTE.panRoof, 0, Math.PI / 4, 0, 4);
  panStaticBox(game, F.x, hy + 1.9, F.z, 15, 3.8, 10);
  // THE FURNITURE, AND FURNITURE IS EXACTLY THE WRONG SIZE. One compound body
  // takes the seven veranda posts, the twenty-two corral posts, the rails and
  // the four legs of the water tank — forty-odd pieces of the chapter's only
  // built place, every one of them previously a hologram.
  const bF = panPoolBody(game);
  for (let i = -3; i <= 3; i++) {
    M.cyl(F.x + i * 2.5, hy + 1.6, F.z - 6.4, 0.16, 3.2, PALETTE.panPost, 0, 0, 0, 6);
    panPoolBox(bF, F.x + i * 2.5, hy + 1.6, F.z - 6.4, 0.18, 1.6, 0.18);
  }
  M.box(F.x, hy + 3.3, F.z - 6.4, 17.5, 0.3, 3.4, PALETTE.panRoof, -0.14);
  M.box(F.x, hy + 0.1, F.z - 5.2, 15, 0.3, 3.0, PALETTE.panPlank);
  // ---- AND THE LIGHTS COME ON --------------------------------------------
  //
  // The crossing switches the evening on and `panDusk` runs the sky, the
  // lilies and the fireflies — but it had nothing to land ON. The only
  // building for eighty kilometres stood in the dark with four black holes for
  // windows, which is the one thing about a farmhouse at sundown that
  // everybody has seen. Four windows and one veranda bulb, both driven off the
  // same number, and from the road at the end of the chapter it is the only
  // warm thing in a hundred thousand square kilometres of standing water.
  {
    panFazWin = new THREE.Group();
    const W = panMerger();
    for (let s = -1; s <= 1; s += 2) {
      for (let k = -1; k <= 1; k += 2) {
        W.box(F.x + s * 4.6 + k * 1.5, hy + 2.1, F.z - 5.02, 1.15, 1.35, 0.10, PALETTE.panIpe);
      }
    }
    // and the bulb over the veranda steps, which is what the moths are at
    W.sph(F.x, hy + 3.05, F.z - 6.4, 0.20, 0.24, 0.20, PALETTE.panIpe, 6);
    panFazWinMat = mat(PALETTE.panIpe, {
      emissive: PALETTE.panIpe, emissiveIntensity: 0, transparent: true, opacity: 0,
    }).clone();
    const wm = new THREE.Mesh(W.build(), panFazWinMat);
    wm.frustumCulled = false;
    panFazWin.add(wm);
    panFazLamp = new THREE.PointLight(PALETTE.panIpe, 0, 22, 1.5);
    panFazLamp.position.set(F.x, hy + 3.0, F.z - 6.9);
    panFazWin.add(panFazLamp);
    root.add(panFazWin);
  }
  // the corral. TWENTY-ONE POSTS AND A GATE: a ring with no way in is a
  // fence you look at, and the whole reason the corral is here is that there
  // are eleven nelore standing in it.
  const CORX = panPEN.x, CORZ = panPEN.z, CORR = panPEN.r;
  for (let i = 0; i < 22; i++) {
    if (i === 11) continue;                                   // the gate
    const a = (i / 22) * Math.PI * 2;
    const px = CORX + Math.cos(a) * CORR, pz = CORZ + Math.sin(a) * CORR;
    const ph = panBedH(px, pz);
    M.cyl(px, ph + 0.8, pz, 0.11, 1.6, PALETTE.panPost, 0, 0, 0, 4);
    panPoolBox(bF, px, ph + 0.8, pz, 0.16, 0.8, 0.16);
    // ROADMAP-WOW Part C (Heroes): rails in EVERY bay, not every other one.
    // Half the ring had two rails and half had none, which from the road read
    // as posts with the fence missing — a pen eleven nelore could walk out
    // of. The only bays without rails are the two either side of the gate.
    if (i !== 10 && i !== 11) {
      const a2 = ((i + 1) / 22) * Math.PI * 2;
      const qx = CORX + Math.cos(a2) * CORR, qz = CORZ + Math.sin(a2) * CORR;
      const len = Math.hypot(qx - px, qz - pz), ry = Math.atan2(qx - px, qz - pz);
      M.box((px + qx) * 0.5, ph + 1.1, (pz + qz) * 0.5, 0.1, 0.14, len, PALETTE.panFence, 0, ry, 0);
      M.box((px + qx) * 0.5, ph + 0.62, (pz + qz) * 0.5, 0.1, 0.12, len, PALETTE.panFence, 0, ry, 0);
      panPoolBox(bF, (px + qx) * 0.5, ph + 0.86, (pz + qz) * 0.5, 0.14, 0.62, len * 0.5, ry);
    }
  }
  // the two gateposts, taller, so you can see where the way in is from a
  // hundred metres — which is the only thing a gate has to do
  for (let s = -1; s <= 1; s += 2) {
    const a = ((11 + s * 0.55) / 22) * Math.PI * 2;
    const px = CORX + Math.cos(a) * CORR, pz = CORZ + Math.sin(a) * CORR;
    const ph = panBedH(px, pz);
    M.cyl(px, ph + 1.25, pz, 0.16, 2.5, PALETTE.panTrunk, 0, 0, 0, 6);
    panPoolBox(bF, px, ph + 1.25, pz, 0.2, 1.25, 0.2);
  }
  // ROADMAP-WOW Part C (Heroes): THE PORTEIRA. Two tall posts were a gap
  // you could see; a gate is a lintel across them and a leaf hung off one of
  // them — a stile, three rails and the diagonal every ranch gate has — and
  // it stands OPEN, swung INTO the pen off the north post, the way the peao
  // left it after the count (the road is a metre from the posts, so an
  // outward leaf would lie across the shoulder the animal walks). That is
  // the pen's one asymmetry; nothing hangs off the other post. No collider
  // on the leaf: the nelore are not bodies and neither is a gate you walk by.
  {
    const aG = (11 / 22) * Math.PI * 2;
    const gx = CORX + Math.cos(aG) * CORR, gz = CORZ + Math.sin(aG) * CORR;
    const gh = panBedH(gx, gz);
    // the lintel, along the ring's tangent at the gate
    const tYaw = Math.atan2(-Math.sin(aG), Math.cos(aG));   // tangent (−sin a, cos a) as a yaw
    M.box(gx, gh + 2.55, gz, 0.18, 0.16, CORR * 2 * Math.PI * (1.1 / 22) + 0.6, PALETTE.panTrunk, 0, tYaw, 0);
    // the leaf: hinged on the post at +0.55, swung 70 degrees inward
    const aH = ((11 + 0.55) / 22) * Math.PI * 2;
    const hx = CORX + Math.cos(aH) * CORR, hz = CORZ + Math.sin(aH) * CORR;
    const gap = CORR * 2 * Math.PI * (1.1 / 22) - 0.3;     // the leaf's length
    const leafYaw = tYaw + (Math.PI + 1.22);                 // 70 degrees off the closed line, inward
    const dx = Math.sin(leafYaw), dz = Math.cos(leafYaw);
    const mx = hx + dx * gap * 0.5, mz = hz + dz * gap * 0.5;
    for (let r = 0; r < 3; r++) {
      M.box(mx, gh + 0.55 + r * 0.55, mz, 0.08, 0.12, gap, PALETTE.panFence, 0, leafYaw, 0);
    }
    M.box(hx + dx * (gap - 0.1), gh + 0.95, hz + dz * (gap - 0.1), 0.10, 1.5, 0.12, PALETTE.panFence, 0, leafYaw, 0);
    M.box(mx, gh + 0.95, mz, 0.07, 0.10, Math.hypot(gap, 1.1), PALETTE.panFence, Math.atan2(1.1, gap), leafYaw, 0);
  }
  // the mango tree everything on this farm sits under
  {
    const tx = F.x + 16, tz = F.z + 6, th = panBedH(tx, tz);
    M.cyl(tx, th + 2.2, tz, 0.7, 4.4, PALETTE.panTrunk, 0, 0, 0, 6);
    for (let i = 0; i < 5; i++) {
      M.sph(tx + rand(-3.2, 3.2), th + 5.4 + rand(-0.8, 1.4), tz + rand(-3.2, 3.2),
            rand(2.8, 4.2), rand(2.0, 2.8), rand(2.8, 4.2),
            i % 2 ? PALETTE.panCanopy : PALETTE.panForestLt, 6);
    }
    panStaticBox(game, tx, th + 1.5, tz, 1.4, 3, 1.4);
  }
  // a water tank on a frame, because every fazenda has one
  {
    const tx = F.x - 9, tz = F.z + 9, th = panBedH(tx, tz);
    for (let i = 0; i < 4; i++) {
      M.cyl(tx + (i < 2 ? -1.4 : 1.4), th + 2.2, tz + (i % 2 ? -1.4 : 1.4), 0.12, 4.4, PALETTE.panPost, 0, 0, 0, 4);
      panPoolBox(bF, tx + (i < 2 ? -1.4 : 1.4), th + 2.2, tz + (i % 2 ? -1.4 : 1.4), 0.16, 2.2, 0.16);
    }
    M.cyl(tx, th + 5.2, tz, 1.9, 2.0, PALETTE.panFence, 0, 0, 0, 8);
    M.cyl(tx, th + 6.3, tz, 2.0, 0.3, PALETTE.panRoof, 0, 0, 0, 8);
  }
  // ...and a trough, which is what the cattle are standing round
  {
    const tx = CORX + 6, tz = CORZ - 4, th = panBedH(tx, tz);
    M.box(tx, th + 0.34, tz, 1.1, 0.68, 4.6, PALETTE.panPlank, 0, 0.3, 0);
    M.box(tx, th + 0.52, tz, 0.86, 0.10, 4.3, PALETTE.panWater, 0, 0.3, 0);
    panPoolBox(bF, tx, th + 0.34, tz, 0.62, 0.34, 2.3, 0.3);
  }
  // =====================================================================
  // THE YARD, AND IT WAS A LAWN WITH A HOUSE ON IT.
  //
  // This is the only built place in a hundred thousand square kilometres, the
  // chapter opens two hundred metres from it, and everything on the hill was
  // load-bearing structure: a house, a corral, a tank, a trough, a tree. A
  // working fazenda's yard is the OPPOSITE of tidy — it is where all the
  // things that are between jobs live. None of this is a task and none of it
  // is solid except the woodpile and the cart, which are both the size of
  // thing you notice walking through.
  // =====================================================================
  {
    const bY = panPoolBody(game);
    // The bare swept earth the yard stands on: nobody's grass survives a
    // hundred years of cattle turning round on it.
    //
    // AND IT IS PATCHES, EACH PROBED. The first cut was two slabs, 30 x 13 m
    // and 14 x 12, drawn at `hy` — the height of the hill's SUMMIT — over
    // ground that falls away 2.6 m inside the fazenda's radius. Twenty metres
    // out it was hanging three metres in the air, and photographed from the
    // approach the whole lower half of the frame was a flat brown plane. A
    // yard is worn in PATCHES anyway, so eighteen small ones on their own
    // ground is both the fix and the better picture.
    for (let i = 0; i < 18; i++) {
      const a = rand(0, 6.28), rr = Math.sqrt(Math.random()) * 12;
      const px = F.x - 4 + Math.cos(a) * rr, pz = F.z - 5 + Math.sin(a) * rr * 0.8;
      M.box(px, panBedH(px, pz) + 0.03, pz, rand(3.0, 6.5), 0.06, rand(2.6, 5.5),
            i % 4 === 0 ? PALETTE.panMud : PALETTE.panSilt, 0, rand(0, 3), 0);
    }
    for (let i = 0; i < 12; i++) {
      const a = rand(0, 6.28), rr = Math.sqrt(Math.random()) * 9;
      const px = panPEN.x + Math.cos(a) * rr, pz = panPEN.z + Math.sin(a) * rr;
      M.box(px, panBedH(px, pz) + 0.03, pz, rand(2.6, 5.5), 0.06, rand(2.4, 4.8),
            i % 3 === 0 ? PALETTE.panSilt : PALETTE.panMud, 0, rand(0, 3), 0);
    }
    // the ox cart, on two enormous wheels, which is what everything on a
    // fazenda was moved on for three hundred years
    {
      const cx2 = F.x - 11, cz2 = F.z - 11, ch = panBedH(cx2, cz2);
      M.box(cx2, ch + 0.95, cz2, 1.9, 0.22, 3.4, PALETTE.panPlank, 0, 0.5, 0);
      for (let s = -1; s <= 1; s += 2) {
        M.box(cx2 + s * 0.85, ch + 1.20, cz2, 0.10, 0.55, 3.2, PALETTE.panPlank, 0, 0.5, 0);
        M.cyl(cx2 + s * 1.0, ch + 0.80, cz2 - 0.3, 0.80, 0.14, PALETTE.panTrunk, 0, 0.5, Math.PI / 2, 8);
      }
      M.cyl(cx2 - 1.2, ch + 0.72, cz2 + 2.4, 0.09, 3.0, PALETTE.panPlank, 0.22, 0.5, 0, 4);
      panPoolBox(bY, cx2, ch + 0.9, cz2, 1.1, 0.9, 1.8, 0.5);
    }
    // the woodpile, which every kitchen out there runs on
    {
      const wx = F.x + 8.5, wz = F.z - 8.5, wh = panBedH(wx, wz);
      for (let r = 0; r < 4; r++) {
        for (let k = 0; k < 6 - r; k++) {
          M.cyl(wx - 1.4 + k * 0.52 + r * 0.26, wh + 0.22 + r * 0.42, wz,
                0.21, 2.2, r % 2 ? PALETTE.panTrunk : PALETTE.panTrunkDk, Math.PI / 2, 0.12, 0, 6);
        }
      }
      panPoolBox(bY, wx - 0.2, wh + 0.9, wz, 1.9, 0.9, 1.1, 0.12);
    }
    // a washing line between the veranda and the mango tree, which is the one
    // thing that says somebody lives in the house rather than owning it
    {
      const ax = F.x + 6.5, az = F.z + 3.0, ah = panBedH(ax, az);
      M.cyl(ax, ah + 1.3, az, 0.08, 2.6, PALETTE.panPost, 0, 0, 0, 4);
      M.box(ax + 4.6, ah + 2.55, az + 1.5, 9.2, 0.04, 0.04, PALETTE.panFence, 0, -0.32, 0);
      const wcol = [PALETTE.panWall, PALETTE.panMacaw, PALETTE.panIpe, PALETTE.panWall, PALETTE.panCaimanDk];
      for (let k = 0; k < 5; k++) {
        const t = 0.12 + k * 0.19;
        M.box(ax + 9.2 * t, ah + 2.20, az + 1.5 * 2 * t, 1.0, 0.72, 0.03,
              wcol[k], 0, -0.32, (k % 2 ? 0.05 : -0.05));
      }
      panPoolBox(bY, ax, ah + 1.3, az, 0.12, 1.3, 0.12);
    }
    // three chickens, which is the correct number of chickens
    for (let k = 0; k < 3; k++) {
      const px = F.x - 2 + k * 1.9 + rand(-0.6, 0.6), pz = F.z - 8 + rand(-1.4, 1.4);
      const ph = panBedH(px, pz);
      const a = rand(0, 6.28);
      M.sph(px, ph + 0.19, pz, 0.13, 0.14, 0.19, k === 1 ? PALETTE.panMud : PALETTE.panWall, 6);
      M.sph(px + Math.sin(a) * 0.17, ph + 0.30, pz + Math.cos(a) * 0.17, 0.07, 0.08, 0.07,
            k === 1 ? PALETTE.panMud : PALETTE.panWall, 6);
      M.box(px + Math.sin(a) * 0.24, ph + 0.29, pz + Math.cos(a) * 0.24, 0.04, 0.04, 0.06,
            PALETTE.panIpe);
      M.box(px, ph + 0.36, pz, 0.05, 0.09, 0.05, PALETTE.panRoof);
    }
    // a stack of fence posts waiting to become a fence, and a coil of wire
    {
      const sx = panPEN.x + 2, sz = panPEN.z + 15, sh = panBedH(sx, sz);
      for (let k = 0; k < 7; k++) {
        M.cyl(sx + (k % 4) * 0.26, sh + 0.13 + ((k / 4) | 0) * 0.24, sz,
              0.11, 2.4, PALETTE.panPost, Math.PI / 2, 0.2 + k * 0.03, 0, 4);
      }
      M.cyl(sx + 2.0, sh + 0.16, sz + 0.6, 0.42, 0.30, PALETTE.panFence, 0, 0, 0, 8);
      panPoolBox(bY, sx + 0.4, sh + 0.25, sz, 1.4, 0.25, 0.5, 0.2);
    }
    panPoolDone(game, bY);
  }
  panPoolDone(game, bF);
  const mesh = new THREE.Mesh(M.build(), panVC());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);
}

/**
 * O GADO NELORE. A FAZENDA WITHOUT CATTLE IS NOT A FAZENDA.
 *
 * The Pantanal is the largest continuously ranched wetland on earth and the
 * whole of it is nelore — white, humped, ears like a hound's, a dewlap that
 * swings. Eleven of them in the corral and six out on the campo, and they are
 * why the cowbird exists at all: a cowbird rides cattle, and for the whole
 * life of this chapter there were none, so a bird named after an animal that
 * was not here settled for a rodent.
 *
 * The hump is the read. From six metres up a nelore is a white loaf with a
 * BUMP on the shoulder, and nothing else about it survives the distance.
 */
function panBuildCattle(root) {
  const M = panTwin(0.4);   // muzzle and dewlap rounded on the twin (AAA pass)
  M.sph(0, 0.94, 0, 0.42, 0.44, 1.00, PALETTE.panNelore, 6);
  M.sph(0, 1.30, -0.28, 0.30, 0.28, 0.34, PALETTE.panNeloreLt, 6);   // THE HUMP
  M.sph(0, 0.90, 0.86, 0.24, 0.26, 0.34, PALETTE.panNelore, 6);      // the head
  M.box(0, 0.78, 1.14, 0.20, 0.18, 0.24, PALETTE.panNeloreDk);       // the muzzle
  for (let s = -1; s <= 1; s += 2) {
    M.cone(s * 0.30, 0.94, 0.80, 0.13, 0.42, PALETTE.panNelore, 0, 0, s * 1.35, 6);  // the ears
    M.cone(s * 0.16, 1.10, 0.78, 0.05, 0.30, PALETTE.panNeloreDk, 0, 0, s * 0.5, 4); // the horns
    M.sph(s * 0.14, 0.94, 1.02, 0.045, 0.045, 0.045, PALETTE.panNeloreDk, 6);
  }
  M.box(0, 0.62, 0.62, 0.16, 0.46, 0.36, PALETTE.panNeloreLt);        // the dewlap
  for (let i = 0; i < 4; i++) {
    M.cyl((i < 2 ? -0.30 : 0.30), 0.36, (i % 2 ? -0.52 : 0.56), 0.09, 0.72, PALETTE.panNelore, 0, 0, 0, 4);
  }
  M.cyl(0, 0.72, -1.02, 0.05, 0.9, PALETTE.panNelore, 0.25, 0, 0, 4);
  M.sph(0, 0.30, -1.20, 0.09, 0.14, 0.09, PALETTE.panNeloreDk, 6);
  panCattle = new THREE.InstancedMesh(M.build(), panVC(), panCOW_N);
  panCattle.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  panCattle.castShadow = true;
  panCattle.frustumCulled = false;
  panCows.length = 0;
  const CORX = panPEN.x, CORZ = panPEN.z;
  for (let i = 0; i < panCOW_N; i++) {
    let x, z;
    if (i < 11) {
      const a = rand(0, 6.28), r = Math.sqrt(Math.random()) * 10.5;
      x = CORX + Math.cos(a) * r; z = CORZ + Math.sin(a) * r;
    } else {
      // out on the campo, and always on ground that is out of the water: a cow
      // standing to the belly in a corixo is a cow that has drowned.
      // ...AND NEVER ON THE CAUSEWAY. The retry tested the water and nothing
      // else, so a nelore could land on the Transpantaneira — where it is
      // DRAWN at `panBedH`, which under the road is the ground the embankment
      // stands on, a metre and a quarter below the deck. Photographed from the
      // spawn: a white loaf sunk to the shoulders in the road surface, in the
      // opening frame of the chapter.
      let tries = 0;
      do { x = rand(-40, 90); z = rand(-4, 92); }
      while ((panBedH(x, z) < panWATER + 0.25 || panOnRoad(x, z) > 0) && ++tries < 40);
    }
    panCows.push({ x: x, z: z, hx: x, hz: z, yaw: rand(0, 6.28), t: rand(0, 9),
                   ph: rand(0, 6.28), moving: 0, pen: i < 11 });
  }
  root.add(panCattle);
  panRoundOn(panCattle);
}

/**
 * VITÓRIA-RÉGIA. Victoria amazonica, and THE RIM TURNS UP.
 *
 * Two colours have sat unused in the palette since this chapter shipped —
 * `panLilyRim` and `panLilyBud` — with a comment on the third one saying
 * exactly what was meant and never built. A lily pad is a plate two and a half
 * metres across with a ten-centimetre wall round the edge of it, which is the
 * single most photographed plant in South America and reads perfectly at this
 * camera height because the rim catches the light and the middle does not.
 *
 * And the flower is a CLOCK. Victoria opens white at dusk, is pink by the
 * second night, and is shut all day — so the buds on this bay are the only
 * thing in the chapter besides the sky that says the crossing has happened.
 */
function panBuildLilies(root) {
  const M = panMerger();
  M.cyl(0, 0.05, 0, 0.50, 0.06, PALETTE.panLily, 0, 0, 0, 8);         // the plate
  // THE WALL ROUND THE EDGE, AND ITS LONG AXIS IS TANGENTIAL. The first cut
  // put a 0.40 m box at `ry = -a` and `panXform` composes an 'XYZ' euler, so
  // Ry turned the box's own X axis to point RADIALLY — eight spokes sticking
  // out of a disc. Photographed from the river it was a red and green
  // pinwheel. The long axis goes in Z, which Ry then sweeps round the rim.
  // SIX SEGMENTS AND ONE BOX EACH, not eight and two: at 188 triangles a pad
  // and sixty-two pads the raft cost more than the entire herd.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    M.box(Math.cos(a) * 0.49, 0.112, Math.sin(a) * 0.49, 0.10, 0.15, 0.53,
          PALETTE.panLilyRim, 0, -a, 0.22);
  }
  panLilyMesh = new THREE.InstancedMesh(M.build(), panVC(), panLILY_N);
  panLilyMesh.castShadow = true;
  panLilyMesh.receiveShadow = true;
  panLilyMesh.frustumCulled = false;
  // A RAFT, NOT A SCATTER. They grow from one rootstock and crowd each other,
  // so they come in patches with hard edges — three of them, all in water deep
  // enough to have grown one and shallow enough to be a shelf.
  const rafts = [[panBAIA.x + 22, panBAIA.z + 16], [panBAIA.x - 14, panBAIA.z - 18],
                 [-18, -62], [panBAIA.x + 4, panBAIA.z + 30]];
  panLilies.length = 0;
  let n = 0;
  for (let r = 0; r < rafts.length && n < panLILY_N; r++) {
    const cx = rafts[r][0], cz = rafts[r][1];
    for (let i = 0; i < 26 && n < panLILY_N; i++) {
      const a = rand(0, 6.28), rr = Math.sqrt(Math.random()) * 11;
      const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr * 0.8;
      const d = panWATER - panBedH(x, z);
      if (d < 0.35 || d > 3.2) continue;
      const s = rand(1.5, 2.7);
      panLilies.push({ x: x, z: z, s: s, ph: rand(0, 6.28) });
      panM.compose(panV3.set(x, panWATER + 0.03, z),
                   panQ.setFromEuler(panE.set(0, rand(0, 6.28), 0)), panSc.set(s, 1, s));
      panLilyMesh.setMatrixAt(n++, panM);
    }
  }
  for (let i = n; i < panLILY_N; i++) {
    panM.compose(panV3.set(0, -900, 0), panQ.setFromEuler(panE.set(0, 0, 0)), panSc.set(0.001, 0.001, 0.001));
    panLilyMesh.setMatrixAt(i, panM);
  }
  panLilyMesh.instanceMatrix.needsUpdate = true;
  root.add(panLilyMesh);

  // the flowers, on their own mesh because they OPEN and the pads do not
  const F = panMerger();
  F.sph(0, 0.10, 0, 0.13, 0.16, 0.13, PALETTE.panLilyBud, 6);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    F.box(Math.cos(a) * 0.11, 0.20, Math.sin(a) * 0.11, 0.11, 0.26, 0.05,
          PALETTE.panLilyBud, 0, -a, 0.10);
  }
  panLilyFlower = new THREE.InstancedMesh(F.build(), panVC(), panFLOWER_N);
  panLilyFlower.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  panLilyFlower.frustumCulled = false;
  panLilyFlower.castShadow = true;
  const fc = new Float32Array(panFLOWER_N * 3);
  for (let i = 0; i < panFLOWER_N; i++) { fc[i * 3] = 1; fc[i * 3 + 1] = 1; fc[i * 3 + 2] = 1; }
  panLilyFlower.instanceColor = new THREE.InstancedBufferAttribute(fc, 3);
  root.add(panLilyFlower);

  // ---- AND WHAT IS FLOATING ON THE REST OF IT --------------------------
  //
  // The baia is a forty-metre bay and, photographed from the water with the
  // lilies at the top of the frame, the other two thirds of the picture was a
  // single unbroken sheet of olive — the same "one flat value" the wrack line,
  // the Corso and the Göreme plaza have all been fixed for, and the largest
  // remaining one in these three chapters. It is also wrong about the place:
  // an oxbow in the Pantanal in the wet is not open water, it is COVERED, and
  // the chapter's own palette has had panHyacinth in it since it shipped for
  // exactly this.
  //
  // Three things, all flat, all in one static mesh, and none of them anything
  // the animal can stand on — this is surface, not floor, and the swim is the
  // mechanic:
  //
  //   DUCKWEED. Big soft-edged patches of it, which is what actually breaks a
  //   sheet of still water up at this distance. Two triangles each.
  //   HYACINTH. Clumps of three or four rosettes with a leaf or two standing
  //   up out of them, so there is something with a HEIGHT on the surface.
  //   AND THE ODD DEAD LEAF, because a mirror with nothing on it is a floor.
  {
    const W = panMerger();
    let seed = 4471;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const rr2 = (a, b) => a + rnd() * (b - a);
    // the duckweed, off a jittered grid over the bay so it cannot clump in one
    // corner or starve the middle
    const CELL = 6.5;
    for (let gx = -6; gx <= 6; gx++) {
      for (let gz = -6; gz <= 6; gz++) {
        const x = panBAIA.x + gx * CELL + rr2(-2.6, 2.6);
        const z = panBAIA.z + gz * CELL + rr2(-2.6, 2.6);
        const dx = x - panBAIA.x, dz = z - panBAIA.z;
        if (dx * dx + dz * dz > panBAIA.r * panBAIA.r) continue;
        if (panWATER - panBedH(x, z) < 0.20) continue;
        if (rnd() < 0.30) continue;                 // it is patchy, not a lawn
        // ---- SMALL, AND CLOSE IN VALUE --------------------------------
        // First cut: 1.6-4.4 m quads in panGrassLt over an olive bay. From
        // the water that is forty PALE LIME RECTANGLES lying on a green
        // sheet — the exact failure the Göreme valley floor's wash channels
        // paid for, arriving on water instead of sand. Duckweed is two
        // millimetres across; what you can see of it at eight metres is a
        // slight change of value over a patch, so the pieces have to be
        // small enough not to be resolved individually and dark enough not
        // to be the brightest thing in the frame.
        // ...AND THEY HAVE TO OVERLAP. A patch made of pieces that do not
        // touch is a patch made of pieces; the outline of a raft of duckweed
        // is ragged because the pieces at its edge are half over each other.
        const n2 = 9 + ((rnd() * 7) | 0);
        for (let k = 0; k < n2; k++) {
          const s = rr2(0.38, 1.15);
          // FLAT, and the spin goes in rz. panMerger's quad() is UPRIGHT (see
          // its note) and panXform composes an 'XYZ' euler, so Rx(-pi/2) lays
          // it down and Rz is then a spin about its own normal — which after
          // the tip is the world's Y. Passing the spin as ry instead turns the
          // plane on edge before laying it down, which is a different quad
          // altogether and the mistake the lily rim already paid for.
          W.quad(x + rr2(-1.5, 1.5), panWATER + 0.012, z + rr2(-1.5, 1.5), s, s * rr2(0.6, 1.0),
                 rnd() < 0.5 ? PALETTE.panHyacinth : PALETTE.panGrassDk,
                 -Math.PI / 2, 0, rr2(0, 3.14));
        }
      }
    }
    // the hyacinth clumps, which are the only thing on this water with a
    // silhouette
    for (let i = 0; i < 46; i++) {
      const a = rr2(0, 6.28), rad = Math.sqrt(rnd()) * (panBAIA.r - 3);
      const cx = panBAIA.x + Math.cos(a) * rad, cz = panBAIA.z + Math.sin(a) * rad * 0.9;
      if (panWATER - panBedH(cx, cz) < 0.35) continue;
      const n2 = 3 + ((rnd() * 3) | 0);
      for (let k = 0; k < n2; k++) {
        const x = cx + rr2(-1.5, 1.5), z = cz + rr2(-1.5, 1.5);
        W.sph(x, panWATER + 0.06, z, rr2(0.34, 0.6), 0.10, rr2(0.34, 0.6),
              PALETTE.panHyacinth, 6);
        // one leaf up out of it — a hyacinth stands about a hand high
        W.box(x + rr2(-0.2, 0.2), panWATER + 0.22, z + rr2(-0.2, 0.2),
              0.30, 0.34, 0.06, PALETTE.panGrassLt, rr2(-0.3, 0.3), rr2(0, 3.14), rr2(-0.3, 0.3));
      }
    }
    // and the leaf litter the gallery forest drops on it all year
    for (let i = 0; i < 90; i++) {
      const a = rr2(0, 6.28), rad = Math.sqrt(rnd()) * panBAIA.r;
      const x = panBAIA.x + Math.cos(a) * rad, z = panBAIA.z + Math.sin(a) * rad * 0.9;
      if (panWATER - panBedH(x, z) < 0.15) continue;
      W.quad(x, panWATER + 0.008, z, rr2(0.16, 0.42), rr2(0.10, 0.24),
             i % 3 === 0 ? PALETTE.panDead : PALETTE.panGrassDk,
             -Math.PI / 2, 0, rr2(0, 3.14));
    }
    const wm = new THREE.Mesh(W.build(), panVC());
    wm.receiveShadow = true;
    wm.castShadow = false;
    wm.userData.noShadow = true;   // floating litter, lying on the water it sits on
    wm.renderOrder = 1;
    root.add(wm);
  }
}

// ---- ROADMAP-WOW2 V3, THE FAR PLANE: THE TREE LINE --------------------------
// The world here is 264 x 236 m of ground and then the dome: from the road
// the campo ran out at 130 m into the horizon colour and stopped. The
// Pantanal is flat to the edge of sight and what closes it is a tree line —
// the next cordilheira of forest, low and dark and broken, a long way off.
// Seven wedges tangent to a 300 m circle round the spawn, from south-south-
// west round to north-west (the arrival lens rests looking WSW over the
// campo; the fazenda and its trees close the east), 6–9 m of canopy on a
// 30 m strip, in the gallery forest's green pulled toward the chapter's
// haze (60–760 m, never re-based: 34 % at 300). Bases at -30 so the strip
// sits on the horizon and never floats over it.
//
// And the ibis: a line of seven crossing south to north down the western
// sky at 26–30 m, ninety seconds a loop, sixty of them on the wing —
// fourteen triangles, pale under-wings, because that is the thing you look
// up at here at the end of the day.
function panBuildFar(root) {
  const tone = farTone(PALETTE.panForest, PALETTE.panHaze, 0.35);
  const wedges = [];
  const cx = 0, cz = 62, R = 300;
  const profs = [
    [[-1, 0], [-0.7, 6], [-0.4, 8.5], [-0.1, 7], [0.3, 9], [0.6, 6], [1, 0]],
    [[-1, 0], [-0.6, 7], [-0.2, 5.5], [0.2, 8.5], [0.7, 7], [1, 0]],
    [[-1, 0], [-0.5, 7.5], [0, 9], [0.4, 6], [0.8, 7.5], [1, 0]],
  ];
  for (let i = 0; i < 7; i++) {
    const th = (190 + i * 17) * Math.PI / 180;          // bearing round the circle
    wedges.push({ x: cx + Math.sin(th) * R, z: cz + Math.cos(th) * R, w: 120, d: 30, yaw: th,
                  profile: profs[i % 3] });
  }
  panFar = farBundle({
    name: 'pantanal',
    layer: farLayer({ name: 'far-pantanal', color: tone, wedges }),
    mover: farMover({
      kind: 'birds', color: farTone(PALETTE.panHaze, PALETTE.panSkyLow, 0.5), period: 90, duty: 0.66, phase: 0.55,
      path: [[-210, 26, -320], [-236, 30, 40], [-210, 27, 380]],
    }),
  });
  root.add(panFar.group);
}

/** The gallery forest, the capoes, and one tree in flower. */
function panBuildForest(game, root) {
  const M = panMerger();
  // ONE BODY FOR THE TREES, ONE FOR THE MOUNDS. Both are filled below and both
  // are handed to the world exactly once.
  let bTree = panPoolBody(game), nTree = 0;
  let bMound = panPoolBody(game), nMound = 0;
  const put = (x, z, scale, kind) => {
    const h = panBedH(x, z);
    if (h < panWATER - 0.2) return;
    const th = rand(4.5, 8.5) * scale;
    M.cyl(x, h + th * 0.5, z, 0.34 * scale, th, kind === 2 ? PALETTE.panDead : PALETTE.panTrunk, 0, 0, 0, 6);
    // EVERY TRUNK, NOT THE BIG ONES. `scale > 1.18` collided about one tree in
    // eight: a hundred and thirty trunks in the gallery forest and the capoes
    // were walk-through, and a capoe is a WOOD — the one place in this chapter
    // where the animal is meant to have to go round something.
    panPoolBox(bTree, x, h + 1.5, z, 0.42 * scale, 1.6, 0.42 * scale);
    if (++nTree >= 24) { panPoolDone(game, bTree); bTree = panPoolBody(game); nTree = 0; }
    if (kind === 2) {
      // a dead tree: bare, pale, and everything with wings sits in one
      for (let i = 0; i < 4; i++) {
        M.box(x, h + th * rand(0.6, 0.95), z, rand(2.5, 5) * scale, 0.24, 0.24, PALETTE.panDead,
              rand(-0.2, 0.2), rand(0, 3.14), rand(-0.4, -0.1));
      }
      return;
    }
    const c = kind === 1 ? PALETTE.panIpe : (kind === 3 ? PALETTE.panIpeRose : PALETTE.panCanopy);
    const c2 = kind === 1 ? PALETTE.panIpe : (kind === 3 ? PALETTE.panIpeRose : PALETTE.panForestLt);
    // THREE BLOBS, NOT FOUR. A hundred and seventy trees at 168 triangles
    // apiece was the second largest item in the chapter, and the fourth sphere
    // is inside the other three at this radius — measured, not guessed.
    for (let i = 0; i < 3; i++) {
      M.sph(x + rand(-2, 2) * scale, h + th + rand(-0.6, 1.2) * scale, z + rand(-2, 2) * scale,
            rand(2.1, 3.4) * scale, rand(1.5, 2.1) * scale, rand(2.1, 3.4) * scale,
            i % 2 ? c : c2, 6);
    }
  };
  // the gallery forest, both banks of the river
  for (let i = 0; i < 104; i++) {
    const x = rand(-120, 120);
    const z = i % 2 ? rand(panRIVER.z1 + 2, panRIVER.z1 + 16) : rand(panRIVER.z0 - 18, panRIVER.z0 - 3);
    if (Math.abs(x - panRoadX(z)) < 8) continue;
    put(x, z, rand(0.85, 1.35), i % 11 === 3 ? 1 : 0);
  }
  // the capoes
  for (let c = 0; c < panCAPOES.length; c++) {
    const cc = panCAPOES[c];
    const n = Math.round(cc.r * 0.98);
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), rr = rand(0, cc.r * 0.75);
      put(cc.x + Math.cos(a) * rr, cc.z + Math.sin(a) * rr, rand(0.7, 1.2),
          (c === 2 && i === 0) ? 1 : (c === 5 && i === 1) ? 3 : 0);
    }
  }
  // a few dead ones out on the campo — the only vertical thing for a kilometre
  const deadAt = [[70, 8], [-84, 30], [12, -44], [-64, 62], [86, -30]];
  for (let i = 0; i < deadAt.length; i++) put(deadAt[i][0], deadAt[i][1], 1.15, 2);

  // TERMITE MOUNDS. The only rock in a place with no rock, there are millions
  // of them, and they are also the stairs: this is how a capybara gets up the
  // dead tree the jabiru is nesting in.
  //
  // A HUNDRED AND FIFTY, AND THEY ARE NOT SMOOTH. Ninety over fifty thousand
  // square metres is one every six hundred, which is under one in the frame;
  // and a cupinzeiro is not a traffic cone — it is a lumpy chimney of set clay
  // with turrets and a fig growing out of the top of half of them. Three extra
  // pieces apiece is what makes a field of them read as a field of them.
  for (let i = 0; i < 150; i++) {
    const x = rand(-118, 118), z = rand(-120, 100);
    const h = panBedH(x, z);
    if (h < panWATER + 0.1) continue;
    if (panOnRoad(x, z) > 0) continue;
    const r = rand(0.5, 1.5);
    M.cone(x, h + r * 0.9, z, r, r * 2.0, PALETTE.panTermite, 0, rand(0, 3), 0, 6);
    // the shoulder and one turret, so the silhouette has a step in it
    M.cone(x + r * 0.42, h + r * 0.42, z - r * 0.30, r * 0.52, r * 1.15,
           PALETTE.panSilt, 0, rand(0, 3), 0.12, 6);
    if (i % 3 === 0) {
      M.cone(x - r * 0.34, h + r * 0.55, z + r * 0.36, r * 0.34, r * 1.5,
             PALETTE.panTermite, 0, rand(0, 3), -0.10, 6);
    }
    // ...and about one in five has something growing out of the top, which is
    // the single most Pantanal thing a termite mound does
    if (i % 5 === 2) {
      M.sph(x, h + r * 1.95, z, r * 0.55, r * 0.34, r * 0.55, PALETTE.panForestLt, 6);
      M.sph(x + r * 0.22, h + r * 2.15, z, r * 0.30, r * 0.24, r * 0.30, PALETTE.panCanopy, 6);
    }
    // AND THE MOUNDS ARE SOLID, which the herd's own design note already
    // assumed: "a line off a trail cannot walk through the termite mound the
    // player just went round" — except the player went straight through it,
    // because ninety mounds had no collider between them. A mound is a metre
    // to three metres of concrete and it is the only rock in this chapter.
    panMoundAt.push(x, z, r);
    panPoolBox(bMound, x, h + r * 0.72, z, r * 0.72, r * 0.80, r * 0.72);
    if (++nMound >= 22) { panPoolDone(game, bMound); bMound = panPoolBody(game); nMound = 0; }
  }
  panPoolDone(game, bTree);
  panPoolDone(game, bMound);
  const mesh = new THREE.Mesh(M.build(), panVC());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);
}

/**
 * THE CAMPO WAS A LAWN, AND THAT IS THE BIGGEST THING WRONG WITH THIS CHAPTER.
 *
 * Eight hundred grass tufts over fifty-four thousand square metres is one tuft
 * every sixty-six metres: photographed from the standard rig at the dead tree,
 * the largest wetland on earth was a flat green plane with four cones on it.
 * Sydney and Pasto do not look like that and the difference is not modelling,
 * it is DENSITY and it is VARIETY — three kinds of thing at three heights, all
 * of them cheap, all of them placed by what the ground is doing rather than by
 * a uniform scatter.
 *
 *   REEDS, in the shallows only, in beds. The line where standing water meets
 *   grass is the most recognisable edge in this landscape and it had nothing
 *   drawn on it at all: the flood simply stopped.
 *   CARANDA, the fan palm, which is the tree the Pantanal is named for in
 *   every photograph of it — a bare grey pole with a starburst on top, dotted
 *   over open ground, and the only vertical thing for a kilometre.
 *   AND THE LIXEIRA BUSH, low and round, which is what fills the gap between
 *   knee-high grass and an eight-metre tree.
 */
function panBuildScrub(root) {
  // ---- the reed beds ------------------------------------------------------
  {
    const M = panMerger();
    // seven stems and three seed heads. A reed is a LINE, so it is thin, and
    // what makes a bed read is that they are all very slightly different
    // heights — a bed of identical reeds is a comb.
    // SEVEN STEMS ON QUADS, NOT THREE ON BOXES. A reed is 4.5 cm across: from
    // six metres up all four faces of a square-section box are the same line,
    // so twelve triangles were buying two. Seven stems for less than three
    // boxes cost, and a bed of seven reads as a BED rather than as a fork.
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + (i % 2) * 0.4;
      const rr = 0.16 + (i % 3) * 0.09;
      const hh = 1.35 + (i % 4) * 0.34;
      M.quad(Math.cos(a) * rr, hh * 0.5, Math.sin(a) * rr, 0.075, hh,
             i % 2 ? PALETTE.panReed : PALETTE.panGrassDk, (i % 3 - 1) * 0.06, a, (i % 2 ? 0.09 : -0.09));
      if (i % 3 === 0) {
        M.quad(Math.cos(a) * (rr + 0.09), hh + 0.16, Math.sin(a) * (rr + 0.09), 0.10, 0.34,
               PALETTE.panGrassDry, 0, a, 0.12);
      }
    }
    const N = 340;
    const mesh = new THREE.InstancedMesh(M.build(), panVCL(), N);
    mesh.frustumCulled = false;
    let n = 0;
    // WHERE THE WATER MEETS THE GRASS, and nowhere else. Reeds want their feet
    // wet and their heads dry, which is a band about forty centimetres deep —
    // so this is not a scatter with a filter on it, it is a scatter ALONG a
    // contour, and it draws every shoreline in the chapter for free.
    for (let i = 0; i < N * 14 && n < N; i++) {
      const x = rand(-122, 122), z = rand(-124, 100);
      const h = panBedH(x, z);
      const d = panWATER - h;
      if (d < -0.10 || d > 0.62) continue;
      if (panOnRoad(x, z) > 0) continue;
      // clumped: a reed bed is one rootstock and it spreads
      const s = rand(0.7, 1.35);
      panM.compose(panV3.set(x, Math.min(h, panWATER) - 0.1, z),
                   panQ.setFromEuler(panE.set(0, rand(0, 6.28), 0)),
                   panSc.set(s, rand(0.75, 1.5), s));
      mesh.setMatrixAt(n++, panM);
    }
    mesh.count = n;
    root.add(mesh);
  }
  // ---- THE BANKS OF THE CROSSING, AND THEY HAD NO SHAPE -------------------
  // The marquee of this chapter is taken from the middle of the river with the
  // camera at the waterline, and photographed from there the whole frame was
  // one flat olive plane: the gallery forest is set back sixteen metres and
  // there was nothing at all on the water's edge. A wall of reeds down both
  // banks gives the crossing SIDES — you can see where you came from and where
  // you are going, which is the entire difference between swimming a river and
  // swimming in a colour.
  {
    const M = panMerger();
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + (i % 2) * 0.35;
      const rr = 0.20 + (i % 3) * 0.12;
      const hh = 2.3 + (i % 4) * 0.62;
      M.quad(Math.cos(a) * rr, hh * 0.5, Math.sin(a) * rr, 0.10, hh,
             i % 2 ? PALETTE.panReed : PALETTE.panForest, (i % 3 - 1) * 0.05, a, (i % 2 ? 0.07 : -0.07));
      if (i % 2 === 0) {
        M.quad(Math.cos(a) * (rr + 0.10), hh + 0.22, Math.sin(a) * (rr + 0.10), 0.12, 0.46,
               PALETTE.panGrassDry, 0, a, 0.10);
      }
    }
    const N = 260;
    const mesh = new THREE.InstancedMesh(M.build(), panVCL(), N);
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    let n = 0;
    // ...but NOT across the crossing itself, which has to stay a gap you can
    // see through and walk down. A wall of reeds with no door in it is a wall.
    // AND A REED HAS ITS FEET IN THE SHALLOWS, NOT IN THE CHANNEL. `z1 + 0.4`
    // looks like the bank and is not: the river's blend runs to 1.6 half-widths,
    // so half a metre outside the nominal edge the bed is still three and a
    // half metres down and a four-metre reed drawn from it shows a foot of
    // itself. Measured from the crossing: the wall of reeds that is supposed to
    // give the marquee its SIDES was mostly under the river. Walk out from the
    // edge until the bed comes up into the band a reed actually grows in.
    for (let i = 0; i < N * 14 && n < N; i++) {
      const south = (i % 2) === 0;
      const x = rand(-105, 105);
      let z = south ? panRIVER.z0 : panRIVER.z1, h = 0, ok = false;
      for (let k = 0; k < 12; k++) {
        z = (south ? panRIVER.z0 - 0.4 : panRIVER.z1 + 0.4) + (south ? -1 : 1) * k * 0.9;
        h = panBedH(x, z);
        if (h > panWATER - 1.1) { ok = true; break; }
      }
      if (!ok || h > panWATER + 0.9) continue;
      z += (south ? -1 : 1) * rand(0, 2.6);
      h = panBedH(x, z);
      if (h < panWATER - 1.3 || h > panWATER + 1.1) continue;
      // ...and the gap is EIGHT metres, not thirteen. The crossing has to be
      // a door rather than a hole in a hedge: from the middle of the river the
      // frame wants a post either side of the way out, and at thirteen the
      // nearest reed was off the edge of the shot.
      if (Math.abs(x - panCROSS.x) < 8) continue;               // the crossing
      if (Math.abs(x - panRoadX(z)) < panROAD_W + 3) continue;  // and the road
      const s = rand(0.75, 1.4);
      panM.compose(panV3.set(x, h - 0.15, z),
                   panQ.setFromEuler(panE.set(0, rand(0, 6.28), 0)),
                   panSc.set(s, rand(0.8, 1.4), s));
      mesh.setMatrixAt(n++, panM);
    }
    mesh.count = n;
    root.add(mesh);
  }
  // ---- the caranda palms --------------------------------------------------
  {
    const M = panMerger();
    for (let i = 0; i < 54; i++) {
      // AND NOT ON TOP OF ANYTHING THE CHAPTER CARES ABOUT. The first cut
      // rejected the road and nothing else, and put a twelve-metre palm four
      // metres from the jabiru's tree — photographed, the shot of the nest was
      // a photograph of the inside of a trunk. Every landmark gets a keep-out.
      const keep = [[panNEST.x, panNEST.z, 14], [panPALM.x, panPALM.z, 12],
                    [panFAZENDA.x, panFAZENDA.z, 26], [panFAZENDA.x - 22, panFAZENDA.z, 18],
                    [panCROSS.x, panRIVER.z1, 16], [panOTTERS.x, panOTTERS.z, 14],
                    [panSPAWN.x, panSPAWN.z, 12]];
      let x, z, h, tries = 0, bad = true;
      while (bad && ++tries < 60) {
        x = rand(-118, 118); z = rand(-118, 96); h = panBedH(x, z);
        bad = h < panWATER + 0.1 || h > 2.4 || panOnRoad(x, z) > 0;
        for (let k = 0; !bad && k < keep.length; k++) {
          const dx = x - keep[k][0], dz = z - keep[k][1];
          if (dx * dx + dz * dz < keep[k][2] * keep[k][2]) bad = true;
        }
      }
      if (bad) continue;
      const th = rand(7, 12);
      M.cyl(x, h + th * 0.5, z, 0.30, th, PALETTE.panCaranda, 0, 0, 0, 6);
      // the collar of dead fronds hanging under the crown, which every caranda
      // has and which is the only reason the trunk is not a broom handle
      M.cone(x, h + th - 0.5, z, 0.85, 1.5, PALETTE.panDead, Math.PI, rand(0, 3), 0, 6);
      // THE STARBURST. Eleven fans radiating out and slightly down, and the
      // whole silhouette of the tree is in this loop.
      for (let k = 0; k < 11; k++) {
        const a = (k / 11) * Math.PI * 2;
        const dip = 0.30 + (k % 3) * 0.16;
        M.box(x + Math.cos(a) * 1.5, h + th + 0.35 - dip * 1.4, z + Math.sin(a) * 1.5,
              1.15, 0.09, 2.9, k % 2 ? PALETTE.panForest : PALETTE.panForestLt, dip, -a, 0);
      }
      panCaranda.push(x, z);
    }
    const mesh = new THREE.Mesh(M.build(), panVC());
    mesh.castShadow = true;
    root.add(mesh);
  }
  // ---- THE UNDERSTORY, AND A CAPÃO HAD NONE ------------------------------
  // The ground-colour pass makes the wooded islands read as islands from a
  // hundred metres, and the trunks make them read as woods from thirty — and
  // then you walk into one and it is a lawn with poles on it. What grows under
  // a capão is acuri palm at head height and bromeliad on the floor, and the
  // camera is ten metres up, so this is the storey it can actually see.
  {
    const M = panMerger();
    // a young acuri: a short pole and a starburst of fronds at 1.6 m, on quads
    M.cyl(0, 0.55, 0, 0.13, 1.1, PALETTE.panTrunkDk, 0, 0, 0, 4);
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      M.quad(Math.cos(a) * 0.62, 1.28 - (k % 3) * 0.13, Math.sin(a) * 0.62, 1.5, 0.34,
             k % 2 ? PALETTE.panForest : PALETTE.panForestLt, 0.42 + (k % 3) * 0.16, -a, 0);
    }
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + 0.6;
      M.quad(Math.cos(a) * 0.30, 0.30, Math.sin(a) * 0.30, 0.55, 0.55,
             PALETTE.panCanopy, 0.9, -a, 0);
    }
    const N = 210;
    const mesh = new THREE.InstancedMesh(M.build(), panVCL(), N);
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    let n = 0;
    for (let c = 0; c < panCAPOES.length && n < N; c++) {
      const cc = panCAPOES[c];
      const per = Math.round(cc.r * 1.5);
      for (let i = 0; i < per && n < N; i++) {
        const a = rand(0, Math.PI * 2), rr = Math.sqrt(Math.random()) * cc.r * 0.88;
        const x = cc.x + Math.cos(a) * rr, z = cc.z + Math.sin(a) * rr;
        const h = panBedH(x, z);
        if (h < panWATER + 0.15) continue;
        const s = rand(0.7, 1.5);
        panM.compose(panV3.set(x, h - 0.08, z), panQ.setFromEuler(panE.set(0, rand(0, 6.28), 0)),
                     panSc.set(s, rand(0.8, 1.4), s));
        mesh.setMatrixAt(n++, panM);
      }
    }
    // ...and down the gallery forest, which is the other wood in the chapter
    for (let i = 0; i < N * 6 && n < N; i++) {
      const x = rand(-118, 118);
      const z = i % 2 ? rand(panRIVER.z1 + 2, panRIVER.z1 + 15) : rand(panRIVER.z0 - 16, panRIVER.z0 - 3);
      const h = panBedH(x, z);
      if (h < panWATER + 0.15) continue;
      if (Math.abs(x - panRoadX(z)) < panROAD_W + 4) continue;
      if (Math.abs(x - panCROSS.x) < 10) continue;      // not across the way out
      const s = rand(0.7, 1.4);
      panM.compose(panV3.set(x, h - 0.08, z), panQ.setFromEuler(panE.set(0, rand(0, 6.28), 0)),
                   panSc.set(s, rand(0.8, 1.4), s));
      mesh.setMatrixAt(n++, panM);
    }
    mesh.count = n;
    root.add(mesh);
  }
  // ---- AND WHAT IS LYING ON THE CAMPO ------------------------------------
  // Fifty thousand square metres of it and the only things ON the ground were
  // grass and termite mounds. A dry-season Pantanal floor has fallen caranda
  // fronds all over it (they drop a whole whorl at a time), bleached branches,
  // and the bare scuffed patches where the cattle stand. All of it is flat,
  // all of it is two or three pieces, and it is the difference between ground
  // cover and a lawn with things standing on it.
  {
    const M = panMerger();
    for (let i = 0; i < 150; i++) {
      const x = rand(-115, 115), z = rand(-118, 98);
      const h = panBedH(x, z);
      if (h < panWATER + 0.2 || h > 3.0) continue;
      if (panOnRoad(x, z) > 0) continue;
      const a = rand(0, 3.14);
      if (i % 3 === 0) {
        // a dropped frond, lying on its face
        M.box(x, h + 0.05, z, 0.5, 0.07, rand(1.8, 3.0), PALETTE.panGrassDry, 0, a, 0);
        M.box(x + Math.sin(a) * 1.2, h + 0.06, z + Math.cos(a) * 1.2, 0.16, 0.09, 1.0,
              PALETTE.panDead, 0, a, 0);
      } else if (i % 3 === 1) {
        // a bleached branch
        M.cyl(x, h + 0.09, z, 0.09, rand(1.4, 3.2), PALETTE.panDead, Math.PI / 2, a, 0, 4);
        M.cyl(x + Math.sin(a) * 0.7, h + 0.10, z + Math.cos(a) * 0.7, 0.05, 0.9,
              PALETTE.panDead, Math.PI / 2 - 0.2, a + 0.8, 0, 4);
      } else {
        // a scuffed patch: bare silt, and the only place the campo shows its
        // own colour through
        M.box(x, h + 0.015, z, rand(1.6, 3.4), 0.03, rand(1.4, 2.8),
              i % 6 === 2 ? PALETTE.panMud : PALETTE.panSilt, 0, a, 0);
      }
    }
    const mesh = new THREE.Mesh(M.build(), panVC());
    mesh.receiveShadow = true;
    root.add(mesh);
  }
  // ---- the scrub ----------------------------------------------------------
  {
    const M = panMerger();
    // KNEE-HIGH, NOT SHOULDER-HIGH. The first cut ran to 2.1 scale on a
    // 1.24 m sphere — two and a half metres of dark green broccoli, bigger
    // than the capybara and darker than the gallery forest, which is the
    // opposite of what filler is for. A lixeira bush is a thing you can see
    // over.
    M.sph(0, 0.30, 0, 0.52, 0.30, 0.52, PALETTE.panForestLt, 6);
    M.sph(0.24, 0.22, -0.18, 0.36, 0.23, 0.36, PALETTE.panGrassDk, 6);
    const N = 230;
    const mesh = new THREE.InstancedMesh(M.build(), panVC(), N);
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    let n = 0;
    for (let i = 0; i < N * 8 && n < N; i++) {
      const x = rand(-120, 120), z = rand(-122, 98);
      const h = panBedH(x, z);
      if (h < panWATER + 0.35 || h > 2.6) continue;
      if (panOnRoad(x, z) > 0) continue;
      const s = rand(0.55, 1.30);
      panM.compose(panV3.set(x, h - 0.1, z), panQ.setFromEuler(panE.set(0, rand(0, 6.28), 0)),
                   panSc.set(s, rand(0.7, 1.15), s));
      mesh.setMatrixAt(n++, panM);
    }
    mesh.count = n;
    root.add(mesh);
  }
}

/**
 * THE GRASS, AND IT IS WAIST-HIGH ON A CAPYBARA.
 *
 * One InstancedMesh of eight hundred blades, which is what turns a green plane
 * into a place with a horizon in it. They are deliberately TALL — the point of
 * this chapter's ground is that the animal is IN it rather than on it.
 */
function panBuildGrass(root) {
  const M = panMerger();
  // A CLUMP OF SEVEN BLADES, NOT THREE POSTS. The first build was three boxes
  // nine centimetres thick and a metre tall, scattered: from six metres up they
  // read as a field of green fenceposts, which is exactly what a low-poly game
  // must not let its filler do. Thin, leaning, in tufts, and half again as
  // many of them.
  // FIVE BLADES, NOT SEVEN, AND EIGHT HUNDRED TUFTS, NOT TWELVE FIFTY. The
  // first build measured 172 550 triangles from the spawn point, of which the
  // grass was a hundred and five thousand — a third over the whole budget for
  // filler nobody looks at directly. Five reads the same and costs 48 000.
  // THREE BLADES, AND THE DENSITY COMES OUT OF THE INSTANCE COUNT INSTEAD.
  // Measured after the clumping went in: the campo went from 118 k triangles
  // to 270 k and the grass alone was 77 000 of it — more than the whole of
  // Pasto. A blade is a box whose two narrow faces nobody can see from six
  // metres up, so twelve triangles buys about four of read; three blades in a
  // tuft and fifty-seven per cent more tufts is denser ground cover for less
  // than the original cost.
  // ...AND FIVE QUADS, NOT THREE BOXES. See panG.quad: four of the six faces
  // of a 0.04 x 0.16 blade are four centimetres wide and edge-on from every
  // camera in this game, so a box costs twelve triangles to draw two. Five
  // blades on quads is TEN triangles a tuft against the thirty-six a
  // three-blade box tuft cost, which is where the density below is paid for.
  const bl = [[0, 0, 0.95, 0.10, 0.02], [0.15, 0.06, 0.80, 0.9, 0.22],
              [-0.14, 0.05, 0.86, -0.7, -0.19], [0.07, -0.14, 0.72, 2.1, 0.15],
              [-0.09, -0.12, 0.66, 3.6, -0.12]];
  for (let i = 0; i < bl.length; i++) {
    const b = bl[i];
    const c = i % 3 === 0 ? PALETTE.panReed : (i % 3 === 1 ? PALETTE.panGrassLt : PALETTE.panGrassDk);
    M.quad(b[0], b[2] * 0.5, b[1], 0.17, b[2], c, 0, b[3], b[4]);
  }
  // ...AND IT IS PUT DOWN IN CLUMPS. Eight hundred INDEPENDENT draws over
  // fifty-four thousand square metres is one tuft every sixty-six metres,
  // which from the standard rig is a bald green plane with a few green
  // fenceposts on it — the exact failure this function's own note warns about,
  // one level up. Two hundred and forty SEEDS, each with three to seven tufts
  // round it: the same eleven hundred matrices, in patches, with bare ground
  // between them, which is what grazed campo actually looks like and is the
  // only arrangement that reads as ground cover rather than as scatter.
  // ...AND THE TOTAL IS A BUDGET, NOT A TASTE. Measured per-mesh after the
  // clumping went in: the grass alone was 44 748 triangles of a chapter total
  // of 188 000, against a whole-game working budget of about 130 000 and a
  // Pasto that manages the same read for 98 000 of EVERYTHING. Nine hundred
  // seeds is still four times the effective density of the original scatter
  // and it costs less than the original scatter did.
  // ---- AND THE SEEDING LOOP NEVER GOT PAST ITS OWN CAP -------------------
  // `for (seed = 0; seed < N && n < N; seed++)` with three to seven tufts a
  // seed does not produce N seeds — it produces about N/4 of them, because the
  // INSTANCE counter and the SEED counter are the same number. The comment
  // above says "nine hundred seeds"; measured, the build laid down roughly
  // three hundred and fifty before it hit the ceiling and stopped, and every
  // one of those was a `rand()` over the whole map, so the campo came out at
  // thirty-four to sixty-nine tufts per sixteen hundred square metres — one
  // tuft every twenty-five to forty-five metres. From the standard rig that is
  // a bald green plane with a few green fenceposts on it, which is precisely
  // the failure this function's own note says it is here to prevent.
  //
  // Two changes. The seeds come off a JITTERED GRID rather than a scatter, so
  // they cannot pile up in one corner and cannot starve another (the same
  // argument as Manly's boulders); and the count is what the blade geometry
  // now affords — 4 600 tufts at ten triangles is 46 000, which is what 1 250
  // tufts at thirty-six cost before.
  // ---- AND THE CAP TRUNCATED IT GEOGRAPHICALLY -------------------------
  //
  // Third time on this loop, and the previous fix made the failure WORSE by
  // making it deterministic. The grid is 35 x 33 = 1,155 cells at four to
  // eight tufts each, which wants about 6,300 — against a ceiling of 4,600
  // tested inside all three loops. So the sweep filled cells in `gz` order
  // and then simply STOPPED, twenty-four rows in, and twenty-four rows of
  // seven metres is z = +42.
  //
  // Everything north of that line had no grass at all. That is the whole top
  // third of the chapter, and it contains the spawn (z = 62) and the fazenda
  // (z = 76) — so THE FIRST FRAME OF CHAPTER 15, and the approach to the only
  // building for eighty kilometres, were played on bald plaster, which is the
  // exact symptom this function's own note has been rewritten twice to
  // prevent. Photographed from the fazenda: six tufts in the entire frame.
  //
  // A cap must never be a `break` on a spatial sweep. The budget is spent PER
  // CELL instead — every cell gets its share whatever its index — and the pool
  // is sized for the whole grid, with mesh.count trimmed to what actually
  // survived the water, road and height rejections at the bottom.
  const X0 = -122, X1 = 122, Z0 = -126, Z1 = 104;
  const CELL = 7.0;
  const NX = Math.ceil((X1 - X0) / CELL), NZ = Math.ceil((Z1 - Z0) / CELL);
  const PER_LO = 3, PER_HI = 6;         // ~4.5 a cell over 1,155 cells
  const N = NX * NZ * PER_HI;           // the pool. n is what is used.
  const mesh = new THREE.InstancedMesh(M.build(), panVCL(), N + 220);
  mesh.frustumCulled = false;
  // 42,860 triangles of grass, and this line was undone four lines after the
  // build finished. See sysEnableShadows — noShadow is how a mesh says it means
  // it. A tuft's shadow is its own shadow acne and nothing else.
  mesh.castShadow = false;
  mesh.userData.noShadow = true;
  // ---- AND IT MOVES (v44) ------------------------------------------------
  // See THE WAKE in shared.js. This is the largest field of anything in the
  // game — four thousand tufts, waist-high on a capybara, and the whole point
  // of the chapter's ground is that the animal is IN it rather than on it.
  // Standing perfectly rigid in the wind was the one thing that gave it away
  // as scatter, and it is the single best wake target in the project: at
  // capybara height, everywhere the player walks.
  //
  // The blade quads are built at b[2]*0.5 with height b[2], so the tuft runs
  // from 0 to about 0.95 in its own frame — `auto` reads that rather than
  // being told it. A LOW amount, because grass this dense reads its motion in
  // the aggregate: a tenth of a metre across four thousand tufts is a field
  // breathing, and anything more is a wheat advert.
  swayMesh(mesh, { leaf: 0.6, amount: 0.10, axis: 'y', auto: true, stiff: 1.5, hz: 1.55 });
  let n = 0;
  {
    for (let gz = 0; gz < NZ; gz++) {
      for (let gx = 0; gx < NX; gx++) {
        const sx = X0 + (gx + 0.5) * CELL + rand(-2.6, 2.6);
        const sz = Z0 + (gz + 0.5) * CELL + rand(-2.6, 2.6);
        // ---- AND THE FAR CAMPO IS NOT THE VERGE ---------------------------
        // 4,249 tufts at ten triangles each was 42,860 — nineteen per cent of
        // the chapter — laid at one uniform density over fifty-six thousand
        // square metres, and the player is on the causeway or within a few
        // metres of it for almost all of this chapter. A tuft is a metre wide;
        // at forty metres it is three pixels and at a hundred it is one.
        //
        // So the density follows the ROAD, which is the only line through this
        // place, and thins going out. It is also what the campo actually looks
        // like — the verge of a cattle road is rank and the open pasture beyond
        // it is grazed short — so this buys the picture as well as the budget.
        // The far campo still has grass in it; it has less.
        const dRoad = Math.abs(sx - panRoadX(sz));
        const near = clamp(1 - (dRoad - 30) / 76, 0.34, 1);
        const per = Math.max(1, Math.round(randInt(PER_LO, PER_HI + 1) * near));
        for (let k = 0; k < per; k++) {
          const x = sx + rand(-3.1, 3.1), z = sz + rand(-3.1, 3.1);
          const h = panBedH(x, z);
          // ...AND THE FAZENDA IS NOT BALD. The cap was 2.2 m and the one
          // piece of real high ground in the chapter runs to 3.1, so the hill
          // everybody walks up — the only building for eighty kilometres, the
          // corral, the mango tree — stood on bare plaster. Grazed and dry up
          // there, which the ground mesh already paints; grazed pasture still
          // has grass in it.
          if (h < panWATER - 0.35 || h > 3.2) continue;
          if (panOnRoad(x, z) > 0) continue;
          const s = rand(0.8, 1.6);
          panM.compose(panV3.set(x, h - 0.06, z), panQ.setFromEuler(panE.set(0, rand(0, 6.28), 0)),
                       panSc.set(s, rand(0.75, 1.45), s));
          mesh.setMatrixAt(n++, panM);
        }
      }
    }
  }
  // ---- AND DOWN THE CROWN OF THE ROAD -----------------------------------
  // The strip between the wheel tracks that nothing drives on, which every
  // dirt road in the world grows a beard of and which is the cheapest way to
  // say "this is not tarmac". It grows THERE and nowhere else on the causeway,
  // which is what makes the ruts read as ruts.
  for (let z = -108; z < 94 && n < N + 220; z += 1.15) {
    let bridge = false;
    for (let i = 0; i < panBRIDGES.length; i++) {
      if (Math.abs(z - panBRIDGES[i].z) < panBRIDGES[i].len * 0.5 + 1) bridge = true;
    }
    if (bridge) continue;                         // nothing grows on a plank
    if (Math.random() < 0.34) continue;
    const x = panRoadX(z) + rand(-0.55, 0.55);
    const s = rand(0.4, 0.8);
    panM.compose(panV3.set(x, panROAD_Y - 0.04, z),
                 panQ.setFromEuler(panE.set(0, rand(0, 6.28), 0)),
                 panSc.set(s, rand(0.4, 0.75), s));
    mesh.setMatrixAt(n++, panM);
  }
  mesh.count = n;
  root.add(mesh);
}

/** The dead tree, the nest in it, and the mounds that are the way up. */
function panBuildNest(game, root) {
  const M = panMerger();
  const x = panNEST.x, z = panNEST.z;
  const h = panBedH(x, z);
  M.cyl(x, h + 6, z, 0.65, 12, PALETTE.panDead, 0, 0, 0, 6);
  panStaticBox(game, x, h + 6, z, 1.3, 12, 1.3);
  for (let i = 0; i < 5; i++) {
    const a = i * 1.26;
    M.box(x + Math.cos(a) * 1.8, h + 7 + i * 0.7, z + Math.sin(a) * 1.8, 3.6, 0.28, 0.28,
          PALETTE.panDead, 0, a, -0.22);
  }
  // THE STAIRS. Four termite mounds and a fallen branch, each a hop apart and
  // each 0.9 m up — the capybara steps 0.4 by itself and hops 1.4, so this is
  // a deliberate hop and nothing more. A ladder to a thing worth seeing must
  // be climbable by the verbs the player already has.
  const steps = [[3.6, 2.4, 0.95], [5.2, -1.0, 1.9], [1.6, -4.2, 2.85], [-2.6, -3.0, 3.8],
                 [-3.4, 1.2, 4.75], [-1.0, 4.4, 5.7]];
  for (let i = 0; i < steps.length; i++) {
    const sx = x + steps[i][0], sz = z + steps[i][1], sy = h + steps[i][2];
    M.cone(sx, sy - 0.5, sz, 1.5, 2.4, PALETTE.panTermite, 0, rand(0, 3), 0, 6);
    panStaticBox(game, sx, sy - 0.35, sz, 2.0, 0.7, 2.0);
  }
  // the nest itself: it is enormous, they use it for years, and it is a metre
  // and a half across
  const ny = h + 7.0;
  M.cyl(x, ny, z, 1.7, 0.9, PALETTE.panDead, 0, 0, 0, 8);
  M.cyl(x, ny + 0.5, z, 1.5, 0.3, PALETTE.panTrunk, 0, 0, 0, 8);
  panStaticBox(game, x, ny, z, 3.2, 1.0, 3.2);
  for (let i = 0; i < 14; i++) {
    M.box(x + rand(-1.6, 1.6), ny + rand(0.3, 0.7), z + rand(-1.6, 1.6), rand(1.4, 2.8), 0.1, 0.1,
          PALETTE.panDead, 0, rand(0, 3.14), rand(-0.2, 0.2));
  }
  // two chicks, and they are already the size of a goose
  for (let i = -1; i <= 1; i += 2) {
    M.sph(x + i * 0.5, ny + 0.9, z, 0.42, 0.46, 0.5, PALETTE.panHeron, 6);
    M.cyl(x + i * 0.5, ny + 1.5, z + 0.1, 0.13, 0.7, PALETTE.panHeron, 0.2, 0, 0, 6);
    M.cone(x + i * 0.5, ny + 1.8, z + 0.5, 0.11, 0.7, PALETTE.panJabiruHd, Math.PI / 2 + 0.3, 0, 0, 4);
  }
  // ---- AND THE OTHER PARENT, WHICH THE NEST HAS NEVER HAD ----------------
  // Two chicks, a nest a metre and a half across, and ONE adult — which is at
  // the foot of the tree stalking fish and takes a circuit every twenty-four
  // seconds, so for most of the chapter the task called 'look into the
  // jabiru's nest' is two chicks on their own at the top of a dead tree. A
  // tuiuiú pair splits it: one fishes, one stands on the rim with its bill
  // down its own chest and does not move for an hour. It is the difference
  // between a nest and a prop, it is the thing the guide's line about "two
  // chicks this year" is about, and it is fifty triangles that never move.
  {
    const ax = x - 1.05, az = z + 0.35;
    M.sph(ax, ny + 1.42, az, 0.34, 0.36, 0.62, PALETTE.panJabiru, 6);
    M.box(ax - 0.36, ny + 1.44, az - 0.05, 0.12, 0.5, 1.0, PALETTE.panJabiru, 0, 0, 0.1);
    M.box(ax + 0.36, ny + 1.44, az - 0.05, 0.12, 0.5, 1.0, PALETTE.panJabiru, 0, 0, -0.1);
    M.cyl(ax, ny + 1.84, az + 0.42, 0.13, 0.9, PALETTE.panJabiruNk, 0.5, 0, 0, 6);
    M.sph(ax, ny + 2.20, az + 0.72, 0.16, 0.16, 0.2, PALETTE.panJabiruHd, 6);
    // the bill DOWN, resting on its own chest, which is the pose a standing
    // stork holds for an hour at a time and is what makes it read as at rest
    M.cone(ax, ny + 1.86, az + 0.66, 0.09, 0.9, PALETTE.panJabiruHd, 0.55, 0, 0, 4);
    M.cyl(ax - 0.12, ny + 0.98, az, 0.05, 0.9, PALETTE.panJabiruHd, 0, 0, 0, 4);
    M.cyl(ax + 0.12, ny + 0.98, az, 0.05, 0.9, PALETTE.panJabiruHd, 0, 0, 0, 4);
  }
  const mesh = new THREE.Mesh(M.build(), panVC());
  mesh.castShadow = true;
  root.add(mesh);
}

/** The acuri palm, and the loudest birds in South America sitting in it. */
function panBuildPalm(game, root) {
  const M = panMerger();
  const x = panPALM.x, z = panPALM.z, h = panBedH(x, z);
  M.cyl(x, h + 5, z, 0.42, 10, PALETTE.panTrunk, 0, 0, 0, 6);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    M.box(x + Math.cos(a) * 2.6, h + 10 - 0.6, z + Math.sin(a) * 2.6, 0.9, 0.16, 5.6,
          i % 2 ? PALETTE.panForest : PALETTE.panForestLt, 0.3, -a, 0);
  }
  // the nuts, which is what the macaws are here for and what you are here for
  for (let i = 0; i < 7; i++) {
    const a = rand(0, 6.28);
    M.sph(x + Math.cos(a) * 1.2, h + 9.0, z + Math.sin(a) * 1.2, 0.28, 0.34, 0.28, PALETTE.panTrunkDk, 6);
  }
  panStaticBox(game, x, h + 5, z, 0.9, 10, 0.9);
  const mesh = new THREE.Mesh(M.build(), panVC());
  mesh.castShadow = true;
  root.add(mesh);
}

// -------------------------------------------------------- the floating meadow --
/**
 * CAMALOTE. Water hyacinth grows in mats big enough to stand on and not for
 * long, and it is genuinely how a lot of things get across a baia.
 *
 * Every mat is a kinematic body — mass 0, driven by VELOCITY and never by
 * assigning position, allowSleep false, because a sleeping body is skipped in
 * narrowphase and a floor that stops existing under a passenger is the worst
 * bug this game has. It sinks while it is loaded and comes back up when it is
 * not, and the whole task is the arithmetic of that: two and a half seconds a
 * mat, eleven mats, and you have to keep moving.
 */
function panBuildMats(game, root) {
  const M = panMerger();
  M.cyl(0, 0, 0, 0.5, 0.26, PALETTE.panHyacinth, 0, 0, 0, 8);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    M.sph(Math.cos(a) * 0.32, 0.14, Math.sin(a) * 0.32, 0.17, 0.12, 0.17, PALETTE.panLily, 6);
  }
  M.sph(0, 0.16, 0, 0.2, 0.13, 0.2, PALETTE.panForest, 6);
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1;
    M.sph(Math.cos(a) * 0.22, 0.28, Math.sin(a) * 0.22, 0.075, 0.13, 0.075, PALETTE.panHyaFlower, 6);
  }
  panMatMesh = new THREE.InstancedMesh(M.build(), panVC(), panMAT_N);
  panMatMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  panMatMesh.castShadow = true;
  panMatMesh.frustumCulled = false;
  root.add(panMatMesh);

  // A LINE OF THEM ACROSS THE BAIA, because a scatter is a puzzle and a line is
  // an invitation. From the eastern shore to the western, six to nine metres
  // apart — inside a hop from the edge of one to the edge of the next.
  panMats.length = 0;
  for (let i = 0; i < panMAT_N; i++) {
    const t = i / (panMAT_N - 1);
    const x = lerp(panBAIA.x + panBAIA.r - 4, panBAIA.x - panBAIA.r + 4, t);
    const z = panBAIA.z + Math.sin(t * 3.1) * 9 + rand(-1.5, 1.5);
    const r = rand(3.0, 4.4);
    const b = new CANNON.Body({
      mass: 0, type: CANNON.Body.KINEMATIC,
      material: (game.mats && game.mats.ground) || undefined,
    });
    // A BOX, NOT A CYLINDER. cannon-es orients a Cylinder along its own axis
    // and which axis that is has changed between versions; a mat that is solid
    // on its side instead of its top is a floor that is not there.
    b.addShape(new CANNON.Box(new CANNON.Vec3(r * 0.74, 0.25, r * 0.74)));
    b.position.set(x, panWATER + 0.06, z);
    b.allowSleep = false;
    panSyncBody(b);
    game.world.addBody(b);
    panMats.push({ x: x, z: z, r: r, y: panWATER + 0.06, target: panWATER + 0.06,
                   load: 0, body: b, idx: i });
  }
}

/**
 * THE CAMALOTE COMING DOWN THE RIVER. See the note on panRAFT_N.
 *
 * Seventy-two triangles apiece: a flat pad of leaves, three of the bulbous
 * stalks that make hyacinth read as hyacinth from above, and one lilac flower.
 * Nothing about them is solid — you swim straight through — because the mats
 * you can STAND on are the ones in the baia and confusing the two would break
 * the one task in the chapter that is about which is which.
 */
function panBuildRafts(root) {
  const M = panMerger();
  // the rosette at the waterline...
  M.cyl(0, 0.03, 0, 0.36, 0.08, PALETTE.panHyacinth, 0, 0, 0, 6);
  // ...and the four round leaves standing up out of it, which is the only part
  // of a hyacinth anybody can name and the only part that reads from above
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    M.box(Math.cos(a) * 0.19, 0.20, Math.sin(a) * 0.19, 0.24, 0.30, 0.17,
          i % 2 ? PALETTE.panForestLt : PALETTE.panLily, 0.16, -a, 0);
  }
  M.box(0, 0.36, 0, 0.11, 0.26, 0.11, PALETTE.panHyaFlower);
  panRaftMesh = new THREE.InstancedMesh(M.build(), panVC(), panRAFT_N);
  panRaftMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  panRaftMesh.castShadow = true;
  panRaftMesh.frustumCulled = false;
  panRaftReset();
  root.add(panRaftMesh);
}

/** Lay them out: a stream of drifters and a jam on the bar. Also on re-entry. */
function panRaftReset() {
  const cz = (panRIVER.z0 + panRIVER.z1) * 0.5;
  for (let i = 0; i < panRAFT_N; i++) {
    // A CLUMP OF HYACINTH IS KNEE-HIGH AND ABOUT A METRE ACROSS. The first cut
    // ran to 4.2 on a unit disc a metre wide, and photographed against the
    // sandbar they read as VICTORIA PADS — the one plant in the chapter that
    // is already drawn, twenty metres away, at exactly that size.
    panRaftS[i] = rand(0.70, 1.85);
    panRaftP[i] = rand(0, 6.28);
    if (i < panRAFT_JAM) {
      // AGAINST THE UPSTREAM FACE OF THE BAR. The flow runs toward +x, so a
      // mat coming down the river fetches up on the WEST side of the sandbar
      // and everything behind it stacks on that.
      const t = (i / panRAFT_JAM) * 2 - 1;
      panRaftX[i] = panSANDBAR.x - 11.0 - Math.abs(t) * 3.6 + rand(-2.2, 1.4);
      panRaftZ[i] = panSANDBAR.z + t * 8.5 + rand(-1.4, 1.4);
    } else {
      panRaftX[i] = rand(-108, 108);
      // clustered toward the middle of the stream, because that is where the
      // water is going fastest and a raft is a thing the current has sorted
      panRaftZ[i] = cz + (rand(-1, 1) + rand(-1, 1)) * 7.5;
    }
  }
}

// --------------------------------------------------------------- the herd --
function panBuildHerd(root) {
  // ONE MESH FOR NINE CAPYBARAS. They are the same animal as the player and
  // they must READ as the same animal — the whole point of the chapter is that
  // nobody here is remarkable — so this is deliberately the same silhouette:
  // a loaf with a blunt head on the front of it and no neck to speak of.
  const M = panTwin(0.4);   // the snout rounded on the twin (AAA pass)
  M.sph(0, 0.46, 0, 0.42, 0.40, 0.72, PALETTE.panCapy, 6);
  M.sph(0, 0.56, 0.62, 0.29, 0.27, 0.34, PALETTE.panCapy, 6);
  M.box(0, 0.70, 0.86, 0.30, 0.20, 0.22, PALETTE.panCapyDk);
  M.sph(-0.20, 0.76, 0.60, 0.09, 0.09, 0.09, PALETTE.panCapyDk, 6);
  M.sph(0.20, 0.76, 0.60, 0.09, 0.09, 0.09, PALETTE.panCapyDk, 6);
  // ---- THE LEGS COME OFF THE BODY (D8) -----------------------------------
  // They used to be four more cylinders merged into the mesh above, which means
  // they were welded to the torso and could never move: the whole animation of
  // nine capybaras was a fixed 8 rad/s bob, so the chapter's own marquee shot —
  // a line of your own kind following you into a river — was nine loaves
  // sliding across the flood. The roadmap called them legless and it was right
  // about what they read as.
  //
  // Two more instanced meshes, one per PAIR, each with its origin at that
  // pair's hip line so the whole pair swings about it. Two rather than four
  // because at the six metres this chapter is played at a trot and a walk are
  // the same silhouette, and four would be four draw calls to say it.
  //
  // Cost: two draw calls in one chapter, nine instances each.
  const LF = panMerger(), LR = panMerger();
  for (let s = -1; s <= 1; s += 2) {
    // Local origin is the hip: the cylinder hangs from y 0 down to -0.34.
    LF.cyl(s * 0.26, -0.17, 0, 0.09, 0.34, PALETTE.panCapyDk, 0, 0, 0, 4);
    LR.cyl(s * 0.26, -0.17, 0, 0.09, 0.34, PALETTE.panCapyDk, 0, 0, 0, 4);
  }
  panHerdMesh = new THREE.InstancedMesh(M.build(), panVC(), panHERD_N);
  panHerdMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  panHerdMesh.castShadow = true;
  panHerdMesh.frustumCulled = false;
  panHerdLegF = new THREE.InstancedMesh(LF.build(), panVC(), panHERD_N);
  panHerdLegR = new THREE.InstancedMesh(LR.build(), panVC(), panHERD_N);
  for (const m of [panHerdLegF, panHerdLegR]) {
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.castShadow = true;
    m.frustumCulled = false;
    root.add(m);
  }
  const ca = new Float32Array(panHERD_N * 3);
  panHerd.length = 0;
  // Scattered where the first thing you meet coming down the road is four of
  // them standing in the water, entirely unbothered.
  const spots = [[-14, 34], [-9, 30], [-17, 27], [-6, 24], [8, 40],
                 [-24, 40], [12, 20], [-3, 44], [-20, 18]];
  for (let i = 0; i < panHERD_N; i++) {
    panHerd.push({ x: spots[i][0], z: spots[i][1], yaw: rand(0, 6.28), st: 'graze',
                   order: -1, ph: rand(0, 6.28), vy: 0, y: 0, restT: rand(0, 6),
                   tx: spots[i][0], tz: spots[i][1],
                   // where it was PUT. A grazer never leaves this by more than
                   // about fourteen metres — see the note in panUpdateHerd.
                   hx: spots[i][0], hz: spots[i][1], rip: rand(0, 1),
                   // the answering call and the look that goes with it. See panWheek.
                   reply: 0, replyP: 1.2, look: 0 });
    // three of them are young, and the difference is only in the size
    const young = (i === 6 || i === 8);
    panCol.set(young ? PALETTE.panCapyPup : PALETTE.panCapy);
    ca[i * 3] = panCol.r; ca[i * 3 + 1] = panCol.g; ca[i * 3 + 2] = panCol.b;
  }
  panHerdMesh.instanceColor = new THREE.InstancedBufferAttribute(ca, 3);
  // The SAME array on the legs. instanceColor multiplies the vertex colour, so
  // three meshes sharing one tint is the only way a young one's legs stay the
  // same animal as its body — and it costs nothing, because it is one buffer.
  panHerdLegF.instanceColor = new THREE.InstancedBufferAttribute(ca, 3);
  panHerdLegR.instanceColor = new THREE.InstancedBufferAttribute(ca, 3);
  root.add(panHerdMesh);
  panRoundOn(panHerdMesh);
}

// ------------------------------------------------------------- the jacares --
function panBuildCaimans(game, root) {
  const M = panTwin(0.4);   // and a rounded twin (AAA pass): a caiman, not a stack of planks
  // A jacare is a very long flat thing with a ridge down it, and from six
  // metres up the only readable parts of it are the SNOUT and the tail.
  M.box(0, 0.16, 0, 0.62, 0.28, 1.9, PALETTE.panCaiman);
  M.box(0, 0.26, 0.15, 0.44, 0.2, 1.4, PALETTE.panCaimanDk);
  M.box(0, 0.13, 1.28, 0.36, 0.2, 0.95, PALETTE.panCaiman);
  M.box(0, 0.19, 1.6, 0.3, 0.1, 0.4, PALETTE.panCaimanDk);
  M.sph(-0.13, 0.28, 1.02, 0.07, 0.07, 0.07, PALETTE.panCaimanPl, 6);
  M.sph(0.13, 0.28, 1.02, 0.07, 0.07, 0.07, PALETTE.panCaimanPl, 6);
  for (let i = 0; i < 5; i++) {
    M.cone(0, 0.30, -0.6 + i * 0.36, 0.09, 0.18, PALETTE.panCaimanDk, 0, 0, 0, 4);
  }
  M.box(0, 0.1, -1.4, 0.3, 0.16, 1.2, PALETTE.panCaiman, 0, 0, 0);
  M.box(0, 0.08, -2.2, 0.2, 0.12, 0.9, PALETTE.panCaimanDk);
  for (let i = 0; i < 4; i++) {
    M.box((i < 2 ? -0.42 : 0.42), 0.09, (i % 2 ? -0.4 : 0.5), 0.5, 0.14, 0.22,
          PALETTE.panCaimanDk, 0, (i < 2 ? -0.5 : 0.5), 0);
  }
  // THE GAPE, on its own instance offset so it can open. A jacare has no sweat
  // glands and cannot pant, so on a hot afternoon it lies with its mouth wide
  // open and does nothing else at all — which is both the real behaviour and
  // the only animation this animal is ever going to need.
  panCaimans = new THREE.InstancedMesh(M.build(), panVC(), panCAIMAN_N);
  panCaimans.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  panCaimans.castShadow = true;
  panCaimans.frustumCulled = false;
  panCaimanAt.length = 0;
  // ONE COMPOUND BODY FOR ALL FOURTEEN. A jacare is 3.4 m long, 60 cm wide and
  // 30 cm high: too tall to step over and far too big to read as scenery, and
  // it was a hologram. It is also the reason 'sit on a sleeping jacare' could
  // be ticked by walking PAST one — with nothing solid there, the height test
  // was satisfied by simply standing on the sandbar beside it.
  panCaimanBody = panPoolBody(game);
  for (let i = 0; i < panCAIMAN_N; i++) {
    // ON A BANK, NOT IN OPEN WATER. `x = rand(-90, 90)` on the river's z put
    // half of them in the middle of the channel, where a two-and-a-half-metre
    // hole in the bed means `max(bed, WATER - 0.1)` floats them dead flat on
    // the surface out in the stream. A jacare hauls out on MUD, so the retry
    // walks north or south until the ground comes back up to meet it.
    let x, z, h, tries = 0;
    // ---- THE HAUL-OUT IS A LINE, NOT A HEAP -----------------------------
    // Eight three-and-a-half-metre animals dropped by `rand(-11, 11)` by
    // `rand(-4, 4)` into a patch twenty-two metres by eight is eight bodies in
    // about twice their own area: photographed from the river the sandbar was
    // a PILE of jacarés lying across each other, which is the one thing a
    // jacaré never does. They haul out along the water's edge, evenly spaced
    // at about a body width, all of them pointing much the same way — which is
    // the same lesson as sixty penguins scattered independently of eighty
    // nests. Populated is not arranged.
    if (i < 8) {
      const t = (i / 7) * 2 - 1;                       // -1 .. +1 along the bar
      x = panSANDBAR.x + t * 6.4 + rand(-0.6, 0.6);
      // ...along the two long edges of the plateau, alternately, and the bar
      // is an ellipse so the edge moves with x. `sd` in panBedH is
      // hypot(dx, dz * sqrt(2.2)), and the top is flat out to 0.55 r.
      const q = (t * 6.4) / panSANDBAR.r;
      const room = Math.sqrt(Math.max(0, 0.55 * 0.55 - q * q)) * panSANDBAR.r / 1.483;
      z = panSANDBAR.z + (i % 2 ? 1 : -1) * room * rand(0.70, 0.95);
      // ...and all of them pointing much the same way, which is DOWN the bar
      const yaw0 = (i % 2 ? -1 : 1) * (1.45 + rand(-0.28, 0.28));
      const y0 = Math.max(panBedH(x, z), panWATER - 0.1);
      panCaimanAt.push({ x: x, z: z, y: y0, y0: y0, yaw: yaw0, yaw0: yaw0,
                         gape: 0, gapeT: rand(0, 14), slide: 0, ph: rand(0, 6.28) });
      panPoolBox(panCaimanBody, x, y0 + 0.16, z, 0.60, 0.16, 1.6, yaw0);
      panM.compose(panV3.set(x, y0, z),
                   panQ.setFromEuler(panE.set(0, yaw0, 0)), panSc.set(1, 1, 1));
      panCaimans.setMatrixAt(i, panM);
      continue;
    }
    do {
      {
        x = rand(-90, 90);
        const s = i % 2 ? 1 : -1;
        z = (i % 2 ? panRIVER.z1 : panRIVER.z0) + s * (0.5 + tries * 1.1);
      }
      h = panBedH(x, z);
    } while (h < panWATER - 0.15 && ++tries < 20);
    const yaw = rand(0, 6.28);
    const y = Math.max(h, panWATER - 0.1);
    panCaimanAt.push({ x: x, z: z, y: y, y0: y, yaw: yaw, yaw0: yaw,
                       gape: 0, gapeT: rand(0, 14), slide: 0, ph: rand(0, 6.28) });
    // the back is 28 cm off the ground and 3.4 m long: a low, wide step, which
    // is exactly what you want a thing you are meant to climb onto to be
    // 0.92 m ACROSS THE BACK, not 0.72. Measured: a capybara has a 0.34 m
    // capsule and dropped onto a 72 cm back it rolls straight off — three
    // drops, three landings 2.3 m away on the sand. A jacare's back is not
    // really that wide; a thing the game asks you to stand on has to be.
    panPoolBox(panCaimanBody, x, y + 0.16, z, 0.60, 0.16, 1.6, yaw);
    panM.compose(panV3.set(x, y, z),
                 panQ.setFromEuler(panE.set(0, yaw, 0)), panSc.set(1, 1, 1));
    panCaimans.setMatrixAt(i, panM);
  }
  panPoolDone(game, panCaimanBody);
  // the bounding box panCaimanTop rejects against, computed once from where
  // they actually ended up rather than from where they were meant to go
  panCaimanBB.x0 = 1e9; panCaimanBB.x1 = -1e9;
  panCaimanBB.z0 = 1e9; panCaimanBB.z1 = -1e9;
  for (let i = 0; i < panCaimanAt.length; i++) {
    const c = panCaimanAt[i];
    if (c.x - 2 < panCaimanBB.x0) panCaimanBB.x0 = c.x - 2;
    if (c.x + 2 > panCaimanBB.x1) panCaimanBB.x1 = c.x + 2;
    if (c.z - 2 < panCaimanBB.z0) panCaimanBB.z0 = c.z - 2;
    if (c.z + 2 > panCaimanBB.z1) panCaimanBB.z1 = c.z + 2;
  }
  panCaimans.instanceMatrix.needsUpdate = true;
  root.add(panCaimans);
  panRoundOn(panCaimans);
}

/**
 * THE RIPPLES, AND THE WHOLE CHAPTER IS ABOUT A MIRROR.
 *
 * A third of this map is under two inches of water and the module's own note
 * says the recognisable thing about the place is that it throws the sky back
 * at you. Nothing had ever disturbed it. Every capybara in the chapter — the
 * player, the nine in the herd — now drags a wake of expanding rings behind it
 * wherever it is walking through the shallows, and the anteater does too.
 *
 * Rationed hard, for the reason Manly's spray had to be: a ring every frame is
 * a bathtub, not a wetland.
 */
function panBuildRipples(root) {
  const g = new THREE.RingGeometry(0.72, 1.0, 20, 1);
  g.rotateX(-Math.PI / 2);
  panRipMat = mat(PALETTE.panWaterLit, {
    transparent: true, opacity: 0.34, depthWrite: false, side: THREE.DoubleSide,
  }).clone();
  panRipMesh = new THREE.InstancedMesh(g, panRipMat, panRIP_N);
  panRipMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  panRipMesh.frustumCulled = false;
  panRipMesh.renderOrder = 3;
  for (let i = 0; i < panRIP_N; i++) {
    panRipT[i] = 1e9;
    panM.compose(panV3.set(0, -900, 0), panQ.setFromEuler(panE.set(0, 0, 0)), panSc.set(0.01, 0.01, 0.01));
    panRipMesh.setMatrixAt(i, panM);
  }
  panRipMesh.instanceMatrix.needsUpdate = true;
  root.add(panRipMesh);
}
function panRipple(x, z, s) {
  if (!panRipMesh) return;
  const i = panRipHead;
  panRipHead = (panRipHead + 1) % panRIP_N;
  panRipX[i] = x; panRipZ[i] = z; panRipT[i] = 0; panRipS[i] = s;
}

/**
 * THE INSECTS. Ninety of them, one draw call, and they are the difference
 * between a wetland and a lawn.
 *
 * Two kinds on one mesh: a dragonfly, which hangs in the air over open water
 * and DARTS, and a firefly, which does not exist at all until the sun goes
 * down. See the ambient-mover rules — the reason this is not an irritation is
 * that it never crosses the middle of the frame and never makes a sound.
 */
function panBuildBugs(root) {
  const M = panMerger();
  M.box(0, 0, 0, 0.05, 0.05, 0.34, PALETTE.panCowbird);
  M.box(0, 0.04, 0.04, 0.36, 0.012, 0.11, PALETTE.panWaterLit, 0, 0.2, 0);
  M.box(0, 0.04, -0.04, 0.32, 0.012, 0.10, PALETTE.panWaterLit, 0, -0.2, 0);
  panBugs = new THREE.InstancedMesh(M.build(), panVC(), panBUG_N);
  panBugs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  panBugs.frustumCulled = false;
  const cc = new Float32Array(panBUG_N * 3);
  panBugData = new Float32Array(panBUG_N * 6);   // x, z, y, ang, r, spd
  for (let i = 0; i < panBUG_N; i++) {
    const o = i * 6;
    // A THIRD OF THE FIREFLIES ARE ROUND A TREE, because that is what they do.
    // The synchronous fireflies of the Pantanal gather on a landmark tree and
    // flash together, and the caranda palms are the only landmark trees on
    // open campo — which is also the reason panBuildScrub keeps a list of
    // where it put them. Dusk therefore does not merely add insects to the
    // whole map, it lights up the six things you have been navigating by.
    let x, z, tries = 0;
    if (i % 3 === 0 && panCaranda.length && i % 2 === 0) {
      const k = (i / 6 | 0) % (panCaranda.length / 2) * 2;
      x = panCaranda[k] + rand(-7, 7);
      z = panCaranda[k + 1] + rand(-7, 7);
    } else {
      do { x = rand(-100, 100); z = rand(-105, 92); } while (panBedH(x, z) > 1.9 && ++tries < 12);
    }
    panBugData[o] = x; panBugData[o + 1] = z;
    panBugData[o + 2] = rand(0.5, 2.4);
    panBugData[o + 3] = rand(0, 6.28);
    panBugData[o + 4] = rand(1.5, 6);
    panBugData[o + 5] = rand(0.5, 1.9) * (i % 2 ? 1 : -1);
    panCol.set(i % 3 === 0 ? PALETTE.panFirefly : PALETTE.panMacaw);
    cc[i * 3] = panCol.r; cc[i * 3 + 1] = panCol.g; cc[i * 3 + 2] = panCol.b;
  }
  panBugs.instanceColor = new THREE.InstancedBufferAttribute(cc, 3);
  root.add(panBugs);
}

/**
 * THE EGRETS, AND THEY ONLY EVER FLY ONCE.
 *
 * A line of white birds low over flooded grass with the sun behind them is THE
 * photograph of this place, and a chapter that ends at sundown should get it —
 * once, when the herd goes into the river, from left to right across the whole
 * width of the frame, and never again. A thing that happens every forty seconds
 * is scenery; a thing that happens once is a memory.
 */
function panBuildEgrets(root) {
  const M = panMerger();
  M.sph(0, 0, 0, 0.16, 0.15, 0.44, PALETTE.panEgret, 6);
  M.sph(0, 0.06, 0.34, 0.11, 0.11, 0.14, PALETTE.panEgret, 6);
  M.cone(0, 0.05, 0.54, 0.045, 0.30, PALETTE.panMacawYel, Math.PI / 2, 0, 0, 4);
  M.box(0, -0.02, -0.42, 0.10, 0.05, 0.42, PALETTE.panEgret);
  for (let s = -1; s <= 1; s += 2) {
    M.box(s * 0.44, 0.03, 0, 0.80, 0.035, 0.26, PALETTE.panEgret, 0, s * 0.18, s * 0.10);
  }
  panEgrets = new THREE.InstancedMesh(M.build(), panVC(), panEGRET_N);
  panEgrets.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  panEgrets.frustumCulled = false;
  panEgrets.castShadow = true;
  panEgrets.visible = false;
  root.add(panEgrets);

  // ---- AND A SECOND MODEL, BECAUSE A STANDING HERON IS NOT A FLYING ONE --
  //
  // The flight model above is authored horizontal: a 0.88 m body lying along
  // z with a metre and a half of wing either side of it and NO LEGS, because a
  // flying bird has its legs trailed. The waiting pose reused it, squeezed to
  // 48 % in x — and photographed from the crossing, which is the one camera
  // this whole set piece exists for, thirteen egrets were lying flat on the
  // river like paper aeroplanes. It is the same failure as the gentoo pitched
  // ninety degrees into a field of birds having a nap: you cannot get a
  // standing bird out of a flying one with a scale.
  //
  // So this is its own mesh — sixty triangles, thirteen instances, one draw
  // call — and it is what a great egret waiting in the shallows actually is:
  // a vertical body on two very long legs, the neck folded into an S so the
  // head sits back over the shoulders, and the wings CLOSED along the flank.
  const S = panTwin(0.4);   // tail, wings and neck rounded on the twin (AAA pass)
  for (let s = -1; s <= 1; s += 2) {
    S.box(s * 0.055, 0.30, 0, 0.035, 0.60, 0.035, PALETTE.panJabiruHd);   // the legs
    S.box(s * 0.055, 0.02, 0.05, 0.05, 0.03, 0.14, PALETTE.panJabiruHd);  // and the feet
  }
  S.sph(0, 0.74, -0.02, 0.13, 0.22, 0.19, PALETTE.panEgret, 6);           // the body
  S.box(0, 0.60, -0.20, 0.10, 0.30, 0.16, PALETTE.panEgret, 0.5);         // the tail, drooped
  for (let s = -1; s <= 1; s += 2) {                                      // the folded wings
    S.box(s * 0.115, 0.74, -0.03, 0.045, 0.34, 0.30, PALETTE.panEgret, 0.10, 0, s * 0.05);
  }
  S.box(0, 0.98, 0.02, 0.075, 0.24, 0.075, PALETTE.panEgret, -0.45);      // the neck, folded
  S.sph(0, 1.11, 0.10, 0.07, 0.075, 0.09, PALETTE.panEgret, 6);           // the head
  S.cone(0, 1.09, 0.26, 0.035, 0.26, PALETTE.panMacawYel, Math.PI / 2 + 0.18, 0, 0, 4);
  panEgretStand = new THREE.InstancedMesh(S.build(), panVC(), panEGRET_N);
  panEgretStand.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  panEgretStand.frustumCulled = false;
  panEgretStand.castShadow = true;
  root.add(panEgretStand);
  panRoundOn(panEgretStand);
}

/**
 * THE CROSSING, AND IT IS THE ONE PLACE IN THIS CHAPTER WITH NOTHING IN IT.
 *
 * Chapter 15's marquee is swum: the lens at the waterline, in the stream, four
 * of your own kind behind you, and the light going. Photographed from that
 * camera the entire frame was ONE FLAT OLIVE PLANE — the reeds are set back on
 * the banks, the gallery forest is sixteen metres behind them, and between the
 * two banks there was not a single object at eye level for twenty-four metres
 * of swimming. A shot with nothing in the middle distance has no scale, no
 * speed and no depth, and this is the shot the chapter is built around.
 *
 * So the crossing gets what a Pantanal river crossing actually has in it:
 * SNAGS. Trees come down off an undercut bank every wet season and lie there
 * half in the water for years, hyacinth piles up against them, and there is a
 * bird standing on every one. Eleven of them down the swim line, four metres
 * either side of the middle so the way through stays open — and they are also
 * where the egrets stand, which is the other half of this: a wading bird
 * cannot stand on four and a half metres of channel and until now thirteen of
 * them were doing exactly that.
 *
 * Nothing here is solid. You swim past a snag, not into it — a collider in
 * the middle of the one crossing the chapter is for is a wall across the
 * marquee.
 */
const panSnagAt = [];                 // x, y(top), z per snag — the egrets read it
function panBuildCrossing(game, root) {
  const M = panMerger();
  panSnagAt.length = 0;
  const cz1 = panRIVER.z1, cz0 = panRIVER.z0;
  for (let i = 0; i < 11; i++) {
    const t = i / 10;
    const z = cz1 - 2.0 - t * (cz1 - cz0 - 4.0);
    // alternating sides, and never closer than 2.6 m to the line the herd
    // swims down: the snags FRAME the crossing, they do not block it
    const sd = i % 2 ? 1 : -1;
    const x = panCROSS.x + sd * (2.9 + (i % 3) * 1.7 + rand(-0.5, 0.5));
    const a = rand(0, Math.PI);
    const ln = rand(2.4, 4.4);
    // THE TRUNK, AND MOST OF IT IS UNDER THE WATER. The first cut lay a 0.24 m
    // cylinder up to seven metres long flat on the surface in `panDead`, which
    // is 0xb6a894 — three stops brighter than the river — and photographed
    // from the crossing the marquee had eleven pale scaffold planks floating
    // in it. A snag shows a HAND'S BREADTH of itself and the rest is a dark
    // shape in the water; it is dark, it is short, and it lies at an angle.
    M.cyl(x, panWATER - 0.09, z, 0.20, ln, PALETTE.panTrunkDk, Math.PI / 2 - 0.10, a, 0, 6);
    M.cyl(x + Math.sin(a) * ln * 0.30, panWATER + 0.11, z + Math.cos(a) * ln * 0.30,
          0.15, ln * 0.5, PALETTE.panTrunk, Math.PI / 2 - 0.30, a, 0, 6);
    // the stub of a broken limb, which is what an egret is actually standing on
    {
      const b = a + (i % 2 ? 1.1 : -0.9);
      M.cyl(x + Math.sin(b) * 0.55, panWATER + 0.18, z + Math.cos(b) * 0.55,
            0.09, rand(0.9, 1.6), PALETTE.panTrunk, Math.PI / 2 - 0.55, b, 0, 4);
    }
    // hyacinth piled on the upstream face of it — the flow runs toward +x
    for (let k = 0; k < 5; k++) {
      const hx = x - 0.9 - k * 0.42 + rand(-0.4, 0.4);
      const hz = z + rand(-1.5, 1.5);
      M.cyl(hx, panWATER + 0.03, hz, 0.34, 0.10, PALETTE.panHyacinth, 0, 0, 0, 6);
      M.sph(hx + rand(-0.2, 0.2), panWATER + 0.16, hz + rand(-0.2, 0.2),
            0.17, 0.13, 0.17, k % 2 ? PALETTE.panLily : PALETTE.panForestLt, 6);
      if (k === 2) {
        M.box(hx, panWATER + 0.30, hz, 0.09, 0.22, 0.09, PALETTE.panHyaFlower);
      }
    }
    panSnagAt.push(x + Math.sin(a) * rand(-0.7, 0.7), panWATER + 0.34,
                   z + Math.cos(a) * rand(-0.7, 0.7));
  }
  // ---- AND THE TWO BANKS, so the shot has a top and a bottom -------------
  // A big tree half off the near bank on the way in, and two worn posts at the
  // landing — the one thing on that slot of bare silt that says a hundred
  // capybaras a night come up it.
  {
    const bx = panCROSS.x + 9.5;
    const bh = panBedH(bx, cz1 + 1);
    M.cyl(bx, panWATER + 0.35, cz1 - 2.5, 0.50, 9.5, PALETTE.panTrunkDk, Math.PI / 2 - 0.14, 0.35, 0, 6);
    M.cyl(bx + 1.4, Math.max(bh, panWATER) + 1.1, cz1 + 1.4, 0.5, 2.4, PALETTE.panTrunk, 0.5, 0, 0, 6);
    for (let k = 0; k < 5; k++) {
      const a = k * 1.26;
      M.cyl(bx + Math.sin(a) * 1.6, panWATER + 1.0 + (k % 2) * 0.5, cz1 - 2.5 + Math.cos(a) * 1.6,
            0.13, rand(1.8, 3.2), PALETTE.panDead, rand(0.9, 1.5), a, 0, 4);
    }
  }
  for (let s = -1; s <= 1; s += 2) {
    const px = panCROSS.x + s * 5.5;
    const ph = panBedH(px, cz0 - 2.5);
    M.cyl(px, ph + 0.85, cz0 - 2.5, 0.13, 1.7, PALETTE.panPost, 0.08 * s, 0, 0, 4);
  }
  const mesh = new THREE.Mesh(M.build(), panVC());
  mesh.castShadow = true;
  root.add(mesh);
}

function panBuildOtters(root) {
  const M = panTwin(0.4);   // the bib rounded on the twin (AAA pass)
  M.sph(0, 0, 0, 0.28, 0.26, 0.78, PALETTE.panOtter, 6);
  M.sph(0, 0.06, 0.68, 0.22, 0.20, 0.26, PALETTE.panOtter, 6);
  M.box(0, 0.14, 0.86, 0.26, 0.14, 0.2, PALETTE.panOtterBib);
  M.box(0, 0.24, 0.34, 0.34, 0.1, 0.36, PALETTE.panOtterBib);
  M.cone(0, -0.02, -0.9, 0.2, 0.9, PALETTE.panOtter, Math.PI / 2, 0, 0, 4);
  panOtterMesh = new THREE.InstancedMesh(M.build(), panVC(), 5);
  panOtterMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  panOtterMesh.frustumCulled = false;
  panOtterMesh.castShadow = true;
  root.add(panOtterMesh);
  panRoundOn(panOtterMesh);
}

function panBuildJabiru(root) {
  const M = panTwin(0.4);   // the folded wings rounded on the twin (AAA pass)
  // white, black head, RED collar. It is a metre and a half tall and it is the
  // tallest flying bird in South America.
  M.sph(0, 0, 0, 0.34, 0.36, 0.62, PALETTE.panJabiru, 6);
  M.box(-0.36, 0.02, -0.05, 0.12, 0.5, 1.0, PALETTE.panJabiru, 0, 0, 0.1);
  M.box(0.36, 0.02, -0.05, 0.12, 0.5, 1.0, PALETTE.panJabiru, 0, 0, -0.1);
  M.cyl(0, 0.42, 0.42, 0.13, 0.9, PALETTE.panJabiruNk, 0.5, 0, 0, 6);
  M.sph(0, 0.78, 0.72, 0.16, 0.16, 0.2, PALETTE.panJabiruHd, 6);
  M.cone(0, 0.74, 1.18, 0.09, 0.9, PALETTE.panJabiruHd, Math.PI / 2 + 0.12, 0, 0, 4);
  M.cyl(-0.12, -0.5, 0, 0.05, 0.9, PALETTE.panJabiruHd, 0, 0, 0, 4);
  M.cyl(0.12, -0.5, 0, 0.05, 0.9, PALETTE.panJabiruHd, 0, 0, 0, 4);
  panJabiru = new THREE.Mesh(M.build(), panVC());
  panJabiru.castShadow = true;
  panJabiru.position.set(panNEST.x + 5, panBedH(panNEST.x, panNEST.z) + 1.4, panNEST.z + 6);
  root.add(panJabiru);
  panRoundOn(panJabiru);
}

function panBuildMacaws(root) {
  const M = panMerger();
  M.sph(0, 0, 0, 0.19, 0.19, 0.36, PALETTE.panMacaw, 6);
  M.sph(0, 0.06, 0.32, 0.15, 0.15, 0.17, PALETTE.panMacaw, 6);
  M.cone(0, 0.02, 0.5, 0.09, 0.3, PALETTE.panToucan, Math.PI / 2 + 0.5, 0, 0, 4);
  M.sph(0.1, 0.10, 0.34, 0.05, 0.05, 0.05, PALETTE.panMacawYel, 6);
  M.sph(-0.1, 0.10, 0.34, 0.05, 0.05, 0.05, PALETTE.panMacawYel, 6);
  M.box(0, -0.02, -0.55, 0.14, 0.07, 0.8, PALETTE.panMacaw);
  panMacaws = new THREE.InstancedMesh(M.build(), panVC(), 3);
  panMacaws.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  panMacaws.frustumCulled = false;
  panMacaws.castShadow = true;
  root.add(panMacaws);
}

function panBuildCowbird(root) {
  const M = panMerger();
  M.sph(0, 0, 0, 0.11, 0.11, 0.2, PALETTE.panCowbird, 6);
  M.sph(0, 0.05, 0.18, 0.08, 0.08, 0.09, PALETTE.panCowbird, 6);
  M.cone(0, 0.03, 0.28, 0.04, 0.16, PALETTE.panToucanBl, Math.PI / 2 + 0.3, 0, 0, 4);
  M.box(0, -0.01, -0.3, 0.08, 0.04, 0.3, PALETTE.panCowbird);
  panCowbird = new THREE.Mesh(M.build(), panVC());
  panCowbird.castShadow = true;
  panCowbird.position.set(panCowHome.x, panBedH(panCowHome.x, panCowHome.z) + 0.15, panCowHome.z);
  root.add(panCowbird);
}

/**
 * O TAMANDUA-BANDEIRA. THE GIANT ANTEATER, AND IT IS A CARRIER.
 *
 * Two metres of animal with a tail like a chimney brush, walking on its
 * KNUCKLES because its front claws are ten centimetres long and it cannot put
 * them down. It does not notice you. It does not notice anything. It has a
 * brain the size of a walnut and a route, and if you get on its back it will
 * carry you the length of the campo without breaking stride, which is exactly
 * the middle rung this chapter wants: not a stunt, a lift.
 *
 * All five carrier rules apply and rule 3 is the one that matters — the
 * velocity is differenced against the PREVIOUS TARGET, never against the
 * body's own position, because cannon integrates a kinematic body inside
 * world.step, which runs before this.
 */
/**
 * WHERE THE TRUCK IS AT TIME t, and which way it is pointing.
 *
 * Four phases on one clock, the same shape panAntRouteAt uses: run south,
 * wait at the bridge, reverse north, wait at the top. `dir` is +1 while it is
 * driving forwards and -1 while it is backing, because a reversing truck
 * points the way it came and the yaw cannot be taken from the velocity.
 */
const panTRUCK_RUN = (panTRUCK_Z0 - panTRUCK_Z1) / panTRUCK_V;
const panTRUCK_BACK = (panTRUCK_Z0 - panTRUCK_Z1) / panTRUCK_VR;
const panTRUCK_CYCLE = panTRUCK_RUN + panTRUCK_WAIT + panTRUCK_BACK + panTRUCK_REST;
function panTruckRouteAt(t) {
  const u = ((t % panTRUCK_CYCLE) + panTRUCK_CYCLE) % panTRUCK_CYCLE;
  let z, dir;
  if (u < panTRUCK_RUN) { z = panTRUCK_Z0 - u * panTRUCK_V; dir = 1; }
  else if (u < panTRUCK_RUN + panTRUCK_WAIT) { z = panTRUCK_Z1; dir = 1; }
  else if (u < panTRUCK_RUN + panTRUCK_WAIT + panTRUCK_BACK) {
    z = panTRUCK_Z1 + (u - panTRUCK_RUN - panTRUCK_WAIT) * panTRUCK_VR; dir = -1;
  } else { z = panTRUCK_Z0; dir = -1; }
  return { x: panRoadX(z), z: z, dir: dir };
}

function panBuildTruck(game, root) {
  panTruck = new THREE.Group();
  const M = panMerger();
  // a flatbed, in the colour every working vehicle out there is: dust
  M.box(0, 0.62, -0.35, 1.86, 0.62, 2.5, PALETTE.panPlank);          // bed
  M.box(0, 0.98, -1.55, 1.86, 0.30, 0.14, PALETTE.panPlank);          // tailgate
  for (let sgn = -1; sgn <= 1; sgn += 2)
    M.box(sgn * 0.93, 0.98, -0.35, 0.10, 0.30, 2.5, PALETTE.panPlank);
  M.box(0, 0.72, 1.35, 1.80, 0.80, 1.40, PALETTE.panRoof);            // bonnet + cab base
  M.box(0, 1.42, 1.05, 1.66, 0.72, 1.05, PALETTE.panRoof);            // cab
  M.box(0, 1.44, 1.58, 1.42, 0.46, 0.06, PALETTE.panSkyLow);          // windscreen
  M.box(0, 0.52, 2.05, 1.70, 0.26, 0.14, PALETTE.panTrunk);           // bar
  for (let i = 0; i < 4; i++)
    M.cyl((i < 2 ? -0.86 : 0.86), 0.34, (i % 2 ? -1.05 : 1.25), 0.34, 0.24,
          PALETTE.panAnteaterK, 0, 0, Math.PI / 2, 8);
  const mesh = new THREE.Mesh(M.build(), panVC());
  mesh.castShadow = true;
  panTruck.add(mesh);
  root.add(panTruck);

  panTruckBody = new CANNON.Body({
    mass: 0, type: CANNON.Body.KINEMATIC,
    material: (game.mats && game.mats.ground) || undefined,
  });
  // THE BED IS THE FLOOR, exactly as the anteater's back is: one box, over
  // the tray, and nothing round the cab. A collider on the bonnet would sweep
  // the animal off the causeway every time the thing came past.
  panTruckBody.addShape(new CANNON.Box(new CANNON.Vec3(0.93, 0.14, 1.25)),
                        new CANNON.Vec3(0, 1.02, -0.35));
  panTruckBody.allowSleep = false;
  const s0 = panTruckRouteAt(0);
  panTruckBody.position.set(s0.x, panROAD_Y, s0.z);
  panSyncBody(panTruckBody);
  game.world.addBody(panTruckBody);
  panTruckTarget.x = s0.x; panTruckTarget.z = s0.z; panTruckTarget.y = panROAD_Y;
  panTruckPrev.x = s0.x; panTruckPrev.z = s0.z; panTruckPrev.y = panROAD_Y;
}

function panUpdateTruck(game, dt) {
  if (!panTruckBody) return;
  panTruckT += dt;
  panTruckPrev.x = panTruckTarget.x; panTruckPrev.z = panTruckTarget.z;
  const s = panTruckRouteAt(panTruckT);
  panTruckTarget.x = s.x; panTruckTarget.z = s.z;
  // The causeway is a made road at a constant height; unlike the anteater
  // this does not read the terrain, because the terrain under a causeway is
  // the floodplain it was built up out of.
  panTruckTarget.y = panROAD_Y;
  const inv = dt > 0.0001 ? 1 / dt : 0;
  panTruckBody.velocity.set((panTruckTarget.x - panTruckPrev.x) * inv, 0,
                            (panTruckTarget.z - panTruckPrev.z) * inv);
  // ---- IT ALWAYS FACES SOUTH, AND THAT IS THE POINT ---------------------
  // The first cut took the heading from the direction of travel, which turned
  // the truck round at the bridge and drove it home nose-first — and looked
  // wrong for a reason the picture made obvious: the Transpantaneira is a
  // raised one-lane causeway with water on both sides and a hundred and twenty
  // wooden bridges. You cannot turn a truck round on it. He reverses, all the
  // way, which is what the constant called VR has always meant.
  //
  // So the yaw is the road's own southward tangent at wherever he is, taken
  // from panRoadX rather than from any delta of his: constant through all four
  // phases, curving with the causeway, and never flipping.
  const STEP = -0.35;
  const yaw = Math.atan2(panRoadX(s.z + STEP) - s.x, STEP);
  panTruckBody.quaternion.setFromEuler(0, yaw, 0);
  panTruckBody.angularVelocity.set(0, 0, 0);
  if (panTruck) {
    const ip = panTruckBody.interpolatedPosition;
    panTruck.position.set(ip.x, ip.y, ip.z);
    panTruck.rotation.y = yaw;
  }
}

function panBuildAnteater(game, root) {
  panAnt = new THREE.Group();
  const M = panMerger();
  // the body, which is a wedge
  M.sph(0, 0.72, 0, 0.44, 0.46, 1.05, PALETTE.panAnteater, 6);
  M.box(0, 0.86, 0.1, 0.72, 0.34, 1.6, PALETTE.panAnteater);
  // THE BLACK STRIPE. It is the whole silhouette of the animal and without it
  // this is a grey sack.
  M.box(0, 0.80, 0.2, 0.76, 0.30, 1.1, PALETTE.panAnteaterK, 0, 0, 0.06);
  M.box(0, 0.98, 0.2, 0.70, 0.14, 1.1, PALETTE.panAnteaterW, 0, 0, 0.06);
  // the head: a cone with an eye on it, and it is a third of the animal
  M.cone(0, 0.62, 1.35, 0.26, 1.5, PALETTE.panAnteater, Math.PI / 2 + 0.35, 0, 0, 6);
  M.sph(0.13, 0.72, 1.15, 0.05, 0.05, 0.05, PALETTE.panAnteaterK, 6);
  M.sph(-0.13, 0.72, 1.15, 0.05, 0.05, 0.05, PALETTE.panAnteaterK, 6);
  // THE TAIL, which is the reason anybody has ever heard of this animal
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    M.box(0, 0.86 + t * 0.42, -1.1 - t * 1.35, lerp(0.5, 1.25, t), lerp(0.55, 1.1, t), 0.42,
          i % 2 ? PALETTE.panAnteaterW : PALETTE.panAnteater, 0, 0, 0);
  }
  for (let i = 0; i < 4; i++) {
    M.cyl((i < 2 ? -0.3 : 0.3), 0.3, (i % 2 ? -0.5 : 0.6), 0.14, 0.7,
          PALETTE.panAnteaterK, 0, 0, 0, 6);
  }
  const mesh = new THREE.Mesh(M.build(), panVC());
  mesh.castShadow = true;
  panAnt.add(mesh);
  root.add(panAnt);

  panAntBody = new CANNON.Body({
    mass: 0, type: CANNON.Body.KINEMATIC,
    material: (game.mats && game.mats.ground) || undefined,
  });
  // THE BACK IS THE FLOOR, and nothing else about the animal is solid: a
  // collider round the head would knock the player off it every time the thing
  // swung round a termite mound.
  panAntBody.addShape(new CANNON.Box(new CANNON.Vec3(0.42, 0.16, 0.95)),
                      new CANNON.Vec3(0, 1.12, 0.05));
  panAntBody.allowSleep = false;
  const s = panAntRouteAt(0);
  panAntBody.position.set(s.x, panTerrain(s.x, s.z), s.z);
  panSyncBody(panAntBody);
  game.world.addBody(panAntBody);
  panAntTarget.x = s.x; panAntTarget.z = s.z; panAntTarget.y = panAntBody.position.y;
  panAntPrev.x = s.x; panAntPrev.z = s.z; panAntPrev.y = panAntTarget.y;
}
/** Its route. A long slow lap of the campo, and it never varies. */
const panANT_LOOP = 260;             // seconds for one circuit
function panAntRouteAt(t) {
  const u = (t % panANT_LOOP) / panANT_LOOP * Math.PI * 2;
  panPt.x = 18 + Math.cos(u) * 34 + Math.cos(u * 2) * 7;
  panPt.z = 2 + Math.sin(u) * 30 + Math.sin(u * 3) * 5;
  return panPt;
}

// ------------------------------------------------------------------ water --
/**
 * ONE MESH FOR THE WHOLE FLOOD, and it is clipped by pushing its vertices
 * UNDER the ground wherever the ground is higher — the same trick Manly's surf
 * uses, and for the same reason: a water plane laid over a mosaic of wet and
 * dry ground either covers the dry bits or has to be cut into forty pieces.
 * Static, because nothing here moves: this water has been sitting still since
 * February.
 */
function panBuildWater(root) {
  // FOUR-METRE CELLS, NOT THREE. This sheet is perfectly flat — every vertex
  // is written to panWATER — so the only thing its resolution buys is the
  // gradient of the depth ALPHA around a shoreline, and a shoreline in this
  // terrain is a four-metre feature. Thirteen thousand four hundred triangles
  // to seven and a half thousand, and nothing about it looks different.
  const X0 = -130, X1 = 130, Z0 = -126, Z1 = 106, EL = 4;
  const nx = Math.round((X1 - X0) / EL), nz = Math.round((Z1 - Z0) / EL);
  const g = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0, nx, nz);
  g.rotateX(-Math.PI / 2);
  g.translate((X0 + X1) * 0.5, 0, (Z0 + Z1) * 0.5);
  const p = g.attributes.position.array;
  const n = g.attributes.position.count;
  // FOUR COMPONENTS, AND THE FOURTH ONE IS THE POINT.
  //
  // A single opacity cannot describe this water: at the middle of the baia it
  // is two and a half metres deep and completely opaque, and at the edge of a
  // corixo it is eight millimetres and is not really there at all. The first
  // build handled that by shoving the dry vertices eighty-five centimetres
  // under the ground, which hid them and left a visible one-cell RAMP round
  // every shoreline in the chapter — a tinted slope where there should be a
  // wet edge. three.js reads a vec4 colour attribute as colour AND alpha, so
  // the sheet simply fades out where it gets thin, which is what shallow water
  // does and costs nothing.
  const col = new Float32Array(n * 4);
  const shal = new THREE.Color(PALETTE.panWaterLit);
  const mid = new THREE.Color(PALETTE.panWater);
  const deep = new THREE.Color(PALETTE.panWaterDeep);
  const riv = new THREE.Color(PALETTE.panRiver);
  for (let v = 0; v < n; v++) {
    const i = v * 3, o = v * 4;
    const x = p[i], z = p[i + 2];
    const h = panBedH(x, z);
    const d = panWATER - h;
    p[i + 1] = panWATER;
    panCol.copy(shal).lerp(mid, clamp(d / 1.1, 0, 1)).lerp(deep, clamp((d - 1.1) / 2.6, 0, 1));
    if (z > panRIVER.z0 - 6 && z < panRIVER.z1 + 6 && d > 0.4) panCol.lerp(riv, 0.55);
    col[o] = panCol.r; col[o + 1] = panCol.g; col[o + 2] = panCol.b;
    col[o + 3] = clamp(d / 0.22, 0, 1) * 0.92;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 4));
  g.computeVertexNormals();
  panWaterMat = panVCW(true);
  panSkyFresnelHook(panWaterMat);
  const m = new THREE.Mesh(g, panWaterMat);
  m.frustumCulled = false;
  m.renderOrder = 2;
  root.add(m);
}

/**
 * THE FLOOD GOES GOLD, AND IT IS THE ONE THING THE SUNDOWN NEVER TOUCHED.
 *
 * This module's own note on `panWater` says it in the first line: "the flood,
 * and it is a MIRROR: what you see is not the water, it is the sky in the
 * water." The crossing switches the evening on and `panDusk` runs the sky, the
 * grade, the fireflies, the lilies and the fazenda's windows — and the forty
 * thousand square metres of standing water that is the subject of the whole
 * chapter went on being the same olive green it was at four in the afternoon.
 * A mirror that does not change when the thing it is reflecting changes is not
 * a mirror.
 *
 * One line of arithmetic: the sheet's material multiplies its vertex colours,
 * so tinting `.color` toward the dusk sky warms every one of the eight
 * thousand vertices at once and costs nothing. The depth ramp, the river's
 * brown and the shoreline alpha all survive it because they are all still in
 * the attribute. It needs `grainOwn` or Venice's tide is orange too.
 */
let panWaterMat = null;
const panWaterDay = new THREE.Color(0xffffff);
const panWaterDusk = new THREE.Color(PALETTE.panSkyDusk);
function panUpdateWater() {
  if (!panWaterMat || !panWaterMat.color) return;
  // 0.42, not 1: at full strength the campo is a sheet of orange paint and
  // the river stops being brown. This is a mirror picking up a colour, not a
  // filter over the frame — the grade in systems.js is already doing that half.
  panWaterMat.color.copy(panWaterDay).lerp(panWaterDusk, panSmooth(panDusk) * 0.42);
  panUpdateSkyFresnel();
}

/**
 * T4d — THE SKY IN THE WATER WHEN THE MIRROR IS PARKED (noPanSkyFresnel).
 *
 * The flood is a mirror because the planar pass (reflect k 1.0, panVCW) puts
 * the sky and the gallery trees in it, and that pass parks at rung 1. On
 * every laptop that steps down, the chapter's defining picture went to its
 * vertex colours: flat khaki, lily pads floating on mud, the jacarés black
 * wedges. grain()'s own Fresnel is there, but at 0.65 on a steep curve it is
 * a rim at the horizon and nothing at the play angle.
 *
 * So, only while perfRung >= 1: the same weight the mirror uses (1 - V.y,
 * k 0.78), toward a two-stop sky. Both stops start from the horizon colour
 * grain() already tracks (uGrSkyC, which the weather moves, so an overcast
 * campo gets an overcast flood): 30% toward a lightened panHaze at grazing,
 * 35% toward panSkyTop and nearly half down looking down, because the
 * mirror at rung 0 is dark there: it is the top of the sky it is showing. With a band of
 * reflected tree line along the low angles,
 * its top a sum of three sines in the view's bearing, which is what a
 * wooded horizon looks like doubled in still water. On the LIT colour, like
 * the mirror: it is light from somewhere else. Weighted by (1 - the mirror's
 * live strength), so the hand-over while k damps is a cross-fade and at
 * rung 0 it is zero whatever the uniform says; and zero from under the
 * sheet. An atan, three sines and two mixes on one sheet, and a uniform
 * branch when cut. The colours follow the sundown in
 * panUpdateSkyFresnel.
 *
 * A chained hook, because the sheet is grainOwn's and grain's hook has to run
 * first: it writes vGrainW, uReflK and uReflOn, and this reads all three.
 */
const panSKYF_K = 0.78;               // the mirror's own k is 1.0; the water keeps a little of itself
const panSkyF = { value: 0 };
const panSkyH = { value: new THREE.Color() };     // the horizon, in the water
const panSkyZ = { value: new THREE.Color() };     // looking down: the zenith
const panSkyT = { value: new THREE.Color() };     // the tree line, doubled
const panSkyHDay = new THREE.Color(PALETTE.panHaze).lerp(new THREE.Color(PALETTE.panSkyLow), 0.45);
const panSkyZDay = new THREE.Color(PALETTE.panSkyTop);
const panSkyTDay = new THREE.Color(PALETTE.panForest).lerp(new THREE.Color(PALETTE.panHaze), 0.3);
const panSkyTDusk = new THREE.Color(PALETTE.panForest);
function panSkyFresnelHook(m) {
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
  m.onBeforeCompile = function (shader, renderer) {
    prev.call(this, shader, renderer);
    shader.uniforms.uPanSF = panSkyF;
    shader.uniforms.uPanSkyH = panSkyH;
    shader.uniforms.uPanSkyZ = panSkyZ;
    shader.uniforms.uPanSkyT = panSkyT;
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>',
      '#include <common>\nuniform float uPanSF;\nuniform vec3 uPanSkyH;\nuniform vec3 uPanSkyZ;\nuniform vec3 uPanSkyT;');
    // before the LAST opaque_fragment: grain's mirror block keeps the anchor
    // at its own tail, and this goes after the mirror, where it replaces it
    const at = shader.fragmentShader.lastIndexOf('#include <opaque_fragment>');
    if (at < 0) return;
    shader.fragmentShader = shader.fragmentShader.slice(0, at) + [
      'if (uPanSF > 0.001) {',
      '  vec3 sfV = normalize(cameraPosition - vGrainW);',
      '  float sfY = clamp(sfV.y, 0.0, 1.0);',
      '  float sfW = (1.0 - sfY) * ' + panSKYF_K.toFixed(3) + ' * uPanSF * (1.0 - clamp(uReflK * uReflOn, 0.0, 1.0)) * step(0.0, sfV.y);',
      '  vec3 sfC = mix(mix(uGrSkyC, uPanSkyH, 0.3), mix(uGrSkyC, uPanSkyZ, 0.35) * 0.55, smoothstep(0.03, 0.4, sfY));',
      // the tree line's height in V.y, by bearing: about 6 to 20 degrees
      '  float sfA = atan(sfV.x, sfV.z);',
      '  float sfT = 0.22 + 0.06 * sin(sfA * 5.0 + 1.3) + 0.03 * sin(sfA * 13.0 + 0.4) + 0.018 * sin(sfA * 31.0 + 2.1);',
      '  sfC = mix(sfC, uPanSkyT, (1.0 - smoothstep(sfT * 0.8, sfT, sfY)) * 0.85);',
      '  outgoingLight = mix(outgoingLight, sfC, sfW);',
      '  diffuseColor.a = mix(diffuseColor.a, 1.0, sfW * diffuseColor.a);',
      '}',
      '',
    ].join('\n') + shader.fragmentShader.slice(at);
  };
  m.customProgramCacheKey = function () { return prevKey.call(this) + '|panSF'; };
  m.needsUpdate = true;
}
/** Live only while the governor has parked the mirror, and never when cut. */
function panUpdateSkyFresnel() {
  const st = panGame && panGame.state;
  panSkyF.value = (st && !st.noPanSkyFresnel && (st.perfRung || 0) >= 1) ? 1 : 0;
  if (!panSkyF.value) return;
  const k = panSmooth(panDusk);
  panSkyH.value.copy(panSkyHDay).lerp(panWaterDusk, k * 0.6);
  panSkyZ.value.copy(panSkyZDay).lerp(panWaterDusk, k * 0.35);
  panSkyT.value.copy(panSkyTDay).lerp(panSkyTDusk, k * 0.5);
}

// =================================================================== UPDATE ==
function panTask(game, id) { game.completeTask(id); }

/**
 * SOMEBODY SAYS SOMETHING ABOUT WHAT IS ACTUALLY HAPPENING.
 *
 * `game.say(x, y, z, text)` is npc.js's one-liner-at-a-point, main.js
 * documents it as the thing "biomes call from their update", and no chapter in
 * this game has ever called it — the same class of dead API as the eleven
 * landmark getters and `dusk()` before them. A local's `lines` are a shuffle
 * bag and cannot know anything; this is the half that can.
 *
 * Per-key cooldowns, one voice at a time, and every line is CAUSED — a
 * cattleman who comments on the herd going into the river on a forty-second
 * timer is scenery; one who comments the moment it happens is a person.
 */
/**
 * ...AND WHAT THEY SAY AFTERWARDS.
 *
 * The other half. `say` is a line about now; `lines` is the shuffle bag they
 * draw from when you walk up to them, and npc.js reads it live — so a chapter
 * that keeps its records can change what somebody says the moment the world
 * changes under them.
 *
 * Also `praise`/`onTask`, which nine of the seventeen chapters already use and
 * this one did not: without a pool of its own, the nearest person to any
 * completed task falls back on npc.js's chapter-neutral bag. So the reward for
 * taking nine capybaras across the Paraguai at sundown — the chapter's wow,
 * the thing on the title of the whole list — was a cattleman turning round and
 * saying "…was that deliberate?"
 */
const panLocals = {};
// Additive, not destructive (M3). This was `r.lines = lines`, which deleted
// four of this chapter's seven locals' authored pools the first time a set
// piece fired, permanently. See the long note on `gorSaysNow` in goreme.js.
function panSaysNow(who, lines, wheek) {
  const r = panLocals[who];
  if (!r) return;
  if (r.lines0 === undefined) { r.lines0 = r.lines || []; r.wheek0 = r.wheekLines || []; }
  if (lines) r.lines = lines.concat(r.lines0);
  if (wheek) r.wheekLines = wheek.concat(r.wheek0);
}

const panSaid = {};
let panSayCool = 0;
function panCall(game, key, x, y, z, text, cool) {
  if (panSayCool > 0) return false;
  const t = panSaid[key];
  if (t !== undefined && panTime - t < (cool || 45)) return false;
  if (typeof game.say !== 'function') return false;
  panSaid[key] = panTime;
  panSayCool = 3.4;
  game.say(x, y, z, text);
  return true;
}

/** Push another sample onto the trail the herd walks down. */
function panTrailPush(x, z) {
  if (panTrailCount > 0) {
    const hx = panTrailX[panTrailHead], hz = panTrailZ[panTrailHead];
    const dx = x - hx, dz = z - hz;
    if (dx * dx + dz * dz < panTRAIL_STEP * panTRAIL_STEP) return;
  }
  panTrailHead = (panTrailHead + 1) % panTRAIL_N;
  panTrailX[panTrailHead] = x;
  panTrailZ[panTrailHead] = z;
  if (panTrailCount < panTRAIL_N) panTrailCount++;
}
/** Where the trail was `back` metres ago. */
function panTrailAt(back, out) {
  const steps = Math.min(Math.round(back / panTRAIL_STEP), panTrailCount - 1);
  if (steps < 1) return null;
  const i = ((panTrailHead - steps) % panTRAIL_N + panTRAIL_N) % panTRAIL_N;
  out.x = panTrailX[i]; out.z = panTrailZ[i];
  return out;
}

/**
 * THE HERD. Three states and nothing clever.
 *
 * `graze` — standing in the water, moving about a metre a minute, which is
 *           exactly what a capybara does.
 * `follow` — walking down the player's own trail, `order` places back.
 *
 * There is no flocking, no separation force and no steering behaviour, and
 * that is deliberate: a line off a trail cannot pile up, cannot orbit, cannot
 * oscillate and cannot walk through the thing the player just walked round. It
 * is nine matrices and about forty lines.
 */
function panUpdateHerd(game, dt) {
  if (!panHerdMesh) return;
  const capy = game.capy;
  const p = capy && capy.body ? capy.body.position : null;
  if (p) panTrailPush(p.x, p.z);

  let following = 0;
  // the back of the line, for anything trailing it (T4d)
  let tailI = -1;
  for (let i = 0; i < panHERD_N; i++) {
    if (panHerd[i].st === 'follow' && (tailI < 0 || panHerd[i].order > panHerd[tailI].order)) tailI = i;
  }
  for (let i = 0; i < panHERD_N; i++) {
    const r = panHerd[i];
    if (r.st === 'follow') {
      following++;
      const back = panFOLLOW_GAP * (r.order + 1);
      const at = panTrailAt(back, panPt2);
      if (at) { r.tx = at.x; r.tz = at.z; }
      else if (p) { r.tx = p.x; r.tz = p.z; }
      // ---- D4.13: AND THE RIVER HAS MOVED THE LINE SINCE YOU SWAM IT -----
      //
      // The current has to be applied HERE, to the aim point, and not only to
      // the animal. MEASURED, with it applied to the position alone: the line
      // was strung over 16.09 m with the river and 16.14 m without it — the
      // river moved the herd by five centimetres. The follow law is a
      // bang-bang controller, moving at speed `sp` toward the trail point
      // whatever the distance, so any offset smaller than sp*dt is closed on
      // the very next frame and a cross-flow can only ever hold an offset of
      // about flow*dt. Correct code, useless term, and the number said so.
      //
      // What is actually true is better: the trail is where the LEADER WAS,
      // and in moving water that place has drifted since. The tail of the line
      // is aiming at the oldest point, so it has drifted furthest — which is
      // why a line crossing a river bows, and why it is always the back of it
      // that loses the crossing. `back / panHERD_LEAD_V` is the age of that
      // trail point in seconds, and the water has had all of it.
      if (!(game.state && game.state.noRiver) &&
          panTerrain(r.tx, r.tz) < panWATER - 0.45) {
        panFlowAt(r.tx, r.tz, panFlow);
        const age = Math.min(back / panHERD_LEAD_V, panHERD_AGE_MAX);
        r.tx += panFlow.x * panHERD_DRAG * age;
        r.tz += panFlow.z * panHERD_DRAG * age;
      }
    } else if (r.trailT > 0) {
      // ---- T4d: A GRAZER THAT HAS LOOKED UP walks after the tail ----------
      // at a graze (the speed below is the grazer's) toward the last one in
      // the line, and stops a gap short of it; and stops where it is when the
      // time runs out, rather than turning for home, so the next wheek finds
      // it inside the cascade's 5 m. At the last capybara itself, not at a
      // trail point: the trail behind the tail is where the line has already
      // been, which on a bank is as often as not the river. The grazer's
      // water rule holds: it will not walk into a swim for it.
      r.trailT -= dt;
      if (tailI >= 0) {
        const t = panHerd[tailI], ex = r.x - t.x, ez = r.z - t.z, el = Math.hypot(ex, ez);
        const ax = el > panFOLLOW_GAP ? t.x + ex / el * panFOLLOW_GAP : r.x;
        const az = el > panFOLLOW_GAP ? t.z + ez / el * panFOLLOW_GAP : r.z;
        if (panTerrain(ax, az) >= panWATER - 0.45) { r.tx = ax; r.tz = az; }
      }
      if (r.trailT <= 0 || tailI < 0) { r.trailT = 0; r.tx = r.x; r.tz = r.z; r.restT = rand(5, 13); }
    } else {
      r.restT -= dt;
      if (r.restT <= 0) {
        r.restT = rand(5, 13);
        // A GRAZER HAS A HOME, AND WITHOUT ONE THIS IS A RANDOM WALK. A step
        // of up to five metres every nine seconds with no anchor diffuses at
        // about twenty-three metres per ten minutes: measured over a long
        // session the whole herd wanders off the meadow, into the baia, and
        // eventually out of the world — and 'wheek near another capybara'
        // stops being a thing you can do near the road. They stay inside
        // fourteen metres of where they were put, which is roughly what a
        // grazing capybara actually does in an afternoon.
        r.tx = r.hx + rand(-11, 11);
        r.tz = r.hz + rand(-11, 11);
        // ...and never into water they would have to swim, because a herd
        // that has drifted into the middle of a bay cannot be recruited
        if (panTerrain(r.tx, r.tz) < panWATER - 0.45) { r.tx = r.hx; r.tz = r.hz; }
      }
    }
    const dx = r.tx - r.x, dz = r.tz - r.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d > 0.25) {
      // A FOLLOWER RUNS IF IT IS BEHIND. Without this the line stretches every
      // time the player sprints and never comes back, and by the second corner
      // the herd is a queue in a different postcode.
      // ---- AND A CAPYBARA IN WATER SWIMS AT A CAPYBARA'S SPEED (D4.13) ---
      //
      // The follow law let a straggler close at up to 8.5 m/s, which is a
      // sprint, and it applied on land and in mid-river alike. Two things
      // wrong with that. It is not true — the player's own swim is capped at
      // 2.6 and a follower crossing a river faster than the animal it is
      // following is absurd. And it made the current below UNMEASURABLE:
      // measured, the first cut moved the bow of the line by 0.9 m, because a
      // 0.84 m/s cross-flow against an 8.5 m/s corrective steer is erased on
      // the frame after it is applied.
      //
      // Capped to panHERD_SWIM_V while swimming. The current is then about
      // forty per cent of a follower's forward speed, which is what a river
      // this size actually does to a swimming animal and is the whole of why
      // the item exists.
      const swimNow = panTerrain(r.x, r.z) < panWATER - 0.45;
      const spCap = swimNow ? panHERD_SWIM_V : 8.5;
      const sp = r.st === 'follow' ? clamp(1.4 + (d - 2) * 1.5, 1.4, spCap) : 1.05;
      const k = Math.min(1, (sp * dt) / d);
      r.x += dx * k; r.z += dz * k;
      r.yaw = dampAngle(r.yaw, Math.atan2(dx, dz), 8, dt);
      r.moving = 1;
      // ...and how fast, published, because the legs need it and it was
      // previously thrown away at the end of this block. See panHERD_LEG.
      r.sp = sp;
    } else { r.moving = 0; r.sp = 0; }
    // ---- the answer, and the look that goes with it ----------------------
    if (r.reply > 0) {
      r.reply -= dt;
      if (r.reply <= 0) {
        r.reply = 0;
        panSfx.volume = rand(0.26, 0.36);
        panSfx.pitch = r.replyP * rand(0.97, 1.04);
        game.sfx('wheek', panSfx);
      }
    }
    // it turns to look at you for a moment before it falls in behind, which is
    // the half-second that makes the recruit read as a decision
    if (r.look > 0 && p) {
      r.look -= dt;
      r.yaw = dampAngle(r.yaw, Math.atan2(p.x - r.x, p.z - r.z), 6, dt);
    }
    const bed = panTerrain(r.x, r.z);
    // in the deep, they swim, which for a capybara means most of it is under
    const swim = bed < panWATER - 0.45;
    // ---- D4.13: AND THE RIVER CONTESTS THE LINE --------------------------
    //
    // `panFlowAt` is 1.35 m/s down the middle of the channel. It moves the
    // rafts, it moves the player, and until this line it did not move the nine
    // animals following the player across it — so the marquee was a line of
    // capybaras walking through a current that visibly carried everything else
    // in the shot. They swam a straight line across a moving river.
    //
    // THE BOW IS THE WHOLE THING. A follower is dragged downstream while it
    // swims, so a line entering square comes out bent, and the ones furthest
    // back — which are the pups, because `order` is the join order — are bent
    // furthest. Leading nine of your own kind across is now a matter of
    // ferrying: you aim upstream of where you want them, or you lose the tail.
    //
    // Applied to the POSITION and not to the target, which is the difference
    // between a current and a steering law: the target stays where the trail
    // says it is, and the water takes the animal off it. That is also what
    // makes the recovery legible — a follower that has been pushed off simply
    // has further to swim back.
    if (swim && !(game.state && game.state.noRiver)) {
      panFlowAt(r.x, r.z, panFlow);
      // pups are lighter and get taken further. r.order is the join order, so
      // the tail of the line is the part that loses it, which is both true and
      // the right thing to make the player watch.
      const drag = panHERD_DRAG * (1 + clamp(r.order, 0, 8) * 0.06);
      r.x += panFlow.x * drag * dt;
      r.z += panFlow.z * drag * dt;
      // ---- AND THERE IS NO "IT LOSES THE LINE", ON PURPOSE ---------------
      //
      // The first cut dropped a follower out of `follow` once it was more than
      // three gaps off its own trail point. That branch is UNREACHABLE by
      // construction once the aim point is drifted with the water, which is
      // the right design: the follower sits on its own carried target, so the
      // off-trail distance stays under a metre no matter how far downstream
      // the whole line has been taken. A term that can never fire is the
      // `iceSheepSpook` fault — declared, decremented, read, and constant —
      // and it was removed rather than left in to imply a mechanic.
      //
      // What the player is told about instead is the thing that is MEASURABLY
      // TRUE: the line bows, the back of it bows furthest, and it is nine
      // metres wide by mid-channel. Said once, on the bow itself.
      if (!panToldRiver && r.order >= 3 && p) {
        const bx = r.x - p.x, bz = r.z - p.z;
        if (bx * bx + bz * bz > panHERD_BOW_SAY * panHERD_BOW_SAY) {
          panToldRiver = true;
          game.toast('the water has the back of the line. aim upstream of them.');
        }
      }
    }
    // ---- AND YOU HEAR THEM GO IN --------------------------------------
    // The marquee is nine of your own kind following you into a river and the
    // only sound it has ever made is the one the player's own splash makes.
    // Each animal's entry is an EDGE — the frame its own state flips — so it
    // fires exactly once per animal per crossing however long the frame is,
    // and nine of them land as a ragged run of splashes down the line rather
    // than as one event, which is what a herd going into water sounds like.
    if (swim && !r.wet) {
      r.wet = 1;
      panRipple(r.x, r.z, 0.62);
      const capy2 = game.capy;
      const far = capy2 ? Math.hypot(capy2.position.x - r.x, capy2.position.z - r.z) : 99;
      panSfx.volume = clamp(0.34 - far * 0.008, 0, 0.30);
      panSfx.pitch = rand(0.72, 1.05);
      if (panSfx.volume > 0.03) game.sfx('splash', panSfx);
    } else if (!swim && r.wet) r.wet = 0;
    const y = swim ? panWATER - 0.30 : bed;
    r.y = damp(r.y === undefined ? y : r.y, y, 8, dt);
    // A CAPYBARA WALKING THROUGH TWO INCHES OF WATER LEAVES A WAKE. Nine of
    // them in a line through the shallows and the whole flood is moving, which
    // is the single cheapest thing that can be done to a mirror.
    // ...BUT NOT ALL NINE OF THEM AT ONCE. Photographed mid-crossing with six
    // followers in the water, a ring every 0.34-0.6 s per animal stacked into
    // a solid mat of overlapping circles right where the marquee shot is
    // taken. Every third animal, half as often, and half the size: the point
    // is that the water is disturbed BEHIND you, not that it is boiling.
    if (r.moving && bed < panWATER + 0.06 && i % 3 === 0) {
      r.rip -= dt;
      if (r.rip <= 0) { r.rip = rand(0.9, 1.5); panRipple(r.x, r.z, 0.30 + Math.random() * 0.14); }
    }
    // ---- THE GAIT (D8) ---------------------------------------------------
    // Cadence from the STRIDE, which is D2's law for the player's own legs
    // applied here: half a stride is 2 · hip height · sin(swing), and the
    // phase rate that walks that stride at this speed is π·v/stride. A fixed
    // 8 rad/s — which is what the bob ran at — is right at exactly one speed
    // and skates at every other, and these animals range from 1.05 m/s
    // grazing to 8.5 m/s catching up.
    const swing = clamp(panHERD_SWING0 + r.sp * 0.045, panHERD_SWING0, panHERD_SWING1);
    const stride = Math.max(0.22, 2 * panHERD_HIP * Math.sin(swing));
    r.legPh = (r.legPh || 0) + (r.moving ? Math.PI * r.sp / stride : -0) * dt;
    if (!r.moving) {
      // unwind by the shortest arc, so a herd that stops does not rewind a
      // whole stride to get its feet together
      let w = r.legPh % (Math.PI * 2);
      if (w > Math.PI) w -= Math.PI * 2;
      r.legPh = damp(w, 0, 6, dt);
    }
    // ...and the BOB is on the same clock, which is the whole point: a body
    // that rises and falls on a different beat from the feet is what "sliding"
    // actually looks like.
    let bob = r.moving ? Math.abs(Math.sin(r.legPh)) * 0.055 : Math.sin(panTime * 1.3 + r.ph) * 0.02;
    const sc = (i === 6 || i === 8) ? 0.72 : 1;
    // ...and on the far bank they all shake, each on its own beat
    let roll = 0;
    if (panShakeT > 0 && r.st === 'follow') {
      const k = clamp(panShakeT / 0.8, 0, 1);
      roll = Math.sin(panTime * 21 + r.ph * 3.3) * 0.22 * k;
      bob += Math.abs(Math.sin(panTime * 10 + r.ph)) * 0.05 * k;
    }
    panM.compose(panV3.set(r.x, r.y + bob, r.z),
                 panQ.setFromEuler(panE.set(0, r.yaw, roll)), panSc.set(sc, sc, sc));
    panHerdMesh.setMatrixAt(i, panM);
    // Each pair is the body's own transform (scale included, so a young one's
    // legs are a young one's size) times an offset to its hip and a rotation
    // about that hip. The two pairs are half a cycle apart, which on a pair-
    // per-mesh rig is a trot — and a trot is what a capybara does.
    panM2.compose(panLegV.set(0, panHERD_HIP, panHERD_FZ),
                  panQ.setFromEuler(panE.set(Math.sin(r.legPh) * swing, 0, 0)), panOne);
    panM2.premultiply(panM);
    panHerdLegF.setMatrixAt(i, panM2);
    panM2.compose(panLegV.set(0, panHERD_HIP, panHERD_RZ),
                  panQ.setFromEuler(panE.set(-Math.sin(r.legPh) * swing, 0, 0)), panOne);
    panM2.premultiply(panM);
    panHerdLegR.setMatrixAt(i, panM2);
  }
  panHerdMesh.instanceMatrix.needsUpdate = true;
  panHerdLegF.instanceMatrix.needsUpdate = true;
  panHerdLegR.instanceMatrix.needsUpdate = true;
  if (panShakeT > 0) panShakeT -= dt;
  // ---- AND A LINE OF THEM IS NOT SILENT --------------------------------
  // A capybara herd on the move keeps up a running conversation — a soft
  // click-and-purr every few seconds, which is how a mother and nine young
  // keep track of each other in grass that is over their heads. The one new
  // mechanic in this chapter is a LINE OF THEM BEHIND YOU and it made no
  // sound at all once it had formed. Long clock, quiet, and only while there
  // is somebody back there: the ambient-mover rule.
  if (following > 0) {
    panHerdChat -= dt;
    if (panHerdChat <= 0) {
      panHerdChat = rand(4.5, 9.5) / Math.min(following, 4);
      panSfx.volume = rand(0.055, 0.11);
      panSfx.pitch = rand(1.6, 2.2);
      game.sfx('pop', panSfx);
    }
  } else panHerdChat = rand(2, 5);
  // ---- THE STRING, ON THE PAPER, WHEN IT CHANGES (v36) -------------------
  // A FLASH AND NOT A LINE. The herd follows for minutes at a time, so a
  // readout handed over every frame would be permanent furniture and would sit
  // on top of every other number in the chapter. Called only on the frame the
  // count actually moves: the live line's own watchdog (sysREC_STALE, 1.6 s)
  // takes it away again, so picking up a seventh is a beat of "seven behind
  // you" and then the card is a to-do list again.
  if (following !== panFollowing && game.recordLive && (following || panFollowing)) {
    game.recordLive('gather', following);
  }
  panFollowing = following;
  if (following > panBestString) {
    panBestString = following;
    game.record('gather', panBestString);
  }
  if (following >= 5 && (!game.taskDone || !game.taskDone('gather'))) {
    panTask(game, 'gather');
    panSaysNow('peao',
      ['Five of them behind one animal. That is a lead animal, that is.',
       'They will follow you into the river. They will follow you anywhere. Be careful.',
       'Do not stop suddenly. Nobody at the back is watching where they are going.'],
      ['The whole line just went up. I liked that a lot.']);
  } else if (following >= 5) panTask(game, 'gather');

  // ---- meeting one of them ----------------------------------------------
  if (p && !panSeenHerd) {
    for (let i = 0; i < panHERD_N; i++) {
      const dx = panHerd[i].x - p.x, dz = panHerd[i].z - p.z;
      if (dx * dx + dz * dz < 25) {
        panSeenHerd = true;
        panTask(game, 'the-locals');
        game.toast('it does not even look up.');
        break;
      }
    }
  }
  // THE ONE NEW MECHANIC HAD NO TUTORIAL AT ALL. `panToldWheek` was declared,
  // cleared on entry and never read: fifteen chapters in which the wheek is a
  // noise you make because it is funny, and the sixteenth silently expects you
  // to work out that it is now a recruiting call. One line, once, when you are
  // close enough for it to work and have not tried it.
  if (p && panSeenHerd && !panToldWheek && panFollowing === 0) {
    for (let i = 0; i < panHERD_N; i++) {
      const r = panHerd[i];
      if (r.st === 'follow') continue;
      const dx = r.x - p.x, dz = r.z - p.z;
      if (dx * dx + dz * dz < 100) {
        panToldWheek = true;
        game.toast('wheek at it. see what happens.');
        break;
      }
    }
  }
}

/**
 * A wheek recruits the nearest grazing one. That is the verb — and it is not
 * the only thing that hears it.
 *
 * THE CAMPO ANSWERS. For its whole life this chapter's one new mechanic was
 * silent to everything except nine capybaras: shout in the noisiest habitat on
 * earth and a hundred and fifty animals carried on as if nothing had happened.
 * Now the macaws go up, the jacares slide, the cattle turn, the otters shout
 * back, and there is an echo off the gallery forest — the same argument the
 * Cappadocia pass made about a valley that would not answer.
 */
function panWheek(game) {
  if (!game.biome.isActive('pantanal')) return;
  const capy = game.capy;
  if (!capy || !capy.body) return;
  const p = capy.body.position;

  // ---- the macaws, if you are anywhere near the palm ---------------------
  {
    const dx = p.x - panPALM.x, dz = p.z - panPALM.z;
    if (dx * dx + dz * dz < 900 && panMacawFly <= 0) {
      panMacawFly = 5.4;
      for (let i = 0; i < 2; i++) {
        panSfx.volume = rand(0.22, 0.34); panSfx.pitch = rand(2.0, 2.9);
        game.sfx('bark', panSfx);
      }
    }
  }
  // ---- the one in the water, first (W1) -----------------------------------
  panHuntHear(game, p);
  // ---- the jacares. Nothing on a sandbar waits to find out what a noise was.
  for (let i = 0; i < panCaimanAt.length; i++) {
    const c = panCaimanAt[i];
    const dx = c.x - p.x, dz = c.z - p.z;
    if (dx * dx + dz * dz < 26 * 26 && c.slide <= 0 && Math.random() < 0.55) c.slide = rand(2.6, 4.2);
  }
  // ---- the cattle, which have nothing better to do than look at you -------
  for (let i = 0; i < panCows.length; i++) {
    const c = panCows[i];
    const dx = p.x - c.x, dz = p.z - c.z;
    if (dx * dx + dz * dz < 34 * 34) { c.look = 4.5; c.lx = p.x; c.lz = p.z; }
  }
  // ---- and the gallery forest gives it back, twice ------------------------
  // Two returns at 0.62 s and 1.35 s, dropping in level and in pitch. There is
  // a wall of trees three hundred metres wide down one side of this map and it
  // has never once been audible. Queued on the FRAME clock rather than a
  // setTimeout, so it cannot fire after a chapter change or behind a pause.
  panEchoT[0] = 0.62; panEchoT[1] = 1.35;

  // ---- D4.13: AND IT CARRIES FURTHER OVER WATER ------------------------
  //
  // Sixteen metres is right on a bank, where an animal that wants to follow
  // you can simply walk over. It is wrong in mid-river, which is now a place
  // a follower can be TAKEN FROM: the current bows the line, the tail loses
  // it, and a recruit radius that cannot reach a capybara the river has just
  // put eight metres downstream of you makes the loss permanent for the rest
  // of the crossing. A shout over open water carries, and this is the one
  // place in the chapter that needs it to.
  //
  // Gated on the PLAYER being in the water, not on the animal: standing on
  // the bank shouting across the whole river at a herd that is fine where it
  // is would undo the gather, which is act two's own task.
  const overWater = panTerrain(p.x, p.z) < panWATER - 0.30;
  const rr = overWater ? 26 : 16;
  let best = -1, bestD = rr * rr;
  for (let i = 0; i < panHERD_N; i++) {
    const r = panHerd[i];
    if (r.st === 'follow') continue;
    const dx = r.x - p.x, dz = r.z - p.z;
    const d = dx * dx + dz * dz;
    if (d < bestD) { bestD = d; best = i; }
  }
  let order = 0;
  for (let i = 0; i < panHERD_N; i++) if (panHerd[i].st === 'follow') order++;
  // ---- T4d: AND ONCE THERE IS A LINE, THE LINE DOES SOME OF THE ASKING --
  // (noHerdCascade). One recruit per wheek was nine presses for nine animals,
  // and measured on a herd put beside the animal the eighth was still grazing
  // after a 14 s swim. From the fourth wheek on a call takes up to three: the
  // nearest in reach, and any grazer standing within 5 m of one that has
  // already joined, because a capybara follows its neighbour before it
  // follows a stranger. Their answers climb the same scale, 0.12 s apart.
  if (!(game.state && game.state.noHerdCascade) && order >= panCASCADE_AFTER) {
    panCascade(game, p, rr, order);
    return;
  }
  if (best < 0) return;
  panHerd[best].st = 'follow'; panHerd[best].trailT = 0;
  panHerd[best].order = order;
  // ---- AND IT ANSWERS YOU -----------------------------------------------
  // The one new mechanic in the chapter, and the entire acknowledgement of a
  // successful recruit was one wheek from the PLAYER'S own throat and a
  // capybara that started walking. Which reads as the animal having decided
  // this on its own — there is nothing anywhere that says the shout reached
  // it, let alone that it was addressed to you.
  //
  // A capybara answers a contact call. So: it looks up at you, it wheeks
  // BACK, at a slightly higher pitch and a beat later, and each one that joins
  // answers a little further up the scale, so recruiting the line has a rising
  // figure in it that nobody has to be told about. The delay is a frame
  // counter and not a setTimeout, so it cannot fire after a chapter change.
  panHerd[best].reply = 0.28 + order * 0.04;
  panHerd[best].replyP = 1.12 + order * 0.055;
  panHerd[best].look = 1.6;
  panSfx.volume = 0.45; panSfx.pitch = rand(1.1, 1.35);
  game.sfx('wheek', panSfx);
  if (order === 0) game.toast('it is coming with you.');
}

/**
 * T4d — THE CASCADE (noHerdCascade). panWheek's recruit, from the fourth call
 * on. `rr` is its reach (16 m, 26 over water), `order` how many already
 * follow. Up to panCASCADE_N join per call: the nearest one to the animal of
 * any grazer inside `rr` of it OR inside panCASCADE_R of a follower —
 * including one that joined on this same call, so the line reaches along
 * itself. Each answers panCASCADE_GAP after the last, a step further up the
 * scale than the one before, which is the old figure played faster.
 *
 * AND WITH FIVE BEHIND IT THE REST LOOK UP. Every grazer inside
 * panLOOKUP_R of the animal turns (the look the recruit already has) and walks
 * after the tail of the line at a graze for panLOOKUP_T seconds. They are not
 * followers — a line that recruits itself would make the wheek pointless —
 * but they end up within the cascade's 5 m of one, so the next call has them.
 */
const panCASCADE_AFTER = 3;           // the fourth wheek is the first that cascades
const panCASCADE_N = 3;               // the most one call brings in
const panCASCADE_R = 5;               // m — a grazer this close to a follower hears it
const panCASCADE_GAP = 0.12;          // s between answers
const panLOOKUP_R = 16;               // m — with five behind, grazers this close trail
const panLOOKUP_N = 5;                // followers it takes before they look up
const panLOOKUP_T = 6;                // s of trailing, at graze speed
let panCascadeLast = 0;               // how many the last call took (the probe reads it)
function panCascade(game, p, rr, order) {
  const rr2 = rr * rr, cr2 = panCASCADE_R * panCASCADE_R;
  let took = 0;
  for (let k = 0; k < panCASCADE_N; k++) {
    let best = -1, bestD = 1e18;
    for (let i = 0; i < panHERD_N; i++) {
      const r = panHerd[i];
      if (r.st === 'follow') continue;
      const dx = r.x - p.x, dz = r.z - p.z;
      const d = dx * dx + dz * dz;
      if (d >= bestD) continue;
      let hears = d < rr2;
      for (let j = 0; !hears && j < panHERD_N; j++) {
        const f = panHerd[j];
        if (f.st !== 'follow') continue;
        const fx = f.x - r.x, fz = f.z - r.z;
        if (fx * fx + fz * fz < cr2) hears = true;
      }
      if (hears) { bestD = d; best = i; }
    }
    if (best < 0) break;
    const r = panHerd[best];
    r.st = 'follow'; r.order = order; r.trailT = 0;
    r.reply = 0.28 + order * 0.04 + k * panCASCADE_GAP;
    r.replyP = 1.12 + order * 0.055;
    r.look = 1.6;
    order++; took++;
  }
  panCascadeLast = took;
  if (took) {
    panSfx.volume = 0.45; panSfx.pitch = rand(1.1, 1.35);
    game.sfx('wheek', panSfx);
  }
  if (order < panLOOKUP_N) return;
  const tr2 = panLOOKUP_R * panLOOKUP_R;
  for (let i = 0; i < panHERD_N; i++) {
    const r = panHerd[i];
    if (r.st === 'follow') continue;
    const dx = r.x - p.x, dz = r.z - p.z;
    if (dx * dx + dz * dz < tr2) { r.trailT = panLOOKUP_T; r.look = 1; }
  }
}

/** The mats. Loaded ones sink; unloaded ones come back up, more slowly. */
function panUpdateMats(game, dt) {
  if (!panMatMesh) return;
  const capy = game.capy;
  const p = capy && capy.body ? capy.body.position : null;
  let on = -1;
  for (let i = 0; i < panMAT_N; i++) {
    const m = panMats[i];
    let loaded = 0;
    if (p) {
      const dx = p.x - m.x, dz = p.z - m.z;
      if (dx * dx + dz * dz < m.r * m.r && p.y > m.y - 0.5 && p.y < m.y + 2.2) { loaded = 1; on = i; }
    }
    m.load = loaded;
    // SINKS IN TWO AND A HALF SECONDS, comes back in seven. The asymmetry is
    // the mechanic: you can cross this once at a run and you cannot loiter.
    const want = loaded ? panWATER - 0.50 : panWATER + 0.06;
    // METRES PER SECOND, NOT METRES PER FRAME. The first build left the `* dt`
    // off and the mats went down at eighteen metres a second — the whole
    // mechanic fired and finished inside a single frame, so from the player's
    // side the meadow simply was not solid and the task was unreachable.
    // A mat stops holding you up about a second and a half in and is fully
    // under at three and a half; it takes eight to come back. The asymmetry is
    // the mechanic: you can cross this once, at a run, and you cannot loiter.
    const rate = (loaded ? 0.16 : 0.055) * dt;
    const dy = clamp(want - m.y, -rate, rate);
    m.y += dy;
    // ---- AND YOU CAN HEAR AND FEEL IT GO ---------------------------------
    // The mechanic is that the ground under you is failing, and for the whole
    // life of the chapter it did so in complete silence and perfectly level —
    // a mat took the animal's weight and slid straight down like a lift. What
    // a raft of hyacinth does when four stone lands on it is TIP, toward the
    // corner you are standing on, and make a wet fibrous noise the whole way.
    // The tilt is on the mesh only (rule 4): the collider is the flat top and
    // has to stay flat, or standing on the low edge becomes a slope.
    if (loaded && p) {
      m.tip = damp(m.tip === undefined ? 0 : m.tip, 1, 3.2, dt);
      m.tx = damp(m.tx === undefined ? 0 : m.tx, clamp((p.x - m.x) / m.r, -1, 1), 3.0, dt);
      m.tz = damp(m.tz === undefined ? 0 : m.tz, clamp((p.z - m.z) / m.r, -1, 1), 3.0, dt);
      m.creak = (m.creak || 0) - dt;
      if (m.creak <= 0) {
        m.creak = rand(0.55, 1.05);
        panSfx.volume = clamp(0.05 + (panWATER - m.y) * 0.22, 0.04, 0.17);
        panSfx.pitch = rand(0.55, 0.85);
        game.sfx('rustle', panSfx);
      }
    } else {
      m.tip = damp(m.tip === undefined ? 0 : m.tip, 0, 1.4, dt);
      m.creak = 0;
    }
    // RULE 2: move it with VELOCITY, never by assigning position — a body whose
    // position is assigned every frame is a body cannon never integrates, and
    // the contact under the passenger is remade from scratch every step.
    m.body.velocity.set(0, dy / Math.max(dt, 0.0001), 0);
    const ip = m.body.interpolatedPosition;
    // the tip, and it is small: eight degrees at the far edge of a four-metre
    // mat is twenty-eight centimetres of drop, which is plenty to read and not
    // enough to argue with the flat collider underneath it
    const tk = (m.tip || 0) * 0.14;
    panM.compose(panV3.set(m.x, ip.y, m.z),
                 panQ.setFromEuler(panE.set((m.tz || 0) * tk, i * 0.7, -(m.tx || 0) * tk, 'XYZ')),
                 panSc.set(m.r * 2, 1, m.r * 2));
    panMatMesh.setMatrixAt(i, panM);
  }
  panMatMesh.instanceMatrix.needsUpdate = true;

  // ---- the crossing of the baia -----------------------------------------
  if (capy && capy.swimming) { panMatRun = 0; panMatLast = -1; }
  else if (on >= 0 && on !== panMatLast) {
    panMatLast = on;
    panMatRun++;
    if (!panToldMat && panMatRun === 1) {
      panToldMat = true;
      game.toast('it is already going down. keep moving.');
    }
    if (panMatRun >= 6) panTask(game, 'camalote');
  }
}

/**
 * THE ANTEATER'S LAP, THE CAPYBARA ON IT, AND — NOW — THE THING IT IS FOR.
 *
 * For its whole life this animal walked past ninety termite mounds at a
 * constant nine-tenths of a metre a second without once stopping, which is a
 * two-metre-long specialist doing a lap of an athletics track. A tamandua
 * covers about three thousand mounds a day and spends thirty to ninety seconds
 * at each: it rips the side out with a fore-claw, puts a sixty-centimetre
 * tongue in at a hundred and fifty flicks a minute, and moves on before the
 * soldiers arrive. So: the route stops, the nose goes down, the tail comes up,
 * and the whole animal rocks.
 *
 * And it is a CARRIER, so the stop is also a gift — a lift that pauses at the
 * places worth looking at is a better lift than one that does not.
 */
function panUpdateAnteater(game, dt) {
  if (!panAntBody) return;
  // ---- is it digging, and should it be? ---------------------------------
  if (panAntDig > 0) {
    panAntDig -= dt;
    if (panAntDig <= 0) { panAntDigAt = -1; panAntDigCool = rand(9, 17); }
  } else {
    panAntDigCool -= dt;
    if (panAntDigCool <= 0 && panMoundAt.length) {
      // the nearest mound to where it actually IS, within a stride
      let best = -1, bd = 5.5 * 5.5;
      for (let i = 0; i < panMoundAt.length; i += 3) {
        const dx = panMoundAt[i] - panAntBody.position.x;
        const dz = panMoundAt[i + 1] - panAntBody.position.z;
        const d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = i; }
      }
      if (best >= 0) {
        panAntDig = rand(5.5, 9);
        panAntDigAt = best;
        panSfx.volume = 0.16; panSfx.pitch = rand(0.7, 0.95);
        game.sfx('rustle', panSfx);
      } else panAntDigCool = 1.2;    // nothing here; ask again in a moment
    }
  }
  // THE CLOCK ONLY RUNS WHILE IT IS WALKING. Freezing the route by holding the
  // TIME still is the only way to stop a parametric mover without the mover
  // teleporting when it starts again — and it means the lap is 260 s of
  // walking however much of it is spent with its nose in a mound.
  if (panAntDig <= 0) panAntT += dt;
  panAntPrev.x = panAntTarget.x; panAntPrev.y = panAntTarget.y; panAntPrev.z = panAntTarget.z;
  const s = panAntRouteAt(panAntT);
  panAntTarget.x = s.x; panAntTarget.z = s.z;
  panAntTarget.y = Math.max(panTerrain(s.x, s.z), panWATER - 0.25);
  const inv = dt > 0.0001 ? 1 / dt : 0;
  panAntBody.velocity.set((panAntTarget.x - panAntPrev.x) * inv,
                          clamp((panAntTarget.y - panAntPrev.y) * inv, -2.5, 2.5),
                          (panAntTarget.z - panAntPrev.z) * inv);
  const yaw = Math.atan2(panAntTarget.x - panAntPrev.x, panAntTarget.z - panAntPrev.z);
  panAntBody.quaternion.setFromEuler(0, yaw, 0);
  panAntBody.angularVelocity.set(0, 0, 0);
  if (panAnt) {
    const ip = panAntBody.interpolatedPosition;
    panAnt.position.set(ip.x, ip.y, ip.z);
    // pitch and roll go on the MESH only (rule 4): rate-integrating three axes
    // to tilt a collision box eight degrees is a lot of machinery, and the box
    // is what the passenger is standing in.
    if (panAntDig > 0) {
      // NOSE DOWN AND TAIL UP, and a fast small rock on top of it — the tongue
      // goes in a hundred and fifty times a minute and from six metres up that
      // is the only part of this you can see.
      // eases in over the first second and out over the last, so it never snaps
      const k = panSmooth(Math.min(panAntDig, 1));
      const face = panAntDigAt >= 0
        ? Math.atan2(panMoundAt[panAntDigAt] - ip.x, panMoundAt[panAntDigAt + 1] - ip.z) : yaw;
      panAnt.rotation.set(0.34 * k + Math.sin(panTime * 12) * 0.05 * k,
                          dampAngle(panAnt.rotation.y, face, 3, dt),
                          Math.sin(panTime * 5.5) * 0.09 * k);
      if (panRipMesh && panRipCool <= 0 && panBedH(ip.x, ip.z) < panWATER + 0.05) {
        panRipCool = 0.5; panRipple(ip.x, ip.z, 1.1);
      }
    } else {
      panAnt.rotation.set(Math.sin(panAntT * 3.4) * 0.035, yaw, Math.sin(panAntT * 1.7) * 0.05);
    }
  }

  const capy = game.capy;
  panAntCarrying = false;
  if (capy && capy.body) {
    const p = capy.body.position;
    const dx = p.x - panAntBody.position.x, dz = p.z - panAntBody.position.z;
    // A LOCAL-SPACE TEST MUST BE A ROTATION, not a reflection: cos(-yaw) /
    // sin(-yaw) silently swaps which tolerance guards which axis.
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    const lx = dx * c - dz * sn, lz = dx * sn + dz * c;
    const dy = p.y - panAntBody.position.y;
    if (Math.abs(lx) < 1.0 && Math.abs(lz) < 1.5 && dy > 0.5 && dy < 3.2) panAntCarrying = true;
  }
  if (panAntCarrying) {
    panAntFrame.x = panAntBody.velocity.x;
    panAntFrame.z = panAntBody.velocity.z;
    panAntRide += Math.hypot(panAntBody.velocity.x, panAntBody.velocity.z) * dt;
    if (panAntRide > 22) panTask(game, 'tamandua');
  } else if (panAntRide > 0) {
    panAntRide = Math.max(0, panAntRide - dt * 6);
  }
}

// ---------------------------------------------------------------------------
// THE CALM REGISTRY, AND THE TWO ANIMALS IN THIS CHAPTER THAT ANSWER TO IT
//
// `game.addCritter` has existed since v23 and only six of nineteen chapters
// ever registered anything, so in thirteen places sitting still bought the
// music and the loaf and changed nothing in the world. The Pantanal is the one
// chapter the animal is actually FROM and it registered nothing at all — while
// the API's own worked example in systems.js reads "a jacare is not impressed
// by anybody being quiet and passes 0.3", describing a call that did not exist.
//
// It does now, and it is two animals with two different answers:
//
//   THE JABIRU is shy. It flushes at nine metres and takes five seconds on the
//   ground before it will do it again; registered plainly, so a settled player
//   is let up to sixty per cent closer before it goes. `bold: 0.6` — a stork
//   that has decided you are furniture will take a step toward you, and this
//   is the bird that spends its whole life standing in one place anyway.
//
//   THE JACARES ARE NOT SHY, THEY ARE JACARES. `k: 0.3` takes less than a
//   fifth off their four-metre body-length radius however still you are, which
//   is the whole of what the doc's example was describing. `bold: 0` and it
//   stays 0: nothing with that many teeth comes over to have a look at you.
//   It can only help — 'sit on a sleeping jacare' is the task that radius was
//   tuned around, and a quiet approach now gets marginally nearer before one
//   slides. Nothing about it gets harder.
// ---------------------------------------------------------------------------
let panJabCrit = null, panCaimanCrit = null;

function panUpdateJabiru(game, dt) {
  if (!panJabiru) return;
  panJabT += dt;
  const capy = game.capy;
  if (!panJabCrit && typeof game.addCritter === 'function') {
    panJabCrit = game.addCritter({ biome: 'pantanal', r: 9, bold: 0.6 });
  }
  const near = capy ? panJabiru.position.distanceTo(capy.position) : 99;
  const groundY = panBedH(panJabiru.position.x, panJabiru.position.z);
  // ---- THE WINDOW (L6, F2): the wait, and the countdown on the line ------
  {
    const hx = panJabState === 'up' ? panJabFrom.x : panJabiru.position.x;
    const hz = panJabState === 'up' ? panJabFrom.z : panJabiru.position.z;
    const dh = capy ? Math.hypot(capy.position.x - hx, capy.position.z - hz) : 999;
    panJabWait = dh < panJAB_HOME_R ? panJabWait + dt : 0;
    const left = panJabState === 'up' ? panJAB_FLIGHT - panJabT : panJAB_GROUND - panJabT + panJAB_FLIGHT;
    if (dh < 40 && game.recordLive) game.recordLive('jabiru-home', Math.max(0, left));
  }
  if (panJabState === 'nest') {
    // IT STALKS. It had "it stalks, one step at a time" written on it and it
    // did not move: the whole ground state was a yaw and a damped y, so a
    // metre-and-a-half bird stood on one spot for the entire chapter. A stork
    // wading a flooded meadow takes one very deliberate step every few seconds
    // and freezes between them, which is exactly why it is easy to draw.
    panJabStep -= dt;
    if (panJabStep <= 0) {
      panJabStep = rand(1.6, 4.2);
      const a = rand(0, 6.28);
      let tx = panJabiru.position.x + Math.cos(a) * rand(1.2, 3.0);
      let tz = panJabiru.position.z + Math.sin(a) * rand(1.2, 3.0);
      // never more than fourteen metres from the tree, and never out of the
      // shallows: this bird is fishing, and there are no fish on dry ground
      const hx = panNEST.x + 5, hz = panNEST.z + 6;
      if ((tx - hx) * (tx - hx) + (tz - hz) * (tz - hz) > 196 ||
          panBedH(tx, tz) > panWATER + 0.9) { tx = hx; tz = hz; }
      panJabTx = tx; panJabTz = tz;
    }
    {
      const dx = panJabTx - panJabiru.position.x, dz = panJabTz - panJabiru.position.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > 0.12) {
        // a stork's step is a LUNGE, so it goes fast and stops, not slowly
        const k = Math.min(1, (1.15 * dt) / d);
        panJabiru.position.x += dx * k;
        panJabiru.position.z += dz * k;
        panJabiru.rotation.y = dampAngle(panJabiru.rotation.y, Math.atan2(dx, dz), 4, dt);
        if (Math.random() < dt * 1.6 && panBedH(panJabiru.position.x, panJabiru.position.z) < panWATER + 0.1) {
          panRipple(panJabiru.position.x, panJabiru.position.z, 0.34);
        }
      } else {
        // the stab: a fast dip of the whole bird, which is the bill going in
        panJabiru.rotation.x = Math.pow(Math.max(0, Math.sin(panTime * 0.9)), 12) * 0.6;
      }
    }
    panJabiru.position.y = damp(panJabiru.position.y, groundY + 1.42, 3, dt);
    panJabiru.rotation.z = 0;
    // ...and it is not startled again the instant it lands. `near < 9` with a
    // clock that resets on landing means a player standing under the tree gets
    // a bird that takes off, flies a circuit, lands, and takes off again for
    // ever; five seconds on the ground is the least a stork would give you.
    // `panJabCrit.near` and not the bare nine: a player who has been sitting
    // still is let closer before the bird goes, and one who has decided you are
    // furniture altogether (bold, appr → 1) is not flushed at all. The
    // twenty-four second self-flush above is untouched, so the bird still
    // moves on its own whatever you do.
    const jabR = panJabCrit ? panJabCrit.near : 9;
    if (panJabT > 24 || (near < jabR && panJabT > 5)) {
      panJabState = 'up'; panJabT = 0;
      // WHERE IT TOOK OFF FROM, so it can come back to it. The flight was a
      // circle drawn round a hard-coded centre and ending 15 m from it, and
      // the ground state never moved the bird home — so every landing was 15 m
      // adrift and every take-off after that was a 15 m teleport back.
      panJabFrom.x = panJabiru.position.x; panJabFrom.z = panJabiru.position.z;
      panJabFrom.a = panJabiru.rotation.y;
      panSfx.volume = 0.22; panSfx.pitch = rand(1.6, 2.1);
      game.sfx('rustle', panSfx);
    }
  } else if (panJabState === 'up') {
    const t = clamp(panJabT / 8.5, 0, 1);
    const a = panJabFrom.a + t * Math.PI * 2;
    // A CIRCLE THAT ENDS WHERE IT STARTED. `t * PI * 1.4` is 252 degrees, so
    // the bird landed a hundred and eight degrees round its own circuit and
    // fifteen metres from the tree; a full turn puts it back on its own feet.
    const rr = 16 * Math.sin(t * Math.PI);
    panJabiru.position.set(panJabFrom.x + Math.cos(a) * rr,
                           groundY + 1.4 + Math.sin(t * Math.PI) * 13,
                           panJabFrom.z + Math.sin(a) * rr);
    panJabiru.rotation.x = 0;
    panJabiru.rotation.y = a + Math.PI * 0.5;
    panJabiru.rotation.z = Math.sin(panJabT * 2.2) * 0.16;
    if (t >= 1) {
      panJabState = 'nest'; panJabT = 0; panJabStep = 0.4;
      // ---- THE WINDOW (L6, F2): `jabiru-home` — the landing frame, you
      // inside the ring where it comes down. The wait is the figure.
      if (!panJabHomeDone && capy &&
          Math.hypot(capy.position.x - panJabFrom.x, capy.position.z - panJabFrom.z) < panJAB_HOME_R) {
        panJabHomeDone = true;
        panTask(game, 'jabiru-home');
        if (typeof game.record === 'function') game.record('jabiru-home', Math.round(panJabWait));
        if (typeof game.recordEnd === 'function') game.recordEnd('jabiru-home');
        game.toast('a metre and a half of stork came down next to you and did not mind. that is the Pantanal.');
      }
    }
    // ONE NOTE, RATIONED AND SCALED BY DISTANCE. A jabiru has no syrinx and
    // cannot call at all — the only noise it makes is its bill.
    //
    // ...ON A COUNTDOWN, NOT A MODULO WINDOW. `panJabT % 2.6 < dt` is a test on
    // a clock that advances by a variable amount: at a frame time straddling
    // the boundary it is true twice in a row and at one that steps over it it
    // is true never. It is the shape the otters two functions down carry a
    // whole paragraph about, and it was still here. A bill-clatter is also not
    // a metronome — it comes in bursts of a different length every time.
    panJabNote -= dt;
    if (panJabNote <= 0 && capy) {
      panJabNote = rand(1.9, 3.4);
      const far = panJabiru.position.distanceTo(capy.position);
      panSfx.volume = clamp(0.20 - far * 0.0022, 0.02, 0.20);
      panSfx.pitch = rand(2.6, 3.4);
      if (panSfx.volume > 0.03) game.sfx('tick', panSfx);
    }
  }
}

/**
 * THE MACAWS, AND FOR THEIR WHOLE LIFE THEY DID NOT MOVE.
 *
 * The chapter takes a nut off them and toasts "three of them are shouting at
 * you" while three birds sit perfectly still in a palm. A hyacinth macaw is
 * the largest flying parrot on earth and it does not sit still for anything —
 * so taking the nut, or shouting, puts them up: a wide wheeling circuit of the
 * acuri at fourteen metres, and then they come back, because it is their palm.
 */
function panUpdateMacaws(game, dt) {
  if (!panMacaws) return;
  panMacawT += dt;
  const h = panBedH(panPALM.x, panPALM.z);
  // 1 sitting, 0 flying, smoothed — so the departure and the return are the
  // same two lines and neither of them can snap
  const home = panMacawHome;
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + Math.sin(panTime * 0.3 + i) * 0.25;
    const r = 1.9 + Math.sin(panTime * 0.5 + i * 2) * 0.3;
    const sx = panPALM.x + Math.cos(a) * r;
    const sz = panPALM.z + Math.sin(a) * r;
    const sy = h + 8.6 + Math.sin(panTime * 1.1 + i) * 0.06;
    // the circuit: wide, fast and banked, which is a big parrot's flight
    const fa = panMacawT * 1.15 + i * 2.09;
    const fr = 15 + i * 2.5;
    const fx = panPALM.x + Math.cos(fa) * fr;
    const fz = panPALM.z + Math.sin(fa) * fr;
    const fy = h + 12 + Math.sin(fa * 1.7 + i) * 3.2;
    const x = lerp(fx, sx, home), y = lerp(fy, sy, home), z = lerp(fz, sz, home);
    const yaw = lerp(fa + Math.PI * 0.5, -a + Math.PI, home);
    const roll = (1 - home) * (0.42 + Math.sin(panMacawT * 13 + i) * 0.20);
    panM.compose(panV3.set(x, y, z), panQ.setFromEuler(panE.set(0, yaw, roll)), panSc.set(1, 1, 1));
    panMacaws.setMatrixAt(i, panM);
  }
  panMacaws.instanceMatrix.needsUpdate = true;
  // ...and they SHOUT while they are up, which is what they are famous for.
  // Rationed: this is the loudest bird in South America and three of them on a
  // loop is a thing to be muted.
  // ...and on a countdown rather than a modulo window, for the third time in
  // this file: see the note on the jabiru's bill. Three of the loudest birds
  // in South America firing twice on one frame is not rationing.
  panMacawNote -= dt;
  if (home < 0.6 && panMacawNote <= 0) {
    panMacawNote = rand(0.85, 1.6);
    panSfx.volume = rand(0.14, 0.24); panSfx.pitch = rand(2.1, 2.9);
    game.sfx('bark', panSfx);
  }
}

// ================================================================ THE ONÇA ==
/**
 * TIER 5 — THE THIRD HUNT, AND THE ONLY ONE THAT HAD TO BE BUILT FROM NOTHING.
 *
 * This chapter promises a jaguar THREE TIMES in dialogue that has been in the
 * file since it was written:
 *
 *   'They will shout at a jaguar. They will certainly shout at you.'
 *   'They shouted at you. You are on the list now, with the jaguars.'
 *   'All five at once. They do that to jaguars. You are in good company.'
 *
 * Grep before building: those three strings are the only occurrences of the
 * word in the file. No mesh, no state, no palette entry, no task. The joke in
 * all three lines is a comparison to something the player can never see, and
 * the otters' whole set piece is built on it.
 *
 * WHAT SHE IS AND IS NOT. She hunts the CAPYBARA HERD, not the player. The
 * animal you are is a capybara and a jaguar's favourite food is a capybara,
 * and this game does not have fail states outside one chase in Marrakech —
 * so a predator that could eat the player would be a different game and would
 * quietly poison every other chapter. She ignores you completely, which is
 * also funnier: the most dangerous animal in South America walks past you.
 *
 * FOUR STATES, and only the middle two are visible:
 *
 *   away   — not in the world. The default, and where she spends most of it.
 *   stalk  — she comes along the far bank at a walk, belly low, using the
 *            reeds. Slow enough to be noticed by somebody paying attention
 *            and quiet enough to be missed by somebody who is not.
 *   rush   — twelve metres of commit. The herd scatters.
 *   leave  — she goes, at a walk, whether or not she got anything.
 *
 * AND YOU CAN RUIN IT, which is the whole reason this is a mechanic and not a
 * cutscene. A wheek inside panJAG_HEAR during `stalk` blows it: she stops,
 * looks at you for a second and a half, and leaves without rushing. The herd
 * never knows. That is the second place in the game where the animal's voice
 * is spent on somebody else's behalf, and unlike Antarctica's it is spent on
 * animals the player has probably spent ten minutes gathering.
 *
 * THE OTTERS PAY IT OFF. They already shout at anything in their zone; a
 * jaguar inside it gets the full four-call volley, and the boatman's line
 * about being "on the list, with the jaguars" finally has a jaguar in it.
 */
const panJAG_PATH = [                 // the far bank, west to east past the crossing
  [-72, -92], [-58, -90], [-46, -88], [-34, -87], [-22, -88], [-8, -90],
];
const panJAG_V      = 1.15;           // m/s stalking. A jaguar is not in a hurry.
const panJAG_RUSH_V = 9.4;            // ...and this is, for about a second and a half
const panJAG_RUSH_D = 13;             // m of commit
const panJAG_HEAR   = 34;             // m a wheek carries to her
const panJAG_SEE    = 26;             // m at which the herd notices the rush
const panJAG_ARM    = 42;             // s of dusk before she comes at all
// The floor on a stalk. Eighteen seconds at 1.15 m/s is about twenty metres of
// bank, which is long enough to be noticed from the crossing and short enough
// that a player who has noticed has to decide rather than deliberate.
const panJAG_STALK_MIN = 18;
// ---- D4.13: how hard the river pulls on a swimming follower ---------------
// A fraction of the full flow, not all of it: a capybara swims, and one that
// is carried at the full 1.35 m/s of mid-channel is a log.
//
// AND 0.62 WAS TOO LITTLE, MEASURED. The follow law is a bang-bang controller
// — it moves at speed sp toward the trail point whatever the distance — so any
// offset smaller than sp*dt is closed on the next frame and a cross-flow can
// only ever produce a standing offset of about flow*dt. The measured bow was
// 1.29 m across a twenty-four metre channel, which is a rounding error, not a
// river. At 0.95 the current is 1.28 m/s against a 2.2 m/s swim: over half a
// follower's whole budget, so it cannot both hold its line and keep up, and
// the thing that gives is the tail.
const panHERD_DRAG = 0.95;
// How far the back of the line has to be off the player before the chapter
// says so. Twelve metres is well past anything the follow gaps alone produce
// and well inside the nine-metre bow the current makes by mid-channel.
const panHERD_BOW_SAY = 12.0;
// ...and how fast a follower can swim. The player is capped at 2.6; a follower
// that could cross a river faster than the animal it is following is absurd,
// and an 8.5 m/s corrective steer erases a 0.84 m/s cross-current on the frame
// after it is applied. Measured: the bow of the line moved 0.9 m before this.
const panHERD_SWIM_V = 2.2;
// How fast the LEADER is assumed to have been going, for working out how old a
// trail point is. A capybara swims at 2.6 and wades slower; 2.2 is the honest
// middle and it only sets the scale of the bow.
const panHERD_LEAD_V = 2.2;
// ...and a cap on that age, so a player who stops mid-river for a minute does
// not come back to a trail that has been carried into the next state.
const panHERD_AGE_MAX = 6.0;
let panToldRiver = false;
let panJag = null, panJagSt = 'away', panJagT = 0;
let panJagX = -72, panJagZ = -92, panJagYaw = 0, panJagU = 0;
let panJagCrouch = 0, panJagRuined = false, panJagRuns = 0, panJagSpoiled = 0;
let panJagArm = 0, panJagSaid = false;
let panJagTx = 0, panJagTz = 0, panJagStruck = false, panJagOtter = false;
const panJagPt = { x: 0, z: 0 };
// The stalk path, measured once at build rather than assumed: the polyline is
// authored in world metres and a speed in m/s needs its length to advance a
// 0..1 parameter at the right rate. Same trap as the chiva road.
let panJagPathLen = 1;

function panBuildJaguar(game, root) {
  const M = panMerger();
  const B = PALETTE.panJag, D = PALETTE.panJagDk, W = PALETTE.panJagBelly;
  // A jaguar is a very short-legged, very heavy cat: the body is nearly twice
  // the depth of the leg length and the head is enormous for the frame. Both
  // of those are what stops this reading as a big domestic cat.
  M.box(0, 0.60, 0, 0.52, 0.46, 1.36, B);
  M.box(0, 0.44, 0, 0.44, 0.20, 1.30, W);            // the pale underside
  M.box(0, 0.66, -0.80, 0.42, 0.40, 0.34, B);        // the shoulders
  M.box(0, 0.72, -1.08, 0.40, 0.38, 0.36, B);        // and the head, which is huge
  M.box(0, 0.62, -1.28, 0.26, 0.22, 0.16, W);        // muzzle
  for (let s = -1; s <= 1; s += 2) {
    M.box(s * 0.15, 0.92, -1.02, 0.14, 0.12, 0.10, D);   // ears
    M.box(s * 0.20, 0.30, -0.52, 0.16, 0.60, 0.18, B);   // front legs
    M.box(s * 0.20, 0.30, 0.48, 0.18, 0.60, 0.20, B);    // back legs
  }
  // the tail: five segments, ringed, and it is nearly as long as she is
  for (let k = 0; k < 5; k++) {
    M.box(0, 0.58 + k * 0.02, 0.76 + k * 0.20, 0.14 - k * 0.012, 0.14 - k * 0.012,
          0.20, k % 2 ? D : B);
  }
  // THE ROSETTES. Twenty-two of them, seeded off a fixed lattice rather than
  // at random, because a random scatter clumps and a clumped jaguar reads as a
  // dirty jaguar. They are what makes her recognisable at range and they are
  // the reason the base colour is allowed to be close to the reeds.
  for (let k = 0; k < 22; k++) {
    const t = (k * 0.6180339887) % 1;
    const side = k % 2 ? 1 : -1;
    M.box(side * (0.19 + ((k * 7) % 3) * 0.04), 0.50 + ((k * 5) % 4) * 0.13,
          -0.98 + t * 2.0, 0.10, 0.10, 0.12, D);
  }
  panJagPathLen = 0;
  for (let i = 1; i < panJAG_PATH.length; i++) {
    panJagPathLen += Math.hypot(panJAG_PATH[i][0] - panJAG_PATH[i - 1][0],
                                panJAG_PATH[i][1] - panJAG_PATH[i - 1][1]);
  }
  if (!(panJagPathLen > 1)) panJagPathLen = 1;
  panJag = new THREE.Mesh(M.build(), panVC());
  panJag.castShadow = true;
  panJag.visible = false;
  panJag.name = 'panJaguar';
  root.add(panJag);
}

/** Where the stalk path is at parameter u (0..1). */
function panJagAt(u, out) {
  const n = panJAG_PATH.length - 1;
  const t = clamp(u, 0, 1) * n;
  const i = Math.min(n - 1, Math.floor(t));
  const f = t - i;
  out.x = lerp(panJAG_PATH[i][0], panJAG_PATH[i + 1][0], f);
  out.z = lerp(panJAG_PATH[i][1], panJAG_PATH[i + 1][1], f);
  return out;
}

function panUpdateJaguar(game, dt) {
  if (!panJag) return;
  const capy = game.capy;
  const p = capy && capy.body ? capy.body.position : null;
  panJagT += dt;

  // ---- when she comes ----------------------------------------------------
  // Dusk, and not before: `panDusk` is switched on by the crossing, so she
  // arrives after the chapter's own event rather than on a timer of her own.
  // One appearance per visit — a jaguar you can watch four times is a fox.
  if (panJagSt === 'away') {
    // ...and she cuts, on the shared Tier 5 flag: with noHunt set she never
    // comes at all, which is the state this chapter shipped in for its whole
    // life and is the honest control for every number below.
    if (panDusk > 0.5 && !panJagRuined && !(game.state && game.state.noHunt)) {
      panJagArm += dt;
      if (panJagArm > panJAG_ARM) {
        panJagSt = 'stalk';
        panJagT = 0;
        panJagU = 0;
        panJagRuined = true;          // once per visit, whatever happens next
        panJagCrouch = 0;
        panJagAt(0, panJagPt);
        panJagX = panJagPt.x; panJagZ = panJagPt.z;
        panJag.visible = true;
      }
    }
    return;
  }

  if (panJagSt === 'stalk') {
    panJagU += (panJAG_V * dt) / panJagPathLen;
    panJagAt(panJagU, panJagPt);
    const dx = panJagPt.x - panJagX, dz = panJagPt.z - panJagZ;
    if (dx || dz) panJagYaw = Math.atan2(dx, dz);
    panJagX = panJagPt.x; panJagZ = panJagPt.z;
    panJagCrouch = damp(panJagCrouch, 1, 2.0, dt);
    // ---- AND A WHEEK RUINS IT ------------------------------------------
    // The one place in this chapter the voice does something for somebody
    // else. She does not flee — a jaguar is not afraid of a capybara — she
    // simply stops, looks at the thing that made the noise, and gives up on
    // an ambush that is no longer an ambush.
    if (p && game.input && game.input.honkPressed &&
        Math.hypot(p.x - panJagX, p.z - panJagZ) < panJAG_HEAR) {
      panJagSt = 'leave';
      panJagT = 0;
      panJagSpoiled++;
      panSfx.volume = 0.30; panSfx.pitch = 0.42;
      game.sfx('thud', panSfx);
      game.toast('she looked straight at you and left. the herd never knew.');
      return;
    }
    // ---- ...OR SHE COMMITS, BUT NOT YET --------------------------------
    // MEASURED, on the first cut: she rushed at u = 0.14. The herd stands on
    // the crossing and the path starts thirty metres from it, so the "is
    // anybody within twenty-one metres" test was true almost immediately and
    // the entire stalk — the thing this whole state exists to draw — lasted
    // about eight seconds and happened off at the west end of the bank where
    // nobody is standing.
    //
    // A stalk has to be WATCHABLE or it is a spawn. panJAG_STALK_MIN is the
    // floor: she will not commit inside it however close the herd wanders,
    // which also makes the wheek a real window rather than a reflex test.
    const nearHerd = panJagNearestHerd();
    const mayRush = panJagT > panJAG_STALK_MIN;
    if (panJagU >= 1 || (mayRush && nearHerd && nearHerd.d < panJAG_RUSH_D)) {
      if (nearHerd && nearHerd.d < panJAG_RUSH_D * 1.6) {
        panJagSt = 'rush';
        panJagT = 0;
        panJagTx = nearHerd.x; panJagTz = nearHerd.z;
        panSfx.volume = 0.42; panSfx.pitch = 0.30;
        game.sfx('gasp', panSfx);
      } else {
        panJagSt = 'leave'; panJagT = 0;
      }
    }
  } else if (panJagSt === 'rush') {
    panJagCrouch = damp(panJagCrouch, 0.25, 6, dt);
    const dx = panJagTx - panJagX, dz = panJagTz - panJagZ;
    const d = Math.hypot(dx, dz) || 1;
    const step = Math.min(d, panJAG_RUSH_V * dt);
    panJagX += dx / d * step; panJagZ += dz / d * step;
    panJagYaw = Math.atan2(dx, dz);
    // ---- THE HERD SCATTERS ----------------------------------------------
    // Everything inside panJAG_SEE breaks. Not a state of its own: a
    // capybara that has seen a jaguar wants to be in the water and away from
    // it, and `tx/tz` is the only thing panUpdateHerd steers on, so the
    // scatter IS a target write. Followers are dropped out of `follow`,
    // which is the cost of not having warned them.
    if (!panJagStruck) {
      for (let i = 0; i < panHERD_N; i++) {
        const r = panHerd[i];
        const hx = r.x - panJagX, hz = r.z - panJagZ;
        if (hx * hx + hz * hz > panJAG_SEE * panJAG_SEE) continue;
        const hd = Math.hypot(hx, hz) || 1;
        r.tx = r.x + hx / hd * 26;
        r.tz = r.z + hz / hd * 26;
        r.st = 'graze';               // out of the line, and it is your fault
        r.order = -1;
        // ...and the scatter target has to SURVIVE. The graze branch replaces
        // tx/tz the moment `restT` runs out, and `restT` is a leftover from
        // whenever this one last picked a patch — so a capybara could be given
        // twenty-six metres of run and drop it on the very next frame.
        r.restT = rand(6, 10);
        r.look = 0.9;
      }
      panJagStruck = true;
      panJagRuns++;
      game.toast('the whole line broke at once. now you know what they listen for.');
      if (typeof game.shake === 'function') game.shake(0.10);
    }
    if (panJagT > 1.7 || d < 1.2) { panJagSt = 'leave'; panJagT = 0; }
  } else if (panJagSt === 'leave') {
    panJagCrouch = damp(panJagCrouch, 0, 1.6, dt);
    // she goes north into the trees, at a walk
    panJagZ -= panJAG_V * 1.4 * dt;
    panJagYaw = Math.PI;
    if (panJagT > 14) { panJagSt = 'away'; panJag.visible = false; }
  }

  // ---- AND THE OTTERS SHOUT AT HER, which is the line the chapter has ----
  // been carrying for months with nothing to point at.
  if (panJagSt !== 'away' && panInZone('otters', panJagX, panJagZ)) {
    if (!panJagOtter) {
      panJagOtter = true;
      panOtterVolley = 4;
      panOtterNext = 0;
      panOtterArmed = true;
      if (!panJagSaid) {
        panJagSaid = true;
        game.toast('the otters are screaming at something on the bank.');
      }
    }
  } else panJagOtter = false;

  // ---- draw -------------------------------------------------------------
  // A stalking cat is LOW: the crouch drops her thirty centimetres and pitches
  // the shoulders, which at this size is the difference between a walk and a
  // stalk from any distance at all.
  const gy = panTerrain(panJagX, panJagZ);
  const gait = Math.sin(panJagT * (panJagSt === 'rush' ? 13 : 3.4)) * 0.03;
  panJag.position.set(panJagX, gy - panJagCrouch * 0.17 + gait, panJagZ);
  panJag.rotation.set(panJagCrouch * 0.07, panJagYaw, gait * 0.5, 'YXZ');
}

/** The nearest herd member to her, or null. */
function panJagNearestHerd() {
  let best = null, bd = 1e9;
  for (let i = 0; i < panHERD_N; i++) {
    const r = panHerd[i];
    const dx = r.x - panJagX, dz = r.z - panJagZ;
    const d2 = dx * dx + dz * dz;
    if (d2 < bd) { bd = d2; best = r; }
  }
  return best ? { x: best.x, z: best.z, d: Math.sqrt(bd) } : null;
}

function panUpdateOtters(game, dt) {
  if (!panOtterMesh) return;
  panOtterT += dt;
  const capy = game.capy;
  const near = capy && panInZone('otters', capy.position.x, capy.position.z);
  panOtterUp = damp(panOtterUp, near ? 1 : 0, 3, dt);
  for (let i = 0; i < 5; i++) {
    const a = panOtterT * 0.55 + i * 1.25;
    const x = panOTTERS.x + Math.cos(a) * (5 + i) + Math.sin(panOtterT * 1.3 + i) * 1.2;
    const z = panOTTERS.z + Math.sin(a * 0.8) * 4;
    // heads up when there is something to shout at, which is most of the time
    const y = panWATER - 0.12 + panOtterUp * (0.45 + Math.sin(panOtterT * 2.4 + i) * 0.14);
    const pitch = -panOtterUp * 0.8;
    panM.compose(panV3.set(x, y, z), panQ.setFromEuler(panE.set(pitch, a + 1.57, 0)),
                 panSc.set(1, 1, 1));
    panOtterMesh.setMatrixAt(i, panM);
  }
  panOtterMesh.instanceMatrix.needsUpdate = true;
  // ---- THE TELLING-OFF, AND IT IS A VOLLEY RATHER THAN A METRONOME -------
  //
  // Two things were wrong with `if (panOtterT % 1.6 < dt)`. It is a WINDOW on
  // a clock that advances by dt, which is the exact shape that made the
  // Antarctic skua cry nine times per dive — at a variable frame time it is
  // true for none or two frames rather than one. And it never stops: a bark
  // every 1.6 seconds for as long as you stand there is a smoke alarm, not an
  // animal, and it is precisely what the ambient-mover rules are for.
  //
  // A family of ariranha does not do this either. They come up together,
  // shout at whatever it is in a burst, and then watch it — and if it is still
  // there in ten seconds they do it again, more briefly. So the volley is four
  // calls a fifth of a second apart, and then a much quieter reminder on a
  // slow clock. It re-arms when you leave, which is the only way a set piece
  // that is a NOISE stays worth walking into twice.
  if (near) {
    if (!panToldOtter) {
      panSaysNow('boatman',
        ['All five at once. They do that to jaguars. You are in good company.',
         'They are not frightened of you. They are telling you whose river it is.',
         'There were seven. There will be seven again. Give it a year.',
         'Five kilos of fish each, every day, and they shout the whole time.'],
        ['You cannot out-shout them. Nothing out-shouts them.']);
    }
    panTask(game, 'the-otters');
    if (!panOtterArmed) {
      panOtterArmed = true;
      panOtterVolley = 4;
      panOtterNext = 0;
      if (!panToldOtter) {
        panToldOtter = true;
        game.toast('five of them. all of them, at you, at once.');
      }
    }
    panOtterNext -= dt;
    if (panOtterNext <= 0) {
      if (panOtterVolley > 0) {
        panOtterVolley--;
        panOtterNext = rand(0.16, 0.30);
        panSfx.volume = rand(0.20, 0.30); panSfx.pitch = rand(2.4, 3.2);
      } else {
        panOtterNext = rand(6.5, 11);
        panSfx.volume = rand(0.10, 0.16); panSfx.pitch = rand(2.2, 2.8);
      }
      game.sfx('bark', panSfx);
      panRipple(panOTTERS.x + rand(-5, 5), panOTTERS.z + rand(-4, 4), 0.34);
    }
  } else if (panOtterArmed && panOtterT > 0) {
    // ...and they only re-arm once you are properly out of it, so walking the
    // edge of the zone does not retrigger the volley every second step
    const d = capy ? Math.hypot(capy.position.x - panOTTERS.x, capy.position.z - panOTTERS.z) : 99;
    if (d > 26) panOtterArmed = false;
  }
}

/**
 * THE COWBIRD. It rides on capybaras. That is its entire job description and
 * it is why it is called a cowbird.
 */
function panUpdateCowbird(game, dt) {
  if (!panCowbird) return;
  const capy = game.capy;
  if (!capy || !capy.body) return;
  panCowT += dt;
  const p = capy.body.position;
  if (panCowState === 'ground') {
    // ---- IT IS A COWBIRD AND THERE ARE NOW COWS -------------------------
    // The whole reason this bird is in the chapter is that it rides cattle:
    // "a bird named after an animal that was not here settled for a rodent",
    // says the note on panBuildCattle — and then seventeen nelore went in and
    // nothing changed, so it went on hopping about on the mud. It perches on
    // the nearest one, and it follows that one about, and a capybara is what
    // it settles for when there is no cow within forty-five metres.
    if (panCowOn >= 0 && panCowOn < panCows.length) {
      const c = panCows[panCowOn];
      panCowHome.x = c.x; panCowHome.z = c.z;
      // the hump is at 1.30 and the bird stands just behind it
      panCowbird.position.set(c.x - Math.sin(c.yaw) * 0.30, panBedH(c.x, c.z) + 1.46,
                              c.z - Math.cos(c.yaw) * 0.30);
      panCowbird.rotation.y = c.yaw + Math.sin(panTime * 0.7) * 0.7;
    } else {
      const h = panBedH(panCowHome.x, panCowHome.z);
      panCowbird.position.set(panCowHome.x + Math.sin(panTime * 0.6) * 1.4, h + 0.16,
                              panCowHome.z + Math.cos(panTime * 0.45) * 1.4);
      panCowbird.rotation.y = panTime * 0.5;
    }
    const d = Math.hypot(p.x - panCowHome.x, p.z - panCowHome.z);
    const still = Math.hypot(capy.velocity.x, capy.velocity.z) < 0.7;
    if (d < 13 && still && panCowT > 1.2) { panCowState = "fly"; panCowT = 0; }
    // ...and if the player wanders off it hops somewhere else, so it is never
    // more than about forty metres from wherever the animal has got to
    if (d > 26) panCowPerch(p.x, p.z);
  } else if (panCowState === 'fly') {
    const t = clamp(panCowT / 1.4, 0, 1);
    const tx = p.x, ty = p.y + 0.62, tz = p.z;
    panCowbird.position.lerp(panV3.set(tx, ty + (1 - t) * 2.2, tz), 1 - Math.exp(-7 * dt));
    panCowbird.rotation.z = Math.sin(panCowT * 22) * 0.3 * (1 - t);
    if (t >= 1) { panCowState = 'ride'; panCowT = 0; panCowRide = 0; }
  } else {
    panCowRide += dt;
    // ---- AND THIS ONE DELIBERATELY GETS NO LIVE LINE (v32) ----------------
    // `cowbird` is on the brief's list of measured runs and it is the one that
    // does not belong there, which only the measurement showed. It is not an
    // attempt a player OPENS: the bird lands on its own within a couple of
    // seconds of the spawn and stays for up to seventy, so a plain
    // `recordLive` here was up on 60 samples out of 60 standing still, and
    // gating it on the animal moving — 'carried it for' does mean carrying —
    // only took it to 562 out of 605 over sixty seconds of ordinary walking.
    // Both of those are a permanent counter on the paper, which is exactly the
    // furniture this channel must never become. The line belongs to things you
    // GO AND DO; the bird is something that happens to you. The record itself
    // is untouched and still files at the end of the ride, as it always did.
    const yaw = capy.group ? capy.group.rotation.y : 0;
    // ---- AND IT IS DOING SOMETHING UP THERE ------------------------------
    // Twenty seconds is a long time to look at a bird standing perfectly still
    // on your own back — which is what it did, at a fixed offset, with one
    // slow sine on its yaw. A cowbird on a capybara is WORKING: it walks up
    // and down the back picking ticks, and every few seconds it puts its head
    // down hard. That is the entire joke of the animal and the reason the task
    // exists, and none of it was drawn.
    //
    // Three numbers. It patrols shoulder to rump; it dips on its own clock;
    // and the dip is a pitch and a drop rather than a new animation.
    panCowWalk += dt * 0.55;
    const along = Math.sin(panCowWalk) * 0.22;           // shoulder to rump
    const across = Math.sin(panCowWalk * 1.7) * 0.09;
    panCowPeck -= dt;
    if (panCowPeck <= 0) {
      panCowPeck = rand(1.4, 3.6);
      panCowDip = 0.34;
      panSfx.volume = 0.055; panSfx.pitch = rand(2.6, 3.3);
      game.sfx('tick', panSfx);
    }
    if (panCowDip > 0) panCowDip -= dt;
    const dip = panCowDip > 0 ? Math.sin(clamp(panCowDip / 0.34, 0, 1) * Math.PI) : 0;
    panCowbird.position.set(p.x - Math.sin(yaw) * (0.15 + along) - Math.cos(yaw) * across,
                            p.y + 0.60 - dip * 0.16,
                            p.z - Math.cos(yaw) * (0.15 + along) + Math.sin(yaw) * across);
    panCowbird.rotation.x = dip * 1.0;
    panCowbird.rotation.y = yaw + Math.sin(panTime * 0.9) * 0.6;
    panCowbird.rotation.z = 0;
    // ...and the clock is on the paper while it is up there (v36). Two seconds
    // of floor: a bird that touched down and left again is not a ride. It
    // cannot fight the herd's line, because that one is a flash on change
    // rather than a line that stays up (see panUpdateHerd), and the crossing
    // outranks both — panUpdateTasks runs after this.
    if (panCowRide > 2 && game.recordLive) game.recordLive('cowbird', panCowRide);
    if (panCowRide > 20) panTask(game, 'cowbird');
    // it leaves if you go swimming, which is fair enough
    if (capy.swimming || panCowRide > 70) {
      // ONCE, WHEN THE RIDE ENDS — never every frame. `record` toasts every
      // time the number improves, so calling it per frame on a value that is
      // climbing fires a personal best SIXTY TIMES A SECOND. Measured: two
      // stacked toasts reading "carried it for 1.6 s" over the animal's head
      // while the bird was still sitting on it.
      game.record('cowbird', panCowRide);
      panCowState = 'ground'; panCowT = 0;
      panCowPerch(p.x, p.z);
    }
  }
}

/**
 * WHERE THE COWBIRD GOES WHEN IT IS NOT ON YOU.
 *
 * A cow if there is one within forty-five metres, and otherwise a piece of
 * ground that is actually out of the water. THE SECOND HALF OF THAT IS A BUG
 * FIX: the perch was `clamp(p.x + rand(-14, 14))` with no probe at all, so a
 * player who stood still while SWIMMING — in the baia, in the river, on the
 * floating meadow, which is three of the chapter's twelve tasks — sent the
 * bird to a point in open water, where it sat at `panBedH + 0.16`. In the
 * middle of the baia that is two metres UNDER the surface, and
 * `game.pantanal.cowbird()` is a hint-arrow target, so the card pointed at a
 * bird nobody could see.
 */
function panCowPerch(px, pz) {
  panCowOn = -1;
  let bd = 45 * 45;
  for (let i = 0; i < panCows.length; i++) {
    const c = panCows[i];
    const dx = c.x - px, dz = c.z - pz;
    const d = dx * dx + dz * dz;
    if (d < bd) { bd = d; panCowOn = i; }
  }
  if (panCowOn >= 0) {
    panCowHome.x = panCows[panCowOn].x;
    panCowHome.z = panCows[panCowOn].z;
    return;
  }
  for (let k = 0; k < 14; k++) {
    const x = clamp(px + rand(-16, 16), -110, 110);
    const z = clamp(pz + rand(-16, 16), -110, 96);
    if (panBedH(x, z) > panWATER + 0.25 && panOnRoad(x, z) <= 0) {
      panCowHome.x = x; panCowHome.z = z;
      return;
    }
  }
  // nothing dry within sixteen metres: it goes back to the fazenda, which is
  // the only high ground for eighty kilometres and is where it came from
  panCowHome.x = panFAZENDA.x - 22; panCowHome.z = panFAZENDA.z;
}

/** The two returns off the gallery forest. See panWheek. */
function panUpdateEcho(game, dt) {
  for (let i = 0; i < 2; i++) {
    if (panEchoT[i] < 0) continue;
    panEchoT[i] -= dt;
    if (panEchoT[i] > 0) continue;
    panEchoT[i] = -1;
    panSfx.volume = i === 0 ? 0.12 : 0.055;
    panSfx.pitch = i === 0 ? rand(0.80, 0.90) : rand(0.68, 0.78);
    game.sfx('wheek', panSfx);
  }
}

/**
 * THE CATTLE. Slow, and that is the entire design.
 *
 * A nelore in the afternoon takes one step every eight seconds and spends the
 * rest of it looking at the middle distance. What matters at this camera
 * height is that a HERD of white shapes on green is a texture that MOVES, so
 * the requirement is only that no two of them ever step at the same moment.
 */
let panCowsOffered = false;
function panUpdateCattle(game, dt) {
  if (!panCattle) return;
  // ---- THE CATTLE WILL FOLLOW YOU TOO (see THE HERD in systems.js) -------
  // obey 1: a cow will follow anything that looks like it is going somewhere,
  // and the Pantanal is where the animal learns that this works at all.
  //
  // ONLY THE THIRTEEN OUT ON THE CAMPO. The other eleven are in the corral and
  // the peão is counting them; a cow that walks out through the rails behind a
  // capybara is a cow that has broken the one bit of arithmetic anybody in this
  // chapter is doing. The index is shifted past the penned ones rather than
  // filtered, because a `count` that reports twenty-four and an `at` that
  // sometimes declines is a registry with a hole in the middle of it.
  //
  // The chapter's own capybara herd is deliberately NOT offered anywhere: it
  // has a native follower system and two of them would fight over the same
  // nine animals.
  if (!panCowsOffered && typeof game.herdOffer === 'function') {
    panCowsOffered = true;
    const free = function (i) { return panCows[i + 11] || null; };
    game.herdOffer({
      biome: 'pantanal', kind: 'cow', obey: 1, voice: 'wheek', pitch: 0.55,
      count: function () { return Math.max(0, panCows.length - 11); },
      at: function (i, o) {
        const c = free(i);
        if (!c) return;
        o.x = c.x; o.z = c.z; o.y = panBedH(c.x, c.z);
      },
      put: function (i, x, z, yaw) {
        const c = free(i);
        if (!c) return;
        c.x = x; c.z = z; c.yaw = yaw;
        c.hx = x; c.hz = z;             // ...and it grazes wherever it ends up
        c.moving = 1;
      },
    });
  }
  for (let i = 0; i < panCows.length; i++) {
    const c = panCows[i];
    c.t -= dt;
    if (c.t <= 0) {
      c.t = rand(6, 17);
      const r = c.pen ? 8.5 : 13;
      let tx = c.hx + rand(-r, r), tz = c.hz + rand(-r, r);
      // ---- AND A PENNED COW STAYS IN ITS PEN ------------------------------
      // The eleven in the corral are seeded up to 10.5 m from the middle of a
      // ring 13 m across, and then take steps of up to 8.5 m from where they
      // were seeded: nineteen metres of reach against a thirteen-metre fence,
      // so over a few minutes the herd the peão is counting walks out through
      // the rails one at a time. (The fence is solid to the PLAYER; a cow is
      // an instanced matrix and has never been in the physics at all.)
      if (c.pen) {
        const dx = tx - panPEN.x, dz = tz - panPEN.z;
        const d = Math.hypot(dx, dz);
        if (d > panPEN.r - 1.6) {
          const k = (panPEN.r - 1.6) / (d || 1);
          tx = panPEN.x + dx * k; tz = panPEN.z + dz * k;
        }
      } else if (panOnRoad(tx, tz) > 0) { tx = c.hx; tz = c.hz; }
      if (panBedH(tx, tz) < panWATER + 0.15) { tx = c.hx; tz = c.hz; }
      c.tx = tx; c.tz = tz;
    }
    const dx = (c.tx === undefined ? c.x : c.tx) - c.x;
    const dz = (c.tz === undefined ? c.z : c.tz) - c.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d > 0.3) {
      const k = Math.min(1, (0.62 * dt) / d);
      c.x += dx * k; c.z += dz * k;
      c.yaw = dampAngle(c.yaw, Math.atan2(dx, dz), 3, dt);
      c.moving = 1;
    } else c.moving = 0;
    // ...and when something shouts, they all look at it, which is the single
    // most cow thing a cow does
    if (c.look > 0) {
      c.look -= dt;
      c.yaw = dampAngle(c.yaw, Math.atan2(c.lx - c.x, c.lz - c.z), 2.6, dt);
    } else if (panFollowing >= 3 && !c.pen) {
      // ...AND A LINE OF NINE CAPYBARAS IS SOMETHING TO LOOK AT. Same argument
      // as the jacares above: the herd is the chapter's toy and nothing in the
      // world had ever noticed it. Only the loose cattle — the eleven in the
      // corral have a fence and a peão between them and the campo — and only
      // the leader is tracked, because seventeen cows swinging their heads
      // along a moving column one animal at a time is a wave, and a wave is
      // what a herd going past actually looks like from a pasture.
      const hd = Math.hypot(c.x - panHerd[0].x, c.z - panHerd[0].z);
      if (hd < 22 && panHerd[0].st === 'follow') {
        c.look = rand(1.6, 3.2);
        c.lx = panHerd[0].x; c.lz = panHerd[0].z;
      }
    }
    const y = panBedH(c.x, c.z);
    const bob = c.moving ? Math.abs(Math.sin(panTime * 4 + c.ph)) * 0.045
                         : Math.sin(panTime * 0.8 + c.ph) * 0.014;
    panM.compose(panV3.set(c.x, y + bob, c.z),
                 panQ.setFromEuler(panE.set(0, c.yaw, 0)), panSc.set(1, 1, 1));
    panCattle.setMatrixAt(i, panM);
  }
  panCattle.instanceMatrix.needsUpdate = true;
}

/**
 * THE JACARES, AND FOR THEIR WHOLE LIFE THEY WERE FURNITURE.
 *
 * Fourteen instanced matrices written once at build time and never touched
 * again, in a chapter whose own opening line promises "a lizard the length of
 * a car". Three things, none of them a state machine:
 *
 *   THE GAPE. A crocodilian cannot sweat and cannot pant, so on a hot
 *   afternoon it lies with its jaws wide open and thermoregulates through the
 *   roof of its mouth. It is the only thing they do all day and it is the one
 *   that reads from six metres up.
 *
 *   THE SLIDE. Get too close, or shout, and it is in the water inside a
 *   second and a half — nose first, tail last, and then a bow wave going away
 *   from you. Nothing else in this chapter is startled by the capybara and
 *   that is the joke; a jacare is not startled BY you, it is simply a jacare,
 *   and it does this to everything.
 *
 *   AND THEN IT COMES BACK, because the sandbar is where it wants to be.
 */
function panUpdateCaimans(game, dt) {
  if (!panCaimans) return;
  const capy = game.capy;
  const p = capy && capy.body ? capy.body.position : null;
  panUpdateHunt(game, dt, p);
  if (!panCaimanCrit && typeof game.addCritter === 'function') {
    // 4.243 m is a body length — sqrt(18), the radius three lines down, which
    // is where that squared literal came from. See THE CALM REGISTRY above for
    // why this one passes k: 0.3 and will never pass a bold.
    panCaimanCrit = game.addCritter({ biome: 'pantanal', r: 4.243, k: 0.3, bold: 0 });
  }
  const cai2 = panCaimanCrit ? panCaimanCrit.near * panCaimanCrit.near : 18;
  for (let i = 0; i < panCAIMAN_N; i++) {
    const c = panCaimanAt[i];
    // ---- does it want to be in the water? --------------------------------
    if (p && c.slide <= 0) {
      const dx = c.x - p.x, dz = c.z - p.z;
      // 4.2 m, which is a body length: close enough that a real one would have
      // gone. Deliberately NOT close enough to make 'sit on a sleeping jacare'
      // impossible — that task is on the eight on the sandbar, and they only
      // go if you come at them across open sand rather than off the water.
      if (dx * dx + dz * dz < cai2 && p.y < c.y0 + 0.6) c.slide = rand(3.4, 5.0);
      // ---- AND NINE OF THEM GO PAST AND NOTHING HAPPENS --------------------
      //
      // The chapter's signature toy is the LINE — a herd recruited one animal
      // at a time and led across a river — and `panHerd` was read by exactly
      // three things: the herd's own updater, the wheek, and the task check.
      // Nothing in the world knew the line existed. Fourteen jacares, seventeen
      // nelore, five otters and thirteen egrets all already carry a reaction
      // driven by an (x, z) the player supplies, and a column of nine capybaras
      // filing past two metres away fired none of them.
      //
      // Tighter than the player's radius and deliberately: a jacare that has
      // already let one capybara past is not going to bolt at the fourth. It
      // takes a near miss, which is what walking your herd THROUGH them is.
      if (c.slide <= 0 && panFollowing > 0) {
        for (let k = 0; k < panHERD_N; k++) {
          const r = panHerd[k];
          if (r.st !== 'follow') continue;
          const hx = c.x - r.x, hz = c.z - r.z;
          if (hx * hx + hz * hz < 7.3) { c.slide = rand(2.8, 4.4); break; }
        }
      }
    }
    let y = c.y0, pitch = 0, roll = 0;
    if (c.slide > 0) {
      c.slide -= dt;
      // a second and a half down, a long wait, and two seconds back up
      const t = c.slide;
      const k = t > 3.0 ? panSmooth((5.0 - t) / 1.5)
              : t > 2.0 ? 1
              : panSmooth(t / 2.0);
      y = lerp(c.y0, panWATER - 0.34, k);
      pitch = -0.24 * k;
      if (k > 0.02 && k < 0.35 && Math.random() < dt * 5) {
        panRipple(c.x, c.z, 1.5);
        panSfx.volume = rand(0.10, 0.20); panSfx.pitch = rand(0.7, 1.0);
        game.sfx('splash', panSfx);
      }
      c.gape = damp(c.gape, 0, 5, dt);
    } else {
      // ---- the gape, on its own long clock -------------------------------
      c.gapeT -= dt;
      if (c.gapeT <= 0) { c.gapeT = rand(11, 26); c.gapeOn = c.gapeOn ? 0 : 1; }
      c.gape = damp(c.gape, c.gapeOn ? 1 : 0, 1.6, dt);
      roll = Math.sin(panTime * 0.5 + c.ph) * 0.02;
    }
    // ---- the hunter, and the one that has just gone under (W1) ------------
    let cx = c.x, cz = c.z, cyaw = c.yaw0;
    // ...and O Grandão between rounds (X4): under, on its way round, not
    // lying back on its bank at one times the size until it resurfaces
    const bossUnder = panHuntOn && i === panHuntI && panBossUnder > 0;
    if (c.hunt) {
      cx = c.hx; cz = c.hz; cyaw = c.hyaw;
      y = panWATER - 0.20 + Math.sin(panTime * 3.1 + c.ph) * 0.03;
      pitch = 0.04; roll = Math.sin(panTime * 2.2 + c.ph) * 0.04;
      c.gape = damp(c.gape, 0, 5, dt);
    } else if (bossUnder) {
      cx = c.hx; cz = c.hz; cyaw = c.hyaw;
      y = panWATER - 2.5;
    } else if (c.gone > 0) {
      c.gone -= dt;
      y = panWATER - 2.5;           // under, out of sight, on its way home
      if (c.gone <= 0) { c.slide = 2.0; }   // ...and it surfaces back on its bank
    }
    c.y = y;
    // The gape is drawn by lifting the SNOUT, which on this model is the front
    // 95 cm of it: a yaw-space pitch on the whole animal opens the jaw and
    // digs the tail in, and at 12 degrees over a 3.4 m body that is 35 cm of
    // tail underground. So the pitch is small and the animal is RAISED with it.
    // O Grandão (X4): the hunter is drawn at twice the size — the big one
    const bs = (c.hunt || bossUnder) ? panBOSS_SCALE : 1;
    panM.compose(panV3.set(cx, y + c.gape * 0.05, cz),
                 panQ.setFromEuler(panE.set(pitch - c.gape * 0.055, cyaw, roll)),
                 panSc.set(bs, bs, bs));
    panCaimans.setMatrixAt(i, panM);
  }
  panCaimans.instanceMatrix.needsUpdate = true;
}

/** The pads do not move. The flowers are a clock, and the clock is the dusk. */
function panUpdateLilies(dt) {
  if (!panLilyFlower) return;
  // ONE FLOWER TO A RAFT, AND THEY ARE SHUT ALL DAY. Victoria opens white at
  // dusk and is pink by the second night, which is real and is also exactly
  // the shape of this chapter: the crossing switches the evening on, and the
  // bay is the only place besides the sky that says so.
  const open = panSmooth(panDusk * 1.25);
  const n = Math.min(panFLOWER_N, panLilies.length);
  const ca = panLilyFlower.instanceColor;
  for (let i = 0; i < panFLOWER_N; i++) {
    if (i >= n) {
      panM.compose(panV3.set(0, -900, 0), panQ.setFromEuler(panE.set(0, 0, 0)), panSc.set(0.001, 0.001, 0.001));
      panLilyFlower.setMatrixAt(i, panM);
      continue;
    }
    // spread across the rafts rather than the first nine of one of them
    const L = panLilies[Math.floor(i * panLilies.length / panFLOWER_N)];
    const s = 0.55 + open * 0.85;
    panM.compose(panV3.set(L.x + Math.cos(L.ph) * L.s * 0.24, panWATER + 0.05,
                           L.z + Math.sin(L.ph) * L.s * 0.24),
                 panQ.setFromEuler(panE.set(0, L.ph, 0)), panSc.set(s, 0.5 + open, s));
    panLilyFlower.setMatrixAt(i, panM);
    // white on the first night, pink on the second. Here it simply warms with
    // the light, which is the same read and needs no second clock.
    panCol.set(PALETTE.panLilyBud);
    panCol2.set(PALETTE.panHyaFlower);
    panCol.lerp(panCol2, open * 0.55);
    ca.array[i * 3] = panCol.r; ca.array[i * 3 + 1] = panCol.g; ca.array[i * 3 + 2] = panCol.b;
  }
  ca.needsUpdate = true;
  panLilyFlower.instanceMatrix.needsUpdate = true;
}

/**
 * THE CAMALOTE, GOING PAST. The drifters ride the chapter's own flow field, so
 * they and the swimming animal are moved by the same number; the jam does not
 * move at all beyond breathing, because it is aground.
 */
function panUpdateRafts(dt) {
  if (!panRaftMesh) return;
  for (let i = 0; i < panRAFT_N; i++) {
    if (i >= panRAFT_JAM) {
      panFlowAt(panRaftX[i], panRaftZ[i], panRaftFlow);
      panRaftX[i] += panRaftFlow.x * dt;
      panRaftZ[i] += panRaftFlow.z * dt;
      // ...and it goes ROUND the bar rather than over it, which is the whole
      // reason there is a jam on the other side of this line
      const sdx = panRaftX[i] - panSANDBAR.x, sdz = panRaftZ[i] - panSANDBAR.z;
      const sd = Math.sqrt(sdx * sdx + sdz * sdz * 2.2);
      if (sd < panSANDBAR.r + 1.5) panRaftZ[i] += (sdz >= 0 ? 1 : -1) * 2.2 * dt;
      if (panRaftX[i] > 112) {
        panRaftX[i] = -112;
        panRaftZ[i] = (panRIVER.z0 + panRIVER.z1) * 0.5 + (rand(-1, 1) + rand(-1, 1)) * 7.5;
      }
    }
    const s = panRaftS[i];
    const ph = panRaftP[i];
    panM.compose(panV3.set(panRaftX[i], panWATER + 0.02 + Math.sin(panTime * 0.7 + ph) * 0.025,
                           panRaftZ[i]),
                 panQ.setFromEuler(panE.set(Math.sin(panTime * 0.5 + ph) * 0.03,
                                            ph + panTime * 0.035,
                                            Math.cos(panTime * 0.42 + ph) * 0.03)),
                 panSc.set(s, 1, s));
    panRaftMesh.setMatrixAt(i, panM);
  }
  panRaftMesh.instanceMatrix.needsUpdate = true;
}

/** The wake. One ring, one and a half seconds, and it dies where it started. */
function panUpdateRipples(game, dt) {
  if (!panRipMesh) return;
  if (panRipCool > 0) panRipCool -= dt;
  const capy = game.capy;
  // THE PLAYER'S OWN, and it is the one that matters: half this map is under
  // two inches of water and until now walking across it was silent, still and
  // completely without consequence.
  if (capy && capy.body && panRipCool <= 0) {
    const p = capy.body.position;
    const sp = Math.hypot(capy.body.velocity.x, capy.body.velocity.z);
    const bed = panBedH(p.x, p.z);
    if (sp > 1.1 && bed < panWATER + 0.05 && p.y < panWATER + 1.4) {
      panRipCool = clamp(0.80 - sp * 0.045, 0.34, 0.80);
      panRipple(p.x, p.z, 0.42 + clamp(sp * 0.05, 0, 0.34));
    }
  }
  let live = 0;
  for (let i = 0; i < panRIP_N; i++) {
    if (panRipT[i] > 1.5) {
      panM.compose(panV3.set(0, -900, 0), panQ.setFromEuler(panE.set(0, 0, 0)), panSc.set(0.01, 0.01, 0.01));
      panRipMesh.setMatrixAt(i, panM);
      continue;
    }
    panRipT[i] += dt;
    live++;
    const t = panRipT[i] / 1.5;
    const r = panRipS[i] * (0.5 + t * 2.4);
    panM.compose(panV3.set(panRipX[i], panWATER + 0.035, panRipZ[i]),
                 panQ.setFromEuler(panE.set(0, 0, 0)), panSc.set(r, 1, r));
    panRipMesh.setMatrixAt(i, panM);
  }
  panRipMesh.instanceMatrix.needsUpdate = true;
  panRipMesh.visible = live > 0;
  // one material, one opacity: they all fade on the same curve and the newest
  // is always the brightest, which is what a set of expanding rings looks like
  if (panRipMat) panRipMat.opacity = 0.20;
}

/**
 * THE INSECTS. Dragonflies by day over open water, fireflies at dusk over the
 * grass, and the changeover IS the dusk — one number, two populations.
 */
function panUpdateBugs(dt) {
  if (!panBugs) return;
  const night = panSmooth(panDusk * 1.1);
  for (let i = 0; i < panBUG_N; i++) {
    const o = i * 6;
    const fly = i % 3 === 0;                     // a firefly; the rest are odonates
    // a firefly is nowhere at four in the afternoon and everywhere at seven
    const on = fly ? night : 1 - night * 0.55;
    panBugData[o + 3] += panBugData[o + 5] * dt;
    const a = panBugData[o + 3];
    const r = panBugData[o + 4];
    const x = panBugData[o] + Math.cos(a) * r;
    const z = panBugData[o + 1] + Math.sin(a) * r * 0.8;
    // a dragonfly hangs and then DARTS, which is a stepped sine and not a
    // smooth one; a firefly drifts and blinks, which is the same curve slower
    const jerk = fly ? 0 : Math.pow(Math.max(0, Math.sin(a * 3.1)), 6) * 0.9;
    const y = panBedH(x, z) + panBugData[o + 2] + Math.sin(panTime * (fly ? 0.8 : 2.6) + i) * 0.35 + jerk;
    const s = on * (fly ? 0.55 + Math.pow(Math.max(0, Math.sin(panTime * 1.7 + i * 2.1)), 8) * 0.9 : 1);
    panM.compose(panV3.set(x, y, z), panQ.setFromEuler(panE.set(0, a + 1.57, jerk * 0.4)),
                 panSc.set(s, s, s));
    panBugs.setMatrixAt(i, panM);
  }
  panBugs.instanceMatrix.needsUpdate = true;
}

/**
 * THE EGRETS. THIRTEEN OF THEM, ONCE, AND THEY DO NOT COME BACK.
 *
 * THIS IS THE CEREMONY OF THE CHAPTER AND IT USED TO HAPPEN OFF SCREEN.
 *
 * They were flown as a line crossing the whole width of the map at
 * `panRIVER.z1 + 16` and four and a half metres up. Two things are wrong with
 * that, and both were measured from the marquee's OWN camera rather than from
 * a wide shot:
 *
 *  1. `z1 + 16` is sixteen metres NORTH of the bank the herd goes in at, and
 *     the crossing is swum SOUTHWARD with the rig seven metres behind the
 *     swimmer's shoulder. Every bird was behind the camera for all eleven
 *     seconds.
 *  2. And moving them south would not have fixed it. The rig is 7.6 m up and
 *     pitched 45 degrees down, so the top of the frame is about 20 degrees
 *     below horizontal: anything at four metres of altitude is out of shot the
 *     moment it is more than ten metres ahead. A flight of birds ACROSS THE
 *     SKY is not a thing this camera can photograph at all.
 *
 * So they do not fly past. They are STANDING IN THE SHALLOWS — which is where
 * thirteen egrets actually are at six in the evening — strung down the length
 * of the crossing, and they go up one after another as the animal comes down
 * the river at them. Each bird lifts about four metres ahead of the swimmer,
 * dead centre of the frame, and is gone over the top of it two seconds later.
 * The flush is the picture, and the flush is a thing the player CAUSED.
 */
function panUpdateEgrets(game, dt) {
  if (!panEgrets) return;
  if (panEgretGone) { if (panEgrets.visible) panEgrets.visible = false;
                      if (panEgretStand && panEgretStand.visible) panEgretStand.visible = false; return; }
  // THEY ARE STANDING THERE BEFORE ANYTHING HAPPENS, which is the half of this
  // that makes the flush a flush. A line of white birds appearing out of
  // nothing five metres in front of you is a spawn; a line of white birds you
  // have been able to see from the road since you arrived, going up one after
  // another as you swim at them, is the chapter.
  const prev = panEgretT;
  if (panEgretT >= 0) {
    panEgretT += dt;
    if (panEgretT > 15) { panEgretT = -1; panEgretGone = true; panEgrets.visible = false;
                          if (panEgretStand) panEgretStand.visible = false; return; }
  }
  panEgrets.visible = true;
  if (panEgretStand) panEgretStand.visible = true;
  let standing = 0;
  for (let i = 0; i < panEGRET_N; i++) {
    // WHERE IT WAS STANDING, AND IT HAS TO BE SOMETHING IT CAN STAND ON.
    // The first cut put them at `panCROSS.x ± (3.4..12.6)` on the river's own
    // z line and called it "the shallow water on the inside of the bend" —
    // there is no bend and there are no shallows: measured, the bed under all
    // thirteen of them was −4.20 m, so the chapter's ceremony was thirteen
    // wading birds standing on four and a half metres of open channel. They
    // are on the SNAGS now (see panBuildCrossing), which is where an egret on
    // a river like this actually is, and the snags are also the thing that
    // gives the marquee a middle distance.
    const o = (i % (panSnagAt.length || 1)) * 3;
    const jit = (i / Math.max(1, panSnagAt.length)) | 0;
    const bx = panSnagAt.length ? panSnagAt[o] + jit * 1.5 : panCROSS.x + 4;
    const by = panSnagAt.length ? panSnagAt[o + 1] : panWATER + 0.3;
    const bz = panSnagAt.length ? panSnagAt[o + 2] + jit * 1.1 : panRIVER.z1 - 4 - i * 1.45;
    // ...and it goes when the animal is on top of it. 0.62 s apart is 1.6 m of
    // swimming, which is the gap between them: the line flushes at exactly the
    // speed a capybara crosses a river.
    const lift = i * 0.62;
    const t = panEgretT - lift;
    if (t < 0) {
      // Standing, and shifting its weight, because a waiting heron never
      // stops. On its OWN model — see panBuildEgrets — because a flight pose
      // squeezed in x is a bird lying on the water, which is what this was.
      if (panEgretStand) {
        const sway = Math.sin(panTime * 0.5 + i) * 0.4;
        panM.compose(panV3.set(bx, by, bz),
                     panQ.setFromEuler(panE.set(Math.sin(panTime * 0.31 + i * 2.1) * 0.05,
                                                2.2 + sway, 0)),
                     panSc.set(1, 1, 1));
        panEgretStand.setMatrixAt(i, panM);
        standing++;
      }
      panM.compose(panV3.set(0, -900, 0), panQ.setFromEuler(panE.set(0, 0, 0)),
                   panSc.set(0.001, 0.001, 0.001));
      panEgrets.setMatrixAt(i, panM);
      continue;
    }
    if (panEgretStand) {
      panM.compose(panV3.set(0, -900, 0), panQ.setFromEuler(panE.set(0, 0, 0)),
                   panSc.set(0.001, 0.001, 0.001));
      panEgretStand.setMatrixAt(i, panM);
    }
    if (prev - lift <= 0 && t > 0) {
      // one wingbeat off the water, rationed by how many are already going
      panSfx.volume = clamp(0.26 - i * 0.012, 0.08, 0.26);
      panSfx.pitch = rand(1.5, 1.9);
      game.sfx('rustle', panSfx);
      panRipple(bx, bz, 0.5);
    }
    // the climb: hard for the first second and a half, then it is just flying
    const climb = panSmooth(t / 1.5);
    const y = by + 0.30 + climb * 5.0 + Math.max(0, t - 1.5) * 1.15;
    // away down the river and out of the frame, which is what a flushed bird
    // does — it does not circle, it leaves
    const run = t * (2.0 + climb * 9.0);
    const dir = (i % 2 ? 1 : -1);
    const x = bx + dir * run * 0.86;
    const z = bz - run * 0.30;
    // the wingbeat is a ROLL, because at this size a flapping wing is two
    // boxes and a roll is the only part of it anybody can see. It is FAST on
    // the climb and slow once it has way on.
    const beat = Math.sin(panTime * (11 - climb * 6) + i * 0.8);
    const s = (t < 12) ? 1 : 0.001;
    panM.compose(panV3.set(x, y, z),
                 panQ.setFromEuler(panE.set(beat * 0.10 - climb * 0.18, dir * Math.PI / 2 - dir * 0.30,
                                            beat * (0.15 + climb * 0.34))),
                 panSc.set(s, s, s));
    panEgrets.setMatrixAt(i, panM);
  }
  panEgrets.instanceMatrix.needsUpdate = true;
  if (panEgretStand) {
    panEgretStand.instanceMatrix.needsUpdate = true;
    panEgretStand.visible = standing > 0;
  }
}

/** The macaws: three in the palm, and they go up when anything happens. */
function panUpdateMacawFlight(game, dt) {
  if (panMacawFly > 0) panMacawFly -= dt;
  panMacawHome = damp(panMacawHome, panMacawFly > 0 ? 0 : 1, 2.2, dt);
}

/**
 * EVERYTHING ELSE ON THE LIST, AND THE ONE THING THE CHAPTER IS FOR.
 *
 * The crossing is not a stunt and it is not timed. It is a state: you are in
 * the river, there are at least four of them behind you, and it is sundown —
 * and the sundown is not on a clock, it STARTS when you go in. The light does
 * the ceremony; the score holds the swell for the whole width of the water.
 */
function panUpdateTasks(game, dt) {
  const capy = game.capy;
  if (!capy || !capy.body) return;
  const p = capy.body.position;
  const input = game.input;

  // ---- the nest ----------------------------------------------------------
  {
    const dx = p.x - panNEST.x, dz = p.z - panNEST.z;
    const h = panBedH(panNEST.x, panNEST.z);
    if (dx * dx + dz * dz < 25 && p.y > h + 5.6) panTask(game, 'jabiru-nest');
  }
  // ---- the palm nut ------------------------------------------------------
  if (input.actionPressed && !capy.heldProp) {
    const dx = p.x - panPALM.x, dz = p.z - panPALM.z;
    if (dx * dx + dz * dz < 20) {
      panTask(game, 'macaw-nut');
      panSfx.volume = 0.4; panSfx.pitch = 2.6;
      game.sfx('pop', panSfx);
      game.toast('three of them are shouting at you.');
      // ...AND NOW THEY ACTUALLY ARE. The toast has promised this since the
      // chapter shipped over three birds that never moved a millimetre.
      panMacawFly = 7.5;
      for (let i = 0; i < 2; i++) {
        panSfx.volume = 0.3; panSfx.pitch = rand(2.2, 3.0);
        game.sfx('bark', panSfx);
      }
    }
  }
  // ---- sitting on a jacare ----------------------------------------------
  // ON ONE, NOT NEAR ONE. The old test was a 2.05 m radius and a two-metre
  // height band with NOTHING SOLID INSIDE IT — the caimans had no colliders at
  // all — so the height band was satisfied by standing on the sandbar beside
  // the animal and the task ticked itself for walking past. Now there is a
  // 32 cm step to get onto, so the test is the one that was always meant: your
  // feet are above its back, you are inside its outline, and you are still.
  {
    let on = false;
    for (let i = 0; i < panCAIMAN_N; i++) {
      const c = panCaimanAt[i];
      if (c.slide > 0) continue;                    // it is in the water; nobody is on it
      const dx = p.x - c.x, dz = p.z - c.z;
      const cs = Math.cos(c.yaw0), sn = Math.sin(c.yaw0);
      const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
      // FIFTY CENTIMETRES, MEASURED. A capybara at rest sits 0.355 m above
      // whatever it is standing on, so a 0.30 m floor was satisfied by
      // standing on the sand BESIDE the animal; on its back it is 0.675 up.
      // The gap between those two numbers is the whole test.
      if (Math.abs(lx) < 1.0 && Math.abs(lz) < 1.9 &&
          p.y > c.y + 0.46 && p.y < c.y + 1.6) { on = true; break; }
    }
    if (on) {
      panCaimanSit += dt;
      // ---- AND IT DECIDES NOT TO CARE, VISIBLY ---------------------------
      // The toast says "it knows. it has decided not to care." — which is a
      // very good line about an animal that did precisely nothing. The whole
      // pleasure of this task is that a two-hundred-kilo predator opens one
      // eye, works out what has happened, and goes back to sleep, and the
      // chapter asserted all of that in a sentence rather than drawing any of
      // it. `gape` and `gapeOn` are already built for the thermoregulating
      // yawn (see panUpdateCaimans); this is the same jaw, used for the joke.
      if (panCaimanSat < 0) {
        for (let i = 0; i < panCAIMAN_N; i++) {
          const c = panCaimanAt[i];
          const dx = p.x - c.x, dz = p.z - c.z;
          if (dx * dx + dz * dz < 6.5) { panCaimanSat = i; break; }
        }
        if (panCaimanSat >= 0) {
          // it opens one eye about a second in — long enough that the player
          // has already decided nothing is going to happen
          panCaimanNotice = 1.1;
        }
      }
      if (panCaimanNotice > 0) {
        panCaimanNotice -= dt;
        if (panCaimanNotice <= 0 && panCaimanSat >= 0) {
          const c = panCaimanAt[panCaimanSat];
          c.gapeOn = 1; c.gapeT = rand(3.4, 5.5);
          panSfx.volume = 0.13; panSfx.pitch = rand(0.42, 0.55);
          game.sfx('hiss', panSfx);
        }
      }
      if (panCaimanSit > 0.9) {
        panTask(game, 'caiman-nap');
        if (!panToldCaiman) {
          panToldCaiman = true;
          game.toast('it knows. it has decided not to care.');
        }
      }
    } else { panCaimanSit = 0; panCaimanSat = -1; panCaimanNotice = 0; }
  }
  // ---- the missing plank -------------------------------------------------
  {
    const b = panBRIDGES[1];
    // OVER THE HOLE AND ABOVE THE DECK: the gap is 1.25 m wide, so anything
    // whose centre is within 0.55 m of the middle of it has nothing underneath
    // and is therefore in the middle of a hop.
    if (Math.abs(p.z - b.z) < 0.55 && Math.abs(p.x - panRoadX(p.z)) < panROAD_W &&
        p.y > panROAD_Y + 0.3) {
      panTask(game, 'missing-plank');
    }
  }
  // ---- THE CROSSING ------------------------------------------------------
  const inRiver = panInZone('crossing', p.x, p.z) && p.z < panRIVER.z1 && p.z > panRIVER.z0;
  if (inRiver && panFollowing >= 4) {
    if (!panDuskGo) {
      panDuskGo = true;
      game.toast('they are all coming.');
      // THE CEREMONY. The sundown starts here — see the note on panUpdateTasks
      // — and it now has something to arrive WITH: thirteen egrets crossing the
      // whole width of the frame, low, going home, once and never again.
      panEgretT = 0;
      panSfx.volume = 0.30; panSfx.pitch = rand(1.3, 1.6);
      game.sfx('rustle', panSfx);
    }
    panCrossT += dt;
    panCrossN = Math.max(panCrossN, panFollowing);
    // how many are behind you, on the paper, in the middle of the water (v32).
    // `panCrossN` is the high-water mark and it is what gets filed, so the
    // figure the player watches is the figure the record will take.
    if (game.recordLive) game.recordLive('the-crossing', panCrossN);
    // the score lifts for the whole width of it, not for the tick at the end
    if (game.music && typeof game.music.swell === 'function') game.music.swell(0.85);
    // ...and the line, on the signpost (W1): how many are behind you NOW —
    // which the current is working on — and how far the far bank is.
    if (typeof game.wowLive === 'function' && !panHuntOn && panBossUnder <= 0 &&
        !(typeof game.taskDone === 'function' && game.taskDone('the-crossing'))) {
      const width = panRIVER.z1 - panRIVER.z0;
      const across = clamp((panRIVER.z1 - p.z) / width, 0, 1);
      game.wowLive('in the river · ' + panFollowing + ' behind you' +
                   (panFollowing < panCrossN ? ' (' + (panCrossN - panFollowing) + ' lost)' : '') +
                   ' · ' + Math.round((1 - across) * width) + ' m to the far bank', across);
    }
  }
  // THE ORDER OF THESE TWO IS THE WHOLE THING, and the first build had it
  // backwards: the moment the animal reaches the far bank it is no longer IN
  // the river, so an `else { panCrossT = 0 }` clears the state on exactly the
  // frame the task is supposed to fire. Measured — five of them followed the
  // whole way over and nothing happened. The crossing is only forgotten if you
  // go BACK, which is the only way to fail it.
  if (panCrossT > 0.5 && p.z < panRIVER.z0 - 1 && panCrossN >= 4) {
    panTask(game, 'the-crossing');
    game.record('the-crossing', panCrossN);
    // ---- AND THE FAR BANK IS THE END OF IT ------------------------------
    // The marquee is a STATE rather than a stunt, and the light has been doing
    // the ceremony for the whole width of the water — but the moment you
    // actually arrive got a tick on a card and silence. What happens when a
    // line of capybaras comes up a bank is that every one of them shakes, all
    // at slightly different moments, and the water comes off them: a run of
    // rings up the landing and a ragged handful of splashes. Held for four
    // seconds afterwards the same way the aurora and the sunrise are held.
    for (let i = 0; i < panHERD_N; i++) {
      const r = panHerd[i];
      if (r.st !== 'follow') continue;
      panRipple(r.x, r.z, 0.75);
      // ...AND EACH SHAKE COMES FROM THE ANIMAL THAT SHOOK. Nine capybaras
      // spread up to 26 m back along the bank, and all nine splashes arrived
      // from the same point, which is nowhere. `panSfx` is a shared options
      // object, so placeCue writes into the same one and nothing is allocated
      // in a loop that runs every crossing.
      panSfx.volume = rand(0.14, 0.26); panSfx.pitch = rand(0.8, 1.2);
      game.sfx('splash', placeCue(panSfx, r.x, panWATER, r.z, 60));
    }
    panShakeT = 2.4;
    // M4: the herd going into the river.
    if (typeof game.punch === 'function') game.punch(0.22, false); else game.shake(0.22);
    // ---- FRAMED. THE MARQUEE IS A LINE, AND IT WAS SHOT DOWN A BACK ----
    //
    // Measured at task:complete on a real keyboard crossing: the rig sits
    // dead astern (yaw -3.7 degrees), 8.12 m out, raised 7.50 m and pitched
    // 42.7 degrees DOWN — a top-down plate of mud and the animal’s back,
    // with ONE of five followers in the frame. Follower n trails
    // panFOLLOW_GAP * (n + 1), which is 15.6 m at five and 26.0 m at nine, so
    // the one thing this moment is about is a LINE, and a line has to be shot
    // from the side.
    //
    // The flow is +x (see panFlowAt), so a bearing of +1.90 rad puts the lens
    // downstream and broadside, near the waterline rather than over it, with
    // the whole herd across the frame. Held 4.2 s to cover panShakeT’s 2.4
    // and the settle after it.
    if (typeof game.frameShot === 'function')
      game.frameShot({ yaw: 1.90, dist: 16, pitch: 0.12, raise: 1.9, hold: 4.2 });
    // ---- AND THE TWO PEOPLE WHO WATCHED IT HAPPEN ---------------------
    // The chapter's wow, and until now the cattleman standing at the crossing
    // — whose entire reason for existing is that he watches this happen every
    // evening — went on saying the same four sentences he had been saying
    // before the capybara arrived.
    panSaysNow('cattleman',
      ['You brought them over. All of them. I counted, and I stopped counting.',
       'Thirty years at this crossing and I have never seen one at the FRONT.',
       'They go over here every evening. Tonight somebody led them.',
       'Sit down. It goes orange for about ten minutes and then the frogs start.'],
      ['They are all across. You can stop now.']);
    panSaysNow('guide',
      ['Thirteen egrets up in a line off the snags. That is the photograph.',
       'I have brought people here every dry season for exactly that and never got it.',
       'Capybara, one, leading. I do not have a column for leading.'],
      ['Quietly. It is nearly dark and everything is settling.']);
    panSfx.volume = 0.42; panSfx.pitch = rand(1.0, 1.2);
    game.sfx('wheek', placeCue(panSfx, p.x, panWATER + 0.4, p.z, 70));
    panCrossT = 0; panCrossN = 0;
  } else if (!inRiver && p.z > panRIVER.z1 + 4) {
    panCrossT = 0; panCrossN = 0;
    panHuntDone = false;                       // W1: the next crossing has one too
  }
  // ---- AND SOMEBODY SAYS SOMETHING ABOUT IT ----------------------------
  // See panCall. Every one of these is about the live state of the chapter
  // and none of them is on a clock of its own.
  if (panSayCool > 0) panSayCool -= dt;
  {
    const cx = panCROSS.x + 5, cz = panCROSS.z0 + 6;
    const cy = panTerrain(cx, cz) + 0.6;
    const bx = panRoadX(panBRIDGES[1].z) + 4.6, bz = panBRIDGES[1].z + 5;
    if (inRiver && panFollowing >= 4) {
      panCall(game, 'cross', cx, cy, cz, 'There. That is the whole thing, right there.', 200);
    } else if (panFollowing >= 1 && panFollowing < 4 &&
               Math.abs(p.x - cx) < 30 && p.z < panRIVER.z1 + 20) {
      panCall(game, 'count', cx, cy, cz,
              'You have ' + panFollowing + '. You want four. Go and ask the others.', 34);
    } else if (Math.abs(p.z - panBRIDGES[1].z) < 9 &&
               Math.abs(p.x - panRoadX(p.z)) < panROAD_W + 3) {
      panCall(game, 'plank', bx, panROAD_Y + 0.6, bz,
              'Careful. One plank. It has been one plank since February.', 60);
    } else if (panAntCarrying) {
      panCall(game, 'ant', panFAZENDA.x - 6, panTerrain(panFAZENDA.x - 6, panFAZENDA.z) + 0.6,
              panFAZENDA.z, 'It has not noticed. It never notices.', 90);
    } else if (panMatRun >= 2 && panMatRun < 6) {
      panCall(game, 'mat', panBAIA.x + panBAIA.r + 3,
              panTerrain(panBAIA.x + panBAIA.r + 3, panBAIA.z) + 0.6, panBAIA.z,
              'Keep going. It only holds while you are moving.', 40);
    } else if (panMacawFly > 4.5) {
      // the guide, under the dead tree, and this is the loudest thing that
      // happens all afternoon
      panCall(game, 'macaw', panNEST.x - 7, panTerrain(panNEST.x - 7, panNEST.z - 5) + 0.6,
              panNEST.z - 5, 'Arara-azul. Three of them. Do you know how few of those are left?', 70);
    } else if (panDusk > 0.35 && panDusk < 0.9) {
      // the man in the hammock, who is right about four o'clock and is also
      // right about what happens at six
      panCall(game, 'frogs', panFAZENDA.x + 13,
              panTerrain(panFAZENDA.x + 13, panFAZENDA.z + 8) + 0.6, panFAZENDA.z + 8,
              'There. Hear that? The birds stop and the frogs start. Ten minutes, every night.', 300);
    } else if (panCowState === 'ride' && panCowRide > 6 && panCowRide < 9) {
      panCall(game, 'bird', panFAZENDA.x - 22 + 13.6,
              panTerrain(panFAZENDA.x - 22 + 13.6, panFAZENDA.z + 1.5) + 0.6, panFAZENDA.z + 1.5,
              'It has picked you over seventeen cattle. Do not let it go to your head.', 80);
    }
  }
  panDusk = damp(panDusk, panDuskGo ? 1 : 0, 0.22, dt);
  // ...and the fazenda answers it. A little ahead of the sky, because somebody
  // inside puts a light on BEFORE it is properly dark, which is the whole
  // reason a lit window at dusk reads as a person rather than as a lamp.
  if (panFazWinMat) {
    const k = panSmooth(panDusk * 1.45);
    panFazWinMat.opacity = k;
    panFazWinMat.emissiveIntensity = k * 1.5;
    if (panFazLamp) panFazLamp.intensity = k * 2.6 * (0.94 + Math.sin(panTime * 3.1) * 0.06);
  }
}

// ====================================================================== API ==
export function createPantanal(game) {
  panGame = game;

  const onWheek = function () { panWheek(game); };
  game.events.on('capy:wheek', onWheek);

  game.biome.register('pantanal', {
    ensureBuilt() { panBuild(game); },
    onEnter() {
      panTime = 0;
      panFollowing = 0; panBestString = 0;
      panTrailHead = 0; panTrailCount = 0;
      for (let i = 0; i < panHerd.length; i++) {
        const r = panHerd[i];
        r.st = 'graze'; r.order = -1; r.restT = rand(0, 6); r.wet = 0;
        r.reply = 0; r.replyP = 1.2; r.look = 0; r.trailT = 0;
      }
      panHerdChat = 4; panShakeT = 0;
      // ---- Tier 5: a fresh visit is a fresh onça ---------------------------
      // `panJagRuined` is the once-per-visit latch and it MUST be cleared here
      // or she comes exactly once for the life of the page. The two counters —
      // how many times she got a run at the line, and how many times you
      // stopped her — are deliberately NOT cleared: they are the only thing in
      // this chapter that is a record of what the player did for somebody else.
      panJagSt = 'away'; panJagRuined = false; panJagArm = 0; panJagT = 0;
      panJagStruck = false; panJagOtter = false; panJagCrouch = 0; panJagU = 0;
      // D4.13: and the river forgets what it took last time
      panToldRiver = false;
      if (panJag) panJag.visible = false;
      panSayCool = 0;
      for (const k in panSaid) delete panSaid[k];
      panMatRun = 0; panMatLast = -1;
      for (let i = 0; i < panMats.length; i++) {
        panMats[i].y = panWATER + 0.06; panMats[i].load = 0;
        panMats[i].tip = 0; panMats[i].tx = 0; panMats[i].tz = 0; panMats[i].creak = 0;
        panMats[i].body.position.y = panWATER + 0.06;
        panMats[i].body.velocity.set(0, 0, 0);
        panSyncBody(panMats[i].body);
      }
      panAntCarrying = false; panAntRide = 0;
      panAntDig = 0; panAntDigAt = -1; panAntDigCool = rand(6, 14);
      panCowState = 'ground'; panCowT = 0; panCowRide = 0;
      panCowWalk = 0; panCowPeck = 0; panCowDip = 0;
      panCowOn = -1;
      panCowHome.x = 12; panCowHome.z = 30;
      panJabState = 'nest'; panJabT = 0; panJabStep = 0; panJabNote = 0; panMacawNote = 0;
      panOtterUp = 0;
      panOtterArmed = false; panOtterVolley = 0; panOtterNext = 0;
      panCrossT = 0; panCrossN = 0;
      panMacawFly = 0; panMacawHome = 1;
      panEgretT = -1;
      panEgretGone = false;
      panEchoT[0] = -1; panEchoT[1] = -1;
      panCaimanSit = 0; panCaimanSat = -1; panCaimanNotice = 0;
      // W1: the jacaré on the line, back on its bank
      if (panHuntOn) panHuntEnd(game, 'lost');
      panHuntDone = false;
      for (let i = 0; i < panCaimanAt.length; i++) { panCaimanAt[i].hunt = 0; panCaimanAt[i].gone = 0; }
      panBossUnder = 0; panBossBeaten = false;
      panRipCool = 0;
      panRaftReset();
      for (let i = 0; i < panRIP_N; i++) panRipT[i] = 1e9;
      for (let i = 0; i < panCaimanAt.length; i++) {
        const c = panCaimanAt[i];
        c.slide = 0; c.gape = 0; c.gapeOn = 0; c.gapeT = rand(0, 14);
      }
      for (let i = 0; i < panCows.length; i++) {
        const c = panCows[i];
        c.x = c.hx; c.z = c.hz; c.t = rand(0, 9); c.look = 0; c.tx = undefined; c.tz = undefined;
      }
      panToldWheek = false; panToldMat = false;
      // The dusk is NOT reset — it is the one thing in the chapter that is a
      // memory rather than a state, and a player who has already taken the herd
      // over the river should come back to the light they left.
    },
    onExit() {
      // Anything stateful that could hold the player, cleared on the way out.
      panAntCarrying = false;
      panCrossT = 0;
      if (panCowState === 'ride') { panCowState = 'ground'; panCowT = 0; }
    },
  });

  const api = {
    /**
     * TIER 5, measured. Nothing in the game calls it. `st` is her state, `runs`
     * how many times she has had a go at the line and `spoiled` how many times
     * the player put her off it.
     */
    /**
     * D4.13, measured. `bow` is how far the tail of the line has been carried
     * downstream of the head, which is the number the whole item is about, and
     * `lost` counts followers the river has taken off the line this visit.
     */
    riverDebug() {
      let head = null, tail = null, n = 0, maxOff = 0;
      for (let i = 0; i < panHERD_N; i++) {
        const r = panHerd[i];
        if (r.st !== 'follow') continue;
        n++;
        if (!head || r.order < head.order) head = r;
        if (!tail || r.order > tail.order) tail = r;
        const off = Math.hypot(r.tx - r.x, r.tz - r.z);
        if (off > maxOff) maxOff = off;
      }
      let strung = 0;
      if (head && tail) strung = Math.hypot(head.x - tail.x, head.z - tail.z);
      return { following: n,
               strung: Math.round(strung * 100) / 100,
               swimming: (function () { let k = 0; for (let i = 0; i < panHERD_N; i++) { const r = panHerd[i]; if (r.st === 'follow' && panTerrain(r.x, r.z) < panWATER - 0.45) k++; } return k; })(),
               bow: (head && tail) ? Math.round((head.x - tail.x) * 100) / 100 : null,
               maxOffTrail: Math.round(maxOff * 100) / 100,
               drag: panHERD_DRAG };
    },
    jaguarDebug() {
      let scattered = 0, following = 0;
      for (let i = 0; i < panHERD_N; i++) {
        const r = panHerd[i];
        if (r.st === 'follow') following++;
        if (Math.hypot(r.tx - r.x, r.tz - r.z) > 12) scattered++;
      }
      return { st: panJagSt, x: Math.round(panJagX * 10) / 10,
               z: Math.round(panJagZ * 10) / 10,
               u: Math.round(panJagU * 100) / 100,
               crouch: Math.round(panJagCrouch * 100) / 100,
               visible: !!(panJag && panJag.visible),
               runs: panJagRuns, spoiled: panJagSpoiled,
               dusk: Math.round(panDusk * 100) / 100, arm: Math.round(panJagArm * 10) / 10,
               following: following, scattered: scattered,
               otterVolley: panOtterVolley };
    },
    /** Put her on the bank now, so the hunt needs no forty-second dusk wait. */
    forceJaguar() {
      panDusk = 1; panJagRuined = false; panJagArm = panJAG_ARM + 1;
      return panJagSt;
    },
    /** W1: the jacaré on the line, for the harness. */
    huntDebug() { const c = panHuntI >= 0 ? panCaimanAt[panHuntI] : null; return { on: panHuntOn, done: panHuntDone, i: panHuntI, hx: c ? c.hx : 0, hz: c ? c.hz : 0, took: panHuntTook, saved: panHuntSaved, crossT: panCrossT, following: panFollowing, lives: panBossLives, round: panBossRound, under: +panBossUnder.toFixed(2), beaten: panBossBeaten, hits: panBossHits }; },
    /** W1: put n of the herd on the line behind the animal, wherever it is. Test hook. */
    herdFollow(n) {
      const p = game.capy && game.capy.body ? game.capy.body.position : null;
      if (!p) return 0;
      // ...and a trail that leads to the animal from the near bank, so the
      // followers have somewhere sensible to be walking to
      panTrailHead = 0; panTrailCount = 0;
      for (let k = 30; k >= 0; k--) panTrailPush(p.x, p.z + k * panTRAIL_STEP);
      for (let i = 0; i < panHERD_N; i++) {
        const r = panHerd[i];
        if (i < n) { r.st = 'follow'; r.order = i; r.x = p.x + (i % 2 ? 1.2 : -1.2); r.z = p.z + 2.6 * (i + 1); r.tx = r.x; r.tz = r.z; }
        else { r.st = 'graze'; r.order = -1; r.trailT = 0; }
      }
      return n;
    },
    /** Move the herd onto the crossing so there is something to hunt. */
    herdToCrossing() {
      for (let i = 0; i < panHERD_N; i++) {
        const r = panHerd[i];
        r.x = panCROSS.x + (i - 4) * 2.2; r.z = -86 + (i % 3) * 2.0;
        r.tx = r.x; r.tz = r.z; r.st = 'graze'; r.restT = 30; r.trailT = 0;
      }
      return panHERD_N;
    },
    built() { return panBuilt; },
    terrainHeight: panTerrain,
    /** The static ground, without the drifting mats. See panStandH. */
    standHeight: panStandH,
    slopeAt: panSlope,
    waterLevel: panWATER,
    isOverWater: panIsOverWater,
    waterHeightAt: panWaterHeightAt,
    inZone: panInZone,
    navBlocked: panNavBlocked,
    surfacePitch: panSurfacePitch,
    surfaceMat: function () { return panSurfMat; },
    SPAWN: panSPAWN,
    /** the river is going somewhere, gently */
    flow(x, z) { return panFlowAt(x, z, panFlow); },
    /** the back of an anteater, while you are standing on it */
    carryFrame() { return panAntCarrying ? panAntFrame : null; },
    airControl: 0.36,

    // landmarks
    fazenda: { x: panFAZENDA.x, z: panFAZENDA.z },
    baia: { x: panBAIA.x, z: panBAIA.z },
    /**
     * THE FIRST MAT, which is what the card should point at rather than the
     * middle of the bay: a hint that says "the bay" for a task that is "the
     * line of things across the bay" is a hint that has not been thought about.
     */
    matStart() {
      if (!panMats.length) return { x: panBAIA.x, z: panBAIA.z };
      const m = panMats[0];
      panV3b.set(m.x, m.y, m.z);
      return panV3b;
    },
    /** The i-th mat, for anything that needs to walk the line. */
    matAt(i) {
      const m = panMats[clamp(i | 0, 0, panMats.length - 1)];
      if (!m) return panSPAWN;
      panV3b.set(m.x, m.y, m.z);
      return panV3b;
    },
    matCount() { return panMats.length; },
    nest: { x: panNEST.x, z: panNEST.z },
    /** THE WINDOW (L6, F2): where the stork will come down, and seconds until it does. */
    jabiruHome() {
      if (!panJabiru) return null;
      const up = panJabState === 'up';
      panV3jab.set(up ? panJabFrom.x : panJabiru.position.x, panJabiru.position.y, up ? panJabFrom.z : panJabiru.position.z);
      return panV3jab;
    },
    jabiruIn() {
      if (!panJabiru) return -1;
      return Math.max(0, panJabState === 'up' ? panJAB_FLIGHT - panJabT : panJAB_GROUND - panJabT + panJAB_FLIGHT);
    },
    palm: { x: panPALM.x, z: panPALM.z },
    otters: { x: panOTTERS.x, z: panOTTERS.z },
    bridge: { x: panRoadX(panBRIDGES[1].z), z: panBRIDGES[1].z },
    bank: { x: panCROSS.x, z: panRIVER.z1 + 3 },
    farBank: { x: panCROSS.x, z: panRIVER.z0 - 3 },
    sandbar: { x: panSANDBAR.x, z: panSANDBAR.z },

    /**
     * WHAT THE NINE ARE DOING WITH THEIR LEGS, read-only (D8).
     *
     * The skate is the same measurement D2 made on the player and it cannot be
     * taken from a screenshot: a leg swinging at the wrong rate and a leg not
     * swinging at all are the same still frame. `skate` is the ratio the whole
     * argument turns on — ground covered over ground the stride claims — and it
     * is 1.000 when the feet are locked. Nothing in src reads this.
     */
    herdAudit() {
      const rows = [];
      for (let i = 0; i < panHerd.length; i++) {
        const r = panHerd[i];
        const swing = clamp(panHERD_SWING0 + (r.sp || 0) * 0.045, panHERD_SWING0, panHERD_SWING1);
        const stride = Math.max(0.22, 2 * panHERD_HIP * Math.sin(swing));
        const rate = r.moving ? Math.PI * (r.sp || 0) / stride : 0;
        rows.push({ st: r.st, moving: !!r.moving, sp: +(r.sp || 0).toFixed(3),
                    legPh: +(r.legPh || 0).toFixed(3), swing: +swing.toFixed(3),
                    stride: +stride.toFixed(3), rate: +rate.toFixed(3),
                    // FOOTFALLS A SECOND, which is a number a person can judge
                    // against the one this replaced. A "skate" ratio here would
                    // be a tautology — the rate is DERIVED from the speed, so
                    // it is 1.000 by construction and proves nothing. Two
                    // pairs, so two footfalls per cycle.
                    footHz: +(rate / Math.PI).toFixed(2) });
      }
      return { n: panHerd.length,
               legs: !!(panHerdLegF && panHerdLegR),
               rows: rows };
    },
    /** They MOVE — ask, never cache. */
    herd() {
      // the nearest one that is not already following, which is the one the
      // card should be pointing at
      const capy = game.capy;
      let bx = panHerd.length ? panHerd[0].x : 0, bz = panHerd.length ? panHerd[0].z : 0;
      if (capy) {
        let bd = 1e9;
        for (let i = 0; i < panHerd.length; i++) {
          const r = panHerd[i];
          if (r.st === 'follow') continue;
          const d = (r.x - capy.position.x) * (r.x - capy.position.x) +
                    (r.z - capy.position.z) * (r.z - capy.position.z);
          if (d < bd) { bd = d; bx = r.x; bz = r.z; }
        }
      }
      panV3b.set(bx, panTerrain(bx, bz), bz);
      return panV3b;
    },
    anteater() {
      if (!panAntBody) return panSPAWN;
      panV3b.set(panAntBody.position.x, panAntBody.position.y, panAntBody.position.z);
      return panV3b;
    },
    /**
     * THE ONE THE CARD SHOULD POINT AT, which is not simply the first one in
     * the array: six of the fourteen are lying in the shallows and one of
     * those was the arrow's target, so 'sit on a sleeping jacare' pointed at
     * an animal you had to swim to. It points at the DRIEST one — the sandbar
     * is where they are hauled out and where standing on one is a step up
     * rather than a scramble out of a river.
     */
    caiman() {
      let best = null, bh = -1e9;
      for (let i = 0; i < panCaimanAt.length; i++) {
        const c = panCaimanAt[i];
        if (c.slide > 0) continue;
        if (c.y > bh) { bh = c.y; best = c; }
      }
      if (!best) best = panCaimanAt.length ? panCaimanAt[0]
                                           : { x: panSANDBAR.x, y: 0, z: panSANDBAR.z };
      panV3b.set(best.x, best.y, best.z);
      return panV3b;
    },
    cowbird() {
      if (!panCowbird) return panSPAWN;
      panV3b.copy(panCowbird.position);
      return panV3b;
    },

    following() { return panFollowing; },
    /**
     * T4d, measured: `last` is how many the last cascading wheek took,
     * `trailing` how many grazers are walking after the line right now.
     */
    cascade() {
      let trailing = 0, following = 0;
      for (let i = 0; i < panHERD_N; i++) {
        if (panHerd[i].st === 'follow') following++;
        else if (panHerd[i].trailT > 0) trailing++;
      }
      return { last: panCascadeLast, trailing: trailing, following: following };
    },
    /** T4d: the parked-mirror sky, as the sheet sees it this frame. */
    skyFresnel() {
      return { on: panSkyF.value, hooked: !!(panWaterMat && /\|panSF$/.test(panWaterMat.customProgramCacheKey())),
               h: '#' + panSkyH.value.getHexString(), z: '#' + panSkyZ.value.getHexString() };
    },
    /** T4d test hook: put grazer `i` at (x, z) and keep it there a while. */
    herdAt(i, x, z) {
      const r = panHerd[i];
      if (!r) return null;
      r.x = x; r.z = z; r.tx = x; r.tz = z;
      r.st = 'graze'; r.order = -1; r.restT = 30; r.trailT = 0;
      return { x: r.x, z: r.z, st: r.st, order: r.order, trailT: r.trailT || 0 };
    },
    /** T4d: where one of them is, and what it is doing. Ask, never cache. */
    herdOne(i) {
      const r = panHerd[i];
      return r ? { x: +r.x.toFixed(2), z: +r.z.toFixed(2), st: r.st, order: r.order,
                   trailT: +(r.trailT || 0).toFixed(2) } : null;
    },
    /** 0..1 — the sundown the crossing switches on. systems.js reads it. */
    dusk() { return panDusk; },
    crossing() { return panCrossT > 0; },

    update(dt) {
      if (!panBuilt) return;
      if (!game.biome.isActive('pantanal')) return;
      if (panFar) panFar.update(game, dt);
      // ---- THE RIVER, WHICH IS THE CHAPTER (M13) ----------------------
      // Four of this chapter's twelve rows begin with the word Cross, and
      // the thing being crossed made no sound at all. It is a band in z, so
      // the nearest point is a clamp; x is free.
      if (!panRiverBed && game.sfxMover) {
        panRiverBed = game.sfxMover('river', { key: 'pan:river', near: 20, far: 140 });
      }
      if (panRiverBed && game.capy && game.capy.position) {
        const pp2 = game.capy.position;
        panRiverBed.at(pp2.x, panWATER + 0.2,
                       clamp(pp2.z, panRIVER.z0, panRIVER.z1));
        panRiverBed.set(0.48);
        // The marsh, which is everywhere here (L6, E3): frogs and insects at
        // the animal, so the calm's rise is its whole dynamic.
        if (!panMarshBed && game.sfxMover) panMarshBed = game.sfxMover('marsh', { key: 'pan:marsh', near: 24, far: 110 });
        if (panMarshBed) { panMarshBed.at(pp2.x, pp2.y + 1, pp2.z); panMarshBed.set(1); }
      }
      panTime += dt;
      panUpdateMats(game, dt);
      panUpdateAnteater(game, dt);
      panUpdateTruck(game, dt);
      panUpdateHerd(game, dt);
      panUpdateCattle(game, dt);
      panUpdateCaimans(game, dt);
      panUpdateJabiru(game, dt);
      panUpdateMacawFlight(game, dt);
      panUpdateMacaws(game, dt);
      panUpdateJaguar(game, dt);
      panUpdateOtters(game, dt);
      panUpdateCowbird(game, dt);
      panUpdateTasks(game, dt);
      // ...and the things that read `panDusk`, which panUpdateTasks has just
      // written. Order matters: a flower that opens one frame behind the sky
      // is a flower that opens one frame behind the sky.
      panUpdateWater();
      panUpdateLilies(dt);
      panUpdateBugs(dt);
      panUpdateEgrets(game, dt);
      panUpdateRipples(game, dt);
      panUpdateRafts(dt);
      panUpdateEcho(game, dt);
      // THE MUSICIAN (L7, F2): the viola caipira, on the porch.
      if (!panTuneMv && typeof game.sfxMover === 'function') {
        panTuneMv = game.sfxMover('tune', { key: 'pantanal:musician', biome: 'pantanal' });
      }
      if (panTuneMv && panLocals.musician) {
        panTuneMv.at(panLocals.musician.x, panLocals.musician.y + 1.0, panLocals.musician.z);
      }
    },
  };
  game.pantanal = api;
  return api;
}
