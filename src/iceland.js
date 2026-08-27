import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PALETTE, mat, rand, randInt, clamp, damp, lerp, grain, grainOwn, makeSolidIndex } from './shared.js';

// ===========================================================================
// CHAPTER 7 — ICELAND
//
// Six biomes in, the game had a problem it could not solve by building a
// seventh city: every place in it is somewhere a capybara can be A NUISANCE,
// and there is a ceiling on how many times that joke lands. Iceland is the
// answer, and it is built on three things nothing else here has.
//
//  1. IT IS NIGHT. The only one. Everything you have learned to read — the
//     shadow, the haze, the flat noon pastel — is turned down, and the world
//     is lit by windows, a low sun that never comes up, and eventually by the
//     sky itself. Arrival alone is a set piece.
//
//  2. THE GROUND STOPS HOLDING YOU. A glacier has no friction worth the name.
//     Every other chapter's movement is the same capybara at the same speed;
//     on the ice the animal becomes a toboggan that steers badly, and a
//     hundred and thirty metres of tongue is the longest single uninterrupted
//     THING in the game. This is the one genuinely new verb in seven chapters,
//     and biomes ask for it by publishing `groundSlip(x, z)` — see capybara.js.
//
//  3. THE CENTREPIECE IS NOT SOMETHING YOU DO TO SOMEBODY. Cali and Rio are
//     both "keep up with the band". Sydney, Pasto, Kyoto and Marrakech are all
//     "take that". The last two lines of this chapter's list are: sit still in
//     some hot water, and then look up. The aurora is the reward, the score
//     grows a choir when it lights, and the whole thing is gated on the one
//     verb the game has never once asked for — doing nothing, for seven
//     seconds, somewhere warm.
//
// The island those three things live on:
//
//         z = -196 ........ the ice cap. Flat, white, and the top of the run
//                    THE GLACIER, x -56..24, dropping 45 m over 118 m
//         z = -78 ......... the snout, and a jump straight into
//         z = -76..-26 .... the lagoon, with bergs on it
//         z = -24..20 ..... the geothermal field: Strokkur, and the hot spring
//         z = 20..68 ...... the lava field, moss, lupins, the road
//         z = 70..126 ..... REYKJAVIK. Hallgrimskirkja on the hill, the tin
//                    houses under it, the old harbour and the pier (the way out)
//         z > 128 ......... the North Atlantic
//         x 56..92 ........ the basalt cliff, and eleven hundred puffins
//
// Everything is prefixed `ice` (contract: the bundler flattens every module
// into one scope).
// ===========================================================================

// ---------------------------------------------------------------- geography --
const iceSEA_Y   = -1.0;
const iceSEA_Z   = 134;              // south of this is the North Atlantic
const iceSPAWN   = { x: 0, y: 1.4, z: 99 };
const icePYLSA   = { x: 8, z: 99 };                     // Baejarins Beztu
const iceCHURCH  = { x: -16, z: 62, h: 34 };            // Hallgrimskirkja
const iceORGAN   = { x: -16, z: 72 };                   // the console, at the door
const icePIER    = { x: 26, z: 128, head: 140 };        // the old harbour, and the way out
const iceCLIFF   = { x: 74, z: 116, r: 22, h: 19 };     // the basalt headland
const icePUFFIN  = { x: 70, z: 120 };
// ONE WIDE STREET, AND THE ROWS ARE TWENTY-SIX METRES APART.
//
// Written down rather than derived, and spaced against a number that has
// nothing to do with town planning: the camera. The rig sits 9.5 m behind the
// animal at 41 degrees, which is 7.2 m of HORIZONTAL setback, so a lane needs
// something like sixteen metres of clear air between building faces or the
// camera spends the chapter inside somebody's front room. The first two
// attempts were derived layouts with 14 m row spacing and the instrumented shot
// of the spawn is, both times, a photograph of the inside of a gable.
//
// So: two rows twenty-six metres apart with six-metre-deep houses, giving a
// twenty-metre lane; a back row for the skyline, which the camera never gets
// into; and the church on its hill behind all of it, where it belongs.
const iceROWS    = [86, 112];           // the two rows that line the street
const iceBACKROW = 74;                  // and one behind, for the skyline
const iceLANES   = [99];                // the street itself
const iceSTROKKUR= { x: 10, z: -4 };                    // the geyser that still goes
const iceGEYSIR  = { x: -14, z: 6 };                    // the one it is named after, dormant
const iceSPRING  = { x: -40, z: -10, r: 8.5 };          // and the hot pool between them
const iceLAG_Z0  = -78, iceLAG_Z1 = -26;                // the glacial lagoon
const iceLAG_HX  = 62;
const iceLAG_Y   = -1.0;
const iceSPRING_Y = -0.30;           // the hot pool sits higher than the lagoon

// --- the glacier -------------------------------------------------------------
// One long U-shaped tongue. The cross-section is a QUARTIC rather than a
// parabola on purpose: a parabola has no flat bottom, so the capybara ends up
// pinned in a gutter down the centre line and the run is a rail. A quartic is
// flat across the middle forty metres and then turns up hard at the edges, so
// you can wander the width of it and still be caught before you go over the
// side into the moraine.
const iceGL_XC   = -16;              // centre line
const iceGL_HW   = 40;               // half width of the ice
const iceGL_Z0   = -78;              // the snout
const iceGL_Z1   = -196;             // the top of the cap
const iceGL_RISE = 45;               // metres of climb between them
const iceGL_WALL = 11;               // how far the U turns up at the margin
// The moraine: a rock shelf up the east flank, which is the ONLY way to the
// top. It sits three metres proud of the ice so that stepping off it is a
// decision rather than an accident.
const iceMOR_X0  = 26, iceMOR_X1 = 42;
const iceSLIDE_START_Z = -172;       // north of here arms the timed run
const iceSLIDE_END_Z   = -82;        // south of here finishes it
const iceSLIDE_STALL_V = 3.4;        // m/s under which the run is stalling
const iceSLIDE_STALL_T = 1.7;        // s of stalling before it is abandoned

// --- Strokkur ----------------------------------------------------------------
// A real geyser is nine parts waiting. The cycle is deliberately long enough
// that a player who wanders off comes back to it, and the swell before it goes
// is a second and a half of unmistakable warning — the water domes up blue,
// which is exactly what it does, and is the only tell you get.
const iceGEY_QUIET = 9.0;
const iceGEY_SWELL = 1.6;
const iceGEY_BLOW  = 2.4;
const iceGEY_R     = 3.4;            // catchment: stand inside this and go up
const iceGEY_V     = 27;             // m/s straight up
const iceGEY_H     = 30;             // how far the column throws steam

const iceSOAK_R    = 7.0;            // how close to the middle of the pool counts
const iceSOAK_T    = 7.0;            // seconds of sitting still
const iceAUR_RISE  = 0.115;          // per second, so ignition takes ~9 s
const icePUFF_R    = 9.0;            // wheek inside this and the cliff empties

const icePUFFIN_N  = 150;
const iceHOUSE_N   = 46;
const iceSTAR_N    = 260;
const iceSTEAM_N   = 54;
const iceCURTAIN_N = 6;

// ---- WHERE THE VENTS ARE, DECIDED ONCE AND BEFORE ANYTHING IS BUILT --------
//
// The ground mesh is the first thing in iceBuild and the geothermal field is
// the sixth, so for as long as the vents were scattered with rand() inside
// their own builder the ground had no way of knowing where they were — and the
// whole basin was painted by the same bare `else` that paints an old lava
// field, i.e. it came out a LAWN. Sixty-odd metres of green with twenty-six
// black stacks standing on it, in the one part of the chapter the player
// crosses in every direction.
//
// The sites are laid out here instead, deterministically, so that both the
// ground and the geometry can ask the same question. A vent is not a thing
// standing ON the ground; it is a hole in ground that the vent has BLEACHED,
// and the bleach is much wider than the hole.
const iceVENT_SITES = (function () {
  const out = [];
  // a tiny LCG, seeded, so the field is the same every load and the painted
  // sinter lands exactly under the geometry
  let s = 20260824;
  const r = function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < 26; i++) {
    const a = r() * 6.283, rr = 15 + r() * 31;
    out.push({
      x: 10 + Math.cos(a) * rr, z: -4 + Math.sin(a) * rr,
      // A FUMAROLE IS NOT AN OIL DRUM. The first cut was 1.0-3.6 m tall and up
      // to 4.2 m across in iceMoraineDk — twenty-six black cylinders, taller
      // than the animal, on dark ground under a night sky. What that
      // photographs as is a tank farm. A fumarole is a low broken cone of
      // crusted rock with a bright mouth in it; three of them are allowed to
      // be a landmark and the rest are ankle-high.
      h: (i % 9 === 0) ? (1.5 + r() * 0.9) : (0.22 + r() * 0.42),
      r: 0.75 + r() * 0.85,
      sinter: 4.5 + r() * 5.5,          // how far the bleach reaches
      hot: 0.45 + r() * 0.55,
    });
  }
  return out;
})();
/** 0..1: how altered the ground at (x, z) is by the vents standing on it. */
function iceSinterAt(x, z) {
  let v = 0;
  for (let i = 0; i < iceVENT_SITES.length; i++) {
    const s = iceVENT_SITES[i];
    const dx = x - s.x, dz = z - s.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < s.sinter) {
      const t = 1 - d / s.sinter;
      v = Math.max(v, t * t * s.hot);
    }
  }
  return v;
}

// ------------------------------------------------------------------ scratch --
const iceV3 = new THREE.Vector3();
const iceV3b = new THREE.Vector3();   // the snowcat accessor, and nothing else
const iceQ  = new THREE.Quaternion();
const iceEu = new THREE.Euler();
const iceSc = new THREE.Vector3();
const iceM  = new THREE.Matrix4();

// ---------------------------------------------------------------- module -----
let iceGame = null;
let iceBuilt = false;
let iceRoot = null;
// The eight people who live here, kept so that addExchange can pair them up.
// See THE PEOPLE WHO LIVE HERE at the foot of iceBuild.
let iceLocPylsa = null, iceLocPier = null, iceLocStreet = null, iceLocChurch = null;
let iceLocSpring = null, iceLocCat = null, iceLocSheep = null, iceLocRack = null;
let iceTime = 0;

let iceSeaMesh = null, iceSeaAttr = null, iceRipT = 0;
let iceLagMesh = null, iceLagAttr = null;
let iceSpringMesh = null;
let iceSteam = null;
const iceSteamData = new Float32Array(iceSTEAM_N * 8);   // x,y,z,vx,vy,vz,life,scale
let iceStars = null, iceStarMat = null, iceSkyRig = null;
const iceCurtains = [];              // { mesh, matA, phase, base }
let icePuffinMesh = null;
const icePuffinData = new Float32Array(icePUFFIN_N * 8); // x,y,z,yaw,vx,vy,vz,state
// Where each of them was standing before it was shouted at. The flush used to
// be a ONE-WAY DOOR: `icePuffinDone` gated it, every bird was pushed to y=-400
// when its flight timer ran out, and the cliff the chapter frames was bare for
// the rest of the game. A colony comes back. So do these — see iceSettle.
const icePuffinHome = new Float32Array(icePUFFIN_N * 8);
let iceSettle = 0;                    // s until they are all back on the rock
let iceGeyCol = null, iceGeyDome = null;
let icePylsaGroup = null;
let iceBergGroup = null, iceBergBody = null;
const iceChimneys = [];              // x, y, z of every chimney with a fire in it
let iceVents = null;                 // x, y, z, r of every fumarole and mud pool
const iceLampPools = [];             // x, y, z of every sodium lamp's ground disc

// --- task / world state ---
let iceGeyPhase = 0, iceGeyT = 0, iceGeyFired = 0;
let iceAurora = 0, iceAuroraArmed = false;
let iceSoak = 0, iceSoakShown = false;
let iceSoakMark = 0;
// The marks for the overstay. See THE LONG SIT in iceUpdateSpring: the last
// one is at four minutes because somebody will, and when they do the game
// should have something to say about it.
const iceSOAK_MARKS = [
  [16,  'thirty-eight degrees. no plans.'],
  [32,  'half a minute of nothing. the sky is doing the work now.'],
  [58,  'a minute. somewhere a glacier is waiting and it can keep waiting.'],
  [95,  'you have now been in this pool longer than you spent in Venice.'],
  [150, 'two and a half minutes. the steam has stopped asking questions.'],
  [240, 'four minutes. this is, technically, the whole game.'],
];
let iceSlideT = -1, iceSlideStall = 0, iceSlideBest = 0;
let icePylsaDone = false, iceOrganDone = false, iceGeysirDone = false;
let icePuffinDone = false, iceSlideDone = false, iceSoakDone = false, iceAuroraDone = false;
let icePuffinsUp = 0;
let iceOrganRing = 0;
let iceAuroraHold = 0;              // s of the ignition still to run
let iceGeyRiding = false, iceGeyPeak = 0;
let iceAurLastApplied = -1;
const iceAurGreen = new THREE.Color(PALETTE.iceAurora2);
const iceAurBase = new THREE.Color(0xffffff);

// ============================================================== helpers ======
function iceXform(px, py, pz, rx, ry, rz, sx, sy, sz) {
  iceEu.set(rx, ry, rz, 'YXZ');
  iceQ.setFromEuler(iceEu);
  iceV3.set(px, py, pz);
  iceSc.set(sx, sy, sz);
  iceM.compose(iceV3, iceQ, iceSc);
  return iceM;
}

const iceG = { box: null, cyl6: null, cyl8: null, cyl4: null, cone6: null, cone4: null, sph6: null, tet: null, cyl16: null, disc: null, rock: null, quad: null };
function iceInitGeos() {
  if (iceG.box) return;
  iceG.box = new THREE.BoxGeometry(1, 1, 1);
  iceG.cyl6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
  iceG.cyl8 = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
  iceG.cyl4 = new THREE.CylinderGeometry(0.5, 0.5, 1, 4);
  iceG.cone6 = new THREE.ConeGeometry(0.5, 1, 6);
  iceG.cone4 = new THREE.ConeGeometry(0.5, 1, 4);
  iceG.sph6 = new THREE.SphereGeometry(0.5, 6, 4);
  iceG.tet = new THREE.TetrahedronGeometry(0.5);
  // sixteen sides, and it exists for one thing: the discs of sodium light on
  // the road, whose whole job is to have no visible edge (see iceBuildCity).
  iceG.cyl16 = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
  // A POOL OF LIGHT IS A FLAT THING AND IT WAS BEING DRAWN AS A DRUM.
  // Four sixteen-sided CYLINDERS per lamp is 64 triangles each and eleven
  // twelfths of every one of them is a wall you cannot see, on an object that
  // is two centimetres tall. A disc is sixteen. The saving buys twice as many
  // rings, which is the whole fix — see iceBuildCity.
  iceG.disc = new THREE.CircleGeometry(0.5, 16);
  iceG.disc.rotateX(-Math.PI / 2);
  // A BOULDER IS NOT A TRIANGLE. Two hundred and eighty-seven TetrahedronGeometry
  // instances squashed to 0.65 of their height, scattered up a hundred and sixty
  // metres of moraine that the player walks every single time they want another
  // go at the glacier — and from this camera a squashed tetrahedron is a flat
  // dark triangle lying on the ground. The instrumented shot of the moraine is
  // a grey ramp covered in what reads as litter. An icosahedron with its
  // vertices pushed about is twenty triangles and is a rock.
  // A FLAT QUAD LYING IN XZ. A blade of grass seen from above and below and
  // never from the side is 2 triangles, not 12 — the same argument as the
  // Sahara's sand ripples and the Drift's ferns. It is scaled and PITCHED UP
  // by its instance: a quad left near horizontal under this camera is a card.
  iceG.quad = new THREE.PlaneGeometry(1, 1);
  iceG.quad.rotateX(-Math.PI / 2);
  iceG.rock = new THREE.IcosahedronGeometry(0.5, 0);
  {
    const p = iceG.rock.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) {
      // a deterministic per-vertex nudge, so every instance is the same rock
      // and the variety comes from the scale and the two random rotations
      const k = 0.80 + 0.36 * (Math.sin(p[i] * 11.3 + p[i + 1] * 7.1 + p[i + 2] * 5.9) * 0.5 + 0.5);
      p[i] *= k; p[i + 1] *= k * 0.86; p[i + 2] *= k;
    }
    iceG.rock.attributes.position.needsUpdate = true;
    iceG.rock.computeVertexNormals();
  }
}

/** Vertex-coloured geometry merger — one draw call per merged batch. */
function iceMerger() {
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
    // CONTRACT: the merger takes FULL extents, CANNON.Box takes HALF.
    box(cx, cy, cz, sx, sy, sz, color, rx, ry, rz) {
      return M.add(iceG.box, iceXform(cx, cy, cz, rx || 0, ry || 0, rz || 0, sx, sy, sz), color);
    },
    cyl(cx, cy, cz, r, h, color, rx, ry, rz, seg) {
      const g = seg === 4 ? iceG.cyl4 : seg === 8 ? iceG.cyl8 : seg === 16 ? iceG.cyl16 : iceG.cyl6;
      return M.add(g, iceXform(cx, cy, cz, rx || 0, ry || 0, rz || 0, r * 2, h, r * 2), color);
    },
    cone(cx, cy, cz, r, h, color, rx, ry, rz, seg) {
      const g = seg === 4 ? iceG.cone4 : iceG.cone6;
      return M.add(g, iceXform(cx, cy, cz, rx || 0, ry || 0, rz || 0, r * 2, h, r * 2), color);
    },
    sph(cx, cy, cz, rx2, ry2, rz2, color) {
      return M.add(iceG.sph6, iceXform(cx, cy, cz, 0, 0, 0, rx2 * 2, ry2 * 2, rz2 * 2), color);
    },
    tet(cx, cy, cz, s, color, rx, ry, rz) {
      return M.add(iceG.tet, iceXform(cx, cy, cz, rx || 0, ry || 0, rz || 0, s, s, s), color);
    },
    /** An irregular lump — see iceG.rock. Twenty triangles instead of four, and
     *  the difference between a boulder and a paper dart. */
    lump(cx, cy, cz, sx, sy, sz, color, rx, ry, rz) {
      return M.add(iceG.rock, iceXform(cx, cy, cz, rx || 0, ry || 0, rz || 0, sx, sy, sz), color);
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
function iceVC() {
  return grain(mat(0xffffff, { vertexColors: true }),
               { scale: 0.42, amount: 0.075, warp: 0.55, near: 0.34, nearScale: 8 });
}
/** The same thing at ground strength, and flat: the ground is horizontal,
 *  so it wants no vertical shear in the sample at all. */
function iceVCG() {
  return grain(mat(0xffffff, { vertexColors: true }),
               { scale: 0.5, amount: 0.12, warp: 0, near: 0.80, nearScale: 7 });
}
function icePush9(l, px, py, pz, rx, ry, rz, sx, sy, sz) { l.push(px, py, pz, rx, ry, rz, sx, sy, sz); }
function iceInstance(root, geo, color, list, cast, recv, twoSided) {
  const n = list.length / 9;
  if (n < 1) return null;
  // DOUBLE-SIDED: a blade is a quad and half a field of them is seen from the
  // far side. Three flips the normal for back faces in the fragment shader, so
  // it lights correctly both ways for no second draw call.
  const im = new THREE.InstancedMesh(geo, twoSided ? mat(color, { side: THREE.DoubleSide }) : mat(color), n);
  for (let i = 0; i < n; i++) {
    const o = i * 9;
    im.setMatrixAt(i, iceXform(list[o], list[o + 1], list[o + 2], list[o + 3], list[o + 4],
                               list[o + 5], list[o + 6], list[o + 7], list[o + 8]));
  }
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  im.castShadow = !!cast;
  im.receiveShadow = !!recv;
  // ---- AND `cast === false` HAS TO SURVIVE THE TRAVERSE --------------------
  // registerShadowTarget answers with traverse(n => { if (n.isMesh) castShadow
  // = true }), and an InstancedMesh extends Mesh. Every batch in this file that
  // says false has been getting true four lines later since the chapter
  // shipped — which in a world about to carry four thousand pieces of moss is
  // the difference between a scatter pass that is free and one that doubles the
  // shadow budget. iceNoShadowOnGhosts reads this flag.
  if (!cast) im.userData.noShadow = true;
  root.add(im);
  return im;
}
/** Full extents in, half extents to CANNON — one convention per file. */
const iceSolids = makeSolidIndex();
function iceStaticBox(game, x, y, z, sx, sy, sz, ry) {
  iceSolids.add(x, y, z, sx * 0.5, sy * 0.5, sz * 0.5, ry);
  const b = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
  b.addShape(new CANNON.Box(new CANNON.Vec3(sx * 0.5, sy * 0.5, sz * 0.5)));
  b.position.set(x, y, z);
  if (ry) b.quaternion.setFromEuler(0, ry, 0);
  iceSyncBody(b);
  game.world.addBody(b);
  return b;
}
/**
 * MANY WALLS, ONE BODY — AND THIS CHAPTER WAS OVER THE LIMIT.
 *
 * Measured: 132 CANNON bodies against a hard budget of 130, and it is not close
 * to being one big thing. It is forty-six houses, thirty-four seracs, eighteen
 * fumaroles, eleven parked cars and five quay sheds — a hundred and fourteen
 * bodies that each carry exactly one Box, because `iceStaticBox` spends a whole
 * body per call. Nothing in the solver needs that; the berg raft has carried
 * sixteen shapes on one body since it was written, and the nav index is a
 * separate structure that does not care. One body per ROW of things.
 */
function iceStaticGroup(game) {
  const b = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
  let used = false;
  return {
    add(x, y, z, sx, sy, sz, ry) {
      iceSolids.add(x, y, z, sx * 0.5, sy * 0.5, sz * 0.5, ry);
      if (ry) {
        const q = new CANNON.Quaternion();
        q.setFromEuler(0, ry, 0);
        b.addShape(new CANNON.Box(new CANNON.Vec3(sx * 0.5, sy * 0.5, sz * 0.5)),
                   new CANNON.Vec3(x, y, z), q);
      } else {
        b.addShape(new CANNON.Box(new CANNON.Vec3(sx * 0.5, sy * 0.5, sz * 0.5)),
                   new CANNON.Vec3(x, y, z));
      }
      used = true;
      return this;
    },
    done() { if (used) { iceSyncBody(b); game.world.addBody(b); } return b; },
  };
}
/** Contract, "Rendering physics transforms": carry the history forward by hand. */
function iceSyncBody(b) {
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
  b.previousQuaternion.copy(b.quaternion);
  b.interpolatedQuaternion.copy(b.quaternion);
}

// ================================================================= TERRAIN ==
/** 0 at the snout, 1 at the top of the cap. */
function iceGlacierRamp(z) {
  return clamp((iceGL_Z0 - z) / (iceGL_Z0 - iceGL_Z1), 0, 1);
}

/**
 * Iceland's relief, analytic and cheap: called per frame by the camera
 * clearance, the sun frustum, the task beacon and — unusually — by the slide,
 * which asks it for a gradient sixty times a second.
 *
 * It is written as a chain of REGIONS rather than a sum of bumps, because the
 * glacier and the lagoon share an edge and a sum would put a shelf of ice
 * floating over the water there.
 */
function iceTerrain(x, z) {
  // --- north: the glacier and its moraine -----------------------------------
  if (z < iceGL_Z0) {
    const ramp = iceGlacierRamp(z);
    const base = 1 + ramp * iceGL_RISE;
    const dx = Math.abs(x - iceGL_XC);
    // ======================= THE VALLEY HAS A MOUTH ========================
    //
    // MEASURED, NOT GUESSED: a scripted walk from the bottom of the run to the
    // snowcat's bottom station gets to x = 39.4, z = -75.3 and stops there for
    // the rest of the attempt. The moraine shelf — "the ONLY way to the top" —
    // stood at 15.8 m at z = -80 while the lagoon shore two metres south of it
    // was at -3, so the shelf, the cairn, the `glacierTop` beacon and the whole
    // snowcat set piece were on a plateau with an eighteen-metre cliff round
    // it. The machine that exists to delete the walk up could not be boarded
    // from the bottom of the run it exists to serve.
    //
    // Every term north of the snout was full height the instant z crossed
    // iceGL_Z0, which is also why the instrumented shot from the geyser field
    // shows a fifty-metre grey wall standing across the whole picture with a
    // dead-flat top: a forty-seven-metre step inside one heightfield cell.
    //
    // One taper fixes all three, because all three are the same mistake. A
    // glacier's terminus is a wide low FAN — the tongue thins, the lateral
    // moraines die away into it, and the valley sides open out. So the U's
    // margin, the moraine shelf and the valley wall are all multiplied by a
    // smoothstep that is 0 at the snout and 1 by z = -112. The relationship
    // that matters is preserved everywhere it matters: the shelf stays exactly
    // three metres proud of the ice edge from z = -112 to the cap, which is
    // the whole length anybody ever steps between them.
    const foot = clamp((iceGL_Z0 - z) / 34, 0, 1);
    const mouth = foot * foot * (3 - 2 * foot);
    if (dx < iceGL_HW) {
      // the ice: flat across the middle, turning up hard at the margins, plus a
      // long slow swell down the length of it.
      //
      // The swell is not decoration. A glacier tongue modelled as a perfect
      // ramp has a CONSTANT SURFACE NORMAL, so every square metre of it takes
      // exactly the same amount of light, and under a blue-hour sky a hundred
      // and thirty metres of evenly-lit pale blue is indistinguishable from the
      // pale blue sky above it — the instrumented shot has thirty seracs
      // apparently floating in midair over a void. Two metres of roll gives the
      // surface somewhere to catch the light and somewhere to lose it, which is
      // the whole of what makes a shape read. It is also, incidentally, much
      // better to slide down.
      const t = dx / iceGL_HW;
      return base + iceGL_WALL * mouth * t * t * t * t
           + Math.sin(z * 0.085) * 1.15
           + Math.sin(x * 0.125 + z * 0.045) * 0.85;
    }
    if (x >= iceMOR_X0 && x <= iceMOR_X1) {
      // the moraine shelf — the walk up, three metres proud of the ice edge
      return base + (iceGL_WALL + 3) * mouth;
    }
    // ---- the valley walls ------------------------------------------------
    // THEY WERE ONE PLANE AND THEY WERE THE WHOLE NORTHERN HORIZON.
    //
    // `clamp((dx - iceGL_HW) * 1.25, 0, 46)` is a straight ramp to a flat cap,
    // which means a fifty-metre face at a constant angle with a DEAD LEVEL
    // crest running the entire width of the biome — and the instrumented shot
    // from the geyser field is a photograph of a grey soundstage flat with a
    // lagoon in front of it. No amount of vertex colour fixes that, because
    // the thing that is wrong is the shape.
    //
    // A glacial valley side is buttresses and gullies: spurs of rock running
    // down it, notches between them, and a crest that goes up and down.  Two
    // sine terms in z give both, and the crest gets its own so the skyline is
    // never a ruled line.  The spur term is faded in with height so the foot of
    // the wall still meets the ice cleanly.
    const up = clamp((dx - iceGL_HW) * 1.15, 0, 40);
    const grip = clamp(up / 14, 0, 1);
    const spur = (Math.sin(z * 0.088) * 3.6 + Math.sin(z * 0.037 + dx * 0.06) * 5.4
                + Math.sin(z * 0.021 - dx * 0.02) * 3.0) * grip;
    const crest = 27 + Math.sin(z * 0.041) * 9 + Math.sin(z * 0.015 + 1.7) * 7;
    return base + (iceGL_WALL + Math.min(up + spur, crest)) * mouth;
  }

  // --- the pier ------------------------------------------------------------
  // A causeway of terrain under the decking, eight metres wide and a metre
  // proud of the harbour. Nobody ever sees it — it is under the boards and
  // under the waterline either side — and it is here so that the analytic
  // ground, the heightfield and the visible deck all agree about where the
  // floor is. They did not: fall off the pier and the backstop pulled the
  // capybara down to the seabed and held it there, dry, three metres under.
  if (Math.abs(x - icePIER.x) < 4.2 && z > icePIER.z - 6 && z < icePIER.head + 2) return 1.0;

  let y = 0;

  // --- the lagoon basin ------------------------------------------------------
  if (z < iceLAG_Z1 && Math.abs(x) < iceLAG_HX + 10) {
    const tz = clamp(Math.min(z - iceLAG_Z0, iceLAG_Z1 - z) / 9, 0, 1);
    const tx = clamp((iceLAG_HX - Math.abs(x)) / 9, 0, 1);
    y = lerp(0.6, -7.5, tz * tx);
  }

  // --- the hot pool: a shallow bowl with a raised silica rim -----------------
  const hx = x - iceSPRING.x, hz = z - iceSPRING.z;
  const hd = Math.sqrt(hx * hx + hz * hz);
  if (hd < iceSPRING.r + 4) {
    if (hd < iceSPRING.r) y = lerp(-1.7, 0.35, clamp(hd / iceSPRING.r, 0, 1) ** 2);
    else y = lerp(0.35, 0, (hd - iceSPRING.r) / 4);
  }

  // --- Skolavorduholt: the hill the church stands on -------------------------
  const cx = (x - iceCHURCH.x) * 0.78, cz = z - iceCHURCH.z;
  const cd = Math.sqrt(cx * cx + cz * cz);
  if (cd < 30) y += 8 * (0.5 + 0.5 * Math.cos(cd / 30 * Math.PI));

  // --- the basalt headland, south-east ---------------------------------------
  const bx = x - iceCLIFF.x, bz = z - iceCLIFF.z;
  const bd = Math.sqrt(bx * bx + bz * bz);
  if (bd < iceCLIFF.r) {
    // a table, not a dome: basalt breaks square and the top has to be walkable
    y += iceCLIFF.h * clamp((iceCLIFF.r - bd) / 7, 0, 1);
  }

  // --- the sea ---------------------------------------------------------------
  if (z > iceSEA_Z && bd > iceCLIFF.r) {
    y = Math.min(y, iceSEA_Y - clamp((z - iceSEA_Z) * 0.20, 0, 14));
  }

  // --- the geothermal basin is a touch below the lava field ------------------
  if (z > -26 && z < 22) y -= 0.6 * clamp(1 - Math.abs(z + 2) / 24, 0, 1);

  return y;
}

function iceSlope(x, z) {
  const h = 1.5;
  return Math.sqrt(
    Math.pow(iceTerrain(x + h, z) - iceTerrain(x - h, z), 2) +
    Math.pow(iceTerrain(x, z + h) - iceTerrain(x, z - h), 2)) / (2 * h);
}

/**
 * HOW SLIPPERY IT IS UNDER (x, z), 0..1. This is the only new thing the
 * capybara has learned in seven chapters and the whole chapter is built on it.
 *
 * 1 on the ice, 0 everywhere else, with a two-metre feather at the margin so
 * stepping off the moraine is a slide rather than a state change. It has to be
 * as cheap as terrainHeight — capybara.js asks every frame.
 */
function iceGroundSlip(x, z) {
  if (z >= iceGL_Z0 - 2) return 0;
  const dx = Math.abs(x - iceGL_XC);
  if (dx > iceGL_HW) return 0;
  const edge = clamp((iceGL_HW - dx) / 2.5, 0, 1);
  const foot = clamp((iceGL_Z0 - z) / 2.5, 0, 1);
  return edge * foot;
}

/**
 * A MONOTONE SQUEEZE IN X. Same trick as Pasto, the Palawan seabed and Rio's
 * ground: warp the parameter rather than shrinking the grid. `k < 1` keeps it
 * monotone and s = 0 / 1 map to themselves, so the mesh still ends exactly
 * where the world does.
 *
 * Only in x. Iceland is a LONG country — the glacier is at z = -196 and the
 * pier head at z = 140, and the player uses all of it — so squeezing z would
 * starve one end or the other. But in x the whole chapter lives between about
 * -120 and +130 out of a 460 m sheet, and a quarter of every row was being
 * spent on ocean and on the backs of the valley walls.
 */
function iceWarp(u, c, k) {
  if (u <= c) { const t = c > 0 ? (c - u) / c : 0; return c - c * (t * (1 - k) + k * t * t * t); }
  const t = (u - c) / (1 - c);
  return c + (1 - c) * (t * (1 - k) + k * t * t * t);
}

function iceBuildGroundMesh() {
  const X0 = -230, X1 = 230, Z0 = -230, Z1 = 200;
  const NX = 86, NZ = 104;
  const g = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0, NX, NZ);
  g.rotateX(-Math.PI / 2);
  g.translate((X0 + X1) * 0.5, 0, (Z0 + Z1) * 0.5);
  {
    const q = g.attributes.position.array;
    for (let i = 0; i < q.length; i += 3) {
      q[i] = X0 + (X1 - X0) * iceWarp((q[i] - X0) / (X1 - X0), 0.52, 0.50);
    }
  }
  const p = g.attributes.position.array;
  const col = new Float32Array(p.length);
  const c = new THREE.Color();
  const glacier = new THREE.Color(PALETTE.iceGlacier);
  const glacierD = new THREE.Color(PALETTE.iceGlacierDp);
  const snow = new THREE.Color(PALETTE.iceSnow);
  const moraine = new THREE.Color(PALETTE.iceMoraine);
  const moraineD = new THREE.Color(PALETTE.iceMoraineDk);
  const lava = new THREE.Color(PALETTE.iceLava);
  const moss = new THREE.Color(PALETTE.iceMoss);
  const mossP = new THREE.Color(PALETTE.iceMossPale);
  const basalt = new THREE.Color(PALETTE.iceBasalt);
  const rim = new THREE.Color(PALETTE.iceGeoRim);
  const sinter = new THREE.Color(PALETTE.iceSinter);
  const sulphur = new THREE.Color(PALETTE.iceSulphur);
  const iron = new THREE.Color(PALETTE.iceIron);
  const clay = new THREE.Color(PALETTE.iceClay);
  const base = new THREE.Color();
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i], z = p[i + 2];
    const y = iceTerrain(x, z);
    p[i + 1] = y;
    const slip = iceGroundSlip(x, z);
    if (slip > 0.02) {
      // the ice. Crevasse striping runs ACROSS the tongue, because that is the
      // way a glacier actually cracks — it is being stretched down the hill.
      const crack = Math.abs(Math.sin(z * 0.19 + Math.sin(x * 0.05) * 1.4));
      c.copy(glacier).lerp(glacierD, clamp((1 - crack) * 1.7 - 0.5, 0, 1));
      // and the crevasses go all the way to the blue you only get a metre down
      if (crack < 0.12) c.lerp(new THREE.Color(PALETTE.iceGlacierBl), (0.12 - crack) * 6);
      // ---- FOLIATION, WHICH IS THE ONLY HONEST WAY TO TEXTURE A GLACIER ----
      // Ice that has come round a bend arrives banded: alternating layers of
      // bubbly white and clear blue, arced across the tongue, and they are what
      // gives a hundred and thirty metres of white surface any optical flow at
      // all when you are sliding down it at fifteen metres a second. Two goes
      // at drawing this as GEOMETRY read as a barcode and then as a scatter of
      // planks (see iceBuildFlora). In the vertex colours it costs nothing, it
      // is at exactly the scale the mesh can carry, and it can never read as an
      // object lying on the ice — which is the failure mode every version of it
      // in geometry had.
      const arc = z + Math.abs(x - iceGL_XC) * Math.abs(x - iceGL_XC) * 0.010;
      const fol = Math.sin(arc * 0.42) * 0.5 + 0.5;
      c.lerp(snow, fol * fol * 0.36);
      c.lerp(glacierD, clamp((0.35 - fol) * 0.9, 0, 0.30));
      c.lerp(snow, clamp((y - 20) / 34, 0, 0.55));
    } else if (z < iceGL_Z0) {
      // THE VALLEY WALL WAS A GREY SOUNDSTAGE FLAT.
      //
      // Everything north of the lagoon that is not ice is one expression —
      // moraine lerped toward moraineD on a sine of (x, z) — and the wall it
      // paints is fifty-eight metres of NEARLY VERTICAL ground. A sine of x
      // and z varies almost not at all up a vertical face, so the whole
      // northern horizon of the chapter came out as a single unbroken grey,
      // which the instrumented shot from the geyser field shows as a painted
      // backdrop with the lagoon in front of it.
      //
      // Three things fix it, all of them free. STRATA, banded in y rather than
      // in x and z, because that is the axis a cliff actually varies along and
      // Iceland's is layer on layer of basalt flows. A SNOW LINE, hard rather
      // than a lerp over thirty metres, because snow lies where it lies. And
      // the wet dark band at the foot where the meltwater runs.
      const band = Math.sin(y * 0.42) * 0.5 + 0.5;
      c.copy(moraine).lerp(moraineD, clamp(band * 0.8 + Math.sin(x * 0.11 + z * 0.07) * 0.2, 0, 1));
      if (band > 0.72) c.lerp(basalt, (band - 0.72) * 1.5);
      // the snow line, with a ragged edge on it
      const line = 26 + Math.sin(x * 0.07) * 5 + Math.sin(z * 0.09) * 4;
      if (y > line) c.lerp(snow, clamp((y - line) / 9, 0, 0.82));
      // and the dark wet foot, where everything coming off the ice ends up
      if (y < 6) c.lerp(basalt, clamp((6 - y) / 7, 0, 0.45));
    } else if (z < iceLAG_Z1 && y < -0.4) {
      c.copy(basalt).lerp(moraineD, 0.4);              // the lagoon floor
    } else {
      const hx = x - iceSPRING.x, hz = z - iceSPRING.z;
      const hd = Math.sqrt(hx * hx + hz * hz);
      if (hd < iceSPRING.r + 4.5) {
        c.copy(rim).lerp(mossP, clamp((hd - iceSPRING.r) / 5, 0, 0.5));
      } else if (z > iceSEA_Z - 2) {
        c.copy(basalt);                                 // the black beach
      } else {
        // AN OLD LAVA FIELD IS BLACK WITH MOSS ON IT, NOT A LAWN. The first
        // pass lerped 85% of the way to the moss colour and, under a blue night
        // hemisphere, the whole country came out the colour of an army blanket.
        // Moss on aa lava grows in PATCHES with bare rock between them, so this
        // is a much lower base mix with a hard-ish threshold on top of it — the
        // green is now the exception, which is what makes it worth having.
        const m = clamp(Math.sin(x * 0.043) * Math.sin(z * 0.037) * 0.5 + 0.5, 0, 1);
        c.copy(lava).lerp(basalt, 0.20);
        if (m > 0.55) c.lerp(moss, (m - 0.55) * 1.7);
        if (m > 0.86) c.lerp(mossP, (m - 0.86) * 2.4);
      }
      // ---- AND THE HIGH-TEMPERATURE FIELD IS NOT ANY OF THOSE THINGS ------
      //
      // Everything between the lagoon and the lava was falling through the
      // bare `else` above, which is the moss-on-aa rule — so the geyser basin,
      // the one piece of ground the chapter walks you across in every
      // direction, was an ARMY BLANKET with a hot pool and twenty-six vents
      // sitting on top of it. Exactly the shape of Rio's beach-sand `else`
      // painting the whole city shelf.
      //
      // A hverasvaedi is ground that boiling water has taken to pieces. It
      // bleaches to silica white where the water is at the surface, crusts
      // sulphur-yellow round anything still venting, and dries to iron-red
      // over the whole margin. It also has NO PLANTS ON IT, which is the half
      // the eye actually reads at this camera: the green has to stop.
      //
      // The falloff is deliberately wide and soft-edged. Every earlier attempt
      // at ground detail in this chapter that had a RADIUS in it came out as a
      // disc with a rim; a basin is a stain, so this is a squared falloff over
      // sixty metres with two incommensurable waves cut into it and no test
      // anywhere that a polygon edge can land on.
      {
        const gx = (x - 4) / 62, gz = (z + 2) / 34;
        let g0 = 1 - (gx * gx + gz * gz);
        if (g0 > 0) {
          // the shore of the lagoon and the sea both cut it off, so the basin
          // is a basin rather than a wash across the whole chapter
          g0 *= clamp((z - iceLAG_Z1 - 2) / 12, 0, 1) * clamp((44 - z) / 16, 0, 1);
          const wob = Math.sin(x * 0.081 + z * 0.037) * 0.5 +
                      Math.sin(x * 0.031 - z * 0.093 + 1.7) * 0.35;
          const g = clamp(g0 * 1.25 + wob * 0.22, 0, 1);
          if (g > 0.01) {
            // the base of the basin: dried grey-brown clay with iron in it
            base.copy(c);
            // A HVERASVAEDI IS PALE. First cut had the whole basin at
            // clay->iron 0.35..0.80, and the render is a red-brown desert with
            // a glacier at the end of it. Boiled ground is grey-buff with
            // orange only where the run-off has dried, so the base is mostly
            // bleached and the iron is a STREAK.
            c.copy(clay).lerp(sinter, 0.42);
            c.lerp(iron, clamp((wob - 0.15) * 0.85, 0, 0.55));
            // and the sinter, which is where the vents have been running
            const s = iceSinterAt(x, z);
            if (s > 0) {
              c.lerp(sulphur, clamp(s * 1.5, 0, 0.62));
              c.lerp(sinter, clamp((s - 0.30) * 1.8, 0, 0.85));
            }
            // the wettest ground — the run-off lines between Strokkur, the old
            // geysir and the pool — goes palest of all
            const wet = Math.max(
              1 - Math.hypot(x - iceSTROKKUR.x, z - iceSTROKKUR.z) / 22,
              1 - Math.hypot(x - iceGEYSIR.x, z - iceGEYSIR.z) / 20,
              1 - Math.hypot(x - iceSPRING.x, z - iceSPRING.z) / 19);
            if (wet > 0) c.lerp(sinter, clamp(wet * wet * 1.1, 0, 0.8));
            // and it fades into whatever the ground already was at the margin
            c.lerp(base, 1 - clamp(g * 1.35, 0, 1));
          }
        }
      }
    }
    col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, iceVCG());
  m.receiveShadow = true;
  m.frustumCulled = false;
  return m;
}

/**
 * MIND WHICH WAY THE SECOND AXIS RUNS — see CONTRACT.md and rio.js. The body is
 * anchored at the FAR z edge and j walks BACK toward Z0, or the biome ends up
 * with its entire collision floor several hundred metres south of the world and
 * nothing but the capybara's own analytic backstop holding anything up.
 *
 * Sampled at 5 m, which matters more here than anywhere: the glacier is a
 * twenty-degree ramp and a coarse heightfield turns a smooth slide into a
 * staircase the animal trips down.
 */
function iceBuildGroundBody(game) {
  const NX = 92, NZ = 86, X0 = -230, Z0 = -230, EL = 5;
  const Z1 = Z0 + NZ * EL;
  const data = [];
  for (let i = 0; i <= NX; i++) {
    const row = [];
    for (let j = 0; j <= NZ; j++) row.push(iceTerrain(X0 + i * EL, Z1 - j * EL));
    data.push(row);
  }
  const hf = new CANNON.Heightfield(data, { elementSize: EL });
  const b = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
  b.addShape(hf);
  b.position.set(X0, 0, Z1);
  b.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  iceSyncBody(b);
  game.world.addBody(b);
}

// ================================================================== WATER ===
function iceBuildSea() {
  const g = new THREE.PlaneGeometry(520, 190, 64, 40);
  g.rotateX(-Math.PI / 2);
  g.translate(0, iceSEA_Y, iceSEA_Z + 88);
  const p = g.attributes.position.array;
  const col = new Float32Array(p.length);
  // THE BAY WAS THE BRIGHTEST THING IN THE FRAME AT MIDNIGHT.
  //
  // iceWater and iceWaterDeep are honest daylight colours and the lagoon they
  // were written for sits under a glacier that reflects whatever light there
  // is. The North Atlantic at half past eleven at night is not that: the
  // instrumented shot of the old harbour has a bright cyan strip along the
  // bottom of a frame whose brightest object is supposed to be a lit wheelhouse
  // window. Taken down toward the night sky — which is also what makes the
  // aurora's green, the whole point of the chapter, read on it.
  const c = new THREE.Color(), near = new THREE.Color(PALETTE.iceWater), far = new THREE.Color(PALETTE.iceWaterDeep);
  const night = new THREE.Color(PALETTE.iceSkyNight);
  near.lerp(night, 0.50);
  far.lerp(night, 0.64);
  for (let i = 0; i < p.length; i += 3) {
    c.copy(near).lerp(far, clamp((p[i + 2] - iceSEA_Z) / 130, 0, 1));
    col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  // A PRIVATE material, not mat()'s cached one: the aurora lerps this
  // material's colour every frame, and the cache key here is identical to the
  // Río Cali's — sharing the instance left Cali's river aurora-green forever.
  // Grained BEFORE the clone, so the aurora still owns its own instance.
  const m = new THREE.Mesh(g, grainOwn(mat(0xffffff, { vertexColors: true, transparent: true, opacity: 0.9 }),
    { scale: 0.45, amount: 0.05, warp: 0,
      sparkle: 0.26, sparkleScale: 1.2, sparkleSpeed: 0.24, sparkleCut: 0.68,
      sparkleColor: PALETTE.iceSkyLow }));
  m.receiveShadow = true;
  m.frustumCulled = false;
  iceSeaAttr = g.attributes.position;
  iceSeaMesh = m;
  return m;
}

function iceBuildLagoon(root) {
  const g = new THREE.PlaneGeometry(iceLAG_HX * 2, iceLAG_Z1 - iceLAG_Z0, 48, 34);
  g.rotateX(-Math.PI / 2);
  g.translate(0, iceLAG_Y, (iceLAG_Z0 + iceLAG_Z1) * 0.5);
  const p = g.attributes.position.array;
  const col = new Float32Array(p.length);
  const c = new THREE.Color(), a = new THREE.Color(PALETTE.iceWater), b = new THREE.Color(PALETTE.iceWaterDeep);
  const berg = new THREE.Color(PALETTE.iceBerg);
  for (let i = 0; i < p.length; i += 3) {
    // meltwater is milky where it comes off the ice and clears southward
    c.copy(b).lerp(a, clamp((p[i + 2] - iceLAG_Z0) / 40, 0, 1));
    c.lerp(berg, clamp(1 - (p[i + 2] - iceLAG_Z0) / 16, 0, 0.35));
    col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, grain(mat(0xffffff, { vertexColors: true, transparent: true, opacity: 0.88 }),
    { scale: 0.5, amount: 0.05, warp: 0,
      sparkle: 0.22, sparkleScale: 1.4, sparkleSpeed: 0.16, sparkleCut: 0.69,
      sparkleColor: PALETTE.iceSkyLow }));
  m.receiveShadow = true;
  iceLagAttr = g.attributes.position;
  iceLagMesh = m;
  root.add(m);

  // the bergs. Calved off the snout and drifting south, and they are the reason
  // the jump off the end of the glacier is worth taking rather than survivable.
  const M = iceMerger();
  // The bergs are the reason the jump off the end of the glacier is worth
  // taking, and they were geometry only: sixteen lumps of ice up to six and a
  // half metres across that a swimming capybara went straight through. One
  // KINEMATIC body carries all of them, because the group itself drifts (see
  // update) and a static collider under a moving drawing is worse than none.
  const bb = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC,
    material: (iceGame && iceGame.mats && iceGame.mats.ground) || undefined });
  for (let i = 0; i < 16; i++) {
    const x = rand(-iceLAG_HX + 8, iceLAG_HX - 8);
    const z = rand(iceLAG_Z0 + 4, iceLAG_Z1 - 6);
    const s = rand(2.2, 6.5);
    M.tet(x, iceLAG_Y + s * 0.22, z, s, i % 4 ? PALETTE.iceBerg : PALETTE.iceGlacierBl, 0, rand(0, 6.28), rand(-0.2, 0.2));
    M.tet(x + rand(-2, 2), iceLAG_Y + s * 0.1, z + rand(-2, 2), s * 0.6, PALETTE.iceGlacier, 0, rand(0, 6.28), 0);
    // A TETRAHEDRON IS A HAT, NOT A BERG. Nine tenths of one is underwater and
    // the tenth that is not has a WATERLINE on it — a flat pale band where the
    // swell has been washing it, which is the only thing that makes a lump of
    // white read as floating rather than as sitting on a blue floor.
    M.box(x, iceLAG_Y + 0.06, z, s * 0.74, 0.12, s * 0.74, PALETTE.iceSnow, 0, rand(0, 1.5), 0);
    bb.addShape(new CANNON.Box(new CANNON.Vec3(s * 0.30, s * 0.30, s * 0.30)),
                new CANNON.Vec3(x, iceLAG_Y + s * 0.20, z));
  }
  // ---- AND A SHORE TO PUT IT IN -------------------------------------------
  // THE LAGOON WAS A BLUE RECTANGLE AND YOU COULD SEE ALL FOUR CORNERS OF IT.
  // A PlaneGeometry laid flat on ground that does not end where the plane does
  // has a ruled edge, and the shot from the geyser field has two of them
  // running dead straight across the middle of the picture. Nothing about the
  // water itself fixes that — what hides a waterline is a BANK. Black sand and
  // moraine boulders round three sides, irregular, drawn just proud of the
  // plane's edge so the edge is never the thing you are looking at.
  for (let i = 0; i < 130; i++) {
    let x, z;
    if (i % 5 === 0) {
      // the south shore, which is the one you walk along
      x = rand(-iceLAG_HX - 3, iceLAG_HX + 3);
      z = iceLAG_Z1 + rand(-1.6, 2.2);
    } else if (i % 5 === 1) {
      // and the north one, at the foot of the ice
      x = rand(-iceLAG_HX - 3, iceLAG_HX + 3);
      z = iceLAG_Z0 + rand(-2.0, 1.8);
    } else {
      // the two ends
      x = (i % 2 ? 1 : -1) * (iceLAG_HX + rand(-2.4, 2.0));
      z = rand(iceLAG_Z0, iceLAG_Z1);
    }
    const s = rand(0.9, 3.4);
    M.sph(x, iceLAG_Y + rand(-0.25, 0.30), z, s, s * rand(0.22, 0.42), s * rand(0.7, 1.3),
      i % 4 === 0 ? PALETTE.iceBasaltDk : i % 4 === 1 ? PALETTE.iceMoraineDk : PALETTE.iceBasalt);
  }
  // and the growlers: the small stuff that has come off the bergs and washed
  // up on the black sand, which is the whole reason anybody goes there
  // A GROWLER IS A LUMP OF ICE, NOT A PAPER DART. Thirty-four squashed
  // tetrahedra washed up on black sand photograph as folded card: four faces,
  // three of which are visible at once, all of them flat. The diamonds on
  // Jokulsarlon's beach are rounded and wet and they are the whole reason
  // anybody stands there.
  for (let i = 0; i < 44; i++) {
    const x = rand(-iceLAG_HX + 4, iceLAG_HX - 4);
    const z = iceLAG_Z1 + rand(-0.6, 3.8);
    const s = rand(0.4, 1.7);
    M.lump(x, iceLAG_Y + s * 0.20, z, s, s * rand(0.6, 1.0), s * rand(0.7, 1.3),
      i % 3 ? PALETTE.iceBerg : PALETTE.iceGlacierBl,
      rand(-0.3, 0.3), rand(0, 6.28), rand(-0.3, 0.3));
    // the wet foot, which is what makes a lump of ice on a black beach read as
    // a lump of ice on a black beach
    if (i % 2 === 0) {
      M.cyl(x, iceLAG_Y + 0.03, z, s * 0.8, 0.05, PALETTE.iceGlacierDp, 0, rand(0, 3), 0, 6);
    }
  }
  bb.allowSleep = false;
  bb.position.set(0, 0, 0);
  iceSyncBody(bb);
  if (iceGame) iceGame.world.addBody(bb);
  iceBergBody = bb;
  const bm = new THREE.Mesh(M.build(), iceVC());
  bm.castShadow = true; bm.receiveShadow = true;
  iceBergGroup = bm;
  root.add(bm);
}

function iceBuildSpring(root) {
  // NOT A CIRCLE. A twenty-six-sided disc of flat cyan on flat tan reads as a
  // municipal swimming pool, which is the one thing a geothermal pool in the
  // middle of a lava field is not: they are puddles in broken ground and their
  // outline is a scribble. Same vertex count, every rim vertex pushed in or
  // out on its own — and the silica boulders in iceBuildGeothermal then sit on
  // an edge that is already irregular instead of decorating a compass circle.
  const g = new THREE.CircleGeometry(iceSPRING.r + 0.3, 26);
  {
    const p = g.attributes.position.array;
    for (let i = 3; i < p.length; i += 3) {         // vertex 0 is the centre
      const a = Math.atan2(p[i + 1], p[i]);
      const k = 1 + Math.sin(a * 3.1) * 0.13 + Math.sin(a * 5.7 + 1.3) * 0.09
                  + Math.sin(a * 1.9 - 0.6) * 0.07;
      p[i] *= k; p[i + 1] *= k;
    }
    g.attributes.position.needsUpdate = true;
  }
  // ---- AND IT IS NOT ONE COLOUR ------------------------------------------
  // A high-temperature pool is milk-white at the edge, where the silica has
  // come out of solution in the shallows, and goes to a deep blue over the
  // vent. Seventeen metres of one flat cyan is a paddling pool; the gradient
  // is a vertex colour and costs nothing.
  {
    const p2 = g.attributes.position.array;
    const col = new Float32Array(p2.length);
    const c = new THREE.Color(), deep = new THREE.Color(PALETTE.iceGeoBlue);
    const edge = new THREE.Color(PALETTE.iceGeoRim);
    const R2 = iceSPRING.r + 0.3;
    for (let i = 0; i < p2.length; i += 3) {
      const d = Math.hypot(p2[i], p2[i + 1]) / R2;
      c.copy(deep).lerp(edge, clamp((d - 0.42) * 1.35, 0, 0.72));
      col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  g.rotateX(-Math.PI / 2);
  g.translate(iceSPRING.x, iceSPRING_Y, iceSPRING.z);
  // A geothermal pool is a colour nothing else in this game is allowed to be —
  // it is silica in suspension, not depth, and it does not read as "water" at
  // all until there is steam standing over it.
  // A GEOTHERMAL POOL AT MIDNIGHT IS THE ONE WARM THING IN THE COUNTRY, and a
  // plain Lambert under a night hemisphere is nearly black. A little emissive,
  // the same law the windows and the beacon use — and the aurora still owns
  // .color, which is what iceUpdate lerps every frame once the sky is up.
  const m = new THREE.Mesh(g, mat(0xffffff, {
    vertexColors: true, transparent: true, opacity: 0.94,
    // AND NOT MUCH OF IT. At 0.34 the pool came back as a lightbox — a slab of
    // swimming-pool cyan filling half the frame, which is the overcorrection
    // this file makes every time it fixes something by adding light. A quarter
    // of that is a pool that glows; the rest was a pool that shouts.
    emissive: PALETTE.iceGeoBlue, emissiveIntensity: 0.12,
  }));
  m.receiveShadow = true;
  m.castShadow = false;
  iceSpringMesh = m;
  root.add(m);
}

/** The surface height at (x, z) — three separate bodies of water, one query. */
function iceSurfaceY(x, z) {
  const hx = x - iceSPRING.x, hz = z - iceSPRING.z;
  if (hx * hx + hz * hz < iceSPRING.r * iceSPRING.r) {
    return iceSPRING_Y + Math.sin(iceTime * 0.9 + x * 0.4) * 0.03;
  }
  if (z < iceLAG_Z1) return iceLAG_Y + Math.sin(z * 0.13 + iceTime * 0.7) * 0.09;
  return iceSEA_Y + Math.sin(z * 0.10 + iceTime * 1.1) * 0.20 + Math.sin(x * 0.06 - iceTime * 0.7) * 0.09;
}

function iceIsOverWater(x, z) {
  // the pier is decking over the harbour, and you do not swim on decking
  if (Math.abs(x - icePIER.x) < 3.2 && z > icePIER.z - 2 && z < icePIER.head + 1) return false;
  const hx = x - iceSPRING.x, hz = z - iceSPRING.z;
  if (hx * hx + hz * hz < iceSPRING.r * iceSPRING.r) return true;
  if (z > iceSEA_Z) {
    const bx = x - iceCLIFF.x, bz = z - iceCLIFF.z;
    if (bx * bx + bz * bz < iceCLIFF.r * iceCLIFF.r) return false;   // the headland
    return true;
  }
  if (z > iceLAG_Z0 + 1 && z < iceLAG_Z1 - 1 && Math.abs(x) < iceLAG_HX - 2) return true;
  return false;
}

/**
 * A POOL OF LIGHT HAS NO STEPS IN IT.
 *
 * Three goes at this now. Three eight-sided cylinders read as a hard octagon.
 * Four sixteen-sided ones read as a bullseye — the instrumented shot of the
 * street has a dozen of them and every one shows three concentric bands with a
 * solid disc in the middle. Eight flat discs is better and is STILL banded,
 * because the thing that is wrong was never the number of rings: it is that
 * each ring is one flat colour, so however many you draw there is a step at
 * every boundary.
 *
 * The falloff has to live in the VERTEX COLOURS. Four concentric rings of
 * sixteen segments, brightness written per vertex on a squared curve — the
 * interpolator does the rest and there is no edge anywhere in it, not at the
 * rim and not in the middle. 128 triangles a lamp, additive, unfogged, and it
 * is the same helper the fumaroles use.
 */
const iceGLOW_SEG = 16;
const iceGLOW_R = [0, 0.26, 0.55, 0.80, 1];
const iceGLOW_K = [1, 0.66, 0.32, 0.11, 0];
function iceGlowDisc(pos, col, cx, cy, cz, R, peak, tint) {
  const r = tint === undefined ? 1 : ((tint >> 16) & 255) / 255;
  const g = tint === undefined ? 0.96 : ((tint >> 8) & 255) / 255;
  const b = tint === undefined ? 0.86 : (tint & 255) / 255;
  const put = (ri, si) => {
    const a = si / iceGLOW_SEG * 6.283185;
    const rr = iceGLOW_R[ri] * R;
    pos.push(cx + Math.cos(a) * rr, cy + (4 - ri) * 0.004, cz + Math.sin(a) * rr);
    const k = iceGLOW_K[ri] * peak;
    col.push(r * k, g * k, b * k);
  };
  for (let ri = 0; ri < 4; ri++) {
    for (let si = 0; si < iceGLOW_SEG; si++) {
      put(ri, si); put(ri + 1, si); put(ri + 1, si + 1);
      put(ri, si); put(ri + 1, si + 1); put(ri, si + 1);
    }
  }
}
/**
 * A FLOODLIT WALL, AS ONE QUAD WITH A GRADIENT IN IT.
 *
 * Two goes at this were stacks of flat additive slabs — first one per column,
 * which is a painted dado with a hard top edge, then six steps on a squared
 * curve, which is a painted dado with six hard edges. The falloff has to live
 * in the VERTEX COLOURS, exactly as it does in the pools of light on the road:
 * four vertices, bright at the foot and black at the top, and the interpolator
 * does the rest. Two triangles a column instead of seventy-two.
 *
 * And the tint has to be NEUTRAL. The stepped version wrote (v, v+6, v+14),
 * which at the dim end is (0, 6, 14) — i.e. pure blue — so the bottom of the
 * most photographed building in Iceland came out the colour of a swimming pool.
 */
function iceWashQuad(pos, col, x, z, w, y0, y1, peak) {
  const put = (px, py, k) => {
    pos.push(px, py, z);
    col.push(peak * k, peak * k * 0.965, peak * k * 0.87);
  };
  const h = w * 0.5;
  put(x - h, y0, 1); put(x + h, y0, 1); put(x + h, y1, 0);
  put(x - h, y0, 1); put(x + h, y1, 0); put(x - h, y1, 0);
}
function iceGlowMesh(pos, col) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.92, depthWrite: false,
    blending: THREE.AdditiveBlending, fog: false,
  }));
  m.renderOrder = 1;
  m.castShadow = false;
  m.frustumCulled = false;
  return m;
}

// ============================================================== REYKJAVIK ===
/**
 * A city built entirely out of corrugated iron, because there was no timber to
 * cut and no stone worth quarrying, and then painted, because a whole town of
 * bare galvanised sheet in the dark would be unbearable. That is why the only
 * saturated colour in this biome before the aurora comes out is HOUSES.
 *
 * At night the windows do the work. There is no emissive light in this game's
 * material law, so a lit window is a very pale quad on a dark wall and the eye
 * does the rest — which happens to be exactly what a window looks like from
 * across a street.
 */
function iceBuildCity(game, root) {
  const M = iceMerger();
  const SG = iceStaticGroup(game);
  // EVERY LIT WINDOW IN THE CITY, IN ONE SELF-ILLUMINATED BATCH.
  // A window painted as a pale quad on a wall works in daylight and does
  // nothing at all at night, because at night the wall and the window are lit
  // by the same (almost no) light and the contrast that made it a window is
  // gone. Lambert can be self-illuminated, so these come out of the main merge
  // and into their own mesh with the emissive turned up — one extra draw call
  // for the single thing that makes a town at night look inhabited.
  const W = iceMerger();
  const wall = [PALETTE.iceHouse1, PALETTE.iceHouse2, PALETTE.iceHouse3,
                PALETTE.iceHouse4, PALETTE.iceHouse5, PALETTE.iceHouse6];
  const roof = [PALETTE.iceRoofRed, PALETTE.iceRoofGrey];
  // Two streets running east-west, and the lane between them is where the
  // capybara lands. Nothing is more than two storeys — Reykjavik is not, and a
  // low skyline is what lets the church and the aurora both read from anywhere.
  for (let i = 0; i < iceHOUSE_N; i++) {
    const row = i % 3;
    const n = Math.floor(i / 3);
    const z = (row < 2 ? iceROWS[row] : iceBACKROW) + rand(-1.0, 1.0);
    const x = -46 + n * 7.4 + rand(-0.6, 0.6);
    if (x > 44) continue;                      // the headland starts about here
    // and nothing may stand on the church's hill
    if (row === 2 && Math.abs(x - iceCHURCH.x) < 22) continue;
    const gy = iceTerrain(x, z);
    const w = rand(5.0, 6.6), d = rand(5.0, 6.4);
    const h = rand(4.2, 7.0);
    const c = wall[randInt(0, wall.length - 1)];
    M.box(x, gy + h * 0.5, z, w, h, d, c);
    // ---- A STEEP GABLE, BECAUSE IT SNOWS — AND IT WAS A FLAT SLAB ---------
    // Two axis-aligned boxes stacked on top of the walls, which from a camera
    // that looks down at forty-one degrees is a red rectangle with a raised
    // strip on it: the shot of the street is forty-six flat roofs in a country
    // that gets two metres of snow. Two ROTATED planes meeting at a ridge is
    // the same two boxes and is an actual roof, and it is the single biggest
    // change to the silhouette of this town.
    const rc = roof[randInt(0, 1)];
    const pitch = 0.62;                     // ~35 degrees, which is Reykjavik
    const rise = (d * 0.5 + 0.28) * Math.tan(pitch);
    const slope = Math.hypot(d * 0.5 + 0.28, rise);
    for (let sr = -1; sr <= 1; sr += 2) {
      M.box(x, gy + h + rise * 0.5, z + sr * (d * 0.25 + 0.14), w + 0.55, 0.26, slope,
            rc, sr * pitch, 0, 0);
    }
    // the ridge, the verge boards at each gable end, and the snow that has
    // stayed on the north pitch
    M.box(x, gy + h + rise + 0.10, z, w + 0.62, 0.20, 0.30, PALETTE.iceRoofGrey);
    for (let sv = -1; sv <= 1; sv += 2) {
      M.box(x + sv * (w * 0.5 + 0.30), gy + h + rise * 0.55, z, 0.14, rise + 0.5, d + 0.6,
            PALETTE.iceRoofGrey);
    }
    M.box(x, gy + h + rise * 0.5 + 0.15, z - (d * 0.25 + 0.14), w + 0.30, 0.10, slope * 0.72,
          PALETTE.iceSnow, -pitch, 0, 0);
    // windows, lit
    const wn = randInt(2, 4);
    for (let k = 0; k < wn; k++) {
      const wx = x + rand(-w * 0.32, w * 0.32);
      const wy = gy + rand(1.4, h - 1.2);
      // every house faces the street, and the street is between the two rows,
      // so the lit face is +z for the far row and -z for the near one
      const face = z < iceLANES[0] ? 1 : -1;
      W.box(wx, wy, z + face * (d * 0.5 + 0.07), 1.25, 1.45, 0.12, PALETTE.iceWindow);
      // the back of the house faces the next row; about half of those are dark,
      // and a dark window is an ordinary painted quad, not a light source
      if (Math.random() < 0.45) W.box(wx, wy, z - face * (d * 0.5 + 0.07), 1.25, 1.45, 0.12, PALETTE.iceWindow);
      else M.box(wx, wy, z - face * (d * 0.5 + 0.07), 1.1, 1.3, 0.12, PALETTE.iceRoofGrey);
    }
    // a chimney, and something is burning in it — AND IT SHOWS NOW. Forty-six
    // houses with a fire lit in a third of them and not one wisp of anything
    // coming out of the top: the town read as a model of a town. The plumes
    // are the shared steam pool at a very low rate (see iceUpdateChimneys),
    // which costs nothing and is the single cheapest thing that says somebody
    // is in there.
    if (i % 3 === 0) {
      M.box(x + w * 0.28, gy + h + 2.4, z, 0.7, 1.6, 0.7, PALETTE.iceMoraineDk);
      M.box(x + w * 0.28, gy + h + 3.24, z, 0.86, 0.16, 0.86, PALETTE.iceRoofGrey);
      if (iceChimneys.length < 14) iceChimneys.push(x + w * 0.28, gy + h + 3.4, z);
    }
    // a downpipe and a gutter, which is what a corrugated-iron house is mostly
    // made of and is also the only vertical line on a painted box
    M.box(x, gy + h + 0.02, z + (z < iceLANES[0] ? 1 : -1) * (d * 0.5 + 0.22),
          w + 0.5, 0.14, 0.16, PALETTE.iceRoofGrey);
    M.cyl(x + w * 0.44, gy + h * 0.5, z + (z < iceLANES[0] ? 1 : -1) * (d * 0.5 + 0.16),
          0.07, h, PALETTE.iceRoofGrey);
    // AND THE HOUSE IS SOLID. Every house in Reykjavik was drawn and none of
    // them was: the church, the hot dog stand and the harbour all got their
    // colliders and the town — which is the thing the chapter opens standing
    // in the middle of — never did. Fifty-seven of Iceland's walkable squares
    // had a wall within reach that the animal walked straight through, more
    // than any other failure in the chapter. Only the box, not the gable: a
    // roof you can hop onto is a nicer thing than a roof you bounce off, and
    // the ridge is above the hop height anyway.
    SG.add(x, gy + h * 0.5, z, w, h, d);
  }

  // --- the lanes: dark wet asphalt -------------------------------------------
  for (let k = 0; k < iceLANES.length; k++) {
    const z = iceLANES[k];
    // NOT iceBasaltDk. Under a blue-hour hemisphere a near-black road is a
    // hole cut in the middle of the town; wet asphalt at night is a mid grey
    // that catches every light there is.
    M.box(-2, iceTerrain(-2, z) + 0.03, z, 100, 0.06, 9, PALETTE.iceMoraineDk);
    for (let i = 0; i < 22; i++) {
      M.box(-46 + i * 4.4, iceTerrain(0, z) + 0.05, z, 2.2, 0.06, 0.22, PALETTE.iceGeoRim);
    }
  }
  // AND THE ONE RUNNING NORTH OUT OF TOWN, LAID ON THE GROUND IT CROSSES.
  //
  // It was ONE box, `M.box(0, 0.03, 46, 9, 0.06, 76)` — a flat slab at y = 0.03
  // for seventy-six metres. The geothermal basin between z = -26 and 22 sits
  // six tenths of a metre BELOW zero, so the middle third of the only road in
  // Iceland was a grey plate hanging in the air over a hollow, which is
  // exactly what the shot from the geyser field shows. Sixteen plates
  // following the terrain, and each one tilted to meet the next.
  {
    const N = 20, z0 = 8, z1 = 84;
    for (let i = 0; i < N; i++) {
      const za = lerp(z0, z1, i / N), zb = lerp(z0, z1, (i + 1) / N);
      const ya = iceTerrain(0, za), yb = iceTerrain(0, zb);
      const len = Math.hypot(zb - za, yb - ya);
      M.box(0, (ya + yb) * 0.5 + 0.03, (za + zb) * 0.5, 9, 0.06, len + 0.3,
            PALETTE.iceMoraineDk, Math.atan2(yb - ya, zb - za), 0, 0);
      // the white line down the edge of it, which is the only thing out there
      // at night that tells you where the road is
      for (let s2 = -1; s2 <= 1; s2 += 2) {
        M.box(s2 * 4.2, (ya + yb) * 0.5 + 0.07, (za + zb) * 0.5, 0.18, 0.05, len + 0.3,
              PALETTE.iceGeoRim, Math.atan2(yb - ya, zb - za), 0, 0);
      }
    }
  }

  // --- street lamps ----------------------------------------------------------
  // The only lights in the game. There is no emissive light in the material law
  // so a lamp is a very pale box on a dark pole, and at night the eye does the
  // rest — which happens to be exactly what a sodium lamp looks like from the
  // other end of a street.
  for (let k = 0; k < iceLANES.length; k++) {
    for (let i = 0; i < 13; i++) {
      const x = -46 + i * 7.6;
      const z = iceLANES[k] + (i % 2 ? 8.5 : -8.5);
      const gy = iceTerrain(x, z);
      M.cyl(x, gy + 2.4, z, 0.10, 4.8, PALETTE.iceMoraineDk);
      // the swan neck, so the head is over the road rather than over the kerb
      const lean = i % 2 ? -1 : 1;
      M.cyl(x, gy + 4.9, z + lean * 0.8, 0.07, 1.8, PALETTE.iceMoraineDk, Math.PI / 2 * lean, 0, 0);
      W.box(x, gy + 4.75, z + lean * 1.6, 0.85, 0.28, 0.85, PALETTE.iceWindow);
      // AND THE POOL IT PUTS ON THE ROAD. A lamp with nothing under it is a
      // lit box on a stick: what tells you it is a light is that the ground
      // beneath it is brighter than the ground either side. One flat disc of
      // pale, and it is the difference between a street and a corridor of
      // painted houses.
      iceLampPools.push(x, gy + 0.055, z + lean * 1.6);
    }
  }

  // ---- WHAT A STREET HAS ON IT --------------------------------------------
  // Reykjavik was forty-six painted houses, a road with a dashed line down it,
  // and NOTHING ELSE — no vehicle, no bin, no bench, no bicycle, nobody. The
  // instrumented shot of the spawn is a beautifully lit evacuation. Everything
  // below is static, merged, and in the batch that was already being built.
  const CAR = [PALETTE.iceHull, PALETTE.iceHullBlue, PALETTE.iceHouse2,
               PALETTE.iceHouse4, PALETTE.iceRoofGrey, PALETTE.iceHouse6];
  for (let i = 0; i < 11; i++) {
    const x = -44 + i * 8.4 + rand(-1, 1);
    const s = i % 2 ? 1 : -1;
    const z = iceLANES[0] + s * 5.2;
    const gy = iceTerrain(x, z);
    const c = CAR[i % CAR.length];
    // a small hatchback, parked nose-in: body, cabin, glass, four wheels
    M.box(x, gy + 0.62, z, 1.85, 0.66, 4.0, c);
    M.box(x, gy + 1.15, z - s * 0.25, 1.66, 0.62, 2.1, c);
    M.box(x, gy + 1.20, z - s * 0.25, 1.70, 0.44, 2.14, PALETTE.iceBasaltDk);
    M.box(x, gy + 1.48, z - s * 0.25, 1.60, 0.10, 2.0, c);
    for (let a = -1; a <= 1; a += 2) {
      for (let b2 = -1; b2 <= 1; b2 += 2) {
        M.cyl(x + a * 0.86, gy + 0.30, z + b2 * 1.35, 0.30, 0.20, PALETTE.iceBasaltDk,
              0, 0, Math.PI / 2, 8);
      }
    }
    // the tail lights, which is the one bit of a car you can see at night
    M.box(x - 0.6, gy + 0.72, z + s * 2.02, 0.42, 0.16, 0.06, PALETTE.iceHull);
    M.box(x + 0.6, gy + 0.72, z + s * 2.02, 0.42, 0.16, 0.06, PALETTE.iceHull);
    SG.add(x, gy + 0.62, z, 1.85, 1.3, 4.0);
  }
  for (let i = 0; i < 7; i++) {
    const x = -40 + i * 13 + rand(-2, 2);
    const s = i % 2 ? 1 : -1;
    const z = iceLANES[0] + s * 10.5;
    const gy = iceTerrain(x, z);
    if (i % 3 === 0) {
      // a bicycle against a wall, at an angle, because nobody stands one up
      M.cyl(x - 0.5, gy + 0.34, z, 0.34, 0.07, PALETTE.iceBasaltDk, 0, 1.57, 0.22, 8);
      M.cyl(x + 0.5, gy + 0.34, z, 0.34, 0.07, PALETTE.iceBasaltDk, 0, 1.57, 0.22, 8);
      M.box(x, gy + 0.62, z, 1.1, 0.08, 0.06, PALETTE.iceHull, 0, 0, 0.22);
      M.box(x + 0.42, gy + 0.86, z, 0.06, 0.5, 0.44, PALETTE.iceMoraineDk, 0, 0, 0.22);
    } else if (i % 3 === 1) {
      // a wheelie bin and a recycling crate
      M.box(x, gy + 0.55, z, 0.68, 1.1, 0.62, PALETTE.iceHouse3);
      M.box(x, gy + 1.14, z, 0.72, 0.10, 0.66, PALETTE.iceMoraineDk);
      M.box(x + 0.9, gy + 0.22, z, 0.6, 0.44, 0.5, PALETTE.iceHullBlue);
    } else {
      // a bench, and the drift of grit somebody has not swept up
      M.box(x, gy + 0.44, z, 1.8, 0.09, 0.42, PALETTE.iceRope);
      M.box(x, gy + 0.72, z, 1.8, 0.34, 0.07, PALETTE.iceRope, 0.2);
      for (let a = -1; a <= 1; a += 2) {
        M.box(x + a * 0.72, gy + 0.22, z, 0.09, 0.44, 0.40, PALETTE.iceMoraineDk);
      }
    }
  }

  SG.done();
  const mesh = new THREE.Mesh(M.build(), iceVC());
  mesh.castShadow = true; mesh.receiveShadow = true;
  root.add(mesh);

  // Every box in this batch is the same colour, so the emissive can be a flat
  // uniform: Lambert adds emissive AFTER the vertex colour has multiplied the
  // (black) diffuse, so a per-window tint would have to come from the emissive
  // and there is only one of those. One colour, and it is the right one.
  const wm = new THREE.Mesh(W.build(), mat(0x000000, {
    emissive: PALETTE.iceWindow, emissiveIntensity: 0.95,
  }));
  root.add(wm);

  // ---- the pools the lamps put on the road --------------------------------
  // Additively blended, so where two overlap the road genuinely gets brighter,
  // and never fogged: they are the thing the fog is meant to be revealing.
  if (iceLampPools.length) {
    const pos = [], col = [];
    for (let i = 0; i < iceLampPools.length; i += 3) {
      iceGlowDisc(pos, col, iceLampPools[i], iceLampPools[i + 1], iceLampPools[i + 2],
                  7.4, 0.82, 0xa8905a);
    }
    root.add(iceGlowMesh(pos, col));
  }
}

/**
 * The plumes off the chimneys. Rationed hard — one puff every couple of
 * seconds across the whole town, from whichever chimney is nearest the player,
 * because fourteen simultaneous columns would empty a fifty-four particle pool
 * that the geyser also needs.
 */
function iceUpdateChimneys(game, dt) {
  if (!iceChimneys.length) return;
  if (Math.random() > dt * 2.4) return;
  const cp = game.capy && game.capy.position;
  if (!cp || cp.z < 60) return;                  // only while the town is in shot
  let best = -1, bd = 1e9;
  for (let i = 0; i < iceChimneys.length; i += 3) {
    const d = Math.hypot(iceChimneys[i] - cp.x, iceChimneys[i + 2] - cp.z);
    if (d < bd) { bd = d; best = i; }
  }
  if (best < 0 || bd > 70) return;
  // one at a time, and the one nearest the animal, so the effect always lands
  // where the camera is
  const j = best + (randInt(0, 3) * 3) % iceChimneys.length;
  const k = j < iceChimneys.length ? j : best;
  // SMALL. iceSteamSync grows a particle to scale * 2.74 over its life, so the
  // first cut at 0.7-1.2 put a six-metre grey sphere over a five-metre house —
  // the instrumented shot of the street has one hanging beside the church like
  // a moon. A chimney at this scale wants about a metre.
  iceSteamSpawn(iceChimneys[k], iceChimneys[k + 1], iceChimneys[k + 2], 1.5, 0.16, rand(0.22, 0.40));
}

/**
 * HALLGRIMSKIRKJA. The most recognisable silhouette in the country and one of
 * the few buildings anywhere that is literally a diagram of its landscape: the
 * flanking wings are basalt columns, stepped down from the tower the way a
 * columnar cliff steps down from its plug. Which is convenient, because the
 * capybara is going to be standing on an actual one of those in about four
 * minutes, on the headland, covered in puffins.
 */
function iceBuildChurch(game, root) {
  const M = iceMerger();
  // ---- HALLGRIMSKIRKJA WAS THE ONLY UNLIT THING IN A CHAPTER MADE OF LIGHT --
  //
  // Forty-six houses have their windows in a self-illuminated batch. So does
  // every boat in the harbour, the wicket doors on the sheds, the lamp at the
  // head of the pier, the snowcat's beacon and its headlights. The church — the
  // most recognisable silhouette in the country, seventy-four metres of it on a
  // hill above the town, the thing the whole skyline is arranged around — had
  // its clock and its ten nave windows drawn as ORDINARY PAINTED QUADS in the
  // main merge, and at night an ordinary painted quad on a wall is lit by
  // exactly the same nothing the wall is. The instrumented shot of the church
  // is a flat grey cut-out.
  //
  // It is floodlit in life, from the ground, all night, every night. There is
  // no light source in this game's material law and there does not need to be:
  // what a floodlight actually does is make the bottom of a wall brighter than
  // the top, and that is a vertex colour.
  const W = iceMerger();
  const cx = iceCHURCH.x, cz = iceCHURCH.z;
  const gy = iceTerrain(cx, cz);
  const H = iceCHURCH.h;

  // the tower
  M.box(cx, gy + H * 0.5, cz, 9, H, 9, PALETTE.iceChurch);
  M.box(cx, gy + H + 2.6, cz, 6.4, 5.2, 6.4, PALETTE.iceChurchDk);
  M.cone(cx, gy + H + 8.2, cz, 3.4, 6.4, PALETTE.iceChurch, 0, Math.PI / 4, 0, 4);
  // the clock, which everybody in the city sets their watch by and nobody trusts
  W.cyl(cx, gy + H - 3.4, cz + 4.6, 1.5, 0.3, PALETTE.iceWindow, Math.PI / 2, 0, 0, 8);
  M.cyl(cx, gy + H - 3.4, cz + 4.52, 1.75, 0.22, PALETTE.iceChurchDk, Math.PI / 2, 0, 0, 8);
  // the hands, which is the only reason a pale disc reads as a clock
  M.box(cx + 0.34, gy + H - 3.06, cz + 4.78, 0.10, 0.95, 0.06, PALETTE.iceMoraineDk, 0, 0, 0.55);
  M.box(cx - 0.16, gy + H - 3.62, cz + 4.78, 0.09, 0.62, 0.06, PALETTE.iceMoraineDk, 0, 0, -0.9);
  // the belfry, which is open at the top of the tower and is lit from inside
  for (let s2 = -1; s2 <= 1; s2 += 2) {
    W.box(cx + s2 * 3.24, gy + H + 2.6, cz, 0.14, 3.2, 2.0, PALETTE.iceWindow);
    W.box(cx, gy + H + 2.6, cz + s2 * 3.24, 2.0, 3.2, 0.14, PALETTE.iceWindow);
  }
  // the doorway
  M.box(cx, gy + 3.2, cz + 4.7, 3.6, 6.4, 0.6, PALETTE.iceMoraineDk);
  // and the light over it, and the glass above the door. IN FRONT OF THE DOOR:
  // the door box is centred on cz + 4.7 with a depth of 0.6, so its front face
  // is at cz + 5.0 and the first cut put both of these at 4.9 — inside it.
  W.box(cx, gy + 5.55, cz + 5.06, 2.4, 1.5, 0.12, PALETTE.iceWindow);
  W.box(cx, gy + 6.9, cz + 5.20, 0.8, 0.26, 0.44, PALETTE.iceWindow);
  M.box(cx, gy + 7.15, cz + 5.24, 1.0, 0.16, 0.60, PALETTE.iceMoraineDk);

  // the wings: stepped columns falling away either side, which is the whole
  // building. Eight steps a side, each shorter and further out.
  for (let s = -1; s <= 1; s += 2) {
    for (let k = 1; k <= 8; k++) {
      const h = H * (1 - k / 9.4);
      const w = 2.6;
      const x = cx + s * (4.5 + (k - 0.5) * w);
      M.box(x, gy + h * 0.5, cz, w - 0.18, h, 7.6, k % 2 ? PALETTE.iceChurch : PALETTE.iceChurchDk);
      // each column is topped with a chamfer, or the whole thing reads as a bar chart
      M.box(x, gy + h + 0.5, cz, w - 0.18, 1.0, 7.6, PALETTE.iceChurchDk, 0.10 * s, 0, 0);
    }
  }
  // the nave running back from the tower
  M.box(cx, gy + 5, cz - 14, 15, 10, 22, PALETTE.iceChurch);
  M.box(cx, gy + 11.4, cz - 14, 16, 3.4, 23, PALETTE.iceChurchDk, 0, 0, 0);
  for (let k = 0; k < 5; k++) {
    W.box(cx - 7.6, gy + 5.6, cz - 5 - k * 4.4, 0.3, 5.2, 1.7, PALETTE.iceWindow);
    W.box(cx + 7.6, gy + 5.6, cz - 5 - k * 4.4, 0.3, 5.2, 1.7, PALETTE.iceWindow);
  }
  // ---- THE FLOODLIGHTS, AND THE WASH THEY PUT UP THE STONE -----------------
  // Six of them in the grass at the foot of the tower, and the pale band they
  // throw up the first eight metres of every column. It is one extra strip of
  // geometry per column and it is the difference between a building standing
  // in the dark and a building somebody is looking after.
  for (let s2 = -1; s2 <= 1; s2 += 2) {
    for (let k = 0; k < 3; k++) {
      const fx = cx + s2 * (5.5 + k * 7.0);
      const fy2 = iceTerrain(fx, cz + 6.5);
      M.box(fx, fy2 + 0.22, cz + 6.5, 0.7, 0.44, 0.5, PALETTE.iceMoraineDk, -0.5, 0, 0);
      W.box(fx, fy2 + 0.36, cz + 6.28, 0.5, 0.32, 0.10, PALETTE.iceWindow, -0.5, 0, 0);
    }
  }

  const mesh = new THREE.Mesh(M.build(), iceVC());
  mesh.castShadow = true; mesh.receiveShadow = true;
  root.add(mesh);
  // the lit half, in its own self-illuminated batch — the same law the town's
  // windows and the harbour's wheelhouses already use
  const wm = new THREE.Mesh(W.build(), mat(0x000000, {
    emissive: PALETTE.iceWindow, emissiveIntensity: 0.92,
  }));
  wm.castShadow = false;
  root.add(wm);
  // ---- and the wash of floodlight up the front of it ----------------------
  // Additive, unfogged, and it FADES UPWARD, because that is the only thing a
  // floodlight standing in the grass actually does.
  {
    const pos = [], col = [];
    iceWashQuad(pos, col, cx, cz + 4.62, 9.4, gy, gy + 15.0, 0.30);
    for (let s2 = -1; s2 <= 1; s2 += 2) {
      for (let k = 1; k <= 8; k++) {
        const h2 = H * (1 - k / 9.4);
        const x2 = cx + s2 * (4.5 + (k - 0.5) * 2.6);
        iceWashQuad(pos, col, x2, cz + 3.86, 2.35, gy, gy + Math.min(13.0, h2 * 0.98), 0.28);
      }
    }
    // and the pools the six floodlights themselves throw on the grass
    for (let s2 = -1; s2 <= 1; s2 += 2) {
      for (let k = 0; k < 3; k++) {
        const fx = cx + s2 * (5.5 + k * 7.0);
        iceGlowDisc(pos, col, fx, iceTerrain(fx, cz + 6.5) + 0.06, cz + 6.5, 5.0, 0.34, 0xa89a72);
      }
    }
    const fm = iceGlowMesh(pos, col);
    root.add(fm);
  }

  // solid: the tower, the nave, and the near columns. Eight bodies, not sixteen.
  iceStaticBox(game, cx, gy + H * 0.5, cz, 9, H, 9);
  iceStaticBox(game, cx, gy + 5, cz - 14, 15, 10, 22);
  for (let s = -1; s <= 1; s += 2) {
    iceStaticBox(game, cx + s * 11, gy + 8, cz, 11, 16, 7.6);
    iceStaticBox(game, cx + s * 20, gy + 4, cz, 7, 8, 7.6);
  }

  // --- the organ console -----------------------------------------------------
  // Klais, five thousand two hundred and seventy-five pipes, fifteen metres of
  // them. Nobody has ever leaned on it as hard as this is about to be leaned on.
  const OM = iceMerger();
  const oy = iceTerrain(iceORGAN.x, iceORGAN.z);
  OM.box(0, 0.9, 0, 3.0, 1.8, 1.4, PALETTE.iceMoraineDk);
  OM.box(0, 1.72, 0.2, 2.6, 0.18, 0.7, PALETTE.iceChurch);      // the manuals
  for (let k = 0; k < 11; k++) {
    OM.cyl(-1.3 + k * 0.26, 2.4 + (k % 3) * 0.5, -0.4, 0.10, 1.6 + (k % 3), PALETTE.iceGeoRim);
  }
  const om = new THREE.Mesh(OM.build(), iceVC());
  om.position.set(iceORGAN.x, oy, iceORGAN.z);
  om.castShadow = true;
  root.add(om);
}

/**
 * The hot dog stand. Baejarins Beztu Pylsur, open since 1937, and there is a
 * photograph of a former American president standing at it looking delighted.
 * It is four steps from where the capybara lands, which is the whole reason it
 * is the second line on the list: a chapter should be able to be started
 * without walking anywhere.
 */
function iceBuildPylsa(game, root) {
  const g = new THREE.Group();
  const gy = iceTerrain(icePYLSA.x, icePYLSA.z);
  const M = iceMerger();
  M.box(0, 1.3, 0, 4.2, 2.6, 2.6, PALETTE.iceHull);
  M.box(0, 2.75, 0, 4.6, 0.4, 3.0, PALETTE.iceHouse5);
  M.box(0, 1.9, 1.36, 3.2, 1.3, 0.12, PALETTE.iceWindow);        // the hatch
  M.box(0, 2.62, 1.9, 4.4, 0.14, 1.2, PALETTE.iceHouse5, -0.22, 0, 0);   // the awning
  M.box(0, 1.05, 1.5, 3.2, 0.16, 0.7, PALETTE.iceRope);          // the counter
  // and the queue rail, because there is always a queue
  M.cyl(-2.6, 0.5, 2.6, 0.06, 1.0, PALETTE.iceMoraineDk);
  M.cyl(2.6, 0.5, 2.6, 0.06, 1.0, PALETTE.iceMoraineDk);
  M.cyl(0, 1.0, 2.6, 0.05, 5.2, PALETTE.iceMoraineDk, 0, 0, Math.PI / 2);
  const mesh = new THREE.Mesh(M.build(), iceVC());
  mesh.castShadow = true; mesh.receiveShadow = true;
  g.add(mesh);
  g.position.set(icePYLSA.x, gy, icePYLSA.z);
  root.add(g);
  icePylsaGroup = g;
  iceStaticBox(game, icePYLSA.x, gy + 1.3, icePYLSA.z, 4.2, 2.6, 2.6);
}

// ================================================================ HARBOUR ===
/**
 * The old harbour, and the pier that is the way out of the chapter. Every biome
 * gets exactly ONE exit, standing somewhere obvious, using a verb the player
 * already has (CONTRACT / the progression chain): here it is the end of the
 * pier, which is the only place in Reykjavik where the land stops and there is
 * nothing between you and the rest of the world.
 */
function iceBuildHarbour(game, root) {
  const M = iceMerger();
  const SG = iceStaticGroup(game);
  const W = iceMerger();          // everything that is LIT — see iceBuildCity
  const px = icePIER.x;
  const deckY = 1.2;
  // the pier deck
  const len = icePIER.head - icePIER.z + 4;
  M.box(px, deckY, (icePIER.z + icePIER.head) * 0.5, 5.4, 0.4, len, PALETTE.iceRope);
  // THE PILES ARE UNDER THE DECK. They were 5 m tall centred at -0.6, i.e.
  // topping out at 1.9 — half a metre PROUD of a deck at 1.4, twenty-two of
  // them at 1.6 m centres down both sides of a five-metre pier. From the boards
  // it is a picket fence of black stumps, and from the water you cannot see the
  // one thing a pile is actually for. They stop at the deck now; the things
  // that are genuinely supposed to stand up are four bollards and two fenders.
  for (let i = 0; i <= 10; i++) {
    const z = icePIER.z - 2 + i * (len / 10);
    M.cyl(px - 2.2, deckY * 0.5 - 1.72, z, 0.26, 5, PALETTE.iceMoraineDk);
    M.cyl(px + 2.2, deckY * 0.5 - 1.72, z, 0.26, 5, PALETTE.iceMoraineDk);
    // the waling that ties them together, which is the diagonal you see from a
    // boat and is the whole reason a pier reads as built rather than as drawn
    if (i < 10) {
      for (let sx = -1; sx <= 1; sx += 2) {
        M.box(px + sx * 2.2, iceSEA_Y + 0.35, z + len / 20, 0.16, 0.22, len / 10 + 0.2,
              PALETTE.iceRope);
      }
    }
  }
  for (let i = 0; i < 4; i++) {
    const z = icePIER.z + 2.2 + i * 3.6;
    const sx = i % 2 ? 1 : -1;
    M.cyl(px + sx * 2.05, deckY + 0.42, z, 0.20, 0.84, PALETTE.iceMoraineDk, 0, 0, 0, 8);
    M.sph(px + sx * 2.05, deckY + 0.84, z, 0.24, 0.16, 0.24, PALETTE.iceMoraine);
    // and the tyre hung over the side as a fender
    if (i % 2 === 0) {
      M.cyl(px + sx * 2.5, iceSEA_Y + 1.0, z + 1.4, 0.44, 0.24, PALETTE.iceBasaltDk,
            0, 0, Math.PI / 2, 8);
    }
  }
  // a bollard at the head, which is where you stand to leave
  M.cyl(px, deckY + 0.6, icePIER.head - 1, 0.4, 1.0, PALETTE.iceMoraineDk, 0, 0, 0, 8);
  M.sph(px, deckY + 1.15, icePIER.head - 1, 0.42, 0.3, 0.42, PALETTE.iceMoraine);

  // AND THE THINGS A WORKING PIER IS COVERED IN. It was five posts and a
  // bollard: a hundred and forty metres of bare decking out into a black bay,
  // which reads as a jetty in a diagram. What is actually on one of these is
  // fish crates, a coil of warp, a pot or two and a lamp at the head — and the
  // lamp matters most, because this is the way OUT of the chapter and it is
  // pitch dark out there.
  // ON THE PIER, NOT OUT IN THE BAY.
  //
  // `len` is icePIER.head - icePIER.z + 4 = 16 m, so the deck runs from z = 126
  // to z = 142 — and this loop laid nine groups of crates, warp and creels at
  // 13.2 m centres starting at z = 131, i.e. from 131 out to 236. Eight of the
  // nine were hanging two and a half metres over open water, in a dead straight
  // line, pointing out to sea from the exact spot the chapter's EXIT is. They
  // fit on the boards now.
  const CRATE = [PALETTE.iceHullBlue, PALETTE.iceHull, PALETTE.iceHouse5];
  for (let i = 0; i < 6; i++) {
    const z = icePIER.z + 1.6 + i * ((len - 5.0) / 5);
    const s = i % 2 ? 1 : -1;
    if (i % 3 === 0) {
      // a stack of fish crates
      for (let k = 0; k < 3; k++) {
        M.box(px + s * 1.7, deckY + 0.4 + k * 0.42, z, 1.0, 0.40, 0.8,
              CRATE[(i + k) % CRATE.length], 0, rand(-0.2, 0.2), 0);
      }
    } else if (i % 3 === 1) {
      // a coil of warp, flat on the boards
      M.cyl(px + s * 1.6, deckY + 0.28, z, 0.55, 0.16, PALETTE.iceRope, 0, 0, 0, 8);
      M.cyl(px + s * 1.6, deckY + 0.40, z, 0.36, 0.14, PALETTE.iceRope, 0, 0, 0, 8);
    } else {
      // and a creel
      M.box(px + s * 1.6, deckY + 0.42, z, 0.9, 0.44, 0.7, PALETTE.iceMoraineDk);
      M.cyl(px + s * 1.6, deckY + 0.66, z, 0.30, 0.10, PALETTE.iceRope, 0, 0, 0, 6);
    }
  }
  // the lamp at the head of the pier, which is the last thing in Iceland
  M.cyl(px - 1.9, deckY + 2.4, icePIER.head - 3, 0.09, 4.4, PALETTE.iceMoraineDk);
  W.box(px - 1.9, deckY + 4.7, icePIER.head - 3, 0.7, 0.5, 0.7, PALETTE.iceWindow);

  // three boats alongside, because the harbour is a working one
  const hulls = [PALETTE.iceHull, PALETTE.iceHullBlue, PALETTE.iceHull];
  for (let i = 0; i < 3; i++) {
    const bx = px + (i < 2 ? -7 - i * 7 : 7);
    const bz = icePIER.z + 6 + i * 6;
    M.box(bx, iceSEA_Y + 0.9, bz, 4.4, 2.2, 11, hulls[i], 0, rand(-0.06, 0.06), 0);
    M.box(bx, iceSEA_Y + 2.4, bz - 1.6, 3.0, 1.6, 3.4, PALETTE.iceHouse5);
    M.cyl(bx, iceSEA_Y + 5.0, bz - 1.6, 0.12, 6, PALETTE.iceMoraineDk);
    M.box(bx, iceSEA_Y + 2.1, bz, 4.6, 0.3, 11.2, PALETTE.iceRope);
    // a boat at night has ONE light on in the wheelhouse and a red band down
    // the sheer, and without either it is a coloured box with a stick in it
    W.box(bx + 1.52, iceSEA_Y + 2.5, bz - 1.6, 0.10, 0.7, 1.9, PALETTE.iceWindow);
    W.box(bx - 1.52, iceSEA_Y + 2.5, bz - 1.6, 0.10, 0.7, 1.9, PALETTE.iceWindow);
    W.box(bx, iceSEA_Y + 5.6, bz - 1.6, 0.24, 0.24, 0.24, PALETTE.iceWindow);   // masthead
    M.box(bx, iceSEA_Y + 1.55, bz, 4.5, 0.30, 11.1, PALETTE.iceHull);
    for (let k = -1; k <= 1; k++) {
      M.cyl(bx, iceSEA_Y + 0.9, bz + k * 3.4, 0.22, 4.7, PALETTE.iceMoraineDk, 0, 0, Math.PI / 2, 6);
    }
    // and the warp holding it on, which is the only diagonal line in the harbour
    M.cyl((bx + px) * 0.5, iceSEA_Y + 1.7, bz - 3, 0.05,
          Math.hypot(px - bx, 3) + 1, PALETTE.iceRope,
          Math.PI / 2 - 0.2, Math.atan2(px - bx, 3), 0, 4);
    // AND IT IS SOLID. Three fishing boats moored alongside the one pier in
    // the chapter, and the audit swam through all of them.
    const hb = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
    hb.addShape(new CANNON.Box(new CANNON.Vec3(2.2, 1.1, 5.5)));
    hb.addShape(new CANNON.Box(new CANNON.Vec3(1.5, 0.8, 1.7)), new CANNON.Vec3(0, 1.5, -1.6));
    hb.position.set(bx, iceSEA_Y + 0.9, bz);
    iceSyncBody(hb);
    game.world.addBody(hb);
  }
  // ---- the sheds along the quay -------------------------------------------
  // FIVE BLANK BOXES WITH LIDS ON. They are the biggest thing in the frame
  // from anywhere in the old harbour and they had no door, no window, no
  // number and no collider — the audit walked through twenty-seven samples of
  // them. A fish shed has one enormous roller door, a wicket beside it, and a
  // number painted on it the size of a person.
  // ONE OF THEM WAS BUILT ON THE PIER.
  //
  // The sheds were laid out as `x = -18 + i * 13` — so the fourth one is centred
  // on x = 21 and is 10 m wide, i.e. it spans 16 to 26. The pier is at x = 26
  // with a deck 5.4 m across, i.e. 23.3 to 28.7. They overlap by nearly three
  // metres, WITH the shed's collider, so the landward end of the only way out
  // of this chapter ran into the side of a building and the instrumented shot
  // down the deck is two enormous grey slabs crowding the boards. Four of them
  // west of the pier and one well east, with the quay open between.
  const SHED_X = [-26, -13, 0, 13, 40];
  for (let i = 0; i < 5; i++) {
    const x = SHED_X[i];
    const gy = iceTerrain(x, 127);
    M.box(x, gy + 2.2, 127, 10, 4.4, 7, i % 2 ? PALETTE.iceHouse2 : PALETTE.iceHouse1);
    M.box(x, gy + 4.8, 127, 10.6, 0.9, 7.6, PALETTE.iceRoofGrey);
    // The roller door, recessed, with its guide rails — ON BOTH FACES. A fish
    // shed is a tunnel: the boat lands on the quay side and the lorry loads on
    // the town side, so it is open at each end. It also happens to be the only
    // way the detail is ever seen, because the player arrives from the town
    // (z ≈ 99) and leaves down the pier (z ≈ 140), which are opposite faces.
    for (let f = -1; f <= 1; f += 2) {
      const dz = 127 + f * 3.55;
      M.box(x, gy + 1.7, dz, 5.4, 3.4, 0.18, PALETTE.iceMoraineDk);
      for (let s2 = -1; s2 <= 1; s2 += 2) {
        M.box(x + s2 * 2.85, gy + 1.8, dz + f * 0.06, 0.24, 3.6, 0.16, PALETTE.iceRoofGrey);
      }
      M.box(x, gy + 3.55, dz + f * 0.06, 5.8, 0.30, 0.20, PALETTE.iceRoofGrey);
      // the shed's number, painted the size of a person
      M.box(x - 2.0, gy + 3.9, dz + f * 0.06, 0.9, 0.7, 0.10, PALETTE.iceRoofGrey);
      // the wicket, and about half of them have somebody in there at midnight
      if (i % 2 === 0) W.box(x + 4.0, gy + 1.6, dz + f * 0.02, 1.0, 2.0, 0.14, PALETTE.iceWindow);
      else M.box(x + 4.0, gy + 1.6, dz + f * 0.02, 1.0, 2.0, 0.14, PALETTE.iceMoraineDk);
    }
    // a gutter, and the barrels that live under it
    M.box(x, gy + 4.2, 130.9, 10.2, 0.20, 0.24, PALETTE.iceRoofGrey);
    for (let k = 0; k < 2; k++) {
      M.cyl(x - 4.4 + k * 0.9, gy + 0.44, 131.4, 0.32, 0.88, PALETTE.iceHullBlue, 0, 0, 0, 8);
    }
    SG.add(x, gy + 2.2, 127, 10, 4.4, 7);
  }
  SG.done();

  const mesh = new THREE.Mesh(M.build(), iceVC());
  mesh.castShadow = true; mesh.receiveShadow = true;
  root.add(mesh);
  // the lit things go in their own self-illuminated batch, same law as the
  // town's windows: at night a pale quad on a dark wall IS a light
  const wm = new THREE.Mesh(W.build(), mat(0x000000, {
    emissive: PALETTE.iceWindow, emissiveIntensity: 0.95,
  }));
  root.add(wm);

  // No collision bodies for the deck: iceTerrain() already carries a causeway
  // under it at exactly deck height, so the heightfield IS the pier and the
  // analytic backstop agrees with it. Two floors in the same place is how you
  // get a capybara standing on one and falling through the other.
}

/**
 * THE HEADLAND, AND THE PUFFINS.
 *
 * Columnar basalt: lava that cooled slowly enough to crack into hexagons all
 * the way down, which is why every cliff in the south of this country looks
 * like a church organ turned inside out. Puffins nest in the grass on top and
 * in every ledge in the face, and they go up all at once, which is the point —
 * one wheek and eleven hundred birds leave a cliff simultaneously.
 */
function iceBuildCliff(game, root) {
  const M = iceMerger();
  const cx = iceCLIFF.x, cz = iceCLIFF.z, R = iceCLIFF.r, H = iceCLIFF.h;
  // the columns. Hexagonal, packed on a rough grid, each one a different height
  // at the top — a flat-topped cliff is a table and reads as concrete.
  // THE TOPS OF THE COLUMNS CAME UP THROUGH THE LAWN.
  //
  // The moss cap is a cylinder at H + 0.1 with a thickness of 0.6, so its top
  // face is at H + 0.4 — and a column's height was H + rand(-1.6, +1.0), which
  // for two fifths of them under the core is HIGHER than that. The instrumented
  // shot of the headland is a green field with twenty-five black hexagonal
  // plates lying on it, exactly the manhole-cover failure the burrows in this
  // same function already had and had fixed. Anything under the turf stops
  // below it; only the ones out on the rim are allowed to break through, which
  // is what a real cliff edge does.
  for (let i = 0; i < 150; i++) {
    const a = rand(0, 6.283), r = Math.sqrt(Math.random()) * (R + 2);
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    let h = H + rand(-1.6, 1.0) - clamp((r - R + 5) * 0.9, 0, 8);
    if (r < R - 6.0) h = Math.min(h, H - rand(0.7, 1.6));
    if (h < 2) continue;
    const rr = rand(1.0, 1.7);
    // THE HEADLAND WAS A BLACK BLOB. iceBasalt and iceBasaltDk are two values
    // of near-black and under a night hemisphere they are the same one, so the
    // shot from the old harbour has a jagged black silhouette with no shape in
    // it at all — on the landmark the chapter tells you to climb. Every fifth
    // column takes the moraine grey instead, which is what weathered basalt
    // actually goes where the spray gets at it.
    M.cyl(x, h * 0.5, z, rr, h,
      i % 5 === 0 ? PALETTE.iceMoraineDk : i % 7 === 0 ? PALETTE.iceMoraine : PALETTE.iceBasalt,
      0, rand(0, 1.0), 0, 6);
    // AND THE GUANO. Eleven hundred puffins have been nesting on this rock
    // since before there was a country, and the one thing everybody knows about
    // a seabird cliff is that it is streaked white from every ledge downward.
    // It is also, at night, the only value in the whole headland that is not
    // black — which is what gives the columns their edges back.
    if (r > R - 9 && i % 3 === 0) {
      const gh = rand(3.0, 9.0);
      M.box(x + Math.cos(a) * rr * 0.92, h - gh * 0.5 - rand(0.4, 2.5),
            z + Math.sin(a) * rr * 0.92,
            rr * rand(0.35, 0.8), gh, rr * rand(0.35, 0.8),
            i % 2 ? PALETTE.iceSnow : PALETTE.iceMossPale, 0, rand(0, 1), 0);
    }
  }
  // A CAP OF MOSS, AND IT WAS A LILY PAD.
  //
  // One eight-sided cylinder at R - 3 with a dead-straight vertical edge,
  // floating clear of the column tops: the instrumented shot of the headland
  // is a green octagon balanced on a bunch of pencils. What a sea-cliff top
  // actually does is spill OVER the edge in tussocks and get eaten back into
  // the rock in the gaps between columns.
  // The walkable core stays a disc — it has to, the collider is a polygon and
  // the player runs about on it — but it is pulled well inside the drawn edge
  // and everything from there out is PATCHES.
  // and the turf is a METRE AND A HALF thick, not sixty centimetres: peat on a
  // sea cliff is a real depth, and the cap has to reach down past the column
  // tops it is sitting on or there is a ring of daylight under the lawn.
  M.cyl(cx, H - 0.35, cz, R - 6.6, 1.6, PALETTE.iceMoss, 0, 0, 0, 8);
  M.cyl(cx, H + 0.36, cz, R - 6.9, 0.34, PALETTE.iceMossPale, 0, 0, 0, 8);
  // Forty-four overlapping tufts at every radius from the core to past the lip,
  // each a different size and a different height. Nothing here is at a constant
  // r, which is the entire reason the first version read as a doily: a ring of
  // identical pieces AROUND an octagon is still an octagon with a frill on it.
  for (let i = 0; i < 64; i++) {
    const a = i / 64 * 6.283 + rand(-0.09, 0.09);
    const rr = ((i * 7919) % 100) / 100;
    const r = R - 7.5 + rr * rr * 7.6;               // biased inward, tailing out
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    const w = rand(1.8, 3.8);
    // The further out it is the lower it sits — a cliff-top spills over its own
    // edge, it does not stop at it — but it also gets DEEPER, and that is the
    // half the first cut missed: thin discs stepping down over columns whose
    // own tops step down faster read as green lily pads hovering in the gaps.
    // Turf on a sea cliff is a metre of peat sitting ON the rock, so the outer
    // ones are tall blocks whose bottoms go into the columns and only whose
    // tops are visible.
    // ...and SMALL AMOUNTS OF BOTH. At a 2.6 m drop and a 6.5 m depth the outer
    // ones came out as green pillars standing among the black ones, which is
    // the opposite failure and a worse one. What is wanted is a rag on the
    // edge of a lawn, not a second colonnade.
    const drop = clamp((r - (R - 5.5)) / 4.0, 0, 1);
    const top = H + 0.30 - drop * rand(0.15, 0.85);
    const hh = 0.85 + drop * 1.5;
    M.cyl(x, top - hh * 0.5, z, w * 0.5, hh,
      i % 3 ? PALETTE.iceMoss : PALETTE.iceMossPale,
      rand(-0.10, 0.10), rand(0, 1), rand(-0.10, 0.10), 6);
  }
  // ---- AND THE LAWN IS NOT A BILLIARD TABLE -------------------------------
  // With the column tops no longer coming through it, the cap went the other
  // way: one flat disc of one green, twenty metres across, with a scatter of
  // flat pale hexagons on it. A puffin colony is a slope of rough sea turf —
  // hummocky, eaten back to bare rock in patches, thrift and moss campion in
  // between — and none of that is expensive. Broad overlapping patches at
  // slightly different heights break the disc; domed tussocks (the rock lump,
  // squashed) give it a surface; and the bare rock showing through is the same
  // basalt the columns are made of, which ties the top to the sides.
  for (let i = 0; i < 26; i++) {
    const a = i / 26 * 6.283 + rand(-0.2, 0.2);
    const r = Math.sqrt(Math.random()) * (R - 7.5);
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    const w = rand(3.4, 7.2);
    M.cyl(x, H + 0.36 + rand(-0.06, 0.09), z, w * 0.5, 0.30,
      i % 3 === 0 ? PALETTE.iceMossPale : PALETTE.iceMoss, 0, rand(0, 1), 0, 6);
  }
  // tussocks ON it, so the lawn has a height as well as an outline
  for (let i = 0; i < 46; i++) {
    const a = rand(0, 6.283), r = Math.sqrt(Math.random()) * (R - 3);
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    const h = rand(0.24, 0.62);
    M.lump(x, H + 0.48, z, rand(1.0, 2.6), h * 2.2, rand(1.0, 2.6),
      i % 2 ? PALETTE.iceMossPale : PALETTE.iceMoss, rand(-0.1, 0.1), rand(0, 3), rand(-0.1, 0.1));
  }
  // and the rock coming through where the wind has taken the turf off
  for (let i = 0; i < 22; i++) {
    const a = rand(0, 6.283), r = Math.sqrt(Math.random()) * (R - 4.5);
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    M.lump(x, H + 0.46, z, rand(0.9, 2.4), rand(0.2, 0.5), rand(0.9, 2.4),
      i % 3 ? PALETTE.iceBasalt : PALETTE.iceMoraine, rand(-0.12, 0.12), rand(0, 3), rand(-0.12, 0.12));
  }
  // and the burrows. A puffin colony is a lawn with eleven hundred holes in it
  // and the spoil heap outside every one of them. SMALL — a burrow mouth is
  // about the size of the bird, and at half a metre they photographed as
  // manhole covers.
  for (let i = 0; i < 30; i++) {
    const a = rand(0, 6.283), r = Math.sqrt(Math.random()) * (R - 5);
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    M.cyl(x, H + 0.60, z, rand(0.16, 0.24), 0.10, PALETTE.iceBasaltDk, 0, 0, 0, 6);
    M.cyl(x + Math.cos(a) * 0.36, H + 0.64, z + Math.sin(a) * 0.36, rand(0.20, 0.30), 0.09,
      PALETTE.iceMoraine, 0, 0, 0, 6);
  }
  const mesh = new THREE.Mesh(M.build(), iceVC());
  mesh.position.set(0, 0, 0);
  mesh.castShadow = true; mesh.receiveShadow = true;
  root.add(mesh);

  // ---- solid, and it has to be the shape the columns actually made ---------
  // It was ONE box at R * 1.5 — a square 33 m across the middle of a plug whose
  // columns are scattered out to R + 2 = 24 m radius, i.e. 48 m across. The
  // corners of that square stick out past the drawn rock (so you bounce off
  // nothing) and the skirt of columns outside it is not solid at all, which is
  // twenty-seven of the audit's hits: you walk into the base of the headland
  // and keep going.
  //
  // A cylinder wants a polygon, not a square. Eight boxes on one body, laid
  // round the plug at the radius the columns are, plus a core.
  {
    const b = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
    b.addShape(new CANNON.Box(new CANNON.Vec3(R * 0.62, H * 0.5, R * 0.62)),
               new CANNON.Vec3(0, H * 0.5, 0));
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2;
      const rr = R * 0.80;
      const q = new CANNON.Quaternion();
      q.setFromEuler(0, -a, 0);
      b.addShape(new CANNON.Box(new CANNON.Vec3(R * 0.36, H * 0.5, R * 0.30)),
                 new CANNON.Vec3(Math.cos(a) * rr, H * 0.5, Math.sin(a) * rr), q);
    }
    b.position.set(cx, 0, cz);
    iceSyncBody(b);
    game.world.addBody(b);
  }

  // --- the birds -------------------------------------------------------------
  // A PUFFIN WAS A WHITE BOX. `new THREE.BoxGeometry(0.34, 0.42, 0.5)` in one
  // flat colour, ninety-six times, on the one landmark in the chapter you
  // climb specifically to look at them.
  //
  // It is the most recognisable bird alive and it is recognisable for exactly
  // three reasons: it is BLACK ON TOP AND WHITE UNDERNEATH with a hard line
  // between, it has a white face on a black head, and it has a triangular bill
  // half the size of its skull in orange and slate. All three are already in
  // the palette — icePuffinDk and icePuffinBk have been sitting in shared.js
  // unused since the chapter shipped — and all three fit in one merged mesh.
  const P = iceMerger();
  P.sph(0, 0, 0, 0.155, 0.175, 0.235, PALETTE.icePuffin);        // the white front
  P.sph(0, 0.075, -0.03, 0.150, 0.135, 0.225, PALETTE.icePuffinDk); // the black back
  P.sph(0, 0.155, 0.135, 0.125, 0.125, 0.115, PALETTE.icePuffinDk); // the head
  P.box(0, 0.165, 0.215, 0.145, 0.145, 0.05, PALETTE.icePuffin);   // and its white face
  // the bill: a flat triangle, orange at the tip and slate at the base, which
  // is the actual colouring and is also the only way it reads at fifteen metres
  P.cone(0, 0.150, 0.300, 0.105, 0.20, PALETTE.icePuffinBk, Math.PI / 2, 0, 0, 4);
  P.cone(0, 0.150, 0.245, 0.100, 0.10, PALETTE.icePuffinDk, Math.PI / 2, 0, 0, 4);
  for (let s2 = -1; s2 <= 1; s2 += 2) {
    P.box(s2 * 0.155, 0.045, -0.02, 0.055, 0.13, 0.30, PALETTE.icePuffinDk, 0, s2 * 0.10, 0);
    // and the feet, which are the same orange and are why they land so badly
    P.box(s2 * 0.065, -0.165, 0.055, 0.075, 0.045, 0.13, PALETTE.icePuffinBk);
  }
  const im = new THREE.InstancedMesh(P.build(), iceVC(), icePUFFIN_N);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for (let i = 0; i < icePUFFIN_N; i++) {
    const o = i * 8;
    if (i < icePUFFIN_N * 0.62) {
      // on the grass on top, which is where the burrows are
      const a = rand(0, 6.283), r = rand(2, R - 1);
      icePuffinData[o] = cx + Math.cos(a) * r;
      icePuffinData[o + 1] = H + 0.85;
      icePuffinData[o + 2] = cz + Math.sin(a) * r;
    } else {
      // AND IN THE FACE. The note over this function says "in every ledge in
      // the face" and there was never a single one below the cap — so the
      // cliff, which is the thing the chapter frames, was bare basalt with a
      // scatter of white on the lawn above it.
      const a = rand(0, 6.283), r = R + rand(-1.2, 1.6);
      icePuffinData[o] = cx + Math.cos(a) * r;
      icePuffinData[o + 1] = rand(H * 0.34, H - 1.2);
      icePuffinData[o + 2] = cz + Math.sin(a) * r;
    }
    // a bird on a ledge faces OUT, and a bird on the grass faces anywhere
    icePuffinData[o + 3] = rand(0, 6.283);
    icePuffinData[o + 4] = 0; icePuffinData[o + 5] = 0; icePuffinData[o + 6] = 0;
    icePuffinData[o + 7] = 0;                       // 0 = sitting, >0 = airborne
    icePuffinHome[o] = icePuffinData[o];
    icePuffinHome[o + 1] = icePuffinData[o + 1];
    icePuffinHome[o + 2] = icePuffinData[o + 2];
    icePuffinHome[o + 3] = icePuffinData[o + 3];
    // and the last few are never on the rock at all — see iceUpdatePuffinIdle
    icePuffinHome[o + 4] = i >= icePUFFIN_N - icePUFF_FLY ? 1 : 0;
  }
  // ---- AND A PUFFIN DOES NOT CAST A SHADOW --------------------------------
  // Measured: 150 birds at 184 triangles apiece is 27,600 triangles — 23 % of
  // the whole chapter, and the single largest object in it — and every one of
  // them was flagged castShadow, so the shadow pass drew all of it a second
  // time. A puffin is 25 cm long, it is on a vertical basalt face over the sea
  // or on the grass above it, and this chapter is lit by a sun that never comes
  // up: there is no frame in the game in which any of those shadows is a pixel.
  //
  // It was a quarter of the shadow budget of the world that flags the highest
  // proportion of its geometry as casting (84 %) and has the least scatter of
  // any chapter in the project by a factor of six. This one flag paid for the
  // whole of iceBuildScatter below.
  im.castShadow = false;
  im.userData.noShadow = true;
  im.receiveShadow = true;
  im.frustumCulled = false;
  root.add(im);
  icePuffinMesh = im;
  icePuffinSync();
}

function icePuffinSync() {
  if (!icePuffinMesh) return;
  for (let i = 0; i < icePUFFIN_N; i++) {
    const o = i * 8;
    icePuffinMesh.setMatrixAt(i, iceXform(
      icePuffinData[o], icePuffinData[o + 1], icePuffinData[o + 2],
      icePuffinData[o + 7] > 0 ? -0.5 : 0, icePuffinData[o + 3], 0, 1, 1, 1));
  }
  icePuffinMesh.instanceMatrix.needsUpdate = true;
}

// ============================================================= GEOTHERMAL ===
/**
 * Strokkur. It goes every eight or nine minutes in life and every eleven
 * seconds here, because a game is not a documentary, and the thing it actually
 * does — a blue dome swelling over the vent a second and a half before it
 * blows — is preserved exactly, because that dome is the only warning anybody
 * has ever had and it is the whole reason standing on a geyser is a decision.
 */
function iceBuildGeothermal(game, root) {
  const M = iceMerger();
  const SG = iceStaticGroup(game);
  // Strokkur's basin and silica rim
  M.cyl(iceSTROKKUR.x, iceTerrain(iceSTROKKUR.x, iceSTROKKUR.z) - 0.1, iceSTROKKUR.z,
    5.5, 0.6, PALETTE.iceGeoRim, 0, 0, 0, 8);
  M.cyl(iceSTROKKUR.x, iceTerrain(iceSTROKKUR.x, iceSTROKKUR.z) + 0.05, iceSTROKKUR.z,
    3.2, 0.4, PALETTE.iceGeoBlue, 0, 0, 0, 8);
  // the old one, dormant since an earthquake and full of still green water
  M.cyl(iceGEYSIR.x, iceTerrain(iceGEYSIR.x, iceGEYSIR.z) - 0.1, iceGEYSIR.z,
    9, 0.5, PALETTE.iceGeoRim, 0, 0, 0, 8);
  M.cyl(iceGEYSIR.x, iceTerrain(iceGEYSIR.x, iceGEYSIR.z) + 0.06, iceGEYSIR.z,
    6.6, 0.3, PALETTE.iceGeoBlue, 0, 0, 0, 8);
  // mud pots, which plop
  for (let i = 0; i < 9; i++) {
    const a = rand(0, 6.283), r = rand(14, 30);
    const x = iceSTROKKUR.x + Math.cos(a) * r, z = iceSTROKKUR.z + Math.sin(a) * r;
    const y = iceTerrain(x, z);
    M.cyl(x, y + 0.02, z, rand(1.2, 2.6), 0.3, PALETTE.iceMud, 0, 0, 0, 6);
    M.cyl(x, y + 0.16, z, rand(0.5, 1.1), 0.2, PALETTE.iceMoraineDk, 0, 0, 0, 6);
  }
  // The silica rim of the hot pool. FLUSH, and thin.
  //
  // It was a half-metre slab at 10 m radius with a raised timber boardwalk ring
  // outside it, and the instrumented shot of the spring is a photograph of a
  // plank with the capybara hidden behind it — at this camera height anything
  // knee-high and horizontal within fifteen metres of the animal simply becomes
  // the picture. The rule that keeps falling out of these shots: near the
  // player, go flat or go tall, and never put anything at eye level for a
  // rodent unless you meant to hide it.
  // ======= THE RIM WAS A LID, AND THE WHOLE POOL WAS UNDERNEATH IT =========
  //
  // MEASURED: the pool floor is -2.10 at the centre, the water surface is at
  // -0.30, the capybara floats at -0.99 with wet = 1 — and this line drew an
  // EIGHT-SIDED DISC of tan silica, ten and a third metres in radius, spanning
  // y -0.01 to +0.13. The water disc is 8.8 m in radius. So the rim was a solid
  // plate covering the entire spring, forty-three centimetres above the surface
  // of it, and the instrumented shot of the hot pool — the site of the only
  // task in the game that asks the player to do NOTHING, and the trigger for
  // the aurora — is a dry tan mound with a capybara submerged somewhere
  // underneath it. The chapter's whole second half hangs off a pool nobody has
  // ever been able to see.
  //
  // A rim is a RING and it follows the ground it is on. Twenty-four segments at
  // r + 1.4, each sampled on the real terrain, and nothing inside r at all.
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * 6.283;
    const r = iceSPRING.r + 1.3;
    const x = iceSPRING.x + Math.cos(a) * r, z = iceSPRING.z + Math.sin(a) * r;
    M.box(x, iceTerrain(x, z) + 0.05, z, 3.4, 0.12, 3.2, PALETTE.iceGeoRim, 0, -a, 0);
    // and the terraces stepping down to the water, which is what silica does.
    // SMALL, and the colour of the rim rather than of snow: the first cut was
    // 2.6 x 1.5 in iceSnow at r + 0.35 and read as a ring of white paper plates
    // hanging out over the pool.
    const r2 = iceSPRING.r + 0.75;
    const x2 = iceSPRING.x + Math.cos(a) * r2, z2 = iceSPRING.z + Math.sin(a) * r2;
    M.box(x2, iceTerrain(x2, z2) + 0.03, z2, 1.9, 0.09, 0.85, PALETTE.iceGeoRim, 0, -a, 0);
    if (i % 2 === 0) {
      const r3 = iceSPRING.r + 2.1;
      const x3 = iceSPRING.x + Math.cos(a) * r3, z3 = iceSPRING.z + Math.sin(a) * r3;
      M.box(x3, iceTerrain(x3, z3) + 0.03, z3, 2.2, 0.08, 0.9, PALETTE.iceSnow, 0, -a, 0);
    }
  }
  for (let i = 0; i < 20; i++) {
    const a = rand(0, 6.283), r = iceSPRING.r + rand(1.4, 3.4);
    const x = iceSPRING.x + Math.cos(a) * r, z = iceSPRING.z + Math.sin(a) * r;
    M.lump(x, iceTerrain(x, z) + 0.10, z, rand(0.6, 1.4), rand(0.3, 0.7), rand(0.6, 1.4),
           PALETTE.iceGeoRim, rand(-0.1, 0.1), rand(0, 3), rand(-0.1, 0.1));
  }
  // the rope fence everybody ignores
  // the rope fence everybody ignores. Tall and thin, so it frames rather than
  // blocks — and a gap in it, on the town side, so the way in is obvious.
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * 6.283;
    if (a > 1.1 && a < 2.1) continue;
    const x = iceSPRING.x + Math.cos(a) * (iceSPRING.r + 4.2);
    const z = iceSPRING.z + Math.sin(a) * (iceSPRING.r + 4.2);
    M.cyl(x, 0.55, z, 0.06, 1.1, PALETTE.iceMoraineDk);
    M.box(x, 0.95, z, 0.34, 0.12, 0.34, PALETTE.iceRope);
  }
  // --- and something to stand up in it ---------------------------------------
  // A geothermal field drawn only as coloured discs on flat ground reads as a
  // car park with puddles. What it actually has is fumaroles: cracked rock with
  // steam coming out of it, and sulphur staining round every vent.
  //
  // ================= AND IT WAS THE DARKEST GROUND IN THE GAME ==============
  //
  // The instrumented shot from the middle of this field is an almost black
  // plane with four black cubes on beige mats. Every other part of the chapter
  // has something to see by — the town has its windows, the harbour its
  // wheelhouses, the glacier is white and the sky has the aurora in it — and
  // this is the piece of ground the player crosses in EVERY direction, on the
  // way to the geyser, the spring, the lagoon and the run.
  //
  // A high-temperature field is not dark. It glows: the water in the vents is
  // near boiling and the sinter round them is white, and at midnight the whole
  // basin has a low warm haze sitting on it. Three things, all cheap: the
  // sinter terraces (the pale stepped rings that build up round any vent that
  // has been running a while), an emissive pool on the ground at every mouth,
  // and a great deal more steam standing over it.
  // ================= AND THEY WERE TWENTY-SIX OIL DRUMS =====================
  //
  // MEASURED off the instrumented shot from the middle of the field: `h =
  // rand(1.0, 3.6)`, `rr = rand(0.85, 2.1)` in iceMoraineDk and iceBasalt. That
  // is a stack up to four metres across and three and a half tall — taller than
  // the animal, wider than the hot dog stand — in the two darkest greys in the
  // palette, twenty-six times, on the one piece of ground the chapter crosses
  // in every direction. What it photographs as is a TANK FARM, and it is the
  // first thing the eye lands on in a chapter whose whole subject is emptiness.
  //
  // The note above is right about what a fumarole is and the geometry was
  // drawing something else. A fumarole is a HOLE: a wide low crust of boiled
  // rock, a broken lip you can see the heat through, and a plume. It belongs at
  // ankle height, and the only reason to build one taller is as a landmark —
  // so three of the twenty-six are, and they are the ones that stand where the
  // boardwalk turns.
  //
  // The sites come from iceVENT_SITES, decided before the ground was painted,
  // so the bleach under each one is exactly under it. See iceSinterAt.
  const VENT = [];
  const MOUTH = iceMerger();
  for (let i = 0; i < iceVENT_SITES.length; i++) {
    const s = iceVENT_SITES[i];
    const x = s.x, z = s.z, h = s.h, rr = s.r;
    const y = iceTerrain(x, z);
    const tall = h > 1.0;
    // THE APRON IS NOT GEOMETRY. First cut gave every vent three concentric
    // discs — sulphur, silica, snow — and the render is twenty-six FRIED EGGS:
    // a yellow ring round a white ring round an orange yolk, which is the
    // "however many rings you draw, each one is a flat value" note that Iceland
    // has now learned three times (the sodium pools, the moss cap, this). The
    // bleach round a vent belongs in the ground's own vertex colours, where it
    // has no edge at all, and iceSinterAt already puts it there.
    //
    // What is left in geometry is only the thing that is genuinely a THING: the
    // broken rim of the hole. Four crust slabs round the mouth at different
    // heights and angles, so it is a rim rather than a ring, and nothing
    // concentric anywhere.
    for (let k = 0; k < 4; k++) {
      const ka = i * 1.1 + k * 1.63;
      const kr = rr * (0.82 + ((i + k) % 3) * 0.16);
      M.lump(x + Math.cos(ka) * kr, y + 0.05 + h * (0.35 + (k % 2) * 0.30),
             z + Math.sin(ka) * kr,
             rr * (0.55 + (k % 3) * 0.14), h * 0.75 + 0.10, rr * 0.52,
             (i + k) % 3 ? PALETTE.iceGeoRim : PALETTE.iceMud,
             0.10 - (k % 2) * 0.2, -ka, Math.sin(ka) * 0.14);
    }
    // and a taller one has a proper stack in the middle of it, which is what
    // makes the three landmarks read as landmarks from across the field
    if (tall) {
      M.cone(x, y + 0.06 + h * 0.55, z, rr * 0.92, h * 1.1, PALETTE.iceMud,
             Math.sin(i * 1.7) * 0.07, i * 0.9, Math.cos(i * 2.1) * 0.07, 6);
    }
    // THE MOUTH, WHICH IS THE ONLY WARM THING ON THE GROUND AT NIGHT. It goes
    // in its own merger under an EMISSIVE material, never into the vertex-
    // coloured Lambert with the rest of the vent: the same law as the windows,
    // the beacon and the stars — a diffuse surface under a sky with almost no
    // light in it comes back black whichever way it faces, and this one has to
    // read from thirty metres.
    // SMALL. A vent mouth is a crack, not a hob ring: at rr * 0.52 the first
    // cut put a metre and a half of pure orange flat on the ground, twenty-six
    // times, and the field read as a runway.
    MOUTH.cyl(x, y + h * 0.45, z, rr * 0.24, 0.05, 0xffffff, 0, i * 0.5, 0, 6);
    // SOLID, AND THE BOX IS THE SIZE OF THE THING. The old line gave every one
    // of the twenty-six a box `h` tall where h was up to 3.6 — chest-high
    // invisible walls all over the one part of the biome the player crosses in
    // every direction. The vents are ankle-high now, so the collider is too:
    // under the capybara's 0.4 m step it is walked straight over and never
    // noticed, and the three that are landmarks are the only ones you go round.
    // (It costs no body either way — iceStaticGroup is one body for the field.)
    SG.add(x, y + h * 0.5, z, rr * 1.5, h, rr * 1.5);
    VENT.push(x, y + h + 0.10, z, rr);
  }
  // the mud pools between them, which plop and are the warmest colour out here
  for (let i = 0; i < 7; i++) {
    const a = rand(0, 6.283), r = rand(18, 40);
    const x = iceSTROKKUR.x + Math.cos(a) * r, z = iceSTROKKUR.z + Math.sin(a) * r;
    const y = iceTerrain(x, z);
    M.cyl(x, y + 0.05, z, rand(1.6, 3.0), 0.24, PALETTE.iceMud, 0, rand(0, 1), 0, 8);
    M.cyl(x, y + 0.16, z, rand(0.6, 1.2), 0.16, PALETTE.iceMoraineDk, 0, rand(0, 1), 0, 6);
    VENT.push(x, y + 0.20, z, 1.8);
  }
  SG.done();
  // and the boardwalk that runs through the whole field, which is the only
  // straight line in the biome and therefore the only thing that says "somebody
  // brings coaches here" — with a rope handrail down one side of it, because
  // that is the other thing every one of these has
  for (let i = 0; i < 30; i++) {
    const z = -22 + i * 1.9;
    const x = -6 + Math.sin(i * 0.22) * 9;
    const yy = iceTerrain(x, z);
    M.box(x, yy + 0.06, z, 2.6, 0.1, 2.0, PALETTE.iceRope, 0, Math.cos(i * 0.22) * 0.3, 0);
    if (i % 2 === 0) {
      M.cyl(x + 1.5, yy + 0.44, z, 0.055, 0.88, PALETTE.iceMoraineDk);
      M.box(x + 1.5, yy + 0.82, z, 0.06, 0.06, 3.9, PALETTE.iceRope, 0, Math.cos(i * 0.22) * 0.3, 0);
    }
  }

  const mesh = new THREE.Mesh(M.build(), iceVC());
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  root.add(mesh);

  // the vent mouths, self-illuminated. One mesh, one draw call, never a
  // shadow caster and never a shadow receiver: it is a hole with heat in it.
  {
    const mm = new THREE.Mesh(MOUTH.build(),
      mat(0x000000, { emissive: 0xc4682f, emissiveIntensity: 0.62 }));
    mm.castShadow = false;
    mm.receiveShadow = false;
    mm.userData.noShadow = true;
    root.add(mm);
  }

  // ---- THE GLOW OFF THE VENTS ---------------------------------------------
  // Additive, unfogged, never shadowed. Rings of flat discs on the ground, the
  // same shape as the sodium pools on the road in town — a light is a thing you
  // draw the POOL of, because nothing in this game casts one.
  {
    const pos = [], col = [];
    for (let i = 0; i < VENT.length; i += 4) {
      // ON THE GROUND, NOT ON THE VENT'S MOUTH. VENT[i+1] is the top of the
      // stack — up to 3.8 m in the air, because that is where the steam has to
      // be spawned from — and a pool of light three metres over the moss is a
      // lampshade with no lamp under it.
      iceGlowDisc(pos, col, VENT[i], iceTerrain(VENT[i], VENT[i + 2]) + 0.08, VENT[i + 2],
                  VENT[i + 3] * 5.6, 0.52, 0xb08046);
    }
    root.add(iceGlowMesh(pos, col));
    iceVents = VENT;
  }

  // --- the column of water, which only exists while it is going ---------------
  const cg = new THREE.CylinderGeometry(0.9, 2.0, 1, 8, 1, true);
  const col = new THREE.Mesh(cg, mat(PALETTE.iceSteam, { transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false }));
  col.position.set(iceSTROKKUR.x, iceTerrain(iceSTROKKUR.x, iceSTROKKUR.z), iceSTROKKUR.z);
  col.frustumCulled = false;
  root.add(col);
  iceGeyCol = col;

  const dg = new THREE.SphereGeometry(3.0, 10, 6);
  const dome = new THREE.Mesh(dg, mat(PALETTE.iceGeoBlue, { transparent: true, opacity: 0.0 }));
  dome.position.copy(col.position);
  dome.scale.set(1, 0.4, 1);
  root.add(dome);
  iceGeyDome = dome;
}

// ================================================================== STEAM ===
/**
 * One particle system for every plume in the biome — the geyser, the mud pots
 * and the hot pool. They are large, slow, pale and nearly transparent, which is
 * the only honest way to draw steam without a texture: it is not a puff, it is
 * a column that keeps arriving.
 */
function iceBuildSteam(root) {
  const geo = new THREE.SphereGeometry(0.5, 5, 4);
  // ---- A LAMBERT PUFF OF STEAM IS HALF BLACK, AND THIS IS THE NIGHT BIOME --
  //
  // The instrumented shot of the hot spring — the site of the one task in the
  // game that asks the player to do NOTHING, and the trigger for the aurora —
  // is a heap of pale hexagons with DARK GREY ones interleaved through it. That
  // is not fog and it is not overdraw: it is a diffuse surface under a sky that
  // has almost no light in it, so every facet pointing away from the low sun
  // comes back near-black. Steam has no diffuse response worth modelling; it is
  // a volume that scatters whatever light there is in every direction equally.
  //
  // Self-illuminated, which is the same law the town's windows, the snowcat's
  // beacon and the two hundred and sixty stars already use — no new material
  // class, and the plume is now one even value from every angle.
  const im = new THREE.InstancedMesh(geo, mat(0x000000, {
    emissive: PALETTE.iceSteam, emissiveIntensity: 0.62,
    transparent: true, opacity: 0.26, depthWrite: false, fog: true,
  }), iceSTEAM_N);
  im.frustumCulled = false;
  for (let i = 0; i < iceSTEAM_N; i++) iceSteamData[i * 8 + 6] = 0;
  root.add(im);
  iceSteam = im;
  iceSteamSync();
}
function iceSteamSpawn(x, y, z, up, spread, scale) {
  for (let i = 0; i < iceSTEAM_N; i++) {
    const o = i * 8;
    if (iceSteamData[o + 6] > 0) continue;
    iceSteamData[o] = x + rand(-spread, spread);
    iceSteamData[o + 1] = y;
    iceSteamData[o + 2] = z + rand(-spread, spread);
    iceSteamData[o + 3] = rand(-0.5, 0.5);
    iceSteamData[o + 4] = up * rand(0.7, 1.3);
    iceSteamData[o + 5] = rand(-0.5, 0.5);
    iceSteamData[o + 6] = rand(1.6, 3.2);
    iceSteamData[o + 7] = scale;
    return;
  }
}
function iceSteamSync() {
  if (!iceSteam) return;
  for (let i = 0; i < iceSTEAM_N; i++) {
    const o = i * 8;
    const life = iceSteamData[o + 6];
    const s = life > 0 ? iceSteamData[o + 7] * (0.5 + (3.2 - Math.min(life, 3.2)) * 0.7) : 0;
    iceSteam.setMatrixAt(i, iceXform(iceSteamData[o], iceSteamData[o + 1], iceSteamData[o + 2],
      0, 0, 0, s, s, s));
  }
  iceSteam.instanceMatrix.needsUpdate = true;
}
function iceUpdateSteam(dt) {
  for (let i = 0; i < iceSTEAM_N; i++) {
    const o = i * 8;
    if (iceSteamData[o + 6] <= 0) continue;
    iceSteamData[o] += iceSteamData[o + 3] * dt;
    iceSteamData[o + 1] += iceSteamData[o + 4] * dt;
    iceSteamData[o + 2] += iceSteamData[o + 5] * dt;
    iceSteamData[o + 4] = damp(iceSteamData[o + 4], 1.1, 1.4, dt);   // it slows and drifts
    iceSteamData[o + 6] -= dt;
  }
  iceSteamSync();
}

// =================================================================== SKY ====
/**
 * STARS. There is no unlit material in this game's law and there is not going
 * to be one, so a star is a tetrahedron three hundred metres away with its
 * emissive turned all the way up: a Lambert surface CAN be self-illuminated,
 * and one merged mesh of two hundred and sixty of them is a single draw call.
 */
function iceBuildStars(root) {
  const M = iceMerger();
  for (let i = 0; i < iceSTAR_N; i++) {
    // uniform on the upper hemisphere, biased away from the horizon where the
    // fog would eat them anyway
    const u = rand(0.16, 1), a = rand(0, 6.283);
    const r = Math.sqrt(1 - u * u);
    const R = 300;
    M.tet(Math.cos(a) * r * R, u * R * 0.8 + 40, Math.sin(a) * r * R,
      rand(0.9, 2.4), PALETTE.iceStar);
  }
  const mesh = new THREE.Mesh(M.build(), mat(0x000000, {
    vertexColors: true, emissive: PALETTE.iceStar, fog: false,
    transparent: true, opacity: 0.85, depthWrite: false,
  }));
  mesh.frustumCulled = false;
  mesh.renderOrder = -2;
  iceStarMat = mesh.material;
  iceStars = mesh;
  root.add(mesh);
}

/**
 * THE AURORA.
 *
 * Six curtains, each a long vertical ribbon hung across the northern sky, drawn
 * additively so that where two overlap the sky genuinely gets brighter. Each
 * one is two stacked bands: the lower band is the bright edge (that is where
 * the oxygen is being hit hardest and it is the part that has structure), the
 * upper is the diffuse wash that fades into the stars.
 *
 * The vertex positions ripple along their length on a travelling sine with a
 * different wavelength and speed per curtain, which is what makes it read as
 * one enormous slow thing rather than as six flags. Nothing about it is random
 * per frame: the phase is the only state.
 *
 * mat() caches by colour+options, so passing a distinct opacity seed per band
 * hands each one its OWN material — which is what makes it legal to write
 * .opacity on them every frame.
 */
function iceBuildAurora(root) {
  const cols = [PALETTE.iceAurora1, PALETTE.iceAurora2, PALETTE.iceAurora3,
                PALETTE.iceAurora4, PALETTE.iceAurora1, PALETTE.iceAuroraMag];
  // THE SKY RIDES WITH YOU. Fixed curtains cannot work: they have to be four
  // hundred metres out to sit low enough in the frame for a rig that looks
  // downward, and the whole playable world is three hundred metres across, so
  // any fixed position is directly overhead from one end of it and below the
  // horizon from the other. Parenting them to a group that tracks the animal in
  // x and z — and only x and z, so they never move relative to the ground plane
  // in a way the eye can catch — is the oldest trick there is and it is the
  // right one. The stars go in the same rig for the same reason.
  iceSkyRig = new THREE.Group();
  root.add(iceSkyRig);
  root = iceSkyRig;
  // THE CURTAINS HANG OVER THE WHOLE COUNTRY, NOT OVER THE NORTH OF IT.
  // The first build put them at z -180 to -350 and a hundred metres up, which is
  // where the real thing is and is about twenty degrees above the horizon from
  // the town — and the rig looks DOWN, so the ignition rendered as a photograph
  // of some grass. They are now spread from the glacier to the harbour and hung
  // lower, so that wherever the capybara is standing there is one of them
  // overhead and one of them on the horizon. Between that and the crane-up in
  // systems.js, the payoff of the chapter is in the frame.
  // An arc of them at four hundred-odd metres, so that whichever way the camera
  // is turned there is one at about ten degrees of elevation — which, with the
  // crane-up in systems.js, is exactly where the top third of the frame is.
  for (let i = 0; i < iceCURTAIN_N; i++) {
    const seg = 40;
    // A CURTAIN IS A RIBBON, NOT A CEILING. At 760 m long and 400 m out each
    // one subtended ninety-odd degrees, so six of them additively blended over
    // one another covered the entire sky in an even pale wash and the ignition
    // rendered as fog. Shorter and further apart leaves DARK SKY BETWEEN THEM,
    // which is the only thing that makes a band of light read as a band.
    const len = 330;
    // ...AND THE WHOLE FAN WAS BEHIND THE CAMERA, FOR ALL TWELVE SECONDS.
    //
    // Two comments above this one describe fixing the aurora's ELEVATION, twice.
    // Nobody checked its AZIMUTH. `czz = -cos(ang)*rad` fans the curtains across
    // -Z; the town, the pier, the sea and the rig's own rest yaw are all +Z, and
    // the camera parks behind the animal at -Z looking +Z. Measured at the
    // spring at full ignition: camera forward (0, -0.17, +0.99), and **0 of 984
    // curtain vertices in front of it** — best dot -0.078. Force-painting every
    // curtain magenta at opacity 1 with depthTest off still rendered nothing.
    //
    // The crane-up, the score swell, the fox, the locals and the toast all fire
    // correctly around an empty star field. This is the fourth pass over this
    // chapter and the marquee has never once been on screen.
    //
    // Mirrored in z. The yaw sign flips with it: a ribbon is tangential to the
    // circle, which is rotation.y = -ang at -Z and +ang at +Z. Getting that
    // wrong turns each curtain edge-on and it disappears a second time.
    const ang = -1.05 + (i / (iceCURTAIN_N - 1)) * 2.1;    // a fan across the sky the camera faces
    const rad = 360 + (i % 3) * 70;
    const cxx = Math.sin(ang) * rad, czz = Math.cos(ang) * rad;
    const yaw = ang + rand(-0.2, 0.2);
    for (let band = 0; band < 2; band++) {
      const y0 = band === 0 ? 46 : 84;
      const h = band === 0 ? 44 : 62;
      const g = new THREE.PlaneGeometry(len, h, seg, 1);
      g.translate(0, y0 + h * 0.5, 0);
      const m = new THREE.Mesh(g, mat(0x000000, {
        emissive: cols[i],
        transparent: true,
        opacity: 0.0001 * (i * 2 + band + 1),   // a distinct cache key per band
        // and it must never be fogged: it is four hundred metres away and the
        // fog would eat the entire chapter's payoff

        side: THREE.DoubleSide,
        depthWrite: false,
        fog: false,
        blending: THREE.AdditiveBlending,
      }));
      m.position.set(cxx, 0, czz);
      m.rotation.y = yaw;
      m.frustumCulled = false;
      m.renderOrder = -1;
      m.visible = false;
      root.add(m);
      iceCurtains.push({
        mesh: m,
        attr: g.attributes.position,
        base: Float32Array.from(g.attributes.position.array),
        phase: rand(0, 6.283),
        speed: rand(0.10, 0.24) * (i % 2 ? -1 : 1),
        wave: rand(0.006, 0.013),
        amp: band === 0 ? 18 : 30,
        peak: band === 0 ? 0.46 : 0.22,
      });
    }
  }
}

function iceUpdateAurora(dt) {
  const lvl = iceAurora;
  for (let i = 0; i < iceCurtains.length; i++) {
    const c = iceCurtains[i];
    const vis = lvl > 0.004;
    if (vis !== c.mesh.visible) c.mesh.visible = vis;
    if (!vis) continue;
    c.phase += c.speed * dt;
    const a = c.attr.array, b = c.base;
    for (let k = 0; k < a.length; k += 3) {
      const x = b[k];
      // the ripple runs ALONG the curtain and gets bigger toward the top, which
      // is the only way it reads as a sheet in a magnetic field rather than a
      // flag in a breeze
      const up = (b[k + 1] - 46) / 100;
      a[k + 2] = Math.sin(x * c.wave + c.phase) * c.amp * (0.35 + up) +
                 Math.sin(x * c.wave * 2.7 - c.phase * 1.6) * c.amp * 0.3 * up;
      a[k + 1] = b[k + 1] + Math.sin(x * c.wave * 1.6 + c.phase * 0.7) * 7 * up;
    }
    c.attr.needsUpdate = true;
    // each curtain breathes on its own slow cycle, so the whole sky never
    // pulses in unison — which is the tell of a fake one
    const breathe = 0.55 + 0.45 * Math.sin(iceTime * 0.37 + c.phase * 2.1);
    c.mesh.material.opacity = lvl * lvl * c.peak * breathe;
  }
  if (iceStarMat) iceStarMat.opacity = 0.85;
}

// ================================================================== FLORA ===
// ================================================================= SCATTER ==
/**
 * SEVEN INSTANCES PER THOUSAND SQUARE METRES.
 *
 * Measured across all seventeen chapters, the median world carries 46 pieces
 * of scatter per 1,000 m² of walkable ground. Iceland carried SEVEN — 576
 * instances over 81,952 m², the lowest density in the project by a factor of
 * six, on a landmass the player walks the entire length of twice. The Sahara,
 * which is mostly empty desert on purpose, carries 7,848.
 *
 * It is the same failure the Antarctic had before the last pass and it has the
 * same shape: one big beautifully-built landform with nothing standing on it.
 * iceBuildFlora's three loops (240 lupins, 200 moss discs, 320 rocks) are
 * spread EVENLY over four hundred metres of map, which is the second half of
 * the problem — an even wash of anything reads as a texture, and half of these
 * were rejected by the height test anyway.
 *
 * Nothing here is new geography and nothing here changes a published API. It
 * is what actually grows on the four grounds this chapter is made of:
 *
 *   THE LAVA FIELD (z 20..118) — Eldhraun. Broken basalt under a metre of
 *     woolly moss, and it is the strangest ground in Europe. Moss CUSHIONS
 *     (squashed spheres, never plates — a disc lying flat photographs as a
 *     green sheet of paper under a camera looking down 0.7 rad), rubble, and
 *     the lupins that were brought in to hold it down and now own the place.
 *   THE COAST AND THE TOWN (z 70..130) — tussock, drift timber, marker posts,
 *     and the racks fish are dried on.
 *   THE GEOTHERMAL FIELD (z -26..24) — sinter crust, mud pots, boiled-white
 *     ground and the sulphur that grows round a vent.
 *   THE MORAINE AND THE ICE (z < -78) — erratics, snow drifts, and the
 *     ablation stones that sit on their own pedestals.
 *
 * EVERY BATCH IS PER-REGION, and that is a performance decision rather than a
 * bookkeeping one: one instanced mesh spanning four hundred metres is never
 * frustum-culled, so at any moment the chapter pays for scatter in three
 * regions it cannot see. Twenty-eight batches of fifty metres each cull.
 *
 * AND ALMOST NONE OF IT CASTS. A moss cushion is 40 cm high on a black lava
 * field lit by a sun that never rises. Only the erratics, the posts and the
 * drying racks — the things that are taller than the animal — go in the
 * casting batches.
 */
/**
 * A GRID, NOT A LIST OF REGIONS.
 *
 * The first cut hand-wrote fourteen bands the size of the four grounds. That
 * is the right unit for THINKING about scatter and the wrong one for drawing
 * it: a batch a hundred and forty metres wide is inside the frustum from
 * anywhere in the chapter, so the world pays every frame for moss it cannot
 * see. Thirty-five cells of about seventy by fifty metres each are culled
 * properly, and the cost of the extra batches is a draw call apiece for
 * something that is usually not drawn at all.
 *
 * The cells that contain no ground of a given kind produce no batch, which is
 * why this is thirty-five cells and nothing like three hundred and fifty
 * meshes.
 */
const iceSCAT_BANDS = (function () {
  const XS = [-180, -108, -46, 0, 46, 108, 180];
  const ZS = [-196, -150, -108, -78, -26, 18, 48, 78, 106, 132];
  const out = [];
  for (let i = 0; i < XS.length - 1; i++) {
    for (let k = 0; k < ZS.length - 1; k++) {
      out.push(['c' + i + '-' + k, XS[i], XS[i + 1], ZS[k], ZS[k + 1]]);
    }
  }
  return out;
})();

/** Which of the four grounds is (x, z) on? Decided by the geography, once. */
function iceGroundKind(x, z) {
  if (z < iceGL_Z0 + 4) return iceGroundSlip(x, z) > 0.28 ? 'ice' : 'moraine';
  if (z < -26) return 'shore';
  if (z < 22) return 'geo';
  if (z < 70) return 'lava';
  return 'town';
}

/**
 * True where nothing may be planted: on the street, in the doorway of the
 * church, on the pier, inside the hot pool, on the geyser's catchment, and in
 * the two places the chapter puts the player down.
 *
 * Trap 10 in the other direction: it is no use sampling inside the land if the
 * land you sample is the one strip the player has to walk.
 */
function iceScatBlocked(x, z) {
  if (Math.abs(z - iceLANES[0]) < 7 && Math.abs(x) < 56) return true;        // the street
  if (Math.abs(x - iceSPAWN.x) < 7 && Math.abs(z - iceSPAWN.z) < 7) return true;
  if (Math.abs(x - icePIER.x) < 6 && z > icePIER.z - 6) return true;         // the pier
  if (Math.abs(x - iceCHURCH.x) < 13 && Math.abs(z - iceCHURCH.z) < 15) return true;
  {
    const dx = x - iceSPRING.x, dz = z - iceSPRING.z;
    if (dx * dx + dz * dz < (iceSPRING.r + 3) * (iceSPRING.r + 3)) return true;
  }
  {
    const dx = x - iceSTROKKUR.x, dz = z - iceSTROKKUR.z;
    if (dx * dx + dz * dz < 9 * 9) return true;                              // the catchment
  }
  {
    const dx = x - iceGEYSIR.x, dz = z - iceGEYSIR.z;
    if (dx * dx + dz * dz < 7 * 7) return true;
  }
  // the two rows of houses, and the back row
  if (z > 66 && z < 128) {
    for (let i = 0; i < iceROWS.length; i++) if (Math.abs(z - iceROWS[i]) < 6) return true;
    if (Math.abs(z - iceBACKROW) < 6) return true;
  }
  return false;
}

/**
 * The clumped sampler. A stand of lupins is a STAND — forty of them in eleven
 * metres of ground and none for the next forty — and so is a moss field, a
 * patch of tussock and a scatter of erratics off one boulder that broke up.
 * An even spread of anything is a texture; a clump is a plant.
 *
 * Returns the number actually planted, because every one of these is gated on
 * a height test and a blocked test and the caller has no other way to know.
 */
function iceScatClumps(band, tries, perClump, spread, kind, place) {
  let n = 0;
  for (let c = 0; c < tries; c++) {
    // ---- AND THE CENTRE SEARCH RETRIES -----------------------------------
    // First cut took ONE sample per clump and dropped the clump if it was not
    // on the right ground. A band is a rectangle and a ground is a stripe, so
    // for four of the five grounds that rectangle is mostly the wrong stripe:
    // measured, the whole pass planted 554 pieces against a budget of three
    // thousand and the chapter came out at 1,130 instances, still a quarter of
    // the seventeen-chapter median. Trap 10, in its usual form — sample INSIDE
    // the places there is the thing you are looking for.
    let cx = 0, cz = 0, ok = false;
    for (let t = 0; t < 8 && !ok; t++) {
      cx = rand(band[1], band[2]); cz = rand(band[3], band[4]);
      ok = iceGroundKind(cx, cz) === kind && !iceIsOverWater(cx, cz) &&
           iceTerrain(cx, cz) >= 0.15;
    }
    if (!ok) continue;
    const m = perClump[0] + ((c * 7) % Math.max(1, perClump[1] - perClump[0] + 1));
    for (let k = 0; k < m; k++) {
      const a = rand(0, 6.28318), r = Math.sqrt(Math.random()) * spread;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (iceScatBlocked(x, z)) continue;
      if (iceIsOverWater(x, z)) continue;
      const y = iceTerrain(x, z);
      if (y < 0.12) continue;
      place(x, y, z, k, c);
      n++;
    }
  }
  return n;
}

let iceScatMeshes = [];

function iceBuildScatter(game, root) {
  iceScatMeshes = [];
  // Everything in this pass that is taller than about a metre is SOLID, and
  // it is all one body: iceStaticGroup exists because this chapter was already
  // two bodies over a hard budget of 130 when it shipped. An erratic you can
  // walk through is a walk-through hit in qa/audit-solid.js and, worse, it is
  // the only object on the moraine that reads as an obstacle.
  const SG = iceStaticGroup(game);
  const mkBatch = (geo, colour, list, cast, recv, name, two) => {
    if (!list.length) return;
    const m = iceInstance(root, geo, colour, list, cast, recv, two);
    if (m) { m.name = name; iceScatMeshes.push(m); }
  };
  for (let b = 0; b < iceSCAT_BANDS.length; b++) {
    const band = iceSCAT_BANDS[b];
    const id = band[0];
    // one list per shape per band, so every batch is a box fifty metres across
    // and the frustum can throw it away
    const moss = [], lupin = [], lupinHead = [], rubble = [], tussock = [];
    const crust = [], sulphur = [], erratic = [], drift = [], post = [];

    // ---- THE LAVA FIELD ---------------------------------------------------
    // Moss cushions: SQUASHED SPHERES. The existing field draws these as
    // cyl6 discs 3.6 m across and 32 cm high — under a camera that looks down
    // about 0.7 rad that is a green sheet of paper, which is the single most
    // repeated mistake in this codebase (Manly's rock pools, the Pantanal's
    // lily rims, the cave's moss discs, the Antarctic sastrugi, the Drift's
    // ferns). Woolly fringe moss actually grows in domes the size of a
    // football and merges into a mattress of them.
    // MANY SMALL CLUMPS RATHER THAN A FEW BIG ONES. Measured off the render
    // standing in the middle of the lava field: forty clumps of up to twenty-two
    // over a fifty-metre band is six dense islands and forty metres of bare
    // green between them, and the frame is an empty plane with some scenery in
    // the top corner. Three times as many clumps of a third the size covers the
    // same budget and covers the GROUND.
    iceScatClumps(band, 50, [3, 9], 8.5, 'lava', (x, y, z, k, c) => {
      // ---- AND A SPHERE WITH FOUR RINGS IN IT HAS A FLAT TOP -------------
      // iceG.sph6 is SphereGeometry(0.5, 6, 4): six segments round and FOUR up,
      // so the cap is one big hexagon. Squash it to 0.62 of its height and what
      // this camera photographs is a green hexagonal plate lying in the grass —
      // which is the exact failure the cushions were drawn to avoid, arrived at
      // from the other direction. iceG.rock is a nudged icosahedron: twenty
      // triangles instead of thirty-six, no flat cap anywhere on it, and it is
      // already lumpy, which is what moss is.
      const s = 0.55 + ((k * 5 + c) % 7) * 0.16;
      icePush9(moss, x, y + s * 0.30, z, (k % 3) * 0.12, (k + c) * 1.1, (c % 3) * 0.1,
               s, s * 0.78, s * 0.94);
      if ((k + c) % 3 === 0) {
        const r2 = 0.30 + ((k * 3) % 4) * 0.16;
        icePush9(rubble, x + s * 0.9, y + r2 * 0.3, z - s * 0.6,
                 (k % 3) * 0.4, k * 1.7, (c % 3) * 0.3, r2, r2 * 0.75, r2 * 1.1);
      }
    });
    // Lupins, in stands, and a lupin is a SPIKE with a head on it — the whole
    // reason the place looks the way it does in June is the purple candle, and
    // a 22 cm stick in iceLupin is a twig.
    // The lupins are the exception and stay clumped: they really do grow in
    // stands with clear ground between them, and a stand is the whole picture.
    iceScatClumps(band, 8, [18, 36], 5.4, 'lava', (x, y, z, k, c) => {
      const h = 0.62 + ((k * 3 + c) % 5) * 0.13;
      const tl = ((k * 11 + c) % 7) * 0.03;
      icePush9(lupin, x, y + h * 0.42, z, tl, k * 2.1, tl * 0.5, 0.055, h, 0.055);
      icePush9(lupinHead, x + tl * h, y + h * 0.86, z, tl, k * 2.1, tl * 0.5,
               0.14, h * 0.52, 0.14);
    });

    // ---- THE COAST AND THE TOWN ------------------------------------------
    iceScatClumps(band, 32, [4, 10], 7.5, 'town', (x, y, z, k, c) => {
      const h = 0.34 + ((k * 7 + c) % 5) * 0.10;
      // tussock: three blades to a tuft, and they STAND UP. 1.25 rad, not the
      // 0.3 that turns a blade into a card.
      for (let q = 0; q < 3; q++) {
        icePush9(tussock, x + Math.cos(k + q * 2.1) * 0.09, y + h * 0.42,
                 z + Math.sin(k + q * 2.1) * 0.09, 1.25 - (q % 2) * 0.14,
                 k + q * 2.1, 0, 0.09, 1, h);
      }
      if ((k + c) % 5 === 2) {
        const r2 = 0.26 + ((k * 5) % 4) * 0.14;
        icePush9(rubble, x, y + r2 * 0.3, z, (k % 3) * 0.3, k * 1.3, 0, r2, r2 * 0.8, r2);
      }
    });
    // driftwood and marker posts, along the shore only. These are the ones
    // that DO cast: they are the height of the animal and they stand on the
    // one strip of this chapter that has a light on it.
    {
      iceScatClumps(band, 5, [1, 3], 7.0, band[3] > -26 ? 'town' : 'shore',
        (x, y, z, k, c) => {
          if (z > 60 && z < 96) return;    // driftwood belongs on a shore
          if ((k + c) % 2) {
            const l = 1.6 + ((c * 3) % 4) * 0.7;
            icePush9(drift, x, y + 0.18, z, 0.06, c * 1.7, Math.PI * 0.5, 0.22, l, 0.22);
          } else {
            const h = 1.1 + ((c * 5) % 4) * 0.35;
            icePush9(post, x, y + h * 0.5, z, 0.04 * ((c % 3) - 1), c * 0.9, 0.03, 0.13, h, 0.13);
            SG.add(x, y + h * 0.5, z, 0.34, h, 0.34, 0);
          }
        });
    }

    // ---- THE GEOTHERMAL FIELD --------------------------------------------
    // Sinter: the ground round a hot spring is boiled white and it crusts in
    // PLATES, which is the one place in this chapter a flat disc is honest —
    // and it is a MARK, so it is 4 cm proud and never casts.
    iceScatClumps(band, 22, [4, 10], 6.5, 'geo', (x, y, z, k, c) => {
      const s = 0.7 + ((k * 5 + c) % 6) * 0.34;
      icePush9(crust, x, y + 0.045, z, 0, k * 1.4, 0, s, 0.09, s * 0.86);
      if ((k + c) % 4 === 1) {
        const s2 = 0.18 + ((k * 3) % 4) * 0.09;
        icePush9(sulphur, x + s * 0.5, y + s2 * 0.4, z + s * 0.3, 0, k * 2.2, 0,
                 s2, s2 * 0.8, s2);
      }
    });

    // ---- THE MORAINE AND THE ICE -----------------------------------------
    // Erratics: a boulder carried down and dropped, and they come in TRAINS —
    // a line of them off one break in the valley wall, which is the only
    // scatter in the chapter that says the ice used to be higher than this.
    iceScatClumps(band, 20, [3, 7], 9.5, 'moraine', (x, y, z, k, c) => {
      // 0.7 to 3.45 m put four-metre boulders all along the one bank the player
      // walks up to the glacier, and every one of them was walk-through.
      // Erratics come in every size; the ones over a metre are furniture and
      // are solid, and the rest are gravel.
      const s = 0.45 + ((k * 7 + c) % 6) * 0.28;
      // A BOULDER CASTS AND GRAVEL DOES NOT. Every stone on the moraine went
      // into one casting batch, so a 45 cm pebble under a sun eight degrees up
      // was drawn twice to lay a smear on the shingle beside it. The ones the
      // animal has to walk round cast; the ones it walks over do not, and it
      // is the same line as the one that decides which of them are solid.
      icePush9(s > 1.0 ? erratic : rubble, x, y + s * 0.30, z,
               (k % 4) * 0.22, k * 1.9, (c % 4) * 0.19, s, s * 0.68, s * 1.05);
      if (s > 1.0) SG.add(x, y + s * 0.30, z, s * 0.86, s * 0.68, s * 0.90, k * 1.9);
    });
    // and on the ice, ablation stones — a dark stone on white ice melts a pit
    // under itself, so it always sits in a dish. They are what gives the run
    // any optical flow at all at nineteen metres a second.
    iceScatClumps(band, 15, [4, 9], 9.0, 'ice', (x, y, z, k, c) => {
      const s = 0.26 + ((k * 5 + c) % 5) * 0.13;
      icePush9(rubble, x, y + s * 0.24, z, (k % 3) * 0.3, k * 2.3, 0, s, s * 0.6, s);
    });

    mkBatch(iceG.rock, PALETTE.iceMoss, moss, false, true, 'iceScat:moss:' + id);
    mkBatch(iceG.cyl4, PALETTE.iceMoss, lupin, false, false, 'iceScat:lupinStem:' + id);
    mkBatch(iceG.cone6, PALETTE.iceLupin, lupinHead, false, false, 'iceScat:lupin:' + id);
    mkBatch(iceG.rock, PALETTE.iceBasalt, rubble, false, true, 'iceScat:rubble:' + id);
    mkBatch(iceG.quad, PALETTE.iceMossPale, tussock, false, false, 'iceScat:tussock:' + id, true);
    mkBatch(iceG.disc, PALETTE.iceGeoRim, crust, false, true, 'iceScat:crust:' + id);
    mkBatch(iceG.sph6, PALETTE.iceMud, sulphur, false, false, 'iceScat:sulphur:' + id);
    mkBatch(iceG.rock, PALETTE.iceMoraine, erratic, true, true, 'iceScat:erratic:' + id);
    mkBatch(iceG.cyl6, PALETTE.iceRope, drift, true, true, 'iceScat:drift:' + id);
    mkBatch(iceG.cyl6, PALETTE.iceRope, post, true, true, 'iceScat:post:' + id);
  }
  SG.done();
}

// ============================================================ WHAT IS BUILT ==
/**
 * FOUR THINGS EVERY PHOTOGRAPH OF THIS COUNTRY HAS IN IT AND THIS CHAPTER HAD
 * NONE OF.
 *
 * Iceland shipped with a town, a church, a harbour, a pier, a hot-dog stand and
 * a snowcat — six built things over eighty-two thousand square metres, all of
 * them within fifty metres of each other at the south end. Everything north of
 * the lava field was landscape with nothing made in it, which is why the walk
 * to the glacier reads as twice as long as it is: there is no way to measure
 * progress against anything.
 *
 *   VÖRÐUR, the cairns. Before there were roads, the way across a lava field
 *     was marked by a line of stacked stones you could see from the last one.
 *     They are the single most useful object that could be added to this
 *     chapter — a route marker on the one walk everybody makes twice — and
 *     they are eleven stones each.
 *   TORFBÆIR, the turf houses. Walls and roof of cut turf on a timber frame,
 *     because there was no wood and no stone worth quarrying. Grass growing on
 *     the roof, which is the postcard.
 *   HJALLUR, the drying rack. A frame of poles with rows of fish hanging in it,
 *     standing in the wind on the shore, and the one piece of industry in the
 *     landscape.
 *   COLUMNAR BASALT. The headland is called basalt in the header, is the thing
 *     the chapter frames, and was drawn as a lump. Cooling lava contracts into
 *     hexagonal columns, and that is the reason anybody photographs Iceland.
 *
 * Each is its own mesh. That is not bookkeeping: they are in four different
 * places forty to two hundred metres apart, and a merged mesh spanning all of
 * them can never be frustum-culled.
 */

/** The line of cairns, from the last house to the foot of the glacier. */
const iceCAIRN_PATH = [
  [22, 66], [26, 44], [30, 24], [34, 4], [37, -16], [38, -34],
  [37, -52], [35, -68], [34, -84], [33, -98], [32, -112], [31, -126],
];

function iceBuildCairns(game, root) {
  const M = iceMerger();
  const SG = iceStaticGroup(game);
  for (let i = 0; i < iceCAIRN_PATH.length; i++) {
    const x = iceCAIRN_PATH[i][0], z = iceCAIRN_PATH[i][1];
    if (iceIsOverWater(x, z)) continue;
    const gy = iceTerrain(x, z);
    if (gy < 0.1) continue;
    // eleven stones, each smaller than the last, each turned a little, and the
    // stack LEANS: a cairn built by hand out of what was lying about is never
    // plumb and that is the whole of why it reads as built rather than grown.
    const lean = 0.05 + (i % 3) * 0.035;
    const la = i * 1.7;
    let y = gy, top = 0;
    for (let k = 0; k < 11; k++) {
      const r = 0.66 - k * 0.045;
      const h = 0.20 - k * 0.008;
      const off = (y - gy) * lean;
      M.box(x + Math.cos(la) * off + Math.sin(k * 2.3) * 0.05, y + h * 0.5,
            z + Math.sin(la) * off + Math.cos(k * 1.9) * 0.05,
            r * 2, h, r * 1.7,
            k % 3 === 0 ? PALETTE.iceMoraineDk : (k % 3 === 1 ? PALETTE.iceMoraine : PALETTE.iceBasalt),
            0.04 * Math.sin(k), la + k * 0.5, 0.04 * Math.cos(k));
      y += h; top = y - gy;
    }
    // and a flat one on the very top, laid the other way, which is what a
    // cairn-builder does last
    M.box(x + Math.cos(la) * top * lean, y + 0.06, z + Math.sin(la) * top * lean,
          0.62, 0.12, 0.86, PALETTE.iceMoraineDk, 0, la + 1.2, 0);
    SG.add(x, gy + top * 0.5, z, 1.25, top, 1.25, 0);
  }
  SG.done();
  const m = new THREE.Mesh(M.build(), iceVC());
  m.name = 'iceCairns';
  m.castShadow = true;
  m.receiveShadow = true;
  root.add(m);
}

/** Three turf houses, dug into the bank on the west side of the lava field. */
const iceTURF = [[-58, 46, 0.5], [-72, 38, -0.35], [-64, 30, 1.15]];

function iceBuildTurfHouses(game, root) {
  const M = iceMerger();
  const G = iceMerger();          // the grass on the roof, which is a second tone
  const SG = iceStaticGroup(game);
  for (let i = 0; i < iceTURF.length; i++) {
    const x = iceTURF[i][0], z = iceTURF[i][1], yaw = iceTURF[i][2];
    const gy = iceTerrain(x, z);
    if (gy < 0.2) continue;
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    const P = (rx, fz) => [x + rx * c + fz * sn, z - rx * sn + fz * c];
    // three gables in a row, which is what a torfbær is: not one building but
    // a terrace of little ones sharing walls, each with its own end wall of
    // stacked turf facing the weather
    for (let g2 = 0; g2 < 3; g2++) {
      const off = (g2 - 1) * 3.6;
      const [wx, wz] = P(off, 0);
      // the turf walls: courses of cut sod, laid herringbone, which is why
      // they are drawn as alternating blocks rather than as a slab
      for (let k = 0; k < 5; k++) {
        M.box(wx, gy + 0.30 + k * 0.52, wz, 3.3, 0.50, 4.6,
              k % 2 ? PALETTE.iceMoss : PALETTE.iceMossPale,
              0, yaw + (k % 2 ? 0.02 : -0.02), 0);
      }
      // the gable end, and the one small window in it
      const [fx, fz2] = P(off, 2.35);
      M.box(fx, gy + 1.55, fz2, 3.0, 3.1, 0.22, PALETTE.iceRope, 0, yaw, 0);
      M.box(fx, gy + 0.85, fz2 - sn * 0.14, 0.85, 1.5, 0.10, PALETTE.iceBasaltDk, 0, yaw, 0);
      // the roof: two slopes of turf, and grass growing on top of it
      for (let sd = -1; sd <= 1; sd += 2) {
        const [rx2, rz2] = P(off + sd * 0.9, 0);
        M.box(rx2, gy + 3.05, rz2, 2.3, 0.34, 4.9, PALETTE.iceMossPale,
              0, yaw, -sd * 0.62);
        G.box(rx2 - sd * 0.06, gy + 3.26, rz2, 2.2, 0.16, 4.8, PALETTE.iceMoss,
              0, yaw, -sd * 0.62);
      }
      SG.add(wx, gy + 1.7, wz, 3.5, 3.4, 4.8, yaw);
    }
    // a low turf wall running off the end of the terrace, and a gate post
    for (let k = 0; k < 7; k++) {
      const [ax, az] = P(6.2 + k * 1.35, -1.2 - k * 0.25);
      M.box(ax, gy + 0.34, az, 1.4, 0.68, 1.0, k % 2 ? PALETTE.iceMoss : PALETTE.iceMossPale,
            0, yaw + k * 0.06, 0);
      SG.add(ax, gy + 0.34, az, 1.5, 0.70, 1.1, yaw);
    }
  }
  SG.done();
  const m = new THREE.Mesh(M.build(), iceVC());
  m.name = 'iceTurfHouses';
  m.castShadow = true; m.receiveShadow = true;
  root.add(m);
  const g3 = new THREE.Mesh(G.build(), iceVC());
  g3.name = 'iceTurfRoofs';
  // The grass on a roof is a MARK on it — flush, two centimetres of edge, and
  // it never casts. The alternative is every roof in the row throwing a second
  // hard shadow eight centimetres inside its own.
  g3.castShadow = false;
  g3.userData.noShadow = true;
  g3.receiveShadow = true;
  root.add(g3);
}

/** Two drying racks on the shore by the harbour, and the fish in them. */
const iceRACK = [[44, 122, 0.35], [52, 114, -0.2]];

function iceBuildRacks(game, root) {
  const M = iceMerger();
  const SG = iceStaticGroup(game);
  for (let i = 0; i < iceRACK.length; i++) {
    const x = iceRACK[i][0], z = iceRACK[i][1], yaw = iceRACK[i][2];
    const gy = iceTerrain(x, z);
    if (gy < 0.2) continue;
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    const P = (rx, fz) => [x + rx * c + fz * sn, z - rx * sn + fz * c];
    const N = 5;
    for (let k = 0; k < N; k++) {
      const off = (k - (N - 1) * 0.5) * 2.6;
      // an A-frame, because a rack has to stand up in an Atlantic gale
      for (let sd = -1; sd <= 1; sd += 2) {
        const [px, pz] = P(off, sd * 1.5);
        M.cyl(px, gy + 1.5, pz, 0.11, 3.1, PALETTE.iceRope, -sd * 0.14, yaw, 0, 6);
      }
      const [tx, tz] = P(off, 0);
      M.cyl(tx, gy + 3.0, tz, 0.09, 3.2, PALETTE.iceRope, Math.PI * 0.5, yaw, 0, 6);
      SG.add(tx, gy + 1.55, tz, 0.4, 3.1, 3.2, yaw);
    }
    // the two long rails, and the fish
    for (let r = 0; r < 2; r++) {
      const [rx2, rz2] = P(0, (r - 0.5) * 1.9);
      M.cyl(rx2, gy + 2.55 + r * 0.34, rz2, 0.07, (N - 1) * 2.6 + 1.2, PALETTE.iceRope,
            0, yaw, Math.PI * 0.5, 6);
      for (let f = 0; f < 22; f++) {
        const [fx, fz2] = P(-((N - 1) * 2.6) * 0.5 + f * ((N - 1) * 2.6 / 21),
                            (r - 0.5) * 1.9);
        // a split fish hung by the tail is a long flat wedge, and it TURNS in
        // the wind: every one at a slightly different angle is the only thing
        // that stops twenty-two of them reading as a comb
        M.box(fx, gy + 2.10 + r * 0.34, fz2, 0.10, 0.86, 0.30,
              f % 3 ? PALETTE.iceRope : PALETTE.iceMud, 0, yaw + f * 0.31, 0.05 * ((f % 3) - 1));
      }
    }
  }
  SG.done();
  const m = new THREE.Mesh(M.build(), iceVC());
  m.name = 'iceRacks';
  m.castShadow = true; m.receiveShadow = true;
  root.add(m);
}

/**
 * COLUMNAR BASALT, on the headland the chapter frames.
 *
 * iceBuildCliff draws a nineteen-metre lump with 1,100 puffins on it. The rock
 * it is made of contracts into HEXAGONS as it cools, in colonnades that step
 * down to the sea, and it is the single most photographed thing in the country.
 * Six-sided cylinders, packed on a hex lattice, each a different height and
 * each with a broken top: it is the same trick the seracs use and it costs
 * twelve triangles a column.
 *
 * They stand round the SEAWARD half of the headland only, and never inside the
 * puffin colony's ledges — the birds are placed off iceCLIFF.r and a colonnade
 * standing in that band would have a hundred and fifty birds inside it.
 */
function iceBuildColumns(game, root) {
  const M = iceMerger();     // the front rank: casts, because the shadow of a
                             // colonnade on its own talus IS the picture
  const MN = iceMerger();    // and the three behind it, which cast onto rock
                             // that is already in the shadow of the rank in
                             // front — 8,000 triangles drawn twice for nothing
  const SG = iceStaticGroup(game);
  const cx = iceCLIFF.x, cz = iceCLIFF.z, R = iceCLIFF.r;
  const PITCH = 1.55;
  let n = 0;
  for (let ring = 0; ring < 4; ring++) {
    const rr = R + 2.0 + ring * PITCH * 0.87;
    const count = Math.max(6, Math.round(6.28318 * rr / PITCH));
    for (let k = 0; k < count; k++) {
      const a = k / count * 6.28318 + ring * 0.22;
      // ---- THE SEAWARD QUARTER ONLY, AND NOT NINETEEN METRES TALL ---------
      // First cut: the whole half-circle at up to iceCLIFF.h (19 m), based at
      // sea level. Photographed from the old harbour — which is eighteen metres
      // away at x = 26 — that is a row of nineteen-metre black slabs standing
      // over the boats like a paling fence, and the arc reached round to within
      // a few metres of the quay. Reynisfjara's colonnade is five to twelve
      // metres and it is on the SEA side of the headland, stepping down into
      // the water; the landward side is the grass slope the player walks up to
      // the colony.
      //
      // So: the east-south-east quadrant, nothing where the ground is more than
      // two metres up (a column is a thing that stands IN the sea), and a
      // height that steps down rank by rank rather than starting at the top of
      // the cliff.
      if (Math.sin(a) < -0.10 || Math.cos(a) < 0.12) continue;
      const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
      if (z < iceSEA_Z - 24) continue;
      if (iceTerrain(x, z) > 2.0) continue;
      const h = Math.max(1.8, 10.5 - ring * 1.9 - ((k * 7) % 5) * 0.75);
      const T = ring === 0 ? M : MN;
      T.cyl(x, iceSEA_Y + h * 0.5, z, PITCH * 0.5, h,
            (k + ring) % 3 ? PALETTE.iceBasalt : PALETTE.iceBasaltDk,
            0, a * 0.3 + k, 0, 6);
      // the fractured cap, tilted, which is what makes a colonnade read as
      // broken rock rather than as organ pipes
      T.cyl(x, iceSEA_Y + h + 0.09, z, PITCH * 0.48, 0.18,
            (k % 2) ? PALETTE.iceMoraineDk : PALETTE.iceBasalt,
            0.06 * Math.sin(k * 1.7), a, 0.06 * Math.cos(k * 1.3), 6);
      if (ring < 2 && (k % 3) === 0) SG.add(x, iceSEA_Y + h * 0.5, z, PITCH, h, PITCH, 0);
      n++;
    }
  }
  SG.done();
  if (!n) return;
  const m = new THREE.Mesh(M.build(), iceVC());
  m.name = 'iceColumns';
  m.castShadow = true; m.receiveShadow = true;
  root.add(m);
  if (MN.n > 0) {
    const mn = new THREE.Mesh(MN.build(), iceVC());
    mn.name = 'iceColumnsBack';
    mn.castShadow = false;
    mn.userData.noShadow = true;
    mn.receiveShadow = true;
    root.add(mn);
  }
}

/**
 * THE SHEEP, which outnumber the people three to one and are the only thing
 * moving in the landscape between the town and the ice.
 *
 * Three small flocks, each on its own instanced pair (body and head), each
 * grazing round a centre on its own slow clock. They are not a mechanic and
 * they are not a task: they are the thing that makes a hundred and fifty
 * metres of empty moss read as somewhere rather than as a gap between two
 * places. They scatter when wheeked at, which is the only thing they do.
 */
const iceFLOCKS = [
  { x: -40, z: 54, r: 13, n: 14 },
  { x: 62, z: 40, r: 11, n: 11 },
  { x: -20, z: -46, r: 12, n: 12 },
];
const iceSheep = [];             // { body, head, data:Float32Array, def }
const iceSHEEP_STRIDE = 6;       // x, z, yaw, phase, home a, spook

function iceBuildSheep(root) {
  iceSheep.length = 0;
  for (let f = 0; f < iceFLOCKS.length; f++) {
    const F = iceFLOCKS[f];
    if (iceTerrain(F.x, F.z) < 0.2) continue;
    const bodies = [], heads = [];
    const data = new Float32Array(F.n * iceSHEEP_STRIDE);
    for (let i = 0; i < F.n; i++) {
      const a = rand(0, 6.28318), r = Math.sqrt(Math.random()) * F.r;
      const x = F.x + Math.cos(a) * r, z = F.z + Math.sin(a) * r;
      const o = i * iceSHEEP_STRIDE;
      data[o] = x; data[o + 1] = z; data[o + 2] = rand(0, 6.28318);
      data[o + 3] = rand(0, 6.28318); data[o + 4] = a; data[o + 5] = 0;
      icePush9(bodies, x, iceTerrain(x, z) + 0.42, z, 0, data[o + 2], 0, 0.52, 0.50, 0.86);
      icePush9(heads, x, iceTerrain(x, z) + 0.40, z, 0, data[o + 2], 0, 0.26, 0.26, 0.30);
    }
    const bm = iceInstance(root, iceG.sph6, PALETTE.iceSnow, bodies, true, true);
    const hm = iceInstance(root, iceG.box, PALETTE.iceBasaltDk, heads, false, false);
    if (!bm) continue;
    bm.name = 'iceSheep' + f;
    bm.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (hm) { hm.name = 'iceSheepHead' + f; hm.instanceMatrix.setUsage(THREE.DynamicDrawUsage); }
    iceSheep.push({ body: bm, head: hm, data: data, def: F });
  }
}

let iceSheepSpook = 0;
// SIX AND A HALF METRES OF SHUFFLE, and it used to be the literal `42` in a
// squared-distance test. It is the base of a calm-aware radius now — a flock
// that keeps its distance from an animal walking about and closes over one
// that has stopped. See THE CALM in systems.js.
const iceSHEEP_NEAR = 6.48;
const iceSHEEP_APPR_STOP = 2.6;   // m short of a sat-down capybara a sheep stops
const iceSHEEP_APPR_SEE  = 22;    // m — beyond this it has not noticed you at all
let iceSheepCrit = null;

function iceUpdateSheep(game, dt) {
  if (!iceSheep.length) return;
  const p = game.capy && game.capy.position;
  if (iceSheepSpook > 0) iceSheepSpook -= dt;
  if (!iceSheepCrit && typeof game.addCritter === 'function') {
    // bold 0.7: a sheep will come and look at you, and it will take longer to
    // make up its mind about it than a heron does. See THE LOAF in systems.js.
    iceSheepCrit = game.addCritter({ biome: 'iceland', r: iceSHEEP_NEAR, bold: 0.7 });
  }
  const near = iceSheepCrit ? iceSheepCrit.near : iceSHEEP_NEAR;
  const iceSheepNear2 = near * near;
  const sheepAppr = iceSheepCrit ? (iceSheepCrit.appr || 0) : 0;
  for (let f = 0; f < iceSheep.length; f++) {
    const S = iceSheep[f], D = S.data, F = S.def;
    for (let i = 0; i < F.n; i++) {
      const o = i * iceSHEEP_STRIDE;
      D[o + 3] += dt * (0.18 + (i % 5) * 0.03);
      // a grazing sheep walks two metres and stops for a minute. The wander is
      // a slow circle round its own patch of the flock's ground, and the
      // ANIMAL is the head: it is down in the grass except when it is not.
      let tx = F.x + Math.cos(D[o + 4]) * F.r * (0.35 + 0.6 * Math.abs(Math.sin(D[o + 3] * 0.31)));
      let tz = F.z + Math.sin(D[o + 4]) * F.r * (0.35 + 0.6 * Math.abs(Math.cos(D[o + 3] * 0.27)));
      D[o + 4] += dt * 0.06 * ((i % 2) ? 1 : -1);
      // and they get out of the way. A capybara is not a threat and they know
      // it, so this is a shuffle rather than a stampede — six metres of reach
      // and they come straight back.
      if (p) {
        const dx = D[o] - p.x, dz = D[o + 1] - p.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < iceSheepNear2 && d2 > 0.01) {
          const inv = 1 / Math.sqrt(d2);
          tx = D[o] + dx * inv * 5.5;
          tz = D[o + 1] + dz * inv * 5.5;
          D[o + 5] = 1;
        } else if (D[o + 5] > 0) D[o + 5] = Math.max(0, D[o + 5] - dt * 0.5);
        // ---- ...AND THE OTHER WAY ROUND, IF YOU SIT DOWN (v23) ---------
        // The registry has inverted: `near` is already at nothing so the
        // shuffle above cannot fire, and `appr` says how much of the flock's
        // mind is made up. They wander IN instead of out, to iceSHEEP_APPR_STOP
        // and no closer, and only the ones already within iceSHEEP_APPR_SEE —
        // a sheep two hundred metres up the fell has not noticed you sit down.
        if (sheepAppr > 0.01 && d2 > iceSHEEP_APPR_STOP * iceSHEEP_APPR_STOP &&
            d2 < iceSHEEP_APPR_SEE * iceSHEEP_APPR_SEE) {
          const d = Math.sqrt(d2);
          const pull = Math.min(d - iceSHEEP_APPR_STOP, 4.0) * sheepAppr;
          tx = D[o] - dx / d * pull;
          tz = D[o + 1] - dz / d * pull;
        }
      }
      const spd = (D[o + 5] > 0.02 ? 2.4 : 0.42) + iceSheepSpook * 1.8;
      const mx = tx - D[o], mz = tz - D[o + 1];
      const md = Math.hypot(mx, mz);
      if (md > 0.05) {
        const step = Math.min(md, spd * dt);
        D[o] += mx / md * step; D[o + 1] += mz / md * step;
        D[o + 2] = Math.atan2(mx, mz);
      }
      const y = iceTerrain(D[o], D[o + 1]);
      // the head goes DOWN when it is not moving, which is the whole animation
      const graze = md > 0.4 ? 0 : 1;
      S.body.setMatrixAt(i, iceXform(D[o], y + 0.42, D[o + 1], 0, D[o + 2], 0,
                                     0.52, 0.50, 0.86));
      if (S.head) {
        S.head.setMatrixAt(i, iceXform(
          D[o] + Math.sin(D[o + 2]) * 0.46, y + 0.44 - graze * 0.26,
          D[o + 1] + Math.cos(D[o + 2]) * 0.46,
          graze * 0.9, D[o + 2], 0, 0.26, 0.26, 0.30));
      }
    }
    S.body.instanceMatrix.needsUpdate = true;
    if (S.head) S.head.instanceMatrix.needsUpdate = true;
  }
}

function iceBuildFlora(game_, root) {
  // Lupins. Not native, brought in to hold the soil down, and now they own
  // whole valleys — a purple haze over black rock, which is the strangest and
  // prettiest thing about the place.
  const lup = [], moss = [], rock = [];
  for (let i = 0; i < 240; i++) {
    const x = rand(-150, 150), z = rand(24, 118);
    if (Math.abs(x) < 6 && z < 70) continue;
    if (Math.abs(z - 96) < 12 && Math.abs(x) < 50) continue;   // not down the main street
    const y = iceTerrain(x, z);
    if (y < 0.2) continue;
    icePush9(lup, x, y + 0.45, z, 0, rand(0, 6.28), 0, 0.22, 0.9, 0.22);
  }
  // ---- AND THESE WERE TWO HUNDRED GREEN PLAYING CARDS --------------------
  // rand(1.4, 3.6) wide by 0.32 tall on iceG.cyl6 is a hexagonal PLATE up to
  // three and a half metres across lying flat on the ground, under a camera
  // that looks down about 0.7 rad. It is the most repeated mistake in this
  // codebase — Manly's rock pools, the Pantanal's lily rims, the cave's moss
  // discs, the Antarctic sastrugi, the Drift's ferns — and it has been sitting
  // in the one green thing in Iceland since the chapter shipped.
  //
  // Woolly fringe moss grows in DOMES the size of a football that merge into a
  // mattress of them. Same count, same draw call, a third the width, and
  // drawn on iceG.rock, which has no flat cap on it anywhere.
  for (let i = 0; i < 200; i++) {
    const x = rand(-180, 180), z = rand(-60, 130);
    const y = iceTerrain(x, z);
    if (y < 0.1 || iceGroundSlip(x, z) > 0.05) continue;
    const s2 = rand(0.6, 1.5);
    icePush9(moss, x, y + s2 * 0.30, z, rand(0, 0.3), rand(0, 6.28), rand(0, 0.3),
             s2, s2 * 0.78, s2 * 0.95);
  }
  for (let i = 0; i < 150; i++) {
    const x = rand(-200, 200), z = rand(-90, 130);
    const y = iceTerrain(x, z);
    if (y < -0.2) continue;
    const s = rand(0.6, 2.4);
    icePush9(rock, x, y + s * 0.3, z, rand(0, 1), rand(0, 6.28), rand(0, 1), s, s * 0.7, s);
  }
  // THE MORAINE, WHICH IS MADE OF RUBBLE AND WAS DRAWN AS LINOLEUM.
  // The scatter above stops at z = -90 and the whole walk to the top of the
  // glacier is north of that, so the one part of the biome the player climbs
  // for a minute and a half had nothing on it at all — a featureless grey ramp
  // with no scale on it, which also makes the climb feel twice as long as it is.
  for (let i = 0; i < 170; i++) {
    const side = Math.random() < 0.62;
    const x = side ? rand(iceMOR_X0 - 3, iceMOR_X1 + 3) : rand(-iceGL_HW - 24 + iceGL_XC, iceGL_XC - iceGL_HW);
    const z = rand(iceGL_Z1 + 6, iceGL_Z0 + 6);
    const y = iceTerrain(x, z);
    const s = rand(0.7, 3.2);
    icePush9(rock, x, y + s * 0.28, z, rand(0, 1), rand(0, 6.28), rand(0, 1), s, s * 0.65, s * rand(0.8, 1.3));
  }
  iceInstance(root, iceG.cyl4, PALETTE.iceLupin, lup, false, false);
  iceInstance(root, iceG.rock, PALETTE.iceMoss, moss, false, true);
  iceInstance(root, iceG.rock, PALETTE.iceMoraine, rock, true, true);

  // ============================ THE SERACS ================================
  // "The only thing on the run that is a HAZARD." They were not. Thirty
  // CUBES — one box each, `M.box(x, y + s*0.5, z, s, s*r, s*0.8)` — with no
  // collider on any of them, so the hazard was a picture of a hazard and the
  // audit walked through all thirty. The instrumented shot of the tongue is a
  // hundred and thirty metres of white with packing crates on it.
  //
  // A serac is not a block. It is what is left standing when a sheet of ice
  // going downhill over a step cracks into slabs and the slabs tilt against
  // each other: leaning, splintered, blue where the fracture is fresh and
  // white where the snow has settled on top. Four slabs each, all leaning the
  // same way — DOWNHILL, because that is the direction the ice is going and
  // it is what tells you which way is down from anywhere on the run.
  const M = iceMerger();
  // one body for all thirty-four of them, not thirty-four bodies — see
  // iceStaticGroup. They are hazards on a slide; the solver does not care how
  // many objects they are spread over and the budget does.
  const SB = new CANNON.Body({ mass: 0,
    material: (game_ && game_.mats && game_.mats.ground) || undefined });
  let SBused = false;
  for (let i = 0; i < 34; i++) {
    const t = i / 34;
    const z = lerp(iceGL_Z0 - 12, iceGL_Z1 + 18, t);
    const side = i % 2 ? 1 : -1;
    const x = iceGL_XC + side * rand(11, 31);
    const y = iceTerrain(x, z);
    const s = rand(2.0, 4.4);
    const yaw = rand(0, 3.14);
    const lean = rand(0.10, 0.30);           // downhill is +z on this tongue
    let top = 0;
    for (let k = 0; k < 4; k++) {
      const a = yaw + k * 1.05 + rand(-0.2, 0.2);
      const w = s * rand(0.32, 0.55);
      const h = s * rand(0.75, 1.85);
      const ox = Math.cos(a) * s * 0.26, oz = Math.sin(a) * s * 0.26;
      if (h > top) top = h;
      // the slab, leaning downhill
      M.box(x + ox, y + h * 0.5, z + oz, w, h, w * rand(0.7, 1.1),
        k === 0 ? PALETTE.iceGlacierBl : PALETTE.iceGlacier, lean, a, rand(-0.12, 0.12));
      // and the snow that has drifted on to the top of it, which is what makes
      // an ice block read as ice rather than as glass
      M.box(x + ox - lean * h * 0.5, y + h + 0.10, z + oz + lean * h * 0.5,
        w * 1.06, 0.22, w * 0.9, PALETTE.iceSnow, lean, a, 0);
    }
    // the fresh fracture at the foot: the blue you only get a metre down
    M.box(x, y + s * 0.16, z, s * 0.95, s * 0.32, s * 0.75, PALETTE.iceGlacierBl, 0, yaw, 0);
    // AND IT IS SOLID. One box per serac, sized from the cluster it actually
    // built rather than from the nominal `s` — the slabs lean, so the footprint
    // is wider than the drawing that made it.
    SB.addShape(new CANNON.Box(new CANNON.Vec3(s * 0.46, top * 0.5, s * 0.46)),
                new CANNON.Vec3(x, y + top * 0.5, z));
    iceSolids.add(x, y + top * 0.5, z, s * 0.46, top * 0.5, s * 0.46, 0);
    SBused = true;
  }
  if (SBused && game_) { iceSyncBody(SB); game_.world.addBody(SB); }
  // ======================= WHAT IS ON THE ICE ITSELF ======================
  // The tongue is a hundred and thirty metres of the best twenty seconds in the
  // game and the instrumented shot of it is a smooth pale-blue plane with some
  // furniture standing on it. There is no optical flow at speed, no scale, and
  // nothing that says a glacier is a thing that is MOVING.
  //
  // Three things that actually live on a valley glacier, all of them ground
  // detail and all of them therefore drawn as flat quads rather than boxes
  // (CONTRACT: a ripple is a facet of the ground seen only from above, and
  // eleven twelfths of a box is faces that cannot be seen):
  //
  //   SASTRUGI, the wind-carved ridges that run DOWN the fall line, which is
  //     the axis that gives you speed;
  //   MELTWATER CHANNELS, which run the same way and are the only dark line on
  //     a white surface;
  //   and SUPRAGLACIAL PONDS — the little blue puddles that stand in the
  //     hollows of the swell, which are the one thing on a glacier that is a
  //     colour rather than a value.
  {
    const GD = iceMerger();
    // the quad, pre-rotated flat: two triangles instead of twelve
    const flat = new THREE.PlaneGeometry(1, 1);
    flat.rotateX(-Math.PI / 2);
    const put = (x, y, z, sx, sz, ry, col) =>
      GD.add(flat, iceXform(x, y, z, 0, ry, 0, sx, 1, sz), col);
    // ------ AND THEN MOST OF IT CAME BACK OUT AGAIN -------------------------
    //
    // Two cuts of this were wrong in opposite directions and the second was the
    // more instructive. Three hundred and twenty pairs of sixteen-metre quads
    // in iceSnow against iceGlacierDp, twenty-six meltwater channels and
    // twenty-two ponds in iceGeoBlue: a BARCODE, a hundred and thirty metres of
    // hard blue and white stripes. Halving the sizes and softening the values
    // did not fix it — it turned a barcode into a scatter of PLANKS, which is
    // worse, because now each piece is a distinct object lying on the ice
    // instead of a pattern in it.
    //
    // The lesson is the one this file keeps relearning and it is not about
    // amplitude: SPARSE LONG PIECES CANNOT BE A TEXTURE. Either it is dense
    // enough that the eye stops resolving individuals, or it must not be
    // geometry at all. At the scale this glacier is seen from, dense enough is
    // thousands of quads for a thing whose whole job is to be barely noticed.
    //
    // So the wind texture went into the ground mesh's own vertex colours
    // instead (see iceBuildGroundMesh — the foliation banding), where it costs
    // nothing and can never read as an object, and what is left here is the one
    // thing on a glacier that genuinely IS a discrete object: the supraglacial
    // ponds standing in the troughs of the swell.
    for (let i = 0; i < 10; i++) {
      const z = rand(iceGL_Z1 + 10, iceGL_Z0 - 8);
      const x = iceGL_XC + rand(-iceGL_HW + 8, iceGL_HW - 8);
      if (iceGroundSlip(x, z) < 0.6) continue;
      // only where the swell is at its lowest, which is where water would go
      if (Math.sin(z * 0.085) > -0.55) continue;
      const y = iceTerrain(x, z) + 0.042;
      const r = rand(1.1, 2.6);
      GD.add(iceG.disc, iceXform(x, y, z, 0, rand(0, 3), 0, r * 2, 1, r * 2),
             PALETTE.iceGlacierBl);
      GD.add(iceG.disc, iceXform(x, y - 0.010, z, 0, rand(0, 3), 0, r * 2.5, 1, r * 2.5),
             PALETTE.iceGlacierDp);
      void put;
    }
    flat.dispose();
    const gdm = new THREE.Mesh(GD.build(), iceVC());
    gdm.receiveShadow = true;
    gdm.castShadow = false;
    root.add(gdm);
  }

  // ==================== AND WHAT IS ON THE WALK UP ========================
  // A hundred and sixty metres of moraine, climbed on every single attempt at
  // the record, and until now it carried a scatter of rocks and nothing else.
  // What a groomed piste route up a lateral moraine actually has on it is the
  // machine's own tracks, marker poles every twenty metres so you can find it
  // in the dark, and the cairns somebody built out of the spoil.
  {
    const MM = iceMerger();
    const flat = new THREE.PlaneGeometry(1, 1);
    flat.rotateX(-Math.PI / 2);
    const cxm = (iceMOR_X0 + iceMOR_X1) * 0.5;
    // THE TRACK IS COMPACTED SNOW, NOT TARMAC. The first cut laid iceMoraineDk
    // quads on a shelf that is above the snow line and therefore renders almost
    // white — so the shot of the moraine is a row of BLACK PAVING SLABS with
    // gaps between them running up a white hill. A piste machine does not
    // expose the ground; it presses the snow flat, and pressed snow is a
    // fraction bluer and a fraction darker than the stuff either side of it.
    // Overlapping, too: 2.5 m pieces on 2.4 m centres left a visible seam.
    for (let z = iceGL_Z1 + 12; z < iceGL_Z0 - 4; z += 2.4) {
      const y = iceTerrain(cxm, z);
      MM.add(flat, iceXform(iceCAT_X, y + 0.022, z, 0, 0, 0, 4.0, 1, 2.75),
             PALETTE.iceGlacier);
      // and the two ribs the tracks themselves leave, which are the only thing
      // out here with a straight edge
      for (let sx = -1; sx <= 1; sx += 2) {
        MM.add(flat, iceXform(iceCAT_X + sx * 1.45, y + 0.032, z, 0, 0, 0, 0.85, 1, 2.75),
               PALETTE.iceGlacierDp);
      }
    }
    // the marker poles, on the downhill side of the track, leaning
    for (let i = 0; i < 22; i++) {
      const z = lerp(iceGL_Z1 + 16, iceGL_Z0 - 8, i / 21);
      const x = iceCAT_X - 3.4 + Math.sin(i * 1.7) * 0.8;
      const y = iceTerrain(x, z);
      MM.cyl(x, y + 1.1, z, 0.055, 2.2, PALETTE.iceMoraineDk, 0, 0, rand(-0.12, 0.12));
      MM.box(x, y + 2.05, z, 0.16, 0.42, 0.06, i % 3 ? PALETTE.iceRoofRed : PALETTE.iceHouse3);
    }
    // three cairns, because somebody walks this
    for (let i = 0; i < 3; i++) {
      const z = lerp(iceGL_Z1 + 34, iceGL_Z0 - 22, i / 2);
      const x = iceMOR_X1 - 2.2;
      const y = iceTerrain(x, z);
      for (let k = 0; k < 5; k++) {
        MM.box(x, y + 0.22 + k * 0.42, z, 1.3 - k * 0.20, 0.42, 1.3 - k * 0.20,
               k % 2 ? PALETTE.iceMoraineDk : PALETTE.iceMoraine, 0, k * 0.6, 0);
      }
    }
    flat.dispose();
    const mmm = new THREE.Mesh(MM.build(), iceVC());
    mmm.receiveShadow = true;
    mmm.castShadow = true;
    root.add(mmm);
  }

  // ============================ THE CREVASSES =============================
  // THE STRIPING WAS THERE AND YOU COULD NOT SEE IT.
  //
  // iceBuildGroundMesh lerps the ice toward iceGlacierBl wherever a sine of z
  // comes inside 0.12 — a band about four metres wide on a thirty-three metre
  // wavelength — and the ground mesh is sampled every 4.1 m, so the band is
  // hit by a vertex about a third of the time and missed the rest.
  //
  // A crevasse is not a colour on a surface, it is a slot, and it can be drawn
  // as one for almost nothing: a dark core just proud of the ice with a pale
  // lip on each side of it. From a camera that looks down — every camera in
  // this game — that is indistinguishable from a hole, and the animal slides
  // straight over it, which is what you want on a run whose whole pleasure is
  // not being interrupted.
  //
  // =================== A CRACK IS A LINE. TWO GOES SAID CONFETTI ===========
  //
  // Twenty-six of them at nine segments each, every segment with its own yaw
  // and a two-metre wobble: several hundred loose teal blades. Then fifteen at
  // sixteen segments, "OVERLAPPING, not abutting" — and the instrumented shot
  // of the tongue still comes back as a chain of loose white chips with blue
  // between them, because the overlap was only ever along the crack. Each
  // segment is an AXIS-ALIGNED box 0.18 m deep in z, and consecutive stations
  // move up to 0.4 m in z: they miss each other sideways. The lips of one piece
  // and the lips of the next are not the same object and never touch.
  //
  // So the whole crack is ONE RIBBON. Five points across the profile — outer
  // lip, inner lip, the dark middle, and back out again — lofted along twenty
  // stations, sharing every edge. It is continuous by construction, it cannot
  // come apart however hard the curve bends, and it is a fifth of the cost:
  // 2 400 triangles for the whole tongue instead of 11 520.
  const CR = [], CRc = [];
  {
    const cLip = new THREE.Color(PALETTE.iceSnow);
    const cEdge = new THREE.Color(PALETTE.iceGlacierDp);
    const cDeep = new THREE.Color(PALETTE.iceGlacierBl);
    const NST = 22;
    // profile across the crack: [offset as a fraction of the half width,
    //  height over the ice, colour]
    const PROF = [
      [-1.95, 0.055, cLip],
      [-1.00, 0.100, cLip],
      [-0.70, 0.030, cEdge],
      [ 0.00, 0.005, cDeep],
      [ 0.70, 0.030, cEdge],
      [ 1.00, 0.100, cLip],
      [ 1.95, 0.055, cLip],
    ];
    const NP = PROF.length;
    const A = { x: new Float32Array(NP), y: new Float32Array(NP), z: new Float32Array(NP) };
    const B = { x: new Float32Array(NP), y: new Float32Array(NP), z: new Float32Array(NP) };
    const push = (S, q, col) => {
      CR.push(S.x[q], S.y[q], S.z[q]);
      CRc.push(col.r, col.g, col.b);
    };
    for (let i = 0; i < 16; i++) {
      const z0 = lerp(iceGL_Z0 - 6, iceGL_Z1 + 8, i / 15) + rand(-3.4, 3.4);
      const half = rand(15, 33);
      const x0 = iceGL_XC + rand(-11, 11);
      const bend = rand(-3.0, 3.0);          // one gentle curve down the whole crack
      const ph = rand(0, 6.283);
      const wob = rand(0.5, 1.1);
      let prev = null;
      for (let k = 0; k <= NST; k++) {
        const u = k / NST;
        const x = x0 + (u - 0.5) * half * 2;
        if (Math.abs(x - iceGL_XC) > iceGL_HW - 2.5) { prev = null; continue; }
        const zz = z0 + bend * Math.sin(u * Math.PI) + Math.sin(u * 3.1 + ph) * wob;
        const taper = Math.sin(u * Math.PI);            // dies away at both tips
        const w = 0.22 + 1.35 * taper * taper;
        const y = iceTerrain(x, zz);
        // the crack's own direction, so the profile is laid ACROSS it rather
        // than along world z — which is what let the old one shear apart
        const zn = z0 + bend * Math.sin((u + 0.02) * Math.PI) + Math.sin((u + 0.02) * 3.1 + ph) * wob;
        const dx = half * 2 / NST, dz2 = zn - zz;
        const l = Math.max(0.001, Math.hypot(dx, dz2));
        const nx = -dz2 / l, nz = dx / l;                // the across-vector
        const S = prev === null ? A : B;
        for (let q = 0; q < NP; q++) {
          const o = PROF[q][0] * w;
          S.x[q] = x + nx * o;
          S.z[q] = zz + nz * o;
          S.y[q] = y + PROF[q][1];
        }
        if (prev !== null) {
          for (let q = 0; q < NP - 1; q++) {
            const cq = PROF[q][2], cq1 = PROF[q + 1][2];
            push(A, q, cq); push(B, q, cq); push(B, q + 1, cq1);
            push(A, q, cq); push(B, q + 1, cq1); push(A, q + 1, cq1);
          }
        }
        for (let q = 0; q < NP; q++) { A.x[q] = S.x[q]; A.y[q] = S.y[q]; A.z[q] = S.z[q]; }
        prev = 1;
      }
    }
  }
  const crg = new THREE.BufferGeometry();
  crg.setAttribute('position', new THREE.Float32BufferAttribute(CR, 3));
  crg.setAttribute('color', new THREE.Float32BufferAttribute(CRc, 3));
  crg.computeVertexNormals();
  crg.computeBoundingSphere();
  const crm = new THREE.Mesh(crg, iceVC());
  crm.receiveShadow = true;
  crm.castShadow = false;               // a 16 cm lip casting a shadow is noise
  root.add(crm);

  const sm = new THREE.Mesh(M.build(), iceVC());
  sm.castShadow = true; sm.receiveShadow = true;
  root.add(sm);

  // a marker cairn at the top of the moraine, so that the walk up has a summit
  const CM = iceMerger();
  const ty = iceTerrain(iceMOR_X0 + 6, iceGL_Z1 + 22);
  for (let i = 0; i < 7; i++) {
    CM.box(0, i * 0.5 + 0.25, 0, 1.6 - i * 0.18, 0.5, 1.6 - i * 0.18, PALETTE.iceMoraineDk, 0, i * 0.5, 0);
  }
  const cm = new THREE.Mesh(CM.build(), iceVC());
  cm.position.set(iceMOR_X0 + 6, ty, iceGL_Z1 + 22);
  cm.castShadow = true;
  root.add(cm);
}

// ============================================================= GAMEPLAY =====
function iceTask(id) {
  const g = iceGame;
  if (g && typeof g.completeTask === 'function') g.completeTask(id);
}
function iceToast(t) {
  const g = iceGame;
  if (g && typeof g.toast === 'function') g.toast(t);
}
function iceSfx(n, o) {
  const g = iceGame;
  if (g && typeof g.sfx === 'function') g.sfx(n, o);
}

/** Strokkur's cycle, and the launch. */
// ==================================================================== SOUND ==
/**
 * THE QUIETEST SOUNDSCAPE IN THE GAME, AND THE MIDDLE OF THE MAP WAS SILENT.
 *
 * systems.js gives Iceland the sparsest ambience in the project on purpose —
 * wind off the ice, water on the harbour wall, and once in a very long while a
 * bird, on a thirteen-to-twenty-eight second timer — and that is exactly right
 * for the place. But it is ONE ambience for four hundred metres of map, so the
 * lava field, the geothermal ground, the moraine and the town all sound the
 * same, and the two hundred metres between the town and the ice — the walk
 * every player makes twice — is the emptiest of the four.
 *
 * Three positional sources, all of them rationed on the distance to the thing
 * making them, which is the only kind of positional this engine does (the
 * Sahara rule: the biome computes the volume). None of them fires unless the
 * player is near enough for the object to be IN THE FRAME, so nothing here
 * makes the chapter busier from anywhere it used to be quiet.
 */
let iceSndSheep = 4, iceSndRack = 9, iceSndSea = 3;

function iceUpdateSound(game, dt) {
  const p = game.capy && game.capy.position;
  if (!p) return;

  // ---- THE SHEEP ---------------------------------------------------------
  // The one sound in the middle of the map, and the only voice between the
  // last house and the moraine. A bleat carries a very long way over open
  // ground and it is the sound of the place being INHABITED, which is the
  // whole reason the flocks are there.
  iceSndSheep -= dt;
  if (iceSndSheep <= 0) {
    let best = 1e9;
    for (let i = 0; i < iceFLOCKS.length; i++) {
      const F = iceFLOCKS[i];
      const d = Math.hypot(p.x - F.x, p.z - F.z);
      if (d < best) best = d;
    }
    if (best < 60) {
      const v = clamp(0.16 * (1 - best / 60), 0.02, 0.16);
      // 'bark' at a low pitch with a wide random spread is a passable bleat and
      // it is what the table has; a sheep and a dog are the same animal to a
      // one-oscillator synthesiser.
      iceSfx('bark', { volume: v, pitch: rand(0.62, 0.82) });
      iceSndSheep = rand(5, 13);
    } else iceSndSheep = rand(3, 6);
  }

  // ---- THE DRYING RACKS --------------------------------------------------
  // Sixty split fish on two rails in an Atlantic wind. What you actually hear
  // standing next to one is the timber, not the fish.
  iceSndRack -= dt;
  if (iceSndRack <= 0) {
    let best = 1e9;
    for (let i = 0; i < iceRACK.length; i++) {
      const d = Math.hypot(p.x - iceRACK[i][0], p.z - iceRACK[i][1]);
      if (d < best) best = d;
    }
    if (best < 26) {
      iceSfx('rustle', { volume: clamp(0.13 * (1 - best / 26), 0.02, 0.13),
                         pitch: rand(0.36, 0.54) });
      iceSndRack = rand(4, 9);
    } else iceSndRack = rand(4, 8);
  }

  // ---- THE SEA ON THE COLONNADE -----------------------------------------
  // A swell hitting a vertical basalt face does not sound like a beach. It is
  // a thump and then a long drain, and it is the loudest thing in the chapter
  // if you stand at the headland — which is a fact worth knowing, because the
  // headland is where the wheek empties eleven hundred puffins off the rock.
  iceSndSea -= dt;
  if (iceSndSea <= 0) {
    const d = Math.hypot(p.x - iceCLIFF.x, p.z - iceCLIFF.z);
    if (d < 54) {
      const v = clamp(0.20 * (1 - d / 54), 0.02, 0.20);
      iceSfx('splash', { volume: v, pitch: rand(0.30, 0.42) });
      iceSndSea = rand(3.4, 6.5);
    } else iceSndSea = rand(3, 5);
  }
}

function iceUpdateGeyser(game, dt) {
  iceGeyT += dt;
  const capy = game.capy;
  const p = capy && capy.position;
  if (iceGeyPhase === 0) {
    if (iceGeyT > iceGEY_QUIET) { iceGeyPhase = 1; iceGeyT = 0; }
    // it breathes while it waits
    if (Math.random() < dt * 2.2) {
      iceSteamSpawn(iceSTROKKUR.x, iceTerrain(iceSTROKKUR.x, iceSTROKKUR.z) + 0.4, iceSTROKKUR.z, 1.2, 2.4, 1.6);
    }
  } else if (iceGeyPhase === 1) {
    // the dome: the one warning anybody gets
    if (iceGeyT > iceGEY_SWELL) {
      iceGeyPhase = 2; iceGeyT = 0; iceGeyFired++;
      // BY DISTANCE. Strokkur goes every thirteen seconds for the whole
      // chapter, and the shake and the report used to be unconditional — so
      // robbing the hot dog stand a hundred metres away in town, the seven
      // seconds of stillness the hot spring asks for, and the twelve-second
      // aurora ignition were all punctuated by a full-strength camera shake on
      // a thirteen-second metronome. sysSHAKE_MAX is 0.34, and shake is meant
      // to be punctuation on a real collision rather than a texture of normal
      // play. Neither shake() nor sfx() has a distance term, so the geyser has
      // to do its own falloff.
      const gdx = p ? p.x - iceSTROKKUR.x : 1e3, gdz = p ? p.z - iceSTROKKUR.z : 1e3;
      const gNear = clamp(1 - Math.sqrt(gdx * gdx + gdz * gdz) / 60, 0, 1);
      iceSfx('splash', { volume: 0.22 + 0.73 * gNear, pitch: 0.55 });
      if (gNear > 0.25 && typeof game.shake === 'function') game.shake(0.28 * gNear);

      // and this is the launch
      if (p) {
        const dx = p.x - iceSTROKKUR.x, dz = p.z - iceSTROKKUR.z;
        if (dx * dx + dz * dz < iceGEY_R * iceGEY_R && capy.body &&
            p.y < iceTerrain(p.x, p.z) + 3.5) {
          // THROUGH launch(). A bare velocity write leaves the animal grounded
          // and in contact for the frame it is written on, so the outward
          // scatter (dx*0.6, up to ~1.8 m/s) went straight into the grip
          // damper and, being under capyGRIP_SNAP, was set to zero: everybody
          // came off Strokkur going perfectly straight up. launch() clears the
          // reference frame, lifts clear of the live contact and refuses to be
          // grounded for capyLAUNCH_HOLD, so the throw arrives intact.
          if (typeof capy.launch === 'function') {
            capy.launch(capy.body.velocity.x + dx * 0.6, iceGEY_V,
                        capy.body.velocity.z + dz * 0.6);
          } else {
            capy.body.velocity.y = iceGEY_V;
            capy.body.velocity.x += dx * 0.6;
            capy.body.velocity.z += dz * 0.6;
          }

          iceGeyRiding = true;
          iceGeyPeak = 0;
          if (!iceGeysirDone) {
            iceGeysirDone = true;
            iceTask('geysir');
            iceToast('a hundred degrees, straight up, no ticket');
          } else {
            iceToast('again, then');
          }
          if (typeof game.shake === 'function') game.shake(0.5);
        }
      }
    }
  } else {
    if (iceGeyT > iceGEY_BLOW) { iceGeyPhase = 0; iceGeyT = 0; }
    // the column throws steam for as long as it is up
    for (let k = 0; k < 3; k++) {
      iceSteamSpawn(iceSTROKKUR.x, iceTerrain(iceSTROKKUR.x, iceSTROKKUR.z) + rand(2, 14),
        iceSTROKKUR.z, 7, 1.6, rand(2.2, 4.0));
    }
  }

  // the visuals, damped so nothing snaps
  const domeT = iceGeyPhase === 1 ? clamp(iceGeyT / iceGEY_SWELL, 0, 1) : 0;
  if (iceGeyDome) {
    iceGeyDome.material.opacity = domeT * 0.72;
    const s = 0.6 + domeT * 0.9;
    iceGeyDome.scale.set(s, 0.32 + domeT * 0.75, s);
  }
  if (iceGeyCol) {
    const blowT = iceGeyPhase === 2 ? clamp(1 - iceGeyT / iceGEY_BLOW, 0, 1) : 0;
    const h = blowT * iceGEY_H;
    iceGeyCol.material.opacity = blowT * 0.6;
    iceGeyCol.scale.set(1 + (1 - blowT) * 0.9, Math.max(0.001, h), 1 + (1 - blowT) * 0.9);
    iceGeyCol.position.y = iceTerrain(iceSTROKKUR.x, iceSTROKKUR.z) + h * 0.5;
  }
  // ---- how far up did that actually throw it? ------------------------------
  // Measured rather than assumed: the launch velocity is fixed but the apex is
  // not, because the capybara may have been running, hopping or holding
  // something when the geyser went, and all three change the answer.
  if (iceGeyRiding && capy && capy.position) {
    const h = capy.position.y - iceTerrain(capy.position.x, capy.position.z);
    if (h > iceGeyPeak) iceGeyPeak = h;
    if (capy.grounded && iceGeyPeak > 3) {
      iceGeyRiding = false;
      if (typeof game.record === 'function') game.record('geysir', iceGeyPeak);
    }
  }

  // ---- AND THE VENTS ARE ALL GOING ---------------------------------------
  // Twenty-six fumaroles and seven mud pools, and until now the only thing in
  // this field that ever produced a wisp of anything was Strokkur itself. What
  // makes a high-temperature area read from across it is that the whole basin
  // has steam standing over it, all the time, in a dozen places at once.
  // Rationed to whichever vent is nearest the animal, the same way the town's
  // chimneys are, so the pool is never emptied and the effect always lands
  // where the camera is.
  if (iceVents && p && Math.random() < dt * 7.0) {
    let best = -1, bd = 1e9;
    for (let i = 0; i < iceVents.length; i += 4) {
      const d = Math.hypot(iceVents[i] - p.x, iceVents[i + 2] - p.z);
      if (d < bd) { bd = d; best = i; }
    }
    if (best >= 0 && bd < 72) {
      // not always the nearest: two or three of them at once is what a field
      // looks like, and one lone column is a chimney
      const j = best + (randInt(0, 2) * 4);
      const k = j < iceVents.length ? j : best;
      iceSteamSpawn(iceVents[k], iceVents[k + 1] + 0.3, iceVents[k + 2],
                    1.6, iceVents[k + 3] * 0.5, rand(0.5, 1.15));
    }
  }
  // the mud pots and the hot pool are always going, gently
  //
  // SMALL. iceSteamSync grows a particle to scale * 2.74 over its life, so
  // rand(1.4, 2.6) is a sphere up to seven metres across standing over a pool
  // that is seventeen metres wide: the shot of the spring is a mound of pale
  // polygons with the capybara, the water and the whole task invisible behind
  // it. The same mistake the chimneys already made and had fixed. A wisp off a
  // hot pool is about a metre, and there should be several of them rather than
  // one enormous one.
  if (Math.random() < dt * 5.0) {
    const a = rand(0, 6.283), r = rand(0, iceSPRING.r * 0.86);
    iceSteamSpawn(iceSPRING.x + Math.cos(a) * r, iceSPRING_Y + 0.15, iceSPRING.z + Math.sin(a) * r,
      0.75, 0.6, rand(0.42, 0.86));
  }
}

/**
 * THE HOT SPRING, AND WHAT IT IS FOR.
 *
 * Seven seconds of doing nothing. That is the entire input. No other task in
 * this game asks for stillness and the list has one hundred and something lines
 * on it, so it lands: the prompt counts down, the steam thickens, the score
 * thins out, and if the player walks off at five seconds it starts again
 * without complaint.
 *
 * And then the sky lights, which is the payment.
 */
function iceUpdateSpring(game, dt) {
  const capy = game.capy;
  if (!capy || !capy.position) return;
  const p = capy.position;
  const dx = p.x - iceSPRING.x, dz = p.z - iceSPRING.z;
  const inPool = dx * dx + dz * dz < iceSOAK_R * iceSOAK_R && p.y < 1.2;
  const still = !capy.velocity || (capy.velocity.x * capy.velocity.x +
                                   capy.velocity.z * capy.velocity.z) < 1.6;

  if (inPool && still) {
    if (iceSoak === 0 && !iceSoakShown) {
      iceSoakShown = true;
      iceToast('nothing to do here. that is the instruction.');
    }
    iceSoak += dt;
    // The clock is on the paper while it runs (v32). This is the one record in
    // the game whose live figure is the reward itself: sitting still with a
    // number climbing beside a number you have to pass is the entire mechanic.
    if (game.recordLive) game.recordLive('hot-spring', iceSoak);
    // ---- AND IT ACTUALLY SITS IN IT NOW (v23) ---------------------------
    // THE MARQUEE ADOPTION OF THE LOAF. This is the one task in the game whose
    // whole content is being still, and until now "being still" was a number
    // in this file and nothing on screen: the animal trod water in a hot pool
    // for seven seconds with the same pose it uses to cross a fjord.
    //
    // It is `loafAsk` and not the rest timer because capySwimming is on the
    // capyBusy list — correctly, or the animal would sit down mid-crossing in
    // five chapters — so the loaf could never arrive in the one place the game
    // explicitly asks for it. Asked every frame; stop asking and it stands up.
    //
    // AND IT BRINGS THE WHOLE VERB WITH IT: the camera eases back off the
    // basin, the score takes its wider lean and goes soft, and the sheep's
    // registry entry inverts, so anything on the near bank comes down to look.
    // Nothing here had to be written for any of that — the pose is the input.
    capy.loafAsk = 1;
    // and it thickens round the animal while the clock runs — which is the only
    // feedback the soak has, so it has to be legible rather than opaque
    if (Math.random() < dt * 9) {
      iceSteamSpawn(p.x + rand(-1.2, 1.2), iceSPRING_Y + 0.25, p.z + rand(-1.2, 1.2),
                    0.95, 0.55, rand(0.40, 0.78));
    }
    if (!iceSoakDone && iceSoak >= iceSOAK_T) {
      iceSoakDone = true;
      iceTask('hot-spring');
      iceSfx('chime', { volume: 0.9, pitch: 0.7 });
      iceToast('this is what the species is for.');
      iceAuroraArmed = true;
      // AND THE FIELD ANSWERS. Twenty-six vents, one puff each, all at once —
      // one line, no new state, and it turns a tick into a thing the whole
      // basin did. (Rationed nowhere else: iceUpdateGeyser picks the nearest
      // vent and only the nearest, so the field has never been seen going
      // together and this is the one moment it should.)
      if (iceVents) {
        for (let i = 0; i < iceVents.length; i += 4) {
          iceSteamSpawn(iceVents[i], iceVents[i + 1] + 0.2, iceVents[i + 2],
                        2.2, iceVents[i + 3] * 0.6, rand(0.5, 1.0));
        }
      }
    }
    // ---- THE LONG SIT ------------------------------------------------------
    // The task is 'have a LONG sit' and the whole of it was over in seven
    // seconds. `game.record('hot-spring', …)` has always banked the overstay
    // and nothing in the world ever mentioned it, so the one line in this game
    // that rewards a player for doing absolutely nothing paid out silently, in
    // a menu, minutes later.
    //
    // Six marks. They are the only escalating thing in the chapter and they
    // deliberately escalate DOWNWARD — each one is a smaller event than the
    // last, the sound gets quieter and the joke gets drier, because the reward
    // for staying in a hot spring has to be less exciting than the reward for
    // getting into it or the whole chapter is arguing with itself.
    if (iceSoakDone && iceSoakMark < iceSOAK_MARKS.length &&
        iceSoak >= iceSOAK_MARKS[iceSoakMark][0]) {
      const m = iceSOAK_MARKS[iceSoakMark];
      iceSoakMark++;
      iceToast(m[1]);
      iceSfx('chime', { volume: 0.34 - iceSoakMark * 0.04, pitch: 1.5 - iceSoakMark * 0.13 });
      // and the water answers, once, in a ring — the only visible thing out
      // here that is about time passing rather than about temperature
      for (let k = 0; k < 9; k++) {
        const a = k / 9 * 6.283 + iceSoak;
        iceSteamSpawn(p.x + Math.cos(a) * (1.4 + iceSoakMark * 0.5), iceSPRING_Y + 0.2,
                      p.z + Math.sin(a) * (1.4 + iceSoakMark * 0.5), 0.7, 0.4, rand(0.3, 0.55));
      }
      if (typeof game.record === 'function') game.record('hot-spring', iceSoak);
    }
  } else if (iceSoak > 0) {
    // Getting out simply stops the clock — no punishment. But it also BANKS it:
    // sitting in a hot spring for longer than you strictly had to is the most
    // capybara thing in this game and it deserves a number.
    if (iceSoak > 1.5 && typeof game.record === 'function') game.record('hot-spring', iceSoak);
    iceSoak = damp(iceSoak, 0, 3.2, dt);
    if (iceSoak < 0.05) { iceSoak = 0; iceSoakMark = 0; }
  }

  // --- the sky ---------------------------------------------------------------
  if (iceAuroraHold > 0) iceAuroraHold -= dt;
  if (iceAuroraArmed && iceAurora < 1) {
    if (iceAurora <= 0.001) {
      iceAuroraHold = 12;    // the ignition, framed
      // ---- AND NOW IT IS ACTUALLY FRAMED (v26) --------------------------
      // `skyward()` has always asked for the pitch and the distance and there
      // was no way to ask for the BEARING, which is the one that was wrong: the
      // curtains hang across +Z and the camera could be pointing anywhere.
      // `yaw` IS THE BEARING FROM THE ANIMAL TO THE CAMERA, not the direction
      // the camera looks — so PI is the camera behind the animal at -Z looking
      // out over +Z, which is where the curtains now hang. Writing 0 here put
      // the rig at +Z facing -Z and measured 0 of 336 curtain vertices in
      // frame: exactly the bug this whole block exists to fix, reintroduced by
      // getting a sign wrong. Held for the whole twelve-second rise, and any
      // camera input from the player still ends it on the spot.
      if (iceGame && typeof iceGame.frameShot === 'function') {
        iceGame.frameShot({ yaw: Math.PI, hold: 12 });
      }
    }
    iceAurora = clamp(iceAurora + iceAUR_RISE * dt, 0, 1);
    // ---- AND THE SCORE OPENS WITH IT --------------------------------------
    // The tick at the end of this is a `wow` and systems.js pays it out on its
    // own; this is the other half. Every other set piece in the game is a thing
    // you DO and the swell lands on the doing, but the aurora is a thing that
    // happens TO you over twelve seconds while you sit in hot water, and a
    // celebration that waits until the sky is already full arrives after the
    // moment it is celebrating. Held rather than fired: swell() takes the max of
    // the live envelope, so calling it every frame of the rise keeps the lift up
    // for exactly as long as the sky is still moving and lets it fall away on
    // its own the moment it stops.
    const g = iceGame;
    if (g && g.music && typeof g.music.swell === 'function') g.music.swell(0.55 + iceAurora * 0.45);
    if (!iceAuroraDone && iceAurora > 0.9) {
      iceAuroraDone = true;
      iceTask('aurora');
      iceToast('the whole northern sky, and it waited for you to sit down.');
      iceSfx('chime', { volume: 1.0, pitch: 1.35 });
      if (typeof game.shake === 'function') game.shake(0.10);
    }
  }
}

/**
 * THE GLACIER RUN.
 *
 * Arm it at the top, and it is live until you either reach the snout or stop.
 * "Stop" is deliberately generous — a second and three quarters under three and
 * a half metres a second — because the run is meant to be lost to a serac or to
 * an over-steer into the wall of the U, not to a moment's hesitation.
 *
 * There is no par time. The glacier is twenty degrees and frictionless; getting
 * to the bottom still moving IS the achievement, and putting a stopwatch on it
 * would turn the best twenty seconds in the game into an optimisation problem.
 */
function iceUpdateSlide(game, dt) {
  const capy = game.capy;
  if (!capy || !capy.position) return;
  const p = capy.position;
  const onIce = iceGroundSlip(p.x, p.z) > 0.3;
  const sp = capy.velocity ? Math.hypot(capy.velocity.x, capy.velocity.z) : 0;
  // The run's own top speed, not the biome's: sampled only while an attempt is
  // live, or a sprint round Reykjavik an hour earlier is what the toast and
  // the record report. game.record() keeps the all-time best across attempts.
  if (iceSlideT >= 0 && sp > iceSlideBest) iceSlideBest = sp;
  // ...and it is on the paper while the run is happening (v32). The figure is
  // the run's own top speed so far, which is the number the record holds, not
  // the instantaneous one — a readout that fell back to 3 m/s every time you
  // scrubbed off speed in a turn would be reporting the wrong quantity.
  if (iceSlideT >= 0) { if (game.recordLive) game.recordLive('glacier-run', iceSlideBest); }
  else if (game.recordEnd) game.recordEnd('glacier-run');

  // NOT `if (iceSlideDone) return`. The tick fires once; the RUN is repeatable,
  // and the whole reason the snowcat exists is that people come back and do it
  // again. Returning here after the first descent meant the run could never be
  // re-armed, never re-timed and never re-recorded — so `glacier-run`, which is
  // a `better: 'higher'` record, could only ever hold the speed of the first
  // attempt, and the "personal best" toast (which only fires when a previous
  // value exists) was unreachable for ever. Venice's passerelle has the right
  // shape: the done-flag gates the tick alone.

  if (iceSlideT < 0) {

    if (onIce && p.z < iceSLIDE_START_Z) {
      iceSlideT = 0; iceSlideStall = 0; iceSlideBest = 0;
      iceToast('a hundred and thirty metres, and nothing to hold on to');
      iceSfx('rustle', { volume: 0.5, pitch: 0.6 });
    }
    return;
  }

  iceSlideT += dt;
  // ---- THE SPRAY ----------------------------------------------------------
  // A hundred and thirty metres of frictionless ice at fifteen metres a second
  // and nothing at all came off the animal. Ice crystals off a sliding body go
  // UP and BACKWARD and they are the only thing in the run that reports how
  // fast you are actually going — the rest of the tongue is uniform white, so
  // without this there is no optical flow to read speed from at all. Rationed
  // by speed, so a crawl produces none and the bottom of the run is a rooster
  // tail.
  if (sp > 6 && Math.random() < dt * clamp(sp * 2.6, 0, 34)) {
    const vx = capy.velocity ? capy.velocity.x : 0, vz = capy.velocity ? capy.velocity.z : 0;
    const l = Math.max(0.5, Math.hypot(vx, vz));
    iceSteamSpawn(p.x - vx / l * 0.9 + rand(-0.5, 0.5), iceTerrain(p.x, p.z) + 0.25,
                  p.z - vz / l * 0.9 + rand(-0.5, 0.5), 1.5 + sp * 0.07, 0.35,
                  rand(0.25, 0.55));
  }
  if (sp < iceSLIDE_STALL_V) {
    iceSlideStall += dt;
    if (iceSlideStall > iceSLIDE_STALL_T) {
      iceSlideT = -1;
      iceToast('stopped. go back up and take it in one.');
    }
  } else iceSlideStall = 0;

  // THE BOTTOM IS THE BOTTOM OF THE ICE. This used to be two branches that both
  // reduced to the same test — `iceGL_Z0 - 6` is -84 and `iceSLIDE_END_Z` is
  // -82, so `p.z > -82` implies `p.z > -84` and the "off the side into the
  // moraine, that is not the bottom" arm did exactly what the arm below it did.
  // There was no x test at all, so stepping onto the moraine shelf and walking
  // the last stretch finished the run.
  if (p.z > iceSLIDE_END_Z && (onIce || Math.abs(p.x - iceGL_XC) < iceGL_HW)) {
    iceSlideFinish(game);
  }
}

/** The bottom of the run, whichever way you arrived at it. */
function iceSlideFinish(game) {
  const first = !iceSlideDone;
  if (first) {
    iceSlideDone = true;
    iceTask('glacier-run');
  }
  iceSlideT = -1; iceSlideStall = 0;      // disarm, so the next descent re-arms
  iceToast('down the whole tongue at ' + iceSlideBest.toFixed(0) + ' metres a second.');
  iceSfx('cheer', { volume: 0.85 });
  if (typeof game.shake === 'function') game.shake(0.2);
  // and it is a number, so it is worth beating — EVERY time, not just the first
  if (typeof game.record === 'function') game.record('glacier-run', iceSlideBest);
}


/**
 * A COLONY IS NEVER STILL, AND THIS ONE WAS A HUNDRED AND FIFTY STATUES.
 *
 * Every bird on this headland stood at a fixed yaw, at a fixed height, without
 * moving a millimetre, from the moment the chapter loaded until somebody
 * wheeked at it — and the wheek is a task you do ONCE. So the landmark the
 * chapter tells you to climb specifically in order to look at the puffins was,
 * for the whole time you are looking at it, a museum diorama.
 *
 * Two things, and both are free. Every sitting bird gets a slow shuffle on its
 * feet, a head turn, and an occasional PREEN (which is what a puffin does
 * roughly every eight seconds of its life). And fourteen of them are never on
 * the rock at all: a colony always has birds in the air, and the ones in the
 * air are what tells you the ones on the ground are alive. They fly the way a
 * puffin actually flies — fast, low, on a tight circuit round the stack, never
 * gliding, banking hard into every turn.
 *
 * It is 150 matrix writes a frame, and only while the animal is within ninety
 * metres of the headland, which it is for about a minute of the chapter.
 */
const icePUFF_FLY = 14;              // how many are up at any moment
let icePuffinIdle = 0;

function icePuffinFlierAt(ph, t, out) {
  // a tight, slightly tilted circuit off the seaward face
  const a = t * 0.62 + ph;
  const R = 17 + Math.sin(ph * 3.1) * 7;
  out.x = iceCLIFF.x + Math.cos(a) * R;
  out.z = iceCLIFF.z + Math.sin(a) * R * 0.78;
  out.y = iceCLIFF.h + 3.5 + Math.sin(a * 2 + ph) * 3.4 + Math.sin(ph) * 2.5;
  out.yaw = -a + Math.PI * 0.5;
  return out;
}
const icePuffFly = { x: 0, y: 0, z: 0, yaw: 0 };

function iceUpdatePuffinIdle(game, dt) {
  if (!icePuffinMesh || icePuffinsUp > 0) return;
  const cp = game.capy && game.capy.position;
  if (!cp) return;
  const far = Math.hypot(cp.x - iceCLIFF.x, cp.z - iceCLIFF.z);
  if (far > 95) return;
  icePuffinIdle += dt;
  const t = icePuffinIdle;
  for (let i = 0; i < icePUFFIN_N; i++) {
    const o = i * 8;
    if (icePuffinData[o + 7] > 0) continue;          // mid-flush, not ours
    const ph = (i * 2.399963) % 6.283185;            // the golden angle, so no two agree
    if (icePuffinHome[o + 4] > 0.5) {
      icePuffinFlierAt(ph, t, icePuffFly);
      icePuffinData[o] = icePuffFly.x;
      icePuffinData[o + 1] = icePuffFly.y;
      icePuffinData[o + 2] = icePuffFly.z;
      icePuffinData[o + 3] = icePuffFly.yaw;
      // banking, and the wings beating — a puffin never once stops flapping
      icePuffinMesh.setMatrixAt(i, iceXform(icePuffFly.x, icePuffFly.y, icePuffFly.z,
        -0.28, icePuffFly.yaw, 0.55 + Math.sin(t * 22 + ph) * 0.22, 1, 1, 1));
      continue;
    }
    // ---- on the rock ------------------------------------------------------
    const turn = Math.sin(t * 0.42 + ph) * 0.5 + Math.sin(t * 0.17 + ph * 2.7) * 0.9;
    // the preen: head down, body forward, about once every eight seconds
    const pk = Math.sin(t * 0.36 + ph * 1.7);
    const preen = pk > 0.955 ? (pk - 0.955) * 22 : 0;
    const shuffle = Math.abs(Math.sin(t * 1.9 + ph * 3.3)) * 0.012;
    icePuffinMesh.setMatrixAt(i, iceXform(
      icePuffinHome[o], icePuffinHome[o + 1] + shuffle - preen * 0.05, icePuffinHome[o + 2],
      -preen * 0.8, icePuffinHome[o + 3] + turn, 0, 1, 1, 1));
  }
  icePuffinMesh.instanceMatrix.needsUpdate = true;
}

function iceUpdatePuffins(game, dt) {
  const capy = game.capy;
  const p = capy && capy.position;
  const input = game.input;
  // AND IT IS REPEATABLE. The tick fires once; the FLUSH is the best twenty
  // seconds anybody spends on that headland and it was available exactly once
  // per save, after which ninety-six birds sat at y = -400 for ever. Same
  // shape as the glacier run and the dune: the done-flag gates the TASK, not
  // the thing.
  if (p && input && input.honkPressed && iceSettle <= 0 && icePuffinsUp <= 0) {
    const dx = p.x - icePUFFIN.x, dz = p.z - icePUFFIN.z;
    if (dx * dx + dz * dz < icePUFF_R * icePUFF_R && p.y > iceCLIFF.h - 6) {
      icePuffinsUp = 1;
      if (!icePuffinDone) {
        icePuffinDone = true;
        iceTask('puffins');
        iceToast('eleven hundred puffins, all at once, all in the same direction');
      } else {
        iceToast('they will forgive you. they always do.');
      }
      iceSfx('gull', { volume: 1.0, pitch: 1.6 });
      iceSfx('rustle', { volume: 0.9, pitch: 1.3 });
      if (typeof game.shake === 'function') game.shake(0.22);
      for (let i = 0; i < icePUFFIN_N; i++) {
        const o = i * 8;
        const ax = icePuffinData[o] - p.x, az = icePuffinData[o + 2] - p.z;
        const l = Math.max(0.6, Math.hypot(ax, az));
        icePuffinData[o + 4] = ax / l * rand(4, 9) + rand(-2, 2);
        icePuffinData[o + 5] = rand(5, 11);
        icePuffinData[o + 6] = az / l * rand(4, 9) + rand(-2, 2);
        icePuffinData[o + 7] = rand(3.5, 7);
      }
      iceSettle = 26;
    }
  }
  // ---- and they come back ------------------------------------------------
  if (iceSettle > 0) {
    iceSettle -= dt;
    if (iceSettle <= 0) {
      for (let i = 0; i < icePUFFIN_N; i++) {
        const o = i * 8;
        icePuffinData[o] = icePuffinHome[o];
        icePuffinData[o + 1] = icePuffinHome[o + 1];
        icePuffinData[o + 2] = icePuffinHome[o + 2];
        icePuffinData[o + 3] = icePuffinHome[o + 3] + rand(-0.6, 0.6);
        icePuffinData[o + 7] = 0;
      }
      icePuffinSync();
      const cp = game.capy && game.capy.position;
      if (cp) {
        const far = Math.hypot(cp.x - icePUFFIN.x, cp.z - icePUFFIN.z);
        if (far < 70) iceSfx('rustle', { volume: clamp(0.5 - far * 0.005, 0.06, 0.5), pitch: 1.5 });
      }
    }
  }
  iceUpdatePuffinIdle(game, dt);
  if (icePuffinsUp <= 0) return;
  let alive = 0;
  for (let i = 0; i < icePUFFIN_N; i++) {
    const o = i * 8;
    if (icePuffinData[o + 7] <= 0) continue;
    alive++;
    icePuffinData[o] += icePuffinData[o + 4] * dt;
    icePuffinData[o + 1] += icePuffinData[o + 5] * dt;
    icePuffinData[o + 2] += icePuffinData[o + 6] * dt;
    // a puffin flies like a brick with opinions: fast, low, and it never soars
    icePuffinData[o + 5] = damp(icePuffinData[o + 5], -0.6, 1.1, dt);
    icePuffinData[o + 3] = Math.atan2(icePuffinData[o + 4], icePuffinData[o + 6]);
    icePuffinData[o + 7] -= dt;
    if (icePuffinData[o + 7] <= 0) icePuffinData[o + 1] = -400;   // out to sea, gone
  }
  if (alive === 0) icePuffinsUp = 0;
  icePuffinSync();
}

function iceUpdateTasks(game, dt) {
  const capy = game.capy;
  if (!capy || !capy.position) return;
  const p = capy.position;
  const input = game.input;

  // --- the hot dog stand -----------------------------------------------------
  if (!icePylsaDone) {
    const dx = p.x - icePYLSA.x, dz = p.z - icePYLSA.z;
    if (dx * dx + dz * dz < 3.6 * 3.6 && input && input.actionPressed) {
      icePylsaDone = true;
      iceTask('pylsa');
      // eina med ollu: one with everything. Which it now is.
      iceToast('eina með öllu — one with everything, and no krona changed hands');
      iceSfx('pop', { volume: 0.95 });
      if (icePylsaGroup) icePylsaGroup.rotation.y += 0.22;
    }
  }

  // --- the organ -------------------------------------------------------------
  if (iceOrganRing > 0) iceOrganRing -= dt;
  if (!iceOrganDone) {
    const dx = p.x - iceORGAN.x, dz = p.z - iceORGAN.z;
    if (dx * dx + dz * dz < 3.4 * 3.4 && input && input.actionPressed) {
      iceOrganDone = true;
      iceOrganRing = 5;
      iceTask('organ');
      iceToast('five thousand two hundred and seventy-five pipes, and one elbow');
      iceSfx('organ', { volume: 1.0 });
      if (typeof game.shake === 'function') game.shake(0.16);
    }
  } else if (iceOrganRing <= 0) {
    const dx = p.x - iceORGAN.x, dz = p.z - iceORGAN.z;
    if (dx * dx + dz * dz < 3.4 * 3.4 && input && input.actionPressed) {
      iceOrganRing = 5;
      iceSfx('organ', { volume: 0.85 });
    }
  }
}

// ==================================================================== API ====
function iceInZone(name, x, z) {
  if (name === 'city') return z > 70 && z < 128 && Math.abs(x) < 60;
  if (name === 'glacier') return iceGroundSlip(x, z) > 0.3;
  if (name === 'lagoon') return z > iceLAG_Z0 && z < iceLAG_Z1 && Math.abs(x) < iceLAG_HX;
  if (name === 'geothermal') return z > -26 && z < 24 && Math.abs(x) < 70;
  if (name === 'spring') {
    const dx = x - iceSPRING.x, dz = z - iceSPRING.z;
    return dx * dx + dz * dz < iceSPRING.r * iceSPRING.r;
  }
  if (name === 'cliff') {
    const dx = x - iceCLIFF.x, dz = z - iceCLIFF.z;
    return dx * dx + dz * dz < iceCLIFF.r * iceCLIFF.r;
  }
  // the way out: the last eight metres of the pier
  if (name === 'pier') {
    return Math.abs(x - icePIER.x) < 4 && z > icePIER.head - 9 && z < icePIER.head + 2;
  }
  return false;
}

// =============================================================== LIFECYCLE ===
export function createIceland(game) {
  iceGame = game;

  game.biome.register('iceland', {
    ensureBuilt() { iceBuild(game); },
    onEnter() {
      iceGeyPhase = 0; iceGeyT = iceGEY_QUIET * 0.45;   // it is nearly due when you arrive
      iceSlideT = -1; iceSlideStall = 0;
      iceSoak = 0; iceSoakMark = 0;
      iceCatT = 0; iceCatDir = 1; iceCatHold = 0; iceCatPrevZ = iceCAT_Z0;
      iceCatRodeT = 0;
      iceCatCarrying = false; iceCatRodeT = 0;
      // Anything that can still be holding the player, or still be mid-flight,
      // cleared on the way in as well as on the way out. Leaving Iceland while
      // airborne off Strokkur left iceGeyRiding true with a stale peak, which
      // the next visit posted to the record on its first grounded frame; and
      // leaving mid-flush left ninety-six puffins frozen in the air.
      iceGeyRiding = false; iceGeyPeak = 0;
      icePuffinsUp = 0;
      iceFoxCurious = 0; iceFoxDraw = 0; iceFoxYip = 0;
      // ...and put the colony back on the rock, rather than leaving it
      // mid-flight for however long the player was in another country.
      if (iceSettle > 0) { iceSettle = 0.001; }
      // THE HUMPBACK WAS THE ONE THING NOT ON THIS LIST. Leave Reykjavik in
      // the four seconds she is under and the phase machine freezes there;
      // come back and thirty tonnes of whale arrives out of nowhere with no
      // fin, no blow and none of the fifteen seconds the whole set piece is
      // actually made of. She starts her run in again, from the far side.
      iceWhalePhase = 0; iceWhaleP = 0; iceWhaleT = 14;
      if (iceWhaleGroup) iceWhaleGroup.visible = false;
      if (iceWhaleFin) iceWhaleFin.visible = false;
    },
    onExit() {
      iceSlideT = -1; iceCatCarrying = false; iceCatRodeT = 0;
      iceGeyRiding = false; iceGeyPeak = 0;
      icePuffinsUp = 0;
      iceFoxCurious = 0; iceFoxDraw = 0; iceFoxYip = 0;
      iceWhalePhase = 0; iceWhaleP = 0; iceWhaleT = 14;
      if (iceWhaleGroup) iceWhaleGroup.visible = false;
      if (iceWhaleFin) iceWhaleFin.visible = false;
    },

  });

  const api = {
    built() { return iceBuilt; },
    terrainHeight: iceTerrain,
    // Built from the static boxes themselves — see makeSolidIndex in shared.js.
    navBlocked(x, z, r) { return iceSolids.blocked(x, z, r, iceTerrain); },
    slopeAt: iceSlope,
    /** THE NEW VERB. capybara.js asks every frame; 0 = grip, 1 = glacier. */
    groundSlip: iceGroundSlip,
    waterLevel: iceSEA_Y,
    isOverWater: iceIsOverWater,
    waterHeightAt: iceSurfaceY,
    // ---- AND THE ANIMAL HAS TO BE TOLD TO READ IT (v23) ------------------
    // THIS CHAPTER HAS THREE BODIES OF WATER AT TWO HEIGHTS. iceSurfaceY has
    // said so since it was written and NOTHING ASKED IT: capyWaterY only calls
    // waterHeightAt when the biome declares `localWater`, and Iceland never
    // did, so the capybara floated to `waterLevel` — iceSEA_Y, -1.0 — in all
    // three of them. The hot pool is drawn at iceSPRING_Y (-0.30), which is
    // seventy centimetres higher.
    //
    // MEASURED, mid-soak: the top of the drawn animal at -0.594 against a
    // drawn surface at -0.300. The whole capybara was TWENTY-NINE CENTIMETRES
    // UNDER THE WATER for the entire seven seconds of the chapter's quietest
    // and best-loved moment — a marquee failing silently, in the one channel
    // (framed) that a metric never checks.
    //
    // One flag. The swim threshold, the float target, the clamber ceiling and
    // the wake rings were all already written as offsets from "wherever the
    // water is", so all four become correct in the spring for free, and the
    // sea and the lagoon are both iceSEA_Y so nothing outside it moves at all.
    localWater: true,
    inZone: iceInZone,
    SPAWN: iceSPAWN,
    /** The fourth chapter to declare a moving floor. See iceUpdateSnowcat. */
    /** Which of the four grounds is under (x, z). The footfall ladder asks. */
    groundKind: iceGroundKind,
    carryFrame() { return iceCatCarrying ? iceCatCarry : null; },
    /** The snowcat MOVES, and the whole point of it is the lift. Ask; never cache. */
    snowcat() {
      iceV3b.set(iceCAT_X, iceCatBody ? iceCatBody.position.y : 0,
                 iceCatBody ? iceCatBody.position.z : iceCAT_Z0);
      return iceV3b;
    },

    // landmarks, for the task beacons
    pylsa: icePYLSA,
    organ: iceORGAN,
    church: iceCHURCH,
    strokkur: iceSTROKKUR,
    spring: iceSPRING,
    cliff: icePUFFIN,
    pier: { x: icePIER.x, z: icePIER.head - 3 },
    // the humpback. She MOVES — ask, never cache.
    whale() { return iceWhalePos; },
    whaleUp() { return iceWhalePhase >= 1; },
    /**
     * THE FOX, and how interested it currently is in you.
     *
     * It MOVES — ask, never cache. `foxInterest()` is iceFoxDraw: 0 while it is
     * walking its own line, rising to about 0.62 while it is crossing open
     * ground to have a look at you, which it does when it hears a wheek inside
     * iceFOX_HEAR. It has always answered and nothing has ever been able to
     * tell that it had. Its own scratch vector — never share one between two
     * accessors.
     */
    fox() { iceV3f.set(iceFoxX, iceTerrain(iceFoxX, iceFoxZ), iceFoxZ); return iceV3f; },
    foxInterest() { return iceFoxDraw; },
    /** The top of the run. The beacon has to point at the CAIRN, not at the ice:
     *  sending a player straight up a frictionless twenty-degree slope is a joke
     *  that stops being funny the second time. */
    glacierTop: { x: iceMOR_X0 + 6, z: iceGL_Z1 + 22 },

    /** 0..1 — read by systems.js, which grows the score a choir on it. */
    aurora() { return iceAurora; },
    /**
     * HOW FAR THE CAMERA SHOULD CRANE UP, 0..1 (systems.js reads it).
     *
     * Full for the twelve seconds of the ignition, because that is a cutscene
     * the player has earned and it should be framed like one; then a quarter,
     * for as long as the sky is lit, so the aurora stays in the top of the
     * picture while you get on with the rest of the chapter. Anything more than
     * a quarter permanently and the ground gameplay starts to suffer, which is
     * a bad trade for a thing you have already seen.
     */
    skyward() {
      if (iceAurora <= 0.001) return 0;
      if (iceAuroraHold > 0) return 1;
      // NOT A QUARTER. A quarter is pitch 33 degrees, and the top of the frame
      // is still nine degrees BELOW the horizon there — measured, and the
      // aurora was gone from the picture the instant the ignition ended. 0.55
      // puts the horizon and the lowest band of curtain just inside the top of
      // the frame, which is the least the camera can do and still be showing
      // the thing the whole chapter is about.
      return 0.55;
    },
    /** 0..1 — how far through the soak, for the HUD line. */
    soak() { return clamp(iceSoak / iceSOAK_T, 0, 1); },
    soakSeconds: iceSOAK_T,
    sliding() { return iceSlideT >= 0; },
    geyserPhase() { return iceGeyPhase; },
    /** true in the second and a half of warning before Strokkur goes. */
    geyserSwelling() { return iceGeyPhase === 1; },

    update(dt) {
      if (!iceBuilt) return;
      if (!game.biome.isActive('iceland')) return;
      iceTime += dt;

      // the sea and the lagoon
      iceRipT += dt;
      if (iceRipT >= 0.0333) {
        iceRipT = 0;
        if (iceSeaAttr) {
          const a = iceSeaAttr.array;
          for (let i = 0; i < a.length; i += 3) {
            a[i + 1] = iceSEA_Y + Math.sin(a[i + 2] * 0.10 + iceTime * 1.1) * 0.20
                                + Math.sin(a[i] * 0.06 - iceTime * 0.7) * 0.09;
          }
          iceSeaAttr.needsUpdate = true;
        }
        if (iceLagAttr) {
          const a = iceLagAttr.array;
          for (let i = 0; i < a.length; i += 3) {
            a[i + 1] = iceLAG_Y + Math.sin(a[i + 2] * 0.13 + iceTime * 0.7) * 0.09;
          }
          iceLagAttr.needsUpdate = true;
        }
      }
      if (iceBergGroup) {
        const bx = Math.sin(iceTime * 0.06) * 1.4;
        iceBergGroup.position.x = bx;
        // and the colliders go with the drawing. Contract: the velocity of a
        // kinematic body is derived from the TARGET's own motion, never from
        // the body's position — which is where the last velocity already put
        // it. Here the target is an analytic sine, so it can be differentiated.
        if (iceBergBody) {
          iceBergBody.velocity.set(Math.cos(iceTime * 0.06) * 0.06 * 1.4, 0, 0);
          iceBergBody.position.x = bx;
          iceSyncBody(iceBergBody);
        }
      }

      // the sky rides with the animal — see iceBuildAurora
      if (iceSkyRig && game.capy && game.capy.position) {
        iceSkyRig.position.x = game.capy.position.x;
        iceSkyRig.position.z = game.capy.position.z;
      }

      // THE WATER CARRIES IT.
      // Even craned up, the sky is the top fifth of the frame and the ground is
      // the rest — so an aurora that only exists overhead is an aurora you
      // mostly cannot see. Every body of water in the biome takes a share of the
      // green, and between that and the hemisphere light in systems.js the sky
      // is present in every single frame whether or not it is in shot.
      if (iceAurora > 0.002 && iceAurora !== iceAurLastApplied) {
        iceAurLastApplied = iceAurora;
        const g = clamp(iceAurora, 0, 1) * 0.26;
        if (iceSeaMesh) iceSeaMesh.material.color.copy(iceAurBase).lerp(iceAurGreen, g);
        if (iceLagMesh) iceLagMesh.material.color.copy(iceAurBase).lerp(iceAurGreen, g * 1.2);
        // THE POOL CARRIES VERTEX COLOURS NOW, so its material colour is a
        // MULTIPLIER rather than the colour itself — copying iceGeoBlue into it
        // would square the blue and turn the spring to ink. White base, tinted.
        if (iceSpringMesh) iceSpringMesh.material.color.copy(iceAurBase).lerp(iceAurGreen, g * 0.8);
      }

      iceUpdateGeyser(game, dt);
      iceUpdateChimneys(game, dt);
      iceUpdateSteam(dt);
      iceUpdateSheep(game, dt);
      iceUpdateSound(game, dt);
      iceUpdateSpring(game, dt);
      iceUpdateAurora(dt);
      iceUpdateSnowcat(game, dt);
      iceUpdateFox(game, dt);
      iceUpdateWhale(game, dt);
      iceUpdateSlide(game, dt);
      iceUpdatePuffins(game, dt);
      iceUpdateTasks(game, dt);
    },
  };
  game.iceland = api;
  return api;
}

// ================================================================= THE WHALE ==
// THE MINI. Iceland already has a carrier (the snowcat, below) and did not need
// a second one, and it has the quietest twenty minutes in the game: a town with
// nobody in it, a geyser field and a hundred and sixty metres of moraine. The
// thing missing was not another vehicle. It was something ALIVE.
//
// So there is a humpback in the bay, and the whole design is the fifteen seconds
// BEFORE it does anything. She runs a slow circuit out in the dark water; every
// so often she turns for the pier and comes in shallow, and you can see her
// coming — a dorsal fin cutting a line across the harbour, and a blow. Then she
// goes under, and there are four seconds of nothing at all, and then thirty
// tonnes of her comes out of the water eight metres from the end of the pier.
//
// She takes the swell with her: the breach lands with a shove that the pier does
// not feel and a swimming capybara certainly does — capy.shove(), which is the
// one channel a lean survives (see the note by capyLAUNCH_HOLD in capybara.js).
// FURTHER OUT THAN THAT. Nine metres off the pier head put her up among the
// moored boats in the old harbour, which reads as a stranding rather than as a
// breach; she comes up in open water now, and the pier is still well inside the
// thirty-four metres that count as having seen it.
const iceWHALE_X = icePIER.x - 20;     // she surfaces on the seaward side of the pier
const iceWHALE_Z = icePIER.head + 24;
const iceWHALE_R = 46;                 // the radius of her circuit out in the bay
const iceWHALE_CYCLE = 54;             // s between passes
const iceWHALE_RUN = 15;               // s of fin, from the far side to the dive
const iceWHALE_HOLD = 4.0;             // s under, which is the whole trick
const iceWHALE_UP = 3.4;               // s of breach
// ---- AND THE TRIGGER WAS A THREE-METRE COIN FLIP -------------------------
// MEASURED. She breaches at (icePIER.x - 20, icePIER.head + 24) = (6, 164).
// The head of the pier is (26, 140), which is 31.2 m away; the point the task
// BEACON aims at is api.pier = (26, icePIER.head - 3) = (26, 137), which is
// 33.6 m away — four tenths of a metre inside a 34 m radius. So the chapter's
// mini ticked if you stood on the last three metres of decking and silently
// did not if you stood anywhere else on the pier the task names, and the
// penalty for missing was a fifty-four second wait for the next pass.
//
// A radius round the WHALE was the wrong question anyway: the task is 'be on
// the pier when the whale comes up'. It is answered by the pier now, with the
// radius kept as a generous second way in for anybody watching from the beach
// or swimming in the harbour.
const iceWHALE_NEAR = 52;              // m inside which you have genuinely seen it
// ---- AND SHE COMES WHEN THERE IS SOMEBODY TO SEE HER --------------------
// The circuit ran on a fifty-four second metronome whether the player was on
// the pier or a hundred and eighty metres up the moraine, so the fifteen
// seconds of fin — the entire build the set piece is made of — happened, on
// average, to nobody. Standing at the end of the pier looking out to sea is
// the most legible possible statement of intent in this chapter, and the bay
// answers it: the wait winds down four times as fast while you are out there,
// so turning up produces a whale inside about a quarter of a minute instead of
// half a minute of nothing followed by a coin toss.
const iceWHALE_CALL_R = 42;            // m from the pier head that counts as waiting
const iceWHALE_CALL_K = 4.0;           // how much faster the clock runs while you are
let iceWhaleGroup = null;
let iceWhaleFin = null;
let iceWhaleT = 12;                    // s until the next pass
let iceWhalePhase = 0;                 // 0 idle, 1 running in, 2 under, 3 breaching
let iceWhaleP = 0;                     // s into the phase
let iceWhaleSeen = false;
let iceWhaleBlow = 0;
const iceWhalePos = new THREE.Vector3();

function iceBuildWhale(root) {
  const M = iceMerger();
  // A humpback is a fat torpedo with an enormous jaw and two absurd flippers,
  // and at this palette the read is entirely silhouette: dark on top, white
  // underneath, and the flippers are a third of her length.
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const r = Math.sin(0.14 + t * 2.6) * 1.55 + 0.18;
    M.cyl(0, 0, -5.4 + t * 10.8, Math.max(0.16, r), 1.45, PALETTE.iceBasalt, Math.PI / 2, 0, 0, 8);
  }
  // the pale underside, the pleats, and the jaw
  // the pale underside, which is HALF A HUMPBACK and has to be wide enough to
  // read from the pier — the first cut was a 1.5 m strip inside a 3.1 m body
  // and the whole animal photographed as a black wedge
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const r = Math.sin(0.14 + t * 2.6) * 1.55 + 0.18;
    M.box(0, -Math.sin(0.3 + t * 2.4) * 0.95, -4.2 + t * 8.4,
          Math.max(0.4, r * 1.75), 0.55, 1.35, PALETTE.iceSnow);
  }
  M.box(0, 0.30, 5.0, 1.5, 0.9, 2.2, PALETTE.iceBasaltDk, -0.16, 0, 0);
  M.box(0, -0.55, 4.7, 1.7, 0.6, 2.6, PALETTE.iceSnow, -0.10, 0, 0);
  // flippers, long and knuckled and white
  for (let s2 = -1; s2 <= 1; s2 += 2) {
    M.box(s2 * 2.5, -0.35, 1.2, 3.8, 0.28, 1.15, PALETTE.iceSnow, 0, s2 * 0.34, s2 * 0.22);
  }
  // dorsal, peduncle and flukes
  M.box(0, 1.35, -1.6, 0.22, 0.85, 1.0, PALETTE.iceBasaltDk, 0.4, 0, 0);
  M.box(0, 0, -5.9, 0.5, 0.4, 1.5, PALETTE.iceBasalt);
  for (let s2 = -1; s2 <= 1; s2 += 2) {
    M.box(s2 * 1.5, 0.05, -6.7, 3.0, 0.20, 1.7, PALETTE.iceBasaltDk, 0, s2 * 0.30, 0);
  }
  const mesh = new THREE.Mesh(M.build(), iceVC());
  mesh.castShadow = true;
  iceWhaleGroup = new THREE.Group();
  iceWhaleGroup.name = 'iceWhale';
  iceWhaleGroup.add(mesh);
  iceWhaleGroup.visible = false;
  root.add(iceWhaleGroup);

  // The fin, which is what you actually see for the first fifteen seconds. Its
  // own object so it can be drawn while she is not.
  const F = iceMerger();
  F.box(0, 0.45, 0, 0.20, 0.90, 1.10, PALETTE.iceBasaltDk, 0.42, 0, 0);
  F.box(0, 0.06, -0.9, 1.10, 0.14, 3.2, PALETTE.iceBasalt);
  // THE WAKE, which is most of what you actually see for those fifteen
  // seconds. A dorsal fin at four hundred metres in the dark is a dot; what
  // crosses the picture is the V of white water behind it, and it costs six
  // boxes in the fin's own group so it turns and moves with her for nothing.
  for (let s2 = -1; s2 <= 1; s2 += 2) {
    for (let k = 0; k < 3; k++) {
      const t = k / 3;
      F.box(s2 * (0.5 + t * 3.4), 0.03, -1.4 - t * 7.0,
            0.55 + t * 0.7, 0.07, 3.2 + t * 2.4, PALETTE.iceSnow, 0, s2 * -0.24, 0);
    }
  }
  // and the bow-wave off the fin itself
  F.box(0, 0.10, 0.55, 1.5, 0.14, 1.1, PALETTE.iceSnow, -0.2, 0, 0);
  const fin = new THREE.Mesh(F.build(), iceVC());
  iceWhaleFin = new THREE.Group();
  iceWhaleFin.name = 'iceWhaleFin';
  iceWhaleFin.add(fin);
  iceWhaleFin.visible = false;
  root.add(iceWhaleFin);
}

/** Where she is on the run in, 0..1 from the far side of the bay to the dive. */
function iceWhaleRunAt(u, out) {
  // A long shallow arc rather than a straight line: she comes round the head of
  // the pier, which is why the fin crosses the whole picture instead of growing
  // in the middle of it.
  const a = Math.PI * (0.92 - u * 0.62);
  out.x = iceWHALE_X + Math.cos(a) * iceWHALE_R * (1 - u * 0.80);
  out.z = iceWHALE_Z + Math.sin(a) * iceWHALE_R * (1 - u * 0.80) * 0.55 + u * 6;
  return out;
}
const iceWhaleRunOut = { x: 0, z: 0 };

function iceUpdateWhale(game, dt) {
  if (!iceWhaleGroup) return;
  const capy = game.capy;
  const cp = capy && capy.position;

  if (iceWhalePhase === 0) {
    // the clock runs faster while somebody is standing on the pier looking out
    let k = 1;
    if (cp) {
      const wx = cp.x - icePIER.x, wz = cp.z - (icePIER.head - 4);
      if (wx * wx + wz * wz < iceWHALE_CALL_R * iceWHALE_CALL_R) k = iceWHALE_CALL_K;
    }
    iceWhaleT -= dt * k;
    iceWhaleFin.visible = false;
    iceWhaleGroup.visible = false;
    if (iceWhaleT <= 0) { iceWhalePhase = 1; iceWhaleP = 0; iceWhaleBlow = 0; }
    return;
  }

  iceWhaleP += dt;
  if (iceWhalePhase === 1) {
    // ---- the fin ----------------------------------------------------------
    const u = clamp(iceWhaleP / iceWHALE_RUN, 0, 1);
    const a = iceWhaleRunAt(u, iceWhaleRunOut);
    const b = iceWhaleRunAt(Math.min(1, u + 0.02), { x: 0, z: 0 });
    iceWhaleFin.visible = true;
    iceWhaleFin.position.set(a.x, iceSEA_Y - 0.05 + Math.sin(iceWhaleP * 1.7) * 0.10, a.z);
    iceWhaleFin.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    iceWhalePos.set(a.x, iceSEA_Y, a.z);
    // she blows twice on the way in, and it is the loudest thing in Reykjavik
    iceWhaleBlow -= dt;
    if (iceWhaleBlow <= 0 && u > 0.15 && u < 0.85) {
      iceWhaleBlow = 5.5;
      if (game.sfx) game.sfx('hiss', { volume: 0.75, pitch: 0.55 });
    }
    if (iceWhaleP >= iceWHALE_RUN) { iceWhalePhase = 2; iceWhaleP = 0; iceWhaleFin.visible = false; }
    return;
  }

  if (iceWhalePhase === 2) {
    // ---- four seconds of nothing at all -----------------------------------
    // HOLD the swell across the wait. swell() takes the max of the live
    // envelope, so calling it every frame is the documented way to hold one.
    if (game.music && typeof game.music.swell === 'function') {
      game.music.swell(0.30 + clamp(iceWhaleP / iceWHALE_HOLD, 0, 1) * 0.25);
    }
    if (iceWhaleP >= iceWHALE_HOLD) { iceWhalePhase = 3; iceWhaleP = 0; }
    return;
  }

  // ---- the breach ---------------------------------------------------------
  const u = clamp(iceWhaleP / iceWHALE_UP, 0, 1);
  // Up, over, and back in: a parabola, and she rolls onto her side at the top
  // because that is what a humpback does with thirty tonnes of momentum.
  const rise = Math.sin(u * Math.PI) * 11.5;
  iceWhaleGroup.visible = true;
  iceWhaleGroup.position.set(iceWHALE_X, iceSEA_Y - 5.2 + rise, iceWHALE_Z - 4 + u * 9);
  iceWhaleGroup.rotation.set(1.05 - u * 2.0, 0.35, u * 1.6);
  if (iceWhaleP - dt <= 0) {
    if (game.sfx) game.sfx('splash', { volume: 0.9, pitch: 0.55 });
    if (game.shake) game.shake(0.20);
  }
  if (u >= 1) {
    iceWhaleGroup.visible = false;
    iceWhalePhase = 0;
    iceWhaleT = iceWHALE_CYCLE;
    if (game.sfx) { game.sfx('splash', { volume: 1.0, pitch: 0.42, force: true }); }
    if (game.shake) game.shake(0.45);
    // The swell she puts out. A shove and not a launch: you are being LEANED ON
    // by a great deal of displaced North Atlantic, not thrown by it.
    if (cp && capy.shove) {
      const dx = cp.x - iceWHALE_X, dz = cp.z - iceWHALE_Z;
      const d = Math.hypot(dx, dz);
      if (d < 26 && d > 0.4) {
        const k = (1 - d / 26) * 5.5;
        capy.shove(dx / d * k, dz / d * k);
      }
    }
    if (!iceWhaleSeen && cp) {
      const dx = cp.x - iceWHALE_X, dz = cp.z - iceWHALE_Z;
      // on the pier, OR near enough to the breach to have been rained on
      const onPier = iceInZone('pier', cp.x, cp.z) ||
                     (Math.abs(cp.x - icePIER.x) < 6 && cp.z > icePIER.z - 2);
      if (onPier || dx * dx + dz * dz < iceWHALE_NEAR * iceWHALE_NEAR) {
        iceWhaleSeen = true;
        iceTask('the-whale');
      }
    }
  }
  iceWhalePos.set(iceWHALE_X, iceSEA_Y, iceWHALE_Z);
}

// =================================================================== THE FOX ==
// NOT A TASK. Iceland is the emptiest-feeling chapter in the game and that is
// deliberate — a town with nobody in it, a geyser field, a hundred and sixty
// metres of moraine — but there is a difference between EMPTY and dead, and
// until the humpback there was nothing here that was alive at all. The whale is
// out in the bay and comes past twice a minute. On the land there was nothing.
//
// The arctic fox is the only land mammal that was here before anybody was, and
// it is the right animal for this chapter for one specific reason: it does not
// run away. It stops at about eight metres, looks at you for as long as you can
// stand it, and then carries on doing what it was doing.
const iceFOX_R = 46;                  // how far it ranges up and down the moraine
const iceFOX_SPEED = 2.1;
const iceFOX_NOTICE = 14;             // m at which it stops and looks
// AND IT ANSWERS. The wheek has exactly one responder in this chapter — eleven
// hundred puffins, once — and the only other living thing on the island stood
// there trotting through it. An arctic fox has no land predator and behaves
// like it: shout at one and it does not run, it stops, and then it comes a few
// steps CLOSER to find out what you are, which is both true and the single
// most delightful thing that can happen on that moraine.
const iceFOX_HEAR = 40;               // m — it is a very quiet country
let iceFoxGroup = null, iceFoxTail = null;
let iceFoxT = 0, iceFoxStare = 0;
let iceFoxCurious = 0;                // s of coming to have a look
let iceFoxDraw = 0;                   // 0..1 of the way toward the animal
let iceFoxYip = 0;
// ---- AND IT WAS BEING TOWED ----------------------------------------------
// The approach was `lerp(itsWanderPoint, thePlayer, draw)` evaluated fresh
// every frame, which is not an animal walking toward you: it is an animal
// welded to 62 % of YOUR motion. Wheek at it from forty metres and it covers
// twenty-five of them in the time the damper takes; then run, and it slides
// sideways across the moraine at two thirds of your speed, feet moving at
// trot pace, never getting anywhere. A fox has a position and a top speed.
let iceFoxX = 0, iceFoxZ = 0;         // where it actually is
const iceV3f = new THREE.Vector3();   // the fox accessor's OWN scratch
let iceFoxHas = false;                // ...once it has been anywhere at all
const iceFOX_RUN = 4.2;               // m/s — a trotting fox, and it is quick
const iceFOX_KEEP = 4.5;              // m it stops short at, which is the joke

function iceBuildFox(root) {
  const M = iceMerger();
  // A WINTER FOX IS A ROUND WHITE THING WITH NO CORNERS. Short muzzle, short
  // ears, enormous tail — it is built to lose as little heat as possible and it
  // looks it, which is the whole silhouette.
  M.sph(0, 0.30, 0, 0.26, 0.24, 0.46, PALETTE.iceSnow);
  M.sph(0, 0.40, 0.42, 0.19, 0.18, 0.20, PALETTE.iceSnow);
  M.box(0, 0.34, 0.60, 0.13, 0.11, 0.18, PALETTE.iceSnow);
  M.box(0, 0.33, 0.70, 0.07, 0.06, 0.06, PALETTE.iceBasaltDk);
  for (let s = -1; s <= 1; s += 2) {
    M.box(s * 0.10, 0.55, 0.40, 0.11, 0.13, 0.06, PALETTE.iceSnow, 0, 0, s * 0.22);
    M.box(s * 0.07, 0.42, 0.55, 0.05, 0.05, 0.04, PALETTE.iceBasaltDk);
    // four short legs, and they are SHORT
    for (let f = -1; f <= 1; f += 2) {
      M.box(s * 0.15, 0.11, f * 0.26, 0.09, 0.24, 0.09, PALETTE.iceSnow);
    }
  }
  const body = new THREE.Mesh(M.build(), iceVC());
  body.castShadow = true;
  iceFoxGroup = new THREE.Group();
  iceFoxGroup.name = 'iceFox';
  iceFoxGroup.add(body);

  // The tail is its own group because it is a third of the animal and it is the
  // only part that ever moves on its own.
  const T = iceMerger();
  T.sph(0, 0, -0.30, 0.17, 0.17, 0.34, PALETTE.iceSnow);
  T.sph(0, 0, -0.58, 0.12, 0.12, 0.16, PALETTE.iceBasaltDk);
  const tail = new THREE.Mesh(T.build(), iceVC());
  iceFoxTail = new THREE.Group();
  iceFoxTail.position.set(0, 0.32, -0.40);
  iceFoxTail.add(tail);
  iceFoxGroup.add(iceFoxTail);
  root.add(iceFoxGroup);
  iceFoxT = 0; iceFoxStare = 0;
}

/** Where it is on its wander, at time t. A slow figure across the moraine. */
function iceFoxAt(t, out) {
  const a = t * 0.055;
  out.x = iceCAT_X - 26 + Math.sin(a) * iceFOX_R * 0.55 + Math.sin(a * 2.7) * 7;
  out.z = (iceCAT_Z0 + iceCAT_Z1) * 0.5 + Math.cos(a) * iceFOX_R + Math.cos(a * 1.9) * 9;
  return out;
}
const iceFoxPt = { x: 0, z: 0 };

function iceUpdateFox(game, dt) {
  if (!iceFoxGroup) return;
  const capy = game.capy;
  const cp = capy && capy.position;
  // ---- it heard that ------------------------------------------------------
  const input = game.input;
  iceFoxAt(iceFoxT, iceFoxPt);
  if (cp && input && input.honkPressed) {
    const d = Math.hypot(cp.x - iceFoxPt.x, cp.z - iceFoxPt.z);
    if (d < iceFOX_HEAR) {
      iceFoxCurious = 9.0;
      iceFoxYip = 0.9;
      // it answers, once, and only if you are close enough to hear it
      if (d < 22 && typeof game.sfx === 'function') {
        try { game.sfx('gull', { volume: clamp(0.34 - d * 0.010, 0.05, 0.34), pitch: 2.1 }); } catch (e) {}
      }
    }
  }
  if (iceFoxCurious > 0) iceFoxCurious -= dt;
  if (iceFoxYip > 0) iceFoxYip -= dt;
  // it closes about two thirds of the way and then thinks better of it
  iceFoxDraw = damp(iceFoxDraw, iceFoxCurious > 0 ? 0.62 : 0, iceFoxCurious > 0 ? 0.45 : 0.9, dt);

  // ---- does it care that you are there -----------------------------------
  // It stops. It does not run: an arctic fox has no land predator and behaves
  // like it, and a white thing bolting into the dark is a worse picture than a
  // white thing looking at you.
  const far = cp ? Math.hypot(cp.x - iceFoxPt.x, cp.z - iceFoxPt.z) : 999;
  const want = (far < iceFOX_NOTICE || iceFoxCurious > 0) ? 1 : 0;
  iceFoxStare = damp(iceFoxStare, want, 2.2, dt);
  // the clock only runs when it is not staring, so the stare is a genuine stop
  iceFoxT += dt * iceFOX_SPEED * (1 - iceFoxStare * 0.94);

  iceFoxAt(iceFoxT, iceFoxPt);
  // ...and while it is curious it is not where its wander says it is: it walks
  // toward you and stops short, and walks back to its own line when it loses
  // interest. A TARGET and a SPEED CAP, never a lerp against the player's live
  // position — see the note by iceFoxX.
  let tx = iceFoxPt.x, tz = iceFoxPt.z;
  if (cp && iceFoxDraw > 0.01) {
    const vx = cp.x - iceFoxPt.x, vz = cp.z - iceFoxPt.z;
    const vd = Math.max(0.001, Math.hypot(vx, vz));
    // it aims for a point iceFOX_KEEP short of the animal, and only comes the
    // fraction of the way its interest is worth
    const reach = Math.max(0, vd - iceFOX_KEEP) * iceFoxDraw / 0.62;
    tx = iceFoxPt.x + vx / vd * reach;
    tz = iceFoxPt.z + vz / vd * reach;
  }
  if (!iceFoxHas) { iceFoxX = tx; iceFoxZ = tz; iceFoxHas = true; }
  {
    const dx2 = tx - iceFoxX, dz2 = tz - iceFoxZ;
    const d2 = Math.hypot(dx2, dz2);
    // the cap is generous when it is only following its own wander (that line
    // moves at iceFOX_SPEED and must never be lagged behind) and tight when it
    // is crossing open ground to look at you
    const cap = Math.max(iceFOX_SPEED * 1.6, iceFOX_RUN) * dt;
    if (d2 > cap) { iceFoxX += dx2 / d2 * cap; iceFoxZ += dz2 / d2 * cap; }
    else { iceFoxX = tx; iceFoxZ = tz; }
  }
  const x = iceFoxX, z = iceFoxZ;
  const y = iceTerrain(x, z);
  // IT FACES WHERE IT IS GOING, which is the target it is actually walking to
  // and not the next point on a wander line it has stepped off. (The old line
  // asked the wander for its heading even while the fox was thirty metres away
  // from it coming over to look at you, so the one thing in the chapter that is
  // alive spent the approach walking sideways.)
  iceFoxAt(iceFoxT + 0.35, iceFoxPt);
  let hx = iceFoxPt.x - x, hz = iceFoxPt.z - z;
  if (Math.hypot(tx - x, tz - z) > 0.25) { hx = tx - x; hz = tz - z; }
  let yaw = Math.atan2(hx, hz);
  // while it is looking at you, it is looking AT YOU
  if (cp && iceFoxStare > 0.02) {
    const toYou = Math.atan2(cp.x - x, cp.z - z);
    let d = toYou - yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    yaw += d * iceFoxStare;
  }
  iceFoxGroup.position.set(x, y, z);
  iceFoxGroup.rotation.y = yaw;
  // the trot: a short quick bob, and it stops dead when the animal does — but
  // it is trotting again while it is coming over to look at you
  const gait = Math.max(1 - iceFoxStare, iceFoxCurious > 0 && iceFoxDraw < 0.58 ? 0.8 : 0);
  iceFoxGroup.position.y = y + Math.abs(Math.sin(iceFoxT * 9)) * 0.05 * gait;
  // and the yip: it lifts on its front feet for as long as it is answering
  if (iceFoxYip > 0) iceFoxGroup.position.y += clamp(iceFoxYip, 0, 1) * 0.07;
  // ---- AND IT LOOKS UP -----------------------------------------------------
  // The aurora ignition is twelve seconds of cutscene the player has earned,
  // and for all twelve of them the only other living thing on the island
  // carried on trotting up and down the moraine as if nothing were happening.
  // It sits down and puts its head back, which costs one rotation and is the
  // best two lines in the chapter: the reward is not that the sky lit, it is
  // that something else noticed.
  if (iceAuroraHold > 0 && iceAurora > 0.02) {
    const look = clamp(iceAuroraHold / 2.5, 0, 1);
    iceFoxGroup.rotation.x = -0.55 * look;
    iceFoxGroup.position.y -= 0.09 * look;
    iceFoxT -= dt * iceFOX_SPEED * (1 - iceFoxStare * 0.94);   // and it stops dead
  } else if (iceFoxGroup.rotation.x !== 0) {
    iceFoxGroup.rotation.x = damp(iceFoxGroup.rotation.x, 0, 2.4, dt);
    if (Math.abs(iceFoxGroup.rotation.x) < 0.004) iceFoxGroup.rotation.x = 0;
  }
  if (iceFoxTail) {
    // the tail is up and still when it trots, and sweeps when it has stopped —
    // which is backwards for a dog and right for a fox
    iceFoxTail.rotation.y = Math.sin(iceFoxT * 2.4) * 0.28 * iceFoxStare;
    iceFoxTail.rotation.x = -0.25 - 0.35 * gait;
  }
}

// =============================================================== THE SNOWCAT ==
/**
 * A PISTE MACHINE THAT PATROLS THE MORAINE, AND IT IS A PACING FIX.
 *
 * Measured over every chapter's walking route: Iceland is the one world that
 * fails. More than half of it is empty ground, and the dead stretch is not
 * incidental decoration — it is the hundred and sixty metres between the town
 * and the top of the glacier, which is the approach to the best twenty seconds
 * in the game. `glacier-run` keeps a RECORD, so a player who wants the record
 * walks that empty stretch again on every single attempt. The emptiest ground
 * in the game was the toll charged, repeatedly, on the best thing in it.
 *
 * The fix is deliberately NOT more scenery: the austerity IS the chapter, and
 * filling the valley with props would cost the one thing Iceland has that
 * nowhere else does. The fix is to make the RETURN TRIP SHORT — the same
 * principle as the caravan across the hamada and the Star Ferry across Victoria
 * Harbour, which is exactly why those two long chapters measure fine and this
 * one does not.
 *
 * So: slide down, step on at the snout, ride back to the cairn, go again. The
 * loop is about twenty-five seconds and you spend it looking up at the sky,
 * which is the other thing this chapter is for.
 *
 * It is the fourth kinematic carrier in the game and it is built exactly like
 * the other three (Rio's cable car, Palawan's bangka, the Quay ferry): mass 0,
 * KINEMATIC, `allowSleep = false` because a sleeping body is skipped in
 * narrowphase and the floor of a moving platform that stops existing is the
 * most confusing bug this game has ever had, an honest velocity written every
 * frame so capybara.js can solve in the deck's frame, and the frame DECLARED
 * through carryFrame() rather than sniffed off a solver contact.
 */
const iceCAT_X    = 34;              // the moraine's centre line
const iceCAT_Z0   = -86;             // the bottom, a few metres past the snout
const iceCAT_Z1   = -186;            // the top, level with the cairn
const iceCAT_SPD  = 7.0;             // m/s — the ride is about 14 s
const iceCAT_WAIT = 3.0;             // s it sits at the TOP
// It holds at the bottom while you are walking towards it, and that is the
// whole difference between a shuttle and a missed bus. On a fixed timetable a
// player who has just slid down the glacier arrives at the snout at a random
// point in the cycle and waits, on average, half a loop — which is the same
// dead time this thing exists to delete, moved thirty metres down the hill.
// Capped, so it cannot be parked there for ever by standing next to it.
// THE RIDE BACK EXISTED AND THE PLAYER COULD NEVER CATCH IT.
//
// Iceland is the one chapter that fails route life outright: 110 m of empty
// between the geothermal field and the top of the moraine, walked again on
// every attempt because `glacier-run` is a record. The snowcat is the answer to
// that and its own comment says so. But **every glacier run finishes at
// x ~ -20** — the ice centre line is -16 — while the cat's track is x = 34, and
// this hold radius was 15 m. So the machine that exists to save you the climb
// was 54 m away and already leaving by the time you had walked to it: the toll
// was the walk PLUS up to 31 s of watching it go.
//
// 58 m reaches the runout, and the cap is raised to cover the walk across at a
// trot. Relocating the track onto the fall line is the real fix and it moves
// the beacon, the headlights, the ramp meshes and the fox's orbit with it —
// listed for batch 4 rather than half-done here.
const iceCAT_HOLD_R = 58;            // m — reaches the glacier runout at x ~ -20
const iceCAT_HOLD_MAX = 26;          // s — the longest it will ever be kept
// THE DECK HAS TO BE HOPPABLE, and this is the number the whole thing lives or
// dies by. The first cut put the standing surface 2.7 m over the moraine, which
// is a machine you can admire and cannot board: the capybara steps up 0.4 m by
// itself and hops 1.4 m, so anything above that is scenery. The body origin
// rides at iceCAT_DECK over the ground and the deck slab is 0.15 either side of
// it, which puts the surface at 0.9 m — a deliberate hop, and nothing more.
const iceCAT_DECK = 0.75;            // body origin over the terrain

let iceCatGroup = null, iceCatBody = null, iceCatBeacon = null;
let iceCatT = 0, iceCatDir = 1, iceCatHold = 0, iceCatPrevZ = iceCAT_Z0;
let iceCatCarrying = false;
const iceCatCarry = { x: 0, z: 0 };
let iceCatRodeT = 0;
let iceCatDone = false;

function iceCatZ(t) { return lerp(iceCAT_Z0, iceCAT_Z1, t); }
function iceCatY(z) { return iceTerrain(iceCAT_X, z) + iceCAT_DECK; }

function iceBuildSnowcat(game, root) {
  const M = iceMerger();
  // tracks, hull, cab, and a blade on the front. Chunky and readable from the
  // fixed camera, like everything else in this game.
  // Authored with its tracks on y = 0, so the group sits straight on the
  // terrain and the deck slab lands where the collider says it does.
  M.box(-1.45, 0.3, 0, 0.7, 0.6, 5.6, PALETTE.iceBasaltDk);
  M.box(1.45, 0.3, 0, 0.7, 0.6, 5.6, PALETTE.iceBasaltDk);
  M.box(0, 0.75, 0, 3.6, 0.3, 5.0, PALETTE.iceRoofRed);      // the deck you stand on
  M.box(0, 1.35, -1.3, 2.4, 0.9, 2.0, PALETTE.iceHullBlue);  // the cab, forward
  M.box(0, 1.55, -1.3, 2.0, 0.34, 1.7, PALETTE.iceWindow);
  // low rails down both sides, so a passenger has something to be kept in by
  M.box(2.0, 1.05, 0.6, 0.16, 0.6, 3.6, PALETTE.iceRope);
  M.box(-2.0, 1.05, 0.6, 0.16, 0.6, 3.6, PALETTE.iceRope);
  // the blade: it is a piste basher, and the blade is what says so
  M.box(0, 0.45, -3.3, 4.2, 0.8, 0.28, PALETTE.iceSteam);
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(M.build(), iceVC());
  mesh.castShadow = true;
  g.add(mesh);
  // ---- the beacon, and it FLASHES ----------------------------------------
  // "A beacon on the cab, because it is dark and it has to be findable" — and
  // it was a matt orange box, which is the one thing a beacon is not. It is
  // its own mesh so it can be self-illuminated and pulsed, and the pulse is
  // what makes it findable from the far end of a hundred and sixty metres of
  // moraine: a still light in the dark reads as a window, a turning one reads
  // as a machine.
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.22, 0.30, 8),
    mat(0x000000, { emissive: PALETTE.iceLava, transparent: true, opacity: 0.95, fog: false }));
  beacon.position.set(0, 1.90, -1.3);
  g.add(beacon);
  iceCatBeacon = beacon;
  // and two headlights on the blade, which are the only forward-pointing light
  // in the chapter and are how you see the machine coming down the hill at you
  for (let s2 = -1; s2 <= 1; s2 += 2) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.30, 0.10),
      mat(0x000000, { emissive: PALETTE.iceWindow, emissiveIntensity: 1.0, fog: false }));
    lamp.position.set(s2 * 1.3, 0.95, -3.42);
    g.add(lamp);
  }
  root.add(g);
  iceCatGroup = g;

  const b = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC,
                              material: (game.mats && game.mats.ground) || undefined });
  // A DECK AND TWO RAILS, the bangka's lesson: with one flat box for a floor the
  // animal slides over the side the first time the machine leans into the hill.
  b.addShape(new CANNON.Box(new CANNON.Vec3(1.9, 0.15, 2.6)));
  b.addShape(new CANNON.Box(new CANNON.Vec3(0.16, 0.30, 1.8)), new CANNON.Vec3(2.0, 0.30, 0.6));
  b.addShape(new CANNON.Box(new CANNON.Vec3(0.16, 0.30, 1.8)), new CANNON.Vec3(-2.0, 0.30, 0.6));
  b.allowSleep = false;
  const z0 = iceCatZ(0);
  b.position.set(iceCAT_X, iceCatY(z0), z0);
  iceSyncBody(b);
  game.world.addBody(b);
  iceCatBody = b;
  g.position.set(iceCAT_X, b.position.y - iceCAT_DECK, z0);
}

function iceUpdateSnowcat(game, dt) {
  if (!iceCatBody) return;
  const span = Math.abs(iceCAT_Z1 - iceCAT_Z0);
  iceCatT = clamp(iceCatT + iceCatDir * (iceCAT_SPD / span) * dt, 0, 1);
  // It waits at both ends. A machine that turns round the instant it touches is
  // a machine you chase up the moraine, which is the walk this exists to delete.
  if (iceCatT >= 1 && iceCatDir > 0) {
    iceCatHold += dt;
    if (iceCatHold > iceCAT_WAIT) { iceCatDir = -1; iceCatHold = 0; }
  } else if (iceCatT <= 0 && iceCatDir < 0) {
    iceCatHold += dt;
    // hold the door for somebody who is obviously running for it
    const capy = game.capy;
    let waiting = iceCAT_WAIT;
    if (capy && capy.position && iceCatHold < iceCAT_HOLD_MAX) {
      const dx = capy.position.x - iceCAT_X, dz = capy.position.z - iceCatZ(0);
      if (dx * dx + dz * dz < iceCAT_HOLD_R * iceCAT_HOLD_R) waiting = iceCAT_HOLD_MAX;
    }
    if (iceCatHold > waiting) { iceCatDir = 1; iceCatHold = 0; }
  }

  const z = iceCatZ(iceCatT);
  const y = iceCatY(z);
  const inv = dt > 1e-5 ? 1 / dt : 60;
  const b = iceCatBody;
  // THE VELOCITY COMES FROM THE TARGET, NOT FROM THE BODY.
  //
  // cannon integrates KINEMATIC bodies by their own velocity inside world.step,
  // which runs before every module update — so `(z - b.position.z)` is not the
  // distance still to travel, it is the distance the LAST velocity already
  // carried the body, and deriving the next velocity from it makes the sign
  // flip every frame. Measured while parked at the bottom station: a dead-still
  // machine reporting +7, -7, +7 m/s on alternate frames, for ever. That is the
  // number capybara.js solves the deck's frame against, so a passenger would
  // have been shaken off the moment it stopped.
  //
  // Differencing the TARGET against the previous target is exact at every speed
  // and is honestly zero when the thing is not moving.
  b.velocity.set(0, 0, (z - iceCatPrevZ) * inv);
  iceCatPrevZ = z;
  b.position.set(iceCAT_X, y, z);
  iceSyncBody(b);
  if (iceCatBeacon) {
    // a two-second sweep, not a blink: it is a rotating mirror, and what you
    // see from the side is a soft rise and a hard fall
    const s = (iceTime * 0.5) % 1;
    iceCatBeacon.material.opacity = 0.20 + 0.80 * Math.pow(Math.max(0, Math.sin(s * Math.PI)), 3);
    iceCatBeacon.rotation.y = iceTime * 3.14;
  }
  if (iceCatGroup) {
    iceCatGroup.position.set(iceCAT_X, y - iceCAT_DECK, z);
    iceCatGroup.rotation.y = iceCatDir > 0 ? Math.PI : 0;
    // it noses up and down with the ground it is on
    const ahead = iceCatY(z + (iceCatDir > 0 ? -6 : 6));
    iceCatGroup.rotation.x = clamp((ahead - y) / 6 * (iceCatDir > 0 ? -1 : 1), -0.4, 0.4);
  }

  // ---- is the animal on it -------------------------------------------------
  // Height plus a radius, the bangka's lesson again: an axis-aligned rectangle
  // reads aboard on a fraction of the frames of a ride nobody ever falls off.
  const capy = game.capy;
  iceCatCarrying = false;
  if (!capy || !capy.position) return;
  const p = capy.position;
  const aboard = Math.abs(p.x - iceCAT_X) < 2.6 && Math.abs(p.z - z) < 3.4 &&
                 p.y > y && p.y < y + 3.0;
  iceCatCarrying = aboard;
  if (aboard) {
    iceCatCarry.x = b.velocity.x;
    iceCatCarry.z = b.velocity.z;
    iceCatRodeT += dt;
    if (iceCatRodeT > 2.5 && iceCatRodeT - dt <= 2.5) {
      iceToast('the piste machine runs all night. ride it up, slide it down.');
    }
    // AND IT IS A LINE ON THE LIST NOW. The snowcat was built as a pacing fix —
    // a hundred and sixty metres of moraine is the toll on the best twenty
    // seconds in the chapter, charged every attempt — and it did its job so
    // quietly that a player could finish Iceland without ever noticing the one
    // thing in it that offers them a lift. Eight seconds, which is most of the
    // way up: long enough that it cannot tick by standing on it at the terminus.
    if (!iceCatDone && iceCatRodeT > 8) {
      iceCatDone = true;
      iceTask('snowcat');
      iceSfx('pop', { volume: 0.5, pitch: 0.7 });
      iceToast('no lift pass, no questions, no driver.');
    }
  } else {
    iceCatRodeT = 0;
  }
}

/**
 * REGISTERSHADOWTARGET TURNS castShadow ON FOR EVERY MESH IT CAN REACH, AND
 * IT RUNS LAST.
 *
 * `sysEnableShadows` in systems.js is `o3d.traverse(n => { if (n.isMesh)
 * n.castShadow = true })`, and a biome's build calls it on its own root as the
 * very last thing it does — so every `castShadow = false` written anywhere in
 * this file is silently undone about four lines later. The instrumented shot of
 * the hot spring is the proof: a dozen HARD GREY HEXAGONS painted on the silica
 * where the steam is, in the one place in the chapter whose entire instruction
 * is to sit still and look at it.
 *
 * Nothing that is transparent should ever cast: steam, the aurora curtains, two
 * hundred and sixty stars three hundred metres up, the pools of sodium light on
 * the road (which are the thing the shadow would be falling ON), the geyser's
 * column and its dome, and every surface of water in the biome. Turning them
 * back off after the fact is four lines and it is also a real saving in the
 * shadow pass, which is the most expensive thing this renderer does.
 */
/**
 * THE TRAVERSE THAT UNDOES EVERY castShadow = false IN THIS FILE, AND THE ONE
 * CASE IT COULD NOT SEE.
 *
 * registerShadowTarget answers with traverse(n => { if (n.isMesh) n.castShadow
 * = true }), so every false above is silently reverted; this puts it back. But
 * it only recognised GHOSTS — transparent, additive, depth-write-off — which
 * covers the aurora, the steam and the light pools and covers nothing else.
 *
 * An OPAQUE mesh authored castShadow = false sailed through both. Measured:
 * the puffin colony, 27,600 triangles and the largest single object in the
 * chapter, said false and cast anyway. So did every instanced batch in
 * iceBuildFlora that said false. userData.noShadow is the honest channel and
 * the material sniff is the fallback.
 */
function iceNoShadowOnGhosts(root) {
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

function iceBuild(game) {
  if (iceBuilt) return;
  iceBuilt = true;
  iceInitGeos();

  iceRoot = new THREE.Group();
  iceRoot.name = 'iceland';
  game.scene.add(iceRoot);

  iceRoot.add(iceBuildGroundMesh());
  iceBuildGroundBody(game);
  iceRoot.add(iceBuildSea());
  // (the sky rig is created inside iceBuildAurora, below, and the stars are
  //  re-parented into it there)
  iceBuildLagoon(iceRoot);
  iceBuildSpring(iceRoot);
  iceBuildGeothermal(game, iceRoot);
  iceBuildCity(game, iceRoot);
  iceBuildChurch(game, iceRoot);
  iceBuildPylsa(game, iceRoot);
  iceBuildHarbour(game, iceRoot);
  iceBuildCliff(game, iceRoot);
  iceBuildFlora(game, iceRoot);
  iceBuildScatter(game, iceRoot);
  iceBuildCairns(game, iceRoot);
  iceBuildTurfHouses(game, iceRoot);
  iceBuildRacks(game, iceRoot);
  iceBuildColumns(game, iceRoot);
  iceBuildSheep(iceRoot);
  iceBuildSnowcat(game, iceRoot);
  iceBuildFox(iceRoot);
  iceBuildWhale(iceRoot);
  iceBuildSteam(iceRoot);
  iceBuildAurora(iceRoot);
  iceBuildStars(iceSkyRig || iceRoot);

  // ---- THE PEOPLE WHO LIVE HERE ------------------------------------------
  // See npc.js, THE LOCALS. Each of these is a point somebody is standing at,
  // a few things they might say when the capybara turns up, and a different
  // few for when it wheeks at them. Where the chapter owns a Group for the
  // figure, it is handed over too and the figure turns to watch.
  //
  // ---- AND THEY KNOW WHAT TIME IT IS NOW (v21) ---------------------------
  // Eight people, twenty-four sentences, and not one of them changed between
  // the first second of the chapter and the last. You could rob the hot dog
  // stand, ride Strokkur, take the glacier down in one go and sit in the pool
  // until the whole northern sky lit up over the town — and the man at the
  // stand would still be offering you one with everything. See localResolve in
  // npc.js: a line may carry `before`/`after` a task id or a `when` predicate,
  // `onTask` is what somebody says at the moment you do a thing in front of
  // them, and `praise` is their general opinion of you. All of it existed and
  // none of it was wired up in this chapter — chapters 4, 5 and 6 have had it
  // since their own passes.
  //
  // The rule the lines are written to: a person in Reykjavik at half past
  // eleven at night is NOT amazed by the aurora. They have seen four thousand
  // of them. What they are is mildly interested that you sat still long enough
  // to get one.
  if (typeof game.addLocal === 'function') {
    const lit = function () { return iceAurora > 0.35; };
    const soaking = function () {
      return !!(iceGame && iceGame.iceland && iceGame.iceland.soak() > 0.1);
    };
    // AT THE HATCH, NOT INSIDE THE VAN. Found with a body-overlap audit: the
    // stand is a 4.2 x 2.6 x 2.6 solid box centred on icePYLSA and he was
    // authored at icePYLSA — completely enclosed by the thing he serves out of,
    // invisible from every angle, his collider inside its collider. Fifth
    // instance of the class in the game (Rio's kiosk vendor, the harbourmaster,
    // Marrakech's juice seller and snake charmer), and it keeps happening for
    // one reason: the landmark constant is the point the task BEACON aims at,
    // and that is never a place a person can stand. He is at the end of his own
    // counter now, on the hatch side, which is the side the task is on.
    iceLocPylsa = game.addLocal({ biome: 'iceland',
      x: icePYLSA.x + 2.9, y: iceTerrain(icePYLSA.x + 2.9, icePYLSA.z + 1.5),
      z: icePYLSA.z + 1.5, near: 7, face: -2.05,
      figure: { shirt: PALETTE.cloth1, hat: PALETTE.cloth6 },
      lines: [{ t: 'Eina með öllu? One with everything?', before: 'pylsa' },
              { t: 'Four hundred and ninety krona. To you, four hundred and ninety krona.', before: 'pylsa' },
              'It is not that cold. You are just wet.',
              'Bill Clinton stood exactly where you are standing.',
              { t: 'You did not even wait for the remoulade.', after: 'pylsa' },
              { t: 'I have been robbed by gulls before. This is a first.', after: 'pylsa' },
              { t: 'Come back in the day and pay for one. I am open in the day.', after: 'pylsa' },
              { t: 'You are dripping on the counter. Again.',
                when: function () { return !!(iceGame && iceGame.capy && (iceGame.capy.wet || 0) > 0.4); } },
              { t: 'Everybody comes out for that. Nobody buys anything.', when: lit }],
      wheek: ['We do not shout at the stand. It is a small country.',
              'Fine. FINE. One with everything.',
              { t: 'That is the second loudest thing that has happened tonight.', when: lit }],
      onTask: { 'pylsa': ['HEY. That was four hundred and ninety krona.',
                          'With everything. It had EVERYTHING on it.'],
                'organ': ['That was you? From here it sounded like the building falling over.'],
                'aurora': ['Well. Yes. It does that.'] },
      praise: ['I saw that from the stand. I am not saying anything.'] });
    // ON THE BOARDS. The pier deck's top face is at 1.4 (deckY 1.2 plus half of
    // a 0.4 slab) and he was placed at 0.8 — buried to the shins in the one
    // piece of decking in the chapter, with his collider in it too. Probing
    // terrainHeight would not have saved him either: the causeway under the
    // boards reads 1.0. Some floors are drawn, and you have to ask the drawing.
    iceLocPier = game.addLocal({ biome: 'iceland', x: icePIER.x - 1.6, y: 1.4, z: icePIER.z + 4, near: 8,
      figure: { shirt: PALETTE.hiVis, legs: PALETTE.denim },
      lines: ['Weather is coming. Weather is always coming.',
              'If you are getting on, get on.',
              'Sky does that most nights. Still worth stopping for.',
              // the humpback: three different people to be, depending on
              // whether she is out there and whether you have seen her yet
              { t: 'Stay out on the end a while. There is something in the bay tonight.',
                before: 'the-whale' },
              { t: 'Fin came past twice last night. Nobody was up to see it.',
                before: 'the-whale' },
              { t: 'You saw her, then. Thirty tonnes and she still takes a run-up.',
                after: 'the-whale' },
              { t: 'THERE. Out past the moorings — look now, not in a minute.',
                when: function () { return !!(iceGame && iceGame.iceland && iceGame.iceland.whaleUp()); } },
              { t: 'Green sky and a whale in the same night. That is a Tuesday, that is.',
                when: lit }],
      wheek: ['Aye. Loud out here, is it not.',
              { t: 'Do that again and she will come and look at YOU.', before: 'the-whale' }],
      onTask: { 'the-whale': ['THIRTY TONNES. Out of the water. Eight metres off my boards.',
                              'Eleven years I have stood here. Twice, I have seen that. Twice.'],
                'aurora': ['That is a good one. Nine, I would say. Out of ten.'] },
      praise: ['Mm. This harbour has seen worse.'] });
    // FOUR MORE. Two people in a chapter is not austerity, it is an oversight
    // dressed as one: the emptiness of Iceland is the LANDSCAPE, and the town
    // in the middle of it is supposed to be the warm bit. One in the street,
    // one at the church door, one at the hot pool and one at the head of the
    // moraine, which are the four places the chapter stops you anyway.
    iceLocStreet = game.addLocal({ biome: 'iceland', x: -6, y: iceTerrain(-6, iceLANES[0] + 4.5),
      z: iceLANES[0] + 4.5, near: 7, face: Math.PI,
      figure: { shirt: PALETTE.iceHullBlue, legs: PALETTE.denim, hat: PALETTE.iceRoofRed },
      lines: ['Half eleven. It does not get darker than this until October.',
              'Everybody is inside. That is not rudeness, that is sense.',
              'You are the second strangest thing on this street tonight.',
              { t: 'Straight up that hill for the church. You cannot miss it, it IS the hill.',
                before: 'organ' },
              { t: 'Somebody has been at the organ. The whole street heard it.', after: 'organ' },
              { t: 'The pool is out past the vents. Go and sit in it. Everybody does.',
                before: 'hot-spring' },
              { t: 'Look up, then. Go on. That is what we all came out for.', when: lit },
              { t: 'It is raining sideways. It is always raining sideways.',
                when: function () { return !!(iceGame && iceGame.weather && iceGame.weather.drizzle()); } }],
      wheek: ['That will have woken the whole road.',
              'Keep it down. There are people asleep behind every one of those.'],
      onTask: { 'organ': ['Was that the ORGAN? At this hour?'],
                'pylsa': ['He will be talking about that for a decade.'],
                'aurora': ['Right. Right. Everybody out.'] } });
    iceLocChurch = game.addLocal({ biome: 'iceland', x: iceCHURCH.x + 6.5,
      y: iceTerrain(iceCHURCH.x + 6.5, iceCHURCH.z + 6), z: iceCHURCH.z + 6, near: 7,
      figure: { shirt: PALETTE.iceChurchDk, legs: PALETTE.stoneDark },
      lines: [{ t: 'Five thousand two hundred and seventy-five pipes. Do not touch it.',
                before: 'organ' },
              { t: 'It is locked. It is always locked. Do not get any ideas.', before: 'organ' },
              'The wings are basalt columns. The whole building is a picture of the coast.',
              'It took forty-one years. Nobody who started it saw it finished.',
              { t: 'Five thousand two hundred and seventy-five pipes, and you found the loudest.',
                after: 'organ' },
              { t: 'It is voiced for a room with people in it. There were no people in it.',
                after: 'organ' },
              'You can see the whole town from the tower. You are not going up the tower.',
              { t: 'The concrete goes green on nights like this. Worth the walk up for.',
                when: lit }],
      wheek: ['...that was very nearly in tune.',
              { t: 'Do that inside and I shall have to write to somebody.', after: 'organ' }],
      onTask: { 'organ': ['FORTY-ONE YEARS to build, and a rodent leans on it.',
                          'That was the thirty-two foot. That was the THIRTY-TWO FOOT.'],
                'aurora': ['I have photographed four hundred of those. Still come out.'] },
      praise: ['This is a place of worship. Nominally.'] });
    iceLocSpring = game.addLocal({ biome: 'iceland', x: iceSPRING.x + 9.5,
      y: iceTerrain(iceSPRING.x + 9.5, iceSPRING.z + 2), z: iceSPRING.z + 2, near: 8,
      figure: { shirt: PALETTE.iceHouse4, legs: PALETTE.iceRope },
      lines: [{ t: 'Get in. Sit still. That is the whole of it.', before: 'hot-spring' },
              { t: 'Thirty-eight degrees, all year, for nothing.', before: 'hot-spring' },
              'People come a very long way to do absolutely nothing here.',
              { t: 'You are still in it. Good. Nobody stays in long enough.', when: soaking },
              { t: 'Best sit I have seen, and I watch this pool for a living.', after: 'hot-spring' },
              { t: 'That is what it is FOR. Everybody else gets out to check something.',
                after: 'hot-spring' },
              { t: 'The sky did that because you sat down. Cause and effect. Do not argue.',
                when: lit },
              'Mind the vents on the way back. The little ones are the hot ones.'],
      wheek: ['You are in a hot spring. What could you possibly need?',
              { t: 'Sssh. Sssh. You will put the sky off.', when: soaking }],
      onTask: { 'hot-spring': ['Seven seconds. Most people manage two.',
                               'And THAT is the correct way to use a country.'],
                'aurora': ['I have said it for years. Sit down and it comes.'] },
      praise: ['Whatever that was, do it somewhere that is not my pool.'] });
    iceLocCat = game.addLocal({ biome: 'iceland', x: iceMOR_X0 + 9, y: iceTerrain(iceMOR_X0 + 9, iceGL_Z1 + 26),
      z: iceGL_Z1 + 26, near: 9,
      figure: { shirt: PALETTE.hiVis, legs: PALETTE.iceBasaltDk, hat: PALETTE.iceRoofRed },
      lines: [{ t: 'Cat runs all night. Get on it at the bottom, it will wait for you.',
                before: 'snowcat' },
              { t: 'You do not have to walk up. Nobody walks up. I have never walked up.',
                before: 'snowcat' },
              'Down the middle, not the sides. The sides are where the seracs are.',
              'Forty years I have groomed this and I have never once gone down it.',
              { t: 'You rode it, then. Everybody works that out eventually.', after: 'snowcat' },
              { t: 'Second one is always faster. Go again.', after: 'glacier-run' },
              { t: 'Whatever you did down there, the whole tongue heard it.', after: 'glacier-run' },
              { t: 'Sky is out. I shall still be up here when it goes back in.', when: lit }],
      wheek: ['There is nothing up here to hear you but me.',
              'And the fox. There is always the fox.'],
      onTask: { 'glacier-run': ['In ONE. Nobody takes it in one.',
                                'A hundred and thirty metres and it never touched the sides.'],
                'snowcat': ['Hold on to something. It is not a bus.'],
                'geysir': ['I watched that from up here. You went a LONG way up.'] },
      praise: ['Forty years. Forty years, and I have not seen that.'] });
    // ---- AND TWO MORE, WITH THE THINGS THAT ARE NEW ----------------------
    // The six above are all inside forty metres of the town or standing at a
    // set piece. The two hundred metres between the last house and the moraine
    // — the walk everybody makes twice — had nobody in it at all, which is the
    // half of this chapter's emptiness that is an oversight rather than the
    // point. One with the flock and one at the racks: both of them are the
    // reason the thing beside them exists.
    iceLocSheep = game.addLocal({ biome: 'iceland', x: iceFLOCKS[0].x + 9,
      y: iceTerrain(iceFLOCKS[0].x + 9, iceFLOCKS[0].z + 4), z: iceFLOCKS[0].z + 4, near: 9,
      figure: { shirt: PALETTE.iceHouse6, legs: PALETTE.iceMoraineDk, hat: PALETTE.iceRoofGrey },
      lines: ['Round-up is September. Until then they go where they like.',
              'There are more of them than us. There have always been more of them than us.',
              'Do not walk at them. Walk past them and they will come to you.',
              'The cairns take you to the ice. Follow them, do not follow the ground.',
              { t: 'They have been jumpy since the geyser went. Everything is.',
                when: function () { return !!(iceGame && iceGame.iceland && iceGame.iceland.geyserSwelling()); } },
              { t: 'Green sky. They will not settle now until it goes.', when: lit },
              { t: 'You have been on the ice. It is all over your feet.', after: 'glacier-run' }],
      wheek: ['Now look what you have done.',
              'They will be halfway to the lagoon by morning. Thank you.'],
      onTask: { 'glacier-run': ['Down the whole thing? On purpose?'],
                'aurora': ['Aye. That will be the sheep awake all night, then.'] },
      praise: ['The sheep saw. The sheep tell me everything.'] });
    iceLocRack = game.addLocal({ biome: 'iceland', x: iceRACK[0][0] - 4,
      y: iceTerrain(iceRACK[0][0] - 4, iceRACK[0][1] - 3), z: iceRACK[0][1] - 3, near: 8,
      figure: { shirt: PALETTE.iceHull, legs: PALETTE.iceBasaltDk },
      lines: ['Six weeks in the wind and it will keep for three years.',
              'You can smell it from the church. That is how you know it is working.',
              'No, you cannot have one.',
              'That rock out there is the oldest thing you will see today.',
              { t: 'The birds are on the stack tonight. Go and stand among them, they do not mind.',
                before: 'puffins' },
              { t: 'You went in among them. They will talk about you for a week.',
                after: 'puffins' },
              { t: 'There is a whale in the bay. She comes in on the ebb.', before: 'the-whale' }],
      wheek: ['Everything on this shore heard that.',
              'The birds will be up. Go and watch, it is worth it.'],
      onTask: { 'puffins': ['ELEVEN HUNDRED of them. All at once. Off my cliff.'],
                'the-whale': ['She has not come in that close since the spring.'] },
      praise: ['Right. Whatever that was.'] });

    // ---- AND THREE CONVERSATIONS THAT ARE NOT WITH YOU -------------------
    // See addExchange in npc.js. Everything anybody said in this chapter was
    // addressed to the capybara, so a town of eight people at half past eleven
    // at night was completely silent unless you walked up and stood in front of
    // one of them. These run when you are near enough to read both bubbles and
    // far enough not to be the subject.
    //
    // In this chapter it does a second job. The emptiness is the point, and an
    // empty place has two possible readings — LEFT ALONE, or unfinished — and
    // the difference between them is entirely whether the few people in it have
    // anything to say to each other. Four words overheard across a wet street
    // is the cheapest way there is to buy the first reading.
    if (typeof game.addExchange === 'function') {
      if (iceLocPylsa && iceLocStreet) {
        game.addExchange({ biome: 'iceland', a: iceLocStreet, b: iceLocPylsa, lines: [
          ['Still open?', 'I am always open. That is the entire business model.'],
          ['Busy?', 'Two Germans and a rodent.'],
          ['Cold one.', 'It is nine degrees.'],
          ['Sky is coming out.', 'Sky is always coming out. Nobody buys a pylsa for the sky.'],
          ['Did you hear it go, out at the vents?', 'I hear everything from here. That is the job.'],
        ] });
      }
      if (iceLocPier && iceLocRack) {
        game.addExchange({ biome: 'iceland', a: iceLocRack, b: iceLocPier, gap: 34, lines: [
          ['Anything in the bay?', 'Something big. Not saying what.'],
          ['Wind is backing.', 'Wind is backing. It will be a filthy morning.'],
          ['Six weeks and they are done.', 'They smell done now.'],
          ['Birds are up.', 'Something has been at them.'],
          ['Is that an animal on your pier?', 'It has been on my pier for a while.'],
        ] });
      }
      // ONE HUNDRED AND SEVENTY-FOUR METRES APART. This exchange paired the
      // snowcat driver at (35, -170) with the spring keeper at (-30.5, -8.4).
      // `npcEX_MIN/MAX` are 6 and 26 m and they gate on the PLAYER's distance
      // to the pair, not on the pair's distance to each other — so it fired
      // happily and you read exactly one bubble: a reply to nobody, from a man
      // a hundred and seventy metres over a moraine. The `gap: 40` on it was
      // the only clue and it is not a check.
      //
      // The spring keeper's neighbour is the shepherd — 32 m, both on the flat
      // ground south of the geothermal field, and the lines are better for it.
      if (iceLocSpring && iceLocSheep) {
        game.addExchange({ biome: 'iceland', a: iceLocSheep, b: iceLocSpring, gap: 34, lines: [
          ['Still watching that puddle?', 'It is thirty-eight degrees and it is free.'],
          ['Anybody up the hill?', 'Nobody goes up the hill. That is why he has a job.'],
          ['Sky is due.', 'Sky is due. Sit down for it.'],
        ] });
      }
    }
  }
  if (typeof game.registerShadowTarget === 'function') game.registerShadowTarget(iceRoot);
  // ...and then take it back off the things that must never have had it.
  iceNoShadowOnGhosts(iceRoot);
}
