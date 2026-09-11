import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PALETTE, mat, matOwn, EMIT_OVER, emitSet, rand, randInt, clamp, damp, lerp, grain, grainOwn, placeCue, swayMesh, makeMerger, warnOnce } from './shared.js';

// ===========================================================================
// CHAPTER 12 — PALAWAN. THE INTERESTING HALF IS UNDERNEATH.
//
// Twelve chapters of water and not one of them let you into it. It has been a
// wall (the harbour), a floor (the tide), a road (the Uji run) and a hazard
// (the glacier's meltwater), and in every single one of them the animal
// paddled across the top of it like a duck.
//
// A capybara is the finest swimmer of any rodent alive. It has webbed feet, its
// eyes and ears and nostrils are all on the top of its head so it can sit
// submerged and watch you, and it holds its breath for five minutes. The one
// thing this game had never let it do was the thing it is FOR.
//
//   HOLD E IN THE WATER AND YOU GO DOWN.
//
// Built exactly the way slip, the wind, the river and the climb were built: the
// biome publishes ONE flag — `canDive` — capybara.js owns the solve, and the
// twelve chapters that never publish it are untouched to the last decimal. The
// breath is the stamina bar, because a bar that already means "how much have
// you got left" means the right thing.
//
// THE SHAPE OF THE CHAPTER IS A LINE, and every step of it is one step deeper:
//
//   z  58..26    THE BEACH. nipa huts, a fire, four bangkas up on the sand.
//   z  28..14    THE JETTY, and the bangka that is actually going somewhere.
//   z  26..-12   THE REEF FLAT, 0 to -6.4 m. coral, a school, a turtle.
//   z -12..-24   THE DROP-OFF, down to -11.5. the wreck, and the giant clam.
//   z -30..-42   THE ISLAND'S FOOT — a crescent of sand under a limestone wall.
//   x   0        THE CRACK. a slot with a rock lintel 1.5 m UNDER the surface,
//                so the only way through it is to go under. That is the door,
//                and the new verb is the key.
//   z -48..-92   THE HIDDEN LAGOON. forty metres of vertical karst, open sky.
//   z -92..-104  THE TUNNEL, and it is longer than the crack.
//   z-103..-133  THE CATHEDRAL. a dome with a hole in it, and one shaft of
//                light coming down the hole onto black water.
//
// THE MARQUEE IS THE BLOOM. On a cycle, the plankton comes into the bay and
// every stroke the animal takes lights up behind it. You have to be UNDER for
// it, which is the chapter's whole argument in one picture. It comes round
// every two minutes: nothing in this game may be missable for ever.
//
// Everything is prefixed `pal` (contract: the bundler flattens every module
// into one scope).
// ===========================================================================

// ---------------------------------------------------------------- geography --
const palSPAWN = { x: 0, y: 2.0, z: 46 };

// THE WATERLINE IS ZERO HERE, not the -0.5 the other twelve use. Every depth in
// this file is therefore also a distance below the surface, which matters more
// than it sounds: the dive, the breath, the lintels, the light and the fog are
// all written against it, and an offset that has to be carried through all five
// is an offset that will be forgotten in one of them.
const palWATER = 0;

let palShoreBed = null;              // M13
const palBEACH_Z = 26;               // where the sand goes under
const palFLAT_Z = -12;               // where the reef flat ends
// SEVEN AND A HALF, NOT SIX AND A HALF. Measured on the coral garden: the
// bommie mound lifts the seabed by two and a half metres in exactly the place
// the game points the player at to teach the dive, and at the old depth that
// left eighty-five centimetres of water there — less than the animal's own
// draught, so the chapter's tutorial happened in a puddle.
const palFLAT_D = -7.4;              // and how deep it is by then
const palDROP_Z = -24;               // the bottom of the drop-off
const palDROP_D = -11.5;
const palSHELF_D = -3.4;             // the rock shelf the island stands on

const palJETTY = { x: 6, z0: 14, z1: 28, y: 1.15, w: 2.4 };

// THE CRACK. The lintel's underside is the entire chapter in one number: a
// capybara floats with its body centre 8 cm over the waterline, so anything at
// or below about -1.2 cannot be swum through on the surface at any speed. At
// -1.55 there is no argument about it and no frame where you scrape under by
// accident — you go down on purpose or you do not go in.
const palCRACK = { x: 0, hw: 3.4, z0: -50, z1: -34, floor: -5.0, lintel: -1.55 };
const palLAG = { x: 0, z: -70, r: 22, deep: -8.0, rim: -3.5, wall: 42 };
const palTUN = { x: 0, hw: 3.6, z0: -104, z1: -91, floor: -5.2, lintel: -1.90 };
const palCATH = { x: 0, z: -118, r: 15.5, deep: -8.5, rim: -3.0, dome: 25 };
const palHOLE = { x: 2.5, z: -115, r: 4.6 };       // the hole in the cathedral roof

const palFOOT = { x: 24, z: -35, r: 13 };          // the island's landing beach
const palREEF = { x: -13, z: 4 };                  // the coral garden
const palWRECK = { x: 21, z: -21 };
const palCLAM = { x: -23, z: -22 };

const palISLE_Z = -30;               // north of this, the island. no open sea.

// ---- the clock -------------------------------------------------------------
const palCYCLE = 124;                // s — the bloom comes and goes on this
const palBLOOM_WARN = 0.400;
const palBLOOM_ON   = 0.470;
const palBLOOM_OFF  = 0.760;

const palFISH_N = 150;               // one instanced mesh, three schools in it
const palMOTE_N = 240;               // the plankton
// 165, NOT 190. Every head got a third more geometry in the presentation pass —
// a table coral has a trunk that flares into its own plate now, a fan is a fan
// rather than two stacked boxes, a brain has a maze on it — and a garden of 165
// of THOSE is a better garden than 190 of the old ones for the same money. The
// difference is spent on the four hundred animals living among them, which is
// what a reef actually is.
const palCORAL_N = 165;

// ---------------------------------------------------------------- scratch ---
const palV3 = new THREE.Vector3();
const palV3b = new THREE.Vector3();
const palQ = new THREE.Quaternion();
const palEu = new THREE.Euler();
const palSc = new THREE.Vector3();
const palM = new THREE.Matrix4();
const palCol = new THREE.Color();
const palPt = { x: 0, y: 0, z: 0 };

// ---------------------------------------------------------------- state -----
let palGame = null;
let palBuilt = false;
let palRoot = null;
let palTime = 0;
let palPhase = 0.10;
let palBloom = 0;                    // 0..1 — how much of the bloom is in the bay
let palBloomT = -1;                  // s into it, -1 when it is not on
let palSeenBloom = false;
let palWarned = false;
let palSub = 0;                      // 0..1 — how far under the camera should feel

let palWaterMesh = null;
let palFishMesh = null, palFishData = null;
let palMoteMesh = null, palMoteData = null, palMoteMat = null;
let palShaftMats = null;
// ...and the pool of light each one lands in — see palBuildShafts
const palShaftPools = [];
let palTurtle = null, palTurtleT = 0;
let palClamGroup = null, palClamOpen = 0, palPearl = null, palPearlTaken = false;
let palBangkaGroup = null, palBangkaBody = null;
let palBangkaT = 0, palBangkaDir = 1, palBangkaRideT = 0, palBangkaFrom = 0;
let palBangkaHold = 0;
let palBangkaOff = 0;
// the PREVIOUS TARGET, so the hull's velocity is differenced against where it
// was asked to be rather than against where the solver has already put it
let palBangkaPX = 0, palBangkaPZ = 0;

let palCarry = { x: 0, z: 0 };
let palCarrying = false;
let palPalmMesh = null;

let palDiveDone = false, palCrackDone = false, palTurtleDone = false;
let palClamDone = false, palCathDone = false, palBloomDone = false;
let palRideDone = false;
// THE PEAK OF THE DIVE THE ANIMAL IS ON, not the deepest of the session: a
// record is filed once, when it surfaces. See palFlushDive.
let palDivePeak = 0;
let palTurtleWith = 0;               // s of the current run alongside
let palBreathIn = 0;                 // s of the current breath inside the cathedral
let palToldDive = false, palToldCrack = false, palToldBreath = false;

// =========================================================== GEOMETRY UTIL ==
function palXform(px, py, pz, rx, ry, rz, sx, sy, sz) {
  palEu.set(rx, ry, rz, 'YXZ');
  palQ.setFromEuler(palEu);
  palV3.set(px, py, pz);
  palSc.set(sx, sy, sz);
  palM.compose(palV3, palQ, palSc);
  return palM;
}

const palG = { box: null, cyl6: null, cyl8: null, cyl4: null, cone6: null, cone4: null,
               sph6: null, sph8: null, quad: null, vee: null, blade: null };
function palInitGeos() {
  if (palG.box) return;
  palG.box = new THREE.BoxGeometry(1, 1, 1);
  // GROUND DETAIL IS A FACET OF THE GROUND. Marrakech's lesson, and it applies
  // to a seabed exactly as it applies to a dune: a worn patch, a sand ripple,
  // a rubble apron and a pool of light are all seen only from above, so eleven
  // twelfths of a box is faces nobody can see.
  palG.quad = new THREE.PlaneGeometry(1, 1);
  palG.quad.rotateX(-Math.PI / 2);
  // ---- AND A BLADE OF SEAGRASS IS A BLADE ------------------------------
  // Five hundred and forty of them across the reef and the lagoon, drawn as
  // boxes: 6,480 triangles on a leaf 5 cm thick, of which four faces are the
  // 5 cm edge. Two quads crossed at right angles is four triangles, it never
  // vanishes edge-on the way one quad would, and it has no chunky thickness to
  // catch the light — which at the dive camera's height, half a metre off the
  // sand, is the difference between a meadow and a rack of green dominoes.
  // Runs 0..1 in y off its own root, so the instance scale is (width, height,
  // width) and nothing has to know where the middle of a blade is.
  {
    const g = new THREE.BufferGeometry();
    const p2 = [], ix = [];
    for (let k = 0; k < 2; k++) {
      const c = k ? 0 : 0.5, d2 = k ? 0.5 : 0;
      const b2 = p2.length / 3;
      p2.push(-c, 0, -d2, c, 0, d2, -c * 0.55, 1, -d2 * 0.55, c * 0.55, 1, d2 * 0.55);
      ix.push(b2, b2 + 1, b2 + 2, b2 + 1, b2 + 3, b2 + 2);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(p2, 3));
    g.setIndex(ix);
    g.computeVertexNormals();
    palG.blade = g;
  }
  // ---- A FROND IS A FLAT THING, AND IT IS FOLDED ------------------------
  // Ninety palms with seven fronds each is 483 boxes and 5,796 triangles — the
  // sixth largest object in the chapter — spent on twelve faces of which two
  // are ever seen. And a box has no CENTRE FOLD, which is the whole shape of a
  // palm leaf: it hangs in a shallow V off its own midrib, and that V is why it
  // does not disappear when you look at it edge-on, which is what a single flat
  // quad would do. Two quads in a shallow V is four triangles against twelve,
  // it is the correct section, and it tapers to a point at the tip because a
  // frond does. Local frame: x is the width, z runs 0 (base) to 1 (tip).
  {
    const g = new THREE.BufferGeometry();
    const p2 = [], n2 = [], ix = [];
    // TWO SPANS, AND THE MIDDLE ONE IS THE WHOLE POINT. At one span the leaf is
    // a straight spike: no arch, no shoulder, and ninety palms of them read as a
    // firework rather than as a tree. A frond springs UP out of the crown,
    // carries its width through the middle third and falls away — that curve is
    // the silhouette of every coconut palm anybody has ever seen, and it needs
    // exactly one extra ring to have it. Eight triangles against the box's
    // twelve, and it is a leaf rather than a plank.
    const SEG = 2;
    for (let s2 = -1; s2 <= 1; s2 += 2) {
      const base = p2.length / 3;
      for (let k = 0; k <= SEG; k++) {
        const t = k / SEG;
        // widest at a third, and it goes to a point
        const w = 0.5 * (0.42 + 0.58 * Math.sin(Math.PI * Math.pow(t, 0.62))) * (1 - t * t * t);
        const dr = 0.20 * t - 0.62 * t * t;          // up, over, and down
        p2.push(0, dr, t, s2 * w, dr - w * 0.5, t);
        n2.push(0, 1, 0, 0, 1, 0);
      }
      for (let k = 0; k < SEG; k++) {
        const a2 = base + k * 2;
        if (s2 < 0) ix.push(a2, a2 + 1, a2 + 2, a2 + 1, a2 + 3, a2 + 2);
        else ix.push(a2, a2 + 2, a2 + 1, a2 + 1, a2 + 2, a2 + 3);
      }
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(p2, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(n2, 3));
    g.setIndex(ix);
    g.computeVertexNormals();
    palG.vee = g;
  }
  palG.cyl6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
  palG.cyl8 = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
  palG.cyl4 = new THREE.CylinderGeometry(0.5, 0.5, 1, 4);
  palG.cone6 = new THREE.ConeGeometry(0.5, 1, 6);
  palG.cone4 = new THREE.ConeGeometry(0.5, 1, 4);
  palG.sph6 = new THREE.SphereGeometry(0.5, 6, 4);
  palG.sph8 = new THREE.SphereGeometry(0.5, 8, 6);
}

/** CONTRACT: box() takes FULL extents, CANNON.Box takes HALF, and palStaticBox
 *  below speaks THIS one so the two cannot end up a factor of two apart. */
function palMerger() {
  const M = makeMerger(palG, {
    xform: palXform, cylSegs: [4, 8], coneSegs: [4], sphSegs: [8], normals: 'recompute', jitter: 0.042,
  });
  /** A flat horizontal facet. Two triangles, not twelve. See palG.quad. */
  M.quad = function (cx, cy, cz, sx, sz, color, ry) {
    return M.add(palG.quad, palXform(cx, cy, cz, 0, ry || 0, 0, sx, 1, sz), color);
  };
  /** One blade, standing on (cx, cy, cz). See palG.blade. */
  M.blade = function (cx, cy, cz, w, h, color, ry, tilt) {
    return M.add(palG.blade, palXform(cx, cy, cz, tilt || 0, ry || 0, 0, w, h, w), color);
  };
  /**
   * A CONE WITH THE TOP CUT OFF. Not in the geometry set, so it is a lathe of
   * exactly two rings: eight triangles for a six-sided one, and it is the only
   * primitive that can say "wider at the bottom than the top" — which is what
   * a limestone tower, a coral bommie and a barrel sponge all are.
   */
  M.taper = function (cx, cy, cz, rb, rt, h, color, ry, seg) {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg || 6);
    const r = M.add(g, palXform(cx, cy, cz, 0, ry || 0, 0, 1, 1, 1), color);
    g.dispose();
    return r;
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
function palVC() {
  return grain(mat(0xffffff, { vertexColors: true }),
               { scale: 0.45, amount: 0.085, warp: 0.55, near: 0.28, nearScale: 9, contact: 1,
                 // The karst feet and the boat hulls. A wall gets the line and
                 // nothing else: no soak worth seeing on wet limestone, and no
                 // depth tint, because there is no sand down there to tint.
                 shore: 0.26, shoreBand: 0.24, shoreWet: 0.22, shoreDark: 0.88,
                 shoreScale: 1.9, shoreColor: PALETTE.foam });
}
/** The same thing at ground strength, and flat: the ground is horizontal,
 *  so it wants no vertical shear in the sample at all. */
function palVCG() {
  return grain(mat(0xffffff, { vertexColors: true }),
               { scale: 0.55, amount: 0.15, warp: 0, near: 0.62, nearScale: 9, contact: 1, broad: 0.24, broadM: 26,
                 // THE WATER'S EDGE (D5), and Palawan is the chapter with the
                 // most of it: the beach shelves at about one in twelve, so a
                 // 0.42 m band is five metres of sand wide and the lace has
                 // room to be a lace rather than a line. `grep -c foam` read
                 // ZERO here before this — a white beach met a transparent sea
                 // at a straight polygon join in the chapter whose postcard is
                 // that exact meeting.
                 //
                 // AND IT IS THE ONE CHAPTER THAT GETS THE DEPTH TINT, because
                 // it is the one chapter whose sea you can see through (0.45).
                 // Saturating at five metres rather than the default: past that
                 // the seabed already has the caustic's own depth death and the
                 // chapter's underwater fog on it, and a third term stacked on
                 // those two makes the reef black instead of deep.
                 shore: 0.40, shoreBand: 0.42, shoreWet: 0.55, shoreDark: 0.78,
                 shoreScale: 1.35, shoreColor: PALETTE.foam,
                 shoreTint: 0.34, shoreDeep: 5.0, shoreTintColor: PALETTE.palShallow });
}

/**
 * ANYTHING DOWN HERE THAT GIVES OFF LIGHT IS BUILT WITH THIS.
 *
 * A Lambert box eleven metres under the sea is lit by the ambient and by
 * nothing else, so a plankton bloom made of plain material renders as a cloud
 * of small grey pebbles. The emissive term is what a light source IS; it lives
 * on MeshLambertMaterial, so this stays inside the aesthetic law. Not cached —
 * the bloom's intensity is written every frame.
 */
function palGlowMat(color, intensity, opacity) {
  const o = { emissive: color, emissiveIntensity: (intensity || 1) * EMIT_OVER };
  if (opacity !== undefined) { o.transparent = true; o.opacity = opacity; o.depthWrite = false; }
  return mat(color, o).clone();
}
/**
 * THE TRAVERSE THAT UNDOES EVERY `castShadow = false` IN THIS FILE.
 *
 * `registerShadowTarget` is the last line of the build and systems.js answers it
 * with `o3d.traverse(n => { if (n.isMesh) n.castShadow = true })` — so every
 * `castShadow = false` written above is silently reverted at the bottom of
 * palBuild. Measured: 116,663 of this chapter's 117,867 triangles were in the
 * shadow pass, and the worst offender is the one that matters most.
 *
 * THE WATER SHEET WAS SHADOWING THE ENTIRE REEF. Thirteen thousand triangles of
 * transparent, double-sided plane lying over the whole bay at y = 0 — and as far
 * as a shadow map is concerned a transparent material is an opaque one, so
 * everything under it, which is the half of this chapter the whole chapter is
 * ABOUT, sat in one flat unbroken shadow. The caustic net was being drawn on a
 * seabed that was already dark, which is exactly why it read as nothing at all
 * in every frame ever taken from the reef.
 *
 * Two rules, the same two Marrakech and the Drift use. Anything see-through is a
 * GHOST and casts nothing — a god ray that throws a shadow is a solid cone of
 * glass. And anything flagged `userData.noShadow` is either light itself or too
 * small and too far to resolve: seven hundred sardines at eleven centimetres.
 */
function palNoShadowOnGhosts(root) {
  root.traverse(function (n) {
    if (!n.isMesh && !n.isInstancedMesh) return;
    if (n.userData && n.userData.noShadow) { n.castShadow = false; return; }
    const m = Array.isArray(n.material) ? n.material[0] : n.material;
    if (!m) return;
    if (m.transparent || m.depthWrite === false || m.blending === THREE.AdditiveBlending) {
      n.castShadow = false;
    }
  });
}
function palSyncBody(b) {
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
  b.previousQuaternion.copy(b.quaternion);
  b.interpolatedQuaternion.copy(b.quaternion);
}
/**
 * ONE COMPOUND BODY PER CLUSTER — the Sydney/Quay pattern, and the reason it
 * is here is the solidity audit: 662 walk-through hits on the beach mesh, the
 * biggest residue of any chapter in the game. Four nipa huts and three beached
 * bangkas were the whole of it — a hut is five metres across and a bangka is
 * nine metres long, and strolling through either is not a concession to
 * vegetation, it is a hole in the world. But seven separate bodies for
 * scenery is seven broadphase entries, so they share one.
 */
function palPoolBody() {
  const b = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC });
  b.allowSleep = true;
  return b;
}
function palPoolBox(b, x, y, z, hx, hy, hz, ry) {
  const q = new CANNON.Quaternion();
  if (ry) q.setFromEuler(0, ry, 0);
  b.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)), new CANNON.Vec3(x, y, z), q);
  return b;
}
function palPoolDone(game, b) {
  if (!b.shapes.length) return b;
  b.material = (game.mats && game.mats.ground) || undefined;
  palSyncBody(b);
  game.world.addBody(b);
  return b;
}
function palStaticBox(game, x, y, z, sx, sy, sz, ry) {
  const b = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
  b.addShape(new CANNON.Box(new CANNON.Vec3(sx * 0.5, sy * 0.5, sz * 0.5)));
  b.position.set(x, y, z);
  if (ry) b.quaternion.setFromEuler(0, ry, 0);
  palSyncBody(b);
  game.world.addBody(b);
  return b;
}
function palSmooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

/**
 * HOW LOUD A THING AT (x, z) IS FROM WHERE THE PLAYER IS. 0..1, squared ramp.
 *
 * Three hundred metres of bay and not one sound in it had a distance law: a
 * turtle surfacing at the far end of the reef gasped at exactly the volume she
 * would have gasped at under your chin. Everything that makes a noise in this
 * chapter and is not the animal itself goes through here — the diver, the
 * terns, the ray, and the turtle — because a sound with no falloff is not
 * atmosphere, it is a thing in the room with you.
 *
 * Returns 0 when there is nobody to hear it, which is also what stops the sound
 * being MADE: this is a gate as much as it is a gain.
 */
function palHeard(x, z, near, far) {
  const capy = palGame && palGame.capy;
  const p = capy && capy.position;
  if (!p) return 0;
  const d = Math.hypot(p.x - x, p.z - z);
  if (d >= far) return 0;
  const k = 1 - clamp((d - near) / (far - near), 0, 1);
  return k * k;
}

/**
 * THE SEABED GRID'S SQUEEZE. `v` is a coordinate about the centre of an axis,
 * `half` is that axis's half-extent; the return is the same coordinate pulled
 * toward the middle. k < 1 is what makes it MONOTONE — at k >= 1 the mapping
 * folds and the grid crosses itself — and s = +/-1 maps to itself, so the mesh
 * still ends exactly where the world does.
 */
const palWARP_K = 0.50;
function palWarp(v, half) {
  const s = clamp(v / half, -1, 1);
  return half * s * (palWARP_K + (1 - palWARP_K) * s * s);
}

// ================================================================= TERRAIN ==
/**
 * THE SEABED, AND NOTHING ELSE.
 *
 * The limestone is NOT in here, and that is the single most important decision
 * in this file. A karst tower is a vertical wall — that is what makes it a
 * karst tower — and a heightfield cannot hold one: at any sane cell size a
 * forty-metre wall becomes a forty-metre RAMP, and capybara.js's analytic
 * ground backstop will happily levitate the animal up it at three metres a
 * second. Every cliff here is therefore a static box with rock drawn over it,
 * exactly the way Hong Kong's tong lau are, and this function answers only for
 * the surface you can actually stand or land on.
 *
 * Which means it is also the DIVE floor: capybara.js levels the animal out
 * capyDIVE_FLOOR above whatever this returns, so every number below is a thing
 * the player will be swimming half a metre over, looking at.
 */
function palTerrain(x, z) {
  let h;
  if (z > palBEACH_Z) {
    // the mainland beach — up out of the water, and it keeps going
    const t = palSmooth((z - palBEACH_Z) / 30);
    h = 3.2 * t + Math.sin(x * 0.06) * 0.5 * t + Math.sin(x * 0.21 + z * 0.11) * 0.16;
  } else if (z > palFLAT_Z) {
    // the reef flat: shallow, and it takes its time about getting deep
    const t = palSmooth((palBEACH_Z - z) / (palBEACH_Z - palFLAT_Z));
    h = lerp(0, palFLAT_D, t);
    // bommies — heads of coral standing proud of the flat. Real relief, so the
    // dive has something to go over and around rather than a swimming pool.
    h += Math.sin(x * 0.17 + 1.3) * Math.sin(z * 0.14) * 0.9;
    const dbx = x - palREEF.x, dbz = z - palREEF.z;
    const bd = Math.sqrt(dbx * dbx + dbz * dbz);
    if (bd < 13) h += (1 - palSmooth(bd / 13)) * 1.9;
  } else if (z > palDROP_Z) {
    const t = palSmooth((palFLAT_Z - z) / (palFLAT_Z - palDROP_Z));
    h = lerp(palFLAT_D, palDROP_D, t);
  } else {
    h = palDROP_D;
  }
  // ---- the island's shelf -------------------------------------------------
  // Everything north of the drop-off climbs back to a shelf, because an island
  // stands on something. The cliffs are boxes on top of this and the player
  // never sees most of it — but the bangka lands on it and the crack is cut
  // into it, so it has to be a real height rather than a guess.
  if (z < palISLE_Z + 8) {
    const t = palSmooth((palISLE_Z + 8 - z) / 10);
    h = lerp(h, palSHELF_D, t);
  }
  // ---- the landing beach at the island's foot ------------------------------
  {
    const dx = x - palFOOT.x, dz = z - palFOOT.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < palFOOT.r) {
      const t = 1 - palSmooth(d / palFOOT.r);
      h = Math.max(h, lerp(palSHELF_D, 2.1, t));
    }
  }
  // ---- the crack ----------------------------------------------------------
  // A trench cut through the shelf, with the lintel bridged over it in
  // palBuildIsland. Widened at the mouth so a player who aims roughly at it
  // arrives in it, and pinched in the middle so it reads as a crack.
  if (z > palCRACK.z0 - 3 && z < palCRACK.z1 + 3) {
    const pinch = 1 - 0.35 * palSmooth(1 - Math.abs((z - (palCRACK.z0 + palCRACK.z1) * 0.5) /
                                                    ((palCRACK.z1 - palCRACK.z0) * 0.5)));
    const hw = palCRACK.hw * pinch + 2.4;
    const t = 1 - palSmooth((Math.abs(x - palCRACK.x) - hw * 0.45) / (hw * 0.75));
    if (t > 0) h = lerp(h, palCRACK.floor, t);
  }
  // ---- the lagoon ---------------------------------------------------------
  {
    const dx = x - palLAG.x, dz = z - palLAG.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < palLAG.r + 5) {
      const t = 1 - palSmooth((d - palLAG.r * 0.35) / (palLAG.r * 0.8));
      const bowl = lerp(palLAG.rim, palLAG.deep, palSmooth(1 - d / palLAG.r));
      h = lerp(h, bowl, t);
    }
  }
  // ---- the tunnel ---------------------------------------------------------
  if (z > palTUN.z0 - 3 && z < palTUN.z1 + 3) {
    const t = 1 - palSmooth((Math.abs(x - palTUN.x) - palTUN.hw * 0.5) / (palTUN.hw * 0.9));
    if (t > 0) h = lerp(h, palTUN.floor, t);
  }
  // ---- the cathedral ------------------------------------------------------
  {
    const dx = x - palCATH.x, dz = z - palCATH.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < palCATH.r + 4) {
      const t = 1 - palSmooth((d - palCATH.r * 0.4) / (palCATH.r * 0.75));
      const bowl = lerp(palCATH.rim, palCATH.deep, palSmooth(1 - d / palCATH.r));
      h = lerp(h, bowl, t);
    }
  }
  return h;
}
function palSlope(x, z) {
  const e = 1.2;
  const dx = palTerrain(x + e, z) - palTerrain(x - e, z);
  const dz = palTerrain(x, z + e) - palTerrain(x, z - e);
  // RISE OVER RUN, not radians. See slopeAt in CONTRACT.md: this used to
  // return an angle, and twelve of the seventeen publishers return a gradient.
  return Math.sqrt(dx * dx + dz * dz) / (2 * e);
}
function palIsOverWater(x, z) { return palTerrain(x, z) < palWATER - 0.05; }
function palWaterHeightAt() { return palWATER; }

// ==================================================================== ZONES =
function palInZone(name, x, z) {
  if (name === 'beach') return z > palBEACH_Z - 2 && z < 62 && Math.abs(x) < 46;
  if (name === 'jetty') {
    return Math.abs(x - palJETTY.x) < palJETTY.w && z > palJETTY.z0 - 1.5 && z < palJETTY.z1 + 1;
  }
  if (name === 'reef') {
    const dx = x - palREEF.x, dz = z - palREEF.z;
    return dx * dx + dz * dz < 16 * 16;
  }
  if (name === 'wreck') {
    const dx = x - palWRECK.x, dz = z - palWRECK.z;
    return dx * dx + dz * dz < 9 * 9;
  }
  if (name === 'clam') {
    const dx = x - palCLAM.x, dz = z - palCLAM.z;
    return dx * dx + dz * dz < 4.6 * 4.6;
  }
  if (name === 'foot') {
    const dx = x - palFOOT.x, dz = z - palFOOT.z;
    return dx * dx + dz * dz < palFOOT.r * palFOOT.r;
  }
  if (name === 'crack') {
    return Math.abs(x - palCRACK.x) < palCRACK.hw + 2 && z > palCRACK.z0 - 1 && z < palCRACK.z1 + 1;
  }
  if (name === 'lagoon') {
    const dx = x - palLAG.x, dz = z - palLAG.z;
    return dx * dx + dz * dz < palLAG.r * palLAG.r;
  }
  if (name === 'cathedral') {
    const dx = x - palCATH.x, dz = z - palCATH.z;
    return dx * dx + dz * dz < palCATH.r * palCATH.r;
  }
  if (name === 'shaft') {
    const dx = x - palHOLE.x, dz = z - palHOLE.z;
    return dx * dx + dz * dz < (palHOLE.r + 2) * (palHOLE.r + 2);
  }
  return false;
}
function palNavBlocked(x, z, r) {
  const rr = r || 0.6;
  // Nobody walks on this island, so the only honest answer is "the sea and the
  // rock", and the sea is most of it.
  return z < palISLE_Z - rr && !palInZone('foot', x, z);
}
/**
 * WHICH WAY TO LOOK AT THE BLOOM FROM.
 *
 * Broadside to the animal’s own heading, on whichever side has more water in
 * it — the bloom is a VOLUME and the shot wants as much of it between the lens
 * and the animal as the reef allows. `yaw` is the bearing FROM the animal TO
 * the camera, so this is heading +/- a quarter turn.
 */
function palBloomYaw() {
  const g = palGame;
  const c = g && g.capy;
  const h = c && c.group ? c.group.rotation.y : 0;
  const p = c && c.position;
  if (!p) return h + Math.PI * 0.5;
  const L = h + Math.PI * 0.5, R = h - Math.PI * 0.5;
  // 8 m out on each side: whichever is over deeper water wins
  const dl = 0 - palTerrain(p.x + Math.sin(L) * 8, p.z + Math.cos(L) * 8);
  const dr = 0 - palTerrain(p.x + Math.sin(R) * 8, p.z + Math.cos(R) * 8);
  return dl >= dr ? L : R;
}

function palSurfacePitch(x, z, y) {
  // ---- AND THE BOAT IS BAMBOO WHEREVER IT HAPPENS TO BE ------------------
  // The bamboo row was gated on `inZone('jetty')`, so it covered the jetty and
  // nothing else — and the bangka, whose deck is the same bamboo and whose ride
  // is the chapter's FIRST TASK, spends the whole of that ride out over water
  // and answered 0.86, wet sand. The one place the chapter is sure you will
  // stand, on the one surface it is proudest of.
  if (palCarrying) return 1.32;
  if (palInZone('jetty', x, z) && y > 0.6) return 1.32;    // bamboo deck, and it rings
  if (z < palISLE_Z) return 1.06;                          // wet limestone
  if (z > palBEACH_Z) return 0.80;                         // dry sand, and it says nothing
  return 0.86;                                             // wet sand
}

// ============================================================== THE ISLAND ==
/**
 * A KARST TOWER IS A WALL, AND A WALL IS A BOX.
 *
 * The whole massif is a ring of static boxes with limestone drawn over them:
 * one ring around the lagoon, a wall across the front of the island with the
 * crack cut through it, a lintel over the crack, and the same again for the
 * tunnel and the cathedral's dome. Forty-one bodies for an island, which is
 * about what Hong Kong spends on two rows of shophouses.
 *
 * The drawn rock is deliberately NOT the collider: the boxes are plain and the
 * geometry over them is a jumble of tapered blocks with jagged tops and heavy
 * undercuts, because an undercut is the one thing that says limestone and it
 * is also the one thing a box cannot say. The player can never get behind the
 * drawn face, so the two never have to agree closely.
 */
function palBuildIsland(game, root) {
  const M = palMerger();
  let seed = 4242;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }

  /**
   * ONE TOWER OF LIMESTONE.
   *
   * FORTY-THREE OF THEM AND THEY RENDERED AS A TIP OF GREY CUBES. Measured off
   * the frame from the end of the jetty, which is where the player stands for
   * the first minute of the chapter: a stack of flat-faced boxes in two greys,
   * every face a rectangle, every corner square, the skyline a row of parapets.
   * It is a bombsite, not a karst tower, and it is the backdrop of every single
   * shot taken above water in this chapter.
   *
   * What actually makes limestone in that sea read as limestone is four things,
   * and only one of them is the block shape:
   *
   *   IT LEANS OUT AS IT GOES UP. Rain dissolves the foot and the sea dissolves
   *   the waterline, so a tower is narrowest where you would expect it to be
   *   widest — the OVERHANG is the silhouette. Tapers now, each one a little
   *   wider at the top than at the bottom, which no other rock in this game is.
   *
   *   IT IS FLUTED. Water runs down a face in the same channels for ten
   *   thousand years and cuts it into organ pipes. Four ribs a block, half in
   *   the shadow tone, and they cost eight triangles each.
   *
   *   IT IS STREAKED. Tropical limestone is white where the rain washes it and
   *   nearly black where it does not, in vertical bands from the top down —
   *   which is the single most recognisable thing about those islands and the
   *   chapter had it nowhere at all.
   *
   *   AND THINGS GROW OUT OF IT SIDEWAYS. Not a hedge on top: a fig rooted in a
   *   crack halfway up with nothing under it, which is the detail that tells you
   *   the wall is vertical.
   */
  function tower(cx, cz, w, d, h, ry, far) {
    // TWO OR THREE BLOCKS, NOT THREE TO FIVE. Every joint between blocks is a
    // hard horizontal line across the face, and at the sixty to a hundred metres
    // these are actually seen from, five of them stacked read as courses of
    // masonry — which is precisely the thing that made this island look like a
    // bombsite. Fewer joints, taller blocks, and the overhang at each one does
    // more work.
    const n = 2 + (rnd() * 2 | 0);
    let y = palSHELF_D;
    let ww = w, dd = d;
    for (let i = 0; i < n; i++) {
      const seg = (h - palSHELF_D) / n * (0.8 + rnd() * 0.45);
      // three tones, not two: sunlit, weathered and wet, which is what a
      // limestone face in that light actually has on it
      const ck = rnd();
      const c = ck < 0.34 ? PALETTE.palKarstDk : (ck < 0.76 ? PALETTE.palKarst : PALETTE.palKarstShadow);
      const bx = cx + (rnd() - 0.5) * w * 0.22, bz = cz + (rnd() - 0.5) * d * 0.22;
      const bry = ry + (rnd() - 0.5) * 0.3;
      // THE OVERHANG. A karst tower is wider at the head of every block than at
      // its foot, because that is where the rain has not got to yet.
      const rb = Math.min(ww, dd) * 0.5;
      const rt = rb * (1.04 + rnd() * 0.20);
      M.taper(bx, y + seg * 0.5, bz, rb, rt, seg, c, bry, 6);
      // ...and the fluting, three ribs standing in the face, half of them dark.
      // NOT ON THE SKYLINE TOWERS. The seven at z = -140 to -170 exist to close
      // the horizon and are never nearer than a hundred and ten metres: fluting,
      // streaks, lips and figs on those is six hundred triangles apiece spent on
      // something two pixels of which will ever be resolved. `far` is the whole
      // of that decision and it is measured, not guessed.
      if (far) { y += seg; ww *= 0.86; dd *= 0.86; continue; }
      // THREE, NOT FOUR: at a hundred and twenty triangles a block, forty-three
      // towers of four ribs each is seven thousand triangles of detail on rock
      // the player is never closer than twenty metres to.
      const fn = 3;
      for (let f = 0; f < fn; f++) {
        const a = bry + (f / fn) * Math.PI * 2 + rnd() * 0.4;
        const fr = lerp(rb, rt, 0.5) * (0.92 + rnd() * 0.13);
        M.cyl(bx + Math.sin(a) * fr, y + seg * 0.5, bz + Math.cos(a) * fr,
              rb * (0.10 + rnd() * 0.08), seg * (0.7 + rnd() * 0.3),
              rnd() < 0.5 ? PALETTE.palKarstShadow : PALETTE.palKarst, 0, a, 0, 4);
      }
      // and the lip under it, which is what a receding face leaves behind. A
      // SEVEN-SIDED RING PER BLOCK is twenty-eight triangles for a shadow line;
      // one flat facet under the joint says the same thing for two.
      if (i > 0) M.quad(bx, y + 0.10, bz, rb * 2.5, rb * 2.5, PALETTE.palKarstShadow, bry);
      y += seg;
      ww *= 0.82 + rnd() * 0.13; dd *= 0.82 + rnd() * 0.13;
    }
    // ---- THE STREAKS -------------------------------------------------------
    // Vertical bands of black from the head of the tower down, which is rain and
    // algae doing what they do to every limestone island in that sea. Five thin
    // slabs on the outside of the stack, tapering as they fall, and they are the
    // one detail that separates this rock from chalk.
    if (!far) {
      const rTop = Math.min(w, d) * 0.5 * 0.62;
      for (let k = 0; k < 5; k++) {
        const a = ry + rnd() * Math.PI * 2;
        const run = (y - palSHELF_D) * (0.35 + rnd() * 0.5);
        M.box(cx + Math.sin(a) * rTop, y - run * 0.5, cz + Math.cos(a) * rTop,
              0.5 + rnd() * 0.9, run, 0.32,
              rnd() < 0.5 ? PALETTE.palKarstShadow : PALETTE.palKarstDk, 0, a);
      }
    }
    // THE UNDERCUT. Every limestone island in that sea is notched at the
    // waterline, because that is where it dissolves fastest — and it is the
    // only detail that makes a white block read as karst instead of as chalk.
    // TAPERED THE OTHER WAY, so the notch reads from a boat as well as from
    // under the water: narrow at the bottom, wide at the top, which is a
    // mushroom foot and is what one of those islands actually stands on.
    M.taper(cx, -1.1, cz, Math.min(w, d) * 0.30, Math.min(w, d) * 0.44, 2.6,
            PALETTE.palKarstShadow, ry, 6);
    // and the wave-cut visor above it, which throws the shadow that makes the
    // notch legible at all
    M.taper(cx, 0.55, cz, Math.min(w, d) * 0.44, Math.min(w, d) * 0.40, 0.9,
            PALETTE.palKarstDk, ry, 6);
    // ---- what grows out of it ----------------------------------------------
    // scrub on top, growing out of nothing at all, which is what it does
    const bushes = 2 + (rnd() * 3 | 0);
    for (let b = 0; b < bushes; b++) {
      const bx = cx + (rnd() - 0.5) * w * 0.7, bz = cz + (rnd() - 0.5) * d * 0.7;
      M.sph(bx, y + 0.4, bz, 1.5 + rnd(), 1.0 + rnd() * 0.6, 1.5 + rnd(),
            rnd() < 0.5 ? PALETTE.palJungle : PALETTE.palJungleDk);
    }
    // ...and three figs rooted in cracks HALFWAY UP, with nothing under them.
    // A hedge on the top of a rock says nothing; a tree growing sideways out of
    // a wall forty metres over the sea says the wall is vertical, which is the
    // one fact about this island the chapter needs the player to believe.
    for (let b = 0; b < (far ? 0 : 2); b++) {
      const a = ry + rnd() * Math.PI * 2;
      const fy = palSHELF_D + (y - palSHELF_D) * (0.28 + rnd() * 0.55);
      const fr = Math.min(w, d) * 0.5 * (0.72 + rnd() * 0.2);
      const fx = cx + Math.sin(a) * fr, fz = cz + Math.cos(a) * fr;
      M.sph(fx, fy, fz, 1.0 + rnd() * 0.9, 0.7 + rnd() * 0.5, 1.0 + rnd() * 0.9,
            rnd() < 0.5 ? PALETTE.palJungle : PALETTE.palPalm);
      // the vine off it, straight down, because that is the only way they go
      const vl = 2.5 + rnd() * 7;
      M.cyl(fx, fy - 0.4 - vl * 0.5, fz, 0.055, vl, PALETTE.palJungleDk, 0, 0, 0, 4);
    }
    return y;
  }

  // ---- the wall across the front of the island, with the crack in it -------
  // Two halves and a gap, and the gap is the door.
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 5; i++) {
      // + 9, NOT + 5. At +5 the first box of each side reached to |x| = 1.9,
      // which is INSIDE a channel that is 3.4 wide — the door to the whole back
      // half of the chapter was walled up by the wall that is supposed to have
      // a door in it, and nothing about the drawn rock would have shown it.
      const x = side * (palCRACK.hw + 9 + i * 13 + rnd() * 3);
      const z = palISLE_Z - 5 - rnd() * 6;
      tower(x, z, 13 + rnd() * 7, 15 + rnd() * 8, 20 + rnd() * 16, rnd() * 0.6);
      palStaticBox(game, x, 18, z, 13, 46, 15);
    }
  }
  // and the flanks, so the island has sides rather than a façade
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 4; i++) {
      const x = side * (46 + rnd() * 10);
      const z = palISLE_Z - 18 - i * 22 - rnd() * 8;
      tower(x, z, 16 + rnd() * 8, 20 + rnd() * 10, 24 + rnd() * 20, rnd() * 0.7);
      palStaticBox(game, x, 20, z, 16, 50, 20);
    }
  }

  // ---- the ring around the lagoon -----------------------------------------
  // Vertical, forty metres, and the sky is the only thing above it. The ring is
  // opened at the two bearings the crack and the tunnel arrive on, or the
  // chapter's two doors would be walled up from the inside.
  const RN = 20;
  for (let i = 0; i < RN; i++) {
    const a = (i / RN) * Math.PI * 2;
    const sx = Math.sin(a), sz = Math.cos(a);
    // south = the crack, north = the tunnel
    if (sz > 0.86 || sz < -0.88) continue;
    const rr = palLAG.r + 6.5;
    const x = palLAG.x + sx * rr, z = palLAG.z + sz * rr;
    tower(x, z, 12, 12, palLAG.wall * (0.72 + rnd() * 0.5), -a);
    palStaticBox(game, x, 22, z, 12, 50, 12, -a);
  }

  // ---- THE LINTEL over the crack ------------------------------------------
  // The one piece of geometry the whole chapter turns on. Its underside is at
  // palCRACK.lintel and the box that enforces it is the same number, because a
  // drawn roof you can swim through is worse than no roof at all.
  {
    const zc = (palCRACK.z0 + palCRACK.z1) * 0.5, zl = palCRACK.z1 - palCRACK.z0;
    const top = 16;
    M.box(palCRACK.x, (palCRACK.lintel + top) * 0.5, zc, palCRACK.hw * 2 + 9,
          top - palCRACK.lintel, zl, PALETTE.palKarstDk);
    // the drip line, and the shadow it throws on the water
    M.box(palCRACK.x, palCRACK.lintel + 0.35, palCRACK.z1 - 0.3, palCRACK.hw * 2 + 9.4, 0.8, 1.2,
          PALETTE.palKarstShadow);
    M.box(palCRACK.x, palCRACK.lintel + 0.35, palCRACK.z0 + 0.3, palCRACK.hw * 2 + 9.4, 0.8, 1.2,
          PALETTE.palKarstShadow);
    palStaticBox(game, palCRACK.x, (palCRACK.lintel + top) * 0.5, zc,
                 palCRACK.hw * 2 + 9, top - palCRACK.lintel, zl);
    // the cheeks of the slot, so it is a slot and not a doorway
    for (let side = -1; side <= 1; side += 2) {
      palStaticBox(game, palCRACK.x + side * (palCRACK.hw + 5), 6, zc, 10, 40, zl);
      M.box(palCRACK.x + side * (palCRACK.hw + 5), 4, zc, 10, 34, zl,
            side < 0 ? PALETTE.palKarst : PALETTE.palKarstDk);
    }
  }

  // ---- THE TUNNEL, and it is longer -----------------------------------------
  {
    // FOUR METRES LONGER THAN THE CHANNEL. The cathedral's roof panels reach
    // to about z -103.5 and the tunnel's floor runs to -104: a lintel exactly as
    // long as its channel leaves half a metre of open sky over the join, and
    // open sky in the middle of a cave is the one thing that would give it away.
    const zc = (palTUN.z0 + palTUN.z1) * 0.5, zl = palTUN.z1 - palTUN.z0 + 5;
    const top = 20;
    M.box(palTUN.x, (palTUN.lintel + top) * 0.5, zc, palTUN.hw * 2 + 11,
          top - palTUN.lintel, zl, PALETTE.palKarstDk);
    palStaticBox(game, palTUN.x, (palTUN.lintel + top) * 0.5, zc,
                 palTUN.hw * 2 + 11, top - palTUN.lintel, zl);
    for (let side = -1; side <= 1; side += 2) {
      palStaticBox(game, palTUN.x + side * (palTUN.hw + 6), 8, zc, 12, 44, zl);
      M.box(palTUN.x + side * (palTUN.hw + 6), 6, zc, 12, 40, zl, PALETTE.palKarst);
    }
  }

  // ---- THE CATHEDRAL -------------------------------------------------------
  // A ring of leaning slabs closing to a roof, and a hole in the roof. It is
  // built out of eight sectors rather than a dome because a low-poly dome with
  // a hole in it is a mess of triangles, and because the eight leaning slabs
  // give the inside the ribbed look a real limestone chamber has.
  {
    const SN = 12;
    for (let i = 0; i < SN; i++) {
      const a = (i / SN) * Math.PI * 2;
      const sx = Math.sin(a), sz = Math.cos(a);
      if (sz > 0.88) continue;                       // the tunnel comes in here
      const rr = palCATH.r + 5;
      const x = palCATH.x + sx * rr, z = palCATH.z + sz * rr;
      M.box(x, 6, z, 13, 44, 13, i % 3 === 0 ? PALETTE.palCaveRock : PALETTE.palKarstDk, 0, -a);
      palStaticBox(game, x, 8, z, 13, 48, 13, -a);
      // the rib leaning in over the water
      M.box(palCATH.x + sx * (palCATH.r * 0.72), palCATH.dome * 0.62, palCATH.z + sz * (palCATH.r * 0.72),
            5.5, 3.0, 14, PALETTE.palCaveRock, sz * 0.42, -a, -sx * 0.42);
    }
    // the roof, in eight panels, with the hole left out of it
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const sx = Math.sin(a), sz = Math.cos(a);
      const rx = palCATH.x + sx * palCATH.r * 0.52, rz = palCATH.z + sz * palCATH.r * 0.52;
      const dh = Math.hypot(rx - palHOLE.x, rz - palHOLE.z);
      if (dh < palHOLE.r + 2.4) continue;            // this is where the light comes in
      M.box(rx, palCATH.dome, rz, palCATH.r * 0.9, 3.4, palCATH.r * 0.9,
            PALETTE.palCaveDark, 0, -a);
      palStaticBox(game, rx, palCATH.dome + 1.4, rz, palCATH.r * 0.9, 4.2, palCATH.r * 0.9, -a);
    }
    // the rim of the hole, lit from outside — this is what you look UP at
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      M.box(palHOLE.x + Math.sin(a) * (palHOLE.r + 1.4), palCATH.dome + 1.2,
            palHOLE.z + Math.cos(a) * (palHOLE.r + 1.4), 3.6, 3.0, 3.6,
            PALETTE.palSand, 0, -a);
    }
    // stalactites, hung off the ribs, because a cathedral has to have some
    for (let i = 0; i < 22; i++) {
      const a = rnd() * Math.PI * 2, r = rnd() * palCATH.r * 0.82;
      const x = palCATH.x + Math.sin(a) * r, z = palCATH.z + Math.cos(a) * r;
      if (Math.hypot(x - palHOLE.x, z - palHOLE.z) < palHOLE.r + 1.5) continue;
      const len = 2.2 + rnd() * 5.5;
      M.cone(x, palCATH.dome - 1.6 - len * 0.5, z, 0.5 + rnd() * 0.5, len,
             PALETTE.palCaveRock, Math.PI, 0, 0, 4);
    }
  }

  // ---- the back of the island, so the skyline closes -----------------------
  for (let i = 0; i < 7; i++) {
    const x = (rnd() - 0.5) * 100;
    const z = -140 - rnd() * 30;
    tower(x, z, 18 + rnd() * 10, 18 + rnd() * 10, 26 + rnd() * 22, rnd(), true);
  }

  const mesh = new THREE.Mesh(M.build(), palVC());
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.name = 'palIsland';
  root.add(mesh);
}

// =============================================================== THE BEACH ==
function palBuildBeach(game, root) {
  const M = palMerger();
  const palms = [];
  let seed = 909;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  /**
   * THE SEEDED rand(). Everything in this builder that decides WHERE something
   * goes has to come off the same stream as everything that decides what it is.
   *
   * Mixing the two is not a style question: every scatter here is a coordinate
   * followed by a terrain test — "if (g > -1.2) continue" — so an unseeded
   * coordinate is an unseeded COUNT, and the chapter builds a different number
   * of objects on every single load. Measured across three consecutive builds:
   * 128,510, 131,546 and 133,450 triangles, a five-thousand spread against a
   * hard ceiling of a hundred and thirty thousand. A budget you cannot measure
   * twice is not a budget, and a bug that only appears on some loads is a bug
   * you will chase for an evening.
   */
  const rr = (a2, b2) => a2 + rnd() * (b2 - a2);

  // ---- four nipa huts on stilts, which is how they are actually built ------
  // NORTH OF THE ARRIVAL, not on top of it. At z 43-50 with the player put down
  // at 46 these were built around the capybara, and the opening shot of the
  // chapter was the underside of somebody's floor.
  const solid = palPoolBody();
  const huts = [[-26, 54, 0.4], [-11, 58, -0.2], [14, 56, 0.15], [31, 52, -0.5]];
  for (let i = 0; i < huts.length; i++) {
    const hx = huts[i][0], hz = huts[i][1], ry = huts[i][2];
    const g = palTerrain(hx, hz);
    for (let s = 0; s < 4; s++) {
      M.cyl(hx + (s & 1 ? 2.2 : -2.2), g + 0.7, hz + (s & 2 ? 2.0 : -2.0), 0.16, 1.6,
            PALETTE.palTrunk, 0, 0, 0, 6);
    }
    M.box(hx, g + 1.6, hz, 5.4, 0.3, 4.6, PALETTE.palBamboo, 0, ry);
    M.box(hx, g + 2.6, hz, 5.0, 1.8, 4.2, PALETTE.palBambooDk, 0, ry);
    M.box(hx, g + 3.9, hz, 6.2, 1.4, 5.4, PALETTE.palThatch, 0, ry);
    M.box(hx, g + 4.7, hz, 3.0, 0.9, 3.0, PALETTE.palThatch, 0, ry);
    // a ladder up to the door, because a hut on stilts needs one
    M.box(hx + 2.9, g + 0.9, hz, 0.9, 0.14, 1.6, PALETTE.palBamboo, 0.5, ry);
    // THE BOX AROUND THE ROOM, not around the whole hut: the floor is 1.45 up
    // and the animal can walk UNDER a house on stilts, which is what a house on
    // stilts is for. Only the walled part is solid.
    palPoolBox(solid, hx, g + 2.7, hz, 2.6, 1.35, 2.2, ry);
    // ---- AND SOMEBODY LIVES IN IT ---------------------------------------
    // Four houses with nothing outside them is a model village. Every one of
    // these is on a beach in Palawan at five in the afternoon: a drying rack
    // with fish on it, a water drum, a line of washing, and a stack of
    // firewood — which is what is under every one of those floors.
    const s2 = i % 2 ? 1 : -1;
    M.cyl(hx - 4.2, g + 0.75, hz + s2 * 2.4, 0.07, 1.5, PALETTE.palBamboo, 0, 0, 0, 4);
    M.cyl(hx - 7.0, g + 0.75, hz + s2 * 2.4, 0.07, 1.5, PALETTE.palBamboo, 0, 0, 0, 4);
    M.cyl(hx - 5.6, g + 1.42, hz + s2 * 2.4, 0.05, 2.9, PALETTE.palBamboo, 0, 0, Math.PI * 0.5, 4);
    for (let k = 0; k < 4; k++) {
      // washing, or fish. It is one or the other and it is always both.
      M.box(hx - 6.6 + k * 0.72, g + 1.06, hz + s2 * 2.4, 0.5, 0.62, 0.04,
            [PALETTE.palBangkaTrim, PALETTE.palCoralOrange, PALETTE.palPearl,
             PALETTE.palFishA][(k + i) % 4], 0, 0, 0);
    }
    M.cyl(hx + 3.4, g + 0.42, hz - s2 * 2.6, 0.42, 0.85, PALETTE.palBambooDk, 0, 0, 0, 8);
    M.cyl(hx + 3.4, g + 0.86, hz - s2 * 2.6, 0.44, 0.08, PALETTE.palWreckDk, 0, 0, 0, 8);
    palPoolBox(solid, hx + 3.4, g + 0.42, hz - s2 * 2.6, 0.45, 0.42, 0.45);
    for (let k = 0; k < 6; k++) {
      M.cyl(hx - 1.4 + (k % 3) * 0.32, g + 0.11 + ((k / 3) | 0) * 0.24, hz - s2 * 3.2,
            0.11, 1.5, PALETTE.palTrunk, 0, 0.1 * k, Math.PI * 0.5, 4);
    }
  }

  // ---- the fire ring, and somebody's washing -------------------------------
  {
    const g = palTerrain(2, 55);
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2;
      M.sph(2 + Math.sin(a) * 1.5, g + 0.14, 55 + Math.cos(a) * 1.5, 0.3, 0.22, 0.3, PALETTE.palKarstDk);
    }
    for (let i = 0; i < 5; i++) {
      M.cyl(2 + rr(-0.5, 0.5), g + 0.3, 55 + rr(-0.5, 0.5), 0.08, 1.5, PALETTE.palWreckDk,
            rr(0.6, 1.1), rr(0, 6.28), 0, 4);
    }
    // The flame itself is NOT here any more — see palBuildFire. A cone merged
    // into the beach is right for scenery and useless for a thing that has to
    // go out.
  }

  // ---- three bangkas up on the sand, one of them a wreck -------------------
  const beached = [[-33, 39, 0.7], [-19, 35, 0.2], [24, 37, -0.5]];
  for (let i = 0; i < beached.length; i++) {
    const bx = beached[i][0], bz = beached[i][1], bry = beached[i][2];
    palHull(M, bx, palTerrain(bx, bz) + 0.5, bz, bry, i === 2);
    // A NINE-METRE HULL YOU CAN WALK THROUGH. The hull only, not the
    // outriggers: the arms are 9 cm of bamboo a metre off the sand and the
    // animal ducks under them, which is what everybody on that beach does.
    palPoolBox(solid, bx, palTerrain(bx, bz) + 0.55, bz, 0.85, 0.55, 4.4, bry);
  }
  // ---- one that is up on trestles being scraped, because there always is ---
  {
    const rx = 40, rz = 44, ry = 1.15;
    const g = palTerrain(rx, rz);
    palHull(M, rx, g + 1.35, rz, ry, false);
    for (let s = -1; s <= 1; s += 2) {
      M.box(rx + Math.cos(ry) * s * 0.1 - Math.sin(ry) * s * 2.6, g + 0.45,
            rz - Math.sin(ry) * s * 0.1 - Math.cos(ry) * s * 2.6, 2.2, 0.9, 0.3, PALETTE.palWreckDk, 0, ry);
    }
    M.cyl(rx + 2.4, g + 0.1, rz + 1.6, 0.36, 0.2, PALETTE.palCoralOrange, 0, 0, 0, 8);
    M.box(rx + 1.9, g + 0.08, rz + 2.4, 0.6, 0.1, 0.14, PALETTE.palBambooDk, 0, 0.6);
    palPoolBox(solid, rx, g + 1.35, rz, 0.85, 0.6, 4.4, ry);
  }

  // ---- THE JETTY ----------------------------------------------------------
  {
    const J = palJETTY;
    for (let z = J.z0; z <= J.z1; z += 2.2) {
      for (let side = -1; side <= 1; side += 2) {
        const g = palTerrain(J.x + side * J.w * 0.5, z);
        M.cyl(J.x + side * J.w * 0.5, (g + J.y) * 0.5, z, 0.13, J.y - g + 0.4,
              PALETTE.palBambooDk, 0, 0, 0, 6);
      }
    }
    M.box(J.x, J.y, (J.z0 + J.z1) * 0.5, J.w, 0.2, J.z1 - J.z0 + 1.2, PALETTE.palBamboo);
    // the planking, drawn across so it reads as planks from the camera
    for (let z = J.z0; z <= J.z1; z += 0.8) {
      M.box(J.x, J.y + 0.13, z, J.w - 0.1, 0.08, 0.5, PALETTE.palBambooDk);
    }
    palStaticBox(game, J.x, J.y - 0.15, (J.z0 + J.z1) * 0.5, J.w, 0.5, J.z1 - J.z0 + 1.2);
    // a post at the end with a lamp on it — the way out stands here
    M.cyl(J.x, J.y + 1.3, J.z0 - 0.2, 0.14, 2.6, PALETTE.palBambooDk, 0, 0, 0, 6);
    M.box(J.x, J.y + 2.7, J.z0 - 0.2, 0.5, 0.5, 0.5, PALETTE.palPearl);
  }

  // ---- WHAT IS ACTUALLY ON A BEACH -----------------------------------------
  // Measured against the world-size audit: the dry sand from z 30 to 50 was
  // eighteen metres of one flat cream colour with nothing in it at all, which
  // is the emptiest ground in the game by a distance. None of this is a task
  // and none of it is collidable — it is there so the walk to the water is a
  // walk through somewhere.
  for (let i = 0; i < 70; i++) {
    const x = rr(-50, 50), z = rr(palBEACH_Z - 1, 56);
    const g = palTerrain(x, z);
    if (g < -0.3) continue;
    const k = rnd();
    if (k < 0.30) {
      // driftwood, always lying along the last high tide
      M.cyl(x, g + 0.14, z, 0.11 + rnd() * 0.1, 1.2 + rnd() * 2.4, PALETTE.palWreckDk,
            0, rr(-0.5, 0.5), Math.PI * 0.5, 4);
    } else if (k < 0.55) {
      // a coconut husk or two
      M.sph(x, g + 0.16, z, 0.28, 0.2, 0.34, PALETTE.palTrunk);
    } else if (k < 0.78) {
      // shells, in the line the water left them in
      M.cone(x, g + 0.07, z, 0.16, 0.3, PALETTE.palPearl, rr(1.2, 1.9), rr(0, 6.28), 0, 4);
    } else {
      // and the black volcanic pebbles that are on every beach in that province
      M.sph(x, g + 0.08, z, rr(0.16, 0.4), rr(0.1, 0.2), rr(0.16, 0.4),
            PALETTE.palKarstShadow);
    }
  }
  // the line of dry seaweed at the high-water mark, which is the one thing that
  // tells you where the tide gets to
  for (let i = 0; i < 90; i++) {
    const x = rr(-52, 52);
    const z = palBEACH_Z + 1.4 + Math.sin(x * 0.09) * 1.1 + rr(-0.7, 0.7);
    M.box(x, palTerrain(x, z) + 0.05, z, rr(0.3, 1.1), 0.06, rr(0.15, 0.4),
          rnd() < 0.5 ? PALETTE.palWeed : PALETTE.palTrunk, 0, rr(0, 3));
  }

  // ---- palms. Instanced, because there are ninety of them -------------------
  for (let i = 0; i < 90; i++) {
    const x = rr(-52, 52);
    const z = rr(palBEACH_Z + 4, 62);
    const g = palTerrain(x, z);
    if (g < 0.5) continue;
    // A CLEAR CORRIDOR OFF THE SPAWN. The player arrives at (0, 46) facing the
    // water, and the one thing this chapter has to do in its first second is
    // show them how far down they can see. A palm in the way of that is worse
    // than no palm at all.
    if (Math.abs(x) < 9 && z < 53) continue;
    const lean = rr(-0.22, 0.22);
    const hgt = rr(5, 11);
    M.cyl(x + lean * hgt * 0.4, g + hgt * 0.5, z, 0.22, hgt, PALETTE.palTrunk, 0, 0, lean, 6);
    // ---- A TRUNK IS SOLID (V1). Ninety palms and every one walked through.
    // The trunk leans about z, so the box covers the bottom two metres of the
    // tilted axis: centre where the axis is a metre up, width grown by the
    // lean's run over that height. Full extents — palStaticBox halves.
    {
      const xc = x + lean * hgt * 0.4, sl = Math.sin(lean);
      palStaticBox(game, xc + sl * (hgt * 0.5 - 1.0), g + 1.0, z,
                   0.40 + Math.abs(sl) * 2.0, 2.0, 0.40);
    }
    const top = g + hgt;
    const tx = x + lean * hgt * 0.8;
    // NINE, NOT SEVEN. A coconut palm carries about twenty fronds and seven is
    // a windsock; at eight triangles apiece nine is cheaper than seven boxes was.
    for (let fr = 0; fr < 9; fr++) {
      const a = fr / 9 * Math.PI * 2 + rr(-0.16, 0.16);
      const len = 2.5 + rr(0, 0.7);
      // ...anchored at the CROWN and running outward, because palG.vee is a
      // leaf that starts at its own base rather than a slab centred on itself.
      palms.push(tx, top - 0.12, z,
                 -0.10 - rr(0, 0.16), a, 0,
                 0.86 + rr(0, 0.26), 1, len * 1.42);
    }
    // and the coconuts, which are the only round thing on a beach
    M.sph(tx, top - 0.4, z, 0.55, 0.5, 0.55, PALETTE.palTrunk);
  }

  // ---- the fringe of scrub where the sand stops ----------------------------
  for (let i = 0; i < 60; i++) {
    const x = rr(-56, 56), z = rr(52, 64);
    const g = palTerrain(x, z);
    M.sph(x, g + 0.5, z, rr(0.9, 2.2), rr(0.6, 1.3), rr(0.9, 2.2),
          rnd() < 0.5 ? PALETTE.palJungle : PALETTE.palPalm);
  }
  palPoolDone(game, solid);

  const mesh = new THREE.Mesh(M.build(), palVC());
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.name = 'palBeach';
  root.add(mesh);

  // ---- THE FRONDS, AND THEY ARE NOT BOXES ANY MORE ---------------------
  // 483 boxes at twelve triangles was 5,796 — the sixth largest object in the
  // chapter — for a leaf of which two faces are ever seen. See palG.vee: two
  // quads in a shallow V, four triangles, the correct section, and a taper to
  // the tip that a box cannot have. Marrakech's date palms paid for this first.
  const fronds = new THREE.InstancedMesh(palG.vee, mat(PALETTE.palPalm), palms.length / 9);
  for (let i = 0; i < palms.length / 9; i++) {
    const o = i * 9;
    fronds.setMatrixAt(i, palXform(palms[o], palms[o + 1], palms[o + 2],
                                   palms[o + 3], palms[o + 4], palms[o + 5],
                                   palms[o + 6], palms[o + 7], palms[o + 8]));
  }
  fronds.instanceMatrix.needsUpdate = true; fronds.computeBoundingSphere();
  fronds.castShadow = true;
  // ---- AND THEY MOVE ---------------------------------------------------
  // See sway() in shared.js. This is the cleanest sway target in the game and
  // it is worth saying why: an InstancedMesh hands the shader each frond in the
  // frond's OWN frame, so the ramp needs no merged-origin guesswork — palG.vee
  // runs z = 0 at the base to z = 1 at the tip, which IS the window.
  //
  // stiff 2.2 because a coconut frond is a stiff rib that whips at the last
  // third, not a rope; 0.22 m at the tip because the frond is about 2.5 m long
  // and a tenth of its own length is what a real one does in a sea breeze.
  // The crown's phase comes from the INSTANCE origin, so all nine fronds of one
  // palm move together and the palm beside it is on its own beat.
  //
  // swayMesh(), not sway(): these cast onto the sand, and a shadow that does
  // not sway with the thing casting it walks away from it.
  swayMesh(fronds, { leaf: 0.45, amount: 0.22, axis: 'z', lo: 0.10, hi: 1.0, stiff: 2.2, hz: 1.15 });
  root.add(fronds);
  palPalmMesh = fronds;
}

/** One bangka: a narrow hull, two bamboo outriggers, and a canopy. */
function palHull(M, x, y, z, ry, wrecked) {
  const hull = wrecked ? PALETTE.palWreck : PALETTE.palBangkaHull;
  const trim = wrecked ? PALETTE.palWreckDk : PALETTE.palBangkaTrim;
  M.box(x, y, z, 1.5, 0.9, 9.0, hull, 0, ry);
  M.box(x, y + 0.5, z, 1.7, 0.22, 8.4, trim, 0, ry);
  M.cone(x - Math.sin(ry) * 5.1, y + 0.15, z - Math.cos(ry) * 5.1, 0.75, 2.4, hull,
         -Math.PI * 0.5, ry, 0, 4);
  if (wrecked) {
    M.box(x + 0.9, y - 0.1, z + 1.4, 0.7, 0.8, 2.6, PALETTE.palWreckDk, 0.3, ry);
    return;
  }
  // the outriggers — two arms and two floats, and they are the whole silhouette
  for (let side = -1; side <= 1; side += 2) {
    for (let a = -1; a <= 1; a += 2) {
      const az = a * 2.4;
      M.cyl(x + Math.cos(ry) * side * 1.8, y + 0.9, z + az - Math.sin(ry) * side * 1.8,
            0.09, 3.8, PALETTE.palBamboo, 0, ry, Math.PI * 0.5, 6);
    }
    M.cyl(x + Math.cos(ry) * side * 3.5, y + 0.35, z - Math.sin(ry) * side * 3.5,
          0.17, 7.2, PALETTE.palBambooDk, Math.PI * 0.5, ry, 0, 6);
  }
  // canopy
  for (let s = 0; s < 4; s++) {
    M.cyl(x + (s & 1 ? 0.6 : -0.6), y + 1.3, z + (s & 2 ? 1.9 : -1.9), 0.07, 1.5,
          PALETTE.palBamboo, 0, 0, 0, 4);
  }
  M.box(x, y + 2.1, z, 2.0, 0.16, 4.6, PALETTE.palThatch, 0, ry);
}

// ================================================================ THE REEF ==
/**
 * A CORAL GARDEN THAT IS WORTH GOING DOWN TO LOOK AT.
 *
 * Everything here is merged into one mesh — a hundred and ninety heads at four
 * to nine boxes each is a lot of geometry and exactly one draw call. The colour
 * runs by DEPTH rather than at random: the shallow heads are the loud ones,
 * because that is honestly what happens (the red end of the light is gone by
 * about eight metres and everything below that is blue whatever colour it is).
 */
// THE RED END OF THE LIGHT IS GONE BY EIGHT METRES. Every head is graded toward
// this on the way down, which is why the deep reef reads blue whatever colour
// the coral actually is — and why the shallow one is worth the swim.
const palBRIGHT = [PALETTE.palCoralPink, PALETTE.palCoralOrange, PALETTE.palCoralViolet,
                   PALETTE.palCoralFan, PALETTE.palCoralBrain];
let palDeepC = null;

/**
 * ONE HEAD OF CORAL, planted at (x, z) on whatever the seabed is doing there.
 *
 * Lifted out of palBuildReef the moment a second place wanted a garden — which
 * was immediately, because the hidden lagoon and the cathedral are the two
 * rooms the whole chapter points at and both of them shipped as bare bowls.
 */
function palCoralHead(M, rnd, x, z) {
  const g = palTerrain(x, z);
  if (g > -0.9) return;
  if (!palDeepC) palDeepC = new THREE.Color(PALETTE.palDeep);
  const dim = clamp((-g - 1) / 7, 0, 1);
  const c = palBRIGHT[(rnd() * palBRIGHT.length) | 0];
  palCol.set(c).lerp(palDeepC, dim * 0.38);
  const col = palCol.getHex();
  const kind = rnd();
  {
    if (kind < 0.26) {
      // A TABLE CORAL — a plate on a stem, and the most readable of them. It
      // photographed as a slab hovering in mid-water, and that is one number:
      // a 20 cm stem under a 3 m plate is a matchstick, so at six metres of
      // range the stem is not there and the plate is FLOATING. A trunk that
      // flares into its own plate is what an Acropora actually is, and it is
      // also the only version in which you can see what holds it up.
      M.taper(x, g + 0.30, z, 0.34, 0.20, 0.60, PALETTE.palCoralBrain, rnd() * 3, 6);
      M.taper(x, g + 0.74, z, 0.22, 0.72, 0.30, col, rnd() * 3, 8);
      // THE PLATE, AND ITS OWN UNDERSIDE IN ONE PIECE. A separate rim ring was
      // thirty-two triangles for a shadow line; a plate whose lower face is a
      // shade darker than its upper one says the same thing for nothing, and
      // the merger paints per BLOCK, so it is two tapers rather than three.
      const pr = 1.0 + rnd() * 0.7;
      M.taper(x, g + 0.86, z, pr * 0.80, pr * 0.99, 0.16, PALETTE.palCoralBrain, 0, 8);
      M.taper(x, g + 0.99, z, pr * 0.97, pr, 0.14, col, rnd() * 3, 8);
    } else if (kind < 0.50) {
      // staghorn — three or four antlers going up and out
      const n = 3 + (rnd() * 3 | 0);
      for (let k = 0; k < n; k++) {
        const aa = k / n * Math.PI * 2;
        const len = 1.1 + rnd() * 1.5;
        M.cyl(x + Math.sin(aa) * 0.5, g + len * 0.42, z + Math.cos(aa) * 0.5, 0.13, len, col,
              Math.sin(aa) * 0.4, 0, -Math.cos(aa) * 0.4, 4);
        M.cyl(x + Math.sin(aa) * 0.95, g + len * 0.85, z + Math.cos(aa) * 0.95, 0.09, len * 0.6, col,
              Math.sin(aa) * 0.7, 0, -Math.cos(aa) * 0.7, 4);
      }
    } else if (kind < 0.68) {
      // brain coral — a boulder, and the thing everything else grows on. AND IT
      // HAS A TOP: the one detail on a Platygyra anybody can name is the maze,
      // and three shallow ridges across the crown is the whole of it.
      const br = 0.7 + rnd() * 0.9;
      M.sph(x, g + 0.45, z, br, 0.5 + rnd() * 0.5, br, PALETTE.palCoralBrain, 8);
      const ry = rnd() * 3;
      for (let k = -1; k <= 1; k += 2) {
        M.box(x + Math.cos(ry) * k * br * 0.42, g + 0.78, z - Math.sin(ry) * k * br * 0.42,
              br * 0.26, 0.14, br * 1.5, col, 0, ry);
      }
    } else if (kind < 0.86) {
      // A SEA FAN, standing across the current the way they all do — and a fan
      // is a FAN: it is narrow where it is rooted and wide at the top, which two
      // stacked boxes cannot say and one taper can. Plus the stub of holdfast,
      // because a gorgonian is anchored to the rock by something the width of a
      // finger and that is half of why it looks the way it does.
      const h = 1.1 + rnd() * 1.4;
      const ry = rnd() * 3;
      M.cyl(x, g + 0.16, z, 0.07, 0.34, PALETTE.palCoralBrain, 0, 0, 0, 4);
      M.taper(x, g + 0.32 + h * 0.5, z, 0.22, 1.5 + rnd() * 0.7, h, col, ry, 4);
      // ...and it is FLAT. A four-sided taper is a wedge; squashing it on its
      // own normal is what turns the wedge into a frond.
      M.box(x, g + 0.32 + h * 0.5, z, 1.5 + rnd() * 0.6, h * 0.92, 0.09, col, 0, ry);
    } else {
      // and a barrel sponge, which is the only thing down there big enough to
      // put a capybara inside
      M.taper(x, g + 0.85, z, 0.55 + rnd() * 0.25, 0.72 + rnd() * 0.35, 1.7,
              PALETTE.palCoralViolet, rnd() * 3, 8);
      M.cyl(x, g + 1.60, z, 0.46, 0.4, PALETTE.palCaveDark, 0, 0, 0, 8);
    }
  }
}

function palBuildReef(game, root) {
  const M = palMerger();
  let seed = 71717;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  /**
   * THE SEEDED rand(). Everything in this builder that decides WHERE something
   * goes has to come off the same stream as everything that decides what it is.
   *
   * Mixing the two is not a style question: every scatter here is a coordinate
   * followed by a terrain test — "if (g > -1.2) continue" — so an unseeded
   * coordinate is an unseeded COUNT, and the chapter builds a different number
   * of objects on every single load. Measured across three consecutive builds:
   * 128,510, 131,546 and 133,450 triangles, a five-thousand spread against a
   * hard ceiling of a hundred and thirty thousand. A budget you cannot measure
   * twice is not a budget, and a bug that only appears on some loads is a bug
   * you will chase for an evening.
   */
  const rr = (a2, b2) => a2 + rnd() * (b2 - a2);

  for (let i = 0; i < palCORAL_N; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * 30;
    const x = palREEF.x + Math.sin(a) * r * 1.4;
    const z = palREEF.z + Math.cos(a) * r;
    if (z > palBEACH_Z - 3 || z < palFLAT_Z - 6) continue;
    palCoralHead(M, rnd, x, z);
  }

  // ---- seagrass, in beds, on the sand between the heads --------------------
  // A BLADE OF SEAGRASS IS A BLADE. At 0.42 across and up to 1.7 tall these
  // were flat green DOORS standing in the sand, and at the dive camera's height
  // the nearest one filled a quarter of the frame.
  for (let i = 0; i < 340; i++) {
    const x = rr(-44, 40), z = rr(palFLAT_Z - 4, palBEACH_Z - 4);
    const g = palTerrain(x, z);
    if (g > -1.4 || g < -7.5) continue;
    M.blade(x, g, z, 0.24, 0.62 + rr(0, 0.6), PALETTE.palWeed,
            rr(0, 3), rr(-0.30, 0.30));
  }

  // ---- THE WRECK ----------------------------------------------------------
  // A bangka that did not come back, on its side on the sand at eleven metres.
  // It is not a task. It is there so that the deep, which is otherwise a beige
  // plain, has one thing in it that stops you — and so the drop-off is a place
  // rather than a gradient.
  {
    const g = palTerrain(palWRECK.x, palWRECK.z);
    palHull(M, palWRECK.x, g + 1.0, palWRECK.z, 0.9, true);
    M.box(palWRECK.x - 3.4, g + 0.4, palWRECK.z + 2.2, 1.2, 0.8, 3.0, PALETTE.palWreckDk, 0.2, 1.4);
    M.cyl(palWRECK.x + 2.6, g + 1.6, palWRECK.z - 1.4, 0.11, 5.0, PALETTE.palBambooDk, 1.1, 0.4, 0, 6);
    // coral has got to it, which is the only cheerful thing about a wreck
    for (let i = 0; i < 14; i++) {
      M.sph(palWRECK.x + rr(-3.5, 3.5), g + rr(0.6, 2.2), palWRECK.z + rr(-4.5, 4.5),
            rr(0.3, 0.8), rr(0.25, 0.6), rr(0.3, 0.8),
            i % 2 ? PALETTE.palCoralViolet : PALETTE.palCoralFan);
    }
  }

  const mesh = new THREE.Mesh(M.build(), palVC());
  mesh.receiveShadow = true;
  mesh.name = 'palReef';
  root.add(mesh);
}

// ========================================================== THE BACK ROOMS ==
/**
 * THE HIDDEN LAGOON, THE TUNNEL AND THE CATHEDRAL.
 *
 * The three places in this chapter you have to earn, and the three that had
 * nothing in them. Everything here is one merged mesh and none of it is
 * collidable — you swim through all of it — so it costs one draw call for the
 * whole back half of the world.
 *
 * The lagoon and the cathedral are furnished DIFFERENTLY on purpose. The lagoon
 * is open to the sky, so it gets the colour: a full garden, the biggest heads in
 * the chapter, and boulders that have come off the walls. The cathedral has one
 * hole in its roof and everything in it is grading toward black, so it gets
 * SHAPE instead — stalagmites, a fallen slab, and a bank of white sand directly
 * under the shaft, which is the only bright thing in the room and is therefore
 * where everybody swims.
 */
function palBuildBackRooms(game, root) {
  const M = palMerger();
  let seed = 20260819;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  /**
   * THE SEEDED rand(). Everything in this builder that decides WHERE something
   * goes has to come off the same stream as everything that decides what it is.
   *
   * Mixing the two is not a style question: every scatter here is a coordinate
   * followed by a terrain test — "if (g > -1.2) continue" — so an unseeded
   * coordinate is an unseeded COUNT, and the chapter builds a different number
   * of objects on every single load. Measured across three consecutive builds:
   * 128,510, 131,546 and 133,450 triangles, a five-thousand spread against a
   * hard ceiling of a hundred and thirty thousand. A budget you cannot measure
   * twice is not a budget, and a bug that only appears on some loads is a bug
   * you will chase for an evening.
   */
  const rr = (a2, b2) => a2 + rnd() * (b2 - a2);

  // ---- THE LAGOON ---------------------------------------------------------
  for (let i = 0; i < 86; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * palLAG.r * 0.94;
    palCoralHead(M, rnd, palLAG.x + Math.sin(a) * r, palLAG.z + Math.cos(a) * r);
  }
  // boulders off the walls, which is what is actually on the floor of one of
  // these: the ring is dissolving, and it dissolves downward
  for (let i = 0; i < 22; i++) {
    const a = rnd() * Math.PI * 2;
    const r = palLAG.r * (0.45 + rnd() * 0.55);
    const x = palLAG.x + Math.sin(a) * r, z = palLAG.z + Math.cos(a) * r;
    const g = palTerrain(x, z);
    const s = 1.1 + rnd() * 2.6;
    M.sph(x, g + s * 0.42, z, s, s * 0.72, s * 0.9,
          rnd() < 0.5 ? PALETTE.palKarstDk : PALETTE.palKarstShadow);
    // and coral has got to every one of them
    for (let k = 0; k < 2; k++) {
      M.sph(x + rr(-s, s) * 0.7, g + s * 0.7, z + rr(-s, s) * 0.7,
            rr(0.2, 0.5), rr(0.15, 0.35), rr(0.2, 0.5),
            k % 2 ? PALETTE.palCoralViolet : PALETTE.palCoralFan);
    }
  }
  for (let i = 0; i < 160; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * palLAG.r * 0.9;
    const x = palLAG.x + Math.sin(a) * r, z = palLAG.z + Math.cos(a) * r;
    const g = palTerrain(x, z);
    M.blade(x, g, z, 0.23, 0.58 + rr(0, 0.55), PALETTE.palWeed,
            rr(0, 3), rr(-0.26, 0.26));
  }
  // ---- and what hangs over it ---------------------------------------------
  // The one thing that tells you the walls are forty metres of limestone and
  // not a cylinder: things GROW out of them, all the way down to the water.
  for (let i = 0; i < 30; i++) {
    const a = rnd() * Math.PI * 2;
    const r = palLAG.r + 1.5 + rnd() * 3;
    const x = palLAG.x + Math.sin(a) * r, z = palLAG.z + Math.cos(a) * r;
    const y = 2 + rnd() * 22;
    M.sph(x, y, z, 1.2 + rnd() * 1.6, 0.8 + rnd(), 1.2 + rnd() * 1.6,
          rnd() < 0.5 ? PALETTE.palJungle : PALETTE.palJungleDk);
    // a vine, straight down, because that is the only way they go
    const vl = 3 + rnd() * 9;
    M.cyl(x, y - vl * 0.5, z, 0.06, vl, PALETTE.palJungleDk, 0, 0, 0, 4);
  }

  // ---- THE TUNNEL ---------------------------------------------------------
  // Ribs on the roof, so thirteen metres of swimming in the dark has something
  // going past. Nothing else: the point of a tunnel is that it is a tunnel.
  for (let z = palTUN.z0 + 1; z < palTUN.z1; z += 1.6) {
    M.box(palTUN.x, palTUN.lintel - 0.18, z, palTUN.hw * 1.9, 0.36, 0.42, PALETTE.palCaveDark);
    if (rnd() < 0.5) {
      M.cone(palTUN.x + rr(-2.6, 2.6), palTUN.lintel - 0.7, z, 0.24, 1.0,
             PALETTE.palCaveRock, Math.PI, 0, 0, 4);
    }
  }

  // ---- THE CATHEDRAL ------------------------------------------------------
  // A BANK OF WHITE SAND UNDER THE HOLE. It is the only thing in the room that
  // is not going grey, so it is the only thing the eye can find — and the whole
  // reason the chamber reads as a destination rather than as the end of a
  // tunnel. Everything else in here is shape.
  {
    const g = palTerrain(palHOLE.x, palHOLE.z);
    M.sph(palHOLE.x, g + 0.9, palHOLE.z, 7.5, 1.8, 7.5, PALETTE.palSand, 8);
    M.sph(palHOLE.x, g + 1.5, palHOLE.z, 4.0, 1.4, 4.0, PALETTE.palPearl, 8);
  }
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * palCATH.r * 0.9;
    const x = palCATH.x + Math.sin(a) * r, z = palCATH.z + Math.cos(a) * r;
    const g = palTerrain(x, z);
    const h = 1.2 + rnd() * 4.5;
    M.cone(x, g + h * 0.5, z, 0.4 + rnd() * 0.7, h,
           rnd() < 0.4 ? PALETTE.palKarstDk : PALETTE.palCaveRock, 0, rnd() * 3, 0, 4);
  }
  // a slab off the roof, lying where it fell, which every one of these has
  {
    const x = palCATH.x - 8, z = palCATH.z + 4;
    const g = palTerrain(x, z);
    M.box(x, g + 1.1, z, 9.5, 2.2, 5.0, PALETTE.palCaveRock, 0.16, 0.7, 0.1);
    M.box(x - 4.5, g + 0.5, z - 2.5, 3.4, 1.2, 3.0, PALETTE.palKarstDk, 0, 1.2);
  }
  // and one ring of pale coral where the shaft lands, because light is the only
  // thing coral wants and this is the only place in the room that has any
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rnd() * 0.2;
    const r = palHOLE.r + 1.5 + rnd() * 4;
    palCoralHead(M, rnd, palHOLE.x + Math.sin(a) * r, palHOLE.z + Math.cos(a) * r);
  }

  const mesh = new THREE.Mesh(M.build(), palVC());
  mesh.receiveShadow = true;
  mesh.name = 'palBackRooms';
  root.add(mesh);
}

// ============================================================ THE SMALL LIFE =
/**
 * A REEF IS NOT ARCHITECTURE. IT IS A TOWN.
 *
 * Everything down here was a STRUCTURE — a hundred and ninety heads of coral, a
 * wreck, a clam, a tunnel, a hole in a roof — and the only things alive in the
 * whole of it were three schools on rails, one turtle and one manta. So a diver
 * arriving at the reef found a beautifully built model of a reef. What is
 * missing is the thing anybody who has ever put a mask on remembers, which is
 * not the coral: it is that the coral is COVERED IN SMALL ANIMALS, all of them
 * doing something, none of them going anywhere.
 *
 * Four kinds, chosen because each one moves in a way the others do not and
 * because between them they are ninety per cent of what is actually on a
 * Palawan reef flat at four metres:
 *
 *   THE ANEMONE, and the clownfish that lives in it. The anemone SWAYS — the
 *   whole thing leans on the surge, all of them together, because the surge is
 *   one thing and it arrives everywhere at once. That single fact is what makes
 *   a reef look wet rather than dry, and this chapter did not have it anywhere.
 *   The clownfish never leaves; it swims a tight figure round its own host and
 *   ducks INTO it when the wheek goes off, which is the correct behaviour and
 *   is also the one joke on the reef.
 *
 *   THE URCHIN. Black, spiny, absolutely still, and in the cracks — the one
 *   thing on a reef that reads as "do not put your foot there".
 *
 *   THE STARFISH, lying on the sand between the heads, in the one blue nobody
 *   else down here is.
 *
 *   THE FEATHER STAR, which is a crinoid, sits on the top of a head with its
 *   arms in the current, and is the reason the deep reef is not all beige.
 *
 * All four are ONE merged mesh for the static parts and ONE instanced mesh for
 * the anemones, which are the only ones that move. The clownfish ride the same
 * instance buffer as the anemone they belong to.
 */
const palANEM_N = 34;
let palAnemMesh = null, palAnemData = null;     // x, y, z, phase, r
let palFishletMesh = null;

function palBuildSmallLife(root) {
  const M = palMerger();
  let seed = 60607;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  /**
   * THE SEEDED rand(). Everything in this builder that decides WHERE something
   * goes has to come off the same stream as everything that decides what it is.
   *
   * Mixing the two is not a style question: every scatter here is a coordinate
   * followed by a terrain test — "if (g > -1.2) continue" — so an unseeded
   * coordinate is an unseeded COUNT, and the chapter builds a different number
   * of objects on every single load. Measured across three consecutive builds:
   * 128,510, 131,546 and 133,450 triangles, a five-thousand spread against a
   * hard ceiling of a hundred and thirty thousand. A budget you cannot measure
   * twice is not a budget, and a bug that only appears on some loads is a bug
   * you will chase for an evening.
   */
  const rr = (a2, b2) => a2 + rnd() * (b2 - a2);

  // ---- the static half: urchins, starfish, feather stars, sponges ---------
  // THREE HUNDRED, AND WEIGHTED. A reef animal is a thing you see when you are
  // half a metre from it and a speck when you are not, so the mix is chosen by
  // what each one costs as much as by what it is: the starfish is a facet of the
  // sand at twelve triangles and gets to be the commonest, and the urchin — the
  // only one of the four that has to be MODELLED, because a black ball with no
  // spines is a rock — is rationed.
  for (let i = 0; i < 236; i++) {
    // over the reef flat, the lagoon and the ring of coral under the cathedral
    // shaft, weighted to the flat because that is where the player learns to dive
    let x, z;
    const where = rnd();
    if (where < 0.60) { x = palREEF.x + rr(-34, 30); z = palREEF.z + rr(-26, 18); }
    else if (where < 0.90) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * palLAG.r * 0.9;
      x = palLAG.x + Math.sin(a) * r; z = palLAG.z + Math.cos(a) * r;
    } else {
      const a = rnd() * Math.PI * 2, r = palHOLE.r + rnd() * 7;
      x = palHOLE.x + Math.sin(a) * r; z = palHOLE.z + Math.cos(a) * r;
    }
    const g = palTerrain(x, z);
    if (g > -1.2 || g < -9.5) continue;
    const k = rnd();
    if (k < 0.22) {
      // AN URCHIN. A ball and eight spines, and the spines are the whole animal:
      // a black sphere on a reef is a rock, and a black sphere with a halo of
      // needles is the one thing down there everybody remembers not to touch.
      M.sph(x, g + 0.17, z, 0.20, 0.16, 0.20, PALETTE.palCaveDark);
      for (let sp = 0; sp < 5; sp++) {
        const a = sp / 5 * Math.PI * 2 + rnd();
        const tilt = 0.5 + rnd() * 0.7;
        M.box(x + Math.sin(a) * 0.20, g + 0.20 + Math.cos(tilt) * 0.16, z + Math.cos(a) * 0.20,
              0.035, 0.34 + rnd() * 0.22, 0.035,
              rnd() < 0.4 ? PALETTE.palClamLip : PALETTE.palCaveDark,
              Math.sin(a) * tilt, a, Math.cos(a) * -tilt);
      }
    } else if (k < 0.66) {
      // A STARFISH, flat on the sand, and it is a FACET of the sand: five arms
      // out of a middle, all of them quads, ten triangles for the whole animal.
      const c = rnd() < 0.5 ? PALETTE.palBangkaTrim : PALETTE.palCoralViolet;
      const a0 = rnd() * Math.PI * 2;
      M.quad(x, g + 0.06, z, 0.19, 0.19, c, a0);
      for (let ar = 0; ar < 5; ar++) {
        const a = a0 + ar / 5 * Math.PI * 2;
        M.quad(x + Math.sin(a) * 0.20, g + 0.055, z + Math.cos(a) * 0.20,
               0.14, 0.34, c, a);
      }
    } else if (k < 0.88) {
      // A FEATHER STAR — a crinoid, which is an animal that looks like a fern
      // and sits on the highest thing it can find with its arms in the current.
      const c = rnd() < 0.5 ? PALETTE.palCoralOrange : PALETTE.palFishA;
      for (let ar = 0; ar < 5; ar++) {
        const a = ar / 5 * Math.PI * 2 + rnd() * 0.3;
        const ln = 0.30 + rnd() * 0.26;
        M.box(x + Math.sin(a) * ln * 0.5, g + 0.20 + ln * 0.24, z + Math.cos(a) * ln * 0.5,
              0.05, ln, 0.05, c, Math.sin(a) * 1.05, a, Math.cos(a) * -1.05);
      }
    } else {
      // ...and a christmas-tree worm, which is two spirals on a brain coral and
      // is the smallest thing on the reef anybody bothers to point at
      const c = rnd() < 0.5 ? PALETTE.palCoralPink : PALETTE.palFishB;
      for (let t2 = 0; t2 < 2; t2++) {
        for (let w = 0; w < 2; w++) {
          M.cone(x + t2 * 0.16, g + 0.10 + w * 0.055, z, 0.075 - w * 0.02, 0.07, c, 0, w * 1.1, 0, 4);
        }
      }
    }
  }
  const mesh = new THREE.Mesh(M.build(), palVC());
  mesh.receiveShadow = true;
  mesh.name = 'palSmallLife';
  root.add(mesh);

  // ---- the anemones, which are the only ones that move --------------------
  // ONE INSTANCE IS A WHOLE HOST: the column, sixteen tentacles and the fish
  // that lives in it. The surge leans the instance rather than the tentacles,
  // which is both what actually happens (an anemone is one soft body, it does
  // not wave its arms independently) and the only version of this that is one
  // matrix write a frame.
  const A = palMerger();
  A.taper(0, 0.13, 0, 0.20, 0.30, 0.26, PALETTE.palClamLip, 0, 6);
  // TEN TENTACLES, NOT FOURTEEN. At six metres of water and the size of a fist
  // the count is not what reads — the RING is, and ten holds a ring.
  for (let t2 = 0; t2 < 10; t2++) {
    const a = t2 / 10 * Math.PI * 2;
    const ln = 0.30 + (t2 % 3) * 0.07;
    A.box(Math.sin(a) * 0.20, 0.30 + ln * 0.30, Math.cos(a) * 0.20,
          0.055, ln, 0.055, t2 % 2 ? PALETTE.palCoralPink : PALETTE.palPearl,
          Math.sin(a) * 0.78, a, Math.cos(a) * -0.78);
  }
  palAnemMesh = new THREE.InstancedMesh(A.build(), palVC(), palANEM_N);
  palAnemMesh.frustumCulled = false;
  palAnemMesh.name = 'palAnemones';
  root.add(palAnemMesh);

  // ---- and the clownfish, one per anemone, on their own buffer ------------
  const C = palMerger();
  C.box(0, 0, 0, 0.075, 0.11, 0.20, PALETTE.palCoralOrange);
  C.box(0, 0, 0.035, 0.078, 0.112, 0.035, PALETTE.palPearl);
  C.box(0, 0, -0.055, 0.078, 0.112, 0.035, PALETTE.palPearl);
  C.box(0, 0.01, -0.13, 0.02, 0.09, 0.09, PALETTE.palCoralOrange);
  palFishletMesh = new THREE.InstancedMesh(C.build(), palVC(), palANEM_N);
  palFishletMesh.frustumCulled = false;
  palFishletMesh.userData.noShadow = true;
  palFishletMesh.name = 'palClownfish';
  root.add(palFishletMesh);

  palAnemData = new Float32Array(palANEM_N * 5);
  let n = 0, guard = 0;
  while (n < palANEM_N && guard++ < 4000) {
    let x, z;
    const where = rnd();
    if (where < 0.66) { x = palREEF.x + rr(-30, 26); z = palREEF.z + rr(-22, 16); }
    else {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * palLAG.r * 0.85;
      x = palLAG.x + Math.sin(a) * r; z = palLAG.z + Math.cos(a) * r;
    }
    const g = palTerrain(x, z);
    if (g > -1.6 || g < -8.5) continue;
    const o = n * 5;
    palAnemData[o] = x; palAnemData[o + 1] = g; palAnemData[o + 2] = z;
    palAnemData[o + 3] = rr(0, Math.PI * 2);
    palAnemData[o + 4] = 0.85 + rnd() * 0.7;
    n++;
  }
  palAnemMesh.count = n;
  palFishletMesh.count = n;
  palAnemLive = n;
}

let palAnemLive = 0;
// 0..1 — how far into its own anemone each clownfish has ducked. One number for
// the lot of them, because a wheek is one event and they all hear it at once.
let palClownHide = 0;
function palUpdateSmallLife(game, dt) {
  if (!palAnemMesh || !palAnemLive) return;
  const capy = game.capy;
  // THE WHEEK PUTS THEM IN. Everything else on this reef answers the voice by
  // running away — the schools bolt, the flock goes up — and a clownfish does
  // the opposite: it goes home, and home is nine centimetres away. It is the
  // only animal in the game whose response to being shouted at is to stay.
  if (game.input && game.input.honkPressed) palClownHide = 1;
  if (palClownHide > 0) palClownHide = Math.max(0, palClownHide - dt * 0.55);
  // ...and it also ducks when something the size of a capybara arrives
  const cp = capy && capy.position;
  // THE SURGE IS ONE THING AND IT ARRIVES EVERYWHERE AT ONCE. Two periods that
  // do not divide, so the reef never develops a beat, and a phase term in x + z
  // so the lean travels across the garden as a wave rather than pulsing on the
  // spot — which is the difference between a reef and a lava lamp.
  for (let i = 0; i < palAnemLive; i++) {
    const o = i * 5;
    const x = palAnemData[o], y = palAnemData[o + 1], z = palAnemData[o + 2];
    const ph = palAnemData[o + 3], sc = palAnemData[o + 4];
    const surge = Math.sin(palTime * 0.62 + (x + z) * 0.09) * 0.30 +
                  Math.sin(palTime * 0.31 + ph) * 0.12;
    const breathe = 1 + Math.sin(palTime * 0.9 + ph) * 0.07;
    palAnemMesh.setMatrixAt(i, palXform(x, y, z, surge * 0.7, ph, surge,
                                        sc, sc * breathe, sc));
    // the fish: a tight lap of its own host, and it drops INTO the column when
    // it is frightened rather than swimming off, because that is what it does
    const near = cp ? Math.max(0, 1 - Math.hypot(cp.x - x, cp.z - z) / 3.2) : 0;
    const hide = clamp(Math.max(palClownHide, near), 0, 1);
    const fa = ph + palTime * (1.5 + (i % 3) * 0.35);
    const fr = lerp(0.34, 0.05, hide) * sc;
    palFishletMesh.setMatrixAt(i, palXform(
      x + Math.sin(fa) * fr, y + lerp(0.52, 0.24, hide) * sc, z + Math.cos(fa) * fr,
      surge * 0.5, fa + Math.PI * 0.5, surge,
      sc, sc, sc));
  }
  palAnemMesh.instanceMatrix.needsUpdate = true;
  palFishletMesh.instanceMatrix.needsUpdate = true;
}

// ============================================================== THE SCHOOL ==
/**
 * A HUNDRED AND FIFTY FISH IN ONE DRAW CALL, IN THREE SCHOOLS.
 *
 * Each school circles a centre at its own radius, depth and rate, and each fish
 * has a fixed offset within it — so the school holds its shape, turns as one
 * thing and never needs a boids solve. Nothing is allocated per frame: the
 * whole state is one flat Float32Array and the matrix is the module's own.
 */
function palBuildFish(root) {
  palFishData = new Float32Array(palFISH_N * 6);   // cx, cz, depth, radius, rate, phase
  const schools = [
    { x: palREEF.x, z: palREEF.z, d: -3.2, r: 9, rate: 0.30, col: PALETTE.palFishA },
    { x: 12, z: -4, d: -4.6, r: 12, rate: -0.22, col: PALETTE.palFishB },
    { x: palWRECK.x, z: palWRECK.z, d: -8.5, r: 7, rate: 0.26, col: PALETTE.palFishC },
    // one for each of the back rooms — a room with nothing moving in it reads
    // as a model of a room
    { x: palLAG.x, z: palLAG.z, d: -4.0, r: 14, rate: -0.17, col: PALETTE.palFishA },
    { x: palHOLE.x, z: palHOLE.z, d: -4.5, r: 8, rate: 0.21, col: PALETTE.palFishB },
  ];
  const geo = new THREE.BoxGeometry(0.16, 0.24, 0.55);
  // A PRIVATE MATERIAL, AND IT IS NOT OPTIONAL. mat() caches by colour and
  // options, so the bare call hands back an object anybody else asking for the
  // same yellow also holds — and the bloom writes an emissive term onto this
  // material every frame. See [[clone eats the shader]]: one chapter's plankton
  // lighting up somebody else's props is a bug that only shows up two chapters
  // later.
  //
  // matOwn AND NOT .clone(), for the reason grainOwn exists: Material.copy()
  // does not carry onBeforeCompile, so cloning the cached material bought the
  // privacy and threw away the v50 rim — leaving the school as the one opaque
  // batch down here with no rim term on it.
  const m = new THREE.InstancedMesh(geo, matOwn(PALETTE.palFishA), palFISH_N);
  for (let i = 0; i < palFISH_N; i++) {
    const s = schools[i % schools.length];
    const o = i * 6;
    palFishData[o] = s.x; palFishData[o + 1] = s.z;
    palFishData[o + 2] = s.d + rand(-1.1, 1.1);
    palFishData[o + 3] = s.r + rand(-2.6, 2.6);
    palFishData[o + 4] = s.rate * rand(0.9, 1.1);
    palFishData[o + 5] = rand(0, Math.PI * 2);
    palCol.set(s.col);
    m.setColorAt(i, palCol);
  }
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
  m.frustumCulled = false;
  m.name = 'palSchools';
  root.add(m);
  palFishMesh = m;
}
/**
 * AND THE SCHOOL HEARS YOU.
 *
 * The wheek is this game's one voice, and for the whole of this chapter it had
 * exactly nothing to answer it underwater — which is the one place a capybara
 * genuinely does make a noise that carries. `palFishBolt` is 0..1 and it is
 * the only per-frame state the schools have: at 1 every fish within twenty
 * metres is thrown outward from the animal and swims for its life, and it
 * decays over about two and a half seconds, which is how long a scattered
 * school takes to re-form. The circle each fish is on never changes, so the
 * school comes back into shape by itself: the bolt is an OFFSET, not a state
 * machine.
 */
let palFishBolt = 0;
const palFishBoltP = new THREE.Vector3();
function palUpdateFish(game, dt) {
  if (!palFishMesh) return;
  const capy = game.capy;
  if (game.input && game.input.honkPressed && capy && capy.position && (capy.depth || 0) > 0.35) {
    palFishBolt = 1;
    palFishBoltP.copy(capy.position);
  }
  if (palFishBolt > 0) palFishBolt = Math.max(0, palFishBolt - dt * 0.42);
  const bolt = palFishBolt * palFishBolt;
  for (let i = 0; i < palFISH_N; i++) {
    const o = i * 6;
    const ph = palFishData[o + 5] + palTime * palFishData[o + 4];
    const r = palFishData[o + 3];
    let x = palFishData[o] + Math.sin(ph) * r;
    let z = palFishData[o + 1] + Math.cos(ph) * r * 0.8;
    let y = palFishData[o + 2] + Math.sin(ph * 2.6 + i) * 0.3;
    let yaw = Math.atan2(Math.cos(ph) * r, -Math.sin(ph) * r * 0.8);
    let flick = Math.sin(palTime * 9 + i) * 0.18;
    if (bolt > 0.002) {
      const dx = x - palFishBoltP.x, dy = y - palFishBoltP.y, dz = z - palFishBoltP.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < 20 && d > 0.01) {
        // THE PUSH FALLS OFF WITH DISTANCE and it is capped, or the far edge of
        // a fourteen-metre school is thrown further than the near edge and the
        // ring turns inside out.
        const k = bolt * clamp(1 - d / 20, 0, 1) * 5.5;
        x += dx / d * k; y += dy / d * k; z += dz / d * k;
        yaw = Math.atan2(dx, dz);
        flick = Math.sin(palTime * 26 + i) * 0.42 * bolt;
        // never through the seabed, and never out of the water
        const bed = palTerrain(x, z);
        if (y < bed + 0.35) y = bed + 0.35;
        if (y > palWATER - 0.25) y = palWATER - 0.25;
      }
    }
    palFishMesh.setMatrixAt(i, palXform(x, y, z, 0, yaw, flick, 1, 1, 1));
  }
  palFishMesh.instanceMatrix.needsUpdate = true;
  // ---- AND THE BLOOM LIGHTS THEM ---------------------------------------
  // The marquee lit two hundred and forty motes, the caustic net, the bubbles
  // and the surface — and left every ANIMAL in the bay exactly the colour it
  // had been all afternoon. A bloom is in the water, so anything moving through
  // it is lit from all sides by the thing it is disturbing; a school of yellow
  // fish that stays yellow while the sea round it turns green is the one object
  // in the frame saying the effect is a filter rather than a place. One
  // material term, once a frame, for the whole school.
  if (palFishMesh.material) {
    const m = palFishMesh.material;
    if (m.emissive) {
      m.emissive.copy(palBloomC);
      // ...and it flares when they bolt, because a school of forty thousand
      // turning at once is the single brightest thing that bay ever does
      emitSet(m, palBloom * (0.55 + palFishBolt * 1.5));
    }
  }
}

// ============================================================== THE TURTLE ==
/**
 * ONE GREEN TURTLE, ON A LAP OF THE REEF, AND IT IS FASTER THAN IT LOOKS.
 *
 * It moves at 1.55 m/s. A paddling capybara does 2.6 and a DIVING one does
 * 3.1 — so keeping up with it on the surface is possible and pointless, because
 * the turtle is four metres down and the task measures how long you stay
 * ALONGSIDE. The number is the argument: the chapter's new verb is the only
 * comfortable way to do this.
 */
// ================================================================ THE BALL ====
// THE MINI, and the one thing in this chapter that reacts to you.
//
// Everything else under this water is scenery you visit: a wreck, a clam, a
// tunnel, a hole in a roof. The turtle moves but does not care. This does: forty
// thousand sardines over the drop-off, holding one shape, and the shape opens
// around whatever swims into it and closes behind — which is the single most
// famous thing the sea does and it costs one instanced mesh.
//
// The bait ball is a torus, not a sphere. A sphere with a hole punched in it
// reads as a bug; a rotating ring of fish is what a bait ball actually IS when
// something is working it, and the animal swims through the middle of the ring.
//
// The repulsion is drawn ONLY. No forces, no colliders, forty thousand fish that
// cannot push a capybara anywhere: the wow here is entirely a picture, and a
// picture that also shoves you is a picture you spend the whole time fighting.
const palBALL = { x: 8, z: -18 };      // over the lip of the drop-off
const palBALL_Y = -6.4;
// EIGHT HUNDRED FISH, AND A TRIANGLE BUDGET.
//
// The first cut drew each sardine as a body, a back-stripe and a tail — three
// boxes — four to an instance, three hundred and twenty instances: forty-six
// thousand triangles, which took this chapter from a hundred and seventeen to a
// hundred and sixty-three and straight through the hundred-and-thirty-thousand
// ceiling in CONTRACT.md. Measured, not guessed.
//
// A sardine eleven centimetres long, seen through six metres of water, is a
// sliver of light. It is ONE BOX. Four to an instance, a hundred and eighty
// instances, alternating dark and silver so the shoal still shimmers as it
// turns: seven hundred and twenty fish for eight and a half thousand triangles.
// A HUNDRED AND FORTY, AND A TIGHTER RING. Measured off the drop-off frame with
// the manta in it: at 180 clumps over a 4.0 m ring with a 1.55 m tube the shoal
// read as scattered matchwood — seven hundred sardines spread thinly enough that
// you could see between every one of them, which is the one thing a bait ball
// never is. Fewer fish in a smaller volume is DENSER, and it gives back two
// thousand triangles at the same time.
const palBALL_N = 118;                 // instances; each is a four-fish clump
// A BAIT BALL IS DENSE. At 5.6 by 2.3 the same seven hundred fish were spread
// over four hundred cubic metres and photographed as drifting litter; the whole
// effect is packing, and the shoal only reads as one animal when you cannot see
// between them.
const palBALL_R = 3.35;                // radius of the ring
const palBALL_TUBE = 1.20;             // and its thickness
const palBALL_OPEN = 2.6;              // m the shoal clears around the animal
const palBALL_IN = 2.6;                // m of the middle that counts as 'inside'
const palBALL_HOLD = 4.0;              // s inside that count
let palBallMesh = null;
let palBallSeed = [];
let palBallT = 0;
let palBallIn = 0;
// the grace out of the ball, and the rising shimmer inside it
let palBallOff = 0, palBallVox = 0;
let palBallDone = false;
const palBallPos = new THREE.Vector3(palBALL.x, palBALL_Y, palBALL.z);

function palBuildBaitBall(root) {
  const M = palMerger();
  // four sardines per instance, one box each, at the size a sardine actually
  // is: eleven centimetres. See the note above palBALL_N.
  for (let k = 0; k < 4; k++) {
    const ox = (k % 2) * 0.17 - 0.085, oz = ((k / 2) | 0) * 0.21 - 0.105;
    M.box(ox, (k % 2) * 0.05 - 0.025, oz, 0.05, 0.055, 0.22,
          k % 2 ? PALETTE.palClam : PALETTE.palWreckDk, 0, 0, 0);
  }
  palBallMesh = new THREE.InstancedMesh(M.build(), palVC(), palBALL_N);
  palBallMesh.castShadow = false;
  // ...and it has to SAY SO, because registerShadowTarget turns it straight back
  // on. Eight and a half thousand triangles of eleven-centimetre fish, rendered
  // a second time, for a shadow nobody could resolve at any distance.
  palBallMesh.userData.noShadow = true;
  palBallMesh.frustumCulled = false;
  palBallMesh.name = 'palBaitBall';
  root.add(palBallMesh);
  palBallSeed = [];
  for (let i = 0; i < palBALL_N; i++) {
    // stratified round the ring so it is a torus and not a clump
    palBallSeed.push({
      a: (i / palBALL_N) * Math.PI * 2 + ((i * 7919) % 100) / 100 * 0.05,
      b: ((i * 104729) % 628) / 100,
      r: 0.35 + ((i * 65537) % 100) / 100 * 0.65,
      w: 0.75 + ((i * 31337) % 100) / 100 * 0.5,
    });
  }
}

function palUpdateBaitBall(game, dt) {
  if (!palBallMesh) return;
  palBallT += dt;
  const capy = game.capy;
  const cp = capy && capy.position;
  const spin = palBallT * 0.55;
  for (let i = 0; i < palBALL_N; i++) {
    const sd = palBallSeed[i];
    const a = sd.a + spin * sd.w;
    const b = sd.b + palBallT * 0.9 * sd.w;
    // a point on the torus
    const rr = palBALL_R + Math.cos(b) * palBALL_TUBE * sd.r;
    let x = palBALL.x + Math.cos(a) * rr;
    let z = palBALL.z + Math.sin(a) * rr;
    let y = palBALL_Y + Math.sin(b) * palBALL_TUBE * sd.r;
    // ---- and it opens ----------------------------------------------------
    if (cp) {
      const dx = x - cp.x, dy = y - cp.y, dz = z - cp.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < palBALL_OPEN && d > 0.001) {
        const push = (palBALL_OPEN - d);
        x += dx / d * push; y += dy / d * push; z += dz / d * push;
      }
    }
    // ---- ...AND IT OPENS FOR THE BIRD TOO (Tier 5) -----------------------
    // The identical push, from a different thing. The whole block above has
    // been hard-coded to `game.capy` since it was written, which is why a
    // shoal of four hundred and seventy sardines could be dived on twenty
    // times a minute by twenty-two terns and never move: the terns' dive was
    // a keyframed y-lerp that stopped half a metre under the surface, six
    // metres above the ball, and neither system read the other. Grep found
    // zero cross-references in either direction.
    //
    // `palTernHitK` is how far into a strike the deepest bird is and
    // `palTernHitX/Y/Z` is where it is. One strike at a time — a wall of
    // simultaneous punctures reads as noise, and a single hole that closes is
    // legible from the surface, which is the point of the whole tern block.
    // ...and it cuts. `game.state.noHunt` is the shared flag for the whole
    // Tier 5 layer in all three chapters, so the ecosystem can be measured
    // against its own absence rather than against a memory of the reef.
    if (palTernHitK > 0 && !(game.state && game.state.noHunt)) {
      const bx = x - palTernHitX, by = y - palTernHitY, bz = z - palTernHitZ;
      const bd = Math.sqrt(bx * bx + by * by + bz * bz);
      const R = palTERN_PUNCH * palTernHitK;
      if (bd < R && bd > 0.001) {
        const push = (R - bd);
        x += bx / bd * push; y += by / bd * push; z += bz / bd * push;
      }
    }
    palBallMesh.setMatrixAt(i, palXform(x, y, z, Math.sin(b) * 0.4, a + Math.PI * 0.5, 0, 1, 1, 1));
  }
  palBallMesh.instanceMatrix.needsUpdate = true;

  if (!cp) return;
  const dx = cp.x - palBALL.x, dy = cp.y - palBALL_Y, dz = cp.z - palBALL.z;
  const inside = dx * dx + dy * dy + dz * dz < palBALL_IN * palBALL_IN;
  if (inside) {
    palBallOff = 0;
    palBallIn += dt;
    // ---- AND IT CLOSES BEHIND YOU, WHICH IS THE WHOLE SENSATION ----------
    // The ball opens away from the animal — that has always worked — and then
    // absolutely nothing else happened. Being inside a bait ball is the one
    // place in this game where the world is on all six sides of you at once,
    // and the only feedback it had was a task tick at the end of it.
    //
    // A rising shimmer of the reef's own voice, faster the longer you stay in,
    // so the hold has a shape you can hear. Throttled on its own clock and
    // silent the moment you are out, which is the difference between a texture
    // and a tinnitus.
    palBallVox -= dt;
    if (palBallVox <= 0) {
      const k = clamp(palBallIn / palBALL_HOLD, 0, 1);
      palBallVox = lerp(0.34, 0.13, k);
      palSfx('tick', { volume: 0.05 + k * 0.10, pitch: 1.5 + k * 1.1 });
      if (k > 0.55) palSfx('rustle', { volume: 0.05 + k * 0.06, pitch: 2.1 });
    }
    if (!palBallDone && palBallIn >= palBALL_HOLD) {
      palBallDone = true;
      palTask('bait-ball');
      // one clean note out, and the whole torus scatters and reforms
      palSfx('chime', { volume: 0.7, pitch: 1.75, force: true });
      palToast('several thousand sardines, and every one of them moved for you.');
    }
  } else if (palBallIn > 0) {
    // Half a second of grace, the same as the bangka's deck and the turtle's
    // lap: the ball is four metres across, the animal is thirty centimetres of
    // it, and one stroke too wide should not be a restart.
    palBallOff += dt;
    if (palBallOff > 0.5) { palBallIn = 0; palBallOff = 0; palBallVox = 0; }
  }
}

function palBuildTurtle(root) {
  const M = palMerger();
  M.sph(0, 0, 0, 1.35, 0.5, 1.6, PALETTE.palTurtleShell, 8);
  M.sph(0, -0.16, 0, 1.15, 0.34, 1.4, PALETTE.palTurtle, 8);
  M.sph(0, 0.02, -1.75, 0.34, 0.30, 0.46, PALETTE.palTurtle, 8);
  M.box(0.16, 0.06, -2.0, 0.1, 0.1, 0.1, PALETTE.palCaveDark);
  M.box(-0.16, 0.06, -2.0, 0.1, 0.1, 0.1, PALETTE.palCaveDark);
  for (let side = -1; side <= 1; side += 2) {
    M.box(side * 1.5, -0.06, -0.5, 1.9, 0.12, 0.75, PALETTE.palTurtle, 0, side * 0.35);
    M.box(side * 1.1, -0.08, 1.1, 1.0, 0.11, 0.5, PALETTE.palTurtle, 0, -side * 0.4);
  }
  M.cone(0, -0.02, 1.8, 0.3, 0.7, PALETTE.palTurtleShell, -Math.PI * 0.5, 0, 0, 4);
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(M.build(), palVC());
  mesh.castShadow = true;
  g.add(mesh);
  g.userData.flippers = mesh;
  root.add(g);
  palTurtle = g;
}
/** Where the turtle is right now. A slow figure round the reef and the drop. */
function palTurtlePos(t, out) {
  const a = t * 0.105;
  out.x = palREEF.x + 6 + Math.sin(a) * 21 + Math.sin(a * 2.3) * 4;
  out.z = palREEF.z - 6 + Math.cos(a) * 15 + Math.cos(a * 1.7) * 5;
  // THE FLOOR IS RELATIVE AND THE CEILING IS ABSOLUTE, so a single clamp cannot
  // express both: over the shallow reef flat `terrain + 2.2` is above the
  // surface, the -1.4 ceiling pulled it back down to seven tenths of a metre
  // UNDER the sand, and the turtle spent part of every lap swimming inside the
  // reef where it can neither be seen nor followed.
  const tSeabed = palTerrain(out.x, out.z);
  out.y = Math.min(-1.4, Math.max(tSeabed + 1.0, tSeabed + 2.2)) + Math.sin(t * 0.45) * 0.8;
  if (out.y < tSeabed + 0.6) out.y = tSeabed + 0.6;

  // ---- AND EVERY NINETY SECONDS SHE GOES UP FOR AIR ----------------------
  // A sea turtle is a REPTILE. It has lungs, it surfaces, it takes one breath
  // that you can hear from thirty metres, and it goes back down — and in a
  // chapter whose entire subject is holding your breath, the one animal in it
  // that has the same problem never once came up. Following her up is the
  // whole beat: you are out of air at exactly the moment she is, you break the
  // surface together, and the task that asks you to keep up with her is
  // suddenly about something.
  //
  // 6 s of the 92 s cycle, and the shape is a rise, a moment on top and a
  // slide back down — a turtle does not bob, it comes up on the diagonal.
  const bt = (t % palTURTLE_AIR) / palTURTLE_AIR;
  if (bt > palTURTLE_UP0 && bt < palTURTLE_UP1) {
    const u = (bt - palTURTLE_UP0) / (palTURTLE_UP1 - palTURTLE_UP0);
    const k = palSmooth(Math.min(u / 0.42, (1 - u) / 0.46));
    out.y = lerp(out.y, palWATER - 0.22, k);
  }
  return out;
}
// 92 s, and it is deliberately not a multiple of the bloom's 124: two clocks
// that share a factor are one clock, and the chapter would develop a beat.
const palTURTLE_AIR = 92;
const palTURTLE_UP0 = 0.58, palTURTLE_UP1 = 0.645;   // ~6 s at the surface
/** True while she is up. palUpdateTurtle makes the noise; nothing else asks. */
function palTurtleUp(t) {
  const bt = (t % palTURTLE_AIR) / palTURTLE_AIR;
  return bt > palTURTLE_UP0 && bt < palTURTLE_UP1;
}
function palUpdateTurtle(dt) {
  if (!palTurtle) return;
  palTurtleT += dt;
  palTurtlePos(palTurtleT, palPt);
  const ax = palPt.x, ay = palPt.y, az = palPt.z;
  palTurtlePos(palTurtleT + 0.4, palPt);
  palTurtle.position.set(ax, ay, az);
  palTurtle.rotation.y = Math.atan2(palPt.x - ax, palPt.z - az) + Math.PI;
  palTurtle.rotation.x = clamp((palPt.y - ay) * -0.6, -0.5, 0.5);
  // the flippers, which are the only part of a turtle that ever hurries
  const f = palTurtle.userData.flippers;
  if (f) f.rotation.z = Math.sin(palTurtleT * 2.1) * 0.11;
  // ---- the breath, and it is the only noise she makes --------------------
  const up = palTurtleUp(palTurtleT);
  // ...AT THE VOLUME THE DISTANCE SAYS. She laps a forty-metre reef and she
  // gasped at 0.42 from anywhere in the bay, including from inside the
  // cathedral a hundred and thirty metres and two rock walls away.
  const h = palHeard(ax, az, 7, 55);
  if (up && !palTurtleWasUp) {
    palTurtleWasUp = true;
    if (h > 0.03) {
      palSfx('gasp', { volume: 0.62 * h, pitch: 0.55 });
      palSfx('splash', { volume: 0.5 * h, pitch: 1.25 });
    }
  } else if (!up && palTurtleWasUp) {
    palTurtleWasUp = false;
    if (h > 0.03) palSfx('splash', { volume: 0.4 * h, pitch: 0.95 });
  }
}
let palTurtleWasUp = false;
// the grace on the follow, and the one nudge. See THE TURTLE’S OWN BREATH.
let palTurtleOff = 0, palTurtleTold = false;

// =============================================================== THE MANTA ==
// THE SECOND MINI, and it is the only thing in this game that takes you
// somewhere by DECIDING to.
//
// Everything else that has ever carried this animal is on rails: a ferry has a
// berth, a chiva has a road, a balloon has the wind and a bell has a rope. They
// are all doors you walk through. A manta is an animal, it is going where it
// likes, and the whole of this set piece is the twenty-two seconds after it
// stops being interested in you.
//
// It runs a slow lap of the drop-off at about a metre a second — a dive does
// three, so the catch is never the hard part and was never meant to be. Take
// hold of the leading edge (E, within reach, and you have to be UNDER: the
// chapter's own verb is the price of admission to its middle rung) and it goes:
// out over the lip into the blue, a full barrel roll at ten metres, then a long
// climb back at the reef — and it leaves the water. Mantas do this. Nobody
// knows why they do this. You are on its back when it happens.
//
// THE BREATH IS FREE FOR THE WHOLE RIDE, and that is not generosity: `stamFree`
// in capybara.js is true whenever `carriedBy` is set, so the bar this chapter
// spends its whole length teaching you to watch is the one thing you do not
// have to watch here. A set piece you can drown in the middle of is a set piece
// nobody ever sees the end of.
const palMANTA = { x: -4, z: -17 };    // the cleaning station, over the drop-off
const palMANTA_RX = 14, palMANTA_RZ = 9;
const palMANTA_RATE = 0.096;           // rad/s — about 1.1 m/s, and that is a manta
const palMANTA_Y = -6.0;               // cruise depth. Under, on purpose.
const palMANTA_REACH = 3.6;            // m — the leading edge is four metres wide
const palMANTA_RIDE = 22.0;            // s of flight  (the span is 7.4 m: see the seg table)
let palMantaGroup = null;
let palMantaA = 0.7;                   // where it is on its lap
let palMantaRideT = -1;                // -1 when nobody is on it
let palMantaDone = false;
let palMantaBreached = false;
let palMantaCool = 0;                  // so one press cannot grab and let go
let palMantaTold = false;
const palMantaPos = new THREE.Vector3(palMANTA.x, palMANTA_Y, palMANTA.z);
const palMantaQ2 = new THREE.Quaternion();
const palMantaOff = new THREE.Vector3();
// The token capy.carriedBy holds — and, since D8, how it holds you: this is
// the one carrier in the game you are ON TOP OF rather than dangling under, so
// the four-legged flail every carry used to draw was a capybara pedalling the
// open water on the back of a ray. See WHO IS HOLDING YOU in capybara.js.
const palMantaApi = { what: 'manta', hold: 'ride' };

function palBuildManta(root) {
  const M = palMerger();
  // A MANTA IS A FLAT DIAMOND WITH A THICK STRIPE DOWN THE MIDDLE, and the
  // first cut of this got that backwards. It was eleven spanwise slabs, each
  // one thick enough to see and each at its own droop angle, which photographed
  // as a venetian blind: every seam caught the light and the silhouette — the
  // one thing this palette has to work with — was a ladder.
  //
  // Four segments a side now, ABUTTING EXACTLY (x1 of one is x0 of the next),
  // getting thinner and shorter in the chord as they go out. The creases that
  // are left are the folded-paper language the whole game is drawn in, rather
  // than an accident of overlap.
  M.box(0, 0, -0.10, 1.75, 0.72, 3.30, PALETTE.palWreckDk);      // the body
  M.box(0, -0.31, 0.00, 1.50, 0.22, 3.00, PALETTE.palClam);      // and its belly
  // A MANTA IS TWICE AS WIDE AS IT IS LONG. The first table was square and it
  // photographed as a raft with a capybara standing on it. Seven and a half
  // metres across against four of body: the disc IS the animal.
  //
  // AND EACH SEGMENT IS YAWED ALONG ITS OWN SWEEP. Boxes that are merely SHORTER
  // as they go out leave the leading edge a staircase — measured on the breach
  // frame, four visible steps down a wing that is supposed to be one curve. Yaw
  // each one to the local slope of the sweep line and the steps become the
  // creases the rest of this game is drawn with.
  const palMANTA_N = 8, MX0 = 0.86, MX1 = 3.72;
  const chordAt = t => 3.00 * (1 - 0.72 * t * t);
  const sweepAt = t => -1.70 * t * t;
  const thickAt = t => 0.46 * (1 - t) * (1 - t) + 0.09;
  const droopAt = t => -0.52 * t * t;
  for (let i = 0; i < palMANTA_N; i++) {
    const t0 = i / palMANTA_N, t1 = (i + 1) / palMANTA_N, tm = (t0 + t1) * 0.5;
    const x0 = MX0 + (MX1 - MX0) * t0, x1 = MX0 + (MX1 - MX0) * t1;
    const dx = x1 - x0, dz = sweepAt(t1) - sweepAt(t0);
    const span = Math.hypot(dx, dz), yawSeg = Math.atan2(dz, dx);
    const cx = (x0 + x1) * 0.5, cz = (sweepAt(t0) + sweepAt(t1)) * 0.5;
    const th = thickAt(tm), ch = chordAt(tm), dy = droopAt(tm);
    for (let s = -1; s <= 1; s += 2) {
      M.box(s * cx, dy, cz, span, th, ch, PALETTE.palWreckDk,
            0, -s * yawSeg, s * (0.06 + tm * 0.42));
      // the pale underside, inset so the dark edge still draws the outline
      M.box(s * cx, dy - th * 0.46, cz, span * 0.94, th * 0.36, ch * 0.86,
            PALETTE.palClam, 0, -s * yawSeg, s * (0.06 + tm * 0.42));
    }
  }
  // The two marks on the shoulders. Every manta has a different pair and it is
  // how one is told from another — but at 0.44 by 0.70 they read as skylights
  // on a barge, so they are thin angled bars and not patches.
  M.box(-0.58, 0.37, -0.40, 0.16, 0.08, 0.95, PALETTE.palClam, 0, -0.34, 0);
  M.box(0.62, 0.37, -0.70, 0.14, 0.08, 0.72, PALETTE.palClam, 0, 0.30, 0);
  // the head: a blunt block with the mouth across the front of it, and the two
  // cephalic lobes rolled forward the way they are when it is feeding
  M.box(0, 0.02, 1.66, 1.45, 0.60, 0.95, PALETTE.palWreckDk);
  M.box(0, -0.22, 2.06, 1.22, 0.20, 0.26, PALETTE.palCaveDark);
  for (let s = -1; s <= 1; s += 2) {
    M.box(s * 0.68, -0.06, 2.18, 0.22, 0.32, 0.90, PALETTE.palWreckDk, 0.20, s * 0.14, 0);
  }
  // gill slits, which are the only marks on the underside
  for (let k = 0; k < 5; k++) {
    for (let s = -1; s <= 1; s += 2) {
      M.box(s * (0.48 + k * 0.015), -0.40, 0.95 - k * 0.30, 0.34, 0.05, 0.09, PALETTE.palCaveDark);
    }
  }
  // the tail: a whip, and it is longer than the animal is wide
  for (let k = 0; k < 6; k++) {
    const t = k / 5;
    M.box(0, 0.02 - t * 0.10, -1.85 - k * 0.62, 0.16 - t * 0.11, 0.14 - t * 0.09, 0.66,
          PALETTE.palWreckDk);
  }
  const mesh = new THREE.Mesh(M.build(), palVC());
  mesh.castShadow = true;
  palMantaGroup = new THREE.Group();
  palMantaGroup.name = 'palManta';
  palMantaGroup.add(mesh);
  root.add(palMantaGroup);
  palMantaA = 0.7;
  palMantaRideT = -1;
}
/**
 * THE FLIGHT, AS A MODULATION OF THE LAP IT WAS ALREADY FLYING.
 *
 * Written this way rather than as a path of its own, and that is the whole
 * reason there is no jolt at the moment you take hold: at u = 0 the radius
 * scale is 1, the depth is the cruise depth and the roll is zero, so the first
 * frame of the set piece is identical to the last frame before it. Three
 * keyframe curves and nothing else — radius out and then hard in, depth down
 * and then up through the surface, and the rate, because an animal that has
 * decided to go somewhere speeds up.
 */
const palMANTA_K = {
  r: [[0, 1], [0.28, 1.34], [0.55, 1.34], [0.86, 0.62], [1, 0.58]],
  y: [[0, palMANTA_Y], [0.28, -10.6], [0.55, -10.1], [0.80, -3.4], [0.88, -1.4],
      [0.93, 3.2], [0.97, -1.2], [1, -2.4]],
  s: [[0, 1], [0.20, 2.4], [0.55, 2.1], [0.86, 3.3], [1, 1.5]],
};
function palMantaKey(rows, u) {
  for (let i = 1; i < rows.length; i++) {
    if (u <= rows[i][0]) {
      const a = rows[i - 1], b = rows[i];
      return lerp(a[1], b[1], palSmooth((u - a[0]) / Math.max(1e-4, b[0] - a[0])));
    }
  }
  return rows[rows.length - 1][1];
}
/** 0 before the roll, 2*PI after it. The one thing on this ride you cannot do. */
function palMantaRoll(u) {
  if (u < 0.32 || u > 0.58) return 0;
  return palSmooth((u - 0.32) / 0.26) * Math.PI * 2;
}

function palUpdateManta(game, dt) {
  if (!palMantaGroup) return;
  const capy = game.capy;
  const cp = capy && capy.position;
  const input = game.input;
  const riding = palMantaRideT >= 0;
  const u = riding ? clamp(palMantaRideT / palMANTA_RIDE, 0, 1) : 0;
  if (palMantaCool > 0) palMantaCool -= dt;

  // ---- where it is --------------------------------------------------------
  palMantaA += palMANTA_RATE * (riding ? palMantaKey(palMANTA_K.s, u) : 1) * dt;
  const k = riding ? palMantaKey(palMANTA_K.r, u) : 1;
  const wantY = riding ? palMantaKey(palMANTA_K.y, u) : palMANTA_Y;
  const x = palMANTA.x + Math.sin(palMantaA) * palMANTA_RX * k;
  const z = palMANTA.z + Math.cos(palMantaA) * palMANTA_RZ * k;
  // NEVER THROUGH THE SEABED. The same clamp the turtle is on, for the same
  // reason: the flight is authored against the drop-off's own profile and the
  // bommies stand two metres proud of it in places this lap goes straight over.
  const y = Math.max(wantY, palTerrain(x, z) + 2.3);
  // The heading is the tangent taken FORWARD rather than differenced backward,
  // so a change of radius does not swing the nose through the corner.
  const x2 = palMANTA.x + Math.sin(palMantaA + 0.06) * palMANTA_RX * k;
  const z2 = palMANTA.z + Math.cos(palMantaA + 0.06) * palMANTA_RZ * k;
  const yaw = Math.atan2(x2 - x, z2 - z);
  const climb = dt > 0 ? clamp((y - palMantaPos.y) / dt, -9, 9) : 0;
  const pitch = clamp(-Math.atan2(climb, 3.4), -0.95, 0.95);
  const roll = palMantaRoll(u) + Math.sin(palMantaA * 2) * 0.10;

  palMantaPos.set(x, y, z);
  palMantaGroup.position.copy(palMantaPos);
  palMantaGroup.rotation.set(pitch, yaw, roll, 'YXZ');
  // the wings beat, slowly, and faster when it means it
  const beat = Math.sin(palTime * (riding ? 1.9 : 0.9)) * (riding ? 0.20 : 0.11);
  palMantaGroup.scale.set(1, 1 + beat * 0.35, 1);

  // ---- taking hold --------------------------------------------------------
  const under = capy ? (capy.depth || 0) > 0.65 : false;
  if (!riding) {
    if (!cp) return;
    const d = Math.hypot(cp.x - x, cp.y - y, cp.z - z);
    if (!palMantaTold && d < 10 && under) {
      palMantaTold = true;
      palToast('it does not mind. take the front edge — E.');
    }
    if (d < palMANTA_REACH && under && palMantaCool <= 0 &&
        input && input.actionPressed && capy.body) {
      palMantaRideT = 0;
      palMantaBreached = false;
      palMantaCool = 0.5;
      capy.carriedBy = palMantaApi;
      palSfx('pop', { volume: 0.55, pitch: 0.7 });
      palToast('hold on. it is going somewhere.');
    }
    return;
  }

  // ---- the ride -----------------------------------------------------------
  palMantaRideT += dt;
  // The build, HELD: swell() takes the max of the live envelope, so calling it
  // every frame is the documented way to hold one across a set piece.
  if (game.music && typeof game.music.swell === 'function') {
    game.music.swell(0.22 + palSmooth(u / 0.9) * 0.30);
  }
  // ...and on the paper (W1): the ride, and what is coming at the end of it.
  if (!palMantaDone && typeof game.wowLive === 'function') {
    game.wowLive(u < 0.55 ? 'on the manta · ' + palMantaRideT.toFixed(0) + ' s · hold on'
               : u < 0.85 ? 'on the manta · it is going up'
               : 'on the manta · THE SURFACE', u);
  }
  const bail = !!(input && input.actionPressed && palMantaCool <= 0 && palMantaRideT > 1.2);

  if (capy && capy.body) {
    // PARKED, NOT SIMULATED — the same decision as the ferry's wheel and for
    // the same reason: an animal solving contacts against a wing that is being
    // rolled through a whole revolution loses the argument, and the roll is the
    // entire reason to be here. Position, velocity and the interpolation
    // history together, or the model smears off the back of it.
    palMantaOff.set(0, 0.62, -0.35);
    palEu.set(pitch, yaw, roll, 'YXZ');
    palMantaQ2.setFromEuler(palEu);
    palMantaOff.applyQuaternion(palMantaQ2);
    const b = capy.body;
    const bx = x + palMantaOff.x, bz = z + palMantaOff.z;
    b.position.set(bx, Math.max(y + palMantaOff.y, palTerrain(bx, bz) + 0.7), bz);
    b.velocity.set(0, 0, 0);
    b.angularVelocity.set(0, 0, 0);
    b.force.set(0, 0, 0);
    palSyncBody(b);
    if (capy.position) capy.position.set(b.position.x, b.position.y, b.position.z);
    if (capy.group) capy.group.position.set(b.position.x, b.position.y, b.position.z);
  }

  // ---- and then it leaves the water ---------------------------------------
  if (!palMantaBreached && u >= 0.90) {
    palMantaBreached = true;
    palSfx('splash', { volume: 1.0, pitch: 0.62, force: true });
    // M4: the manta breaching.
    if (typeof game.punch === 'function') game.punch(0.34, 0.05);
    else if (typeof game.shake === 'function') game.shake(0.34);
    if (!palMantaDone) {
      palMantaDone = true;
      palTask('the-manta');
    }
  }

  if (u >= 1 || bail) {
    palMantaRideT = -1;
    palMantaCool = 0.6;
    if (capy) capy.carriedBy = null;
    // It puts you down going the way it was going. A manta does not stop.
    //
    // THROUGH launch(), NOT A BARE VELOCITY WRITE. It is the sanctioned channel
    // for being thrown (see THE THREE WAYS TO MOVE THE CAPYBARA), and it is the
    // right one twice over here: a write straight to body.velocity is eaten by
    // the grip damper on any frame with ground contact, and launch is also what
    // clears the platform and ride state left over from having been CARRIED —
    // which is the state this line is ending. Same 1.6 m/s, same heading.
    if (capy && typeof capy.launch === 'function') {
      capy.launch(Math.sin(yaw) * 1.6, 0, Math.cos(yaw) * 1.6);
    }
    palSfx('splash', { volume: 0.5, pitch: 0.9 });
  }
}

// ============================================================== THE CLAM ====
function palBuildClam(game, root) {
  const g = new THREE.Group();
  const gy = palTerrain(palCLAM.x, palCLAM.z);
  g.position.set(palCLAM.x, gy + 0.3, palCLAM.z);

  const base = palMerger();
  base.sph(0, 0, 0, 2.6, 1.1, 2.0, PALETTE.palClam, 8);
  base.box(0, 0.25, 0, 4.6, 0.4, 3.4, PALETTE.palClamLip);
  for (let i = -2; i <= 2; i++) {
    base.box(i * 0.95, 0.35, 0, 0.34, 0.8, 3.6, PALETTE.palClam, 0, 0, 0.15 * i);
  }
  const lower = new THREE.Mesh(base.build(), palVC());
  lower.receiveShadow = true;
  g.add(lower);

  const topM = palMerger();
  topM.sph(0, 0.1, 0, 2.6, 1.2, 2.0, PALETTE.palClam, 8);
  for (let i = -2; i <= 2; i++) {
    topM.box(i * 0.95, 0.5, 0, 0.34, 0.9, 3.6, PALETTE.palClam, 0, 0, 0.15 * i);
  }
  topM.box(0, -0.15, 0, 4.4, 0.5, 3.2, PALETTE.palClamLip);
  const upper = new THREE.Mesh(topM.build(), palVC());
  upper.castShadow = true;
  upper.position.y = 0.35;
  g.add(upper);
  g.userData.lid = upper;

  // THE PEARL. Emissive, because the one thing down there that is worth having
  // has to be visible from a distance in water that is eating the light.
  const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6),
                               palGlowMat(PALETTE.palPearl, 0.85));
  pearl.position.set(0, 0.45, 0);
  pearl.visible = false;
  g.add(pearl);
  palPearl = pearl;

  root.add(g);
  palClamGroup = g;
  palStaticBox(game, palCLAM.x, gy + 0.4, palCLAM.z, 5.0, 1.2, 3.8);
}

// ============================================================== THE BANGKA ==
/**
 * The one that is actually going somewhere. Jetty to the island's foot and
 * back, on a loop, and it is a KINEMATIC body with allowSleep off — a kinematic
 * body at rest falls asleep, a sleeping body is skipped in narrowphase, and the
 * floor of a moving platform that stops existing is the single most confusing
 * bug this game has ever had.
 */
function palBuildBangka(game, root) {
  const M = palMerger();
  palHull(M, 0, 0, 0, 0, false);
  // a boatman's bench and a bilge pump, so the deck is not an empty plank
  M.box(0, 0.7, 2.2, 1.3, 0.16, 0.6, PALETTE.palBambooDk);
  M.box(0, 0.7, -1.6, 1.3, 0.16, 0.6, PALETTE.palBambooDk);
  M.cyl(0.45, 0.85, 3.2, 0.16, 0.5, PALETTE.palRope, 0, 0, 0, 6);
  // ---- AND SOMEBODY IS DRIVING IT ---------------------------------------
  // The chapter's one working boat crossed the bay forty times an hour with
  // nobody in it, past a jetty with a local standing on it saying "bangka
  // leaves when the bangka leaves" — which is a man describing a ghost ship.
  // He is merged into the hull's own group, so he rides with it for free and
  // costs nothing: a carrier's crew is part of the carrier.
  M.box(-0.45, 0.42, -3.3, 0.17, 0.62, 0.18, PALETTE.palWreckDk);
  M.box(-0.15, 0.42, -3.3, 0.17, 0.62, 0.18, PALETTE.palWreckDk);
  M.box(-0.30, 1.06, -3.3, 0.48, 0.66, 0.28, PALETTE.palBangkaTrim);
  M.box(-0.30, 1.42, -3.3, 0.26, 0.30, 0.25, PALETTE.palTrunk);
  M.box(-0.30, 1.60, -3.3, 0.46, 0.06, 0.46, PALETTE.palThatch);      // the hat
  M.box(-0.30, 1.42, -3.16, 0.05, 0.05, 0.05, PALETTE.palTrunk);      // and a nose
  // one arm out on the tiller, which is a stick on the engine and nothing else
  M.box(-0.02, 1.16, -3.20, 0.55, 0.12, 0.13, PALETTE.palBangkaTrim, 0, 0, -0.22);
  M.cyl(0.30, 1.02, -3.10, 0.05, 0.9, PALETTE.palBambooDk, 0.5, 0, 0.4, 4);
  M.box(0.42, 0.62, -3.6, 0.34, 0.42, 0.55, PALETTE.palWreckDk);      // the engine
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(M.build(), palVC());
  mesh.castShadow = true; mesh.receiveShadow = true;
  g.add(mesh);
  root.add(g);
  palBangkaGroup = g;

  const b = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC,
                              material: (game.mats && game.mats.ground) || undefined });
  // A DECK AND TWO GUNWALES. A hull is not a raft: with one flat box for a
  // floor the animal slid over the side the first time the boat turned, every
  // time. They are 40 cm — a step over, not a wall, so boarding stays a walk.
  b.addShape(new CANNON.Box(new CANNON.Vec3(1.5, 0.35, 4.6)));
  b.addShape(new CANNON.Box(new CANNON.Vec3(0.12, 0.20, 4.6)), new CANNON.Vec3(1.38, 0.52, 0));
  b.addShape(new CANNON.Box(new CANNON.Vec3(0.12, 0.20, 4.6)), new CANNON.Vec3(-1.38, 0.52, 0));
  b.addShape(new CANNON.Box(new CANNON.Vec3(1.5, 0.20, 0.12)), new CANNON.Vec3(0, 0.52, 4.48));
  b.addShape(new CANNON.Box(new CANNON.Vec3(1.5, 0.20, 0.12)), new CANNON.Vec3(0, 0.52, -4.48));
  b.allowSleep = false;
  b.position.set(palJETTY.x - 2.6, 0.55, palJETTY.z0 + 2);
  palSyncBody(b);
  game.world.addBody(b);
  palBangkaBody = b;
}

const palBANGKA_A = { x: palJETTY.x - 2.6, z: palJETTY.z0 + 2 };
const palBANGKA_B = { x: palFOOT.x - 2, z: palFOOT.z + 8 };
// SLOWER THAN A CAPYBARA CAN SWIM, and that is the whole of the number: a
// paddling capybara does 2.6 and a diving one 3.1, so at 2.4 the boat can
// always be caught. It waits eleven seconds at each end, which is long enough
// to walk the length of the jetty and step aboard without hurrying.
const palBANGKA_SPEED = 2.4;
const palBANGKA_WAIT = 11.0;
const palBANGKA_YAW = Math.atan2(palBANGKA_B.x - palBANGKA_A.x, palBANGKA_B.z - palBANGKA_A.z);

function palUpdateBangka(game, dt) {
  if (!palBangkaBody) return;
const total = Math.hypot(palBANGKA_B.x - palBANGKA_A.x, palBANGKA_B.z - palBANGKA_A.z);
  palBangkaT = clamp(palBangkaT + palBangkaDir * (palBANGKA_SPEED / total) * dt, 0, 1);
  // A BOAT WAITS AT BOTH ENDS, and it has to: the ride is a task, the player
  // has to be able to walk down a jetty and get on, and a boat that turns round
  // the instant it touches is a boat you chase for the whole chapter.
  if (palBangkaT >= 1 && palBangkaDir > 0) {
    palBangkaHold += dt;
    if (palBangkaHold > palBANGKA_WAIT) { palBangkaDir = -1; palBangkaHold = 0; }
  } else if (palBangkaT <= 0 && palBangkaDir < 0) {
    palBangkaHold += dt;
    if (palBangkaHold > palBANGKA_WAIT) { palBangkaDir = 1; palBangkaHold = 0; }
  }
  const e = palSmooth(palBangkaT);
  const x = lerp(palBANGKA_A.x, palBANGKA_B.x, e);
  const z = lerp(palBANGKA_A.z, palBANGKA_B.z, e);
  const inv = dt > 1e-5 ? 1 / dt : 60;
  // THE VELOCITY COMES FROM THE TARGET, NOT FROM THE BODY.
  //
  // cannon integrates KINEMATIC bodies by their own velocity inside world.step,
  // which runs before every module update — so `(x - body.position.x)` is not
  // the distance still to travel, it is the distance the LAST velocity already
  // carried the body, and deriving the next velocity from it flips the sign
  // every frame. On a boat holding at the end of its run that is a dead-still
  // hull reporting +v, -v, +v on alternate frames for ever, and that is the
  // number capybara.js solves the deck's frame against — so the passenger is
  // shaken about exactly while the boat is stopped and boarding.
  //
  // Differencing the TARGET against the PREVIOUS TARGET is exact at every speed
  // and is honestly zero when the boat is not moving.
  palBangkaBody.velocity.set((x - palBangkaPX) * inv, 0, (z - palBangkaPZ) * inv);
  palBangkaPX = x; palBangkaPZ = z;
  palBangkaBody.position.set(x, 0.55, z);

  const yaw = palBANGKA_YAW + (palBangkaDir > 0 ? 0 : Math.PI);
  palBangkaBody.quaternion.setFromEuler(0, yaw, 0);
  // The one direct body write in this file that was not paired with its own
  // helper. Every equivalent carrier in the game pairs them — gorSyncBody,
  // rioSyncBody, sahSyncBody, panSyncBody, cavSyncBody, manSyncBody — and the
  // bangka's own build at palBuildBangka does too. It has been masked because
  // the boat is DRAWN from palBangkaGroup rather than from the body, so the
  // smear had nothing to smear; but the yaw above flips 180 degrees at each
  // berth with interpolatedQuaternion left on the old heading, and anything
  // that starts reading this body's interpolated transform inherits it.
  palSyncBody(palBangkaBody);
  if (palBangkaGroup) {
    palBangkaGroup.position.set(x, 0.55 + Math.sin(palTime * 1.4) * 0.06, z);
    palBangkaGroup.rotation.y = yaw;
    palBangkaGroup.rotation.z = Math.sin(palTime * 0.9) * 0.035;
  }
  // ---- the ride ----------------------------------------------------------
  // IN THE HULL'S OWN FRAME. The route runs at 2.7 radians to the world axes,
  // so an axis-aligned box around the boat is a test of a rectangle that is not
  // the boat: it was three metres wide across the beam and eleven along it, in
  // the wrong directions.
  const capy = game.capy;
  if (!capy || !capy.position) return;
  const p = capy.position;
  // A RADIUS AND A HEIGHT, not a rectangle in the hull's frame. The rectangle
  // was correct geometry and a bad test: the animal slides fore and aft as the
  // boat accelerates, and it read aboard on only 23% of the frames of a ride it
  // never once fell off — so the task could not be completed by doing it. What
  // actually distinguishes standing on the deck from swimming alongside is the
  // HEIGHT (deck 0.90, waterline 0.00), and that is one comparison.
  // 5.4 m REACHED THE JETTY. The hull is 3 m in the beam and the deck sits
  // 1.4 m off the end of the jetty at berth A, so a circle this wide declared
  // an animal standing still on solid planking to be aboard — and carryFrame()
  // OVERRIDES the sniffed contact frame, so it was dragged along the boat's
  // course and skated off the boards as she pulled out. Tight enough to be the
  // boat, and high enough to be the deck rather than the water beside it.
  const aboard = Math.hypot(p.x - x, p.z - z) < 2.6 && p.y > 0.75 && p.y < 3.2;

  // THE FRAME IS DECLARED, NOT SNIFFED — see capyCarryAt. A deck that is being
  // driven under a standing animal barely penetrates it, and a contact that is
  // barely there is a contact that is sometimes not there.
  palCarrying = aboard;
  if (aboard) { palCarry.x = palBangkaBody.velocity.x; palCarry.z = palBangkaBody.velocity.z; }
  if (aboard) {
    palBangkaOff = 0;
    if (palBangkaRideT === 0) palBangkaFrom = palBangkaT;
    palBangkaRideT += dt;
    if (!palRideDone && Math.abs(palBangkaT - palBangkaFrom) > 0.72) {
      palRideDone = true;
      palTask('outrigger');
      palSaysNow('boatman',
        ['You sat at the front. Good. Everybody sits at the back and gets wet.',
         'Same crossing, eleven thousand times. Still the same crossing.',
         'Next one is when the next one is.'],
        ['Ho! Not on my boat.']);
      palToast('a bangka: bamboo outriggers and a lawnmower engine. it is enough.');
      palSfx('pop', { volume: 0.8, pitch: 1.1 });
    }
  } else if (palBangkaRideT > 0) {
    // A BOUNCE IS NOT GETTING OFF. Half a second of grace, or a hop on the deck
    // restarts the ride and a nineteen-second crossing can never be finished.
    palBangkaOff += dt;
    if (palBangkaOff > 0.5) { palBangkaRideT = 0; palBangkaOff = 0; }
  }
}

// =============================================================== THE WATER ==
/**
 * ONE SURFACE, SEEN FROM BOTH SIDES.
 *
 * DoubleSide and half transparent, because for the first time in this game the
 * player will spend most of a chapter looking UP through it. Vertex-coloured by
 * the depth underneath so the famous gradient — white sand, then jade, then
 * teal, then nothing — is in the water rather than in a fog setting, and so it
 * survives the camera going under, where fog cannot help.
 */
function palBuildWater(root) {
  // 62 x 74 WARPED, NOT 74 x 88 FLAT. The sheet is dead level and carries
  // nothing but a colour ramp, and a uniform 4 m grid over three hundred by
  // three sixty spends two thirds of its thirteen thousand triangles out on the
  // abyssal plain where the colour is one number — while the gradient that
  // actually matters, the jade-to-teal over the reef and the drop-off, gets the
  // same four metres as the emptiness does. palWarp is already here and this is
  // exactly what it is for: 2.6 m cells through the middle, finer than the grid
  // it replaces, 8 m at the edge, and four thousand triangles back.
  const g = new THREE.PlaneGeometry(300, 360, 56, 68);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, -60);
  const p = g.attributes.position.array;
  for (let i = 0; i < p.length; i += 3) {
    p[i] = palWarp(p[i], 150);
    p[i + 2] = palWarp(p[i + 2] + 60, 180) - 60;
  }
  const col = new Float32Array(p.length);
  const shallow = new THREE.Color(PALETTE.palShallow);
  const mid = new THREE.Color(PALETTE.palMid);
  const deep = new THREE.Color(PALETTE.palDeep);
  for (let i = 0; i < p.length; i += 3) {
    const d = palWATER - palTerrain(p[i], p[i + 2]);
    palCol.copy(shallow);
    if (d > 3) palCol.lerp(mid, clamp((d - 3) / 5, 0, 1));
    if (d > 7) palCol.lerp(deep, clamp((d - 7) / 6, 0, 1));
    col[i] = palCol.r; col[i + 1] = palCol.g; col[i + 2] = palCol.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  // GLITTER, NOT WAVES. The mesh already has a ripple written into it and you
  // cannot see it from six metres up at 41 degrees; what makes water read as
  // water from there is a sparse field of moving points far brighter than the
  // surface. It costs four hash calls and it is the difference between a sea
  // and a sheet of coloured card. See grain() in shared.js.
  // grainOwn, NOT grain: the bloom writes an emissive term onto this material
  // every frame now, and grain() hands back a CACHED clone keyed on the source
  // material's uuid — which mat() itself caches by colour and options. Two
  // chapters that happen to ask for the same transparent white would get the
  // same object, and Palawan's plankton would light up somebody else's sea.
  const m = new THREE.Mesh(g, grainOwn(mat(0xffffff, {
    // 0.45, NOT 0.58. The surface has two jobs and they pull against each
    // other: from above it has to LOOK like water, and it has to let the reef
    // through clearly enough to be worth diving to. At 0.58 the coral read as
    // grey plates and there was no reason to go and look.
    vertexColors: true, transparent: true, opacity: 0.45,
    side: THREE.DoubleSide, depthWrite: false,
  }), { scale: 0.4, amount: 0.05, warp: 0,
        sparkle: 1.25, sparkleScale: 1.25, sparkleSpeed: 0.30, sparkleCut: 0.65, fresnel: 0.55,
        sparkleColor: PALETTE.palShallow }));
  m.position.y = palWATER;
  m.frustumCulled = false;
  m.name = 'palWater';
  m.renderOrder = 2;
  root.add(m);
  palWaterMesh = m;
}

// ============================================================ THE CAUSTICS ==
/**
 * THE SUN, ON THE FLOOR.
 *
 * The whole argument of this chapter is that the interesting half is
 * underneath, and for its entire life the seabed was a flat wash of two
 * colours with a distance fog over it. What is actually down there — the one
 * thing everybody who has ever put their head under warm shallow water
 * remembers — is the NET: the surface acts as a lens, and a moving web of
 * light crawls over the sand at the speed of the ripples above it.
 *
 * IT IS NOT THE SPARKLE, AND THAT COST AN EVENING TO FIND OUT.
 *
 * The first build used `grain()`'s sparkle on an additive sheet, on the theory
 * that glitter on a surface and a caustic on the floor under it are the same
 * function one storey down. They are not. Sparkle is two multiplied value
 * noises through a NARROW ramp: it is tuned to produce a few isolated points
 * far brighter than everything round them, which is what a specular highlight
 * is — and a caustic is the opposite shape, a continuous interlocking WEB with
 * dark holes in it. Measured on the reef: at the strength that made the net
 * visible the whole seabed went under a sheet of milk, and at the strength
 * that did not, there was nothing there at all.
 *
 * So it is written directly into the vertex ALPHA, once a frame, in JS.
 *
 *   ridge(u) = 1 - |sin(u)|      is a hard bright line every pi
 *   three of them, crossing at three different bearings and drifting at three
 *   different speeds, multiplied together and raised to a power
 *
 * The product of ridges is bright ONLY where all three lines cross, which is a
 * lattice of sharp cells with dark middles — a caustic. Three sines a vertex
 * over three thousand vertices is a fifth of what the Manly surf mesh does
 * every frame for the same money.
 *
 * THREE THINGS IT HAS TO DO OR IT IS A BUG, all baked into the alpha at build:
 *   1. DIE WITH DEPTH. Light is gone by about eight metres and a bright net on
 *      the abyssal plain would be a torch nobody is holding.
 *   2. STOP AT THE WATERLINE. Additive light on dry sand is a lens flare.
 *   3. NEVER GO IN THE CATHEDRAL. It is a roofed room with one hole in it and
 *      the shaft is the entire point of the place; a floor lit all over would
 *      throw away the chapter's best picture.
 */
const palCAUS = [
  // x0, x1, z0, z1, nx, nz — the reef flat, and the hidden lagoon
  // 52 x 30, NOT 66 x 38. The note below sets the wavelength from the VERTEX
  // SPACING and asks for four to six samples a cycle over a 7-10 m period; at
  // 1.77 m cells that is four to five and a half, which is inside it, and the
  // sheet gives back nineteen hundred triangles the chapter has better uses for.
  [-46, 46, -22, 27, 52, 30],
  [palLAG.x - 24, palLAG.x + 24, palLAG.z - 24, palLAG.z + 24, 26, 26],
];
let palCausMeshes = [];
function palBuildCaustics(root) {
  palCausMeshes = [];
  for (let s = 0; s < palCAUS.length; s++) {
    const C = palCAUS[s];
    const g = new THREE.PlaneGeometry(C[1] - C[0], C[3] - C[2], C[4], C[5]);
    g.rotateX(-Math.PI / 2);
    g.translate((C[0] + C[1]) * 0.5, 0, (C[2] + C[3]) * 0.5);
    const p = g.attributes.position.array;
    // FOUR COMPONENTS, AND THE FOURTH ONE IS THE WHOLE POINT.
    //
    // An `itemSize: 4` colour attribute makes three define USE_COLOR_ALPHA and
    // multiply `diffuseColor.a` as well as its rgb — and under additive
    // blending the source alpha scales the entire fragment. So one attribute
    // carries both the tint (which never changes) and the net (which changes
    // every frame), and only the alpha is ever rewritten.
    const col = new Float32Array((p.length / 3) * 4);
    const mask = new Float32Array(p.length / 3);
    for (let i = 0, c = 0, k4 = 0; i < p.length; i += 3, c += 4, k4++) {
      const x = p[i], z = p[i + 2];
      const h = palTerrain(x, z);
      // 9 cm off the floor: far enough not to z-fight the seabed, close enough
      // that the net is ON it rather than hanging over it.
      p[i + 1] = h + 0.09;
      const d = palWATER - h;
      // rule 2, then rule 1 — the roll-off starts at four and a half metres,
      // because the red end of the light has gone by then and the net with it
      // 6.5 AND 9, NOT 4.5 AND 7.5. The tutorial bommie is at 4.5 m, the drop
      // -off lip at 7 and the whole of the reef flat's far half between them —
      // so the net was already three quarters gone at the depth this chapter is
      // MOSTLY PLAYED AT, and gone entirely by the wreck. Measured off the reef
      // frame: the seabed under the dive camera had no net on it at all, which
      // is the one thing the sheet exists to put there. Light in that water is
      // good to about ten metres; it is the RED that goes at eight, and a
      // caustic is not red.
      let k = clamp((d - 0.35) / 1.1, 0, 1) * clamp(1 - (d - 6.5) / 9.0, 0, 1);
      // rule 3: the tunnel and the cathedral are roofed
      if (z < palTUN.z1 + 2) k = 0;
      // ...and the crack is roofed for most of its length
      if (z > palCRACK.z0 - 1 && z < palCRACK.z1 + 1 &&
          Math.abs(x - palCRACK.x) < palCRACK.hw + 5) k *= 0.25;
      // and the sheet has to die at its own edges or it ends in a straight line
      k *= clamp((x - C[0]) / 8, 0, 1) * clamp((C[1] - x) / 8, 0, 1) *
           clamp((z - C[2]) / 8, 0, 1) * clamp((C[3] - z) / 8, 0, 1);
      mask[k4] = k;
      palCol.set(PALETTE.palShallow);
      col[c] = palCol.r; col[c + 1] = palCol.g; col[c + 2] = palCol.b;
      col[c + 3] = 0;
    }
    const ca = new THREE.BufferAttribute(col, 4);
    ca.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('color', ca);
    g.computeVertexNormals();
    // MeshBasicMaterial, and additive: a caustic is LIGHT. A Lambert net on a
    // seabed eleven metres down is lit by the ambient and by nothing else,
    // which is the same lesson Hong Kong's neon and Venice's arcade lamps both
    // paid for.
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: 1.05,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: true,
    }));
    m.frustumCulled = false;
    m.renderOrder = 1;                 // under the water sheet, over the floor
    m.name = 'palCaustics';
    root.add(m);
    palCausMeshes.push({ mesh: m, attr: ca, mask: mask, pos: g.attributes.position });
  }
}
/** 1 - |sin| : a bright line every pi, and the only ingredient in the net. */
function palRidge(u) { const s = Math.sin(u); return 1 - (s < 0 ? -s : s); }
function palUpdateCaustics(dt) {
  if (!palCausMeshes.length) return;
  const t = palTime;
  // THE THREE BEARINGS ARE NOT MULTIPLES OF EACH OTHER. Three families at
  // 0, 62 and 121 degrees give a lattice with no repeating axis in it; three
  // at 0, 60 and 120 give a perfect hexagonal tiling, which reads as wallpaper.
  const a1c = 1.000, a1s = 0.000;
  const a2c = 0.469, a2s = 0.883;
  const a3c = -0.515, a3s = 0.857;
  for (let s = 0; s < palCausMeshes.length; s++) {
    const C = palCausMeshes[s];
    const pa = C.pos.array, ca = C.attr.array, mk = C.mask;
    for (let i = 0, c = 0, k = 0; i < pa.length; i += 3, c += 4, k++) {
      const m = mk[k];
      if (m <= 0.001) { ca[c + 3] = 0; continue; }
      const x = pa[i], z = pa[i + 2];
      // THE WAVELENGTHS ARE SET BY THE VERTEX SPACING, NOT BY TASTE. The cells
      // are 1.7 m; a ridge family at k = 0.62 has a period of 5.1 m, which is
      // three samples a cycle, and a lattice sampled three times a cycle is
      // not a lattice, it is noise. Seven to ten metres gives four to six
      // samples and Gouraud does the rest — which is also the size a real
      // caustic cell is under three or four metres of water.
      const r1 = palRidge((x * a1c + z * a1s) * 0.55 + t * 0.62);
      const r2 = palRidge((x * a2c + z * a2s) * 0.48 - t * 0.47);
      const r3 = palRidge((x * a3c + z * a3s) * 0.41 + t * 0.34);
      // SUM, NOT PRODUCT. The first cut multiplied the three ridges and raised
      // the result to the fourth power, which is the right shape for a razor
      // and the wrong shape for anything a vertex can sample: mean 0.048 to
      // the fourth is five parts in a million, so the entire net measured as
      // zero and the seabed was flat in every screenshot. Summed and then
      // thresholded is bright where two or three lines happen to cross and
      // dark between, which is the picture.
      let v = (r1 + r2 + r3) * 0.3333;
      v = clamp((v - 0.395) / 0.40, 0, 1);
      v = v * v * (3 - 2 * v);
      // and the whole field breathes, because a real one is being driven by a
      // swell that is itself going up and down
      ca[c + 3] = m * v * (1.15 + Math.sin(t * 0.7 + x * 0.05) * 0.28);
    }
    C.attr.needsUpdate = true;
    // ---- AND WHEN THE BLOOM COMES IN, THE FLOOR COMES WITH IT -------------
    // The marquee lit two hundred and forty motes and nothing else, so the
    // biggest event in the chapter changed a cloud of specks and left the
    // seabed exactly the colour it had been all afternoon. A bloom is IN the
    // water, so everything the water is lighting goes with it: the net turns
    // from sunlight to plankton over the same four seconds the motes do, and
    // it is one material colour per sheet rather than a vertex rewrite.
    const mtl = C.mesh.material;
    palCol.set(0xffffff).lerp(palBloomC, palBloom * 0.85);
    mtl.color.copy(palCol);
    mtl.opacity = 1.05 + palBloom * 0.55;
  }
}
const palBloomC = new THREE.Color(PALETTE.palBloom);
// what is hanging in that water when nothing is glowing in it — see palUpdateBloom
const palSiltC = new THREE.Color(PALETTE.palPearl);

/**
 * THE LIGHT COMING DOWN, AND IT IS THE BEST PICTURE IN THE CHAPTER.
 *
 * Five of them: three over the hidden lagoon, one down the hole in the
 * cathedral's roof, one over the reef.
 *
 * IT WAS ONE SEVEN-SIDED CONE AND IT PHOTOGRAPHED AS A PANE OF GLASS. Measured
 * off the cathedral frame, which is the shot this whole chapter is built toward:
 * a hard-edged grey triangle standing in a dark room, with a visible straight
 * line down each side and a visible facet across the middle. Three things were
 * wrong with it and they are the same three the Drift's light columns paid for:
 *
 *   ONE SHELL AT ONE OPACITY IS A SOLID. However faint you make it, a single
 *   translucent surface has exactly one value, so its silhouette is an EDGE —
 *   and an edge is the one thing a beam of light in water does not have. FIVE
 *   nested shells on a squared ramp: the total through the middle is what it
 *   always was and the step at the rim is a fifth of it, which is the whole of
 *   the trick and it is the same note as the Drift's columns and Venice's
 *   arcade lamps.
 *
 *   SEVEN SIDES IS A POLYGON. At six metres across and five metres from the
 *   lens you can count them. Fourteen, and the outer shells get fewer, because
 *   nobody has ever resolved the silhouette of the faintest thing in the frame.
 *
 *   AND LIGHT LANDS ON SOMETHING. A shaft with no pool at the bottom of it is a
 *   cone hanging in a room. The bank of white sand under the cathedral's hole is
 *   the one bright object down there and the light was going straight through
 *   it; there is an additive disc on the floor of every shaft now, breathing on
 *   the same clock as the shaft above it.
 */
function palBuildShafts(root) {
  palShaftMats = [];
  // x, z, radius, height, opacity, TOP — and the top is the fifth thing that
  // had to be said out loud.
  //
  // Every shaft used to be centred at `height/2 - 9`, which put its top
  // wherever the arithmetic landed. Two of them landed wrong and in opposite
  // directions: the one over the REEF ran from -9 to +5, so five metres of
  // glowing god-ray stood in the open air over the bay and could be seen from
  // the beach; and the one down the CATHEDRAL's hole topped out at y = 18
  // under a hole in the roof at y = 26.2, so the chapter's best picture — the
  // one shaft of light coming down the one hole — had an eight-metre gap
  // between the light and the hole it is supposed to be coming through.
  const shafts = [
    [palLAG.x - 7, palLAG.z + 5, 5.5, 34, 0.11, 25],
    [palLAG.x + 6, palLAG.z - 7, 4.2, 34, 0.09, 25],
    [palLAG.x + 1, palLAG.z + 12, 3.4, 32, 0.07, 23],
    [palHOLE.x, palHOLE.z, palHOLE.r * 1.25, palCATH.dome + 10, 0.20, palCATH.dome + 1.4],
    [palREEF.x, palREEF.z, 6.5, 11, 0.06, palWATER],
  ];
  // FIVE SHELLS ON A SQUARED RAMP. The radii step outward and the opacities
  // step down as the square of the step, so the sum through the axis is about
  // what a single shell at the table's own opacity used to be and the outermost
  // one — the only one whose silhouette anybody can see — is worth a twentieth.
  const SH = [[1.00, 1.00, 14], [1.22, 0.42, 12], [1.50, 0.17, 10],
              [1.86, 0.062, 9], [2.30, 0.020, 7]];
  for (let i = 0; i < shafts.length; i++) {
    const s = shafts[i];
    for (let k = 0; k < SH.length; k++) {
      const mtl = palGlowMat(PALETTE.palShaft, 0.5, s[4] * SH[k][1]);
      mtl.side = THREE.DoubleSide;
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(s[2] * SH[k][0], s[3], SH[k][2], 1, true), mtl);
      // A CONE IS ALREADY THE RIGHT WAY UP for this: three.js puts the apex at
      // +y, so untouched it is narrow at the surface and wide on the seabed,
      // which is what a shaft of light through moving water actually looks like.
      cone.position.set(s[0], s[5] - s[3] * 0.5, s[1]);
      cone.renderOrder = 3;
      cone.name = 'palShaft';
      root.add(cone);
      palShaftMats.push(mtl);
    }
    // ---- and it LANDS -----------------------------------------------------
    // A disc on the floor under the shaft, additive, at the radius the cone has
    // got to by the time it arrives. Sixteen sides, not eight: this is the one
    // pool in the chapter the player swims through the middle of, and a polygon
    // edge on a puddle of light is the Drift's lesson and Mong Kok's before it.
    {
      const fy = palTerrain(s[0], s[1]) + 0.12;
      const pr = s[2] * (1 + (s[5] - fy) / Math.max(1, s[3]) * 0.7);
      const g = new THREE.CircleGeometry(pr, 16);
      g.rotateX(-Math.PI / 2);
      const pm = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
        color: PALETTE.palShaft, transparent: true, opacity: s[4] * 1.9,
        depthWrite: false, blending: THREE.AdditiveBlending, fog: true,
      }));
      pm.position.set(s[0], fy, s[1]);
      pm.renderOrder = 2;
      pm.name = 'palShaftPool';
      root.add(pm);
      pm.material.userData.base = s[4] * 1.9;
      palShaftPools.push(pm.material);
    }
  }
}

// =============================================================== THE BLOOM ==
/**
 * THE MARQUEE, AND THE ONLY REASON TO BUILD AN EMISSIVE MATERIAL IN A CHAPTER
 * SET AT NOON.
 *
 * Two hundred and forty motes in one instanced mesh. They drift, and any mote
 * that gets further than forty metres from the animal is respawned near it —
 * which is not a cheat, it is the only way a fixed budget of particles can make
 * a whole bay light up. The effect the player reads is "it is happening where I
 * am", and it is happening where they are because that is where it is drawn.
 */
function palBuildBloom(root) {
  palMoteData = new Float32Array(palMOTE_N * 6);   // x,y,z, vx,vy,vz
  for (let i = 0; i < palMOTE_N; i++) {
    const o = i * 6;
    palMoteData[o] = rand(-40, 40);
    palMoteData[o + 1] = rand(-9, -0.4);
    palMoteData[o + 2] = rand(-30, 30);
    palMoteData[o + 3] = rand(-0.25, 0.25);
    palMoteData[o + 4] = rand(-0.1, 0.1);
    palMoteData[o + 5] = rand(-0.25, 0.25);
  }
  palMoteMat = palGlowMat(PALETTE.palBloom, 1.0, 0.9);
  const m = new THREE.InstancedMesh(new THREE.SphereGeometry(0.065, 5, 3), palMoteMat, palMOTE_N);
  m.frustumCulled = false;
  m.renderOrder = 4;
  m.visible = false;
  root.add(m);
  palMoteMesh = m;
}
function palUpdateBloom(game, dt) {
  if (!palMoteMesh) return;
  // ---- AND THEY ARE THERE WHEN THE BLOOM IS NOT ------------------------
  // THE WATER ITSELF WAS EMPTY. The dive camera looks nearly level, so most of
  // this chapter is a view ACROSS the bay rather than down at it — and across
  // the bay, past the reef, there is nothing at all: a flat wash of one blue
  // with a hard seabed horizon across the middle of it and no way to tell three
  // metres of water from thirty. Real water is full of MARINE SNOW, and it is
  // the only depth cue a diver has: motes drifting past at a metre away and
  // motes you cannot resolve at ten, all of them moving with you.
  //
  // Which is the same two hundred and forty particles the bloom already owns.
  // Out of bloom they are a fifth the size and a fifteenth the brightness —
  // suspended silt, not plankton — and when the bloom arrives the SAME field
  // lights up and swells, so the marquee is the water you have been swimming
  // through all along turning on rather than a new object appearing. No
  // geometry, no draw call, no allocation: two numbers.
  const on = true;
  palMoteMesh.visible = true;
  const capy = game.capy;
  const cx = capy && capy.position ? capy.position.x : 0;
  const cy = capy && capy.position ? capy.position.y : -3;
  const cz = capy && capy.position ? capy.position.z : 0;
  // The animal's own wake: motes near it are pushed, and pushed motes are
  // brighter, which is what makes a stroke leave a trail rather than a smudge.
  const stir = capy && capy.velocity
             ? Math.hypot(capy.velocity.x || 0, capy.velocity.z || 0) : 0;
  // ---- AND THE MANTA STIRS IT TOO (D4.2) ---------------------------------
  // The marine snow was moved by exactly one thing in the bay: the capybara.
  // A two-and-a-half metre animal crossing the same water at cruise left no
  // mark on it at all — and she is the chapter's marquee now, so the one
  // moment the chapter is FOR happened in water that did not notice her.
  //
  // The same term, from a second source. Nothing new is allocated and no new
  // draw call: this is the loop that was already writing all two hundred and
  // forty motes, and the second source is a position and a speed the manta
  // publishes anyway. Her reach is wider than the animal's because she is,
  // and her wake is what a rider is inside.
  const mg = palMantaGroup;
  const mx = mg ? mg.position.x : 0, my = mg ? mg.position.y : 0, mz = mg ? mg.position.z : 0;
  // she is never still, so the speed term is her own cruise rather than a
  // differenced velocity nothing else needs
  const mStir = mg ? palMANTA_STIR : 0;
  const scale = 0.16 + palBloom * 1.28;
  for (let i = 0; i < palMOTE_N; i++) {
    const o = i * 6;
    let x = palMoteData[o] + palMoteData[o + 3] * dt;
    let y = palMoteData[o + 1] + palMoteData[o + 4] * dt;
    let z = palMoteData[o + 2] + palMoteData[o + 5] * dt;
    const dx = x - cx, dz = z - cz, dy = y - cy;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > 1600) {
      // too far to be seen: put it back where the player is, at a believable
      // depth for wherever that is
      const a = rand(0, Math.PI * 2), r = rand(3, 26);
      x = cx + Math.sin(a) * r;
      z = cz + Math.cos(a) * r;
      const bed = palTerrain(x, z);
      y = clamp(rand(bed + 0.5, palWATER - 0.3), bed + 0.3, palWATER - 0.2);
      palMoteData[o + 3] = rand(-0.25, 0.25);
      palMoteData[o + 4] = rand(-0.1, 0.1);
      palMoteData[o + 5] = rand(-0.25, 0.25);
    } else if (d2 < 12 && stir > 0.5) {
      const inv = 1 / Math.sqrt(d2 + 0.05);
      palMoteData[o + 3] += dx * inv * stir * 0.9 * dt;
      palMoteData[o + 5] += dz * inv * stir * 0.9 * dt;
    }
    // D4.2: and again for the manta, on her own radius. Written after the
    // capybara term rather than instead of it, so a rider stirs the water
    // twice — which is exactly what being on her back is.
    if (mStir > 0) {
      const ex = x - mx, ey = y - my, ez = z - mz;
      const e2 = ex * ex + ey * ey + ez * ez;
      if (e2 < palMANTA_STIR_R2) {
        const inv2 = 1 / Math.sqrt(e2 + 0.05);
        palMoteData[o + 3] += ex * inv2 * mStir * dt;
        palMoteData[o + 5] += ez * inv2 * mStir * dt;
        palMoteData[o + 4] += ey * inv2 * mStir * 0.35 * dt;
      }
    }
    const bed = palTerrain(x, z);
    if (y < bed + 0.2) { y = bed + 0.2; palMoteData[o + 4] = Math.abs(palMoteData[o + 4]); }
    if (y > palWATER - 0.15) { y = palWATER - 0.15; palMoteData[o + 4] = -Math.abs(palMoteData[o + 4]); }
    palMoteData[o] = x; palMoteData[o + 1] = y; palMoteData[o + 2] = z;
    palMoteData[o + 3] *= 0.995; palMoteData[o + 5] *= 0.995;
    const tw = 0.6 + 0.4 * Math.sin(palTime * 3.1 + i * 1.7);
    // ---- AND THE SHELL FROM A WHEEK RUNS THROUGH THEM -------------------
    // See THE WHEEK, UNDER at the bottom of this file. It is one function call
    // and one multiply in a loop that was already writing all two hundred and
    // forty matrices, and it costs nothing at all when nobody has wheeked:
    // palWheekAt returns a hard zero while palWheekT is -1.
    //
    // It multiplies rather than adds, so a shell crossing the dark bay lights
    // silt faintly and a shell crossing the bloom is a wall of green — which is
    // the right relationship. The plankton were always there; the wheek does
    // not create them, it disturbs them.
    // 3.2, NOT 4.2. Measured off the rendered frame with the shell passing the
    // camera: a mote is a five-by-three sphere, which is a hexagon, and at 4.2x
    // in bloom the nearest ones resolve to half-metre hexagons — recognisable
    // polygons rather than points of light, which is the one thing a glow may
    // not become. At 3.2 the wave is just as legible across the bay and the
    // near ones stay blobs.
    const shk = palWheekAt(x, y, z);
    const s = scale * tw * (1 + shk * 3.2);
    palMoteMesh.setMatrixAt(i, palXform(x, y, z, 0, 0, 0, s, s, s));
  }
  palMoteMesh.instanceMatrix.needsUpdate = true;
  if (palMoteMat) {
    emitSet(palMoteMat, 0.10 + palBloom * 2.1);
    palMoteMat.opacity = 0.32 + palBloom * 0.58;
    // and silt is not plankton-coloured until the plankton arrives
    palMoteMat.color.copy(palSiltC).lerp(palBloomC, palBloom);
    palMoteMat.emissive.copy(palSiltC).lerp(palBloomC, palBloom);
  }
}

// ============================================================== THE BREATH ==
/**
 * A DIVING ANIMAL LEAVES BUBBLES, AND FOR THE WHOLE LIFE OF THIS CHAPTER IT
 * DID NOT.
 *
 * This is the one place in the game where the player spends minutes at a time
 * looking at the animal from underneath, and there was no evidence anywhere in
 * the frame that it was holding its breath — the only reading of the chapter's
 * central resource was a bar in the corner of the HUD. Bubbles are the same
 * information IN THE WORLD, and they are better information than the bar,
 * because they get FASTER as the breath runs out: a capybara with a full tank
 * lets one go every second and a half, and one that is nearly out is streaming.
 *
 * Sixty spheres, one instanced mesh, no per-frame allocation. They rise at
 * about a third of a metre a second, they WOBBLE (a bubble is not a bullet),
 * they get bigger on the way up because the pressure drops, and they stop at
 * the surface rather than flying out of it.
 *
 * AND THEY ARE THE MARQUEE'S SECOND HALF. During the bloom the plankton
 * lights up wherever the water is disturbed, so the bubbles carry the glow
 * with them — a column of light going up behind the animal, which is a thing
 * that happens in that bay and is the best picture in the chapter.
 */
const palBUB_N = 60;
let palBubMesh = null, palBubData = null, palBubMat = null;
let palBubNext = 0, palBubT = 0;
function palBuildBubbles(root) {
  palBubData = new Float32Array(palBUB_N * 5);      // x, y, z, t, seed
  for (let i = 0; i < palBUB_N; i++) palBubData[i * 5 + 3] = -1;
  palBubMat = mat(PALETTE.palPearl, {
    transparent: true, opacity: 0.55, depthWrite: false,
    emissive: PALETTE.palPearl, emissiveIntensity: 0.25,
  }).clone();
  palBubMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 6, 4), palBubMat, palBUB_N);
  palBubMesh.frustumCulled = false;
  palBubMesh.renderOrder = 3;
  palBubMesh.name = 'palBubbles';
  root.add(palBubMesh);
}
function palUpdateBubbles(game, dt) {
  if (!palBubMesh) return;
  palBubT += dt;
  const capy = game.capy;
  const depth = capy ? (capy.depth || 0) : 0;
  // THE RATE IS THE BREATH. capybara.js publishes the stamina bar and the dive
  // spends it, so a low bar is an animal that is running out — and a stream of
  // bubbles is what running out looks like from outside.
  if (capy && capy.position && depth > 0.45) {
    const stam = capy.stamina === undefined ? 1 : capy.stamina;
    const gap = lerp(0.16, 1.4, clamp(stam, 0, 1));
    if (palBubT > gap) {
      palBubT = 0;
      const n = stam < 0.3 ? 3 : 1;
      for (let k = 0; k < n; k++) {
        const i = palBubNext = (palBubNext + 1) % palBUB_N;
        const o = i * 5;
        // off the nose, which is where they come from
        const yaw = capy.group ? capy.group.rotation.y : 0;
        palBubData[o] = capy.position.x + Math.sin(yaw) * 0.55 + rand(-0.12, 0.12);
        palBubData[o + 1] = capy.position.y + 0.22 + rand(-0.05, 0.05);
        palBubData[o + 2] = capy.position.z + Math.cos(yaw) * 0.55 + rand(-0.12, 0.12);
        palBubData[o + 3] = 0;
        palBubData[o + 4] = rand(0, 6.28);
      }
    }
  }
  let live = 0;
  for (let i = 0; i < palBUB_N; i++) {
    const o = i * 5;
    if (palBubData[o + 3] < 0) { palM.makeScale(0, 0, 0); palM.setPosition(0, -900, 0);
                                 palBubMesh.setMatrixAt(i, palM); continue; }
    palBubData[o + 3] += dt;
    const t = palBubData[o + 3];
    palBubData[o + 1] += (0.30 + t * 0.09) * dt;
    const sd = palBubData[o + 4];
    // the wobble: a rising bubble spirals, and it is the only thing that stops
    // a column of spheres reading as a string of beads
    const wx = Math.sin(palTime * 3.1 + sd) * 0.055;
    const wz = Math.cos(palTime * 2.7 + sd * 1.4) * 0.055;
    if (palBubData[o + 1] > palWATER - 0.07 || t > 9) { palBubData[o + 3] = -1; continue; }
    const s = (0.045 + t * 0.008) * (1 + palBloom * 0.5);
    palM.makeScale(s, s, s);
    palM.setPosition(palBubData[o] + wx, palBubData[o + 1], palBubData[o + 2] + wz);
    palBubMesh.setMatrixAt(i, palM);
    live++;
  }
  palBubMesh.instanceMatrix.needsUpdate = true;
  palBubMesh.visible = live > 0;
  // and during the bloom they carry the plankton up with them
  if (palBubMat) emitSet(palBubMat, 0.25 + palBloom * 1.6);
}

// ============================================================== THE DIVER ===
/**
 * SOMEBODY ELSE IS ALREADY DOING IT.
 *
 * This chapter's entire argument is a verb nobody has pressed in eleven
 * chapters, and the whole of its teaching was a line of text: *hold E*. There
 * are seven people on that beach and not one of them ever went in the water —
 * in Palawan, at five in the afternoon, off a jetty.
 *
 * So: a boy on the end of the jetty who does it on a loop. He stands, he looks
 * at it, he goes off the end, he is UNDER for eleven seconds, and he comes up
 * and takes the breath you can hear from the beach. Nothing about him is a task
 * and nothing about him is a prompt. He is the demonstration, and a
 * demonstration is worth more than a toast because the player works it out
 * rather than being told — which is the same argument as Göreme's twenty-six
 * balloons drifting in four different directions before anybody gets in one.
 *
 * Ten seconds down is also, deliberately, about what the capybara's own bar
 * buys: the animal that can hold its breath for five minutes is watching a
 * primary-school child do it better, which is the joke and is the reason the
 * cycle is that length rather than a comfortable one.
 *
 * He is FIVE POSES OF ONE MERGED FIGURE, not a rig: standing, crouched, in the
 * air, swimming, and treading water — chosen at the phase, driven by one number.
 */
const palDIVER = { x: palJETTY.x - 0.55, z: palJETTY.z0 - 0.9 };
const palDIVE_CYCLE = 26.0;
let palDiverGroup = null, palDiverT = 0, palDiverPhase = -1;
let palDiverParts = null;

function palBuildDiver(root) {
  const g = new THREE.Group();
  g.name = 'palDiver';
  // one body, and the arms and legs are their own nodes so the pose is three
  // rotations rather than five meshes
  const B = palMerger();
  B.box(0, 0.62, 0, 0.30, 0.52, 0.20, PALETTE.palBangkaTrim);   // trunk
  B.box(0, 0.99, 0, 0.20, 0.22, 0.19, PALETTE.skin3);           // head
  B.box(0, 1.10, 0, 0.22, 0.07, 0.21, PALETTE.palCaveDark);     // hair
  B.box(0, 0.99, 0.11, 0.04, 0.04, 0.04, PALETTE.skin3);        // and a nose
  const body = new THREE.Mesh(B.build(), palVC());
  body.castShadow = true;
  g.add(body);
  const mkLimb = (w, h, col, ox, oy) => {
    const L = palMerger();
    L.box(0, -h * 0.5, 0, w, h, w, col);
    const m = new THREE.Mesh(L.build(), palVC());
    m.castShadow = true;
    const n = new THREE.Object3D();
    n.position.set(ox, oy, 0);
    n.add(m);
    g.add(n);
    return n;
  };
  palDiverParts = {
    armL: mkLimb(0.09, 0.44, PALETTE.skin3, -0.19, 0.84),
    armR: mkLimb(0.09, 0.44, PALETTE.skin3, 0.19, 0.84),
    legL: mkLimb(0.10, 0.40, PALETTE.palWreckDk, -0.08, 0.38),
    legR: mkLimb(0.10, 0.40, PALETTE.palWreckDk, 0.08, 0.38),
  };
  g.position.set(palDIVER.x, palJETTY.y + 0.13, palDIVER.z);
  root.add(g);
  palDiverGroup = g;
}

/**
 * The loop. One number, five states, and every transition is a thing you can
 * hear from the sand: the board, the entry, the silence, and the breath.
 *
 *   0.00 - 0.42   standing on the end, looking at it
 *   0.42 - 0.50   the two steps and the jump
 *   0.50 - 0.92   under. He is at -3 and you can see him from the jetty.
 *   0.92 - 1.00   up, one breath, and back onto the ladder
 */
function palUpdateDiver(game, dt) {
  if (!palDiverGroup) return;
  palDiverT += dt;
  const u = (palDiverT % palDIVE_CYCLE) / palDIVE_CYCLE;
  const P = palDiverParts;
  const G = palDiverGroup;
  let phase;
  if (u < 0.42) {
    phase = 0;
    G.position.set(palDIVER.x, palJETTY.y + 0.13, palDIVER.z);
    G.rotation.set(0, Math.PI + Math.sin(palTime * 0.5) * 0.35, 0);
    const sw = Math.sin(palTime * 1.1) * 0.10;
    P.armL.rotation.set(sw, 0, 0.06); P.armR.rotation.set(-sw, 0, -0.06);
    P.legL.rotation.set(0, 0, 0); P.legR.rotation.set(0, 0, 0);
  } else if (u < 0.50) {
    // THE JUMP, AND IT IS A PARABOLA. A dive that lerps down to the water is a
    // lift; the whole reason anybody watches somebody go off a jetty is the
    // half second in which they are not attached to anything.
    phase = 1;
    const t = (u - 0.42) / 0.08;
    const arc = 4 * t * (1 - t);
    G.position.set(palDIVER.x, palJETTY.y + 0.13 + arc * 1.1 - t * t * 2.4,
                   palDIVER.z - t * 2.6);
    G.rotation.set(-t * 1.5, Math.PI, 0);
    P.armL.rotation.set(-2.4 * t, 0, 0.4 - t * 0.3);
    P.armR.rotation.set(-2.4 * t, 0, -0.4 + t * 0.3);
    P.legL.rotation.set(0.5 * t, 0, 0); P.legR.rotation.set(0.2 * t, 0, 0);
  } else if (u < 0.92) {
    phase = 2;
    const t = (u - 0.50) / 0.42;
    // down, along, and back up — a breath-hold dive is a shallow U and the
    // player will be looking at the middle of it through four metres of water
    const depth = -0.6 - Math.sin(clamp(t / 0.85, 0, 1) * Math.PI) * 3.1;
    G.position.set(palDIVER.x - Math.sin(t * 3.1) * 3.4, depth,
                   palDIVER.z - 2.6 - t * 7.5 + Math.sin(t * 2.2) * 2.0);
    G.rotation.set(Math.cos(clamp(t / 0.85, 0, 1) * Math.PI) * -0.75,
                   Math.PI + Math.sin(t * 3.1) * 0.5, 0);
    const kick = Math.sin(palTime * 4.4) * 0.55;
    P.legL.rotation.set(kick, 0, 0); P.legR.rotation.set(-kick, 0, 0);
    P.armL.rotation.set(-2.7, 0, 0.12); P.armR.rotation.set(-2.7, 0, -0.12);
  } else {
    phase = 3;
    const t = (u - 0.92) / 0.08;
    G.position.set(palDIVER.x - 1.5 + t * 1.5, lerp(-0.55, palJETTY.y + 0.13, palSmooth(t)),
                   palDIVER.z - 6.0 + t * 5.1);
    G.rotation.set(0, Math.PI - 0.6 + t * 0.6, 0);
    const tread = Math.sin(palTime * 3.0) * 0.5;
    P.armL.rotation.set(-1.3 + tread, 0, 0.5); P.armR.rotation.set(-1.3 - tread, 0, -0.5);
    P.legL.rotation.set(tread * 0.6, 0, 0); P.legR.rotation.set(-tread * 0.6, 0, 0);
  }
  if (phase !== palDiverPhase) {
    // ...and every one of the four is a sound, which is the half of this that
    // works when the player is facing the other way
    const near = palHeard(palDIVER.x, palDIVER.z, 8, 62);
    if (palDiverPhase >= 0 && near > 0.03) {
      if (phase === 1) palSfx('step', { volume: 0.35 * near, pitch: 1.32 });
      else if (phase === 2) palSfx('splash', { volume: 0.75 * near, pitch: 1.05 });
      else if (phase === 3) palSfx('gasp', { volume: 0.72 * near, pitch: 1.3 });
    }
    palDiverPhase = phase;
  }
}

// =============================================================== THE TERNS ==
/**
 * BIRDS ARE HOW YOU FIND FISH, AND THAT IS NOT A METAPHOR.
 *
 * The bait ball is the chapter's mini-wow and it is SIX AND A HALF METRES UNDER
 * THE SEA. A player standing on the beach, on the jetty, or in the boat has no
 * way of knowing it is there — the beacon points at it and nothing in the world
 * does. Which is a shame, because the real world solved this: a bait ball at the
 * surface has a hundred birds over it, every fisherman in that province steers
 * by them, and the sight of terns working a patch of flat water is the single
 * most legible "something is happening THERE" that exists.
 *
 * Twenty-two terns on a lazy gyre over palBALL, at fifteen metres. Two of them
 * are always in a dive; a dive is a fold, a fall and a splash, and the splash is
 * audible from the beach. They go up and scatter for four seconds when the
 * capybara wheeks from the surface, and they come straight back, because a tern
 * has a very short memory and there are fish down there.
 */
const palTERN_N = 22;
let palTernMesh = null, palTernData = null;
let palTernScare = 0;
function palBuildTerns(root) {
  const M = palMerger();
  // white above, black cap, forked tail, and the wings are two swept quads —
  // a tern is a silhouette and the silhouette is entirely in the sweep
  // A METRE OF SPAN, NOT HALF OF ONE. The whole job of this flock is to be
  // legible from the SAND — sixty-four metres and a waterline away, which is
  // where the player is standing when they need to be told there is something
  // over the drop-off. Measured off that shot: at 0.5 m of wing they were four
  // white pixels apiece and read as dust on the lens. A greater crested tern is
  // a metre across, so this is also simply the right number.
  M.box(0, 0, 0, 0.13, 0.11, 0.46, PALETTE.palPearl);
  M.box(0, 0.05, 0.20, 0.10, 0.09, 0.14, PALETTE.palCaveDark);
  M.box(0, 0.03, 0.32, 0.04, 0.04, 0.16, PALETTE.palCoralOrange);
  for (let sd = -1; sd <= 1; sd += 2) {
    M.quad(sd * 0.36, 0.04, -0.02, 0.74, 0.28, PALETTE.palPearl, sd * 0.30);
    M.quad(sd * 0.64, 0.06, -0.18, 0.48, 0.18, PALETTE.palKarstShadow, sd * 0.42);
  }
  M.quad(0, 0.007, -0.33, 0.22, 0.30, PALETTE.palPearl, 0);
  palTernMesh = new THREE.InstancedMesh(M.build(), palVC(), palTERN_N);
  palTernMesh.frustumCulled = false;
  palTernMesh.userData.noShadow = true;
  palTernMesh.name = 'palTerns';
  root.add(palTernMesh);
  palTernData = new Float32Array(palTERN_N * 4);   // radius, rate, phase, diveOffset
  for (let i = 0; i < palTERN_N; i++) {
    const o = i * 4;
    palTernData[o] = 5 + rand(0, 13);
    palTernData[o + 1] = (0.30 + rand(0, 0.22)) * (i % 4 === 0 ? -1 : 1);
    palTernData[o + 2] = rand(0, Math.PI * 2);
    palTernData[o + 3] = i / palTERN_N;
  }
}
const palTERN_DIVE = 5.6;              // s between one bird's dives
let palTernSplash = 0;
// ---- Tier 5: THE FIRST PREDATOR-PREY COUPLING IN THIS CHAPTER -------------
// Where the deepest tern in the shoal is this frame, and how far into its
// strike. Written by palUpdateTerns, read by palUpdateBaitBall — and the
// update order matters: terns run BEFORE the ball in the dispatcher, so the
// hole is opened on the same frame the bird is drawn inside it rather than
// one frame late. Checked, not assumed.
let palTernHitK = 0, palTernHitX = 0, palTernHitY = 0, palTernHitZ = 0;
// How wide the hole is at full strike. 3.2 m against a torus of major radius
// 3.35 and tube 1.2 — so a strike on the ring displaces most of the fish
// within about a tube-and-a-half of where it went in, and leaves the rest of
// the ring intact. Big enough to be a hole; not so big that one bird blows the
// shoal apart, which would undo the thing the marquee is about.
const palTERN_PUNCH = 3.2;
const palTernDbgM = new THREE.Matrix4();   // instrument only
function palUpdateTerns(game, dt) {
  if (!palTernMesh) return;
  const capy = game.capy;
  const cp = capy && capy.position;
  // A WHEEK FROM THE SURFACE PUTS THEM UP. Underwater it does not, because the
  // schools already answer that and a bird cannot hear it — which is a real
  // distinction and is why the chapter's voice does different things above and
  // below the waterline.
  if (game.input && game.input.honkPressed && cp && (capy.depth || 0) < 0.3 &&
      Math.hypot(cp.x - palBALL.x, cp.z - palBALL.z) < 60) {
    palTernScare = 1;
  }
  if (palTernScare > 0) palTernScare = Math.max(0, palTernScare - dt * 0.26);
  const scare = palTernScare * palTernScare;
  if (palTernSplash > 0) palTernSplash -= dt;
  // ---- TIER 5: THE STRIKE REACHES THE FISH -------------------------------
  // Reset each frame and claimed by the deepest bird in the loop below, so
  // there is exactly one hole in the shoal at a time. See the note at the
  // apply site in palUpdateBaitBall.
  palTernHitK = 0;
  for (let i = 0; i < palTERN_N; i++) {
    const o = i * 4;
    const r = palTernData[o] * (1 + scare * 1.6);
    const a = palTernData[o + 2] + palTime * palTernData[o + 1];
    let x = palBALL.x + Math.sin(a) * r;
    let z = palBALL.z + Math.cos(a) * r * 0.85;
    let y = 13 + Math.sin(a * 2.1 + i) * 2.2 + scare * 16;
    let pitch = 0, roll = Math.sin(palTime * 0.9 + i) * 0.24;
    // ---- and two of them are always going in ----------------------------
    const dv = ((palTime / palTERN_DIVE) + palTernData[o + 3]) % 1;
    if (scare < 0.15 && dv < 0.26) {
      const t = dv / 0.26;
      // fold, fall, hit, and climb back out — the hit is at t = 0.62
      const drop = t < 0.62 ? palSmooth(t / 0.62) : 1 - palSmooth((t - 0.62) / 0.38);
      // ---- AND IT GOES ALL THE WAY IN (Tier 5) -------------------------
      //
      // It stopped at `palWATER - 0.5` — half a metre under a surface with a
      // shoal six metres below it. A tern that hunts a bait ball goes THROUGH
      // the surface; the half-metre version was drawn for the splash and for
      // nothing else, and it is why nothing downstream could ever have
      // noticed. It reaches palBALL_Y now, and on the way it aims at the ball
      // rather than at whatever point of its own orbit it happened to be over.
      const deep = lerp(palWATER - 0.5, palBALL_Y + palBALL_TUBE * 0.6,
                        clamp((drop - 0.45) / 0.55, 0, 1));
      y = lerp(y, deep, drop);
      // It converges on the shoal as it falls, and comes back out where it
      // went in — a bird that fell straight down its own orbit radius would
      // miss the ball by up to eighteen metres.
      //
      // AND IT AIMS AT THE WALL OF IT, NOT THE MIDDLE. The first cut converged
      // on palBALL.x/z, which is the AXIS of a torus — the hole in the
      // doughnut. Measured: mean shoal spread 3.363 m hunting against 3.350 m
      // with the term cut, a difference of thirteen millimetres, because every
      // fish is at least 2.15 m off that axis and a 2.6 m punch barely grazed
      // the inside of the ring. A tern hits the BALL. The aim point is a spot
      // on the ring itself, chosen per bird so twenty-two of them do not all
      // drill the same hole.
      const ring = palTernData[o + 2] * 2.7;         // its own bearing, stable per bird
      const ax = palBALL.x + Math.cos(ring) * palBALL_R;
      const az = palBALL.z + Math.sin(ring) * palBALL_R;
      const conv = palSmooth(clamp((drop - 0.25) / 0.75, 0, 1));
      x = lerp(x, ax, conv * 0.94);
      z = lerp(z, az, conv * 0.94);
      pitch = drop * 1.15;
      roll = 0;
      // The deepest bird this frame owns the hole. `k` is how open it is:
      // full at the bottom of the stoop and gone by the time the bird is out.
      const punch = clamp((drop - 0.55) / 0.45, 0, 1);
      if (punch > palTernHitK) {
        palTernHitK = punch;
        palTernHitX = x; palTernHitY = y; palTernHitZ = z;
      }
      if (t > 0.60 && t < 0.66 && palTernSplash <= 0) {
        // ONE SPLASH AT A TIME. Two dozen birds each throwing one is a hailstorm;
        // the ration is the same argument as Manly's spray.
        palTernSplash = 0.5;
        const h = palHeard(x, z, 10, 90);
        if (h > 0.04) palSfx('splash', { volume: 0.34 * h, pitch: 1.6 });
      }
    }
    const flap = Math.sin(palTime * (scare > 0.1 ? 11 : 5.5) + i * 1.7);
    palTernMesh.setMatrixAt(i, palXform(
      x, y, z, pitch, Math.atan2(Math.cos(a), -Math.sin(a) * 0.85),
      roll + flap * 0.34, 1, 1, 1));
  }
  palTernMesh.instanceMatrix.needsUpdate = true;
}

// ================================================================ THE RAY ===
/**
 * THE SAND MOVES.
 *
 * A blue-spotted ribbontail, lying on the sand at the foot of the drop-off with
 * about a centimetre of it over her back, which is what they do all day. She is
 * invisible until you are four metres away and then she GOES — straight up out
 * of a cloud of her own sand, and away along the slope.
 *
 * It is the cheapest possible wow and it is the best kind: the player did not
 * press anything, was not told anything, and will tell somebody about it. It is
 * also the only thing in this chapter that is startling, which a reef needs one
 * of. She settles again forty metres along, so it can happen twice.
 */
const palRAY = { x: 14, z: -23 };
let palRayGroup = null, palRayState = 0, palRayT = 0;
let palRayX = palRAY.x, palRayZ = palRAY.z, palRayYaw = 0.6;
let palRayPuff = null, palRayDone = false;
function palBuildRay(root) {
  const M = palMerger();
  // a disc, a tail, and the spots. Wider than it is long, like the manta and
  // for the same reason: the disc IS the animal.
  M.sph(0, 0, 0, 0.86, 0.13, 0.72, PALETTE.palTurtleShell, 8);
  M.sph(0, -0.05, 0, 0.74, 0.10, 0.62, PALETTE.palPearl, 8);
  M.box(0, 0.05, 0.52, 0.20, 0.10, 0.26, PALETTE.palTurtleShell);
  for (let i = 0; i < 7; i++) {
    const a = i * 2.399;
    M.quad(Math.sin(a) * 0.42, 0.075, Math.cos(a) * 0.34, 0.15, 0.15,
           PALETTE.palBangkaTrim, a);
  }
  for (let k = 0; k < 5; k++) {
    const t = k / 4;
    M.box(0, 0.03, -0.62 - k * 0.34, 0.09 - t * 0.05, 0.07 - t * 0.04, 0.36,
          k > 2 ? PALETTE.palCaveDark : PALETTE.palTurtleShell);
  }
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(M.build(), palVC());
  mesh.castShadow = true;
  g.add(mesh);
  g.name = 'palRay';
  root.add(g);
  palRayGroup = g;

  // the sand she leaves behind, which is the whole of the moment
  const S = palMerger();
  S.sph(0, 0, 0, 0.5, 0.5, 0.5, PALETTE.palSandWet);
  palRayPuff = new THREE.InstancedMesh(S.build(),
    mat(PALETTE.palSandWet, { transparent: true, opacity: 0.55, depthWrite: false }).clone(), 16);
  palRayPuff.frustumCulled = false;
  palRayPuff.visible = false;
  palRayPuff.userData.noShadow = true;
  palRayPuff.name = 'palRayPuff';
  root.add(palRayPuff);
}
function palUpdateRay(game, dt) {
  if (!palRayGroup) return;
  const capy = game.capy;
  const cp = capy && capy.position;
  const bed = palTerrain(palRayX, palRayZ);
  if (palRayState === 0) {
    // BURIED. A centimetre over her back, and the wings breathe about once every
    // three seconds because a buried ray is still pumping water over its gills.
    const br = Math.sin(palTime * 2.1) * 0.02;
    palRayGroup.position.set(palRayX, bed + 0.05 + br, palRayZ);
    palRayGroup.rotation.set(0, palRayYaw, 0);
    palRayGroup.scale.set(1, 0.55, 1);
    if (cp && Math.hypot(cp.x - palRayX, cp.z - palRayZ) < 4.2 &&
        (capy.depth || 0) > 0.4) {
      palRayState = 1; palRayT = 0;
      // WHERE SHE WAS, not where she is. The cloud stays put and she does not,
      // which is the entire read: something left, and this is the hole it left.
      palRayPuff.userData.ox = palRayX;
      palRayPuff.userData.oy = bed;
      palRayPuff.userData.oz = palRayZ;
      palRayPuff.visible = true;
      const h = palHeard(palRayX, palRayZ, 4, 30);
      palSfx('rustle', { volume: 0.55 * h, pitch: 0.55 });
      if (typeof game.shake === 'function') game.shake(0.06);
      if (!palRayDone) {
        palRayDone = true;
        palToast('you were four metres from that for a minute and a half.');
      }
    }
    if (palRayPuff.visible) palRayPuff.visible = false;
    return;
  }
  // ---- GOING ------------------------------------------------------------
  palRayT += dt;
  const t = palRayT;
  const sp = 3.6 * Math.exp(-t * 0.30);
  palRayX += Math.sin(palRayYaw) * sp * dt;
  palRayZ += Math.cos(palRayYaw) * sp * dt;
  palRayYaw += Math.sin(t * 0.55) * 0.5 * dt;
  const lift = Math.sin(clamp(t / 5.5, 0, 1) * Math.PI) * 2.2;
  palRayGroup.position.set(palRayX, palTerrain(palRayX, palRayZ) + 0.5 + lift, palRayZ);
  // the wings BEAT, and a ray beats from the tip inward, which one scale on the
  // x axis says surprisingly well
  palRayGroup.scale.set(1, 0.55 + Math.sin(t * 3.4) * 0.35, 1);
  palRayGroup.rotation.set(Math.sin(t * 3.4) * 0.10, palRayYaw, Math.sin(t * 0.9) * 0.22);
  // the cloud she left, expanding and settling where it was
  if (palRayPuff.visible) {
    const pt = t;
    palRayPuff.visible = pt < 4.5;
    for (let i = 0; i < 16; i++) {
      const a = i * 2.399, r = 0.4 + (i % 4) * 0.3 + pt * 0.7;
      const sc = clamp(0.5 + pt * 0.5, 0, 2.4) * clamp(1 - pt / 4.5, 0, 1);
      palRayPuff.setMatrixAt(i, palXform(
        palRayPuff.userData.ox + Math.cos(a) * r,
        palRayPuff.userData.oy + 0.2 + pt * 0.24 * (0.4 + (i % 3) * 0.4),
        palRayPuff.userData.oz + Math.sin(a) * r, 0, a, 0, sc, sc, sc));
    }
    palRayPuff.instanceMatrix.needsUpdate = true;
    palRayPuff.material.opacity = 0.55 * clamp(1 - pt / 4.5, 0, 1);
  }
  // ...and she settles again, somewhere else, so it can happen twice
  if (t > 9) {
    palRayState = 0;
    palRayX = clamp(palRayX, -34, 34);
    palRayZ = clamp(palRayZ, palDROP_Z + 2, palFLAT_Z + 4);
    palRayYaw = rand(0, Math.PI * 2);
  }
}

// ============================================================ THE SWIFTLETS =
/**
 * THE CATHEDRAL IS A BIRD CAVE, AND THAT IS NOT A FLOURISH — IT IS WHAT ONE OF
 * THOSE CHAMBERS IS FOR.
 *
 * Every big limestone cave in Palawan with a hole in the roof has a colony of
 * swiftlets in it, and the nests are the reason anybody has ever climbed into
 * one. They fly in and out through the hole all day, they NEVER land on the
 * floor, and in the dark they navigate by clicking, which is the one other
 * animal on earth that does what a capybara does with its voice.
 *
 * The chamber was the best picture in the chapter and the emptiest room in it:
 * a shaft, a bank of sand, twenty-six stalagmites and one school of fish going
 * round in a circle. Thirty-six birds turn it from a photograph into a place.
 *
 * They fly a lazy gyre round the shaft — which is deliberate: a swiftlet cuts
 * through a beam of light and vanishes and comes back, and having the ONE light
 * source in the room be the thing they orbit means the player's eye is already
 * where the birds are. And a wheek in here sends the whole colony up through the
 * hole and out, which takes eleven seconds and is the loudest thing in the
 * chapter, in the room that is otherwise the quietest.
 */
const palSWIFT_N = 36;
let palSwiftMesh = null, palSwiftData = null;
let palSwiftOut = 0, palSwiftTold = false;
function palBuildSwiftlets(root) {
  const M = palMerger();
  // A SWIFTLET IS A CRESCENT. Twelve centimetres, dark above, and the whole
  // animal is two swept-back wings — there is no body worth drawing at this
  // scale and there is no tail worth drawing at all.
  M.box(0, 0, 0, 0.045, 0.04, 0.13, PALETTE.palCaveDark);
  for (let sd = -1; sd <= 1; sd += 2) {
    M.quad(sd * 0.10, 0.005, -0.02, 0.20, 0.075, PALETTE.palCaveDark, sd * 0.55);
    M.quad(sd * 0.19, 0.008, -0.07, 0.14, 0.05, PALETTE.palKarstShadow, sd * 0.72);
  }
  palSwiftMesh = new THREE.InstancedMesh(M.build(), palVC(), palSWIFT_N);
  palSwiftMesh.frustumCulled = false;
  palSwiftMesh.userData.noShadow = true;
  palSwiftMesh.name = 'palSwiftlets';
  root.add(palSwiftMesh);
  palSwiftData = new Float32Array(palSWIFT_N * 4);   // radius, rate, phase, bob
  for (let i = 0; i < palSWIFT_N; i++) {
    const o = i * 4;
    palSwiftData[o] = 3.0 + rand(0, 10);
    palSwiftData[o + 1] = (0.42 + rand(0, 0.5)) * (i % 3 === 0 ? -1 : 1);
    palSwiftData[o + 2] = rand(0, Math.PI * 2);
    palSwiftData[o + 3] = rand(0, Math.PI * 2);
  }
}
function palUpdateSwiftlets(game, dt) {
  if (!palSwiftMesh) return;
  const capy = game.capy;
  const cp = capy && capy.position;
  const inRoom = cp ? palInZone('cathedral', cp.x, cp.z) : false;
  // ONLY WHILE SOMEBODY IS IN THE ROOM. Thirty-six matrix writes a frame for a
  // chamber a hundred and thirty metres behind a rock wall is thirty-six matrix
  // writes nobody will ever see, and this chapter has four other things on the
  // per-frame budget already.
  palSwiftMesh.visible = inRoom || palSwiftOut > 0.01;
  if (!palSwiftMesh.visible) return;

  if (inRoom && game.input && game.input.honkPressed && palSwiftOut < 0.4) {
    palSwiftOut = 1;
    palSfx('rustle', { volume: 0.85, pitch: 1.75 });
    if (typeof game.shake === 'function') game.shake(0.10);
    if (!palSwiftTold) {
      palSwiftTold = true;
      palToast('they nest in the roof. they have never once been outside in daylight.');
    }
  }
  if (palSwiftOut > 0) {
    palSwiftOut = Math.max(0, palSwiftOut - dt * 0.09);
    // ...and they answer. A swiftlet in the dark clicks, which is the one other
    // animal that navigates the way this one does.
    if (palSwiftOut > 0.55 && Math.random() < dt * 9) {
      palSfx('tick', { volume: rand(0.05, 0.12), pitch: rand(2.0, 2.5) });
    }
  }
  const flee = palSwiftOut * palSwiftOut;
  for (let i = 0; i < palSWIFT_N; i++) {
    const o = i * 4;
    // the gyre, round the shaft, and it TIGHTENS as it climbs — a colony
    // leaving through a four-metre hole has to funnel, and the funnel is the
    // picture
    const climb = flee;
    const r = lerp(palSwiftData[o], palHOLE.r * 0.55, climb);
    const a = palSwiftData[o + 2] + palTime * palSwiftData[o + 1] * (1 + climb * 2.4);
    const base = palCATH.deep + 3.5 + Math.sin(palTime * 0.7 + palSwiftData[o + 3]) * 2.4;
    const y = lerp(base, palCATH.dome + 6 + (i % 5), climb);
    const x = palHOLE.x + Math.sin(a) * r;
    const z = palHOLE.z + Math.cos(a) * r;
    palSwiftMesh.setMatrixAt(i, palXform(
      x, y, z, climb * -0.7, Math.atan2(Math.cos(a), -Math.sin(a)),
      Math.sin(palTime * 13 + i) * 0.55, 1, 1, 1));
  }
  palSwiftMesh.instanceMatrix.needsUpdate = true;
}

// ================================================================ THE BREATH =
/**
 * THE ONE RESOURCE IN THIS CHAPTER, AND YOU COULD ONLY SEE IT IN THE CORNER.
 *
 * The dive spends the stamina bar and the bar is the breath — that is the whole
 * design, and it is stated three times in this file. It was reported in exactly
 * two places: a bar in the HUD, and a stream of bubbles off the nose, which is
 * behind the animal and which the player is usually not looking at because they
 * are looking at where they are GOING.
 *
 * A held breath is not a visual sensation. It is a sound, and everybody knows
 * which one: the pulse comes up in your own ears. So under about a third of a
 * tank there is a slow low thud, and it gets faster and louder as the tank
 * empties — which is both the honest physiology and, much more usefully, a
 * reading of the bar that works with your eyes anywhere in the frame.
 *
 * Three rules, and all three are what stop it being an alarm:
 *   IT STARTS LATE. Nothing at all above 0.34, so most dives never hear it.
 *   IT IS UNDER EVERYTHING. 0.10 to 0.30 of volume — the point is that you
 *   notice it, not that it tells you.
 *   AND IT STOPS THE INSTANT YOU SURFACE, with a gasp, which is the release.
 */
let palHeartT = 0, palLastDepth = 0, palGaspArmed = false;
function palUpdateBreath(game, dt) {
  const capy = game.capy;
  if (!capy) return;
  const depth = capy.depth || 0;
  const stam = capy.stamina === undefined ? 1 : capy.stamina;
  const under = depth > 0.55;

  if (under && stam < 0.34) {
    // 52 bpm at a third of a tank, 108 at the bottom of it. A resting capybara
    // is about 80; the LOW rate is the one that reads as effort held in.
    const k = clamp(1 - stam / 0.34, 0, 1);
    palHeartT -= dt;
    if (palHeartT <= 0) {
      palHeartT = lerp(1.16, 0.56, k);
      // two beats, not one: a heartbeat is lub-DUB and one thud is a drum
      palSfx('thud', { volume: (0.10 + k * 0.20), pitch: 0.42 });
      palSfx('thud', { volume: (0.06 + k * 0.13), pitch: 0.50, force: true });
    }
    // ...and it is armed, so coming up is a release rather than a fade
    if (k > 0.30) palGaspArmed = true;
  } else if (!under) {
    palHeartT = 0;
    // THE SURFACE IS A SOUND. Twelve chapters of water and breaking through the
    // top of it never made one; in the chapter whose whole subject is holding
    // your breath, coming up has to be the loudest thing the animal does.
    if (palGaspArmed && palLastDepth > 0.55) {
      palGaspArmed = false;
      palSfx('gasp', { volume: 0.85, pitch: 1.05, force: true });
      palSfx('splash', { volume: 0.42, pitch: 1.45 });
    }
  }
  palLastDepth = depth;
}

// ================================================================ THE REEF'S =
/**
 * A REEF IS THE NOISIEST THING IN THE SEA AND THIS ONE WAS SILENT.
 *
 * Put your head under over a coral garden and the first thing you notice — long
 * before any fish — is that it CRACKLES: several thousand snapping shrimp, all
 * of them firing, and it sounds like frying. It is the single most distinctive
 * sound in the tropics and it exists nowhere above the waterline, which makes it
 * exactly the right thing to hang on this chapter's one hard boundary. Nothing
 * else in the game has a sound that only happens when the camera goes under.
 *
 * Rationed hard, and positional: it fires only over the reef flat and the
 * lagoon, only while the animal is actually down, and it thins to nothing out
 * over the drop-off — because past the coral there are no shrimp and the deep is
 * supposed to be the quiet place. That contrast is the whole reason to build it.
 */
let palCrackT = 0;
function palUpdateReefSound(game, dt) {
  const capy = game.capy;
  const p = capy && capy.position;
  if (!p || (capy.depth || 0) < 0.5) { palCrackT = 0; return; }
  // how much coral is within earshot: the garden, the lagoon and the ring under
  // the cathedral's hole, and nothing else
  const near = Math.max(
    1 - Math.hypot(p.x - palREEF.x, p.z - palREEF.z) / 34,
    1 - Math.hypot(p.x - palLAG.x, p.z - palLAG.z) / 26,
    1 - Math.hypot(p.x - palHOLE.x, p.z - palHOLE.z) / 16);
  if (near <= 0.04) { palCrackT = 0; return; }
  palCrackT -= dt;
  if (palCrackT > 0) return;
  // 0.28 to 0.9 s apart. Slower than a real one by a long way — a faithful rate
  // would be continuous and this game has one voice per sound, so what is being
  // drawn here is the IMPRESSION of frying rather than the thing itself.
  palCrackT = rand(0.28, 0.9) / (0.4 + near);
  palSfx('tick', { volume: (0.05 + near * 0.11) * (palBloom > 0.4 ? 1.35 : 1),
                   pitch: rand(1.7, 2.4) });
}

// ================================================================ THE CLOCK =
function palUpdateClock(game, dt) {
  palPhase += dt / palCYCLE;
  if (palPhase >= 1) { palPhase -= 1; palWarned = false; }

  let want = 0;
  if (palPhase > palBLOOM_ON && palPhase < palBLOOM_OFF) {
    const span = palBLOOM_OFF - palBLOOM_ON;
    const t = (palPhase - palBLOOM_ON) / span;
    // up over four seconds, hold, and down over eight — a bloom arrives on a
    // current and leaves on the same one, so it is not symmetrical
    want = clamp(Math.min(t / 0.10, (1 - t) / 0.24), 0, 1);
    if (palBloomT < 0) palBloomT = 0; else palBloomT += dt;
  } else {
    palBloomT = -1;
  }
  palBloom = damp(palBloom, want, 2.2, dt);

  if (!palWarned && palPhase > palBLOOM_WARN && palPhase < palBLOOM_ON) {
    palWarned = true;
    palToast('the water has gone cloudy. that is not sand.');
    palSfx('chime', { volume: 0.32, pitch: 1.7 });
  }
  // THE LIFT, and it is held for the whole of the build rather than fired at
  // the tick — the same construction the aurora uses, and for the same reason:
  // the moment starts before the moment.
  if (palBloom > 0.05 && typeof game.music === 'object' && game.music &&
      typeof game.music.swell === 'function') {
    game.music.swell(clamp(palBloom * 0.9, 0, 1));
  }
  if (palShaftMats) {
    for (let i = 0; i < palShaftMats.length; i++) {
      emitSet(palShaftMats[i], 0.42 + Math.sin(palTime * 0.6 + i) * 0.10 + palBloom * 0.3);
    }
  }
  // THE POOL BREATHES WITH ITS OWN SHAFT. A beam through moving water is being
  // driven by the swell above it, so the light on the floor swims — which is the
  // whole reason a real one is worth standing in, and it is one number a frame.
  for (let i = 0; i < palShaftPools.length; i++) {
    const m = palShaftPools[i];
    m.opacity = m.userData.base * (0.72 + Math.sin(palTime * 0.83 + i * 1.7) * 0.22
                                        + Math.sin(palTime * 1.9 + i) * 0.09);
  }
}

// ================================================================== TASKS ===
// ================================================================ THE JETTY ==
// SEVEN OF THIS CHAPTER'S TEN LINES ARE UNDER THE WATER AND THREE ARE NOT, and
// two of those three are "turn up" and "get on the boat". The beach is where the
// player spends the first two minutes and the last, and it had nothing to do.
//
// So: go off the end. It is the oldest thing anybody has ever done off a jetty,
// it needs no verb the chapter has not already taught, and it is the exact
// opposite of `first-dive` — that one is a key you hold, this one is a decision
// you make at a run and then cannot take back.
let palJumpDone = false, palJumpArmed = false;

function palCheckJetty(game) {
  if (palJumpDone) return;
  const capy = game.capy;
  if (!capy || !capy.position) return;
  const p = capy.position;
  // ARMED BY BEING ON IT. Otherwise a swimmer who happens to be hopping near
  // the pilings pays for a jump nobody took.
  const onDeck = Math.abs(p.x - palJETTY.x) < palJETTY.w * 0.5 + 0.7 &&
                 p.z > palJETTY.z0 - 0.4 && p.z < palJETTY.z1 + 0.4 &&
                 p.y > palJETTY.y - 0.3;
  if (onDeck) { palJumpArmed = true; return; }
  if (!palJumpArmed) return;
  // off the SEAWARD end, in the air, over water
  if (p.z < palJETTY.z0 - 0.3 && !capy.grounded && p.y > 0.15 && p.y < palJETTY.y + 4 &&
      Math.abs(p.x - palJETTY.x) < 5) {
    palJumpDone = true;
    palTask('jetty-jump');
    palSaysNow('boy',
      ['See? Everybody goes off the end.',
       'Now do it from the far post. That is the real one.',
       'You did not even check how deep it was. Respect.'],
      ['Again! Go on, again!']);
    palSfx('gasp', { volume: 0.6 });
    palToast('every jetty on earth is for this and nothing else.');
  }
  // walked back off the landward end instead: disarm and say nothing
  if (p.z > palJETTY.z1 + 1) palJumpArmed = false;
}

// ================================================================= THE FIRE ==
// A CAPYBARA IS A WET ANIMAL AND THE GAME HAS NEVER ONCE USED THAT.
//
// `capy.wet` has existed since Sydney; it darkens the coat, it drips, and it has
// never been a mechanic. There is a fire on this beach that was built as scenery
// eight tasks ago. Come out of the sea and sit on it.
//
// The gate is the WATER, not the walk: dry, you are a rodent standing in a fire
// and nothing happens (and nothing should — this game does not do damage). Wet,
// thirty kilos of soaked capybara puts it out, and the steam is the payoff.
const palFIRE = { x: 2, z: 55 };
// how long the steam plume lives. Named, because two places have to agree on it.
const palFIRE_STEAM = 3.4;
let palFireDone = false, palFireOut = 0, palFireFlame = null, palFireSteam = null;

function palBuildFire(root) {
  // THE FLAME IS ITS OWN MESH NOW. It was one cone inside the beach's merged
  // geometry, which is correct for a thing nobody will ever touch and useless
  // for a thing that has to go out.
  const M = palMerger();
  const g = palTerrain(palFIRE.x, palFIRE.z);
  M.cone(0, 0.75, 0, 0.62, 1.25, PALETTE.palCoralOrange);
  M.cone(0, 0.48, 0, 0.34, 0.80, PALETTE.palFishA);
  const mesh = new THREE.Mesh(M.build(), palVC());
  palFireFlame = new THREE.Group();
  palFireFlame.name = 'palFire';
  palFireFlame.position.set(palFIRE.x, g, palFIRE.z);
  palFireFlame.add(mesh);
  root.add(palFireFlame);

  const S = palMerger();
  S.sph(0, 0, 0, 0.42, 0.42, 0.42, PALETTE.palSand);
  palFireSteam = new THREE.InstancedMesh(S.build(),
    mat(PALETTE.palSand, { transparent: true, opacity: 0.5, depthWrite: false }).clone(), 22);
  palFireSteam.frustumCulled = false;
  palFireSteam.visible = false;
  root.add(palFireSteam);
  palFireDone = false; palFireOut = 0;
}

function palUpdateFire(game, dt) {
  if (!palFireFlame) return;
  const g = palFireFlame.position.y;

  if (palFireOut > 0) {
    // ---- AND IT STOPS WHEN IT IS OUT --------------------------------------
    // This branch ran for ever. Once the fire was out — which is a task, so it
    // stays out for the rest of the chapter — it went on incrementing a
    // counter, writing a scale, filling twenty-two instance matrices and
    // flagging instanceMatrix.needsUpdate EVERY FRAME, for a plume whose
    // opacity had been clamped to zero nineteen seconds earlier. One number of
    // waste is nothing; one number of waste that never ends is a leak, and it
    // is the kind that never shows up in a profile because it is small.
    if (palFireOut > palFIRE_STEAM + 0.2) {
      if (palFireSteam && palFireSteam.visible) palFireSteam.visible = false;
      if (palFireFlame.visible) palFireFlame.visible = false;
      return;
    }
    palFireOut += dt;
    const k = clamp(1 - palFireOut / 0.7, 0, 1);
    palFireFlame.scale.set(k, k * k, k);
    palFireFlame.visible = k > 0.02;
    if (palFireSteam) {
      const t = palFireOut;
      palFireSteam.visible = t < palFIRE_STEAM;
      for (let i = 0; i < 22; i++) {
        const a = i * 2.399;
        const r = 0.5 + (i % 5) * 0.28 + t * 0.75;
        const s = clamp(0.5 + t * 0.55, 0, 2.2) * clamp(1 - t / palFIRE_STEAM, 0, 1);
        palFireSteam.setMatrixAt(i, palXform(
          palFIRE.x + Math.cos(a) * r, g + 0.3 + t * (1.1 + (i % 3) * 0.4),
          palFIRE.z + Math.sin(a) * r, 0, a, 0, s, s, s));
      }
      palFireSteam.instanceMatrix.needsUpdate = true;
      palFireSteam.material.opacity = 0.5 * clamp(1 - palFireOut / palFIRE_STEAM, 0, 1);
    }
    return;
  }

  // it flickers, because a cone that does not is a traffic cone
  const t = palTime;
  palFireFlame.scale.set(1 + Math.sin(t * 9.1) * 0.06, 1 + Math.sin(t * 7.3) * 0.11,
                         1 + Math.sin(t * 8.4) * 0.06);
  palFireFlame.rotation.y = Math.sin(t * 2.1) * 0.2;

  if (palFireDone) return;
  const capy = game.capy;
  if (!capy || !capy.position) return;
  const p = capy.position;
  const dx = p.x - palFIRE.x, dz = p.z - palFIRE.z;
  if (dx * dx + dz * dz > 2.0 * 2.0) return;
  if ((capy.wet || 0) < 0.55) {
    if (!palFireTold) {
      palFireTold = true;
      palToast('you would need to be a great deal wetter than that.');
    }
    return;
  }
  palFireDone = true;
  palFireOut = 0.0001;
  palTask('beach-fire');
  palSaysNow('fire',
    ['Well. That is the fire.',
     'Half an hour of driftwood and one wet rodent.',
     'Go on. Go and be wet somewhere else.'],
    ['You have done enough noise for one evening.']);
  palSfx('hiss', { volume: 0.9, pitch: 1.25 });
  palSfx('splash', { volume: 0.4, pitch: 1.5 });
  palToast('thirty kilos of wet rodent. the fire never stood a chance.');
}
let palFireTold = false;

/**
 * PEOPLE WHO HAVE NOTICED.
 *
 * A local is a point somebody is standing at and three things they might say,
 * and npc.js reads `rec.lines` LIVE — so a chapter that keeps its records can
 * change what somebody says the moment the world changes underneath them. This
 * chapter had seven people on a beach saying the same three sentences whether
 * the capybara had just walked past them or had just put out their fire, come
 * back through a rock, or ridden the bangka they were describing.
 *
 * Which is the whole thing. Somebody who says the same sentence after you have
 * done the impossible in front of them is scenery with a mouth on it; somebody
 * who says a different one is a person. Six of them here, and every switch is
 * hung on a task the player has actually completed, so nobody ever congratulates
 * you for something you did not do.
 */
/**
 * ...AND IT USED TO DO THAT BY THROWING THE OLD ONES AWAY (v21 refactor).
 *
 * `palSaysNow(who, lines, wheek)` assigned `rec.lines = lines`, which is the
 * obvious way to make somebody react and has three faults, all of them the
 * same fault:
 *
 *   1. IT FORGETS. Do the crack, then the turtle, and the boy's three lines
 *      about the turtle wipe out the lagoon woman's — no, worse: do the turtle
 *      and then the bloom in front of the same person and the second swap
 *      erases the first, so a chapter where you have done five things reads
 *      exactly like a chapter where you have done one.
 *   2. IT IS BLIND TO EVERYTHING ELSE. A pool that has been overwritten cannot
 *      also know what time it is, whether the water is lit, or whether the
 *      player is under it. Palawan is a chapter with a CLOCK on it — the bloom
 *      comes round every hundred and twenty-four seconds — and nobody in it
 *      ever mentioned that.
 *   3. IT IS A SECOND MECHANISM. npc.js has had `{ t, after: 'task-id' }`
 *      since v20 and every other chapter that reacts to the player uses it.
 *      Two systems doing one job is one system too many, and the one that was
 *      here is the one that loses information.
 *
 * So the pools below carry their own `after:` and `when:` entries and compose
 * properly, and this function keeps only the half that `after:` cannot do: SAY
 * IT NOW, out loud, on the spot, because the moment somebody finds out is worth
 * more than the moment they next happen to speak. It no longer touches the
 * pool, so nothing it says can cost anything else.
 */
const palLocals = {};
function palSaysNow(who, lines, wheek) {
  const r = palLocals[who];
  if (!r || !lines || !lines.length) return;
  // one line, chosen off the running clock so two people reacting to the same
  // event do not both open with the first entry
  const i = Math.floor(palTime * 0.37 + (who.length || 0)) % lines.length;
  r.cd = (r.cool || 13) * 1.1;
  r.gest = 1.4;
  try { r.anchor.speak(lines[i]); } catch (e) {}
}

function palTask(id) {
  const g = palGame;
  if (g && typeof g.completeTask === 'function') { try { g.completeTask(id); } catch (e) { warnOnce('palawan.completeTask', e); } }
}
function palToast(t) {
  const g = palGame;
  if (g && typeof g.toast === 'function') { try { g.toast(t); } catch (e) { warnOnce('palawan.toast', e); } }
}
/**
 * THE SAME LINE, IN THE SCHEME THE PLAYER IS HOLDING (F1).
 *
 * `palToast` takes a finished sentence, which is right for every line in this
 * chapter that names no control. The one that hands over a VERB has to go
 * through `game.say`, which runs systems.js's substitution table over it —
 * otherwise the moment this chapter introduces the dive, the eleventh new verb
 * and the only one gated on deep water, it tells a phone to hold a key it does
 * not have. Used at the teaching site and nowhere else, for the reason
 * `game.say`'s own comment gives: this is not a filter to put every string in
 * the game through.
 */
function palSay(t) {
  const g = palGame;
  // THROUGH game.control, NOT game.say (W3). `game.say` is npc.js's
  // sayAt(x, y, z, text): the sentence landed in x, text was undefined, and
  // sayAt returned at its own `if (!text)` — so this line had never once
  // been drawn (the D5.2 bug in antarctic.js, in three more chapters).
  // `control` is the toast that runs the key-name substitution, which is
  // exactly what a sentence with "hold E" in it wants.
  if (g && typeof g.control === 'function') { try { g.control(t); } catch (e) { warnOnce('palawan.say', e); } }
  else palToast(t);
}
function palSfx(n, o) {
  // ALWAYS through the dispatcher, never a bare synth: it is what supplies the
  // default volume and pitch and what wraps every voice in a try/catch.
  const g = palGame;
  if (g && typeof g.sfx === 'function') { try { g.sfx(n, o); } catch (e) { warnOnce('palawan.sfx', e); } }
}

// ---- THE THREE MEASURED THINGS IN THIS CHAPTER, EACH FILED ONCE ------------
// Every one of them is a value that CLIMBS while an attempt is open — how deep
// this dive got, how long you have held the turtle, how long you have held your
// breath — and `game.record()` speaks on every improvement. Handed a climbing
// number every frame it speaks sixty times a second. Each attempt banks its own
// peak and reports it on the edge that ends it, which is the shape gorFlushPeak
// has had in Cappadocia since the fifth pass. Called from the edges below AND
// from onExit, so an attempt interrupted by travel is still filed.
function palFlushDive(game) {
  if (palDivePeak > 1.5 && game && typeof game.record === 'function') {
    game.record('first-dive', palDivePeak);
  }
  palDivePeak = 0;
}
function palFlushTurtle(game) {
  if (palTurtleWith > 1.5 && game && typeof game.record === 'function') {
    game.record('sea-turtle', palTurtleWith);
  }
  palTurtleWith = 0; palTurtleOff = 0;
}
function palFlushBreath(game) {
  if (palBreathIn > 2 && game && typeof game.record === 'function') {
    game.record('cathedral', palBreathIn);
  }
  palBreathIn = 0;
}

function palUpdateTasks(game, dt) {
  const capy = game.capy;
  if (!capy || !capy.position) return;
  const p = capy.position;
  const input = game.input;
  const depth = capy.depth || 0;
  // 0.65, and it is measured rather than chosen: the animal's body centre
  // floats 8 cm over the waterline and its back is about 30 cm above that, so
  // anything past about 0.6 has the whole animal genuinely beneath the surface.
  const under = depth > 0.65;

  // ---- teaching the verb --------------------------------------------------
  // A verb nobody has ever pressed does not teach itself, and this one has been
  // absent for eleven chapters, so the prompt is offered the moment the animal
  // is in water deep enough for it to work.
  if (!palToldDive && !palDiveDone && capy.depth !== undefined &&
      palIsOverWater(p.x, p.z) && p.y < 0.6 && palTerrain(p.x, p.z) < -2.2) {
    palToldDive = true;
    palSay('hold E. you have gills in all but name.');
  }

  // ---- going under, and how far -------------------------------------------
  // ---- ONE DIVE, ONE NUMBER ----------------------------------------------
  // `game.record()` TOASTS AND CHIMES EVERY TIME THE NUMBER IMPROVES, and this
  // was calling it every frame on `palDeepest` — a value that only ever climbs
  // and climbs on nearly every frame of a descent. MEASURED, one seven-second
  // dive to a ten-metre seabed: 372 calls, of which 272 were strict
  // improvements. On a second visit — the only time `record` has a previous
  // best to beat — that is two hundred and seventy-two personal-best toasts
  // and chimes stacked over the animal's head while it is being taught the
  // chapter's own new verb. Exactly the cowbird in the Pantanal and
  // `three-winds` in Cappadocia; the fix is theirs. Bank the peak of THIS
  // dive, report it once when the animal comes up. `record` keeps the session
  // best itself, so nothing is lost by filing per dive rather than per session.
  if (under) { if (depth > palDivePeak) palDivePeak = depth; }
  else if (palDivePeak > 0) palFlushDive(game);
  if (under && !palDiveDone) {
    palDiveDone = true;
    palTask('first-dive');
    palToast('twelve chapters of paddling about on the top of it. finally.');
    palSfx('splash', { volume: 0.6, pitch: 0.65 });
  }
  // ---- HOW FAR DOWN YOU ARE, WHILE YOU ARE DOWN THERE (v32) ---------------
  // The live figure is THIS dive's depth, not the session's deepest: a readout
  // that stuck at the best of the afternoon would say nothing about the dive
  // you are on. Below the turtle and the cathedral in this function on purpose
  // — both of those are more specific attempts and both are allowed to take
  // the line off this one while they are open.
  if (under && game.recordLive) game.recordLive('first-dive', depth);

  // ---- the crack ----------------------------------------------------------
  if (!palToldCrack && !palCrackDone && palInZone('crack', p.x, p.z)) {
    palToldCrack = true;
    palToast('the roof of that gap is under the water. so go under it.');
  }
  if (!palCrackDone && palInZone('lagoon', p.x, p.z)) {
    palCrackDone = true;
    palTask('the-crack');
    // ...and the one person who told you how is the one who finds out
    palSaysNow('lagoon',
      ['You went under it. Of course you went under it.',
       'Nobody from the village has been in there in nine years.',
       'It is bigger than the bay, in there. Nobody believes me.'],
      ['Do that in the lagoon. Just once. You will see.']);
    palToast('forty metres of rock, all the way round, and no other door.');
    palSfx('chime', { volume: 0.5, pitch: 1.25 });
  }

  // ---- the turtle ---------------------------------------------------------
  palTurtlePos(palTurtleT, palPt);
  const td = Math.hypot(p.x - palPt.x, p.z - palPt.z, (p.y - palPt.y) * 0.8);
  // ---- THE TURTLE'S OWN BREATH WAS BREAKING THE TURTLE'S OWN TASK --------
  //
  // She surfaces for six seconds every ninety-two — which is the best-written
  // beat in this chapter and is documented as such three hundred lines up: "you
  // are out of air at exactly the moment she is, you break the surface
  // together". And the hold that scores it required SIX CONTINUOUS SECONDS
  // UNDER, so the instant she went up and the player followed her up, `under`
  // went false and the timer was thrown away.
  //
  // The two numbers are six and six. Following her exactly as the chapter asks
  // you to, at the moment the chapter is proudest of, is the one way to
  // guarantee you never finish. Measured, not reasoned about: a run that stayed
  // inside four metres of her for twenty-two seconds scored 3.1 s.
  //
  // So: being at the surface WITH HER is keeping up with her. `under` is only
  // required while she is down, and a moment out of range decays the hold
  // instead of deleting it — the same half-second grace the bangka's deck has
  // had since it shipped, for exactly the same reason.
  const sheIsUp = palTurtleUp(palTurtleT);
  const withHer = td < 4.6 && (under || sheIsUp);
  if (withHer) {
    palTurtleOff = 0;
    palTurtleWith += dt;
    if (!palTurtleDone && palTurtleWith > 6) {
      palTurtleDone = true;
      palTask('sea-turtle');
      palSaysNow('boy',
        ['You kept up with her! Nobody keeps up with her.',
         'She comes up for air about now. Watch. Right about now.',
         'Sixty years. My father followed her when he was my size.'],
        ['She has heard that a thousand times. She does not care.']);
      palToast('it has been doing this lap for sixty years. do not rush it.');
      palSfx('pop', { volume: 0.6, pitch: 0.8 });
    }
    // ...and it is on the paper for the whole of the swim, not just at the end
    if (game.recordLive) game.recordLive('sea-turtle', palTurtleWith);
    // ---- AND THE CHAPTER SAYS WHAT IT WANTS ------------------------------
    // Six seconds is not long, but a bar with no face on it is a bar nobody
    // knows they are filling. One line, once, at the halfway mark, and then
    // never again — enough to turn 'swimming near a turtle' into 'doing a
    // thing'. It is deliberately about her rather than about the timer.
    if (!palTurtleTold && palTurtleWith > 3) {
      palTurtleTold = true;
      palToast('she has not changed course once. stay with her.');
    }
  } else if (palTurtleWith > 0) {
    // A BUMP INTO A BOMMIE IS NOT LOSING HER. Half a second, the same grace
    // the bangka's deck gets, and then the run is over.
    palTurtleOff += dt;
    // ...and THAT is where the run's number is filed. See palFlushTurtle.
    if (palTurtleOff > 0.6) palFlushTurtle(game);
  }

  // ---- the giant clam -----------------------------------------------------
  const nearClam = palInZone('clam', p.x, p.z) && under;
  palClamOpen = damp(palClamOpen, nearClam ? 1 : 0, 2.4, dt);
  if (palClamGroup && palClamGroup.userData.lid) {
    palClamGroup.userData.lid.position.y = 0.35 + palClamOpen * 1.5;
    palClamGroup.userData.lid.rotation.x = -palClamOpen * 0.42;
  }
  if (palPearl) palPearl.visible = palClamOpen > 0.3 && !palPearlTaken;
  if (!palClamDone && nearClam && palClamOpen > 0.55 && input && input.actionPressed) {
    palClamDone = true;
    palPearlTaken = true;
    palTask('giant-clam');
    palToast('a hundred and thirty years old, and it did not even shut.');
    palSfx('chime', { volume: 0.85, pitch: 1.9 });
    if (typeof game.shake === 'function') game.shake(0.10);
  }

  // ---- the cathedral ------------------------------------------------------
  if (palInZone('cathedral', p.x, p.z)) {
    if (!palCathDone) {
      palCathDone = true;
      palTask('cathedral');
      palToast('nobody has ever swum in here without stopping. neither did you.');
      palSfx('chime', { volume: 0.7, pitch: 0.55 });
      if (typeof game.music === 'object' && game.music && typeof game.music.swell === 'function') {
        game.music.swell(0.7);
      }
    }
    // the breath record is kept HERE and nowhere else, because it is the one
    // place in the chapter where holding it is a thing you are doing on purpose
    if (under) {
      palBreathIn += dt;
      // the breath, on the paper, while you are holding it (v32). Last of the
      // three in this function, so in here it is what the line says.
      if (game.recordLive) game.recordLive('cathedral', palBreathIn);
    } else palFlushBreath(game);
    if (!palToldBreath && under && palBreathIn > 3) {
      palToldBreath = true;
      palToast('the bar is your breath now. it comes back the moment you surface.');
    }
  } else palFlushBreath(game);

  // ---- the bloom ----------------------------------------------------------
  if (palBloom > 0.55) {
    if (!palSeenBloom) {
      palSeenBloom = true;
      palToast('it is the plankton. it does this when something moves.');
    }
    if (!palBloomDone && under) {
      palBloomDone = true;
      palTask('the-bloom');
      palSaysNow('fire',
        ['Told you. Wait for the water. Every time.',
         'Put a paw in and lift it out. It runs off you and then it stops.',
         'It will go again in a minute. It always does.'],
        ['Quiet. Look at the water.']);
      palSaysNow('netman',
        ['Now you see why nobody fishes tonight. Nobody can see a net in that.',
         'Every fish in the bay is lit up from underneath. Every one.',
         'Twice a year, maybe. And you turn up on the day.'],
        ['Not now. Look at it.']);
      // ---- FRAMED, AND FROM THE SIDE ---------------------------------
      //
      // Measured at the payout on the reef: the rig is at its rest bearing,
      // 5.07 m out, and the eye is 1.16 m ABOVE the animal looking DOWN — at
      // the drop-off it is 27 degrees down. So the surface, the shafts coming
      // through it and the whole lit water column are out of frame, and the
      // picture of the one moment the chapter is for is the animal’s back
      // over sand.
      //
      // A CONSTRAINT A FIX HERE HAS TO RESPECT: camFloor is terrain + 0.95
      // (see the rig below), so on the reef bottom the eye can get only about
      // 0.19 m under the animal — a low angle is available mid-water and
      // nowhere else. pitch 0 is therefore the ask, not a negative one, and
      // the raise carries the frame up into the water instead.
      //
      // Side-on rather than astern: what lights up is the whole volume, and a
      // shot down the animal’s own axis has the least of it in frame.
      if (typeof game.frameShot === 'function')
        game.frameShot({ yaw: palBloomYaw(), dist: 9.5, pitch: 0.0, raise: 1.2, hold: 3.2 });
      // AND THE CHAPTER WAS ENTIRELY MONO — 0 of 35 palSfx calls carried an
      // `at:`, the payout chime being the loudest of them. Underwater, where
      // there is nothing to see but the water, a bearing is most of what a
      // sound is for.
      const bp = game.capy && game.capy.position;
      palSfx('chime', bp ? placeCue({ volume: 1.0, pitch: 1.35, force: true },
                                    bp.x, bp.y, bp.z, 80)
                         : { volume: 1.0, pitch: 1.35, force: true });
      if (typeof game.shake === 'function') game.shake(0.14);
    }
  }
}

// =============================================================== LIFECYCLE ===
export function createPalawan(game) {
  palGame = game;

  // The wheek lights the water. Bound once; it gates on the live biome and on
  // the animal actually being under, so it costs one comparison per wheek
  // anywhere else in the game. See THE WHEEK, UNDER.
  if (game.events && typeof game.events.on === 'function') {
    game.events.on('capy:wheek', function (payload) {
      if (!game.biome || !game.biome.isActive('palawan')) return;
      try { palWheekUnder(payload); } catch (e) {}
    });
  }

  game.biome.register('palawan', {
    ensureBuilt() { palBuild(game); },
    onEnter() {
      // The bay is put back to a couple of minutes before the bloom, so a
      // chapter you come back to opens the way it opened the first time.
      palPhase = 0.10;
      palBloom = 0; palBloomT = -1; palWarned = false;
      palTime = 0; palSub = 0;
      palTurtleWith = 0; palBreathIn = 0; palTurtleOff = 0; palTurtleTold = false;
      palBangkaT = 0; palBangkaDir = 1; palBangkaHold = 0; palBangkaRideT = 0;
      palBangkaPX = palBANGKA_A.x; palBangkaPZ = palBANGKA_A.z;

      palCarrying = false; palCarry.x = 0; palCarry.z = 0;
      palMantaA = 0.7; palMantaRideT = -1; palMantaCool = 0; palMantaTold = false;
      palToldDive = false; palToldCrack = false;
      palClamOpen = 0;
      // Ambient state, put back. A school still bolting from a wheek the
      // player does not remember and a column of somebody else's bubbles
      // hanging in the bay are both the wrong way to open a chapter.
      palFishBolt = 0; palTurtleWasUp = false; palClownHide = 0;
      palTernScare = 0; palTernSplash = 0;
      palDiverT = 0; palDiverPhase = -1;
      palRayState = 0; palRayT = 0;
      palRayX = palRAY.x; palRayZ = palRAY.z; palRayYaw = 0.6;
      palHeartT = 0; palLastDepth = 0; palGaspArmed = false; palCrackT = 0;
      palSwiftOut = 0;
      palWheekT = -1; palWheekEcho = -1;
      palBubT = 0;
      // ...and the rest of it. Every one of these is a latch or a running total
      // that only makes sense inside one visit: a bait-ball hold banked in a
      // session the player does not remember, a turtle caught mid-breath on the
      // opening frame, and three prompts that had already been used up so the
      // chapter came back with nothing to say. palTurtleT is the lap clock and
      // it is deliberately NOT zeroed to the same phase as palTime — she starts
      // her lap a third of the way round, well clear of a surfacing, so the
      // first thing a returning player sees is a turtle swimming.
      palBallIn = 0; palBallT = 0; palBallOff = 0; palBallVox = 0;
      palTurtleT = 24;
      palJumpArmed = false;
      palFireTold = false; palToldBreath = false;
      palDivePeak = 0;
      if (palBubData) for (let i = 0; i < palBUB_N; i++) palBubData[i * 5 + 3] = -1;
    },
    onExit() {
      // ARMED FLAGS DO NOT SURVIVE TRAVEL. Every biome shares one coordinate
      // space, and a latch left set is a task that ticks in the wrong country.
      palJumpArmed = false;
      // ...AND AN OPEN ATTEMPT IS FILED ON THE WAY OUT rather than thrown away.
      // All three of these are banked peaks now (see palFlushDive), so leaving
      // the chapter mid-dive, mid-lap or mid-breath is an end to the attempt
      // like any other. Flushed BEFORE the clears below, which zero them.
      palFlushDive(game); palFlushTurtle(game); palFlushBreath(game);
      // Anything stateful that could hold the player, cleared on the way out.
      palBangkaRideT = 0; palTurtleWith = 0; palBreathIn = 0; palBloomT = -1;
      palCarrying = false;
      // A ride in progress holds the animal PARKED; leaving the chapter in the
      // middle of one would carry that hold into the next chapter.
      if (palMantaRideT >= 0 && game.capy) game.capy.carriedBy = null;
      palMantaRideT = -1; palMantaCool = 0;
    },
  });

  const api = {
    /**
     * TIER 5, measured. `hitK` is how far into a strike the deepest tern is
     * and `deepest` how far under the water the lowest bird has actually got —
     * the number that says whether the dive reaches the fish at all. `spread`
     * is the mean radius of the shoal from its own centre, which is what a
     * hole in it moves.
     */
    ternDebug() {
      let deepest = 99, lowY = 99;
      if (palTernMesh) {
        for (let i = 0; i < palTERN_N; i++) {
          palTernMesh.getMatrixAt(i, palTernDbgM);
          const y = palTernDbgM.elements[13];
          if (y < lowY) lowY = y;
        }
        deepest = palWATER - lowY;
      }
      // ...and the MAX per-fish displacement from where that fish would have
      // been with no bird in the water, which is the number that says whether
      // a hole exists. Mean spread over a hundred and eighteen clumps is a
      // blunt instrument for a local 3 m hole: it moved thirteen millimetres
      // on the first measured cut and said nothing useful either way.
      let spread = 0, maxOff = 0;
      if (palBallMesh) {
        for (let i = 0; i < palBALL_N; i++) {
          palBallMesh.getMatrixAt(i, palTernDbgM);
          const e = palTernDbgM.elements;
          const rr = Math.hypot(e[12] - palBALL.x, e[14] - palBALL.z);
          spread += rr;
          // how far outside the undisturbed torus this clump has been pushed
          const off = Math.abs(rr - palBALL_R) - palBALL_TUBE;
          if (off > maxOff) maxOff = off;
        }
        spread /= palBALL_N;
      }
      return { hitK: Math.round(palTernHitK * 1000) / 1000,
               hitY: Math.round(palTernHitY * 100) / 100,
               lowestBirdY: Math.round(lowY * 100) / 100,
               underWaterBy: Math.round(deepest * 100) / 100,
               ballY: palBALL_Y, water: palWATER,
               spread: Math.round(spread * 1000) / 1000,
               maxOff: Math.round(maxOff * 1000) / 1000,
               scare: Math.round(palTernScare * 100) / 100 };
    },
    built() { return palBuilt; },
    terrainHeight: palTerrain,
    // ---- THE BLOOM IS ON A HUNDRED AND TWENTY-FOUR SECOND CLOCK (P3) ----
    // `the-bloom` is the chapter marquee and it wants the player UNDER the
    // water when the plankton light up. Being under is a breath and a swim, so
    // knowing whether that is worth starting now is the whole question.
    nextIn(id) {
      if (id !== 'the-bloom') return -1;
      if (palPhase > palBLOOM_ON && palPhase < palBLOOM_OFF) return 0;
      let d = palBLOOM_ON - palPhase;
      if (d < 0) d += 1;
      return d * palCYCLE;
    },
    slopeAt: palSlope,
    waterLevel: palWATER,
    isOverWater: palIsOverWater,
    waterHeightAt: palWaterHeightAt,
    inZone: palInZone,
    navBlocked: palNavBlocked,
    surfacePitch: palSurfacePitch,
    SPAWN: palSPAWN,

    /**
     * THE NEW VERB, AND THE WHOLE OF THE HOOK.
     *
     * capybara.js asks the live biome for this and nobody else. Twelve chapters
     * do not publish it and are untouched: their harbours are two metres of
     * nothing over a collision plane, and letting the player sink into one
     * would be a way to be stuck rather than a mechanic.
     */
    /**
     * THE MARQUEE IS THE MANTA (D4.0).
     *
     * Pasto's condor and Rio's fragata are the other two live marquees. Hers is
     * the only one that is neither a bird nor summonable: she laps the drop-off
     * whether anybody is watching or not, so the arrow points at a thing that is
     * always there and always moving, and finding her is most of the task.
     *
     * No null branch and no fallback needed — unlike a bird that has to be
     * whistled down, she exists from the first frame of the chapter.
     */
    marqueeAt() {
      const g = palMantaGroup;
      if (!g || !g.position || g.position.x !== g.position.x) return null;
      return { x: g.position.x, y: g.position.y, z: g.position.z };
    },
    canDive: true,
    // The reef is a place you fall through rather than walk over, and a hop off
    // a coral head wants steering. Nowhere near the Drift's 0.64 — this is not
    // a chapter about the air — but well clear of the kerb-hopping default.
    airControl: 0.42,

    /**
     * THE LENS GOES UNDER TOO, AND IT HAS TO.
     *
     * With the standing rig — forty-one degrees, nine and a half metres — the
     * camera sits about six metres over the animal, so a dive to a three-metre
     * seabed leaves it in the air and the whole second look of this chapter
     * never happens. Asked for at half a metre of depth: in close, and nearly
     * level, which puts the eye about a metre and a half over the animal and
     * under the surface the moment it is properly down.
     *
     * It is a REQUEST — systems.js multiplies it down by anything that already
     * owns the camera outright, and there is no argument to have about that.
     */
    rig() {
      const d = game.capy ? (game.capy.depth || 0) : 0;
      // TWO NUMBERS, AND BOTH WERE MEASURED RATHER THAN CHOSEN.
      //
      // The rig puts the eye `dist * sin(pitch)` over an anchor that already
      // sits a metre above the animal. At the standing rig (41 deg, 9.5 m) that
      // is six metres up, so a two-metre dive leaves the lens in the air and
      // this chapter's whole second look never fires. Flattening it to nothing
      // fixed that and broke something worse: at 6.6 m back and no pitch at all
      // the camera sits at coral height and spends the dive INSIDE a table
      // coral, which is a frame with no capybara in it.
      //
      // 5.0 m at 0.12 rad is the pair that works: 1.6 m over the animal, so it
      // goes under from about a metre and a half of depth, and 2.15 m over the
      // seabed once the animal has levelled out — which clears everything on
      // the reef except the barrel sponges.
      return { w: clamp((d - 0.45) / 1.1, 0, 1), dist: 5.0, pitch: 0.12,
               raise: 0.5, lambda: 2.4 };
    },
    /**
     * ...and the hard floor under the lens has to move with it. 1.7 is right in
     * a world whose ground is at zero and is a CEILING in one whose ground is
     * at minus eleven.
     */
    camFloor(x, z) { return palTerrain(x, z) + 0.95; },

    /** 0..1 — how far under the surface the camera should FEEL. systems.js
     *  reads this for the fog, the light and the muffle. */
    submerged() { return palSub; },
    bloom() { return palBloom; },
    blooming() { return palBloomT >= 0; },
    seenBloom() { return palSeenBloom; },

    // landmarks — the map and the beacons read these
    beach: { x: 0, z: 44 },
    jetty: { x: palJETTY.x, z: palJETTY.z0 + 1 },
    /** The fire ring on the beach. */
    fire: palFIRE,
    reef: palREEF,
    wreck: palWRECK,
    clam: palCLAM,
    crack: { x: palCRACK.x, z: (palCRACK.z0 + palCRACK.z1) * 0.5 },
    lagoon: { x: palLAG.x, z: palLAG.z },
    cathedral: { x: palCATH.x, z: palCATH.z },
    foot: { x: palFOOT.x, z: palFOOT.z },
    /**
     * THE DECK OF THE BANGKA. capybara.js asks; see capyCarryAt. Null unless
     * the animal is actually standing in the hull.
     */
    carryFrame() { return palCarrying ? palCarry : null; },

    /** The turtle MOVES. Ask; never cache. */
    // the bait ball. It MOVES — ask, never cache.
    baitBall() { return palBallPos; },
    /** ...and so does the manta, which is the point of it. */
    manta() { return palMantaPos; },
    turtle() {
      palTurtlePos(palTurtleT, palPt);
      palV3b.set(palPt.x, palPt.y, palPt.z);
      return palV3b;
    },
    /** So does the bangka. */
    bangka() {
      if (!palBangkaBody) return palSPAWN;
      palV3b.set(palBangkaBody.position.x, palBangkaBody.position.y, palBangkaBody.position.z);
      return palV3b;
    },

    update(dt) {
      if (!palBuilt) return;
      if (!game.biome.isActive('palawan')) return;
      // ---- TWELVE CHAPTERS OF PADDLING AND NO SEA (M13) ---------------
      // palBEACH_Z is where the sand goes under, so it is the waterline, and
      // the nearest point of it is directly offshore of wherever you are.
      // Quieter than Manly's break on purpose: this is a sheltered bay and
      // the whole chapter is about how still the water is.
      if (!palShoreBed && game.sfxMover) {
        palShoreBed = game.sfxMover('surf', { key: 'pal:shore', near: 34, far: 200 });
      }
      if (palShoreBed && game.capy && game.capy.position) {
        const lp2 = game.capy.position;
        palShoreBed.at(lp2.x, palWATER + 0.4, palBEACH_Z);
        palShoreBed.set(0.34);
      }
      palTime += dt;

      palUpdateClock(game, dt);
      palUpdateBangka(game, dt);
      palUpdateFish(game, dt);
      palUpdateSmallLife(game, dt);
      palUpdateDiver(game, dt);
      palUpdateTerns(game, dt);
      palUpdateRay(game, dt);
      palUpdateSwiftlets(game, dt);
      palUpdateBreath(game, dt);
      palUpdateWheek(game, dt);
      palUpdateReefSound(game, dt);
      palUpdateTurtle(dt);
      palUpdateBaitBall(game, dt);
      palUpdateManta(game, dt);
      palUpdateFire(game, dt);
      palUpdateCaustics(dt);
      palUpdateBubbles(game, dt);
      palUpdateBloom(game, dt);
      palUpdateTasks(game, dt);
      palCheckJetty(game);

      // ---- how far under are we, really ------------------------------------
      // Read off the CAMERA, not off the animal: the picture goes green when the
      // lens goes under, and the lens is eleven metres behind and four above.
      // Judging it from the capybara turns the surface into a light switch that
      // fires a second before anything on screen changes.
      const cam = game.camera;
      const camUnder = cam ? clamp((palWATER - 0.10 - cam.position.y) / 0.7, 0, 1) : 0;
      palSub = damp(palSub, camUnder, 5.0, dt);

      if (palWaterMesh) {
        palWaterMesh.position.y = palWATER + Math.sin(palTime * 0.55) * 0.045;
        // ---- THE SURFACE GLOWS TOO -----------------------------------------
        // Seen from the beach — which is where a player who has not yet learnt
        // the verb is standing — the bloom used to be invisible: the motes are
        // under the water and the water is a flat teal sheet. A bloom in a bay
        // is visible from the SAND, and that is the whole reason anybody walks
        // down to look. One emissive term on the sheet the player is already
        // looking at, and the toast about the water going cloudy is true.
        const wm = palWaterMesh.material;
        if (wm && wm.emissive) {
          wm.emissive.copy(palBloomC);
          emitSet(wm, palBloom * 0.42);
        }
      }
    },
  };
  game.palawan = api;
  return api;
}

function palBuild(game) {
  if (palBuilt) return;
  palBuilt = true;
  palInitGeos();

  palRoot = new THREE.Group();
  palRoot.name = 'palawan';
  game.scene.add(palRoot);

  // ---- the ground, which for once is mostly the SEABED ---------------------
  // Sampled finer than any other biome, because it is the thing the player
  // spends this chapter half a metre away from, looking at. A reef read through
  // fifteen-metre cells is a beige carpet.
  //
  // BUT NOT UNIFORMLY, AND THAT WAS COSTING A THIRD OF THE CHAPTER. It was a
  // flat 150 x 190 grid — two-metre cells over the whole three hundred by three
  // eighty — which is 57,000 triangles, thirty-nine per cent of everything in
  // Palawan, and most of it spent on the abyssal plain out past the drop-off
  // where the seabed is one number. Measured: the chapter totalled 145,639 and
  // rendered 152,640 from the drop-off, against a stated ceiling of 130,000.
  //
  // So the grid is WARPED, exactly the way Pasto warps its cells toward Galeras:
  // a monotone squeeze (k < 1 guarantees monotone) that pulls vertices into the
  // middle, where the reef, the drop-off, the crack, the lagoon and the
  // cathedral all are. 96 x 122 warped gives 1.6 m cells through the middle —
  // FINER than the uniform grid it replaces — and 6 m out on the plain, for
  // 23,424 triangles. The mesh edges land on exactly the same coordinates,
  // because s = +/-1 maps to itself.
  {
    // 88 x 110, NOT 96 x 122. Still 1.75 m cells through the reef — finer than
    // any other chapter's ground and finer than the uniform grid this warp
    // replaced — and four thousand triangles back for the animals that live on it.
    const g = new THREE.PlaneGeometry(300, 380, 78, 96);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -60);
    const p = g.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) {
      p[i] = palWarp(p[i], 150);
      p[i + 2] = palWarp(p[i + 2] + 60, 190) - 60;
    }
    const col = new Float32Array(p.length);
    const dry = new THREE.Color(PALETTE.palSand);
    const wetc = new THREE.Color(PALETTE.palSandWet);
    const deep = new THREE.Color(PALETTE.palAbyss);
    const rock = new THREE.Color(PALETTE.palKarstDk);
    for (let i = 0; i < p.length; i += 3) {
      const h = palTerrain(p[i], p[i + 2]);
      p[i + 1] = h;
      // A BEACH DOES NOT HAVE AN EDGE ON IT, and this was the one waterline in
      // the game that did. `dry` above one contour and `wetc` below it is a
      // step, so the swash zone — the band of sand that is wet because the sea
      // was just there, which is the whole visual signature of a beach — did
      // not exist above the waterline at all: the sand went from 0.92 albedo to
      // teal across one row of vertices.
      //
      // Continuous at h = 0.1 by construction, so it cannot introduce a seam of
      // its own: at 0.1 the ramp is fully wet, which is exactly what the branch
      // below starts from. Half a metre of rise is about four metres of beach at
      // this slope, which is what a swash zone is.
      if (h > 0.1) palCol.copy(dry).lerp(wetc, clamp((0.55 - h) / 0.45, 0, 1));
      else {
        palCol.copy(wetc).lerp(deep, clamp(-h / 12, 0, 1));
        // the rock floors of the lagoon, the tunnel and the cathedral are not
        // sand and must not read as sand
        if (p[i + 2] < palISLE_Z) palCol.lerp(rock, 0.45);
      }
      col[i] = palCol.r; col[i + 1] = palCol.g; col[i + 2] = palCol.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    const gm = new THREE.Mesh(g, palVCG());
    gm.receiveShadow = true;
    gm.frustumCulled = false;
    gm.name = 'palSeabed';
    palRoot.add(gm);
  }

  // ---- the collision floor -------------------------------------------------
  // MIND WHICH WAY THE SECOND AXIS RUNS. A CANNON heightfield is authored in
  // its own xy plane and the Rx(-90) that stands it up maps local +y onto world
  // MINUS z — so j has to walk BACK from the far edge. Getting it wrong leaves
  // the biome with no collision floor at all, and capybara.js's analytic
  // backstop hides that from you completely until something else dynamic falls
  // through the world. Sampled at 4 m, which is what the relief here needs.
  {
    const X0 = -150, EL = 4;
    const NX = 76, NZ = 96;
    const Z0 = -250, Z1 = Z0 + NZ * EL;
    const data = [];
    for (let i = 0; i <= NX; i++) {
      const row = [];
      for (let j = 0; j <= NZ; j++) row.push(palTerrain(X0 + i * EL, Z1 - j * EL));
      data.push(row);
    }
    const hf = new CANNON.Heightfield(data, { elementSize: EL });
    const b = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
    b.addShape(hf);
    b.position.set(X0, 0, Z1);
    b.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    palSyncBody(b);
    game.world.addBody(b);
  }

  palBuildIsland(game, palRoot);
  palBuildBeach(game, palRoot);
  palBuildReef(game, palRoot);
  palBuildBackRooms(game, palRoot);
  palBuildSmallLife(palRoot);
  palBuildDiver(palRoot);
  palBuildTerns(palRoot);
  palBuildRay(palRoot);
  palBuildSwiftlets(palRoot);
  palBuildFish(palRoot);
  palBuildTurtle(palRoot);
  palBuildBaitBall(palRoot);
  palBuildManta(palRoot);
  palBuildFire(palRoot);
  palBuildClam(game, palRoot);
  palBuildBangka(game, palRoot);
  palBuildCaustics(palRoot);
  palBuildBubbles(palRoot);
  palBuildShafts(palRoot);
  palBuildBloom(palRoot);
  palBuildWater(palRoot);       // last: it is transparent and it must sort over

  // ---- THE PEOPLE WHO LIVE HERE ------------------------------------------
  // See npc.js, THE LOCALS. Each of these is a point somebody is standing at,
  // a few things they might say when the capybara turns up, and a different
  // few for when it wheeks at them. Where the chapter owns a Group for the
  // figure, it is handed over too and the figure turns to watch.
  //
  // ---- AND THEY KNOW WHAT THE WATER IS DOING (v21) -----------------------
  //
  // Seven people on a beach, in a chapter with a clock on it — the bloom comes
  // round every hundred and twenty-four seconds — and not one of them ever
  // mentioned it happening. The man who is literally waiting for it said "wait
  // for the water to light up, then you will see something" WHILE THE WHOLE
  // BAY WAS LIT UP.
  //
  // Four states of the evening plus one that is about the player rather than
  // the world, and the six line-swaps that used to be done destructively by
  // palSaysNow are now `after:` entries that compose with all of it. See the
  // long note on palSaysNow for why that mattered.
  //
  // Same rule as the other two chapters in this pass: EVERY POOL KEEPS AT
  // LEAST ONE UNCONDITIONAL LINE, or there is a state in which somebody has
  // nothing to say and just stands there being scenery.
  const palDark   = () => palBloom < 0.15 && !palSeenBloom;
  const palSoon   = () => palBloom < 0.15 && palSeenBloom;
  const palLit    = () => palBloom > 0.4;
  const palWet    = () => !!(game.capy && (game.capy.wet || 0) > 0.5);
  const palDown   = () => !!(game.capy && (game.capy.depth || 0) > 0.65);

  if (typeof game.addLocal === 'function') {
    // -0.7, NOT -3. The jetty deck is palJETTY.w = 2.4 m wide about x = 6, so
    // x - 3 is a metre and a half off the side of it: the boatman has been
    // standing on thin air a metre above the sea, at deck height, since the
    // chapter shipped. Caught by measuring every local's y against the live
    // terrainHeight — see [[the locals]], rule 4.
    palLocals.boatman = game.addLocal({ biome: 'palawan', x: palJETTY.x - 0.7, y: palJETTY.y, z: palJETTY.z0 + 2, near: 7,
      // THE AUTHORITY (L3, F1): the boat is his, and the jetty goes with it
      authority: true, role: 'the boatman',
      figure: { shirt: PALETTE.cloth2, skin: PALETTE.skin3, hat: PALETTE.khaki },
      lines: [{ t: 'Bangka leaves when the bangka leaves. Sit at the front.',
                before: 'outrigger' },
              { t: 'You sat at the front. Good. Everybody sits at the back and gets wet.',
                after: 'outrigger' },
              { t: 'Same crossing, eleven thousand times. Still the same crossing.',
                after: 'outrigger' },
              'Outriggers keep her up. Do not stand on them.',
              'Big water today. Good water.',
              { t: 'She goes out and she comes back. That is the timetable.', when: palDark },
              { t: 'No fishing tonight. Nobody puts a net in that.', when: palLit },
              { t: 'You are dripping on my rope.', when: palWet },
              { t: 'Anything under the island, you tell me. I have never been under it.',
                before: 'the-crack' }],
      wheek: ['Ho! You will bring the whole bay over.',
              { t: 'Do that out there and the whole island answers.', when: palLit }],
      // ---- AND THE BLOOM, BECAUSE HE IS THE ONLY ONE WHO CAN SEE IT ----
      // The chapter’s marquee happens under the water and the two people who
      // hold `the-bloom` lines — the fire and the netman — are 53.9 m and
      // 47.9 m from the reef, outside npcLOC_WOW_R’s forty. Only 22.5% of the
      // chapter’s 1,632 divable cells are within 40 m of ANYBODY. The boatman
      // at 21.9 m and the boy at 29.1 m are the only two ever in range, and
      // they are on the jetty, which is where you would be standing to watch
      // somebody come up out of a lit bay.
      onTask: { 'the-bloom': ['You were under it. Under it. Nobody goes under it.',
                              'Whole bay from below. I have wanted that for forty years.'],
                'outrigger': ['At the front. Standing. On MY boat.'],
                'jetty-jump': ['Off the end. Everybody goes off the end eventually.'],
                'the-manta': ['You were ON it. It came out of the water and you were ON it.'] } });
    palLocals.fire = game.addLocal({ biome: 'palawan', x: palFIRE.x + 2.5, y: palTerrain(palFIRE.x + 2.5, palFIRE.z),
      z: palFIRE.z, near: 6,
      figure: { shirt: PALETTE.cloth8, skin: PALETTE.skin3 },
      lines: ['Fire is for after dark. It is barely after dark.',
              { t: 'Wait for the water to light up. Then you will see something.',
                when: palDark },
              { t: 'It went once already. It will go again — it always goes again.',
                when: palSoon },
              // ...and when it IS lit he stops selling it and just looks at it,
              // which is the entire difference between a person and a sign
              { t: 'Told you. Wait for the water. Every time.', when: palLit },
              { t: 'My grandmother called it the sea remembering something.', when: palLit },
              { t: 'Do not put that out. I only just got it going.', before: 'beach-fire' },
              { t: 'Half an hour of driftwood and one wet rodent.', after: 'beach-fire' },
              { t: 'Go on. Go and be wet somewhere else.', after: 'beach-fire' },
              { t: 'You are extremely wet and you are extremely near my fire.',
                before: 'beach-fire', when: palWet }],
      wheek: ['Everybody down the beach heard that.',
              { t: 'Quiet. Look at the water.', when: palLit }],
      onTask: { 'beach-fire': ['Well. That is the fire.',
                               'Thirty kilos of wet rodent. I never stood a chance.'],
                'the-bloom': ['You were UNDER it. Nobody is ever under it.'] } });

    // ---- AND FIVE MORE. Four houses on stilts with nobody in them is a model
    // village, and this chapter had the second-emptiest cast in the game.
    palLocals.netman = game.addLocal({ biome: 'palawan', x: -4.5, y: palTerrain(-4.5, 52), z: 52, near: 7,
      // D2: a man mending a net walks its length. Along the beach, parallel to
      // the water, so the route keeps one depth.
      walk: { dx: 8.5, dz: 0, dwell: 5 },
      figure: { shirt: PALETTE.palBangkaTrim, skin: PALETTE.skin3, hat: PALETTE.palThatch },
      // mending it, for as long as there is light
      beat: { kind: 'work', every: 4.6, dur: 0.9, sfx: 'rustle', volume: 0.08, pitch: 1.25 },
      lines: ['Net has a hole in it. Net always has a hole in it.',
              'Two hundred fish in that bay and every one of them knows me.',
              'You are standing on the good end. Move up.',
              { t: 'Now you see why nobody fishes tonight. Nobody can see a net in that.',
                when: palLit },
              { t: 'Every fish in the bay is lit up from underneath. Every one.',
                when: palLit },
              { t: 'Twice a year, maybe. And you turn up on the day.',
                when: palLit, after: 'the-bloom' },
              { t: 'There is a ball of sardines out past the coral. Do not ask me why.',
                before: 'bait-ball' },
              { t: 'You swam into the middle of it. Of course you did.', after: 'bait-ball' },
              { t: 'Mending is the job. Fishing is what happens in between mending.',
                when: palDark }],
      wheek: ['Fish heard that. Fish are gone. Thank you.',
              { t: 'Not now. Look at it.', when: palLit }],
      onTask: { 'bait-ball': ['Straight through the middle. They closed up behind him.'],
                'the-bloom': ['Twice a year, and he turns up on the day.'],
                'giant-clam': ['That clam is older than this village. It did not even shut.'] } });

    palLocals.drying = game.addLocal({ biome: 'palawan', x: 16, y: palTerrain(16, 52.5), z: 52.5, near: 7,
      figure: { shirt: PALETTE.palCoralOrange, skin: PALETTE.skin3 },
      lines: ['Dry them two days. Three if the rain comes. It comes.',
              'That is not washing. Half of it is lunch.',
              'Under the house is cooler than in the house. Always was.',
              { t: 'You are standing on my drying mat and you are made of seawater.',
                when: palWet },
              { t: 'Everyone comes out for that. Even the ones who say they do not.',
                when: palLit },
              { t: 'Fifty-one years under this house and I have seen it maybe ninety times.',
                when: palLit }],
      wheek: ['The whole row is going to want to know what that was.',
              'Half the dogs on this beach just stood up.'],
      praise: ['I saw. I see everything from under here.',
               'That is going round the whole village by morning.'] });

    palLocals.painter = game.addLocal({ biome: 'palawan', x: 22, y: palTerrain(22, 49), z: 49, near: 7,
      figure: { shirt: PALETTE.palWeed, skin: PALETTE.skin3, hat: PALETTE.palBamboo },
      // every dry season, and this is one
      beat: { kind: 'work', every: 2.8, dur: 0.8, sfx: 'rustle', volume: 0.09, pitch: 0.8 },
      lines: ['Scrape her, paint her, scrape her again. Every dry season.',
              'She has been out to the island eleven thousand times.',
              'Bamboo, not fibreglass. Bamboo bends. Fibreglass argues.',
              { t: 'Eleven thousand and one, now. He rode her out.', after: 'outrigger' },
              { t: 'I paint by the fire and I paint badly. Tomorrow, then.', when: palDark },
              { t: 'Brush down. Nobody paints through that.', when: palLit },
              { t: 'Do not shake yourself here. Do NOT shake yourself here.', when: palWet }],
      wheek: ['Careful. Wet paint and a loud animal.',
              'That went right through the hull. I felt it in the wood.'],
      onTask: { 'outrigger': ['She goes out and she comes back. Every time. Good boat.'] } });

    // ON THE DECK, NOT BESIDE IT. The jetty is 2.4 m wide about x = 6, so
    // x + 2.2 is a metre off the planking and the boy was standing on the sea
    // at deck height. See [[the locals]], rule 4: probe before you place.
    palLocals.boy = game.addLocal({ biome: 'palawan', x: palJETTY.x + 0.6, y: palJETTY.y,
      z: palJETTY.z1 - 2.5, near: 6.5,
      figure: { shirt: PALETTE.palFishA, skin: PALETTE.skin3 },
      lines: [{ t: 'You go off the end. Everybody goes off the end.', before: 'jetty-jump' },
              { t: 'See? Everybody goes off the end.', after: 'jetty-jump' },
              { t: 'Now do it from the far post. That is the real one.', after: 'jetty-jump' },
              { t: 'Deeper at the far post. Do not check. Just go.', before: 'jetty-jump' },
              { t: 'Turtle comes through about now. Sixty years old, they say.',
                before: 'sea-turtle' },
              { t: 'You kept up with her! Nobody keeps up with her.', after: 'sea-turtle' },
              { t: 'Sixty years. My father followed her when he was my size.',
                after: 'sea-turtle' },
              // he is on the jetty, so he is the person who would notice the
              // one thing this chapter asks you to do that nobody can see
              { t: 'Are you down there? You have been down there ages.',
                when: palDown },
              { t: 'It does that when you kick it. Kick it. Go on, kick it.',
                when: palLit },
              'This is my jetty. I have decided.'],
      wheek: ['Go on then. Off the end.',
              { t: 'She has heard that a thousand times. She does not care.',
                after: 'sea-turtle' }],
      onTask: { 'the-bloom': ['It went all round you! It went ALL ROUND YOU!',
                              'Do it again. Go down again. Please.'],
                'jetty-jump': ['You did not even check how deep it was. Respect.'],
                'sea-turtle': ['She comes up for air about now. Watch. Right about now.'],
                'first-dive': ['He went UNDER. Properly under. Did you see how long?'],
                'cathedral': ['You found the room with the hole? Nobody finds that.'] } });

    // ...and the landing beach shelves, so its height is a function and not a
    // guess: measured, palTerrain there is -0.21 and the hard-coded 1.6 had
    // this one standing nearly two metres above the sand.
    palLocals.lagoon = game.addLocal({ biome: 'palawan', x: palFOOT.x - 4,
      y: palTerrain(palFOOT.x - 4, palFOOT.z + 4), z: palFOOT.z + 4, near: 7,
      figure: { shirt: PALETTE.palPearl, skin: PALETTE.skin3, hat: PALETTE.palThatch },
      lines: [{ t: 'Only two ways into the lagoon and one of them is under the rock.',
                before: 'the-crack' },
              { t: 'You went under it. Of course you went under it.', after: 'the-crack' },
              { t: 'Nobody from the village has been in there in nine years.',
                after: 'the-crack' },
              { t: 'It is bigger than the bay, in there. Nobody believes me.',
                after: 'the-crack' },
              { t: 'You will not swim it on top. Nobody swims it on top.',
                before: 'the-crack' },
              { t: 'Wait for the water to go quiet. Then hold your breath and go down.',
                before: 'the-crack' },
              'The rock goes all the way round. All the way. I have walked it.',
              { t: 'In there it will be going too. Same water.', when: palLit }],
      wheek: ['That goes all the way through the crack, that does.',
              { t: 'Do that in the lagoon. Just once. You will see.', after: 'the-crack' }],
      onTask: { 'the-crack': ['Nine years. Nine years and a rodent does it on the first go.'],
                'cathedral': ['The hole in the roof. So it IS real. I told them it was real.'] } });

    // ---- THE AUTHORITY, AND WHERE TO HIDE FROM THEM (L3, F1) -------------
    // The boatman is the one who carries you out. Where you go so that he
    // cannot: under two of the houses on stilts (the `huts` table in the beach
    // build — only the walled room is solid), in among the third hut's line of
    // washing (its poles hang at hx - 4.2..-7.0, hz - 2.4), and under the
    // outrigger arms of the middle beached bangka (the `beached` table: the
    // arms are a metre off the sand and the float is 3.5 m out). The sea is
    // water, and water is a hide everywhere.
    if (typeof game.addHide === 'function') {
      game.addHide({ biome: 'palawan', x: -11, z: 58, r: 2.0, kind: 'under the house' });
      game.addHide({ biome: 'palawan', x: 31, z: 52, r: 2.0, kind: 'under the house' });
      game.addHide({ biome: 'palawan', x: 14 - 5.6, z: 56 - 2.4, r: 1.6, kind: 'the washing' });
      game.addHide({ biome: 'palawan', x: -19 + Math.cos(0.2) * 2.2, z: 35 - Math.sin(0.2) * 2.2,
        r: 1.6, kind: 'under the outrigger' });
    }

    // ---- AND THEY TALK TO EACH OTHER ---------------------------------------
    // Seven people on one beach, all of them facing the sea, none of them ever
    // saying a word to each other — so unless the player walked up and stood
    // in front of somebody, this village was silent. Pairs chosen by measured
    // distance, because npcEX_MAX bounds the PLAYER's distance to the nearer
    // speaker and does nothing at all about how far apart the two of them are:
    // boatman to boy is 4.5 m down the same jetty, and the fire to the netman
    // is 24 m along the sand, which is about as far as anybody shouts at dusk.
    if (typeof game.addExchange === 'function') {
      if (palLocals.boatman && palLocals.boy) {
        game.addExchange({ biome: 'palawan', a: palLocals.boy, b: palLocals.boatman, lines: [
          ['Can I go on the boat?', 'You went on the boat yesterday.'],
          ['That animal has been under for a very long time.', 'That animal knows what it is doing.'],
          ['Is she coming through tonight?', 'She comes through every night. That is what she does.'],
          ['I could swim to the island.', 'You could not swim to the end of the jetty.'],
        ] });
      }
      // ---- TWO OF THE THREE PAIRS COULD NOT SHOW BOTH BUBBLES ----------
      // npcEX_MAX (26 m) bounds the player’s distance to the NEARER speaker,
      // not the pair’s distance to each other — so at that limit the far one
      // can be 52.8 m away and off the screen. Measured: netman to fire 26.8 m,
      // drying to painter 24.4 m, against a conversational 4.6 m and a legible
      // 13 m. The boy and the boatman are 9.6 m apart and were always fine.
      //
      // Moved rather than re-paired: a man tending a fire and a man mending a
      // net at the same fire is a truer picture than either of them standing
      // alone, and the painter works on the boat the washing is strung beside.
      if (palLocals.fire && palLocals.netman) {
        game.addExchange({ biome: 'palawan', a: palLocals.netman, b: palLocals.fire, lines: [
          ['Is it going tonight?', 'It is always going. You just have to wait for it.'],
          ['Put more wood on, I cannot see the net.', 'Put the net down and look at the water.'],
          ['Two hundred fish out there and I have caught none.', 'Because you are talking to me.'],
        ] });
      }
      if (palLocals.drying && palLocals.painter) {
        game.addExchange({ biome: 'palawan', a: palLocals.drying, b: palLocals.painter, lines: [
          ['Your paint is on my washing.', 'Your washing is on my boat.'],
          ['Every dry season, the same argument.', 'Every dry season, the same washing.'],
          ['Did you see what went past?', 'I am painting. I see nothing. Ever.'],
        ] });
      }
    }
  }

  if (typeof game.registerShadowTarget === 'function') game.registerShadowTarget(palRoot);
  // ...AND THEN TAKE IT BACK OFF THE THINGS THAT ARE NOT THERE. The last line of
  // the build, after the register, because the register is what set them.
  palNoShadowOnGhosts(palRoot);
}

// ========================================================= THE WHEEK, UNDER =
/**
 * THE ONE VERB THIS GAME IS NAMED AFTER, IN THE ONE CHAPTER IT MEANS MOST IN.
 *
 * `capy:wheek` is the first task in the game and the only button that is never
 * about anything else. Above water it is a shout: it puts up pigeons, it makes
 * a foreman lean over a scaffold, it empties a square. Under water — in the
 * chapter whose entire subject is being under water — it did NOTHING. The
 * school bolted (palUpdateFish has watched `honkPressed` since the chapter
 * shipped) and that was the whole of it: no sound of its own, no picture, and
 * no reason at all to press it while diving.
 *
 * Which is a waste of the best physical fact available here. SOUND TRAVELS
 * FOUR AND A HALF TIMES FASTER IN WATER AND IT DOES NOT ATTENUATE THE WAY IT
 * DOES IN AIR, so a noise made under the surface is felt as much as heard, it
 * arrives everywhere at once, and it is LOW. And this bay is full of
 * bioluminescent plankton that light up when something moves them.
 *
 * So: wheek under water and a shell of light leaves the animal at about eight
 * metres a second and runs out through the marine snow. It is not a new object
 * and not a new draw call — it is a term added to the size of motes the shell
 * is passing through, in the loop that was already writing all two hundred and
 * forty of them. In bloom it is a wall of green going away from you across the
 * whole bay. Out of bloom it is a faint ring in the silt, which is honest: the
 * plankton are still there, they are just not switched on.
 *
 * And it works on the bait ball, the turtle and the terns for free, because
 * those already read palFishBolt / their own scare hooks.
 *
 * There is no task on this and there never will be. It is a thing that is true
 * about the water, the player finds it by pressing the button they have been
 * pressing since Sydney, and the first time it happens in the dark it is the
 * best twenty seconds in the chapter that nobody designed.
 */
// ---- HOW HARD A MANTA STIRS THE WATER (D4.2) -----------------------------
// A shade under the capybara's own 0.9 coefficient, over four times the
// radius: she is a much bigger animal moving much more gently, and the thing
// that reads on screen is the WIDTH of the disturbance rather than its
// violence. 36 is 6 m squared, against the animal's 12 (3.46 m).
const palMANTA_STIR = 0.62;
const palMANTA_STIR_R2 = 36;
const palWHEEK_V = 8.2;            // m/s — the shell's speed. Slow enough to SEE.
const palWHEEK_W = 2.6;            // m — how thick the shell is
const palWHEEK_LIFE = 4.2;         // s — it fades out at about thirty-four metres
let palWheekT = -1;
const palWheekP = new THREE.Vector3();

/** Bound to capy:wheek in createPalawan. Gates on being genuinely under. */
function palWheekUnder(payload) {
  const capy = palGame && palGame.capy;
  const p = (payload && payload.position) || (capy && capy.position);
  if (!p || !capy) return;
  if ((capy.depth || 0) < 0.5) return;
  palWheekT = 0;
  palWheekP.set(p.x, p.y, p.z);
  // ---- AND IT SOUNDS LIKE IT IS HAPPENING TO YOUR RIBS -------------------
  // Two voices under the animal's own wheek (systems.js plays that one on the
  // event, unconditionally, and it should — it is the same animal). A long low
  // thud arriving with it, and a second one a beat later off the karst, which
  // is what a bay with a limestone wall round three sides of it does with a
  // noise. Both are quiet: this is a feeling, not an announcement.
  palSfx('thud', { volume: 0.34, pitch: 0.30 });
  palWheekEcho = 0.38;
}
let palWheekEcho = -1;

function palUpdateWheek(game, dt) {
  if (palWheekEcho >= 0) {
    palWheekEcho -= dt;
    if (palWheekEcho <= 0) {
      palWheekEcho = -1;
      palSfx('thud', { volume: 0.16, pitch: 0.26 });
    }
  }
  if (palWheekT < 0) return;
  palWheekT += dt;
  if (palWheekT > palWHEEK_LIFE) palWheekT = -1;
}

/** 0..1 — how hard the shell is lighting a mote at (x, y, z). Zero when idle. */
function palWheekAt(x, y, z) {
  if (palWheekT < 0) return 0;
  const r = palWheekT * palWHEEK_V;
  const d = Math.hypot(x - palWheekP.x, y - palWheekP.y, z - palWheekP.z);
  const off = Math.abs(d - r);
  if (off > palWHEEK_W) return 0;
  // a soft shell, and the whole thing fades as it gets further out — a ring of
  // constant brightness at thirty metres reads as a hoop rather than a wave
  const k = 1 - off / palWHEEK_W;
  return k * k * clamp(1 - palWheekT / palWHEEK_LIFE, 0, 1);
}
