import * as THREE from 'three';
import { mat, clamp, calmOn } from './shared.js';

// ---------------------------------------------------------------------------
// GRASS AS A VOLUME (ROADMAP-WOW G1).
//
// The reference's ground is a volume of blades the figure wades through; ours
// was a plane with daisy specks and 14 cm squashed-cone tufts. This is ONE
// instanced draw of flat-shaded blade fans — four single-triangle blades
// radiating from a shared foot, no quads-with-alpha, so it is inside the law —
// in a camera-following box like the mote field's (weather.js, wxBOX_R):
// ~4–6 k fans, the box recentred every ~3 m of travel, and the instance
// buffers rewritten only then.
//
// THE COLOUR IS THE GROUND'S OWN. Nothing here names a hex: each fan's colour
// is the chapter's ground mesh, read at the blade's foot — the triangle under
// it, barycentric, from the vertex colours the chapter painted (Sydney's lawn,
// the Pantanal's flood-meadow, the Drift's violet-grey, never a new tone). The
// same read gates WHERE grass grows: green-dominant only (`g - max(r, b)`
// above a margin, the gate grain()'s speck term already uses), so nothing
// stands on a road, paving, sand or water. Water is asked of the chapter
// (`isOverWater`) as well, because a flooded meadow is still painted green.
//
// A raycast per blade against a merged chapter mesh would be O(triangles) per
// ray with no BVH in the vendored three, so the ground is read ONCE per chapter
// entry into a 2 m spatial hash of its upward-facing, vertex-coloured,
// terrain-height triangles (grsScan), and every placement is a point-in-
// triangle test against the handful in one cell. A decal on the lawn (a path,
// a kerb) is a higher triangle at the same x/z and wins, so it blocks grass.
//
// The sway is the gust the chapter already publishes (`game.weather.gust()`,
// the same breath swayTick hands every canopy), entirely in the vertex shader;
// the trample is a small uniform ring of the animal's recent foot positions
// (grsTR_N points, each with the velocity it was laid with): blades inside
// 0.5 m lie along that velocity and stand back up over ~2 s. The distance fade
// at the box edge shrinks the blade to nothing rather than fading alpha — the
// law again, and it also means the far edge is the ground itself.
//
// Cost: +1 draw call, no shadow cast, receives the sun's. Rung 1 halves the
// count, rung 2 parks it (allocated, skipped). `game.state.noGrass` cuts.
//
// The material is `mat()` from shared.js (so the rim and the shade term ride
// along, chained the way sway() chains them) with the sway/trample/fade hook
// appended, on a clone. Its customProgramCacheKey starts with `swayD` ON
// PURPOSE: qa/wow-still.js hides every InstancedMesh whose key does, because
// grass sway is intended motion and must not be read as shimmer.
// ---------------------------------------------------------------------------

const grsMAX     = 6000;    // fans allocated; a row's `n` never exceeds this
const grsBOX_R   = 12;      // m, half-width of the layout box around the anchor
const grsFADE_R  = 9.0;     // m, where the blade has shrunk to nothing...
const grsFADE_IN = 6.0;     // ...and where it starts to
const grsRECENTRE = 3.0;    // m of anchor travel before the layout is redone
const grsFOLLOW  = 4.0;     // damping lambda on the fade centre, s^-1
const grsAHEAD   = 2.0;     // m the anchor sits ahead of the animal, along the lens
const grsTR_N    = 16;      // trample ring size
const grsTR_STEP = 0.30;    // m of travel between two trample points
const grsTR_R    = 0.5;     // m, the foot ring
const grsTR_LIFE = 2.0;     // s to stand back up
const grsCELL    = 2.0;     // m, the ground hash cell
const grsSINK    = 0.02;    // m the foot is buried, so the base never floats
const grsSCAN_RETRY = 30;   // frames between scan retries on an empty result
const grsSLICES  = 4;       // frames a full re-placement is spread over

// One row per chapter that grows anything. h is [min, max] fan height in
// metres; n the fan count at rung 0; gate the green margin (linear, on
// g - max(r, b)) or a named tone test for the two dry chapters; minY a floor
// under which nothing grows (Manly: the tide line); sway metres of tip travel
// at a full gust.
const grsROW = {
  sydney:   { n: 5000, h: [0.22, 0.42], gate: 0.04, sway: 0.09 },
  pasto:    { n: 5000, h: [0.28, 0.50], gate: 0.04, sway: 0.10 },
  pantanal: { n: 5500, h: [0.35, 0.60], gate: 0.04, sway: 0.11 },
  drift:    { n: 4500, h: [0.25, 0.45], gate: 'drift', sway: 0.10 },
  iceland:  { n: 4500, h: [0.25, 0.42], gate: 'tussock', sway: 0.12 },
  manly:    { n: 4000, h: [0.30, 0.55], gate: 0.04, sway: 0.12, minY: 1.2 },
  cali:     { n: 4500, h: [0.25, 0.45], gate: 0.04, sway: 0.09 },
  goreme:   { n: 2500, h: [0.15, 0.28], gate: 'dry', sway: 0.05 },
};

// A deterministic per-fan hash so the field is the same on every boot and in
// every probe: Math.random here would make the frustum count a dice roll.
function grsHash(i, k) {
  let h = (i * 374761393 + k * 668265263) | 0;
  h = ((h ^ (h >>> 13)) * 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** The per-row growth gate on a LINEAR colour. Returns 0..1, a density. */
function grsGate(gate, r, g, b) {
  if (typeof gate === 'number') {
    // grain()'s speck gate: smoothstep(0.02, 0.10) on the green dominance,
    // here with the row's own floor so a chapter can ask for a harder edge.
    const d = g - Math.max(r, b);
    if (d <= gate) return 0;
    const t = clamp((d - gate) / (0.10 - gate), 0, 1);
    return t * t * (3 - 2 * t);
  }
  if (gate === 'drift') {
    // The Drift's ground is violet-grey: g is NOT dominant. What is not
    // grass there is its decking and its stone — both near-neutral and
    // darker — so the test is "tinted toward blue-violet and not dark".
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const violet = (b - g);
    if (lum < 0.10 || violet < 0.02) return 0;
    return clamp((violet - 0.02) / 0.06, 0, 1);
  }
  if (gate === 'tussock' || gate === 'dry') {
    // Olive / ochre: warm and green-leaning against blue, and not grey.
    // Rock, snow, sand and paving are neutral (r ≈ g ≈ b) or blue-leaning;
    // a tussock has g ≥ 0.9 r and b well under both.
    const warm = Math.min(r, g) - b;
    if (warm < 0.06) return 0;
    if (g < r * 0.88) return 0;               // a red-brown roof, not a plant
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (lum > 0.75 || lum < 0.06) return 0;   // snow, black
    return clamp((warm - 0.06) / 0.08, 0, 1);
  }
  return 0;
}

// ---------------------------------------------------------------------------
// The ground table: every upward-facing, vertex-coloured triangle at terrain
// height in the live chapter, world space, hashed on a 2 m lattice.
// ---------------------------------------------------------------------------
function grsScan(game, api, skip, gate) {
  const tri = [], col = [];
  const cells = new Map();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nrm = new THREE.Vector3();
  const th = api && typeof api.terrainHeight === 'function' ? api.terrainHeight : null;
  let meshes = 0, seen = 0;
  game.scene.traverseVisible(function (o) {
    if (!o.isMesh || o.isInstancedMesh || o === skip) return;
    const g = o.geometry, m = o.material;
    if (!g || !g.attributes || !g.attributes.color || !g.attributes.position) return;
    if (!m || Array.isArray(m) || m.transparent) return;
    if (o.userData && o.userData.noGrass) return;
    meshes++;
    const pos = g.attributes.position, colr = g.attributes.color;
    const idx = g.index ? g.index.array : null;
    const n = idx ? idx.length : pos.count;
    const M = o.matrixWorld;
    for (let t = 0; t + 2 < n; t += 3) {
      const i0 = idx ? idx[t] : t, i1 = idx ? idx[t + 1] : t + 1, i2 = idx ? idx[t + 2] : t + 2;
      a.fromBufferAttribute(pos, i0).applyMatrix4(M);
      b.fromBufferAttribute(pos, i1).applyMatrix4(M);
      c.fromBufferAttribute(pos, i2).applyMatrix4(M);
      e1.subVectors(b, a); e2.subVectors(c, a); nrm.crossVectors(e1, e2);
      const L = nrm.length();
      if (L < 1e-8 || nrm.y / L < 0.55) continue;
      seen++;
      const cx = (a.x + b.x + c.x) / 3, cy = (a.y + b.y + c.y) / 3, cz = (a.z + b.z + c.z) / 3;
      if (th) {
        const ty = th(cx, cz);
        if (typeof ty === 'number' && ty === ty && Math.abs(cy - ty) > 0.8) continue;
      }
      // Reject what is plainly not a plant by its mean colour before it costs
      // a slot: the per-blade gate runs again on the interpolated colour.
      const r = (colr.getX(i0) + colr.getX(i1) + colr.getX(i2)) / 3;
      const gg = (colr.getY(i0) + colr.getY(i1) + colr.getY(i2)) / 3;
      const bb = (colr.getZ(i0) + colr.getZ(i1) + colr.getZ(i2)) / 3;
      if (grsGate(gate, r, gg, bb) <= 0) continue;
      const minx = Math.min(a.x, b.x, c.x), maxx = Math.max(a.x, b.x, c.x);
      const minz = Math.min(a.z, b.z, c.z), maxz = Math.max(a.z, b.z, c.z);
      const x0 = Math.floor(minx / grsCELL), x1 = Math.floor(maxx / grsCELL);
      const z0 = Math.floor(minz / grsCELL), z1 = Math.floor(maxz / grsCELL);
      if ((x1 - x0 + 1) * (z1 - z0 + 1) > 1600) continue;  // a 80 m triangle is a floor, not a lawn
      const id = tri.length / 9;
      tri.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      col.push(colr.getX(i0), colr.getY(i0), colr.getZ(i0),
               colr.getX(i1), colr.getY(i1), colr.getZ(i1),
               colr.getX(i2), colr.getY(i2), colr.getZ(i2));
      for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
        const key = (ix + 32768) * 65536 + (iz + 32768);
        let arr = cells.get(key);
        if (!arr) { arr = []; cells.set(key, arr); }
        arr.push(id);
      }
    }
  });
  return { tri: new Float32Array(tri), col: new Float32Array(col), cells, meshes, seen, kept: tri.length / 9 };
}

/** Point-in-triangle on the table; writes {y, r, g, b} of the TOPMOST hit. */
function grsLookup(tab, x, z, out) {
  if (!tab) return false;
  const key = (Math.floor(x / grsCELL) + 32768) * 65536 + (Math.floor(z / grsCELL) + 32768);
  const arr = tab.cells.get(key);
  if (!arr) return false;
  const T = tab.tri, C = tab.col;
  let best = -Infinity, hit = false;
  for (let k = 0; k < arr.length; k++) {
    const o = arr[k] * 9;
    const ax = T[o], az = T[o + 2], bx = T[o + 3], bz = T[o + 5], cx = T[o + 6], cz = T[o + 8];
    const v0x = cx - ax, v0z = cz - az, v1x = bx - ax, v1z = bz - az, v2x = x - ax, v2z = z - az;
    const d00 = v0x * v0x + v0z * v0z, d01 = v0x * v1x + v0z * v1z, d11 = v1x * v1x + v1z * v1z;
    const d20 = v2x * v0x + v2z * v0z, d21 = v2x * v1x + v2z * v1z;
    const den = d00 * d11 - d01 * d01;
    if (Math.abs(den) < 1e-12) continue;
    const v = (d11 * d20 - d01 * d21) / den;     // weight of c
    const w = (d00 * d21 - d01 * d20) / den;     // weight of b
    const u = 1 - v - w;                          // weight of a
    if (u < -0.002 || v < -0.002 || w < -0.002) continue;
    const y = u * T[o + 1] + w * T[o + 4] + v * T[o + 7];
    if (y <= best) continue;
    best = y; hit = true;
    out.y = y;
    out.r = u * C[o] + w * C[o + 3] + v * C[o + 6];
    out.g = u * C[o + 1] + w * C[o + 4] + v * C[o + 7];
    out.b = u * C[o + 2] + w * C[o + 5] + v * C[o + 8];
  }
  return hit;
}

// ---------------------------------------------------------------------------
// The fan: four blades, each ONE triangle, foot at the origin, tip at y = 1
// (the instance's `aH` scales it to metres). Blade k faces yaw k·90° + jitter
// and leans outward a little, so from any side two blades read face-on. The
// per-vertex colour is a base-to-tip ramp the instance colour multiplies —
// the foot of a lawn is in its own shade.
// ---------------------------------------------------------------------------
function grsFanGeometry() {
  const P = [], N = [], C = [];
  const yaws = [0.15, 1.72, 3.05, 4.85];
  const hs = [1.0, 0.78, 0.9, 0.66];
  const W = 0.022;
  for (let k = 0; k < 4; k++) {
    const yaw = yaws[k], h = hs[k];
    const nx = Math.cos(yaw), nz = Math.sin(yaw);       // the blade's radial
    const px = -nz, pz = nx;                              // across it
    const lean = 0.07;
    // base left, base right, tip — wound so the face normal is `p`; with
    // DoubleSide both windings draw, so the order only fixes which is front.
    P.push(-px * W, 0, -pz * W,  px * W, 0, pz * W,  nx * lean, h, nz * lean);
    for (let j = 0; j < 3; j++) N.push(0, 1, 0);
    C.push(0.86, 0.86, 0.86,  0.86, 0.86, 0.86,  1.0, 1.0, 1.0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  return g;
}

export function createGrass(game) {
  const THREEx = game.THREE || THREE;
  const scene = game.scene;

  // ---- uniforms ------------------------------------------------------------
  const uT     = { value: 0 };
  const uWind  = { value: new THREEx.Vector2(0, 0) };     // m/s, world x/z
  const uSway  = { value: 0.1 };                          // m at the tip at a full gust
  const uBox   = { value: new THREEx.Vector3(0, 0, grsFADE_R) };  // fade centre x, z, radius
  const uTr    = { value: [] };                           // vec4: x, z, dirx, dirz
  const uTrT   = { value: new Float32Array(grsTR_N) };    // birth time, -1e9 = empty
  for (let i = 0; i < grsTR_N; i++) { uTr.value.push(new THREEx.Vector4(0, 0, 0, 0)); uTrT.value[i] = -1e9; }

  // ---- the material: mat() + the hook, on a clone -------------------------
  const base = mat(0xffffff, { vertexColors: true, flatShading: false, side: THREEx.DoubleSide });
  const m = base.clone();
  const prevHook = base.onBeforeCompile;
  const hadHook = typeof prevHook === 'function' && base.hasOwnProperty('onBeforeCompile');
  const prevKey = base.customProgramCacheKey;
  m.onBeforeCompile = function (shader) {
    if (hadHook) prevHook.call(this, shader);
    shader.uniforms.uGrsT = uT;
    shader.uniforms.uGrsWind = uWind;
    shader.uniforms.uGrsSway = uSway;
    shader.uniforms.uGrsBox = uBox;
    shader.uniforms.uGrsTr = uTr;
    shader.uniforms.uGrsTrT = uTrT;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', [
        '#include <common>',
        'attribute float aH;',
        'uniform float uGrsT;',
        'uniform vec2 uGrsWind;',
        'uniform float uGrsSway;',
        'uniform vec3 uGrsBox;',
        'uniform vec4 uGrsTr[' + grsTR_N + '];',
        'uniform float uGrsTrT[' + grsTR_N + '];',
      ].join('\n'))
      .replace('#include <begin_vertex>', [
        '#include <begin_vertex>',
        '{',
        '  float gR = position.y;',                                   // 0 foot .. 1 tip
        '  vec3 gO = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;',
        '  float gD = length(gO.xz - uGrsBox.xy);',
        '  float gF = 1.0 - smoothstep(' + grsFADE_IN.toFixed(2) + ', uGrsBox.z, gD);',
        '  transformed.y *= aH * gF;',
        // the wind: a lean plus two incommensurate sines, phased on the foot
        '  float gW = length(uGrsWind);',
        '  vec2 gWd = gW > 0.001 ? uGrsWind / gW : vec2(0.0, 1.0);',
        '  float gK = min(gW / 3.5, 1.4);',
        '  float gP = gO.x * 0.31 + gO.z * 0.27;',
        '  float gS = sin(uGrsT * 1.9 + gP) * 0.7 + sin(uGrsT * 4.7 + gP * 1.9 + 1.3) * 0.3;',
        '  vec2 gLean = gWd * uGrsSway * gK * (0.55 + 0.45 * gS);',
        // the trample: lie along the velocity, stand up over the ring's life
        '  float gDown = 0.0;',
        '  for (int i = 0; i < ' + grsTR_N + '; i++) {',
        '    float age = uGrsT - uGrsTrT[i];',
        '    if (age < 0.0 || age > ' + grsTR_LIFE.toFixed(2) + ') continue;',
        '    float l = length(gO.xz - uGrsTr[i].xy);',
        '    float f = (1.0 - smoothstep(0.0, ' + grsTR_R.toFixed(2) + ', l)) * (1.0 - age / ' + grsTR_LIFE.toFixed(2) + ');',
        '    gLean += uGrsTr[i].zw * f * 0.9 * aH;',
        '    gDown = max(gDown, f);',
        '  }',
        '  float gRamp = gR * sqrt(gR);',
        '  transformed.y *= 1.0 - 0.78 * gDown * gR;',
        // world → local through the transpose: the instance matrix is a pure
        // yaw, so `v * M` is exactly its inverse (see _swayInject).
        '  vec3 gOff = vec3(gLean.x, 0.0, gLean.y) * gRamp;',
        '  transformed += gOff * mat3(instanceMatrix);',
        '}',
      ].join('\n'));
    // DoubleSide flips the normal on a back face, and half the blades in any
    // view are back faces: they lost the sun and read grey (measured, the
    // first Sydney frame). A blade is lit as the ground under it, both sides.
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <normal_fragment_begin>',
               '#include <normal_fragment_begin>\nnormal = normalize(vNormal);\nnonPerturbedNormal = normal;');
  };
  m.customProgramCacheKey = function () {
    return 'swayDgrass|' + grsTR_N + (prevKey ? '|' + prevKey.call(this) : '');
  };
  m.needsUpdate = true;

  // ---- the mesh --------------------------------------------------------------
  const geo = grsFanGeometry();
  const aH = new THREEx.InstancedBufferAttribute(new Float32Array(grsMAX), 1);
  aH.setUsage(THREEx.DynamicDrawUsage);
  geo.setAttribute('aH', aH);
  const mesh = new THREEx.InstancedMesh(geo, m, grsMAX);
  mesh.name = 'grsField';
  mesh.instanceMatrix.setUsage(THREEx.DynamicDrawUsage);
  mesh.instanceColor = new THREEx.InstancedBufferAttribute(new Float32Array(grsMAX * 3), 3);
  mesh.instanceColor.setUsage(THREEx.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.count = 0;
  mesh.visible = false;
  scene.add(mesh);

  // ---- layout state -----------------------------------------------------------
  const ox = new Float32Array(grsMAX), oz = new Float32Array(grsMAX);   // offsets from the anchor
  const yaw = new Float32Array(grsMAX), hh = new Float32Array(grsMAX), tint = new Float32Array(grsMAX);
  for (let i = 0; i < grsMAX; i++) {
    ox[i] = (grsHash(i, 1) * 2 - 1) * grsBOX_R;
    oz[i] = (grsHash(i, 2) * 2 - 1) * grsBOX_R;
    yaw[i] = grsHash(i, 3) * Math.PI * 2;
    hh[i] = grsHash(i, 4);
    tint[i] = 0.92 + grsHash(i, 5) * 0.18;
  }
  const anchor = new THREEx.Vector2(0, 0);
  let anchored = false;
  let name = (game.biome && game.biome.current) || 'sydney';
  let row = grsROW[name] || null;
  let table = null;
  let scanDue = 0;            // frames until the next scan attempt; -1 = done
  let scanTries = 0;
  let slice = grsSLICES;      // next slice to place; grsSLICES = nothing pending
  let placed = 0, standing = 0, recentres = 0, scanMs = 0;
  let T = 0;
  const M4 = new THREEx.Matrix4();
  const hit = { y: 0, r: 0, g: 0, b: 0 };
  const fwd = new THREEx.Vector3();
  const trLast = new THREEx.Vector2(1e9, 1e9);
  let trHead = 0;

  function grsApiOf() {
    const bm = game.biome, n = bm && bm.current;
    if (!n) return game.env || null;
    return n === 'sydney' ? game.env : (game[n] || null);
  }

  /** Place fan i at anchor + its offset: the ground under it, or parked. */
  function grsPlace(i) {
    const x = anchor.x + ox[i], z = anchor.y + oz[i];
    const api = grsApiOf();
    let h = 0;
    if (row && grsLookup(table, x, z, hit)) {
      let k = grsGate(row.gate, hit.r, hit.g, hit.b);
      if (k > 0 && row.minY !== undefined && hit.y < row.minY) k = 0;
      if (k > 0 && api && typeof api.isOverWater === 'function' && api.isOverWater(x, z)) k = 0;
      // the density is a probability: a thin patch grows fewer fans, not shorter ones
      if (k > 0 && grsHash(i, 6) > k) k = 0;
      if (k > 0) h = row.h[0] + (row.h[1] - row.h[0]) * hh[i];
    }
    if (h > 0) {
      M4.makeRotationY(yaw[i]);
      M4.setPosition(x, hit.y - grsSINK, z);
      mesh.setMatrixAt(i, M4);
      mesh.instanceColor.setXYZ(i, hit.r * tint[i], hit.g * tint[i], hit.b * tint[i]);
      aH.setX(i, h);
      standing++;
    } else {
      M4.makeScale(0, 0, 0);
      M4.setPosition(x, -1000, z);
      mesh.setMatrixAt(i, M4);
      aH.setX(i, 0);
    }
    placed++;
  }

  function grsPlaceSlice(s) {
    const n = row ? Math.min(row.n, grsMAX) : 0;
    const from = Math.floor(n * s / grsSLICES), to = Math.floor(n * (s + 1) / grsSLICES);
    if (s === 0) standing = 0;
    for (let i = from; i < to; i++) grsPlace(i);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    aH.needsUpdate = true;
  }

  /** Move the layout box to `cx, cz`: wrap what fell out, then re-place all. */
  function grsRecentre(cx, cz) {
    const dx = cx - anchor.x, dz = cz - anchor.y;
    anchor.set(cx, cz);
    if (anchored) {
      for (let i = 0; i < grsMAX; i++) {
        let x = ox[i] - dx, z = oz[i] - dz;
        if (x > grsBOX_R) x -= grsBOX_R * 2; else if (x < -grsBOX_R) x += grsBOX_R * 2;
        if (z > grsBOX_R) z -= grsBOX_R * 2; else if (z < -grsBOX_R) z += grsBOX_R * 2;
        ox[i] = x; oz[i] = z;
      }
    }
    anchored = true;
    recentres++;
    slice = 0;
  }

  function grsPrime(to) {
    name = to || 'sydney';
    row = grsROW[name] || null;
    table = null;
    scanDue = row ? 1 : -1;
    scanTries = 0;
    anchored = false;
    slice = grsSLICES;
    mesh.count = 0;
    mesh.visible = false;
    for (let i = 0; i < grsTR_N; i++) uTrT.value[i] = -1e9;
    trLast.set(1e9, 1e9);
  }
  grsPrime(name);
  game.events.on('biome:enter', function (e) { grsPrime(e && e.name); });

  function update(dt) {
    T += dt;
    uT.value = T;
    if (!row) return;
    const state = game.state || {};
    const rung = state.perfRung | 0;
    const capy = game.capy;
    const p = capy && capy.position;
    if (state.noGrass || rung >= 2 || !p) { mesh.visible = false; return; }

    // The ground, once per chapter. A chapter that has not finished putting
    // its meshes in the scene on the frame it is entered reads as empty here,
    // so an empty result is retried, not believed.
    if (scanDue > 0) {
      scanDue--;
      if (scanDue === 0) {
        const t0 = performance.now();
        table = grsScan(game, grsApiOf(), mesh, row.gate);
        scanMs = performance.now() - t0;
        if (table.kept === 0 && ++scanTries < 10) { table = null; scanDue = grsSCAN_RETRY; return; }
        scanDue = -1;
        anchored = false;
      }
      if (scanDue !== -1) return;
    }
    if (!table) return;

    // The anchor rides a little ahead of the animal along the lens; the box is
    // relaid when it has moved grsRECENTRE from where it was laid.
    const cam = game.camera;
    let cx = p.x, cz = p.z;
    if (cam) {
      cam.getWorldDirection(fwd);
      const L = Math.hypot(fwd.x, fwd.z);
      if (L > 0.01) { cx += fwd.x / L * grsAHEAD; cz += fwd.z / L * grsAHEAD; }
    }
    if (!anchored || Math.hypot(cx - anchor.x, cz - anchor.y) > grsRECENTRE) {
      grsRecentre(cx, cz);
      uBox.value.x = cx; uBox.value.y = cz;
    }
    if (slice < grsSLICES) { grsPlaceSlice(slice); slice++; }
    // the fade centre follows smoothly, so the edge never steps with the layout
    const lam = 1 - Math.exp(-grsFOLLOW * dt);
    uBox.value.x += (cx - uBox.value.x) * lam;
    uBox.value.y += (cz - uBox.value.y) * lam;
    uBox.value.z = grsFADE_R;

    // rung 1 halves the count — the fans are in hash order, so the first half
    // is a uniform thinning, not a missing corner
    const n = Math.min(row.n, grsMAX);
    mesh.count = rung >= 1 ? (n >> 1) : n;
    mesh.visible = mesh.count > 0;

    // the wind: the chapter's own gust, zero under prefers-reduced-motion
    const g = game.weather && typeof game.weather.gust === 'function' ? game.weather.gust() : null;
    if (g && !calmOn()) uWind.value.set(g.x, g.z); else uWind.value.set(0, 0);
    uSway.value = row.sway;

    // the trample ring: a point every grsTR_STEP of travel, with the velocity
    const v = capy.velocity;
    const sp = v ? Math.hypot(v.x, v.z) : 0;
    if (sp > 0.4 && capy.grounded && Math.hypot(p.x - trLast.x, p.z - trLast.y) > grsTR_STEP) {
      trLast.set(p.x, p.z);
      const i = trHead; trHead = (trHead + 1) % grsTR_N;
      uTr.value[i].set(p.x, p.z, v.x / sp, v.z / sp);
      uTrT.value[i] = T;
    }
  }

  const api = {
    update: update,
    /** For the harness: what the field is doing right now. */
    audit() {
      let live = 0;
      for (let i = 0; i < grsTR_N; i++) if (T - uTrT.value[i] < grsTR_LIFE) live++;
      return {
        biome: name, row: row ? { n: row.n, h: row.h, gate: row.gate } : null,
        table: table ? { meshes: table.meshes, seen: table.seen, kept: table.kept, cells: table.cells.size, scanMs: +scanMs.toFixed(1) } : null,
        count: mesh.count, visible: mesh.visible, standing, placed, recentres,
        anchor: [+anchor.x.toFixed(2), +anchor.y.toFixed(2)],
        fade: [+uBox.value.x.toFixed(2), +uBox.value.y.toFixed(2), uBox.value.z],
        wind: [+uWind.value.x.toFixed(2), +uWind.value.y.toFixed(2)], sway: uSway.value,
        trample: live, key: m.customProgramCacheKey(),
      };
    },
    /** For the harness: the ground read at a point, through the same table. */
    probe(x, z) {
      const o = { y: 0, r: 0, g: 0, b: 0 };
      const ok = grsLookup(table, x, z, o);
      return ok ? { y: +o.y.toFixed(3), r: +o.r.toFixed(3), g: +o.g.toFixed(3), b: +o.b.toFixed(3),
                    gate: row ? +grsGate(row.gate, o.r, o.g, o.b).toFixed(2) : 0 } : null;
    },
    /** For the harness: re-tune a chapter's row live (shallow merge). */
    rowSet(n, cfg) {
      if (!n || !cfg) return;
      const b = grsROW[n] || { n: 4000, h: [0.25, 0.45], gate: 0.04, sway: 0.1 };
      const next = {};
      for (const k in b) next[k] = b[k];
      for (const k in cfg) next[k] = cfg[k];
      grsROW[n] = next;
      if (n === name) { row = next; anchored = false; }
    },
    /** For the harness: read the table again (after a tune, or a late build). */
    rescan() { table = null; scanDue = 1; scanTries = 0; },
    mesh: mesh,
  };
  game.grass = api;
  return api;
}
