import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PALETTE, mat, matEmit, emitSet, rand, randInt, clamp, damp, dampAngle, lerp, grain, grainOwn, swayMesh, makeMerger, warnOnce } from './shared.js';

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
// ---- JOINING THE BURN (D4.3) ---------------------------------------------
// The marquee of this chapter was a stat-check on a clock: be above 55 m in
// an eleven-second window and it pays, whatever you are doing. The one lever
// the chapter gives you -- the burner -- was not part of its own big moment.
// And the valley IS burning at that moment: gorSyncBurn ramps every one of
// the twenty-six envelopes over the twelve seconds before the sun, which is
// the thing everybody who has been there describes.
//
// So the row asks you to be in it. NOT on the frame the sun crosses -- this
// file has already been bitten once by a single-frame gate (see the note on
// the 0.12 payout) -- but at ANY point in the window, which is a thing you
// do rather than a thing you hit.
let gorSunBurned = false;    // has the burner been lit inside the window
let gorSunNagged = false;    // ...and has the chief said so, once
let gorSunDoves = false;     // the flock round the basket, once per sunrise
let gorAboard = false, gorAboardT = 0, gorFlown = false;
let gorBoardTold = false;
let gorCarry = { x: 0, z: 0 };
let gorCarrying = false;
let gorGroundedT = 0, gorEmptyT = 0;
let gorLayerSeen = 0;                // bitmask of layers visited above the calm
let gorHighest = 0;
// The peak of the flight that is happening RIGHT NOW, banked rather than
// reported — see the note at the record call in gorUpdateBalloon.
let gorPeakAlt = 0;
// the ceiling, which used to be a control that silently stopped working
let gorCeilT = 0, gorToldCeil = false;
let gorTetherGroup = null, gorTetherCut = false, gorTetherY = 0;
// ...and once it is over the ridge it stops being the chapter's problem
let gorTetherGone = false;
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
// THE TRAILER IS A FLOOR NOW. See gorUpdateTruck and gorTrailerRide.
let gorTrailerBody = null;             // kinematic, the bed you stand on
let gorTrailerPX = 0, gorTrailerPZ = 0;   // last frame's bed centre, for the velocity
let gorTrailerCarry = { x: 0, z: 0 };
let gorTrailerCarrying = false;
let gorRideHome = false;               // the crew are driving you back to the square
let gorRideT = 0, gorRideDone = false;
// where the chase crew THINK the balloon is going. See gorUpdateTruck.
let gorChaseX = 20, gorChaseZ = 10;
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
  const M = makeMerger(gorG, {
    xform: gorXform, cylSegs: [4, 8], coneSegs: [8], sphSegs: [8], normals: 'recompute', jitter: 0.060,
  });
  /** A flat horizontal facet. See gorG.quad — two triangles, not twelve. */
  M.quad = function (cx, cy, cz, sx, sz, color, ry) {
    return M.add(gorG.quad, gorXform(cx, cy, cz, 0, ry || 0, 0, sx, 1, sz), color);
  };
  /** A fairy chimney is a CONE WITH THE TOP CUT OFF and a rock balanced on it;
   *  the cut-off cone is not in the geometry set, so it is a lathe of exactly
   *  two rings and it costs eight triangles. Built per call and disposed, which
   *  is why it cannot live in a shared geometry cache. */
  M.taper = function (cx, cy, cz, rb, rt, h, color, ry) {
    const g = new THREE.CylinderGeometry(rt, rb, h, 7);
    const r = M.add(g, gorXform(cx, cy, cz, 0, ry || 0, 0, 1, 1, 1), color);
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
function gorVC() {
  return grain(mat(0xffffff, { vertexColors: true }),
               { scale: 0.42, amount: 0.09, warp: 0.55, near: 0.38, nearScale: 6, contact: 1, broad: 0.1, broadM: 18 });
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
  return matEmit(color, intensity || 1).clone();
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

// ---- C1: THE ONE THAT GOES -----------------------------------------------
//
// gorFIELD_GO is a phase, not a time: everything in this chapter hangs off
// gorPhase and a launch on a stopwatch of its own would drift out of the dawn
// within two cycles. It sits 0.045 past gorLAUNCH_P — the decor wave starts
// at gorLAUNCH_P with up to 0.11 of stagger, so the near one goes INSIDE that
// wave rather than before or after it, which is the difference between "the
// field is launching" and "one balloon left".
//
// 0.045 * 156 s is about seven seconds after the wave starts, which from the
// arrival square at z 34 is roughly the time it takes to walk to the field.
const gorFIELD_GO   = gorLAUNCH_P + 0.045;
const gorFIELD_RATE = 3.4;        // the exponential's rate — see the decor curve
const gorFIELD_CEIL = 96;         // m above its own pad, where it joins the layer
let gorFieldLaunch = null;        // the live group, or null
let gorFieldLaunchBody = null;    // ...and its basket collider, which goes with it
let gorFieldLaunchGY = 0;
let gorFieldLaunchY = 0;          // metres above the pad
let gorFieldLaunchSaid = false;
// ...and where it started, so onEnter can put it back exactly there.
let gorFieldLaunchX0 = 0, gorFieldLaunchZ0 = 0;
let gorFieldLaunchPad = null;   // the basket collider's pad, for the re-add

/**
 * The one balloon on the field that is not merged, leaving.
 *
 * The curve is the decor balloons' own — `(1 - exp(-go * rate)) * ceiling` —
 * on purpose and not by accident: a near balloon that rises on a different law
 * from the twenty-six behind it reads as a different kind of object, and the
 * whole value of this item is that the thing twenty-five metres away is doing
 * what the things six hundred metres away are doing.
 *
 * THE COLLIDER IS THE HALF THAT IS EASY TO FORGET. The basket is a 1.1 m hop
 * and is deliberately solid so it can be got onto. Left where it was, it stays
 * a solid invisible box on the field for the rest of the chapter — the exact
 * class of fault the walk-through-buildings audit was written for — so it goes
 * up with the group and is taken out of the world once it is over head height.
 */
function gorUpdateFieldLaunch(game, dt) {
  if (!gorFieldLaunch) return;
  const go = clamp((gorPhase - gorFIELD_GO) / 0.30, 0, 1);
  const target = go <= 0 ? 0 : (1 - Math.exp(-go * gorFIELD_RATE)) * gorFIELD_CEIL;
  gorFieldLaunchY = damp(gorFieldLaunchY, target, 0.6, dt);
  gorFieldLaunch.position.y = gorFieldLaunchY;
  // it leans away as it takes up the wind, exactly as the player's does
  const w = gorWindAt(gorFieldLaunchGY + gorFieldLaunchY,
                      gorFieldLaunch.position.x, gorFieldLaunch.position.z);
  if (w) {
    gorFieldLaunch.rotation.z = clamp(-w.x * 0.012, -0.10, 0.10);
    gorFieldLaunch.rotation.x = clamp(w.z * 0.012, -0.10, 0.10);
    // ...and it DRIFTS. A balloon that goes straight up is a lift.
    gorFieldLaunch.position.x += w.x * dt * 0.55 * (gorFieldLaunchY > 0.4 ? 1 : 0);
    gorFieldLaunch.position.z += w.z * dt * 0.55 * (gorFieldLaunchY > 0.4 ? 1 : 0);
  }
  if (gorFieldLaunchBody) {
    if (gorFieldLaunchY > 2.4) {
      try { game.world.removeBody(gorFieldLaunchBody); } catch (e) { /* already gone */ }
      gorFieldLaunchBody = null;
    } else {
      gorFieldLaunchBody.position.y = gorFieldLaunchGY + 0.55 + gorFieldLaunchY;
      gorSyncBody(gorFieldLaunchBody);
    }
  }
  if (!gorFieldLaunchSaid && gorFieldLaunchY > 1.2) {
    gorFieldLaunchSaid = true;
    gorSfx('burner', { volume: 0.55, pitch: 0.78 });
    gorToast('that one is going. yours is the one that is still on the ground.');
  }
}

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
/**
 * GIVE A CUE A BEARING WITHOUT TOUCHING THE LEVEL THE CHAPTER ALREADY TUNED.
 *
 * Every gorHeard call site in this file already computes an (x, z) and a
 * distance falloff — and then throws the position away and fires a MONO sound.
 * Twenty-four gorSfx calls in the chapter, `at:` on none of them, which is
 * exactly the "the loudest cue is the most likely to be mono" finding that has
 * now been true in every batch of this pass. In a chapter whose whole subject
 * is looking around, a burner roaring somewhere with no bearing is a wasted
 * channel: the wind is read by turning your head.
 *
 * gorHeard keeps owning the VOLUME — it has its own quadratic curve and every
 * call site is balanced against it, so letting systems.js attenuate as well
 * would halve everything twice. `near` is therefore set to gorHeard's own
 * `far`, which makes audioPlace's gain exactly 1.0 everywhere gorHeard is
 * audible at all, and leaves pan as the only thing it contributes. The outer
 * `far` clears sysSFX_FADE (45 m) so its taper never reaches back inside.
 */
function gorPlace(o, x, y, z, far) {
  o.at = { x: x, y: y, z: z };
  o.near = far;
  o.far = far + 46;
  return o;
}

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
  // RISE OVER RUN, not radians. See slopeAt in CONTRACT.md: this used to
  // return an angle, and twelve of the seventeen publishers return a gradient.
  return Math.sqrt(dx * dx + dz * dz) / (2 * e);
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
      // ...and the boulder that explains the other seventy-nine is a metre and
      // a half of basalt lying in the grass at exactly chest height, and it had
      // nothing behind it. It goes in the valley's own pooled body.
      gorPoolBox(pool(bz), bx, gorTerrain(bx, bz) + cr * 0.42, bz,
                 cr * 1.7, cr * 1.24, cr * 1.7);
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
        gorPoolBox(pool(sz2), sx2, sg + sh * 0.5, sz2, srb * 1.86, sh, srb * 1.86);
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
      // ONE BOX, WIDENED TO THE CONE. It was 1.55 rb across, i.e. 0.775 rb
      // from the centre at the cardinals against a drawn cone of rb, so a fifth
      // of every chimney's waist was rock with nothing behind it.
      //
      // A SECOND BOX AT 45 DEGREES DOES NOT HELP AND THAT WAS TRIED FIRST.
      // cannon UNIONS the shapes on a body, so two rotated squares reach just
      // as far as one — 1.31 rb on the diagonal — and merely fill in more of
      // the annulus between. Measured, it took Goreme from 19.75 to 20.72 per
      // cent occupied and moved no hit. An inscribed octagon needs an
      // INTERSECTION, which a rigid body cannot express; the honest shape here
      // is CANNON.Cylinder and it is logged rather than swapped in blind.
      gorStaticBox(game, cx, g + h * 0.5, cz, rb * 1.86, h, rb * 1.86);
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
      gorPoolBox(pool(cz), cx, g + h * 0.5, cz, rb * 1.86, h, rb * 1.86);
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
  // ---- WHAT IN THE VALLEY IS ALIVE (v44) ---------------------------------
  // See THE WAKE in shared.js. The batch names carry the species already
  // (`gorScat:vine:c6`), so this is a lookup and not a second table of
  // coordinates. Tuff, rubble and the pigeons are not plants; the vine, its
  // stem and the scrub are, and they are the things at capybara height in a
  // valley whose whole picture is wind over stone.
  const kind = im.name.split(':')[1];
  const a = kind === 'vine' ? [0.070, 2.0, 1.10]
          : kind === 'vineStem' ? [0.045, 2.6, 1.10]
          : kind === 'scrub' ? [0.060, 2.2, 1.25] : null;
  if (a) swayMesh(im, { leaf: 0.45, amount: a[0], axis: 'y', auto: true, stiff: a[1], hz: a[2] });
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
            // ...AND A WALL IS A WALL (V1). A metre high, half a metre through,
            // and walked through along its whole length: it was drawn only. One
            // shape a segment on the scatter's pool body, turned with the row.
            SB.addShape(new CANNON.Box(new CANNON.Vec3(0.27, 0.50, 0.75)),
                        new CANNON.Vec3(x, y + 0.50, z),
                        new CANNON.Quaternion().setFromEuler(0, yaw, 0));
            solid = true;
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

/**
 * THE CATS, AND THEY ARE THE ONLY THING ALIVE IN THAT SQUARE AT FIVE.
 *
 * The town has twenty-two rock-cut houses, a tea house with four stools, a
 * carpet rack, a festoon of bulbs and three people — and between the hours the
 * chapter is set in, nothing in it moves. Which is wrong about that place
 * specifically: a Turkish town square before dawn is where every cat in the
 * town is, sitting on the warm stone with its feet under it waiting for the
 * baker.
 *
 * Nine of them, one instanced mesh, and they keep the three ambient-mover
 * rules this codebase has paid for:
 *
 *   THEY ARE NOT A METRONOME. Each one has its own clock, redrawn from a range
 *   every time it fires, and three states — sitting with its feet tucked in,
 *   lying on its side, and walking three metres to somewhere better.
 *
 *   THEY YIELD. A cat does not let a rodent the size of a spaniel walk into it:
 *   inside two and a half metres it gets up and goes, which is both the correct
 *   behaviour and the reason nine of them do not become a wall.
 *
 *   AND THEY ANSWER. Every one of them within earshot turns its head on the
 *   wheek, which costs one number and is the single cheapest laugh available:
 *   nine cats, simultaneously, deciding it was not worth getting up for.
 */
const gorCAT_N = 9;
// How close a capybara may get before a cat leaves — the number the chapter
// has always used, now the BASE of one, because a settled animal is allowed
// nearer. Nine cats declining to get up for you is the joke; nine cats letting
// you sit down among them is the joke's second half.
const gorCAT_NEAR = 2.5;
const gorCAT_APPR_STOP = 1.5;   // m from a sat-down capybara a cat settles for
const gorCAT_APPR_SEE  = 16;    // m — past this it has not noticed you at all
let gorCatCrit = null;
let gorCatMesh = null;
// said once, the first time the whole square declines to be impressed
let gorToldCats = false;
const gorCats = [];
const gorCAT_COL = [0xc8b49a, 0x4a4038, 0xd8d2c6, 0x8a6a4a, 0x2f2a26];
function gorBuildCats(root) {
  // one cat, at the origin, facing +z, about 45 cm nose to tail
  const C = gorMerger();
  C.box(0, 0.17, 0, 0.16, 0.15, 0.42, 0xffffff);                 // body
  C.sph(0, 0.27, 0.24, 0.10, 0.095, 0.09, 0xffffff, 6);          // head
  C.box(-0.055, 0.35, 0.24, 0.05, 0.07, 0.02, 0xffffff);         // ears
  C.box(0.055, 0.35, 0.24, 0.05, 0.07, 0.02, 0xffffff);
  C.cyl(0, 0.20, -0.24, 0.030, 0.34, 0xffffff, 0.9, 0, 0, 4);    // tail, up
  for (let s = 0; s < 4; s++) {                                   // four feet
    C.box((s & 1 ? 0.06 : -0.06), 0.05, (s & 2 ? 0.15 : -0.13), 0.05, 0.10, 0.05, 0xffffff);
  }
  const geo = C.build();
  const m = new THREE.InstancedMesh(geo, gorVC(), gorCAT_N);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.castShadow = true;
  m.receiveShadow = true;
  m.frustumCulled = false;
  m.name = 'gorCats';
  const P = gorPLAZA;
  gorCats.length = 0;
  for (let i = 0; i < gorCAT_N; i++) {
    // round the edge of the square, on the warm stone, and two by the tea house
    const a = i * 2.09 + 0.4, rr = i < 6 ? P.r * (0.55 + (i % 3) * 0.14) : 3.2;
    const cx = (i < 6 ? P.x : P.x - 8.4) + Math.cos(a) * rr;
    const cz = (i < 6 ? P.z : P.z + 6.2) + Math.sin(a) * rr;
    gorCats.push({ x: cx, z: cz, hx: cx, hz: cz, tx: cx, tz: cz,
                   yaw: a, look: 0, st: i % 3 === 2 ? 'flop' : 'sit',
                   perch: 0, py: 0,          // THE PERCH (N1) — see gorUpdateCats
                   t: rand(2, 16), sc: rand(0.86, 1.12), col: i % gorCAT_COL.length });
    gorCol.set(gorCAT_COL[i % gorCAT_COL.length]);
    m.setColorAt(i, gorCol);
  }
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
  root.add(m);
  gorCatMesh = m;
}
function gorUpdateCats(game, dt) {
  if (!gorCatMesh) return;
  const p = game.capy && game.capy.position;
  // ---- ...UNLESS YOU HAVE BEEN SITTING THERE A WHILE ----------------------
  // Registered here rather than at build time because a chapter is built on
  // first entry and systems.js is created at boot — but the ORDER of those two
  // is a coordinator detail and this is one null check a frame. See THE CALM.
  if (!gorCatCrit && typeof game.addCritter === 'function') {
    // bold 0.85: a town cat will absolutely come and sit next to something that
    // has stopped moving, and it is the funniest of the four. See THE LOAF.
    gorCatCrit = game.addCritter({ biome: 'goreme', r: gorCAT_NEAR, bold: 0.85 });
    // ---- ...AND THEY WILL FOLLOW YOU, EVENTUALLY (see THE HERD) -----------
    // obey 2, and a cat is the reason the tiers exist at all. It hears the
    // first wheek and it looks at you, and that is ALL it does — which is both
    // the truest thing about a cat and the clearest possible statement of the
    // rule: being heard and being obeyed are two different events, and you can
    // see the gap between them. Ask again inside the memory window and it
    // comes.
    //
    // `st` is forced off 'walk' when it joins, or gorUpdateCats' own state
    // machine keeps steering it away from the very animal it is following.
    if (typeof game.herdOffer === 'function') {
      game.herdOffer({
        biome: 'goreme', kind: 'cat', obey: 2, voice: 'pop', pitch: 1.25,
        count: function () { return gorCAT_N; },
        at: function (i, o) {
          const c = gorCats[i];
          if (!c) return;
          o.x = c.x; o.z = c.z; o.y = gorTerrain ? gorTerrain(c.x, c.z) : 0;
        },
        put: function (i, x, z, yaw) {
          const c = gorCats[i];
          if (!c) return;
          c.x = x; c.z = z; c.yaw = yaw;
          c.tx = x; c.tz = z;                 // ...and stop it walking off
          if (c.st === 'walk') { c.st = 'sit'; c.t = 3; }
        },
        // A CAT ASLEEP ON A CAPYBARA is the picture, and Göreme is the one
        // chapter in the game with cats in it. Two seats, because a cat is
        // most of the length of this animal's back and the pose it rides in
        // is the flop. See THE PERCH in systems.js.
        span: 2,
        lift: function (i, y) {
          const c = gorCats[i];
          if (!c) return;
          c.perch = 0.25;                     // re-asked every frame — see below
          c.py = y;
          c.st = 'flop'; c.t = 6;             // a cat that has got up there stays
        },
        // ---- ...AND ONE OF THEM MAY LEAVE THE VALLEY (N3) ----------------
        // See THE STOWAWAY in systems.js. One mesh off the instanced cat's own
        // geometry and material, shared and never cloned. It travels SITTING —
        // the flop is a cat that has decided to stay where it is, and a cat
        // being carried to Antarctica is a cat paying attention.
        stow: function (i) {
          if (!gorCatMesh) return null;
          const c = gorCats[i];
          const m = new THREE.Mesh(gorCatMesh.geometry, gorCatMesh.material);
          m.castShadow = true;
          m.scale.setScalar(c ? c.sc : 1);
          return m;
        },
      });
    }
  }
  const catNear = gorCatCrit ? gorCatCrit.near : gorCAT_NEAR;
  const catAppr = gorCatCrit ? (gorCatCrit.appr || 0) : 0;
  for (let i = 0; i < gorCAT_N; i++) {
    const c = gorCats[i];
    // ---- ...UNLESS IT IS ON THE CAPYBARA (N1) ---------------------------
    // Everything below assumes a cat on the paving: it flees a capybara at two
    // and a half metres, it walks to a target, and it is drawn at the height of
    // the terrain under it. A passenger is none of those. `c.perch` is re-asked
    // every frame by `lift` on the herd offer, so a cat cannot be left stranded
    // in the air by a system that stopped writing. See THE PERCH in systems.js.
    if (c.perch > 0) {
      c.perch = Math.max(0, c.perch - dt);
      if (c.look > 0) c.look -= dt;
      const br = Math.sin(gorTime * 1.6 + i * 2.1) * 0.006;
      gorM.compose(gorV3.set(c.x, c.py + br, c.z),
                   gorQ.setFromEuler(gorEu.set(0, c.yaw, 1.35, 'YXZ')),
                   gorSc.set(c.sc, c.sc * 0.90, c.sc));
      gorCatMesh.setMatrixAt(i, gorM);
      continue;
    }
    // ---- a capybara at two and a half metres is a reason to be elsewhere ---
    if (p) {
      const dx = c.x - p.x, dz = c.z - p.z;
      if (dx * dx + dz * dz < catNear * catNear && c.st !== 'walk') {
        c.st = 'walk'; c.t = rand(1.6, 3.0);
        const away = Math.atan2(dx, dz);
        c.tx = clamp(c.x + Math.sin(away) * rand(3, 5.5), gorPLAZA.x - 13, gorPLAZA.x + 13);
        c.tz = clamp(c.z + Math.cos(away) * rand(3, 5.5), gorPLAZA.z - 13, gorPLAZA.z + 13);
      }
      // ---- ...AND ONE THAT HAS SAT DOWN IS SOMETHING TO SIT NEXT TO ------
      // THE REGISTRY INVERTS (see THE LOAF in systems.js): `near` is already
      // at nothing, so the branch above cannot fire, and `appr` is how much of
      // the cat's mind is made up. It re-aims its NEXT walk rather than being
      // dragged — a cat is never seen to decide, only to have arrived — and
      // once it is close enough it flops, which is the whole joke.
      if (catAppr > 0.5 && c.st === 'walk') {
        const d = Math.hypot(dx, dz);
        if (d > gorCAT_APPR_STOP && d < gorCAT_APPR_SEE) {
          c.tx = clamp(p.x + dx / d * gorCAT_APPR_STOP, gorPLAZA.x - 13, gorPLAZA.x + 13);
          c.tz = clamp(p.z + dz / d * gorCAT_APPR_STOP, gorPLAZA.z - 13, gorPLAZA.z + 13);
        } else if (d <= gorCAT_APPR_STOP) { c.st = 'flop'; c.t = rand(10, 24); }
      }
    }
    c.t -= dt;
    if (c.t <= 0) {
      if (c.st === 'walk') { c.st = Math.random() < 0.35 ? 'flop' : 'sit'; c.t = rand(8, 26); }
      else if (Math.random() < 0.45) {
        c.st = 'walk'; c.t = rand(1.4, 3.2);
        // never far, and never off the paving: a town cat has a spot
        c.tx = clamp(c.hx + rand(-4.5, 4.5), gorPLAZA.x - 13, gorPLAZA.x + 13);
        c.tz = clamp(c.hz + rand(-4.5, 4.5), gorPLAZA.z - 13, gorPLAZA.z + 13);
      } else { c.st = c.st === 'sit' ? 'flop' : 'sit'; c.t = rand(9, 24); }
    }
    if (c.st === 'walk') {
      const dx = c.tx - c.x, dz = c.tz - c.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.12) {
        const k = Math.min(1, (1.35 * dt) / d);
        c.x += dx * k; c.z += dz * k;
        c.yaw = dampAngle(c.yaw, Math.atan2(dx, dz), 7, dt);
      } else if (c.t > 0.4) c.t = 0.4;
    }
    if (c.look > 0) c.look -= dt;
    const y = gorTerrain(c.x, c.z);
    // sitting is tall and still; flopped is low, long and breathing; walking
    // has the shoulders going
    const flop = c.st === 'flop' ? 1 : 0;
    const walk = c.st === 'walk' ? 1 : 0;
    const breathe = Math.sin(gorTime * 1.6 + i * 2.1) * 0.006;
    const step = walk * Math.sin(gorTime * 9 + i) * 0.022;
    // the head turn on a wheek is a ROLL of the whole cat, because a cat that
    // cannot be bothered to stand up turns from the shoulder
    const turn = c.look > 0 && p ? Math.atan2(p.x - c.x, p.z - c.z) : c.yaw;
    const yaw = c.look > 0 ? damp(c.yaw, turn, 6, dt) : c.yaw;
    if (c.look > 0) c.yaw = yaw;
    gorM.compose(gorV3.set(c.x, y + 0.02 - flop * 0.055 + breathe + step, c.z),
                 gorQ.setFromEuler(gorEu.set(0, yaw, flop * 1.35, 'YXZ')),
                 gorSc.set(c.sc, c.sc * (1 - flop * 0.10), c.sc));
    gorCatMesh.setMatrixAt(i, gorM);
  }
  gorCatMesh.instanceMatrix.needsUpdate = true;
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
    // 0.62, NOT 1.05. A metre-square stone is a SLAB, and five hundred slabs
    // photographed off the square is a floor of overlapping playing cards with
    // three tones of high-contrast paper in it. Cappadocian squares are laid in
    // basalt setts about a foot across; at 0.62 the same jittered grid gives
    // fourteen hundred of them — 2,800 triangles against 1,000 — and the eye
    // stops resolving individual stones and starts reading a surface, which is
    // the entire point of paving something.
    const CS = 0.62;
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
    // simply where everybody walks: from the road on the east to the tea house.
    //
    // AND IT WAS A PAINTED STRIPE. Twenty-two 2.6 x 2.2 m quads of gorSoil at
    // y + 0.055 laid nose to tail is a two-and-a-half-metre band of solid
    // brown ruled diagonally across the paving — measured off the square, the
    // single most conspicuous thing in the frame, and what it is supposed to
    // be is the stones being SMOOTHER where the feet go. A worn line has no
    // edges: sixty small patches on a wandering centreline, thinning to
    // nothing at both ends and mostly the colour of the paving it is polishing.
    for (let i = 0; i < 60; i++) {
      const t = i / 59;
      // fat in the middle of the crossing, gone at both ends
      const w = Math.sin(t * Math.PI);
      const hh = Math.sin(i * 91.7) * 0.5 + 0.5;
      const cx = lerp(P.x + 11, P.x - 6.5, t) + (hh - 0.5) * 1.5 * w;
      const cz = lerp(P.z - 4.5, P.z + 6.2, t) + Math.sin(t * 4.1) * 0.7 +
                 (Math.sin(i * 47.3) * 0.5) * 1.4 * w;
      M.quad(cx, P.y + 0.052, cz, 0.85 + hh * 0.7, 0.75 + hh * 0.6,
             hh < 0.62 ? PALETTE.gorRoad : PALETTE.gorSoil, Math.sin(t * 3 + i) * 0.6);
    }
    // ---- AND THE THINGS THAT ARE SIMPLY THERE ---------------------------
    // A Cappadocian square at ten past five has a çeşme running (they all do,
    // and they never turn them off), a stack of the potter's seconds against
    // the wall, and cats. The cats are the point: this is the emptiest hour in
    // the chapter and the square had nothing alive in it between the tea house
    // and the road.
    {
      // the çeşme — a stone trough on the north side with a spout and a wet
      // patch under it, which is the only water in the whole chapter
      const fx = P.x - 2.4, fz = P.z + 10.2, fy = gorTerrain(fx, fz);
      M.box(fx, fy + 0.55, fz, 2.2, 1.10, 0.55, PALETTE.gorTuffDk);
      M.box(fx, fy + 1.18, fz, 2.4, 0.16, 0.70, PALETTE.gorBasalt);
      M.box(fx, fy + 0.28, fz - 0.62, 2.6, 0.56, 0.70, PALETTE.gorTuffDk);   // the trough
      M.box(fx, fy + 0.50, fz - 0.62, 2.2, 0.20, 0.34, PALETTE.gorTuffDk);  // ...and the water in it
      M.cyl(fx, fy + 0.86, fz - 0.34, 0.055, 0.34, PALETTE.gorSteel, Math.PI * 0.5, 0, 0, 6);
      M.quad(fx, fy + 0.02, fz - 1.4, 3.0, 2.0, PALETTE.gorTuffDk, 0.2);    // the wet apron
      // the potter's seconds, stacked where seconds are always stacked
      for (let k = 0; k < 9; k++) {
        const px = P.x + 9.6 + (k % 3) * 0.62, pz = P.z - 8.4 + ((k / 3) | 0) * 0.58;
        const py = gorTerrain(px, pz);
        M.cyl(px, py + 0.26, pz, 0.24 + (k % 2) * 0.05, 0.52, PALETTE.gorPot, 0, k * 0.7, 0, 8);
        M.cyl(px, py + 0.55, pz, 0.13, 0.10, PALETTE.gorPot, 0, k * 0.7, 0, 8);
      }
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
  // AND IT STOPS 2.6 m BEHIND THE ROCK. The ribs are drawn from faceX - 20 to
  // faceX, the batter tapers stand proud of that to faceX + 2.6, and the
  // cornice caps overhang to faceX + 1.2 — while the box's east face was at
  // faceX - 0.2. Everything in front of that line was rock you walked into and
  // through, which was ten of Goreme's forty-one hits along x -70 to -75. The
  // west face is left where it was; it is inside the hill either way.
  //
  // ...AND THE FACE IS A CURVE, WHICH SIX BOXES CANNOT FOLLOW (9 Sep 2026).
  // The line above took faceX AT THE BOX'S OWN CENTRE and gave the box an 8.4 m
  // span. faceX changes by up to 0.22 m a metre, so wherever the face bulged
  // east within a box's four metres the drawn rock stood proud of its own
  // collider — and the audit's `recessed` category is mostly this one line.
  // MEASURED (`qa/px-recessed.js`, `qa/px-recessed-why.js`): walking at the
  // face at (−71, −15) put the animal's nose **1.42 m inside the drawn rock**
  // before anything stopped it, and (−71, −37) 1.01 m.
  //
  // Two changes, and between them the error can only be in the safe direction:
  //  - the east face is the FURTHEST EAST the drawn face gets anywhere in the
  //    box's own span, sampled rather than evaluated once, so it is impossible
  //    to be inside the rock;
  //  - four-metre boxes rather than eight, so the price of that — stopping
  //    slightly short where the face recedes inside a span — is at most 0.48 m
  //    instead of 0.92.
  //
  // AND THE ROW REACHES THE END OF THE ROCK NOW. The ribs are drawn from
  // C.z0 − 4 in 3.1 m slabs, so the massif's south face is at z −071.55 while
  // the collider row began at −70.2 — which is the whole of the 1.35 m the four
  // samples along z −72 reported, and they were walking at the cliff's END and
  // not at its face.
  const CSTEP = 4;
  for (let z = C.z0 - 6.5; z < C.z1 + 6.5; z += CSTEP) {
    const cz = z + CSTEP * 0.5;
    const g = gorTerrain(C.x, cz);
    let fmax = -1e9;
    for (let k = 0; k <= 8; k++) fmax = Math.max(fmax, faceX(z - 0.3 + (CSTEP + 0.6) * k / 8));
    // east face at fmax + 2.6, which is where the batter tapers reach
    gorStaticBox(game, fmax + 2.6 - 12.4, g + C.top * 0.5 + 4, cz,
                 24.8, C.top + 22, CSTEP + 0.4);
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
  gorPigeonHole = new Float32Array(gorPIGEON_N * 3);    // C5: the cliff hole, kept
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
    // C5: the hole it actually belongs in, kept aside. Slots 7-9 are the LIVE
    // home and the lure rewrites them, so without this copy a bird that has
    // come down for a chip has nowhere on the cliff to go back to.
    gorPigeonHole[i * 3] = gorPigeonData[o + 7];
    gorPigeonHole[i * 3 + 1] = gorPigeonData[o + 8];
    gorPigeonHole[i * 3 + 2] = gorPigeonData[o + 9];
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

// ---- ...AND A RUN ALONG THE FOOT OF THE CLIFF PUTS THEM UP TOO (D7) -------
// See THE FLOCK in systems.js. Four hundred rock doves came off this cliff for
// a wheek and for nothing else — so a player who sprinted the length of it
// went past four hundred birds that did not move. `scare` is the same block
// the wheek path uses, and this chapter offers no at/put: its pigeons live in
// a Float32Array of velocities and there is no such thing as a Göreme pigeon
// standing on the ground for a chip to be dropped in front of. A flock may
// offer either channel, and this one is scatter and nothing else.
let gorFlockOffered = false;
// ---- C5: AND THEY COME DOWN (D3) -----------------------------------------
//
// The comment above says this chapter "offers no at/put: its pigeons live in a
// Float32Array of velocities and there is no such thing as a Göreme pigeon
// standing on the ground for a chip to be dropped in front of." The first half
// is a data-layout fact and it is not an obstacle — a home is three floats and
// there is nothing about those three floats that has to be on a cliff. The
// second half is a design decision that was never made; it was inherited from
// the fact that nobody had written the branch.
//
// So: a lure. Something worth landing for on the paving brings a PART of the
// flock down round it — sixty of two hundred and sixty, not all of them,
// because four hundred birds mobbing one chip is a horror film and twenty is a
// square in Göreme. They come in on the same "coming in" branch the cliff
// return uses, and when the lure goes they get their own holes back.
//
// THE ONE THING THAT MAKES IT READ: they land in a RING, not on the point. A
// dove will not stand on the thing it wants; it stands two feet away and edges
// in, and sixty of them doing that is a doughnut with a chip in the middle.
let gorPigeonHole = null;         // the cliff hole, per bird
let gorLureX = 0, gorLureZ = 0;
let gorLureT = 0;                 // seconds of lure left, 0 = none
const gorLURE_N    = 60;          // how many of them care
const gorLURE_HOLD = 14;          // s — and then they go home
const gorLURE_R0   = 1.2;         // m — nobody stands on it
const gorLURE_R1   = 4.6;         // ...and the outside of the ring

/** Bring part of the flock down to (x, z). Returns how many came. */
function gorPigeonLand(x, z) {
  if (!gorPigeonData || !gorPigeonHole) return 0;
  const gy = gorTerrain(x, z);
  // ...but not from the far side of the valley. The scare carries fifty
  // metres and a chip does not carry further than a shout.
  if (Math.hypot(x - (gorCLIFF.x + 6), z - (gorCLIFF.z0 + gorCLIFF.z1) * 0.5) > 62) return 0;
  gorLureX = x; gorLureZ = z; gorLureT = gorLURE_HOLD;
  // ...and they have to be IN THE AIR to arrive. Birds on their ledges get put
  // up first, which is also the right picture: something lands in the square,
  // the cliff empties, and the square fills.
  if (gorPigeonOut < 0.34) gorPigeonOut = 0.34;
  for (let i = 0; i < gorLURE_N && i < gorPIGEON_N; i++) {
    const o = i * 10;
    const a = (i * 2.399963) % 6.28318;              // the golden angle: no clumps
    const r = gorLURE_R0 + Math.sqrt((i + 0.5) / gorLURE_N) * (gorLURE_R1 - gorLURE_R0);
    gorPigeonData[o + 7] = x + Math.cos(a) * r;
    gorPigeonData[o + 8] = gy + 0.10;
    gorPigeonData[o + 9] = z + Math.sin(a) * r;
  }
  return gorLURE_N;
}

/** Hand the lured birds their own holes back. */
function gorPigeonUnlure() {
  if (!gorPigeonData || !gorPigeonHole) return;
  gorLureT = 0;
  for (let i = 0; i < gorLURE_N && i < gorPIGEON_N; i++) {
    const o = i * 10;
    gorPigeonData[o + 7] = gorPigeonHole[i * 3];
    gorPigeonData[o + 8] = gorPigeonHole[i * 3 + 1];
    gorPigeonData[o + 9] = gorPigeonHole[i * 3 + 2];
  }
  if (gorPigeonOut < 0.34) gorPigeonOut = 0.34;      // they have to fly home
}

function gorPigeonScare(x, z) {
  if (!gorPigeonData || gorPigeonOut >= 0.5) return 0;
  const cd = Math.hypot(x - (gorCLIFF.x + 6), z - (gorCLIFF.z0 + gorCLIFF.z1) * 0.5);
  // Half the wheek's hundred metres: a shout carries and a capybara does not.
  if (cd > 50) return 0;
  gorPigeonOut = 1;
  for (let i = 0; i < gorPIGEON_N; i++) {
    const o = i * 10;
    gorPigeonData[o + 3] = rand(3, 11);
    gorPigeonData[o + 4] = rand(2, 8);
    gorPigeonData[o + 5] = rand(-5, 5);
  }
  return gorPIGEON_N;
}

function gorUpdatePigeons(dt) {
  if (!gorPigeonMesh) return;
  if (!gorFlockOffered && typeof gorGame === 'object' && gorGame &&
      typeof gorGame.flockOffer === 'function') {
    gorFlockOffered = true;
    gorGame.flockOffer({
      biome: 'goreme', kind: 'rock dove', voice: 'rustle', pitch: 1.1, fleeR: 50,
      scare: function (x, z) { return gorPigeonScare(x, z); },
      // ---- C5: the other channel, which this chapter refused ------------
      count: function () { return gorLURE_N; },
      at: function (i, o) {
        const q = i * 10;
        o.x = gorPigeonData[q]; o.y = gorPigeonData[q + 1]; o.z = gorPigeonData[q + 2];
      },
      // `put` moves ONE bird's landing spot, and only while a lure is live:
      // dragging a bird that is on a ledge forty metres up the cliff face to a
      // point on the paving would teleport it through the rock. The flock's
      // own steering does the rest, on the branch that already exists.
      put: function (i, x, z) {
        if (gorLureT <= 0 || i >= gorLURE_N) return;
        const q = i * 10;
        gorPigeonData[q + 7] = x;
        gorPigeonData[q + 8] = gorTerrain(x, z) + 0.10;
        gorPigeonData[q + 9] = z;
      },
      land: function (x, z) { gorPigeonLand(x, z); },
    });
  }
  // the lure runs out, and they go back to the rock
  if (gorLureT > 0) {
    gorLureT -= dt;
    if (gorLureT <= 0) gorPigeonUnlure();
  }
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
    const cz = (gorCLIFF.z0 + gorCLIFF.z1) * 0.5;
    const h = gorHeard(gorCLIFF.x + 6, cz, 20, 190);
    if (h > 0.02) gorSfx('rustle', gorPlace({ volume: 0.42 * h, pitch: 1.15 },
                                            gorCLIFF.x + 6, 26, cz, 190));
  }
  if (wasOut > 0.001 && out <= 0.001) {
    const cz = (gorCLIFF.z0 + gorCLIFF.z1) * 0.5;
    const h = gorHeard(gorCLIFF.x + 6, cz, 20, 150);
    if (h > 0.02) gorSfx('rustle', gorPlace({ volume: 0.30 * h, pitch: 0.85 },
                                            gorCLIFF.x + 6, 26, cz, 150));
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
  // ...AND IT IS WICKER, WHICH IS THE ONE THING EVERYBODY KNOWS ABOUT THEM.
  // The floor was one dark box: from the flight rig, which looks down into the
  // basket, three square metres of flat gorBasketDk with an animal standing on
  // it read as a card table. A balloon basket is pale woven cane with darker
  // courses running round it and a scuffed floor, and at this scale that is
  // four boxes and two bands.
  M.box(0, 0.06, 0, gorBASKET.w, 0.14, gorBASKET.d, PALETTE.gorBasket);
  for (let k = 0; k < 3; k++) {
    // the floor's own weave: three courses of cane laid across it
    M.box(0, 0.14, (k - 1) * 0.86, gorBASKET.w * 0.97, 0.03, 0.20, PALETTE.gorBasketDk);
  }
  for (let s = -1; s <= 1; s += 2) {
    M.box(s * gorBASKET.w * 0.5, gorBASKET.h * 0.5, 0, 0.14, gorBASKET.h, gorBASKET.d, PALETTE.gorBasket);
    M.box(0, gorBASKET.h * 0.5, s * gorBASKET.d * 0.5, gorBASKET.w, gorBASKET.h, 0.14, PALETTE.gorBasket);
    // a darker course two thirds of the way up each wall, which is the band
    // that reads as weave from any distance at all
    M.box(s * (gorBASKET.w * 0.5 + 0.02), gorBASKET.h * 0.70, 0, 0.13, 0.13, gorBASKET.d * 0.99,
          PALETTE.gorBasketDk);
    M.box(0, gorBASKET.h * 0.70, s * (gorBASKET.d * 0.5 + 0.02), gorBASKET.w * 0.99, 0.13, 0.13,
          PALETTE.gorBasketDk);
  }
  // ...and the corner posts a real one has, which are what the coping sits on
  for (let s = 0; s < 4; s++) {
    M.box((s & 1 ? 1 : -1) * gorBASKET.w * 0.5, gorBASKET.h * 0.5, (s & 2 ? 1 : -1) * gorBASKET.d * 0.5,
          0.20, gorBASKET.h + 0.10, 0.20, PALETTE.gorBasketDk);
  }
  // ---- THE COPING, AND FOR THE CHAPTER'S WHOLE LIFE IT WAS A LID ---------
  // One box, `w + 0.16` by `d + 0.16`, laid across the top of the basket: a
  // solid three-metre-square slab of gorBasketDk at chest height on a
  // capybara. Photographed from the chapter's own flight rig — fifteen metres
  // back at 0.62 rad, which is a lens looking DOWN at the basket, which is the
  // whole reason that rig exists — the marquee of Cappadocia is a black
  // rectangle with a flame poking out of the middle of it and NO ANIMAL IN THE
  // FRAME AT ALL. The passenger was inside a closed box for the entire flight.
  // Measured: capybara 58 cm above the balloon datum, coping at 68. It never
  // once cleared the lid.
  //
  // A coping is a RIM. Four bars round the edge, and everything they used to
  // be hiding is now the subject of the shot: the animal, the propane bottles,
  // the burner frame and the inside of the envelope over all of it. Same
  // silhouette from ground level, where a rim and a lid look identical.
  {
    const cw = gorBASKET.w + 0.16, cd = gorBASKET.d + 0.16, ct = 0.20;
    for (let s = -1; s <= 1; s += 2) {
      M.box(s * (cw - ct) * 0.5, gorBASKET.h + 0.06, 0, ct, 0.12, cd, PALETTE.gorBasketDk);
      M.box(0, gorBASKET.h + 0.06, s * (cd - ct) * 0.5, cw - ct * 2, 0.12, ct, PALETTE.gorBasketDk);
    }
  }
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
// ---- A CREW IS NOT A METRONOME (v20) --------------------------------------
// This was `(gorTime * 0.118 + e.ph) % 1`: a fixed 8.47 s cycle, and every crew
// on the same one. Two things came out of that and one of them is the loudest
// bug in the chapter.
//
//   1. THE SOUND. Exactly one crew is built lit (`state: 2`, and there is only
//      one of those in the table), so from anywhere on the field you heard ONE
//      hiss, at 8.47 s intervals to the frame, at a volume and a pitch that
//      were identical to three decimal places — because gorHeard is a function
//      of distance and a listener who is standing still is a constant. Logged
//      over a minute from the spawn: 8.69, 17.17, 25.64, 34.12, 42.59, 51.07,
//      59.54, 68.02, every one of them `volume 0.256 pitch 1.61`. Nothing else
//      in this game's ambience is periodic; every other bed is built out of
//      rand(). A repeated identical sample on a metronome is not atmosphere,
//      it is a fault, and it is what "an audio noise that repeats" is.
//   2. THE PICTURE. `ph: c * 2.1 + 0.4` was meant to spread five crews around
//      the cycle and does the opposite — 2.1 mod 1 is 0.1, so the phases land
//      at 0.4, 0.5, 0.6, 0.7, 0.8, which is all five burners inside a 3.4 s
//      volley followed by five seconds of nothing. The comment above the crew
//      table calls the field "a row of paper lanterns flashing out of step";
//      they were flashing very nearly in step. Fixed at the source, so it is
//      right if a second envelope is ever lit.
//
// So each crew now runs its OWN countdown, re-drawn from a range every time it
// fires, and the sound it makes is jittered either side of what the distance
// says. Same burner, same rate, same falloff; it simply stops being a clock.
const gorBURN_A = 6.5, gorBURN_B = 12.0;   // s between top-ups, per crew
const gorBURN_LEN = 1.9;                   // s the flame is up
function gorUpdateFieldBurners(dt) {
  for (let i = 0; i < gorFieldEnv.length; i++) {
    const e = gorFieldEnv[i];
    // The countdown is seeded on the first frame from the crew's own phase, so
    // the five do not all fire together on the frame the chapter is entered.
    if (e.next === undefined) e.next = e.ph * (gorBURN_A + gorBURN_B) * 0.5 + 0.4;
    e.next -= dt;
    if (e.next <= -gorBURN_LEN) e.next = rand(gorBURN_A, gorBURN_B);
    // `u` runs 0..1 across the burn exactly as it used to, so the emissive
    // envelope below is unchanged.
    const u = e.next <= 0 ? -e.next / gorBURN_LEN : -1;
    const on = u >= 0 ? gorSmooth(u / 0.27) * gorSmooth((1 - u) / 0.32) : 0;
    if (e.mat && e.mat.emissive) {
      e.mat.emissive.copy(gorBurnerC);
      emitSet(e.mat, on * 0.80 * (1 + Math.sin(gorTime * 21 + i) * 0.16));
    }
    const lit = on > 0.35;
    if (lit && !e.was) {
      const h = gorHeard(e.x, e.z, 10, 130);
      // AND THE PITCH DROPS WITH DISTANCE. Nothing in this game models the speed
      // of sound and it would be a gimmick if it did — but air eats the top of a
      // flame's noise long before it eats the bottom, and that one number is the
      // whole difference between the crew twenty metres away and the crew at the
      // far end of the field.
      if (h > 0.03) {
        gorSfx('burner', gorPlace({ volume: 0.34 * h * rand(0.82, 1.12),
                                  pitch: (1.05 + h * 0.75) * rand(0.90, 1.10) },
                                e.x, 3.2, e.z, 130));
      }
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
    // THE INSTRUMENT WAS LYING, AND IT IS THE ONLY INSTRUMENT THE CHAPTER HAS.
    //
    // `gorWindAt` takes HEIGHT ABOVE GROUND — that is what the player's own
    // balloon passes it, `gorBalY - groundY`. This passed `gorDecorData[o+2]`,
    // which is the ascent term only, while the envelope is actually drawn at
    // `gorTerrain + 6 + that`: six metres low, every frame, on all twenty-six.
    // The same off-by-the-basket the wisps' own note further down records.
    // Then it scaled the result by 0.55, so the twenty-six objects whose entire
    // job is to TEACH the layer speeds before the player has touched a burner
    // were showing 55% of them. Layers run 2.92 / 3.76 / 3.70 / 3.86 m/s;
    // reading the wrong layer at a bit over half speed is not a tutorial.
    const w = gorWindAt(6 + gorDecorData[o + 2], gorDecorData[o], gorDecorData[o + 1]);
    gorDecorData[o] += w.x * dt;
    gorDecorData[o + 1] += w.z * dt;
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
  gorUpdateDawnLine(dt);
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
// How far a valley burner carries, and how often the valley is allowed to be
// heard at all. 210 m reached every balloon on the map from anywhere on it,
// which is why the hiss never stopped; 130 is still most of the way across and
// leaves the far side of the valley as a picture rather than a soundtrack.
// See the note in gorUpdateDawnLine.
const gorDECOR_HEAR = 130;
const gorDECOR_GAP_A = 3.2, gorDECOR_GAP_B = 6.5;
let gorDecorBestH = 0;                     // loudest burner lit this frame
let gorDecorBestX = 0, gorDecorBestY = 0, gorDecorBestZ = 0;   // ...and where it is
let gorDecorSaid = 0;                      // s until the valley may speak again
// the once-per-morning line about the whole valley lighting up together
let gorSyncSaid = false;
function gorUpdateDawnLine(dt) {
  if (gorDecorSaid > 0) gorDecorSaid -= dt;
  if (!gorDecorMeshEnv || !gorDecorMeshEnv.instanceColor || !gorDecorBase.length) return;
  // above gorCEIL before the sun, on the floor after it, and the edge is soft
  // over about twenty-five metres because a rim two hundred metres off is not
  // a knife
  const line = lerp(gorCEIL + 40, -30, gorSmooth(gorSun));
  // ---- THE COUNTDOWN, AND IT IS MADE OF FIRE ------------------------------
  // The chapter's marquee is BE UP THERE WHEN THE SUN CLEARS THE RIM, and the
  // chapter told you nothing at all about when that was going to be. One toast
  // twenty minutes out, and then a hundred and twenty seconds of sky with no
  // clock on it — so a player who wandered into the town at the wrong moment
  // missed the only thing the chapter is about and had no idea why, and then
  // waited out a full two-and-a-half-minute cycle for the next one with
  // nothing to read.
  //
  // What actually happens in that valley in the last minute before the sun is
  // that every pilot in the air tops up at once, because the sunrise shot
  // wants everybody at height and they have all been letting it cool while
  // they waited. A hundred and fifty envelopes lighting up together, from the
  // far rim inwards, is the most beautiful thing in the place and it is also a
  // countdown you can read from anywhere — including from the ground, which is
  // the player it is for.
  //
  // gorSyncBurn ramps over the last twelve seconds before gorSUN_P and then
  // dies over the sunrise itself. It ADDS to each balloon's own clock rather
  // than replacing it, so nothing snaps and no two are exactly together.
  // D5.4: the else branch used to end in `* 0`, so the whole term went from
  // ~1 to 0 in a single frame at the instant `toSun` crossed zero — which is
  // the exact frame `sunrise` fires. A hundred and fifty envelopes stopped
  // being lanterns on the frame of the chapter's own marquee.
  //
  // IT NEEDS THREE BRANCHES AND NOT TWO, which is why the `* 0` was there.
  // `toSun` is positive BEFORE the sun point and negative after, so one else
  // covers both the long pre-dawn and the decay — and the decay term reads
  // `1 - gorSmooth(gorSun · 2.2)` while `gorSun` is clamped to 0 for every
  // frame before `gorSUN_P` (:4455). Simply dropping the `* 0` therefore
  // reads 1, not 0, for the ~90 % of the cycle before the ramp: the whole
  // valley on full burn all night. Measured on paper before it was typed.
  // ---- D4.3: AND THE ROCK LETS GO OF ITS BIRDS -------------------------
  // The dovecote local promises this out loud — "they come off the rock when
  // the light hits it, same as you did" — and the flock only ever went up for
  // the capybara. It goes up for the LIGHT now, once per sunrise, and it goes
  // up round the basket when there is somebody in one: gorPigeonScare takes
  // the centre of the loop, so the same call serves the cliff and the balloon.
  if (!gorSunDoves && gorSun > 0.35) {
    gorSunDoves = true;
    if (gorAboard) gorPigeonScare(gorBalX, gorBalZ);
    else gorPigeonScare(gorCLIFF.x + 13, -42);
  }
  const toSun = (gorSUN_P - gorPhase) * gorCYCLE;
  const gorSyncBurn = toSun > 12 ? 0
                    : toSun > 0  ? gorSmooth(1 - toSun / 12)
                                 : (1 - gorSmooth(clamp(gorSun * 2.2, 0, 1)));
  if (gorSyncBurn > 0.45 && !gorSyncSaid) {
    gorSyncSaid = true;
    gorToast('every burner in the valley, all at once. it is coming.');
    gorSfx('burner', { volume: 0.42, pitch: 0.62 });
  }
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
      // ...and the whole valley, together, in the last twelve seconds. Staggered
      // by a third of a second per balloon off the same index the drift uses, so
      // it arrives as a wave across the sky rather than as a light switch.
      if (gorSyncBurn > 0) {
        const lead = clamp(gorSyncBurn * 1.5 - (i % 7) * 0.09, 0, 1);
        burn = Math.max(burn, lead * (0.72 + Math.sin(gorTime * 7 + i) * 0.16));
      }
    }
    const on = burn > 0.4;
    if (on && !gorDecorLit[i]) {
      // AND YOU HEAR IT ACROSS THE VALLEY. Further than the field crews, because
      // these are in the air with nothing between them and the ear, and lower in
      // pitch for the same reason the field ones are — see gorUpdateFieldBurners.
      // ---- ONE OF THEM, AND IT IS THE NEAREST ONE (v20) ------------------
      // Twenty-six envelopes on a 19 s cycle is 1.35 burner requests a second,
      // and every one of them went straight at game.sfx. The dispatcher's own
      // 1.2 s throttle then decided which you actually heard — and a throttle
      // keeps whichever arrived FIRST, which across twenty-six sources in
      // instance order is a coin toss. So the balloon you heard was not the
      // balloon you could see, the valley hissed continuously, and the chapter
      // whose own note says the thing about ballooning is that it is silent
      // never stopped making noise. Logged from the spawn: eleven hisses in
      // twenty-three seconds, in clusters of three on the same frame.
      //
      // Collected here and fired once at the end of the sweep, loudest wins.
      const h = gorHeard(gorDecorData[o], gorDecorData[o + 1], 24, gorDECOR_HEAR);
      // ...and REMEMBER WHICH ONE WON, because the whole point of choosing the
      // nearest burner is lost if the sound it makes then arrives from nowhere.
      // This is the cue that matters most in the chapter: the wind here is read
      // by looking at what other balloons are doing, and a roar with no bearing
      // is a wasted instrument.
      if (h > gorDecorBestH) {
        gorDecorBestH = h;
        gorDecorBestX = gorDecorData[o];
        gorDecorBestY = gorDecorData[o + 2];
        gorDecorBestZ = gorDecorData[o + 1];
      }
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
  // ...and the one burner you hear out of however many lit this frame. The
  // rate limit is here rather than left to the dispatcher's throttle, because
  // the throttle can only drop the sound and this can choose it: nearest wins,
  // and there is a floor under how often the valley is allowed to speak at all.
  if (gorDecorBestH > 0.02) {
    if (gorDecorSaid <= 0) {
      const h = gorDecorBestH;
      gorDecorSaid = rand(gorDECOR_GAP_A, gorDECOR_GAP_B);
      gorSfx('burner', { volume: 0.26 * h * rand(0.85, 1.1),
                       pitch: (0.95 + h * 0.7) * rand(0.92, 1.08) });
    }
    gorDecorBestH = 0;
  }
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
  if (gorSunMat) emitSet(gorSunMat, 0.9 + gorSun * 1.4);
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
    emitSet(gorRimMat, 0.45 + k * 0.95);
  }
  if (gorCirrus) gorCirrus.rotation.y = gorTime * 0.0014;
  // AND SOMEBODY TURNS THE TEA HOUSE OFF. A string of bulbs is a thing that is
  // ON because it is dark, and this chapter's whole clock is the dark ending:
  // they fade out over the same eighteen seconds the disc takes to clear the
  // ridge, and the last one of them goes as the valley floor comes up. It is
  // two lines and it is the difference between a lighting rig and a morning.
  if (gorBulbMat) {
    emitSet(gorBulbMat, 1.25 * (1 - gorSmooth(clamp((gorSun - 0.30) / 0.55, 0, 1)))
                      * (0.94 + Math.sin(gorTime * 3.1) * 0.06));
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
// ---- ...AND A PERSON IS SOLID (v20) ---------------------------------------
// Every figure gorFigure draws is merged into one static mesh with no rigid
// body anywhere near it, so all twenty-two people in this chapter — the five
// crews, the man with the clipboard, the three drinking tea in the square and
// the woman on the tea-house roof — could be walked straight through. npc.js
// learned this for its own locals a while ago (see the note by addLocal) and
// the merged crowds never did.
//
// A crowd is still geometry: this does NOT un-merge anything and costs no draw
// calls. It records where each figure ended up while the mesh is being built,
// and gorBuildFigureBodies turns the list into one static box each afterwards —
// inside the chapter's build, so main.js's capture tag owns them and they are
// attached and detached with the rest of Cappadocia.
const gorFigSolid = [];
function gorFigure(M, x, y, z, yaw, shirt, legs, pose) {
  gorFigSolid.push(x, y, z, pose);
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

/**
 * ONE STATIC BOX PER FIGURE. See the note on gorFigSolid.
 *
 * The half-extents are npc.js's own local body (0.26 x 0.85 x 0.24) for anybody
 * on their feet, because a person is a person and the two kinds should not feel
 * different to walk into. Pose 4 is SITTING and `y` is the seat rather than the
 * ground, so it gets a shorter, wider box centred on the seat — a man on a stool
 * is a knee-high obstacle and standing one up would put an invisible 1.7 m wall
 * across the tea house. Pose 3 is bent at the waist and keeps the standing box:
 * it is the same footprint and the top of it is only a wrong answer to a
 * question nobody asks at this camera height.
 *
 * Mass 0, so they are furniture: they do not fall over, they do not sleep and
 * they cost the solver a broadphase entry each and nothing else.
 */
function gorBuildFigureBodies(game) {
  if (!game || !game.world) return;
  const mat = (game.mats && game.mats.npc) ? game.mats.npc : undefined;
  for (let i = 0; i < gorFigSolid.length; i += 4) {
    const x = gorFigSolid[i], y = gorFigSolid[i + 1], z = gorFigSolid[i + 2];
    const sit = gorFigSolid[i + 3] === 4;
    const hy = sit ? 0.42 : 0.85;
    const b = new CANNON.Body({ mass: 0, material: mat,
      position: new CANNON.Vec3(x, y + (sit ? 0.20 : 0.85), z) });
    b.addShape(new CANNON.Box(new CANNON.Vec3(sit ? 0.30 : 0.26, hy, sit ? 0.32 : 0.24)));
    b.previousPosition.copy(b.position);
    b.interpolatedPosition.copy(b.position);
    b.allowSleep = false;
    game.world.addBody(b);
  }
  gorFigSolid.length = 0;
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
      // A BASKET IS A SOLID OBJECT. This builder carried one collider — the
      // truck — for five crews' worth of kit, so all five baskets were walked
      // through. The ENVELOPES stay open on purpose: `the-mouth` is a task
      // about standing inside one while it fills.
      gorStaticBox(game, cr.x + Math.sin(ry) * 8.2, gy + 0.5, cr.z + Math.cos(ry) * 8.2,
                   2.4, 1.0, 2.4, ry);
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
      // ...and this one is six metres from the throat, at the far end from the
      // mouth, so it cannot get in the way of the task.
      gorStaticBox(game, cr.x + Math.sin(ry) * 6.0, gy + 0.5, cr.z + Math.cos(ry) * 6.0,
                   2.4, 1.0, 2.4, ry);
      M.cyl(cr.x - Math.sin(ry) * 8.2, gy + 0.9, cr.z - Math.cos(ry) * 8.2,
            0.95, 0.55, PALETTE.gorSteel, 0, ry, Math.PI * 0.5, 8);
      M.box(cr.x - Math.sin(ry) * 8.2, gy + 0.25, cr.z - Math.cos(ry) * 8.2,
            1.3, 0.5, 1.3, PALETTE.gorBasaltDk, 0, ry);
    } else {
      // ---- C1: AND IT ACTUALLY GOES (D3) --------------------------------
      //
      // "Five minutes from going" is what the comment below has said since the
      // chapter was written, and this crew has been five minutes from going
      // for the life of the chapter. A launch field on which nothing launches,
      // in a chapter whose entire subject is a launch, with a local who says
      // out loud that "eighty of them go up at first light".
      //
      // WHY IT NEEDED A GROUP AND NOT A HOIST. The envelope was a live Mesh
      // and everything under it — throat, basket, coping, uprights — was
      // merged into the field's one big static mesh at build. Raising the
      // envelope on its own would have flown the bag off the basket. So the
      // whole of THIS crew's balloon is a live group now; the four other
      // crews are untouched and still merge, because four static balloons and
      // one that leaves is the picture, and five that leave is a cutscene.
      //
      // The collider goes with it (see gorUpdateFieldLaunch), which is the
      // half of this that is easy to forget: a basket you could hop onto at
      // 1.1 m must not still be there at 1.1 m once the basket is at ninety.
      const lg = new THREE.Group();
      lg.position.set(cr.x, 0, cr.z);
      const env = new THREE.Mesh(gorEnvelopeGeo(5.4, col, PALETTE.gorEnvC), gorVCOwn());
      env.position.set(0, gy + 5.4 * 1.15 + 3.0, 0);
      env.castShadow = true;
      lg.add(env);
      {
        const LM = gorMerger();
        LM.cone(0, gy + 2.7, 0, 1.3, 2.1, PALETTE.gorEnvC, Math.PI, 0, 0, 8);
        LM.box(0, gy + 0.55, 0, 2.4, 1.1, 2.4, PALETTE.gorBasket, 0, ry);
        LM.box(0, gy + 1.15, 0, 2.6, 0.12, 2.6, PALETTE.gorBasketDk, 0, ry);
        for (let s = 0; s < 4; s++) {
          LM.cyl((s & 1 ? 0.8 : -0.8), gy + 1.9, (s & 2 ? 0.8 : -0.8),
                 0.045, 1.8, PALETTE.gorSteel, 0, 0, 0, 4);
        }
        const rig = new THREE.Mesh(LM.build(), gorVC());
        rig.castShadow = true; rig.receiveShadow = true;
        lg.add(rig);
      }
      root.add(lg);
      gorFieldLaunch = lg;
      gorFieldLaunchGY = gy;
      gorFieldLaunchX0 = cr.x; gorFieldLaunchZ0 = cr.z;
      gorFieldLaunchPad = { x: cr.x, y: gy + 0.55, z: cr.z, sx: 2.4, sy: 1.1, sz: 2.4, ry: ry };
      gorFieldLaunchBody =
        gorStaticBox(game, cr.x, gy + 0.55, cr.z, 2.4, 1.1, 2.4, ry) || null;
      lamps.push(cr.x, gy + 2.15, cr.z, 0.8);
      // ...AND ITS BURNER GOES TOO, on its own clock. Five crews, all at a
      // different point of the same twenty minutes, and every one of them is
      // topping up: the field at ten past five is a row of paper lanterns
      // flashing out of step with each other, which is what makes it a FIELD
      // rather than a diorama with one lit object in it.
      // The golden ratio, so any number of crews land as far apart from each
      // other as it is possible to be — `c * 2.1` here put five of them 0.1 of
      // a cycle apart and fired the whole field as one volley. See the note by
      // gorUpdateFieldBurners; this is only the seed now, but a seed that
      // clusters is still a field that starts by clapping in time.
      gorFieldEnv.push({ mat: env.material, ph: (c * 0.6180339887) % 1, x: cr.x, z: cr.z, was: false });
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
 * A balloon lands where the wind put it, and the crew drives to where they
 * think that is going to be — so the truck is always coming, which means the
 * landing task can never be unwinnable, and it is always guessing, which means
 * it is not free either. See gorUpdateTruck for what the guess is made of.
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
// how long the contact has been missing, so one blank frame is not a dismount
let gorHerdOffT = 0;
// 0..1 — how tightly the other ten are bunched on the mare. See gorUpdateHerd.
let gorHerdBunch = 0;
// the mare, as a declared reference frame. See the note in gorUpdateHerd.
let gorMareCarry = false;
const gorCarryM = { x: 0, z: 0 };
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

  // WHO IS UP, asked BEFORE the other ten are drawn rather than after them:
  // the formation below is a function of it and reading it later is a frame of
  // lag on a thing that is a metre from the lens.
  const capy = game.capy;
  const up = !!(capy && gorOnMare(capy.position));

  // ---- the other ten, running either side ---------------------------------
  // ...AND THEY CLOSE UP ROUND SOMEBODY WHO IS ON THE MARE.
  //
  // The mini is eleven seconds standing on the back of a horse, and for the
  // whole of those eleven seconds the other ten ran in exactly the formation
  // they run in when nobody is up: the same lane, the same spacing, the same
  // everything. A herd led by a bell mare bunches on her, and bunching is the
  // one thing that turns a set piece the player is a passenger in into a set
  // piece the player is INSIDE — ten animals at four metres a second either
  // side of the lens, close enough to fill the edges of the frame.
  //
  // Lateral only, damped, and it never crosses the mare's own outline: the
  // passenger is standing on a 1.24 m deck and a horse arriving on top of it
  // is a passenger in the dirt.
  const bunch = gorHerdBunch = damp(gorHerdBunch, (up && running) ? 1 : 0, 1.1, dt);
  for (let i = 0; i < gorHerdSeed.length; i++) {
    const sd = gorHerdSeed[i];
    const pull = bunch * 0.46 * (1 - Math.min(Math.abs(sd.dx), 8) / 22);
    const x = gorHERD_X + sd.dx * (1 - pull) +
              (sd.dx >= 0 ? 1 : -1) * bunch * 0.55;
    const z = gorHerdZ + sd.dz * gorHerdDir * (1 - bunch * 0.34);
    const y = gorTerrain(x, z) + (running ? Math.sin(gorHerdT * gait * sd.sp + sd.ph) * 0.06 : 0);
    gorHerdMesh.setMatrixAt(i, gorXform(x, y, z,
      running ? Math.sin(gorHerdT * gait * sd.sp + sd.ph + 1.2) * 0.07 : 0,
      (gorHerdDir > 0 ? 0 : Math.PI) + Math.sin(gorHerdT * 0.6 + sd.ph) * 0.04, 0, 1, 1, 1));
  }
  gorHerdMesh.instanceMatrix.needsUpdate = true;

  // ---- the bell, and the ride --------------------------------------------
  if (running) {
    gorHerdBell -= dt;
    if (gorHerdBell <= 0) {
      // Jittered, for the same reason the burners now are: a bell hung on a
      // moving horse rings with her stride and her stride is not a clock.
      // Logged at a flat 2.41 s from anywhere in the valley, at pitch 1.6 to
      // two decimals, for the whole time the herd was running.
      gorHerdBell = (up ? 0.9 : 2.4) * (gorSpook > 0 ? 0.45 : 1) * rand(0.72, 1.34);
      // A BELL ON A HORSE EIGHTY METRES AWAY IS NOT THE SAME SOUND AS A BELL
      // UNDER YOUR CHIN. See gorHeard — this rang flat out from anywhere in the
      // valley, every 2.4 s, for the whole chapter.
      const h = up ? 1 : gorHeard(b.position.x, b.position.z, 6, 95);
      if (h > 0.02 && game.sfx) {
        // ...and it has a BEARING, unless you are the one wearing it. `up` is
        // the ride: a bell under your own chin has no direction to come from,
        // so that case stays mono deliberately.
        const o = { volume: (up ? 0.34 : 0.30) * h * rand(0.88, 1.1),
                    pitch: 1.6 * rand(0.94, 1.07) };
        game.sfx('chime', up ? o : gorPlace(o, b.position.x, b.position.y + 1.3,
                                            b.position.z, 95));
      }
    }
    if (up && game.shake) game.shake(0.016);
  }
  // ---- AND SHE IS A DECLARED FRAME, NOT A SNIFFED ONE --------------------
  // Everything else in this game that carries the animal — the ferry deck, the
  // basket, the anteater, the raft — says so through carryFrame(). The bell
  // mare did not: she is a kinematic body doing 6.2 m/s with a passenger on
  // her back, and the passenger was being dragged along entirely by whatever
  // capybara.js's contact sweep happened to find that frame. That is the
  // basket's original bug (see the note by carryFrame): a carrier that is also
  // moving VERTICALLY — and she follows the terrain at up to nine metres a
  // second over the launch-field ramp — barely penetrates its own passenger,
  // and a contact that is barely there is sometimes not there. A declared
  // frame wins over a sniffed one in capybara.js and cannot blink.
  gorMareCarry = false;
  if (up) {
    gorMareCarry = true;
    gorCarryM.x = 0;
    gorCarryM.z = b.velocity.z;
  }
  if (gorHerdDone) return;
  if (up && running) {
    gorHerdRideT += dt;
    gorHerdOffT = 0;
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
    // ---- AND ONE BAD FRAME IS NOT DISMOUNTING --------------------------
    // Eleven seconds is a long time to hold a contact on a bobbing animal
    // crossing a valley floor, and a single frame in which the box test misses
    // used to throw the whole eleven away and start again from nothing. A
    // capybara that has genuinely got off is on the ground within half a
    // second; anything shorter than that is the solver blinking.
    gorHerdOffT += dt;
    if (gorHerdOffT > 0.45) gorHerdRideT = 0;
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

  // ---- AND IT HAS ITS LIGHTS ON, BECAUSE IT IS FIVE IN THE MORNING --------
  // The plume below is how you find the truck once the sun is up. Before the
  // sun there IS no plume worth seeing — the valley is blue and everything in
  // it is the same value — and the truck is the target of the chapter's last
  // task. A chase vehicle crossing a dark valley has its headlights on, and
  // two beams sweeping the tuff are both the only moving light down there and
  // the single most legible thing in the whole frame from a hundred metres up.
  //
  // Drawn as two flat wedges on the ground rather than as lights: a real
  // THREE light per truck is a shadow-map budget this chapter has already
  // spent, and from above what you can see of a headlight is only ever the
  // patch of road it is making. They go out over the sunrise with the bulbs
  // in the town — see gorUpdateTruck.
  {
    const L = gorMerger();
    for (let s = -1; s <= 1; s += 2) {
      // a wedge: narrow at the lamp, eleven metres of spill in front of it
      L.box(s * 0.62, 0.04, -6.4, 1.9, 0.02, 8.6, PALETTE.gorBurner);
      L.box(s * 0.72, 0.04, -11.6, 3.0, 0.02, 3.0, PALETTE.gorBurner);
      // the lamp itself, so there is something to look at from ground level
      L.box(s * 0.72, 1.02, -1.95, 0.34, 0.20, 0.10, PALETTE.gorBurner);
    }
    const bm = mat(PALETTE.gorBurner, {
      transparent: true, opacity: 0.42, depthWrite: false,
      blending: THREE.AdditiveBlending, vertexColors: true,
    }).clone();
    const lm = new THREE.Mesh(L.build(), bm);
    lm.userData.noShadow = true;
    lm.renderOrder = 3;
    g.add(lm);
    g.userData.beams = lm;
    g.userData.beamMat = bm;
  }
  // ---- C3: AND YOU CAN SEE IT (D3) --------------------------------------
  //
  // The chase truck is the best system in this chapter — it reads the wind,
  // predicts where the balloon will come down, drives there over rough ground
  // and speaks from its own position — and it is a khaki box on a khaki valley
  // floor, seen from six hundred metres up. From the basket it is invisible,
  // which means the one thing in the chapter that is FOLLOWING YOU cannot be
  // watched doing it.
  //
  // An amber rotating beacon, which is what every recovery vehicle in the
  // world has and what this one was missing. Its own cloned emissive material
  // off gorGlowMat, so nothing else in the valley is dragged with it, and it
  // spins rather than flashing: a flash at this distance is one pixel that
  // may or may not be on when the eye lands on it, and a rotation is a thing
  // that is always partly lit.
  {
    const B = gorMerger();
    B.cyl(0, 2.30, -0.30, 0.13, 0.10, PALETTE.gorBasaltDk, 0, 0, 0, 8);
    B.cyl(0, 2.42, -0.30, 0.115, 0.18, PALETTE.gorAmber, 0, 0, 0, 8);
    const beacon = new THREE.Mesh(B.build(), gorGlowMat(PALETTE.gorAmber, 1.5));
    beacon.userData.noShadow = true;
    beacon.renderOrder = 3;
    g.add(beacon);
    g.userData.beacon = beacon;
    // the wedge of light it throws, which is what actually carries at range
    const W = gorMerger();
    W.cyl(0, 2.42, -0.30, 0.42, 0.30, PALETTE.gorAmber, 0, 0, 0, 6);
    const wm = mat(PALETTE.gorAmber, {
      transparent: true, opacity: 0.30, depthWrite: false,
      blending: THREE.AdditiveBlending, vertexColors: true,
    }).clone();
    const wedge = new THREE.Mesh(W.build(), wm);
    wedge.userData.noShadow = true;
    wedge.renderOrder = 3;
    g.add(wedge);
    g.userData.beaconWedge = wedge;
    g.userData.beaconMat = wm;
  }
  root.add(g);
  gorTruck = g;
}

/**
 * THE RETURN TOLL THE CHAPTER PROMISES OUT LOUD AND HAS NEVER PAID.
 *
 * The chase crew's own payoff line, on the frame the balloon touches the
 * trailer, is "Right. In the back, both of you, and hold the ropes." — and then
 * there was nothing to get in. `gorBuildTruck` created a mesh and **zero
 * physics bodies**: a capybara teleported into the cab was still standing there
 * three seconds later, and `gorUpdateTruck` never drove anywhere but after the
 * balloon. Measured, the landing plain reaches z = -104 and the plaza is at
 * z = +34, so the toll on the chapter's marquee is a walk of up to a hundred
 * and forty metres back over the tuff, every flight.
 *
 * Pillar 5 says every return toll has a ride. This one was already drawn, was
 * already parked next to you, and already had a man in it telling you to get
 * in. Nothing is added to the world: one kinematic box on geometry that has
 * been in the chapter since it was built.
 *
 * The bed is `M.box(0, 0.8, 2.4, 2.6, 0.24, 4.2)` in truck-local space, so its
 * top face is 0.92 above the group's origin and the group sits at terrain+0.05.
 */
function gorBuildTrailerBody(game) {
  const b = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC,
                              material: (game.mats && game.mats.ground) || undefined });
  // The floor. Half-extents, and the box's TOP is what has to line up with the
  // drawn bed — so the shape is centred half a thickness below terrain+0.97.
  b.addShape(new CANNON.Box(new CANNON.Vec3(1.3, 0.12, 2.1)));
  // ...and two side rails, at kerb height for the basket's reason: the frame
  // channel means the animal does not slide relative to the bed at all, so
  // these only have to stop a hop going over the side.
  b.addShape(new CANNON.Box(new CANNON.Vec3(0.07, 0.3, 2.1)), new CANNON.Vec3(1.23, 0.42, 0));
  b.addShape(new CANNON.Box(new CANNON.Vec3(0.07, 0.3, 2.1)), new CANNON.Vec3(-1.23, 0.42, 0));
  // A KINEMATIC BODY AT REST FALLS ASLEEP AND A SLEEPING BODY IS SKIPPED IN
  // NARROWPHASE. The Star Ferry paid for this one; the basket's note above says
  // the same thing.
  b.allowSleep = false;
  gorTrailerPX = gorTruckX + Math.sin(gorTruckYaw) * 2.4;
  gorTrailerPZ = gorTruckZ + Math.cos(gorTruckYaw) * 2.4;
  b.position.set(gorTrailerPX, gorTerrain(gorTrailerPX, gorTrailerPZ) + 0.85, gorTrailerPZ);
  gorSyncBody(b);
  game.world.addBody(b);
  gorTrailerBody = b;
}

/**
 * Drive the bed, and answer whether the animal is on it.
 *
 * The velocity is differenced against the PREVIOUS TARGET, never against
 * `b.position` — cannon integrates a kinematic body by its own velocity inside
 * `world.step`, which runs before this, so `(target - b.position)` is the
 * distance the last velocity already travelled and deriving the next one from
 * it makes the sign alternate every frame. The snowcat measured +7, -7, +7 m/s
 * standing still, and that is the number capybara.js solves the frame against.
 */
function gorTrailerRide(game, dt) {
  if (!gorTrailerBody) return;
  const inv = dt > 0.0001 ? 1 / dt : 0;
  const tx = gorTruckX + Math.sin(gorTruckYaw) * 2.4;
  const tz = gorTruckZ + Math.cos(gorTruckYaw) * 2.4;
  const ty = gorTerrain(tx, tz) + 0.85;
  gorTrailerBody.velocity.set((tx - gorTrailerPX) * inv, 0, (tz - gorTrailerPZ) * inv);
  gorTrailerPX = tx; gorTrailerPZ = tz;
  gorTrailerBody.position.set(tx, ty, tz);
  gorSyncBody(gorTrailerBody);

  const capy = game.capy;
  gorTrailerCarrying = false;
  if (!capy || !capy.position) return;
  const p = capy.position;
  // Height plus a radius, the bangka's lesson: an axis-aligned rectangle reads
  // aboard on a fraction of the frames of a ride nobody ever falls off.
  const aboard = Math.hypot(p.x - tx, p.z - tz) < 2.4 && p.y > ty && p.y < ty + 2.6;
  gorTrailerCarrying = aboard;
  if (aboard) {
    gorTrailerCarry.x = gorTrailerBody.velocity.x;
    gorTrailerCarry.z = gorTrailerBody.velocity.z;
    // ...and once you are in the back after a landing, they take you home. The
    // crew said they would.
    if (gorLandDone && !gorRideHome && !gorRideDone) {
      gorRideHome = true;
      gorRideT = 0;
      gorToast('hold the ropes. the crew are taking you back to the square.');
      gorSfx('pop', { volume: 0.5, pitch: 0.7 });
    }
    if (gorRideHome) {
      gorRideT += dt;
      // arrived: the square is the one place in the chapter everybody comes
      // back to, and the tea man has been saying so for the whole flight
      if (Math.hypot(tx - gorPLAZA.x, tz - (gorPLAZA.z - 9)) < 7 && gorRideT > 3) {
        gorRideHome = false;
        gorRideDone = true;
        gorSaysNow('tea',
          ['There. Everybody who goes up comes back to this square. Everybody.',
           'Sit. You have earned the second glass and you are getting it.'],
          ['Ha. Louder than the landing was.']);
      }
    }
  } else if (gorRideHome && gorRideT > 1.5) {
    // stepped off half way: they are not going to reverse for you
    gorRideHome = false;
  }
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

/**
 * THE CHASE, AND IT USED TO BE A MAGNET.
 *
 * The truck drove to `(gorBalX, gorBalZ)` — the balloon's CURRENT position —
 * at up to nine metres a second, and the fastest wind in this chapter is three
 * point eight. Which means the trailer was directly underneath the basket from
 * the moment the player left the ground until the moment they came back, every
 * single flight, and 'Put it down on the trailer' — the chapter's last task,
 * the one with a distance record attached to it — could be completed by
 * letting go of E and doing nothing at all. A task you cannot fail is not a
 * task, it is a delay.
 *
 * What a chase crew actually does is watch where you are DRIFTING and drive to
 * where they think you are going to be, which is a guess, and the guess is
 * wrong every time the pilot changes layer. So:
 *
 *   THE AIM POINT IS A PREDICTION. Balloon position plus the wind it is
 *   currently in times the time it would take to sink from here. Burn, and the
 *   sink time doubles and the truck sets off for a point a hundred metres
 *   further on. Stop burning over the truck and it is already leaving.
 *
 *   AND HE REACTS LIKE A MAN, NOT A SERVO. gorCHASE_LAG seconds of damping on
 *   the aim point, so a change of layer buys the player four or five seconds
 *   of the truck going the wrong way — which is exactly the window a landing
 *   is planned in.
 *
 *   AND HE CANNOT GO UP A CHIMNEY. Speed falls off with the slope under the
 *   wheels; the steep ground round the cliff and the ridge simply costs him.
 *
 * The result is that the last task is a decision — sink early where he is, or
 * commit to a layer and trust him to read it — and the crew-walks-it-back
 * rescue below is still there for anybody who gets it comprehensively wrong.
 */
const gorCHASE_LAG = 0.30;           // lambda: about four seconds of being wrong
const gorCHASE_TOP = 9.0;            // m/s flat out on the valley floor
function gorUpdateTruck(dt) {
  if (!gorTruck) return;
  // where they THINK it is going: the wind it is in now, for as long as it
  // would take to come down from where it is now
  const gy0 = gorTerrain(gorBalX, gorBalZ);
  const fall = clamp((gorBalY - gy0) / 1.30, 0, 42);
  const w = gorWindAt(gorBalY - gy0, gorBalX, gorBalZ);
  gorChaseX = damp(gorChaseX, clamp(gorBalX + w.x * fall, -66, 78), gorCHASE_LAG, dt);
  gorChaseZ = damp(gorChaseZ, clamp(gorBalZ + w.z * fall, -104, 56), gorCHASE_LAG, dt);
  // ...unless somebody is in the back, in which case they stop chasing and
  // drive to the square. See gorTrailerRide.
  const tx = gorRideHome ? gorPLAZA.x : gorChaseX;
  const tz = gorRideHome ? gorPLAZA.z - 9 : gorChaseZ;
  const dx = tx - gorTruckX, dz = tz - gorTruckZ;
  const d = Math.hypot(dx, dz);
  if (d > 3) {
    // ...and he is on wheels. A 29% ramp is a first-gear crawl and the cliff
    // is not a road at all.
    const grip = clamp(1 - gorSlope(gorTruckX, gorTruckZ) * 1.9, 0.22, 1);
    const sp = Math.min(gorCHASE_TOP * grip, d * 0.6);
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
  // the headlights go out over the sunrise, with the bulbs in the town square,
  // and they flicker over the rough because the beam is on the same springs
  // the truck is
  const bm = gorTruck.userData.beamMat;
  if (bm) {
    const k = (1 - gorSmooth(clamp(gorSun * 1.5, 0, 1))) *
              (0.86 + Math.sin(gorTime * 9.3) * 0.09 * (d > 3 ? 1 : 0.15));
    bm.opacity = 0.46 * k;
    gorTruck.userData.beams.visible = k > 0.02;
  }
  // ---- C3: the beacon turns, and it does NOT go out at dawn --------------
  // The headlights above are keyed off gorSun because headlights are for the
  // dark. A beacon is for being seen, and the whole reason this one exists is
  // the twenty minutes after sunrise when the balloon is at six hundred metres
  // and the truck is a khaki dot. It turns whenever the truck is chasing, and
  // it turns FASTER when it is moving, which is the one bit of body language
  // a recovery vehicle has.
  const bc = gorTruck.userData.beacon;
  if (bc) {
    bc.rotation.y = gorTime * (d > 3 ? 5.2 : 2.1);
    const w = gorTruck.userData.beaconWedge;
    const wm = gorTruck.userData.beaconMat;
    if (w) w.rotation.y = bc.rotation.y;
    // the wedge brightens as its face comes round, which is what makes a
    // rotation read as a rotation from a kilometre away
    if (wm) wm.opacity = 0.16 + 0.22 * (0.5 + 0.5 * Math.sin(bc.rotation.y));
  }
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
/** One flight, one number. Called on the two edges that end a flight. */
function gorFlushPeak(game) {
  if (gorPeakAlt < 12) { gorPeakAlt = 0; return; }
  if (typeof game.record === 'function') game.record('three-winds', gorPeakAlt);
  gorPeakAlt = 0;
}

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
  // ...AND HOW TO GET IN (W3). Playtest: "it was not clear you needed to hold
  // E near the flame." The burner line below had never been drawn (see
  // gorSay), and nothing said how to board. Once, near the basket on the
  // ground with the envelope up, not aboard.
  if (!gorAboard && !gorBoardTold && capy && capy.position && gorBalY - groundY < 1.5) {
    const dx = capy.position.x - gorBalX, dz = capy.position.z - gorBalZ;
    if (dx * dx + dz * dz < 8 * 8) {
      gorBoardTold = true;
      gorSay('press Space to hop into the basket. once you are in, hold E — the burner — and it climbs.');
    }
  }
  if (gorAboard && !wasAboard) {
    gorAboardT = 0;
    if (!gorToldBurner) {
      gorToldBurner = true;
      gorSay('hold E for the burner. let go and it comes down. the stick does nothing.');
    }
  }
  if (gorAboard) gorAboardT += dt; else gorAboardT = 0;
  // ---- AND WHEN THE FLIGHT IS OVER, THE FLIGHT IS REPORTED ---------------
  // Stepping out of the basket ends a flight just as surely as touching down,
  // and either way the number the player earned is the peak they reached, said
  // once. See gorPeakAlt.
  if (wasAboard && !gorAboard) gorFlushPeak(game);

  // ---- the burner, and there is nothing else -------------------------------
  const wantBurn = gorAboard && input && input.action && gorBalY < gorCEIL;
  gorBalBurn = damp(gorBalBurn, wantBurn ? 1 : 0, wantBurn ? 2.6 : gorCOOL_LAG, dt);
  // ---- AND THE CEILING SAYS SO -------------------------------------------
  // The chapter has ONE control. Above gorCEIL it silently stopped working:
  // the player holds E, the flame goes out, the balloon starts sinking and
  // nothing anywhere says why — which from the far side of the screen is
  // indistinguishable from the button having broken. It is also the top of
  // the chapter and nobody was ever told they had got there.
  if (gorAboard && input && input.action && gorBalY >= gorCEIL && gorCeilT <= 0) {
    gorCeilT = 9;
    gorSfx('burner', { volume: 0.30, pitch: 1.55 });
    if (!gorToldCeil) {
      gorToldCeil = true;
      gorToast('that is as high as it goes. everything else in the valley is below you.');
    } else {
      gorToast('the air will not hold you any higher.');
    }
  }
  if (gorCeilT > 0) gorCeilT -= dt;

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
      // A four-metre column of burning propane, and it was a 1.5 m cone that
      // grew to two and a half. It is the only warm light in the valley and
      // the one piece of feedback a four-second control has.
      const s = 0.7 + gorBalBurn * 2.3 + Math.sin(gorTime * 22) * 0.16 * gorBalBurn;
      const w = 0.86 + gorBalBurn * 0.34 + Math.sin(gorTime * 31) * 0.06 * gorBalBurn;
      flame.scale.set(w, s, w);
      emitSet(flame.material, 1.0 + gorBalBurn * 2.4);
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
      // 0.50, NOT 0.85. At the old level the burner washed the whole envelope
      // to one flat sheet of burner-orange — and the player's own bag is the
      // top third of every frame in this chapter's marquee, so holding E
      // painted out the eight red-and-cream gores it was built with and left a
      // plain dome. A lantern is a lantern because you can still see what it
      // is made of; it is the FLAME that should be the bright thing, and that
      // is where the extra went (see the scale below).
      emitSet(envM.material, gorBalBurn * 0.50 * flick);
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
    // ---- THE HIGHEST IS BANKED, NOT REPORTED ---------------------------
    // `game.record()` TOASTS AND CHIMES EVERY TIME THE NUMBER IMPROVES, and
    // this line was calling it every frame on a value that climbs for two
    // minutes. On a second visit — the only time `record` has a previous best
    // to beat — a burn from twelve metres to two hundred fired a personal-best
    // toast and a chime on EVERY FRAME of the climb: about eleven thousand of
    // them, stacked over the animal's head, through the whole of the chapter's
    // marquee. Exactly the cowbird bug in the Pantanal, and the fix is the
    // same: bank the peak here, report it ONCE when the flight is over.
    if (alt > gorPeakAlt) gorPeakAlt = alt;
    // how high this flight has got, on the paper, while it is still going up
    // (v32). Twelve is the record's own floor — see gorFlightEnd — so a hop off
    // a chimney does not put a number on the card.
    if (game.recordLive && gorPeakAlt > 12) game.recordLive('three-winds', gorPeakAlt);
    // ---- ...AND ON THE WAY DOWN IT IS A DIFFERENT NUMBER (v36) ------------
    // The chapter's last task is a landing accuracy and it was only ever
    // readable after the basket was on the ground, which is a metre too late to
    // do anything about. This is how far the balloon is from the trailer RIGHT
    // NOW, in plan — the same quantity gorLandCheck files — and in a chapter
    // whose only control is a burner, watching that figure shrink as the layer
    // carries you across the field IS the steering.
    //
    // It takes the line off `three-winds` above it on purpose and only when
    // both halves of "coming in" are true: under thirty metres, and sinking.
    // A climb through thirty on the way up is still the altimeter's.
    if (game.recordLive && alt < 30 && gorBalVY < -0.15) {
      const ltx = gorTruckX + Math.sin(gorTruckYaw) * 2.4;
      const ltz = gorTruckZ + Math.cos(gorTruckYaw) * 2.4;
      game.recordLive('on-the-trailer', Math.hypot(gorBalX - ltx, gorBalZ - ltz));
    }

    // ---- the sunrise ------------------------------------------------------
    // THE ROW SAYS "BE UP THERE WHEN THE SUN CLEARS THE RIM" AND IT USED TO PAY
    // OUT WITH THE SUN A HUNDRED METRES UNDER THE VALLEY FLOOR.
    //
    // gorUpdateSky puts the disc at `lerp(-120, 300, gorSmooth(gorSun))`, so the
    // old 0.12 gate fired at y = -103. The horizon is gorSun 0.354 and the
    // ridge the row is named after — 70 m — is gorSun 0.465. Nothing was
    // visible at the moment the chapter's marquee announced itself; the
    // screenshot at the payout was the town, in the dark, with no sky in it.
    //
    // The window that leaves is gorPhase 0.5235..0.5804, about eleven seconds,
    // which is fine for anyone already up and cruel to anyone still on the
    // ground — so the tea man's warning below now comes 0.18 of a cycle out
    // instead of 0.075. A full-burn climb from the field to 55 m measures 32 s.
    // ---- D4.3: AND THE BURNER HAS TO BE LIT ------------------------------
    // Latched across the whole window rather than sampled at the tick, so a
    // player who burned to get up there and is coasting at the top of it has
    // already earned it, and nobody has to hold a key at a frame they cannot
    // see coming.
    // ...and ABOARD, which the old gate never said. It tested altitude alone,
    // so in principle the row could pay out with the balloon up and the player
    // standing in the field watching it. It cannot now, and the row has always
    // read "be up there".
    const gorSunWin = gorAboard && gorSun > 0.465 && gorSun < 0.96 && alt > 55;
    if (gorSunWin && gorBalBurn > 0.5) gorSunBurned = true;
    // ---- aloft, on the paper (W1) ------------------------------------------
    // The chapter's one control is the burner and the marquee needs it lit
    // at height in an eleven-second window; none of that was on screen. The
    // line says how high, whether you are burning, and where the sun is, so
    // the window is something you can see coming rather than something the
    // chief shouts about.
    if (gorAboard && !gorSunDone && typeof game.wowLive === 'function') {
      // gorSun is 0 until gorSUN_P and reaches the rim (0.465) about 0.055
      // of a cycle later, so the countdown is on the PHASE, in seconds.
      const winAt = gorSUN_P + 0.115 * 0.48;
      const sunIn = (winAt - gorPhase) * gorCYCLE;
      const line = 'aloft · ' + Math.round(alt) + ' m up · burner ' + (gorBalBurn > 0.5 ? 'ON' : 'off') +
                   (gorSun >= 0.465 ? ' · THE SUN IS UP' + (alt > 55 ? '' : ' · get above 55 m')
                    : sunIn > 0 ? ' · sun over the rim in ' + Math.ceil(sunIn) + ' s' : '');
      game.wowLive(line, 0.5 * clamp(alt / 55, 0, 1) + 0.5 * clamp(1 - sunIn / 60, 0, 1));
    }
    // ...and if they are up there NOT burning while the whole valley is, the
    // chief says so. Once, on the radio, which is the only voice that reaches
    // a basket at seventy metres.
    if (gorSunWin && !gorSunBurned && !gorSunNagged && !gorSunDone) {
      gorSunNagged = true;
      gorCall('chief', 'topup', 'Top up! Everybody is burning — get in it!', 999);
    }
    if (gorSunWin && gorSunBurned && !gorSunDone) {
      gorSunDone = true;
      gorTask('sunrise');
      // ---- AND THE WHOLE VALLEY ANSWERS (L7) ----------------------------
      // Every burner was already going together; now the field crews cheer,
      // the moment is held for a second, and the sky gets confetti.
      if (typeof game.slowmo === 'function') game.slowmo(0.6, 1.2);
      gorSfx('cheer', { volume: 0.55, pitch: 0.95, force: true });
      if (typeof game.confetti === 'function') { const cp = game.capy && game.capy.position; if (cp) game.confetti(cp.x, cp.y + 1.5, cp.z, 22); }
      if (typeof game.punch === 'function') game.punch(0.1);
      // FRAMED — batch 3 built game.frameShot and no chapter from 12 to 17 had
      // ever asked for it. `yaw` is the bearing FROM the animal TO the camera,
      // and the disc sits at x = +760, so the camera belongs at -X looking back
      // along the sun's bearing. Measured facing 93 degrees away from its own
      // subject before this line. Yaw and pitch ONLY: systems.js applies a shot
      // after the rig, so naming a distance here would throw away the balloon
      // rig's own 15 m and its 0.62 raise.
      //
      // AND THE BEARING WAS MEASURED BY PROJECTING THE SUN DISC INTO THE FRAME,
      // not reasoned about. At -PI/2 the sun lands at NDC (-0.13, 0.03) — dead
      // centre, and therefore directly behind the player's own basket and
      // burner, which is exactly where it stayed in the photograph: a shot with
      // its subject correctly in the middle of it and the subject occluded.
      // -1.10 rad puts it at (0.46, -0.29), off the right shoulder and clear of
      // the envelope, with the balloon on the left of the frame and the valley
      // under both. The 1.4 m rise buys the envelope's mouth instead of mud.
      if (typeof game.frameShot === 'function')
        game.frameShot({ yaw: -1.10, dist: 17, pitch: 0.0, raise: 1.4, hold: 5 });
      gorSaysNow('town',
        ['You were up there for it. That is why anybody lives here.',
         'Every morning of my life. It has not got old and it is not going to.',
         'Now the whole valley goes orange for about four minutes. Watch.'],
        ['Shh. Wait. There — twice, off the rim.']);
      // ACKNOWLEDGED, AT THE MOMENT AND NOT AFTERWARDS. gorSaysNow is the
      // town's line for when you come back down; the marquee itself had nobody
      // speaking into it. The chief is on the radio and 116 m below.
      gorCall('chief', 'sunrise', 'There it is. Look east and do not look at anything else.', 999);
      gorSfx('chime', { volume: 1.0, pitch: 1.5, force: true,
                        at: { x: gorBalX, y: gorBalY, z: gorBalZ } });
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
    // the flight is over: one number for how high it got. See gorPeakAlt.
    gorFlushPeak(game);
    if (d < 6.5 && !gorLandDone) {
      gorLandDone = true;
      gorTask('on-the-trailer');
      gorToast('on the trailer. first time. the crew are not impressed, but they are lying.');
      gorSaysNow('chase',
        ['I got there first. That is my entire job and I did it.',
         'Do you know how many I have watched go into a vineyard? Do not ask.',
         'Right. In the back, both of you, and hold the ropes.',
         'My father is going to want to shake something. A paw. Whatever you have.'],
        ['We can hear you. The gate crew can hear you. Kayseri can hear you.']);
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
  // THE DAWN HURRIES FOR YOU (W4). A full-burn climb is 32 s and the window
  // is 11 s in a 156 s cycle: a player who got up early was hanging at
  // altitude for two minutes with the burner going. Aboard, above 40 m and
  // with the sun still under the rim, the sky runs at four times — a
  // time-lapse of the light coming, nothing snaps — until the ramp begins.
  {
    let rate = 1;
    if (!gorSunDone && gorAboard && gorPhase < gorSUN_P - 0.01 && gorPhase > 0.2) {
      const alt = gorBalY - gorTerrain(gorBalX, gorBalZ);
      if (alt > 40) rate = 4;
    }
    gorPhase += dt * rate / gorCYCLE;
  }
  if (gorPhase >= 1) { gorPhase -= 1; gorWarned = false; gorToldLayer = -1; gorSyncSaid = false; }

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
let gorEnvDone = false, gorEnvOn = -1;
// the two ends of the run the player has actually covered — see gorCheckField
let gorEnvLo = 0, gorEnvHi = 0;
let gorMouthDone = false, gorMouthT = 0;
// the fan, which comes up while you are standing inside the throat
let gorMouthRoar = 0;

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
    // ---- A SPAN, NOT A DISPLACEMENT FROM WHERE YOU STEPPED ON -----------
    // The old test anchored on the point of first contact and asked for eleven
    // metres of travel away from it. The fabric run is fifteen metres and the
    // test band is |along| < 7.6, so the reachable displacement from an anchor
    // at `a` is at most 7.6 + |a| — which means STEPPING ON ANYWHERE IN THE
    // MIDDLE SEVEN METRES MADE THE TASK IMPOSSIBLE. Walk up it, walk back down
    // it, walk it forty times: 7.6 is not 11 and never becomes 11. The only
    // way out was to leave the fabric entirely and step back on at an end,
    // which nothing tells you and nobody would think of.
    //
    // What "walk its whole length" actually means is that the FURTHEST APART
    // two points you have stood on are most of the length, which is a span —
    // it cannot dead-end, it does not care where you got on, and walking up
    // and back counts the same as walking up, which is what a crew checking
    // for tears does anyway.
    if (on < 0) { gorEnvOn = -1; }
    else if (gorEnvOn !== on) { gorEnvOn = on; gorEnvLo = gorEnvHi = gorCrewOut.along; }
    else if ((gorEnvLo = Math.min(gorEnvLo, gorCrewOut.along),
              gorEnvHi = Math.max(gorEnvHi, gorCrewOut.along),
              gorEnvHi - gorEnvLo) > 11) {
      gorEnvDone = true;
      gorTask('the-envelope');
      gorSfx('rustle', { volume: 0.55, pitch: 0.85 });
      gorToast('the first job of every morning: walk it, and look for tears.');
    }
  }

  // ---- inside the mouth of one that is filling ---------------------------
  // NOT `if (gorMouthDone) return` — the throat is a PLACE and it goes on
  // being one after the box is ticked. Ticking a task is not a reason for a
  // room to go silent.
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
  // ---- AND IT IS A PLACE, NOT A TRIGGER VOLUME ---------------------------
  // The only interior in the chapter, and standing in it did nothing for a
  // second and six tenths and then ticked a box. What it is actually like
  // inside the throat of a filling envelope is that the fan is behind you and
  // everything in front of you is lit through fifteen metres of coloured
  // nylon — it is the loudest and the most colourful place in Cappadocia at
  // ten past five, and it lasted about four minutes a morning.
  //
  // So the fan comes up while you are in there, on a ramp rather than a
  // switch, and it is the one sound in the chapter that gets LOUDER the longer
  // you stand still — which is the whole joke of the place.
  if (gorMouthT < 6.0 && gorMouthRoar <= 0) {
    gorMouthRoar = rand(0.34, 0.52);
    gorSfx('burner', { volume: clamp(0.10 + gorMouthT * 0.10, 0.08, 0.34),
                     pitch: rand(1.15, 1.5) });
  }
  if (gorMouthRoar > 0) gorMouthRoar -= dt;
  if (gorMouthT > 1.6 && !gorMouthDone) {
    gorMouthDone = true;
    gorTask('the-mouth');
    gorSfx('burner', { volume: 0.65, pitch: 0.5 });
    gorToast('a cold nylon cave the size of a bus, and it is filling up.');
    gorSaysNow('crew',
      ['Everybody goes in there once. Nobody says anything while they are in there.',
       'Fifteen metres of it and it is all one piece. One.',
       'When she stands up, you come out. Not before, and not after.'],
      ['In THERE? You shouted in THERE? Was it good?']);
    if (typeof gorGame.shake === 'function') gorGame.shake(0.07);
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
// ---- WHAT THEY SAY NOW GOES IN FRONT OF WHAT THEY ALWAYS SAY (M3) --------
//
// This was `r.lines = lines`, and it DELETED a person's whole pool, for the
// rest of the session. Chapters build once (`if (gorBuilt) return`) and nothing
// ever prunes `locals`, so the loss is permanent the first time a set piece
// fires — which in this chapter is the first time a balloon lands, about four
// minutes in.
//
// It is the older of two mechanisms in this file for the same job. It was
// written before `localResolve` grew `before` / `after` / `when`, when a
// person's lines genuinely were a fixed bag of three sentences and replacing
// them was the only way to make somebody react; the conditional pools arrived
// later, went into the same records, and have been quietly eaten ever since.
//
// The tea seller at the bottom of this file has five authored lines, two of
// them `{ after: ... }` payoffs that only exist because the player did
// something. Land one balloon and all five are gone and she has three. NINE OF
// THIS CHAPTER'S TEN LOCALS are overwritten by the thirteen call sites below.
//
// The original is stashed once, on the record, and everything after is
// additive: newest event's lines first, the permanent pool behind them. Repeat
// calls are correct and cannot grow without bound, because `lines0` is only
// ever taken from the pool as authored.
//
// The same fault, the same fix, in `manSaysNow` and `panSaysNow`.
function gorSaysNow(who, lines, wheek) {
  const r = gorLocals[who];
  if (!r) return;
  if (r.lines0 === undefined) { r.lines0 = r.lines || []; r.wheek0 = r.wheekLines || []; }
  if (lines) r.lines = lines.concat(r.lines0);
  if (wheek) r.wheekLines = wheek.concat(r.wheek0);
}

/**
 * SOMEBODY SAYS SOMETHING ABOUT WHAT IS ACTUALLY HAPPENING.
 *
 * `game.say(x, y, z, text)` is npc.js's one-liner-at-a-point. Manly and the
 * Pantanal call it; Cappadocia — the chapter with ten locals, five crews and a
 * marquee the player spends two minutes suspended in the middle of — did not
 * call it once. A local's `lines` are a shuffle bag and cannot know anything:
 * they are what somebody says when you walk up to them, and for most of this
 * chapter you cannot walk up to anybody, because you are sixty metres above
 * them in a basket you cannot steer.
 *
 * Which is exactly why this chapter needs it more than the other two. A voice
 * from a point on the ground while you drift over it is the only thing up
 * there that tells you how high you are and how fast you are going — a bubble
 * that is small and behind you is a bubble you have passed.
 *
 * The rules are the ambient-mover rules, the same three the other two files
 * keep: per-key cooldowns so nobody is a smoke alarm, one voice in the valley
 * at a time, and every line is CAUSED rather than scheduled.
 */
/**
 * ...AND FROM WHERE THE SPEAKER ACTUALLY IS (D5.6).
 *
 * `at` is an optional {x, y, z}. Without it the line comes from the local's
 * registration point, which is right for the nine people in this chapter who
 * stand still. It is wrong for exactly one of them: the chase driver, who is
 * DRIVING. His two lines — "You are a speck" and "I am right underneath you"
 * — were both drawn at the landing plain where his record is registered
 * (:5693), wherever the truck happened to be, and the second one says out
 * loud that he is underneath you. The truck's whole job is to be somewhere
 * else.
 */
const gorSaid = {};
let gorSayCool = 0;
function gorCall(who, key, text, cool, at) {
  if (gorSayCool > 0) return false;
  const g = gorGame;
  if (!g || typeof g.say !== 'function') return false;
  const r = gorLocals[who];
  if (!r && !at) return false;
  const t = gorSaid[key];
  if (t !== undefined && gorTime - t < (cool || 45)) return false;
  gorSaid[key] = gorTime;
  gorSayCool = 3.4;
  const x = at ? at.x : r.x, y = at ? at.y : r.y, z = at ? at.z : r.z;
  try { g.say(x, y, z, text); } catch (e) {}
  return true;
}

/** Where the chase driver is right now — the cab, not his registration point. */
function gorTruckAt() {
  return { x: gorTruckX, y: gorTerrain(gorTruckX, gorTruckZ) + 1.75, z: gorTruckZ };
}

/**
 * THE VALLEY, TALKING. Nine causes, and not one of them is on a clock.
 *
 * Ordered as an if/else ladder rather than nine independent tests on purpose:
 * a chapter where three people shout at once is a chapter with a crowd in it,
 * and this one is meant to be five in the morning.
 */
function gorUpdateVoices(game, dt) {
  if (gorSayCool > 0) gorSayCool -= dt;
  const capy = game.capy;
  if (!capy || !capy.position) return;
  const p = capy.position;
  const alt = gorBalY - gorTerrain(gorBalX, gorBalZ);

  if (gorAboard && gorBalBurn > 0.5 && alt > 4 && alt < 26) {
    // the crew chief, watching his own balloon go, which is the one moment in
    // this chapter that somebody on the ground is definitely looking at you
    gorCall('chief', 'launch', 'Hands off the rope. Choose a height and stay in it!', 120);
  } else if (gorAboard && alt > 150) {
    gorCall('chase', 'high', 'You are a speck. I can see you and you are a speck.', 90,
            gorTruckAt());
  } else if (gorAboard && Math.hypot(gorBalX + 26, gorBalZ + 52) < 34 && alt < 55) {
    // the vine man, directly underneath, and what everybody who works a field
    // says to a balloon that is thirty metres over it
    gorCall('vine', 'vines', 'Higher! HIGHER! Not over the vines!', 100);
  } else if (gorAboard && !gorLandDone &&
             Math.hypot(gorBalX - gorTruckX, gorBalZ - gorTruckZ) < 14 && alt < 34) {
    gorCall('chase', 'under', 'I am right underneath you. Come down. Come DOWN.', 55,
            gorTruckAt());
  } else if (gorPigeonOut > 0.55) {
    gorCall('dovecote', 'birds', 'Eight hundred years and none of them has ever seen one of you.', 70);
  } else if (gorSpook > 2.4 && Math.hypot(p.x - gorHERD_X, p.z - gorHerdZ) < 60) {
    gorCall('horse', 'spook', 'She heard you. Look at her go. She never does that for me.', 70);
  } else if (!gorSunDone && !gorAboard && gorPhase > gorSUN_P - 0.18 && gorPhase < gorSUN_P) {
    // the one piece of information the chapter withholds and should not: the
    // sun is minutes away and you are standing on the ground.
    //
    // AND IT HAS TO ARRIVE IN TIME TO BE ACTED ON. At 0.075 it landed 15.3 s
    // before gorSUN_P, and the payout gate is a further 10.9 s after that, so
    // it bought 26 s — against a measured 32 s for a full-burn climb from the
    // field to the 55 m the row requires, before the run to the balloon. A
    // warning you cannot beat is not a warning. 0.18 is 37 s, so the whole
    // thing is 48 s and the tea man is telling the truth.
    gorCall('tea', 'hurry', 'Ten minutes. If you are going up, go up NOW.', 200);
  } else if (gorMouthDone && !gorAboardDone && gorInZone('field', p.x, p.z)) {
    gorCall('crew', 'nudge', 'That one is ours. That one over there is nobody’s.', 90);
  } else if (gorEnvDone && !gorMouthDone && gorInZone('field', p.x, p.z)) {
    gorCall('crew', 'fan', 'Fan is on. Go and stand inside it. Everybody does it once.', 90);
  }
}

function gorTask(id) {
  const g = gorGame;
  if (g && typeof g.completeTask === 'function') { try { g.completeTask(id); } catch (e) { warnOnce('goreme.completeTask', e); } }
}
function gorToast(t) {
  const g = gorGame;
  if (g && typeof g.toast === 'function') { try { g.toast(t); } catch (e) { warnOnce('goreme.toast', e); } }
}
/**
 * THE SAME LINE, IN THE SCHEME THE PLAYER IS HOLDING (F1). See palSay.
 *
 * Two sentences in this chapter hand over a control — the burner, which is the
 * only thing you can do in a balloon, and the callback to Hong Kong's climb on
 * the soft rock. Both named a key.
 */
function gorSay(t) {
  const g = gorGame;
  // THROUGH game.control, NOT game.say (W3). `game.say` is npc.js's
  // sayAt(x, y, z, text): the sentence landed in x, text was undefined, and
  // sayAt returned at its own `if (!text)` — so this line had never once
  // been drawn (the D5.2 bug in antarctic.js, in three more chapters).
  // `control` is the toast that runs the key-name substitution, which is
  // exactly what a sentence with "hold E" in it wants.
  if (g && typeof g.control === 'function') { try { g.control(t); } catch (e) { warnOnce('goreme.say', e); } }
  else gorToast(t);
}
function gorSfx(n, o) {
  // ALWAYS through the dispatcher, never a bare synth: it is what supplies the
  // default volume and pitch and what wraps every voice in a try/catch.
  const g = gorGame;
  if (g && typeof g.sfx === 'function') { try { g.sfx(n, o); } catch (e) { warnOnce('goreme.sfx', e); } }
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
let gorToldCall = false;      // C4: the herd-call line, once per visit
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
      // ...and the man at the other end of the same cliff, who had four lines
      // for the whole chapter and no idea any of this had happened.
      gorSaysNow('dovecote',
        ['Nine seconds. That is how long it takes to empty eight hundred years.',
         'They will be back. Not one of them will remember you. That is a pigeon.',
         'Count the holes if you like. Four hundred. I have counted them.',
         'You are the first thing that has come at this face that was not a hawk.'],
        ['Once was funny. Twice is a man in the village asking what I am doing.',
         'They have only just gone back in. Look at them. Look what you did.']);
      if (typeof game.shake === 'function') game.shake(0.13);
    }
  }

  // ---- the herd ----------------------------------------------------------
  // ---- C4: AND YOU CAN CALL THEM (D3) ------------------------------------
  //
  // The mare is the best kinetic thing in this chapter — eleven horses running
  // a 86 m shuttle at 6.2 m/s with a rideable kinematic body on the lead one —
  // and the only way to get on it was to stand at one end of the line and wait
  // out a nine-second dwell plus however much of the run was left. A twenty-
  // three second intercept, in a chapter whose whole subject is a thing that
  // leaves at a fixed time.
  //
  // The wheek already reaches them: the spook test three lines down has been
  // 45 m since the herd was written. This is the SAME TEST doing one more
  // thing — if they are standing at the end of the line, the wait ends now.
  //
  // NOT A SUMMONS. It does not change where they go, how fast, or which way,
  // and it cannot be used to hold them: it only spends the dwell they were
  // going to spend anyway. A player who wheeks at the wrong end still watches
  // them go the wrong way, which is the joke and is worth keeping.
  const herdD = Math.hypot(p.x - gorHERD_X, p.z - gorHerdZ);
  if (herdD < 45) {
    gorSpook = 4.0;
    if (gorHerdWait > 0.35) {
      gorHerdWait = 0.3;                    // ...and they go on the next beat
      gorSfx('wheek', { volume: 0.16, pitch: 0.72 });
      if (!gorToldCall) {
        gorToldCall = true;
        gorToast('they were waiting for something. apparently that was it.');
      }
    }
  }

  // ---- and every cat in the square looks up ------------------------------
  // Nine of them, all at once, deciding it was not worth getting to their feet
  // for. The cheapest laugh in the chapter and it costs one number each.
  {
    let heard = 0;
    for (let i = 0; i < gorCats.length; i++) {
      const c = gorCats[i];
      const dx = c.x - p.x, dz = c.z - p.z;
      if (dx * dx + dz * dz < 26 * 26) { c.look = rand(2.4, 4.2); heard++; }
    }
    if (heard >= 4 && !gorToldCats) {
      gorToldCats = true;
      gorToast('every cat in the square. not one of them got up.');
    }
  }

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
        // ---- AND THE TWO PEOPLE WHO CAN SEE IT FROM WHERE THEY STAND ----
        // The potter's yard looks straight up the valley and the vine man
        // works underneath them. Both had a fixed bag of three sentences for
        // the whole chapter, whatever the capybara had done in front of them.
        gorSaysNow('potter',
          ['You went up one. The clay in this yard used to be at the top of one of those.',
           'Soft rock. That is the whole trick. It is soft until it is not.',
           'Do not tell me you did it with your teeth. I do not want to know.'],
          ['You are up a rock and you are shouting. Enjoy yourself.']);
        gorSaysNow('vine',
          ['I saw that from down here. Everybody in the valley saw that from down here.',
           'The boulder on the top is what saved it. That is the only reason it is a chimney.',
           'Now come down before you learn what the other side of it is like.'],
          ['Yes. Very good. Now come down.']);
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
          gorSay('hold E against the soft rock. you have done this before.');
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
  // ---- AND EVENTUALLY IT IS GONE, WHICH IS THE POINT OF CUTTING IT --------
  // The lift ran for the whole of the rest of the session: an eleven-by-five-
  // by-seven-metre SOLID BOX damping asymptotically toward a hundred and
  // twenty metres, resynced into the broadphase every frame, with a group over
  // it whose rotation was rewritten sixty times a second. It never arrives —
  // damp() approaches and does not reach — so nothing ever switched it off,
  // and a balloon flown up the middle of the valley could still put its basket
  // into an invisible-by-then wall a hundred and nineteen metres up.
  //
  // Cappadocia's own local has the answer: "it will come down somewhere near
  // Kayseri." Past a hundred metres it has left, so it leaves: the collider
  // comes out of the world, the group is hidden, and the work stops.
  if (gorTetherCut && gorTetherGone) { /* over the ridge and out of the chapter */ }
  else if (gorTetherCut && gorTetherGroup) {
    gorTetherY = damp(gorTetherY, 132, 0.25, dt);
    if (gorTetherY > 104) {
      gorTetherGone = true;
      gorTetherGroup.visible = false;
      if (gorTetherBody && game.world &&
          game.world.bodies.indexOf(gorTetherBody) >= 0) {
        try { game.world.removeBody(gorTetherBody); } catch (e) {}
      }
      return;
    }
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
      gorSun = 0; gorDawnLit = 0; gorWarned = false; gorSyncSaid = false;
      // D4.3: a fresh dawn is a fresh burn, a fresh nag and a fresh flock.
      gorSunBurned = false; gorSunNagged = false; gorSunDoves = false;
      // C4: and a fresh call. The toast is the only thing that tells a player
      // the wheek reaches the horses at all, so a second visit gets it again.
      gorToldCall = false;
      // ---- C1: AND THE NEAR BALLOON IS BACK ON ITS PAD -------------------
      // A fresh dawn is a fresh launch, which is the rule the three lines
      // above follow. It is also the one thing in this reset that has to put a
      // CANNON body back: gorUpdateFieldLaunch takes the basket collider out
      // of the world once the basket is over head height, and a second visit
      // that did not re-add it would find the one hoppable thing on the field
      // had become scenery. Re-added rather than kept and moved, because a
      // solid box parked at ninety metres is worse than no box at all.
      if (gorFieldLaunch) {
        gorFieldLaunchY = 0;
        gorFieldLaunch.position.set(gorFieldLaunchX0, 0, gorFieldLaunchZ0);
        gorFieldLaunch.rotation.set(0, 0, 0);
        gorFieldLaunchSaid = false;
        if (!gorFieldLaunchBody && gorFieldLaunchPad) {
          const q = gorFieldLaunchPad;
          gorFieldLaunchBody = gorStaticBox(gorGame, q.x, q.y, q.z, q.sx, q.sy, q.sz, q.ry);
        } else if (gorFieldLaunchBody && gorFieldLaunchPad) {
          gorFieldLaunchBody.position.set(gorFieldLaunchPad.x, gorFieldLaunchPad.y,
                                          gorFieldLaunchPad.z);
          gorSyncBody(gorFieldLaunchBody);
        }
      }
      gorTime = 0;
      gorBalX = gorFIELD.x; gorBalZ = gorFIELD.z - 6;
      gorBalY = gorTerrain(gorBalX, gorBalZ);
      gorBalVX = 0; gorBalVY = 0; gorBalVZ = 0;
      gorBalBurn = 0;
      // ---- AND THE BASKET'S OWN LAST POSITION, WHICH WAS NEVER PUT BACK ----
      // The kinematic velocity is differenced against these three numbers, and
      // they still held wherever the flight ENDED. Come back to the chapter
      // having last set the balloon down at the far end of the valley a
      // hundred and fifty metres up and the first frame handed the contact
      // solver a basket doing about nine thousand metres a second — one frame,
      // enough to fling anything touching it out of the world. Also the first
      // frame of the chapter's whole life, where they were (0, 0, 0).
      gorBasketPX = gorBalX; gorBasketPY = gorBalY + 0.12; gorBasketPZ = gorBalZ;
      if (gorBasketBody) {
        gorBasketBody.velocity.set(0, 0, 0);
        gorBasketBody.position.set(gorBasketPX, gorBasketPY, gorBasketPZ);
        gorSyncBody(gorBasketBody);
      }
      gorPeakAlt = 0; gorCeilT = 0;
      // main.js re-adds every body a biome ever made when the chapter is
      // attached again, which would put the cut tether's eleven-metre collider
      // back into the sky at a hundred metres with nothing drawn on it and
      // nothing left running to move it.
      if (gorTetherGone) {
        if (gorTetherGroup) gorTetherGroup.visible = false;
        if (gorTetherBody && game.world &&
            game.world.bodies.indexOf(gorTetherBody) >= 0) {
          try { game.world.removeBody(gorTetherBody); } catch (e) {}
        }
      }
      gorAboard = false; gorAboardT = 0; gorEmptyT = 0; gorGroundedT = 0;
      gorCarrying = false; gorCarry.x = 0; gorCarry.z = 0;
      gorTruckX = 20; gorTruckZ = 10; gorTruckYaw = 0;
      gorTrailerCarrying = false; gorRideHome = false; gorRideT = 0;
      gorTrailerPX = gorTruckX; gorTrailerPZ = gorTruckZ + 2.4;
      gorChaseX = 20; gorChaseZ = 10;
      gorToldLayer = -1;
      gorSayCool = 0;
      for (let i = 0; i < gorCats.length; i++) {
        const c = gorCats[i];
        c.x = c.hx; c.z = c.hz; c.tx = c.hx; c.tz = c.hz;
        c.look = 0; c.st = i % 3 === 2 ? "flop" : "sit"; c.t = rand(2, 16);
      }
      for (const k in gorSaid) delete gorSaid[k];
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
      gorHerdRideT = 0; gorHerdBell = 0; gorHerdOffT = 0; gorMareCarry = false;
      gorHerdBunch = 0;
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
      // A declared frame that survives travel is a capybara in Antarctica
      // being driven sideways by a horse in Cappadocia.
      gorMareCarry = false; gorHerdRideT = 0; gorHerdOffT = 0;
      gorPeakAlt = 0; gorCeilT = 0;
    },
  });

  const api = {
    built() { return gorBuilt; },
    terrainHeight: gorTerrain,
    /**
     * C1, C3, C4 and C5, measured. Nothing in the game calls it — the
     * walkAudit footing. `launchY` is how far the near balloon is off its own
     * pad, `launchBody` whether its collider is still in the world, `herdWait`
     * the dwell C4 spends, and `lured`/`lureT` the state of C5's ring.
     */
    fieldDebug() {
      let down = 0;
      if (gorPigeonData && gorLureT > 0) {
        for (let i = 0; i < gorLURE_N && i < gorPIGEON_N; i++) {
          const o = i * 10;
          const dy = gorPigeonData[o + 1] - gorTerrain(gorPigeonData[o], gorPigeonData[o + 2]);
          if (dy < 0.9) down++;
        }
      }
      return {
        phase: Math.round(gorPhase * 1000) / 1000,
        goAt: Math.round(gorFIELD_GO * 1000) / 1000,
        launchY: Math.round(gorFieldLaunchY * 100) / 100,
        launchBody: !!gorFieldLaunchBody,
        launchX: gorFieldLaunch ? Math.round(gorFieldLaunch.position.x * 10) / 10 : null,
        beacon: !!(gorTruck && gorTruck.userData && gorTruck.userData.beacon),
        herdWait: Math.round(gorHerdWait * 100) / 100,
        herdZ: Math.round(gorHerdZ * 10) / 10,
        lureT: Math.round(gorLureT * 10) / 10,
        onTheGround: down,
        pigeonOut: Math.round(gorPigeonOut * 100) / 100,
        // where the things a probe has to stand next to actually are
        // C1: the group must carry BOTH the envelope and the merged rig, or
        // the bag has flown off its own basket. Two children, and the world
        // y of the lowest vertex of each, so a detachment is arithmetic.
        launchParts: gorFieldLaunch ? gorFieldLaunch.children.length : 0,
        launchEnvY: (gorFieldLaunch && gorFieldLaunch.children[0])
          ? Math.round((gorFieldLaunch.position.y + gorFieldLaunch.children[0].position.y) * 100) / 100 : null,
        launchRigY: (gorFieldLaunch && gorFieldLaunch.children[1])
          ? Math.round((gorFieldLaunch.position.y + gorFieldLaunch.children[1].position.y) * 100) / 100 : null,
        herdX: gorHERD_X,
        cliffX: gorCLIFF.x, cliffZ: (gorCLIFF.z0 + gorCLIFF.z1) * 0.5,
      };
    },
    /** Bring the doves down at a point, so C5 can be measured without a chip. */
    lureDoves(x, z) { return gorPigeonLand(x, z); },
    /** Drive the dawn clock straight to a phase, so C1 needs no 40 s wait. */
    setPhase(p) { gorPhase = clamp(p, 0, 0.999); return gorPhase; },
    // ---- HOW LONG THE GROUND IS GOING TO LAST (P3) ----------------------
    // The window that ticks `sunrise` is gorPhase 0.5235..0.5804 — about
    // eleven seconds of a hundred and fifty-six — and the comment on that gate
    // calls it "cruel to anyone still on the ground", because a full-burn climb
    // from the field to the 55 m this needs measures thirty-two seconds. The
    // paper never said how long there was. This is that number, and it is the
    // same one the burners already synchronise to.
    nextIn(id) {
      if (id !== 'sunrise') return -1;
      if (gorSun > 0.465 && gorSun < 0.96) return 0;         // it is happening
      let d = gorSUN_P - gorPhase;
      if (d < 0) d += 1;                                     // it is next time round
      return d * gorCYCLE;
    },
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
    carryFrame() {
      if (gorCarrying) return gorCarry;
      // ...and the bell mare, who is the chapter's other moving floor and was
      // relying on the contact sweep alone. See gorUpdateHerd.
      if (gorMareCarry) return gorCarryM;
      // ...and the chase truck's trailer, which is the ride home. See
      // gorTrailerRide.
      if (gorTrailerCarrying) return gorTrailerCarry;
      return null;
    },

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
      gorTrailerRide(game, dt);
      gorCheckField(game, dt);
      gorUpdateWheek(game, dt);
      gorUpdateHerd(game, dt);
      gorUpdateDecor(dt);
      gorUpdateFieldLaunch(game, dt);   // C1: the near one leaves the ground
      gorUpdateShadows();
      gorUpdateFieldBurners(dt);
      gorUpdateWisps(dt);
      gorUpdatePigeons(dt);
      gorUpdateCats(game, dt);
      gorUpdateGroundSound(game, dt);
      gorUpdateTasks(game, dt);
      gorUpdateVoices(game, dt);
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
    // SIZED TO THE COLLIDER, WHICH IS BIGGER THAN THE PICTURE WAS. The
    // heightfield covers x -160..180 and z -200..130; this plane was 320 x 320
    // about (20, -30), i.e. x -140..180 and z -190..130, so a 20 m band down
    // the west side and a 10 m band along the south were floor with nothing
    // drawn over them. Now 340 x 330 about (10, -35), which is exactly the
    // field.
    //
    // gorWarp maps [-half, +half] onto itself (s = +-1 gives back +-half), so
    // the half HAS to move with the extent - leave it at 160 and every new
    // vertex clamps onto the old edge, collapsing the margin to a crease. The
    // heights still come from gorTerrain(x, z), so this is the same surface
    // sampled at slightly different points; the only visible effect is that
    // the detail the warp concentrates sits ~6 % differently across the valley.
    const g = new THREE.PlaneGeometry(340, 330, 106, 103);
    g.rotateX(-Math.PI / 2);
    g.translate(10, 0, -35);
    const p = g.attributes.position.array;
    // ...and it is pulled toward the middle, where the valley is. See gorWarp.
    for (let i = 0; i < p.length; i += 3) {
      p[i] = gorWarp(p[i] - 10, 170) + 10;
      p[i + 2] = gorWarp(p[i + 2] + 35, 165) - 35;
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
      // THE SIZES ARE HOISTED SO THE BOX AND THE CONE ARE THE SAME THING.
      // They were not: the shoulder was drawn as a cone of base radius 20–28
      // and made solid as a box 26 wide, so between eighteen and twenty-three
      // metres of its western skirt was rock you walked through. Measured, that
      // was ten of Goreme's forty-one walk-through hits, all of them in the
      // band x 75–85 where the toe of the range comes down. The rule the
      // extents section of ../SKILL.md gives for rand() applies to a taper's
      // radius exactly as it does to a box's width.
      const spRb = 22 + rnd() * 9, spRt = 5 + rnd() * 6;
      N.taper(x, h * 0.44, z, spRb, spRt, h * 0.88,
              PALETTE.gorTuffShadow, rnd() * 3);
      // a shoulder in front of it, lower and warmer, which is the only thing
      // that gives a fully backlit range any modelling at all
      const shX = x - 17 - rnd() * 6, shZ = z + rnd() * 5;
      const shRb = 20 + rnd() * 8, shRt = 8 + rnd() * 5, shH = h * 0.60;
      N.taper(shX, h * 0.30, shZ, shRb, shRt, shH, PALETTE.gorTuffDk, rnd() * 3);
      // TWO BOXES PER CONE, not one, and the WIDE one is the LOW one. A cone is
      // nearly its full base radius for the first few metres and a fraction of
      // it at the top, so a single box either leaves the skirt hollow — which
      // is the bug — or, if it is widened to the base, hangs a sixty-metre
      // invisible wall over the range at the height the BALLOONS fly. The tall
      // narrow boxes are exactly as they shipped; only the skirt is new.
      gorPoolBox(ridgeBody, x - 3, h * 0.44, z, 34, h, 9);
      gorPoolBox(ridgeBody, x - 20, h * 0.30, z, 26, h * 0.6, 9);
      // ...and the skirt is ONE box per cone, 1.86 rb across. See the chimney
      // note in gorBuildValley for why the 45-degree twin was removed again.
      gorPoolBox(ridgeBody, x, 3.4, z, spRb * 1.86, 7.0, spRb * 1.86);
      gorPoolBox(ridgeBody, shX, 3.4, shZ, shRb * 1.86, 7.0, shRb * 1.86);
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
  gorBuildCats(gorRoot);
  gorBuildScatter(game, gorRoot);
  gorBuildCliff(game, gorRoot);
  gorBuildTether(game, gorRoot);
  gorBuildField(game, gorRoot);
  gorBuildTruck(gorRoot);
  gorBuildTrailerBody(game);
  gorBuildDust(gorRoot);
  gorBuildHerd(game, gorRoot);
  gorBuildBalloon(game, gorRoot);
  gorBuildDecor(gorRoot);
  gorBuildShadows(gorRoot);
  gorBuildWisps(gorRoot);
  gorBuildSky(gorRoot);
  // AFTER every builder that draws a person, and inside the same capture tag —
  // see gorFigSolid. The town's tea drinkers come out of gorBuildTown and the
  // crews out of gorBuildField, so there is exactly one right place for this
  // and it is here.
  gorBuildFigureBodies(game);

  // ---- THE PEOPLE WHO LIVE HERE ------------------------------------------
  // See npc.js, THE LOCALS. Each of these is a point somebody is standing at,
  // a few things they might say when the capybara turns up, and a different
  // few for when it wheeks at them. Where the chapter owns a Group for the
  // figure, it is handed over too and the figure turns to watch.
  if (typeof game.addLocal === 'function') {
    gorLocals.chief = game.addLocal({ biome: 'goreme', x: gorFIELD.x + 6, y: gorTerrain(gorFIELD.x + 6, gorFIELD.z),
      z: gorFIELD.z, near: 8,
      // THE AUTHORITY (L3, F1): the man who runs the launch field is the one
      // who carries a nuisance off it. See npc.js.
      authority: true, role: 'the field marshal',
      figure: { shirt: PALETTE.hiVis, legs: PALETTE.denim },
      // ---- AND SOME OF IT DEPENDS ON WHAT YOU HAVE DONE (see localResolve
      // in npc.js). Cappadocia used the conditional-line system in exactly
      // nought places, which meant the man who runs the launch field said the
      // same three sentences to an animal who had never seen a balloon and to
      // one who had ridden three winds and put it down on his trailer. A
      // `before:` line is the thing they say while you are still a stranger; an
      // `after:` line is the thing they can only say once it has happened.
      lines: [
              // ---- THEY HAVE HEARD ABOUT YOU (L3, E3): one line keyed on a wow elsewhere
              { t: 'Rode a manta. Fine. A manta has no basket to fall out of.', after: 'the-manta' },
              'We do not steer. Nobody steers. We choose a height.',
              'Wind goes one way down low and the other way up high.',
              { t: 'In the basket, please. Both feet. All four feet.', before: 'aboard' },
              { t: 'You have been in one now. So you know.', after: 'aboard' },
              { t: 'Three winds. You found all three. Most pilots take a season.', after: 'three-winds' },
              { t: 'Nobody has ever put one down on that trailer first go. Nobody.', after: 'on-the-trailer' }],
      wheek: ['Careful — the burner is louder and it is right there.'],
      praise: ['Right. Noted. Carry on.',
               'You are going to be a story I tell at the tea house.',
               'Not on my field, whatever it was.'],
      onTask: { 'aboard': ['Both feet in. All four. Good.'],
                'the-envelope': ['You walked it. Did you find anything? No. Nobody ever does.'],
                'three-winds': ['Three. That is the whole trade, that is.'],
                'sunrise': ['You were up there for it. Nothing I can add to that.'],
                'on-the-trailer': ['On the trailer. I watched. I said nothing.'],
                'the-tether': ['That is coming out of somebody’s wages. Not mine.'] } });
    gorLocals.town = game.addLocal({ biome: 'goreme', x: gorPLAZA.x + 5, y: gorPLAZA.y, z: gorPLAZA.z, near: 7,
      figure: { shirt: PALETTE.cloth5, skin: PALETTE.skin2 },
      lines: ['Whole town is cut into the rock. Warm in winter.',
              'Five in the morning and everyone is awake. Every day.',
              { t: 'Look up. Go on. Look up.', before: 'sunrise' },
              { t: 'You were up there when it came over the rim. I saw you.', after: 'sunrise' },
              { t: 'The one on the end. That is the one you were on top of.', after: 'chimney-top' }],
      wheek: ['The valley gives that back to you twice.'],
      praise: ['In MY square. At five in the morning.',
               'I will be telling people about that all day.',
               'Well. That is new.'],
      onTask: { 'chimney-top': ['On top of one! People pay money to look at those.'],
                'sunrise': ['Everybody in this town stops for that. Everybody. Every day.'],
                'dovecote': ['I heard that from here. The whole cliff went up.'] } });

    // ---- AND FIVE MORE. Two people in a town of twenty-two houses, a launch
    // field with five crews on it and four hundred pigeon holes is the
    // emptiest cast in the game after the Drift, and the Drift's emptiness is
    // the point of the Drift.
    // gorPLAZA.y is what the square is FLATTENED TOWARD, not what the ground
    // is at any given point in it: the flattening is a smoothstep with a
    // radius, so ten metres out from the middle it has only got two thirds of
    // the way there. Ask the function.
    // ---- ...AND AGAIN (P6). See THE TRAVELLER in npc.js. ---------------
    if (typeof game.addTraveller === 'function') {
      gorLocals.trav = game.addTraveller({ biome: 'goreme',
        x: gorPLAZA.x + 3.2, y: gorPLAZA.y, z: gorPLAZA.z - 5.5, face: 0.4,
        lines: ['Of course. Of course you are here.',
                'I have stopped asking. I have genuinely stopped asking.',
                'I booked this three months ago. You just turned up.',
                { t: 'You were in the balloon, were you not. I saw a shape.', after: 'sunrise' }],
        wheek: ['There it is. Every time.'] });
    }
    gorLocals.tea = game.addLocal({ biome: 'goreme', x: gorPLAZA.x - 8.4,
      y: gorTerrain(gorPLAZA.x - 8.4, gorPLAZA.z + 6.2), z: gorPLAZA.z + 6.2,
      near: 7,
      figure: { shirt: PALETTE.gorEnvE, legs: PALETTE.gorTuffDk, skin: PALETTE.skin2 },
      // pouring it from a height, because that is how
      beat: { kind: 'reach', every: 7.0, dur: 1.2, sfx: 'clink', volume: 0.09, pitch: 1.2 },
      lines: ['Sit. There is tea. There is always tea.',
              'We are here at five because they go up at five. Every day of my life.',
              { t: 'Two glasses. Then I go and look at the sky like everybody else.', before: 'sunrise' },
              { t: 'You have seen it now. Sit down. Second glass.', after: 'sunrise' },
              { t: 'He came in here talking about a rodent on his mare. That was you.', after: 'the-herd' }],
      wheek: ['Ha! Listen — there. And again. Told you.'],
      praise: ['Sit down. You have earned a glass and you are getting one anyway.',
               'Mm. Yes. Tea.',
               'I saw the whole thing through the window.'],
      onTask: { 'on-the-trailer': ['Two glasses for that one. Two.'],
                'sunrise': ['Now you know why nobody here sleeps in.'],
                'the-herd': ['On the MARE. He will not stop talking about that.'] } });

    gorLocals.potter = game.addLocal({ biome: 'goreme', x: 19, y: gorTerrain(19, 40.4), z: 40.4, near: 7,
      figure: { shirt: PALETTE.gorPot, legs: PALETTE.gorBasaltDk, skin: PALETTE.skin2 },
      // the wheel, and a hand coming down on it
      beat: { kind: 'work', every: 3.4, dur: 0.9, sfx: 'thud', volume: 0.10, pitch: 0.9 },
      lines: ['Avanos clay. Red as the valley, because it IS the valley.',
              'Seventeen out of the kiln, fourteen came through. Good week.',
              'Do not lean on that one. It is Thursday’s.',
              { t: 'Every bird off that cliff came over my racks. Every one.', after: 'dovecote' },
              { t: 'You have stood on top of the rock I dig out of. Bit strange, that.', after: 'chimney-top' }],
      wheek: ['Nothing in this yard is dry yet. Please.'],
      praise: ['If anything in this yard is cracked it was already cracked.',
               'Hands. I mean feet. Whatever you have. Off.',
               'That is going in the kiln with everything else, is it.'],
      onTask: { 'chimney-top': ['Up a chimney. The clay you are standing on used to be one of those.'],
                'the-tether': ['A rope? You chewed a ROPE? Do you know what rope costs?'],
                'dovecote': ['Every bird in the valley is over my drying racks. Thank you.'] } });

    gorLocals.dove = game.addLocal({ biome: 'goreme', x: gorCLIFF.x + 13, y: gorTerrain(gorCLIFF.x + 13, -42),
      z: -42, near: 8,
      figure: { shirt: PALETTE.gorEnvF, legs: PALETTE.gorTuffDk },
      lines: [{ t: 'My grandfather cut forty of those holes. On a rope. At night.', before: 'dovecote' },
              'The white patch is so the birds can find the door.',
              'Guano. That is what the vines are grown on. All of them.',
              { t: 'Forty of those holes were my grandfather’s. You emptied all four hundred.', after: 'dovecote' }],
      wheek: ['Well. There they all go.'],
      praise: ['Hm. The birds noticed. That is more than most people manage.',
               'Right in front of the holes, as well.',
               'You are a very strange pigeon.'],
      onTask: { 'dovecote': ['Four hundred, out of one noise. My grandfather would have thrown a boot.'],
                'chimney-top': ['That is the same rock. All of it is the same rock.'] } });

    gorLocals.crew = game.addLocal({ biome: 'goreme', x: gorFIELD.x - 12, y: gorTerrain(gorFIELD.x - 12, gorFIELD.z + 12),
      // D2: twenty crew figures on a launch field at five in the morning, in one
      // pose each. This is one of them, and he has a basket to walk to.
      walk: { dx: 8, dz: -5, dwell: 5 },
      z: gorFIELD.z + 12, near: 7,
      figure: { shirt: PALETTE.gorEnvD, legs: PALETTE.denim, hat: PALETTE.hiVis },
      lines: [{ t: 'Walk the length of it. Look for tears. Every single morning.', before: 'the-envelope' },
              'Fan first, then the burner. Never the other way. Never.',
              'Fifteen metres of nylon and it holds up four people. Think about that.',
              { t: 'You walked it. End to end. Found nothing, did you. Nobody ever does.', after: 'the-envelope' },
              { t: 'Cold in the mouth of one, isn’t it. Everybody goes quiet in there.', after: 'the-mouth' }],
      wheek: ['The fan is louder. You will not win.'],
      praise: ['Fine. Fine. As long as nothing tore.',
               'Sixteen years and that is a first.',
               'Do not do it near the fan.'],
      onTask: { 'the-envelope': ['End to end. Sixteen years I have done that walk. Every morning.'],
                'the-mouth': ['Cold in there, isn’t it. Everybody goes quiet in there.'],
                'aboard': ['Off you go then. Nobody is stopping you. Nobody ever does.'] } });

    gorLocals.horse = game.addLocal({ biome: 'goreme', x: gorHERD_X - 5.5, y: gorTerrain(gorHERD_X - 5.5, -70),
      z: -70, near: 8,
      figure: { shirt: PALETTE.gorCarpet, legs: PALETTE.gorBasaltDk, hat: PALETTE.gorTuffDk },
      lines: ['Katpatuka. The land of beautiful horses. That is the whole name.',
              { t: 'She wears the bell. The rest of them just follow the bell.', before: 'the-herd' },
              'Up the valley and back before the sun. They know it better than I do.',
              { t: 'She carried you. She has never carried me. I have asked.', after: 'the-herd' }],
      wheek: ['She has heard worse. She has heard me.'],
      praise: ['The horses saw that. They have opinions.',
               'Hm. Katpatuka.',
               'She did not even turn her head. That is a compliment.'],
      onTask: { 'the-herd': ['She let you stay on. Sixteen years and she has never let ME stay on.'],
                'chimney-top': ['We ride round those. Nobody rides UP one.'] } });
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
      // four hundred holes, one chisel
      beat: { kind: 'work', every: 2.9, dur: 0.75, sfx: 'tick', volume: 0.10, pitch: 0.7 },
      lines: ['Four hundred holes. My grandfather cut about eighty of them.',
              'Nobody eats the birds. It was never about the birds.',
              'You want to know why the grapes grow in a valley made of ash? That is why.',
              { t: 'They go out at first light and they are all back by nine.', before: 'dovecote' },
              { t: 'They went out an hour early because of you. They are still cross.', after: 'dovecote' }],
      wheek: ['Do that again and you will be picking them out of your teeth.',
              'Every single one of them looked at you. Did you see that?'],
      praise: ['Four hundred witnesses and not one of them will say a word.',
               'The birds have gone quiet. That never happens.',
               'You have upset something. I cannot tell you what.'],
      onTask: { 'dovecote': ['There they go. All of them. Nine seconds and the whole face is empty.'],
                'sunrise': ['They come off the rock when the light hits it. Same as you did.'] } });
    gorLocals.vine = game.addLocal({
      biome: 'goreme', x: -26, y: gorTerrain(-26, -52), z: -52, near: 8,
      figure: { shirt: PALETTE.gorEnvB, legs: PALETTE.gorSoil },
      lines: ['Before the sun. Always before the sun. After that it is not work, it is suffering.',
              'No wires, no posts. They hold themselves up. They have had two thousand years of practice.',
              'The wall is not mine. The wall was here. I just put the stones back on it.',
              'You are standing on a vine. You are standing on a hundred-year-old vine.',
              { t: 'Three times over my field. I stopped work for the third one.', after: 'three-winds' },
              { t: 'We all stop for it. Two minutes. Then back to the vines.', after: 'sunrise' }],
      wheek: ['Yes, yes. Very good. Now move.',
              'The dogs will start, and then the whole valley starts.'],
      praise: ['Yes. Very good. Now get off the vine.',
               'Two thousand years and it survived you as well.',
               'I am not going to ask.'],
      onTask: { 'sunrise': ['We stop for it. Every morning. Two minutes. Then back to work.'],
                'three-winds': ['You went over my field three times. I counted.'],
                'the-tether': ['Good. One less of them over my grapes.'] } });
    gorLocals.chase = game.addLocal({
      biome: 'goreme', x: gorLAND.x + 11, y: gorTerrain(gorLAND.x + 11, gorLAND.z + 8),
      z: gorLAND.z + 8, near: 9,
      figure: { shirt: PALETTE.gorTruck, legs: PALETTE.gorBasaltDk },
      lines: ['We do not catch them. We just get there first and hold the basket.',
              'My father drives. I open the gates. There are a lot of gates.',
              'Whichever way the wind is at four hundred feet — that is where I am going.',
              { t: 'If you come down out here, do not get out. Wait. Everybody gets out too early.', before: 'on-the-trailer' },
              { t: 'Straight onto the trailer. I did not have to move the truck once.', after: 'on-the-trailer' }],
      wheek: ['I heard that from the road.',
              'Save it for when you are up there. It goes a very long way from up there.'],
      praise: ['I have got the whole valley in a mirror. I saw that.',
               'Right. Noted. Getting back in the truck.',
               'Out here? Out HERE?'],
      onTask: { 'on-the-trailer': ['First go. Do you know how rare that is? It is rare.'],
                'three-winds': ['You made me turn round twice. That is a good flight.'],
                'sunrise': ['Best seat in the province and you were in it.'] } });
  }

  // ---- THE AUTHORITY, AND WHERE TO HIDE FROM THEM (L3, F1) ---------------
  // See THE HIDE in systems.js. Still inside one of these and the field
  // marshal walks to where you were and gives up. Every spot is beside a
  // thing the square or the valley already draws: under the tea house
  // canopy, behind the carpets on the rack, under the plane tree, in the
  // vine man's rows, at the foot of the dovecote cliff.
  if (typeof game.addHide === 'function') {
    game.addHide({ biome: 'goreme', x: gorPLAZA.x - 7.2, z: gorPLAZA.z + 4.4, r: 2.2, kind: 'under the canopy' });
    game.addHide({ biome: 'goreme', x: gorPLAZA.x + 6.7, z: gorPLAZA.z + 1.5, r: 1.8, kind: 'behind the carpets' });
    game.addHide({ biome: 'goreme', x: gorPLAZA.x + 9.9, z: gorPLAZA.z + 8.0, r: 2.0, kind: 'under the plane tree' });
    game.addHide({ biome: 'goreme', x: -26 + 1.5, z: -52, r: 2.4, kind: 'the vines' });
    game.addHide({ biome: 'goreme', x: gorCLIFF.x + 14, z: -42, r: 2.2, kind: 'the foot of the cliff' });
  }

  // ---- AND THREE CONVERSATIONS THAT ARE NOT WITH YOU ----------------------
  // THE CHAPTER WITH THE MOST PEOPLE IN IT HAD NO PAIR-CHAT AT ALL. Measured:
  // `addExchange` count for goreme was ZERO, against seven in Marrakech, six in
  // Iceland and five each in Rio, Kyoto, Kowloon and Cali — in a chapter that
  // carries eleven horses, five crews, a chase truck and twenty people. Every
  // voice here was addressed to the capybara, so a square with three pitches
  // inside fourteen metres of each other stood in silence unless you walked up
  // and faced somebody. Three pairs already stand inside npcCHAIN_R.
  if (typeof game.addExchange === 'function') {
    if (gorLocals.town && gorLocals.tea) {
      game.addExchange({ biome: 'goreme', a: gorLocals.tea, b: gorLocals.town, lines: [
        ['Twelve up already.', 'Fourteen. You always miss the two behind the church.'],
        ['Wind is wrong for the pigeons today.', 'Wind is wrong for you every day.'],
        ['Is that thing going up as well?', 'It has been in the field since first light.'],
        ['Nobody has landed on the road yet.', 'Give it an hour.'],
        ['Second glass?', 'Third. It is a long sunrise.'],
      ] });
    }
    if (gorLocals.town && gorLocals.potter) {
      game.addExchange({ biome: 'goreme', a: gorLocals.potter, b: gorLocals.town, gap: 34, lines: [
        ['The kiln is up. Do not lean on anything.', 'I have never leaned on anything of yours.'],
        ['They break more of them getting them down the steps than I break making them.',
         'Then stop making them at the top of the steps.'],
        ['Something has been at the drying rack.', 'Something has been at everything this week.'],
        ['Whose animal is that?', 'Nobody has come to claim it, so: everybody’s.'],
      ] });
    }
    if (gorLocals.chief && gorLocals.crew) {
      game.addExchange({ biome: 'goreme', a: gorLocals.crew, b: gorLocals.chief, gap: 30, lines: [
        ['Fan is at full.', 'Then stand it up. We are losing the light.'],
        ['How many are we taking?', 'However many are standing in the basket when I let go of the rope.'],
        ['Layer two is still going the wrong way.', 'Layer two is always going the wrong way. Go higher.'],
        ['Do we wait for it?', 'We do not wait for anybody. If it wants to come, it will be in the basket.'],
      ] });
    }
  }

  if (typeof game.registerShadowTarget === 'function') game.registerShadowTarget(gorRoot);
  // ...AND THEN TAKE IT BACK OFF THE THINGS THAT ARE NOT THERE.
  gorNoShadowOnGhosts(gorRoot);
}
