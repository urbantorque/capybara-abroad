import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PALETTE, mat, rand, randInt, clamp, damp, lerp, grain, makeSolidIndex, swayMesh, makeMerger, makeMover } from './shared.js';

// ===========================================================================
// CHAPTER 4 — KYOTO & UJI
//
// The fourth biome, and the first one built around QUIET. Sydney is loud
// because it is a holiday, Pasto is loud because it is a market, the harbour is
// loud because it is an engine. Kyoto is a wooded valley in soft haze where
// every single thing has been raked, trimmed, sited and maintained by somebody
// for several hundred years — and the entire comedy of the chapter is that a
// large damp rodent is now walking through the middle of it.
//
// The layout runs downhill, north to south, the way the real city does:
//
//        +----------------------------------------------+   z = -150
//        |  Fushimi Inari: the torii tunnel, up the hill |
//        |  Bamboo grove on the western flank            |
//        +----------------------------------------------+   z =  -40
//        |  Kinkaku-ji: the golden pavilion on its pond  |
//        |  The dry rock garden, raked, briefly          |
//        +----------------------------------------------+   z =   30
//        |  Gion: machiya, lanterns, stone lane          |
//        +----------------------------------------------+   z =   80
//        |  The Uji river, the bridge, the tea houses    |
//        |  Matcha terraces, the mill, the giant bowl    |
//        +----------------------------------------------+   z =  200
//
// Terrain is NOT flat: the shrine hill climbs to about 34 m in the north and
// the valley falls away gently to the river in the south. `kyoTerrain(x, z)` is
// the authority and it is analytic, cheap, and matched by a CANNON heightfield.
//
// Everything is prefixed `kyo` (contract: the bundler flattens every module
// into one scope).
// ===========================================================================

// ------------------------------------------------------------- geography ----
const kyoHILL_X = -34, kyoHILL_Z = -128;      // the shrine hill's summit
const kyoHILL_H = 34, kyoHILL_R = 108;

const kyoPOND = { x: 26, z: -6, rx: 34, rz: 22, y: -0.45 };   // the mirror pond
const kyoPAVILION = { x: 30, z: -12 };                        // the golden pavilion
const kyoZEN = { x: -34, z: 8, hx: 15, hz: 10 };              // the dry garden
const kyoGION_Z = 52;                                         // the machiya lane
const kyoRIVER_Z = 128;                                       // the Uji river centreline
const kyoRIVER_HZ = 15;                                       // half-width
const kyoBRIDGE_X = 4;                                        // where the bridge crosses
const kyoUJI = { x: 24, z: 176 };                             // the tea town
const kyoBOWL = { x: 24, z: 196 };                            // the enormous tea bowl
const kyoBAMBOO = { x: -84, z: -44, hx: 26, hz: 34 };         // the grove

const kyoSPAWN = { x: -16, y: 1.4, z: 52 };   // see KYOTO_SPAWN in main.js — it carries the arrival heading

// The torii tunnel: a polyline of gates climbing the hill. The run is scored on
// passing through every gate IN ORDER, which is why it is a list and not a
// procedural curve.
const kyoTORII = [];
const kyoTORII_N = 44;
// The camera rail through the tunnel (see kyoToriiCam).
const kyoTORII_CAM_Y = 1.75;  // eye height above the ANIMAL'S ground, before the solve
const kyoTORII_CAM_AIM = 0.45;// what the sight line has to reach: the animal's back
const kyoTORII_CAM_SKIM = 0.55;// clearance the line keeps over the path slabs
const kyoTORII_CAM_CEIL = 3.3;// but never closer than 0.7 m to the gate over the eye
const kyoTORII_CAM_MIN = 1.2; // ...and never in the path either, going downhill
const kyoTORII_CAM_DROP = 1.5;// how far the rail may fall below the animal before it stops
const kyoTORII_CAM_R = 4.6;   // corridor half-width the rail applies inside of
function kyoBuildToriiPath() {
  if (kyoTORII.length) return;
  for (let i = 0; i < kyoTORII_N; i++) {
    const t = i / (kyoTORII_N - 1);
    // an S-curve up the flank rather than a straight ramp: you should lose sight
    // of both ends of the tunnel somewhere in the middle of it
    // The lateral swing has to stay well under the gate's own half-width (2.5 m)
    // per step or the "tunnel" is a zigzag of gates you have to aim at
    // individually. At amplitude 6.5 the biggest sideways step between adjacent
    // gates is 1.1 m, which reads as a curve rather than a kink.
    const x = lerp(-6, kyoHILL_X + 4, t) + Math.sin(t * 4.4) * 6.5;
    const z = lerp(-46, kyoHILL_Z + 26, t);
    kyoTORII.push(x, z);
  }
}

const kyoWATER_Y = kyoPOND.y;
const kyoPOND_BED = -1.9;      // deep enough that a capybara floats rather than paddles
const kyoRIVER_Y = -0.9;

// --- physics / feel ---------------------------------------------------------
const kyoLANTERNS = [
  // x, z, height — the ones you can knock over
  -18, 18, 1.9,   -24, 30, 1.6,   -10, 34, 1.9,
   12, 22, 1.7,    20, 34, 1.9,    2, 44, 1.6,
  -30, -18, 2.1,   14, -30, 1.9,   44, 8, 1.7,
];
const kyoLANTERN_R = 1.55;         // barge radius
// One static body per lantern. Three tonnes of granite that you could walk
// through — standing OR fallen — because the whole set was an InstancedMesh
// with no collider behind it, and the topple was a canned animation on a
// proximity trigger. The animation stays (it reads better than a tumbling
// body would at this scale) but the thing is solid now, and it is a different
// solid once it is lying down.
const kyoLanternBodies = [];
const kyoLANTERN_SPD = 3.4;        // m/s of capybara before it goes over

const kyoZEN_ROCKS = [
  -42, 4, 1.5,  -36, 11, 1.0,  -30, 5, 1.25,  -27, 12, 0.8,  -38, 14, 0.95,
];
const kyoZEN_TRACKS = 26;          // paw prints the capybara can leave in the gravel

const kyoBAMBOO_N = 260;
const kyoMOMIJI_N = 42;
const kyoKOI_N = 7;
const kyoPETAL_N = 90;

// ------------------------------------------------------------------ scratch --
const kyoV3 = new THREE.Vector3();
const kyoQ = new THREE.Quaternion();
const kyoEu = new THREE.Euler();
const kyoSc = new THREE.Vector3();
const kyoM = new THREE.Matrix4();

// ---------------------------------------------------------------- module ----
// The people this chapter needs a HANDLE on, because they talk to each other.
// See the addExchange block at the foot of kyoBuild.
let kyoLocRake = null, kyoLocLate = null, kyoLocSweep = null;
let kyoLocTea = null, kyoLocTea2 = null;
let kyoLocMusician = null, kyoTuneMv = null;   // (L7, F2) the koto, at the pond
let kyoGame = null;
let kyoBuilt = false;
let kyoRoot = null;
let kyoTime = 0;

let kyoPondMesh = null, kyoPondAttr = null, kyoRipT = 0;
let kyoRiverMesh = null, kyoRiverAttr = null;
let kyoKoi = null;
const kyoKoiData = new Float32Array(kyoKOI_N * 4);
let kyoPetals = null;
const kyoPetalData = new Float32Array(kyoPETAL_N * 6);
let kyoBambooMesh = null, kyoBambooPhase = null;
let kyoLanternMesh = null, kyoLanternState = null;
let kyoTrackMesh = null, kyoTrackN = 0, kyoTrackDirty = false;
let kyoWhisk = null, kyoWhiskSpin = 0, kyoWhiskFroth = 0;
let kyoFroth = null;
let kyoMatchaCloud = null, kyoMatchaT = 0;

let kyoToriiSeq = 0, kyoToriiDone = false, kyoToriiT = 0;
// s of the open run, -1 for none. See kyoCheckTorii and 'torii-run' in RECORDS.
let kyoToriiRunT = -1;
let kyoZenTouched = 0, kyoZenDone = false;
let kyoBambooEnter = 0, kyoBambooIn = false, kyoBambooDone = false, kyoBambooT = 0;
let kyoSwamT = 0, kyoSwimDone = false;
let kyoMatchaDone = false, kyoWhiskDone = false;

// ============================================================== helpers ======
function kyoXform(px, py, pz, rx, ry, rz, sx, sy, sz) {
  kyoEu.set(rx, ry, rz, 'YXZ');
  kyoQ.setFromEuler(kyoEu);
  kyoV3.set(px, py, pz);
  kyoSc.set(sx, sy, sz);
  kyoM.compose(kyoV3, kyoQ, kyoSc);
  return kyoM;
}

const kyoG = { box: null, cyl6: null, cyl8: null, cyl4: null, cone6: null, cone4: null, sph6: null, plane: null };
function kyoInitGeos() {
  if (kyoG.box) return;
  kyoG.box = new THREE.BoxGeometry(1, 1, 1);
  kyoG.cyl6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
  kyoG.cyl8 = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
  kyoG.cyl4 = new THREE.CylinderGeometry(0.5, 0.5, 1, 4);
  kyoG.cone6 = new THREE.ConeGeometry(0.5, 1, 6);
  kyoG.cone4 = new THREE.ConeGeometry(0.5, 1, 4);
  kyoG.sph6 = new THREE.SphereGeometry(0.5, 6, 4);
  kyoG.plane = new THREE.PlaneGeometry(1, 1);
}

// ============================================================= THE RICKSHAW ==
/**
 * ONE THING MOVING ON HANAMIKOJI.
 *
 * Kyoto is the ONLY chapter in the game with no vehicle of any kind — not a
 * cart, not a boat under way, not a bicycle — and its arrival frame is a
 * hundred and eight metres of granite setts with two men standing on it. A
 * jinrikisha is the one wheeled thing that belongs on that lane, and it is
 * still the thing every visitor photographs there.
 *
 * One way and wrapping past the ends of the built lane, like Iceland's car
 * and the Harbour Bridge traffic: a rickshaw that reversed would be a joke
 * at the puller's expense.
 */
const kyoRICK_X = 26;         // the wrap, past both ends of the lane
const kyoRICK_V = 2.3;        // m/s — a jogging pull, which is the real pace
let kyoRick = null, kyoRickMover = null;

function kyoBuildRickshaw(game, root) {
  kyoRick = new THREE.Group();
  const M = kyoMerger();
  // the seat box, the hood over it, two big wheels and a pair of shafts
  M.box(0, 0.86, -0.10, 1.06, 0.52, 1.10, PALETTE.templeWood);
  M.box(0, 1.32, -0.50, 1.02, 0.62, 0.16, PALETTE.torii);
  M.box(0, 1.52, -0.05, 1.06, 0.12, 0.98, PALETTE.torii);
  for (let sgn = -1; sgn <= 1; sgn += 2) {
    M.cyl(sgn * 0.60, 0.56, -0.10, 0.56, 0.10, PALETTE.stoneDark, 0, 0, Math.PI / 2, 10);
    M.box(sgn * 0.40, 0.72, 1.05, 0.08, 0.08, 2.20, PALETTE.templeWood);
  }
  // the man between the shafts
  M.box(0, 0.92, 2.05, 0.42, 0.62, 0.26, PALETTE.kyotoSky);
  M.box(0, 1.34, 2.05, 0.24, 0.26, 0.23, PALETTE.skin2);
  M.box(0, 1.49, 2.04, 0.26, 0.10, 0.25, PALETTE.hair1);
  const mesh = new THREE.Mesh(M.build(), kyoVC());
  mesh.castShadow = true;
  kyoRick.add(mesh);
  root.add(kyoRick);
  const cb = new CANNON.Body({
    mass: 0, type: CANNON.Body.KINEMATIC,
    material: (game.mats && game.mats.ground) || undefined,
  });
  cb.addShape(new CANNON.Box(new CANNON.Vec3(0.62, 0.55, 1.4)),
              new CANNON.Vec3(0, 0.8, 0));
  cb.allowSleep = false;
  cb.previousPosition.copy(cb.position);
  cb.interpolatedPosition.copy(cb.position);
  game.world.addBody(cb);

  const zLane = kyoGION_Z - 2.4;
  const span = kyoRICK_X * 2;
  kyoRickMover = makeMover({
    body: cb, group: kyoRick,
    at: function (t) {
      const u = ((t * kyoRICK_V) % span + span) % span;
      const x = -kyoRICK_X + u;
      return { x: x, z: zLane, y: kyoTerrain(x, zLane), yaw: Math.PI * 0.5 };
    },
  });
}

function kyoMerger() {
  return makeMerger(kyoG, {
    xform: kyoXform, cylSegs: [4, 8], coneSegs: [4], sphSegs: [], normals: 'recompute', jitter: 0.060,
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
function kyoVC() {
  return grain(mat(0xffffff, { vertexColors: true }),
               { scale: 0.45, amount: 0.085, warp: 0.55, near: 0.34, nearScale: 8, contact: 1 });
}
/** The same thing at ground strength, and flat: the ground is horizontal,
 *  so it wants no vertical shear in the sample at all. */
function kyoVCG() {
  return grain(mat(0xffffff, { vertexColors: true }),
               { scale: 0.62, amount: 0.17, warp: 0, near: 0.72, speck: 0.55, nearScale: 7, contact: 1, broad: 0.09, broadM: 14 });
}
function kyoPush9(l, px, py, pz, rx, ry, rz, sx, sy, sz) { l.push(px, py, pz, rx, ry, rz, sx, sy, sz); }
function kyoInstance(root, geo, color, list, cast, recv) {
  const n = list.length / 9;
  if (n < 1) return null;
  const im = new THREE.InstancedMesh(geo, mat(color), n);
  for (let i = 0; i < n; i++) {
    const o = i * 9;
    im.setMatrixAt(i, kyoXform(list[o], list[o + 1], list[o + 2], list[o + 3], list[o + 4],
                               list[o + 5], list[o + 6], list[o + 7], list[o + 8]));
  }
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  im.castShadow = !!cast;
  im.receiveShadow = !!recv;
  root.add(im);
  return im;
}
/** Two mirrored boxes on ONE static body — a torii's pair of legs. */
function kyoStaticPair(game, x, y, z, ry, ox, oz, hx, hy, hz) {
  const b = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
  const shape = new CANNON.Box(new CANNON.Vec3(hx, hy, hz));
  // offsets are given in WORLD deltas, so they are counter-rotated into the
  // body frame before being handed to addShape
  // WORLD -> LOCAL IS A ROTATION BY -ry, and `lx = ox*cos - oz*sin` already IS
  // that rotation when it is handed cos(ry)/sin(ry). Passing cos(-ry)/sin(-ry)
  // into it applies +ry instead, so the legs ended up at R(3*yaw) about the
  // gate centre rather than at R(yaw). Measured over the real 44-gate path the
  // colliders drift from the drawn legs as the tunnel turns: 0.06 m at gate 6,
  // 1.25 m at gate 12, 2.46 m at gate 18 and 3.42 m at worst — so from halfway
  // up you walk through the vermilion and into a post standing in the doorway.
  const cs = Math.cos(ry), sn = Math.sin(ry);
  const lx = ox * cs - oz * sn, lz = ox * sn + oz * cs;

  b.addShape(shape, new CANNON.Vec3(lx, 0, lz));
  b.addShape(shape, new CANNON.Vec3(-lx, 0, -lz));
  // The gate legs are solid, so they are nav-solid too — otherwise the crowd
  // walks through forty-four torii on its way up the hill.
  kyoSolids.add(x + ox * cs - oz * sn, y, z + ox * sn + oz * cs, hx, hy, hz, ry);
  kyoSolids.add(x - (ox * cs - oz * sn), y, z - (ox * sn + oz * cs), hx, hy, hz, ry);
  b.position.set(x, y, z);
  b.quaternion.setFromEuler(0, ry, 0);
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
  b.previousQuaternion.copy(b.quaternion);
  b.interpolatedQuaternion.copy(b.quaternion);
  game.world.addBody(b);
  return b;
}

const kyoSolids = makeSolidIndex();
function kyoStaticBox(game, x, y, z, hx, hy, hz, ry) {
  kyoSolids.add(x, y, z, hx, hy, hz, ry);
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

// ================================================================= TERRAIN ==
/**
 * Analytic and cheap — NPCs, props, the camera and the shadow frustum all call
 * it, several times a frame, and it may never allocate or raycast.
 *
 * Three terms:
 *   1. the shrine hill in the north, a smooth cosine dome;
 *   2. a valley floor that falls gently south toward the Uji river;
 *   3. the river bed itself, cut below the waterline.
 * Everything that has to be FLAT — the pond apron, the pavilion, the zen
 * garden, the Gion lane, the tea terraces — is flattened by construction below.
 */
function kyoTerrain(x, z) {
  let y = 0;

  // 1. the hill
  const dx = x - kyoHILL_X, dz = z - kyoHILL_Z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d < kyoHILL_R) {
    const t = d / kyoHILL_R;
    y += kyoHILL_H * (0.5 + 0.5 * Math.cos(t * Math.PI)) * (1 - t * 0.18);
  }

  // 2. the fall to the river, and a rise again on the far bank
  y += clamp((30 - z) * 0.012, -1.6, 1.2);

  // the flat shelves
  if (x > kyoPOND.x - kyoPOND.rx - 8 && x < kyoPOND.x + kyoPOND.rx + 8 &&
      z > kyoPOND.z - kyoPOND.rz - 8 && z < kyoPOND.z + kyoPOND.rz + 8) y = lerp(y, 0, 0.85);
  // ...and then the pond is DUG OUT of that shelf. Without this the bed sits at
  // y = 0 and the water plane at -0.45 renders underneath it: a mirror pond you
  // walk across, which is a miracle rather than a swim.
  {
    const px = (x - kyoPOND.x) / kyoPOND.rx, pz = (z - kyoPOND.z) / kyoPOND.rz;
    const pr = Math.sqrt(px * px + pz * pz);
    if (pr < 1.04) {
      const t = clamp((1.04 - pr) / 0.30, 0, 1);
      y = lerp(y, kyoPOND_BED, t * t * (3 - 2 * t));
    }
  }
  if (x > kyoZEN.x - kyoZEN.hx - 4 && x < kyoZEN.x + kyoZEN.hx + 4 &&
      z > kyoZEN.z - kyoZEN.hz - 4 && z < kyoZEN.z + kyoZEN.hz + 4) y = lerp(y, 0.25, 0.9);
  if (z > kyoGION_Z - 18 && z < kyoGION_Z + 18) y = lerp(y, -0.15, 0.75);
  if (z > 158 && z < 216) y = lerp(y, -2.0, 0.85);        // the Uji town shelf

  // 3. AND THE RIVER, CUT LAST.
  // It used to be third, as a straight band at |z - 128| — which was fine while
  // it was scenery and is not fine now that it is a set piece: a meandering
  // channel has to win against every shelf it crosses, and the Uji town shelf
  // (which sits a metre below the river's own surface) is exactly the case that
  // proves it. Cutting last also means the banks the cut raises cannot be
  // flattened back down by a shelf blend that ran afterwards.
  if (kyoRX) y = kyoRiverCut(x, z, y);

  return y;
}

/** Cheap finite-difference slope, for placement rejection. */
function kyoSlope(x, z) {
  const h = 1.5;
  const a = kyoTerrain(x - h, z), b = kyoTerrain(x + h, z);
  const c = kyoTerrain(x, z - h), e = kyoTerrain(x, z + h);
  return Math.sqrt((b - a) * (b - a) + (e - c) * (e - c)) / (2 * h);
}

// ================================================================= SURFACES ==
function kyoBuildGroundMesh() {
  // 96 x 96 grid over 340 x 460 metres: about 3.6 m a quad, which is fine for a
  // landscape whose smallest real feature is a five-metre torii.
  const X0 = -170, X1 = 170, Z0 = -230, Z1 = 230;
  const NX = 92, NZ = 108;
  const g = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0, NX, NZ);
  g.rotateX(-Math.PI / 2);
  g.translate((X0 + X1) * 0.5, 0, (Z0 + Z1) * 0.5);
  const p = g.attributes.position.array;
  const col = new Float32Array(p.length);
  const c = new THREE.Color();
  const moss = new THREE.Color(PALETTE.mossKyoto);
  const mossD = new THREE.Color(PALETTE.mossDark);
  const stone = new THREE.Color(PALETTE.granite);
  const bed = new THREE.Color(PALETTE.graniteDark);
  // THE GROUND UNDER A WOOD IS THE WOOD'S GROUND. The hill was tinted toward
  // pale granite above 12 m, which is right for a bare summit and wrong for a
  // mountain of sugi: with the trees in, the marquee shot was three hundred
  // dark green columns standing on a bright lawn. The flank now runs to needle
  // litter under the canopy and keeps the pale only for the last few metres of
  // the crown, where the shrine is and the wood genuinely thins.
  const floor = new THREE.Color(PALETTE.sugiFloor);
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i], z = p[i + 2];
    const y = kyoTerrain(x, z);
    p[i + 1] = y;
    // moss in the shade of the hill, paler grass on the open valley floor,
    // river gravel in the bed
    const nr = kyoRiverNear(x, z);
    const hd = Math.hypot(x - kyoHILL_X, z - kyoHILL_Z);
    if (nr.d < nr.w + 5) c.copy(bed);
    else if (y > 12) {
      c.copy(mossD).lerp(stone, clamp((y - 12) / 24, 0, 0.55));
      c.lerp(floor, clamp((kyoHILL_R - hd) / 40, 0, 1) * 0.62);
    } else {
      c.copy(mossD).lerp(moss, clamp(y / 12 + Math.sin(x * 0.11 + z * 0.07) * 0.2 + 0.3, 0, 1));
      // the wood's skirt runs down the flank well below the twelve-metre line
      if (hd < kyoHILL_R) c.lerp(floor, clamp((kyoHILL_R - hd) / 46, 0, 1) * 0.42);
    }
    col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, kyoVCG());
  m.receiveShadow = true;
  m.castShadow = false;
  // AND SAY SO IN THE ONE LANGUAGE THE TRAVERSE READS. registerShadowTarget
  // (systems.js, sysEnableShadows) only spares a ghost or a mesh flagged
  // noShadow — an opaque refusal like this one sails straight through it and
  // comes back on. This is 340 x 460 m of ground: exactly the caster Pasto
  // measured as eating the whole 2048 map on its own.
  m.userData.noShadow = true;
  m.frustumCulled = false;
  return m;
}

function kyoBuildGroundBody(game) {
  // A heightfield over the same span, at 5 m elements to match Rio. The 13 m
  // this used to sample at was the second half of the contract's warning: the
  // solver's floor sat metres away from the drawn one anywhere with relief,
  // which in a valley with a 34 m shrine hill in it is most of the ground worth
  // walking on.
  // ...and "the same span" has to be ARITHMETIC, not a comment. NZ was 88,
  // which at 5 m covers 440 m of a 460 m picture: the northernmost 20 m of
  // drawn Kyoto — the full 340 m width of it, up at z 210..230 — had no
  // collision floor at all. The animal does not fall through, because
  // capyGroundY rides the analytic terrainHeight as a backstop, and that is
  // exactly what hides this class of bug until a PROP is dropped up there and
  // sinks out of the world. Same fault the pantanal and manly bodies carry
  // notes about. NX * EL = 340 and NZ * EL = 460 now, both exact.
  const NX = 68, NZ = 92;
  const X0 = -170, Z0 = -230;
  const EL = 5;
  const Z1 = Z0 + NZ * EL;
  const data = [];
  for (let i = 0; i <= NX; i++) {
    const row = [];
    for (let j = 0; j <= NZ; j++) row.push(kyoTerrain(X0 + i * EL, Z1 - j * EL));
    data.push(row);
  }
  const hf = new CANNON.Heightfield(data, { elementSize: EL });
  const b = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
  b.addShape(hf);
  // THE SECOND AXIS RUNS BACKWARDS. Rx(-90 deg) maps the field's local +y onto
  // world MINUS z, so a field sampled forwards from Z0 and parked at Z0 covers
  // Z0 and everything BEHIND it — 440 m of empty space south of Kyoto, and not
  // one square metre of the valley the player is standing in. Measured before
  // this was fixed: the capybara generated ZERO solver contacts in 4500 frames
  // here, walking the whole chapter on capybara.js's analytic backstop, while
  // every other biome logged hundreds. See the contract, "WHICH WAY THE SECOND
  // AXIS RUNS", and rio.js, which has always had it right.
  b.position.set(X0, 0, Z1);
  b.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
  b.previousQuaternion.copy(b.quaternion);
  b.interpolatedQuaternion.copy(b.quaternion);
  game.world.addBody(b);
}

/**
 * The pond and the river: two rippled surfaces, one draw call each.
 *
 * `round` builds an ELLIPSE rather than a rectangle, which the pond needs and
 * the river does not: the bed under the pond is dug as an ellipse, so a
 * rectangular water plane laid over it showed its own corners cutting across
 * the grass — four hard right angles in the middle of a garden that has not
 * contained a right angle since 1397.
 */
function kyoBuildWater(cx, cz, hx, hz, y, near, far, round) {
  let g;
  if (round) {
    // Concentric rings, not a triangle fan: a fan has one interior vertex and
    // the ripple would only ever move the rim.
    const RINGS = 6, SEG = 40;
    const pos = [], idx = [];
    pos.push(0, 0, 0);
    for (let r = 1; r <= RINGS; r++) {
      const t = r / RINGS;
      for (let s = 0; s < SEG; s++) {
        const a = s / SEG * Math.PI * 2;
        pos.push(Math.cos(a) * hx * t, 0, Math.sin(a) * hz * t);
      }
    }
    // Winding matters: laid out in XZ with y up, increasing angle runs CLOCKWISE
    // seen from above, so the naive order faces the triangles at the seabed and
    // backface culling deletes the entire pond. Reversed.
    for (let s = 0; s < SEG; s++) idx.push(0, 1 + (s + 1) % SEG, 1 + s);
    for (let r = 1; r < RINGS; r++) {
      const a0 = 1 + (r - 1) * SEG, b0 = 1 + r * SEG;
      for (let s = 0; s < SEG; s++) {
        const s1 = (s + 1) % SEG;
        idx.push(a0 + s, b0 + s1, b0 + s);
        idx.push(a0 + s, a0 + s1, b0 + s1);
      }
    }
    g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
  } else {
    g = new THREE.PlaneGeometry(hx * 2, hz * 2, Math.round(hx / 3), Math.round(hz / 3));
    g.rotateX(-Math.PI / 2);
  }
  g.translate(cx, y, cz);
  const p = g.attributes.position.array;
  const col = new Float32Array(p.length);
  const c = new THREE.Color(), a = new THREE.Color(near), b = new THREE.Color(far);
  for (let i = 0; i < p.length; i += 3) {
    c.copy(a).lerp(b, clamp((Math.abs(p[i] - cx) / hx + Math.abs(p[i + 2] - cz) / hz) * 0.6, 0, 1));
    col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  // GLITTER, NOT WAVES. The mesh already has a ripple written into it and you
  // cannot see it from six metres up at 41 degrees; what makes water read as
  // water from there is a sparse field of moving points far brighter than the
  // surface. It costs four hash calls and it is the difference between a sea
  // and a sheet of coloured card. See grain() in shared.js.
  const m = new THREE.Mesh(g, grain(mat(0xffffff, { vertexColors: true, transparent: true, opacity: 0.92 }),
    { scale: 0.6, amount: 0.05, warp: 0,
      sparkle: 0.34, sparkleScale: 1.7, sparkleSpeed: 0.22, sparkleCut: 0.665, fresnel: 0.65,
      sparkleColor: PALETTE.kyotoHaze }));
  m.receiveShadow = true;
  m.frustumCulled = false;
  return m;
}

function kyoRipple(attr, y, amp, sp) {
  const arr = attr.array;
  for (let i = 0; i < arr.length; i += 3) {
    arr[i + 1] = y + Math.sin(arr[i] * 0.22 + kyoTime * sp) * amp
                   + Math.sin(arr[i + 2] * 0.31 - kyoTime * sp * 0.8) * amp * 0.7;
  }
  attr.needsUpdate = true;
}

// ============================================================== THE TORII ====
/**
 * Fushimi Inari. Forty-four gates up a wooded flank, close enough together that
 * from inside it is a tunnel rather than a row — which is the whole reason the
 * real place looks the way it does. Two colliders per gate (the legs) and none
 * on the lintels, so the run through them is clean.
 */
function kyoBuildTorii(game, root) {
  kyoBuildToriiPath();
  const T = kyoMerger();
  // The path FIRST: a pale gravel ribbon laid under the gates, kerbed both
  // sides. Without it the tunnel stands on bare grass and reads as scaffolding
  // rather than as somewhere people have been walking since the ninth century.
  // Built as a quad strip along the same polyline, so it follows every bend.
  for (let i = 0; i < kyoTORII_N - 1; i++) {
    const ax = kyoTORII[i * 2], az = kyoTORII[i * 2 + 1];
    const bx = kyoTORII[(i + 1) * 2], bz = kyoTORII[(i + 1) * 2 + 1];
    const mx = (ax + bx) * 0.5, mz = (az + bz) * 0.5;
    const len = Math.hypot(bx - ax, bz - az) + 0.6;
    const yaw = Math.atan2(bx - ax, bz - az);
    const y = kyoTerrain(mx, mz);
    T.box(mx, y + 0.06, mz, 4.2, 0.12, len, PALETTE.gravelZen, 0, yaw, 0);
    for (let s = -1; s <= 1; s += 2) {
      T.box(mx + Math.cos(yaw) * s * 2.25, y + 0.13, mz - Math.sin(yaw) * s * 2.25,
            0.34, 0.20, len, PALETTE.granite, 0, yaw, 0);
    }
    // a shallow step every fourth panel, because it is a hill and stairs are
    // what a hill path is made of
    if (i % 4 === 0) T.box(mx, y + 0.16, mz, 4.2, 0.14, 0.5, PALETTE.granite, 0, yaw, 0);
  }
  for (let i = 0; i < kyoTORII_N; i++) {
    const x = kyoTORII[i * 2], z = kyoTORII[i * 2 + 1];
    const y = kyoTerrain(x, z);
    // face along the path
    const nx = kyoTORII[Math.min(i + 1, kyoTORII_N - 1) * 2] - kyoTORII[Math.max(i - 1, 0) * 2];
    const nz = kyoTORII[Math.min(i + 1, kyoTORII_N - 1) * 2 + 1] - kyoTORII[Math.max(i - 1, 0) * 2 + 1];
    const yaw = Math.atan2(nx, nz);
    const w = 2.5, h = 4.0;
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    for (let s = -1; s <= 1; s += 2) {
      const px = x + cs * s * w, pz = z - sn * s * w;
      T.cyl(px, y + h * 0.5, pz, 0.30, h, PALETTE.torii, 0, 0, 0, 8);
      T.cyl(px, y + 0.22, pz, 0.40, 0.44, PALETTE.toriiBase, 0, 0, 0, 8);
    }
    // kasagi (the curved top rail) and nuki (the straight one under it)
    T.box(x, y + h + 0.22, z, w * 2 + 1.5, 0.34, 0.62, PALETTE.torii, 0, yaw, 0);
    T.box(x, y + h + 0.52, z, w * 2 + 1.9, 0.26, 0.80, PALETTE.toriiDark, 0, yaw, 0);
    T.box(x, y + h - 0.75, z, w * 2 + 0.5, 0.26, 0.44, PALETTE.torii, 0, yaw, 0);
    T.box(x, y + h - 0.30, z, 0.44, 0.72, 0.34, PALETTE.torii, 0, yaw, 0);
    // Legs are solid; the gate is a doorway you must go THROUGH. BOTH legs are
    // shapes on ONE body: forty-four gates as eighty-eight separate bodies is
    // most of a broadphase all by itself, and the contract caps the whole biome
    // at a hundred and thirty.
    kyoStaticPair(game, x, y + h * 0.5, z, yaw, cs * w, -sn * w, 0.34, h * 0.5, 0.34);
  }
  // the little shrine at the top, and a pair of fox guardians
  const sx = kyoHILL_X + 2, sz = kyoHILL_Z + 18, sy = kyoTerrain(sx, sz);
  T.box(sx, sy + 1.5, sz, 7.0, 3.0, 6.0, PALETTE.templeWood);
  T.box(sx, sy + 3.2, sz, 8.6, 0.5, 7.6, PALETTE.kawara);
  T.box(sx, sy + 3.7, sz, 6.0, 0.6, 5.2, PALETTE.kawaraDark);
  T.box(sx, sy + 1.4, sz + 3.1, 3.4, 2.6, 0.24, PALETTE.torii);
  // AND THE SHRINE ITSELF IS SOLID. This builder carries the collider line for
  // the forty-four gates (kyoStaticPair, legs solid and the doorway open) and
  // then draws a seven-by-six-metre building at the top of the path with
  // nothing behind it — the same shape as gorBuildField's one truck among five
  // crews. It is what the whole torii tunnel walks you to. kyoStaticBox takes
  // HALF extents, unlike gorStaticBox and venStaticBox, so these are halves.
  kyoStaticBox(game, sx, sy + 1.75, sz, 3.5, 1.75, 3.0);
  for (let s = -1; s <= 1; s += 2) {
    const fx = sx + s * 4.4, fz = sz + 4.6, fy = kyoTerrain(fx, fz);
    T.box(fx, fy + 0.45, fz, 1.0, 0.9, 1.0, PALETTE.granite);
    kyoStaticBox(game, fx, fy + 0.45, fz, 0.5, 0.45, 0.5);
    T.sph(fx, fy + 1.35, fz, 0.34, 0.44, 0.62, PALETTE.gravelZen);
    T.cone(fx, fy + 1.95, fz - 0.15, 0.22, 0.5, PALETTE.gravelZen);
    T.box(fx, fy + 1.55, fz + 0.5, 0.30, 0.24, 0.36, PALETTE.gravelZen);
  }
  const m = new THREE.Mesh(T.build(), kyoVC());
  m.castShadow = true;
  m.receiveShadow = true;
  m.frustumCulled = false;
  root.add(m);
}

// ======================================================= THE GOLDEN PAVILION ==
function kyoBuildPavilion(game, root) {
  const P = kyoMerger();
  const x = kyoPAVILION.x, z = kyoPAVILION.z;
  // an island platform standing in the pond
  P.box(x, kyoWATER_Y - 0.4, z, 15, 1.4, 13, PALETTE.graniteDark);
  P.box(x, kyoWATER_Y + 0.34, z, 14, 0.24, 12, PALETTE.granite);
  kyoStaticBox(game, x, kyoWATER_Y - 0.2, z, 7.5, 0.85, 6.5);
  // three storeys, each smaller, the top two gilded
  const cols = [PALETTE.shoji, PALETTE.gold, PALETTE.gold];
  const w = [9.0, 7.6, 5.6], d = [7.6, 6.4, 4.6], h = [3.2, 2.8, 2.4];
  let y = kyoWATER_Y + 0.46;
  for (let s = 0; s < 3; s++) {
    P.box(x, y + h[s] * 0.5, z, w[s], h[s], d[s], cols[s]);
    // posts and a rail, so it reads as a veranda rather than a cake tier
    for (let i = -1; i <= 1; i += 2) {
      P.box(x + i * (w[s] * 0.5 + 0.35), y + h[s] * 0.42, z, 0.22, h[s] * 0.84, d[s] + 0.9,
            s === 0 ? PALETTE.templeWoodDk : PALETTE.goldDark);
    }
    // the eaves: wide, thin, and lifted at the corners
    const ew = w[s] + 3.4, ed = d[s] + 3.0;
    P.box(x, y + h[s] + 0.20, z, ew, 0.30, ed, s === 0 ? PALETTE.kawara : PALETTE.goldDark);
    P.box(x, y + h[s] + 0.46, z, ew - 1.6, 0.28, ed - 1.4, s === 0 ? PALETTE.kawaraDark : PALETTE.gold);
    for (let a = -1; a <= 1; a += 2) {
      for (let b = -1; b <= 1; b += 2) {
        P.box(x + a * ew * 0.46, y + h[s] + 0.52, z + b * ed * 0.46, 1.5, 0.22, 1.5,
              s === 0 ? PALETTE.kawara : PALETTE.goldDark, -b * 0.22, 0, a * 0.22);
      }
    }
    y += h[s] + 0.55;
    kyoStaticBox(game, x, y - h[s] * 0.5 - 0.55, z, w[s] * 0.5, h[s] * 0.5, d[s] * 0.5);
  }
  // the phoenix on the ridge
  P.sph(x, y + 0.55, z, 0.30, 0.42, 0.62, PALETTE.gold);
  P.cone(x, y + 1.05, z + 0.1, 0.22, 0.5, PALETTE.gold);
  P.box(x, y + 0.55, z - 0.7, 0.16, 0.14, 1.3, PALETTE.goldDark, 0.4, 0, 0);

  // stepping stones from the north shore out to the island — the only dry way
  // aboard, and deliberately a hop apart
  for (let i = 0; i < 6; i++) {
    const sx2 = x - 9 - i * 2.6, sz2 = z - 8 + Math.sin(i * 1.3) * 1.6;
    // proud enough of the water that standing on one is not "swimming"
    P.cyl(sx2, kyoWATER_Y + 0.30, sz2, 1.05, 1.10, PALETTE.granite, 0, rand(0, 3), 0, 6);
    kyoStaticBox(game, sx2, kyoWATER_Y + 0.28, sz2, 0.9, 0.42, 0.9);
  }

  const m = new THREE.Mesh(P.build(), kyoVC());
  m.castShadow = true;
  m.receiveShadow = true;
  root.add(m);
}

// ============================================================== THE ZEN GARDEN ==
function kyoBuildZen(game, root) {
  const Zg = kyoMerger();
  const x = kyoZEN.x, z = kyoZEN.z, hx = kyoZEN.hx, hz = kyoZEN.hz;
  const y = kyoTerrain(x, z);
  // the gravel bed, and the raked lines in it: thin ridges, all parallel, which
  // is exactly what makes a single paw print across them read as vandalism
  Zg.box(x, y + 0.08, z, hx * 2, 0.16, hz * 2, PALETTE.gravelZen);
  for (let i = -Math.floor(hz / 0.9); i <= Math.floor(hz / 0.9); i++) {
    Zg.box(x, y + 0.19, z + i * 0.9, hx * 2 - 0.4, 0.06, 0.30, PALETTE.granite);
  }
  kyoStaticBox(game, x, y - 0.2, z, hx, 0.35, hz);
  // the wall around it: earth-coloured, tiled top, the way they always are
  //
  // ---- ...AND THE SOUTH WALL'S GAP IS A GAP YOU CAN SEE NOW -------------
  // It was not. The wall was drawn STRAIGHT ACROSS the full width and a 4.4 m
  // gravel-coloured panel was painted on the middle of it, while the two
  // colliders below left a 7.2 m hole — so the player met an unbroken 1.9 m
  // earth wall and walked through it. MEASURED (`qa/px-kyoto-zen.js`), a ray
  // sweep along the whole south face from a metre outside it: the drawn wall
  // had NO gap anywhere, the physics had one at x −37…−30.5, and a walk test
  // got in at x −37, −34 and −32 and was stopped at −40 and −29. Photographed,
  // it is a pale panel on a wall, which is not a door.
  //
  // ROADMAP-PHYSICS X9 found the same thing from the other end and could only
  // call it "Kyoto's 32 × 22 × 2.4 m mesh, builder not identified".
  //
  // The south wall is two segments now, and their inner ends are the
  // colliders' own inner ends by construction — the same two expressions, so
  // the drawn opening and the walk-through opening cannot drift apart.
  const gapIn = hx * 0.62 - hx * 0.38;      // 3.6 m: the inner edge of each side
  const gapOut = hx + 0.8;                  // ...and the outer, at the side wall
  const segC = (gapOut + gapIn) * 0.5, segW = gapOut - gapIn;
  for (let s = -1; s <= 1; s += 2) {
    Zg.box(x + s * (hx + 0.5), y + 0.95, z, 0.5, 1.9, hz * 2 + 1.6, PALETTE.adobeShade);
    Zg.box(x + s * (hx + 0.5), y + 2.02, z, 0.95, 0.24, hz * 2 + 2.0, PALETTE.kawara);
    kyoStaticBox(game, x + s * (hx + 0.5), y + 0.95, z, 0.35, 1.0, hz + 0.8);
    if (s < 0) {
      // the north wall is whole, and solid across its whole width
      Zg.box(x, y + 0.95, z + s * (hz + 0.5), hx * 2 + 1.6, 1.9, 0.5, PALETTE.adobeShade);
      Zg.box(x, y + 2.02, z + s * (hz + 0.5), hx * 2 + 2.0, 0.24, 0.95, PALETTE.kawara);
    } else {
      for (let t = -1; t <= 1; t += 2) {
        Zg.box(x + t * segC, y + 0.95, z + hz + 0.5, segW, 1.9, 0.5, PALETTE.adobeShade);
        Zg.box(x + t * segC, y + 2.02, z + hz + 0.5, segW + 0.4, 0.24, 0.95, PALETTE.kawara);
      }
    }
  }
  // ...and a stone sill across the opening, because a gap in a wall with
  // nothing at its foot reads as a wall that is missing rather than as a way
  // in. Ten centimetres and no collider of its own — that is under the step
  // the animal takes without noticing, and a drawn lip you CAN walk over is
  // not the thing this block just fixed.
  Zg.box(x, y + 0.05, z + hz + 0.5, gapIn * 2, 0.10, 1.1, PALETTE.granite);
  kyoStaticBox(game, x - hx * 0.62, y + 0.95, z + hz + 0.5, hx * 0.38, 1.0, 0.35);
  kyoStaticBox(game, x + hx * 0.62, y + 0.95, z + hz + 0.5, hx * 0.38, 1.0, 0.35);
  kyoStaticBox(game, x, y + 0.95, z - hz - 0.5, hx + 0.8, 1.0, 0.35);

  // the five rocks, each in its little skirt of moss
  for (let i = 0; i < kyoZEN_ROCKS.length; i += 3) {
    const rx = kyoZEN_ROCKS[i], rz = kyoZEN_ROCKS[i + 1], r = kyoZEN_ROCKS[i + 2];
    const ry = kyoTerrain(rx, rz);
    Zg.sph(rx, ry + 0.18, rz, r * 1.35, 0.20, r * 1.30, PALETTE.mossKyoto);
    Zg.add(kyoG.sph6, kyoXform(rx, ry + r * 0.42, rz, rand(-0.2, 0.2), rand(0, 3), rand(-0.2, 0.2),
                               r * 1.7, r * 1.15, r * 1.5), PALETTE.graniteDark);
    kyoStaticBox(game, rx, ry + r * 0.4, rz, r * 0.7, r * 0.55, r * 0.65);
  }
  const m = new THREE.Mesh(Zg.build(), kyoVC());
  m.castShadow = true;
  m.receiveShadow = true;
  // Named, for the reason cave.js's four exit meshes are: X9 could only report
  // `Mesh < kyoto < Scene` and had to leave "builder not identified" on a
  // finding that turned out to be a door drawn shut.
  m.name = 'kyoZenGarden';
  root.add(m);

  // paw prints, written into an instanced mesh as the capybara wrecks the place
  kyoTrackMesh = new THREE.InstancedMesh(kyoG.plane, mat(PALETTE.granite), kyoZEN_TRACKS);
  kyoTrackMesh.castShadow = false;
  kyoTrackMesh.userData.noShadow = true;   // a paw print IS the ground
  kyoTrackMesh.receiveShadow = false;
  kyoTrackMesh.frustumCulled = false;
  for (let i = 0; i < kyoZEN_TRACKS; i++) {
    kyoTrackMesh.setMatrixAt(i, kyoXform(0, -900, 0, 0, 0, 0, 0.001, 0.001, 0.001));
  }
  kyoTrackMesh.instanceMatrix.needsUpdate = true;
  root.add(kyoTrackMesh);
}

// ==================================================================== GION ====
function kyoBuildGion(game, root) {
  const G = kyoMerger();
  const lanes = [-1, 1];
  for (let li = 0; li < lanes.length; li++) {
    const side = lanes[li];
    for (let i = 0; i < 9; i++) {
      const x = -40 + i * 10 + (li ? 3 : 0);
      const z = kyoGION_Z + side * 9;
      const y = kyoTerrain(x, z);
      const h = rand(4.4, 5.6), w = 8.2, dep = 7.0;
      // machiya: dark timber lattice, a deep tiled roof, one warm paper window
      G.box(x, y + h * 0.5, z, w, h, dep, PALETTE.templeWood);
      G.box(x, y + h * 0.55, z - side * (dep * 0.5 + 0.05), w - 0.6, h * 0.62, 0.20, PALETTE.shoji);
      for (let k = 0; k < 7; k++) {
        G.box(x - w * 0.42 + k * (w * 0.84 / 6), y + h * 0.55, z - side * (dep * 0.5 + 0.14),
              0.14, h * 0.66, 0.14, PALETTE.shojiFrame);
      }
      // THE ROOF IS THE WHOLE OF GION AND IT WAS TWO FLAT PLATES.
      //
      // A machiya's kawara roof is deep, low-pitched and heavy, and it is the
      // one thing anybody pictures when they picture this lane. Stacked slabs
      // gave eighteen of them a single unbroken grey plane across the top of
      // every frame — from forty-one degrees down, a flat roof IS the building.
      // Two pitched planes about a ridge that runs along the street, an eave
      // that stands proud on the street side, and the barge-boards at each end
      // so the gable has a shape.
      const RISE = 1.35, HD = dep * 0.5 + 1.1;
      const PIT = Math.atan2(RISE, HD);
      for (let e = -1; e <= 1; e += 2) {
        G.box(x, y + h + 0.30 + RISE * 0.5, z + e * HD * 0.5,
              w + 1.6, 0.36, HD + 0.5, PALETTE.kawara, -e * PIT, 0, 0);
        // the eave course, a shade darker, hanging over the wall below
        G.box(x, y + h + 0.16, z + e * (HD + 0.30),
              w + 2.0, 0.30, 1.15, PALETTE.kawaraDark, -e * PIT, 0, 0);
      }
      G.box(x, y + h + 1.68, z, w + 1.7, 0.30, 0.62, PALETTE.kawaraDark);
      for (let e = -1; e <= 1; e += 2) {
        G.box(x + e * (w * 0.5 + 0.85), y + h + 0.92, z, 0.22, 1.5, dep + 2.2,
              PALETTE.templeWoodDk);
      }
      // noren curtain over the door
      G.box(x, y + 2.35, z - side * (dep * 0.5 + 0.30), 2.4, 1.2, 0.08, PALETTE.indigo);
      kyoStaticBox(game, x, y + h * 0.5, z, w * 0.5, h * 0.5, dep * 0.5);
    }
  }
  // the lane itself: fitted granite setts, and a shallow gutter down each side
  const lz = kyoGION_Z, ly = kyoTerrain(0, lz);
  G.box(0, ly + 0.05, lz, 108, 0.16, 9.0, PALETTE.granite);
  for (let s = -1; s <= 1; s += 2) {
    G.box(0, ly + 0.02, lz + s * 4.2, 108, 0.14, 0.9, PALETTE.graniteDark);
  }
  kyoStaticBox(game, 0, ly - 0.15, lz, 54, 0.28, 5.4);

  const m = new THREE.Mesh(G.build(), kyoVC());
  m.castShadow = true;
  m.receiveShadow = true;
  root.add(m);

  // ---- the lanterns -------------------------------------------------------
  // FORTY OF THEM WERE HANGING FROM NOTHING. They sat at ground + 3.5 in two
  // rows three and a half metres clear of the shopfronts, attached to no post,
  // no wire and no eave — the single most conspicuous object in the lane and
  // the only thing in the chapter that ignored gravity. Cali's festoon over the
  // dance floor already solves this exactly: posts, a slung cable, and the
  // bulbs hung at the sag, so the string reads as a string.
  //
  // They also now MOVE. A paper lantern on a cord in a valley is never still,
  // and a row of them swinging very slightly out of phase is the cheapest thing
  // in this chapter that says the air is moving — see kyoUpdateLanternRow.
  // Its OWN merger: `G` was built and added to the scene four lines ago, and
  // geometry pushed into a merger after build() goes nowhere at all.
  const GL = kyoMerger();
  const globes = [], caps = [];
  kyoLanternRow = [];
  for (let s = -1; s <= 1; s += 2) {
    const z = lz + s * 5.4;
    let px = 0, py = 0, first = true;
    for (let i = 0; i < 21; i++) {
      const x = -48 + i * 4.8;
      const y = kyoTerrain(x, z);
      // a post every third bay, leaning the way tired posts lean
      if (i % 3 === 0) {
        GL.cyl(x, y + 2.35, z, 0.11, 4.7, PALETTE.templeWoodDk, 0, 0, s * 0.02, 6);
        GL.box(x, y + 4.62, z, 0.7, 0.10, 0.10, PALETTE.templeWoodDk);
      }
      const top = y + 4.55;
      if (!first) {
        // the cord between this post and the last, sagging
        const N = 3;
        for (let k = 0; k < N; k++) {
          const t0 = k / N, t1 = (k + 1) / N;
          const y0 = lerp(py, top, t0) - Math.sin(t0 * Math.PI) * 0.26;
          const y1 = lerp(py, top, t1) - Math.sin(t1 * Math.PI) * 0.26;
          const x0 = lerp(px, x, t0), x1 = lerp(px, x, t1);
          GL.box((x0 + x1) * 0.5, (y0 + y1) * 0.5, z, Math.hypot(x1 - x0, y1 - y0) + 0.04,
                0.045, 0.045, PALETTE.templeWoodDk, 0, 0, Math.atan2(y1 - y0, x1 - x0));
        }
      }
      px = x; py = top; first = false;
      if (i >= 20) continue;
      // and the lantern hangs off it, on its own short cord
      const hx = x + 2.4, hy = kyoTerrain(hx, z) + 4.55 - 0.22;
      GL.box(hx, hy - 0.16, z, 0.05, 0.34, 0.05, PALETTE.templeWoodDk);
      kyoPush9(globes, hx, hy - 0.86, z, 0, 0, 0, 0.62, 0.95, 0.62);
      kyoPush9(caps, hx, hy - 0.34, z, 0, 0, 0, 0.30, 0.16, 0.30);
      kyoLanternRow.push(hx, hy, z, rand(0, Math.PI * 2));
    }
  }
  const glm = new THREE.Mesh(GL.build(), kyoVC());
  glm.castShadow = true;
  glm.receiveShadow = true;
  root.add(glm);
  kyoGionGlobes = kyoInstance(root, kyoG.cyl8, PALETTE.paperLantern, globes, false, false);
  kyoGionCaps = kyoInstance(root, kyoG.cyl8, PALETTE.templeWoodDk, caps, false, false);
}

/**
 * The lane's lanterns, swinging. Two instanced writes at 20 Hz for forty of
 * them; each hangs from a fixed point and swings about it, which is the whole
 * difference between a lantern and a bead on a wire — the globe travels on an
 * arc and the cap stays nearly still.
 */
let kyoGionGlobes = null, kyoGionCaps = null, kyoLanternRow = null, kyoLanternLast = -1;
function kyoUpdateLanternRow() {
  if (!kyoGionGlobes || !kyoLanternRow) return;
  const tick = kyoTime * 20 | 0;
  if (tick === kyoLanternLast) return;
  kyoLanternLast = tick;
  const n = kyoLanternRow.length / 4;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const ph = kyoLanternRow[o + 3];
    // one slow sine beating against a slower one, so the row never falls into
    // step with itself — a rank of forty lanterns all swinging together is a
    // metronome, and this is a valley in the late afternoon
    // ...and when the bonsho goes, they all go with it. The lane is a hundred
    // metres from the shoro and the front arrives as a shove, not a breeze, so
    // the swing goes to five times its idle amplitude and IN PHASE — forty
    // lanterns moving together for two seconds is the only moment in the
    // chapter when the air is visibly doing one thing.
    const kick = kyoBellPulse * kyoBellPulse;
    const a = Math.sin(kyoTime * 0.85 + ph) * 0.085 * (0.6 + 0.4 * Math.sin(kyoTime * 0.19 + ph))
            + Math.sin(kyoTime * 3.4) * 0.30 * kick;
    const x = kyoLanternRow[o], y = kyoLanternRow[o + 1], z = kyoLanternRow[o + 2];
    kyoGionGlobes.setMatrixAt(i, kyoXform(x + Math.sin(a) * 0.86, y - Math.cos(a) * 0.86, z,
                                          0, 0, a, 0.62, 0.95, 0.62));
    kyoGionCaps.setMatrixAt(i, kyoXform(x + Math.sin(a) * 0.34, y - Math.cos(a) * 0.34, z,
                                        0, 0, a, 0.30, 0.16, 0.30));
  }
  kyoGionGlobes.instanceMatrix.needsUpdate = true;
  kyoGionCaps.instanceMatrix.needsUpdate = true;
}

// ============================================================== THE LANTERNS ==
// Stone lanterns, individually simulated only in the sense that each one
// remembers whether it has fallen over. One instanced draw for the whole set,
// and the toppled ones simply carry a different matrix.
function kyoBuildLanterns(kyoLanternGame, root) {
  const n = kyoLANTERNS.length / 3;
  const L = kyoMerger();
  // authored once, at the origin, in unit-ish proportions
  L.box(0, 0.16, 0, 1.15, 0.32, 1.15, PALETTE.graniteDark);
  L.cyl(0, 0.75, 0, 0.26, 0.90, PALETTE.granite, 0, 0, 0, 6);
  L.box(0, 1.32, 0, 1.02, 0.26, 1.02, PALETTE.graniteDark);
  L.box(0, 1.75, 0, 0.82, 0.62, 0.82, PALETTE.gravelZen);
  for (let s = -1; s <= 1; s += 2) {
    L.box(s * 0.42, 1.75, 0, 0.06, 0.62, 0.86, PALETTE.granite);
    L.box(0, 1.75, s * 0.42, 0.86, 0.62, 0.06, PALETTE.granite);
  }
  L.cone(0, 2.32, 0, 0.86, 0.55, PALETTE.granite, 0, 0.4, 0, 6);
  L.sph(0, 2.68, 0, 0.16, 0.20, 0.16, PALETTE.graniteDark);
  const geo = L.build();
  kyoLanternMesh = new THREE.InstancedMesh(geo, kyoVC(), n);
  kyoLanternMesh.castShadow = true;
  kyoLanternMesh.receiveShadow = true;
  kyoLanternMesh.frustumCulled = false;
  kyoLanternState = new Float32Array(n * 4);   // fallen(0/1), t, yaw, tipYaw
  for (let i = 0; i < n; i++) {
    const x = kyoLANTERNS[i * 3], z = kyoLANTERNS[i * 3 + 1], s = kyoLANTERNS[i * 3 + 2] / 1.9;
    kyoLanternState[i * 4 + 2] = rand(0, Math.PI * 2);
    kyoLanternMesh.setMatrixAt(i, kyoXform(x, kyoTerrain(x, z), z, 0, kyoLanternState[i * 4 + 2], 0, s, s, s));
    kyoLanternBodies[i] = kyoStaticBox(kyoLanternGame, x, kyoTerrain(x, z) + 1.44 * s, z,
                                       0.58 * s, 1.44 * s, 0.58 * s, 0);
  }
  kyoLanternMesh.instanceMatrix.needsUpdate = true;
  root.add(kyoLanternMesh);
}

// One line per lantern, and the ninth is the punchline. See kyoUpdateLanterns.
const kyoLANTERN_LINES = [
  'eight hundred years. oh well.',
  'two. that is a pattern, not an accident.',
  'three. somebody is going to have to stand these up.',
  'four. the moss will not grow back either.',
  'five. this was a UNESCO thing.',
  'six. nobody has come out. that is the strange part.',
  'seven. you are doing them in order, which is somehow worse.',
  'eight. one left. you know it and I know it.',
  'nine of nine. the gardener has gone home.',
];
let kyoLanternN = 0;
// The bang payload, reused: npc.js reads .position and .speed off it and this
// runs on a frame where nine other things are also happening.
const kyoBangPos = { x: 0, y: 0, z: 0 };
const kyoBangPayload = { position: kyoBangPos, speed: 9.5 };

function kyoUpdateLanterns(game, dt) {
  if (!kyoLanternMesh) return;
  const capy = game.capy;
  const n = kyoLANTERNS.length / 3;
  const sp = capy ? Math.sqrt(capy.velocity.x * capy.velocity.x + capy.velocity.z * capy.velocity.z) : 0;
  let dirty = false;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const x = kyoLANTERNS[i * 3], z = kyoLANTERNS[i * 3 + 1];
    const s = kyoLANTERNS[i * 3 + 2] / 1.9;
    if (!kyoLanternState[o]) {
      if (!capy || sp < kyoLANTERN_SPD) continue;
      const dx = capy.position.x - x, dz = capy.position.z - z;
      if (dx * dx + dz * dz > kyoLANTERN_R * kyoLANTERN_R) continue;
      kyoLanternState[o] = 1;
      kyoLanternState[o + 1] = 0;
      kyoLanternState[o + 3] = Math.atan2(capy.velocity.x, capy.velocity.z);
      kyoLanternN++;
      if (typeof game.sfx === 'function') {
        // Granite on gravel, and the note drops as the tally climbs: nine of
        // these went over on ONE sample and pitch, which is a sound effect
        // rather than an escalation.
        game.sfx('thud', { volume: 0.9, pitch: 0.78 - Math.min(kyoLanternN, 9) * 0.02,
                           at: { x: x, y: kyoTerrain(x, z) + 1, z: z } });
        game.sfx('rustle', { volume: 0.4, pitch: 0.6 });
      }
      if (typeof game.punch === 'function') game.punch(0.24); else if (game.shake) game.shake(0.24);
      if (typeof game.completeTask === 'function') game.completeTask('lantern-topple');
      // ---- AND SOMEBODY IS STANDING TEN METRES AWAY -----------------------
      // props.js emits 'prop:impact' for anything the physics owns and npc.js
      // has listened to it since the flinch was written — but a stone lantern
      // is a KINEMATIC body the chapter animates itself, so eight hundred years
      // of granite could go over at a monk's elbow and the only thing that
      // moved was a number on the card. Same channel, same payload shape.
      if (game.events && typeof game.events.emit === 'function') {
        kyoBangPos.x = x; kyoBangPos.y = kyoTerrain(x, z) + 0.6; kyoBangPos.z = z;
        kyoBangPayload.speed = 9.5;
        game.events.emit('prop:impact', kyoBangPayload);
      }
      // ---- ...AND THE TALLY IS THE JOKE ----------------------------------
      // One line, fired nine times, is a bug report. There are nine lanterns in
      // this garden and the whole point of them is that nothing stops you.
      if (typeof game.toast === 'function') game.toast(kyoLANTERN_LINES[Math.min(kyoLanternN, kyoLANTERN_LINES.length) - 1]);
      kyoLanternFell(i, x, z, s, kyoLanternState[o + 3]);
    }
    if (kyoLanternState[o] && kyoLanternState[o + 1] < 1) {
      kyoLanternState[o + 1] = Math.min(1, kyoLanternState[o + 1] + dt * 2.4);
      dirty = true;
      // it falls AWAY from the direction you hit it from, and overshoots once
      const t = kyoLanternState[o + 1];
      const ease = 1 - Math.pow(1 - t, 3);
      const tip = ease * (Math.PI * 0.5) + Math.sin(t * Math.PI) * 0.16;
      const yaw = kyoLanternState[o + 3];
      kyoLanternMesh.setMatrixAt(i, kyoXform(
        x + Math.sin(yaw) * ease * 0.9, kyoTerrain(x, z), z + Math.cos(yaw) * ease * 0.9,
        Math.cos(yaw) * tip, kyoLanternState[o + 2], -Math.sin(yaw) * tip, s, s, s));
    }
  }
  if (dirty) kyoLanternMesh.instanceMatrix.needsUpdate = true;
}

/**
 * A fallen lantern is still granite, so it keeps a collider — but a low, wide
 * one, lying where the animation puts it. Reshaping the box in place rather
 * than swapping bodies keeps the nav index and the solver pointing at the same
 * object, and there are nine of these, not nine hundred.
 */
/** ...and the inverse, for onEnter: the box goes back to standing granite and
 *  the body back to the plinth it was on. Same shape in place, same reason. */
function kyoLanternStand(i, x, z, s) {
  const b = kyoLanternBodies[i];
  if (!b || !b.shapes.length) return;
  const sh = b.shapes[0];
  if (!sh.halfExtents) return;
  sh.halfExtents.set(0.58 * s, 1.44 * s, 0.58 * s);
  if (sh.updateConvexPolyhedronRepresentation) sh.updateConvexPolyhedronRepresentation();
  if (sh.updateBoundingSphereRadius) sh.updateBoundingSphereRadius();
  b.position.set(x, kyoTerrain(x, z) + 1.44 * s, z);
  b.quaternion.setFromEuler(0, 0, 0);
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
  b.previousQuaternion.copy(b.quaternion);
  b.interpolatedQuaternion.copy(b.quaternion);
  b.updateBoundingRadius();
  b.updateAABB();
}

function kyoLanternFell(i, x, z, s, yaw) {
  const b = kyoLanternBodies[i];
  if (!b || !b.shapes.length) return;
  const sh = b.shapes[0];
  if (!sh.halfExtents) return;
  sh.halfExtents.set(0.86 * s, 0.46 * s, 0.52 * s);
  if (sh.updateConvexPolyhedronRepresentation) sh.updateConvexPolyhedronRepresentation();
  if (sh.updateBoundingSphereRadius) sh.updateBoundingSphereRadius();
  const cx = x + Math.sin(yaw) * 0.9, cz = z + Math.cos(yaw) * 0.9;
  b.position.set(cx, kyoTerrain(cx, cz) + 0.46 * s, cz);
  b.quaternion.setFromEuler(0, yaw, 0);
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
  b.previousQuaternion.copy(b.quaternion);
  b.interpolatedQuaternion.copy(b.quaternion);
  b.updateBoundingRadius();
  b.updateAABB();
}

// ============================================================== THE BONSHO ===
// THE MINI, and the one in this game that is not a ride.
//
// Every other mini in the thirteen is some version of 'get on the moving thing',
// which is right for Sydney and Pasto and Mong Kok and is exactly wrong here:
// Kyoto is the quiet chapter and its joke is small loud things done in places
// that have been carefully arranged for several hundred years. So the loudest
// object in Japan, and you do not ride it — you stand INSIDE it.
//
// A temple bell is rung by a shumoku, a suspended log swung on ropes into the
// side of the bell, and the bell itself hangs with a metre of daylight under the
// rim. A capybara walks under that without ducking. Pull the rope, and you have
// four and a half seconds and eight metres to be somewhere you should not be.
//
// It needs no collider at all, which is the whole reason this shape was chosen:
// the shell is entirely above head height, so there is no wall to pass through
// and no doorway to author.
const kyoBELL = { x: -15.0, z: 24.0 };
const kyoBELL_R = 1.34;        // radius at the rim
const kyoBELL_H = 2.45;        // rim to shoulder
const kyoBELL_RIM = 1.08;      // m of daylight under it
const kyoBELL_WIND = 4.5;      // s from the pull to the strike
const kyoBELL_RING = 9.0;      // s the note is allowed to hang
const kyoBELL_ROPE_D = 8.2;    // m from the bell to the rope you pull
let kyoBellY = 0;
let kyoBellGroup = null;       // the bell itself, which wobbles
let kyoBellBeam = null;        // the shumoku
let kyoBellRope = null;
let kyoBellWind = -1;          // counting down to the strike
let kyoBellTick = 0;           // the one-a-second knock during the wind-up
let kyoBellSaid = 0;           // cooldown on 'it is still going'
let kyoBellRing = 0;           // s of note left
let kyoBellRung = false;
let kyoBellHit = false;        // task 'the-bell' already paid
const kyoBellPos = new THREE.Vector3();

function kyoBuildBell(game, root) {
  kyoBellY = kyoTerrain(kyoBELL.x, kyoBELL.z);
  const bx = kyoBELL.x, bz = kyoBELL.z, by = kyoBellY;
  kyoBellPos.set(bx, by + kyoBELL_RIM + kyoBELL_H * 0.5, bz);

  // ---- the shoro: four posts, a plinth and a hipped roof -------------------
  const T = kyoMerger();
  T.box(bx, by + 0.16, bz, 6.6, 0.32, 6.6, PALETTE.granite);
  T.box(bx, by + 0.40, bz, 5.8, 0.20, 5.8, PALETTE.graniteDark);
  for (let sx = -1; sx <= 1; sx += 2) {
    for (let sz = -1; sz <= 1; sz += 2) {
      T.box(bx + sx * 2.35, by + 2.70, bz + sz * 2.35, 0.42, 4.60, 0.42, PALETTE.templeWood);
      T.box(bx + sx * 2.35, by + 0.60, bz + sz * 2.35, 0.62, 0.22, 0.62, PALETTE.graniteDark);
    }
  }
  // the beams the bell and the shumoku both hang from
  for (let s = -1; s <= 1; s += 2) {
    T.box(bx, by + 4.72, bz + s * 2.35, 5.6, 0.34, 0.44, PALETTE.templeBeam);
    T.box(bx + s * 2.35, by + 4.72, bz, 0.44, 0.34, 5.6, PALETTE.templeBeam);
  }
  T.box(bx, by + 5.05, bz, 5.2, 0.30, 5.2, PALETTE.templeWoodDk);
  // a hipped kawara roof, four courses stepping in
  for (let i = 0; i < 4; i++) {
    const w = 7.4 - i * 1.5;
    T.box(bx, by + 5.30 + i * 0.42, bz, w, 0.40, w, i % 2 ? PALETTE.kawaraDark : PALETTE.kawara);
  }
  T.box(bx, by + 7.05, bz, 0.5, 0.6, 0.5, PALETTE.kawaraDark);
  const tower = new THREE.Mesh(T.build(), kyoVC());
  tower.castShadow = true;
  tower.receiveShadow = true;
  root.add(tower);
  // four posts, and nothing else in here is solid
  const tb = new CANNON.Body({ mass: 0, material: game.mats ? game.mats.ground : undefined });
  for (let sx = -1; sx <= 1; sx += 2) {
    for (let sz = -1; sz <= 1; sz += 2) {
      tb.addShape(new CANNON.Box(new CANNON.Vec3(0.21, 2.30, 0.21)),
                  new CANNON.Vec3(bx + sx * 2.35, by + 2.70, bz + sz * 2.35));
    }
  }
  tb.allowSleep = true;
  game.world.addBody(tb);

  // ---- the bell. Its own group, because it rings ---------------------------
  const B = kyoMerger();
  // A bonsho is a straight-sided barrel with a shoulder, not a cone: eight
  // courses stepping in only at the very top.
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const r = kyoBELL_R * (1 - Math.pow(t, 3.2) * 0.30);
    B.cyl(0, -kyoBELL_H * 0.5 + kyoBELL_H * (i + 0.5) / 7, 0, r, kyoBELL_H / 7 + 0.02,
          i > 4 ? PALETTE.templeWoodDk : PALETTE.toriiBase, 0, 0, 0, 8);
  }
  // the lip, the studs (chi) and the dragon-headed hanger (ryuzu)
  B.cyl(0, -kyoBELL_H * 0.5 + 0.09, 0, kyoBELL_R + 0.07, 0.20, PALETTE.templeWoodDk, 0, 0, 0, 8);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    for (let k = 0; k < 2; k++) {
      B.sph(Math.cos(a) * (kyoBELL_R - 0.02), 0.30 + k * 0.34, Math.sin(a) * (kyoBELL_R - 0.02),
            0.09, 0.09, 0.09, PALETTE.templeWood);
    }
  }
  // the striking panel, which is the one polished spot on a bell of this age
  B.cyl(0, -0.10, kyoBELL_R - 0.03, 0.34, 0.10, PALETTE.gold, Math.PI / 2, 0, 0, 8);
  B.sph(0, kyoBELL_H * 0.5 + 0.16, 0, 0.26, 0.30, 0.26, PALETTE.templeWoodDk);
  const bell = new THREE.Mesh(B.build(), kyoVC());
  bell.castShadow = true;
  kyoBellGroup = new THREE.Group();
  kyoBellGroup.position.copy(kyoBellPos);
  kyoBellGroup.add(bell);
  root.add(kyoBellGroup);

  // ---- the shumoku, on two ropes, and the pull rope ------------------------
  const S = kyoMerger();
  S.cyl(0, 0, 0, 0.20, 2.60, PALETTE.templeWood, Math.PI / 2, 0, 0, 8);
  S.cyl(0, 0, 1.32, 0.23, 0.16, PALETTE.templeWoodDk, Math.PI / 2, 0, 0, 8);
  for (let s = -1; s <= 1; s += 2) {
    S.cyl(0, 1.05, s * 0.85, 0.045, 2.10, PALETTE.tatami, 0, 0, 0, 4);
  }
  const beam = new THREE.Mesh(S.build(), kyoVC());
  beam.castShadow = true;
  kyoBellBeam = new THREE.Group();
  // hangs outside the bell, on the +z side, aimed at the striking panel
  kyoBellBeam.position.set(bx, by + kyoBELL_RIM + 1.05, bz + kyoBELL_R + 1.85);
  kyoBellBeam.add(beam);
  root.add(kyoBellBeam);

  const R = kyoMerger();
  R.cyl(0, 0, 0, 0.05, 3.4, PALETTE.tatami, 0, 0, 0, 4);
  R.sph(0, -1.78, 0, 0.13, 0.20, 0.13, PALETTE.torii);
  const rope = new THREE.Mesh(R.build(), kyoVC());
  kyoBellRope = new THREE.Group();
  kyoBellRope.position.set(bx, by + 2.60, bz + kyoBELL_R + kyoBELL_ROPE_D);
  kyoBellRope.add(rope);
  root.add(kyoBellRope);
}

/** True when the capybara is standing inside the bell. */
function kyoUnderBell(p) {
  if (!p) return false;
  const dx = p.x - kyoBELL.x, dz = p.z - kyoBELL.z;
  return dx * dx + dz * dz < (kyoBELL_R - 0.18) * (kyoBELL_R - 0.18) &&
         p.y > kyoBellY - 0.6 && p.y < kyoBellY + 2.6;
}

/** The pull rope, for the beacon and for the grab. */
function kyoBellRopeAt() {
  return { x: kyoBELL.x, y: kyoBellY + 0.9, z: kyoBELL.z + kyoBELL_R + kyoBELL_ROPE_D };
}

// ================================================================ THE HERON ==
// NOT A TASK, AND DELIBERATELY NOT ONE.
//
// This chapter is the quietest place in the game and that is the joke — every
// line on its list is a small loud thing done somewhere that has been carefully
// arranged for several hundred years. There are koi in the pond already, and
// they are the right kind of life for it: slow, silent, and entirely indifferent.
// What the garden had nothing of was something that could DECIDE to leave.
//
// So there is a grey heron standing in the shallows, and the whole of it is the
// thing herons do — it stands still for a very long time, and then it does not.
// Come within nine metres and it goes: two wingbeats, a croak that is much
// uglier than the garden it lives in, one slow circuit of the pond, and it puts
// down at the far end and starts standing still again.
//
// There is no line on the to-do list for it and there should not be. A chapter
// needs things that are simply THERE, or every object in it is a switch.
const kyoHERON_A = { x: 48, z: -6 };       // the near shallows
const kyoHERON_B = { x: 6, z: -14 };       // and the far ones
const kyoHERON_NEAR = 9.0;                 // m at which it has had enough of you
const kyoHERON_UP = 2.2;                   // s of climb
const kyoHERON_ROUND = 11.0;               // s of circuit
const kyoHERON_DOWN = 2.6;                 // s of descent
const kyoHERON_REST = 26.0;                // s before it decides to move anyway
let kyoHeronGroup = null, kyoHeronWing = null;
// Its OWN scratch vector, and not one shared with any other accessor: two
// getters returning the same object hand a caller holding one of them the
// other one's answer. That exact bug cost time in Göreme — see gorV3b.
const kyoV3h = new THREE.Vector3();
let kyoHeronPhase = 0;                     // 0 standing, 1 up, 2 round, 3 down
let kyoHeronPerch = 0, kyoHeronPerchY = 0; // THE PERCH (N1) — see kyoUpdateHeron
let kyoHeronHeld = 0;                      // ...and "it is following you"
let kyoHeronSpooked = 0;                   // 1 if the bonsho is what moved it
let kyoHeronCrit = null;                   // the calm-aware radius. See THE CALM.
let kyoHeronT = 0;
let kyoHeronAt = 0;                        // 0 at A, 1 at B
let kyoHeronStalk = 0;
// ---- THE WINDOW (L6, F2 / design 2.5) -------------------------------------
// Kyoto had no event a player could be late for. The heron's rest clock is
// one: it goes up on kyoHERON_REST whatever you do, and `heron-lift` is a
// wheek under it as it lifts — inside kyoHERON_LIFT_R of where it stood,
// during the climb or the first breath of the circuit. `kyoHeronWait` is
// how long you have stood inside that ring waiting, which is the figure the
// record files (see the WINDOWS block in shared.js RECORDS); `kyoWheekT` is
// the last wheek, from the chapter's own `capy:wheek` listener, gated on the
// live biome like every other chapter's (see hanWheek's note).
const kyoHERON_LIFT_R = 14;
let kyoHeronWait = 0, kyoHeronLiftDone = false, kyoWheekT = 0;

function kyoBuildHeron(root) {
  const M = kyoMerger();
  // A HERON IS A LINE AND TWO ANGLES: a long body held level, a neck folded
  // into a Z, and legs that are most of the animal. Grey above, white below,
  // and the black eyestripe is the only mark on it that matters at distance.
  M.box(0, 0, 0, 0.34, 0.36, 1.05, PALETTE.heronGrey);
  M.box(0, -0.14, 0.05, 0.30, 0.16, 0.90, PALETTE.heronPale);
  // the folded neck: up, back, and then forward again
  M.box(0, 0.30, 0.34, 0.16, 0.44, 0.16, PALETTE.heronPale, 0.42, 0, 0);
  M.box(0, 0.56, 0.20, 0.15, 0.40, 0.15, PALETTE.heronPale, -0.55, 0, 0);
  M.box(0, 0.74, 0.36, 0.17, 0.20, 0.28, PALETTE.heronPale);
  M.box(0.07, 0.78, 0.40, 0.03, 0.05, 0.22, PALETTE.heronDark);
  M.box(-0.07, 0.78, 0.40, 0.03, 0.05, 0.22, PALETTE.heronDark);
  M.box(0, 0.72, 0.62, 0.06, 0.07, 0.34, PALETTE.heronBill);
  // the crest plume, which is the one flourish a heron allows itself
  M.box(0, 0.84, 0.20, 0.04, 0.04, 0.34, PALETTE.heronDark, 0.30, 0, 0);
  // legs
  for (let s = -1; s <= 1; s += 2) {
    M.box(s * 0.09, -0.42, -0.02, 0.05, 0.72, 0.05, PALETTE.heronLeg);
    M.box(s * 0.09, -0.76, 0.06, 0.06, 0.04, 0.22, PALETTE.heronLeg);
  }
  const body = new THREE.Mesh(M.build(), kyoVC());
  body.castShadow = true;
  kyoHeronGroup = new THREE.Group();
  kyoHeronGroup.name = 'kyoHeron';
  kyoHeronGroup.add(body);

  // The wings are their own group so they can be folded away entirely while it
  // is standing: a heron at rest has no wings to speak of, and two boards
  // sticking out of a bird that is not using them is the whole difference
  // between a heron and a weathervane.
  const W = kyoMerger();
  for (let s = -1; s <= 1; s += 2) {
    W.box(s * 0.62, 0, -0.06, 1.15, 0.06, 0.62, PALETTE.heronGrey, 0, 0, s * 0.10);
    W.box(s * 1.35, -0.04, -0.16, 0.60, 0.05, 0.44, PALETTE.heronDark, 0, s * 0.24, s * 0.18);
  }
  const wing = new THREE.Mesh(W.build(), kyoVC());
  kyoHeronWing = new THREE.Group();
  kyoHeronWing.add(wing);
  kyoHeronWing.visible = false;
  kyoHeronGroup.add(kyoHeronWing);
  root.add(kyoHeronGroup);
  kyoHeronPhase = 0; kyoHeronT = 0; kyoHeronAt = 0;
  kyoHeronWadeX = kyoHERON_A.x; kyoHeronWadeZ = kyoHERON_A.z;
}

const kyoHERON_APPR_STOP = 3.2;   // m short of the animal a heron will stop
const kyoHERON_APPR_MAX  = 9.0;   // m it will ever leave its perch by
let kyoHeronWadeX = 0, kyoHeronWadeZ = 0;
/** Shortest signed angle, so the stalk never spins the long way round. */
function kyoWrapY(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function kyoUpdateHeron(game, dt) {
  if (!kyoHeronGroup) return;
  kyoHeronT += dt;
  if (kyoWheekT > 0) kyoWheekT -= dt;      // the window's wheek memory (F2)
  const capy = game.capy;
  const cp = capy && capy.position;
  const from = kyoHeronAt ? kyoHERON_B : kyoHERON_A;
  const to = kyoHeronAt ? kyoHERON_A : kyoHERON_B;
  const standY = kyoWATER_Y + 0.86;

  // ---- THE PERCH (N1) ----------------------------------------------------
  // A GREY HERON STANDING ON A CAPYBARA is the best single frame this mechanic
  // can produce and the hardest one to earn: three wheeks from twelve metres,
  // then sit down and wait. Everything below assumes a bird in a pond — it
  // wades, it flushes when you are near, and it goes up on its own rest clock
  // after kyoHERON_REST whatever you are doing — and every one of those would
  // take a passenger off the animal's back for no reason the player could see.
  // `kyoHeronPerch` is re-asked every frame by `lift` on the herd offer, so a
  // bird cannot be stranded up there by a system that stopped writing.
  if (kyoHeronPerch > 0) {
    kyoHeronPerch = Math.max(0, kyoHeronPerch - dt);
    kyoHeronT = 0;                       // the rest clock does not run up there
    kyoHeronWing.visible = false;
    kyoHeronGroup.position.y = kyoHeronPerchY;
    kyoHeronGroup.rotation.set(-0.06, kyoHeronStalk, 0, 'YXZ');
    return;
  }
  if (kyoHeronPhase === 0) {
    // ---- ...AND IF YOU SIT DOWN IT COMES OVER (v23) --------------------
    // THE REGISTRY INVERTS. Past the loaf threshold systems.js publishes
    // `appr` on this heron's row and takes its flee radius to nothing; what
    // this chapter owns, and the only thing it owns, is where the bird's feet
    // are allowed to go. It wades from its perch toward the animal and stops
    // kyoHERON_APPR_STOP short — a heron does not stand next to you, it stands
    // NEAR you and pretends it has not noticed, which is exactly what a heron
    // in a pond actually does.
    //
    // The target is recomputed every frame off the LIVE capybara position and
    // damped, so it never becomes a path: get up and walk away and the bird
    // simply follows more slowly and then, as `appr` decays, wades back.
    let hx = from.x, hz = from.z;
    const ap = kyoHeronCrit ? (kyoHeronCrit.appr || 0) : 0;
    if (ap > 0.01 && cp) {
      const dx = cp.x - from.x, dz = cp.z - from.z;
      const d = Math.hypot(dx, dz);
      if (d > kyoHERON_APPR_STOP) {
        const reach = Math.min(kyoHERON_APPR_MAX, d - kyoHERON_APPR_STOP) * ap;
        hx = from.x + dx / d * reach;
        hz = from.z + dz / d * reach;
      }
    }
    kyoHeronWadeX = damp(kyoHeronWadeX, hx, 1.1, dt);
    kyoHeronWadeZ = damp(kyoHeronWadeZ, hz, 1.1, dt);
    kyoHeronGroup.position.set(kyoHeronWadeX, standY, kyoHeronWadeZ);
    // it turns its head, very slowly, and about once every eleven seconds it
    // moves one foot — unless it is coming over, in which case it is looking
    // at you, because a bird that walks toward you facing sideways is a bug.
    const stalkWant = ap > 0.5 && cp
      ? kyoWrapY(Math.atan2(cp.x - kyoHeronWadeX, cp.z - kyoHeronWadeZ))
      : Math.sin(kyoHeronT * 0.21) * 0.9;
    kyoHeronStalk = damp(kyoHeronStalk, stalkWant, 1.4, dt);
    kyoHeronGroup.rotation.set(0, kyoHeronStalk, 0);
    kyoHeronWing.visible = false;
    // ...and the reach shrinks as the animal settles, which is the one place
    // in this garden where standing perfectly still is rewarded with something
    // NOT happening. The rest timer is untouched, so the heron still goes up
    // on its own clock and the moment can never be locked out. See THE CALM.
    if (!kyoHeronCrit && typeof game.addCritter === 'function') {
      // bold: a heron in a garden pond is the boldest animal in the game and
      // is the direct test of the inverted registry. See THE LOAF.
      kyoHeronCrit = game.addCritter({ biome: 'kyoto', r: kyoHERON_NEAR, bold: 1 });
      // ---- ...AND IT IS THE HARDEST THING IN THE GAME TO RECRUIT ----------
      // obey 3, the ceiling, and there is exactly one animal at it. A heron is
      // the whole argument for the tier system: it answers the FIRST wheek —
      // the head comes round and it looks at you, on rule 3, like everything
      // else in earshot — and then it does not move, and it does not move
      // again, and on the third wheek inside the memory window it walks over
      // and falls in behind a rodent. One bird, and it is worth more than the
      // hundred and eighty pigeons.
      //
      // Only ever offered while it is STANDING (phase 0). A heron in the air
      // is doing the thing the chapter is actually about and the herd may not
      // reach up and pull it out of that.
      if (typeof game.herdOffer === 'function') {
        game.herdOffer({
          biome: 'kyoto', kind: 'heron', obey: 3, voice: 'gull', pitch: 0.62,
          count: function () { return kyoHeronPhase === 0 ? 1 : 0; },
          at: function (i, o) {
            o.x = kyoHeronWadeX; o.z = kyoHeronWadeZ;
            o.y = kyoHeronGroup ? kyoHeronGroup.position.y : 0;
          },
          put: function (i, x, z, yaw) {
            if (kyoHeronPhase !== 0 || !kyoHeronGroup) return;
            kyoHeronHeld = 0.25;         // re-asked every frame — see above
            kyoHeronWadeX = x; kyoHeronWadeZ = z;
            kyoHeronGroup.position.x = x;
            kyoHeronGroup.position.z = z;
            kyoHeronStalk = kyoWrapY(yaw);
            kyoHeronGroup.rotation.set(0, kyoHeronStalk, 0);
          },
          // TWO SEATS. A grey heron is a metre tall with a metre and a half of
          // leg and neck; one seat would have it standing on a capybara's
          // shoulder like a budgerigar. See THE PERCH in systems.js.
          span: 2,
          lift: function (i, y) {
            kyoHeronPerch = 0.25;        // re-asked every frame — see above
            kyoHeronPerchY = y;
            if (kyoHeronGroup) kyoHeronGroup.position.y = y;
          },
          // ---- ...AND IT MAY LEAVE THE GARDEN (N3 → L6, F1) -------------
          // See THE COMPANION in systems.js, which draws its own heron. The
          // clone this handed over shared the garden's materials by reference
          // with a chapter that is detached on the far side.
          travels: true,
        });
      }
    }
    let near = cp && Math.hypot(cp.x - from.x, cp.z - from.z) <
               (kyoHeronCrit ? kyoHeronCrit.near : kyoHERON_NEAR);
    // ---- THE STONES ARE A REASON TO HOLD (v26) --------------------------
    // A live dry crossing suppresses the PROXIMITY flush and nothing else: the
    // rest timer above is untouched, exactly as the calm inversion leaves it,
    // so the bird still goes up on its own clock and the moment can never be
    // locked out. Falling in flushes it on that frame instead — the splash and
    // the bark together, which is the joke.
    if (near && kyoDryCrossing()) near = false;
    if (kyoDrySpook) { kyoDrySpook = 0; near = true; }
    // ---- A BIRD THAT HAS AGREED TO FOLLOW YOU IS NOT FRIGHTENED OF YOU (N1)
    //
    // MEASURED 8 Sep 2026 (`qa/n1-perch.js`): the heron joins on the third
    // wheek from twelve metres and then walks the trail INTO its own nine-metre
    // flush radius, which puts it up; and if it survives that, `kyoHERON_REST`
    // is 26 s against a recruitment that takes fifteen and a loaf that takes
    // another ten. Measured `led: 1` at t=0 and `led: 0` by t=18, every run,
    // with nothing ever getting onto the animal's back. The heron was
    // unperchable by arithmetic.
    //
    // Both are suppressed while it is HELD — `kyoHeronHeld` is re-asked by the
    // herd's own `put`, so it is only ever up while systems.js is actively
    // walking this bird — and neither is weakened for one frame otherwise. The
    // dry-crossing suppression above deliberately leaves the rest clock alone
    // "so the moment can never be locked out"; this cannot lock it out either,
    // because the herd's own hold is 21 s and the clock resumes the instant the
    // bird stops following.
    if (kyoHeronHeld > 0) { kyoHeronHeld = Math.max(0, kyoHeronHeld - dt); near = false; kyoHeronT = 0; }
    // ---- THE WINDOW (L6, F2): the countdown on the live line, and the wait.
    // Handed over only inside forty metres, so the pond's clock does not sit
    // on the paper while the player is at Uji.
    {
      const dw = cp ? Math.hypot(cp.x - kyoHeronWadeX, cp.z - kyoHeronWadeZ) : 999;
      kyoHeronWait = dw < kyoHERON_LIFT_R ? kyoHeronWait + dt : 0;
      if (dw < 40 && game.recordLive) game.recordLive('heron-lift', Math.max(0, kyoHERON_REST - kyoHeronT));
    }
    if (near || kyoHeronT > kyoHERON_REST) {
      kyoHeronPhase = 1; kyoHeronT = 0;
      // A heron's alarm call is a single harsh bark and it is genuinely the
      // ugliest noise in this garden, which is the point of putting one here.
      // ...and it is a heron's croak, not a gull at 0.44 (L7, E2): see sfxHeron
      if (game.sfx) game.sfx('heron', { volume: 0.7, pitch: 1.0 });
      // ---- ...AND THE WINGS THAT GO WITH IT (A3) ------------------------
      // ONE BIRD, so `spread` is 0: this is not a flock crossing the frame, it
      // is four slow heavy beats where it stood. The garden's own note says the
      // wings are their own group and are hidden while it stands — "two boards
      // sticking out of a bird that is not using them" — and this is the sound
      // of them coming out. No cries: it has already made the only noise a
      // heron makes, on the line above.
      if (typeof game.wingburst === 'function') {
        game.wingburst(kyoHeronWadeX, kyoWATER_Y + 1.1, kyoHeronWadeZ,
                       { key: 'kyo:heron', near: 12, far: 110, n: 4, dur: 1.05,
                         spread: 0, pitch: 0.62, volume: 1.05, cries: false });
      }
    }
    return;
  }
  // ...and if it was the BELL that put it up, it says so, louder, and it says
  // it late — a heron leaving under a nine-second note is the one moment in
  // this chapter where two of its set pieces are in the same shot.
  if (kyoHeronSpooked && kyoHeronPhase === 1 && kyoHeronT > 0.34) {
    kyoHeronSpooked = 0;
    if (game.sfx) game.sfx('heron', { volume: 0.95, pitch: 0.92 });
  }

  // ---- THE WINDOW (L6, F2): `heron-lift` — a wheek inside the ring while
  // it is climbing, or in the first second and a half of the circuit. The
  // wait it took is the figure; the record row is keyed by the task id.
  if (!kyoHeronLiftDone && kyoWheekT > 0 && cp &&
      (kyoHeronPhase === 1 || (kyoHeronPhase === 2 && kyoHeronT < 1.5)) &&
      Math.hypot(cp.x - from.x, cp.z - from.z) < kyoHERON_LIFT_R) {
    kyoHeronLiftDone = true; kyoWheekT = 0;
    kyoTask('heron-lift');
    if (typeof game.record === 'function') game.record('heron-lift', Math.round(kyoHeronWait));
    if (typeof game.recordEnd === 'function') game.recordEnd('heron-lift');
    if (game.toast) game.toast('it barked. you barked back. that is the whole of the conversation.');
  }
  // ---- where it is on the way over ---------------------------------------
  let x, y, z, yaw, flap;
  if (kyoHeronPhase === 1) {
    const u = clamp(kyoHeronT / kyoHERON_UP, 0, 1);
    x = from.x; z = from.z;
    y = standY + u * u * 7.0;
    yaw = Math.atan2(to.x - from.x, to.z - from.z);
    flap = 1;
    if (u >= 1) { kyoHeronPhase = 2; kyoHeronT = 0; }
  } else if (kyoHeronPhase === 2) {
    const u = clamp(kyoHeronT / kyoHERON_ROUND, 0, 1);
    // one long lazy arc out over the water rather than a straight line: a bird
    // that flies A to B on the shortest path is a paper dart
    const a = Math.PI * u;
    const mx = (from.x + to.x) * 0.5, mz = (from.z + to.z) * 0.5;
    const rx = (to.x - from.x) * 0.5, rz = (to.z - from.z) * 0.5;
    x = mx - Math.cos(a) * rx + Math.sin(a) * rz * 0.55;
    z = mz - Math.cos(a) * rz - Math.sin(a) * rx * 0.55;
    y = standY + 7.0 + Math.sin(a) * 3.2;
    const a2 = Math.PI * Math.min(1, u + 0.02);
    const nx = mx - Math.cos(a2) * rx + Math.sin(a2) * rz * 0.55;
    const nz = mz - Math.cos(a2) * rz - Math.sin(a2) * rx * 0.55;
    yaw = Math.atan2(nx - x, nz - z);
    // A heron flaps in bursts and then holds. Two beats, a long glide, two
    // more: the rhythm is most of what makes a big bird read as a big bird.
    flap = Math.sin(kyoHeronT * 1.05) > 0.15 ? 1 : 0;
    if (u >= 1) { kyoHeronPhase = 3; kyoHeronT = 0; }
  } else {
    const u = clamp(kyoHeronT / kyoHERON_DOWN, 0, 1);
    x = to.x; z = to.z;
    y = lerp(standY + 7.0, standY, u * u * (3 - 2 * u));
    yaw = Math.atan2(to.x - from.x, to.z - from.z);
    flap = u > 0.55 ? 1 : 0;                 // it back-pedals into the landing
    if (u >= 1) {
      kyoHeronPhase = 0; kyoHeronT = 0;
      kyoHeronAt = kyoHeronAt ? 0 : 1;
      if (game.sfx) game.sfx('rustle', { volume: 0.22, pitch: 1.15 });
      return;
    }
  }

  kyoHeronGroup.position.set(x, y, z);
  kyoHeronGroup.rotation.set(kyoHeronPhase === 3 ? 0.34 : -0.06, yaw, 0, 'YXZ');
  kyoHeronWing.visible = true;
  // the beat itself: slow, and it never quite closes — a two-metre wing at full
  // fold looks like a bird that has been shot
  const beat = flap ? Math.sin(kyoHeronT * 8.4) : Math.sin(kyoHeronT * 1.4) * 0.18;
  kyoHeronWing.rotation.z = beat * 0.46;
  kyoHeronWing.position.set(0, 0.08 + beat * 0.06, -0.02);
}

function kyoUpdateBell(game, dt) {
  if (!kyoBellGroup) return;
  const capy = game.capy;
  const cp = capy && capy.position;
  const input = game.input;

  // ---- the pull -----------------------------------------------------------
  if (cp && input && input.actionPressed) {
    const r = kyoBellRopeAt();
    const dx = cp.x - r.x, dz = cp.z - r.z;
    if (dx * dx + dz * dz < 2.6 * 2.6) {
      if (kyoBellWind < 0 && kyoBellRing <= 0) {
        kyoBellWind = kyoBELL_WIND;
        kyoBellTick = 0;
        if (game.sfx) game.sfx('rustle', { volume: 0.8 });
        if (game.toast) game.toast('four seconds. you know where you want to be.');
      } else if (game.toast) {
        // ---- IT WAS SILENT ABOUT BEING BUSY -------------------------------
        // The rope refuses for nine seconds after a strike and said nothing at
        // all about it, so a player who missed the run under the rim pressed E
        // at a rope that had simply stopped working. A bell that is already
        // going is a fact about the world, and it is funnier said out loud.
        if (kyoBellSaid <= 0) {
          kyoBellSaid = 2.2;
          game.toast(kyoBellRing > 0 ? 'it is still going. everything is still going.'
                                     : 'it is on its way. go.');
        }
      }
    }
  }
  if (kyoBellSaid > 0) kyoBellSaid -= dt;

  // ---- THE FOUR SECONDS ARE THE MECHANIC AND THERE WAS NO CLOCK ----------
  // The whole of the mini is "you have four seconds to get a metre of daylight
  // under the rim", and between the pull and the strike absolutely nothing
  // happened: no count, no rising anything, no tell that the beam was coming
  // in. A wooden knock a second, climbing, so the last one lands on the strike
  // and you can hear how long you have without looking away from the ground.
  if (kyoBellWind >= 0) {
    kyoBellTick -= dt;
    if (kyoBellTick <= 0) {
      kyoBellTick = 1.0;
      const left = Math.max(0, kyoBellWind);
      if (game.sfx) {
        game.sfx('tick', { volume: 0.34 + (kyoBELL_WIND - left) * 0.10,
                           pitch: 0.72 + (kyoBELL_WIND - left) * 0.22,
                           at: { x: kyoBELL.x, y: kyoTerrain(kyoBELL.x, kyoBELL.z) + 3, z: kyoBELL.z } });
      }
    }
  }

  // ---- the wind-up. The beam draws back, then comes in ---------------------
  let draw = 0;
  if (kyoBellWind >= 0) {
    kyoBellWind -= dt;
    const t = 1 - clamp(kyoBellWind / kyoBELL_WIND, 0, 1);
    // out for the first two thirds, in fast for the last third
    draw = t < 0.68 ? Math.sin(t / 0.68 * Math.PI * 0.5) * 2.35
                    : 2.35 * (1 - Math.pow((t - 0.68) / 0.32, 1.6));
    if (kyoBellWind < 0) {
      kyoBellWind = -1;
      kyoBellRing = kyoBELL_RING;
      kyoBellRung = true;
      draw = 0;
      // A bonsho is felt before it is heard. The organ voice an octave and a
      // half down is the lowest thing this game can make, and it is exactly
      // what the sound is for.
      if (game.sfx) {
        game.sfx('organ', { volume: 1.0, pitch: 0.34, force: true });
        game.sfx('thud', { volume: 0.9, pitch: 0.5 });
      }
      // M4: the bonsho, and it was the LARGEST shake request in the game —
      // 1.6 times the cap — arriving with no lens kick, no pad and no freeze.
      // Standing under it stops the world for ninety milliseconds; hearing it
      // from across the valley does not, which is the whole difference.
      if (game.punch) game.punch(kyoUnderBell(cp) ? 0.55 : 0.22, kyoUnderBell(cp) ? 0.09 : false);
      else if (game.shake) game.shake(kyoUnderBell(cp) ? 0.55 : 0.22);
      // THE VALLEY HEARS IT. The loudest object in Japan went off and the only
      // thing in the chapter that changed was a number on a checklist: the
      // heron went on standing, the koi went on circling, and nine seconds of
      // the lowest note in the game landed on a garden that did not react to
      // it. A bell is only enormous if something else agrees that it is.
      kyoBellWave = 1;
      // ...AND THE VALLEY, NOT JUST THE POND. kyoBellWave decays over sixteen
      // seconds, which is right for koi going deep and coming back up and much
      // too slow for anything that gets HIT by a shock front. kyoBellPulse is
      // the same event on a two-second envelope: it is what the forty paper
      // lanterns in Gion swing on, what gusts the petals, what shivers the
      // grove and what puts the cormorants off their boats. One strike, five
      // things in five different parts of the chapter, all of them agreeing
      // about the same moment.
      kyoBellPulse = 1;
      if (kyoHeronPhase === 0) { kyoHeronPhase = 1; kyoHeronT = 0; kyoHeronSpooked = 1; }
      if (!kyoBellHit && kyoUnderBell(cp)) {
        kyoBellHit = true;
        kyoTask('the-bell');
      } else if (!kyoBellHit && game.toast) {
        game.toast('not from out here, it isn’t.');
      }
    }
  }
  kyoBellBeam.position.z = kyoBELL.z + kyoBELL_R + 1.85 + draw;
  if (kyoBellRope) kyoBellRope.rotation.x = -draw * 0.06;

  // ---- the note -----------------------------------------------------------
  if (kyoBellRing > 0) {
    kyoBellRing -= dt;
    const k = clamp(kyoBellRing / kyoBELL_RING, 0, 1);
    // the shell itself is still moving for the whole nine seconds, and from
    // inside it that is the entire picture
    const w = Math.sin((kyoBELL_RING - kyoBellRing) * 26) * 0.035 * k;
    kyoBellGroup.scale.set(1 + w, 1 - w * 0.5, 1 - w);
    kyoBellGroup.rotation.z = Math.sin((kyoBELL_RING - kyoBellRing) * 3.1) * 0.035 * k;
    // HOLD the swell for as long as it hangs — swell() takes the max of the
    // live envelope, so calling it every frame is the documented way to hold.
    if (game.music && typeof game.music.swell === 'function' && kyoUnderBell(cp)) {
      game.music.swell(0.45 * k);
    }
    if (kyoBellRing <= 0) {
      kyoBellGroup.scale.set(1, 1, 1);
      kyoBellGroup.rotation.z = 0;
    }
  }
}

// ================================================================== UJI ======
function kyoBuildUji(game, root) {
  const U = kyoMerger();

  // --- the bridge over the Uji: timber, humped, with the little shrine bay
  const bz = kyoRIVER_Z, bx = kyoBRIDGE_X;
  const N = 12, L = (kyoRIVER_HZ + 8) * 2;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const z = bz - L * 0.5 + t * L;
    const y = 1.5 + Math.sin(t * Math.PI) * 1.5;
    U.box(bx, y, z, 8.0, 0.35, L / N + 0.4, PALETTE.templeWood);
    // top at y + 0.175, which is where the PLANKS are. It was y + 0.02, so the
    // whole hump of the Uji bridge — the place the chapter's set piece starts
    // from — was walked fifteen centimetres inside its own deck.
    kyoStaticBox(game, bx, y - 0.065, z, 4.0, 0.24, L / N * 0.6);
    if (i % 2 === 0) {
      for (let s = -1; s <= 1; s += 2) {
        U.box(bx + s * 3.9, y + 0.75, z, 0.20, 1.2, 0.20, PALETTE.templeWoodDk);
        U.box(bx + s * 3.9, y + 1.38, z, 0.34, 0.18, L / N + 0.5, PALETTE.templeWoodDk);
      }
    }
    // ---- AND THE BALUSTRADE IS SOLID, EXCEPT WHERE IT IS THE DOOR ----------
    // Posts every other segment and a rail over them, drawn and never collided:
    // a humped deck three metres over a river with a balustrade you walk
    // through is a plank, which is Hanoi's Huc bridge word for word. Collided
    // on EVERY segment, not every other one, because the gap between two posts
    // is exactly the width an animal falls through.
    //
    // THE EAST SIDE IS LEFT OPEN AT THE SHRINE BAY. The bay hangs off this side
    // at bx + 4.6, outside the rail line at bx + 3.9, and it is where the Uji
    // run starts — "a set piece whose start is 'step off the edge' needs an
    // edge that looks like somewhere people step off". Colliding the rail
    // across it would wall off the only signposted way into the river, so the
    // rail stops short and the bay is the doorway. That is what a real bridge
    // with a shrine bay on it does.
    for (let s = -1; s <= 1; s += 2) {
      if (s > 0 && Math.abs(z - bz) < 2.6) continue;
      kyoStaticBox(game, bx + s * 3.9, y + 0.82, z, 0.22, 0.65, L / N * 0.6);
    }
    if (i > 0 && i < N - 1 && i % 3 === 0) {
      U.cyl(bx - 3.6, (y - 2.6) * 0.5, z, 0.28, y + 2.6, PALETTE.templeWoodDk);
      U.cyl(bx + 3.6, (y - 2.6) * 0.5, z, 0.28, y + 2.6, PALETTE.templeWoodDk);
    }
  }
  // ---- THE APPROACHES, WITHOUT WHICH NONE OF THE ABOVE EXISTS -------------
  // THE BRIDGE WAS UNREACHABLE. Not awkward — unreachable: a flood fill over
  // the physics surface, seeded from 1563 ground cells so every side was tried,
  // reached 0 of its 426 deck cells, and the smallest step onto it from
  // anywhere was 2.55 m against a standing jump that peaks at 0.75 m
  // (capyJUMP_V 6.0, gravity -24, v^2/2g). The deck ends at y = 1.5 because
  // `1.5 + sin(t*pi)*1.5` is 1.5 at both ends, and the banks are at -0.8 and
  // -1.5. Nothing was ever built to bridge that.
  //
  // Which means, until now: a 452 m2 structure with a full set of colliders, a
  // balustrade, a shrine bay, a stack of barrels put there as signposting, and
  // a local standing on the crown saying "The water for the tea comes from
  // under this bridge" — and no player had ever stood on any of it. The Uji run
  // survived only because its clock starts anywhere "at or above the bridge",
  // so the chapter's marquee could be finished by getting in somewhere else and
  // the defect never showed up as a broken task.
  //
  // Ramps rather than a lowered deck: the hump, the bay, the barrels, the
  // balustrade and every collider above keep the position they were authored
  // at, and a timber bridge with approach ramps is what the reference looks
  // like anyway. Graded at 0.25 — the default contact friction is 0.4, so
  // tan(theta) has to stay well under that or the animal slides back down —
  // and the LENGTH is derived from the rise at each end rather than fixed,
  // because the north bank is 0.7 m lower than the south.
  {
    const RAMP_GRADE = 0.25;
    const deckTop = 0.175;                     // the planks, above the deck centre
    for (let side = -1; side <= 1; side += 2) {
      const zEnd = bz + side * L * 0.5;         // the end of the span proper
      const yEnd = 1.5;                         // ...which is always this high
      // how far out do we have to go to come down to the bank at that grade?
      let run = 8;
      for (let k = 0; k < 6; k++) {
        const gy = kyoTerrain(bx, zEnd + side * run);
        const rise = (yEnd + deckTop) - (gy + 0.18);
        run = Math.max(6, Math.min(26, rise / RAMP_GRADE));
      }
      // SHORT SEGMENTS, BECAUSE A BOX HAS A FLAT TOP. The first cut used the
      // span's own 3.8 m segments and built a STAIRCASE with 0.78 m risers —
      // three centimetres above the jump — so the fill still reported 0 of 426.
      // A metre a segment puts each riser at about 0.27 m, which reads as a
      // slope and walks like one.
      const RN = Math.max(6, Math.round(run / 1.1));
      for (let i = 1; i <= RN; i++) {
        const t = i / RN;
        const z = zEnd + side * run * t;
        const gy = kyoTerrain(bx, z);
        // straight line down to the bank, but never under it
        const y = Math.max(yEnd + (gy + 0.18 - deckTop - yEnd) * t, gy + 0.12);
        U.box(bx, y, z, 8.0, 0.35, run / RN + 0.4, PALETTE.templeWood);
        kyoStaticBox(game, bx, y - 0.065, z, 4.0, 0.24, (run / RN) * 0.6);
        // the same balustrade as the span, and collided for the same reason
        if (i < RN) {
          for (let s = -1; s <= 1; s += 2) {
            U.box(bx + s * 3.9, y + 0.75, z, 0.20, 1.2, 0.20, PALETTE.templeWoodDk);
            U.box(bx + s * 3.9, y + 1.38, z, 0.34, 0.18, run / RN + 0.5, PALETTE.templeWoodDk);
            kyoStaticBox(game, bx + s * 3.9, y + 0.82, z, 0.22, 0.65, (run / RN) * 0.6);
          }
        }
      }
    }
  }

  // The shrine bay halfway across — where the water for the tea is drawn, and,
  // since chapter four acquired a river run, where you get in. The stack of
  // barrels is the whole of the signposting: a set piece whose start is "step
  // off the edge" needs an edge that looks like somewhere people step off.
  for (let k = 0; k < 3; k++) {
    const bxx = bx + 5.6 - (k % 2) * 1.3, byy = 3.4 + Math.floor(k / 2) * 1.05, bzz = bz + 1.0 - k * 0.9;
    U.cyl(bxx, byy, bzz, 0.62, 1.05, PALETTE.templeWood, k === 2 ? 1.4 : 0, k * 0.7, 0, 8);
    U.cyl(bxx, byy + (k === 2 ? 0 : 0.54), bzz + (k === 2 ? 0.52 : 0), 0.50, 0.10,
          PALETTE.matchaField, k === 2 ? 1.4 : 0, k * 0.7, 0, 8);
  }
  U.box(bx + 4.6, 3.0, bz, 2.6, 0.35, 3.2, PALETTE.templeWood);
  U.box(bx + 5.6, 4.2, bz, 0.24, 2.2, 0.24, PALETTE.templeWoodDk);
  U.box(bx + 4.6, 5.3, bz, 3.4, 0.32, 3.8, PALETTE.kawara);
  kyoStaticBox(game, bx + 4.6, 2.8, bz, 1.3, 0.24, 1.6);

  // --- the tea town: a short street of shops, all of them selling the same
  // thing. Widths and heights vary and there is a real gap between them: a row
  // of identical boxes butted edge to edge is a wall, not a street.
  const uW = [7.0, 5.6, 8.2, 6.2, 7.4, 5.2];
  const uH = [4.8, 4.0, 5.4, 4.4, 5.0, 4.2];
  for (let i = 0; i < 6; i++) {
    for (let s = -1; s <= 1; s += 2) {
      const x = kyoUJI.x - 24 + i * 10;
      const z = kyoUJI.z + s * 9;
      const y = kyoTerrain(x, z);
      const w = uW[(i + (s > 0 ? 3 : 0)) % 6], h = uH[(i + (s > 0 ? 2 : 0)) % 6];
      U.box(x, y + h * 0.5, z, w, h, 6.4, i % 2 ? PALETTE.templeWood : PALETTE.adobeWall);
      // the shopfront: a dark timber frame with paper panels above it
      U.box(x, y + 1.1, z - s * 3.3, w - 0.8, 2.2, 0.16, PALETTE.shojiFrame);
      U.box(x, y + h * 0.78, z - s * 3.3, w - 1.4, h * 0.30, 0.16, PALETTE.shoji);
      // pitched, for the reason Gion's are — see kyoBuildGion
      const RISE = 1.2, HD = 4.1;
      const PIT = Math.atan2(RISE, HD);
      for (let e = -1; e <= 1; e += 2) {
        U.box(x, y + h + 0.30 + RISE * 0.5, z + e * HD * 0.5,
              w + 1.6, 0.34, HD + 0.5, PALETTE.kawara, -e * PIT, 0, 0);
        U.box(x, y + h + 0.16, z + e * (HD + 0.28),
              w + 1.9, 0.28, 1.0, PALETTE.kawaraDark, -e * PIT, 0, 0);
      }
      U.box(x, y + h + 1.52, z, w + 1.6, 0.28, 0.56, PALETTE.kawaraDark);
      // the noren, and a green signboard because everything here is tea
      U.box(x, y + 2.5, z - s * 3.55, w - 1.6, 1.0, 0.10, PALETTE.matchaField);
      U.box(x - w * 0.36, y + 1.6, z - s * 3.7, 0.5, 2.6, 0.5, PALETTE.templeWoodDk);
      kyoStaticBox(game, x, y + h * 0.5, z, w * 0.5, h * 0.5, 3.2);
      kyoStaticBox(game, x - w * 0.36, y + 1.6, z - s * 3.7, 0.24, 1.3, 0.24);   // the signpost (V1)
    }
  }

  // --- the matcha terraces on the eastern slope: stepped hedgerows under black
  // shade canopies, which is genuinely how the good stuff is grown
  // Nine rows stepping UP the slope, each on its own retained shelf with a
  // stone face — terraces are the whole reason tea from a hillside is worth
  // more than tea from a field, and a flat row of hedges says nothing at all.
  for (let r = 0; r < 9; r++) {
    // Starts clear of the river: the first shelf used to sit at z = 124, which
    // is inside the Uji itself, and tea does not grow underwater.
    // MOVED EAST AND SOUTH, twice now. The comment below is the first move; the
    // second is the river's return leg, which used to run straight through rows
    // one to four — the tea was growing in the middle of the set piece.
    const z = kyoUJI.z + 6 + r * 7;
    const x0 = 96, x1 = 166, xm = (x0 + x1) * 0.5;
    const y = kyoTerrain(xm, z) + r * 1.15;
    // the retaining wall this shelf stands on, seen from downhill
    U.box(xm, y - 0.55, z - 3.2, x1 - x0, 1.4, 0.7, PALETTE.granite);
    U.box(xm, y + 0.08, z, x1 - x0, 0.5, 6.6, PALETTE.paramoSoil);
    // three hedgerows, clipped into the rounded ridges they always are
    for (let k = 0; k < 3; k++) {
      const hz = z - 2.1 + k * 2.1;
      U.box(xm, y + 0.75, hz, x1 - x0 - 2, 1.0, 1.15,
            k === 1 ? PALETTE.matchaField : PALETTE.matchaPale);
      U.cyl(xm, y + 1.25, hz, 0.58, x1 - x0 - 2, k === 1 ? PALETTE.matchaField : PALETTE.matchaPale,
            0, 0, Math.PI / 2, 6);
    }
    // shade canopies over every third row, on real posts
    if (r % 3 === 0) {
      for (let px = x0 + 5; px < x1; px += 13) {
        U.box(px, y + 2.3, z - 2.9, 0.20, 3.4, 0.20, PALETTE.templeWoodDk);
        U.box(px, y + 2.3, z + 2.9, 0.20, 3.4, 0.20, PALETTE.templeWoodDk);
      }
      U.box(xm, y + 3.9, z, x1 - x0 - 2, 0.14, 6.2, PALETTE.teaCanopy);
    }
  }

  // --- the stone mill: a granite wheel that grinds the leaf into powder, and
  // the sacks of it stacked beside, which is the thing worth getting into
  const mx = kyoUJI.x - 16, mz = kyoUJI.z + 24, my = kyoTerrain(mx, mz);
  U.box(mx, my + 1.4, mz, 9.0, 2.8, 7.0, PALETTE.adobeWall);
  U.box(mx, my + 3.0, mz, 10.6, 0.4, 8.4, PALETTE.kawara);
  kyoStaticBox(game, mx, my + 1.4, mz, 4.5, 1.4, 3.5);
  U.cyl(mx + 6.4, my + 0.6, mz, 2.4, 1.2, PALETTE.granite, 0, 0, 0, 8);
  U.cyl(mx + 6.4, my + 1.35, mz, 1.9, 0.5, PALETTE.graniteDark, 0, 0, 0, 8);
  kyoStaticBox(game, mx + 6.4, my + 0.6, mz, 2.2, 0.8, 2.2);

  const m = new THREE.Mesh(U.build(), kyoVC());
  m.castShadow = true;
  m.receiveShadow = true;
  root.add(m);

  // --- the matcha pile: the payoff. A conical heap of powder beside the mill,
  // which explodes into a green cloud the moment a capybara touches it.
  const H = kyoMerger();
  H.cone(0, 0.55, 0, 1.9, 1.1, PALETTE.matchaPowder);
  H.cone(0, 0.20, 0, 2.3, 0.4, PALETTE.matchaPowder);
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2;
    H.box(Math.cos(a) * 2.9, 0.55, Math.sin(a) * 2.9, 1.2, 1.1, 0.9, PALETTE.potatoSack, 0, a, 0.12);
  }
  const heap = new THREE.Mesh(H.build(), kyoVC());
  heap.position.set(mx + 6.4, my + 1.6, mz);
  heap.castShadow = true;
  root.add(heap);
  kyoMatchaHeap = heap;

  kyoMatchaCloud = new THREE.InstancedMesh(
    kyoG.sph6, mat(PALETTE.matchaPowder, { transparent: true, opacity: 0.55, depthWrite: false }), 20);
  kyoMatchaCloud.frustumCulled = false;
  kyoMatchaCloud.castShadow = false;
  for (let i = 0; i < 20; i++) kyoMatchaCloud.setMatrixAt(i, kyoXform(0, -900, 0, 0, 0, 0, 0.001, 0.001, 0.001));
  kyoMatchaCloud.instanceMatrix.needsUpdate = true;
  root.add(kyoMatchaCloud);
}

let kyoMatchaHeap = null;

// ========================================================= THE ENORMOUS BOWL ==
/**
 * At the far end of Uji there is a tea bowl four metres across with a bamboo
 * whisk standing in it. Run round the inside of the bowl and the whisk turns;
 * turn it fast enough and the tea comes to a proper froth, which is the last
 * task in the game and the only one that requires the capybara to do something
 * genuinely, patiently correct.
 */
function kyoBuildBowl(game, root) {
  const B = kyoMerger();
  const x = kyoBOWL.x, z = kyoBOWL.z, y = kyoTerrain(x, z);
  // the bowl: a ring of leaning slabs, a foot, and a disc of tea inside
  const R = 5.4, SEG = 14;
  for (let i = 0; i < SEG; i++) {
    const a = i / SEG * Math.PI * 2;
    B.box(x + Math.cos(a) * R, y + 1.5, z + Math.sin(a) * R,
          R * 2 * Math.PI / SEG + 0.5, 3.0, 0.7, PALETTE.indigo, 0.16, -a, 0);
    kyoStaticBox(game, x + Math.cos(a) * (R + 0.2), y + 1.5, z + Math.sin(a) * (R + 0.2),
                 R * Math.PI / SEG + 0.3, 1.5, 0.45, -a);
  }
  B.cyl(x, y + 0.35, z, R + 0.4, 0.7, PALETTE.graniteDark, 0, 0, 0, 8);
  B.cyl(x, y + 0.78, z, R - 0.2, 0.22, PALETTE.matchaField, 0, 0, 0, 8);
  kyoStaticBox(game, x, y + 0.35, z, R, 0.55, R);

  const bowl = new THREE.Mesh(B.build(), kyoVC());
  bowl.castShadow = true;
  bowl.receiveShadow = true;
  root.add(bowl);

  // the whisk (chasen): a handle and a skirt of split bamboo tines
  const W = kyoMerger();
  W.cyl(0, 1.9, 0, 0.34, 2.4, PALETTE.bambooPale, 0, 0, 0, 8);
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2;
    const r = 0.9;
    W.box(Math.cos(a) * r, 0.55, Math.sin(a) * r, 0.09, 1.3, 0.09, PALETTE.bambooPale,
          Math.sin(a) * 0.30, 0, -Math.cos(a) * 0.30);
    W.box(Math.cos(a) * r * 0.55, 1.25, Math.sin(a) * r * 0.55, 0.09, 0.6, 0.09, PALETTE.bambooStem);
  }
  kyoWhisk = new THREE.Mesh(W.build(), kyoVC());
  kyoWhisk.position.set(x, y + 0.9, z);
  kyoWhisk.castShadow = true;
  root.add(kyoWhisk);

  // the froth: a ring of pale bubbles that rises as the whisk is driven
  kyoFroth = new THREE.InstancedMesh(
    kyoG.sph6, mat(PALETTE.matchaPale, { transparent: true, opacity: 0.75 }), 24);
  kyoFroth.frustumCulled = false;
  for (let i = 0; i < 24; i++) kyoFroth.setMatrixAt(i, kyoXform(0, -900, 0, 0, 0, 0, 0.001, 0.001, 0.001));
  kyoFroth.instanceMatrix.needsUpdate = true;
  root.add(kyoFroth);
}

function kyoUpdateWhisk(game, dt) {
  if (!kyoWhisk) return;
  const capy = game.capy;
  const x = kyoBOWL.x, z = kyoBOWL.z, y = kyoTerrain(x, z);
  let drive = 0;
  if (capy && capy.position) {
    const dx = capy.position.x - x, dz = capy.position.z - z;
    const d2 = dx * dx + dz * dz;
    if (d2 < 5.2 * 5.2 && capy.position.y < y + 3.2 && capy.position.y > y - 1) {
      // tangential component of the capybara's velocity round the bowl: running
      // the rim drives the whisk, standing still in the middle does nothing
      const d = Math.sqrt(d2) || 1;
      const tx = -dz / d, tz = dx / d;
      drive = (capy.velocity.x * tx + capy.velocity.z * tz) * (d / 5.2);
    }
  }
  kyoWhiskSpin += drive * dt * 1.5;
  kyoWhisk.rotation.y = kyoWhiskSpin;
  const rate = Math.abs(drive);
  kyoWhiskFroth = clamp(kyoWhiskFroth + (rate > 3 ? dt * 0.34 : -dt * 0.22), 0, 1);
  kyoWhisk.position.y = y + 0.9 + Math.sin(kyoTime * 9) * 0.06 * kyoWhiskFroth;

  if (kyoFroth) {
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * Math.PI * 2 + kyoWhiskSpin * 0.35;
      const r = 1.4 + (i % 4) * 0.95;
      const s = kyoWhiskFroth * (0.35 + (i % 3) * 0.16);
      kyoFroth.setMatrixAt(i, kyoXform(x + Math.cos(a) * r,
                                       y + 0.92 + Math.sin(kyoTime * 4 + i) * 0.08 * kyoWhiskFroth,
                                       z + Math.sin(a) * r, 0, 0, 0, s, s * 0.6, s));
    }
    kyoFroth.instanceMatrix.needsUpdate = true;
  }

  if (!kyoWhiskDone && kyoWhiskFroth > 0.92) {
    kyoWhiskDone = true;
    if (typeof game.completeTask === 'function') game.completeTask('whisk-spin');
    if (typeof game.sfx === 'function') game.sfx('chime', { volume: 0.9 });
    if (typeof game.toast === 'function') game.toast('usucha. a perfect bowl of it. by a capybara. in a bowl.');
  }
}

// ============================================================== UJI STREET ==
/**
 * TWELVE TEA SHOPS FACING EACH OTHER ACROSS A LAWN.
 *
 * Gion has been paved since the chapter was written — fitted granite setts and
 * a gutter down each side — and Uji, the town the chapter ENDS in, had nothing
 * under it at all. Two rows of shopfronts with their noren out, standing on
 * grass, which is the one thing a Japanese town street has never been.
 *
 * The paving is the smaller half of it. What a tea street actually looks like
 * is the stuff standing ON the pavement: potted maples outside every second
 * door, the stone tsubo-niwa lanterns, the sample tins on trestles, and the
 * stack of tea chests nobody has moved since April. A street is furniture.
 */
function kyoBuildUjiStreet(game, root) {
  const S = kyoMerger();
  const cz = kyoUJI.z, x0 = kyoUJI.x - 32, x1 = kyoUJI.x + 30;
  const xm = (x0 + x1) * 0.5, len = x1 - x0;
  const y = kyoTerrain(xm, cz);
  // the road: rammed earth with a granite spine, crowned so it drains
  S.box(xm, y + 0.05, cz, len, 0.16, 11.4, PALETTE.gravelZen);
  S.box(xm, y + 0.09, cz, len, 0.14, 4.6, PALETTE.granite);
  for (let s = -1; s <= 1; s += 2) {
    // the gutter, which in Uji is an open stone channel with water in it
    S.box(xm, y + 0.02, cz + s * 5.1, len, 0.14, 0.9, PALETTE.graniteDark);
    S.box(xm, y + 0.06, cz + s * 5.1, len, 0.06, 0.5, PALETTE.ujiRiver);
  }
  kyoStaticBox(game, xm, y - 0.15, cz, len * 0.5, 0.28, 5.7);

  // the furniture, alternating down the two frontages
  for (let i = 0; i < 12; i++) {
    const px = x0 + 4 + i * 5.4;
    const s = i % 2 ? 1 : -1;
    const pz = cz + s * 4.4;
    const py = kyoTerrain(px, pz);
    // ---- AND THE FURNITURE IS SOLID (V1) --------------------------------
    // Twelve pieces along the tea street — planters, stone lanterns, a bench
    // with its chests — all between waist and head height on a capybara, and
    // every one of them drawn only. Boxes a little inside each.
    if (i % 3 === 0) {
      // a potted maple: a glazed tub, a short trunk and a flat crown
      kyoStaticBox(game, px, py + 0.45, pz, 0.55, 0.45, 0.55);
      S.cyl(px, py + 0.42, pz, 0.62, 0.84, PALETTE.indigo, 0, 0, 0, 8);
      S.cyl(px, py + 0.86, pz, 0.64, 0.10, PALETTE.paramoSoil, 0, 0, 0, 8);
      S.cyl(px, py + 1.55, pz, 0.10, 1.4, PALETTE.trunkDark, 0, 0, 0, 6);
      S.cyl(px, py + 2.20, pz, 1.05, 0.36, PALETTE.momiji, 0, rand(0, 3), 0, 6);
      S.cyl(px, py + 2.44, pz, 0.72, 0.28, PALETTE.momijiDeep, 0, rand(0, 3), 0, 6);
    } else if (i % 3 === 1) {
      // a stone lantern, knee high, of the kind that stands beside a doorway
      kyoStaticBox(game, px, py + 0.72, pz, 0.30, 0.72, 0.30);
      S.box(px, py + 0.14, pz, 0.72, 0.28, 0.72, PALETTE.graniteDark);
      S.cyl(px, py + 0.55, pz, 0.15, 0.60, PALETTE.granite, 0, 0, 0, 6);
      S.box(px, py + 0.98, pz, 0.60, 0.32, 0.60, PALETTE.gravelZen);
      S.cone(px, py + 1.28, pz, 0.56, 0.34, PALETTE.granite, 0, 0.4, 0, 6);
    } else {
      // a trestle of sample tins under the noren, and a stack of tea chests
      kyoStaticBox(game, px, py + 0.38, pz, 1.1, 0.38, 0.45);
      kyoStaticBox(game, px + 1.9, py + 0.62, pz, 0.42, 0.62, 0.42);
      S.box(px, py + 0.72, pz, 2.2, 0.10, 0.9, PALETTE.templeWood);
      for (let k = -1; k <= 1; k += 2) {
        S.box(px + k * 0.9, py + 0.36, pz, 0.10, 0.72, 0.8, PALETTE.templeWoodDk);
      }
      for (let k = 0; k < 4; k++) {
        S.cyl(px - 0.8 + k * 0.52, py + 0.90, pz + rand(-0.16, 0.16), 0.16, 0.26,
              k % 2 ? PALETTE.matchaField : PALETTE.gold, 0, 0, 0, 8);
      }
      S.box(px + 1.9, py + 0.34, pz, 0.9, 0.68, 0.9, PALETTE.teaSack, 0, rand(-0.2, 0.2), 0);
      S.box(px + 1.9, py + 0.96, pz, 0.86, 0.56, 0.86, PALETTE.teaSack, 0, rand(-0.2, 0.2), 0);
    }
  }
  const m = new THREE.Mesh(S.build(), kyoVC());
  m.castShadow = true;
  m.receiveShadow = true;
  root.add(m);
}

// ---- THE KERB, THE GUTTER AND THE JOINTS (L3, E2) ----
/**
 * THE LANE WAS ONE FLAT VALUE FROM NEAR TO FAR.
 *
 * qa/l3-kyoto.png: the Gion lane is 108 m of one granite value, forty to
 * fifty-five per cent of the settled frame with no shape in it at the one-to-
 * three-metre scale. The gutter kyoBuildGion draws down each side does not
 * help, because it sits UNDER the slab it was meant to edge — its top is at
 * ly + 0.09 against a slab top of ly + 0.13, so it shows as a fifteen-
 * centimetre sliver at the very edge and the lane reads as a poured floor.
 * Uji's is worse: both of its gutters, water and all, are wholly inside the
 * gravel bed. The Quay's apron is the counter-proof — a grid of joints and
 * the same slab reads as laid stone.
 *
 * Graphics only, one merged mesh, no collider and no new material: a kerb
 * line and a gutter stripe on each DRAWN edge, joints across the setts, a
 * manhole every twenty-five metres, a crossing where the lane is actually
 * crossed, a worn patch or two, and the gravel strip between Gion's kerb and
 * the machiya sills. Every line lands on the lanes' own constants — kyoGION_Z
 * and the 9.0 m slab; kyoUJI, the 11.4 m bed and its 4.6 m spine — so it
 * sits exactly on the edge that is already drawn. The strips off the slabs
 * are on the ground, and the ground is sampled per segment and the segment
 * pitched to it: nothing here has a flat y where kyoTerrain is not flat.
 */
function kyoBuildKerbs(game, root) {
  const K = kyoMerger();
  const KERB = PALETTE.graniteDark;     // one step down from the granite
  const GUTTER = PALETTE.kawaraDark;    // and one more
  const JOINT = PALETTE.graniteDark;    // a joint is quieter than a kerb
  const IRON = PALETTE.ironDark;
  const BAR = PALETTE.shoji;
  const GRAVEL = PALETTE.gravelZen;
  /** A strip along x whose TOP is topAt(x, z) + proud, in `seg`-metre pieces
   *  each pitched between its two ends. One piece when the surface is a slab. */
  function stripX(x0, x1, z, w, h, topAt, proud, color, seg) {
    const n = Math.max(1, Math.round((x1 - x0) / seg));
    for (let i = 0; i < n; i++) {
      const xa = lerp(x0, x1, i / n), xb = lerp(x0, x1, (i + 1) / n);
      const ya = topAt(xa, z) + proud, yb = topAt(xb, z) + proud;
      K.box((xa + xb) * 0.5, (ya + yb) * 0.5 - h * 0.5, z, Math.hypot(xb - xa, yb - ya) + 0.02,
            h, w, color, 0, 0, Math.atan2(yb - ya, xb - xa));
    }
  }

  // ---- Gion: the granite lane, kyoBuildGion's 108 x 9.0 slab at ly + 0.13 --
  {
    const lz = kyoGION_Z, ly = kyoTerrain(0, lz), top = ly + 0.13;
    const X0 = -54, X1 = 54, HZ = 4.5;
    const slab = () => top;
    for (let s = -1; s <= 1; s += 2) {
      stripX(X0, X1, lz + s * (HZ - 0.08), 0.16, 0.06, slab, 0.02, KERB, 1e9);
      stripX(X0, X1, lz + s * (HZ - 0.30), 0.14, 0.05, slab, 0.01, GUTTER, 1e9);
      // the gravel between the kerb and the sills: off the slab, so on the
      // ground, sampled every six metres
      stripX(X0, X1, lz + s * 5.0, 0.86, 0.06, kyoTerrain, 0.02, GRAVEL, 6);
    }
    // the setts: three courses down the lane and a joint every 2.4 m across
    for (let s = -1; s <= 1; s += 2) {
      K.box(0, top - 0.01, lz + s * 1.5, X1 - X0, 0.04, 0.06, JOINT);
    }
    for (let x = X0 + 2.4; x < X1 - 1; x += 2.4) {
      K.box(x, top - 0.01, lz, 0.06, 0.04, (HZ - 0.30) * 2 - 0.14, JOINT);
    }
    // a manhole every twenty-five metres, off the centre so the courses run
    for (let x = -40; x <= 40; x += 25) {
      K.cyl(x, top - 0.01, lz + 1.1, 0.30, 0.04, IRON, 0, 0, 0, 8);
    }
    // the crossing, between the late shopper and the sweeper (kyoLocLate,
    // kyoLocSweep stand at x = -6.5 and -2.0 on opposite sills)
    for (let k = 0; k < 8; k++) {
      K.box(-5, top - 0.005, lz + (k - 3.5), 2.8, 0.04, 0.5, BAR);
    }
    // two worn patches, a shade darker, where the carts have been turning
    K.box(22, top - 0.015, lz - 1.2, 2.4, 0.04, 1.5, KERB, 0, 0.18, 0);
    K.box(-31, top - 0.015, lz + 1.8, 1.9, 0.04, 1.3, KERB, 0, -0.26, 0);
  }

  // ---- Uji: kyoBuildUjiStreet's 11.4 m gravel bed at y + 0.13 with the
  // 4.6 m granite spine at y + 0.16 down the middle of it -------------------
  {
    const cz = kyoUJI.z, x0 = kyoUJI.x - 32, x1 = kyoUJI.x + 30;
    const y = kyoTerrain((x0 + x1) * 0.5, cz);
    const bed = y + 0.13, spine = y + 0.16;
    const onBed = () => bed, onSpine = () => spine;
    for (let s = -1; s <= 1; s += 2) {
      stripX(x0, x1, cz + s * (5.7 - 0.08), 0.16, 0.06, onBed, 0.02, KERB, 1e9);
      stripX(x0, x1, cz + s * (5.7 - 0.30), 0.14, 0.05, onBed, 0.01, GUTTER, 1e9);
      // and the spine's own edge, where the granite meets the rammed earth
      stripX(x0, x1, cz + s * 2.3, 0.08, 0.04, onSpine, 0.01, JOINT, 1e9);
    }
    for (let x = x0 + 2.0; x < x1 - 1; x += 2.0) {
      K.box(x, spine - 0.01, cz, 0.06, 0.04, 4.6, JOINT);
    }
    for (let x = x0 + 12; x < x1 - 4; x += 25) {
      K.cyl(x, spine - 0.01, cz + 0.9, 0.30, 0.04, IRON, 0, 0, 0, 8);
    }
    // the crossing, where the street is left for the mill and the bowl
    for (let k = 0; k < 8; k++) {
      const z = cz + (k - 3.5);
      K.box(kyoUJI.x - 5, (Math.abs(z - cz) < 2.3 ? spine : bed) - 0.005, z, 2.8, 0.04, 0.5, BAR);
    }
    K.box(kyoUJI.x + 14, spine - 0.015, cz + 0.6, 2.0, 0.04, 1.2, KERB, 0, 0.22, 0);
  }

  const m = new THREE.Mesh(K.build(), kyoVC());
  m.castShadow = false;                 // two centimetres of kerb throws nothing
  m.receiveShadow = true;
  root.add(m);
}

// ============================================================ THE PICKERS ===
/**
 * NINE TERRACES OF TEA AND NOBODY ON THEM.
 *
 * The eastern slope above Uji is the reason the chapter ends here: seventy
 * metres of stepped hedgerow under black shade canopies, which is genuinely how
 * gyokuro is grown, and there has never been one person working it. A tea
 * terrace with nobody on it is a hedge.
 *
 * Rio's and Marrakech's pattern, at a twentieth of the scale: one merged figure
 * and one merged head, two InstancedMeshes, an instanceColor each so the row is
 * not eighteen copies of one shirt, and a pose chosen once with a motion that
 * runs every frame. The motion is the whole point — a picker works BENT, with
 * both hands in the hedge, and straightens up about every eight seconds to put
 * a handful in the basket on her back. Two sines and it reads from eighty
 * metres.
 *
 * The shirt is authored WHITE because instanceColor MULTIPLIES the vertex
 * colour, and the head is its own mesh — otherwise a bright indigo jacket turns
 * somebody's face blue, which is the note Rio's crowd left behind.
 */
const kyoPICK_N = 22;
let kyoPickMesh = null, kyoPickHead = null, kyoPickData = null;
function kyoBuildPickers(root) {
  const B = kyoMerger();
  // bent at the waist: legs vertical, torso forward, both arms down and in
  B.box(-0.11, 0.36, 0, 0.17, 0.72, 0.19, 0xffffff);
  B.box(0.11, 0.36, 0, 0.17, 0.72, 0.19, 0xffffff);
  B.box(0, 0.88, 0.20, 0.48, 0.60, 0.30, 0xffffff, 0.85, 0, 0);
  for (let s = -1; s <= 1; s += 2) {
    B.box(s * 0.27, 0.74, 0.42, 0.12, 0.54, 0.12, 0xffffff, 0.45, 0, 0);
  }
  // THE BASKET, and it is what makes the silhouette a picker rather than a
  // person tying a shoelace: a deep pannier high on the back, and a cloth
  // shoulder strap over it.
  B.cyl(0, 1.06, -0.24, 0.24, 0.44, PALETTE.teaSack, 0.28, 0, 0, 8);
  B.cyl(0, 1.26, -0.28, 0.25, 0.06, PALETTE.matchaField, 0.28, 0, 0, 8);
  kyoPickMesh = new THREE.InstancedMesh(B.build(), kyoVC(), kyoPICK_N);
  kyoPickMesh.castShadow = true;
  kyoPickMesh.frustumCulled = false;
  kyoPickMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(kyoPICK_N * 3), 3);

  // the head, and the tenugui wrapped over it — everybody on a tea terrace in
  // June has a cloth on their head and it is the most recognisable thing about
  // the whole trade
  const H = kyoMerger();
  H.sph(0, 0, 0.42, 0.13, 0.15, 0.13, PALETTE.skin2);
  H.sph(0, 0.09, 0.40, 0.145, 0.11, 0.145, PALETTE.shoji);
  H.box(0, 0.03, 0.28, 0.28, 0.06, 0.26, PALETTE.shoji, 0.5, 0, 0);
  kyoPickHead = new THREE.InstancedMesh(H.build(), kyoVC(), kyoPICK_N);
  kyoPickHead.castShadow = false;
  kyoPickHead.userData.noShadow = true;
  kyoPickHead.frustumCulled = false;

  // DARK against a pale green hedge. The first cut ran through shoji and
  // tatami, which on a terrace of matchaPale is a person the colour of the
  // thing they are standing in.
  const shirts = [PALETTE.indigo, PALETTE.templeWoodDk, PALETTE.torii,
                  PALETTE.tatami, PALETTE.kawaraDark, PALETTE.templeWood];
  const c = new THREE.Color();
  kyoPickData = new Float32Array(kyoPICK_N * 4);      // x, z, yaw, phase
  for (let i = 0; i < kyoPICK_N; i++) {
    // ON A ROW, between two hedgerows, the way somebody working actually stands
    const r = i % 9;
    // THE SHELF'S OWN DATUM, sampled exactly the way kyoBuildUji samples it —
    // at the row's centreline and at the terrace mid-x — or the pickers stand a
    // few centimetres off the ground they are supposed to be working.
    const rz = kyoUJI.z + 6 + r * 7;
    // IN THE AISLE, NOT IN THE GAP. The three hedgerows stand 1.5 m high and
    // 1.2 m apart, so a picker in the 50 cm channel between two of them is
    // buried to the shoulders in tea — measured from the rendered frame: pale
    // blobs half-sunk in a hedge. The working aisle at the front of the shelf is
    // where a picker actually stands, and it is where she can be seen.
    const z = rz + ((i / 9 | 0) % 2 ? 2.85 : -2.85);
    const x = 100 + ((i * 37) % 63) + rand(-2.4, 2.4);
    const y = kyoTerrain((96 + 166) * 0.5, rz) + r * 1.15;
    kyoPickData[i * 4] = x;
    kyoPickData[i * 4 + 1] = z;
    kyoPickData[i * 4 + 2] = (i % 2 ? 1 : -1) * (Math.PI * 0.5) + rand(-0.3, 0.3);
    kyoPickData[i * 4 + 3] = rand(0, Math.PI * 2);
    kyoPickY[i] = y + 0.33;
    c.set(shirts[i % shirts.length]);
    kyoPickMesh.setColorAt(i, c);
  }
  if (kyoPickMesh.instanceColor) kyoPickMesh.instanceColor.needsUpdate = true;
  root.add(kyoPickMesh);
  root.add(kyoPickHead);
  kyoUpdatePickers(0);
}
const kyoPickY = new Float32Array(kyoPICK_N);
let kyoPickLast = -1;

/** A picker straightens up about every eight seconds. That is the whole
 *  animation, and it is enough because there are twenty-two of them and they
 *  are all out of phase. Rewritten at 20 Hz, like the grove. */
function kyoUpdatePickers(dt) {
  void dt;
  if (!kyoPickMesh) return;
  const tick = kyoTime * 20 | 0;
  if (tick === kyoPickLast) return;
  kyoPickLast = tick;
  for (let i = 0; i < kyoPICK_N; i++) {
    const o = i * 4;
    const ph = kyoPickData[o + 3];
    // 0 bent, 1 upright — mostly bent, and the rise is quick and the fall slow
    const u = Math.sin(kyoTime * 0.78 + ph);
    let up = clamp((u - 0.72) / 0.28, 0, 1);
    // ...UNLESS THE BELL HAS JUST GONE, in which case every one of them is
    // upright and looking north-west at it. Twenty-two people stopping work at
    // the same instant, eighty metres away and four terraces up, is the thing
    // that makes the note enormous — a bell is only loud if somebody who is not
    // you agrees that it was.
    if (kyoBellWave > 0.18) up = Math.max(up, clamp((kyoBellWave - 0.18) / 0.25, 0, 1));
    // and while bent, the hands work: a small side to side that the basket
    // does not follow
    const work = Math.sin(kyoTime * 2.6 + ph * 1.7) * 0.10 * (1 - up);
    // and while they are up, they turn to face the shoro rather than the hedge
    const look = clamp((kyoBellWave - 0.18) / 0.25, 0, 1);
    const y = kyoPickY[i] + up * 0.26;
    const toBell = Math.atan2(kyoBELL.x - kyoPickData[o], kyoBELL.z - kyoPickData[o + 1]);
    const yaw = lerp(kyoPickData[o + 2] + work, toBell, look);
    // THE BEND IS IN THE X ROTATION OF THE WHOLE FIGURE, not in the mesh: the
    // torso is authored forward already, so straightening is the group tipping
    // BACK toward vertical.
    const pitch = -up * 0.62;
    kyoPickMesh.setMatrixAt(i, kyoXform(kyoPickData[o], y, kyoPickData[o + 1],
                                        pitch, yaw, 0, 1, 1, 1));
    kyoPickHead.setMatrixAt(i, kyoXform(kyoPickData[o], y + 1.05 + up * 0.14, kyoPickData[o + 1],
                                        pitch * 0.5, yaw, 0, 1, 1, 1));
  }
  kyoPickMesh.instanceMatrix.needsUpdate = true;
  kyoPickHead.instanceMatrix.needsUpdate = true;
}

// =============================================================== FLORA / FX ==
// ============================================================== INARI-YAMA ==
/**
 * THE MOUNTAIN THE GATES CLIMB, AND IT WAS A LAWN.
 *
 * Chapter four's marquee shot is the senbon torii: forty-four gates S-curving
 * up the shrine hill, framed by the tunnel camera. Rendered, that shot was a
 * vermilion ribbon lying on a bare green dome — the hill carried thirty-four
 * metres of relief, one small shrine and NOTHING ELSE. Fushimi Inari is not a
 * hill with gates on it; it is a mountain of very old sugi, and the reason the
 * tunnel reads the way it does is that the wood outside it is dark, close and
 * roofed over. Take the trees away and the gates are scaffolding on a golf
 * course, which is precisely what was shipping.
 *
 * A sugi is the easiest tree in this game to draw and the least like any other
 * one already in it: a dead-straight bare trunk for two thirds of its height
 * and then a narrow spire, and they grow shoulder to shoulder. Two cones on a
 * cylinder, three instanced draws for the wood.
 *
 * The corridor is CUT OUT of the placement, not drawn round: nothing inside
 * kyoTORII_CAM_R + 4 of any gate, so the tunnel keeps its own light and the
 * camera rail never ends up inside a trunk. Everything else the chapter has
 * already flattened — the pond shelf, the zen garden, Gion, the river, the Uji
 * town — is rejected the same way the maples are.
 */
const kyoSUGI_N = 360;
/**
 * A TRUNK IS SOLID (V1).
 *
 * Three hundred and sixty cedars and forty-two maples, trunks up to 1.2 m
 * across, and not one of them had a collider: the capybara walked through the
 * biggest trees in the chapter. The box is a little inside the six-sided
 * cylinder so the drawn bark is always outside the solid one.
 *
 * ...EXCEPT ON A PATH. The sugi placer already keeps out of the torii
 * corridor; the maples' does not, and a maple that happens to stand on the
 * sando or in the tunnel has been walk-through since the chapter was built
 * and is more useful that way than as a wall across the one route the chapter
 * is scored on. Placement is untouched — moving the placer would reshuffle
 * every random thing built after it — so the trunk keeps its old manners
 * exactly where a collider would cost a route, and nowhere else.
 */
function kyoOnPath(x, z) {
  for (let i = 0; i < kyoTORII.length; i += 2) {
    const dx = x - kyoTORII[i], dz = z - kyoTORII[i + 1];
    if (dx * dx + dz * dz < (kyoTORII_CAM_R + 1.0) * (kyoTORII_CAM_R + 1.0)) return true;
  }
  for (let i = 0; i + 3 < kyoSANDO.length; i += 2) {
    const x0 = kyoSANDO[i], z0 = kyoSANDO[i + 1], x1 = kyoSANDO[i + 2], z1 = kyoSANDO[i + 3];
    const dx = x1 - x0, dz = z1 - z0, l2 = dx * dx + dz * dz || 1;
    const t = clamp(((x - x0) * dx + (z - z0) * dz) / l2, 0, 1);
    const px = x0 + dx * t, pz = z0 + dz * t;
    if ((x - px) * (x - px) + (z - pz) * (z - pz) < 4.0 * 4.0) return true;
  }
  return false;
}
function kyoTrunkSolid(game, x, y, z, r, h) {
  if (!game || kyoOnPath(x, z)) return;
  kyoStaticBox(game, x, y + h * 0.5, z, r * 0.82, h * 0.5, r * 0.82);
}

function kyoBuildSugi(game, root) {
  const trunks = [], spires = [], caps = [], litter = [];
  const blocked = (x, z) => {
    if (Math.abs(x - kyoPOND.x) < kyoPOND.rx + 7 && Math.abs(z - kyoPOND.z) < kyoPOND.rz + 7) return true;
    if (Math.abs(z - kyoGION_Z) < 18) return true;
    if (Math.abs(z - kyoRIVER_Z) < kyoRIVER_HZ + 10) return true;
    if (x > kyoZEN.x - kyoZEN.hx - 5 && x < kyoZEN.x + kyoZEN.hx + 5 &&
        z > kyoZEN.z - kyoZEN.hz - 5 && z < kyoZEN.z + kyoZEN.hz + 5) return true;
    if (Math.abs(x - kyoBAMBOO.x) < kyoBAMBOO.hx + 5 && Math.abs(z - kyoBAMBOO.z) < kyoBAMBOO.hz + 5) return true;
    if (Math.abs(x - kyoBELL.x) < 8 && Math.abs(z - kyoBELL.z) < 8) return true;
    if (z > 100) return true;
    for (let i = 0; i < kyoTORII_N; i++) {
      const gx = kyoTORII[i * 2], gz = kyoTORII[i * 2 + 1];
      const d2 = (x - gx) * (x - gx) + (z - gz) * (z - gz);
      if (d2 < (kyoTORII_CAM_R + 2.4) * (kyoTORII_CAM_R + 2.4)) return true;
    }
    if (Math.abs(x - (kyoHILL_X + 2)) < 9 && Math.abs(z - (kyoHILL_Z + 18)) < 11) return true;
    return false;
  };
  for (let i = 0; i < kyoSUGI_N; i++) {
    let x = 0, z = 0, ok = false;
    for (let k = 0; k < 26 && !ok; k++) {
      // polar about the summit, biased toward the flanks — the top of a wooded
      // hill is thinner than its shoulders, and the summit shrine has to stay
      // findable from below
      const a = rand(0, Math.PI * 2);
      const r = kyoHILL_R * (0.10 + Math.pow(rand(0, 1), 0.55) * 0.90);
      x = kyoHILL_X + Math.cos(a) * r;
      z = kyoHILL_Z + Math.sin(a) * r;
      if (x < -166 || x > 166 || z < -226) continue;
      if (kyoSlope(x, z) > 0.95) continue;
      if (blocked(x, z)) continue;
      ok = true;
    }
    if (!ok) continue;
    const y = kyoTerrain(x, z);
    // 16 to 27 m, and THEY ARE COLUMNS. First cut used one wide cone on a long
    // bare pole and the hill turned into a Christmas tree farm — which is the
    // overcorrection this project keeps making, and the tell was the same as
    // ever: the new thing was the most prominent object in the frame. A sugi is
    // a NARROW column of foliage — crown about an eighth of the height across,
    // starting at two fifths up, three tiers stacked so the silhouette is a
    // spike rather than a wigwam, and a trunk you can barely see through it.
    const h = rand(16, 27);
    const cw = h * rand(0.105, 0.145);
    const yaw = rand(0, 3);
    kyoPush9(trunks, x, y + h * 0.26, z, 0, yaw, 0, h * 0.044, h * 0.52, h * 0.044);
    kyoTrunkSolid(game, x, y, z, h * 0.044, h * 0.52);
    kyoPush9(spires, x, y + h * 0.50, z, 0, yaw, 0, cw, h * 0.40, cw);
    kyoPush9(spires, x, y + h * 0.70, z, 0, yaw + 1.1, 0, cw * 0.84, h * 0.36, cw * 0.84);
    kyoPush9(caps, x, y + h * 0.885, z, 0, yaw + 0.7, 0, cw * 0.60, h * 0.32, cw * 0.60);
    // THE FLOOR OF A CEDAR WOOD IS NOT GRASS. One flat quad of needle litter
    // per second tree, and it goes UNDER the trunk rather than beside it: laid
    // off-centre and crown-sized it read as bald patches on a lawn.
    if (i % 2 === 0) {
      kyoPush9(litter, x + rand(-0.5, 0.5), y + 0.05, z + rand(-0.5, 0.5),
               -Math.PI / 2, rand(0, 3), 0, cw * 2.0, cw * 2.0, 1);
    }
  }
  kyoInstance(root, kyoG.cyl6, PALETTE.sugiBark, trunks, false, false);
  kyoInstance(root, kyoG.cone6, PALETTE.sugiDeep, spires, true, false);
  kyoInstance(root, kyoG.cone6, PALETTE.sugi, caps, true, false);
  kyoInstance(root, kyoG.plane, PALETTE.sugiFloor, litter, false, true);
}

// ========================================================= THE POND'S EDGE ==
/**
 * A WATER PLANE THAT MEETS GRASS AT A HARD LINE IS A HOLE, NOT A POND.
 *
 * The mirror pond is sixty-eight metres across and its whole job is to be the
 * foreground of the golden pavilion, and it had no edge at all: an ellipse of
 * pale blue butted straight against the lawn, with a pavilion, six stepping
 * stones and seven koi in it and not one thing growing anywhere near it.
 *
 * Three things, and all three are what a stroll-garden pond actually has: a
 * course of set rocks round most of the rim (the single most deliberate thing
 * about a Japanese pond — every one of those stones was put there by
 * somebody), clumps of iris and reed in the shallows, and lily pads lying flat
 * where the water is still.
 */
function kyoBuildPondEdge(root) {
  const E = kyoMerger();
  const pads = [], blades = [];
  const N = 46;
  for (let i = 0; i < N; i++) {
    const a = i / N * Math.PI * 2;
    const wob = 1 + Math.sin(a * 3.1) * 0.018 + Math.sin(a * 5.7) * 0.012;
    const rx = kyoPOND.rx * wob, rz = kyoPOND.rz * wob;
    const x = kyoPOND.x + Math.cos(a) * rx, z = kyoPOND.z + Math.sin(a) * rz;
    // THE STEPPING-STONE LINE STAYS CLEAR. Six granite hops are the only dry
    // way to the island and there is a task on them; a rock course laid across
    // their landfall is a wall in front of the chapter's quietest set piece.
    const nearStones = Math.abs(x - (kyoPAVILION.x - 16)) < 13 && Math.abs(z - (kyoPAVILION.z - 8)) < 11;
    const r = 0.55 + (i % 4) * 0.30;
    if (!nearStones && i % 5 !== 3) {
      E.add(kyoG.sph6, kyoXform(x, kyoWATER_Y + r * 0.30, z,
                                rand(-0.22, 0.22), rand(0, 3), rand(-0.22, 0.22),
                                r * 2.4, r * 1.5, r * 2.0), PALETTE.graniteDark);
      E.add(kyoG.sph6, kyoXform(x, kyoWATER_Y + r * 0.52, z, 0, 0, 0,
                                r * 1.9, r * 0.5, r * 1.6), PALETTE.mossKyoto);
    }
    if (i % 3 === 0 && !nearStones) {
      const cx = kyoPOND.x + Math.cos(a) * rx * 0.93;
      const cz = kyoPOND.z + Math.sin(a) * rz * 0.93;
      for (let k = 0; k < 7; k++) {
        const bx = cx + rand(-1.5, 1.5), bz = cz + rand(-1.5, 1.5);
        const bh = rand(0.9, 1.7);
        kyoPush9(blades, bx, kyoWATER_Y + bh * 0.42, bz,
                 rand(-0.16, 0.16), rand(0, 3), rand(-0.16, 0.16), 0.09, bh, 0.09);
      }
    }
  }
  for (let i = 0; i < 54; i++) {
    const a = rand(0, Math.PI * 2), u = Math.sqrt(rand(0.15, 0.92));
    const x = kyoPOND.x + Math.cos(a) * kyoPOND.rx * u;
    const z = kyoPOND.z + Math.sin(a) * kyoPOND.rz * u;
    if (Math.abs(x - kyoPAVILION.x) < 11 && Math.abs(z - kyoPAVILION.z) < 10) continue;
    if (Math.abs(z - (kyoPAVILION.z - 8)) < 3.6 && x < kyoPAVILION.x - 7) continue;
    const s = rand(0.7, 1.5);
    kyoPush9(pads, x, kyoWATER_Y + 0.035, z, -Math.PI / 2, rand(0, 3), 0, s, s, 1);
  }
  const m = new THREE.Mesh(E.build(), kyoVC());
  m.castShadow = true;
  m.receiveShadow = true;
  root.add(m);
  kyoInstance(root, kyoG.plane, PALETTE.lilyPad, pads, false, false);
  // ---- AND THE IRIS MOVES (v44) -----------------------------------------
  // See THE WAKE in shared.js. A pond edge of rigid blades was the one thing
  // in the garden that read as geometry. The lily pads are NOT swayed: a pad
  // lies flat on the water and the waterline already moves it.
  swayMesh(kyoInstance(root, kyoG.box, PALETTE.irisLeaf, blades, false, false),
           { leaf: 0.55, amount: 0.075, axis: 'y', auto: true, stiff: 1.7, hz: 1.45 });
}

// ======================================================== THE MIRROR POND ===
/**
 * KINKAKU-JI IS A REFLECTION. The building is famous because of what is under
 * it, and for four chapters the pond under it was a flat pale ellipse with
 * seven fish in it.
 *
 * The house pattern, from Venice and Mong Kok: a camera-facing additive smear
 * of the object's own colour laid ON the water, narrowing and dimming as it
 * runs away from the thing it belongs to. Three plates across per segment so
 * the strip has no hard side edge; ADDITIVE, because with normal blending the
 * vertex-colour fade multiplies the water and a reflection of a gold pavilion
 * renders as a slab of mud; and gated per reflector on isOverWater, so nothing
 * paints the island or the lawn.
 */
const kyoMIR = [];
// TEN, not six. The plates are the fade, and at six the steps between them
// are visible as a grid on the water from any camera nearer than about thirty
// metres — which in this chapter is most of them, because the pond is the
// foreground of the shot rather than the far side of a square.
const kyoMIR_SEG = 10;
let kyoMirMesh = null, kyoMirMat = null;
/**
 * A REFLECTION STARTS AT THE WATERLINE NEAREST YOU, and that is the whole
 * difficulty with this one.
 *
 * Venice's reflectors are lamps and flagpoles standing IN the water, so a smear
 * anchored at the object and running toward the camera is over water from every
 * angle. Kinkaku-ji stands on an ISLAND fifteen metres across. Anchored at the
 * centre, half the viewing angles lay a slab of gold light across the island's
 * own granite apron; anchored at four fixed points round the rim, two of them
 * light at once and the pond gets two detached rectangular panes floating ten
 * metres off the building — which is what the third attempt actually rendered.
 *
 * So: ORBIT. One reflector, and its anchor is recomputed every frame as the
 * point on the island's perimeter that faces the camera. It always begins where
 * the building meets the water on your side and always runs away from there
 * toward you, from every angle, for one instance and one atan2.
 */
function kyoMirAdd(x, z, w, h, color, ohx, ohz) {
  kyoMIR.push({ x: x, z: z, w: w, len: h * 0.80, col: new THREE.Color(color),
                ohx: ohx || 0, ohz: ohz || 0 });
}
function kyoBuildMirror(root) {
  if (!kyoMIR.length) return;
  const M = kyoMerger();
  const grey = (v) => { const g = Math.max(0, Math.min(255, Math.round(v * 255)));
                        return (g << 16) | (g << 8) | g; };
  for (let k = 0; k < kyoMIR_SEG; k++) {
    const u = (k + 0.5) / kyoMIR_SEG;
    // BRIGHT AT THE BUILDING AND GONE QUICKLY. A gentle square falloff over
    // eleven metres put a pale rectangle in the middle of the frame — the
    // reflection became the most prominent object in the shot, which is this
    // project's standing tell for an overcorrection. Cubed, and short.
    const f = (1 - u) * (1 - u) * (1 - u) * 0.96 + 0.04;
    const dz = 1 / kyoMIR_SEG + 0.03;
    const jit = Math.sin(k * 2.7) * 0.10;
    // TAPERED HARDER THAN VENICE'S. Her reflectors are fifty metres off and
    // this one is twenty, so a strip that only narrows by a third reads as a
    // rectangle with corners on it — a plate of light rather than a reflection.
    const w = (1 - u * 0.62);
    M.box(jit, 0, u, w * 0.52, 0.02, dz, grey(f));
    M.box(jit - w * 0.42, 0, u, w * 0.44, 0.02, dz * 0.94, grey(f * 0.34));
    M.box(jit + w * 0.42, 0, u, w * 0.44, 0.02, dz * 0.94, grey(f * 0.34));
  }
  kyoMirMat = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.19, depthWrite: false,
    blending: THREE.AdditiveBlending });
  const im = new THREE.InstancedMesh(M.build(), kyoMirMat, kyoMIR.length);
  im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(kyoMIR.length * 3), 3);
  for (let i = 0; i < kyoMIR.length; i++) {
    const c = kyoMIR[i].col;
    im.instanceColor.setXYZ(i, c.r, c.g, c.b);
  }
  im.instanceColor.needsUpdate = true;
  im.frustumCulled = false;
  im.renderOrder = 4;
  root.add(im);
  kyoMirMesh = im;
}
function kyoUpdateMirror(game) {
  if (!kyoMirMesh) return;
  const cam = game.camera && game.camera.position;
  if (!cam) return;
  // ABOVE THE RIPPLE, and that is not a fudge. kyoRipple writes the pond
  // surface with an amplitude of 0.055 + 0.055*0.7, so the water stands as much
  // as 9.4 cm proud of its own datum — and the smear is depth-TESTED, so at
  // Venice's +0.014 most of every reflection was being cut away by the wave it
  // was supposed to be lying on. Measured: the pavilion's reflection was
  // essentially absent from the rendered frame while every instance matrix was
  // correct, which is exactly the class of miss [[capy3-visibility-metrics]]
  // is about. 11.5 cm clears the crest everywhere.
  const y = kyoWATER_Y + 0.115;
  for (let i = 0; i < kyoMIR.length; i++) {
    const m = kyoMIR[i];
    let ax = m.x, az = m.z;
    if (m.ohx) {
      const dx0 = cam.x - m.x, dz0 = cam.z - m.z;
      const dl = Math.hypot(dx0, dz0) || 1;
      const ux = dx0 / dl, uz = dz0 / dl;
      // WHERE THE RAY LEAVES THE ISLAND'S FOOTPRINT, not a circle round it.
      // kyoIsOverWater excludes a RECTANGLE for the pavilion island (|dx| < 8,
      // |dz| < 7), and a circle of radius 8.4 passes INSIDE that rectangle at
      // forty-five degrees — so on every diagonal approach the anchor read as
      // dry land and the reflection collapsed to nothing. Measured from the
      // rendered frame, twice. Solve the ray against the box instead, and add a
      // metre of water.
      const t = 1 / Math.max(Math.abs(ux) / m.ohx, Math.abs(uz) / m.ohz, 1e-4);
      ax = m.x + ux * (t + 0.35);
      az = m.z + uz * (t + 0.35);
    }
    const dry = kyoIsOverWater(ax, az) ? 1 : 0;
    const yaw = Math.atan2(cam.x - ax, cam.z - az);
    // the surface is never quite still, and a reflection on a moving surface
    // breathes with it — one sine, so the whole pond agrees with itself
    const b = 1 + Math.sin(kyoTime * 0.9 + i * 1.7) * 0.06;
    kyoMirMesh.setMatrixAt(i, kyoXform(ax, y, az, 0, yaw, 0,
                                       m.w * dry, 1, m.len * dry * b));
  }
  kyoMirMesh.instanceMatrix.needsUpdate = true;
}

// ============================================================== THE SANDO ===
/**
 * THIRTY-FIVE METRES OF NOTHING BETWEEN THE LANE AND THE POND.
 *
 * Measured off the arrival frame: the ground from Gion's south row (z = 40) to
 * the top of the pond (z ≈ 16) is a hundred and twenty metres wide, entirely
 * open, and carries a hundred per cent grass. It is also the ONLY route from
 * where the chapter puts you down to where the chapter's first four tasks are,
 * so it is the piece of Kyoto every player walks through first — and there was
 * nothing on it. kyoBuildMaples explicitly refuses to plant within sixteen
 * metres of the lane, which is what left the near half of it bare.
 *
 * The fix is not scatter. What is actually between a machiya street and a
 * garden pond in this city is an APPROACH: a gravel sando between two lengths
 * of yotsume-gaki — the four-eyed bamboo fence, which is the single most
 * characteristic object in Kyoto and is nine boxes a bay — with maples over it
 * and a stone marker where it turns. It fills the corridor, it tells the player
 * which way the chapter goes without a beacon, and it is one merged mesh.
 *
 * DELIBERATELY NOT SOLID. It is a knee-high fence beside a path: colliders here
 * would turn the one route out of the arrival into a funnel, and a player who
 * wants to walk on the grass is allowed to walk on the grass.
 */
// Routed to miss the bell tower at (-15, 24) — it leaves the lane at the
// arrival point and bends east to the head of the pond.
const kyoSANDO = [-16, 46, -14, 37, -9, 29, -2, 23, 5, 19];   // x, z pairs
function kyoBuildSando(game, root) {
  const S = kyoMerger();
  const trunks = [], canopy = [];
  const N = kyoSANDO.length / 2;
  let run = 0;
  for (let i = 0; i < N - 1; i++) {
    const x0 = kyoSANDO[i * 2], z0 = kyoSANDO[i * 2 + 1];
    const x1 = kyoSANDO[i * 2 + 2], z1 = kyoSANDO[i * 2 + 3];
    const dx = x1 - x0, dz = z1 - z0;
    const len = Math.hypot(dx, dz) || 1;
    const yaw = Math.atan2(dx, dz);
    const nx = dz / len, nz = -dx / len;                 // across the path
    const STEPS = Math.max(2, Math.round(len / 2.2));
    for (let k = 0; k < STEPS; k++) {
      const t0 = k / STEPS, t1 = (k + 1) / STEPS;
      const mx = x0 + dx * (t0 + t1) * 0.5, mz = z0 + dz * (t0 + t1) * 0.5;
      const gy = kyoTerrain(mx, mz);
      // ---- the gravel, one slab a bay, following the ground it is on -----
      // Not one long box: the terrain rolls, and a single slab over a rolling
      // surface is a plank on stilts at one end and buried at the other.
      S.box(mx, gy + 0.055, mz, 4.0, 0.11, len / STEPS + 0.15, PALETTE.granite, 0, yaw, 0);
      // ---- the yotsume-gaki, both sides ---------------------------------
      for (let s = -1; s <= 1; s += 2) {
        const px = mx + nx * s * 2.35, pz = mz + nz * s * 2.35;
        const py = kyoTerrain(px, pz);
        S.box(px, py + 0.46, pz, 0.09, 0.92, 0.09, PALETTE.bambooPale);
        // three rails, and they are what makes it read as a fence rather than
        // as a row of sticks
        for (let r = 0; r < 3; r++) {
          S.box(px, py + 0.24 + r * 0.28, pz, 0.065, 0.065, len / STEPS + 0.2,
                PALETTE.bambooStem, 0, yaw, 0);
        }
        // ...and the fence is a fence (V1): one thin wall a bay, the height
        // of the top rail. It was walked through along its whole length.
        kyoStaticBox(game, px, py + 0.46, pz, 0.06, 0.46, (len / STEPS + 0.2) * 0.5, yaw);
      }
      run += len / STEPS;
      // ---- a maple every eight metres or so, alternating sides ----------
      if (k % 4 === 1) {
        const s = (i + k) % 2 ? 1 : -1;
        const tx = mx + nx * s * 4.4, tz = mz + nz * s * 4.4;
        const ty = kyoTerrain(tx, tz);
        const h = rand(4.2, 6.0);
        kyoPush9(trunks, tx, ty + h * 0.5, tz, 0, rand(0, 6.28), 0, 0.34, h, 0.34);
        kyoStaticBox(game, tx, ty + h * 0.5, tz, 0.28, h * 0.5, 0.28);   // V1
        // three overlapping lumps rather than one ball: a momiji is wide, flat
        // and layered, and one sphere at this camera angle is a lollipop
        for (let c = 0; c < 3; c++) {
          const a = c * 2.1 + i;
          kyoPush9(canopy, tx + Math.cos(a) * 0.8, ty + h * 0.80 + c * 0.42,
                   tz + Math.sin(a) * 0.8, 0, a, 0,
                   h * (1.0 - c * 0.18), h * 0.19, h * (1.0 - c * 0.18));
        }
      }
    }
  }
  // ---- and a stone at the turn, which is where a marker actually goes -----
  {
    const mx = kyoSANDO[4], mz = kyoSANDO[5];
    const my = kyoTerrain(mx, mz);
    S.box(mx - 3.0, my + 0.55, mz, 0.72, 1.10, 0.72, PALETTE.stoneDark);
    S.box(mx - 3.0, my + 1.16, mz, 0.92, 0.14, 0.92, PALETTE.granite);
  }
  const m = new THREE.Mesh(S.build(), kyoVCG());
  m.receiveShadow = true;
  m.castShadow = true;
  root.add(m);
  kyoInstance(root, kyoG.cyl6, PALETTE.trunkDark, trunks, true, false);
  kyoInstance(root, kyoG.cyl6, PALETTE.momiji, canopy, true, false);
}

function kyoBuildMaples(game, root) {
  const trunks = [], canopy = [], under = [];
  for (let i = 0; i < kyoMOMIJI_N; i++) {
    let x = 0, z = 0, ok = false;
    for (let k = 0; k < 20 && !ok; k++) {
      x = rand(-120, 130); z = rand(-170, 120);
      if (kyoSlope(x, z) > 0.55) continue;
      if (Math.abs(x - kyoPOND.x) < kyoPOND.rx + 4 && Math.abs(z - kyoPOND.z) < kyoPOND.rz + 4) continue;
      // The lane, its two rows of machiya and their gardens. Anything planted
      // in here lands on a roof: the rows are at z = 40..46 and 58..64.
      if (Math.abs(z - kyoGION_Z) < 16) continue;
      if (Math.abs(z - kyoRIVER_Z) < kyoRIVER_HZ + 6) continue;
      if (x > kyoZEN.x - kyoZEN.hx - 3 && x < kyoZEN.x + kyoZEN.hx + 3 &&
          z > kyoZEN.z - kyoZEN.hz - 3 && z < kyoZEN.z + kyoZEN.hz + 3) continue;
      ok = true;
    }
    if (!ok) continue;
    const y = kyoTerrain(x, z);
    const h = rand(4.5, 7.5);
    kyoPush9(trunks, x, y + h * 0.42, z, 0, rand(0, 3), 0, 0.5, h, 0.5);
    kyoTrunkSolid(game, x, y, z, 0.5, h * 0.8);
    // a momiji is WIDE and FLAT, not a lollipop: three overlapping discs
    for (let k = 0; k < 3; k++) {
      kyoPush9(canopy, x + rand(-1.2, 1.2), y + h * (0.78 + k * 0.13), z + rand(-1.2, 1.2),
               0, rand(0, 3), 0, h * (1.05 - k * 0.2), h * 0.20, h * (1.05 - k * 0.2));
    }
    kyoPush9(under, x, y + h * 0.72, z, 0, rand(0, 3), 0, h * 0.9, h * 0.16, h * 0.9);
  }
  kyoInstance(root, kyoG.cyl6, PALETTE.trunkDark, trunks, true, false);
  kyoInstance(root, kyoG.cyl6, PALETTE.momiji, canopy, true, false);
  kyoInstance(root, kyoG.cyl6, PALETTE.momijiDeep, under, false, false);
}

/** Petals, forever, everywhere. The single cheapest thing that says Kyoto. */
function kyoBuildPetals(root) {
  kyoPetals = new THREE.InstancedMesh(kyoG.plane,
    mat(PALETTE.sakura, { side: THREE.DoubleSide, transparent: true, opacity: 0.9 }), kyoPETAL_N);
  kyoPetals.frustumCulled = false;
  kyoPetals.castShadow = false;
  for (let i = 0; i < kyoPETAL_N; i++) {
    const o = i * 6;
    kyoPetalData[o] = rand(-70, 70);
    kyoPetalData[o + 1] = rand(0, 26);
    kyoPetalData[o + 2] = rand(-70, 70);
    kyoPetalData[o + 3] = rand(0, Math.PI * 2);
    kyoPetalData[o + 4] = rand(0.7, 1.6);      // fall rate
    kyoPetalData[o + 5] = rand(0.5, 1.4);      // spin
  }
  root.add(kyoPetals);
}

function kyoUpdatePetals(game, dt) {
  if (!kyoPetals) return;
  const cam = game.camera;
  for (let i = 0; i < kyoPETAL_N; i++) {
    const o = i * 6;
    kyoPetalData[o + 1] -= kyoPetalData[o + 4] * dt;
    kyoPetalData[o + 3] += kyoPetalData[o + 5] * dt * (1 + kyoBellPulse * 5);
    kyoPetalData[o] += Math.sin(kyoTime * 0.6 + i) * dt * 0.7;
    // THE BELL GUSTS THEM. Ninety petals lifted and driven sideways for two
    // seconds is what a shock front through a valley looks like from inside it,
    // and it is the part of the reaction that happens in front of your face
    // wherever in the chapter you happen to be standing.
    if (kyoBellPulse > 0) {
      const gst = kyoBellPulse * kyoBellPulse;
      kyoPetalData[o + 1] += gst * dt * 3.4;
      kyoPetalData[o] += Math.cos(i * 2.1) * gst * dt * 7.0;
      kyoPetalData[o + 2] += Math.sin(i * 2.1) * gst * dt * 7.0;
    }
    // recycled around the camera, so the fall follows the player without ever
    // needing more than ninety of them
    if (kyoPetalData[o + 1] < -2 ||
        Math.abs(kyoPetalData[o] - cam.position.x) > 60 ||
        Math.abs(kyoPetalData[o + 2] - cam.position.z) > 60) {
      kyoPetalData[o] = cam.position.x + rand(-45, 45);
      kyoPetalData[o + 1] = rand(16, 30);
      kyoPetalData[o + 2] = cam.position.z + rand(-45, 45);
    }
    const s = 0.24;
    kyoPetals.setMatrixAt(i, kyoXform(kyoPetalData[o], kyoPetalData[o + 1], kyoPetalData[o + 2],
                                      kyoPetalData[o + 3], kyoPetalData[o + 3] * 0.7, 0, s, s * 0.6, s));
  }
  kyoPetals.instanceMatrix.needsUpdate = true;
}

function kyoBuildKoi(root) {
  const K = kyoMerger();
  K.sph(0, 0, 0, 0.22, 0.20, 0.62, PALETTE.torii);
  K.sph(0, 0.02, 0.22, 0.16, 0.15, 0.30, PALETTE.gravelZen);
  K.box(0, 0, -0.72, 0.06, 0.34, 0.42, PALETTE.torii, 0, 0, 0);
  K.box(0, 0.18, -0.1, 0.05, 0.22, 0.44, PALETTE.toriiDark);
  kyoKoi = new THREE.InstancedMesh(K.build(), kyoVC(), kyoKOI_N);
  kyoKoi.frustumCulled = false;
  for (let i = 0; i < kyoKOI_N; i++) {
    const o = i * 4;
    kyoKoiData[o] = rand(0, Math.PI * 2);
    kyoKoiData[o + 1] = rand(5, 17);           // orbit radius
    kyoKoiData[o + 2] = rand(0.16, 0.34);      // angular rate
    kyoKoiData[o + 3] = rand(-6, 6);           // z offset of the orbit centre
  }
  root.add(kyoKoi);
}

let kyoBellWave = 0;         // 0..1, the shock through the garden after a strike
let kyoBellPulse = 0;        // ...and the sharp front of it, over about 2 s
let kyoKoiSpeed = 1;

function kyoUpdateKoi(dt) {
  if (!kyoKoi) return;
  // A BELL PUTS THE FISH DOWN. Nine seconds of a note you can feel in the
  // paving is exactly the thing that makes a pond of koi go deep and fast, and
  // then come back up over the following half-minute. It is two numbers and it
  // is the difference between a bell that is loud and a bell that is heavy.
  if (kyoBellPulse > 0) kyoBellPulse = Math.max(0, kyoBellPulse - dt * 0.55);
  if (kyoBellWave > 0) {
    kyoBellWave = Math.max(0, kyoBellWave - dt * 0.06);
    kyoKoiSpeed = 1 + kyoBellWave * 2.6;
  } else if (kyoKoiSpeed !== 1) {
    kyoKoiSpeed = damp(kyoKoiSpeed, 1, 0.6, dt);
  }
  kyoKoiT += dt * kyoKoiSpeed;
  for (let i = 0; i < kyoKOI_N; i++) {
    const o = i * 4;
    const a = kyoKoiData[o] + kyoKoiT * kyoKoiData[o + 2];
    const r = kyoKoiData[o + 1];
    const x = kyoPOND.x + Math.cos(a) * r;
    const z = kyoPOND.z + kyoKoiData[o + 3] + Math.sin(a) * r * 0.62;
    // ...and they go DOWN while it is ringing, which is what you actually see
    const y = kyoWATER_Y - 0.12 - kyoBellWave * 0.55 + Math.sin(kyoKoiT * 1.4 + i) * 0.10;
    kyoKoi.setMatrixAt(i, kyoXform(x, y, z, 0, a + Math.PI * 0.5,
                                   Math.sin(kyoKoiT * 5 + i) * 0.14 * kyoKoiSpeed, 1, 1, 1));
  }
  kyoKoi.instanceMatrix.needsUpdate = true;
}
let kyoKoiT = 0;

function kyoUpdateBamboo(dt) {
  void dt;
  if (!kyoBambooMesh) return;
  // The grove SWAYS. Rewriting 260 matrices every frame is the single most
  // expensive thing in this biome, so it runs at 20 Hz and nobody can tell.
  if ((kyoTime * 20 | 0) === kyoBambooLast) return;
  kyoBambooLast = kyoTime * 20 | 0;
  const l = kyoBambooList;
  // and the grove takes the bell too — two thousand culms are exactly the sort
  // of thing that answers a low note, and this is the cheap half of it
  const bk = kyoBellPulse * kyoBellPulse * 0.14;
  for (let i = 0; i < kyoBAMBOO_N; i++) {
    const o = i * 9;
    const w = Math.sin(kyoTime * 0.9 + kyoBambooPhase[i]) * 0.055
            + Math.sin(kyoTime * 5.2 + kyoBambooPhase[i] * 0.3) * bk;
    kyoBambooMesh.setMatrixAt(i, kyoXform(l[o], l[o + 1], l[o + 2],
                                          w, l[o + 4], w * 0.7, l[o + 6], l[o + 7], l[o + 8]));
  }
  kyoBambooMesh.instanceMatrix.needsUpdate = true;
}
let kyoBambooLast = -1;
let kyoBambooList = null;

// ================================================================== TASKS ====
// ============================================================== THE UJI RUN ==
/**
 * CHAPTER 4'S SET PIECE: two hundred and fifteen metres of river, and no vehicle.
 *
 * Every other big moment in this game hands you something to hold on to — a
 * wheel, a bird's talons, a luggage rack. This one takes everything away. You go
 * off the shrine bay on the Uji bridge into water moving half again as fast as a
 * capybara can swim, and the only control you have left is WHERE ACROSS THE
 * CURRENT you are. That is the whole verb, and it is enough, because the river
 * is not uniform: the thread down the middle of a bend runs at seven metres a
 * second, the inside of the same bend is nearly slack, and there is dead water
 * behind every boulder that will hold you for as long as you let it.
 *
 * So the river is authored as a CENTRELINE, exactly the way the chiva's road is,
 * and everything else is derived from it: the bed, the banks, the drawn water,
 * the flow, the rocks, the gates and the finish. One polyline, one truth.
 */
const kyoRIVER_PATH = [
  // upstream, and deliberately straight where the bridge crosses it — the bridge
  // was built across a straight reach and it is not moving
  [-170, 128], [-124, 133], [-78, 123], [-30, 129], [4, 128], [26, 128],
  // then the gorge: three bends, each tighter than the last
  [54, 121], [88, 127], [118, 143], [146, 134],
  // and the hook back west into the mill pond
  [166, 146], [154, 160], [134, 156], [126, 152],
];
// Where the run is judged from: the bridge. Index into the path above.
const kyoRIVER_STEP = 2.5;          // m between resampled centreline points
const kyoRIVER_SMOOTH = 3;
// Half-width, keyed to fraction of the whole channel. A river narrows and speeds
// up and widens and slows down, and this is the only knob that says so: flow is
// derived from it by continuity, so a narrow is fast BECAUSE it is narrow.
const kyoRIVER_W = [
  [0.00, 15], [0.30, 15], [0.42, 11], [0.52, 15], [0.62, 9],
  [0.72, 14], [0.84, 8.5], [0.93, 5.5], [0.97, 12], [1.00, 13],
];
const kyoRIVER_BED = 3.4;           // m the bed is cut below the waterline mid-channel
const kyoRIVER_BANK = 0.62;         // m the bank must stand above it, everywhere
// Flow. The reference is capySWIM_SPEED, which is 2.6 — so 6.2 in the thread is
// two and a third times as fast as the animal can swim, and the inside of a bend
// at 1.9 is slower than it. Both halves of that matter: you cannot beat the
// river, and you can always get out of the fast part of it.
const kyoFLOW_MAX = 6.2;
const kyoFLOW_EDGE = 0.16;          // fraction of mid-channel speed at the bank
const kyoFLOW_REF_W = 15;           // the width the speeds above are quoted at
const kyoEDDY_R = 5.5;              // m of dead water behind a boulder
const kyoRUN_HZ_OUT = 1.35;         // how far outside the channel counts as "out"

let kyoRX = null, kyoRZ = null, kyoRS = null, kyoRW = null;
let kyoRiverLen = 0, kyoRunFromS = 0;
let kyoRocks = null, kyoGates = null, kyoBarrels = null, kyoBarrelData = null;
let kyoMillWheel = null, kyoMillSpin = 0;
const kyoAheadOut = { x: 0, z: 0 };
let kyoRunT = -1, kyoRunBest = 0, kyoRunDone = false;
let kyoRunOutT = 0, kyoInRiver = false, kyoRunFlow = 0;
// ---- THE CHUTE (W1) --------------------------------------------------------
// The run had one shape from the first attempt to the tenth: a float, some
// boulders, a pond. It has a climax now. At the last narrow — the 5.5 m gap
// the widths table already pinches to, where continuity has the water at its
// fastest — a standing wave stands across the whole channel, and an animal
// carried into it at speed is thrown: a real launch off the tongue, a second
// in the air over the gorge, and back into the water below with the run
// still open (kyoRUN_OUT forgives 1.5 s out, and the flight is under one).
// Authored as a fraction of the RUN like the boulders, and drawn as three
// foam chevrons across the gap so it is visible from the bend above.
const kyoCHUTE_AT = 0.45;           // fraction of the run: the straight reach below the second bend, between the 0.41 and 0.49 boulders, and clear of the mill pond the hook comes back to
const kyoCHUTE_V = 6.0;             // m/s up, off the tongue: clear of the waterline spring inside the launch hold
const kyoCHUTE_MIN = 2.2;           // m/s downstream before the wave throws you
let kyoChuteS = -1, kyoChuteFired = false, kyoChuteSaid = false, kyoChuteAir = 0;
let kyoRiverMover = null;                  // the Uji, as a place (A1)
let kyoLeavesBed = null;                   // ...and the grove, at the animal (L6, E3)
const kyoBARREL_N = 14;

/** Build the centreline: resample, smooth, measure, and cache the widths. */
function kyoBuildRiverPath() {
  const rx = [], rz = [];
  rx.push(kyoRIVER_PATH[0][0]); rz.push(kyoRIVER_PATH[0][1]);
  for (let i = 1; i < kyoRIVER_PATH.length; i++) {
    const a = kyoRIVER_PATH[i - 1], b = kyoRIVER_PATH[i];
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.round(seg / kyoRIVER_STEP));
    for (let k = 1; k <= n; k++) { rx.push(lerp(a[0], b[0], k / n)); rz.push(lerp(a[1], b[1], k / n)); }
  }
  // Round the bends. The BRIDGE REACH IS PINNED: the bridge is a fixed piece of
  // geometry eight metres wide across x = 4, and a centreline that wanders even a
  // metre there puts a pier in the fast water and the deck over the bank.
  for (let pass = 0; pass < kyoRIVER_SMOOTH; pass++) {
    const ox = rx.slice(), oz = rz.slice();
    for (let i = 1; i < rx.length - 1; i++) {
      if (ox[i] > -24 && ox[i] < 26) continue;
      rx[i] = ox[i - 1] * 0.25 + ox[i] * 0.5 + ox[i + 1] * 0.25;
      rz[i] = oz[i - 1] * 0.25 + oz[i] * 0.5 + oz[i + 1] * 0.25;
    }
  }
  const n = rx.length;
  kyoRX = new Float32Array(n); kyoRZ = new Float32Array(n);
  kyoRS = new Float32Array(n); kyoRW = new Float32Array(n);
  let s = 0;
  for (let i = 0; i < n; i++) {
    kyoRX[i] = rx[i]; kyoRZ[i] = rz[i];
    if (i) s += Math.hypot(rx[i] - rx[i - 1], rz[i] - rz[i - 1]);
    kyoRS[i] = s;
  }
  kyoRiverLen = s;
  for (let i = 0; i < n; i++) kyoRW[i] = kyoWidthAtFrac(kyoRS[i] / Math.max(1, kyoRiverLen));
  // where the bridge is, in arclength
  kyoRunFromS = 0;
  let best = 1e9;
  for (let i = 0; i < n; i++) {
    const d = Math.hypot(kyoRX[i] - kyoBRIDGE_X, kyoRZ[i] - kyoRIVER_Z);
    if (d < best) { best = d; kyoRunFromS = kyoRS[i]; }
  }
}

/** Arclength at a fraction of THE RUN — the bridge to the mill pond. */
function kyoRunAt(f) { return kyoRunFromS + (kyoRiverLen - kyoRunFromS) * f; }

function kyoWidthAtFrac(f) {
  const T = kyoRIVER_W;
  for (let i = 1; i < T.length; i++) {
    if (f <= T[i][0]) {
      const t = (f - T[i - 1][0]) / Math.max(1e-6, T[i][0] - T[i - 1][0]);
      return lerp(T[i - 1][1], T[i][1], clamp(t, 0, 1));
    }
  }
  return T[T.length - 1][1];
}

/**
 * NEAREST POINT ON THE CENTRELINE, and how far off it you are.
 *
 * Called from kyoTerrain, so it is called for every vertex of the ground mesh
 * and every cell of the heightfield at build, and once or twice a frame after
 * that. It is therefore a coarse scan with a fine refinement rather than a
 * projection onto every segment: the coarse pass steps eight samples at a time
 * over a 106-point table, the fine pass looks at the six around the winner, and
 * the whole thing is about twenty distance tests instead of two hundred.
 */
const kyoNear = { s: 0, d: 0, side: 0, tx: 0, tz: 0, w: 15, i: 0 };
function kyoRiverNear(x, z) {
  const n = kyoRX.length;
  let bi = 0, bd = Infinity;
  for (let i = 0; i < n; i += 8) {
    const dx = x - kyoRX[i], dz = z - kyoRZ[i];
    const d = dx * dx + dz * dz;
    if (d < bd) { bd = d; bi = i; }
  }
  const lo = Math.max(0, bi - 8), hi = Math.min(n - 1, bi + 8);
  for (let i = lo; i <= hi; i++) {
    const dx = x - kyoRX[i], dz = z - kyoRZ[i];
    const d = dx * dx + dz * dz;
    if (d < bd) { bd = d; bi = i; }
  }
  // tangent over a six-metre baseline, so the smoothing residue does not shiver
  const a = Math.max(0, bi - 3), b = Math.min(n - 1, bi + 3);
  let tx = kyoRX[b] - kyoRX[a], tz = kyoRZ[b] - kyoRZ[a];
  const tl = Math.hypot(tx, tz) || 1;
  tx /= tl; tz /= tl;
  const px = x - kyoRX[bi], pz = z - kyoRZ[bi];
  // refine along the tangent: the table is 2.5 m apart and a bank is 15 m out,
  // so without this the distance is quantised into visible rings
  const along = px * tx + pz * tz;
  const offx = px - tx * along, offz = pz - tz * along;
  kyoNear.i = bi;
  kyoNear.s = clamp(kyoRS[bi] + along, 0, kyoRiverLen);
  kyoNear.d = Math.hypot(offx, offz);
  kyoNear.side = offx * tz - offz * tx > 0 ? 1 : -1;
  kyoNear.tx = tx; kyoNear.tz = tz;
  kyoNear.w = kyoRW[bi];
  return kyoNear;
}

/**
 * The channel, cut into whatever the rest of kyoTerrain said.
 *
 * Two halves and BOTH are load-bearing. The cut is obvious. The LEVEE is not:
 * the Uji town shelf sits at −1.87 and the river's surface at −0.9, so where the
 * channel runs along the top of the shelf the drawn water would end in mid-air
 * with a metre of nothing under its edge. Forcing the bank up to the waterline
 * plus a hand's breadth, everywhere, means a river can be cut across any terrain
 * in this valley and still have banks.
 */
function kyoRiverCut(x, z, base) {
  const nr = kyoRiverNear(x, z);
  const w = nr.w, fade = w + 7;
  if (nr.d > fade) return base;
  if (nr.d <= w) {
    const t = clamp(1 - nr.d / w, 0, 1);
    return Math.min(base, kyoRIVER_Y - kyoRIVER_BED * t * t * (3 - 2 * t));
  }
  // the bank: never below the waterline, easing back to the land it came from
  const t = clamp((fade - nr.d) / 7, 0, 1);
  const lip = kyoRIVER_Y + kyoRIVER_BANK;
  return lerp(base, Math.max(base, lip), t * t);
}

/**
 * THE FLOW AT A POINT — the whole mechanic, in eleven lines.
 *
 *   direction   the centreline's tangent, so the water goes where the river goes
 *   across      a quadratic falloff to the bank, which is what makes the middle
 *               worth fighting for and the edge worth escaping to
 *   continuity  narrow reaches run faster, because the same water has to fit
 *               through a smaller gap. This is why the widths table above is the
 *               only speed control there is: you tune the SHAPE and the pace
 *               follows, instead of tuning two things against each other.
 *   eddies      dead water behind each boulder, pointing gently back upstream
 */
const kyoFlowOut = { x: 0, z: 0, speed: 0, mid: 0 };
function kyoFlowAt(x, z) {
  kyoFlowOut.x = 0; kyoFlowOut.z = 0; kyoFlowOut.speed = 0; kyoFlowOut.mid = 0;
  if (!kyoRX) return kyoFlowOut;
  const nr = kyoRiverNear(x, z);
  // THE FLOW HAS TO REACH AS FAR AS THE RIVER DOES.
  // It used to stop at the channel's nominal half-width, which left a metre and
  // a half of water that still counted as "in the river" for the run's clock and
  // had no current in it at all. Measured: the capybara is thrown to the OUTSIDE
  // of every bend, which is correct and is most of the skill in the run, and it
  // then sat in that dead ring at zero for the rest of time. There is no such
  // thing as slack water against a bank; there is slow water.
  if (nr.d > nr.w * kyoRUN_HZ_OUT + 1) return kyoFlowOut;
  const across = clamp(nr.d / nr.w, 0, 1.2);
  const lane = Math.max(kyoFLOW_EDGE * 0.6, lerp(1, kyoFLOW_EDGE, clamp(across * across, 0, 1)));
  // Continuity, and then a ceiling on it. The mill race is 5.5 m half-width
  // against a 15 m reference, which by continuity alone is nearly seventeen
  // metres a second — six times what the animal can swim, and past the point
  // where steering means anything at all. 1.6x is the fastest the run gets and
  // it is already half again as fast as a capybara can RUN.
  let sp = Math.min(kyoFLOW_MAX * 1.6, kyoFLOW_MAX * lane * (kyoFLOW_REF_W / nr.w));
  const tx = nr.tx, tz = nr.tz;
  kyoFlowOut.mid = 1 - across;
  // the pond at the mill is still water: the run has to END somewhere, and a
  // finish line you are still being swept through is not a finish
  const tail = clamp((kyoRiverLen - nr.s) / 16, 0, 1);
  sp *= tail * tail;
  // and the boulders' eddies
  if (kyoRocks) {
    for (let i = 0; i < kyoRocks.length; i++) {
      const r = kyoRocks[i];
      const dx = x - r.ex, dz = z - r.ez;
      const d2 = dx * dx + dz * dz;
      if (d2 > kyoEDDY_R * kyoEDDY_R) continue;
      const k = 1 - Math.sqrt(d2) / kyoEDDY_R;
      sp = lerp(sp, -0.9, k * 0.92);
    }
  }
  kyoFlowOut.x = tx * sp; kyoFlowOut.z = tz * sp; kyoFlowOut.speed = sp;
  return kyoFlowOut;
}

/** Is (x, z) in the river? Path-based, and it replaces the old straight band. */
function kyoInRiverAt(x, z) {
  if (!kyoRX) return false;
  const nr = kyoRiverNear(x, z);
  return nr.d < nr.w;
}

// ---------------------------------------------------------------- the water --
/**
 * The drawn river: a ribbon along the centreline, two quads wide either side, so
 * the surface follows the bends and stops exactly at the bank the terrain cut.
 */
function kyoBuildRiverMesh() {
  const n = kyoRX.length;
  const COLS = 6;                        // across the channel
  const pos = new Float32Array(n * (COLS + 1) * 3);
  const col = new Float32Array(n * (COLS + 1) * 3);
  const idx = [];
  const cNear = new THREE.Color(PALETTE.ujiRiver), cDeep = new THREE.Color(PALETTE.ujiRiverDeep);
  const c = new THREE.Color();
  let p = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 2), b = Math.min(n - 1, i + 2);
    let tx = kyoRX[b] - kyoRX[a], tz = kyoRZ[b] - kyoRZ[a];
    const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
    const nx = -tz, nz = tx;
    for (let k = 0; k <= COLS; k++) {
      const u = (k / COLS) * 2 - 1;
      pos[p] = kyoRX[i] + nx * u * kyoRW[i];
      pos[p + 1] = kyoRIVER_Y;
      pos[p + 2] = kyoRZ[i] + nz * u * kyoRW[i];
      // Dark at the banks, pale down the middle. Physically that is backwards —
      // the middle is the deep part — but it is what a river looks like from the
      // bank, because the middle is where the sky is in it and the edges are
      // where the bed shows through. Read the picture, not the cross-section.
      c.copy(cDeep).lerp(cNear, 1 - Math.abs(u) * 0.85);
      col[p] = c.r; col[p + 1] = c.g; col[p + 2] = c.b;
      p += 3;
    }
  }
  // WINDING. Downstream cross across is (0, -1, 0) with these two axes, so the
  // obvious order gives every triangle a normal pointing at the riverbed: the
  // surface is then back-face culled from above and what you are actually
  // looking at, for the whole run, is the gravel. It renders — it just renders
  // as a road. Reversed, and the water is water.
  for (let i = 0; i < n - 1; i++) {
    for (let k = 0; k < COLS; k++) {
      const a = i * (COLS + 1) + k, b = a + 1, d = a + (COLS + 1), e = d + 1;
      idx.push(a, e, d, a, b, e);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // the Uji, which the whole run down the river is looked at across
  const m = new THREE.Mesh(g, grain(mat(0xffffff, { vertexColors: true, transparent: true, opacity: 0.94 }),
    { scale: 0.6, amount: 0.05, warp: 0,
      sparkle: 0.40, sparkleScale: 1.6, sparkleSpeed: 0.46, sparkleCut: 0.665, fresnel: 0.65,
      sparkleColor: PALETTE.kyotoHaze }));
  m.receiveShadow = true;
  m.frustumCulled = false;
  kyoRiverAttr = g.attributes.position;
  kyoRiverMesh = m;
  return m;
}

// ----------------------------------------------------------------- boulders --
/**
 * The rocks are the only thing in the run that can actually cost you, and they
 * cost you TIME rather than the run: behind each one is five metres of dead
 * water that will hold a capybara indefinitely, and the only way out is to swim
 * sideways into the thread again. That is the right punishment for a set piece
 * whose record is a clock — it makes the fast line worth finding without ever
 * making the slow line a failure.
 */
function kyoBuildRocks(game, root) {
  kyoRocks = [];
  const R = kyoMerger();
  // AUTHORED AS A FRACTION OF THE RUN, not of the river.
  //
  // The river is four hundred and sixty metres long and the run is the last two
  // hundred and eighty of it, so the two scales differ by the length of the
  // upstream reach — and the first version of this table, keyed to the river,
  // put a two-metre boulder twelve metres downstream of the bridge, which is
  // roughly where a player who has just jumped in is still working out which way
  // is downstream. Keying it to the run means "0.05" means what it looks like it
  // means: a twentieth of the way into the thing you are being timed on.
  const AT = [
    [0.06, -0.35], [0.10, 0.45], [0.16, 0.10], [0.23, -0.55],
    [0.29, 0.35], [0.36, -0.20], [0.41, 0.55], [0.49, 0.05],
    [0.55, -0.45], [0.62, 0.30], [0.68, -0.30], [0.74, 0.35],
    [0.81, -0.15], [0.86, 0.40],
  ];
  for (let i = 0; i < AT.length; i++) {
    const s = kyoRunAt(AT[i][0]);
    const seg = kyoRiverSeg(s);
    const nx = -seg.tz, nz = seg.tx;
    const w = seg.w;
    const x = seg.x + nx * AT[i][1] * w, z = seg.z + nz * AT[i][1] * w;
    const r = 1.5 + (i % 3) * 0.45;
    const h = 2.2 + (i % 4) * 0.35;
    // a boulder is three lumps, because one sphere is a marble
    R.sph(x, kyoRIVER_Y + h * 0.16, z, r, h * 0.5, r * 0.86, PALETTE.granite);
    R.sph(x + r * 0.5, kyoRIVER_Y - 0.1, z - r * 0.4, r * 0.6, h * 0.32, r * 0.5, PALETTE.graniteDark);
    R.sph(x - r * 0.45, kyoRIVER_Y - 0.05, z + r * 0.5, r * 0.55, h * 0.28, r * 0.55, PALETTE.graniteDark);
    // THE STANDING WAVE ON THE UPSTREAM FACE, which is the only thing that makes
    // a boulder visible from far enough upstream to do anything about it.
    // Authored as a low chevron hugging the rock rather than a slab lying on the
    // water — the slab version read as a sheet of paper floating next to a rock,
    // which is very nearly the opposite of what a boulder in a river looks like.
    const fy = Math.atan2(seg.tx, seg.tz);
    for (let k = -1; k <= 1; k += 2) {
      R.box(x - seg.tx * (r * 0.55) + nx * k * r * 0.62, kyoRIVER_Y + 0.16,
            z - seg.tz * (r * 0.55) + nz * k * r * 0.62,
            r * 1.15, 0.34, 0.42, PALETTE.ujiFoam, 0, fy + k * 0.62, 0);
    }
    R.sph(x - seg.tx * (r + 0.35), kyoRIVER_Y + 0.14, z - seg.tz * (r + 0.35),
          r * 0.62, 0.24, r * 0.40, PALETTE.ujiFoam);
    // and the slick of white it drags downstream past its shoulders
    for (let k = -1; k <= 1; k += 2) {
      R.sph(x + seg.tx * (r * 0.9) + nx * k * r * 0.85, kyoRIVER_Y + 0.08,
            z + seg.tz * (r * 0.9) + nz * k * r * 0.85, 0.75, 0.13, 0.75, PALETTE.ujiFoam);
    }
    kyoStaticBox(game, x, kyoRIVER_Y + 0.2, z, r * 0.72, h * 0.5, r * 0.72);
    kyoRocks.push({ x: x, z: z, r: r, ex: x + seg.tx * (r + 1.9), ez: z + seg.tz * (r + 1.9) });
  }
  // ---- the chute (W1): a wave across the narrow. See kyoCHUTE_AT. ---------
  {
    kyoChuteS = kyoRunAt(kyoCHUTE_AT);
    const seg = kyoRiverSeg(kyoChuteS);
    const nx = -seg.tz, nz = seg.tx;
    const fy = Math.atan2(seg.tx, seg.tz);
    const w = seg.w;
    // three chevrons, bank to bank, each a little further downstream at the
    // edges than in the middle: the tongue of a rapid is a V pointing down
    for (let k = -1; k <= 1; k++) {
      const ax = seg.x + nx * k * w * 0.62, az = seg.z + nz * k * w * 0.62;
      const back = Math.abs(k) * 1.4;
      R.box(ax + seg.tx * back, kyoRIVER_Y + 0.22, az + seg.tz * back,
            w * 0.72, 0.42, 0.6, PALETTE.ujiFoam, 0, fy + k * 0.35, 0);
      R.sph(ax + seg.tx * (back - 0.9), kyoRIVER_Y + 0.12, az + seg.tz * (back - 0.9),
            w * 0.36, 0.26, 0.7, PALETTE.ujiFoam);
    }
    // ...and the slick below it, where the water lands again
    for (let k = -2; k <= 2; k++) {
      R.sph(seg.x + seg.tx * 4.5 + nx * k * w * 0.36, kyoRIVER_Y + 0.08,
            seg.z + seg.tz * 4.5 + nz * k * w * 0.36, 0.9, 0.12, 1.3, PALETTE.ujiFoam);
    }
  }
  const m = new THREE.Mesh(R.build(), kyoVC());
  m.castShadow = true;
  m.receiveShadow = true;
  m.frustumCulled = false;
  root.add(m);
}

const kyoSegOut = { x: 0, z: 0, tx: 0, tz: 0, w: 15 };
function kyoRiverSeg(s) {
  const n = kyoRX.length;
  s = clamp(s, 0, kyoRiverLen);
  let lo = 0, hi = n - 1;
  while (lo + 1 < hi) { const m = (lo + hi) >> 1; if (kyoRS[m] <= s) lo = m; else hi = m; }
  const span = kyoRS[hi] - kyoRS[lo];
  const t = span > 1e-5 ? (s - kyoRS[lo]) / span : 0;
  kyoSegOut.x = lerp(kyoRX[lo], kyoRX[hi], t);
  kyoSegOut.z = lerp(kyoRZ[lo], kyoRZ[hi], t);
  const a = Math.max(0, lo - 2), b = Math.min(n - 1, lo + 3);
  let tx = kyoRX[b] - kyoRX[a], tz = kyoRZ[b] - kyoRZ[a];
  const tl = Math.hypot(tx, tz) || 1;
  kyoSegOut.tx = tx / tl; kyoSegOut.tz = tz / tl;
  kyoSegOut.w = lerp(kyoRW[lo], kyoRW[hi], t);
  return kyoSegOut;
}

// -------------------------------------------------- the cormorant boats -----
/**
 * UKAI. Cormorant fishing on the Uji is nine hundred years old: a man in a black
 * robe stands in the bow of a flat boat with a fire basket hanging off the stem
 * and works a dozen birds on leashes. There is a season for it and the boats sit
 * on the river for the rest of the year, moored in pairs.
 *
 * Which makes them the gates. Three pairs, moored across the thread of the
 * current at the three narrows, and the fast line goes between them.
 */
function kyoBuildGates(game, root) {
  kyoGates = [];
  const G = kyoMerger();
  // fractions of the RUN, for the reason the boulders are — see kyoBuildRocks
  const AT = [0.20, 0.52, 0.82];
  for (let i = 0; i < AT.length; i++) {
    const seg = kyoRiverSeg(kyoRunAt(AT[i]));
    const nx = -seg.tz, nz = seg.tx;
    const gap = 5.0;
    for (let s = -1; s <= 1; s += 2) {
      const off = s * (gap * 0.5 + 3.4);
      const bx = seg.x + nx * off, bz = seg.z + nz * off;
      const yaw = Math.atan2(seg.tx, seg.tz);
      // a flat-bottomed boat, six metres, pointed at both ends
      G.box(bx, kyoRIVER_Y + 0.18, bz, 1.7, 0.42, 6.0, PALETTE.templeWoodDk, 0, yaw, 0);
      G.box(bx, kyoRIVER_Y + 0.44, bz, 1.5, 0.16, 5.6, PALETTE.templeWood, 0, yaw, 0);
      for (let e = -1; e <= 1; e += 2) {
        G.box(bx + seg.tx * e * 3.2, kyoRIVER_Y + 0.30, bz + seg.tz * e * 3.2,
              0.8, 0.36, 1.2, PALETTE.templeWoodDk, 0, yaw, 0);
      }
      // the fire basket on its pole, over the bow
      G.cyl(bx + seg.tx * 3.0, kyoRIVER_Y + 1.4, bz + seg.tz * 3.0, 0.09, 2.2, PALETTE.templeWoodDk);
      G.sph(bx + seg.tx * 3.9, kyoRIVER_Y + 2.2, bz + seg.tz * 3.9, 0.46, 0.40, 0.46, PALETTE.ironDark);
      // AND A CORMORANT ON THE GUNWALE — which used to be two spheres merged
      // into the same static mesh as the boat, so the only living thing on the
      // river was welded to a plank. It is now its own instance with somewhere
      // to be (see kyoUpdateBirds): standing, or holding its wings out to dry,
      // which is the single most recognisable thing a cormorant does — and if
      // you come down the thread close aboard, it goes in after you.
      kyoBirds.push({
        x: bx - nx * s * 0.9, z: bz - nz * s * 0.9,
        yaw: Math.atan2(seg.tx, seg.tz) + (s > 0 ? 0.5 : -0.5),
        t: rand(0, 9), state: 0, dive: 0,
        // ...and how long this one has left of being startled off its gunwale.
        // See kyoUpdateBirds and THE BELL: `bell` is a per-bird countdown so
        // six of them do not come off six boats on the same frame.
        bell: 0, bellD: rand(0, 0.55), bellIn: false,
      });
      // the mooring pole, which is what actually stops you swimming through it
      kyoStaticBox(game, bx, kyoRIVER_Y + 0.5, bz, 0.9, 0.55, 3.0, yaw);
    }
    kyoGates.push({ x: seg.x, z: seg.z, tx: seg.tx, tz: seg.tz, prev: 0, has: false, through: false });
  }
  const m = new THREE.Mesh(G.build(), kyoVC());
  m.castShadow = true;
  m.frustumCulled = false;
  root.add(m);

  // ---- the birds, on their own -------------------------------------------
  // Body and neck in one instance; the two wings in a second, so they can be
  // opened without touching the body. A cormorant with its wings permanently
  // out is a heraldic device; a cormorant that opens them for eleven seconds
  // every half minute is a bird.
  const C = kyoMerger();
  C.sph(0, 0, 0, 0.30, 0.34, 0.44, PALETTE.ironDark);
  C.sph(0, 0.35, 0.30, 0.16, 0.18, 0.16, PALETTE.ironDark);
  C.box(0, 0.42, 0.52, 0.05, 0.05, 0.30, PALETTE.gold);            // the bill
  C.cone(0, -0.12, -0.52, 0.14, 0.55, PALETTE.ironDark, Math.PI / 2, 0, 0);
  kyoBirdMesh = new THREE.InstancedMesh(C.build(), kyoVC(), kyoBirds.length);
  kyoBirdMesh.castShadow = true;
  kyoBirdMesh.frustumCulled = false;
  root.add(kyoBirdMesh);

  const W = kyoMerger();
  for (let s = -1; s <= 1; s += 2) {
    W.box(s * 0.36, 0, -0.06, 0.62, 0.05, 0.50, PALETTE.ironDark, 0, s * 0.16, 0);
  }
  kyoBirdWing = new THREE.InstancedMesh(W.build(), kyoVC(), kyoBirds.length);
  kyoBirdWing.castShadow = false;
  kyoBirdWing.userData.noShadow = true;
  kyoBirdWing.frustumCulled = false;
  root.add(kyoBirdWing);
  kyoUpdateBirds(null, 0);
}

/**
 * THE CORMORANTS. Three states and no state machine worth the name:
 *   0  standing, turning its head about once every four seconds
 *   1  wings out, drying — a cormorant's feathers are not waterproof, which is
 *      why it is the one waterbird you always see standing like a coat rack
 *   2  gone. It has seen something in the water and it is after it, and it
 *      comes up nine metres downstream with the same complete lack of ceremony.
 *
 * The dive is the only one the player can cause, and causing it costs nothing:
 * come down the thread within eight metres of a moored boat during the run.
 */
const kyoBirds = [];
let kyoBirdBellWas = 0;      // last frame's kyoBellPulse — see kyoUpdateBirds
let kyoBirdBellN = 0;        // which of them went in, so it is not always the same three
let kyoBirdMesh = null, kyoBirdWing = null;
function kyoUpdateBirds(game, dt) {
  if (!kyoBirdMesh) return;
  const cp = game && game.capy && game.capy.position;
  // ---- AND THE BELL PUTS THEM OFF THEIR BOATS -----------------------------
  //
  // The note at the strike site names five things that answer one bell — the
  // lanterns, the petals, the grove, the koi and "the cormorants off their
  // boats" — and this function read `kyoBellPulse` NOWHERE. Four of the five
  // agreed about the moment and the sixth thing on the river went on standing
  // there drying its wings. A comment that promises a reaction and a loop that
  // does not have one is worse than never having claimed it.
  //
  // A rising edge, not a level: `kyoBellPulse` decays over about two seconds
  // and a level test would re-startle a bird every frame of that. Each bird
  // carries its own `bellD` delay, so six birds come off six boats over half a
  // second — which is what a shock front crossing a river actually looks like,
  // and what a single frame of six simultaneous flaps does not.
  const rang = kyoBellPulse > 0.92 && kyoBirdBellWas <= 0.92;
  kyoBirdBellWas = kyoBellPulse;
  if (rang) {
    // WHO GOES IN IS DECIDED HERE, ONCE, and not per bird as each one's timer
    // runs out. The first cut asked `(i * 7 + kyoBirdBellN) % 3 === 0` at the
    // END of each bird's startle, and `kyoBirdBellN` was incrementing as those
    // timers expired — so the modulus walked and FOUR of six went in on a
    // strike that was supposed to send about two. Measured 4/6, twice.
    // One counter step per RING, and the choice made on the frame of the ring.
    kyoBirdBellN++;
    for (let i = 0; i < kyoBirds.length; i++) {
      const b = kyoBirds[i];
      b.bell = 1.9 + b.bellD;
      b.bellIn = ((i + kyoBirdBellN) % 3) === 0;   // about one in three, and a
    }                                             // different third each time
  }
  for (let i = 0; i < kyoBirds.length; i++) {
    const b = kyoBirds[i];
    b.t += dt;
    let wing = 0, lift = 0, sink = 0, lean = 0;
    // The startle outranks the drying cycle and the dive alike — a bird that
    // is already under stays under, but one on the gunwale comes off it.
    if (b.bell > 0) {
      b.bell -= dt;
      if (b.state !== 2 && b.bell < 1.9) {
        // wings out hard, a hop, and about one in three goes into the water
        const u = clamp(b.bell / 1.9, 0, 1);
        wing = clamp(u * 1.35, 0, 1);
        lift = Math.sin(clamp((1 - u) * 3.4, 0, Math.PI)) * 0.42;
        lean = Math.sin(b.bell * 13 + i) * 0.16;
        if (b.bell <= 0 && b.bellIn) {
          b.state = 2; b.dive = 0; b.t = 0;
          if (game && game.sfx) game.sfx('splash', { volume: 0.26, pitch: 1.28 });
        }
        const hy0 = Math.sin(b.t * 0.6 + i) * 0.10;
        kyoBirdMesh.setMatrixAt(i, kyoXform(b.x, kyoRIVER_Y + 0.85 + lift, b.z,
                                            lean, b.yaw + hy0 * 0.9, 0, 1, 1, 1));
        kyoBirdWing.setMatrixAt(i, kyoXform(b.x, kyoRIVER_Y + 1.02 + lift, b.z,
                                            0, b.yaw + hy0 * 0.9, 0, wing, wing, wing));
        continue;
      }
    }
    if (b.state === 2) {
      // under, and back up: a half-second down, three quarters under, and it
      // surfaces already facing downstream
      b.dive += dt;
      const u = b.dive / 2.4;
      sink = u < 1 ? Math.sin(clamp(u, 0, 1) * Math.PI) * 1.5 : 0;
      lean = -Math.cos(clamp(u, 0, 1) * Math.PI * 2) * 0.5;
      if (u >= 1) { b.state = 0; b.t = 0; b.dive = 0; }
    } else {
      if (cp) {
        const d2 = (cp.x - b.x) * (cp.x - b.x) + (cp.z - b.z) * (cp.z - b.z);
        if (d2 < 8 * 8 && cp.y < kyoRIVER_Y + 1.0 && b.t > 2.5) {
          b.state = 2; b.dive = 0; b.t = 0;
          if (game && game.sfx) game.sfx('splash', { volume: 0.34, pitch: 1.35 });
        }
      }
      // it dries its wings for a while, then folds them, then does it again
      const cyc = b.t % 34;
      b.state = cyc > 21 && cyc < 32 ? 1 : 0;
      if (b.state === 1) {
        const e = clamp(Math.min(cyc - 21, 32 - cyc) / 1.4, 0, 1);
        wing = e;
        lift = e * 0.08;
      }
    }
    const hy = Math.sin(b.t * 0.6 + i) * 0.10;
    kyoBirdMesh.setMatrixAt(i, kyoXform(b.x, kyoRIVER_Y + 0.85 + lift - sink, b.z,
                                        lean, b.yaw + hy * 0.9, 0, 1, 1, 1));
    // the wings sit on the shoulders and open through 55 degrees
    kyoBirdWing.setMatrixAt(i, kyoXform(b.x, kyoRIVER_Y + 1.02 + lift - sink, b.z,
                                        0, b.yaw + hy * 0.9, 0,
                                        wing, wing, wing));
  }
  kyoBirdMesh.instanceMatrix.needsUpdate = true;
  kyoBirdWing.instanceMatrix.needsUpdate = true;
}

// ------------------------------------------------------- the barrels --------
/**
 * Tea barrels, going the same way you are.
 *
 * They are not obstacles and they are not collectables. They are the ONLY thing
 * that tells you how fast the water under you is moving: a capybara in a river
 * with nothing else in it has no reference at all, because the banks are fifteen
 * metres away and the camera is chasing the animal, not the water. Put a dozen
 * floating barrels in the same flow and the whole river suddenly has a speed.
 *
 * They ride the flow field itself, so they find the thread and pile up in the
 * eddies exactly the way the player does — which also makes them a map of where
 * the fast line is, drawn by the physics rather than by a designer.
 */
function kyoBuildBarrels(root) {
  const B = kyoMerger();
  B.cyl(0, 0, 0, 0.62, 1.05, PALETTE.templeWood, 0, 0, 0, 8);
  B.cyl(0, 0.36, 0, 0.65, 0.12, PALETTE.templeWoodDk, 0, 0, 0, 8);
  B.cyl(0, -0.36, 0, 0.65, 0.12, PALETTE.templeWoodDk, 0, 0, 0, 8);
  B.cyl(0, 0.54, 0, 0.50, 0.10, PALETTE.matchaField, 0, 0, 0, 8);
  const im = new THREE.InstancedMesh(B.build(), kyoVC(), kyoBARREL_N);
  im.frustumCulled = false;
  im.castShadow = true;
  kyoBarrelData = new Float32Array(kyoBARREL_N * 4);        // s, across, spin, bob
  for (let i = 0; i < kyoBARREL_N; i++) {
    kyoBarrelData[i * 4] = (i / kyoBARREL_N) * kyoRiverLen * 0.92 + rand(-6, 6);
    kyoBarrelData[i * 4 + 1] = rand(-0.7, 0.7);
    kyoBarrelData[i * 4 + 2] = rand(0, 6.28);
    kyoBarrelData[i * 4 + 3] = rand(0, 6.28);
  }
  root.add(im);
  kyoBarrels = im;
}

function kyoUpdateBarrels(dt) {
  if (!kyoBarrels) return;
  for (let i = 0; i < kyoBARREL_N; i++) {
    const o = i * 4;
    const seg = kyoRiverSeg(kyoBarrelData[o]);
    const nx = -seg.tz, nz = seg.tx;
    const x = seg.x + nx * kyoBarrelData[o + 1] * seg.w;
    const z = seg.z + nz * kyoBarrelData[o + 1] * seg.w;
    const f = kyoFlowAt(x, z);
    kyoBarrelData[o] += Math.max(0, f.speed) * dt;
    kyoBarrelData[o + 2] += (0.6 + f.speed * 0.35) * dt;
    kyoBarrelData[o + 3] += dt * 2.2;
    // round the bends they drift outward, the way anything floating does
    kyoBarrelData[o + 1] = clamp(kyoBarrelData[o + 1] + Math.sin(kyoBarrelData[o] * 0.05) * dt * 0.10, -0.86, 0.86);
    // and they are pushed off the rocks, because a tea barrel balanced on top of
    // a boulder is the single most conspicuous thing on the river
    if (kyoRocks) {
      for (let q = 0; q < kyoRocks.length; q++) {
        const rk = kyoRocks[q];
        const rdx = x - rk.x, rdz = z - rk.z;
        const rd = Math.hypot(rdx, rdz);
        if (rd > rk.r + 1.4 || rd < 1e-3) continue;
        kyoBarrelData[o + 1] += Math.sign((rdx * nx + rdz * nz) || 1) * dt * 1.4;
        kyoBarrelData[o + 1] = clamp(kyoBarrelData[o + 1], -0.94, 0.94);
      }
    }
    if (kyoBarrelData[o] > kyoRiverLen - 4) {
      kyoBarrelData[o] = rand(0, 30);
      kyoBarrelData[o + 1] = rand(-0.7, 0.7);
    }
    kyoBarrels.setMatrixAt(i, kyoXform(
      x, kyoRIVER_Y + 0.10 + Math.sin(kyoBarrelData[o + 3]) * 0.05, z,
      Math.sin(kyoBarrelData[o + 2]) * 0.16, kyoBarrelData[o + 2] * 0.4,
      Math.cos(kyoBarrelData[o + 2] * 0.8) * 0.14, 1, 1, 1));
  }
  kyoBarrels.instanceMatrix.needsUpdate = true;
}

// ------------------------------------------------------- the surface -------
/**
 * A HUNDRED AND TWENTY STREAKS OF FOAM, GOING WHERE THE WATER GOES.
 *
 * This is the single most important thing in the whole set piece and it is also
 * the cheapest: one instanced draw of flat quads, advected by the same flow
 * field the player is in.
 *
 * Without it the river is a dark sheet. A capybara being carried at eight metres
 * a second across a featureless surface, with the banks fifteen metres away and
 * a camera that is chasing the animal rather than the water, has NO VISIBLE
 * SPEED AT ALL — the first build of this run genuinely read as floating in a
 * pond while the scenery slid past. Streaks fix that outright, and because they
 * ride the real field rather than a scrolling texture they also draw the thread
 * of the current, pile into the eddies behind the boulders and hang about at
 * the banks, which means the player can SEE the fast line instead of learning
 * it by being punished.
 */
const kyoFOAM_N = 120;
let kyoFoam = null, kyoFoamData = null;
function kyoBuildFoam(root) {
  const g = new THREE.PlaneGeometry(1, 1);
  g.rotateX(-Math.PI / 2);
  const im = new THREE.InstancedMesh(g, mat(PALETTE.ujiFoam, {
    transparent: true, opacity: 0.55, depthWrite: false,
  }), kyoFOAM_N);
  im.frustumCulled = false;
  kyoFoamData = new Float32Array(kyoFOAM_N * 4);       // s, across, life, len
  for (let i = 0; i < kyoFOAM_N; i++) kyoFoamRespawn(i, true);
  root.add(im);
  kyoFoam = im;
}
function kyoFoamRespawn(i, anywhere) {
  const o = i * 4;
  kyoFoamData[o] = anywhere ? rand(0, kyoRiverLen) : rand(0, 26);
  kyoFoamData[o + 1] = rand(-0.94, 0.94);
  kyoFoamData[o + 2] = rand(1.2, 3.4);
  kyoFoamData[o + 3] = rand(1.4, 4.2);
}
function kyoUpdateFoam(dt) {
  if (!kyoFoam) return;
  for (let i = 0; i < kyoFOAM_N; i++) {
    const o = i * 4;
    const seg = kyoRiverSeg(kyoFoamData[o]);
    const nx = -seg.tz, nz = seg.tx;
    const x = seg.x + nx * kyoFoamData[o + 1] * seg.w;
    const z = seg.z + nz * kyoFoamData[o + 1] * seg.w;
    const f = kyoFlowAt(x, z);
    kyoFoamData[o] += f.speed * dt;
    kyoFoamData[o + 2] -= dt;
    if (kyoFoamData[o + 2] <= 0 || kyoFoamData[o] > kyoRiverLen - 2) kyoFoamRespawn(i, false);
    // A streak is as long as the water is fast — which is the whole readout.
    // Wide and short in the slack, long and thin in the thread.
    const sp = clamp(Math.abs(f.speed) / kyoFLOW_MAX, 0, 1.4);
    const len = kyoFoamData[o + 3] * (0.35 + sp * 1.5);
    kyoFoam.setMatrixAt(i, kyoXform(x, kyoRIVER_Y + 0.06, z, 0, Math.atan2(seg.tx, seg.tz), 0,
                                    0.34 + (1 - sp) * 0.55, 1, len));
  }
  kyoFoam.instanceMatrix.needsUpdate = true;
}

// ---------------------------------------------------------------- the mill --
/**
 * The end of the run, and the reason a river is in this chapter at all: the mill
 * is what grinds the tea. The race spits you out into its pond, the wheel turns
 * beside you, and the great bowl is forty metres up the bank.
 */
function kyoBuildMill(game, root) {
  const seg = kyoRiverSeg(kyoRiverLen - 3);
  // WHICH BANK. The river hooks back on itself at the end, so one side of the
  // pond is open ground and the other is the reach the run came down twenty
  // seconds earlier — a mill built on that side stands in the water. SIDE picks
  // the outside of the hook; it is a constant because the hook is.
  const SIDE = -1;
  const nx = -seg.tz * SIDE, nz = seg.tx * SIDE;
  // SEVENTEEN METRES BACK FROM THE WATER, not eleven. The rig sits 17 m behind
  // the animal at a shallow pitch through the whole run, so a mill house on the
  // bank at eleven put its roof between the camera and the finish: you arrived
  // at the end of a two-hundred-and-seventy-metre river inside a ceiling.
  const mx = seg.x + nx * 17, mz = seg.z + nz * 17;
  const my = Math.max(kyoRIVER_Y + 0.4, kyoTerrain(mx, mz));
  const M = kyoMerger();
  // A TERRACE UNDER IT, because `my` is a FLOOR and not a ground level. The Uji
  // town shelf sits at −1.94 and the levee that lifts the bank only reaches
  // w + 7 from the centreline; the mill is twenty-two metres out, so `my` clamps
  // to −0.50 and the whole building — and the miller standing beside it — was
  // floating a metre and a half over its own hillside with daylight underneath.
  // A mill on a river bank is built up out of the bank; now it is.
  {
    const gy = kyoTerrain(mx, mz);
    if (my > gy + 0.2) {
      M.box(mx, (gy + my) * 0.5 - 0.2, mz, 13.0, my - gy + 0.6, 12.0, PALETTE.granite);
      M.box(mx, my - 0.10, mz, 13.6, 0.24, 12.6, PALETTE.graniteDark);
      kyoStaticBox(game, mx, (gy + my) * 0.5 - 0.2, mz, 6.5, (my - gy + 0.6) * 0.5, 6.0);
    }
  }
  // the mill house: plaster over a timber frame, with the deep kawara roof
  M.box(mx, my + 2.6, mz, 8.0, 5.2, 7.0, PALETTE.adobeWall);
  for (let s = -1; s <= 1; s += 2) {
    M.box(mx + s * 3.9, my + 2.6, mz, 0.28, 5.2, 7.2, PALETTE.templeWoodDk);
  }
  M.box(mx, my + 3.4, mz - 3.6, 5.4, 2.0, 0.20, PALETTE.shoji);
  M.box(mx, my + 5.5, mz, 9.6, 0.5, 8.4, PALETTE.kawara);
  M.box(mx, my + 6.0, mz, 6.0, 0.5, 5.4, PALETTE.kawaraDark);
  M.box(mx, my + 1.2, mz - 3.7, 3.0, 2.4, 0.16, PALETTE.templeWoodDk);
  kyoStaticBox(game, mx, my + 2.6, mz, 4.0, 2.6, 3.5);
  // the sluice, running from the race to the wheel
  const sx = seg.x + nx * 5.4, sz = seg.z + nz * 5.4;
  for (let k = 0; k < 7; k++) {
    const t = k / 6;
    M.box(lerp(sx, mx - nx * 2.0, t), kyoRIVER_Y + 0.9 + t * 0.5, lerp(sz, mz - nz * 2.0, t),
          2.2, 0.22, 2.6, PALETTE.templeWood, 0, Math.atan2(nx, nz), 0);
  }
  const m = new THREE.Mesh(M.build(), kyoVC());
  m.castShadow = true; m.receiveShadow = true;
  root.add(m);

  // the wheel itself, on its own node so it can turn
  const W = kyoMerger();
  const R = 2.9;
  for (let s = -1; s <= 1; s += 2) {
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      W.box(Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5, s * 0.85,
            R, 0.14, 0.14, PALETTE.templeWoodDk, 0, 0, a);
    }
    for (let i = 0; i < 12; i++) {
      const a = (i + 0.5) / 12 * Math.PI * 2;
      W.box(Math.cos(a) * R, Math.sin(a) * R, s * 0.85, 0.9, 0.16, 0.16, PALETTE.templeWood, 0, 0, a + 1.57);
    }
  }
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    W.box(Math.cos(a) * (R - 0.25), Math.sin(a) * (R - 0.25), 0, 0.7, 0.10, 1.8,
          PALETTE.templeWood, 0, 0, a);      // the paddles
  }
  W.cyl(0, 0, 0, 0.22, 2.4, PALETTE.ironDark, Math.PI / 2, 0, 0, 8);
  const wheel = new THREE.Mesh(W.build(), kyoVC());
  wheel.castShadow = true;
  wheel.position.set(mx - nx * 5.2, kyoRIVER_Y + 1.9, mz - nz * 5.2);
  wheel.rotation.y = Math.atan2(seg.tx, seg.tz);
  root.add(wheel);
  kyoMillWheel = wheel;
  kyoMILL.x = seg.x; kyoMILL.z = seg.z;
  // WHERE A PERSON CAN STAND, which is NOT kyoMILL. kyoMILL is the point on the
  // river's CENTRELINE that the run finishes at — the middle of the mill pond,
  // bed at -4.3, surface at -0.9 — and the miller has been standing on it, at
  // y = +0.45, since the locals were added. The note in npc.js says his anchor
  // was moved onto land; it moved his HEIGHT and left his x and z in the water,
  // so what actually shipped is a man hovering one and a third metres above the
  // middle of a river talking about his wheel. Probe the terrain; never trust a
  // landmark constant as a place to stand.
  // on the terrace, at the INLAND corner. Pulling him toward the wheel put him
  // 12.6 m off the centreline against a 13 m half-width — back in the river,
  // which is the whole thing this move exists to get him out of.
  kyoMILL_STAND.x = mx + nx * 4.4 + seg.tx * 3.6;
  kyoMILL_STAND.z = mz + nz * 4.4 + seg.tz * 3.6;
  kyoMILL_STAND.y = my;
}
const kyoMILL = { x: 54, z: 148 };
const kyoMILL_STAND = { x: 54, y: 0, z: 148 };

// ------------------------------------------------------------- the run -----
/**
 * ONE FRAME OF THE RIVER.
 *
 * The clock starts when the animal is in the water at or above the bridge and
 * stops when it reaches the mill pond. Leaving the river stops it — but not
 * instantly: kyoRUN_OUT is a second and a half of grace, because being thrown
 * clean over a boulder and landing back in the water two metres downstream is
 * the best thing that happens in this run and it should not cost the attempt.
 */
const kyoRUN_OUT = 1.5;             // s out of the water before the run lapses
const kyoRUN_END_R = 13;            // m of the mill pond that counts as arrival
const kyoRUN_MIN = 5;               // s below which a "run" is an accident, not a run
// ---- THE GATES ARE SECONDS (L5) ---------------------------------------------
// The three boats were a chime and a line in the toast. They are the fast
// line made visible, and a fast line should be worth time: every boat you go
// through takes kyoGATE_BONUS off the clock — said on the paper the moment
// it happens, filed in the number at the mill — and the river gives you a
// nudge down its own thread through it. A run that reads the river is a
// faster run twice over. THE FINISH is a moment now: the wheel spun up for
// six seconds under the spray, the world at half speed, the chime and the
// birds off the mill pond.
const kyoGATE_BONUS = 2.0;          // s off the run per boat
let kyoGateBonusT = 0;              // s of "−2 s" flashed on the paper
let kyoMillFast = 0;                // s of the wheel spinning up after a finish

function kyoUpdateRun(game, dt) {
  if (!kyoRX) return;
  const capy = game.capy;
  const p = capy && capy.position;
  if (!p) return;
  const nr = kyoRiverNear(p.x, p.z);
  const wet = nr.d < nr.w * kyoRUN_HZ_OUT && p.y < kyoRIVER_Y + 1.4;
  kyoInRiver = wet;
  kyoRunFlow = wet ? clamp(kyoFlowAt(p.x, p.z).speed / kyoFLOW_MAX, -0.3, 1) : 0;
  // ---- ...AND THE RIVER IS AUDIBLE FROM THE BANK (A1) -------------------
  // The Uji run is the chapter's marquee and the water made no sound at all
  // unless you were in it. `nr` is the nearest point on the centreline, which
  // this function has already computed for its own purposes — so the bed sits
  // on the water nearest you and gets louder as you walk down to it, which is
  // the whole of what a river does.
  if (!kyoRiverMover && game.sfxMover) {
    kyoRiverMover = game.sfxMover('river', { key: 'kyo:uji', near: 20, far: 120 });
  }
  if (kyoRiverMover && nr) {
    const seg = kyoRiverSeg(nr.s);
    kyoRiverMover.at(seg.x, kyoRIVER_Y + 0.3, seg.z);
    // Wider water is louder water: the half-width table runs 5.5 to 15 m and
    // the mill end is the noisy end.
    kyoRiverMover.set(clamp(0.45 + (seg.w - 5.5) / 19, 0.35, 1));
  }
  // The bamboo, which is everywhere here and made no sound: a bed at the
  // animal, so the calm's rise (sysMOVER_CALM) is its whole dynamic. Quieter
  // in the water — the river is the sound there.
  if (!kyoLeavesBed && game.sfxMover) kyoLeavesBed = game.sfxMover('leaves', { key: 'kyo:leaves', near: 20, far: 90 });
  if (kyoLeavesBed) { kyoLeavesBed.at(p.x, p.y + 3, p.z); kyoLeavesBed.set(wet ? 0.5 : 1); }

  // --- the gates, for the toast and for nothing else ---
  // They are not required and they are not counted against you. A gate you have
  // to hit turns a river into a slalom, and this river is already asking you to
  // read it; the boats are there so that the fast line has a shape you can SEE
  // from upstream, and going through one should feel like agreeing with the
  // river rather than obeying a rule.
  if (kyoGates && wet) {
    for (let i = 0; i < kyoGates.length; i++) {
      const gt = kyoGates[i];
      const d = (p.x - gt.x) * gt.tx + (p.z - gt.z) * gt.tz;
      const lat = Math.abs((p.x - gt.x) * -gt.tz + (p.z - gt.z) * gt.tx);
      if (!gt.has) { gt.has = true; gt.prev = d; continue; }
      const crossed = gt.prev < 0 && d >= 0;
      gt.prev = d;
      if (crossed && lat < 2.8 && !gt.through) {
        gt.through = true;
        let n = 0;
        for (let k = 0; k < kyoGates.length; k++) if (kyoGates[k].through) n++;
        if (typeof game.sfx === 'function') game.sfx('chime', { volume: 0.55, pitch: 1.3 + n * 0.2 });
        // THE GATE IS SECONDS (L5): off the clock, said, and a nudge down the thread
        if (kyoRunT >= 0) {
          kyoGateBonusT = 1.6;
          if (typeof game.sparks === 'function') game.sparks(gt.x, kyoRIVER_Y + 0.4, gt.z, 18, { spd: 3, up: 2.5, grav: 9, drag: 0.6, life: 0.9, size: 0.22, rgb: [1.2, 1.45, 1.7] });
          if (capy && typeof capy.launch === 'function' && capy.velocity) {
            const v = capy.velocity;
            capy.launch(v.x + gt.tx * 1.6, Math.max(0, v.y), v.z + gt.tz * 1.6, 'the gate');   // named for the pill (L6, E1)
          }
          if (typeof game.toast === 'function' && n === 1 && !kyoRunDone) game.toast('through the boat — two seconds off. the river agrees with you.');
        }
      }
    }
  }

  // --- the clock ---
  // THE FINISH HAD NO LATCH, AND THE MARQUEE FIRED SIXTY-SEVEN TIMES.
  // Measured: thirty seconds of floating in the mill pond produced 67 chimes,
  // 67 splashes, 67 toasts and 67 calls to game.record(), and `runBest` came
  // back **0.00 s**. The mill sits at an `nr.s` inside the arming window, so the
  // frame after the finish set `kyoRunT = -1` the block below armed it back to
  // 0, and the 13 m circle fired again one frame later on a run 16 ms long.
  //
  // -2 IS "LANDED". Only leaving the pond clears it back to -1, which is the
  // only state the clock may arm from. A one-shot payout needs a state that
  // means "already paid" — not the same idle value it starts life in.
  const dxm = p.x - kyoMILL.x, dzm = p.z - kyoMILL.z;
  const dMill2 = dxm * dxm + dzm * dzm;
  if (kyoRunT === -2) {
    // 1.5x the finish radius, so drifting on the rim cannot chatter the latch
    if (dMill2 > kyoRUN_END_R * kyoRUN_END_R * 2.25) kyoRunT = -1;
  } else if (kyoRunT < 0) {
    // start it the moment you are in the water and upstream of the mill
    if (wet && nr.s >= kyoRunFromS - 6 && nr.s < kyoRiverLen - 40) {
      kyoRunT = 0;
      kyoRunOutT = 0;
      for (let i = 0; kyoGates && i < kyoGates.length; i++) { kyoGates[i].through = false; kyoGates[i].has = false; }
      if (!kyoRunDone && typeof game.toast === 'function') game.toast('do not fight it. pick a side.');
    }
  } else {
    kyoRunT += dt;
    if (wet) kyoRunOutT = 0;
    else {
      kyoRunOutT += dt;
      if (kyoRunOutT > kyoRUN_OUT) kyoRunT = -1;        // out of the river: no run
    }
  }
  // ---- the chute (W1) -------------------------------------------------------
  if (kyoRunT === 0) { kyoChuteFired = false; kyoChuteAir = 0; }
  if (kyoRunT >= 0 && kyoChuteS > 0) {
    const v = capy.velocity;
    if (!kyoChuteFired && wet && nr.s >= kyoChuteS - 1.5 && nr.s < kyoChuteS + 5 && nr.d < nr.w * 0.95) {
      const down = v ? v.x * nr.tx + v.z * nr.tz : 0;
      if (down > kyoCHUTE_MIN && typeof capy.launch === 'function') {
        kyoChuteFired = true;
        kyoChuteAir = 0.9;
        capy.launch(v.x * 1.25 + nr.tx * 1.5, kyoCHUTE_V, v.z * 1.25 + nr.tz * 1.5, 'the chute');   // named for the pill (L6, E1)
        if (typeof game.sfx === 'function') {
          game.sfx('splash', { volume: 0.9, pitch: 0.8, at: p });
          game.sfx('gasp', { volume: 0.7 });
        }
        if (typeof game.punch === 'function') game.punch(0.2); else if (game.shake) game.shake(0.2);
        // the top of the arc is held (L3): the one airborne second of the run
        if (typeof game.slowmo === 'function') game.slowmo(0.55, 0.8);
        if (!kyoChuteSaid && typeof game.toast === 'function') { kyoChuteSaid = true; game.toast('the chute'); }
      }
    }
    if (kyoChuteAir > 0) kyoChuteAir -= dt;
  }
  // ---- the run, on the signpost (W1) --------------------------------------
  if (kyoRunT >= 0 && typeof game.wowLive === 'function') {
    let gates = 0;
    for (let i = 0; kyoGates && i < kyoGates.length; i++) if (kyoGates[i].through) gates++;
    const left = Math.max(0, kyoRiverLen - nr.s);
    if (kyoGateBonusT > 0) kyoGateBonusT -= dt;
    game.wowLive((kyoChuteAir > 0 ? 'AIR · ' : 'in the river · ') + Math.round(left) + ' m to the mill · ' +
                 gates + ' of 3 boats' + (kyoGateBonusT > 0 ? ' · −2 s' : '') + ' · ' + Math.max(0, kyoRunT - gates * kyoGATE_BONUS).toFixed(1) + ' s',
                 clamp((nr.s - kyoRunFromS) / Math.max(1, kyoRiverLen - kyoRunFromS), 0, 1));
  }

  // --- the clock, on the paper (v32) ---
  // `kyoRunT >= 0` is the whole definition of "an attempt is open" and it is
  // already maintained above, so this is two lines and no new state. Every
  // other way out of the run — the mill, the bank, the border — leaves the
  // clock negative on the next frame and closes the line here.
  if (kyoRunT >= 0) {
    if (game.recordLive) {
      let gates = 0;
      for (let i = 0; kyoGates && i < kyoGates.length; i++) if (kyoGates[i].through) gates++;
      game.recordLive('uji-run', Math.max(0, kyoRunT - gates * kyoGATE_BONUS));
    }
  } else if (game.recordEnd) game.recordEnd('uji-run');

  // --- the finish ---
  // ...AND ONLY FROM THE HOOK (W1). The gorge's outbound reach passes eleven
  // metres from the middle of the mill pond — the hook comes back on itself —
  // so a run was being finished from the far side of the bend with a hundred
  // metres of river still to go. Measured: run ended at 96 m to the mill.
  if (kyoRunT >= 0 && dMill2 < kyoRUN_END_R * kyoRUN_END_R && nr.s > kyoRiverLen - 30) {
    const t = kyoRunT;
    kyoRunT = -2;                                    // landed; see the clock above
    // ...AND A RUN IS TWO HUNDRED METRES OF RIVER.
    //
    // The arming window runs all the way to 40 m short of the end, so paddling
    // into the water just above the mill armed the clock and the 13 m circle
    // finished it — measured at **0.4 s**, and that 0.4 was written straight
    // into `runBest` as the chapter's personal best. A record table that has
    // once accepted a fraction of a second can never be beaten by anybody
    // again, and the chapter's own NPC line says the river does it in forty.
    //
    // Below the floor NOTHING happens: no tick, no toast, no chime, no record.
    // The latch above still holds, so it does not chatter either — you simply
    // have to go and get in further up, which is the task.
    if (t <= kyoRUN_MIN) return;
    let gates = 0;
    for (let i = 0; kyoGates && i < kyoGates.length; i++) if (kyoGates[i].through) gates++;
    // the boats come off the clock (L5)
    const tRun = Math.max(kyoRUN_MIN + 0.1, t - gates * kyoGATE_BONUS);
    if (!kyoRunDone) {
      kyoRunDone = true;
      kyoTask('uji-run');
      if (typeof game.toast === 'function') {
        game.toast(gates === 3 ? 'through every boat. the birds were not impressed.'
                              : 'two hundred metres of river, and no paddle');
      }
    } else if (typeof game.toast === 'function') {
      game.toast(tRun.toFixed(1) + ' s' + (gates > 0 ? '  ·  ' + gates + (gates === 3 ? ' boats, all of them' : ' of the boats') + ', ' + (gates * kyoGATE_BONUS).toFixed(0) + ' s off' : ''));
    }
    if (typeof game.record === 'function') game.record('uji-run', +tRun.toFixed(1));
    // ---- THE FINISH IS A MOMENT (L5) ------------------------------------
    kyoMillFast = 6;
    if (typeof game.slowmo === 'function') game.slowmo(0.5, 1.1);
    if (typeof game.sparks === 'function' && kyoMillWheel) {
      const wp = kyoMillWheel.position;
      game.sparks(wp.x, wp.y + 1.5, wp.z, 40, { spd: 4.5, up: 3, grav: 9, drag: 0.5, life: 1.3, size: 0.28, rgb: [1.2, 1.45, 1.7] });
    }
    if (typeof game.punch === 'function') game.punch(0.10);
    // ---- AUDIBLE. Both of these were mono, and they are the loudest thing in
    // the chapter: every cue around this payout was mono while all six
    // stepping-stone notes forty metres away were already positional. The toy
    // was better mixed than the wow.
    if (typeof game.sfx === 'function') {
      game.sfx('chime', { volume: 1, at: kyoMILL });
      game.sfx('splash', { volume: 0.6, at: p });
    }
    // ---- FRAMED (v26). The wheel is the thing this chapter is about, and at
    // the payout it sat 113 degrees off the view centre: the screenshot is a
    // sheet of blank water with the wheel clipped into the top-right corner.
    // The bearing is COMPUTED from the wheel back to the animal rather than
    // written down, because the wheel is placed on the river's last segment and
    // moves with the river — kyoMILL itself is reassigned at build time.
    if (typeof game.frameShot === 'function' && kyoMillWheel) {
      const wp = kyoMillWheel.position;
      game.frameShot({
        yaw: Math.atan2(p.x - wp.x, p.z - wp.z),
        dist: 17, pitch: 18 * Math.PI / 180, raise: 3.0, hold: 2.6
      });
    }
    if (kyoRunBest === 0 || tRun < kyoRunBest) kyoRunBest = tRun;
  }

  // the wheel turns as long as there is water going under it — and quicker
  // for a while after a run comes down (L5)
  if (kyoMillWheel) {
    if (kyoMillFast > 0) kyoMillFast -= dt;
    kyoMillSpin += dt * (0.85 + (kyoMillFast > 0 ? 2.2 * Math.min(1, kyoMillFast / 1.5) : 0));
    kyoMillWheel.rotation.x = kyoMillSpin;
  }
}

function kyoTask(id) {
  const g = kyoGame;
  if (g && typeof g.completeTask === 'function') g.completeTask(id);
}

/** Where the camera eye belongs while the capybara is in the torii tunnel.
 *
 * Two wrong answers first, because the geometry rules both of them out.
 *
 * The boom straight back at the camera's yaw does not work: the tunnel S-curves
 * up the flank, so a straight line back from the animal leaves the corridor
 * sideways and ends up inside a leg. Measured on the live rig — eye 2.21 m over
 * the ground it was passing, which is leg height, three meshes across the sight
 * line at 5.1, 5.3 and 6.4 m, and the capybara not on screen for the whole run.
 *
 * Lifting the eye over the gates does not work either. The 44 gates are spread
 * over ~61 m of path, so they stand about 1.4 m apart carrying a kasagi 0.8 m
 * deep — that is a ROOF, not a louvre, and from above you get a red floor and
 * still no animal.
 *
 * What is left is the shot the place is famous for: put the eye INSIDE the
 * corridor, on the centreline, a few metres back along the PATH — following the
 * polyline rather than a straight line — and look up the tunnel through the
 * gate openings. The gates are 5 m wide in the clear and 4 m tall, so a
 * centreline eye at 1.9 m sees straight through every one of them.
 *
 * Returns { x, y, z, w }: w is 1 in the corridor and eases to 0 at its edge, so
 * systems.js can blend the rail in and out instead of snapping to it.
 */
function kyoToriiCam(cx, cz, back) {
  if (!kyoTORII.length) return null;
  // nearest point on the gate polyline, as (segment, t)
  let best = Infinity, bi = 0, bt = 0;
  for (let i = 0; i < kyoTORII_N - 1; i++) {
    const ax = kyoTORII[i * 2], az = kyoTORII[i * 2 + 1];
    const ex = kyoTORII[(i + 1) * 2] - ax, ez = kyoTORII[(i + 1) * 2 + 1] - az;
    const len2 = ex * ex + ez * ez;
    let t = len2 > 0 ? ((cx - ax) * ex + (cz - az) * ez) / len2 : 0;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    const px = ax + ex * t, pz = az + ez * t;
    const d2 = (cx - px) * (cx - px) + (cz - pz) * (cz - pz);
    if (d2 < best) { best = d2; bi = i; bt = t; }
  }
  const d = Math.sqrt(best);
  if (d > kyoTORII_CAM_R) return null;
  // 1 well inside the gates, easing to 0 over the last metre and a half of the
  // corridor so stepping out from under the tunnel does not snap the camera.
  const w = d < kyoTORII_CAM_R - 1.5 ? 1 : (kyoTORII_CAM_R - d) / 1.5;

  // walk BACK down the polyline by 'back' metres from that point
  let rx = kyoTORII[bi * 2] + (kyoTORII[(bi + 1) * 2] - kyoTORII[bi * 2]) * bt;
  let rz = kyoTORII[bi * 2 + 1] + (kyoTORII[(bi + 1) * 2 + 1] - kyoTORII[bi * 2 + 1]) * bt;
  // ...but STOP if the path has fallen too far away underneath. The eye has to
  // stay under the gate standing over IT (top at that gate's ground + 4.0) while
  // also sitting above the ANIMAL, and those two only coexist while the rail
  // point is within about a gate's height of the animal's own level. Measured at
  // gate 18, where the pitch is steepest: railing the full 5.2 m put the rail
  // ground 2.25 m below the capybara, the ceiling then clamped the eye to 1.0 m
  // over it, and the path slab in between took the animal out of frame. Letting
  // the boom shorten on the steep pitches fixes it twice over — the eye gets the
  // height it needs, and there are fewer slab noses left between it and the
  // animal to begin with.
  const gCapyW = kyoTerrain(cx, cz);
  let left = back, i = bi, t = bt;
  while (left > 0 && i >= 0) {
    const ax = kyoTORII[i * 2], az = kyoTORII[i * 2 + 1];
    if (kyoTerrain(ax, az) < gCapyW - kyoTORII_CAM_DROP) break;
    const seg = Math.hypot(rx - ax, rz - az);
    if (seg >= left) {
      const f = left / (seg || 1);
      const nx2 = rx + (ax - rx) * f, nz2 = rz + (az - rz) * f;
      if (kyoTerrain(nx2, nz2) < gCapyW - kyoTORII_CAM_DROP) break;
      rx = nx2; rz = nz2;
      left = 0;
    } else {
      left -= seg; rx = ax; rz = az; i--; t = 1;
    }
  }
  if (left > 0 && i >= 0) left = 0;   // stopped early by the drop, not by running out of path
  // Below the first gate the path stops but the approach does not, so keep
  // running on the opening bearing rather than parking the eye on gate zero.
  if (left > 0) {
    const dx = kyoTORII[0] - kyoTORII[2], dz = kyoTORII[1] - kyoTORII[3];
    const m = Math.hypot(dx, dz) || 1;
    rx += dx / m * left; rz += dz / m * left;
  }
  // ---- eye height: SOLVE the sight line, do not guess it -------------------
  // Two earlier guesses both failed on the steep pitches. Referencing the eye
  // to the ground under ITSELF put it ~2 m below the animal (the rail point is
  // back down a hill that climbs about 0.4 m per metre of path). Referencing it
  // to the ground under the ANIMAL fixed the shallow stretches and still lost
  // the animal around gate 28, where the path slabs stand proud enough to cut
  // the sight line even from 2.6 m up.
  //
  // So solve it. Sample the ground along the line from the eye to the animal
  // and lift the eye until the straight line passes kyoTORII_CAM_SKIM above
  // every sample: for a sample at fraction f, the line sits at
  // ey + (ty - ey) * f, so clearing it needs ey >= (need - ty * f) / (1 - f).
  // Eight samples, no allocation, and it is exact for the straight line it is
  // actually testing rather than a margin someone tuned by eye.
  const gCapy = kyoTerrain(cx, cz);
  const ty = gCapy + kyoTORII_CAM_AIM;          // what we are looking AT
  let ey = gCapy + kyoTORII_CAM_Y;
  for (let s = 1; s <= 8; s++) {
    const f = s / 9;                             // 0.11 .. 0.89, ends excluded
    const sx = rx + (cx - rx) * f, sz = rz + (cz - rz) * f;
    const need = kyoTerrain(sx, sz) + kyoTORII_CAM_SKIM;
    const want = (need - ty * f) / (1 - f);
    if (want > ey) ey = want;
  }
  // The gate standing over the eye has its rail at rail-ground + 4.0, so the
  // lift has a hard ceiling: better a slab across the corner of the frame than
  // the camera inside a kasagi. Floored too, so it cannot sink into the path
  // on the stretches that run downhill.
  const gRail = kyoTerrain(rx, rz);
  if (ey > gRail + kyoTORII_CAM_CEIL) ey = gRail + kyoTORII_CAM_CEIL;
  if (ey < gRail + kyoTORII_CAM_MIN) ey = gRail + kyoTORII_CAM_MIN;
  return { x: rx, y: ey, z: rz, w: w };
}

/**
 * The torii run: through every gate, in order, without going back down.
 *
 * ---- IT DOES NOT STOP HAPPENING WHEN IT IS TICKED (v51) --------------------
 * This function used to open `if (kyoToriiDone) return`, and that one line was
 * the whole of what was wrong with the last twenty minutes of this chapter.
 * Forty-four gates up a mountain, a wooden block per gate climbing a scale, a
 * camera rail written specially for it — and every bit of it switched off for
 * ever the first time a player reached the top. The best thing in Kyoto became
 * inert scenery at the moment it paid out, which is exactly backwards: a run
 * up a hill is the kind of thing you do AGAIN.
 *
 * So the task keeps its latch (a tick fires once, `completeTask` would ignore
 * a second one anyway) and the RUN re-arms: the counter goes back to zero, the
 * gates go on singing, and there is now a clock on it — see 'torii-run' in
 * RECORDS. Nothing is gated on any of this, nothing is harder, and a player
 * who never goes back up plays the chapter that shipped.
 */
function kyoCheckTorii(game, dt) {
  const capy = game.capy;
  if (!capy || !capy.position) return;
  // The clock, and the line on the paper. It runs from the first gate to the
  // last and is handed over every frame, which is what `recordLive` wants.
  if (kyoToriiRunT >= 0) {
    kyoToriiRunT += dt;
    if (game.recordLive) game.recordLive('torii-run', kyoToriiRunT);
  }
  const i = kyoToriiSeq;
  const gx = kyoTORII[i * 2], gz = kyoTORII[i * 2 + 1];
  const dx = capy.position.x - gx, dz = capy.position.z - gz;
  if (dx * dx + dz * dz < 6.0 * 6.0) {
    // The first gate STARTS the clock, and it is the only place it starts —
    // so walking down through gate forty and back up is not a 2-second run.
    if (kyoToriiSeq === 0) kyoToriiRunT = 0;
    kyoToriiSeq++;
    kyoToriiT = 0;
    // ---- EVERY GATE MAKES A SOUND, AND THE SOUND CLIMBS -----------------
    // Forty-four gates and the only feedback the run had was a line of text on
    // the eleventh, the twenty-second and the thirty-third. Twenty-five seconds
    // of the chapter's second-biggest set piece with nothing under it at all.
    //
    // A wooden block per gate — quiet, positional, and rising a semitone-ish
    // over the length of the tunnel — is the cheapest possible version of "this
    // is going somewhere", and going up a scale is the whole feeling of the
    // climb. Deliberately soft: forty-four loud ticks is a smoke alarm.
    if (typeof game.sfx === 'function') {
      const f = kyoToriiSeq / kyoTORII_N;
      game.sfx('tick', { volume: 0.16 + f * 0.16, pitch: 0.86 + f * 0.85,
                         at: { x: gx, y: kyoTerrain(gx, gz) + 2.4, z: gz } });
    }
    if (kyoToriiSeq >= kyoTORII_N) {
      const again = kyoToriiDone;
      kyoToriiDone = true;
      // The number, and it is filed on EVERY run including the first — the
      // tick is the news that time and `recordValue` stays quiet on a first
      // figure, which is the rule it has always kept.
      if (kyoToriiRunT >= 0 && typeof game.record === 'function') {
        game.record('torii-run', kyoToriiRunT);
      }
      if (game.recordEnd) game.recordEnd('torii-run');
      kyoToriiRunT = -1;
      // ...AND THE TUNNEL RE-ARMS. Back to the bottom of the counter, so the
      // gates sing again for anybody who walks down and turns round. Not on the
      // same frame the run finished: gate forty-four is within six metres of
      // itself, so a counter reset here and nothing else would immediately
      // re-count it as gate one. kyoToriiT is what holds it off — the decay
      // below cannot bite at seq 0, and the next gate-1 hit is a genuine one
      // because gate 1 is sixty metres down the hill.
      kyoToriiSeq = 0; kyoToriiT = 0;
      if (!again) {
        kyoTask('torii-run');
        if (typeof game.sfx === 'function') game.sfx('chime', { volume: 0.9 });
        if (typeof game.toast === 'function') game.toast('senbon torii. a thousand gates, they say. it is nearer ten.');
      } else if (typeof game.sfx === 'function') {
        game.sfx('chime', { volume: 0.7, pitch: 1.18 });
      }
    } else if (kyoToriiSeq % 11 === 0) {
      if (typeof game.toast === 'function') {
        game.toast(kyoToriiSeq + ' of ' + kyoTORII_N + ' …keep going');
      }
    }
    return;
  }
  // wandered off: the count decays rather than resetting, so one bad step does
  // not cost forty gates
  kyoToriiT += dt;
  if (kyoToriiT > 12 && kyoToriiSeq > 0) {
    kyoToriiSeq--; kyoToriiT = 0;
    // ...and a run that has decayed all the way back to nothing is over, so
    // the clock and the line go with it rather than counting up beside a
    // player who left the mountain twenty seconds ago.
    if (kyoToriiSeq === 0) { kyoToriiRunT = -1; if (game.recordEnd) game.recordEnd('torii-run'); }
  }
}

/** The rock garden: paw prints in the gravel, and enough of them is enough. */
function kyoCheckZen(game, dt) {
  void dt;
  const capy = game.capy;
  if (!capy || !capy.position || !kyoTrackMesh) return;
  const p = capy.position;
  if (Math.abs(p.x - kyoZEN.x) > kyoZEN.hx || Math.abs(p.z - kyoZEN.z) > kyoZEN.hz) return;
  if (!capy.grounded) return;
  const sp = Math.sqrt(capy.velocity.x * capy.velocity.x + capy.velocity.z * capy.velocity.z);
  if (sp < 0.6) return;
  // one print every ~0.9 m of travel, measured against the LAST one written —
  // which is not `kyoTrackN - 1` once the pool has wrapped
  if (kyoTrackLast >= 0) {
    const o = kyoTrackLast * 3;
    const dx = p.x - kyoTrackPos[o], dz = p.z - kyoTrackPos[o + 2];
    if (dx * dx + dz * dz < 0.81) return;
  }
  // ---- THE POOL RECYCLES, IT DOES NOT STOP ------------------------------
  // `return` here meant that after twenty-six prints the gravel took no more:
  // you could run laps of the garden and nothing appeared under you, which
  // reads as the mechanic having broken rather than as a budget being spent.
  // A ring buffer costs one modulo and means the garden can always be walked
  // through again — the oldest print is the one the rake got to first, which
  // is also the honest fiction.
  const i = kyoTrackN < kyoZEN_TRACKS ? kyoTrackN++ : (kyoTrackLast + 1) % kyoZEN_TRACKS;
  kyoTrackLast = i;
  kyoTrackPos[i * 3] = p.x; kyoTrackPos[i * 3 + 1] = 0; kyoTrackPos[i * 3 + 2] = p.z;
  kyoTrackMesh.setMatrixAt(i, kyoXform(p.x, kyoTerrain(p.x, p.z) + 0.22, p.z,
                                       -Math.PI / 2, rand(0, 3), 0, 0.55, 0.9, 1));
  kyoTrackDirty = true;
  kyoZenTouched++;
  if (!kyoZenDone && kyoZenTouched >= 12) {
    kyoZenDone = true;
    kyoTask('zen-ruin');
    if (typeof game.sfx === 'function') game.sfx('rustle', { volume: 0.8 });
    if (typeof game.toast === 'function') game.toast('a bold reinterpretation');
  }
}
const kyoTrackPos = new Float32Array(kyoZEN_TRACKS * 3);
let kyoTrackLast = -1;      // index of the most recent print — see the ring in kyoCheckZen

function kyoCheckSwim(game, dt) {
  if (kyoSwimDone) return;
  const capy = game.capy;
  if (!capy) return;
  // THE POND, NOT ANY WATER. kyoIsOverWater answers true for the Uji as well,
  // and the Uji run puts the animal in the river for the better part of a
  // minute — so 'Swim in the golden pond' ticked itself a hundred and thirty
  // metres away as a side effect of the chapter's set piece, while its beacon
  // pointed at a pavilion the player never had to visit.
  const kpx = (capy.position.x - kyoPOND.x) / kyoPOND.rx;
  const kpz = (capy.position.z - kyoPOND.z) / kyoPOND.rz;
  if (kpx * kpx + kpz * kpz < 1 && capy.position.y < kyoWATER_Y + 0.55) {

    kyoSwamT += dt;
    if (kyoSwamT > 1.2) {
      kyoSwimDone = true;
      kyoTask('golden-swim');
      if (typeof game.toast === 'function') game.toast('the koi have questions');
    }
  } else {
    kyoSwamT = 0;
  }
}

/**
 * THE DASH, AND IT ALSO STOPPED HAPPENING (v51). Same shape as the tunnel
 * above and the same one-line cause: `if (kyoBambooDone) return`. Fifty-one
 * metres of grove at a sprint is a thing with a clock in it, and it had
 * neither a clock nor a second go.
 */
function kyoCheckBamboo(game, dt) {
  const capy = game.capy;
  if (!capy) return;
  const inside = Math.abs(capy.position.x - kyoBAMBOO.x) < kyoBAMBOO.hx &&
                 Math.abs(capy.position.z - kyoBAMBOO.z) < kyoBAMBOO.hz;
  if (inside) {
    // NOT `if (kyoBambooEnter < 0)`. The grove sits at z = -44, so every honest
    // entry z is negative and a negative sentinel re-armed the mark on every
    // frame: the distance travelled was always about zero and the task could
    // never fire. A separate flag, because the value has no spare range.
    if (!kyoBambooIn) { kyoBambooIn = true; kyoBambooEnter = capy.position.z; kyoBambooT = 0; }
    kyoBambooT += dt;
    // THE LINE WAITS UNTIL IT IS A CROSSING. Standing in the corner of the
    // grove is not an attempt at anything, and a clock that starts on the
    // first culm would put one on the paper every time a player walked past.
    // A third of the way over is a commitment.
    const kbGone = Math.abs(capy.position.z - kyoBambooEnter);
    if (kbGone > kyoBAMBOO.hz * 0.5 && game.recordLive) game.recordLive('bamboo-dash', kyoBambooT);
    // crossed the grove end to end, at a run
    if (kbGone > kyoBAMBOO.hz * 1.5 && capy.isRunning) {
      const again = kyoBambooDone;
      kyoBambooDone = true;
      if (typeof game.record === 'function') game.record('bamboo-dash', kyoBambooT);
      if (game.recordEnd) game.recordEnd('bamboo-dash');
      // Re-armed on the spot: the mark moves to where you are, so turning
      // round and going back the other way is the next attempt and not a free
      // one — you have to cross the whole fifty-one metres again either way.
      kyoBambooEnter = capy.position.z; kyoBambooT = 0;
      if (typeof game.sfx === 'function') game.sfx('rustle', { volume: 1.0 });
      if (!again) {
        kyoTask('bamboo-dash');
        if (typeof game.toast === 'function') game.toast('the grove will recover. probably.');
      }
    }
  } else {
    if (kyoBambooIn && game.recordEnd) game.recordEnd('bamboo-dash');
    kyoBambooIn = false;
    kyoBambooT = 0;
  }
}

// ---- the stepping stones ---------------------------------------------------
// THE OPPOSITE TASK TO 'golden-swim', AND THAT IS THE WHOLE JOKE. The pond has
// asked the player to get into it since the chapter was written; the six granite
// stones out to the pavilion island have been there just as long, described in
// their own comment as "the only dry way aboard", and nothing has ever asked
// anybody to use them.
//
// They are a hop apart on purpose, so this is a real if small skill test, and
// the failure state is not a failure at all — you get wet, which is a thing this
// chapter already pays you for.
const kyoDRY_STONES = 6;
let kyoDryArmed = false, kyoDryDone = false;
// THE STONES HAD NO READER OUTSIDE THIS BLOCK. `dry-crossing` appeared in the
// whole repo three times: the task row, its hint, and a comment — no NPC line,
// no record, no camera, nothing. Six good stones and a rising six-note scale,
// and the world did not notice you had done it. It is the `vanRiding()` shape.
//
// So the reader is the HERON, which stands in that pond, is the boldest animal
// in the game, and has published `heronStanding()` since it was written under a
// comment saying nothing in the module needed to know. While a dry attempt is
// alive the bird HOLDS however close you come; the splash flushes it. Nothing
// new is drawn and no button is added.
let kyoDrySpook = 0;
// Which stones this attempt has touched — cleared with the arming, so a fall
// in and a fresh start re-plays the scale rather than going silent.
const kyoDryHit = new Uint8Array(kyoDRY_STONES);

/** Is a dry crossing alive right now? Read by the heron, and published. */
/**
 * Is a dry crossing live right now — which is what makes the heron hold its
 * ground (see the `near` test in the heron block). The `&& !kyoDryDone` this
 * used to carry was the other half of the v53 finding above: it took the bird
 * back to flushing at ten metres the moment the task was ticked, so the one
 * animal in the garden that can decide to stay stopped being able to. Being
 * ARMED is the honest question, and it is false whenever nobody is on a stone.
 */
function kyoDryCrossing() { return kyoDryArmed; }

function kyoStoneAt(i, out) {
  out.x = kyoPAVILION.x - 9 - i * 2.6;
  out.z = kyoPAVILION.z - 8 + Math.sin(i * 1.3) * 1.6;
  return out;
}
const kyoDryPt = { x: 0, z: 0 };

/**
 * ---- AND THE THIRD ONE IN THIS CHAPTER (v53) ------------------------------
 * `if (kyoDryDone) return` at the top of this function is the same line that
 * made the torii tunnel and the bamboo grove inert, and here it switched off
 * more than either: the six rising water-notes, the arming, AND the heron —
 * which holds its ground however close you get only while an attempt is alive
 * (see kyoDryCrossing). Tick the crossing once and the best-behaved animal in
 * the garden went back to flushing at ten metres like any other bird, and six
 * stepping stones a hop apart stopped being a skill test.
 *
 * The task keeps its latch. The crossing re-arms on the island, so walking
 * back round to the bank and doing it again works exactly as the first time.
 */
function kyoCheckDry(game) {
  const capy = game.capy;
  if (!capy || !capy.position) return;
  const p = capy.position;

  // WET DISARMS IT, and wet is read off capy.wet rather than off the height:
  // the stones stand 30 cm proud of the water and a capybara that clips the
  // edge of one is briefly lower than its own top without having got in.
  if ((capy.wet || 0) > 0.35) {
    // ...AND THE HERON GOES UP, which is the whole reason the crossing is worth
    // doing dry. See kyoDryCrossing() below: while the attempt is alive the
    // bird holds its ground however close you get, and the splash is what ends
    // that. The alarm bark is the loudest thing in the garden and now it means
    // something. Only on the frame the run breaks, never every frame after.
    if (kyoDryArmed) { kyoDryHit.fill(0); kyoDrySpook = 1; }
    kyoDryArmed = false;
    return;
  }

  // ---- EVERY STONE ANSWERS ---------------------------------------------
  // Six stones a hop apart, and the ONLY thing that ever happened was the
  // payout on the island — so the whole of the crossing, which is the actual
  // skill test, was silent. A water-drop note per stone, rising, and each one
  // counted once: you can hear how many you have left, which is the entire
  // difference between a sequence and six identical jumps.
  for (let i = 0; i < kyoDRY_STONES; i++) {
    kyoStoneAt(i, kyoDryPt);
    const dx = p.x - kyoDryPt.x, dz = p.z - kyoDryPt.z;
    if (dx * dx + dz * dz > 1.5 * 1.5 || p.y <= kyoWATER_Y + 0.45) continue;
    if (!kyoDryArmed) kyoDryArmed = true;
    if (!kyoDryHit[i]) {
      kyoDryHit[i] = 1;
      if (typeof game.sfx === 'function') {
        game.sfx('pop', { volume: 0.30, pitch: 1.30 + i * 0.14,
                          at: { x: kyoDryPt.x, y: kyoWATER_Y + 0.4, z: kyoDryPt.z } });
      }
    }
    break;
  }
  if (!kyoDryArmed) return;
  // and it pays out on the ISLAND, not on the last stone — the point of the
  // stones is that they go somewhere
  const dx = p.x - kyoPAVILION.x, dz = p.z - kyoPAVILION.z;
  if (dx * dx + dz * dz < 9 * 9) {
    const again = kyoDryDone;
    kyoDryDone = true;
    // Re-armed on the island: the stones go quiet until you are back on one,
    // and every one of the six answers again on the way over.
    kyoDryArmed = false;
    kyoDryHit.fill(0);
    if (typeof game.sfx === 'function') {
      game.sfx('chime', { volume: again ? 0.42 : 0.55, pitch: 1.45 });
    }
    if (!again) {
      kyoTask('dry-crossing');
      if (typeof game.toast === 'function') game.toast('not one drop. the koi are disappointed.');
    }
  }
}

function kyoCheckMatcha(game, dt) {
  const capy = game.capy;
  if (!kyoMatchaDone) {
    if (!capy || !kyoMatchaHeap) return;
    const dx = capy.position.x - kyoMatchaHeap.position.x;
    const dz = capy.position.z - kyoMatchaHeap.position.z;
    const dy = capy.position.y - kyoMatchaHeap.position.y;
    if (dx * dx + dz * dz > 3.1 * 3.1 || dy < -2.5 || dy > 3) return;
    kyoMatchaDone = true;
    kyoMatchaT = 0;
    kyoMatchaHeap.visible = false;
    kyoTask('matcha-raid');
    if (typeof game.sfx === 'function') { game.sfx('hiss', { volume: 0.9 }); game.sfx('pop'); }
    // M4: the matcha heap going over.
    if (typeof game.punch === 'function') game.punch(0.3);
    else if (typeof game.shake === 'function') game.shake(0.3);
    if (typeof game.toast === 'function') game.toast('you are now, structurally, a matcha capybara');
    return;
  }
  if (!kyoMatchaCloud || kyoMatchaT > 4) return;
  kyoMatchaT += dt;
  const hx = kyoMatchaHeap.position.x, hy = kyoMatchaHeap.position.y, hz = kyoMatchaHeap.position.z;
  for (let i = 0; i < 20; i++) {
    const a = i / 20 * Math.PI * 2 + i * 0.7;
    const r = 1.0 + kyoMatchaT * (2.2 + (i % 3) * 0.7);
    const s = clamp((1 - kyoMatchaT / 4), 0, 1) * (1.4 + (i % 4) * 0.5);
    kyoMatchaCloud.setMatrixAt(i, kyoXform(hx + Math.cos(a) * r,
                                           hy + 0.4 + kyoMatchaT * 1.1 + Math.sin(i) * 0.6,
                                           hz + Math.sin(a) * r, 0, 0, 0, s, s, s));
  }
  kyoMatchaCloud.instanceMatrix.needsUpdate = true;
  kyoMatchaCloud.material.opacity = clamp(0.6 * (1 - kyoMatchaT / 4), 0, 0.6);
}

// ==================================================================== API ====
function kyoIsOverWater(x, z) {
  // the mirror pond, minus the pavilion island and the stepping stones
  const px = (x - kyoPOND.x) / kyoPOND.rx, pz = (z - kyoPOND.z) / kyoPOND.rz;
  if (px * px + pz * pz < 1) {
    if (Math.abs(x - kyoPAVILION.x) < 8 && Math.abs(z - kyoPAVILION.z) < 7) return false;
    return true;
  }
  // the Uji, wherever it has wandered to
  if (kyoInRiverAt(x, z)) {
    if (Math.abs(x - kyoBRIDGE_X) < 4.2 && Math.abs(z - kyoRIVER_Z) < kyoRIVER_HZ + 8) return false;
    return true;
  }
  return false;
}

function kyoInZone(name, x, z) {
  if (name === 'torii') {
    const dx = x - kyoHILL_X, dz = z - kyoHILL_Z;
    return dx * dx + dz * dz < kyoHILL_R * kyoHILL_R;
  }
  if (name === 'zen') return Math.abs(x - kyoZEN.x) < kyoZEN.hx && Math.abs(z - kyoZEN.z) < kyoZEN.hz;
  if (name === 'gion') return Math.abs(z - kyoGION_Z) < 12;
  if (name === 'bamboo') {
    return Math.abs(x - kyoBAMBOO.x) < kyoBAMBOO.hx && Math.abs(z - kyoBAMBOO.z) < kyoBAMBOO.hz;
  }
  if (name === 'uji') return Math.abs(x - kyoUJI.x) < 44 && Math.abs(z - kyoUJI.z) < 40;
  return false;
}

/**
 * THE SAME SURFACE THAT IS DRAWN, and it was not.
 *
 * kyoRipple writes the meshes as `y + sin(x*0.22 + t*sp)*amp + sin(z*0.31 -
 * t*sp*0.8)*amp*0.7`, with (amp, sp) of (0.055, 0.9) for the pond and (0.075,
 * 1.5) for the river. This answered a THIRD surface — amplitude 0.07/0.05 at
 * speed 1.1/0.9 — for both of them. Everything that floats reads this: a leaf
 * on the pond sat up to four centimetres off the water it was supposed to be
 * on, and did it at a beat the water was not keeping. Quay's harbour has had
 * one function for both since it was written; this is the same rule.
 */
function kyoWaterHeightAt(x, z) {
  const river = kyoInRiverAt(x, z);
  const y = river ? kyoRIVER_Y : kyoWATER_Y;
  const amp = river ? 0.075 : 0.055;
  const sp = river ? 1.5 : 0.9;
  return y + Math.sin(x * 0.22 + kyoTime * sp) * amp
           + Math.sin(z * 0.31 - kyoTime * sp * 0.8) * amp * 0.7;
}

// =============================================================== LIFECYCLE ===
export function createKyoto(game) {
  kyoGame = game;

  // THE WINDOW (L6, F2): the one wheek listener this garden has. THE GATE —
  // on the global 'capy:wheek' and never removed, so it answers only while
  // Kyoto is the live biome (see hanWheek's note on the shared coordinate
  // space). It remembers the press for a third of a second; kyoUpdateHeron
  // reads it against the lift.
  if (game.events && typeof game.events.on === 'function') {
    game.events.on('capy:wheek', function () {
      if (!game.biome || !game.biome.isActive('kyoto')) return;
      kyoWheekT = 0.35;
    });
  }

  game.biome.register('kyoto', {
    ensureBuilt() { kyoBuild(game); },
    // A run in progress is state that can hold the player — the camera rig and
    // the clock both hang off it — so it is cleared on the way in and on the way
    // out, per the shared-coordinate-space rule.
    onEnter() {
      kyoRunT = -1; kyoInRiver = false; kyoRunFlow = 0; kyoRunOutT = 0;
      // THE HEAP COMES BACK. kyoMatchaDone hides the pile beside the mill and
      // is set once for the life of the page, so the second time you came to
      // Kyoto — which the departures board lets you do — there was a mill
      // grinding tea with no tea beside it and the chapter's loudest mini could
      // not happen again. Quay's chip basket had exactly this and for exactly
      // as long. The CHECKLIST stays ticked; the pile is a thing in the world.
      kyoMatchaDone = false;
      kyoMatchaT = 0;
      if (kyoMatchaHeap) kyoMatchaHeap.visible = true;
      if (kyoMatchaCloud) {
        for (let i = 0; i < 20; i++) {
          kyoMatchaCloud.setMatrixAt(i, kyoXform(0, -900, 0, 0, 0, 0, 0.001, 0.001, 0.001));
        }
        kyoMatchaCloud.instanceMatrix.needsUpdate = true;
      }
      // ---- THE GARDEN IS PUT BACK, AND THAT IS THE JOKE -----------------
      //
      // Two more of the done-flag-gates-the-TASK-not-the-THING family, which
      // this chapter has already had once (the matcha heap, above) and the game
      // has had four times. Both of these are objects in the world that the
      // player wrecked, and both were left wrecked for the life of the page:
      //
      //  - the nine stone lanterns stayed on their sides, with their colliders
      //    reshaped to the fallen box, so a second visit found a garden that had
      //    already been vandalised and a task whose OBJECT was spent;
      //  - the twenty-six paw prints stayed in the gravel and kyoTrackN was at
      //    its ceiling, so the rock garden could never be walked through again.
      //
      // And putting them back is better than merely correct, because the man
      // standing beside the garden says 'I raked that this morning. I will rake
      // it again.' — so coming back to a raked garden and a lantern somebody has
      // stood up is the chapter answering a line it has been saying all along.
      if (kyoLanternMesh && kyoLanternState) {
        const ln = kyoLANTERNS.length / 3;
        for (let i = 0; i < ln; i++) {
          if (!kyoLanternState[i * 4]) continue;
          kyoLanternState[i * 4] = 0; kyoLanternState[i * 4 + 1] = 0;
          const lx = kyoLANTERNS[i * 3], lz = kyoLANTERNS[i * 3 + 1];
          const ls = kyoLANTERNS[i * 3 + 2] / 1.9;
          kyoLanternMesh.setMatrixAt(i, kyoXform(lx, kyoTerrain(lx, lz), lz, 0,
                                                 kyoLanternState[i * 4 + 2], 0, ls, ls, ls));
          kyoLanternStand(i, lx, lz, ls);
        }
        kyoLanternMesh.instanceMatrix.needsUpdate = true;
        kyoLanternN = 0;   // the tally, and its nine lines, start again
      }
      if (kyoTrackMesh && kyoTrackN) {
        for (let i = 0; i < kyoTrackN; i++) {
          kyoTrackMesh.setMatrixAt(i, kyoXform(0, -900, 0, 0, 0, 0, 0.001, 0.001, 0.001));
        }
        kyoTrackMesh.instanceMatrix.needsUpdate = true;
        kyoTrackN = 0; kyoTrackLast = -1; kyoZenTouched = 0;
      }
      // the whisk is not left at a full froth either
      kyoWhiskFroth = 0; kyoWhiskSpin = 0;
      // the bell is not left mid-swing, and the garden is not left ringing
      kyoBellWind = -1; kyoBellRing = 0; kyoBellWave = 0; kyoBellPulse = 0; kyoKoiSpeed = 1;
      kyoBellTick = 0; kyoBellSaid = 0;
      if (kyoBellGroup) { kyoBellGroup.scale.set(1, 1, 1); kyoBellGroup.rotation.z = 0; }
      // The re-entry half of the same workaround, deleted with it in X8: the
      // datum no longer depends on where the animal is standing, so there is
      // no wrong water to arrive solving against. `kyoWaterHeightAt` answers
      // per point and capybara.js asks it on the first frame like every other.
      if (game.kyoto) game.kyoto.waterLevel = kyoWATER_Y;
    },

    onExit() {
      // ARMED FLAGS DO NOT SURVIVE TRAVEL. Every biome shares one coordinate
      // space, and a latch left set is a task that ticks in the wrong country.
      kyoDryArmed = false;
      kyoDryHit.fill(0);
      kyoRunT = -1; kyoInRiver = false; kyoRunFlow = 0;
      // ---- ...AND SO DOES THE TUNNEL (v20) ------------------------------
      // kyoToriiSeq is the index of the NEXT gate on the run and it was on
      // neither list. Leave Kyoto twenty gates up Fushimi Inari, come back, and
      // the chapter is still waiting for gate twenty-one: the paper's arrow
      // points sixty metres up the mountain, and a player who walks back into
      // the bottom of the tunnel passes twenty gates that no longer count while
      // the counter decays one every twelve seconds underneath them. The
      // sequence is a RUN, and a run you walked away from is over.
      //
      // kyoBambooIn is the same shape one task along: it holds a z from a
      // previous visit, so the first frame back inside the grove measures the
      // dash against a mark nobody set this time.
      // ...and it is unconditional since v51, because the tunnel re-arms now:
      // there is no longer a state in which leaving forty gates up is anything
      // other than a run walked away from.
      kyoToriiSeq = 0; kyoToriiT = 0; kyoToriiRunT = -1;
      kyoBambooIn = false; kyoBambooT = 0;
      kyoSwamT = 0;
    },
  });

  // The river rig, as a constant: 17 m back at 19 degrees, and the look target
  // barely above the waterline. Held in one object rather than rebuilt per
  // frame — rig() is polled every frame by systems.js.
  const kyoRigOut = { w: 0, dist: 17, pitch: 19 * Math.PI / 180, raise: 0.85, lambda: 1.4 };

  const api = {
    built() { return kyoBuilt; },
    terrainHeight: kyoTerrain,
    /**
     * THE BELL AND THE BIRDS, MEASURED. `startled` is how many cormorants are
     * inside the bell's own startle window this frame and `under` how many are
     * in the water — the two numbers that say whether the fifth thing the
     * strike note promises actually happens.
     */
    birdDebug() {
      let startled = 0, under = 0, wings = 0;
      for (let i = 0; i < kyoBirds.length; i++) {
        const b = kyoBirds[i];
        if (b.bell > 0) startled++;
        if (b.state === 2) under++;
        if (b.state === 1) wings++;
      }
      return { n: kyoBirds.length, startled, under, wings, pulse: +kyoBellPulse.toFixed(3) };
    },
    /** Ring it from a probe, so the reaction can be measured without a climb. */
    ringBell() { kyoBellWave = 1; kyoBellPulse = 1; return true; },
    // Built from the static boxes themselves — see makeSolidIndex in shared.js.
    navBlocked(x, z, r) { return kyoSolids.blocked(x, z, r, kyoTerrain); },
    slopeAt: kyoSlope,
    // capybara.js reads waterLevel / isOverWater from whichever biome is live
    waterLevel: kyoWATER_Y,
    isOverWater: kyoIsOverWater,
    waterHeightAt: kyoWaterHeightAt,
    inZone: kyoInZone,
    SPAWN: kyoSPAWN,
    toriiStart: { x: kyoTORII.length ? kyoTORII[0] : -6, z: kyoTORII.length ? kyoTORII[1] : -46 },
    /** The NEXT gate on the run — the paper's arrow points at it, so the tunnel
     *  leads you rather than being a thing you have to already know. */
    toriiNext() {
      if (kyoToriiDone || !kyoTORII.length) return null;
      const i = Math.min(kyoToriiSeq, kyoTORII_N - 1);
      return { x: kyoTORII[i * 2], z: kyoTORII[i * 2 + 1] };
    },
    toriiProgress() { return kyoToriiSeq / kyoTORII_N; },
    /** Where the eye belongs inside the torii tunnel; null anywhere else. */
    toriiCam: kyoToriiCam,

    pond: kyoPOND,
    /**
     * THE HERON, and whether it is still standing there.
     *
     * It MOVES — ask, never cache. `heronStanding()` is phase 0, which is the
     * only phase in which it is a bird in the shallows rather than a bird on
     * its way somewhere; it leaves either because you got inside
     * kyoHERON_NEAR of it or because it has been there kyoHERON_REST and has
     * had enough of standing. Published so that something can notice the
     * garden's one decision-making animal deciding: nothing in this module
     * needed to know, so nothing could ask.
     */
    heron() { kyoV3h.set(kyoHeronGroup ? kyoHeronGroup.position.x : 0,
                         kyoHeronGroup ? kyoHeronGroup.position.y : 0,
                         kyoHeronGroup ? kyoHeronGroup.position.z : 0); return kyoV3h; },
    heronStanding() { return !!kyoHeronGroup && kyoHeronPhase === 0; },
    /** THE WINDOW (L6, F2): seconds until the rest clock puts it up; -1 while it is flying. */
    heronIn() { return kyoHeronPhase === 0 ? Math.max(0, kyoHERON_REST - kyoHeronT) : -1; },
    /** True while a dry crossing of the stepping stones is alive. See kyoDrySpook. */
    dryCrossing: kyoDryCrossing,
    /** The near end of the stepping stones, for the beacon. */
    stones: { x: kyoPAVILION.x - 9 - 5 * 2.6, z: kyoPAVILION.z - 8 + Math.sin(5 * 1.3) * 1.6 },
    zen: kyoZEN,
    // the bonsho, and the rope that rings it
    bell: kyoBELL,
    bellRope: kyoBellRopeAt,
    bellRinging() { return kyoBellRing > 0; },
    underBell() { return !!(kyoGame && kyoGame.capy && kyoUnderBell(kyoGame.capy.position)); },
    bamboo: kyoBAMBOO,
    uji: kyoUJI,
    bowl: kyoBOWL,
    matchaHeap: { x: kyoUJI.x - 16 + 6.4, z: kyoUJI.z + 24 },
    lanterns: kyoLANTERNS,
    mill: kyoMILL,
    bridge: { x: kyoBRIDGE_X, z: kyoRIVER_Z },

    // ---- the Uji run -------------------------------------------------------
    /**
     * THE VELOCITY OF THE WATER at (x, z), or zero away from the river.
     *
     * capybara.js folds this into the same channel the ferry's deck and the
     * Drift's wind use — a REFERENCE FRAME, not a force. That is the whole
     * reason the run works at all: as a force it would be eaten by the swim
     * speed cap (2.6 m/s, which is what the cap is for), and as a velocity write
     * it would delete the player's steering. As a frame the animal swims at its
     * own 2.6 through water that is itself doing six, which is exactly what
     * swimming in a river is.
     */
    flow(x, z) { return kyoFlowAt(x, z); },
    /** 0 at the bank, 1 in the thread — for the HUD, and for the camera. */
    riverMid() { return kyoRunFlow; },
    inRiver() { return kyoInRiver; },
    /**
     * HOW HARD THE WATER IS CARRYING YOU, 0..1, and zero out of the river.
     *
     * Published so the chapter can be LIT. Kyoto is one of five chapters with
     * no row at all in the event grade layer, so nothing that happens here has
     * ever changed a bloom, a threshold or a vignette — including the two
     * hundred metres of river the chapter is named for. It is already computed
     * every frame for the swim; it simply had no way out of this file.
     */
    runFlow() { return kyoRunFlow > 0 ? kyoRunFlow : 0; },
    runTime() { return kyoRunT; },
    /** THE GATES AND THE FINISH, for the harness (L5). */
    runAudit() {
      const gates = (kyoGates || []).map(function (g) { return { x: +g.x.toFixed(1), z: +g.z.toFixed(1), through: g.through }; });
      let n = 0; for (let i = 0; i < gates.length; i++) if (gates[i].through) n++;
      return { t: +kyoRunT.toFixed(2), gates: gates, through: n, bonusT: +kyoGateBonusT.toFixed(2), millFast: +kyoMillFast.toFixed(2),
               mill: kyoMillWheel ? { x: +kyoMillWheel.position.x.toFixed(1), z: +kyoMillWheel.position.z.toFixed(1) } : null, len: +kyoRiverLen.toFixed(1), done: kyoRunDone };
    },
    runBest() { return kyoRunBest; },
    runLength() { return kyoRiverLen - kyoRunFromS; },
    riverLength() { return kyoRiverLen; },
    /** W1: the chute, and a point `back` metres upstream of it. Test hook. */
    chuteAt(back) {
      if (!kyoRX || kyoChuteS < 0) return null;
      const c = kyoRiverSeg(kyoChuteS);
      const u = kyoRiverSeg(clamp(kyoChuteS - (back || 25), 0, kyoRiverLen));
      return { x: c.x, z: c.z, s: kyoChuteS, ux: u.x, uz: u.z, fired: kyoChuteFired };
    },
    /**
     * A point on the centreline `ahead` metres downstream of wherever (x, z)
     * is — which is what "swim down the river" actually means when the river
     * bends. The hint arrow uses it, so the arrow points along the water rather
     * than straight at a mill on the far side of a hill.
     */
    aheadOnRiver(x, z, ahead) {
      if (!kyoRX) return null;
      const nr = kyoRiverNear(x, z);
      const seg = kyoRiverSeg(clamp(nr.s + (ahead || 16), 0, kyoRiverLen));
      kyoAheadOut.x = seg.x; kyoAheadOut.z = seg.z;
      return kyoAheadOut;
    },
    /**
     * THE CAMERA, DROPPED LOW AND PUSHED BACK, and only while the river has you.
     *
     * The standing rig is 9.5 m back at 41 degrees down, which is a portrait
     * lens: it frames an animal. Six metres a second down a bend needs a
     * landscape one — further off so the next boulder is on screen before you
     * are committed, and much flatter so that what fills the frame is the WATER
     * AHEAD rather than the water directly underneath. Blended in over about a
     * second and a half, so entering the river reads as the shot changing.
     */
    rig() {
      if (!kyoInRiver) return null;
      kyoRigOut.w = clamp(0.35 + kyoRunFlow * 0.65, 0, 1);
      return kyoRigOut;
    },

    update(dt) {
      if (kyoRickMover) kyoRickMover.step(dt);
      if (!kyoBuilt) return;
      if (!game.biome.isActive('kyoto')) return;
      kyoTime += dt;

      // ---- THE WATERLINE USED TO FOLLOW THE ANIMAL, AND NOW IT DOES NOT ----
      // This chapter has two waters 45 cm apart — the mirror pond at -0.45 and
      // the Uji at -0.90 — and capybara.js solved buoyancy and the swim
      // threshold against `waterLevel` alone, because asking waterHeightAt was
      // gated on a `localWater` flag this chapter does not set. Published as
      // the pond's for both, the animal floated 19 cm clear of the river for
      // the whole of the Uji run, which is this chapter's one marquee task.
      //
      // The workaround was this line: rewrite the published datum every frame
      // from the ANIMAL'S position. It fixed the swim and broke the datum —
      // everything else reading waterLevel (a prop's rest height on a still
      // day, the minimap) got a number that swung 45 cm because the player had
      // walked to the river. X8 removed the gate instead, so `waterLevel` is a
      // constant again and `kyoWaterHeightAt` answers per point, which is what
      // it was always for. See waterYAt in shared.js.

      kyoRipT += dt;

      if (kyoRipT >= 0.0333) {
        kyoRipT = 0;
        if (kyoPondAttr) kyoRipple(kyoPondAttr, kyoWATER_Y, 0.055, 0.9);
        if (kyoRiverAttr) kyoRipple(kyoRiverAttr, kyoRIVER_Y, 0.075, 1.5);
      }
      kyoUpdateKoi(dt);
      kyoUpdateMirror(game);
      kyoUpdatePetals(game, dt);
      kyoUpdateBamboo(dt);
      kyoUpdatePickers(dt);
      kyoUpdateLanternRow();
      kyoUpdateLanterns(game, dt);
      kyoUpdateWhisk(game, dt);
      kyoCheckTorii(game, dt);
      kyoCheckZen(game, dt);
      kyoCheckSwim(game, dt);
      kyoCheckBamboo(game, dt);
      kyoCheckMatcha(game, dt);
      kyoCheckDry(game);
      kyoUpdateBarrels(dt);
      kyoUpdateFoam(dt);
      kyoUpdateBell(game, dt);
      kyoUpdateHeron(game, dt);
      kyoUpdateBirds(game, dt);
      kyoUpdateRun(game, dt);
      if (kyoTrackDirty) { kyoTrackDirty = false; kyoTrackMesh.instanceMatrix.needsUpdate = true; }
      // THE MUSICIAN (L7, F2): the koto, at the pond.
      if (!kyoTuneMv && typeof game.sfxMover === 'function') {
        kyoTuneMv = game.sfxMover('tune', { key: 'kyoto:musician', biome: 'kyoto' });
      }
      if (kyoTuneMv && kyoLocMusician) {
        kyoTuneMv.at(kyoLocMusician.x, kyoLocMusician.y + 1.0, kyoLocMusician.z);
      }
    },
  };
  game.kyoto = api;
  return api;
}

function kyoBuild(game) {
  if (kyoBuilt) return;
  kyoBuilt = true;
  kyoInitGeos();
  kyoBuildToriiPath();
  // FIRST, because kyoTerrain cuts the channel and everything in this biome is
  // placed by asking kyoTerrain how high the ground is.
  kyoBuildRiverPath();

  kyoRoot = new THREE.Group();
  kyoRoot.name = 'kyoto';
  game.scene.add(kyoRoot);

  kyoRoot.add(kyoBuildGroundMesh());
  kyoBuildGroundBody(game);

  // THE POND IS NOT THE RIVER. Both were drawn in the Uji's pale glacial blue,
  // which is right for two hundred metres of fast shallow water over gravel and
  // wrong for a still garden pond that has had carp in it since 1397 — and it is
  // why the pavilion's reflection would not read at any strength: a bright cyan
  // sheet has nowhere left to go brighter. A deep green-blue, and the gold has
  // somewhere to land.
  const pond = kyoBuildWater(kyoPOND.x, kyoPOND.z, kyoPOND.rx, kyoPOND.rz,
                             kyoWATER_Y, PALETTE.pondWater, PALETTE.pondDeep, true);
  kyoPondAttr = pond.geometry.attributes.position;
  // ---- THE POND TAKES THE COLOUR OF WHAT IS STANDING IN IT --------------
  //
  // Kinkaku-ji is famous for its reflection and the pond under it was a flat
  // sheet. FOUR attempts at the house smear — Venice's camera-facing additive
  // strip — were all wrong here, and for one reason: her reflectors are lamps
  // fifty metres off, and this is a nine-metre gold building twenty metres away
  // filling a quarter of the frame. Every cut of it read as a pane of frosted
  // glass lying on the water with the plate seams showing, and each time the
  // tell was the same one this project keeps meeting — the new thing had become
  // the most prominent object in the shot.
  //
  // What a still pond under a gold building actually looks like from forty-one
  // degrees up is not a strip pointing at you. It is a WARM PATCH, it is the
  // same warm patch from every side, and it does not move. So it is baked into
  // the water's own vertex colours: no seams, no camera term, no draw call, and
  // it is right from all four approaches instead of from one.
  {
    const pp = pond.geometry.attributes.position.array;
    const pc = pond.geometry.attributes.color;
    const gcol = new THREE.Color(PALETTE.gold), tcol = new THREE.Color();
    for (let i = 0; i < pc.count; i++) {
      const d = Math.hypot(pp[i * 3] - kyoPAVILION.x, pp[i * 3 + 2] - kyoPAVILION.z);
      const k = clamp(1 - (d - 8.0) / 15, 0, 1);
      if (k <= 0) continue;
      tcol.setRGB(pc.getX(i), pc.getY(i), pc.getZ(i)).lerp(gcol, k * k * 0.42);
      pc.setXYZ(i, tcol.r, tcol.g, tcol.b);
    }
    pc.needsUpdate = true;
  }
  kyoPondMesh = pond;
  kyoRoot.add(pond);

  kyoRoot.add(kyoBuildRiverMesh());

  kyoBuildTorii(game, kyoRoot);
  kyoBuildPavilion(game, kyoRoot);
  kyoBuildRickshaw(game, kyoRoot);
  kyoBuildHeron(kyoRoot);
  kyoBuildZen(game, kyoRoot);
  kyoBuildGion(game, kyoRoot);
  kyoBuildBell(game, kyoRoot);
  kyoBuildLanterns(game, kyoRoot);
  kyoBuildUji(game, kyoRoot);
  kyoBuildUjiStreet(game, kyoRoot);
  kyoBuildKerbs(game, kyoRoot);
  kyoBuildPickers(kyoRoot);
  kyoBuildMill(game, kyoRoot);
  kyoBuildRocks(game, kyoRoot);
  kyoBuildGates(game, kyoRoot);
  kyoBuildBarrels(kyoRoot);
  kyoBuildFoam(kyoRoot);
  kyoBuildBowl(game, kyoRoot);
  kyoBuildMaples(game, kyoRoot);
  // ...and the approach between the lane and the pond — see kyoBuildSando.
  kyoBuildSando(game, kyoRoot);
  // THE WOOD, and it goes in after the maples so its rejection list is read
  // against a hill that is otherwise finished. See kyoBuildSugi.
  kyoBuildSugi(game, kyoRoot);
  kyoBuildPondEdge(kyoRoot);
  kyoBuildKoi(kyoRoot);
  kyoBuildPetals(kyoRoot);
  // ...and the pond takes a picture of what is standing in it. Reflectors are
  // registered by hand because a reflection is anchored to a THING, not to a
  // mesh: the pavilion is three storeys of one merged geometry and its smear is
  // one object with one width.
  {
    // the stepping stones are low and pale and they are what the player is
    // looking straight down at for the whole of 'dry-crossing'
    for (let i = 0; i < 6; i++) {
      kyoMirAdd(kyoPAVILION.x - 9 - i * 2.6, kyoPAVILION.z - 8 + Math.sin(i * 1.3) * 1.6,
                1.9, 1.1, PALETTE.granite);
    }
    // and the maples round the far shore, which are the only saturated thing in
    // the chapter that is not the torii
    for (let i = 0; i < 5; i++) {
      const a = -0.5 + i * 0.55;
      kyoMirAdd(kyoPOND.x + Math.cos(a) * (kyoPOND.rx - 3.5),
                kyoPOND.z + Math.sin(a) * (kyoPOND.rz - 3.0), 5.0, 7.0, PALETTE.momiji);
    }
  }
  kyoBuildMirror(kyoRoot);

  // bamboo last, because kyoUpdateBamboo needs the placement list kept alive
  const stems = [];
  kyoBambooPhase = new Float32Array(kyoBAMBOO_N);
  for (let i = 0; i < kyoBAMBOO_N; i++) {
    const x = kyoBAMBOO.x + rand(-kyoBAMBOO.hx, kyoBAMBOO.hx);
    const z = kyoBAMBOO.z + rand(-kyoBAMBOO.hz, kyoBAMBOO.hz);
    const y = kyoTerrain(x, z);
    const h = rand(11, 19);
    kyoBambooPhase[i] = rand(0, Math.PI * 2);
    kyoPush9(stems, x, y + h * 0.5, z, 0, rand(0, 3), 0, 0.26, h, 0.26);
  }
  kyoBambooList = stems;
  kyoBambooMesh = kyoInstance(kyoRoot, kyoG.cyl6, PALETTE.bambooStem, stems, true, false);
  // A GROVE THAT DOES NOT MOVE IS A COLONNADE. Stiff, because a bamboo culm
  // is stiff — it is the TOP eight metres that travel and the base does not —
  // and that is exactly what the ramp exponent is for.
  swayMesh(kyoBambooMesh, { leaf: 0.55, amount: 0.20, axis: 'y', auto: true, stiff: 3.0, hz: 0.62 });
  const leaves = [];
  for (let i = 0; i < kyoBAMBOO_N; i++) {
    const o = i * 9;
    for (let k = 0; k < 2; k++) {
      kyoPush9(leaves, stems[o], stems[o + 1] + stems[o + 7] * (0.22 + k * 0.16), stems[o + 2],
               rand(-0.4, 0.4), rand(0, 3), rand(-0.4, 0.4), 2.2, 1.4, 2.2);
    }
  }
  swayMesh(kyoInstance(kyoRoot, kyoG.cone6, PALETTE.bambooLeaf, leaves, false, false),
           { leaf: 0.55, amount: 0.26, axis: 'y', auto: true, stiff: 1.2, hz: 0.78 });

  // ---- THE PEOPLE WHO LIVE HERE ------------------------------------------
  // See npc.js, THE LOCALS. Each of these is a point somebody is standing at,
  // a few things they might say when the capybara turns up, and a different
  // few for when it wheeks at them. Where the chapter owns a Group for the
  // figure, it is handed over too and the figure turns to watch.
  if (typeof game.addLocal === 'function') {
    // ---- AND THEY KNOW WHAT YOU HAVE DONE (v20) -------------------------
    // Every person in this chapter said the same three sentences whether you
    // had just arrived or had spent ten minutes wrecking the thing they are
    // standing next to. See localResolve in npc.js: an entry may now carry
    // `before` or `after` a task id, so a pool grows and shrinks as the
    // chapter happens, and `onTask` is what they say at the moment you do it.
    //
    // The rake monk is the clearest case in the game. He has been saying 'I
    // raked that this morning. I will rake it again.' at a garden with
    // twenty-six paw prints in it since the chapter shipped.
    kyoLocRake = game.addLocal({ biome: 'kyoto', x: kyoZEN.x + 8, y: kyoTerrain(kyoZEN.x + 8, kyoZEN.z),
      z: kyoZEN.z, near: 6,
      // THE AUTHORITY (L3, F1): the monk is the one who carries you out of
      // the garden. See npc.js.
      authority: true, role: 'the monk',
      figure: { shirt: PALETTE.hair2, legs: PALETTE.hair2 },
      lines: [
              // ---- THEY HAVE HEARD ABOUT YOU (L3, E3): one line keyed on a wow elsewhere
              { t: 'A condor, they said. We have herons. Please do not.', after: 'condor-ride' },
              // ...and what it is wearing (L3-11)
              { t: 'A hat. In here.', when: function () { return game.capy && !!game.capy.worn; } },
              { t: 'Fifteen stones. You can never see all fifteen at once.', before: 'zen-ruin' },
              { t: 'I raked that this morning. I will rake it again.', before: 'zen-ruin' },
              { t: 'Please. Look with the eyes.', before: 'zen-ruin' },
              { t: 'The gravel is not a path. It has never once been a path.', before: 'zen-ruin' },
              { t: 'I will rake it again. I said I would.', after: 'zen-ruin' },
              { t: 'Fourteen stones, now. You are standing on the fifteenth.', after: 'zen-ruin' },
              { t: 'Six hundred years, and you are the first to run in it. Diagonally.', after: 'zen-ruin' },
              { t: 'No, do not help.', after: 'zen-ruin' }],
      wheek: [{ t: '…that is one interpretation of the garden.', before: 'zen-ruin' },
              { t: 'Yes. I heard the first one too.', after: 'zen-ruin' }],
      onTask: { 'zen-ruin': ['…a bold reinterpretation. Yes.',
                             'Right. Well. That is one morning gone.',
                             'You have signed it. With feet.'],
                // The stones' one human reader. Six stones and a rising scale,
                // and until now not one person in the chapter noticed.
                'dry-crossing': ['Six stones. Not one drop. The heron stayed.',
                                 'I watched the whole thing. So did the bird.'],
                'lantern-topple': ['That was not the garden. That was eight hundred years.',
                                   'I heard it. The whole valley heard it.'] } });
    // THE MUSICIAN (L7, F2): the west bank of the mirror pond, clear of the
    // bridge and the rake monk both — floor-sitting, which is the only way
    // a koto is played.
    kyoLocMusician = game.addLocal({ biome: 'kyoto', x: kyoPOND.x - 18,
      y: kyoTerrain(kyoPOND.x - 18, kyoPOND.z + kyoPOND.rz - 6),
      z: kyoPOND.z + kyoPOND.rz - 6, near: 8, face: 2.2,
      beat: { kind: 'work', every: 4.2, dur: 1.1, sfx: 'strum', volume: 0.11, pitch: 0.85 } });
    // OUTSIDE THE BOWL. kyoBOWL.x + 3 is three metres from the centre of a bowl
    // whose rim is at 5.4, so the tea master has been standing IN the tea, in
    // the middle of the only piece of ground the whisk task asks you to run
    // round. Eight and a half metres out puts him at the rim, where the person
    // who owns a four-metre chasen would actually be.
    game.addLocal({ biome: 'kyoto', x: kyoBOWL.x + 8.5,
      y: kyoTerrain(kyoBOWL.x + 8.5, kyoBOWL.z + 1.5),
      z: kyoBOWL.z + 1.5, near: 7, face: -1.5,
      figure: { shirt: PALETTE.cloth6, legs: PALETTE.cloth6 },
      lines: [{ t: 'Whisk in a W. Never a circle. A circle makes nothing.', before: 'whisk-spin' },
              'Four hundred grams of matcha in that bowl.',
              { t: 'Do not fall in. Somebody always falls in.', before: 'whisk-spin' },
              { t: 'A circle. You did the whole thing in a circle.', after: 'whisk-spin' },
              { t: 'It is the finest bowl of usucha I have seen. I am not pleased about it.', after: 'whisk-spin' },
              // and one that is only true while you are dripping on his tea
              { t: 'You are wet. The bowl is over there and you are wet.',
                when: function () { return !!(kyoGame && kyoGame.capy && (kyoGame.capy.wet || 0) > 0.4); } }],
      wheek: ['The bowl carries it. Listen.'],
      onTask: { 'whisk-spin': ['Thirty years. Thirty years, and a rodent.',
                               'Do not tell anybody how that was done.'],
                'matcha-raid': ['That was nine thousand yen a bowl.',
                                'It is IN you. It is not coming out.'] } });
    game.addLocal({ biome: 'kyoto', x: kyoMILL_STAND.x, y: kyoMILL_STAND.y,
      z: kyoMILL_STAND.z, near: 7,
      figure: { shirt: PALETTE.denim, hat: PALETTE.khaki },
      lines: ['The wheel has turned since before the war. Either war.',
              { t: 'River is quick today. Do not get in above the weir.', before: 'uji-run' },
              { t: 'Nobody comes down that. Not since the wheel went in.', before: 'uji-run' },
              { t: 'You came down the Uji? On purpose?', after: 'uji-run' },
              { t: 'Two hundred metres, no paddle, and you are not even out of breath.', after: 'uji-run' },
              // ...and one he only says while the river actually has you
              { t: 'Left! Go LEFT! …no. All right. That works too.',
                when: function () { return !!(kyoGame && kyoGame.kyoto && kyoGame.kyoto.inRiver()); } }],
      wheek: ['The wheel is louder. Only just.'],
      onTask: { 'uji-run': ['Forty seconds. The river does it in forty seconds.',
                            'I have watched that water for sixty years. That is new.'] } });
    // ---- GION HAD EIGHTEEN HOUSES AND NOBODY IN THEM --------------------
    // Three locals for a valley: a rake in a garden, a whisk by a bowl, a
    // wheel at a mill — and all three of them stand at a TASK. The lane the
    // chapter is proudest of, the bridge its set piece starts from and the
    // grove it asks you to run through had no one at all, so the quiet
    // chapter's quiet was the quiet of an empty film set rather than of a
    // place where people are being quiet on purpose.
    // + 0.13 is the top of the granite setts over kyoTerrain; the lane is only
    // 9 m wide, so ±3.8 keeps both of them ON it rather than in the gutter.
    kyoLocLate = game.addLocal({ biome: 'kyoto', x: -6.5, y: kyoTerrain(-6.5, kyoGION_Z + 3.8) + 0.13,
      z: kyoGION_Z + 3.8, near: 6, face: -1.4,
      figure: { shirt: PALETTE.indigo, legs: PALETTE.indigo, hat: PALETTE.shoji },
      // THE ERRAND (L3-8): a box of dango ten metres down the lane to the next door, late
      errand: { to: [-10.0, -0.6], carry: 'dango', every: 46 },
      lines: ['I am late. I have been late since 1846.',
              'Walk on the stones, not the gutter. The gutter is the gutter.',
              'Do not photograph me. …you have no camera. Good.',
              { t: 'You have been up the mountain. There is a needle in your fur.', after: 'torii-run' },
              { t: 'You smell of the river. Which river. Never mind.', after: 'uji-run' },
              { t: 'Blossom. Every year. It gets in everything.',
                when: function () { return !!(kyoGame && kyoGame.weather && kyoGame.weather.mood
                                              && kyoGame.weather.mood().motes); } }],
      wheek: ['Every dog in Gion. Thank you.'],
      praise: ['Yes. Very good. I am still late.', 'Mm. Congratulations. Move.'] });
    kyoLocSweep = game.addLocal({ biome: 'kyoto', x: -2.0, y: kyoTerrain(-2.0, kyoGION_Z - 3.8) + 0.13,
      z: kyoGION_Z - 3.8, near: 6, face: 1.6,
      // D2: he sweeps a step and the lane is a hundred and eight metres of
      // granite setts. The only moving body in the arrival frame of a chapter
      // whose first view has none.
      walk: { dx: 8.5, dz: 0, dwell: 5 },
      figure: { shirt: PALETTE.templeWood, legs: PALETTE.stoneDark },
      // sixty years of the same broom
      beat: { kind: 'work', every: 3.4, dur: 0.95, sfx: 'rustle', volume: 0.10, pitch: 0.85, tool: 'basket' },  // B12: sixty years of the same broom, and the basket it goes into
      lines: ['Sixty years my family has swept this step. It is a good step.',
              'The lanterns go up at four. They have gone up at four since my grandfather.',
              { t: 'You are wet. Everything you have touched is now also wet.',
                when: function () { return !!(kyoGame && kyoGame.capy && (kyoGame.capy.wet || 0) > 0.4); } },
              { t: 'Sweeping. Still sweeping. It is the job.',
                when: function () { return !!(kyoGame && kyoGame.capy && (kyoGame.capy.wet || 0) <= 0.4); } },
              { t: 'They say the bell went. I did not hear the bell. I hear everything.', after: 'the-bell' }],
      wheek: ['The lanterns did not even swing. Impressive.'],
      praise: ['On my step. Of course on my step.', 'I saw. I sweep, but I also see.'] });
    // ON THE BRIDGE, at the shrine bay — which is the exact spot the Uji run
    // starts from. The deck's collider tops out at the hump's y + 0.02, and the
    // hump at mid-span is 3.0, so 3.02. Not the drawn 3.175: stand a figure on
    // the picture and it floats over the floor it is actually resting on.
    // The WEST side of the deck. The east side is under the shrine bay's roof,
    // and a figure under a roof at forty-one degrees down is a figure nobody
    // will ever see.
    game.addLocal({ biome: 'kyoto', x: kyoBRIDGE_X - 3.0, y: 3.16,
      z: kyoRIVER_Z + 2.5, near: 6, face: 1.6,
      figure: { shirt: PALETTE.matchaField, hat: PALETTE.templeWood },
      lines: ['The water for the tea comes from under this bridge. It always has.',
              { t: 'Nobody swims the Uji. Nobody sensible swims the Uji.', before: 'uji-run' },
              'Two hundred metres to the mill. It takes the river about forty seconds.',
              { t: 'You are not sensible. I have revised my position.', after: 'uji-run' },
              { t: 'Go on, then. It is right there. It is going the right way.',
                when: function () { return !!(kyoGame && kyoGame.capy && (kyoGame.capy.wet || 0) > 0.4); } }],
      wheek: ['…the cormorants heard that. They are not impressed.'],
      onTask: { 'uji-run': ['From this bridge to that mill. I have never seen it done.'] } });
    // ---- THE TRAVELLER, A SEVENTEENTH CAMEO (L8, F2) -----------------------
    // Same bridge, same proven deck height (y=3.16) as the tea local three
    // lines up — this IS `sysMAP_WORLDS.kyoto.way` (x:4, z:128, 'the bridge
    // at Uji'). The opposite rail, facing back across it. Hidden until
    // Kyoto's own first real tick (gateChap).
    if (typeof game.addTraveller === 'function') {
      // LIFT9, S2: the deck here is only ~8.4 m wide in x (kyoIsOverWater's
      // own bridge box: |x - kyoBRIDGE_X| < 4.2, i.e. x in [-0.2, 8.2]) and
      // this cameo already stands at x=7, 1.2 m from that edge, BECAUSE they
      // face across the narrow width ("the opposite rail, facing back across
      // it"). The stall's default offset (1.6 m straight behind, along
      // `face`) would walk it to x≈8.6 — off the deck, over the river.
      // `shopAngle` cancels `face` so the effective offset direction is 0
      // rad: the stall moves along Z instead (the deck's long, 46 m-wide
      // axis: |z - kyoRIVER_Z| < kyoRIVER_HZ + 8 = 23), where 1.6 m is
      // nothing. Checked against kyoIsOverWater at both ends of the stall's
      // own footprint, not just its centre — see qa/l9-shop.js.
      game.addTraveller({ biome: 'kyoto', x: kyoBRIDGE_X + 3.0, y: 3.16,
        z: kyoRIVER_Z + 2.5, face: -1.6, shopAngle: 1.6,
        gateChap: 4,
        lines: ['The bridge at Uji. I have crossed a lot of bridges. This might be the one.',
                'Somebody told me the river used to flood this whole valley. I believe them.'],
        wheek: ['That splash was you. It is always you.'] });
    }
    game.addLocal({ biome: 'kyoto', x: kyoBAMBOO.x + kyoBAMBOO.hx + 3.4,
      y: kyoTerrain(kyoBAMBOO.x + kyoBAMBOO.hx + 3.4, kyoBAMBOO.z + 8),
      z: kyoBAMBOO.z + 8, near: 6, face: -1.5,
      figure: { shirt: PALETTE.bambooPale, legs: PALETTE.khaki, hat: PALETTE.khaki },
      lines: ['Cut in winter, dried a year, and then it is a fence.',
              'Listen. That knocking is the grove talking to itself.',
              { t: 'Go on through. It is quieter in there than it is out here.', before: 'bamboo-dash' },
              { t: 'You went through it at a run. It is not that kind of quiet.', after: 'bamboo-dash' },
              { t: 'Four culms down. I am not counting. I am counting.', after: 'bamboo-dash' }],
      wheek: ['Two thousand culms just said it back to you.'],
      onTask: { 'bamboo-dash': ['End to end. At a sprint. Through a grove.',
                                'The grove will recover. I said that about the last one.'] } });
    // ---- AND FIVE MORE, BECAUSE THE THREE PLACES THE CHAPTER IS PROUDEST OF
    // HAD NOBODY IN THEM -------------------------------------------------
    // The seven above stand at the pond, the bowl, the mill, the lane, the
    // bridge and the grove. What that left empty was: the top of forty-four
    // gates (the chapter's second-biggest moment, and you arrive at an empty
    // shrine); the bell tower, which is the mini; the tea town, which is where
    // the chapter ENDS; and seventy metres of terrace with twenty-two people
    // working on it and not one of them able to say anything.
    //
    // THE SUMMIT. Standing at the shrine, above the last gate, facing back down
    // the tunnel — so the payoff for the run is a person who saw you do it.
    // kyoTerrain, not a constant: the shrine sits on a 34 m dome.
    {
      const sx = kyoHILL_X + 5.2, sz = kyoHILL_Z + 22.5;
      game.addLocal({ biome: 'kyoto', x: sx, y: kyoTerrain(sx, sz), z: sz, near: 8, face: 0.2,
        figure: { shirt: PALETTE.shoji, legs: PALETTE.torii, hat: PALETTE.shoji },
        lines: [{ t: 'Most of them stop at the fork. You will stop at the fork.', before: 'torii-run' },
                { t: 'You came all the way up. Most of them stop at the fork.', after: 'torii-run' },
                'Every gate down there was paid for by somebody. Look at the backs.',
                'Inari is rice, and rice is money, and money buys gates. That is the whole story.',
                { t: 'Down is faster. Down is always faster. That is how people get hurt.', after: 'torii-run' }],
        wheek: ['The foxes have heard worse. Not much worse.'],
        onTask: { 'torii-run': ['Forty-four. In one go. Without stopping.',
                                'The foxes saw. The foxes tell each other things.'] } });
    }
    // THE BELL. Somebody has to be responsible for the loudest object in Japan,
    // and the mini is much funnier if there is a man standing next to the rope
    // being extremely reasonable about it.
    game.addLocal({ biome: 'kyoto', x: kyoBELL.x + 3.4,
      y: kyoTerrain(kyoBELL.x + 3.4, kyoBELL.z + kyoBELL_R + kyoBELL_ROPE_D - 1.2),
      z: kyoBELL.z + kyoBELL_R + kyoBELL_ROPE_D - 1.2, near: 7, face: -1.4,
      figure: { shirt: PALETTE.templeWoodDk, legs: PALETTE.templeWoodDk },
      lines: [{ t: 'One hundred and eight times, at the new year. I count.', before: 'the-bell' },
              { t: 'Pull it if you like. Everybody does. Nobody stands under it.', before: 'the-bell' },
              { t: 'Four seconds from the pull. You would be amazed what people do with four seconds.', before: 'the-bell' },
              { t: 'Nobody stands under it. I have said that for thirty years and it was true for twenty-nine.', after: 'the-bell' },
              { t: 'Can you hear me? …no. No, you cannot.', after: 'the-bell' },
              { t: 'One hundred and nine, then.', after: 'the-bell' },
              // and while it is actually going
              { t: 'Wait. Wait. …there. That is the note.',
                when: function () { return !!(kyoGame && kyoGame.kyoto && kyoGame.kyoto.bellRinging()); } }],
      wheek: ['That is not the note. That is nowhere near the note.'],
      onTask: { 'the-bell': ['You were UNDER it. You were under the bell.',
                             'Nine seconds. You were in there for the whole nine seconds.'] } });
    // THE TEA TOWN. Twelve shops all selling the same thing, and the chapter
    // ends here — see kyoBuildUjiStreet.
    kyoLocTea = game.addLocal({ biome: 'kyoto', x: kyoUJI.x - 12.6,
      y: kyoTerrain(kyoUJI.x - 12.6, kyoUJI.z - 4.6) + 0.13,
      z: kyoUJI.z - 4.6, near: 6, face: 0,
      figure: { shirt: PALETTE.matchaField, legs: PALETTE.indigo },
      // THE ERRAND (L3-8): a pot of sencha across the street to the doorway by the lantern opposite
      errand: { to: [-8.4, 8.2], carry: 'mug', every: 40 },
      lines: ['Twelve shops. All tea. Yes, all of it. No, they are not the same.',
              'First flush is April. What you are looking at is the second.',
              { t: 'You are dripping on the gyokuro. That is nine thousand yen an ounce.',
                when: function () { return !!(kyoGame && kyoGame.capy && (kyoGame.capy.wet || 0) > 0.4); } },
              { t: 'You are GREEN. You are a green animal. That is our matcha.', after: 'matcha-raid' },
              { t: 'Eleven shops now. The twelfth has nothing left to sell.', after: 'matcha-raid' }],
      wheek: ['…the whole street just went quiet. Well done.'],
      onTask: { 'matcha-raid': ['Four hundred grams. FOUR HUNDRED.',
                                'I am going to have to write that down as weather.'] } });
    // ---- AND ONE MORE, ACROSS THE STREET --------------------------------
    // Twelve shops facing each other, all selling the same leaf, and exactly
    // one person in the street. A rival is both the cheapest possible way to
    // double the population of the place the chapter ENDS in and the setup for
    // the only argument in Uji — see the exchange registered below.
    kyoLocTea2 = game.addLocal({ biome: 'kyoto', x: kyoUJI.x - 8.4,
      y: kyoTerrain(kyoUJI.x - 8.4, kyoUJI.z + 4.6) + 0.13,
      z: kyoUJI.z + 4.6, near: 6, face: 3.14,
      figure: { shirt: PALETTE.templeWood, legs: PALETTE.stoneDark, hat: PALETTE.shoji },
      // the mill wheel, by hand
      beat: { kind: 'work', every: 2.7, dur: 0.8, sfx: 'tick', volume: 0.09, pitch: 0.6, tool: 'cuencobowl' },  // B12: the bowl under the mill wheel
      lines: ['Ours is stone-ground. Theirs is ground by a machine that is also stone.',
              'Do not buy from the shop with the big sign. That is all I will say.',
              'Sencha in the morning, gyokuro when somebody is watching.',
              { t: 'The bell went. It always tastes better after the bell. It does not, but it does.', after: 'the-bell' }],
      wheek: ['We heard you at the mill. We heard you at the SHRINE.'],
      onTask: { 'matcha-raid': ['They had that coming. Twelve years I have said so.'] } });
    // THE TERRACES. One of the twenty-two, at the near end of the bottom shelf,
    // and she is the only person in the chapter who is at WORK.
    {
      const tz = kyoUJI.z + 6, tx = 99.5;
      game.addLocal({ biome: 'kyoto', x: tx, y: kyoTerrain(131, tz) + 0.33, z: tz - 2.85,
        near: 8, face: -1.6,
        figure: { shirt: PALETTE.indigo, legs: PALETTE.indigo, hat: PALETTE.shoji },
        // picking, which is two hands
        beat: { kind: 'reach', every: 5.0, dur: 1.1, tool: 'basket' },  // B12: you pick INTO something
        lines: ['Two leaves and a bud. Only ever two leaves and a bud.',
                'Under the black cloth for twenty days. That is what makes it sweet.',
                'My grandmother picked this row. So did hers. It is a long row.',
                { t: 'Somebody has been in the drying shed. Somebody green.', after: 'matcha-raid' },
                { t: 'You are standing in row nine. Row nine is fine. Row eight was not.', after: 'zen-ruin' }],
        wheek: ['Four terraces of us just stood up. I hope you are pleased.'],
        praise: ['Two leaves and a bud. Whatever that was, it was not that.'] });
    }
    // THE UKAI MASTER, on the bank beside the moored boats at the first narrow.
    // The cormorants have been the chapter's gates since the run was written and
    // the birds have never had anybody working them — six leashed cormorants
    // and an empty boat is a picture of a man who has drowned.
    {
      const seg = kyoRiverSeg(kyoRunAt(0.20));
      const nx = -seg.tz, nz = seg.tx;
      const ux = seg.x + nx * (seg.w + 4.5), uz = seg.z + nz * (seg.w + 4.5);
      game.addLocal({ biome: 'kyoto', x: ux, y: kyoTerrain(ux, uz), z: uz, near: 9,
        face: Math.atan2(seg.x - ux, seg.z - uz),
        figure: { shirt: PALETTE.toriiBase, legs: PALETTE.toriiBase, hat: PALETTE.toriiBase },
        lines: ['Six birds. Each one has a name and each one knows it.',
                'The season is June. The rest of the year we sit here and mend things.',
                'A ring round the throat, not tight. They swallow the small ones. That is the deal.',
                { t: 'You went between the boats. Nobody goes between the boats.', after: 'uji-run' },
                { t: 'The water is going faster than you think. It always is.', before: 'uji-run' }],
        wheek: ['Do not do that near the birds. …too late.'],
        onTask: { 'uji-run': ['Kichi has not moved. Kichi does not move for anything.',
                              'All the way to the mill. On your back, most of it.'] } });
    }
    // ---- AND TWO CONVERSATIONS THAT ARE NOT WITH YOU (v20) --------------
    // See addExchange in npc.js. Every voice in this chapter — in every
    // chapter — was addressed to the capybara, so a lane with two people in it
    // was silent unless you walked up and stood between them. These run when
    // you are near enough to read both bubbles and far enough not to be the
    // subject, which means the thing you catch is a conversation that was
    // already happening. That is most of what makes a street a street.
    if (typeof game.addExchange === 'function') {
      // Gion, across the lane: the one who is late, and the one who is not.
      if (kyoLocLate && kyoLocSweep) {
        game.addExchange({ biome: 'kyoto', a: kyoLocLate, b: kyoLocSweep, lines: [
          ['You have swept that step twice.', 'I have swept it four times. You are late.'],
          ['Is it four o’clock?', 'It is not four o’clock. It is never four o’clock when you ask.'],
          ['There is an animal in the lane.', 'There is always something in the lane. Sweep round it.'],
          ['Lovely evening.', 'It is the afternoon.'],
          ['I shall be back before the lanterns.', 'You will not.'],
        ] });
      }
      // Uji, across the street: two shops, one leaf, sixty years.
      if (kyoLocTea && kyoLocTea2) {
        game.addExchange({ biome: 'kyoto', a: kyoLocTea, b: kyoLocTea2, gap: 34, lines: [
          ['Your sign is over my step again.', 'My sign has been there since before your step.'],
          ['Second flush.', 'FIRST flush. …second flush.'],
          ['A customer.', 'That is a capybara.', ],
          ['Ninety yen a gram is robbery.', 'Ninety yen a gram is Uji.'],
          ['Your awning drips on my tins.', 'Your tins are under my awning.'],
        ] });
      }
    }
  }

  // ---- THE AUTHORITY, AND WHERE TO HIDE FROM THEM (L3, F1) ----------------
  // See THE HIDE in systems.js. Each of these is beside or inside a thing the
  // chapter already draws, at the expression that draws it: the middle of the
  // grove, the reed clump at the pond's east rim (kyoBuildPondEdge, i = 0),
  // under a Gion noren (kyoBuildGion, li = 0, i = 2), round the back of the
  // summit shrine (its collider is 3.0 deep), and between the first two
  // hedgerows on the bottom tea shelf, east of the picker.
  if (typeof game.addHide === 'function') {
    game.addHide({ biome: 'kyoto', x: kyoBAMBOO.x, z: kyoBAMBOO.z, r: 3.0, kind: 'the bamboo' });
    game.addHide({ biome: 'kyoto', x: kyoPOND.x + kyoPOND.rx * 0.93, z: kyoPOND.z, r: 2.2, kind: 'the reeds' });
    game.addHide({ biome: 'kyoto', x: -40 + 2 * 10, z: kyoGION_Z - 9 + 3.5 + 0.30 + 0.8, r: 1.6, kind: 'under the noren' });
    game.addHide({ biome: 'kyoto', x: kyoHILL_X + 2, z: kyoHILL_Z + 18 - 3.0 - 1.5, r: 2.0, kind: 'behind the shrine' });
    game.addHide({ biome: 'kyoto', x: 99.5 + 8, z: kyoUJI.z + 6 - 1.05, r: 2.0, kind: 'the tea hedge' });
  }

  if (typeof game.registerShadowTarget === 'function') game.registerShadowTarget(kyoRoot);
}

