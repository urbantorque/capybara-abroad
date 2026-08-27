import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PALETTE, mat, rand, randInt, clamp, damp, lerp, grain, grainOwn } from './shared.js';

// ===========================================================================
// CHAPTER 11 — HONG KONG. UP IS A DIRECTION HERE.
//
// Eleven chapters of moving about on a plane. The Drift added air, but air is
// not height — you fall further there, you do not go anywhere new. This is the
// chapter that asks for the other axis, and it gets the first genuinely new
// VERB since the condor:
//
//   HOLD E AGAINST BAMBOO AND PUSH THE STICK INTO IT.
//
// It is built the way slip and wind were built. The biome publishes one hook —
// `climbHold(x, y, z)`, "here is the outward normal of the face within reach" —
// and capybara.js owns the solve, so ten chapters that never publish it are
// untouched to the last decimal. Pushing INTO the wall goes up, pulling away
// comes down, sideways shuffles, and Space kicks off. That mapping is why it
// needs no new key: with the camera behind the animal and the wall in front of
// it, W is up for exactly the reason W is forward.
//
// Bamboo scaffolding is the right thing to climb because it is the right thing
// about this city: Hong Kong is the last place on earth that still builds
// forty-storey scaffolds out of a grass, lashed with nylon, by hand, and there
// is one going up on some street in Mong Kok every day of the week.
//
// THE MARQUEE MOMENT IS SCORED, and it is the only one in this game that is.
// At eight o'clock the far shore runs the Symphony of Lights, and the towers
// come up ONE PER BEAT of the chapter's own music — `game.music.beats()`, the
// same clock the audio is scheduled against, so it cannot drift from what the
// player is hearing. The only place you can watch it from is a roof, and the
// only way onto a roof is the bamboo, so the chapter's last verb and its last
// picture are the same gesture. It comes round every two and a half minutes,
// because nothing in this game may be missable for ever.
//
// North to south, and the player faces −z on arrival:
//
//   z 60..-40    THE STREET. Two rows of tong lau, thirty to forty-six metres,
//                and about ninety signs hanging out over the traffic.
//   x −14        the scaffold. Ground to thirty-three metres, and the way up.
//   y 11         the laundry poles, straight across the street, three of them.
//   x 28, z 18   the wet market, down a side lane.
//   z −60..−66   the Star Ferry pier.
//   z −66..−160  VICTORIA HARBOUR.
//   z −186       Hong Kong Island: sixteen towers, and at eight they misbehave.
//
// Everything is prefixed `hk` (contract: the bundler flattens every module into
// one scope).
// ===========================================================================

// ---------------------------------------------------------------- geography --
const hkSPAWN = { x: 0, y: 1.4, z: 34 };

// A REAL STREET IS NARROW. The first cut was nine metres of tarmac each side of
// the centre line and it photographed as an airport: at this camera the top of
// the frame meets flat ground twenty-four metres out, so anything further than
// that across is not in the picture at all and the shot is a road. Mong Kok's
// carriageways are about seven metres wide in total. Six and a half each side
// of the line, four of pavement, and both rows of shopfronts are inside frame
// from the middle of the road — which is where the player spends the chapter.
const hkST_HALF = 6.5;               // half-width of the roadway
const hkPAVE = 4.0;                  // pavement each side
const hkFACE = hkST_HALF + hkPAVE;   // x of the building faces: ±10.5
const hkST_Z0 = -44, hkST_Z1 = 62;   // how far the street runs

// THE LATTICE ENDS ABOVE THE PARAPET, NOT AT IT. capybara.js stops clinging the
// moment the animal is past `top` and hands it the last shove; measured, a top
// of 33 against a roof deck at 34.2 left it airborne at 3.5 m/s, which under a
// full gravity buys 26 cm — so every successful climb ended by sliding back down
// its own scaffold. The lattice now finishes 60 cm ABOVE the deck it serves.
const hkSCAF = { x: -hkFACE, z0: -9, z1: 9, top: 34.8, out: 1.9 };
const hkROOF_Y = 34.2;               // the deck you top out onto
const hkBAKERY = { x: -hkFACE + 1.6, z: 26 };
// The counter is a solid box in front of the shop, so the nearest a capybara can
// GET to hkBAKERY is about 3.7 m — measured, and the zone was 3.4, so the task
// was a metre out of reach of the only place you can stand to do it.
const hkBAKE_R = 4.6;
const hkMARKET = { x: 29, z: 18 };
// UNDER THE POLES, NOT OVER THEM. At 15.4 it sat four metres ABOVE the laundry
// poles, which are the only thing in the street high enough to jump from — so
// the one piece of neon the chapter asks you to stand on could not be reached
// from anywhere at all. At 9.2 its top face is 40 cm under the pole: a drop.
const hkSIGN   = { x: 3.6, y: 9.2, z: -7 };      // the big one
const hkPOLE_Y = 11.4;
const hkPOLE_Z = [19, 5, -7];

const hkPIER_Z = -60;                // where the land stops
const hkPIER_END = -70;              // the end of the pontoon
const hkFAR_PIER = -152;             // the far pontoon
const hkHARBOUR_Y = -4.2;
const hkSHORE_Z = -186;              // the far shore
const hkTOWER_N = 16;

// ---- the clock -------------------------------------------------------------
const hkCYCLE = 152;                 // s — a whole evening, on a loop
// twenty-five seconds before the warning, which is what a climb actually costs
const hkSHOW_SOON = 0.305;
const hkSHOW_WARN = 0.470;           // the towers dim and the street is told
const hkSHOW_ON   = 0.545;           // and it starts
const hkSHOW_OFF  = 0.800;           // and it stops
const hkSHOW_BEATS = 0.42;           // s between towers when the band is silent
// HOW HIGH IS 'ON THE ROOF'. The scaffold's second working deck is at 11.66 and
// the roof it leads to is at hkSCAF.top; twenty-six clears every balcony, every
// laundry pole (11.4) and the big sign, and is below the roof itself with room
// to spare. One constant, so the task and the thing that tells you off for
// missing it can never disagree about where you are supposed to be.
const hkSHOW_ROOF = 26;

// SIXTY, NOT NINETY-SIX. The first cut hung ninety-six signs of up to six
// metres' reach over a thirteen-metre street and they closed over the top of it
// — a solid ceiling of colour with the buildings and the scaffold behind it.
// Mong Kok is busy; it is not roofed. Fewer, smaller, and stratified along the
// street rather than scattered, so no two land on top of each other.
const hkSIGN_N = 60;

// ---------------------------------------------------------------- scratch ---
const hkV3 = new THREE.Vector3();
const hkV3b = new THREE.Vector3();
const hkQ  = new THREE.Quaternion();
const hkEu = new THREE.Euler();
const hkSc = new THREE.Vector3();
const hkM  = new THREE.Matrix4();
const hkCol = new THREE.Color();
const hkHold = { nx: 0, nz: 0, top: 0 };
function hkPush9(l, px, py, pz, rx, ry, rz, sx, sy, sz) { l.push(px, py, pz, rx, ry, rz, sx, sy, sz); }

// ---------------------------------------------------------------- state -----
let hkGame = null;
let hkBuilt = false;
let hkRoot = null;
let hkTime = 0;
let hkPhase = 0.06;
let hkShow = 0;                      // 0..1 — how much of the show is running
let hkShowT = -1;                    // s into the show, -1 when it is not on
let hkLitCount = 0;                  // towers currently up
let hkLastBeat = -1;
let hkBeatAcc = 0;
let hkBeatStall = 0;              // s since game.music's beat counter last moved
// ---- THE SHOW HAS MOVEMENTS NOW --------------------------------------------
// The window is thirty-nine seconds and the only thing that ever happened in it
// was sixteen towers coming up one per beat, which at 0.42 s a beat is over in
// under seven. Measured: for the other thirty-two seconds the far shore held
// perfectly still with all sixteen lit and the lasers turning five hundredths
// of a radian. The marquee moment of chapter eleven was a photograph.
//
// Four movements, and they are the four things the real Symphony of Lights
// actually does: it counts the buildings in, it runs a wave along them, it
// answers itself across the harbour, and then it puts everything up at once.
// The BEAT is still the only clock — a movement changes on a beat, never on a
// timer — so it cannot drift from what the player is hearing.
const hkSHOW_M1 = 0.20;           // build:        one tower per beat
const hkSHOW_M2 = 0.50;           // chase:        a wave along the shore
const hkSHOW_M3 = 0.82;           // counterpoint: odds against evens
let hkShowBeat = 0;               // beats since the show began
let hkChase = 0;                  // where the wave is, in towers
let hkFinaleDone = false;
let hkSkyward = 0;
let hkNeonPulse = 0;

let hkTowers = null;                 // one mesh per tower — see hkBuildSkyline
let hkTowerLit = null;               // 0..1 per tower
let hkWindowMesh = null;             // every lit window on the far shore, one mesh
let hkReflMesh = null, hkReflMat = null, hkReflCol = null, hkReflBase = null;
let hkReflFade = null, hkReflSeg = 1;
const hkAirLights = [];              // x, y, z of the red lights on the tall ones
let hkAirMesh = null;
let hkSignMeshes = null, hkSignPhase = null, hkSignFace = null;
let hkCharMesh = null, hkGlowMesh = null;
const hkDPD_BULBS = [], hkDPD_FLAME = [];
const hkMarketBulbs = [];
let hkLaserMesh = null, hkLaserMat = null;
let hkSweepMesh = null, hkSweepMat = null;
let hkWaterMesh = null;
let hkFerryGroup = null, hkFerryBody = null;
let hkFerryT = 0, hkFerryDir = 1, hkFerryRideT = 0, hkFerryFrom = 0;
let hkHornDone = false;
let hkHarbourDone = false, hkHarbourT = 0;
// previous TARGETS for the two kinematic carriers — see hkUpdateFerry
let hkFerryPZ = 0, hkSignPY = 0;

let hkSignGroup = null, hkSignBody = null, hkSignSway = 0, hkSignSwayV = 0;
let hkBakeryGroup = null, hkTankGroup = null;
let hkFishMesh = null, hkFishData = null, hkFishOut = 0;

let hkClimbBest = 0, hkClimbTold = false;
// The height ladder. Metres, and the last entry is a sentinel above the roof so
// the index can never run off the end. See THE WAY UP PAYS AS YOU GO.
const hkCLIMB_RUNGS = [8, 15, 22, 30, 36, 1e9];
const hkCLIMB_SAY = [
  'above the awnings. nobody down there has noticed.',
  'the poles get thinner from here. that is not a mistake, it is the design.',
  'nine floors of somebody’s washing, and you have passed all of it.',
  'the street noise stops about here. listen.',
  'the roof. that is what the bamboo is for.',
];
let hkClimbRung = 0;
let hkPoleT = -1, hkPoleFrom = 0;
let hkTartDone = false, hkClimbDone = false, hkPoleDone = false;
let hkMarketDone = false, hkSignDone = false, hkShowDone = false, hkFerryDone = false;
let hkSignStandT = 0;
let hkWarned = false;
// the earlier of the two warnings — see TWO WARNINGS in hkUpdateShow
let hkSoonSaid = false;
// The cast, kept so the exchanges can name them and so anything in the chapter
// can make one of them react. See THE PEOPLE WHO LIVE HERE at the bottom.
let hkBakerRec = null, hkFishRec = null, hkPierRec = null, hkScafRec = null;
let hkNeonRec = null, hkBusRec = null;
let hkLaundryRec = null, hkCookRec = null, hkSitRec = null, hkRiggerRec = null;
let hkSeenShow = false;

// =========================================================== GEOMETRY UTIL ==
function hkXform(px, py, pz, rx, ry, rz, sx, sy, sz) {
  hkEu.set(rx, ry, rz, 'YXZ');
  hkQ.setFromEuler(hkEu);
  hkV3.set(px, py, pz);
  hkSc.set(sx, sy, sz);
  hkM.compose(hkV3, hkQ, hkSc);
  return hkM;
}

const hkG = { box: null, cyl16: null, cyl6: null, cyl8: null, cyl4: null, cone6: null, sph6: null };
function hkInitGeos() {
  if (hkG.box) return;
  hkG.box = new THREE.BoxGeometry(1, 1, 1);
  hkG.cyl6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
  hkG.cyl8 = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
  hkG.cyl4 = new THREE.CylinderGeometry(0.5, 0.5, 1, 4);
  // and a round one, for the pools of light on the tarmac: an octagon three
  // metres across lying under a neon sign reads as an octagon.
  hkG.cyl16 = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
  hkG.cone6 = new THREE.ConeGeometry(0.5, 1, 6);
  hkG.sph6 = new THREE.SphereGeometry(0.5, 6, 4);
}

/** CONTRACT: box() takes FULL extents, CANNON.Box takes HALF, and hkStaticBox
 *  below speaks THIS one so the two cannot be a factor of two apart. */
function hkMerger() {
  const pos = [], nor = [], col = [], idx = [];
  const M = {
    n: 0,
    add(geo, m4, color) {
      const g = geo.clone();
      g.applyMatrix4(m4);
      const p = g.attributes.position.array;
      const nm = g.attributes.normal.array;
      hkCol.set(color);
      const start = M.n;
      for (let i = 0; i < p.length; i += 3) {
        pos.push(p[i], p[i + 1], p[i + 2]);
        nor.push(nm[i], nm[i + 1], nm[i + 2]);
        col.push(hkCol.r, hkCol.g, hkCol.b);
      }
      const vc = p.length / 3;
      if (g.index) { const ia = g.index.array; for (let i = 0; i < ia.length; i++) idx.push(start + ia[i]); }
      else { for (let i = 0; i < vc; i++) idx.push(start + i); }
      M.n += vc;
      g.dispose();
      return M;
    },
    box(cx, cy, cz, sx, sy, sz, color, rx, ry, rz) {
      return M.add(hkG.box, hkXform(cx, cy, cz, rx || 0, ry || 0, rz || 0, sx, sy, sz), color);
    },
    cyl(cx, cy, cz, r, h, color, rx, ry, rz, seg) {
      const g = seg === 4 ? hkG.cyl4 : seg === 8 ? hkG.cyl8
              : seg === 16 ? hkG.cyl16 : hkG.cyl6;
      return M.add(g, hkXform(cx, cy, cz, rx || 0, ry || 0, rz || 0, r * 2, h, r * 2), color);
    },
    cone(cx, cy, cz, r, h, color, rx, ry, rz) {
      return M.add(hkG.cone6, hkXform(cx, cy, cz, rx || 0, ry || 0, rz || 0, r * 2, h, r * 2), color);
    },
    sph(cx, cy, cz, rx2, ry2, rz2, color) {
      return M.add(hkG.sph6, hkXform(cx, cy, cz, 0, 0, 0, rx2 * 2, ry2 * 2, rz2 * 2), color);
    },
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
function hkVC() {
  return grain(mat(0xffffff, { vertexColors: true }),
               { scale: 0.5, amount: 0.085, warp: 0.6 });
}
/**
 * ANYTHING IN THIS CHAPTER THAT IS A LIGHT IS BUILT WITH THIS.
 *
 * A Lambert box in a night scene is lit by the ambient and nothing else, so
 * every lamp, sign, strip light and lit window in the first cut of this biome
 * rendered BLACK. The emissive term is what a light source actually is; it is
 * on MeshLambertMaterial, so this stays inside the aesthetic law, and it is a
 * uniform, which is why each colour needs its own material.
 * Not cached — several of these have their intensity written every frame.
 */
function hkGlowMat(color, intensity) {
  const m = mat(color, { emissive: color, emissiveIntensity: intensity || 1 }).clone();
  return m;
}
function hkSyncBody(b) {
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
  b.previousQuaternion.copy(b.quaternion);
  b.interpolatedQuaternion.copy(b.quaternion);
}
function hkStaticBox(game, x, y, z, sx, sy, sz, ry) {
  const b = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
  b.addShape(new CANNON.Box(new CANNON.Vec3(sx * 0.5, sy * 0.5, sz * 0.5)));
  b.position.set(x, y, z);
  if (ry) b.quaternion.setFromEuler(0, ry, 0);
  hkSyncBody(b);
  game.world.addBody(b);
  return b;
}

// ================================================================= TERRAIN ==
/**
 * A street is flat. That is not laziness, it is the point: this is a chapter
 * about the vertical axis, and putting relief in the horizontal one would make
 * both of them mush. The only thing that moves is the drop into the harbour.
 */
function hkTerrain(x, z) {
  if (z > hkPIER_Z) return 0;
  const t = clamp((hkPIER_Z - z) / 5, 0, 1);
  return lerp(0, hkHARBOUR_Y, t * t * (3 - 2 * t));
}
function hkSlope(x, z) {
  const e = 1.2;
  const dz = hkTerrain(x, z + e) - hkTerrain(x, z - e);
  return Math.atan(Math.abs(dz) / (2 * e));
}
/**
 * THE PIERS ARE NOT THE HARBOUR.
 *
 * This was a bare half-plane — `z < hkPIER_Z - 1.6` — which ignored the terrain
 * and, worse, ignored the two things standing in the water. The Star Ferry
 * pontoon runs from the apron out to hkPIER_END with its deck 5 cm under the
 * nominal waterline, and the far pontoon sits at hkFAR_PIER; both were inside
 * the half-plane, so solid planking reported as open sea. Measured: props left
 * on the planks read `inWater` false at 0.55 m of freeboard while the buoyancy
 * solver worked on them anyway, and capybara.js switches its analytic floor
 * backstop off wherever this is true — so the one walkway out of the chapter
 * was being run across on solver contacts alone.
 *
 * Now it is the terrain test every other biome uses, with the same 0.22 m of
 * slack, and the decking is carved out by name the way iceland.js carves out
 * its pier. hkTerrain is flat at 0 on the land side, so the slack is what keeps
 * the lip at the apron from reading as a hole.
 */
const hkPIER_HALF_X = 11.5;     // the pontoon is 22 m of planking plus a margin
function hkOnDecking(x, z) {
  if (Math.abs(x) < hkPIER_HALF_X && z < hkPIER_Z + 2 && z > hkPIER_END - 2.5) return true;
  if (Math.abs(x) < 7 && z < hkFAR_PIER + 5 && z > hkFAR_PIER - 5) return true;
  return false;
}
function hkIsOverWater(x, z) {
  if (hkOnDecking(x, z)) return false;
  return hkWaterHeightAt() > hkTerrain(x, z) + 0.22;
}
function hkWaterHeightAt() { return -0.5; }

// ==================================================================== ZONES =
function hkInZone(name, x, z) {
  if (name === 'street') return Math.abs(x) < hkFACE && z > hkST_Z0 && z < hkST_Z1;
  if (name === 'road') return Math.abs(x) < hkST_HALF && z > hkST_Z0 && z < hkST_Z1;
  if (name === 'market') {
    const dx = x - hkMARKET.x, dz = z - hkMARKET.z;
    return dx * dx + dz * dz < 13 * 13;
  }
  if (name === 'bakery') {
    // measured from the COUNTER, not from the shopfront behind it: the counter
    // is a solid box and it is the nearest a capybara can physically get
    const dx = x - (hkBAKERY.x + 0.6), dz = z - hkBAKERY.z;
    return dx * dx + dz * dz < hkBAKE_R * hkBAKE_R;
  }
  if (name === 'pier') return z < hkPIER_Z + 2 && z > hkPIER_END - 2 && Math.abs(x) < 11;
  if (name === 'harbour') return z < hkPIER_Z;
  if (name === 'scaffold') {
    return x > hkSCAF.x - 1 && x < hkSCAF.x + hkSCAF.out + 2.4 && z > hkSCAF.z0 - 1 && z < hkSCAF.z1 + 1;
  }
  // The big neon, which is a task you stand on. It had no zone, so the footfall
  // ladder's height fallback called it bamboo.
  if (name === 'sign') {
    return Math.abs(x - hkSIGN.x) < 4.2 && Math.abs(z - hkSIGN.z) < 2.6;
  }
  return false;
}
function hkNavBlocked(x, z, r) {
  const rr = r || 0.6;
  return Math.abs(x) > hkFACE - rr && z > hkST_Z0 && z < hkST_Z1;
}
function hkSurfacePitch(x, z, y) {
  if (y > hkROOF_Y - 1.5) return 1.14;                 // a concrete roof deck
  // THE HEIGHT FALLBACK IS A ONE-AXIS GUESS, so ask WHERE first. `y > 8` meant
  // bamboo, and the neon sign is steel and glass at y 9.2: standing on the sign
  // — a whole task — rang like a scaffold pole. Everything above eight metres
  // in this chapter is not lattice.
  if (hkInZone('sign', x, z)) return 1.36;             // steel angle and glass
  if (y > 8) return 1.30;                              // bamboo, and it rings
  if (hkInZone('pier', x, z)) return 1.24;             // the pontoon's planks
  if (hkInZone('market', x, z)) return 0.96;           // wet tile
  return 1.02;
}

// ============================================================== THE CLIMB ===
/**
 * The one hook this chapter exists for.
 *
 * Two faces: the big scaffold on the west side of the street, which goes to the
 * roof, and the short one on the east side, which is only there so the laundry
 * poles have a second landing and the player is never stuck on one of them.
 *
 * The reach band is 1.7 m rather than something tight, because the alternative
 * to a generous band is an animal that lets go halfway up for reasons the
 * player cannot see. `top` is where the lattice ends; capybara.js reads it and
 * shoves the last metre over the parapet, so topping out puts you ON the roof
 * instead of pawing at the last rung of it.
 */
function hkClimbHold(x, y, z) {
  // NO FLOOR GUARD. The first cut refused a hold below y 0.35, which is the
  // height a capybara STANDS at — so the one place a climb can possibly begin
  // was the one place it was forbidden, and the verb the chapter exists for
  // could not be started at all.
  if (y < -1.5) return null;
  // The big one: the outer face is at hkSCAF.x + out and the outward normal is
  // +x. The band runs THROUGH the wall behind it, because the cling pulls the
  // animal toward the face at capyCLIMB_STICK and the building's own collider
  // stops it half a metre further in — a band that ended at the face therefore
  // let go of the animal the instant it took hold, every time.
  const fx = hkSCAF.x + hkSCAF.out;
  if (y < hkSCAF.top + 0.6 && z > hkSCAF.z0 - 0.8 && z < hkSCAF.z1 + 0.8 &&
      x > fx - 2.6 && x < fx + 1.9) {
    hkHold.nx = 1; hkHold.nz = 0; hkHold.top = hkSCAF.top;
    return hkHold;
  }
  // the short one on the far pavement, outward normal −x
  const ex = hkFACE - 1.7;
  if (y < 12.2 && z > 0.4 && z < 11.6 && x < ex + 2.6 && x > ex - 1.9) {
    hkHold.nx = -1; hkHold.nz = 0; hkHold.top = 11.9;
    return hkHold;
  }
  return null;
}

// ============================================================== THE STREET ==
/**
 * Two rows of tong lau — six or seven storeys of shophouse with the shop at the
 * bottom and somebody's flat above it, cage on every window, air-conditioner
 * out of every second one. The blocks are DIFFERENT HEIGHTS and different
 * tiles, because the one thing a street like this is not is uniform, and a
 * uniform one at this camera angle is a corridor.
 */
// The two things on this street that are LIGHTS rather than surfaces and are
// not neon signs: the glazed shopfronts and the lit flats above them. Both are
// filled in hkBuildStreet and drawn from one unlit mesh at the end of it —
// x, y, z, sx, sy, sz, colour, seven at a time.
// The fascia over a Hong Kong shopfront is whatever colour that shop chose and
// there are four hundred of them on one street; two was a stripe.
const HK_FASCIA = [PALETTE.hkAwning, PALETTE.hkAwning2, PALETTE.hkTaxi,
                   PALETTE.hkNeonGold, PALETTE.hkTile3, PALETTE.hkNeonGreen,
                   PALETTE.hkFerryTrim, PALETTE.hkNeonBlue];
const hkSHOPLIT = [];
const hkFLATLIT = [];
// the two zebra crossings, and the signal heads on them. hkCROSS_LAMP is
// x, y, z per lamp: red first, green second, four poles a crossing.
// THE CROSSINGS ARE NOT WHERE THE SHOPS ARE. The first pair went in at z 26
// and −14, and 26 is the bakery: a signal pole at x −7.25 plus a counter that
// reaches −8.35 left fifteen centimetres of pavement, which is a wall.
// Street furniture and a shopfront are the two ends of the same three metres
// and they have to be put in knowing about each other.
const hkCROSS_Z = [44, -14];
const hkCROSS_LAMP = [];
let hkCrossMesh = null, hkCrossMat = null;
// the street lamps' own heads, which are what the pools on the tarmac hang off
const hkLAMP_HEAD = [];

function hkBuildStreet(game, root) {
  const M = hkMerger();
  const acs = [];
  const grilles = [];
  const tiles = [PALETTE.hkTile, PALETTE.hkTile2, PALETTE.hkTile3,
                 PALETTE.hkConcrete, PALETTE.hkConcreteDk];
  let seed = 8181;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }

  // WHAT WAS ACTUALLY DRAWN, so the colliders can be built from it rather than
  // from the loop's bound. See the collision block at the bottom.
  const runs = [[], []];        // per side: {z0, z1, h} for every block laid
  for (let side = -1; side <= 1; side += 2) {
    let z = hkST_Z1;
    while (z > hkST_Z0) {
      const d = 9 + rnd() * 5;
      const cz = z - d * 0.5;
      // the scaffolded block is a fixed height, because the roof is a place the
      // player has to be able to plan to get to
      // THE LANE TO THE WET MARKET. The east side is otherwise one unbroken
      // eighteen-metre-deep wall, and the market sits at x 29 — BEHIND it, with
      // no way in from the street at all. The chapter's fifth task was inside a
      // building. A gap in the row, and a matching gap in the collider below.
      if (side > 0 && cz > 11 && cz < 27) { z -= d; continue; }
      const onScaf = side < 0 && cz > hkSCAF.z0 - 2 && cz < hkSCAF.z1 + 2;
      const h = onScaf ? hkROOF_Y : 24 + rnd() * 22;
      const cx = side * (hkFACE + 9);
      const col = tiles[(z * 7 | 0) % tiles.length];
      runs[side > 0 ? 1 : 0].push({ z0: cz - (d - 0.6) * 0.5, z1: cz + (d - 0.6) * 0.5, h });
      M.box(cx, h * 0.5, cz, 18, h, d - 0.6, col);
      // THE CAP'S TOP IS THE ROOF, and the roof is `h`. Laid at h + 0.35 it
      // spanned h - 0.35 to h + 0.35, so the drawn surface was 35 cm above the
      // one the solver stands you on — on the one roof in the chapter the
      // player is sent to, the animal was ankle-deep in its own concrete.
      M.box(cx, h - 0.35, cz, 18.8, 0.7, d + 0.1, PALETTE.hkConcreteDk);
      // ---- THE SHOPFRONT WAS ONE FLAT BOX OF COLOUR --------------------
      // A hundred and six metres of street, both sides, and every ground
      // floor of it was a single 4.2 m band in one of two colours — so the
      // surface the player spends the entire chapter walking a metre and a
      // half from, at eye level, in the densest shopping street on earth, was
      // a painted wall. Measured off the frame: from the middle of the road
      // the bottom fifth of every shot was two unbroken slabs, one green and
      // one red.
      //
      // What a Mong Kok ground floor actually is, and it is five things:
      //   a DARK RECESS three quarters of a metre back;
      //   a GLAZED FRONT that is LIT — brighter than the street, which is the
      //     only reason a shopfront reads at night at all (and which means it
      //     is a MeshBasicMaterial, for the sixth time in this chapter);
      //   a DOOR, off-centre, standing open;
      //   GOODS out over the kerb, because they all are;
      //   a FASCIA over the top of it in the shop's own colour.
      // One shop in five is shut, and a shut shop is a corrugated roller
      // shutter, which is half of what that street looks like after ten.
      {
        const shut = rnd() < 0.22;
        const fascia = HK_FASCIA[(z * 5 | 0) % HK_FASCIA.length];
        const dz2 = d - 1.4;
        // ---- THE LAYERS HAVE TO GO IN THE RIGHT ORDER ---------------------
        // The collider for both rows starts at hkFACE − 0.7 (it is built from
        // the runs, see the block at the end), so EVERYTHING the shop is made
        // of has to live in the 70 cm between hkFACE − 0.7 and hkFACE or it is
        // either buried in the wall or standing proud of the solid — which is
        // the exact bug that put the animal inside the shop it was walking
        // past in August. Back plane at −0.22, glass at −0.60, and the goods
        // are the only thing outside it, at 36 cm, which is under the 40 the
        // capybara steps over.
        M.box(side * (hkFACE - 0.22), 1.9, cz, 0.30, 3.8, dz2, 0x14161a);
        M.box(side * (hkFACE - 0.12), 1.9, cz + dz2 * 0.5, 0.3, 3.8, 0.5, PALETTE.hkConcreteDk);
        M.box(side * (hkFACE - 0.12), 1.9, cz - dz2 * 0.5, 0.3, 3.8, 0.5, PALETTE.hkConcreteDk);
        M.box(side * (hkFACE - 0.12), 3.9, cz, 0.3, 0.5, dz2 + 1.0, PALETTE.hkConcreteDk);
        // the fascia, and the bracket sign that hangs off the end of it
        M.box(side * (hkFACE - 0.2), 4.55, cz, 0.5, 0.85, dz2 + 0.8, fascia);
        M.box(side * (hkFACE - 1.5), 4.9, cz, 2.7, 0.2, dz2 + 0.8, PALETTE.hkConcreteDk);
        if (shut) {
          // a roller shutter: nine corrugations, and a padlock bar across it
          for (let k = 0; k < 9; k++) {
            M.box(side * (hkFACE - 0.56 - (k % 2) * 0.06), 0.42 + k * 0.4, cz,
                  0.12, 0.34, dz2 - 0.2, PALETTE.hkGrille);
          }
          M.box(side * (hkFACE - 0.66), 1.1, cz, 0.1, 0.16, dz2 - 0.4, PALETTE.hkPoleSteel);
          // and somebody has flyposted it, which is the only colour on a
          // closed shop
          for (let k = 0; k < 3; k++) {
            M.box(side * (hkFACE - 0.70), 1.4 + k * 0.6, cz + (k - 1) * 1.4,
                  0.06, 0.5, 0.36, k % 2 ? PALETTE.hkNeonWhite : PALETTE.hkTaxi);
          }
        } else {
          // the lit glazing — three bays of it, on hkSHOPLIT
          for (let k = -1; k <= 1; k++) {
            if (k === 0) continue;
            hkSHOPLIT.push(side * (hkFACE - 0.60), 1.95, cz + k * dz2 * 0.28,
                           0.12, 2.5, dz2 * 0.4,
                           [0xe6d8b4, 0xe8cfa0, 0xcfe4d6][(z * 3 | 0) % 3]);
            // and the mullion between them
            M.box(side * (hkFACE - 0.58), 1.95, cz + k * dz2 * 0.5, 0.18, 2.7, 0.18,
                  PALETTE.hkPoleSteel);
            // ---- SOMETHING IN THE WINDOW ------------------------------
            // A lit panel with nothing in front of it is a lightbox, and
            // sixty lightboxes down a street is an airport. Everything in
            // this chapter that is NOT a light renders dark, which makes the
            // ordinary merged mesh a free silhouette: a counter across the
            // bottom, two racks up the middle and three things on a shelf.
            // The whole read of a shop is what is standing in front of the
            // light, and it costs six boxes.
            const gz2 = cz + k * dz2 * 0.28;
            const gw2 = dz2 * 0.38;
            // A COUNTER AND TWO SHELVES, NOT A LATTICE. The first cut ran two
            // full-height uprights through a horizontal bar, which against a
            // lit pane is a cross — sixty of them down a street, and every shop
            // window in Mong Kok looked like a chapel. What a shopfront
            // actually silhouettes as is one solid mass at waist height with
            // stuff stacked on it and a couple of shelves in the top third.
            M.box(side * (hkFACE - 0.69), 0.62, gz2, 0.16, 1.24, gw2, PALETTE.hkConcreteDk);
            for (let q = -1; q <= 1; q++) {
              M.box(side * (hkFACE - 0.69), 1.44 + (q & 1 ? 0.1 : 0), gz2 + q * gw2 * 0.3,
                    0.18, 0.42, gw2 * 0.24, PALETTE.hkGrille);
            }
            for (let q = 0; q < 2; q++) {
              const sy = 2.36 + q * 0.62;
              M.box(side * (hkFACE - 0.69), sy, gz2, 0.14, 0.08, gw2 * 0.95, PALETTE.hkGrille);
              for (let r2 = -1; r2 <= 1; r2++) {
                M.box(side * (hkFACE - 0.69), sy + 0.24, gz2 + r2 * gw2 * 0.3,
                      0.16, 0.4, gw2 * 0.2, PALETTE.hkConcreteDk);
              }
            }
          }
          // the door, open, with the dark of a stairwell behind it
          M.box(side * (hkFACE - 0.58), 1.35, cz, 0.18, 2.7, 1.3, PALETTE.hkPoleSteel);
          M.box(side * (hkFACE - 0.46), 1.35, cz, 0.14, 2.5, 1.0, 0x0d0f12);
          // GOODS OVER THE KERB. Thirty-five centimetres, because the animal
          // steps over forty and the whole width of that pavement is the way
          // to the pier — the dai pai dong learned this the expensive way.
          const gn = 2 + (rnd() * 3 | 0);
          for (let k = 0; k < gn; k++) {
            const gz = cz + (k - (gn - 1) * 0.5) * 1.5;
            M.box(side * (hkFACE - 1.15), 0.18, gz, 1.1, 0.36, 1.1, PALETTE.hkCrate);
            for (let q = 0; q < 3; q++) {
              M.box(side * (hkFACE - 1.15) + (q - 1) * 0.1, 0.46, gz + (q - 1) * 0.3,
                    0.34, 0.24, 0.34,
                    [PALETTE.hkTaxi, PALETTE.hkNeonGreen, PALETTE.hkNeonGold,
                     PALETTE.hkTile3][(k + q + (z | 0)) % 4]);
            }
          }
          // a price board leaning on the front, in the yellow they all are
          M.box(side * (hkFACE - 1.05), 0.8, cz + dz2 * 0.42, 0.08, 1.2, 0.8,
                PALETTE.hkNeonGold, 0, 0, side * 0.12);
        }
      }
      // windows and their cages, all the way up
      const floors = Math.floor((h - 6) / 3.2);
      for (let f = 0; f < floors; f++) {
        const y = 6.4 + f * 3.2;
        for (let k = -1; k <= 1; k++) {
          const wz = cz + k * (d * 0.28);
          grilles.push(side * (hkFACE - 0.06), y, wz, 0, 0, 0, 0.12, 1.7, 1.5);
          if ((f + k) % 2 === 0) {
            acs.push(side * (hkFACE - 0.55), y - 0.75, wz, 0, 0, 0, 1.0, 0.7, 0.9);
            // ---- AND IT DRIPS ON YOU -----------------------------------
            // Ninety split units hung over a pavement four metres wide, and
            // every one of them bone dry. Ask anybody who has walked down Fa
            // Yuen Street what the street DOES and this is the answer before
            // the neon is: the whole elevation is plumbed with condensate and
            // none of it goes anywhere except onto the person underneath.
            //
            // Only the low ones — under about fourteen metres, so the drop is
            // legible against the shopfront light rather than falling out of a
            // black sky — and only every third, or the street is a car wash.
            // Collected here because the positions already exist; building
            // them a second time from a different loop is how two things that
            // are supposed to be in the same place stop being.
            if (y < 14 && hkDRIP_AT.length < hkDRIP_N * 3 && (f + k + (z | 0)) % 3 === 0) {
              hkDRIP_AT.push(side * (hkFACE - 0.55), y - 1.12, wz);
            }
          }
          // ---- SOMEBODY IS IN, AND THE WINDOW SAYS SO --------------------
          // Every tong lau on this street was a dark tower with a grille on
          // every window, forty metres of it, on both sides — while a hundred
          // and thirty metres away the far shore was a grid of lit windows and
          // therefore the only thing in the frame that read as a CITY. Half
          // the flats have the light on, and one lit window in a black wall
          // does more for a night street than any number of signs.
          if (((f * 5 + k * 3 + (z | 0)) % 7) < 3) {
            hkFLATLIT.push(side * (hkFACE - 0.14), y, wz, 0.1, 1.45, 1.25,
                           [0xffe0a4, 0xdfe9ff, 0xffeccc, 0xbfe2c8][(f + k + (z | 0)) % 4]);
          }
          // ---- AND A BAMBOO DRYING RACK OUT OF ONE IN FIVE --------------
          // The single most characteristic thing about the elevation of a Hong
          // Kong tenement, and this street's whole vertical surface had
          // nothing on it but grilles and air-conditioners.
          if (((f * 3 + k + (z | 0)) % 5) === 0 && f > 0) {
            const rx2 = side * (hkFACE + 0.9);
            M.cyl(rx2, y + 0.5, wz, 0.045, 2.4, PALETTE.hkBamboo, 0, 0, Math.PI * 0.5, 6);
            for (let q = 0; q < 3; q++) {
              M.box(side * (hkFACE + 0.35 + q * 0.5), y - 0.02, wz, 0.06, 0.9, 0.5,
                    [PALETTE.hkLaundry, PALETTE.hkNeonCyan, PALETTE.hkTaxi,
                     PALETTE.hkAwning][(f + q + k + 2) % 4]);
            }
          }
        }
      }
      // the roof clutter, which is half of what a Hong Kong roof IS
      const tanks = 2 + (rnd() * 3 | 0);
      for (let t = 0; t < tanks; t++) {
        M.cyl(cx + rand(-6, 6), h + 1.5, cz + rand(-3, 3), 1.15, 2.2,
              PALETTE.hkConcrete, 0, 0, 0, 8);
      }
      for (let t = 0; t < 3; t++) {
        M.box(cx + rand(-7, 7), h + 2.4, cz + rand(-3.5, 3.5), 0.1, 4.4, 0.1, PALETTE.hkPoleSteel);
      }
      z -= d;
    }
  }

  // ---- the road ------------------------------------------------------------
  M.box(0, -0.02, (hkST_Z0 + hkST_Z1) * 0.5, hkST_HALF * 2, 0.06, hkST_Z1 - hkST_Z0, PALETTE.hkWet);
  for (let i = 0; i < 22; i++) {
    const z = hkST_Z0 + 3 + i * ((hkST_Z1 - hkST_Z0 - 6) / 21);
    M.box(0, 0.03, z, 0.4, 0.05, 2.4, PALETTE.hkLaundry);
  }
  // kerbs, so the pavement reads as a pavement
  for (let side = -1; side <= 1; side += 2) {
    M.box(side * hkST_HALF, 0.09, (hkST_Z0 + hkST_Z1) * 0.5, 0.5, 0.24,
          hkST_Z1 - hkST_Z0, PALETTE.hkConcrete);
  }

  // ---- THE STREET HAD NO STREET ON IT --------------------------------------
  // A hundred and six metres of Mong Kok with two rows of shops, ninety signs,
  // a scaffold and eighty people walking, and the ROAD between them carried a
  // centre line, three parked taxis and nothing else at all. Everything below
  // is the furniture that says a road is a road rather than a corridor — and
  // every one of them is under 45 cm or is a pole, so nothing new blocks that
  // pavement, which is the mistake this chapter has already made twice.
  //
  // The crossing is the one that matters. Hong Kong's pedestrian signals make
  // a sound nobody who has been there forgets — a slow tick that goes into a
  // burst when the green man comes on — and it is in hkUpdateCrossing.
  // ---- AND ALL OF IT IS SOLID ---------------------------------------------
  // A guard rail a metre high that you walk through is the forty-two
  // centimetre problem again (Sydney's bollards, Venice's rio wall): too tall
  // to step over, too short to read as a building, and therefore exactly the
  // size of thing that looks like a bug. Same for an eight-metre lamp post.
  // ONE COMPOUND BODY for the whole street — twenty-odd shapes and one
  // broadphase entry, which is the rule this chapter's two tong lau rows and
  // its twelve market posts are already on.
  const furn = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
  const fsolid = (x, y, z, sx, sy, sz) => {
    furn.addShape(new CANNON.Box(new CANNON.Vec3(sx * 0.5, sy * 0.5, sz * 0.5)),
                  new CANNON.Vec3(x, y, z));
  };
  for (let ci = 0; ci < hkCROSS_Z.length; ci++) {
    const cz2 = hkCROSS_Z[ci];
    // the zebra itself, eight bars across the carriageway
    for (let k = 0; k < 8; k++) {
      M.box(-hkST_HALF + 0.9 + k * ((hkST_HALF * 2 - 1.8) / 7), 0.035, cz2,
            0.62, 0.05, 3.2, PALETTE.hkLaundry);
    }
    // the give-way bars either side of it
    for (let s2 = -1; s2 <= 1; s2 += 2) {
      M.box(0, 0.035, cz2 + s2 * 2.4, hkST_HALF * 2 - 0.6, 0.05, 0.22, PALETTE.hkLaundry);
    }
    for (let s2 = -1; s2 <= 1; s2 += 2) {
      const px2 = s2 * (hkST_HALF + 0.75);
      // the pole, the signal head, and the little box with the button on it
      M.cyl(px2, 1.7, cz2 + 1.9, 0.075, 3.4, PALETTE.hkPoleSteel, 0, 0, 0, 6);
      M.box(px2, 3.35, cz2 + 1.9, 0.34, 0.95, 0.42, PALETTE.hkGrille);
      M.box(px2, 2.3, cz2 + 1.9, 0.24, 0.34, 0.3, PALETTE.hkGrille);
      M.box(px2 - s2 * 0.14, 2.3, cz2 + 1.9, 0.06, 0.16, 0.16, PALETTE.hkNeonGold);
      // the striped guard rail that runs along the kerb at every crossing here
      for (let k = 0; k < 5; k++) {
        const gz2 = cz2 + 3.0 + k * 1.5;
        M.cyl(px2, 0.5, gz2, 0.05, 1.0, PALETTE.hkPoleSteel, 0, 0, 0, 6);
      }
      M.box(px2, 0.92, cz2 + 5.9, 0.1, 0.1, 6.6, PALETTE.hkPoleSteel);
      M.box(px2, 0.6, cz2 + 5.9, 0.08, 0.1, 6.6, PALETTE.hkPoleSteel);
      fsolid(px2, 1.7, cz2 + 1.9, 0.3, 3.4, 0.3);                 // the signal pole
      fsolid(px2, 0.5, cz2 + 5.9, 0.24, 1.0, 6.9);                // and the rail
      // the green/red man, which is a LIGHT and is the whole point of the pole
      hkCROSS_LAMP.push(px2 - s2 * 0.18, 3.55, cz2 + 1.9);
      hkCROSS_LAMP.push(px2 - s2 * 0.18, 3.15, cz2 + 1.9);
    }
  }
  // litter bins, a postbox and two street lamps, all on the kerb line
  for (let bi = 0; bi < 6; bi++) {
    const s2 = bi % 2 ? 1 : -1;
    const bz2 = hkST_Z0 + 12 + bi * 16;
    M.cyl(s2 * (hkST_HALF + 0.75), 0.42, bz2, 0.34, 0.84, PALETTE.hkFerryTrim, 0, 0, 0, 8);
    M.cyl(s2 * (hkST_HALF + 0.75), 0.9, bz2, 0.36, 0.14, PALETTE.hkGrille, 0, 0, 0, 8);
    M.box(s2 * (hkST_HALF + 0.75), 0.9, bz2, 0.34, 0.16, 0.5, 0x14161a);
    fsolid(s2 * (hkST_HALF + 0.75), 0.48, bz2, 0.72, 0.96, 0.72);
  }
  for (let li = 0; li < 5; li++) {
    const s2 = li % 2 ? 1 : -1;
    const lz2 = hkST_Z0 + 6 + li * 22;
    M.cyl(s2 * (hkST_HALF + 0.65), 4.2, lz2, 0.09, 8.4, PALETTE.hkPoleSteel, 0, 0, 0, 6);
    M.box(s2 * (hkST_HALF + 0.65) - s2 * 0.7, 8.3, lz2, 1.5, 0.12, 0.12, PALETTE.hkPoleSteel);
    M.box(s2 * (hkST_HALF + 0.65) - s2 * 1.4, 8.15, lz2, 0.75, 0.26, 0.4, PALETTE.hkGrille);
    fsolid(s2 * (hkST_HALF + 0.65), 1.6, lz2, 0.3, 3.2, 0.3);
    hkLAMP_HEAD.push(s2 * (hkST_HALF + 0.65) - s2 * 1.4, 8.0, lz2);
  }
  // the bus stop: a pole, a flag and a rail, at the middle stop
  {
    const sz2 = 12;
    M.cyl(hkST_HALF + 0.75, 1.5, sz2, 0.07, 3.0, PALETTE.hkPoleSteel, 0, 0, 0, 6);
    M.box(hkST_HALF + 0.75, 2.85, sz2, 0.1, 0.62, 0.95, PALETTE.hkTaxi);
    M.box(hkST_HALF + 0.70, 2.85, sz2, 0.1, 0.4, 0.7, PALETTE.hkLaundry);
    M.box(hkST_HALF + 0.75, 1.8, sz2, 0.09, 0.7, 0.5, PALETTE.hkNeonGold);
    fsolid(hkST_HALF + 0.75, 1.5, sz2, 0.28, 3.0, 0.28);
  }
  hkSyncBody(furn);
  game.world.addBody(furn);

  // ---- a couple of red taxis, parked, because they always are ---------------
  // ---- AND THEY ARE PARKED IN THE ROAD, NOT ON THE PAVEMENT --------------
  // At x ±6.4 a 2.1 m taxi straddles a kerb at ±6.5, so half of every parked
  // car was on the footway. Harmless on its own — and then the bakery counter
  // was rebuilt against the shopfront and the taxi outside it turned five
  // metres of the west pavement into a slot 0.0 m wide, with the chapter's
  // first task at the end of it. Measured with qa/wn-clear.js, which scans the
  // walkable width of both pavements every half metre and is the only reason
  // this was ever visible: a solidity audit says 'is it solid' and a driven
  // walk says 'can I get past THIS way'; neither of them says 'is there a
  // continuous corridor at all'.
  const taxis = [[-5.2, 30, 0], [5.0, 12, Math.PI], [-5.2, -18, 0]];
  for (let i = 0; i < taxis.length; i++) {
    const tx = taxis[i][0], tz = taxis[i][1], ty = taxis[i][2];
    M.box(tx, 0.72, tz, 1.9, 0.9, 4.4, PALETTE.hkTaxi, 0, ty);
    M.box(tx, 1.42, tz - 0.2, 1.7, 0.7, 2.2, PALETTE.hkTaxiRoof, 0, ty);
    M.box(tx, 1.82, tz - 0.2, 0.5, 0.16, 0.9, PALETTE.hkNeonGold, 0, ty);
    for (let w = 0; w < 4; w++) {
      M.cyl(tx + (w & 1 ? 0.95 : -0.95), 0.34, tz + (w & 2 ? 1.5 : -1.5), 0.34, 0.3,
            PALETTE.hkGrille, 0, 0, Math.PI * 0.5, 6);
    }
    hkStaticBox(game, tx, 0.8, tz, 2.1, 1.6, 4.6, ty);
  }

  const mesh = new THREE.Mesh(M.build(), hkVC());
  mesh.castShadow = true; mesh.receiveShadow = true;
  root.add(mesh);

  const im = new THREE.InstancedMesh(hkG.box, mat(PALETTE.hkGrille), grilles.length / 9);
  for (let i = 0; i < grilles.length / 9; i++) {
    const o = i * 9;
    im.setMatrixAt(i, hkXform(grilles[o], grilles[o + 1], grilles[o + 2], 0, 0, 0,
                              grilles[o + 6], grilles[o + 7], grilles[o + 8]));
  }
  im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
  root.add(im);

  const ia = new THREE.InstancedMesh(hkG.box, mat(PALETTE.hkPoleSteel), acs.length / 9);
  for (let i = 0; i < acs.length / 9; i++) {
    const o = i * 9;
    ia.setMatrixAt(i, hkXform(acs[o], acs[o + 1], acs[o + 2], 0, 0, 0,
                              acs[o + 6], acs[o + 7], acs[o + 8]));
  }
  ia.instanceMatrix.needsUpdate = true; ia.computeBoundingSphere();
  ia.castShadow = true;
  root.add(ia);

  // ---- collision: two long walls, not eighteen blocks ----------------------
  // The player can never get behind the façades, so the whole of both sides is
  // one box each. Eighteen bodies to express a straight line is eighteen bodies
  // the broadphase has to think about for no gameplay at all.
  // west side: one wall. East side: two, with the market lane between them.
  // ...except over the scaffolded block, where the wall has to STOP AT THE
  // ROOF. One 48 m box for the whole west side put solid geometry from the
  // paving to y = 48 across x -31.5..-13.5, and the roof deck the scaffold
  // exists to reach tops out at 34.2 — so all but a metre of the chapter's
  // payoff, and the parapet, the water tanks and the washing line on it, were
  // buried inside the façade. Topping out shoves the animal INTO that wall.
  // Three boxes: full height either side of the scaffolded bay, roof height
  // across it.
  // ONE BODY PER BLOCK ACTUALLY LAID, and it is the third time this game has
  // learned the same lesson (Pasto's terraces, Sydney's bollards). Three things
  // were wrong with the four long boxes that used to be here, and all three
  // came from describing the drawing instead of reading it:
  //
  //  1. THE ROWS OVERRUN THEIR OWN LOOP. `while (z > hkST_Z0)` starts a block
  //     whose far edge is up to fourteen metres further on, so the west row is
  //     drawn to z = -49.4 and the east to -46.2 while the wall stopped at -44.
  //     Five and a half metres of tong lau you walked straight through, on the
  //     approach to the pier, which is the way out of the chapter.
  //  2. THE MARKET LANE DID NOT LINE UP. The drawn gap is wherever a block
  //     CENTRE fell between z 11 and 27, which is an opening from 6.5 to 28.1;
  //     the collider gap was 11 to 27. Four and a half metres of invisible wall
  //     across the mouth of the lane, and one metre at the other end.
  //  3. THE SHOPFRONT IS 70 CM PROUD OF THE WALL. The bright band at street
  //     level is drawn from hkFACE - 0.7 and the collider started at hkFACE, so
  //     at the one height the player actually is, the animal stood inside the
  //     shop it was walking past.
  //
  // Two compound bodies — one per side — so this is two broadphase entries for
  // eighteen blocks, which is what the four boxes were for in the first place.
  for (let si = 0; si < 2; si++) {
    const side = si ? 1 : -1;
    const b = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
    for (const r of runs[si]) {
      const h = Math.max(r.h, 1);
      b.addShape(new CANNON.Box(new CANNON.Vec3(9.35, h * 0.5, (r.z1 - r.z0) * 0.5)),
                 new CANNON.Vec3(side * (hkFACE + 8.65), h * 0.5, (r.z0 + r.z1) * 0.5));
    }
    hkSyncBody(b);
    game.world.addBody(b);
  }
  // and the two ends of the street
  hkStaticBox(game, 0, 12, hkST_Z1 + 2, hkFACE * 2, 24, 4);
}

// =========================================================== THE CROSSING ===
/**
 * THE SOUND OF HONG KONG, and this chapter did not have it.
 *
 * Every pedestrian signal in the city ticks. Slowly, about twice a second,
 * while the man is red — and the moment he goes green it accelerates into a
 * fast rattling burst that you can hear three streets away and that anybody
 * who has been there recognises before they recognise the skyline. It is the
 * one piece of audio this street was actually missing: the chapter had a
 * ferry horn, a bus door, a wok and a drum, and a hundred and six metres of
 * road with a crowd walking down it in silence.
 *
 * It is on a real cycle — 21 s red, 9 s green — which means:
 *   the LIGHT and the SOUND are the same clock, so the burst always lands on
 *     the green man rather than near him;
 *   the CROWD can read it, and does: hkUpdateCrowd holds anybody inside two
 *     metres of the kerb at a red, which is what a crossing is;
 *   and the tick is distance-scaled, so it is a texture at forty metres and
 *     an event at four.
 */
// SIX AND A HALF SECONDS OF GREEN, NOT NINE, and the burst is on the sfx
// throttle rather than under it. Measured over a real forty-four second soak
// the first cut asked for 366 ticks — of which a third were dropped by the
// dispatcher unheard, and the rest were nine solid seconds of rattle every
// half minute at forty-six metres. It is the sound of the city and it has to
// be there; it is not a car alarm. 0.12 is exactly sfxGap.tick, so every call
// lands, and the range is a street corner rather than the whole street.
const hkX_RED = 21.0, hkX_GREEN = 6.5;
let hkCrossT = 4.0;
let hkCrossTick = 0;
function hkCrossGreen() { return hkCrossT >= hkX_RED; }

function hkBuildCrossing(root) {
  if (!hkCROSS_LAMP.length) return;
  const M = hkMerger();
  for (let i = 0; i < hkCROSS_LAMP.length; i += 3) {
    // the pair is red then green, and a signal head is a little standing
    // figure rather than a disc — which is the only reason anybody calls it
    // 'the green man'
    const red = (i / 3) % 2 === 0;
    const c = red ? 0xff5a4a : 0x5ce07a;
    const y = hkCROSS_LAMP[i + 1];
    M.box(hkCROSS_LAMP[i], y, hkCROSS_LAMP[i + 2], 0.05, 0.16, 0.1, c);
    M.box(hkCROSS_LAMP[i], y + 0.13, hkCROSS_LAMP[i + 2], 0.05, 0.07, 0.07, c);
    M.box(hkCROSS_LAMP[i], y - 0.02, hkCROSS_LAMP[i + 2], 0.05, 0.07, 0.19, c,
          0, 0, red ? 0 : 0.4);
  }
  hkCrossMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 1 });
  const m = new THREE.Mesh(M.build(), hkCrossMat);
  m.frustumCulled = false;
  root.add(m);
  hkCrossMesh = m;
  // one pool of light per street lamp, on the wet road under it — the same
  // instrument as the neon pools, and the reason the pavement is not black
  // between the signs
  if (hkLAMP_HEAD.length) {
    const G = hkMerger();
    const c = new THREE.Color();
    for (let i = 0; i < hkLAMP_HEAD.length; i += 3) {
      for (let r = 3; r >= 0; r--) {
        const u = (r + 1) / 4;
        c.set(0xffe0a8).multiplyScalar((1 - u) * (1 - u) * 0.9 + 0.1);
        G.cyl(hkLAMP_HEAD[i], 0.01 - r * 0.002, hkLAMP_HEAD[i + 2], 4.2 * u, 0.02,
              '#' + c.getHexString(), 0, 0, 0, 16);
      }
    }
    const gm = new THREE.Mesh(G.build(), new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.10,
      depthWrite: false, blending: THREE.AdditiveBlending }));
    gm.position.y = 0.045;
    gm.renderOrder = 2;
    gm.frustumCulled = false;
    root.add(gm);
  }
}

function hkUpdateCrossing(game, dt) {
  hkCrossT += dt;
  if (hkCrossT >= hkX_RED + hkX_GREEN) hkCrossT -= hkX_RED + hkX_GREEN;
  const green = hkCrossGreen();
  // the head: the red man is on OR the green man is, never both and never
  // neither, and the green one blinks for the last two seconds of its window
  if (hkCrossMesh && hkCrossMat) {
    const flash = green && hkCrossT > hkX_RED + hkX_GREEN - 2.4
                  ? (Math.sin(hkCrossT * 22) > 0 ? 1 : 0.15) : 1;
    const col = hkCrossMesh.geometry.getAttribute('color');
    // one write per state change rather than per frame: 96 vertices, but it is
    // still 96 writes a frame for a thing that changes twice every thirty
    // seconds
    if (hkCrossMesh.userData.g !== green || hkCrossMesh.userData.f !== flash) {
      hkCrossMesh.userData.g = green;
      hkCrossMesh.userData.f = flash;
      const per = col.count / (hkCROSS_LAMP.length / 3);
      for (let i = 0; i < hkCROSS_LAMP.length / 3; i++) {
        const red = i % 2 === 0;
        const on = red ? !green : green;
        const k = on ? (red ? 1 : flash) : 0.055;
        const base = red ? [1.0, 0.35, 0.29] : [0.36, 0.88, 0.48];
        for (let v = 0; v < per; v++) {
          col.setXYZ(i * per + v, base[0] * k, base[1] * k, base[2] * k);
        }
      }
      col.needsUpdate = true;
    }
  }
  // ---- and the sound -------------------------------------------------------
  const cp = game.capy && game.capy.position;
  if (!cp) return;
  let near = 1e9;
  for (let i = 0; i < hkCROSS_Z.length; i++) {
    const d = Math.hypot(cp.x, cp.z - hkCROSS_Z[i]);
    if (d < near) near = d;
  }
  if (near > 34) return;
  hkCrossTick -= dt;
  if (hkCrossTick > 0) return;
  // A BURST, NOT A FASTER TICK. The green phase is not the red tick sped up —
  // it is a rattle, and the difference between 0.52 s and 0.085 s is the
  // difference between a clock and the actual noise.
  hkCrossTick = green ? 0.125 : 1.05;
  const v = clamp(0.24 - near * 0.0055, 0.02, 0.24) * (green ? 1 : 0.66);
  hkSfx('tick', { volume: v, pitch: green ? 1.55 : 1.18 });
}

/**
 * EVERY LIT PANE IN THE CHAPTER THAT IS NOT A NEON SIGN, in one draw call.
 *
 * A shop window, a flat with the light on, the hut on the roof and the red
 * light on its mast are all the same thing: a surface that is BRIGHTER than
 * the night round it. That means MeshBasicMaterial, for the sixth time in this
 * file, and it means one mesh — but it also means this cannot run inside
 * hkBuildStreet, because the roof (hkBuildScaffold) and the market both want
 * to add to the same list and both run afterwards. Called last from hkBuild.
 */
function hkBuildLitPanes(root) {
  if (!hkSHOPLIT.length && !hkFLATLIT.length) return;
  const L = hkMerger();
  const put = (a) => {
    for (let i = 0; i < a.length; i += 7) {
      L.box(a[i], a[i + 1], a[i + 2], a[i + 3], a[i + 4], a[i + 5], a[i + 6]);
    }
  };
  put(hkSHOPLIT);
  put(hkFLATLIT);
  const lm = new THREE.Mesh(L.build(), new THREE.MeshBasicMaterial({ vertexColors: true }));
  lm.frustumCulled = false;
  root.add(lm);
}

// ============================================================ THE SCAFFOLD ==
/**
 * Bamboo. Verticals, ledgers, diagonals and a working deck every eight metres,
 * lashed with nylon at every crossing — which is genuinely how it is done, and
 * the lashings are what make it read as bamboo rather than as a ladder.
 *
 * The DECKS are the only part with collision. The lattice itself is climbed via
 * climbHold() above rather than by contact, because a solver-driven climb up a
 * grid of 60 mm poles is a physics problem nobody wants and a velocity solve
 * against a plane is a physics problem that works.
 */
function hkBuildScaffold(game, root) {
  const M = hkMerger();
  const lash = [];
  const x0 = hkSCAF.x, out = hkSCAF.out;
  const z0 = hkSCAF.z0, z1 = hkSCAF.z1;
  const nz = 7;
  const nBay = 12;
  const bayH = hkSCAF.top / nBay;

  // verticals: two rows, front and back
  for (let i = 0; i <= nz; i++) {
    const z = lerp(z0, z1, i / nz);
    for (let r = 0; r < 2; r++) {
      const x = x0 + (r ? out : 0.35);
      M.cyl(x, hkSCAF.top * 0.5, z, 0.055, hkSCAF.top, r ? PALETTE.hkBamboo : PALETTE.hkBambooDk,
            0, 0, 0, 6);
    }
  }
  // ledgers (horizontal, along z) and transoms (across, into the wall)
  for (let b = 0; b <= nBay; b++) {
    const y = b * bayH;
    for (let r = 0; r < 2; r++) {
      const x = x0 + (r ? out : 0.35);
      M.cyl(x, y, (z0 + z1) * 0.5, 0.05, z1 - z0, PALETTE.hkBamboo, Math.PI * 0.5, 0, 0, 6);
    }
    for (let i = 0; i <= nz; i++) {
      const z = lerp(z0, z1, i / nz);
      M.cyl(x0 + out * 0.5 + 0.17, y, z, 0.05, out - 0.35, PALETTE.hkBambooDk, 0, 0, Math.PI * 0.5, 6);
      lash.push(x0 + out, y, z, 0, 0, 0, 0.19, 0.19, 0.19);
      lash.push(x0 + 0.35, y, z, 0, 0, 0, 0.17, 0.17, 0.17);
    }
    // a diagonal every other bay — this is the thing that makes a scaffold
    // stiff, and the thing that makes it look like a scaffold
    if (b < nBay && b % 2 === 0) {
      const len = Math.hypot(bayH, z1 - z0);
      M.cyl(x0 + out, y + bayH * 0.5, (z0 + z1) * 0.5, 0.045, len, PALETTE.hkBambooDk,
            Math.atan2(z1 - z0, bayH), 0, 0, 6);
    }
  }
  // working decks: four planks wide, every three bays, and these are solid
  // A DECK EVERY TWO BAYS, NOT EVERY THREE. Twelve bays over 34.8 m is 2.9 m a
  // bay, so every third bay put decks at 8.7, 17.4, 26.1 — and the laundry poles
  // are at 11.4, which is between two of them with nothing to step off. The
  // chapter's fourth task was reachable only by kicking off the wall and hoping.
  // ---- THE DECKS HAVE A LADDER HOLE IN THEM -------------------------------
  // A working deck spanning the whole bay is a CEILING. The cling pulls the
  // animal toward the wall and the deck is directly over it, so the very first
  // one stops the climb dead — measured, the ascent stalled at 5.4 m against a
  // deck at 5.8, held there for half a second and then dropped. Every real
  // scaffold has a hole in every deck for exactly this reason, and it also
  // happens to be the only readable answer: the gap is drawn, so you can see it.
  //
  // It sits at the middle of the run and it is 3.4 m across, which is generous:
  // the beacon for the climb points at z = 0, so a player who walks to where
  // the game is pointing is standing in the hole without having to notice it.
  const deckAt = [];
  for (let b = 2; b <= nBay; b += 2) {
    const y = b * bayH;
    const zc = (z0 + z1) * 0.5;
    // THE TOP DECK IS NOT A LADDER HOLE. Every working scaffold needs a way up
    // through its decks, and the hole is cut at the middle of the run so the
    // player stands in it without having to notice — but cutting it through the
    // TOPMOST deck as well leaves the shaft with no lid, and the task beacon
    // points at exactly that midpoint. A player who climbs where the game
    // points topped out over an open hole at 34.8 m.
    const HOLE = (b === nBay) ? 0 : 2.2;
    if (b === nBay) {
      // ---- AND CLOSING THE TOP HOLE PUT A LID ON THE CLIMB ------------------
      // The note above is right that the topmost deck cannot be a shaft with no
      // lid — and closing it made this deck a continuous 3.4 m plank from
      // x −10.75 to −7.35 at y 34.68…34.92, which is directly over the face the
      // chapter's own climb goes up. Measured: the animal ascends at x −9.07,
      // its head meets the deck's underside at 34.68, the climb tops out at
      // 34.365 and it is then holding on 0.63 m east of the roof's edge with
      // nothing under it. That is the whole of "the roof is 0.65 m out of
      // reach", and it is a HEIGHT, not a distance — hkSCAF.top is innocent and
      // stays at 34.8.
      //
      // So the hole moves rather than closing: the ladder hole is cut along the
      // OUTER FACE, where a climber actually arrives, instead of across the
      // middle where the beacon points. The deck is two planks — the inner one
      // is the landing (its top at 34.92 is 0.72 m over the roof, a step down),
      // the outer one is the handrail side — and the 1.30 m slot between them
      // is what the animal comes up through.
      const decks = [[-10.25, 1.00], [-7.90, 1.10]];
      for (let k = 0; k < decks.length; k++) {
        const cx = decks[k][0], w = decks[k][1];
        const zm = (z0 + z1) * 0.5, zd = (z1 - z0) - 0.4;
        M.box(cx, y + 0.06, zm, w, 0.12, zd, PALETTE.hkLaundry);
        hkStaticBox(game, cx, y, zm, w, 0.24, zd);
      }
    } else
    for (let h = -1; h <= 1; h += 2) {
      const za = h < 0 ? z0 + 0.2 : zc + HOLE;
      const zb = h < 0 ? zc - HOLE : z1 - 0.2;

      const zm = (za + zb) * 0.5, zd = zb - za;
      if (zd < 0.4) continue;
      M.box(x0 + out * 0.5 + 0.5, y + 0.06, zm, out + 1.5, 0.12, zd, PALETTE.hkLaundry);
      hkStaticBox(game, x0 + out * 0.5 + 0.5, y, zm, out + 1.5, 0.24, zd);
    }
    M.cyl(x0 + out, y + 0.62, zc, 0.045, z1 - z0, PALETTE.hkBamboo, Math.PI * 0.5, 0, 0, 6);
    deckAt.push(y);
  }
  // ---- THE NETTING IS A NET ----------------------------------------------
  // Eighteen metres of opaque dark green filling the left third of every shot
  // taken from the middle of the street — because it was one box in the same
  // merged Lambert as everything else. Safety netting on a bamboo scaffold is
  // a MESH: you see the lattice through it, and the whole reason the scaffold
  // is worth looking at is the lattice. Its own mesh, half transparent, and
  // torn open across the middle third so there is a hole to see the poles
  // through — which every one of them has by the second week.
  {
    const N = hkMerger();
    const zc2 = (z0 + z1) * 0.5, span = (z1 - z0) * 0.62;
    for (let k = 0; k < 3; k++) {
      const h2 = [0.30, 0.22, 0.16][k];
      N.box(x0 + out + 0.1, hkSCAF.top * (0.16 + k * 0.30), zc2 + (k - 1) * span * 0.34,
            0.05, hkSCAF.top * h2, span * (k === 1 ? 0.34 : 0.44), PALETTE.hkAwning2);
    }
    const nm2 = new THREE.Mesh(N.build(), mat(PALETTE.hkAwning2, {
      vertexColors: true, transparent: true, opacity: 0.45 }).clone());
    nm2.material.depthWrite = false;
    nm2.renderOrder = 2;
    root.add(nm2);
  }

  const mesh = new THREE.Mesh(M.build(), hkVC());
  mesh.castShadow = true;
  root.add(mesh);

  const im = new THREE.InstancedMesh(hkG.box, mat(PALETTE.hkLash), lash.length / 9);
  for (let i = 0; i < lash.length / 9; i++) {
    const o = i * 9;
    im.setMatrixAt(i, hkXform(lash[o], lash[o + 1], lash[o + 2], 0.6, 0.4, 0,
                              lash[o + 6], lash[o + 7], lash[o + 8]));
  }
  im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
  root.add(im);

  // ---- the roof you top out onto ------------------------------------------
  // The building's own collider stops at its face, so the deck has to be real.
  //
  // ...AND ITS EAST LIP WAS THE THING STOPPING THE CLIMB.
  //
  // The deck ran to x -9.5. The animal clings to the scaffold face at x -9.13
  // and its collider reaches to about -9.53, so on the way up its head caught
  // the three centimetres of slab overhanging the climbing line: measured, the
  // climb tops out at **33.36 m and stays there for forty seconds**, against a
  // deck at 34.2 and a lattice that ends at 34.8. Let go at the stall and the
  // animal falls thirty-three metres to the street.
  //
  // So the roof of the chapter that hands over the CLIMB verb could not be
  // climbed to. Everything dressed on it — the hut, the pigeon loft, the
  // aerials, the plastic chair facing the harbour — was unreachable, the
  // `bamboo-climb` record could never exceed 33.36 m, and the rigger's "roof is
  // another six decks and the view is the reason" was a promise the chapter
  // could not keep.
  //
  // Pulled back to x -10.4, which is the building's own face (hkFACE is 10.5) —
  // where a parapet belongs anyway. The scaffold hangs outside the facade, as
  // scaffolds do, and the top-out shove in capybara.js then lands the animal on
  // the deck from the lattice's real top.
  // 18.8, not 19 and not 18.1. The climber's centre sits at x -9.16 and its
  // west extent at about -9.51, so the old 19 m deck (east edge -9.50) caught
  // its head by roughly a centimetre — which is all it takes. 18.1 cleared the
  // column by miles and left the animal topping out 1.24 m out in the street
  // with nothing under it: measured, it reached 34.39 and then fell 34 m. The
  // edge belongs just clear of the column, at -9.70, where the top-out shove
  // in capybara.js carries it the last half metre onto the deck.
  const ROOF_W = 18.8;
  hkStaticBox(game, hkSCAF.x - 8.6, hkROOF_Y - 0.3, (z0 + z1) * 0.5, ROOF_W, 0.6, (z1 - z0) + 14);
  const R = hkMerger();
  const rx = hkSCAF.x - 8.6, rz = (z0 + z1) * 0.5;
  R.box(rx, hkROOF_Y - 0.15, rz, ROOF_W, 0.3, (z1 - z0) + 14, PALETTE.hkConcreteDk);
  // ---- A ROOF IS NOT ONE VALUE -------------------------------------------
  // Nineteen by thirty-two metres of a single flat colour, and it is the
  // surface the player stands on for the whole of the chapter's marquee
  // moment. A real one is patched: bitumen that has been re-laid in strips,
  // a screed fall to the outlets, and puddles that never dry. Nine patches
  // and four seams, all of them 2 cm proud, is the difference between a roof
  // and a sheet of card — the same argument the trachyte made in Venice.
  {
    let rs = 4242;
    const rr = () => { rs = (rs * 1103515245 + 12345) & 0x7fffffff; return rs / 0x7fffffff; };
    for (let i = 0; i < 9; i++) {
      R.box(rx - 8 + rr() * 16, hkROOF_Y - 0.005, rz - 14 + rr() * 28,
            2.4 + rr() * 5, 0.02, 2.0 + rr() * 5,
            i % 3 === 0 ? PALETTE.hkConcrete : 0x4e4a46, 0, rr() * 0.5, 0);
    }
    for (let i = 0; i < 4; i++) {
      R.box(rx - 7.5 + i * 5, hkROOF_Y + 0.01, rz, 0.3, 0.02, (z1 - z0) + 13,
            PALETTE.hkPoleSteel);
    }
    // the fall to the outlet, and the puddle that sits in it
    R.cyl(rx + 3, hkROOF_Y + 0.005, rz + 9, 1.9, 0.02, 0x3a4348, 0, 0, 0, 16);
    R.cyl(rx + 3, hkROOF_Y + 0.02, rz + 9, 0.28, 0.1, PALETTE.hkGrille, 0, 0, 0, 8);
  }
  // a parapet on three sides, low enough to see over from a camera nine metres
  // back — near the player, go flat or go tall, and this is as flat as it gets
  R.box(rx + 9.2, hkROOF_Y + 0.25, rz, 0.5, 0.8, (z1 - z0) + 14, PALETTE.hkConcrete);
  R.box(rx, hkROOF_Y + 0.25, rz + ((z1 - z0) + 14) * 0.5, 19, 0.8, 0.5, PALETTE.hkConcrete);
  R.box(rx, hkROOF_Y + 0.25, rz - ((z1 - z0) + 14) * 0.5, 19, 0.8, 0.5, PALETTE.hkConcrete);
  for (let i = 0; i < 5; i++) {
    R.cyl(rx - 5 + i * 2.6, hkROOF_Y + 1.2, rz - 6 + (i % 2) * 11, 1.1, 2.1, PALETTE.hkConcrete,
          0, 0, 0, 8);
    R.cyl(rx - 5 + i * 2.6, hkROOF_Y + 2.35, rz - 6 + (i % 2) * 11, 1.15, 0.2,
          PALETTE.hkPoleSteel, 0, 0, 0, 8);
  }
  // a washing line, which is the only soft thing in this entire chapter
  R.box(rx - 2, hkROOF_Y + 2.6, rz + 2, 0.06, 0.06, 12, PALETTE.hkLash);
  for (let i = 0; i < 7; i++) {
    R.box(rx - 2, hkROOF_Y + 1.9, rz - 3.4 + i * 1.7, 0.9, 1.3, 0.05,
          i % 2 ? PALETTE.hkLaundry : PALETTE.hkFerry);
  }
  // ---- AND SOMEBODY LIVES UP HERE ----------------------------------------
  // This deck is the one place the chapter's marquee moment can be watched
  // from — the whole point of the bamboo is to get here — and it was five
  // water tanks and a line of washing. A Hong Kong roof is the most inhabited
  // surface in the city: a 天台屋, a rooftop hut somebody has been renting for
  // thirty years, a pigeon loft, a forest of aerials, a plastic chair facing
  // the harbour and about forty potted plants. All of it is silhouette from
  // the only camera that ever comes here, which is a camera looking SOUTH at
  // a skyline, so everything below is placed to sit in the bottom of that
  // frame rather than in the middle of it.
  {
    // the hut, in the corner away from the view
    const hx = rx - 6.5, hz = rz + 7.5;
    R.box(hx, hkROOF_Y + 1.3, hz, 5.0, 2.6, 4.0, PALETTE.hkTile2);
    R.box(hx, hkROOF_Y + 2.7, hz, 5.6, 0.3, 4.6, PALETTE.hkGrille, 0, 0, 0.05);
    R.box(hx + 2.55, hkROOF_Y + 1.4, hz - 0.8, 0.14, 2.0, 0.9, PALETTE.hkAwning);
    // its one window, and its light is on
    hkFLATLIT.push(hx + 2.58, hkROOF_Y + 1.6, hz + 1.2, 0.1, 1.0, 1.2, 0xffe0a4);
    R.box(hx + 2.5, hkROOF_Y + 1.6, hz + 1.2, 0.1, 1.2, 1.4, PALETTE.hkGrille);
    // an air-conditioner out of the side of it, dripping onto the deck
    R.box(hx + 1.4, hkROOF_Y + 2.35, hz + 2.1, 0.9, 0.6, 0.24, PALETTE.hkPoleSteel);
    // the pigeon loft, which every one of these roofs has
    R.box(hx - 4.2, hkROOF_Y + 0.9, hz - 1.5, 2.2, 1.8, 3.0, PALETTE.hkCrate);
    R.box(hx - 4.2, hkROOF_Y + 1.9, hz - 1.5, 2.6, 0.3, 3.4, PALETTE.hkGrille, 0, 0, -0.12);
    for (let i = 0; i < 7; i++) {
      R.box(hx - 3.1, hkROOF_Y + 1.1, hz - 2.7 + i * 0.42, 0.06, 1.3, 0.06, PALETTE.hkPoleSteel);
    }
    // a plastic chair and a crate, facing the harbour, because that is what
    // the roof is FOR and it is the only thing up here pointing at the view
    R.box(rx + 5.5, hkROOF_Y + 0.24, rz - 8.0, 0.5, 0.06, 0.5, PALETTE.hkTaxi);
    R.box(rx + 5.5, hkROOF_Y + 0.55, rz - 8.25, 0.5, 0.6, 0.06, PALETTE.hkTaxi, -0.18);
    for (let i = 0; i < 4; i++) {
      R.box(rx + 5.5 + (i & 1 ? 0.2 : -0.2), hkROOF_Y + 0.11, rz - 8.0 + (i & 2 ? 0.2 : -0.2),
            0.04, 0.22, 0.04, PALETTE.hkTaxi);
    }
    R.box(rx + 4.4, hkROOF_Y + 0.2, rz - 8.0, 0.5, 0.4, 0.5, PALETTE.hkCrate);
    R.cyl(rx + 4.4, hkROOF_Y + 0.52, rz - 8.0, 0.06, 0.24, PALETTE.hkNeonGreen, 0, 0, 0, 6);
    // potted plants along the parapet, which is what everybody does with a
    // roof they are not allowed to build on
    for (let i = 0; i < 9; i++) {
      const px2 = rx + 8.4, pz2 = rz - 9 + i * 2.3;
      R.cyl(px2, hkROOF_Y + 0.22, pz2, 0.24, 0.44, PALETTE.hkTile3, 0, 0, 0, 6);
      R.sph(px2, hkROOF_Y + 0.62, pz2, 0.3, 0.34, 0.3, i % 2 ? 0x4f7c46 : 0x6f9c58);
      if (i % 3 === 0) R.cyl(px2, hkROOF_Y + 0.95, pz2, 0.05, 0.7, 0x4f7c46, 0, 0, 0, 4);
    }
    // satellite dishes and the aerial forest, which is the roofline of the
    // whole city seen from any window in it
    for (let i = 0; i < 4; i++) {
      const dx2 = rx - 8 + i * 4.6, dz3 = rz - 4 + (i % 2) * 8;
      R.cyl(dx2, hkROOF_Y + 0.6, dz3, 0.06, 1.2, PALETTE.hkPoleSteel, 0, 0, 0, 4);
      R.cyl(dx2, hkROOF_Y + 1.3, dz3, 0.55, 0.12, PALETTE.hkConcrete, 0.7, i, 0, 8);
      R.cyl(dx2 + 0.2, hkROOF_Y + 1.55, dz3, 0.05, 0.4, PALETTE.hkGrille, 0.7, i, 0, 4);
    }
    for (let i = 0; i < 10; i++) {
      const ax2 = rx - 8 + (i * 1.9) % 17, az2 = rz - 8 + (i * 3.7) % 15;
      R.box(ax2, hkROOF_Y + 1.6, az2, 0.05, 3.2, 0.05, PALETTE.hkPoleSteel);
      for (let q = 0; q < 4; q++) {
        R.box(ax2, hkROOF_Y + 1.9 + q * 0.42, az2, 0.9 - q * 0.16, 0.04, 0.04,
              PALETTE.hkPoleSteel);
      }
    }
    // and a red light on the tallest mast, because the roof is 34 m up
    hkFLATLIT.push(rx - 8, hkROOF_Y + 3.3, rz - 8, 0.22, 0.22, 0.22, 0xff5a4a);
  }
  const rm = new THREE.Mesh(R.build(), hkVC());
  rm.castShadow = true; rm.receiveShadow = true;
  root.add(rm);
  // the hut and the loft are the only two things up here big enough to walk
  // into, and this is a roof the chapter deliberately sends the player onto
  hkStaticBox(game, rx - 6.5, hkROOF_Y + 1.3, rz + 7.5, 5.0, 2.6, 4.0);
  hkStaticBox(game, rx - 10.7, hkROOF_Y + 0.9, rz + 6.0, 2.2, 1.8, 3.0);

  // ---- the short scaffold on the east side --------------------------------
  const E = hkMerger();
  const ex = hkFACE - 1.7;
  for (let i = 0; i <= 4; i++) {
    const z = lerp(1, 11, i / 4);
    E.cyl(ex, 5.95, z, 0.055, 11.9, PALETTE.hkBamboo, 0, 0, 0, 6);
    E.cyl(hkFACE - 0.3, 5.95, z, 0.05, 11.9, PALETTE.hkBambooDk, 0, 0, 0, 6);
  }
  for (let b = 0; b <= 7; b++) {
    const y = b * 1.66;
    E.cyl(ex, y, 6, 0.05, 10, PALETTE.hkBamboo, Math.PI * 0.5, 0, 0, 6);
    E.cyl(hkFACE - 1.0, y, 6, 0.05, 1.6, PALETTE.hkBambooDk, 0, 0, Math.PI * 0.5, 6);
  }
  // its deck sits level with the poles, so the crossing has a landing at BOTH
  // ends — a one-way tightrope is a trap, not a task
  // Its deck is SOLID under the middle laundry pole (z = 5) and stops short at
  // the north end, which is where its own climbing shaft is. The first cut put
  // the ladder hole in the middle of the deck, which is where the pole lands —
  // so the crossing arrived at a hole and dropped straight through it.
  E.box(hkFACE - 1.1, 11.66, 4.5, 2.2, 0.14, 7.0, PALETTE.hkLaundry);
  hkStaticBox(game, hkFACE - 1.1, 11.6, 4.5, 2.2, 0.26, 7.0);
  const em = new THREE.Mesh(E.build(), hkVC());
  em.castShadow = true;
  root.add(em);
}

// ========================================================== LAUNDRY POLES ===
/**
 * Bundles of three bamboo poles, wall to wall, eleven metres up. Real ones are
 * a single pole and you would never get a capybara across one; three of them
 * lashed together is 0.9 m of deck, which is narrow enough to be a nerve and
 * wide enough to be fair. Every hard thing in this game is fair.
 */
function hkBuildPoles(game, root) {
  const M = hkMerger();
  for (let k = 0; k < hkPOLE_Z.length; k++) {
    const z = hkPOLE_Z[k];
    // FIVE POLES, NOT THREE. Three lashed together is 0.95 m of deck for an
    // animal that is 0.9 m wide, which is not a nerve, it is a coin toss. Five
    // is 1.6 m: still narrow enough that the drop is the point, wide enough
    // that the crossing rewards holding a line instead of luck.
    // SEVEN POLES. Five was 1.6 m and a capybara still went off it inside two
    // seconds of walking; seven is 2.2, which is about a metre either side of an
    // animal that is 0.9 wide. In a building where every flat on the floor has a
    // rack out of the same window, seven is if anything conservative.
    for (let i = -3; i <= 3; i++) {
      M.cyl(0, hkPOLE_Y + (i === 0 ? 0.06 : 0), z + i * 0.34, 0.075, hkFACE * 2 - 1,
            i === 0 ? PALETTE.hkBamboo : PALETTE.hkBambooDk, 0, 0, Math.PI * 0.5, 6);
    }
    // lashings at the quarters, and somebody's washing on the middle one
    for (let i = -2; i <= 2; i++) {
      M.box(i * 5.4, hkPOLE_Y, z, 0.3, 0.3, 1.0, PALETTE.hkLash, 0.4, 0, 0);
    }
    if (k === 1) {
      for (let i = 0; i < 5; i++) {
        M.box(-8 + i * 4, hkPOLE_Y - 0.85, z, 1.1, 1.5, 0.05,
              i % 2 ? PALETTE.hkLaundry : PALETTE.hkNeonCyan);
      }
    }
    hkStaticBox(game, 0, hkPOLE_Y - 0.1, z, hkFACE * 2 - 1, 0.24, 2.2);
  }
  const mesh = new THREE.Mesh(M.build(), hkVC());
  mesh.castShadow = true;
  root.add(mesh);
}

// ================================================================ THE NEON ==
/**
 * Ninety-odd signs, cantilevered out over the road from both sides.
 *
 * THEY HAVE TO EMIT. The first cut was one InstancedMesh with a per-instance
 * colour, which is one draw call and is completely wrong: a Lambert box in a
 * night scene is lit by the ambient and nothing else, so ninety saturated
 * neon signs rendered as ninety BLACK RECTANGLES hanging over the street. The
 * whole premise of the chapter's look — a monochrome city where the only
 * saturated thing in frame is the light — inverted itself into a monochrome
 * city with holes punched in it.
 *
 * MeshLambertMaterial has an `emissive` term, which is exactly what a sign is:
 * a surface that is bright whether or not anything is shining on it. But
 * emissive is a UNIFORM, so it cannot vary per instance — which means the one
 * draw call has to become one per colour. Six draw calls for the entire neon of
 * Mong Kok is a bargain, and it buys something the instanced version could not
 * have: each colour can now BREATHE on its own slow clock, because the thing
 * being animated is one number on one material rather than ninety entries in a
 * colour buffer.
 */
const hkNEON_COLS = [PALETTE.hkNeonPink, PALETTE.hkNeonCyan, PALETTE.hkNeonGold,
                     PALETTE.hkNeonGreen, PALETTE.hkNeonRed, PALETTE.hkNeonBlue,
                     PALETTE.hkNeonWhite];
function hkNeonMat(color) {
  // cloned: emissiveIntensity is written every frame, and mat() caches by
  // colour and options, so mutating the shared one would set fire to whatever
  // else in the game asked for the same literal
  return mat(color, { emissive: color, emissiveIntensity: 1 }).clone();
}
function hkBuildNeon(game, root) {
  const lists = [];
  for (let i = 0; i < hkNEON_COLS.length; i++) lists.push([]);
  let seed = 313;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  const per = hkSIGN_N / 2;
  const frames = [], chars = [], glows = [];
  for (let i = 0; i < hkSIGN_N; i++) {
    const side = i % 2 ? 1 : -1;
    const k = (i / 2) | 0;
    // stratified: one slot each along the street, jittered inside its own slot
    const z = lerp(hkST_Z0 + 4, hkST_Z1 - 4, (k + 0.15 + rnd() * 0.7) / per);
    const y = 6.2 + rnd() * 12;
    const reach = 1.7 + rnd() * 2.6;
    const w = 0.7 + rnd() * 0.9;
    const h = 0.9 + rnd() * 1.9;
    const x = side * (hkFACE - reach * 0.5);
    const ci = (rnd() * hkNEON_COLS.length) | 0;
    hkPush9(lists[ci], x, y, z, 0, 0, 0, reach, h, w);
    // ---- A SIGN IS A LIT FACE IN A DARK BOX ------------------------------
    // Sixty flat rectangles of pure colour hanging in the air is a colour
    // swatch, not a street: what makes neon read as neon is the EDGE — the
    // black steel box the tubes are mounted in, and the tubes themselves being
    // brighter than the face they are on. Two more instanced meshes and a
    // hundred and forty small boxes for the whole street.
    // A RIM, NOT A BOX. Grown 22 cm on every axis it simply SWALLOWED the sign
    // and the whole street went black — sixty emissive faces inside sixty
    // slightly larger unlit ones. It has to be bigger across the face and
    // SMALLER through it, so the lit panel stands proud on both sides.
    frames.push(x, y, z, 0, 0, 0, reach + 0.26, h + 0.26, w - 0.08);
    const nch = 1 + (rnd() * 3 | 0);
    for (let c = 0; c < nch; c++) {
      const cy = y + (h - 0.5) * ((c + 0.5) / nch - 0.5);
      // BOTH FACES. A sign is read from up the street and down it, and tubes on
      // one side only means half the street shows you the back of a black box.
      const cw = reach * (0.3 + rnd() * 0.45), chh = Math.min(0.42, (h - 0.35) / nch);
      chars.push(x, cy, z + (w * 0.5 + 0.07), 0, cw, chh, ci);
      chars.push(x, cy, z - (w * 0.5 + 0.07), 0, cw, chh, ci);
    }
    // ---- AND THE ROAD IS ALWAYS WET --------------------------------------
    // The palette calls the tarmac `hkWet` and nothing had ever made it so.
    // One soft patch of the sign's own colour on the road under each sign: it
    // costs a hundred and twenty triangles for the whole chapter and it is the
    // difference between a street at night and a street with the lights off.
    glows.push(x * 0.66, z, reach * 1.15, w * 1.9, ci);
    // AND THE STREAK. A pool under a sign is what a light does to a wet road
    // seen from above; what it does from EYE LEVEL — which is where this
    // chapter is played — is run at you in a long broken line, because you are
    // looking along a mirror at a very shallow angle. It is the single most
    // recognisable thing about a photograph of Mong Kok and the street did not
    // have one. See hkBuildWetRoad.
    // NARROW AND SHORT. Sixty additive streaks up to twenty metres long on a
    // thirteen-metre street overlap five deep, and the first cut of this turned
    // Mong Kok's tarmac into a stained-glass window: measured from the frame,
    // the road was brighter than the signs making it. A reflection is a thin
    // bright line, not a wash.
    hkWET.push({ x: x * 0.52, z: z, w: reach * 0.30, len: (y + h) * 0.62,
                 col: new THREE.Color(hkNEON_COLS[ci]) });
  }
  hkSignMeshes = [];
  hkSignPhase = [];
  for (let i = 0; i < hkNEON_COLS.length; i++) {
    const n = lists[i].length / 9;
    if (!n) { hkSignMeshes.push(null); hkSignPhase.push(0); continue; }
    const m = hkNeonMat(hkNEON_COLS[i]);
    const im = new THREE.InstancedMesh(hkG.box, m, n);
    for (let k = 0; k < n; k++) {
      const o = k * 9;
      im.setMatrixAt(k, hkXform(lists[i][o], lists[i][o + 1], lists[i][o + 2], 0, 0, 0,
                                lists[i][o + 6], lists[i][o + 7], lists[i][o + 8]));
    }
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    im.frustumCulled = false;
    root.add(im);
    hkSignMeshes.push(im);
    hkSignPhase.push(rnd() * 6.28);
  }

  // the black boxes the tubes live in
  {
    const im = new THREE.InstancedMesh(hkG.box, mat(0x14161a), frames.length / 9);
    for (let k = 0; k < frames.length / 9; k++) {
      const o = k * 9;
      im.setMatrixAt(k, hkXform(frames[o], frames[o + 1], frames[o + 2], 0, 0, 0,
                                frames[o + 6], frames[o + 7], frames[o + 8]));
    }
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
    im.frustumCulled = false;
    root.add(im);
  }
  // the characters: the UNLIT part of a lightbox. A Hong Kong sign is a sheet
  // of colour with the glyphs masked out of it, so the writing is the dark
  // thing on the bright thing — which is also why one instanced mesh in one
  // flat colour is enough for the whole street.
  {
    const n = chars.length / 7;
    const im = new THREE.InstancedMesh(hkG.box, new THREE.MeshBasicMaterial({ color: 0x11141a }), n);
    for (let k = 0; k < n; k++) {
      const o = k * 7;
      im.setMatrixAt(k, hkXform(chars[o], chars[o + 1], chars[o + 2], 0, 0, 0,
                                chars[o + 4], chars[o + 5], 0.1));
    }
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    im.frustumCulled = false;
    root.add(im);
    hkCharMesh = im;
  }
  // and what all of it does to the tarmac
  {
    const G = hkMerger();
    const c = new THREE.Color();
    // SMALL POOLS, NOT A CARPET. Big overlapping patches tile the whole
    // carriageway and the road stops being tarmac and becomes a rug: rendered,
    // sixty of them at three metres across was a quilt of green and blue
    // rectangles under the capybara's feet. One pool per sign, roughly the size
    // of the sign, is a wet road with lights over it.
    // AND A POOL OF LIGHT IS ROUND. These were two nested BOXES, so what sixty
    // signs put on the tarmac was sixty pairs of concentric rectangles with
    // hard corners — visible as rectangles from any camera above about ten
    // metres, which includes the roof the chapter sends you to. Four rings of
    // a sixteen-sided cylinder each, dimming outward: the falloff is a curve
    // and the shape is a shape a light actually makes.
    // ...AND THE SIZE, WHICH THE ROUNDING DID NOT FIX.
    // The note above says "roughly the size of the sign" and the arithmetic
    // under it said something else: rr = (w + h) x 0.42 drawn at rr x u x 1.5
    // is an outer RADIUS of (w + h) x 0.63 — about nine metres across for an
    // ordinary sign and fifteen for a big one, sixty of them, overlapping. From
    // the arrival camera the footpath was a quilt of translucent discs with the
    // tarmac showing through in the gaps: the rug the comment was written to
    // prevent, in a rounder shape. The outer radius is now (w + h) x 0.25 — one
    // pool about as wide as its own sign, which is what was meant — and that is
    // a sixth of the area per sign, so they stop merging into one another.
    for (let k = 0; k < glows.length / 5; k++) {
      const o = k * 5;
      const rr = (glows[o + 2] + glows[o + 3]) * 0.42;
      for (let r2 = 3; r2 >= 0; r2--) {
        const u = (r2 + 1) / 4;
        c.set(hkNEON_COLS[glows[o + 4]]).multiplyScalar((1 - u) * (1 - u) * 0.9 + 0.10);
        G.cyl(glows[o], 0.004 - r2 * 0.002, glows[o + 1], rr * u * 0.60, 0.02,
              '#' + c.getHexString(), 0, 0, 0, 16);
      }
    }
    // ADDITIVE, at 0.09, is the difference between a wet road and a road with a
    // faint stain on it. Normal blending MULTIPLIES the tarmac it is lying on,
    // so sixty pools of saturated colour at nine per cent over a very dark grey
    // resolved to a very dark grey: measured off the rendered frame, the whole
    // effect was worth about four levels out of two hundred and fifty-five.
    // Light adds.
    hkGlowMesh = new THREE.Mesh(G.build(),
      new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.14,
                                    depthWrite: false, blending: THREE.AdditiveBlending }));
    hkGlowMesh.position.y = 0.05;
    hkGlowMesh.renderOrder = 2;
    hkGlowMesh.frustumCulled = false;
    root.add(hkGlowMesh);
  }

  // ---- THE BIG ONE ---------------------------------------------------------
  // A restaurant sign the size of a bus, out over the middle of the road, on
  // two brackets. It has a collider, it sways when something lands on it, and
  // it is the one piece of neon in the chapter you are meant to stand on. The
  // frame is ordinary lit geometry and the face is emissive, which is what a
  // sign actually is and is why it reads as a sign at forty metres.
  const grp = new THREE.Group();
  const M = hkMerger();
  M.box(4.4, 0, 0, 0.5, 4.4, 1.2, PALETTE.hkGrille);
  M.box(5.1, 1.6, 0, 1.8, 0.22, 0.22, PALETTE.hkPoleSteel);
  M.box(5.1, -1.6, 0, 1.8, 0.22, 0.22, PALETTE.hkPoleSteel);
  M.box(0, 0, 0, 10, 3.6, 1.0, PALETTE.hkGrille);
  const frame = new THREE.Mesh(M.build(), hkVC());
  frame.castShadow = true;
  grp.add(frame);
  const faceGeo = new THREE.BoxGeometry(9.5, 3.0, 0.16);
  const face = new THREE.Mesh(faceGeo, hkNeonMat(PALETTE.hkNeonRed));
  face.position.set(0, 0, 0.58);
  grp.add(face);
  const charGeo = new THREE.BoxGeometry(1.4, 1.9, 0.12);
  for (let i = 0; i < 4; i++) {
    const ch = new THREE.Mesh(charGeo, hkNeonMat(PALETTE.hkNeonGold));
    ch.position.set(-3.4 + i * 2.3, 0.1, 0.70);
    grp.add(ch);
  }
  grp.position.set(hkSIGN.x, hkSIGN.y, hkSIGN.z);
  root.add(grp);
  hkSignGroup = grp;
  hkSignFace = face;

  // KINEMATIC, and allowSleep OFF. A sleeping body is skipped in narrowphase and
  // the top of a sign the player is standing on would silently stop existing.
  const b = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC,
                              material: (game.mats && game.mats.ground) || undefined });
  b.addShape(new CANNON.Box(new CANNON.Vec3(5.0, 1.8, 0.55)));
  b.position.set(hkSIGN.x, hkSIGN.y, hkSIGN.z);
  b.allowSleep = false;
  hkSyncBody(b);
  game.world.addBody(b);
  hkSignBody = b;
}

/** The whole street, breathing. Six numbers a frame. */
function hkNeonBreathe(dt) {
  if (!hkSignMeshes) return;
  for (let i = 0; i < hkSignMeshes.length; i++) {
    const m = hkSignMeshes[i];
    if (!m) continue;
    // Each colour on its own slow clock, plus a fast flicker on one of them —
    // there is always exactly one failing tube on a street like this.
    const slow = 0.86 + Math.sin(hkTime * (0.4 + i * 0.17) + hkSignPhase[i]) * 0.14;
    const flick = i === 3 ? (Math.sin(hkTime * 19.3) > 0.82 ? 0.35 : 1) : 1;
    m.material.emissiveIntensity = (slow * flick) * (0.85 + hkShow * 0.5);
  }
  if (hkSignFace) {
    hkSignFace.material.emissiveIntensity =
      (0.9 + Math.sin(hkTime * 2.1) * 0.1) * (0.85 + hkShow * 0.5) *
      (1 + Math.abs(hkSignSway) * 0.5);
  }
  // the tarmac breathes with the signs that are lighting it
  if (hkGlowMesh) {
    hkGlowMesh.material.opacity = 0.125 + Math.sin(hkTime * 0.9) * 0.018 + hkShow * 0.05;
  }
}

// ============================================================ THE WET ROAD ==
/**
 * WHAT THE STREET LOOKS LIKE FROM THE STREET.
 *
 * Sixty signs, sixty pools of colour on the tarmac under them, and the picture
 * still had nothing in it that says the road is wet — because a pool is what a
 * light does to a wet surface seen from ABOVE, and this chapter is played from
 * a metre and a half off the ground looking along it. At that angle a wet road
 * is a mirror at a very shallow incidence and every light on it becomes a long
 * broken STREAK running toward you. It is the whole visual signature of the
 * place and it was the one thing missing.
 *
 * Same instrument as Venice's flooded square, which learned it here first: one
 * unit smear, one instanced mesh, per-instance colour, and the yaw of every
 * streak recomputed each frame so it runs from its own light toward whoever is
 * looking — because a reflection in a horizontal mirror always does. Sixty-one
 * atan2s and one draw call.
 */
const hkWET = [];                   // { x, z, w, len, col }
const hkWET_SEG = 7;
let hkWetMesh = null, hkWetMat = null;

function hkBuildWetRoad(root) {
  if (!hkWET.length) return;
  const M = hkMerger();
  const grey = (v) => { const g = Math.max(0, Math.min(255, Math.round(v * 255)));
                        return (g << 16) | (g << 8) | g; };
  for (let k = 0; k < hkWET_SEG; k++) {
    const u = (k + 0.5) / hkWET_SEG;
    // A STREAK IS BROKEN. A smooth ramp is a runway; a wet road breaks the
    // light into bars because it has a camber, a kerb and a hundred puddles.
    const f = ((1 - u) * (1 - u) * 0.9 + 0.1) * (0.55 + 0.45 * Math.abs(Math.sin(k * 1.9)));
    const dz = 1 / hkWET_SEG + 0.02;
    const jit = Math.sin(k * 3.1) * 0.13;
    const w = 1 - u * 0.18;
    M.box(jit, 0, u, w * 0.46, 0.02, dz, grey(f));
    M.box(jit - w * 0.40, 0, u, w * 0.40, 0.02, dz * 0.9, grey(f * 0.32));
    M.box(jit + w * 0.40, 0, u, w * 0.40, 0.02, dz * 0.9, grey(f * 0.32));
  }
  hkWetMat = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.10, depthWrite: false,
    blending: THREE.AdditiveBlending });
  const im = new THREE.InstancedMesh(M.build(), hkWetMat, hkWET.length);
  im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(hkWET.length * 3), 3);
  for (let i = 0; i < hkWET.length; i++) {
    const c = hkWET[i].col;
    im.instanceColor.setXYZ(i, c.r, c.g, c.b);
  }
  im.instanceColor.needsUpdate = true;
  im.frustumCulled = false;
  im.position.y = 0.055;
  im.renderOrder = 3;
  root.add(im);
  hkWetMesh = im;
}

function hkUpdateWetRoad(game) {
  if (!hkWetMesh) return;
  const cam = game.camera && game.camera.position;
  if (!cam) return;
  // From directly overhead a shallow-angle streak is nonsense — it is only a
  // streak because you are looking ALONG the surface. Off the roof, off.
  const h = clamp(1 - (cam.y - 8) / 16, 0.12, 1);
  hkWetMat.opacity = (0.085 + hkNeonPulse * 0.045) * h;
  for (let i = 0; i < hkWET.length; i++) {
    const m = hkWET[i];
    const yaw = Math.atan2(cam.x - m.x, cam.z - m.z);
    hkWetMesh.setMatrixAt(i, hkXform(m.x, 0, m.z, 0, yaw, 0, m.w, 1, m.len));
  }
  hkWetMesh.instanceMatrix.needsUpdate = true;
}

// ========================================================= THE DAI PAI DONG ==
/**
 * THE THING MONG KOK IS ACTUALLY LIKE, and the street did not have one.
 *
 * Chapter eleven is a hundred metres of tong lau, ninety signs, a scaffold, a
 * bakery, a wet market and eighty people walking past all of it without ever
 * stopping — and that is the one thing about that street which is not true.
 * Nobody in Mong Kok is going anywhere; they are sitting on a red plastic stool
 * eighteen inches from the traffic eating something out of a wok that is on
 * fire. A dai pai dong is the single most characteristic object in the chapter
 * and it is also the only place in it where anybody is STILL.
 *
 * It spills off the pavement into the road, because they all do. Four folding
 * tables, sixteen stools, a wok range with a flame in it that breathes, a steam
 * plume over that, a rack of bowls, a crate of empties and one bare bulb per
 * table on a sagging flex. Two people live here (see the locals block at the
 * bottom of this file): the cook, who does not stop, and a man at table two who
 * has been there some time.
 *
 * Everything a capybara could walk into is solid, in ONE compound body — the
 * tables and the range are exactly the size of thing that reads as a bug when
 * you pass through it, which is the lesson this codebase has now learned in
 * five chapters (Sydney's bollards, the Quay's stiles, Pasto's terraces, the
 * Drift's gap posts).
 */
const hkDPD = { x: 7.6, z: -24 };
let hkSteamMesh = null, hkFlameMesh = null, hkFlameMat = null;
const hkSTEAM_N = 22;
const hkSteamData = new Float32Array(hkSTEAM_N * 4);   // x, y, z, scale

function hkBuildDaiPaiDong(game, root) {
  const M = hkMerger();
  const dx = hkDPD.x, dz = hkDPD.z;
  const body = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
  const solid = (x, y, z, sx, sy, sz) => {
    body.addShape(new CANNON.Box(new CANNON.Vec3(sx * 0.5, sy * 0.5, sz * 0.5)),
                  new CANNON.Vec3(x, y, z));
  };

  // ---- the awning, on four poles, out over the tables ---------------------
  // ---- AND IT LEAVES A LANE ----------------------------------------------
  // The first cut of this filled the east pavement from the kerb to the
  // shopfront and a capybara walking down it wedged between the wok range and
  // the wall and stayed there: measured, 1 597 frames of nothing at x 9.3.
  // Which is the oldest mistake in this project — a new object dropped on an
  // existing path — and it is worse here than usual, because that pavement is
  // the way to the pier and the pier is the way out of the chapter.
  //
  // So the stall straddles the KERB instead: range hard against the shopfront,
  // tables and stools out in the road where they really are, and two clear
  // metres of pavement between them at every z. The awning still covers both,
  // which is what an awning on that street does.
  // ---- THE SHOP-SIDE POLES GO AGAINST THE SHOP ---------------------------
  // At dx + 0.55 = 8.15 the two inner poles stood a metre and a half out from
  // the shopfront, and with the collider face at 9.8 the walkable lane past
  // this stall measured exactly 1.00 m for an animal 0.90 m wide (measured
  // 23 Aug with qa/wn-clear.js). It was the tightest thing on the chapter's
  // main route and it was there for no reason — a dai pai dong's awning is
  // bolted to the shopfront it is trading in front of. At dx + 1.05 the lane
  // is 1.43, and the awning simply got 60 cm wider, which it should be.
  for (let i = 0; i < 4; i++) {
    const px = dx + (i & 1 ? -4.4 : 1.05), pz = dz + (i & 2 ? 4.2 : -4.2);
    M.cyl(px, 1.3, pz, 0.06, 2.6, PALETTE.hkPoleSteel, 0, 0, 0, 4);
    solid(px, 1.3, pz, 0.24, 2.6, 0.24);
  }
  M.box(dx - 1.6, 2.66, dz, 6.0, 0.10, 9.2, PALETTE.hkAwning2, 0, 0, 0.05);
  // and the striped valance, which is half of what an awning IS
  for (let i = 0; i < 14; i++) {
    M.box(dx - 4.6, 2.42, dz - 4.3 + i * 0.66, 0.16, 0.44, 0.5,
          i % 2 ? PALETTE.hkAwning : PALETTE.hkLaundry);
  }

  // ---- four folding tables and sixteen stools -----------------------------
  for (let t = 0; t < 4; t++) {
    const tz = dz - 3.3 + t * 2.2;
    const tx = dx - 2.95 + (t % 2) * 0.30;
    M.box(tx, 0.70, tz, 1.5, 0.06, 1.5, PALETTE.hkLaundry, 0, t * 0.09, 0);
    for (let l = 0; l < 4; l++) {
      M.box(tx + (l & 1 ? 0.62 : -0.62), 0.35, tz + (l & 2 ? 0.62 : -0.62),
            0.06, 0.70, 0.06, PALETTE.hkPoleSteel);
    }
    solid(tx, 0.37, tz, 1.5, 0.74, 1.5);
    // the four stools: red, plastic, and about twenty centimetres high
    for (let k = 0; k < 4; k++) {
      const a = k * 1.5708 + 0.7854;
      const sx2 = tx + Math.cos(a) * 1.25, sz2 = tz + Math.sin(a) * 1.25;
      M.cyl(sx2, 0.20, sz2, 0.22, 0.06, PALETTE.hkTaxi, 0, a, 0, 8);
      for (let l = 0; l < 3; l++) {
        const b2 = l * 2.094 + a;
        M.box(sx2 + Math.cos(b2) * 0.15, 0.09, sz2 + Math.sin(b2) * 0.15,
              0.05, 0.18, 0.05, PALETTE.hkTaxi);
      }
      // 26 cm is BELOW the 40 cm the animal steps over, so a stool is
      // deliberately NOT solid: it is scenery you walk over, not furniture you
      // walk through. The tables are the other side of that line and they are.
    }
    // what is on the table: a bowl, a pair of chopsticks, a pot of tea
    M.cyl(tx - 0.2, 0.77, tz + 0.1, 0.17, 0.10, PALETTE.hkNeonWhite, 0, 0, 0, 8);
    M.box(tx + 0.1, 0.75, tz + 0.15, 0.02, 0.02, 0.4, PALETTE.hkCrate, 0, 0.4, 0);
    M.cyl(tx + 0.35, 0.80, tz - 0.35, 0.13, 0.16, PALETTE.hkTile3, 0, t * 0.6, 0, 8);
    // a bulb on a flex over every table. It is the warm half of this street.
    M.cyl(tx, 2.30, tz, 0.010, 0.62, 0x2a2a2a, 0, 0, 0, 4);
    hkDPD_BULBS.push(tx, 1.97, tz);
  }

  // ---- the range, against the wall ---------------------------------------
  const rx = dx + 1.45;
  M.box(rx, 0.44, dz, 1.4, 0.88, 5.2, PALETTE.hkConcreteDk);
  M.box(rx, 0.92, dz, 1.6, 0.10, 5.4, PALETTE.hkPoleSteel);
  solid(rx, 0.5, dz, 1.6, 1.0, 5.4);
  // three burner rings and two woks
  for (let i = 0; i < 3; i++) {
    const bz = dz - 1.7 + i * 1.7;
    M.cyl(rx, 0.98, bz, 0.34, 0.06, PALETTE.hkGrille, 0, 0, 0, 8);
    if (i !== 1) {
      M.cyl(rx, 1.12, bz, 0.42, 0.22, PALETTE.hkGrille, 0, 0, 0, 8);
      M.box(rx - 0.75, 1.16, bz, 0.7, 0.05, 0.05, PALETTE.hkCrate);
    }
    hkDPD_FLAME.push(rx, 1.02, bz);
  }
  // the back shelf: a rack of bowls, a row of bottles, a hanging cleaver
  M.box(rx + 0.9, 1.85, dz, 0.5, 0.08, 5.0, PALETTE.hkPoleSteel);
  for (let i = 0; i < 9; i++) {
    M.cyl(rx + 0.9, 1.96 + (i % 3) * 0.09, dz - 2.1 + i * 0.52, 0.15, 0.09,
          i % 2 ? PALETTE.hkNeonWhite : PALETTE.hkTile3, 0, i, 0, 8);
  }
  for (let i = 0; i < 6; i++) {
    M.cyl(rx + 0.55, 2.10, dz - 1.6 + i * 0.62, 0.07, 0.42,
          i % 3 ? PALETTE.hkTile2 : PALETTE.hkCrate, 0, 0, 0, 6);
  }
  // a crate of empties, and a stack of them, because there always is
  for (let i = 0; i < 3; i++) {
    M.box(dx - 3.6, 0.18 + i * 0.30, dz + 3.6, 0.9, 0.30, 0.7, PALETTE.hkCrate, 0, i * 0.12, 0);
  }
  solid(dx - 3.6, 0.45, dz + 3.6, 0.9, 0.9, 0.7);
  // the extractor hood over the range, and the flue up the wall
  M.box(rx + 0.2, 2.35, dz, 1.9, 0.5, 5.0, PALETTE.hkGrille, 0, 0, 0);
  M.cyl(rx + 0.9, 4.6, dz - 2.2, 0.30, 4.0, PALETTE.hkGrille, 0, 0, 0, 8);

  const mesh = new THREE.Mesh(M.build(), hkVC());
  mesh.castShadow = true; mesh.receiveShadow = true;
  root.add(mesh);
  hkSyncBody(body);
  game.world.addBody(body);

  // ---- the bulbs, which are lights and not surfaces -----------------------
  {
    const B = hkMerger();
    for (let i = 0; i < hkDPD_BULBS.length; i += 3) {
      B.sph(hkDPD_BULBS[i], hkDPD_BULBS[i + 1], hkDPD_BULBS[i + 2], 0.09, 0.11, 0.09, 0xffffff);
    }
    const bm = new THREE.Mesh(B.build(),
      new THREE.MeshBasicMaterial({ color: PALETTE.hkNeonGold }));
    bm.frustumCulled = false;
    root.add(bm);
  }

  // ---- the flame, and it is the only fire in the chapter ------------------
  {
    const F = hkMerger();
    // THE SHADE OVER THE BULB, for the second time in this pass. A 30 cm cone at
    // 1.14 sits entirely inside a 42 cm wok spanning 1.01 to 1.23, so the only
    // fire in the chapter was a bright object inside an opaque one. A wok flame
    // does not live under the pan, it LICKS UP ROUND IT: wider than the wok,
    // starting at the burner ring, and a second short one at the rim.
    for (let i = 0; i < hkDPD_FLAME.length; i += 3) {
      F.cone(hkDPD_FLAME[i], hkDPD_FLAME[i + 1] + 0.26, hkDPD_FLAME[i + 2], 0.52, 0.62,
             0xffffff, 0, 0, 0, 8);
      F.cyl(hkDPD_FLAME[i], hkDPD_FLAME[i + 1] + 0.03, hkDPD_FLAME[i + 2], 0.40, 0.10,
            0x9a9a9a, 0, 0, 0, 8);
    }
    // ADDITIVE OVER A DARK STREET SATURATES FAST. At 0.7 with a colour this
    // pale the cone resolved to near-white and read as a paper lampshade over
    // the wok rather than as a flame under it. Deeper orange, less of it.
    hkFlameMat = new THREE.MeshBasicMaterial({
      color: 0xff6f18, transparent: true, opacity: 0.55, depthWrite: false,
      blending: THREE.AdditiveBlending });
    hkFlameMesh = new THREE.Mesh(F.build(), hkFlameMat);
    hkFlameMesh.frustumCulled = false;
    hkFlameMesh.renderOrder = 3;
    root.add(hkFlameMesh);
  }

  // ---- and the steam, which is what you see from up the street ------------
  {
    const S = hkMerger();
    S.sph(0, 0, 0, 0.5, 0.4, 0.5, 0xffffff);
    const im = new THREE.InstancedMesh(S.build(), new THREE.MeshBasicMaterial({
      // FIVE PER CENT, NOT TEN, and see the scale note below: twenty-two
      // half-metre spheres growing to three and a half metres each is a bank
      // of fog over the east pavement, not a plume off two woks.
      color: 0xd8d2c6, transparent: true, opacity: 0.05, depthWrite: false }), hkSTEAM_N);
    im.frustumCulled = false;
    root.add(im);
    hkSteamMesh = im;
    for (let i = 0; i < hkSTEAM_N; i++) {
      const o = i * 4;
      hkSteamData[o] = rx + rand(-0.5, 0.5);
      hkSteamData[o + 1] = rand(0, 4.2);
      hkSteamData[o + 2] = dz + rand(-2.0, 2.0);
      hkSteamData[o + 3] = rand(0.35, 0.85);
    }
  }
}

/**
 * A SEATED PERSON, and this game did not have one.
 *
 * npc.js's buildLocalFigure makes a standing figure and everything in fourteen
 * chapters uses it, which is right for a shopkeeper and wrong for the one
 * person in Mong Kok whose whole character is that he has not got up since the
 * six o'clock news. It is the same box vocabulary — the shins go forward, the
 * thighs go flat, the torso drops thirty-five centimetres and the head keeps
 * the nose, which is the only reason a turning head reads as a turning head.
 *
 * Handed to addLocal as the group option rather than the figure one, so the locals system
 * turns him to watch and breathes him and never tries to animate arms he has
 * not got.
 */
function hkSeatedFigure(shirt, legs, skin) {
  const g = new THREE.Group();
  const part = (w, h, d, col, x, y, z, rx) => {
    const m = new THREE.Mesh(hkG.box, mat(col));
    m.scale.set(w, h, d); m.position.set(x, y, z);
    if (rx) m.rotation.x = rx;
    m.castShadow = true;
    g.add(m);
    return m;
  };
  // thighs forward, shins down
  part(0.17, 0.58, 0.19, legs, -0.12, 0.47, 0.20, Math.PI * 0.5);
  part(0.17, 0.58, 0.19, legs, 0.12, 0.47, 0.20, Math.PI * 0.5);
  part(0.16, 0.46, 0.17, legs, -0.12, 0.23, 0.44);
  part(0.16, 0.46, 0.17, legs, 0.12, 0.23, 0.44);
  part(0.24, 0.09, 0.30, 0x2f2a26, -0.12, 0.04, 0.50);
  part(0.24, 0.09, 0.30, 0x2f2a26, 0.12, 0.04, 0.50);
  // torso, leaning forward over the table, because everybody does
  part(0.48, 0.60, 0.28, shirt, 0, 1.02, 0.06, -0.16);
  part(0.50, 0.07, 0.30, PALETTE.hkGrille, 0, 1.30, 0.10);
  // arms: forearms on the table
  part(0.12, 0.34, 0.13, shirt, -0.28, 1.06, 0.18, 0.55);
  part(0.12, 0.34, 0.13, shirt, 0.28, 1.06, 0.18, 0.55);
  part(0.12, 0.32, 0.12, skin, -0.28, 0.92, 0.42, Math.PI * 0.5);
  part(0.12, 0.32, 0.12, skin, 0.28, 0.92, 0.42, Math.PI * 0.5);
  const head = new THREE.Object3D();
  head.position.set(0, 1.34, 0.12);
  const hp = (w, h, d, col, x, y, z) => {
    const m = new THREE.Mesh(hkG.box, mat(col));
    m.scale.set(w, h, d); m.position.set(x, y, z); m.castShadow = true; head.add(m); return m;
  };
  hp(0.26, 0.30, 0.25, skin, 0, 0.15, 0);
  hp(0.28, 0.10, 0.27, 0x2b2622, 0, 0.29, -0.01);
  hp(0.05, 0.05, 0.05, skin, 0, 0.15, 0.14);      // the nose. It is the FRONT.
  g.add(head);
  return g;
}

function hkUpdateDaiPaiDong(dt) {
  // the burners breathe, out of step, and never all at once
  if (hkFlameMat) {
    hkFlameMat.opacity = 0.40 + Math.sin(hkTime * 9.1) * 0.13 + Math.sin(hkTime * 3.3) * 0.09;
  }
  if (hkFlameMesh) {
    const k = 1 + Math.sin(hkTime * 11.3) * 0.16;
    hkFlameMesh.scale.set(1, k, 1);
  }
  // and the steam goes up and wraps, which is the cheapest plume there is
  if (!hkSteamMesh) return;
  for (let i = 0; i < hkSTEAM_N; i++) {
    const o = i * 4;
    hkSteamData[o + 1] += (0.55 + hkSteamData[o + 3] * 0.35) * dt;
    if (hkSteamData[o + 1] > 4.6) {
      hkSteamData[o + 1] = 0;
      hkSteamData[o] = hkDPD.x + 1.45 + rand(-0.5, 0.5);
      hkSteamData[o + 2] = hkDPD.z + rand(-2.0, 2.0);
      hkSteamData[o + 3] = rand(0.5, 1.3);
    }
    // it SPREADS as it rises and it fades as it spreads, which is the whole
    // reason a plume reads as a plume rather than as a column of balls
    const u = hkSteamData[o + 1] / 4.6;
    const sc = hkSteamData[o + 3] * (0.35 + u * 1.35);
    hkSteamMesh.setMatrixAt(i, hkXform(
      hkSteamData[o] + Math.sin(hkTime * 0.5 + i) * u * 1.1,
      1.3 + hkSteamData[o + 1],
      hkSteamData[o + 2] + Math.cos(hkTime * 0.4 + i * 1.7) * u * 0.8,
      0, i, 0, sc, sc * 0.7, sc));
  }
  hkSteamMesh.instanceMatrix.needsUpdate = true;
}

// ============================================================== THE BAKERY ==
/**
 * THE QUEUE, and it is the only thing in this chapter that WAITS.
 *
 * Eighty people walk past the bakery and nobody has ever bought anything. The
 * first task of the chapter is stealing an egg tart off a tray and the shop it
 * comes out of had one man behind a counter and an empty pavement in front of
 * it — which is the one shop on that street that in life always has four
 * people standing outside it, because the tarts come out in batches and
 * everybody knows when.
 *
 * Three in the line, and the line MOVES: every twelve seconds the one at the
 * front is served and walks off down the pavement, everybody steps up, and
 * somebody new arrives at the back. It is a loop the player can watch a whole
 * cycle of in the time it takes to decide to commit a theft, which is the
 * point of it.
 */
const hkQ_N = 3;
const hkQ_STEP = 1.15;             // m between people in a queue
const hkQ_SERVE = 12.0;            // s a customer takes
let hkQueue = null, hkQueueT = 0, hkQueueGoing = -1;
const hkQueueData = new Float32Array(hkQ_N * 3);   // slot, phase, kind

/**
 * TWO MESHES A PERSON, NOT FOURTEEN.
 *
 * The obvious way to write this — and the way hkSeatedFigure and npc.js's own
 * buildLocalFigure both do it — is one THREE.Mesh per body part, which is
 * fourteen draw calls a figure. Three of them is forty-two, and this chapter's
 * mesh count went 217 → 285 in one commit against a documented ceiling of 220
 * (CONTRACT, performance budget). Everything below the neck never moves
 * relative to anything else below the neck, so it is ONE merged mesh; the head
 * turns, so it is a second one in a group. Six draw calls for the queue.
 */
function hkStandFigure(shirt, legs, skin, hair) {
  const g = new THREE.Group();
  const B = hkMerger();
  B.box(-0.11, 0.41, 0, 0.16, 0.82, 0.18, legs);
  B.box(0.11, 0.41, 0, 0.16, 0.82, 0.18, legs);
  B.box(-0.11, 0.05, 0.03, 0.17, 0.1, 0.26, 0x2f2a26);
  B.box(0.11, 0.05, 0.03, 0.17, 0.1, 0.26, 0x2f2a26);
  B.box(0, 1.13, 0, 0.46, 0.62, 0.27, shirt);
  B.box(0, 1.48, 0, 0.5, 0.08, 0.29, shirt);
  B.box(-0.29, 1.15, 0.02, 0.13, 0.54, 0.14, shirt);
  B.box(0.29, 1.15, 0.02, 0.13, 0.54, 0.14, shirt);
  B.box(-0.29, 0.85, 0.02, 0.12, 0.12, 0.13, skin);
  B.box(0.29, 0.85, 0.02, 0.12, 0.12, 0.13, skin);
  const bm = new THREE.Mesh(B.build(), hkVC());
  bm.castShadow = true;
  g.add(bm);
  const H = hkMerger();
  H.box(0, 0.15, 0, 0.25, 0.29, 0.24, skin);
  H.box(0, 0.29, -0.01, 0.27, 0.09, 0.26, hair);
  H.box(0, 0.15, 0.13, 0.05, 0.05, 0.05, skin);   // the nose. It is the FRONT.
  const hm = new THREE.Mesh(H.build(), hkVC());
  hm.castShadow = true;
  const head = new THREE.Group();
  head.position.set(0, 1.52, 0);
  head.add(hm);
  g.add(head);
  g.userData.head = head;
  return g;
}

function hkBuildQueue(game, root) {
  const SHIRT = [PALETTE.hkNeonCyan, PALETTE.hkLaundry, PALETTE.cloth3 || 0x8f7f6a];
  const LEG = [PALETTE.denim || 0x4a5a70, PALETTE.stoneDark || 0x6b6355, 0x3a3a40];
  const SKIN = [0xe8c9a6, 0xdcb894, 0xc9a077];
  hkQueue = [];
  for (let i = 0; i < hkQ_N; i++) {
    const f = hkStandFigure(SHIRT[i % 3], LEG[i % 3], SKIN[i % 3], 0x2b2622);
    f.rotation.y = -Math.PI * 0.5;               // facing the counter, which is at -x
    root.add(f);
    if (typeof game.registerShadowTarget === 'function') game.registerShadowTarget(f);
    hkQueue.push(f);
    hkQueueData[i * 3] = i;
    hkQueueData[i * 3 + 1] = i * 2.1;
    hkQueueData[i * 3 + 2] = i;
  }
}

function hkUpdateQueue(dt) {
  if (!hkQueue) return;
  hkQueueT += dt;
  if (hkQueueT >= hkQ_SERVE) {
    hkQueueT = 0;
    // the front one is served and leaves; everybody steps up one; whoever was
    // at the back becomes the new front by walking round, which is why the
    // slot is a float and not an index
    let front = 0, best = 1e9;
    for (let i = 0; i < hkQ_N; i++) if (hkQueueData[i * 3] < best) { best = hkQueueData[i * 3]; front = i; }
    hkQueueGoing = front;
    for (let i = 0; i < hkQ_N; i++) hkQueueData[i * 3] -= 1;
    hkQueueData[front * 3] = hkQ_N - 1;
  }
  const bx = hkBAKERY.x + 1.55, bz = hkBAKERY.z;
  for (let i = 0; i < hkQ_N; i++) {
    const o = i * 3;
    const slot = hkQueueData[o];
    const f = hkQueue[i];
    // the one who has just been served walks off up the pavement for two
    // seconds and then reappears at the back, which is the only cheat in it
    let tx = bx, tz = bz - slot * hkQ_STEP, ty = 0, yaw = -Math.PI * 0.5;
    if (i === hkQueueGoing && hkQueueT < 2.2) {
      const u = hkQueueT / 2.2;
      tx = lerp(bx, bx + 1.1, Math.min(1, u * 2));
      tz = lerp(bz + hkQ_STEP, bz + hkQ_STEP + 5.5, u);
      yaw = Math.PI;
      ty = -u * u * 1.9;                          // and he sinks out of frame
    }
    f.position.set(tx, ty, tz);
    f.rotation.y = damp(f.rotation.y, yaw, 6, dt);
    // the shuffle: weight on one foot, then the other, and a look up the
    // street while you wait, which is the whole of standing in a queue
    const ph = hkTime * 0.9 + hkQueueData[o + 1];
    f.position.x += Math.sin(ph) * 0.035;
    if (f.userData.head) {
      f.userData.head.rotation.y = Math.sin(hkTime * 0.42 + i * 2.1) * 0.7;
      f.userData.head.rotation.x = Math.sin(hkTime * 0.31 + i) * 0.08;
    }
  }
}

function hkBuildBakery(game, root) {
  const grp = new THREE.Group();
  const M = hkMerger();
  const bx = hkBAKERY.x, bz = hkBAKERY.z;
  // ---- THE COUNTER CLOSED THE PAVEMENT --------------------------------
  // MEASURED, 23 Aug 2026, by scanning the walkable width of both pavements
  // every half metre (qa/wn-clear.js): the west pavement was ZERO METRES
  // WIDE from z 23.5 to 28.5. The shopfront collider's face is at
  // −(hkFACE − 0.7) = −9.8 and this counter ran from −8.8 to −6.4, which
  // leaves a one-metre slot for an animal that is nine tenths of a metre
  // across — five metres of the chapter's main north-south route sealed by
  // the shop its FIRST TASK is at, and nothing had ever noticed because the
  // task itself is done from the road side.
  //
  // A counter goes against the wall. Hard against the shopfront, 1.5 m deep
  // instead of 2.4, which is what one actually is, and the lane past it is
  // 1.9 m.
  const cxb = bx - 0.2;                                   // the counter's centre
  M.box(bx + 0.55, 3.3, bz, 3.0, 0.16, 5.0, PALETTE.hkAwning, 0, 0, -0.12);
  for (let i = 0; i < 6; i++) {
    M.box(bx + 2.0, 3.5 - i * 0.02, bz - 2.4 + i * 0.96, 0.2, 0.5, 0.48,
          i % 2 ? PALETTE.hkLaundry : PALETTE.hkAwning);
  }
  M.box(cxb, 0.5, bz, 1.5, 1.0, 4.4, PALETTE.hkLaundry);
  M.box(cxb, 1.05, bz, 1.7, 0.1, 4.6, PALETTE.hkPoleSteel);
  for (let i = 0; i < 14; i++) {
    const r = i % 7, c = (i / 7) | 0;
    M.cyl(cxb - 0.35 + c * 0.7, 1.16, bz - 2.0 + r * 0.62, 0.21, 0.12,
          PALETTE.hkNeonGold, 0, 0, 0, 8);
    M.cyl(cxb - 0.35 + c * 0.7, 1.21, bz - 2.0 + r * 0.62, 0.15, 0.06,
          PALETTE.hkCrate, 0, 0, 0, 8);
  }
  const mesh = new THREE.Mesh(M.build(), hkVC());
  mesh.castShadow = true;
  grp.add(mesh);
  // and the sign, in the two scripts the city actually uses. It is a LIGHT.
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.4, 4.6),
                              hkGlowMat(PALETTE.hkNeonPink));
  sign.position.set(bx + 2.6, 5.2, bz);
  grp.add(sign);
  root.add(grp);
  hkBakeryGroup = grp;
  hkStaticBox(game, cxb, 0.5, bz, 1.5, 1.0, 4.4);
}

// ========================================================== THE WET MARKET ==
/**
 * A covered lane off the east side: strip lights, wet tile, and six tanks with
 * something alive in each. Open one and the fish go over the floor, which is a
 * thing that happens in that market about once a week without any help from a
 * capybara at all.
 */
function hkBuildMarket(game, root) {
  const M = hkMerger();
  const mx = hkMARKET.x, mz = hkMARKET.z;
  // the roof over the lane
  M.box(mx, 5.0, mz, 24, 0.35, 15, PALETTE.hkConcreteDk);
  // TWELVE STEEL POSTS HOLDING UP A CONCRETE SLAB, and not one of them was
  // solid. They are 28 cm — under the 45 cm the audit calls furniture, which is
  // why they survived the last sweep — but they are the only vertical things in
  // the lane the chapter's fifth task is at the end of, and a roof you can walk
  // through the legs of is a roof standing on nothing. One compound body for
  // all twelve, which is one broadphase entry.
  const mpost = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
  for (let i = 0; i < 6; i++) {
    M.box(mx - 10 + i * 4, 2.5, mz - 7, 0.28, 5, 0.28, PALETTE.hkPoleSteel);
    M.box(mx - 10 + i * 4, 2.5, mz + 7, 0.28, 5, 0.28, PALETTE.hkPoleSteel);
    for (let sd = -1; sd <= 1; sd += 2) {
      mpost.addShape(new CANNON.Box(new CANNON.Vec3(0.2, 2.5, 0.2)),
                     new CANNON.Vec3(mx - 10 + i * 4, 2.5, mz + sd * 7));
    }
  }
  hkSyncBody(mpost);
  game.world.addBody(mpost);

  // ---- THE STALLS, AND WHAT IS ON THEM ------------------------------------
  // Six plain crates under a concrete slab, and this is the chapter's fifth
  // task. Rendered, the lane read as a loading bay: no colour, nothing to look
  // at, nothing to want. A wet market is the most crowded surface in the city —
  // tarpaulin over the top, red plastic basins, a tray of ice, greens in crates,
  // a scale hanging off the frame, and a hose running down the middle of the
  // floor because the floor is why it is called a wet market.
  const BASIN = [0xc4483f, 0x3f7fc4, 0xd8b24a];
  const GREENS = [0x6f9c58, 0x8fb56a, 0x4f7c46, 0xc9d17a];
  let mseed = 7717;
  const mrnd = () => { mseed = (mseed * 1103515245 + 12345) & 0x7fffffff; return mseed / 0x7fffffff; };
  for (let s = 0; s < 6; s++) {
    const sx = mx - 9 + (s % 3) * 9;
    const sz = mz + (s < 3 ? -4 : 4);
    M.box(sx, 0.5, sz, 3.4, 1.0, 2.2, PALETTE.hkCrate);
    M.box(sx, 1.06, sz, 3.6, 0.12, 2.4, PALETTE.hkTile);
    hkStaticBox(game, sx, 0.5, sz, 3.4, 1.0, 2.2);
    // a tarpaulin over each stall, on its own two poles
    // A TARPAULIN IS A ROOF OVER THE STALL, not a panel beside it. The first
    // cut hung 3.8 m of saturated blue at 2.55 with its far edge a metre and a
    // half clear of the crates, so from the lane it was a bright slab flying at
    // eye height with nothing under it.
    const tarp = s % 2 ? 0x3f6f96 : 0x9e4a40;
    const out = s < 3 ? -1 : 1;
    M.box(sx, 2.28, sz + out * 0.55, 3.7, 0.06, 3.0, tarp, out * 0.26);
    M.box(sx - 1.75, 1.6, sz + out * 1.9, 0.08, 3.2, 0.08, PALETTE.hkPoleSteel);
    M.box(sx + 1.75, 1.6, sz + out * 1.9, 0.08, 3.2, 0.08, PALETTE.hkPoleSteel);
    // basins along the front edge
    for (let k = 0; k < 3; k++) {
      const bx2 = sx - 1.1 + k * 1.1;
      const bz2 = sz + (s < 3 ? -0.85 : 0.85);
      M.cyl(bx2, 1.28, bz2, 0.42, 0.32, BASIN[(k + s) % 3], 0, 0, 0, 8);
      M.cyl(bx2, 1.42, bz2, 0.34, 0.06, k % 2 ? PALETTE.hkFish : 0xe8eef0, 0, 0, 0, 8);
    }
    // crates of greens behind them, stacked two high on one stall in three
    for (let k = 0; k < 2; k++) {
      const cx2 = sx - 0.9 + k * 1.8, cz2 = sz + (s < 3 ? 0.55 : -0.55);
      M.box(cx2, 1.28, cz2, 1.4, 0.32, 0.9, PALETTE.hkCrate);
      for (let g2 = 0; g2 < 5; g2++) {
        M.sph(cx2 + rand(-0.5, 0.5), 1.5 + rand(0, 0.1), cz2 + rand(-0.3, 0.3),
              0.2, 0.16, 0.2, GREENS[(g2 + s + k) % GREENS.length]);
      }
      if (s % 3 === 0) M.box(cx2, 1.72, cz2, 1.4, 0.3, 0.9, PALETTE.hkCrate);
    }
    // a hanging scale on the frame, which every one of these has
    M.cyl(sx + 1.5, 2.15, sz, 0.02, 0.7, PALETTE.hkPoleSteel, 0, 0, 0, 4);
    M.cyl(sx + 1.5, 1.72, sz, 0.24, 0.14, PALETTE.hkPoleSteel, 0, 0, 0, 8);
    M.cyl(sx + 1.5, 1.6, sz, 0.34, 0.06, PALETTE.hkConcrete, 0, 0, 0, 8);
    // a bare bulb over it, warm, on a flex
    hkMarketBulbs.push(sx, 2.02, sz - out * 0.9);
    M.cyl(sx, 2.4, sz - out * 0.9, 0.012, 0.75, 0x2a2a2a, 0, 0, 0, 4);
  }
  // the floor: wet, and it slopes to a gutter down the middle
  M.box(mx, 0.02, mz, 23, 0.04, 14, 0x4d5152);
  M.box(mx, 0.03, mz, 23, 0.05, 0.5, 0x3a3d3e);
  for (let i = 0; i < 9; i++) {
    M.box(mx - 10 + i * 2.5, 0.05, mz + rand(-5, 5), rand(0.5, 1.4), 0.02, rand(0.4, 1.1),
          0x5d6364);
  }
  // and a hose, coiled where somebody left it
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * 6.28;
    M.cyl(mx - 8.5 + Math.cos(a) * 0.55, 0.09, mz + 5.4 + Math.sin(a) * 0.55, 0.06, 0.45,
          0x3f6b4a, Math.PI * 0.5, a, 0, 4);
  }
  // ---- THE ROAST MEAT SHOP, and it is the whole read of the lane ----------
  // A wet market lane in this city is not six crates of greens under a slab —
  // one end of it is a siu mei window with thirty ducks and half a pig hanging
  // in a lit box, and it is the most photographed shopfront in Hong Kong.
  // It also solves the lane's other problem: everything in here was pale tan
  // at the same value, so there was nothing to walk TOWARD.
  {
    const sx = mx + 9.5, sz = mz;
    M.box(sx + 1.6, 2.3, sz, 1.4, 4.6, 9.0, PALETTE.hkTile2);            // the back
    M.box(sx + 0.5, 4.9, sz, 3.4, 0.7, 9.4, PALETTE.hkTaxi);             // the fascia
    M.box(sx + 0.1, 0.55, sz, 1.6, 1.1, 8.0, PALETTE.hkPoleSteel);       // the counter
    M.box(sx + 0.1, 1.14, sz, 1.8, 0.12, 8.2, PALETTE.hkConcrete);
    // ---- the glazed hot box, lit, with the birds hanging IN FRONT of it --
    // The lit pane has to sit BETWEEN the back wall and the birds or the whole
    // shop is one orange rectangle: it is the light, and everything the shop
    // is about is a silhouette on it. And the 'glass' is a FRAME, not a plate
    // — 12 cm of opaque steel across the front of a lit box is a lit box with
    // a lid on it, which is the same mistake as the wok flame under its own
    // wok, one chapter along.
    hkSHOPLIT.push(sx + 0.6, 2.9, sz, 0.5, 2.2, 7.6, 0xffca7a);
    for (let e = -1; e <= 1; e += 2) {
      M.box(sx - 0.35, 2.9, sz + e * 3.9, 0.16, 2.5, 0.22, PALETTE.hkPoleSteel);
    }
    M.box(sx - 0.35, 4.1, sz, 0.16, 0.2, 8.0, PALETTE.hkPoleSteel);
    M.box(sx - 0.35, 1.7, sz, 0.16, 0.2, 8.0, PALETTE.hkPoleSteel);
    M.box(sx - 0.3, 3.9, sz, 0.2, 0.16, 7.8, PALETTE.hkGrille);          // the rail
    for (let i = 0; i < 11; i++) {
      const dz2 = sz - 3.4 + i * 0.68;
      M.cyl(sx - 0.3, 3.62, dz2, 0.03, 0.5, PALETTE.hkGrille, 0, 0, 0, 4);
      // a whole roast duck: a body, a neck curled over, and the glaze
      M.sph(sx - 0.3, 3.06, dz2, 0.19, 0.42, 0.19, 0x8c3a1e);
      M.box(sx - 0.3, 3.42, dz2 + 0.1, 0.12, 0.34, 0.16, 0x8c3a1e, 0.5);
      if (i % 4 === 2) {
        M.box(sx - 0.3, 2.9, dz2, 0.3, 0.9, 0.5, 0xa8462a);              // a slab of char siu
      }
    }
    // the chopping block and the cleaver, which is the whole business
    M.cyl(sx - 0.2, 1.32, sz - 2.2, 0.42, 0.24, PALETTE.hkCrate, 0, 0, 0, 8);
    M.box(sx - 0.2, 1.5, sz - 2.2, 0.3, 0.16, 0.2, PALETTE.hkPoleSteel, 0, 0.6, 0);
    hkStaticBox(game, sx + 0.1, 0.55, sz, 1.6, 1.2, 8.0);
    hkStaticBox(game, sx + 1.6, 2.3, sz, 1.4, 4.6, 9.0);
  }


  // the tube housings the strips hang in — these have to be laid BEFORE
  // M.build() below, which is exactly the trap the Drift pennants fell into:
  // a merger takes geometry after it has been built and simply never draws it.
  for (let i = 0; i < 5; i++) {
    M.box(mx - 8 + i * 4, 4.74, mz, 0.68, 0.2, 13.2, PALETTE.hkPoleSteel);
    M.box(mx - 8 + i * 4, 4.84, mz, 0.16, 0.3, 13.2, PALETTE.hkGrille);
  }

  const mesh = new THREE.Mesh(M.build(), hkVC());
  mesh.castShadow = true; mesh.receiveShadow = true;
  root.add(mesh);

  // the strip lights, which are the only thing lighting this lane and therefore
  // cannot be lit BY it — five emissive tubes, one draw call
  {
    const L = hkMerger();
    for (let i = 0; i < 5; i++) {
      // a tube in a HOUSING: a bare emissive slab at 4.6 m read as five
      // fluorescent slots cut in the ceiling with nothing holding them
      L.box(mx - 8 + i * 4, 4.6, mz, 0.5, 0.16, 13, 0xffffff);
    }
    const lm = new THREE.Mesh(L.build(),
      mat(PALETTE.hkNeonWhite, { vertexColors: true, emissive: PALETTE.hkNeonWhite }));
    lm.frustumCulled = false;
    root.add(lm);
    // and the bare bulbs over the stalls, which are the warm half of the light
    const B = hkMerger();
    for (let i = 0; i < hkMarketBulbs.length; i += 3) {
      B.sph(hkMarketBulbs[i], hkMarketBulbs[i + 1], hkMarketBulbs[i + 2], 0.16, 0.2, 0.16, 0xffe2a8);
    }
    const bm = new THREE.Mesh(B.build(), new THREE.MeshBasicMaterial({ vertexColors: true }));
    bm.frustumCulled = false;
    root.add(bm);
  }

  // ---- AND THE LIGHT HAS TO LAND ON SOMETHING ----------------------------
  // The lane had five emissive tubes and six bulbs in it and the floor under
  // them was the same near-black as the road outside — which is the mistake
  // this project has now made in a colonnade in Venice, on a lamp-post in the
  // Drift, under sixty neon signs in this street and in a market lane: NOTHING
  // IN THIS GAME CASTS LIGHT, so a lamp is a lamp plus the pool you paint
  // under it. Five long soft strips down the lane for the tubes and a round
  // one under each bulb, additive, on the wet tile they are lighting.
  {
    const G = hkMerger();
    const c = new THREE.Color();
    for (let i = 0; i < 5; i++) {
      for (let r = 3; r >= 0; r--) {
        const u = (r + 1) / 4;
        c.set(0xf0f4ff).multiplyScalar((1 - u) * (1 - u) * 0.9 + 0.1);
        G.box(mx - 8 + i * 4, 0.006 - r * 0.002, mz, 3.4 * u + 0.6, 0.02, 13.4,
              '#' + c.getHexString());
      }
    }
    for (let i = 0; i < hkMarketBulbs.length; i += 3) {
      for (let r = 3; r >= 0; r--) {
        const u = (r + 1) / 4;
        c.set(0xffd89a).multiplyScalar((1 - u) * (1 - u) * 0.9 + 0.1);
        G.cyl(hkMarketBulbs[i], 0.014 - r * 0.002, hkMarketBulbs[i + 2], 1.5 * u + 0.3, 0.02,
              '#' + c.getHexString(), 0, 0, 0, 16);
      }
    }
    const gm = new THREE.Mesh(G.build(), new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.13,
      depthWrite: false, blending: THREE.AdditiveBlending }));
    gm.position.y = 0.05;
    gm.renderOrder = 2;
    gm.frustumCulled = false;
    root.add(gm);
  }

  // the tanks, which are their own group so they can be knocked about
  const T = hkMerger();
  for (let s = 0; s < 6; s++) {
    const sx = mx - 9 + (s % 3) * 9;
    const sz = mz + (s < 3 ? -4 : 4);
    T.box(sx, 1.55, sz, 2.2, 0.9, 1.5, PALETTE.hkFish);
    T.box(sx, 1.98, sz, 2.3, 0.06, 1.6, PALETTE.hkPoleSteel);
  }
  const tm = new THREE.Mesh(T.build(), mat(PALETTE.hkFish, { transparent: true, opacity: 0.62 }).clone());
  tm.renderOrder = 2;
  root.add(tm);
  hkTankGroup = tm;

  // and the fish, once they are out
  hkFishData = new Float32Array(26 * 6);
  const fg = new THREE.BoxGeometry(0.36, 0.14, 0.14);
  const fm = new THREE.InstancedMesh(fg, mat(PALETTE.hkFish), 26);
  for (let i = 0; i < 26; i++) {
    const o = i * 6;
    hkFishData[o] = mx + rand(-9, 9);
    hkFishData[o + 1] = mz + rand(-5, 5);
    hkFishData[o + 2] = rand(0, 6.28);
    hkFishData[o + 3] = rand(2.5, 5.5);
    hkFishData[o + 4] = rand(0.7, 1.5);
    hkFishData[o + 5] = 0;
    fm.setMatrixAt(i, hkXform(0, -50, 0, 0, 0, 0, 1, 1, 1));
  }
  fm.instanceMatrix.needsUpdate = true;
  fm.frustumCulled = false;
  root.add(fm);
  hkFishMesh = fm;
}

// ============================================================== THE CROWD ===
/**
 * MONG KOK IS THE DENSEST PLACE ON EARTH AND THERE WAS NOBODY IN IT.
 *
 * Eleven chapters in, this one shipped with three locals — a baker, a
 * fishmonger and a man on the pier — and a hundred and six metres of empty
 * pavement between them. Every shot of the street was a photograph of a set:
 * the neon was right, the scaffold was right, the taxis were parked, and the
 * one thing Mong Kok is actually famous for was missing.
 *
 * The pattern is Rio's and Marrakech's ([[capy3-chapters-six-seven-eight]]),
 * with one thing added that those two did not have: the legs and the arms are
 * on their OWN instanced meshes, in antiphase, so this crowd walks rather than
 * bobbing. Five draw calls for eighty people.
 *
 *   limbA  left leg + right arm, pivoted at the hip
 *   limbB  right leg + left arm
 *   body   torso and shoulders
 *   head   head, hair and a nose, which is the only reason it has a front
 *   brolly one in seven of them, because the street is always wet
 *
 * instanceColor MULTIPLIES the vertex colour, so every part is authored pale
 * or a bright jacket turns somebody's face orange.
 */
const hkCROWD_N = 80;
let hkCrowd = null;
const hkCrowdData = new Float32Array(hkCROWD_N * 6);   // x, z, dir, speed, phase, kind

function hkCrowdGeo(parts) { const M = hkMerger(); parts(M); return M.build(); }
function hkBuildCrowd(game, root) {
  const limb = (sgn) => hkCrowdGeo((M) => {
    M.box(sgn * 0.11, -0.4, 0, 0.16, 0.8, 0.18, 0xf2f2f2);          // the leg
    M.box(sgn * 0.11, -0.79, 0.03, 0.17, 0.1, 0.26, 0xdcdcdc);      // and its shoe
    M.box(-sgn * 0.29, 0.24, 0, 0.13, 0.54, 0.14, 0xffffff);        // the opposite arm
    M.box(-sgn * 0.29, -0.06, 0, 0.12, 0.12, 0.13, 0xe8e8e8);       // and its hand
  });
  const gBody = hkCrowdGeo((M) => {
    M.box(0, 0, 0, 0.46, 0.62, 0.27, 0xffffff);
    M.box(0, 0.35, 0, 0.5, 0.08, 0.29, 0xf0f0f0);                   // the collar
  });
  const gHead = hkCrowdGeo((M) => {
    M.box(0, 0, 0, 0.25, 0.29, 0.24, 0xffffff);
    M.box(0, 0.16, -0.01, 0.27, 0.09, 0.26, 0x9c9c9c);              // hair
    M.box(0, 0.0, 0.135, 0.05, 0.05, 0.05, 0xffffff);               // the nose
  });
  // ---- AND SOME OF THEM ARE CARRYING SOMETHING ---------------------------
  // Eighty people walking down the busiest shopping street in the world with
  // empty hands. A plastic bag is four boxes, it swings on the same phase the
  // arm does (it hangs off limbA, which IS the arm), and one in three of a
  // crowd changes what a crowd is about.
  const gBag = hkCrowdGeo((M) => {
    M.box(0, 0, 0, 0.26, 0.34, 0.16, 0xffffff);
    M.box(0, 0.2, 0, 0.2, 0.1, 0.13, 0xe4e4e4);
    M.box(0, 0.3, 0, 0.16, 0.12, 0.03, 0xd0d0d0);
  });
  const gBrolly = hkCrowdGeo((M) => {
    // A CONE'S APEX IS ALREADY UP. Turned through PI it is a bowl on a stick,
    // which is what one in seven of the crowd was carrying.
    M.cyl(0, -0.1, 0, 0.03, 1.0, 0x8a8a8a, 0, 0, 0, 4);
    M.cone(0, 0.56, 0, 0.62, 0.36, 0xffffff, 0, 0, 0, 8);
    M.cyl(0, 0.4, 0, 0.6, 0.03, 0xdedede, 0, 0, 0, 8);
  });
  const mk = (geo) => {
    const m = new THREE.InstancedMesh(geo, mat(0xffffff, { vertexColors: true }), hkCROWD_N);
    m.castShadow = true; m.frustumCulled = false;
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(hkCROWD_N * 3), 3);
    root.add(m);
    return m;
  };
  hkCrowd = { a: mk(limb(1)), b: mk(limb(-1)), body: mk(gBody), head: mk(gHead),
              brolly: mk(gBrolly), bag: mk(gBag) };
  let seed = 60318;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  // jackets, and skins for the heads: a crowd all one colour is a queue
  const JACKET = [0xd8dde0, 0x9fb4c8, 0xc9a1a8, 0x7f8a94, 0xe0d8c4, 0xb5c8b0, 0x5f6b78, 0xd7c48c];
  const SKIN = [0xe8c9a6, 0xdcb894, 0xf0d4b4, 0xc9a077];
  const col = new THREE.Color();
  for (let i = 0; i < hkCROWD_N; i++) {
    const o = i * 6;
    // four lanes: two on each pavement, one going each way
    const lane = i % 4;
    const side = lane < 2 ? -1 : 1;
    const dir = (lane % 2) ? 1 : -1;
    hkCrowdData[o] = side * (7.35 + (lane % 2) * 1.75);
    hkCrowdData[o + 1] = hkST_Z0 + rnd() * (hkST_Z1 - hkST_Z0);
    hkCrowdData[o + 2] = dir;
    hkCrowdData[o + 3] = 0.85 + rnd() * 0.7;
    hkCrowdData[o + 4] = rnd() * 6.28;
    // bit 0 an umbrella, bit 1 a carrier bag: they are independent, because
    // in the rain half the street is holding both
    hkCrowdData[o + 5] = (rnd() < 0.14 ? 1 : 0) | (rnd() < 0.34 ? 2 : 0);
    col.set(JACKET[(rnd() * JACKET.length) | 0]);
    for (const m of [hkCrowd.a, hkCrowd.b, hkCrowd.body]) m.instanceColor.setXYZ(i, col.r, col.g, col.b);
    col.set(SKIN[(rnd() * SKIN.length) | 0]);
    hkCrowd.head.instanceColor.setXYZ(i, col.r, col.g, col.b);
    col.set(rnd() < 0.5 ? 0x2f3438 : 0x8c3f3a);
    hkCrowd.brolly.instanceColor.setXYZ(i, col.r, col.g, col.b);
    col.set(hkBAG[(rnd() * hkBAG.length) | 0]);
    hkCrowd.bag.instanceColor.setXYZ(i, col.r, col.g, col.b);
  }
  for (const k of ['a', 'b', 'body', 'head', 'brolly', 'bag']) {
    hkCrowd[k].instanceColor.needsUpdate = true;
  }
}
// what a Hong Kong carrier bag is: white plastic, a supermarket red, and the
// pink-and-blue-striped nylon one that everything in this city moves in
const hkBAG = [0xe8e4dc, 0xc4483f, 0xd8c9a0, 0xdc8fa8, 0x7fa8c4];

function hkUpdateCrowd(game, dt) {
  if (!hkCrowd) return;
  const cp = game.capy && game.capy.position;
  for (let i = 0; i < hkCROWD_N; i++) {
    const o = i * 6;
    let x = hkCrowdData[o];
    let z = hkCrowdData[o + 1];
    // ---- AND THEY GO ROUND THE DAI PAI DONG ------------------------------
    // The two east lanes run at x 7.35 and 9.10 and the stall now occupies
    // x 3.7 to 10.2 between z -28 and -20 — so forty people an evening walked
    // through four tables, a wok range, a man cooking and a man eating. Which
    // is the thing every audit in this project keeps finding: a new object
    // placed on an existing path.
    //
    // They step off the KERB to get round it, which is what happens on that
    // street, and the smoothstep is what makes it a curve rather than a jink.
    // Only the OUTER lane, at 9.10, which is the one the wok range is on. The
    // inner lane at 7.35 walks down the two metres of pavement the stall was
    // rebuilt to leave, which is the point of leaving it.
    if (x > 8.5) {
      const u = 1 - Math.min(1, Math.abs(z - hkDPD.z) / 7.0);
      if (u > 0) x = lerp(x, 7.15, u * u * (3 - 2 * u));
    }
    const dir = hkCrowdData[o + 2];
    const spd = hkCrowdData[o + 3];
    // A CAPYBARA ON THE PAVEMENT IS A THING THAT HAPPENS TO YOU. Anyone within
    // three metres stops dead and turns to look, which costs one comparison and
    // is the only acknowledgement the street has ever given the animal.
    let look = 0;
    if (cp) {
      const dx = x - cp.x, dz = z - cp.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 12.25) look = 1 - Math.sqrt(d2) / 3.5;
    }
    // ---- AND THEY STOP FOR THINGS ----------------------------------------
    // A crowd that walks through a red light and past the one event in the
    // chapter is a conveyor belt. Two holds, both of them things a real crowd
    // on this street does and both of them free:
    //
    //   THE CROSSING. Anybody within two metres of a zebra at a red waits at
    //   the kerb. It is why the crossing exists, it is what makes the tick
    //   mean something, and it puts a little knot of people at two fixed
    //   points on the pavement instead of an even stream.
    //
    //   THE SHOW. The man on the pier says 'lights start at eight, everybody
    //   stops walking' — and for eleven chapters nobody did. During the
    //   Symphony they stop where they are and TURN SOUTH, toward the harbour,
    //   which from the middle of the street is eighty people all facing the
    //   same way at something you cannot see from down there.
    let hold = 0, faceZ = 0;
    if (hkShow > 0.35) { hold = Math.max(hold, hkShow); faceZ = -1; }
    if (!hkCrossGreen()) {
      for (let c = 0; c < hkCROSS_Z.length; c++) {
        const dzc = z - hkCROSS_Z[c];
        // only the one walking INTO the crossing waits at it
        if (dzc * dir < 0 && dzc * dir > -2.6) { hold = 1; break; }
      }
    }
    const move = spd * (1 - look) * (1 - hold) * dt;
    z += dir * move;
    if (z > hkST_Z1 - 1) z = hkST_Z0 + 1;
    if (z < hkST_Z0 + 1) z = hkST_Z1 - 1;
    hkCrowdData[o + 1] = z;
    let ph = hkCrowdData[o + 4] + move * 3.4;
    hkCrowdData[o + 4] = ph;
    let yaw = dir > 0 ? 0 : Math.PI;
    if (faceZ && hold > 0.35) yaw = Math.PI + Math.sin(i * 2.3) * 0.34;
    if (look > 0.05 && cp) yaw = Math.atan2(cp.x - x, cp.z - z);
    const swing = Math.sin(ph) * 0.52 * (1 - look);
    const bob = Math.abs(Math.sin(ph)) * 0.045 * (1 - look);
    // and a head tipped UP at the far shore, which is the whole gesture
    const upv = faceZ && hold > 0.35 ? -0.30 - Math.sin(i) * 0.08 : 0;
    hkCrowd.a.setMatrixAt(i, hkXform(x, 0.82 + bob, z, swing, yaw, 0, 1, 1, 1));
    hkCrowd.b.setMatrixAt(i, hkXform(x, 0.82 + bob, z, -swing, yaw, 0, 1, 1, 1));
    hkCrowd.body.setMatrixAt(i, hkXform(x, 1.14 + bob, z, 0, yaw, 0, 1, 1, 1));
    // the head dips for something capybara-sized, which is the whole gesture
    hkCrowd.head.setMatrixAt(i, hkXform(x, 1.62 + bob, z, look * 0.5 + upv, yaw, 0, 1, 1, 1));
    const kind = hkCrowdData[o + 5];
    const bs = (kind & 1) ? 1 : 0.0001;
    hkCrowd.brolly.setMatrixAt(i, hkXform(x + Math.sin(yaw) * 0.16, 1.62 + bob,
      z + Math.cos(yaw) * 0.16, 0.12, yaw, 0, bs, bs, bs));
    // the bag hangs off the same hip the swinging arm does, so it swings
    const gs = (kind & 2) ? 1 : 0.0001;
    const hx2 = Math.cos(yaw) * 0.30, hz2 = -Math.sin(yaw) * 0.30;
    hkCrowd.bag.setMatrixAt(i, hkXform(
      x + hx2 - Math.sin(yaw) * Math.sin(ph) * 0.16, 1.02 + bob,
      z + hz2 - Math.cos(yaw) * Math.sin(ph) * 0.16,
      -swing * 0.5, yaw, 0, gs, gs, gs));
  }
  for (const k of ['a', 'b', 'body', 'head', 'brolly', 'bag']) {
    hkCrowd[k].instanceMatrix.needsUpdate = true;
  }
}

// ============================================================ THE HARBOUR ===
function hkBuildHarbour(game, root) {
  const M = hkMerger();
  // the pier: a concrete apron and a timber pontoon out into the water
  M.box(0, -0.15, hkPIER_Z + 3, 22, 0.3, 8, PALETTE.hkConcrete);
  hkStaticBox(game, 0, -0.2, hkPIER_Z + 3, 22, 0.5, 8);
  for (let i = 0; i < 5; i++) {
    const z = hkPIER_Z - i * 2.4;
    M.box(0, -0.25, z, 9, 0.34, 2.3, PALETTE.hkFerry);
    hkStaticBox(game, 0, -0.3, z, 9, 0.5, 2.3);
    M.cyl(-4.2, -2.2, z, 0.22, 4.2, PALETTE.hkBambooDk, 0, 0, 0, 6);
    M.cyl(4.2, -2.2, z, 0.22, 4.2, PALETTE.hkBambooDk, 0, 0, 0, 6);
  }
  // ---- THE CLOCK TOWER, AND IT WAS EIGHT METRES OF TAN BOX ---------------
  // The last piece of the 1915 Kowloon terminus, and everything else on that
  // shore was demolished round it — it is the only OLD thing in the chapter
  // and it is the one landmark you can see the pier by from halfway up the
  // street. It was a 3.2 m box eight metres tall with a white disc stuck on
  // the side of it, which from the road is a bollard, and from the pontoon it
  // was a featureless tan slab filling a third of the frame.
  //
  // The real one is forty-four metres of red brick and granite with a
  // colonnaded cupola on the top and a clock face on all four sides. Twenty-
  // six here, because it has to sit UNDER the far shore rather than in front
  // of it, and everything about it is authored to be read in silhouette from
  // three hundred metres up the street.
  {
    const tx = 8.6, tz = hkPIER_Z - 2.6, TW = 4.6, TH = 26;
    M.box(tx, 0.9, tz, TW + 1.6, 1.8, TW + 1.6, PALETTE.hkConcrete);      // plinth
    M.box(tx, TH * 0.5 + 1.2, tz, TW, TH, TW, PALETTE.hkJunkSail);        // the brick shaft
    // granite banding, every six metres, which is what the real one has
    for (let k = 1; k <= 4; k++) {
      M.box(tx, 1.2 + k * 5.2, tz, TW + 0.34, 0.5, TW + 0.34, PALETTE.hkConcrete);
    }
    // corner pilasters, so a square tower has edges at night
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI * 0.5 + Math.PI * 0.25;
      M.box(tx + Math.sin(a) * TW * 0.62, TH * 0.5 + 1.2, tz + Math.cos(a) * TW * 0.62,
            0.9, TH, 0.9, PALETTE.hkConcrete, 0, a);
    }
    // the arched doorway on the street side
    M.box(tx, 1.9, tz + TW * 0.5 + 0.05, 1.9, 3.4, 0.4, 0x14161a);
    for (let k = 0; k < 6; k++) {
      const a = (k + 0.5) / 6 * Math.PI;
      M.box(tx + Math.cos(a) * 1.2, 3.5 + Math.sin(a) * 1.2, tz + TW * 0.5 + 0.16,
            Math.PI * 1.2 / 6 + 0.14, 0.4, 0.44, PALETTE.hkConcrete, 0, 0, a - Math.PI * 0.5);
    }
    // the belfry stage and the cupola on top of it
    M.box(tx, TH + 2.0, tz, TW + 1.2, 1.4, TW + 1.2, PALETTE.hkConcrete);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI * 0.5;
      M.box(tx + Math.sin(a) * TW * 0.52, TH + 4.0, tz + Math.cos(a) * TW * 0.52,
            2.4, 2.6, 0.34, 0x14161a, 0, a);
    }
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI * 0.5 + Math.PI * 0.25;
      M.cyl(tx + Math.sin(a) * TW * 0.62, TH + 4.0, tz + Math.cos(a) * TW * 0.62,
            0.34, 2.6, PALETTE.hkConcrete, 0, 0, 0, 8);
    }
    M.box(tx, TH + 5.6, tz, TW + 1.6, 0.7, TW + 1.6, PALETTE.hkConcrete);
    M.cyl(tx, TH + 6.6, tz, TW * 0.42, 1.6, PALETTE.hkConcrete, 0, 0, 0, 8);
    M.sph(tx, TH + 7.9, tz, TW * 0.34, TW * 0.3, TW * 0.34, PALETTE.hkFerryTrim);
    M.cyl(tx, TH + 9.4, tz, 0.07, 2.2, PALETTE.hkPoleSteel, 0, 0, 0, 4);
    hkStaticBox(game, tx, TH * 0.5 + 1.2, tz, TW + 1.2, TH, TW + 1.2);
    // ---- and FOUR clock faces, because it is a clock ---------------------
    // The face is a LIGHT (it is lit from inside, and always has been), and it
    // is the thing that identifies the pier from the top of the street — so
    // there is one on every side and the hands are on it, which is the only
    // reason anybody would call it a clock rather than a disc.
    // FOUR FACES AND FOUR SETS OF HANDS IS TWO DRAW CALLS, not eight: the
    // merger bakes the per-face rotation into the geometry, so one mesh for
    // the lit dials and one for the dark hands. (CONTRACT: draw calls < 220,
    // and this chapter is the closest one to it.)
    const CY2 = TH - 3.6;
    const FD = hkMerger(), HD = hkMerger();
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI * 0.5;
      const sa = Math.sin(a), ca = Math.cos(a);
      const fx2 = tx + sa * (TW * 0.5 + 0.16), fz2 = tz + ca * (TW * 0.5 + 0.16);
      M.cyl(fx2, CY2, fz2, 1.65, 0.28, PALETTE.hkConcrete, Math.PI * 0.5, a, 0, 16);
      FD.cyl(tx + sa * (TW * 0.5 + 0.30), CY2, tz + ca * (TW * 0.5 + 0.30),
             1.42, 0.2, 0xf2ead2, Math.PI * 0.5, a, 0, 16);
      // the hands, dark on the lit face: ten past ten, which is what every
      // clock in every photograph says. The across-axis of a box yawed by `a`
      // is (cos a, −sin a), so the hand's own lean has to be applied as rz
      // BEFORE the yaw, which is exactly the merger's 'YXZ'.
      const hxp = tx + sa * (TW * 0.5 + 0.44), hzp = tz + ca * (TW * 0.5 + 0.44);
      HD.box(hxp + ca * 0.34, CY2 + 0.26, hzp - sa * 0.34, 0.9, 0.16, 0.06,
             0x24262c, 0, a, 0.62);
      HD.box(hxp - ca * 0.44, CY2 + 0.38, hzp + sa * 0.44, 1.24, 0.14, 0.06,
             0x24262c, 0, a, -0.5);
      HD.sph(hxp, CY2, hzp, 0.14, 0.14, 0.14, 0x24262c);
    }
    const fm = new THREE.Mesh(FD.build(), hkGlowMat(0xf2ead2, 0.85));
    fm.frustumCulled = false;
    root.add(fm);
    const hm2 = new THREE.Mesh(HD.build(), new THREE.MeshBasicMaterial({ vertexColors: true }));
    hm2.frustumCulled = false;
    root.add(hm2);
  }
  // handrails, so the pontoon reads as a pontoon rather than a raft — and they
  // are SOLID, because the head of this pontoon is the way out of the chapter
  // and a metre-high rail you can walk through is a rail that drops you in
  // Victoria Harbour on the last step of the last task.
  for (let side = -1; side <= 1; side += 2) {
    M.box(side * 4.4, 0.5, hkPIER_Z - 5, 0.12, 1.0, 12, PALETTE.hkPoleSteel);
    hkStaticBox(game, side * 4.4, 0.5, hkPIER_Z - 5, 0.3, 1.0, 12);
  }

  // ---- THE PIER IS WHERE THE CHAPTER ENDS AND IT WAS BARE PLANKING -------
  // Everything the player does here they do at the end of a pontoon with a
  // handrail on it: the ferry ride, the horn, the swim, and then the whistle
  // that takes them to chapter twelve. A Star Ferry pier is a green corrugated
  // shed with a turnstile in it, a bench down each side, six mooring bollards
  // and a life ring on every post — and it is the last thing anybody sees of
  // Hong Kong. Twenty-odd boxes, all of them inside the existing decking
  // collider, and none of them across the walking line: the shed straddles the
  // apron at x ±6.5, so the middle three metres of it is the way through.
  {
    const az = hkPIER_Z + 3;
    for (let s2 = -1; s2 <= 1; s2 += 2) {
      // the shed, one each side, leaving the middle open
      M.box(s2 * 7.6, 1.55, az, 5.6, 3.1, 7.2, PALETTE.hkFerryTrim);
      M.box(s2 * 7.6, 3.24, az, 6.2, 0.28, 7.8, PALETTE.hkFerry, 0, 0, s2 * 0.05);
      for (let k = 0; k < 8; k++) {
        M.box(s2 * 7.6, 3.42, az - 3.5 + k * 1.0, 6.2, 0.12, 0.34, PALETTE.hkFerryTrim);
      }
      // a lit destination board on the front of each
      // the SURROUND goes behind the board, not in front of it — see the
      // shopfront note: on this side of the pier "in front" is smaller z
      hkSHOPLIT.push(s2 * 7.6, 2.55, az - 3.82, 3.4, 0.72, 0.14, 0xffe6b0);
      M.box(s2 * 7.6, 2.55, az - 3.70, 3.7, 0.95, 0.12, PALETTE.hkGrille);
      // the turnstiles, which is what you actually walk through
      for (let k = -1; k <= 1; k++) {
        M.box(s2 * 5.1, 0.55, az + k * 1.6, 0.4, 1.1, 0.4, PALETTE.hkPoleSteel);
      }
      hkStaticBox(game, s2 * 7.6, 1.55, az, 5.6, 3.1, 7.2);
      // a bench outside it, facing the water
      M.box(s2 * 4.0, 0.44, az + 1.0, 0.9, 0.1, 4.4, PALETTE.hkCrate);
      M.box(s2 * 4.35, 0.78, az + 1.0, 0.16, 0.7, 4.4, PALETTE.hkCrate, 0, 0, -s2 * 0.12);
      for (let k = -1; k <= 1; k += 2) {
        M.box(s2 * 4.0, 0.2, az + 1.0 + k * 1.8, 0.7, 0.4, 0.12, PALETTE.hkPoleSteel);
      }
    }
    // mooring bollards and a life ring on every other post, down the pontoon
    for (let i = 0; i < 5; i++) {
      const z2 = hkPIER_Z - 0.6 - i * 2.4;
      for (let s2 = -1; s2 <= 1; s2 += 2) {
        M.cyl(s2 * 4.9, 0.12, z2, 0.22, 0.7, PALETTE.hkGrille, 0, 0, 0, 8);
        M.cyl(s2 * 4.9, 0.44, z2, 0.3, 0.14, PALETTE.hkGrille, 0, 0, 0, 8);
        if (i % 2 === 0) {
          M.cyl(s2 * 4.45, 1.15, z2, 0.42, 0.14, PALETTE.hkTaxi, 0, Math.PI * 0.5, 0, 16);
          M.cyl(s2 * 4.42, 1.15, z2, 0.26, 0.18, PALETTE.hkFerryTrim, 0, Math.PI * 0.5, 0, 16);
        }
      }
    }
    // the gangway at the head of it, hinged, which is how you get aboard
    M.box(0, 0.05, hkPIER_END + 0.9, 3.4, 0.16, 3.2, PALETTE.hkPoleSteel, 0.06);
    for (let k = 0; k < 6; k++) {
      M.box(0, 0.16, hkPIER_END + 2.2 - k * 0.52, 3.4, 0.08, 0.16, PALETTE.hkGrille);
    }
  }

  // the far pontoon
  M.box(0, -0.25, hkFAR_PIER, 12, 0.34, 8, PALETTE.hkFerry);
  hkStaticBox(game, 0, -0.3, hkFAR_PIER, 12, 0.5, 8);
  M.box(0, 1.6, hkFAR_PIER - 5, 12, 3.2, 0.4, PALETTE.hkFerryTrim);

  const mesh = new THREE.Mesh(M.build(), hkVC());
  mesh.castShadow = true; mesh.receiveShadow = true;
  root.add(mesh);

  // the water
  const g = new THREE.PlaneGeometry(520, 200, 1, 1);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, -140);
  // GLITTER, NOT WAVES. The mesh already has a ripple written into it and you
  // cannot see it from six metres up at 41 degrees; what makes water read as
  // water from there is a sparse field of moving points far brighter than the
  // surface. It costs four hash calls and it is the difference between a sea
  // and a sheet of coloured card. See grain() in shared.js.
  const wm = new THREE.Mesh(g, grainOwn(mat(PALETTE.hkHarbour),
    { scale: 0.35, amount: 0.06, warp: 0,
      sparkle: 0.34, sparkleScale: 0.95, sparkleSpeed: 0.22, sparkleCut: 0.685,
      sparkleColor: PALETTE.hkSkyLow }));
  wm.position.y = -0.5;
  wm.receiveShadow = true;
  wm.frustumCulled = false;
  root.add(wm);
  hkWaterMesh = wm;
}

/**
 * THE FAR SHORE, and the whole reason this chapter has a marquee.
 *
 * Sixteen towers on one InstancedMesh with a per-instance colour, so the entire
 * skyline is ONE draw call and every tower can still be lit on its own beat.
 * They are a long way off and they are supposed to be: the point of the view is
 * that the city you are standing in ends, and a bigger one starts on the other
 * side of a kilometre of water.
 */
function hkBuildSkyline(root) {
  hkTowerLit = new Float32Array(hkTOWER_N);
  hkTowers = [];
  const geo = new THREE.BoxGeometry(1, 1, 1);
  let seed = 5150;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  for (let i = 0; i < hkTOWER_N; i++) {
    const t = i / (hkTOWER_N - 1);
    const x = lerp(-135, 135, t) + (rnd() - 0.5) * 8;
    // tallest in the middle, which is what that skyline actually does
    const h = 44 + Math.sin(t * Math.PI) * 62 + rnd() * 22;
    const w = 11 + rnd() * 9;
    const z = hkSHORE_Z + (rnd() - 0.5) * 26;
    // ONE MESH PER TOWER. Sixteen draw calls, and they buy the only thing the
    // instanced version could not do: a tower that EMITS. The show lights them
    // one per beat, and a per-instance colour under a night ambient is a tower
    // that goes from dark grey to slightly-less-dark grey — which is not a
    // Symphony of Lights, it is a rounding error. emissive is a uniform, so a
    // per-tower emissive means a per-tower material and a per-tower mesh.
    const base = i % 2 ? PALETTE.hkTowerA : PALETTE.hkTowerB;
    const lit = i % 3 === 0 ? PALETTE.hkNeonGold
              : i % 3 === 1 ? PALETTE.hkNeonCyan : PALETTE.hkNeonPink;
    const m = mat(base, { emissive: lit, emissiveIntensity: 0 }).clone();
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, h * 0.5, z);
    mesh.scale.set(w, h, w);
    mesh.frustumCulled = false;
    root.add(mesh);
    mesh.userData.hkTower = hkTowers.length;   // so a QA probe can read the show
    hkTowers.push(mesh);
  }
  // ---- THE WINDOWS, AND THEY ARE THE REASON THE SKYLINE EXISTS -----------
  // Sixteen unlit boxes across the far shore is a dark blue wall: measured from
  // the pier head before the show starts, Victoria Harbour was a flat silhouette
  // with nothing in it, so the Symphony had to do all the work of being a city
  // AND all the work of being a show. A tower at night is a grid of lit windows
  // long before anybody points a laser at it. One unlit BasicMaterial mesh for
  // all sixteen — window light is emitted, not received, and a Lambert box
  // under a night ambient renders it as grey (see the neon note above).
  {
    const W = hkMerger();
    const warm = [0xffe6b0, 0xfff3d6, 0xbfe2ff, 0xd8f0e2, 0xffd28a];
    for (let i = 0; i < hkTowers.length; i++) {
      const t = hkTowers[i];
      const tw = t.scale.x, th = t.scale.y;
      const rows = Math.max(6, Math.floor(th / 4.4));
      const cols = Math.max(3, Math.floor(tw / 3.2));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (rnd() < 0.42) continue;                 // half the office is closed
          const wx = t.position.x - tw * 0.5 + (c + 0.5) * (tw / cols);
          const wy = 4 + (r + 0.5) * ((th - 6) / rows);
          const col = warm[(r * 3 + c * 5 + i) % warm.length];
          W.box(wx, wy, t.position.z + tw * 0.5 + 0.12, tw / cols * 0.52, 1.5, 0.1, col);
          // and the two flanks, so the tower has corners at night
          W.box(t.position.x - tw * 0.5 - 0.12, wy, t.position.z + (c + 0.5 - cols * 0.5) * (tw / cols),
                0.1, 1.5, tw / cols * 0.52, col);
        }
      }
      // the aircraft light on anything over eighty metres
      if (th > 80) hkAirLights.push(t.position.x, th + 1.2, t.position.z);
    }
    const wmesh = new THREE.Mesh(W.build(),
      new THREE.MeshBasicMaterial({ vertexColors: true }));
    wmesh.frustumCulled = false;
    root.add(wmesh);
    hkWindowMesh = wmesh;
  }
  // ---- AND THE HARBOUR CARRIES IT ----------------------------------------
  // A hundred and thirty metres of black water between the player and the thing
  // the chapter is about. One quad per tower lying ON the water, running back
  // toward the pier, tinted with that tower's own colour and brought up with
  // its emission — so when the show walks along the far shore, the light walks
  // across the water toward you. It is the cheapest thirty per cent of juice in
  // the chapter and it is the shot everybody has actually seen.
  {
    // A REFLECTION IS BROKEN AND IT FADES. One long quad per tower is a
    // coloured RUNWAY painted on the harbour — measured from directly above,
    // sixteen hard-edged rectangles with no gradient in them. Five segments per
    // tower, each a little narrower and a little further off the line than the
    // last, and each one dimmer: the light spreads and dies on its way to you,
    // which is the only thing about a reflection anybody actually recognises.
    // AND EACH SEGMENT IS THREE PLATES, NOT ONE. Five hard-edged strips is
    // still five hard-edged strips: measured off the show from the roof, the
    // harbour carried sixteen rectangles with a visible straight side each.
    // A dim wider plate either side of the core is a lateral falloff for two
    // more boxes, and it is the whole difference between light on water and
    // coloured tape stuck to it.
    const R = hkMerger();
    const SEG = 6;
    hkReflFade = [];
    for (let i = 0; i < hkTowers.length; i++) {
      const t = hkTowers[i];
      for (let k = 0; k < SEG; k++) {
        const u = (k + 0.5) / SEG;
        const z = hkSHORE_Z + 12 + u * 104;
        const jitter = Math.sin(i * 3.7 + k * 2.3) * t.scale.x * 0.26;
        const w = t.scale.x * (0.58 - u * 0.20);
        const dz = 104 / SEG + 1.5;
        // and it BREAKS: a wet chop does not carry a light in one piece
        const brk = 0.62 + 0.38 * Math.abs(Math.sin(i * 1.3 + k * 2.1));
        R.box(t.position.x + jitter, 0, z, w * 0.55, 0.02, dz, 0xffffff);
        R.box(t.position.x + jitter - w * 0.46, 0, z, w * 0.46, 0.02, dz * 0.9, 0xffffff);
        R.box(t.position.x + jitter + w * 0.46, 0, z, w * 0.46, 0.02, dz * 0.9, 0xffffff);
        // THE FALLOFF LIVES IN hkReflFade, NOT IN THE BOX COLOUR: the show
        // rewrites every vertex colour from (tower colour x fade) each frame,
        // so anything baked into the merged colour is overwritten on frame one.
        // 24 vertices a box, core first, then the two shoulders.
        const f = ((1 - u) * (1 - u) * 0.9 + 0.1) * brk;
        for (let v = 0; v < 24; v++) hkReflFade.push(f);
        for (let v = 0; v < 48; v++) hkReflFade.push(f * 0.34);
      }
    }
    hkReflSeg = SEG;
    // A LAMBERT QUAD IN A NIGHT SCENE IS BLACK — the same lesson the ninety
    // neon signs taught this file, one screen further down. Light on water is
    // EMITTED toward the camera; it is not a surface receiving a moon.
    hkReflMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5,
                                              blending: THREE.AdditiveBlending });
    hkReflMat.depthWrite = false;
    const rm = new THREE.Mesh(R.build(), hkReflMat);
    rm.position.y = -0.46;
    rm.renderOrder = 3;
    rm.frustumCulled = false;
    rm.visible = false;
    root.add(rm);
    hkReflMesh = rm;
    hkReflCol = rm.geometry.getAttribute('color');
    hkReflBase = [];
    for (let i = 0; i < hkTowers.length; i++) {
      const c = new THREE.Color(i % 3 === 0 ? PALETTE.hkNeonGold
                              : i % 3 === 1 ? PALETTE.hkNeonCyan : PALETTE.hkNeonPink);
      hkReflBase.push(c.r, c.g, c.b);
    }
  }
  // the red lights on the tall ones. They are what tells you at a glance that
  // the far shore is a hundred and thirty metres away and eighty metres high.
  if (hkAirLights.length) {
    const n = hkAirLights.length / 3;
    const am = new THREE.InstancedMesh(new THREE.SphereGeometry(0.9, 5, 4),
      new THREE.MeshBasicMaterial({ color: 0xff5a4a }), n);
    am.frustumCulled = false;
    root.add(am);
    hkAirMesh = am;
  }
  // the lasers: eight long thin boxes fanning up out of the skyline. Off unless
  // the show is running, and even then they are the quietest thing in it —
  // beams are a cheap effect and a whole screen of them is a cheap SCENE.
  const L = hkMerger();
  for (let i = 0; i < 8; i++) {
    const x = lerp(-90, 90, i / 7);
    const lean = (i - 3.5) * 0.09;
    L.box(x, 90, hkSHORE_Z, 0.5, 190, 0.5, PALETTE.hkNeonCyan, 0, 0, lean);
  }
  hkLaserMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0 });
  hkLaserMat.depthWrite = false;
  const lm = new THREE.Mesh(L.build(), hkLaserMat);
  lm.renderOrder = 4;
  lm.visible = false;
  lm.frustumCulled = false;
  root.add(lm);
  hkLaserMesh = lm;

  // ---- the searchlights on THIS shore -------------------------------------
  // Four beams standing on the Kowloon roofs, raked out over the harbour, and
  // they pivot about a point up on the buildings rather than about the origin
  // — which is why they are in their own group with the mesh offset inside it.
  {
    const S = hkMerger();
    for (let i = 0; i < 4; i++) {
      const x = lerp(-26, 26, i / 3);
      const lean = (i - 1.5) * 0.16;
      // UP FROM THE ROOFS, not through them. Centred at −62 the beam ran from
      // y −88 to +44, so three quarters of every searchlight was underground
      // and what showed on the roof deck was the middle of a translucent slab
      // lying across the water tanks. A searchlight starts at its lamp.
      S.box(x, 66, -0.5, 0.9, 132, 0.9, PALETTE.hkNeonWhite, 0, 0, lean);
    }
    hkSweepMat = new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending });
    const sm2 = new THREE.Mesh(S.build(), hkSweepMat);
    sm2.frustumCulled = false;
    hkSweepMesh = new THREE.Group();
    hkSweepMesh.position.set(0, 40, -8);
    hkSweepMesh.add(sm2);
    hkSweepMesh.visible = false;
    hkSweepMesh.renderOrder = 4;
    root.add(hkSweepMesh);
  }
}

// =============================================================== THE JUNK ===
/**
 * THE ONE THING ON VICTORIA HARBOUR THAT IS NOT A FERRY.
 *
 * Eight hundred metres of black water runs across the bottom of this chapter
 * with the marquee moment on the far side of it, and until now the only thing
 * ever on it was the Star Ferry going back and forth in a straight line. A
 * harbour with one boat in it is a swimming pool.
 *
 * A junk, because a junk is what that water is FOR in every photograph ever
 * taken of it: three battened lugsails in the deep red they are actually dyed,
 * a high stern, a lantern on the mast, and it crosses on its own long clock —
 * ninety seconds a length, which is slow enough that it is weather rather than
 * an event.
 *
 * TWO THINGS MAKE IT WORTH THE TRIANGLES AND BOTH ARE ABOUT THE SHOW:
 *   the sails are on their OWN material, so when the far shore lights up the
 *     red comes up with it — the only object between the player and the
 *     Symphony, taking its colour from it;
 *   it lays a reflection on the water like everything else out there does,
 *     which is what stops a boat on a black plane from looking like a decal.
 *
 * No collider: it never comes inside eighty metres of anywhere the animal can
 * be, and a kinematic hull that far out is a broadphase entry for nothing.
 */
const hkJUNK_Z = -118;             // the shipping lane, between the two piers
const hkJUNK_PERIOD = 132;         // s for one crossing
let hkJunkGroup = null, hkJunkSailMat = null, hkJunkWake = null;
let hkJunkT = 0.35;

function hkBuildJunk(root) {
  const grp = new THREE.Group();
  grp.name = 'hkJunk';
  const M = hkMerger();
  // ---- the hull: high at the stern, low amidships, which is the whole line
  for (let i = 0; i < 11; i++) {
    const t = i / 10;
    const z = (t - 0.5) * 24;
    const taper = Math.sin(t * Math.PI);
    const rise = Math.pow(Math.max(0, t - 0.55) / 0.45, 2) * 3.4 +
                 Math.pow(Math.max(0, 0.25 - t) / 0.25, 2) * 1.2;
    M.box(0, 0.55 + rise * 0.5, z, 1.2 + taper * 3.4, 1.6 + rise, 2.5, PALETTE.hkCrate);
    M.box(0, 1.4 + rise, z, 1.4 + taper * 3.6, 0.22, 2.5, PALETTE.hkGrille);
  }
  // the transom, and the big rudder off the back of it
  M.box(0, 2.9, 12.4, 4.0, 3.0, 0.5, PALETTE.hkTaxi);
  M.box(0, 1.0, 13.4, 0.35, 3.6, 1.8, PALETTE.hkCrate, -0.2);
  // the deckhouse
  M.box(0, 2.3, 6.0, 3.6, 1.8, 4.6, PALETTE.hkCrate);
  M.box(0, 3.3, 6.0, 4.2, 0.3, 5.2, PALETTE.hkGrille, 0, 0, 0.04);
  // three masts, raked aft, which is how a junk is rigged
  const MAST = [[-7.5, 13.5, 3.2], [0.5, 17.5, 4.6], [8.0, 9.5, 2.4]];
  for (let m = 0; m < 3; m++) {
    const mz = MAST[m][0], mh = MAST[m][1];
    M.cyl(0, 1.4 + mh * 0.5, mz + mh * 0.06, 0.16, mh, PALETTE.hkCrate, -0.11, 0, 0, 6);
  }
  const hull = new THREE.Mesh(M.build(), hkVC());
  hull.castShadow = true;
  grp.add(hull);

  // ---- THE SAILS, on their own material, because they answer the show ----
  {
    const S = hkMerger();
    for (let m = 0; m < 3; m++) {
      const mz = MAST[m][0], mh = MAST[m][1], sw = MAST[m][2];
      const nb = 7;
      for (let b = 0; b < nb; b++) {
        const u = (b + 0.5) / nb;
        const y = 3.0 + u * (mh - 2.2);
        // a lugsail is wider at the top and it is a stack of BATTENS, which is
        // the only thing that distinguishes it from a bedsheet
        const w = sw * (0.62 + u * 0.55);
        S.box(0, y, mz + mh * 0.06 * (u * 2 - 1) - w * 0.34, 0.12, (mh - 2.2) / nb - 0.14,
              w * 2, 0xffffff, -0.11);
        S.box(0, y - (mh - 2.2) / nb * 0.5, mz + mh * 0.06 * (u * 2 - 1) - w * 0.34,
              0.2, 0.13, w * 2.1, 0xd8d8d8, -0.11);
      }
    }
    hkJunkSailMat = mat(PALETTE.hkJunkSail, {
      emissive: PALETTE.hkJunkSail, emissiveIntensity: 0.28, vertexColors: true }).clone();
    const sm = new THREE.Mesh(S.build(), hkJunkSailMat);
    sm.castShadow = true;
    grp.add(sm);
  }
  // a lantern at the masthead and one on the stern, which are lights
  {
    const L = hkMerger();
    L.sph(0, 19.6, 1.6, 0.4, 0.5, 0.4, 0xffffff);
    L.sph(0, 4.8, 12.2, 0.34, 0.42, 0.34, 0xffd08a);
    L.sph(0, 2.2, -12.6, 0.3, 0.36, 0.3, 0xffffff);
    const lm = new THREE.Mesh(L.build(), new THREE.MeshBasicMaterial({
      vertexColors: true, color: PALETTE.hkNeonGold }));
    lm.frustumCulled = false;
    grp.add(lm);
  }
  grp.position.set(0, -0.4, hkJUNK_Z);
  grp.frustumCulled = false;
  root.add(grp);
  hkJunkGroup = grp;

  // ---- and it lays a wake, which is what tells you it is moving -----------
  // Same instrument as the harbour reflections: a smear ON the water running
  // away from the hull, additive, dimming to nothing. It is drawn in the
  // junk's own local frame because it is always astern of it.
  {
    const W = hkMerger();
    const SEG = 6;
    for (let k = 0; k < SEG; k++) {
      const u = (k + 0.5) / SEG;
      const f = (1 - u) * (1 - u) * 0.85 + 0.06;
      const g2 = Math.max(0, Math.min(255, Math.round(f * 255)));
      const col = (g2 << 16) | (g2 << 8) | g2;
      W.box(0, 0, 14 + u * 46, 3.0 + u * 11, 0.02, 46 / SEG + 1.5, col);
    }
    hkJunkWake = new THREE.Mesh(W.build(), new THREE.MeshBasicMaterial({
      vertexColors: true, color: 0xbfd8d4, transparent: true, opacity: 0.12,
      depthWrite: false, blending: THREE.AdditiveBlending }));
    hkJunkWake.position.y = -0.06;
    hkJunkWake.renderOrder = 3;
    hkJunkWake.frustumCulled = false;
    grp.add(hkJunkWake);
  }
}

function hkUpdateJunk(dt) {
  if (!hkJunkGroup) return;
  hkJunkT += dt / hkJUNK_PERIOD;
  while (hkJunkT >= 2) hkJunkT -= 2;
  // out one way and back the other, and it TURNS at each end rather than
  // teleporting: the ease is what makes a hundred and thirty metres of water
  // read as a passage rather than as a loop
  const leg = hkJunkT < 1 ? hkJunkT : 2 - hkJunkT;
  const e = leg * leg * (3 - 2 * leg);
  hkJunkGroup.position.x = lerp(-128, 128, e);
  hkJunkGroup.position.z = hkJUNK_Z + Math.sin(hkJunkT * 3.1) * 9;
  hkJunkGroup.position.y = -0.4 + Math.sin(hkTime * 0.42) * 0.12;
  hkJunkGroup.rotation.y = (hkJunkT < 1 ? 1 : -1) * Math.PI * 0.5;
  hkJunkGroup.rotation.z = Math.sin(hkTime * 0.55) * 0.035;
  hkJunkGroup.rotation.x = Math.sin(hkTime * 0.37) * 0.02;
  // THE SAILS TAKE THE SHOW. They are the only large surface between the
  // player and the far shore, so a kilometre of coloured light landing on
  // eighteen metres of red canvas is the cheapest thing in this chapter that
  // makes the Symphony feel like it is happening to the whole harbour.
  if (hkJunkSailMat) hkJunkSailMat.emissiveIntensity = 0.24 + hkShow * 0.62;
  if (hkJunkWake) hkJunkWake.material.opacity = 0.10 + hkShow * 0.05;
}

// ============================================================== THE FERRY ===
/**
 * The Star Ferry. Two decks, a funnel, and it goes across and comes back for
 * ever — the same kinematic-driven-by-velocity pattern the gondola and the
 * chiva use, because it is the only pattern in this codebase that gives
 * capybara.js an honest platform frame to solve in.
 */
function hkBuildFerry(game, root) {
  const grp = new THREE.Group();
  const M = hkMerger();
  M.box(0, 0.5, 0, 7.4, 1.6, 21, PALETTE.hkFerry);
  M.box(0, 1.45, 0, 7.8, 0.3, 21.6, PALETTE.hkFerryTrim);
  M.box(0, 2.9, 0, 6.4, 2.6, 15, PALETTE.hkFerry);
  M.box(0, 4.3, 0, 6.8, 0.24, 15.6, PALETTE.hkFerryTrim);
  M.box(0, 5.6, 1.5, 3.4, 2.4, 5, PALETTE.hkFerry);
  M.cyl(0, 8.0, 1.5, 0.9, 3.2, PALETTE.hkFerryTrim, 0, 0, 0, 8);
  M.cyl(0, 9.9, 1.5, 0.95, 0.6, PALETTE.hkAwning, 0, 0, 0, 8);
  // the two pointed ends, because it is double-ended and never turns round
  M.cone(0, 0.6, -11.4, 3.7, 3.6, PALETTE.hkFerry, Math.PI * 0.5, 0, 0);
  M.cone(0, 0.6, 11.4, 3.7, 3.6, PALETTE.hkFerry, -Math.PI * 0.5, 0, 0);
  const mesh = new THREE.Mesh(M.build(), hkVC());
  mesh.castShadow = true;
  grp.add(mesh);
  // the lit saloon: eighteen windows, and at night they are the entire boat
  {
    const W = hkMerger();
    for (let i = 0; i < 9; i++) {
      W.box(3.3, 2.9, -7 + i * 1.75, 0.2, 1.4, 1.2, 0xffffff);
      W.box(-3.3, 2.9, -7 + i * 1.75, 0.2, 1.4, 1.2, 0xffffff);
    }
    const wm = new THREE.Mesh(W.build(),
      mat(PALETTE.hkNeonGold, { vertexColors: true, emissive: PALETTE.hkNeonGold }));
    grp.add(wm);
  }
  root.add(grp);
  hkFerryGroup = grp;

  const b = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC,
                              material: (game.mats && game.mats.ground) || undefined });
  b.addShape(new CANNON.Box(new CANNON.Vec3(3.7, 0.9, 10.5)));
  b.allowSleep = false;
  b.position.set(0, -50, hkPIER_END);
  hkSyncBody(b);
  game.world.addBody(b);
  hkFerryBody = b;
}

function hkUpdateFerry(game, dt) {
  if (!hkFerryBody) return;
  hkFerryT += hkFerryDir * dt / 26;
  if (hkFerryT > 1) { hkFerryT = 1; hkFerryDir = -1; }
  if (hkFerryT < 0) { hkFerryT = 0; hkFerryDir = 1; }
  // ease in and out of both berths, so coming alongside reads as coming
  // alongside rather than as hitting a wall at nine metres a second
  const e = hkFerryT * hkFerryT * (3 - 2 * hkFerryT);
  // lerp between the two berths rather than adding a span to an offset start:
  // the offset made it overshoot the far pontoon by six metres every crossing.
  const tz = lerp(hkPIER_END - 6, hkFAR_PIER + 6, e);
  const ty = 0.35 + Math.sin(hkTime * 0.9) * 0.06;
  const b = hkFerryBody;
  const inv = dt > 1e-5 ? 1 / dt : 60;
  // FROM THE TARGET, NOT FROM THE BODY — see the same note on the gondola and
  // the bangka. It matters most here: star-ferry wants twenty-two continuous
  // seconds in the deck's frame, and every substep hiccup dropped the frame to
  // zero for a frame and slid a twenty-one metre deck out from under the
  // animal at up to 5.6 m/s.
  b.velocity.set(0, (ty - b.position.y) * inv, (tz - hkFerryPZ) * inv);
  hkFerryPZ = tz;

  if (Math.abs(tz - b.position.z) > 12) {
    b.position.set(0, ty, tz); b.velocity.set(0, 0, 0); hkSyncBody(b);
  }
  if (hkFerryGroup) {
    hkFerryGroup.position.set(b.interpolatedPosition.x, b.interpolatedPosition.y,
                              b.interpolatedPosition.z);
    hkFerryGroup.rotation.z = Math.sin(hkTime * 1.3) * 0.018;
  }

  // --- riding it -----------------------------------------------------------
  const capy = game.capy;
  if (capy && capy.position) {
    const dx = capy.position.x - b.position.x;
    const dz = capy.position.z - b.position.z;
    const dy = capy.position.y - b.position.y;
    // the vertical tolerance clears a HOP, or the test goes false in the middle
    // of every successful jump taken on deck
    const on = Math.abs(dx) < 4.2 && Math.abs(dz) < 11 && dy > -0.6 && dy < 3.2;
    if (on) {
      if (hkFerryRideT <= 0) hkFerryFrom = hkFerryT;
      hkFerryRideT += dt;
      // ---- AND THE HORN --------------------------------------------------
      // Sydney sounds off under the Bridge and it is the best thirty seconds
      // in chapter three. Hong Kong has a hundred-year-old ferry with a horn
      // on it, eight hundred metres of harbour to cross, and in eleven tasks
      // nobody was ever invited to lean on it. The voice key, aboard, under
      // way: the animal wheeks, the ship answers, and the far shore answers
      // the ship.
      const inp = game.input;
      if (!hkHornDone && inp && inp.honkPressed && Math.abs(hkFerryT - hkFerryFrom) > 0.08) {
        hkHornDone = true;
        hkTask('ferry-horn');
        hkSfx('horn', { volume: 1.0, pitch: 0.38, force: true });
        hkSfx('horn', { volume: 0.34, pitch: 0.41 });
        hkToast('she has had that horn since 1957. it is not a subtle instrument.');
        if (typeof game.shake === 'function') game.shake(0.12);
      }
      // it counts when you have actually crossed, not when you have stood on it
      if (!hkFerryDone && Math.abs(hkFerryT - hkFerryFrom) > 0.85) {
        hkFerryDone = true;
        hkTask('star-ferry');
        hkToast('two dollars sixty. it did not ask for it.');
        hkSfx('horn', { volume: 0.8, pitch: 0.5 });
      }
    } else {
      hkFerryRideT = 0;
    }
  }
}

// =============================================================== THE SHOW ===
/**
 * A Symphony of Lights.
 *
 * The towers come up ONE PER BEAT and the beat comes from `game.music`, which is
 * derived from the audio clock the notes are actually scheduled against — so it
 * cannot drift from what the player is hearing, which a parallel timer would do
 * inside a minute. When there is no music at all (muted, suspended, a tab that
 * has been in the background) it falls back to a fixed interval, because
 * CONTRACT: sound is never a requirement, only a reward.
 */
function hkUpdateShow(game, dt) {
  const prev = hkPhase;
  hkPhase += dt / hkCYCLE;
  while (hkPhase >= 1) hkPhase -= 1;

  const warnNow = hkPhase >= hkSHOW_WARN && hkPhase < hkSHOW_ON;
  const onNow = hkPhase >= hkSHOW_ON && hkPhase < hkSHOW_OFF;

  // ---- TWO WARNINGS, BECAUSE ELEVEN SECONDS IS NOT A CLIMB ---------------
  // The only notice was hkSHOW_WARN, which is 11.4 s before the lights and is
  // measurably less than the time it takes to get from the pavement to the
  // roof — so the chapter's own alarm was an alarm about something you had
  // already lost. The first one goes twenty-five seconds earlier and says the
  // one useful thing (START CLIMBING); the second is the original, and by then
  // anybody who took the hint is most of the way up and hears it from the
  // scaffold, which is where it sounds best.
  const soonNow = hkPhase >= hkSHOW_SOON && hkPhase < hkSHOW_WARN;
  if (soonNow && !hkSoonSaid) {
    hkSoonSaid = true;
    if (!hkShowDone) {
      const cy = game.capy && game.capy.position ? game.capy.position.y : 0;
      hkToast(cy > hkSHOW_ROOF
        ? 'nearly eight. stay exactly where you are.'
        : 'nearly eight. if you are going up the bamboo, go now.');
      hkSfx('chime', { volume: 0.26, pitch: 1.15 });
    }
  }
  if (!soonNow && !onNow) hkSoonSaid = false;

  if (warnNow && !hkWarned) {
    hkWarned = true;
    hkToast('eight o’clock. the other side of the water is about to show off.');
    hkSfx('chime', { volume: 0.4, pitch: 0.7 });
  }
  if (!warnNow && !onNow) hkWarned = false;

  if (onNow && hkShowT < 0) {
    hkShowT = 0;
    hkLitCount = 0;
    hkLastBeat = -1;
    hkBeatAcc = 0;
    hkBeatStall = 0;
    hkShowBeat = 0;
    hkChase = 0;
    hkFinaleDone = false;
    hkSeenShow = true;
    if (!hkShowDone) {
      const capy0 = game.capy;
      if (!(capy0 && capy0.position && capy0.position.y > hkSHOW_ROOF)) {
        // ...and it says WHERE, because 'wrong floor' with a forty-metre
        // scaffold somewhere behind you is a reprimand rather than a direction.
        hkToast('it has started. get up the bamboo — you have about half a minute.');
      }
    }
  }
  if (!onNow && hkShowT >= 0) hkShowT = -1;

  // ---- THE MARQUEE IS THE SHOW, NOT THE FIRST FRAME OF IT ----------------
  //
  // This was a SINGLE-FRAME TEST, and it is the one row in this chapter that
  // carries `wow`. The show runs for thirty-nine seconds out of a hundred and
  // fifty-two, and the task ticked only if the capybara was already above
  // twenty-six metres on the exact frame the phase crossed hkSHOW_ON. Which
  // means: hear the warning chime, start climbing, arrive on the roof four
  // seconds into the best twenty seconds in the chapter, watch the whole thing
  // from the right place — and get nothing, with the paper still showing the
  // row open and no way at all to find out why. The next go is a hundred and
  // thirteen seconds of standing on a roof.
  //
  // 'Be on the roof when the lights come on' is satisfied by BEING ON THE ROOF
  // WHILE THE LIGHTS ARE ON. Checked every frame the show is running, which
  // also means a player who climbs during the count-in gets it the moment they
  // top out rather than at some arbitrary later beat.
  if (!hkShowDone && hkShowT >= 0) {
    const capy = game.capy;
    if (capy && capy.position && capy.position.y > hkSHOW_ROOF) {
      hkShowDone = true;
      hkTask('symphony');
      hkToast('all of it, from up here, for nothing.');
      // ---- FRAMED (v26) -------------------------------------------------
      // The settled rig is already good here — `skyward()` puts 17 of the 18
      // towers inside NDC — but the player ARRIVES over the parapet facing
      // -x, off the wall they have just climbed, and the show is behind them.
      // The bearing is all that is missing: yaw 0 is the camera on the harbour
      // side looking back over the animal at the skyline, which is at
      // z = hkSHORE_Z. Short hold; the show runs for another half minute and
      // the player should be steering it themselves by then.
      if (typeof game.frameShot === 'function') {
        game.frameShot({ yaw: 0, dist: 13, pitch: 6 * Math.PI / 180, raise: 1.2, hold: 3.5 });
      }
    }
  }

  hkShow = damp(hkShow, onNow ? 1 : 0, onNow ? 3.5 : 1.2, dt);

  // ---- and the score comes up with it -------------------------------------
  // The one marquee moment in this game that is ITSELF scored — the far shore
  // lights a tower per beat — and the only channel it was using was the towers.
  // The swell tracks hkShow rather than the phase, so it arrives with the light
  // and leaves with it, and it is gated on ALTITUDE for the same reason the
  // task is: this is a thing you see from a roof, and from the pavement it is a
  // glow over a building. Up there it is the room opening; down here the vamp
  // carries on as it was, which is exactly the information the player needs.
  if (hkShow > 0.02 && game.music && typeof game.music.swell === 'function') {
    const cp = game.capy && game.capy.position;
    // and the finale takes it the rest of the way. The build sits at 0.8 for
    // half a minute precisely so the last movement has somewhere left to go.
    if (cp && cp.y > 20) game.music.swell(clamp(hkShow, 0, 1) * (hkFinaleDone ? 1.0 : 0.8));
  }

  // ---- light one more tower, on the beat ----------------------------------
  if (hkShowT >= 0) {
    hkShowT += dt;
    // THE FALLBACK HAS TO WATCH FOR A STALLED CLOCK, NOT JUST A SILENT ONE.
    //
    // `mus.playing` is a flag on the score; `mus.beats()` is derived from the
    // AudioContext's currentTime. Those are two different things, and there is
    // a state — muted, suspended, a tab that has been in the background, a
    // context that never got its gesture — where the first is TRUE and the
    // second is FROZEN. In it, `Math.floor(beats())` never changes, so `step`
    // fired exactly once: measured over the whole 46-second window of the show,
    // `litTowers()` was **1**. The Symphony of Lights was one building.
    //
    // Nothing caught it because everything else about the show was correct —
    // the phase, the toast, the swell, the lasers, the camera lifting — and the
    // one number that was wrong is the one nothing asserts. So: keep the beat
    // as the source of truth, and if it has not moved for two beats' worth of
    // wall clock, stop believing it and run the interval instead. CONTRACT:
    // sound is never a requirement, only a reward.
    let step = false;
    const mus = game.music;
    hkBeatAcc += dt;
    let musical = false;
    if (mus && mus.playing && typeof mus.beats === 'function') {
      const b = Math.floor(mus.beats());
      if (b !== hkLastBeat) { hkLastBeat = b; step = true; hkBeatStall = 0; musical = true; }
      else {
        hkBeatStall += dt;
        musical = hkBeatStall < hkSHOW_BEATS * 2;
      }
    }
    if (step) hkBeatAcc = 0;
    else if (!musical && hkBeatAcc >= hkSHOW_BEATS) { hkBeatAcc = 0; step = true; }
    if (step) {
      hkShowBeat++;
      hkChase++;
      const u2 = clamp(hkShowT / ((hkSHOW_OFF - hkSHOW_ON) * hkCYCLE), 0, 1);
      if (u2 < hkSHOW_M1) {
        if (hkLitCount < hkTOWER_N) {
          hkLitCount++;
          hkSfx('chime', { volume: 0.22, pitch: 0.9 + hkLitCount * 0.055 });
        }
      } else if (u2 < hkSHOW_M2) {
        // the wave: one note per pass, low going out and high coming back
        if (hkChase % hkTOWER_N === 0) {
          hkSfx('chime', { volume: 0.20, pitch: (hkChase / hkTOWER_N) % 2 ? 1.5 : 0.75 });
        }
      } else if (u2 < hkSHOW_M3) {
        hkSfx('chime', { volume: 0.15, pitch: hkShowBeat % 2 ? 1.32 : 0.86 });
        hkLitCount = hkTOWER_N;
      } else if (!hkFinaleDone) {
        // ---- AND IT FINISHES. --------------------------------------------
        // A set piece that stops rather than ends is a set piece the player
        // does not know they have watched. Everything up at once, one low note
        // under it, and the frame moves — which is the only time this chapter
        // shakes the camera at all.
        hkFinaleDone = true;
        hkLitCount = hkTOWER_N;
        // ...FROM THE FAR SHORE, which is where it is coming from. 0 of 31
        // hkSfx calls in this file passed a position, so the loudest moment in
        // the chapter played dead centre while the thing making it was a
        // hundred and eighty metres across the water. Two cues already
        // hand-roll a distance falloff with no pan at all — the law v16
        // replaced.
        const skyAt = { x: 0, y: 50, z: hkSHORE_Z };
        hkSfx('chime', { volume: 0.45, pitch: 0.5, at: skyAt });
        hkSfx('chime', { volume: 0.30, pitch: 1.0, at: skyAt });
        if (typeof game.shake === 'function') game.shake(0.14);
        const cp2 = game.capy && game.capy.position;
        if (cp2 && cp2.y > 20) hkToast('and all of it, at once.');
      }
      if (u2 >= hkSHOW_M1) hkLitCount = hkTOWER_N;
    }
  } else if (hkLitCount > 0 && hkShow < 0.05) {
    hkLitCount = 0;
    hkShowBeat = 0;
  }

  // ---- paint the skyline ---------------------------------------------------
  if (hkTowers) {
    const u = hkShowT >= 0 ? clamp(hkShowT / ((hkSHOW_OFF - hkSHOW_ON) * hkCYCLE), 0, 1) : 1;
    // where the wave is, in tower numbers, bouncing off both ends of the shore
    const span = (hkTOWER_N - 1) * 2;
    const cp = span > 0 ? hkChase % span : 0;
    const chasePos = cp < hkTOWER_N ? cp : span - cp;
    for (let i = 0; i < hkTOWER_N; i++) {
      let want;
      if (hkShowT < 0) {
        want = 0;
      } else if (u < hkSHOW_M1) {
        want = i < hkLitCount ? 1 : 0;                     // 1. counted in
      } else if (u < hkSHOW_M2) {
        // 2. THE WAVE. Three towers wide with a tail, so what runs along the
        // shore is a crest rather than a single window switching.
        const d = Math.abs(i - chasePos);
        want = 0.18 + clamp(1 - d / 3.2, 0, 1) * 0.82;
      } else if (u < hkSHOW_M3) {
        // 3. ODDS AGAINST EVENS, on the beat. The whole kilometre of shore
        // answering itself is the one thing sixteen separate towers can do
        // that nothing else in this game can.
        want = ((i + hkShowBeat) % 2) ? 1 : 0.14;
      } else {
        // 4. ALL OF IT, and it does not sit still: a slow shimmer across the
        // shore so the last eight seconds are still moving.
        want = 0.82 + Math.sin(hkTime * 5.0 - i * 0.55) * 0.18;
      }
      // fast up, slow down: a tower snaps on and fades, which is what a
      // building full of switched lights does and a symmetrical damp does not
      hkTowerLit[i] = damp(hkTowerLit[i], want, want > hkTowerLit[i] ? 11 : 1.5, dt);
      // 0.72, not 1: at full emission a tower is a flat coloured card with no
      // faces on it. Leaving a quarter of the Lambert shading in keeps the
      // corners and gives the skyline depth while it is lit.
      hkTowers[i].material.emissiveIntensity = hkTowerLit[i] * 0.72;
    }
    // the light on the water, one strip per tower, brought up with its own
    // emission — so the show walks toward the player across the harbour
    if (hkReflMesh && hkReflCol) {
      let any = 0;
      const per = hkReflSeg * 72;
      for (let i = 0; i < hkTOWER_N; i++) {
        const a = hkTowerLit[i];
        if (a > any) any = a;
        const r = hkReflBase[i * 3] * a, g2 = hkReflBase[i * 3 + 1] * a, b2 = hkReflBase[i * 3 + 2] * a;
        for (let v = 0; v < per; v++) {
          const idx = i * per + v, f = hkReflFade[idx];
          hkReflCol.setXYZ(idx, r * f, g2 * f, b2 * f);
        }
      }
      hkReflCol.needsUpdate = true;
      const vis = any > 0.02;
      if (vis !== hkReflMesh.visible) hkReflMesh.visible = vis;
      if (hkReflMat) hkReflMat.opacity = 0.6 * clamp(any * 1.4, 0, 1);
    }
  }
  if (hkAirMesh) {
    for (let i = 0; i < hkAirLights.length / 3; i++) {
      const on = Math.sin(hkTime * 1.9 + i * 2.1) > 0.55 ? 1 : 0.0001;
      hkAirMesh.setMatrixAt(i, hkXform(hkAirLights[i * 3], hkAirLights[i * 3 + 1],
        hkAirLights[i * 3 + 2], 0, 0, 0, on, on, on));
    }
    hkAirMesh.instanceMatrix.needsUpdate = true;
  }
  if (hkLaserMesh && hkLaserMat) {
    // THE BEAMS BELONG TO THE LAST TWO MOVEMENTS. They were on for the whole
    // window at one fixed strength turning five hundredths of a radian, which
    // is a screensaver. Off for the count-in, a hint of them under the wave,
    // and then they open out — so the beams are the thing that tells you the
    // show has changed gear even if you are not counting towers.
    const su = hkShowT >= 0 ? clamp(hkShowT / ((hkSHOW_OFF - hkSHOW_ON) * hkCYCLE), 0, 1) : 1;
    const lk = hkShowT < 0 ? 0
             : su < hkSHOW_M1 ? 0.10
             : su < hkSHOW_M2 ? 0.45
             : su < hkSHOW_M3 ? 0.80 : 1.30;
    hkLaserMat.opacity = hkShow * 0.155 * lk;
    const vis = hkShow > 0.02 && lk > 0.02;
    if (vis !== hkLaserMesh.visible) hkLaserMesh.visible = vis;
    if (vis) hkLaserMesh.rotation.y = Math.sin(hkTime * (0.5 + lk * 0.55)) * (0.05 + lk * 0.10);
  }
  // ---- AND THE SHOW REACHES THIS SHORE ------------------------------------
  // The Symphony is on BOTH sides of the harbour: the searchlights on the
  // Kowloon roofs sweep out over the water and back over the street, and it
  // is the only part of it that happens above the player rather than a
  // kilometre away. It matters for the chapter's shape, too — from the
  // pavement the show was previously a glow behind a building, which is
  // correct but is not a reason to look up. Four beams, raked out over the
  // road, sweeping on their own slow clock, off entirely until the wave
  // starts. Same instrument as the far-shore lasers: additive, unlit, and
  // quiet enough that they are weather rather than a light show.
  if (hkSweepMesh && hkSweepMat) {
    const su2 = hkShowT >= 0 ? clamp(hkShowT / ((hkSHOW_OFF - hkSHOW_ON) * hkCYCLE), 0, 1) : 1;
    const k2 = hkShowT < 0 ? 0 : su2 < hkSHOW_M1 ? 0 : su2 < hkSHOW_M2 ? 0.5
             : su2 < hkSHOW_M3 ? 0.85 : 1.25;
    hkSweepMat.opacity = hkShow * 0.075 * k2;
    const vis2 = hkShow > 0.02 && k2 > 0.02;
    if (vis2 !== hkSweepMesh.visible) hkSweepMesh.visible = vis2;
    if (vis2) {
      hkSweepMesh.rotation.z = Math.sin(hkTime * 0.33) * 0.30;
      hkSweepMesh.rotation.x = -0.62 + Math.sin(hkTime * 0.21 + 1.1) * 0.20;
    }
  }

  // ---- THE RIG HAS TO BE ASKED TO LOOK UP ---------------------------------
  // At the standard 41-degree pitch the top of the frame points 17 degrees BELOW
  // horizontal, so a skyline a hundred metres tall a hundred and thirty metres
  // away is simply not in the picture. skyward() is the contract's answer to
  // that and this is the second chapter to need it.
  const capy = game.capy;
  const high = !!(capy && capy.position && capy.position.y > 18);
  const wantSky = clamp(hkShow * (high ? 1 : 0.45) +
                        (capy && capy.position && capy.position.z < hkPIER_Z ? 0.35 : 0), 0, 1);
  hkSkyward = damp(hkSkyward, wantSky, 1.6, dt);

  // ---- the street's own neon breathes with it ------------------------------
  hkNeonPulse = damp(hkNeonPulse, 0.5 + hkShow * 0.5, 2.5, dt);
  hkNeonBreathe(dt);
  hkUpdateWetRoad(game);
  hkUpdateDaiPaiDong(dt);
}

// ================================================================== FISH ====
function hkUpdateFish(game, dt) {
  if (!hkFishMesh || hkFishOut <= 0) return;
  for (let i = 0; i < 26; i++) {
    const o = i * 6;
    if (hkFishData[o + 5] <= 0) continue;
    hkFishData[o + 5] -= dt;
    hkFishData[o + 2] += dt * hkFishData[o + 3] * (i % 2 ? 1 : -1);
    const flop = Math.abs(Math.sin(hkTime * hkFishData[o + 3] + i));
    hkFishData[o] += Math.sin(hkFishData[o + 2]) * dt * 0.9;
    hkFishData[o + 1] += Math.cos(hkFishData[o + 2]) * dt * 0.9;
    hkFishMesh.setMatrixAt(i, hkXform(hkFishData[o], 1.16 + flop * 0.28, hkFishData[o + 1],
      0, hkFishData[o + 2], flop * 1.1, 1, 1, 1));
  }
  hkFishMesh.instanceMatrix.needsUpdate = true;
}

// ============================================================ TASK PLUMBING =
// ============================================================== THE OPEN TOP ==
// THE MINI. Eleven chapters and Mong Kok's street had nothing on it: the ferry
// is eight hundred metres away in the harbour, the show is across the water, and
// the road itself — the one surface the player spends the whole chapter beside —
// was a strip of tarmac with nothing ever on it.
//
// So: an open-top double-decker, doing the length of the street and back. The
// upper deck has no roof, which is the entire point — from four and a half
// metres up in the middle of a seven-metre street you are inside the neon rather
// than under it, and the signs go past at head height on both sides at once.
//
// GETTING UP IS THE PUZZLE AND IT IS SOLVED WITH GEOMETRY, NOT A VERB. The rear
// platform is at 0.92, which is one hop; the stair off it is five treads of 0.62
// and the capybara walks 0.40 by itself and hops 1.2, so it goes up like stairs
// because it IS stairs. Nothing new to learn eleven chapters in.
const hkBUS_Z0 = 58, hkBUS_Z1 = -38;   // the length of the run
const hkBUS_X = 2.6;                   // she keeps left, like everything here
const hkBUS_SPD = 5.4;                 // m/s
const hkBUS_STOPS = [40, 12, -18];     // z of the three stops
const hkBUS_DWELL = 5.5;               // s at a stop
const hkBUS_END = 7.0;                 // s at each terminus
const hkBUS_HX = 1.28, hkBUS_HZ = 5.4;
const hkBUS_PLAT = 0.92;               // the rear platform: one hop off the road
const hkBUS_TOP = 4.42;                // the upper deck
const hkBUS_RIDE = 14.0;               // s up top that count as 'down Nathan Road'
let hkBusGroup = null, hkBusBody = null, hkBusLit = null;
let hkBusZ = hkBUS_Z0, hkBusDir = -1;
let hkBusDwell = hkBUS_END;
let hkBusStop = -1;                    // index of the stop being served
let hkBusPZ = hkBUS_Z0;
let hkBusRideT = 0;
let hkBusDone = false;
let hkBusBell = 0;
const hkBusPos = new THREE.Vector3();

function hkBuildBus(game, root) {
  const M = hkMerger();
  const HX = hkBUS_HX, HZ = hkBUS_HZ;
  // lower saloon, in the red every bus in this city is painted
  M.box(0, 1.55, 0, HX * 2, 2.10, HZ * 2 - 1.2, PALETTE.hkTaxi);
  M.box(0, 1.85, 0, HX * 2 + 0.05, 0.95, HZ * 2 - 2.6, PALETTE.hkTile3);
  M.box(0, 0.44, 0, HX * 2 - 0.12, 0.5, HZ * 2 - 1.6, PALETTE.hkGrille);
  // the destination blind, which on a Hong Kong bus is the brightest thing on it
  M.box(0, 2.42, HZ - 0.55, HX * 2 - 0.6, 0.42, 0.10, PALETTE.hkNeonGold);
  // the deck slab and the open top, with a rail all the way round
  M.box(0, hkBUS_TOP - 0.10, 0, HX * 2, 0.20, HZ * 2 - 1.0, PALETTE.hkGrille);
  M.box(0, hkBUS_TOP - 0.02, 0, HX * 2 - 0.16, 0.06, HZ * 2 - 1.2, PALETTE.hkConcrete);
  for (let s2 = -1; s2 <= 1; s2 += 2) {
    M.box(s2 * (HX - 0.07), hkBUS_TOP + 0.42, 0, 0.10, 0.92, HZ * 2 - 1.0, PALETTE.hkTaxi);
    M.box(s2 * (HX - 0.07), hkBUS_TOP + 0.88, 0, 0.16, 0.08, HZ * 2 - 0.9, PALETTE.hkPoleSteel);
  }
  M.box(0, hkBUS_TOP + 0.42, HZ - 0.55, HX * 2, 0.92, 0.10, PALETTE.hkTaxi);
  // seats up top, in rows, because an empty deck reads as a lorry
  for (let i = 0; i < 5; i++) {
    for (let s2 = -1; s2 <= 1; s2 += 2) {
      M.box(s2 * 0.62, hkBUS_TOP + 0.24, -3.2 + i * 1.5, 0.86, 0.14, 0.80, PALETTE.hkAwning2);
      M.box(s2 * 0.62, hkBUS_TOP + 0.52, -3.6 + i * 1.5, 0.86, 0.56, 0.10, PALETTE.hkAwning2);
    }
  }
  // ---- the rear platform and the stair ----------------------------------
  M.box(0, hkBUS_PLAT - 0.08, -HZ - 0.30, HX * 2 - 0.10, 0.16, 1.10, PALETTE.hkGrille);
  for (let i = 0; i < 5; i++) {
    M.box(-0.45 + i * 0.02, hkBUS_PLAT + 0.62 * (i + 1) - 0.07, -HZ + 0.30 + i * 0.62,
          1.30, 0.14, 0.62, PALETTE.hkGrille);
  }
  M.box(-1.12, hkBUS_PLAT + 1.9, -HZ + 1.5, 0.09, 3.0, 0.09, PALETTE.hkPoleSteel, 0.72, 0, 0);
  // wheels, and a bit of underside so she is not a floating box
  for (let sx = -1; sx <= 1; sx += 2) {
    for (let sz = -1; sz <= 1; sz += 2) {
      M.cyl(sx * (HX - 0.04), 0.46, sz * (HZ - 1.6), 0.46, 0.24, PALETTE.hkGrille, 0, 0, Math.PI / 2, 8);
    }
  }
  const mesh = new THREE.Mesh(M.build(), hkVC());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // ---- THE LOWER SALOON HAS THE LIGHT ON ---------------------------------
  // She goes past at head height on an unlit street with a black slot down
  // each side where the windows are. The Star Ferry two hundred metres away
  // has eighteen lit windows and reads as a vessel with people in it; the bus
  // in the same frame read as a red box. Six panes a side, unlit material, and
  // three dark shapes sitting in them because a lit window with nothing in it
  // is a lightbox — which is the same argument the shopfronts just made.
  {
    const W2 = hkMerger();
    for (let i = 0; i < 6; i++) {
      const wz = -3.6 + i * 1.45;
      W2.box(hkBUS_HX + 0.02, 1.9, wz, 0.06, 0.85, 1.15, 0xffe6b0);
      W2.box(-hkBUS_HX - 0.02, 1.9, wz, 0.06, 0.85, 1.15, 0xffe6b0);
    }
    const wm2 = new THREE.Mesh(W2.build(), new THREE.MeshBasicMaterial({ vertexColors: true }));
    wm2.frustumCulled = false;
    hkBusLit = wm2;
    const S2 = hkMerger();
    for (let i = 0; i < 4; i++) {
      const wz = -3.2 + i * 2.0;
      S2.box(hkBUS_HX - 0.06, 1.86, wz, 0.1, 0.62, 0.42, PALETTE.hkGrille);
      S2.box(-hkBUS_HX + 0.06, 1.86, wz + 0.6, 0.1, 0.62, 0.42, PALETTE.hkGrille);
    }
    mesh.add(new THREE.Mesh(S2.build(), hkVC()));
  }
  hkBusGroup = new THREE.Group();
  hkBusGroup.name = 'hkBus';
  hkBusGroup.add(mesh);
  if (hkBusLit) hkBusGroup.add(hkBusLit);
  root.add(hkBusGroup);

  // Collision: the body, the platform, the five treads and the upper deck.
  // Nothing else — a rail you can stand on is a rail you get stuck on.
  const b = new CANNON.Body({
    mass: 0, type: CANNON.Body.KINEMATIC,
    material: game.mats ? game.mats.ground : undefined,
  });
  b.addShape(new CANNON.Box(new CANNON.Vec3(HX, 1.55, HZ - 0.6)), new CANNON.Vec3(0, 1.55, 0));
  b.addShape(new CANNON.Box(new CANNON.Vec3(HX - 0.05, 0.08, 0.55)),
             new CANNON.Vec3(0, hkBUS_PLAT, -HZ - 0.30));
  for (let i = 0; i < 5; i++) {
    b.addShape(new CANNON.Box(new CANNON.Vec3(0.65, 0.07, 0.31)),
               new CANNON.Vec3(-0.45, hkBUS_PLAT + 0.62 * (i + 1), -HZ + 0.30 + i * 0.62));
  }
  b.addShape(new CANNON.Box(new CANNON.Vec3(HX, 0.10, HZ - 0.5)),
             new CANNON.Vec3(0, hkBUS_TOP - 0.10, 0));
  for (let s2 = -1; s2 <= 1; s2 += 2) {
    b.addShape(new CANNON.Box(new CANNON.Vec3(0.06, 0.46, HZ - 0.5)),
               new CANNON.Vec3(s2 * (HX - 0.07), hkBUS_TOP + 0.42, 0));
  }
  b.allowSleep = false;
  hkBusZ = hkBUS_Z0; hkBusDir = -1; hkBusDwell = hkBUS_END; hkBusPZ = hkBUS_Z0;
  hkBusRideT = 0; hkBusDone = false; hkBusStop = -1;
  b.position.set(hkBUS_X, 0, hkBUS_Z0);
  b.quaternion.setFromEuler(0, Math.PI, 0);
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
  b.previousQuaternion.copy(b.quaternion);
  b.interpolatedQuaternion.copy(b.quaternion);
  game.world.addBody(b);
  hkBusBody = b;
  hkBusPos.set(hkBUS_X, 0, hkBUS_Z0);
  hkBusGroup.position.copy(hkBusPos);
  hkBusGroup.rotation.y = Math.PI;
}

/** True when the capybara is on the UPPER deck (not merely on the platform). */
function hkOnBusTop(p) {
  const b = hkBusBody;
  if (!b || !p) return false;
  const dx = p.x - b.position.x, dz = p.z - b.position.z;
  return Math.abs(dx) < hkBUS_HX + 0.4 && Math.abs(dz) < hkBUS_HZ + 0.4 &&
         p.y > b.position.y + hkBUS_TOP - 0.45 && p.y < b.position.y + hkBUS_TOP + 2.2;
}

function hkUpdateBus(game, dt) {
  const b = hkBusBody;
  if (!b || dt <= 0) { if (b) b.velocity.setZero(); return; }

  if (hkBusDwell > 0) {
    hkBusDwell -= dt;
    if (hkBusDwell <= 0 && game.sfx) game.sfx('pop', { volume: 0.4, pitch: 0.75 });
  } else {
    const was = hkBusZ;
    hkBusZ += hkBUS_SPD * dt * hkBusDir;
    if (hkBusZ <= hkBUS_Z1) { hkBusZ = hkBUS_Z1; hkBusDir = 1; hkBusDwell = hkBUS_END; hkBusStop = -1; }
    else if (hkBusZ >= hkBUS_Z0) { hkBusZ = hkBUS_Z0; hkBusDir = -1; hkBusDwell = hkBUS_END; hkBusStop = -1; }
    else {
      // a stop is served when she crosses it, once per pass
      for (let i = 0; i < hkBUS_STOPS.length; i++) {
        const sz = hkBUS_STOPS[i];
        if (i !== hkBusStop && (was - sz) * (hkBusZ - sz) <= 0) {
          hkBusStop = i;
          hkBusDwell = hkBUS_DWELL;
          hkBusZ = sz;
          if (game.sfx) game.sfx('pop', { volume: 0.5, pitch: 1.5 });
          // the lurch. A bus that arrives and departs without one is a tram.
          if (game.shake && hkOnBusTop(game.capy && game.capy.position)) game.shake(0.10);
          break;
        }
      }
    }
  }
  // Kinematic, moved by VELOCITY and taken FROM THE TARGET — the same rule the
  // Star Ferry is on and the only one that carries a passenger.
  b.velocity.set(0, 0, clamp((hkBusZ - hkBusPZ) / dt, -12, 12));
  hkBusPZ = hkBusZ;
  hkBusGroup.position.copy(b.interpolatedPosition);
  hkBusPos.copy(hkBusGroup.position);
  hkBusGroup.rotation.y = hkBusDir < 0 ? Math.PI : 0;
  b.quaternion.setFromEuler(0, hkBusGroup.rotation.y, 0);
  b.previousQuaternion.copy(b.quaternion);
  b.interpolatedQuaternion.copy(b.quaternion);

  // ---- the ride ---------------------------------------------------------
  const capy = game.capy;
  const up = !!(capy && hkOnBusTop(capy.position));
  if (up && hkBusDwell <= 0) {
    hkBusBell -= dt;
    if (hkBusBell <= 0) {
      hkBusBell = 6.5;
      if (game.sfx) game.sfx('chime', { volume: 0.32, pitch: 0.8 });
    }
  }
  if (hkBusDone) return;
  if (up && hkBusDwell <= 0) {
    hkBusRideT += dt;
    if (hkBusRideT >= hkBUS_RIDE) {
      hkBusDone = true;
      hkTask('bus-top');
    }
  } else if (!up) {
    hkBusRideT = 0;
  }
}

// ================================================================= THE LION ==
// THE SECOND MINI. The open top gave this street something moving on it; what
// the street still had nothing of was an EVENT — a thing the city stops to do,
// on a clock, whether or not a capybara turns up.
//
// A southern lion on the plum-blossom poles. Nine steel posts in the road, a
// drummer, a gong and a pair of cymbals at the foot of them, and a head of
// lettuce with a red packet in it hanging off a shop sign at the top. The lion
// crouches on the tarmac for fourteen seconds with its head down — which is
// both a rest and a RAMP, because a lowered lion head is a slope a capybara
// walks up — then it goes: eight leaps, one every two seconds, climbing from a
// metre to four, and at the top it rears and takes the lettuce.
//
// THE LEAPS ARE SHALLOW ON PURPOSE, and the number is the whole reason this
// works as a carrier rather than as a cutscene. A parabola of half a metre over
// two seconds peaks at one metre per second per second of downward acceleration
// — a tenth of a gravity — so the deck never falls away from its passenger and
// the ordinary contact does the whole job. A lion that leapt the way a lion
// leaps would throw the animal off on the first pole, and it would be right to.
const hkLION_X = -3.4;                 // the empty lane. The bus keeps left at +2.6.
const hkLION_Z0 = 44, hkLION_Z1 = 28;  // the pole run, near end to far
const hkLION_N = 9;                    // poles
const hkLION_Y0 = 1.05, hkLION_Y1 = 3.95;
const hkLION_REST = 14.0;              // s crouched on the road
const hkLION_WALK = 3.5;               // s from the road to the first pole
const hkLION_LEAP = 2.0;               // s per leap
const hkLION_REAR = 4.5;               // s of the choi cheng
const hkLION_DOWN = 3.5;               // s back to the road
const hkLION_DECK = 0.78;              // the back, over the pole top
const hkLION_HX = 0.72, hkLION_HZ = 1.55;
const hkLION_LETTUCE = { x: hkLION_X, y: 5.6, z: hkLION_Z1 - 1.4 };
let hkLionGroup = null, hkLionBody = null, hkLionHead = null, hkLionTail = null;
let hkLionPhase = 0;                   // 0 rest, 1 walk on, 2 poles, 3 rear, 4 down
let hkLionT = 0;
let hkLionLeap = 0;                    // which pole it is leaping FROM
let hkLionPX = hkLION_X, hkLionPY = 0, hkLionPZ = hkLION_Z0 + 5;
let hkLionDone = false, hkLionGotIt = false;
let hkLionDrum = 0, hkLionBeat = 0;
let hkCrackT = -1, hkCrackN = 0;
let hkLionShreds = null, hkLionShredT = -1;
let hkLionTold = false;
const hkLionPos = new THREE.Vector3(hkLION_X, 0, hkLION_Z0 + 5);

/** The top of pole i, 0 at the near (low) end. */
function hkLionPoleZ(i) { return hkLION_Z0 + (hkLION_Z1 - hkLION_Z0) * (i / (hkLION_N - 1)); }
function hkLionPoleY(i) { return hkLION_Y0 + (hkLION_Y1 - hkLION_Y0) * (i / (hkLION_N - 1)); }

function hkBuildLion(game, root) {
  // ---- the poles, the drum and the lettuce (all static) -------------------
  const P = hkMerger();
  // THE POLES HAVE TO BE SEEN FROM THE FAR END OF THE STREET. The first cut was
  // nine-centimetre steel in hkPoleSteel, which against wet tarmac at night is
  // the same grey as the road: from twenty metres there was a lion standing on
  // nothing. Red, with a gold cap, at fourteen centimetres.
  for (let i = 0; i < hkLION_N; i++) {
    const y = hkLionPoleY(i), z = hkLionPoleZ(i);
    P.cyl(hkLION_X, y * 0.5, z, 0.14, y, PALETTE.hkTaxi, 0, 0, 0, 6);
    P.cyl(hkLION_X, y - 0.30, z, 0.16, 0.22, PALETTE.hkNeonGold, 0, 0, 0, 6);
    P.box(hkLION_X, y + 0.05, z, 0.52, 0.12, 0.52, PALETTE.hkNeonGold);
    P.box(hkLION_X, 0.07, z, 0.70, 0.14, 0.70, PALETTE.hkConcreteDk);
    hkStaticBox(game, hkLION_X, y * 0.5, z, 0.30, y, 0.30);
  }
  // the band: a big drum on a stand, a gong, and a pair of cymbals on a crate
  const dz = hkLION_Z0 + 3.6;
  P.cyl(hkLION_X - 2.6, 0.95, dz, 0.62, 0.95, PALETTE.hkTaxi, 0, 0, 0, 8);
  P.cyl(hkLION_X - 2.6, 1.44, dz, 0.64, 0.06, PALETTE.hkCrate, 0, 0, 0, 8);
  P.box(hkLION_X - 2.6, 0.30, dz, 1.4, 0.10, 1.4, PALETTE.hkGrille, 0, 0.7, 0);
  P.cyl(hkLION_X + 2.4, 1.55, dz + 0.6, 0.72, 0.08, PALETTE.hkNeonGold, Math.PI / 2, 0, 0, 8);
  P.box(hkLION_X + 2.4, 0.80, dz + 0.6, 0.10, 1.6, 0.10, PALETTE.hkPoleSteel);
  P.box(hkLION_X + 2.4, 1.62, dz + 0.6, 1.70, 0.09, 0.09, PALETTE.hkPoleSteel);
  // THE CHOI CHENG. A head of lettuce and a red packet, four metres over the
  // last pole. It is the only green in the street and it is where the whole run
  // is pointing — so it hangs off something the player can SEE it hanging off:
  // a bamboo rig across the road, which is how it is actually done, and which
  // this city would put up for a shop opening in about nine minutes.
  for (let s = -1; s <= 1; s += 2) {
    P.cyl(hkLION_X + s * 3.0, 3.35, hkLION_LETTUCE.z, 0.09, 6.7, PALETTE.hkBamboo, 0, 0, 0, 6);
  }
  P.cyl(hkLION_X, 6.62, hkLION_LETTUCE.z, 0.09, 6.2, PALETTE.hkBamboo, 0, 0, Math.PI / 2, 6);
  P.box(hkLION_X, 6.42, hkLION_LETTUCE.z, 5.4, 0.26, 0.06, PALETTE.hkTaxi);
  P.box(hkLION_LETTUCE.x, hkLION_LETTUCE.y + 0.62, hkLION_LETTUCE.z, 0.05, 1.24, 0.05, PALETTE.hkGrille);
  P.sph(hkLION_LETTUCE.x, hkLION_LETTUCE.y, hkLION_LETTUCE.z, 0.34, 0.30, 0.34, PALETTE.hkNeonGreen, 8);
  P.box(hkLION_LETTUCE.x, hkLION_LETTUCE.y - 0.36, hkLION_LETTUCE.z, 0.26, 0.36, 0.05, PALETTE.hkTaxi);
  const pm = new THREE.Mesh(P.build(), hkVC());
  pm.castShadow = true; pm.receiveShadow = true;
  root.add(pm);

  // ---- the lion ----------------------------------------------------------
  // A southern lion is a HEAD and a sheet, and the head is two thirds of it.
  // Everything below is drawn round a back deck at hkLION_DECK, which is the
  // only part of it the physics knows about.
  const B = hkMerger();
  const HX = hkLION_HX, HZ = hkLION_HZ;
  // the body: the sheet over two dancers, and the deck along the spine
  B.box(0, HZ * 0.10 + 0.34, -0.2, HX * 2, 0.70, HZ * 2 - 0.5, PALETTE.hkTaxi);
  B.box(0, hkLION_DECK - 0.06, -0.2, HX * 2 - 0.10, 0.14, HZ * 2 - 0.7, PALETTE.hkNeonGold);
  // the scalloped edge of the sheet, which is the read at any distance
  for (let i = 0; i < 7; i++) {
    const z = -HZ + 0.35 + i * 0.44;
    for (let s = -1; s <= 1; s += 2) {
      B.box(s * (HX + 0.02), 0.30 + (i % 2) * 0.07, z, 0.10, 0.44, 0.40,
            i % 2 ? PALETTE.hkNeonGold : PALETTE.hkNeonWhite);
    }
  }
  // four legs, which are two people, and are therefore never in step
  for (let i = 0; i < 4; i++) {
    B.box((i % 2 ? 1 : -1) * (HX - 0.18), 0.22, (i < 2 ? 1 : -1) * (HZ - 0.55),
          0.24, 0.44, 0.24, PALETTE.hkCrate);
  }
  const bodyMesh = new THREE.Mesh(B.build(), hkVC());
  bodyMesh.castShadow = true;
  hkLionGroup = new THREE.Group();
  hkLionGroup.name = 'hkLion';
  hkLionGroup.add(bodyMesh);

  // The head is its own group because it does two things nothing else does: it
  // goes DOWN to the tarmac at rest (and is then the ramp aboard) and it goes
  // UP at the lettuce. Both of those are the set piece.
  // THE HEAD IS GOLD AND THE BODY IS RED, which is both how one is actually
  // painted and the only way the two read as separate objects: at hkTaxi for
  // both, from behind — which is where the player is for the whole ride — the
  // lion photographed as a red van with a face somewhere on the far end of it.
  const H = hkMerger();
  H.box(0, 0.55, 0.40, 1.60, 1.15, 1.25, PALETTE.hkNeonGold);
  H.box(0, 1.24, 0.30, 1.25, 0.34, 0.95, PALETTE.hkTaxi);          // the crest
  H.cyl(0, 1.58, 0.30, 0.20, 0.44, PALETTE.hkNeonWhite, 0, 0, 0, 6); // the horn
  H.box(0, 0.05, 0.62, 1.38, 0.32, 1.00, PALETTE.hkNeonWhite);      // the lower jaw
  for (let s = -1; s <= 1; s += 2) {
    H.sph(s * 0.44, 0.86, 0.92, 0.26, 0.26, 0.20, PALETTE.hkNeonWhite, 8);
    H.sph(s * 0.44, 0.88, 1.02, 0.13, 0.13, 0.10, PALETTE.hkGrille, 8);
    H.box(s * 0.72, 0.40, 0.10, 0.16, 0.50, 0.42, PALETTE.hkNeonGreen, 0, 0, s * 0.4);
  }
  // the beard, which is what makes it a lion and not a dog
  for (let i = 0; i < 5; i++) {
    H.box(-0.5 + i * 0.25, -0.22, 0.72, 0.20, 0.44, 0.16, PALETTE.hkNeonWhite);
  }
  const headMesh = new THREE.Mesh(H.build(), hkVC());
  headMesh.castShadow = true;
  hkLionHead = new THREE.Group();
  hkLionHead.position.set(0, 0.30, HZ - 0.1);
  hkLionHead.add(headMesh);
  hkLionGroup.add(hkLionHead);

  // the tail: the back dancer's end of the sheet, and it flicks
  const T = hkMerger();
  T.box(0, 0.42, -0.45, 1.10, 0.55, 0.95, PALETTE.hkTaxi);
  T.box(0, 0.66, -0.90, 0.60, 0.20, 0.60, PALETTE.hkNeonGold);
  const tailMesh = new THREE.Mesh(T.build(), hkVC());
  hkLionTail = new THREE.Group();
  hkLionTail.position.set(0, 0, -HZ);
  hkLionTail.add(tailMesh);
  hkLionGroup.add(hkLionTail);
  root.add(hkLionGroup);

  // ---- the shreds of lettuce, which are the payoff -----------------------
  {
    const S = hkMerger();
    S.box(0, 0, 0, 0.16, 0.05, 0.20, PALETTE.hkNeonGreen);
    hkLionShreds = new THREE.InstancedMesh(S.build(), hkVC(), 40);
    hkLionShreds.frustumCulled = false;
    hkLionShreds.visible = false;
    root.add(hkLionShreds);
  }

  // ---- collision: the back, and nothing else -----------------------------
  const b = new CANNON.Body({
    mass: 0, type: CANNON.Body.KINEMATIC,
    material: game.mats ? game.mats.ground : undefined,
  });
  b.addShape(new CANNON.Box(new CANNON.Vec3(HX, hkLION_DECK * 0.5, HZ)),
             new CANNON.Vec3(0, hkLION_DECK * 0.5, 0));
  b.allowSleep = false;
  hkLionPhase = 0; hkLionT = 0; hkLionLeap = 0;
  hkLionPX = hkLION_X; hkLionPY = 0; hkLionPZ = hkLION_Z0 + 5;
  b.position.set(hkLionPX, hkLionPY, hkLionPZ);
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
  game.world.addBody(b);
  hkLionBody = b;
  hkLionPos.set(hkLionPX, hkLionPY, hkLionPZ);
  hkLionGroup.position.copy(hkLionPos);
}

/** True when the animal is on the lion's back, and not merely beside it. */
function hkOnLion(p) {
  const b = hkLionBody;
  if (!b || !p) return false;
  const dx = p.x - b.position.x, dz = p.z - b.position.z;
  return Math.abs(dx) < hkLION_HX + 0.45 && Math.abs(dz) < hkLION_HZ + 0.45 &&
         p.y > b.position.y + hkLION_DECK - 0.5 && p.y < b.position.y + hkLION_DECK + 2.6;
}

function hkUpdateLion(game, dt) {
  const b = hkLionBody;
  if (!b || dt <= 0) { if (b) { b.velocity.setZero(); } return; }
  hkLionT += dt;
  const capy = game.capy;
  const aboard = !!(capy && hkOnLion(capy.position));

  // ---- where it wants to be, this frame ----------------------------------
  let tx = hkLION_X, ty = 0, tz = hkLION_Z0 + 5;
  let headDrop = 1, rear = 0;
  if (hkLionPhase === 0) {
    // CROUCHED, AND THE HEAD IS A RAMP. It rests on the tarmac just short of
    // the first pole, nose down: 0.30 at the chin to 0.78 at the shoulder over
    // a metre and a half, which is a slope the animal walks up without being
    // told anything at all.
    headDrop = 0;
    if (hkLionT > hkLION_REST) { hkLionPhase = 1; hkLionT = 0; hkLionDrum = 0; }
  } else if (hkLionPhase === 1) {
    const u = clamp(hkLionT / hkLION_WALK, 0, 1);
    tz = lerp(hkLION_Z0 + 5, hkLionPoleZ(0), u);
    ty = lerp(0, hkLionPoleY(0), u * u);
    headDrop = u;
    if (u >= 1) { hkLionPhase = 2; hkLionT = 0; hkLionLeap = 0; }
  } else if (hkLionPhase === 2) {
    const i = hkLionLeap;
    const u = clamp(hkLionT / hkLION_LEAP, 0, 1);
    const z0 = hkLionPoleZ(i), z1 = hkLionPoleZ(i + 1);
    const y0 = hkLionPoleY(i), y1 = hkLionPoleY(i + 1);
    // A SHALLOW ARC. See the note at the top: half a metre over two seconds is
    // a tenth of a gravity, so the deck stays under whoever is on it.
    tz = lerp(z0, z1, u);
    ty = lerp(y0, y1, u) + Math.sin(u * Math.PI) * 0.48;
    // the lion sways side to side between poles, because two people under a
    // sheet cannot do anything else
    tx = hkLION_X + Math.sin(u * Math.PI) * 0.22 * (i % 2 ? 1 : -1);
    if (u >= 1) {
      hkLionT = 0;
      hkLionLeap++;
      hkSfx('thud', { volume: 0.55, pitch: 0.45 });
      hkSfx('rustle', { volume: 0.30, pitch: 1.6 });
      if (aboard && game.shake) game.shake(0.07);
      if (hkLionLeap >= hkLION_N - 1) { hkLionPhase = 3; hkLionT = 0; }
    }
  } else if (hkLionPhase === 3) {
    // THE CHOI CHENG. It rears at the top pole, takes the lettuce, and the
    // street gets it back in about forty pieces.
    const u = clamp(hkLionT / hkLION_REAR, 0, 1);
    tz = hkLionPoleZ(hkLION_N - 1);
    ty = hkLionPoleY(hkLION_N - 1) + Math.sin(clamp(u / 0.55, 0, 1) * Math.PI) * 0.55;
    rear = Math.sin(clamp(u / 0.55, 0, 1) * Math.PI);
    if (!hkLionGotIt && u > 0.48) {
      hkLionGotIt = true;
      hkLionShredT = 0;
      hkSfx('chime', { volume: 0.9, pitch: 0.35, force: true });
      hkSfx('cheer', { volume: 0.8, force: true });
      // ---- AND THE FIRECRACKERS -------------------------------------------
      // You do not take the lettuce in silence. A string of them goes off at
      // the choi cheng and it is the loudest thirty seconds of anybody's shop
      // opening: hkCrackT runs a burst of pops for two and a half seconds,
      // accelerating and then falling away, with the paper coming down after.
      hkCrackT = 0; hkCrackN = 0;
      if (game.shake) game.shake(0.22);
      if (!aboard) hkToast('you were supposed to be on it.');
    }
    // ---- AND IT COUNTS FOR THE WHOLE REAR, NOT FOR ONE FRAME OF IT -------
    // The old form tested `aboard` inside the `u > 0.48` edge, which is a
    // single frame of a forty-one second cycle. A player thrown a foot off the
    // back by the eighth leap and scrambling on again at the top — which is
    // the most likely way anybody actually rides this — got nothing and had to
    // sit through the whole run once more. The choi cheng is four and a half
    // seconds long and being on the lion for any of it is being on the lion.
    if (hkLionGotIt && aboard && !hkLionDone) {
      hkLionDone = true;
      hkTask('choi-cheng');
    }
    if (u >= 1) { hkLionPhase = 4; hkLionT = 0; }
  } else {
    const u = clamp(hkLionT / hkLION_DOWN, 0, 1);
    tz = lerp(hkLionPoleZ(hkLION_N - 1), hkLION_Z0 + 5, u);
    ty = lerp(hkLionPoleY(hkLION_N - 1), 0, u);
    headDrop = 1 - u;
    if (u >= 1) { hkLionPhase = 0; hkLionT = 0; hkLionGotIt = false; }
  }

  // ---- move it: velocity from the PREVIOUS TARGET, on all three axes ------
  // Contract, rule 3, and the one that keeps being relearnt: cannon integrates
  // a kinematic body inside world.step, which runs before this, so differencing
  // against the body's own position measures the distance the LAST velocity
  // already covered and flips sign every frame.
  b.velocity.set(clamp((tx - hkLionPX) / dt, -12, 12),
                 clamp((ty - hkLionPY) / dt, -12, 12),
                 clamp((tz - hkLionPZ) / dt, -12, 12));
  hkLionPX = tx; hkLionPY = ty; hkLionPZ = tz;

  hkLionGroup.position.copy(b.interpolatedPosition);
  hkLionPos.copy(hkLionGroup.position);
  hkLionGroup.rotation.y = Math.PI;      // it faces down the run, toward -z
  // pitch and roll on the MESH only (rule 4) — the box the passenger stands in
  // stays level, and eight degrees of tilt is not worth a rate-integrated body
  hkLionGroup.rotation.x = -rear * 0.62 + Math.sin(hkLionT * 5.2) * 0.02;
  hkLionGroup.rotation.z = Math.sin(hkLionT * 3.1 + hkLionLeap) * 0.05;
  if (hkLionHead) {
    hkLionHead.position.y = lerp(-0.24, 0.30, headDrop) + rear * 0.55;
    hkLionHead.rotation.x = lerp(0.42, 0, headDrop) - rear * 0.85 +
                            Math.sin(hkLionT * 6.4) * (hkLionPhase === 2 ? 0.10 : 0.03);
  }
  if (hkLionTail) hkLionTail.rotation.y = Math.sin(hkLionT * 4.1) * 0.34;

  // ---- the band ----------------------------------------------------------
  // A drum on the two, and nothing at all while it is resting: a lion dance
  // that plays through its own tea break is a fairground ride.
  // ---- A LION BAND IS A DRUM, A GONG AND A PAIR OF CYMBALS ----------------
  // There is a gong and a pair of cymbals drawn at the foot of the poles and
  // neither of them had ever made a sound: the whole set piece was one drum
  // beat every half second, which is a metronome. The real thing is a cycle —
  // the drum on the beat, the cymbals ON TOP of the drum (they are played by
  // the same person following the same hand), and the gong on the ONE, which
  // is what gives eight leaps a bar line to land on.
  if (hkLionPhase !== 0) {
    hkLionDrum -= dt;
    if (hkLionDrum <= 0) {
      hkLionDrum = 0.5;
      hkLionBeat = (hkLionBeat + 1) % 4;
      const cp = capy && capy.position;
      const far = cp ? Math.hypot(cp.x - hkLionPos.x, cp.z - hkLionPos.z) : 999;
      if (far < 60) {
        const v = clamp(0.42 - far * 0.005, 0.06, 0.42);
        hkSfx('thud', { volume: v, pitch: hkLionBeat === 0 ? 0.44 : 0.5 });
        // the cymbals, a pair, a fraction after the drum — never dead on it,
        // because two things exactly together are one thing
        if (hkLionBeat % 2 === 0) hkSfx('tick', { volume: v * 0.85, pitch: 2.4 });
        // and the gong on the one
        if (hkLionBeat === 0) hkSfx('hiss', { volume: v * 0.75, pitch: 0.55 });
      }
    }
  }

  // ---- the firecrackers ---------------------------------------------------
  // A REAL STRING IS NOT A STEADY RATTLE. It starts fast, runs for a couple of
  // seconds and dies out with a couple of stragglers, so the interval opens
  // out as it goes — and every crack is a different pitch, because they are.
  if (hkCrackT >= 0) {
    hkCrackT += dt;
    const cp3 = capy && capy.position;
    const far3 = cp3 ? Math.hypot(cp3.x - hkLION_LETTUCE.x, cp3.z - hkLION_LETTUCE.z) : 999;
    const want = hkCrackT < 1.6 ? Math.floor(hkCrackT / 0.075)
                                : 21 + Math.floor((hkCrackT - 1.6) / 0.26);
    while (hkCrackN < want && hkCrackN < 30) {
      hkCrackN++;
      if (far3 < 70) {
        hkSfx('pop', { volume: clamp(0.55 - far3 * 0.006, 0.05, 0.55) *
                               (hkCrackN > 21 ? 0.7 : 1),
                       pitch: 1.5 + Math.random() * 0.75 });
      }
    }
    if (hkCrackT > 3.6) hkCrackT = -1;
  }

  // ---- the shreds --------------------------------------------------------
  if (hkLionShredT >= 0 && hkLionShreds) {
    hkLionShredT += dt;
    hkLionShreds.visible = hkLionShredT < 4.5;
    for (let i = 0; i < 40; i++) {
      const a = i * 2.399, r = 0.4 + (i % 7) * 0.30;
      const t = hkLionShredT;
      const x = hkLION_LETTUCE.x + Math.cos(a) * r * (0.5 + t * 1.5);
      const z = hkLION_LETTUCE.z + Math.sin(a) * r * (0.5 + t * 1.5);
      const y = hkLION_LETTUCE.y + 0.4 - 2.2 * t * t + Math.sin(a * 3) * 0.2;
      hkLionShreds.setMatrixAt(i, hkXform(x, Math.max(0.04, y), z,
        t * 3 + a, a, t * 2.2, 1, 1, 1));
    }
    hkLionShreds.instanceMatrix.needsUpdate = true;
    if (hkLionShredT > 4.5) hkLionShredT = -1;
  }

  // ---- the pointer -------------------------------------------------------
  if (!hkLionTold && !hkLionDone && capy && capy.position) {
    const cp = capy.position;
    if (Math.hypot(cp.x - hkLionPos.x, cp.z - hkLionPos.z) < 12 && hkLionPhase === 0) {
      hkLionTold = true;
      hkToast('its head is on the road. that is a ramp.');
    }
  }
}

function hkTask(id) {
  const g = hkGame;
  if (g && typeof g.completeTask === 'function') { try { g.completeTask(id); } catch (e) {} }
}
function hkToast(t) {
  const g = hkGame;
  if (g && typeof g.toast === 'function') { try { g.toast(t); } catch (e) {} }
}
function hkSfx(n, o) {
  // ALWAYS through the dispatcher, never a bare synth: it is what supplies the
  // default volume and pitch and what wraps every voice in a try/catch.
  const g = hkGame;
  if (g && typeof g.sfx === 'function') { try { g.sfx(n, o); } catch (e) {} }
}

// =============================================================== THE VOICES =
/**
 * WHAT THE DENSEST STREET ON EARTH SOUNDS LIKE, and it had four noises.
 *
 * Before 23 Aug 2026 chapter eleven's audio was: a ferry horn twice, a bus
 * door, a lion drum, a chime per tower and the machine underneath. A hundred
 * and six metres of Mong Kok with eighty people, a hundred vehicles' worth of
 * road, two woks on fire and a wet market on it, in silence.
 *
 * Four more, and every one of them is a thing you can SEE the source of:
 *
 *   the CROSSING — its own function, hkUpdateCrossing, because the tick and
 *     the green man are one clock;
 *   the TRAFFIC — a car horn from somewhere off the map, which on that street
 *     is roughly a metronome, and never while the animal is up a scaffold;
 *   the WOK — a hiss when the cook drops something in, gated on being near
 *     enough to see the flame do it;
 *   the FERRY — her bell as she comes alongside, which is the only sound in
 *     the chapter that means a THING HAS ARRIVED.
 */
let hkHornT = 9, hkWokT = 4, hkBellRung = 0;
function hkUpdateVoices(game, dt) {
  const cp = game.capy && game.capy.position;
  if (!cp) return;

  // ---- somebody leaning on a horn, two streets away -----------------------
  hkHornT -= dt;
  if (hkHornT <= 0) {
    hkHornT = 7 + Math.random() * 11;
    // not from a roof: at thirty-four metres the street is a long way down and
    // a car horn at full volume up there is a car horn in the room
    const high = cp.y > 12 ? 0.35 : 1;
    if (hkInZone('street', cp.x, cp.z) || cp.y > 12) {
      hkSfx('horn', { volume: 0.13 * high, pitch: 1.9 + Math.random() * 0.4 });
      if (Math.random() < 0.4) {
        hkHornT = 0.34;                      // and the answer, which is the joke
      }
    }
  }

  // ---- the wok ------------------------------------------------------------
  // A hiss is what a wet thing hitting three hundred degrees actually sounds
  // like, and it is the one sound in this chapter with a flame attached to it
  // that you can watch breathe at the same time.
  const dw = Math.hypot(cp.x - hkDPD.x, cp.z - hkDPD.z);
  hkWokT -= dt;
  if (hkWokT <= 0) {
    hkWokT = 3.4 + Math.random() * 4;
    if (dw < 26) {
      hkSfx('hiss', { volume: clamp(0.34 - dw * 0.009, 0.03, 0.34), pitch: 1.35 });
      if (dw < 12) hkSfx('rustle', { volume: 0.14, pitch: 1.8 });   // the ladle
    }
  }

  // ---- and the ferry's bell -----------------------------------------------
  // She rings once alongside. hkFerryT is 0 and 1 at the two berths, so the
  // latch is 'we were moving and now we are not' rather than a timer, and it
  // cannot double-ring on the frame the direction flips.
  if (hkFerryBody) {
    const berthed = hkFerryT < 0.02 || hkFerryT > 0.98;
    if (berthed && !hkBellRung) {
      hkBellRung = 1;
      const df = Math.hypot(cp.x - hkFerryBody.position.x, cp.z - hkFerryBody.position.z);
      if (df < 120) {
        hkSfx('chime', { volume: clamp(0.5 - df * 0.0035, 0.05, 0.5), pitch: 1.7 });
      }
    } else if (!berthed) hkBellRung = 0;
  }
}

// ================================================================== TASKS ===
function hkUpdateTasks(game, dt) {
  const capy = game.capy;
  if (!capy || !capy.position) return;
  const p = capy.position;
  const input = game.input;

  // ---- the bakery ---------------------------------------------------------
  if (!hkTartDone && hkInZone('bakery', p.x, p.z) && input && input.actionPressed) {
    hkTartDone = true;
    hkTask('egg-tart');
    hkToast('still warm. that is the whole trick with those.');
    hkSfx('pop', { volume: 0.9, pitch: 1.45 });
    if (hkBakeryGroup) hkBakeryGroup.rotation.z = 0.03;
  }

  // ---- Victoria Harbour ---------------------------------------------------
  // ELEVEN CHAPTERS OF WATER AND THIS ONE IS THE PUNCHLINE. Eight hundred
  // metres of it runs across the bottom of the map, the Star Ferry crosses it
  // twice a minute, the whole marquee moment happens on the far side of it, and
  // the game never once suggested getting IN.
  //
  // Two seconds, which is about as long as anybody would want.
  if (!hkHarbourDone) {
    if (hkIsOverWater(p.x, p.z) && p.y < 0.35) {
      hkHarbourT += dt;
      if (hkHarbourT > 2.0) {
        hkHarbourDone = true;
        hkTask('harbour-swim');
        hkSfx('splash', { volume: 0.7, pitch: 0.8 });
        hkToast('you will want a shower. there is no shower.');
      }
    } else hkHarbourT = 0;
  }
  // ---- the climb ----------------------------------------------------------
  if (capy.climbing) {
    if (p.y > hkClimbBest) hkClimbBest = p.y;
    if (!hkClimbDone && p.y > 20) {
      hkClimbDone = true;
      hkTask('bamboo-climb');
      hkToast('a grass. forty storeys of it, tied together by hand.');
    }
    if (typeof game.record === 'function' && hkClimbBest > 4) {
      game.record('bamboo-climb', hkClimbBest);
    }
  }
  // ---- AND THE WAY UP PAYS AS YOU GO -------------------------------------
  // The bamboo is this chapter's whole reason to exist — the one verb in
  // eighteen chapters that is about the other axis — and forty metres of it
  // paid out exactly once, at twenty, and then nothing for the second half.
  // A climb that goes quiet halfway is a climb the player starts wondering
  // about, and wondering is the opposite of what this chapter is for.
  //
  // Five rungs, each once per session. Each is a creak of lashing under the
  // weight plus one line, and they get quieter and drier as they go up because
  // the street does: at eight metres you are above the awnings, at thirty-four
  // the loudest thing near you is the wind. The last one is the roof, and it is
  // the only one that is a full stop.
  //
  // hkClimbRung only ever climbs and is reset with the biome, so a player who
  // goes up and down the same pole is not read a list of achievements.
  if (p.y > hkCLIMB_RUNGS[hkClimbRung] &&
      hkInZone('scaffold', p.x, p.z) && hkClimbRung < hkCLIMB_RUNGS.length - 1) {
    const r = hkClimbRung++;
    const q = 1 - r / hkCLIMB_RUNGS.length;
    hkSfx('rustle', { volume: 0.16 + q * 0.16, pitch: 0.72 + r * 0.12 });
    hkSfx('tick', { volume: 0.10 + q * 0.10, pitch: 1.4 + r * 0.2 });
    if (hkCLIMB_SAY[r]) hkToast(hkCLIMB_SAY[r]);
  }
  if (!hkClimbTold && hkInZone('scaffold', p.x, p.z) && p.y < 3) {
    hkClimbTold = true;
    hkToast('hold E against the bamboo and push toward it.');
  }

  // ---- the laundry poles ---------------------------------------------------
  // A crossing is wall to wall, above the traffic, without touching the ground.
  const onPole = p.y > hkPOLE_Y - 1.4 && p.y < hkPOLE_Y + 2.4 && Math.abs(p.x) < hkFACE;
  let nearPole = false;
  for (let k = 0; k < hkPOLE_Z.length; k++) if (Math.abs(p.z - hkPOLE_Z[k]) < 1.5) nearPole = true;
  if (onPole && nearPole) {
    if (hkPoleT < 0) {
      if (Math.abs(p.x) > hkFACE - 4.5) { hkPoleT = 0; hkPoleFrom = Math.sign(p.x); }
    } else {
      hkPoleT += dt;
      // the clock, on the paper, while you are over the street (v32)
      if (game.recordLive) game.recordLive('laundry-pole', hkPoleT);
      if (Math.sign(p.x) === -hkPoleFrom && Math.abs(p.x) > hkFACE - 4.5) {
        if (!hkPoleDone) {
          hkPoleDone = true;
          hkTask('laundry-pole');
          hkToast('somebody’s washing will never be the same.');
          hkSfx('pop', { volume: 0.85, pitch: 1.1 });
        }
        if (typeof game.record === 'function') game.record('laundry-pole', hkPoleT);
        hkPoleT = -1;
      } else if (hkPoleT > 45) hkPoleT = -1;
    }
  } else if (hkPoleT >= 0 && p.y < hkPOLE_Y - 2.5) {
    // ---- YOU FELL OFF, AND IT SAYS SO -----------------------------------
    // Falling off IS the task and there should be a cost, but the cost was
    // SILENCE: the run ended, nothing on screen changed, and the player went
    // on carefully balancing across a street on a crossing that had already
    // stopped counting. Same rule as the passerelle in Venice — no invisible
    // state. Only for a run that had got somewhere; a slip off the first pole
    // does not need a sentence about it.
    if (hkPoleT > 1.6 && !hkPoleDone) {
      hkToast('back to the pavement. the crossing starts at a wall, not in the middle.');
      hkSfx('thud', { volume: 0.34, pitch: 1.15 });
    }
    hkPoleT = -1;                       // you fell off. that is the task.
  }

  // ---- the market ---------------------------------------------------------
  if (!hkMarketDone && hkInZone('market', p.x, p.z) && input && input.actionPressed) {
    hkMarketDone = true;
    hkFishOut = 1;
    for (let i = 0; i < 26; i++) hkFishData[i * 6 + 5] = 999;
    hkTask('wet-market');
    hkToast('twenty-six of them. on the floor. immediately.');
    hkSfx('splash', { volume: 0.9, pitch: 1.3 });
    if (hkTankGroup) hkTankGroup.rotation.z = 0.05;
  }

  // ---- the big sign -------------------------------------------------------
  // Landing on it sets it swinging, which is the cause-and-effect the whole
  // moment is made of: you can see that you did that.
  const dsx = p.x - hkSIGN.x, dsz = p.z - hkSIGN.z, dsy = p.y - hkSIGN.y;
  const onSign = Math.abs(dsx) < 5.8 && Math.abs(dsz) < 1.5 && dsy > 1.2 && dsy < 4.2;
  if (onSign) {
    hkSignStandT += dt;
    // A SPRING NEVER SETTLES AT EXACTLY ZERO, so testing for it means the sign
    // swings once, on the first landing of the session, and is inert for every
    // one after it. Test for 'at rest', not for 'zero'.
    if (hkSignStandT < 0.14 && Math.abs(hkSignSwayV) < 0.06) hkSignSwayV = 1.9;
    if (hkSignStandT > 1.6 && !hkSignDone) {
      hkSignDone = true;
      hkTask('neon-sign');
      hkToast('half a tonne of neon, and it is holding. probably.');
      hkSfx('thud', { volume: 0.7, pitch: 0.8 });
      if (typeof game.shake === 'function') game.shake(0.16);
    }
  } else {
    hkSignStandT = 0;
  }
  // the sway itself: a spring, and the body follows it, so what you stand on is
  // what you see
  hkSignSwayV += (-hkSignSway * 26 - hkSignSwayV * 2.6) * dt;
  hkSignSway += hkSignSwayV * dt;
  if (hkSignGroup) hkSignGroup.rotation.z = hkSignSway * 0.045;
  if (hkSignBody) {
    const ty = hkSIGN.y + Math.sin(hkSignSway * 0.5) * 0.12;
    const inv = dt > 1e-5 ? 1 / dt : 60;
    // FROM THE TARGET. neon-sign asks for 1.6 s standing on it WHILE it swings,
    // which is exactly the window in which the old form oscillated.
    hkSignBody.velocity.set(0, (ty - hkSignPY) * inv, 0);
    hkSignPY = ty;
    hkSignBody.position.y = ty;
    hkSyncBody(hkSignBody);

  }
}

// =============================================================== LIFECYCLE ===
export function createKowloon(game) {
  hkGame = game;

  game.biome.register('kowloon', {
    ensureBuilt() { hkBuild(game); },
    onEnter() {
      // The evening is put back to a couple of minutes before eight, so a
      // chapter you come back to opens the way it opened the first time.
      hkPhase = 0.06;
      hkShow = 0; hkShowT = -1; hkLitCount = 0; hkWarned = false; hkSoonSaid = false;
      hkSkyward = 0;
      hkPoleT = -1; hkFerryRideT = 0; hkSignStandT = 0;
      hkSignSway = 0; hkSignSwayV = 0;
      hkCrossT = 4.0; hkCrossTick = 0;
      if (hkCrossMesh) hkCrossMesh.userData.g = undefined;
      hkClimbTold = false; hkClimbRung = 0;
      hkTime = 0;
      hkFerryT = 0; hkFerryDir = 1;
      // The lion is put back on the tarmac with its head down, which is where
      // it has to be for the chapter's first look at it to teach the ramp.
      hkLionPhase = 0; hkLionT = 0; hkLionLeap = 0; hkLionGotIt = false;
      hkLionShredT = -1; hkLionTold = false;
      hkCrackT = -1; hkCrackN = 0; hkLionBeat = 0;
      hkQueueT = 0; hkQueueGoing = -1;
      if (hkQueue) for (let i = 0; i < hkQ_N; i++) hkQueueData[i * 3] = i;
      hkHornT = 9; hkWokT = 4; hkBellRung = 0;
      // ---- AND THE BUS, WHICH NOTHING WAS PUTTING BACK ---------------------
      // Every other moving thing in this chapter is reset here — the ferry, the
      // lion, the queue, the crossing — and the open-top was not, so a return
      // visit opened with the bus parked wherever it had been abandoned,
      // possibly halfway through a fourteen-second dwell at a stop with its
      // doors metaphorically open, and with a PART-COMPLETED RIDE banked:
      // seven seconds of hkBUS_RIDE carried across a chapter boundary, so the
      // mini could tick after a fraction of the ride it is scored on. She goes
      // back to the north end, pointing down the street, with nothing owed.
      hkBusZ = hkBUS_Z0; hkBusDir = -1; hkBusDwell = hkBUS_END;
      hkBusStop = -1; hkBusRideT = 0; hkBusBell = 0;
      hkBusPZ = hkBUS_Z0;
      if (hkBusBody) {
        hkBusBody.position.z = hkBUS_Z0;
        hkBusBody.velocity.setZero();
        hkSyncBody(hkBusBody);
      }
    },
    onExit() {
      // ARMED FLAGS DO NOT SURVIVE TRAVEL. Every biome shares one coordinate
      // space, and a latch left set is a task that ticks in the wrong country.
      hkHarbourT = 0;
      // Anything stateful that could hold the player, cleared on the way out.
      hkPoleT = -1; hkFerryRideT = 0; hkSignStandT = 0; hkShowT = -1;
      hkLionShredT = -1; hkBusRideT = 0; hkHarbourT = 0; hkClimbBest = 0;
    },
  });

  const api = {
    built() { return hkBuilt; },
    terrainHeight: hkTerrain,
    slopeAt: hkSlope,
    waterLevel: -0.5,
    isOverWater: hkIsOverWater,
    waterHeightAt: hkWaterHeightAt,
    inZone: hkInZone,
    navBlocked: hkNavBlocked,
    surfacePitch: hkSurfacePitch,
    SPAWN: hkSPAWN,
    // the open-top. It MOVES — ask, never cache.
    bus() { return hkBusPos; },
    /** The lion MOVES, and it is four metres up for a third of its cycle. */
    lion() { return hkLionPos; },
    onBusTop() { return !!(hkGame && hkGame.capy && hkOnBusTop(hkGame.capy.position)); },

    /** THE NEW VERB. capybara.js asks the live biome and nobody else. */
    climbHold: hkClimbHold,
    // A jump between two bamboo poles eleven metres over a road is a jump you
    // should be able to steer. Not the Drift's 0.64 — that is a world where the
    // jump IS the traversal — but well clear of the kerb-hopping default.
    airControl: 0.50,
    /** 0..1 — how far the camera rig should crane UP. See CONTRACT, skyward(). */
    skyward() { return hkSkyward; },

    // landmarks
    bakery: hkBAKERY,
    market: hkMARKET,
    // AT THE HOLE, not at the middle of the lattice: the decks are solid
    // either side of z = 0 and this is the shaft that goes all the way up.
    scaffold: { x: hkSCAF.x + hkSCAF.out + 1.2, z: (hkSCAF.z0 + hkSCAF.z1) * 0.5 },
    // WITH A y ON IT. Without one, hintAt sets hintY to NaN, the beacon drops
    // onto the pavement inside the tong lau block thirty-four metres below the
    // thing it is pointing at, and systems.js suppresses the up-arrow glyph —
    // so the marquee's own hint pointed at a wall. `sign` below has always
    // carried its height; this one never did.
    roof: { x: hkSCAF.x - 8.6, y: hkROOF_Y + 0.4, z: (hkSCAF.z0 + hkSCAF.z1) * 0.5 },
    poles: { x: 0, z: hkPOLE_Z[1] },
    sign: hkSIGN,
    pier: { x: 0, z: hkPIER_END - 4 },
    /** The ferry MOVES. Ask; never cache. */
    ferry() {
      if (!hkFerryBody) return hkSPAWN;
      hkV3b.set(hkFerryBody.position.x, hkFerryBody.position.y, hkFerryBody.position.z);
      return hkV3b;
    },

    /** 0..1 — the show. systems.js reads it for the light and the band. */
    show() { return hkShow; },
    showing() { return hkShowT >= 0; },
    seenShow() { return hkSeenShow; },
    litTowers() { return hkLitCount; },
    neon() { return hkNeonPulse; },
    climbing() { return !!(game.capy && game.capy.climbing); },

    update(dt) {
      if (!hkBuilt) return;
      if (!game.biome.isActive('kowloon')) return;
      hkTime += dt;

      hkUpdateShow(game, dt);
      hkUpdateBus(game, dt);
      hkUpdateLion(game, dt);
      hkUpdateFerry(game, dt);
      hkUpdateJunk(dt);
      hkUpdateCrossing(game, dt);
      hkUpdateVoices(game, dt);
      hkUpdateQueue(dt);
      hkUpdateFish(game, dt);
      hkUpdateCrowd(game, dt);
      hkUpdateDrip(game, dt);
      hkUpdateTasks(game, dt);

      if (hkWaterMesh) hkWaterMesh.position.y = -0.5 + Math.sin(hkTime * 0.7) * 0.06;
    },
  };
  game.kowloon = api;
  return api;
}

function hkBuild(game) {
  if (hkBuilt) return;
  hkBuilt = true;
  hkInitGeos();

  hkRoot = new THREE.Group();
  hkRoot.name = 'kowloon';
  game.scene.add(hkRoot);

  // the ground: flat, one plane, and a ramp into the harbour
  const g = new THREE.PlaneGeometry(300, 320, 60, 80);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, -60);
  const p = g.attributes.position.array;
  const col = new Float32Array(p.length);
  const c = new THREE.Color();
  const wet = new THREE.Color(PALETTE.hkWet);
  const conc = new THREE.Color(PALETTE.hkConcrete);
  for (let i = 0; i < p.length; i += 3) {
    p[i + 1] = hkTerrain(p[i], p[i + 2]);
    c.copy(conc).lerp(wet, clamp((Math.sin(p[i] * 0.7) * Math.sin(p[i + 2] * 0.5) + 1) * 0.3, 0, 0.6));
    col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const gm = new THREE.Mesh(g, hkVC());
  gm.receiveShadow = true;
  gm.frustumCulled = false;
  hkRoot.add(gm);

  // MIND WHICH WAY THE SECOND AXIS RUNS — anchored at the FAR z edge, j walking
  // back toward Z0. Getting this wrong leaves the biome with no collision floor
  // at all and it is nearly invisible from the capybara.
  {
    const X0 = -150, Z0 = -220, EL = 5;
    const NX = 60, NZ = 68;
    const Z1 = Z0 + NZ * EL;
    const data = [];
    for (let i = 0; i <= NX; i++) {
      const row = [];
      for (let j = 0; j <= NZ; j++) row.push(hkTerrain(X0 + i * EL, Z1 - j * EL));
      data.push(row);
    }
    const hf = new CANNON.Heightfield(data, { elementSize: EL });
    const b = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
    b.addShape(hf);
    b.position.set(X0, 0, Z1);
    b.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    hkSyncBody(b);
    game.world.addBody(b);
  }

  hkBuildStreet(game, hkRoot);
  hkBuildBus(game, hkRoot);
  hkBuildLion(game, hkRoot);
  hkBuildScaffold(game, hkRoot);
  hkBuildPoles(game, hkRoot);
  hkBuildNeon(game, hkRoot);
  hkBuildWetRoad(hkRoot);
  hkBuildBakery(game, hkRoot);
  hkBuildQueue(game, hkRoot);
  hkBuildDaiPaiDong(game, hkRoot);
  hkBuildMarket(game, hkRoot);
  hkBuildHarbour(game, hkRoot);
  hkBuildSkyline(hkRoot);
  hkBuildFerry(game, hkRoot);
  hkBuildJunk(hkRoot);
  hkBuildCrowd(game, hkRoot);
  hkBuildCrossing(hkRoot);
  hkBuildLitPanes(hkRoot);
  hkBuildDrip(hkRoot);

  // ---- THE PEOPLE WHO LIVE HERE ------------------------------------------
  // See npc.js, THE LOCALS. Each of these is a point somebody is standing at,
  // a few things they might say when the capybara turns up, and a different
  // few for when it wheeks at them. Where the chapter owns a Group for the
  // figure, it is handed over too and the figure turns to watch.
  //
  // ---- AND THEY KNOW WHAT TIME IT IS (v21) -------------------------------
  //
  // Twelve people on a hundred metres of Mong Kok pavement, in the one chapter
  // in this game that is on a CLOCK — eight o'clock, every hundred and fifty-two
  // seconds, the far shore lights up — and not one of them ever mentioned it
  // having happened, was about to happen, or having just finished. The man on
  // the pier said 'lights start at eight, everybody stops walking' at half past
  // seven, at eight exactly, and at twenty past.
  //
  // Four states of the evening, the same conditional machinery Venice's tide
  // now uses (npc.js localResolve, since v20), and the whole street knows which
  // one it is in. Plus `after`/`before` on the six tasks that happen where
  // somebody is standing, and `onTask` so the thing you just did in front of
  // somebody is a thing they saw.
  //
  // Same rule as Venice: EVERY POOL KEEPS AT LEAST ONE UNCONDITIONAL LINE, or
  // there is a state in which somebody has nothing to say and stands there.
  const hkBefore  = () => hkPhase < hkSHOW_SOON;
  const hkSoon    = () => hkPhase >= hkSHOW_SOON && hkPhase < hkSHOW_ON;
  const hkDuring  = () => hkShowT >= 0;
  const hkAfter   = () => hkShowT < 0 && hkSeenShow && hkPhase >= hkSHOW_OFF;
  const hkUpHigh  = () => !!(game.capy && game.capy.position && game.capy.position.y > 9);

  if (typeof game.addLocal === 'function') {
    hkBakerRec = game.addLocal({ biome: 'kowloon', x: hkBAKERY.x - 0.2, y: 0, z: hkBAKERY.z + 3.2, near: 6, face: 1.5,
      figure: { shirt: PALETTE.cloth3 },
      lines: ['Egg tart! Just out! Two minutes ago!',
              { t: 'Hey. Hey. That tray is not for you.', before: 'egg-tart' },
              { t: 'That tray WAS not for you. Past tense. Thank you.', after: 'egg-tart' },
              'You want pineapple bun? No pineapple in it. Nobody knows why.',
              { t: 'Three more trays before eight. Nobody buys after the lights.',
                when: hkBefore },
              { t: 'Half the queue has gone to look at the water. Every night.',
                when: hkDuring },
              { t: 'Everything half price. It is nine o’clock and I am not carrying it home.',
                when: hkAfter }],
      wheek: ['Aiya! The whole street heard that.',
              'Take one. TAKE ONE. Then go.'],
      onTask: { 'egg-tart': ['THE WHOLE TRAY. He took the whole — no. One. He took one.',
                             'Still warm. Of course it was still warm. That is the point of them.'],
                'symphony': ['You watched it from up THERE? I have lived here forty years.'] } });
    hkFishRec = game.addLocal({ biome: 'kowloon', x: hkMARKET.x - 2, y: 0, z: hkMARKET.z, near: 7,
      figure: { shirt: PALETTE.cloth2, legs: PALETTE.stoneDark },
      lines: ['Grouper still swimming. You can see it is swimming.',
              { t: 'Do not put your face in the tank.', before: 'wet-market' },
              { t: 'You did not put your face in the tank. You emptied it.', after: 'wet-market' },
              'Everything fresh. Everything alive. Some of it too alive.',
              { t: 'Twenty-six in that tank this morning. Twenty-six tonight.',
                before: 'wet-market' },
              { t: 'Do you know how long it takes to catch twenty-six fish off a floor?',
                after: 'wet-market' },
              { t: 'Nobody buys fish at eight. They all go and look at buildings.',
                when: hkDuring }],
      wheek: ['You have upset the fish.',
              { t: 'They have been upset since Tuesday. Since YOU.', after: 'wet-market' }],
      onTask: { 'wet-market': ['ALL of them. On the floor. Immediately.',
                               'Grouper is under the crate. The grouper is ALWAYS under the crate.'] } });
    hkPierRec = game.addLocal({ biome: 'kowloon', x: 0, y: 0, z: hkPIER_Z + 4, near: 8,
      figure: { shirt: PALETTE.denim, hat: PALETTE.cloth6 },
      lines: ['Lower deck two dollars sixty. Upper deck more.',
              'Hundred and twenty years this crossing. Same eight minutes.',
              { t: 'Lights start at eight. Everybody stops walking. You will see.',
                when: hkBefore },
              { t: 'Any minute. Get high or get nothing — from down here it is a glow.',
                when: hkSoon },
              { t: 'There. Look at them all. Not one person on this pier is moving.',
                when: hkDuring },
              { t: 'And that is that until tomorrow. Boat still goes, though.',
                when: hkAfter },
              { t: 'She has a horn on her and nobody ever asks. Go on. Ask.',
                before: 'ferry-horn' },
              { t: 'I heard that from the pier. Everyone in Central heard that.',
                after: 'ferry-horn' }],
      wheek: ['Save it for the horn, would you.',
              { t: 'Not while she is alongside. You will have people running.',
                when: hkBefore }],
      onTask: { 'star-ferry': ['Eight minutes, two dollars sixty, and he paid neither.'],
                'ferry-horn': ['NINETEEN FIFTY-SEVEN, that horn. And you leant on it.'],
                'harbour-swim': ['Out. OUT. That is a shipping lane and you are a rodent.'] } });
    // ---- AND FOUR MORE, because a hundred metres of Mong Kok pavement had
    // three people on it. Each of these stands where the chapter already sends
    // you: the foot of the scaffold, under the laundry poles, at the big sign,
    // and beside the open-top bus.
    hkRiggerRec = game.addLocal({ biome: 'kowloon', x: -9.3, y: 0, z: -14, near: 6, face: 1.7,
      figure: { shirt: PALETTE.hkNeonGold, legs: PALETTE.stoneDark, hat: PALETTE.hkConcrete },
      lines: ['No nails. No bolts. Nylon, and it holds a twenty-storey job.',
              'Six weeks to learn the knot. Thirty years to learn the ladder.',
              { t: 'You are welcome to climb it. I am not carrying you down.',
                before: 'bamboo-climb' },
              { t: 'You went up it. Fine. Now come down it the same way.',
                after: 'bamboo-climb' },
              { t: 'Hold E and push into it. That is the whole trick and it took me a month.',
                before: 'bamboo-climb' },
              { t: 'If you are going up for the lights, go now. It is four floors a minute.',
                when: hkSoon },
              { t: 'Every roof on this street has somebody on it tonight. Every one.',
                when: hkDuring }],
      wheek: ['Do that again up there and you will be down here.',
              'The lashings do not like it and neither do I.'],
      onTask: { 'bamboo-climb': ['Forty metres of grass. He went up forty metres of GRASS.'],
                'symphony': ['From my scaffold. He watched it from MY scaffold.'] } });
    // ---- AND ONE OF THEM IS ACTUALLY UP IT --------------------------------
    // The foreman stands on the pavement saying good things about a scaffold
    // that nobody is working on: forty metres of bamboo, the verb the whole
    // chapter exists for, and the only person associated with it was at the
    // bottom. He is on the second working deck at 11.66 — which is the deck
    // the player arrives at first, so the climb has somebody on it — and he
    // is the one local in this game who is reached by going UP rather than
    // along, which is worth a line about it.
    //
    // A local's y is BELIEVED (npc.js does not snap; see the Venice waiter),
    // and that is exactly what makes this possible: 4 * (34.8 / 12) is the
    // deck's own datum, so if the bay count ever changes he moves with it.
    hkScafRec = game.addLocal({ biome: 'kowloon',
      x: hkSCAF.x + hkSCAF.out * 0.5 + 0.5, y: 4 * (hkSCAF.top / 12) + 0.12, z: 6.4,
      near: 8.5, face: 1.5,
      figure: { shirt: PALETTE.hkNeonGold, legs: PALETTE.denim, hat: PALETTE.hkTaxi },
      lines: ['Eh! You are on my deck.',
              'Mind the third pole from the end. It has been a bit sorry since Tuesday.',
              'Everybody looks at the harbour. Look DOWN — that is the good one.',
              'One hand for the job, one hand for yourself. You have four. Show off.',
              // he is a third of the way up the thing the player is climbing, so
              // he is the natural signpost for the two tasks that live above him
              { t: 'Keep going. Roof is another six decks and the view is the reason.',
                before: 'symphony' },
              { t: 'Two minutes to eight and you are standing on a plank talking to me.',
                when: hkSoon },
              { t: 'From here you get half of it. From the roof you get all of it. Go.',
                when: hkDuring },
              { t: 'Poles across the road are at eleven four. You are above them. Mind that.',
                before: 'laundry-pole' },
              { t: 'You went across on the washing poles. Somebody is short a shirt.',
                after: 'laundry-pole' }],
      wheek: ['Not up here. Somebody will look out of a window.',
              'The whole block heard that and none of them are pleased.',
              'Forty metres of bamboo just rang like a xylophone. Well done.'],
      onTask: { 'laundry-pole': ['Wall to wall, over the traffic. I am not watching that again.'],
                'neon-sign': ['That is half a tonne of glass and he is HANGING off it.'],
                'symphony': ['Told you it was the reason. Nobody ever believes me.'] } });
    hkLaundryRec = game.addLocal({ biome: 'kowloon', x: -9.3, y: 0, z: 20.5, near: 6, face: 1.5,
      figure: { shirt: PALETTE.cloth5 },
      lines: ['Forty years I have hung washing over that road.',
              'It dries in an hour up here. Smells of the street, but it dries.',
              { t: 'If a shirt comes down, it belongs to whoever is under it.',
                before: 'laundry-pole' },
              { t: 'A shirt came down. I know exactly whose fault that was.',
                after: 'laundry-pole' },
              { t: 'Do not walk on them. — I say that to everybody and nobody listens.',
                before: 'laundry-pole' },
              { t: 'Bring it in before eight. Everybody stands at the window at eight.',
                when: hkSoon },
              { t: 'Look at that. Forty years and I still come out for it.',
                when: hkDuring }],
      wheek: ['You will have the whole building at the windows.',
              { t: 'Do that up on the poles and somebody will drop a wok on you.',
                when: hkUpHigh }],
      onTask: { 'laundry-pole': ['ACROSS them. Wall to wall. Over the buses.'] } });
    hkNeonRec = game.addLocal({ biome: 'kowloon', x: 9.2, y: 0, z: -3, near: 6, face: -1.5,
      figure: { shirt: PALETTE.hkNeonRed, legs: PALETTE.denim },
      lines: ['That sign has been up since my father ran the shop.',
              'Council says take it down. Council has been saying it for nine years.',
              'Nine thousand tubes on this street. I have bent about six hundred.',
              { t: 'Argon is the blue. Neon is only ever red. Everybody gets that wrong.',
                when: hkBefore },
              { t: 'You want to get ON it? — of course you do. Everybody wants to get on it.',
                before: 'neon-sign' },
              { t: 'It swung for ten minutes after you. I felt it in the shop.',
                after: 'neon-sign' },
              { t: 'Watch the far shore go and then look back at this street. THIS is the light.',
                when: hkDuring }],
      wheek: ['You sound like the transformer on a wet night.',
              'Every tube on the frontage just buzzed. I heard it.'],
      onTask: { 'neon-sign': ['Half a tonne. HALF A TONNE. And it held.',
                              'My father hung that. My father would have loved this.'] } });
    hkBusRec = game.addLocal({ biome: 'kowloon', x: 9.3, y: 0, z: 9.5, near: 6, face: -2.2,
      figure: { shirt: PALETTE.cloth6, hat: PALETTE.hkTaxi },
      lines: ['Top deck is open. Yes, in this weather. That is the point.',
              { t: 'Sit at the front. Duck at the signs.', before: 'bus-top' },
              { t: 'You rode the front of the top deck. Standing. In the signs.',
                after: 'bus-top' },
              'Eight minutes to the pier if the lights are kind. They are not.',
              { t: 'Last one before eight. After that nobody wants to be on a bus.',
                when: hkSoon },
              { t: 'Half my top deck is standing up facing the wrong way. Every night.',
                when: hkDuring }],
      wheek: ['That is roughly the horn, actually. Not bad.',
              'Do that on the top deck and I will put you off at the next stop.'],
      onTask: { 'bus-top': ['On the ROOF of it. There is a deck. There is a whole deck.'],
                'star-ferry': ['Boat, was it. Everybody takes the boat. Nobody takes the bus.'] } });
    // ---- AND THE TWO AT THE DAI PAI DONG ---------------------------------
    // The only two people in the chapter who are not standing up. Everybody
    // else on this street is either walking past or minding a shop; a street
    // where nobody is SITTING is a street nobody lives on.
    hkCookRec = game.addLocal({ biome: 'kowloon', x: hkDPD.x + 2.6, y: 0, z: hkDPD.z - 2.6,
      near: 6, face: -1.5,
      figure: { shirt: PALETTE.hkLaundry, legs: PALETTE.hkGrille },
      lines: ['Wok hei. You cannot get it off a domestic hob. Not enough fire.',
              'Sit anywhere. If somebody is already there, sit there anyway.',
              'Beef and ho fun, and I am not writing it down.',
              'Forty years on this corner. Three years of it with a licence.',
              { t: 'Rush is over at eight. Everybody goes to look at the buildings.',
                when: hkSoon },
              { t: 'Nobody eats during the lights. I turn the gas down and watch it too.',
                when: hkDuring },
              { t: 'Now they all come back at once. Every night. Every single night.',
                when: hkAfter },
              { t: 'The lion goes up the poles later. Do not stand under the lettuce.',
                before: 'choi-cheng' },
              { t: 'You were ON it. When it took the lettuce. On the LION.',
                after: 'choi-cheng' }],
      wheek: ['Not at the burners. It is a flame, it does not want your opinion.',
              'Order or move, please. There is a queue somewhere behind you.'],
      onTask: { 'choi-cheng': ['Forty years on this corner and that is the first rodent.'],
                'egg-tart': ['He has done the bakery. He will do me next.'] } });
    const seat = hkSeatedFigure(PALETTE.cloth3, PALETTE.denim, PALETTE.skin2 || 0xc79063);
    seat.position.set(hkDPD.x - 2.95 + 1.25, 0, hkDPD.z + 1.4);
    seat.rotation.y = -1.6;
    hkRoot.add(seat);
    if (typeof game.registerShadowTarget === 'function') game.registerShadowTarget(seat);
    hkSitRec = game.addLocal({ biome: 'kowloon', group: seat,
      near: 5.5, face: -1.6, cool: 16,
      lines: ['I have been at this table since the six o\u2019clock news.',
              'The stool is too low and I am too old and I come here anyway.',
              { t: 'They put the lights on at eight. From here you see the glow, not the show.',
                when: hkBefore },
              { t: 'Off you go, then. Somebody ought to see it properly.', when: hkSoon },
              { t: 'That orange on the wall opposite. That is all of it I get, and it does.',
                when: hkDuring },
              'Do not tell him the tea has gone cold. He will start again.',
              { t: 'You were on a roof for it, were you. Good. Somebody should be.',
                after: 'symphony' }],
      wheek: ['Sit down. Something will arrive.',
              'That is about how the extractor sounds, to be fair.'],
      praise: ['I saw that from here. I see everything from here.',
               'Forty years at this table and that is new.'] });

    // ---- AND THEY TALK TO EACH OTHER ---------------------------------------
    // Twelve people on one street and every word of it was addressed to the
    // capybara, so unless the player walked up and stood there, Mong Kok was
    // silent \u2014 in the chapter whose whole argument is that this is the loudest
    // hundred metres in the world. Each pair can actually see each other and
    // every scrap is about the thing they are both near.
    //
    // WHO CAN ACTUALLY SEE WHOM. npcEX_MAX is the distance from the PLAYER to
    // the nearer speaker, not the distance between the two \u2014 so nothing stops a
    // chapter pairing two people sixty metres apart, and the result is two
    // bubbles the player can never have both of on screen. Measured off the
    // authored positions: baker to laundry 8.7 m, neon to conductor 12.5 m, the
    // two at the dai pai dong 5 m, and the scaffold's foot to the neon shop 21 m
    // across the road, which is exactly the distance people shout over.
    if (typeof game.addExchange === 'function') {
      if (hkBakerRec && hkLaundryRec) {
        game.addExchange({ biome: 'kowloon', a: hkBakerRec, b: hkLaundryRec, lines: [
          ['Two trays left and it is quarter to.', 'Then stop shouting and sell them.'],
          ['Your washing drips on my window.', 'Your window steams up my washing.'],
          ['Something went past. Low. Brown. Fast.', 'It was on my poles. I watched it from the kitchen.'],
          ['Forty years I have been out here at this time.', 'Forty-one. And I was here first.'],
        ] });
      }
      if (hkNeonRec && hkBusRec) {
        game.addExchange({ biome: 'kowloon', a: hkNeonRec, b: hkBusRec, lines: [
          ['Your top deck clips my sign every night.', 'Then your sign is in my road.'],
          ['Nine years the council has said take it down.', 'Nine years I have ducked under it.'],
          ['Eight o\u2019clock. Watch them all stop walking.', 'Watch them all stop walking in front of my BUS.'],
          ['Argon is the blue, you know.', 'I know. You tell me. Every night.'],
        ] });
      }
      if (hkCookRec && hkSitRec) {
        game.addExchange({ biome: 'kowloon', a: hkSitRec, b: hkCookRec, lines: [
          ['This tea is cold.', 'That tea has been cold since the six o\u2019clock news.'],
          ['Turn the gas down, it is nearly eight.', 'I know what time it is. I have a wok, not a watch.'],
          ['There is a rodent under table four.', 'There is a rodent under every table in Mong Kok.'],
          ['Beef and ho fun.', 'I heard you the first time. In 1994.'],
        ] });
      }
      if (hkRiggerRec && hkNeonRec) {
        game.addExchange({ biome: 'kowloon', a: hkRiggerRec, b: hkNeonRec, lines: [
          ['If that sign comes down it comes down on my scaffold.', 'If your scaffold goes up any further it takes my sign.'],
          ['Nylon. No bolts. Twenty storeys.', 'Glass. No bolts. Half a tonne. We are both mad.'],
          ['Somebody is on your sign.', 'Somebody is on my SIGN?'],
        ] });
      }
    }
  }

  if (typeof game.registerShadowTarget === 'function') game.registerShadowTarget(hkRoot);
}

// ================================================================ THE DRIP ==
/**
 * WHAT THE AIR-CONDITIONERS ARE FOR.
 *
 * Ninety split units on the two elevations of this street, every one of them a
 * dry grey box. The thing everybody who has walked down Fa Yuen Street after
 * dark remembers is not the neon, it is that the WHOLE STREET DRIPS ON YOU —
 * four hundred condensate trays with nowhere to go, and you learn within a
 * minute which two metres of pavement to walk on.
 *
 * Thirty-two of them, chosen at build from the units that are low enough for
 * the drop to read against the shopfront light. Each has its own clock: a drop
 * appears at the tray, falls, and when it lands it leaves a ring on the wet
 * road and — if the player is near — makes the one sound in this chapter that
 * is smaller than a footstep.
 *
 * It is a joke and it is also the best thing this chapter can do with the
 * vertical band between the awnings and the laundry poles, which was empty.
 * Two instanced meshes, sixty-four instances between them, no bodies.
 *
 * THE SOUND IS THROTTLED ACROSS ALL THIRTY-TWO. Thirty-two independent Poisson
 * clocks near a listener is a drum roll; one voice, at most twice a second,
 * from whichever drop actually landed nearest, is a street with water coming
 * off it.
 */
const hkDRIP_N = 32;
const hkDRIP_AT = [];              // x, y, z per emitter — filled in hkBuildStreet
let hkDripMesh = null, hkDripRing = null, hkDripRingMat = null;
// t (negative = waiting), fall speed, ring age
const hkDripData = new Float32Array(hkDRIP_N * 3);
let hkDripVoice = 0;

function hkBuildDrip(root) {
  const n = hkDRIP_AT.length / 3 | 0;
  if (!n) return;
  const M = hkMerger();
  // A DROP IS NOT A SPHERE AT THIS SCALE. Two centimetres across from nine
  // metres away is one pixel, and one pixel of grey is nothing — so it is a
  // short bright streak, which is what a falling drop lit from the side
  // actually looks like and is also the only way it is visible at all.
  M.box(0, 0, 0, 0.035, 0.26, 0.035, PALETTE.hkNeonWhite);
  hkDripMesh = new THREE.InstancedMesh(M.build(),
    new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55 }), n);
  hkDripMesh.frustumCulled = false;
  hkDripMesh.name = 'hkDrip';
  root.add(hkDripMesh);

  // and the ring it leaves on the wet road, flat, unlit, additive-ish
  const R = hkMerger();
  R.cyl(0, 0, 0, 0.5, 0.01, PALETTE.hkNeonWhite, 0, 0, 0, 8);
  hkDripRingMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true,
                                                opacity: 0.0, depthWrite: false });
  hkDripRing = new THREE.InstancedMesh(R.build(), hkDripRingMat, n);
  hkDripRing.frustumCulled = false;
  hkDripRing.renderOrder = 4;
  hkDripRing.name = 'hkDripRing';
  root.add(hkDripRing);

  for (let i = 0; i < n; i++) {
    // stagger them, or the whole street drips in unison on the first frame
    hkDripData[i * 3] = -(0.4 + Math.random() * 5.5);
    hkDripData[i * 3 + 1] = 0;
    hkDripData[i * 3 + 2] = 99;
  }
}

function hkUpdateDrip(game, dt) {
  if (!hkDripMesh) return;
  const n = hkDRIP_AT.length / 3 | 0;
  const cp = game.capy && game.capy.position;
  hkDripVoice -= dt;
  let bestD = 1e9, bestX = 0, bestZ = 0, landed = false;

  for (let i = 0; i < n; i++) {
    const o = i * 3;
    const ex = hkDRIP_AT[o], ey = hkDRIP_AT[o + 1], ez = hkDRIP_AT[o + 2];
    let t = hkDripData[o];
    let ring = hkDripData[o + 2];

    if (t < 0) {
      t += dt;
      if (t >= 0) t = 1e-4;                 // it has just let go
      hkDripMesh.setMatrixAt(i, hkXform(0, -900, 0, 0, 0, 0, 0.0001, 0.0001, 0.0001));
    } else {
      t += dt;
      // free fall from the tray. hkTerrain is the pavement, and the pavement
      // under a façade is flat, so the landing height is one lookup.
      const fall = 0.5 * 9.8 * t * t;
      const y = ey - fall;
      const gy = hkTerrain(ex, ez);
      if (y <= gy + 0.02) {
        // it landed. Next one in a few seconds, and a ring.
        t = -(1.6 + Math.random() * 5.0);
        ring = 0;
        landed = true;
        if (cp) {
          const d = Math.hypot(cp.x - ex, cp.z - ez);
          if (d < bestD) { bestD = d; bestX = ex; bestZ = ez; }
        }
        hkDripMesh.setMatrixAt(i, hkXform(0, -900, 0, 0, 0, 0, 0.0001, 0.0001, 0.0001));
      } else {
        // the streak stretches as it speeds up, which is the whole readability
        const st = clamp(1 + t * 3.4, 1, 3.4);
        hkDripMesh.setMatrixAt(i, hkXform(ex, y, ez, 0, 0, 0, 1, st, 1));
      }
    }
    hkDripData[o] = t;

    // ---- the ring -------------------------------------------------------
    if (ring < 0.9) {
      ring += dt * 1.9;
      const k = clamp(ring, 0, 1);
      const s = 0.18 + k * 0.62;
      hkDripRing.setMatrixAt(i, hkXform(ex, hkTerrain(ex, ez) + 0.012, ez, 0, 0, 0, s, 1, s));
    } else if (ring < 99) {
      ring = 99;
      hkDripRing.setMatrixAt(i, hkXform(0, -900, 0, 0, 0, 0, 0.0001, 0.0001, 0.0001));
    }
    hkDripData[o + 2] = ring;
  }
  hkDripMesh.instanceMatrix.needsUpdate = true;
  hkDripRing.instanceMatrix.needsUpdate = true;
  // the rings fade as one, which is close enough and is one uniform write
  if (hkDripRingMat) hkDripRingMat.opacity = 0.22;

  // ---- ONE VOICE FOR THE WHOLE STREET ------------------------------------
  if (landed && hkDripVoice <= 0 && bestD < 18) {
    hkDripVoice = 0.42;
    hkSfx('drip', { volume: clamp(0.30 - bestD * 0.014, 0.03, 0.30),
                    pitch: 0.85 + Math.random() * 0.5,
                    at: { x: bestX, y: 0.2, z: bestZ } });
    // ---- AND IT LANDS ON YOU, WHICH IS THE JOKE --------------------------
    // Within about half a metre of the animal it is not a sound in the street,
    // it is a thing that has happened to it: the coat goes a shade darker for
    // a moment. capy.wet has existed since Sydney and this is the cheapest
    // possible honest use of it — no damage, no state, no task, just the
    // universal experience of walking under a Hong Kong air-conditioner.
    if (bestD < 0.9 && game.capy) {
      const c = game.capy;
      if (typeof c.wet === 'number') c.wet = Math.max(c.wet, 0.22);
      if (!hkDripToldOnce) {
        hkDripToldOnce = true;
        hkToast('that is an air-conditioner, and there are ninety of them.');
      }
    }
  }
}
let hkDripToldOnce = false;
