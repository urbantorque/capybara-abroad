import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PALETTE, mat, rand, randInt, clamp, damp, lerp, grain, makeSolidIndex } from './shared.js';

// ===========================================================================
// CHAPTER 6 — RIO DE JANEIRO
//
// The sixth biome, and the second one built on a beat. It is deliberately not
// a second Cali.
//
// Cali's floor is a CIRCLE YOU STAND IN, and any beat of the salsa will do.
// That is right for salsa — the clave is a two-bar cycle and the dancer lives
// inside all of it. Samba is not that. Samba is in 2/4, the bateria is a
// hundred and fifty drums walking down an avenue at eleven at night, and the
// surdo — the big one, the one you feel in your chest two streets away — lands
// on the TWO. Everything else in a bateria is decoration hung off that.
//
// So Rio's centrepiece inverts both halves of Cali's:
//
//   - the scoring zone MOVES. A desfile is a column going somewhere; you do not
//     dance at it, you keep station in it. Fall behind and the combo lapses.
//   - only every OTHER beat counts. Hitting the one is not a near miss, it is
//     the wrong beat, and it breaks the run — which is the single thing that
//     makes this feel like samba rather than like generic rhythm-matching.
//
// The city those drummers are walking through:
//
//        ~~~~~~~~~~~~~~ the Atlantic ~~~~~~~~~~~~~~~~~   z < -18
//   Arpoador                                   Pao de Acucar, and the cable
//   (the rock, west)   COPACABANA              car out to it, east over water
//   -------- the calcadao, and its wave --------------   z = -4 .. 2
//                    spawn, on the pavement
//   ------------------------------------------------------------------
//                 the avenue — the desfile passes here    z = 46
//   ------------------------------------------------------------------
//     Arcos da Lapa | Escadaria Selaron | Santa Teresa up the hill   z > 70
//        Corcovado and the Redentor over the whole lot, west
//
// Everything is prefixed `rio` (contract: the bundler flattens every module
// into one scope).
// ===========================================================================

// ---------------------------------------------------------------- geography --
const rioSEA_Y = -1.0;              // the Atlantic surface
const rioSHORE_Z = -18;             // where the sand meets the water
const rioPROM_Z = -4;               // back of the beach / front of the calcadao
const rioBEACH_FLAT_Z = -10;        // shoreward of this the sand slopes; behind it, flat
const rioSPAWN = { x: 0, y: 1.4, z: 0 };
const rioGLOBO = { x: 7, z: -3 };                      // the biscoito Globo man
const rioVOLEI = { x: -16, z: -7 };                    // the futevolei net
const rioARPOADOR = { x: -62, z: -26, r: 13, h: 9 };   // the rock at the west end
const rioSUGAR = { x: 96, z: -54, r: 32, h: 62 };      // Pao de Acucar
const rioURCA = { x: 74, z: -38, r: 20, h: 30 };       // the halfway hill
const rioSTATION = { x: 58, z: -24 };                  // Praia Vermelha, the bottom station
const rioCORCOVADO = { x: -96, z: 78, r: 72, h: 84 };  // and the Redentor on top
const rioAVE_Z = 46;                // the avenue the desfile comes down
const rioAVE_X0 = -84, rioAVE_X1 = 84;
const rioLAPA = { x: -28, z: 76 };                     // the arches
const rioSELARON = { x: -20, z: 84 };                  // the foot of the steps
const rioSELARON_N = 34;                               // the real one has ~215
const rioSELARON_RISE = 0.32, rioSELARON_RUN = 1.05;

// --- the desfile -------------------------------------------------------------
// The column walks. Everything about the samba task is measured against where
// the bateria IS, not against a rectangle painted on the ground.
const rioPARADE_SPEED = 2.4;        // m/s — a desfile walks, it does not march
// s the head of the column will mark time at the end of the avenue rather than
// wrap away from a capybara that is standing in it. See rioUpdateParade.
const rioPARADE_HOLD_MAX = 24;
let rioParadeHold = 0;
const rioCOL_HX = 11;               // half-length of the scoring column, along x
const rioCOL_HZ = 6.5;              // half-width, across the avenue
// A step is judged against the actual audio clock (game.music), same as Cali.
// The window is wider than Cali's in BEATS because samba is faster: at 132 bpm
// a beat is 455 ms, so 0.24 beats is ~109 ms — about the same in milliseconds,
// which is what a player's hands actually feel.
const rioBEAT_WINDOW = 0.24;        // beats
const rioSAMBA_TARGET = 6;          // consecutive surdos to pass
const rioSAMBA_DROP = 3.0;          // s out of the column before the combo lapses
const rioSTEP_MIN_TURN = 1.1;       // rad/s of heading change that counts as a step
const rioSTEP_COOL = 0.30;          // s between steps — no mashing

// Every cable height in the biome is terrain + this, stations included, so the
// clearance floor in rioSpanPoint() agrees with the towers exactly.
const rioCABLE_CLEAR = 9;
const rioSELARON_PAR = 8.5;         // s to take the whole flight and have it count
let rioSelaronTold = false;         // the 'go' line is said once a visit, not once a pass
// FEWER, AND FURTHER APART. With the median gardens in, seventy-four palms
// landed in a strip eight metres deep and the shot from the spawn is a
// PALISADE — a trunk every two and a half metres across the whole of the first
// frame of the chapter. Copacabana's promenade row is nowhere near that dense
// and the camera cannot see past it.
const rioPALM_N = 58;
const rioCROWD_N = 220;      // a Sambodromo rake is PACKED, and 130 over 168 m is not
const rioBATERIA_N = 16;

// ------------------------------------------------------------------ scratch --
const rioV3 = new THREE.Vector3();
const rioQ = new THREE.Quaternion();
const rioEu = new THREE.Euler();
const rioSc = new THREE.Vector3();
const rioM = new THREE.Matrix4();

// ---------------------------------------------------------------- module ----
// The people this chapter needs a HANDLE on, because they talk to each other.
// See the addExchange block at the foot of rioBuild.
let rioLocGlobo = null, rioLocKiosk = null, rioLocSel = null, rioLocSel2 = null;
let rioLocBonde = null;
let rioGame = null;
let rioBuilt = false;
let rioRoot = null;
let rioTime = 0;

let rioSeaMesh = null, rioSeaAttr = null, rioRipT = 0;
let rioSeaColAttr = null, rioSeaBase = null;
let rioBateriaGroup = null, rioBateriaX = 0, rioBateriaPulse = 0;
let rioBateriaBody = null, rioFloatBody = null, rioBateriaPX = 0;
let rioFloatGroup = null;
let rioCabinGroup = null, rioCabinBody = null, rioCabinT = 0, rioCabinDir = 1;
let rioCabinPX = 0, rioCabinPY = 0, rioCabinPZ = 0;
let rioGloboGroup = null, rioGloboGone = false;
// The yaw he stands at, so a re-entry can put him back — see rioBuildGlobo and
// the onEnter note about one-shot objects.
const rioGloboYaw = -2.2;
let rioBallMesh = null, rioBallBody = null;
let rioSpark = null;
const rioSPARK_N = 34;
const rioSparkData = new Float32Array(rioSPARK_N * 7);   // x,y,z,vx,vy,vz,life

// --- task / samba state ---
let rioInColumn = false, rioOutT = 0;
let rioCombo = 0, rioBestCombo = 0, rioStepCool = 0;
let rioLastYaw = 0, rioLastBeat = -1;
let rioFlash = 0, rioWrongFlash = 0;
let rioSambaDone = false, rioBateriaDone = false, rioGloboDone = false;
let rioVoleiDone = false, rioSelaronDone = false, rioBondinhoDone = false;
let rioArpoadorDone = false;
let rioSelaronT = -1;               // >= 0 while the climb is being timed
let rioRiding = false;
let rioSalute = 0;                  // s of the bateria facing the capybara
let rioConfetti = 0;                // s of the float throwing paper

// ============================================================== helpers ======
function rioXform(px, py, pz, rx, ry, rz, sx, sy, sz) {
  rioEu.set(rx, ry, rz, 'YXZ');
  rioQ.setFromEuler(rioEu);
  rioV3.set(px, py, pz);
  rioSc.set(sx, sy, sz);
  rioM.compose(rioV3, rioQ, rioSc);
  return rioM;
}

const rioG = { box: null, cyl6: null, cyl8: null, cyl4: null, cone6: null, cone4: null, sph6: null, plane: null, blade: null };
function rioInitGeos() {
  if (rioG.box) return;
  rioG.box = new THREE.BoxGeometry(1, 1, 1);
  rioG.cyl6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
  rioG.cyl8 = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
  rioG.cyl4 = new THREE.CylinderGeometry(0.5, 0.5, 1, 4);
  rioG.cone6 = new THREE.ConeGeometry(0.5, 1, 6);
  rioG.cone4 = new THREE.ConeGeometry(0.5, 1, 4);
  rioG.sph6 = new THREE.SphereGeometry(0.5, 6, 4);
  rioG.plane = new THREE.PlaneGeometry(1, 1);
  // A FROND IS NOT A PLANK. Seventy-four palms times fourteen blades is a
  // thousand instances of BoxGeometry, and a box is the same width at the tip
  // as at the shoulder — so the promenade photographs as a scatter of green
  // rectangles rather than as a row of trees. Pulling the +x end of the unit
  // box in costs nothing at all (the same twelve triangles, the same one
  // instanced draw call) and turns every one of them into a leaf.
  rioG.blade = new THREE.BoxGeometry(1, 1, 1);
  {
    const p = rioG.blade.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) {
      if (p[i] > 0) { p[i + 1] *= 0.45; p[i + 2] *= 0.20; }
      else { p[i + 2] *= 0.86; }
    }
    rioG.blade.attributes.position.needsUpdate = true;
    rioG.blade.computeVertexNormals();
  }
}

/**
 * Vertex-coloured geometry merger. One draw call per merged batch, which is how
 * a whole city fits inside the contract's 220-call budget.
 */
function rioMerger() {
  const pos = [], nor = [], col = [], idx = [];
  const c = new THREE.Color();
  const M = {
    n: 0,
    add(geo, m4, color) {
      const g = geo.clone();
      g.applyMatrix4(m4);
      const p = g.attributes.position.array;
      const nm = g.attributes.normal.array;
      c.set(color);
      const start = M.n;
      for (let i = 0; i < p.length; i += 3) {
        pos.push(p[i], p[i + 1], p[i + 2]);
        nor.push(nm[i], nm[i + 1], nm[i + 2]);
        col.push(c.r, c.g, c.b);
      }
      const vc = p.length / 3;
      if (g.index) { const ia = g.index.array; for (let i = 0; i < ia.length; i++) idx.push(start + ia[i]); }
      else { for (let i = 0; i < vc; i++) idx.push(start + i); }
      M.n += vc;
      g.dispose();
      return M;
    },
    box(cx, cy, cz, sx, sy, sz, color, rx, ry, rz) {
      return M.add(rioG.box, rioXform(cx, cy, cz, rx || 0, ry || 0, rz || 0, sx, sy, sz), color);
    },
    cyl(cx, cy, cz, r, h, color, rx, ry, rz, seg) {
      const g = seg === 4 ? rioG.cyl4 : seg === 8 ? rioG.cyl8 : rioG.cyl6;
      return M.add(g, rioXform(cx, cy, cz, rx || 0, ry || 0, rz || 0, r * 2, h, r * 2), color);
    },
    cone(cx, cy, cz, r, h, color, rx, ry, rz, seg) {
      const g = seg === 4 ? rioG.cone4 : rioG.cone6;
      return M.add(g, rioXform(cx, cy, cz, rx || 0, ry || 0, rz || 0, r * 2, h, r * 2), color);
    },
    sph(cx, cy, cz, rx2, ry2, rz2, color) {
      return M.add(rioG.sph6, rioXform(cx, cy, cz, 0, 0, 0, rx2 * 2, ry2 * 2, rz2 * 2), color);
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
function rioVC() {
  return grain(mat(0xffffff, { vertexColors: true }),
               { scale: 0.45, amount: 0.09, warp: 0.55 });
}
/** The same thing at ground strength, and flat: the ground is horizontal,
 *  so it wants no vertical shear in the sample at all. */
function rioVCG() {
  return grain(mat(0xffffff, { vertexColors: true }),
               { scale: 0.58, amount: 0.18, warp: 0 });
}
function rioPush9(l, px, py, pz, rx, ry, rz, sx, sy, sz) { l.push(px, py, pz, rx, ry, rz, sx, sy, sz); }
function rioInstance(root, geo, color, list, cast, recv) {
  const n = list.length / 9;
  if (n < 1) return null;
  const im = new THREE.InstancedMesh(geo, mat(color), n);
  for (let i = 0; i < n; i++) {
    const o = i * 9;
    im.setMatrixAt(i, rioXform(list[o], list[o + 1], list[o + 2], list[o + 3], list[o + 4],
                               list[o + 5], list[o + 6], list[o + 7], list[o + 8]));
  }
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  im.castShadow = !!cast;
  im.receiveShadow = !!recv;
  root.add(im);
  return im;
}
/**
 * `rz` was added for the bonde's viaduct and it is not a convenience: a ramp
 * built out of AXIS-ALIGNED plates is a staircase, and at twenty-four degrees
 * over thirty-four metres each of its treads is a 0.6 m riser — which the
 * capybara has to HOP, twenty-four times, to get to the top of a tram line.
 * Venice's helper has taken both angles since the duckboards for the same
 * reason.
 */
const rioSolids = makeSolidIndex();
function rioStaticBox(game, x, y, z, sx, sy, sz, ry, rz) {
  rioSolids.add(x, y, z, sx * 0.5, sy * 0.5, sz * 0.5, ry);
  const b = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
  b.addShape(new CANNON.Box(new CANNON.Vec3(sx * 0.5, sy * 0.5, sz * 0.5)));
  b.position.set(x, y, z);
  if (ry || rz) b.quaternion.setFromEuler(0, ry || 0, rz || 0);
  rioSyncBody(b);
  game.world.addBody(b);
  return b;
}
/**
 * MANY WALLS, ONE BODY.
 *
 * The body budget is 130 and this chapter is at a hundred and twenty before the
 * Avenida Atlântica frontage goes in, because `rioStaticBox` spends a whole
 * CANNON.Body on every single box. Nothing about the solver requires that — the
 * bateria has carried sixteen shapes on one body since it was written — and the
 * nav index is a separate structure that does not care either way. So anything
 * that is a ROW of static boxes standing in one place gets one body and a shape
 * per box, and the solidity audit and `navBlocked` both see exactly what they
 * saw before.
 */
function rioStaticGroup(game) {
  const b = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
  let used = false;
  const q = new CANNON.Quaternion();
  return {
    add(x, y, z, sx, sy, sz, ry) {
      rioSolids.add(x, y, z, sx * 0.5, sy * 0.5, sz * 0.5, ry);
      if (ry) { q.setFromEuler(0, ry, 0); b.addShape(new CANNON.Box(new CANNON.Vec3(sx * 0.5, sy * 0.5, sz * 0.5)), new CANNON.Vec3(x, y, z), q.clone()); }
      else b.addShape(new CANNON.Box(new CANNON.Vec3(sx * 0.5, sy * 0.5, sz * 0.5)), new CANNON.Vec3(x, y, z));
      used = true;
      return this;
    },
    done() { if (used) { rioSyncBody(b); game.world.addBody(b); } return b; },
  };
}
/**
 * Contract, "Rendering physics transforms": any body whose position is written
 * by hand must carry its own previous/interpolated transform forward, or the
 * renderer lerps from a stale origin and the object visibly smears.
 */
function rioSyncBody(b) {
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
  b.previousQuaternion.copy(b.quaternion);
  b.interpolatedQuaternion.copy(b.quaternion);
}

// ================================================================= TERRAIN ==
/**
 * Rio's relief IS Rio: the city is the flat bit between the granite. So this is
 * a flat shelf with four domes on it — Sugarloaf and Urca standing straight out
 * of the water to the east, Corcovado to the west, the rock at Arpoador — plus
 * the beach tilting down into the Atlantic.
 *
 * Cheap by construction: four distance tests and a couple of lerps, no raycasts.
 * Called per frame by the camera clearance, the sun frustum and the task beacon.
 */
function rioTerrain(x, z) {
  let y = 0;
  if (z <= rioSHORE_Z) {
    // the sea floor, dropping away from the waterline
    y = rioSEA_Y - clamp((rioSHORE_Z - z) * 0.16, 0, 13);
  } else if (z < rioPROM_Z) {
    // The sand. Copacabana is a very wide flat apron with the slope all down at
    // the water, and it has to be modelled that way rather than as one even
    // tilt: a four-degree ramp under the whole beach rolls the futevolei ball
    // into the Atlantic on its own, and the task completes itself.
    y = z >= rioBEACH_FLAT_Z ? 0
      : lerp(rioSEA_Y, 0, (z - rioSHORE_Z) / (rioBEACH_FLAT_Z - rioSHORE_Z));
  }
  // --- Pao de Acucar. Famously not a cone: a bare granite loaf with near
  //     vertical sides, so the profile is raised to a power to steepen it.
  const sx = x - rioSUGAR.x, sz = z - rioSUGAR.z;
  const sd = Math.sqrt(sx * sx + sz * sz);
  if (sd < rioSUGAR.r) {
    const t = sd / rioSUGAR.r;
    y += rioSUGAR.h * Math.pow(0.5 + 0.5 * Math.cos(t * Math.PI), 0.62);
  }
  // --- Morro da Urca, the halfway stop
  const ux = x - rioURCA.x, uz = z - rioURCA.z;
  const ud = Math.sqrt(ux * ux + uz * uz);
  if (ud < rioURCA.r) {
    const t = ud / rioURCA.r;
    y += rioURCA.h * Math.pow(0.5 + 0.5 * Math.cos(t * Math.PI), 0.7);
  }
  // --- Corcovado, west, with the Redentor on the summit
  const cx = x - rioCORCOVADO.x, cz = z - rioCORCOVADO.z;
  const cd = Math.sqrt(cx * cx + cz * cz * 0.8);
  if (cd < rioCORCOVADO.r) {
    const t = cd / rioCORCOVADO.r;
    y += rioCORCOVADO.h * (0.5 + 0.5 * Math.cos(t * Math.PI)) * (1 - t * 0.1);
  }
  // --- Arpoador: a low tumble of rock at the end of the sand
  const ax = x - rioARPOADOR.x, az = z - rioARPOADOR.z;
  const ad = Math.sqrt(ax * ax + az * az);
  if (ad < rioARPOADOR.r) {
    const t = ad / rioARPOADOR.r;
    y += rioARPOADOR.h * (0.5 + 0.5 * Math.cos(t * Math.PI));
  }
  // --- Santa Teresa, up behind Lapa
  if (z > 68) y += clamp((z - 68) * 0.30, 0, 22);
  // --- the city shelf is flat by construction: the beach, the avenue and the
  //     arches all have to be walkable and none of them may tilt.
  if (z > rioPROM_Z && z < 66 && x > -88 && x < 88) y = lerp(y, 0, 0.93);
  return y;
}

function rioSlope(x, z) {
  const h = 1.5;
  return Math.sqrt(
    Math.pow(rioTerrain(x + h, z) - rioTerrain(x - h, z), 2) +
    Math.pow(rioTerrain(x, z + h) - rioTerrain(x, z - h), 2)) / (2 * h);
}

/**
 * A MONOTONE SQUEEZE, AND IT BUYS BOTH ENDS OF THE ARGUMENT.
 *
 * The ground was a uniform 100 x 86 grid over 400 x 330 m — 4.0 x 3.8 m cells
 * everywhere, seventeen thousand triangles, and most of them spent on open
 * ocean and the back of Corcovado where the height is one number. Meanwhile
 * Arpoador is a thirteen-metre dome and got three samples across it.
 *
 * Same trick as Pasto and the Palawan seabed: warp the parameter instead of
 * shrinking the grid. `k < 1` keeps it monotone and s = 0 / 1 map to
 * themselves, so the mesh still ends exactly where the world does.
 */
function rioWarp(u, c, k) {
  if (u <= c) { const s = c > 0 ? (c - u) / c : 0; return c - c * (s * (1 - k) + k * s * s * s); }
  const s = (u - c) / (1 - c);
  return c + (1 - c) * (s * (1 - k) + k * s * s * s);
}

/**
 * WHAT COLOUR THE GROUND IS AT (x, z).
 *
 * THE WHOLE CITY WAS PAINTED BEACH SAND. The old rule was three branches on z
 * and one on y, and the last of them — a bare `else` — covered everything from
 * the back of the calçadão to the top of Santa Teresa: a hundred and twenty
 * metres of avenue, grandstand apron, Lapa and the foot of the arches, all of
 * it the colour of Copacabana. The instrumented shot of the aqueduct is a
 * Roman viaduct standing on a beach.
 *
 * And the granite was tested by HEIGHT, so Arpoador — a nine-metre dome that
 * the grid samples two or three times — never once returned a vertex over the
 * y > 4 line and came out as a sandcastle with grey boulders on it. Landmarks
 * are tested by DISTANCE now, which is a thing the mesh resolution cannot lose.
 */
function rioGroundColor(x, z, y, c, P) {
  // --- the two rocks in the bay and the one at the end of the sand ---------
  const ad = Math.sqrt((x - rioARPOADOR.x) * (x - rioARPOADOR.x) +
                       (z - rioARPOADOR.z) * (z - rioARPOADOR.z));
  const sd = Math.sqrt((x - rioSUGAR.x) * (x - rioSUGAR.x) + (z - rioSUGAR.z) * (z - rioSUGAR.z));
  const ud = Math.sqrt((x - rioURCA.x) * (x - rioURCA.x) + (z - rioURCA.z) * (z - rioURCA.z));
  const rockK = Math.max(clamp(1 - ad / (rioARPOADOR.r * 0.92), 0, 1),
                         clamp(1 - sd / (rioSUGAR.r * 0.86), 0, 1),
                         clamp(1 - ud / (rioURCA.r * 0.86), 0, 1));
  if (rockK > 0.02) {
    // bare granite at the top, wooded round the foot — which is exactly how
    // Sugarloaf and the point read from the beach
    c.copy(P.forest).lerp(P.forestD, clamp(Math.sin(x * 0.06 + z * 0.05) * 0.5 + 0.5, 0, 1));
    const bare = clamp((y - 6) / 20, 0, 1) * 0.35 + rockK * 0.82;
    c.lerp(P.rock, clamp(bare, 0, 1));
    if (y > 40) c.lerp(P.rockD, clamp((y - 40) / 40, 0, 0.5));
    // the surf line round the base of a rock standing in the sea
    if (y < 0.7 && z < rioSHORE_Z + 2) c.lerp(P.foam, clamp((0.7 - y) * 0.7, 0, 0.45));
    return;
  }
  // --- Corcovado and the Tijuca behind the city ----------------------------
  if (y > 4) {
    const bare = clamp((y - 12) / 30, 0, 1);
    c.copy(P.forest).lerp(P.forestD, clamp(Math.sin(x * 0.06 + z * 0.05) * 0.5 + 0.5, 0, 1));
    c.lerp(P.forestP, clamp(Math.sin(x * 0.13 - z * 0.09) * 0.5 + 0.5, 0, 0.4));
    c.lerp(P.rock, bare);
    if (y > 40) c.lerp(P.rockD, clamp((y - 40) / 40, 0, 0.5));
    return;
  }
  // --- the sea floor --------------------------------------------------------
  if (z <= rioSHORE_Z) { c.copy(P.sandD); return; }
  // --- the sand -------------------------------------------------------------
  if (z < rioPROM_Z + 1) {
    c.copy(P.sand).lerp(P.sandD, clamp((rioPROM_Z - z) / 20, 0, 1));      // damp near the water
    // the tide line: a pale band of dried salt where the swash stops
    const tide = clamp(1 - Math.abs(z - (rioSHORE_Z + 3.5)) / 2.6, 0, 1);
    c.lerp(P.foam, tide * 0.30);
    return;
  }
  // --- AND THIS IS THE HALF THAT WAS MISSING: A CITY ------------------------
  // The calçadão has its own mesh; what is under everything behind it is
  // pavement, road and park, and none of it is beach.
  const dz = Math.abs(z - rioAVE_Z);
  c.copy(P.pave);
  // the grain of the paving, which is what stops sixty metres of it being one
  // value at a camera that is looking mostly at the ground
  c.lerp(P.paveD, clamp(Math.sin(x * 0.21) * Math.sin(z * 0.17) * 0.5 + 0.5, 0, 0.55));
  if (dz < 26) {
    // the parade route and the two service roads that flank it
    c.lerp(P.road, clamp(1 - (dz - 9) / 8, 0, 1));
  }
  if (z > 3 && z < 11.5) {
    // the median gardens between the promenade and the hotel frontage: this is
    // the strip the palms actually stand in
    const gg = clamp(Math.sin(x * 0.055) * 0.5 + 0.5, 0, 1);
    c.lerp(P.forestP, clamp(0.42 + gg * 0.35, 0, 0.85));
    c.lerp(P.forest, clamp((gg - 0.55) * 1.4, 0, 0.5));
  }
  if (z > 11.5 && z < 24) {
    // the frontage: pavement, and the cross streets that break it up
    const r = Math.abs(((x + 67.2 + rioFRONT_PITCH * 20.5) % rioFRONT_PITCH) - rioFRONT_PITCH * 0.5);
    if (r < 3.2) c.lerp(P.road, clamp(1 - r / 3.2, 0, 0.9));
  }
  if (z > 64) {
    // Lapa, and then the hill: the ground goes green as the houses climb it
    // ---- EXCEPT THAT LAPA ITSELF IS NOT A LAWN (v20) -------------------
    //
    // Measured off the shot from the foot of Selarón's steps: at z = 84 the
    // ramp above was returning 0.75 forestP, so the whole of Lapa — the square
    // under a forty-two arch aqueduct, the tram alignment on top of it and the
    // most photographed staircase in Brazil — was standing on BRIGHT GREEN
    // GRASS. It is the same class of error as the beach-sand `else` this
    // function was written to fix, one district further inland: a rule about
    // the hill was applied to the flat thing at the bottom of it.
    //
    // Lapa is asphalt and Portuguese paving. So the green is held OFF over the
    // square, and the strip under the arches is road, because the bonde runs
    // along it and a tram runs on a street.
    const lx = Math.abs(x - rioLAPA.x), lz = Math.abs(z - (rioLAPA.z + 5));
    const town = clamp(1 - Math.max(lx / 46, lz / 17), 0, 1);
    const green = Math.max(0, 1 - town * 1.35);
    c.lerp(P.forestP, clamp((z - 66) / 22, 0, 0.75) * green);
    c.lerp(P.forestD, clamp((z - 84) / 30, 0, 0.5) * green);
    if (town > 0.02) {
      // the alignment: a band of asphalt under the arches, with the paving
      // grain still reading through at the edges
      const road = clamp(1 - Math.abs(z - rioLAPA.z) / 7.5, 0, 1) * town;
      c.lerp(P.road, road * 0.85);
      // ...and a lick of terracotta where two hundred and fifteen tiled steps
      // have been shedding chips on to the pavement for twenty years
      const sd2 = Math.hypot(x - rioSELARON.x, z - rioSELARON.z);
      c.lerp(P.tileR, clamp(1 - sd2 / 11, 0, 1) * 0.22);
    }
  }
  // and a wash of warm dust off the sand over the first few metres of it
  if (z < 10) c.lerp(P.sand, clamp((10 - z) / 12, 0, 0.5));
}

function rioBuildGroundMesh() {
  const X0 = -200, X1 = 200, Z0 = -160, Z1 = 170;
  // 80 x 70 warped beats 100 x 86 uniform on both counts: 11 200 triangles
  // instead of 17 200, and ~2.4 m cells through the beach and the avenue
  // instead of 4.0.
  const NX = 80, NZ = 70;
  const g = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0, NX, NZ);
  g.rotateX(-Math.PI / 2);
  g.translate((X0 + X1) * 0.5, 0, (Z0 + Z1) * 0.5);
  const p = g.attributes.position.array;
  // the squeeze. Centred on the beach in x and between the sand and the avenue
  // in z, which is where every single thing in this chapter happens.
  const CX = 0.50, CZ = (rioAVE_Z * 0.5 - Z0) / (Z1 - Z0), K = 0.52;
  for (let i = 0; i < p.length; i += 3) {
    p[i] = X0 + (X1 - X0) * rioWarp((p[i] - X0) / (X1 - X0), CX, K);
    p[i + 2] = Z0 + (Z1 - Z0) * rioWarp((p[i + 2] - Z0) / (Z1 - Z0), CZ, K);
  }
  const col = new Float32Array(p.length);
  const c = new THREE.Color();
  const P = {
    sand: new THREE.Color(PALETTE.rioSand),
    sandD: new THREE.Color(PALETTE.rioSandDark),
    rock: new THREE.Color(PALETTE.rioGranite),
    rockD: new THREE.Color(PALETTE.rioGraniteDk),
    forest: new THREE.Color(PALETTE.rioForest),
    forestD: new THREE.Color(PALETTE.rioForestDk),
    forestP: new THREE.Color(PALETTE.rioForestPale),
    pave: new THREE.Color(PALETTE.rioArchShade),
    paveD: new THREE.Color(PALETTE.rioGraniteFar),
    road: new THREE.Color(PALETTE.rioAsphalt),
    foam: new THREE.Color(PALETTE.rioSeaFoam),
    // the chips off Selaron's steps, ground into the pavement round their foot
    tileR: new THREE.Color(PALETTE.rioTileRed),
  };
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i], z = p[i + 2];
    const y = rioTerrain(x, z);
    p[i + 1] = y;
    rioGroundColor(x, z, y, c, P);
    col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, rioVCG());
  m.receiveShadow = true;
  m.frustumCulled = false;
  return m;
}

/**
 * MIND WHICH WAY THE SECOND AXIS RUNS.
 *
 * A CANNON Heightfield is authored in its own xy plane with the height along
 * local z, and the rotation that stands it up as a floor — Rx(-90 deg), which is
 * the only one that puts the height on world y the right way up — maps its
 * local +y onto world MINUS z. So `data[i][j]` laid out naively against
 * `Z0 + j * EL` does not cover z0..z1 at all: it covers z0 and everything
 * BEHIND it, and the whole biome ends up with no collision floor.
 *
 * That failure is close to invisible from the capybara alone, because
 * capybara.js carries its own analytic ground backstop (capyGroundY) and will
 * happily walk on terrain the solver knows nothing about. It shows up the
 * instant anything else dynamic is dropped into the world — here, the futevolei
 * ball, which fell straight through the beach and out of the universe.
 *
 * So the body is anchored at the FAR z edge and j is walked back toward Z0.
 */
function rioBuildGroundBody(game) {
  const NX = 80, NZ = 66, X0 = -200, Z0 = -160, EL = 5;
  const Z1 = Z0 + NZ * EL;
  const data = [];
  for (let i = 0; i <= NX; i++) {
    const row = [];
    for (let j = 0; j <= NZ; j++) row.push(rioTerrain(X0 + i * EL, Z1 - j * EL));
    data.push(row);
  }
  const hf = new CANNON.Heightfield(data, { elementSize: EL });
  const b = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
  b.addShape(hf);
  b.position.set(X0, 0, Z1);
  b.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  rioSyncBody(b);
  game.world.addBody(b);
}

// ================================================================ THE SEA ===
function rioBuildSea() {
  // WARPED, LIKE THE GROUND. 76 x 72 uniform over 460 x 260 m is eleven
  // thousand triangles and four fifths of them are out in open ocean where the
  // surface is two sines and nothing else; meanwhile the break — the one part
  // of this sheet that has a WAVE written into it, and the thing the chapter's
  // mini is about — was getting 3.6 m cells to resolve a crest with a
  // five-metre face on it. 64 x 54 squeezed toward the shore and toward the
  // peak is 6 912 triangles and about 1.8 m through the surf, and it takes a
  // third off the per-frame ripple loop as well.
  const SX0 = -230, SX1 = 230, SZ0 = rioSHORE_Z - 252, SZ1 = rioSHORE_Z + 8;
  const g = new THREE.PlaneGeometry(460, 260, 64, 54);
  g.rotateX(-Math.PI / 2);
  g.translate(0, rioSEA_Y, rioSHORE_Z - 122);
  {
    const q = g.attributes.position.array;
    const CX = (rioWAVE_X - SX0) / (SX1 - SX0), CZ = 0.84;
    for (let i = 0; i < q.length; i += 3) {
      q[i] = SX0 + (SX1 - SX0) * rioWarp((q[i] - SX0) / (SX1 - SX0), CX, 0.46);
      q[i + 2] = SZ0 + (SZ1 - SZ0) * rioWarp((q[i + 2] - SZ0) / (SZ1 - SZ0), CZ, 0.58);
    }
  }
  const p = g.attributes.position.array;
  const col = new Float32Array(p.length);
  const c = new THREE.Color(), near = new THREE.Color(PALETTE.rioSea), far = new THREE.Color(PALETTE.rioSeaDeep);
  const foam = new THREE.Color(PALETTE.rioSeaFoam);
  for (let i = 0; i < p.length; i += 3) {
    const z = p[i + 2];
    c.copy(near).lerp(far, clamp((rioSHORE_Z - z) / 150, 0, 1));
    // the break: a band of white where the swell stands up on the sand
    const b = clamp(1 - Math.abs(z - (rioSHORE_Z - 2.5)) / 6.0, 0, 1);
    if (b > 0) c.lerp(foam, b * b * 0.92);
    col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  // GLITTER, NOT WAVES. The mesh already has a ripple written into it and you
  // cannot see it from six metres up at 41 degrees; what makes water read as
  // water from there is a sparse field of moving points far brighter than the
  // surface. It costs four hash calls and it is the difference between a sea
  // and a sheet of coloured card. See grain() in shared.js.
  const m = new THREE.Mesh(g, grain(mat(0xffffff, { vertexColors: true, transparent: true, opacity: 0.92 }),
    { scale: 0.45, amount: 0.05, warp: 0,
      sparkle: 0.66, sparkleScale: 1.05, sparkleSpeed: 0.34, sparkleCut: 0.635,
      sparkleColor: PALETTE.rioSeaFoam }));
  m.receiveShadow = true;
  m.frustumCulled = false;
  rioSeaAttr = g.attributes.position;
  // THE WAVE HAS TO BE PAINTED, NOT ONLY MOVED.
  //
  // The sea is deformed every 33 ms and its NORMALS are not recomputed, which
  // is invisible at the 0.3 m swell it was written for and completely defeating
  // at 1.35: the surface genuinely rose and the picture did not change at all,
  // because a Lambert facet whose normal still points at the sky is lit exactly
  // as it was. Recomputing ten thousand triangles' normals thirty times a second
  // to shade one wave is not the trade. Painting the crest is: the still-water
  // colours are kept here and rioUpdateWaves lerps the live ones toward foam by
  // the lift, which is both cheaper and more in this game's language than
  // shading would have been.
  rioSeaColAttr = g.attributes.color;
  rioSeaBase = col.slice();
  rioSeaMesh = m;
  return m;
}

/** The Atlantic has a real swell on it, so this is a longer, slower wave than
 *  the Rio Cali's ripple — and it runs UP the beach, not across it. */
/**
 * THE WATERLINE, AND THE WAVE IS IN IT.
 *
 * capybara.js floats the animal against whatever the live biome says the
 * surface is, so putting the lift in here is what makes the capybara RIDE the
 * swell rather than swim through the middle of a wave that is only a picture.
 * It is the same number the sea mesh is deformed by and the same number the
 * foam is drawn at, which is the only way all three can agree.
 */
function rioSurfaceY(x, z) {
  return rioSEA_Y + Math.sin(z * 0.11 + rioTime * 1.5) * 0.22
                  + Math.sin(x * 0.07 - rioTime * 0.9) * 0.10
                  + rioWaveLift(x, z);
}

// ============================================================== THE CALCADAO ==
/**
 * Portuguese pavement, and the most copied piece of paving on earth: Burle
 * Marx's wave, laid in black basalt and white limestone the whole four
 * kilometres of Copacabana. It is the first thing under the capybara's feet and
 * it has to be recognisable from the very first frame, so it gets its own mesh
 * rather than being a colour on the terrain.
 *
 * The wave is drawn as bands of quads whose z is displaced by a sine of x — a
 * real Portuguese-pavement wave is exactly that, and at this scale nobody needs
 * the individual stones.
 */
function rioBuildCalcadao() {
  const X0 = -96, X1 = 96, NX = 192;
  const BANDS = 7;                       // alternating dark / pale
  const Z0 = rioPROM_Z, Z1 = 2.6;
  const pos = [], col = [], idx = [];
  const c = new THREE.Color();
  const dark = new THREE.Color(PALETTE.rioPaveDark);
  const pale = new THREE.Color(PALETTE.rioPavePale);
  const bandH = (Z1 - Z0) / BANDS;
  let n = 0;
  for (let b = 0; b < BANDS; b++) {
    c.copy(b % 2 ? dark : pale);
    const z0 = Z0 + b * bandH, z1 = z0 + bandH;
    let prevA = -1, prevB = -1;
    for (let i = 0; i <= NX; i++) {
      const x = lerp(X0, X1, i / NX);
      // the wave: amplitude just over a band, so the bands interleave the way
      // the real pavement does instead of reading as stripes
      const w = Math.sin(x * 0.32) * bandH * 1.15;
      pos.push(x, 0.02, z0 + w); col.push(c.r, c.g, c.b);
      pos.push(x, 0.02, z1 + w); col.push(c.r, c.g, c.b);
      const a = n, bb = n + 1;
      n += 2;
      if (prevA >= 0) { idx.push(prevA, prevB, bb); idx.push(prevA, bb, a); }
      prevA = a; prevB = bb;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, rioVC());
  m.receiveShadow = true;
  return m;
}

// ============================================================== THE BEACH ====
/**
 * Copacabana furniture: the kiosk, the row of parasols, the biscoito Globo man
 * and the futevolei net. All of it merged into one draw call except the two
 * things that have to move or disappear.
 */
function rioBuildBeach(game, root) {
  const M = rioMerger();

  // --- parasols down the sand. Barracas, in rows, the whole length of it.
  for (let i = 0; i < 26; i++) {
    const x = -84 + i * 6.6 + rand(-1.2, 1.2);
    const z = rand(rioSHORE_Z + 3, rioPROM_Z - 1.5);
    if (Math.abs(x - rioVOLEI.x) < 7 && Math.abs(z - rioVOLEI.z) < 6) continue;   // keep the court clear
    const y = rioTerrain(x, z);
    const col = i % 4 === 0 ? PALETTE.rioFeather1 : i % 4 === 1 ? PALETTE.rioTileWhite
              : i % 4 === 2 ? PALETTE.rioFeather3 : PALETTE.rioFeather2;
    M.cyl(x, y + 1.1, z, 0.06, 2.2, PALETTE.rioPalmTrunk);
    M.cone(x, y + 2.4, z, 1.5, 0.55, col, 0, rand(0, 6.28), 0, 6);
  }

  // --- the kiosk. Every few hundred metres, and it sells everything.
  const kx = -8, kz = -6, ky = rioTerrain(kx, kz);
  M.cyl(kx, ky + 1.3, kz, 2.4, 2.6, PALETTE.rioWall1, 0, 0, 0, 8);
  M.cone(kx, ky + 3.1, kz, 3.4, 1.0, PALETTE.rioRoof, 0, 0, 0, 8);
  M.box(kx, ky + 2.05, kz - 2.2, 3.0, 0.12, 0.7, PALETTE.rioWall4);
  // THE DRUM'S COLLIDER BURIED THE COUNTER IT SERVES.
  // It was 2.6 high and 4.6 deep, spanning z -8.3..-3.7; the counter sits at
  // z -8.2 with a half-depth of 0.35, so all but a 0.25 m sliver of the shelf
  // was inside the drum. A player who did make the climb rested at y 2.60 —
  // standing inside the cone roof — and not on the counter at all. 2.05 high
  // leaves the shelf proud; the drawn drum is unchanged, so it still reads as
  // the wall you are standing beside.
  rioStaticBox(game, kx, ky + 1.025, kz, 4.6, 2.05, 4.6, 0);
  // THE COUNTER IS A STEP AS WELL AS A SHELF. It was drawn and not collided, so
  // the one place on this beach you could be served at was a picture of a shelf.
  rioStaticBox(game, kx, ky + 2.0, kz - 2.2, 3.0, 0.22, 0.7, 0);
  // ---- AND THE LADDER WAS A COIN FLIP -----------------------------------
  // Two crates gave rises of 0.70, 0.70 and 0.71 against a measured jump rise
  // of exactly 0.70 m. One of three scripted run-and-hop climbs made it, and a
  // standing hop off the top crate peaked at 0.70 and fell back. A step the
  // same height as the jump is not a step, it is a dice roll. Three crates
  // now: 0.60, 0.55, 0.50 and 0.46 to the counter, every one comfortably
  // inside the hop.
  M.box(kx + 2.1, ky + 0.30, kz - 2.0, 1.00, 0.60, 1.00, PALETTE.rioTramWood);
  M.box(kx + 2.1, ky + 0.875, kz - 2.0, 0.90, 0.55, 0.90, PALETTE.rioTramWood, 0, 0.4);
  M.box(kx + 2.1, ky + 1.40, kz - 2.0, 0.80, 0.50, 0.80, PALETTE.rioTramWood, 0, 0.8);
  rioStaticBox(game, kx + 2.1, ky + 0.30, kz - 2.0, 1.00, 0.60, 1.00, 0);
  rioStaticBox(game, kx + 2.1, ky + 0.875, kz - 2.0, 0.90, 0.55, 0.90, 0.4);
  rioStaticBox(game, kx + 2.1, ky + 1.40, kz - 2.0, 0.80, 0.50, 0.80, 0.8);

  // ---- AND SOMETHING TO BE SERVED AT --------------------------------------
  // The kiosk was a drum, a cone and a shelf, and there is a task on it. What
  // one of these actually is: a chalk board with the prices on, a chest of ice
  // with the drinks standing in it, a rack of green coconuts, two stools nobody
  // ever gets off, and a bin with yesterday in it.
  M.box(kx - 1.5, ky + 2.55, kz - 2.35, 1.1, 0.85, 0.08, PALETTE.rioPaveDark, 0, 0.18);
  for (let q = 0; q < 3; q++) {
    M.box(kx - 1.5, ky + 2.78 - q * 0.20, kz - 2.40, 0.72 - q * 0.14, 0.05, 0.03,
          PALETTE.rioTileWhite, 0, 0.18);
  }
  M.box(kx + 1.1, ky + 0.42, kz - 2.9, 1.5, 0.84, 0.9, PALETTE.rioTileWhite);
  M.box(kx + 1.1, ky + 0.87, kz - 2.9, 1.6, 0.10, 1.0, PALETTE.rioTileBlue);
  for (let q = 0; q < 4; q++) {
    M.cyl(kx - 2.9 + q * 0.42, ky + 2.28, kz - 2.1, 0.15, 0.34, PALETTE.rioTileGreen, 0.3, 0, 0.2, 6);
  }
  for (let q = -1; q <= 1; q += 2) {
    M.cyl(kx + q * 1.9 + 0.4, ky + 0.33, kz - 3.8, 0.22, 0.66, PALETTE.rioTramWood, 0, 0, 0, 6);
    M.cyl(kx + q * 1.9 + 0.4, ky + 0.68, kz - 3.8, 0.30, 0.06, PALETTE.rioTramWood, 0, 0, 0, 6);
  }
  M.cyl(kx - 3.1, ky + 0.45, kz - 0.6, 0.36, 0.9, PALETTE.rioTramDk, 0, 0, 0, 6);
  M.cyl(kx - 3.1, ky + 0.93, kz - 0.6, 0.40, 0.07, PALETTE.rioGraniteFar, 0, 0, 0, 6);
  // the string of pennants everybody hangs off one of these
  for (let q = 0; q < 9; q++) {
    const a2 = q / 8;
    M.cone(kx - 3.0 + q * 0.75, ky + 3.35 - Math.sin(a2 * Math.PI) * 0.42, kz - 2.6,
           0.14, 0.34, [PALETTE.rioFeather1, PALETTE.rioFeather2, PALETTE.rioFeather3,
                        PALETTE.rioFeather4][q % 4], Math.PI, 0, 0, 4);
  }

  // --- the futevolei court: two posts and a net. The ball is separate — it is
  //     the only dynamic body in the biome.
  const vy = rioTerrain(rioVOLEI.x, rioVOLEI.z);
  for (let s = -1; s <= 1; s += 2) {
    M.cyl(rioVOLEI.x + s * 4.5, vy + 1.2, rioVOLEI.z, 0.09, 2.4, PALETTE.rioPalmTrunk);
  }
  // A NET IS A GRID, NOT A LADDER. Nine uprights at 1.125 m centres between two
  // cords is a builder's guard rail; what makes a net read is that the holes in
  // it are square and about the size of your hand, and it costs one more loop.
  for (let i = 0; i <= 18; i++) {
    M.box(rioVOLEI.x - 4.5 + i * 0.5, vy + 1.76, rioVOLEI.z, 0.035, 0.94, 0.025,
          PALETTE.rioTileWhite);
  }
  for (let k = 0; k < 4; k++) {
    M.box(rioVOLEI.x, vy + 1.35 + k * 0.28, rioVOLEI.z, 9.0, 0.035, 0.025, PALETTE.rioTileWhite);
  }
  // the tape along the top, which is the one part of a net you can see from the
  // far end of a beach, and the cord under it
  M.box(rioVOLEI.x, vy + 2.27, rioVOLEI.z, 9.0, 0.13, 0.06, PALETTE.rioTileWhite);
  M.box(rioVOLEI.x, vy + 1.25, rioVOLEI.z, 9.0, 0.06, 0.05, PALETTE.rioTileWhite);
  // and the guys off the tops of the posts, which is why the tape is tight
  for (let sg = -1; sg <= 1; sg += 2) {
    M.cyl(rioVOLEI.x + sg * 5.3, vy + 1.55, rioVOLEI.z, 0.02, 2.4, PALETTE.rioTileWhite,
          0, 0, sg * 0.42);
  }

  // --- AND SOMEBODY ON IT ----------------------------------------------------
  // Two hundred metres of the most famous beach on earth, and the census was
  // one man with a pole. The calçadão is the recognisable thing in the first
  // frame and the sand behind it was a flat pale nothing all the way to the
  // water — which reads, at this camera, as an unfinished level rather than as
  // a beach at seven in the morning.
  //
  // Towels first, because a towel is what makes a patch of sand into somebody's
  // patch of sand, and they cost nothing: a flat quad in the merged mesh.
  const TOWEL = [PALETTE.rioFeather1, PALETTE.rioFeather2, PALETTE.rioFeather3,
                 PALETTE.rioFeather4, PALETTE.rioTileBlue, PALETTE.rioTileGreen,
                 PALETTE.rioTileRed, PALETTE.rioTileWhite];
  for (let i = 0; i < 34; i++) {
    const x = rand(-86, 86);
    const z = rand(rioSHORE_Z + 4, rioPROM_Z - 2.0);
    if (Math.abs(x - rioVOLEI.x) < 7.5 && Math.abs(z - rioVOLEI.z) < 6.5) continue;
    if (Math.abs(x - kx) < 5 && Math.abs(z - kz) < 5) continue;
    const y = rioTerrain(x, z);
    const a = rand(-0.5, 0.5);
    M.box(x, y + 0.025, z, 2.0, 0.05, 1.15, TOWEL[randInt(0, TOWEL.length - 1)], 0, a, 0);
    // two thirds of them have somebody on them, sitting up and facing the sea,
    // and the empty third is somebody who is in the water
    if (Math.random() < 0.66) rioAddPerson(x, y, z + 0.15, Math.PI + a, rioPPL_SIT);
    else {
      // a pair of flip-flops and a bottle, because that is what an empty towel
      // on that beach has on it
      M.box(x + 0.75, y + 0.06, z + 0.4, 0.24, 0.05, 0.58, PALETTE.rioPaveDark, 0, a, 0);
      M.box(x + 1.0, y + 0.06, z + 0.4, 0.24, 0.05, 0.58, PALETTE.rioPaveDark, 0, a, 0);
      M.cyl(x - 0.8, y + 0.16, z + 0.3, 0.09, 0.32, PALETTE.rioTileGreen, 0, 0, 0, 6);
    }
  }
  // and a line of people standing in the shallows, which is where everybody on
  // Copacabana actually is
  for (let i = 0; i < 16; i++) {
    const x = rand(-84, 84);
    const z = rioSHORE_Z + rand(-1.0, 2.6);
    rioAddPerson(x, rioTerrain(x, z), z, rand(-0.7, 0.7) + Math.PI, rioPPL_STAND);
  }
  // THE FOUR PEOPLE ROUND THE NET WERE FACING SIDEWAYS AND NOT PLAYING.
  //
  // The net is nine metres long in x and paper-thin in z, so the two sides of
  // this court are +z and -z — and the players were yawed to ±1.57, i.e. both
  // pairs standing side-on to the game. They were also rioPPL_STAND, whose
  // whole motion is keyed to how near the parade is, and the parade is a
  // hundred metres away up the avenue: four people standing perfectly still
  // round a ball, in a chapter that then asks you to head that ball into the
  // Atlantic. See rioUpdateVolei — they play now.
  for (let s = -1; s <= 1; s += 2) {
    for (let k = -1; k <= 1; k += 2) {
      const idx = rioAddPerson(rioVOLEI.x + s * rand(1.6, 3.6), vy,
                               rioVOLEI.z + k * rand(1.9, 3.4),
                               k > 0 ? Math.PI : 0, rioPPL_VOLEI);
      if (idx >= 0) rioVoleiIdx.push(idx);
    }
  }
  // three sandcastles, because a beach with nothing built on it has no children
  for (let i = 0; i < 3; i++) {
    const x = rand(-60, 60), z = rand(rioSHORE_Z + 3, rioSHORE_Z + 7);
    const y = rioTerrain(x, z);
    M.cyl(x, y + 0.16, z, 0.55, 0.32, PALETTE.rioSandDark, 0, 0, 0, 6);
    M.cyl(x, y + 0.42, z, 0.34, 0.30, PALETTE.rioSandDark, 0, 0, 0, 6);
    M.cone(x, y + 0.66, z, 0.30, 0.26, PALETTE.rioSand, 0, 0, 0, 6);
  }

  const mesh = new THREE.Mesh(M.build(), rioVC());
  mesh.castShadow = true; mesh.receiveShadow = true;
  root.add(mesh);
}

/**
 * The biscoito Globo man. A pole hung with bags of the ring-shaped beach
 * biscuit that exists nowhere on earth but this stretch of sand, carried up and
 * down all day. He is three steps from the spawn, on purpose: the contract's
 * pacing rule says open on something the player can do in the first ten seconds
 * without walking anywhere.
 */
function rioBuildGlobo(root) {
  const g = new THREE.Group();
  const y = rioTerrain(rioGLOBO.x, rioGLOBO.z);
  const M = rioMerger();
  // the man
  M.cyl(0, 0.85, 0, 0.22, 1.7, PALETTE.cloth6);
  M.sph(0, 1.88, 0, 0.26, 0.28, 0.26, PALETTE.skin3);
  M.box(0, 2.12, 0, 0.62, 0.07, 0.62, PALETTE.rioTileWhite);      // the sun hat
  // the pole over his shoulder, hung with bags
  M.cyl(0, 2.1, 0.1, 0.045, 2.6, PALETTE.rioPalmTrunk, 0, 0, 1.15);
  for (let i = 0; i < 5; i++) {
    const t = -0.9 + i * 0.45;
    const bx = Math.sin(1.15) * t, by = 2.1 + Math.cos(1.15) * t;
    // a bag of biscuits is a fat translucent-looking sphere of pale rings
    M.sph(bx, by - 0.42, 0.1, 0.24, 0.30, 0.24, PALETTE.rioTileWhite);
    M.sph(bx, by - 0.42, 0.1, 0.19, 0.22, 0.19, PALETTE.bread);
  }
  const mesh = new THREE.Mesh(M.build(), rioVC());
  mesh.castShadow = true;
  g.add(mesh);
  g.position.set(rioGLOBO.x, y, rioGLOBO.z);
  g.rotation.y = rioGloboYaw;
  root.add(g);
  rioGloboGroup = g;
  return g;
}

/** The futevolei ball. The one dynamic body in Rio — everything else is static
 *  or kinematic, which is what keeps the body count inside the budget. */
function rioBuildBall(game, root) {
  const y = rioTerrain(rioVOLEI.x, rioVOLEI.z);
  const geo = new THREE.SphereGeometry(0.34, 8, 6);
  const m = new THREE.Mesh(geo, mat(PALETTE.rioTileYellow, { flatShading: true }));
  m.castShadow = true;
  m.position.set(rioVOLEI.x + 1.4, y + 0.9, rioVOLEI.z + 1.2);
  root.add(m);
  // Copacabana slopes about four degrees down to the water, which is enough to
  // roll a low-friction sphere into the Atlantic entirely on its own — the task
  // would have completed itself about eight seconds after the player arrived.
  // So the ball is heavily damped and goes to sleep quickly: it sits on the sand
  // like a real one until something barges it, and a barge easily wakes it.
  const b = new CANNON.Body({
    mass: 0.9,
    material: (game.mats && game.mats.prop) || undefined,
    linearDamping: 0.45,
    angularDamping: 0.62,
  });
  b.addShape(new CANNON.Sphere(0.34));
  b.position.set(rioVOLEI.x + 1.4, y + 0.9, rioVOLEI.z + 1.2);
  b.allowSleep = true;
  b.sleepSpeedLimit = 0.55;
  b.sleepTimeLimit = 0.4;
  rioSyncBody(b);
  game.world.addBody(b);
  rioBallMesh = m;
  rioBallBody = b;
}

// ================================================================ THE SET =====
// THE MINI, and the one thing everybody who has ever been to that beach did
// before they did anything else.
//
// It is built out of a hook that already existed and cost nothing: a biome may
// publish flow(x, z), which capybara.js folds into platVX/platVZ for a SWIMMING
// animal — the same reference-frame channel the ferry's deck, the Drift's air
// and the Uji's current all use. A wave is therefore not a force, not a
// velocity write and not a new verb. It is a moving patch of water that is
// itself going somewhere, and the animal swims its own honest 2.6 m/s inside
// it. Everything that makes the ride feel right falls out of that: you can
// steer along the face, you can swim out of the back of it, and the moment it
// passes you your world velocity is continuous.
//
// Sets of three, because that is how sets come, and a long flat wait between
// them, because that is what waiting for a wave is.
const rioWAVE_X = rioARPOADOR.x + 26;   // the break sits off the point, not on it
const rioWAVE_HX = 34;                  // how wide the peak is
const rioWAVE_Z0 = rioSHORE_Z - 62;     // where it stands up
const rioWAVE_Z1 = rioSHORE_Z + 1.5;    // and where it closes out on the sand
const rioWAVE_SPD = 5.6;                // m/s shoreward
// THE WATER IN THE BAND HAS TO GO AT ABOUT THE SPEED OF THE WAVE.
//
// The first cut pushed 7.4 m/s through a 4.2 m band behind a crest doing 5.6,
// which means the animal outran the wave, fell out of the front of the band in
// under a second, and was carried a measured seventeen metres at best. A wave
// you can beat is a shove.
//
// So the push is the CREST SPEED plus a couple, tapered to nothing at both
// edges of a wider band. That makes the equilibrium do the work: too far
// forward and the taper drops the water below the crest speed and the wave
// catches you up; too far back and it is faster than the crest and you are
// pushed on to the face. The animal sits in the pocket and gets carried for as
// long as the wave lasts, which is what surfing IS, and there is no code in
// here that says so.
const rioWAVE_B0 = -2.0;                // m of band behind the crest (seaward)
const rioWAVE_B1 = 5.5;                 // and shoreward of it
const rioWAVE_PEAK = 0.8;               // where in the band the pocket sits
const rioWAVE_PUSH = rioWAVE_SPD + 2.2; // m/s at the peak of the band
const rioWAVE_LIFT = 1.70;              // m the sea surface itself stands up
const rioFoamCol = new THREE.Color(PALETTE.rioSeaFoam);
const rioWAVE_GAP = 4.6;                // s between the three of a set
const rioWAVE_SET = 26.0;               // s between sets
const rioWAVE_RIDE = 20.0;              // m carried that count as 'took one in'
let rioWaveZ = [rioWAVE_Z1, rioWAVE_Z1, rioWAVE_Z1];   // -1e9 = not running
let rioWaveNext = 6.0;
let rioWaveIn = 0;                      // how many of this set are still to launch
let rioWaveMesh = null;
let rioWaveRide = 0;                    // m carried on the wave under the animal
let rioWaveFrom = 1e9;                  // z the current ride started at
let rioWaveBest = 0;
let rioWaveDone = false;
let rioWaveSurf = 0;
const rioWaveFlow = { x: 0, z: 0 };
const rioWaveV3 = new THREE.Vector3();

/** How far the SEA ITSELF stands up at (x, z), in metres. */
function rioWaveLift(x, z) {
  let y = 0;
  const dx = Math.abs(x - rioWAVE_X);
  if (dx > rioWAVE_HX + 14) return 0;
  const across = rioWaveAcross(x);
  if (across <= 0) return 0;
  for (let i = 0; i < 3; i++) {
    const wz = rioWaveZ[i];
    if (wz < -1e8) continue;
    const d = z - (wz + rioWaveBow(x));
    if (d < -7.5 || d > 5.5) continue;
    // asymmetric: a long back and a short steep face, which is what a swell
    // standing up on a reef actually looks like from the side
    const t = d < 0 ? 1 + d / 7.5 : 1 - d / 5.5;
    y += rioWAVE_LIFT * across * rioWaveAmp(wz) * t * t * (3 - 2 * t);
  }
  return y;
}
/** 0..1 across the peak — the shape of the break, in x. */
function rioWaveAcross(x) {
  const u = (x - rioWAVE_X) / (rioWAVE_HX + 8);
  if (u < -1 || u > 1) return 0;
  return Math.pow(Math.cos(clamp((u - 0.06) * 0.94, -1, 1) * Math.PI * 0.5), 1.35);
}
/** The bow in the line: shallows refract a swell, so it arrives curved. */
function rioWaveBow(x) {
  const u = (x - rioWAVE_X) / (rioWAVE_HX + 8);
  // TEN, NOT FIVE. Over eighty-four metres of line a five-metre bow is half a
  // degree of curvature and the shot shows a straight bar; the reason a swell
  // arrives curved is that it has been refracting over a shallow reef for a
  // hundred metres, and that is not a subtle effect.
  return -u * u * 10.0;
}

function rioBuildWaves(root) {
  // THE WAVE IS THE SEA. FOAM IS WHAT YOU DRAW ON TOP OF IT.
  //
  // rio.js already deforms its sea every 33 ms and rioWaveLift is folded into
  // that sum, so the SURFACE genuinely rises. This mesh is the separate object
  // riding on the lift: the lip, the curl thrown off it, and the whitewater
  // behind.
  //
  // ================== FOUR ATTEMPTS, AND THE FIRST THREE WERE ALL BOXES ======
  //
  // Four boxes: a dead-straight white board seventy metres long. Eighteen
  // segmented boxes: a crenellated sea wall with visible joints. Thirty-eight
  // jittered boxes, which is what shipped: the instrumented shot from off
  // Arpoador is a line of LOOSE WHITE PAVING SLABS lying on the water, and the
  // set behind it is a dashed line of them. The note above that cut says a lip
  // is ragged or it is a plank, and it was right about the diagnosis and wrong
  // about the cure — because the thing that makes thirty-eight independent
  // boxes read as thirty-eight boxes is not that they are too regular, it is
  // that THEY DO NOT TOUCH. Each one carried its own z jitter of up to 0.7 m
  // and its own lean, so consecutive pieces of one continuous object stood at
  // different heights, at different angles, with sea between them.
  //
  // A breaking wave is a RIBBON. So this is one: a profile of seven points —
  // the tail of the soup, the whitewater, the back of the face, the crest, the
  // lip thrown forward, the fall under it, and the foot — lofted along
  // fifty-six stations across the break. Consecutive stations SHARE their
  // edge, so the thing is continuous by construction and cannot come apart;
  // the raggedness comes from moving the profile per station rather than from
  // moving whole pieces of it.
  //
  // It is also a fifth of the cost. Thirty-eight boxes with a curl and two
  // strips of soup on each is 1 620 triangles a wave; this is 672, and it is
  // built unindexed so every facet keeps its own normal — a smoothed wave is a
  // beach ball.
  const SEG = 56;
  const W = (rioWAVE_HX + 8) * 2;
  const pos = [], col = [];
  const foam = new THREE.Color(PALETTE.rioSeaFoam);
  const soup = new THREE.Color(PALETTE.foam);
  const sea = new THREE.Color(PALETTE.rioSea);
  const cA = new THREE.Color(), cB = new THREE.Color();
  // the profile, seaward to shoreward: [dz, height as a fraction of the crest,
  // colour mix 0 = sea, 1 = foam]
  // THE FOAM HAS TO SIT ON THE WATER THE WAVE HAS ALREADY LIFTED.
  //
  // The first ribbon put its whitewater at two to five centimetres over
  // rioSEA_Y — and rioWaveLift raises the SEA ITSELF by up to 1.7 m over a
  // seven-and-a-half metre back, so every part of this mesh behind the crest
  // was underneath the surface it is supposed to be lying on, and the crest
  // itself was exactly level with the water rather than standing proud of it.
  // The shot came back as a flat white pad on a swell instead of as a wave.
  // The profile follows the sea's own back curve now and rides 16 % over it.
  //
  // And it CURLS: the fifth and sixth points go forward to the lip tip and then
  // BACK under it, which a lofted ribbon is perfectly happy to do and which is
  // the one shape that says "breaking" rather than "foamy".
  const PROF = [
    [-10.5, 0.020, 0.00],
    [-6.50, 0.150, 0.26],
    [-3.60, 0.600, 0.52],
    [-1.60, 0.920, 0.80],
    [0.000, 1.160, 1.00],
    [1.150, 1.090, 1.00],
    // THE INSIDE OF THE CURL IS NOT WHITE. This point is behind the lip, so it
    // is the only face in the whole mesh the camera sees from UNDERNEATH — and
    // white geometry lit from below by a sand-coloured ground bounce comes back
    // khaki, which put a brown seam along eighty metres of surf. It is the
    // green-blue you actually see through the back of a wave.
    [0.780, 0.700, 0.38],
    [1.700, 0.300, 0.70],
    [2.900, 0.050, 0.26],
  ];
  const NP = PROF.length;
  // one station's worth of geometry, so consecutive stations can be stitched
  const sx = new Float32Array(2), sy = new Float32Array(NP * 2), sz = new Float32Array(NP * 2);
  const sc = new Float32Array(NP * 2 * 3);
  const station = (i, slot) => {
    const u = i / SEG;
    const x = -W * 0.5 + W * u;
    const k = rioWaveAcross(rioWAVE_X + (u - 0.5) * W);
    const zz = rioWaveBow(rioWAVE_X + (u - 0.5) * W);
    // a deterministic ripple down the length of the lip. The mesh is built once
    // and instanced three times, so every wave in every set breaks over the same
    // reef with the same feathering, which is what a real set does.
    const h1 = Math.sin(u * 41.0) * 0.5 + 0.5;
    const h2 = Math.sin(u * 23.7 + 2.1) * 0.5 + 0.5;
    const h3 = Math.sin(u * 13.3 + 4.4) * 0.5 + 0.5;
    const edge = clamp(1 - Math.abs(u - 0.5) * 2.28, 0, 1);
    const kk = clamp(k, 0, 1) * (0.42 + 0.58 * edge * edge);
    const H = rioWAVE_LIFT * kk * (0.78 + h1 * 0.44);
    // the whole profile leans shoreward where the wave is standing up hardest,
    // which is what peeling looks like from the beach
    const throwF = 0.5 + kk * 1.15;
    sx[slot] = x;
    for (let q = 0; q < NP; q++) {
      const o = slot * NP + q;
      const dz = PROF[q][0] * (PROF[q][0] > 0 ? throwF : 1 + h2 * 0.55)
               + (q >= 4 ? h3 * 0.45 : -h2 * 0.5);
      sz[o] = zz + dz;
      sy[o] = H * PROF[q][1] * (q === 5 ? 1 + h2 * 0.14 : 1) + 0.10;
      const mix = PROF[q][2] * (0.45 + 0.55 * clamp(kk * 2.2, 0, 1));
      cA.copy(sea).lerp(q >= 4 ? foam : soup, clamp(mix, 0, 1));
      sc[o * 3] = cA.r; sc[o * 3 + 1] = cA.g; sc[o * 3 + 2] = cA.b;
    }
  };
  const push = (slot, q) => {
    const o = slot * NP + q;
    pos.push(sx[slot], sy[o], sz[o]);
    col.push(sc[o * 3], sc[o * 3 + 1], sc[o * 3 + 2]);
  };
  station(0, 0);
  for (let i = 1; i <= SEG; i++) {
    station(i, 1);
    for (let q = 0; q < NP - 1; q++) {
      // two triangles per quad, unindexed, so each facet keeps its own normal
      push(0, q); push(1, q); push(1, q + 1);
      push(0, q); push(1, q + 1); push(0, q + 1);
    }
    // carry this station forward as the next one's left edge
    sx[0] = sx[1];
    for (let q = 0; q < NP; q++) {
      sy[q] = sy[NP + q]; sz[q] = sz[NP + q];
      sc[q * 3] = sc[(NP + q) * 3]; sc[q * 3 + 1] = sc[(NP + q) * 3 + 1];
      sc[q * 3 + 2] = sc[(NP + q) * 3 + 2];
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  cB.copy(foam);
  rioWaveMesh = new THREE.InstancedMesh(geo, mat(PALETTE.foam, {
    vertexColors: true, transparent: true, opacity: 0.94,
    // A RIBBON HAS NO BACK. The crest stands 1.7 m out of the water and you
    // swim up behind it to catch it, so half the time the camera is looking at
    // the inside of the face; single-sided, the wave vanishes as you reach it.
    side: THREE.DoubleSide,
  }), 3);
  rioWaveMesh.castShadow = false;
  rioWaveMesh.receiveShadow = false;
  rioWaveMesh.frustumCulled = false;
  rioWaveMesh.name = 'rioSet';
  root.add(rioWaveMesh);
}

/**
 * How much wave there is, 0..1, along its life from standing up to closing out.
 *
 * IT MUST HOLD. The first cut was a single sine over the whole run, which is a
 * pretty curve and is wrong about the thing that matters: it fell below the
 * crest's own speed a third of the way in, so the water stopped outrunning the
 * wave, the animal slid off the back, and the longest ride available was
 * eighteen metres against a twenty-metre task. A wave stands up over a few
 * metres, holds all the way in, and only lets go on the sand — the whitewater
 * is still shoving you when your feet touch. So: rise, hold, close.
 */
function rioWaveAmp(z) {
  const u = clamp((z - rioWAVE_Z0) / (rioWAVE_Z1 - rioWAVE_Z0), 0, 1);
  const up = clamp(u / 0.16, 0, 1);
  const dn = clamp((1 - u) / 0.10, 0, 1);
  return Math.min(up * up * (3 - 2 * up), dn * dn * (3 - 2 * dn));
}

/**
 * THE VELOCITY OF THE WATER at (x, z). Published as flow() — see the note above
 * and capyFlowAt() in capybara.js.
 */
function rioFlow(x, z) {
  rioWaveFlow.x = 0; rioWaveFlow.z = 0;
  const dx = Math.abs(x - rioWAVE_X);
  if (dx > rioWAVE_HX + 10) return rioWaveFlow;
  for (let i = 0; i < 3; i++) {
    const wz = rioWaveZ[i];
    if (wz < -1e8) continue;
    // THE PUSH HAS TO BE BOWED, BECAUSE THE WAVE IS.
    //
    // `rioWaveLift` and the foam mesh both put the crest at `wz + rioWaveBow(x)`
    // and this line did not — so at the shoulders of an eighty-four metre break,
    // where the bow is ten metres, the water that carries you was ten metres out
    // of register with the wave you can see. You sat in a pocket that was not
    // under the crest, or you sat under the crest and nothing happened.
    const d = z - (wz + rioWaveBow(x));
    // The push lives just SHOREWARD of the crest, which is where the water in a
    // breaking wave actually is: sit behind it and it goes past you.
    if (d < rioWAVE_B0 || d > rioWAVE_B1) continue;
    const across = clamp(1 - Math.max(0, dx - rioWAVE_HX) / 10, 0, 1);
    const along = d < rioWAVE_PEAK
      ? clamp((d - rioWAVE_B0) / (rioWAVE_PEAK - rioWAVE_B0), 0, 1)
      : clamp((rioWAVE_B1 - d) / (rioWAVE_B1 - rioWAVE_PEAK), 0, 1);
    const k = along * across * rioWaveAmp(wz);
    if (k > 0) rioWaveFlow.z += rioWAVE_PUSH * k;
  }
  return rioWaveFlow;
}

function rioUpdateWaves(game, dt) {
  if (!rioWaveMesh) return;
  // ---- the set --------------------------------------------------------
  rioWaveNext -= dt;
  if (rioWaveNext <= 0) {
    if (rioWaveIn <= 0) rioWaveIn = 3;
    let slot = -1;
    for (let i = 0; i < 3; i++) if (rioWaveZ[i] < -1e8) { slot = i; break; }
    if (slot >= 0) {
      rioWaveZ[slot] = rioWAVE_Z0;
      rioWaveIn--;
      rioWaveNext = rioWaveIn > 0 ? rioWAVE_GAP : rioWAVE_SET;
    } else {
      rioWaveNext = 1.0;
    }
  }
  for (let i = 0; i < 3; i++) {
    if (rioWaveZ[i] < -1e8) continue;
    rioWaveZ[i] += rioWAVE_SPD * dt;
    if (rioWaveZ[i] > rioWAVE_Z1) rioWaveZ[i] = -1e9;
  }
  // ---- draw -----------------------------------------------------------
  for (let i = 0; i < 3; i++) {
    const wz = rioWaveZ[i];
    const a = wz < -1e8 ? 0 : rioWaveAmp(wz);
    rioWaveMesh.setMatrixAt(i, rioXform(rioWAVE_X, rioSEA_Y + 0.02, wz < -1e8 ? 400 : wz,
                                        0, 0, 0, 1, Math.max(0.001, a), 1));
  }
  rioWaveMesh.instanceMatrix.needsUpdate = true;

  // ---- the ride -------------------------------------------------------
  const capy = game.capy;
  const cp = capy && capy.position;
  if (!cp) return;
  const f = rioFlow(cp.x, cp.z);
  const on = f.z > 2.5 && rioIsOverWater(cp.x, cp.z) && capy.wet > 0.35;
  if (on) {
    // GROUND COVERED, not water gone past. They are close on a wave and they
    // are not the same number, and the one the player would count is this one.
    if (rioWaveFrom > 8e8) rioWaveFrom = cp.z;
    rioWaveRide = Math.max(0, cp.z - rioWaveFrom);
    if (rioWaveRide > rioWaveBest) rioWaveBest = rioWaveRide;
    if (rioWaveSurf <= 0 && game.sfx) game.sfx('splash', { volume: 0.55, pitch: 1.25 });
    rioWaveSurf = 0.55;
    if (!rioWaveDone && rioWaveRide >= rioWAVE_RIDE) {
      rioWaveDone = true;
      if (game.record) game.record('take-a-wave', rioWaveBest);
      rioTask('take-a-wave');
    }
    // ---- AND THE ROCK IS WATCHING (v26) --------------------------------
    // `surfing()` and `riding()` had ZERO readers in the entire repo: no
    // camera, no line, no grade, no score, nothing. The chapter's signature
    // verb was a splash and a number — the `vanRiding()` shape exactly.
    //
    // The reader is already drawn and already written: `rioClap` puts the
    // twenty-two people on Arpoador rock up off their heels, and it existed
    // for one other task. A long ride is the most watchable thing that happens
    // on this beach and they were sitting through it. Topped up rather than
    // set, so it holds for the whole ride and falls away on its own.
    if (rioWaveRide > 12) rioClap = Math.max(rioClap, 2.4);
  } else if (rioWaveRide > 0 || rioWaveFrom < 8e8) {
    // Fall off the back of one and the count goes with it — a ride is one wave.
    if (game.record && rioWaveBest > 4) game.record('take-a-wave', rioWaveBest);
    rioWaveRide = 0;
    rioWaveFrom = 1e9;
  }
  if (rioWaveSurf > 0) {
    rioWaveSurf -= dt;
    if (game.shake) game.shake(0.02);
  }
}
// =============================================================== ARPOADOR ====
/**
 * The rock at the end of the sand where Copacabana becomes Ipanema. Cariocas
 * climb it at six in the evening and APPLAUD the sunset, every single day, and
 * have done for decades. It is the last thing on the list for that reason, and
 * it is also the way out of the chapter: it is the one place in the biome that
 * points at open ocean.
 */
function rioBuildArpoador(game, root) {
  const M = rioMerger();
  const cx = rioARPOADOR.x, cz = rioARPOADOR.z;
  // a tumble of boulders sitting on the dome the terrain already provides
  for (let i = 0; i < 22; i++) {
    const a = rand(0, 6.28), r = rand(0, rioARPOADOR.r * 0.85);
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    const y = rioTerrain(x, z);
    const s = rand(1.1, 3.0);
    M.sph(x - cx, y - rioTerrain(cx, cz) + s * 0.25, z - cz, s, s * rand(0.45, 0.7), s * rand(0.8, 1.2),
      i % 3 ? PALETTE.rioGranite : PALETTE.rioGraniteDk);
  }
  const mesh = new THREE.Mesh(M.build(), rioVC());
  mesh.position.set(cx, rioTerrain(cx, cz), cz);
  mesh.castShadow = true; mesh.receiveShadow = true;
  root.add(mesh);

  // The people already up there, waiting for it. They used to be sixteen
  // identical white boxes with no heads and no motion, in a chapter whose own
  // toast says "the whole rock is clapping" — see rioUpdatePeople, where they
  // now do.
  for (let i = 0; i < 22; i++) {
    const a = rand(0, 6.28), r = rand(2, rioARPOADOR.r * 0.62);
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    // everybody up here is looking the same way, because there is only one
    // thing to look at and it goes down over Dois Irmãos every single evening
    rioAddPerson(x, rioTerrain(x, z), z, -1.57 + rand(-0.35, 0.35), rioPPL_ROCK);
  }
}

// ========================================================= PAO DE ACUCAR ====
/**
 * Sugarloaf, the cable car out to it, and the halfway hill at Urca. The
 * bondinho has run since 1912 and it is the reason anybody knows what this rock
 * looks like, so the cars are modelled and they actually run.
 *
 * The cabin is KINEMATIC and driven by hand along the cable. Contract rules
 * apply: every write of body.position is followed by the previous/interpolated
 * copy, or it smears.
 */
function rioBuildSugarloaf(game, root) {
  const M = rioMerger();

  // --- the two stations
  // The platform stops level with the cabin floor (the cable runs at
  // terrain + rioCABLE_CLEAR and the car hangs 2.6 under it), so the player
  // walks aboard instead of having to climb the car.
  const DECK = rioCABLE_CLEAR - 2.6;
  const stY = rioTerrain(rioSTATION.x, rioSTATION.z);
  M.box(rioSTATION.x, stY + DECK * 0.5, rioSTATION.z, 9.0, DECK, 7.0, PALETTE.rioWall1);
  M.box(rioSTATION.x, stY + DECK + 0.18, rioSTATION.z, 9.6, 0.36, 7.6, PALETTE.rioArch);
  rioStaticBox(game, rioSTATION.x, stY + DECK * 0.5, rioSTATION.z, 9.0, DECK, 7.0, 0);

  // A STAIR UP TO THE PLATFORM. The comment above says the player "walks
  // aboard instead of having to climb the car" — but the deck stands 6.4 m
  // over the sand, the sea-wall clamber tops out three metres short of it and
  // the step assist is switched off while swimming, so there was no way onto
  // this platform from anywhere in the biome and 'bondinho' could not be
  // completed at all. Six treads from the beach to the deck.
  for (let k = 0; k < 6; k++) {
    const zz = rioSTATION.z + 4.4 + k * 1.7;
    const yy = stY + DECK * (1 - k / 6);
    M.box(rioSTATION.x, yy - 0.15, zz, 4.0, 0.3, 1.7, PALETTE.rioArch);
    rioStaticBox(game, rioSTATION.x, yy - 0.15, zz, 4.0, 0.3, 1.7, 0);
  }

  const uY = rioTerrain(rioURCA.x, rioURCA.z);
  M.box(rioURCA.x, uY + DECK * 0.5, rioURCA.z, 8.0, DECK, 6.4, PALETTE.rioWall1);
  M.box(rioURCA.x, uY + DECK + 0.16, rioURCA.z, 8.6, 0.32, 7.0, PALETTE.rioArch);
  // and the two summit platforms are SOLID. Only the bottom one had a collider,
  // so stepping off the cabin at the top — the payoff of the task — dropped the
  // animal six metres through the concrete onto the rock.
  rioStaticBox(game, rioURCA.x, uY + DECK * 0.5, rioURCA.z, 8.0, DECK, 6.4, 0);

  const gY = rioTerrain(rioSUGAR.x, rioSUGAR.z);
  M.box(rioSUGAR.x, gY + DECK * 0.5, rioSUGAR.z, 8.4, DECK, 6.4, PALETTE.rioWall1);
  M.box(rioSUGAR.x, gY + DECK + 0.16, rioSUGAR.z, 9.0, 0.32, 7.0, PALETTE.rioArch);
  rioStaticBox(game, rioSUGAR.x, gY + DECK * 0.5, rioSUGAR.z, 8.4, DECK, 6.4, 0);

  // a mast on the summit, because there is one
  M.cyl(rioSUGAR.x + 7, gY + 6, rioSUGAR.z - 5, 0.2, 12, PALETTE.metal);

  // --- the cable. Two spans: station -> Urca -> summit.
  rioCableSpan(M, rioSTATION.x, stY + rioCABLE_CLEAR, rioSTATION.z,
                  rioURCA.x, uY + rioCABLE_CLEAR, rioURCA.z);
  rioCableSpan(M, rioURCA.x, uY + rioCABLE_CLEAR, rioURCA.z,
                  rioSUGAR.x, gY + rioCABLE_CLEAR, rioSUGAR.z);
  rioCableTowers(M, rioSTATION.x, stY + rioCABLE_CLEAR, rioSTATION.z,
                    rioURCA.x, uY + rioCABLE_CLEAR, rioURCA.z);
  rioCableTowers(M, rioURCA.x, uY + rioCABLE_CLEAR, rioURCA.z,
                    rioSUGAR.x, gY + rioCABLE_CLEAR, rioSUGAR.z);
  rioStationLegs(M, rioSTATION.x, rioSTATION.z, 4.5, 3.5, stY + DECK);
  rioStationLegs(M, rioURCA.x, rioURCA.z, 4.0, 3.2, uY + DECK);
  rioStationLegs(M, rioSUGAR.x, rioSUGAR.z, 4.2, 3.2, gY + DECK);
  // a roof over each platform, because the one thing you notice standing on one
  // of these is that it is a shed with a hole in the end of it
  for (const st of [[rioSTATION.x, rioSTATION.z, stY], [rioURCA.x, rioURCA.z, uY],
                    [rioSUGAR.x, rioSUGAR.z, gY]]) {
    // ABOVE THE WIRE. The cable runs at terrain + rioCABLE_CLEAR and the car
    // hangs 2.6 under it with its bogie 2.7 over its own floor, so a canopy at
    // deck + 3.6 is exactly where the bogie goes through. Deck + 5.6 clears it.
    M.box(st[0], st[2] + DECK + 5.6, st[1], 9.6, 0.35, 7.6, PALETTE.rioRoof);
    M.box(st[0], st[2] + DECK + 5.95, st[1], 4.0, 0.35, 8.0, PALETTE.rioRoofDark);
    for (let sx = -1; sx <= 1; sx += 2) {
      for (let sz = -1; sz <= 1; sz += 2) {
        M.cyl(st[0] + sx * 4.3, st[2] + DECK + 2.8, st[1] + sz * 3.4, 0.14, 5.6,
              PALETTE.rioTramDk);
      }
    }
  }

  const mesh = new THREE.Mesh(M.build(), rioVC());
  mesh.castShadow = true; mesh.receiveShadow = true;
  root.add(mesh);

  // --- the cabin itself
  const cg = new THREE.Group();
  const CM = rioMerger();
  CM.box(0, 0, 0, 2.6, 1.05, 2.6, PALETTE.rioWall3);
  CM.box(0, 1.15, 0, 2.8, 0.14, 2.8, PALETTE.rioArch);
  CM.box(0, -1.15, 0, 2.8, 0.14, 2.8, PALETTE.rioArch);          // the floor you stand on
  CM.cyl(0, 1.9, 0, 0.09, 1.6, PALETTE.metal);
  CM.box(0, 2.7, 0, 0.7, 0.22, 0.35, PALETTE.rioGraniteDk);      // the bogie on the cable
  // ---- AND THE INSIDE OF IT ---------------------------------------------
  // The bondinho's cars are almost entirely GLASS with a red band round the
  // waist, and the whole reason anybody gets in one is that you can see out of
  // the floor. Four corner posts, a rail, and the strap everybody holds.
  for (let sx = -1; sx <= 1; sx += 2) {
    for (let sz = -1; sz <= 1; sz += 2) {
      CM.box(sx * 1.28, 0, sz * 1.28, 0.13, 2.2, 0.13, PALETTE.rioTramDk);
    }
  }
  for (let sz = -1; sz <= 1; sz += 2) {
    CM.box(0, -0.55, sz * 1.3, 2.6, 0.09, 0.09, PALETTE.rioTram);
    CM.box(0, -0.68, sz * 1.3, 2.6, 0.28, 0.06, PALETTE.rioDrumShell);   // the band
  }
  for (let sx = -1; sx <= 1; sx += 2) {
    CM.box(sx * 1.3, -0.55, 0, 0.09, 0.09, 2.6, PALETTE.rioTram);
    CM.box(sx * 1.3, -0.68, 0, 0.06, 0.28, 2.6, PALETTE.rioDrumShell);
  }
  for (let i = -1; i <= 1; i++) {
    CM.cyl(i * 0.72, 0.62, 0, 0.03, 0.9, PALETTE.rioTramDk);
    CM.box(i * 0.72, 0.14, 0, 0.20, 0.05, 0.16, PALETTE.rioTramWood);
  }
  const cm = new THREE.Mesh(CM.build(), rioVC());
  cm.castShadow = true;
  cg.add(cm);
  root.add(cg);
  rioCabinGroup = cg;

  // The body is a thin slab under the cabin floor: the capybara rides on TOP of
  // it, and a full box would trap the animal inside the car.
  const b = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC,
    material: (game.mats && game.mats.ground) || undefined });
  b.addShape(new CANNON.Box(new CANNON.Vec3(1.4, 0.16, 1.4)));
  rioCablePoint(0, rioV3);
  b.position.set(rioV3.x, rioV3.y - 2.6, rioV3.z);
  // It must never sleep. Its velocity is deliberately zero (see rioUpdateCabin),
  // and a kinematic body that is not moving is exactly what cannon's sleep
  // heuristic is looking for — once asleep it is skipped in narrowphase, the
  // floor of the car silently stops existing, and the capybara drops through it
  // into the bay while the empty cabin carries on up the mountain.
  b.allowSleep = false;
  rioSyncBody(b);
  game.world.addBody(b);
  rioCabinBody = b;
  rioCabinPX = b.position.x; rioCabinPY = b.position.y; rioCabinPZ = b.position.z;
}

/**
 * A point on one span, at 0..1 along it.
 *
 * A straight line between two station heights does NOT clear the ground here:
 * both spans pass over rising granite (the first over Morro da Urca's shoulder,
 * the second up Sugarloaf's flank), and the naive lerp-minus-sag put the car
 * six metres INSIDE the mountain. A rider was then scraped off the floor
 * halfway up and left standing on the hill watching the cabin leave.
 *
 * So the span is lifted to clear the terrain — but weighted by the same arc as
 * the sag, so it is untouched at both ends and the car still meets its stations
 * exactly. That is also just what a cable car does.
 */
function rioSpanPoint(x0, y0, z0, x1, y1, z1, s, out) {
  const x = lerp(x0, x1, s), z = lerp(z0, z1, s);
  let y = lerp(y0, y1, s) - 3.2 * Math.sin(s * Math.PI);
  // A hard floor, not a tapered one. Tapering the lift to nothing at the ends
  // reopened the gap immediately after the Urca junction, where the span starts
  // climbing Sugarloaf at once but the taper has not come in yet. Because every
  // station height is itself defined as terrain + rioCABLE_CLEAR, the floor is
  // exactly equal to the curve at both ends and never lifts it off its towers.
  const need = rioTerrain(x, z) + rioCABLE_CLEAR;
  if (y < need) y = need;
  return out.set(x, y, z);
}

/**
 * A STATION IS A BUILDING, NOT A BOX BALANCED ON A HILL.
 *
 * Each of the three was one slab centred on the summit's own height, and a
 * summit is the one place on a dome where the ground falls away in every
 * direction — so the instrumented shot up the flank of Morro da Urca is two
 * pale boxes hanging clear in the air with sky under them. Four legs, sampled
 * on the real ground under each corner, and a valance to close the gap.
 */
function rioStationLegs(M, cx, cz, hw, hd, topY) {
  for (let sx = -1; sx <= 1; sx += 2) {
    for (let sz = -1; sz <= 1; sz += 2) {
      const lx = cx + sx * (hw - 0.6), lz = cz + sz * (hd - 0.6);
      const gyl = rioTerrain(lx, lz);
      const h = Math.max(0.4, topY - gyl);
      M.box(lx, gyl + h * 0.5, lz, 1.1, h, 1.1, PALETTE.rioGraniteDk);
    }
  }
  // the valance between them, so the underside is not four sticks and daylight
  for (let sz = -1; sz <= 1; sz += 2) {
    const gyl = rioTerrain(cx, cz + sz * hd);
    const h = Math.max(0.4, topY - gyl);
    M.box(cx, topY - h * 0.32, cz + sz * hd, hw * 2 - 0.4, h * 0.62, 0.30, PALETTE.rioArchShade);
  }
}

/**
 * THE CABLE HUNG ON NOTHING.
 *
 * Two spans, seven hundred metres of wire drawn as a chain of five-centimetre
 * cylinders, and not one tower under it: the instrumented shot from the bay is
 * a hairline crossing the sky with two boxes on it. The bondinho's towers are
 * the reason anybody knows what it looks like, and they are also the only thing
 * that gives that stretch of open water a scale.
 */
function rioCableTowers(M, x0, y0, z0, x1, y1, z1) {
  for (let t = 1; t <= 3; t++) {
    const u = t / 4;
    rioSpanPoint(x0, y0, z0, x1, y1, z1, u, rioV3);
    const tx = rioV3.x, ty = rioV3.y, tz = rioV3.z;
    const gyl = rioTerrain(tx, tz);
    // over open water there is nothing to stand a tower on, and the real line
    // does not have one there either
    if (ty - gyl > 34 || gyl < 0.5) continue;
    const h = ty - gyl + 1.2;
    // a lattice mast: four legs battered in toward the top, with cross bracing
    for (let sx = -1; sx <= 1; sx += 2) {
      for (let sz = -1; sz <= 1; sz += 2) {
        const lean = Math.atan2(1.5, h);
        M.cyl(tx + sx * 0.9, gyl + h * 0.5, tz + sz * 0.9, 0.13, h + 0.4,
              PALETTE.rioGraniteDk, sz * lean, 0, -sx * lean);
      }
    }
    for (let q = 1; q <= 4; q++) {
      const by = gyl + h * (q / 5);
      const bw = 3.0 * (1 - q / 6.5);
      M.box(tx, by, tz, bw, 0.16, bw, PALETTE.rioGraniteDk);
    }
    // and the cross-head the sheaves hang off
    M.box(tx, gyl + h + 0.35, tz, 3.6, 0.34, 0.5, PALETTE.rioTramDk);
    for (let sx = -1; sx <= 1; sx += 2) {
      M.cyl(tx + sx * 1.3, gyl + h + 0.05, tz, 0.30, 0.22, PALETTE.rioTram, 0, 0, 1.5708, 8);
    }
  }
}

/** The cable itself, drawn as a chain of short cylinders along the same curve
 *  the car flies — if these two ever disagree the car leaves its own wire. */
function rioCableSpan(M, x0, y0, z0, x1, y1, z1) {
  const N = 16;
  let px = x0, py = y0, pz = z0;
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    rioSpanPoint(x0, y0, z0, x1, y1, z1, t, rioV3);
    const x = rioV3.x, y = rioV3.y, z = rioV3.z;
    const dx = x - px, dy = y - py, dz = z - pz;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const mx = (x + px) * 0.5, my = (y + py) * 0.5, mz = (z + pz) * 0.5;
    // aim the cylinder down the segment
    const ry = Math.atan2(dx, dz);
    const rx = Math.atan2(Math.sqrt(dx * dx + dz * dz), dy);
    M.cyl(mx, my, mz, 0.05, len, PALETTE.rioGraniteDk, rx, ry, 0, 4);
    px = x; py = y; pz = z;
  }
}

/** Where the cabin is at t in 0..1 along the whole run, station -> summit. */
function rioCablePoint(t, out) {
  const stY = rioTerrain(rioSTATION.x, rioSTATION.z) + rioCABLE_CLEAR;
  const uY = rioTerrain(rioURCA.x, rioURCA.z) + rioCABLE_CLEAR;
  const gY = rioTerrain(rioSUGAR.x, rioSUGAR.z) + rioCABLE_CLEAR;
  if (t < 0.5) {
    return rioSpanPoint(rioSTATION.x, stY, rioSTATION.z,
                        rioURCA.x, uY, rioURCA.z, t / 0.5, out);
  }
  return rioSpanPoint(rioURCA.x, uY, rioURCA.z,
                      rioSUGAR.x, gY, rioSUGAR.z, (t - 0.5) / 0.5, out);
}

// ============================================================== CORCOVADO ====
/**
 * Cristo Redentor. Deliberately DECOR and nothing else — Cali already ends on a
 * climb up to a Christ statue on a ridge, and doing it twice would make the two
 * chapters rhyme in the one way they must not. Here he is only ever a
 * silhouette on the skyline, which is how he actually functions in Rio: you see
 * him from everywhere and you are almost never up there.
 */
function rioBuildCorcovado(game, root) {
  const M = rioMerger();
  const x = rioCORCOVADO.x, z = rioCORCOVADO.z;
  const y = rioTerrain(x, z);
  // the plinth
  M.box(0, 0.9, 0, 5.0, 1.8, 4.0, PALETTE.rioGraniteDk);
  M.box(0, 3.0, 0, 3.0, 2.4, 2.4, PALETTE.rioCristo);
  // the figure: a robe, and the arms, which are the whole silhouette
  M.box(0, 8.4, 0, 1.5, 6.4, 1.1, PALETTE.rioCristo);
  M.box(0, 10.9, 0, 10.5, 0.85, 0.9, PALETTE.rioCristo);
  M.sph(0, 12.3, 0, 0.72, 0.85, 0.72, PALETTE.rioCristo);
  M.box(0, 5.6, 0, 2.6, 1.0, 1.4, PALETTE.rioCristo);
  const mesh = new THREE.Mesh(M.build(), rioVC());
  mesh.position.set(x, y, z);
  mesh.rotation.y = 0.5;
  mesh.castShadow = true;
  root.add(mesh);
}

// ========================================================== ARCOS DA LAPA ====
/** The aqueduct: forty-two whitewashed arches carrying a tram over Lapa. */
function rioBuildLapa(game, root) {
  const M = rioMerger();
  const SG = rioStaticGroup(game);
  const N = 11, SP = 6.2;
  const x0 = rioLAPA.x - (N - 1) * SP * 0.5;
  const yBase = rioTerrain(rioLAPA.x, rioLAPA.z);
  const H = 13;
  for (let i = 0; i < N; i++) {
    const x = x0 + i * SP;
    // pier
    M.box(x, yBase + H * 0.5, rioLAPA.z, 1.5, H, 2.6, PALETTE.rioArch);
    // the arch itself, as a fan of short chords between the piers
    if (i < N - 1) {
      const SEG = 7, R = SP * 0.5 - 0.2;
      for (let k = 0; k < SEG; k++) {
        const a0 = Math.PI * (k / SEG), a1 = Math.PI * ((k + 1) / SEG);
        const ax = x + SP * 0.5 - Math.cos(a0) * R, ay = yBase + H - 2.2 + Math.sin(a0) * R;
        const bx = x + SP * 0.5 - Math.cos(a1) * R, by = yBase + H - 2.2 + Math.sin(a1) * R;
        const dx = bx - ax, dy = by - ay;
        const len = Math.sqrt(dx * dx + dy * dy);
        M.box((ax + bx) * 0.5, (ay + by) * 0.5, rioLAPA.z, len, 0.42, 2.6,
          PALETTE.rioArchShade, 0, 0, Math.atan2(dy, dx));
      }
    }
    SG.add(x, yBase + H * 0.5, rioLAPA.z, 1.5, H, 2.6, 0);
  }
  SG.done();
  // the deck on top, where the tram runs
  M.box(rioLAPA.x, yBase + H + 1.1, rioLAPA.z, (N - 1) * SP + 2.8, 0.55, 3.2, PALETTE.rioArch);
  M.box(rioLAPA.x, yBase + H + 2.0, rioLAPA.z, (N - 1) * SP + 2.8, 0.4, 0.2, PALETTE.rioArchShade);
  const mesh = new THREE.Mesh(M.build(), rioVC());
  mesh.castShadow = true; mesh.receiveShadow = true;
  root.add(mesh);
}

// ======================================================= ESCADARIA SELARON ==
/**
 * Jorge Selaron tiled these steps by hand for twenty years and called them his
 * tribute to the Brazilian people. Two hundred and fifteen of them, covered in
 * tiles sent from every country on earth, and overwhelmingly RED.
 *
 * The task is to take them AT SPEED, which is the only respectful way for a
 * capybara to interact with a work of art: the flight is timed from the bottom
 * step to the top one.
 */
function rioBuildSelaron(game, root) {
  const M = rioMerger();
  const TILE = [PALETTE.rioTileRed, PALETTE.rioTileRed, PALETTE.rioTileRed,
                PALETTE.rioTileYellow, PALETTE.rioTileBlue, PALETTE.rioTileGreen,
                PALETTE.rioTileWhite];
  const W = 7.0;
  const bx = rioSELARON.x, bz = rioSELARON.z;
  const by = rioTerrain(bx, bz);
  for (let i = 0; i < rioSELARON_N; i++) {
    const z = bz + i * rioSELARON_RUN;
    const y = by + i * rioSELARON_RISE;
    // the tread, plus a riser tiled in a different colour every step
    M.box(bx, y + 0.1, z, W, 0.12, rioSELARON_RUN, PALETTE.rioTileRed);
    M.box(bx, y - 0.1, z - rioSELARON_RUN * 0.5, W, rioSELARON_RISE, 0.09,
      TILE[i % TILE.length]);
    // a scatter of odd tiles along the tread, which is what makes it read as
    // Selaron rather than as a staircase
    for (let k = 0; k < 3; k++) {
      M.box(bx - W * 0.4 + rand(0, W * 0.8), y + 0.17, z + rand(-0.3, 0.3),
        0.22, 0.02, 0.22, TILE[randInt(0, TILE.length - 1)]);
    }
  }
  // Physics is ONE TILTED RAMP under the whole flight, not a body per step.
  // A stack of axis-aligned slabs is both dearer and worse: the capybara has to
  // clamber every riser, and the task is to take these at a run. The visible
  // steps stay steps; what the solver sees is the slope they describe.
  {
    const len = (rioSELARON_N - 1) * rioSELARON_RUN;
    const rise = (rioSELARON_N - 1) * rioSELARON_RISE;
    const ang = Math.atan2(rise, len);
    const b = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
    b.addShape(new CANNON.Box(new CANNON.Vec3(W * 0.5, 0.3, Math.sqrt(len * len + rise * rise) * 0.5)));
    b.position.set(bx, by + rise * 0.5 - 0.16, bz + len * 0.5);
    b.quaternion.setFromEuler(-ang, 0, 0);
    rioSyncBody(b);
    game.world.addBody(b);
  }
  // The walls either side, tiled too — and they collide, so the flight is a
  // corridor. Without them the "steps" are just a hill with decoration on it and
  // the run can be taken on the grass beside them, which is not the task.
  for (let s = -1; s <= 1; s += 2) {
    for (let i = 0; i < rioSELARON_N; i += 2) {
      const z = bz + i * rioSELARON_RUN;
      const y = by + i * rioSELARON_RISE;
      M.box(bx + s * (W * 0.5 + 0.4), y + 0.95, z, 0.7, 1.9, rioSELARON_RUN * 2, TILE[(i + 1) % TILE.length]);
    }
    const len = (rioSELARON_N - 1) * rioSELARON_RUN;
    const rise = (rioSELARON_N - 1) * rioSELARON_RISE;
    const ang = Math.atan2(rise, len);
    const wb = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
    wb.addShape(new CANNON.Box(new CANNON.Vec3(0.35, 1.1, Math.sqrt(len * len + rise * rise) * 0.5)));
    wb.position.set(bx + s * (W * 0.5 + 0.4), by + rise * 0.5 + 0.9, bz + len * 0.5);
    wb.quaternion.setFromEuler(-ang, 0, 0);
    rioSyncBody(wb);
    game.world.addBody(wb);
  }
  const mesh = new THREE.Mesh(M.build(), rioVC());
  mesh.castShadow = true; mesh.receiveShadow = true;
  root.add(mesh);
}

/** Bottom and top of the flight, in world space. */
function rioSelaronFoot() { return { x: rioSELARON.x, z: rioSELARON.z }; }
function rioSelaronHead() {
  return { x: rioSELARON.x, z: rioSELARON.z + (rioSELARON_N - 1) * rioSELARON_RUN };
}

// =========================================================== SANTA TERESA ====
/** The hill behind Lapa: colonial houses gone chalky, stacked up the slope. */
function rioBuildSantaTeresa(game, root) {
  const M = rioMerger();
  const SG = rioStaticGroup(game);
  const WALLS = [PALETTE.rioWall1, PALETTE.rioWall2, PALETTE.rioWall3, PALETTE.rioWall4, PALETTE.rioWall5];
  for (let i = 0; i < 26; i++) {
    const x = rand(-84, 4);
    const z = rand(84, 122);
    if (Math.abs(x - rioSELARON.x) < 8) continue;                 // do not bury the steps
    const y = rioTerrain(x, z);
    const w = rand(3.0, 5.2), d = rand(3.0, 4.6), h = rand(3.0, 5.5);
    const col = WALLS[randInt(0, WALLS.length - 1)];
    M.box(x, y + h * 0.5, z, w, h, d, col);
    M.box(x, y + h + 0.28, z, w + 0.5, 0.28, d + 0.5, i % 2 ? PALETTE.rioRoof : PALETTE.rioRoofDark);
    // THE SHUTTERS WERE HANGING IN THE AIR IN FRONT OF THE HOUSE.
    // The box is CENTRED on z with depth d, so its front face is at z - d/2 —
    // and these were drawn at z - d, which is half a house-depth out from the
    // wall they belong to. Twenty-six houses on the hill above Lapa with two
    // floating blue panels each, and it is exactly the sort of thing that
    // reads at distance as the model being broken.
    const face = z - d * 0.5 - 0.04;
    for (let k = -1; k <= 1; k += 2) {
      M.box(x + k * w * 0.28, y + h * 0.62, face, 0.44, 0.90, 0.06, PALETTE.rioWall3);
      M.box(x + k * w * 0.28, y + h * 0.62, face - 0.03, 0.52, 0.10, 0.10, PALETTE.rioArch);
    }
    // a door, and the iron balcony over it, which is the whole of Santa Teresa
    M.box(x, y + 1.05, face, 0.80, 2.10, 0.07, PALETTE.rioTramWood);
    M.box(x, y + h * 0.62 - 0.50, face - 0.34, w * 0.78, 0.06, 0.62, PALETTE.rioTramDk);
    for (let k = 0; k < 5; k++) {
      M.cyl(x - w * 0.32 + k * (w * 0.16), y + h * 0.62 - 0.24, face - 0.62,
        0.025, 0.46, PALETTE.rioTramDk);
    }
    SG.add(x, y + h * 0.5, z, w, h, d, 0);
  }
  SG.done();
  const mesh = new THREE.Mesh(M.build(), rioVC());
  mesh.castShadow = true; mesh.receiveShadow = true;
  root.add(mesh);
}

/// ========================================================= AVENIDA ATLANTICA ==
/**
 * THE CITY WAS NOT IN IT.
 *
 * The instrumented wide shot from the avenue is the giveaway: beach, paving,
 * grandstand, beach again. Between the calçadão and the Sambódromo there were
 * a hundred and twenty metres of open ground with seventy palms standing on it
 * and NOTHING ELSE — no building anywhere in the chapter except twenty-six
 * cottages on the hill behind Lapa. Copacabana is four kilometres of sand with
 * a wall of apartment blocks along the back of it, and that wall is the reason
 * the beach reads as a city beach rather than as a desert island; without it
 * the whole east half of the world has no skyline at all.
 *
 * Nine blocks with cross streets between them, because the OTHER half of the
 * reason this had to be right is the one the grandstand already taught: a
 * hundred and ninety metres of frontage with no gap in it is the same bug
 * again. Every block is fourteen metres wide with a seven-metre rua between,
 * so from anywhere on the sand there is a way inland within ten metres, and
 * `qa` drives it to prove it.
 *
 * All of it in ONE merged mesh and ONE body — see rioStaticGroup.
 */
// THE TWO ROWS OF GAPS HAVE TO LINE UP, OR THERE IS STILL NO ROUTE.
//
// The first cut put the frontage on a 21 m pitch and the stands on 33.6, and
// the analytic sweep says exactly what that means: a cross street lets you
// through the buildings and then you meet the grandstand at z = 24.5 and have
// to walk up to seventeen metres sideways looking for a gangway. Two obstacles
// with gaps in them at different spacings is a maze, and the player has no map
// of it. So both are laid out on ONE pitch — 16.8 m, which is half the stands'
// sector pitch — and the five gangways sit on cross streets. From x = 0 the way
// inland is dead ahead.
const rioFRONT_Z = 17.0;             // the building line
const rioFRONT_D = 9.0;              // how deep they are
const rioFRONT_PITCH = 16.8;
const rioFRONT_W = 11.4;

function rioBuildFrontage(game, root) {
  const M = rioMerger();
  const SG = rioStaticGroup(game);
  // Copacabana is cream and white and pale ochre with the occasional survivor
  // in a real colour, which is the whole reason the survivors read.
  const WALLS = [PALETTE.rioWall1, PALETTE.rioArch, PALETTE.rioWall4, PALETTE.rioArchShade,
                 PALETTE.rioWall3, PALETTE.rioArch, PALETTE.rioWall5, PALETTE.rioWall1,
                 PALETTE.rioWall2, PALETTE.rioPavePale];
  const AWN = [PALETTE.rioFeather1, PALETTE.rioFeather2, PALETTE.rioFeather3,
               PALETTE.rioTileGreen, PALETTE.rioTileBlue, PALETTE.rioTileRed];
  for (let b = 0; b < 10; b++) {
    const bx = -75.6 + b * rioFRONT_PITCH;
    // two buildings shoulder to shoulder in each block, which is what makes a
    // frontage a frontage instead of a row of towers
    const n = 2;
    for (let k = 0; k < n; k++) {
      const w = rioFRONT_W / n - 0.35;
      const x = bx - rioFRONT_W * 0.5 + rioFRONT_W * (k + 0.5) / n;
      const gy = rioTerrain(x, rioFRONT_Z);
      // FOUR TO TEN, NOT FIVE TO THIRTEEN. At 2.9 m a storey the first cut ran
      // to thirty-eight metres — accurate, and it walled the sea out of every
      // frame taken from the avenue. The skyline is the point; the wall is not.
      const st = 4 + randInt(0, 6);
      const SH = 2.9;                          // storey height
      const h = st * SH;
      const col = WALLS[(b * 3 + k) % WALLS.length];
      // ---- the plinth: two storeys of shopfront, set forward -------------
      M.box(x, gy + 3.0, rioFRONT_Z - 0.6, w + 0.3, 6.0, rioFRONT_D + 1.2, PALETTE.rioArchShade);
      // the shop windows along the front of it, which is the only thing on this
      // wall anybody standing on the sand is close enough to see
      for (let q = 0; q < 3; q++) {
        const sx = x - w * 0.34 + q * (w * 0.34);
        M.box(sx, gy + 1.55, rioFRONT_Z - rioFRONT_D * 0.5 - 1.24, w * 0.26, 2.3, 0.10,
              PALETTE.rioTileWhite);
      }
      // and the awning over them, which is where the colour comes from
      M.box(x, gy + 3.15, rioFRONT_Z - rioFRONT_D * 0.5 - 1.9, w + 0.2, 0.14, 1.6,
            AWN[(b * 5 + k) % AWN.length], -0.22, 0, 0);
      // ---- the tower ------------------------------------------------------
      M.box(x, gy + 6.0 + h * 0.5, rioFRONT_Z, w, h, rioFRONT_D, col);
      // BALCONIES. Every flat on that avenue has one and they are the entire
      // texture of the frontage: a horizontal slab per storey with a rail on
      // it, which reads at any distance as a building with people in it.
      for (let f = 0; f < st; f++) {
        const fy = gy + 6.6 + f * SH;
        M.box(x, fy, rioFRONT_Z - rioFRONT_D * 0.5 - 0.55, w - 0.5, 0.16, 1.1,
              PALETTE.rioArch);
        M.box(x, fy + 0.46, rioFRONT_Z - rioFRONT_D * 0.5 - 1.06, w - 0.5, 0.92, 0.09,
              f % 2 ? PALETTE.rioArchShade : PALETTE.rioPavePale);
        // the window behind it, recessed and dark, so the slab has a depth
        M.box(x, fy + 1.35, rioFRONT_Z - rioFRONT_D * 0.5 + 0.04, w - 1.5, 1.7, 0.10,
              PALETTE.rioGraniteDk);
        // AND THE BACK, which is what you see from the avenue — i.e. from the
        // one place in the chapter the player spends the marquee moment. It was
        // a blank thirty-metre slab. A ribbon window per floor is one box and
        // is exactly what the back of these blocks is: kitchens and lift lobby.
        M.box(x, fy + 1.30, rioFRONT_Z + rioFRONT_D * 0.5 + 0.05, w - 1.1, 1.5, 0.10,
              f % 3 === 1 ? PALETTE.rioTileWhite : PALETTE.rioGraniteDk);
      }
      // ---- the roof ------------------------------------------------------
      M.box(x, gy + 6.0 + h + 0.35, rioFRONT_Z, w + 0.5, 0.7, rioFRONT_D + 0.5,
            PALETTE.rioArchShade);
      // THE ROOF IS A SURFACE THE PLAYER LOOKS DOWN ON. This camera is 41
      // degrees above the horizontal, so the top of a thirty-metre block is a
      // large pale rectangle in a lot of frames and it has to have something on
      // it: the lift head, the water tanks, the aerials and — because this is
      // Rio and every one of these buildings has one — the washing.
      const ry = gy + 6.0 + h + 0.7;
      M.box(x - w * 0.24, ry + 1.55, rioFRONT_Z + 1.2, 2.0, 2.4, 2.0, PALETTE.rioGraniteFar);
      M.cyl(x + w * 0.26, ry + 1.15, rioFRONT_Z - 1.0, 0.85, 1.7,
            PALETTE.rioTileWhite, 0, 0, 0, 8);
      M.cyl(x + w * 0.26, ry + 2.1, rioFRONT_Z - 1.0, 0.95, 0.2,
            PALETTE.rioGraniteFar, 0, 0, 0, 8);
      // the parapet, which is what keeps a flat roof from reading as a lid
      for (let e = -1; e <= 1; e += 2) {
        M.box(x + e * (w * 0.5 + 0.2), ry + 0.45, rioFRONT_Z, 0.18, 0.9, rioFRONT_D + 0.5,
              PALETTE.rioArchShade);
        M.box(x, ry + 0.45, rioFRONT_Z + e * (rioFRONT_D * 0.5 + 0.2), w + 0.6, 0.9, 0.18,
              PALETTE.rioArchShade);
      }
      // two aerials and a line of washing across the middle of it
      M.cyl(x - w * 0.34, ry + 2.4, rioFRONT_Z - 2.6, 0.05, 3.4, PALETTE.rioTramDk);
      M.cyl(x + w * 0.10, ry + 1.9, rioFRONT_Z + 2.8, 0.05, 2.4, PALETTE.rioTramDk);
      if ((b + k) % 2 === 0) {
        for (let q = 0; q < 4; q++) {
          M.box(x - w * 0.28 + q * (w * 0.19), ry + 1.35, rioFRONT_Z - 2.2, w * 0.14, 0.72, 0.03,
                [PALETTE.rioTileWhite, PALETTE.rioFeather3, PALETTE.rioTileYellow,
                 PALETTE.rioFeather2][q]);
        }
      }
      // ---- AND THE SIDES ARE NOT BLANK -----------------------------------
      // A cross street between two blocks is a thirty-metre view of two party
      // walls, and the player walks down one of them every time they go from
      // the sand to the avenue. Small windows and a stack of air conditioners,
      // which is exactly what is on the flank of every one of these.
      if (k === 0 || k === n - 1) {
        const sgn = k === 0 ? -1 : 1;
        const fx = x + sgn * (w * 0.5 + 0.06);
        for (let f = 1; f < st; f += 2) {
          const fy = gy + 6.6 + f * SH;
          M.box(fx, fy + 1.1, rioFRONT_Z - 1.9, 0.10, 1.0, 0.8, PALETTE.rioGraniteDk);
          M.box(fx, fy + 1.1, rioFRONT_Z + 1.9, 0.10, 1.0, 0.8, PALETTE.rioGraniteDk);
          M.box(fx + sgn * 0.16, fy + 0.55, rioFRONT_Z + 0.2, 0.28, 0.5, 0.7,
                PALETTE.rioArchShade);
        }
      }
      // ---- solid ---------------------------------------------------------
      SG.add(x, gy + 3.0, rioFRONT_Z - 0.6, w + 0.3, 6.0, rioFRONT_D + 1.2, 0);
      SG.add(x, gy + 6.0 + h * 0.5, rioFRONT_Z, w, h, rioFRONT_D, 0);
    }
    // ---- the cross street, and what stands on the corner of it -----------
    // A rua running down to the sand needs to LOOK like one from the beach or
    // the gap reads as a mistake in the model rather than as the way through.
    if (b < 9) {
      const gx = -67.2 + b * rioFRONT_PITCH;
      const gy = rioTerrain(gx, rioFRONT_Z);
      M.box(gx, gy + 0.05, rioFRONT_Z, 6.4, 0.06, rioFRONT_D + 12, PALETTE.rioAsphalt);
      for (let s = -1; s <= 1; s += 2) {
        M.box(gx + s * 3.4, gy + 0.12, rioFRONT_Z, 0.5, 0.16, rioFRONT_D + 12,
              PALETTE.rioPavePale);
        // a streetlamp on each corner
        M.cyl(gx + s * 3.9, gy + 2.4, rioFRONT_Z - rioFRONT_D * 0.5 - 2.0, 0.09, 4.8,
              PALETTE.rioGraniteFar);
        M.box(gx + s * 3.9, gy + 4.9, rioFRONT_Z - rioFRONT_D * 0.5 - 2.4, 0.34, 0.16, 0.9,
              PALETTE.rioTileWhite);
      }
    }
  }
  SG.done();
  const mesh = new THREE.Mesh(M.build(), rioVC());
  mesh.castShadow = true; mesh.receiveShadow = true;
  root.add(mesh);
}

// ============================================================== THE AVENUE ===
/**
 * The avenue, its grandstands, and the crowd. The desfile comes down it; the
 * scoring column is wherever the bateria happens to be, so nothing here is the
 * task — this is the room the task happens in.
 *
 * ================== THE STANDS WERE A HUNDRED AND SIXTY-EIGHT METRE WALL ====
 *
 * MEASURED, NOT GUESSED. A closed-loop driven walk from the spawn on the
 * calçadão toward the avenue stops at z = 24.4 and slides sideways along that
 * line for the rest of the attempt, from x = 0 and again from x = 40. A sweep
 * of `navBlocked` over the whole world confirms it: `firstBlock` is 24.5 for
 * every x from -84 to +84 and null outside — one `rioStaticBox` per side,
 * `rioAVE_X1 - rioAVE_X0` long, with no gap in it anywhere.
 *
 * So the marquee task of the chapter, its `wow`, the bateria, the float and the
 * only route on to Lapa and Selarón were all behind an unbroken concrete
 * barrier, and the only way round was eighty-six metres of detour past the end
 * of everything, with nothing in the world saying so and the task beacon
 * pointing straight through it.
 *
 * A Sambódromo is not a wall. It is SECTORS with gangways between them — the
 * vomitórios everybody files in and out through — and that is both the truth
 * and the fix: five sectors a side, twenty-five metres each, and eight metres
 * of open gangway between every pair, with an arch over it so the way through
 * reads as a way through rather than as a hole in a model.
 */
function rioBuildAvenue(game, root) {
  const M = rioMerger();
  const SG = rioStaticGroup(game);
  const SPAN = rioAVE_X1 - rioAVE_X0;
  // the roadway
  M.box(0, rioTerrain(0, rioAVE_Z) + 0.04, rioAVE_Z, SPAN, 0.08, 18.0, PALETTE.rioAsphalt);
  // a centre line down it, because a desfile runs down the middle
  for (let i = 0; i < 40; i++) {
    const x = rioAVE_X0 + 2 + i * 4.3;
    M.box(x, rioTerrain(x, rioAVE_Z) + 0.07, rioAVE_Z, 1.2, 0.02, 0.16, PALETTE.rioAsphaltLn);
  }
  // and the two kerbs, which are what tell you where the road ends when the
  // parade is standing on the line
  for (let s = -1; s <= 1; s += 2) {
    M.box(0, rioTerrain(0, rioAVE_Z) + 0.10, rioAVE_Z + s * 9.1, SPAN, 0.20, 0.34,
          PALETTE.rioPavePale);
  }

  // FOUR SECTORS A SIDE AND FIVE GANGWAYS, one of which is on the centre line —
  // so the way inland from the spawn, which is at x = 0, is straight ahead.
  const PITCH = SPAN / 5;                  // 33.6
  const SLEN = 25.4;                       // and 8.2 m of gangway between each pair
  const SECT = 4;
  const BAN = [PALETTE.rioFeather1, PALETTE.rioFeather2, PALETTE.rioFeather3,
               PALETTE.rioFeather4, PALETTE.rioTileBlue];
  const sectX = [-PITCH * 1.5, -PITCH * 0.5, PITCH * 0.5, PITCH * 1.5];
  const gangX = [-PITCH * 2, -PITCH, 0, PITCH, PITCH * 2];

  for (let s = -1; s <= 1; s += 2) {
    const z0 = rioAVE_Z + s * 13.5;
    for (let k = 0; k < SECT; k++) {
      const cx = sectX[k];
      // ---- the rake ------------------------------------------------------
      for (let r = 0; r < 5; r++) {
        const zz = z0 + s * r * 1.5;
        const y = rioTerrain(cx, zz) + 0.5 + r * 0.9;
        M.box(cx, y * 0.5, zz, SLEN, y, 1.5,
          r % 2 ? PALETTE.rioGraniteFar : PALETTE.rioArchShade);
        // the nose of every step, so a rake is a flight of seats rather than a
        // stack of slabs seen edge-on from the road
        M.box(cx, y - 0.05, zz - s * 0.78, SLEN, 0.12, 0.22, PALETTE.rioPavePale);
      }
      // ---- and it is solid, PER SECTOR -----------------------------------
      SG.add(cx, rioTerrain(cx, z0) + 2.4, z0 + s * 3.4, SLEN, 4.8, 8.4, 0);
      // ---- the crash barrier and the school's banner along its front -----
      const zf = z0 - s * 1.4;
      for (let i = 0; i < 8; i++) {
        const bx = cx - SLEN * 0.5 + 1.6 + i * (SLEN - 3.2) / 7;
        M.cyl(bx, rioTerrain(bx, zf) + 0.55, zf, 0.05, 1.1, PALETTE.rioTramDk);
      }
      M.box(cx, rioTerrain(cx, zf) + 1.05, zf, SLEN - 1.2, 0.08, 0.06, PALETTE.rioTramDk);
      M.box(cx, rioTerrain(cx, zf) + 0.55, zf - s * 0.06, SLEN - 2.0, 0.95, 0.05,
            BAN[(k + (s > 0 ? 2 : 0)) % BAN.length]);
      // the sector board, the size of a person, on the end wall of every rake
      M.box(cx + SLEN * 0.5 + 0.1, rioTerrain(cx, z0) + 3.2, z0 + s * 3.4,
            0.2, 1.6, 1.6, PALETTE.rioTileWhite);
    }
    // ---- THE GANGWAYS, AND THE ARCH OVER EACH ONE ------------------------
    // Four per side, between the sectors, plus the two ends. Nothing is solid
    // here on purpose: this is the way through, and a `vomitório` is exactly
    // what the way through a Sambódromo is called.
    for (let k = 0; k < gangX.length; k++) {
      const gx = gangX[k];
      const gy0 = rioTerrain(gx, z0 + s * 3.4);
      for (let t = -1; t <= 1; t += 2) {
        M.box(gx + t * 3.4, gy0 + 2.6, z0 + s * 3.4, 0.9, 5.2, 8.4, PALETTE.rioArch);
      }
      M.box(gx, gy0 + 5.6, z0 + s * 3.4, 7.8, 0.8, 8.8, PALETTE.rioArch);
      M.box(gx, gy0 + 6.2, z0 + s * 3.4, 8.4, 0.4, 9.2, PALETTE.rioArchShade);
      // the piers are solid; the four metres between them are not
      for (let t = -1; t <= 1; t += 2) {
        SG.add(gx + t * 3.4, gy0 + 2.6, z0 + s * 3.4, 0.9, 5.2, 8.4, 0);
      }
      // and the floodlight masts stand IN the gangways rather than on the
      // seating, which is where the old ones were and where nobody puts one
      const my = rioTerrain(gx, z0 + s * 9);
      M.cyl(gx, my + 7.5, z0 + s * 9, 0.22, 15, PALETTE.rioGraniteFar, 0, 0, 0, 6);
      M.box(gx, my + 15.4, z0 + s * 9, 3.2, 0.9, 1.0, PALETTE.rioGraniteDk, s * 0.34, 0, 0);
      for (let q = -1; q <= 1; q++) {
        M.box(gx + q * 1.05, my + 15.2, z0 + s * 8.55, 0.85, 0.7, 0.14, PALETTE.rioTileWhite,
              s * 0.34, 0, 0);
      }
    }
  }
  SG.done();
  const mesh = new THREE.Mesh(M.build(), rioVC());
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  root.add(mesh);

  // THE CROWD STOOD HALF A METRE ABOVE THE STEP IT WAS ON.
  //
  // The rake for row r is a box of height 0.5 + r*0.9 sitting on the ground,
  // so its TOP is at 0.5 + r*0.9 — and the crowd was placed at 1.0 + r*0.9,
  // which is every single person in the Sambódromo floating half a metre in
  // the air.
  //
  // AND THERE WERE NOT ENOUGH OF THEM. A hundred and ninety-six people spread
  // uniformly over a hundred and sixty-eight metres and five rows is one
  // person every four and a half metres — a rake that reads as EMPTY, in the
  // one place in the chapter where the whole joke is that a very large number
  // of people are watching. They go in the sectors now, packed, which costs
  // nothing extra in draw calls and is what a desfile actually looks like.
  let placed = 0;
  for (let i = 0; i < rioCROWD_N; i++) {
    const s = i % 2 ? 1 : -1;
    const r = randInt(0, 4);
    const cx = sectX[randInt(0, SECT - 1)];
    const z = rioAVE_Z + s * (13.5 + r * 1.5);
    const x = cx + rand(-SLEN * 0.5 + 0.9, SLEN * 0.5 - 0.9);
    const y = rioTerrain(x, z) + 0.5 + r * 0.9;
    rioAddPerson(x, y, z, s > 0 ? Math.PI : 0, rioPPL_STAND);
    placed++;
  }
  return placed;
}
/**
 * THE BATERIA.
 *
 * Sixteen drummers in ranks, the surdos at the back where they belong, and a
 * float behind them. The whole section is one mesh in one group, and the group
 * WALKS — which is the point of the chapter. It pumps on the beat rather than
 * animating limb by limb, because that is what a bateria actually looks like
 * from the pavement: a single body of people all moving at once.
 */
function rioBuildBateria(game, root) {
  const g = new THREE.Group();
  const M = rioMerger();
  // A HUNDRED AND FIFTY DRUMS YOU COULD WALK STRAIGHT THROUGH.
  //
  // The audit found the bateria and the float were both drawn and neither was
  // solid, which is the one thing in this chapter you are guaranteed to walk
  // into — the task is to keep station inside the column they are in. Sixteen
  // BOXES ON ONE KINEMATIC BODY, not one box round the lot: a solid slab would
  // fence the player out of the section, and the whole pleasure of standing in
  // a bateria is that you are standing IN it. The gaps between ranks are 1.4 m
  // and the animal is half a metre across, so it weaves.
  const bb = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC,
    material: (game.mats && game.mats.ground) || undefined });
  const SKIN = [PALETTE.skin1, PALETTE.skin2, PALETTE.skin3, PALETTE.skin4];
  const FEAT = [PALETTE.rioFeather1, PALETTE.rioFeather2, PALETTE.rioFeather3, PALETTE.rioFeather4];
  for (let i = 0; i < rioBATERIA_N; i++) {
    const row = Math.floor(i / 4), colr = i % 4;
    const x = -3.6 + row * 2.4;
    const z = -3.3 + colr * 2.2;
    const surdo = row >= 2;                 // the big drums bring up the rear
    const kit = row % 2 ? PALETTE.rioFeather3 : PALETTE.rioFeather2;  // the school colours
    M.cyl(x, 0.78, z, 0.24, 1.56, kit);
    M.box(x, 1.50, z, 0.54, 0.15, 0.3, PALETTE.rioSequin);           // sequinned shoulders
    M.sph(x, 1.80, z, 0.26, 0.28, 0.26, SKIN[i % SKIN.length]);
    // the drum, slung at the waist
    const dr = surdo ? 0.52 : 0.3;
    const dh = surdo ? 0.68 : 0.28;
    M.cyl(x, surdo ? 0.95 : 1.15, z - 0.42, dr, dh, PALETTE.rioDrumShell);
    M.cyl(x, surdo ? 0.95 + dh * 0.5 : 1.15 + dh * 0.5, z - 0.42, dr * 1.03, 0.05, PALETTE.rioDrum);
    M.cyl(x, surdo ? 0.95 - dh * 0.5 : 1.15 - dh * 0.5, z - 0.42, dr * 1.03, 0.05, PALETTE.rioDrumHoop);
    // a headdress, because this is Carnival and nobody is dressed sensibly
    M.box(x, 2.00, z, 0.32, 0.11, 0.32, FEAT[i % FEAT.length]);
    M.cone(x, 2.34, z + 0.07, 0.14, 0.6, FEAT[(i + 1) % FEAT.length]);
    bb.addShape(new CANNON.Box(new CANNON.Vec3(0.30, 0.85, 0.30)),
                new CANNON.Vec3(x, 0.85, z));
  }
  const mesh = new THREE.Mesh(M.build(), rioVC());
  mesh.castShadow = true;
  g.add(mesh);
  root.add(g);
  rioBateriaGroup = g;
  // The group is drawn at yaw -90 and the shapes above are in ITS coordinates,
  // so the body has to carry the same rotation or the section is solid across
  // the avenue instead of along it.
  bb.quaternion.setFromEuler(0, -Math.PI * 0.5, 0);
  bb.position.set(rioBateriaX, rioTerrain(rioBateriaX, rioAVE_Z), rioAVE_Z);
  // A kinematic body that is momentarily still is exactly what cannon's sleep
  // heuristic is looking for, and a sleeping body is skipped in narrowphase.
  bb.allowSleep = false;
  rioSyncBody(bb);
  game.world.addBody(bb);
  rioBateriaBody = bb;
  rioBateriaPX = bb.position.x;

  // the float behind them
  const fg = new THREE.Group();
  const F = rioMerger();
  F.box(0, 0.9, 0, 3.4, 0.9, 5.0, PALETTE.rioFloat);
  F.box(0, 2.2, -1.2, 2.4, 0.5, 2.0, PALETTE.rioFeather2);
  F.cone(0, 4.2, -1.2, 2.2, 3.0, PALETTE.rioFeather1, 0, 0, 0, 6);
  F.sph(0, 6.0, -1.2, 0.9, 0.9, 0.9, PALETTE.rioSequin);
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * 6.28;
    F.cone(Math.cos(a) * 2.4, 2.9, -1.2 + Math.sin(a) * 1.9, 0.24, 1.3,
      [PALETTE.rioFeather1, PALETTE.rioFeather2, PALETTE.rioFeather3, PALETTE.rioFeather4][i % 4],
      0.4, a, 0);
  }
  // THE WHEELS WERE NINE TENTHS OF A METRE OUTBOARD OF THE HULL.
  //
  // The bed is 3.4 across (half-width 1.7) and the wheels were at ±2.6, so four
  // black discs stood clear of the vehicle they belong to and the instrumented
  // shot of the parade is a pale slab floating over the sand with four boulders
  // beside it. They are under it now, and there is a chassis rail and a skirt
  // between them, because the one thing you cannot see on a real carro
  // alegórico is its running gear.
  for (let s = -1; s <= 1; s += 2) {
    F.cyl(s * 1.44, 0.42, 3.1, 0.42, 0.36, PALETTE.rioPaveDark, 0, 0, 1.5708, 8);
    F.cyl(s * 1.44, 0.42, -3.1, 0.42, 0.36, PALETTE.rioPaveDark, 0, 0, 1.5708, 8);
    F.box(s * 1.42, 0.50, 0, 0.20, 0.34, 6.6, PALETTE.rioTramDk);
    // the pleated skirt everybody hangs off the sides of these things
    F.box(s * 1.66, 0.44, 0, 0.10, 0.72, 5.2, PALETTE.rioFeather2);
  }
  F.box(0, 0.30, 0, 2.6, 0.24, 6.4, PALETTE.rioTramDk);
  const fm = new THREE.Mesh(F.build(), rioVC());
  fm.castShadow = true;
  fg.add(fm);
  root.add(fg);
  rioFloatGroup = fg;

  // The float is a four-tonne vehicle and it was a hologram. Hull and tower,
  // two shapes, and the same -90 yaw as the group it belongs to. Being shoved
  // aside by a passing float is a thing rioUpdateSamba has had a comment about
  // since it was written ("being shoved by a passing float is not a
  // punishment") — it just could not happen, because there was nothing there.
  const fb = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC,
    material: (game.mats && game.mats.ground) || undefined });
  fb.addShape(new CANNON.Box(new CANNON.Vec3(1.75, 0.62, 2.6)), new CANNON.Vec3(0, 0.85, 0));
  fb.addShape(new CANNON.Box(new CANNON.Vec3(1.3, 2.2, 1.3)), new CANNON.Vec3(0, 3.4, -1.2));
  fb.quaternion.setFromEuler(0, -Math.PI * 0.5, 0);
  const fx0 = rioBateriaX - 15;
  fb.position.set(fx0, rioTerrain(fx0, rioAVE_Z), rioAVE_Z);
  fb.allowSleep = false;
  rioSyncBody(fb);
  game.world.addBody(fb);
  rioFloatBody = fb;

  // ---- AND THE PEOPLE THE DRUMS ARE FOR ----------------------------------
  // Sixteen drummers and an empty trolley is not a desfile, it is a delivery.
  // A school walks its bateria in the middle of an ALA — dancers either side of
  // the section, keeping station with it exactly the way the player is about to
  // be asked to — and puts its destaque up on the float. Both take their x from
  // the parade's own x (see rioUpdatePeople), so nothing here can ever be a
  // frame out of step with the thing it is dancing to.
  for (let i = 0; i < 16; i++) {
    const lane = i % 4;                       // two files ahead, two behind
    const ox = lane < 2 ? rand(5.5, 11.0) : rand(-13.5, -6.5);
    const oz = (lane % 2 ? 1 : -1) * rand(2.2, 6.2);
    rioAddPerson(ox, 0, oz, -Math.PI * 0.5, rioPPL_PARADE);
  }
  // the destaque, on the float, at deck height
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * 6.283;
    rioAddPerson(Math.cos(a) * 1.9, 1.35, Math.sin(a) * 1.15, -Math.PI * 0.5, rioPPL_FLOAT);
  }
}

// =================================================================== PEOPLE ==
/**
 * EVERYBODY IN RIO, IN TWO DRAW CALLS.
 *
 * The chapter had a hundred and forty-six figures in it and every single one
 * was the same white box: `rioInstance(root, rioG.box, PALETTE.cloth6, ...)`
 * for the grandstand, and the same call again for the sixteen people on
 * Arpoador — who the game then tells you are APPLAUDING, while they stand
 * there in perfect rows not moving. Two hundred metres of Copacabana had
 * nobody on it at all.
 *
 * So there is one cast for the whole biome. A merged figure — legs, torso,
 * collar, head, two arms — instanced with a shirt colour and a skin colour
 * each, and a per-person POSE that is chosen once and a per-person MOTION that
 * runs every frame:
 *
 *   STAND  the grandstand and the sand. Bounces, and the bounce grows as the
 *          bateria comes past — which turns a hundred and thirty static pawns
 *          into a wave travelling down the avenue at 2.4 m/s for free, because
 *          the parade's own x is already the only thing it is keyed to.
 *   SIT    on a towel, leaning back, facing the water. Breathes, and nothing
 *          else: the whole point of somebody on a towel is that they are not
 *          doing anything.
 *   ROCK   the sixteen on Arpoador. They sway, and when the capybara gets up
 *          there they stand up and CLAP, which is the thing the toast has been
 *          claiming since the chapter shipped.
 *
 * An InstancedMesh multiplies the instance colour by the vertex colour, so the
 * torso and arms are authored white (they take the shirt) and the legs and
 * collar are authored grey (they take a darkened version of it). The head is
 * its own mesh so a bright shirt cannot turn somebody's face orange.
 */
const rioPPL_MAX = 360;
const rioPPL_STAND = 0, rioPPL_SIT = 1, rioPPL_ROCK = 2;
// THE TWO THAT MOVE WITH THE COLUMN. For these, the stored x and z are OFFSETS
// from the parade rather than world coordinates — see rioUpdatePeople. It is
// the same trick the stand's bounce uses: key everything to the parade's own x
// and there is no second clock anywhere for any of it to drift against.
const rioPPL_PARADE = 3, rioPPL_FLOAT = 4;
// AND THE ONE THAT PLAYS. See rioUpdateVolei.
const rioPPL_VOLEI = 5;
const rioVoleiIdx = [];
let rioVoleiT = 3.0, rioVoleiLast = -1, rioVoleiCel = 0;
let rioPplBody = null, rioPplHead = null, rioPplN = 0;
// x, y, z, yaw, kind, phase, rate
const rioPplData = new Float32Array(rioPPL_MAX * 7);
let rioPplBodyCol = null, rioPplHeadCol = null;
let rioClap = 0;
const rioPplCol = new THREE.Color();
const rioSHIRT = [PALETTE.cloth1, PALETTE.cloth2, PALETTE.cloth3, PALETTE.cloth4,
                  PALETTE.cloth5, PALETTE.cloth6, PALETTE.cloth7, PALETTE.cloth8,
                  PALETTE.rioFeather1, PALETTE.rioFeather2, PALETTE.rioFeather3,
                  PALETTE.rioFeather4, PALETTE.rioTileBlue, PALETTE.rioTileGreen];
const rioSKIN = [PALETTE.skin1, PALETTE.skin2, PALETTE.skin3, PALETTE.skin4];

function rioBuildPeople(root) {
  const M = rioMerger();
  // BOXES, NOT CYLINDERS, FOR THE LEGS. Two six-sided cylinders are forty-eight
  // triangles a person and at fifteen metres they are two boxes with the
  // corners rounded off; the twenty-four that buys pays for the head below,
  // which is the part anybody can actually see from this camera.
  M.box(-0.095, 0.36, 0, 0.115, 0.72, 0.15, 0x9aa0ac);
  M.box(0.095, 0.36, 0, 0.115, 0.72, 0.15, 0x9aa0ac);
  M.box(0, 1.00, 0, 0.44, 0.62, 0.28, 0xffffff);
  M.box(0, 1.33, 0, 0.46, 0.07, 0.30, 0xb8bcc4);        // a collar, so it is clothing
  // the arms, out and a little up: from the pavement the only thing that
  // separates a person from a bollard is that they have a width at the top
  for (let s = -1; s <= 1; s += 2) {
    M.box(s * 0.29, 1.10, 0.03, 0.10, 0.54, 0.10, 0xffffff, -0.30, 0, s * 0.34);
  }
  const bodyGeo = M.build();
  // ---- THE HAIR WAS A LID THE FULL WIDTH OF THE HEAD ----------------------
  //
  // 0.30 x 0.09 x 0.29 of flat dark brown sitting on a head 0.29 across, and
  // this camera looks DOWN — so from the only angle anybody ever sees them
  // from, every one of two hundred and sixty people in Rio was a torso with a
  // brown plank on top of it. The instrumented shot of the futevolei court is
  // eight of them and not one has a face.
  //
  // The whole fix is that the hair must not reach the front or the sides: a
  // head seen from above is mostly the crown, and the crown is SKIN-coloured
  // with hair on the back half of it. And a nose — four centimetres, twelve
  // triangles — is the only reason a head turning to watch you reads as a head
  // turning rather than as a ball rotating. The locals in npc.js have had one
  // since they were written; the crowd never did.
  const H = rioMerger();
  H.sph(0, 0, 0, 0.145, 0.165, 0.145, 0xffffff);
  H.box(0, 0.075, -0.055, 0.25, 0.105, 0.19, 0x6a5040);   // hair, back of the crown only
  H.box(0, -0.005, 0.150, 0.05, 0.05, 0.055, 0xffffff);   // and the nose
  const headGeo = H.build();

  rioPplBody = new THREE.InstancedMesh(bodyGeo, rioVC(), rioPPL_MAX);
  rioPplHead = new THREE.InstancedMesh(headGeo, rioVC(), rioPPL_MAX);
  rioPplBodyCol = new Float32Array(rioPPL_MAX * 3);
  rioPplHeadCol = new Float32Array(rioPPL_MAX * 3);
  rioPplBody.instanceColor = new THREE.InstancedBufferAttribute(rioPplBodyCol, 3);
  rioPplHead.instanceColor = new THREE.InstancedBufferAttribute(rioPplHeadCol, 3);
  rioPplBody.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  rioPplHead.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  rioPplBody.castShadow = true;
  rioPplHead.castShadow = true;
  rioPplBody.frustumCulled = false;
  rioPplHead.frustumCulled = false;
  rioPplBody.count = 0;
  rioPplHead.count = 0;
  root.add(rioPplBody);
  root.add(rioPplHead);
}

function rioAddPerson(x, y, z, yaw, kind) {
  if (!rioPplBody || rioPplN >= rioPPL_MAX) return -1;
  const i = rioPplN++;
  const o = i * 7;
  rioPplData[o] = x; rioPplData[o + 1] = y; rioPplData[o + 2] = z;
  rioPplData[o + 3] = yaw; rioPplData[o + 4] = kind;
  rioPplData[o + 5] = rand(0, 6.283);
  rioPplData[o + 6] = rand(0.82, 1.24);
  rioPplCol.set(rioSHIRT[randInt(0, rioSHIRT.length - 1)]);
  rioPplBodyCol[i * 3] = rioPplCol.r;
  rioPplBodyCol[i * 3 + 1] = rioPplCol.g;
  rioPplBodyCol[i * 3 + 2] = rioPplCol.b;
  rioPplCol.set(rioSKIN[randInt(0, rioSKIN.length - 1)]);
  rioPplHeadCol[i * 3] = rioPplCol.r;
  rioPplHeadCol[i * 3 + 1] = rioPplCol.g;
  rioPplHeadCol[i * 3 + 2] = rioPplCol.b;
  rioPplBody.count = rioPplN;
  rioPplHead.count = rioPplN;
  rioPplBody.instanceColor.needsUpdate = true;
  rioPplHead.instanceColor.needsUpdate = true;
  return i;
}

function rioUpdatePeople(dt) {
  if (!rioPplBody || rioPplN < 1) return;
  if (rioClap > 0) rioClap -= dt;
  const pulse = rioBateriaPulse;
  for (let i = 0; i < rioPplN; i++) {
    const o = i * 7;
    const kind = rioPplData[o + 4];
    const ph = rioPplData[o + 5], rate = rioPplData[o + 6];
    let x = rioPplData[o], z = rioPplData[o + 2];
    let y = rioPplData[o + 1], yaw = rioPplData[o + 3];
    let rx = 0, sy = 1, sxz = 1;
    if (kind === rioPPL_PARADE || kind === rioPPL_FLOAT) {
      // ---- THE PEOPLE IN THE PARADE -----------------------------------
      // A desfile is not a hundred and fifty drums walking down an empty road.
      // The bateria is the ENGINE of it and everything else — the ala, the
      // passistas, the destaque up on the float — is what the engine is for,
      // and the chapter had none of it: sixteen drummers and an unoccupied
      // trolley. They sit on the parade's own x, so they can never drift out
      // of step with the column and they cost one add each.
      const onFloat = kind === rioPPL_FLOAT;
      x = rioBateriaX + (onFloat ? -15 : 0) + rioPplData[o];
      z = rioAVE_Z + rioPplData[o + 2];
      y = rioTerrain(x, rioAVE_Z) + (onFloat ? rioPplData[o + 1] : 0);
      // the samba step: down on the beat, and the whole body pivots with it
      const dip = Math.abs(Math.sin(rioTime * 3.2 * rate + ph));
      y += dip * (0.035 + pulse * 0.10);
      sy = 1 - pulse * 0.05;
      sxz = 1 + pulse * 0.035;
      yaw = -Math.PI * 0.5 + Math.sin(rioTime * 2.1 * rate + ph) * (0.42 + pulse * 0.55);
      rx = -Math.sin(rioTime * 2.1 * rate + ph) * 0.10;
      if (rioSalute > 0) {
        // the salute: the whole ala turns off its line and faces the animal
        const cp = rioGame && rioGame.capy && rioGame.capy.position;
        if (cp) {
          const want = Math.atan2(cp.x - x, cp.z - z);
          let d = want - yaw;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          yaw += d * clamp(rioSalute / 3.4, 0, 1);
        }
      }
    } else if (kind === rioPPL_VOLEI) {
      // They watch the ball, they shuffle a metre and a half either way to get
      // under it, and they LEAVE THE GROUND for it — which is the entire read
      // of futevolei from any distance at all.
      const bp = rioBallBody ? rioBallBody.position : null;
      if (bp) {
        const want = Math.atan2(bp.x - x, bp.z - z);
        let d = want - rioPplData[o + 3];
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        rioPplData[o + 3] += clamp(d, -3.0 * dt, 3.0 * dt);
        yaw = rioPplData[o + 3];
        // a step toward it, damped back home, never more than a stride and a half
        const dx0 = clamp(bp.x - x, -1.6, 1.6);
        x += dx0 * 0.55 * clamp(1 - Math.abs(bp.z - z) / 6, 0, 1);
        const reach = clamp(1 - Math.hypot(bp.x - x, bp.z - z) / 2.8, 0, 1);
        const up = clamp((bp.y - y - 0.9) / 1.6, 0, 1);
        y += Math.abs(Math.sin(rioTime * 2.6 * rate + ph)) * 0.03
           + reach * up * 0.55 + reach * 0.06;
        rx = -reach * 0.30;
        sy = 1 + reach * up * 0.05;
      } else {
        y += Math.abs(Math.sin(rioTime * 1.6 * rate + ph)) * 0.02;
      }
      // and the celebration, which is the whole point of the task landing
      if (rioVoleiCel > 0) {
        y += Math.abs(Math.sin(rioTime * 9.0 + ph)) * 0.18 * clamp(rioVoleiCel, 0, 1);
        sy = 1 + 0.05 * clamp(rioVoleiCel, 0, 1);
      }
    } else if (kind === rioPPL_SIT) {
      // a towel is a place where nothing happens. Breathing, and that is all.
      y -= 0.30;
      rx = -0.34;
      sy = 0.74;
      y += Math.sin(rioTime * 0.9 * rate + ph) * 0.012;
    } else if (kind === rioPPL_ROCK) {
      // THE APPLAUSE. They watch the sunset off this rock every evening of
      // their lives; tonight there is something else on it.
      const c = clamp(rioClap, 0, 1);
      y += Math.abs(Math.sin(rioTime * (1.1 + c * 7.0) * rate + ph)) * (0.012 + c * 0.085);
      sy = 1 + c * 0.06;
      yaw += Math.sin(rioTime * 0.5 + ph) * 0.10;
    } else {
      // THE WAVE DOWN THE AVENUE. Keyed to the parade's own x, so the stand
      // comes up as the bateria arrives and sits back down behind it, and
      // there is no separate clock anywhere for it to drift against.
      const near = clamp(1 - Math.abs(x - rioBateriaX) / 30, 0, 1);
      const amp = 0.014 + near * (0.05 + pulse * 0.13);
      y += Math.abs(Math.sin(rioTime * (1.4 + near * 3.2) * rate + ph)) * amp;
      sy = 1 + near * pulse * 0.05;
      // ...and they LEAN OVER THE BARRIER as it comes past, which is the thing
      // everybody in that stand is actually doing and is worth one number.
      rx = -near * (0.10 + pulse * 0.16);
      if (near > 0.02) {
        // and they turn to watch it go past
        const want = Math.atan2(rioBateriaX - x, rioAVE_Z - z);
        let d = want - yaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        yaw += d * near * 0.9;
      }
    }
    rioPplBody.setMatrixAt(i, rioXform(x, y, z, rx, yaw, 0, sxz, sy, sxz));
    // A HEAD SITS ON A NECK, AND THE NECK IS ON A BODY THAT LEANS.
    //
    // The head was placed at (x, y + 1.43*sy + rx*0.28, z) — the same x and z
    // as the feet, with a fudge on y. The body is rotated about X at its own
    // origin, so at the 0.34 radians a sitter leans back the shoulders travel
    // half a metre in z and the head stayed exactly where it was: twenty-two
    // people on towels with their heads floating in front of their chests, and
    // now that the grandstand leans over the barrier as well, two hundred more.
    // The offset is the local (0, h, 0) taken through both rotations, which is
    // two sines and is exact.
    const hh = 1.43 * sy;
    const sr = Math.sin(rx) * hh, cr = Math.cos(rx) * hh;
    rioPplHead.setMatrixAt(i, rioXform(x + sr * Math.sin(yaw), y + cr, z + sr * Math.cos(yaw),
                                       rx, yaw, 0, 1, 1, 1));
  }
  rioPplBody.instanceMatrix.needsUpdate = true;
  rioPplHead.instanceMatrix.needsUpdate = true;
}

// ==================================================================== BIRDS ==
/**
 * THINGS THAT ARE SIMPLY THERE.
 *
 * Everything in Rio wants something from you: a cart, a net, a staircase, a
 * cable car, a hundred and fifty drums. The one thing the chapter had none of
 * was something that wants nothing at all — and the sky over that beach is
 * never empty. Fragatas: two metres of wing, a forked tail, and they do not
 * flap. They hang off the sea breeze coming up the face of Arpoador and they
 * are, minute for minute, the least busy animal in Brazil.
 *
 * The three rules apply. Silhouette first, checked from above (this camera
 * looks DOWN at them as often as up, so the tail fork has to read in plan);
 * the sound is rationed and falls off with distance; and they are on a long
 * enough cycle that they are never the thing you are watching.
 */
const rioBIRD_N = 9;
let rioBirdMesh = null, rioBirdSeed = null;
let rioBirdT = 0, rioBirdCall = 7;

function rioBuildBirds(root) {
  const M = rioMerger();
  // A FRIGATEBIRD IN PLAN IS A LETTER W. Long swept wings with a real crook in
  // them, a short body, and a tail that forks — which is the only part of it
  // anybody can name and is therefore the part that has to be right.
  M.box(0, 0, 0, 0.20, 0.16, 1.05, PALETTE.rioPaveDark);
  M.box(0, 0.02, 0.62, 0.13, 0.11, 0.42, PALETTE.rioPaveDark);
  M.cone(0, 0.01, 0.92, 0.06, 0.34, PALETTE.rioGraniteDk, Math.PI / 2, 0, 0, 4);
  for (let s = -1; s <= 1; s += 2) {
    M.box(s * 0.62, 0.06, 0.06, 1.10, 0.05, 0.46, PALETTE.rioPaveDark, 0, s * 0.14, s * 0.10);
    M.box(s * 1.48, 0.02, -0.16, 0.72, 0.05, 0.30, PALETTE.rioGraniteDk, 0, s * 0.42, s * 0.16);
    // the fork
    M.box(s * 0.13, 0, -0.78, 0.10, 0.05, 0.62, PALETTE.rioPaveDark, 0, s * 0.20, 0);
  }
  rioBirdMesh = new THREE.InstancedMesh(M.build(), rioVC(), rioBIRD_N);
  rioBirdMesh.name = 'rioFragatas';
  rioBirdMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  rioBirdMesh.frustumCulled = false;
  rioBirdMesh.castShadow = false;     // a shadow at 40 m over sand is a smudge
  root.add(rioBirdMesh);
  rioBirdSeed = [];
  for (let i = 0; i < rioBIRD_N; i++) {
    // three loose groups: over the point, over the break, and over the far end
    const g = i % 3;
    rioBirdSeed.push({
      cx: g === 0 ? rioARPOADOR.x + 4 : g === 1 ? rioWAVE_X + 10 : 34,
      cz: g === 0 ? rioARPOADOR.z - 4 : g === 1 ? rioSHORE_Z - 16 : rioSHORE_Z - 6,
      a: (i / rioBIRD_N) * 6.283,
      r: 15 + ((i * 7919) % 100) / 100 * 26,
      y: 22 + ((i * 65537) % 100) / 100 * 17,
      w: 0.052 + ((i * 31337) % 100) / 100 * 0.036,
      b: ((i * 104729) % 628) / 100,
    });
  }
}

function rioUpdateBirds(dt) {
  if (!rioBirdMesh) return;
  rioBirdT += dt;
  for (let i = 0; i < rioBIRD_N; i++) {
    const s = rioBirdSeed[i];
    const a = s.a + rioBirdT * s.w;
    const rr = s.r * (1 + Math.sin(rioBirdT * 0.08 + s.b) * 0.16);
    const x = s.cx + Math.cos(a) * rr;
    const z = s.cz + Math.sin(a) * rr * 0.72;
    const y = s.y + Math.sin(rioBirdT * 0.11 + s.b) * 4.2;
    const yaw = Math.atan2(-Math.sin(a), Math.cos(a) * 0.72) + Math.PI * 0.5;
    // they bank into the turn and they almost never flap: one lazy beat every
    // ten seconds or so, which is what makes the rest of it read as soaring
    const flap = Math.sin(rioBirdT * 0.34 + s.b * 3) > 0.93
                 ? Math.sin(rioBirdT * 4.4) * 0.30 : 0;
    rioBirdMesh.setMatrixAt(i, rioXform(x, y, z, flap * 0.25, yaw, 0.34 + flap, 1, 1, 1));
  }
  rioBirdMesh.instanceMatrix.needsUpdate = true;

  // ---- and one of them says something about it, occasionally ---------------
  rioBirdCall -= dt;
  if (rioBirdCall <= 0) {
    rioBirdCall = 13 + Math.random() * 11;
    const g = rioGame;
    const cp = g && g.capy && g.capy.position;
    if (!cp) return;
    const far = Math.hypot(cp.x - rioARPOADOR.x, cp.z - rioSHORE_Z);
    if (far > 90) return;
    if (typeof g.sfx === 'function') {
      try { g.sfx('gull', { volume: clamp(0.30 - far * 0.0026, 0.04, 0.30), pitch: 1.15 }); } catch (e) {}
    }
  }
}

// ==================================================================== FLORA ==
/** Coconut palms down the calcadao, and Atlantic forest on the granite. */
// ---- AND ONE GAP IN THE PALM LINE, WHERE THE CHAPTER STARTS ---------------
// The arrival heading (see RIO_SPAWN in main.js) looks south down the wave
// paving at the Atlantic, which puts the camera boom seven metres INLAND of
// the animal — straight into the promenade row, whose members at x = ±3.6
// carry seven fronds arching 2.8 m out of a crown six metres up. Measured: the
// first frame of chapter six was green blades filling the whole screen with a
// capybara the size of a thumbnail behind them.
//
// Fushimi Inari's cedars already solve this exact problem the same way — the
// corridor is cut OUT of the placement rather than the camera being fought.
// Seven metres of gap in a twenty-six palm row does not read as a hole; it
// reads as the crossing where the pavement meets the beach, which on
// Copacabana is what it would be.
const rioPALM_GAP_X = 4.6;      // half-width of the corridor, > a frond's reach
const rioPALM_GAP_Z0 = 0.5, rioPALM_GAP_Z1 = 11.0;
function rioInArrivalGap(x, z) {
  return Math.abs(x - rioSPAWN.x) < rioPALM_GAP_X && z > rioPALM_GAP_Z0 && z < rioPALM_GAP_Z1;
}

function rioBuildFlora(root) {
  const trunk = [], frond = [];
  for (let i = 0; i < rioPALM_N; i++) {
    let x, z;
    if (i < 26) { x = -90 + i * 7.2; z = rand(2.8, 5.2); }        // the promenade row
    else {
      // THEY WERE GROWING OUT OF THE GRANDSTAND.
      //
      // The old rule scattered z over 10..66 and pushed anything within twelve
      // metres of the avenue by +20 — straight on to the far rake, which spans
      // z 59.5 to 67, and into the roadway for anything that started at 34.
      // Coconut palms on Copacabana grow in the median between the calçadão and
      // the avenue, which is exactly the strip the ground is now painted as
      // garden: keep them there, and keep the whole Sambódromo clear.
      x = rand(-90, 90);
      z = rand(4.2, 10.8);
      if (i % 7 === 0) z = rand(68, 74);      // and a few in front of the arches
    }
    if (rioInArrivalGap(x, z)) continue;      // see rioPALM_GAP_X above
    const y = rioTerrain(x, z);
    const h = rand(5.0, 8.5);
    const lean = rand(-0.09, 0.09);
    rioPush9(trunk, x, y + h * 0.5, z, lean, rand(0, 6.28), lean * 0.6, 0.34, h, 0.34);
    // A COCONUT PALM IS A FOUNTAIN, NOT A PROPELLER.
    //
    // Six flat blades radiating dead level off the top of a stick photographs,
    // from a camera that looks down at 41 degrees, as a green asterisk — and
    // seventy-four of them is seventy-four asterisks, which is what the whole
    // promenade read as. A frond leaves the crown going UP and then arches over
    // and hangs; two segments per frond is the cheapest thing that has that
    // shape in it, and it costs one more instance in a batch that is already
    // one draw call.
    const tipX = x + lean * h, tipY = y + h - 0.25;
    for (let k = 0; k < 7; k++) {
      const a = k / 7 * 6.28 + rand(-0.16, 0.16);
      const L = rand(0.86, 1.12);
      const ca = Math.cos(a), sa = Math.sin(a);
      // the shaft, out of the crown and rising
      rioPush9(frond, tipX + ca * 0.95 * L, tipY + 0.34 * L, z + sa * 0.95 * L,
        -0.30, -a, 0, 2.1 * L, 0.09, 0.62);
      // and the arch, which falls away below the level of the crown
      rioPush9(frond, tipX + ca * 2.55 * L, tipY - 0.12 * L, z + sa * 2.55 * L,
        0.72, -a, 0, 2.3 * L, 0.08, 0.50);
    }
    // and a head of coconuts under the crown, which is the only part of a palm
    // anybody has ever been hit by
    rioPush9(trunk, tipX, tipY - 0.45, z, 0, 0, 0, 0.62, 0.5, 0.62);
  }
  rioInstance(root, rioG.cyl6, PALETTE.rioPalmTrunk, trunk, true, false);
  rioInstance(root, rioG.blade, PALETTE.rioPalm, frond, true, false);

  // forest on the hills — cones, instanced, only where the ground is high
  const tree = [];
  for (let i = 0; i < 260; i++) {
    const x = rand(-190, 190), z = rand(-150, 160);
    const y = rioTerrain(x, z);
    if (y < 3 || y > 52) continue;
    // NOT ON ARPOADOR. The rock at the end of the sand is a granite dome nine
    // metres out of a beach, and the height filter above was letting the Tijuca
    // scatter put an Atlantic-forest conifer on the summit of it — one dark
    // green cone standing on the one landmark in the chapter that is supposed
    // to be bare rock with people on it.
    const ax = x - rioARPOADOR.x, az = z - rioARPOADOR.z;
    if (ax * ax + az * az < (rioARPOADOR.r + 6) * (rioARPOADOR.r + 6)) continue;
    // nor on the two rocks in the bay, which are bare granite for the same
    // reason and are the skyline of the whole east half of the chapter
    const sx2 = x - rioSUGAR.x, sz2 = z - rioSUGAR.z;
    if (sx2 * sx2 + sz2 * sz2 < (rioSUGAR.r * 0.72) * (rioSUGAR.r * 0.72)) continue;
    const h = rand(3.5, 7.0);
    rioPush9(tree, x, y + h * 0.5, z, 0, rand(0, 6.28), 0, rand(2.2, 3.6), h, rand(2.2, 3.6));
  }
  rioInstance(root, rioG.cone6, PALETTE.rioForestDk, tree, false, false);
}

// ===================================================================== FX ====
/** Confetti and sequins, thrown on a good step. Same fixed-pool trick as the
 *  Cali sparks: no allocation once the game is running. */
function rioBuildSparks(root) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(rioSPARK_N * 3);
  const col = new Float32Array(rioSPARK_N * 3);
  for (let i = 0; i < rioSPARK_N * 3; i++) pos[i] = 0;
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({ size: 0.42, vertexColors: true, transparent: true, opacity: 0.95 });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  root.add(p);
  rioSpark = p;
}

const rioSparkCol = new THREE.Color();
const rioSPARK_HEX = [PALETTE.rioFeather1, PALETTE.rioFeather2, PALETTE.rioFeather3,
                      PALETTE.rioFeather4, PALETTE.rioSequin];
function rioBurstSparks(x, y, z, n, up) {
  if (!rioSpark) return;
  const colA = rioSpark.geometry.attributes.color.array;
  let made = 0;
  for (let i = 0; i < rioSPARK_N && made < n; i++) {
    const o = i * 7;
    if (rioSparkData[o + 6] > 0) continue;
    rioSparkData[o] = x + rand(-0.4, 0.4);
    rioSparkData[o + 1] = y;
    rioSparkData[o + 2] = z + rand(-0.4, 0.4);
    rioSparkData[o + 3] = rand(-2.2, 2.2);
    rioSparkData[o + 4] = rand(2.4, 5.2) * (up || 1);
    rioSparkData[o + 5] = rand(-2.2, 2.2);
    rioSparkData[o + 6] = rand(0.7, 1.5);
    rioSparkCol.set(rioSPARK_HEX[randInt(0, rioSPARK_HEX.length - 1)]);
    colA[i * 3] = rioSparkCol.r; colA[i * 3 + 1] = rioSparkCol.g; colA[i * 3 + 2] = rioSparkCol.b;
    made++;
  }
  rioSpark.geometry.attributes.color.needsUpdate = true;
}

function rioUpdateSparks(dt) {
  if (!rioSpark) return;
  const pos = rioSpark.geometry.attributes.position.array;
  let any = false;
  for (let i = 0; i < rioSPARK_N; i++) {
    const o = i * 7;
    if (rioSparkData[o + 6] <= 0) { pos[i * 3 + 1] = -999; continue; }
    rioSparkData[o + 6] -= dt;
    rioSparkData[o + 4] -= 9.0 * dt;          // confetti falls slowly, it is paper
    rioSparkData[o] += rioSparkData[o + 3] * dt;
    rioSparkData[o + 1] += rioSparkData[o + 4] * dt;
    rioSparkData[o + 2] += rioSparkData[o + 5] * dt;
    pos[i * 3] = rioSparkData[o];
    pos[i * 3 + 1] = rioSparkData[o + 1];
    pos[i * 3 + 2] = rioSparkData[o + 2];
    any = true;
  }
  if (any || rioSpark.geometry.attributes.position.needsUpdate) {
    rioSpark.geometry.attributes.position.needsUpdate = true;
  }
}

// ============================================================== THE DESFILE ==
// ================================================================= O BONDE ==
// THE SECOND MINI, and it was half built already: rioBuildLapa put forty-two
// arches and a deck across Lapa with the comment "where the tram runs", and
// then nothing ran on it, nothing could stand on it (there was no collider up
// there at all) and there was no way to get to it. Fifteen metres of the best
// view in the chapter, fenced off by an oversight.
//
// So: the bonde. The last open tram in the Americas, yellow, no doors, and
// everybody rides it hanging off the running board — which is what the running
// board on this one is for. It climbs a viaduct off Rua Lapa, crosses the whole
// aqueduct fifteen metres over the arches, and finishes where the deck goes
// into the hillside under Santa Teresa.
//
// AND THERE ARE TWO OF THEM. Santa Teresa's line is single track with passing
// loops, and the moment everybody who has ever ridden it remembers is the one
// where the other bonde comes the other way and the two running boards go past
// each other close enough to touch. That happens here, out in the middle of the
// arches, and it is when the caption lands.
//
// IT DOES NOT KNOCK YOU OFF. It was written that way first and it is a
// punishment for not knowing something the game never said — the whole point of
// the middle rung is that it is a bigger tick, not a harder task. The other
// bonde passes on its own track, a metre and a half clear, with the horn and a
// shake, and everybody keeps their footing.
const rioBONDE_Z = rioLAPA.z;
// THE GAUGE AND THE CAR BODY ARE ONE MEASUREMENT AND WERE FIRST WRITTEN AS TWO.
// At a gauge of 2.9, with a body 2.1 m wide and running boards 0.8 m out on each
// side, one bonde is 3.8 m across; two of them need 7.6 m of deck and the deck
// is 6. The pass they exist for could not physically have happened, and each car
// straddled its own parapet. A real bonde is about 2.1 m over the boards. It is
// 2.1 here, the gauge is 1.55, and what is left between the two running boards
// as they go past is 0.98 m — which is the gap everybody who has ridden that
// line remembers, and it is now a measurement rather than a claim.
const rioBONDE_GAUGE = 1.55;       // z offset of each track from the deck's centre line
const rioBONDE_SPD = 4.2;          // m/s
const rioBONDE_DWELL = 7.0;        // s at each terminus
const rioBONDE_HX = 4.3;           // half-length, along x
const rioBONDE_HZ = 0.72;
const rioBONDE_STEP = 0.55;        // the running board: one step up off the deck
const rioBONDE_ROOF = 2.95;
const rioBONDE_RIDE = 11.0;        // s aboard and moving that count on their own
let rioBondeDeckY = 0;             // filled in at build: the top of the aqueduct
let rioBondeNodes = null, rioBondeLen = null;
const rioBonde = [null, null];     // { group, body, u, dir, dwell, pu, pyaw }
const rioCabinFrame = { x: 0, z: 0 };
let rioBondeRideT = 0, rioBondeDone = false, rioBondePassed = false;
let rioBondeTold = false, rioBondeBell = 0;
const rioBondePos = new THREE.Vector3();

// ALWAYS through the dispatcher, never a bare synth: it is what supplies the
// default volume and pitch and what wraps every voice in a try/catch.
function rioBondeSfx(n, o) {
  const g = rioGame;
  if (g && typeof g.sfx === 'function') { try { g.sfx(n, o); } catch (e) {} }
}
function rioBondeToast(t) {
  const g = rioGame;
  if (g && typeof g.toast === 'function') { try { g.toast(t); } catch (e) {} }
}

/** Cumulative arc length along the line, so speed is metres and not nodes. */
function rioBondeInitRoute() {
  rioBondeLen = [0];
  for (let i = 1; i < rioBondeNodes.length; i++) {
    const a = rioBondeNodes[i - 1], b = rioBondeNodes[i];
    rioBondeLen.push(rioBondeLen[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
}
/** Point and grade at `u` metres along the line. */
function rioBondeAt(u, out) {
  const total = rioBondeLen[rioBondeLen.length - 1];
  const d = clamp(u, 0, total);
  let i = 1;
  while (i < rioBondeLen.length - 1 && rioBondeLen[i] < d) i++;
  const t = (d - rioBondeLen[i - 1]) / Math.max(0.001, rioBondeLen[i] - rioBondeLen[i - 1]);
  const a = rioBondeNodes[i - 1], b = rioBondeNodes[i];
  out.x = lerp(a[0], b[0], t);
  out.y = lerp(a[1], b[1], t);
  // GRADE IS THE SLOPE WITH INCREASING X, ALWAYS, and that normalisation is not
  // tidiness. This line runs from x = 38 to x = -42, so every segment has a
  // NEGATIVE dx, and a plain atan2(dy, dx) on the ramp returns 157 degrees
  // rather than -23: the trams rendered belly-up, and what the first screenshot
  // showed hanging off the viaduct was the underframe.
  const sgn = b[0] >= a[0] ? 1 : -1;
  out.grade = Math.atan2(sgn * (b[1] - a[1]), sgn * (b[0] - a[0]));
  return out;
}
const rioBondePt = { x: 0, y: 0, grade: 0 };

function rioBuildBonde(game, root) {
  const yBase = rioTerrain(rioLAPA.x, rioBONDE_Z);
  rioBondeDeckY = yBase + 14.375;             // the top face of rioBuildLapa's deck
  const groundX = 38;
  const gy = rioTerrain(groundX, rioBONDE_Z);
  // The line: the street terminus, the top of the viaduct, and the far end of
  // the aqueduct where the deck runs into the hill. The western half of the
  // arcade is inside Corcovado's flank (measured: the ground at x = -58 is
  // thirty-eight metres, twenty above the deck), which is why the line stops at
  // -42 rather than at the last pier.
  rioBondeNodes = [[groundX, gy + 0.35], [4.4, rioBondeDeckY], [-42, rioBondeDeckY]];
  rioBondeInitRoute();

  // ---- the viaduct, and the deck's missing floor -------------------------
  const V = rioMerger();
  // THE AQUEDUCT DECK NOW HAS ONE. rioBuildLapa drew a deck and never gave it a
  // body, so the top of the arches has been scenery for the whole life of this
  // chapter. Six metres wide, because two bondes have to pass on it.
  V.box(rioLAPA.x, rioBondeDeckY - 0.28, rioBONDE_Z, 64.8, 0.56, 6.0, PALETTE.rioArch);
  rioStaticBox(game, rioLAPA.x, rioBondeDeckY - 0.30, rioBONDE_Z, 64.8, 0.60, 6.0, 0);
  for (let s = -1; s <= 1; s += 2) {
    V.box(rioLAPA.x, rioBondeDeckY + 0.34, rioBONDE_Z + s * 2.95, 64.8, 0.68, 0.24,
          PALETTE.rioArchShade);
  }
  // the ramp off the east end: eight piers getting shorter, and a sloping deck
  {
    const x0 = 4.4, x1 = groundX;
    const N = 8;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const x = lerp(x0, x1, t);
      const top = lerp(rioBondeDeckY, gy + 0.35, t);
      const g2 = rioTerrain(x, rioBONDE_Z);
      const h = Math.max(0.4, top - g2 - 0.6);
      V.box(x, g2 + h * 0.5, rioBONDE_Z, 1.5, h, 2.6, PALETTE.rioArch);
      rioStaticBox(game, x, g2 + h * 0.5, rioBONDE_Z, 1.5, h, 2.6, 0);
    }
    // and the sloping deck itself, in six flat plates: a ramp made of one long
    // rotated box would be right and would also be a box the solver has to
    // resolve a capybara against at twenty-four degrees, which is a slide.
    const M2 = 12;
    for (let i = 0; i < M2; i++) {
      const t0 = i / M2, t1 = (i + 1) / M2;
      const ax = lerp(x0, x1, t0), bx = lerp(x0, x1, t1);
      const ay = lerp(rioBondeDeckY, gy + 0.35, t0), by = lerp(rioBondeDeckY, gy + 0.35, t1);
      const len = Math.hypot(bx - ax, by - ay);
      const ang = Math.atan2(by - ay, bx - ax);
      V.box((ax + bx) * 0.5, (ay + by) * 0.5 - 0.28, rioBONDE_Z, len + 0.30, 0.56, 6.0,
            PALETTE.rioArch, 0, 0, ang);
      rioStaticBox(game, (ax + bx) * 0.5, (ay + by) * 0.5 - 0.30, rioBONDE_Z,
                   len + 0.30, 0.60, 6.0, 0, ang);
      for (let s = -1; s <= 1; s += 2) {
        V.box((ax + bx) * 0.5, (ay + by) * 0.5 + 0.34, rioBONDE_Z + s * 2.95,
              len + 0.30, 0.68, 0.24, PALETTE.rioArchShade, 0, 0, ang);
      }
    }
  }
  // the rails, both tracks, all the way along — two thin strips and a sleeper
  // every two metres, which is the whole difference between a viaduct and a
  // viaduct that something obviously runs on
  {
    const total = rioBondeLen[rioBondeLen.length - 1];
    for (let d = 0; d < total; d += 2.0) {
      rioBondeAt(d, rioBondePt);
      const y = rioBondePt.y + 0.06;
      V.box(rioBondePt.x, y, rioBONDE_Z, 1.9, 0.09, 5.0, PALETTE.rioArchShade, 0, 0, rioBondePt.grade);
      for (let s = -1; s <= 1; s += 2) {
        for (let r = -1; r <= 1; r += 2) {
          V.box(rioBondePt.x, y + 0.09, rioBONDE_Z + s * rioBONDE_GAUGE + r * 0.62,
                2.0, 0.10, 0.12, PALETTE.rioTram, 0, 0, rioBondePt.grade);
        }
      }
    }
  }
  const vm = new THREE.Mesh(V.build(), rioVC());
  vm.castShadow = true; vm.receiveShadow = true;
  root.add(vm);

  // ---- the two bondes ----------------------------------------------------
  for (let k = 0; k < 2; k++) {
    const M = rioMerger();
    const HX = rioBONDE_HX, HZ = rioBONDE_HZ;
    const skin = k === 0 ? PALETTE.rioTramYellow : PALETTE.rioTramYellowDk;
    // the frame: a floor, a roof, and eight posts. A bonde has no walls at all
    // below the waist and that is the entire reason anybody rides it.
    M.box(0, 0.62, 0, HX * 2, 0.20, HZ * 2, PALETTE.rioTramDk);
    M.box(0, 1.02, 0, HX * 2 - 0.3, 0.62, HZ * 2 + 0.04, skin);
    M.box(0, rioBONDE_ROOF, 0, HX * 2 + 0.5, 0.18, HZ * 2 + 1.5, skin);
    // A CAP DOWN THE SPINE, NOT A LID. The first one was a dark plate over the
    // WHOLE roof, and from any camera above the horizon — which is every camera
    // in this game — the tram photographed as a black slab with a yellow skirt.
    M.box(0, rioBONDE_ROOF + 0.13, 0, HX * 2 - 1.2, 0.08, 0.55, PALETTE.rioTramDk);
    for (let i = 0; i < 5; i++) {
      const x = -HX + 0.5 + i * (HX * 2 - 1.0) / 4;
      for (let s = -1; s <= 1; s += 2) {
        M.box(x, 2.0, s * (HZ + 0.02), 0.13, 1.75, 0.13, PALETTE.rioTramDk);
      }
    }
    // the benches, which on a bonde run ACROSS and you get in from the side
    for (let i = 0; i < 5; i++) {
      const x = -HX + 0.85 + i * 1.65;
      M.box(x, 1.42, 0, 0.62, 0.12, HZ * 2 - 0.2, PALETTE.rioTramWood);
      M.box(x - 0.30, 1.72, 0, 0.10, 0.52, HZ * 2 - 0.2, PALETTE.rioTramWood);
    }
    // THE RUNNING BOARDS, both sides, and they are the deck this mini is about.
    for (let s = -1; s <= 1; s += 2) {
      M.box(0, rioBONDE_STEP, s * (HZ + 0.34), HX * 2, 0.14, 0.62, PALETTE.rioTramDk);
      M.box(0, rioBONDE_STEP + 0.66, s * (HZ + 0.62), HX * 2 - 0.4, 0.08, 0.08, PALETTE.rioTram);
    }
    // dash, headlamp, trolley pole and the number board
    for (let s = -1; s <= 1; s += 2) {
      M.box(s * HX, 1.35, 0, 0.14, 1.10, HZ * 2, skin);
      M.cyl(s * (HX - 0.05), 1.95, 0, 0.18, 0.22, PALETTE.rioTramWood, 0, 0, Math.PI / 2, 6);
      M.box(s * (HX - 0.2), 2.60, 0, 0.5, 0.28, 0.9, PALETTE.rioTramDk);
    }
    M.box(0.6, rioBONDE_ROOF + 0.9, 0, 2.6, 0.09, 0.09, PALETTE.rioTramDk, 0, 0, 0.32);
    // wheels
    for (let sx = -1; sx <= 1; sx += 2) {
      for (let sz = -1; sz <= 1; sz += 2) {
        M.cyl(sx * (HX - 1.3), 0.30, sz * (HZ - 0.18), 0.30, 0.16, PALETTE.rioTramDk,
              0, 0, Math.PI / 2, 8);
      }
    }
    const mesh = new THREE.Mesh(M.build(), rioVC());
    mesh.castShadow = true; mesh.receiveShadow = true;
    const grp = new THREE.Group();
    grp.name = 'rioBonde' + k;
    grp.add(mesh);
    root.add(grp);

    const b = new CANNON.Body({
      mass: 0, type: CANNON.Body.KINEMATIC,
      material: game.mats ? game.mats.ground : undefined,
    });
    // the saloon floor, the roof, and the two running boards. Nothing else: a
    // handrail you can stand on is a handrail you get stuck on.
    b.addShape(new CANNON.Box(new CANNON.Vec3(HX, 0.10, HZ)), new CANNON.Vec3(0, 0.62, 0));
    b.addShape(new CANNON.Box(new CANNON.Vec3(HX + 0.25, 0.09, HZ + 0.72)),
               new CANNON.Vec3(0, rioBONDE_ROOF, 0));
    for (let s = -1; s <= 1; s += 2) {
      b.addShape(new CANNON.Box(new CANNON.Vec3(HX, 0.07, 0.31)),
                 new CANNON.Vec3(0, rioBONDE_STEP, s * (HZ + 0.34)));
    }
    b.allowSleep = false;
    // Tram 0 starts at the street and goes up; tram 1 starts at the hill end and
    // comes down. Half a route apart, so they meet in the middle of the arches.
    const total = rioBondeLen[rioBondeLen.length - 1];
    const u0 = k === 0 ? 0 : total;
    rioBondeAt(u0, rioBondePt);
    const zz = rioBONDE_Z + (k === 0 ? 1 : -1) * rioBONDE_GAUGE;
    b.position.set(rioBondePt.x, rioBondePt.y, zz);
    b.previousPosition.copy(b.position);
    b.interpolatedPosition.copy(b.position);
    game.world.addBody(b);
    grp.position.copy(b.position);
    rioBonde[k] = { group: grp, body: b, u: u0, dir: k === 0 ? 1 : -1,
                    dwell: k === 0 ? 3.0 : 3.0, pu: u0, px: rioBondePt.x, py: rioBondePt.y, z: zz };
  }
  rioBondePos.copy(rioBonde[0].body.position);
}

/** True when the animal is on tram k — running board, floor or roof. */
function rioOnBonde(k, p) {
  const t = rioBonde[k];
  if (!t || !p) return false;
  const b = t.body;
  const dx = p.x - b.position.x, dz = p.z - b.position.z;
  return Math.abs(dx) < rioBONDE_HX + 0.5 && Math.abs(dz) < rioBONDE_HZ + 1.4 &&
         p.y > b.position.y + 0.2 && p.y < b.position.y + rioBONDE_ROOF + 2.6;
}

function rioUpdateBonde(game, dt) {
  if (!rioBonde[0] || dt <= 0) {
    for (let k = 0; k < 2; k++) if (rioBonde[k]) rioBonde[k].body.velocity.setZero();
    return;
  }
  const total = rioBondeLen[rioBondeLen.length - 1];
  const capy = game.capy;
  let aboard = -1;
  for (let k = 0; k < 2; k++) {
    const t = rioBonde[k];
    if (t.dwell > 0) {
      t.dwell -= dt;
      if (t.dwell <= 0) rioBondeSfx('chime', { volume: 0.35, pitch: 1.7 });
    } else {
      t.u += rioBONDE_SPD * dt * t.dir;
      if (t.u >= total) { t.u = total; t.dir = -1; t.dwell = rioBONDE_DWELL; }
      else if (t.u <= 0) { t.u = 0; t.dir = 1; t.dwell = rioBONDE_DWELL; }
    }
    rioBondeAt(t.u, rioBondePt);
    const b = t.body;
    // Kinematic, moved by VELOCITY, differenced against the PREVIOUS TARGET on
    // both moving axes. See CONTRACT: differencing against the body's own
    // position measures the distance the last velocity already covered.
    b.velocity.set(clamp((rioBondePt.x - t.px) / dt, -14, 14),
                   clamp((rioBondePt.y - t.py) / dt, -14, 14), 0);
    t.px = rioBondePt.x; t.py = rioBondePt.y;
    t.group.position.copy(b.interpolatedPosition);
    // Pitch on the MESH only (rule 4): the box the passenger stands on stays
    // level, and twenty-four degrees of ramp is not worth a rotating collider.
    // No yaw at all — a bonde is double-ended, with a dash and a headlamp at
    // both, so turning it round at the terminus would be four lines of sign
    // handling in exchange for a picture nobody could tell apart.
    t.group.rotation.set(0, 0, rioBondePt.grade, 'YXZ');
    if (capy && rioOnBonde(k, capy.position)) aboard = k;
  }
  rioBondePos.copy(rioBonde[0].body.position);

  // ---- the pass ----------------------------------------------------------
  // The two of them going past each other out on the arches, which is the
  // moment this whole ride exists for.
  const gap = Math.abs(rioBonde[0].body.position.x - rioBonde[1].body.position.x);
  const onArches = rioBonde[0].body.position.x < 2 && rioBonde[1].body.position.x < 2;
  if (gap < rioBONDE_HX * 2 + 1.5 && onArches) {
    if (!rioBondePassed) {
      rioBondePassed = true;
      rioBondeSfx('horn', { volume: 0.55, pitch: 1.35 });
      if (aboard >= 0) {
        if (game.shake) game.shake(0.16);
        if (!rioBondeDone && rioBondeRideT > 3) {
          rioBondeDone = true;
          rioTask('o-bonde');
        }
      }
    }
  } else if (gap > rioBONDE_HX * 2 + 6) {
    rioBondePassed = false;
  }

  // ---- the ride ----------------------------------------------------------
  const moving = aboard >= 0 && rioBonde[aboard].dwell <= 0;
  if (moving) {
    rioBondeRideT += dt;
    rioBondeBell -= dt;
    if (rioBondeBell <= 0) {
      rioBondeBell = 5.0;
      rioBondeSfx('chime', { volume: 0.30, pitch: 1.9 });
    }
    if (game.music && typeof game.music.swell === 'function' &&
        rioBonde[aboard].body.position.y > rioBondeDeckY - 3) {
      game.music.swell(0.24);
    }
    // The pass is the caption, but a player who boards at the wrong moment can
    // cross the whole aqueduct without meeting the other one — so eleven
    // seconds up on the arches pays it too. Nothing in this game may be
    // missable because of when you happened to arrive.
    if (!rioBondeDone && rioBondeRideT >= rioBONDE_RIDE &&
        rioBonde[aboard].body.position.y > rioBondeDeckY - 1) {
      rioBondeDone = true;
      rioTask('o-bonde');
    }
  } else if (aboard < 0) {
    rioBondeRideT = 0;
  }

  if (!rioBondeTold && !rioBondeDone && capy && capy.position) {
    const p = capy.position;
    const t0 = rioBonde[0].body.position;
    if (Math.hypot(p.x - t0.x, p.z - t0.z) < 14 && Math.abs(p.y - t0.y) < 6) {
      rioBondeTold = true;
      rioBondeToast('nobody sits down on this. the step is the seat.');
    }
  }
}

// ---- the calcadao, end to end ----------------------------------------------
// THE FIRST THING UNDER THE ANIMAL'S FEET AND THE LAST THING ANYBODY LOOKED AT.
// rioBuildCalcadao draws Burle Marx's wave — the most copied piece of paving on
// earth — for a hundred and ninety metres, gives it its own mesh so it is
// recognisable in the very first frame, and then the chapter sends the player
// inland and never mentions it again.
//
// So: run the wave. Not "be on it" — the whole thing, one end to the other,
// WITHOUT stepping off, which is the only way anybody has ever found out how
// long it is.
const rioCALC_Z0 = rioPROM_Z, rioCALC_Z1 = 2.6;
const rioCALC_RUN = 132;               // m of it that count, of about 190 drawn
let rioCalcDone = false, rioCalcFrom = 0, rioCalcOn = false;
let rioCalcMark = 0;                   // which quarter of the run has been marked

function rioCheckCalcadao(game) {
  if (rioCalcDone) return;
  const capy = game.capy;
  if (!capy || !capy.position) return;
  const p = capy.position;
  // ON THE PAVING, and the test is the band it is drawn in rather than a zone:
  // the sand is one step south of it and the road one step north, and stepping
  // off onto either is exactly the thing this task is measuring.
  const on = p.z > rioCALC_Z0 - 0.6 && p.z < rioCALC_Z1 + 0.6 &&
             Math.abs(p.x) < 94 && p.y < rioTerrain(p.x, p.z) + 1.6;
  if (!on) {
    // ---- AND STEPPING OFF IT NOW MEANS SOMETHING (v20) ------------------
    // The task is 'run the whole wave WITHOUT stepping off it' and stepping off
    // was completely silent: the counter reset and the player, who was probably
    // not watching their own z, had no idea it had happened until they reached
    // the end and nothing ticked. One soft note, and only if the run was
    // actually worth losing — under twenty metres is a person walking about.
    if (rioCalcOn && Math.abs(p.x - rioCalcFrom) > 20) {
      rioBondeSfx('thud', { volume: 0.20, pitch: 0.65 });
      rioBondeToast('off the paving. the wave starts again.');
    }
    rioCalcOn = false; rioCalcMark = 0; return;
  }
  if (!rioCalcOn) { rioCalcOn = true; rioCalcFrom = p.x; rioCalcMark = 0; return; }
  const run = Math.abs(p.x - rioCalcFrom);
  // ---- THIRTY-TWO SECONDS OF THE FIRST TASK IN THE CHAPTER, IN SILENCE ---
  // A hundred and thirty-two metres with nothing at all between the start and
  // the tick. Four marks, a step brighter each time, and the last one is one
  // stride short of the end so that finishing is a beat you can hear coming.
  // The same escalation the torii tunnel and the salsa floor got.
  const mark = Math.min(3, Math.floor(run / (rioCALC_RUN / 4)));
  if (mark > rioCalcMark) {
    rioCalcMark = mark;
    rioBondeSfx('tick', { volume: 0.20 + mark * 0.10, pitch: 1.0 + mark * 0.20 });
  }
  if (run >= rioCALC_RUN) {
    rioCalcDone = true;
    rioTask('calcadao');
    rioBondeSfx('chime', { volume: 0.6, pitch: 1.3 });
    // ---- AND THE END OF IT IS WORTH LANDING (v20) ----------------------
    // A hundred and thirty-two metres flat out, and the whole payoff was a
    // chime and a line of text — the same channel as walking into a kiosk.
    // Black-and-white chips off the paving under the animal and a kick, which
    // is the vocabulary this chapter already uses for Selarón's treads, plus
    // the frigatebirds going up off the sand, because a thing this loud should
    // move something that is not the player.
    rioBurstSparks(p.x, rioTerrain(p.x, p.z) + 0.9, p.z, 16, 1.1);
    if (rioGame && typeof rioGame.punch === 'function') rioGame.punch(0.12);
    rioBirdT += 0.9;                     // the flock breaks its circle
    rioBondeSfx('gull', { volume: 0.5, pitch: 1.35 });
    rioBondeToast('four kilometres of it in real life. you did a hundred and thirty.');
  }
}

// ---- the kiosk --------------------------------------------------------------
// Every few hundred metres of that beach there is a round kiosk that sells
// everything, and this chapter has exactly one drawn, with a counter along the
// seaward side, and nobody has ever been served at it. The counter is a step now
// as well as a shelf, which is the whole mechanism: get up, press E.
const rioKIOSK = { x: -8, z: -6 };
// ONE NUMBER, NOT TWO. The check stood at `rioKIOSK.z - 2.2` and the beacon
// pointed at `rioKIOSK.z - 2.6`, so the arrow in the HUD sent the player forty
// centimetres past the only place on the beach the counter can be reached from.
// Small, and exactly the sort of small that reads as the prompt not working.
const rioKIOSK_STAND = rioKIOSK.z - 2.4;
let rioKioskDone = false;

function rioCheckKiosk(game) {
  if (rioKioskDone) return;
  const capy = game.capy;
  const input = game.input;
  if (!capy || !capy.position || !input || !input.actionPressed) return;
  const p = capy.position;
  const dx = p.x - rioKIOSK.x, dz = p.z - rioKIOSK_STAND;
  if (dx * dx + dz * dz > 3.4 * 3.4) return;
  // ...AND IT HAS TO BE ON THE COUNTER. The test was a 3.4 m circle in PLAN
  // with no y in it at all, so standing on the sand beside the kiosk and
  // pressing E ticked it — measured at y 0.34, one press. The card says "the
  // crate is the way up, the counter is the shelf", and the crates, the counter
  // collider and the whole climb existed for a task that never asked.
  if (p.y < rioTerrain(rioKIOSK.x, rioKIOSK.z) + 1.6) return;
  rioKioskDone = true;
  rioTask('kiosk');
  rioBondeSfx('pop', { volume: 0.7, pitch: 1.2 });
  rioBondeSfx('splash', { volume: 0.35, pitch: 1.6 });
  rioBondeToast('mate, agua de coco, a biscoito, and no money changed hands.');
}

// ================================================================ FUTEVOLEI ==
/**
 * A GAME, NOT A STILL LIFE.
 *
 * The court has a net, two posts, four people and a ball, and the chapter then
 * asks the player to head that ball into the Atlantic — which is only a joke if
 * somebody was using it. Nobody was: the ball went to sleep on the sand about a
 * second after the biome loaded and the four players were `rioPPL_STAND`, whose
 * only motion is a bounce keyed to how near the parade is, and the parade is a
 * hundred metres away up the avenue.
 *
 * So they rally. Every second and a half the player nearest the ball puts it
 * back over the net, which is one impulse and a wake-up; the pose in
 * rioUpdatePeople does the rest, because a person who is watching the ball and
 * leaving the ground for it reads as playing from anywhere on the beach.
 *
 * Three things it will not do, and all three are the difference between a toy
 * and an irritation: it never touches the ball while the capybara is on it, it
 * stops entirely once the ball is out of the court, and it goes quiet the
 * moment the task is done — at which point they cheer, because somebody has
 * just put their ball in the sea.
 */
const rioVOLEI_COOL = 1.5;
function rioUpdateVolei(game, dt) {
  if (rioVoleiCel > 0) rioVoleiCel -= dt;
  if (!rioBallBody || rioVoleiDone) return;
  if (rioVoleiT > 0) { rioVoleiT -= dt; return; }
  const b = rioBallBody.position;
  const vy = rioTerrain(rioVOLEI.x, rioVOLEI.z);
  if (Math.abs(b.x - rioVOLEI.x) > 6.5 || Math.abs(b.z - rioVOLEI.z) > 5.5 ||
      b.y > vy + 4.5 || b.y < vy - 1) { rioVoleiT = 1.0; return; }
  // hands off while the animal has it: this is the one prop in the chapter the
  // player is meant to be stealing
  const cp = game.capy && game.capy.position;
  if (cp && Math.hypot(cp.x - b.x, cp.z - b.z) < 2.0) { rioVoleiT = 1.2; return; }
  // still in the air off the last touch — let it come down
  const v = rioBallBody.velocity;
  if (v.y > 1.4 || Math.hypot(v.x, v.z) > 4.5) { rioVoleiT = 0.25; return; }
  // whose side is it on, and who is nearest
  const side = b.z > rioVOLEI.z ? 1 : -1;
  let best = -1, bd = 1e9;
  for (let q = 0; q < rioVoleiIdx.length; q++) {
    const o = rioVoleiIdx[q] * 7;
    if ((rioPplData[o + 2] - rioVOLEI.z > 0 ? 1 : -1) !== side) continue;
    const d = Math.hypot(rioPplData[o] - b.x, rioPplData[o + 2] - b.z);
    if (d < bd) { bd = d; best = rioVoleiIdx[q]; }
  }
  if (best < 0) { rioVoleiT = 0.6; return; }
  if (best === rioVoleiLast && rioVoleiIdx.length > 1) {
    // never the same person twice running: a rally is a rally
    rioVoleiT = 0.4; rioVoleiLast = -1; return;
  }
  rioVoleiLast = best;
  rioVoleiT = rioVOLEI_COOL * rand(0.75, 1.35);
  // over the net, to a spot on the far side, with a good deal of loft on it
  const tz = rioVOLEI.z - side * rand(1.8, 3.4);
  const tx = rioVOLEI.x + rand(-3.2, 3.2);
  const flight = 0.95;
  rioBallBody.wakeUp();
  rioBallBody.velocity.set((tx - b.x) / flight, 5.6 + rand(0, 1.4), (tz - b.z) / flight);
  rioBallBody.angularVelocity.set(rand(-6, 6), rand(-6, 6), rand(-6, 6));
  // A METRONOME, AND A MONO ONE. Measured standing still 14.6 m away for
  // ninety seconds: 56 thuds, one every 1.6 s, centre channel, forever. The
  // hand-rolled distance law here is the exact thing v16 replaced — it does not
  // pan, so the ball is always in the middle of your head. With a bearing on it
  // the rally is a thing happening over there, which is what it is; and 16 m is
  // where a ball being kicked stops being your business.
  if (typeof game.sfx === 'function' && cp) {
    const far = Math.hypot(cp.x - b.x, cp.z - b.z);
    if (far < 16) game.sfx('thud', { volume: 0.30, pitch: 1.5, at: { x: b.x, y: b.y, z: b.z } });
  }
}

function rioTask(id) {
  const g = rioGame;
  if (g && typeof g.completeTask === 'function') g.completeTask(id);
}

/** Where the head of the column is right now. */
function rioColumnX() { return rioBateriaX; }

/** Is (x, z) inside the moving column? */
function rioInCol(x, z) {
  return Math.abs(x - rioBateriaX) < rioCOL_HX && Math.abs(z - rioAVE_Z) < rioCOL_HZ;
}

/** Walk the parade down the avenue and pump it on the beat. */
function rioUpdateParade(game, dt) {
  rioBateriaX += rioPARADE_SPEED * dt;
  let wrapped = false;
  if (rioBateriaX > rioAVE_X1 + 24) {
    // ---- IT DOES NOT WRAP OUT FROM UNDER YOU (v20) --------------------
    //
    // The column teleports two hundred and sixteen metres up the avenue when
    // it runs out of road, and the chapter's ONE `wow` — six consecutive
    // surdos, keeping station inside it — is scored on being inside the column.
    // So a player who joined near the east end had the parade vanish mid-run,
    // the combo lapse three seconds later, and no explanation of any kind; a
    // player standing on the float went with it as far as the solver allowed
    // and then did not.
    //
    // It holds instead. The head simply waits at the end of the avenue until
    // the animal is clear, which is also what a desfile actually does — the
    // section stops at the end of the sambadrome and the drums keep going. The
    // cap is there so a player who parks in the column for ever does not pin
    // the parade at the east end for the rest of the chapter.
    const cp = game.capy && game.capy.position;
    const held = !!(cp && Math.abs(cp.x - rioBateriaX) < rioCOL_HX + 14 &&
                    Math.abs(cp.z - rioAVE_Z) < rioCOL_HZ + 10) && rioParadeHold < rioPARADE_HOLD_MAX;
    if (held) {
      rioParadeHold += dt;
      rioBateriaX = rioAVE_X1 + 24;      // marking time at the end of the road
    } else {
      rioParadeHold = 0;
      rioBateriaX = rioAVE_X0 - 24;
      wrapped = true;
    }
  } else if (rioParadeHold > 0) rioParadeHold = 0;

  const mus = game.music;
  // The pump is driven by the audio clock, never by a timer of its own — a
  // parallel clock drifts out of sync with what the player hears inside a
  // minute, which is the whole reason game.music exists.
  let beatPhase = 0;
  if (mus && mus.playing) {
    const b = mus.beats();
    // samba is in 2/4 and the surdo is on the two: the section drops on the
    // odd beats and comes back up on the ones.
    const onTwo = ((Math.round(b) % 2) + 2) % 2 === 1;
    beatPhase = Math.max(0, 1 - Math.abs(mus.off()) * 2.4) * (onTwo ? 1 : 0.45);
  }
  // The salute forces the section to full pump whatever the audio clock is
  // doing, because a band acknowledging somebody does not wait for the two.
  if (rioSalute > 0) { rioSalute -= dt; beatPhase = Math.max(beatPhase, 0.85); }
  rioBateriaPulse = damp(rioBateriaPulse, beatPhase, 14, dt);

  if (rioBateriaGroup) {
    const y = rioTerrain(rioBateriaX, rioAVE_Z);
    rioBateriaGroup.position.set(rioBateriaX, y + rioBateriaPulse * 0.16, rioAVE_Z);
    let yaw = -Math.PI * 0.5;                        // facing the way they are going
    if (rioSalute > 0) {
      const cp = game.capy && game.capy.position;
      if (cp) {
        const want = Math.atan2(cp.x - rioBateriaX, cp.z - rioAVE_Z);
        let d = want - yaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        yaw += d * clamp(rioSalute / 3.4, 0, 1);
      }
    }
    rioBateriaGroup.rotation.y = yaw;
  }

  // ---- the confetti, and the paper that is always in the air over an avenue
  // that has had a parade down it. Streamed rather than burst: a fountain that
  // keeps arriving is what a float actually throws, and the pool is fixed so
  // it costs nothing when nothing is asking for it.
  if (rioConfetti > 0) {
    rioConfetti -= dt;
    const fx = rioBateriaX - 15;
    if (Math.random() < dt * 34) {
      rioBurstSparks(fx + rand(-2, 2), rioTerrain(fx, rioAVE_Z) + 6.4, rioAVE_Z + rand(-2, 2), 3, 1.4);
    }
  } else if (Math.random() < dt * 1.4) {
    // and one piece of it, drifting down over the stand, for ever
    const cx = rioBateriaX + rand(-24, 10);
    rioBurstSparks(cx, rioTerrain(cx, rioAVE_Z) + rand(4, 9), rioAVE_Z + rand(-13, 13), 1, 0.1);
  }
  if (rioFloatGroup) {
    const fx = rioBateriaX - 15;
    rioFloatGroup.position.set(fx, rioTerrain(fx, rioAVE_Z), rioAVE_Z);
    rioFloatGroup.rotation.y = -Math.PI * 0.5;
  }

  // ---- and the two of them are solid now ---------------------------------
  // Contract: a kinematic body is integrated from its own velocity inside
  // world.step, so the velocity is derived from the difference between the
  // NEW target and the PREVIOUS target — never from the body's own position,
  // which is where the last velocity already put it. On the wrap the column
  // teleports two hundred and sixteen metres up the avenue; the velocity has
  // to be zero for that frame or the solver launches whatever it is touching.
  if (rioBateriaBody) {
    const inv = dt > 1e-5 ? 1 / dt : 60;
    const vx = wrapped ? 0 : (rioBateriaX - rioBateriaPX) * inv;
    rioBateriaBody.velocity.set(clamp(vx, -12, 12), 0, 0);
    rioBateriaBody.position.set(rioBateriaX, rioTerrain(rioBateriaX, rioAVE_Z), rioAVE_Z);
    rioSyncBody(rioBateriaBody);
    if (rioFloatBody) {
      const fx = rioBateriaX - 15;
      rioFloatBody.velocity.copy(rioBateriaBody.velocity);
      rioFloatBody.position.set(fx, rioTerrain(fx, rioAVE_Z), rioAVE_Z);
      rioSyncBody(rioFloatBody);
    }
    rioBateriaPX = rioBateriaX;
  }
}

/**
 * THE SAMBA.
 *
 * A step counts when the capybara does something deliberate — turns hard, hops
 * or wheeks — within rioBEAT_WINDOW of a beat, WHILE INSIDE the moving column,
 * AND when that beat is a two.
 *
 * The third condition is the chapter. Cali accepts any beat, which is correct
 * for salsa; accepting any beat here would make Rio a re-skin. Samba is 2/4 and
 * the surdo is the two, so hitting the one is not a near miss — it is the wrong
 * beat, and it breaks the run. It gets its own feedback for that reason: a
 * player who is told "too early" when they were actually dead on the wrong beat
 * will keep doing exactly the same thing.
 *
 * Two things keep it fair rather than fiddly, both inherited from Cali because
 * they were right there:
 *   - one step per beat at most, with a cooldown under the beat length, so
 *     mashing cannot score;
 *   - the combo LAPSES rather than resets when you fall out of the column, so
 *     being shoved by a passing float is not a punishment.
 */
function rioUpdateSamba(game, dt) {
  const capy = game.capy;
  if (!capy || !capy.position) return;
  const p = capy.position;
  const on = rioInCol(p.x, p.z) &&
             Math.abs(p.y - rioTerrain(p.x, rioAVE_Z)) < 4;

  if (on !== rioInColumn) {
    rioInColumn = on;
    if (on) {
      rioOutT = 0;
      if (!rioBateriaDone) {
        rioBateriaDone = true;
        rioTask('bateria');
        if (typeof game.toast === 'function') game.toast('a hundred and fifty drums, and one rodent');
        if (typeof game.sfx === 'function') game.sfx('chime', { volume: 0.8 });
      }
      if (!rioSambaDone && typeof game.toast === 'function') {
        game.toast(game.music && game.music.playing
          ? 'keep up — and only on the TWO'
          : 'keep up with them, and move on the second beat');
      }
    }
  }
  if (!on) {
    rioOutT += dt;
    if (rioOutT > rioSAMBA_DROP && rioCombo > 0) rioCombo = 0;
  }

  if (rioStepCool > 0) rioStepCool -= dt;
  rioFlash = damp(rioFlash, 0, 6, dt);
  rioWrongFlash = damp(rioWrongFlash, 0, 5, dt);

  if (!rioInColumn || rioSambaDone) return;

  // --- did the player just DO something? ---
  const yaw = capy.group ? capy.group.rotation.y : 0;
  let turned = Math.abs(yaw - rioLastYaw);
  while (turned > Math.PI) turned = Math.abs(turned - Math.PI * 2);
  const input = game.input;
  const acted = turned > rioSTEP_MIN_TURN * dt * 12 ||
                (input && (input.jumpPressed || input.honkPressed));
  rioLastYaw = yaw;
  if (!acted || rioStepCool > 0) return;

  const mus = game.music;
  if (!mus || !mus.playing) return;
  const beats = mus.beats();
  const beatIdx = Math.round(beats);
  if (beatIdx === rioLastBeat) return;                 // one step per beat
  const off = Math.abs(mus.off());
  rioStepCool = rioSTEP_COOL;
  rioLastBeat = beatIdx;

  const onTwo = ((beatIdx % 2) + 2) % 2 === 1;
  const y = rioTerrain(p.x, p.z) + 0.3;

  if (off > rioBEAT_WINDOW) {
    // not on any beat — sloppy
    if (rioCombo > 0) {
      rioCombo = 0;
      if (typeof game.sfx === 'function') game.sfx('thud', { volume: 0.22, pitch: 0.7 });
    }
    return;
  }
  if (!onTwo) {
    // dead on the ONE. The commonest way to get samba wrong, and worth saying so.
    rioWrongFlash = 1;
    if (rioCombo > 0) {
      rioCombo = 0;
      if (typeof game.toast === 'function') game.toast('that was the one. the surdo is on the TWO.');
    }
    if (typeof game.sfx === 'function') game.sfx('thud', { volume: 0.30, pitch: 0.55 });
    return;
  }

  // --- on the two ---
  rioCombo++;
  if (rioCombo > rioBestCombo) {
    rioBestCombo = rioCombo;
    if (typeof game.record === 'function') game.record('samba-parade', rioBestCombo);
  }
  rioFlash = 1;
  rioBurstSparks(p.x, y + 0.4, p.z, 5 + Math.min(8, rioCombo * 2), 1);
  if (typeof game.sfx === 'function') {
    game.sfx('tick', { volume: clamp(0.55 + rioCombo * 0.06, 0.55, 1), pitch: 0.9 + rioCombo * 0.04 });
  }
  // ---- AND A HUNDRED AND FIFTY DRUMMERS NOTICE (v20) -------------------
  // The run to six paid out at six and nowhere else, so five of the six steps
  // were an identical click inside a section that is already playing. The
  // section itself answers from the third: rioBateriaPulse is what the whole
  // bateria bobs on, so forcing it means the drums visibly come UP under you,
  // and one voice out of the ala goes with it. Cali's floor got the same
  // treatment and for the same reason — an escalation you can hear is the
  // difference between counting and being carried.
  if (rioCombo >= 2) {
    const k = Math.min(rioCombo - 1, 5);
    rioBateriaPulse = Math.max(rioBateriaPulse, 0.45 + k * 0.11);
    if (typeof game.sfx === 'function') {
      game.sfx('cheer', { volume: 0.09 + k * 0.05, pitch: 1.0 + k * 0.06,
                          at: { x: rioBateriaX, y: rioTerrain(rioBateriaX, rioAVE_Z) + 1.4, z: rioAVE_Z } });
    }
  }
  if (rioCombo === 3 && typeof game.toast === 'function') game.toast('isso!');
  if (rioCombo >= rioSAMBA_TARGET) {
    rioSambaDone = true;
    rioTask('samba-parade');
    rioBurstSparks(p.x, y + 0.8, p.z, 22, 1.5);
    // punch, not shake: the calçadão already uses it forty lines up, on an
    // event a fifth the size of this one. Same 0..1 magnitude, four letters.
    if (typeof game.punch === 'function') game.punch(0.22);
    else if (typeof game.shake === 'function') game.shake(0.22);
    if (typeof game.toast === 'function') game.toast('the whole bateria just clocked a capybara.');
    // ---- THE SALUTE ------------------------------------------------------
    // The toast has always said the bateria clocked you. Now it does: the
    // whole section turns off its line and faces the animal for four seconds,
    // the float opens up, and the stand behind them comes to its feet. It is
    // four lines and one timer, and it is the difference between a tick and a
    // moment — the chapter's centrepiece was ending on a toast.
    rioSalute = 4.2;
    rioConfetti = 3.0;
    if (game.music && typeof game.music.swell === 'function') game.music.swell(0.85);
    // THE LOUDEST CUE IN THE CHAPTER WAS THE ONLY MONO ONE. The five
    // escalation cheers above it, at a fifth the volume, all carry `at:`.
    if (typeof game.sfx === 'function') {
      game.sfx('cheer', { volume: 1.0, force: true,
                          at: { x: rioBateriaX, y: rioTerrain(rioBateriaX, rioAVE_Z) + 1.4, z: rioAVE_Z } });
    }
    // ---- FRAMED (v26) ----------------------------------------------------
    // Measured at the payout: dist 7.2 m, pitch 45.1 degrees — the untouched
    // chase cam, looking down at grey asphalt and drum lids. The salute the
    // four lines above just started (the bateria turning, the float 15 m back,
    // both rakes coming to their feet, the confetti) was entirely outside the
    // frame. One bearing puts all of it in: the camera east of the column
    // looking back west down the avenue, low and long.
    if (typeof game.frameShot === 'function') {
      game.frameShot({ yaw: Math.PI * 0.5, dist: 16, pitch: 12 * Math.PI / 180,
                       raise: 1.6, hold: 4.0 });
    }
  }
}

// =============================================================== THE REST ====
function rioUpdateTasks(game, dt) {
  const capy = game.capy;
  if (!capy || !capy.position) return;
  const p = capy.position;
  const input = game.input;

  // --- the biscoito Globo man -----------------------------------------------
  if (!rioGloboDone) {
    const dx = p.x - rioGLOBO.x, dz = p.z - rioGLOBO.z;
    if (dx * dx + dz * dz < 3.0 * 3.0 && input && input.actionPressed) {
      rioGloboDone = true;
      rioTask('globo-biscuit');
      if (rioGloboGroup) {
        // he keeps the pole; the capybara gets the bag
        rioGloboGroup.rotation.y += 0.9;
      }
      rioBurstSparks(p.x, rioTerrain(p.x, p.z) + 1.2, p.z, 8, 1);
      if (typeof game.toast === 'function') game.toast('one real, and it did not pay');
      if (typeof game.sfx === 'function') game.sfx('pop', { volume: 0.9 });
    }
  }

  // --- futevolei: the ball goes in the Atlantic ------------------------------
  if (!rioVoleiDone && rioBallBody) {
    if (rioBallBody.position.z < rioSHORE_Z - 1.5 && rioBallBody.position.y < rioSEA_Y + 1.2) {
      rioVoleiDone = true;
      rioVoleiCel = 4.0;
      rioTask('futevolei');
      if (typeof game.toast === 'function') game.toast('nobody is getting that back');
      if (typeof game.sfx === 'function') game.sfx('splash', { volume: 0.9 });
    }
  }

  // --- Selaron's steps, against the clock ------------------------------------
  if (!rioSelaronDone) {
    const foot = rioSelaronFoot(), head = rioSelaronHead();
    const df = (p.x - foot.x) * (p.x - foot.x) + (p.z - foot.z) * (p.z - foot.z);
    const dh = (p.x - head.x) * (p.x - head.x) + (p.z - head.z) * (p.z - head.z);
    if (df < 5 * 5) {
      if (rioSelaronT < 0) {
        rioSelaronT = 0;
        // ONCE. The clock re-arms every time you come within five metres of the
        // foot, and Lapa is somewhere the chapter walks you through on the way
        // to three other things — so passing the steps twice printed the same
        // instruction twice, and passing them six times printed it six times.
        // The clock still restarts; the LINE does not.
        if (!rioSelaronTold && typeof game.toast === 'function') {
          rioSelaronTold = true;
          game.toast('two hundred and fifteen of them. go.');
        }
      } else rioSelaronT = 0;              // re-entering the bottom restarts the clock
    } else if (rioSelaronT >= 0) {
      rioSelaronT += dt;
      // ---- AND THE TILES COME OFF UNDER YOU -------------------------------
      // The flight is timed and there was no feedback at all between the "go"
      // and the verdict eight and a half seconds later — the one task in the
      // chapter that is purely about SPEED had nothing in it that reported
      // speed. Chips of tile off the treads, in Selarón's own colours, and
      // they only appear while the clock is running, so they are also the
      // clearest possible signal that it IS running.
      const sp2 = capy.velocity ? Math.hypot(capy.velocity.x, capy.velocity.z) : 0;
      if (sp2 > 4 && Math.random() < dt * 26) {
        rioBurstSparks(p.x + rand(-0.5, 0.5), rioTerrain(p.x, p.z) + 0.25, p.z - 0.6, 1, 0.45);
      }
      if (dh < 6 * 6) {
        if (rioSelaronT <= rioSELARON_PAR) {
          rioSelaronDone = true;
          rioTask('selaron-steps');
          if (typeof game.record === 'function') game.record('selaron-steps', rioSelaronT);
          rioBurstSparks(p.x, rioTerrain(p.x, p.z) + 1.0, p.z, 14, 1.2);
          if (typeof game.toast === 'function') game.toast('twenty years of tiling, taken in ' + rioSelaronT.toFixed(1) + ' seconds');
          if (typeof game.sfx === 'function') game.sfx('chime', { volume: 0.9 });
        } else {
          rioSelaronT = -1;
          if (typeof game.toast === 'function') game.toast('too slow. go back down and run it.');
        }
      } else if (rioSelaronT > rioSELARON_PAR * 2.2) {
        rioSelaronT = -1;                  // wandered off; forget about it
      }
    }
  }

  // --- the bondinho ----------------------------------------------------------
  if (rioRiding && !rioBondinhoDone && rioCabinT > 0.86) {
    rioBondinhoDone = true;
    rioTask('bondinho');
    if (typeof game.toast === 'function') game.toast('no ticket, no queue, no questions');
    if (typeof game.sfx === 'function') game.sfx('chime', { volume: 0.9 });
  }

  // --- Arpoador --------------------------------------------------------------
  if (!rioArpoadorDone) {
    const dx = p.x - rioARPOADOR.x, dz = p.z - rioARPOADOR.z;
    if (dx * dx + dz * dz < 8 * 8 && p.y > rioTerrain(rioARPOADOR.x, rioARPOADOR.z) - 2.5) {
      rioArpoadorDone = true;
      rioTask('arpoador');
      rioBurstSparks(p.x, p.y + 1.0, p.z, 20, 1.3);
      // AND THE ROCK ACTUALLY CLAPS. rioUpdatePeople reads this: the twenty-two
      // up here come off their heels for six seconds. The line below has been
      // claiming they do since the chapter shipped.
      rioClap = 6.0;
      if (typeof game.shake === 'function') game.shake(0.14);
      // they applaud the sunset here every evening. Tonight they are applauding
      // something else.
      if (typeof game.toast === 'function') game.toast('the whole rock is clapping. some of it is for the sunset.');
      if (typeof game.sfx === 'function') game.sfx('cheer', { volume: 0.95 });
    }
  }
}

/**
 * The cable car. A kinematic body shuttling station -> Urca -> summit and back,
 * carrying whatever is standing on it.
 *
 * Carrying is done by adding the cabin's own displacement to the capybara's
 * body rather than by a constraint: the animal keeps full control of itself the
 * whole way up (it can walk about on the floor, or step off, which it should be
 * allowed to do at sixty metres), and the nudge is a couple of centimetres a
 * frame — far under capybara.js's teleport threshold, so its render prediction
 * damps it out invisibly.
 */
function rioUpdateCabin(game, dt) {
  if (!rioCabinBody) return;
  rioCabinT += rioCabinDir * dt * 0.028;
  if (rioCabinT > 1) { rioCabinT = 1; rioCabinDir = -1; }
  if (rioCabinT < 0) { rioCabinT = 0; rioCabinDir = 1; }

  rioCablePoint(rioCabinT, rioV3);
  const nx = rioV3.x, ny = rioV3.y - 2.6, nz = rioV3.z;   // the floor hangs below the cable
  const dx = nx - rioCabinPX, dy = ny - rioCabinPY, dz = nz - rioCabinPZ;

  rioCabinBody.position.set(nx, ny, nz);
  rioSyncBody(rioCabinBody);
  // The velocity stays ZERO on purpose, which looks wrong and is not.
  //
  // A kinematic body in cannon is integrated from its velocity, so giving this
  // one an honest velocity AND writing its position by hand moves it twice; and
  // worse, the rider then gets dragged by contact friction on top of the carry
  // below. The capybara crept forward relative to the floor it was standing on
  // a few centimetres a second, walked off the front of the car about five
  // seconds into the ride, and fell into the bay. One carry, not two.
  rioCabinBody.velocity.set(0, 0, 0);
  // ...but the FRAME is published, which is a different thing from the body's
  // velocity and is the channel capybara.js actually wants. Seven biomes
  // already answer carryFrame(); Rio did not, so the sixty-metre climb was
  // carried by a bare position write and nothing else on the cabin floor moved
  // at all. The frame is the cabin's real ground speed, derived from the
  // displacement we just applied.
  rioCabinFrame.x = dt > 0 ? dx / dt : 0;
  rioCabinFrame.z = dt > 0 ? dz / dt : 0;
  if (rioCabinGroup) rioCabinGroup.position.set(nx, ny + 1.3, nz);

  // is the capybara aboard?
  const capy = game.capy;
  rioRiding = false;
  if (capy && capy.position && capy.body) {
    const ox = capy.position.x - nx, oz = capy.position.z - nz;
    const oy = capy.position.y - ny;
    if (Math.abs(ox) < 1.5 && Math.abs(oz) < 1.5 && oy > -0.2 && oy < 2.6) {
      rioRiding = true;
      capy.body.position.x += dx;
      capy.body.position.y += dy;
      capy.body.position.z += dz;
      capy.body.previousPosition.x += dx;
      capy.body.previousPosition.y += dy;
      capy.body.previousPosition.z += dz;
      capy.body.interpolatedPosition.x += dx;
      capy.body.interpolatedPosition.y += dy;
      capy.body.interpolatedPosition.z += dz;
      // THE SCORE GOES UP WITH THE CAR. The bonde does this over the arches
      // and the cable car — which climbs sixty metres out of the bay and is
      // the biggest single change of altitude in the chapter — did not. Held
      // rather than fired: swell() takes the max of the live envelope, so
      // calling it every frame of the climb keeps the lift up for exactly as
      // long as the car is high and lets it fall away on its own.
      if (game.music && typeof game.music.swell === 'function' && rioCabinT > 0.18) {
        game.music.swell(0.20 + clamp((ny - 12) / 52, 0, 1) * 0.45);
      }
    }
  }

  rioCabinPX = nx; rioCabinPY = ny; rioCabinPZ = nz;
}

// ==================================================================== API ====
function rioIsOverWater(x, z) {
  if (z > rioSHORE_Z) return false;
  // the two rocks stand out of the sea; you are not swimming on those
  const sx = x - rioSUGAR.x, sz = z - rioSUGAR.z;
  if (sx * sx + sz * sz < rioSUGAR.r * rioSUGAR.r) return false;
  const ux = x - rioURCA.x, uz = z - rioURCA.z;
  if (ux * ux + uz * uz < rioURCA.r * rioURCA.r) return false;
  const ax = x - rioARPOADOR.x, az = z - rioARPOADOR.z;
  if (ax * ax + az * az < rioARPOADOR.r * rioARPOADOR.r) return false;
  return true;
}

function rioInZone(name, x, z) {
  if (name === 'avenue') {
    return x > rioAVE_X0 && x < rioAVE_X1 && Math.abs(z - rioAVE_Z) < 9.5;
  }
  if (name === 'column') return rioInCol(x, z);
  if (name === 'beach') return z > rioSHORE_Z && z < rioPROM_Z && Math.abs(x) < 92;
  if (name === 'calcadao') return z >= rioPROM_Z && z < 3.2 && Math.abs(x) < 96;
  if (name === 'arpoador') {
    const dx = x - rioARPOADOR.x, dz = z - rioARPOADOR.z;
    return dx * dx + dz * dz < rioARPOADOR.r * rioARPOADOR.r;
  }
  // THE ARCHES WERE IN NO ZONE AT ALL. `santateresa` starts at z 82; the
  // aqueduct runs at z 76 across x -42..38, so **eighty metres of stone
  // viaduct — the deck the bonde task walks, and the loudest landmark in this
  // half of the chapter — footfalled as beach sand**. Selarón's flight above
  // it (z 84..118.7) does land in the zone, which is why nobody noticed.
  // Widened rather than given a zone of its own: it is the same stone.
  if (name === 'santateresa') return z > 70 && x < 40;
  return false;
}

// =============================================================== LIFECYCLE ===
export function createRio(game) {
  rioGame = game;

  game.biome.register('rio', {
    ensureBuilt() { rioBuild(game); },
    onEnter() {
      rioCombo = 0; rioLastBeat = -1; rioInColumn = false; rioOutT = 0;
      rioSelaronT = -1; rioRiding = false;
      // Put the column somewhere the player can see it coming rather than
      // wherever it happened to be when they left.
      rioBateriaX = rioAVE_X0 + 20;
      rioBateriaPX = rioBateriaX;
      rioParadeHold = 0;
      rioBondeRideT = 0; rioBondePassed = false; rioBondeTold = false;
      rioSalute = 0; rioConfetti = 0; rioClap = 0;
      rioWaveRide = 0; rioWaveFrom = 1e9; rioWaveSurf = 0;
      rioVoleiT = 3.0; rioVoleiLast = -1; rioVoleiCel = 0;
      // ---- AND THE BALL COMES BACK OUT OF THE ATLANTIC (v20) -----------
      //
      // The one-shot-mini family, for the fourth time in this project (Quay's
      // chip basket, Kyoto's matcha heap, Cali's lulada jug). 'Head the ball
      // into the Atlantic' ends with the ball IN the Atlantic, and nothing
      // ever put it back: come to Rio a second time — which the departures
      // board allows from anywhere — and the court is four people, a net, and
      // no ball, with the rally permanently stopped because rioVoleiDone gates
      // it. The CHECKLIST stays ticked; the BALL is a thing in the world.
      //
      // Only if it has actually left the court: a ball the player has carried
      // up the beach is theirs, and snatching it back on a re-entry is the
      // rudest possible way to fix this.
      if (rioBallBody) {
        const vy = rioTerrain(rioVOLEI.x, rioVOLEI.z);
        const b = rioBallBody.position;
        if (Math.abs(b.x - rioVOLEI.x) > 9 || Math.abs(b.z - rioVOLEI.z) > 8 || b.y < vy - 1.5) {
          b.set(rioVOLEI.x + 1.6, vy + 0.9, rioVOLEI.z - 2.2);
          rioBallBody.velocity.set(0, 0, 0);
          rioBallBody.angularVelocity.set(0, 0, 0);
          rioBallBody.previousPosition.copy(b);
          rioBallBody.interpolatedPosition.copy(b);
          rioBallBody.wakeUp();
        }
        // ...and the four of them start playing again. The task keeps its tick.
        rioVoleiDone = false;
      }
      // The Globo man turned away when he was robbed and stayed turned for the
      // life of the page, with his bag gone. Same argument: put the object back.
      if (rioGloboDone && rioGloboGroup) { rioGloboGroup.rotation.y = rioGloboYaw; rioGloboDone = false; }
      rioSelaronTold = false;
    },
    onExit() {
      // ARMED FLAGS DO NOT SURVIVE TRAVEL. Every biome shares one coordinate
      // space, and a latch left set is a task that ticks in the wrong country.
      rioCalcOn = false; rioCalcMark = 0;
      rioCombo = 0; rioRiding = false; rioBondeRideT = 0;
      // AND THE WAVE WAS NOT ON THE LIST. `rioWaveFrom` is the z the current
      // ride started at and `rioWaveRide` is how far it has run; both are set
      // by rioUpdateWaves while the animal is in the pocket and neither was
      // ever cleared. Leave Copacabana mid-ride and they are still live —
      // `surfing()` reads true in Iceland, and the next visit's first frame in
      // the water measures its distance against a z from another country. The
      // Selarón clock is the same class: it counts up outside the biome.
      rioWaveRide = 0; rioWaveFrom = 1e9; rioWaveSurf = 0;
      rioSelaronT = -1;
      rioClap = 0;
      rioVoleiCel = 0; rioVoleiT = 3.0;
    },
  });

  const api = {
    built() { return rioBuilt; },
    /** The bonde MOVES, and half its line is fifteen metres up. Ask; never cache. */
    bonde() { return rioBondePos; },
    /**
     * THE SALUTE, 0..1 — the bateria turned to face you, for 4.2 seconds.
     *
     * This is the chapter's wow and the whole avenue does something at it, and
     * until now nothing outside this file could tell it was happening. Rio is
     * one of five chapters with no row in the event grade layer, so the single
     * brightest moment in the chapter changed no bloom, no threshold and no
     * vignette. The state was already here; it had no way out.
     */
    salute() { return clamp(rioSalute / 4.2, 0, 1); },
    kiosk: { x: rioKIOSK.x, z: rioKIOSK_STAND },
    calcadao: { x: 0, z: (rioPROM_Z + 2.6) * 0.5 },
    terrainHeight: rioTerrain,
    // Built from the static boxes themselves — see makeSolidIndex in shared.js.
    navBlocked(x, z, r) { return rioSolids.blocked(x, z, r, rioTerrain); },
    slopeAt: rioSlope,
    waterLevel: rioSEA_Y,
    isOverWater: rioIsOverWater,
    // The set off Arpoador. flow() is the reference-frame channel — see the
    // note over rioBuildWaves and capyFlowAt() in capybara.js.
    flow: rioFlow,
    /** The cable car's deck, for anything standing on it. See rioUpdateCabin. */
    carryFrame() { return rioRiding ? rioCabinFrame : null; },
    waveAt() { let b = -1e9; for (let i = 0; i < 3; i++) if (rioWaveZ[i] > b) b = rioWaveZ[i];
               rioWaveV3.set(rioWAVE_X, rioSEA_Y, b < -1e8 ? rioWAVE_Z0 : b); return rioWaveV3; },
    surfing() { return rioWaveRide > 0; },
    waterHeightAt: rioSurfaceY,
    // ONE FLAG, AND THE ANIMAL WAS 1.56 m UNDER THE WAVE IT WAS RIDING.
    //
    // `capyWaterY` only calls `waterHeightAt` when this is up. Rio publishes a
    // surface that includes the full `rioWaveLift` and never raised the flag,
    // so the capybara floated at the flat `rioSEA_Y` while the set rolled
    // through it: measured at a live crest, surface +0.534 m, animal -1.027.
    // The chapter's signature verb is riding those waves.
    //
    // This is the same bug, in the same field, that batch 1 found in Iceland's
    // hot spring — where the animal was 29 cm under the water for the whole of
    // that chapter's best-loved moment. Second time. Any chapter that publishes
    // waterHeightAt and does not set this should be read as broken.
    localWater: true,
    inZone: rioInZone,
    SPAWN: rioSPAWN,

    // landmarks, for the task beacons
    globo: rioGLOBO,
    volei: rioVOLEI,
    arpoadorRock: rioARPOADOR,
    sugarloaf: rioSUGAR,
    station: rioSTATION,
    selaron: rioSELARON,
    lapa: rioLAPA,
    corcovado: rioCORCOVADO,
    /** The desfile is a moving target, so the beacon has to ask where it is. */
    column() { rioV3.set(rioBateriaX, rioTerrain(rioBateriaX, rioAVE_Z), rioAVE_Z); return rioV3; },
    columnX: rioColumnX,
    /** For the HUD: how the run is going. */
    combo() { return rioCombo; },
    comboTarget: rioSAMBA_TARGET,
    inColumn() { return rioInColumn; },
    riding() { return rioRiding; },
    cabin() { return rioCabinGroup; },

    update(dt) {
      if (!rioBuilt) return;
      if (!game.biome.isActive('rio')) return;
      rioTime += dt;

      // the swell
      rioRipT += dt;
      if (rioRipT >= 0.0333 && rioSeaAttr) {
        rioRipT = 0;
        const a = rioSeaAttr.array;
        const cA = rioSeaColAttr ? rioSeaColAttr.array : null;
        const fr = rioFoamCol.r, fg = rioFoamCol.g, fb = rioFoamCol.b;
        for (let i = 0; i < a.length; i += 3) {
          const lift = rioWaveLift(a[i], a[i + 2]);
          a[i + 1] = rioSEA_Y + Math.sin(a[i + 2] * 0.11 + rioTime * 1.5) * 0.22
                              + Math.sin(a[i] * 0.07 - rioTime * 0.9) * 0.10
                              + lift;
          if (cA) {
            // squared, so only the top third of the wave goes pale and the
            // shoulders stay the colour of the sea
            const t = lift > 0 ? clamp(lift / rioWAVE_LIFT, 0, 1) : 0;
            const k = t * t * 0.85;
            cA[i]     = rioSeaBase[i]     + (fr - rioSeaBase[i]) * k;
            cA[i + 1] = rioSeaBase[i + 1] + (fg - rioSeaBase[i + 1]) * k;
            cA[i + 2] = rioSeaBase[i + 2] + (fb - rioSeaBase[i + 2]) * k;
          }
        }
        if (rioSeaColAttr) rioSeaColAttr.needsUpdate = true;
        rioSeaAttr.needsUpdate = true;
      }

      rioUpdateParade(game, dt);
      rioUpdatePeople(dt);
      rioUpdateBirds(dt);
      rioUpdateBonde(game, dt);
      rioUpdateCabin(game, dt);
      rioUpdateSparks(dt);
      rioUpdateVolei(game, dt);
      rioUpdateWaves(game, dt);
      rioUpdateSamba(game, dt);
      rioUpdateTasks(game, dt);
      rioCheckCalcadao(game);
      rioCheckKiosk(game);

      // the ball, if it is awake. Contract: render from the interpolated
      // transform, never from body.position.
      if (rioBallMesh && rioBallBody) {
        rioBallMesh.position.copy(rioBallBody.interpolatedPosition);
        rioBallMesh.quaternion.copy(rioBallBody.interpolatedQuaternion);
      }
    },
  };
  game.rio = api;
  return api;
}

/**
 * REGISTERSHADOWTARGET TURNS castShadow ON FOR EVERY MESH IT CAN REACH, AND
 * IT RUNS LAST.
 *
 * `sysEnableShadows` in systems.js is `o3d.traverse(n => { if (n.isMesh)
 * n.castShadow = true })`, and a biome's build calls it on its own root as the
 * very last thing it does — so every `castShadow = false` written anywhere in
 * this file is silently undone about four lines later. The instrumented shot of
 * the breaking wave is the proof: eighty metres of surf, whose own build says `castShadow = false` on
 * the line that creates it, laying a hard shadow on the sea underneath it.
 *
 * Nothing that is transparent should ever cast: the sea, the whitewater ribbon, and the confetti. Turning them
 * back off after the fact is four lines and it is also a real saving in the
 * shadow pass, which is the most expensive thing this renderer does.
 */
function rioNoShadowOnGhosts(root) {
  root.traverse(function (n) {
    if (!n.isMesh && !n.isInstancedMesh) return;
    const m = Array.isArray(n.material) ? n.material[0] : n.material;
    if (!m) return;
    if (m.transparent || m.depthWrite === false || m.blending === THREE.AdditiveBlending) {
      n.castShadow = false;
    }
  });
}

function rioBuild(game) {
  if (rioBuilt) return;
  rioBuilt = true;
  rioInitGeos();

  rioRoot = new THREE.Group();
  rioRoot.name = 'rio';
  game.scene.add(rioRoot);

  rioRoot.add(rioBuildGroundMesh());
  rioBuildGroundBody(game);
  rioRoot.add(rioBuildSea());
  rioRoot.add(rioBuildCalcadao());
  // The cast is built FIRST and filled in by everything after it: the beach,
  // Arpoador and the grandstand all call rioAddPerson, and the two instanced
  // meshes have to exist before any of them does.
  rioBuildPeople(rioRoot);
  rioBuildBeach(game, rioRoot);
  rioBuildGlobo(rioRoot);
  rioBuildBall(game, rioRoot);
  rioBuildArpoador(game, rioRoot);
  rioBuildWaves(rioRoot);
  rioBuildSugarloaf(game, rioRoot);
  rioBuildCorcovado(game, rioRoot);
  rioBuildLapa(game, rioRoot);
  rioBuildBonde(game, rioRoot);
  rioBuildSelaron(game, rioRoot);
  rioBuildSantaTeresa(game, rioRoot);
  rioBuildFrontage(game, rioRoot);
  rioBuildAvenue(game, rioRoot);
  rioBuildBateria(game, rioRoot);
  rioBuildFlora(rioRoot);
  rioBuildBirds(rioRoot);
  rioBuildSparks(rioRoot);

  rioBateriaX = rioAVE_X0 + 20;

  // ---- THE PEOPLE WHO LIVE HERE ------------------------------------------
  // See npc.js, THE LOCALS. Each of these is a point somebody is standing at,
  // a few things they might say when the capybara turns up, and a different
  // few for when it wheeks at them. Where the chapter owns a Group for the
  // figure, it is handed over too and the figure turns to watch.
  if (typeof game.addLocal === 'function') {
    rioLocGlobo = game.addLocal({ biome: 'rio', group: rioGloboGroup, face: -2.2,
      x: rioGLOBO.x, y: rioTerrain(rioGLOBO.x, rioGLOBO.z), z: rioGLOBO.z, near: 6,
      // ---- AND THEY KNOW WHAT HAS HAPPENED (v20) -------------------------
      // Everybody in this chapter said the same three sentences whether you had
      // just arrived or had robbed them, put their ball in the Atlantic and
      // taken the applause on Arpoador. See localResolve in npc.js: a line may
      // carry `before`/`after` a task id or a `when` predicate, and `onTask`
      // is what they say at the moment you do it in front of them.
      lines: [{ t: 'Biscoito Globo! Doce ou salgado!', before: 'globo-biscuit' },
              { t: 'Not for you, my friend. These are for people with money.', before: 'globo-biscuit' },
              'Every day I walk this beach. Never once a capybara.',
              { t: 'Never once a capybara, and now I am down a bag.', after: 'globo-biscuit' },
              { t: 'Doce or salgado. You did not even ask which.', after: 'globo-biscuit' },
              { t: 'There is sand in them. There is always sand in them.', after: 'globo-biscuit' }],
      wheek: ['All right, all right — one. Do not tell the others.',
              'You have a voice on you.'],
      onTask: { 'globo-biscuit': ['One real! ONE REAL!',
                                  'Ai. Ai ai ai.'],
                'kiosk': ['He gets robbed too. Good.'] } });
    // BEHIND THE COUNTER, NOT INSIDE THE DRUM. The kiosk is a 4.6 m solid box
    // centred on rioKIOSK and the man was standing at its centre — completely
    // enclosed by the thing he serves out of, invisible from every angle, with
    // his collider inside the kiosk's. He stands at the hatch now, on the
    // seaward side, which is the side the counter and the whole task are on.
    rioLocKiosk = game.addLocal({ biome: 'rio', x: rioKIOSK.x - 3.3, y: rioTerrain(rioKIOSK.x - 3.3, rioKIOSK.z - 1.5),
      z: rioKIOSK.z - 1.5, near: 6, face: Math.PI,
      figure: { shirt: PALETTE.cloth6, hat: PALETTE.cloth3 },
      lines: ['Agua de coco? No? Suit yourself.',
              { t: 'You are dripping on my counter.',
                when: function () { return !!(rioGame && rioGame.capy && (rioGame.capy.wet || 0) > 0.4); } },
              { t: 'Sit down, have something. Everybody sits down eventually.', before: 'kiosk' },
              { t: 'You had the mate, the coco AND a biscoito. I watched you do it.', after: 'kiosk' },
              { t: 'No, there is no tab. There has never been a tab.', after: 'kiosk' },
              { t: 'Hot one today. Everybody is in the water and nobody is buying anything.',
                when: function () { return !!(rioGame && rioGame.weather && !rioGame.weather.drizzle()); } }],
      wheek: ['That is the loudest order I have taken all week.'],
      onTask: { 'kiosk': ['That is four things and no money.',
                          'Put it on the animal’s tab. The animal has no tab.'],
                'futevolei': ['They will be looking for that ball for a week.'] } });
    game.addLocal({ biome: 'rio', x: rioVOLEI.x, y: rioTerrain(rioVOLEI.x, rioVOLEI.z),
      z: rioVOLEI.z, near: 7,
      figure: { shirt: PALETTE.cloth4, legs: PALETTE.cloth2 },
      lines: [{ t: 'No hands! Nobody told him no hands.', before: 'futevolei' },
              { t: 'You want in? You are the right height for a header.', before: 'futevolei' },
              { t: 'Ai — that is our ball.', before: 'futevolei' },
              { t: 'That was our ball. It is Angola’s ball now.', after: 'futevolei' },
              { t: 'Best header anybody on this beach has ever seen. Worst outcome.', after: 'futevolei' },
              { t: 'Four of us, one ball, no hands. It is not complicated.', before: 'futevolei' }],
      wheek: ['He is calling for it! Give him the ball!'],
      onTask: { 'futevolei': ['GOL! …no. No, that is not a gol.',
                              'Straight into the Atlantic. With its HEAD.'] } });
    // FIVE MORE, BECAUSE THREE PEOPLE IS NOT A CITY OF SIX MILLION.
    // One at each of the places the chapter actually sends you: the lifeguard
    // post you run past on the calçadão, the foot of Selarón's steps, the
    // bottom station of the bondinho, the top of Arpoador, and the man on the
    // running board of a bonde that is standing at its terminus.
    game.addLocal({ biome: 'rio', x: -34, y: rioTerrain(-34, -4.5), z: -4.5, near: 8,
      figure: { shirt: PALETTE.rioTileRed, legs: PALETTE.rioTileWhite, hat: PALETTE.rioTileYellow },
      face: Math.PI,
      lines: ['Between the flags. There are no flags. Use your judgement.',
              { t: 'The rip runs west off the point. You are built for it, but still.', before: 'take-a-wave' },
              'Sixty saves this summer. None of them a rodent.',
              { t: 'You took one all the way in. On your back. I have notes.', after: 'take-a-wave' },
              { t: 'Sets of three. Always three. Let the first one go.', before: 'take-a-wave' },
              { t: 'It is out there now. Go on, it is doing nothing without you.',
                when: function () { return !!(rioGame && rioGame.rio && !rioGame.rio.surfing()
                                              && rioGame.capy && (rioGame.capy.wet || 0) > 0.5); } }],
      wheek: ['I heard that from the water, my friend.',
              'If that is a distress signal it is a new one on me.'],
      onTask: { 'take-a-wave': ['Sixty-one saves. I am counting that one.',
                                'That is a rodent surfing. I want that on record.'] } });
    rioLocSel = game.addLocal({ biome: 'rio', x: rioSELARON.x + 4.6, y: rioTerrain(rioSELARON.x + 4.6, rioSELARON.z - 1),
      z: rioSELARON.z - 1, near: 7,
      figure: { shirt: PALETTE.rioTileBlue, legs: PALETTE.rioPaveDark },
      lines: ['Two hundred and fifteen. He did them one at a time, for twenty years.',
              'Every tile came from somewhere else. Go on, find your country.',
              { t: 'People run up these. He would have hated that. Probably.', before: 'selaron-steps' },
              { t: 'He would have hated that. He would have put it on a tile.', after: 'selaron-steps' },
              { t: 'There are two hundred and fourteen now. Do not ask me about it.', after: 'selaron-steps' },
              { t: 'Nobody does it in under nine. Nobody who is not late for something.', before: 'selaron-steps' }],
      wheek: ['Careful — half of Lapa is asleep.'],
      onTask: { 'selaron-steps': ['Two hundred and fifteen steps. At a SPRINT.',
                                  'Half of them came off with you.'],
                'o-bonde': ['The tram goes over there. Everybody waves. You did not wave.'] } });
    // ON LAND. rioSTATION is (58, -24) and rioSHORE_Z is -18, so anywhere
      // 'beside the station' is in the Atlantic — terrainHeight there returns
      // the SEA FLOOR and the man was standing on it, two metres under, talking
      // about cable cars. Probe the ground before trusting a landmark constant
      // as a place to put somebody: the same trap caught Kyoto's miller and the
      // Pantanal drover.
    game.addLocal({ biome: 'rio', x: rioSTATION.x, y: rioTerrain(rioSTATION.x, -8),
      z: -8, near: 8,
      figure: { shirt: PALETTE.cloth2, hat: PALETTE.cloth6 },
      lines: [{ t: 'Cars go every ten minutes. Nobody has ever checked a ticket.', before: 'bondinho' },
              'It has run since nineteen twelve. It has never once fallen off.',
              { t: 'Two stages. Get out at Urca if you want the good photograph.', before: 'bondinho' },
              { t: 'Nobody has ever checked a ticket, and now I see why.', after: 'bondinho' },
              { t: 'Sixty metres over the bay in a box. And you went twice.', after: 'bondinho' },
              { t: 'She is coming down now. You can hear the cable before you see it.',
                when: function () { return !!(rioGame && rioGame.rio && !rioGame.rio.riding()); } }],
      wheek: ['That will carry to the summit, that will.'],
      onTask: { 'bondinho': ['No ticket. NO TICKET.',
                             'Nineteen twelve, and that is the first stowaway with fur.'] } });
    game.addLocal({ biome: 'rio', x: rioARPOADOR.x + 5, y: rioTerrain(rioARPOADOR.x + 5, rioARPOADOR.z + 3),
      z: rioARPOADOR.z + 3, near: 9, face: -1.57,
      figure: { shirt: PALETTE.rioFeather3, legs: PALETTE.denim },
      lines: [{ t: 'We clap it down. Every evening. You will see.', before: 'arpoador' },
              { t: 'Do not stand in front. Everybody in Ipanema is behind you.', before: 'arpoador' },
              'Best free thing in the city, and it is on twice a day.',
              { t: 'You stood in front. Everybody clapped anyway.', after: 'arpoador' },
              { t: 'Half of that was for the sun. Only half.', after: 'arpoador' },
              { t: 'The set is coming. Look left — no, LEFT.',
                when: function () { return !!(rioGame && rioGame.rio && rioGame.rio.surfing()); } }],
      wheek: ['Save it for the sunset, eh?'],
      onTask: { 'arpoador': ['LISTEN to them. That is for you, that is.',
                             'Two hundred people. Clapping. At a rodent.'],
                'take-a-wave': ['From up here that looked deliberate.'] } });
    rioLocBonde = game.addLocal({ biome: 'rio', x: 34, y: rioTerrain(34, rioBONDE_Z + 2.4), z: rioBONDE_Z + 2.4,
      near: 8,
      figure: { shirt: PALETTE.cloth3, legs: PALETTE.khaki },
      lines: ['Nobody sits down. The step is the seat, and the step is better.',
              { t: 'When the other one comes past, hold on. Not for safety. For the noise.', before: 'o-bonde' },
              'Up to Santa Teresa and back. Fifteen minutes, if the driver behaves.',
              { t: 'You were on the step when they passed. Everybody remembers their first one.', after: 'o-bonde' },
              { t: 'Forty-two arches. Count them going over. Nobody ever gets the same number.', before: 'o-bonde' }],
      wheek: ['That is louder than the bell, and the bell is the point.'],
      onTask: { 'o-bonde': ['On the running board! On the RUNNING BOARD!',
                            'Fifteen minutes and you did not pay any of it.'],
                'samba-parade': ['They can hear that section from up in Santa Teresa.'] } });

    // ---- AND ONE MORE ON THE STEPS, SO THERE IS SOMEBODY TO ARGUE WITH ---
    // Selarón's steps carry more people per square metre than anywhere else in
    // the chapter and had exactly one, at the bottom, facing out. A second one
    // sitting halfway up doubles the population of the busiest landmark in Rio
    // for one figure, and gives the flight the only conversation in Lapa.
    {
      const hh = rioSelaronHead(), ff = rioSelaronFoot();
      const mx = (hh.x + ff.x) * 0.5 - 3.4, mz = (hh.z + ff.z) * 0.5;
      rioLocSel2 = game.addLocal({ biome: 'rio', x: mx, y: rioTerrain(mx, mz), z: mz,
        near: 7, face: 1.4,
        figure: { shirt: PALETTE.rioTileYellow, legs: PALETTE.rioTileBlue },
        lines: ['I sit on the same step every day. It is the ninetieth. It is the best one.',
                'That tile is from Wales. I have no idea either.',
                { t: 'People run up these all day. All DAY.', after: 'selaron-steps' },
                { t: 'Do not run up these. Everybody runs up these.', before: 'selaron-steps' }],
        wheek: ['Two hundred and fifteen steps of echo. Thank you.'],
        praise: ['From the ninetieth step, that looked ridiculous.'] });
    }

    // ---- AND TWO CONVERSATIONS THAT ARE NOT WITH YOU (v20) --------------
    // See addExchange in npc.js. Everything anybody said in this chapter was
    // addressed to the capybara, so a beach with a biscuit man and a kiosk
    // twelve metres apart was silent unless you stood between them. These run
    // when you are near enough to read both bubbles and far enough not to be
    // the subject — what you catch is something already in progress, which is
    // most of what makes a beach a beach.
    if (typeof game.addExchange === 'function') {
      if (rioLocGlobo && rioLocKiosk) {
        game.addExchange({ biome: 'rio', a: rioLocGlobo, b: rioLocKiosk, lines: [
          ['Two reais for a coco. Two!', 'Two reais for a biscuit made of air.'],
          ['Quiet today.', 'It is Tuesday. It is always quiet on Tuesday.'],
          ['Something has taken a bag off my pole.', 'Something has been at my counter as well.'],
          ['Rain later.', 'There is never rain later.'],
          ['Did you see that go in the water?', 'I have stopped looking at the water.'],
        ] });
      }
      if (rioLocSel && rioLocSel2) {
        game.addExchange({ biome: 'rio', a: rioLocSel2, b: rioLocSel, gap: 33, lines: [
          ['How many today?', 'Four hundred. Before lunch.'],
          ['Somebody has been running.', 'Somebody is always running.'],
          ['That tile is loose again.', 'That tile has been loose since 2005.'],
          ['I found Wales.', 'Everybody finds Wales. Nobody finds Peru.'],
          ['Is that an animal on the steps?', 'It is Lapa. Do not start.'],
        ] });
      }
    }
  }

  if (typeof game.registerShadowTarget === 'function') game.registerShadowTarget(rioRoot);
  // ...and then take it back off the things that must never have had it.
  rioNoShadowOnGhosts(rioRoot);
}
