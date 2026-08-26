import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PALETTE, mat, rand, randInt, clamp, damp, lerp, grain, grainOwn } from './shared.js';

// ===========================================================================
// CHAPTER 10 — VENICE, AND THE WATER IS COMING IN
//
// Ten chapters have quietly agreed on one thing without ever saying it: that
// the ground is where it was the last time you looked. A glacier slides, a bus
// drives off with you on it, an island wanders, but the FLOOR — the set of
// places you may stand — has been a constant since the Botanic Gardens.
//
// Venice has never agreed to that in its life, and that is the chapter.
//
//  1. THE WATERLINE IS A CLOCK. `venWaterY` runs a tide: low, rising, high,
//     falling, on a three-and-a-half minute cycle, and `isOverWater(x, z)` is
//     simply "is the tide over the paving here". Piazza San Marco is the lowest
//     ground in the city (this is true, and it is why the pictures exist), so it
//     goes under first and comes back last, and while it is under it is not a
//     square, it is a lagoon with a basilica on the end of it.
//
//     capybara.js used to hardcode the sea at −0.5 in three separate places —
//     swim below y 0.2, float at −0.42, stop clambering above 1.80 — which made
//     a tide flatly impossible. They are offsets from the live waterline now and
//     numerically identical at −0.5, so nine chapters did not move a millimetre.
//
//  2. THE SIREN IS A PROMISE. Venice really does sound four rising tones before
//     an acqua alta, and the city really does put out the passerelle — raised
//     duckboards — on the flooded routes. Both are here and both mean what they
//     mean: the siren says ninety seconds, and the boards say THIS is the way
//     across now. A chapter whose central event is a surprise the first time
//     has to be a schedule every time after it, or it is a punishment.
//
//  3. IT COMES ROUND AGAIN. The flood is not a one-shot cutscene. Miss it,
//     arrive late, spend the whole of it in a side canal — it will be back in
//     three minutes. Nothing in this game may be missable for ever.
//
// The marquee moment is the top of the tide in San Marco: the square goes under
// two centimetres at a time, the arcade lamps come on, and the whole city stands
// on its own reflection. The reflection is a real thing in the scene — the
// basilica, the campanile and the arcades built a second time, mirrored in y and
// drawn under a half-transparent water plane — because a mirror you can swim
// across is worth thirty draw calls of anybody's budget.
//
// Geography, from the water inward (the player faces −z on arrival):
//
//   z > 15            THE BACINO. Open lagoon, San Giorgio out in it.
//   z 10..15          the Molo, and the two columns. The way out of the chapter.
//   x −14..6, z −16..10   the Piazzetta, palace to the east, library to the west
//   x −58..2, z −52..−16  PIAZZA SAN MARCO. The basilica closes the east end,
//                     the campanile stands on the corner, arcades down both sides.
//   x −92..−64        the calli: a small dense maze, cut in half by a rio.
//   the polyline      THE GRAND CANAL, out of the Bacino and away north-west,
//                     with the Rialto over it and a gondola on it.
//
// Everything is prefixed `ven` (contract: the bundler flattens every module into
// one scope).
// ===========================================================================

// ---------------------------------------------------------------- geography --
// THE SQUARE RUNS ALONG Z, AND THAT IS NOT AN ARBITRARY CHOICE.
//
// The camera sits nine and a half metres behind the animal at forty-one degrees
// with a forty-eight degree vertical FOV, which puts the top of the frame
// seventeen degrees BELOW horizontal — it meets flat ground twenty-four metres
// out and the horizon is never in the picture at all. A sixty-metre square laid
// out ACROSS that view is therefore not a square, it is a photograph of some
// paving with two beige strips at the edges: measured, the first cut of this
// chapter had the arcades thirty metres to either side and neither of them was
// in shot from the middle.
//
// Laid along z, with the default camera looking down it, the same square is the
// view everybody knows: two arcades twelve metres away on each hand, the
// campanile crossing the frame, and the basilica closing the far end. Nothing
// about the chapter changed; it was rotated ninety degrees so that the thing
// the player walks toward is the thing the camera is pointed at.
const venSPAWN = { x: -4, y: 1.4, z: 13 };

// One square, running north from the water; the southern third of it is the
// Piazzetta and the rest is the Piazza. They are separate rectangles only
// because the zone tests and the paving want to know which is which.
const venPZ_X0 = -16, venPZ_X1 = 8, venPZ_Z0 = -56, venPZ_Z1 = -14;   // Piazza
const venPT_X0 = -16, venPT_X1 = 8, venPT_Z0 = -14, venPT_Z1 = 10;    // Piazzetta
const venMOLO_Z0 = 6, venMOLO_Z1 = 16;
const venLAGOON_Z = 15;

const venCAMPANILE = { x: 12, z: -17, h: 42, w: 7.4 };
const venBASILICA  = { x: -4, z: -70 };
// THE TWO COLUMNS STAND WHERE THE PLAYER ARRIVES, five metres in front of the
// spawn and one either side, because at this camera the frame's top edge points
// seventeen degrees BELOW horizontal and the only things that appear in a shot
// are the things within about twenty metres. A square this size needs something
// TALL and NEAR at the point you walk into it, or the arrival is a photograph of
// paving — which is exactly what the first cut of it was.
const venCOLUMNS   = [{ x: -9, z: 8 }, { x: 1, z: 8 }];
// UNDER the west arcade, which only became a place to be on 21 Aug 2026 —
// before that the colonnade was solid to the façade line and the café was five
// tables laid at right angles to it, three of them inside the building.
const venCAFE      = { x: -17.8, z: -20 };
const venCAMPO     = { x: -54, z: -24 };        // where the duckboards end
// THE CLOCK. It stands in the square's north-east corner, between the end of
// the east Procuratie and the flank of the basilica, which is exactly where it
// stands in life. Its face is on the square's edge (x = venPZ_X1) and the two
// bronze Moors on the terrace strike the bell on the hour, whether or not
// anybody is in the square to hear it.
const venORO = { x: venPZ_X1, z: -51, w: 10, d: 9, top: 25.0 };
const venORO_Z1 = -46;              // where the arcade to the south of it starts

// the calli
const venCAL_X0 = -78, venCAL_X1 = -30, venCAL_Z0 = -56, venCAL_Z1 = 4;
const venRIO_X = -62, venRIO_W = 9;             // the side canal through them
const venRIO_BRIDGES = [-40, -12];

// the Grand Canal, as knots. Everything about it — the cut in the terrain, the
// banks, the palazzi, the gondola's route and the Rialto's abutments — is read
// off ONE resampled table, so none of them can disagree with each other.
// See CONTRACT / the centreline note: this is the third feature in this game
// built that way and it is the reason it took an afternoon instead of a week.
const venCANAL_KNOTS = [
  -92, 32, -98, 10, -106, -12, -116, -34, -132, -54, -152, -70,
];
const venCANAL_W = 18;                          // full width of the water
const venCANAL_BED = -3.6;
const venRIALTO_S = 0.42;                       // where the bridge crosses, 0..1

// levels
// THE LEVELS ARE THE WHOLE MECHANIC. San Marco is the lowest ground in Venice
// (this is true, and it is why the photographs exist) and everything else in
// the city stands a metre or more above it. At the top of the tide that is the
// difference between a square you swim across and a lane you walk down — which
// is the route the duckboards exist to complete. The first cut had the city
// only 85 cm up and the whole island went under together: dramatic, and it
// deleted the chapter, because if everywhere floods there is nothing to learn.
//
// The blends between them are 3.5 m wide, which puts every step up at about
// twenty degrees — a ramp the capybara walks, not a wall it has to hop.
const venCITY_Y = 1.30;                         // ordinary Venice
const venMOLO_Y = 1.00;                         // the quay, a touch above the square
const venFOND_Y = 1.55;                         // the canal banks, higher again
const venLAGOON_Y = -3.8;

// ---- THE TIDE --------------------------------------------------------------
// A cycle, not an event. Phase 0 is dead low; the siren goes at venTIDE_WARN and
// the water is at the top from venTIDE_TOP0 to venTIDE_TOP1.
const venTIDE_PERIOD = 205;         // s for a whole cycle
const venTIDE_WARN  = 0.300;        // the siren
const venTIDE_RISE0 = 0.340;
const venTIDE_RISE1 = 0.500;
const venTIDE_FALL0 = 0.780;
const venTIDE_FALL1 = 0.960;
const venTIDE_LOW  = -1.30;
const venTIDE_HIGH =  0.95;         // a metre of water over the piazza. Swimmable.
const venTIDE_START = 0.055;        // where the clock is when you arrive: low, and
                                    // about a minute of it to look round in

// ---- the duckboards --------------------------------------------------------
// One chain, laid out as a polyline, from the Molo to the campo behind the
// calli. They are out only when the water is up, which is what makes them a
// route rather than scenery.
// CHECK WHAT IS ALREADY THERE.
// The first route left the square between x -12 and x -22 at about z -32, which
// is straight through the west Procuratie — fifty metres of unbroken arcade with
// a solid collider behind it. Measured, the run ended at x = -15.3 every single
// time, wedged against a wall, because the duckboards had been laid through a
// building. They go through the SOTOPORTEGO now (venARCH_Z), which is a real
// hole in a real arcade, cut for them.
const venARCH_Z = -31;              // the passage through the west arcade
const venARCH_W = 7;                // and how wide it is
const venBOARD_KNOTS = [
  -4, 11.5, -4, 0, -4, -12, -8, -22, -12, -28, -14, -31, -20, -31,
  -28, -31, -38, -30, -48, -27, -54, -24,
];
// A METRE NINE, and it is not a stylistic choice. capybara.js starts swimming
// at waterLevel + 0.70, the tide tops out at +0.95, and a deck at 1.32 put the
// animal's centre at 1.74 — nine centimetres of margin, so a single bob started
// a swim and slid it off its own duckboard. The whole point of the passerelle is
// that it is the DRY route.
const venBOARD_Y = 1.90;            // deck height above the piazza paving
const venBOARD_W = 3.0;

const venPIGEON_N = 180;
const venPIGEON_R = 5.2;            // how close before a pigeon has had enough
const venGOND_SPEED = 0.0125;       // fraction of the canal per second
const venSTAR_N = 0;

// ---------------------------------------------------------------- scratch ---
const venV3 = new THREE.Vector3();
const venV3b = new THREE.Vector3();
const venQ  = new THREE.Quaternion();
const venEu = new THREE.Euler();
const venSc = new THREE.Vector3();
const venM  = new THREE.Matrix4();
const venCol = new THREE.Color();
const venSkyCol = new THREE.Color(PALETTE.venSkyLow);
const venCanalDeepCol = new THREE.Color(PALETTE.venCanalDeep);

// ---------------------------------------------------------------- state -----
let venGame = null;
let venBuilt = false;
let venRoot = null;
let venTime = 0;
let venPhase = venTIDE_START;
let venWaterY = venTIDE_LOW;
let venWaterMesh = null, venWaterMat = null;
let venWaterAttr = null, venWaterBase = null;
let venLagoonMesh = null;
let venBoardGroup = null, venBoardOut = 0;
let venBoardBodies = null;
let venPigeonMesh = null;
let venPigeonData = null;           // x,z,phase,up,vy,y,vx,vz per bird
let venPigeonUp = 0, venPigeonPeak = 0, venPigeonHold = 0;
// The clatter ladder. Counts, not fractions, so they survive a resize of the
// flock. See the note at the bottom of venUpdatePigeons.
const venPIGEON_RUNGS = [18, 45, 90, 140];
let venPigeonRung = 0;
let venClatter = 0, venClatterN = 0, venClatterV = 0;
// the centre of the wheel, when the square is under and the flock is up. It
// drifts down the length of the Piazza on its own slow clock, which is what
// stops a hundred and eighty birds turning in one fixed circle for ever.
let venFlockX = -4, venFlockZ = -34;
let venGondGroup = null, venGondBody = null, venGondOar = null;
let venGondS = 0.10, venGondDir = 1, venGondYaw = 0;
let venGondRideT = 0;
let venGondPX = 0, venGondPZ = 0;   // previous TARGET — see the note in venUpdateGondola

let venLampT = 0;
let venSirenT = -1, venSirenStep = 0;
let venSeenFlood = false;
let venFloodedNow = false;
let venWasFlooded = false;
// How long the marquee stays claimable after the water crosses the square.
// See the long note in venUpdateTide — this is the difference between a set
// piece and a coin toss.
const venFLOOD_GRACE = 18;
let venFloodWin = 0;
let venBoardRunT = -1, venBoardRunBest = 0, venBoardFrom = 0, venBoardOff = 0;
let venOnBoards = false, venBoardIdx = -1;
let venSpritzDone = false, venPigeonDone = false, venBoardDone = false;
let venGondDone = false, venRialtoDone = false, venFloodDone = false, venSwimDone = false;
let venRialtoT = -1, venRialtoFrom = 0, venRialtoHigh = 0;
let venSwimRun = 0, venSwimFromX = 0, venSwimTo = 0, venSwimHas = false;
let venCafeGroup = null;
let venTideTold = 0;
// where the sotoportego's two lamps go. Filled in while the passage is built
// and read by venBuildLamps, which runs after it.
const venARCH_LAMPS = [];
// where the fruit boat ended up, and where its owner should stand. Filled in
// venBuildCanal off the canal table, read by the locals block at the bottom.
const venFRUIT = { x: -100, z: -17, lx: -95, lz: -17, face: -2.1 };
// the lit shop windows in the back of the loggia: x, y, z, w, h. They are on a
// MeshBasicMaterial (see venBuildLamps) because a shop window in a shadowed
// colonnade is a light source and a Lambert one is a grey rectangle.
const venSHOP_LIT = [];
// EVERYTHING THAT FLOATS GOES IN HERE. One merger filled by two different
// build functions (the rio's topi and the Grand Canal's fruit barge), built
// into one group at the end of venBuild, and that group's y is the waterline.
// Authored so that y = 0 is the surface, which is the only convention under
// which a moored boat can be drawn once and be right at every state of a tide.
let venFloatM = null, venFloatGroup = null;
// the loggia's own lights and the pools they throw. Filled while the arcades
// are built and drawn by venBuildLamps, which runs after them.
const venLOG_LAMPS = [];      // x, y, z
const venLOG_POOLS = [];      // x, y, z, radius
// the three flagpoles in front of the basilica: x, y of the halyard head, z.
// Filled while the façade is built; venBuildFlags hangs a flag on each.
const venFLAGS = [];
let venFlagMesh = null, venFlagGust = 0;

// the resampled canal table: x, z, and cumulative arclength
let venCanX = null, venCanZ = null, venCanS = null, venCanLen = 0;
// and the boards
let venBrdX = null, venBrdZ = null, venBrdS = null, venBrdLen = 0;

// =========================================================== GEOMETRY UTIL ==
function venXform(px, py, pz, rx, ry, rz, sx, sy, sz) {
  venEu.set(rx, ry, rz, 'YXZ');
  venQ.setFromEuler(venEu);
  venV3.set(px, py, pz);
  venSc.set(sx, sy, sz);
  venM.compose(venV3, venQ, venSc);
  return venM;
}

const venG = { box: null, cyl16: null, cyl6: null, cyl8: null, cyl4: null, cone6: null, cone4: null,
               sph6: null, tet: null, cylOpen: null };
function venInitGeos() {
  if (venG.box) return;
  venG.box = new THREE.BoxGeometry(1, 1, 1);
  venG.cyl6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
  venG.cyl8 = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
  venG.cyl4 = new THREE.CylinderGeometry(0.5, 0.5, 1, 4);
  // and a round one: a three-metre pool of lamplight drawn on eight sides is
  // an octagon lying on the floor, which is all anybody would see of it.
  venG.cyl16 = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
  venG.cone6 = new THREE.ConeGeometry(0.5, 1, 6);
  venG.cone4 = new THREE.ConeGeometry(0.5, 1, 4);
  venG.sph6 = new THREE.SphereGeometry(0.5, 6, 4);
  venG.tet = new THREE.TetrahedronGeometry(0.5);
}

/**
 * The merger. CONTRACT: box() takes FULL extents; CANNON.Box takes HALF, and
 * venStaticBox() below speaks THIS one so the two can never be a factor of two
 * apart. That mistake cost Rio half its parade avenue.
 */
function venMerger() {
  const pos = [], nor = [], col = [], idx = [];
  const M = {
    n: 0,
    add(geo, m4, color) {
      const g = geo.clone();
      g.applyMatrix4(m4);
      const p = g.attributes.position.array;
      const nm = g.attributes.normal.array;
      venCol.set(color);
      const start = M.n;
      for (let i = 0; i < p.length; i += 3) {
        pos.push(p[i], p[i + 1], p[i + 2]);
        nor.push(nm[i], nm[i + 1], nm[i + 2]);
        col.push(venCol.r, venCol.g, venCol.b);
      }
      const vc = p.length / 3;
      if (g.index) { const ia = g.index.array; for (let i = 0; i < ia.length; i++) idx.push(start + ia[i]); }
      else { for (let i = 0; i < vc; i++) idx.push(start + i); }
      M.n += vc;
      g.dispose();
      return M;
    },
    box(cx, cy, cz, sx, sy, sz, color, rx, ry, rz) {
      return M.add(venG.box, venXform(cx, cy, cz, rx || 0, ry || 0, rz || 0, sx, sy, sz), color);
    },
    cyl(cx, cy, cz, r, h, color, rx, ry, rz, seg) {
      const g = seg === 4 ? venG.cyl4 : seg === 8 ? venG.cyl8
              : seg === 16 ? venG.cyl16 : venG.cyl6;
      return M.add(g, venXform(cx, cy, cz, rx || 0, ry || 0, rz || 0, r * 2, h, r * 2), color);
    },
    cone(cx, cy, cz, r, h, color, rx, ry, rz, seg) {
      const g = seg === 4 ? venG.cone4 : venG.cone6;
      return M.add(g, venXform(cx, cy, cz, rx || 0, ry || 0, rz || 0, r * 2, h, r * 2), color);
    },
    sph(cx, cy, cz, rx2, ry2, rz2, color) {
      return M.add(venG.sph6, venXform(cx, cy, cz, 0, 0, 0, rx2 * 2, ry2 * 2, rz2 * 2), color);
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
// ---------------------------------------------------------------------------
// THE WATERLINE IS DRAWN ON THE CITY, NOT JUST ON THE WATER.
//
// The chapter's own toast says the square goes under "two centimetres at a
// time", and until now that was a claim the picture did not support: the sea
// is one flat sheet that rises, so at any instant the frame contains a plane
// of green and a plane of stone and NOTHING that says one is arriving. Every
// photograph of an acqua alta is really a photograph of the same square with a
// dark wet band creeping up it and a bright line at the top of the band.
//
// Which is nine lines of shader on the two materials this chapter is made of,
// with the live tide as a uniform. Wet stone is DARKER (it is; the water fills
// the pores and stops them scattering) and the meniscus at the edge is
// BRIGHTER, because at a shallow angle the last centimetre of water is a
// mirror. It costs one float write per frame and it runs on the ground, the
// arcades, the campanile and the basilica at once — so the flood arrives
// everywhere in the frame instead of only underfoot.
// ---------------------------------------------------------------------------
const venWaterUni = { value: venTIDE_LOW };
// ---------------------------------------------------------------------------
// THE WATER HAS TO MOVE, AND GEOMETRY CANNOT AFFORD TO DO IT.
//
// A Lambert surface only changes value when its NORMAL changes, and to get a
// visible normal change out of a swell you need a slope of a few degrees —
// which over the four-metre cells this sheet can afford is fifteen centimetres
// of vertical displacement across Piazza San Marco. That is not a tide any
// more, it is a sea, and it would put the duckboards under.
//
// So the swell in the mesh stays small (it is there for the silhouette at the
// swimming camera, where you look ALONG the surface and a centimetre reads)
// and the light on it is done where light belongs: two long crossing waves and
// one short diagonal, multiplying the diffuse term by a few per cent, moving
// on their own clock. It is the same trick as grain() and it costs the same
// nothing — and unlike a normal it works at every angle, including straight
// down, which is where half the chapter's cameras are.
// ---------------------------------------------------------------------------
const venWaveUni = { value: 0 };
function venWaves(g) {
  const prevHook = g.onBeforeCompile;
  const prevKey = g.customProgramCacheKey;
  g.onBeforeCompile = function (shader) {
    if (prevHook) prevHook.call(this, shader);
    shader.uniforms.uVenWave = venWaveUni;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vVenV;')
      .replace('#include <begin_vertex>',
               '#include <begin_vertex>\nvVenV = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>',
               '#include <common>\nvarying vec3 vVenV;\nuniform float uVenWave;')
      .replace('#include <emissivemap_fragment>', [
        '#include <emissivemap_fragment>',
        '{',
        '  float w = sin(vVenV.x * 0.27 + uVenWave * 0.85)',
        '          + sin(vVenV.z * 0.34 - uVenWave * 0.66) * 0.9',
        '          + sin((vVenV.x - vVenV.z) * 0.62 + uVenWave * 1.55) * 0.45;',
        '  diffuseColor.rgb *= 1.0 + w * 0.062;',
        '}',
      ].join('\n'));
  };
  g.customProgramCacheKey = function () {
    return 'venwave|' + (prevKey ? prevKey.call(this) : g.uuid);
  };
  g.needsUpdate = true;
  return g;
}
function venWet(g) {
  const prevHook = g.onBeforeCompile;
  const prevKey = g.customProgramCacheKey;
  g.onBeforeCompile = function (shader) {
    if (prevHook) prevHook.call(this, shader);
    shader.uniforms.uVenWaterY = venWaterUni;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vVenW;')
      .replace('#include <begin_vertex>',
               '#include <begin_vertex>\nvVenW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    // ANCHORED ON emissivemap_fragment, NOT color_fragment: grain() has already
    // taken that one, and two hooks fighting over the same include is how you
    // get a material that silently loses half of itself.
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>',
               '#include <common>\nvarying vec3 vVenW;\nuniform float uVenWaterY;')
      .replace('#include <emissivemap_fragment>', [
        '#include <emissivemap_fragment>',
        '{',
        '  float vd = uVenWaterY - vVenW.y;',
        '  float wetB = smoothstep(-0.40, 0.03, vd);',
        '  diffuseColor.rgb *= mix(1.0, 0.72, wetB);',
        '  float rim = smoothstep(0.11, 0.0, abs(vd - 0.02));',
        '  diffuseColor.rgb += rim * vec3(0.15, 0.16, 0.14);',
        '}',
      ].join('\n'));
  };
  g.customProgramCacheKey = function () {
    return 'venwet|' + (prevKey ? prevKey.call(this) : g.uuid);
  };
  g.needsUpdate = true;
  return g;
}
// ONE INSTANCE EACH, and they are private (grainOwn, not grain): these carry a
// uniform and a hook, and mat()/grain() both hand back cached objects that some
// other chapter may already be drawing with.
let venWallMat = null, venGroundMat = null;
function venVC() {
  if (!venWallMat) venWallMat = venWet(grainOwn(mat(0xffffff, { vertexColors: true }),
    { scale: 0.45, amount: 0.09, warp: 0.55 }));
  return venWallMat;
}
/** The same thing at ground strength, and flat: the ground is horizontal,
 *  so it wants no vertical shear in the sample at all. */
function venVCG() {
  if (!venGroundMat) venGroundMat = venWet(grainOwn(mat(0xffffff, { vertexColors: true }),
    { scale: 0.72, amount: 0.14, warp: 0 }));
  return venGroundMat;
}
function venPush9(l, px, py, pz, rx, ry, rz, sx, sy, sz) { l.push(px, py, pz, rx, ry, rz, sx, sy, sz); }
function venInstance(root, geo, color, list, cast, recv) {
  const n = list.length / 9;
  if (n < 1) return null;
  const im = new THREE.InstancedMesh(geo, mat(color), n);
  for (let i = 0; i < n; i++) {
    const o = i * 9;
    im.setMatrixAt(i, venXform(list[o], list[o + 1], list[o + 2], list[o + 3], list[o + 4],
                               list[o + 5], list[o + 6], list[o + 7], list[o + 8]));
  }
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  im.castShadow = !!cast;
  im.receiveShadow = !!recv;
  root.add(im);
  return im;
}
function venSyncBody(b) {
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
  b.previousQuaternion.copy(b.quaternion);
  b.interpolatedQuaternion.copy(b.quaternion);
}
/**
 * A static box. `ry` yaws it; `rz` then TILTS it about its own across-axis,
 * which is what an arched bridge deck needs.
 *
 * Without the tilt, a curved deck built out of flat slabs is a STAIRCASE: the
 * Rialto's arch rises 4.1 m over 16 and was cut into thirteen pieces, so each
 * flat slab sat 60 cm above the last one and the "run" across it was thirteen
 * consecutive knee-high walls. Measured, a run at the bridge stalled at the
 * fourth riser every time. The Euler order matches the merger's 'YXZ', so the
 * drawn slab and the solid one are tilted by the same rotation.
 */
function venStaticBox(game, x, y, z, sx, sy, sz, ry, rz) {
  const b = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
  b.addShape(new CANNON.Box(new CANNON.Vec3(sx * 0.5, sy * 0.5, sz * 0.5)));
  b.position.set(x, y, z);
  if (ry || rz) {
    // Built through THREE's Euler with the merger's own 'YXZ' order and copied
    // across, rather than through CANNON's setFromEuler, so the solid slab and
    // the drawn one are the same rotation by construction rather than by two
    // people agreeing about composition order.
    venEu.set(0, ry || 0, rz || 0, 'YXZ');
    venQ.setFromEuler(venEu);
    b.quaternion.set(venQ.x, venQ.y, venQ.z, venQ.w);
  }
  venSyncBody(b);
  game.world.addBody(b);
  return b;
}

// ============================================================= CENTRELINES ==
/**
 * Resample a knot list at a fixed spacing, smooth it with [1,2,1] passes, and
 * accumulate arclength. Both the Grand Canal and the duckboard route are built
 * from this, and every question either of them can be asked is answered off the
 * table rather than recomputed, so the drawn thing, the solid thing and the
 * moving thing cannot drift apart.
 */
function venResample(knots, spacing, smoothPasses, out) {
  const px = [], pz = [];
  for (let i = 0; i + 3 < knots.length; i += 2) {
    const ax = knots[i], az = knots[i + 1], bx = knots[i + 2], bz = knots[i + 3];
    const d = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(d / spacing));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      px.push(lerp(ax, bx, t)); pz.push(lerp(az, bz, t));
    }
  }
  px.push(knots[knots.length - 2]); pz.push(knots[knots.length - 1]);
  for (let pass = 0; pass < smoothPasses; pass++) {
    const qx = px.slice(), qz = pz.slice();
    for (let i = 1; i < px.length - 1; i++) {
      px[i] = (qx[i - 1] + qx[i] * 2 + qx[i + 1]) * 0.25;
      pz[i] = (qz[i - 1] + qz[i] * 2 + qz[i + 1]) * 0.25;
    }
  }
  const s = new Float32Array(px.length);
  let acc = 0;
  for (let i = 1; i < px.length; i++) {
    acc += Math.hypot(px[i] - px[i - 1], pz[i] - pz[i - 1]);
    s[i] = acc;
  }
  out.x = Float32Array.from(px);
  out.z = Float32Array.from(pz);
  out.s = s;
  out.len = acc;
  return out;
}

/** Point on a centreline at t in 0..1, into `o`. Also fills o.yaw. */
function venLinePoint(X, Z, S, len, t, o) {
  const want = clamp(t, 0, 1) * len;
  let lo = 0, hi = S.length - 1;
  while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (S[mid] <= want) lo = mid; else hi = mid; }
  const span = S[hi] - S[lo];
  const f = span > 1e-5 ? (want - S[lo]) / span : 0;
  o.x = lerp(X[lo], X[hi], f);
  o.z = lerp(Z[lo], Z[hi], f);
  o.yaw = Math.atan2(X[hi] - X[lo], Z[hi] - Z[lo]);
  return o;
}
const venLineOut = { x: 0, z: 0, yaw: 0 };
const venRialtoOut = { x: 0, y: 0, z: 0, ax: 0, az: 0 };

/**
 * Shortest distance from (x, z) to a centreline, and the arclength fraction of
 * the nearest point. Walks the whole table — both tables are a couple of hundred
 * samples and this is called from terrain generation and once a frame, never in
 * an inner loop.
 */
const venNearOut = { d: 1e9, t: 0, side: 0 };
function venNearLine(X, Z, S, len, x, z) {
  let bd = 1e9, bs = 0, bside = 0;
  for (let i = 0; i + 1 < X.length; i++) {
    const ax = X[i], az = Z[i], bx = X[i + 1], bz = Z[i + 1];
    const ex = bx - ax, ez = bz - az;
    const l2 = ex * ex + ez * ez;
    let t = l2 > 1e-9 ? ((x - ax) * ex + (z - az) * ez) / l2 : 0;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    const cx = ax + ex * t, cz = az + ez * t;
    const dx = x - cx, dz = z - cz;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < bd) {
      bd = d;
      bs = (S[i] + (S[i + 1] - S[i]) * t) / (len || 1);
      bside = dx * ez - dz * ex;
    }
  }
  venNearOut.d = bd; venNearOut.t = bs; venNearOut.side = bside;
  return venNearOut;
}

function venBuildLines() {
  const c = venResample(venCANAL_KNOTS, 3, 2, {});
  venCanX = c.x; venCanZ = c.z; venCanS = c.s; venCanLen = c.len;
  const b = venResample(venBOARD_KNOTS, 7, 2, {});
  venBrdX = b.x; venBrdZ = b.z; venBrdS = b.s; venBrdLen = b.len;
}

// ================================================================= TERRAIN ==
/** Smooth 0..1 ramp — every blend below uses this so no edge is a cliff. */
function venSm(a, b, x) {
  if (a === b) return x >= b ? 1 : 0;
  let t = (x - a) / (b - a);
  if (t < 0) t = 0; else if (t > 1) t = 1;
  return t * t * (3 - 2 * t);
}
/** 1 inside the rect, falling off over `f` metres outside it. */
function venRect(x, z, x0, z0, x1, z1, f) {
  const ix = Math.min(venSm(x0 - f, x0, x), venSm(x1 + f, x1, x));
  const iz = Math.min(venSm(z0 - f, z0, z), venSm(z1 + f, z1, z));
  return Math.min(ix, iz);
}

/**
 * THE GROUND, the honest way. Read in this order and the order matters — the
 * canal is cut LAST, after every shelf, because a shelf blend laid over a
 * channel erases it. That exact mistake ate the Uji.
 *
 * It is not what anybody calls: venTerrain() below is a lookup into a grid baked
 * from this at build time. The reason is venNearLine(), which walks a couple of
 * hundred canal samples — fine once per vertex at build, ruinous at a hundred
 * and eighty pigeons times two lookups times sixty frames.
 */
function venTerrainSlow(x, z) {
  // the lagoon, which is simply the bottom of everything
  if (z > venLAGOON_Z + 6) return venLAGOON_Y;

  let y = venCITY_Y;

  // the two squares are the low ground, and they are low ON PURPOSE: San Marco
  // is the first thing in Venice to go under and the last to come back
  const pz = venRect(x, z, venPZ_X0, venPZ_Z0, venPZ_X1, venPZ_Z1, 3.5);
  const pt = venRect(x, z, venPT_X0, venPT_Z0, venPT_X1, venPT_Z1, 3.5);
  const sq = Math.max(pz, pt);
  y = lerp(y, 0, sq);

  // the Molo, and then the lagoon beyond it
  const molo = venRect(x, z, -40, venMOLO_Z0, 34, venMOLO_Z1 + 1, 3);
  y = lerp(y, venMOLO_Y, molo);
  const lag = venSm(venLAGOON_Z, venLAGOON_Z + 6, z);
  y = lerp(y, venLAGOON_Y, lag);

  // the banks of the Grand Canal stand a little proud of the city
  if (venCanX) {
    const n = venNearLine(venCanX, venCanZ, venCanS, venCanLen, x, z);
    const bank = venSm(venCANAL_W * 0.5 + 12, venCANAL_W * 0.5 + 1.5, n.d);
    y = lerp(y, venFOND_Y, bank * 0.9);
    // ...and then THE CHANNEL, cut last so nothing can fill it in again
    const cut = venSm(venCANAL_W * 0.5 + 2.6, venCANAL_W * 0.5 - 1.2, n.d);
    y = lerp(y, venCANAL_BED, cut);
  }

  // the rio through the calli, same rule, same order
  if (z > venCAL_Z0 - 4 && z < venCAL_Z1 + 4) {
    const d = Math.abs(x - venRIO_X);
    const cut = venSm(venRIO_W * 0.5 + 2.2, venRIO_W * 0.5 - 1.0, d);
    y = lerp(y, -3.1, cut);
  }

  return y;
}

// ---- the baked grid --------------------------------------------------------
// One Float32Array over the whole city, bilinear in between. The drawn ground,
// the collision heightfield, the pigeons, the tide test and capybara.js's own
// floor backstop all read THIS, so none of them can disagree with any other —
// which is worth more here than anywhere else in the game, because "is there
// water over this stone" is a comparison against exactly this number.
const venGRID_X0 = -206, venGRID_Z0 = -106, venGRID_EL = 1.25;
const venGRID_NX = 232, venGRID_NZ = 194;
let venGrid = null;
function venBakeTerrain() {
  if (venGrid) return;
  venGrid = new Float32Array((venGRID_NX + 1) * (venGRID_NZ + 1));
  for (let i = 0; i <= venGRID_NX; i++) {
    for (let j = 0; j <= venGRID_NZ; j++) {
      venGrid[i * (venGRID_NZ + 1) + j] =
        venTerrainSlow(venGRID_X0 + i * venGRID_EL, venGRID_Z0 + j * venGRID_EL);
    }
  }
}
function venTerrain(x, z) {
  if (!venGrid) return venTerrainSlow(x, z);
  const fx = (x - venGRID_X0) / venGRID_EL, fz = (z - venGRID_Z0) / venGRID_EL;
  if (fx < 0 || fz < 0 || fx >= venGRID_NX || fz >= venGRID_NZ) return venTerrainSlow(x, z);
  const i = fx | 0, j = fz | 0;
  const tx = fx - i, tz = fz - j;
  const S = venGRID_NZ + 1;
  const a = venGrid[i * S + j], b = venGrid[(i + 1) * S + j];
  const c = venGrid[i * S + j + 1], d = venGrid[(i + 1) * S + j + 1];
  return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
}

function venSlope(x, z) {
  const e = 1.4;
  const dx = venTerrain(x + e, z) - venTerrain(x - e, z);
  const dz = venTerrain(x, z + e) - venTerrain(x, z - e);
  return Math.atan(Math.hypot(dx, dz) / (2 * e));
}

// =================================================================== WATER ==
/**
 * THE TIDE. One phase, 0..1, and everything about the water reads off it.
 * Explicitly a CYCLE: the whole point of the mechanic is that the city keeps
 * changing under you, and a one-shot flood would be a cutscene with a task
 * attached.
 */
function venTideY(ph) {
  if (ph < venTIDE_RISE0) return venTIDE_LOW;
  if (ph < venTIDE_RISE1) {
    const t = (ph - venTIDE_RISE0) / (venTIDE_RISE1 - venTIDE_RISE0);
    return lerp(venTIDE_LOW, venTIDE_HIGH, t * t * (3 - 2 * t));
  }
  if (ph < venTIDE_FALL0) return venTIDE_HIGH;
  if (ph < venTIDE_FALL1) {
    const t = (ph - venTIDE_FALL0) / (venTIDE_FALL1 - venTIDE_FALL0);
    return lerp(venTIDE_HIGH, venTIDE_LOW, t * t * (3 - 2 * t));
  }
  return venTIDE_LOW;
}

/**
 * IS THERE WATER OVER THE PAVING HERE.
 *
 * This one function IS the chapter. Everywhere else in this game the answer is a
 * rectangle or a distance; here it is a comparison between the tide and the
 * ground, so a place can be dry at one o'clock and a lagoon at two without
 * anything else in the codebase knowing that is unusual.
 *
 * The 0.22 m of slack is what keeps a wet pavement from being a swimming pool:
 * capybara.js turns off its analytic floor backstop wherever this is true, and
 * two centimetres of water over the stones should be a puddle to walk through,
 * not a hole to fall into.
 */
function venIsOverWater(x, z) {
  return venWaterY > venTerrain(x, z) + 0.22;
}
function venWaterHeightAt() { return venWaterY; }

/** 0..1 — how far up the tide is, for anything that wants to react to it. */
function venTideLevel() {
  return clamp((venWaterY - venTIDE_LOW) / (venTIDE_HIGH - venTIDE_LOW), 0, 1);
}

// ================================================================== ZONES ===
function venInZone(name, x, z) {
  if (name === 'piazza') return x > venPZ_X0 && x < venPZ_X1 && z > venPZ_Z0 && z < venPZ_Z1;
  if (name === 'piazzetta') return x > venPT_X0 && x < venPT_X1 && z > venPT_Z0 && z < venPT_Z1;
  if (name === 'square') return venInZone('piazza', x, z) || venInZone('piazzetta', x, z);
  if (name === 'molo') return z > venMOLO_Z0 - 1 && z < venMOLO_Z1 + 1 && x > -30 && x < 24;
  if (name === 'lagoon') return z > venLAGOON_Z;
  if (name === 'calli') return x > venCAL_X0 && x < venCAL_X1 && z > venCAL_Z0 && z < venCAL_Z1;
  if (name === 'canal') {
    if (!venCanX) return false;
    return venNearLine(venCanX, venCanZ, venCanS, venCanLen, x, z).d < venCANAL_W * 0.5 + 1;
  }
  if (name === 'rialto') {
    if (!venCanX) return false;
    venLinePoint(venCanX, venCanZ, venCanS, venCanLen, venRIALTO_S, venLineOut);
    const dx = x - venLineOut.x, dz = z - venLineOut.z;
    return dx * dx + dz * dz < 24 * 24;
  }
  if (name === 'campo') {
    const dx = x - venCAMPO.x, dz = z - venCAMPO.z;
    return dx * dx + dz * dz < 9 * 9;
  }
  if (name === 'cafe') {
    const dx = x - venCAFE.x, dz = z - venCAFE.z;
    return dx * dx + dz * dz < 5 * 5;
  }
  return false;
}

/** Static obstacles, for anything that wants to steer. Coarse on purpose. */
function venNavBlocked(x, z, r) {
  const rr = r || 0.6;
  // the campanile
  const dx = x - venCAMPANILE.x, dz = z - venCAMPANILE.z;
  if (Math.abs(dx) < venCAMPANILE.w * 0.5 + rr && Math.abs(dz) < venCAMPANILE.w * 0.5 + rr) return true;
  // the basilica, the Torre, and the palace
  if (x > venPZ_X1 - rr && z < -16 && z > -54) return true;
  if (x > venPZ_X1 - rr && z < venORO_Z1 && z > venORO.z - venORO.w * 0.5 - rr) return true;
  if (x > 6 - rr && z > -13.6 - rr && z < 12) return true;
  // the Loggetta, which stands two and a half metres out into the Piazzetta
  if (x > 5.0 - rr && x < 9.0 + rr && z > -22.4 - rr && z < -11.6 + rr) return true;
  return false;
}

/** Footfall voice: stone almost everywhere, timber on the boards, and a splash
 *  of a step wherever the tide is actually over the paving. */
function venSurfacePitch(x, z, y) {
  if (venBoardOut > 0.5 && venOnBoards) return 1.26;
  // `y` WAS DECLARED AND NEVER READ, so anything BUILT over water sounded like
  // the water. The Rialto's deck is four metres up — measured, y 5.55 — and it
  // footfalled at 1.12, the wet-canal pitch, in the chapter whose own task is
  // "Take the Rialto at a run". The gondola prow and the traghetto deck the
  // same. Sydney's ladder has used a height test for the podium since it was
  // written; this is that test.
  const over = venIsOverWater(x, z);
  if (over && y < venWaterHeightAt(x, z) + 0.5) return 1.12;
  // ---- AND THE WHOLE DRY CITY WAS ONE FOOTSTEP ---------------------------
  // Measured across the molo, the calli, a campo, the fondamenta, the café and
  // the arcades: every one of them 0.98, with the square at 1.02. Four per cent
  // across a chapter, against Sydney's 0.82..1.22 — and the 1.26 duckboard
  // branch above is gated on the capy's own latch, so nothing else could ever
  // reach it. The zones have existed the whole time.
  if (venInZone('square', x, z)) return 1.06;    // trachyte, laid in bands
  if (venInZone('calli', x, z)) return 1.16;     // hard, narrow, and it echoes
  if (venInZone('campo', x, z)) return 1.02;
  if (venInZone('molo', x, z)) return 0.94;      // worn Istrian, close to water
  if (venInZone('cafe', x, z)) return 0.78;      // boards and matting
  return 0.98;
}

// ============================================================== THE SQUARES =
function venBuildSquares(game, root) {
  const M = venMerger();

  // ---- the paving ---------------------------------------------------------
  // The trachyte of the piazza is laid in bands with white Istrian ribs across
  // it, and the ribs are the ONLY thing that gives a sixty-metre rectangle any
  // scale at all from a camera nine metres up.
  // Long ribs down the length and short ones across it. The ribs are the ONLY
  // thing that gives sixty metres of one grey rectangle any scale at all from a
  // camera nine metres up, and the long ones point at the basilica, which is
  // where the square wants the eye to go.
  for (let i = 0; i < 6; i++) {
    const x = venPZ_X0 + 2 + i * ((venPZ_X1 - venPZ_X0 - 4) / 5);
    M.box(x, 0.03, (venPZ_Z0 + venPT_Z1) * 0.5, 0.7, 0.06, venPT_Z1 - venPZ_Z0 - 2, PALETTE.venStone);
  }
  for (let i = 0; i < 14; i++) {
    const z = venPZ_Z0 + 3 + i * ((venPT_Z1 - venPZ_Z0 - 6) / 13);
    M.box((venPZ_X0 + venPZ_X1) * 0.5, 0.03, z, venPZ_X1 - venPZ_X0 - 3, 0.06, 0.6, PALETTE.venStone);
  }

  // ---- the arcades ---------------------------------------------------------
  // Procuratie: three storeys over a colonnade, both long sides of the piazza,
  // and the Ala Napoleonica closing the west end. Built as a helper because the
  // library on the Piazzetta is the same thing turned ninety degrees.
  // IT USED TO BE A WALL, AND THAT WAS TWO SEPARATE MISTAKES.
  //
  // The piers, their capitals and the loggia's "back wall" were all drawn
  // INSIDE a solid block running from y = 1 to y = 9.4 across the whole nine
  // metres of thickness — so the most recognisable thing about this square,
  // fifty metres of arches down each side, was a blank cream cliff with a
  // colonnade buried in it, and the café was a table against a wall.
  //
  // And the window bands took the LONG dimension where they wanted the short
  // one: `ow = d * 0.86` used as the X size of a wall whose X size is nine.
  // That hung a thirty-metre concrete girder over the piazza at four metres and
  // another at seven, once per bay per side. They are the grey beams lying
  // across every picture of this chapter taken before 21 Aug 2026, and they
  // were the first thing in frame at the top of the tide.
  //
  // Now: piers on the façade line, arched heads with a stepped spandrel behind
  // them, a dark soffit, and the mass starting ABOVE the loggia — which the
  // collider follows, so the arcade is somewhere to walk and not something to
  // walk round. See the collision block at the end of this function.
  const venARC_SOF = 5.2;       // loggia ceiling, over the pier datum
  const venARC_TOP = 10.6;      // and the top of the wall, same datum
  const venArcPiers = [];       // x, z, halfX, halfZ per pier — for one body each
  const venArcMass = [];        // x, y, z, sx, sy, sz for the back of the block
  function arcade(x0, z0, x1, z1, along, wall1, openMax) {
    const len = along ? x1 - x0 : z1 - z0;
    const nb = Math.max(2, Math.round(len / 4.3));
    const cx = (x0 + x1) * 0.5, cz = (z0 + z1) * 0.5;
    const w = x1 - x0, d = z1 - z0;
    const thick = along ? d : w;
    const LOG = Math.min(3.6, thick * 0.42);       // how deep the loggia is
    const s = openMax ? 1 : -1;                    // which way it opens
    const ox = along ? 0 : s, oz = along ? s : 0;
    const fX = cx + ox * (w * 0.5), fZ = cz + oz * (d * 0.5);   // the façade plane
    // a point `u` along the run (0..1) and `v` metres BACK from the façade
    const PX = (u, v) => (along ? lerp(x0, x1, u) : fX - ox * v);
    const PZ = (u, v) => (along ? fZ - oz * v : lerp(z0, z1, u));
    // a box whose extent ALONG the run is L and THROUGH the wall is T
    const bx = (u, y, v, L, H, T, col, rx, ry, rz) =>
      M.box(PX(u, v), y, PZ(u, v), along ? L : T, H, along ? T : L, col, rx, ry, rz);
    // ONE DATUM FOR THE WHOLE ARCADE. The square ramps up a metre and a third
    // over the three metres between the paving and the back of the loggia, so a
    // plinth authored at y = 0 is buried; sampled on the PIER LINE it is the
    // same 8 cm at all four of these, and everything above hangs off it.
    const gy = venTerrain(PX(0.5, 0.6), PZ(0.5, 0.6));
    const SOF = gy + venARC_SOF, TOP = gy + venARC_TOP;

    // the mass over the loggia, and the back of the building under it
    bx(0.5, (SOF + TOP) * 0.5, thick * 0.5, len, TOP - SOF, thick, wall1);
    bx(0.5, TOP * 0.5 - 2, LOG + (thick - LOG) * 0.5, len, TOP + 4, thick - LOG, wall1);
    // ---- THE COLLIDER COMES FORWARD WITH THE SHOPFRONT --------------------
    // The back of the loggia now carries a door, a frame, a board and a lit
    // window, and the deepest of them stands 36 cm proud of the wall plane at
    // v = LOG — so with a collider that stopped AT the wall the animal stood
    // inside the shop it was walking past. That is precisely the bug Mong
    // Kok's tong lau had in August ('the shopfront band is 70 cm proud of the
    // wall and the collider started at the wall'), and qa/wq-solid.js found it
    // by clustering five hits at x 11 down the east Procuratie.
    const CFRONT = 0.36;
    venArcMass.push(PX(0.5, LOG - CFRONT + (thick - LOG + CFRONT) * 0.5), TOP * 0.5 - 2,
                    PZ(0.5, LOG - CFRONT + (thick - LOG + CFRONT) * 0.5),
                    along ? len : thick - LOG + CFRONT, TOP + 4,
                    along ? thick - LOG + CFRONT : len);
    // the cornice, and a string course between the two window floors
    bx(0.5, TOP + 0.3, thick * 0.5, len + 0.5, 0.55, thick + 0.5, PALETTE.venStone);
    bx(0.5, gy + 7.9, thick * 0.5 - 0.07, len, 0.3, thick + 0.14, PALETTE.venStone);
    // the loggia's ceiling, dark, which is what makes it read as a hole
    bx(0.5, SOF - 0.19, LOG * 0.5, len, 0.38, LOG, PALETTE.venStoneDark);

    // ---- the colonnade -----------------------------------------------------
    const bay = len / nb;
    const R = Math.min((bay - 0.95) * 0.5, 1.5);   // the arch's radius
    const PIER = bay - R * 2;
    const uOf = (t) => (PIER * 0.5 + (len - PIER) * t) / len;
    for (let i = 0; i <= nb; i++) {
      const u = uOf(i / nb);
      bx(u, gy + 0.1, 0.5, PIER + 0.34, 1.2, 1.16, PALETTE.venStone);       // plinth
      bx(u, gy + 2.05, 0.5, PIER, 2.5, 0.96, PALETTE.venStone);             // shaft
      bx(u, gy + 3.42, 0.5, PIER + 0.3, 0.34, 1.12, PALETTE.venStone);      // capital
      venArcPiers.push(PX(u, 0.5), PZ(u, 0.5),
                       (along ? PIER + 0.34 : 1.16) * 0.5, (along ? 1.16 : PIER + 0.34) * 0.5);
    }
    // arched heads: a ring of voussoirs on the façade, and the spandrel stepped
    // in behind them, so the opening is an arch and not a slot with a hoop
    const spring = gy + 3.6;
    for (let i = 0; i < nb; i++) {
      const uc = uOf((i + 0.5) / nb);
      // ---- A COVERED SPACE HAS TO CARRY ITS OWN LIGHT --------------------
      // The loggia was cut open on 21 Aug 2026 and it became fifty metres of
      // FLAT GREY: a Lambert surface under a solid soffit gets the hemisphere
      // and nothing else, so the most photographed colonnade in Europe was an
      // unlit tunnel with a café in it. Nothing in this game casts light, so
      // the answer is the same one Mong Kok's market lane and the Drift's
      // lamp-post use — put the lamp in, and PAINT what it does on the floor.
      // One per bay, on the centre line of the loggia, and the pool under it.
      venLOG_LAMPS.push(PX(uc, LOG * 0.52), SOF - 0.62, PZ(uc, LOG * 0.52));
      // AND THE POOL GOES ON THE FLOOR THAT IS ACTUALLY THERE. `gy` is the
      // arcade's single datum, sampled on the PIER LINE 60 cm back — but the
      // square ramps up a metre and a third over the three metres between the
      // paving and the back of the loggia, so two metres in the floor is
      // fifteen to thirty centimetres higher than the datum and a pool laid at
      // gy is UNDER it. Measured: eight thousand triangles of light, visible
      // true, opacity 0.3, and nothing whatsoever in the picture.
      venLOG_POOLS.push(PX(uc, LOG * 0.52),
                        venTerrain(PX(uc, LOG * 0.52), PZ(uc, LOG * 0.52)) + 0.04,
                        PZ(uc, LOG * 0.52), LOG * 0.92);
      const rr = R + 0.3;
      const tw = Math.PI * rr / 7 + 0.08;
      for (let k = 0; k < 7; k++) {
        const a = (k + 0.5) / 7 * Math.PI;
        // the voussoir's local +y is radial and its run axis is tangential, so
        // it turns about the one axis the arch's plane does not contain
        bx(uc + Math.cos(a) * rr / len, spring + Math.sin(a) * rr, 0.5, tw, 0.52, 1.02,
           PALETTE.venStone, along ? 0 : Math.PI * 0.5 - a, 0, along ? a - Math.PI * 0.5 : 0);
      }
      // ---- AND THE BACK OF THE LOGGIA IS A SHOPFRONT ----------------------
      // The colonnade was cut open on 21 Aug 2026 and became somewhere to be;
      // what it became a place of is fifty metres of blank plaster three
      // metres behind the piers, lit by a lamp, with nothing on it. Every bay
      // of the Procuratie has a shop in the back of it and has had since the
      // sixteenth century — a stone-framed door with a dark inside, a window
      // beside it with something gold in it, and a small board over the top.
      // It is the difference between an arcade and a corridor, and it is the
      // one surface in this chapter the player can stand a metre from.
      {
        const vb = LOG - 0.16;                     // the back wall of the bay
        const dy2 = gy + 1.35;
        bx(uc, dy2, vb, 1.5, 2.7, 0.22, PALETTE.venStoneDark);          // the dark of a shop
        bx(uc, dy2 - 0.25, vb - 0.1, 1.15, 2.2, 0.12,
           i % 3 === 0 ? PALETTE.venShutter2 : PALETTE.venGondolaTr);   // a door, half open
        for (let s2 = -1; s2 <= 1; s2 += 2) {
          bx(uc + s2 * 0.86 / len, dy2, vb - 0.14, 0.24, 2.9, 0.28, PALETTE.venStone);
        }
        bx(uc, dy2 + 1.5, vb - 0.14, 2.0, 0.26, 0.3, PALETTE.venStone);
        // the board over the door, and every third one is gold because a
        // window with gold in it is the only thing worth looking into
        bx(uc, dy2 + 1.95, vb - 0.2, 1.7, 0.5, 0.16,
           i % 3 === 0 ? PALETTE.venGold : PALETTE.venMosaic);
        if (i % 2) {
          bx(uc + 1.5 / len, dy2 + 0.25, vb - 0.06, 1.0, 1.5, 0.14, PALETTE.venMosaic);
          bx(uc + 1.5 / len, dy2 + 1.1, vb - 0.16, 1.24, 0.24, 0.22, PALETTE.venStone);
          // A LIT WINDOW IS A LIGHT. The pane inside the frame was venGoldPale
          // on the merged Lambert, three metres inside a colonnade with a solid
          // soffit over it — which is the fifth time this chapter has drawn a
          // light as a surface and got a grey rectangle. It goes on its own
          // unlit material, and a row of them down fifty metres of arcade is
          // the whole reason a loggia at four in the afternoon is somewhere
          // you want to walk.
          venSHOP_LIT.push(PX(uc + 1.5 / len, vb - 0.16), dy2 + 0.25,
                           PZ(uc + 1.5 / len, vb - 0.16),
                           along ? 0.72 : 0.1, 1.1, along ? 0.1 : 0.72);
        }
      }
      const band = SOF - spring;
      for (let k = 0; k < 4; k++) {
        const h = band / 4;
        const y = spring + (k + 0.5) * h;
        const dy = y - spring;
        const hw = dy >= R ? 0 : Math.sqrt(R * R - dy * dy);
        const half = (R + 0.35 - hw) * 0.5;
        if (half < 0.06) continue;
        for (let sgn = -1; sgn <= 1; sgn += 2) {
          bx(uc + sgn * (hw + half) / len, y, 0.55, half * 2, h + 0.02, 0.9, wall1);
        }
      }
    }

    // ---- THE ROOFLINE, which was a cornice and then sky --------------------
    // Both Procuratie are ten and a half metres of wall with one moulding on
    // top of them, and against a pale sky that is a rectangle. The real ones
    // carry a statue over every second bay and a row of Venetian chimneys
    // behind — and the CHIMNEY is the thing worth spending eight boxes on,
    // because the inverted-cone camino with a cap on it is unique to this
    // lagoon (they burned wood indoors in wooden buildings and needed the
    // sparks caught) and it is on the skyline of every painting of the place.
    const nst = Math.max(2, Math.round(nb / 2));
    for (let i = 0; i <= nst; i++) {
      const u = uOf(i / nst);
      bx(u, TOP + 1.35, thick * 0.55, 1.0, 1.4, 1.0, PALETTE.venStone);        // plinth
      bx(u, TOP + 2.6, thick * 0.55, 0.46, 1.3, 0.4, PALETTE.venStone);        // the figure
      bx(u, TOP + 3.05, thick * 0.55, 0.9, 0.34, 0.34, PALETTE.venStone, 0, 0, 0.3);
      M.add(venG.sph6, venXform(PX(u, thick * 0.55), TOP + 3.5, PZ(u, thick * 0.55),
                                0, 0, 0, 0.4, 0.46, 0.4), PALETTE.venStone);
    }
    for (let i = 0; i < nst; i++) {
      const u = uOf((i + 0.5) / nst);
      const cy2 = TOP + 1.1;
      bx(u, cy2, thick * 0.82, 0.8, 3.2, 0.8, PALETTE.venPlaster2);            // the stack
      // the flared bell, three courses of it, then the cap on its two piers
      for (let k = 0; k < 3; k++) {
        bx(u, cy2 + 1.9 + k * 0.42, thick * 0.82, 0.9 + k * 0.42, 0.44, 0.9 + k * 0.42,
           PALETTE.venPlaster2);
      }
      for (let s2 = -1; s2 <= 1; s2 += 2) {
        bx(u + s2 * 0.66 / len, cy2 + 3.5, thick * 0.82, 0.22, 0.75, 0.3, PALETTE.venPlaster2);
      }
      bx(u, cy2 + 4.0, thick * 0.82, 2.0, 0.34, 1.5, PALETTE.venRoofDark);
    }

    // ---- the windows above, which are HOLES and not shelves ----------------
    for (let i = 0; i < nb; i++) {
      const u = uOf((i + 0.5) / nb);
      for (let f = 0; f < 2; f++) {
        // A SURROUND IS A FRAME, NOT A SLAB. The first cut drew a solid stone
        // box 44 cm deep and put the dark pane 36 cm inside it, i.e. entirely
        // within it — so every window on both Procuratie was a blank white
        // tablet and the upper floors read as pilasters.
        const y = gy + 6.3 + f * 2.7;
        bx(u, y, 0.34, 1.24, 1.8, 0.3, PALETTE.venMosaic);                // the dark of a room
        for (let s2 = -1; s2 <= 1; s2 += 2) {
          bx(u + s2 * 0.78 / len, y, 0.16, 0.3, 2.0, 0.4, PALETTE.venStone);   // the two jambs
        }
        bx(u, y + 1.06, 0.16, 1.86, 0.3, 0.4, PALETTE.venStone);          // head
        bx(u, y - 1.02, 0.06, 1.96, 0.22, 0.62, PALETTE.venStone);        // and the sill
      }
    }
  }

  // The Procuratie: both long sides of the square, twelve metres from the
  // middle of it, which is close enough to be IN the picture from the middle.
  arcade(venPZ_X0 - 9, venPZ_Z0, venPZ_X0, venARCH_Z - venARCH_W * 0.5, false, PALETTE.venPlaster3, true);
  arcade(venPZ_X0 - 9, venARCH_Z + venARCH_W * 0.5, venPZ_X0, venPZ_Z1 + 8, false, PALETTE.venPlaster3, true);
  // ---- THE SOTOPORTEGO ----------------------------------------------------
  // The way out of the square on foot, and the only one. It is a covered
  // passage under the building rather than a gap in it, because a fifty-metre
  // arcade with a notch cut out of it reads as a mistake and a passage with a
  // ceiling reads as Venice.
  //
  // AND IT HAD NO DEPTH AT ALL. It was a pale rectangle painted on a flat wall:
  // measured from the middle of the square, the only thing distinguishing the
  // one way out on foot from the fifty metres of façade either side of it was a
  // change of grey. A passage is a hole, and a hole is read from its EDGES —
  // a moulded arch on the square face, a barrel over the top of it, jambs that
  // step in, and the far end lighter than the near one because there is a campo
  // out there. All five, and it is legible from thirty metres.
  {
    const az = venARCH_Z, aw = venARCH_W, ax = venPZ_X0 - 4.5;
    const agy = venTerrain(venPZ_X0 - 0.6, az);
    M.box(ax, agy + 7.9, az, 9, 5.4, aw, PALETTE.venPlaster3);              // the block over it
    M.box(ax, agy + 4.6, az, 9.4, 0.5, aw + 0.7, PALETTE.venStone);         // its underside
    // the barrel: five plates stepping across the head of the passage
    for (let k = 0; k < 5; k++) {
      const a = (k + 0.5) / 5 * Math.PI;
      M.box(ax, agy + 3.05 + Math.sin(a) * 1.35, az + Math.cos(a) * 1.35 * (aw / 3.4),
            9, 0.5, 1.15, PALETTE.venStoneDark, Math.PI * 0.5 - a);
    }
    for (let k = -1; k <= 1; k += 2) {
      M.box(ax, agy + 1.6, az + k * (aw * 0.5 - 0.35), 9, 3.2, 0.7, PALETTE.venStoneDark);
      M.box(ax, agy + 1.6, az + k * (aw * 0.5 - 0.9), 9, 3.2, 0.4, PALETTE.venPlaster3);
    }
    // the moulded arch on the square face, which is the bit you see from afar
    for (let e = 0; e < 2; e++) {
      const fx = e ? venPZ_X0 - 8.9 : venPZ_X0 + 0.15;
      for (let k = 0; k < 9; k++) {
        const a = (k + 0.5) / 9 * Math.PI;
        const rr = aw * 0.5 - 0.15;
        M.box(fx, agy + 3.0 + Math.sin(a) * rr, az + Math.cos(a) * rr, 0.7, 0.55,
              Math.PI * rr / 9 + 0.1, PALETTE.venStone, Math.PI * 0.5 - a);
      }
      M.box(fx, agy + 1.5, az + (aw * 0.5 + 0.2), 0.7, 3.0, 0.7, PALETTE.venStone);
      M.box(fx, agy + 1.5, az - (aw * 0.5 + 0.2), 0.7, 3.0, 0.7, PALETTE.venStone);
      M.box(fx, agy + 4.9, az, 0.9, 0.4, aw + 2.0, PALETTE.venStone);
    }
    // and a lamp on the keystone, so the passage is the brightest thing on
    // that wall at the top of the tide — see venBuildLamps
    venARCH_LAMPS.push(venPZ_X0 + 0.55, agy + 3.9, az);
    venARCH_LAMPS.push(venPZ_X0 - 9.55, agy + 3.9, az);
  }
  // THE EAST SIDE STOPS TEN METRES SHORT OF THE BASILICA, and what stands in
  // the gap is the Torre dell'Orologio — see venBuildOrologio below. The
  // square's north-east corner had fifty metres of arcade running straight
  // into the side of San Marco, which is the one corner of this square that
  // in life is not an arcade at all.
  arcade(venPZ_X1, venORO_Z1, venPZ_X1 + 9, -22, false, PALETTE.venPlaster1, false);
  // the library, down the west side of the Piazzetta, and the palace opposite
  arcade(venPT_X0 - 20, venPT_Z0 - 6, venPT_X0, venPT_Z1 + 1, false, PALETTE.venStone, true);

  // ---- the Doge's Palace ---------------------------------------------------
  // Two storeys of open loggia with a solid pink wall sitting on top of them,
  // which is the wrong way round for a building and is the single most
  // recognisable thing in the city. It faces WEST, across the Piazzetta, so its
  // colonnade is the right-hand wall of the shot you arrive in.
  {
    // ---- IT STOPS SHORT OF THE CAMPANILE ---------------------------------
    // The palace ran from z −20 to 12 and the campanile stands at z −17 in a
    // box 7.4 m square, so seven metres of tower were INSIDE the north end of
    // the Doge's Palace between y 7 and y 16 — the two most recognisable
    // objects in the city sharing the same cubic metres, which is why the
    // campanile never reads as free-standing in any shot taken from the
    // Piazzetta. The palace's north wall is at −13.6 now, three tenths clear
    // of the tower, and the campanile is an object in space with its own
    // shadow. (The tower could not move instead: venVOLO_B was placed at
    // z −21.6 precisely because it clears the tower's near wall at −20.9.)
    const x0 = venPT_X1, x1 = venPT_X1 + 22, z0 = -13.6, z1 = 12;
    const cx = (x0 + x1) * 0.5, cz = (z0 + z1) * 0.5;
    M.box(cx, 11.5, cz, x1 - x0, 9.0, z1 - z0, PALETTE.venPlaster4);
    M.box(cx, 16.3, cz, x1 - x0 + 0.8, 0.7, z1 - z0 + 0.8, PALETTE.venStone);
    // ---- THE DIAPER, and it was six lozenges to a bay ---------------------
    // The pink-and-white lozenge diaper on that wall is the whole character of
    // it, and at 0.85 m squares two metres apart it read as sixty red tiles
    // stuck on a wall at random. It is a PATTERN: half-metre lozenges on a
    // 1.0 x 0.95 lattice, offset row by row so the courses interlock, which is
    // what makes a diaper a diaper rather than a grid.
    const dnz = Math.round((z1 - z0 - 2.4) / 1.0);
    for (let i = 0; i <= dnz; i++) {
      for (let j = 0; j < 8; j++) {
        const off = (j % 2) * 0.5;
        M.box(x0 - 0.05, 8.3 + j * 0.95, z0 + 1.2 + (i + off) * 1.0, 0.1, 0.5, 0.5,
              (i + j) % 2 ? PALETTE.venStone : PALETTE.venPlaster2, 0, 0, Math.PI * 0.25);
      }
    }
    // ---- AND THE CRESTING -------------------------------------------------
    // The lace of white merlons along the top of that building is the single
    // most copied roofline in Europe and this palace had a plain slab. Each
    // merlon is a stem, a fleur head and a little cap; forty of them run the
    // façade and it is the silhouette from the Molo.
    for (let i = 0; i * 1.28 < z1 - z0 - 0.6; i++) {
      const mz = z0 + 0.6 + i * 1.28;
      M.box(x0 - 0.1, 17.5, mz, 0.24, 1.7, 0.34, PALETTE.venStone);
      M.box(x0 - 0.1, 18.5, mz, 0.24, 0.5, 1.0, PALETTE.venStone);
      M.box(x0 - 0.1, 19.0, mz, 0.24, 0.5, 0.34, PALETTE.venStone);
      M.sph(x0 - 0.1, 19.4, mz, 0.14, 0.18, 0.14, PALETTE.venStone);
    }
    for (let i = 0; i <= 15; i++) {
      const z = lerp(z0 + 0.8, z1 - 0.8, i / 15);
      M.cyl(x0 + 0.4, 1.9, z, 0.36, 3.8, PALETTE.venStone, 0, 0, 0, 8);
      M.box(x0 + 0.4, 3.95, z, 0.95, 0.3, 0.95, PALETTE.venStone);
    }
    M.box(cx, 4.4, cz, x1 - x0, 0.6, z1 - z0, PALETTE.venStone);
    for (let i = 0; i <= 30; i++) {
      const z = lerp(z0 + 0.6, z1 - 0.6, i / 30);
      M.cyl(x0 + 0.4, 6.0, z, 0.2, 2.6, PALETTE.venStone, 0, 0, 0, 6);
    }
    M.box(cx, 7.5, cz, x1 - x0, 0.5, z1 - z0, PALETTE.venStone);
    M.box(x0 + 0.2, 5.9, cz, 0.35, 2.8, z1 - z0, PALETTE.venStoneDark);
  }
  // ---- the basilica --------------------------------------------------------
  // Five domes, five arched portals, and enough gold that the eye goes to it
  // from the far end of the square. That is the whole job: this is the thing you
  // are walking toward for sixty metres.
  {
    const bx = venBASILICA.x, bz = venBASILICA.z;
    // FIFTEEN, NOT TWELVE. The mass has to stand behind the upper order — five
    // ogee windows whose heads reach 16 m — or the terrace, the horses and the
    // gables are all silhouetted against open sky with the domes floating
    // separately behind them, which is the same failure as the girder it
    // replaced with the pieces rearranged.
    M.box(bx, 8.5, bz, 30, 17.0, 22, PALETTE.venStone);
    M.box(bx, 8.5, bz + 10.9, 31, 17.0, 1.2, PALETTE.venStoneWet);
    // the front, facing SOUTH back down the square — five portals, and the one
    // in the middle is bigger, which is the only hierarchy this façade has
    // FIVE PORTALS, AND A PORTAL IS A HOLE. They were five flat blue slabs with
    // a gold hoop lying on them, and from the far end of the square — which is
    // the sixty metres this whole chapter walks — the front of San Marco read
    // as a beige wall with five dark rectangles painted on it. A recess, a
    // stepped archivolt round it, a lunette of mosaic in the head and a bronze
    // door standing in the dark at the back: four boxes more per portal and the
    // façade has depth from thirty metres.
    for (let i = 0; i < 5; i++) {
      const x = bx - 12 + i * 6;
      const w = i === 2 ? 5.4 : 4.2;
      // THE FAÇADE FACE IS NOT bz + 11. There is a full-width Istrian band on
      // the front of the basilica (`venStoneWet`, 31 x 11.2 x 1.2, centred at
      // bz + 10.9) whose front plane is bz + 11.5 — so every portal part laid
      // at bz + 11.1 was BEHIND the façade, and the doors, the dark and the
      // lunette were all invisible while the jambs, which are 1.9 deep, showed.
      // Everything that has to be seen goes proud of bz + 11.5.
      const fz = bz + 11.55;
      // the reveal: the jambs and the head, standing proud of the wall
      for (let k = -1; k <= 1; k += 2) {
        M.box(x + k * (w * 0.5 + 0.35), 3.4, fz + 0.15, 0.7, 6.8, 1.9, PALETTE.venStone);
      }
      // THE BACK OF THE RECESS IS A PANEL, NOT A BLOCK. A solid box a metre
      // deep is opaque from the front, so the doors and the lunette behind it
      // were invisible — the same mistake as the Procuratie's window surrounds,
      // twenty lines apart. Thin, set back, and everything else in front of it.
      M.box(x, 3.2, fz + 0.1, w, 6.4, 0.3, 0x2a2f38);
      // the bronze doors standing in that dark, which catch the light
      M.box(x, 2.1, fz + 0.32, w - 1.1, 4.2, 0.22, PALETTE.venGondolaTr);
      M.box(x, 2.1, fz + 0.45, 0.14, 4.2, 0.1, 0x2a2f38);
      // the arch: a ring of voussoirs, and a lunette of mosaic inside it
      for (let k = 0; k < 9; k++) {
        const a = (k + 0.5) / 9 * Math.PI;
        const rr = w * 0.5 + 0.4;
        M.box(x + Math.cos(a) * rr, 6.4 + Math.sin(a) * rr, fz + 0.3,
              Math.PI * rr / 9 + 0.12, 0.8, 1.7, PALETTE.venStone, 0, 0, a - Math.PI * 0.5);
      }
      // A LUNETTE IS THE HEAD OF THE OPENING, NOT A DISC ACROSS IT. Two
      // cylinders of radius w/2 laid face-on hung a two-and-a-half metre gold
      // coin in every portal and covered the doors, the dark and each other.
      M.box(x, 7.1, fz + 0.28, w - 0.5, 1.5, 0.2, PALETTE.venMosaic);
      M.cyl(x, 7.1, fz + 0.42, 0.52, 0.16, PALETTE.venGold, Math.PI * 0.5, 0, 0, 8);
      for (let k = 0; k < 5; k++) {
        M.box(x - (w - 1.6) * 0.5 + k * (w - 1.6) / 4, 7.1, fz + 0.4, 0.22, 1.1, 0.14,
              k % 2 ? PALETTE.venGoldPale : PALETTE.venGold);
      }
      // ---- THE UPPER ORDER, and it is half the façade ---------------------
      // San Marco is TWO storeys of arches, not one with a lid on it: five
      // portals below, five great ogee windows above them behind a terrace,
      // and a crocketed gable over each of THOSE carrying a statue. Before
      // 23 Aug 2026 everything above y 9 was one gold beam 31 m long lying
      // across the front — which read as a scaffolding girder, cut the tops
      // off the gables, and left the most photographed façade in Europe as a
      // row of doors with five domes floating over it.
      const uy = 12.4;                                   // the upper sill
      // ---- FOUR OF THEM ARE MOSAICS AND ONE IS A WINDOW -------------------
      // Only the middle arch of the upper order is glazed; the other four are
      // filled with gold-ground mosaic, which is where the light on that
      // façade actually comes from at four in the afternoon. Drawn as five
      // dark openings they were five black rectangles occupying the whole of
      // the storey — the exact failure the five PORTALS below them were fixed
      // for in August, one floor up.
      if (i === 2) {
        M.box(x, uy + 1.5, fz + 0.05, w - 0.4, 3.6, 0.3, 0x2a2f38);
        // the tracery: two mullions and a transom, which is what makes a hole
        // a window rather than a hole
        for (let k = -1; k <= 1; k += 2) {
          M.box(x + k * (w - 0.4) * 0.22, uy + 1.5, fz + 0.16, 0.16, 3.6, 0.2, PALETTE.venStone);
        }
        M.box(x, uy + 2.5, fz + 0.16, w - 0.5, 0.14, 0.2, PALETTE.venStone);
      } else {
        M.box(x, uy + 1.5, fz + 0.05, w - 0.4, 3.6, 0.3, PALETTE.venGold);
        // a figure standing in the gold, in the blue every one of them is on
        M.box(x, uy + 1.4, fz + 0.16, w - 1.5, 3.0, 0.2, PALETTE.venMosaic);
        M.cyl(x, uy + 1.0, fz + 0.26, 0.34, 1.9, PALETTE.venStone, 0, 0, 0, 6);
        M.sph(x, uy + 2.15, fz + 0.26, 0.26, 0.3, 0.26, PALETTE.venStone);
        M.cyl(x, uy + 2.5, fz + 0.28, 0.42, 0.1, PALETTE.venGoldPale, 0, 0, 0, 8);
        for (let k = -1; k <= 1; k += 2) {
          M.box(x + k * (w - 1.5) * 0.34, uy + 1.5, fz + 0.24, 0.22, 2.4, 0.16,
                PALETTE.venGoldPale);
        }
      }
      for (let k = -1; k <= 1; k += 2) {
        M.box(x + k * (w * 0.5 - 0.05), uy + 1.5, fz + 0.12, 0.55, 4.0, 0.6, PALETTE.venStone);
      }
      for (let k = 0; k < 7; k++) {
        const a = (k + 0.5) / 7 * Math.PI;
        const rr = w * 0.5 - 0.05;
        M.box(x + Math.cos(a) * rr, uy + 3.3 + Math.sin(a) * rr, fz + 0.22,
              Math.PI * rr / 7 + 0.1, 0.55, 0.62, PALETTE.venStone, 0, 0, a - Math.PI * 0.5);
      }
      M.box(x, uy + 3.6, fz + 0.16, w - 1.2, 1.1, 0.18,
            i === 2 ? PALETTE.venGold : PALETTE.venMosaic);
      // THE GABLE IS A CROCKETED OGEE, not a tent. A four-sided cone was a
      // circus marquee sitting on the parapet; two stepped plates and a
      // finial is the shape, and the crockets are what make it Gothic.
      // AND THE PROFILE IS AN OGEE, not a staircase. Four equal steps of a
      // linear taper is a ziggurat; the width has to fall FAST at the bottom
      // and slowly at the top, which is `(1 − t)^0.55`, and the last course has
      // to be thin enough to be a finial. Seven courses at half the thickness
      // is the same triangle count as four fat ones and it reads as a curve.
      const gy2 = uy + 5.0;
      const GC = 7;
      M.box(x, gy2 + 0.35, fz + 0.05, w + 0.55, 0.7, 0.7, PALETTE.venStone);
      for (let k = 0; k < GC; k++) {
        const t2 = (k + 0.5) / GC;
        const gw = (w + 0.4) * Math.pow(1 - t2, 0.55);
        const gyy = gy2 + 0.72 + t2 * 3.0;
        M.box(x, gyy, fz + 0.05, gw, 3.0 / GC + 0.16, 0.6,
              k < 3 ? PALETTE.venGoldPale : PALETTE.venGold);
        // the crockets, one pair a course, which is the whole read at 40 m
        for (let s3 = -1; s3 <= 1; s3 += 2) {
          M.box(x + s3 * (gw * 0.5 + 0.14), gyy, fz + 0.05, 0.26, 0.28, 0.32, PALETTE.venStone);
        }
      }
      // and a saint on the top of it, because there are fourteen of them
      M.cyl(x, gy2 + 4.4, fz + 0.05, 0.22, 1.3, PALETTE.venStone, 0, 0, 0, 6);
      M.sph(x, gy2 + 5.2, fz + 0.05, 0.2, 0.24, 0.2, PALETTE.venStone);
      M.cyl(x, gy2 + 5.5, fz + 0.05, 0.3, 0.1, PALETTE.venGold, 0, 0, 0, 8);
    }
    // ---- THE TERRACE, AND THE FOUR HORSES --------------------------------
    // The balcony over the central portal is the one place in this square that
    // anybody is ever allowed to stand, and the quadriga on it is the most
    // stolen object in Europe. Both are one line of silhouette from the far
    // end of the square, which is the sixty metres this chapter walks.
    {
      const fz = bz + 11.55;
      M.box(bx, 10.5, fz - 0.35, 31, 0.5, 2.4, PALETTE.venStone);
      M.box(bx, 10.15, fz - 0.35, 31.4, 0.35, 2.8, PALETTE.venStoneDark);
      // the balustrade: a post every 90 cm, and a rail over the top of them
      for (let i = 0; i < 34; i++) {
        const px2 = bx - 14.9 + i * 0.9;
        M.cyl(px2, 11.15, fz + 0.5, 0.15, 0.8, PALETTE.venStone, 0, 0, 0, 6);
      }
      M.box(bx, 11.65, fz + 0.5, 30.6, 0.24, 0.45, PALETTE.venStone);
      M.box(bx, 10.85, fz + 0.5, 30.6, 0.2, 0.55, PALETTE.venStone);
      // ---- the four bronze horses, abreast, over the middle arch ----------
      // BIGGER AND PALER THAN THEY WANT TO BE. At 0.86 m at the withers in a
      // bronze two shades off the wall behind them, four horses on a terrace
      // twelve metres up read as four brown barrels — measured off the frame.
      // The quadriga is gilded bronze and it is the brightest thing on that
      // storey: 1.5 m at the shoulder, a raised near foreleg on each (which is
      // what makes a standing quadruped read as a horse at all), and they
      // stand FORWARD of the balustrade so the legs are against the sky.
      for (let i = 0; i < 4; i++) {
        const hx = bx - 3.0 + i * 2.0;
        M.box(hx, 13.35, fz + 0.62, 0.62, 1.15, 2.5, PALETTE.venGoldPale);      // barrel
        M.box(hx, 13.15, fz + 0.62, 0.66, 0.5, 2.3, PALETTE.venBronze);         // shadowed belly
        M.box(hx, 14.35, fz + 1.42, 0.5, 1.5, 0.62, PALETTE.venGoldPale, 0.42); // neck
        M.box(hx, 15.15, fz + 1.95, 0.4, 0.5, 1.0, PALETTE.venGoldPale, -0.55); // head
        M.box(hx, 15.35, fz + 1.66, 0.16, 0.34, 0.3, PALETTE.venGoldPale);      // ear
        M.box(hx, 14.6, fz + 1.05, 0.2, 1.5, 0.34, PALETTE.venBronze, -0.35);   // mane
        M.box(hx, 13.35, fz - 0.5, 0.2, 0.5, 1.3, PALETTE.venGoldPale, 0.6);    // tail
        // three feet down and one raised, which is the pose all four are in
        M.box(hx - 0.24, 12.05, fz + 1.42, 0.2, 1.9, 0.24, PALETTE.venGoldPale, -0.16);
        M.box(hx + 0.24, 12.5, fz + 1.6, 0.2, 1.7, 0.24, PALETTE.venGoldPale, -0.85);
        M.box(hx - 0.24, 12.05, fz - 0.2, 0.2, 1.9, 0.24, PALETTE.venGoldPale, 0.2);
        M.box(hx + 0.24, 12.05, fz - 0.2, 0.2, 1.9, 0.24, PALETTE.venGoldPale, 0.28);
      }
    }
    // ---- THE THREE FLAGPOLES ------------------------------------------------
    // They have stood in front of that façade since 1505 and they are the only
    // thing in the square that is TALL, THIN and MOVING. From the middle of the
    // piazza they give the eye a measure of the basilica, and they are the one
    // read of the wind anybody gets before the siren.
    // ELEVEN METRES, NOT FIFTEEN. The first cut stood three poles taller than
    // the roofline of the thing they are in front of, straight across the one
    // view the whole square is laid out to deliver.
    for (let i = 0; i < 3; i++) {
      const fx = bx - 11 + i * 11, fz2 = bz + 15.5;
      M.cyl(fx, 0.5, fz2, 0.9, 1.0, PALETTE.venGondolaTr, 0, 0.4, 0, 8);
      M.cyl(fx, 1.15, fz2, 0.74, 0.35, PALETTE.venStone, 0, 0.4, 0, 8);
      M.cyl(fx, 6.0, fz2, 0.16, 9.6, PALETTE.venBriccola, 0, 0, 0, 6);
      M.sph(fx, 11.0, fz2, 0.26, 0.3, 0.26, PALETTE.venGold);
      venFLAGS.push(fx, 9.6, fz2);
    }
    // five domes: a big one over the crossing and four around it
    // ---- AND A DOME HAS RIBS ---------------------------------------------
    // A lead onion is a surface of revolution and it reads as a ball unless
    // the meridians are on it: five gilt ribs a dome, a drum with a course of
    // little windows round it, and a lantern on the top with a cross. That is
    // the difference between a dome and a hemisphere — the same argument the
    // pigeon's tail and the neon sign's frame both made in this project.
    const domes = [[0, 0, 7.0], [0, -6.5, 5.2], [0, 6.5, 5.2], [-9.5, 0, 5.2], [9.5, 0, 5.2]];
    for (let i = 0; i < domes.length; i++) {
      const dx2 = domes[i][0], dz2 = domes[i][1], r = domes[i][2];
      // EIGHTEEN, NOT FIFTEEN AND A HALF. At the first height the crocketed
      // gables (which top out at 22.7) and the domes (22.8) finished level, so
      // from the middle of the square five gold tents stood in front of five
      // gold domes and neither could be told from the other. San Marco's
      // domes crest at forty-three metres over a twenty-nine metre gable line:
      // the domes have to be the thing ABOVE, or the façade has no layers.
      const dy = 18.4;
      M.cyl(bx + dx2, dy, bz + dz2, r * 0.86, 2.2, PALETTE.venStone, 0, 0, 0, 8);
      M.cyl(bx + dx2, dy + 1.25, bz + dz2, r * 0.94, 0.34, PALETTE.venStoneDark, 0, 0, 0, 8);
      // a ring of drum windows, dark, which is what makes a drum a drum
      const nw = i === 0 ? 10 : 8;
      for (let k = 0; k < nw; k++) {
        const a = k / nw * 6.28318;
        M.box(bx + dx2 + Math.sin(a) * r * 0.87, dy + 0.1, bz + dz2 + Math.cos(a) * r * 0.87,
              0.34, 1.3, 0.34, PALETTE.venMosaic, 0, a);
      }
      M.sph(bx + dx2, dy + 1.6, bz + dz2, r, r * 0.80, r, PALETTE.venGoldPale);
      // ---- the ribs, and the rotation is the whole of it ------------------
      // A rib is a segment of a MERIDIAN, so its long axis has to be the
      // meridian's tangent — which at the equator is straight up and at the
      // pole is horizontal pointing in. The merger composes 'YXZ', so a box at
      // azimuth a and polar angle th wants ry = a and rx = −(π/2 + th): check
      // both ends, because the first cut used −th * 0.9 and what that draws is
      // five gold spikes fanning OUT of the dome like a mace.
      // ALL THE WAY ROUND. `k / nr * PI` puts every rib on the half of the
      // dome with x > 0, so from the square four of the five domes had ribs
      // down one cheek and nothing on the other.
      const nr = i === 0 ? 10 : 8;
      const RC = 4;
      const arc = (r * 0.5 + r * 0.80 * 0.5) * (Math.PI * 0.5) / RC;
      for (let k = 0; k < nr; k++) {
        const a = k / nr * 6.28318;
        for (let s3 = 0; s3 < RC; s3++) {
          const th = (s3 + 0.5) / RC * Math.PI * 0.5;
          const rr = r * Math.cos(th) * 1.008, hh = r * 0.80 * Math.sin(th) * 1.008;
          M.box(bx + dx2 + Math.sin(a) * rr, dy + 1.6 + hh, bz + dz2 + Math.cos(a) * rr,
                0.26, 0.16, arc * 1.12, PALETTE.venGold, -(Math.PI * 0.5 + th), a);
        }
      }
      // the lantern, and the cross that is on every one of them
      M.cyl(bx + dx2, dy + r * 0.72 + 1.9, bz + dz2, 0.62, 1.9, PALETTE.venStone, 0, 0, 0, 8);
      M.cyl(bx + dx2, dy + r * 0.72 + 3.0, bz + dz2, 0.74, 0.2, PALETTE.venGold, 0, 0, 0, 8);
      M.sph(bx + dx2, dy + r * 0.72 + 3.4, bz + dz2, 0.5, 0.5, 0.5, PALETTE.venGold);
      M.box(bx + dx2, dy + r * 0.72 + 4.3, bz + dz2, 0.12, 1.5, 0.12, PALETTE.venGold);
      M.box(bx + dx2, dy + r * 0.72 + 4.6, bz + dz2, 0.7, 0.12, 0.12, PALETTE.venGold);
    }
  }

  // ---- the campanile -------------------------------------------------------
  // Plain brick for thirty-five metres and then it stops being plain, which is
  // exactly what it does in life.
  {
    const cx = venCAMPANILE.x, cz = venCAMPANILE.z, w = venCAMPANILE.w;
    M.box(cx, 17, cz, w, 34, w, PALETTE.venBrick);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI * 0.5;
      M.box(cx + Math.sin(a) * (w * 0.5 + 0.02), 20, cz + Math.cos(a) * (w * 0.5 + 0.02),
            0.5, 26, 0.5, PALETTE.venStoneWet, 0, a);
    }
    // ---- THE BELFRY IS FOUR ARCHES, NOT FOUR DARK RECTANGLES --------------
    // A 2.6 x 3.4 panel of venMosaic laid on the face of a white box is a
    // window sticker: the one part of this tower anybody can identify at forty
    // metres is the OPENING — a tall round-headed arch on every side with the
    // dark of the bell chamber behind it and the bells hanging in the dark.
    // Built the way every other arch in this chapter is: a ring of voussoirs
    // on the face, jambs, and the dark set back behind them.
    M.box(cx, 35.4, cz, w + 1.1, 4.8, w + 1.1, PALETTE.venStone);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI * 0.5;
      const sa = Math.sin(a), ca = Math.cos(a);
      const ox = sa * (w * 0.5 + 0.5), oz = ca * (w * 0.5 + 0.5);
      // the dark of the chamber, set back
      M.box(cx + sa * (w * 0.5 + 0.28), 35.2, cz + ca * (w * 0.5 + 0.28),
            2.7, 3.9, 0.3, 0x2a2f38, 0, a);
      // the bell in it, which is the reason the tower exists
      M.cyl(cx + sa * (w * 0.5 - 0.15), 35.5, cz + ca * (w * 0.5 - 0.15), 0.62, 1.05,
            PALETTE.venBronze, 0, 0, 0, 8);
      // jambs and a round head, standing proud
      for (let s3 = -1; s3 <= 1; s3 += 2) {
        M.box(cx + ox + ca * s3 * 1.65, 34.7, cz + oz - sa * s3 * 1.65,
              0.55, 4.6, 0.36, PALETTE.venStone, 0, a);
      }
      for (let k = 0; k < 7; k++) {
        const b2 = (k + 0.5) / 7 * Math.PI;
        const rr = 1.65;
        M.box(cx + ox + ca * Math.cos(b2) * rr, 36.3 + Math.sin(b2) * rr,
              cz + oz - sa * Math.cos(b2) * rr,
              Math.PI * rr / 7 + 0.1, 0.5, 0.36, PALETTE.venStone, 0, a, b2 - Math.PI * 0.5);
      }
    }
    // ---- the attic: the two reliefs of Venice and Justice, in Verona marble
    M.box(cx, 38.4, cz, w + 0.6, 1.4, w + 0.6, PALETTE.venStone);
    M.box(cx, 40.2, cz, w * 0.78, 2.6, w * 0.78, PALETTE.venStoneWet);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI * 0.5;
      M.box(cx + Math.sin(a) * (w * 0.39 + 0.06), 40.3, cz + Math.cos(a) * (w * 0.39 + 0.06),
            3.4, 1.7, 0.12, PALETTE.venBriccolaR, 0, a);
      M.box(cx + Math.sin(a) * (w * 0.39 + 0.14), 40.3, cz + Math.cos(a) * (w * 0.39 + 0.14),
            2.2, 1.0, 0.12, PALETTE.venGoldPale, 0, a);
    }
    M.box(cx, 41.8, cz, w * 0.9, 0.6, w * 0.9, PALETTE.venStone);
    // ---- AND THE SPIRE IS GREEN -------------------------------------------
    // It is sheathed in copper and it has been verdigris for four hundred
    // years. Drawn in venRoof — the terracotta the calli's pantiles are in —
    // it read as one more orange roof in a city of them, on the one object
    // that is supposed to be the single landmark you can see from anywhere.
    // Two courses, the lower one flared, which is how the pyramid actually sits.
    M.box(cx, 42.6, cz, w * 0.86, 1.0, w * 0.86, PALETTE.venVerdigris);
    M.cone(cx, 45.6, cz, w * 0.44, 6.4, PALETTE.venVerdigris, 0, Math.PI * 0.25, 0, 4);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI * 0.5 + Math.PI * 0.25;
      M.box(cx + Math.sin(a) * w * 0.22, 45.6, cz + Math.cos(a) * w * 0.22,
            0.16, 6.4, 0.16, PALETTE.venStoneWet, 0, a);
    }
    M.cyl(cx, 49.2, cz, 0.26, 1.8, PALETTE.venGold, 0, 0, 0, 6);
    // the angel itself is its own mesh — see venBuildAngel — because it turns

    // ---- THE LOGGETTA, at the foot of it ---------------------------------
    // Sansovino's little marble lodge is bolted to the square face of this
    // tower and it is the whole reason the campanile does not read as a
    // chimney: forty metres of plain brick needs something at the bottom of it
    // at the scale of a person. Three arches, a balustrade and four bronzes.
    {
      const lx = cx - w * 0.5 - 1.35;          // it faces the square, at -x
      const ly = venTerrain(lx, cz);
      M.box(lx + 0.5, ly + 0.35, cz, 3.4, 0.7, 10.2, PALETTE.venStoneWet);
      M.box(lx, ly + 3.1, cz, 2.6, 5.5, 9.6, PALETTE.venStone);
      for (let i = 0; i < 3; i++) {
        const az = cz + (i - 1) * 3.0;
        // the arch: a hole with a dark back and a ring on the face
        M.box(lx + 0.3, ly + 2.3, az, 2.2, 3.6, 2.0, 0x3a3730);
        // the ring is STONE — in red Verona it filled the opening and three
        // arches read as three red doors on a red wall
        for (let k = 0; k < 7; k++) {
          const b2 = (k + 0.5) / 7 * Math.PI;
          M.box(lx - 1.32, ly + 3.0 + Math.sin(b2) * 1.15, az + Math.cos(b2) * 1.15,
                0.5, 0.42, Math.PI * 1.15 / 7 + 0.1, PALETTE.venStone, Math.PI * 0.5 - b2);
        }
      }
      // the four columns between the arches, in red Verona marble
      for (let i = 0; i < 4; i++) {
        const az = cz + (i - 1.5) * 3.0;
        M.cyl(lx - 1.5, ly + 2.4, az, 0.34, 4.2, PALETTE.venBriccolaR, 0, 0, 0, 8);
        M.box(lx - 1.5, ly + 4.62, az, 0.95, 0.3, 0.95, PALETTE.venStone);
        // a bronze in the niche behind each
        M.cyl(lx - 0.2, ly + 2.2, az, 0.24, 1.5, PALETTE.venBronze, 0, 0, 0, 6);
        M.sph(lx - 0.2, ly + 3.12, az, 0.2, 0.24, 0.2, PALETTE.venBronze);
      }
      // the attic and its balustrade, which is where the eye stops
      M.box(lx - 0.2, ly + 5.15, cz, 3.4, 0.7, 10.6, PALETTE.venStone);
      for (let k = 0; k < 13; k++) {
        M.cyl(lx - 1.5, ly + 5.9, cz - 4.8 + k * 0.8, 0.12, 0.8, PALETTE.venStone, 0, 0, 0, 6);
      }
      M.box(lx - 1.5, ly + 6.4, cz, 0.42, 0.2, 10.0, PALETTE.venStone);
      venStaticBox(game, lx + 0.1, ly + 2.8, cz, 3.6, 5.6, 10.2);
    }
  }

  // ---- the two columns on the Molo, and the steps into the water -----------
  for (let i = 0; i < 2; i++) {
    const c = venCOLUMNS[i];
    M.box(c.x, venMOLO_Y + 0.35, c.z, 3.0, 0.7, 3.0, PALETTE.venStone);
    M.cyl(c.x, venMOLO_Y + 5.2, c.z, 0.78, 9.0, PALETTE.venStoneWet, 0, 0, 0, 8);
    M.box(c.x, venMOLO_Y + 10.1, c.z, 2.1, 0.9, 2.1, PALETTE.venStone);
    if (i === 0) {
      // the lion
      M.box(c.x, venMOLO_Y + 11.4, c.z, 1.1, 1.5, 2.6, PALETTE.venGold);
      M.box(c.x, venMOLO_Y + 12.3, c.z - 1.5, 0.9, 0.9, 1.2, PALETTE.venGold);
      M.box(c.x - 1.5, venMOLO_Y + 12.2, c.z + 0.1, 2.6, 0.12, 1.6, PALETTE.venGoldPale, 0, 0, -0.2);
      M.box(c.x + 1.5, venMOLO_Y + 12.2, c.z + 0.1, 2.6, 0.12, 1.6, PALETTE.venGoldPale, 0, 0, 0.2);
    } else {
      // and San Todaro, standing on his crocodile, looking unimpressed
      M.box(c.x, venMOLO_Y + 11.6, c.z, 0.8, 1.9, 0.8, PALETTE.venStone);
      M.sph(c.x, venMOLO_Y + 12.9, c.z, 0.34, 0.4, 0.34, PALETTE.venStone);
      M.box(c.x + 0.7, venMOLO_Y + 10.9, c.z, 1.9, 0.35, 0.5, PALETTE.venStoneDark);
    }
  }
  // the steps down into the Bacino, which is how you get back out of it
  for (let i = 0; i < 5; i++) {
    M.box(-4, venMOLO_Y - 0.28 - i * 0.28, venMOLO_Z1 + 0.4 + i * 0.9, 26, 0.3, 1.0, PALETTE.venStoneWet);
  }

  const g = M.build();
  const mesh = new THREE.Mesh(g, venVC());
  mesh.castShadow = true; mesh.receiveShadow = true;
  root.add(mesh);

  // ---- collision ----------------------------------------------------------
  // Everything the capybara can be stopped by, and nothing it cannot. FULL
  // extents in the merger above, HALF in CANNON — venStaticBox does the halving
  // so one convention is spoken in both places.
  venStaticBox(game, venCAMPANILE.x, 17, venCAMPANILE.z, venCAMPANILE.w + 0.4, 34, venCAMPANILE.w + 0.4);
  // 31.2, not 30: the Istrian band across the front of the basilica is 31 wide
  // and the block behind it 30, so half a metre of façade stood outside the
  // collider at each end — on the corner the player walks round to reach the
  // Piazzetta.
  // ...and 25.6 deep rather than 22, centred 1.8 forward: the five portal
  // reveals stand 1.9 m proud of the façade, so with a collider that stopped at
  // the wall plane the animal walked into every jamb on the front of San Marco.
  venStaticBox(game, venBASILICA.x, 6, venBASILICA.z + 1.8, 31.2, 12, 25.6);
  // the palace, which now stops at z −13.6 so the campanile is free of it
  venStaticBox(game, venPT_X1 + 11, 8, -0.8, 22, 16, 25.6);
  // THE ARCADES ARE HOLLOW NOW, so their colliders are too: the back of the
  // block, and one body carrying every pier on the façade line. Five bodies
  // instead of four, and the whole colonnade is a place the animal can be under
  // rather than a cliff it has to walk round — which is where the café is, and
  // where the passerelle come out of the sotoportego.
  for (let i = 0; i < venArcMass.length; i += 6) {
    venStaticBox(game, venArcMass[i], venArcMass[i + 1], venArcMass[i + 2],
                 venArcMass[i + 3], venArcMass[i + 4], venArcMass[i + 5]);
  }
  {
    // one compound body for forty piers: forty broadphase entries to express a
    // row of posts is forty entries for no gameplay at all (CONTRACT, POOLING)
    const pb = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
    for (let i = 0; i < venArcPiers.length; i += 4) {
      pb.addShape(new CANNON.Box(new CANNON.Vec3(venArcPiers[i + 2], 3.0, venArcPiers[i + 3])),
                  new CANNON.Vec3(venArcPiers[i], 1.9, venArcPiers[i + 1]));
    }
    venSyncBody(pb);
    game.world.addBody(pb);
  }
  // the sotoportego: its two side walls, and nothing across the opening. The
  // block over the head of it is at 5.2 m and the capybara is not going there.
  // THE JAMBS ARE TWO PLANES DEEP. The passage has an outer wall at
  // aw/2 - 0.35 (0.7 thick, inner face at 2.80) and a plaster liner in front of
  // it at aw/2 - 0.9 (0.4 thick, inner face at 2.40): a collider sized to the
  // outer one only leaves 40 cm of drawn plaster on both sides of the one route
  // out of the square that the animal walks straight into. One box per side
  // spanning both.
  for (let k = -1; k <= 1; k += 2) {
    venStaticBox(game, venPZ_X0 - 4.5, 1.6, venARCH_Z + k * (venARCH_W * 0.5 - 0.55),
                 9, 3.6, 1.1);
  }
  for (let i = 0; i < 2; i++) {
    const c = venCOLUMNS[i];
    venStaticBox(game, c.x, venMOLO_Y + 5, c.z, 1.9, 10, 1.9);
  }
  {
    // the three flagpole bases, on one body: a metre of bronze in the middle of
    // sixty metres of empty paving is exactly the size of thing that reads as a
    // bug when you walk through it
    const fb = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
    for (let i = 0; i < venFLAGS.length; i += 3) {
      fb.addShape(new CANNON.Box(new CANNON.Vec3(0.5, 0.8, 0.5)),
                  new CANNON.Vec3(venFLAGS[i], 0.7, venFLAGS[i + 2]));
    }
    venSyncBody(fb);
    game.world.addBody(fb);
  }
}

// ====================================================== THE TORRE DELL'OROLOGIO
/**
 * THE CLOCK, AND THE TWO MEN WHO HIT IT.
 *
 * Piazza San Marco is closed on three sides and its north-east corner — the one
 * between the arcade and the basilica — is not an arcade, it is a tower with an
 * astronomical clock on the front of it and a passage underneath it into the
 * Merceria. Before 23 Aug 2026 that corner was fifty metres of Procuratie
 * running into the side of San Marco, which is the one join in this square that
 * nobody has ever photographed.
 *
 * Everything about it is legible from the far end of the square, which is the
 * sixty metres this chapter walks, and it is built in that order:
 *
 *   the ARCH at the bottom, deep and dark, because a tower with a hole in it is
 *   a tower you can tell from a building;
 *   the FACE, blue and gold, with a hand that moves on the chapter's own clock;
 *   the LION, gold on a starred blue field, because it is on everything here;
 *   the TERRACE, the bell, and the two bronze Moors.
 *
 * THE MOORS ARE THE POINT. On the hour the older one swings two minutes early
 * and the younger one two minutes late — that is true, it is the oldest joke in
 * the city, and it costs one lerp. The bell they hit is the loudest thing in
 * the chapter that is not the siren, and every pigeon in the square goes up.
 */
let venOroGroup = null;
let venOroHandH = null, venOroHandM = null;
let venOroMoorA = null, venOroMoorB = null;
let venOroStrike = -1;              // s into a strike, -1 between
let venOroStruck = 0;               // how many blows are left in this hour
let venOroBlow = 0;                 // s to the next blow
let venOroLast = -1;                // which hour was last rung
// ---- FOUR STRIKES A TIDE, NOT SEVENTY-TWO -------------------------------
// The first cut called an hour a twelfth of the tide clock, which is one
// seventeen-second hour and six blows in each of them: measured over a real
// forty-four second soak the tower rang TEN times, and a bell you hear every
// seventeen seconds is not an event, it is a car alarm. A quarter of the
// cycle is fifty-one seconds and the count goes one, two, three, four — so
// the number of blows also happens to say where in the tide you are, which
// is the one number this chapter never tells anybody in words.
const venORO_DIV = 4;

function venBuildOrologio(game, root) {
  const M = venMerger();
  const cx = venORO.x + venORO.d * 0.5;      // the tower's middle in x
  const cz = venORO.z;
  const fx = venORO.x;                        // the square face
  const W = venORO.w, D = venORO.d, TOP = venORO.top;

  // ---- the mass, and the arch through the bottom of it --------------------
  // The arch is 5 m wide and 8 tall and it is cut by BUILDING ROUND IT rather
  // than by drawing a dark rectangle on a wall — which is the lesson the
  // sotoportego learned twenty metres away and the basilica's five portals
  // learned twice.
  const AW = 5.0, AH = 8.2;
  for (let s = -1; s <= 1; s += 2) {
    const zw = (W - AW) * 0.5;
    M.box(cx, AH * 0.5, cz + s * (AW * 0.5 + zw * 0.5), D, AH, zw, PALETTE.venStone);
  }
  M.box(cx, (AH + TOP) * 0.5, cz, D, TOP - AH, W, PALETTE.venStone);
  // the barrel over the passage
  for (let k = 0; k < 6; k++) {
    const a = (k + 0.5) / 6 * Math.PI;
    M.box(cx, AH - 0.9 + Math.sin(a) * 1.5, cz + Math.cos(a) * (AW * 0.5),
          D, 0.55, AW / 6 + 0.35, PALETTE.venStoneDark, Math.PI * 0.5 - a);
  }
  // and the moulded arch on the square face, which is the read from thirty metres
  for (let k = 0; k < 11; k++) {
    const a = (k + 0.5) / 11 * Math.PI;
    const rr = AW * 0.5 + 0.35;
    M.box(fx - 0.25, AH - 1.2 + Math.sin(a) * rr, cz + Math.cos(a) * rr,
          0.8, 0.6, Math.PI * rr / 11 + 0.12, PALETTE.venStone, Math.PI * 0.5 - a);
  }
  for (let s = -1; s <= 1; s += 2) {
    M.box(fx - 0.25, (AH - 1.2) * 0.5, cz + s * (AW * 0.5 + 0.55), 0.8, AH - 1.2, 0.75,
          PALETTE.venStone);
    // a paired column against each jamb, which is what the real one has
    M.cyl(fx - 0.72, (AH - 1.2) * 0.5, cz + s * (AW * 0.5 + 0.55), 0.34, AH - 1.6,
          PALETTE.venStoneWet, 0, 0, 0, 8);
    M.box(fx - 0.72, AH - 1.35, cz + s * (AW * 0.5 + 0.55), 0.95, 0.36, 0.95, PALETTE.venStone);
  }
  // the two string courses that divide the three stages
  M.box(fx - 0.15, 9.4, cz, 0.9, 0.5, W + 0.5, PALETTE.venStone);
  M.box(fx - 0.15, 17.0, cz, 0.9, 0.5, W + 0.5, PALETTE.venStone);
  M.box(fx - 0.15, 21.2, cz, 0.9, 0.5, W + 0.5, PALETTE.venStone);
  M.box(cx, TOP + 0.35, cz, D + 0.7, 0.7, W + 0.7, PALETTE.venStone);

  // ---- THE FACE -----------------------------------------------------------
  // A five-metre disc of lapis with a gold rim and twenty-four gold marks on
  // it, standing PROUD of the wall — a clock painted flat on a façade is a
  // stain, and the whole reason this thing is a landmark is that it is a
  // machine bolted to a building.
  const CY = 13.2, CR = 3.2;
  M.cyl(fx - 0.25, CY, cz, CR + 0.55, 0.5, PALETTE.venGold, 0, 0, Math.PI * 0.5, 16);
  M.cyl(fx - 0.42, CY, cz, CR, 0.24, PALETTE.venMosaic, 0, 0, Math.PI * 0.5, 16);
  for (let k = 0; k < 24; k++) {
    const a = k / 24 * 6.28318;
    M.box(fx - 0.56, CY + Math.sin(a) * CR * 0.86, cz + Math.cos(a) * CR * 0.86,
          0.1, k % 6 === 0 ? 0.62 : 0.34, k % 6 === 0 ? 0.3 : 0.16,
          k % 6 === 0 ? PALETTE.venGoldPale : PALETTE.venGold, a);
  }
  // the inner zodiac band and the little gilt earth at the middle
  M.cyl(fx - 0.5, CY, cz, CR * 0.52, 0.14, PALETTE.venGoldPale, 0, 0, Math.PI * 0.5, 16);
  M.cyl(fx - 0.56, CY, cz, CR * 0.44, 0.14, PALETTE.venMosaic, 0, 0, Math.PI * 0.5, 16);
  M.sph(fx - 0.66, CY, cz, 0.34, 0.34, 0.34, PALETTE.venGold);
  // the niche above it, where the Madonna sits between the two blue number panels
  M.box(fx - 0.32, 19.1, cz, 0.5, 2.6, 2.4, PALETTE.venMosaic);
  M.cyl(fx - 0.45, 18.6, cz, 0.36, 1.5, PALETTE.venGoldPale, 0, 0, 0, 8);
  M.sph(fx - 0.45, 19.55, cz, 0.3, 0.34, 0.3, PALETTE.venGoldPale);
  for (let s = -1; s <= 1; s += 2) {
    M.box(fx - 0.34, 19.1, cz + s * 2.6, 0.42, 1.5, 1.9, PALETTE.venGondola);
    M.box(fx - 0.46, 19.1, cz + s * 2.6, 0.14, 0.9, 1.1, PALETTE.venGold);
  }
  // ---- THE LION -----------------------------------------------------------
  // Gold, winged, with a book under its paw, on a blue field full of stars.
  // It is on the flag, the columns, the doge's coins and the back of every
  // vaporetto in the lagoon, and this square did not have one you could see.
  {
    const ly = 22.9;
    M.box(fx - 0.30, ly, cz, 0.46, 3.4, W - 1.2, PALETTE.venMosaic);
    for (let k = 0; k < 14; k++) {
      const a = k * 2.399;
      M.box(fx - 0.46, ly + Math.sin(a) * 1.25, cz + Math.cos(a * 1.7) * 3.6,
            0.1, 0.22, 0.22, PALETTE.venGoldPale, 0, 0, 0.8);
    }
    M.box(fx - 0.52, ly - 0.15, cz, 0.36, 1.15, 2.9, PALETTE.venGold);          // body
    M.box(fx - 0.52, ly + 0.5, cz - 1.75, 0.34, 0.9, 0.9, PALETTE.venGold);     // head
    M.box(fx - 0.58, ly + 0.62, cz - 2.15, 0.3, 0.5, 0.4, PALETTE.venGoldPale); // muzzle
    M.box(fx - 0.5, ly + 0.55, cz + 0.5, 0.5, 1.5, 2.0, PALETTE.venGoldPale, 0, 0, 0.35); // wing
    M.box(fx - 0.62, ly - 0.72, cz - 1.5, 0.3, 0.45, 1.3, PALETTE.venGoldPale); // the book
  }

  // ---- THE TERRACE, THE BELL AND THE TWO MOORS ----------------------------
  // ---- THE TERRACE GOES ON TOP OF THE MASS, NOT INSIDE IT ---------------
  // TY was TOP − 3, and the mass runs from the arch all the way to TOP — so
  // the terrace slab, the bell, its frame and both Moors were drawn three
  // metres DOWN inside fifteen hundred cubic metres of solid Istrian stone.
  // Every number about them was right and not one of them was ever on
  // screen: the only tell was that the tower had a flat top. It is the
  // Drift-pennant failure with a different mechanism — built, and not drawn.
  const TY = TOP + 0.9;
  M.box(cx, TY - 0.25, cz, D, 0.5, W, PALETTE.venStoneWet);
  for (let k = 0; k < 11; k++) {
    M.cyl(fx - 0.4, TY + 0.33, cz - W * 0.5 + 0.5 + k * ((W - 1.0) / 10), 0.13, 0.66,
          PALETTE.venStone, 0, 0, 0, 6);
  }
  M.box(fx - 0.4, TY + 0.74, cz, 0.4, 0.2, W - 0.6, PALETTE.venStone);
  const mesh = new THREE.Mesh(M.build(), venVC());
  mesh.castShadow = true; mesh.receiveShadow = true;
  root.add(mesh);

  // THE BELL AND THE TWO MEN STAND AT THE FRONT OF THE TERRACE. At the
  // tower's middle (cx, four metres back from the square face) the
  // balustrade in front of them hides all three from the only side anybody
  // ever looks at this building from — which is the whole square.
  const bx3 = venORO.x + 2.2;
  {
    const B = venMerger();
    B.box(bx3, TY + 3.1, cz, 0.3, 0.3, 4.2, PALETTE.venBronze);
    for (let s = -1; s <= 1; s += 2) {
      B.box(bx3, TY + 1.7, cz + s * 1.9, 0.3, 3.0, 0.3, PALETTE.venBronze);
    }
    B.cyl(bx3, TY + 1.9, cz, 1.15, 1.7, PALETTE.venBronze, 0, 0, 0, 8);
    B.cyl(bx3, TY + 2.85, cz, 0.55, 0.4, PALETTE.venBronze, 0, 0, 0, 8);
    const bm = new THREE.Mesh(B.build(), venVC());
    bm.castShadow = true;
    root.add(bm);
  }

  // ---- the Moors, one group each, because they SWING ----------------------
  // A figure whose only job is a gesture has to be its own node: the hammer
  // arm is the thing that moves and the man is the thing that does not.
  const moor = (sgn) => {
    const g = new THREE.Group();
    const F = venMerger();
    F.box(0, 0.55, 0, 0.5, 1.1, 0.34, PALETTE.venBronze);                 // legs/skirt
    F.box(0, 1.5, 0, 0.62, 0.85, 0.4, PALETTE.venBronze);                 // torso
    F.sph(0, 2.15, 0, 0.22, 0.25, 0.22, PALETTE.venGondolaTr);            // head
    F.box(0, -sgn * 0, 0, 0.001, 0.001, 0.001, PALETTE.venBronze);
    const body = new THREE.Mesh(F.build(), venVC());
    body.castShadow = true;
    g.add(body);
    // the arm and the hammer, on their own pivot at the shoulder
    const A = venMerger();
    A.box(0, -0.42, 0, 0.16, 0.9, 0.16, PALETTE.venBronze);
    A.box(0, -0.92, 0, 0.24, 0.34, 0.5, PALETTE.venGondolaTr);
    const arm = new THREE.Mesh(A.build(), venVC());
    arm.castShadow = true;
    const pivot = new THREE.Group();
    pivot.position.set(0, 1.85, sgn * 0.28);
    pivot.add(arm);
    g.add(pivot);
    g.userData.arm = pivot;
    return g;
  };
  venOroMoorA = moor(-1);
  venOroMoorB = moor(1);
  venOroMoorA.position.set(bx3 - 0.7, TY, cz - 2.9);
  venOroMoorB.position.set(bx3 - 0.7, TY, cz + 2.9);
  venOroMoorA.rotation.y = -Math.PI * 0.5;
  venOroMoorB.rotation.y = -Math.PI * 0.5;
  root.add(venOroMoorA);
  root.add(venOroMoorB);

  // ---- the two hands, which are their own meshes because they turn --------
  const hand = (len, wid, col) => {
    const H = venMerger();
    H.box(0, len * 0.42, 0, wid, len, 0.1, col);
    H.box(0, -len * 0.18, 0, wid * 1.5, len * 0.3, 0.1, col);
    const m = new THREE.Mesh(H.build(), new THREE.MeshBasicMaterial({ vertexColors: true }));
    m.position.set(fx - 0.78, CY, cz);
    m.rotation.y = -Math.PI * 0.5;
    return m;
  };
  venOroHandH = hand(1.9, 0.30, PALETTE.venGoldPale);
  venOroHandM = hand(2.9, 0.20, PALETTE.venGold);
  root.add(venOroHandH);
  root.add(venOroHandM);

  // and it is somewhere to walk PAST, not through: the two piers of the arch
  // are solid and the mass over the passage is not, so the archway is a real
  // hole nine metres deep with a lamp in the back of it.
  for (let s = -1; s <= 1; s += 2) {
    const zw = (W - AW) * 0.5;
    venStaticBox(game, cx, AH * 0.5, cz + s * (AW * 0.5 + zw * 0.5), D, AH, zw);
  }
  venStaticBox(game, cx, (AH + TOP) * 0.5, cz, D, TOP - AH, W);
  // the back of the passage, so it is a recess and not a way out of the world
  venStaticBox(game, venORO.x + D - 0.4, 4, cz, 0.8, 8, AW);
  // a lamp in the dark of it, and a pool on the stones under it
  venARCH_LAMPS.push(venORO.x + 3.4, 4.4, cz);
  venLOG_LAMPS.push(venORO.x + 6.2, 4.6, cz);
  venLOG_POOLS.push(venORO.x + 6.2, venTerrain(venORO.x + 6.2, cz) + 0.04, cz, 4.4);
  // the clock face is the brightest thing on that wall at the top of the tide
  venMirAdd(venORO.x - 1.0, cz, 5.0, 20, PALETTE.venGold);
}

/**
 * The hands turn on the tide clock — one revolution of the minute hand per
 * tide, so the face is a READ of how long there is left, which is the one
 * number this chapter never tells anybody in words. And on the hour the Moors
 * swing.
 */
function venUpdateOrologio(game, dt) {
  if (!venOroHandM) return;
  // A "day" is one tide cycle and it has twelve hours in it, so the hour hand
  // does one turn per cycle and the minute hand twelve.
  const hrs = venPhase * venORO_DIV;
  venOroHandM.rotation.x = -(hrs % 1) * 6.28318;
  venOroHandH.rotation.x = -venPhase * 6.28318;   // one turn per tide: a gauge
  const hour = Math.floor(hrs);
  if (hour !== venOroLast) {
    if (venOroLast >= 0) {
      venOroStruck = hour + 1;
      venOroBlow = 0;
      venOroStrike = 0;
    }
    venOroLast = hour;
  }
  // ---- the strike ---------------------------------------------------------
  if (venOroStruck > 0) {
    venOroBlow -= dt;
    if (venOroBlow <= 0) {
      venOroBlow = 1.15;
      venOroStrike = 0;
      venOroStruck--;
      // THE BELL IS A LAYER, NOT A VOICE. One chime is a triangle; a bronze
      // bell three metres across is a chime with an organ pedal under it and a
      // second chime a fifth up half a beat later.
      const cp = game.capy && game.capy.position;
      const far = cp ? Math.hypot(cp.x - venORO.x, cp.z - venORO.z) : 999;
      const v = clamp(1.05 - far * 0.006, 0.16, 1.0);
      venSfx('chime', { volume: v, pitch: 0.42, force: true });
      venSfx('organ', { volume: v * 0.5, pitch: 0.5 });
      // ...and every pigeon inside twenty-five metres of the tower leaves.
      venPigeonScare(venORO.x - 3, venORO.z, 26, 0.55);
      if (venOroStruck === hour && far < 46 && typeof game.shake === 'function') {
        game.shake(0.05);
      }
    }
  }
  // the arms: the OLD Moor is two minutes early and the YOUNG one two minutes
  // late, which is the oldest joke in the city and costs one offset.
  if (venOroStrike >= 0) {
    venOroStrike += dt;
    if (venOroStrike > 1.4) venOroStrike = -1;
  }
  const sw = (o) => {
    if (venOroStrike < 0) return 0;
    const t = clamp((venOroStrike - o) / 0.5, 0, 1);
    return Math.sin(t * Math.PI) * 1.15;
  };
  if (venOroMoorA && venOroMoorA.userData.arm) venOroMoorA.userData.arm.rotation.x = -0.4 - sw(0);
  if (venOroMoorB && venOroMoorB.userData.arm) venOroMoorB.userData.arm.rotation.x = -0.4 - sw(0.34);
}

// ================================================================ THE CAFE ==
/**
 * Florian's, under the south arcade, with the little orchestra's chairs out and
 * five tables that have somebody's spritz on them. The spritz is the chapter's
 * second task for the reason every chapter's second task is what it is: it is a
 * theft you can commit without walking anywhere, in the first ten seconds, and
 * it teaches the grab key to anybody who arrived here first.
 */
function venBuildCafe(game, root) {
  const grp = new THREE.Group();
  const M = venMerger();
  const gy = venTerrain(venCAFE.x, venCAFE.z);
  // ---- THE TABLES USED TO RUN ACROSS THE ARCADE --------------------------
  // `x = venCAFE.x + (i - 2) * 3.2` laid five tables along X, and the west
  // Procuratie runs along Z: three of the five were inside the building and one
  // was in the middle of the square. A row of café tables runs ALONG the
  // façade it belongs to, which is the same lesson as the square itself.
  for (let i = 0; i < 5; i++) {
    const x = venCAFE.x + (i % 2 ? 0.45 : -0.35);
    const z = venCAFE.z + (i - 2) * 3.0;
    M.cyl(x, gy + 0.36, z, 0.06, 0.72, PALETTE.venStoneDark, 0, 0, 0, 6);
    M.cyl(x, gy + 0.74, z, 0.52, 0.06, PALETTE.venTrim, 0, 0, 0, 8);
    // two chairs
    for (let k = 0; k < 2; k++) {
      const a = k ? 2.5 : -0.5;
      const cxp = x + Math.sin(a) * 1.0, czp = z + Math.cos(a) * 1.0;
      M.box(cxp, gy + 0.42, czp, 0.44, 0.05, 0.44, PALETTE.venShutter2);
      M.box(cxp - Math.sin(a) * 0.2, gy + 0.68, czp - Math.cos(a) * 0.2, 0.44, 0.5, 0.06,
            PALETTE.venShutter2, 0, a);
      for (let l = 0; l < 4; l++) {
        M.cyl(cxp + (l & 1 ? 0.17 : -0.17), gy + 0.2, czp + (l & 2 ? 0.17 : -0.17), 0.025, 0.4,
              PALETTE.venShutter2, 0, 0, 0, 4);
      }
    }
    // and the spritz. Orange, in a stemmed glass, with an olive in it.
    M.cyl(x + 0.12, gy + 0.86, z, 0.055, 0.2, PALETTE.venTrim, 0, 0, 0, 6);
    M.cyl(x + 0.12, gy + 1.05, z, 0.13, 0.22, PALETTE.venBriccolaR, 0, 0, 0, 8);
    M.sph(x + 0.12, gy + 1.18, z, 0.045, 0.045, 0.045, PALETTE.venShutter);
  }
  // ---- AND THE LITTLE ORCHESTRA -------------------------------------------
  // Florian's has had a band on the pavement since the eighteenth century and
  // it plays through the acqua alta with its shoes off, which is the single
  // most Venetian fact available to this chapter. Four chairs on a low platform
  // under the arcade, a double bass on its side, a cello, two stands. The
  // violinist is a local — see venBuild — so the band is a person, not a prop.
  {
    const ox = venCAFE.x + 0.1, oz = venCAFE.z + 9.6;
    M.box(ox, gy + 0.09, oz, 3.4, 0.18, 4.2, PALETTE.venStoneDark);
    for (let k = 0; k < 4; k++) {
      const a = -0.9 + k * 0.6;
      const cxp = ox + Math.sin(a) * 1.15, czp = oz + Math.cos(a) * 1.15;
      M.box(cxp, gy + 0.62, czp, 0.42, 0.05, 0.42, PALETTE.venShutter2);
      M.box(cxp - Math.sin(a) * 0.19, gy + 0.88, czp - Math.cos(a) * 0.19, 0.42, 0.52, 0.06,
            PALETTE.venShutter2, 0, a);
      // a music stand in front of each, with the page catching the arcade light
      M.cyl(cxp - Math.sin(a) * 1.0, gy + 0.62, czp - Math.cos(a) * 1.0, 0.03, 1.0,
            PALETTE.venStoneDark, 0, 0, 0, 4);
      M.box(cxp - Math.sin(a) * 1.0, gy + 1.16, czp - Math.cos(a) * 1.0, 0.42, 0.34, 0.05,
            PALETTE.venStone, -0.5, a);
    }
    // the double bass, lying down where a bass always is between numbers
    M.sph(ox + 1.5, gy + 0.5, oz - 1.4, 0.36, 0.3, 0.62, PALETTE.venGondolaTr);
    M.cyl(ox + 1.5, gy + 0.5, oz - 2.6, 0.06, 1.4, PALETTE.venGondola, Math.PI * 0.5, 0, 0, 6);
    M.box(ox + 1.5, gy + 0.5, oz - 3.4, 0.16, 0.1, 0.4, PALETTE.venGondola);
  }
  const mesh = new THREE.Mesh(M.build(), venVC());
  mesh.castShadow = true;
  grp.add(mesh);
  root.add(grp);
  venCafeGroup = grp;
}

// ================================================================= THE CALLI =
/**
 * A small dense maze, because the other half of Venice is the half where you
 * cannot see anything. Lanes three metres wide between blocks twelve metres
 * tall; a rio straight through the middle of it with two bridges over it; and
 * one campo at the far end with a well in it, which is where the duckboards
 * come out.
 *
 * It is deliberately SMALL. Marrakech already has the definitive maze in this
 * game and it is a whole chapter; this is a texture, and a place for the boards
 * to go, and thirty seconds of not being able to see the campanile.
 */
function venBuildCalli(game, root) {
  const M = venMerger();
  const walls = [];
  const shutters = [];
  const cols = [PALETTE.venPlaster1, PALETTE.venPlaster2, PALETTE.venPlaster3,
                PALETTE.venPlaster4, PALETTE.venPlaster5, PALETTE.venBrick];
  const CELL = 7.0, LANE = 3.0;
  const nx = Math.floor((venCAL_X1 - venCAL_X0) / CELL);
  const nz = Math.floor((venCAL_Z1 - venCAL_Z0) / CELL);
  let seed = 20260819;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const cx = venCAL_X0 + (i + 0.5) * CELL;
      const cz = venCAL_Z0 + (j + 0.5) * CELL;
      // never build across the rio, and never inside the campo
      if (Math.abs(cx - venRIO_X) < venRIO_W * 0.5 + 2.4) continue;
      const dcx = cx - venCAMPO.x, dcz = cz - venCAMPO.z;
      if (dcx * dcx + dcz * dcz < 8.5 * 8.5) continue;
      if (rnd() < 0.13) continue;                       // the odd small square
      const w = CELL - LANE, d = CELL - LANE;
      const h = 9 + rnd() * 7;
      const c = cols[(i * 3 + j * 5) % cols.length];
      const gy = venTerrain(cx, cz);
      M.box(cx, gy + h * 0.5, cz, w, h, d, c);
      M.box(cx, gy + h + 0.25, cz, w + 0.7, 0.5, d + 0.7, PALETTE.venRoof);
      M.box(cx, gy + h + 0.75, cz, w * 0.9, 0.5, d * 0.9, PALETTE.venRoofDark);
      // ---- A VENETIAN CHIMNEY, and one per building --------------------
      // The camini are the skyline of this city and the calli had none at
      // all: forty flat-topped boxes in six colours, which from any camera
      // above three metres is a housing estate. The inverted cone with the
      // cap on it is unique to this lagoon and it is eight boxes.
      {
        const kx = cx + (rnd() - 0.5) * (w - 1.4), kz = cz + (rnd() - 0.5) * (d - 1.4);
        const ky = gy + h + 1.0;
        M.box(kx, ky + 0.9, kz, 0.7, 1.8, 0.7, c);
        for (let k = 0; k < 3; k++) {
          M.box(kx, ky + 1.85 + k * 0.34, kz, 0.78 + k * 0.34, 0.36, 0.78 + k * 0.34, c);
        }
        for (let s2 = -1; s2 <= 1; s2 += 2) {
          M.box(kx + s2 * 0.56, ky + 3.0, kz, 0.2, 0.6, 0.24, c);
        }
        M.box(kx, ky + 3.4, kz, 1.7, 0.28, 1.2, PALETTE.venRoofDark);
      }
      // ---- and a door at the bottom of it -------------------------------
      // Forty buildings twelve metres tall with shutters up the sides and no
      // way in. A lane in this city is a wall of doors: a stone frame, a
      // step, a dark leaf and a number over it.
      {
        const dsg = rnd() < 0.5 ? -1 : 1;
        const dz2 = cz + (rnd() - 0.5) * (d - 2.2);
        M.box(cx + dsg * (w * 0.5 + 0.05), gy + 1.15, dz2, 0.14, 2.3, 1.15,
              PALETTE.venShutter2);
        M.box(cx + dsg * (w * 0.5 + 0.13), gy + 1.2, dz2, 0.2, 2.6, 1.55, PALETTE.venStone);
        M.box(cx + dsg * (w * 0.5 + 0.14), gy + 1.18, dz2, 0.22, 2.2, 1.15, 0x2f2c27);
        M.box(cx + dsg * (w * 0.5 + 0.15), gy + 0.08, dz2, 0.5, 0.16, 1.5, PALETTE.venStoneWet);
        M.box(cx + dsg * (w * 0.5 + 0.2), gy + 2.7, dz2, 0.1, 0.3, 0.3, PALETTE.venBriccolaW);
      }
      // shutters, which are the only detail at this distance that reads
      for (let s = 0; s < 3; s++) {
        const yy = gy + 2.6 + s * 3.0;
        if (yy > gy + h - 1.2) break;
        shutters.push(cx - w * 0.5 - 0.06, yy, cz - 1.4, 0, 0, 0, 0.1, 1.5, 0.85);
        shutters.push(cx - w * 0.5 - 0.06, yy, cz + 1.4, 0, 0, 0, 0.1, 1.5, 0.85);
        shutters.push(cx + w * 0.5 + 0.06, yy, cz, 0, 0, 0, 0.1, 1.5, 0.85);
      }
      walls.push([cx, gy + h * 0.5, cz, w, h, d]);
    }
  }

  // ---- the rio, its banks, and the bridges --------------------------------
  for (let k = 0; k < venRIO_BRIDGES.length; k++) {
    const z = venRIO_BRIDGES[k];
    const gy = venCITY_Y;
    // a little humped stone bridge: three flat steps up, a span, three down
    for (let i = -2; i <= 2; i++) {
      const x = venRIO_X + i * 2.1;
      const rise = (3 - Math.abs(i)) * 0.34;
      M.box(x, gy + rise + 0.15, z, 2.15, 0.34, 3.6, PALETTE.venStone);
      M.box(x, gy + rise + 0.62, z - 1.85, 2.15, 0.62, 0.22, PALETTE.venStoneWet);
      M.box(x, gy + rise + 0.62, z + 1.85, 2.15, 0.62, 0.22, PALETTE.venStoneWet);
      venStaticBox(game, x, gy + rise, z, 2.2, 0.4, 3.6);
    }
  }
  // the rio's own retaining walls, so nothing falls sideways into it forever —
  // WHICH THEY DID NOT DO, because they had no collider. Sixty metres of stone
  // standing 42 cm proud of the fondamenta on each side of the side canal, and
  // the animal walked through both of them into the water. Forty-two is the
  // worst possible number for this: the capybara steps over forty, so it is
  // too high to climb and too low to read as a wall, which is exactly the size
  // of thing that looks like a bug (see Sydney's bollards). Solid now, with a
  // gap at each bridge so the two crossings still cross.
  for (let s = -1; s <= 1; s += 2) {
    const x = venRIO_X + s * (venRIO_W * 0.5 + 0.4);
    M.box(x, venCITY_Y - 1.4, (venCAL_Z0 + venCAL_Z1) * 0.5, 0.8, 3.2,
          venCAL_Z1 - venCAL_Z0, PALETTE.venStoneWet);
    // THE GAP IS THE BRIDGE'S WIDTH AND NOT A METRE MORE. The deck is 3.6 m
    // across, so ±1.9 clears it — and the ±2.4 that used to be here left a
    // metre of DRAWN retaining wall with no collider behind it at each end of
    // each crossing, on ground that is already sloping into the rio.
    // (qa/wq-solid.js clustered four separate hits at exactly those four
    // places and nothing else in the calli.)
    const cuts = [venCAL_Z0];
    for (let k = 0; k < venRIO_BRIDGES.length; k++) {
      cuts.push(venRIO_BRIDGES[k] - 1.9, venRIO_BRIDGES[k] + 1.9);
    }
    cuts.push(venCAL_Z1);
    for (let k = 0; k + 1 < cuts.length; k += 2) {
      const z0 = cuts[k], z1 = cuts[k + 1];
      if (z1 - z0 < 0.5) continue;
      venStaticBox(game, x, venCITY_Y - 1.4, (z0 + z1) * 0.5, 0.8, 3.2, z1 - z0);
    }
  }

  // ---- WASHING ACROSS THE LANE --------------------------------------------
  // The one thing a photograph of a Venetian calle always has in it that this
  // maze did not: a line strung between two windows six metres up with four
  // shirts on it. It is also the only thing in the calli above eye level and
  // below the roof, so it is what gives a three-metre lane a ceiling.
  const WASH = [PALETTE.venBriccolaW, PALETTE.venShutter, PALETTE.venPlaster3,
                PALETTE.venMosaic, PALETTE.venBriccolaR, PALETTE.venTrim];
  for (let i = 0; i + 1 < walls.length; i++) {
    const a2 = walls[i], b2 = walls[i + 1];
    // neighbours across a lane in z: same x, one cell apart
    if (Math.abs(a2[0] - b2[0]) > 0.5) continue;
    const gap = b2[2] - a2[2];
    if (gap < 5 || gap > 9) continue;
    if ((i * 7) % 5 > 1) continue;                     // one lane in three
    const ly = venCITY_Y + 5.2 + (i % 3) * 0.6;
    const z0 = a2[2] + a2[5] * 0.5, z1 = b2[2] - b2[5] * 0.5;
    M.box(a2[0], ly, (z0 + z1) * 0.5, 0.05, 0.05, z1 - z0, PALETTE.venPassLeg);
    for (let k = 0; k < 4; k++) {
      const zz = lerp(z0 + 0.5, z1 - 0.5, (k + 0.5) / 4);
      const tw = Math.sin(i * 1.7 + k) * 0.09;
      M.box(a2[0], ly + 0.04, zz, 0.09, 0.15, 0.05, PALETTE.venPassLeg);
      M.box(a2[0], ly - 0.52, zz, 0.86, 1.0, 0.06, WASH[(i * 3 + k) % WASH.length], 0, 0, tw);
      // a sleeve, so a shirt is a shirt and not a flag
      if (k % 2) {
        M.box(a2[0], ly - 0.42, zz + 0.42, 0.62, 0.55, 0.05,
              WASH[(i * 3 + k) % WASH.length], 0, 0, tw + 0.25);
      }
    }
  }

  // ---- A BOAT IN THE RIO --------------------------------------------------
  // Every side canal in this city is full of somebody's boat and this one had
  // sixty metres of water with nothing on it. Two topi moored against the
  // fondamenta on a pair of rings, low in the water, with a tarpaulin over one
  // of them — which is also the only thing that tells you at a glance which
  // way down the rio is a canal and not a ditch.
  // ---- AND THEY FLOAT. ----------------------------------------------------
  // A moored boat in a city with a metre and a half of tide in it is the one
  // object that MUST ride the water, and it is also the cheapest possible
  // proof that the sheet is water: at low tide these sit four feet down inside
  // their own canal walls and at the top of the flood their gunwales are level
  // with the fondamenta. Everything below is authored with y = 0 AT THE
  // WATERLINE and lives in venFloatM, whose group is lifted to venWaterY once
  // a frame. Anything that is driven into the BED — the briccole — or bolted
  // to the bank — the rings — stays in the static merger where it belongs.
  const F = venFloatM;
  for (let bI = 0; bI < 2; bI++) {
    const bz2 = bI ? -30 : -4;
    const side = bI ? 1 : -1;
    const bx2 = venRIO_X + side * (venRIO_W * 0.5 - 1.1);
    for (let k = 0; k < 8; k++) {
      const t = k / 7;
      const taper = Math.sin(t * Math.PI);
      F.box(bx2, -0.30, bz2 + (t - 0.5) * 6.4, 0.35 + taper * 0.85, 0.9, 0.85,
            PALETTE.venGondolaTr);
      F.box(bx2, 0.17, bz2 + (t - 0.5) * 6.4, 0.4 + taper * 0.9, 0.08, 0.82,
            bI ? PALETTE.venShutter : PALETTE.venBriccolaR);
    }
    F.box(bx2, 0.32, bz2 - 3.5, 0.35, 1.0, 0.3, PALETTE.venGondolaTr, 0.3);
    if (bI) {
      F.box(bx2, 0.62, bz2 + 0.6, 1.5, 0.3, 3.4, PALETTE.venAwning);
      F.box(bx2, 0.85, bz2 + 0.6, 1.0, 0.3, 3.0, PALETTE.venAwning);
    } else {
      for (let k = 0; k < 5; k++) {
        F.box(bx2 + rand(-0.3, 0.3), 0.38 + (k % 2) * 0.22, bz2 + rand(-2, 2),
              0.5, 0.32, 0.5, PALETTE.venBriccola, 0, rand(0, 3), 0);
      }
    }
    // the mooring ring on the fondamenta, and a pole to tie to
    M.cyl(venRIO_X + side * (venRIO_W * 0.5 + 0.9), venCITY_Y - 0.1, bz2 - 3.2,
          0.16, 0.1, PALETTE.venFerro, Math.PI * 0.5, 0, 0, 8);
    M.cyl(venRIO_X + side * (venRIO_W * 0.5 - 0.2), -0.4, bz2 + 3.4, 0.15, 4.2,
          PALETTE.venBriccola, 0, 0, 0.02, 6);
  }

  // ---- the campo, and its wellhead ----------------------------------------
  {
    const cx = venCAMPO.x, cz = venCAMPO.z, gy = venCITY_Y;
    M.cyl(cx, gy + 0.06, cz, 8.5, 0.12, PALETTE.venStoneDark, 0, 0, 0, 8);
    M.cyl(cx, gy + 0.55, cz, 0.95, 1.1, PALETTE.venStone, 0, 0, 0, 8);
    M.cyl(cx, gy + 1.15, cz, 1.05, 0.16, PALETTE.venStoneWet, 0, 0, 0, 8);
    for (let i = 0; i < 2; i++) {
      M.box(cx + (i ? 1.0 : -1.0), gy + 2.1, cz, 0.16, 2.0, 0.16, PALETTE.venFerro);
    }
    M.box(cx, gy + 3.1, cz, 2.3, 0.14, 0.14, PALETTE.venFerro);
    venStaticBox(game, cx, gy + 0.55, cz, 1.9, 1.1, 1.9);
  }

  const mesh = new THREE.Mesh(M.build(), venVC());
  mesh.castShadow = true; mesh.receiveShadow = true;
  root.add(mesh);
  venInstance(root, venG.box, PALETTE.venShutter, shutters, false, false);

  for (let i = 0; i < walls.length; i++) {
    const w = walls[i];
    venStaticBox(game, w[0], w[1], w[2], w[3], w[4], w[5]);
  }
}

// ========================================================== THE GRAND CANAL =
/**
 * Palazzi down both banks, mooring poles in the water, and the Rialto over the
 * middle of it. The banks are read off the same table the water is cut with, so
 * a palazzo can never end up standing in the channel — which is the failure mode
 * of every hand-placed riverside building this codebase has ever had.
 */
function venBuildCanal(game, root) {
  const M = venMerger();
  const poles = [];
  const cols = [PALETTE.venPlaster1, PALETTE.venPlaster2, PALETTE.venPlaster3,
                PALETTE.venPlaster4, PALETTE.venPlaster5];
  let seed = 991;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }

  const half = venCANAL_W * 0.5;
  for (let s = 0; s < 26; s++) {
    const t = 0.045 + s * (0.92 / 25);
    venLinePoint(venCanX, venCanZ, venCanS, venCanLen, t, venLineOut);
    const yaw = venLineOut.yaw;
    const nxx = Math.cos(yaw), nzz = -Math.sin(yaw);       // the canal's normal
    for (let side = -1; side <= 1; side += 2) {
      // don't build over the Rialto's own footprint
      if (Math.abs(t - venRIALTO_S) < 0.035) continue;
      const off = half + 3.4 + rnd() * 1.4;
      const bx = venLineOut.x + nxx * off * side;
      const bz = venLineOut.z + nzz * off * side;
      if (bz > venLAGOON_Z - 4) continue;
      // a palazzo is three storeys, a water door, and a row of pointed windows
      const w = 7.5 + rnd() * 3.5, h = 11 + rnd() * 6;
      const c = cols[(s * 2 + (side > 0 ? 1 : 0)) % cols.length];
      // SINK IT. Placed with its base exactly on the bank level, a palazzo
      // floats the moment the ground under it is a heightfield sample rather
      // than the analytic value — and a row of palazzi hanging two feet over
      // their own fondamenta is the most conspicuous thing in the chapter.
      // A metre and a half into the ground costs nothing and can never float.
      M.box(bx, venFOND_Y + h * 0.5 - 1.6, bz, w, h, 9, c, 0, yaw);
      M.box(bx, venFOND_Y + h - 1.15, bz, w + 0.8, 0.55, 9.8, PALETTE.venRoof, 0, yaw);
      // the water door, at the bottom, which is the whole point of the place
      const dx2 = bx - nxx * 4.6 * side, dz2 = bz - nzz * 4.6 * side;
      M.box(dx2, venFOND_Y + 0.9, dz2, 2.2, 2.8, 0.4, PALETTE.venShutter, 0, yaw);
      M.cyl(dx2, venFOND_Y + 2.3, dz2, 1.1, 0.4, PALETTE.venStone, Math.PI * 0.5, yaw, 0, 8);
      // ---- A VENETIAN WINDOW IS AN OGEE, NOT A BOX IN A HAT ---------------
      // Fifty palazzi carried a 1.1 x 2.0 slab of blue with a four-sided cone
      // balanced on top of it — which from the water is a filing cabinet
      // wearing a party hat, and it is the same mistake San Marco's lunettes
      // made (a head drawn ACROSS an opening rather than AS it). The head is
      // part of the hole: the dark goes up into the point, the stone frame
      // follows it, and the piano nobile gets the little balcony every one of
      // these buildings has — which is the thing that says which floor is the
      // grand one, and it is the only reason a palazzo is not a warehouse.
      // ---- AND IT IS PAID FOR WHERE IT IS SEEN ----------------------------
      // Fifty palazzi times nine windows is four hundred and fifty of them, so
      // the full ogee — pane, four steps of head, two jambs, ten arch stones
      // and a sill — costs NINETY-SEVEN THOUSAND TRIANGLES, three quarters of
      // this chapter's whole budget spent on buildings that are mostly a
      // hundred metres away behind other buildings. Measured, 23 Aug 2026.
      //
      // So it is authored twice. The eight palazzi around the Rialto — which
      // is where the player stands, where the fourth task is, and the only
      // stretch of this canal anybody looks AT rather than along — get the
      // whole thing. The other forty-two get the four boxes that carry the
      // silhouette: a pointed dark hole and a sill.
      const across = Math.sin(yaw + Math.PI * 0.5), acrz = Math.cos(yaw + Math.PI * 0.5);
      const grand = Math.abs(t - venRIALTO_S) < 0.16;
      for (let f = 0; f < 3; f++) {
        const yy = venFOND_Y + 4.2 + f * 3.4;
        if (yy > venFOND_Y + h - 3.2) break;
        for (let k = -1; k <= 1; k++) {
          const wx = bx - nxx * 4.55 * side + across * k * 2.2;
          const wz = bz - nzz * 4.55 * side + acrz * k * 2.2;
          M.box(wx, yy, wz, 1.0, 2.1, 0.32, 0x2b3038, 0, yaw);
          const hn = grand ? 4 : 1;
          for (let a2 = 0; a2 < hn; a2++) {
            const t2 = (a2 + 0.5) / hn;
            M.box(wx, yy + 1.05 + t2 * 0.95, wz, 1.0 * (1 - t2 * t2), 0.95 / hn + 0.06, 0.32,
                  0x2b3038, 0, yaw);
          }
          M.box(wx, yy - 1.16, wz, 1.5, 0.2, 0.55, PALETTE.venStone, 0, yaw);
          if (!grand) continue;
          for (let s2 = -1; s2 <= 1; s2 += 2) {
            M.box(wx + across * s2 * 0.62, yy - 0.1, wz + acrz * s2 * 0.62,
                  0.24, 2.4, 0.42, PALETTE.venStone, 0, yaw);
          }
          for (let a2 = 0; a2 < 3; a2++) {
            const t2 = (a2 + 0.5) / 3;
            const hw = 0.62 * (1 - t2 * t2 * 0.94);
            for (let s2 = -1; s2 <= 1; s2 += 2) {
              M.box(wx + across * s2 * hw, yy + 1.1 + t2 * 1.0, wz + acrz * s2 * hw,
                    0.24, 0.44, 0.42, PALETTE.venStone, 0, yaw);
            }
          }
        }
        // the balcony on the piano nobile, on its own two corbels
        if (f === 0 && (grand || s % 2 === 0)) {
          const bxc = bx - nxx * 4.8 * side, bzc = bz - nzz * 4.8 * side;
          M.box(bxc, yy - 1.4, bzc, 6.4, 0.2, 1.0, PALETTE.venStone, 0, yaw);
          for (let k2 = 0; k2 < 9; k2++) {
            const ox2 = (k2 - 4) * 0.72;
            M.cyl(bxc + across * ox2, yy - 0.9, bzc + acrz * ox2, 0.11, 0.8,
                  PALETTE.venStone, 0, 0, 0, 6);
          }
          M.box(bxc, yy - 0.46, bzc, 6.4, 0.18, 0.44, PALETTE.venStone, 0, yaw);
          for (let s2 = -1; s2 <= 1; s2 += 2) {
            M.box(bx - nxx * 4.45 * side + across * s2 * 2.9, yy - 1.68,
                  bz - nzz * 4.45 * side + acrz * s2 * 2.9,
                  0.34, 0.5, 0.7, PALETTE.venStone, 0, yaw);
          }
        }
      }
      // the bank wall below it
      M.box(venLineOut.x + nxx * (half + 0.7) * side, venFOND_Y * 0.5 - 1.6,
            venLineOut.z + nzz * (half + 0.7) * side,
            2.6, 5.6, 5.0, PALETTE.venStoneWet, 0, yaw);
      // AND THE PALAZZO IS SOLID. Fifty buildings eleven to seventeen metres
      // tall were drawn down both banks of the Grand Canal and not one of them
      // carried a collider: the calli got theirs in the loop that builds them,
      // and this loop — written later, doing the same job — never got the same
      // line. Measured over a 5 m grid, FIFTY-THREE of Venice's walkable squares
      // had a wall within reach that the animal walked straight through, which
      // is more than every other solidity failure in the city put together.
      // The box matches the DRAWN one exactly — same centre, same extents, same
      // yaw — so the solid thing and the seen thing cannot disagree.
      venStaticBox(game, bx, venFOND_Y + h * 0.5 - 1.6, bz, w, h, 9, yaw);
    }
    // briccole: mooring poles, in threes, painted like barbers' shops
    if (s % 3 === 0) {
      for (let k = 0; k < 3; k++) {
        const off = half - 1.6 - k * 0.55;
        const side = (s % 6 === 0) ? 1 : -1;
        const bx = venLineOut.x + nxx * off * side + rnd() * 0.4;
        const bz = venLineOut.z + nzz * off * side + rnd() * 0.4;
        if (bz > venLAGOON_Z - 2) continue;
        M.cyl(bx, -0.6, bz, 0.19, 6.0, PALETTE.venBriccola, rnd() * 0.05, 0, rnd() * 0.06, 6);
        for (let b = 0; b < 3; b++) {
          M.cyl(bx, 1.0 + b * 0.7, bz, 0.205, 0.34,
                b % 2 ? PALETTE.venBriccolaW : PALETTE.venBriccolaR, 0, 0, 0, 6);
        }
        M.sph(bx, 2.5, bz, 0.22, 0.26, 0.22, PALETTE.venBriccola);
      }
    }
  }

  // ---- THE FRUIT BOAT, AND IT IS SOMEBODY'S SHOP --------------------------
  // There has been a local standing on this fondamenta since 21 Aug saying
  // 'the boat is the shop, it has been the shop since my grandmother' with
  // eighteen metres of empty green water behind him. A local whose whole
  // character is an OBJECT and the object is not there is the same failure the
  // seed man had — he said 'watch' and nothing happened.
  //
  // So: a barge against the bank at his elbow, a canopy over it, and about
  // ninety pieces of fruit in crates. It is the only saturated colour on the
  // Grand Canal and it is thirty metres from where the chapter's fourth task
  // sends you.
  {
    const n = venNearLine(venCanX, venCanZ, venCanS, venCanLen, -95, -17);
    venLinePoint(venCanX, venCanZ, venCanS, venCanLen, n.t, venLineOut);
    const yaw = venLineOut.yaw;
    const nxx = Math.cos(yaw), nzz = -Math.sin(yaw);
    const side = n.side > 0 ? 1 : -1;
    const bx2 = venLineOut.x + nxx * (half - 1.7) * side;
    const bz2 = venLineOut.z + nzz * (half - 1.7) * side;
    const ax2 = Math.sin(yaw), az2 = Math.cos(yaw);
    // AUTHORED FROM THE WATERLINE, in venFloatM — see the note on the rio's
    // two topi. A greengrocer's barge that stayed at a fixed y would be a
    // metre under the Grand Canal at the top of every tide.
    const F = venFloatM;
    // the hull: nine metres, flat-bottomed, sitting low
    for (let i = 0; i < 9; i++) {
      const t = i / 8, taper = Math.sin(t * Math.PI) * 0.5 + 0.5;
      F.box(bx2 + ax2 * (t - 0.5) * 9, -0.35, bz2 + az2 * (t - 0.5) * 9,
            2.5 * taper, 0.9, 1.15, PALETTE.venGondolaTr, 0, yaw);
      F.box(bx2 + ax2 * (t - 0.5) * 9, 0.16, bz2 + az2 * (t - 0.5) * 9,
            2.6 * taper, 0.12, 1.1, PALETTE.venShutter, 0, yaw);
    }
    // the canopy, on four poles, striped
    for (let s2 = -1; s2 <= 1; s2 += 2) {
      for (let e = -1; e <= 1; e += 2) {
        F.cyl(bx2 + ax2 * e * 3.0 + nxx * side * s2 * 0.95, 1.15,
              bz2 + az2 * e * 3.0 + nzz * side * s2 * 0.95, 0.05, 2.0,
              PALETTE.venFerro, 0, 0, 0, 6);
      }
    }
    for (let k = 0; k < 10; k++) {
      F.box(bx2 + ax2 * (k - 4.5) * 0.72, 2.2, bz2 + az2 * (k - 4.5) * 0.72,
            0.72, 0.09, 2.4, k % 2 ? PALETTE.venBriccolaW : PALETTE.venBriccolaR, 0, yaw);
    }
    // the crates, and what is in them
    const FRUIT = [0xc4574c, 0xd8b45c, 0x6f8a72, 0xb8543a, 0xd8cdb4, 0x8f6b4a];
    let fs2 = 1717;
    const frnd = () => { fs2 = (fs2 * 1103515245 + 12345) & 0x7fffffff; return fs2 / 0x7fffffff; };
    for (let c = 0; c < 8; c++) {
      const t = (c % 4 - 1.5) * 1.6, s3 = c < 4 ? -0.55 : 0.55;
      const cxp = bx2 + ax2 * t + nxx * side * s3;
      const czp = bz2 + az2 * t + nzz * side * s3;
      F.box(cxp, 0.52, czp, 1.35, 0.5, 0.95, PALETTE.venBriccola, 0, yaw);
      for (let f = 0; f < 7; f++) {
        F.sph(cxp + ax2 * (frnd() - 0.5) * 1.0 + nxx * (frnd() - 0.5) * 0.6, 0.82,
              czp + az2 * (frnd() - 0.5) * 1.0 + nzz * (frnd() - 0.5) * 0.6,
              0.15, 0.13, 0.15, FRUIT[(c + f) % FRUIT.length]);
      }
      // a slate with a price on it, leaning on the crate
      if (c % 3 === 0) {
        F.box(cxp, 0.96, czp - 0.5, 0.5, 0.36, 0.06, PALETTE.venGondola, -0.3, yaw);
      }
    }
    // a set of brass scales hanging off the canopy, because there always is
    F.cyl(bx2 + ax2 * 1.2, 1.72, bz2 + az2 * 1.2, 0.02, 0.9, PALETTE.venFerro, 0, 0, 0, 4);
    F.box(bx2 + ax2 * 1.2, 1.26, bz2 + az2 * 1.2, 0.62, 0.04, 0.04, PALETTE.venGold, 0, yaw);
    for (let s2 = -1; s2 <= 1; s2 += 2) {
      F.cyl(bx2 + ax2 * (1.2 + s2 * 0.3), 1.12, bz2 + az2 * (1.2 + s2 * 0.3), 0.16, 0.06,
            PALETTE.venGold, 0, 0, 0, 8);
    }
    // and the ring it is tied to
    M.cyl(venLineOut.x + nxx * (half + 0.3) * side, venFOND_Y - 0.15,
          venLineOut.z + nzz * (half + 0.3) * side, 0.17, 0.1, PALETTE.venFerro,
          Math.PI * 0.5, 0, 0, 8);
    venFRUIT.x = bx2; venFRUIT.z = bz2;
    venFRUIT.lx = venLineOut.x + nxx * (half + 2.2) * side;
    venFRUIT.lz = venLineOut.z + nzz * (half + 2.2) * side;
    venFRUIT.face = Math.atan2(bx2 - venFRUIT.lx, bz2 - venFRUIT.lz);
  }

  // ---- THE RIALTO ---------------------------------------------------------
  // One arch, a flight of steps up each side, and the two rows of little shops
  // along the middle of the deck that make it a street rather than a bridge.
  {
    venLinePoint(venCanX, venCanZ, venCanS, venCanLen, venRIALTO_S, venLineOut);
    const bx = venLineOut.x, bz = venLineOut.z, yaw = venLineOut.yaw;
    const nxx = Math.cos(yaw), nzz = -Math.sin(yaw);
    const N = 13;
    const SPAN = venCANAL_W + 14;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const off = (t - 0.5) * SPAN;
      const y = venFOND_Y + Math.cos((t - 0.5) * Math.PI) * 4.1;
      const px2 = bx + nxx * off, pz2 = bz + nzz * off;
      // the local gradient of the arch, so the slab lies ALONG it rather than
      // across it — see venStaticBox's note on the staircase
      const grad = -4.1 * (Math.PI / SPAN) * Math.sin((t - 0.5) * Math.PI);
      const tilt = Math.atan(grad);
      M.box(px2, y - 0.25, pz2, SPAN / N + 1.4, 0.5, 12, PALETTE.venStone, 0, yaw, tilt);
      // ---- ACROSS, NOT ALONG --------------------------------------------
      // `sin(yaw + pi/2), cos(yaw + pi/2)` is `cos yaw, -sin yaw` — which is
      // (nxx, nzz), the direction the bridge RUNS IN. Everything offset by it
      // was therefore placed further up and down the deck rather than out to
      // either side of it: the parapets became two stone walls straight across
      // the walking line and the shops sat on top of them. Measured, a run at
      // the bridge stopped dead fifteen metres short every time.
      //
      // A box rotated by yaw about Y maps its own local +z to world
      // (sin yaw, cos yaw), and that IS the across direction — which is why the
      // deck box's local z is what carries the twelve-metre width. So the
      // offset has to be that same vector, and nothing else.
      const ax2 = Math.sin(yaw), az2 = Math.cos(yaw);
      M.box(px2 + ax2 * 5.7, y + 0.6, pz2 + az2 * 5.7, SPAN / N + 1.4, 1.2, 0.5, PALETTE.venStoneWet, 0, yaw, tilt);
      M.box(px2 - ax2 * 5.7, y + 0.6, pz2 - az2 * 5.7, SPAN / N + 1.4, 1.2, 0.5, PALETTE.venStoneWet, 0, yaw, tilt);
      // the shops, two rows, leaving a lane between them
      if (i > 1 && i < N - 1) {
        for (let side = -1; side <= 1; side += 2) {
          M.box(px2 + ax2 * 3.9 * side, y + 1.9, pz2 + az2 * 3.9 * side,
                SPAN / N + 0.4, 3.4, 2.6, side > 0 ? PALETTE.venPlaster3 : PALETTE.venPlaster1, 0, yaw);
          M.box(px2 + ax2 * 3.9 * side, y + 3.75, pz2 + az2 * 3.9 * side,
                SPAN / N + 0.6, 0.35, 3.0, PALETTE.venRoof, 0, yaw);
        }
      }
      venStaticBox(game, px2, y - 0.25, pz2, SPAN / N + 1.6, 0.6, 11.4, yaw, tilt);
      // ---- AND THE PARAPETS ARE SOLID -----------------------------------
      // They were drawn and not built, so a bridge twelve metres wide over a
      // canal eighteen wide had nothing at all along its edges. The real one has
      // a balustrade you could lean a horse against, and a task called 'take the
      // Rialto at a run' should be about the running.
      venStaticBox(game, px2 + ax2 * 5.7, y + 0.6, pz2 + az2 * 5.7,
                   SPAN / N + 1.6, 1.6, 0.6, yaw, tilt);
      venStaticBox(game, px2 - ax2 * 5.7, y + 0.6, pz2 - az2 * 5.7,
                   SPAN / N + 1.6, 1.6, 0.6, yaw, tilt);
    }
    // the arch underneath, which is the shape everybody knows
    for (let i = 1; i < N; i++) {
      const t = i / N;
      const off = (t - 0.5) * SPAN;
      const y = venFOND_Y + Math.cos((t - 0.5) * Math.PI) * 4.1;
      const px2 = bx + nxx * off, pz2 = bz + nzz * off;
      M.box(px2, (y - 0.5 + venCANAL_BED) * 0.5, pz2, SPAN / N + 0.4,
            Math.max(0.4, y - 0.5 - venCANAL_BED) * (1 - Math.abs(t - 0.5) * 1.55), 11,
            PALETTE.venStoneWet, 0, yaw);
    }
  }

  const mesh = new THREE.Mesh(M.build(), venVC());
  mesh.castShadow = true; mesh.receiveShadow = true;
  root.add(mesh);
}

// ========================================================== THE DUCKBOARDS ==
/**
 * Passerelle. Venice puts them out when the tide is forecast over about 110 cm
 * and takes them in again after, and while they are out they are the route:
 * everybody walks single file along a metre of scaffolding two feet above their
 * own square. That is a genuinely lovely thing to put in a game about a rodent.
 *
 * They rise into place when the siren goes and sink when the water drops, which
 * means the task attached to them CANNOT be done before the player has seen a
 * flood — a gate made out of the world rather than out of a rule.
 */
function venBuildBoards(game, root) {
  const grp = new THREE.Group();
  const M = venMerger();
  venBoardBodies = [];
  const n = venBrdX.length;
  for (let i = 0; i + 1 < n; i++) {
    const ax = venBrdX[i], az = venBrdZ[i];
    const bx = venBrdX[i + 1], bz = venBrdZ[i + 1];
    const cx = (ax + bx) * 0.5, cz = (az + bz) * 0.5;
    const len = Math.hypot(bx - ax, bz - az) + 0.25;
    const yaw = Math.atan2(bx - ax, bz - az);
    const gy = venTerrain(cx, cz);
    // three planks and two trestle legs per segment
    M.box(cx, gy + venBOARD_Y, cz, venBOARD_W, 0.16, len, PALETTE.venPasserelle, 0, yaw);
    M.box(cx, gy + venBOARD_Y + 0.1, cz, venBOARD_W - 0.5, 0.06, len, PALETTE.venPassLeg, 0, yaw);
    for (let k = -1; k <= 1; k += 2) {
      M.box(cx + Math.sin(yaw + Math.PI * 0.5) * (venBOARD_W * 0.5 - 0.14),
            gy + venBOARD_Y * 0.5, cz + Math.cos(yaw + Math.PI * 0.5) * (venBOARD_W * 0.5 - 0.14),
            0.16, venBOARD_Y, 0.16, PALETTE.venPassLeg, 0, yaw);
      M.box(cx - Math.sin(yaw + Math.PI * 0.5) * (venBOARD_W * 0.5 - 0.14),
            gy + venBOARD_Y * 0.5, cz - Math.cos(yaw + Math.PI * 0.5) * (venBOARD_W * 0.5 - 0.14),
            0.16, venBOARD_Y, 0.16, PALETTE.venPassLeg, 0, yaw);
    }
    // ONE collider per segment, and it is KINEMATIC because the whole chain
    // rises and falls. `allowSleep = false` is not optional on anything the
    // capybara stands on — a sleeping body is skipped in narrowphase and the
    // deck of a moving platform silently stops existing.
    const b = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC,
                                material: (game.mats && game.mats.ground) || undefined });
    b.addShape(new CANNON.Box(new CANNON.Vec3(venBOARD_W * 0.5, 0.11, len * 0.5)));
    b.position.set(cx, gy + venBOARD_Y - 40, cz);
    b.quaternion.setFromEuler(0, yaw, 0);
    b.allowSleep = false;
    venSyncBody(b);
    game.world.addBody(b);
    venBoardBodies.push({ body: b, y: gy + venBOARD_Y, x: cx, z: cz });
  }
  const mesh = new THREE.Mesh(M.build(), venVC());
  mesh.castShadow = true; mesh.receiveShadow = true;
  grp.add(mesh);
  grp.position.y = -40;
  grp.visible = false;
  root.add(grp);
  venBoardGroup = grp;
}

/** Where along the boards (0..1) the capybara is, or -1 if it is not on them. */
function venBoardAt(x, z) {
  if (!venBrdX) return -1;
  const n = venNearLine(venBrdX, venBrdZ, venBrdS, venBrdLen, x, z);
  return n.d < venBOARD_W * 0.5 + 1.0 ? n.t : -1;
}

// ================================================================ PIGEONS ===
/**
 * A hundred and eighty of them, on the paving, and every one is a two-box bird
 * with a head. What makes them worth the instance buffer is that they all go up
 * AT ONCE: a capybara at a dead run through the middle of San Marco is one of
 * the two or three genuinely photographable things in this chapter, and the task
 * is scored on how many were in the air together, so it is worth doing well
 * rather than merely doing.
 *
 * They come down again, and they come down where they landed, so the square
 * refills over about twenty seconds and you can go again.
 */
/**
 * A PIGEON WAS TWO BOXES, and there are a hundred and eighty of them in the
 * one shot this chapter is famous for. From the camera's nine metres a
 * 28 x 20 x 42 cm grey brick with a smaller brick in front of it is a scatter
 * of litter, and the marquee moment — all of them up at once — was a cloud of
 * gravel. The bird now has a tail, folded wings, a beak and feet; it PECKS and
 * it STRUTS; a third of them are the pale morph that actually dominates that
 * square; and it opens its wings when it goes up, which is the whole picture.
 *
 * Four merged geometries and three InstancedMeshes: body, head, and a pair of
 * spread wings scaled to nothing while the bird is on the paving. Vertex
 * colours inside each, instanceColor over the top for the morph — which
 * MULTIPLIES, so the parts are authored pale (see the Rio crowd note).
 */
function venPigeonGeo(parts) {
  const M = venMerger();
  parts(M);
  return M.build();
}
function venBuildPigeons(root) {
  venPigeonData = new Float32Array(venPIGEON_N * 10);
  // ---- the body: torso, tail, two folded wings, two feet -------------------
  const gb = venPigeonGeo((M) => {
    M.box(0, 0, 0.02, 0.24, 0.21, 0.36, 0xffffff);            // torso
    M.box(0, 0.015, -0.26, 0.15, 0.07, 0.24, 0xdedede);       // tail, cocked up
    for (let s2 = -1; s2 <= 1; s2 += 2) {
      M.box(s2 * 0.115, 0.015, -0.01, 0.05, 0.15, 0.3, 0xc6c6c6, 0, 0, s2 * 0.12);
      M.box(s2 * 0.105, -0.055, -0.12, 0.05, 0.04, 0.16, 0x9c9c9c);   // the wing bar
      M.box(s2 * 0.05, -0.14, 0.02, 0.03, 0.09, 0.03, 0xe0a08c);      // and a foot
    }
  });
  // ---- the head: crown, beak, and the neck that catches the light ---------
  const gh = venPigeonGeo((M) => {
    M.box(0, 0, 0, 0.13, 0.14, 0.15, 0xbdbdbd);
    M.box(0, -0.005, 0.105, 0.05, 0.045, 0.09, 0x6e6a66);     // beak
    M.box(0, 0.045, 0.075, 0.03, 0.03, 0.03, 0xf2f2f2);       // cere
    // THE NECK HAS TO REACH THE TORSO. At 0.12 deep and 8 cm down it stopped
    // short of a body whose front face is 18 cm ahead of its centre, so a
    // hundred and eighty heads floated a finger's width off their own birds.
    M.box(0, -0.085, -0.14, 0.115, 0.1, 0.26, 0x9fb0a8, 0.32);
  });
  // ---- and the wings, out. ONE MESH PER WING, because a flap is the two of
  // them going the SAME way and a single instance can only turn one way about
  // its own z: a shared mesh rolled about z is a bird rowing sideways.
  const wingGeo = (s2) => venPigeonGeo((M) => {
    // A PIGEON'S SPAN IS 70 CM. The first cut ran a 42 cm plate out to 26 and
    // a 30 cm one out to 52, which is a metre and a half of wing on a 32 cm
    // bird — from the ground they went past looking like gulls.
    M.box(s2 * 0.16, 0.02, -0.02, 0.26, 0.03, 0.2, 0xf0f0f0, 0, s2 * -0.2, 0);
    M.box(s2 * 0.32, 0.0, -0.07, 0.2, 0.025, 0.13, 0xc9c9c9, 0, s2 * -0.38, 0);
  });
  const mk = (geo, n) => {
    const m = new THREE.InstancedMesh(geo, mat(0xffffff, { vertexColors: true }), n);
    m.castShadow = true; m.frustumCulled = false;
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    root.add(m);
    return m;
  };
  const im = mk(gb, venPIGEON_N), ih = mk(gh, venPIGEON_N);
  const iwR = mk(wingGeo(1), venPIGEON_N), iwL = mk(wingGeo(-1), venPIGEON_N);
  let seed = 4242;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  const cA = new THREE.Color(PALETTE.venPigeon), cB = new THREE.Color(PALETTE.venPigeonDk);
  const cC = new THREE.Color(0xe6e3dc);
  for (let i = 0; i < venPIGEON_N; i++) {
    const o = i * 10;
    // scattered over the piazza, thickest in the middle where the seed is
    const x = lerp(venPZ_X0 + 3, venPZ_X1 - 3, rnd());
    const z = lerp(venPZ_Z0 + 3, venPZ_Z1 - 3, rnd());
    venPigeonData[o] = x; venPigeonData[o + 1] = z;
    venPigeonData[o + 2] = rnd() * Math.PI * 2;     // yaw
    venPigeonData[o + 3] = 0;                        // 0 down, >0 airborne
    venPigeonData[o + 4] = 0;                        // vy
    venPigeonData[o + 5] = 0;                        // y over the paving
    venPigeonData[o + 6] = 0; venPigeonData[o + 7] = 0;
    venPigeonData[o + 8] = rnd() * 9;                // when it next does something
    venPigeonData[o + 9] = rnd();                    // and what
    const r = rnd();
    const c = r < 0.3 ? cC : r < 0.62 ? cB : cA;
    for (const m of [im, ih, iwR, iwL]) {
      m.instanceColor.setXYZ(i, c.r, c.g, c.b);
      m.instanceColor.needsUpdate = true;
    }
  }
  venPigeonMesh = { body: im, head: ih, wingR: iwR, wingL: iwL };
}

/**
 * PUT THEM UP FROM SOMEWHERE THAT IS NOT THE CAPYBARA.
 *
 * The flock only ever answered two things: a run through it and the water
 * arriving. A square with a bell over it, a wire across it and a man throwing
 * seed into it needs one channel any of those can use — otherwise every
 * spectacle in the chapter happens in a room full of birds that do not react
 * to it, which is exactly the tell that the birds are scenery.
 *
 * Returns how many actually went, so a caller can decide whether it was worth
 * a sound.
 */
function venPigeonScare(x, z, r, force) {
  if (!venPigeonData) return 0;
  const r2 = r * r;
  let n = 0;
  for (let i = 0; i < venPIGEON_N; i++) {
    const o = i * 10;
    if (venPigeonData[o + 3] > 0) continue;
    const dx = venPigeonData[o] - x, dz = venPigeonData[o + 1] - z;
    const d2 = dx * dx + dz * dz;
    if (d2 > r2) continue;
    const d = Math.sqrt(d2) || 1;
    venPigeonData[o + 3] = 1;
    venPigeonData[o + 4] = rand(3.6, 6.2) * (0.6 + force * 0.6);
    venPigeonData[o + 6] = dx / d * rand(2.0, 4.6) + rand(-1, 1);
    venPigeonData[o + 7] = dz / d * rand(2.0, 4.6) + rand(-1, 1);
    venPigeonData[o + 2] = Math.atan2(venPigeonData[o + 6], venPigeonData[o + 7]);
    n++;
  }
  return n;
}

function venUpdatePigeons(game, dt) {
  if (!venPigeonMesh) return;
  venFlockX = -4 + Math.sin(venTime * 0.11) * 5.0;
  venFlockZ = -34 + Math.sin(venTime * 0.073 + 1.1) * 12.0;
  const wasUp = venPigeonUp;
  const capy = game.capy;
  const p = capy && capy.position ? capy.position : null;
  const spd = capy && capy.velocity ? Math.hypot(capy.velocity.x, capy.velocity.z) : 0;
  const scare = !!(p && spd > 2.6);
  let up = 0;
  for (let i = 0; i < venPIGEON_N; i++) {
    const o = i * 10;
    let x = venPigeonData[o], z = venPigeonData[o + 1];
    let air = venPigeonData[o + 3], vy = venPigeonData[o + 4], y = venPigeonData[o + 5];
    let vx = venPigeonData[o + 6], vz = venPigeonData[o + 7];
    const gy = venTerrain(x, z);
    // a flooded square has no pigeons standing in it, which is also true
    const wet = venWaterY > gy + 0.05;
    if (air <= 0 && (wet || (scare && p &&
        (x - p.x) * (x - p.x) + (z - p.z) * (z - p.z) < venPIGEON_R * venPIGEON_R))) {
      air = 1;
      vy = rand(4.2, 6.4);
      const dx = p ? x - p.x : 1, dz = p ? z - p.z : 0;
      const d = Math.hypot(dx, dz) || 1;
      vx = dx / d * rand(2.5, 5.0) + rand(-1, 1);
      vz = dz / d * rand(2.5, 5.0) + rand(-1, 1);
      venPigeonData[o + 2] = Math.atan2(vx, vz);
    }
    if (air > 0) {
      up++;
      vy -= 11 * dt;
      y += vy * dt;
      x += vx * dt; z += vz * dt;
      vx = damp(vx, 0, 1.1, dt); vz = damp(vz, 0, 1.1, dt);
      // keep them over the square, or the whole flock ends up inside a basilica
      if (x < venPZ_X0 + 2) { x = venPZ_X0 + 2; vx = Math.abs(vx); }
      if (x > venPZ_X1 - 2) { x = venPZ_X1 - 2; vx = -Math.abs(vx); }
      if (z < venPZ_Z0 + 2) { z = venPZ_Z0 + 2; vz = Math.abs(vz); }
      if (z > venPZ_Z1 - 2) { z = venPZ_Z1 - 2; vz = -Math.abs(vz); }
      if (y <= 0 && vy < 0) {
        // ...unless the square is under water, in which case they stay up.
        if (venWaterY > venTerrain(x, z) + 0.05) { y = Math.max(y, 2.6); vy = 0; }
        else { y = 0; vy = 0; air = 0; vx = 0; vz = 0; }
      }
      // ---- AND WHEN THE SQUARE IS UNDER, THE FLOCK WHEELS -----------------
      // This used to be one line — put the bird back at a random height with
      // almost no velocity — and what it produced was a hundred and eighty
      // birds hanging perfectly still at eighteen different altitudes with
      // their wings going, which is a cloud of flies and not a flock. It is
      // also in every frame of the chapter's marquee moment.
      //
      // A flock is ONE object. Every bird is damped toward its own place on a
      // shared ring that drifts over the square, so they arrive strung out
      // rather than in formation, the ones on the outside travel faster (which
      // is what makes a wheel look like a wheel), and the heading and the BANK
      // both come out of where the bird actually went this frame rather than
      // being authored. Nothing is synchronised except the centre.
      if (wet) {
        const ph = i * 0.7854 + venTime * (0.34 + (i % 5) * 0.012);
        const rr = 7.5 + (i % 9) * 1.7;
        const tx = venFlockX + Math.cos(ph) * rr;
        const tz = venFlockZ + Math.sin(ph) * rr * 1.9;      // the square is long
        const ty = 3.4 + (i % 6) * 1.35 + Math.sin(venTime * 0.6 + i * 1.3) * 0.7;
        const nx = damp(x, tx, 0.85 + (i % 4) * 0.1, dt);
        const nz = damp(z, tz, 0.85 + (i % 4) * 0.1, dt);
        vx = dt > 1e-5 ? (nx - x) / dt : 0;
        vz = dt > 1e-5 ? (nz - z) / dt : 0;
        x = nx; z = nz;
        y = damp(y, ty, 1.1, dt);
        vy = 0;
      }
    }
    // ---- AND WHEN IT IS NOT BEING FRIGHTENED, IT IS BUSY ------------------
    // A hundred and eighty birds standing perfectly still on their own spots is
    // a car park, not a flock. Each one runs a little clock: mostly it pecks,
    // sometimes it turns, and now and then it takes three steps. Nothing here
    // is synchronised and nothing needs a path — the square is empty paving and
    // the flock stays inside it because the walk is capped at four metres from
    // where the bird was placed.
    let peck = 0;
    if (air <= 0) {
      let t = venPigeonData[o + 8] - dt;
      const what = venPigeonData[o + 9];
      if (what > 0.72) {
        // stepping: 0.55 m/s, and it faces where it is going
        const yaw0 = venPigeonData[o + 2];
        x += Math.sin(yaw0) * 0.55 * dt; z += Math.cos(yaw0) * 0.55 * dt;
      } else if (what > 0.30) {
        peck = Math.max(0, Math.sin((1.1 - t) * 6.2)) * 0.9;
      }
      if (t <= 0) {
        t = 0.8 + rand(0, 2.6);
        venPigeonData[o + 9] = rand(0, 1);
        if (rand(0, 1) < 0.5) venPigeonData[o + 2] += rand(-1.4, 1.4);
      }
      venPigeonData[o + 8] = t;
      // ---- AND WHEN THE SEED GOES DOWN, EVERYTHING NEAR IT COMES ---------
      // Overrides the little clock above rather than replacing it, so a bird
      // already in the middle of a peck finishes it. They WALK — at three
      // times the idle speed, which is a pigeon in a hurry — because a flock
      // that flies to seed is a flock that has been frightened, and this is
      // the opposite of that.
      if (venSeedThrow >= 0 && venSeedThrow < 4.6) {
        const sdx = venSEED_AT.x - x, sdz = venSEED_AT.z - z;
        const sd2 = sdx * sdx + sdz * sdz;
        if (sd2 > 1.6 && sd2 < venSEED_PULL * venSEED_PULL) {
          const want = Math.atan2(sdx, sdz);
          let dy2 = want - venPigeonData[o + 2];
          while (dy2 > Math.PI) dy2 -= 6.28318;
          while (dy2 < -Math.PI) dy2 += 6.28318;
          venPigeonData[o + 2] += dy2 * Math.min(1, dt * 6);
          const yaw2 = venPigeonData[o + 2];
          x += Math.sin(yaw2) * 1.65 * dt;
          z += Math.cos(yaw2) * 1.65 * dt;
          peck = 0;
        } else if (sd2 <= 1.6) {
          peck = Math.max(0, Math.sin(venTime * 7.5 + i)) * 0.95;
        }
      }
      if (x < venPZ_X0 + 2 || x > venPZ_X1 - 2 || z < venPZ_Z0 + 2 || z > venPZ_Z1 - 2) {
        venPigeonData[o + 2] += 2.4; venPigeonData[o + 9] = 0.1;
        x = clamp(x, venPZ_X0 + 2.2, venPZ_X1 - 2.2);
        z = clamp(z, venPZ_Z0 + 2.2, venPZ_Z1 - 2.2);
      }
    }

    venPigeonData[o] = x; venPigeonData[o + 1] = z;
    venPigeonData[o + 3] = air; venPigeonData[o + 4] = vy; venPigeonData[o + 5] = y;
    venPigeonData[o + 6] = vx; venPigeonData[o + 7] = vz;

    // A BIRD FACES WHERE IT IS GOING, and it leans into the turn. The stored
    // yaw is the one it was launched with; in the wheel it is stale within a
    // second, and a hundred and eighty pigeons flying sideways is the tell.
    let bank = 0;
    if (air > 0) {
      const sp2 = Math.hypot(vx, vz);
      if (sp2 > 0.6) {
        const want = Math.atan2(vx, vz);
        let d2 = want - venPigeonData[o + 2];
        while (d2 > Math.PI) d2 -= 6.28318;
        while (d2 < -Math.PI) d2 += 6.28318;
        venPigeonData[o + 2] += d2 * Math.min(1, dt * 5.0);
        bank = clamp(d2 * 2.2, -0.7, 0.7);
      }
    }
    const yaw = venPigeonData[o + 2];
    const bob = air > 0 ? Math.sin(venTime * 26 + i) * 0.09 : Math.sin(venTime * 2.2 + i) * 0.012;
    const gy2 = venTerrain(x, z);
    const by = gy2 + 0.16 + y + bob;
    // the pitch is what sells the peck: the body tips forward and the head
    // goes down to the stone, which is the one gesture everybody knows
    const PS = 0.88;   // a pigeon is 32 cm long and the paving squares are 4 m
    venPigeonMesh.body.setMatrixAt(i, venXform(x, by, z, peck * 0.5, yaw, bank, PS, PS, PS));
    venPigeonMesh.head.setMatrixAt(i, venXform(x + Math.sin(yaw) * (0.15 + peck * 0.1) * PS,
      by + (0.15 - peck * 0.26) * PS, z + Math.cos(yaw) * (0.15 + peck * 0.1) * PS,
      peck * 0.75, yaw, 0, PS, PS, PS));
    // the wings are only there when it is flying, and they beat
    // AND IT DOES NOT FLAP THE WHOLE TIME. A pigeon on a wheel beats, then
    // holds its wings out and rides for a second or two; a flock where every
    // wing is going at 26 rad/s reads as a machine. The glide window is per
    // bird and drifts, so at any moment about a third of them are coasting.
    const glide = Math.sin(venTime * 0.55 + i * 2.1) > 0.35 ? 0.12 : 1;
    const beat = air > 0 ? Math.sin(venTime * 26 + i) * glide + (glide < 1 ? 0.34 : 0) : 0;
    const ws = air > 0 ? 1 : 0.0001;
    const wsR = ws * 0.88;
    venPigeonMesh.wingR.setMatrixAt(i, venXform(x, by + 0.05, z, 0, yaw, beat * 0.75, wsR, wsR, wsR));
    venPigeonMesh.wingL.setMatrixAt(i, venXform(x, by + 0.05, z, 0, yaw, -beat * 0.75, wsR, wsR, wsR));
  }
  venPigeonMesh.body.instanceMatrix.needsUpdate = true;
  venPigeonMesh.head.instanceMatrix.needsUpdate = true;
  venPigeonMesh.wingR.instanceMatrix.needsUpdate = true;
  venPigeonMesh.wingL.instanceMatrix.needsUpdate = true;

  // ---- AND A HUNDRED AND EIGHTY BIRDS DO NOT LEAVE IN SILENCE -------------
  // The one shot this chapter is famous for was mute: the whole flock came off
  // the paving with no sound at all, in a game where a single prop landing on
  // a kerb gets a thud. A take-off is a CLATTER — it is dozens of wings
  // starting within a fifth of a second of each other — so it is three rustles
  // a fifth of a second apart, pitched by how many went, and it is throttled by
  // the jump in the airborne count rather than fired per bird.
  // AND THE COOLDOWN IS THE WHOLE OF IT. At a jump of 6 and 0.55 s between
  // bursts the wire alone — which scares a twelve-metre disc of birds nine
  // times a second for twenty-two seconds — measured SEVENTY-THREE rustles in
  // a forty-four second soak, and after routing the wire through this one
  // voice it was still forty-one. A take-off you hear once every three
  // seconds is not a take-off, it is a hiss. Fourteen birds and 1.9 s, and
  // the tail is two claps rather than three.
  const jump = up - wasUp;
  if (jump > 14 && venClatter <= 0) {
    venClatter = 1.9;
    const k = clamp(jump / 90, 0.2, 1);
    venSfx('rustle', { volume: 0.30 + k * 0.55, pitch: 1.5 - k * 0.35 });
    venClatterN = 1;
    venClatterV = 0.22 + k * 0.4;
  }
  if (venClatter > 0) {
    venClatter -= dt;
    if (venClatterN > 0 && venClatter < 1.72) {
      venClatterN--;
      venSfx('rustle', { volume: venClatterV, pitch: 1.34 });
    }
  }

  venPigeonUp = up;
  // ONLY WHAT YOU PUT UP. The pigeons also take off because the paving is
  // going under (`wet`, above), and at high water that is all one hundred and
  // eighty of them — so the peak hit its maximum on every tide, and ninety
  // seconds after arriving the task ticked itself and recorded 180, which is
  // also the best score the record can ever hold. The flood is weather; the
  // task is mischief. Count the flock only while the square is dry.
  if (!venFloodedNow && up > venPigeonPeak) { venPigeonPeak = up; venPigeonHold = 1.6; }

  // ---- AND IT IS AN AVALANCHE, NOT A SWITCH ------------------------------
  // A hundred and eighty birds and the only thing the chapter ever said about
  // them was one toast, once, at forty. Which means the whole middle of the
  // best physical joke in Venice — the moment where you realise the flock is
  // going up FASTER THAN YOU ARE RUNNING and the square in front of you turns
  // into a wall of wings — happened in silence and paid nothing.
  //
  // Four rungs. Each one fires ONCE per storm (the ladder only ever climbs, and
  // it is reset with the peak), each is a bigger and lower clatter than the one
  // under it, and the top one is a shove in the chest. Forty is still where the
  // task ticks; the ladder is what makes the run to it feel like something. The
  // rungs are counts and not fractions, so they mean the same thing if the
  // flock is ever resized.
  if (!venFloodedNow) {
    while (venPigeonRung < venPIGEON_RUNGS.length && up >= venPIGEON_RUNGS[venPigeonRung]) {
      const r = venPigeonRung++;
      const k = (r + 1) / venPIGEON_RUNGS.length;
      // the clatter goes DOWN in pitch as it goes up in size, because a
      // hundred wings together is not fifty wings louder, it is deeper
      venSfx('rustle', { volume: 0.26 + k * 0.55, pitch: 1.62 - k * 0.5 });
      if (r >= 2) venSfx('gull', { volume: 0.16 + k * 0.20, pitch: 1.25 - k * 0.2 });
      // and the last rung — nearly the whole square in the air at once — is the
      // one moment in this chapter that is allowed to hit the player
      if (r === venPIGEON_RUNGS.length - 1) {
        if (typeof game.punch === 'function') game.punch(0.20);
        else if (typeof game.shake === 'function') game.shake(0.20);
        venToast('a hundred and forty of them. the square has gone dark.');
      }
    }
  }

  if (venPigeonHold > 0) {
    venPigeonHold -= dt;
    if (venPigeonHold <= 0) {
      if (venPigeonPeak >= 40) {
        if (!venPigeonDone) {
          venPigeonDone = true;
          venTask('pigeon-storm');
          venToast('every one of them. all at once.');
        }
        if (typeof game.record === 'function') game.record('pigeon-storm', venPigeonPeak);
      }
      venPigeonPeak = 0;
      venPigeonRung = 0;
    }
  }
}

// ============================================================== THE SEED MAN =
/**
 * THE ONE THING EVERYBODY WHO HAS EVER BEEN TO THIS SQUARE HAS SEEN.
 *
 * Venice got eight locals in the last pass and every one of them is a person
 * standing still saying good lines, which is a step up from an empty square and
 * a step short of a place. The seed man is the one of the eight whose entire
 * job is a VERB, and he was doing it by mentioning it: "they know me. Watch."
 * and then nothing happened, in a square containing a hundred and eighty birds.
 *
 * So he throws. Every eleven-ish seconds his arm comes up, thirty grains go out
 * in an arc, and every pigeon within eighteen metres turns and walks to where
 * they landed — not flies, WALKS, in a hurry, the way they actually do. It ends
 * on its own after five and a half seconds and it never happens while the
 * square is under water, because nobody feeds pigeons in a foot of sea.
 *
 * It is also the only thing in the chapter that makes the flock do something
 * the player did not do, which is what stops a hundred and eighty birds reading
 * as scenery.
 */
const venSEED_AT = { x: -8, z: -19 };
const venSEED_N = 30;
const venSEED_PULL = 18;           // m. Any further and it is not about him.
let venSeedRec = null;             // the local, so his arm can go up
// THE PASSERELLE CREW, and the reason he needs a handle. He is standing at the
// exact spot the duckboards come out of, saying good lines about the siren —
// and when the siren actually went, he said nothing and did nothing, which is
// the one moment in his working life that he would definitely have an opinion
// about. Nothing in this game may announce a thing and then ignore it.
let venCrewRec = null;
// ...and the rest of the cast, for the exchanges and for anything that wants to
// make one of them react. See THE PEOPLE WHO LIVE HERE at the bottom.
let venWaiterRec = null, venWellRec = null, venGondRec = null, venFruitRec = null;
let venCrewSaid = -1;              // which line he used last
let venCrewCall = -1;              // s until he says it
const venCREW_CALL = [
  'That is us! Boards out — the square first, then the calli!',
  'Ninety seconds. Everybody off the paving, please.',
  'One metre ten! Get the passerelle up before it beats us to it!',
  'Here it comes. Same as Tuesday, only wetter.',
];
let venSeedT = 7;                  // s to the next throw
let venSeedThrow = -1;             // s into one, -1 between
let venSeedMesh = null, venSeedMat = null;
const venSeedData = new Float32Array(venSEED_N * 5);   // x, z, y, vy, spin

function venBuildSeed(root) {
  const M = venMerger();
  M.box(0, 0, 0, 0.05, 0.05, 0.07, PALETTE.venAwning);
  venSeedMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0 });
  const im = new THREE.InstancedMesh(M.build(), venSeedMat, venSEED_N);
  im.frustumCulled = false;
  im.visible = false;
  root.add(im);
  venSeedMesh = im;
}

function venUpdateSeed(game, dt) {
  if (!venSeedMesh) return;
  const dry = !venIsOverWater(venSEED_AT.x, venSEED_AT.z);
  if (dry) {
    venSeedT -= dt;
    if (venSeedT <= 0) {
      venSeedT = 10 + Math.random() * 7;
      venSeedThrow = 0;
      // his arm comes up: rec.gest is the locals system's own talking flag and
      // it is the only thing in npc.js this chapter needs to reach into.
      if (venSeedRec) venSeedRec.gest = 1.3;
      venSfx('pop', { volume: 0.16, pitch: 1.7 });
      for (let i = 0; i < venSEED_N; i++) {
        const o = i * 5, a2 = (i / venSEED_N) * 6.28318 + Math.random() * 0.4;
        const rr = 1.0 + Math.random() * 3.4;
        venSeedData[o] = venSEED_AT.x + Math.cos(a2) * rr;
        venSeedData[o + 1] = venSEED_AT.z + Math.cos(a2 * 0.7) * 0.8 + Math.sin(a2) * rr;
        venSeedData[o + 2] = 1.35;
        venSeedData[o + 3] = 1.2 + Math.random() * 1.6;
        venSeedData[o + 4] = Math.random() * 6.28;
      }
    }
  }
  if (venSeedThrow < 0) {
    if (venSeedMesh.visible) venSeedMesh.visible = false;
    return;
  }
  venSeedThrow += dt;
  if (venSeedThrow > 5.5 || !dry) { venSeedThrow = -1; venSeedMesh.visible = false; return; }
  venSeedMesh.visible = true;
  venSeedMat.opacity = clamp(1 - (venSeedThrow - 3.5) / 2, 0, 1);
  const gy = venTerrain(venSEED_AT.x, venSEED_AT.z);
  for (let i = 0; i < venSEED_N; i++) {
    const o = i * 5;
    if (venSeedData[o + 2] > gy + 0.03) {
      venSeedData[o + 3] -= 9.0 * dt;
      venSeedData[o + 2] += venSeedData[o + 3] * dt;
      if (venSeedData[o + 2] < gy + 0.03) venSeedData[o + 2] = gy + 0.03;
    }
    venSeedMesh.setMatrixAt(i, venXform(venSeedData[o], venSeedData[o + 2], venSeedData[o + 1],
      0, venSeedData[o + 4] + venSeedThrow * 2, 0, 1, 1, 1));
  }
  venSeedMesh.instanceMatrix.needsUpdate = true;
}

// ================================================================= GONDOLA ==
/**
 * A gondola, up and down the Grand Canal. It is a KINEMATIC body driven by
 * VELOCITY (never by writing position and hoping), with allowSleep off, and its
 * deck is a reference frame the same way the ferry's is — capybara.js reads the
 * contact's velocity and solves relative to it, so standing still on the prow of
 * a moving boat is standing still.
 */
function venBuildGondola(game, root) {
  const grp = new THREE.Group();
  const M = venMerger();
  // the hull: eleven metres, asymmetric, and it is a real asymmetry — a gondola
  // is banana-shaped so that one oar on one side drives it straight
  for (let i = 0; i < 11; i++) {
    const t = i / 10;
    const z = (t - 0.5) * 10.4;
    const taper = Math.sin(t * Math.PI);
    const w = 0.35 + taper * 0.95;
    M.box(0.06 * taper, 0.1, z, w, 0.42, 1.05, PALETTE.venGondola);
    M.box(0.06 * taper, 0.33, z, w + 0.06, 0.08, 1.02, PALETTE.venGondolaTr);
  }
  // the prow: the ferro, six teeth for six sestieri, and it is unmistakable
  M.box(0, 0.9, -5.4, 0.14, 1.9, 0.5, PALETTE.venFerro, 0.24);
  for (let i = 0; i < 6; i++) {
    M.box(-0.26, 0.35 + i * 0.28, -5.9 + i * 0.05, 0.6, 0.11, 0.3, PALETTE.venFerro);
  }
  M.box(0, 0.85, 5.3, 0.14, 1.5, 0.4, PALETTE.venFerro, -0.3);
  // the seat, and the little gilt horses on it
  M.box(0, 0.42, 1.2, 1.05, 0.2, 1.6, PALETTE.venBriccolaR);
  M.box(0, 0.72, 1.95, 1.05, 0.6, 0.12, PALETTE.venGondolaTr);
  // the forcola stays with the hull; the OAR does not — see venGondOar
  M.box(0.62, 0.6, 2.6, 0.16, 0.5, 0.3, PALETTE.venBriccola);
  // the gondolier: a striped shirt and a hat, and no face, because none of the
  // people in this game have one
  M.box(0.15, 1.35, 3.4, 0.5, 1.4, 0.34, PALETTE.venBriccolaW);
  for (let i = 0; i < 4; i++) M.box(0.15, 1.0 + i * 0.28, 3.4, 0.52, 0.13, 0.36, PALETTE.venBriccolaR);
  M.sph(0.15, 2.2, 3.4, 0.19, 0.21, 0.19, PALETTE.skin2);
  M.cyl(0.15, 2.42, 3.4, 0.24, 0.16, PALETTE.venBriccolaW, 0, 0, 0, 8);
  M.cyl(0.15, 2.52, 3.4, 0.4, 0.05, PALETTE.venBriccolaW, 0, 0, 0, 8);

  const mesh = new THREE.Mesh(M.build(), venVC());
  mesh.castShadow = true;
  grp.add(mesh);

  // ---- AND HE ROWS ---------------------------------------------------------
  // A gondola crossing the Grand Canal with a man standing on the back of it
  // holding a stick that never moves is a float in a parade. Voga alla veneta
  // is one oar, on one side, standing up, facing forward — the stroke is a
  // long push away and a feathered recovery, and the whole boat answers it,
  // which is why the hull's roll below is driven off the same phase.
  //
  // The oar is its own group pivoted AT THE FORCOLA, which is the only place
  // it can be: an oar rotated about its own centre is a propeller.
  {
    const O = venMerger();
    // authored relative to the forcola at (0.62, 0.6, 2.6)
    O.box(0.28, 0.35, -1.2, 0.1, 0.1, 4.4, PALETTE.venBriccola);
    O.box(0.34, 0.30, -3.1, 0.1, 0.34, 1.5, PALETTE.venBriccola);      // the blade
    const om = new THREE.Mesh(O.build(), venVC());
    om.castShadow = true;
    venGondOar = new THREE.Group();
    venGondOar.position.set(0.62, 0.6, 2.6);
    venGondOar.add(om);
    grp.add(venGondOar);
  }
  root.add(grp);
  venGondGroup = grp;

  const b = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC,
                              material: (game.mats && game.mats.ground) || undefined });
  b.addShape(new CANNON.Box(new CANNON.Vec3(0.85, 0.22, 5.2)));
  b.allowSleep = false;
  b.position.set(0, -60, 0);
  venSyncBody(b);
  game.world.addBody(b);
  venGondBody = b;
}

// ============================================================= THE TRAGHETTO ==
// THE MINI, and it is a real thing that a real city really does: there are four
// bridges over the Grand Canal and two miles of it, so at seven points along
// the way a stripped-out gondola with two oarsmen ferries people across for a
// couple of euros, and the crossing takes about forty seconds.
//
// AND YOU STAND UP FOR IT. Everybody who lives there does; everybody who does
// not sits down, and is laughed at. That is the whole mini: stay on your feet
// from one bank to the other. It is deliberately not another 'get on the moving
// thing' — Venice already has a gondola you ride the prow of — because the
// traghetto is eleven metres long, ninety centimetres of standing room across,
// and it ROLLS.
//
// The roll is a shove() and not a torque. capybara.js solves in the deck's
// frame, so tilting the collider does very little and tilting it enough to
// matter throws the animal into the canal on the first stroke. A lean, applied
// after the solve and outside the speed cap, is the one channel that actually
// moves a standing capybara sideways — the same channel the sandstorm uses, for
// exactly the same reason (see CONTRACT.md, "three ways to move a capybara").
const venTRAG_S = 0.68;              // where along the canal the crossing is
const venTRAG_HALF = 13.0;           // m from the middle to each pontoon
const venTRAG_CROSS = 9.5;           // s to get across
const venTRAG_WAIT = 7.0;            // s alongside
const venTRAG_HX = 0.95, venTRAG_HZ = 5.2;
const venTRAG_DECK = 0.34;
const venTRAG_ROLL = 1.35;           // rad/s of the roll
const venTRAG_LEAN = 2.6;            // m/s^2 of lean at the top of a roll
let venTragGroup = null, venTragBody = null;
let venTragU = -1;                   // -1..1 across the canal
let venTragDir = 1;
let venTragWait = venTRAG_WAIT;
let venTragPX = 0, venTragPZ = 0;
let venTragYaw = 0;
let venTragFrom = 0;                 // which bank this crossing started at
let venTragDone = false;
let venTragAboard = false;
const venTragPos = new THREE.Vector3();
const venTragAxis = { x: 1, z: 0 };  // the across-canal unit vector at the station

function venBuildTraghetto(game, root) {
  venLinePoint(venCanX, venCanZ, venCanS, venCanLen, venTRAG_S, venLineOut);
  const cx = venLineOut.x, cz = venLineOut.z;
  // across the canal is the tangent turned ninety degrees
  venTragAxis.x = Math.cos(venLineOut.yaw);
  venTragAxis.z = -Math.sin(venLineOut.yaw);
  venTragYaw = venLineOut.yaw + Math.PI * 0.5;

  const M = venMerger();
  const HX = venTRAG_HX, HZ = venTRAG_HZ;
  // A traghetto is a gondola with the ferro and the seats taken out of it, so
  // it is drawn as one: black, asymmetric, and with nothing on it to hold.
  M.box(0, -0.16, 0, HX * 2, 0.52, HZ * 2 - 2.4, PALETTE.venGondola);
  for (let s2 = -1; s2 <= 1; s2 += 2) {
    for (let k = 0; k < 3; k++) {
      const t = k / 3;
      M.box(0, -0.16 + t * 0.10, s2 * (HZ - 1.2 + k * 0.42),
            HX * 2 * (1 - t * 0.66), 0.52, 0.9, PALETTE.venGondola);
    }
    M.box(0, 0.34, s2 * (HZ - 0.2), 0.34, 0.9, 0.5, PALETTE.venGondola, s2 * 0.34, 0, 0);
  }
  M.box(0, venTRAG_DECK - 0.05, 0, HX * 2 - 0.14, 0.10, HZ * 2 - 2.2, PALETTE.venGondolaTr);
  M.box(0, 0.16, 0, HX * 2 + 0.06, 0.10, HZ * 2 - 2.6, PALETTE.venGold);
  // the two oarsmen, fore and aft, and their forcole
  for (let s2 = -1; s2 <= 1; s2 += 2) {
    M.cyl(HX - 0.28, 1.05, s2 * (HZ - 2.2), 0.17, 1.30, PALETTE.venTrim, 0, 0, 0, 6);
    M.sph(HX - 0.28, 1.86, s2 * (HZ - 2.2), 0.15, 0.17, 0.15, PALETTE.venBriccola);
    M.cyl(HX + 0.02, 0.86, s2 * (HZ - 2.2) - 0.3, 0.09, 0.85, PALETTE.venBriccola, 0.3, 0, 0.2);
    M.cyl(HX + 0.55, 1.15, s2 * (HZ - 2.2) - 1.4, 0.06, 4.2, PALETTE.venBriccola, 0.42, 0.2, 0.26);
  }
  const mesh = new THREE.Mesh(M.build(), venVC());
  mesh.castShadow = true;
  venTragGroup = new THREE.Group();
  venTragGroup.name = 'venTraghetto';
  venTragGroup.add(mesh);
  root.add(venTragGroup);

  const b = new CANNON.Body({
    mass: 0, type: CANNON.Body.KINEMATIC,
    material: game.mats ? game.mats.ground : undefined,
  });
  b.addShape(new CANNON.Box(new CANNON.Vec3(HX, 0.30, HZ - 1.1)), new CANNON.Vec3(0, 0.04, 0));
  b.allowSleep = false;
  venTragU = -1; venTragDir = 1; venTragWait = venTRAG_WAIT; venTragFrom = -1;
  const px = cx + venTragAxis.x * venTRAG_HALF * venTragU;
  const pz = cz + venTragAxis.z * venTRAG_HALF * venTragU;
  venTragPX = px; venTragPZ = pz;
  b.position.set(px, venWaterY + 0.10, pz);
  b.quaternion.setFromEuler(0, venTragYaw, 0);
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
  b.previousQuaternion.copy(b.quaternion);
  b.interpolatedQuaternion.copy(b.quaternion);
  game.world.addBody(b);
  venTragBody = b;
  venTragPos.set(px, venWaterY, pz);
  venTragGroup.position.copy(venTragPos);
  venTragGroup.rotation.y = venTragYaw;

  // the two pontoons, one on each bank, which is what makes it read as a stop
  const P = venMerger();
  for (let s2 = -1; s2 <= 1; s2 += 2) {
    const x = cx + venTragAxis.x * venTRAG_HALF * s2 * 1.16;
    const z = cz + venTragAxis.z * venTRAG_HALF * s2 * 1.16;
    P.box(x, venWaterY + 0.34, z, 3.4, 0.22, 4.6, PALETTE.venGondolaTr, 0, venTragYaw, 0);
    for (let k = -1; k <= 1; k += 2) {
      P.cyl(x + venTragAxis.x * 1.4, venWaterY + 1.1, z + venTragAxis.z * 1.4 + k * 1.8,
            0.16, 2.4, PALETTE.venBriccolaR, 0, 0, 0, 6);
    }
  }
  const pm = new THREE.Mesh(P.build(), venVC());
  pm.castShadow = true;
  root.add(pm);
}

function venStationAt(out) {
  venLinePoint(venCanX, venCanZ, venCanS, venCanLen, venTRAG_S, venLineOut);
  out.x = venLineOut.x; out.z = venLineOut.z;
  return out;
}
const venTragStation = { x: 0, z: 0 };

/** True when the capybara is standing on the traghetto's floor. */
function venOnTraghetto(p) {
  const b = venTragBody;
  if (!b || !p) return false;
  const dx = p.x - b.position.x, dz = p.z - b.position.z;
  const c = Math.cos(venTragYaw), s2 = Math.sin(venTragYaw);
  const lx = dx * c - dz * s2, lz = dx * s2 + dz * c;
  return Math.abs(lx) < venTRAG_HX + 0.35 && Math.abs(lz) < venTRAG_HZ - 0.7 &&
         p.y > b.position.y - 0.6 && p.y < b.position.y + 2.2;
}

function venUpdateTraghetto(game, dt) {
  const b = venTragBody;
  if (!b || dt <= 0) { if (b) b.velocity.setZero(); return; }
  venStationAt(venTragStation);

  const under = venWaterY + 0.10;
  if (venTragWait > 0) {
    venTragWait -= dt;
  } else {
    venTragU += (2 / venTRAG_CROSS) * dt * venTragDir;
    if (venTragU >= 1) { venTragU = 1; venTragDir = -1; venTragWait = venTRAG_WAIT; venTragArrive(game); }
    else if (venTragU <= -1) { venTragU = -1; venTragDir = 1; venTragWait = venTRAG_WAIT; venTragArrive(game); }
  }
  const tx = venTragStation.x + venTragAxis.x * venTRAG_HALF * venTragU;
  const tz = venTragStation.z + venTragAxis.z * venTRAG_HALF * venTragU;
  const inv = dt > 1e-5 ? 1 / dt : 60;
  // FROM THE TARGET, not from the body — the same rule the gondola is on and
  // for the same reason (see venUpdateGondola).
  b.velocity.set((tx - venTragPX) * inv, (under - b.position.y) * inv, (tz - venTragPZ) * inv);
  venTragPX = tx; venTragPZ = tz;
  if (Math.hypot(tx - b.position.x, tz - b.position.z) > 6) {
    b.position.set(tx, under, tz);
    b.velocity.set(0, 0, 0);
    venSyncBody(b);
  }
  venTragPos.set(b.position.x, b.position.y, b.position.z);

  // ---- the roll, and the lean it puts on the passenger --------------------
  const moving = venTragWait <= 0 ? 1 : 0.25;
  const roll = Math.sin(venTime * venTRAG_ROLL) * 0.16 * moving;
  if (venTragGroup) {
    venTragGroup.position.set(b.interpolatedPosition.x, b.interpolatedPosition.y,
                              b.interpolatedPosition.z);
    venTragGroup.rotation.set(Math.sin(venTime * 0.9) * 0.02, venTragYaw, roll);
  }
  const capy = game.capy;
  const aboard = !!(capy && venOnTraghetto(capy.position));
  if (aboard && capy.shove) {
    // Across the boat, in world axes. shove() is added after the movement solve
    // and widens the speed cap by its own size, which is the only reason a lean
    // of this size is felt at all.
    const k = roll * venTRAG_LEAN * dt * 60;
    capy.shove(venTragAxis.z * -k, venTragAxis.x * k);
  }
  venTragAboard = aboard;
}

/** She is alongside. Did anybody stay up for the whole crossing? */
function venTragArrive(game) {
  if (game && game.sfx) game.sfx('thud', { volume: 0.35, pitch: 0.9 });
  if (venTragDone) return;
  if (!venTragAboard) { venTragFrom = venTragU; return; }
  // Only counts as a crossing if they were aboard at the far bank AND this
  // arrival is not the one they got on at.
  if (venTragFrom !== venTragU) {
    venTragDone = true;
    venTask('traghetto');
  }
  venTragFrom = venTragU;
}

function venUpdateGondola(game, dt) {
  if (!venGondBody) return;
  venGondS += venGONDIR() * venGOND_SPEED * dt;
  if (venGondS > 0.93) { venGondS = 0.93; venGondDir = -1; }
  if (venGondS < 0.07) { venGondS = 0.07; venGondDir = 1; }
  venLinePoint(venCanX, venCanZ, venCanS, venCanLen, venGondS, venLineOut);
  const tx = venLineOut.x, tz = venLineOut.z;
  const ty = venWaterY + 0.12;
  const want = venLineOut.yaw + (venGondDir < 0 ? Math.PI : 0);
  // A kinematic body is driven by VELOCITY so the contact solver — and
  // capybara.js's platform frame, which reads exactly this — sees an honest
  // number. Writing the position and leaving velocity at zero makes the deck
  // teleport under the animal every frame and it slides off the back.
  const b = venGondBody;
  const inv = dt > 1e-5 ? 1 / dt : 60;
  // FROM THE TARGET, NOT FROM THE BODY. cannon integrates kinematic bodies
  // inside world.step, which runs before every module update, so
  // (target - body.position) is the distance the LAST velocity already
  // travelled rather than the distance still to go. When cannon takes 0 or 2
  // substeps in a frame — routine with step(1/60, dt, 5) — the recurrence
  // alternates between the right answer and zero, and capybara.js skips a deck
  // whose velocity is under 1e-4 and drops the animal back into the world
  // frame while the hull keeps going. Same fix as the bangka.
  b.velocity.set((tx - venGondPX) * inv, (ty - b.position.y) * inv, (tz - venGondPZ) * inv);
  venGondPX = tx; venGondPZ = tz;

  // ...but the first frame after a re-entry is a teleport, not a voyage.
  const jump = Math.hypot(tx - b.position.x, tz - b.position.z);
  if (jump > 6) {
    b.position.set(tx, ty, tz);
    b.velocity.set(0, 0, 0);
    venSyncBody(b);
  }
  venGondYaw = want;
  b.quaternion.setFromEuler(0, venGondYaw, 0);
  b.previousQuaternion.copy(b.quaternion);
  b.interpolatedQuaternion.copy(b.quaternion);

  if (venGondGroup) {
    venGondGroup.position.set(b.interpolatedPosition.x, b.interpolatedPosition.y,
                              b.interpolatedPosition.z);
    // THE HULL ROLLS ON THE STROKE, not on its own clock. A boat that pitches
    // to one sine and is rowed to another is two objects; sharing the phase is
    // what makes the oar look like the thing pushing it along.
    const st = venTime * 1.15;
    venGondGroup.rotation.set(Math.sin(st) * 0.022, venGondYaw,
                              -Math.sin(st + 0.5) * 0.045);
    if (venGondOar) {
      // a long push (three quarters of the cycle) and a quick feathered
      // recovery: asymmetric, because a rowing stroke is
      const u = (st / 6.28318) % 1;
      const sweep = u < 0.72 ? lerp(0.55, -0.62, u / 0.72)
                             : lerp(-0.62, 0.55, (u - 0.72) / 0.28);
      venGondOar.rotation.y = sweep;
      venGondOar.rotation.x = u < 0.72 ? 0.06 : 0.06 - Math.sin((u - 0.72) / 0.28 * Math.PI) * 0.30;
    }
  }

  // --- riding it ------------------------------------------------------------
  // A LOCAL-SPACE TEST MUST BE A ROTATION, not a reflection: cos(-yaw)/sin(-yaw)
  // silently swaps which tolerance guards which axis, and on a boat eleven
  // metres long and two wide that is the difference between a deck and a plank.
  const capy = game.capy;
  if (capy && capy.position) {
    const dx = capy.position.x - b.position.x, dz = capy.position.z - b.position.z;
    const c = Math.cos(venGondYaw), s = Math.sin(venGondYaw);
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    const dy = capy.position.y - b.position.y;
    // the vertical tolerance has to clear a HOP, or the test goes false in the
    // middle of every successful jump taken on deck
    const on = Math.abs(lx) < 1.5 && Math.abs(lz) < 5.6 && dy > -0.4 && dy < 2.7;
    if (on) {
      venGondRideT += dt;
      if (venGondRideT > 4.5 && !venGondDone) {
        venGondDone = true;
        venTask('gondola-ride');
        venToast('he has not said anything. he has not needed to.');
        venSfx('pop', { volume: 0.8, pitch: 1.3 });
      }
    } else {
      venGondRideT = 0;
    }
  }
}
function venGONDIR() { return venGondDir; }

// =================================================================== WATER ==
/**
 * Two planes and a mirror.
 *
 * The lagoon is its own plane at a fixed height, because the Bacino is tidal by
 * a few centimetres and nobody has ever noticed. The CITY water is the one that
 * moves, and it is drawn as a single big translucent sheet that simply sits at
 * venWaterY — so a rising tide is one number and everything that is under it is
 * under it, with no per-object bookkeeping anywhere.
 *
 * The mirror is the marquee. Building the reflection as real geometry (the
 * campanile, the basilica front, the arcades, flipped in y and dimmed) and
 * drawing it UNDER a half-transparent sheet costs a handful of draw calls and
 * gets the actual photograph: a city standing on itself. A render target would
 * cost the whole frame and look worse at this polygon count.
 */
function venBuildWater(root) {
  // ---- one sea, two colours -----------------------------------------------
  // The city water and the lagoon are the SAME water at the SAME height — they
  // have to be, or the capybara floats at the tide line while the Bacino is
  // drawn eighty centimetres above its head. What differs is the colour: a rio
  // is opaque green over mud and the Bacino is blue over sand, and that is a
  // real thing about Venice rather than a lighting trick.
  //
  // Both are CLONED materials. mat() caches by colour and options, so mutating
  // the one it hands back would tint whatever else asked for the same literal —
  // which is exactly how Iceland's aurora permanently dyed the Rio Cali.
  // SEVENTY-TWO BY THIRTY-FOUR, NOT ONE BY ONE. This was a single quad, which
  // is to say a perfectly flat plane with exactly one normal on it — so a metre
  // of water over the most famous square in Europe shaded as one unbroken value
  // from every camera in the chapter, and the only thing on it was the glitter.
  //
  // The reason it can be subdivided and moved for nothing is that the material
  // is flatShading, and three computes a flat normal in the FRAGMENT shader
  // from screen-space derivatives — so the ripple below never needs
  // computeVertexNormals(), which is the expensive half of animating water and
  // the reason nobody does it. Four metre cells, five centimetres of swell, two
  // crossing waves and a slow drift: at the swimming camera it is chop, and
  // from six metres up it is a surface with light moving on it.
  const g = new THREE.PlaneGeometry(290, 130, 72, 34);
  g.rotateX(-Math.PI / 2);
  g.translate(-65, 0, -40);
  // GLITTER, NOT WAVES. The mesh already has a ripple written into it and you
  // cannot see it from six metres up at 41 degrees; what makes water read as
  // water from there is a sparse field of moving points far brighter than the
  // surface. It costs four hash calls and it is the difference between a sea
  // and a sheet of coloured card. See grain() in shared.js.
  // A wet gold afternoon, so the glitter is gold. Grained before the clone —
  // the tide writes this material's colour every frame.
  venWaterMat = grainOwn(mat(PALETTE.venCanal, { transparent: true, opacity: 0.82 }),
    // METRE CELLS, NOT HALF-METRE ONES. At sparkleScale 1.8 a cell is 55 cm,
    // which is already sub-pixel thirty metres out — and a sub-pixel speck does
    // not twinkle, the distance fade eats it, and the far half of the square
    // had no glitter on it at all. See the fwidth note in grain().
    { scale: 0.7, amount: 0.13, warp: 0,
      sparkle: 0.55, sparkleScale: 0.88, sparkleSpeed: 0.17, sparkleCut: 0.655,
      sparkleBand: 0.10, sparkleColor: PALETTE.venSkyLow });
  venWaves(venWaterMat);
  venWaterMat.depthWrite = false;
  venWaterAttr = g.attributes.position;
  venWaterBase = new Float32Array(venWaterAttr.count * 2);
  for (let i = 0; i < venWaterAttr.count; i++) {
    venWaterBase[i * 2] = venWaterAttr.getX(i);
    venWaterBase[i * 2 + 1] = venWaterAttr.getZ(i);
  }
  const m = new THREE.Mesh(g, venWaterMat);
  m.renderOrder = 3;
  m.frustumCulled = false;
  m.position.y = venWaterY;
  root.add(m);
  venWaterMesh = m;

  const lg = new THREE.PlaneGeometry(460, 230, 1, 1);
  lg.rotateX(-Math.PI / 2);
  lg.translate(-20, 0, 132);
  const lmat = grainOwn(mat(PALETTE.venLagoon, { transparent: true, opacity: 0.94 }),
    { scale: 0.4, amount: 0.05, warp: 0,
      sparkle: 0.50, sparkleScale: 0.95, sparkleSpeed: 0.26, sparkleCut: 0.65,
      sparkleColor: PALETTE.venSkyLow });
  venWaves(lmat);
  const lm = new THREE.Mesh(lg, lmat);
  lm.renderOrder = 3;
  lm.frustumCulled = false;
  lm.position.y = venWaterY;
  root.add(lm);
  venLagoonMesh = lm;
}

// ================================================================== GROUND ==
function venBuildGround() {
  // ---- THE GROUND WAS THE BIGGEST SINGLE THING IN THE CHAPTER -------------
  // 150 x 124 over 280 x 230 m is 37,200 triangles — a quarter of Venice —
  // and most of them are spent on the flat metre-thirty of the outer city
  // where the height is one number. This is the Palawan seabed all over again
  // (CONTRACT, performance budget) and the answer is the same: the interesting
  // relief here is the two squares, the Molo, the rio and the canal channel,
  // all of which are 3.5 m blends or wider, so 2.2 m cells resolve every one
  // of them. 128 x 106 is 27,136 — ten thousand triangles back, and the
  // trachyte banding (period ~10 m) is unaffected.
  const X0 = -200, X1 = 80, Z0 = -100, Z1 = 130;
  const NX = 128, NZ = 106;
  const g = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0, NX, NZ);
  g.rotateX(-Math.PI / 2);
  g.translate((X0 + X1) * 0.5, 0, (Z0 + Z1) * 0.5);
  const p = g.attributes.position.array;
  const col = new Float32Array(p.length);
  const c = new THREE.Color();
  const stone = new THREE.Color(PALETTE.venStone);
  const wet = new THREE.Color(PALETTE.venStoneWet);
  const dark = new THREE.Color(PALETTE.venStoneDark);
  const bed = new THREE.Color(PALETTE.venCanalDeep);
  // ---- THE SQUARE IS GREY AND THE RIBS ARE WHITE --------------------------
  // Piazza San Marco is paved in trachyte with white Istrian ribs across it,
  // and this ground drew the FIELD in the same near-white as the ribs. Three
  // things followed and all three were measured off the rendered frame:
  // the pattern the square is famous for was invisible; a hundred and eighty
  // grey pigeons had nothing to stand against; and — worst — a metre of green
  // water over pale stone came out the same VALUE as the dry stone next to it,
  // which is the one thing the marquee moment of this chapter may not do. The
  // ribs are drawn separately in venBuildSquares and they are still venStone,
  // so they simply became the brightest thing on the ground instead of a tie.
  const trach = new THREE.Color(PALETTE.venTrachyte);
  const trachD = new THREE.Color(PALETTE.venTrachyteD);
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i], z = p[i + 2];
    const y = venTerrain(x, z);
    p[i + 1] = y;
    if (y < -2.0) c.copy(bed);
    else if (y < 0.3) {
      // the two squares, and their ramps: grey, laid in bands running the
      // length of the piazza, which is the way the stone actually goes
      const band = (Math.sin(z * 0.62) * 0.5 + 0.5) * 0.55 +
                   (Math.sin(x * 1.7 + z * 0.3) * 0.5 + 0.5) * 0.22;
      c.copy(trach).lerp(trachD, clamp(band, 0, 0.72));
      // and it goes back to Istrian at the water's edge, where it is scoured
      c.lerp(wet, clamp((0.30 - y) * 1.5, 0, 0.55));
    } else {
      c.copy(stone).lerp(dark, clamp((Math.sin(x * 0.5) * Math.sin(z * 0.43) + 1) * 0.16, 0, 0.34));
      // the three and a half metres of ramp out of the square blends into it,
      // so there is no hard line round the edge of the low ground
      const sq = Math.max(venRect(x, z, venPZ_X0, venPZ_Z0, venPZ_X1, venPZ_Z1, 4.5),
                          venRect(x, z, venPT_X0, venPT_Z0, venPT_X1, venPT_Z1, 4.5));
      if (sq > 0) c.lerp(trach, sq * 0.85);
    }
    col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, venVCG());
  m.receiveShadow = true;
  m.frustumCulled = false;
  return m;
}

/** MIND WHICH WAY THE SECOND AXIS RUNS — anchored at the FAR z edge, j walking
 *  back toward Z0. Getting this wrong leaves the biome with no collision floor
 *  at all and it is nearly invisible from the capybara, which holds itself up on
 *  its own analytic backstop. See CONTRACT.md. */
function venBuildGroundBody(game) {
  // EL WAS 4, AND A CAPYBARA STANDING PERFECTLY STILL SLID INTO THE LAGOON.
  //
  // Measured at the spawn (-4, 13): 2.76 m of +z in sixty seconds with
  // `body.velocity.z` reading exactly 0.000 the whole time, and 0.046 m every
  // second, dead steady. Sydney, Kyoto and Rio drift 0.00 m over the same test.
  // It carries the animal down the ramp into the water, and `capy.loaf` stays
  // at 1.0 the whole way — so the chapter's answer to standing still was to
  // loaf and slide into the lagoon at the same time.
  //
  // THE ANALYTIC TERRAIN AND THE COLLISION SURFACE DISAGREED. venTerrain is
  // flat at 1.00 from z 10 to z 15 and then falls off the Molo — 0.98, 0.54,
  // -0.28, -1.36 over three metres. Sampled every four metres, the nearest
  // knots either side of the animal are z 12 (1.00) and z 16 (0.54), so the
  // heightfield triangle it actually stands on is a 6.6-degree ramp four metres
  // BACK from where the real edge is. `slopeAt` answers 0.003 — flat — so
  // nothing applies any anti-slide, and Venice's wet paving (slipK 0.40) does
  // the rest. This is the Antarctic creep, from the opposite cause: judge
  // stillness by DISPLACEMENT, never by velocity, which read zero throughout.
  //
  // A SAMPLE SPACING HAS TO RESOLVE THE SHARPEST FEATURE IT CARRIES. Venice's
  // is a three-metre quay edge; the other chapters are hills, which is why 5 m
  // is fine for them and 4 m was not for this one.
  const X0 = -200, Z0 = -100, EL = 2;
  const NX = 140, NZ = 114;
  const Z1 = Z0 + NZ * EL;
  const data = [];
  for (let i = 0; i <= NX; i++) {
    const row = [];
    for (let j = 0; j <= NZ; j++) row.push(venTerrain(X0 + i * EL, Z1 - j * EL));
    data.push(row);
  }
  const hf = new CANNON.Heightfield(data, { elementSize: EL });
  const b = new CANNON.Body({ mass: 0, material: (game.mats && game.mats.ground) || undefined });
  b.addShape(hf);
  b.position.set(X0, 0, Z1);
  b.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  venSyncBody(b);
  game.world.addBody(b);
}

// =============================================================== FAR THINGS =
/** San Giorgio Maggiore, out in the Bacino. Decor: no collision, and it is a
 *  long way off, which is exactly what it is in life. */
function venBuildFar(root) {
  const M = venMerger();
  const gx = 40, gz = 108;
  M.box(gx, 2, gz, 46, 4, 26, PALETTE.venStone);
  M.box(gx - 4, 9, gz, 20, 14, 20, PALETTE.venBrick);
  M.box(gx - 14.2, 8, gz, 1.6, 16, 18, PALETTE.venStone);
  M.cone(gx - 14.2, 17.5, gz, 9.5, 5.5, PALETTE.venStone, 0, 0, 0, 4);
  M.cyl(gx - 4, 20, gz, 6.4, 3.2, PALETTE.venStone, 0, 0, 0, 8);
  M.sph(gx - 4, 23, gz, 6.6, 5.0, 6.6, PALETTE.venRoofDark);
  M.cyl(gx + 12, 22, gz + 6, 2.6, 36, PALETTE.venBrick, 0, 0, 0, 6);
  M.box(gx + 12, 41, gz + 6, 5.6, 3.0, 5.6, PALETTE.venStone);
  M.cone(gx + 12, 45, gz + 6, 2.9, 5.4, PALETTE.venRoof, 0, 0, 0, 6);
  // the Salute, on the other side of the canal mouth
  M.box(-86, 3, 46, 30, 6, 30, PALETTE.venStone);
  M.cyl(-86, 11, 46, 11, 12, PALETTE.venStone, 0, 0, 0, 8);
  M.sph(-86, 20, 46, 12.5, 9.5, 12.5, PALETTE.venStoneWet);
  M.cyl(-86, 29, 46, 1.4, 4.0, PALETTE.venStone, 0, 0, 0, 6);
  const mesh = new THREE.Mesh(M.build(), venVC());
  mesh.castShadow = true;
  root.add(mesh);
}

/** The arcade lamps, which come on at the top of the tide and are most of why
 *  the flooded square looks the way it looks. */
let venLampMesh = null;
/**
 * THE FLAGS, and they are the only wind in Venice.
 *
 * Three poles, six segments each, one InstancedMesh, eighteen matrices a frame.
 * The wave travels ALONG the flag rather than everything moving together, which
 * is the difference between cloth and a row of shutters — and the amplitude is
 * keyed to the tide clock, so the flags start snapping about twenty seconds
 * before the siren. Nobody is told that. It is simply true every time, and it
 * is the only warning of the acqua alta that is not a noise.
 */
const venFLAG_SEG = 6;
function venBuildFlags(root) {
  const n = (venFLAGS.length / 3) * venFLAG_SEG;
  if (!n) return;
  const M = venMerger();
  // the segment is a SLICE ACROSS the flag: thin through the cloth, tall down
  // it, and about half a metre along the run it streams in
  M.box(0, -1.15, 0, 0.62, 2.3, 0.1, 0xffffff);
  const im = new THREE.InstancedMesh(M.build(), mat(0xffffff, { vertexColors: true }), n);
  im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  const cR = new THREE.Color(PALETTE.venBriccolaR), cG = new THREE.Color(PALETTE.venGold);
  for (let f = 0; f < venFLAGS.length / 3; f++) {
    for (let k = 0; k < venFLAG_SEG; k++) {
      const c = k === 2 ? cG : cR;
      im.instanceColor.setXYZ(f * venFLAG_SEG + k, c.r, c.g, c.b);
    }
  }
  im.instanceColor.needsUpdate = true;
  im.castShadow = true;
  im.frustumCulled = false;
  root.add(im);
  venFlagMesh = im;
}
function venUpdateFlags(dt) {
  if (!venFlagMesh) return;
  // the breeze gets up before the water does
  const toWarn = venTIDE_WARN - venPhase;
  const near = toWarn > 0 && toWarn < 0.1 ? 1 - toWarn / 0.1 : 0;
  const rising = venPhase > venTIDE_WARN && venPhase < venTIDE_FALL1 ? 1 : 0;
  venFlagGust = damp(venFlagGust, 0.35 + near * 0.65 + rising * 0.3, 0.7, dt);
  for (let f = 0; f < venFLAGS.length / 3; f++) {
    const px = venFLAGS[f * 3], py = venFLAGS[f * 3 + 1], pz = venFLAGS[f * 3 + 2];
    for (let k = 0; k < venFLAG_SEG; k++) {
      const t = (k + 0.5) / venFLAG_SEG;
      const ph = venTime * 3.4 - t * 4.2 + f * 1.7;
      const amp = venFlagGust * t * t;
      const sag = (1 - venFlagGust) * t * 1.5;
      // IT STREAMS ACROSS THE SQUARE, NOT DOWN IT. Flown along -z the flag is
      // edge-on to the only camera anybody looks at this façade from, which is
      // three red hairlines. The wind in this chapter comes off the Bacino.
      const run = t * 3.4 * (0.4 + venFlagGust * 0.6);
      venFlagMesh.setMatrixAt(f * venFLAG_SEG + k, venXform(
        px - 0.25 - run, py - sag * 0.9,
        pz + Math.sin(ph) * amp * 0.55,
        0, Math.sin(ph) * amp * 0.5, Math.sin(ph * 1.2) * amp * 0.22,
        1, 1, 1));
    }
  }
  venFlagMesh.instanceMatrix.needsUpdate = true;
  // and the highest thing in the world turns with the same wind. It LAGS the
  // flags — forty metres of gilded bronze on a pivot does not answer a gust
  // the way three metres of cloth does — which is the only reason the two
  // reading the same number look like two different objects.
  if (venAngel) {
    const want = -0.9 + venFlagGust * 1.35 + Math.sin(venTime * 0.31) * 0.28 * venFlagGust;
    venAngel.rotation.y = damp(venAngel.rotation.y, want, 0.45, dt);
  }
}

/**
 * THE ANGEL, AND IT IS A WEATHERVANE.
 *
 * The gilded archangel on the campanile turns with the wind — that is what it
 * is FOR, it is the oldest wind indicator in the city, and Venetians read it.
 * This chapter's whole clock is a wind that gets up before the water does
 * (venUpdateFlags), and the tallest object in the world was a static gold
 * plate. It turns with the same gust the flags do, so from anywhere in the
 * square — including inside the calli, where the flags are not visible — the
 * highest thing in frame is telling you the tide is coming.
 */
let venAngel = null;
function venBuildAngel(root) {
  const M = venMerger();
  const c = venCAMPANILE;
  // it stands on the spire's finial and it is a figure with wings and a staff
  M.box(0, 1.3, 0, 0.5, 2.2, 0.42, PALETTE.venGold);
  M.sph(0, 2.65, 0, 0.26, 0.3, 0.26, PALETTE.venGold);
  M.cyl(0, 3.0, 0, 0.38, 0.1, PALETTE.venGoldPale, 0, 0, 0, 8);
  // the wings: two plates swept back, which is the shape at forty metres
  for (let s = -1; s <= 1; s += 2) {
    M.box(s * 0.62, 1.85, -0.34, 1.0, 1.5, 0.1, PALETTE.venGoldPale, 0, s * 0.5, s * 0.22);
    M.box(s * 1.24, 2.25, -0.72, 0.8, 1.0, 0.09, PALETTE.venGoldPale, 0, s * 0.8, s * 0.36);
  }
  // the arm and the trumpet, which is the bit that points downwind
  M.box(0.34, 1.95, 0.62, 0.16, 0.16, 1.3, PALETTE.venGold, 0.2);
  M.cone(0.34, 2.15, 1.35, 0.22, 0.6, PALETTE.venGoldPale, Math.PI * 0.5, 0, 0, 6);
  const m = new THREE.Mesh(M.build(), venVC());
  m.castShadow = true;
  m.position.set(c.x, 50.0, c.z);
  m.frustumCulled = false;
  root.add(m);
  venAngel = m;
}

/**
 * WHAT THE TIDE BRINGS IN WITH IT.
 *
 * A metre of water arriving over sixty metres of paving is not a clean sheet:
 * it comes in over a square that has had a market, a café and eight thousand
 * people on it, and it lifts everything that floats. Twelve pieces of it —
 * a crate, a fender, a plastic bottle, somebody's sandal — riding the surface
 * and turning slowly.
 *
 * It is the cheapest possible proof that the flat green plane is WATER rather
 * than paint: a still surface with nothing on it reads as a floor, and one
 * bottle going round in a circle reads as a lagoon. Off entirely below a third
 * of the tide, and never drawn where the paving is dry.
 */
const venFLOT_N = 12;
let venFlotMesh = null;
const venFlotData = new Float32Array(venFLOT_N * 4);   // x, z, spin, kind
function venBuildFlotsam(root) {
  const M = venMerger();
  M.box(0, 0, 0, 0.62, 0.28, 0.46, 0xffffff);
  const im = new THREE.InstancedMesh(M.build(), mat(0xffffff, { vertexColors: true }), venFLOT_N);
  im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(venFLOT_N * 3), 3);
  const COLS = [PALETTE.venBriccola, PALETTE.venBriccolaR, PALETTE.venPasserelle,
                PALETTE.venShutter, PALETTE.venAwning, PALETTE.venBriccolaW];
  const c = new THREE.Color();
  for (let i = 0; i < venFLOT_N; i++) {
    const o = i * 4;
    venFlotData[o] = lerp(venPZ_X0 + 3, venPZ_X1 - 3, (i * 0.37) % 1);
    venFlotData[o + 1] = lerp(venPZ_Z0 + 4, venPT_Z1 - 4, (i * 0.61) % 1);
    venFlotData[o + 2] = i * 0.9;
    venFlotData[o + 3] = 0.55 + (i % 4) * 0.35;
    c.set(COLS[i % COLS.length]);
    im.instanceColor.setXYZ(i, c.r, c.g, c.b);
  }
  im.instanceColor.needsUpdate = true;
  im.castShadow = true;
  im.frustumCulled = false;
  im.visible = false;
  root.add(im);
  venFlotMesh = im;
}
function venUpdateFlotsam(dt) {
  if (!venFlotMesh) return;
  const lvl = venTideLevel();
  const vis = lvl > 0.34;
  if (vis !== venFlotMesh.visible) venFlotMesh.visible = vis;
  if (!vis) return;
  for (let i = 0; i < venFLOT_N; i++) {
    const o = i * 4;
    // it drifts on the same slow circulation the flock wheels on, because in a
    // square with four walls round it that is genuinely what the water does
    venFlotData[o] += Math.sin(venTime * 0.13 + i * 1.7) * 0.18 * dt * 6;
    venFlotData[o + 1] += Math.cos(venTime * 0.11 + i * 2.3) * 0.18 * dt * 6;
    venFlotData[o] = clamp(venFlotData[o], venPZ_X0 + 2.5, venPZ_X1 - 2.5);
    venFlotData[o + 1] = clamp(venFlotData[o + 1], venPZ_Z0 + 3, venPT_Z1 - 3);
    venFlotData[o + 2] += dt * (0.12 + (i % 3) * 0.07);
    // a thing that is not floating on anything must not be drawn: at half tide
    // the north end of the square is under and the Molo is not
    const wet = venWaterY > venTerrain(venFlotData[o], venFlotData[o + 1]) + 0.25 ? 1 : 0.0001;
    const s = venFlotData[o + 3] * wet;
    venFlotMesh.setMatrixAt(i, venXform(venFlotData[o], venWaterY + 0.02, venFlotData[o + 1],
      Math.sin(venTime * 1.1 + i) * 0.06, venFlotData[o + 2],
      Math.sin(venTime * 0.9 + i * 2) * 0.05, s, s, s));
  }
  venFlotMesh.instanceMatrix.needsUpdate = true;
}

function venBuildLamps(root) {
  const list = [];
  for (let i = 0; i < 14; i++) {
    const z = lerp(venPZ_Z0 + 3, venPT_Z1 - 2, i / 13);
    if (Math.abs(z - venARCH_Z) > venARCH_W * 0.5) {
      venPush9(list, venPZ_X0 + 0.6, 4.0, z, 0, 0, 0, 0.5, 0.5, 0.5);
      // and every one of them lands on the flood. Twenty-six warm smears on a
      // sheet of green is the entire difference between a wet square and the
      // photograph of one — see THE MIRROR below.
      venMirAdd(venPZ_X0 + 1.4, z, 1.5, 5.2, PALETTE.venLamp);
    }
    // THE EAST RUN STOPS AT THE TOWER. The arcade it hangs on now ends at
    // venORO_Z1, so a lamp past that was screwed to fifteen metres of solid
    // Torre dell'Orologio, four metres up, with nothing round it.
    if (z < -21 && z > venORO_Z1) {
      venPush9(list, venPZ_X1 - 0.6, 4.0, z, 0, 0, 0, 0.5, 0.5, 0.5);
      venMirAdd(venPZ_X1 - 1.4, z, 1.5, 5.2, PALETTE.venLamp);
    }
  }
  // and one on each keystone of the sotoportego, so at the top of the tide the
  // way out of the square is the brightest thing on that wall
  for (let i = 0; i < venARCH_LAMPS.length; i += 3) {
    venPush9(list, venARCH_LAMPS[i], venARCH_LAMPS[i + 1], venARCH_LAMPS[i + 2],
             0, 0, 0, 0.62, 0.62, 0.62);
    venMirAdd(venARCH_LAMPS[i], venARCH_LAMPS[i + 2] + 1.6, 2.0, 6.4, PALETTE.venLamp);
  }
  // A LAMP IS NOT A SURFACE RECEIVING A SUN. These were mat() — a Lambert, with
  // no emissive term at all — hung in the shadowed soffit of a loggia, and the
  // comment two lines up claims they are the brightest thing on that wall. They
  // were the dimmest: a grey sphere in a dark hole. The fifth time this file's
  // family of chapters has learned it (ninety neon signs, the lasers, the
  // harbour reflections, the lampflies). Basic, and it clears the bloom.
  const im = new THREE.InstancedMesh(venG.sph6, new THREE.MeshBasicMaterial({
    color: PALETTE.venLamp }), list.length / 9);
  for (let i = 0; i < list.length / 9; i++) {
    const o = i * 9;
    im.setMatrixAt(i, venXform(list[o], list[o + 1], list[o + 2], 0, 0, 0,
                               list[o + 6], list[o + 7], list[o + 8]));
  }
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  root.add(im);
  venLampMesh = im;

  // ---- and the loggia's own, which are on whatever the tide is doing ------
  // The arcade lamps above come on with the water because the square going
  // under is a nine-o'clock-in-November sort of event; these are inside a
  // covered space with a solid soffit over it and they are on all day, because
  // in life they are.
  if (venLOG_LAMPS.length) {
    const L = venMerger();
    for (let i = 0; i < venLOG_LAMPS.length; i += 3) {
      L.sph(venLOG_LAMPS[i], venLOG_LAMPS[i + 1], venLOG_LAMPS[i + 2], 0.16, 0.20, 0.16, 0xffffff);
      // the little iron it hangs from
      L.box(venLOG_LAMPS[i], venLOG_LAMPS[i + 1] + 0.42, venLOG_LAMPS[i + 2],
            0.05, 0.62, 0.05, 0x555049);
    }
    const lm = new THREE.Mesh(L.build(), new THREE.MeshBasicMaterial({
      vertexColors: true, color: PALETTE.venLamp }));
    lm.frustumCulled = false;
    root.add(lm);
  }
  // ---- and the shop windows behind them ----------------------------------
  if (venSHOP_LIT.length) {
    const S = venMerger();
    for (let i = 0; i < venSHOP_LIT.length; i += 6) {
      S.box(venSHOP_LIT[i], venSHOP_LIT[i + 1], venSHOP_LIT[i + 2],
            venSHOP_LIT[i + 3], venSHOP_LIT[i + 4], venSHOP_LIT[i + 5], 0xffffff);
      // and something gold standing in it, which is what the window is for
      S.box(venSHOP_LIT[i], venSHOP_LIT[i + 1] - 0.22, venSHOP_LIT[i + 2],
            venSHOP_LIT[i + 3] * 0.42, 0.42, venSHOP_LIT[i + 5] * 0.42, 0xd9c288);
    }
    const sm = new THREE.Mesh(S.build(), new THREE.MeshBasicMaterial({
      vertexColors: true, color: PALETTE.venLamp }));
    sm.frustumCulled = false;
    root.add(sm);
  }
  if (venLOG_POOLS.length) {
    // Five rings a pool, sixteen sides, additive: a pool of lamplight on stone
    // is a curve and not a disc with an edge, and it ADDS to the stone rather
    // than tinting it. Same instrument as the Drift's lamp-post.
    const P = venMerger();
    for (let i = 0; i < venLOG_POOLS.length; i += 4) {
      const r = venLOG_POOLS[i + 3];
      for (let k = 4; k >= 0; k--) {
        const u = (k + 1) / 5;
        const f2 = (1 - u) * (1 - u) * 0.9 + 0.10;
        const g2 = Math.max(0, Math.min(255, Math.round(f2 * 255)));
        P.cyl(venLOG_POOLS[i], venLOG_POOLS[i + 1] - k * 0.003, venLOG_POOLS[i + 2],
              r * u * 1.10, 0.02, (g2 << 16) | (g2 << 8) | g2, 0, 0, 0, 16);
      }
    }
    const pm = new THREE.Mesh(P.build(), new THREE.MeshBasicMaterial({
      // ELEVEN PER CENT, and it was thirty. Five overlapping additive rings a
      // pool, on stone that is already the palest thing in the chapter, blew
      // the whole loggia floor to white at low tide — which is the same
      // mistake as the flooded square in the other direction. A lamp under a
      // vault warms the floor; it does not replace it.
      vertexColors: true, color: PALETTE.venLamp, transparent: true, opacity: 0.11,
      depthWrite: false, blending: THREE.AdditiveBlending }));
    pm.renderOrder = 2;
    pm.frustumCulled = false;
    root.add(pm);
  }
}

// ================================================================ THE MIRROR =
/**
 * WHAT A FLOODED SQUARE ACTUALLY LOOKS LIKE, and the reason every photograph of
 * this chapter exists.
 *
 * The tide, the boards, the levels and the siren were all correct and the
 * marquee moment still rendered as a sheet of sage-green paint, because a metre
 * of still water over pale trachyte is not a COLOUR — it is a MIRROR, and there
 * was not one reflected thing in the frame.
 *
 * The obvious way to get one is the way that was tried first and does not work:
 * build the city a second time, flipped in y, and draw it under a transparent
 * plane. The reflection lives below the paving, the paving is opaque and drawn
 * first, and the whole thing is invisible; turning depth off trades an invisible
 * reflection for an upside-down basilica painted over the sky.
 *
 * The cheap version is the one Mong Kok already uses on the harbour: a SMEAR of
 * the object's own colour lying ON the water, broken into segments that get
 * narrower and dimmer as they run away from it. The difference here is that
 * Mong Kok's camera only ever looks one way across the water and this one is a
 * square you walk round — so a smear pointing a fixed direction would be wrong
 * from three sides of it. A reflection in a horizontal mirror always runs from
 * the object TOWARD THE VIEWER, which is one atan2 per reflector per frame.
 *
 * One instanced mesh, one draw call, forty-odd reflectors, and the whole thing
 * is off entirely until the water is up.
 */
const venMIR = [];                 // { x, z, w, len, col }
const venMIR_SEG = 6;
let venMirMesh = null, venMirMat = null;

/** Register a vertical thing that the flood should carry. h is its height; the
 *  smear runs about four fifths of it, because a reflection foreshortens. */
function venMirAdd(x, z, w, h, color) {
  venMIR.push({ x: x, z: z, w: w, len: h * 0.82, col: new THREE.Color(color) });
}

function venBuildMirror(root) {
  if (!venMIR.length) return;
  // The unit smear: SEG flat plates along local +z from 0 to 1, each narrower
  // and darker than the last. The FADE IS IN THE VERTEX COLOUR because
  // instanceColor MULTIPLIES vColor — which is also why this has to be built
  // through the merger rather than out of a bare PlaneGeometry, since a
  // geometry with no colour attribute and vertexColors:true renders black.
  const M = venMerger();
  const grey = (v) => { const g = Math.max(0, Math.min(255, Math.round(v * 255)));
                        return (g << 16) | (g << 8) | g; };
  for (let k = 0; k < venMIR_SEG; k++) {
    const u = (k + 0.5) / venMIR_SEG;
    const f = (1 - u) * (1 - u) * 0.94 + 0.06;
    const dz = 1 / venMIR_SEG + 0.03;
    // and it WANDERS. A reflection on water that is dead straight is a runway.
    const jit = Math.sin(k * 2.7) * 0.10;
    const w = 1 - u * 0.30;
    // THREE PLATES ACROSS, NOT ONE. A single plate per segment has a hard side
    // edge, and forty hard-edged strips laid on a square is a floor tiled in
    // light rather than a reflection in it. The two outer plates are a third of
    // the brightness and carry the width out past the core, which is a lateral
    // falloff for the price of two more boxes.
    M.box(jit, 0, u, w * 0.52, 0.02, dz, grey(f));
    M.box(jit - w * 0.42, 0, u, w * 0.44, 0.02, dz * 0.94, grey(f * 0.34));
    M.box(jit + w * 0.42, 0, u, w * 0.44, 0.02, dz * 0.94, grey(f * 0.34));
  }
  // ADDITIVE, and that is not a preference. With normal blending the
  // vertex-colour fade MULTIPLIES the water underneath it, so a reflection of
  // a gold dome rendered as a brown slab of mud lying on a green square — the
  // exact opposite of the thing it is a picture of. Light on water is added to
  // the water; the fade to black at the far end then costs nothing at all,
  // which is also why the gradient can live in the vertex colour.
  venMirMat = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending });
  const im = new THREE.InstancedMesh(M.build(), venMirMat, venMIR.length);
  im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(venMIR.length * 3), 3);
  for (let i = 0; i < venMIR.length; i++) {
    const c = venMIR[i].col;
    im.instanceColor.setXYZ(i, c.r, c.g, c.b);
  }
  im.instanceColor.needsUpdate = true;
  im.frustumCulled = false;
  im.renderOrder = 4;               // over the water sheet, which is 3
  im.visible = false;
  root.add(im);
  venMirMesh = im;
}

function venUpdateMirror(game) {
  if (!venMirMesh) return;
  const lvl = venTideLevel();
  // It arrives with the water and it arrives LATE — two centimetres of water
  // does not reflect a campanile. Under a third of the tide there is nothing.
  const a = clamp((lvl - 0.32) / 0.5, 0, 1);
  venMirMat.opacity = a * 0.42;
  const vis = a > 0.02;
  if (vis !== venMirMesh.visible) venMirMesh.visible = vis;
  if (!vis) return;
  const cam = game.camera && game.camera.position;
  if (!cam) return;
  const y = venWaterY + 0.014;
  for (let i = 0; i < venMIR.length; i++) {
    const m = venMIR[i];
    // A REFLECTION NEEDS SOMETHING TO REFLECT IN. The campanile's foot, the
    // basilica's steps and half the lamps stand on ground that is a metre
    // higher than the square, so at half tide there is dry stone under them and
    // a smear laid on it is a stain. Collapsed to nothing rather than hidden:
    // one scale write is cheaper than touching .visible on an instance.
    const wet = venIsOverWater(m.x, m.z) ? 1 : 0;
    const yaw = Math.atan2(cam.x - m.x, cam.z - m.z);
    venMirMesh.setMatrixAt(i, venXform(m.x, y, m.z, 0, yaw, 0, m.w * wet, 1, m.len * wet));
  }
  venMirMesh.instanceMatrix.needsUpdate = true;
}

// ============================================================ TASK PLUMBING =
// ================================================================== IL VOLO ==
// THE SECOND MINI, and it is the one thing in this chapter that goes UP.
//
// Everything in Venice is at sea level or below it, which is the point of the
// place and the point of the chapter — the tide, the levels, the duckboards and
// the flood are all arguments about a metre. The consequence, which was not
// noticed until the pacing audit, is that this is the only chapter in the game
// whose player never once sees it from above.
//
// So: il Volo dell'Angelo. On the first Sunday of Carnevale somebody comes down
// a wire from the belfry of the Campanile into the middle of the square, in
// front of the entire city, and has done since about 1548. The rig is up: a
// steel wire from thirty-four metres to a little gilded stage at the far end of
// the Piazza, forty-eight metres away past the front of the basilica.
//
// AND THE HAUL UP IS THE BUILD. The flight itself is nine seconds; what makes
// this worth a caption is the eleven seconds BEFORE it, going up backwards over
// the whole square with the arcades opening out underneath — which is the one
// view of San Marco this chapter did not have.
//
// It runs on its own clock whether or not anybody is in it, because a rig that
// only ever moves when the player is standing in it is a lift, not a festival.
// Stand in the cradle and it takes you at the next departure; press E and it
// goes now.
const venVOLO_A = { x: -4, y: 0.90, z: -50 };     // the stage, at the basilica end
// THE TOP ANCHOR IS OUTSIDE THE TOWER, and both numbers were paid for. The
// campanile is a static box 7.8 m square standing to y = 34 (venBuildSquares),
// and the first cut put the belfry end at (11.4, 33.4, -18.6) — which is INSIDE
// it on all three axes. Measured: the cradle rode perfectly for thirty metres,
// entered the tower over the last two, and the solver resolved the overlap by
// ejecting its passenger thirty-two metres onto the paving. Every run.
// 7.2 is clear of the face at 8.3, -21.6 is clear of the near wall at -20.9,
// and 34.6 is over the top of the box in any case: clear three ways.
const venVOLO_B = { x: 7.2, y: 34.6, z: -21.6 };  // the belfry rail
const venVOLO_WAIT = 15.0;         // s on the stage between flights
const venVOLO_UP = 12.5;           // s of haul
const venVOLO_HOLD = 3.0;          // s at the top, and it is the whole set piece
const venVOLO_DOWN = 10.0;         // s of flight
const venVOLO_HW = 0.80;           // half-width of the cradle floor
const venVOLO_KERB = 0.26;         // low, and OUT at the edges. See CONTRACT.
let venVoloGroup = null, venVoloBody = null, venVoloWire = null;
let venVoloPhase = 0;              // 0 waiting, 1 up, 2 held, 3 down
let venVoloT = 0;
let venVoloU = 0;                  // 0 at the stage, 1 at the belfry
let venVoloPX = venVOLO_A.x, venVoloPY = venVOLO_A.y, venVoloPZ = venVOLO_A.z;
let venVoloAboard = false, venVoloDone = false, venVoloTold = false;
let venVoloConf = null, venVoloConfT = -1;
let venVoloScare = 0;
const venVoloPos = new THREE.Vector3(venVOLO_A.x, venVOLO_A.y, venVOLO_A.z);

function venVoloAt(u, out) {
  out.x = lerp(venVOLO_A.x, venVOLO_B.x, u);
  out.y = lerp(venVOLO_A.y, venVOLO_B.y, u);
  out.z = lerp(venVOLO_A.z, venVOLO_B.z, u);
  return out;
}
const venVoloPt = { x: 0, y: 0, z: 0 };

function venBuildVolo(game, root) {
  // ---- the stage and the wire (static) -----------------------------------
  const S = venMerger();
  S.box(venVOLO_A.x, venVOLO_A.y * 0.5, venVOLO_A.z, 5.0, venVOLO_A.y, 5.0, PALETTE.venStone);
  S.box(venVOLO_A.x, venVOLO_A.y + 0.03, venVOLO_A.z, 4.4, 0.08, 4.4, PALETTE.venGold);
  for (let s = -1; s <= 1; s += 2) {
    S.cyl(venVOLO_A.x + s * 2.2, venVOLO_A.y + 2.6, venVOLO_A.z, 0.10, 5.2,
          PALETTE.venBriccola, 0, 0, 0, 6);
    S.box(venVOLO_A.x + s * 2.2, venVOLO_A.y + 5.3, venVOLO_A.z, 0.34, 0.5, 0.34, PALETTE.venGold);
  }
  venStaticBox(game, venVOLO_A.x, venVOLO_A.y * 0.5, venVOLO_A.z, 5.0, venVOLO_A.y, 5.0);
  const sm = new THREE.Mesh(S.build(), venVC());
  sm.castShadow = true; sm.receiveShadow = true;
  root.add(sm);

  // THE WIRE ITSELF, and it has to be drawn or the whole thing is a cradle
  // floating up a diagonal. One long thin box, rotated onto the chord — cheaper
  // and more legible than a line, which this renderer would antialias away.
  {
    const dx = venVOLO_B.x - venVOLO_A.x, dy = venVOLO_B.y - venVOLO_A.y,
          dz = venVOLO_B.z - venVOLO_A.z;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const W = venMerger();
    W.box(0, 0, 0, 0.07, 0.07, len, PALETTE.venFerro);
    const wm = new THREE.Mesh(W.build(), venVC());
    wm.position.set((venVOLO_A.x + venVOLO_B.x) * 0.5, (venVOLO_A.y + venVOLO_B.y) * 0.5 + 1.55,
                    (venVOLO_A.z + venVOLO_B.z) * 0.5);
    wm.rotation.set(-Math.atan2(dy, Math.hypot(dx, dz)), Math.atan2(dx, dz), 0, 'YXZ');
    root.add(wm);
    venVoloWire = wm;
  }

  // ---- the cradle --------------------------------------------------------
  const M = venMerger();
  M.box(0, 0, 0, venVOLO_HW * 2, 0.14, venVOLO_HW * 2, PALETTE.venGondolaTr);
  M.box(0, 0.06, 0, venVOLO_HW * 2 - 0.16, 0.05, venVOLO_HW * 2 - 0.16, PALETTE.venGold);
  // KERBS LOW AND OUT AT THE EDGES. Measured on Cappadocia's basket: 0.38 m in
  // from the rim wedged the animal between two of them and the solver resolved
  // the overlap the only way it could, which was eight metres straight up.
  for (let s = -1; s <= 1; s += 2) {
    M.box(s * venVOLO_HW, venVOLO_KERB * 0.5, 0, 0.08, venVOLO_KERB, venVOLO_HW * 2, PALETTE.venGold);
    M.box(0, venVOLO_KERB * 0.5, s * venVOLO_HW, venVOLO_HW * 2, venVOLO_KERB, 0.08, PALETTE.venGold);
  }
  // the frame it hangs in, and the trolley on the wire
  for (let sx = -1; sx <= 1; sx += 2) {
    for (let sz = -1; sz <= 1; sz += 2) {
      M.cyl(sx * (venVOLO_HW - 0.06), 0.85, sz * (venVOLO_HW - 0.06), 0.04, 1.6,
            PALETTE.venFerro, 0, 0, 0, 4);
    }
  }
  M.box(0, 1.62, 0, 0.9, 0.12, 0.9, PALETTE.venFerro);
  M.box(0, 1.86, 0, 0.30, 0.36, 0.60, PALETTE.venFerro);
  // and the wings, because it is the FLIGHT of the angel and this is a game
  // about a rodent
  for (let s = -1; s <= 1; s += 2) {
    M.box(s * 0.95, 0.62, -0.24, 1.10, 0.07, 0.95, PALETTE.venGoldPale, 0, s * 0.42, s * 0.30);
    M.box(s * 1.55, 0.80, -0.55, 0.85, 0.06, 0.70, PALETTE.venGoldPale, 0, s * 0.70, s * 0.44);
  }
  const mesh = new THREE.Mesh(M.build(), venVC());
  mesh.castShadow = true;
  venVoloGroup = new THREE.Group();
  venVoloGroup.name = 'venVolo';
  venVoloGroup.add(mesh);
  root.add(venVoloGroup);

  // ---- the coriandoli ----------------------------------------------------
  {
    const C = venMerger();
    C.box(0, 0, 0, 0.11, 0.02, 0.11, PALETTE.venGoldPale);
    venVoloConf = new THREE.InstancedMesh(C.build(), venVC(), 56);
    venVoloConf.frustumCulled = false;
    venVoloConf.visible = false;
    root.add(venVoloConf);
  }

  // ---- collision: the floor and the four kerbs ---------------------------
  const b = new CANNON.Body({
    mass: 0, type: CANNON.Body.KINEMATIC,
    material: game.mats ? game.mats.ground : undefined,
  });
  b.addShape(new CANNON.Box(new CANNON.Vec3(venVOLO_HW, 0.07, venVOLO_HW)),
             new CANNON.Vec3(0, 0, 0));
  for (let s = -1; s <= 1; s += 2) {
    b.addShape(new CANNON.Box(new CANNON.Vec3(0.04, venVOLO_KERB * 0.5, venVOLO_HW)),
               new CANNON.Vec3(s * venVOLO_HW, venVOLO_KERB * 0.5, 0));
    b.addShape(new CANNON.Box(new CANNON.Vec3(venVOLO_HW, venVOLO_KERB * 0.5, 0.04)),
               new CANNON.Vec3(0, venVOLO_KERB * 0.5, s * venVOLO_HW));
  }
  b.allowSleep = false;
  venVoloPhase = 0; venVoloT = 0; venVoloU = 0;
  b.position.set(venVOLO_A.x, venVOLO_A.y, venVOLO_A.z);
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
  game.world.addBody(b);
  venVoloBody = b;
  venVoloPos.set(venVOLO_A.x, venVOLO_A.y, venVOLO_A.z);
  venVoloGroup.position.copy(venVoloPos);
}

/** True when the animal is standing IN the cradle, and not merely under it. */
function venInVolo(p) {
  const b = venVoloBody;
  if (!b || !p) return false;
  return Math.abs(p.x - b.position.x) < venVOLO_HW + 0.35 &&
         Math.abs(p.z - b.position.z) < venVOLO_HW + 0.35 &&
         p.y > b.position.y - 0.4 && p.y < b.position.y + 2.4;
}

function venUpdateVolo(game, dt) {
  const b = venVoloBody;
  if (!b || dt <= 0) { if (b) b.velocity.setZero(); return; }
  const capy = game.capy;
  const input = game.input;
  venVoloT += dt;
  venVoloAboard = !!(capy && venInVolo(capy.position));

  if (venVoloPhase === 0) {
    venVoloU = 0;
    // it goes at the next departure, or NOW if whoever is in it says so
    const early = venVoloAboard && input && input.actionPressed && venVoloT > 0.6;
    if (venVoloT >= venVOLO_WAIT || early) {
      venVoloPhase = 1; venVoloT = 0;
      venSfx('chime', { volume: 0.55, pitch: 0.6 });
    }
  } else if (venVoloPhase === 1) {
    const u = clamp(venVoloT / venVOLO_UP, 0, 1);
    // eased at both ends: a winch that starts at full speed snatches, and a
    // snatch is the one thing that would put the passenger over the kerb
    venVoloU = u * u * (3 - 2 * u);
    // HOLD THE SWELL ACROSS THE BUILD. swell() takes the max of the live
    // envelope, so calling it every frame is how a build is held.
    if (venVoloAboard && game.music && typeof game.music.swell === 'function') {
      game.music.swell(0.20 + venVoloU * 0.32);
    }
    if (u >= 1) { venVoloPhase = 2; venVoloT = 0; }
  } else if (venVoloPhase === 2) {
    venVoloU = 1;
    if (venVoloAboard && game.music && typeof game.music.swell === 'function') {
      game.music.swell(0.52);
    }
    if (venVoloT >= venVOLO_HOLD) {
      venVoloPhase = 3; venVoloT = 0;
      venVoloConfT = 0;
      venSfx('cheer', { volume: 0.85, force: true });
      venSfx('chime', { volume: 0.75, pitch: 0.42, force: true });
      if (game.shake && venVoloAboard) game.shake(0.16);
      if (venVoloAboard && !venVoloDone) {
        venVoloDone = true;
        venTask('volo');
      }
    }
  } else {
    const u = clamp(venVoloT / venVOLO_DOWN, 0, 1);
    // it LEAVES quickly and arrives slowly, which is what a wire does
    venVoloU = 1 - u * u * (3 - 2 * u);
    if (u >= 1) { venVoloPhase = 0; venVoloT = 0; }
  }

  venVoloAt(venVoloU, venVoloPt);
  // Kinematic, moved by VELOCITY, differenced against the PREVIOUS TARGET on
  // all three axes — contract rule 3, and the vertical is the axis that bit on
  // Cappadocia's mare.
  b.velocity.set(clamp((venVoloPt.x - venVoloPX) / dt, -14, 14),
                 clamp((venVoloPt.y - venVoloPY) / dt, -14, 14),
                 clamp((venVoloPt.z - venVoloPZ) / dt, -14, 14));
  venVoloPX = venVoloPt.x; venVoloPY = venVoloPt.y; venVoloPZ = venVoloPt.z;

  // ---- AND THE SQUARE ANSWERS IT ------------------------------------------
  // A gilded angel on a wire crossing forty metres of Piazza San Marco at head
  // height, over a hundred and eighty pigeons, and not one of them moved. The
  // flight is this chapter's second set piece and until now the only thing on
  // screen that knew it was happening was the cradle. It puts up whatever is
  // under it — a moving twelve-metre bow-wave of birds — which is also, from
  // inside the cradle, the entire view.
  if ((venVoloPhase === 1 || venVoloPhase === 3) && venVoloPt.y < 15) {
    venVoloScare -= dt;
    if (venVoloScare <= 0) {
      venVoloScare = 0.22;
      // NO SOUND OF ITS OWN. This fires nine times a second over a twenty-two
      // second flight, and a rustle per burst measured SEVENTY-THREE of them
      // in a forty-four second soak — a permanent flutter rather than a
      // take-off. venUpdatePigeons already owns the one voice for 'the flock
      // went up': it watches the airborne COUNT and claps once when it jumps,
      // whatever caused the jump. One channel, one throttle, one sound.
      venPigeonScare(venVoloPt.x, venVoloPt.z, 12, 0.9);
    }
  }

  venVoloGroup.position.copy(b.interpolatedPosition);
  venVoloPos.copy(venVoloGroup.position);
  venVoloGroup.rotation.y = Math.atan2(venVOLO_B.x - venVOLO_A.x, venVOLO_B.z - venVOLO_A.z) +
                            (venVoloPhase === 3 ? Math.PI : 0);
  venVoloGroup.rotation.z = Math.sin(venVoloT * 1.7) * (venVoloPhase === 0 ? 0.012 : 0.045);

  // ---- AND NOTHING AT ALL IS DONE TO THE PASSENGER ------------------------
  // The first cut of this did what the balloon's basket does — assign the
  // animal's vertical velocity from inside the biome, and declare the frame
  // through carryFrame() — and it threw the rider off the top of the haul,
  // every run. MEASURED: rode at a steady 0.44 m over the floor for the whole
  // ascent, then 0.78, then thirty-two metres down.
  //
  // The diagnosis is worth keeping. Assigning the velocity means the animal
  // matches the floor EXACTLY and therefore never penetrates it, so there is no
  // contact — and with the frame declared rather than sniffed, capybara.js
  // latches it for capyPLAT_AIR (1.2 s) whether or not anything is underfoot.
  // At the top of the ease-out the cradle slows, the animal (in what is
  // genuinely free flight) does not, and it carries its whole horizontal frame
  // straight over a 26 cm kerb.
  //
  // The balloon needs that machinery because it rises at the same rate the
  // animal does. A winch does not: the floor comes up at three and a half
  // metres a second under an animal standing still, which is as honest a
  // contact as this solver ever gets. Ordinary friction, ordinary sniffing, no
  // biome-side writes. The accelerations are the safety argument — smoothstep
  // over thirty-two metres in twelve and a half seconds peaks at 1.3 m/s^2, an
  // eighth of a gravity, so the floor never falls away from its passenger.

  // ---- the coriandoli ----------------------------------------------------
  if (venVoloConfT >= 0 && venVoloConf) {
    venVoloConfT += dt;
    venVoloConf.visible = venVoloConfT < 7.5;
    for (let i = 0; i < 56; i++) {
      const a = i * 2.399, r = 0.6 + (i % 9) * 0.55;
      const t = venVoloConfT + (i % 5) * 0.3;
      const x = venVOLO_B.x + Math.cos(a) * r - t * 0.9;
      const z = venVOLO_B.z + Math.sin(a) * r + t * 1.9;
      const y = venVOLO_B.y + 1.2 - t * (1.6 + (i % 4) * 0.25);
      venVoloConf.setMatrixAt(i, venXform(x, Math.max(0.05, y), z,
        t * 4 + a, a + t, t * 2.6, 1, 1, 1));
    }
    venVoloConf.instanceMatrix.needsUpdate = true;
    if (venVoloConfT > 7.5) venVoloConfT = -1;
  }

  // ---- the pointer -------------------------------------------------------
  if (!venVoloTold && !venVoloDone && capy && capy.position && venVoloPhase === 0) {
    const p = capy.position;
    if (Math.hypot(p.x - venVOLO_A.x, p.z - venVOLO_A.z) < 11) {
      venVoloTold = true;
      venToast('stand in it. it goes on its own, or press E and it goes now.');
    }
  }
}

// ================================================================= THE WELL ==
// A CITY STANDING IN WATER, AND NOT A DROP OF IT DRINKABLE.
//
// Every campo in Venice has a vera da pozzo in the middle of it, and it is not a
// well: there is nothing under it to reach. It is the cap of a rainwater
// cistern — the whole square is a filter, the paving drains into sand, the sand
// drains into a clay-lined tank, and for eleven hundred years that was the only
// fresh water on the island. The one in this chapter has been standing in the
// campo at the end of the duckboards since the chapter was written, with a
// collider on it, and nothing has ever asked anybody to look at it.
//
// The rim is 1.1 m over the paving, which is one deliberate hop, and that is the
// whole task: get up on it and put your head in.
let venWellDone = false;
// ---- AND IT ANSWERS YOU -------------------------------------------------
// A stone shaft four metres deep with a foot of standing water in the bottom
// is the single most obvious echo in this game and the chapter had it as a
// collider. Wheek from the rim and it comes back — twice, quieter and lower,
// on the delay a four-metre shaft actually has — and there is no task on it,
// no counter, and no toast the second time. It is a thing that is simply true
// about the object, which is the whole point of it: the player finds it, tries
// it again to check they did not imagine it, and then tells somebody.
const venWELL_ECHO = [[0.30, 0.62, 0.90], [0.62, 0.40, 0.80]];   // delay, gain, pitch
let venWellEcho = -1, venWellEchoN = 0, venWellEchoX = 0, venWellEchoZ = 0;
let venWellSaid = false;

/** True when the animal is up on the cistern head rather than beside it. */
function venOnWell(p) {
  if (!p) return false;
  const dx = p.x - venCAMPO.x, dz = p.z - venCAMPO.z;
  return dx * dx + dz * dz < 2.2 * 2.2 && p.y > venCITY_Y + 0.7;
}

/** Bound to capy:wheek in createVenice. The shaft is what makes this legal. */
function venWellWheek(payload) {
  const p = payload && payload.position;
  // NEAR it, not on it — leaning over the rim is close enough to shout down a
  // well, and demanding the player be balanced on top of a 1.9 m block to hear
  // the joke is how a discovery becomes a chore.
  if (!p) return;
  const dx = p.x - venCAMPO.x, dz = p.z - venCAMPO.z;
  if (dx * dx + dz * dz > 3.4 * 3.4) return;
  venWellEcho = 0; venWellEchoN = 0;
  venWellEchoX = venCAMPO.x; venWellEchoZ = venCAMPO.z;
}

function venUpdateWell(game, dt) {
  if (venWellEcho < 0) return;
  venWellEcho += dt;
  while (venWellEchoN < venWELL_ECHO.length &&
         venWellEcho >= venWELL_ECHO[venWellEchoN][0]) {
    const e = venWELL_ECHO[venWellEchoN++];
    // FROM THE WELL, not from the animal: the whole tell is that the sound is
    // coming out of the hole rather than out of you. game.sfx pans and
    // attenuates against the camera, so this genuinely arrives from over there.
    venSfx('wheek', { volume: e[1], pitch: e[2],
                      at: { x: venWellEchoX, y: venCITY_Y + 0.4, z: venWellEchoZ } });
  }
  if (venWellEchoN >= venWELL_ECHO.length) {
    venWellEcho = -1;
    if (!venWellSaid) {
      venWellSaid = true;
      venToast('four metres of stone and a foot of rainwater. it answers.');
    }
  }
}

function venCheckWell(game) {
  if (venWellDone) return;
  const capy = game.capy;
  const input = game.input;
  if (!capy || !capy.position || !input || !input.actionPressed) return;
  // ON it, not beside it: the collider tops out at venCITY_Y + 1.1 and the
  // paving is at venCITY_Y, so anything over half a metre up is standing on the
  // cistern head rather than leaning against it.
  if (!venOnWell(capy.position)) return;
  venWellDone = true;
  venTask('the-well');
  venSfx('chime', { volume: 0.5, pitch: 0.6 });
  venToast('rainwater, filtered through the whole square. eleven hundred years of it.');
  // ...and it tells you the other thing it does, because a player who has just
  // been asked to put their head in a well is the one player in the game who
  // will definitely try shouting down it.
  if (!venWellSaid) venToast('try a wheek down it.');
}

// ================================================================ THE CALLI ==
// THE MAZE IS THE ONE PART OF THIS CITY THE CHAPTER BUILT AND NEVER USED.
//
// Forty-eight metres by sixty of lanes a metre and a half wide, cut in half by a
// rio with exactly two bridges over it, and the whole of it exists so that the
// duckboards have somewhere to lead. Not one task is in it.
//
// Cross it. East side to west side, which cannot be done without finding one of
// the two bridges, and the tide decides how unpleasant that is — the calli
// stand at venCITY_Y, so they are the DRY route while San Marco is under, and
// the same walk at low water is just a walk.
// ---- THE EXTENT, NOT THE DISPLACEMENT FROM WHEREVER YOU CAME IN ----------
// Exactly the bug that was found and fixed on `mirror-swim` and then left
// standing here, ten lines away, in the same file. `Math.abs(p.x - entryX)`
// asks "how far are you from the door you used", and the maze is FORTY-EIGHT
// metres wide against a required thirty-six — so a player who enters anywhere
// but within twelve metres of an edge (down from a bridge, in off the campo,
// back through a lane they had already used) can walk the whole thing east to
// west and score at most twenty-four. The task is not hard in that state, it is
// IMPOSSIBLE, and nothing says so.
//
// Track the furthest east and the furthest west of the whole visit and score
// the distance between them, which is what "side to side" actually means. It
// also, for free, lets a crossing be made in two goes with a look at the rio in
// between, which is how anybody actually crosses a maze.
const venCALLI_CROSS = 36;
let venCalliDone = false, venCalliIn = false;
let venCalliW = 0, venCalliE = 0;      // the extent of this visit, in x
let venCalliTold = false;

function venCheckCalli(game) {
  if (venCalliDone) return;
  const capy = game.capy;
  if (!capy || !capy.position) return;
  const p = capy.position;
  const inside = p.x > venCAL_X0 && p.x < venCAL_X1 && p.z > venCAL_Z0 && p.z < venCAL_Z1;
  if (!inside) { venCalliIn = false; return; }
  if (!venCalliIn) { venCalliIn = true; venCalliW = p.x; venCalliE = p.x; }
  if (p.x < venCalliW) venCalliW = p.x;
  if (p.x > venCalliE) venCalliE = p.x;
  const run = venCalliE - venCalliW;
  // ---- and it says how it is going, once, in the middle -------------------
  // A maze is the one place in this chapter where the player cannot see where
  // they are going, so a task measured in metres crossed needs to admit that it
  // is being measured. Half way, once a visit, and then never again.
  if (!venCalliTold && run > venCALLI_CROSS * 0.5) {
    venCalliTold = true;
    venToast('half way across. the rio is the hard bit — there are two bridges.');
  }
  if (run >= venCALLI_CROSS) {
    venCalliDone = true;
    venTask('the-calli');
    venSfx('pop', { volume: 0.5, pitch: 1.3 });
    venToast('two bridges over that rio and you found one of them.');
  }
}

function venTask(id) {
  const g = venGame;
  if (g && typeof g.completeTask === 'function') { try { g.completeTask(id); } catch (e) {} }
}
function venToast(t) {
  const g = venGame;
  if (g && typeof g.toast === 'function') { try { g.toast(t); } catch (e) {} }
}
function venSfx(n, o) {
  const g = venGame;
  // NEVER a bare synth call — the dispatcher is what supplies the default volume
  // and pitch AND wraps every voice in a try/catch. A direct call passed
  // undefined, NaN reached exponentialRampToValueAtTime, and the throw landed in
  // systems.update, which takes the camera and the HUD with it on the fourth one.
  if (g && typeof g.sfx === 'function') { try { g.sfx(n, o); } catch (e) {} }
}

// =============================================================== THE VOICES =
/**
 * WHAT A CITY MADE OF WATER SOUNDS LIKE, and this one made four noises.
 *
 * Before 23 Aug 2026 the whole audio of chapter ten was: a siren four times a
 * cycle, a splash when the square went under, a pop for each task and the
 * continuo underneath. A hundred and eighty pigeons left in silence, a metre
 * of sea arrived in silence, a gondola went past in silence and an orchestra
 * that is a NAMED LOCAL, with lines about playing through the acqua alta, had
 * never played a note.
 *
 * Four voices, all of them on their own clock, all of them distance-scaled off
 * the capybara, and none of them ever more than one throttled call a second:
 *
 *   the WATER, lapping, whenever the tide is actually over the paving;
 *   the ORCHESTRA at Florian's, four bars of it every twenty-odd seconds;
 *   the GONDOLIER's cry at the blind corner, which is a real signal;
 *   the BELLS, which live on the Torre — see venUpdateOrologio.
 */
let venLapT = 0;
let venBandT = 5, venBandN = 0;
let venBandRec = null;             // the violinist, so the bow goes up on the beat
let venCryT = 12;
let venBellsTold = false, venBandWetTold = false;
function venUpdateVoices(game, dt) {
  const cp = game.capy && game.capy.position;
  if (!cp) return;
  const lvl = venTideLevel();

  // ---- the water on the stones -------------------------------------------
  // Only where it is actually happening: `isOverWater` at the animal's own
  // feet, so standing in a dry calle while San Marco is a lagoon is silent,
  // which is the whole point of a chapter built out of levels.
  venLapT -= dt;
  if (venLapT <= 0) {
    const nearWet = venIsOverWater(cp.x, cp.z) ||
                    (venInZone('square', cp.x, cp.z) && lvl > 0.25);
    if (nearWet) {
      venLapT = 1.5 + Math.random() * 1.4;
      // deeper water is a lower, slower slap; two centimetres over stone is a
      // fast bright one, which is what the rise actually sounds like
      venSfx('splash', { volume: 0.09 + lvl * 0.15, pitch: 1.5 - lvl * 0.55 });
    } else {
      venLapT = 0.7;
    }
  }

  // ---- Florian's little orchestra ----------------------------------------
  // FOUR NOTES, NOT ONE. A single strum at a café is a shop bell; a rising
  // four-note figure is a phrase, and this band plays one thing on a loop
  // because that is exactly what a café orchestra does. He raises the bow on
  // the downbeat, so the picture and the sound are the same event.
  const dband = Math.hypot(cp.x - venCAFE.x, cp.z - venCAFE.z);
  venBandT -= dt;
  if (venBandT <= 0) {
    if (dband < 46) {
      // ---- AND THEY PLAY THROUGH IT ---------------------------------------
      // The violinist's own line is 'we play until the water is over the
      // pedals, then we play standing up', and the first cut of this silenced
      // the band the moment the arcade went under — which is the exact
      // opposite of the single most Venetian fact this chapter has. When the
      // water is over Florian's they play SLOWER and a tone lower, which is
      // what an orchestra with wet shoes sounds like, and they do not stop.
      const wet = venIsOverWater(venCAFE.x, venCAFE.z + 9.6);
      const v = clamp(0.42 - dband * 0.0072, 0.04, 0.42);
      const PH = [1.0, 1.19, 1.34, 1.5, 1.34, 1.19];
      venSfx('strum', { volume: v * (wet ? 0.85 : 1), pitch: PH[venBandN % PH.length] * (wet ? 0.84 : 1) });
      venBandN++;
      venBandT = (venBandN % PH.length === 0) ? 7.5 + Math.random() * 5 : (wet ? 0.86 : 0.62);
      if (venBandN % PH.length === 1 && venBandRec) venBandRec.gest = 1.1;
      if (wet && !venBandWetTold && dband < 16) {
        venBandWetTold = true;
        venToast('the orchestra has not stopped. they never do.');
      }
    } else {
      venBandT = 2.5;
    }
  }

  // ---- 'Òoi!' at the corner ----------------------------------------------
  // A gondolier shouts at every blind bend in this city because the alternative
  // is hitting somebody, and the Rialto is the blindest one there is. It only
  // goes when the boat is actually near the bridge, so it is a thing the world
  // does rather than a noise on a timer.
  venCryT -= dt;
  if (venCryT <= 0) {
    venCryT = 3;
    if (venGondBody && Math.abs(venGondS - venRIALTO_S) < 0.07) {
      const d2 = Math.hypot(cp.x - venGondBody.position.x, cp.z - venGondBody.position.z);
      if (d2 < 60) {
        venCryT = 11 + Math.random() * 6;
        venSfx('whistle', { volume: clamp(0.5 - d2 * 0.006, 0.08, 0.5), pitch: 0.72 });
      }
    }
  }

  // ---- and one line about the clock, once ---------------------------------
  if (!venBellsTold && venOroStruck > 0 &&
      Math.hypot(cp.x - venORO.x, cp.z - venORO.z) < 40) {
    venBellsTold = true;
    venToast('the two bronzes on the tower. they have been doing that since 1497.');
  }
}

// ================================================================= THE TIDE =
function venUpdateTide(game, dt) {
  const prevPhase = venPhase;
  venPhase += dt / venTIDE_PERIOD;
  while (venPhase >= 1) venPhase -= 1;

  const target = venTideY(venPhase);
  // damped rather than assigned, so a frame hitch cannot step the sea 40 cm
  venWaterY = damp(venWaterY, target, 6, dt);
  venWaterUni.value = venWaterY;   // and the city knows where the line is
  venWaveUni.value = venTime;

  // ---- THE SIREN ----------------------------------------------------------
  // Four rising tones, ninety seconds ahead of the water. It is the only warning
  // in this game and it is the reason the flood is a plan rather than an ambush.
  const crossed = (prevPhase < venTIDE_WARN && venPhase >= venTIDE_WARN) ||
                  (venPhase < prevPhase && venTIDE_WARN <= venPhase);
  if (crossed && venSirenT < 0) {
    venSirenT = 0; venSirenStep = 0;
    venToast('that is the siren. the water is about forty minutes out.');
    // ---- AND THE MAN WHOSE JOB IT IS SAYS SO -----------------------------
    // He is nine metres from the spawn point and the boards come out of the
    // shed behind him. Two seconds after the fourth tone, not on it, so it
    // lands as an answer rather than as part of the alarm.
    venCrewCall = 2.0;
  }
  if (venCrewCall > 0) {
    venCrewCall -= dt;
    if (venCrewCall <= 0 && venCrewRec) {
      venCrewRec.cd = 9;
      venCrewRec.gest = 2.6;
      venCrewRec.anchor.speak(venCREW_CALL[(venCrewSaid + 1) % venCREW_CALL.length]);
      venCrewSaid++;
    }
  }
  if (venSirenT >= 0) {
    venSirenT += dt;
    const want = Math.floor(venSirenT / 0.85);
    while (venSirenStep < want && venSirenStep < 4) {
      venSfx('horn', { volume: 0.55, pitch: 0.62 + venSirenStep * 0.13 });
      venSirenStep++;
    }
    if (venSirenT > 4.4) venSirenT = -1;
  }

  // ---- the boards go out with the water and come in after it --------------
  const wantBoards = venPhase > venTIDE_WARN - 0.01 && venPhase < venTIDE_FALL1 + 0.02;
  venBoardOut = damp(venBoardOut, wantBoards ? 1 : 0, 1.4, dt);
  if (venBoardGroup) {
    const drop = (1 - venBoardOut) * 40;
    venBoardGroup.position.y = -drop;
    const vis = venBoardOut > 0.02;
    if (vis !== venBoardGroup.visible) venBoardGroup.visible = vis;
  }
  if (venBoardBodies) {
    for (let i = 0; i < venBoardBodies.length; i++) {
      const r = venBoardBodies[i];
      const y = r.y - (1 - venBoardOut) * 40;
      const inv = dt > 1e-5 ? 1 / dt : 60;
      r.body.velocity.set(0, (y - r.body.position.y) * inv, 0);
      if (Math.abs(y - r.body.position.y) > 6) {
        r.body.position.y = y; r.body.velocity.set(0, 0, 0); venSyncBody(r.body);
      }
    }
  }

  // ---- the water sheet, the mirror and the lamps --------------------------
  const lvl = venTideLevel();
  if (venWaterMesh) {
    venWaterMesh.position.y = venWaterY;
    // ---- THE MIRROR IS A COLOUR, NOT A GEOMETRY -------------------------
    // The first cut of this built the campanile, the basilica and the arcades a
    // second time, flipped in y, and drew them under a half-transparent sheet.
    // It is the obvious way to get the photograph and it does not work: the
    // reflection lives BELOW the paving, the paving is opaque and drawn first,
    // and the whole thing is invisible. Turning depth testing off to fix that
    // trades an invisible reflection for an upside-down basilica painted over
    // whatever happens to be in front of the camera.
    //
    // What two centimetres of water on pale stone actually looks like is not a
    // second city, it is a SHEET THAT HAS TAKEN THE COLOUR OF THE SKY — so as
    // the tide comes up the water goes from the opaque green of a canal to a
    // thin, pale, faintly glowing film that the paving reads through. That is
    // three numbers and it is the shot.
    if (venWaterMat) {
      // 0.62 at the top, not 0.46: thinned that far the flooded square reads as
      // slightly damp paving rather than as water, and the one thing the marquee
      // moment has to communicate in its first frame is THERE IS WATER HERE.
      // MEASURED FROM THE RENDERED FRAME AGAIN, 21 Aug 2026, and it had gone
      // the OTHER way this time. At 0.80 opacity and the canal green pulled
      // 42 % toward a warm sky, a metre of water over pale trachyte resolves to
      // pale sage — which from four metres up is indistinguishable from the dry
      // stone it is standing on. The capybara was swimming, all hundred and
      // eighty pigeons were up, the tide read 0.95, and the square in the
      // picture was BEIGE. Deeper green, less sky, more cover: the flooded
      // square has to be a different VALUE from the dry one, not a different
      // temperature of the same one.
      venWaterMat.opacity = lerp(0.88, 0.94, lvl);
      // Only a THIRD of the way to the sky. Taken all the way, the flooded
      // square stopped reading as water at all from any camera near its own
      // level — a thin transparent sheet seen edge-on is nothing, and the one
      // thing the marquee has to say in its first frame is that the square has
      // gone under. It keeps most of the canal green and gains the sky.
      // NO EMISSIVE. Adding the sky as a LIGHT rather than as a colour was the
      // whole mistake: at the top of the tide it put (0.32, 0.29, 0.25) into
      // every pixel of the sheet, which is very nearly the colour of the dry
      // trachyte underneath it — so the flooded square rendered as the same pale
      // stone it had been ten seconds earlier and the marquee moment silently
      // stopped happening on screen. Measured from the rendered frame with the
      // capybara demonstrably swimming (wet 1.0, y = waterline + 0.08) and all
      // hundred and eighty pigeons in the air over it.
      //
      // What a flooded square looks like is the canal's own green going pale and
      // cold, and that is a COLOUR. One lerp, and it stays under half way, so
      // the paving still reads through it.
      venCol.set(PALETTE.venCanal).lerp(venCanalDeepCol, lvl * 0.80).lerp(venSkyCol, lvl * 0.20);
      venWaterMat.color.copy(venCol);
    }
    // ---- AND IT MOVES --------------------------------------------------
    // Two crossing waves and a third at an angle, all of them long and low, so
    // the chop is legible from the swim camera without ever reading as a sea.
    // It goes FLATTER at the top of the tide: a metre of water trapped inside
    // a square with buildings round all four sides really is glassier than a
    // canal, and it is also when the reflections have to hold still.
    if (venWaterAttr) {
      const amp = lerp(0.115, 0.048, lvl);
      const t = venTime;
      for (let i = 0; i < venWaterAttr.count; i++) {
        const wx = venWaterBase[i * 2], wz = venWaterBase[i * 2 + 1];
        venWaterAttr.setY(i,
          Math.sin(wx * 0.21 + t * 0.85) * amp +
          Math.sin(wz * 0.27 - t * 0.62) * amp * 0.8 +
          Math.sin((wx + wz) * 0.13 + t * 0.41) * amp * 0.7);
      }
      venWaterAttr.needsUpdate = true;
    }
  }

  // ---- THE SCORE COMES UP WITH THE WATER ----------------------------------
  // This chapter's set piece is the one with the longest build in the game: the
  // siren is forty minutes out, the boards go down, and the square takes about
  // ninety seconds to go under. All of that was happening in silence — the
  // harpsichord carried on exactly as it had been, and then a lift fired at the
  // end of it. game.music.swell() takes the MAX of the live envelope, so calling
  // it every frame HOLDS the swell (see iceland.js, which does the same thing
  // for the twelve seconds the aurora is climbing), and the arpeggio inside it
  // fires once at the front.
  //
  // Gated on being IN the square, because a tide you are watching from the
  // Rialto is weather, and it is only a moment if it is happening to you. It
  // reaches 0.72 rather than 1.0 so the tick at the top still has somewhere to
  // go: a build that arrives at full before the thing it is building to has
  // spent itself.
  if (lvl > 0.30 && game.music && typeof game.music.swell === 'function') {
    const cp = game.capy && game.capy.position;
    if (cp && venInZone('square', cp.x, cp.z)) {
      game.music.swell(clamp((lvl - 0.30) / 0.55, 0, 1) * 0.72);
    }
  }

  venLampT = damp(venLampT, lvl > 0.35 ? 1 : 0, 1.1, dt);
  // Toggled, never SCALED: these are instanced at world positions, so scaling
  // the mesh would slide every lamp toward the origin rather than brighten it.
  if (venLampMesh) venLampMesh.visible = venLampT > 0.35;

  // ---- the marquee: standing in the square when it goes ---------------------
  const capy = game.capy;
  const p = capy && capy.position;
  venFloodedNow = venIsOverWater(0, -34);
  if (venFloodedNow && !venWasFlooded) {
    venSeenFlood = true;
    if (typeof game.shake === 'function') game.shake(0.1);
    venSfx('splash', { volume: 0.65, pitch: 0.5 });
    // ---- THE WINDOW OPENS HERE. It does not also close here. --------------
    // See venFLOOD_GRACE below.
    venFloodWin = venFLOOD_GRACE;
    if (!venFloodDone && !(p && venInZone('square', p.x, p.z))) {
      venToast('san marco is going under. if you want to be in it, go now.');
    }
  }
  venWasFlooded = venFloodedNow;

  // ---- YOU ARE ALLOWED TO ARRIVE WHILE IT IS HAPPENING -------------------
  // This is the chapter's marquee — the one row in eleven that carries `wow` —
  // and it was a SINGLE-FRAME TEST. The water crosses the middle of the square
  // on exactly one frame of a two-hundred-and-five second cycle, and if the
  // capybara was not already inside the zone on that frame the whole set piece
  // was scenery and the player waited a hundred and seventy-five seconds for
  // another go with nothing at all to do in between. Measured: running for the
  // square from the Rialto the moment the siren goes is not fast enough, which
  // makes the siren — the chapter's only warning, and the entire reason the
  // flood is a plan rather than an ambush — a warning about something you have
  // already missed.
  //
  // "Be in San Marco when it goes under" is a THING THAT TAKES A WHILE, and it
  // is still going under for as long as it is still rising. So the window opens
  // on the front and stays open for as long as the water is shallow enough that
  // arriving is arriving rather than turning up afterwards: eighteen seconds,
  // which is about half of the rise, and it closes early if the square is
  // already deep. Nobody can bank it by swimming in at the top of the tide.
  // THE WINDOW IS THE ONLY GATE, AND THAT IS DELIBERATE. The first cut of this
  // also required the tide to be under 0.72 — reasoning that arriving at the
  // top of the flood is not arriving during it. MEASURED, and it was nearly a
  // no-op: venTerrain over the middle of the piazza is 0, isOverWater wants
  // 0.22 m of clearance, and 0.22 on a −1.30…0.95 range is tide 0.676 — so the
  // front crosses at 0.676 and the extra gate shut two seconds later. A player
  // walking into the square eight seconds after the water still got nothing,
  // which is the exact bug the window was written to fix.
  //
  // The window alone already says everything the level check was trying to:
  // it opens ONLY on the crossing edge and it is eighteen seconds long, so
  // there is no way to bank the marquee by swimming in at high water twenty
  // minutes later. Two gates for one idea, and the second one was wrong.
  if (venFloodWin > 0) {
    venFloodWin -= dt;
    if (!venFloodDone && p && venInZone('square', p.x, p.z)) {
      venFloodDone = true;
      venFloodWin = 0;
      venTask('acqua-alta');
      venToast('the whole square, in about ninety seconds. nobody is surprised but you.');
      // ---- THE MARQUEE MADE NO SOUND AT ALL --------------------------------
      // A toast and a completeTask, and nothing else: no cue, no punch, no
      // camera. The whole of San Marco going under, and the game's response was
      // a line of text. The chapter is mono besides — 1 of 27 venSfx calls
      // passes a position — so this one is placed on the water itself.
      const at = { x: p.x, y: venWaterHeightAt(p.x, p.z), z: p.z };
      venSfx('splash', { volume: 0.8, pitch: 0.7, at: at });
      if (typeof game.punch === 'function') game.punch(0.16);
      // ---- FRAMED (v26) ----------------------------------------------------
      // Measured mid-piazza at tide 0.62: ninety per cent pavement and one
      // stray plank. The Basilica, the Campanile and the two columns were all
      // out of frame — in the one chapter where the ground turning into a
      // mirror is the entire point, and the mirror had nothing to reflect.
      //
      // The camera goes south of the animal so the shot looks north up the
      // piazza at the Basilica, with the Campanile in the right third.
      if (typeof game.frameShot === 'function') {
        game.frameShot({ yaw: Math.atan2(p.x - venBASILICA.x, p.z - venBASILICA.z),
                         dist: 16, pitch: 14 * Math.PI / 180, raise: 3.5, hold: 3.6 });
      }
    }
  }
}

// ================================================================== TASKS ===
function venUpdateTasks(game, dt) {
  const capy = game.capy;
  if (!capy || !capy.position) return;
  const p = capy.position;
  const input = game.input;
  const spd = capy.velocity ? Math.hypot(capy.velocity.x, capy.velocity.z) : 0;

  // ---- the spritz ---------------------------------------------------------
  if (!venSpritzDone && venInZone('cafe', p.x, p.z) && input && input.actionPressed) {
    venSpritzDone = true;
    venTask('spritz-theft');
    venToast('eighteen euros. it was never going to be drunk by him anyway.');
    venSfx('pop', { volume: 0.9, pitch: 1.5 });
    if (venCafeGroup) venCafeGroup.rotation.z = 0.02;
  }

  // ---- the duckboards -----------------------------------------------------
  // A run, timed, from the first plank to the last. It cannot be attempted at
  // all until the boards are out, which cannot happen until the tide has been
  // up — so the chapter teaches its own mechanic by making the task impossible
  // to reach any other way.
  const bt = venBoardOut > 0.7 ? venBoardAt(p.x, p.z) : -1;
  const onBoards = bt >= 0 && p.y > venTerrain(p.x, p.z) + venBOARD_Y * 0.45;
  venOnBoards = onBoards;
  venBoardIdx = bt;
  if (onBoards) {
    if (venBoardRunT < 0) {
      // only START a run near one of the two ends, so wandering onto the middle
      // of the chain is not a run you have already half lost
      if (bt < 0.14 || bt > 0.86) { venBoardRunT = 0; venBoardFrom = bt < 0.5 ? 0 : 1; }
    } else {
      venBoardRunT += dt;
      // the clock, on the paper, while you are on the planks (v32)
      if (game.recordLive) game.recordLive('passerelle', venBoardRunT);
      const reached = venBoardFrom === 0 ? bt > 0.93 : bt < 0.07;
      if (reached) {
        if (!venBoardDone) {
          venBoardDone = true;
          venTask('passerelle');
          venToast('the passerelle. single file, and that is how it is done.');
          venSfx('pop', { volume: 0.9, pitch: 1.2 });
        }
        if (typeof game.record === 'function') game.record('passerelle', venBoardRunT);
        venBoardRunT = -1;
      } else if (venBoardRunT > 90) {
        venBoardRunT = -1;
      }
    }
  } else if (venBoardRunT >= 0) {
    // ---- A SHORT GRACE, AND THEN THE RUN IS OVER -------------------------
    // Falling off IS the task, so there is a cost; but ending it on the single
    // frame a corner clips the edge of a plank makes the run about the
    // controller rather than about the route. Eight tenths of a second is long
    // enough to stumble and get back on and far too short to swim anywhere.
    venBoardOff += dt;
    if (venBoardOff > 0.8) {
      // ---- AND IT SAYS SO ------------------------------------------------
      // The run ended silently. Nothing on screen changed, the paper still
      // showed the row open, and the only way to find out was to reach the far
      // end and get nothing — which is thirty seconds of a player believing
      // they are doing a task they stopped doing at the second plank. The one
      // rule this game has about state is that it may not be invisible.
      //
      // Only if the run had got somewhere, though: a two-second stumble off
      // the first plank is not a failure worth a sentence about it.
      if (venBoardRunT > 3 && !venBoardDone) {
        venToast('off the boards. that is the run gone — start again from either end.');
        venSfx('splash', { volume: 0.30, pitch: 1.35 });
      }
      venBoardRunT = -1;
    }
  }
  if (onBoards) venBoardOff = 0;

  // ---- the Rialto ---------------------------------------------------------
  // OVER THE TOP AND DOWN THE OTHER SIDE.
  //
  // The first two cuts asked for a sign change in the canal's own normal
  // coordinate WHILE the player was still on the deck, and both failed the same
  // way: a bridge is the one place in this chapter you are moving fast, on a
  // slope, with water either side — so the frame the sign flips on is quite
  // often the frame you are in the air, or over the parapet, or already in the
  // Grand Canal. Measured, a clean run across it registered nothing twice.
  //
  // What the task MEANS is "you went over it", so it is two memories rather
  // than one instant: which side you came from, and whether you have been up on
  // the arch since. Reaching the far side then finishes it, and it does not care
  // how gracefully. Going round by water sets the side again instead of ticking,
  // because that is not crossing the bridge.
  if (!venRialtoDone) {
    const near = venInZone('rialto', p.x, p.z);
    if (near) {
      venLinePoint(venCanX, venCanZ, venCanS, venCanLen, venRIALTO_S, venLineOut);
      const yaw = venLineOut.yaw;
      const along = (p.x - venLineOut.x) * Math.cos(yaw) + (p.z - venLineOut.z) * -Math.sin(yaw);
      const side = along > 3 ? 1 : along < -3 ? -1 : 0;
      if (p.y > venFOND_Y + 2.2) venRialtoHigh = 1;      // genuinely up on the arch
      if (side !== 0) {
        if (venRialtoFrom === 0) { venRialtoFrom = side; venRialtoT = 0; venRialtoHigh = 0; }
        else if (side === -venRialtoFrom) {
          if (venRialtoHigh) {
            venRialtoDone = true;
            venTask('rialto');
            venToast('nobody has ever crossed that bridge without stopping. until now.');
            venSfx('pop', { volume: 0.85, pitch: 1.15 });
          } else {
            venRialtoFrom = side; venRialtoT = 0;
          }
        }
      }
      if (venRialtoT >= 0) venRialtoT += dt;
    } else if (venRialtoFrom !== 0) {
      venRialtoFrom = 0; venRialtoHigh = 0; venRialtoT = -1;
    }
  }

  // ---- swimming the square ------------------------------------------------
  // Only counts across the FLOODED piazza, which means it can only be done at
  // the top of the tide, which makes it the last line of the chapter by
  // construction rather than by a rule — the same trick the fire at the desert
  // camp plays.
  // ALONG Z, NOT ALONG X. The square runs north from the water and is only
  // twenty-four metres across, so a crossing measured on x could never reach
  // thirty-four metres and the task was unreachable by construction — the
  // measurement was written before the whole chapter was turned ninety degrees
  // to face the camera, and it did not turn with it.
  if (venInZone('piazza', p.x, p.z) && venIsOverWater(p.x, p.z) &&
      p.y < venWaterY + 0.9) {
    // THE EXTENT, NOT THE DISPLACEMENT FROM AN ARBITRARY FIRST FRAME.
    // Anchoring on 'wherever you were when the water first reached you' is a
    // coin toss: measured, a swim from one end of the flooded square to the
    // other scored 16.6 m of a required 30, because the run had been anchored
    // halfway down it while the tide came in. Track the furthest north and the
    // furthest south of the whole swim and score the distance between them,
    // which is what 'the length of the square' actually means.
    if (!venSwimHas) { venSwimHas = true; venSwimFromX = p.z; venSwimTo = p.z; venSwimRun = 0; }
    if (p.z < venSwimFromX) venSwimFromX = p.z;
    if (p.z > venSwimTo) venSwimTo = p.z;
    venSwimRun = venSwimTo - venSwimFromX;
    if (venSwimRun > 30 && !venSwimDone) {
      venSwimDone = true;
      venTask('mirror-swim');
      venToast('a capybara, swimming the length of piazza san marco. as intended.');
      venSfx('splash', { volume: 0.8, pitch: 0.9 });
    }
  } else if (venSwimHas) {
    // ---- THE TIDE CAN END A SWIM TOO, NOT ONLY A WALK OUT OF THE SQUARE ---
    // The old test was `venSwimHas && !inZone('piazza')`, so an animal standing
    // in the middle of the square while the water fell out from under it kept
    // the run armed for ever: `swimRun()` — which the beacon and the paper both
    // read — went on reporting a figure from a tide that had finished, and the
    // next crossing was scored against a start point from the one before it.
    // The run ends when the SWIM ends, whichever way it ended.
    if (!venInZone('piazza', p.x, p.z) || !venIsOverWater(p.x, p.z)) {
      venSwimHas = false;
      venSwimRun = 0;
    }
  }

  // ---- one nudge, once ----------------------------------------------------
  if (venTideTold < 1 && venTime > 26) {
    venTideTold = 1;
    venToast('the water in this city is not a backdrop. keep an eye on it.');
  }
}

// =============================================================== LIFECYCLE ===
export function createVenice(game) {
  venGame = game;

  // The well answers a wheek. Bound once, and it gates on the animal actually
  // being at the campo's wellhead, so it costs one distance test per wheek
  // anywhere in the game.
  if (game.events && typeof game.events.on === 'function') {
    game.events.on('capy:wheek', function (payload) {
      if (!game.biome || !game.biome.isActive('venice')) return;
      try { venWellWheek(payload); } catch (e) {}
    });
  }

  game.biome.register('venice', {
    ensureBuilt() { venBuild(game); },
    onEnter() {
      // The tide is put back to an hour before the flood every time you arrive,
      // so a chapter you come back to opens the way it opened the first time —
      // low water, a minute to look round, and then the siren.
      venPhase = venTIDE_START;
      venWaterY = venTIDE_LOW;
      venSirenT = -1; venSirenStep = 0;
      venWasFlooded = false;
      venBoardRunT = -1; venBoardOff = 0;
      venRialtoT = -1; venRialtoFrom = 0; venRialtoHigh = 0;
      venSwimHas = false; venSwimRun = 0;
      venGondRideT = 0;
      venTideTold = 0;
      venTime = 0;
      venPigeonPeak = 0; venPigeonHold = 0; venPigeonRung = 0;
      // The clock is re-read rather than re-rung: without this the first frame
      // back in the chapter sees the hour jump from wherever the tide was left
      // to hour 0 and strikes six times at somebody who has just walked in.
      venOroLast = -1; venOroStruck = 0; venOroStrike = -1;
      venClatter = 0; venClatterN = 0;
      venBellsTold = false; venBandWetTold = false; venLapT = 0;
      // ---- AND THE REST OF THE AMBIENT CLOCKS -----------------------------
      // Every one of these is a running counter that only makes sense inside
      // one visit, and none of them was being put back. What it produced on a
      // return: the orchestra picking up in the middle of a phrase a tone flat
      // (venBandN is the note index and it decides both pitch and the gap to
      // the next one), the passerelle foreman answering a siren that went off
      // in a different country twenty minutes ago (venCrewCall), the seed man
      // mid-throw with thirty grains hanging in the air over a dry square, and
      // the Volo's bird-scare on a phase from the last flight. Cheap to clear,
      // invisible until you look for it, and all four of them are things the
      // player is meant to read as the world starting up around them.
      venBandT = 5; venBandN = 0;
      venCryT = 12;
      venCrewCall = -1;
      venSeedT = 7; venSeedThrow = -1;
      if (venSeedMesh) venSeedMesh.visible = false;
      venVoloScare = 0;
      venSwimRun = 0;
      venCalliIn = false; venCalliW = 0; venCalliE = 0; venCalliTold = false;
      venFloodWin = 0;
      venBoardOff = 0;
      venWellEcho = -1; venWellEchoN = 0;
      venMurmurT = 2.5; venVoloWatch = false; venVoloCheered = false;
      // The rig is put back on the stage, so the chapter opens with the cradle
      // where the player can walk into it rather than thirty metres up.
      venVoloPhase = 0; venVoloT = 0; venVoloU = 0; venVoloAboard = false;
      venVoloConfT = -1; venVoloTold = false;
      // AND PUBLISH IT. api.waterLevel is what capybara.js reads, and it is
      // written at the END of update() — so without this the first frame of a
      // re-entry solves the animal against whatever the tide was when it left,
      // which after a flood is a metre of water over a dry square.
      if (game.venice) game.venice.waterLevel = venWaterY;
    },
    onExit() {
      // ARMED FLAGS DO NOT SURVIVE TRAVEL. Every biome shares one coordinate
      // space, and a latch left set is a task that ticks in the wrong country.
      venCalliIn = false;
      // Anything stateful that could hold the player is cleared on the way out.
      // Every biome shares one coordinate space and a latch that survives travel
      // is a bug waiting for somewhere it makes no sense.
      venBoardRunT = -1; venRialtoT = -1; venRialtoFrom = 0; venRialtoHigh = 0;
      venSwimHas = false; venGondRideT = 0;
      venVoloAboard = false; venVoloConfT = -1;
    },
  });

  const api = {
    built() { return venBuilt; },
    terrainHeight: venTerrain,
    slopeAt: venSlope,
    // MUTATED EVERY FRAME. capybara.js reads waterLevel as a property, which is
    // exactly what a tide needs: one number, written here, and the swim
    // threshold, the float height and the clamber ceiling all move with it.
    waterLevel: venTIDE_LOW,
    isOverWater: venIsOverWater,
    waterHeightAt: venWaterHeightAt,
    inZone: venInZone,
    navBlocked: venNavBlocked,
    surfacePitch: venSurfacePitch,
    SPAWN: venSPAWN,

    // landmarks, for the beacons and the map
    piazza: { x: (venPZ_X0 + venPZ_X1) * 0.5, z: (venPZ_Z0 + venPZ_Z1) * 0.5 },
    basilica: venBASILICA,
    campanile: { x: venCAMPANILE.x, z: venCAMPANILE.z },
    /** The cradle MOVES, and for a third of its cycle it is thirty metres up. */
    volo() { return venVoloPos; },
    molo: { x: -4, z: 12 },
    cafe: venCAFE,
    campo: venCAMPO,
    /** The middle of the maze, for the beacon. */
    calli: { x: (venCAL_X0 + venCAL_X1) * 0.5, z: (venCAL_Z0 + venCAL_Z1) * 0.5 },
    /** The bridge's centre AND the axis it is crossed on. The axis is published
     *  because 'run over the Rialto' is a run along the canal's NORMAL and there
     *  is no way to guess that from outside — a diagonal that looks right on a
     *  map misses the deck entirely. */
    rialto() {
      if (!venCanX) return venCAMPO;
      venLinePoint(venCanX, venCanZ, venCanS, venCanLen, venRIALTO_S, venLineOut);
      venRialtoOut.x = venLineOut.x;
      venRialtoOut.y = venFOND_Y + 4;
      venRialtoOut.z = venLineOut.z;
      venRialtoOut.ax = Math.cos(venLineOut.yaw);
      venRialtoOut.az = -Math.sin(venLineOut.yaw);
      return venRialtoOut;
    },
    /** The duckboard chain's knots, flat: x, z, x, z. Read by the beacon and by
     *  anything that wants to follow the route rather than cut across it. */
    boardKnots() { return venBOARD_KNOTS; },
    /** The RESAMPLED duckboard centreline, flat: x, z, x, z. */
    boardPath() {
      const o = [];
      for (let i = 0; i < venBrdX.length; i++) { o.push(venBrdX[i], venBrdZ[i]); }
      return o;
    },
    /** The gondola MOVES. Ask; never cache. */
    // the traghetto. It MOVES — ask, never cache.
    traghetto() { return venTragPos; },
    onTraghetto() { return venTragAboard; },
    gondola() {
      if (!venGondBody) return venSPAWN;
      venV3.set(venGondBody.position.x, venGondBody.position.y, venGondBody.position.z);
      return venV3;
    },
    /** Where the first plank is, which is where a duckboard run starts. */
    boards() {
      if (!venBrdX) return venSPAWN;
      venV3b.set(venBrdX[0], venCITY_Y + venBOARD_Y, venBrdZ[0]);
      return venV3b;
    },

    /** 0..1 — how far up the tide is. systems.js reads it for the light. */
    tide: venTideLevel,
    tideY() { return venWaterY; },
    rising() { return venPhase >= venTIDE_WARN && venPhase < venTIDE_RISE1; },
    flooded() { return venFloodedNow; },
    seenFlood() { return venSeenFlood; },
    boardsOut() { return venBoardOut; },
    onBoards() { return venOnBoards; },
    pigeonsUp() { return venPigeonUp; },
    /** How far the current crossing of the flooded square has got, in metres. */
    swimRun() { return venSwimHas ? venSwimRun : -1; },

    update(dt) {
      if (!venBuilt) return;
      if (!game.biome.isActive('venice')) return;
      venTime += dt;

      venUpdateTide(game, dt);
      venUpdateOrologio(game, dt);
      venUpdateMirror(game);
      api.waterLevel = venWaterY;          // published, and it is the whole chapter
      venUpdateGondola(game, dt);
      venUpdateTraghetto(game, dt);
      venUpdateVolo(game, dt);
      venCheckWell(game);
      venUpdateWell(game, dt);
      venCheckCalli(game);
      venUpdateSeed(game, dt);
      venUpdatePigeons(game, dt);
      venUpdateCrowd(game, dt);
      venUpdateFlags(dt);
      venUpdateFlotsam(dt);
      venUpdateVoices(game, dt);
      venUpdateTasks(game, dt);

      // the lagoon breathes a little, because a completely flat sea reads as
      // glass and the Bacino is never glass
      // the Bacino is the same sea, so it rides the same tide — with a little
      // swell on it, because a dead-flat sea reads as glass and it is never glass
      if (venFloatGroup) venFloatGroup.position.y = venWaterY + Math.sin(venTime * 0.7) * 0.025;
      if (venLagoonMesh) venLagoonMesh.position.y = venWaterY + Math.sin(venTime * 0.5) * 0.05;
    },
  };
  game.venice = api;
  return api;
}

function venBuild(game) {
  if (venBuilt) return;
  venBuilt = true;
  venInitGeos();
  venBuildLines();
  venBakeTerrain();

  venRoot = new THREE.Group();
  venRoot.name = 'venice';
  game.scene.add(venRoot);

  venFloatM = venMerger();
  venRoot.add(venBuildGround());
  venBuildGroundBody(game);
  venBuildSquares(game, venRoot);
  venBuildOrologio(game, venRoot);
  venBuildCafe(game, venRoot);
  venBuildCalli(game, venRoot);
  venBuildCanal(game, venRoot);
  venBuildBoards(game, venRoot);
  venBuildGondola(game, venRoot);
  venBuildTraghetto(game, venRoot);
  venBuildVolo(game, venRoot);
  venBuildPigeons(venRoot);
  venBuildSeed(venRoot);
  venBuildLamps(venRoot);
  venBuildFlags(venRoot);
  venBuildAngel(venRoot);
  // everything moored, as one mesh whose y IS the waterline
  {
    const fm = new THREE.Mesh(venFloatM.build(), venVC());
    fm.castShadow = true; fm.receiveShadow = true;
    venFloatGroup = new THREE.Group();
    venFloatGroup.name = 'venMoored';
    venFloatGroup.add(fm);
    venFloatGroup.position.y = venWaterY;
    venRoot.add(venFloatGroup);
  }
  venBuildCrowd(venRoot);
  venBuildFlotsam(venRoot);
  venBuildFar(venRoot);
  venBuildWater(venRoot);
  // ---- and the things the flood carries ----------------------------------
  // Registered by hand rather than derived, because a reflection is anchored to
  // the WATERSIDE FACE of a thing and not to its centre: the campanile stands
  // at x 12 and the square stops at 8, so a smear at its middle would start
  // four metres inside a building that never floods. The lamps register
  // themselves in venBuildLamps.
  venMirAdd(7.4, venCAMPANILE.z, 7.0, 42, PALETTE.venBrick);        // the campanile
  venMirAdd(venBASILICA.x, -57.0, 24, 22, PALETTE.venGold);          // the domes
  venMirAdd(venBASILICA.x - 11, -56.4, 2.2, 13, PALETTE.venBriccolaR);   // and the three
  venMirAdd(venBASILICA.x, -56.4, 2.2, 13, PALETTE.venBriccolaR);        // flagpoles,
  venMirAdd(venBASILICA.x + 11, -56.4, 2.2, 13, PALETTE.venBriccolaR);   // which are red
  venMirAdd(venCOLUMNS[0].x, venCOLUMNS[0].z, 2.4, 14, PALETTE.venStone);
  venMirAdd(venCOLUMNS[1].x, venCOLUMNS[1].z, 2.4, 14, PALETTE.venStone);
  venBuildMirror(venRoot);

  // ---- THE PEOPLE WHO LIVE HERE ------------------------------------------
  // See npc.js, THE LOCALS. Each of these is a point somebody is standing at,
  // a few things they might say when the capybara turns up, and a different
  // few for when it wheeks at them. Where the chapter owns a Group for the
  // figure, it is handed over too and the figure turns to watch.
  //
  // ---- AND THEY KNOW WHAT THE WATER IS DOING (v21) -----------------------
  //
  // Nine people, in the one chapter in this game whose entire premise is that
  // the floor is about to change, and every one of them said the same three
  // sentences at low water, during the siren, at the top of the tide and after
  // it had gone out again. The waiter's line was 'the water comes at four,
  // everybody says nothing will happen' — said while standing in it.
  //
  // npc.js has had the machinery for this since v20 and this chapter used none
  // of it: a line may be `{ t, when }` for a live condition, `{ t, after }` /
  // `{ t, before }` for a task, and `onTask` names what somebody says about a
  // specific thing you did in front of them. So the tide is a CONVERSATION now
  // — three states, and everybody in the square has an opinion about each one —
  // and the cast reacts to the six tasks that happen where they are standing.
  //
  // The rule that keeps it from becoming a quiz: EVERY POOL STILL HAS AT LEAST
  // ONE UNCONDITIONAL LINE IN IT. localResolve returns only what is true right
  // now, and a person whose whole pool is gated is a person who says nothing at
  // the moment you walk up to them, which is worse than saying the wrong thing.
  const venDry  = () => venTideLevel() < 0.18;
  const venComing = () => venPhase >= venTIDE_WARN && venTideLevel() < 0.55;
  const venHigh = () => venTideLevel() >= 0.55;
  const venGoneOut = () => venSeenFlood && venTideLevel() < 0.18;

  if (typeof game.addLocal === 'function') {
    // ---- A LOCAL'S y IS NOT SNAPPED, IT IS BELIEVED ------------------------
    // npc.js puts the figure exactly where it is told, and this chapter is the
    // one place in the game where the ground is not one number: the square is
    // at 0, the city at 1.30, the Molo at 1.00 and the fondamente at 1.55.
    // The waiter was authored at venCITY_Y and Florian's is under the arcade
    // at the edge of the square, where the real floor is 0.67 — so the one
    // person the chapter's second task is about stood SIXTY-TWO CENTIMETRES in
    // the air, with his own shadow on the paving underneath him. Every local
    // in this chapter is placed off venTerrain now.
    venWaiterRec = game.addLocal({ biome: 'venice', x: venCAFE.x, y: venTerrain(venCAFE.x, venCAFE.z),
      z: venCAFE.z, near: 6,
      figure: { shirt: PALETTE.cloth6, legs: PALETTE.hair2 },
      lines: ['Signore. The tables are for the guests.',
              { t: 'Eleven euros for the spritz. Sitting down.', before: 'spritz-theft' },
              { t: 'Eleven euros. I am putting it on somebody’s bill. Yours, ideally.',
                after: 'spritz-theft' },
              { t: 'The water comes at four. Everybody says nothing will happen.', when: venDry },
              { t: 'There. Four notes. Now everybody believes me.', when: venComing },
              { t: 'The chairs go up at ten centimetres. We are past ten centimetres.',
                when: venComing },
              { t: 'Do not apologise. Everybody’s shoes are in the same state.', when: venHigh },
              { t: 'We serve standing in it. We have always served standing in it.',
                when: venHigh },
              { t: 'And it is gone, and nobody will mention it again until Thursday.',
                when: venGoneOut }],
      wheek: ['Basta! You will have the whole arcade looking.',
              'Madonna. Take the olive and go.',
              { t: 'Not over the water. It carries. Everyone in the square heard that.',
                when: venHigh }],
      onTask: { 'spritz-theft': ['That was somebody’s. That was somebody’s SPRITZ.',
                                 'The olive as well. Unbelievable.'],
                'acqua-alta': ['You stood in it on purpose. You are one of us now, God help you.'],
                'mirror-swim': ['He is SWIMMING. In the piazza. Somebody get a photograph.'] } });
    // ---- AND HE WAS STANDING IN THE WELL -----------------------------------
    // The man at the campo was authored at venCAMPO, which is the wellhead's
    // own centre — so he stood inside a 1.9 m box of solid Istrian stone with
    // his shoulders and head out of the top of it, in front of the one task in
    // this chapter that asks the player to climb ON that box. Three and a half
    // metres north of it, facing it, which is where somebody talking about a
    // well would actually stand.
    venWellRec = game.addLocal({ biome: 'venice', x: venCAMPO.x + 3.4, y: venTerrain(venCAMPO.x + 3.4, venCAMPO.z - 1.2),
      z: venCAMPO.z - 1.2, near: 7, face: -2.0,
      figure: { shirt: PALETTE.cloth5 },
      lines: ['The well has been dry since my grandmother.',
              { t: 'Duckboards go up tonight. You will see.', when: venDry },
              { t: 'There they go. Always the campo last. Always.', when: venComing },
              { t: 'Half of Venice is standing on a plank and the other half is at home.',
                when: venHigh },
              'You are the first of you I have seen in this campo.',
              // he is standing three metres from the one echo in the chapter,
              // so he is the person who would obviously mention it
              { t: 'Put your head over it and make a noise. Go on. Everybody does it once.',
                before: 'the-well' },
              { t: 'It comes back at you, doesn’t it. Four metres of stone will do that.',
                after: 'the-well' }],
      wheek: ['Every pigeon in the sestiere just left. Well done.',
              { t: 'Not at me. At the WELL. There is a difference and you will hear it.',
                before: 'the-well' }],
      onTask: { 'the-well': ['Eleven hundred years and you are the first to put a nose in it.'],
                'the-calli': ['You came through the calli? Which bridge? — no. Do not tell me.'],
                'passerelle': ['End to end without going in. That is more than the mayor managed.'] } });
    venGondRec = game.addLocal({ biome: 'venice', x: 4, y: venTerrain(4, 11), z: 11, near: 7,
      figure: { shirt: PALETTE.cloth6, hat: PALETTE.cloth3 },
      lines: ['Gondola, gondola? Fifty minutes, eighty euro.',
              { t: 'Stand at the front if you like. Everybody stands at the front.',
                before: 'gondola-ride' },
              { t: 'You stood at the front the whole way. Most people sit down at the bridge.',
                after: 'gondola-ride' },
              'Do not lean. Please. Do not lean.',
              { t: 'Eighty euro is for the boat. The singing is free and it is not on offer.',
                when: venDry },
              { t: 'High water I go where I like. Under the bridges is the problem, not over.',
                when: venHigh },
              // and the one piece of real navigation in the chapter, from the
              // one person qualified to give it
              { t: 'Òoi. That is what you shout at a blind corner. The Rialto is the blindest.',
                when: venDry }],
      wheek: ['I have heard worse singing in this boat.',
              'That is the corner call, near enough. Keep it.'],
      onTask: { 'gondola-ride': ['On the PROW. Like a figurehead that pays nothing.'],
                'traghetto': ['Standing. He crossed standing. Did everybody see that?'],
                'rialto': ['Over the top at a run. There are steps on that for a reason.'] } });
    // ---- AND FIVE MORE, because three people is not a city -----------------
    // Venice took eleven chapters to get anybody in it and then got a waiter, a
    // man by a well and a gondolier — in the most photographed square in Europe,
    // on the day the water comes over it. Every one of these is standing where
    // the chapter already sends you, so none of them is a detour: the orchestra
    // is at the café, the passerelle crew is where the boards come out, the
    // seed man is where the pigeons are, the mask-maker is on the way to the
    // campo and the fruit boat is at the foot of the Rialto.
    venBandRec = game.addLocal({ biome: 'venice', x: venCAFE.x + 1.0, y: venTerrain(venCAFE.x + 1.0, venCAFE.z + 8.2),
      z: venCAFE.z + 8.2, near: 6, face: -1.4,
      figure: { shirt: PALETTE.venStone, legs: PALETTE.venGondola },
      lines: ['We play until the water is over the pedals. Then we play standing up.',
              'Vivaldi. Always Vivaldi. They want the one from the advertisement.',
              { t: 'The cellist has wellingtons. I have shoes. This is the arrangement.',
                when: venDry },
              { t: 'He is putting the wellingtons on. He does it four notes in, every time.',
                when: venComing },
              // and at the top of the tide he is standing in it, playing, which
              // is the one fact about this city everybody knows and nobody
              // believes until they see it
              { t: 'Standing up. Told you. Andante, and mind the pedals.', when: venHigh },
              { t: 'It is a tone flat in this. The whole instrument is. So am I.',
                when: venHigh },
              { t: 'Sit down again, Paolo. It has gone. — He will not sit down.',
                when: venGoneOut }],
      wheek: ['A tenor! Sit down, we are in the middle of the andante.',
              'That is a B flat and it is nowhere in this piece.',
              { t: 'Hold it — hold it — no. Gone. You had it for a moment.',
                when: venHigh }],
      onTask: { 'acqua-alta': ['He stayed for it. Nobody stays for it.'],
                'mirror-swim': ['Do not stop playing. Do NOT stop playing.'],
                'volo': ['That is the Flight of the Angel, and that is a rodent doing it.'] } });
    venCrewRec = game.addLocal({ biome: 'venice', x: -8.5, y: venTerrain(-8.5, 10.0), z: 10.0, near: 7, face: 2.6,
      figure: { shirt: PALETTE.venBriccolaR, hat: PALETTE.cloth3 },
      lines: ['Passerelle. Six hundred metres of them, and they all live in a shed.',
              { t: 'One metre ten, the forecast says. That is the square and half the calli.',
                when: venDry },
              { t: 'When you hear the four notes, you have ninety seconds. Not eighty-nine.',
                when: venDry },
              { t: 'Boards are out. Single file, keep left, and do not stop in the middle.',
                when: venComing },
              { t: 'Yes it wobbles. It is a plank on a trestle in the sea. It wobbles.',
                when: venHigh },
              { t: 'Now we take them all up again. That is the part nobody photographs.',
                when: venGoneOut },
              { t: 'You want to run it? Everybody wants to run it. End to end, and mind the joins.',
                before: 'passerelle' },
              { t: 'End to end, dry. Right. I am putting you on the crew.',
                after: 'passerelle' }],
      wheek: ['Save it for the siren, eh? It has a better range than you.',
              { t: 'Four notes, that is the siren. You did one. Keep practising.',
                when: venDry }],
      onTask: { 'passerelle': ['Six hundred metres of that and he did the good bit.'],
                'acqua-alta': ['He was standing in the square. On purpose. In it.'],
                'the-calli': ['Through the calli at high water. That is the local route, that is.'] } });
    venSeedRec = game.addLocal({ biome: 'venice', x: venSEED_AT.x, y: venTerrain(venSEED_AT.x, venSEED_AT.z), z: venSEED_AT.z, near: 6, face: 0.4,
      figure: { shirt: PALETTE.cloth4, hat: PALETTE.venStone },
      lines: ['Corn is forbidden since 2008. This is birdseed. Entirely different.',
              'They know me. Watch — no, they knew my father. They know the coat.',
              { t: 'Do not run at them. Everyone runs at them.', before: 'pigeon-storm' },
              { t: 'You ran at them. Of course you ran at them.', after: 'pigeon-storm' },
              // he counts, because a man who has fed the same flock for nine
              // years is exactly the person who would know the number
              { t: 'Hundred and eighty in this square. I have counted. Twice.', when: venDry },
              { t: 'They go up before the water does. Every time. Better forecast than the phone.',
                when: venComing },
              { t: 'Nothing to feed. They are all on the Procuratie waiting it out.',
                when: venHigh }],
      wheek: ['THERE. You see? Every one of them. That took me nine years to learn.',
              { t: 'And they did not move. Nine years, and a rodent gets the same result.',
                when: venHigh }],
      onTask: { 'pigeon-storm': ['ALL of them. In one go. I have never seen all of them.',
                                 'Nine years I have been trying to do that by accident.'] } });
    game.addLocal({ biome: 'venice', x: -50, y: venTerrain(-50, -35), z: -35, near: 6, face: 1.6,
      figure: { shirt: PALETTE.venMosaic, legs: PALETTE.hair2 },
      lines: ['Papier mâché. Fourteen layers. The nose takes a day on its own.',
              'The plague doctor sells. I hate the plague doctor.',
              'A face like yours does not need one of these.',
              // he is in the calli, which is the one place in the chapter you
              // can be lost, so he is the signpost
              { t: 'Lost? Everybody is lost. Follow the yellow signs and you will be lost slower.',
                before: 'the-calli' },
              { t: 'Two bridges over that rio. You found one. Most people find neither.',
                after: 'the-calli' },
              { t: 'Up here we stay dry. That is the whole reason anybody lives up here.',
                when: venHigh },
              { t: 'Carnevale I sell four hundred of these. Today, one. To nobody.',
                when: venDry }],
      wheek: ['In this lane? You could crack the plaster.',
              'A metre and a half of wall either side. That went straight up my spine.'],
      onTask: { 'the-calli': ['Side to side, first go. You are either lucky or you are from here.'] } });
    // the greengrocer stands beside his boat rather than four metres inland of
    // it: venFRUIT is filled in while the barge is built, off the same canal
    // table the barge is placed from, so the two cannot drift apart.
    venFruitRec = game.addLocal({ biome: 'venice', x: venFRUIT.lx, y: venTerrain(venFRUIT.lx, venFRUIT.lz),
      z: venFRUIT.lz, near: 7, face: venFRUIT.face,
      figure: { shirt: PALETTE.venShutter, legs: PALETTE.cloth3 },
      lines: ['The boat is the shop. It has been the shop since my grandmother.',
              'Radicchio, castraure, and whatever the market did not want at six.',
              'High water is fine for me. I float. The greengrocer does not.',
              { t: 'Bridge over your head is the Rialto. Everybody photographs it from down here.',
                before: 'rialto' },
              { t: 'You went over the top of it at a run. There are STEPS.', after: 'rialto' },
              { t: 'Castraure. Two weeks a year, and this is the second week.', when: venDry },
              { t: 'I am tying on. Whole boat comes up with it and the awning does not.',
                when: venComing },
              { t: 'See? Level with the fondamenta. I could step off onto the street.',
                when: venHigh }],
      wheek: ['You are frightening the artichokes.',
              'The whole canal heard that and it came back twice.'],
      onTask: { 'rialto': ['Over the Rialto at a RUN. In front of the tour boats as well.'],
                'traghetto': ['Standing up the whole way. He is showing off and it is working.'] } });

    // ---- AND THEY TALK TO EACH OTHER ---------------------------------------
    // Nine people in the most crowded square in Europe and not one word of it
    // was ever addressed to anybody but the capybara — so unless the player
    // walked up and stood there, San Marco was silent. Five other chapters
    // have had exchanges since v20 and this one, which has more standing cast
    // than any of them, had none.
    //
    // Each pair is two people who can genuinely see each other, and every
    // scrap is about the thing they are both looking at: the water. They run
    // when the player is near enough to read both bubbles and far enough not
    // to be the subject, which is what makes them feel overheard rather than
    // performed.
    if (typeof game.addExchange === 'function') {
      if (venWaiterRec && venBandRec) {
        game.addExchange({ biome: 'venice', a: venWaiterRec, b: venBandRec, lines: [
          ['Are you going to move the cello, or am I?', 'The cello has been through worse than you.'],
          ['One metre ten, they are saying.', 'Then we are playing the Vivaldi standing up. Again.'],
          ['Table six wants to know if it is safe.', 'Tell table six it is Tuesday.'],
          ['Your man has wellingtons and you have shoes.', 'My man has wellingtons and no tone.'],
        ] });
      }
      if (venCrewRec && venGondRec) {
        game.addExchange({ biome: 'venice', a: venCrewRec, b: venGondRec, lines: [
          ['Boards out in ninety seconds. Move the boat.', 'The boat has been here since 1580.'],
          ['You will not get under the Rialto at that height.', 'I will not be going under the Rialto.'],
          ['Forecast says one ten.', 'Forecast said ninety on Tuesday and I swam home.'],
        ] });
      }
      if (venSeedRec && venWellRec) {
        game.addExchange({ biome: 'venice', a: venSeedRec, b: venWellRec, lines: [
          ['They went up on their own. Before the siren.', 'They always do. Nobody ever believes you.'],
          ['Hundred and eighty. I counted twice.', 'You counted the same forty four times.'],
          ['That animal is not from here.', 'Nothing in this square is from here. Look at the horses.'],
        ] });
      }
    }
  }

  if (typeof game.registerShadowTarget === 'function') game.registerShadowTarget(venRoot);
}

// ============================================================== THE CROWD ===
/**
 * SAN MARCO HAD NINE PEOPLE IN IT.
 *
 * Nine named locals, a hundred and eighty pigeons, and — in the most walked-on
 * square in Europe, on the one afternoon a year anybody photographs it — nobody
 * else at all. Hong Kong has had eighty instanced pedestrians on its pavement
 * since chapter eleven shipped; this square, which is four times the area, had
 * a waiter and a man with a bag of seed.
 *
 * Forty-eight of them, six instanced meshes, one draw call each. What makes
 * them worth the buffer is not the count — it is that THEY READ THE TIDE, and
 * therefore the crowd is the chapter's own mechanic drawn at forty-eight
 * places at once:
 *
 *   DRY      they wander the square on errands, at a stroll, and about a third
 *            of them stop dead and look up at the campanile, because that is
 *            what people do in that square and nothing else.
 *   COMING   the siren has gone. They stop strolling and make for the nearest
 *            end of the passerelle at a proper walk. Nobody runs; Venetians do
 *            not run for this.
 *   HIGH     single file on the boards, one behind another, the whole length of
 *            the square. That is the photograph.
 *   ...and whoever cannot reach a plank wades, at half speed, for the arcade.
 *
 * So the passerelle stops being a bare plank the player runs along and becomes
 * a plank with a QUEUE on it, and the player has to get past them or go round —
 * which is exactly what the real thing is like and is much funnier.
 *
 * COST. Six InstancedMeshes of 48, no bodies (a crowd you can walk through is
 * the right crowd), and one pass of forty-eight in the update.
 */
const venCROWD_N = 48;
let venCrowd = null;
// x, z, yaw, phase, speed, state, target x, target z, gawp, queue slot
const venCrowdData = new Float32Array(venCROWD_N * 10);
const venCROWD_WALK = 0, venCROWD_TOBOARD = 1, venCROWD_ONBOARD = 2, venCROWD_WADE = 3;

function venCrowdGeo(parts) { const M = venMerger(); parts(M); return M.build(); }

function venBuildCrowd(root) {
  const limb = (sgn) => venCrowdGeo((M) => {
    M.box(sgn * 0.11, -0.4, 0, 0.16, 0.8, 0.18, 0xf2f2f2);
    M.box(sgn * 0.11, -0.79, 0.03, 0.17, 0.1, 0.26, 0xdcdcdc);
    M.box(-sgn * 0.29, 0.24, 0, 0.13, 0.54, 0.14, 0xffffff);
    M.box(-sgn * 0.29, -0.06, 0, 0.12, 0.12, 0.13, 0xe8e8e8);
  });
  const gBody = venCrowdGeo((M) => {
    M.box(0, 0, 0, 0.46, 0.62, 0.27, 0xffffff);
    M.box(0, 0.35, 0, 0.5, 0.08, 0.29, 0xf0f0f0);
  });
  const gHead = venCrowdGeo((M) => {
    M.box(0, 0, 0, 0.25, 0.29, 0.24, 0xffffff);
    M.box(0, 0.16, -0.01, 0.27, 0.09, 0.26, 0x9c9c9c);
    M.box(0, 0.0, 0.135, 0.05, 0.05, 0.05, 0xffffff);
  });
  // ---- AND WHAT THEY ARE CARRYING ---------------------------------------
  // A camera held up at the face, which is the ONE prop that says "this is
  // Piazza San Marco" rather than "this is a street". Drawn at the head rather
  // than the hand, because that is where it goes.
  const gCam = venCrowdGeo((M) => {
    M.box(0, 0, 0.10, 0.19, 0.13, 0.09, 0xffffff);
    M.cyl(0, 0, 0.18, 0.055, 0.09, 0xd8d8d8, Math.PI * 0.5, 0, 0, 6);
  });
  // and the other half of the square: an umbrella, up, because the acqua alta
  // arrives with the weather that caused it
  const gBrolly = venCrowdGeo((M) => {
    M.cyl(0, -0.1, 0, 0.03, 1.0, 0x8a8a8a, 0, 0, 0, 4);
    M.cone(0, 0.56, 0, 0.66, 0.34, 0xffffff, 0, 0, 0, 8);
    M.cyl(0, 0.4, 0, 0.64, 0.03, 0xdedede, 0, 0, 0, 8);
  });
  const mk = (geo) => {
    const m = new THREE.InstancedMesh(geo, mat(0xffffff, { vertexColors: true }), venCROWD_N);
    m.castShadow = true; m.frustumCulled = false;
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(venCROWD_N * 3), 3);
    root.add(m);
    return m;
  };
  venCrowd = { a: mk(limb(1)), b: mk(limb(-1)), body: mk(gBody), head: mk(gHead),
               cam: mk(gCam), brolly: mk(gBrolly) };
  let seed = 91741;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  // A WINTER SQUARE, NOT A SUMMER ONE. It is four in the afternoon in the wet
  // season, so the crowd is a range of greys with one or two coats that were a
  // colour once — which is also what keeps forty-eight people from fighting the
  // two loud things in this palette.
  const COAT = [0x6b6f74, 0x8a8f94, 0x4f545a, 0xa89c8c, 0x5d6b6f, 0x9aa0a6,
                0x7a6a62, 0x3f4650, 0xb0a894, 0x6f5a52];
  const SKIN = [0xe8c9a6, 0xdcb894, 0xf0d4b4, 0xc9a077];
  const col = new THREE.Color();
  for (let i = 0; i < venCROWD_N; i++) {
    const o = i * 10;
    // scattered over the paving and clear of the buildings — venNavBlocked is
    // the same test everything else in this chapter steers by
    let x = 0, z = 0;
    for (let k = 0; k < 12; k++) {
      x = venPZ_X0 + 2 + rnd() * (venPZ_X1 - venPZ_X0 - 4);
      z = venPZ_Z0 + 2 + rnd() * (venPT_Z1 - venPZ_Z0 - 4);
      if (!venNavBlocked(x, z, 1.2)) break;
    }
    venCrowdData[o] = x; venCrowdData[o + 1] = z;
    venCrowdData[o + 2] = rnd() * 6.28;
    venCrowdData[o + 3] = rnd() * 6.28;
    venCrowdData[o + 4] = 0.72 + rnd() * 0.55;
    venCrowdData[o + 5] = venCROWD_WALK;
    venCrowdData[o + 6] = x; venCrowdData[o + 7] = z;
    venCrowdData[o + 8] = 0;
    // Their place in the queue, fixed at build. A queue whose order is decided
    // per frame by distance is a queue that swaps people round in front of you.
    venCrowdData[o + 9] = i / venCROWD_N;
    col.set(COAT[(rnd() * COAT.length) | 0]);
    for (const m of [venCrowd.a, venCrowd.b, venCrowd.body]) m.instanceColor.setXYZ(i, col.r, col.g, col.b);
    col.set(SKIN[(rnd() * SKIN.length) | 0]);
    venCrowd.head.instanceColor.setXYZ(i, col.r, col.g, col.b);
    col.set(0x2f3438);
    venCrowd.cam.instanceColor.setXYZ(i, col.r, col.g, col.b);
    col.set(rnd() < 0.55 ? 0x2f3438 : 0x54606a);
    venCrowd.brolly.instanceColor.setXYZ(i, col.r, col.g, col.b);
  }
  for (const k of ['a', 'b', 'body', 'head', 'cam', 'brolly']) {
    venCrowd[k].instanceColor.needsUpdate = true;
  }
}

/** A new errand somewhere else on the paving, clear of the buildings. */
function venCrowdErrand(i) {
  const o = i * 10;
  for (let k = 0; k < 10; k++) {
    const x = venPZ_X0 + 2.5 + Math.random() * (venPZ_X1 - venPZ_X0 - 5);
    const z = venPZ_Z0 + 2.5 + Math.random() * (venPT_Z1 - venPZ_Z0 - 5);
    if (venNavBlocked(x, z, 1.2)) continue;
    // and it has to be somewhere worth walking to
    if (Math.hypot(x - venCrowdData[o], z - venCrowdData[o + 1]) < 8) continue;
    venCrowdData[o + 6] = x; venCrowdData[o + 7] = z;
    return;
  }
}

// ---- AND THE SQUARE MAKES A NOISE ---------------------------------------
// Forty-eight people, and it was as quiet as an empty room. A crowd is a SOUND
// before it is a picture: the thing that tells you San Marco is full is not
// counting the coats, it is the flat wash of forty conversations bouncing off
// four hundred metres of stone.
//
// One throttled voice, level from how many of them are actually within earshot,
// and it goes UP a third at high water because a crowd standing on a plank in
// the sea is a crowd with opinions. It is deliberately quiet — this is weather,
// not an event, and the chapter already has a siren, an orchestra, a clock and
// a hundred and eighty birds to get past.
let venMurmurT = 2.5;
// The Volo is up and low enough to be worth turning round for.
let venVoloWatch = false;
let venVoloCheered = false;

function venUpdateCrowd(game, dt) {
  if (!venCrowd || !venBrdX) return;
  const cp = game.capy && game.capy.position;
  const lvl = venTideLevel();
  const boardsUp = venBoardOut > 0.7;
  // The cradle is out on the wire and it is over the square rather than parked
  // on its stage: the same test the pigeon bow-wave uses, so the birds and the
  // people react to exactly the same thing.
  venVoloWatch = (venVoloPhase === 1 || venVoloPhase === 2 || venVoloPhase === 3) &&
                 venVoloPos.y > 6;
  // The three states of the square, from the one number the whole chapter is
  // about. `coming` is the siren having gone and the water not yet up.
  const coming = venPhase >= venTIDE_WARN && lvl < 0.55;
  const high = lvl >= 0.55;

  for (let i = 0; i < venCROWD_N; i++) {
    const o = i * 10;
    let x = venCrowdData[o], z = venCrowdData[o + 1];
    let yaw = venCrowdData[o + 2];
    let st = venCrowdData[o + 5];
    const spd = venCrowdData[o + 4];
    const wet = venWaterY > venTerrain(x, z) + 0.06;

    // ---- what they should be doing ---------------------------------------
    // ONE TRANSITION PER FRAME AND ALWAYS FORWARD THROUGH THE LADDER. A state
    // machine that can be pushed both ways by a damped number — and the tide is
    // damped — chatters on the boundary, and forty-eight people flickering
    // between "stroll" and "evacuate" is worse than either of them.
    if (high || (coming && wet)) {
      if (boardsUp) { if (st !== venCROWD_ONBOARD) st = venCROWD_TOBOARD; }
      else st = venCROWD_WADE;
    } else if (coming && boardsUp) {
      if (st === venCROWD_WALK) st = venCROWD_TOBOARD;
    } else if (!coming && !high) {
      // the water has gone. They get off the planks and go back to strolling.
      if (st !== venCROWD_WALK) { st = venCROWD_WALK; venCrowdErrand(i); }
    }

    let moving = 0;
    if (st === venCROWD_ONBOARD) {
      // ---- SINGLE FILE, AND IT IS THE PICTURE ---------------------------
      // Their fixed queue slot walks the resampled duckboard centreline, so
      // nobody overtakes and nobody swaps, and the whole line shuffles up and
      // back over about a minute.
      let t = venCrowdData[o + 9] + Math.sin(venTime * 0.10 + i * 0.21) * 0.045;
      t = t - Math.floor(t);              // wrap, or the two ends pile up
      venLinePoint(venBrdX, venBrdZ, venBrdS, venBrdLen, t, venLineOut);
      x = venLineOut.x; z = venLineOut.z;
      yaw = venLineOut.yaw;
      moving = 1;
      venCrowdData[o + 3] += dt * 3.4;
    } else if (st === venCROWD_TOBOARD) {
      const n = venNearLine(venBrdX, venBrdZ, venBrdS, venBrdLen, x, z);
      venLinePoint(venBrdX, venBrdZ, venBrdS, venBrdLen, n.t, venLineOut);
      const dx = venLineOut.x - x, dz = venLineOut.z - z;
      const d = Math.hypot(dx, dz);
      if (d < 1.1) {
        st = venCROWD_ONBOARD;
        // ...and they take the slot nearest where they got on, so the line
        // does not shuffle sideways the moment it forms
        venCrowdData[o + 9] = n.t;
      } else {
        const k = spd * 1.35 * dt / d;
        x += dx * k; z += dz * k;
        yaw = Math.atan2(dx, dz);
        moving = 1;
        venCrowdData[o + 3] += dt * 5.2;
      }
    } else if (st === venCROWD_WADE) {
      // knees up, half speed, heading for the arcade — which is the edge of
      // the piazza in x, and is the only dry thing left
      const wantX = x < (venPZ_X0 + venPZ_X1) * 0.5 ? venPZ_X0 + 1.2 : venPZ_X1 - 1.2;
      const dx = wantX - x;
      if (Math.abs(dx) > 0.5) {
        const k = spd * 0.45 * dt * (dx > 0 ? 1 : -1);
        x += k;
        yaw = dx > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
        moving = 1;
        venCrowdData[o + 3] += dt * 3.0;
      }
    } else {
      // ---- STROLLING, AND SOMETIMES STOPPING TO LOOK UP ------------------
      // The gawp is the whole reason this reads as a SQUARE rather than a
      // pavement: about a third of them are standing still at any moment with
      // their heads back, which is what people in San Marco actually do and is
      // also free — a person not walking costs no movement code at all.
      let gawp = venCrowdData[o + 8];
      if (gawp > 0) {
        gawp -= dt;
        // AND WHAT THEY ARE LOOKING AT IS WHATEVER IS WORTH LOOKING AT.
        // Normally the campanile; but if the Volo is up, the whole square turns
        // and follows the cradle. Forty-eight people all facing the same way at
        // something the player is standing IN is the entire reason to build a
        // crowd — the mini stops being a ride and becomes a thing that is
        // happening to a square full of people.
        const at = venVoloWatch ? venVoloPos : venCAMPANILE;
        const wy = Math.atan2(at.x - x, at.z - z);
        yaw = yaw + ((wy - yaw + Math.PI * 3) % (Math.PI * 2) - Math.PI) * clamp(dt * 2.4, 0, 1);
      } else {
        const dx = venCrowdData[o + 6] - x, dz = venCrowdData[o + 7] - z;
        const d = Math.hypot(dx, dz);
        if (d < 1.4) {
          venCrowdErrand(i);
          if (Math.random() < 0.45) gawp = 2.5 + Math.random() * 5.5;
        } else {
          const k = spd * dt / d;
          x += dx * k; z += dz * k;
          yaw = Math.atan2(dx, dz);
          moving = 1;
          venCrowdData[o + 3] += dt * 4.4;
        }
      }
      venCrowdData[o + 8] = gawp;
    }

    // ---- AND THEY GET OUT OF THE WAY --------------------------------------
    // A capybara at a run through a crowd that does not move is a capybara
    // running through furniture. Two metres, pushed out along the line between
    // them, and it is a POSITION nudge rather than a velocity so it cannot
    // accumulate into somebody being launched across the square.
    if (cp) {
      const px = x - cp.x, pz = z - cp.z;
      const pd = Math.hypot(px, pz);
      if (pd < 2.0 && pd > 1e-3 && st !== venCROWD_ONBOARD) {
        const push = (2.0 - pd) * clamp(dt * 6, 0, 0.5);
        x += px / pd * push; z += pz / pd * push;
      }
    }

    venCrowdData[o] = x; venCrowdData[o + 1] = z;
    venCrowdData[o + 2] = yaw;
    venCrowdData[o + 5] = st;

    // ---- draw it ----------------------------------------------------------
    // The feet stand on whatever they are standing on: the paving, the deck of
    // the passerelle, or — wading — a little lower, because somebody in thirty
    // centimetres of water is thirty centimetres shorter.
    let fy = venTerrain(x, z);
    if (st === venCROWD_ONBOARD) fy += venBOARD_Y + 0.14;
    else if (st === venCROWD_WADE) fy -= clamp(venWaterY - fy, 0, 0.34);
    const ph = venCrowdData[o + 3];
    const sw = moving ? Math.sin(ph) * 0.52 : Math.sin(ph * 0.12) * 0.03;
    const bob = moving ? Math.abs(Math.sin(ph)) * 0.045 : 0;
    // ---- THE THREE OFFSETS ARE NOT FREE PARAMETERS ------------------------
    // The limb geometry hangs DOWN from its own origin (the hip is at 0 and the
    // shoe is at -0.79) and the body and head are centred on theirs, so the
    // three heights are a rig and not three numbers: hip 0.82, body centre
    // 1.14, head centre 1.62 over the feet. The first cut of this authored one
    // origin at fy + 0.86 and hung everything off it, which put a sixteen-
    // centimetre gap between every shoulder and every head — forty-eight
    // floating heads, and it is the first thing in the frame. Measured off the
    // rendered PNG, 24 Aug 2026; same rig as Mong Kok's eighty, deliberately.
    venCrowd.a.setMatrixAt(i, venXform(x, fy + 0.82 + bob, z, sw, yaw, 0, 1, 1, 1));
    venCrowd.b.setMatrixAt(i, venXform(x, fy + 0.82 + bob, z, -sw, yaw, 0, 1, 1, 1));
    venCrowd.body.setMatrixAt(i, venXform(x, fy + 1.14 + bob, z, 0, yaw, 0, 1, 1, 1));
    // the head tips back for the campanile, which is the whole gesture
    const upv = (st === venCROWD_WALK && venCrowdData[o + 8] > 0) ? -0.42 : 0;
    venCrowd.head.setMatrixAt(i, venXform(x, fy + 1.62 + bob, z, upv, yaw, 0, 1, 1, 1));
    // ---- the camera is only up while they are actually looking ------------
    // A crowd all holding cameras to their faces while they walk is a crowd of
    // mannequins. It appears on the gawpers, and it is the only reason the
    // gawp reads from across the square.
    const cs = (st === venCROWD_WALK && venCrowdData[o + 8] > 0 && (i % 3) === 0) ? 1 : 0.0001;
    venCrowd.cam.setMatrixAt(i, venXform(x, fy + 1.60 + bob, z, upv, yaw, 0, cs, cs, cs));
    // and the umbrella, once the water is on its way, on some of them
    const bs = ((coming || high) && (i % 4) === 1) ? 1 : 0.0001;
    venCrowd.brolly.setMatrixAt(i, venXform(
      x + Math.sin(yaw) * 0.16, fy + 1.62 + bob, z + Math.cos(yaw) * 0.16,
      0.12, yaw, 0, bs, bs, bs));
  }
  for (const k of ['a', 'b', 'body', 'head', 'cam', 'brolly']) {
    venCrowd[k].instanceMatrix.needsUpdate = true;
  }

  // ---- the murmur ---------------------------------------------------------
  venMurmurT -= dt;
  if (venMurmurT <= 0) {
    venMurmurT = 2.6 + Math.random() * 2.2;
    if (cp) {
      // how many of them are within earshot, which is the level
      let n = 0;
      for (let i = 0; i < venCROWD_N; i++) {
        const o = i * 10;
        const dx = venCrowdData[o] - cp.x, dz = venCrowdData[o + 1] - cp.z;
        if (dx * dx + dz * dz < 26 * 26) n++;
      }
      if (n > 3) {
        const v = clamp(n / venCROWD_N, 0, 1);
        venSfx('rustle', { volume: 0.045 + v * 0.075, pitch: 0.52 + Math.random() * 0.14 });
        if (high) venSfx('rustle', { volume: 0.03 + v * 0.05, pitch: 0.78 });
      }
    }
  }

  // ---- AND THEY CHEER THE ANGEL, ONCE ------------------------------------
  // The Volo's own payoff has always been a chime, some paper and a shake, all
  // of it happening to nobody. The square is full; the square should be the
  // payoff. Fires on the frame the cradle reaches the far tower and only if
  // there are people in earshot, and it is cleared when the rig resets.
  if (venVoloPhase === 3 && !venVoloCheered) {
    venVoloCheered = true;
    if (cp && Math.hypot(cp.x - venVoloPos.x, cp.z - venVoloPos.z) < 70) {
      venSfx('cheer', { volume: 0.55, force: true, at: { x: -4, y: 1, z: -34 } });
    }
  } else if (venVoloPhase === 0) venVoloCheered = false;
}
