import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PALETTE, mat, rand, randInt, clamp, damp, lerp, grain, swayMesh } from './shared.js';

// ---------------------------------------------------------------------------
// AGENT A — PASTO, NARIÑO (chapter 2). ROUNDS 7-9: GALERAS AND THE VALLEY.
//
// This pass builds the natural world only — the closed-form terrain law, the
// one-draw-call landscape mesh, the heightfield that backs it, the volcano's
// smoke plume, the páramo/valley/coffee flora and the thermal columns the
// condor rides. The town (plaza, church, market, houses) lands next pass.
//
// Authored in the SAME world coordinates as Sydney: only one biome is ever
// attached to the scene / physics world at a time, so they cannot collide.
//
// Nothing here is built at boot. `createPasto` only registers the biome; the
// first `game.biome.switchTo('pasto')` calls `ensureBuilt()`, and everything
// added to the scene or the world inside it is auto-tagged as Pasto content.
// ---------------------------------------------------------------------------

let pastoBuilt = false;
let pastoRoot = null;
let pastoApi = null;
let pastoGame = null;

// ===========================================================================
// 1. THE TERRAIN LAW
//
// Closed form, deterministic, no noise tables, no raycasts, ~15 flops in the
// valley and ~30 on the cone. Every other module (npc, props, condor) reads
// this through game.pasto.terrainHeight, so it must stay cheap.
// ===========================================================================

const pastoREGION   = 130;   // terrain spans x,z in [-130, 130]
const pastoWALK     = 110;   // beyond this the ground curves away into the fog
const pastoEDGE_W   = 20;
const pastoEDGE_DROP = 18;

// Galeras. Contract-locked: centre (-40, 0, -70), base radius ~70, summit ~62.
const pastoGAL_X = -40;
const pastoGAL_Z = -70;
const pastoGAL_R = 70;
const pastoGAL_H = 62;
const pastoCRATER_R = 11;
const pastoCRATER_DEPTH = 17.5;
const pastoRIM_LIFT = 6.5;   // the lip stands proud enough to break the skyline
const pastoRIM_SKEW = 0.95;  // ...and the FAR wall stands ~10 m over the near lip
const pastoRIM_W = 10;
// Phase of the rim skew, in the atan2(dz, dx) frame. The plaza sits at roughly
// (0, 26) and the crater at (-40, -70), so a player looking at Galeras from town
// is on the bearing ang = atan2(96, 40) = 1.18 rad. Putting the skew MINIMUM on
// that bearing drops the near lip almost flat and throws the far wall 10 m up,
// which is the only reason the summit reads as a hole rather than two humps.
const pastoRIM_PHASE = 1.97;   // -> cos(1.18 + 1.97) = -1, i.e. the near lip
// Gullies are INCISIONS, not a sinusoid: `1 - |cos(k a)|` is zero on the broad
// spurs and cusps to 1 in the notches, so the gradient jumps across every
// ravine floor. That C1 break is what makes flat shading actually facet.
const pastoGULLY_A = 5.5;
const pastoGULLY_K = 4;      // -> 8 narrow notches
const pastoGULLY_A2 = 2.2;   // a coarser second set so the notches are irregular
const pastoGULLY_K2 = 3;     // -> 6, incommensurate with the first
// Lava benches. Above pastoBENCH_Y the cone is pulled toward a quantised ladder,
// which is a genuine C0 discontinuity — hard 1.8 m risers on the summit cone and
// around the crater lip. Kept high so nothing walkable is stepped.
const pastoBENCH_Y = 38;
const pastoBENCH_F = 7;
const pastoBENCH_Q = 4.0;
const pastoBENCH_S = 0.45;

// The lower ridge to the east that closes the valley off. Tall enough now to
// reach the rock band (y = 30) so it reads as a peak rather than a green wall,
// and widened to keep its flanks under the navBlocked slope limit.
const pastoRIDGE_X = 116;
const pastoRIDGE_W = 48;
const pastoRIDGE_H = 32;

// The shelf the colonial town sits on. h is multiplied to EXACTLY zero over the
// whole rectangle, so terrainHeight returns a constant y = 0 for the plaza
// footprint (x [-24,24], z [8,46]), the church, the market and the colonial
// street — cobbles cannot warp and stalls cannot sink. Outside the rectangle a
// smoothstep blend ring `pastoTOWN_F` wide lifts the valley swells back in, so
// the shelf has no cliff edge. The shelf is deliberately wider than the town
// (36 vs the street's 34) so even the end houses stand on dead-flat ground.
const pastoTOWN_X = 36;
const pastoTOWN_Z0 = 4;
const pastoTOWN_Z1 = 66;
const pastoTOWN_F = 15;      // feather width

// Coffee farm terraces (contract world-layout table).
const pastoCOF_X0 = 30, pastoCOF_X1 = 90, pastoCOF_Z0 = -20, pastoCOF_Z1 = 30;

const pastoPARAMO_Y = 22;    // páramo / frailejón slopes start here

function pastoClamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function pastoSmooth(t) { return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t); }

/**
 * The authority on Pasto ground height. y = f(x, z), pure and allocation free.
 *
 *   valley swells  (three sine products, |amplitude| <= 1.6)
 * + eastern ridge  (smoothstep wall, ~19-24 m, undulating along z)
 * + Galeras        (smoothstep cone: flat-footed base, steep middle third,
 *                   broad summit; radial gullies; raised crater rim; the
 *                   crater itself carved as an inverted bowl)
 * * town flatten   (multiplied to zero over the plaza shelf)
 * - edge fall-off  (world curves away past the walkable radius)
 */
function pastoHeight(x, z) {
  let h = 0.85 * Math.sin(x * 0.055) * Math.cos(z * 0.047)
        + 0.45 * Math.sin(x * 0.031 + 1.7) * Math.sin(z * 0.037 - 0.6)
        + 0.30 * Math.sin((x + z) * 0.085 + 2.2);

  const ra = 1 - Math.abs(x - pastoRIDGE_X) / pastoRIDGE_W;
  if (ra > 0) h += pastoRIDGE_H * pastoSmooth(ra) * (0.72 + 0.28 * Math.sin(z * 0.042 + 0.9));

  const dx = x - pastoGAL_X, dz = z - pastoGAL_Z;
  const d2 = dx * dx + dz * dz;
  if (d2 < pastoGAL_R * pastoGAL_R) {
    const d = Math.sqrt(d2);
    const t = 1 - d / pastoGAL_R;
    // Smoothstep profile: gentle apron at the foot, ~50 deg through the middle
    // third, flattening again into a broad summit — a stratovolcano, not a hat.
    let cone = pastoGAL_H * pastoSmooth(t);
    const ang = Math.atan2(dz, dx);
    // Ravines. The weight peaks at t ~ 0.85 — i.e. AT the crater lip — so the
    // notches cut the skyline instead of dying out halfway up the apron.
    const gw = pastoSmooth((t - 0.22) / 0.55) * pastoSmooth((1 - t) / 0.10);
    if (gw > 0) {
      cone -= gw * (pastoGULLY_A * (1 - Math.abs(Math.cos(ang * pastoGULLY_K + 0.7)))
                  + pastoGULLY_A2 * (1 - Math.abs(Math.cos(ang * pastoGULLY_K2 - 1.9))));
    }
    // Raised rim ring at the crater lip, deliberately lopsided: the low side is
    // the lip a condor can tip a capybara over.
    const rr = 1 - Math.abs(d - pastoCRATER_R) / pastoRIM_W;
    if (rr > 0) cone += pastoRIM_LIFT * rr * rr * (1 + pastoRIM_SKEW * Math.cos(ang + pastoRIM_PHASE));
    // The crater: inverted bowl, floor ~13-14 m under the rim, all above y~52.
    if (d < pastoCRATER_R) cone -= pastoCRATER_DEPTH * pastoSmooth(1 - d / pastoCRATER_R);
    // Lava benches — the one hard C0 crease in the whole law.
    const bw = pastoClamp01((cone - pastoBENCH_Y) / pastoBENCH_F);
    if (bw > 0) {
      const step = Math.floor(cone / pastoBENCH_Q) * pastoBENCH_Q + pastoBENCH_Q * 0.5;
      cone += (step - cone) * bw * pastoBENCH_S;
    }
    h += cone;
  }

  const fx = pastoSmooth(pastoClamp01(
    Math.min(x + pastoTOWN_X + pastoTOWN_F, pastoTOWN_X + pastoTOWN_F - x) / pastoTOWN_F));
  if (fx > 0) {
    const fz = pastoSmooth(pastoClamp01(
      Math.min(z - pastoTOWN_Z0 + pastoTOWN_F, pastoTOWN_Z1 + pastoTOWN_F - z) / pastoTOWN_F));
    h *= 1 - fx * fz;
  }

  const m = Math.abs(x) > Math.abs(z) ? Math.abs(x) : Math.abs(z);
  if (m > pastoWALK) h -= pastoEDGE_DROP * pastoSmooth((m - pastoWALK) / pastoEDGE_W);

  return h;
}

/** |grad h| via central differences. Used for flora rejection and nav. */
function pastoSlope(x, z) {
  const e = 1.5;
  const gx = pastoHeight(x + e, z) - pastoHeight(x - e, z);
  const gz = pastoHeight(x, z + e) - pastoHeight(x, z - e);
  return Math.sqrt(gx * gx + gz * gz) / (2 * e);
}

const pastoCraterCentre = new THREE.Vector3(pastoGAL_X, 0, pastoGAL_Z);
pastoCraterCentre.y = pastoHeight(pastoGAL_X, pastoGAL_Z);

/**
 * The height of the crater MOUTH — the lowest point of the rim ring, i.e. the
 * altitude at which anything coming out of the vent first clears the lip.
 * The plume used to be emitted from the crater FLOOR (craterCentre.y, ~13 m
 * below this), so its first six puffs were buried inside the cone and the
 * column appeared to start in mid-air, detached, well above the summit. Every
 * rising thing in this file now starts here instead.
 */
const pastoVENT_Y = (function () {
  let lo = Infinity;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const y = pastoHeight(pastoGAL_X + Math.cos(a) * pastoCRATER_R,
                          pastoGAL_Z + Math.sin(a) * pastoCRATER_R);
    if (y < lo) lo = y;
  }
  return lo;
})();

// ===========================================================================
// 6. THERMALS — published for condor.js, and rendered so the player can SEE them.
// `strength` is the upward acceleration (m/s^2) at the column axis; it falls
// off with radius and is cut off above `top` (absolute world y).
// ===========================================================================
const pastoThermals = [
  { x: pastoGAL_X, z: pastoGAL_Z, radius: 22, strength: 30, top: 90 },  // the crater itself
  { x: 0,   z: -70, radius: 16, strength: 21, top: 74 },                // sunny east flank
  { x: -14, z: -44, radius: 13, strength: 18, top: 60 },                // south-east flank
  { x: -40, z: -30, radius: 14, strength: 19, top: 64 },                // south apron
  { x: -68, z: -58, radius: 11, strength: 15, top: 52 },                // west flank
  // Moved off the capybara's own spawn point (0, 26). A column centred on the
  // spawn meant the player stood permanently INSIDE it, which is the one place
  // a visible thermal cannot be read — you see loose flakes, never the hoop.
  // Shifted to the plaza's church corner: 18 m from spawn, so the whole 30 m
  // column is in frame from the moment you arrive. Radius and strength unchanged.
  { x: 13,  z: 37,  radius: 13, strength: 13, top: 44 },                // dark plaza cobbles
  { x: 58,  z: 6,   radius: 14, strength: 14, top: 50 },                // coffee terraces
];
const pastoThermalBaseY = new Float32Array(pastoThermals.length);

// ===========================================================================
// Colour. mat() is flat Lambert only; the landscape and the flora get their
// variety from a per-vertex `color` attribute (still flat Lambert, one call).
//
// The material tint is PALETTE.volcanoSnow rather than a hardcoded white, so
// no hex is authored outside shared.js. Every colour written into a `color`
// attribute is pre-divided by that tint (pastoUnbase) so tint * vertexColor
// reproduces the palette entry exactly.
// ===========================================================================
const pastoBASE = new THREE.Color(PALETTE.volcanoSnow);
function pastoUnbase(c) { c.r /= pastoBASE.r; c.g /= pastoBASE.g; c.b /= pastoBASE.b; return c; }

const pastoColGrass  = new THREE.Color(PALETTE.paramoGrass);
const pastoColDark   = new THREE.Color(PALETTE.paramoDark);
const pastoColPale   = new THREE.Color(PALETTE.paramoPale);
const pastoColSoil   = new THREE.Color(PALETTE.paramoSoil);
const pastoColRock   = new THREE.Color(PALETTE.volcanoRock);
const pastoColRockD  = new THREE.Color(PALETTE.volcanoDark);
const pastoColAsh    = new THREE.Color(PALETTE.volcanoAsh);
const pastoColSnow   = new THREE.Color(PALETTE.volcanoSnow);
const pastoColGlow   = new THREE.Color(PALETTE.craterGlow);
const pastoColSmoke  = new THREE.Color(PALETTE.smoke);
const pastoColFogPale = new THREE.Color(PALETTE.andesFog);
const pastoColMoteLo = new THREE.Color(PALETTE.andesSun);
const pastoColMoteHi = new THREE.Color(PALETTE.andesFog);
// Sydney's own pale lawn. The Pasto valley is pulled toward it so the two
// biomes' greens sit in one sun-bleached family instead of Nariño reading as a
// forest and Sydney as a beach.
const pastoColBleach = new THREE.Color(PALETTE.grassPale);
// Cobbles. Four warm bases, drawn per quad, so the plaza reads as laid stone
// rather than a poured slab. PALETTE.stone (cool grey) is deliberately absent —
// it was what made the paving clash with the terracotta roofs beside it.
const pastoCobbleSet = [
  new THREE.Color(PALETTE.cobble), new THREE.Color(PALETTE.sandstone),
  new THREE.Color(PALETTE.cobbleDark), new THREE.Color(PALETTE.sandstoneDark),
];
const pastoColAdobeS  = new THREE.Color(PALETTE.adobeShade);
const pastoColAdobeW  = new THREE.Color(PALETTE.adobeWall);

const pastoTmpCol = new THREE.Color();
const pastoDummy = new THREE.Object3D();
const pastoEul = new THREE.Euler();
const pastoQuat = new THREE.Quaternion();
const pastoVecA = new THREE.Vector3();
const pastoVecB = new THREE.Vector3(1, 1, 1);

/** Altitude + slope banding for the landscape mesh. Writes into `out`. */
function pastoTerrainColour(out, y, slope, x, z) {
  // Two incommensurate sine grids give the valley patchy fields without noise.
  const mottle = Math.sin(x * 0.31) * Math.sin(z * 0.27) * 0.5 + 0.5;
  const patch = Math.sin(x * 0.093 + 1.3) * Math.sin(z * 0.077 - 0.4) * 0.5 + 0.5;
  const low = pastoClamp01(1 - Math.abs(y) / 7);
  // Base on paramoPale, not paramoGrass. Both are palette entries, but paramoPale
  // is a third less saturated and a shade lighter, and a 2.1-intensity sun lands
  // a mid-lightness green squarely in the range where chroma is most visible —
  // which is exactly why the flank used to read as forest green next to Sydney.
  out.copy(pastoColPale);
  out.lerp(pastoColGrass, 0.20 + 0.42 * (1 - patch));
  out.lerp(pastoColDark, 0.20 * (1 - mottle) * low);
  // Shaded slopes go dark; the steepest go to bare soil.
  out.lerp(pastoColDark, 0.44 * pastoSmooth((slope - 0.26) / 0.4));
  out.lerp(pastoColSoil, 0.24 * pastoSmooth((slope - 0.85) / 0.4));
  // Sun-bleach. Pull the whole walkable valley toward Sydney's own grassPale so
  // the two biomes share one washed-out tonal family. Fades out with altitude so
  // the rock bands below are not milked.
  out.lerp(pastoColBleach, 0.30 * low);
  // Altitude bands. Narrow transitions so they read as bands, not as a gradient.
  // Rock only starts above the páramo belt the frailejones live in (y 22..30).
  out.lerp(pastoColRock, pastoSmooth((y - 30) / 8));
  out.lerp(pastoColRockD, 0.32 * mottle * pastoSmooth((y - 33) / 6));
  out.lerp(pastoColAsh, pastoSmooth((y - 42) / 5));
  out.lerp(pastoColSnow, pastoSmooth((y - 54) / 3.5));
  // The vent. Keyed on distance from the axis, not on altitude — the cone
  // crosses the crater-floor height again out on its flanks at d ~ 28.
  const cdx = x - pastoGAL_X, cdz = z - pastoGAL_Z;
  const cd2 = cdx * cdx + cdz * cdz;
  if (cd2 < pastoCRATER_R * pastoCRATER_R) {
    const gg = pastoSmooth((1 - Math.sqrt(cd2) / pastoCRATER_R) * 1.7);
    out.lerp(pastoColGlow, 0.9 * gg * (0.5 + 0.5 * mottle));
  }
  return out;
}

// ===========================================================================
// Deterministic RNG so the valley is the same valley every run.
// ===========================================================================
let pastoSeed = 0x9e3779b9 | 0;
function pastoRnd() {
  pastoSeed = (pastoSeed + 0x6d2b79f5) | 0;
  let t = Math.imul(pastoSeed ^ (pastoSeed >>> 15), 1 | pastoSeed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function pastoRndR(a, b) { return a + pastoRnd() * (b - a); }

// ===========================================================================
// Geometry merge. BufferGeometryUtils is not importable under the contract, so
// this hand-rolls the concatenation: every part is baked to non-indexed,
// transformed, and its palette colour written into the shared `color` buffer.
// Build-time only.
// ===========================================================================
function pastoMerge(parts) {
  const flat = [];
  let total = 0;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    let g = p.g.index ? p.g.toNonIndexed() : p.g.clone();
    if (p.m) g.applyMatrix4(p.m);
    g.computeVertexNormals();
    flat.push({ g: g, c: p.c, gain: p.gain });
    total += g.attributes.position.count;
  }
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  let o = 0;
  for (let i = 0; i < flat.length; i++) {
    const g = flat[i].g;
    const pa = g.attributes.position.array, na = g.attributes.normal.array;
    const n = g.attributes.position.count;
    pastoTmpCol.setHex(flat[i].c);
    pastoUnbase(pastoTmpCol);
    // Optional aerial-perspective gain. The `color` attribute is float, so a
    // value over 1 is legal and simply raises the whole facet. It exists for the
    // far cordillera: those cones are lit by the same 2.1-intensity sun as
    // everything else, so their shadow-side facets fell to a heavy slate grey
    // and 24 of them read as a ring of dark shards. Lifting the tint pushes the
    // unlit faces up into haze and lets the lit ones bleach out, which is what
    // distance actually does to a mountain.
    if (flat[i].gain) {
      pastoTmpCol.r *= flat[i].gain;
      pastoTmpCol.g *= flat[i].gain;
      pastoTmpCol.b *= flat[i].gain;
    }
    for (let k = 0; k < n; k++) {
      const s = k * 3, d = (o + k) * 3;
      pos[d] = pa[s]; pos[d + 1] = pa[s + 1]; pos[d + 2] = pa[s + 2];
      nor[d] = na[s]; nor[d + 1] = na[s + 1]; nor[d + 2] = na[s + 2];
      col[d] = pastoTmpCol.r; col[d + 1] = pastoTmpCol.g; col[d + 2] = pastoTmpCol.b;
    }
    o += n;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

/** Build-time transform helper for pastoMerge parts. */
function pastoXf(px, py, pz, rx, ry, rz, sx, sy, sz) {
  pastoEul.set(rx || 0, ry || 0, rz || 0);
  pastoQuat.setFromEuler(pastoEul);
  pastoVecA.set(px || 0, py || 0, pz || 0);
  pastoVecB.set(sx === undefined ? 1 : sx, sy === undefined ? 1 : sy, sz === undefined ? 1 : sz);
  return new THREE.Matrix4().compose(pastoVecA, pastoQuat, pastoVecB);
}

// ===========================================================================
// 2. THE LANDSCAPE MESH — one PlaneGeometry-derived BufferGeometry, one draw call.
//
// The grid is warped along each axis so vertices bunch toward Galeras: the
// crater gets ~1 m quads while the far valley coasts at ~3 m, for the same
// triangle count. The warp is a monotone squeeze (k < 1 guarantees it) and is
// rescaled per side so the mesh edges still land exactly on +/-130.
// ===========================================================================
const pastoWARP_W = 45;
const pastoWARP_K = 0.42;    // < 1 keeps the squeeze monotone
function pastoWarpRaw(s, c) {
  const e = (s - c) / pastoWARP_W;
  return c + pastoWARP_W * e * (1 - pastoWARP_K * Math.exp(-e * e));
}

// ===========================================================================
// THE SURFACE THAT IS ACTUALLY DRAWN (integrity 8)
// ===========================================================================
// pastoHeight is the analytic law. It is NOT what the player is looking at.
// pastoBuildTerrainMesh evaluates that law at 45 x 45 warped vertices and joins
// them with flat triangles, so the drawn ground is piecewise LINEAR over facets
// 3.4 to 5.9 m across — and mid-facet the chord is a long way from the curve.
// Measured against the drawn mesh (qa/b3-ground.js): the collider, built from
// the law on a 4 m lattice, disagreed with the picture by more than 15 cm over
// 30.7 per cent of the chapter and by more than half a metre over 13.9, with
// the drawn ground sitting a mean 7.9 cm ABOVE it. That is the capybara visibly
// sunk into Galeras, and it is the one thing block 3 measured and could not fix.
//
// THE WARP IS SEPARABLE AND MONOTONE, WHICH IS WHY THIS IS ARITHMETIC. Each
// axis is warped by its own function of one variable, so the mesh's vertices —
// although unevenly spaced — still lie on a RECTILINEAR grid in world space.
// The drawn height at any point is therefore the flat triangle spanning the
// four grid lines around it, and finding it is two binary searches over
// forty-five numbers. No raycast, no inverse warp, no per-triangle search.
//
// Block 3's note says "no uniform grid can match a warped mesh" and that is
// still true — but the collider does not have to match the LAW. It has to match
// the SURFACE, and the surface is this.
const pastoMESH_SEG = 44;
let pastoMeshXS = null, pastoMeshZS = null, pastoMeshH = null;

function pastoMeshInit() {
  const N = pastoMESH_SEG, R = pastoREGION;
  // the same four rescale factors pastoBuildTerrainMesh uses, so the grid lines
  // are the mesh's own and not merely something like them
  const sxHi = (R - pastoGAL_X) / (pastoWarpRaw(R, pastoGAL_X) - pastoGAL_X);
  const sxLo = (-R - pastoGAL_X) / (pastoWarpRaw(-R, pastoGAL_X) - pastoGAL_X);
  const szHi = (R - pastoGAL_Z) / (pastoWarpRaw(R, pastoGAL_Z) - pastoGAL_Z);
  const szLo = (-R - pastoGAL_Z) / (pastoWarpRaw(-R, pastoGAL_Z) - pastoGAL_Z);
  pastoMeshXS = new Float64Array(N + 1);
  pastoMeshZS = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) {
    const u = -R + 2 * R * i / N;
    let r = pastoWarpRaw(u, pastoGAL_X);
    pastoMeshXS[i] = pastoGAL_X + (r - pastoGAL_X) * (r >= pastoGAL_X ? sxHi : sxLo);
    r = pastoWarpRaw(u, pastoGAL_Z);
    pastoMeshZS[i] = pastoGAL_Z + (r - pastoGAL_Z) * (r >= pastoGAL_Z ? szHi : szLo);
  }
  // 2 025 heights, evaluated once. The alternative is four pastoHeight calls
  // per query, and terrainHeight is asked five times a frame by the slope pose
  // alone.
  pastoMeshH = new Float64Array((N + 1) * (N + 1));
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      pastoMeshH[i * (N + 1) + j] = pastoHeight(pastoMeshXS[i], pastoMeshZS[j]);
    }
  }
}

/** Index of the cell containing v in the monotone array A, clamped to the ends. */
function pastoMeshFind(A, v) {
  let lo = 0, hi = A.length - 1;
  if (v <= A[0]) return 0;
  if (v >= A[hi]) return hi - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (A[m] <= v) lo = m; else hi = m; }
  return lo;
}

/**
 * THE HEIGHT OF THE GROUND THE PLAYER CAN SEE, at any (x, z).
 *
 * Published as terrainHeight, and read by the heightfield collider, the slope
 * pose, prop placement, the hint arrow, the local anchors and the stuck-rescue.
 * Every one of those wants the surface in the picture rather than the curve it
 * was generated from.
 *
 * Outside the mesh — the collider strips run two metres past it on each side —
 * the edge facet is extended flat, which is the only honest answer where
 * nothing is drawn at all.
 */
function pastoMeshY(x, z) {
  if (!pastoMeshXS) pastoMeshInit();
  const XS = pastoMeshXS, ZS = pastoMeshZS, H = pastoMeshH, W = pastoMESH_SEG + 1;
  const i = pastoMeshFind(XS, x), j = pastoMeshFind(ZS, z);
  const u = clamp((x - XS[i]) / (XS[i + 1] - XS[i]), 0, 1);
  const v = clamp((z - ZS[j]) / (ZS[j + 1] - ZS[j]), 0, 1);
  const h00 = H[i * W + j], h10 = H[(i + 1) * W + j];
  const h01 = H[i * W + j + 1], h11 = H[(i + 1) * W + j + 1];
  if (u + v <= 1) return h00 + (h10 - h00) * u + (h01 - h00) * v;
  return h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
}

function pastoBuildTerrainMesh() {
  // 44 x 44 quads = 3 872 triangles. ~5.9 m base quads, ~3.4 m across Galeras
  // once the warp has squeezed them: big, blunt facets you can count.
  const SEG = 44;
  // NON-INDEXED, and this is the whole point. An indexed grid shares each
  // vertex between six triangles, so a per-vertex colour is smeared across all
  // six and every altitude band comes out as a soft ramp. Non-indexed lets each
  // facet carry ONE flat colour taken from its own centroid, so the bands land
  // on hard facet edges — the same reason the cobbles are built this way.
  const geo = new THREE.PlaneGeometry(pastoREGION * 2, pastoREGION * 2, SEG, SEG).toNonIndexed();
  geo.rotateX(-Math.PI / 2);

  const sxHi = (pastoREGION - pastoGAL_X) / (pastoWarpRaw(pastoREGION, pastoGAL_X) - pastoGAL_X);
  const sxLo = (-pastoREGION - pastoGAL_X) / (pastoWarpRaw(-pastoREGION, pastoGAL_X) - pastoGAL_X);
  const szHi = (pastoREGION - pastoGAL_Z) / (pastoWarpRaw(pastoREGION, pastoGAL_Z) - pastoGAL_Z);
  const szLo = (-pastoREGION - pastoGAL_Z) / (pastoWarpRaw(-pastoREGION, pastoGAL_Z) - pastoGAL_Z);

  const pos = geo.attributes.position;
  const n = pos.count;
  const col = new Float32Array(n * 3);
  // The warp + height law is a pure function of the plane coordinate, so the
  // duplicated corner vertices land on exactly the same point and the sheet
  // stays watertight.
  for (let i = 0; i < n; i++) {
    let r = pastoWarpRaw(pos.getX(i), pastoGAL_X);
    const x = pastoGAL_X + (r - pastoGAL_X) * (r >= pastoGAL_X ? sxHi : sxLo);
    r = pastoWarpRaw(pos.getZ(i), pastoGAL_Z);
    const z = pastoGAL_Z + (r - pastoGAL_Z) * (r >= pastoGAL_Z ? szHi : szLo);
    pos.setXYZ(i, x, pastoHeight(x, z), z);
  }
  pos.needsUpdate = true;

  const pa = pos.array;
  for (let f = 0; f < n; f += 3) {
    const a = f * 3, b = a + 3, c = a + 6;
    const cx = (pa[a] + pa[b] + pa[c]) / 3;
    const cy = (pa[a + 1] + pa[b + 1] + pa[c + 1]) / 3;
    const cz = (pa[a + 2] + pa[b + 2] + pa[c + 2]) / 3;
    pastoTerrainColour(pastoTmpCol, cy, pastoSlope(cx, cz), cx, cz);
    pastoUnbase(pastoTmpCol);
    for (let k = 0; k < 3; k++) {
      const d = (f + k) * 3;
      col[d] = pastoTmpCol.r; col[d + 1] = pastoTmpCol.g; col[d + 2] = pastoTmpCol.b;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();                         // non-indexed -> true face normals
  geo.computeBoundingSphere();

  /**
   * TWO HUNDRED AND SIXTY METRES OF VALLEY IN FOUR COLOURS.
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
  const mesh = new THREE.Mesh(geo, grain(mat(PALETTE.volcanoSnow, { vertexColors: true }),
                                         { scale: 0.48, amount: 0.15, warp: 0, near: 0.52, nearPale: 0.55, nearScale: 8, contact: 1, broad: 0.1, broadM: 15 }));
  mesh.name = 'pastoLandscape';
  mesh.receiveShadow = true;
  mesh.castShadow = false;                            // 260 m of caster would eat the 2048 map
  return mesh;
}

// ===========================================================================
// 2b. THE FAR RANGE.
//
// Nariño is not one cone on a plain. Two overlapping rings of blunt peaks sit
// outside the walkable world so the valley has a horizon: the near ring in
// PALETTE.peakFar, the far ring in the paler PALETTE.andesFog so aerial
// perspective does the depth for free. Silhouette only — no collision, no
// shadows, one merged draw call, ~140 triangles for the whole cordillera.
// ===========================================================================
// `y` is the cone BASE. It has to sit far enough under the horizon that a sight
// line from plaza height (y ~ 4) grazing the terrain sheet's own edge (which has
// already dropped to about -18 by r = 130) still passes above it — otherwise you
// see the peak's bottom edge hanging in the sky with nothing under it, which is
// what made these read as floating shards. -42 / -56 clears that from eye level
// AND from condor altitude, where the sheet occludes from the other side.
const pastoPEAK_RINGS = [
  { r: 150, n: 12, c: PALETTE.peakFar, h0: 60, h1: 86,  w0: 50, w1: 80,  y: -42, a0: 0.0,  snow: 1, gain: 1.90 },
  { r: 184, n: 9,  c: PALETTE.peakFar, h0: 82, h1: 110, w0: 66, w1: 104, y: -56, a0: 0.29, snow: 0, gain: 2.40 },
];

function pastoBuildFarPeaks() {
  const parts = [];
  // CAPPED. These were openEnded, and mat() is FrontSide: from anywhere the open
  // base was above the eye you looked straight through the cone and out the far
  // side, which is the whole of the "translucent glass shard" defect.
  const cone5 = new THREE.ConeGeometry(1, 1, 5, 1, false);
  const cone4 = new THREE.ConeGeometry(1, 1, 4, 1, false);
  for (let k = 0; k < pastoPEAK_RINGS.length; k++) {
    const ring = pastoPEAK_RINGS[k];
    for (let i = 0; i < ring.n; i++) {
      const a = ring.a0 + (i / ring.n) * Math.PI * 2 + pastoRndR(-0.10, 0.10);
      const rr = ring.r * pastoRndR(0.93, 1.07);
      const hh = pastoRndR(ring.h0, ring.h1);
      const ww = pastoRndR(ring.w0, ring.w1);
      let px = Math.cos(a) * rr, pz = Math.sin(a) * rr;
      // The landscape sheet is a SQUARE out to +/-130, so a plain circle of
      // peaks would surface through the ground near the corners. Push every
      // peak out until it clears the sheet entirely.
      const mm = Math.abs(px) > Math.abs(pz) ? Math.abs(px) : Math.abs(pz);
      if (mm < 142) { const k = 142 / mm; px *= k; pz *= k; }
      const yaw = pastoRnd() * 1.3;
      parts.push({
        g: (i % 2) ? cone5 : cone4, c: ring.c, gain: ring.gain,
        m: pastoXf(px, ring.y + hh * 0.5, pz, 0, yaw, 0, ww * 0.5, hh, ww * 0.5),
      });
      if (ring.snow && i % 3 === 0) {
        // Radius ww*0.10 at height fraction 0.80 is EXACTLY the parent cone's
        // own radius there, and the cap's apex lands on the parent's apex, so
        // the snow sits in the silhouette instead of flaring out of it.
        parts.push({
          g: cone5, c: PALETTE.volcanoSnow, gain: 1.55,
          m: pastoXf(px, ring.y + hh * 0.80, pz, 0, yaw, 0, ww * 0.10, hh * 0.20, ww * 0.10),
        });
      }
    }
  }
  const mesh = new THREE.Mesh(pastoMerge(parts), mat(PALETTE.volcanoSnow, { vertexColors: true }));
  mesh.name = 'pastoFarPeaks';
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  cone5.dispose(); cone4.dispose();
  return mesh;
}

// ===========================================================================
// 3. PHYSICS — heightfields for the terrain, one box for the flat town shelf,
//    all sampled from the SAME height law as the mesh you can see.
// ===========================================================================
// The town shelf is provably dead flat — pastoHeight multiplies h to EXACTLY
// zero over x [-36,36], z [4,66] — so it does not need a heightfield at all, and
// paying for one there was the single biggest waste in the biome: every plaza
// prop and every never-sleeping kinematic local was rebuilding pillar
// ConvexPolyhedra against it, five substeps a frame, for a surface that is a
// plane. So: ONE box for the shelf, and the heightfield is cut into four strips
// that go round it. Everything is snapped to a common 4 m lattice anchored on
// the shelf edges, so neighbouring strips share their boundary sample lines
// exactly and the seams are watertight.
// ---- 4.0, AND MAKING IT FINER MADE THINGS WORSE (integrity 3) --------------
// MEASURED: the drawn ground sits a mean +7.9 cm ABOVE this collider, more than
// 15 cm away on 30.7% of the chapter and more than 50 cm on 13.9%. The animal
// stands on the collider and the player looks at the mesh, so that is a
// capybara visibly sunk into Galeras — and it is NOT the flat-pose problem
// block 4 fixes. Both are real and they are different.
//
// The obvious fix is a finer grid, on the theory that a heightfield is a chord
// and chord sag goes as the square of its length. It was tried at 2.0 and the
// disagreement went UP, 30.7% -> 34.5% and 13.9% -> 17.8%.
//
// The reason is in pastoBuildTerrainMesh: the drawn terrain is 44x44 quads over
// 260 m — 5.9 m facets, deliberately, "big, blunt facets you can count" — and
// it is then WARPED by pastoWarpRaw, so its vertices are not on a regular
// lattice at all. The old 4 m collider happened to sit near that surface; a
// 2 m one tracks the smooth analytic law instead and pulls AWAY from the
// picture. No uniform grid can match a warped mesh.
//
// So this stays at 4.0 and the real fix is to build the collider FROM the mesh
// vertices rather than from the law. That is a different piece of work and it
// is logged in the block 3 notes rather than half-done here.
const pastoHF_ES = 2.0;
const pastoSHELF_X = 36;      // = -36 + 18*4
const pastoSHELF_Z0 = 6;      // inside the flat rect (z >= 4), on the lattice
const pastoSHELF_Z1 = 66;     // = 6 + 15*4
const pastoHF_FAR = 132;      // = 36 + 24*4
const pastoHF_ZLO = -130;     // = 6 - 34*4
const pastoHF_ZHI = 134;      // = 66 + 17*4
// The same rectangle, published. See api.bounds() — this is the entire extent
// of the ground that exists as a rigid body, and therefore the entire extent of
// the world anything with the player in its feet is allowed to visit.
const pastoBOUNDS = { x0: -pastoHF_FAR, x1: pastoHF_FAR, z0: pastoHF_ZLO, z1: pastoHF_ZHI };

/** One heightfield over [x0,x1] x [z0,z1]. Spans MUST be multiples of `es`. */
function pastoHeightfieldStrip(game, x0, x1, z0, z1, es) {
  const ni = Math.round((x1 - x0) / es);
  const nj = Math.round((z1 - z0) / es);
  const data = new Array(ni + 1);
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i <= ni; i++) {
    const colArr = new Array(nj + 1);
    const wx = x0 + i * es;
    for (let j = 0; j <= nj; j++) {
      // THE DRAWN SURFACE, not the law it came from. See pastoMeshY.
      const y = pastoMeshY(wx, z1 - j * es);
      colArr[j] = y;
      if (y < lo) lo = y;
      if (y > hi) hi = y;
    }
    data[i] = colArr;
  }
  const shape = new CANNON.Heightfield(data, { elementSize: es, minValue: lo, maxValue: hi });
  const body = new CANNON.Body({ mass: 0, material: game.mats && game.mats.ground });
  body.addShape(shape);
  // Local (X, Y, Z) -> world (X, Z, -Y) under the -90 deg X rotation, so with
  // the body parked at (x0, 0, z1): worldX = x0 + i*es, worldZ = z1 - j*es.
  body.position.set(x0, 0, z1);
  body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  body.previousPosition.copy(body.position);
  body.interpolatedPosition.copy(body.position);
  body.previousQuaternion.copy(body.quaternion);
  body.interpolatedQuaternion.copy(body.quaternion);
  body.allowSleep = false;                            // static bodies never wake the island
  game.world.addBody(body);
  return body;
}

function pastoBuildGround(game) {
  const es = pastoHF_ES;
  const S = pastoSHELF_X, F = pastoHF_FAR;
  // south (holds all of Galeras) / north / west / east
  pastoHeightfieldStrip(game, -F, F, pastoHF_ZLO, pastoSHELF_Z0, es);
  pastoHeightfieldStrip(game, -F, F, pastoSHELF_Z1, pastoHF_ZHI, es);
  pastoHeightfieldStrip(game, -F, -S, pastoSHELF_Z0, pastoSHELF_Z1, es);
  pastoHeightfieldStrip(game, S, F, pastoSHELF_Z0, pastoSHELF_Z1, es);

  // The shelf itself: a box whose top face is exactly y = 0. Box-vs-box for the
  // whole town instead of 20 000 collision triangles' worth of pillars.
  const hy = 24;
  const hz = (pastoSHELF_Z1 - pastoSHELF_Z0) * 0.5;
  const shelf = pastoBody(game, 0);
  shelf.allowSleep = false;
  shelf.addShape(new CANNON.Box(new CANNON.Vec3(S, hy, hz)));
  pastoBodyDone(game, shelf, 0, -hy, (pastoSHELF_Z0 + pastoSHELF_Z1) * 0.5);
  return shelf;
}

// ===========================================================================
// 4. THE PLUME — one InstancedMesh of low-poly puffs, rising, expanding,
// fading toward the fog colour and recycling. Constant wind, zero allocations.
// ===========================================================================
const pastoSMOKE_N = 26;         // 26 puffs over 32 m is one every 1.2 m: no gaps
const pastoSMOKE_LIFE = 16;      // seconds per puff — slow, it is a volcano not a kettle
const pastoSMOKE_RISE = 32;
const pastoWIND_X = 0.95;        // the old 1.9 blew the column into a diagonal streak
const pastoWIND_Z = 0.5;
const pastoSmokeT = new Float32Array(pastoSMOKE_N);
const pastoSmokeSeed = new Float32Array(pastoSMOKE_N);
let pastoSmokeMesh = null;

function pastoBuildSmoke() {
  // Detail 1, not 0. A 20-face icosahedron at 6 m across is a hard-edged
  // hexagon in silhouette — the single biggest reason the plume read as flying
  // rocks. 80 faces is still flat-shaded and still cheap, but it is round.
  const g = new THREE.IcosahedronGeometry(1, 1);
  // vertexColors MUST NOT be set here. This geometry has no `color` attribute,
  // and USE_COLOR makes the shader do `vColor *= color` against a missing
  // attribute, which WebGL supplies as (0,0,0) — so every puff was multiplied to
  // black and then alpha-blended over the sky as a dark slate lump. That, and
  // nothing else, is why the smoke looked like basalt. USE_INSTANCING_COLOR on
  // its own already initialises vColor to white and applies setColorAt().
  const m = mat(PALETTE.volcanoSnow, {
    transparent: true, opacity: 0.30, depthWrite: false,
  });
  const im = new THREE.InstancedMesh(g, m, pastoSMOKE_N);
  im.name = 'pastoSmoke';
  im.frustumCulled = false;
  im.castShadow = false;
  im.receiveShadow = false;
  for (let i = 0; i < pastoSMOKE_N; i++) {
    pastoSmokeT[i] = i / pastoSMOKE_N;
    pastoSmokeSeed[i] = pastoRnd() * 6.2831;
    pastoTmpCol.copy(pastoColSmoke);
    pastoUnbase(pastoTmpCol);
    im.setColorAt(i, pastoTmpCol);                    // allocates instanceColor once, here
  }
  pastoSmokeMesh = im;
  return im;
}

function pastoUpdateSmoke(dt) {
  const im = pastoSmokeMesh;
  if (!im) return;
  for (let i = 0; i < pastoSMOKE_N; i++) {
    let t = pastoSmokeT[i] + dt / pastoSMOKE_LIFE;
    if (t >= 1) t -= 1;
    pastoSmokeT[i] = t;
    const s = pastoSmokeSeed[i];
    const age = t * pastoSMOKE_LIFE;
    const wob = 1.2 + 3.4 * t;
    pastoDummy.position.set(
      pastoCraterCentre.x + pastoWIND_X * age + Math.sin(s + t * 3.1) * wob,
      // Emitted AT the crater mouth, not off the crater floor 13 m below it, so
      // the bottom of the column is the lip and there is no gap to the summit.
      pastoVENT_Y - 1.6 + t * pastoSMOKE_RISE,
      pastoCraterCentre.z + pastoWIND_Z * age + Math.cos(s * 1.7 + t * 2.6) * wob
    );
    pastoDummy.rotation.set(s + t, s * 2.1 + t * 0.8, s * 0.7);
    // Starts fat enough to fill the vent (r ~ 3 m against an 11 m crater) and
    // triples on the way up, so consecutive puffs always overlap.
    let sc = 3.0 + t * 6.4;
    if (t > 0.74) sc *= (1 - t) / 0.26;
    pastoDummy.scale.set(sc, sc, sc);
    pastoDummy.updateMatrix();
    im.setMatrixAt(i, pastoDummy.matrix);
    pastoTmpCol.copy(pastoColSmoke).lerp(pastoColFogPale, t * 0.85);
    pastoUnbase(pastoTmpCol);
    im.setColorAt(i, pastoTmpCol);
  }
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
}

// ===========================================================================
// 6b. THERMAL MOTES — the readability half of the lift mechanic. A faint ring
// of dust spiralling up each column, one InstancedMesh, one draw call.
// ===========================================================================
// The column is drawn as a STACK OF RINGS, not a cloud of dots: 5 rings of 4,
// all four of a ring at the same height and the same radius, the whole stack
// sliding up and recycling. A ring is a shape a player can read from 80 m; the
// old random scatter of 0.4 m dark tetrahedra was indistinguishable from flies.
const pastoMOTE_RINGS = 5;
const pastoMOTE_ROUND = 10;
// Each mote is stretched ALONG the ring's tangent by a fraction of that ring's
// own radius, so eight of them cover about half the circumference whatever the
// thermal's size. That is what turns the column from a scatter of pale specks
// (which is all a uniformly-scaled mote can ever be at 22 m radius) into a
// visibly dashed hoop you can pick out of the sky from the plaza.
// 0.13, not 0.20: ten dashes still close the hoop, and a shorter dash keeps the
// bar chunky instead of stretching into a sheet of paper on the 22 m crater ring.
const pastoMOTE_ARC = 0.13;      // tangential half-length, in units of ring radius
const pastoMOTE_G = 0.62;        // the octahedron's own radius, divided back out
const pastoMOTE_PER = pastoMOTE_RINGS * pastoMOTE_ROUND;
const pastoMOTE_N = pastoMOTE_PER * pastoThermals.length;
const pastoMoteP = new Float32Array(pastoThermals.length);   // ONE phase per column
const pastoMoteSeed = new Float32Array(pastoThermals.length);
const pastoMoteSpan = new Float32Array(pastoThermals.length);
let pastoMoteMesh = null;

function pastoBuildMotes() {
  for (let j = 0; j < pastoThermals.length; j++) {
    const th = pastoThermals[j];
    // The crater thermal's terrain sample is the crater FLOOR, so its column
    // used to start 13 m down inside the cone where none of it is visible. Any
    // thermal sitting over the vent starts at the mouth instead.
    const dx = th.x - pastoGAL_X, dz = th.z - pastoGAL_Z;
    pastoThermalBaseY[j] = (dx * dx + dz * dz < pastoCRATER_R * pastoCRATER_R)
      ? pastoVENT_Y : pastoHeight(th.x, th.z);
    // The physics column runs all the way to `top`; the visible dust is capped
    // so a 44 m pillar of motes does not swamp the plaza.
    pastoMoteSpan[j] = clamp(th.top - pastoThermalBaseY[j], 8, 30);
    // A ring is only a ring if its four members share a height, so the phase
    // lives on the COLUMN, not the instance. Offset per column so seven towers
    // do not pulse in unison.
    pastoMoteP[j] = pastoRnd();
    pastoMoteSeed[j] = pastoRnd();
  }
  // Octahedron, not tetrahedron: a tetrahedron seen edge-on is a thin dark
  // sliver, which is precisely what read as an insect.
  const g = new THREE.OctahedronGeometry(pastoMOTE_G, 0);
  // No vertexColors — see pastoBuildSmoke. This geometry has no `color`
  // attribute either, so USE_COLOR was multiplying every mote to black.
  // Tint stays volcanoSnow: every instance colour in this file is pre-divided by
  // that entry (pastoUnbase), so tint * instanceColor reproduces the palette
  // value exactly. Changing the tint here would skew every mote.
  const m = mat(PALETTE.volcanoSnow, {
    transparent: true, opacity: 0.34, depthWrite: false,
  });
  const im = new THREE.InstancedMesh(g, m, pastoMOTE_N);
  im.name = 'pastoThermalMotes';
  im.frustumCulled = false;
  im.castShadow = false;
  im.receiveShadow = false;
  for (let k = 0; k < pastoMOTE_N; k++) {
    pastoTmpCol.copy(pastoColMoteLo);
    pastoUnbase(pastoTmpCol);
    im.setColorAt(k, pastoTmpCol);
  }
  pastoMoteMesh = im;
  return im;
}

function pastoUpdateMotes(dt) {
  const im = pastoMoteMesh;
  if (!im) return;
  let k = 0;
  for (let j = 0; j < pastoThermals.length; j++) {
    const th = pastoThermals[j];
    const by = pastoThermalBaseY[j];
    const span = pastoMoteSpan[j];
    let p = pastoMoteP[j] + dt * 2.2 / span;
    if (p >= 1) p -= 1;
    pastoMoteP[j] = p;
    const cseed = pastoMoteSeed[j];
    for (let q = 0; q < pastoMOTE_PER; q++, k++) {
      // p is the climb of ring 0 through one ring-spacing; ring n sits n/RINGS
      // higher. When p wraps, the top ring has already faded out at u = 1 and a
      // fresh one fades in at u = 0, so the stack recycles without a pop.
      const ring = (q / pastoMOTE_ROUND) | 0;
      const slot = q % pastoMOTE_ROUND;
      // Height within the column, 0..1. Every member of a ring shares it.
      const u = (ring + p) / pastoMOTE_RINGS;
      // The stack rotates as it climbs, so the four members trace a spiral, and
      // it opens from 0.55 to the full radius so the column reads as a funnel
      // whose mouth is unmistakably the thermal's own footprint.
      const ang = (slot / pastoMOTE_ROUND) * 6.2831 + u * 1.9 + cseed * 6.2831;
      // The hoop opens from 0.45 to 0.86 of the thermal's radius, so it always
      // sits inside the column it is advertising and reads as a funnel.
      const rr = th.radius * (0.45 + 0.41 * u);
      pastoDummy.position.set(
        th.x + Math.cos(ang) * rr,
        by + 1.0 + u * span,
        th.z + Math.sin(ang) * rr
      );
      // Yaw only, and yaw that puts the stretched local +X on the ring tangent:
      // rotation.y = t maps (1,0,0) to (cos t, 0, -sin t), and the tangent at
      // `ang` is (-sin ang, 0, cos ang), which needs t = -ang - PI/2.
      pastoDummy.rotation.set(0, -ang - 1.5708, 0);
      // Fade in off the ground and out at the cap, so rings do not pop.
      const fade = Math.min(1, u * 7, (1 - u) * 5);
      pastoDummy.scale.set(
        (rr * pastoMOTE_ARC / pastoMOTE_G) * fade,   // tangential: a ring dash
        // Vertical and radial stay near-equal: a dash that is flat in Y reads as
        // a sheet of paper when you look UP at a column from the plaza, which is
        // the angle this whole thing exists to be seen from.
        (0.95 + 0.40 * u) * fade,                    // vertical
        (0.85 + 0.40 * u) * fade                     // radial
      );
      pastoDummy.updateMatrix();
      im.setMatrixAt(k, pastoDummy.matrix);
      pastoTmpCol.copy(pastoColMoteLo).lerp(pastoColMoteHi, u);
      pastoUnbase(pastoTmpCol);
      im.setColorAt(k, pastoTmpCol);
    }
  }
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
}

// ===========================================================================
// 5. FLORA — InstancedMesh only, one draw call per species.
// ===========================================================================

/** Frailejón: furry grey-green trunk, rosette of thick pale leaves. ~52 tris. */
function pastoFrailejonGeom() {
  const parts = [];
  // CAPPED, not openEnded. mat() is FrontSide, so an open trunk is a 0.60 m hole
  // straight down through the plant — and looking down at it is exactly the view
  // the condor ride and the crater drop are built around.
  parts.push({
    g: new THREE.CylinderGeometry(0.30, 0.40, 1.5, 6, 1, false),
    c: PALETTE.paramoDark, m: pastoXf(0, 0.75, 0),
  });
  // Fat 3-sided leaves, capped at the base and pointed at the tip: the rosette
  // is ~1.5 m across so the plant still reads as a shape from 100 m up, and a
  // zero top radius makes each leaf 6 triangles instead of the old hollow 8.
  const leaf = new THREE.CylinderGeometry(0, 0.45, 1.05, 3, 1, false);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.35;
    parts.push({
      g: leaf,
      c: (i % 2) ? PALETTE.frailejon : PALETTE.paramoPale,
      m: pastoXf(
        Math.cos(a) * 0.30, 1.58, Math.sin(a) * 0.30,
        Math.sin(a) * 0.95, 0, -Math.cos(a) * 0.95
      ),
    });
  }
  const g = pastoMerge(parts);
  leaf.dispose();
  return g;
}

/** Andean shrub / low eucalypt. Octahedral clumps on a stub. ~32 tris. */
function pastoShrubGeom() {
  const clump = new THREE.OctahedronGeometry(0.62, 0);
  const g = pastoMerge([
    { g: new THREE.CylinderGeometry(0.13, 0.19, 0.55, 4, 1, true), c: PALETTE.paramoSoil, m: pastoXf(0, 0.27, 0) },
    { g: clump, c: PALETTE.eucalyptAnd, m: pastoXf(0, 0.92, 0, 0, 0.4, 0, 1.15, 0.85, 1.15) },
    { g: clump, c: PALETTE.agave, m: pastoXf(0.34, 0.66, -0.18, 0, 1.1, 0, 0.8, 0.7, 0.8) },
    { g: clump, c: PALETTE.paramoDark, m: pastoXf(-0.28, 0.72, 0.3, 0, 2.2, 0, 0.86, 0.72, 0.86) },
  ]);
  clump.dispose();
  return g;
}

/** Coffee bush with ripe cherries. ~40 tris. */
function pastoCoffeeGeom() {
  const clump = new THREE.OctahedronGeometry(0.55, 0);
  const cherry = new THREE.TetrahedronGeometry(0.11, 0);
  const parts = [
    { g: new THREE.CylinderGeometry(0.09, 0.14, 0.45, 4, 1, true), c: PALETTE.balconyWood, m: pastoXf(0, 0.22, 0) },
    { g: clump, c: PALETTE.coffeeBush, m: pastoXf(0, 0.68, 0, 0, 0.5, 0, 1.2, 0.85, 1.2) },
    { g: clump, c: PALETTE.coffeeLeaf, m: pastoXf(0.16, 1.02, -0.1, 0, 1.9, 0, 0.72, 0.62, 0.72) },
  ];
  const cx = [0.5, -0.44, 0.18, -0.2], cy = [0.66, 0.78, 1.12, 0.58], cz = [0.16, -0.3, 0.42, 0.48];
  for (let i = 0; i < 4; i++) parts.push({ g: cherry, c: PALETTE.coffeeCherry, m: pastoXf(cx[i], cy[i], cz[i]) });
  const g = pastoMerge(parts);
  clump.dispose(); cherry.dispose();
  return g;
}

// ---- WHAT IN THE VALLEY IS ALIVE (v44) -------------------------------------
// See THE WAKE in shared.js. Pasto is the windiest chapter in the first half —
// it is 2 527 m up a volcano — and the only things that ever moved in it were
// the smoke and the swifts. A frailejón is a rosette on a woolly trunk and a
// coffee bush is a bush; both stood in it like fenceposts.
//
// By name, and only the growing things: the talc and the thermal motes are
// airborne already and the smoke has its own solver. `auto` takes the window
// off each geometry so nothing here has to know how pastoShrubGeom is built.
const pastoALIVE = {
  pastoShrubs: [0.085, 2.2, 1.15],
  pastoCoffee: [0.060, 2.4, 1.30],
  pastoFrailejones: [0.070, 2.6, 0.95],
  pastoFrailejonBlooms: [0.055, 1.6, 1.20],
};
function pastoMakeInstanced(geom, count, name, shadow) {
  const im = new THREE.InstancedMesh(geom, mat(PALETTE.volcanoSnow, { vertexColors: true }), count);
  im.name = name;
  im.castShadow = !!shadow;
  im.receiveShadow = false;
  im.count = 0;
  const a = pastoALIVE[name];
  if (a) swayMesh(im, { leaf: 0.45, amount: a[0], axis: 'y', auto: true, stiff: a[1], hz: a[2] });
  return im;
}

function pastoPlace(im, i, x, y, z, yaw, sx, sy) {
  pastoDummy.position.set(x, y, z);
  pastoDummy.rotation.set(0, yaw, 0);
  pastoDummy.scale.set(sx, sy, sx);
  pastoDummy.updateMatrix();
  im.setMatrixAt(i, pastoDummy.matrix);
}

function pastoInTown(x, z, pad) {
  return x > -pastoTOWN_X - pad && x < pastoTOWN_X + pad &&
         z > pastoTOWN_Z0 - pad && z < pastoTOWN_Z1 + pad;
}
function pastoInCoffeeRect(x, z, pad) {
  return x > pastoCOF_X0 - pad && x < pastoCOF_X1 + pad &&
         z > pastoCOF_Z0 - pad && z < pastoCOF_Z1 + pad;
}
/** Keep the coffee rows out of the farmyard — bushes growing through the
 *  drying patio and the finca roof is not the look we are going for. */
function pastoInFarmyard(x, z) {
  if (Math.abs(x - pastoCOF_PATIO_X) < pastoCOF_PATIO_W * 0.5 + 1.6 &&
      Math.abs(z - pastoCOF_PATIO_Z) < pastoCOF_PATIO_D * 0.5 + 1.6) return true;
  if (Math.abs(x - pastoFINCA_X) < 7.0 && Math.abs(z - pastoFINCA_Z) < 6.6) return true;
  if (Math.abs(x - (pastoFINCA_X - 9)) < 3.6 && Math.abs(z - (pastoFINCA_Z + 8)) < 3.0) return true;
  return false;
}

/** Frailejones on the páramo flanks above y ~22. Bloom is a second tiny mesh. */
function pastoBuildFrailejones(root) {
  // A páramo is a FIELD, not scattered dots: 420 over the accepted annulus is a
  // plant every ~10 m^2, about 3 m apart. The triangles come out of the terrain
  // budget freed by dropping the landscape from 21.6k to 3.9k.
  const TARGET = 420;
  const im = pastoMakeInstanced(pastoFrailejonGeom(), TARGET, 'pastoFrailejones', true);
  const bloomGeom = pastoMerge([{ g: new THREE.TetrahedronGeometry(0.26, 0), c: PALETTE.frailejonBloom, m: null }]);
  const bloom = pastoMakeInstanced(bloomGeom, 110, 'pastoFrailejonBlooms', false);
  let n = 0, b = 0, guard = 0;
  while (n < TARGET && guard++ < TARGET * 40) {
    const th = pastoRnd() * Math.PI * 2;
    const d = pastoRndR(16, 47);
    const x = pastoGAL_X + Math.cos(th) * d;
    const z = pastoGAL_Z + Math.sin(th) * d;
    const y = pastoHeight(x, z);
    if (y < pastoPARAMO_Y || y > 50) continue;
    if (pastoSlope(x, z) > 1.35) continue;
    const s = pastoRndR(0.72, 1.45);
    const sy = s * pastoRndR(0.9, 1.25);
    pastoPlace(im, n, x, y - 0.12, z, pastoRnd() * 6.2831, s, sy);
    if (b < bloom.instanceMatrix.count && n % 4 === 1) {
      pastoPlace(bloom, b, x, y - 0.12 + 2.10 * sy, z, pastoRnd() * 6.2831, s, s);
      b++;
    }
    n++;
  }
  im.count = n; bloom.count = b;
  im.instanceMatrix.needsUpdate = true; bloom.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere(); bloom.computeBoundingSphere();
  root.add(im); root.add(bloom);
}

/** Shrubs and low eucalypts across the valley floor. */
function pastoBuildShrubs(root) {
  // 220 over 45 000 m^2 of valley floor was one bush every 200 m^2 — the valley
  // read as bare. 560 still leaves plenty of open ground to run across.
  const TARGET = 560;
  const im = pastoMakeInstanced(pastoShrubGeom(), TARGET, 'pastoShrubs', true);
  let n = 0, guard = 0;
  while (n < TARGET && guard++ < TARGET * 45) {
    const x = pastoRndR(-106, 106);
    const z = pastoRndR(-106, 106);
    if (pastoInTown(x, z, 5)) continue;
    if (pastoInCoffeeRect(x, z, 2)) continue;
    const y = pastoHeight(x, z);
    if (y > 20 || y < -1.8) continue;
    if (pastoSlope(x, z) > 0.62) continue;
    // A quarter of them stand up as spindly eucalypts; same geometry, one call.
    const tall = pastoRnd() < 0.26;
    const s = tall ? pastoRndR(0.8, 1.05) : pastoRndR(0.75, 1.35);
    pastoPlace(im, n, x, y - 0.08, z, pastoRnd() * 6.2831, s, s * (tall ? pastoRndR(2.3, 3.2) : pastoRndR(0.8, 1.2)));
    n++;
  }
  im.count = n;
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  root.add(im);
}

/** Coffee terraces: rows run along z at near-constant x, so they contour the
 *  east-facing hillside instead of cutting straight up it. */
function pastoBuildCoffee(root) {
  const TARGET = 300;
  const im = pastoMakeInstanced(pastoCoffeeGeom(), TARGET, 'pastoCoffee', false);
  let n = 0;
  for (let rx = pastoCOF_X0 + 2.5; rx <= pastoCOF_X1 - 2.5 && n < TARGET; rx += 3.6) {
    for (let z = pastoCOF_Z0 + 1.6; z <= pastoCOF_Z1 - 1.6 && n < TARGET; z += 2.4) {
      const x = rx + 1.3 * Math.sin(z * 0.09 + rx * 0.4);
      if (pastoSlope(x, z) > 0.85) continue;
      if (pastoInFarmyard(x, z)) continue;
      const y = pastoHeight(x, z);
      const s = pastoRndR(0.85, 1.2);
      pastoPlace(im, n, x, y - 0.06, z, pastoRndR(-0.4, 0.4), s, s * pastoRndR(0.9, 1.15));
      n++;
    }
  }
  im.count = n;
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  root.add(im);
}

// ===========================================================================
// 8. THE TOWN — PLAZA DE NARIÑO, LA IGLESIA, EL MERCADO, LA CALLE COLONIAL
//
// The whole town stands on the flattened shelf carved by pastoHeight (see
// pastoTOWN_*), so every y below is an absolute world height and nothing has
// to sample the terrain. Draw calls are the scarce resource, so:
//
//   cobbles           1 mesh   (hand-built non-indexed grid, per-quad colour)
//   plaza furniture   1 mesh   (kerb + fountain + benches + planters + trees)
//   church + tower    1 mesh   (+1 for the bell, which moves)
//   market            1 mesh   for all ten stalls' static halves
//                     +1 mesh per stall for the awning frame, because each one
//                      has to be able to fall over independently
//   colonial street   1 mesh   (19 houses + the paving between the rows)
//   coffee farm       1 mesh   (drying patio + finca + sacks)
//
// = 17 draw calls for the entire town.
// ===========================================================================

// ---- footprints (contract world-layout table) -----------------------------
const pastoPLZ_X0 = -24, pastoPLZ_X1 = 24, pastoPLZ_Z0 = 8, pastoPLZ_Z1 = 46;
const pastoMKT_X0 = -26, pastoMKT_X1 = 26, pastoMKT_Z0 = 10, pastoMKT_Z1 = 30;
const pastoSTR_X0 = -34, pastoSTR_X1 = 34, pastoSTR_Z0 = 46, pastoSTR_Z1 = 62;
const pastoSTR_SF = 51.4;          // south row facade plane, faces +z
const pastoSTR_NF = 57.2;          // north row facade plane, faces -z
const pastoSTR_D  = 4.9;           // house depth

const pastoCH_HW = 8.0;            // nave half-width
const pastoCH_ZF = 37.0;           // facade plane (south, into the plaza)
const pastoCH_ZB = 51.0;           // back wall  -> nave centred on z = 44
const pastoCH_FLOOR = 0.7;         // podium top

const pastoTW_X = -11.0, pastoTW_Z = 38.0, pastoTW_HW = 2.6;   // bell tower
// The tower leans. One deliberate error is worth ten correct mouldings, and a
// 0.03 rad list is 0.44 m of overhang by the time you reach the belfry — enough
// to read from the plaza, not enough to look like a bug.
const pastoTW_LEAN = 0.03;
const pastoTW_LC = Math.cos(pastoTW_LEAN);
const pastoTW_LS = Math.sin(pastoTW_LEAN);
/** World x of the point (lx, ly) in the leaning tower's frame. */
function pastoTwX(lx, ly) { return pastoTW_X + lx * pastoTW_LC - ly * pastoTW_LS; }

const pastoBELL_PIV = 14.75;       // hinge height in the tower's own frame
const pastoBELL_HANG = 0.85;       // pivot -> bell centre of mass
const pastoBELL_PIVX = pastoTwX(0, pastoBELL_PIV);
const pastoBELL_PIVY = pastoBELL_PIV * pastoTW_LC;
const pastoBELL_Y = pastoBELL_PIVY - pastoBELL_HANG;
const pastoROPE_X = -12.05, pastoROPE_Z = 38.6, pastoROPE_Y = 1.15;

const pastoFTN_X = 0, pastoFTN_Z = 20, pastoFTN_R = 3.4;   // fountain (clear of spawn)

const pastoCOF_PATIO_X = 52, pastoCOF_PATIO_Z = 12;
const pastoCOF_PATIO_W = 13, pastoCOF_PATIO_D = 10;
const pastoFINCA_X = 68, pastoFINCA_Z = -4;

// ---------------------------------------------------------------------------
// Build-time helpers. All of these allocate — they run once, inside
// ensureBuilt, and never from update().
// ---------------------------------------------------------------------------
const pastoUnitBox = new THREE.BoxGeometry(1, 1, 1);

function pastoXfAt(base, px, py, pz, rx, ry, rz, sx, sy, sz) {
  const m = pastoXf(px, py, pz, rx, ry, rz, sx, sy, sz);
  return base ? base.clone().multiply(m) : m;
}
/** A local->world frame for a building: translate + yaw. */
function pastoFrame(x, y, z, ry) { return pastoXf(x, y, z, 0, ry || 0, 0); }

/** Push a box part. hx/hy/hz are HALF extents, like CANNON.Box. */
function pastoBox(parts, base, c, x, y, z, hx, hy, hz, ry, rx, rz) {
  parts.push({
    g: pastoUnitBox, c: c,
    m: pastoXfAt(base, x, y, z, rx || 0, ry || 0, rz || 0, hx * 2, hy * 2, hz * 2),
  });
}
function pastoPart(parts, base, c, g, x, y, z, rx, ry, rz, sx, sy, sz) {
  parts.push({ g: g, c: c, m: pastoXfAt(base, x, y, z, rx, ry, rz, sx, sy, sz) });
}

function pastoTownMesh(parts, name, cast, recv) {
  const m = new THREE.Mesh(pastoMerge(parts), mat(PALETTE.volcanoSnow, { vertexColors: true }));
  m.name = name;
  m.castShadow = !!cast;
  m.receiveShadow = !!recv;
  return m;
}

/** Start a pooled body. mass 0 -> STATIC. Shapes are added in WORLD coords and
 *  the body itself is left at the origin, so no frame maths at call sites. */
function pastoBody(game, mass) {
  const b = new CANNON.Body({
    mass: mass || 0,
    type: mass ? CANNON.Body.DYNAMIC : CANNON.Body.STATIC,
    material: game.mats ? (mass ? game.mats.prop : game.mats.ground) : undefined,
  });
  b.allowSleep = true;
  return b;
}
function pastoBodyBox(b, x, y, z, hx, hy, hz, ry) {
  const q = new CANNON.Quaternion();
  if (ry) q.setFromEuler(0, ry, 0);
  b.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)), new CANNON.Vec3(x, y, z), q);
  return b;
}
/** Seed the interpolation pair by hand — these bodies are placed, never simulated. */
function pastoBodyDone(game, b, x, y, z) {
  b.position.set(x || 0, y || 0, z || 0);
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
  b.previousQuaternion.copy(b.quaternion);
  b.interpolatedQuaternion.copy(b.quaternion);
  game.world.addBody(b);
  return b;
}

// ---------------------------------------------------------------------------
// 8a. COBBLES. One non-indexed grid so every quad can carry its own flat colour
// (an indexed grid would blend them into mush). Corner heights come from a
// shared function, so neighbouring quads stay watertight.
// ---------------------------------------------------------------------------
function pastoCobbleY(x, z) {
  return 0.055 + 0.022 * Math.sin(x * 0.8 + z * 0.35) * Math.cos(z * 0.62 - x * 0.21);
}
function pastoHash01(i, j) {
  const s = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function pastoBuildCobbles() {
  // 0.8 m units, not 1.6 m. A 1.6 m paving quad is longer than the capybara —
  // at that size the plaza cannot help reading as poured slabs, whatever colour
  // it is. Halving it puts two stones under the animal and gives four times the
  // colour samples to break up. Still ONE draw call; 5 856 triangles.
  const nx = 60, nz = 48;
  const cw = (pastoPLZ_X1 - pastoPLZ_X0) / nx;
  const ch = (pastoPLZ_Z1 - pastoPLZ_Z0) / nz;
  // Running bond: odd rows are shifted half a stone, so the joints stagger like
  // laid setts instead of lining up into a continuous grid of tile grout. That
  // costs one extra column per row, clamped back to the kerb at both ends.
  const quads = (nx + 1) * nz;
  const pos = new Float32Array(quads * 18);
  const nor = new Float32Array(quads * 18);
  const col = new Float32Array(quads * 18);
  let o = 0;
  for (let i = 0; i <= nx; i++) {
    for (let j = 0; j < nz; j++) {
      const off = (j & 1) ? 0.5 : 0;
      let x0 = pastoPLZ_X0 + (i - 1 + off) * cw;
      let x1 = x0 + cw;
      if (x0 < pastoPLZ_X0) x0 = pastoPLZ_X0;
      if (x1 > pastoPLZ_X1) x1 = pastoPLZ_X1;
      if (x1 <= x0) { x1 = x0; }                        // degenerate: costs nothing
      const z0 = pastoPLZ_Z0 + j * ch, z1 = z0 + ch;
      const y00 = pastoCobbleY(x0, z0), y10 = pastoCobbleY(x1, z0);
      const y11 = pastoCobbleY(x1, z1), y01 = pastoCobbleY(x0, z1);

      const t = pastoHash01(i, j);
      const u = pastoHash01(i * 7 + 3, j * 13 + 5);
      // Pick one of four WARM bases per stone, then push it a random amount
      // toward adobeShade. Two independent hashes means neighbours rarely agree,
      // which is the whole difference between "laid" and "poured".
      pastoTmpCol.copy(pastoCobbleSet[(u * 4) | 0]);
      pastoTmpCol.lerp(pastoColAdobeS, 0.10 + 0.42 * t);
      // Two worn desire lines: the church axis, and a ring around the fountain.
      // Worn TOWARD adobeWall — the old lerp went to PALETTE.stone, a cool grey,
      // and that grey stripe through the middle was what set the whole plaza
      // against the terracotta roofs on its edge.
      const cx = x0 + (x1 - x0) * 0.5, cz = z0 + ch * 0.5;
      const dfx = cx - pastoFTN_X, dfz = cz - pastoFTN_Z;
      const df = Math.sqrt(dfx * dfx + dfz * dfz);
      if (Math.abs(cx) < 2.7 || Math.abs(df - 7.4) < 1.5) {
        pastoTmpCol.lerp(pastoColAdobeW, 0.42 + 0.28 * t);
      }
      pastoUnbase(pastoTmpCol);

      // Winding matters more than the normal attribute: these must be
      // counter-clockwise seen from +y or the whole plaza is back-face culled
      // and you are left standing on grass.
      const vx = [x0, x1, x1, x0, x0, x1];
      const vy = [y00, y11, y10, y00, y01, y11];
      const vz = [z0, z1, z0, z0, z1, z1];
      for (let k = 0; k < 6; k++) {
        const d = (o + k) * 3;
        pos[d] = vx[k]; pos[d + 1] = vy[k]; pos[d + 2] = vz[k];
        nor[d] = 0; nor[d + 1] = 1; nor[d + 2] = 0;
        col[d] = pastoTmpCol.r; col[d + 1] = pastoTmpCol.g; col[d + 2] = pastoTmpCol.b;
      }
      o += 6;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, mat(PALETTE.volcanoSnow, { vertexColors: true }));
  m.name = 'pastoCobbles';
  m.receiveShadow = true;
  m.castShadow = false;
  return m;
}

// ---------------------------------------------------------------------------
// 8b. PLAZA FURNITURE — kerb, fountain, benches, planters, clipped trees.
// ---------------------------------------------------------------------------
const pastoBenchN = 6;
const pastoBenchR = 6.4;
// Phased so the gap between two benches points straight at the capybara spawn
// (0, 26) — otherwise the poor thing materialises sitting on a park bench.
const pastoBenchPhase = Math.PI / 3;
const pastoPlanters = [
  { x: -18, z: 33 }, { x: 18, z: 33 }, { x: -18, z: 41 }, { x: 18, z: 41 },
];

function pastoBenchAt(parts, i) {
  const a = (i / pastoBenchN) * Math.PI * 2 + pastoBenchPhase;
  const bx = pastoFTN_X + Math.cos(a) * pastoBenchR;
  const bz = pastoFTN_Z + Math.sin(a) * pastoBenchR;
  const base = pastoFrame(bx, 0, bz, -a + Math.PI * 0.5);
  pastoBox(parts, base, PALETTE.balconyWood, 0, 0.56, 0, 1.05, 0.07, 0.28);
  pastoBox(parts, base, PALETTE.balconyWood, 0, 0.92, -0.24, 1.05, 0.29, 0.06, 0, -0.18);
  pastoBox(parts, base, PALETTE.stoneDark, -0.88, 0.28, 0, 0.13, 0.28, 0.3);
  pastoBox(parts, base, PALETTE.stoneDark, 0.88, 0.28, 0, 0.13, 0.28, 0.3);
  return { x: bx, z: bz };
}

// ---------------------------------------------------------- PAPEL PICADO ----
// THE CHAPTER IS A CARNIVAL AND THE PLAZA WAS BARE OVERHEAD.
//
// Everything in this square is at knee height or below — kerb, benches,
// planters, market trestles — and the one band of the frame a plaza actually
// fills is the one between two and five metres up, strung from side to side.
// Nariño hangs papel picado (cut paper flags) across a plaza for Carnaval and
// leaves it up until the weather takes it, and the shape it makes — a shallow
// catenary of little coloured triangles, sagging in the middle — is the single
// most recognisable thing about a South American square in January.
//
// Six runs across the plaza, each a chain of flags on a sag. One extra merged
// mesh and one extra draw call for the whole lot — and it has to be its own
// mesh rather than part of the plaza furniture, because it must NOT cast.
//
// MEASURED, not assumed: with the runs merged into pastoPlazaFurniture (which
// casts) the cords threw a dozen chunky grey bars across the paving. A 5 cm
// cord six metres up is thinner than one shadow-map texel at this scene scale,
// so what the map actually stores is a blocky approximation several texels
// wide — the classic thin-geometry shadow artefact, and it read as scaffolding
// poles lying in the square. Bunting does not shade a plaza anyway.
//
// ---- AND IT HAS TO BE ABOVE THE CAMERA -------------------------------
// The first cut hung the runs at 6.4-7.0 m with a two-metre sag, which is a
// perfectly sensible height for bunting and completely wrong for this game.
// Measured from the rendered frame at the plaza: the follow camera's eye sits
// at y = 8.6, so every one of those runs was BELOW it — cords cutting grey
// bars straight across the paving on either side of the animal and flags
// hanging round its ears. The chapter's prettiest addition was also the one
// thing standing between the player and their own capybara.
//
// So the whole canopy goes up: 11.6 m at the posts, sag 1.4-1.8, lowest point
// 9.8 m — a metre and a bit clear of the eye at its deepest. It now frames the
// TOP of the shot, which is what an overhead run is for, and the camera passes
// under it exactly as a person would.
//
// Both longitudinal runs are gone with it. They ran the length of the play
// space, so they were the two that spent the most time between the eye and the
// animal; four more cross runs put the density back without ever lying along
// the camera's own axis. Clear of everything below: the carroza's sun tops
// out at 5.15 m and the fountain jet at 4.42.
const pastoBUNT = [
  // x0, z0, x1, z1, height at the posts, sag
  [-22.5, 12, 22.5, 12, 11.6, 1.6],
  [-22.5, 17, 22.5, 17, 11.4, 1.5],
  [-22.5, 22, 22.5, 22, 11.7, 1.8],
  [-22.5, 28, 22.5, 28, 11.5, 1.7],
  [-22.5, 34, 22.5, 34, 11.6, 1.6],
  [-22.5, 40, 22.5, 40, 11.3, 1.4],
];
const pastoBUNT_COL = [PALETTE.awning1, PALETTE.awning2, PALETTE.awning3, PALETTE.awning4,
                       PALETTE.churchTrim];

/**
 * THE POSTS ARE SOLID (9 Sep 2026), AND IT WAS A DECISION AND NOT A BUG.
 *
 * ROADMAP-PHYSICS X9 found the twelve of them drawn and not solid — 22 cm
 * square and 11.6 m tall — and deliberately refused to settle it: *"collide
 * them or write down that thin plaza furniture stays open... that is the
 * owner's call, not a probe's"*. What it wanted was the Göreme test, where
 * the baskets were collided at 2.4 m and the 1.9 m fan was left open BECAUSE
 * A TASK RUNS THROUGH IT. MEASURED here (`qa/px-pasto-bunting.js`):
 *
 *   where they are ......  all twelve at x ±22.5, six z's — two columns 1.5 m
 *                          inside the plaza's rim, not scattered across it
 *   walked at, one by one  **ten of twelve go straight through**; the two at
 *                          z 28 already stop you 1.6 m out, on a neighbour
 *   the carroza's line ..  x 10.5, half-width 1.62 — **10.4 m clear**
 *
 * So nothing needs the ground they stand on, the behaviour was already
 * inconsistent across the twelve, and a post that visibly holds up a line of
 * flags is not the same class of object as a bollard nobody looks at. Thin is
 * an argument about the collider's SIZE, not about whether there is one: the
 * boxes below are the drawn post's own half-extents to the centimetre, so
 * nothing sticks out that you cannot see.
 *
 * One pooled body, twelve shapes.
 */
function pastoBuildBunting(game, parts) {
  const flagG = new THREE.ConeGeometry(0.5, 1, 3);
  const pb = pastoBody(game, 0);
  for (let r = 0; r < pastoBUNT.length; r++) {
    const B = pastoBUNT[r];
    const x0 = B[0], z0 = B[1], x1 = B[2], z1 = B[3], hy = B[4], sag = B[5];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const yaw = Math.atan2(x1 - x0, z1 - z0);
    // a post at each end, so the line is HELD UP by something
    for (let e = 0; e < 2; e++) {
      const px = e ? x1 : x0, pz = e ? z1 : z0;
      pastoBox(parts, null, PALETTE.stoneDark, px, hy * 0.5, pz, 0.11, hy * 0.5, 0.11);
      pastoBox(parts, null, PALETTE.stoneDark, px, hy, pz, 0.20, 0.09, 0.20);
      // the same box, as a shape. The cap at the top is not collided: it is
      // 20 cm of finial eleven metres up, and nothing in this game can be
      // eleven metres up at x ±22.5.
      pastoBodyBox(pb, px, hy * 0.5, pz, 0.11, hy * 0.5, 0.11);
    }
    const n = Math.max(6, Math.round(len / 1.5));
    let prevY = hy, prevT = 0;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = lerp(x0, x1, t), z = lerp(z0, z1, t);
      // a parabola is close enough to a catenary at this sag, and it is one mul
      const y = hy - sag * 4 * t * (1 - t);
      if (i > 0) {
        // the cord itself: one thin box per span, pitched along the sag
        const mx = lerp(x0, x1, (t + prevT) * 0.5), mz = lerp(z0, z1, (t + prevT) * 0.5);
        const seg = len / n;
        const pitch = Math.atan2(y - prevY, seg);
        pastoBox(parts, null, PALETTE.stoneDark, mx, (y + prevY) * 0.5, mz,
                 Math.hypot(seg, y - prevY) * 0.5, 0.025, 0.025, yaw, 0, -pitch);
      }
      if (i === 0 || i === n) { prevY = y; prevT = t; continue; }
      // the flag: a triangle hanging point-down off the cord
      const c = pastoBUNT_COL[(i + r * 3) % pastoBUNT_COL.length];
      pastoPart(parts, null, c, flagG, x, y - 0.24, z,
                Math.PI, yaw + 0.22 * Math.sin(i * 1.7), 0, 0.46, 0.48, 0.05);
      prevY = y; prevT = t;
    }
  }
  pastoBodyDone(game, pb, 0, 0, 0);
  flagG.dispose();
}

function pastoBuildPlazaFurniture(game, root) {
  const parts = [];

  // -- kerb ring: the plaza reads as a raised platform, not a painted rectangle.
  const kc = PALETTE.stoneDark;
  pastoBox(parts, null, kc, 0, 0.13, pastoPLZ_Z0 - 0.3, 24.4, 0.13, 0.32);
  pastoBox(parts, null, kc, 0, 0.13, pastoPLZ_Z1 + 0.3, 24.4, 0.13, 0.32);
  pastoBox(parts, null, kc, pastoPLZ_X0 - 0.3, 0.13, 27, 0.32, 0.13, 19.4);
  pastoBox(parts, null, kc, pastoPLZ_X1 + 0.3, 0.13, 27, 0.32, 0.13, 19.4);

  // -- fountain. Octagonal basin, two-tier, a jet you can see from the church.
  const oct8 = new THREE.CylinderGeometry(1, 1, 1, 8, 1, false);
  const octOpen = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
  const fb = pastoFrame(pastoFTN_X, 0, pastoFTN_Z, Math.PI / 8);
  pastoPart(parts, fb, PALETTE.stone, octOpen, 0, 0.5, 0, 0, 0, 0, pastoFTN_R, 1.0, pastoFTN_R);
  pastoPart(parts, fb, PALETTE.stoneDark, oct8, 0, 1.03, 0, 0, 0, 0, pastoFTN_R + 0.22, 0.2, pastoFTN_R + 0.22);
  pastoPart(parts, fb, PALETTE.water, oct8, 0, 0.8, 0, 0, 0, 0, pastoFTN_R - 0.2, 0.1, pastoFTN_R - 0.2);
  pastoPart(parts, fb, PALETTE.stone, oct8, 0, 1.75, 0, 0, 0, 0, 0.62, 1.5, 0.62);
  pastoPart(parts, fb, PALETTE.stone, oct8, 0, 2.6, 0, 0, 0, 0, 1.5, 0.42, 1.5);
  pastoPart(parts, fb, PALETTE.water, oct8, 0, 2.83, 0, 0, 0, 0, 1.25, 0.09, 1.25);
  pastoPart(parts, fb, PALETTE.foam, oct8, 0, 3.35, 0, 0, 0, 0, 0.16, 1.1, 0.16);
  pastoPart(parts, fb, PALETTE.foam, new THREE.OctahedronGeometry(0.42, 0), 0, 4.0, 0);

  // -- benches ringing the fountain
  for (let i = 0; i < pastoBenchN; i++) pastoBenchAt(parts, i);

  // -- planters with clipped (topiary) trees
  const clump = new THREE.OctahedronGeometry(1, 0);
  for (let i = 0; i < pastoPlanters.length; i++) {
    const p = pastoPlanters[i];
    const base = pastoFrame(p.x, 0, p.z, 0);
    pastoBox(parts, base, PALETTE.stone, 0, 0.28, -1.25, 1.35, 0.28, 0.14);
    pastoBox(parts, base, PALETTE.stone, 0, 0.28, 1.25, 1.35, 0.28, 0.14);
    pastoBox(parts, base, PALETTE.stone, -1.25, 0.28, 0, 0.14, 0.28, 1.12);
    pastoBox(parts, base, PALETTE.stone, 1.25, 0.28, 0, 0.14, 0.28, 1.12);
    pastoBox(parts, base, PALETTE.paramoSoil, 0, 0.44, 0, 1.2, 0.1, 1.15);
    pastoBox(parts, base, PALETTE.balconyWood, 0, 1.15, 0, 0.16, 0.75, 0.16);
    pastoPart(parts, base, PALETTE.hedge, clump, 0, 2.05, 0, 0, 0.5, 0, 1.15, 0.95, 1.15);
    pastoPart(parts, base, PALETTE.coffeeLeaf, clump, 0.2, 2.75, -0.12, 0, 1.9, 0, 0.78, 0.7, 0.78);
  }

  root.add(pastoTownMesh(parts, 'pastoPlazaFurniture', true, true));

  // …and the sky over the square, in its own non-casting mesh. See PAPEL PICADO.
  const bunt = [];
  pastoBuildBunting(game, bunt);
  root.add(pastoTownMesh(bunt, 'pastoBunting', false, false));
  oct8.dispose(); octOpen.dispose(); clump.dispose();

  // -- collision. One compound body for the fountain (two crossed boxes make a
  //    passable octagon), one for the six benches, one for the four planters.
  const fbody = pastoBody(game, 0);
  pastoBodyBox(fbody, pastoFTN_X, 0.55, pastoFTN_Z, pastoFTN_R, 0.55, pastoFTN_R, 0);
  pastoBodyBox(fbody, pastoFTN_X, 0.55, pastoFTN_Z, pastoFTN_R, 0.55, pastoFTN_R, Math.PI / 4);
  pastoBodyDone(game, fbody, 0, 0, 0);

  const bbody = pastoBody(game, 0);
  for (let i = 0; i < pastoBenchN; i++) {
    const a = (i / pastoBenchN) * Math.PI * 2 + pastoBenchPhase;
    pastoBodyBox(bbody, pastoFTN_X + Math.cos(a) * pastoBenchR, 0.45,
      pastoFTN_Z + Math.sin(a) * pastoBenchR, 1.05, 0.45, 0.32, -a + Math.PI * 0.5);
  }
  pastoBodyDone(game, bbody, 0, 0, 0);

  const pbody = pastoBody(game, 0);
  for (let i = 0; i < pastoPlanters.length; i++) {
    pastoBodyBox(pbody, pastoPlanters[i].x, 0.32, pastoPlanters[i].z, 1.4, 0.32, 1.3, 0);
  }
  pastoBodyDone(game, pbody, 0, 0, 0);
}

// ---------------------------------------------------------------------------
// 8c. THE CHURCH. Colonial, chunky, deliberately a little wonky: adobe walls,
// adobeShade pilasters, a stepped pediment, a roofTile pitch, and a bell tower
// whose ground floor is an open arcade so the capybara can get at the rope.
// The nave is solid — no interior is modelled, you never see inside.
// ---------------------------------------------------------------------------
function pastoBuildChurch(game, root) {
  const parts = [];
  const zc = (pastoCH_ZF + pastoCH_ZB) * 0.5;        // 44
  const hz = (pastoCH_ZB - pastoCH_ZF) * 0.5;        // 7
  const wallTop = 8.9;

  // -- podium + steps down into the plaza
  pastoBox(parts, null, PALETTE.adobeShade, 0, 0.35, zc, pastoCH_HW + 0.55, 0.35, hz + 0.6);
  pastoBox(parts, null, PALETTE.stone, 0, 0.12, 35.4, 6.2, 0.12, 0.5);
  pastoBox(parts, null, PALETTE.stone, 0, 0.24, 36.0, 6.0, 0.24, 0.5);
  pastoBox(parts, null, PALETTE.stoneDark, 0, 0.36, 36.55, 5.8, 0.36, 0.5);

  // -- nave
  pastoBox(parts, null, PALETTE.adobeWall, 0, (pastoCH_FLOOR + wallTop) * 0.5, zc,
    pastoCH_HW, (wallTop - pastoCH_FLOOR) * 0.5, hz);
  pastoBox(parts, null, PALETTE.churchTrim, 0, wallTop + 0.18, zc, pastoCH_HW + 0.35, 0.2, hz + 0.35);

  // -- pilasters: facade and flanks
  const pilX = [-6.4, -2.7, 2.7, 6.4];
  for (let i = 0; i < 4; i++) {
    pastoBox(parts, null, PALETTE.adobeShade, pilX[i], 4.8, pastoCH_ZF - 0.2, 0.42, 4.1, 0.24);
  }
  // No flank pilasters. Six more correct mouldings down each side made the
  // church read as a survey drawing; the bare adobe wall with three deep-set
  // windows punched in it is funnier and reads better at 35 degrees.
  for (let i = 0; i < 3; i++) {
    const pz = 40 + i * 4;
    pastoBox(parts, null, PALETTE.churchTrim, -pastoCH_HW - 0.1, 5.6, pz + 2, 0.14, 1.15, 0.55);
    pastoBox(parts, null, PALETTE.churchTrim, pastoCH_HW + 0.1, 5.6, pz + 2, 0.14, 1.15, 0.55);
  }

  // -- stepped pediment over the facade and the apse (colonial, not classical)
  // Stands proud of the roof, the way a colonial espadaña does, rather than
  // being sliced in half by the eaves.
  const ped = [[7.0, 9.5], [4.6, 10.3], [2.2, 11.05]];
  for (let i = 0; i < 3; i++) {
    pastoBox(parts, null, PALETTE.adobeWall, 0, ped[i][1], pastoCH_ZF - 0.5, ped[i][0], 0.42, 0.55);
    pastoBox(parts, null, PALETTE.adobeWall, 0, ped[i][1], pastoCH_ZB + 0.5, ped[i][0], 0.42, 0.55);
  }
  pastoBox(parts, null, PALETTE.churchTrim, 0, 11.6, pastoCH_ZF - 0.5, 0.28, 0.6, 0.22);

  // -- pitched roof: eaves at x = +/-8.7 y = 8.8, ridge at x = 0 y = 11.3
  const slopeA = Math.atan2(2.5, 8.7);
  const slopeL = Math.sqrt(8.7 * 8.7 + 2.5 * 2.5) * 0.5 + 0.3;
  pastoBox(parts, null, PALETTE.roofTile, -4.35, 10.05, zc, slopeL, 0.26, hz + 0.55, 0, 0, slopeA);
  pastoBox(parts, null, PALETTE.roofTile, 4.35, 10.05, zc, slopeL, 0.26, hz + 0.55, 0, 0, -slopeA);
  pastoBox(parts, null, PALETTE.roofTileDark, 0, 11.42, zc, 0.55, 0.22, hz + 0.6);

  // -- the great arched doors
  pastoBox(parts, null, PALETTE.churchTrim, 0, 3.1, pastoCH_ZF - 0.16, 2.7, 2.4, 0.2);
  pastoBox(parts, null, PALETTE.balconyWood, -1.12, 2.55, pastoCH_ZF - 0.3, 1.06, 1.85, 0.16);
  pastoBox(parts, null, PALETTE.balconyWood, 1.12, 2.55, pastoCH_ZF - 0.3, 1.06, 1.85, 0.16);
  pastoBox(parts, null, PALETTE.balconyWood, 0, 4.6, pastoCH_ZF - 0.3, 2.0, 0.24, 0.16);
  pastoBox(parts, null, PALETTE.balconyWood, 0, 4.98, pastoCH_ZF - 0.3, 1.5, 0.24, 0.16);
  pastoBox(parts, null, PALETTE.balconyWood, 0, 5.3, pastoCH_ZF - 0.3, 0.9, 0.2, 0.16);
  // rose window — one blunt octagon of glass punched into the adobe. The
  // tracery ring that used to surround it was the last piece of the church that
  // looked drawn rather than built.
  const oct8b = new THREE.CylinderGeometry(1, 1, 1, 8, 1, false);
  pastoPart(parts, null, PALETTE.glass, oct8b, 0, 7.0, pastoCH_ZF - 0.16,
    Math.PI / 2, 0, 0, 1.15, 0.2, 1.15);

  // -- bell tower (leaning) -----------------------------------------------
  const tb = pastoXf(pastoTW_X, 0, pastoTW_Z, 0, 0, pastoTW_LEAN);
  const pierX = [-1.95, 1.95], pierZ = [-1.95, 1.95];
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
    pastoBox(parts, tb, PALETTE.adobeShade, pierX[a], 2.2, pierZ[b], 0.58, 2.2, 0.58);
  }
  pastoBox(parts, tb, PALETTE.adobeShade, 0, 4.7, 0, pastoTW_HW + 0.2, 0.32, pastoTW_HW + 0.2);
  pastoBox(parts, tb, PALETTE.adobeWall, 0, 8.5, 0, pastoTW_HW, 3.5, pastoTW_HW);
  pastoBox(parts, tb, PALETTE.churchTrim, 0, 9.4, -pastoTW_HW - 0.05, 0.6, 0.85, 0.12);
  pastoBox(parts, tb, PALETTE.churchTrim, 0, 9.4, pastoTW_HW + 0.05, 0.6, 0.85, 0.12);
  pastoBox(parts, tb, PALETTE.adobeShade, 0, 12.05, 0, pastoTW_HW + 0.15, 0.15, pastoTW_HW + 0.15);
  // belfry: four corner piers, wide open arches between them
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
    pastoBox(parts, tb, PALETTE.adobeWall, pierX[a] * 1.05, 13.9, pierZ[b] * 1.05, 0.52, 1.75, 0.52);
  }
  pastoBox(parts, tb, PALETTE.adobeWall, 0, 15.75, 0, pastoTW_HW, 0.2, pastoTW_HW);
  pastoBox(parts, tb, PALETTE.churchTrim, 0, 16.1, 0, pastoTW_HW + 0.34, 0.24, pastoTW_HW + 0.34);
  pastoPart(parts, tb, PALETTE.roofTileDark, new THREE.ConeGeometry(1, 1, 4), 0, 17.7, 0,
    0, Math.PI / 4, 0, 4.0, 3.0, 4.0);
  pastoBox(parts, tb, PALETTE.churchTrim, 0, 19.7, 0, 0.1, 0.9, 0.1);
  pastoBox(parts, tb, PALETTE.churchTrim, 0, 19.85, 0, 0.5, 0.1, 0.1);
  // the beam the bell hangs from
  pastoBox(parts, tb, PALETTE.balconyWood, 0, pastoBELL_PIV + 0.22, 0, 2.1, 0.16, 0.18);

  // -- the rope, dangling from the belfry floor down to capybara height
  const rope = new THREE.CylinderGeometry(0.055, 0.055, 1, 4, 1, true);
  const ropeTop = 11.9, ropeLen = ropeTop - pastoROPE_Y;
  pastoPart(parts, null, PALETTE.potatoSack, rope, pastoROPE_X, (ropeTop + pastoROPE_Y) * 0.5,
    pastoROPE_Z, 0, 0, 0, 1, ropeLen, 1);
  pastoPart(parts, null, PALETTE.balconyWood, new THREE.OctahedronGeometry(0.26, 0),
    pastoROPE_X, pastoROPE_Y, pastoROPE_Z, 0, 0.4, 0, 1, 1.5, 1);

  root.add(pastoTownMesh(parts, 'pastoChurch', true, true));
  oct8b.dispose(); rope.dispose();

  // -- collision: one compound static body. The belfry is left hollow on
  //    purpose so a condor can drop the capybara straight into it.
  const b = pastoBody(game, 0);
  pastoBodyBox(b, 0, 0.35, zc, pastoCH_HW + 0.55, 0.35, hz + 0.6);
  pastoBodyBox(b, 0, (pastoCH_FLOOR + wallTop) * 0.5, zc, pastoCH_HW, (wallTop - pastoCH_FLOOR) * 0.5, hz);
  pastoBodyBox(b, 0, 0.12, 35.4, 6.2, 0.12, 0.5);
  pastoBodyBox(b, 0, 0.24, 36.0, 6.0, 0.24, 0.5);
  pastoBodyBox(b, 0, 0.36, 36.55, 5.8, 0.36, 0.5);
  // The colliders follow the lean by offsetting x with height. They stay
  // axis-aligned — 0.03 rad across a 5.2 m box is 8 cm of corner error, which is
  // far below anything the capybara can feel.
  for (let a = 0; a < 2; a++) for (let bb = 0; bb < 2; bb++) {
    pastoBodyBox(b, pastoTwX(pierX[a], 2.2), 2.2, pastoTW_Z + pierZ[bb], 0.58, 2.2, 0.58);
    pastoBodyBox(b, pastoTwX(pierX[a] * 1.05, 13.9), 13.9, pastoTW_Z + pierZ[bb] * 1.05, 0.52, 1.75, 0.52);
  }
  pastoBodyBox(b, pastoTwX(0, 8.4), 8.4, pastoTW_Z, pastoTW_HW, 3.8, pastoTW_HW);   // shaft 4.6..12.2
  pastoBodyBox(b, pastoTwX(0, 17.0), 17.0, pastoTW_Z, pastoTW_HW + 0.34, 1.3, pastoTW_HW + 0.34);
  pastoBodyDone(game, b, 0, 0, 0);
  pastoChurchBody = b;
}

// ---------------------------------------------------------------------------
// 8d. THE BELL. A real pendulum: a dynamic body on a HingeConstraint whose axis
// runs along world X, hanging 0.85 m under its pivot so gravity supplies the
// restoring torque. Nothing about it is animated — you knock it, it swings, and
// when it swings hard enough it rings.
//
// The constraint is added in onEnter and removed in onExit, because the biome
// streamer removes bodies from the world but knows nothing about constraints.
// ---------------------------------------------------------------------------
let pastoChurchBody = null;
let pastoBellBody = null;
let pastoBellMesh = null;
let pastoBellHinge = null;
let pastoBellLastRing = -99;
let pastoBellLastPull = -99;
let pastoBellSwinging = false;
const pastoBELL_RING_HI = 0.95;   // hysteresis: ring on the way up...
const pastoBELL_RING_LO = 0.40;   // ...and re-arm only once it has calmed down
// How long the attempt stays open after a ring. A big bell is slow, so this is
// generous — but it is finite, and it is what closes the number when the rope
// is let go. See THE SWING in pastoUpdateBell.
const pastoBELL_RUN_GAP = 6.0;
let pastoBellSwing = 0, pastoBellRunT = 0;
const pastoBellPos = new THREE.Vector3(pastoBELL_PIVX, pastoBELL_Y, pastoTW_Z);

function pastoBuildBell(game, root) {
  const parts = [];
  const bellG = new THREE.CylinderGeometry(0.44, 0.92, 1.45, 8, 1, false);
  pastoPart(parts, null, PALETTE.ruana3, bellG, 0, -0.05, 0);
  pastoBox(parts, null, PALETTE.metal, 0, 0.78, 0, 0.16, 0.28, 0.16);
  pastoBox(parts, null, PALETTE.metal, 0, 0.96, 0, 0.62, 0.12, 0.14);
  pastoPart(parts, null, PALETTE.metal, new THREE.OctahedronGeometry(0.2, 0), 0, -0.9, 0);
  const mesh = pastoTownMesh(parts, 'pastoBell', true, false);
  bellG.dispose();
  mesh.position.set(pastoBELL_PIVX, pastoBELL_Y, pastoTW_Z);
  root.add(mesh);
  pastoBellMesh = mesh;

  const b = pastoBody(game, 46);
  b.addShape(new CANNON.Box(new CANNON.Vec3(0.8, 0.78, 0.8)));
  b.angularDamping = 0.14;
  b.linearDamping = 0.05;
  b.sleepSpeedLimit = 0.25;
  pastoBodyDone(game, b, pastoBELL_PIVX, pastoBELL_Y, pastoTW_Z);
  pastoBellBody = b;

  pastoBellHinge = new CANNON.HingeConstraint(pastoChurchBody, b, {
    pivotA: new CANNON.Vec3(pastoBELL_PIVX, pastoBELL_PIVY, pastoTW_Z),
    axisA: new CANNON.Vec3(1, 0, 0),
    pivotB: new CANNON.Vec3(0, pastoBELL_HANG, 0),
    axisB: new CANNON.Vec3(1, 0, 0),
    maxForce: 1e7,
  });
}

/**
 * Give the bell a shove. Always adds energy in the direction it is already
 * moving, so repeated taps pump the swing up instead of cancelling it.
 *
 * The impulse is deliberately large: the hinge conserves angular momentum about
 * the PIVOT, not about the bell's centre, so only I_com / I_pivot (~0.44 here)
 * of whatever we write into angularVelocity survives the first solve.
 */
function pastoBellStrike(w) {
  const b = pastoBellBody;
  if (!b) return;
  b.wakeUp();
  const s = b.angularVelocity.x >= 0 ? 1 : -1;
  b.angularVelocity.x += s * w;
}

/** Hang it dead still. A teleport, so the interpolation pair is reseeded too,
 *  otherwise the renderer smears the bell across the belfry on re-entry. */
function pastoBellRest() {
  const b = pastoBellBody;
  if (!b) return;
  b.position.set(pastoBELL_PIVX, pastoBELL_Y, pastoTW_Z);
  b.quaternion.set(0, 0, 0, 1);
  b.velocity.set(0, 0, 0);
  b.angularVelocity.set(0, 0, 0);
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
  b.previousQuaternion.copy(b.quaternion);
  b.interpolatedQuaternion.copy(b.quaternion);
  b.sleepState = CANNON.Body.AWAKE;
  pastoBellSwinging = false;
  if (pastoGame && pastoGame.state) pastoBellLastRing = pastoGame.state.time;
}

/** The sound of it. Throttled — a swinging bell crosses the threshold twice a
 *  second and we are not making a smoke alarm. */
function pastoBellSound() {
  const g = pastoGame;
  if (!g) return;
  const t = g.state ? g.state.time : 0;
  if (t - pastoBellLastRing < 1.1) return;
  pastoBellLastRing = t;
  if (g.events) g.events.emit('pasto:bell', { position: pastoBellPos, strength: 1 });
  // THE LOUDEST OBJECT IN THE CHAPTER WAS ITS QUIETEST CALL SITE: a bronze
  // bell in a tower rang 'pop', mono, from nowhere — while pastoBellPos sits
  // on the line above, already being handed to the event. `chime` is what a
  // bell is, pitched down because this one is big, and it carries: near 9,
  // far 150, so it is audible across the plaza and up the flank of Galeras,
  // which is the whole point of ringing it.
  if (g.sfx) g.sfx('chime', { at: pastoBellPos, volume: 0.95, pitch: 0.55, near: 9, far: 150 });
  if (g.completeTask) g.completeTask('church-bell');

  // See THE SWING, below: a ring holds the attempt open, and the number is the
  // angle rather than the count.
  pastoBellRunT = pastoBELL_RUN_GAP;
}

// =============================================================== THE SWIFTS ==
// NOT A TASK. Pasto has a plaza, a market, a church, a volcano and a Carnaval
// float, and every single one of them is a thing the player is supposed to DO
// something to. The one moving object in the sky was a condor, and the condor
// is the chapter's marquee — it comes down when you whistle for it and it is
// entirely about you.
//
// So: vencejos. Twenty-eight of them, round the bell tower, at the hour of the
// evening when they do it. They scream, they do not care that you are there,
// and if the bell goes they all leave at once and come back in about fifteen
// seconds — which is the only interaction there is and it is not a task either.
const pastoSWIFT_N = 28;
const pastoSWIFT_R0 = 7, pastoSWIFT_R1 = 19;
const pastoSWIFT_LO = 3, pastoSWIFT_HI = 13;      // above the tower's own top
const pastoSWIFT_CRY = 3.4;                        // s between screams
let pastoSwiftMesh = null, pastoSwiftSeed = null;
let pastoSwiftT = 0, pastoSwiftCry = 2, pastoSwiftScatter = 0;

function pastoBuildSwifts(root) {
  // A SWIFT IS A CROSSBOW BOLT. Two swept wings and almost no body, and it is
  // never not flying — the species genuinely cannot perch, which is why they
  // are up there and not on the tower.
  const parts = [];
  const base = new THREE.Matrix4();
  pastoBox(parts, base, PALETTE.volcanoDark, 0, 0, 0, 0.055, 0.05, 0.20);
  for (let s = -1; s <= 1; s += 2) {
    pastoBox(parts, base, PALETTE.volcanoDark, s * 0.20, 0.01, -0.05, 0.20, 0.018, 0.055,
             0, 0, s * 0.55);
    pastoBox(parts, base, PALETTE.volcanoRock, s * 0.40, 0.02, -0.14, 0.13, 0.014, 0.04,
             0.06, 0, s * 0.85);
  }
  pastoBox(parts, base, PALETTE.volcanoDark, 0, 0.005, -0.22, 0.03, 0.012, 0.07);
  const geo = pastoMerge(parts);
  const im = new THREE.InstancedMesh(geo, mat(PALETTE.volcanoSnow, { vertexColors: true }),
                                     pastoSWIFT_N);
  im.name = 'pastoSwifts';
  im.frustumCulled = false;
  im.castShadow = false;      // twenty-eight shadows at 25 m over a plaza is soot
  root.add(im);
  pastoSwiftMesh = im;

  pastoSwiftSeed = [];
  for (let i = 0; i < pastoSWIFT_N; i++) {
    pastoSwiftSeed.push({
      a: (i / pastoSWIFT_N) * Math.PI * 2,
      r: pastoSWIFT_R0 + ((i * 7919) % 100) / 100 * (pastoSWIFT_R1 - pastoSWIFT_R0),
      y: pastoSWIFT_LO + ((i * 65537) % 100) / 100 * (pastoSWIFT_HI - pastoSWIFT_LO),
      w: 0.42 + ((i * 31337) % 100) / 100 * 0.34,      // rad/s, and they are FAST
      b: ((i * 104729) % 628) / 100,
      d: i % 3 ? 1 : -1,                                // a third of them go the other way
    });
  }
  pastoSwiftT = 0; pastoSwiftCry = 2; pastoSwiftScatter = 0;
}

function pastoUpdateSwifts(game, dt) {
  if (!pastoSwiftMesh) return;
  pastoSwiftT += dt;

  // THE BELL SCATTERS THEM. pastoUpdateBell already owns the ring; all this
  // needs is to notice, and then take fifteen seconds to forgive it.
  // ---- ...AND UNTIL A3 THE SCATTER WAS SILENT ---------------------------
  // Twenty-eight birds leaving a tower at once, drawn since the day they were
  // added and never once audible. The rising edge is the same one the gyre
  // reads, so there is no second piece of state to keep in step: the frame the
  // swell begins is the frame the wings go. Off the tower top, not the bell —
  // they are on the parapet, and the bell is inside it.
  if (pastoBellSwinging && pastoSwiftScatter < 0.5 && typeof game.wingburst === 'function') {
    game.wingburst(pastoTW_X, pastoBELL_PIVY + 4.0, pastoTW_Z,
                   { key: 'pas:swifts', near: 22, far: 240, n: 14,
                     spread: 1.35, pitch: 1.42, volume: 0.85 });
  }
  if (pastoBellSwinging && pastoSwiftScatter < 0.5) pastoSwiftScatter = 1;
  if (pastoSwiftScatter > 0) pastoSwiftScatter = Math.max(0, pastoSwiftScatter - dt / 15);

  const cx = pastoTW_X, cz = pastoTW_Z;
  const towerTop = pastoBELL_PIVY + 4.0;
  // scattered, the whole gyre swells and climbs and the birds spread out
  const swell = 1 + pastoSwiftScatter * 1.6;
  for (let i = 0; i < pastoSWIFT_N; i++) {
    const sd = pastoSwiftSeed[i];
    const a = sd.a + pastoSwiftT * sd.w * sd.d;
    // not a circle: two sines beating against each other, so the flock braids
    // rather than orbiting like a mobile
    const rr = sd.r * swell * (1 + Math.sin(pastoSwiftT * 0.7 + sd.b) * 0.22);
    const x = cx + Math.cos(a) * rr;
    const z = cz + Math.sin(a) * rr * 0.86;
    const y = towerTop + sd.y * swell + Math.sin(pastoSwiftT * 1.3 + sd.b * 2) * 2.4;
    const a2 = a + 0.08 * sd.d;
    const nx = cx + Math.cos(a2) * rr, nz = cz + Math.sin(a2) * rr * 0.86;
    const yaw = Math.atan2(nx - x, nz - z);
    // banked hard into the turn, which is most of what a swift looks like
    const roll = sd.d * (0.7 + Math.sin(pastoSwiftT * 2.1 + sd.b) * 0.25);
    pastoSwiftMesh.setMatrixAt(i, pastoXf(x, y, z, 0, yaw, roll, 1, 1, 1));
  }
  pastoSwiftMesh.instanceMatrix.needsUpdate = true;

  // ---- the scream --------------------------------------------------------
  // Ten of them at once, and it is the loudest thing in this plaza after the
  // bell. Rationed and scaled by distance: a flock you cannot see is somebody
  // else's flock.
  pastoSwiftCry -= dt;
  if (pastoSwiftCry <= 0) {
    pastoSwiftCry = pastoSWIFT_CRY * (0.7 + Math.abs(Math.sin(pastoSwiftT * 0.31)) * 0.9);
    const cp = game.capy && game.capy.position;
    const far = cp ? Math.hypot(cp.x - cx, cp.z - cz) : 999;
    if (far < 64 && game.sfx) {
      const v = clamp(0.22 - far * 0.0026, 0.03, 0.22) * (1 + pastoSwiftScatter);
      try {
        game.sfx('gull', { volume: v, pitch: 2.15 });
        game.sfx('gull', { volume: v * 0.7, pitch: 2.45 });
      } catch (e) { /* the dispatcher wraps its own voices; this is belt and braces */ }
    }
  }
}

/** Public hook: knock the bell and let the physics decide when it rings. */
function pastoBellRing() {
  if (!pastoBellBody) return false;
  pastoBellStrike(8.0);
  return true;
}

const pastoBell = {
  position: pastoBellPos,
  ropePosition: new THREE.Vector3(pastoROPE_X, pastoROPE_Y, pastoROPE_Z),
  ring: pastoBellRing,
  get body() { return pastoBellBody; },
};

function pastoUpdateBell(dt) {
  const b = pastoBellBody;
  if (!b) return;
  const m = pastoBellMesh;
  if (m) {
    m.position.copy(b.interpolatedPosition);
    m.quaternion.copy(b.interpolatedQuaternion);
  }
  pastoBellPos.copy(b.interpolatedPosition);

  // A hard enough swing is a ring. This is the only trigger — knocking it with
  // the capybara, a thrown prop or a passing condor all go through the same law.
  const av = Math.abs(b.angularVelocity.x);
  if (!pastoBellSwinging && av > pastoBELL_RING_HI) { pastoBellSwinging = true; pastoBellSound(); }
  else if (pastoBellSwinging && av < pastoBELL_RING_LO) pastoBellSwinging = false;

  // ---- THE SWING (R8) ----------------------------------------------------
  // The task is 'Ring the church bell (badly)' and it ticked on the first
  // stroke, which is the least bad way to ring a bell. Pasto's two numbers were
  // both on the condor, so the whole town half of the chapter had nothing to
  // come back for.
  //
  // THE FIRST CUT COUNTED RINGS AND IT WAS EXACTLY BACKWARDS. `av` is a
  // magnitude and a pendulum's is zero at both ends of every swing, so the
  // hysteresis re-arms twice a period and a freely decaying bell rings on its
  // own: measured, ONE strike and thirty seconds of walking away scored 17,
  // while a player working the rope scored 6 — because re-striking holds `av`
  // above the re-arm floor and suppresses the crossings. A record you get by
  // leaving the room is not a record.
  //
  // So it is the ANGLE, which is the thing 'badly' actually means. Strikes add
  // to the swing IN ITS DIRECTION OF TRAVEL (see pastoBellStrike), so this
  // rewards timing rather than mashing, it cannot climb while nobody is there
  // because a pendulum only ever loses amplitude on its own, and it is legible:
  // a bell rung properly swings in a controlled arc, and this one will not be.
  const q = b.quaternion;
  let ang = Math.abs(2 * Math.atan2(q.x, q.w));
  if (ang > Math.PI) ang = Math.PI * 2 - ang;
  const deg = ang * 57.2957795;
  if (pastoBellRunT > 0) {
    if (deg > pastoBellSwing) pastoBellSwing = deg;
    pastoBellRunT -= dt;
    const g0 = pastoGame;
    if (g0 && g0.recordLive && pastoBellSwing > 8) g0.recordLive('church-bell', pastoBellSwing);
    // Filed ONCE, when the bell is left to die — `record` toasts on every
    // improvement, and an amplitude improving on itself on every swing is a
    // personal-best card a second for one rope.
    if (pastoBellRunT <= 0) {
      if (g0 && pastoBellSwing > 8 && typeof g0.record === 'function') {
        g0.record('church-bell', pastoBellSwing);
      }
      if (g0 && typeof g0.recordEnd === 'function') g0.recordEnd('church-bell');
      pastoBellSwing = 0;
    }
  }

  // Yanking the rope. Cheap squared-distance test, no allocation.
  const g = pastoGame;
  const capy = g && g.capy;
  if (!capy || !capy.position) return;
  const t = g.state ? g.state.time : 0;
  if (t - pastoBellLastPull < 0.5) return;
  const dx = capy.position.x - pastoROPE_X, dz = capy.position.z - pastoROPE_Z;
  if (dx * dx + dz * dz > 2.0 || capy.position.y > 3.2) return;
  const v = capy.velocity;
  const sp = v ? Math.sqrt(v.x * v.x + v.z * v.z) : 0;
  if (sp < 1.4) return;
  pastoBellLastPull = t;
  pastoBellStrike(3.0 + Math.min(sp, 8) * 0.9);
  if (g.sfx) g.sfx('rustle');
}

// ---------------------------------------------------------------------------
// 8e. THE MARKET. Ten stalls ringing the plaza. Each is split in two: a static
// half (table, crates, produce) that is merged with every other stall into one
// draw call, and an awning frame that is its own mesh + its own body, because
// collapse() has to be able to drop it independently.
//
// Physics of the collapse proper is Agent C's; this side owns the geometry, the
// bodies, and the hook.
// ---------------------------------------------------------------------------
const pastoSTALL_SPEC = [
  { x: -18, z: 12, yaw: 0 },
  { x: -6,  z: 12, yaw: 0 },
  { x: 6,   z: 12, yaw: 0 },
  { x: 18,  z: 12, yaw: 0 },
  { x: -22, z: 20, yaw: Math.PI / 2 },
  { x: 22,  z: 20, yaw: -Math.PI / 2 },
  { x: -22, z: 28, yaw: Math.PI / 2 },
  { x: 22,  z: 28, yaw: -Math.PI / 2 },
  // MOVED OUT TO ±15.5. These two used to stand at ±12, which put the eastern
  // one squarely across the carroza's new lane — see pastoCAR_X. The plaza is
  // 48 m wide and the north pair sitting a little further out reads better
  // anyway: it opens the approach to the church instead of funnelling it.
  { x: -15.5, z: 30, yaw: Math.PI },
  { x: 15.5,  z: 30, yaw: Math.PI },
];
// AWNING CLOTH. Each stall gets ONE hue plus a chalk partner and stripes the
// two — the way a market awning is actually woven. It used to cycle all four of
// PALETTE.awning1-4 across every panel AND every valance scallop, so a single
// stall showed red, blue, yellow and green at once; ten of them ringing the
// plaza read as a circus tent regardless of how dusty the individual entries
// were. The hues here are Sydney's own deck-chair cloths (physBuildDeckchair
// uses cloth2 and cloth3), so the two biomes' fabric sits in one tonal family.
const pastoAWN_MAIN = [
  PALETTE.cloth2, PALETTE.cloth4, PALETTE.cloth8, PALETTE.cloth5, PALETTE.cloth3, PALETTE.awning4,
];
const pastoAWN_TRIM = [
  PALETTE.adobeWall, PALETTE.sail, PALETTE.sandstone, PALETTE.adobeWall, PALETTE.sail, PALETTE.sandstone,
];
const pastoPRODUCE = [
  [PALETTE.maiz, PALETTE.plantain], [PALETTE.tomato, PALETTE.lettuce],
  [PALETTE.empanada, PALETTE.arepa], [PALETTE.coffeeCherry, PALETTE.coffeeBush],
  [PALETTE.potatoSack, PALETTE.paramoSoil], [PALETTE.plantain, PALETTE.maiz],
];
const pastoAWN_C = 1.55;          // awning body centre height
const pastoAWN_MASS = 16;
const pastoSTALL_TABLE_Y = 1.02;
const pastoSTALL_AWN_Y = 2.72;
const pastoStalls = [];

function pastoStallStatic(parts, s, i, spud) {
  const base = pastoFrame(s.x, 0, s.z, s.yaw);
  pastoBox(parts, base, PALETTE.wood, 0, 0.95, 0, 1.55, 0.07, 0.8);
  pastoBox(parts, base, PALETTE.woodDark, 0, 0.72, 0.84, 1.55, 0.23, 0.05);
  const lx = [-1.4, 1.4], lz = [-0.66, 0.66];
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
    pastoBox(parts, base, PALETTE.woodDark, lx[a], 0.47, lz[b], 0.08, 0.47, 0.08);
  }
  pastoBox(parts, base, PALETTE.balconyWood, -1.05, 0.28, -1.15, 0.42, 0.28, 0.34);
  pastoBox(parts, base, PALETTE.balconyWood, 1.0, 0.3, -1.1, 0.4, 0.3, 0.32, 0.3);
  // produce heaped on the table
  const pc = pastoPRODUCE[i % pastoPRODUCE.length];
  for (let k = 0; k < 9; k++) {
    const px = -1.1 + (k % 5) * 0.55 + pastoRndR(-0.1, 0.1);
    const pz = (k < 5 ? -0.22 : 0.26) + pastoRndR(-0.1, 0.1);
    const sc = pastoRndR(0.75, 1.15);
    pastoPart(parts, base, k % 3 ? pc[0] : pc[1], spud,
      px, pastoSTALL_TABLE_Y + 0.16 * sc, pz, 0, pastoRnd() * 3, 0, sc, sc * 0.85, sc);
  }
}

function pastoStallAwning(root, game, s, i) {
  const parts = [];
  // Authored around the body centre so mesh origin == body origin.
  const px = [-1.5, 1.5], pz = [-0.9, 0.9];
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
    pastoBox(parts, null, PALETTE.woodDark, px[a], -0.2, pz[b], 0.085, 1.35, 0.085);
  }
  pastoBox(parts, null, PALETTE.woodDark, 0, 1.4, 0, 1.72, 0.08, 0.09);
  pastoBox(parts, null, PALETTE.woodDark, -1.5, 1.1, 0, 0.08, 0.07, 1.0);
  pastoBox(parts, null, PALETTE.woodDark, 1.5, 1.1, 0, 0.08, 0.07, 1.0);
  const tilt = Math.atan2(0.38, 1.02);
  const cMain = pastoAWN_MAIN[i % pastoAWN_MAIN.length];
  const cTrim = pastoAWN_TRIM[i % pastoAWN_TRIM.length];
  for (let side = 0; side < 2; side++) {
    const sgn = side ? 1 : -1;
    for (let k = 0; k < 4; k++) {
      pastoBox(parts, null, (k & 1) ? cTrim : cMain, -1.2 + k * 0.8, 1.21, sgn * 0.53,
        0.4, 0.05, 0.58, 0, sgn * tilt);
    }
    // scalloped valance — offset one stripe so it hangs under the opposite band
    for (let k = 0; k < 4; k++) {
      pastoBox(parts, null, (k & 1) ? cMain : cTrim, -1.2 + k * 0.8, 0.9, sgn * 1.06, 0.36, 0.16, 0.05);
    }
  }
  // a ruana or two slung over the frame, for colour
  if (i % 3 === 0) {
    pastoBox(parts, null, PALETTE.cloth1, -1.5, 0.5, 0.45, 0.06, 0.55, 0.36);
    pastoBox(parts, null, PALETTE.cloth7, 1.5, 0.42, -0.4, 0.06, 0.5, 0.34);
  }

  const mesh = pastoTownMesh(parts, 'pastoStallAwning' + i, true, false);
  mesh.position.set(s.x, pastoAWN_C, s.z);
  mesh.rotation.y = s.yaw;
  root.add(mesh);

  // Static until it is knocked down; collapse() promotes it to dynamic.
  const b = pastoBody(game, 0);
  for (let a = 0; a < 2; a++) for (let c = 0; c < 2; c++) {
    b.addShape(new CANNON.Box(new CANNON.Vec3(0.12, 1.35, 0.12)),
      new CANNON.Vec3(px[a], -0.2, pz[c]));
  }
  b.addShape(new CANNON.Box(new CANNON.Vec3(1.75, 0.16, 1.1)), new CANNON.Vec3(0, 1.22, 0));
  b.quaternion.setFromEuler(0, s.yaw, 0);
  b.angularDamping = 0.15;
  pastoBodyDone(game, b, s.x, pastoAWN_C, s.z);
  return { mesh: mesh, body: b };
}

function pastoMakeStall(game, root, spec, i, parts, spud) {
  pastoStallStatic(parts, spec, i, spud);
  const aw = pastoStallAwning(root, game, spec, i);
  const st = {
    x: spec.x, z: spec.z, yaw: spec.yaw,
    tableY: pastoSTALL_TABLE_Y,
    awningY: pastoSTALL_AWN_Y,
    collapsed: false,
    mesh: aw.mesh,
    awningBody: aw.body,
    collapse: function () { return pastoCollapseStall(st); },
  };
  return st;
}

function pastoCollapseStall(st) {
  if (st.collapsed) return false;
  st.collapsed = true;
  const b = st.awningBody;
  if (b) {
    b.type = CANNON.Body.DYNAMIC;
    b.mass = pastoAWN_MASS;
    b.updateMassProperties();
    b.wakeUp();
    // Fall outward, away from the plaza centre, with a good theatrical spin.
    const ox = Math.sin(st.yaw), oz = Math.cos(st.yaw);
    b.velocity.set(ox * 1.6, 0.9, oz * 1.6);
    b.angularVelocity.set(oz * 3.6, 1.2, -ox * 3.6);
  }
  const g = pastoGame;
  if (g) {
    if (g.events) g.events.emit('pasto:stall-collapse', { stall: st, position: st.mesh ? st.mesh.position : null });
    // ---- A MARKET STALL CAME DOWN AND IT WENT 'thud', MONO, FROM NOWHERE ---
    // Same finding as the bell's twenty lines up, on the noisier object. It is
    // three sounds and they arrive in the order the thing actually falls: the
    // frame hitting the cobbles, the crates and the produce going after it, and
    // then the man whose stall it was.
    const at = st.mesh ? st.mesh.position : null;
    if (g.sfx) {
      g.sfx('thud', { at: at, volume: 0.95, pitch: rand(0.6, 0.78), near: 6, far: 70 });
      // On the FRAME clock — see pastoSfxIn. These two used to be setTimeouts
      // and went on falling through a hitstop and a pause card.
      pastoSfxIn(0.110, 'clink',
                 { at: at, volume: 0.55, pitch: rand(0.8, 1.15), near: 5, far: 55 });
      pastoSfxIn(0.520, 'vendor',
                 { at: at, volume: 0.7, pitch: rand(0.86, 1.06), near: 5, far: 60 });
    }
    // M4: the market cascade — and it completes a task on the next line, so
    // it is a latched one-shot and can afford to stop the world.
    if (g.punch) g.punch(0.5, 0.08); else if (g.shake) g.shake(0.5);
    if (g.completeTask) g.completeTask('market-chaos');
  }
  return true;
}

// ===========================================================================
// 8e2. LA CARROZA — the mini.
//
// Pasto IS the Carnaval de Negros y Blancos and nothing in the chapter said so.
// The plaza is also, measured, one of the two densest walking routes in the
// game and yet it never MOVED: ten stalls, a church, a bell and forty metres of
// cobbles that look identical whether you have been standing on them for four
// seconds or four minutes.
//
// So: one carroza, four metres of papier-mache on a flat-bed, doing the length
// of the plaza and back at parade pace. The deck is 1.55 up and there is a tow
// hitch at 0.62 to get onto it, which is two comfortable hops and no new verb.
// The figure on the back turns as it goes, because a carroza that did not would
// be a shed.
//
// x = 0 is the ONE clear aisle through the market: the stall line at z = 12 has
// its gap between x = -6 and x = +6, and the pair at z = 30 between -12 and 12.
// ===========================================================================
const pastoCAR_Z0 = 10.5;     // the south end, and ON the cobbles: at 7 she stood
                              // with her back wheels on the grass, which reads as a
                              // prop that missed its mark rather than as a parked float
const pastoCAR_Z1 = 39.0;     // and short of the church steps at the north end
// ---- THE FLOAT WAS DRIVING THROUGH THE FOUNTAIN ------------------------
// The lane was the plaza's centreline, and the plaza's centreline is where
// the fountain is. Measured with pasto.navBlocked at the float's own half
// width: x = 0 is SOLID from z 14.5 to 25.5 — the octagonal basin and the six
// benches round it — and again from z 35 to the end of the probe, which is the
// church. So for the whole life of this mini the carroza has driven through a
// two-tier stone fountain, six benches and the front of the cathedral, and
// anybody standing on the deck was driven through them with it.
//
// x = 10.5 is clear for the entire route and past it (measured 7 to 43, with
// the north pair of market stalls moved out to ±15.5 — see pastoSTALL_SPEC).
// A procession lane down one side of a plaza is also simply what happens: the
// float goes round the square, not over the fountain in the middle of it.
const pastoCAR_X  = 10.5;
const pastoCAR_SPEED = 2.15;  // m/s — walking pace, because it is a procession
const pastoCAR_DWELL = 7.5;   // s at each end: this is the boarding window
const pastoCAR_RIDE  = 11.0;  // s aboard that count as 'across the plaza'
const pastoCAR_HX = 1.62;
const pastoCAR_HZ = 3.30;
const pastoCAR_DECK = 1.55;
const pastoCAR_HITCH = 0.62;
let pastoCarGroup = null;
let pastoCarBody = null;
let pastoCarFigure = null;    // the papier-mache, which turns
let pastoCarZ = pastoCAR_Z0;
let pastoCarDir = 1;
let pastoCarDwell = pastoCAR_DWELL;
let pastoCarPZ = pastoCAR_Z0;
let pastoCarRideM = 0;        // metres of plaza covered on this one ride
let pastoCarRideT = 0;
let pastoCarRode = false;
let pastoCarCheerT = 0;
let pastoCarBandT = 2.0;      // the band on the deck — see pastoUpdateCarroza
let pastoCarWaiting = false;  // held for a capybara standing in the lane
const pastoCarPos = new THREE.Vector3();
const pastoCarTmp = new THREE.Vector3();

function pastoBuildCarroza(game, root) {
  const wheelG = new THREE.CylinderGeometry(1, 1, 1, 8, 1, false);
  const sunG = new THREE.SphereGeometry(0.5, 8, 6);
  const HX = pastoCAR_HX, HZ = pastoCAR_HZ;

  // ---- the flat-bed -------------------------------------------------------
  const parts = [];
  const base = pastoFrame(0, 0, 0, 0);
  pastoBox(parts, base, PALETTE.churchTrim, 0, 0.86, 0, HX - 0.10, 0.30, HZ - 0.16);
  pastoBox(parts, base, PALETTE.awning1, 0, pastoCAR_DECK - 0.07, 0, HX, 0.07, HZ);
  // a skirt of paper flowers round the edge, in two bands
  pastoBox(parts, base, PALETTE.awning3, 0, 1.24, 0, HX + 0.07, 0.15, HZ + 0.07);
  pastoBox(parts, base, PALETTE.awning4, 0, 1.02, 0, HX + 0.04, 0.13, HZ + 0.04);
  // the hitch at the south end — the step up, and the only one
  pastoBox(parts, base, PALETTE.churchTrim, 0, pastoCAR_HITCH, -HZ - 0.42, 0.62, 0.09, 0.46);
  pastoBox(parts, base, PALETTE.churchTrim, 0, 0.34, -HZ - 0.10, 0.16, 0.30, 0.42);
  for (let sx = -1; sx <= 1; sx += 2) {
    for (let sz = -1; sz <= 1; sz += 2) {
      pastoPart(parts, base, PALETTE.balconyWood, wheelG,
        sx * (HX - 0.06), 0.45, sz * (HZ - 1.05), 0, 0, Math.PI / 2, 0.45, 0.22, 0.45);
    }
  }
  const bed = pastoTownMesh(parts, 'pastoCarrozaBed', true, true);

  // ---- the figure: a carnival sun with a condor's wings, and it TURNS ------
  // THE RAYS GO ROUND THE SUN IN A VERTICAL DISC, NOT A HORIZONTAL ONE.
  // The first cut laid them flat about the y axis, which from every camera in
  // this game — all of which look DOWN — is a flower on a table. A carnival sun
  // faces the way the float is going, so the disc stands up.
  const fp = [];
  const fb = pastoFrame(0, 0, 0, 0);
  pastoPart(fp, fb, PALETTE.awning2, wheelG, 0, 0.85, 0, 0, 0, 0, 0.34, 1.70, 0.34);
  pastoPart(fp, fb, PALETTE.awning1, sunG, 0, 2.55, 0, 0, 0, 0, 2.10, 2.10, 0.90);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    pastoBox(fp, fb, i % 2 ? PALETTE.awning3 : PALETTE.awning4,
      Math.cos(a) * 1.42, 2.55 + Math.sin(a) * 1.42, 0, 0.50, 0.10, 0.14, 0, 0, a);
  }
  // the face, because a sun with no face is a ball
  pastoBox(fp, fb, PALETTE.churchTrim, -0.34, 2.75, 0.44, 0.13, 0.15, 0.06);
  pastoBox(fp, fb, PALETTE.churchTrim, 0.34, 2.75, 0.44, 0.13, 0.15, 0.06);
  pastoBox(fp, fb, PALETTE.churchTrim, 0, 2.22, 0.44, 0.36, 0.09, 0.06);
  // and a condor's wings, swept UP and back off the shoulders
  for (let s2 = -1; s2 <= 1; s2 += 2) {
    pastoBox(fp, fb, PALETTE.condorBody,
      s2 * 1.95, 2.85, -0.30, 1.45, 0.09, 0.46, 0, 0, s2 * 0.42);
  }
  const fig = pastoTownMesh(fp, 'pastoCarrozaFigure', true, false);
  wheelG.dispose();
  sunG.dispose();

  pastoCarFigure = new THREE.Group();
  pastoCarFigure.position.set(0, pastoCAR_DECK, -0.55);
  pastoCarFigure.add(fig);
  pastoCarGroup = new THREE.Group();
  pastoCarGroup.name = 'pastoCarroza';
  pastoCarGroup.add(bed);
  pastoCarGroup.add(pastoCarFigure);
  root.add(pastoCarGroup);

  // Collision: the deck you ride, and the hitch you climb. Two shapes and no
  // more — a wheel you can stand on is a wheel you get stuck on.
  const b = new CANNON.Body({
    mass: 0, type: CANNON.Body.KINEMATIC,
    material: game.mats ? game.mats.ground : undefined,
  });
  b.addShape(new CANNON.Box(new CANNON.Vec3(HX, pastoCAR_DECK * 0.5, HZ)),
             new CANNON.Vec3(0, pastoCAR_DECK * 0.5, 0));
  b.addShape(new CANNON.Box(new CANNON.Vec3(0.62, 0.09, 0.46)),
             new CANNON.Vec3(0, pastoCAR_HITCH, -HZ - 0.42));
  b.allowSleep = false;
  pastoCarZ = pastoCAR_Z0; pastoCarDir = 1; pastoCarDwell = pastoCAR_DWELL; pastoCarWaiting = false;
  pastoCarPZ = pastoCAR_Z0; pastoCarRideT = 0; pastoCarRideM = 0; pastoCarRode = false;
  b.position.set(pastoCAR_X, 0, pastoCAR_Z0);
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
  game.world.addBody(b);
  pastoCarBody = b;
  pastoCarPos.set(pastoCAR_X, 0, pastoCAR_Z0);
  pastoCarGroup.position.copy(pastoCarPos);
}

/** True when `p` is standing on the carroza's DECK. */
function pastoCarAboard(p) {
  const b = pastoCarBody;
  if (!b || !p) return false;
  pastoCarTmp.set(p.x - b.position.x, p.y - b.position.y, p.z - b.position.z);
  return Math.abs(pastoCarTmp.x) < pastoCAR_HX + 0.30 &&
         Math.abs(pastoCarTmp.z) < pastoCAR_HZ + 0.25 &&
         pastoCarTmp.y > pastoCAR_DECK - 0.45 && pastoCarTmp.y < pastoCAR_DECK + 2.2;
}

/**
 * True when the animal is standing ON THE COBBLES in front of the float.
 *
 * A PROCESSION STOPS FOR A CAPYBARA, and this is the line that makes it.
 * The deck is a 3.24 × 6.60 m kinematic slab that stands ON the ground — the
 * lower box runs from y 0 to y 1.55 — so an animal in the lane is not brushed
 * aside by it, it is BULLDOZED, and cannon will resolve a kinematic body
 * against a dynamic one no other way. Measured parked at spawn+(9,9), which is
 * x 9.0 and therefore 0.12 m inside the near edge at x 8.88: the float carried
 * the animal 8.0 m up the plaza in 60 s, in silence, while the player was still
 * reading the arrival card. That is the whole of the "Pasto drifts at spawn"
 * finding, and it was never a velocity write — the writer was cannon's own
 * integrator, answering a contact.
 *
 * Being ABOARD is not being in the way: the deck is 1.55 m up, riding it is the
 * chapter's mini, and a float that stopped for its own passenger would gate it.
 */
function pastoCarBlocked(capy) {
  const b = pastoCarBody;
  if (!b || !capy || !capy.position) return false;
  const p = capy.position;
  if (pastoCarAboard(p)) return false;
  if (p.y - b.position.y > pastoCAR_DECK - 0.45) return false;   // up on the deck
  if (Math.abs(p.x - b.position.x) > pastoCAR_HX + 0.55) return false;
  // Signed along the way she is going. The rear bound is the slab's own back
  // face and not zero, because the animal can be standing INSIDE the footprint
  // — parked there, or dropped there by the last shove — and "in front of the
  // centre" would wave that case straight through. It is deliberately not the
  // hitch at −3.72: that is the way aboard, and she must keep rolling while you
  // climb it.
  const ahead = (p.z - b.position.z) * pastoCarDir;              // metres in front
  return ahead > -pastoCAR_HZ && ahead < pastoCAR_HZ + 1.25;
}

/**
 * SHE HAS REACHED AN END AND IS ABOUT TO GO BACK. The one moment in the
 * float's circuit that is an event rather than a state, and the boarding window
 * opens on it — so it is worth hearing from anywhere in the plaza, which is
 * what the horn's far radius is for.
 */
// ---------------------------------------------------------------------------
// A SOUND THAT ARRIVES A MOMENT LATER, ON THE FRAME CLOCK (D9).
//
// Three sounds in this chapter were scheduled with `setTimeout`: the crates
// after the stall frame, the vendor after the crates, and the cheer after the
// float's horn. They are the right idea — a stall coming down is three sounds
// in the order the thing actually falls — and the wrong clock. setTimeout is
// the WALL clock, so those sounds do not know about a hitstop, about slow
// motion, about the pause card, or about the player having left the chapter
// between the horn and the cheer.
//
// One array and four lines. `t` counts down on the same dt everything else in
// the file gets, so a freeze holds the crates exactly as it holds the stall,
// and the queue is emptied outright when the chapter is not live.
const pastoSfxQ = [];
function pastoSfxIn(t, name, opts) {
  if (pastoSfxQ.length > 24) return;   // a stall is three sounds, not a queue
  pastoSfxQ.push({ t: t, name: name, opts: opts });
}
function pastoSfxStep(game, dt) {
  if (!pastoSfxQ.length) return;
  for (let i = pastoSfxQ.length - 1; i >= 0; i--) {
    const e = pastoSfxQ[i];
    e.t -= dt;
    if (e.t > 0) continue;
    pastoSfxQ.splice(i, 1);
    if (game.sfx) game.sfx(e.name, e.opts);
  }
}

function pastoCarTurn(game) {
  if (!game || !game.sfx) return;
  game.sfx('horn', { at: pastoCarPos, volume: 0.5, pitch: rand(1.15, 1.4),
                     near: 8, far: 110 });
  pastoSfxIn(0.380, 'cheer', { at: pastoCarPos, volume: 0.32, pitch: rand(1.0, 1.2),
                               near: 7, far: 70 });
}

function pastoUpdateCarroza(game, dt) {
  const b = pastoCarBody;
  if (!b || dt <= 0) { if (b) b.velocity.setZero(); return; }
  // She waits rather than shoves. Nothing downstream needs her to be rolling
  // except the ride itself, and the ride is measured from the deck, so a player
  // who plants themselves in the lane stalls a parade and gates nothing.
  pastoCarWaiting = pastoCarBlocked(game.capy);
  if (pastoCarDwell > 0) {
    pastoCarDwell -= dt;
  } else if (!pastoCarWaiting) {
    pastoCarZ += pastoCAR_SPEED * dt * pastoCarDir;
    if (pastoCarZ >= pastoCAR_Z1) { pastoCarZ = pastoCAR_Z1; pastoCarDir = -1; pastoCarDwell = pastoCAR_DWELL; pastoCarTurn(game); }
    else if (pastoCarZ <= pastoCAR_Z0) { pastoCarZ = pastoCAR_Z0; pastoCarDir = 1; pastoCarDwell = pastoCAR_DWELL; pastoCarTurn(game); }
  }
  // ---- THE FLOAT HAS A BAND ON IT (R8) -----------------------------------
  // A carroza is a lorry with a brass band and a bombo on the back of it, and
  // this one rolled up and down the plaza for the whole chapter in silence —
  // in a chapter whose only ambient line was a hiss. The band plays from the
  // DECK, so it walks up the plaza with the float and is the one thing in
  // Pasto you can hear moving.
  pastoCarBandT -= dt;
  if (pastoCarBandT <= 0 && game.sfx) {
    pastoCarBandT = pastoCarDwell > 0 ? rand(6.5, 10) : rand(4.0, 7.0);
    game.sfx('banda', { at: pastoCarPos, volume: 0.85, pitch: rand(0.95, 1.06),
                        near: 7, far: 95 });
  }
  // Kinematic, moved by VELOCITY and taken FROM THE TARGET — the same rule the
  // ferry and the ice cream van are on, and the only one cannon will carry a
  // passenger with.
  b.velocity.set(0, 0, clamp((pastoCarZ - pastoCarPZ) / dt, -8, 8));
  pastoCarPZ = pastoCarZ;
  pastoCarGroup.position.copy(b.interpolatedPosition);
  pastoCarPos.copy(pastoCarGroup.position);
  if (pastoCarFigure) {
    pastoCarFigure.rotation.y += dt * (pastoCarDwell > 0 || pastoCarWaiting ? 0.22 : 0.85);
    pastoCarFigure.position.y = pastoCAR_DECK + Math.sin(pastoCarZ * 1.9) * 0.045;
  }

  const capy = game.capy;
  const aboard = !!(capy && pastoCarAboard(capy.position));
  // The plaza notices. A cheer every few seconds while somebody is up there is
  // the whole difference between riding a float and standing on a trailer.
  pastoCarCheerT -= dt;
  if (aboard && pastoCarDwell <= 0 && pastoCarCheerT <= 0) {
    pastoCarCheerT = 4.2;
    // ...FROM THE PLAZA, not from inside the player's head. The crowd is on
    // the cobbles either side of the lane, so the cheer comes off the float's
    // own position, which is where they are looking.
    if (game.sfx) {
      game.sfx('cheer', { at: pastoCarPos, volume: 0.55, pitch: rand(1.02, 1.2),
                          near: 6, far: 80 });
    }
  }
  // …AND HOW FAR. The plaza is twenty-eight and a half metres end to end and
  // she turns round at both ends, so "how far did you ride in one go" is a
  // number worth going back for — and the tick, at eleven seconds, is not.
  if (aboard && pastoCarDwell <= 0) {
    pastoCarRideT += dt;
    pastoCarRideM += pastoCAR_SPEED * dt;
    // the metres, on the paper, while the float is carrying you (v32). Six is
    // the record's own floor six lines down.
    if (game.recordLive && pastoCarRideM > 6) game.recordLive('carroza', pastoCarRideM);
    if (!pastoCarRode && pastoCarRideT >= pastoCAR_RIDE) {
      pastoCarRode = true;
      if (game.completeTask) game.completeTask('carroza');
    }
  } else if (!aboard) {
    if (pastoCarRideM > 6 && typeof game.record === 'function') game.record('carroza', pastoCarRideM);
    pastoCarRideT = 0;
    pastoCarRideM = 0;
  }
}

// ================================================================== THE TALC ==
// THE CHAPTER IS THE CARNAVAL DE NEGROS Y BLANCOS AND NOTHING WAS EVER WHITE.
//
// The float exists, it crosses the plaza, the crowd cheers — and the one thing
// that everybody who has ever been to this carnival remembers about it is that
// on the sixth of January the entire city throws talc at each other until the
// air over the plaza is opaque. A mini called EL CARNAVAL with no talc in it
// is a parade float at a village fete.
//
// Two hundred flakes, one InstancedMesh, no physics: emitted in bursts from
// the float and from the crowd along the route, gravity, drag and a spin, and
// they die white on the cobbles. They are emitted ONLY while somebody is
// aboard and she is rolling, which makes them the reward rather than the
// weather — the plaza is ordinary until you climb up, and then it is not.
const pastoTALC_N = 220;
const pastoTALC_STRIDE = 8;   // x, y, z, vx, vy, vz, life, size
let pastoTalcMesh = null;
let pastoTalcData = null;
let pastoTalcCur = 0;
let pastoTalcT = 0;
let pastoTalcLive = false;

// ============================================================ THE VOICES ====
// R8. THREE OBJECTS IN THIS CHAPTER MAKE A NOISE AND NONE OF THEM DID.
//
// The ambience ladder in systems.js is the BED — it plays from a random bearing
// around the player and says where you are. These are different: they are
// attached to things, they come from where the thing is, and they are the
// reason walking towards something in Pasto now sounds like walking towards
// something. The bell has had this since it was written; it was the only one.
const pastoVENT_GAP = [9, 19];        // s between rumbles out of the vent
const pastoNAVE_GAP = [13, 26];       // s between organ phrases inside the church
let pastoVentT = 5, pastoNaveT = 4, pastoBushT = 0;
const pastoVentAt = { x: 0, y: 0, z: 0 };
const pastoNaveAt = { x: 0, y: 6, z: 42 };

function pastoUpdateVoices(game, dt) {
  const capy = game.capy;
  if (!capy || !capy.position || !game.sfx) return;
  const p = capy.position;

  // ---- THE VENT ----------------------------------------------------------
  // Galeras is an ACTIVE volcano and the chapter draws a plume coming out of
  // it. It is the largest object in the place, it is the destination of two
  // tasks, and it was silent from every distance. Low, long, and it carries a
  // very long way, because that is what a mountain clearing its throat does.
  pastoVentT -= dt;
  if (pastoVentT <= 0) {
    pastoVentT = rand(pastoVENT_GAP[0], pastoVENT_GAP[1]);
    pastoVentAt.x = pastoGAL_X; pastoVentAt.z = pastoGAL_Z;
    pastoVentAt.y = pastoHeight(pastoGAL_X, pastoGAL_Z) + 4;
    game.sfx('thunder', { at: pastoVentAt, volume: 0.55, pitch: rand(0.30, 0.44),
                          near: 30, far: 420 });
  }

  // ---- THE NAVE ----------------------------------------------------------
  // There is a harmonium in every one of these churches and it is never not
  // being played. Only from inside the precinct, and only when the bell is not
  // already going — two big sounds out of one building at once is a mess.
  pastoNaveT -= dt;
  if (pastoNaveT <= 0) {
    pastoNaveT = rand(pastoNAVE_GAP[0], pastoNAVE_GAP[1]);
    if (pastoInZone('church', p.x, p.z) && !pastoBellSwinging) {
      game.sfx('organ', { at: pastoNaveAt, volume: 0.42, pitch: rand(0.62, 0.8),
                          near: 6, far: 46 });
    }
  }

  // ---- THE BUSHES --------------------------------------------------------
  // Chest-high coffee, planted in rows, and you can run straight through it.
  // Gated on actually MOVING, or standing in a finca is a rattle.
  pastoBushT -= dt;
  const v = capy.body ? capy.body.velocity : null;
  const spd = v ? Math.sqrt(v.x * v.x + v.z * v.z) : 0;
  if (pastoBushT <= 0 && spd > 1.6 && pastoInZone('coffee', p.x, p.z)) {
    pastoBushT = rand(0.42, 0.72);
    game.sfx('rustle', { at: p, volume: clamp(0.10 + spd * 0.035, 0.10, 0.32),
                         pitch: rand(1.05, 1.45), near: 2, far: 22 });
  }
}

function pastoBuildTalc() {
  const g = new THREE.OctahedronGeometry(0.085, 0);
  const m = mat(PALETTE.volcanoSnow, { transparent: true, opacity: 0.92, depthWrite: false });
  const im = new THREE.InstancedMesh(g, m, pastoTALC_N);
  im.name = 'pastoTalc';
  im.frustumCulled = false;
  im.castShadow = false;
  im.receiveShadow = false;
  pastoTalcData = new Float32Array(pastoTALC_N * pastoTALC_STRIDE);
  for (let i = 0; i < pastoTALC_N; i++) {
    // parked below the world, at zero scale — a flake with no life is not drawn
    im.setMatrixAt(i, pastoXf(0, -900, 0, 0, 0, 0, 0.001, 0.001, 0.001));
  }
  im.instanceMatrix.needsUpdate = true;
  pastoTalcMesh = im;
  return im;
}

/** One handful, thrown from (x,y,z) in roughly the direction (dx,dz). */
function pastoTalcBurst(x, y, z, dx, dz, n, power) {
  if (!pastoTalcData) return;
  for (let k = 0; k < n; k++) {
    const o = (pastoTalcCur % pastoTALC_N) * pastoTALC_STRIDE;
    pastoTalcCur++;
    const spread = rand(-0.7, 0.7);
    const cs = Math.cos(spread), sn = Math.sin(spread);
    const ax = dx * cs - dz * sn, az = dx * sn + dz * cs;
    const sp = rand(1.4, 4.6) * power;
    pastoTalcData[o]     = x + rand(-0.3, 0.3);
    pastoTalcData[o + 1] = y + rand(-0.2, 0.35);
    pastoTalcData[o + 2] = z + rand(-0.3, 0.3);
    pastoTalcData[o + 3] = ax * sp;
    pastoTalcData[o + 4] = rand(1.9, 4.4) * power;
    pastoTalcData[o + 5] = az * sp;
    pastoTalcData[o + 6] = rand(1.3, 2.6);
    pastoTalcData[o + 7] = rand(0.55, 1.5);
  }
  pastoTalcLive = true;
}

function pastoUpdateTalc(game, dt) {
  const im = pastoTalcMesh;
  if (!im || !pastoTalcData) return;

  // ---- who is throwing ---------------------------------------------------
  const capy = game.capy;
  const aboard = !!(capy && capy.position && pastoCarAboard(capy.position));
  if (aboard && pastoCarDwell <= 0) {
    pastoTalcT -= dt;
    if (pastoTalcT <= 0) {
      // Never a fixed interval — see the burner metronome. Redrawn every time.
      pastoTalcT = rand(0.26, 0.62);
      const cz = pastoCarPos.z, cx = pastoCarPos.x;
      // …from the float itself, straight up over the sun
      pastoTalcBurst(cx + rand(-1.2, 1.2), pastoCAR_DECK + 2.4, cz + rand(-2.6, 2.6),
                     rand(-1, 1), rand(-1, 1), 5, 0.7);
      // …and from somebody standing at the side of the road, at the float
      const side = Math.random() < 0.5 ? -1 : 1;
      const sx = cx + side * rand(3.4, 6.2), sz = cz + rand(-4, 4);
      pastoTalcBurst(sx, pastoHeight(sx, sz) + 1.5, sz, -side, rand(-0.4, 0.4), 6, 1.0);
      if (typeof game.sfx === 'function' && Math.random() < 0.45) {
        game.sfx('rustle', { volume: rand(0.22, 0.4), pitch: rand(1.3, 1.75),
                             at: { x: sx, y: 1.5, z: sz }, near: 8, far: 60 });
      }
    }
  }

  if (!pastoTalcLive) return;
  let any = false;
  for (let i = 0; i < pastoTALC_N; i++) {
    const o = i * pastoTALC_STRIDE;
    let life = pastoTalcData[o + 6];
    if (life <= 0) continue;
    life -= dt;
    pastoTalcData[o + 6] = life;
    if (life <= 0) { im.setMatrixAt(i, pastoXf(0, -900, 0, 0, 0, 0, 0.001, 0.001, 0.001)); continue; }
    any = true;
    // Talc is not sand: it hangs. Heavy drag, weak gravity, and it drifts.
    const drag = Math.exp(-2.4 * dt);
    pastoTalcData[o + 3] *= drag;
    pastoTalcData[o + 5] *= drag;
    pastoTalcData[o + 4] = pastoTalcData[o + 4] * drag - 2.1 * dt;
    pastoTalcData[o]     += pastoTalcData[o + 3] * dt;
    pastoTalcData[o + 1] += pastoTalcData[o + 4] * dt;
    pastoTalcData[o + 2] += pastoTalcData[o + 5] * dt;
    // it settles ON the cobbles rather than through them
    const gy = pastoHeight(pastoTalcData[o], pastoTalcData[o + 2]) + 0.06;
    if (pastoTalcData[o + 1] < gy) {
      pastoTalcData[o + 1] = gy;
      pastoTalcData[o + 3] *= 0.3; pastoTalcData[o + 5] *= 0.3; pastoTalcData[o + 4] = 0;
    }
    const s = pastoTalcData[o + 7] * clamp(life * 1.4, 0.15, 1);
    im.setMatrixAt(i, pastoXf(pastoTalcData[o], pastoTalcData[o + 1], pastoTalcData[o + 2],
                              life * 5.1 + i, life * 3.3, life * 2.2, s, s, s));
  }
  im.instanceMatrix.needsUpdate = true;
  pastoTalcLive = any;
}

function pastoBuildMarket(game, root) {
  const parts = [];
  const spud = new THREE.OctahedronGeometry(0.2, 0);
  const tables = pastoBody(game, 0);
  for (let i = 0; i < pastoSTALL_SPEC.length; i++) {
    const spec = pastoSTALL_SPEC[i];
    pastoStalls.push(pastoMakeStall(game, root, spec, i, parts, spud));
    pastoBodyBox(tables, spec.x, 0.51, spec.z, 1.55, 0.51, 0.8, spec.yaw);
  }
  pastoBodyDone(game, tables, 0, 0, 0);
  root.add(pastoTownMesh(parts, 'pastoMarketStatic', true, true));
  spud.dispose();
}

function pastoUpdateStalls() {
  for (let i = 0; i < pastoStalls.length; i++) {
    const st = pastoStalls[i];
    if (!st.collapsed || !st.mesh || !st.awningBody) continue;
    st.mesh.position.copy(st.awningBody.interpolatedPosition);
    st.mesh.quaternion.copy(st.awningBody.interpolatedQuaternion);
  }
}

// ---------------------------------------------------------------------------
// 8f. THE COLONIAL STREET. Two terraces of two-storey houses with balconies,
// facades only on the side that faces the street. The whole street — 19 houses
// plus the paving between them — is one merged mesh, and collides as three
// long boxes rather than 19 buildings.
// ---------------------------------------------------------------------------
const pastoHOUSE_W = [6.4, 5.6, 7.0, 6.0, 6.8, 5.8];
const pastoWALL_COLS = [PALETTE.churchWhite, PALETTE.churchWhite, PALETTE.adobeWall, PALETTE.churchWhite];
const pastoSHUTTER_COLS = [PALETTE.awning2, PALETTE.ruana1, PALETTE.awning4, PALETTE.ruana2, PALETTE.awning3];

function pastoHouseWindow(parts, base, sc, x, y) {
  // Small windows. They are the scale reference that made the old houses read as
  // an accurate architectural model instead of a toy town.
  pastoBox(parts, base, PALETTE.churchTrim, x, y, -0.1, 0.34, 0.42, 0.1);
  pastoBox(parts, base, sc, x - 0.17, y, -0.22, 0.15, 0.36, 0.06);
  pastoBox(parts, base, sc, x + 0.17, y, -0.22, 0.15, 0.36, 0.06);
}

function pastoHouse(parts, roofG, cx, zFace, ry, w, i) {
  // Break the grid. Every house gets its own yaw, its own cornice height and its
  // own roof tilt, so the terrace steps and staggers instead of extruding one
  // correct profile nineteen times.
  const j0 = pastoHash01(i * 3 + 11, 7);
  const j1 = pastoHash01(i * 5 + 2, 19);
  const j2 = pastoHash01(i * 9 + 4, 31);
  const base = pastoFrame(cx, 0, zFace, (ry || 0) + (j0 - 0.5) * 0.08);
  const D = pastoSTR_D, hd = D * 0.5;
  const wall = pastoWALL_COLS[i % pastoWALL_COLS.length];
  const sc = pastoSHUTTER_COLS[i % pastoSHUTTER_COLS.length];
  const wt = 5.6 + j1 * 1.8;                 // cornice height, 5.6 .. 7.4
  const mid = wt * 0.52;                     // string course
  const by = mid + 0.16;                     // balcony floor

  pastoBox(parts, base, PALETTE.adobeShade, 0, 0.3, hd - 0.03, w * 0.5 + 0.1, 0.3, hd + 0.06);
  pastoBox(parts, base, wall, 0, wt * 0.5, hd, w * 0.5, wt * 0.5, hd);
  pastoBox(parts, base, PALETTE.adobeShade, 0, mid, hd, w * 0.5 + 0.13, 0.13, hd + 0.08);
  pastoBox(parts, base, PALETTE.churchTrim, 0, wt + 0.05, hd, w * 0.5 + 0.16, 0.16, hd + 0.1);
  // Absurdly heavy eaves — the roof overhangs the facade by 1.5 m and is tilted
  // a few degrees off true.
  pastoPart(parts, base, (i % 2) ? PALETTE.roofTile : PALETTE.roofTileDark, roofG,
    0, wt + 1.05, hd, 0, Math.PI / 4, (j2 - 0.5) * 0.1,
    (w * 1.22 + 0.5) * 0.708, 1.7, (D * 1.5 + 0.6) * 0.708);

  // door — 2.0 m wide, 3.2 m tall, so the capybara is an oversized menace
  pastoBox(parts, base, PALETTE.balconyWood, 0, 1.6, -0.08, 1.0, 1.6, 0.1);
  pastoBox(parts, base, PALETTE.churchTrim, 0, 3.32, -0.1, 1.2, 0.14, 0.12);
  // ground-floor windows either side of the door
  pastoHouseWindow(parts, base, sc, -w * 0.32, 2.15);
  pastoHouseWindow(parts, base, sc, w * 0.32, 2.15);
  // upper windows, behind the balcony
  pastoHouseWindow(parts, base, sc, -w * 0.2, by + 1.35);
  pastoHouseWindow(parts, base, sc, w * 0.2, by + 1.35);

  // balcony
  const bw = w * 0.34;
  pastoBox(parts, base, PALETTE.balconyWood, 0, by, -0.48, bw, 0.09, 0.52);
  pastoBox(parts, base, PALETTE.balconyWood, 0, by + 0.88, -0.94, bw, 0.07, 0.06);
  pastoBox(parts, base, PALETTE.balconyWood, -bw, by + 0.44, -0.5, 0.06, 0.44, 0.48);
  pastoBox(parts, base, PALETTE.balconyWood, bw, by + 0.44, -0.5, 0.06, 0.44, 0.48);
  for (let k = 0; k < 5; k++) {
    pastoBox(parts, base, PALETTE.balconyWood, -bw + (k + 0.5) * (bw * 2 / 5), by + 0.44, -0.94, 0.05, 0.44, 0.05);
  }
  // a potted geranium on the rail, because of course
  pastoBox(parts, base, PALETTE.roofTile, bw * 0.55, by + 1.10, -0.94, 0.16, 0.15, 0.14);
  pastoBox(parts, base, PALETTE.petalRed, bw * 0.55, by + 1.36, -0.94, 0.2, 0.14, 0.18);
}

function pastoBuildStreet(game, root) {
  const parts = [];
  const roofG = new THREE.CylinderGeometry(0.3, 1, 1, 4, 1, false);
  let i = 0;
  const spans = [];                    // [x0, x1] actually built, per run

  // north terrace: unbroken, facades face -z
  let x = pastoSTR_X0;
  while (x < pastoSTR_X1 - 1) {
    const w = pastoHOUSE_W[i % pastoHOUSE_W.length];
    pastoHouse(parts, roofG, x + w * 0.5, pastoSTR_NF, 0, w, i);
    x += w; i++;
  }
  spans.push([pastoSTR_X0, x]);
  // south terrace: two runs, the church apse occupies the middle
  const runs = [[-34, -11], [11, 34]];
  for (let r = 0; r < 2; r++) {
    x = runs[r][0];
    while (x < runs[r][1] - 1) {
      const w = pastoHOUSE_W[i % pastoHOUSE_W.length];
      pastoHouse(parts, roofG, x + w * 0.5, pastoSTR_SF, Math.PI, w, i);
      x += w; i++;
    }
    spans.push([runs[r][0], x]);
  }

  // paving between the rows, with kerbs
  const pz0 = pastoSTR_SF + 0.25, pz1 = pastoSTR_NF - 0.25;
  const pn = 34, pm = 4;
  const pw = (pastoSTR_X1 + 1 - (pastoSTR_X0 - 1)) / pn, ph = (pz1 - pz0) / pm;
  for (let a = 0; a < pn; a++) {
    for (let b = 0; b < pm; b++) {
      const t = pastoHash01(a + 71, b + 13);
      const c = (b === 0 || b === pm - 1) ? PALETTE.stoneDark
        : (t > 0.6 ? PALETTE.cobbleDark : PALETTE.cobble);
      pastoBox(parts, null, c, pastoSTR_X0 - 1 + (a + 0.5) * pw, 0.04, pz0 + (b + 0.5) * ph,
        pw * 0.5, 0.04, ph * 0.5);
    }
  }

  root.add(pastoTownMesh(parts, 'pastoStreet', true, true));
  roofG.dispose();

  // Three long static boxes, each one exactly as long as the run of houses
  // it stands behind. Balconies overhang at y 3.6 and are not collided.
  // The plinth stands 10 cm proud of the facade, so the box does too.
  const zs = [pastoSTR_NF + pastoSTR_D * 0.5, pastoSTR_SF - pastoSTR_D * 0.5,
              pastoSTR_SF - pastoSTR_D * 0.5];
  for (let r = 0; r < spans.length; r++) {
    const x0 = spans[r][0] - 0.1, x1 = spans[r][1] + 0.1;
    const b = pastoBody(game, 0);
    pastoBodyBox(b, (x0 + x1) * 0.5, 3.4, zs[r], (x1 - x0) * 0.5, 3.4, pastoSTR_D * 0.5);
    pastoBodyDone(game, b, 0, 0, 0);
  }
}

// ---------------------------------------------------------------------------
// 8g. THE COFFEE FARM. A drying patio with the harvest spread out on it, a
// small finca, and a stack of sacks. The patio is a levelled slab with a
// retaining skirt, because the terraces underneath it are not flat.
// ---------------------------------------------------------------------------
/** Highest corner of a footprint — the slab sits on that so nothing pokes through. */
function pastoPadY(x, z, w, d) {
  const hw = w * 0.5, hd = d * 0.5;
  let y = pastoHeight(x - hw, z - hd);
  const c = [pastoHeight(x + hw, z - hd), pastoHeight(x - hw, z + hd), pastoHeight(x + hw, z + hd)];
  for (let i = 0; i < 3; i++) if (c[i] > y) y = c[i];
  return y;
}

const pastoCoffeePatio = {
  x: pastoCOF_PATIO_X, z: pastoCOF_PATIO_Z,
  w: pastoCOF_PATIO_W, d: pastoCOF_PATIO_D,
  y: 0,
};

function pastoBuildCoffeeFarm(game, root) {
  const parts = [];
  const patioY = pastoPadY(pastoCOF_PATIO_X, pastoCOF_PATIO_Z, pastoCOF_PATIO_W, pastoCOF_PATIO_D) + 0.42;

  // -- drying patio
  const hw = pastoCOF_PATIO_W * 0.5, hd = pastoCOF_PATIO_D * 0.5;
  const pb = pastoFrame(pastoCOF_PATIO_X, 0, pastoCOF_PATIO_Z, 0);
  pastoBox(parts, pb, PALETTE.stone, 0, patioY - 0.9, 0, hw, 0.9, hd);
  // The drying floor runs right up under the kerbs, so no sliver of the stone
  // slab's top is ever exposed beside it — that sliver was what shimmered.
  const surf = patioY + 0.14;
  pastoCoffeePatio.y = surf;                 // the surface props should land on
  pastoBox(parts, pb, PALETTE.churchWhite, 0, patioY + 0.04, 0, hw - 0.28, 0.1, hd - 0.28);
  pastoBox(parts, pb, PALETTE.stoneDark, 0, patioY + 0.1, -hd + 0.14, hw, 0.16, 0.14);
  pastoBox(parts, pb, PALETTE.stoneDark, 0, patioY + 0.1, hd - 0.14, hw, 0.16, 0.14);
  pastoBox(parts, pb, PALETTE.stoneDark, -hw + 0.14, patioY + 0.1, 0, 0.14, 0.16, hd);
  pastoBox(parts, pb, PALETTE.stoneDark, hw - 0.14, patioY + 0.1, 0, 0.14, 0.16, hd);
  // the harvest, raked into beds
  const bean = new THREE.OctahedronGeometry(0.16, 0);
  for (let r = 0; r < 4; r++) {
    pastoBox(parts, pb, PALETTE.coffeeCherry, 0, surf + 0.05, -3.3 + r * 2.2, hw - 1.4, 0.05, 0.62);
    for (let k = 0; k < 9; k++) {
      pastoPart(parts, pb, k % 2 ? PALETTE.coffeeCherry : PALETTE.paramoSoil, bean,
        -hw + 1.4 + k * ((pastoCOF_PATIO_W - 2.8) / 8), surf + 0.13, -3.3 + r * 2.2 + pastoRndR(-0.35, 0.35),
        0, pastoRnd() * 3, 0, 1, 0.7, 1);
    }
  }
  // a rake left leaning against the retaining wall
  pastoBox(parts, pb, PALETTE.balconyWood, hw - 0.45, surf + 0.95, hd - 1.4, 0.06, 1.0, 0.06, 0, 0, 0.24);
  pastoBox(parts, pb, PALETTE.balconyWood, hw - 0.9, surf + 1.9, hd - 1.4, 0.42, 0.07, 0.07, 0, 0, 0.24);
  bean.dispose();

  // -- finca house
  const fy = pastoPadY(pastoFINCA_X, pastoFINCA_Z, 8, 7);
  const fb = pastoFrame(pastoFINCA_X, fy, pastoFINCA_Z, -0.45);
  pastoBox(parts, fb, PALETTE.adobeShade, 0, 0.3, 0, 4.2, 0.6, 3.7);
  pastoBox(parts, fb, PALETTE.churchWhite, 0, 2.3, 0.4, 3.9, 1.9, 3.0);
  pastoBox(parts, fb, PALETTE.balconyWood, 0, 1.4, -2.7, 0.6, 1.0, 0.12);
  pastoBox(parts, fb, PALETTE.awning2, -2.1, 2.3, -2.65, 0.5, 0.5, 0.1);
  pastoBox(parts, fb, PALETTE.awning2, 2.1, 2.3, -2.65, 0.5, 0.5, 0.1);
  const fincaRoof = new THREE.CylinderGeometry(0.26, 1, 1, 4, 1, false);
  pastoPart(parts, fb, PALETTE.roofTile, fincaRoof, 0, 5.0, 0.15, 0, Math.PI / 4, 0, 6.5, 1.9, 6.4);
  fincaRoof.dispose();
  // verandah
  pastoBox(parts, fb, PALETTE.balconyWood, 0, 3.9, -3.4, 4.4, 0.16, 1.0, 0, -0.16);
  for (let k = -1; k <= 1; k += 1) {
    pastoBox(parts, fb, PALETTE.balconyWood, k * 3.4, 1.95, -3.9, 0.14, 1.95, 0.14);
  }

  // -- stacked sacks of parchment coffee
  const sb = pastoFrame(pastoFINCA_X - 9, 0, pastoFINCA_Z + 8, 0.6);
  const sy = pastoPadY(pastoFINCA_X - 9, pastoFINCA_Z + 8, 4, 4);
  for (let k = 0; k < 9; k++) {
    const row = k < 5 ? 0 : (k < 8 ? 1 : 2);
    const idx = k < 5 ? k : (k < 8 ? k - 5 : 0);
    pastoBox(parts, sb, (k % 2) ? PALETTE.potatoSack : PALETTE.arepa,
      -1.6 + idx * 0.86 + row * 0.42, sy + 0.42 + row * 0.74, row * 0.3 + pastoRndR(-0.12, 0.12),
      0.44, 0.36, 0.34, pastoRndR(-0.3, 0.3));
  }

  root.add(pastoTownMesh(parts, 'pastoCoffeeFarm', true, true));

  // -- collision
  const b = pastoBody(game, 0);
  pastoBodyBox(b, pastoCOF_PATIO_X, surf - 0.9, pastoCOF_PATIO_Z, hw, 0.9, hd);
  pastoBodyDone(game, b, 0, 0, 0);
  // The yaw lives on the BODY, so the shape offset must stay unrotated — putting
  // the same quaternion on both would turn the finca through 0.9 rad.
  const fbody = pastoBody(game, 0);
  fbody.addShape(new CANNON.Box(new CANNON.Vec3(4.0, 2.5, 3.4)), new CANNON.Vec3(0, 2.5, 0.4));
  fbody.quaternion.setFromEuler(0, -0.45, 0);
  pastoBodyDone(game, fbody, pastoFINCA_X, fy, pastoFINCA_Z);
  const sbody = pastoBody(game, 0);
  pastoBodyBox(sbody, pastoFINCA_X - 9, sy + 0.8, pastoFINCA_Z + 8, 2.3, 0.8, 1.1, 0.6);
  pastoBodyDone(game, sbody, 0, 0, 0);
}

// ===========================================================================
// 7. ZONES / NAV
// ===========================================================================
/** Point-in-oriented-rect, inflated by `r`. Allocation free. */
function pastoInRot(x, z, cx, cz, yaw, hx, hz, r) {
  const dx = x - cx, dz = z - cz;
  // WORLD -> LOCAL IS ONE INVERSION, NOT TWO. `lx = dx*cos - dz*sin` already IS
  // the inverse rotation when handed cos(yaw)/sin(yaw); negating the angle as
  // well evaluates the rect at -yaw. The market stalls never showed it because
  // every stall yaw is a multiple of pi/2, where the |.| test is symmetric —
  // but the six fountain benches are at 60 degree steps, so four of them tested
  // a box rotated sixty degrees away from the collider actually standing there,
  // and pedestrians ground along the ends of benches while being pushed out of
  // empty cobbles beside them.
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const lx = dx * c - dz * s, lz = dx * s + dz * c;

  return Math.abs(lx) <= hx + r && Math.abs(lz) <= hz + r;
}

function pastoInZone(name, x, z) {
  if (name === 'plaza') {
    return x >= pastoPLZ_X0 && x <= pastoPLZ_X1 && z >= pastoPLZ_Z0 && z <= pastoPLZ_Z1;
  }
  if (name === 'market') {
    return x >= pastoMKT_X0 && x <= pastoMKT_X1 && z >= pastoMKT_Z0 && z <= pastoMKT_Z1;
  }
  if (name === 'church') {
    // The precinct: the atrium in front of the steps, the nave, and the tower.
    if (x >= -10.5 && x <= 10.5 && z >= 33 && z <= 52) return true;
    return x >= pastoTW_X - 3.4 && x <= pastoTW_X + 3.4 &&
           z >= pastoTW_Z - 3.4 && z <= pastoTW_Z + 3.4;
  }
  if (name === 'street') {
    return x >= pastoSTR_X0 && x <= pastoSTR_X1 && z >= pastoSTR_Z0 && z <= pastoSTR_Z1;
  }
  if (name === 'coffee') {
    return x >= pastoCOF_X0 && x <= pastoCOF_X1 && z >= pastoCOF_Z0 && z <= pastoCOF_Z1;
  }
  if (name === 'paramo') {
    const dx = x - pastoGAL_X, dz = z - pastoGAL_Z;
    if (dx * dx + dz * dz > pastoGAL_R * pastoGAL_R) return false;
    return pastoHeight(x, z) >= pastoPARAMO_Y;
  }
  if (name === 'crater') {
    const dx = x - pastoGAL_X, dz = z - pastoGAL_Z;
    return dx * dx + dz * dz <= pastoCRATER_R * pastoCRATER_R;
  }
  return false;
}

function pastoNavBlocked(x, z, radius) {
  const r = radius || 0;
  if (Math.abs(x) + r > pastoWALK || Math.abs(z) + r > pastoWALK) return true;
  const dx = x - pastoGAL_X, dz = z - pastoGAL_Z;
  const rim = pastoCRATER_R + 2 + r;
  if (dx * dx + dz * dz < rim * rim) return true;      // nobody wanders into the crater

  // --- town furniture -----------------------------------------------------
  // fountain
  const fx = x - pastoFTN_X, fz = z - pastoFTN_Z;
  const fr = pastoFTN_R + 0.9 + r;
  if (fx * fx + fz * fz < fr * fr) return true;
  // benches ring the fountain
  const br = pastoBenchR;
  const bd = Math.sqrt(fx * fx + fz * fz);
  if (bd > br - 1.4 - r && bd < br + 1.4 + r) {
    for (let i = 0; i < pastoBenchN; i++) {
      const a = (i / pastoBenchN) * Math.PI * 2 + pastoBenchPhase;
      if (pastoInRot(x, z, pastoFTN_X + Math.cos(a) * br, pastoFTN_Z + Math.sin(a) * br,
        -a + Math.PI * 0.5, 1.15, 0.42, r)) return true;
    }
  }
  // planters
  for (let i = 0; i < pastoPlanters.length; i++) {
    const p = pastoPlanters[i];
    if (Math.abs(x - p.x) < 1.5 + r && Math.abs(z - p.z) < 1.4 + r) return true;
  }
  // market stalls (the frame footprint, not just the table)
  if (x > pastoMKT_X0 - 3 && x < pastoMKT_X1 + 3 && z > pastoMKT_Z0 - 3 && z < pastoMKT_Z1 + 3) {
    for (let i = 0; i < pastoSTALL_SPEC.length; i++) {
      const s = pastoSTALL_SPEC[i];
      if (pastoInRot(x, z, s.x, s.z, s.yaw, 1.7, 1.1, r)) return true;
    }
  }
  // the church, and the tower's arcade
  if (Math.abs(x) < pastoCH_HW + 0.6 + r && z > pastoCH_ZF - 0.6 - r && z < pastoCH_ZB + 0.6 + r) return true;
  if (Math.abs(x - pastoTW_X) < pastoTW_HW + 0.4 + r &&
      Math.abs(z - pastoTW_Z) < pastoTW_HW + 0.4 + r) return true;
  // the two terraces of the colonial street
  if (x > pastoSTR_X0 - 0.6 - r && x < pastoSTR_X1 + 0.6 + r) {
    if (z > pastoSTR_NF - 0.3 - r && z < pastoSTR_NF + pastoSTR_D + 0.3 + r) return true;
    if (z < pastoSTR_SF + 0.3 + r && z > pastoSTR_SF - pastoSTR_D - 0.3 - r) return true;
  }
  // the finca and its sacks (the drying patio itself stays walkable)
  if (Math.abs(x - pastoFINCA_X) < 5.0 + r && Math.abs(z - pastoFINCA_Z) < 4.6 + r) return true;
  if (Math.abs(x - (pastoFINCA_X - 9)) < 2.6 + r && Math.abs(z - (pastoFINCA_Z + 8)) < 2.0 + r) return true;

  // Flat shelf under the town, so this only ever bites out in the valley.
  return pastoSlope(x, z) > 1.0;                       // too steep to walk
}

/** Rejection sample a rect for somewhere an NPC could actually stand. */
function pastoFreePointIn(x0, z0, x1, z1, tries, fx, fz) {
  for (let i = 0; i < tries; i++) {
    const x = rand(x0, x1), z = rand(z0, z1);
    if (!pastoNavBlocked(x, z, 0.7)) return { x: x, z: z };
  }
  return { x: fx, z: fz };
}

function pastoRandomPointIn(name) {
  if (name === 'plaza') {
    return pastoFreePointIn(pastoPLZ_X0 + 2, pastoPLZ_Z0 + 2, pastoPLZ_X1 - 2, pastoPLZ_Z1 - 2, 50, -14, 34);
  }
  if (name === 'market') {
    // Preferentially in front of a stall — that is where a shopper belongs.
    for (let i = 0; i < 24; i++) {
      const s = pastoSTALL_SPEC[randInt(0, pastoSTALL_SPEC.length - 1)];
      const d = rand(2.1, 3.4);
      const x = s.x - Math.sin(s.yaw) * d + rand(-1.2, 1.2);
      const z = s.z - Math.cos(s.yaw) * d + rand(-1.2, 1.2);
      if (!pastoNavBlocked(x, z, 0.7)) return { x: x, z: z };
    }
    return pastoFreePointIn(pastoMKT_X0 + 3, pastoMKT_Z0 + 3, pastoMKT_X1 - 3, pastoMKT_Z1 - 3, 40, 0, 24);
  }
  if (name === 'church') {
    // The atrium at the foot of the steps, facing the great doors.
    return pastoFreePointIn(-8, 30.5, 8, 34.6, 30, 0, 32.5);
  }
  if (name === 'street') {
    return pastoFreePointIn(pastoSTR_X0 + 2, pastoSTR_SF + 0.9, pastoSTR_X1 - 2, pastoSTR_NF - 0.9, 40, 0, 54.3);
  }
  if (name === 'coffee') {
    for (let i = 0; i < 40; i++) {
      const x = rand(pastoCOF_X0 + 2, pastoCOF_X1 - 2);
      const z = rand(pastoCOF_Z0 + 2, pastoCOF_Z1 - 2);
      if (pastoSlope(x, z) <= 0.9) return { x: x, z: z };
    }
    return { x: (pastoCOF_X0 + pastoCOF_X1) * 0.5, z: (pastoCOF_Z0 + pastoCOF_Z1) * 0.5 };
  }
  if (name === 'paramo') {
    for (let i = 0; i < 60; i++) {
      const th = rand(0, Math.PI * 2);
      const d = rand(16, 47);
      const x = pastoGAL_X + Math.cos(th) * d;
      const z = pastoGAL_Z + Math.sin(th) * d;
      if (pastoHeight(x, z) >= pastoPARAMO_Y && pastoSlope(x, z) <= 1.2) return { x: x, z: z };
    }
    return { x: pastoGAL_X + 34, z: pastoGAL_Z + 12 };
  }
  if (name === 'crater') {
    const th = rand(0, Math.PI * 2);
    const d = Math.sqrt(Math.random()) * (pastoCRATER_R - 2.5);
    return { x: pastoGAL_X + Math.cos(th) * d, z: pastoGAL_Z + Math.sin(th) * d };
  }
  return null;
}

// ===========================================================================
// Lifecycle
// ===========================================================================
export function createPasto(game) {
  pastoGame = game;

  game.biome.register('pasto', {
    ensureBuilt() { pastoBuild(game); },
    onEnter() { if (pastoApi && pastoApi.onEnter) pastoApi.onEnter(); },
    onExit() { if (pastoApi && pastoApi.onExit) pastoApi.onExit(); },
  });

  // The pure half of the API answers from the moment the module loads, long
  // before the biome is first entered — npc.js / props.js / condor.js may query
  // terrain and zones while Sydney is still live.
  const api = {
    built() { return pastoBuilt; },
    /**
     * THE ONE MARQUEE IN THE GAME THAT MOVES (B1). See CHAPTERS' `marquee`.
     *
     * Chapter two is the only place whose `wow` is an ANIMAL, and it is not in
     * the sky until you have whistled for it — so the authored point is the
     * crater it circles, which is the honest answer for the first minute, and
     * this takes over the moment the bird is actually up there. Null and not
     * an old position while it is down: a glimpse aimed at where a condor used
     * to be is a shot of a hillside, and the static point is the better
     * fallback in exactly that case.
     */
    marqueeAt() {
      const c = game.condor;
      if (!c || !c.active || !c.group) return null;
      const p = c.group.position;
      return (p && p.x === p.x) ? { x: p.x, y: p.y, z: p.z } : null;
    },
    /**
     * WHEN THE FLOAT IS NEXT AT THE SOUTH END (D9).
     *
     * `carroza` pays out for riding her UP the plaza, so the window is the
     * dwell at the SOUTH end and nowhere else — boarding at the north end gets
     * you a ride back down and nothing on the paper. pastoCAR_DWELL calls
     * itself "the boarding window" in its own comment and the paper never said
     * when it opened.
     *
     * Derived from the position and the direction rather than tracked, for
     * envFerryNextIn's reason: a second clock is a second thing to keep in
     * step. An ESTIMATE while she is blocked — she waits rather than shoves,
     * and a stalled procession makes any countdown wrong.
     */
    nextIn(id) {
      if (id !== 'carroza') return -1;
      const span = (pastoCAR_Z1 - pastoCAR_Z0) / pastoCAR_SPEED;
      // At the south end with the window open. `pastoCarDir` flips the moment
      // an end is reached, so at the south end it is already +1.
      if (pastoCarDwell > 0 && pastoCarDir > 0) return 0;
      let s = pastoCarDwell > 0 ? pastoCarDwell : 0;
      if (pastoCarDir > 0) {
        // heading north: the rest of the way up, the dwell there, then back
        s += (pastoCAR_Z1 - pastoCarZ) / pastoCAR_SPEED + pastoCAR_DWELL + span;
      } else {
        s += (pastoCarZ - pastoCAR_Z0) / pastoCAR_SPEED;
      }
      return s;
    },
    /**
     * FRAME THE LAUNCH — chapter 2's marquee, GALERAS.
     *
     * v27 built `over: true` for exactly two chapters, naming both in its own
     * comment: "Antarctica's `orca-ride` is at the helm and Pasto's
     * `condor-ride` is in flight". It then wired Antarctica and left this one.
     * So the flag whose whole reason for existing was that a marquee ON a
     * vehicle cannot reach the framed channel was, in half the cases it was
     * written for, still not reaching it.
     *
     * Without `over` the weight is `shotW * (1 - flyT)`, and flyT goes to 1 the
     * instant the constraint is made — the shot would be multiplied to nothing
     * inside its own ease-in, which is what Antarctica measured as "changed the
     * lens by 0.00".
     *
     * The bearing puts the camera on the far side of the animal from the
     * crater, so the mountain it has just been thrown off fills the frame
     * behind it. Computed, never written as a literal — see environment.js's
     * operaShot for why that rule exists.
     */
    /**
     * 0..1 — HOW MUCH OF THE CRATER IS UNDER YOU, for the event grade layer.
     * Chapter 2 has never had a row in it, which v25 recorded as finding C in
     * the bluntest terms available: "riding a condor off a live volcano changes
     * no bloom, threshold or vignette".
     *
     * Gated on being MOUNTED, and THE RIDE IS THE FLOOR, not the crater.
     *
     * The first version of this keyed on crater proximity alone and MEASURED
     * ZERO ACROSS A WHOLE RIDE. The marquee is `condor-ride`, which fires at
     * the launch — and the launch is at the spawn, 104 m from the caldera,
     * against a 70 m falloff. Tracked over two minutes of flight the unsteered
     * bird never came closer than 95.4 m. So a row keyed on the crater is a row
     * that is dark for the exact moment it was written for: v25's finding
     * reproduced inside its own fix, which is the shape this project keeps
     * paying for and the reason a row gets measured before it is believed.
     *
     * So: 0.45 for being on the bird at all, which is the marquee and is
     * guaranteed, and the rest for closing on the cone — `thermal-peak` and
     * `crater-drop` both take the player there deliberately, so the top of the
     * range is reachable and earned. The falloff is the MOUNTAIN's radius, not
     * pastoCRATER_R: the bowl is 11 m across and a condor on a thermal circles
     * the cone tens of metres out.
     */
    craterGlow: function () {
      const c = game.condor;
      if (!c || !c.mounted || !game.capy) return 0;
      const p = game.capy.position;
      const dx = p.x - pastoGAL_X, dz = p.z - pastoGAL_Z;
      const d = Math.sqrt(dx * dx + dz * dz);
      const k = Math.max(0, 1 - d / pastoGAL_R);
      return 0.45 + 0.55 * k * k;
    },
    condorShot: function () {
      if (typeof game.frameShot !== 'function' || !game.capy) return false;
      const p = game.capy.position;
      game.frameShot({
        yaw: Math.atan2(p.x - pastoGAL_X, p.z - pastoGAL_Z),
        // Wide and flat: the cone is 62 m of relief and the launch is already
        // climbing, so a close shot is a picture of a capybara and a shot
        // looking down is a picture of the ground it just left.
        dist: 30, pitch: 12 * Math.PI / 180, raise: 5.0, hold: 3.4, over: true
      });
      return true;
    },
    // THE DRAWN SURFACE. It was pastoHeight, the analytic law, which is a
    // different surface from the one in the picture by up to half a metre --
    // see pastoMeshY. Everything that reads terrainHeight wants the picture.
    terrainHeight: pastoMeshY,
    // ---- WHERE THERE IS ACTUALLY A FLOOR (v20) ----------------------------
    // pastoHeight is an ANALYTIC law and answers for every point in the plane;
    // the four heightfield strips that back it with a rigid body cover exactly
    // this rectangle and not one metre more. Anything dropped outside it falls
    // for ever, because there is nothing out there to land on — and Galeras is
    // centred at z = -70 with a 70 m radius, so its own northern apron runs ten
    // metres past the north edge of the physics. condor.js is the only thing in
    // the game that can carry the player out there, and this is what it fences
    // itself in with; see the containment note in its edge branch.
    bounds() { return pastoBOUNDS; },
    slopeAt: pastoSlope,
    inZone: pastoInZone,
    navBlocked: pastoNavBlocked,
    randomPointIn: pastoRandomPointIn,
    thermals: pastoThermals,
    craterCentre: pastoCraterCentre,

    // ---- town (rounds 10-12) --------------------------------------------
    plazaY: 0,                    // the shelf is flat here by construction
    bell: pastoBell,              // { position, ropePosition, ring(), body }
    stalls: pastoStalls,          // filled in by the build; same array identity
    coffeePatio: pastoCoffeePatio,
    // La carroza. It MOVES — ask, never cache.
    carroza() { return pastoCarPos; },
    carrozaParked() { return pastoCarDwell > 0; },
    onCarroza() { return !!(pastoGame && pastoGame.capy && pastoCarAboard(pastoGame.capy.position)); },
    /** Knock down stall `i` (or the one nearest x,z if `i` is not a number). */
    collapseStall(i) {
      const st = typeof i === 'number' ? pastoStalls[i] : i;
      return st ? pastoCollapseStall(st) : false;
    },
    nearestStall(x, z) {
      let best = null, bd = Infinity;
      for (let k = 0; k < pastoStalls.length; k++) {
        const s = pastoStalls[k];
        const dx = s.x - x, dz = s.z - z;
        const d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = s; }
      }
      return best;
    },

    update(dt) {
      if (!pastoBuilt) return;
      if (!game.biome.isActive('pasto')) { pastoSfxQ.length = 0; return; }  // biome not live
      pastoSfxStep(game, dt);
      pastoUpdateSmoke(dt);
      pastoUpdateMotes(dt);
      pastoUpdateBell(dt);
      pastoUpdateStalls();
      pastoUpdateCarroza(game, dt);
      pastoUpdateTalc(game, dt);
      pastoUpdateSwifts(game, dt);
      pastoUpdateVoices(game, dt);
    },
  };
  game.pasto = api;
  return api;
}

function pastoBuild(game) {
  if (pastoBuilt) return;
  pastoBuilt = true;
  pastoRoot = new THREE.Group();
  pastoRoot.name = 'pasto';
  game.scene.add(pastoRoot);

  pastoRoot.add(pastoBuildTerrainMesh());
  pastoRoot.add(pastoBuildFarPeaks());
  pastoBuildGround(game);
  pastoRoot.add(pastoBuildSmoke());
  pastoRoot.add(pastoBuildMotes());
  pastoBuildFrailejones(pastoRoot);
  pastoBuildShrubs(pastoRoot);
  pastoBuildCoffee(pastoRoot);

  // --- the town, on the flattened shelf ---
  pastoRoot.add(pastoBuildCobbles());
  pastoBuildPlazaFurniture(game, pastoRoot);
  pastoBuildChurch(game, pastoRoot);
  pastoBuildBell(game, pastoRoot);
  pastoBuildSwifts(pastoRoot);
  pastoBuildMarket(game, pastoRoot);
  pastoBuildCarroza(game, pastoRoot);
  pastoRoot.add(pastoBuildTalc());
  pastoBuildStreet(game, pastoRoot);
  pastoBuildCoffeeFarm(game, pastoRoot);

  pastoApi = {
    // The biome streamer removes BODIES from the world but knows nothing about
    // CONSTRAINTS, so the bell's hinge has to be attached and detached by hand
    // or it would keep solving against a body that is no longer simulated.
    onEnter() {
      // THE STAGING HAS TO REPLAY. A second visit to Pasto — which the
      // departures board allows from anywhere — used to find every flake of
      // talc still hanging where it was when you left, and the float's ride
      // clock exactly where the last visit put it. The CHECKLIST stays ticked;
      // the plaza starts again.
      pastoTalcT = 0;
      pastoTalcLive = false;
      if (pastoTalcData && pastoTalcMesh) {
        for (let i = 0; i < pastoTALC_N; i++) {
          pastoTalcData[i * pastoTALC_STRIDE + 6] = 0;
          pastoTalcMesh.setMatrixAt(i, pastoXf(0, -900, 0, 0, 0, 0, 0.001, 0.001, 0.001));
        }
        pastoTalcMesh.instanceMatrix.needsUpdate = true;
      }
      pastoCarRideT = 0;
      pastoCarRideM = 0;
      pastoCarCheerT = 0;
      // ...and the three voices, on the same argument as the talc above: a
      // timer that ran down while the player was in Iceland fires on the first
      // frame back, so the mountain rumbles as you land.
      pastoCarBandT = rand(1.5, 3.5);
      pastoVentT = rand(4, 10);
      pastoNaveT = rand(4, 12);
      pastoBushT = 0;
      pastoBellSwing = 0; pastoBellRunT = 0;
      if (!pastoBellHinge) return;
      if (game.world.constraints.indexOf(pastoBellHinge) < 0) game.world.addConstraint(pastoBellHinge);
      // A freshly re-added hinge snaps its bodies into place on the first solve,
      // which without this would read as a phantom peal the moment you arrive.
      pastoBellRest();
    },
    onExit() {
      if (!pastoBellHinge) return;
      if (game.world.constraints.indexOf(pastoBellHinge) >= 0) game.world.removeConstraint(pastoBellHinge);
    },
  };
  pastoApi.onEnter();
}
