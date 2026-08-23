import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PALETTE, mat, rand, randInt, clamp, damp, lerp, grain, grainOwn } from './shared.js';

// ===========================================================================
// CHAPTER 13 — CAPPADOCIA. AND YOU DO NOT GET A STEERING WHEEL.
//
// Thirteen chapters in which the player pushed a stick and the world went that
// way. The one chapter that takes the stick away is the one that has to earn
// it, and this one earns it with a fact rather than a rule:
//
//   A BALLOON HAS NO STEERING. IT HAS A BURNER AND A VENT.
//   THE WIND GOES A DIFFERENT WAY AT EVERY HEIGHT.
//   SO YOU STEER BY CHOOSING A HEIGHT.
//
// That is not a game mechanic somebody invented — it is exactly and only how
// balloon pilots navigate, everywhere, and it is why they all fly at dawn: the
// layers are cleanest before the ground warms up and stirs them together. In
// Göreme a hundred and fifty of them go up in the same half hour, which is the
// other reason this is the chapter it is.
//
//   HOLD E     the burner. up, and it takes four seconds to answer.
//   LET GO     it cools, and it comes down. there is no second control.
//   SPACE      the hop, exactly as it has always been — which is how you get
//              OUT of the basket, and is precisely why it could not be a vent.
//   the stick  nothing. absolutely nothing. that is the joke and the lesson.
//
// THE LAG IS THE SKILL. A burner that answered instantly would make this a
// lift, and a lift is not a puzzle. Four seconds means you commit to a layer
// before you can see whether it was the right one, and coming back is another
// four seconds — so the chapter is about reading the sky rather than reacting
// to it. WHICH IS WHY THE WISPS ARE THERE: every layer carries thin streaks of
// cloud moving at that layer's own speed and bearing, so the whole wind map is
// legible out of the window and nothing had to be put on the HUD.
//
// North to south, and the player faces -z on arrival:
//
//   z  58..26   GÖREME. houses cut into the rock, blue doors, and a road.
//   z  20..-10  THE LAUNCH FIELD. three envelopes on their sides at five a.m.
//   z -14..-78  LOVE VALLEY. seventy fairy chimneys, and six you can climb.
//   x -78       THE DOVECOTE CLIFF, drilled with four hundred pigeon holes.
//   z -96       THE LANDING PLAIN, and a truck that chases you across it.
//   x  118      THE RIDGE. the sun comes over THAT, and that is the marquee.
//
// Everything is prefixed `gor` (contract: the bundler flattens every module
// into one scope).
// ===========================================================================

// ---------------------------------------------------------------- geography --
const gorSPAWN = { x: 0, y: 1.6, z: 34 };

const gorTOWN_Z = 26;                // south edge of Göreme
const gorFIELD = { x: 0, z: 4, w: 46, d: 28 };
// THE ARRIVAL SQUARE. Flat, and nothing may be built inside it. Every other
// chapter has one of these — Sydney's lawn, the Piazzetta, the pavement in Mong
// Kok — and this one shipped without it, which is how the opening shot of the
// chapter came to be the inside of a roof.
const gorPLAZA = { x: 0, z: 34, r: 13, y: 7.0 };
const gorVALLEY_Z0 = -80, gorVALLEY_Z1 = -12;
const gorCLIFF = { x: -78, z0: -66, z1: -18, top: 34 };
const gorLAND = { x: 34, z: -96, r: 26 };
const gorRIDGE_X = 118;

// ---- the wind, which is the whole chapter ----------------------------------
// Five layers. The numbers are chosen so that no two adjacent layers point the
// same way and so that the two you need for the two flying tasks are NOT
// adjacent — the shortest route to the landing plain goes up through a layer
// that takes you the wrong way, which is the entire puzzle in one sentence.
//
//   base   the height the layer starts at
//   x, z   metres per second, world axes
//   name   what the toast calls it, because a layer you cannot name is a layer
//          you cannot plan with
const gorLAYERS = [
  { base: 0,   x: 0.00, z: 0.00, name: 'dead calm' },
  { base: 16,  x: 2.70, z: -1.10, name: 'east, and slow' },
  { base: 52,  x: -1.10, z: -3.60, name: 'down the valley, and quick' },
  { base: 98,  x: -2.90, z: 2.30, name: 'back over the town' },
  { base: 152, x: 1.10, z: 3.70, name: 'the high one, and it goes home' },
];
const gorBLEND = 9;                  // m of transition between layers

// ---- AND IT HAS TO BRING YOU BACK -----------------------------------------
// Measured: hold the burner into layer two and stay there and the balloon is
// four hundred metres south of the world in ninety seconds, with the ground
// mesh behind it and nothing under the basket but the inside of the sky dome.
// A real balloon does exactly that and a real balloon has a chase truck and a
// road; this one has a valley it must not be able to leave.
//
// The fix is the thing a valley actually does. Cold air pools in a basin and
// the flow curls back at the rim, so past gorRIM the layer's bearing is bent
// toward the middle and by gorRIM_HARD it points there outright. It is visible
// while it happens — the wisps read the same function, so the player watches
// the air turn round rather than hitting an invisible wall — and it means no
// sequence of burns can ever strand anybody.
const gorMID = { x: 10, z: -30 };
// 52 AND 86, NOT 78 AND 118. The curl works at any radius; what matters is
// WHERE it parks you. At the wider setting the balloon settled ninety-six
// metres from the middle of the valley — out past the last chimney, over bare
// ground, with the marquee shot of the chapter looking at nothing. The rim is
// now inside the scenery rather than outside it.
const gorRIM = 52;
const gorRIM_HARD = 86;

// ---- the balloon -----------------------------------------------------------
const gorBURN_V = 1.75;              // m/s of climb at a full burner
const gorSINK_V = -1.30;             // and of descent with the burner off
const gorBURN_LAG = 0.26;            // lambda: the burner takes about four seconds
const gorCOOL_LAG = 0.85;            // and the envelope cools rather faster than that
const gorDRIFT_LAG = 0.55;           // how fast the envelope takes up a new layer
// A LOW BASKET, AND ON PURPOSE. A real one is chest-high on a person, which
// scaled to a capybara is a box with the animal completely inside it — and an
// animal you cannot see is an animal you cannot play. Sixty centimetres reads
// as a basket from this camera and leaves the whole head and back in frame.
const gorBASKET = { w: 3.0, d: 3.0, h: 0.62 };
const gorENV_R = 6.2;                // envelope radius
const gorCEIL = 205;                 // above this the burner simply stops working
const gorDECOR_N = 26;               // the other balloons

// ---- the clock -------------------------------------------------------------
const gorCYCLE = 156;                // s — one dawn, on a loop
const gorLAUNCH_P = 0.240;           // the field starts sending them up
const gorSUN_P = 0.470;              // and the sun clears the ridge
const gorDAY_P = 0.760;

const gorCHIM_N = 74;
// WHERE THE CHIMNEYS ACTUALLY WENT. They are placed by a seeded random walk
// inside gorBuildValley and, until now, nothing outside that function could
// ever know where any of them was — which is why the valley floor between them
// was bare. x, z, base radius, three floats each. See gorBuildScatter.
const gorCHIM_POS = [];
const gorWISP_N = 120;
// FOUR HUNDRED HOLES AND A HUNDRED AND SIXTY BIRDS. The cliff's own comment
// says four hundred; at sixty triangles a bird 260 is still a fifth of what one
// merged fairy chimney costs, and a dovecote that is half empty at rest is a
// dovecote nobody has ever kept pigeons in.
const gorPIGEON_N = 260;

// ---------------------------------------------------------------- scratch ---
const gorV3 = new THREE.Vector3();
const gorV3b = new THREE.Vector3();
// A SECOND SCRATCH VECTOR, and it is not a luxury: envelope() and mouth() both
// returned gorV3b, so any caller that held one while asking for the other got
// the same object twice. Caught by a QA probe that printed the two side by side
// and got the same three numbers.
const gorV3c = new THREE.Vector3();
const gorQ = new THREE.Quaternion();
const gorEu = new THREE.Euler();
const gorSc = new THREE.Vector3();
const gorM = new THREE.Matrix4();
const gorCol = new THREE.Color();
const gorHold = { nx: 0, nz: 0, top: 0 };
const gorWindOut = { x: 0, z: 0 };

// ---------------------------------------------------------------- state -----
let gorGame = null;
let gorBuilt = false;
let gorRoot = null;
let gorTime = 0;
let gorPhase = 0.06;
let gorSun = 0;                      // 0..1 — how far the sun is over the ridge
let gorDawnLit = 0;                  // 0..1 — the light, which leads the sun a bit
let gorSeenSun = false;
let gorWarned = false;

let gorClimbers = null;              // the chimneys you can get up
let gorChimMesh = null;
let gorWispMesh = null, gorWispData = null;
let gorPigeonMesh = null, gorPigeonData = null, gorPigeonOut = 0;

let gorBalloon = null;               // the player's, a THREE.Group
let gorBasketBody = null;
let gorBalX = 0, gorBalY = 0, gorBalZ = 0;
// previous TARGET for the basket, so its velocity is honest — see gorUpdateBalloon
let gorBasketPX = 0, gorBasketPY = 0, gorBasketPZ = 0;

let gorBalVX = 0, gorBalVY = 0, gorBalVZ = 0;
let gorBalBurn = 0;
let gorAboard = false, gorAboardT = 0, gorFlown = false;
let gorCarry = { x: 0, z: 0 };
let gorCarrying = false;
let gorGroundedT = 0, gorEmptyT = 0;
let gorLayerSeen = 0;                // bitmask of layers visited above the calm
let gorHighest = 0;
let gorTetherGroup = null, gorTetherCut = false, gorTetherY = 0;
// ...and the BODY under it, because a balloon that flies away and leaves its
// collider behind is an invisible wall on the launch field. See gorBuildTether.
let gorTetherBody = null;

let gorSunMesh = null, gorSunGlow = null, gorSunMat = null, gorGlowMat2 = null;
// the light along the crest of the east ridge — see the ridge block in gorBuild
let gorRimMat = null;
// the tea-house bulbs, so they can flicker and go out when the sun is up
let gorBulbMat = null;
let gorSkyMesh = null, gorCirrus = null;
let gorDecorMeshEnv = null, gorDecorMeshBask = null, gorDecorMeshThroat = null;
let gorDecorData = null;

let gorChimDone = false, gorDoveDone = false, gorTetherDone = false;
let gorAboardDone = false, gorWindsDone = false, gorSunDone = false, gorLandDone = false;
let gorTruck = null, gorTruckX = 20, gorTruckZ = 10, gorTruckYaw = 0;
let gorToldBurner = false, gorToldLayer = -1, gorToldChimney = false;

// =========================================================== GEOMETRY UTIL ==
function gorXform(px, py, pz, rx, ry, rz, sx, sy, sz) {
  gorEu.set(rx, ry, rz, 'YXZ');
  gorQ.setFromEuler(gorEu);
  gorV3.set(px, py, pz);
  gorSc.set(sx, sy, sz);
  gorM.compose(gorV3, gorQ, gorSc);
  return gorM;
}

const gorG = { box: null, cyl6: null, cyl8: null, cyl4: null, cone6: null, cone8: null,
               sph6: null, sph8: null, quad: null, streak: null };
function gorInitGeos() {
  if (gorG.box) return;
  gorG.box = new THREE.BoxGeometry(1, 1, 1);
  // GROUND DETAIL IS A FACET OF THE GROUND, NOT AN OBJECT ON IT. Marrakech paid
  // for this twice: a cobble, a wheel rut, a worn patch and a dry stream bed are
  // all seen only from above, so eleven twelfths of a box is faces nobody can
  // ever see. Pre-rotated flat, two triangles, and the cost of drawing five
  // hundred of them is less than the cost of drawing eighty boxes.
  gorG.quad = new THREE.PlaneGeometry(1, 1);
  gorG.quad.rotateX(-Math.PI / 2);
  // ---- AND A WISP IS NOT A BOX ------------------------------------------
  // A hundred and twenty streaks of cloud drawn as rectangular prisms have two
  // hard square ENDS each, and against the dark backlit ridge that is exactly
  // what they read as: hairline scratches on the lens with a start and a stop.
  // A cirrus wisp has neither. A spindle — four sides through the middle ring
  // and a point at each end — is eight triangles against a box's twelve, it
  // tapers to nothing the way a streak of ice cloud does, and it is the only
  // change that stopped this chapter's user interface looking like damage.
  {
    const g = new THREE.BufferGeometry();
    const pos = [0, 0, 0.5, 0, 0, -0.5];      // the two tips
    const ix = [];
    for (let k = 0; k < 4; k++) {
      const a = k / 4 * Math.PI * 2;
      pos.push(Math.sin(a) * 0.5, Math.cos(a) * 0.5, 0);
    }
    for (let k = 0; k < 4; k++) {
      const a = 2 + k, b = 2 + ((k + 1) % 4);
      ix.push(0, a, b, 1, b, a);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(ix);
    g.computeVertexNormals();
    gorG.streak = g;
  }
  gorG.cyl6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
  gorG.cyl8 = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
  gorG.cyl4 = new THREE.CylinderGeometry(0.5, 0.5, 1, 4);
  gorG.cone6 = new THREE.ConeGeometry(0.5, 1, 6);
  gorG.cone8 = new THREE.ConeGeometry(0.5, 1, 8);
  gorG.sph6 = new THREE.SphereGeometry(0.5, 6, 4);
  gorG.sph8 = new THREE.SphereGeometry(0.5, 8, 6);
}

/** CONTRACT: box() takes FULL extents, CANNON.Box takes HALF, and gorStaticBox
 *  below speaks THIS one so the two cannot end up a factor of two apart. */
function gorMerger() {
  const pos = [], nor = [], col = [], idx = [];
  const M = {
    n: 0,
    add(geo, m4, color) {
      const g = geo.clone();
      g.applyMatrix4(m4);
      const p = g.attributes.position.array;
      const nm = g.attributes.normal.array;
      gorCol.set(color);
      const start = M.n;
      for (let i = 0; i < p.length; i += 3) {
        pos.push(p[i], p[i + 1], p[i + 2]);
        nor.push(nm[i], nm[i + 1], nm[i + 2]);
        col.push(gorCol.r, gorCol.g, gorCol.b);
      }
      const vc = p.length / 3;
      if (g.index) { const ia = g.index.array; for (let i = 0; i < ia.length; i++) idx.push(start + ia[i]); }
      else { for (let i = 0; i < vc; i++) idx.push(start + i); }
      M.n += vc;
      g.dispose();
      return M;
    },
    box(cx, cy, cz, sx, sy, sz, color, rx, ry, rz) {
      return M.add(gorG.box, gorXform(cx, cy, cz, rx || 0, ry || 0, rz || 0, sx, sy, sz), color);
    },
    /** A flat horizontal facet. See gorG.quad — two triangles, not twelve. */
    quad(cx, cy, cz, sx, sz, color, ry) {
      return M.add(gorG.quad, gorXform(cx, cy, cz, 0, ry || 0, 0, sx, 1, sz), color);
    },
    cyl(cx, cy, cz, r, h, color, rx, ry, rz, seg) {
      const g = seg === 4 ? gorG.cyl4 : seg === 8 ? gorG.cyl8 : gorG.cyl6;
      return M.add(g, gorXform(cx, cy, cz, rx || 0, ry || 0, rz || 0, r * 2, h, r * 2), color);
    },
    taper(cx, cy, cz, rb, rt, h, color, ry) {
      // a fairy chimney is a CONE WITH THE TOP CUT OFF and a rock balanced on
      // it; the cut-off cone is not in the geometry set, so it is a lathe of
      // exactly two rings and it costs eight triangles
      const g = new THREE.CylinderGeometry(rt, rb, h, 7);
      const r = M.add(g, gorXform(cx, cy, cz, 0, ry || 0, 0, 1, 1, 1), color);
      g.dispose();
      return r;
    },
    cone(cx, cy, cz, r, h, color, rx, ry, rz, seg) {
      const g = seg === 8 ? gorG.cone8 : gorG.cone6;
      return M.add(g, gorXform(cx, cy, cz, rx || 0, ry || 0, rz || 0, r * 2, h, r * 2), color);
    },
    sph(cx, cy, cz, rx2, ry2, rz2, color, seg) {
      return M.add(seg === 8 ? gorG.sph8 : gorG.sph6,
                   gorXform(cx, cy, cz, 0, 0, 0, rx2 * 2, ry2 * 2, rz2 * 2), color);
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
function gorVC() {
  return grain(mat(0xffffff, { vertexColors: true }),
               { scale: 0.42, amount: 0.09, warp: 0.55 });
}
/**
 * THE SAME THING, BUT NOBODY ELSE HAS IT.
 *
 * gorVC() hands back a CACHED material — every mesh in the chapter that asks
 * for it gets the same object — so writing an emissive term onto an envelope
 * would light the town, the valley, the cliff, the field and the herd with it.
 * See grainOwn in shared.js and [[clone eats the shader]]: the envelopes are
 * the only things here that glow, so they are the only things with their own.
 */
function gorVCOwn() {
  return grainOwn(mat(0xffffff, { vertexColors: true }),
                  { scale: 0.42, amount: 0.09, warp: 0.55 });
}
function gorGlowMat(color, intensity) {
  return mat(color, { emissive: color, emissiveIntensity: intensity || 1 }).clone();
}
/**
 * THE TRAVERSE THAT UNDOES EVERY `castShadow = false` IN THIS FILE.
 *
 * `registerShadowTarget` is the last line of gorBuild and systems.js answers it
 * with `traverse(n => { if (n.isMesh) n.castShadow = true })`, so everything
 * here that was authored not to cast was casting. Measured: 82,660 of 82,776.
 *
 * AND IN THIS CHAPTER IT WAS VISIBLE. The painted balloon shadows — flat
 * translucent discs lying on the ground, twelve metres across, whose whole
 * reason for existing is that the real shadow map cannot reach a balloon at a
 * hundred metres — were themselves being fed to the real shadow map, so every
 * one of them was a disc with a second, harder, darker disc under it. A shadow
 * casting a shadow. The dust plume, the wind wisps, the nine-hundred-metre sky
 * dome, the sun, its halo and the cirrus were all in there too.
 *
 * Two rules, the same two Marrakech and the Drift use: anything see-through is a
 * ghost, and anything flagged `userData.noShadow` is a LIGHT — a bulb that
 * throws a shadow is not a bulb.
 */
function gorNoShadowOnGhosts(root) {
  root.traverse(function (n) {
    if (!n.isMesh && !n.isInstancedMesh) return;
    if (n.userData && n.userData.noShadow) { n.castShadow = false; return; }
    const m = Array.isArray(n.material) ? n.material[0] : n.material;
    if (!m) return;
    if (m.transparent || m.depthWrite === false || m.fog === false ||
        m.blending === THREE.AdditiveBlending) {
      n.castShadow = false;
    }
  });
}
function gorSyncBody(b) {
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
  b.previousQuaternion.copy(b.quaternion);
  b.interpolatedQuaternion.copy(b.quaternion);
}
/**
 * ONE COMPOUND BODY PER REGION — Marrakech's sahStaticGroup, Rio's and
 * Iceland's before it, and this chapter needed it the moment the chimneys got
 * their variety. Eighty fairy chimneys were eighty CANNON bodies, which with
 * the town, the cliff, the trucks and the tether had Cappadocia at 119 of a
 * hard 130 before a single new rock was added. Identical shapes on one body is
 * one broadphase entry; split by region only so the AABBs stay tight enough to
 * be worth having.
 */
function gorPoolBody() {
  const b = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC });
  b.allowSleep = true;
  return b;
}
function gorPoolBox(b, x, y, z, sx, sy, sz, ry) {
  const q = new CANNON.Quaternion();
  if (ry) q.setFromEuler(0, ry, 0);
  b.addShape(new CANNON.Box(new CANNON.Vec3(sx * 0.5, sy * 0.5, sz * 0.5)),
             new CANNON.Vec3(x, y, z), q);
  return b;
}
function gorPoolDone(game, b) {
  if (!b.shapes.length) return b;
  b.material = (game.mats && game.mats.ground) || undefined;
  gorSyncBody(b);
  game.world.addBody(b);
  return b;
}
function gorStaticBox(game, x, y, z, sx, sy, sz, ry) {
  const b = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
  b.addShape(new CANNON.Box(new CANNON.Vec3(sx * 0.5, sy * 0.5, sz * 0.5)));
  b.position.set(x, y, z);
  if (ry) b.quaternion.setFromEuler(0, ry, 0);
  gorSyncBody(b);
  game.world.addBody(b);
  return b;
}
function gorSmooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

/**
 * THE GROUND GRID'S SQUEEZE — Pasto's, Palawan's, Marrakech's. Same function,
 * same reason, and this chapter had never had it: a flat 120 x 120 over three
 * hundred and twenty metres is 28,800 triangles, a quarter of everything here,
 * and most of them are spent out at the foot of a decorative ridge and in four
 * corners nobody will ever walk to. 100 x 100 warped is 20,000 triangles with
 * 2.2 m cells through the valley — FINER than the uniform grid it replaces —
 * and 5.5 m out at the edge, where the ground is one number.
 *
 * k < 1 is what keeps it monotone; at k >= 1 the mapping folds and the mesh
 * crosses itself. s = +/-1 maps to itself, so the world still ends where it did.
 */
const gorWARP_K = 0.52;
function gorWarp(v, half) {
  const s = clamp(v / half, -1, 1);
  return half * s * (gorWARP_K + (1 - gorWARP_K) * s * s);
}

/**
 * HOW LOUD A THING AT (x, z) IS FROM WHERE THE PLAYER IS STANDING. 0..1.
 *
 * This chapter is two hundred metres across and it had no distance law at all:
 * the bell mare rang at exactly the same volume whether she was under your feet
 * or at the far end of the valley, every 2.4 seconds, for as long as she was
 * running — which is most of the chapter. An ambient sound with no falloff is
 * not atmosphere, it is a metronome in the room with you.
 *
 * Rolls off from "near" and is silent past "far" on a squared ramp, because
 * sound falls off with the square of distance and a linear ramp keeps distant
 * things audible for far too long. Returns 0 when there is nobody to hear it,
 * which is also what stops the sound being made at all.
 */
function gorHeard(x, z, near, far) {
  const capy = gorGame && gorGame.capy;
  const p = capy && capy.position;
  if (!p) return 0;
  const d = Math.hypot(p.x - x, p.z - z);
  if (d >= far) return 0;
  const k = 1 - clamp((d - near) / (far - near), 0, 1);
  return k * k;
}

// ================================================================= TERRAIN ==
/**
 * A VALLEY FLOOR, AND NOTHING VERTICAL IN IT.
 *
 * The chimneys and the cliff are static boxes with rock drawn over them, for
 * the same reason Palawan's karst is: a heightfield cannot hold a vertical
 * face, and capybara.js's analytic ground backstop will happily levitate the
 * animal up a forty-metre ramp at three metres a second. What is in here is
 * only what you can walk on — and it is deliberately gentle, because the
 * interesting axis in this chapter is the one the ground does not have.
 */
function gorTerrain(x, z) {
  // the broad shape: the town sits high, the valley falls away south
  let h = 0;
  h += 5.0 * gorSmooth((z - 6) / 46);
  h -= 3.6 * gorSmooth((-30 - z) / 60);
  // the ground rolls, because Cappadocia is not a table
  h += Math.sin(x * 0.031 + 1.1) * 2.3 + Math.sin(z * 0.027) * 1.9;
  h += Math.sin(x * 0.11 + z * 0.09) * 0.55;
  // the launch field is FLAT, and it has to be — an envelope on its side needs
  // sixty metres of level ground and a balloon that lifts off a slope leans
  const dfx = Math.abs(x - gorFIELD.x) / (gorFIELD.w * 0.5);
  const dfz = Math.abs(z - gorFIELD.z) / (gorFIELD.d * 0.5);
  const inField = 1 - gorSmooth(Math.max(dfx, dfz) - 0.55);
  if (inField > 0) h = lerp(h, 4.2, inField);
  // and so is the square you land in
  {
    const d = Math.hypot(x - gorPLAZA.x, z - gorPLAZA.z);
    const t = 1 - gorSmooth((d - gorPLAZA.r * 0.55) / (gorPLAZA.r * 0.7));
    if (t > 0) h = lerp(h, gorPLAZA.y, t);
  }
  // and so is the landing plain, for the same reason from the other end
  {
    const d = Math.hypot(x - gorLAND.x, z - gorLAND.z);
    const t = 1 - gorSmooth((d - gorLAND.r * 0.55) / (gorLAND.r * 0.6));
    if (t > 0) h = lerp(h, -2.2, t);
  }
  // the foot of the east ridge climbs, so the ridge stands on something
  if (x > 82) h += 9 * gorSmooth((x - 82) / 26);
  return h;
}
function gorSlope(x, z) {
  const e = 1.2;
  const dx = gorTerrain(x + e, z) - gorTerrain(x - e, z);
  const dz = gorTerrain(x, z + e) - gorTerrain(x, z - e);
  return Math.atan(Math.sqrt(dx * dx + dz * dz) / (2 * e));
}
function gorIsOverWater() { return false; }

// ==================================================================== ZONES =
function gorInZone(name, x, z) {
  if (name === 'town') return z > gorTOWN_Z && z < 62 && Math.abs(x) < 42;
  if (name === 'plaza') {
    const dx = x - gorPLAZA.x, dz = z - gorPLAZA.z;
    return dx * dx + dz * dz < gorPLAZA.r * gorPLAZA.r;
  }
  if (name === 'field') {
    return Math.abs(x - gorFIELD.x) < gorFIELD.w * 0.5 && Math.abs(z - gorFIELD.z) < gorFIELD.d * 0.5;
  }
  if (name === 'valley') return z < gorVALLEY_Z1 && z > gorVALLEY_Z0 && Math.abs(x) < 72;
  if (name === 'cliff') {
    // +18, measured: the cliff's own collider face stands at x = -75, so the
    // nearest a capybara can physically get is about -73 — and the zone stopped
    // at -66, which is seven metres short of anywhere you can actually stand.
    return x < gorCLIFF.x + 18 && x > gorCLIFF.x - 8 && z > gorCLIFF.z0 && z < gorCLIFF.z1;
  }
  if (name === 'landing') {
    const dx = x - gorLAND.x, dz = z - gorLAND.z;
    return dx * dx + dz * dz < gorLAND.r * gorLAND.r;
  }
  if (name === 'tether') {
    // THE PEG AND THE LINE, NOT THE BALLOON. The zone was a 5.2 m circle on
    // the middle of the envelope, so the task fired while the capybara was
    // standing INSIDE a half-inflated balloon — which it now cannot do at all,
    // the thing being solid. The crown line runs from the top of the envelope
    // to a peg at z = -11.4; this is a capsule round the last four metres of
    // it, which is the part a rodent can reach.
    const dx = x + 17, dz = z + 10.4;
    return dx * dx * 0.55 + dz * dz < 4.6 * 4.6;
  }
  return false;
}
function gorNavBlocked(x, z, r) {
  const rr = r || 0.6;
  return x < gorCLIFF.x + 10 + rr || x > 84 - rr;
}
function gorSurfacePitch(x, z, y) {
  if (y > 4 && gorAboard) return 1.36;                  // a wicker basket. it creaks.
  if (gorInZone('town', x, z)) return 1.02;             // cobbles
  if (gorInZone('field', x, z)) return 0.88;            // beaten dirt
  return 0.92;                                          // tuff dust, and there is a lot of it
}

// ================================================================= THE WIND ==
/**
 * THE ONE FUNCTION THIS CHAPTER IS ABOUT.
 *
 * Which way the air is going at a given height, blended over gorBLEND metres so
 * a balloon crossing a boundary rolls into the new layer rather than snapping
 * into it. Not published as `wind` — that key is the Drift's, and capybara.js
 * applies it to the ANIMAL whenever it is airborne, which here would mean every
 * hop across the valley gets blown sideways by a wind meant for a balloon.
 */
function gorWindAt(y, x, z, out) {
  const o = out || gorWindOut;
  let i = 0;
  for (let k = gorLAYERS.length - 1; k >= 0; k--) { if (y >= gorLAYERS[k].base) { i = k; break; } }
  const a = gorLAYERS[i];
  const b = gorLAYERS[i + 1];
  if (!b) { o.x = a.x; o.z = a.z; }
  else {
    const t = gorSmooth((y - (b.base - gorBLEND)) / gorBLEND);
    o.x = lerp(a.x, b.x, t);
    o.z = lerp(a.z, b.z, t);
  }
  // the rim curl — see gorRIM
  if (x === undefined) return o;
  const dx = x - gorMID.x, dz = z - gorMID.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d > gorRIM) {
    const k = gorSmooth((d - gorRIM) / (gorRIM_HARD - gorRIM));
    const sp = Math.max(2.2, Math.hypot(o.x, o.z));
    o.x = lerp(o.x, -dx / d * sp, k);
    o.z = lerp(o.z, -dz / d * sp, k);
  }
  return o;
}
/** Which layer a height belongs to, for the "three winds" tally and the toast. */
function gorLayerOf(y) {
  let i = 0;
  for (let k = gorLAYERS.length - 1; k >= 0; k--) { if (y >= gorLAYERS[k].base) { i = k; break; } }
  return i;
}

// ============================================================== THE CLIMB ===
/**
 * THE SECOND CHAPTER TO PUBLISH climbHold, AND THAT IS THE POINT.
 *
 * Hong Kong's bamboo taught the verb; a verb that appears once is a gimmick and
 * a verb that comes back is a vocabulary. What is different here is the shape:
 * a scaffold is a plane and a fairy chimney is a CONE, so the hold returned is
 * the outward RADIAL normal at the animal's own bearing. capybara.js treats it
 * as a plane normal for one frame and then asks again, which walks the animal
 * round the curve for free — the solve never had to know about cylinders.
 */
function gorClimbHold(x, y, z) {
  if (!gorClimbers) return null;
  // NOT WHILE FLYING. The burner is the grab key held down, and a balloon
  // drifting past the top of a chimney would otherwise stick to it — the one
  // place in the chapter where two verbs on one key genuinely collide.
  if (gorAboard) return null;
  if (y < -4) return null;
  for (let i = 0; i < gorClimbers.length; i++) {
    const c = gorClimbers[i];
    if (y > c.top + 0.6) continue;
    const dx = x - c.x, dz = z - c.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    // the radius tapers with height, which is what makes it a chimney
    const t = clamp((y - c.base) / (c.top - c.base), 0, 1);
    const r = lerp(c.rb, c.rt, t);
    // THE BAND REACHES THROUGH THE ROCK. The cling pulls the animal toward the
    // face at capyCLIMB_STICK and the chimney's own collider stops it half a
    // metre inside, so a band that ended at the surface let go on the frame
    // after it took hold — measured on the bamboo, and it is the same here.
    if (d > r + 1.9 || d < r - 2.6) continue;
    if (d < 0.05) continue;
    gorHold.nx = dx / d; gorHold.nz = dz / d;
    gorHold.top = c.top;
    return gorHold;
  }
  return null;
}

// ============================================================== THE VALLEY ==
/**
 * SEVENTY FAIRY CHIMNEYS.
 *
 * A cone of soft tuff with a hard basalt boulder balanced on the top of it, and
 * the boulder is not decoration: it is the reason the cone is there at all —
 * everything the rock did not cover has washed away over ten million years,
 * and what is left is a column standing under its own umbrella. Getting that
 * one silhouette right is most of what makes the valley read as Cappadocia
 * rather than as a field of traffic cones.
 */
function gorBuildValley(game, root) {
  const M = gorMerger();
  gorClimbers = [];
  // FOUR POOLS, SPLIT BY REGION. See gorPoolBody: eighty separate bodies for
  // eighty rocks is eighty broadphase entries for a thing that never moves.
  const pools = [gorPoolBody(), gorPoolBody(), gorPoolBody(), gorPoolBody()];
  const pool = (z) => pools[clamp(Math.floor((z - gorVALLEY_Z0 - 20) / 30), 0, 3)];
  let seed = 31337;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  /**
   * THE SEEDED rand(). Every scatter in this builder is a coordinate followed by
   * a rejection test — out of the landing plain, out of the herd's lane, not on
   * top of one of the six big ones — so an unseeded coordinate is an unseeded
   * COUNT, and the valley builds a different number of chimneys on every load.
   * Measured across three consecutive builds: 114,806, 115,770 and 116,258
   * triangles. A budget you cannot measure twice is not a budget.
   */
  const rr = (a2, b2) => a2 + rnd() * (b2 - a2);

  // the six you can get up are placed BY HAND, in a line the player will walk
  // along, in rising order of height. A climbable thing you cannot find is a
  // verb that does not exist.
  const bigOnes = [
    { x: -6, z: -20, h: 15 }, { x: 11, z: -28, h: 19 }, { x: -14, z: -34, h: 23 },
    { x: 9, z: -44, h: 26 }, { x: -22, z: -52, h: 22 }, { x: 20, z: -60, h: 28 },
  ];

  /**
   * ONE FAIRY CHIMNEY.
   *
   * EIGHTY OF THEM AND THEY WERE ALL THE SAME ONE. Measured off the rendered
   * valley frame: every cone was three bands in the same three proportions with
   * the same cap sitting on it, so a hundred metres of Love Valley read as a
   * tray of identical mushrooms — which is the exact opposite of the thing that
   * makes a real one worth looking at, because a real one is an ACCIDENT. What
   * is left standing is whatever the boulder on top happened to protect, and no
   * two boulders are the same shape or the same size or sitting straight.
   *
   * Four kinds now, and the kind is the silhouette:
   *
   *   PLAIN     the one it always was, and still two thirds of them.
   *   LEANING   the cap slid, the column went with it, and the whole thing is
   *             ten degrees off vertical. Nothing in a real valley is plumb.
   *   MULTI     two or three heads off one foot, which is Paşabağ and is the
   *             most photographed rock in the province.
   *   BEHEADED  the cap came off. The column is blunt and eroding fast, and the
   *             boulder is lying at the foot where it landed — which is the one
   *             version that explains the other three.
   *
   * The lean is applied to the DRAWN geometry only. The collider stays plumb and
   * the climb band is a radius about a vertical axis, both because capybara.js
   * asks for an outward radial normal and gets one, and because a leaning
   * collider is a ramp — and a ramp is a thing the analytic ground backstop
   * levitates the animal up. Ten degrees is inside the slop the climb band
   * already allows (r + 1.9 out, r - 2.6 in), so a leaning chimney climbs.
   */
  function chimney(cx, cz, h, big) {
    const g = gorTerrain(cx, cz);
    const rb = big ? 3.4 : 1.1 + rnd() * 1.5;
    const rt = big ? 1.9 : rb * (0.34 + rnd() * 0.2);
    const kind = big ? 0 : (rnd() < 0.22 ? 1 : rnd() < 0.20 ? 2 : rnd() < 0.13 ? 3 : 0);
    const lean = kind === 1 ? (rnd() - 0.5) * 0.34 : (big ? 0 : (rnd() - 0.5) * 0.07);
    const lz = kind === 1 ? (rnd() - 0.5) * 0.30 : 0;
    // where the axis has got to at height t of the shaft, given the lean
    const ax = (t) => cx + Math.sin(lean) * h * t;
    const az = (t) => cz + Math.sin(lz) * h * t;

    // the shaft, in three bands, because tuff comes in bands and it is the only
    // thing that stops a cone reading as one flat colour.
    // THREE BANDS, AND THEY HAVE TO DIFFER. Two bands a shade apart is one flat
    // pale slab from any distance, and a flat pale slab is not a fairy chimney
    // — the banding IS the geology and it is the only thing on the shaft that
    // gives it scale.
    M.taper(ax(0.11), g + h * 0.11, az(0.11), rb * 1.04, lerp(rb, rt, 0.22), h * 0.22,
            PALETTE.gorTuffDk, rnd() * 3);
    M.taper(ax(0.44), g + h * 0.44, az(0.44), lerp(rb, rt, 0.22), lerp(rb, rt, 0.72), h * 0.46,
            rnd() < 0.5 ? PALETTE.gorTuffPale : PALETTE.gorTuff, rnd() * 3);
    M.taper(ax(0.845), g + h * 0.845, az(0.845), lerp(rb, rt, 0.72),
            kind === 3 ? rt * 1.25 : rt, h * 0.33, PALETTE.gorTuffRose, rnd() * 3);
    const tx = ax(1), tz = az(1);
    const cr = rt * (1.5 + rnd() * 0.4);
    if (kind === 3) {
      // BEHEADED. No cap, a blunt weathered crown, and the boulder lying where
      // it fell — which is the one chimney in the valley that explains the
      // other seventy-nine.
      M.sph(tx, g + h + 0.2, tz, rt * 1.2, rt * 0.42, rt * 1.1, PALETTE.gorTuffRose);
      const fa = rnd() * Math.PI * 2, fr = rb * (1.6 + rnd() * 1.4);
      const bx = cx + Math.sin(fa) * fr, bz = cz + Math.cos(fa) * fr;
      M.sph(bx, gorTerrain(bx, bz) + cr * 0.42, bz, cr, cr * 0.62, cr * 0.88,
            PALETTE.gorBasaltDk, 8);
    } else {
      // THE CAP. Wider than the shaft, dark, and sitting slightly off centre,
      // because a perfectly centred one looks like a hat and a real one looks
      // like something that got left there.
      M.sph(tx + (rnd() - 0.5) * rt * 0.5, g + h + cr * 0.35, tz + (rnd() - 0.5) * rt * 0.5,
            cr, cr * 0.72, cr * 0.9, rnd() < 0.4 ? PALETTE.gorBasaltDk : PALETTE.gorBasalt);
    }
    if (kind === 2) {
      // MULTI. One or two younger heads off the same foot, shorter and thinner,
      // each with its own boulder — the shoulders of a cone that is splitting.
      const n = 1 + (rnd() < 0.45 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const a = rnd() * Math.PI * 2;
        const off = rb * (0.8 + rnd() * 0.5);
        const sx2 = cx + Math.sin(a) * off, sz2 = cz + Math.cos(a) * off;
        const sh = h * (0.42 + rnd() * 0.3);
        const srb = rb * 0.56, srt = srb * 0.36;
        const sg = gorTerrain(sx2, sz2);
        M.taper(sx2, sg + sh * 0.5, sz2, srb, srt, sh,
                rnd() < 0.5 ? PALETTE.gorTuff : PALETTE.gorTuffPale, rnd() * 3);
        const scr = srt * (1.5 + rnd() * 0.4);
        M.sph(sx2, sg + sh + scr * 0.35, sz2, scr, scr * 0.7, scr * 0.9, PALETTE.gorBasalt);
          gorPoolBox(pool(sz2), sx2, sg + sh * 0.5, sz2, srb * 1.5, sh, srb * 1.5);
      }
    }
    // a shadow skirt at the foot, which is what sells the height
    M.cyl(cx, g + 0.06, cz, rb * 1.45, 0.11, PALETTE.gorTuffShadow, 0, 0, 0, 8);
    if (big) {
      // the windows. Every big chimney in that valley has been lived in — and
      // one of them is somebody's front DOOR, cut at the foot, with a step and
      // a lintel, because that is what "lived in" actually looks like.
      for (let k = 0; k < 3; k++) {
        const a = rnd() * Math.PI * 2;
        const wy = g + 4 + k * (h - 7) / 3;
        const wr = lerp(rb, rt, (wy - g) / h);
        // A CUT WINDOW IS A HOLE. Placed at the face radius exactly, a 1.1 m
        // box sits half OUT of the rock: a black brick glued to a cone, which is
        // what every big chimney in the valley photographed as. Sunk 30 cm, with
        // a pale reveal round the opening and a sill under it — the dark is
        // depth now, and the reveal is the cut stone the depth goes through.
        // Same three pieces as the dovecote's four hundred holes and the same
        // reason: a hole is a thing you see the EDGE of.
        M.box(cx + Math.sin(a) * (wr + 0.06), wy, cz + Math.cos(a) * (wr + 0.06),
              1.22, 1.58, 0.22, PALETTE.gorTuffPale, 0, -a);
        M.box(cx + Math.sin(a) * (wr - 0.30), wy, cz + Math.cos(a) * (wr - 0.30),
              1.0, 1.38, 1.0, PALETTE.gorWindow, 0, -a);
        M.box(cx + Math.sin(a) * (wr + 0.30), wy - 0.86, cz + Math.cos(a) * (wr + 0.30),
              1.5, 0.16, 0.44, PALETTE.gorTuffDk, 0, -a);
      }
      {
        const a = rnd() * Math.PI * 2;
        M.box(cx + Math.sin(a) * (rb * 0.94), g + 1.15, cz + Math.cos(a) * (rb * 0.94),
              1.52, 2.4, 0.22, PALETTE.gorTuffPale, 0, -a);
        M.box(cx + Math.sin(a) * rb * 0.88, g + 1.05, cz + Math.cos(a) * rb * 0.88,
              1.25, 2.1, 0.9, PALETTE.gorWindow, 0, -a);
        M.box(cx + Math.sin(a) * (rb * 1.06), g + 1.02, cz + Math.cos(a) * (rb * 1.06),
              1.05, 1.9, 0.20, PALETTE.gorDoor, 0, -a);
        M.quad(cx + Math.sin(a) * (rb * 1.4), g + 0.05, cz + Math.cos(a) * (rb * 1.4),
               2.0, 1.6, PALETTE.gorRoad, -a);
      }
      gorClimbers.push({ x: cx, z: cz, base: g, top: g + h + 0.9, rb: rb, rt: rt });
      gorStaticBox(game, cx, g + h * 0.5, cz, rb * 1.55, h, rb * 1.55);
      // a landing on top, so topping out puts you ON something
      gorStaticBox(game, cx, g + h + 0.35, cz, rt * 3.0, 0.7, rt * 3.0);
    } else {
      // The threshold used to be h > 9, on the reasoning that the rest were
      // "knee-high and the animal brushes past them". They are not: the small
      // ones are 4 to 17 metres, so a third of the valley was four-to-nine-metre
      // pillars of tuff you walked straight through. Measured with a chest-height
      // probe before this: 34 sample points in Göreme where a drawn rock face
      // within 2.5 m had no body behind it, more than any other biome.
      // 74 shapes on a sleeping broadphase is nothing; a walk-through fairy
      // chimney in the chapter ABOUT fairy chimneys is not. They share four
      // bodies — see gorPoolBody.
      gorPoolBox(pool(cz), cx, g + h * 0.5, cz, rb * 1.5, h, rb * 1.5);
    }
    gorCHIM_POS.push(cx, cz, rb);
  }

  for (let i = 0; i < bigOnes.length; i++) {
    chimney(bigOnes[i].x, bigOnes[i].z, bigOnes[i].h, true);
  }
  for (let i = 0; i < gorCHIM_N; i++) {
    const x = rr(-56, 74);      // west of -56 is the walk to the dovecote cliff
    const z = rr(gorVALLEY_Z0 - 20, gorVALLEY_Z1 + 10);
    // never inside the landing plain — the truck has to be able to drive on it
    if (Math.hypot(x - gorLAND.x, z - gorLAND.z) < gorLAND.r + 4) continue;
    // nor in the herd's lane, for the same reason and with the same shape of
    // consequence: a chimney the mare passes through is a chimney her passenger
    // does not
    if (Math.abs(x - gorHERD_X) < gorHERD_LANE && z > gorHERD_Z0 - 6 && z < gorHERD_Z1 + 6) continue;
    let clash = false;
    for (let k = 0; k < bigOnes.length; k++) {
      if (Math.hypot(x - bigOnes[k].x, z - bigOnes[k].z) < 11) clash = true;
    }
    if (clash) continue;
    chimney(x, z, 4 + rnd() * 13, false);
  }

  // ---- the vineyards, in rows, because they are always in rows -------------
  // A VINEYARD IS ROWS, NOT A CHESSBOARD. At 0.75 across, dead on a grid and
  // running all the way into the valley these read as a field of identical
  // green boulders bigger than the animal walking between them. Rows, jitter,
  // and half the size — a vine is knee-high on a person.
  for (let r = 0; r < 11; r++) {
    const z = 19 - r * 2.6;
    for (let i = 0; i < 26; i++) {
      const x = -52 + i * 2.3 + (r % 2) * 1.15 + Math.sin(i * 2.7 + r) * 0.35;
      if (Math.abs(x - gorFIELD.x) < gorFIELD.w * 0.5 + 3 &&
          Math.abs(z - gorFIELD.z) < gorFIELD.d * 0.5 + 3) continue;
      if (Math.hypot(x - gorPLAZA.x, z - gorPLAZA.z) < gorPLAZA.r + 3) continue;
      const g = gorTerrain(x, z + Math.sin(i * 1.9) * 0.3);
      const s = 0.34 + (i % 3) * 0.07;
      M.sph(x, g + 0.42, z + Math.sin(i * 1.9) * 0.3, s, s * 0.8, s * 0.85,
            i % 4 ? PALETTE.gorVine : PALETTE.gorPoplarDk);
      M.cyl(x, g + 0.16, z + Math.sin(i * 1.9) * 0.3, 0.05, 0.34, PALETTE.gorTuffDk, 0, 0, 0, 4);
    }
  }
  // ---- WHAT IS ACTUALLY ON A VALLEY FLOOR ---------------------------------
  // Measured against the world-size audit: between the chimneys the ground was
  // a hundred and forty metres of one pale value with nothing on it at all —
  // the emptiest walk in the chapter, and it is the walk between two of its
  // tasks. None of this is collidable and none of it is a task; it is there so
  // the ground under the fairy chimneys is a place rather than a floor.
  //
  // The ratio is the point. Ground detail is a FACET, so the wash-out channels,
  // the wheel ruts and the bare patches are quads at two triangles; only the
  // things you would actually trip over are solid.
  for (let i = 0; i < 210; i++) {
    const x = rr(-58, 74);
    const z = rr(gorVALLEY_Z0 - 18, gorVALLEY_Z1 + 14);
    if (Math.hypot(x - gorLAND.x, z - gorLAND.z) < gorLAND.r) continue;
    const g = gorTerrain(x, z);
    const k = rnd();
    if (k < 0.30) {
      // BASALT, off the caps. Every one of these came off the top of a chimney
      // and there ought to be a field of them: it is the same rock as the caps
      // and it is the only dark thing on the ground.
      const sc = 0.28 + rnd() * 0.85;
      M.sph(x, g + sc * 0.35, z, sc, sc * 0.55, sc * 0.8,
            rnd() < 0.5 ? PALETTE.gorBasaltDk : PALETTE.gorBasalt);
    } else if (k < 0.58) {
      // the scrub. Low, khaki, two lobes — the third go at this bush across
      // three chapters, and the two things it must not be are pale green
      // pyramids or black chips (Marrakech paid for both).
      const sc = 0.3 + rnd() * 0.45;
      M.sph(x, g + sc * 0.42, z, sc, sc * 0.62, sc * 0.9,
            rnd() < 0.5 ? PALETTE.gorScrub : PALETTE.gorVine);
      M.sph(x + sc * 0.7, g + sc * 0.3, z + sc * 0.4, sc * 0.6, sc * 0.45, sc * 0.55,
            PALETTE.gorScrub);
    } else {
      // THE WASH CHANNELS AND THE BARE SCOURED PATCHES ARE NOT HERE. They were,
      // for one build, and they came straight back off: a channel of gravel and
      // a patch of exposed tuff are things with NO EDGE, and a quad has nothing
      // but edges. Measured off the valley frame — forty pale rectangles lying
      // on smooth sand, corners and all, which is the fifth instance of exactly
      // the failure Jemaa el-Fnaa's worn patches and the Drift's deck rings both
      // paid for. They are painted into the GROUND MESH's own vertex colours in
      // gorBuild now: no triangles, no draw call, and a polygon edge is not a
      // thing they can have. What is left out here is only what you would
      // actually trip over.
      const sc = 0.24 + rnd() * 0.4;
      M.sph(x, g + sc * 0.36, z, sc, sc * 0.6, sc * 0.85,
            rnd() < 0.5 ? PALETTE.gorSoil : PALETTE.gorScrub);
    }
  }

  // ---- and the poplars, which are the only tall green thing here -----------
  for (let i = 0; i < 34; i++) {
    const x = rr(-58, 62), z = rr(-72, 22);
    const g = gorTerrain(x, z);
    const h = 7 + rr(0, 6);
    M.cyl(x, g + h * 0.45, z, 0.16, h * 0.9, PALETTE.gorTuffDk, 0, 0, 0, 6);
    M.cone(x, g + h * 0.72, z, 1.5, h * 0.95, i % 3 ? PALETTE.gorPoplar : PALETTE.gorPoplarDk);
  }

  for (let i = 0; i < pools.length; i++) gorPoolDone(game, pools[i]);

  const mesh = new THREE.Mesh(M.build(), gorVC());
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.name = 'gorValley';
  root.add(mesh);
  gorChimMesh = mesh;
}

// ================================================================ THE TOWN ==
// ================================================================= SCATTER ==
/**
 * FIVE HUNDRED AND EIGHTY-EIGHT INSTANCES IN THE EASIEST WORLD IN THE PROJECT
 * TO SCATTER.
 *
 * Measured against all seventeen chapters, the median world carries 46 pieces
 * of scatter per 1,000 m² of walkable ground. Göreme carries fifteen — and it
 * is a valley of eroded tuff, which is a landform that BY DEFINITION is
 * surrounded by the pieces that fell off it. Every fairy chimney in Cappadocia
 * stands in an apron of its own rubble; the cones erode, the basalt caps drop,
 * and the whole valley floor between them is scree, tufa blocks, and — because
 * this is some of the most fertile volcanic soil in Anatolia — vines.
 *
 * None of that existed. gorBuildValley draws seventy beautiful chimneys onto a
 * clean floor, and the 588 instances the chapter did carry are 260 pigeons, 120
 * wisps and 26 balloons: three flying things and nothing on the ground at all.
 *
 * What is here now, and all of it is what is actually there at five in the
 * morning in Love Valley:
 *
 *   TALUS. An apron of tuff blocks and scree round the foot of every chimney,
 *     graded — big blocks close in, gravel further out — because that is how a
 *     talus fan sorts itself and it is the only thing that makes a cone read as
 *     having ERODED rather than having been placed.
 *   VINES. Bush vines, unstaked, in rows, on every flat piece of the valley
 *     floor. They are the reason anybody has ever lived in this valley.
 *   TERRACE WALLS. Dry tufa, following the contour, holding the vine rows.
 *   POPLARS, in lines along the wet ground, which are the only tall green
 *     thing in the chapter and the only vertical that is not rock.
 *   SCRUB AND PUMPKINS, on the dry slopes and in the field corners.
 *
 * EVERY BATCH IS PER-CELL. One instanced mesh spanning the whole valley is
 * inside the frustum from everywhere; a hundred and eighty metres of world cut
 * into cells of about forty is culled properly. That matters more here than
 * anywhere else in the game, because half of this chapter is flown at a
 * hundred and twenty metres and sees all of it at once.
 *
 * AND ALMOST NONE OF IT CASTS. The chapter flags 82 % of its geometry
 * castShadow, which for a world lit by a sun ON THE HORIZON — the whole
 * marquee is the sun coming over the ridge — is thousands of triangles drawn
 * twice to lay shadows inside a valley that is still in shadow. The terraces
 * and the poplars cast, because they are the two things tall enough to throw
 * one across a vine row when the light finally arrives.
 */
function gorInstance(root, geo, colour, list, cast, recv, name) {
  const n = list.length / 9;
  if (n < 1) return null;
  const im = new THREE.InstancedMesh(geo, mat(colour), n);
  for (let i = 0; i < n; i++) {
    const o = i * 9;
    im.setMatrixAt(i, gorXform(list[o], list[o + 1], list[o + 2], list[o + 3], list[o + 4],
                               list[o + 5], list[o + 6], list[o + 7], list[o + 8]));
  }
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  im.castShadow = !!cast;
  im.receiveShadow = !!recv;
  im.name = name || 'gorScat';
  // registerShadowTarget answers with traverse(n => { if (n.isMesh) castShadow
  // = true }) and an InstancedMesh extends Mesh, so a bare `false` would be
  // reverted four lines later. This chapter's gorNoShadowOnGhosts already reads
  // userData.noShadow — it is one of the two in the project that does — so the
  // flag is all that is needed.
  if (!cast) im.userData.noShadow = true;
  root.add(im);
  return im;
}
function gorPush9(l, px, py, pz, rx, ry, rz, sx, sy, sz) {
  l.push(px, py, pz, rx, ry, rz, sx, sy, sz);
}

/** The cells the scatter is cut into, and they are also the culling boxes. */
const gorSCAT_CELLS = (function () {
  const XS = [-96, -56, -20, 20, 56, 96, 132];
  const ZS = [-110, -78, -48, -18, 12, 40, 62];
  const out = [];
  for (let i = 0; i < XS.length - 1; i++) {
    for (let k = 0; k < ZS.length - 1; k++) out.push([XS[i], XS[i + 1], ZS[k], ZS[k + 1]]);
  }
  return out;
})();

/**
 * Nothing may be planted on the arrival square, on the road, on the launch
 * field, inside a chimney, or in the truck's lane across the landing plain.
 * gorNavBlocked answers the buildings; the rest is written down here because
 * they are places the PLAYER needs rather than places geometry already is.
 */
function gorScatBlocked(x, z) {
  if (Math.abs(x - gorSPAWN.x) < 8 && Math.abs(z - gorSPAWN.z) < 8) return true;
  if (Math.abs(x - gorFIELD.x) < gorFIELD.w * 0.5 + 4 &&
      Math.abs(z - gorFIELD.z) < gorFIELD.d * 0.5 + 4) return true;
  if (z > gorTOWN_Z - 4) return true;                      // the town builds its own
  if (gorNavBlocked(x, z, 1.2)) return true;
  return false;
}

let gorScatMeshes = [];

function gorBuildScatter(game, root) {
  gorScatMeshes = [];
  const SB = gorPoolBody();
  let solid = false;
  for (let c = 0; c < gorSCAT_CELLS.length; c++) {
    const C = gorSCAT_CELLS[c];
    const block = [], scree = [], vine = [], vineLeaf = [], scrub = [];
    const poplarT = [], poplarC = [], wall = [], pumpkin = [];

    // ---- THE TALUS ROUND EVERY CHIMNEY ------------------------------------
    // gorCHIMNEYS is the authored list and it is what the valley IS, so the
    // fan is sampled off the cone itself rather than off the cell: a talus
    // that does not touch the thing it fell off is gravel on a lawn.
    for (let i = 0; i < gorCHIM_POS.length; i += 3) {
      const kx = gorCHIM_POS[i], kz = gorCHIM_POS[i + 1], R = gorCHIM_POS[i + 2];
      if (kx < C[0] || kx >= C[1] || kz < C[2] || kz >= C[3]) continue;
      // MEASURED, TWICE. R*5+8 over seventy-four chimneys, plus the vineyards
      // below, put this chapter at 428,000 triangles — more than twice the
      // proven-safe ceiling of 205,000 and more than any world in the project
      // by a factor of two. A talus fan is legible at about a third of that;
      // what makes it read is the GRADING, not the count.
      const n = Math.round(R * 2.0 + 4);
      for (let k = 0; k < n; k++) {
        const a = rand(0, 6.28318);
        // graded: u near 1 is close in and carries the big blocks
        const u = Math.random();
        const rr = R * (1.05 + (1 - u) * 2.4);
        const x = kx + Math.cos(a) * rr, z = kz + Math.sin(a) * rr;
        if (gorScatBlocked(x, z)) continue;
        const y = gorTerrain(x, z);
        const s = (0.22 + u * u * 1.25) * rand(0.75, 1.25);
        if (s > 0.75) {
          // a BLOCK: a piece of the cone, still square-ish, still capped dark
          // on one face if it came off the top
          gorPush9(block, x, y + s * 0.34, z, rand(-0.25, 0.25), rand(0, 6.28),
                   rand(-0.25, 0.25), s * 1.15, s * 0.82, s * 1.05);
          if (s > 1.25) {
            SB.addShape(new CANNON.Box(new CANNON.Vec3(s * 0.5, s * 0.42, s * 0.46)),
                        new CANNON.Vec3(x, y + s * 0.34, z));
            solid = true;
          }
        } else {
          // A 36-triangle sphere for a 30 cm chip of tuff, thirteen hundred
          // times over, is forty-seven thousand triangles of gravel. A box
          // turned twice on two axes is twelve, and at that size nothing can
          // tell the difference.
          gorPush9(scree, x, y + s * 0.30, z, rand(-0.3, 0.3), rand(0, 6.28),
                   rand(-0.3, 0.3), s * 1.4, s * 0.7, s * 1.2);
        }
      }
    }

    // ---- THE VINEYARDS ----------------------------------------------------
    // In ROWS, because a vineyard is rows and the rows are the only man-made
    // line in the whole valley floor. Four to seven rows a block, eleven to
    // twenty vines a row, and a terrace wall along the downhill edge of it.
    for (let b = 0; b < 2; b++) {
      const bx = rand(C[0] + 6, C[1] - 6), bz = rand(C[2] + 6, C[3] - 6);
      if (gorScatBlocked(bx, bz)) continue;
      // The north-west corner of the valley floor (x -52..6, z -7..19) already
      // carries a hand-authored eleven-row vineyard inside gorValley. Planting
      // a second one on top of it is two vines in the same hole; everything
      // SOUTH of that is Love Valley, which is farmed in exactly the same way
      // and had nothing on it at all.
      if (bx > -56 && bx < 10 && bz > -10 && bz < 22) continue;
      if (gorTerrain(bx, bz) > 14) continue;      // vines are on the FLOOR
      if (gorSlope(bx, bz) > 0.28) continue;
      const yaw = rand(0, 3.14159);
      const cs = Math.cos(yaw), sn = Math.sin(yaw);
      const rows = 3 + (b % 3), per = 8 + ((b * 5 + c) % 7);
      for (let r = 0; r < rows; r++) {
        for (let v = 0; v < per; v++) {
          const lx = (r - (rows - 1) * 0.5) * 2.6;
          const lz = (v - (per - 1) * 0.5) * 1.5;
          const x = bx + lx * cs - lz * sn, z = bz + lx * sn + lz * cs;
          if (gorScatBlocked(x, z)) continue;
          const y = gorTerrain(x, z);
          if (y > 16) continue;
          // A BUSH VINE IS NOT A STICK. Cappadocian vines are unstaked and
          // trained low into a goblet — a short thick trunk with a wide flat
          // head of leaf on it, about knee high. It is two instances and it is
          // the difference between a vineyard and a field of pegs.
          const s = 0.9 + ((v * 3 + r) % 4) * 0.11;
          gorPush9(vine, x, y + 0.20 * s, z, 0, (v + r) * 1.3, 0, 0.17 * s, 0.42 * s, 0.17 * s);
          // AND A GOBLET IS NOT A DINNER PLATE. 1.05 wide by 0.44 tall on a
          // six-segment sphere is a flat green HEXAGON lying in the dirt under
          // a camera that looks down 0.7 rad — the same failure as Iceland's
          // moss discs, the cave's moss, the Pantanal's lily rims and the
          // Drift's ferns, arrived at for the fifth time from the same
          // direction. A trained bush vine is nearly as tall as it is wide.
          gorPush9(vineLeaf, x, y + 0.62 * s, z, rand(-0.1, 0.1), (v * 2 + r) * 0.9,
                   rand(-0.1, 0.1), 0.78 * s, 0.70 * s, 0.72 * s);
        }
        // the terrace wall along the top edge of the block
        if (r === 0) {
          for (let w = 0; w < per; w++) {
            const lx = (-(rows - 1) * 0.5 - 1.4) * 2.6 * 0.5;
            const lz = (w - (per - 1) * 0.5) * 1.5;
            const x = bx + lx * cs - lz * sn, z = bz + lx * sn + lz * cs;
            if (gorScatBlocked(x, z)) continue;
            const y = gorTerrain(x, z);
            // THREE COURSES AND NARROWER. Two courses of 0.30 on a 0.9 m
            // footprint is a wall 60 cm high and 90 cm thick — from above, a
            // twenty-metre plank laid on the ground, which is what the first
            // render of it was. A dry terrace wall is about a metre high and
            // half a metre through, and every stone in it sits a little
            // differently, which is the only thing that stops the top of it
            // being one continuous plane.
            for (let k2 = 0; k2 < 3; k2++) {
              gorPush9(wall, x + Math.sin(w * 2.1 + k2) * 0.06, y + 0.17 + k2 * 0.33,
                       z + Math.cos(w * 1.7 + k2) * 0.06,
                       0.03 * (k2 - 1), yaw + Math.sin(w + k2) * 0.11, 0.03 * ((w + k2) % 2 ? 1 : -1),
                       0.58 - k2 * 0.06, 0.34, 1.5 - k2 * 0.08);
            }
          }
        }
      }
      // and a poplar or three at the wet end of it
      for (let t = 0; t < 3; t++) {
        const lx = ((rows - 1) * 0.5 + 2.2) * 2.6;
        const lz = (t - 1) * 3.4;
        const x = bx + lx * cs - lz * sn, z = bz + lx * sn + lz * cs;
        if (gorScatBlocked(x, z)) continue;
        const y = gorTerrain(x, z);
        if (y > 18) continue;
        const h = 7.5 + ((t * 7 + c) % 5) * 1.5;
        gorPush9(poplarT, x, y + h * 0.5, z, 0, t + c, 0, 0.30, h, 0.30);
        // A LOMBARDY POPLAR IS A COLUMN. Three tall thin cones stacked is the
        // whole silhouette and it is the only one in the chapter that is not
        // a cone of rock.
        for (let k2 = 0; k2 < 3; k2++) {
          gorPush9(poplarC, x, y + h * (0.34 + k2 * 0.27), z, 0, t * 1.7 + k2, 0,
                   2.5 - k2 * 0.55, h * 0.42, 2.5 - k2 * 0.55);
        }
      }
      if (b % 3 === 0) {
        for (let p2 = 0; p2 < 7; p2++) {
          const x = bx + rand(-9, 9), z = bz + rand(-9, 9);
          if (gorScatBlocked(x, z)) continue;
          const s = rand(0.28, 0.46);
          gorPush9(pumpkin, x, gorTerrain(x, z) + s * 0.42, z, 0, rand(0, 6.28), 0,
                   s, s * 0.82, s);
        }
      }
    }

    // ---- SCRUB, on everything too steep or too dry for a vine -------------
    for (let i = 0; i < 8; i++) {
      const x = rand(C[0], C[1]), z = rand(C[2], C[3]);
      if (gorScatBlocked(x, z)) continue;
      const y = gorTerrain(x, z);
      if (y > 40) continue;                    // not on the tops of the chimneys
      const s = rand(0.5, 1.35);
      gorPush9(scrub, x, y + s * 0.34, z, rand(-0.15, 0.15), rand(0, 6.28),
               rand(-0.15, 0.15), s * 1.5, s * 0.8, s * 1.4);
    }

    const id = 'c' + c;
    gorScatMeshes.push(
      gorInstance(root, gorG.box, PALETTE.gorTuff, block, false, true, 'gorScat:block:' + id),
      gorInstance(root, gorG.box, PALETTE.gorTuffDk, scree, false, true, 'gorScat:scree:' + id),
      gorInstance(root, gorG.cyl4, PALETTE.gorTuffDk, vine, false, false, 'gorScat:vineStem:' + id),
      gorInstance(root, gorG.sph6, PALETTE.gorVine, vineLeaf, false, true, 'gorScat:vine:' + id),
      gorInstance(root, gorG.sph6, PALETTE.gorScrub, scrub, false, true, 'gorScat:scrub:' + id),
      gorInstance(root, gorG.cyl6, PALETTE.gorPoplarDk, poplarT, true, false, 'gorScat:poplarT:' + id),
      gorInstance(root, gorG.cone6, PALETTE.gorPoplar, poplarC, true, true, 'gorScat:poplar:' + id),
      gorInstance(root, gorG.box, PALETTE.gorTuffPale, wall, true, true, 'gorScat:wall:' + id),
      gorInstance(root, gorG.sph6, PALETTE.gorPot, pumpkin, false, true, 'gorScat:pumpkin:' + id));
  }
  gorScatMeshes = gorScatMeshes.filter(Boolean);
  if (solid) gorPoolDone(game, SB);
}

function gorBuildTown(game, root) {
  const M = gorMerger();
  let seed = 8080;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  // THE SEEDED rand() — see gorBuildValley. A coordinate followed by a rejection
  // test is a COUNT, and an unseeded one makes the chapter a different size on
  // every load.
  const rr = (a2, b2) => a2 + rnd() * (b2 - a2);

  // ---- the rock the town is cut INTO ---------------------------------------
  // Göreme is not built, it is excavated: the houses are holes with fronts
  // stuck on them. So the massif comes first and the façades are pressed into
  // it, which is the opposite order to every other town in this game.
  for (let i = 0; i < 9; i++) {
    const x = -44 + i * 11 + rnd() * 3;
    const z = 56 + rnd() * 8;
    const h = 14 + rnd() * 16;
    if (Math.hypot(x - gorPLAZA.x, z - gorPLAZA.z) < gorPLAZA.r + 12) continue;
    const g = gorTerrain(x, z);
    M.taper(x, g + h * 0.5, z, 9 + rnd() * 4, 5 + rnd() * 3, h,
            rnd() < 0.5 ? PALETTE.gorTuff : PALETTE.gorTuffPale, rnd() * 3);
    M.sph(x + rnd() * 3, g + h + 1.4, z, 4.5, 2.6, 4.0, PALETTE.gorBasalt);
    gorStaticBox(game, x, g + h * 0.5, z, 16, h, 14);
    // the holes: doors and windows drilled straight into the face.
    //
    // AND A DRILLED HOLE IS A HOLE. Flat dark boxes ON the face, in tidy
    // columns, turned this massif into a housing estate — the same failure the
    // dovecote cliff had at four hundred times the scale and the fairy chimneys
    // had at three. Three pieces each: the recess (which is depth, not paint),
    // a pale cut reveal round it, and a sill. The columns are broken up too,
    // because nobody cutting a house out of a cliff by hand ever lined the
    // windows up.
    for (let k = 0; k < 6; k++) {
      const wy = g + 2.5 + (k % 3) * 4.2 + rnd() * 1.4;
      const wx = x + (rnd() - 0.5) * 11;
      M.box(wx, wy, z - 6.34, 1.72, 2.22, 0.24, PALETTE.gorTuffPale);
      M.box(wx, wy, z - 6.8, 1.5, 2.0, 1.0, PALETTE.gorWindow);
      M.box(wx, wy - 1.22, z - 6.24, 1.9, 0.18, 0.42, PALETTE.gorTuffDk);
      if (k === 0) M.box(wx, wy - 0.1, z - 6.22, 1.3, 1.9, 0.16, PALETTE.gorDoor);
    }
  }

  // ---- the houses that ARE built, on the terraces below --------------------
  for (let i = 0; i < 22; i++) {
    const x = rr(-40, 40), z = rr(gorTOWN_Z + 2, 50);
    if (Math.hypot(x - gorPLAZA.x, z - gorPLAZA.z) < gorPLAZA.r + 3) continue;
    const g = gorTerrain(x, z);
    const w = 4 + rnd() * 4, d = 4 + rnd() * 3, h = 3 + rnd() * 3.5;
    const ry = (rnd() - 0.5) * 0.5;
    M.box(x, g + h * 0.5, z, w, h, d, rnd() < 0.4 ? PALETTE.gorTuffPale : PALETTE.gorTuff, 0, ry);
    M.box(x, g + h + 0.2, z, w + 0.7, 0.4, d + 0.7, PALETTE.gorTuffDk, 0, ry);
    M.box(x, g + 1.05, z - d * 0.5, 1.2, 2.1, 0.2, PALETTE.gorDoor, 0, ry);
    for (let k = -1; k <= 1; k += 2) {
      M.box(x + k * w * 0.28, g + h * 0.66, z - d * 0.5, 0.9, 0.9, 0.18, PALETTE.gorWindow, 0, ry);
    }
    // a carpet over the wall, which is the only saturated thing in the town
    if (rnd() < 0.45) {
      M.box(x + w * 0.5, g + h * 0.55, z + rr(-1, 1), 0.12, 1.8, 1.3, PALETTE.gorCarpet, 0, ry);
    }
    gorStaticBox(game, x, g + h * 0.5, z, w, h, d, ry);
  }

  // ---- the pottery. Avanos is up the road and the whole valley is red clay --
  {
    const px = 19, pz = 42;
    const g = gorTerrain(px, pz);
    for (let i = 0; i < 17; i++) {
      const a = i * 1.9, r = 0.6 + (i % 4) * 0.9;
      const jx = px + Math.sin(a) * r, jz = pz + Math.cos(a) * r;
      const jh = 0.7 + rnd() * 0.9;
      M.sph(jx, g + jh * 0.45, jz, jh * 0.45, jh * 0.5, jh * 0.45,
            i % 3 ? PALETTE.gorPot : PALETTE.gorPotDk, 8);
      M.cyl(jx, g + jh * 0.85, jz, jh * 0.16, jh * 0.35, PALETTE.gorPotDk, 0, 0, 0, 6);
    }
    M.box(px, g + 1.4, pz + 2.6, 4.0, 0.2, 0.2, PALETTE.gorTuffDk);
  }

  // ---- the square you land in ---------------------------------------------
  // A tea house with four stools outside it, a plane tree, and a rack of
  // carpets — which between them are about ninety per cent of what is actually
  // outdoors in a Cappadocian town at any hour of the day.
  {
    const P = gorPLAZA;
    // COBBLES ARE THE GROUND, NOT THINGS ON IT.
    //
    // Four rings of sixty-two boxes at 2.4 m spacing over a thirteen-metre
    // square: measured off the rendered frame, that is not a pavement, it is
    // sixty-two pale slabs of paper dropped on bare dirt with three metres of
    // nothing between them, and the eye reads every one of them as litter. It
    // is the same failure as Jemaa el-Fnaa's worn patches and the Drift's deck
    // rings, arriving from the other direction — there the objects were too
    // many, here they were too few, and both times the answer is that a paved
    // surface is a SURFACE.
    //
    // A jittered grid over the whole square, drawn as flat facets: five hundred
    // stones for a thousand triangles, against sixty-two for seven hundred and
    // forty. Jittered rather than gridded (the boulder lesson: a scatter clumps,
    // a grid tiles, three quarters of a cell of jitter does neither), rotated a
    // few degrees each, and three tones so the surface has grain in it before
    // grain() ever sees it.
    const CS = 1.05;
    for (let gx = -13; gx <= 13; gx += CS) {
      for (let gz = -13; gz <= 13; gz += CS) {
        const h = Math.sin(gx * 12.9898 + gz * 78.233) * 43758.5453;
        const r1 = h - Math.floor(h);
        const h2 = Math.sin(gx * 39.3468 + gz * 11.135) * 24634.6345;
        const r2 = h2 - Math.floor(h2);
        const x = P.x + gx + (r1 - 0.5) * CS * 0.7;
        const z = P.z + gz + (r2 - 0.5) * CS * 0.7;
        const d = Math.hypot(x - P.x, z - P.z);
        if (d > P.r * 0.98) continue;
        // ...and the edge of a square is not a circle drawn with a compass: the
        // paving frays where it meets the dirt.
        if (d > P.r * 0.80 && r1 < (d - P.r * 0.80) / (P.r * 0.20)) continue;
        const c = r2 < 0.34 ? PALETTE.gorTuffPale : (r2 < 0.72 ? PALETTE.gorRoad : PALETTE.gorTuff);
        M.quad(x, P.y + 0.035, z, CS * 0.92, CS * 0.92, c, (r1 - 0.5) * 0.5);
      }
    }
    // the worn line across it, which every square on earth has and which is
    // simply where everybody walks: from the road on the east to the tea house
    for (let i = 0; i < 22; i++) {
      const t = i / 21;
      M.quad(lerp(P.x + 11, P.x - 6.5, t), P.y + 0.055,
             lerp(P.z - 4.5, P.z + 6.2, t) + Math.sin(t * 4.1) * 0.7,
             2.6, 2.2, PALETTE.gorSoil, Math.sin(t * 3) * 0.4);
    }
    // A STRING OF BULBS OVER THE TABLES. It is ten past five in the morning and
    // the only chapter in this game with no artificial light in it at all read
    // as a mud-coloured photograph. Two dozen warm points fix that for nothing,
    // and every tea house in Anatolia has exactly this.
    //
    // AND A STRING OF BULBS NEEDS A STRING. There was none — fourteen glowing
    // spheres hanging in a row on nothing, which from the square below reads as
    // fourteen glowing spheres hanging in a row on nothing. Thirteen segments of
    // 2 cm cable following the same sag the lamps do, and the sag is what tells
    // you they are hung from the two poles rather than floating between them.
    const BX0 = P.x - 11.5, BX1 = P.x + 3.0, BY = P.y + 3.3, BZ = P.z + 5.0;
    const sag = (t) => BY - Math.sin(t * Math.PI) * 0.75;
    for (let i = 0; i < 13; i++) {
      const t0 = i / 13, t1 = (i + 1) / 13;
      const x0 = lerp(BX0, BX1, t0), x1 = lerp(BX0, BX1, t1);
      const y0 = sag(t0), y1 = sag(t1);
      M.box((x0 + x1) * 0.5, (y0 + y1) * 0.5, BZ, Math.hypot(x1 - x0, y1 - y0), 0.035, 0.035,
            PALETTE.gorBasaltDk, 0, 0, Math.atan2(y1 - y0, x1 - x0));
    }
    for (let i = 0; i < 14; i++) {
      const t = i / 13;
      M.sph(lerp(BX0, BX1, t), sag(t) + 0.19, BZ, 0.05, 0.10, 0.05, PALETTE.gorSteel);
    }
    M.cyl(BX0 - 0.5, P.y + 1.8, BZ, 0.07, 3.6, PALETTE.gorSteel, 0, 0, 0, 4);
    M.cyl(BX1 + 0.4, P.y + 1.8, BZ, 0.07, 3.6, PALETTE.gorSteel, 0, 0, 0, 4);
    {
      // A LAMBERT BOX AT FIVE IN THE MORNING RENDERS BLACK. Anything in this
      // game that IS a light has to say so with an emissive term — the lesson
      // Hong Kong's neon paid for, and it is the same lesson here.
      const bulbs = new THREE.InstancedMesh(gorG.sph6, gorGlowMat(PALETTE.gorBurner, 1.25), 14);
      for (let i = 0; i < 14; i++) {
        const t = i / 13;
        bulbs.setMatrixAt(i, gorXform(lerp(BX0, BX1, t), sag(t), BZ,
                                      0, 0, 0, 0.34, 0.34, 0.34));
      }
      bulbs.instanceMatrix.needsUpdate = true;
      bulbs.computeBoundingSphere();
      bulbs.userData.noShadow = true;      // a bulb that casts a shadow is not a bulb
      bulbs.name = 'gorBulbs';
      root.add(bulbs);
      gorBulbMat = bulbs.material;
    }
    // ---- the tea house, dug into the low bank on the north side ----------
    // AND IT HAD NO FRONT. Measured off the square: a seven-metre box with a
    // flat cap, one blue door and one dark square, filling the whole north side
    // of the only room in this chapter — which from the arrival camera is a
    // shipping container with a door painted on it. What every one of those
    // places actually has, and what the box did not, is the bit that sticks OUT:
    // a canopy on two poles over the stools, a lit window rather than a dark
    // one, and a hand-painted board with the word on it.
    M.box(P.x - 7, P.y + 1.9, P.z + 9.5, 7.0, 3.8, 6.0, PALETTE.gorTuffPale, 0, 0.12);
    M.box(P.x - 7, P.y + 3.9, P.z + 9.5, 7.8, 0.5, 6.8, PALETTE.gorTuffDk, 0, 0.12);
    // the arched recess the door sits in, which is how a rock-cut front is made
    M.box(P.x - 7, P.y + 1.35, P.z + 6.55, 2.3, 2.8, 0.30, PALETTE.gorTuffDk);
    M.box(P.x - 7, P.y + 2.85, P.z + 6.5, 2.5, 0.34, 0.42, PALETTE.gorBasaltDk);
    M.box(P.x - 7, P.y + 1.05, P.z + 6.44, 1.3, 2.1, 0.2, PALETTE.gorDoor);
    M.box(P.x - 4.4, P.y + 1.7, P.z + 6.6, 1.2, 1.2, 0.18, PALETTE.gorWindow);
    M.box(P.x - 4.4, P.y + 1.7, P.z + 6.52, 1.32, 0.10, 0.10, PALETTE.gorTuffDk);
    M.box(P.x - 4.4, P.y + 1.7, P.z + 6.52, 0.10, 1.32, 0.10, PALETTE.gorTuffDk);
    // THE CANOPY, over the stools, on two poles — the one piece of this building
    // that is not a rectangle seen face-on, and the reason the front has depth
    M.box(P.x - 7.2, P.y + 3.05, P.z + 5.5, 8.4, 0.14, 3.2, PALETTE.gorCarpet, -0.11, 0);
    M.box(P.x - 7.2, P.y + 2.90, P.z + 4.05, 8.6, 0.22, 0.16, PALETTE.gorBasketDk);
    for (let k = -1; k <= 1; k += 2) {
      M.cyl(P.x - 7.2 + k * 4.1, P.y + 1.45, P.z + 4.05, 0.06, 2.9, PALETTE.gorSteel, 0, 0, 0, 4);
    }
    // and the board. Nobody can read a sign in this game and nobody has to —
    // what it says is "somebody painted this by hand and hung it up".
    M.box(P.x - 3.1, P.y + 2.55, P.z + 6.5, 1.5, 0.62, 0.07, PALETTE.gorPot, 0, 0.05);
    for (let k = 0; k < 4; k++) {
      M.box(P.x - 3.65 + k * 0.36, P.y + 2.55, P.z + 6.44, 0.16, 0.26, 0.03,
            PALETTE.gorTuffPale, 0, 0.05);
    }
    gorStaticBox(game, P.x - 7, P.y + 1.9, P.z + 9.5, 7.0, 3.8, 6.0, 0.12);
    for (let i = 0; i < 5; i++) {
      const sx = P.x - 10 + i * 1.7, sz = P.z + 5.4;
      M.cyl(sx, P.y + 0.22, sz, 0.26, 0.45, PALETTE.gorBasketDk, 0, 0, 0, 6);
      if (i % 2 === 0) M.cyl(sx, P.y + 0.52, sz, 0.09, 0.16, PALETTE.gorPot, 0, 0, 0, 6);
    }
    // the carpet rack, which is the only saturated thing for a kilometre
    M.cyl(P.x + 5.5, P.y + 1.5, P.z + 4.0, 0.09, 3.0, PALETTE.gorSteel, 0, 0, 0, 4);
    M.cyl(P.x + 5.5, P.y + 1.5, P.z - 1.0, 0.09, 3.0, PALETTE.gorSteel, 0, 0, 0, 4);
    M.cyl(P.x + 5.5, P.y + 2.9, P.z + 1.5, 0.06, 5.2, PALETTE.gorSteel, Math.PI * 0.5, 0, 0, 4);
    for (let i = 0; i < 4; i++) {
      M.box(P.x + 5.5, P.y + 2.0, P.z + 3.2 - i * 1.4, 0.09, 1.7, 1.1,
            i % 2 ? PALETTE.gorCarpet : PALETTE.gorPot);
      // the fringe, which is the only part of a carpet that moves and the only
      // detail at this scale that says textile rather than painted board
      for (let f = 0; f < 5; f++) {
        M.box(P.x + 5.5, P.y + 1.10, P.z + 3.42 - i * 1.4 - f * 0.11, 0.07, 0.16, 0.04,
              PALETTE.gorTuffPale);
      }
    }
    // ---- AND SOMEBODY IS SITTING ON THE STOOLS -------------------------
    // Five stools, a tea house, a carpet rack, a plane tree and a string of
    // bulbs, and the square was EMPTY — at ten past five in the morning, in
    // the one town on earth where everybody is genuinely awake at ten past
    // five in the morning, which the chapter's own local says out loud. Three
    // men round two of the stools with tea in front of them, which is what
    // that square is for and has been for eight hundred years.
    // the stools are at P.z + 5.4 and 45 cm high — they sit ON them, facing
    // each other across the two glasses, which is the only way anybody has
    // ever drunk tea in that square
    gorFigure(M, P.x - 10.0, P.y + 0.45, P.z + 5.4, 1.9, PALETTE.gorEnvE, PALETTE.gorTuffDk, 4);
    gorFigure(M, P.x - 6.6, P.y + 0.45, P.z + 5.4, -1.9, PALETTE.gorCarpet, PALETTE.gorBasaltDk, 4);
    gorFigure(M, P.x - 4.9, P.y, P.z + 7.0, 2.6, PALETTE.gorEnvD, PALETTE.gorTuffDk, 2);
    // two glasses of çay on the stools between them, and they are the right
    // shape: a tulip glass, and it is the only glassware in this game
    for (let i = 0; i < 2; i++) {
      M.cyl(P.x - 8.8 + i * 1.7, P.y + 0.56, P.z + 5.4, 0.045, 0.13, PALETTE.gorPot, 0, 0, 0, 6);
      M.cyl(P.x - 8.8 + i * 1.7, P.y + 0.49, P.z + 5.4, 0.07, 0.02, PALETTE.gorSteel, 0, 0, 0, 6);
    }
    // ...and the backgammon board they have been arguing over since four, which
    // is the other thing that is on every table in that square at this hour
    M.box(P.x - 7.7, P.y + 0.50, P.z + 5.4, 0.62, 0.05, 0.44, PALETTE.gorBasketDk, 0, 0.2);
    for (let i = 0; i < 6; i++) {
      M.box(P.x - 7.95 + (i % 3) * 0.24, P.y + 0.535, P.z + 5.30 + ((i / 3) | 0) * 0.20,
            0.10, 0.02, 0.10, i % 2 ? PALETTE.gorTuffPale : PALETTE.gorBasaltDk, 0, 0.2);
    }
    // the tea urn by the door, with its own small fire under it
    M.cyl(P.x - 4.0, P.y + 0.55, P.z + 6.3, 0.30, 1.1, PALETTE.gorSteel, 0, 0, 0, 8);
    M.cyl(P.x - 4.0, P.y + 1.18, P.z + 6.3, 0.17, 0.24, PALETTE.gorSteel, 0, 0, 0, 6);
    // ---- a woman on the roof of the tea house with the morning's bread ----
    // The flat roofs are the yard in that town, and they were bare.
    gorFigure(M, P.x - 8.6, P.y + 4.15, P.z + 9.5, 3.0, PALETTE.gorEnvB, PALETTE.gorTuffDk, 3);
    for (let i = 0; i < 5; i++) {
      M.cyl(P.x - 10.2 + i * 0.85, P.y + 4.20, P.z + 8.2, 0.30, 0.06,
            i % 2 ? PALETTE.gorTuff : PALETTE.gorTuffRose, 0, i * 0.4, 0, 8);
    }
    // and the washing line beside her, because a flat roof in that town is a
    // yard and a yard has washing on it
    M.cyl(P.x - 10.6, P.y + 4.95, P.z + 11.4, 0.05, 1.6, PALETTE.gorSteel, 0, 0, 0, 4);
    M.cyl(P.x - 3.6, P.y + 4.95, P.z + 11.4, 0.05, 1.6, PALETTE.gorSteel, 0, 0, 0, 4);
    M.box(P.x - 7.1, P.y + 5.66, P.z + 11.4, 7.0, 0.03, 0.03, PALETTE.gorBasaltDk);
    for (let i = 0; i < 6; i++) {
      M.box(P.x - 9.9 + i * 1.15, P.y + 5.24, P.z + 11.4, 0.62, 0.82, 0.03,
            [PALETTE.gorEnvC, PALETTE.gorCarpet, PALETTE.gorTuffPale,
             PALETTE.gorEnvD, PALETTE.gorTuffRose, PALETTE.gorEnvB][i], 0, 0, 0);
    }
    // a dog, asleep, in the exact middle of where everybody walks
    M.box(P.x + 1.6, P.y + 0.20, P.z + 1.2, 0.42, 0.30, 0.90, PALETTE.gorSoil, 0, 0.7);
    M.box(P.x + 1.9, P.y + 0.26, P.z + 1.7, 0.28, 0.26, 0.30, PALETTE.gorSoil, 0, 0.7);
    M.box(P.x + 1.3, P.y + 0.14, P.z + 0.6, 0.14, 0.12, 0.42, PALETTE.gorTuffDk, 0, 0.9);

    // and one plane tree, because there is always exactly one
    M.cyl(P.x + 8.5, P.y + 2.2, P.z + 8.0, 0.42, 4.4, PALETTE.gorTuffDk, 0, 0, 0, 6);
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3;
      M.sph(P.x + 8.5 + Math.sin(a) * 1.9, P.y + 5.0 + (i % 2) * 0.9, P.z + 8.0 + Math.cos(a) * 1.9,
            2.2, 1.5, 2.2, i % 2 ? PALETTE.gorPoplar : PALETTE.gorPoplarDk);
    }
    gorStaticBox(game, P.x + 8.5, P.y + 2.2, P.z + 8.0, 0.9, 4.4, 0.9);
  }

  // ---- the road, which the truck and everybody else uses -------------------
  for (let z = 60; z > -104; z -= 3) {
    const x = Math.sin(z * 0.021) * 16 + 26;
    const g = gorTerrain(x, z);
    M.box(x, g + 0.04, z, 6.0, 0.10, 3.2, PALETTE.gorRoad, 0, Math.cos(z * 0.021) * 0.33);
  }

  const mesh = new THREE.Mesh(M.build(), gorVC());
  mesh.castShadow = true; mesh.receiveShadow = true;
  root.add(mesh);
}

// ============================================================ THE DOVECOTE ==
/**
 * FOUR HUNDRED HOLES IN A CLIFF, AND THEY ARE ALL MAN-MADE.
 *
 * Cappadocian farmers cut pigeon houses into the rock for eight hundred years
 * and then climbed in for the guano, which is what the vineyards were grown on.
 * Every one of those holes was drilled by somebody on a rope. It is the single
 * best fact about this valley and it is why the cliff, rather than a tree, is
 * where the birds are.
 *
 * AND FOR ITS WHOLE LIFE IT RENDERED AS AN OFFICE BLOCK. Six flat slabs in one
 * plane, and a hundred and eighty identical black squares on a dead-regular
 * grid — the "loose grid a real dovecote has" was a checkerboard offset, which
 * is still a grid. Photographed from the one place the chapter ever puts you,
 * it is a curtain wall with the lights off. Four things were wrong and all four
 * are about the FACE rather than the holes:
 *
 *   1. THE FACE WAS A PLANE. Soft rock in a dry valley erodes into bays and
 *      buttresses — that is the whole look of the thing — so the face is a
 *      function now (faceX) and every single item on it, the holes, the lips,
 *      the perches, the paint, the rope and the four hundred birds, is placed
 *      against that function instead of against a constant.
 *   2. THE PERCH LEDGES WERE INSIDE THE ROCK. Drawn at C.x + 3.6 on a face at
 *      C.x + 4.0: forty centimetres in, invisible, all of them. A dovecote with
 *      no perches is a wall with holes in it, and the birds had nothing to sit
 *      on, which is exactly why the settled flock read as dust on the lens.
 *   3. THE WHITEWASH WAS ONE 26-METRE PANEL, COPLANAR WITH THE HOLES. Farmers
 *      paint a rough halo round each CLUSTER so a bird can find its own door; a
 *      single rectangle over the lot says the opposite thing, and being in the
 *      same plane as the holes it also z-fought them.
 *   4. NOBODY HAD EVER BEEN UP IT. The chapter's own local says his grandfather
 *      cut forty of those holes on a rope, at night. There was no rope.
 */
function gorBuildCliff(game, root) {
  const M = gorMerger();
  let seed = 5150;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  const C = gorCLIFF;

  // ---- the face, as a function --------------------------------------------
  // Two incommensurable periods, so the bays never repeat down the length of it,
  // and nothing on this cliff is allowed to know any other number.
  const faceX = (z) => C.x + 4.0 + Math.sin(z * 0.098 + 0.7) * 1.75 +
                       Math.sin(z * 0.041 - 1.3) * 1.15;
  const topY = (z) => gorTerrain(C.x, z) + C.top + Math.sin(z * 0.055 + 2.1) * 5.5 +
                      Math.sin(z * 0.017) * 3.0;

  // ---- the massif ---------------------------------------------------------
  // Drawn in 3 m ribs rather than 9 m slabs, so the top is a skyline and the
  // face is a surface. Each rib gets a BATTER at the foot — an apron of rock
  // standing proud, which is both what a scarp in soft stone does and the only
  // thing that stops a stack of boxes reading as masonry.
  for (let z = C.z0 - 4; z < C.z1 + 4; z += 3) {
    const g = gorTerrain(C.x, z);
    const ty = topY(z);
    const fx = faceX(z);
    const h = ty - g;
    M.box(fx - 10, g + h * 0.5, z, 20, h, 3.1,
          rnd() < 0.42 ? PALETTE.gorTuffRose : PALETTE.gorTuff, 0, 0);
    M.taper(fx - 0.4, g + 3.4, z, 3.0, 1.2, 6.8,
            rnd() < 0.5 ? PALETTE.gorTuffDk : PALETTE.gorTuff, rnd() * 3);
  }
  // ---- the cornice, which OVERHANGS ---------------------------------------
  // A BRINK IS A LINE, NOT A STAIRCASE. At one 2.4 m black box per 3 m rib it
  // stepped down the skyline in metre treads — a flight of stairs in basalt,
  // and the only edge on the cliff that the eye actually follows. Drawn at half
  // the rib spacing and two thirds the height, so the tread is 45 cm against a
  // 1.6 m riser and reads as a rolling capping rather than as masonry; and it is
  // not one value, because a cap rock that is one value is a painted stripe.
  for (let z = C.z0 - 5; z < C.z1 + 5; z += 1.5) {
    const ty = topY(z), fx = faceX(z);
    M.box(fx - 9.4, ty + 0.75, z, 20.4, 1.6, 1.62,
          rnd() < 0.4 ? PALETTE.gorBasaltDk : PALETTE.gorBasalt);
    M.box(fx + 0.45, ty - 0.25, z, 1.5, 0.7, 1.62, PALETTE.gorBasaltDk);
  }
  for (let i = 0; i < 26; i++) {
    const z = C.z0 - 3 + rnd() * (C.z1 - C.z0 + 6);
    M.sph(faceX(z) - 2 - rnd() * 12, topY(z) + 2.0, z,
          0.8 + rnd() * 1.3, 0.5 + rnd() * 0.7, 0.8 + rnd() * 1.3,
          rnd() < 0.5 ? PALETTE.gorScrub : PALETTE.gorPoplarDk);
  }

  // ---- THE BAYS, AND THE PIERS BETWEEN THEM -------------------------------
  // Seven bays. The pier is what casts the shadow that makes a cliff read as a
  // cliff at eighty metres, and it is also what turns four hundred holes from a
  // spreadsheet into seven households.
  const BAYS = 7;
  const bayZ = [];
  for (let i = 0; i < BAYS; i++) {
    const z0 = C.z0 + (C.z1 - C.z0) * (i / BAYS) + 1.1;
    const z1 = C.z0 + (C.z1 - C.z0) * ((i + 1) / BAYS) - 1.1;
    bayZ.push([z0, z1]);
    if (i < BAYS - 1) {
      const pz = z1 + 1.1;
      const g = gorTerrain(C.x, pz), ty = topY(pz);
      M.taper(faceX(pz) + 0.9, g + (ty - g) * 0.48, pz, 2.6, 1.5, (ty - g) * 0.96,
              i % 3 === 0 ? PALETTE.gorTuffRose : (i % 3 === 1 ? PALETTE.gorTuff : PALETTE.gorTuffPale),
              0.2);
    }
  }

  // ---- the holes ----------------------------------------------------------
  // A DOVECOTE IS NOT A GRID. It is COURSES: a man on a rope works across at one
  // height, comes down a metre and a bit, and works back — so the rows are
  // regular and nothing inside a row is. The spacing wanders, the course sags in
  // the middle of the bay, and every so often somebody cut a square doorway big
  // enough to get himself through. Each hole is three pieces: the dark recess,
  // a cut LIP standing proud that catches the light, and the perch under it —
  // the piece that spent the whole life of this chapter inside the rock.
  const perches = [];
  for (let b = 0; b < BAYS; b++) {
    const z0 = bayZ[b][0], z1 = bayZ[b][1];
    const gz = gorTerrain(C.x, (z0 + z1) * 0.5);
    const rows = 7 + (rnd() * 3 | 0);
    for (let r = 0; r < rows; r++) {
      const y0 = gz + 5.0 + r * 2.85 + rnd() * 0.5;
      const n = 4 + (rnd() * 3 | 0);
      const step = (z1 - z0) / n;
      for (let k = 0; k < n; k++) {
        const z = z0 + step * (k + 0.5) + (rnd() - 0.5) * step * 0.45;
        const u = (z - z0) / Math.max(0.01, z1 - z0);
        const y = y0 - Math.sin(u * Math.PI) * 0.55;
        if (y > topY(z) - 3.2) continue;
        const fx = faceX(z);
        const big = rnd() < 0.10;
        const w = big ? 1.5 : 0.72 + rnd() * 0.34;
        const hh = big ? 1.9 : 0.78 + rnd() * 0.34;
        // the recess, sunk INTO the rock: the dark is depth, not paint
        M.box(fx - 0.34, y, z, 0.9, hh, w, PALETTE.gorWindow);
        // the cut lip, 8 cm proud, which is what makes four hundred holes read
        // as four hundred holes instead of as spots. ONLY THE HEAD OF IT: the
        // perch below is already the bottom edge, and 280 holes is 280 boxes.
        M.box(fx + 0.08, y + hh * 0.5 + 0.10, z, 0.3, 0.20, w + 0.34, PALETTE.gorTuffPale);
        // THE PERCH, and it is OUTSIDE the rock
        M.box(fx + 0.24, y - hh * 0.5 - 0.22, z, 0.52, 0.13, w + 0.5, PALETTE.gorTuffDk);
        perches.push(fx + 0.46, y - hh * 0.5 - 0.04, z);
      }
    }
    // ---- the paint --------------------------------------------------------
    // A rough halo round the bay, five centimetres proud of the LOCAL face and
    // BROKEN. Whitewash on tuff goes on with a rag on the end of a stick and it
    // goes on in patches; five overlapping slabs, not one panel.
    for (let q = 0; q < 5; q++) {
      const z = lerp(z0 - 0.6, z1 + 0.6, (q + 0.5) / 5) + (rnd() - 0.5) * 1.2;
      // ...and BEHIND the lips, not through them. At faceX + 0.05 it sat inside
      // the 30 cm cut lips and cut half of them in two; a lime wash goes ON the
      // rock, so it is 3 cm proud of the face and 8 cm behind the stonework.
      M.box(faceX(z) - 0.03, gz + 5 + rnd() * 16, z,
            0.12, 7 + rnd() * 11, (z1 - z0) / 4 + rnd() * 1.6,
            rnd() < 0.3 ? PALETTE.gorTuff : PALETTE.gorTuffPale, 0, 0, (rnd() - 0.5) * 0.06);
    }
  }

  // ---- SOMEBODY HAS BEEN UP HERE ------------------------------------------
  // "My grandfather cut forty of those holes. On a rope. At night." There was no
  // rope. One line over the cornice, a bosun's plank on the end of it, a guano
  // basket hooked alongside, and a notched-log ladder leaning at the foot —
  // which between them are the whole of the equipment and the whole of the story.
  {
    const z = (C.z0 + C.z1) * 0.5 - 7.5;
    const fx = faceX(z), ty = topY(z);
    const hang = ty - (gorTerrain(C.x, z) + 15);
    M.cyl(fx + 0.55, ty + 0.4 - hang * 0.5, z, 0.045, hang, PALETTE.gorSoil, 0, 0, 0, 4);
    M.cyl(fx + 0.55, ty + 0.4 - hang * 0.5, z + 0.55, 0.045, hang, PALETTE.gorSoil, 0, 0, 0, 4);
    M.box(fx + 0.75, ty - hang + 0.4, z + 0.28, 0.55, 0.10, 1.5, PALETTE.gorBasketDk);
    M.cyl(fx + 0.75, ty - hang + 0.85, z + 1.35, 0.34, 0.62, PALETTE.gorBasket, 0, 0, 0, 8);
    M.cyl(fx + 0.75, ty - hang + 1.20, z + 1.35, 0.36, 0.07, PALETTE.gorBasketDk, 0, 0, 0, 8);
    const lz = z + 12, lfx = faceX(lz), lg = gorTerrain(C.x, lz);
    M.cyl(lfx + 1.5, lg + 3.2, lz - 0.3, 0.075, 6.6, PALETTE.gorTuffDk, 0, 0, -0.24, 4);
    M.cyl(lfx + 1.5, lg + 3.2, lz + 0.3, 0.075, 6.6, PALETTE.gorTuffDk, 0, 0, -0.24, 4);
    for (let r = 0; r < 7; r++) {
      const t = r / 6;
      M.box(lfx + 2.28 - t * 1.55, lg + 0.5 + t * 5.6, lz, 0.10, 0.08, 0.68, PALETTE.gorTuffDk);
    }
  }

  // ---- and the talus, because a cliff stands on what has come off it -------
  for (let i = 0; i < 46; i++) {
    const z = C.z0 - 6 + rnd() * (C.z1 - C.z0 + 12);
    const d = rnd();
    const x = faceX(z) + 0.6 + d * d * 11;
    const sc = (1 - d * 0.6) * (0.5 + rnd() * 1.5);
    M.sph(x, gorTerrain(x, z) + sc * 0.34, z, sc, sc * 0.55, sc * 0.85,
          rnd() < 0.35 ? PALETTE.gorBasaltDk
                       : (rnd() < 0.5 ? PALETTE.gorTuffDk : PALETTE.gorTuff), 8);
  }

  // ---- the collider, and it follows the face ------------------------------
  // Six bodies, laid so their east faces track faceX rather than standing in one
  // line four metres in front of the rock — which is what put gorInZone('cliff')
  // seven metres away from anywhere a capybara could actually stand, and needed
  // a +18 fudge to work at all.
  for (let z = C.z0 - 4; z < C.z1 + 4; z += 8) {
    const g = gorTerrain(C.x, z);
    gorStaticBox(game, faceX(z + 4) - 11.2, g + C.top * 0.5 + 4, z + 4,
                 22, C.top + 22, 8.4);
  }

  const mesh = new THREE.Mesh(M.build(), gorVC());
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.name = 'gorCliff';
  root.add(mesh);

  // ---- the birds ----------------------------------------------------------
  // TEN FLOATS, NOT SEVEN, AND THE LAST THREE ARE THE HOLE IT CAME OUT OF.
  //
  // gorPigeonOut was set to 1 by the dovecote task and NOTHING EVER SET IT BACK
  // — so a hundred and sixty birds put up off that cliff wheeled round it for
  // the rest of the chapter, for ever, in a chapter that lasts as long as the
  // player wants it to. The comment below says a flock makes ONE loop and
  // settles; it could not, because it had nowhere to settle TO.
  //
  // AND NOW THE HOME IS A REAL PERCH. Every one is a ledge drawn above, so a
  // settled flock is four hundred holes with a bird standing in half the doors
  // — which is the picture, and which the old code could not have had at any
  // price, the ledges being inside the rock.
  gorPigeonData = new Float32Array(gorPIGEON_N * 10);   // x,y,z, vx,vy,vz, phase, hx,hy,hz
  const np = Math.max(1, perches.length / 3);
  for (let i = 0; i < gorPIGEON_N; i++) {
    const o = i * 10;
    const q = ((i * 37) % np) * 3;
    gorPigeonData[o + 7] = perches[q] + rand(-0.06, 0.06);
    gorPigeonData[o + 8] = perches[q + 1];
    gorPigeonData[o + 9] = perches[q + 2] + rand(-0.16, 0.16);
    gorPigeonData[o] = gorPigeonData[o + 7];
    gorPigeonData[o + 1] = gorPigeonData[o + 8];
    gorPigeonData[o + 2] = gorPigeonData[o + 9];
    gorPigeonData[o + 6] = rand(0, Math.PI * 2);
  }
  // A PIGEON HAS A BODY AND TWO WINGS. One box at 0.50 x 0.16 x 0.28 is a chip
  // of grey card: at rest it is invisible against tuff and in the air it is a
  // speck. Body, head, tail and two pale wings — and the WING FLASH is the only
  // thing that makes four hundred birds off a cliff read as a flock rather than
  // as film grain. Sixty triangles each against twelve, and they are the second
  // most looked-at thing in the chapter.
  const pg = gorMerger();
  // FOUR BOXES, NOT FIVE: the body is drawn long enough to be its own tail,
  // which at this size is the same silhouette for a fifth less. 260 birds is
  // 12,480 triangles and every one of them is in the frame at once.
  pg.box(0, 0, -0.07, 0.20, 0.17, 0.54, PALETTE.gorPigeon);
  pg.box(0, 0.10, 0.22, 0.12, 0.13, 0.13, PALETTE.gorPigeonDk);
  for (let sd = -1; sd <= 1; sd += 2) {
    pg.box(sd * 0.21, 0.05, -0.02, 0.30, 0.04, 0.30, PALETTE.gorTuffPale, 0, 0, sd * 0.22);
  }
  const pm = new THREE.InstancedMesh(pg.build(), gorVC(), gorPIGEON_N);
  pm.frustumCulled = false;
  // A BIRD SITTING IN A HOLE THIRTY METRES UP A CLIFF CASTS ITS SHADOW ON THE
  // CLIFF, which is a thing nobody can see and twelve thousand triangles a
  // frame to not see it with.
  pm.userData.noShadow = true;
  pm.name = 'gorPigeons';
  root.add(pm);
  gorPigeonMesh = pm;
  gorUpdatePigeons(0);
}
/**
 * TWO THINGS ON THE GROUND THAT MAKE A NOISE, BOTH RATIONED BY DISTANCE.
 *
 * The chapter's soundscape is the burners, and it is right — a hundred and
 * fifty of them going off across a dark valley is the sound of the place, and
 * everything else falls away as you climb (see systems.js, the goreme branch).
 * What it left is a valley floor with no voice at all, which matters because
 * the whole second half of the chapter is spent LOOKING AT the valley floor
 * from a hundred metres up, listening to it go quiet.
 *
 *   THE DOVECOTE. Four hundred holes and two hundred and sixty birds in a
 *     cliff. A loft is a continuous low murmur and it is audible across a
 *     valley at five in the morning, which is exactly the range that makes the
 *     cliff a PLACE rather than a wall with dots on it.
 *   THE POPLARS. The only tall green thing in the chapter, and the only thing
 *     in it that the dawn breeze can get into.
 *
 * Both are multiplied by the same `sky` fall-off the ambience uses, because a
 * sound that stayed the same volume at a hundred and twenty metres would undo
 * the one idea the chapter's audio is built on.
 */
let gorSndDove = 3, gorSndPoplar = 5;

function gorUpdateGroundSound(game, dt) {
  const p = game.capy && game.capy.position;
  if (!p) return;
  // 0 on the ground, 1 by 120 m — the same curve the ambience uses, so nothing
  // here can be louder than the village it is standing in.
  const sky = 1 - clamp((p.y - 12) / 108, 0, 1);
  gorSndDove -= dt;
  if (gorSndDove <= 0) {
    const d = Math.hypot(p.x - gorCLIFF.x, p.z - gorCLIFF.z);
    if (d < 90) {
      gorSfx('rustle', { volume: clamp(0.15 * (1 - d / 90) * sky, 0.015, 0.15),
                         pitch: rand(1.5, 2.1) });
      gorSndDove = rand(2.6, 5.5);
    } else gorSndDove = rand(3, 6);
  }
  gorSndPoplar -= dt;
  if (gorSndPoplar <= 0) {
    // the poplars are scattered, so this measures to the valley floor rather
    // than to any one of them: below twenty metres and inside the valley you
    // are among them, and above that you are not.
    const inValley = p.z < gorTOWN_Z && p.z > -100 && Math.abs(p.x) < 90;
    if (inValley && p.y < 22) {
      gorSfx('hiss', { volume: clamp(0.10 * sky, 0.015, 0.10), pitch: rand(0.9, 1.3) });
      gorSndPoplar = rand(5, 11);
    } else gorSndPoplar = rand(4, 8);
  }
}

function gorUpdatePigeons(dt) {
  if (!gorPigeonMesh) return;
  // THE FLOCK LANDS AGAIN. Fourteen seconds of wheeling — which is about what
  // a real one does — and then eight of coming back in to the same holes.
  // Below 0.35 they are steering home rather than climbing, and at 0 they are
  // back on the ledges and the cliff is quiet, which is the only thing that
  // makes putting them up worth doing a second time.
  const wasOut = gorPigeonOut;
  if (gorPigeonOut > 0) gorPigeonOut = Math.max(0, gorPigeonOut - dt * 0.045);
  const out = gorPigeonOut;
  // ---- AND THE FLOCK COMES DOWN AUDIBLY ----------------------------------
  // Four hundred birds going up made a noise and four hundred birds landing
  // made none, which is the wrong way round: a flock lifting is a bang and a
  // flock settling is thirty seconds of clatter that stops. Two beats — the
  // moment they turn for home, and the moment the last one is on its ledge —
  // both at the volume the distance says, so from the valley floor a mile of
  // rock away it is a rumour rather than an event.
  if (wasOut > 0.35 && out <= 0.35) {
    const h = gorHeard(gorCLIFF.x + 6, (gorCLIFF.z0 + gorCLIFF.z1) * 0.5, 20, 190);
    if (h > 0.02) gorSfx('rustle', { volume: 0.42 * h, pitch: 1.15 });
  }
  if (wasOut > 0.001 && out <= 0.001) {
    const h = gorHeard(gorCLIFF.x + 6, (gorCLIFF.z0 + gorCLIFF.z1) * 0.5, 20, 150);
    if (h > 0.02) gorSfx('rustle', { volume: 0.30 * h, pitch: 0.85 });
  }
  for (let i = 0; i < gorPIGEON_N; i++) {
    const o = i * 10;
    if (out > 0.35) {
      gorPigeonData[o] += gorPigeonData[o + 3] * dt;
      gorPigeonData[o + 1] += gorPigeonData[o + 4] * dt;
      gorPigeonData[o + 2] += gorPigeonData[o + 5] * dt;
      // they climb, they turn, and they come back down — a flock put up off a
      // cliff makes ONE loop and settles, it does not scatter to the horizon
      gorPigeonData[o + 4] -= 1.4 * dt;
      const cx = gorCLIFF.x + 26, cz = (gorCLIFF.z0 + gorCLIFF.z1) * 0.5;
      const dx = gorPigeonData[o] - cx, dz = gorPigeonData[o + 2] - cz;
      const d = Math.hypot(dx, dz) + 0.001;
      gorPigeonData[o + 3] += (-dz / d) * 6 * dt - (dx / d) * 1.2 * dt;
      gorPigeonData[o + 5] += (dx / d) * 6 * dt - (dz / d) * 1.2 * dt;
      const g = gorTerrain(gorPigeonData[o], gorPigeonData[o + 2]) + 2;
      if (gorPigeonData[o + 1] < g) { gorPigeonData[o + 1] = g; gorPigeonData[o + 4] = 6; }
    } else if (out > 0.001) {
      // coming in. A pigeon returning to a hole does not glide into it, it
      // arrives above it and drops, so the horizontal closes faster than the
      // vertical and the last half-metre is nearly straight down.
      const k = 1 - Math.exp(-1.6 * dt), kv = 1 - Math.exp(-0.9 * dt);
      gorPigeonData[o] += (gorPigeonData[o + 7] - gorPigeonData[o]) * k;
      gorPigeonData[o + 1] += (gorPigeonData[o + 8] - gorPigeonData[o + 1]) * kv;
      gorPigeonData[o + 2] += (gorPigeonData[o + 9] - gorPigeonData[o + 2]) * k;
      gorPigeonData[o + 3] = gorPigeonData[o + 7] - gorPigeonData[o];
      gorPigeonData[o + 5] = gorPigeonData[o + 9] - gorPigeonData[o + 2];
    }
    const ph = gorPigeonData[o + 6] + gorTime * 15;
    const flying = out > 0.001;
    // A SITTING BIRD HAS ITS WINGS FOLDED, and one uniform scale cannot say so:
    // at rest the 30 cm wings stayed spread and four hundred perched pigeons
    // read as four hundred moths. The x axis is the span, so squeezing it to a
    // third tucks them against the body and nothing else changes shape.
    const sx = flying ? 1 : 0.34, sy = flying ? 1 : 0.92, sz = flying ? 1 : 0.95;
    // and it faces OUT of its own hole rather than along its last velocity,
    // which at rest is zero and points the whole cliff due north
    const yaw = flying ? Math.atan2(gorPigeonData[o + 3], gorPigeonData[o + 5])
                       : Math.PI * 0.5 + Math.sin(gorPigeonData[o + 6] * 3.1) * 0.6;
    // the head bob. A pigeon standing on a ledge is never still, and thirty
    // milliradians of pitch on its own clock is the whole of that.
    const bob = flying ? 0 : Math.sin(gorTime * 2.4 + gorPigeonData[o + 6] * 5) * 0.09;
    gorPigeonMesh.setMatrixAt(i, gorXform(
      gorPigeonData[o], gorPigeonData[o + 1], gorPigeonData[o + 2],
      bob, yaw,
      flying ? Math.sin(ph) * 0.8 * clamp(out * 2.2, 0, 1) : 0, sx, sy, sz));
  }
  gorPigeonMesh.instanceMatrix.needsUpdate = true;
}

// ============================================================= THE BALLOONS =
/**
 * AN ENVELOPE IS A SPHERE THAT HAS BEEN SAT ON, WITH GORES.
 *
 * The gores are the whole silhouette: alternating vertical panels of two
 * fabrics, which is how every balloon on earth is sewn and the only thing that
 * stops a low-poly one reading as a beach ball. They are painted per VERTEX off
 * the longitude — no texture, no extra draw call, and it costs one loop at
 * build time.
 */
function gorEnvelopeGeo(r, a, b) {
  const g = new THREE.SphereGeometry(r, 16, 10);
  const p = g.attributes.position.array;
  const col = new Float32Array(p.length);
  const ca = new THREE.Color(a), cb = new THREE.Color(b);
  for (let i = 0; i < p.length; i += 3) {
    // squash the bottom into the pear an inflated envelope actually is, and
    // pull the very bottom in to the throat
    const t = clamp((p[i + 1] + r) / (2 * r), 0, 1);
    const pinch = 0.35 + 0.65 * Math.sin(Math.PI * Math.pow(t, 0.78));
    p[i] *= pinch; p[i + 2] *= pinch;
    p[i + 1] = p[i + 1] * 1.14 + r * 0.1;
    const lon = Math.atan2(p[i + 2], p[i]);
    const gore = Math.floor((lon + Math.PI) / (Math.PI * 2) * 8) % 2;
    gorCol.copy(gore ? ca : cb);
    // and a horizontal band of the other fabric round the crown, because every
    // one of them has one
    if (t > 0.72) gorCol.copy(gore ? cb : ca);
    col[i] = gorCol.r; col[i + 1] = gorCol.g; col[i + 2] = gorCol.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

function gorBuildBalloon(game, root) {
  const g = new THREE.Group();

  const env = new THREE.Mesh(gorEnvelopeGeo(gorENV_R, PALETTE.gorEnvA, PALETTE.gorEnvC), gorVCOwn());
  env.position.y = gorENV_R * 1.15 + 3.4;
  env.castShadow = true;
  g.add(env);
  g.userData.env = env;

  const M = gorMerger();
  // the throat, the burner frame and the basket
  M.cone(0, 3.0, 0, 1.5, 2.4, PALETTE.gorEnvC, Math.PI, 0, 0, 8);
  for (let s = 0; s < 4; s++) {
    M.cyl((s & 1 ? 0.9 : -0.9), 2.1, (s & 2 ? 0.9 : -0.9), 0.05, 2.0, PALETTE.gorSteel, 0, 0, 0, 4);
  }
  M.box(0, 1.32, 0, 1.3, 0.5, 1.3, PALETTE.gorSteel);
  // two cylinders of propane in the corners, which is what everybody trips over
  M.cyl(0.95, 0.85, 0.95, 0.24, 0.9, PALETTE.gorSteel, 0, 0, 0, 8);
  M.cyl(-0.95, 0.85, 0.95, 0.24, 0.9, PALETTE.gorSteel, 0, 0, 0, 8);
  // the basket: a floor and four low walls, and they are LOW on purpose — a
  // basket you cannot hop out of is a cage, and the animal has to be able to
  // leave whenever it likes
  M.box(0, 0.06, 0, gorBASKET.w, 0.14, gorBASKET.d, PALETTE.gorBasketDk);
  for (let s = -1; s <= 1; s += 2) {
    M.box(s * gorBASKET.w * 0.5, gorBASKET.h * 0.5, 0, 0.14, gorBASKET.h, gorBASKET.d, PALETTE.gorBasket);
    M.box(0, gorBASKET.h * 0.5, s * gorBASKET.d * 0.5, gorBASKET.w, gorBASKET.h, 0.14, PALETTE.gorBasket);
  }
  M.box(0, gorBASKET.h + 0.06, 0, gorBASKET.w + 0.16, 0.12, gorBASKET.d + 0.16, PALETTE.gorBasketDk);
  const rig = new THREE.Mesh(M.build(), gorVC());
  rig.castShadow = true; rig.receiveShadow = true;
  g.add(rig);

  // THE FLAME. The one warm light in the frame at five in the morning, and the
  // only feedback the burner gets — it is what tells you the thing is answering
  // three seconds before the basket does.
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.5, 6),
                               gorGlowMat(PALETTE.gorBurner, 1.4));
  flame.position.set(0, 2.2, 0);
  flame.visible = false;
  g.add(flame);
  g.userData.flame = flame;

  root.add(g);
  gorBalloon = g;

  gorBalX = gorFIELD.x; gorBalZ = gorFIELD.z - 6;
  gorBalY = gorTerrain(gorBalX, gorBalZ);

  const b = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC,
                              material: (game.mats && game.mats.ground) || undefined });
  b.addShape(new CANNON.Box(new CANNON.Vec3(gorBASKET.w * 0.5, 0.12, gorBASKET.d * 0.5)));
  // A KINEMATIC BODY AT REST FALLS ASLEEP AND A SLEEPING BODY IS SKIPPED IN
  // NARROWPHASE — the floor of a moving platform silently stops existing, which
  // is the most confusing bug in this whole codebase and it has been paid for
  // once already, on the Star Ferry.
  b.allowSleep = false;
  // FOUR WALLS, ONE BODY. The basket was a floor and nothing else, so an animal
  // that drifted a metre and a half in any direction simply walked off the edge
  // of it at altitude. The walls are drawn 62 cm high — low enough to see the
  // whole animal over and to hop out of — and now they are also SOLID, which is
  // the difference between a basket and a pallet.
  // The COLLIDING wall is half the height of the drawn one, and deliberately:
  // it only has to be a kerb. The frame channel above already means the animal
  // does not slide relative to the basket at all, so this is belt and braces —
  // and a wall at the drawn height would be a wall you have to jump to board.
  const t = 0.16, hw = gorBASKET.w * 0.5, hd = gorBASKET.d * 0.5, hh = 0.15;
  b.addShape(new CANNON.Box(new CANNON.Vec3(t * 0.5, hh, hd)),
             new CANNON.Vec3(hw - t * 0.5, hh + 0.12, 0));
  b.addShape(new CANNON.Box(new CANNON.Vec3(t * 0.5, hh, hd)),
             new CANNON.Vec3(-hw + t * 0.5, hh + 0.12, 0));
  b.addShape(new CANNON.Box(new CANNON.Vec3(hw, hh, t * 0.5)),
             new CANNON.Vec3(0, hh + 0.12, hd - t * 0.5));
  b.addShape(new CANNON.Box(new CANNON.Vec3(hw, hh, t * 0.5)),
             new CANNON.Vec3(0, hh + 0.12, -hd + t * 0.5));
  b.position.set(gorBalX, gorBalY + 0.1, gorBalZ);
  gorSyncBody(b);
  game.world.addBody(b);
  gorBasketBody = b;
}

// ---------------------------------------------------------------- SHADOWS --
/**
 * TWENTY-SEVEN BALLOONS AND NOT ONE SHADOW ON THE GROUND.
 *
 * The shadow map in this game is fitted to a forty-four unit box that follows
 * the capybara (see the performance budget), which is exactly right for the
 * chapter it was written for and exactly wrong for one whose subject is
 * hanging a hundred and fifty metres over a valley: the moment a balloon
 * clears about twenty metres its shadow leaves the box and it stops casting
 * altogether. So the valley floor at dawn, with a hundred and fifty envelopes
 * over it, was completely unmarked — and the low sun raking across a valley
 * full of balloon shadows is the single most photographed thing about that
 * place.
 *
 * So they are PAINTED, exactly the way the Drift's light pools and Mong Kok's
 * road pools are: one flat disc per balloon, on the ground under it, sized and
 * faded by altitude. The sun is low and to the east while gorSun runs, so the
 * shadow is OFFSET west by an amount that shrinks as the sun climbs — which
 * means the whole field of shadows walks in toward its own balloons over the
 * two minutes of the sunrise, and that is a thing the player can watch happen.
 *
 * SIXTEEN SIDES, NOT EIGHT. A pool of light is round and it is a CURVE — eight
 * is a visible polygon at anything over about three metres across, which the
 * Drift and Mong Kok both paid for, and these are twelve metres across.
 */
let gorShadowMesh = null;
const gorSHADOW_N = gorDECOR_N + 1;          // the twenty-six, and the player's
function gorBuildShadows(root) {
  // TWENTY SIDES AND A QUARTER OF THE INK.
  //
  // At sixteen sides, 0.34 opacity, gorTuffShadow (which is a BLUE) and a
  // twelve-metre radius, a balloon shadow on pale tuff is not a shadow — it is
  // a grey-blue polygon lying on the ground with a straight edge you can trace,
  // and there are twenty-seven of them. Measured off the valley floor: two of
  // them together covered a third of the frame. The soil tone rather than the
  // blue, less of it, smaller, and enough sides that nobody counts them.
  const g = new THREE.CircleGeometry(0.5, 20);
  g.rotateX(-Math.PI / 2);
  gorShadowMesh = new THREE.InstancedMesh(g, mat(PALETTE.gorSoil, {
    transparent: true, opacity: 0.26, depthWrite: false,
  }).clone(), gorSHADOW_N);
  gorShadowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  gorShadowMesh.frustumCulled = false;
  gorShadowMesh.renderOrder = 1;
  gorShadowMesh.receiveShadow = false;
  gorShadowMesh.castShadow = false;
  gorShadowMesh.name = 'gorShadows';
  root.add(gorShadowMesh);
}
function gorPlaceShadow(i, bx, bz, alt, r) {
  // WEST, AND LESS SO AS THE SUN COMES UP. At gorSun = 0 the disc is thrown a
  // long way off the balloon (the sun is on the rim and the light is nearly
  // horizontal); by gorSun = 1 it is most of the way home.
  const throwK = lerp(1.5, 0.42, gorSmooth(gorSun));
  const sx = bx - alt * throwK;
  const sz = bz + alt * throwK * 0.22;
  const gy = gorTerrain(sx, sz);
  // it spreads and fades with height, because a shadow does
  const s = r * (1 + clamp(alt / 90, 0, 1) * 0.85);
  const fade = clamp(1 - alt / 190, 0.06, 1) * clamp(alt / 3, 0, 1);
  gorM.compose(gorV3.set(sx, gy + 0.05, sz), gorQ.identity(), gorSc.set(s * 2, 1, s * 2));
  gorShadowMesh.setMatrixAt(i, gorM);
  // ...and it goes GREY as it spreads, not merely fainter. A shadow thrown by
  // something a hundred metres up has almost no umbra left in it.
  gorCol.setScalar(fade * lerp(1.0, 0.55, clamp(alt / 120, 0, 1)));
  gorShadowMesh.setColorAt(i, gorCol);
}
/**
 * The five crews' burners, each on its own clock. See gorBuildField.
 *
 * AND YOU HEAR THE ONE YOU CAN SEE. This chapter's own ambience note calls the
 * burners "from all over the valley at once" the whole soundscape — and what it
 * actually did was fire a generic hiss on a random timer with no connection to
 * which envelope was lit. Five paper lanterns flashing out of step in silence,
 * and a hiss from nowhere in particular. The flash IS the sound now, at the
 * volume the distance says, which is the only version of this that tells a
 * player where the other crews are without them having to look.
 */
function gorUpdateFieldBurners() {
  for (let i = 0; i < gorFieldEnv.length; i++) {
    const e = gorFieldEnv[i];
    // a burn is short and it comes round every eight or nine seconds, which is
    // roughly what topping up a stationary envelope actually takes
    const u = (gorTime * 0.118 + e.ph) % 1;
    const on = u < 0.22 ? gorSmooth(u / 0.06) * gorSmooth((0.22 - u) / 0.07) : 0;
    if (e.mat && e.mat.emissive) {
      e.mat.emissive.copy(gorBurnerC);
      e.mat.emissiveIntensity = on * 0.80 * (1 + Math.sin(gorTime * 21 + i) * 0.16);
    }
    const lit = on > 0.35;
    if (lit && !e.was) {
      const h = gorHeard(e.x, e.z, 10, 130);
      // AND THE PITCH DROPS WITH DISTANCE. Nothing in this game models the speed
      // of sound and it would be a gimmick if it did — but air eats the top of a
      // flame's noise long before it eats the bottom, and that one number is the
      // whole difference between the crew twenty metres away and the crew at the
      // far end of the field.
      if (h > 0.03) gorSfx('hiss', { volume: 0.34 * h, pitch: 1.05 + h * 0.75 });
    }
    e.was = lit;
  }
}

function gorUpdateShadows() {
  if (!gorShadowMesh) return;
  for (let i = 0; i < gorDECOR_N; i++) {
    const o = i * 5;
    gorPlaceShadow(i, gorDecorData[o], gorDecorData[o + 1], gorDecorData[o + 2],
                   3.4 + (i % 4) * 0.6);
  }
  gorPlaceShadow(gorDECOR_N, gorBalX, gorBalZ,
                 gorBalY - gorTerrain(gorBalX, gorBalZ), gorENV_R);
  gorShadowMesh.instanceMatrix.needsUpdate = true;
  if (gorShadowMesh.instanceColor) gorShadowMesh.instanceColor.needsUpdate = true;
}

/** The other twenty-six. Three instanced meshes, and they never touch physics. */
function gorBuildDecor(root) {
  const cols = [PALETTE.gorEnvA, PALETTE.gorEnvB, PALETTE.gorEnvC,
                PALETTE.gorEnvD, PALETTE.gorEnvE, PALETTE.gorEnvF];
  gorDecorData = new Float32Array(gorDECOR_N * 5);   // x, z, y, launchPhase, rate
  const envGeo = gorEnvelopeGeo(1, 0xffffff, 0xffffff);
  const em = new THREE.InstancedMesh(envGeo, mat(0xffffff), gorDECOR_N);
  const bm = new THREE.InstancedMesh(gorG.box, mat(PALETTE.gorBasket), gorDECOR_N);
  const tm = new THREE.InstancedMesh(gorG.cone8, mat(PALETTE.gorEnvC), gorDECOR_N);
  for (let i = 0; i < gorDECOR_N; i++) {
    const o = i * 5;
    gorDecorData[o] = rand(-64, 70);
    gorDecorData[o + 1] = rand(-70, 26);
    gorDecorData[o + 2] = 0;
    gorDecorData[o + 3] = rand(0, 0.11);            // they do not all go at once
    gorDecorData[o + 4] = rand(0.85, 1.5);
    gorCol.set(cols[i % cols.length]);
    em.setColorAt(i, gorCol);
    // RECORDED, because the dawn line rewrites this attribute every frame and
    // there is no other copy of what colour the fabric started out.
    gorDecorBase.push(gorCol.r, gorCol.g, gorCol.b);
  }
  if (em.instanceColor) em.instanceColor.needsUpdate = true;
  em.frustumCulled = false; bm.frustumCulled = false; tm.frustumCulled = false;
  em.castShadow = true;
  root.add(em); root.add(bm); root.add(tm);
  gorDecorMeshEnv = em; gorDecorMeshBask = bm; gorDecorMeshThroat = tm;
}

function gorUpdateDecor(dt) {
  if (!gorDecorMeshEnv) return;
  for (let i = 0; i < gorDECOR_N; i++) {
    const o = i * 5;
    const go = clamp((gorPhase - gorLAUNCH_P - gorDecorData[o + 3]) / 0.30, 0, 1);
    // a real ascent: quick off the ground and then easing as it finds its level
    const target = go <= 0 ? 0 : (1 - Math.exp(-go * 3.4)) * (58 + i * 3.4) * gorDecorData[o + 4];
    gorDecorData[o + 2] = damp(gorDecorData[o + 2], target, 0.6, dt);
    const y = gorTerrain(gorDecorData[o], gorDecorData[o + 1]) + 6 + gorDecorData[o + 2];
    // and they DRIFT, each in the wind of the layer it happens to be in — which
    // is not decoration, it is the tutorial: twenty-six objects demonstrating
    // the mechanic before the player has touched it.
    const w = gorWindAt(gorDecorData[o + 2], gorDecorData[o], gorDecorData[o + 1]);
    gorDecorData[o] += w.x * dt * 0.55;
    gorDecorData[o + 1] += w.z * dt * 0.55;
    if (gorDecorData[o] > 110) gorDecorData[o] = -70;
    if (gorDecorData[o] < -76) gorDecorData[o] = 104;
    if (gorDecorData[o + 1] > 60) gorDecorData[o + 1] = -84;
    if (gorDecorData[o + 1] < -90) gorDecorData[o + 1] = 54;
    // KEEP OUT OF THE PLAYER'S BALLOON. Twenty-six envelopes scattered over the
    // valley put three of them within ten metres of the one the player is
    // standing in, and a seven-metre orange sphere at ten metres is the whole
    // frame. Anything that drifts inside the keep-out is pushed straight back
    // out along the line between them, which is invisible at this distance and
    // is the only thing that stops the marquee shot being a wall of nylon.
    {
      const ddx = gorDecorData[o] - gorBalX, ddz = gorDecorData[o + 1] - gorBalZ;
      const dd = Math.hypot(ddx, ddz);
      if (dd < 30) {
        const s = dd > 0.01 ? 30 / dd : 1;
        gorDecorData[o] = gorBalX + ddx * s;
        gorDecorData[o + 1] = gorBalZ + ddz * s;
      }
    }
    const r = 3.4 + (i % 4) * 0.6;
    const sway = Math.sin(gorTime * 0.4 + i) * 0.03;
    gorDecorMeshEnv.setMatrixAt(i, gorXform(gorDecorData[o], y + r * 1.2, gorDecorData[o + 1],
                                            sway, i, 0, r, r, r));
    gorDecorMeshBask.setMatrixAt(i, gorXform(gorDecorData[o], y - r * 0.55, gorDecorData[o + 1],
                                             0, i, 0, 1.7, 1.3, 1.7));
    gorDecorMeshThroat.setMatrixAt(i, gorXform(gorDecorData[o], y + r * 0.05, gorDecorData[o + 1],
                                               Math.PI, i, 0, 2.2, 2.0, 2.2));
  }
  gorDecorMeshEnv.instanceMatrix.needsUpdate = true;
  gorDecorMeshBask.instanceMatrix.needsUpdate = true;
  gorDecorMeshThroat.instanceMatrix.needsUpdate = true;
  gorUpdateDawnLine();
}

/**
 * THE SUNRISE, AND WHAT IT ACTUALLY LOOKS LIKE FROM INSIDE A VALLEY.
 *
 * The chapter's marquee — be up there when the sun clears the rim — used to
 * consist of: the sky gradient moves, a disc appears over the ridge, a chime,
 * a shake and the score swells. All of which happens to the BACKGROUND. The
 * thing the player is actually looking at, a hundred and fifty envelopes over
 * a valley, did not change at all.
 *
 * What happens in a valley at sunrise is that the light arrives as a LINE and
 * the line comes DOWN: the highest thing catches it first and the floor is
 * still in shadow minutes later. That is the whole reason those photographs
 * exist — a hundred balloons at four different heights lighting up in order.
 *
 * So there is a light line, it descends from above the ceiling to the valley
 * floor over the eighteen seconds gorSun runs, and every envelope above it is
 * multiplied toward the sunrise colour with a soft edge. It is one instance
 * colour per balloon per frame, twenty-seven of them, and it is the difference
 * between a lighting change and an event.
 */
const gorDecorBase = [];
const gorDawnC = new THREE.Color(PALETTE.gorSkyLow);
// AND ALL TWENTY-SIX OF THEM ARE BURNING.
//
// The player's own envelope lights up from the inside when the burner is on —
// that was the last pass, and it is the picture of this valley. The other
// twenty-six, which is to say the ENTIRE SKY of this chapter, did not: they
// climbed in silence like paper lanterns on a string. A balloon holds altitude
// by burning about every twenty seconds, all night, and a hundred and fifty of
// them over one valley before dawn means there is always one lit somewhere.
// Watching the far ones flash is also the only way to read a wind you are not
// in yet, which makes it a picture that teaches.
//
// Deterministic phases off the index — no state, no allocation, and no two
// adjacent. gorDecorLit is only there so the roar fires on the RISING edge.
const gorDecorLit = new Uint8Array(gorDECOR_N);
const gorDECOR_BURN = 0.052;               // Hz-ish: about one burn every 19 s
function gorUpdateDawnLine() {
  if (!gorDecorMeshEnv || !gorDecorMeshEnv.instanceColor || !gorDecorBase.length) return;
  // above gorCEIL before the sun, on the floor after it, and the edge is soft
  // over about twenty-five metres because a rim two hundred metres off is not
  // a knife
  const line = lerp(gorCEIL + 40, -30, gorSmooth(gorSun));
  for (let i = 0; i < gorDECOR_N; i++) {
    const o = i * 5, b = i * 3;
    const y = gorTerrain(gorDecorData[o], gorDecorData[o + 1]) + 6 + gorDecorData[o + 2];
    const lit = clamp((y - line) / 25, 0, 1) * clamp(gorSun * 3, 0, 1);
    // ---- the burner ------------------------------------------------------
    // Only once it is off the ground, and it FADES OUT rather than snapping:
    // an envelope stays warm for a second or two after the blast valve shuts,
    // which is also what stops twenty-six of these reading as a strobe.
    let burn = 0;
    if (gorDecorData[o + 2] > 3) {
      const u = (gorTime * gorDECOR_BURN + i * 0.3701 + (i % 5) * 0.13) % 1;
      if (u < 0.16) burn = gorSmooth(u / 0.035) * gorSmooth((0.16 - u) / 0.10);
    }
    const on = burn > 0.4;
    if (on && !gorDecorLit[i]) {
      // AND YOU HEAR IT ACROSS THE VALLEY. Further than the field crews, because
      // these are in the air with nothing between them and the ear, and lower in
      // pitch for the same reason the field ones are — see gorUpdateFieldBurners.
      const h = gorHeard(gorDecorData[o], gorDecorData[o + 1], 24, 210);
      if (h > 0.02) gorSfx('hiss', { volume: 0.26 * h, pitch: 0.95 + h * 0.7 });
    }
    gorDecorLit[i] = on ? 1 : 0;
    gorCol.setRGB(gorDecorBase[b], gorDecorBase[b + 1], gorDecorBase[b + 2]);
    gorCol.lerp(gorDawnC, lit * 0.42);
    gorCol.multiplyScalar(1 + lit * 0.55);
    // the lantern. Toward the burner's own colour and BRIGHTER, which is what
    // two thousand cubic metres of nylon with a four-metre flame inside it does.
    if (burn > 0.002) {
      gorCol.lerp(gorBurnerC, burn * 0.55);
      gorCol.multiplyScalar(1 + burn * 0.95);
    }
    gorDecorMeshEnv.setColorAt(i, gorCol);
  }
  gorDecorMeshEnv.instanceColor.needsUpdate = true;
}

// ================================================================== THE SKY =
/**
 * THE ONLY CHAPTER IN THIS GAME THAT NEEDS A SKY, AND IT NEEDS ONE BADLY.
 *
 * Every other place here is looked at from six metres up with the ground filling
 * two thirds of the frame, and `scene.background` — one flat colour — is enough.
 * This one puts the player at a hundred and fifty metres with nothing below the
 * horizon but haze, so a flat background is two thirds of the picture and it is
 * a wall of one colour. It also has the game's only sunRISE in it, and a sunrise
 * with no sun in it is a lighting change.
 *
 * So: a dome, vertex-coloured from night at the zenith to fire at the horizon
 * and painted brighter on the east side; a disc that actually comes up over the
 * ridge as gorSun runs; and four cirrus streaks that catch it first, because
 * high cloud is always what goes pink before anything on the ground does.
 *
 * The dome takes fog: false. It is nine hundred metres away and the fog would
 * dissolve it into the background it is there to replace.
 */
function gorBuildSky(root) {
  const R = 900;
  const g = new THREE.SphereGeometry(R, 32, 20);
  const p = g.attributes.position.array;
  const col = new Float32Array(p.length);
  const top = new THREE.Color(PALETTE.gorSkyTop);
  const mid = new THREE.Color(PALETTE.gorSkyHigh);
  const low = new THREE.Color(PALETTE.gorSkyLow);
  for (let i = 0; i < p.length; i += 3) {
    const t = clamp((p[i + 1] / R + 0.14) / 0.9, 0, 1);
    gorCol.copy(low).lerp(mid, gorSmooth(t / 0.42)).lerp(top, gorSmooth((t - 0.32) / 0.68));
    // and the east is always the warm side, because that is where it is coming from
    const east = clamp(p[i] / R, 0, 1);
    gorCol.lerp(low, east * 0.34 * (1 - t * 0.55));
    col[i] = gorCol.r; col[i + 1] = gorCol.g; col[i + 2] = gorCol.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = mat(0xffffff, { vertexColors: true, side: THREE.BackSide }).clone();
  m.fog = false;
  m.depthWrite = false;
  // THE ONE EXEMPTION FROM THE FLAT-SHADING LAW IN THIRTEEN CHAPTERS, and it is
  // not a shape. Flat shading is what makes every OBJECT in this game read as
  // folded paper; on a nine-hundred-metre dome it turns a dawn gradient into
  // thirty-two visible quads, which is worse than the flat background it
  // replaced. A gradient is not a silhouette and the law is about silhouettes.
  m.flatShading = false;
  m.needsUpdate = true;
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  root.add(mesh);
  gorSkyMesh = mesh;

  // ---- the disc ----------------------------------------------------------
  gorSunMat = gorGlowMat(PALETTE.gorSun, 1.0);
  gorSunMat.fog = false;
  const sd = new THREE.Mesh(new THREE.SphereGeometry(24, 12, 8), gorSunMat);
  sd.frustumCulled = false;
  sd.userData.noShadow = true;
  sd.renderOrder = -9;
  root.add(sd);
  gorSunMesh = sd;

  // FOUR SHELLS ON A SQUARED RAMP, NOT ONE.
  //
  // However faint a single translucent sphere is, it has exactly one value — so
  // its silhouette is an EDGE, and what it draws round the sun is a pale
  // OCTAGON with a hard rim, which is what the dawn frame photographed. Same
  // note as Iceland's sodium pools, Venice's arcade lamps and the Drift's moon:
  // however many rings you draw, each is flat. Four, stepping outward with the
  // opacity falling as the square of the step, sums to about what the single
  // one was through the middle and is worth a fiftieth at the rim.
  gorSunGlow = new THREE.Group();
  gorSunGlow.frustumCulled = false;
  gorGlowMat2 = [];
  const GH = [[0.52, 1.00], [0.82, 0.40], [1.20, 0.15], [1.70, 0.05]];
  for (let k = 0; k < GH.length; k++) {
    const gm = gorGlowMat(PALETTE.gorSkyLow, 0.85);
    gm.fog = false;
    gm.transparent = true;
    gm.opacity = 0.30 * GH[k][1];
    gm.depthWrite = false;
    gm.userData.base = GH[k][1];
    const sh = new THREE.Mesh(new THREE.SphereGeometry(74 * GH[k][0], 12, 8), gm);
    sh.frustumCulled = false;
    sh.userData.noShadow = true;
    gorSunGlow.add(sh);
    gorGlowMat2.push(gm);
  }
  gorSunGlow.renderOrder = -9;
  root.add(gorSunGlow);

  // ---- the cirrus, which goes pink a quarter of an hour before anything else
  const M = gorMerger();
  let seed = 4004;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 300 + rnd() * 380;
    M.box(Math.sin(a) * r, 190 + rnd() * 160, Math.cos(a) * r,
          60 + rnd() * 130, 2.4, 14 + rnd() * 22,
          rnd() < 0.5 ? PALETTE.gorSkyLow : PALETTE.gorTuffPale, 0, rnd() * 0.7);
  }
  const cm = mat(0xffffff, { vertexColors: true, transparent: true, opacity: 0.34 }).clone();
  cm.fog = false;
  cm.depthWrite = false;
  const cirrus = new THREE.Mesh(M.build(), cm);
  cirrus.frustumCulled = false;
  cirrus.renderOrder = -8;
  root.add(cirrus);
  gorCirrus = cirrus;
}
function gorUpdateSky() {
  if (!gorSunMesh) return;
  // It comes up over the RIDGE, which is at x = 118 and about seventy metres
  // high — so the disc is still below the skyline for the first third of its
  // travel and the moment it clears is a moment, not a fade.
  const y = lerp(-120, 300, gorSmooth(gorSun));
  gorSunMesh.position.set(760, y, -70);
  gorSunGlow.position.set(760, y, -70);
  if (gorSunMat) gorSunMat.emissiveIntensity = 0.9 + gorSun * 1.4;
  if (gorGlowMat2) {
    for (let k = 0; k < gorGlowMat2.length; k++) {
      gorGlowMat2[k].opacity = (0.16 + gorDawnLit * 0.22) * gorGlowMat2[k].userData.base;
    }
  }
  // THE CREST LINE COMES UP BEFORE THE DISC DOES, and it is nearly out again by
  // the time the disc is clear — a rim light exists only while the source is
  // BEHIND the thing it is lighting. Peaks at gorSun 0.30, which is about
  // twenty seconds before the sun is over the ridge, and that is the minute in
  // which everybody on that field stops what they are doing and looks east.
  if (gorRimMat) {
    const k = gorSmooth(clamp(gorSun / 0.30, 0, 1)) * (1 - gorSmooth(clamp((gorSun - 0.42) / 0.5, 0, 1)));
    const pre = gorSmooth(clamp((gorDawnLit - 0.45) / 0.5, 0, 1)) * 0.22;
    // 0.52, NOT 0.80. A rim light is a GLOW along an edge; at four fifths opaque
    // it is a painted stripe, and the ridge behind it stops being rock.
    // ...AND IT IS WARM, NOT WHITE. At 2.5 of emissive an orange goes to paper
    // and the crest reads as SNOW, which is the one thing a valley in central
    // Anatolia in August does not have on it. Half the drive, and the colour
    // survives all the way to the top of the ramp.
    gorRimMat.opacity = clamp(pre + k * 0.44, 0, 1);
    gorRimMat.emissiveIntensity = 0.45 + k * 0.95;
  }
  if (gorCirrus) gorCirrus.rotation.y = gorTime * 0.0014;
  // AND SOMEBODY TURNS THE TEA HOUSE OFF. A string of bulbs is a thing that is
  // ON because it is dark, and this chapter's whole clock is the dark ending:
  // they fade out over the same eighteen seconds the disc takes to clear the
  // ridge, and the last one of them goes as the valley floor comes up. It is
  // two lines and it is the difference between a lighting rig and a morning.
  if (gorBulbMat) {
    gorBulbMat.emissiveIntensity = 1.25 * (1 - gorSmooth(clamp((gorSun - 0.30) / 0.55, 0, 1)))
                                 * (0.94 + Math.sin(gorTime * 3.1) * 0.06);
  }
}

// ================================================================ THE WISPS =
/**
 * THE WIND MAP, DRAWN IN THE SKY INSTEAD OF ON THE HUD.
 *
 * A hundred and twenty thin streaks of cloud, each living at one altitude and
 * moving at that altitude's own wind. That is the entire user interface for the
 * chapter's mechanic: look out of the basket, see which way the streaks at your
 * height are going, and if it is the wrong way, change your height. No panel,
 * no arrow, no number — the information is where the player is already looking.
 */
function gorBuildWisps(root) {
  gorWispData = new Float32Array(gorWISP_N * 4);    // x, y, z, len
  // ...AND EACH LAYER IS ITS OWN COLOUR.
  //
  // The wisps are this chapter's entire user interface and every one of them was
  // the same pale grey, so reading them meant tracking a single streak across
  // the sky long enough to work out which way it was going — from inside a
  // basket, at a hundred metres, while four other layers of them crossed the
  // same frame going four other ways. Four tints, warm at the bottom and cool at
  // the top (which is also what haze actually does with height), and the layer
  // you are IN is legible in one glance instead of in four seconds of tracking.
  // No HUD, no arrow, no number — the same argument the wisps were built on,
  // carried one step further.
  // ...AND THE TINTS ARE A HINT, NOT A PAINT JOB. At full strength, four
  // saturated streak colours crossing a dark backlit ridge read as hairline
  // SCRATCHES on the lens — measured, and worse than the flat grey they
  // replaced. Each is dragged two thirds of the way back to pale cloud, so the
  // layer is still legible at a glance and the thing on the screen is a wisp.
  const layerCol = [];
  {
    const pale2 = new THREE.Color(PALETTE.gorTuffPale);
    const raw = [PALETTE.gorSkyLow, PALETTE.gorTuffPale,
                 PALETTE.gorTuffRose, PALETTE.gorSkyHigh];
    for (let i = 0; i < 4; i++) {
      layerCol.push(new THREE.Color(raw[i]).lerp(pale2, 0.66).getHex());
    }
  }
  const m = new THREE.InstancedMesh(gorG.streak,
    // A STREAK, NOT A SLAB. At 1.6 x 0.38 and forty per cent opaque these read
    // as pale boards from a hundred metres and as WALLS from ten — measured on
    // the marquee frame, where six of them crossed the whole picture. Thin,
    // long, and faint: a wisp you can see the wind in and not much else.
    mat(PALETTE.gorTuffPale, { transparent: true, opacity: 0.24, depthWrite: false }), gorWISP_N);
  for (let i = 0; i < gorWISP_N; i++) {
    const o = i * 4;
    const layer = 1 + (i % 4);
    const lo = gorLAYERS[layer].base + 4;
    const hi = (gorLAYERS[layer + 1] ? gorLAYERS[layer + 1].base : 210) - 6;
    gorWispData[o] = rand(-110, 120);
    gorWispData[o + 1] = rand(lo, hi);
    gorWispData[o + 2] = rand(-120, 70);
    gorWispData[o + 3] = 12 + rand(0, 22);
    gorCol.set(layerCol[(layer - 1) % 4]);
    m.setColorAt(i, gorCol);
  }
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
  m.frustumCulled = false;
  m.renderOrder = 1;
  m.name = 'gorWisps';
  root.add(m);
  gorWispMesh = m;
}
function gorUpdateWisps(dt) {
  if (!gorWispMesh) return;
  for (let i = 0; i < gorWISP_N; i++) {
    const o = i * 4;
    // ---- THE WISPS ARE THE UI AND THE UI WAS OFF BY A LAYER --------------
    //
    // gorUpdateBalloon asks for the wind at `gorBalY - groundY` — the height
    // ABOVE THE GROUND — because that is what the burner and the layer tally
    // and the toast all use. The wisps asked for it at their ABSOLUTE y. The
    // valley floor runs from -2.2 on the landing plain to about +10 in the
    // town, so the two disagreed by as much as twelve metres, against a
    // gorBLEND of nine: a player who read the streaks, chose a height and
    // burned to it could arrive in a layer going the other way, and nothing
    // in the chapter would ever have told them why.
    //
    // The wisp is DRAWN at its absolute height (it is a cloud, it does not
    // hug the ground) and the wind is EVALUATED at its height above whatever
    // is under it, which is what the balloon does. One argument, and it makes
    // the only instrument in the chapter honest.
    const gy = gorTerrain(gorWispData[o], gorWispData[o + 2]);
    const w = gorWindAt(gorWispData[o + 1] - gy, gorWispData[o], gorWispData[o + 2]);
    gorWispData[o] += w.x * dt;
    gorWispData[o + 2] += w.z * dt;
    if (gorWispData[o] > 130) gorWispData[o] = -118;
    if (gorWispData[o] < -118) gorWispData[o] = 130;
    if (gorWispData[o + 2] > 80) gorWispData[o + 2] = -128;
    if (gorWispData[o + 2] < -128) gorWispData[o + 2] = 80;
    const yaw = Math.atan2(w.x, w.z);
    gorWispMesh.setMatrixAt(i, gorXform(gorWispData[o], gorWispData[o + 1], gorWispData[o + 2],
    // 0.55 x 0.09, NOT 0.9 x 0.16. Measured off the marquee frame: at the wider
    // setting a wisp thirty metres from the basket is a pale BOARD across the
    // picture, and six of them crossed it. A streak has to be thin enough that
    // the thing you read is its direction.
                                        0, yaw, 0, 1.15, 0.34, gorWispData[o + 3]));
  }
  gorWispMesh.instanceMatrix.needsUpdate = true;
}

// ============================================================== THE TETHER ==
/** One envelope still on its side, held down by a rope and a peg. */
function gorBuildTether(game, root) {
  const g = new THREE.Group();
  const M = gorMerger();
  const gy = gorTerrain(-17, 2);
  // THIRTEEN METRES OF ENVELOPE YOU COULD WALK THROUGH. The solidity audit
  // put fifty hits on this one object — the biggest single walk-through in
  // the chapter — and a half-inflated balloon is not unrolled fabric, it is a
  // bag with two thousand cubic metres of air in it. Solid now, and low
  // enough that the animal can still hop onto it.
  //
  // WHICH MEANS THE TASK HAD TO MOVE, and it should have been there anyway.
  // The zone was a circle round the envelope, so "chew through something
  // important" was triggered by standing inside the balloon. The important
  // thing is the CROWN LINE — the one rope holding the whole business down —
  // and it runs from the top of the envelope to a peg nine metres away. That
  // is the thing you bite, and now that is where the beacon points.
  // KEEP THE BODY. It has to be able to leave: the whole point of the task is
  // that this envelope goes to Kayseri, and for the life of the chapter it went
  // WITHOUT ITS COLLIDER — an eleven-metre invisible wall left standing in the
  // middle of the launch field, in the exact spot the player has just walked to,
  // for the rest of the chapter. Nothing draws it and nothing explains it.
  gorTetherBody = gorStaticBox(game, -17, gy + 2.4, 2, 11.0, 5.0, 7.4);
  // on its side, half inflated, which is what they look like for twenty minutes
  // and it is SEWN. See the crew at state 1: a smooth ellipsoid is a whale, and
  // a gore is a panel OF the bag rather than a batten laid across it.
  for (let gq = 0; gq < 7; gq++) {
    const t = (gq / 6 - 0.5) * 2;
    const prof = Math.sqrt(Math.max(0.10, 1 - t * t * 0.80));
    M.sph(t * 5.7, 2.6, 0, 1.9, 2.92 * prof, 4.25 * prof,
          gq % 2 ? PALETTE.gorEnvB : PALETTE.gorEnvD, 8);
  }
  M.sph(0, 2.4, -5.0, 4.2, 2.1, 3.0, PALETTE.gorEnvD, 8);
  M.box(0, 0.5, 5.6, 2.4, 1.0, 2.4, PALETTE.gorBasket);
  // the crown line, running from the top of the envelope to a peg in the dirt
  M.cyl(0, 2.6, -9.5, 0.06, 9.6, PALETTE.gorSteel, 1.32, 0, 0, 4);
  M.box(0, 0.15, -13.4, 0.3, 0.6, 0.3, PALETTE.gorSteel);
  // and the fan blowing cold air into it, which is the loudest thing on a
  // launch field and the reason nobody hears the capybara
  M.cyl(3.2, 0.9, 6.4, 0.9, 0.5, PALETTE.gorSteel, 0, 0, Math.PI * 0.5, 8);
  const mesh = new THREE.Mesh(M.build(), gorVC());
  mesh.castShadow = true;
  g.add(mesh);
  g.position.set(-17, gy, 2);
  root.add(g);
  gorTetherGroup = g;
}

// ========================================================== THE LAUNCH FIELD =
/**
 * FIVE CREWS, ALL AT A DIFFERENT POINT OF THE SAME TWENTY MINUTES.
 *
 * None of it is collidable except the trucks — you walk through unrolled fabric
 * because unrolled fabric is what you walk through — and all of it is one merged
 * mesh. The floodlights are emissive for the reason everything that is a light
 * in this game is: a Lambert box at five in the morning renders black.
 */
/**
 * A PERSON, MERGED. Eleven boxes, one silhouette, no draw call of its own.
 *
 * The launch field is described in this file as "five crews, all at a
 * different point of the same twenty minutes" and it was drawn with NOBODY IN
 * IT — five envelopes, five trucks, five floodlights and not one human being,
 * at the one hour of the day when a Cappadocian launch field is the busiest
 * place in the province. The chapter's own comment calls the field "the
 * best-observed thing in this chapter"; what it observed was the equipment.
 *
 * These are not npc.js locals. A local is somebody you can talk to and there
 * are only ever two or three of those in a chapter; a crew is a CROWD, and a
 * crowd is geometry. Same argument as Rio's blocos and Kowloon's pavement.
 *
 * `pose` is the only interesting parameter:
 *   0  standing, arms down          — waiting, which is most of ballooning
 *   1  both arms up                 — holding the mouth of an envelope open
 *   2  one arm out                  — on the fan, or pointing at the sky
 *   3  bent at the waist            — laying out fabric, or coiling rope
 *   4  SITTING                     — on a stool, with tea, which in that town
 *                                    at ten past five is what most people are
 *                                    doing. `y` is the seat, not the ground.
 */
function gorFigure(M, x, y, z, yaw, shirt, legs, pose) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const px = (dx, dz) => x + dx * c + dz * s;
  const pz = (dx, dz) => z - dx * s + dz * c;
  const lean = pose === 3 ? 0.85 : 0;
  const sit = pose === 4;
  // legs. A SEATED FIGURE IS NOT A STANDING ONE MOVED DOWN — the thighs go
  // forward and the shins go down, and getting that wrong is the difference
  // between three men having tea and three men standing on their stools.
  if (sit) {
    for (let sd = -1; sd <= 1; sd += 2) {
      M.box(px(sd * 0.11, 0.20), y + 0.06, pz(sd * 0.11, 0.20), 0.17, 0.17, 0.46, legs, 0, yaw, 0);
      M.box(px(sd * 0.11, 0.40), y - 0.20, pz(sd * 0.11, 0.40), 0.16, 0.42, 0.17, legs, 0, yaw, 0);
    }
  } else {
    M.box(px(-0.11, 0), y + 0.39, pz(-0.11, 0), 0.17, 0.78, 0.19, legs, 0, yaw, 0);
    M.box(px(0.11, 0), y + 0.39, pz(0.11, 0), 0.17, 0.78, 0.19, legs, 0, yaw, 0);
  }
  // torso — and it FOLDS for pose 3, which is what laying out fabric is
  const ty = sit ? y + 0.44 : lean ? y + 0.98 : y + 1.09;
  const tz = lean ? 0.26 : 0;
  M.box(px(0, tz), ty, pz(0, tz), 0.50, 0.62, 0.28, shirt, lean, yaw, 0);
  // head
  const hy = sit ? y + 0.92 : lean ? y + 1.28 : y + 1.57;
  const hz = lean ? 0.52 : 0;
  M.box(px(0, hz), hy, pz(0, hz), 0.26, 0.30, 0.25, PALETTE.gorSoil, lean, yaw, 0);
  M.box(px(0, hz), hy + 0.16, pz(0, hz), 0.30, 0.09, 0.29, PALETTE.gorBasaltDk, lean, yaw, 0);
  // the nose, which is the only reason a head has a FRONT — npc.js's trick
  M.box(px(0, hz + 0.15), hy, pz(0, hz + 0.15), 0.05, 0.05, 0.05, PALETTE.gorSoil, lean, yaw, 0);
  // arms
  for (let sd = -1; sd <= 1; sd += 2) {
    if (pose === 1) {
      M.box(px(sd * 0.30, 0), y + 1.60, pz(sd * 0.30, 0), 0.13, 0.60, 0.14, shirt, 0, yaw, sd * 0.30);
    } else if (pose === 2 && sd > 0) {
      M.box(px(0.55, 0.10), y + 1.36, pz(0.55, 0.10), 0.58, 0.13, 0.14, shirt, 0, yaw, 0.12);
    } else if (pose === 3) {
      M.box(px(sd * 0.26, 0.42), y + 0.78, pz(sd * 0.26, 0.42), 0.13, 0.58, 0.14, shirt, 0.7, yaw, 0);
    } else if (sit) {
      // forearms on the thighs, which is how everybody sits on a low stool
      M.box(px(sd * 0.29, 0.05), y + 0.50, pz(sd * 0.29, 0.05), 0.13, 0.40, 0.14, shirt, 0, yaw, 0);
      M.box(px(sd * 0.24, 0.24), y + 0.31, pz(sd * 0.24, 0.24), 0.12, 0.13, 0.36, shirt, 0, yaw, 0);
    } else {
      M.box(px(sd * 0.30, 0), y + 1.04, pz(sd * 0.30, 0), 0.13, 0.56, 0.14, shirt, 0, yaw, sd * 0.06);
    }
  }
}

function gorBuildField(game, root) {
  const M = gorMerger();
  let seed = 1717;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const F = gorFIELD;
  const fabs = [PALETTE.gorEnvB, PALETTE.gorEnvD, PALETTE.gorEnvE, PALETTE.gorEnvF, PALETTE.gorEnvA];
  const lamps = [];

  // the crews, laid out along the field rather than scattered over it —
  // they all park facing the same way because they all use the same track
  const crews = [
    { x: -19, z: 12, state: 0 },     // 0 = fabric flat on the ground
    { x: -5,  z: 14, state: 1 },     // 1 = the fan is on, it is filling
    { x: 12,  z: 11, state: 2 },     // 2 = up, and about to go
    { x: 20,  z: -4, state: 0 },
    { x: -21, z: -6, state: 1 },
  ];
  for (let c = 0; c < crews.length; c++) {
    const cr = crews[c];
    const gy = gorTerrain(cr.x, cr.z);
    const col = fabs[c % fabs.length];
    const ry = (rnd() - 0.5) * 0.8;
    // RECORDED, because the angle comes out of a seeded rnd() in here and there
    // is no way to recompute it from outside. gorCheckField reads this.
    gorCrews.push({ x: cr.x, z: cr.z, gy: gy, ry: ry, state: cr.state });

    // ---- THE CREW ---------------------------------------------------------
    // Four to a balloon, which is what it actually takes, and what they are
    // doing is a function of where their envelope is in the morning. The
    // shirts run through the fabric palette so a crew reads as a crew.
    const crewCol = [PALETTE.gorEnvD, PALETTE.gorCarpet, PALETTE.gorEnvF, PALETTE.gorEnvB];
    {
      const cy = gy;
      if (cr.state === 0) {
        // laying it out: two walking the length of it, one bent over a fold,
        // one back at the truck with the rope
        gorFigure(M, cr.x + Math.sin(ry) * 5.0 + 1.3, cy, cr.z + Math.cos(ry) * 5.0,
                  ry + Math.PI, crewCol[0], PALETTE.gorBasaltDk, 3);
        gorFigure(M, cr.x - Math.sin(ry) * 4.2 - 1.1, cy, cr.z - Math.cos(ry) * 4.2,
                  ry, crewCol[1], PALETTE.gorTuffDk, 3);
        gorFigure(M, cr.x + Math.sin(ry) * 8.6, cy, cr.z + Math.cos(ry) * 8.6 + 1.4,
                  ry + 2.2, crewCol[2], PALETTE.gorBasaltDk, 0);
      } else if (cr.state === 1) {
        // THE MOUTH. Two of them hold it open against the fan and they are
        // leaning back on it, which is the single most recognisable thing that
        // happens on a launch field and the chapter has a TASK about standing
        // inside it.
        const mx = cr.x - Math.sin(ry) * 5.0, mz = cr.z - Math.cos(ry) * 5.0;
        gorFigure(M, mx + Math.cos(ry) * 3.2, cy, mz - Math.sin(ry) * 3.2,
                  ry - Math.PI * 0.5, crewCol[0], PALETTE.gorBasaltDk, 1);
        gorFigure(M, mx - Math.cos(ry) * 3.2, cy, mz + Math.sin(ry) * 3.2,
                  ry + Math.PI * 0.5, crewCol[1], PALETTE.gorTuffDk, 1);
        // and one on the fan, which is the loudest thing on the field
        gorFigure(M, cr.x - Math.sin(ry) * 9.4, cy, cr.z - Math.cos(ry) * 9.4,
                  ry + Math.PI, crewCol[2], PALETTE.gorBasaltDk, 2);
      } else {
        // up and about to go: the pilot in the basket, two on the crown line
        gorFigure(M, cr.x - 0.7, cy + 1.15, cr.z - 0.5, ry + 0.4, crewCol[0], PALETTE.gorBasaltDk, 0);
        gorFigure(M, cr.x + Math.cos(ry) * 4.4, cy, cr.z - Math.sin(ry) * 4.4,
                  ry - Math.PI * 0.5, crewCol[1], PALETTE.gorTuffDk, 1);
        gorFigure(M, cr.x - Math.cos(ry) * 4.4, cy, cr.z + Math.sin(ry) * 4.4,
                  ry + Math.PI * 0.5, crewCol[3], PALETTE.gorBasaltDk, 1);
      }
      // and the one everybody has: somebody standing next to the truck with a
      // clipboard doing absolutely nothing
      const wx = cr.x + Math.sin(ry + 1.6) * 10.4, wz = cr.z + Math.cos(ry + 1.6) * 10.4;
      gorFigure(M, wx, gorTerrain(wx, wz), wz, ry + 1.6 + Math.PI, crewCol[3],
                PALETTE.gorTuffDk, 2);
    }

    if (cr.state === 0) {
      // FIFTEEN METRES OF NYLON LYING ON THE DIRT, which is what an envelope
      // is for the first ten minutes of every morning. Drawn as a run of low
      // overlapping slabs so it folds rather than lying flat like a carpet.
      for (let i = 0; i < 9; i++) {
        const t = i / 8;
        M.box(cr.x + Math.sin(ry) * (t - 0.5) * 15, gy + 0.14 + Math.sin(i * 1.7) * 0.12,
              cr.z + Math.cos(ry) * (t - 0.5) * 15,
              5.2 - Math.abs(t - 0.5) * 4.4, 0.28, 1.9,
              i % 2 ? col : PALETTE.gorEnvC, 0, ry);
      }
      M.box(cr.x + Math.sin(ry) * 8.2, gy + 0.5, cr.z + Math.cos(ry) * 8.2,
            2.4, 1.0, 2.4, PALETTE.gorBasket, 0, ry);
    } else if (cr.state === 1) {
      // half up: a bag on its side with a fan blowing cold air into the mouth.
      //
      // AND IT IS SEWN OUT OF PANELS. Two smooth ellipsoids in one colour
      // photographed as a beached whale — twelve metres of featureless blue
      // lozenge lying in a field, which is the largest object in the arrival
      // shot of this chapter and the one that says least. A gore is the only
      // thing that makes nylon read as nylon; the upright envelopes get theirs
      // per-vertex out of gorEnvelopeGeo and these got nothing at all. Six
      // ribs of the other fabric over the bag is the same statement for
      // seventy-two triangles.
      // SEVEN OVERLAPPING SLICES IN ALTERNATING FABRIC, NOT RIBS ON TOP.
      //
      // A gore is a PANEL of the bag, not a batten laid across it: six boxes
      // stood proud of the ellipsoid with square corners and read, measured, as
      // packing crates strapped to a balloon. Slicing the bag itself — each
      // slice an ellipsoid of its own, narrow in the long axis, its half-height
      // taken off the parent's own profile so the run of them IS the shape —
      // gives alternating panels that curve with the fabric, which is what a
      // gore is and is why every balloon on earth is sewn that way.
      for (let gq = 0; gq < 7; gq++) {
        const t = (gq / 6 - 0.5) * 2;
        const prof = Math.sqrt(Math.max(0.10, 1 - t * t * 0.80));
        M.sph(cr.x - Math.sin(ry + Math.PI * 0.5) * t * 5.2,
              gy + 2.4, cr.z - Math.cos(ry + Math.PI * 0.5) * t * 5.2,
              1.75, 2.62 * prof, 4.05 * prof,
              gq % 2 ? col : PALETTE.gorEnvC, 8);
      }
      M.sph(cr.x - Math.sin(ry) * 5.0, gy + 2.1, cr.z - Math.cos(ry) * 5.0,
            3.9, 1.9, 2.9, PALETTE.gorEnvC, 8);
      M.box(cr.x + Math.sin(ry) * 6.0, gy + 0.5, cr.z + Math.cos(ry) * 6.0,
            2.4, 1.0, 2.4, PALETTE.gorBasket, 0, ry);
      M.cyl(cr.x - Math.sin(ry) * 8.2, gy + 0.9, cr.z - Math.cos(ry) * 8.2,
            0.95, 0.55, PALETTE.gorSteel, 0, ry, Math.PI * 0.5, 8);
      M.box(cr.x - Math.sin(ry) * 8.2, gy + 0.25, cr.z - Math.cos(ry) * 8.2,
            1.3, 0.5, 1.3, PALETTE.gorBasaltDk, 0, ry);
    } else {
      // and one that is up, five minutes from going, with the burner lit
      const env = new THREE.Mesh(gorEnvelopeGeo(5.4, col, PALETTE.gorEnvC), gorVCOwn());
      env.position.set(cr.x, gy + 5.4 * 1.15 + 3.0, cr.z);
      env.castShadow = true;
      root.add(env);
      // ...AND ITS BURNER GOES TOO, on its own clock. Five crews, all at a
      // different point of the same twenty minutes, and every one of them is
      // topping up: the field at ten past five is a row of paper lanterns
      // flashing out of step with each other, which is what makes it a FIELD
      // rather than a diorama with one lit object in it.
      gorFieldEnv.push({ mat: env.material, ph: c * 2.1 + 0.4, x: cr.x, z: cr.z, was: false });
      M.cone(cr.x, gy + 2.7, cr.z, 1.3, 2.1, PALETTE.gorEnvC, Math.PI, 0, 0, 8);
      M.box(cr.x, gy + 0.55, cr.z, 2.4, 1.1, 2.4, PALETTE.gorBasket, 0, ry);
      M.box(cr.x, gy + 1.15, cr.z, 2.6, 0.12, 2.6, PALETTE.gorBasketDk, 0, ry);
      for (let s = 0; s < 4; s++) {
        M.cyl(cr.x + (s & 1 ? 0.8 : -0.8), gy + 1.9, cr.z + (s & 2 ? 0.8 : -0.8),
              0.045, 1.8, PALETTE.gorSteel, 0, 0, 0, 4);
      }
      lamps.push(cr.x, gy + 2.15, cr.z, 0.8);
    }

    // every crew has a truck and a trailer, and they are all the same truck
    const tx = cr.x + Math.sin(ry + 1.6) * 13, tz = cr.z + Math.cos(ry + 1.6) * 13;
    const tg = gorTerrain(tx, tz);
    M.box(tx, tg + 0.95, tz, 2.2, 1.1, 2.6, PALETTE.gorTruck, 0, ry);
    M.box(tx + Math.sin(ry) * 2.6, tg + 0.8, tz + Math.cos(ry) * 2.6, 2.6, 0.24, 4.0,
          PALETTE.gorBasketDk, 0, ry);
    M.box(tx, tg + 1.72, tz, 2.0, 0.8, 1.2, PALETTE.gorTuffPale, 0, ry);
    gorStaticBox(game, tx, tg + 1.0, tz, 2.4, 2.0, 6.4, ry);
    // a coil of rope and two propane bottles, which is the rest of what is
    // on the ground at a launch
    M.cyl(tx + 2.2, tg + 0.14, tz - 1.4, 0.62, 0.26, PALETTE.gorBasket, 0, 0, 0, 8);
    M.cyl(tx + 3.0, tg + 0.45, tz - 0.4, 0.24, 0.9, PALETTE.gorSteel, 0, 0, 0, 8);
    M.cyl(tx + 3.6, tg + 0.45, tz - 0.9, 0.24, 0.9, PALETTE.gorSteel, 0, 0, 0, 8);
    // and the floodlight on a mast, because you cannot lay out an envelope in
    // the dark and nobody has ever tried
    const mx = cr.x + Math.sin(ry - 1.5) * 11, mz = cr.z + Math.cos(ry - 1.5) * 11;
    const mg = gorTerrain(mx, mz);
    M.cyl(mx, mg + 1.9, mz, 0.07, 3.8, PALETTE.gorSteel, 0, 0, 0, 4);
    lamps.push(mx, mg + 3.9, mz, 1.0);
  }

  // the track across the field, which everybody drives on and nobody made
  for (let i = 0; i < 22; i++) {
    const t = i / 21;
    const x = lerp(F.x - F.w * 0.5, F.x + F.w * 0.5, t);
    const z = F.z - 9 + Math.sin(t * 3.3) * 2.2;
    M.box(x, gorTerrain(x, z) + 0.03, z, 2.6, 0.08, 3.4, PALETTE.gorRoad, 0, 0.2);
  }

  const mesh = new THREE.Mesh(M.build(), gorVC());
  mesh.castShadow = true; mesh.receiveShadow = true;
  root.add(mesh);

  // A LAMBERT BOX AT FIVE IN THE MORNING RENDERS BLACK — the lesson Hong Kong's
  // neon paid for, and the reason every light in this chapter is emissive.
  const n = lamps.length / 4;
  const lm = new THREE.InstancedMesh(gorG.sph8, gorGlowMat(PALETTE.gorBurner, 1.35), n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    lm.setMatrixAt(i, gorXform(lamps[o], lamps[o + 1], lamps[o + 2], 0, 0, 0,
                               lamps[o + 3], lamps[o + 3], lamps[o + 3]));
  }
  lm.instanceMatrix.needsUpdate = true;
  lm.computeBoundingSphere();
  lm.userData.noShadow = true;
  root.add(lm);
}

// ================================================================ THE TRUCK =
/**
 * THE CHASE CREW, AND THEY ARE THE REASON THE LANDING IS A TASK RATHER THAN A
 * PUNISHMENT.
 *
 * A balloon lands where the wind put it, and the crew drives to wherever that
 * is — so the truck follows the balloon's shadow across the valley the whole
 * flight. Which means the landing task can never be unwinnable: the target
 * comes to YOU. What it cannot do is corner, so it lags, and the skill is
 * coming down somewhere it has had time to reach.
 */
// ================================================================ THE HERD ====
// THE MINI, and it is in the chapter's name.
//
// Kapadokya is the Persian katpatuka, and every guide in the valley will tell
// you within four minutes that it means the land of beautiful horses. There were
// none. The valley at ten past five had four hundred pigeon holes, a hundred and
// fifty envelopes and not one animal on the ground.
//
// So: eleven horses running the valley floor from the far end to the field, on
// a loop, before the sun is up. The lead mare carries a bell and she is the one
// you can get on — the deck is at 1.42, which is a hop from a rock and a
// stretch from flat ground, and the rest of them run either side of you at four
// metres a second while the balloons come up over the rim.
//
// It is the last chapter and the ONLY thing you steer in it, which is the joke:
// two minutes later you get in a basket with no controls at all.
const gorHERD_N = 11;
// WHERE THE LANE IS, AND WHY IT IS THERE.
//
// The valley is seventy-four fairy chimneys and six big ones, and the herd runs
// STRAIGHT through it — so the lane is not a taste decision, it is the one gap.
// The six explicit chimneys collide as boxes of half-extent 5.1 about x = -6,
// 11, -14, 9, -22 and 20, whose union covers x from -27.1 to -0.9 and 3.9 to
// 25.1: the only opening wide enough for a horse and a metre and a half of
// slack either side is between them. Measured, after the first lane (x = -8)
// ran the mare through the middle of the big chimney at (-6, -20) — she is
// kinematic and went through it, and the passenger on her back did not, and was
// squeezed eight metres into the air by the contact solver.
//
// The seventy-four random ones are rejected out of the corridor at build, on
// exactly the rule that already keeps them off the landing plain.
const gorHERD_Z0 = -74, gorHERD_Z1 = 12;   // the valley floor to the launch field
const gorHERD_X = 1.5;
const gorHERD_LANE = 3.4;                  // m of corridor kept clear either side
const gorHERD_SPD = 6.2;             // m/s — a canter, not a gallop
const gorHERD_WAIT = 9.0;            // s standing at each end
const gorHERD_HX = 0.62, gorHERD_HZ = 1.30;
const gorHERD_DECK = 1.42;           // the mare's back
const gorHERD_RIDE = 11.0;           // s up there that count as 'rode one'
let gorHerdMesh = null;              // the other ten, instanced
let gorMareGroup = null, gorMareBody = null;
let gorHerdZ = gorHERD_Z0, gorHerdDir = 1;
let gorHerdWait = gorHERD_WAIT;
let gorHerdPZ = gorHERD_Z0;
let gorHerdPY = 0;
let gorHerdT = 0;
let gorHerdRideT = 0;
let gorHerdDone = false;
let gorHerdBell = 0;
let gorHerdSeed = [];
const gorHerdPos = new THREE.Vector3();

function gorHorseGeo(mane) {
  const M = gorMerger();
  // barrel, neck, head, four legs, tail. A horse at this palette is a silhouette
  // and the silhouette is entirely in the neck angle.
  M.box(0, 1.02, 0, 0.66, 0.72, 2.05, PALETTE.gorSoil);
  M.box(0, 1.30, 0.86, 0.44, 0.62, 0.70, PALETTE.gorSoil, -0.30, 0, 0);
  M.box(0, 1.66, 1.16, 0.34, 0.80, 0.36, PALETTE.gorSoil, -0.62, 0, 0);
  M.box(0, 1.94, 1.44, 0.28, 0.30, 0.62, PALETTE.gorTuffDk, -0.20, 0, 0);
  for (let s2 = -1; s2 <= 1; s2 += 2) {
    M.box(s2 * 0.11, 2.14, 1.24, 0.09, 0.24, 0.10, PALETTE.gorTuffDk);
  }
  // the mane, and the tail
  M.box(0, 1.86, 1.02, 0.10, 0.46, 0.70, mane, -0.45, 0, 0);
  M.box(0, 1.12, -1.06, 0.12, 0.62, 0.24, mane, 0.34, 0, 0);
  for (let sx = -1; sx <= 1; sx += 2) {
    for (let sz = -1; sz <= 1; sz += 2) {
      M.box(sx * 0.26, 0.36, sz * 0.72, 0.15, 0.90, 0.17, PALETTE.gorTuffDk);
      M.box(sx * 0.26, -0.03, sz * 0.72, 0.17, 0.14, 0.22, PALETTE.gorBasalt);
    }
  }
  return M;
}

function gorBuildHerd(game, root) {
  // ---- the ten, instanced ------------------------------------------------
  gorHerdMesh = new THREE.InstancedMesh(gorHorseGeo(PALETTE.gorTuffDk).build(),
                                        gorVC(), gorHERD_N - 1);
  gorHerdMesh.castShadow = true;
  gorHerdMesh.frustumCulled = false;
  gorHerdMesh.name = 'gorHerd';
  root.add(gorHerdMesh);
  gorHerdSeed = [];
  for (let i = 0; i < gorHERD_N - 1; i++) {
    gorHerdSeed.push({
      // INSIDE THE LANE. At 9 m of spread the outriders ran through the fairy
      // chimneys either side of the cleared corridor, which is a thing horses
      // do not do.
      dx: (((i * 7919) % 100) / 100 - 0.5) * (gorHERD_LANE * 1.5),
      dz: (((i * 104729) % 100) / 100 - 0.5) * 13.0 - 2,
      ph: ((i * 65537) % 628) / 100,
      sp: 0.9 + ((i * 31337) % 100) / 100 * 0.25,
    });
  }

  // ---- the mare, which is the one with a body ----------------------------
  const M = gorHorseGeo(PALETTE.gorCarpet);
  // a saddle blanket, because the thing you can ride has to LOOK like the thing
  // you can ride from forty metres away
  M.box(0, gorHERD_DECK - 0.02, -0.08, 0.86, 0.10, 1.10, PALETTE.gorCarpet);
  M.box(0, gorHERD_DECK + 0.04, -0.08, 0.70, 0.06, 0.90, PALETTE.gorPot);
  for (let s2 = -1; s2 <= 1; s2 += 2) {
    M.box(s2 * (gorHERD_HX - 0.03), gorHERD_DECK + 0.12, 0,
          0.10, 0.24, (gorHERD_HZ - 0.10) * 2, PALETTE.gorCarpet);
    M.box(0, gorHERD_DECK + 0.12, s2 * (gorHERD_HZ - 0.05),
          gorHERD_HX * 2, 0.24, 0.10, PALETTE.gorCarpet);
  }
  M.cyl(0, 1.42, 1.02, 0.11, 0.16, PALETTE.gorBurner, 0, 0, 0, 6);
  const mesh = new THREE.Mesh(M.build(), gorVC());
  mesh.castShadow = true;
  gorMareGroup = new THREE.Group();
  gorMareGroup.name = 'gorMare';
  gorMareGroup.add(mesh);
  root.add(gorMareGroup);

  const b = new CANNON.Body({
    mass: 0, type: CANNON.Body.KINEMATIC,
    material: game.mats ? game.mats.ground : undefined,
  });
  b.addShape(new CANNON.Box(new CANNON.Vec3(gorHERD_HX, gorHERD_DECK * 0.5, gorHERD_HZ)),
             new CANNON.Vec3(0, gorHERD_DECK * 0.5, 0));
  // A SADDLE HAS A POMMEL AND A CANTLE AND THAT IS NOT DECORATION. A flat plate
  // 1.24 by 2.6 at six metres a second over broken ground puts the passenger on
  // the floor inside a stride; four low kerbs round the blanket hold it there
  // without ever being something to climb.
  //
  // BUT THEY HAVE TO BE OUT AT THE EDGES AND THEY HAVE TO BE LOW. The first cut
  // put the fore and aft kerbs at 62% of the half-length — 1.6 m apart on a
  // capybara 0.74 m across — and 0.38 m tall, which is over the animal's centre
  // of mass. It was wedged between two of them at all times, and on the first
  // grade the solver resolved the overlap on the vertical axis and fired the
  // passenger EIGHT METRES straight up. Measured. Out at the ends, and no
  // higher than the belly.
  for (let s2 = -1; s2 <= 1; s2 += 2) {
    b.addShape(new CANNON.Box(new CANNON.Vec3(0.05, 0.12, gorHERD_HZ - 0.10)),
               new CANNON.Vec3(s2 * (gorHERD_HX - 0.03), gorHERD_DECK + 0.12, 0));
    b.addShape(new CANNON.Box(new CANNON.Vec3(gorHERD_HX, 0.12, 0.05)),
               new CANNON.Vec3(0, gorHERD_DECK + 0.12, s2 * (gorHERD_HZ - 0.05)));
  }
  b.allowSleep = false;
  gorHerdZ = gorHERD_Z0; gorHerdDir = 1; gorHerdWait = gorHERD_WAIT; gorHerdPZ = gorHERD_Z0;
  gorHerdRideT = 0; gorHerdDone = false;
  const y0 = gorTerrain(gorHERD_X, gorHERD_Z0);
  gorHerdPY = y0;
  b.position.set(gorHERD_X, y0, gorHERD_Z0);
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
  game.world.addBody(b);
  gorMareBody = b;
  gorHerdPos.set(gorHERD_X, y0, gorHERD_Z0);
  gorMareGroup.position.copy(gorHerdPos);
}

/** True when the capybara is on the mare's back. */
function gorOnMare(p) {
  const b = gorMareBody;
  if (!b || !p) return false;
  const dx = p.x - b.position.x, dz = p.z - b.position.z;
  return Math.abs(dx) < gorHERD_HX + 0.40 && Math.abs(dz) < gorHERD_HZ + 0.40 &&
         p.y > b.position.y + gorHERD_DECK - 0.55 && p.y < b.position.y + gorHERD_DECK + 2.0;
}

function gorUpdateHerd(game, dt) {
  const b = gorMareBody;
  if (!b || dt <= 0) { if (b) b.velocity.setZero(); return; }
  gorHerdT += dt;

  if (gorHerdWait > 0) {
    gorHerdWait -= dt;
  } else {
    gorHerdZ += gorHERD_SPD * dt * gorHerdDir;
    if (gorHerdZ >= gorHERD_Z1) { gorHerdZ = gorHERD_Z1; gorHerdDir = -1; gorHerdWait = gorHERD_WAIT; }
    else if (gorHerdZ <= gorHERD_Z0) { gorHerdZ = gorHERD_Z0; gorHerdDir = 1; gorHerdWait = gorHERD_WAIT; }
  }
  const ty = gorTerrain(gorHERD_X, gorHerdZ);
  const inv = dt > 1e-5 ? 1 / dt : 60;
  // FROM THE TARGET ON ALL THREE AXES, and the third one is the one that got
  // written wrong. cannon integrates a kinematic body inside world.step, which
  // runs BEFORE every module update, so (target - body.position) is the ground
  // the last velocity already covered rather than the ground still to cover:
  // the sign flips every frame and the number is enormous. The horizontal was
  // differenced against the previous target from the start; the vertical was
  // differenced against the body, and the ramp onto the launch field — a
  // perfectly ordinary 29% — threw the passenger THIRTY-SIX METRES into the
  // air. Measured, every run, and it looked like a physics explosion rather
  // than like the one line of arithmetic it was.
  b.velocity.set(0, clamp((ty - gorHerdPY) * inv, -9, 9),
                 clamp((gorHerdZ - gorHerdPZ) * inv, -14, 14));
  gorHerdPZ = gorHerdZ; gorHerdPY = ty;
  const running = gorHerdWait <= 0;
  // SPOOKED, NOT BOLTING. A bell mare on a route she runs every morning does
  // not bolt at a rodent; she picks it up for a few strides. gorSpook is set
  // by the wheek — see gorUpdateWheek — and the only thing it changes is the
  // gait, because changing the SPEED would change where she is, and there is a
  // passenger standing on her.
  const gait = running ? (gorSpook > 0 ? 11.4 : 7.4) : 1.4;
  const bob = running ? Math.sin(gorHerdT * gait) * (gorSpook > 0 ? 0.085 : 0.055)
                      : Math.sin(gorHerdT * 1.4) * 0.008;
  gorMareGroup.position.set(b.interpolatedPosition.x, b.interpolatedPosition.y + bob,
                            b.interpolatedPosition.z);
  gorMareGroup.rotation.set(Math.sin(gorHerdT * gait + 1.2) * (running ? 0.06 : 0.004),
                            gorHerdDir > 0 ? 0 : Math.PI, 0);
  gorHerdPos.copy(gorMareGroup.position);

  // ---- the other ten, running either side ---------------------------------
  for (let i = 0; i < gorHerdSeed.length; i++) {
    const sd = gorHerdSeed[i];
    const x = gorHERD_X + sd.dx;
    const z = gorHerdZ + sd.dz * gorHerdDir;
    const y = gorTerrain(x, z) + (running ? Math.sin(gorHerdT * gait * sd.sp + sd.ph) * 0.06 : 0);
    gorHerdMesh.setMatrixAt(i, gorXform(x, y, z,
      running ? Math.sin(gorHerdT * gait * sd.sp + sd.ph + 1.2) * 0.07 : 0,
      (gorHerdDir > 0 ? 0 : Math.PI) + Math.sin(gorHerdT * 0.6 + sd.ph) * 0.04, 0, 1, 1, 1));
  }
  gorHerdMesh.instanceMatrix.needsUpdate = true;

  // ---- the bell, and the ride --------------------------------------------
  const capy = game.capy;
  const up = !!(capy && gorOnMare(capy.position));
  if (running) {
    gorHerdBell -= dt;
    if (gorHerdBell <= 0) {
      gorHerdBell = (up ? 0.9 : 2.4) * (gorSpook > 0 ? 0.45 : 1);
      // A BELL ON A HORSE EIGHTY METRES AWAY IS NOT THE SAME SOUND AS A BELL
      // UNDER YOUR CHIN. See gorHeard — this rang flat out from anywhere in the
      // valley, every 2.4 s, for the whole chapter.
      const h = up ? 1 : gorHeard(b.position.x, b.position.z, 6, 95);
      if (h > 0.02 && game.sfx) {
        game.sfx('chime', { volume: (up ? 0.34 : 0.30) * h, pitch: 1.6 });
      }
    }
    if (up && game.shake) game.shake(0.016);
  }
  if (gorHerdDone) return;
  if (up && running) {
    gorHerdRideT += dt;
    if (gorHerdRideT >= gorHERD_RIDE) {
      gorHerdDone = true;
      gorTask('the-herd');
      gorSaysNow('horse',
        ['She let you stay on. She does not let me stay on.',
         'That is the whole name, that is. Land of beautiful horses.',
         'Same run every morning before the sun. She would do it without me.'],
        ['Now she has heard everything.']);
    }
  } else if (!up) {
    gorHerdRideT = 0;
  }
}

function gorBuildTruck(root) {
  const M = gorMerger();
  M.box(0, 0.95, -0.6, 2.2, 1.1, 2.6, PALETTE.gorTruck);
  M.box(0, 1.75, -1.4, 2.0, 0.8, 1.2, PALETTE.gorTruck);
  M.box(0, 1.72, -2.02, 1.7, 0.6, 0.12, PALETTE.gorWindow);
  // the trailer, and it is the thing you are aiming at
  M.box(0, 0.8, 2.4, 2.6, 0.24, 4.2, PALETTE.gorBasketDk);
  for (let s = -1; s <= 1; s += 2) {
    M.box(s * 1.3, 1.1, 2.4, 0.14, 0.6, 4.2, PALETTE.gorSteel);
  }
  for (let w = 0; w < 6; w++) {
    M.cyl((w & 1 ? 1.15 : -1.15), 0.42, [-1.4, 1.2, 3.6][w >> 1], 0.42, 0.3,
          PALETTE.gorBasaltDk, 0, 0, Math.PI * 0.5, 6);
  }
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(M.build(), gorVC());
  mesh.castShadow = true;
  g.add(mesh);
  root.add(g);
  gorTruck = g;
}
/**
 * THE DUST BEHIND THE TRUCK.
 *
 * The chase crew drives across a dry tuff valley for the whole of every
 * flight, at nine metres a second, and left nothing behind it at all — while
 * the ground it is driving on is described in this file's own palette as
 * "tuff dust, and there is a lot of it". It is also the only way to SEE the
 * truck from a hundred and fifty metres up, which is exactly where the player
 * is when the truck matters: a khaki box on khaki ground at that range is
 * invisible, and a plume is legible from anywhere in the valley.
 *
 * Thirty-two quads, laid flat and growing, on a ring buffer. Flat rather than
 * upright for the reason the Manly haze is flat: from a lens above it, a
 * horizontal sheet reads as a cloud from every bearing and needs no billboard.
 */
const gorDUST_N = 32;
let gorDustMesh = null, gorDustData = null, gorDustNext = 0, gorDustT = 0;
function gorBuildDust(root) {
  const g = new THREE.PlaneGeometry(1, 1);
  g.rotateX(-Math.PI / 2);
  gorDustMesh = new THREE.InstancedMesh(g, mat(PALETTE.gorSoil, {
    transparent: true, opacity: 0.30, depthWrite: false,
  }).clone(), gorDUST_N);
  gorDustMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  gorDustMesh.frustumCulled = false;
  gorDustMesh.renderOrder = 2;
  gorDustMesh.name = 'gorDust';
  gorDustData = new Float32Array(gorDUST_N * 4);       // x, z, t, seed
  for (let i = 0; i < gorDUST_N; i++) gorDustData[i * 4 + 2] = -1;
  root.add(gorDustMesh);
}
function gorUpdateDust(dt, moving) {
  if (!gorDustMesh) return;
  gorDustT -= dt;
  if (moving && gorDustT <= 0) {
    gorDustT = 0.14;
    const i = gorDustNext = (gorDustNext + 1) % gorDUST_N;
    const o = i * 4;
    // off the BACK wheels, which is where it comes from
    gorDustData[o] = gorTruckX - Math.sin(gorTruckYaw) * 2.4 + rand(-0.5, 0.5);
    gorDustData[o + 1] = gorTruckZ - Math.cos(gorTruckYaw) * 2.4 + rand(-0.5, 0.5);
    gorDustData[o + 2] = 0;
    gorDustData[o + 3] = rand(0, 6.28);
  }
  let live = 0;
  for (let i = 0; i < gorDUST_N; i++) {
    const o = i * 4;
    if (gorDustData[o + 2] < 0) { gorM.makeScale(0, 0, 0); gorM.setPosition(0, -900, 0);
                                  gorDustMesh.setMatrixAt(i, gorM); continue; }
    gorDustData[o + 2] += dt;
    const t = gorDustData[o + 2];
    if (t > 3.4) { gorDustData[o + 2] = -1; continue; }
    // it spreads and it drifts on the layer it is standing in, which is the
    // dead-calm one, so it barely drifts at all — and that is correct
    const w = gorWindAt(1.5, gorDustData[o], gorDustData[o + 1]);
    gorDustData[o] += w.x * dt * 0.4;
    gorDustData[o + 1] += w.z * dt * 0.4;
    const s = 1.6 + t * 2.6;
    const gy = gorTerrain(gorDustData[o], gorDustData[o + 1]);
    gorM.compose(gorV3.set(gorDustData[o], gy + 0.35 + t * 0.55, gorDustData[o + 1]),
                 gorQ.setFromEuler(gorEu.set(0, gorDustData[o + 3], 0, 'YXZ')),
                 gorSc.set(s, 1, s));
    gorDustMesh.setMatrixAt(i, gorM);
    gorCol.setScalar(clamp(1 - t / 3.4, 0, 1) * 0.9);
    gorDustMesh.setColorAt(i, gorCol);
    live++;
  }
  gorDustMesh.instanceMatrix.needsUpdate = true;
  if (gorDustMesh.instanceColor) gorDustMesh.instanceColor.needsUpdate = true;
  gorDustMesh.visible = live > 0;
}

function gorUpdateTruck(dt) {
  if (!gorTruck) return;
  // it drives to under the balloon, at a truck's speed, and it will not go
  // where a truck cannot go
  const tx = clamp(gorBalX, -66, 78);
  const tz = clamp(gorBalZ, -104, 56);
  const dx = tx - gorTruckX, dz = tz - gorTruckZ;
  const d = Math.hypot(dx, dz);
  if (d > 3) {
    const sp = Math.min(9, d * 0.6);
    gorTruckX += (dx / d) * sp * dt;
    gorTruckZ += (dz / d) * sp * dt;
    // WRAPPED. damp() is a plain lerp with no shortest-arc handling and atan2
    // returns (-pi, pi], so a truck chasing a balloon that is drifting away
    // down the valley sits on the +/-pi discontinuity for most of the flight
    // and takes the long way round — a full 2*pi spin on the spot every time
    // the bearing crosses. The trailer's position is derived from this yaw, so
    // 'on-the-trailer' was recording the distance to a point that was swinging
    // through a 2.4 m circle while it measured.
    let gyErr = Math.atan2(dx, dz) - gorTruckYaw;
    gyErr = Math.atan2(Math.sin(gyErr), Math.cos(gyErr));
    gorTruckYaw += gyErr * (1 - Math.exp(-3 * dt));

  }
  gorTruck.position.set(gorTruckX, gorTerrain(gorTruckX, gorTruckZ) + 0.05, gorTruckZ);
  gorTruck.rotation.y = gorTruckYaw;
  gorTruck.rotation.z = Math.sin(gorTime * 6) * 0.012 * (d > 3 ? 1 : 0);
  gorUpdateDust(dt, d > 3);
}

// ============================================================== THE BALLOON =
/**
 * ONE UPDATE, AND EVERY DECISION IN THE CHAPTER IS IN IT.
 *
 * The horizontal velocity is NOT the player's and never can be: it is whatever
 * the wind at this altitude is, damped, because an envelope with two thousand
 * cubic metres of air in it takes a few seconds to take up a new layer. The
 * vertical velocity is entirely the player's and lagged hard, because the lag
 * is the skill.
 *
 * The animal is carried by the basket's contact for the horizontal — that is
 * the platform frame in capybara.js and it needs nothing new. The VERTICAL is
 * written here, because the platform frame is horizontal-only and a floor that
 * drops away at two metres a second under a capybara is a capybara that spends
 * the flight bouncing off its own basket. Assigning velocity from inside a
 * biome is the Drift's puff trick and it is safe for the same reason: it
 * replaces what the solver did this step rather than fighting it.
 */
function gorUpdateBalloon(game, dt) {
  if (!gorBasketBody) return;
  const capy = game.capy;
  const input = game.input;
  const groundY = gorTerrain(gorBalX, gorBalZ);

  // ---- who is flying this thing -------------------------------------------
  const floorY = gorBalY + 0.12;
  const wasAboard = gorAboard;
  gorAboard = !!(capy && capy.position &&
                 Math.abs(capy.position.x - gorBalX) < gorBASKET.w * 0.5 + 0.35 &&
                 Math.abs(capy.position.z - gorBalZ) < gorBASKET.d * 0.5 + 0.35 &&
                 capy.position.y > floorY - 0.4 && capy.position.y < floorY + 2.2);
  if (gorAboard && !wasAboard) {
    gorAboardT = 0;
    if (!gorToldBurner) {
      gorToldBurner = true;
      gorToast('hold E for the burner. let go and it comes down. the stick does nothing.');
    }
  }
  if (gorAboard) gorAboardT += dt; else gorAboardT = 0;

  // ---- the burner, and there is nothing else -------------------------------
  const wantBurn = gorAboard && input && input.action && gorBalY < gorCEIL;
  gorBalBurn = damp(gorBalBurn, wantBurn ? 1 : 0, wantBurn ? 2.6 : gorCOOL_LAG, dt);

  // The envelope's own inertia. gorBURN_LAG is a lambda, so 0.26 is about four
  // seconds to nine tenths — which is roughly what a real one takes and,
  // much more importantly, the number that turns this from a lift into a puzzle:
  // you commit to a layer before you can see whether it was the right one.
  let wantVY = lerp(gorSINK_V, gorBURN_V, gorBalBurn);
  if (!gorAboard && gorBalY > groundY + 0.2) wantVY = gorSINK_V * 0.55;   // it settles
  gorBalVY = damp(gorBalVY, wantVY, gorBURN_LAG, dt);

  // ---- and the only thing that decides where you GO ------------------------
  const w = gorWindAt(gorBalY - groundY, gorBalX, gorBalZ);
  gorBalVX = damp(gorBalVX, w.x, gorDRIFT_LAG, dt);
  gorBalVZ = damp(gorBalVZ, w.z, gorDRIFT_LAG, dt);

  gorBalX += gorBalVX * dt;
  gorBalZ += gorBalVZ * dt;
  gorBalY += gorBalVY * dt;

  // ---- the ground, and it is where a flight ends --------------------------
  const gy = gorTerrain(gorBalX, gorBalZ);
  let landedNow = false;
  if (gorBalY <= gy) {
    gorBalY = gy;
    if (gorBalVY < -0.35) landedNow = true;
    if (gorBalVY < 0) gorBalVY = 0;
    gorGroundedT += dt;
  } else {
    gorGroundedT = 0;
  }
  if (gorBalY > gorCEIL + 6) { gorBalY = gorCEIL + 6; gorBalVY = Math.min(gorBalVY, 0); }
  if (gorBalY > gorHighest) gorHighest = gorBalY;

  // ---- THE CREW WALKS IT BACK ---------------------------------------------
  // A balloon parked in the far corner of a valley with nobody in it is a
  // chapter you cannot finish, and this game does not have those. Empty, on the
  // ground and forgotten for half a minute, it goes back to the field.
  if (!gorAboard && gorGroundedT > 1) gorEmptyT += dt; else gorEmptyT = 0;
  if (gorEmptyT > 30 && Math.hypot(gorBalX - gorFIELD.x, gorBalZ - (gorFIELD.z - 6)) > 12) {
    gorEmptyT = 0;
    gorBalX = gorFIELD.x; gorBalZ = gorFIELD.z - 6;
    gorBalY = gorTerrain(gorBalX, gorBalZ);
    gorBalVX = 0; gorBalVY = 0; gorBalVZ = 0; gorBalBurn = 0;
    gorToast('the crew have walked it back to the field. they always do.');
  }

  // ---- drive the body and the mesh ----------------------------------------
  const inv = dt > 1e-5 ? 1 / dt : 60;
  const bx = gorBalX, by = gorBalY + 0.12, bz = gorBalZ;
  // FROM THE TARGET, NOT FROM THE BODY, and then synced. cannon integrates
  // kinematic bodies inside world.step before this runs, so the old form fed
  // the contact solver a velocity that alternated between the true one and
  // roughly zero on a two-frame cycle — and that is the number the basket
  // floor and its four kerb walls are resolved against, so the passenger was
  // shaken about inside his own basket for the whole flight. carryFrame()
  // hides it from the horizontal drive; it does not hide it from the contacts.
  gorBasketBody.velocity.set((bx - gorBasketPX) * inv,
                             (by - gorBasketPY) * inv,
                             (bz - gorBasketPZ) * inv);
  gorBasketPX = bx; gorBasketPY = by; gorBasketPZ = bz;
  gorBasketBody.position.set(bx, by, bz);
  gorSyncBody(gorBasketBody);

  if (gorBalloon) {
    gorBalloon.position.set(gorBalX, gorBalY, gorBalZ);
    // the envelope trails the basket when the wind changes under it, which is
    // the one bit of body language a balloon has
    gorBalloon.rotation.z = clamp((gorBalVX - w.x) * -0.05, -0.14, 0.14);
    gorBalloon.rotation.x = clamp((gorBalVZ - w.z) * 0.05, -0.14, 0.14);
    const flame = gorBalloon.userData.flame;
    if (flame) {
      flame.visible = gorBalBurn > 0.03;
      const s = 0.6 + gorBalBurn * 1.5 + Math.sin(gorTime * 22) * 0.12 * gorBalBurn;
      flame.scale.set(1, s, 1);
      flame.material.emissiveIntensity = 1.0 + gorBalBurn * 1.6;
    }
    // ---- AND THE ENVELOPE LIGHTS UP FROM THE INSIDE --------------------
    // THE picture of that valley, and the chapter did not have it. A four-
    // metre column of burning propane inside two thousand cubic metres of
    // nylon turns the whole envelope into a paper lantern for the two seconds
    // the burner is on — it is the only reason a balloon is worth looking at
    // before dawn, and it is the strongest possible feedback for a control
    // that otherwise takes four seconds to answer anything. The burner is the
    // one lever in this chapter; now pressing it does something instantly and
    // enormously, even though the balloon still does not move for four
    // seconds. That gap is the whole design and this makes it BEARABLE.
    const envM = gorBalloon.userData.env;
    if (envM && envM.material && envM.material.emissive) {
      const flick = 1 + Math.sin(gorTime * 19) * 0.14 + Math.sin(gorTime * 31.7) * 0.07;
      envM.material.emissive.copy(gorBurnerC);
      envM.material.emissiveIntensity = gorBalBurn * 0.85 * flick;
    }
  }

  // ---- CARRY THE ANIMAL ---------------------------------------------------
  // TWO AXES AND TWO MECHANISMS, and they are different on purpose.
  //
  // HORIZONTAL goes through the reference-frame channel — capybara.js asks for
  // carryFrame() and treats the answer exactly as it treats a ferry's deck, so
  // the speed cap, the airborne bleed and the continuity of world velocity on
  // the frame you step off are all already right. It could not be done from
  // here: capybara.js runs AFTER this module and writes the horizontal velocity
  // last, so anything assigned here is overwritten within the same frame.
  //
  // VERTICAL is assigned from here, because there IS no vertical frame — the
  // channel is horizontal-only — and because the alternative is a floor that
  // drops away at a metre and a half a second under a capybara, which is a
  // capybara that spends the whole flight bouncing off its own basket.
  gorCarrying = false;
  if (gorAboard && capy && capy.body) {
    const rel = capy.position.y - floorY;
    gorCarrying = true;
    gorCarry.x = gorBalVX; gorCarry.z = gorBalVZ;
    // Only while it is actually STANDING in it. A hop leaves this band, and the
    // moment it does the animal is on its own again — otherwise there would be
    // no way out of the basket at all.
    if (rel > -0.35 && rel < 0.85) {
      const vy = capy.body.velocity.y;
      if (vy < gorBalVY + 1.4) capy.body.velocity.y = gorBalVY;
    }
  }

  // ---- the tasks that live on this thing ----------------------------------
  if (gorAboard && gorBalY > gy + 2.5) {
    if (!gorAboardDone) {
      gorAboardDone = true;
      gorFlown = true;
      gorTask('aboard');
      gorToast('nobody has said anything. nobody ever does.');
      gorSaysNow('chief',
        ['You took it up. Nobody stopped you. Nobody ever stops anybody here.',
         'Choose a height. That is all there is. That is the entire job.',
         'The truck will find you. The truck always finds you.'],
        ['Save it for when you are down. Sound carries up there.']);
      gorSfx('rustle', { volume: 0.7, pitch: 0.7 });
    }
    gorFlown = true;
    const alt = gorBalY - gy;
    const li = gorLayerOf(alt);
    if (li > 0) {
      if (!(gorLayerSeen & (1 << li))) {
        gorLayerSeen |= (1 << li);
        if (gorToldLayer !== li) {
          gorToldLayer = li;
          gorToast(gorLAYERS[li].name + '.');
        }
      }
      let n = 0;
      for (let k = 1; k < gorLAYERS.length; k++) if (gorLayerSeen & (1 << k)) n++;
      if (n >= 3 && !gorWindsDone) {
        gorWindsDone = true;
        gorTask('three-winds');
        gorToast('that is how it is done. there is no other way it is done.');
        gorSfx('chime', { volume: 0.8, pitch: 1.3 });
      }
    }
    if (typeof game.record === 'function' && alt > 12) game.record('three-winds', alt);

    // ---- the sunrise ------------------------------------------------------
    if (gorSun > 0.12 && gorSun < 0.96 && alt > 55 && !gorSunDone) {
      gorSunDone = true;
      gorTask('sunrise');
      gorSaysNow('town',
        ['You were up there for it. That is why anybody lives here.',
         'Every morning of my life. It has not got old and it is not going to.',
         'Now the whole valley goes orange for about four minutes. Watch.'],
        ['Shh. Wait. There — twice, off the rim.']);
      gorSfx('chime', { volume: 1.0, pitch: 1.5, force: true });
      if (typeof game.shake === 'function') game.shake(0.12);
    }
  }

  // ---- the landing --------------------------------------------------------
  // AND SOMEBODY HAS TO BE IN IT. gorFlown latches for good the first time the
  // basket clears 2.5 m, and the truck drives to wherever the balloon is
  // whether or not it is carrying anybody — so boarding, burning for two
  // seconds and hopping out was enough: the empty envelope sank onto the
  // waiting trailer and ticked the chapter's last task, and wrote its record,
  // while the capybara stood in the field and watched.
  if (landedNow && gorFlown && gorAboard) {

    // the trailer is on the BACK of the truck, and the truck has turned round
    // at least twice getting here
    const tx = gorTruckX + Math.sin(gorTruckYaw) * 2.4;
    const tz = gorTruckZ + Math.cos(gorTruckYaw) * 2.4;
    const d = Math.hypot(gorBalX - tx, gorBalZ - tz);
    if (typeof game.record === 'function') game.record('on-the-trailer', d);
    if (d < 6.5 && !gorLandDone) {
      gorLandDone = true;
      gorTask('on-the-trailer');
      gorToast('on the trailer. first time. the crew are not impressed, but they are lying.');
      gorSaysNow('chief',
        ['On the trailer. First go. I am not going to say anything about it.',
         'I have watched grown pilots put one in a vineyard. Twice.',
         'Right. Tea. Everybody gets tea after a landing like that.'],
        ['We heard you. The whole valley heard you.']);
      gorSaysNow('tea',
        ['They are all talking about the landing. Sit down. Tea.',
         'Two glasses, and then you tell me what it looks like from up there.',
         'Everybody who goes up comes back to this square. Everybody.'],
        ['Ha! Listen — there. And again. Told you.']);
      gorSfx('thud', { volume: 0.85, pitch: 0.9 });
      if (typeof game.shake === 'function') game.shake(0.14);
    } else {
      gorSfx('thud', { volume: 0.45, pitch: 0.7 });
      if (!gorLandDone && gorAboard) {
        gorToast(d.toFixed(0) + ' metres off the trailer. it will wait. go round again.');
      }
    }
  }
}

// ================================================================ THE CLOCK =
function gorUpdateClock(game, dt) {
  gorPhase += dt / gorCYCLE;
  if (gorPhase >= 1) { gorPhase -= 1; gorWarned = false; gorToldLayer = -1; }

  // the sun: nothing, then everything, over about eighteen seconds
  gorSun = gorSmooth(clamp((gorPhase - gorSUN_P) / 0.115, 0, 1));
  // the LIGHT leads the sun — the sky is bright long before the disc is over the
  // ridge, which is the whole reason anybody is up at this hour
  gorDawnLit = damp(gorDawnLit, clamp((gorPhase - gorLAUNCH_P) / 0.30, 0, 1), 1.4, dt);

  if (!gorWarned && gorPhase > gorLAUNCH_P - 0.05 && gorPhase < gorSUN_P) {
    gorWarned = true;
    gorToast('the balonlar are inflating. twenty minutes to the sun.');
    gorSfx('rustle', { volume: 0.4, pitch: 0.55 });
  }
  if (gorSun > 0.35 && !gorSeenSun) gorSeenSun = true;

  // THE LIFT, held for the whole of the build rather than fired at the tick —
  // the same construction the aurora and the bloom use, and for the same
  // reason: the moment starts half a minute before the moment.
  if (gorSun > 0.02 && gorSun < 0.99 && game.music && typeof game.music.swell === 'function') {
    game.music.swell(clamp(gorSun * 1.1, 0, 1));
  }
}

// ================================================================== TASKS ===
// ========================================================== THE FIELD, USED ==
// FIVE CREWS, TWENTY MINUTES APART, AND THE PLAYER WALKS PAST ALL OF THEM.
//
// The launch field is the best-observed thing in this chapter — three states of
// the same twenty minutes, laid out side by side, floodlit, with the trucks and
// the propane and the coils of rope — and the chapter's list uses exactly one
// object on it: the basket you get into. Everything else is a diorama.
//
// Two lines, and both of them are things the crews are actually doing at ten
// past five:
//
//   THE ENVELOPE. Fifteen metres of nylon flat on the dirt, and the first job of
//   the morning is to walk its length checking for tears. It is not collidable
//   and it should not be — you walk over fabric, you do not climb it — so this
//   is a zone and a distance and nothing else.
//
//   THE MOUTH. Once the fan is on, the throat of a half-inflated envelope is a
//   cold nylon cave the size of a bus, and crews stand inside it. It is the only
//   interior in the chapter.
//
// The crews' angles come out of a seeded rnd() INSIDE the build, so they cannot
// be recomputed from outside; gorCrews records them as they are drawn. That is
// the same lesson as the briccole in Venice, learnt more cheaply.
const gorCrews = [];
// the field envelopes that are already up, and their burner phases — see
// gorBuildField and gorUpdateFieldBurners
const gorFieldEnv = [];
const gorBurnerC = new THREE.Color(PALETTE.gorBurner);
let gorEnvDone = false, gorEnvOn = -1, gorEnvFrom = 0;
let gorMouthDone = false, gorMouthT = 0;

/** Distance along a crew's own axis, and distance off it. Writes into `out`. */
function gorCrewLocal(c, x, z, out) {
  const dx = x - c.x, dz = z - c.z;
  out.along = dx * Math.sin(c.ry) + dz * Math.cos(c.ry);
  out.off = dx * Math.cos(c.ry) - dz * Math.sin(c.ry);
  return out;
}
const gorCrewOut = { along: 0, off: 0 };

function gorCheckField(game, dt) {
  const capy = game.capy;
  if (!capy || !capy.position || !gorCrews.length) return;
  const p = capy.position;

  // ---- the length of an envelope -----------------------------------------
  if (!gorEnvDone) {
    let on = -1;
    for (let i = 0; i < gorCrews.length; i++) {
      const c = gorCrews[i];
      if (c.state !== 0) continue;
      gorCrewLocal(c, p.x, p.z, gorCrewOut);
      // the fabric run is 15 m long and about 5 m across at its widest
      if (Math.abs(gorCrewOut.along) < 7.6 && Math.abs(gorCrewOut.off) < 2.8 &&
          p.y < c.gy + 2.2) { on = i; break; }
    }
    if (on < 0) { gorEnvOn = -1; }
    else if (gorEnvOn !== on) { gorEnvOn = on; gorEnvFrom = gorCrewOut.along; }
    else if (Math.abs(gorCrewOut.along - gorEnvFrom) > 11) {
      gorEnvDone = true;
      gorTask('the-envelope');
      gorSfx('rustle', { volume: 0.55, pitch: 0.85 });
      gorToast('the first job of every morning: walk it, and look for tears.');
    }
  }

  // ---- inside the mouth of one that is filling ---------------------------
  if (gorMouthDone) return;
  let inside = false;
  for (let i = 0; i < gorCrews.length; i++) {
    const c = gorCrews[i];
    if (c.state !== 1) continue;
    // the throat is the second sphere, five metres back down the axis from the
    // crown — see gorBuildField
    const tx = c.x - Math.sin(c.ry) * 5.0, tz = c.z - Math.cos(c.ry) * 5.0;
    const dx = p.x - tx, dz = p.z - tz;
    if (dx * dx + dz * dz < 3.2 * 3.2 && p.y < c.gy + 3.4) { inside = true; break; }
  }
  if (!inside) { gorMouthT = 0; return; }
  gorMouthT += dt;
  if (gorMouthT > 1.6) {
    gorMouthDone = true;
    gorTask('the-mouth');
    gorSfx('hiss', { volume: 0.65, pitch: 0.5 });
    gorToast('a cold nylon cave the size of a bus, and it is filling up.');
  }
}

/**
 * PEOPLE WHO HAVE NOTICED.
 *
 * npc.js reads a local's `lines` array LIVE, so a chapter that keeps its
 * records can change what somebody says the moment the world changes under
 * them. Seven people in this valley said the same three sentences whether the
 * capybara had walked past them or had just cut their crown line, put four
 * hundred of their pigeons in the air, ridden their bell mare, or landed a
 * balloon on their trailer.
 *
 * A person who says the same thing after all that is scenery with a mouth on
 * it. Every switch below is hung on a task that has actually completed, so
 * nobody ever congratulates you for something you have not done — and the
 * balloon crew, deliberately, gets the FLIGHT rather than the landing, because
 * a crew chief notices you leave and the chase driver notices you arrive.
 */
const gorLocals = {};
function gorSaysNow(who, lines, wheek) {
  const r = gorLocals[who];
  if (!r) return;
  if (lines) r.lines = lines;
  if (wheek) r.wheekLines = wheek;
}

function gorTask(id) {
  const g = gorGame;
  if (g && typeof g.completeTask === 'function') { try { g.completeTask(id); } catch (e) {} }
}
function gorToast(t) {
  const g = gorGame;
  if (g && typeof g.toast === 'function') { try { g.toast(t); } catch (e) {} }
}
function gorSfx(n, o) {
  // ALWAYS through the dispatcher, never a bare synth: it is what supplies the
  // default volume and pitch and what wraps every voice in a try/catch.
  const g = gorGame;
  if (g && typeof g.sfx === 'function') { try { g.sfx(n, o); } catch (e) {} }
}

/**
 * THE WHEEK HAD NO ANSWER IN THIS CHAPTER AT ALL.
 *
 * One voice, one button, and in Cappadocia it did nothing to anything: not the
 * four hundred pigeons in the cliff, not the eleven horses running the valley
 * floor, not the twenty people on the launch field. The Drift learnt this the
 * hard way — a biome with exactly one responder to the game's only voice reads
 * as a place that cannot hear you. Three answers, and all three are things
 * that would actually happen:
 *
 *   THE DOVECOTE. A hundred and sixty birds off a rock face, from a hundred
 *   metres, which is further than E can reach and is the correct verb anyway:
 *   nobody has ever put a flock up by touching the cliff.
 *
 *   THE HERD. Eleven horses at a canter, and the bell doubles its rate for
 *   four seconds. They do not bolt — a bell mare on a route she has run every
 *   morning does not bolt at a rodent — they just go up a gear.
 *
 *   THE VALLEY. It gives it back. The chapter's own plaza local says so
 *   ("the valley gives that back to you twice") and until now it did not:
 *   two echoes, at the delay a two-hundred-metre rim actually returns.
 */
let gorEcho1 = -1, gorEcho2 = -1, gorSpook = 0;
function gorUpdateWheek(game, dt) {
  const capy = game.capy;
  if (gorEcho1 > 0) { gorEcho1 -= dt; if (gorEcho1 <= 0) { gorEcho1 = -1; gorSfx('wheek', { volume: 0.20, pitch: 0.97 }); } }
  if (gorEcho2 > 0) { gorEcho2 -= dt; if (gorEcho2 <= 0) { gorEcho2 = -1; gorSfx('wheek', { volume: 0.09, pitch: 0.93 }); } }
  if (gorSpook > 0) gorSpook -= dt;
  if (!capy || !capy.position || !game.input || !game.input.honkPressed) return;
  const p = capy.position;

  // ---- the cliff ---------------------------------------------------------
  const cd = Math.hypot(p.x - (gorCLIFF.x + 6), p.z - (gorCLIFF.z0 + gorCLIFF.z1) * 0.5);
  if (cd < 100 && gorPigeonOut < 0.5) {
    gorPigeonOut = 1;
    for (let i = 0; i < gorPIGEON_N; i++) {
      const o = i * 10;
      gorPigeonData[o + 3] = rand(3, 11);
      gorPigeonData[o + 4] = rand(2, 8);
      gorPigeonData[o + 5] = rand(-5, 5);
    }
    gorSfx('rustle', { volume: clamp(1.0 - cd * 0.006, 0.15, 1.0), pitch: 1.5 });
    if (!gorDoveDone) {
      gorDoveDone = true;
      gorTask('dovecote');
      gorToast('eight hundred years of pigeons, and you are what happened to them.');
      gorSaysNow('dove',
        ['Four hundred birds. From one noise. I have seen men fail to do that.',
         'They will be back in half a minute. They always come back. It is the door they know.',
         'My grandfather would have thrown a boot at you. He threw boots at me.'],
        ['They have only just settled! Have some mercy.']);
      if (typeof game.shake === 'function') game.shake(0.13);
    }
  }

  // ---- the herd ----------------------------------------------------------
  if (Math.hypot(p.x - gorHERD_X, p.z - gorHerdZ) < 45) gorSpook = 4.0;

  // ---- and the valley gives it back --------------------------------------
  // A rim two hundred metres off returns at about 340 m/s: 1.2 s and then the
  // far wall at 2.4. Not a reverb — two discrete answers, which is what a
  // canyon does and what the plaza local has been promising since the chapter
  // shipped.
  gorEcho1 = 1.15;
  gorEcho2 = 2.35;
}

function gorUpdateTasks(game, dt) {
  const capy = game.capy;
  if (!capy || !capy.position) return;
  const p = capy.position;
  const input = game.input;

  // ---- the chimney --------------------------------------------------------
  if (!gorClimbers) return;
  if (capy.climbing && !gorChimDone) {
    for (let i = 0; i < gorClimbers.length; i++) {
      const c = gorClimbers[i];
      if (p.y > c.top - 2.5 && Math.hypot(p.x - c.x, p.z - c.z) < c.rb + 4) {
        gorChimDone = true;
        gorTask('chimney-top');
        gorToast('ten million years of rain and one rock that would not move.');
        gorSfx('pop', { volume: 0.8, pitch: 1.2 });
        break;
      }
    }
  }
  if (!gorChimDone && !capy.climbing && gorInZone('valley', p.x, p.z)) {
    for (let i = 0; i < gorClimbers.length; i++) {
      const c = gorClimbers[i];
      if (Math.hypot(p.x - c.x, p.z - c.z) < c.rb + 3.5 && p.y < c.base + 3) {
        if (!gorToldChimney) {
          gorToldChimney = true;
          gorToast('hold E against the soft rock. you have done this before.');
        }
        break;
      }
    }
  }

  // ---- the dovecote -------------------------------------------------------
  if (!gorDoveDone && gorInZone('cliff', p.x, p.z) && input && input.actionPressed) {
    gorDoveDone = true;
    gorPigeonOut = 1;
    for (let i = 0; i < gorPIGEON_N; i++) {
      const o = i * 10;
      gorPigeonData[o + 3] = rand(3, 11);
      gorPigeonData[o + 4] = rand(2, 8);
      gorPigeonData[o + 5] = rand(-5, 5);
    }
    gorTask('dovecote');
    gorToast('eight hundred years of pigeons, and you are what happened to them.');
    gorSfx('rustle', { volume: 1.0, pitch: 1.5 });
    if (typeof game.shake === 'function') game.shake(0.13);
  }
  // ---- the tether ---------------------------------------------------------
  if (!gorTetherCut && gorInZone('tether', p.x, p.z) && input && input.actionPressed) {
    gorTetherCut = true;
    gorTetherDone = true;
    gorTask('the-tether');
    gorSaysNow('crew',
      ['That was a two-hundred-lira rope and I am not even cross.',
       'It will come down somewhere near Kayseri. They always do.',
       'Sixteen years I have been laying that envelope out. Sixteen.'],
      ['Do not. I have had enough surprises this morning.']);
    gorToast('that one is going to Kayseri. with nobody in it.');
    gorSfx('rustle', { volume: 0.9, pitch: 0.8 });
  }
  if (gorTetherCut && gorTetherGroup) {
    gorTetherY = damp(gorTetherY, 120, 0.25, dt);
    gorTetherGroup.position.y = gorTerrain(-17, 2) + gorTetherY;
    // AND THE COLLIDER GOES WITH IT. Lifted rather than removed, so the drawn
    // bag and the solid one stay the same object all the way up — a player who
    // hops onto the envelope on the frame it lets go rides it, which is a better
    // answer than falling through the thing they are standing on.
    if (gorTetherBody) {
      gorTetherBody.position.y = gorTerrain(-17, 2) + 2.4 + gorTetherY;
      gorTetherBody.position.x = -17 + gorTetherY * 0.09;
      gorSyncBody(gorTetherBody);
      gorTetherBody.aabbNeedsUpdate = true;
    }
    gorTetherGroup.rotation.x = damp(gorTetherGroup.rotation.x, -Math.PI * 0.5, 0.4, dt);
    gorTetherGroup.rotation.z = Math.sin(gorTime * 0.5) * 0.12;
    gorTetherGroup.position.x = -17 + gorTetherY * 0.09;
  }
}

// =============================================================== LIFECYCLE ===
export function createGoreme(game) {
  gorGame = game;

  game.biome.register('goreme', {
    ensureBuilt() { gorBuild(game); },
    onEnter() {
      // Put the morning back to a few minutes before the launch, so a chapter
      // you come back to opens the way it opened the first time.
      gorPhase = 0.06;
      gorSun = 0; gorDawnLit = 0; gorWarned = false;
      gorTime = 0;
      gorBalX = gorFIELD.x; gorBalZ = gorFIELD.z - 6;
      gorBalY = gorTerrain(gorBalX, gorBalZ);
      gorBalVX = 0; gorBalVY = 0; gorBalVZ = 0;
      gorBalBurn = 0;
      gorAboard = false; gorAboardT = 0; gorEmptyT = 0; gorGroundedT = 0;
      gorCarrying = false; gorCarry.x = 0; gorCarry.z = 0;
      gorTruckX = 20; gorTruckZ = 10;
      gorToldLayer = -1;
      // Ambient state, put back where it was. A flock left in the air, a dust
      // plume hanging over the landing plain and a spooked herd are all things
      // that would greet a returning player with the aftermath of a visit they
      // do not remember making.
      gorPigeonOut = 0; gorSpook = 0;
      gorEcho1 = -1; gorEcho2 = -1;
      gorDustT = 0;
      // running totals and one-shot prompts, which only ever meant anything
      // inside one visit
      gorHighest = 0; gorGroundedT = 0;
      gorHerdRideT = 0; gorHerdBell = 0;
      gorMouthT = 0; gorEnvOn = -1;
      gorToldChimney = false;
      if (gorDustData) for (let i = 0; i < gorDUST_N; i++) gorDustData[i * 4 + 2] = -1;
      if (gorPigeonData) {
        for (let i = 0; i < gorPIGEON_N; i++) {
          const o = i * 10;
          gorPigeonData[o] = gorPigeonData[o + 7];
          gorPigeonData[o + 1] = gorPigeonData[o + 8];
          gorPigeonData[o + 2] = gorPigeonData[o + 9];
          gorPigeonData[o + 3] = 0; gorPigeonData[o + 4] = 0; gorPigeonData[o + 5] = 0;
        }
      }
      if (gorDecorData) for (let i = 0; i < gorDECOR_N; i++) gorDecorData[i * 5 + 2] = 0;
    },
    onExit() {
      // ARMED FLAGS DO NOT SURVIVE TRAVEL. Every biome shares one coordinate
      // space, and a latch left set is a task that ticks in the wrong country.
      gorEnvOn = -1; gorMouthT = 0;
      // Anything stateful that could hold the player, cleared on the way out.
      gorAboard = false; gorAboardT = 0; gorEmptyT = 0; gorCarrying = false;
    },
  });

  const api = {
    built() { return gorBuilt; },
    terrainHeight: gorTerrain,
    slopeAt: gorSlope,
    waterLevel: -400,                       // there is no water in Cappadocia
    isOverWater: gorIsOverWater,
    waterHeightAt() { return -400; },
    inZone: gorInZone,
    navBlocked: gorNavBlocked,
    surfacePitch: gorSurfacePitch,
    SPAWN: gorSPAWN,

    /** The SECOND chapter to publish it. A verb that comes back is vocabulary. */
    climbHold: gorClimbHold,
    // A hop between two chimneys wants steering, and a hop out of a basket at
    // sixty metres wants rather a lot of it.
    airControl: 0.52,

    /**
     * THE WIND MAP. Deliberately NOT called `wind` — that key belongs to the
     * Drift and capybara.js applies it to the ANIMAL whenever it is airborne,
     * which here would blow every hop across the valley sideways with a wind
     * that is meant for two thousand cubic metres of hot air.
     */
    windAt(y, x, z) { return gorWindAt(y, x, z); },
    layers: gorLAYERS,
    layerOf: gorLayerOf,

    /** 0..1 — the disc over the ridge. systems.js reads it for the light. */
    sunUp() { return gorSun; },
    dawn() { return gorDawnLit; },
    seenSun() { return gorSeenSun; },
    flown() { return gorFlown; },
    aboard() { return gorAboard; },
    burner() { return gorBalBurn; },
    /** How high the basket is over the ground it is over, right now. */
    altitude() { return gorBalY - gorTerrain(gorBalX, gorBalZ); },

    /**
     * THE LENS, WHILE FLYING, AND IT HAS EXACTLY ONE THING TO AVOID.
     *
     * The envelope is two thousand cubic metres of nylon sitting DIRECTLY OVER
     * the basket — six metres of radius centred ten and a half metres up. The
     * standing rig (41 degrees, 9.5 m) puts the eye six metres above the animal
     * and eight behind, which is inside it: measured, the entire flight was
     * filmed from within the balloon, and the capybara was never once in frame.
     *
     * Eighteen metres back at 0.30 rad puts the eye five metres over the basket
     * and eighteen behind — under the envelope's skirt, looking down past it at
     * the valley, with the whole rig in silhouette. Which is the shot every
     * photograph ever taken of this place is.
     */
    rig() {
      if (!gorAboard) return { w: 0 };
      // 0.62 rad, NOT 0.42. At the shallower angle the ground was the bottom
      // fifteen per cent of the frame and the other eighty-five was an empty
      // sky — which is a picture of a balloon rather than a picture of BEING in
      // one. What you are up here to look at is underneath you.
      return { w: 1, dist: 15, pitch: 0.62, raise: 0.45, lambda: 1.5 };
    },

    /**
     * THE FRAME THE ANIMAL IS STANDING IN. capybara.js asks; see capyCarryAt.
     * Null everywhere except inside the basket, which is the only moving floor
     * in this chapter and the only one in the game that had to declare itself.
     */
    carryFrame() { return gorCarrying ? gorCarry : null; },

    // landmarks
    town: { x: gorPLAZA.x, z: gorPLAZA.z + 10 },
    plaza: { x: gorPLAZA.x, z: gorPLAZA.z },
    field: { x: gorFIELD.x, z: gorFIELD.z },
    /**
     * THE TWO CREWS THE LIST NOW POINTS AT, and they have to be published
     * rather than guessed: every crew angle comes out of a seeded rnd() inside
     * gorBuildField, so 'the flat one' and 'the one with the fan on' cannot be
     * located from outside the build. A beacon on the middle of the field is a
     * beacon on five crews at once, which is not a pointer, it is a shrug.
     */
    envelope() {
      for (let i = 0; i < gorCrews.length; i++) {
        if (gorCrews[i].state === 0) { gorV3c.set(gorCrews[i].x, gorCrews[i].gy, gorCrews[i].z); return gorV3c; }
      }
      return gorFIELD;
    },
    mouth() {
      for (let i = 0; i < gorCrews.length; i++) {
        const c = gorCrews[i];
        if (c.state !== 1) continue;
        gorV3b.set(c.x - Math.sin(c.ry) * 5.0, c.gy, c.z - Math.cos(c.ry) * 5.0);
        return gorV3b;
      }
      return gorFIELD;
    },
    valley: { x: 0, z: -40 },
    cliff: { x: gorCLIFF.x + 12, z: (gorCLIFF.z0 + gorCLIFF.z1) * 0.5 },
    tether: { x: -17, z: -10.4 },
    landing: { x: gorLAND.x, z: gorLAND.z },
    /** The tallest of the six, and the one the beacon should point at. */
    chimney: { x: 20, z: -60 },
    /** Both of these MOVE. Ask; never cache. */
    // the herd. It MOVES — ask, never cache.
    mare() { return gorHerdPos; },
    mareRunning() { return gorHerdWait <= 0; },
    onMare() { return !!(gorGame && gorGame.capy && gorOnMare(gorGame.capy.position)); },
    balloon() { gorV3b.set(gorBalX, gorBalY, gorBalZ); return gorV3b; },
    truck() { gorV3b.set(gorTruckX, gorTerrain(gorTruckX, gorTruckZ), gorTruckZ); return gorV3b; },

    update(dt) {
      if (!gorBuilt) return;
      if (!game.biome.isActive('goreme')) return;
      gorTime += dt;

      gorUpdateClock(game, dt);
      gorUpdateSky();
      gorUpdateBalloon(game, dt);
      gorUpdateTruck(dt);
      gorCheckField(game, dt);
      gorUpdateWheek(game, dt);
      gorUpdateHerd(game, dt);
      gorUpdateDecor(dt);
      gorUpdateShadows();
      gorUpdateFieldBurners();
      gorUpdateWisps(dt);
      gorUpdatePigeons(dt);
      gorUpdateGroundSound(game, dt);
      gorUpdateTasks(game, dt);
    },
  };
  game.goreme = api;
  return api;
}

function gorBuild(game) {
  if (gorBuilt) return;
  gorBuilt = true;
  gorInitGeos();

  gorRoot = new THREE.Group();
  gorRoot.name = 'goreme';
  game.scene.add(gorRoot);

  // ---- the ground ---------------------------------------------------------
  {
    const g = new THREE.PlaneGeometry(320, 320, 100, 100);
    g.rotateX(-Math.PI / 2);
    g.translate(20, 0, -30);
    const p = g.attributes.position.array;
    // ...and it is pulled toward the middle, where the valley is. See gorWarp.
    for (let i = 0; i < p.length; i += 3) {
      p[i] = gorWarp(p[i] - 20, 160) + 20;
      p[i + 2] = gorWarp(p[i + 2] + 30, 160) - 30;
    }
    const col = new Float32Array(p.length);
    const dust = new THREE.Color(PALETTE.gorSoil);
    const pale = new THREE.Color(PALETTE.gorTuffPale);
    const scrub = new THREE.Color(PALETTE.gorScrub);
    const shade = new THREE.Color(PALETTE.gorTuffShadow);
    const rose = new THREE.Color(PALETTE.gorTuffRose);
    for (let i = 0; i < p.length; i += 3) {
      const h = gorTerrain(p[i], p[i + 2]);
      p[i + 1] = h;
      // THREE FREQUENCIES, NOT ONE. A single sine times a single sine over a
      // three-hundred-metre plane is one smooth blob per fifty metres, which at
      // ground level is indistinguishable from a flat colour — and a flat
      // colour is exactly what three separate frames of this valley showed.
      const n = (Math.sin(p[i] * 0.13) * Math.sin(p[i + 2] * 0.11) +
                 Math.sin(p[i] * 0.41 + 1.7) * Math.sin(p[i + 2] * 0.37) * 0.6 +
                 Math.sin(p[i] * 1.13) * Math.sin(p[i + 2] * 0.97) * 0.25 + 1.85) * 0.27;
      gorCol.copy(dust).lerp(pale, n * 0.80);
      // the vineyard belt is the only green ground in the chapter and it should
      // read as a belt from the air, which is where it will mostly be seen from
      if (p[i + 2] > -12 && p[i + 2] < 24) gorCol.lerp(scrub, 0.34 + n * 0.22);
      // and the shadowed side of every fold goes blue, for the same reason the
      // palette's shadow tone does
      if (n < 0.34) gorCol.lerp(shade, (0.34 - n) * 0.55);
      // ---- THE WASH CHANNELS, AND THEY ARE PAINTED -----------------------
      // Cappadocia is eroded by water that is not there for three hundred days
      // a year, and what it leaves behind is braided pale gravel running
      // downhill with patches of bare tuff between. Both are things with no
      // edge, so both are painted rather than drawn. A RIDGED noise through a
      // narrow threshold gives a network of thin LINES rather than a field of
      // blobs, which is what a braided channel is and what an ordinary noise
      // cannot be; the bare patches are a plain product of two sines, because
      // a bare patch is a blob and is allowed to be.
      {
        const rg = 1 - Math.abs(Math.sin(p[i] * 0.052 + p[i + 2] * 0.021 +
                                         Math.sin(p[i + 2] * 0.037) * 1.4));
        const wash = clamp((rg - 0.86) / 0.14, 0, 1);
        if (wash > 0) gorCol.lerp(pale, wash * 0.55);
        const bare = clamp((Math.sin(p[i] * 0.083 + 2.1) *
                            Math.sin(p[i + 2] * 0.071 - 0.6) - 0.52) / 0.48, 0, 1);
        if (bare > 0) gorCol.lerp(rose, bare * 0.42);
      }
      col[i] = gorCol.r; col[i + 1] = gorCol.g; col[i + 2] = gorCol.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    const gm = new THREE.Mesh(g, gorVC());
    gm.receiveShadow = true;
    gm.frustumCulled = false;
    gorRoot.add(gm);
  }

  // ---- the collision floor -------------------------------------------------
  // MIND WHICH WAY THE SECOND AXIS RUNS. A CANNON heightfield is authored in
  // its own xy plane and the Rx(-90) that stands it up maps local +y onto world
  // MINUS z — so j has to walk BACK from the far edge. Get it wrong and the
  // biome has no collision floor at all, which capybara.js's analytic backstop
  // will hide from you completely until something dynamic falls through it.
  {
    const X0 = -160, EL = 5;
    const NX = 68, NZ = 66;
    const Z0 = -200, Z1 = Z0 + NZ * EL;
    const data = [];
    for (let i = 0; i <= NX; i++) {
      const row = [];
      for (let j = 0; j <= NZ; j++) row.push(gorTerrain(X0 + i * EL, Z1 - j * EL));
      data.push(row);
    }
    const hf = new CANNON.Heightfield(data, { elementSize: EL });
    const b = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
    b.addShape(hf);
    b.position.set(X0, 0, Z1);
    b.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    gorSyncBody(b);
    game.world.addBody(b);
  }

  // ---- the east ridge, which the sun comes over ----------------------------
  // Decorative, and deliberately so: it is a hundred and twenty metres away, it
  // is seventy metres high, and nothing in this chapter wants the player on top
  // of it. No collider, and therefore no forty-metre ramp for the analytic
  // ground backstop to levitate anybody up.
  //
  // IT IS ALSO THE THING THE MARQUEE HAPPENS OVER, AND IT WAS TWENTY-TWO BLUE
  // SLABS. Measured off the rendered dawn frame: a row of flat-topped
  // rectangular blocks in gorTuffShadow — which is a purple-grey — standing
  // against an orange sky, i.e. a skyline of office towers, and it is the one
  // silhouette in this chapter the player is explicitly asked to WATCH. Three
  // things fix it and none of them costs what a single fairy chimney costs:
  //
  //   A CREST IS A FUNCTION. Three incommensurable periods, so the skyline has
  //   spurs and saddles in it and never repeats down its length; drawn as
  //   seven-sided tapers rather than boxes, so the top is a ridge rather than a
  //   row of tabletops.
  //
  //   DISTANCE IS COLOUR. A second range behind it, higher and much paler.
  //   Aerial perspective is the only depth cue a flat-shaded world has, and two
  //   ranges at two values read as forty kilometres of Anatolia.
  //
  //   AND THE RIM LIGHTS FIRST. The sun is BEHIND this thing — it is at x = 760
  //   and the ridge is at 118 — so for the whole minute before the disc clears
  //   it, the crest line itself is the brightest object in the world. One thin
  //   emissive band along the crest, driven by gorSun, and the moment this
  //   chapter is named after starts a minute earlier than it used to.
  {
    let seed = 606;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const crest = (z) => 58 + Math.sin(z * 0.021 + 0.6) * 15 + Math.sin(z * 0.0093 - 1.4) * 11 +
                         Math.sin(z * 0.058) * 4.5;
    const cHaze = new THREE.Color(PALETTE.gorSkyHigh);
    const cShad = new THREE.Color(PALETTE.gorTuffShadow);
    const cDark = new THREE.Color(PALETTE.gorBasaltDk);

    // ---- the far range ----------------------------------------------------
    const F = gorMerger();
    for (let z = -190; z < 150; z += 17) {
      const h = crest(z * 0.8 + 40) * 1.28 + rnd() * 8;
      F.taper(gorRIDGE_X + 96 + rnd() * 18, h * 0.42, z + rnd() * 6,
              34 + rnd() * 12, 9 + rnd() * 8, h, PALETTE.gorSkyHigh, rnd() * 3);
    }
    {
      const far = new THREE.Mesh(F.build(), gorVC());
      far.name = 'gorFarRange';
      far.castShadow = false; far.receiveShadow = false;
      far.userData.noShadow = true;
      const pos = far.geometry.attributes.position.array;
      const c = far.geometry.attributes.color.array;
      for (let i = 0; i < c.length; i += 3) {
        // the tops go bluer than the feet, which is haze doing what haze does
        gorCol.copy(cShad).lerp(cHaze, clamp(0.34 + pos[i + 1] / 130, 0, 1));
        c[i] = gorCol.r; c[i + 1] = gorCol.g; c[i + 2] = gorCol.b;
      }
      far.geometry.attributes.color.needsUpdate = true;
      gorRoot.add(far);
    }

    // ---- the near range, and the crest points the rim is laid along --------
    // ...AND THE NEAR ONE IS SOLID.
    //
    // The old note here said the ridge is decorative and has no collider "and
    // therefore no forty-metre ramp for the analytic ground backstop to levitate
    // anybody up". The first half of that is a mistake and the second half is
    // the wrong worry. A solidity sweep at chest height puts 116 of Cappadocia's
    // 146 walk-through samples on this one object — by a distance the biggest
    // residue in the chapter — because gorTerrain climbs from x = 82 and a
    // player can simply keep walking east until they are inside a hundred and
    // twenty metres of drawn rock. And the backstop levitates you up RAMPS: a
    // vertical box face is a wall, which is exactly what the town's massif, the
    // dovecote cliff and Palawan's whole karst island already are.
    //
    // One compound body for the lot (see gorPoolBody), so the east edge of the
    // world is a thing you can lean on for one broadphase entry. The FAR range
    // is left alone — it is two hundred metres past this and nobody can reach it.
    const ridgeBody = gorPoolBody();
    const N = gorMerger();
    const rimPts = [];
    for (let z = -180; z < 140; z += 8) {
      const h = crest(z) + rnd() * 5;
      const x = gorRIDGE_X + rnd() * 9;
      N.taper(x, h * 0.44, z, 22 + rnd() * 9, 5 + rnd() * 6, h * 0.88,
              PALETTE.gorTuffShadow, rnd() * 3);
      // a shoulder in front of it, lower and warmer, which is the only thing
      // that gives a fully backlit range any modelling at all
      N.taper(x - 17 - rnd() * 6, h * 0.30, z + rnd() * 5,
              20 + rnd() * 8, 8 + rnd() * 5, h * 0.60, PALETTE.gorTuffDk, rnd() * 3);
      gorPoolBox(ridgeBody, x - 3, h * 0.44, z, 34, h, 9);
      gorPoolBox(ridgeBody, x - 20, h * 0.30, z, 26, h * 0.6, 9);
      // THE RIM RUNS ON ITS OWN LINE, NOT ON THE SPURS'.
      // Each spur is thrown up to nine metres east or west so the range has a
      // plan as well as a profile — but the light along the brink is ONE line,
      // and hanging it off nine metres of scatter with a 2.6 m bar left visible
      // GAPS between every pair of segments. A crest is continuous; the rim
      // follows a smooth centreline through the spurs and is wide enough to
      // meet itself at every joint.
      rimPts.push(gorRIDGE_X + 4.2 + Math.sin(z * 0.031) * 3.4, h * 0.88, z);
    }
    gorPoolDone(game, ridgeBody);
    {
      const near = new THREE.Mesh(N.build(), gorVC());
      near.name = 'gorRidge';
      near.castShadow = false; near.receiveShadow = false;
      // ...and it has to SAY SO. registerShadowTarget turns castShadow back on
      // four lines below, and three hundred metres of decorative skyline was
      // being rasterised into a 44-unit shadow box it is nowhere near.
      near.userData.noShadow = true;
      // black at the foot of the scarp, sky at the brink — backlit rock is
      // never one value, and one value is what it had
      const pos = near.geometry.attributes.position.array;
      const c = near.geometry.attributes.color.array;
      for (let i = 0; i < c.length; i += 3) {
        gorCol.copy(cDark).lerp(cShad, clamp(pos[i + 1] / 62, 0, 1));
        c[i] = gorCol.r; c[i + 1] = gorCol.g; c[i + 2] = gorCol.b;
      }
      near.geometry.attributes.color.needsUpdate = true;
      gorRoot.add(near);
    }

    // ---- THE RIM ----------------------------------------------------------
    // Its fog is off for the same reason the sun disc's is: a hundred and
    // twenty metres of this chapter's own haze would put the light out.
    const R = gorMerger();
    for (let i = 0; i + 5 < rimPts.length; i += 3) {
      const y0 = rimPts[i + 1], z0 = rimPts[i + 2];
      const x1 = rimPts[i + 3], y1 = rimPts[i + 4], z1 = rimPts[i + 5];
      const x0 = rimPts[i];
      const dz = z1 - z0, dy = y1 - y0;
      // THE ROTATION IS -atan2(dy, dz) AND IT IS NOT OBVIOUS. Rx(t) maps +z to
      // (0, -sin t, cos t), so to lay a z-aligned bar along (0, dy, dz) the
      // angle is MINUS the arctangent. Written the other way round and offset by
      // a right angle — which is what it was — every segment stands upright
      // instead of lying along the crest, and the "line of light" rendered as a
      // row of pale fence pickets marching over the ridge. Only a screenshot
      // finds this; it is the same class as Manly's rock pools standing on edge.
      R.box((x0 + x1) * 0.5, (y0 + y1) * 0.5 + 0.3, (z0 + z1) * 0.5,
            8.5, 0.7, Math.hypot(dz, dy) + 3.4, 0xffffff,
            -Math.atan2(dy, dz), 0, 0);
    }
    gorRimMat = gorGlowMat(PALETTE.gorSkyLow, 0.0);
    gorRimMat.fog = false;
    gorRimMat.transparent = true;
    gorRimMat.opacity = 0;
    gorRimMat.depthWrite = false;
    const rim = new THREE.Mesh(R.build(), gorRimMat);
    rim.name = 'gorRidgeRim';
    rim.frustumCulled = false;
    rim.renderOrder = -7;
    rim.userData.noShadow = true;
    gorRoot.add(rim);
  }

  gorBuildValley(game, gorRoot);
  gorBuildTown(game, gorRoot);
  gorBuildScatter(game, gorRoot);
  gorBuildCliff(game, gorRoot);
  gorBuildTether(game, gorRoot);
  gorBuildField(game, gorRoot);
  gorBuildTruck(gorRoot);
  gorBuildDust(gorRoot);
  gorBuildHerd(game, gorRoot);
  gorBuildBalloon(game, gorRoot);
  gorBuildDecor(gorRoot);
  gorBuildShadows(gorRoot);
  gorBuildWisps(gorRoot);
  gorBuildSky(gorRoot);

  // ---- THE PEOPLE WHO LIVE HERE ------------------------------------------
  // See npc.js, THE LOCALS. Each of these is a point somebody is standing at,
  // a few things they might say when the capybara turns up, and a different
  // few for when it wheeks at them. Where the chapter owns a Group for the
  // figure, it is handed over too and the figure turns to watch.
  if (typeof game.addLocal === 'function') {
    gorLocals.chief = game.addLocal({ biome: 'goreme', x: gorFIELD.x + 6, y: gorTerrain(gorFIELD.x + 6, gorFIELD.z),
      z: gorFIELD.z, near: 8,
      figure: { shirt: PALETTE.hiVis, legs: PALETTE.denim },
      lines: ['We do not steer. Nobody steers. We choose a height.',
              'Wind goes one way down low and the other way up high.',
              'In the basket, please. Both feet. All four feet.'],
      wheek: ['Careful — the burner is louder and it is right there.'] });
    gorLocals.town = game.addLocal({ biome: 'goreme', x: gorPLAZA.x + 5, y: gorPLAZA.y, z: gorPLAZA.z, near: 7,
      figure: { shirt: PALETTE.cloth5, skin: PALETTE.skin2 },
      lines: ['Whole town is cut into the rock. Warm in winter.',
              'Five in the morning and everyone is awake. Every day.',
              'Look up. Go on. Look up.'],
      wheek: ['The valley gives that back to you twice.'] });

    // ---- AND FIVE MORE. Two people in a town of twenty-two houses, a launch
    // field with five crews on it and four hundred pigeon holes is the
    // emptiest cast in the game after the Drift, and the Drift's emptiness is
    // the point of the Drift.
    // gorPLAZA.y is what the square is FLATTENED TOWARD, not what the ground
    // is at any given point in it: the flattening is a smoothstep with a
    // radius, so ten metres out from the middle it has only got two thirds of
    // the way there. Ask the function.
    gorLocals.tea = game.addLocal({ biome: 'goreme', x: gorPLAZA.x - 8.4,
      y: gorTerrain(gorPLAZA.x - 8.4, gorPLAZA.z + 6.2), z: gorPLAZA.z + 6.2,
      near: 7,
      figure: { shirt: PALETTE.gorEnvE, legs: PALETTE.gorTuffDk, skin: PALETTE.skin2 },
      lines: ['Sit. There is tea. There is always tea.',
              'We are here at five because they go up at five. Every day of my life.',
              'Two glasses. Then I go and look at the sky like everybody else.'],
      wheek: ['Ha! Listen — there. And again. Told you.'] });

    gorLocals.potter = game.addLocal({ biome: 'goreme', x: 19, y: gorTerrain(19, 40.4), z: 40.4, near: 7,
      figure: { shirt: PALETTE.gorPot, legs: PALETTE.gorBasaltDk, skin: PALETTE.skin2 },
      lines: ['Avanos clay. Red as the valley, because it IS the valley.',
              'Seventeen out of the kiln, fourteen came through. Good week.',
              'Do not lean on that one. It is Thursday’s.'],
      wheek: ['Nothing in this yard is dry yet. Please.'] });

    gorLocals.dove = game.addLocal({ biome: 'goreme', x: gorCLIFF.x + 13, y: gorTerrain(gorCLIFF.x + 13, -42),
      z: -42, near: 8,
      figure: { shirt: PALETTE.gorEnvF, legs: PALETTE.gorTuffDk },
      lines: ['My grandfather cut forty of those holes. On a rope. At night.',
              'The white patch is so the birds can find the door.',
              'Guano. That is what the vines are grown on. All of them.'],
      wheek: ['Well. There they all go.'] });

    gorLocals.crew = game.addLocal({ biome: 'goreme', x: gorFIELD.x - 12, y: gorTerrain(gorFIELD.x - 12, gorFIELD.z + 12),
      z: gorFIELD.z + 12, near: 7,
      figure: { shirt: PALETTE.gorEnvD, legs: PALETTE.denim, hat: PALETTE.hiVis },
      lines: ['Walk the length of it. Look for tears. Every single morning.',
              'Fan first, then the burner. Never the other way. Never.',
              'Fifteen metres of nylon and it holds up four people. Think about that.'],
      wheek: ['The fan is louder. You will not win.'] });

    gorLocals.horse = game.addLocal({ biome: 'goreme', x: gorHERD_X - 5.5, y: gorTerrain(gorHERD_X - 5.5, -70),
      z: -70, near: 8,
      figure: { shirt: PALETTE.gorCarpet, legs: PALETTE.gorBasaltDk, hat: PALETTE.gorTuffDk },
      lines: ['Katpatuka. The land of beautiful horses. That is the whole name.',
              'She wears the bell. The rest of them just follow the bell.',
              'Up the valley and back before the sun. They know it better than I do.'],
      wheek: ['She has heard worse. She has heard me.'] });
    // ---- AND THREE MORE, IN THE THREE PLACES THE CHAPTER GOES ------------
    // The seven above are all in the town or on the launch field, which is the
    // first ninety seconds. Everything after that — the valley, the dovecote
    // cliff and the landing plain — had nobody in it, and those are the parts
    // of the chapter you are IN a balloon for and cannot leave. A person on the
    // ground you are drifting over is worth more than a person you can walk up
    // to, because it is the only way of knowing how high you are.
    gorLocals.dovecote = game.addLocal({
      biome: 'goreme', x: gorCLIFF.x + 9, y: gorTerrain(gorCLIFF.x + 9, -30), z: -30, near: 9,
      figure: { shirt: PALETTE.gorPigeon, legs: PALETTE.gorTuffDk, hat: PALETTE.gorBasaltDk },
      lines: ['Four hundred holes. My grandfather cut about eighty of them.',
              'Nobody eats the birds. It was never about the birds.',
              'You want to know why the grapes grow in a valley made of ash? That is why.',
              'They go out at first light and they are all back by nine.'],
      wheek: ['Do that again and you will be picking them out of your teeth.',
              'Every single one of them looked at you. Did you see that?'] });
    gorLocals.vine = game.addLocal({
      biome: 'goreme', x: -26, y: gorTerrain(-26, -52), z: -52, near: 8,
      figure: { shirt: PALETTE.gorEnvB, legs: PALETTE.gorSoil },
      lines: ['Before the sun. Always before the sun. After that it is not work, it is suffering.',
              'No wires, no posts. They hold themselves up. They have had two thousand years of practice.',
              'The wall is not mine. The wall was here. I just put the stones back on it.',
              'You are standing on a vine. You are standing on a hundred-year-old vine.'],
      wheek: ['Yes, yes. Very good. Now move.',
              'The dogs will start, and then the whole valley starts.'] });
    gorLocals.chase = game.addLocal({
      biome: 'goreme', x: gorLAND.x + 11, y: gorTerrain(gorLAND.x + 11, gorLAND.z + 8),
      z: gorLAND.z + 8, near: 9,
      figure: { shirt: PALETTE.gorTruck, legs: PALETTE.gorBasaltDk },
      lines: ['We do not catch them. We just get there first and hold the basket.',
              'My father drives. I open the gates. There are a lot of gates.',
              'Whichever way the wind is at four hundred feet — that is where I am going.',
              'If you come down out here, do not get out. Wait. Everybody gets out too early.'],
      wheek: ['I heard that from the road.',
              'Save it for when you are up there. It goes a very long way from up there.'] });
  }

  if (typeof game.registerShadowTarget === 'function') game.registerShadowTarget(gorRoot);
  // ...AND THEN TAKE IT BACK OFF THE THINGS THAT ARE NOT THERE.
  gorNoShadowOnGhosts(gorRoot);
}
