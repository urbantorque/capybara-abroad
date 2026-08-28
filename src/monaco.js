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
// ...AND IT MOVED. The first one was on the west quay at (-62, -46), which is
// eight metres BEHIND the circuit's own crash barrier: the first thing the
// chapter showed anybody was a wall of armco and debris fencing three metres
// from the lens. The second was seven metres inside the palm row along the
// north quay, which is worse: the camera was in a tree. The third was inside
// a building, and the fourth was inside a palm. It was found in the end by
// SWEEPING the quay against navBlocked at a 3.2 m radius rather than by
// picking a number off the map, which is what a chapter with a hundred and
// fifty lamps, fifty-four palms and thirty-four bollards on it requires.
// This is the south-east corner of the basin, looking due north: the basin, the boats,
// the yacht, the whole town climbing the hill behind it and the lit terrace at
// the top right, all in one frame with nothing in the foreground — and eleven
// metres behind the lens, the circuit, so the first thing that happens is a
// car going past at ninety.
const monSPAWN     = { x: 30, y: 3.9, z: -80 };

// Port Hercule. A rectangle of still water with the town on three sides of it
// and one channel out to the sea. Everything on the water is inside this.
const monPORT     = { x0: -40, x1: 42, z0: -78, z1: -12 };
const monPORT_BED = -6.4;         // the basin floor. Shallow: you can see it
// AND THERE IS NO SECOND WATER RECTANGLE, WHICH WAS MEASURED AND NOT CHOSEN.
// A basin wants a channel out to the sea; the circuit runs round three sides of
// this one, and every channel that reaches open water crosses the road. Four
// placements were tried — west of Rascasse, east of the chicane, under the
// pool section, and through the mole — and all four put tarmac over water,
// because the geometry says they must. So the entrance is implied by the GAP
// IN THE DRAWN MOLE and the terrain has one hole in it, not two. It is the
// right trade: the circuit is the chapter and a harbour mouth is a detail
// nobody looks at from a lens thirty-five degrees above a capybara.
const monQUAY_Y   = 2.6;          // ...and every quay round it is at this height

// THE QUAYS ARE THEIR OWN PAD, and that is the one piece of this terrain that
// is not obvious. Without it the Condamine's slope runs straight into the
// water and the harbour has no edge — the town simply gets shallower until it
// is wet. Every number in this chapter that reads "two and a half metres above
// the sea" is this pad.
const monQPAD    = { cx: 0, cz: -46, rx: 78, rz: 56, h: 2.6, soft: 14 };
// La Condamine — the flat behind the port, climbing gently off the quay.
const monCOND    = { cx: 4, cz: 46, rx: 86, rz: 30, h: 8.0, soft: 34 };
// ...and the two terraces of town above it, which is how a place with four
// streets in it ends up with a skyline.
const monMID1    = { cx: -10, cz: 88, rx: 96, rz: 26, h: 22.0, soft: 22 };
const monMID2    = { cx: -6, cz: 130, rx: 90, rz: 26, h: 40.0, soft: 24 };

// The terrace at Monte-Carlo. The Casino stands on it and the square in front
// of it is the second most photographed piece of tarmac in motorsport.
const monTERR    = { cx: 118, cz: 96, rx: 62, rz: 56, h: 28.0, soft: 26 };
const monSQUARE  = { x: 92, z: 74, r: 26 };
const monCASINO  = { x: 118, z: 119, w: 48, d: 34, y: 28.0 };
const monFLOOR_Y = 28.4;                    // the gaming floor, one step up
const monFRONT_Z = 102;                     // the front wall, and the only door
const monBACK_Z  = 136;                     // ...and the back of the salon
const monSTEPS   = { x: 118, z: 97 };
const monDOOR    = { x: 118, z: 105 };

// The cliff behind the town: the Tete de Chien, and the reason a principality
// with four streets in it feels like the bottom of something. It is genuinely
// a wall — a hundred and twenty metres of rise in sixty of ground — because
// that is what is actually there, and because a chapter this dense needs one
// place the eye stops.
const monHILL    = { cx: 20, cz: 262, rx: 220, rz: 90, h: 120.0, soft: 56 };

// Le Rocher. A limestone plateau with the Palace on it.
//
// FORTY METRES AND A TWENTY-TWO METRE RIM, and both numbers were measured
// rather than chosen. At the fifty-eight it was first built at, with an
// eleven-metre rim, the landward face was a 5:1 wall: the drawn stair climbed
// thirty-six metres in thirty-eight and spent most of that floating over
// ground that had not risen yet, and the last third of it was inside the
// cliff. A place with one way onto it has to HAVE the one way onto it.
// Forty over twenty-two is about twenty-one degrees, which is less than the
// flanks of Galeras and a great deal less than the penguin highway.
const monROCK    = { cx: -152, cz: -46, rx: 58, rz: 52, h: 40.0, soft: 22 };
const monPALACE  = { x: -146, z: -24, y: 40.0 };
// The headland between the harbour and the Rock. SMALL, and it was not always:
// at forty-eight by thirty it reached the west quay, put the whole waterfront
// twenty-one metres up, and cut a seventeen-metre trench through the circuit
// at Anthony Noghes. A pad is a plateau and a plateau next to a quay is a
// cliff over it. Its only job now is to be LAND between the basin and the Rock,
// and the ramp is a centreline that ignores it.
const monNECK    = { cx: -112, cz: 4, rx: 34, rz: 24, h: 18.0, soft: 24 };

// The eastern headland, toward Larvotto. Backdrop, and the far end of the map.
const monEAST    = { cx: 250, cz: 90, rx: 56, rz: 70, h: 52.0, soft: 60 };

// The shoulder the tunnel goes through. In life it is the Fairmont hotel; here
// it is the hill the road disappears into and comes out of. It is deliberately
// LOW — eighteen metres — because the road under it is a CUTTING WITH A LID
// ON and not a bore, and a cutting through a fifty-metre hill is a slot canyon
// with a capybara at the bottom of it.
const monTHILL   = { cx: 134, cz: -40, rx: 54, rz: 44, h: 18.0, soft: 20 };

// The two moles that make the port a port. The long one shelters the basin
// from the south and carries the grandstand; the short one covers the channel.
const monMOLE    = { cx: 4, cz: -100, rx: 42, rz: 6, h: 2.8, soft: 5 };
const monCONTRE  = { cx: -76, cz: -88, rx: 6, rz: 22, h: 2.8, soft: 5 };

const monPADS = [monQPAD, monCOND, monMID1, monMID2, monTERR, monHILL, monROCK,
                 monNECK, monEAST, monTHILL, monMOLE, monCONTRE];

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
  [ 84,  88, 27.4],   //  3 Casino Square, past the hotel
  [118,  92, 28.0],   //  4 in front of the Casino itself — and eleven metres
                      //    clear of the bottom step, because a road that runs
                      //    over the front steps is not a road, it is a foyer
  [148,  84, 26.6],   //  5 Mirabeau
  [164,  58, 22.0],   //  6 the drop to the hairpin
  [172,  36, 17.6],   //  7 the Fairmont hairpin — the apex
  [154,  28, 16.2],   //  8 ...and out of it, eighteen metres from where you went in
  [150,   6, 10.4],   //  9 Portier
  [152, -12,  6.8],   // 10 TUNNEL IN
  [ 74, -84,  3.4],   // 11 TUNNEL OUT
  [ 50, -90,  3.0],   // 12 the Nouvelle Chicane
  [  8, -95,  2.8],   // 13 Tabac
  [-26, -87,  2.8],   // 14 the swimming pool section
  [-48, -66,  2.9],   // 15 La Rascasse
  [-56, -38,  3.2],   // 16 Anthony Noghes
  [-50,   0,  4.4],   // 17 the west quay, and back up to the start
  [-34,  28,  6.6],   // 18
];
// ...AND THE OTHER CENTRELINE. THE RAMPE MAJOR.
//
// An elliptical plateau cannot have a gentle side. Measured at the Rock's
// first size: the rim went from twenty-two metres to fifty-eight in ten
// metres of ground — a grade of 1.79, sixty degrees — and the one way onto
// the one place in the chapter that has one way onto it was a wall. Widening
// the pad's rim does not fix it either, because the rim is a smoothstep and
// most of it is spent below the height the neck has already reached: at a
// forty-six metre soft the worst grade is still 0.69.
//
// So the ramp is a ROAD, using the same machinery the circuit already uses:
// one polyline, the terrain blended toward it, and the drawn stair laid along
// it. Seventy-three metres of run for eighteen of rise is twenty-four per
// cent, which is gentler than the flanks of Galeras. The cutting it makes
// through the rim on the middle leg is exactly what the real Rampe Major is.
const monPATH = [
  [-52,  -8,  3],   // off the west quay, where the circuit runs
  [-74,   8, 10],   // 27.2 m of run for 7 of rise — 26%
  [-98,  16, 18],   // 25.3 for 8 — 32%, and it is the steepest flight
  [-120,  8, 25],   // 23.4 for 7 — 30%
  [-138, -12, 32],  // 26.9 for 7 — 26%
  [-154, -34, 40],  // 27.2 for 8 — 29%, and out onto the plateau
];
const monPATH_HALF = 4.0;
const monPATH_SHLD = 7.0;
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
const monCAR_VMIN  = 5.4;         // ...at the apex of the hairpin, and it is
                                  //    the one number the third act needs: a
                                  //    capybara runs at about seven
const monCAR_ACC   = 8.5;
const monCAR_BRAKE = 15.0;
const monCAR_N     = 3;
// WHERE YOU STAND ON IT, and this is the number the whole third act turns on.
//
// It was the ROOF at 1.44 m, and the animal cannot get there: capyJUMP_V is
// 6 m/s against a gravity of 24 with a fifth of a second of sustain, which
// peaks at about 1.2 m of rise, and a hop that clears the obstacle by minus
// twenty centimetres is a hop that never lands. So the car is TWO BOXES — a
// deck at ninety centimetres over the whole footprint and a cabin standing
// off it — and what you ride is the BOOT LID, which is a 0.9 m hop from the
// road and is in any case the more interesting picture.
const monROOF_Y    = 0.95;        // the deck, above the road
const monROOF_HX   = 0.94, monROOF_HZ = 2.10;
const monRIDE_GRACE = 0.30;       // s the ride survives a frame outside the box
const monCAR_HY    = 0.0;         // ...so the body origin IS the road

// ------------------------------------------------------------------ the eye --
// Five people looking at one room. See THE EYE at the top of the file.
const monEYE_RANGE = 15.0;        // metres a sweep reaches
const monEYE_HALF  = 0.46;        // radians either side of where they are facing
// MEASURED AND RETUNED. At 0.60 against a drain of 0.95, thirty seconds of
// pacing across the middle of the atrium at a run — which is the worst thing a
// player can possibly do in that room — peaked at 0.46 and never once got
// anybody thrown out. A sweep at 0.7 rad/s with a 0.46 half-angle holds a
// point for about 1.3 s, so a fill that cannot reach 1.0 inside a pass and a
// half is a mechanic that is switched off and looks exactly like one that is
// working perfectly.
const monEYE_FILL  = 0.86;        // per second, at the middle of the cone
const monEYE_DRAIN = 0.58;        // ...and how fast it goes away when it does not
const monEYE_LOAF  = 0.50;        // range multiplier while sat down doing nothing
const monEYE_RUN   = 1.55;        // ...and while running, because of course
const monEYE_WARN  = 0.42;        // where the room starts to say something
const monEYE_OUT   = 2.4;         // seconds of being carried out
const monEYE_COOL  = 4.5;         // ...and how long before anybody looks again

// ------------------------------------------------------------------ the wheel
// At the back of the salon, ON THE AXIS. The carpet runs from the front door
// to it and stops, which is the shortest sentence this building could be made
// to say about itself.
const monWHEEL      = { x: monCASINO.x, z: monFRONT_Z + 26, y: monFLOOR_Y + 0.06, r: 2.20 };
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
let monRideGrace = 0;
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

// the stack
let monStack = 0;
let monStackBest = 0;
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
let monAboardT = 0, monAboardDone = false;

// the salon
let monPianoG = null;
const monPianoKey = [];           // {x, z, mesh, y0, v, hit}
let monPianoRun = 0, monPianoLast = -1, monPianoT = 0, monPianoDone = false;
let monToweG = null, monToweT = -1, monToweDone = false;

// the palace
let monGuardG = null, monGuardBreak = 0, monGuardDone = false;

// the chicane
let monChicaneDone = false;

// instanced fields
let monWinMesh = null;            // the lit windows of the whole town
let monBoatMesh = null;           // the small craft in the basin
let monBoatData = null;
let monPalmMesh = null;
let monLampMesh = null;           // ...and a hundred and fifty-three street lamps
const monWatchN = 46;             // the crowd on the fence, and in the stand
let monWatchMesh = null;
let monWatchPh = null;

// people
let monLocDoor = null, monLocQuay = null;
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
  return grain(mat(0xffffff, { vertexColors: true }),
               { scale: 0.26, amount: 0.085, warp: 0.6, near: 0.30, nearScale: 12, contact: 1 });
}
/** THE GROUND, AND ONLY THE GROUND. monVC() is on the walls and the window
 *  boxes too, so it cannot carry a ground-strength near octave; this can.
 *  Ground is horizontal, so it also wants no vertical shear in the sample. */
function monVCG() {
  return grain(mat(0xffffff, { vertexColors: true }),
               { scale: 0.26, amount: 0.085, warp: 0, near: 0.58, nearScale: 13, contact: 1 });
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
let monRoadCx = 1e9, monRoadCz = 1e9;
function monRoad(x, z) {
  // A ONE-ENTRY MEMO, and it is not a micro-optimisation. terrainHeight,
  // groundSlip, surfacePitch and the tunnel test are four separate questions
  // that the controller asks about the SAME point on the same frame, and each
  // of them wants the road; without this the nineteen-segment sweep runs four
  // times a frame for one answer, and monSlope alone runs it four more.
  if (x === monRoadCx && z === monRoadCz) return monRoadD;
  monRoadCx = x; monRoadCz = z;
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
 * THE RAMP UP THE ROCK, as a distance field. Open rather than closed — it is a
 * ramp and not a lap — so the last node is an end and not a wrap.
 */
let monPathD = 0, monPathY = 0;
let monPathCx = 1e9, monPathCz = 1e9;
function monPath(x, z) {
  if (x === monPathCx && z === monPathCz) return monPathD;
  monPathCx = x; monPathCz = z;
  let best = 1e9, by = 0;
  for (let i = 0; i < monPATH.length - 1; i++) {
    const a = monPATH[i], b = monPATH[i + 1];
    const d = monSegD(x, z, a[0], a[1], b[0], b[1]);
    if (d < best) { best = d; by = a[2] + (b[2] - a[2]) * monSegT; }
  }
  monPathD = best; monPathY = by;
  return best;
}

/**
 * THE GROUND. One authority, and it is cheap: twelve plateaus, two centreline
 * blends and one basin cut. No raycasts, no lookups, no allocation.
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
  // ...and the ONE leg with a lid on it gets a much wider shoulder. The tunnel
  // is a cutting through eighteen metres of hill; at the road's ordinary three
  // and a half metres of blend that cutting has 5:1 walls, which is a slot
  // canyon, and a heightfield at five-metre cells turns 5:1 walls into a
  // staircase an animal can be shoved up. Eleven metres of blend puts them at
  // about 1.6:1, which the drawn tunnel wall then covers completely.
  const sh = monRoadI === monTUNNEL_A ? 11.0 : monTRACK_SHLD;
  if (d < monTRACK_HALF + sh) {
    const k = d <= monTRACK_HALF ? 1 : monSmooth(1 - (d - monTRACK_HALF) / sh);
    h = h + (monRoadY - h) * k;
  }
  // ...and the ramp up the Rock, which is the same thing at a quarter of the
  // width. See monPATH: it is the only way onto the one place in the chapter
  // with one way onto it, and an elliptical pad cannot make one.
  const pd = monPath(x, z);
  if (pd < monPATH_HALF + monPATH_SHLD) {
    const k = pd <= monPATH_HALF ? 1 : monSmooth(1 - (pd - monPATH_HALF) / monPATH_SHLD);
    h = h + (monPathY - h) * k;
  }
  // ---- AND THE WATER IS CUT OUT OF IT ----------------------------------
  // A harbour is a hole with a wall round it. The rim is four metres wide,
  // which at a five-metre heightfield cell is one ramp — steep enough to read
  // as a quay and shallow enough that an animal that has fallen in can get out
  // anywhere rather than only at the two slipways.
  //
  // THE CUT RUNS AFTER THE ROAD, and that order is load-bearing: the circuit
  // goes round three sides of this basin, and a road blended in after a basin
  // was dug would lay tarmac over open water. Every node of monTRACK is
  // outside both rectangles by at least four metres for the same reason.
  const cut = monCutK(x, z, monPORT);
  if (cut > 0) h = h + (monPORT_BED - h) * cut;
  return h;
}
/** 0 outside a water rectangle, 1 more than four metres inside it. */
function monCutK(x, z, r) {
  if (x <= r.x0 || x >= r.x1 || z <= r.z0 || z >= r.z1) return 0;
  const inn = Math.min(Math.min(x - r.x0, r.x1 - x), Math.min(z - r.z0, r.z1 - z));
  return monSmooth(clamp(inn / 4.0, 0, 1));
}
/** Land only — the terrain with the sea taken out. Used to place people. */

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
  // THE PONTOONS, AND THE RUNG THAT COULD NOT BE REACHED. monSLIP_DECK was
  // declared with the other four and no branch ever returned it, so varnished
  // teak over water graded as ordinary pavement — a quarter of the intended
  // slide. The tell was that monSurfacePitch() below ALREADY calls
  // monOnPontoon() to give these boards hollow-timber footsteps: the decks
  // sounded like wet wood and gripped like a dry street.
  // NARROW BEFORE BROAD. This has to sit above monOnQuay(), which is the
  // larger region the pontoons stand in — the same ordering rule the note on
  // monSurfacePitch records from the Manly wharf bug.
  if (monOnPontoon(x, z)) return monSLIP_DECK;
  if (monOnQuay(x, z)) return monSLIP_QUAY;
  return monSLIP_STONE;
}
/**
 * A BIOME MAY ANSWER FOR ITS OWN FOOTSTEPS. < 0.9 soft, ~1.0 stone, > 1.15
 * hollow timber. Monaco is stone with two exceptions and both of them matter:
 * the pontoons are timber over water and the atrium is a drum.
 */
// THE LADDER, four rungs for twelve zones before v30. A principality with a
// medieval rock, a marble atrium, a flight of granite steps and a harbour
// pontoon in it answered "carpet, pontoon, road, or the same pavement
// everywhere else". Narrow tests first — the quay ladder in chapter 3 was found
// returning wharf timber for the whole of Manly because a broad test sat above
// a narrow one.
function monSurfacePitch(x, z, y) {
  // The salon is carpet over board; the atrium is marble and rings.
  if (monInRect(monZ.atrium, x, z)) return 1.34;
  if (monInCasino(x, z)) return 1.22;
  if (monOnPontoon(x, z)) return 1.30;
  // The steps: granite, and the one place in this chapter everybody stands.
  if (monInRect(monZ.steps, x, z)) return 1.14;
  if (monRoad(x, z) < monTRACK_HALF + 0.4) return 0.96;
  // The Rock and the palace square: worn stone, eight hundred years of it.
  if (monInRect(monZ.palace, x, z)) return 1.08;
  if (monInRect(monZ.rock, x, z)) return 0.88;
  return 1.04;
}

// ----------------------------------------------------------------- the zones
const monZ = {
  quay:     { x0: -64, x1: 66, z0: -112, z1: -2 },
  port:     { x0: monPORT.x0, x1: monPORT.x1, z0: monPORT.z0, z1: monPORT.z1 },
  condamine:{ x0: -66, x1: 60, z0: -4, z1: 60 },
  square:   { x0: 62, x1: 152, z0: 56, z1: 100 },
  casino:   { x0: monCASINO.x - monCASINO.w * 0.5 - 1, x1: monCASINO.x + monCASINO.w * 0.5 + 1,
              z0: monFRONT_Z - 1, z1: monBACK_Z + 1 },
  atrium:   { x0: 96, x1: 140, z0: 103, z1: 113 },
  salon:    { x0: 96, x1: 140, z0: 113, z1: 135 },
  steps:    { x0: 106, x1: 130, z0: 92, z1: 102 },
  rock:     { x0: -212, x1: -96, z0: -100, z1: 6 },
  palace:   { x0: -172, x1: -118, z0: -42, z1: -2 },
  hairpin:  { x0: 154, x1: 194, z0: 20, z1: 52 },
  mole:     { x0: -20, x1: 66, z0: -113, z1: -96 },
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

// ------------------------------------------------------------- the tunnel ---
/**
 * ONE SEGMENT OF THE LAP IS ROOFED, and that is the whole implementation.
 *
 * `monRoadI` already answers which leg of the circuit a point is nearest, so
 * the bore is "leg ten, within the half-width, and not in the first or last
 * seven metres of it" — which means the mouths taper instead of switching, and
 * the score, the fog and the headlights all cross-fade over a car's length
 * rather than snapping on a frame. There is no second list of tunnel geometry
 * anywhere in this file: the roof, the wall, the lamps, the sound and the
 * camera all read this.
 */
function monTunnelK2(x, z) {
  monRoad(x, z);
  if (monRoadI !== monTUNNEL_A) return 0;
  if (monRoadD > monTUNNEL_W) return 0;
  const a = monTrackLen[monTUNNEL_A];
  const b = monTrackLen[monTUNNEL_B];
  const along = monRoadS - a;
  const len = b - a;
  const taper = 7.0;
  const k = Math.min(along / taper, (len - along) / taper);
  return clamp(k, 0, 1);
}
function monUnderTunnel(x, z) { return monTunnelK2(x, z) > 0.5; }

/** How far it is from one tunnel mouth to the other. */

// -------------------------------------------------------------- navBlocked --
// Static obstacles, for steering. Deliberately COARSE — it is asked by people
// who are trying not to walk into a wall, not by anything that needs the truth.
const monBLOCK = [];              // {x, z, r} circles, filled in by the builders
function monNavBlocked(x, z, radius) {
  const r = radius || 0.5;
  if (monTerrain(x, z) < monWATER + 0.15) return true;
  for (let i = 0; i < monBLOCK.length; i++) {
    const b = monBLOCK[i];
    const dx = x - b.x, dz = z - b.z;
    if (dx * dx + dz * dz < (b.r + r) * (b.r + r)) return true;
  }
  return false;
}
function monBlock(x, z, r) { monBLOCK.push({ x: x, z: z, r: r }); }

// ---------------------------------------------------------------- pontoons --
// Finger pontoons off the north quay, and they are the only timber in the
// chapter you can stand on. Declared once and used three times: drawn,
// collided, and asked after by surfacePitch.
const monPONT = [];
function monOnPontoon(x, z) {
  for (let i = 0; i < monPONT.length; i++) {
    const p = monPONT[i];
    if (Math.abs(x - p.x) < p.hx && Math.abs(z - p.z) < p.hz) return true;
  }
  return false;
}

// =========================================================== THE GROUND ======
/**
 * ONE MESH FOR THE WHOLE PRINCIPALITY.
 *
 * Sampled at 4 m, which is finer than most chapters and has to be: half of
 * what this terrain does is a road on a hillside, and a ribbon four and a half
 * metres wide is the one shape a coarse grid turns into a staircase. Vertex
 * colour carries the entire read — limestone where it is steep, the pale dust
 * of a terrace where it is flat and high, tarmac where the circuit runs, and
 * the floor of the sea where there is water over it.
 */
function monBuildGround(game, root) {
  const X0 = monSEA_X0, X1 = monSEA_X1, Z0 = monSEA_Z0, Z1 = monSEA_Z1, EL = 4;
  const NX = Math.round((X1 - X0) / EL), NZ = Math.round((Z1 - Z0) / EL);
  const g = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0, NX, NZ);
  g.rotateX(-Math.PI / 2);
  g.translate((X0 + X1) / 2, 0, (Z0 + Z1) / 2);
  const p = g.attributes.position.array;
  const col = new Float32Array(p.length);
  const c = new THREE.Color();
  const rock = new THREE.Color(PALETTE.monRock);
  const rockDk = new THREE.Color(PALETTE.monRockDk);
  const dust = new THREE.Color(PALETTE.monQuay);
  const dustDk = new THREE.Color(PALETTE.monQuayDk);
  const scrub = new THREE.Color(PALETTE.monHedge);
  const road = new THREE.Color(PALETTE.monTarmac);
  const bed = new THREE.Color(PALETTE.monBed);
  const bedDk = new THREE.Color(PALETTE.monSeaDeep);
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i], z = p[i + 2];
    const h = monTerrain(x, z);
    p[i + 1] = h;
    if (h < monWATER) {
      const d = clamp((monWATER - h) / 26, 0, 1);
      c.copy(bed).lerp(bedDk, monSmooth(d));
    } else {
      const s = monSlope(x, z);
      c.copy(dust).lerp(dustDk, clamp(s * 2.4, 0, 1) * 0.7);
      c.lerp(rock, clamp((s - 0.35) * 1.8, 0, 1));
      c.lerp(rockDk, clamp((s - 0.75) * 1.6, 0, 1));
      // the maquis on the hillside behind the town, which is the only green
      // thing in the chapter that is not somebody window box
      if (h > 34 && z > 90) c.lerp(scrub, clamp((h - 34) / 44, 0, 1) * 0.62);
      const rd = monRoad(x, z);
      if (rd < monTRACK_HALF + 1.6) c.lerp(road, clamp(1 - (rd - monTRACK_HALF) / 1.6, 0, 1));
    }
    col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, monVCG());
  m.receiveShadow = true;
  m.castShadow = false;
  m.frustumCulled = false;
  root.add(m);
}

function monBuildGroundBody(game) {
  // ---- THE SAME LATTICE THE GROUND IS DRAWN ON (integrity 3) -------------
  // This was 5 while monBuildGround draws the ground mesh at EL = 4, over the
  // same rectangle. Two different lattices sampling the same analytic law give
  // two different piecewise-linear surfaces, and the gap between them is what
  // the player sees: the drawn ground sat more than 15 cm from the collider on
  // 18.6% of the chapter and more than 50 cm on 6.1% — the animal sunk into
  // the hill it is standing on.
  //
  // Going FINER is not the fix and it was tried: at 2.5 the collider tracks the
  // smooth law better than the 4 m mesh does, so it only got from 18.6 to 17.4
  // and cost 29% of the chapter's p90 tick. Matching the mesh's own lattice
  // makes the two the same surface, and costs 1.56x the vertices rather than 4x.
  //
  // If monBuildGround's EL ever changes, THIS MUST CHANGE WITH IT.
  const EL = 4, X0 = monSEA_X0, Z0 = monSEA_Z0;
  const NX = Math.round((monSEA_X1 - X0) / EL), NZ = Math.round((monSEA_Z1 - Z0) / EL);
  const Z1 = Z0 + NZ * EL;
  const data = [];
  for (let i = 0; i <= NX; i++) {
    const row = [];
    for (let j = 0; j <= NZ; j++) row.push(monTerrain(X0 + i * EL, Z1 - j * EL));
    data.push(row);
  }
  const hf = new CANNON.Heightfield(data, { elementSize: EL });
  const b = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
  b.addShape(hf);
  b.position.set(X0, 0, Z1);
  b.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  monSyncBody(b);
  game.world.addBody(b);
}

// ============================================================== THE SEA ======
/**
 * THE WATER, AND WHY IT IS TWO COLOURS AND NOT ONE.
 *
 * A harbour and an open sea look nothing like each other, and it is not the
 * colour of the water — it is what is in it: the basin is flat and holds the
 * town lights, and the Mediterranean outside the mole has half a metre of
 * swell on it that has been coming from the south-west all afternoon. The
 * sheet is ONE MESH with the swell amplitude driven off which side of the mole
 * a vertex is on, so the calm inside is a PROPERTY OF THE HARBOUR and not a
 * second flat plane laid over the first — which is the mistake chapter 14
 * documented and which puts a visible seam across every port in fiction.
 */
function monBuildSea(root) {
  const g = new THREE.PlaneGeometry(monSEA_X1 - monSEA_X0, monSEA_Z1 - monSEA_Z0, 76, 78);
  g.rotateX(-Math.PI / 2);
  g.translate((monSEA_X0 + monSEA_X1) / 2, monWATER, (monSEA_Z0 + monSEA_Z1) / 2);
  const p = g.attributes.position.array;
  const col = new Float32Array(p.length);
  const c = new THREE.Color();
  const lt = new THREE.Color(PALETTE.monSeaLt);
  const dp = new THREE.Color(PALETTE.monSeaDeep);
  const basin = new THREE.Color(PALETTE.monBasin);
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i], z = p[i + 2];
    const d = clamp((monWATER - monTerrain(x, z)) / 24, 0, 1);
    c.copy(lt).lerp(dp, monSmooth(d));
    const inPort = x > monPORT.x0 - 8 && x < monPORT.x1 + 8 &&
                   z > monPORT.z0 - 8 && z < monPORT.z1 + 8;
    if (inPort) c.lerp(basin, 0.72);
    col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, grain(mat(0xffffff, { vertexColors: true }),
                                    { scale: 0.05, amount: 0.045, warp: 1.2 }));
  m.frustumCulled = false;
  m.receiveShadow = true;
  m.castShadow = false;
  monSeaMesh = m;
  monSeaAttr = g.attributes.position;
  monSeaBase = new Float32Array(p.length / 3);
  for (let i = 0, k = 0; i < p.length; i += 3, k++) {
    const x = p[i], z = p[i + 2];
    monSeaBase[k] = (x > monPORT.x0 - 4 && x < monPORT.x1 + 4 &&
                     z > monPORT.z0 - 2 && z < monPORT.z1 + 4) ? 0.06 : 1.0;
  }
  root.add(m);
}

function monUpdateSea(dt) {
  if (!monSeaAttr) return;
  const a = monSeaAttr.array;
  const t = monTime;
  for (let i = 0, k = 0; i < a.length; i += 3, k++) {
    const x = a[i], z = a[i + 2];
    if (monSeaBase[k] < 0.1) {
      a[i + 1] = monWATER + Math.sin(t * 1.35 + x * 0.14 + z * 0.09) * 0.035;
    } else {
      a[i + 1] = monWATER
        + Math.sin(t * 0.62 + (x * 0.62 + z * 0.78) * 0.021) * 0.46
        + Math.sin(t * 1.05 - (x * 0.30 - z * 0.95) * 0.048) * 0.17;
    }
  }
  monSeaAttr.needsUpdate = true;
  // NO computeVertexNormals() HERE, AND THAT IS THE WHOLE POINT.
  // This sheet is 6,083 vertices and 11,856 triangles, and the material it
  // wears comes from mat(), which sets flatShading: true. With FLAT_SHADED
  // three derives the normal in the FRAGMENT shader from screen-space
  // derivatives and never reads the normal attribute at all — so recomputing
  // it every frame cost between 0.9 ms (fresh page) and 3.1 ms (all nineteen
  // chapters resident) to produce a buffer the GPU throws away. Measured by
  // ablation it was ~40% of this chapter's entire per-frame cost, and Monaco
  // was already the heaviest update() in the game.
  // Chapter 14 wrote this down first — see the note beside venWaterMat in
  // venice.js, which subdivides and animates a sea for nearly nothing for
  // exactly this reason. If a SMOOTH-shaded sea is ever wanted here, the two
  // sine terms above have closed-form derivatives: write the normal
  // analytically in the same loop rather than re-deriving it from triangles.
}

/** The live waterline at a point. The basin is flat; outside the mole it is not. */
function monWaterHeightAt(x, z) {
  const inPort = x > monPORT.x0 - 4 && x < monPORT.x1 + 4 &&
                 z > monPORT.z0 - 2 && z < monPORT.z1 + 4;
  if (inPort) return monWATER + Math.sin(monTime * 1.35 + x * 0.14 + z * 0.09) * 0.035;
  return monWATER
    + Math.sin(monTime * 0.62 + (x * 0.62 + z * 0.78) * 0.021) * 0.46
    + Math.sin(monTime * 1.05 - (x * 0.30 - z * 0.95) * 0.048) * 0.17;
}

// =========================================================== THE HARBOUR =====
/**
 * THE QUAYS, THE MOLES, THE PONTOONS AND THE SLIPWAYS.
 *
 * The terrain already cuts the basin; this is the part of a harbour that is
 * BUILT rather than dug — a coping stone all the way round so the edge reads
 * as masonry from twenty metres up, bollards you can trip over, the two
 * slipways an animal in the water is going to want, and the finger pontoons
 * the small craft are tied to.
 */
function monBuildHarbour(game, root) {
  const K = monMerger();
  const body = monPoolBody(game);

  // ---- the coping, all the way round the basin --------------------------
  const cx = (monPORT.x0 + monPORT.x1) / 2, cz = (monPORT.z0 + monPORT.z1) / 2;
  const w = monPORT.x1 - monPORT.x0, d = monPORT.z1 - monPORT.z0;
  const cop = 1.4;
  const edges = [
    [cx, monPORT.z0 - cop * 0.5, w + cop * 2, cop],
    [cx, monPORT.z1 + cop * 0.5, w + cop * 2, cop],
    [monPORT.x0 - cop * 0.5, cz, cop, d],
    [monPORT.x1 + cop * 0.5, cz, cop, d],
  ];
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    K.box(e[0], monQUAY_Y + 0.10, e[1], e[2], 0.34, e[3], PALETTE.monQuayDk);
    K.box(e[0], monQUAY_Y - 1.6, e[1], e[2] * 0.86, 3.2, e[3] * 0.86, PALETTE.monQuay);
  }

  // ---- bollards, and there are a great many of them ---------------------
  for (let i = 0; i < 34; i++) {
    const t = i / 34;
    let x, z;
    if (t < 0.32) { x = lerp(monPORT.x0, monPORT.x1, t / 0.32); z = monPORT.z1 + 1.6; }
    else if (t < 0.5) { x = monPORT.x1 + 1.6; z = lerp(monPORT.z1, monPORT.z0, (t - 0.32) / 0.18); }
    else if (t < 0.82) { x = lerp(monPORT.x1, monPORT.x0, (t - 0.5) / 0.32); z = monPORT.z0 - 1.6; }
    else { x = monPORT.x0 - 1.6; z = lerp(monPORT.z0, monPORT.z1, (t - 0.82) / 0.18); }
    K.cyl(x, monQUAY_Y + 0.30, z, 0.20, 0.60, PALETTE.monQuayDk, 0, 0, 0, 8);
    K.sph(x, monQUAY_Y + 0.62, z, 0.22, 0.13, 0.22, PALETTE.monQuayDk, 6);
  }

  // ---- the two slipways, which are the way out of the water -------------
  // A quay is a wall and an animal that has fallen off one has to be able to
  // get back. The rim in monTerrain is already a four-metre ramp, which is
  // steep; these two are proper concrete slips at about eleven degrees, they
  // are DRAWN so they can be seen from across the basin, and they are where
  // anybody who is not sure would try.
  const slips = [[-24, monPORT.z1, 1], [30, monPORT.z0, -1]];
  for (let s = 0; s < slips.length; s++) {
    const sx = slips[s][0], sz = slips[s][1], dir = slips[s][2];
    for (let i = 0; i < 12; i++) {
      const t = i / 11;
      const y = lerp(monQUAY_Y, monPORT_BED + 0.4, t);
      const zz = sz - dir * (1.4 + t * 13);
      K.box(sx, y, zz, 7.0, 0.30, 1.30, i % 2 ? PALETTE.monQuay : PALETTE.monQuayDk);
      monPoolBox(body, sx, y - 0.4, zz, 7.0, 0.8, 1.34);
    }
  }

  // ---- the two moles ----------------------------------------------------
  // A digue is a wall with a walkway on top. The one across the mouth is the
  // far edge of the chapter and there is a light on the end of it.
  K.box(monMOLE.cx, 2.0, monMOLE.cz, 84, 2.2, 11, PALETTE.monQuay);
  K.box(monMOLE.cx, 3.3, monMOLE.cz - 4.4, 84, 1.1, 1.6, PALETTE.monQuayDk);
  monPoolBox(body, monMOLE.cx, 2.6, monMOLE.cz - 4.4, 84, 2.4, 1.7);
  K.box(monCONTRE.cx, 2.0, monCONTRE.cz, 11, 2.2, 44, PALETTE.monQuay);
  K.box(monCONTRE.cx - 4.4, 3.3, monCONTRE.cz, 1.6, 1.1, 44, PALETTE.monQuayDk);
  monPoolBox(body, monCONTRE.cx - 4.4, 2.6, monCONTRE.cz, 1.7, 2.4, 44);
  // the harbour lights, one each side of the channel. Green to starboard
  // coming in, which is the one piece of pedantry this chapter allows itself.
  K.cyl(-36, 4.4, -100, 0.55, 3.4, PALETTE.monStone, 0, 0, 0, 8);
  K.cyl(-36, 6.4, -100, 0.70, 0.70, PALETTE.monLampGrn, 0, 0, 0, 8);
  K.cyl(-76, 4.4, -108, 0.55, 3.4, PALETTE.monStone, 0, 0, 0, 8);
  K.cyl(-76, 6.4, -108, 0.70, 0.70, PALETTE.monLampRed, 0, 0, 0, 8);

  const g = K.build();
  const m = new THREE.Mesh(g, monVC());
  m.castShadow = true; m.receiveShadow = true;
  root.add(m);

  // the two lamp heads are the only emissive things in this merge, so they are
  // built again as their own two meshes rather than dragging the whole quay
  // into an emissive material
  const gm = monGlow(PALETTE.monLampGrn, 1.5), rm = monGlow(PALETTE.monLampRed, 1.5);
  const bulb = new THREE.CylinderGeometry(0.36, 0.36, 0.44, 8);
  const b1 = new THREE.Mesh(bulb, gm); b1.position.set(-36, 6.5, -100); b1.castShadow = false;
  const b2 = new THREE.Mesh(bulb, rm); b2.position.set(-76, 6.5, -108); b2.castShadow = false;
  b1.userData.noShadow = true; b2.userData.noShadow = true;
  root.add(b1); root.add(b2);

  // ---- the pontoons -----------------------------------------------------
  for (let i = 0; i < 5; i++) {
    const px = -30 + i * 14;
    const p = { x: px, z: monPORT.z1 - 12.5, hx: 1.5, hz: 10.5 };
    monPONT.push(p);
    const P = monMerger();
    P.box(0, monWATER + 0.28, 0, 3.0, 0.34, 21, PALETTE.monTeak);
    for (let k = 0; k < 8; k++) {
      P.box(-1.34, monWATER + 0.52, -9.4 + k * 2.7, 0.16, 0.16, 0.5, PALETTE.monTeakDk);
      P.box(1.34, monWATER + 0.52, -9.4 + k * 2.7, 0.16, 0.16, 0.5, PALETTE.monTeakDk);
    }
    const pg = P.build();
    const pm = new THREE.Mesh(pg, monVC());
    pm.position.set(p.x, 0, p.z);
    pm.castShadow = true; pm.receiveShadow = true;
    root.add(pm);
    monStaticBox(game, p.x, monWATER + 0.20, p.z, 3.0, 0.5, 21);
  }

  monPoolDone(game, body);
}

// ============================================================== THE TOWN =====
/**
 * SIXTY-ONE BUILDINGS, AND EVERY LIT WINDOW IN THE CHAPTER IS ONE INSTANCE.
 *
 * At eight in the evening a town on a hillside is not a set of shapes, it is a
 * set of RECTANGLES OF LIGHT with shapes implied behind them — which is a very
 * cheap thing to draw and the single most important thing to get right here.
 * The blocks themselves merge into one geometry; the windows are one
 * InstancedMesh with an emissive material, so sixteen hundred lit panes cost
 * one draw call and a matrix update that never happens.
 *
 * `monBlock()` is called for each footprint so the locals can steer round them,
 * and every one gets a collider, because the walk-through-buildings audit is a
 * thing this project has already run five times.
 */
const monWinPos = [];             // x, y, z, yaw, w, h  per lit pane
function monWindowAt(x, y, z, yaw, w, h, odds) {
  if (Math.random() > (odds === undefined ? 0.62 : odds)) return;
  monWinPos.push(x, y, z, yaw, w, h);
}

/** One belle-epoque block: plinth, body, cornice, roof, and windows on it. */
function monBlockOf(K, x, z, w, d, h, yaw, style) {
  const base = monTerrain(x, z);
  const body = style === 'pale' ? PALETTE.monStone
             : style === 'ochre' ? PALETTE.monOchre
             : style === 'rose' ? PALETTE.monRose : PALETTE.monStoneDk;
  const trim = style === 'pale' ? PALETTE.monStoneDk : PALETTE.monStone;
  K.box(x, base + h * 0.5, z, w, h, d, body, 0, yaw, 0);
  K.box(x, base + 0.5, z, w + 0.5, 1.0, d + 0.5, PALETTE.monStoneSh, 0, yaw, 0);
  K.box(x, base + h + 0.28, z, w + 0.8, 0.56, d + 0.8, trim, 0, yaw, 0);
  // a terracotta hip, which is what every roof in Liguria is
  K.box(x, base + h + 1.05, z, w * 0.94, 1.0, d * 0.94, PALETTE.monRoof, 0, yaw, 0);
  K.box(x, base + h + 1.62, z, w * 0.52, 0.36, d * 0.52, PALETTE.monRoofDk, 0, yaw, 0);
  // chimneys, because a skyline of flat tops reads as a spreadsheet
  if (w > 9) {
    K.box(x + Math.cos(yaw) * w * 0.3, base + h + 2.0, z - Math.sin(yaw) * w * 0.3,
          1.0, 1.6, 1.0, PALETTE.monRoofDk, 0, yaw, 0);
  }
  // ---- and the light ----------------------------------------------------
  const rows = Math.max(1, Math.floor(h / 3.4));
  const cols = Math.max(2, Math.floor(w / 3.2));
  const cs = Math.sin(yaw), cc = Math.cos(yaw);
  for (let r = 0; r < rows; r++) {
    const wy = base + 2.4 + r * 3.4;
    if (wy > base + h - 1.2) continue;
    for (let cI = 0; cI < cols; cI++) {
      const ox = (cI - (cols - 1) / 2) * (w / cols);
      // the two long faces only: a window on a party wall is a window into
      // the next building
      monWindowAt(x + ox * cc + (d * 0.5 + 0.14) * cs, wy, z - ox * cs + (d * 0.5 + 0.14) * cc,
                  yaw, 1.05, 1.75);
      monWindowAt(x + ox * cc - (d * 0.5 + 0.14) * cs, wy, z - ox * cs - (d * 0.5 + 0.14) * cc,
                  yaw + Math.PI, 1.05, 1.75);
    }
  }
  monBlock(x, z, Math.max(w, d) * 0.5);
}

// The Condamine and the hillside above it. Hand-placed rather than scattered:
// a town is a set of streets and a scatter is a set of accidents, and the one
// thing the eye reads instantly is whether the buildings agree with each other
// about where the road is.
const monTOWN = [
  // the north side of the port, four terraces stepping up La Condamine
  [-42, 2, 16, 13, 14, 0.05, 'pale'], [-24, 4, 15, 13, 17, 0.05, 'ochre'],
  [-6, 4, 15, 13, 15, 0.05, 'pale'], [12, 4, 16, 13, 19, 0.05, 'rose'],
  [30, 3, 15, 13, 16, 0.05, 'pale'], [46, 2, 14, 12, 13, 0.05, 'ochre'],
  [-40, 20, 16, 13, 20, 0.03, 'pale'], [-22, 21, 16, 13, 23, 0.03, 'rose'],
  [-4, 21, 16, 13, 21, 0.03, 'ochre'], [14, 21, 16, 13, 25, 0.03, 'pale'],
  [32, 20, 15, 13, 19, 0.03, 'pale'], [48, 19, 14, 12, 17, 0.03, 'rose'],
  [-38, 38, 17, 13, 24, 0.0, 'ochre'], [-18, 39, 17, 13, 27, 0.0, 'pale'],
  [2, 39, 17, 13, 25, 0.0, 'rose'], [22, 38, 16, 13, 22, 0.0, 'pale'],
  // the west side, up toward the Rock
  // ...AND THEY ARE CLEAR OF THE RAMP. The first four sat at (-64,-12),
  // (-72,-34), (-78,8) and (-92,-22); the Rampe Major runs within four metres
  // of the third of those, which is a colonial terrace with a staircase
  // through the middle of it.
  [-70, -26, 14, 15, 15, 0.3, 'pale'], [-86, -54, 14, 16, 13, 0.4, 'ochre'],
  [-98, -14, 13, 14, 16, 0.2, 'rose'], [-58, -66, 13, 15, 12, 0.5, 'pale'],
  // the east side, under the terrace
  [70, -6, 15, 15, 21, -0.2, 'pale'], [78, 14, 15, 15, 24, -0.15, 'ochre'],
  [88, -20, 14, 15, 18, -0.3, 'rose'], [66, 26, 15, 14, 22, -0.1, 'pale'],
  // the hillside behind, which is mostly a wall of lit windows
  [-30, 62, 18, 14, 26, 0.0, 'pale'], [-6, 64, 18, 14, 30, 0.0, 'ochre'],
  [18, 63, 18, 14, 28, 0.0, 'rose'], [42, 60, 17, 14, 24, 0.0, 'pale'],
  [-34, 86, 18, 14, 28, 0.0, 'ochre'], [-8, 90, 18, 14, 32, 0.0, 'pale'],
  [16, 88, 18, 14, 30, 0.0, 'rose'], [40, 84, 17, 14, 26, 0.0, 'ochre'],
  [-38, 112, 18, 14, 30, 0.0, 'pale'], [-10, 116, 18, 14, 34, 0.0, 'rose'],
  [18, 114, 18, 14, 31, 0.0, 'pale'], [46, 110, 17, 14, 27, 0.0, 'ochre'],
  [-20, 142, 18, 14, 30, 0.0, 'pale'], [14, 144, 18, 14, 33, 0.0, 'ochre'],
  [50, 140, 17, 14, 28, 0.0, 'rose'], [86, 136, 17, 14, 26, 0.0, 'pale'],
  // and the towers east of the terrace, which is what Monaco actually looks
  // like from the water: nineteenth-century at the bottom and 1970s on top
  [166, 96, 20, 20, 52, 0.1, 'pale'], [192, 76, 18, 18, 46, 0.2, 'pale'],
  [188, 118, 18, 18, 40, 0.0, 'ochre'], [148, 130, 18, 18, 44, 0.0, 'pale'],
  [214, 100, 18, 18, 38, 0.0, 'rose'],
];

function monBuildTown(game, root) {
  const K = monMerger();
  const body = monPoolBody(game);
  for (let i = 0; i < monTOWN.length; i++) {
    const t = monTOWN[i];
    monBlockOf(K, t[0], t[1], t[2], t[3], t[4], t[5], t[6]);
    monPoolBox(body, t[0], monTerrain(t[0], t[1]) + t[4] * 0.5, t[1],
               t[2], t[4] + 2.4, t[3], t[5]);
  }
  const m = new THREE.Mesh(K.build(), monVCF());
  m.castShadow = true; m.receiveShadow = true;
  root.add(m);
  monPoolDone(game, body);
}

/**
 * EVERY LIT PANE IN THE CHAPTER, in one instanced draw.
 *
 * Built AFTER every block, the terrace and the Rock, so a window anywhere in
 * the chapter joins the same field. They do not cast — a light source that
 * casts a shadow is a shadow casting a shadow, which is the Cappadocia bug —
 * and they do not receive, because a pane of lit glass at dusk is not lit BY
 * anything.
 */
function monBuildWindows(root) {
  const n = monWinPos.length / 6;
  if (!n) return;
  const geo = new THREE.PlaneGeometry(1, 1);
  const m = new THREE.InstancedMesh(geo, monGlow(PALETTE.monWindow, 0.95), n);
  m.castShadow = false; m.receiveShadow = false;
  m.frustumCulled = false;
  const col = new Float32Array(n * 3);
  const warm = new THREE.Color(PALETTE.monWindow);
  const cool = new THREE.Color(PALETTE.monWindowCool);
  for (let i = 0; i < n; i++) {
    const x = monWinPos[i * 6], y = monWinPos[i * 6 + 1], z = monWinPos[i * 6 + 2];
    const yaw = monWinPos[i * 6 + 3], w = monWinPos[i * 6 + 4], h = monWinPos[i * 6 + 5];
    monM.compose(monV3.set(x, y, z), monQ.setFromEuler(monE.set(0, yaw, 0, 'YXZ')),
                 monSc.set(w, h, 1));
    m.setMatrixAt(i, monM);
    // Not one colour. A street of identical windows is a spreadsheet; a real
    // one has about a fifth of its lights cold, because somebody in it owns a
    // television.
    monCol.copy(Math.random() < 0.22 ? cool : warm);
    const k = 0.72 + Math.random() * 0.46;
    col[i * 3] = monCol.r * k; col[i * 3 + 1] = monCol.g * k; col[i * 3 + 2] = monCol.b * k;
  }
  m.instanceColor = new THREE.InstancedBufferAttribute(col, 3);
  m.instanceMatrix.needsUpdate = true;
  monWinMesh = m;
  root.add(m);
}

// ============================================================== THE ROCK =====
/**
 * LE ROCHER — the plateau, the ramp up it, the Palace and the one guard.
 *
 * It is fifty-eight metres up and there is exactly one way onto it on foot,
 * which is true of the real place and is the whole reason it exists: everything
 * else in this chapter happens down at the water or up on the terrace, and the
 * Rock is where the chapter is not happening. Two of the three things worth
 * finding here are about that.
 */
function monBuildRock(game, root) {
  const K = monMerger();
  const body = monPoolBody(game);
  const py = monPALACE.y;

  // ---- the Palace. A long low front with a crenellated tower on each end.
  const px = monPALACE.x, pz = monPALACE.z;
  K.box(px, py + 6, pz, 46, 12, 20, PALETTE.monStone);
  K.box(px, py + 12.4, pz, 47, 1.0, 21, PALETTE.monStoneDk);
  K.box(px, py + 13.4, pz, 44, 1.2, 18, PALETTE.monRoof);
  for (let s = -1; s <= 1; s += 2) {
    K.box(px + s * 24, py + 9, pz, 9, 18, 9, PALETTE.monStone);
    K.box(px + s * 24, py + 18.4, pz, 10, 1.0, 10, PALETTE.monStoneDk);
    for (let c = 0; c < 4; c++) {
      for (let d = 0; d < 4; d++) {
        if ((c + d) % 2) continue;
        K.box(px + s * 24 - 3.6 + c * 2.4, py + 19.5, pz - 3.6 + d * 2.4,
              1.6, 1.4, 1.6, PALETTE.monStoneDk);
      }
    }
    monPoolBox(body, px + s * 24, py + 9, pz, 9, 18, 9);
  }
  monPoolBox(body, px, py + 6.5, pz, 46, 13, 20);
  // the arcade along the front, which is the bit everybody photographs
  for (let i = 0; i < 9; i++) {
    const ax = px - 18 + i * 4.5;
    K.cyl(ax, py + 3.2, pz - 10.6, 0.44, 6.4, PALETTE.monStone, 0, 0, 0, 8);
    K.box(ax, py + 6.6, pz - 10.6, 4.4, 0.7, 1.2, PALETTE.monStoneDk);
    monWindowAt(px - 18 + i * 4.5, py + 8.6, pz - 9.8, Math.PI, 1.2, 2.0, 0.5);
  }
  // the two sentry boxes and the clock
  for (let s = -1; s <= 1; s += 2) {
    K.box(px + s * 7, py + 1.4, pz - 12.4, 1.5, 2.8, 1.5, PALETTE.monGuardBox);
    K.cone(px + s * 7, py + 3.2, pz - 12.4, 1.15, 1.1, PALETTE.monRoofDk, 0, 0.78, 0, 4);
  }
  K.cyl(px, py + 15.6, pz - 10.2, 1.6, 0.4, PALETTE.monStone, Math.PI / 2, 0, 0, 12);
  K.cyl(px, py + 15.6, pz - 10.45, 1.35, 0.1, PALETTE.monClock, Math.PI / 2, 0, 0, 12);

  // ---- the cathedral, two hundred metres along the plateau
  K.box(px - 44, py + 7, pz + 26, 16, 14, 26, PALETTE.monStone);
  K.box(px - 44, py + 15, pz + 26, 17, 2.0, 27, PALETTE.monStoneDk);
  K.box(px - 44, py + 16.6, pz + 26, 15, 1.4, 25, PALETTE.monRoof);
  K.box(px - 44, py + 12, pz + 12, 8, 24, 8, PALETTE.monStone);
  K.cone(px - 44, py + 27, pz + 12, 6.0, 6.0, PALETTE.monCopper, 0, 0.78, 0, 4);
  monPoolBox(body, px - 44, py + 8, pz + 26, 16, 16, 26);
  monPoolBox(body, px - 44, py + 12, pz + 12, 8, 24, 8);
  monBlock(px - 44, pz + 26, 12);
  monBlock(px, pz, 24);

  // ---- the ramp. THE ONLY WAY UP, and it is drawn as a thing rather than
  // left as a slope, because a player who cannot see a way up assumes there
  // is not one. Twenty-two steps of limestone with a wall on the sea side.
  // ITS BEARING IS DERIVED, NOT TYPED. The first build had a hand-written yaw
  // of -0.75 against a run of -2.32, so twenty-seven flights of steps lay
  // across the ramp instead of along it and the whole thing read as a
  // ziggurat from the far quay.
  // ONE LIST, DRAWN AND WALKED. The paving is laid along monPATH — the same
  // polyline the terrain has already been blended toward — so the stones sit
  // ON the ramp by construction and there is no second set of numbers that can
  // drift away from it. No collider: the ground under it IS the ramp.
  for (let leg = 0; leg < monPATH.length - 1; leg++) {
    const a = monPATH[leg], b = monPATH[leg + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(2, Math.round(len / 2.4));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const rx = lerp(a[0], b[0], t), rz = lerp(a[1], b[1], t);
      const ry = monTerrain(rx, rz);
      K.box(rx, ry + 0.06, rz, 7.6, 0.22, 2.3,
            i % 2 ? PALETTE.monStone : PALETTE.monStoneDk, 0, yaw, 0);
      // the parapet, on the seaward side only, which is which side the Rock is
      K.box(rx - 3.9 * Math.cos(yaw), ry + 0.62, rz + 3.9 * Math.sin(yaw),
            0.7, 1.1, 2.3, PALETTE.monStoneDk, 0, yaw, 0);
      if (i % 5 === 0) monLamp(rx + 3.4 * Math.cos(yaw), rz - 3.4 * Math.sin(yaw));
    }
  }

  // ---- cypresses along the plateau edge. The only vertical the Rock has.
  for (let i = 0; i < 16; i++) {
    const a = -1.5 + i * 0.28;
    const cxx = px - 10 + Math.cos(a) * 46, czz = pz + 6 + Math.sin(a) * 40;
    const cy = monTerrain(cxx, czz);
    if (cy < py - 6) continue;
    K.cyl(cxx, cy + 1.0, czz, 0.32, 2.0, PALETTE.monTrunk, 0, 0, 0, 6);
    K.cone(cxx, cy + 6.0, czz, 1.35, 10.0, PALETTE.monCypress, 0, 0, 0, 6);
    monBlock(cxx, czz, 1.1);
  }

  const m = new THREE.Mesh(K.build(), monVCF());
  m.castShadow = true; m.receiveShadow = true;
  root.add(m);
  monPoolDone(game, body);
}

/**
 * THE GUARD, and the whole of his job is not to move.
 *
 * A carabinier in summer whites outside the Palace. He is not a `local` — he
 * has no lines and never turns to watch you, which is the joke — he is a
 * figure with one number on him, `monGuardBreak`, which is how close he is to
 * laughing. Wheek at him, climb on the sentry box, sit on his foot; at 1.0 he
 * breaks, and it is the only time in the chapter anybody's composure goes.
 */
function monBuildGuard(root) {
  const K = monMerger();
  K.box(0, 0.42, 0, 0.72, 0.84, 0.46, PALETTE.monGuardTrim);     // the trousers
  K.box(0, 1.16, 0, 0.78, 0.68, 0.50, PALETTE.monGuard);          // the tunic
  K.box(0, 1.30, 0, 0.80, 0.10, 0.52, PALETTE.monGuardTrim);      // the belt is high
  for (let s = -1; s <= 1; s += 2) {
    K.box(s * 0.46, 1.14, 0, 0.20, 0.66, 0.22, PALETTE.monGuard);
  }
  K.box(0, 1.62, 0, 0.30, 0.28, 0.30, PALETTE.monSkin);           // the neck and head
  K.sph(0, 1.86, 0, 0.24, 0.26, 0.24, PALETTE.monSkin, 8);
  K.cyl(0, 2.06, 0, 0.29, 0.20, PALETTE.monGuard, 0, 0, 0, 8);    // the kepi
  K.cyl(0, 2.16, 0, 0.30, 0.05, PALETTE.monGuardTrim, 0, 0, 0, 8);
  K.box(0, 1.98, 0.26, 0.34, 0.05, 0.22, PALETTE.monGuardTrim);   // the peak
  K.cyl(0.40, 1.40, -0.10, 0.045, 2.10, PALETTE.monTrunk, 0, 0, 0, 6);  // and the rifle
  K.box(0.40, 2.30, -0.10, 0.10, 0.30, 0.06, PALETTE.monGuardTrim);
  const g = new THREE.Group();
  const m = new THREE.Mesh(K.build(), monVCF());
  m.castShadow = true;
  g.add(m);
  g.position.set(monPALACE.x + 7, monPALACE.y, monPALACE.z - 11.0);
  g.rotation.y = Math.PI;
  monGuardG = g;
  root.add(g);
}

// ============================================================ THE TERRACE ====
/**
 * MONTE-CARLO ITSELF: the square, the gardens, the Hotel de Paris, the Cafe de
 * Paris, and the Casino, which is the only building in this game with an
 * inside.
 *
 * The exterior is deliberately SYMMETRICAL and the interior deliberately is
 * not. Everything on the square is arranged about the axis through the front
 * door, which is what makes the place read as a set at a hundred metres; the
 * moment you are through that door the axis stops and the room is a
 * left-and-right of cover, sight lines and gaps, because that is a different
 * job and the eye has to be able to read it as one.
 */
function monBuildTerrace(game, root) {
  const K = monMerger();
  const body = monPoolBody(game);
  const ty = monTERR.h;
  const cx = monCASINO.x, cz = monCASINO.z, w = monCASINO.w, d = monCASINO.d;

  // ---- the Casino, from the outside -------------------------------------
  // A central block with a pavilion each end, two oxidised copper cupolas,
  // and more gilt than is strictly necessary anywhere.
  //
  // THE BODY OF IT IS NOT DRAWN HERE, AND THIS IS THE ONE BUILDING IN THE GAME
  // WHERE THAT MATTERS. Sixty-odd buildings in seventeen chapters are solid
  // boxes because nobody is ever inside one; this one is FOUR WALLS WITH
  // THICKNESS, a floor and a ceiling, built in monBuildCasino below. From
  // outside you see the outer faces; from inside, the far wall's INNER face is
  // front-facing and the near wall's is not, so the third-person camera sees
  // straight through the wall it is behind and the room stays closed on every
  // other side. A solid box would have been a casino nobody can be in, and a
  // shell of single planes would be the cave's canyon-with-a-lid-on.
  K.box(cx, ty + 18.4, cz, w + 1.6, 1.0, d + 1.6, PALETTE.monGold);
  K.box(cx, ty + 19.4, cz, w * 0.96, 1.2, d * 0.96, PALETTE.monRoofDk);
  // the two towers
  for (let s = -1; s <= 1; s += 2) {
    const tx = cx + s * (w * 0.5 - 6);
    K.box(tx, ty + 12.0, cz - d * 0.5 + 5, 12, 24, 12, PALETTE.monStone);
    K.box(tx, ty + 24.6, cz - d * 0.5 + 5, 13.4, 1.2, 13.4, PALETTE.monGold);
    K.cyl(tx, ty + 27.6, cz - d * 0.5 + 5, 5.4, 5.0, PALETTE.monCopper, 0, 0, 0, 8);
    K.sph(tx, ty + 30.6, cz - d * 0.5 + 5, 4.6, 3.2, 4.6, PALETTE.monCopperLt, 8);
    K.cyl(tx, ty + 33.4, cz - d * 0.5 + 5, 0.34, 2.6, PALETTE.monGold, 0, 0, 0, 6);
    K.sph(tx, ty + 34.9, cz - d * 0.5 + 5, 0.5, 0.5, 0.5, PALETTE.monGold, 6);
    monPoolBox(body, tx, ty + 12, cz - d * 0.5 + 5, 12, 26, 12);
  }
  // the entrance front: eight columns, a pediment, and the doors
  const fz = cz - d * 0.5;
  for (let i = 0; i < 8; i++) {
    const ox = -12.6 + i * 3.6;
    K.cyl(cx + ox, ty + 5.6, fz - 2.6, 0.62, 11.2, PALETTE.monMarble, 0, 0, 0, 8);
    K.cyl(cx + ox, ty + 11.4, fz - 2.6, 0.78, 0.55, PALETTE.monGold, 0, 0, 0, 8);
  }
  K.box(cx, ty + 12.4, fz - 2.6, 30, 1.6, 3.2, PALETTE.monStoneDk);
  K.box(cx, ty + 13.9, fz - 2.6, 26, 1.6, 2.6, PALETTE.monGold);
  // the steps up to the door. Nine of them, and they are the front of the
  // chapter: the only door, and the only way back in after being thrown out.
  for (let i = 0; i < 9; i++) {
    K.box(cx, ty - 0.1 + i * 0.34, fz - 8.4 + i * 0.9, 24 - i * 0.6, 0.4, 1.0, PALETTE.monMarble);
    monPoolBox(body, cx, ty - 0.4 + i * 0.34, fz - 8.4 + i * 0.9, 24 - i * 0.6, 0.7, 1.05);
  }
  // the awning over the door, which is the one warm thing on the facade.
  // (The doorway itself is a HOLE in the front wall and the wall is built in
  // monBuildCasino, so there is exactly one list of pieces round that gap.)
  // A MARQUISE, and the posts go all the way to the ground. At its first size
  // it was a flat grey slab on two short brass legs floating five metres up
  // the facade, which reads at any distance as a table.
  K.box(cx, ty + 5.6, fz - 3.6, 9.0, 0.30, 5.0, PALETTE.monAwningRed, -0.13, 0, 0);
  K.box(cx, ty + 5.05, fz - 6.0, 9.2, 0.55, 0.28, PALETTE.monGold);
  for (let s = -1; s <= 1; s += 2) {
    K.cyl(cx + s * 4.2, ty + 2.4, fz - 6.0, 0.10, 5.2, PALETTE.monBrass, 0, 0, 0, 6);
    K.cyl(cx + s * 4.2, ty - 0.15, fz - 6.0, 0.22, 0.30, PALETTE.monGoldDk, 0, 0, 0, 8);
  }

  // ---- the Hotel de Paris, across the square ----------------------------
  const hx = 72, hz = 74;
  K.box(hx, ty + 11, hz, 34, 22, 24, PALETTE.monStone, 0, 0.28, 0);
  K.box(hx, ty + 22.6, hz, 35.6, 1.2, 25.6, PALETTE.monStoneDk, 0, 0.28, 0);
  K.box(hx, ty + 24.0, hz, 33, 1.6, 23, PALETTE.monRoofDk, 0, 0.28, 0);
  for (let s = -1; s <= 1; s += 2) {
    K.cyl(hx + s * 15, ty + 25.4, hz, 3.4, 4.4, PALETTE.monRoofDk, 0, 0, 0, 8);
    K.cone(hx + s * 15, ty + 29.4, hz, 3.8, 3.6, PALETTE.monCopper, 0, 0, 0, 8);
  }
  monPoolBox(body, hx, ty + 12, hz, 34, 24, 24, 0.28);
  monBlock(hx, hz, 17);
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 8; c++) {
      monWindowAt(hx - 14 + c * 4, ty + 3 + r * 3.4, hz - 12.4, 0.28, 1.2, 1.9, 0.7);
    }
  }
  // the canopy and the four cars nobody is ever going to move
  K.box(hx, ty + 4.4, hz - 14.6, 20, 0.3, 6, PALETTE.monAwning, 0, 0.28, 0);

  // ---- the Cafe de Paris, the other side --------------------------------
  const fx = 118, fzz = 56;
  K.box(fx, ty + 6, fzz, 30, 12, 18, PALETTE.monStone);
  K.box(fx, ty + 12.6, fzz, 31.4, 1.2, 19.4, PALETTE.monGold);
  K.box(fx, ty + 14.0, fzz, 29, 1.6, 17, PALETTE.monRoofDk);
  monPoolBox(body, fx, ty + 6.5, fzz, 30, 13, 18);
  monBlock(fx, fzz, 15);
  // the terrace of the cafe: twenty-two little round tables under an awning,
  // which is where everybody on this square actually is
  K.box(fx, ty + 3.6, fzz - 12.0, 30, 0.28, 8.0, PALETTE.monAwningRed);
  for (let i = 0; i < 22; i++) {
    const tx = fx - 13 + (i % 11) * 2.6, tz = fzz - 14.4 + Math.floor(i / 11) * 3.0;
    K.cyl(tx, ty + 0.34, tz, 0.09, 0.68, PALETTE.monBrass, 0, 0, 0, 6);
    K.cyl(tx, ty + 0.72, tz, 0.42, 0.06, PALETTE.monMarble, 0, 0, 0, 8);
    for (let s = -1; s <= 1; s += 2) {
      K.box(tx + s * 0.72, ty + 0.24, tz, 0.42, 0.48, 0.42, PALETTE.monChairR);
      K.box(tx + s * 0.72, ty + 0.68, tz + s * 0.18, 0.42, 0.44, 0.08, PALETTE.monChairR);
    }
  }

  // ---- the gardens on the square ----------------------------------------
  // A parterre, a fountain, and the one flowering thing in the principality.
  const gx = monSQUARE.x, gz = monSQUARE.z;
  K.cyl(gx, ty + 0.24, gz, 7.6, 0.5, PALETTE.monMarbleDk, 0, 0, 0, 12);
  K.cyl(gx, ty + 0.52, gz, 7.0, 0.12, PALETTE.monPool, 0, 0, 0, 12);
  K.cyl(gx, ty + 0.9, gz, 1.5, 1.2, PALETTE.monMarble, 0, 0, 0, 8);
  K.cyl(gx, ty + 1.6, gz, 2.4, 0.24, PALETTE.monMarble, 0, 0, 0, 12);
  K.cyl(gx, ty + 2.3, gz, 0.5, 1.2, PALETTE.monMarble, 0, 0, 0, 8);
  K.cyl(gx, ty + 3.0, gz, 1.3, 0.20, PALETTE.monMarble, 0, 0, 0, 12);
  monPoolBox(body, gx, ty + 0.7, gz, 15.2, 1.4, 15.2);
  monBlock(gx, gz, 7.8);
  for (let i = 0; i < 4; i++) {
    const a = i * 1.5708 + 0.78;
    const bx = gx + Math.cos(a) * 15, bz = gz + Math.sin(a) * 13;
    K.box(bx, ty + 0.22, bz, 9, 0.44, 7, PALETTE.monHedge);
    K.box(bx, ty + 0.52, bz, 8.2, 0.24, 6.2, PALETTE.monBougain);
  }

  const m = new THREE.Mesh(K.build(), monVCF());
  m.castShadow = true; m.receiveShadow = true;
  root.add(m);
  monPoolDone(game, body);

  // the Casino's own lit windows, which are the tell that there is an inside
  for (let i = 0; i < 10; i++) {
    monWindowAt(cx - 18 + i * 4, ty + 9.5, fz - 0.9, Math.PI, 1.6, 3.2, 1.0);
    monWindowAt(cx - 18 + i * 4, ty + 9.5, cz + d * 0.5 + 0.14, 0, 1.6, 3.2, 1.0);
  }
}

// ============================================================ THE INSIDE =====
// The one room in this game, and the second act happens entirely between its
// floor and the ceiling twelve metres above it.
//
// THE PLAN, and it is a plan and not a decoration. Everything is measured off
// `monFRONT_Z`, so the room can be moved along the terrace by changing one
// number and nothing inside it drifts:
//
//     +0    the front wall, with one 4.4 m gap in the middle: the DOOR
//     +5    the atrium. Marble, columns, a red carpet, and nowhere at all to hide
//     +13   the arch through into the salon
//     +18   four tables, two banks of palms, a piano
//     +26   the wheel, at the back, on the axis, lit from directly above
//     +34   the back wall
//
// Cover runs LEFT AND RIGHT and the sight lines run front to back, so crossing
// the room is a sequence of decisions about which side to be on. The five
// people who look at it sweep across the width, which means the safe moment is
// always brief and always somewhere.
const monCOVER = [];              // {x, z, r} — things you cannot be seen through
function monCover(x, z, r) { monCOVER.push({ x: x, z: z, r: r }); }
/** Is the line from (ax,az) to (bx,bz) broken by anything in the room? */
function monBlockedSight(ax, az, bx, bz) {
  const ex = bx - ax, ez = bz - az;
  const L2 = ex * ex + ez * ez;
  if (L2 < 1e-6) return false;
  for (let i = 0; i < monCOVER.length; i++) {
    const c = monCOVER[i];
    let t = ((c.x - ax) * ex + (c.z - az) * ez) / L2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = ax + ex * t - c.x, pz = az + ez * t - c.z;
    if (px * px + pz * pz < c.r * c.r) return true;
  }
  return false;
}

const monARCH_Z  = monFRONT_Z + 13;
const monTABLES = [
  { x: 106, z: monFRONT_Z + 17, yaw: 0.0 },
  { x: 130, z: monFRONT_Z + 17, yaw: 0.0 },
  { x: 104, z: monFRONT_Z + 27, yaw: 0.0 },
  { x: 128, z: monFRONT_Z + 31, yaw: 0.5 },
];

function monBuildCasino(game, root) {
  const K = monMerger();          // the shell and the furniture, one merge
  const KG = monMerger();         // ...and everything that is switched on
  const body = monPoolBody(game);
  const ty = monTERR.h;
  const fy = monFLOOR_Y;
  const cx = monCASINO.x, w = monCASINO.w;
  const z0 = monFRONT_Z, z1 = monBACK_Z;
  const x0 = cx - w * 0.5, x1 = cx + w * 0.5;
  const H = 12.0;                 // floor to ceiling
  const T = 1.2;                  // wall thickness

  // ---- the floor. Marble, in squares, because a plain slab at this size is
  // a car park, and the squares are what tell you how fast you are crossing it.
  for (let i = 0; i < 12; i++) {
    for (let j = 0; j < 17; j++) {
      const px = x0 + 2 + i * 4, pz = z0 + 2 + j * 2;
      K.box(px, fy - 0.15, pz, 4, 0.3, 2, (i + j) % 2 ? PALETTE.monMarble : PALETTE.monMarbleDk);
    }
  }
  monPoolBox(body, cx, fy - 0.35, (z0 + z1) / 2, w + 2, 0.7, z1 - z0 + 2);

  // ---- the walls. Four of them, with a hole in the front one. -----------
  const walls = [
    [(x0 + cx - 2.2) / 2, z0, (cx - 2.2) - x0, T],       // front, left of the door
    [(x1 + cx + 2.2) / 2, z0, x1 - (cx + 2.2), T],       // front, right of it
    [cx, z1, w, T],                                       // the back
    [x0, (z0 + z1) / 2, T, z1 - z0],                      // and the two long sides
    [x1, (z0 + z1) / 2, T, z1 - z0],
  ];
  for (let i = 0; i < walls.length; i++) {
    const ww = walls[i];
    if (ww[2] <= 0.01) continue;
    K.box(ww[0], fy + H * 0.5, ww[1], ww[2], H, ww[3], PALETTE.monStoneDk);
    monPoolBox(body, ww[0], fy + H * 0.5, ww[1], ww[2], H + 2, ww[3]);
  }
  // the lintel over the door, so the hole is a doorway and not a slot
  K.box(cx, fy + 5.4 + (H - 5.4) * 0.5, z0, 4.4, H - 5.4, T, PALETTE.monStoneDk);
  monPoolBox(body, cx, fy + 5.4 + (H - 5.4) * 0.5, z0, 4.4, H - 5.4, T);
  // ...and the two gilt jambs, which are how you find the door from the square
  for (let s = -1; s <= 1; s += 2) {
    K.box(cx + s * 2.4, fy + 2.7, z0 - 0.1, 0.5, 5.4, T + 0.5, PALETTE.monGold);
  }

  // ---- the ceiling, and it is a BOX so you see its underside ------------
  K.box(cx, fy + H + 0.6, (z0 + z1) / 2, w, 1.2, z1 - z0, PALETTE.monStone);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 5; j++) {
      K.box(x0 + 7 + i * 11, fy + H - 0.28, z0 + 5 + j * 6.4, 8.4, 0.56, 4.6, PALETTE.monGoldDk);
      K.box(x0 + 7 + i * 11, fy + H - 0.5, z0 + 5 + j * 6.4, 7.2, 0.4, 3.6, PALETTE.monCeil);
    }
  }

  // ---- the red carpet, straight up the middle from the door -------------
  // Door to wheel, on the axis, and it is a sentence about the building.
  K.box(cx, fy + 0.03, (z0 + monWHEEL.z) / 2, 5.2, 0.06, monWHEEL.z - z0, PALETTE.monCarpet);
  K.box(cx, fy + 0.05, (z0 + monWHEEL.z) / 2, 4.4, 0.06, monWHEEL.z - z0, PALETTE.monCarpetDk);

  // ---- the arch between the atrium and the salon ------------------------
  for (let s = -1; s <= 1; s += 2) {
    K.box(cx + s * 12, fy + H * 0.5, monARCH_Z, 20, H, 1.4, PALETTE.monStoneDk);
    monPoolBox(body, cx + s * 12, fy + H * 0.5, monARCH_Z, 20, H + 2, 1.4);
    monCover(cx + s * 12, monARCH_Z, 5.5);
    K.cyl(cx + s * 3.0, fy + 4.5, monARCH_Z, 0.62, 9.0, PALETTE.monMarble, 0, 0, 0, 8);
    K.cyl(cx + s * 3.0, fy + 9.3, monARCH_Z, 0.80, 0.62, PALETTE.monGold, 0, 0, 0, 8);
    monCover(cx + s * 3.0, monARCH_Z, 0.85);
    monPoolBox(body, cx + s * 3.0, fy + 4.5, monARCH_Z, 1.3, 9.0, 1.3);
  }
  K.box(cx, fy + 10.2, monARCH_Z, 26, 2.4, 1.4, PALETTE.monStoneDk);

  // ---- the columns down both sides of the salon -------------------------
  for (let i = 0; i < 4; i++) {
    for (let s = -1; s <= 1; s += 2) {
      const px = cx + s * 20, pz = monFRONT_Z + 16 + i * 6.5;
      K.cyl(px, fy + 4.8, pz, 0.72, 9.6, PALETTE.monMarble, 0, 0, 0, 8);
      K.cyl(px, fy + 9.8, pz, 0.92, 0.7, PALETTE.monGold, 0, 0, 0, 8);
      K.cyl(px, fy + 0.24, pz, 0.95, 0.48, PALETTE.monMarbleDk, 0, 0, 0, 8);
      monPoolBox(body, px, fy + 5, pz, 1.5, 10, 1.5);
      monCover(px, pz, 1.0);
    }
  }

  // ---- FOUR TABLES, and they are most of the cover the room has ---------
  for (let i = 0; i < monTABLES.length; i++) {
    const t = monTABLES[i];
    const yaw = t.yaw;
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    K.box(t.x, fy + 0.78, t.z, 4.6, 0.20, 2.6, PALETTE.monBaize, 0, yaw, 0);
    K.box(t.x, fy + 0.66, t.z, 4.8, 0.16, 2.8, PALETTE.monTeakDk, 0, yaw, 0);
    K.box(t.x, fy + 0.36, t.z, 4.2, 0.60, 2.2, PALETTE.monTeak, 0, yaw, 0);
    // the felt has numbers painted on it in three colours, which at this
    // distance is exactly as much of a roulette layout as anybody needs
    for (let c = 0; c < 12; c++) {
      const ox = -1.9 + (c % 6) * 0.76, oz = -0.5 + Math.floor(c / 6) * 1.0;
      K.box(t.x + ox * cs - oz * sn, fy + 0.885, t.z - ox * sn - oz * cs,
            0.62, 0.02, 0.80,
            c % 3 === 0 ? PALETTE.monChipR : c % 3 === 1 ? PALETTE.monChipK : PALETTE.monBaizeDk,
            0, yaw, 0);
    }
    monPoolBox(body, t.x, fy + 0.5, t.z, 4.8, 1.0, 2.8, yaw);
    monCover(t.x, t.z, 2.0);
    monBlock(t.x, t.z, 2.4);
    // and four chairs, because a table with nobody's chair at it is a plinth
    for (let s = -1; s <= 1; s += 2) {
      for (let c = -1; c <= 1; c += 2) {
        const ox = c * 1.4, oz = s * 2.1;
        const px = t.x + ox * cs - oz * sn;
        const pz = t.z - ox * sn - oz * cs;
        K.box(px, fy + 0.30, pz, 0.52, 0.60, 0.52, PALETTE.monChairR, 0, yaw, 0);
        K.box(px, fy + 0.86, pz + oz * 0.11, 0.52, 0.60, 0.10, PALETTE.monChairR, 0, yaw, 0);
        monCover(px, pz, 0.5);
      }
    }
  }

  // ---- TWO BANKS OF PALMS. The only soft cover in the room. -------------
  const palms = [[100, 9], [136, 9], [98, 23], [138, 23], [110, 33], [141, 29]];
  for (let i = 0; i < palms.length; i++) {
    const px = palms[i][0], pz = monFRONT_Z + palms[i][1];
    K.cyl(px, fy + 0.30, pz, 0.72, 0.60, PALETTE.monPotTerra, 0, 0, 0, 8);
    K.cyl(px, fy + 0.62, pz, 0.62, 0.10, PALETTE.monSoil, 0, 0, 0, 8);
    K.cyl(px, fy + 1.6, pz, 0.14, 2.0, PALETTE.monTrunk, 0, 0, 0, 6);
    for (let f = 0; f < 7; f++) {
      const a = f * 0.897;
      K.box(px + Math.cos(a) * 0.85, fy + 2.7, pz + Math.sin(a) * 0.85,
            1.9, 0.07, 0.42, PALETTE.monPalm, 0.22 * Math.cos(a), -a, 0.22 * Math.sin(a));
    }
    monCover(px, pz, 0.95);
    monBlock(px, pz, 0.85);
    monPoolBox(body, px, fy + 0.4, pz, 1.5, 0.8, 1.5);
  }

  // ---- the caisse, and the paintings down the long walls ----------------
  K.box(x1 - 4.5, fy + 0.62, monFRONT_Z + 6, 2.2, 1.24, 6.0, PALETTE.monTeakDk);
  K.box(x1 - 4.5, fy + 1.28, monFRONT_Z + 6, 2.4, 0.10, 6.2, PALETTE.monMarble);
  monPoolBox(body, x1 - 4.5, fy + 0.7, monFRONT_Z + 6, 2.4, 1.4, 6.0);
  monCover(x1 - 4.5, monFRONT_Z + 6, 1.5);
  monBlock(x1 - 4.5, monFRONT_Z + 6, 1.8);
  for (let i = 0; i < 5; i++) {
    const pz = monFRONT_Z + 5 + i * 6;
    K.box(x0 + 0.75, fy + 6.4, pz, 0.18, 3.4, 2.4, PALETTE.monGoldDk);
    K.box(x0 + 0.86, fy + 6.4, pz, 0.10, 2.8, 1.9, PALETTE.monPaint);
    K.box(x1 - 0.75, fy + 6.4, pz, 0.18, 3.4, 2.4, PALETTE.monGoldDk);
    K.box(x1 - 0.86, fy + 6.4, pz, 0.10, 2.8, 1.9, PALETTE.monPaint);
  }

  // ---- THE PIANO, and every key on it is a separate box -----------------
  monBuildPiano(K, root, body, fy);
  // ---- THE CHAMPAGNE TOWER ----------------------------------------------
  monBuildTower(root, fy);

  const m = new THREE.Mesh(K.build(), monVCF());
  m.castShadow = true; m.receiveShadow = true;
  root.add(m);

  // ---- THE CHANDELIERS, and they are the only light in here -------------
  // Six of them, on the axis and off it, hung at eight metres. They are the
  // reason the room reads as gold rather than as grey, and they go into their
  // own emissive merge so nothing else in the casino has to carry one.
  const K2 = monMerger();
  const chand = [[cx, 7], [cx, 15], [cx, 23], [cx, 31], [x0 + 9, 21], [x1 - 9, 21]];
  for (let i = 0; i < chand.length; i++) {
    const px = chand[i][0], pz = monFRONT_Z + chand[i][1];
    K2.cyl(px, fy + 10.6, pz, 0.05, 2.6, PALETTE.monGoldDk, 0, 0, 0, 4);
    for (let r = 0; r < 3; r++) {
      const rr = 1.5 - r * 0.42;
      const yy = fy + 8.3 + r * 0.55;
      for (let k = 0; k < 8; k++) {
        const a = k * 0.7854 + r * 0.39;
        KG.sph(px + Math.cos(a) * rr, yy, pz + Math.sin(a) * rr,
               0.16, 0.24, 0.16, PALETTE.monLamp, 6);
      }
      K2.cyl(px, yy - 0.12, pz, rr, 0.06, PALETTE.monGold, 0, 0, 0, 12);
    }
    KG.sph(px, fy + 7.9, pz, 0.34, 0.42, 0.34, PALETTE.monLampWarm, 8);
  }
  // the sconces down the walls, which do the same job at eye height
  for (let i = 0; i < 6; i++) {
    for (let s = -1; s <= 1; s += 2) {
      const px = cx + s * (w * 0.5 - 1.4), pz = monFRONT_Z + 4 + i * 5.6;
      K2.box(px, fy + 4.0, pz, 0.36, 0.5, 0.36, PALETTE.monGold);
      KG.sph(px - s * 0.36, fy + 4.3, pz, 0.2, 0.3, 0.2, PALETTE.monLamp, 6);
    }
  }
  const fm = new THREE.Mesh(K2.build(), monVCF());
  fm.castShadow = false; fm.receiveShadow = false;
  root.add(fm);

  // ---- AND THE LIGHT HAS TO LAND ON SOMETHING --------------------------
  //
  // A chandelier is an emissive object and an emissive object lights NOTHING:
  // it is bright and the floor under it is not. Measured in the salon — cream
  // marble (0xf1ead9) under a hemisphere that is deliberately the colour of
  // the sky at twenty past eight (0x2f4d78 at 1.14) came out a flat blue-grey,
  // and a room lit by six chandeliers read as a room lit by nothing.
  //
  // Six additive discs on the floor, one under each. Same trick as the shaft
  // in Son Doong and for the same reason written down there: LIGHT DOES NOT
  // OCCLUDE, IT ADDS — a translucent disc at any opacity over a dark floor is
  // a slab, and an additive one at the same opacity is a pool. They cast
  // nothing, receive nothing and are never handed to registerShadowTarget.
  const poolGeo = new THREE.CircleGeometry(5.4, 18);
  poolGeo.rotateX(-Math.PI / 2);
  const poolMat = new THREE.MeshBasicMaterial({
    color: PALETTE.monLampWarm, transparent: true, opacity: 0.115,
    depthWrite: false, blending: THREE.AdditiveBlending });
  for (let i = 0; i < chand.length; i++) {
    const pm = new THREE.Mesh(poolGeo, poolMat);
    pm.position.set(chand[i][0], fy + 0.075, monFRONT_Z + chand[i][1]);
    pm.castShadow = false; pm.receiveShadow = false;
    pm.userData.noShadow = true;
    pm.renderOrder = 1;
    root.add(pm);
  }
  // ...and one under the wheel's own lamp, which is brighter and tighter,
  // because that is the only spot in the room and the chapter's economy
  // happens inside it.
  const wheelPool = new THREE.Mesh(new THREE.CircleGeometry(4.0, 18).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: PALETTE.monLamp, transparent: true, opacity: 0.20,
                                  depthWrite: false, blending: THREE.AdditiveBlending }));
  wheelPool.position.set(monWHEEL.x, fy + 0.08, monWHEEL.z);
  wheelPool.castShadow = false; wheelPool.receiveShadow = false;
  wheelPool.userData.noShadow = true;
  wheelPool.renderOrder = 1;
  root.add(wheelPool);
  // A GHOST HAS NO SILHOUETTE. A light source that casts a shadow is a shadow
  // casting a shadow — the Cappadocia bug — and registerShadowTarget turns
  // castShadow back on for everything it traverses, so this mesh is never
  // handed to it and says so here.
  const gm = new THREE.Mesh(KG.build(),
    grain(mat(0xffffff, { vertexColors: true, emissive: 0xffffff, emissiveIntensity: 0.9 }),
          { amount: 0 }));
  gm.castShadow = false; gm.receiveShadow = false;
  gm.userData.noShadow = true;
  root.add(gm);

  monPoolDone(game, body);

  // ---- and the people who look at the room ------------------------------
  monBuildEyes(root, fy);
  monBuildWheel(game, root);
}

/**
 * THE PIANO. Fifty-two white keys, and each of the fifty-two is its own box
 * with its own spring.
 *
 * It is worth that because of what the task is: you do not press a key, you
 * WALK ALONG THEM, and what makes that read is that the ones behind you are
 * still coming back up. `monPianoKey` carries a rest height and a velocity and
 * nothing else; the note is chosen from which key it was, so a run down the
 * instrument is a run down the instrument.
 */
function monBuildPiano(K, root, body, fy) {
  const px = 141, pz = monFRONT_Z + 9, yaw = -0.9;
  const g = new THREE.Group();
  g.position.set(px, fy, pz);
  g.rotation.y = yaw;
  const C = monMerger();
  C.box(0, 0.52, 0, 2.9, 0.34, 1.9, PALETTE.monPiano);
  C.box(0, 0.30, 0, 2.7, 0.18, 1.7, PALETTE.monPianoDk);
  C.cyl(-1.1, 0.18, 0.6, 0.08, 0.36, PALETTE.monPianoDk, 0, 0, 0, 6);
  C.cyl(1.1, 0.18, 0.6, 0.08, 0.36, PALETTE.monPianoDk, 0, 0, 0, 6);
  C.cyl(0, 0.18, -0.7, 0.08, 0.36, PALETTE.monPianoDk, 0, 0, 0, 6);
  C.box(0.1, 1.28, -0.15, 2.7, 0.10, 1.8, PALETTE.monPiano, 0.42, 0, 0);   // the lid, propped
  C.cyl(1.0, 1.0, 0.2, 0.04, 1.0, PALETTE.monPianoDk, 0, 0, 0, 4);
  C.box(0, 0.78, 0.72, 2.9, 0.24, 0.16, PALETTE.monPiano);
  const cm = new THREE.Mesh(C.build(), monVCF());
  cm.castShadow = true;
  g.add(cm);
  const wg = new THREE.BoxGeometry(0.042, 0.05, 0.42);
  const bg = new THREE.BoxGeometry(0.026, 0.06, 0.26);
  const wm = mat(PALETTE.monKeyW), bm = mat(PALETTE.monKeyB);
  const pat = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
  for (let i = 0; i < 52; i++) {
    const kx = -1.34 + i * 0.0515;
    const km = new THREE.Mesh(wg, wm);
    km.position.set(kx, 0.86, 0.40);
    km.castShadow = false;
    g.add(km);
    monPianoKey.push({ i: i, mesh: km, y0: 0.86, v: 0 });
    if (pat[i % 12]) {
      const bmm = new THREE.Mesh(bg, bm);
      bmm.position.set(kx + 0.026, 0.905, 0.32);
      bmm.castShadow = false;
      g.add(bmm);
    }
  }
  monPianoG = g;
  root.add(g);
  monPoolBox(body, px, fy + 0.45, pz, 3.0, 0.9, 2.0, yaw);
  monCover(px, pz, 1.5);
  monBlock(px, pz, 1.6);
}
/** World position of key `i`, for the hit test. */
function monPianoKeyAt(i, out) {
  if (!monPianoG) return out.set(0, 0, 0);
  out.set(-1.34 + i * 0.0515, 0.86, 0.40);
  monPianoG.localToWorld(out);
  return out;
}

/**
 * THE CHAMPAGNE TOWER. Fifty-five glasses in five tiers, and it is a real stack.
 *
 * Every glass is an instance with a live transform, so when it goes it GOES —
 * each one gets a velocity and a spin and falls on its own, which is the only
 * way a tower of glasses collapsing looks like anything. There is no physics in
 * it: fifty-five dynamic bodies for one gag is how you lose a frame, and a
 * ballistic arc with a floor at the carpet is indistinguishable at this size.
 */
const monTOWE_N = 55;
let monToweMesh = null, monToweData = null;
let monToweX = 0, monToweZ = 0;
function monBuildTower(root, fy) {
  const tx = 100, tz = monFRONT_Z + 33;
  monToweX = tx; monToweZ = tz;
  const geo = new THREE.CylinderGeometry(0.055, 0.03, 0.20, 6);
  const m = new THREE.InstancedMesh(geo, monGlow(PALETTE.monFlute, 0.30), monTOWE_N);
  m.castShadow = false; m.receiveShadow = false;
  m.frustumCulled = false;
  monToweData = new Float32Array(monTOWE_N * 9);   // x y z vx vy vz spin yaw live
  let n = 0;
  for (let tier = 0; tier < 5 && n < monTOWE_N; tier++) {
    const per = 5 - tier;
    for (let a = 0; a < per && n < monTOWE_N; a++) {
      for (let b = 0; b < per && n < monTOWE_N; b++) {
        monToweData[n * 9] = tx + (a - (per - 1) / 2) * 0.135;
        monToweData[n * 9 + 1] = fy + 1.44 + tier * 0.19;
        monToweData[n * 9 + 2] = tz + (b - (per - 1) / 2) * 0.135;
        monToweData[n * 9 + 8] = 1;
        n++;
      }
    }
  }
  m.count = n;
  monToweMesh = m;
  root.add(m);
  const K = monMerger();
  K.cyl(tx, fy + 0.62, tz, 1.05, 1.24, PALETTE.monTeakDk, 0, 0, 0, 12);
  K.cyl(tx, fy + 1.28, tz, 1.20, 0.10, PALETTE.monMarble, 0, 0, 0, 12);
  K.box(tx, fy + 1.35, tz, 1.5, 0.04, 1.5, PALETTE.monCloth);
  const tm = new THREE.Mesh(K.build(), monVCF());
  tm.castShadow = true;
  monToweG = tm;
  root.add(tm);
  monCover(tx, tz, 1.2);
  monBlock(tx, tz, 1.2);
  monToweSync();
}
function monToweSync() {
  if (!monToweMesh) return;
  for (let i = 0; i < monToweMesh.count; i++) {
    const o = i * 9;
    if (monToweData[o + 8] < 0.5) {
      monM.compose(monV3.set(0, -2000, 0), monQ.identity(), monSc.set(1, 1, 1));
    } else {
      monE.set(monToweData[o + 6] * 0.7, monToweData[o + 7], monToweData[o + 6], 'YXZ');
      monM.compose(monV3.set(monToweData[o], monToweData[o + 1], monToweData[o + 2]),
                   monQ.setFromEuler(monE), monSc.set(1, 1, 1));
    }
    monToweMesh.setMatrixAt(i, monM);
  }
  monToweMesh.instanceMatrix.needsUpdate = true;
}

// ================================================================ THE EYE ====
/**
 * FIVE PEOPLE, AND THE ONLY THING ANY OF THEM DOES IS LOOK.
 *
 * Each is a figure and a cone. The cone is a real mesh on the floor — a flat
 * translucent wedge in the room's own warm gold — and it is the ENTIRE user
 * interface of the mechanic: this game has no reticles, no meters and no
 * icons, and it was not going to grow one for a chapter. It sweeps at its own
 * rate and its own phase, so the pattern across the room never repeats inside
 * a visit and there is never a moment when all five gaps line up. It goes RED
 * as it fills, which is the only red in the room apart from the carpet and the
 * layout.
 *
 * The positions are chosen so that the two things the chapter asks you to do in
 * here — cross the floor, and get to the wheel — are covered from different
 * sides, and so that the corridor down the middle, which is where the carpet
 * is and where a player will therefore walk, is the worst route in the room.
 */
const monEYE_DEF = [
  { x: 106, dz: 6,  base: 0.6,  amp: 0.85, hz: 0.13 },
  { x: 132, dz: 7,  base: -0.7, amp: 0.80, hz: 0.11 },
  { x: 118, dz: 21, base: 0.0,  amp: 1.30, hz: 0.085 },
  { x: 100, dz: 30, base: -1.4, amp: 0.70, hz: 0.15 },
  { x: 136, dz: 31, base: 1.5,  amp: 0.75, hz: 0.12 },
];
function monBuildEyes(root, fy) {
  // one wedge geometry, reused: a fan of 2 x monEYE_HALF over monEYE_RANGE
  const seg = 9;
  const pos = [0, 0, 0];
  const idx = [];
  for (let i = 0; i <= seg; i++) {
    const a = -monEYE_HALF + (2 * monEYE_HALF) * (i / seg);
    pos.push(Math.sin(a) * monEYE_RANGE, 0, Math.cos(a) * monEYE_RANGE);
  }
  for (let i = 1; i <= seg; i++) idx.push(0, i + 1, i);
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  wg.setIndex(idx);
  wg.computeVertexNormals();

  for (let i = 0; i < monEYE_DEF.length; i++) {
    const e = monEYE_DEF[i];
    const ez = monFRONT_Z + e.dz;
    // the figure. A croupier: black tie, white shirt, and absolutely no fun.
    const K = monMerger();
    K.box(0, 0.44, 0, 0.62, 0.88, 0.40, PALETTE.monTux);
    K.box(0, 1.18, 0, 0.66, 0.64, 0.44, PALETTE.monTux);
    K.box(0, 1.20, 0.21, 0.22, 0.60, 0.06, PALETTE.monShirt);
    K.box(0, 1.42, 0.22, 0.16, 0.10, 0.05, PALETTE.monTux);
    for (let s = -1; s <= 1; s += 2) K.box(s * 0.40, 1.16, 0, 0.16, 0.62, 0.20, PALETTE.monTux);
    K.box(0, 1.58, 0, 0.24, 0.22, 0.24, PALETTE.monSkin);
    K.sph(0, 1.80, 0, 0.22, 0.24, 0.22, PALETTE.monSkin, 8);
    K.sph(0, 1.88, -0.02, 0.23, 0.18, 0.23, PALETTE.monHair, 6);
    const fig = new THREE.Mesh(K.build(), monVCF());
    fig.castShadow = true;
    const g = new THREE.Group();
    g.position.set(e.x, fy, ez);
    g.add(fig);
    root.add(g);

    const wm = new THREE.Mesh(wg, new THREE.MeshBasicMaterial({
      color: PALETTE.monLampWarm, transparent: true, opacity: 0.10,
      depthWrite: false, side: THREE.DoubleSide,
    }));
    wm.position.set(e.x, fy + 0.055, ez);
    wm.castShadow = false; wm.receiveShadow = false;
    wm.userData.noShadow = true;
    wm.renderOrder = 2;
    root.add(wm);

    monEyes.push({ x: e.x, z: ez, base: e.base, amp: e.amp, hz: e.hz,
                   yaw: e.base, g: g, cone: wm, k: 0 });
    // AND NOT monCover. A croupier is solid and a solid thing belongs in the
    // cover list — except that monBlockedSight casts FROM his own position,
    // and a circle of cover centred on the ray's origin is a ray that is
    // blocked at t = 0. Measured: with a 0.4 m circle on each of the five, the
    // room could not see anything at all, ever, and the whole mechanic was off
    // in a way that looked exactly like it working perfectly.
    monBlock(e.x, ez, 0.7);
  }
}

// ============================================================= THE WHEEL =====
/**
 * A REAL TURNING DISC, and everything the economy does happens on it.
 *
 * KINEMATIC, `allowSleep = false`, turned with `angularVelocity` and never by
 * assigning a quaternion — the five rules for a carrier, and this one carries
 * a capybara for six seconds when the mini is earned. Its top face is
 * deliberately WIDE (2.2 m): the mini is "get on it", and a plate you have to
 * land on is a different and much worse game than a plate you can walk onto.
 */
let monBallMesh = null;
function monBuildWheel(game, root) {
  const K = monMerger();
  const y = monWHEEL.y, r = monWHEEL.r;
  K.cyl(0, -0.62, 0, r + 0.55, 1.0, PALETTE.monTeakDk, 0, 0, 0, 12);
  K.cyl(0, -0.06, 0, r + 0.50, 0.16, PALETTE.monTeak, 0, 0, 0, 12);
  K.cyl(0, 0.02, 0, r, 0.10, PALETTE.monWheelWood, 0, 0, 0, 12);
  // thirty-seven pockets: red, black, and one green
  for (let i = 0; i < 37; i++) {
    const a = i * (Math.PI * 2 / 37);
    const col = i === 0 ? PALETTE.monWheelGrn : (i % 2 ? PALETTE.monChipR : PALETTE.monChipK);
    K.box(Math.cos(a) * (r * 0.78), 0.10, Math.sin(a) * (r * 0.78),
          0.30, 0.10, r * 0.36, col, 0, -a, 0);
    K.box(Math.cos(a + 0.085) * (r * 0.78), 0.14, Math.sin(a + 0.085) * (r * 0.78),
          0.05, 0.16, r * 0.36, PALETTE.monBrass, 0, -a, 0);
  }
  // the turret in the middle, with its four handles
  K.cyl(0, 0.24, 0, r * 0.30, 0.28, PALETTE.monWheelWood, 0, 0, 0, 8);
  K.cyl(0, 0.52, 0, r * 0.16, 0.32, PALETTE.monBrass, 0, 0, 0, 8);
  for (let i = 0; i < 4; i++) {
    const a = i * 1.5708;
    K.box(Math.cos(a) * r * 0.22, 0.68, Math.sin(a) * r * 0.22, r * 0.44, 0.06, 0.09,
          PALETTE.monBrass, 0, -a, 0);
  }
  K.cyl(0, 0.80, 0, 0.06, 0.24, PALETTE.monGold, 0, 0, 0, 6);
  // the ball track: a rim you can run round, which is the mini
  K.cyl(0, 0.22, 0, r + 0.02, 0.16, PALETTE.monWheelRim, 0, 0, 0, 12);
  K.cyl(0, 0.22, 0, r - 0.16, 0.20, PALETTE.monWheelWood, 0, 0, 0, 12);

  const g = new THREE.Group();
  const m = new THREE.Mesh(K.build(), monVCF());
  m.castShadow = true; m.receiveShadow = true;
  g.add(m);
  g.position.set(monWHEEL.x, y, monWHEEL.z);
  monWheelG = g;
  root.add(g);

  // the light over it: the one spot in the room that is not a chandelier
  const shade = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.1, 10), mat(PALETTE.monGoldDk));
  shade.position.set(monWHEEL.x, y + 6.4, monWHEEL.z);
  shade.castShadow = false;
  root.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6),
                              monGlow(PALETTE.monLampWarm, 1.15));
  bulb.position.set(monWHEEL.x, y + 5.6, monWHEEL.z);
  bulb.castShadow = false;
  bulb.userData.noShadow = true;
  root.add(bulb);

  // ---- and the body -----------------------------------------------------
  // Rule 1: mass 0, KINEMATIC, allowSleep false. A floor that stops existing
  // because it went to sleep is the worst bug this project has ever had.
  const b = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC,
                              material: (game.mats && game.mats.ground) || undefined });
  b.allowSleep = false;
  b.addShape(new CANNON.Cylinder(r + 0.05, r + 0.05, 0.44, 12), new CANNON.Vec3(0, 0.02, 0));
  b.position.set(monWHEEL.x, y, monWHEEL.z);
  monSyncBody(b);
  game.world.addBody(b);
  monWheelBody = b;

  // the ball, which stays on the rim until somebody gives it a reason not to
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), mat(PALETTE.monBall));
  ball.castShadow = false;
  g.add(ball);
  monBallMesh = ball;

  monCover(monWHEEL.x, monWHEEL.z, 1.4);
  monBlock(monWHEEL.x, monWHEEL.z, 2.6);
}

// ============================================================ THE CIRCUIT ====
/**
 * THE TARMAC, THE KERBS, THE BARRIERS AND THE LID.
 *
 * All of it is generated by walking the lap. There is no second list of corner
 * positions: a kerb goes wherever the polyline turns by more than half a
 * radian, on the inside, which is where a kerb is; the barrier goes down the
 * seaward stretch and round the hairpin, which is where a barrier is; and the
 * tunnel is one leg with a lid on. Change a node in `monTRACK` and every one of
 * them moves with it.
 */
function monBuildCircuit(game, root) {
  monInitTrack();
  const K = monMerger();          // tarmac and paint
  const KB = monMerger();         // barriers, kerbs, fencing
  const body = monPoolBody(game);
  // ROTATIONS ARE +yaw AND NOT -yaw, and this cost a whole build. A box
  // rotated about Y by theta sends its local +z to (sin theta, cos theta),
  // which is exactly the convention `monTrackAt` returns a heading in — so a
  // kerb, a barrier or a tunnel wall laid along the road takes the heading
  // UNCHANGED. Negating it mirrors every one of them about the z axis, which
  // on a straight looks like nothing at all and on the west quay produced a
  // hundred metres of armco lying across the road like a cattle grid.
  const STEP = 3.0;
  const HALF = monTRACK_HALF + 0.6;      // the drawn tarmac slightly overhangs
                                          // the flattened ground, so a coarse
                                          // heightfield can never poke through it
  const n = Math.ceil(monTrackTotal / STEP);
  let px0 = 0, pz0 = 0, py0 = 0, pnx = 0, pnz = 0, have = false;
  for (let i = 0; i <= n; i++) {
    const s = (i / n) * monTrackTotal;
    monTrackAt(s, monTrackTmp);
    const yaw = monTrackTmp.yaw;
    const nx = Math.cos(yaw), nz = -Math.sin(yaw);     // the road normal, in plan
    const x = monTrackTmp.x, z = monTrackTmp.z, y = monTrackTmp.y + 0.10;
    if (have) {
      K.quad(px0 - pnx * HALF, py0, pz0 - pnz * HALF,
             px0 + pnx * HALF, py0, pz0 + pnz * HALF,
             x + nx * HALF, y, z + nz * HALF,
             x - nx * HALF, y, z - nz * HALF, PALETTE.monTarmac);
      // the white edge lines, and they are the only paint on the circuit that
      // is not a kerb — they are what makes a road at night READ as a road
      if (i % 2 === 0) {
        for (let sd = -1; sd <= 1; sd += 2) {
          K.quad(px0 + pnx * (HALF - 0.55) * sd, py0 + 0.012, pz0 + pnz * (HALF - 0.55) * sd,
                 px0 + pnx * (HALF - 0.20) * sd, py0 + 0.012, pz0 + pnz * (HALF - 0.20) * sd,
                 x + nx * (HALF - 0.20) * sd, y + 0.012, z + nz * (HALF - 0.20) * sd,
                 x + nx * (HALF - 0.55) * sd, y + 0.012, z + nz * (HALF - 0.55) * sd,
                 PALETTE.monKerbW);
        }
      }
    }
    px0 = x; pz0 = z; py0 = y; pnx = nx; pnz = nz; have = true;
  }

  // ---- the kerbs, wherever the lap actually turns -----------------------
  for (let i = 0; i < monTRACK.length; i++) {
    const a = monTRACK[(i - 1 + monTRACK.length) % monTRACK.length];
    const b = monTRACK[i];
    const c = monTRACK[(i + 1) % monTRACK.length];
    const h1 = Math.atan2(b[0] - a[0], b[1] - a[1]);
    const h2 = Math.atan2(c[0] - b[0], c[1] - b[1]);
    let turn = h2 - h1;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    if (Math.abs(turn) < 0.45) continue;
    const side = turn > 0 ? 1 : -1;       // the inside of the corner
    const sBase = monTrackLen[i];
    for (let k = -5; k <= 5; k++) {
      const s = sBase + k * 2.2;
      monTrackAt(s, monTrackTmp);
      const nx = Math.cos(monTrackTmp.yaw), nz = -Math.sin(monTrackTmp.yaw);
      KB.box(monTrackTmp.x + nx * HALF * side, monTrackTmp.y + 0.16,
             monTrackTmp.z + nz * HALF * side, 1.2, 0.20, 2.0,
             (k & 1) ? PALETTE.monKerbW : PALETTE.monKerbR, 0, monTrackTmp.yaw, 0);
    }
  }

  // ---- the barrier. Down the harbour front and round the hairpin, which
  // ---- is where it is in life and where a player is most likely to fall off.
  const guarded = [[monTrackLen[11], monTrackLen[16]], [monTrackLen[6], monTrackLen[8]]];
  for (let g = 0; g < guarded.length; g++) {
    const s0 = guarded[g][0], s1 = guarded[g][1];
    for (let s = s0; s < s1; s += 4.0) {
      monTrackAt(s, monTrackTmp);
      const nx = Math.cos(monTrackTmp.yaw), nz = -Math.sin(monTrackTmp.yaw);
      for (let sd = -1; sd <= 1; sd += 2) {
        // the seaward side only on the harbour front: a barrier on both sides
        // of a street is a corridor, and this chapter is not a corridor
        if (g === 0 && sd > 0) continue;
        const bx = monTrackTmp.x + nx * (HALF + 0.9) * sd;
        const bz = monTrackTmp.z + nz * (HALF + 0.9) * sd;
        const by = monTrackTmp.y;
        KB.box(bx, by + 0.62, bz, 0.14, 0.42, 4.1, PALETTE.monArmco, 0, monTrackTmp.yaw, 0);
        KB.box(bx, by + 0.30, bz, 0.16, 0.60, 0.16, PALETTE.monArmcoDk, 0, monTrackTmp.yaw, 0);
        // and the debris fence above it, which is the thing that says RACE
        KB.box(bx, by + 1.9, bz, 0.06, 2.2, 0.09, PALETTE.monFence, 0, monTrackTmp.yaw, 0);
        if (((s / 4) | 0) % 3 === 0) {
          KB.box(bx, by + 1.9, bz + 2.0, 0.05, 2.2, 4.1, PALETTE.monFence, 0, monTrackTmp.yaw, 0);
        }
        monPoolBox(body, bx, by + 0.55, bz, 0.30, 1.1, 4.1, monTrackTmp.yaw);
      }
    }
  }

  // ---- THE TUNNEL. One leg of the lap, with a lid on it. ----------------
  // The cutting is already in the terrain (see the wider shoulder in
  // monTerrain); this is the wall, the roof and the sodium. The roof is a slab
  // twenty-four metres across, which is wide enough to cover the whole cut, and
  // it is COLLIDED ON TOP, because walking over your own tunnel is the sort of
  // thing a player should be allowed to find out about.
  const KL = monMerger();
  const ts0 = monTrackLen[monTUNNEL_A], ts1 = monTrackLen[monTUNNEL_B];
  for (let s = ts0; s <= ts1; s += 4.0) {
    monTrackAt(s, monTrackTmp);
    const nx = Math.cos(monTrackTmp.yaw), nz = -Math.sin(monTrackTmp.yaw);
    const x = monTrackTmp.x, z = monTrackTmp.z, y = monTrackTmp.y;
    for (let sd = -1; sd <= 1; sd += 2) {
      KB.box(x + nx * monTUNNEL_W * sd, y + monTUNNEL_H * 0.5, z + nz * monTUNNEL_W * sd,
             1.6, monTUNNEL_H, 4.1, PALETTE.monConcrete, 0, monTrackTmp.yaw, 0);
      monPoolBox(body, x + nx * (monTUNNEL_W + 0.4) * sd, y + monTUNNEL_H * 0.5,
                 z + nz * (monTUNNEL_W + 0.4) * sd, 2.4, monTUNNEL_H + 3, 4.1, monTrackTmp.yaw);
    }
    KB.box(x, y + monTUNNEL_H + 0.9, z, 24, 1.8, 4.1, PALETTE.monConcrete, 0, monTrackTmp.yaw, 0);
    KB.box(x, y + monTUNNEL_H + 0.02, z, 2 * monTUNNEL_W, 0.30, 4.1,
           PALETTE.monConcreteDk, 0, monTrackTmp.yaw, 0);
    monPoolBox(body, x, y + monTUNNEL_H + 0.9, z, 24, 1.9, 4.1, monTrackTmp.yaw);
    // the sodium. Every eight metres, and it is the only light in there.
    if (((s - ts0) % 8) < 4.0) {
      KL.box(x, y + monTUNNEL_H - 0.34, z, 1.6, 0.20, 0.55, PALETTE.monSodium,
             0, monTrackTmp.yaw, 0);
    }
  }
  // ...and a lip round each mouth, so the hole in the hillside is a PORTAL and
  // not a place where the wall happens to stop
  for (let e = 0; e < 2; e++) {
    monTrackAt(e ? ts1 : ts0, monTrackTmp);
    const nx = Math.cos(monTrackTmp.yaw), nz = -Math.sin(monTrackTmp.yaw);
    KB.box(monTrackTmp.x, monTrackTmp.y + monTUNNEL_H + 1.4, monTrackTmp.z,
           26, 3.0, 1.6, PALETTE.monConcreteDk, 0, monTrackTmp.yaw, 0);
    for (let sd = -1; sd <= 1; sd += 2) {
      KB.box(monTrackTmp.x + nx * (monTUNNEL_W + 1.2) * sd,
             monTrackTmp.y + monTUNNEL_H * 0.5 + 0.7,
             monTrackTmp.z + nz * (monTUNNEL_W + 1.2) * sd,
             2.6, monTUNNEL_H + 1.4, 1.6, PALETTE.monConcreteDk, 0, monTrackTmp.yaw, 0);
    }
  }

  // ---- the grandstand, on the mole, looking across at the harbour front --
  for (let r = 0; r < 8; r++) {
    KB.box(2, 3.0 + r * 0.62, -99 - r * 1.0, 44, 0.62, 1.0, PALETTE.monStandTier);
    KB.box(2, 3.55 + r * 0.62, -99.2 - r * 1.0, 44, 0.44, 0.36, PALETTE.monStandSeat);
    monPoolBox(body, 2, 2.9 + r * 0.62, -99 - r * 1.0, 44, 1.2, 1.05);
  }
  // A pitched canopy over the back rows only, and it is TINTED. At its first
  // size — forty-five by eight and a half, flat, in the awning cream — it was
  // a white plane four hundred square metres across sitting between the lens
  // and the harbour, and it read as a roof over the whole port.
  KB.box(2, 9.1, -106.4, 40, 0.4, 5.4, PALETTE.monAwningRed, -0.16, 0, 0);
  KB.box(2, 9.9, -108.9, 40, 0.4, 1.2, PALETTE.monArmcoDk);
  for (let i = -2; i <= 2; i++) {
    KB.box(2 + i * 10, 6.4, -108.6, 0.35, 6.2, 0.35, PALETTE.monArmcoDk);
  }
  monBlock(2, -101, 21);

  // ---- start/finish, on the quay under the Rocher -----------------------
  monTrackAt(monTrackLen[17] - 12, monTrackTmp);
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 2; j++) {
      const nx = Math.cos(monTrackTmp.yaw), nz = -Math.sin(monTrackTmp.yaw);
      const o = (i - 3.5) * 1.2;
      K.box(monTrackTmp.x + nx * o, monTrackTmp.y + 0.12,
            monTrackTmp.z + nz * o + (j ? 1.2 : 0), 1.2, 0.02, 1.2,
            (i + j) % 2 ? PALETTE.monKerbW : PALETTE.monTarmacLt, 0, monTrackTmp.yaw, 0);
    }
  }

  const m = new THREE.Mesh(K.build(), monVC());
  m.receiveShadow = true; m.castShadow = false;
  root.add(m);
  const mb = new THREE.Mesh(KB.build(), monVCF());
  mb.castShadow = true; mb.receiveShadow = true;
  root.add(mb);
  const ml = new THREE.Mesh(KL.build(),
    grain(mat(0xffffff, { vertexColors: true, emissive: 0xffffff, emissiveIntensity: 1.05 }),
          { amount: 0 }));
  ml.castShadow = false; ml.receiveShadow = false;
  ml.userData.noShadow = true;
  root.add(ml);

  monPoolDone(game, body);
}

// =============================================================== THE CARS ====
/**
 * THREE CARS, AND ONE OF THEM IS THE POINT.
 *
 * Silver first, because of course it is silver. The other two are there so the
 * circuit is a circuit and not a demonstration — a single car going round an
 * empty track reads as a toy, and three at different spacings reads as a
 * session.
 *
 * The five rules for a kinematic carrier are kept exactly (see CONTRACT.md):
 * mass 0, KINEMATIC, allowSleep off, moved by VELOCITY against the PREVIOUS
 * TARGET, yaw through angularVelocity, and rendered from interpolatedPosition.
 * The one thing this carrier does that no other in the game does is go
 * twenty-six metres a second, which is why it also DECLARES its frame through
 * carryFrame() rather than leaving the animal to the contact sweep: at that
 * speed a contact that is missing for two frames is a capybara in a barrier.
 */
const monCAR_COL = [
  { body: PALETTE.monCarSilver, dark: PALETTE.monCarDk, stripe: PALETTE.monCarStripe },
  { body: PALETTE.monCarRed, dark: PALETTE.monCarRedDk, stripe: PALETTE.monMarble },
  { body: PALETTE.monCarBlue, dark: PALETTE.monCarBlueDk, stripe: PALETTE.monGold },
];
function monBuildCar(colours) {
  const K = monMerger();
  const c = colours.body, d = colours.dark;
  // the tub. A long bonnet, a short cabin, a fastback: a grand tourer, not a
  // racing car, because the joke only works if it is the one everybody knows.
  K.box(0, 0.52, 0.35, 1.80, 0.62, 3.90, c);
  K.box(0, 0.30, 0.35, 1.86, 0.34, 3.70, d);
  K.box(0, 0.86, 1.05, 1.62, 0.30, 2.10, c);            // the bonnet
  // ---- AND IT IS OPEN, WHICH WAS A GAMEPLAY DECISION AND NOT A STYLING ONE.
  //
  // The first build was a fastback with a roof at 1.44 m and a collider to
  // match, and two things were wrong with it at once. A capybara cannot GET
  // there — capyJUMP_V peaks at about 1.2 m of rise, so the hop that boards
  // the car missed by twenty centimetres every time. And when the collider was
  // split into a deck and a cabin so that the boot could be hopped onto, the
  // boot was fifty-five centimetres long, the animal landed on the cabin
  // instead, and the solver posted it off the side within a second and a half
  // — measured, eighty-four frames.
  //
  // An open car is ONE BOX with its top at ninety-five centimetres over the
  // whole four and a third metres of it. That is a hop a capybara can make, a
  // platform it cannot fall off, and — which is the part that matters — it is
  // a much better picture: a rodent standing up in the cockpit of somebody's
  // silver grand tourer with the harbour going past.
  K.box(-0.76, 0.92, -0.55, 0.28, 0.34, 1.72, c);       // the cockpit sides
  K.box(0.76, 0.92, -0.55, 0.28, 0.34, 1.72, c);
  K.box(0, 0.90, -1.52, 1.80, 0.30, 0.42, c);           // the tonneau behind
  K.box(0, 0.84, -0.55, 1.32, 0.12, 1.60, PALETTE.monCarDk);   // and the floor
  for (let s2 = -1; s2 <= 1; s2 += 2) {
    K.box(s2 * 0.36, 0.94, -0.30, 0.48, 0.10, 0.50, PALETTE.monTeakDk);
    K.box(s2 * 0.36, 1.06, -1.20, 0.48, 0.42, 0.10, PALETTE.monTeakDk, 0.20, 0, 0);
  }
  K.box(0, 1.10, 0.34, 1.30, 0.42, 0.05, PALETTE.monCarGlass, -0.44, 0, 0);
  K.box(0, 1.29, 0.26, 1.34, 0.07, 0.11, PALETTE.monBrass);
  // the tail, the grille and the two stripes
  K.box(0, 0.70, -1.85, 1.66, 0.44, 0.40, d);
  K.box(0, 0.72, 2.24, 1.30, 0.44, 0.22, d);
  for (let s = -1; s <= 1; s += 2) {
    K.box(s * 0.30, 1.06, -1.52, 0.22, 0.03, 0.44, colours.stripe);
    K.box(s * 0.30, 0.92, 1.05, 0.22, 0.03, 2.10, colours.stripe);
    // the wings over the wheels
    K.box(s * 0.86, 0.62, 1.35, 0.14, 0.52, 1.10, d);
    K.box(s * 0.86, 0.62, -1.10, 0.14, 0.52, 1.10, d);
    // the lamps
    K.cyl(s * 0.52, 0.86, 2.28, 0.20, 0.10, PALETTE.monHeadlamp, Math.PI / 2, 0, 0, 8);
    K.box(s * 0.56, 0.76, -2.02, 0.30, 0.16, 0.08, PALETTE.monTailLamp);
    // and the wing mirrors, which are two centimetres of nothing and are the
    // reason it reads as a car rather than as a wedge
    K.box(s * 0.88, 1.12, 0.30, 0.16, 0.09, 0.09, d);
  }
  // four wheels
  for (let s = -1; s <= 1; s += 2) {
    for (let f = -1; f <= 1; f += 2) {
      K.cyl(s * 0.84, 0.36, f * 1.32, 0.36, 0.26, PALETTE.monTyre, 0, 0, Math.PI / 2, 12);
      K.cyl(s * 0.90, 0.36, f * 1.32, 0.21, 0.06, PALETTE.monWheelHub, 0, 0, Math.PI / 2, 8);
    }
  }
  const g = new THREE.Group();
  const m = new THREE.Mesh(K.build(), monVCF());
  m.castShadow = true; m.receiveShadow = true;
  g.add(m);
  // the headlight cone. Two flat wedges, unlit, additive-ish: a light source
  // is a thing you can SEE THE BEAM OF at dusk, and in the tunnel it is most of
  // what tells you a car is coming.
  const bg = new THREE.ConeGeometry(1.5, 16, 6, 1, true);
  const bm = new THREE.MeshBasicMaterial({ color: PALETTE.monHeadlamp, transparent: true,
                                           opacity: 0.055, depthWrite: false,
                                           side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const beam = new THREE.Mesh(bg, bm);
  beam.rotation.x = -Math.PI / 2;
  beam.position.set(0, 0.86, 10.2);
  beam.castShadow = false; beam.receiveShadow = false;
  beam.userData.noShadow = true;
  g.add(beam);
  g.userData.beam = beam;
  return g;
}

function monBuildCars(game, root) {
  monInitTrack();
  monCarRoot = new THREE.Group();
  root.add(monCarRoot);
  for (let i = 0; i < monCAR_N; i++) {
    const g = monBuildCar(monCAR_COL[i % monCAR_COL.length]);
    monCarRoot.add(g);
    monCarG.push(g);
    const b = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC,
                                material: (game.mats && game.mats.prop) || undefined });
    b.allowSleep = false;
    // THE DECK, AND THEN FOUR WALLS ROUND THE COCKPIT.
    //
    // A flat deck is not enough. Measured with one box: an animal put down on
    // it at the hairpin held for two and a half seconds and was gone by
    // Portier, because friction alone against a lateral acceleration that
    // peaked at 1.2 g is a coin toss. A cockpit is a WELL — that is what a
    // cockpit is for — and four sixteen-centimetre rails turn the ride from a
    // balancing act into somewhere you are simply sitting.
    b.addShape(new CANNON.Box(new CANNON.Vec3(0.96, 0.475, 2.15)), new CANNON.Vec3(0, 0.475, 0));
    b.addShape(new CANNON.Box(new CANNON.Vec3(0.16, 0.24, 0.86)), new CANNON.Vec3(-0.80, 1.19, -0.55));
    b.addShape(new CANNON.Box(new CANNON.Vec3(0.16, 0.24, 0.86)), new CANNON.Vec3(0.80, 1.19, -0.55));
    b.addShape(new CANNON.Box(new CANNON.Vec3(0.90, 0.24, 0.16)), new CANNON.Vec3(0, 1.14, -1.52));
    b.addShape(new CANNON.Box(new CANNON.Vec3(0.90, 0.24, 0.16)), new CANNON.Vec3(0, 1.14, 0.36));
    game.world.addBody(b);
    monCarBody.push(b);
    const s = (i / monCAR_N) * monTrackTotal;
    monCarU.push(s);
    monCarV.push(monCAR_VMAX * 0.5);
    monTrackAt(s, monTrackTmp);
    monCarTX.push(monTrackTmp.x); monCarTZ.push(monTrackTmp.z);
    monCarTY.push(monTrackTmp.y + monCAR_HY);
    monCarYaw.push(monTrackTmp.yaw);
    b.position.set(monTrackTmp.x, monTrackTmp.y + monCAR_HY, monTrackTmp.z);
    b.quaternion.setFromEuler(0, monTrackTmp.yaw, 0);
    monSyncBody(b);
  }
}

/**
 * HOW FAST A CAR SHOULD BE AT `s` METRES ROUND THE LAP.
 *
 * Not a table. The lap already knows where it turns, so the target speed is
 * read off the CURVATURE at that point — which means the hairpin is slow
 * because it is a hairpin and not because a constant says so, and moving a node
 * moves the braking point with it. One lookahead of eighteen metres, because a
 * car that brakes when it arrives at a corner is a car in a barrier.
 */
function monCarTarget(s) {
  monTrackAt(s + 18, monTrackTmp2);
  const y1 = monTrackTmp2.yaw;
  monTrackAt(s, monTrackTmp);
  let dy = y1 - monTrackTmp.yaw;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  const k = Math.abs(dy) / 18;                     // radians per metre
  // v = C / sqrt(k) is a constant-lateral-acceleration law and C^2 IS that
  // acceleration: at 3.4 the corners peaked at 11.6 m/s^2, which is 1.2 g, and
  // no amount of friction holds a passenger through that. 2.8 puts the worst
  // corner at 0.8 g and leaves the straights untouched, because k goes to zero
  // there and the clamp does the rest.
  const v = 2.8 / Math.sqrt(k + 0.0016);
  return clamp(v, monCAR_VMIN, monCAR_VMAX);
}

function monUpdateCars(game, dt) {
  if (!monCarG.length || dt <= 0) return;
  const capy = game.capy;
  for (let i = 0; i < monCarG.length; i++) {
    const want = monCarTarget(monCarU[i]);
    const a = want > monCarV[i] ? monCAR_ACC : -monCAR_BRAKE;
    monCarV[i] = a > 0 ? Math.min(want, monCarV[i] + a * dt)
                       : Math.max(want, monCarV[i] + a * dt);
    monCarU[i] = (monCarU[i] + monCarV[i] * dt) % monTrackTotal;
    monTrackAt(monCarU[i], monTrackTmp);
    const tx = monTrackTmp.x, tz = monTrackTmp.z, ty = monTrackTmp.y + monCAR_HY;
    const b = monCarBody[i];
    // RULE 3: the difference is taken against the PREVIOUS TARGET, never
    // against the body's own position — cannon integrates a kinematic body
    // inside world.step, which runs before every module update, so the body has
    // already moved by the time this code sees it and differencing against it
    // halves the speed and shears the passenger off.
    b.velocity.set((tx - monCarTX[i]) / dt, (ty - monCarTY[i]) / dt, (tz - monCarTZ[i]) / dt);
    let dy = monTrackTmp.yaw - monCarYaw[i];
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    b.angularVelocity.set(0, dy / dt, 0);
    monCarTX[i] = tx; monCarTZ[i] = tz; monCarTY[i] = ty; monCarYaw[i] = monTrackTmp.yaw;
    // RULE 5: rendered from interpolatedPosition, never from position.
    const g = monCarG[i];
    g.position.copy(b.interpolatedPosition);
    g.quaternion.copy(b.interpolatedQuaternion);
    // ROLL AND PITCH GO ON THE MESH ONLY (rule 4). A car leaning into the
    // hairpin is eight degrees of theatre; rate-integrating three axes to get
    // it would be tilting the box the passenger is standing in.
    const lean = clamp(dy / dt * monCarV[i] * 0.010, -0.16, 0.16);
    g.children[0].rotation.z = damp(g.children[0].rotation.z, -lean, 6, dt);
    g.children[0].rotation.x = damp(g.children[0].rotation.x,
      clamp((want - monCarV[i]) * 0.006, -0.05, 0.05), 6, dt);
    // the beam only exists where it can be seen doing something
    const bm = g.userData.beam;
    if (bm) {
      const k = Math.max(monTunnelK2(tx, tz), 0.30);
      bm.material.opacity = 0.035 + k * 0.075;
    }
  }
  monUpdateRide(game, dt);
}

/**
 * IS THE ANIMAL ON A ROOF, AND FOR HOW LONG.
 *
 * Measured in the CAR'S OWN FRAME rather than in world axes, which matters at
 * twenty-six metres a second: a world-space box round a car doing seventy miles
 * an hour is the wrong shape by half a car's length within one frame.
 */
function monUpdateRide(game, dt) {
  const capy = game.capy;
  if (!capy || !capy.position) { monRider = -1; return; }
  const p = capy.position;
  let on = -1;
  for (let i = 0; i < monCarG.length; i++) {
    const g = monCarG[i];
    const dx = p.x - g.position.x, dz = p.z - g.position.z;
    const c = Math.cos(-g.rotation.y), s = Math.sin(-g.rotation.y);
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    const dy = p.y - (g.position.y + monROOF_Y);
    if (Math.abs(lx) < monROOF_HX + 0.55 && Math.abs(lz) < monROOF_HZ + 0.55 &&
        dy > -0.55 && dy < 1.5) { on = i; break; }
  }
  // ---- A ONE-FRAME GAP IS NOT GETTING OFF ------------------------------
  // The test is a box in the car's own frame, and at twenty-six metres a
  // second a corner puts the animal outside it for a frame or two with the
  // contact still perfectly sound. Measured before this latch: the tunnel's
  // entry mark was thrown away and re-taken every five to ten frames all the
  // way through the bore, so the run never completed once and the chapter's
  // marquee could not be earned at all. Three tenths of a second of grace is
  // shorter than the smallest gap a real dismount can produce and longer than
  // any of the flickers.
  if (on < 0 && monRider >= 0) {
    monRideGrace += dt;
    if (monRideGrace < monRIDE_GRACE) { monRideT += dt; return; }
  } else monRideGrace = 0;
  if (on !== monRider) {
    if (on >= 0 && monRider < 0) {
      monRideDist = 0;
      monToast('hold on.');
      monCue('thud', p.x, p.y, p.z, 0.35, 1.4);
    }
    // ...AND THE RECORD IS FILED WHEN YOU GET OFF, not while you are on.
    // game.record() toasts, and a record written every frame of a
    // forty-second lap is four hundred toasts and the whole HUD is a
    // slot machine.
    if (on < 0 && monRider >= 0 && monRideDist > 8) monRecord('the-hairpin', monRideDist);
    monRider = on;
    monRideT = 0;
    if (on < 0) monTunnelIn = -1;
  }
  if (monRider < 0) { monFrame.x = 0; monFrame.z = 0; return; }
  monRideT += dt;
  // ---- THE LAP, ON THE PAPER, WHILE YOU ARE ON THE ROOF (v32) ------------
  // The metres, not the tunnel's speed: a ride carries two records and the
  // paper shows one attempt at a time, so it shows the one that is still
  // accumulating. The eight-metre floor is the same one the record has two
  // lines up — being brushed by a car is not riding one.
  if (game.recordLive && monRideDist > 8) game.recordLive('the-hairpin', monRideDist);
  monRideDist += monCarV[monRider] * dt;
  const b = monCarBody[monRider];
  monFrame.x = b.velocity.x;
  monFrame.z = b.velocity.z;
}

// ============================================================== THE YACHT ====
/**
 * A HUNDRED AND THIRTY FEET OF SOMEBODY ELSE'S MONEY, and three decks of it.
 *
 * It is moored stern-to on the east quay, which is how every boat in the
 * Mediterranean is moored and which is the reason there is a gangway you can
 * walk up. From the aft deck a companionway goes up to the bridge deck and
 * another to the sun deck at nine metres — and nine metres over water is the
 * highest thing in this chapter you can jump off, which is the whole reason the
 * decks are at the heights they are.
 */
const monYACHT = { x: 10, z: -59, yaw: 0.0, L: 42, B: 8.6 };
const monDECK1 = 3.4, monDECK2 = 6.2, monDECK3 = 9.0;
function monBuildYacht(game, root) {
  const K = monMerger();
  const body = monPoolBody(game);
  const L = monYACHT.L, B = monYACHT.B;
  const y = monWATER;
  // the hull: a wedge forward, a box amidships, a flat transom
  K.box(0, y + 0.9, 0, B, 3.2, L * 0.72, PALETTE.monHull);
  K.box(0, y + 0.1, 0, B - 1.2, 1.8, L * 0.74, PALETTE.monHullDk);
  K.box(0, y + 1.0, L * 0.44, B * 0.62, 3.0, L * 0.24, PALETTE.monHull, 0, 0, 0);
  K.box(0, y + 1.0, L * 0.56, B * 0.26, 2.8, L * 0.10, PALETTE.monHull);
  K.box(0, y + 2.55, 0, B + 0.3, 0.30, L * 0.74, PALETTE.monHullDk);
  K.box(0, y + 2.55, L * 0.44, B * 0.66, 0.30, L * 0.26, PALETTE.monHullDk);
  // the main deck, in teak
  K.box(0, y + monDECK1 - 0.1, -L * 0.06, B - 0.5, 0.24, L * 0.80, PALETTE.monTeak);
  monPoolBox(body, monYACHT.x, y + monDECK1 - 0.4, monYACHT.z - L * 0.06, B - 0.5, 0.8, L * 0.80);
  // the superstructure
  K.box(0, y + monDECK1 + 1.5, -2, B - 1.4, 3.0, L * 0.42, PALETTE.monHull);
  K.box(0, y + monDECK1 + 1.6, -2 + L * 0.21, B - 1.6, 1.4, 0.3, PALETTE.monCarGlass);
  for (let s = -1; s <= 1; s += 2) {
    K.box(s * (B * 0.5 - 0.72), y + monDECK1 + 1.6, -2, 0.3, 1.4, L * 0.40, PALETTE.monCarGlass);
  }
  monPoolBox(body, monYACHT.x, y + monDECK1 + 1.6, monYACHT.z - 2, B - 1.4, 3.2, L * 0.42);
  // the bridge deck
  K.box(0, y + monDECK2 - 0.1, -1, B - 1.0, 0.26, L * 0.50, PALETTE.monTeak);
  monPoolBox(body, monYACHT.x, y + monDECK2 - 0.4, monYACHT.z - 1, B - 1.0, 0.8, L * 0.50);
  K.box(0, y + monDECK2 + 1.4, -4, B - 2.4, 2.8, L * 0.26, PALETTE.monHull);
  K.box(0, y + monDECK2 + 1.6, -4 + L * 0.13, B - 2.6, 1.5, 0.3, PALETTE.monCarGlass);
  monPoolBox(body, monYACHT.x, y + monDECK2 + 1.6, monYACHT.z - 4, B - 2.4, 3.0, L * 0.26);
  // the sun deck, and the lounger on it that has a dinner jacket over the back
  K.box(0, y + monDECK3 - 0.1, -4, B - 2.6, 0.26, L * 0.24, PALETTE.monTeak);
  monPoolBox(body, monYACHT.x, y + monDECK3 - 0.4, monYACHT.z - 4, B - 2.6, 0.8, L * 0.24);
  for (let s = -1; s <= 1; s += 2) {
    K.box(s * 1.4, y + monDECK3 + 0.34, -3.0, 0.72, 0.14, 1.90, PALETTE.monCloth, 0.10, 0, 0);
    K.box(s * 1.4, y + monDECK3 + 0.62, -4.1, 0.72, 0.90, 0.14, PALETTE.monCloth, 0.55, 0, 0);
    for (let f = -1; f <= 1; f += 2) {
      K.cyl(s * 1.4 + f * 0.28, y + monDECK3 + 0.14, -3.0 + f * 0.8, 0.04, 0.30,
            PALETTE.monBrass, 0, 0, 0, 4);
    }
  }
  // the rails, everywhere, because a deck with no rail reads as a raft
  const rails = [[monDECK1, B - 0.4, L * 0.78], [monDECK2, B - 0.9, L * 0.48],
                 [monDECK3, B - 2.5, L * 0.22]];
  for (let r = 0; r < rails.length; r++) {
    const dy = rails[r][0], rb = rails[r][1], rl = rails[r][2];
    for (let s = -1; s <= 1; s += 2) {
      K.box(s * rb * 0.5, y + dy + 0.55, -1, 0.05, 0.05, rl, PALETTE.monBrass);
      for (let k = -4; k <= 4; k++) {
        K.cyl(s * rb * 0.5, y + dy + 0.30, -1 + k * (rl / 9), 0.028, 0.56,
              PALETTE.monBrass, 0, 0, 0, 4);
      }
    }
  }
  // the mast, the radar and the ensign
  K.cyl(0, y + monDECK3 + 2.4, -6, 0.12, 4.6, PALETTE.monMast, 0, 0, 0, 6);
  K.box(0, y + monDECK3 + 4.4, -6, 1.8, 0.10, 0.36, PALETTE.monMast);
  K.cyl(0, y + monDECK3 + 4.9, -6, 0.42, 0.20, PALETTE.monMast, 0, 0, 0, 8);
  K.box(0.5, y + monDECK1 + 0.9, -L * 0.36, 1.1, 0.7, 0.05, PALETTE.monEnsign);

  // the passerelle, off the transom onto the quay. THE WAY ABOARD, and it is
  // drawn as a thing rather than left as a gap, because a player who cannot see
  // a way up assumes there is not one.
  const qz = monPORT.z1;
  K.box(0, y + monDECK1 - 0.4, -L * 0.40 - 3.2, 1.9, 0.20, 7.0, PALETTE.monTeakDk, -0.11, 0, 0);
  for (let s = -1; s <= 1; s += 2) {
    K.box(s * 0.9, y + monDECK1 - 0.05, -L * 0.40 - 3.2, 0.05, 0.72, 7.0, PALETTE.monBrass, -0.11, 0, 0);
  }
  // the two companionways up through the decks
  for (let st = 0; st < 2; st++) {
    const from = st ? monDECK2 : monDECK1, to = st ? monDECK3 : monDECK2;
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      K.box(2.2 - st * 4.4, y + lerp(from, to, t) - 0.1, -6 + i * 0.62,
            1.5, 0.16, 0.62, PALETTE.monTeakDk);
      monPoolBox(body, monYACHT.x + 2.2 - st * 4.4, y + lerp(from, to, t) - 0.32,
                 monYACHT.z - 6 + i * 0.62, 1.5, 0.5, 0.66);
    }
  }

  const g = new THREE.Group();
  const m = new THREE.Mesh(K.build(), monVCF());
  m.castShadow = true; m.receiveShadow = true;
  g.add(m);
  g.position.set(monYACHT.x, 0, monYACHT.z);
  monYachtG = g;
  root.add(g);
  // the gangway's own collider, which is the one piece of this boat a player
  // has to be able to walk up and which is therefore checked by hand
  monStaticBox(game, monYACHT.x, y + monDECK1 - 1.35, monYACHT.z - L * 0.40 - 3.2, 2.0, 2.0, 7.2);
  monPoolBox(body, monYACHT.x, y + 1.2, monYACHT.z, B, 4.0, L * 0.74);
  monPoolBox(body, monYACHT.x, y + 1.2, monYACHT.z + L * 0.44, B * 0.62, 4.0, L * 0.24);
  monPoolDone(game, body);
  monBlock(monYACHT.x, monYACHT.z, 12);
}

// ====================================================== SMALL CRAFT & LAMPS ==
/**
 * FORTY-ONE BOATS AND NINETY-SIX LAMPS, in two draw calls.
 *
 * A harbour with one yacht in it is a diorama. The moored fleet is a single
 * InstancedMesh of one simple hull that rocks on its own phase, and the lamps
 * along every quay and every street are another — the lamps are most of what
 * makes the chapter read as evening rather than as an overcast afternoon, and
 * they are far too many to be individual objects.
 */
const monBOAT_N = 41;
function monBuildSmallCraft(root) {
  const K = monMerger();
  K.box(0, 0.30, 0, 2.3, 0.62, 7.0, PALETTE.monHull);
  K.box(0, 0.02, 0, 1.7, 0.44, 7.2, PALETTE.monHullDk);
  K.box(0, 0.35, 2.9, 1.2, 0.60, 1.6, PALETTE.monHull);
  K.box(0, 0.72, -0.4, 1.8, 0.16, 4.0, PALETTE.monTeak);
  K.box(0, 1.10, 0.9, 1.3, 0.70, 1.6, PALETTE.monHull);
  K.box(0, 1.28, 1.72, 1.1, 0.34, 0.10, PALETTE.monCarGlass);
  K.cyl(0, 2.6, 0.4, 0.07, 3.2, PALETTE.monMast, 0, 0, 0, 4);
  const geo = K.build();
  const m = new THREE.InstancedMesh(geo, monVCF(), monBOAT_N);
  m.castShadow = true; m.receiveShadow = true;
  m.frustumCulled = false;
  monBoatData = new Float32Array(monBOAT_N * 4);   // x z yaw phase
  let n = 0;
  for (let p = 0; p < monPONT.length && n < monBOAT_N; p++) {
    const pt = monPONT[p];
    for (let s = -1; s <= 1 && n < monBOAT_N; s += 2) {
      for (let k = 0; k < 4 && n < monBOAT_N; k++) {
        monBoatData[n * 4] = pt.x + s * 4.4;
        monBoatData[n * 4 + 1] = pt.z - 7.5 + k * 5.0;
        monBoatData[n * 4 + 2] = s > 0 ? -1.5708 : 1.5708;
        monBoatData[n * 4 + 3] = rand(0, 6.28);
        n++;
      }
    }
  }
  // ...and a row stern-to along the east quay, which is where the big ones go
  for (let k = 0; k < 9 && n < monBOAT_N; k++) {
    monBoatData[n * 4] = monPORT.x1 - 7.0;
    monBoatData[n * 4 + 1] = monPORT.z0 + 10 + k * 6.5;
    monBoatData[n * 4 + 2] = 1.5708;
    monBoatData[n * 4 + 3] = rand(0, 6.28);
    n++;
  }
  while (n < monBOAT_N) {
    monBoatData[n * 4] = rand(monPORT.x0 + 10, monPORT.x1 - 10);
    monBoatData[n * 4 + 1] = rand(monPORT.z0 + 10, monPORT.z1 - 22);
    monBoatData[n * 4 + 2] = rand(0, 6.28);
    monBoatData[n * 4 + 3] = rand(0, 6.28);
    n++;
  }
  m.count = monBOAT_N;
  monBoatMesh = m;
  root.add(m);
  monUpdateBoats(0);
}
function monUpdateBoats(dt) {
  if (!monBoatMesh) return;
  for (let i = 0; i < monBOAT_N; i++) {
    const x = monBoatData[i * 4], z = monBoatData[i * 4 + 1];
    const yaw = monBoatData[i * 4 + 2], ph = monBoatData[i * 4 + 3];
    const roll = Math.sin(monTime * 0.9 + ph) * 0.035;
    const pitch = Math.sin(monTime * 0.62 + ph * 1.7) * 0.022;
    monE.set(pitch, yaw, roll, 'YXZ');
    monM.compose(monV3.set(x, monWATER - 0.28 + Math.sin(monTime * 1.1 + ph) * 0.03, z),
                 monQ.setFromEuler(monE), monSc.set(1, 1, 1));
    monBoatMesh.setMatrixAt(i, monM);
  }
  monBoatMesh.instanceMatrix.needsUpdate = true;
}

// ...the lamps.
const monLAMPS = [];
function monLamp(x, z) { monLAMPS.push(x, z); }
function monBuildLamps(root) {
  // round the basin
  for (let i = 0; i < 26; i++) {
    const t = i / 26 * Math.PI * 2;
    monLamp(lerp(monPORT.x0 - 4, monPORT.x1 + 4, (Math.cos(t) + 1) / 2),
            i % 2 ? monPORT.z1 + 4 : monPORT.z0 - 4);
  }
  for (let i = 0; i < 8; i++) {
    monLamp(monPORT.x0 - 4, lerp(monPORT.z0, monPORT.z1, i / 7));
    monLamp(monPORT.x1 + 4, lerp(monPORT.z0, monPORT.z1, i / 7));
  }
  // the square
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    monLamp(monSQUARE.x + Math.cos(a) * 24, monSQUARE.z + Math.sin(a) * 20);
  }
  // the mole, the ramp up the Rock, and the climb
  for (let i = 0; i < 10; i++) monLamp(-52 + i * 12, monMOLE.cz + 4.4);
  for (let i = 0; i < 8; i++) monLamp(lerp(-104, -132, i / 7) + 5, lerp(4, -22, i / 7) + 4);
  for (let i = 0; i < 10; i++) {
    monTrackAt(monTrackLen[1] + i * 12, monTrackTmp);
    monLamp(monTrackTmp.x + Math.cos(monTrackTmp.yaw) * 8,
            monTrackTmp.z - Math.sin(monTrackTmp.yaw) * 8);
  }

  // ---- AND THE CLIMB ITSELF, WHICH HAD NOTHING ON IT (v30) --------------
  //
  // Route life, measured against five other chapters with the same probe:
  // dead 20 m cells per landmark leg, over walkable unblocked ground with the
  // harbour and the buildings excluded —
  //
  //     monaco 14  ·  kyoto 6  ·  hanoi 1  ·  goreme 0  ·  venice 0  ·  manly 0
  //
  // The worst of the six, and they were not scattered: they clustered on the
  // legs to `casino`, `door` and `wheel`, which are all the same walk — the
  // climb from the port up to the casino, and the one leg every player makes
  // because it is how act one becomes act two. Sample cells (50,-41), (59,-22),
  // (98,55), (108,75): dry, unblocked, y 2.6 to 28, nothing within twelve
  // metres.
  //
  // Lamps, because they are already instanced — one more instance is about
  // forty triangles and the chapter has 8k of headroom under its ratchet — and
  // because a lit road at dusk is what that hill actually has on it. No new
  // mesh, no new material, no new draw call.
  //
  // DIFFERENTIAL: 14 dead cells without this block, 12 with it. Modest, and
  // said plainly rather than rounded up — closing the rest needs content on
  // that hillside, which is a design decision about somebody else's chapter
  // and not a thing to slip into a closeout.
  //
  // AND THE FIRST NUMBERS THIS COMMENT CARRIED WERE WRONG, which is worth more
  // than the fix. The probe took an InstancedMesh's BOUNDING-BOX CENTRE as one
  // object, so every scattered lamp, palm, bollard and tree in the game — 90%
  // of what any chapter draws; Monte Carlo is 253 plain meshes and 2,780 things
  // — was counted once, in the middle, and was invisible everywhere else. It
  // read 48 dead cells here, and adding these fifteen lamps along the exact
  // line it was complaining about moved the number UP to 53. A detector that
  // gets worse when you fix what it points at is not measuring what it says.
  for (let i = 0; i < 15; i++) {
    const t = i / 14;
    const cx = lerp(46, 112, t), cz = lerp(-46, 84, t);
    monLamp(cx + (i % 2 ? 5.2 : -5.2), cz);
  }

  const n = monLAMPS.length / 2;
  const K = monMerger();
  K.cyl(0, 0.20, 0, 0.24, 0.40, PALETTE.monQuayDk, 0, 0, 0, 8);
  K.cyl(0, 2.4, 0, 0.09, 4.4, PALETTE.monLampPost, 0, 0, 0, 6);
  K.box(0, 4.66, 0, 0.34, 0.14, 0.34, PALETTE.monLampPost);
  const post = new THREE.InstancedMesh(K.build(), monVCF(), n);
  post.castShadow = true; post.receiveShadow = false;
  post.frustumCulled = false;
  const KG = monMerger();
  KG.sph(0, 5.0, 0, 0.30, 0.36, 0.30, PALETTE.monLamp, 8);
  const glob = new THREE.InstancedMesh(KG.build(),
    grain(mat(0xffffff, { vertexColors: true, emissive: 0xffffff, emissiveIntensity: 1.0 }),
          { amount: 0 }), n);
  glob.castShadow = false; glob.receiveShadow = false;
  glob.frustumCulled = false;
  glob.userData.noShadow = true;
  for (let i = 0; i < n; i++) {
    const x = monLAMPS[i * 2], z = monLAMPS[i * 2 + 1];
    const y = monTerrain(x, z);
    monM.compose(monV3.set(x, y, z), monQ.identity(), monSc.set(1, 1, 1));
    post.setMatrixAt(i, monM);
    glob.setMatrixAt(i, monM);
    monBlock(x, z, 0.35);
  }
  post.instanceMatrix.needsUpdate = true;
  glob.instanceMatrix.needsUpdate = true;
  monLampMesh = glob;
  root.add(post);
  root.add(glob);
}

// ================================================== PALMS AND THE CROWD ======
const monPALM_N = 54;
function monBuildPalms(root) {
  const K = monMerger();
  K.cyl(0, 2.2, 0, 0.19, 4.4, PALETTE.monTrunk, 0, 0, 0, 6);
  K.cyl(0, 4.4, 0, 0.30, 0.5, PALETTE.monTrunk, 0, 0, 0, 6);
  for (let f = 0; f < 9; f++) {
    const a = f * 0.698;
    const dr = 0.30 + (f % 3) * 0.06;
    K.box(Math.cos(a) * 1.5, 4.5 - dr, Math.sin(a) * 1.5, 3.2, 0.09, 0.62,
          f % 2 ? PALETTE.monPalm : PALETTE.monPalmDk, 0.18 * Math.cos(a), -a, 0.18 * Math.sin(a));
  }
  const m = new THREE.InstancedMesh(K.build(), monVCF(), monPALM_N);
  m.castShadow = true; m.receiveShadow = false;
  m.frustumCulled = false;
  let n = 0;
  const put = function (x, z) {
    if (n >= monPALM_N) return;
    const y = monTerrain(x, z);
    if (y < monWATER + 0.4) return;
    monE.set(0, rand(0, 6.28), 0, 'YXZ');
    monM.compose(monV3.set(x, y, z), monQ.setFromEuler(monE),
                 monSc.set(1, rand(0.85, 1.25), 1));
    m.setMatrixAt(n, monM);
    monBlock(x, z, 0.7);
    n++;
  };
  for (let i = 0; i < 18; i++) put(lerp(monPORT.x0, monPORT.x1, i / 17), monPORT.z1 + 6.5);
  for (let i = 0; i < 10; i++) put(lerp(monPORT.x0, monPORT.x1, i / 9), monPORT.z0 - 6.5);
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2;
    put(monSQUARE.x + Math.cos(a) * 21, monSQUARE.z + Math.sin(a) * 17);
  }
  for (let i = 0; i < 8; i++) put(-70 - i * 5, -6 + i * 3);
  while (n < monPALM_N) put(rand(60, 150), rand(58, 92));
  m.count = n;
  monPalmMesh = m;
  root.add(m);
}

/**
 * THE CROWD ON THE FENCE, and every one of them is looking at the road.
 *
 * Forty-six people, instanced, standing behind the barrier along the harbour
 * front and packed into the grandstand. They do exactly one thing: they follow
 * the nearest car with their heads. It is the cheapest possible crowd and it is
 * the difference between a circuit and a car park, because a crowd that all
 * turns at once is the only thing in a chapter this size that can tell you
 * something is coming before you can see it.
 */
function monBuildWatchers(root) {
  const K = monMerger();
  K.box(0, 0.42, 0, 0.44, 0.84, 0.30, PALETTE.monCrowdA);
  K.box(0, 1.12, 0, 0.50, 0.60, 0.34, PALETTE.monCrowdB);
  K.box(0, 1.52, 0, 0.20, 0.20, 0.20, PALETTE.monSkin);
  K.sph(0, 1.72, 0, 0.19, 0.21, 0.19, PALETTE.monSkin, 6);
  K.sph(0, 1.80, -0.02, 0.20, 0.16, 0.20, PALETTE.monHair, 6);
  const m = new THREE.InstancedMesh(K.build(), monVCF(), monWatchN);
  m.castShadow = true; m.receiveShadow = false;
  m.frustumCulled = false;
  monWatchPh = new Float32Array(monWatchN * 4);   // x y z phase
  const col = new Float32Array(monWatchN * 3);
  const pal = [PALETTE.monCrowdA, PALETTE.monCrowdB, PALETTE.monCrowdC,
               PALETTE.monCrowdD, PALETTE.monCrowdE];
  let n = 0;
  // in the grandstand
  for (let r = 0; r < 7 && n < monWatchN; r++) {
    for (let c = 0; c < 4 && n < monWatchN; c++) {
      monWatchPh[n * 4] = -16 + c * 12 + rand(-2, 2);
      monWatchPh[n * 4 + 1] = 3.3 + r * 0.62;
      monWatchPh[n * 4 + 2] = -99.2 - r * 1.0;
      monWatchPh[n * 4 + 3] = rand(0, 6.28);
      n++;
    }
  }
  // ...and along the barrier on the harbour front
  while (n < monWatchN) {
    const s = rand(monTrackLen[12], monTrackLen[16]);
    monTrackAt(s, monTrackTmp);
    const nx = Math.cos(monTrackTmp.yaw), nz = -Math.sin(monTrackTmp.yaw);
    const off = -(monTRACK_HALF + rand(2.2, 4.4));
    monWatchPh[n * 4] = monTrackTmp.x + nx * off;
    monWatchPh[n * 4 + 2] = monTrackTmp.z + nz * off;
    monWatchPh[n * 4 + 1] = monTerrain(monWatchPh[n * 4], monWatchPh[n * 4 + 2]);
    monWatchPh[n * 4 + 3] = rand(0, 6.28);
    n++;
  }
  for (let i = 0; i < monWatchN; i++) {
    monCol.set(pal[randInt(0, pal.length - 1)]);
    col[i * 3] = monCol.r; col[i * 3 + 1] = monCol.g; col[i * 3 + 2] = monCol.b;
  }
  m.instanceColor = new THREE.InstancedBufferAttribute(col, 3);
  monWatchMesh = m;
  root.add(m);
  monUpdateWatchers(0);
}
function monUpdateWatchers(dt) {
  if (!monWatchMesh) return;
  for (let i = 0; i < monWatchN; i++) {
    const x = monWatchPh[i * 4], y = monWatchPh[i * 4 + 1], z = monWatchPh[i * 4 + 2];
    const ph = monWatchPh[i * 4 + 3];
    // the nearest car, and they all turn to it
    let bd = 1e9, bx = x, bz = z + 1;
    for (let c = 0; c < monCarG.length; c++) {
      const g = monCarG[c];
      const dx = g.position.x - x, dz = g.position.z - z;
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; bx = g.position.x; bz = g.position.z; }
    }
    const yaw = bd < 90 * 90 ? Math.atan2(bx - x, bz - z) : ph;
    const bob = Math.sin(monTime * 1.3 + ph) * 0.02;
    monE.set(0, yaw, 0, 'YXZ');
    monM.compose(monV3.set(x, y + bob, z), monQ.setFromEuler(monE), monSc.set(1, 1, 1));
    monWatchMesh.setMatrixAt(i, monM);
  }
  monWatchMesh.instanceMatrix.needsUpdate = true;
}

// ====================================================== THE EYE, RUNNING =====
/**
 * WHAT BEING SEEN ACTUALLY COSTS, and it is deliberately almost nothing.
 *
 * Seventeen chapters have kept one rule without exception: nothing in this game
 * is ever denied. A stealth layer that takes a task away would break it, so
 * this one takes TEN SECONDS AND YOUR DIGNITY. You are picked up under the
 * forelegs, carried out, and put down at the bottom of the steps with whatever
 * was in your mouth left on the carpet. Then you may walk straight back in.
 *
 * Everything the player needs to read is on the floor: five wedges of warm
 * light that sweep, and go red as they fill. There is no meter, because this
 * game has never had one and was not going to grow one for a chapter.
 */
function monEyeYaw(e) {
  return e.base + e.amp * Math.sin(monTime * e.hz * 6.28318 + e.x * 0.37 + e.z * 0.11);
}

function monUpdateEye(game, dt) {
  const capy = game.capy;
  if (!capy || !capy.position) return;
  const p = capy.position;

  // ---- the sweep. It runs whether or not anybody is in the room, because a
  // room that only starts working when you walk into it is a room you can hear.
  for (let i = 0; i < monEyes.length; i++) {
    const e = monEyes[i];
    e.yaw = monEyeYaw(e);
    if (e.g) e.g.rotation.y = e.yaw;
    if (e.cone) e.cone.rotation.y = e.yaw;
  }

  const inside = monInCasino(p.x, p.z) && p.y > monFLOOR_Y - 3 && p.y < monFLOOR_Y + 11;
  if (inside && !monEverIn) {
    monEverIn = true;
    monTask('pass-the-door');
    monToast('nobody stopped you. that is the last time nobody stops you.');
  }
  monInside = inside;

  // ---- being carried out ------------------------------------------------
  if (monOutT > 0) {
    monOutT -= dt;
    if (monOutT <= 0) {
      monPutOnSteps(game);
      monCoolT = monEYE_COOL;
      monSeen = 0;
    }
    return;
  }
  if (monCoolT > 0) monCoolT -= dt;

  if (!inside || monCoolT > 0) {
    monSeen = Math.max(0, monSeen - monEYE_DRAIN * dt * 1.6);
    monEyeTint();
    return;
  }

  // ---- how well any of them can see you ---------------------------------
  // THE LOAF AND THE RUN ARE THE WHOLE INTERFACE. Sitting down halves the
  // range; running raises it by half again. Both are verbs the player has had
  // since chapter one and neither of them was ever a stealth mechanic, which is
  // exactly why this chapter did not have to teach anything.
  const loaf = capy.loaf || 0;
  const run = capy.isRunning ? 1 : 0;
  const held = capy.heldProp ? 1 : 0;
  const scale = lerp(1, monEYE_LOAF, loaf) * lerp(1, monEYE_RUN, run) * (1 + held * 0.12);
  let best = 0;
  for (let i = 0; i < monEyes.length; i++) {
    const e = monEyes[i];
    const range = monEYE_RANGE * scale;
    const dx = p.x - e.x, dz = p.z - e.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    e.k = 0;
    if (d > range || d < 0.001) continue;
    let a = Math.atan2(dx, dz) - e.yaw;
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    if (Math.abs(a) > monEYE_HALF) continue;
    if (monBlockedSight(e.x, e.z, p.x, p.z)) continue;
    const k = (1 - d / range) * (1 - Math.abs(a) / monEYE_HALF);
    e.k = k;
    if (k > best) best = k;
  }
  if (best > 0) monSeen = Math.min(1, monSeen + monEYE_FILL * (0.40 + best) * dt);
  else monSeen = Math.max(0, monSeen - monEYE_DRAIN * dt);
  monEyeTint();

  // ---- and the two thresholds -------------------------------------------
  if (monSeen > monEYE_WARN && !monWarned) {
    monWarned = true;
    monToast('somebody has looked up.');
    monCue('tick', p.x, p.y, p.z, 0.36, 1.5);
  } else if (monSeen < 0.12) monWarned = false;

  if (monSeen >= 1 && monOutT < 0) monEject(game);
}

/** The wedges are the whole HUD: warm while nobody minds, red while they do. */
const monEyeCold = new THREE.Color(PALETTE.monLampWarm);
const monEyeHot  = new THREE.Color(PALETTE.monKerbR);
function monEyeTint() {
  for (let i = 0; i < monEyes.length; i++) {
    const e = monEyes[i];
    if (!e.cone) continue;
    const k = clamp(monSeen * 0.55 + e.k * 0.75, 0, 1);
    e.cone.material.color.copy(monEyeCold).lerp(monEyeHot, k);
    e.cone.material.opacity = 0.075 + k * 0.14;
  }
}

function monEject(game) {
  monOutT = monEYE_OUT;
  monFloorRun = -1;
  // whatever was in the mouth stays in the building. It is the only thing this
  // chapter ever takes off you and it is on the carpet when you come back.
  if (game.physics && typeof game.physics.release === 'function' &&
      game.capy && game.capy.heldProp) game.physics.release(null);
  if (typeof game.punch === 'function') game.punch(0.34);
  monSfx('gasp', { volume: 0.6 });
  monToast('two hands under the forelegs. very politely.');
}

/**
 * PUT BACK ON THE STEPS. Four places, not one — see teleportCapy in systems.js:
 * the authoritative position, the previous step, the interpolated transform and
 * every scrap of momentum, or the renderer lerps from the middle of the salon
 * and the animal smears across the facade for a frame.
 */
function monPutOnSteps(game) {
  const capy = game.capy;
  const b = capy && capy.body;
  if (!b) return;
  const sx = monSTEPS.x, sz = monSTEPS.z - 4.5;
  const sy = monTerrain(sx, sz) + 1.0;
  b.position.set(sx, sy, sz);
  if (b.previousPosition) b.previousPosition.copy(b.position);
  if (b.interpolatedPosition) b.interpolatedPosition.copy(b.position);
  b.velocity.set(0, 0, 0);
  b.angularVelocity.set(0, 0, 0);
  if (b.force) b.force.set(0, 0, 0);
  if (b.torque) b.torque.set(0, 0, 0);
  if (b.wakeUp) b.wakeUp();
  if (capy.position) capy.position.set(sx, sy, sz);
  if (capy.velocity) capy.velocity.set(0, 0, 0);
  if (capy.group) capy.group.position.set(sx, sy, sz);
  if (typeof capy.face === 'function') capy.face(0);
  monToast('you may of course come back in.');
  monCue('thud', sx, sy, sz, 0.42, 0.9);
}

// ======================================================== THE STACK ==========
/**
 * A PLAQUE IS A PROP, AND THE WHEEL IS WHERE PROPS GO TO BECOME MONEY.
 *
 * Six of them sit on the four tables. Take one in your mouth, walk it to the
 * back of the salon, and drop it on the wheel: the pocket under it when it
 * settles is what it is worth. Red two, black one, green eight and a noise the
 * room has not made all evening.
 *
 * NOTHING IS EVER LOST. A gamble with a downside would be the first thing in
 * eighteen chapters that could take something away from a player, and the two
 * seconds of watching a wheel is the whole pleasure — the arithmetic is not
 * where the fun is. What the stack does is give the chapter the one thing this
 * game has never had: a number that goes UP because you did something, and a
 * task that is a threshold rather than a switch.
 */
function monWheelPocket() {
  let a = -monWheelA % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return Math.floor(a / (Math.PI * 2 / 37)) % 37;
}
function monPay(i) { return i === 0 ? monPAY_Z : (i % 2 ? monPAY_R : monPAY_K); }

function monUpdateWheel(game, dt) {
  if (!monWheelBody) return;
  // RULE 2 AND RULE 3 FOR A CARRIER, in one line each. The wheel is turned by
  // angularVelocity and never by writing its quaternion, because a body whose
  // transform is assigned is a body cannon never integrates: there is no
  // relative velocity for friction to act on and a passenger simply stands
  // still on a spinning plate.
  monWheelBody.angularVelocity.set(0, monWHEEL_W, 0);
  monWheelA += monWHEEL_W * dt;
  if (monWheelG) {
    monWheelG.quaternion.copy(monWheelBody.interpolatedQuaternion);
    monWheelG.position.copy(monWheelBody.interpolatedPosition);
  }
  // the ball runs the other way round the rim, which is the only correct way
  // to draw a roulette wheel and takes one minus sign
  monBallA -= dt * 2.4;
  if (monBallMesh) {
    monBallMesh.position.set(Math.cos(monBallA - monWheelA) * (monWHEEL.r - 0.10), 0.34,
                             Math.sin(monBallA - monWheelA) * (monWHEEL.r - 0.10));
  }

  // ---- somebody standing on it -------------------------------------------
  const capy = game.capy;
  if (capy && capy.position) {
    const p = capy.position;
    const dx = p.x - monWHEEL.x, dz = p.z - monWHEEL.z;
    const on = (dx * dx + dz * dz) < (monWHEEL.r + 0.3) * (monWHEEL.r + 0.3) &&
               p.y > monWHEEL.y + 0.1 && p.y < monWHEEL.y + 2.2;
    if (on) {
      monWheelRideT += dt;
      if (monWheelRideT > monWHEEL_RIDE && !monWheelDone) {
        monWheelDone = true;
        monTask('the-wheel');
        if (typeof game.punch === 'function') game.punch(0.30);
      }
    } else monWheelRideT = Math.max(0, monWheelRideT - dt * 0.8);
  }

  // ---- a plaque landing in it --------------------------------------------
  for (let i = monPlaqueProps.length - 1; i >= 0; i--) {
    const pr = monPlaqueProps[i];
    if (!pr || !pr.body) { monPlaqueProps.splice(i, 1); continue; }
    if (pr.held) continue;
    const b = pr.body.position;
    const dx = b.x - monWHEEL.x, dz = b.z - monWHEEL.z;
    if (dx * dx + dz * dz > monWHEEL.r * monWHEEL.r) continue;
    if (b.y < monWHEEL.y - 0.2 || b.y > monWHEEL.y + 1.1) continue;
    const sp = pr.body.velocity ? pr.body.velocity.length() : 0;
    if (sp > 1.2) continue;                    // let it settle first
    monPlaqueProps.splice(i, 1);
    if (game.physics && typeof game.physics.removeProp === 'function') {
      game.physics.removeProp(pr);
    }
    monSettle(game, monWheelPocket());
    monPlaqueT = 2.2;                          // ...and another one turns up
  }
  if (monPlaqueT > 0) {
    monPlaqueT -= dt;
    if (monPlaqueT <= 0) monSpawnPlaque(game);
  }
  if (monPayT > 0) monPayT -= dt;
}

function monSettle(game, pocket) {
  const pay = monPay(pocket);
  monStack += pay;
  monEverWon = true;
  if (monStack > monStackBest) monStackBest = monStack;
  monPayT = 2.0; monPayKind = pocket === 0 ? 2 : (pocket % 2 ? 1 : 0);
  const wx = monWHEEL.x, wy = monWHEEL.y + 0.5, wz = monWHEEL.z;
  if (pocket === 0) {
    // The green. Once in thirty-seven, and the room has to notice.
    monCue('chime', wx, wy, wz, 0.6, 0.8);
    monCue('pop', wx, wy, wz, 0.5, 1.6);
    if (typeof game.punch === 'function') game.punch(0.42);
    if (game.music && typeof game.music.swell === 'function') game.music.swell(0.65);
    monToast('zero. the whole table stops talking. eight.');
  } else {
    monCue('pop', wx, wy, wz, 0.42, pocket % 2 ? 1.35 : 1.0);
    monCue('tick', wx, wy, wz, 0.30, 1.7);
    monToast((pocket % 2 ? 'rouge. ' : 'noir. ') + pay + '. you are ' + monStack + ' up.');
  }
  monRecord('chip-stack', monStackBest);
  if (monStack >= monSTACK_WIN && !monStackDone) {
    monStackDone = true;
    monTask('chip-stack');
  }
}

// OFFSETS FROM THE TABLE, not absolute x. The first version paired spot 2
// (x = 128.6) with table 2 (x = 104) and dropped a plaque twenty-four metres
// from the felt it was supposed to be lying on.
const monPLAQUE_SPOT = [
  [-1.5, 0.7], [1.6, -0.7], [-1.4, 0.6], [1.5, -0.6], [-0.6, 0.9], [0.7, 1.1],
];
let monPlaqueNext = 0;
function monSpawnPlaque(game) {
  if (!game.physics || typeof game.physics.spawnProp !== 'function') return;
  if (monPlaqueProps.length >= 6) return;
  const t = monTABLES[monPlaqueNext % monTABLES.length];
  const s = monPLAQUE_SPOT[monPlaqueNext % monPLAQUE_SPOT.length];
  monPlaqueNext++;
  const pr = game.physics.spawnProp('plaque', t.x + s[0], t.z + s[1], monFLOOR_Y + 1.02);
  if (pr) monPlaqueProps.push(pr);
}

// ============================================================== THE PIANO ====
/**
 * YOU DO NOT PRESS A KEY, YOU WALK ALONG THEM.
 *
 * Which is why every key springs back on its own: the task is eight distinct
 * notes inside four seconds, and the only way to get that is to keep moving,
 * and the picture of that is a wake of keys still coming up behind you.
 */
function monUpdatePiano(game, dt) {
  if (!monPianoG) return;
  const capy = game.capy;
  if (capy && capy.position) {
    monV3c.copy(capy.position);
    monPianoG.worldToLocal(monV3c);
    if (Math.abs(monV3c.z - 0.40) < 0.42 && monV3c.y > 0.55 && monV3c.y < 1.5 &&
        monV3c.x > -1.42 && monV3c.x < 1.42) {
      const idx = clamp(Math.round((monV3c.x + 1.34) / 0.0515), 0, 51);
      for (let k = idx - 2; k <= idx + 2; k++) {
        if (k < 0 || k > 51) continue;
        const key = monPianoKey[k];
        if (key.mesh.position.y > key.y0 - 0.012) key.v = -0.9;
      }
      if (idx !== monPianoLast) {
        monPianoLast = idx;
        monPianoRun++;
        monPianoT = 0;
        // one note per key, and the pitch IS the key, so a run down the
        // instrument sounds like a run down the instrument
        monPianoKeyAt(idx, monV3d);
        monCue('chime', monV3d.x, monV3d.y, monV3d.z, 0.30,
               Math.pow(2, (idx - 26) / 12) * 1.0);
        if (monPianoRun >= 8 && !monPianoDone) {
          monPianoDone = true;
          monTask('piano-solo');
          if (typeof game.punch === 'function') game.punch(0.22);
          monToast('the salon has heard worse. not recently.');
        }
      }
    } else monPianoLast = -1;
  }
  monPianoT += dt;
  if (monPianoT > 4.0) { monPianoRun = 0; monPianoT = 0; }
  for (let i = 0; i < monPianoKey.length; i++) {
    const k = monPianoKey[i];
    const y = k.mesh.position.y;
    k.v += (k.y0 - y) * 220 * dt - k.v * 14 * dt;
    let ny = y + k.v * dt;
    if (ny < k.y0 - 0.035) { ny = k.y0 - 0.035; k.v = 0; }
    if (ny > k.y0) { ny = k.y0; if (k.v > 0) k.v = 0; }
    k.mesh.position.y = ny;
  }
}

// ============================================================== THE TOWER ====
function monUpdateTower(game, dt) {
  if (!monToweMesh) return;
  const capy = game.capy;
  if (monToweT < 0 && capy && capy.position) {
    const p = capy.position;
    const dx = p.x - monToweX, dz = p.z - monToweZ;
    const sp = capy.velocity ? Math.sqrt(capy.velocity.x * capy.velocity.x +
                                         capy.velocity.z * capy.velocity.z) : 0;
    if (dx * dx + dz * dz < 2.0 * 2.0 && p.y > monFLOOR_Y - 0.5 && sp > 2.2) {
      monToweT = 0;
      const away = Math.atan2(dx, dz);
      for (let i = 0; i < monToweMesh.count; i++) {
        const o = i * 9;
        const a = away + rand(-1.2, 1.2);
        const v = rand(1.2, 4.4) * (1 + (monToweData[o + 1] - monFLOOR_Y) * 0.2);
        monToweData[o + 3] = Math.sin(a) * v;
        monToweData[o + 4] = rand(1.4, 3.6);
        monToweData[o + 5] = Math.cos(a) * v;
        monToweData[o + 6] = rand(-9, 9);
      }
      monCue('pop', monToweX, monFLOOR_Y + 1.6, monToweZ, 0.75, 1.9);
      monCue('splash', monToweX, monFLOOR_Y + 1.6, monToweZ, 0.4, 2.2);
      if (typeof game.punch === 'function') game.punch(0.40);
      if (!monToweDone) { monToweDone = true; monTask('champagne'); }
      monToast('fifty-five glasses. one animal.');
    }
  }
  if (monToweT < 0) return;
  monToweT += dt;
  let live = 0;
  for (let i = 0; i < monToweMesh.count; i++) {
    const o = i * 9;
    if (monToweData[o + 8] < 0.5) continue;
    live++;
    monToweData[o + 4] -= 18 * dt;
    monToweData[o] += monToweData[o + 3] * dt;
    monToweData[o + 1] += monToweData[o + 4] * dt;
    monToweData[o + 2] += monToweData[o + 5] * dt;
    monToweData[o + 7] += monToweData[o + 6] * dt;
    if (monToweData[o + 1] <= monFLOOR_Y + 0.06) {
      monToweData[o + 1] = monFLOOR_Y + 0.06;
      monToweData[o + 4] *= -0.24;
      monToweData[o + 3] *= 0.5; monToweData[o + 5] *= 0.5;
      monToweData[o + 6] *= 0.5;
      if (Math.abs(monToweData[o + 4]) < 0.4) { monToweData[o + 4] = 0; monToweData[o + 6] = 0; }
    }
  }
  monToweSync();
  if (monToweT > 18) monToweT = 18;             // parked; they stay where they fell
}

// ============================================================== THE GUARD ====
/**
 * HE IS NOT A LOCAL, and that is the joke.
 *
 * Every other person in this game turns to look at you and says something. He
 * has no lines, does not turn, and does not acknowledge that a capybara has
 * climbed onto his sentry box. `monGuardBreak` is the only number on him: how
 * close he is to laughing, and at 1.0 he goes, which is the one time in this
 * chapter that anybody's composure fails.
 */
function monUpdateGuard(game, dt) {
  if (!monGuardG) return;
  const capy = game.capy;
  const p = capy && capy.position;
  const near = p ? Math.hypot(p.x - monGuardG.position.x, p.z - monGuardG.position.z) : 99;
  if (!monGuardDone) {
    // proximity alone does nothing; being ANNOYING does. Standing on his boots
    // is worth about as much as three wheeks.
    if (near < 1.4) monGuardBreak += dt * 0.30;
    monGuardBreak = Math.max(0, monGuardBreak - dt * 0.055);
    if (monGuardBreak >= 1) {
      monGuardDone = true;
      monTask('palace-guard');
      monCue('gasp', monGuardG.position.x, monGuardG.position.y + 1.6, monGuardG.position.z, 0.5, 1.25);
      if (typeof game.punch === 'function') game.punch(0.24);
      monToast('he has gone. two hundred years of that, and you.');
    }
  }
  // the shake. Nothing else on him moves at all, which is what makes it read.
  const sh = monGuardDone ? Math.max(0, 1 - (monTime % 60) * 0) : monGuardBreak;
  const k = monGuardDone ? 0.055 : monGuardBreak * 0.03;
  monGuardG.children[0].rotation.z = Math.sin(monTime * 21) * k;
  monGuardG.children[0].position.y = Math.abs(Math.sin(monTime * 10.5)) * k * 0.9;
}

// ============================================================== THE YACHT ====
/**
 * THREE DECKS, AND THE TOP ONE IS THE HIGHEST THING IN THE CHAPTER YOU MAY
 * JUMP OFF.
 *
 * `high-dive` is measured rather than switched: the record is how far above the
 * water you left from, so going off the aft deck ticks it and going off the sun
 * deck is nine and a half metres and is the answer the task is actually asking
 * for. Everything about the boat's geometry — three decks at 3.4, 6.2 and 9.0 —
 * exists to make that a decision.
 */
function monUpdateYacht(game, dt) {
  const capy = game.capy;
  if (!capy || !capy.position) return;
  const p = capy.position;
  const dx = p.x - monYACHT.x, dz = p.z - monYACHT.z;
  const aboard = Math.abs(dx) < monYACHT.B * 0.6 && Math.abs(dz) < monYACHT.L * 0.45 &&
                 p.y > monWATER + 2.4;
  if (aboard) {
    monAboardT += dt;
    if (monAboardT > 0.9 && !monAboardDone) {
      monAboardDone = true;
      monTask('superyacht');
      monToast('nobody has asked to see anything.');
    }
    // the highest point you have been at, for the dive
    monDiveTop = Math.max(monDiveTop, p.y);
  } else {
    monAboardT = 0;
  }
  // the dive: you left something high and you are now in the water
  if (monDiveTop > monWATER + 4 && !aboard) {
    const inWater = p.y < monWATER + 0.5 &&
                    p.x > monPORT.x0 && p.x < monPORT.x1 && p.z > monPORT.z0 && p.z < monPORT.z1;
    if (inWater) {
      const h = monDiveTop - monWATER;
      if (h > monDiveBest) { monDiveBest = h; monRecord('high-dive', h); }
      if (!monDiveDone && h > 5.5) {
        monDiveDone = true;
        monTask('high-dive');
        if (typeof game.punch === 'function') game.punch(0.36);
        monToast(h.toFixed(1) + ' metres, and not one of them elegant.');
      }
      monDiveTop = 0;
    } else if (capy.grounded && p.y > monWATER + 1) {
      monDiveTop = 0;                            // landed on something. no dive.
    }
  }
  // she rolls, gently, on her lines
  if (monYachtG) {
    monYachtG.rotation.z = Math.sin(monTime * 0.62) * 0.008;
    monYachtG.rotation.x = Math.sin(monTime * 0.44 + 1.1) * 0.005;
  }
}

// ========================================================= THE TUNNEL RUN ====
/**
 * THE MARQUEE, AND IT IS FOUR AND A HALF SECONDS LONG.
 *
 * You are on the roof of a car doing twenty-six metres a second and the world
 * closes over. There is nothing to do — that is the point, and it is the same
 * argument the condor and the herd already make: the animal is not being clever,
 * it is being carried by something very much bigger than it.
 *
 * `monTunnelIn` is the lap distance at which the rider entered the bore. If the
 * rider is still on the roof when the car passes the far mouth, that is the
 * task; the record is the average speed through it, which is a number a player
 * can go back and beat by picking a better car and a better corner to get on at.
 */
function monUpdateTunnel(game, dt) {
  // the camera's own enclosure, which is what systems.js reads to shut the
  // world down. It is the CAMERA and not the animal: a rider whose head is
  // out of the mouth while the lens is still inside should see daylight.
  const cam = game.camera;
  const k = cam ? monTunnelK2(cam.position.x, cam.position.z) : 0;
  monTunnelK = damp(monTunnelK, k, 7, dt);

  if (monRider < 0) { monTunnelIn = -1; return; }
  const s = monCarU[monRider];
  const a = monTrackLen[monTUNNEL_A], b = monTrackLen[monTUNNEL_B];
  const inBore = s > a && s < b;
  if (inBore && monTunnelIn < 0) {
    monTunnelIn = s;
    monCue('hiss', monCarG[monRider].position.x, monCarG[monRider].position.y + 1.5,
           monCarG[monRider].position.z, 0.5, 0.6);
  }
  // A ONE-FRAME GAP IS NOT GETTING OFF. The rider test is a box in the car's
  // own frame and at twenty-six metres a second a corner can put the animal
  // outside it for a frame or two while the contact is still perfectly sound;
  // measured, the bore entry was being thrown away and re-taken every five to
  // ten frames all the way through the tunnel, so the run never completed and
  // the marquee could not be earned at all.
  if (!inBore && monTunnelIn >= 0) {
    // out the far end, or off the back of it
    const done = s > b - 2 || s < a;
    if (done && monTunnelIn < a + 14) {
      const len = b - a;
      const spd = monCarV[monRider];
      if (spd > monTunnelBest) { monTunnelBest = spd; monRecord('the-tunnel', spd); }
      if (!monTunnelDone) {
        monTunnelDone = true;
        monTask('the-tunnel');
        // THE VEHICLE CHAPTER'S OWN SHOT. `over` says the chapter that owns the
        // car is the one asking, which is the only way this channel is reachable
        // from a marquee that happens ON a vehicle — see frameShot in systems.js.
        if (typeof game.frameShot === 'function') {
          // RAISE 3.6, NOT 1.0 — measured, by projecting the bore's own 253
          // vertices into the frame through the whole envelope. At raise 1.0
          // the lens sits level with the car's roof and the first six tenths
          // of the shot are the back of a car with 0% of the tunnel visible;
          // it only appears once the trail has dragged the camera out to 15 m
          // on its own, and it is gone again by 1.8 s as the car pulls away.
          // A 3.4 s hold with 0.9 s of subject in it. Lifting the lens clears
          // the car and puts the bore in frame from the first frame instead:
          // 100% of it from 0.3 s to 1.5 s.
          //
          // AND THE HOLD IS 1.9 s, NOT 3.4. Past 1.5 s the car has outrun the
          // shot -- the trail is at 28 m and the tunnel has left the frame
          // entirely -- so the last half of a 3.4 s hold was the marquee
          // lingering on an empty road. A shot that outlives its subject is a
          // shot that ends on nothing.
          game.frameShot({ yaw: monCarYaw[monRider] + Math.PI, dist: 22, pitch: 0.20,
                           raise: 3.6, hold: 1.9, over: true });
        }
        if (game.music && typeof game.music.swell === 'function') game.music.swell(1.0);
      }
    }
    monTunnelIn = -1;
  }
  // the hairpin, which is the other half of the ride and much easier
  if (!monHairpinDone && monRider >= 0) {
    const hp = monTrackLen[7];
    if (Math.abs(s - hp) < 9) {
      monHairpinDone = true;
      monTask('the-hairpin');
      if (typeof game.punch === 'function') game.punch(0.26);
      monToast('the slowest corner in motor racing, and you are on the roof of it.');
    }
  }

}

// ============================================================= THE CHICANE ===
// Five cones out of the Nouvelle Chicane, and the harbour is nine metres away.
const monChicaneProps = [];
function monSpawnChicane(game) {
  if (!game.physics || typeof game.physics.spawnProp !== 'function') return;
  monInitTrack();
  // AT THE POOL SECTION AND NOT AT THE CHICANE ITSELF, and it is not an
  // aesthetic choice: the basin's edge is nine metres from the road HERE and
  // twenty-two metres from it at node 12. A task that reads "put it in the
  // harbour" has to be a shove, not a haul.
  for (let i = 0; i < 5; i++) {
    monTrackAt(monTrackLen[14] - 6 + i * 3.2, monTrackTmp);
    const nx = Math.cos(monTrackTmp.yaw), nz = -Math.sin(monTrackTmp.yaw);
    const o = (i % 2 ? 1 : -1) * 2.6;
    const pr = game.physics.spawnProp('cone', monTrackTmp.x + nx * o,
                                      monTrackTmp.z + nz * o, monTrackTmp.y + 0.5);
    if (pr) monChicaneProps.push(pr);
  }
}

// ================================================================ LOCALS =====
/**
 * SEVEN PEOPLE, AND NOT ONE OF THEM IS SURPRISED.
 *
 * That is the chapter's whole line on itself: in a principality where the
 * ordinary Tuesday involves a helicopter and a man in a dinner jacket losing
 * the price of a house, a capybara in the lobby is not the strangest thing
 * anybody has seen this week. Every one of them treats it as a matter of
 * protocol rather than of surprise.
 *
 * Every anchor is probed against terrainHeight rather than guessed, because two
 * of the game's locals once shipped standing in a river.
 */
function monBuildLocals(game) {
  if (typeof game.addLocal !== 'function') return;
  const put = function (x, z, o, deck) {
    const h = deck === undefined ? monTerrain(x, z) : deck;
    if (deck === undefined && h < monWATER + 0.3) {
      console.warn('[monaco] local at', x, z, 'is in the water (' + h.toFixed(2) + ') - skipped');
      return null;
    }
    o.biome = 'monaco';
    o.x = x; o.z = z; o.y = h;
    return game.addLocal(o);
  };

  monLocDoor = put(monSTEPS.x - 3.4, monSTEPS.z + 3.0, {
    figure: { shirt: PALETTE.monTux, legs: PALETTE.monTux, hat: PALETTE.monTux },
    face: Math.PI, near: 9,
    // ---- AND WHAT HE SAYS CHANGES (v30) --------------------------------
    // Chapter 18 shipped with no conditional line anywhere in it: `onTask`
    // fires once at the moment and is gone, so a doorman who has watched you
    // walk out of that building eleven chips up greeted you next morning
    // exactly as he greeted you the first time. `after:`/`before:` is the
    // channel that makes a place remember, and every other chapter with a cast
    // has between fifteen and forty-two of them.
    lines: ['Good evening. The jacket is not, strictly, required.',
            'You are on the list. I have not checked the list.',
            'Mind the step. Everybody minds the step.',
            'They are two thousand a night, the rooms. You have not asked.',
            { t: 'You will want a jacket. I am not saying you will need one.', before: 'black-tie' },
            { t: 'The jacket suits you. I shall not ask whose it is.', after: 'black-tie' },
            { t: 'The door is that way. I am the door.', before: 'pass-the-door' },
            { t: 'You know the way in now. I would rather you used it.', after: 'pass-the-door' },
            { t: 'They are still counting, inside. Twice.', after: 'chip-stack' },
            { t: 'I have been asked to describe you. I said: a gentleman.', after: 'the-tunnel' }],
    wheek: ['Indeed.', 'Quite.', 'A very good evening to you also.'],
    onTask: { 'the-tunnel': ['I felt that from here.'],
              'chip-stack': ['The gentlemen inside are talking about you.'] },
  });
  put(monSTEPS.x + 3.6, monSTEPS.z + 2.4, {
    figure: { shirt: PALETTE.monCrowdC }, face: Math.PI - 0.4, near: 8,
    lines: ['Someone has parked something enormous on the pavement again.',
            'I have been here eleven years. You are the fourth.',
            'The fourth ANIMAL. The others were a peacock and two dogs.',
            { t: 'The Palace is up the hill. You will not get up there.', before: 'the-rock' },
            { t: 'You got up the Rock. Nobody walks up the Rock.', after: 'the-rock' },
            { t: 'They say one of the guards moved. They never move.', after: 'palace-guard' }],
  });
  monLocQuay = put(-58, -30, {
    figure: { shirt: PALETTE.monCrowdD, hat: PALETTE.monCrowdE }, face: 1.2, near: 8,
    lines: ['Nothing in this water since Tuesday.',
            'They put a boat in there once. Cost more than the country.',
            'Everybody looks up the hill. Nobody looks down here.',
            { t: 'That big white one is not going anywhere. Nobody is aboard.', before: 'superyacht' },
            { t: 'You were on it. I watched you get on it.', after: 'superyacht' },
            { t: 'Something came off the top deck this morning. Big splash.', after: 'high-dive' },
            { t: 'There is a barrier in my water now. That is new.', after: 'chicane' }],
    wheek: ['You will scare what is left of them.'],
  });
  monLocDeck = put(monYACHT.x - 2.4, monYACHT.z - 14, {
    figure: { shirt: PALETTE.monShirt, legs: PALETTE.monTux }, face: Math.PI, near: 9,
  }, monWATER + monDECK1 + 0.05);
  if (monLocDeck) {
    monLocDeck.lines = ['The owner is in Gstaad. The owner is always in Gstaad.',
                        'You may go up. Everybody goes up.',
                        'That is nine metres to the water. People do ask.',
                        { t: 'Nobody has ever actually gone off it. People ask, and then they look.', before: 'high-dive' },
                        { t: 'You went off it. From the TOP deck. I have to write that up.', after: 'high-dive' },
                        { t: 'You are dressed better than the owner now.', after: 'black-tie' }];
    monLocDeck.wheekLines = ['I shall put you down as a guest.'];
  }
  monLocMarshal = put(168, 44, {
    figure: { shirt: PALETTE.monMarshal, hat: PALETTE.monMarshalHat }, face: -1.9, near: 10,
    lines: ['They come through here at about thirty. You can outrun that.',
            'Slowest corner on the calendar. Do not tell them I said so.',
            'If you are going to do it, do it on the inside.',
            { t: 'You want the hairpin. Everything else here is too fast.', before: 'the-hairpin' },
            { t: 'You rode the hairpin. On the ROOF. I am still not writing it down.', after: 'the-hairpin' },
            { t: 'The tunnel is the loud one. Mind your ears.', before: 'the-tunnel' },
            { t: 'They heard that tunnel in Nice.', after: 'the-tunnel' }],
    wheek: ['Yellow flag. That is you, that is.'],
    onTask: { 'the-hairpin': ['I saw that. I am not writing it down.'] },
  });
  monLocBar = put(monCASINO.x + monCASINO.w * 0.5 - 7.5, monFRONT_Z + 6, {
    figure: { shirt: PALETTE.monShirt, legs: PALETTE.monTux }, face: -1.5708, near: 8,
    lines: ['Change, sir? Madam? I shall guess.',
            'The wheel does not stop. It has not stopped since nineteen-ten.',
            'Green pays eight. Green does not happen.',
            { t: 'You will want to be ten up before you try to leave.', before: 'chip-stack' },
            { t: 'Ten up, and out of the door. I have worked here nine years.', after: 'chip-stack' },
            { t: 'Somebody has watered the carpet with a very good year.', after: 'champagne' }],
    wheek: ['Please.'],
    onTask: { 'chip-stack': ['You are up. Now walk out. Nobody ever walks out.'] },
  }, monFLOOR_Y);
  monLocCroup = put(monWHEEL.x - 3.4, monWHEEL.z - 1.2, {
    figure: { shirt: PALETTE.monShirt, legs: PALETTE.monTux }, face: 1.4, near: 8,
    lines: ['Rien ne va plus.', 'Faites vos jeux. Or do not. It is all the same to me.',
            'Something has to go IN it. That is how it works.',
            { t: 'The wheel is for the ball. I mention it in case.', before: 'the-wheel' },
            { t: 'You have been IN the wheel. I have nothing for that.', after: 'the-wheel' },
            { t: 'The piano is not usually part of the evening.', after: 'piano-solo' }],
    wheek: ['Rien ne va plus.'],
    onTask: { 'the-wheel': ['That is not what it is for.'] },
  }, monFLOOR_Y);

  // ---- and two of them talk to each other -------------------------------
  if (typeof game.addExchange === 'function' && monLocDoor && monLocBar) {
    game.addExchange({ biome: 'monaco', a: monLocCroup, b: monLocBar, gap: 26, lines: [
      ['There is an animal at the wheel.', 'There is always an animal at the wheel.'],
      ['It is winning.', 'They all win, for a while.'],
      ['Should I say something?', 'You have said something. It went in anyway.'],
      ['Table nine is up eleven.', 'Table nine is a rodent.'],
      ['The zero came up.', 'The zero never comes up.'],
    ] });
  }
}

/** The wheek. It does two things here and both of them are about being noticed. */
function monWheek(game) {
  const capy = game.capy;
  if (!capy || !capy.position) return;
  const p = capy.position;
  // in the casino it is the worst possible idea, and the room says so
  if (monInside && monOutT < 0 && monCoolT <= 0) {
    monSeen = Math.min(1, monSeen + 0.34);
    if (!monToldEye) {
      monToldEye = true;
      monToast('in here, that is not a greeting. that is an announcement.');
    }
  }
  // ...and at the Palace it is most of how you get a carabinier to break
  if (monGuardG && !monGuardDone) {
    const d = Math.hypot(p.x - monGuardG.position.x, p.z - monGuardG.position.z);
    if (d < 9) {
      monGuardBreak = Math.min(1, monGuardBreak + 0.36 * (1 - d / 9) + 0.10);
      if (monGuardBreak > 0.35 && monGuardBreak < 0.9) {
        monCue('tick', monGuardG.position.x, monGuardG.position.y + 1.7,
               monGuardG.position.z, 0.22, 1.4);
      }
    }
  }
}

// ============================================================ THE ARRIVAL ====
let monDiveTop = 0;
let monRockT = 0, monRockDone = false;
let monSpawned = false;

// ============================================================== SCATTER ======
/**
 * MONTE CARLO HAD NOTHING ON THE FLOOR AT ALL.
 *
 * Counted across the chapters: the Pantanal puts down twenty-five separate
 * scatters and Circular Quay sixteen; Monte Carlo and Hanoi have ZERO between
 * them, on the two chapters that are almost entirely paving. The near octave in
 * grain() breaks the value up, but a shader term cannot cast a shadow and cannot
 * be walked past — what says "this is a real surface" at four metres is a small
 * object lying on it with a shadow under it.
 *
 * THREE THINGS, and the split is what makes it read as a place rather than as
 * litter. It is April and the quay is lined with planes: LEAVES on the flats,
 * chips of pale limestone GRIT where the paving meets the rock, and MAQUIS tufts
 * on the hillside above the town, which is the one part of this chapter that is
 * not swept every morning.
 *
 * The layout rules are the Pantanal's, and they were paid for there:
 *   - a JITTERED GRID, not a scatter, so nothing piles up in one corner and
 *     nothing starves;
 *   - the budget is spent PER CELL, never as a global `break` on a spatial
 *     sweep — that truncates the map geographically and silently;
 *   - noShadow on the flat pieces. A two-centimetre leaf's shadow is its own
 *     shadow acne and nothing else. The tufts DO cast, because a tuft is the
 *     thing whose shadow is the point.
 */
function monBuildScatter(root) {
  // TWO TRIANGLES A PIECE, WHICH IS WHY THERE CAN BE THOUSANDS OF THEM. The
  // first build laid boxes on an eight-metre grid: twelve triangles each and one
  // piece per twenty-five square metres, which photographed as a swept quay with
  // four bits of rubbish on it. A leaf lying flat is a QUAD — it has no sides
  // anybody can see from a lens six metres up — so the same triangle count buys
  // six times the density, and density is the entire point.
  const leafGeo = new THREE.PlaneGeometry(1, 1);
  leafGeo.rotateX(-Math.PI / 2);
  // Bounded to where the chapter is actually played. The terrain runs to 270 m
  // in x and the quay ends at about 110: scattering the whole heightfield is
  // twenty thousand quads nobody will ever stand within sixty metres of.
  const X0 = -100, X1 = 100, Z0 = -120, Z1 = 110, CELL = 3.0;
  const NX = Math.ceil((X1 - X0) / CELL), NZ = Math.ceil((Z1 - Z0) / CELL);
  const leaves = [], dead = [], grit = [], tufts = [];
  for (let gz = 0; gz < NZ; gz++) {
    for (let gx = 0; gx < NX; gx++) {
      const per = 2 + ((gx * 7 + gz * 13) % 3);
      for (let k = 0; k < per; k++) {
        const x = X0 + (gx + rand(0.05, 0.95)) * CELL;
        const z = Z0 + (gz + rand(0.05, 0.95)) * CELL;
        const h = monTerrain(x, z);
        if (h < monWATER + 0.35) continue;                  // the harbour
        if (h > 96) continue;                               // above the town, out of shot
        // Clear of the circuit AND of its shoulder: the tarmac is a mesh of its
        // own laid over the terrain, so anything placed on the analytic height
        // in there is under the road rather than on it.
        if (monRoad(x, z) < monTRACK_HALF + monTRACK_SHLD) continue;
        if (h > 30 && z > 78) {
          const s2 = rand(0.55, 1.15);
          tufts.push(x, h + s2 * 0.4, z, 0, rand(0, 6.283), 0, s2 * 0.8, s2, s2 * 0.8);
        } else if (monRoad(x, z) < monTRACK_HALF + 14) {
          const w = rand(0.15, 0.30);
          grit.push(x, h + 0.05, z, 0, rand(0, 6.283), 0, w, 1, w * rand(0.6, 1.0));
        } else {
          const w = rand(0.24, 0.44);
          (k & 1 ? leaves : dead).push(x, h + 0.05, z, 0, rand(0, 6.283), 0, w, 1, w * rand(0.5, 0.8));
        }
      }
    }
  }
  const put = (list, geo, color, cast) => {
    const n = list.length / 9;
    if (n < 1) return 0;
    const im = new THREE.InstancedMesh(geo, mat(color), n);
    for (let i2 = 0; i2 < n; i2++) {
      const o = i2 * 9;
      im.setMatrixAt(i2, monXform(list[o], list[o + 1], list[o + 2], list[o + 3], list[o + 4],
                                  list[o + 5], list[o + 6], list[o + 7], list[o + 8]));
    }
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    im.castShadow = !!cast;
    im.receiveShadow = false;
    if (!cast) im.userData.noShadow = true;
    root.add(im);
    return n;
  };
  // TWO leaf colours, because one is a stain and two are leaves. A plane
  // sheds pale and it sheds rust, and against a quay at monQuay the pale one
  // alone was invisible from the standard rig — photographed, the first pass
  // read as a swept apron with four specks on it.
  put(leaves, leafGeo, PALETTE.monQuayDk, false);
  put(dead, leafGeo, PALETTE.monRoofDk, false);
  put(grit, leafGeo, PALETTE.monConcreteDk, false);
  put(tufts, monG.cone4, PALETTE.monHedge, true);
}

function monBuild(game) {
  if (monBuilt) return;
  monBuilt = true;
  monInitGeos();
  monInitTrack();

  monRoot = new THREE.Group();
  monRoot.name = 'monaco';
  game.scene.add(monRoot);

  monBuildGround(game, monRoot);
  monBuildGroundBody(game);
  monBuildScatter(monRoot);
  monBuildSea(monRoot);
  monBuildHarbour(game, monRoot);
  monBuildTown(game, monRoot);
  monBuildRock(game, monRoot);
  monBuildGuard(monRoot);
  monBuildTerrace(game, monRoot);
  monBuildCasino(game, monRoot);
  monBuildCircuit(game, monRoot);
  monBuildCars(game, monRoot);
  monBuildYacht(game, monRoot);
  monBuildSmallCraft(monRoot);
  monBuildPalms(monRoot);
  monBuildLamps(monRoot);
  monBuildWatchers(monRoot);
  // LAST, because every builder above may have asked for a lit window and this
  // is the one draw call all of them land in.
  monBuildWindows(monRoot);
  monBuildLocals(game);

  if (typeof game.registerShadowTarget === 'function') {
    for (let i = 0; i < monCarG.length; i++) game.registerShadowTarget(monCarG[i]);
  }
}

// ================================================================ TASKS ======
/**
 * The list, and what actually ticks each row. Everything measured is measured
 * here rather than at the site so there is one place to read the chapter's
 * whole scoring from.
 */
function monUpdateTasks(game, dt) {
  const capy = game.capy;
  if (!capy || !capy.position) return;
  const p = capy.position;

  if (!monArrived) {
    monArrived = true;
    const cd = game.biome && typeof game.biome.current === 'string' ? game.biome.current : '';
    if (cd === 'monaco') monTask('to-monaco');
  }

  // ---- the first act says what it is ------------------------------------
  if (!monToldTrack && monRoad(p.x, p.z) < monTRACK_HALF + 2 && monTime > 2) {
    monToldTrack = true;
    monToast('the white lines are not decoration. something uses them.');
  }

  // ---- CROSSING THE FLOOR, and it is the only timed thing in the chapter --
  // From the door to the wheel, without ever being seen well enough to matter.
  // It starts when you come through the door with the room quiet and it is
  // thrown away the moment monSeen passes the warning line, which is the same
  // number the wedges go red at — so what fails the run is exactly what the
  // player can see failing it.
  const atDoor = Math.abs(p.x - monDOOR.x) < 3.4 && Math.abs(p.z - monDOOR.z) < 3.0 &&
                 p.y > monFLOOR_Y - 2;
  // ---- THE ROOM DOES NOT CLOSE WHEN THE TICK LANDS (v32) ------------------
  // `if (!monFloorDone)` round the whole block is the sixth instance in this
  // pass of the same mistake — the Cali floor, the samba column, Selarón's
  // steps, the Quay's passage and the fruit barrow were the others — and it is
  // the worst of them, because `the-floor` is `better: 'lower'` and this is the
  // only timed thing in the chapter. The clock stopped for ever on the first
  // crossing that landed, so the number could never be improved. The TICK
  // happens once; the room can be crossed all night.
  {
    if (monFloorRun < 0 && atDoor && monSeen < 0.05) monFloorRun = 0;
    else if (monFloorRun >= 0) {
      monFloorRun += dt;
      // the clock, on the paper, while you are on the floor
      if (game.recordLive) game.recordLive('the-floor', monFloorRun);
      if (monSeen > monEYE_WARN || !monInside) monFloorRun = -1;
      else {
        const dx = p.x - monWHEEL.x, dz = p.z - monWHEEL.z;
        if (dx * dx + dz * dz < 4.6 * 4.6) {
          if (monFloorBest <= 0 || monFloorRun < monFloorBest) monFloorBest = monFloorRun;
          monRecord('the-floor', monFloorRun);
          if (!monFloorDone) {
            monFloorDone = true;
            monTask('the-floor');
            if (typeof game.punch === 'function') game.punch(0.30);
            monToast('across a room with five people in it. nobody looked up once.');
          }
          monFloorRun = -1;
        }
      }
    }
  }

  // ---- up on the Rock ----------------------------------------------------
  // THE HEIGHT GATE IS EIGHT METRES AND NOT TWO, and it has to be: the ramp's
  // own blend pulls the last stretch of the plateau down toward the path, so
  // the ground beside the Palace measures about thirty-six against a nominal
  // forty and an animal standing on it is at thirty-seven. The question is
  // 'are you up here', not 'are you within two metres of a constant'.
  if (!monRockDone && monInRect(monZ.palace, p.x, p.z) && p.y > monROCK.h - 8 &&
      capy.grounded) {
    monRockT += dt;
    if (monRockT > 1.2) {
      monRockDone = true;
      monTask('the-rock');
      monToast('fifty-eight metres, and nothing up here has changed in seven hundred years.');
    }
  }

  // ---- the dinner jacket -------------------------------------------------
  if (monTuxProp && !monTuxGone && monTuxProp.held) {
    monTuxGone = true;
    monTask('black-tie');
    monSfx('rustle', { volume: 0.5 });
    monToast('it is a little long in the leg. it will do.');
  }

  // ---- the stack, once you have one --------------------------------------
  if (!monToldStack && monStack > 0 && monStack < monSTACK_WIN) {
    monToldStack = true;
    monToast('the wheel pays what the pocket says. red two, black one, green eight.');
  }
}

// ============================================================== AMBIENCE =====
/**
 * WHAT THIS PLACE SOUNDS LIKE, and it is three different rooms.
 *
 * Outside: water against stone, a halyard on a mast, and a car somewhere up the
 * hill that you hear before you see. Inside: the room tone of forty people
 * being quiet, a chip stack riffling, and nothing else at all — which is what a
 * casino floor genuinely sounds like and is the reason the eye is frightening.
 * In the tunnel: one engine, and it is all of it.
 *
 * All of it is positional, which is most of the point: the reason a car matters
 * before you can see it is that you can hear WHICH SIDE it is coming from.
 */
function monUpdateAmbience(game, dt) {
  monAmbT -= dt;
  const capy = game.capy;
  const p = capy && capy.position;
  if (!p) return;

  // the cars. Always, and always from where they are: this is the one sound in
  // the chapter that is doing a job rather than setting a mood.
  for (let i = 0; i < monCarG.length; i++) {
    const g = monCarG[i];
    const d = Math.hypot(g.position.x - p.x, g.position.z - p.z);
    if (d > 120) continue;
    const k = monCarV[i] / monCAR_VMAX;
    if (Math.random() < dt * (2.4 + k * 3.0) * clamp(1 - d / 120, 0, 1)) {
      const tun = monTunnelK2(g.position.x, g.position.z);
      monCue('hiss', g.position.x, g.position.y + 0.8, g.position.z,
             (0.10 + k * 0.20) * (1 + tun * 0.9), 0.36 + k * 0.55, 130);
    }
  }
  if (monAmbT > 0) return;

  const inside = monInside;
  const r = Math.random();
  if (inside) {
    // the quietest bed in the game after the cave's, and for the same reason:
    // an empty-sounding room is how a player knows they can be heard in it
    if (r < 0.34) monCue('tick', p.x + rand(-9, 9), p.y, p.z + rand(-9, 9), rand(0.04, 0.09), rand(2.1, 3.0));
    else if (r < 0.60) monCue('pop', p.x + rand(-11, 11), p.y, p.z + rand(-11, 11), rand(0.03, 0.07), rand(1.5, 2.2));
    else if (r < 0.82) monCue('rustle', p.x + rand(-8, 8), p.y, p.z + rand(-8, 8), rand(0.03, 0.06), rand(1.2, 1.7));
    else monCue('chime', monWHEEL.x, monWHEEL.y + 1, monWHEEL.z, rand(0.04, 0.08), rand(1.7, 2.4));
    monAmbT = rand(2.4, 6.0);
    return;
  }
  // outside. Gulls, water on the mole, and rigging.
  monGullT -= dt;
  if (r < 0.26) {
    monCue('splash', rand(monPORT.x0, monPORT.x1), monWATER, monPORT.z0 - rand(2, 20),
           rand(0.05, 0.11), rand(0.5, 0.8));
    monAmbT = rand(3, 8);
  } else if (r < 0.48) {
    monCue('tick', rand(-30, 20), monWATER + 4, monPORT.z1 - rand(10, 24),
           rand(0.04, 0.09), rand(2.4, 3.4));       // a halyard against a mast
    monAmbT = rand(2.5, 7);
  } else if (r < 0.66) {
    monCue('gull', rand(-70, 70), 14, rand(-110, -20), rand(0.05, 0.11), rand(1.5, 2.1));
    monAmbT = rand(6, 15);
  } else if (r < 0.84) {
    monCue('rustle', p.x + rand(-14, 14), p.y + 4, p.z + rand(-14, 14),
           rand(0.04, 0.08), rand(0.9, 1.4));       // palms
    monAmbT = rand(4, 10);
  } else {
    monCue('chime', monPALACE.x, monPALACE.y + 15, monPALACE.z, rand(0.05, 0.10), rand(0.7, 0.95));
    monAmbT = rand(14, 30);                          // the cathedral, a long way off
  }
}

// ============================================================== CREATE =======
export function createMonaco(game) {
  monGame = game;

  const onWheek = function () { monWheek(game); };
  game.events.on('capy:wheek', onWheek);

  // The chicane goes in the water. props.js already emits this with the prop on
  // it, so there is nothing to poll and nothing to get wrong about which cone.
  game.events.on('prop:water', function (e) {
    if (monChicaneDone || !e || !e.prop) return;
    if (monChicaneProps.indexOf(e.prop) < 0) return;
    monChicaneDone = true;
    monTask('chicane');
    if (typeof game.punch === 'function') game.punch(0.28);
    monToast('the marshals will be some time.');
  });

  game.biome.register('monaco', {
    ensureBuilt() { monBuild(game); },
    onEnter() {
      // A fresh arrival is a fresh evening. Everything STAGED replays; the
      // checklist itself is systems.js's business and stays ticked. (Chapter 3
      // shipped without this and a second visit to the Quay was scenery.)
      monTime = 0;
      monSeen = 0; monOutT = -1; monCoolT = 0; monWarned = false;
      monInside = false; monFloorRun = -1;
      monRider = -1; monRideT = 0; monRideDist = 0; monTunnelIn = -1; monTunnelK = 0;
      monWheelRideT = 0; monPayT = -1;
      monAboardT = 0; monDiveTop = 0;
      monRockT = 0;
      monToldEye = false; monToldTrack = false; monToldStack = false;
      monPianoRun = 0; monPianoLast = -1; monPianoT = 0;
      monAmbT = 0; monGullT = 0;
      monArrived = false;
      // the cars go back onto their spacing, because three cars that have
      // drifted into a queue over ten minutes is not a session, it is a jam
      for (let i = 0; i < monCarG.length; i++) {
        monCarU[i] = (i / monCAR_N) * monTrackTotal;
        monCarV[i] = monCAR_VMAX * 0.5;
        monTrackAt(monCarU[i], monTrackTmp);
        monCarTX[i] = monTrackTmp.x; monCarTZ[i] = monTrackTmp.z;
        monCarTY[i] = monTrackTmp.y + monCAR_HY;
        monCarYaw[i] = monTrackTmp.yaw;
        const b = monCarBody[i];
        b.position.set(monTrackTmp.x, monTrackTmp.y + monCAR_HY, monTrackTmp.z);
        b.quaternion.setFromEuler(0, monTrackTmp.yaw, 0);
        b.velocity.setZero(); b.angularVelocity.setZero();
        monSyncBody(b);
      }
      // ...AND THE TOWER IS STACKED AGAIN. Once per visit, not once per
      // session: the tick on the list stays ticked and the SHOW replays, for
      // the same reason the cars are back on their spacing.
      if (monToweMesh && monToweData) {
        let n = 0;
        for (let tier = 0; tier < 5 && n < monToweMesh.count; tier++) {
          const per = 5 - tier;
          for (let a = 0; a < per && n < monToweMesh.count; a++) {
            for (let b = 0; b < per && n < monToweMesh.count; b++) {
              const o = n * 9;
              monToweData[o] = monToweX + (a - (per - 1) / 2) * 0.135;
              monToweData[o + 1] = monFLOOR_Y + 1.44 + tier * 0.19;
              monToweData[o + 2] = monToweZ + (b - (per - 1) / 2) * 0.135;
              monToweData[o + 3] = 0; monToweData[o + 4] = 0; monToweData[o + 5] = 0;
              monToweData[o + 6] = 0; monToweData[o + 7] = 0; monToweData[o + 8] = 1;
              n++;
            }
          }
        }
        monToweT = -1;
        monToweSync();
      }
      // the wheel keeps whatever it has paid out — a stack is the one thing in
      // this chapter that is a JOURNEY rather than a switch, and resetting it
      // on the way back in would make the record meaningless
      monSpawned = false;
    },
    onExit() {
      monRider = -1;
      monOutT = -1;
      monFrame.x = 0; monFrame.z = 0;
      for (let i = 0; i < monCarBody.length; i++) {
        monCarBody[i].velocity.setZero();
        monCarBody[i].angularVelocity.setZero();
      }
      if (monWheelBody) monWheelBody.angularVelocity.setZero();
    },
  });

  const api = {
    built() { return monBuilt; },
    terrainHeight: monTerrain,
    slopeAt: monSlope,
    waterLevel: monWATER,
    isOverWater: monIsOverWater,
    waterHeightAt: monWaterHeightAt,
    groundSlip: monGroundSlip,
    surfacePitch: monSurfacePitch,
    inZone: monInZone,
    navBlocked: monNavBlocked,
    randomPointIn: monRandomPointIn,
    SPAWN: monSPAWN,
    /**
     * THE HARBOUR HAS A FLOOR AND YOU CAN SEE IT, so the dive is on. It is six
     * and a half metres of very clear water with a shopping trolley's worth of
     * things on the bottom of it, which is the honest version of that basin.
     */
    canDive: true,
    /**
     * A DECLARED FRAME, because the contact sweep is not good enough at
     * twenty-six metres a second. See A KINEMATIC CARRIER in CONTRACT.md: the
     * horizontal goes through the channel, and NOTHING here assigns the
     * passenger's vertical velocity, because the roof of a car climbing the
     * hill rises at three and a half metres a second under an animal standing
     * still — which is an honest contact, and an assigned velocity would turn
     * it into no contact at all.
     */
    carryFrame() { return monRider >= 0 ? monFrame : null; },

    // ---- what the rest of the game asks about this chapter ---------------
    /** 0..1 — how enclosed the CAMERA is. systems.js shuts the sky down on it. */
    tunnel() { return monTunnelK; },
    /** 0..1 — how close the room is to picking you up. The harness reads it. */
    seen() { return monSeen; },
    /** Have you ever been through the front door? The exit opens on it. */
    beenIn() { return monEverIn; },
    inside() { return monInside; },
    stack() { return monStack; },
    /** Which car the animal is on, or -1. */
    riding() { return monRider; },
    ridingSpeed() { return monRider >= 0 ? monCarV[monRider] : 0; },
    /** Metres round the lap, and where the bore starts and ends. Harness only. */
    lap() { return monRider >= 0 ? monCarU[monRider] : -1; },
    bore() { monInitTrack(); return [monTrackLen[monTUNNEL_A], monTrackLen[monTUNNEL_B], monTrackTotal]; },
    boreEntry() { return monTunnelIn; },

    // landmarks, for the minimap and the hint arrow
    casino: { x: monCASINO.x, z: monSTEPS.z - 3 },
    door: { x: monDOOR.x, z: monDOOR.z },
    wheel: { x: monWHEEL.x, z: monWHEEL.z },
    piano: { x: 141, z: monFRONT_Z + 9 },
    tower: { x: 100, z: monFRONT_Z + 33 },
    square: { x: monSQUARE.x, z: monSQUARE.z },
    palace: { x: monPALACE.x, z: monPALACE.z - 13 },
    rockRamp: { x: -108, z: 0 },
    yacht: { x: monYACHT.x, z: monYACHT.z - 12 },
    sunDeck: { x: monYACHT.x, z: monYACHT.z - 4 },
    hairpin: { x: monTRACK[7][0], z: monTRACK[7][1] },
    tunnelMouth: { x: monTRACK[monTUNNEL_A][0], z: monTRACK[monTUNNEL_A][1] },
    grandstand: { x: 2, z: -101 },
    quay: { x: -58, z: -30 },
    /** These MOVE — ask, never cache. Each gets its OWN scratch vector. */
    car() {
      // the nearest car, which is the only one worth pointing at
      const capy = monGame && monGame.capy;
      const px = capy && capy.position ? capy.position.x : 0;
      const pz = capy && capy.position ? capy.position.z : 0;
      let bi = 0, bd = 1e18;
      for (let i = 0; i < monCarG.length; i++) {
        const g = monCarG[i];
        const dx = g.position.x - px, dz = g.position.z - pz;
        const d = dx * dx + dz * dz;
        if (d < bd) { bd = d; bi = i; }
      }
      if (!monCarG.length) return api.hairpin;
      monV3b.copy(monCarG[bi].position);
      return monV3b;
    },
    plaque() {
      for (let i = 0; i < monPlaqueProps.length; i++) {
        const pr = monPlaqueProps[i];
        if (pr && pr.body && !pr.held) {
          monV3c.set(pr.body.position.x, pr.body.position.y, pr.body.position.z);
          return monV3c;
        }
      }
      return api.wheel;
    },
    tux() {
      if (!monTuxProp || monTuxGone) return api.sunDeck;
      monV3d.set(monTuxProp.body.position.x, monTuxProp.body.position.y,
                 monTuxProp.body.position.z);
      return monV3d;
    },
    guard() {
      if (!monGuardG) return api.palace;
      return monGuardG.position;
    },
    chicane() {
      for (let i = 0; i < monChicaneProps.length; i++) {
        const pr = monChicaneProps[i];
        if (pr && pr.body) {
          monV3.set(pr.body.position.x, pr.body.position.y, pr.body.position.z);
          return monV3;
        }
      }
      monTrackAt(monTrackLen[14], monTrackTmp);
      return { x: monTrackTmp.x, z: monTrackTmp.z };
    },

    update(dt) {
      if (!monBuilt) return;
      if (!game.biome.isActive('monaco')) return;
      monTime += dt;
      // The two things that need props are staged on the first live frame
      // rather than in the build, because props.js may not exist yet when a
      // chapter is built lazily on first entry.
      if (!monSpawned && game.physics) {
        monSpawned = true;
        if (!monTuxGone && !monTuxProp) {
          monTuxProp = game.physics.spawnProp('dinnerjacket', monYACHT.x + 1.4,
                                              monYACHT.z - 3.0,
                                              monWATER + monDECK3 + 0.55);
        }
        if (!monPlaqueProps.length) {
          for (let i = 0; i < 4; i++) monSpawnPlaque(game);
        }
        if (!monChicaneProps.length) monSpawnChicane(game);
      }
      monUpdateSea(dt);
      monUpdateBoats(dt);
      monUpdateCars(game, dt);
      monUpdateTunnel(game, dt);
      monUpdateEye(game, dt);
      monUpdateWheel(game, dt);
      monUpdatePiano(game, dt);
      monUpdateTower(game, dt);
      monUpdateGuard(game, dt);
      monUpdateYacht(game, dt);
      monUpdateWatchers(dt);
      monUpdateTasks(game, dt);
      monUpdateAmbience(game, dt);
    },
  };
  game.monaco = api;
  return api;
}
